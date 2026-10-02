import { prisma } from "@/lib/db/prisma";

export const pollSelect = {
  id: true,
  multiple: true,
  closesAt: true,
  totalVoters: true,
  options: { orderBy: { position: "asc" }, select: { id: true, label: true, voteCount: true } },
} as const;

export async function findPollByPost(postId: string) {
  return prisma.poll.findUnique({ where: { postId }, select: pollSelect });
}

/** Option ids the user picked, per poll. */
export async function findViewerPollVotes(pollIds: readonly string[], userId: string): Promise<Map<string, string[]>> {
  if (pollIds.length === 0) return new Map();
  const rows = await prisma.pollVote.findMany({
    where: { userId, pollId: { in: [...pollIds] } },
    select: { pollId: true, optionId: true },
  });
  const byPoll = new Map<string, string[]>();
  for (const row of rows) byPoll.set(row.pollId, [...(byPoll.get(row.pollId) ?? []), row.optionId]);
  return byPoll;
}

/**
 * Replace the user's ballot (empty = retract) and recompute the counters from
 * the vote rows in the same transaction, so concurrent ballots cannot make
 * them drift.
 */
export async function replaceBallot(pollId: string, userId: string, optionIds: readonly string[]) {
  return prisma.$transaction(async (tx) => {
    await tx.pollVote.deleteMany({ where: { pollId, userId } });
    if (optionIds.length > 0) {
      await tx.pollVote.createMany({
        data: optionIds.map((optionId) => ({ pollId, optionId, userId })),
        skipDuplicates: true,
      });
    }
    const [perOption, voters] = await Promise.all([
      tx.pollVote.groupBy({ by: ["optionId"], where: { pollId }, _count: { _all: true } }),
      tx.pollVote.findMany({ where: { pollId }, distinct: ["userId"], select: { userId: true } }),
    ]);
    const counts = new Map(perOption.map((row) => [row.optionId, row._count._all]));
    const options = await tx.pollOption.findMany({ where: { pollId }, select: { id: true } });
    for (const option of options) {
      await tx.pollOption.update({ where: { id: option.id }, data: { voteCount: counts.get(option.id) ?? 0 } });
    }
    return tx.poll.update({ where: { id: pollId }, data: { totalVoters: voters.length }, select: pollSelect });
  });
}

/** Who voted for which option (most recent first), banned accounts left out. */
export async function findPollVoters(pollId: string) {
  return prisma.pollVote.findMany({
    where: { pollId, user: { banned: false } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { optionId: true, user: { select: { id: true, name: true, username: true, image: true } } },
  });
}


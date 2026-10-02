/**
 * Poll voting.
 *
 * Voting follows the same rule as reacting: the post must be live and the
 * voter able to interact with it (member of its group, if any). Votes are
 * public to whoever can read the post, as on other social apps.
 */

import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import type { AuthUser } from "@/types";

import { broadcastEngagement } from "../posts/posts.engagement";
import { loadInteractivePost, loadReadablePost, postAudience } from "../posts/posts.service";
import { toPollDto, type PollDto } from "./polls.dto";
import { findPollByPost, findPollVoters, replaceBallot } from "./polls.repository";

export interface BallotResult {
  readonly poll: PollDto;
  readonly viewerVotes: string[];
}

export async function castBallot(postId: string, optionIds: readonly string[], actor: AuthUser): Promise<BallotResult> {
  const post = await loadInteractivePost(postId, actor);
  const poll = await findPollByPost(postId);
  if (!poll) throw new NotFoundError("This post has no poll.");
  if (poll.closesAt && poll.closesAt.getTime() <= Date.now()) throw new ConflictError("This poll is closed.");

  const unique = [...new Set(optionIds)];
  const known = new Set(poll.options.map((option) => option.id));
  if (unique.some((id) => !known.has(id))) throw new BadRequestError("Unknown poll option.");
  if (!poll.multiple && unique.length > 1) throw new BadRequestError("Pick a single option.");

  await enforceThenRecord([{ key: rateLimitKey("poll:vote", actor.id), rule: RATE_LIMITS.reaction }]);

  const updated = await replaceBallot(poll.id, actor.id, unique);
  void broadcastEngagement(postId, postAudience(post));
  return { poll: toPollDto(updated), viewerVotes: unique };
}

export interface PollVotersDto {
  readonly options: readonly {
    readonly id: string;
    readonly label: string;
    readonly voters: readonly { id: string; name: string; username: string | null; image: string | null }[];
  }[];
}

/** Votes are public, like on other social apps: anyone who can read the post sees who chose what. */
export async function listPollVoters(postId: string, viewer: AuthUser | null): Promise<PollVotersDto> {
  await loadReadablePost(postId, viewer);
  const poll = await findPollByPost(postId);
  if (!poll) throw new NotFoundError("This post has no poll.");
  const votes = await findPollVoters(poll.id);
  return {
    options: poll.options.map((option) => ({
      id: option.id,
      label: option.label,
      voters: votes.filter((vote) => vote.optionId === option.id).map((vote) => vote.user),
    })),
  };
}


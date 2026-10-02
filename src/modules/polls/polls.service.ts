/**
 * Poll voting.
 *
 * Voting follows the same rule as reacting: the post must be live and the
 * voter able to interact with it (member of its group, if any). Ballots are
 * anonymous to everyone, including the author; only totals are published.
 */

import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import type { AuthUser } from "@/types";

import { broadcastEngagement } from "../posts/posts.engagement";
import { loadInteractivePost, postAudience } from "../posts/posts.service";
import { toPollDto, type PollDto } from "./polls.dto";
import { findPollByPost, replaceBallot } from "./polls.repository";

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

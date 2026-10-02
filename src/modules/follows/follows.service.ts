import { ConflictError, NotFoundError } from "@/lib/errors";
import type { AuthUser } from "@/types";

import { notifyInBackground, notifyNewFollower } from "../notifications/notifications.service";
import {
  findActivePublicProfileByUsername,
  findActiveUserById,
  findFollowingIds,
  findFollowingTargetIds,
  searchActivePublicUsers,
} from "../users/users.repository";
import { createFollow, deleteFollow, findConnections, findFollow, findRelations } from "./follows.repository";
import { toPublicProfileDto, toSearchUserDto, type ConnectionDto, type PublicProfileDto, type SearchUserDto } from "./follows.dto";
import type { SearchUsersQuery } from "./follows.schema";
import { hasBlocked, isBlockedBetween } from "../blocks/blocks.service";

export async function getPublicProfile(username: string, viewer: AuthUser | null): Promise<PublicProfileDto> {
  const row = await findActivePublicProfileByUsername(username.toLowerCase());
  if (!row) throw new NotFoundError("That profile does not exist.");
  const other = viewer && viewer.id !== row.id;
  // Blocked by the owner: the profile does not exist for this viewer. Blocked
  // by the viewer: shown, so they can unblock.
  const viewerBlocked = other ? await hasBlocked(viewer.id, row.id) : false;
  if (other && !viewerBlocked && (await hasBlocked(row.id, viewer.id))) throw new NotFoundError("That profile does not exist.");
  const [isFollowing, followsYou] = other ? await Promise.all([findFollow(viewer.id, row.id), findFollow(row.id, viewer.id)]) : [false, false];
  return { ...toPublicProfileDto(row, isFollowing, viewer?.id === row.id, followsYou), viewerBlocked };
}

export async function followUser(targetId: string, actor: AuthUser): Promise<{ following: true }> {
  if (targetId === actor.id) throw new ConflictError("You cannot follow yourself.");
  const target = await findActiveUserById(targetId);
  if (!target || !target.username) throw new NotFoundError("That profile does not exist.");
  if (await isBlockedBetween(actor.id, targetId)) throw new NotFoundError("That profile does not exist.");

  const created = await createFollow(actor.id, targetId);
  if (created) {
    notifyInBackground(
      notifyNewFollower({
        userId: target.id,
        actor: { name: actor.name, username: actor.username },
      }),
      { userId: target.id, actorId: actor.id, action: "new_follower" },
    );
  }
  return { following: true };
}

export async function unfollowUser(targetId: string, actor: AuthUser): Promise<void> {
  if (targetId === actor.id) throw new ConflictError("You cannot unfollow yourself.");
  await deleteFollow(actor.id, targetId);
}

export async function searchUsers(query: SearchUsersQuery, actor: AuthUser): Promise<SearchUserDto[]> {
  const rows = await searchActivePublicUsers(query.q, actor.id, query.limit);
  const followingIds = await findFollowingTargetIds(actor.id, rows.map((row) => row.id));
  const following = new Set(followingIds);
  return rows.map((row) => toSearchUserDto(row, following.has(row.id)));
}

export async function getFollowingIds(userId: string): Promise<string[]> {
  return findFollowingIds(userId);
}

/** A profile's followers or followings, with the viewer's relation to each person. */
export async function listConnections(
  username: string,
  kind: "followers" | "following",
  query: { cursor?: string | undefined; limit: number },
  viewer: AuthUser | null,
): Promise<{ data: ConnectionDto[]; nextCursor: string | null }> {
  const owner = await findActivePublicProfileByUsername(username.toLowerCase());
  if (!owner) throw new NotFoundError("That profile does not exist.");
  const rows = await findConnections(owner.id, kind, query.cursor ?? null, query.limit + 1);
  const page = rows.slice(0, query.limit);
  const relations = viewer ? await findRelations(viewer.id, page.map((row) => row.user.id)) : { following: new Set<string>(), followers: new Set<string>() };
  return {
    data: page.map(({ user }) => {
      const isFollowing = relations.following.has(user.id);
      const followsYou = relations.followers.has(user.id);
      return {
        id: user.id,
        name: user.name,
        username: user.username ?? "",
        image: user.image,
        isFollowing,
        followsYou,
        isFriend: isFollowing && followsYou,
        isSelf: viewer?.id === user.id,
      };
    }),
    nextCursor: rows.length > query.limit ? (page.at(-1)?.followId ?? null) : null,
  };
}


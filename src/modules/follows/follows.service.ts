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
import { createFollow, deleteFollow, findFollow } from "./follows.repository";
import { toPublicProfileDto, toSearchUserDto, type PublicProfileDto, type SearchUserDto } from "./follows.dto";
import type { SearchUsersQuery } from "./follows.schema";

export async function getPublicProfile(username: string, viewer: AuthUser | null): Promise<PublicProfileDto> {
  const row = await findActivePublicProfileByUsername(username.toLowerCase());
  if (!row) throw new NotFoundError("That profile does not exist.");
  const isFollowing = viewer && viewer.id !== row.id ? await findFollow(viewer.id, row.id) : false;
  return toPublicProfileDto(row, isFollowing, viewer?.id === row.id);
}

export async function followUser(targetId: string, actor: AuthUser): Promise<{ following: true }> {
  if (targetId === actor.id) throw new ConflictError("You cannot follow yourself.");
  const target = await findActiveUserById(targetId);
  if (!target || !target.username) throw new NotFoundError("That profile does not exist.");

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

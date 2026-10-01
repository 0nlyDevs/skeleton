import {
  addRoomMemberRoute,
  getRoomMembersRoute,
  leaveRoomRoute,
} from "@/modules/messages/messages.routes";

export const GET = getRoomMembersRoute;
export const POST = addRoomMemberRoute;
export const DELETE = leaveRoomRoute;

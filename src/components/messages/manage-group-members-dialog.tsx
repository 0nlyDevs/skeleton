"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { RoomMemberDto } from "@/modules/messages/messages.dto";

interface ManageGroupMembersDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly roomId: string;
  readonly members: readonly RoomMemberDto[];
  readonly viewerId: string;
  readonly onRemoved: () => void;
}

/** Group admins can remove members from the conversation. Self is excluded (use Leave). */
export function ManageGroupMembersDialog({
  open,
  onOpenChange,
  roomId,
  members,
  viewerId,
  onRemoved,
}: ManageGroupMembersDialogProps) {
  const t = useTranslation();
  const [removing, setRemoving] = useState<RoomMemberDto | null>(null);

  const removeMember = async (member: RoomMemberDto) => {
    setRemoving(member);
    try {
      await apiFetch(`/api/messages/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(member.userId)}`, { method: "DELETE" });
      toast.success(t("chat.member_removed"));
      onRemoved();
      onOpenChange(false);
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setRemoving(null);
    }
  };

  const removable = members.filter((member) => member.userId !== viewerId && member.role !== "ADMIN");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>{t("messages.group_members")}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto px-2 py-2">
            {removable.length === 0 ? (
              <p className="px-3 py-4 text-center text-[0.8125rem] text-muted-foreground">{t("chat.no_members")}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {removable.map((member) => (
                  <li key={member.userId} className="flex items-center justify-between rounded-xl px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <UserAvatar userId={member.userId} name={member.name} image={member.image} size="sm" />
                      <span className="min-w-0">
                        <span className="block text-[0.875rem] font-medium">{member.name}</span>
                        {member.username ? <span className="block truncate text-[0.75rem] text-muted-foreground">@{member.username}</span> : null}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember(member)}
                      disabled={removing?.userId === member.userId}
                      aria-label={t("messages.remove_member")}
                    >
                      <Trash2 className="size-4 text-error" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? `${removing.name} ${t("chat.removed_from_group")}` : ""}
        description={t("chat.remove_confirm")}
        onConfirm={() => removing && void removeMember(removing)}
      />
    </>
  );
}

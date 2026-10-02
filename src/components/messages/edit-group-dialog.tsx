"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { CoverPicker } from "@/components/groups/group-options";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { RoomDto } from "@/modules/messages/messages.dto";

/** Group admins rename the conversation and set its photo. */
export function EditGroupDialog({ room, open, onOpenChange }: { readonly room: RoomDto; readonly open: boolean; readonly onOpenChange: (open: boolean) => void }) {
  const t = useTranslation();
  const router = useRouter();
  const [name, setName] = useState(room.name);
  const [image, setImage] = useState<string | null>(room.image);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/messages/rooms/${encodeURIComponent(room.id)}`, { method: "PATCH", body: { name: name.trim(), image } });
      toast.success(t("groups.saved"));
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("messages.edit_group")}</DialogTitle>
          <DialogDescription className="sr-only">{t("messages.edit_group")}</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-medium">{t("messages.group_name")}</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} />
        </label>
        <CoverPicker value={image} onChange={setImage} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

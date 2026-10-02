"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FormField } from "@/components/forms/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { GroupDto } from "@/modules/groups/groups.dto";

import { PrivacyPicker } from "./create-group-dialog";
import { ApprovalSwitch, CoverPicker } from "./group-options";

/** Group admins edit identity and privacy; only the owner (or a platform admin) deletes. */
export function GroupSettingsDialog({
  group,
  open,
  onOpenChange,
  onSaved,
}: {
  readonly group: GroupDto;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: (group: GroupDto) => void;
}) {
  const t = useTranslation();
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [privacy, setPrivacy] = useState(group.privacy);
  const [requiresApproval, setRequiresApproval] = useState(group.requiresApproval);
  const [coverImage, setCoverImage] = useState<string | null>(group.coverImage);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      const response = await apiFetch<{ data: GroupDto }>(`/api/groups/${group.slug}`, {
        method: "PATCH",
        body: { name: name.trim(), description: description.trim(), privacy, requiresApproval, coverImage },
      });
      onSaved(response.data);
      toast.success(t("groups.saved"));
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setErrors(error.fields);
      else toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/groups/${group.slug}`, { method: "DELETE" });
      router.replace("/groups");
      router.refresh();
    } catch (error) {
      toast.error(describeApiError(error, t));
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("groups.settings")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormField label={t("groups.name")} required {...(errors.name ? { error: errors.name } : {})}>
            {(field) => <Input {...field} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />}
          </FormField>
          <FormField label={t("groups.description")} {...(errors.description ? { error: errors.description } : {})}>
            {(field) => <Textarea {...field} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={4} />}
          </FormField>
          <PrivacyPicker value={privacy} onChange={setPrivacy} />
          <ApprovalSwitch privacy={privacy} value={requiresApproval} onChange={setRequiresApproval} />
          <CoverPicker value={coverImage} onChange={setCoverImage} />
        </div>
        <DialogFooter className="items-center sm:justify-between">
          {group.viewer.canDelete ? (
            <Button variant="ghost" className="text-error" onClick={() => setConfirmDelete(true)}>
              <Trash2 />
              {t("groups.delete")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </div>
        </DialogFooter>
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("groups.delete")}
          description={t("groups.delete_confirm")}
          busy={busy}
          onConfirm={() => void remove()}
        />
      </DialogContent>
    </Dialog>
  );
}

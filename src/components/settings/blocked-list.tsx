"use client";

import { Ban } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { BlockedUserDto } from "@/modules/blocks/blocks.service";

/** Accounts the viewer blocked, with one-click unblock. */
export function BlockedList() {
  const t = useTranslation();
  const [people, setPeople] = useState<BlockedUserDto[] | null>(null);

  useEffect(() => {
    void apiFetch<{ data: BlockedUserDto[] }>("/api/blocks")
      .then((response) => setPeople(response.data))
      .catch(() => setPeople([]));
  }, []);

  const unblock = async (person: BlockedUserDto) => {
    try {
      await apiFetch(`/api/users/${encodeURIComponent(person.id)}/block`, { method: "DELETE" });
      setPeople((current) => (current ?? []).filter((entry) => entry.id !== person.id));
      toast.success(t("block.unblocked"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ban className="size-4 text-muted-foreground" />
          {t("block.list_title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {people === null ? null : people.length === 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground">{t("block.list_empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/60">
            {people.map((person) => (
              <li key={person.id} className="flex items-center gap-3 py-2.5">
                <UserAvatar userId={person.id} name={person.name} image={person.image} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.875rem] font-medium">{person.name}</span>
                  {person.username ? <span className="block truncate text-[0.75rem] text-muted-foreground">@{person.username}</span> : null}
                </span>
                <Button size="sm" variant="secondary" onClick={() => void unblock(person)}>
                  {t("block.unblock")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

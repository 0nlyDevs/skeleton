"use client";

import { Lock, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { FollowButton } from "@/components/social/follow-button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePresence } from "@/hooks/use-presence";
import { apiFetch } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import type { ContactDto, SuggestionsDto } from "@/modules/discovery/discovery.service";

import { UserAvatar } from "./user-avatar";

function useRailData() {
  const [contacts, setContacts] = useState<ContactDto[] | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionsDto | null>(null);
  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ data: ContactDto[] }>("/api/discover/contacts")
      .then((response) => !cancelled && setContacts(response.data))
      .catch(() => !cancelled && setContacts([]));
    void apiFetch<{ data: SuggestionsDto }>("/api/discover/suggestions")
      .then((response) => !cancelled && setSuggestions(response.data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return { contacts, suggestions };
}

/** Contacts with live presence, then people and groups to discover. */
export function RightRail() {
  const t = useTranslation();
  const { contacts, suggestions } = useRailData();
  const [filter, setFilter] = useState("");
  const ids = useMemo(() => (contacts ?? []).map((contact) => contact.id), [contacts]);
  const presence = usePresence(ids);

  const visible = (contacts ?? [])
    .filter((contact) => contact.name.toLowerCase().includes(filter.toLowerCase()))
    // Online people first: the list answers "who can I talk to now?".
    .sort((a, b) => Number(presence.get(b.id)?.online ?? false) - Number(presence.get(a.id)?.online ?? false));

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">{t("contacts.title")}</h2>
        </div>
        <label className="relative mt-3 block">
          <span className="sr-only">{t("contacts.filter")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t("contacts.filter")}
            className="h-9 w-full rounded-full bg-surface-muted pl-8 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-ring/25"
          />
        </label>
        <ul className="mt-2 flex flex-col">
          {contacts === null ? (
            [0, 1, 2, 3].map((index) => <Skeleton key={index} className="my-1.5 h-9 w-full rounded-xl" />)
          ) : visible.length === 0 ? (
            <li className="px-1 py-3 text-[12.5px] leading-relaxed text-muted-foreground">{t("contacts.empty")}</li>
          ) : (
            visible.map((contact) => {
              const state = presence.get(contact.id);
              const status = state?.online
                ? t("contacts.online")
                : state?.lastSeenAt
                  ? t("contacts.last_seen", { time: formatRelative(state.lastSeenAt) })
                  : null;
              return (
                <li key={contact.id}>
                  <Link
                    href={`/messages?to=${encodeURIComponent(contact.id)}`}
                    className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-surface-muted"
                  >
                    <UserAvatar name={contact.name} image={contact.image} size="sm" online={state?.online ?? false} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{contact.name}</span>
                      {status ? (
                        <span className={state?.online ? "block text-[11.5px] text-success" : "block text-[11.5px] text-muted-foreground"}>
                          {status}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </Card>

      {suggestions && suggestions.people.length > 0 ? (
        <Card className="p-4">
          <h2 className="text-[15px] font-semibold">{t("suggest.people")}</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {suggestions.people.map((person) => (
              <li key={person.id} className="flex items-center gap-3 py-1">
                <Link href={person.username ? `/profile/${person.username}` : "#"} className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar name={person.name} image={person.image} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{person.name}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">@{person.username}</span>
                  </span>
                </Link>
                <FollowButton userId={person.id} initialFollowing={false} compact />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {suggestions && suggestions.groups.length > 0 ? (
        <Card className="p-4">
          <h2 className="text-[15px] font-semibold">{t("suggest.groups")}</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {suggestions.groups.map((group) => (
              <li key={group.id}>
                <Link href={`/groups/${group.slug}`} className="flex items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-surface-muted">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/80 to-[oklch(0.62_0.2_310)] text-[13px] font-bold text-primary-foreground">
                    {group.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-[13px] font-medium">
                      {group.name}
                      {group.privacy === "PRIVATE" ? <Lock className="size-3 text-muted-foreground" aria-hidden /> : null}
                    </span>
                    <span className="block text-[11.5px] text-muted-foreground">{t("suggest.members", { count: group.memberCount })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

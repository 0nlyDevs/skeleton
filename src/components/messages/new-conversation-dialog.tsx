"use client";

import { Check, Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { PeopleRole } from "@/modules/follows/follows.schema";
import type { RoomDto } from "@/modules/messages/messages.dto";

import { RoleBadge, RoleFilterChips } from "@/components/social/role-filter";

interface Person {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly image: string | null;
  readonly role?: PeopleRole;
}

function usePeopleSearch(q: string, role: PeopleRole | null) {
  const term = useDebouncedValue(q.trim(), 200);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    // A role alone lists that role (e.g. every agent); otherwise a name is needed.
    if (term.length < 1 && !role) {
      setPeople([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ q: term, limit: "12", ...(role ? { role } : {}) });
    void apiFetch<{ data: Person[] }>(`/api/users/search?${params.toString()}`, { signal: controller.signal })
      .then((response) => setPeople(response.data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [term, role]);
  return { people, loading };
}

function PeoplePicker({
  selected,
  onToggle,
  exclude = [],
}: {
  readonly selected: readonly Person[];
  readonly onToggle: (person: Person) => void;
  readonly exclude?: readonly string[];
}) {
  const t = useTranslation();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<PeopleRole | null>(null);
  const { people, loading } = usePeopleSearch(q, role);
  const chosen = new Set(selected.map((person) => person.id));

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((person) => (
            <button key={person.id} type="button" onClick={() => onToggle(person)} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[0.7812rem] font-medium text-accent-foreground">
              {person.name}
              <X className="size-3" />
            </button>
          ))}
        </div>
      ) : null}
      <label className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("messages.pick_people")} className="pl-9" autoFocus />
        {loading ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
      </label>
      <RoleFilterChips value={role} onChange={setRole} />
      <ul className="max-h-72 overflow-y-auto">
        {people
          .filter((person) => !exclude.includes(person.id))
          .map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => onToggle(person)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-muted", chosen.has(person.id) && "bg-accent")}
              >
                <UserAvatar name={person.name} image={person.image} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-[0.875rem] font-medium">
                    {person.name}
                    <RoleBadge role={person.role} showCitizen={role === "USER"} />
                  </span>
                  <span className="block truncate text-[0.75rem] text-muted-foreground">@{person.username}</span>
                </span>
                {chosen.has(person.id) ? <Check className="size-4 text-primary" /> : null}
              </button>
            </li>
          ))}
        {(q.trim() || role) && !loading && people.length === 0 ? <li className="px-2 py-3 text-[0.8125rem] text-muted-foreground">{t("mention.no_results")}</li> : null}
      </ul>
    </div>
  );
}

/** Start a DM (one person) or a group chat (several people + a name). */
export function NewConversationDialog({
  mode,
  onOpenChange,
  onCreated,
}: {
  readonly mode: "direct" | "group" | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (room: RoomDto) => void;
}) {
  const t = useTranslation();
  const [selected, setSelected] = useState<Person[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected([]);
    setName("");
  }, [mode]);

  const create = async (people: readonly Person[]) => {
    setBusy(true);
    try {
      const body =
        mode === "direct"
          ? { type: "DIRECT", targetUserId: people[0]?.id }
          : { type: "GROUP", name: name.trim() || people.map((person) => person.name.split(" ")[0]).join(", "), memberIds: people.map((person) => person.id) };
      const response = await apiFetch<{ data: RoomDto }>("/api/messages/rooms", { method: "POST", body });
      onCreated(response.data);
      onOpenChange(false);
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "group" ? t("messages.new_group") : t("messages.new")}</DialogTitle>
        </DialogHeader>
        {mode === "group" ? (
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("messages.group_name")} maxLength={100} />
        ) : null}
        <PeoplePicker
          selected={selected}
          onToggle={(person) => {
            if (mode === "direct") {
              void create([person]);
              return;
            }
            setSelected((current) => (current.some((entry) => entry.id === person.id) ? current.filter((entry) => entry.id !== person.id) : [...current, person]));
          }}
        />
        {mode === "group" ? (
          <DialogFooter>
            <Button onClick={() => void create(selected)} disabled={busy || selected.length === 0}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {t("messages.create")}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AddPeopleDialog({
  open,
  onOpenChange,
  roomId,
  existing,
  onAdded,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly roomId: string;
  readonly existing: readonly string[];
  readonly onAdded: () => void;
}) {
  const t = useTranslation();
  const add = async (person: Person) => {
    try {
      await apiFetch(`/api/messages/rooms/${encodeURIComponent(roomId)}/members`, { method: "POST", body: { userId: person.id } });
      onAdded();
      onOpenChange(false);
    } catch (error) {
      toast.error(describeApiError(error, t));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("messages.add_member")}</DialogTitle>
        </DialogHeader>
        <PeoplePicker selected={[]} exclude={existing} onToggle={(person) => void add(person)} />
      </DialogContent>
    </Dialog>
  );
}

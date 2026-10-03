"use client";

import { useTranslation } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";
import { PEOPLE_ROLES, type PeopleRole } from "@/modules/follows/follows.schema";

const ROLE_LABEL = { USER: "tn.people.role.citizens", AGENT: "tn.people.role.agents", ADMIN: "tn.people.role.admins" } as const;
const BADGE_LABEL = { USER: "role.user", AGENT: "role.agent", ADMIN: "role.admin" } as const;

/**
 * "Everyone / Citizens / Agents / Administrators": find a city agent (or tell
 * a fellow resident from staff) without knowing their name.
 */
export function RoleFilterChips({ value, onChange }: { readonly value: PeopleRole | null; readonly onChange: (role: PeopleRole | null) => void }) {
  const t = useTranslation();
  const options: readonly (PeopleRole | null)[] = [null, ...PEOPLE_ROLES];
  return (
    <div role="radiogroup" aria-label={t("tn.people.role.label")} className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option ?? "all"}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-full border px-3 py-1 text-[0.8125rem] font-medium transition-colors",
            value === option ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-surface-muted",
          )}
        >
          {option ? t(ROLE_LABEL[option]) : t("tn.people.role.all")}
        </button>
      ))}
    </div>
  );
}

/** A small label next to a name; nothing for ordinary citizens unless asked. */
export function RoleBadge({ role, showCitizen = false }: { readonly role: PeopleRole | undefined; readonly showCitizen?: boolean }) {
  const t = useTranslation();
  if (!role || (role === "USER" && !showCitizen)) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[0.6875rem] font-semibold",
        role === "ADMIN" ? "bg-error/12 text-error" : role === "AGENT" ? "bg-primary/12 text-primary" : "bg-surface-muted text-muted-foreground",
      )}
    >
      {t(BADGE_LABEL[role])}
    </span>
  );
}

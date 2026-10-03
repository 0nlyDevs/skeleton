"use client";

import { Ban, LogOut, Search, ShieldCheck, Undo2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { TableSkeleton } from "@/components/feedback/loading-skeleton";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFormatters } from "@/hooks/use-formatters";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import { cn, initials } from "@/lib/utils";
import type { AdminUserDto } from "@/modules/users/users.dto";
import type { ListMeta } from "@/types";

const FILTERS = ["all", "active", "suspended", "unverified"] as const;
type Filter = (typeof FILTERS)[number];

const DURATIONS = { "24h": 1, "7d": 7, "30d": 30, none: null } as const;
type Duration = keyof typeof DURATIONS;

type Pending =
  | { readonly kind: "suspend"; readonly user: AdminUserDto }
  | { readonly kind: "reinstate"; readonly user: AdminUserDto }
  | { readonly kind: "sign-out"; readonly user: AdminUserDto };

/**
 * F34 — agents administer resident accounts: find one, suspend or reinstate
 * it, or sign it out of every device. Every action says what it does before
 * it runs; the server refuses any account that is not a resident's.
 */
export function CitizensManager() {
  const t = useTranslation();
  const fmt = useFormatters();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ data: AdminUserDto[]; meta: ListMeta } | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<Duration>("7d");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setResult(await apiFetch<{ data: AdminUserDto[]; meta: ListMeta }>(`/api/agent/citizens${toQueryString({ q: query || undefined, status: filter, page, limit: 20 })}`));
    } catch {
      setFailed(true);
    }
  }, [query, filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (next: Pending) => {
    setReason("");
    setDuration("7d");
    setPending(next);
  };

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const id = encodeURIComponent(pending.user.id);
      if (pending.kind === "sign-out") {
        const { revoked } = await apiFetch<{ revoked: number }>(`/api/agent/citizens/${id}/sessions`, { method: "DELETE" });
        toast.success(t("tn.agent.citizens.done.signed_out", { count: revoked }));
      } else {
        const days = DURATIONS[duration];
        await apiFetch(`/api/agent/citizens/${id}/suspension`, {
          method: "PATCH",
          body:
            pending.kind === "suspend"
              ? {
                  banned: true,
                  ...(reason.trim() ? { reason: reason.trim() } : {}),
                  ...(days ? { expiresAt: new Date(Date.now() + days * 86_400_000).toISOString() } : {}),
                }
              : { banned: false },
        });
        toast.success(t(pending.kind === "suspend" ? "tn.agent.citizens.done.suspended" : "tn.agent.citizens.done.reinstated"));
      }
      setPending(null);
      await load();
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  const meta = result?.meta;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("tn.agent.citizens.title")}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("tn.agent.citizens.subtitle")}</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{t("tn.agent.citizens.search")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("tn.agent.citizens.search")} className="pl-9" maxLength={120} />
        </label>
        <div role="group" aria-label={t("tn.agent.citizens.filter_label")} className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                filter === value ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-surface-muted",
              )}
            >
              {t(`tn.agent.citizens.filter.${value}` as MessageKey)}
            </button>
          ))}
        </div>
      </div>

      {failed ? (
        <ErrorState onRetry={() => void load()} />
      ) : !result ? (
        <TableSkeleton />
      ) : result.data.length === 0 ? (
        <EmptyState icon={Users} title={t("tn.agent.citizens.empty")} />
      ) : (
        <>
          <p className="px-1 text-[0.8125rem] text-muted-foreground" aria-live="polite">
            {t("tn.agent.citizens.count", { count: meta?.total ?? result.data.length })}
          </p>
          <ul className="flex flex-col divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-panel">
            {result.data.map((user) => (
              <li key={user.id} className={cn("flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center", user.banned && "bg-error/5")}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar className="size-10">
                    {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                    <AvatarFallback>{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-[0.8125rem] text-muted-foreground">{user.email}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[0.75rem] text-muted-foreground">
                      {user.banned ? (
                        <Badge variant="error">{t("tn.agent.citizens.status.suspended")}</Badge>
                      ) : (
                        <Badge variant="success">{t("tn.agent.citizens.status.active")}</Badge>
                      )}
                      {!user.emailVerified ? <Badge variant="warning">{t("tn.agent.citizens.status.unverified")}</Badge> : null}
                      {user.twoFactorEnabled ? <Badge variant="neutral">{t("tn.agent.citizens.status.two_factor")}</Badge> : null}
                      <span>{t("tn.agent.citizens.since", { date: fmt.date(user.createdAt) })}</span>
                    </span>
                    {user.banned && user.banReason ? <span className="text-[0.75rem] text-muted-foreground">{t("tn.agent.citizens.suspended_reason", { reason: user.banReason })}</span> : null}
                    {user.banned && user.banExpires ? <span className="text-[0.75rem] text-muted-foreground">{t("tn.agent.citizens.suspended_until", { date: fmt.dateTime(user.banExpires) })}</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {user.banned ? (
                    <Button type="button" size="sm" variant="secondary" onClick={() => open({ kind: "reinstate", user })}>
                      <Undo2 aria-hidden />
                      {t("tn.agent.citizens.reinstate")}
                    </Button>
                  ) : (
                    <>
                      <Button type="button" size="sm" variant="secondary" onClick={() => open({ kind: "sign-out", user })}>
                        <LogOut aria-hidden />
                        {t("tn.agent.citizens.sign_out")}
                      </Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => open({ kind: "suspend", user })}>
                        <Ban aria-hidden />
                        {t("tn.agent.citizens.suspend")}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {meta && meta.totalPages > 1 ? (
            <nav className="flex items-center justify-between gap-2" aria-label={t("tn.agent.citizens.page", { page: meta.page, total: meta.totalPages })}>
              <Button type="button" size="sm" variant="secondary" disabled={!meta.hasPreviousPage} onClick={() => setPage((value) => value - 1)}>
                {t("tn.agent.citizens.previous")}
              </Button>
              <span className="text-[0.8125rem] text-muted-foreground">{t("tn.agent.citizens.page", { page: meta.page, total: meta.totalPages })}</span>
              <Button type="button" size="sm" variant="secondary" disabled={!meta.hasNextPage} onClick={() => setPage((value) => value + 1)}>
                {t("tn.agent.citizens.next")}
              </Button>
            </nav>
          ) : null}
        </>
      )}

      <Dialog open={pending !== null} onOpenChange={(value) => (value ? null : setPending(null))}>
        <DialogContent className="max-w-md">
          {pending ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {pending.kind === "suspend"
                    ? t("tn.agent.citizens.suspend_title", { name: pending.user.name })
                    : pending.kind === "reinstate"
                      ? t("tn.agent.citizens.reinstate_title", { name: pending.user.name })
                      : t("tn.agent.citizens.sign_out_title", { name: pending.user.name })}
                </DialogTitle>
                <DialogDescription>
                  {pending.kind === "suspend"
                    ? t("tn.agent.citizens.suspend_body")
                    : pending.kind === "reinstate"
                      ? t("tn.agent.citizens.reinstate_body")
                      : t("tn.agent.citizens.sign_out_body")}
                </DialogDescription>
              </DialogHeader>
              {pending.kind === "suspend" ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="suspend-reason" className="text-sm font-medium">{t("tn.agent.citizens.reason")}</label>
                    <Textarea id="suspend-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("tn.agent.citizens.reason_placeholder")} rows={3} maxLength={300} />
                  </div>
                  <fieldset className="flex flex-col gap-1.5">
                    <legend className="mb-1.5 text-sm font-medium">{t("tn.agent.citizens.duration")}</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(DURATIONS) as Duration[]).map((value) => (
                        <label
                          key={value}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                            duration === value ? "border-primary bg-accent" : "border-input hover:bg-surface-muted",
                          )}
                        >
                          <input type="radio" name="suspend-duration" value={value} checked={duration === value} onChange={() => setDuration(value)} className="accent-[var(--primary)]" />
                          {t(`tn.agent.citizens.duration.${value}` as MessageKey)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setPending(null)} disabled={busy}>
                  {t("common.cancel")}
                </Button>
                <Button type="button" variant={pending.kind === "suspend" ? "destructive" : "primary"} disabled={busy} onClick={() => void run()}>
                  {pending.kind === "reinstate" ? <ShieldCheck aria-hidden /> : null}
                  {pending.kind === "suspend"
                    ? t("tn.agent.citizens.suspend")
                    : pending.kind === "reinstate"
                      ? t("tn.agent.citizens.reinstate")
                      : t("tn.agent.citizens.sign_out")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

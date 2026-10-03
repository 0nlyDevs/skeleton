"use client";

import { Ban, MoreHorizontal, Search, ShieldCheck, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { EmptyState } from "@/components/feedback/empty-state";
import { TableSkeleton } from "@/components/feedback/loading-skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, ApiRequestError, toQueryString } from "@/lib/api/client";
import { ROLES, type ListMeta, type Role } from "@/types";
import type { AdminUserDto } from "@/modules/users/users.dto";
import { initials } from "@/lib/utils";

const PAGE_SIZE = 15;

/**
 * Admin user management.
 *
 * Two destructive-ish actions live behind a per-row menu, and both confirm intent:
 * a role change applies instantly but is logged and reversible; a ban asks for a
 * reason first (the API refuses to store one without it, and the audit entry
 * carries it).
 *
 * The current admin's own row disables both actions — the server refuses
 * self-demotion and self-ban anyway, but a control that visibly cannot apply to
 * you is better than one that errors when clicked.
 */
export function UsersTable({ currentUserId }: { readonly currentUserId: string }) {
  const t = useTranslation();
  const fmt = useFormatters();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AdminUserDto[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const [banTarget, setBanTarget] = useState<AdminUserDto | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banBusy, setBanBusy] = useState(false);
  const [unbanTarget, setUnbanTarget] = useState<AdminUserDto | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, roleFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ data: AdminUserDto[]; meta: ListMeta }>(
        `/api/users${toQueryString({
          page,
          limit: PAGE_SIZE,
          ...(debounced ? { q: debounced } : {}),
          ...(roleFilter !== "all" ? { role: roleFilter } : {}),
        })}`,
      );
      setRows(response.data);
      setMeta(response.meta);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.isForbidden) {
        toast.error(t("error.FORBIDDEN"));
      }
    } finally {
      setLoading(false);
    }
  }, [page, debounced, roleFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeRole = async (user: AdminUserDto, role: Role) => {
    if (role === user.role) return;

    const previous = rows;
    // Optimistic: the menu closes immediately and the table reflects the change.
    setRows((current) =>
      current.map((row) => (row.id === user.id ? { ...row, role } : row)),
    );

    try {
      await apiFetch(`/api/users/${user.id}/role`, { method: "PATCH", body: { role } });
      toast.success(t("admin.users.role_changed"));
    } catch (caught) {
      setRows(previous);
      toast.error(
        caught instanceof ApiRequestError ? t(`error.${caught.code}` as never) : t("feedback.error.body"),
      );
    }
  };

  const confirmBan = async () => {
    if (!banTarget || banBusy) return;
    setBanBusy(true);

    try {
      await apiFetch(`/api/users/${banTarget.id}/ban`, {
        method: "PATCH",
        body: { banned: true, reason: banReason.trim() },
      });
      setRows((current) =>
        current.map((row) =>
          row.id === banTarget.id
            ? { ...row, banned: true, banReason: banReason.trim(), banExpires: null }
            : row,
        ),
      );
      toast.success(t("admin.users.banned"));
      setBanTarget(null);
      setBanReason("");
    } catch (caught) {
      toast.error(
        caught instanceof ApiRequestError ? t(`error.${caught.code}` as never) : t("feedback.error.body"),
      );
    } finally {
      setBanBusy(false);
    }
  };

  const confirmUnban = async () => {
    if (!unbanTarget) return;

    try {
      await apiFetch(`/api/users/${unbanTarget.id}/ban`, { method: "PATCH", body: { banned: false } });
      setRows((current) =>
        current.map((row) =>
          row.id === unbanTarget.id
            ? { ...row, banned: false, banReason: null, banExpires: null }
            : row,
        ),
      );
      toast.success(t("admin.users.unbanned"));
      setUnbanTarget(null);
    } catch (caught) {
      toast.error(
        caught instanceof ApiRequestError ? t(`error.${caught.code}` as never) : t("feedback.error.body"),
      );
    }
  };

  const totalPages = meta?.totalPages ?? 1;
  const isSelf = (user: AdminUserDto) => user.id === currentUserId;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.015em]">{t("admin.users.title")}</h1>
      </header>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("admin.users.search_placeholder")}
            className="pl-9"
            aria-label={t("common.search")}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-40" aria-label={t("admin.users.role")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">—</SelectItem>
            {ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={t("admin.users.empty.title")}
            description={t("admin.users.empty.body")}
            className="m-4 border-0 bg-transparent"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-[0.8438rem]">
              <thead>
                <tr className="border-b border-border/70 text-[0.75rem] uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">{t("admin.users.user")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("admin.users.role")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("admin.users.status")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("admin.users.posts")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("admin.users.created")}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t("admin.users.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-surface-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                          <AvatarFallback className="text-[0.6875rem]">{initials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-1.5 truncate font-medium">
                            {user.name}
                            {isSelf(user) ? (
                              <span className="text-[0.6875rem] font-normal text-muted-foreground">
                                ({t("admin.users.self")})
                              </span>
                            ) : null}
                          </span>
                          <span className="truncate text-[0.75rem] text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.role === "ADMIN" ? "primary" : user.role === "MODERATOR" ? "warning" : "neutral"}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {user.banned ? (
                        <Badge variant="error">{t("admin.users.status.banned")}</Badge>
                      ) : (
                        <Badge variant="success">{t("admin.users.status.active")}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{user.postCount}</td>
                    <td className="px-4 py-3 text-[0.7812rem] text-muted-foreground">
                      {fmt.date(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          disabled={isSelf(user)}
                        >
                          <Button variant="ghost" size="icon" disabled={isSelf(user)} aria-label={t("admin.users.actions")}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{t("admin.users.change_role")}</DropdownMenuLabel>
                          {ROLES.filter((role) => role !== user.role).map((role) => (
                            <DropdownMenuItem key={role} onSelect={() => void changeRole(user, role)}>
                              <ShieldCheck />
                              {role}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          {user.banned ? (
                            <DropdownMenuItem onSelect={() => setUnbanTarget(user)}>
                              <Undo2 />
                              {t("admin.users.unban")}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem variant="destructive" onSelect={() => setBanTarget(user)}>
                              <Ban />
                              {t("admin.users.ban")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t("common.previous")}
          </Button>
          <span className="text-[0.8125rem] tabular-nums text-muted-foreground">
            {t("common.page")} {page} {t("common.of")} {totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t("common.next")}
          </Button>
        </nav>
      ) : null}

      {/* Ban dialog */}
      <Dialog open={banTarget !== null} onOpenChange={(open) => !open && setBanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.ban_title")}</DialogTitle>
            <DialogDescription>
              {banTarget?.email} — {t("settings.security.sessions_hint")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ban-reason">{t("admin.users.ban_reason")}</Label>
            <Input
              id="ban-reason"
              value={banReason}
              onChange={(event) => setBanReason(event.target.value)}
              maxLength={300}
              required
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBanTarget(null)} disabled={banBusy}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void confirmBan()} disabled={banBusy || banReason.trim().length < 3}>
              {t("admin.users.ban_submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unban confirm */}
      <Dialog open={unbanTarget !== null} onOpenChange={(open) => !open && setUnbanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.unban")}</DialogTitle>
            <DialogDescription>{unbanTarget?.email}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUnbanTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void confirmUnban()}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

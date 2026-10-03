"use client";

import { Loader2, Printer, UserPlus } from "lucide-react";
import QRCode from "qrcode";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import type { AssistedAccountDto } from "@/modules/assisted-accounts/assisted-accounts.service";

/**
 * The access sheet is printed in the resident's language, which is not
 * necessarily the agent's: its few lines live here for every locale rather
 * than in the agent's dictionary.
 */
const SHEET: Record<Locale, { title: string; intro: string; user: string; code: string; steps: string[]; start: string }> = {
  fr: {
    title: "Votre accès à Terra Nova",
    intro: "Bienvenue ! Ce compte a été créé pour vous par un agent de la ville. Vous n'avez pas besoin d'adresse e-mail.",
    user: "Nom d'utilisateur",
    code: "Code d'accès (une seule fois)",
    steps: [
      "Ouvrez la page de connexion (scannez le QR code).",
      "Saisissez votre nom d'utilisateur et le code d'accès.",
      "Choisissez votre propre mot de passe, ou connectez-vous avec le visage ou l'empreinte de votre téléphone.",
    ],
    start: "Ensuite, la page « Par où commencer ? » vous indique les services utiles pour vous.",
  },
  en: {
    title: "Your access to Terra Nova",
    intro: "Welcome! A city agent created this account for you. You do not need an email address.",
    user: "Username",
    code: "Access code (one time only)",
    steps: [
      "Open the sign-in page (scan the QR code).",
      "Enter your username and the access code.",
      "Choose your own password, or sign in with your phone's face or fingerprint.",
    ],
    start: "Then the “Where do I start?” page shows the services that are useful to you.",
  },
};

interface Sheet extends AssistedAccountDto {
  readonly qr: string;
}

/** "Amina Rahal" or "Amina, Rahal" per line → first and last name. */
function parseNames(text: string): { firstName: string; lastName: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.includes(",") ? line.split(",").map((part) => part.trim()) : line.split(/\s+/);
      const [firstName = "", ...rest] = parts;
      return { firstName, lastName: rest.join(" ") };
    });
}

/**
 * F71 — an agent creates accounts for newcomers without an email address,
 * one or many at a time, then prints an access sheet per resident: username,
 * one-time access code and a QR code to the sign-in page, in their language.
 */
export function AssistedAccountsDialog({ onCreated }: { readonly onCreated: () => void }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState("");
  const [locale, setLocale] = useState<Locale>("fr");
  const [busy, setBusy] = useState(false);
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const residents = parseNames(names);
  const incomplete = residents.some((resident) => !resident.firstName || !resident.lastName);

  const create = async () => {
    setBusy(true);
    try {
      const { data } = await apiFetch<{ data: AssistedAccountDto[] }>("/api/agent/citizens/assisted", {
        method: "POST",
        body: { residents, locale },
      });
      const loginUrl = `${window.location.origin}/login`;
      const qr = await QRCode.toDataURL(loginUrl, { margin: 1, width: 180 });
      setSheets(data.map((account) => ({ ...account, qr })));
      toast.success(t("tn.assisted.created", { count: data.length }));
      onCreated();
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  const close = (value: boolean) => {
    setOpen(value);
    if (!value) {
      // The codes are shown once: closing the dialog forgets them.
      setSheets(null);
      setNames("");
    }
  };

  const text = SHEET[locale];

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <UserPlus aria-hidden />
        {t("tn.assisted.open")}
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-2xl">
          {sheets ? (
            <>
              <DialogHeader className="print:hidden">
                <DialogTitle>{t("tn.assisted.sheets_title", { count: sheets.length })}</DialogTitle>
                <DialogDescription>{t("tn.assisted.sheets_body")}</DialogDescription>
              </DialogHeader>
              <div className="assisted-sheets flex max-h-[60vh] flex-col gap-4 overflow-y-auto print:max-h-none print:overflow-visible" lang={locale}>
                {sheets.map((sheet) => (
                  <article key={sheet.id} className="assisted-sheet flex flex-col gap-3 rounded-xl border border-border p-5 text-sm print:break-after-page print:border-black">
                    <h3 className="text-lg font-semibold">{text.title}</h3>
                    <p>{text.intro}</p>
                    <div className="flex flex-wrap items-center gap-5">
                      {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
                      <img src={sheet.qr} alt="" width={140} height={140} className="rounded-md border border-border bg-white p-1" />
                      <dl className="flex flex-col gap-2">
                        <div>
                          <dt className="text-[0.75rem] uppercase tracking-wide text-muted-foreground">{sheet.name}</dt>
                        </div>
                        <div>
                          <dt className="text-[0.75rem] uppercase tracking-wide text-muted-foreground">{text.user}</dt>
                          <dd className="font-mono text-lg font-semibold">{sheet.username}</dd>
                        </div>
                        <div>
                          <dt className="text-[0.75rem] uppercase tracking-wide text-muted-foreground">{text.code}</dt>
                          <dd className="font-mono text-lg font-semibold tracking-wider">{sheet.accessCode}</dd>
                        </div>
                      </dl>
                    </div>
                    <ol className="list-decimal pl-5">
                      {text.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <p className="text-muted-foreground">{text.start}</p>
                  </article>
                ))}
              </div>
              <DialogFooter className="print:hidden">
                <Button type="button" variant="ghost" onClick={() => close(false)}>
                  {t("common.close")}
                </Button>
                <Button type="button" onClick={() => window.print()}>
                  <Printer aria-hidden />
                  {t("tn.assisted.print")}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("tn.assisted.title")}</DialogTitle>
                <DialogDescription>{t("tn.assisted.body")}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="assisted-names" className="text-sm font-medium">
                  {t("tn.assisted.names")}
                </label>
                <Textarea
                  id="assisted-names"
                  value={names}
                  onChange={(event) => setNames(event.target.value)}
                  rows={6}
                  placeholder={"Amina Rahal\nJean Morel"}
                  aria-describedby="assisted-names-hint"
                />
                <p id="assisted-names-hint" className="text-[0.8125rem] text-muted-foreground">
                  {t("tn.assisted.names_hint", { count: residents.length })}
                </p>
                {incomplete ? (
                  <p role="alert" className="text-[0.8125rem] text-error">
                    {t("tn.assisted.names_incomplete")}
                  </p>
                ) : null}
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {t("tn.assisted.language")}
                <select
                  value={locale}
                  onChange={(event) => setLocale(event.target.value as Locale)}
                  className="h-10 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm"
                >
                  {LOCALES.map((value) => (
                    <option key={value} value={value}>
                      {LOCALE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => close(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="button" disabled={busy || residents.length === 0 || incomplete || residents.length > 50} onClick={() => void create()}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
                  {t("tn.assisted.create", { count: residents.length })}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

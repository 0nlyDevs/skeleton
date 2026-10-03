import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getLegalDocument } from "@/content/legal";

/**
 * The privacy policy makes claims about the code. This test is the join between
 * the two.
 *
 * It exists because the claim was already wrong once. The policy stated that
 * notification bodies were encrypted at rest; nothing has ever passed a
 * notification through `encryptField`, and the read path only calls
 * `decryptNullable`, which returns plaintext unchanged. A policy that
 * overstates its protections is worse than no policy — it is a false assurance,
 * and it is the kind of thing a juror in the cybersecurity category will check.
 *
 * These assertions pin the code side to what the prose claims, so fixing the
 * prose alone is not enough and neither is changing the code alone.
 */

const ROOT = path.resolve(__dirname, "..");

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

/** Every mention of encryption in either locale's privacy policy. */
function privacyProse(): string {
  const sections = getLegalDocument("privacy", "en").sections
    .flatMap((section) => [...section.paragraphs, ...(section.bullets ?? [])])
    .join("\n");
  const rows = getLegalDocument("privacy", "en")
    .sections.flatMap((section) => section.rows ?? [])
    .flat();
  return `${sections}\n${rows.join("\n")}`;
}

describe("privacy policy claims match the code", () => {
  it("encrypts message content on write, as the policy says", () => {
    const repository = read("src/modules/messages/messages.repository.ts");
    expect(repository).toMatch(/content: .*encryptField\(/);
  });

  it("encrypts dates of birth on write, as the policy says", () => {
    const users = read("src/modules/users/users.service.ts");
    expect(users).toMatch(/birthDateEncrypted\s*=\s*.*encryptField\(/);
  });

  it("does not encrypt notification bodies, and the policy no longer claims it does", () => {
    // The code side: nothing anywhere writes a notification body through
    // encryptField. If a future change starts encrypting, this fails and the
    // policy has to be revisited in the same change.
    const notifications = read("src/modules/notifications/notifications.repository.ts");
    expect(notifications).not.toContain("encryptField");

    // The prose side: no locale may claim notifications are encrypted. Checked
    // per-locale because a correction applied to only one is the failure this
    // whole file is about.
    for (const locale of ["en", "fr"] as const) {
      const prose = getLegalDocument("privacy", locale)
        .sections.flatMap((section) => [
          ...section.paragraphs,
          ...(section.bullets ?? []),
          ...(section.rows ?? []).flat(),
        ])
        .join("\n");

      const overclaims = [
        /notification[^\n]*encrypted/i,
        /notifications[^\n]*chiffr/i,
        /notifications?[^\n]*sont stockés chiffrés/i,
      ].filter((pattern) => pattern.test(prose));

      expect(overclaims, `${locale} privacy policy overclaims notification encryption`).toEqual([]);
    }
  });

  it("still states the protection that does exist", () => {
    // The counterpart to the check above: correcting an overclaim must not turn
    // into deleting the protection. Messages and birth dates stay claimed.
    expect(privacyProse()).toMatch(/messages?[^\n]*encrypted/i);
    expect(privacyProse()).toMatch(/dates of birth[^\n]*encrypted/i);
  });

  it("names Argon2id, and the code hashes with it", () => {
    expect(privacyProse()).toContain("Argon2id");

    const password = read("src/lib/auth/password.ts");
    expect(password).toMatch(/argon2/i);
  });

  it("names AES-256-GCM, and the cipher config says so", () => {
    expect(privacyProse()).toContain("AES-256-GCM");

    const crypto = read("src/lib/crypto/field-encryption.ts");
    expect(crypto).toMatch(/aes-256-gcm/i);
  });

  it("discloses every sub-processor the code actually calls, by name", () => {
    // GDPR Art. 28 asks for the processor's identity, not its job description.
    // A row reading "email provider" is useless to a data subject who wants to
    // object, and obvious to a reviewer. Each outbound host in the source must
    // therefore appear in a row term.
    const disclosed = (
      getLegalDocument("privacy", "en").sections.find((section) => section.id === "processors")
        ?.rows ?? []
    )
      .map(([term]) => term)
      .join(" | ")
      .toLowerCase();

    const sources = [
      read("src/lib/ai/provider.ts"),
      read("src/lib/ai/embeddings.ts"),
      read("src/modules/places/places.service.ts"),
      read("src/lib/mail/smtp.ts"),
      read("src/lib/auth/breached-passwords.ts"),
    ].join("\n");

    const hosts = new Set(
      [...sources.matchAll(/https:\/\/([a-z0-9.-]+)/g)].map((match) =>
        // Group by registrable domain: subdomains of one provider are one
        // processor as far as a reader of the policy is concerned.
        match[1].replace(/^www\./, "").split(".").slice(-2).join("."),
      ),
    );

    // The app's own deployment domain and local addresses are not processors.
    const external = [...hosts].filter(
      (host) => !host.endsWith("hodi.cloud") && !["localhost", "127.0.0.1"].includes(host),
    );

    // A bare domain tells us who to look for; the vendor name is often spelled
    // differently (openrouter.ai is OpenRouter, nominatim.openstreetmap.org is
    // OpenStreetMap), so each host carries the tokens that could name it.
    // Keyed by the reduced domain, since that is what `hosts` contains.
    const aliases: Record<string, readonly string[]> = {
      "openrouter.ai": ["openrouter", "poolside"],
      "pwnedpasswords.com": ["pwned", "hibp"],
      "openstreetmap.org": ["openstreetmap", "nominatim"],
      "resend.com": ["resend"],
    };

    expect(external.length).toBeGreaterThan(0);
    for (const host of external) {
      const candidates = aliases[host] ?? [host.split(".")[0]!];
      const named = candidates.some((token) => disclosed.includes(token));
      expect(
        named,
        `outbound host ${host} is called in code but no sub-processor row names it`,
      ).toBe(true);
    }
  });

  it("discloses no sub-processor the code does not call", () => {
    // The other direction, and the one that was wrong twice: the policy listed an
    // IP geolocation processor that no code has ever contacted. A phantom
    // processor costs a data subject nothing but a reviewer's confidence.
    const prose = getLegalDocument("privacy", "en")
      .sections.flatMap((section) => [
        ...section.paragraphs,
        ...(section.bullets ?? []),
        ...(section.rows ?? []).flat(),
      ])
      .join("\n");

    const phantoms = [
      /geolocation/i,
      /géolocalisation/i,
      /ipinfo/i,
      /derive[d]? (?:an )?(?:approximate )?country/i,
    ].filter((pattern) => pattern.test(prose));

    expect(
      phantoms,
      "the policy describes IP geolocation, which this application does not perform",
    ).toEqual([]);
  });
});
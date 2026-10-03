import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Connexion" };

/**
 * There is one place to sign in: the citizens' registry, on the landing.
 * `/login` stays as an address (the proxy and many links send visitors here)
 * and forwards them there, with where they were going and why they were sent
 * back.
 */
export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ registre: "connexion" });
  if (typeof params.next === "string") query.set("next", params.next);
  if (typeof params.error === "string") query.set("error", params.error);
  redirect(`/?${query.toString()}`);
}

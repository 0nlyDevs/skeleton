import { permanentRedirect } from "next/navigation";

/** Old profile URLs keep working. */
export default async function LegacyProfileRedirect({ params }: { readonly params: Promise<{ readonly username: string }> }) {
  const { username } = await params;
  permanentRedirect(`/profile/${encodeURIComponent(username)}`);
}

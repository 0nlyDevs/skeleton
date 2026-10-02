import { redirect } from "next/navigation";

/** The inbox moved to /messages; old links (and notification links) follow. */
export default async function LegacyChatRedirect({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const room = typeof params.room === "string" ? `?room=${encodeURIComponent(params.room)}` : "";
  redirect(`/messages${room}`);
}

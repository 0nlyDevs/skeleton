import { redirect } from "next/navigation";

/** Superseded by the feed. */
export default function LegacyRedirect() {
  redirect("/feed");
}

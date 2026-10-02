import { redirect } from "next/navigation";

export default async function LegacyPostRedirect({ params }: { readonly params: Promise<{ readonly id: string }> }) {
  const { id } = await params;
  redirect(`/feed/${encodeURIComponent(id)}`);
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/settings/profile-form";
import { getAuthContext } from "@/lib/auth/session";
import { getOwnProfile } from "@/modules/users/users.service";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfileSettingsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  const [profile, params] = await Promise.all([getOwnProfile({ user: context.user }), searchParams]);

  // `?welcome=1` is where a first OAuth sign-in lands: the provider gave us a
  // name and an email, so the handle and birth date still need a look.
  return <ProfileForm profile={profile} welcome={params.welcome === "1"} />;
}

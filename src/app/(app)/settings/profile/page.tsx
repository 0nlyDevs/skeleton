import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/settings/profile-form";
import { prisma } from "@/lib/db/prisma";
import { getAuthContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfileSettingsPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  // Only the two editable fields plus the avatar are selected — the query itself
  // is the whitelist.
  const user = await prisma.user.findUnique({
    where: { id: context.user.id },
    select: { name: true, bio: true, image: true, email: true },
  });

  if (!user) redirect("/login");

  return (
    <ProfileForm
      name={user.name}
      bio={user.bio}
      image={user.image}
      email={user.email}
    />
  );
}

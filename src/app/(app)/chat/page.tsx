import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChatView } from "@/components/chat/chat-view";
import { getAuthContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Messagerie" };

export default async function ChatPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  return <ChatView user={context.user} />;
}

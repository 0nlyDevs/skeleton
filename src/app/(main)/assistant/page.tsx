import type { Metadata } from "next";

import { AiAssistant } from "@/components/ai/ai-assistant";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { isAssistantAvailable } from "@/modules/ai/ai.service";

export const metadata: Metadata = { title: "Assistant IA" };

/**
 * Availability is resolved on the server from the environment, so the page never
 * renders a composer that cannot work — and the key itself stays server-side.
 */
export default async function AssistantPage() {
  await requirePageAuth("/assistant");
  return (
    <div className="mx-auto w-full max-w-[860px]">
      <AiAssistant available={isAssistantAvailable()} />
    </div>
  );
}

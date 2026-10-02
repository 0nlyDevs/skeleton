/**
 * Bounded tool-calling loop.
 *
 * The model may *ask* for a tool; the server decides whether and how to run
 * it. Guarantees:
 *   * at most `maxRounds` rounds and `maxCallsPerRound` calls per round, so a
 *     confused or manipulated model cannot loop or fan out;
 *   * arguments are parsed defensively and validated by the executor (Zod);
 *   * every tool result is labelled untrusted and size-capped before it goes
 *     back into the context;
 *   * a tool failure becomes an error object for the model, never a 500.
 */

import { logger } from "@/lib/logger";

import { complete } from "./provider";
import type { ChatMessage, ToolDefinition } from "./prompts";

export type ToolExecutor = (name: string, args: unknown) => Promise<unknown>;

const MAX_TOOL_RESULT_CHARS = 8_000;

function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}

function serialiseResult(value: unknown): string {
  const json = JSON.stringify({ untrusted_content: true, result: value });
  return json.length > MAX_TOOL_RESULT_CHARS ? `${json.slice(0, MAX_TOOL_RESULT_CHARS)}…(truncated)` : json;
}

export interface AgentResult {
  readonly text: string;
  readonly model: string;
  readonly toolsUsed: readonly string[];
}

export async function runToolAgent(input: {
  readonly messages: readonly ChatMessage[];
  readonly tools: readonly ToolDefinition[];
  readonly execute: ToolExecutor;
  readonly maxRounds?: number;
  readonly maxCallsPerRound?: number;
  readonly maxTokens?: number;
}): Promise<AgentResult> {
  const maxRounds = input.maxRounds ?? 3;
  const maxCalls = input.maxCallsPerRound ?? 4;
  const allowed = new Set(input.tools.map((tool) => tool.function.name));
  const conversation: ChatMessage[] = [...input.messages];
  const toolsUsed: string[] = [];

  for (let round = 0; round < maxRounds; round += 1) {
    const result = await complete({ messages: conversation, tools: input.tools, maxTokens: input.maxTokens ?? 700 });
    if (result.toolCalls.length === 0) {
      return { text: result.text, model: result.model, toolsUsed };
    }

    const calls = result.toolCalls.slice(0, maxCalls);
    conversation.push({ role: "assistant", content: result.text || null, tool_calls: calls });

    for (const call of calls) {
      const name = call.function.name;
      let output: unknown;
      if (!allowed.has(name)) {
        output = { error: `Unknown tool "${name}".` };
      } else {
        try {
          output = await input.execute(name, parseArguments(call.function.arguments));
          toolsUsed.push(name);
        } catch (error) {
          logger.debug("AI tool failed", { tool: name, error });
          output = { error: error instanceof Error && error.message.length < 200 ? error.message : "Tool failed." };
        }
      }
      conversation.push({ role: "tool", tool_call_id: call.id, content: serialiseResult(output) });
    }
  }

  // Out of rounds: answer from what was gathered, with no further tools.
  const final = await complete({ messages: conversation, maxTokens: input.maxTokens ?? 700 });
  return { text: final.text, model: final.model, toolsUsed };
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAIN_NAV, visibleNavItems } from "@/components/shell/nav-config";

/**
 * The AI assistant is the one navigation entry whose backing service can be
 * dead while the key is still present — a refused key is only discoverable by
 * making a request. On the shared host each attempt costs an Apache slot, so
 * the entry has to disappear instead of inviting clicks that 500.
 */
describe("navigation hides features the deployment cannot serve", () => {
  it("drops the assistant when AI is unreachable", () => {
    const hrefs = visibleNavItems(MAIN_NAV, false).map((item) => item.href);
    expect(hrefs).not.toContain("/assistant");
  });

  it("keeps the assistant when AI is reachable", () => {
    const hrefs = visibleNavItems(MAIN_NAV, true).map((item) => item.href);
    expect(hrefs).toContain("/assistant");
  });

  it("never hides anything else, whatever AI is doing", () => {
    const alwaysVisible = MAIN_NAV.filter((item) => !item.requiresAi).map((item) => item.href);
    // Hiding the assistant removes exactly one entry, and order is preserved.
    expect(visibleNavItems(MAIN_NAV, false).map((item) => item.href)).toEqual(alwaysVisible);
    expect(visibleNavItems(MAIN_NAV, true).map((item) => item.href)).toEqual(
      MAIN_NAV.map((item) => item.href),
    );
  });

  it("marks only the assistant as AI-dependent", () => {
    expect(MAIN_NAV.filter((item) => item.requiresAi).map((item) => item.href)).toEqual([
      "/assistant",
    ]);
  });
});

describe("AI circuit breaker", () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    process.env.AI_API_KEY = "test-key";
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AI_API_KEY;
  });

  async function importProvider() {
    const provider = await import("@/lib/ai/provider");
    // A fresh module per test: the breaker is module-level state on purpose.
    return provider;
  }

  function refuseKey() {
    fetchMock.mockResolvedValue(
      new Response("no", { status: 403, headers: { "content-type": "text/plain" } }),
    );
  }

  it("reports the assistant as reachable before any request is made", async () => {
    const { isAiReachable } = await importProvider();
    expect(isAiReachable()).toBe(true);
  });

  it("hides the assistant after the key is refused", async () => {
    const { complete, isAiReachable } = await importProvider();
    refuseKey();

    await expect(complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow();

    expect(isAiReachable()).toBe(false);
  });

  it("stops paying the timeout on every later click", async () => {
    const { complete } = await importProvider();
    refuseKey();

    await expect(complete({ messages: [{ role: "user", content: "one" }] })).rejects.toThrow();
    const callsAfterFirst = fetchMock.mock.calls.length;
    expect(callsAfterFirst).toBe(1);

    // Every subsequent attempt during the cooldown must not reach the provider,
    // because each one would hold an Apache slot open for seconds.
    await expect(complete({ messages: [{ role: "user", content: "two" }] })).rejects.toThrow();
    await expect(complete({ messages: [{ role: "user", content: "three" }] })).rejects.toThrow();
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("recovers on its own once the cooldown passes, so a fixed key needs no restart", async () => {
    vi.useFakeTimers();
    try {
      const { complete, isAiReachable } = await importProvider();
      refuseKey();
      await expect(complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow();
      expect(isAiReachable()).toBe(false);

      vi.advanceTimersByTime(61_000);

      expect(isAiReachable()).toBe(true);
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "hello" } }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
      await expect(complete({ messages: [{ role: "user", content: "hi" }] })).resolves.toMatchObject({
        text: "hello",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not latch when the key is fine but the model is unwell", async () => {
    const { complete, isAiReachable } = await importProvider();
    // A 500 means the credential was accepted; the assistant should stay listed.
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));

    await expect(
      complete({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow();

    expect(isAiReachable()).toBe(true);
  });

  it("reports the assistant as unreachable when no key is configured at all", async () => {
    delete process.env.AI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    vi.resetModules();
    const { isAiReachable } = await import("@/lib/ai/provider");
    expect(isAiReachable()).toBe(false);
  });
});

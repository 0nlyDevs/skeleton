/**
 * F78 — a small load test without any dependency.
 *
 *   npm run load:test -- http://localhost:3000 200 20
 *
 * Sends <total> requests, <concurrency> at a time, across the pages residents
 * need most, and prints how many answered, how fast (median, p95) and how
 * many the server chose to refuse (429 rate limit, 503 essential mode).
 */
const [base = "http://localhost:3000", totalArg = "200", concurrencyArg = "20"] = process.argv.slice(2);
const total = Number(totalArg);
const concurrency = Number(concurrencyArg);
const paths = ["/api/health", "/api/city-services", "/api/announcements", "/api/official-messages?view=current", "/api/load", "/services", "/announcements"];

const times = [];
const statuses = new Map();
let next = 0;

async function worker() {
  while (next < total) {
    const index = next++;
    const started = performance.now();
    try {
      const response = await fetch(base + paths[index % paths.length], { headers: { "x-load-test": "1" } });
      await response.arrayBuffer();
      statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
    } catch {
      statuses.set("error", (statuses.get("error") ?? 0) + 1);
    }
    times.push(performance.now() - started);
  }
}

const started = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
const seconds = (performance.now() - started) / 1000;
times.sort((a, b) => a - b);
const at = (share) => Math.round(times[Math.min(times.length - 1, Math.floor(times.length * share))]);

console.log(`${total} requests, ${concurrency} at a time, in ${seconds.toFixed(1)} s (${Math.round(total / seconds)} per second)`);
console.log(`median ${at(0.5)} ms, p95 ${at(0.95)} ms, slowest ${Math.round(times.at(-1))} ms`);
console.log("answers:", [...statuses.entries()].map(([status, count]) => `${status} × ${count}`).join(", "));

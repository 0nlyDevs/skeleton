#!/usr/bin/env node
/**
 * Environmental audit of the main public journeys (EcoIndex method).
 *
 * Loads each page in headless Chrome through the DevTools protocol, the way a
 * resident's browser would, and records what EcoIndex scores: the number of
 * DOM elements, the number of requests and the bytes transferred — including
 * everything a page fetches in the 10 s after it loads (3D models, lazy chunks,
 * background polling).
 * Each page is measured twice: as served normally, and in the light mode
 * (cookie `skeleton_eco=1`) that slow connections now get automatically. A
 * third pass under an emulated slow 3G link times how long the page takes to
 * become usable.
 *
 *   npm run eco:audit -- [baseUrl]            # default http://127.0.0.1:3000
 *   CHROME_PATH=/path/to/chrome npm run eco:audit
 *   ECO_ONLY=/services ECO_DEBUG=1 npm run eco:audit   # one page, every request listed
 *
 * Writes `src/data/eco-report.json`, which the /eco page displays.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.argv[2] ?? process.env.ECO_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH ?? "google-chrome";
const OUT = new URL("../src/data/eco-report.json", import.meta.url);

/** The journeys a resident actually takes, signed out. */
const PAGES = [
  { path: "/", label: "Accueil" },
  { path: "/login", label: "Connexion" },
  { path: "/services", label: "Services municipaux" },
  { path: "/services/sante", label: "Fiche d'un service" },
  { path: "/announcements", label: "Annonces" },
  { path: "/alerts", label: "Alertes" },
  { path: "/city-map", label: "Carte de la cité" },
  { path: "/glossary", label: "Glossaire" },
  { path: "/eco", label: "Sobriété numérique" },
];

/**
 * A fast link, emulated explicitly for the normal and light passes: left to
 * itself, Chrome's estimate drifts to "3g" after a few local loads, and the
 * site then (rightly) serves its light page to the "normal" pass.
 */
const FAST = { offline: false, latency: 5, downloadThroughput: (50 * 1024 * 1024) / 8, uploadThroughput: (20 * 1024 * 1024) / 8 };

/** Slow 3G as Chrome DevTools defines it. */
const SLOW_3G = { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 };

// --- EcoIndex (GreenIT-Analysis / ecoindex.fr reference implementation) ---
const Q_DOM = [0, 47, 75, 159, 233, 298, 358, 417, 476, 537, 603, 674, 753, 843, 949, 1076, 1237, 1459, 1801, 2479, 594601];
const Q_REQ = [0, 2, 15, 25, 34, 42, 49, 56, 63, 70, 78, 86, 95, 105, 117, 130, 147, 170, 205, 281, 3920];
const Q_SIZE = [0, 1.37, 144.7, 319.53, 479.46, 631.97, 783.38, 937.91, 1098.62, 1265.47, 1448.32, 1648.27, 1876.08, 2142.06, 2465.37, 2866.31, 3401.59, 4155.73, 5400.08, 8037.54, 223212.26];

function quantile(quantiles, value) {
  for (let i = 1; i < quantiles.length; i++) {
    if (value < quantiles[i]) return i - 1 + (value - quantiles[i - 1]) / (quantiles[i] - quantiles[i - 1]);
  }
  return quantiles.length - 1;
}

export function ecoIndex(dom, requests, sizeKb) {
  const score = 100 - (5 * (3 * quantile(Q_DOM, dom) + 2 * quantile(Q_REQ, requests) + quantile(Q_SIZE, sizeKb))) / 6;
  const grade = score > 80 ? "A" : score > 70 ? "B" : score > 55 ? "C" : score > 40 ? "D" : score > 25 ? "E" : score > 10 ? "F" : "G";
  return {
    score: Math.round(score),
    grade,
    // Per page view, as the method defines them.
    gco2e: Math.round((2 + (2 * (50 - score)) / 100) * 100) / 100,
    waterCl: Math.round((3 + (3 * (50 - score)) / 100) * 100) / 100,
  };
}

// --- A minimal DevTools protocol client ---
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchChrome(extraArgs = []) {
  const profile = mkdtempSync(join(tmpdir(), "eco-audit-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--use-angle=gl-egl", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl", "--window-size=1280,800", ...extraArgs, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buffer = "";
    chrome.stderr.on("data", (chunk) => {
      buffer += chunk;
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    chrome.on("exit", (code) => reject(new Error(`Chrome exited (${code}). Set CHROME_PATH.`)));
  });
  return { chrome, profile, wsUrl };
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else {
      for (const listener of listeners) listener(message);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  return new Promise((resolve) => socket.addEventListener("open", () => resolve({ send, listeners, close: () => socket.close() })));
}

/** Load one page in a fresh tab and measure it. */
async function measure(cdp, url, { eco, throttle }) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);

  const requests = new Map();
  const urls = new Map();
  let loaded = false;
  const onMessage = (message) => {
    if (message.sessionId !== sessionId) return;
    const { method, params } = message;
    if (method === "Network.requestWillBeSent") {
      if (!params.request.url.startsWith("data:")) {
        requests.set(params.requestId, 0);
        urls.set(params.requestId, params.request.url);
      }
    } else if (method === "Network.loadingFinished" && requests.has(params.requestId)) {
      requests.set(params.requestId, params.encodedDataLength);
    } else if (method === "Page.loadEventFired") {
      loaded = true;
    }
  };
  cdp.listeners.add(onMessage);

  await send("Network.enable");
  await send("Page.enable");
  // A first visit: no HTTP cache, and no help from the app's service worker.
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Network.setBypassServiceWorker", { bypass: true });
  await send("Network.clearBrowserCookies");
  if (eco) await send("Network.setCookie", { name: "skeleton_eco", value: "1", url: BASE });
  await send("Network.emulateNetworkConditions", throttle ? SLOW_3G : FAST);

  const started = Date.now();
  await send("Page.navigate", { url });
  while (!loaded && Date.now() - started < 120_000) await sleep(100);
  const loadMs = Date.now() - started;
  // Count what the page fetches in the 10 s after it loads (lazy chunks, 3D
  // models, background polling). A fixed window, rather than "until the
  // network is quiet", is the same for every version of the site: a page that
  // polls every second would otherwise never finish.
  await sleep(10_000);

  const { result } = await send("Runtime.evaluate", { expression: "document.getElementsByTagName('*').length", returnByValue: true });
  if (process.env.ECO_DEBUG) {
    const probe = await send("Runtime.evaluate", { expression: "[document.documentElement.hasAttribute('data-eco'), document.documentElement.hasAttribute('data-eco-auto'), navigator.connection && navigator.connection.effectiveType].join(' | ')", returnByValue: true });
    console.log(`  ${url} eco cookie=${eco}: data-eco | data-eco-auto | effectiveType = ${probe.result.value}`);
  }
  cdp.listeners.delete(onMessage);
  await cdp.send("Target.closeTarget", { targetId });

  const bytes = [...requests.values()].reduce((sum, size) => sum + size, 0);
  if (process.env.ECO_DEBUG) {
    // ECO_DEBUG=1 lists what a page loaded, heaviest first.
    for (const [id, size] of [...requests.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(Math.round(size / 1024)).padStart(5)} KB  ${urls.get(id)?.replace(BASE, "")}`);
    }
  }
  return { dom: result.value, requests: requests.size, sizeKb: Math.round(bytes / 1024), loadMs };
}

async function withChrome(extraArgs, run) {
  const { chrome, profile, wsUrl } = await launchChrome(extraArgs);
  const cdp = await connect(wsUrl);
  try {
    return await run(cdp);
  } finally {
    cdp.close();
    chrome.kill();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
  }
}

async function main() {
  // ECO_ONLY=/services measures a single page (and leaves the report alone).
  const selected = PAGES.filter((entry) => !process.env.ECO_ONLY || entry.path === process.env.ECO_ONLY);

  // Normal and light passes first. The slow-3G passes run in a fresh browser
  // afterwards: a throttled load leaves Chrome's network estimate at "3g",
  // which the site rightly answers with the light page, and that would
  // contaminate the next "normal" measurement.
  // Chrome's network-level estimate (sent as the `ECT` hint, which DevTools
  // emulation does not override) reads loopback as "3g": pin it to 4G.
  const measured = await withChrome(["--force-effective-connection-type=4G"], async (cdp) => {
    const out = [];
    for (const page of selected) {
      const url = `${BASE}${page.path}`;
      const normal = await measure(cdp, url, { eco: false, throttle: false });
      const light = await measure(cdp, url, { eco: true, throttle: false });
      out.push({ ...page, normal: { ...normal, ...ecoIndex(normal.dom, normal.requests, normal.sizeKb) }, light: { ...light, ...ecoIndex(light.dom, light.requests, light.sizeKb) } });
    }
    return out;
  });
  const slow = await withChrome(["--force-effective-connection-type=3G"], async (cdp) => {
    const out = [];
    for (const page of selected) out.push((await measure(cdp, `${BASE}${page.path}`, { eco: true, throttle: true })).loadMs);
    return out;
  });

  const pages = measured.map((entry, index) => ({ ...entry, slow3gLoadMs: slow[index] }));
  for (const entry of pages) {
    console.log(
      `${entry.path.padEnd(24)} normal ${entry.normal.grade} ${String(entry.normal.sizeKb).padStart(6)} KB ${String(entry.normal.requests).padStart(3)} req | light ${entry.light.grade} ${String(entry.light.sizeKb).padStart(6)} KB ${String(entry.light.requests).padStart(3)} req | slow 3G ${(entry.slow3gLoadMs / 1000).toFixed(1)} s`,
    );
  }

  if (process.env.ECO_ONLY) return;
  const report = { measuredAt: new Date().toISOString(), method: "EcoIndex", base: "local production build", pages };
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nWrote ${OUT.pathname}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

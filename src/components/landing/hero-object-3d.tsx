"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The landing hero object, in three.js.
 *
 * What it is: a wireframe icosahedron with an inner solid core, slowly rotating
 * and gently following the pointer. It reads as "structure" — which is what the
 * product is — rather than as decoration.
 *
 * Why it is built this way (each choice is a perf decision, not a taste one):
 *
 *  * **Dynamic import only.** three is ~150 kB gzipped; `next/dynamic` keeps it
 *    out of the landing page bundle, and this file is the sole import site.
 *  * **One 32-segment geometry, two meshes.** Low vertex count, zero post-
 *    processing, zero texture uploads. The GPU cost is roughly a rounded rect.
 *  * **DPR capped at 2** and re-capped on resize; a 3x phone would otherwise
 *    render 2.25× the pixels for no visible benefit.
 *  * **The loop stops when it should.** Not rendering when the tab is hidden,
 *    when the canvas is scrolled out of view (IntersectionObserver), or under
 *    `prefers-reduced-motion` — in the last case nothing is mounted at all.
 *  * **Everything is disposed.** Geometry, material, renderer and the RAF loop
 *    are released on unmount, so a client-side navigation cannot leak a GL
 *    context per visit.
 *  * **Pointer input is lerp-smoothed** and bounded; the object never leaves the
 *    frame no matter how violently the cursor moves.
 */

interface HeroSceneHandle {
  dispose: () => void;
}

async function createHeroScene(
  canvas: HTMLCanvasElement,
  prefersReducedMotion: boolean,
): Promise<HeroSceneHandle> {
  const THREE = await import("three");

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
  camera.position.set(0, 0, 6.2);

  // --- Geometry ---------------------------------------------------------------
  const detail = 1; // 42 vertices — smooth silhouette, trivial cost
  const outerGeometry = new THREE.IcosahedronGeometry(2.1, detail);
  const innerGeometry = new THREE.IcosahedronGeometry(1.45, detail);

  const readAccent = () => {
    // getComputedStyle resolves `--primary` to `oklch(...)`/`lab(...)` — color
    // functions THREE.Color cannot parse. Round-trip through a 2D canvas,
    // which resolves any CSS color string to `#rrggbb`.
    const raw = getComputedStyle(canvas).getPropertyValue("--primary").trim();
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#000"; // prime the parser (invalid values are ignored)
      ctx.fillStyle = raw;
      const parsed = ctx.fillStyle;
      // A failed parse leaves #000000 in place — fall back to the brand color.
      if (
        parsed !== "#000000" ||
        raw.toLowerCase() === "#000000" ||
        raw.toLowerCase() === "black"
      ) {
        return parsed;
      }
    }
    return "#4f46e5";
  };

  const outerMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(readAccent()),
    wireframe: true,
    transparent: true,
    opacity: 0.34,
  });
  const innerMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(readAccent()),
    transparent: true,
    opacity: 0.08,
  });

  const outer = new THREE.Mesh(outerGeometry, outerMaterial);
  const inner = new THREE.Mesh(innerGeometry, innerMaterial);
  scene.add(outer, inner);

  // --- State ------------------------------------------------------------------
  let disposed = false;
  let visible = !document.hidden;
  let inViewport = true;
  let width = 1;
  let height = 1;

  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    width = rect.width;
    height = rect.height;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();

  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    // Normalized to [-1, 1] around the canvas centre.
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  };

  const onVisibility = () => {
    visible = !document.hidden;
  };

  const intersection = new IntersectionObserver((entries) => {
    inViewport = entries[0]?.isIntersecting ?? true;
  });
  intersection.observe(canvas);

  // A theme change re-reads the accent so the object never clashes with the page.
  const themeObserver = new MutationObserver(() => {
    const accent = readAccent();
    outerMaterial.color.set(accent);
    innerMaterial.color.set(accent);
  });
  themeObserver.observe(document.documentElement, { attributeFilter: ["class"] });

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  // THREE.Clock is deprecated; Timer is its replacement (same second units).
  const timer = new THREE.Timer();

  const frame = () => {
    if (disposed) return;
    const raf = requestAnimationFrame(frame);
    if (!visible || !inViewport) return raf; // sleep, keep the loop registered

    timer.update();
    const elapsed = timer.getElapsed();

    // Pointer easing: the follow is floaty rather than exact, which reads as
    // "alive" rather than "tracking".
    eased.x += (pointer.x - eased.x) * 0.045;
    eased.y += (pointer.y - eased.y) * 0.045;

    outer.rotation.y = elapsed * 0.14 + eased.x * 0.35;
    outer.rotation.x = Math.sin(elapsed * 0.22) * 0.16 + eased.y * 0.22;
    inner.rotation.y = -elapsed * 0.1 + eased.x * 0.12;
    inner.rotation.x = -Math.sin(elapsed * 0.18) * 0.1 - eased.y * 0.08;

    const breathe = 1 + Math.sin(elapsed * 0.7) * 0.02;
    outer.scale.setScalar(breathe);
    inner.scale.setScalar(2 - breathe);

    renderer.render(scene, camera);
    return raf;
  };

  if (!prefersReducedMotion) frame();
  else renderer.render(scene, camera); // single still frame, no loop

  return {
    dispose() {
      disposed = true;
      intersection.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      outerGeometry.dispose();
      innerGeometry.dispose();
      outerMaterial.dispose();
      innerMaterial.dispose();
      renderer.dispose();
    },
  };
}

/**
 * Mounts the canvas and creates the scene behind a dynamic import.
 *
 * A fallback gradient renders in the same box while three loads and on any
 * failure, so the hero is never an empty rectangle — the 3D is an enhancement,
 * never a dependency.
 */
export function HeroObject3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // no canvas, no bundle request, static gradient stays
    setEnabled(true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;

    let handle: HeroSceneHandle | null = null;
    let cancelled = false;

    void createHeroScene(canvas, false)
      .then((scene) => {
        if (cancelled) scene.dispose();
        else handle = scene;
      })
      .catch(() => {
        // Network failure or unsupported WebGL: the fallback stays visible.
      });

    return () => {
      cancelled = true;
      handle?.dispose();
    };
  }, [enabled]);

  return (
    <div className="relative aspect-square w-full max-w-[520px]" aria-hidden>
      {/* Fallback: visible while three loads, or forever when 3D is unavailable. */}
      <div
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_65%)] blur-2xl"
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 size-full transition-opacity duration-700 ${enabled ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

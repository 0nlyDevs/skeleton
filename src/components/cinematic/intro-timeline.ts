import gsap from "gsap";

import type { LoaderStar } from "./loader-star";
import type { PlanetStage } from "./planet-stage";

/**
 * The opening sequence, after the planets are loaded:
 *
 *   1. the star shoots along the diagonal seam, drawing a slash of light,
 *      and the two halves of the screen part like a cut curtain;
 *   2. Earth rises, huge, behind TERRE;
 *   3. it spins up and burns into Nova; the last E becomes an A;
 *   4. NOVA joins the title, then the interface arrives.
 */
export function buildIntro(root: HTMLElement, overlay: HTMLElement, stage: PlanetStage, star: LoaderStar | null): gsap.core.Timeline {
  const q = <T extends Element = HTMLElement>(scope: Element, selector: string) => scope.querySelector<T>(selector);
  const panelA = q(overlay, '[data-intro="panel-a"]');
  const panelB = q(overlay, '[data-intro="panel-b"]');
  const starEl = q(overlay, '[data-intro="star"]');
  const label = q(overlay, '[data-intro="label"]');
  const slash = q(overlay, '[data-intro="slash"]');
  const title = q(root, '[data-hero="title"]');
  // TERR plus the E/A elevator column, which rises as one piece.
  const terreLetters = [...root.querySelectorAll('[data-hero="terre"] .tn-mask > .tn-letter'), root.querySelector('[data-hero="stack"]')];
  const letterE = q(root, '[data-hero="e"]');
  const letterA = q(root, '[data-hero="a"]');
  const stack = q(root, '[data-hero="stack"]');
  const slot = q(root, '[data-hero="slot"]');
  // Layout width, unaffected by the title's scale transform.
  const widthOf = (element: HTMLElement | null) => element?.offsetWidth ?? 0;
  const nova = q(root, '[data-hero="nova"]');
  const novaLetters = root.querySelectorAll(".tn-nova-letter");
  const ui = root.querySelectorAll("[data-hero-ui]");
  const kicker = q(root, '[data-hero="kicker"]');
  const nav = q(root, '[data-hero="nav"]');

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // TERRE first: the shared slot is as wide as the E until the elevator swaps it.
  gsap.set(slot, { width: widthOf(letterE) });
  // The seam runs from the bottom-left corner to the top-right one.
  gsap.set(slash, { width: Math.hypot(vw, vh), rotate: (-Math.atan2(vh, vw) * 180) / Math.PI, scaleX: 0, transformOrigin: "0% 50%" });
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  // 1. The slash.
  tl.to(label, { opacity: 0, y: 20, duration: 0.4, ease: "power2.in" })
    .to(star?.state ?? {}, { boost: 1, duration: 0.5, ease: "power2.in" }, "<")
    .to(starEl, { scale: 1.15, duration: 0.5, ease: "back.in(2)" }, "<")
    .addLabel("slash")
    .to(starEl, { x: vw * 1.02, y: -vh * 1.02, scale: 0.5, rotate: 220, duration: 0.95, ease: "expo.in" }, "slash")
    .to(slash, { scaleX: 1, duration: 0.95, ease: "expo.in" }, "slash")
    .set(overlay, { backgroundColor: "transparent" }, "slash+=0.7")
    .to(panelA, { xPercent: -42, yPercent: -42, duration: 1.5, ease: "power4.inOut" }, "slash+=0.72")
    .to(panelB, { xPercent: 42, yPercent: 42, duration: 1.5, ease: "power4.inOut" }, "slash+=0.72")
    .to(slash, { opacity: 0, duration: 0.6 }, "slash+=1.0")
    .set(overlay, { display: "none" }, "slash+=2.3");

  // 2. Earth, whole and turning, then it sinks into a horizon and TERRE rises
  //    from behind it (the letters sit under the planet's canvas).
  tl.addLabel("earth", "slash+=0.8")
    .set(stage.state, { orbit: 0, spin: 0.5 }, "earth")
    .to(stage.state, { rise: 1, duration: 1.4, ease: "power1.out" }, "earth")
    .to(stage.state, { sink: 1, duration: 5.2, ease: "power2.inOut" }, "earth")
    .to(stage.state, { orbit: 1, duration: 5.2, ease: "sine.inOut" }, "earth")
    .to(stage.state, { spin: 0.12, duration: 5.6, ease: "sine.out" }, "earth")
    .addLabel("sink", "earth+=2.2")
    .fromTo(terreLetters, { y: "1.05em" }, { y: 0, duration: 1.8, stagger: 0.07, ease: "power3.out" }, "sink+=1.6");

  // 3. Earth becomes Nova, briskly; the last E turns into an A.
  tl.addLabel("morph", "sink+=3.8")
    .to(stage.state, { spin: 0.4, duration: 0.8, ease: "sine.in" }, "morph")
    .to(stage.state, { morph: 1, duration: 1.5, ease: "power2.inOut" }, "morph+=0.3")
    .to(stage.state, { spin: 0.07, duration: 1.4, ease: "power2.out" }, "morph+=1.2")
    // Elevator: the E leaves through the top of its slot as the A arrives from below.
    .to(stack, { yPercent: -50, duration: 0.8, ease: "power3.inOut" }, "morph+=1.05")
    .fromTo(slot, { width: () => widthOf(letterE) }, { width: () => widthOf(letterA), duration: 0.8, ease: "power3.inOut" }, "morph+=1.05");

  // 4. NOVA joins the name, then the interface.
  tl.addLabel("nova", "morph+=1.7")
    .to(title, { scale: 0.62, transformOrigin: "50% 100%", duration: 1.2, ease: "expo.inOut" }, "nova")
    .to(nova, { width: "auto", duration: 1.2, ease: "expo.inOut" }, "nova")
    .fromTo(novaLetters, { yPercent: 105 }, { yPercent: 0, duration: 1, stagger: 0.06, ease: "power3.out" }, "nova+=0.35")
    .fromTo(kicker, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1 }, "nova+=0.9")
    .fromTo(ui, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.1 }, "nova+=1")
    .fromTo(nav, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, "nova+=1.1");

  return tl;
}

/** The end state, for reduced motion, eco mode or no WebGL. */
export function showFinalState(root: HTMLElement, stage: PlanetStage | null): void {
  gsap.set(root.querySelector('[data-hero="stack"]'), { yPercent: -50 });
  gsap.set(root.querySelector('[data-hero="nova"]'), { width: "auto" });
  gsap.set(root.querySelector('[data-hero="title"]'), { scale: 0.62, transformOrigin: "50% 100%" });
  gsap.set(root.querySelectorAll("[data-hero-ui], [data-hero='nav'], [data-hero='kicker']"), { opacity: 1, y: 0 });
  if (stage) Object.assign(stage.state, { rise: 1, sink: 1, morph: 1, spin: 0.04 });
}

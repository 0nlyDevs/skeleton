"use client";

import { BubbleMark, BubbleWordmark } from "@/components/layout/bubble-logo";
import { CITY_ZONE_IDS, cityZoneLabelKey } from "@/modules/alerts/city-zones";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import Link from "@/components/ui/link";
import { useTranslation } from "@/components/providers/i18n-provider";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { authClient, resetPassword, signIn, signUp } from "@/lib/auth/client";
import { checkPasswordRules, isPasswordAcceptable } from "@/lib/auth/password-policy";
import {
  birthDateViolation,
  composeDisplayName,
  personNameViolation,
  usernameViolation,
} from "@/lib/validation/profile";
import { loginErrorMessageKey, loginErrorText } from "../auth-errors";
import { AttemptsLeft, LoginLockout, ProtectedSignInNote, SlowDown, useLoginProtection } from "../login-protection-notice";
import type { FuturisticAuthScene, SceneState } from "./auth-scene";
import "./auth-styles.css";

export type AuthInitialView = "login" | "s1" | "forgot" | "2fa" | "reset" | "verify";

interface FuturisticAuthProps {
  readonly initialView?: AuthInitialView;
  readonly redirectTo?: string;
  readonly initialError?: string;
  readonly resetToken?: string;
  readonly verifyResult?: "waiting" | "success" | "failed";
  readonly oauth?: { google: boolean; github: boolean };
}

// Control points for the organic blob spline
const LOGIN_BLOB = [
  [1.05, 0.07],
  [0.82, 0.07],
  [0.62, 0.17],
  [0.45, 0.23],
  [0.3, 0.2],
  [0.17, 0.27],
  [0.14, 0.4],
  [0.15, 0.5],
  [0.05, 0.6],
  [0.01, 0.68],
  [0.07, 0.8],
  [0.02, 0.92],
  [0.05, 1.05],
  [1.05, 1.05],
];

const MOB_BLOB = [
  [-0.05, -0.05],
  [0.15, -0.05],
  [0.35, -0.05],
  [0.55, -0.05],
  [0.75, -0.05],
  [1.05, -0.05],
  [1.05, 0.62],
  [0.92, 0.8],
  [0.72, 0.7],
  [0.52, 0.86],
  [0.32, 0.72],
  [0.12, 0.84],
  [-0.05, 0.7],
  [-0.05, 0.3],
];

function flipBlob(points: number[][]): number[][] {
  return points.map(([x, y]) => [1 - x, y]);
}

export function FuturisticAuth({
  initialView = "login",
  redirectTo = "/space",
  initialError,
  resetToken,
  verifyResult = "waiting",
  oauth = { google: true, github: true },
}: FuturisticAuthProps) {
  const t = useTranslation();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "s1" | "s2" | "done" | "forgot" | "2fa" | "reset" | "verify">(initialView);
  const [busy, setBusy] = useState(false);

  // Form states - Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginErr, setLoginErr] = useState<string | null>(initialError ?? null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const loginProtection = useLoginProtection();

  // Form states - Sign Up Step 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cityZone, setCityZone] = useState("");
  const [step1Err, setStep1Err] = useState<Record<string, string>>({});

  // Form states - Sign Up Step 2
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPass, setSignupPass] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [showSignupPass, setShowSignupPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [step2Err, setStep2Err] = useState<Record<string, string>>({});
  const [signupSubmitting, setSignupSubmitting] = useState(false);

  // Form states - Forgot Password
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Form states - Reset Password
  const [resetPass, setResetPass] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetErr, setResetErr] = useState<string | null>(null);

  // Form states - 2FA
  const [totpCode, setTotpCode] = useState("");
  const [totpSubmitting, setTotpSubmitting] = useState(false);

  // Refs
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blobPathRef = useRef<SVGPathElement>(null);
  const glintRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const tabLoginRef = useRef<HTMLButtonElement>(null);
  const tabSignupRef = useRef<HTMLButtonElement>(null);
  const tabInkRef = useRef<HTMLSpanElement>(null);

  const sceneRef = useRef<FuturisticAuthScene | null>(null);
  const currentBlobRef = useRef<number[][]>([]);
  const isMobileRef = useRef(false);

  const isSignup = (m: string) => m === "s1" || m === "s2" || m === "done";

  // Check mobile width
  const checkMobile = () => {
    isMobileRef.current = typeof window !== "undefined" && window.innerWidth < 880;
    return isMobileRef.current;
  };

  const getTargetBlob = (signup: boolean) => {
    const b = checkMobile() ? MOB_BLOB : LOGIN_BLOB;
    return signup ? flipBlob(b) : b;
  };

  const drawBlob = (points: number[][]) => {
    if (!blobPathRef.current) return;
    const n = points.length;
    let d = "";
    const f = (v: number) => v.toFixed(4);
    d = "M" + f(points[0][0]) + " " + f(points[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n];
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      const p3 = points[(i + 2) % n];
      d +=
        "C" +
        f(p1[0] + (p2[0] - p0[0]) / 6) +
        " " +
        f(p1[1] + (p2[1] - p0[1]) / 6) +
        " " +
        f(p2[0] - (p3[0] - p1[0]) / 6) +
        " " +
        f(p2[1] - (p3[1] - p1[1]) / 6) +
        " " +
        f(p2[0]) +
        " " +
        f(p2[1]);
    }
    blobPathRef.current.setAttribute("d", d + "Z");
  };

  const morphBlob = (to: number[][], dur: number, easeName = "power3.inOut") => {
    const from = currentBlobRef.current.map((p) => [...p]);
    const n = to.length;
    const prog = { t: 0 };
    const e = gsap.parseEase(easeName);
    return gsap.to(prog, {
      t: 1,
      duration: dur,
      ease: "none",
      onUpdate: () => {
        for (let i = 0; i < n; i++) {
          const lt = Math.max(0, Math.min(1, prog.t * 1.3 - (i / n) * 0.3));
          const k = e(lt);
          currentBlobRef.current[i] = [
            from[i][0] + (to[i][0] - from[i][0]) * k,
            from[i][1] + (to[i][1] - from[i][1]) * k,
          ];
        }
        drawBlob(currentBlobRef.current);
      },
    });
  };

  const getSlots = (signup: boolean) => {
    const W = typeof window !== "undefined" ? window.innerWidth : 1200;
    return checkMobile() ? { s: 0, p: 0 } : { s: signup ? -0.46 * W : 0, p: signup ? 0.54 * W : 0 };
  };

  const inkTo = (targetSignup: boolean, animate = true) => {
    if (!tabInkRef.current) return;
    const btn = targetSignup ? tabSignupRef.current : tabLoginRef.current;
    if (!btn) return;
    gsap.to(tabInkRef.current, {
      x: btn.offsetLeft,
      width: btn.offsetWidth,
      duration: animate ? 0.5 : 0,
      ease: "power3.inOut",
    });
  };

  const showToast = (message: string) => {
    const toast = toastRef.current;
    if (!toast) return;
    toast.textContent = message;
    gsap.killTweensOf(toast);
    gsap
      .timeline()
      .fromTo(toast, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" })
      .to(toast, { opacity: 0, y: 8, duration: 0.3 }, "+=2.5");
  };

  const pingShockwave = () => {
    if (!sceneRef.current) return;
    gsap.fromTo(sceneRef.current.state, { pulse: 0 }, { pulse: 1, duration: 0.9, ease: "power2.out", overwrite: false });
  };

  // View transition logic
  const goTo = (next: "login" | "s1" | "s2" | "done" | "forgot" | "2fa" | "reset" | "verify") => {
    if (busy || next === mode) return;
    setBusy(true);

    const prev = mode;
    const crossing = isSignup(prev) !== isSignup(next);
    const toSignup = isSignup(next);
    const big = next === "done";

    setMode(next);
    inkTo(toSignup, true);

    const stage = stageRef.current;
    const panel = panelRef.current;
    const glint = glintRef.current;
    const scene = sceneRef.current;
    const S: SceneState | undefined = scene?.state;

    const outView = rootRef.current?.querySelector<HTMLElement>(`#fa-view-${prev}`);
    const inView = rootRef.current?.querySelector<HTMLElement>(`#fa-view-${next}`);

    const tl = gsap.timeline({
      onComplete: () => {
        setBusy(false);
      },
    });

    if (outView) {
      const outItems = outView.querySelectorAll(".fa-anim");
      if (outItems.length > 0) {
        tl.to(
          outItems,
          { opacity: 0, y: -14, filter: "blur(6px)", duration: 0.32, stagger: 0.035, ease: "power2.in" },
          0,
        );
      }
    }

    let swapAt = 0.38;

    if (crossing) {
      const xs = getSlots(toSignup);
      if (S) {
        tl.to(S, { warp: 1, duration: 0.55, ease: "power2.in" }, 0)
          .to(S, { rocketOut: 1, duration: 0.6, ease: "power3.in" }, 0.05)
          .set(S, { rocketSign: toSignup ? -1 : 1, rocketOut: -1 }, 0.7)
          .to(S, { rocketOut: 0, duration: 0.95, ease: "power3.out" }, 0.78)
          .to(S, { warp: 0, duration: 0.9, ease: "power2.out" }, 0.8)
          .to(S, { mirror: toSignup ? 1 : 0, duration: 1.15, ease: "power3.inOut" }, 0.15)
          .fromTo(S, { pulse: 0 }, { pulse: 1, duration: 0.9, ease: "power2.out" }, 0.75);
      }

      if (stage && panel) {
        tl.to(stage, { x: xs.s, duration: 1.15, ease: "power3.inOut" }, 0.15).to(
          panel,
          { x: xs.p, duration: 1.15, ease: "power3.inOut" },
          0.15,
        );
      }

      tl.add(morphBlob(getTargetBlob(toSignup), 1.15, "power3.inOut"), 0.15);

      if (glint) {
        tl.fromTo(glint, { xPercent: -80, opacity: 1 }, { xPercent: 80, duration: 1.1, ease: "power2.inOut" }, 0.2).to(
          glint,
          { opacity: 0, duration: 0.2 },
          1.2,
        );
      }

      swapAt = 0.75;
    } else {
      if (S) {
        tl.to(S, { warp: big ? 1 : 0.55, duration: 0.35, ease: "power2.in" }, 0)
          .to(S, { warp: 0, duration: 0.6, ease: "power2.out" }, 0.35)
          .fromTo(S, { pulse: 0 }, { pulse: 1, duration: 0.8, ease: "power2.out" }, 0.25);
        if (big) {
          tl.to(S, { rocketOut: 1, duration: 0.9, ease: "power3.in" }, 0.15);
        }
      }

      if (glint) {
        tl.fromTo(
          glint,
          { xPercent: toSignup && prev === "s2" ? 80 : -80, opacity: 0.8 },
          { xPercent: toSignup && prev === "s2" ? -80 : 80, duration: 0.8, ease: "power2.inOut" },
          0.1,
        ).to(glint, { opacity: 0, duration: 0.2 }, 0.9);
      }
      swapAt = 0.38;
    }

    tl.add(() => {
      if (inView) {
        const inItems = inView.querySelectorAll(".fa-anim");
        gsap.set(inItems, { opacity: 0, y: 26, filter: "blur(8px)" });
      }
    }, swapAt);

    if (inView) {
      const inItems = inView.querySelectorAll(".fa-anim");
      tl.to(
        inItems,
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.7,
          stagger: 0.06,
          ease: "power3.out",
          onComplete: () => {
            gsap.set(inItems, { clearProps: "filter" });
          },
        },
        swapAt + 0.05,
      );
    }
  };

  // Mount 3D Scene & Initial Animation. In light mode (slow connection or the
  // resident's choice) neither three.js nor the intro is loaded: the form is
  // there at once and the page costs a fraction of the bytes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    checkMobile();
    const light = document.documentElement.hasAttribute("data-eco");
    let scene: FuturisticAuthScene | null = null;
    let disposed = false;

    const initialSignup = isSignup(mode);
    const targetBlob = getTargetBlob(initialSignup);
    currentBlobRef.current = light
      ? targetBlob.map((p) => [...p])
      : targetBlob.map(([x, y]) => [1.1 - (1.1 - x) * 0.12, 0.5 + (y - 0.5) * 0.15]);
    drawBlob(currentBlobRef.current);

    const xs = getSlots(initialSignup);
    if (stageRef.current) gsap.set(stageRef.current, { x: xs.s });
    if (panelRef.current) gsap.set(panelRef.current, { x: xs.p });

    let introTl: gsap.core.Timeline | null = null;
    if (!light) {
      const brandEl = panelRef.current?.querySelector(".fa-brand");
      const controlsEl = panelRef.current?.querySelector(".fa-controls");
      const activeView = rootRef.current?.querySelector(`#fa-view-${mode}`);
      const animItems = activeView?.querySelectorAll(".fa-anim") ?? [];

      if (brandEl && controlsEl) gsap.set([brandEl, controlsEl], { opacity: 0, y: -12 });
      if (animItems.length > 0) gsap.set(animItems, { opacity: 0, y: 26, filter: "blur(8px)" });

      introTl = gsap.timeline();
      introTl.add(morphBlob(targetBlob, 1.4, "power3.out"), 0);
      if (brandEl && controlsEl) {
        introTl.to([brandEl, controlsEl], { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "power3.out" }, 0.2);
      }
      if (animItems.length > 0) {
        introTl.to(
          animItems,
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.8,
            stagger: 0.07,
            ease: "power3.out",
            onComplete: () => {
              gsap.set(animItems, { clearProps: "filter" });
            },
          },
          0.35,
        );
      }

      void import("./auth-scene").then(({ FuturisticAuthScene: Scene }) => {
        if (disposed) return;
        scene = new Scene(canvas, () => isMobileRef.current);
        sceneRef.current = scene;
        scene.start();
        if (scene.state) {
          scene.state.mirror = initialSignup ? 1 : 0;
          scene.state.rocketSign = initialSignup ? -1 : 1;
          scene.state.warp = 0.9;
          scene.state.rocketOut = -1;
          gsap
            .timeline()
            .to(scene.state, { warp: 0, duration: 1.4, ease: "power2.out" }, 0)
            .to(scene.state, { rocketOut: 0, duration: 1.3, ease: "power3.out" }, 0.1)
            .fromTo(scene.state, { pulse: 0 }, { pulse: 1, duration: 1, ease: "power2.out" }, 0.2);
        }
      });
    }

    inkTo(initialSignup, false);

    const handleResize = () => {
      checkMobile();
      const currentSignup = isSignup(mode);
      const newSlots = getSlots(currentSignup);
      if (stageRef.current) gsap.set(stageRef.current, { x: newSlots.s });
      if (panelRef.current) gsap.set(panelRef.current, { x: newSlots.p });
      currentBlobRef.current = getTargetBlob(currentSignup).map((p) => [...p]);
      drawBlob(currentBlobRef.current);
      inkTo(currentSignup, false);
      scene?.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", handleResize);
      scene?.dispose();
      sceneRef.current = null;
      introTl?.kill();
    };
  }, []);

  // Elastic shake helper
  const shakeFields = (fieldIds: string[]) => {
    const elements = fieldIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length > 0) {
      gsap.fromTo(
        elements,
        { x: -8 },
        { x: 0, duration: 0.55, ease: "elastic.out(1, 0.35)", clearProps: "x" },
      );
      elements[0]?.focus();
    }
  };

  // OAuth Click handler
  const handleOAuth = async (provider: "google" | "github") => {
    pingShockwave();
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: redirectTo,
        errorCallbackURL: "/login",
        newUserCallbackURL: "/settings/profile?welcome=1",
      });
      if (result.error) {
        showToast(result.error.message ?? `${provider} sign-in failed.`);
      }
    } catch {
      showToast(`${provider} sign-in encountered a problem.`);
    }
  };

  // Submit Login

  /** D02 — passwordless sign-in with a passkey saved on this device. */
  const handlePasskey = async () => {
    if (loginSubmitting) return;
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setLoginErr(t("auth.passkey.unsupported"));
      return;
    }
    setLoginErr(null);
    setLoginSubmitting(true);
    try {
      const result = await authClient.signIn.passkey();
      if (result?.error) {
        setLoginErr(t("auth.passkey.failed"));
        setLoginSubmitting(false);
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setLoginErr(t("auth.passkey.failed"));
      setLoginSubmitting(false);
    }
  };
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginSubmitting || loginProtection.paused) return;

    setLoginErr(null);
    const identifier = loginEmail.trim();

    if (!identifier) {
      setLoginErr(t("auth.login.failed"));
      shakeFields(["fa-login-email"]);
      return;
    }
    if (!loginPass) {
      setLoginErr(t("auth.login.failed"));
      shakeFields(["fa-login-pass"]);
      return;
    }

    setLoginSubmitting(true);
    pingShockwave();

    try {
      const result = identifier.includes("@")
        ? await signIn.email({ email: identifier, password: loginPass, rememberMe, callbackURL: redirectTo, fetchOptions: loginProtection.fetchOptions })
        : await signIn.username({ username: identifier, password: loginPass, rememberMe, callbackURL: redirectTo, fetchOptions: loginProtection.fetchOptions });

      if (result.error) {
        // A pause is shown by the lockout panel instead of a red line.
        const key = loginErrorMessageKey(result.error);
        setLoginErr(key === "auth.login.too_many" ? null : loginErrorText(result.error, t));
        setLoginPass("");
        setLoginSubmitting(false);
        shakeFields(["fa-login-email", "fa-login-pass"]);
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      setLoginErr(t("auth.login.network"));
      setLoginSubmitting(false);
      shakeFields(["fa-login-email", "fa-login-pass"]);
    }
  };

  // Submit Step 1 of Sign Up
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (personNameViolation(firstName)) errs.firstName = "Veuillez entrer votre prénom valide.";
    if (personNameViolation(lastName)) errs.lastName = "Veuillez entrer votre nom valide.";
    if (usernameViolation(username)) errs.username = "3 à 20 caractères : lettres, chiffres ou tirets.";
    if (birthDateViolation(birthDate)) errs.birthDate = "Date de naissance invalide (au moins 13 ans requis).";
    if (!cityZone) errs.cityZone = t("auth.register.zone_required");

    setStep1Err(errs);
    const badKeys = Object.keys(errs);
    if (badKeys.length > 0) {
      shakeFields(badKeys.map((k) => `fa-step1-${k}`));
      return;
    }

    goTo("s2");
  };

  // Submit Step 2 of Sign Up
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupSubmitting) return;

    const errs: Record<string, string> = {};
    const email = signupEmail.trim();

    if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) errs.email = "Adresse e-mail invalide.";
    if (!isPasswordAcceptable(signupPass)) errs.password = "Le mot de passe ne respecte pas les critères requis.";
    if (signupPass !== signupConfirm) errs.confirm = "Les mots de passe ne correspondent pas.";
    if (!termsAccepted) errs.terms = "Veuillez accepter les conditions pour continuer.";

    setStep2Err(errs);
    const badKeys = Object.keys(errs);
    if (badKeys.length > 0) {
      shakeFields(badKeys.map((k) => `fa-step2-${k}`));
      return;
    }

    setSignupSubmitting(true);
    pingShockwave();

    try {
      const result = await signUp.email({
        name: composeDisplayName(firstName, lastName),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        birthDate,
        cityZone,
        email,
        password: signupPass,
        callbackURL: redirectTo,
      } as Parameters<typeof signUp.email>[0]);

      if (result.error) {
        showToast(result.error.message ?? "Erreur lors de la création du compte.");
        setSignupSubmitting(false);
        return;
      }

      setSignupSubmitting(false);
      goTo("done");
    } catch {
      showToast("Serveur injoignable. Réessayez dans un instant.");
      setSignupSubmitting(false);
    }
  };

  // Submit Forgot Password
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotSubmitting) return;

    const email = forgotEmail.trim();
    if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
      shakeFields(["fa-forgot-email"]);
      return;
    }

    setForgotSubmitting(true);
    pingShockwave();

    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      setForgotSent(true);
      setForgotSubmitting(false);
    } catch {
      setForgotSent(true);
      setForgotSubmitting(false);
    }
  };

  // Submit Reset Password
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetSubmitting) return;

    if (!resetToken) {
      setResetErr("Jeton de réinitialisation manquant ou expiré.");
      return;
    }

    if (!isPasswordAcceptable(resetPass)) {
      setResetErr("Le mot de passe ne respecte pas les critères.");
      shakeFields(["fa-reset-pass"]);
      return;
    }

    if (resetPass !== resetConfirm) {
      setResetErr("Les mots de passe ne correspondent pas.");
      shakeFields(["fa-reset-confirm"]);
      return;
    }

    setResetSubmitting(true);
    pingShockwave();

    try {
      const result = await resetPassword({ newPassword: resetPass, token: resetToken });
      if (result.error) {
        setResetErr(result.error.message ?? "Erreur lors de la réinitialisation.");
        setResetSubmitting(false);
        return;
      }
      setResetDone(true);
      setResetSubmitting(false);
    } catch {
      setResetErr("Serveur injoignable.");
      setResetSubmitting(false);
    }
  };

  // Submit 2FA Code
  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpSubmitting || totpCode.length < 6) return;

    setTotpSubmitting(true);
    pingShockwave();

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: totpCode.trim(),
      });
      if (result.error) {
        showToast(result.error.message ?? "Code TOTP invalide.");
        setTotpSubmitting(false);
        shakeFields(["fa-totp-code"]);
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      showToast("Erreur de vérification. Vérifiez le code.");
      setTotpSubmitting(false);
      shakeFields(["fa-totp-code"]);
    }
  };

  const passRules = checkPasswordRules(mode === "reset" ? resetPass : signupPass);

  return (
    <div className="futuristic-auth-root" ref={rootRef}>
      {/* SVG Defs for organic blob clip */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="blobClip" clipPathUnits="objectBoundingBox">
            <path id="blobPath" ref={blobPathRef} d="M0 0H1V1H0Z" />
          </clipPath>
          <linearGradient id="moonGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2c7fb2" />
            <stop offset="1" stopColor="#22a1b6" />
          </linearGradient>
        </defs>
      </svg>

      {/* 3D Space Stage with organic blob mask */}
      <aside className="fa-stage" id="stage" ref={stageRef} aria-hidden="true">
        <div className="fa-stage-shadow" />
        <div className="fa-stage-clip">
          <canvas id="scene" ref={canvasRef} />
          <div className="fa-grain" />
        </div>
      </aside>

      {/* Main Glass Panel */}
      <main className="fa-panel" id="content" tabIndex={-1} ref={panelRef}>
        <header className="fa-bar">
          <Link href="/" className="fa-brand" aria-label="Bubble">
            <BubbleMark className="fa-brand-mark" />
            <BubbleWordmark className="fa-brand-word" />
          </Link>

          <div className="fa-controls">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </header>

        <div className="fa-views">
          {/* LOGIN VIEW */}
          <section
            className={`fa-view ${mode === "login" ? "active" : ""}`}
            id="fa-view-login"
            aria-labelledby="h-login"
          >
            <div className="fa-inner">
              <span className="fa-eyebrow fa-anim">Welcome back</span>
              <h1 className="fa-h1 fa-anim" id="h-login">
                {t("auth.login.title")}
              </h1>
              <p className="fa-sub fa-anim">{t("auth.login.subtitle")}</p>

              {loginProtection.locked ? (
                <div className="mb-2">
                  <LoginLockout secondsLeft={loginProtection.secondsLeft} />
                </div>
              ) : null}
              {loginProtection.slowDown ? (
                <div className="mb-2">
                  <SlowDown secondsLeft={loginProtection.secondsLeft} />
                </div>
              ) : null}
              {loginErr && !loginProtection.paused ? (
                <div className="p-3 mb-2 text-xs font-semibold rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 fa-anim">
                  {loginErr}
                </div>
              ) : null}
              {!loginProtection.paused && loginProtection.showAttemptsLeft ? (
                <div className="mb-2">
                  <AttemptsLeft remaining={loginProtection.attemptsLeft ?? 0} />
                </div>
              ) : null}

              <form className="fa-form" method="post" onSubmit={handleLoginSubmit} noValidate>
                <div className="fa-field fa-anim" id="fa-login-email">
                  <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <path d="m4 7 8 6 8-6" />
                  </svg>
                  <input
                    type="text"
                    id="l-email"
                    name="username"
                    placeholder="nom@exemple.fr"
                    autoComplete="username"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>

                <div className="fa-field pw fa-anim" id="fa-login-pass">
                  <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="9" rx="3" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    type={showLoginPass ? "text" : "password"}
                    id="l-pass"
                    name="password"
                    placeholder={t("auth.login.password")}
                    autoComplete="current-password"
                    required
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                  />
                  <button
                    className="fa-eye"
                    type="button"
                    onClick={() => setShowLoginPass(!showLoginPass)}
                    aria-label={showLoginPass ? "Masquer" : "Afficher"}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {showLoginPass ? (
                        <>
                          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                          <path d="m3 3 18 18" />
                        </>
                      ) : (
                        <>
                          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                          <circle cx="12" cy="12" r="2.8" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>

                <div className="fa-row fa-anim">
                  <label className="fa-check">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                    {t("auth.login.remember")}
                  </label>
                  <button type="button" className="fa-link" onClick={() => goTo("forgot")}>
                    {t("auth.login.forgot")}
                  </button>
                </div>

                <button className="fa-btn fa-anim" type="submit" disabled={loginSubmitting || loginProtection.paused}>
                  <span>{loginSubmitting ? t("common.loading") : t("auth.login.submit")}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
                <ProtectedSignInNote />
              </form>

              {/* D02 — sign in without a password: face, fingerprint or device PIN. */}
              <div className="fa-or fa-anim">{t("auth.passkey.or")}</div>
              <button className="fa-soc fa-anim" style={{ width: "100%" }} type="button" onClick={() => void handlePasskey()} disabled={loginSubmitting} title={t("auth.passkey.sign_in_hint")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4M14 13.12c0 2.38 0 6.38-1 8.88M17.29 21.02c.12-.6.43-2.3.5-3.02M2 12a10 10 0 0 1 18-6M2 16h.01M21.8 16c.2-2 .131-5.354 0-6M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2M8.65 22c.21-.66.45-1.32.57-2M9 6.8a6 6 0 0 1 9 5.2v2" />
                </svg>
                {t("auth.passkey.sign_in")}
              </button>

              {/* Social buttons */}
              {oauth.google || oauth.github ? (
                <>
                  <div className="fa-or fa-anim">{t("auth.login.or")}</div>
                  <div className="fa-social fa-anim">
                    {oauth.google ? (
                      <button className="fa-soc" type="button" onClick={() => handleOAuth("google")}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                        </svg>
                        Google
                      </button>
                    ) : null}
                    {oauth.github ? (
                      <button className="fa-soc" type="button" onClick={() => handleOAuth("github")}>
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5z" />
                        </svg>
                        GitHub
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}

              <p className="fa-foot fa-anim">
                {t("auth.login.no_account")}{" "}
                <button type="button" className="fa-link" onClick={() => goTo("s1")}>
                  {t("auth.login.create")}
                </button>
              </p>
            </div>
          </section>

          {/* SIGN UP STEP 1 VIEW */}
          <section
            className={`fa-view ${mode === "s1" ? "active" : ""}`}
            id="fa-view-s1"
            aria-labelledby="h-s1"
          >
            <div className="fa-inner">
              <div className="fa-steps fa-anim" aria-label="Étape 1 sur 2">
                <span>STEP 1 / 2</span>
                <div className="fa-segs">
                  <span className="fa-seg">
                    <i style={{ transform: "scaleX(1)" }} />
                  </span>
                  <span className="fa-seg">
                    <i style={{ transform: "scaleX(0)" }} />
                  </span>
                </div>
              </div>

              <span className="fa-eyebrow fa-anim">Create your account</span>
              <h1 className="fa-h1 fa-anim" id="h-s1">
                Let&apos;s get to know you
              </h1>
              <p className="fa-sub fa-anim">{t("auth.register.subtitle")}</p>

              <form className="fa-form" method="post" onSubmit={handleStep1Submit} noValidate>
                <div className="fa-two fa-anim">
                  <div className={`fa-field ${step1Err.firstName ? "err" : ""}`} id="fa-step1-firstName">
                    <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4.5 20c1.2-3.6 4-5 7.5-5s6.3 1.4 7.5 5" />
                    </svg>
                    <input
                      type="text"
                      placeholder={t("profile.first_name")}
                      required
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setStep1Err((prev) => ({ ...prev, firstName: "" }));
                      }}
                    />
                    <p className="fa-msg">{step1Err.firstName}</p>
                  </div>

                  <div className={`fa-field ${step1Err.lastName ? "err" : ""}`} id="fa-step1-lastName">
                    <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4.5 20c1.2-3.6 4-5 7.5-5s6.3 1.4 7.5 5" />
                    </svg>
                    <input
                      type="text"
                      placeholder={t("profile.last_name")}
                      required
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        setStep1Err((prev) => ({ ...prev, lastName: "" }));
                      }}
                    />
                    <p className="fa-msg">{step1Err.lastName}</p>
                  </div>
                </div>

                <div className={`fa-field fa-anim ${step1Err.username ? "err" : ""}`} id="fa-step1-username">
                  <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="3.5" />
                    <path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.4 6.8" />
                  </svg>
                  <input
                    type="text"
                    placeholder={t("profile.username")}
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setStep1Err((prev) => ({ ...prev, username: "" }));
                    }}
                  />
                  <p className="fa-msg">{step1Err.username}</p>
                </div>

                <div className={`fa-field fa-anim ${step1Err.birthDate ? "err" : ""}`} id="fa-step1-birthDate">
                  <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3.5" y="5" width="17" height="15" rx="3" />
                    <path d="M3.5 10h17M8 3v4M16 3v4" />
                  </svg>
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().slice(0, 10)}
                    value={birthDate}
                    onChange={(e) => {
                      setBirthDate(e.target.value);
                      setStep1Err((prev) => ({ ...prev, birthDate: "" }));
                    }}
                  />
                  <p className="fa-msg">{step1Err.birthDate}</p>
                </div>

                <div className={`fa-field fa-anim ${step1Err.cityZone ? "err" : ""}`} id="fa-step1-cityZone">
                  <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.4 12 21 12 21z" />
                    <circle cx="12" cy="10.5" r="2.3" />
                  </svg>
                  <select
                    required
                    aria-label={t("auth.register.zone")}
                    value={cityZone}
                    onChange={(e) => {
                      setCityZone(e.target.value);
                      setStep1Err((prev) => ({ ...prev, cityZone: "" }));
                    }}
                  >
                    <option value="">{t("auth.register.zone")}</option>
                    {CITY_ZONE_IDS.map((id) => (
                      <option key={id} value={id}>{t(cityZoneLabelKey(id))}</option>
                    ))}
                  </select>
                  <p className="fa-msg">{step1Err.cityZone}</p>
                </div>

                <button className="fa-btn fa-anim" type="submit">
                  <span>Continuer</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </form>

              {/* Social buttons */}
              {oauth.google || oauth.github ? (
                <>
                  <div className="fa-or fa-anim">{t("auth.login.or")}</div>
                  <div className="fa-social fa-anim">
                    {oauth.google ? (
                      <button className="fa-soc" type="button" onClick={() => handleOAuth("google")}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                        </svg>
                        Google
                      </button>
                    ) : null}
                    {oauth.github ? (
                      <button className="fa-soc" type="button" onClick={() => handleOAuth("github")}>
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5z" />
                        </svg>
                        GitHub
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}

              <p className="fa-foot fa-anim">
                {t("auth.register.have_account")}{" "}
                <button type="button" className="fa-link" onClick={() => goTo("login")}>
                  {t("auth.register.sign_in")}
                </button>
              </p>
            </div>
          </section>

          {/* SIGN UP STEP 2 VIEW */}
          <section
            className={`fa-view ${mode === "s2" ? "active" : ""}`}
            id="fa-view-s2"
            aria-labelledby="h-s2"
          >
            <div className="fa-inner">
              <div className="fa-steps fa-anim" aria-label="Étape 2 sur 2">
                <span>STEP 2 / 2</span>
                <div className="fa-segs">
                  <span className="fa-seg">
                    <i style={{ transform: "scaleX(1)" }} />
                  </span>
                  <span className="fa-seg">
                    <i style={{ transform: "scaleX(1)" }} />
                  </span>
                </div>
              </div>

              <span className="fa-eyebrow fa-anim">Almost there</span>
              <h1 className="fa-h1 fa-anim" id="h-s2">
                Secure your account
              </h1>
              <p className="fa-sub fa-anim">Définissez vos identifiants pour rejoindre Terra Nova.</p>

              <form className="fa-form" method="post" onSubmit={handleStep2Submit} noValidate>
                <div className={`fa-field fa-anim ${step2Err.email ? "err" : ""}`} id="fa-step2-email">
                  <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <path d="m4 7 8 6 8-6" />
                  </svg>
                  <input
                    type="email"
                    placeholder={t("auth.register.email")}
                    autoComplete="email"
                    required
                    value={signupEmail}
                    onChange={(e) => {
                      setSignupEmail(e.target.value);
                      setStep2Err((prev) => ({ ...prev, email: "" }));
                    }}
                  />
                  <p className="fa-msg">{step2Err.email}</p>
                </div>

                <div className={`fa-field pw fa-anim ${step2Err.password ? "err" : ""}`} id="fa-step2-password">
                  <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="9" rx="3" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    type={showSignupPass ? "text" : "password"}
                    placeholder={t("auth.register.password")}
                    autoComplete="new-password"
                    required
                    value={signupPass}
                    onChange={(e) => {
                      setSignupPass(e.target.value);
                      setStep2Err((prev) => ({ ...prev, password: "" }));
                    }}
                  />
                  <button
                    className="fa-eye"
                    type="button"
                    onClick={() => setShowSignupPass(!showSignupPass)}
                    aria-label={showSignupPass ? "Masquer" : "Afficher"}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {showSignupPass ? (
                        <>
                          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                          <path d="m3 3 18 18" />
                        </>
                      ) : (
                        <>
                          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                          <circle cx="12" cy="12" r="2.8" />
                        </>
                      )}
                    </svg>
                  </button>
                  <p className="fa-msg">{step2Err.password}</p>
                </div>

                <div className={`fa-field pw fa-anim ${step2Err.confirm ? "err" : ""}`} id="fa-step2-confirm">
                  <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="9" rx="3" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    placeholder="Confirmer le mot de passe"
                    autoComplete="new-password"
                    required
                    value={signupConfirm}
                    onChange={(e) => {
                      setSignupConfirm(e.target.value);
                      setStep2Err((prev) => ({ ...prev, confirm: "" }));
                    }}
                  />
                  <button
                    className="fa-eye"
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    aria-label={showConfirmPass ? "Masquer" : "Afficher"}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {showConfirmPass ? (
                        <>
                          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                          <path d="m3 3 18 18" />
                        </>
                      ) : (
                        <>
                          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                          <circle cx="12" cy="12" r="2.8" />
                        </>
                      )}
                    </svg>
                  </button>
                  <p className="fa-msg">{step2Err.confirm}</p>
                </div>

                {/* Real-time Password Rules Checklist */}
                <div className="fa-rules fa-anim">
                  <p>Votre mot de passe doit contenir :</p>
                  <ul>
                    {passRules.map((rule) => {
                      const labels: Record<string, string> = {
                        length: "Au moins 10 caractères",
                        lower: "Une lettre minuscule",
                        upper: "Une lettre majuscule",
                        digit: "Un chiffre",
                        symbol: "Un symbole (! ? # - …)",
                        repeat: "Pas 4 caractères identiques consécutifs",
                        common: "Pas un mot de passe courant",
                      };
                      return (
                        <li key={rule.id} className={rule.ok ? "ok" : ""}>
                          {labels[rule.id] ?? rule.id}
                          <span className="mk">{rule.ok ? "✓" : "✗"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className={`fa-field fa-anim ${step2Err.terms ? "err" : ""}`} id="fa-step2-terms">
                  <label className="fa-check">
                    <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                    <span>
                      J&apos;accepte les{" "}
                      <Link href="/terms" className="fa-link" target="_blank">
                        Conditions d&apos;utilisation
                      </Link>{" "}
                      et la{" "}
                      <Link href="/privacy" className="fa-link" target="_blank">
                        Politique de confidentialité
                      </Link>
                    </span>
                  </label>
                  <p className="fa-msg">{step2Err.terms}</p>
                </div>

                <div className="fa-actions fa-anim">
                  <button className="fa-btn round" type="button" onClick={() => goTo("s1")} aria-label="Retour à l'étape 1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 12H5M11 6l-6 6 6 6" />
                    </svg>
                  </button>
                  <button className="fa-btn" type="submit" disabled={signupSubmitting}>
                    <span>{signupSubmitting ? t("common.loading") : t("auth.register.submit")}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* SIGN UP DONE VIEW */}
          <section
            className={`fa-view ${mode === "done" ? "active" : ""}`}
            id="fa-view-done"
            aria-labelledby="h-done"
          >
            <div className="fa-inner">
              <div className="fa-done-ic fa-anim">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              </div>
              <span className="fa-eyebrow fa-anim">{t("auth.register.success_title")}</span>
              <h1 className="fa-h1 fa-anim" id="h-done">
                {t("auth.register.success_title")}
              </h1>
              <p className="fa-sub fa-anim" style={{ display: "block" }}>
                {t("auth.register.success_body", { email: signupEmail })}
              </p>
              <button className="fa-btn fa-anim" type="button" onClick={() => router.push("/verify-email")}>
                <span>{t("auth.verify.title")}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </section>

          {/* FORGOT PASSWORD VIEW */}
          <section
            className={`fa-view ${mode === "forgot" ? "active" : ""}`}
            id="fa-view-forgot"
            aria-labelledby="h-forgot"
          >
            <div className="fa-inner">
              <span className="fa-eyebrow fa-anim">Récupération</span>
              <h1 className="fa-h1 fa-anim" id="h-forgot">
                {t("auth.forgot.title")}
              </h1>
              <p className="fa-sub fa-anim">{t("auth.forgot.subtitle")}</p>

              {forgotSent ? (
                <div className="p-4 mb-4 text-sm font-medium rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 fa-anim">
                  Si un compte correspond à cette adresse, vous recevrez un lien de réinitialisation sous peu.
                </div>
              ) : (
                <form className="fa-form" method="post" onSubmit={handleForgotSubmit} noValidate>
                  <div className="fa-field fa-anim" id="fa-forgot-email">
                    <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="3" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                    <input
                      type="email"
                      placeholder="nom@exemple.fr"
                      autoComplete="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                    />
                  </div>

                  <button className="fa-btn fa-anim" type="submit" disabled={forgotSubmitting}>
                    <span>{forgotSubmitting ? t("common.loading") : "Envoyer le lien"}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </form>
              )}

              <p className="fa-foot fa-anim">
                <button type="button" className="fa-link" onClick={() => goTo("login")}>
                  ← {t("auth.register.sign_in")}
                </button>
              </p>
            </div>
          </section>

          {/* RESET PASSWORD VIEW */}
          <section
            className={`fa-view ${mode === "reset" ? "active" : ""}`}
            id="fa-view-reset"
            aria-labelledby="h-reset"
          >
            <div className="fa-inner">
              <span className="fa-eyebrow fa-anim">Nouveau mot de passe</span>
              <h1 className="fa-h1 fa-anim" id="h-reset">
                {t("auth.reset.title")}
              </h1>
              <p className="fa-sub fa-anim">{t("auth.reset.subtitle")}</p>

              {resetErr ? (
                <div className="p-3 mb-2 text-xs font-semibold rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 fa-anim">
                  {resetErr}
                </div>
              ) : null}

              {resetDone ? (
                <div className="flex flex-col gap-4 fa-anim">
                  <div className="p-4 text-sm font-medium rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                    {t("auth.reset.success")}
                  </div>
                  <button className="fa-btn" type="button" onClick={() => goTo("login")}>
                    <span>{t("auth.login.submit")}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              ) : !resetToken ? (
                <div className="flex flex-col gap-4 fa-anim">
                  <div className="p-4 text-sm font-medium rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    {t("auth.reset.missing_token")}
                  </div>
                  <button className="fa-btn" type="button" onClick={() => goTo("forgot")}>
                    <span>{t("auth.forgot.submit")}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              ) : (
                <form className="fa-form" method="post" onSubmit={handleResetSubmit} noValidate>
                  <div className="fa-field pw fa-anim" id="fa-reset-pass">
                    <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="9" rx="3" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                    <input
                      type="password"
                      placeholder={t("auth.reset.new_password")}
                      required
                      value={resetPass}
                      onChange={(e) => setResetPass(e.target.value)}
                    />
                  </div>

                  <div className="fa-field pw fa-anim" id="fa-reset-confirm">
                    <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="9" rx="3" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                    <input
                      type="password"
                      placeholder={t("auth.reset.confirm_password")}
                      required
                      value={resetConfirm}
                      onChange={(e) => setResetConfirm(e.target.value)}
                    />
                  </div>

                  <button className="fa-btn fa-anim" type="submit" disabled={resetSubmitting}>
                    <span>{resetSubmitting ? t("common.loading") : t("auth.reset.submit")}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </form>
              )}

              <p className="fa-foot fa-anim">
                <button type="button" className="fa-link" onClick={() => goTo("login")}>
                  ← {t("auth.register.sign_in")}
                </button>
              </p>
            </div>
          </section>

          {/* TWO-FACTOR 2FA VIEW */}
          <section
            className={`fa-view ${mode === "2fa" ? "active" : ""}`}
            id="fa-view-2fa"
            aria-labelledby="h-2fa"
          >
            <div className="fa-inner">
              <span className="fa-eyebrow fa-anim">Sécurité renforcée</span>
              <h1 className="fa-h1 fa-anim" id="h-2fa">
                {t("auth.twofa.title")}
              </h1>
              <p className="fa-sub fa-anim">{t("auth.twofa.subtitle")}</p>

              <form className="fa-form" method="post" onSubmit={handleTotpSubmit} noValidate>
                <div className="fa-field fa-anim" id="fa-totp-code">
                  <svg className="fa-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="9" rx="3" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <button className="fa-btn fa-anim" type="submit" disabled={totpSubmitting || totpCode.length < 6}>
                  <span>{totpSubmitting ? t("common.loading") : "Valider"}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </form>

              <p className="fa-foot fa-anim">
                <button type="button" className="fa-link" onClick={() => goTo("login")}>
                  ← {t("auth.register.sign_in")}
                </button>
              </p>
            </div>
          </section>

          {/* VERIFY EMAIL VIEW */}
          <section
            className={`fa-view ${mode === "verify" ? "active" : ""}`}
            id="fa-view-verify"
            aria-labelledby="h-verify"
          >
            <div className="fa-inner">
              <span className="fa-eyebrow fa-anim">Vérification</span>
              <h1 className="fa-h1 fa-anim" id="h-verify">
                {t("auth.verify.title")}
              </h1>
              <p className="fa-sub fa-anim">
                {verifyResult === "success"
                  ? t("auth.verify.success")
                  : verifyResult === "failed"
                    ? t("auth.verify.failed")
                    : t("auth.verify.waiting")}
              </p>

              <button className="fa-btn fa-anim" type="button" onClick={() => goTo("login")}>
                <span>{t("auth.register.sign_in")}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>

              <p className="fa-foot fa-anim">
                <button type="button" className="fa-link" onClick={() => goTo("login")}>
                  ← {t("auth.register.sign_in")}
                </button>
              </p>
            </div>
          </section>
        </div>
      </main>

      <div className="fa-glint" id="glint" ref={glintRef} />
      <div className="fa-toast" id="toast" ref={toastRef} role="status" aria-live="polite" />
    </div>
  );
}

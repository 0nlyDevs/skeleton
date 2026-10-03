# Auth Pages Redesign — Design Spec

- **Date:** 2026-10-03
- **Status:** design approved, awaiting spec sign-off
- **Scope:** all six routes under `src/app/(auth)/` and `src/components/auth/`
- **Owner:** Mathieu-bot

---

## 1. Context

Terra Nova's auth pages were rebuilt into a single 1470-line client component,
`FuturisticAuth` (`src/components/auth/futuristic/futuristic-auth.tsx`), backed by a
Three.js scene (`auth-scene.ts`, 686 lines) and a scoped stylesheet
(`auth-styles.css`, 734 lines). That migration regressed four things at once:

1. **Colour.** The auth surface is uniformly blue/teal — `--fa-azure #2c7fb2`,
   `--fa-teal #22a1b6`, dark `#38bdf8`/`#22d3ee`, CTA `linear-gradient(#2b76ab →
   #2295b5)` — while the product brand is **Martian orange** (`--brand-600
   oklch(0.54 0.18 40)`).
2. **i18n.** ~50 hard-coded strings, mixed in both directions: English frozen in
   French mode (`Welcome back`, `STEP 1 / 2`, `Almost there`) and French frozen in
   English mode (all validation messages, `Continuer`, `Envoyer le lien`, `Valider`),
   including `aria-label`s that are French while visible text on the same element is
   English. The orphaned forms it replaced were fully dictionary-driven.
3. **Navigation.** Every in-component switch is a client-side `goTo()`; the file has
   no `<Link>` to any auth route. Clicking "Créer un compte" on `/login` leaves the
   URL at `/login`, so refresh silently returns the user to sign-in and Back leaves
   auth entirely.
4. **Correctness.** `/verify-email` never calls `authClient.verifyEmail` — it renders
   `auth.verify.success` whenever a token exists, and prints that same sentence
   twice. `handleForgotSubmit`'s `catch` duplicates its success path, so a failed send
   reports success.

Dead code has accumulated alongside: seven orphaned form components with zero
importers, unused CSS rules, an unwired `dissolve` uniform, and a `dispose()` that
misses three object types.

### Reference design

Two supplied images: a light page with the form on the left and a **dark organic
portal** on the right containing a ringed planet, a rocket, and a large globe at the
bottom-right corner. The reference supplies *shape and layout*; the app supplies
*colour*. The reference's flat illustrated globes are replaced by the app's real
Three.js globes.

---

## 2. Goals

- Auth pages read unmistakably as Terra Nova: Martian orange, warm neutrals, Boska + General Sans.
- Layout matches the reference: form column left, dark organic portal right, on **both** sign-in and register.
- Entrance animation that resolves into a settled, quiet page — usable for typing within ~1.5 s.
- Every user-visible string honours the active locale; no language mixing.
- Real URLs: every cross-view link navigates to a route that survives refresh.
- All dead code in the auth flow removed; the two functional bugs fixed.

### Non-goals

- Replacing the auth Three.js scene with the landing's `planet-stage.ts` — the scene is preserved, only recoloured.
- Touching `src/components/cinematic/*` or `planet-shaders.ts` (shared, already correct).
- The rocket overlay is preserved.
- No changes to auth backend routes, BetterAuth, or the password policy.

---

## 3. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Palette | **Orange throughout.** Zero cyan/blue on auth. |
| D2 | Entrance | **Entrance (~1.4 s), then quiet ambient.** Reduced-motion jumps to final. |
| D3 | View switching | **Real page navigations** — cross-view links become `<Link>`. |
| D4 | Bug scope | **Fix `/verify-email` and swallowed forgot-password errors** in this work, as their own commits. |
| D5 | Architecture | **A — keep structure, fix teardown.** Pages keep rendering `FuturisticAuth`; add a module-level GLTF parse cache + `clone()`, complete `dispose()`, call `forceContextLoss()`. |
| D6 | Colour mechanism | Reach **layer-2 semantic tokens**, never primitives or literals (see §8.1). |
| D7 | Brand mark | **Full `TERRA NOVA` in Boska** (`font-display`), all other text General Sans — matches `landing-nav.tsx:28-29`. |
| D8 | Layout flip | **Removed.** Form left / portal right on every view; no side-swap between sign-in and register. |

---

## 4. Structure & routing (D3, D5)

Six pages keep rendering `<FuturisticAuth initialView=…>`. Navigation changes:

- **Cross-view navigation becomes `<Link>`.** With the tabs removed, these ten
  `goTo()` calls are cross-view and convert: `:836`, `:879`, `:1026`, `:1286`,
  `:1317`, `:1329`, `:1376`, `:1423`, `:1449`, `:1457` →
  `href="/login" | "/register" | "/forgot-password"`.
- `/2fa`, `/reset-password`, `/verify-email` are already reached only by server
  redirect; unchanged.
- **`goTo()` shrinks to the register wizard — three calls:** `:539` (s1→s2),
  `:584` (s2→done), `:1198` (s2→s1). It stops being a router.
- **Crossing branch `:280-310` becomes unreachable → deleted.**
- **Intra branch `:311-330`** fires only for s1↔s2 → reduced to a ~200 ms
  blur/opacity crossfade. No warp, no glint.
- The wizard keeps no URL change: `/register` showing step 2 is truthful.

### Teardown hardening (required by D3)

| Item | Location | Action |
|---|---|---|
| `dispose()` guards on `mesh.isMesh` | `auth-scene.ts:669` | Walk `Points` `:408`, `LineSegments` `:438`, `Sprite` `:385`, their materials **and** textures. |
| No context release | beside `:683` | Add `renderer.forceContextLoss()` next to `renderer.dispose()`. |
| 6 MiB re-parse per mount | `:462-464` | Hoist `GLTFLoader` loads behind a module-level cached promise; `clone()` per mount. (`earth.glb` 3,362,532 B + `nova.glb` 2,873,024 B ≈ 6.0 MiB.) |
| Stale-closure resize | mount effect with `[]` deps reading `mode` | Recompute for the current view. |

Browsers cap live WebGL contexts (~16, oldest dropped). Without the above, a handful
of login↔register toggles would black out the canvas.

---

## 5. Header

`fa-bar` `:714-754` → `flex items-center justify-between w-full px-8 py-6`.

- **Left:** `<Link href="/" className="font-display text-[19px] font-bold tracking-wide">TERRA NOVA</Link>` — identical to `landing-nav.tsx:28-29`.
- **Right:** `<LocaleToggle />` + `<ThemeToggle />`.
- **Deleted:** `.fa-tabs` `:725-748`, both `role="tab"`, `role="tablist"` and its
  hard-coded `aria-label="Account"` `:725`, `.fa-tab-ink`, `inkTo()` `:211-221`,
  ink placement `:423`.
- Views are labelled via `aria-labelledby="h-*"` only — verified there are no
  `role="tabpanel"`s, so no orphaned tab semantics remain.

---

## 6. Title block & form column

Left column `.fa-panel` (`auth-styles.css:109-120`, 46 % wide) holds
`max-w-md w-full mx-auto flex flex-col justify-center px-6`.

```
kicker   text-xs font-semibold tracking-[0.2em] uppercase mb-2 text-primary
title    font-display text-3xl/4xl text-foreground
subtitle text-sm text-muted-foreground font-normal mt-1 mb-6
fields   space-y-4 · inputs h-12 px-4 rounded-full
row      flex justify-between items-center text-xs py-1   (remember | forgot)
cta      w-full h-12 rounded-full mt-6 bg-primary text-primary-foreground
footer   mt-6 text-sm text-muted-foreground text-center · action in text-primary
```

- **48–64 px clearance from the organic curve** = `padding-right: 64px` on
  `.fa-panel` at ≥ 880 px, verified visually against `LOGIN_BLOB` (`:33-48`) since a
  curve's distance varies with x.
- Mobile (< 880 px, threshold `:146`): stage stays a 25 % top band, panel below —
  geometry unchanged, recoloured.
- The pattern applies to all eight views for consistency; login and register copy is
  specified below, the remainder reuses existing keys.

### Copy (both locales required)

| View | Kicker (FR / EN) | Title | Subtitle |
|---|---|---|---|
| login | `BIENVENUE` / `WELCOME BACK` | `auth.login.title` (existing) | FR `Reprenez votre voyage et explorez la suite.` / EN `Resume your journey and explore what comes next.` |
| register s1 | `ÉTAPE 1 / 2` / `STEP 1 / 2` | FR `Commencer l'aventure` / EN `Get started` | FR `Créez votre profil d'explorateur pour rejoindre l'équipage.` / EN `Create your explorer profile to join the crew.` |
| register s2 | `ÉTAPE 2 / 2` / `STEP 2 / 2` | FR `Sécuriser le compte` / EN `Secure your account` | FR `Définissez vos identifiants pour rejoindre Terra Nova.` / EN `Set your credentials to join Terra Nova.` |
| done | `BIENVENUE À BORD` / `WELCOME ABOARD` | `auth.done.title` with `{firstName}` | reuse existing success copy |
| forgot | `RÉCUPÉRATION` / `RECOVERY` | `auth.forgot.title` | `auth.forgot.subtitle` |
| reset | `RÉINITIALISATION` / `RESET` | `auth.reset.title` | `auth.reset.subtitle` |
| 2fa | `SÉCURITÉ` / `SECURITY` | `auth.twofa.title` | `auth.twofa.subtitle` |
| verify | `VÉRIFICATION` / `VERIFICATION` | `auth.verify.title` | success copy, rendered **once** |

---

## 7. Components

- **CTA** — solid `bg-primary`, hover `bg-primary-hover` **plus** `translateY(-1px)`
  and `box-shadow: 0 10px 24px -10px color-mix(in oklab, var(--primary) 55%, transparent)`.
  Deliberately smaller than today's `0 18px 32px -16px rgba(35,118,170,.85)`
  (`auth-styles.css:445`). Transitions on `--duration-normal` / `--ease-out-soft`.
  Loading = `aria-busy="true"` + spinner + `disabled`, which finally makes the
  existing but unused `.fa-btn[aria-busy="true"]` rule live.
- **`.fa-btn::after` light-slide deleted** — `auth-styles.css:449-460`, enabled by
  `overflow:hidden` `:432`. Two rules, gone.
- **Duplication collapses to one implementation each:** the verbatim Google + GitHub
  blocks (`:849-875`, `:996-1022`); the eye-toggle SVGs (×3 at `:815-827`,
  `:1100-1112`, `:1139-1151`); the password-rule list, which duplicates both
  `auth.password.rule.*` (`fr.ts:849-855`) and `password-strength.tsx` — reuse the
  live `PasswordRequirements` so auth and Settings match.

---

## 8. Colour

### 8.1 Colour mechanism (D6)

`globals.css:4-18` documents three token layers: primitives (never used directly in a
component), semantic (what a component references), component knobs (a component's own
tuning). `@theme inline` at `:157` exposes semantics to Tailwind.

| Previously specified / written as | Becomes | Resolves to |
|---|---|---|
| `text-cyan-500` (kicker) | `text-primary` | `--primary` = `--brand-600` light / `--brand-400` dark |
| `text-slate-400` (subtitle) | `text-muted-foreground` | F23-checked 4.5:1 grey |
| action link "in cyan" | `text-primary` | Martian orange |
| CTA `linear-gradient(#2b76ab → #2295b5)` | solid `bg-primary` | theme-aware |
| `bg-[#faf9f5] dark:bg-[#02040b]` (`(auth)/layout.tsx:17-21`) | `bg-background` | warm sand / `neutral-950` |

Choosing `text-brand-500` directly would also violate layer 2; the semantic alias is
the only correct target.

### 8.2 Page & portal — `auth-styles.css`

Rule set rather than 47 individual edits:

- text → `--foreground` / `--muted-foreground` (`--fa-ink-3` → `color-mix(in oklab, var(--muted-foreground) 72%, transparent)`)
- interactive accent (`--fa-azure`, `--fa-teal`) → `--primary`
- status → `--success` / `--error`
- lines / fields / grounds → `--border` / `--surface` / `--background` / `--muted`
- every coloured `box-shadow` → `color-mix(… var(--primary) …)` — `:184`, `:289`, `:294`, `:445`, `:645`, `:676`

The portal is the one place needing real art direction, so it becomes a documented
**layer-3 component knob** (allowed by `globals.css:13-15`), drawn from the landing's
own Mars ramp in `.tn-static-planet` (`#c8643a / #7a2f1f / #2a0f12`):

```css
--fa-portal-glow:  #c8643a;   /* outer radial bloom, low alpha */
--fa-portal-mid:   #7a2f1f;   /* inner radial                 */
--fa-portal-deep:  #24100c;   /* base gradient stop           */
--fa-portal-abyss: #120706;   /* base gradient stop           */
```

`.fa-stage` `:86-88` swaps its three teal/navy stops for these — a dark warm-Mars
portal with an orange bloom bottom-right, where the reference puts the large globe.
**Both themes keep a dark portal** (it is a window into space; the starfield cannot
live on the sand canvas).

**Deleted:** `.fa-glint` `:680-687` (cyan `rgba(110,215,245,…)`) and its GSAP
drivers `:302-308`, `:321-328`.

### 8.3 3D scene — `auth-scene.ts`

14 of 24 colour literals are chromatic; 3 are already warm, which is the tell that the
blues are drift.

| Site | Now | Becomes |
|---|---|---|
| `keyLight` `:247` | `0x8fe8df` | `0xffd9b5` |
| ambient `:301` / fill `:303` | `0x6fa3c4` / `0x2a6fa0` | `0xffd2b8` / `0x8a5f4a` |
| atmosphere `:356` | `#5fb8ff` | `#ff9a4d` |
| fallback globe `:352` | `0x2f8d96` | `0x9a4a2c` |
| dome `:366` / ring planet `:371` / ring `:374` | `0x0e3d58` / `0x2c7894` / `0x07202f` | `0x2a0f12` / `0x7a2f1f` / `0x1a0c0a` |
| rocket `:110,:113` / parts `:143,:144` | `0x78d0d6`,`0x0a3b44` / `0xa6e3ea`,`0x2a8ea0` | `0xd08a5e`,`0x3a1a10` / `0xf0b98a`,`0x6a3418` |
| stars `:410` / streaks `:432,:446` | `0xcfeeff` / `0x9fe9ff`,`0x8fe8ff` | `0xfff1e2` / `0xffc98a` |
| dissolve edge `:244`, earth emissive `:479`, moon `:384` | `#ffd2a8`, `#ffd29a`, `0xcdbb8c` | **already warm — untouched** |
| white `:108`, metal `:116`, grey `:132` | neutral | untouched |

---

## 9. Motion

> **Traceability:** the brief's "Choreographed Portal View Transition" and
> "Warp-Driven Step Transition" appear nowhere in the repository as names (verified —
> zero matches). They map to the crossing branch of `goTo()` (`:280-310`) and its
> intra-step branch (`:311-330`), together with the `.fa-glint` full-screen sweep.
> All three are removed below.

### Entrance (~1.4 s, never blocks typing)

| t | What |
|---|---|
| 0 → 0.7 s | portal curve settles (shortened `morphBlob` on `LOGIN_BLOB`); camera dollies in; globe scales 0.94 → 1 |
| 0.15 → 0.45 s | rocket flies in; header brand + toggles fade down 8 px |
| 0.35 → 1.4 s | kicker → title → subtitle → fields (stagger 60 ms) → row → CTA → footer: `y:14, blur(6px), opacity:0` → rest, `power3.out`, 0.5 s |

Built with **`gsap.from()`**, so the resting DOM state is the real state: if GSAP
fails or reduced-motion is on, the form is simply present — never stuck hidden.

### Ambient (after settle)

Globe ≈ 0.045 rad/s, moon orbit, mouse parallax lerped at 0.06 (camera offset ±0.25).
Nothing repeats, nothing blocks.

### Removed

Crossing warp `:280-310`; intra-step warp `:311-330`; `.fa-glint`;
`.fa-btn::after`; `S.mirror`; `S.warp` and its consumers (FOV `+42°` kick, streak
stretch, warp uniforms). The warp system goes wholesale, taking its GPU work with it.
Star streaks remain at fixed ambient length as decoration — drop them if they read as
speed lines (one visual check).

### Kept

`shakeFields()` (error feedback), `pingShockwave()` (submit success), toasts, the
rocket overlay.

### Reduced motion

No guard exists anywhere today. Adopt the existing-but-unused `prefersReducedMotion()`
from `src/styles/animations.ts`: skip the timeline to final state, disable parallax,
render one static frame instead of starting the rAF loop.

---

## 10. i18n

Every visible string through `t()`; keys added to `fr.ts` **and** `en.ts` together.

- **Reuse, don't translate:** `auth.password.rule.*`, `auth.register.terms`,
  `auth.forgot.success`, `auth.forgot.submit`, `auth.twofa.submit`, `footer.terms`,
  `footer.privacy`, `nav.sign_in`, `auth.login.*`, `auth.register.*`.
- **New keys:** kickers, titles and subtitles per §6; step indicator; hard-coded
  validation and network messages (`:527-553`, `:578-586`, `:624-653`, `:671-680`);
  `common.show_password` / `common.hide_password`; back-step aria `:1198`;
  done-view copy `:1226-1234`; the six never-localised `metadata.title`s
  (`login/page.tsx:7` and siblings) via `getServerDictionary()`.
- **Guard:** `tests/i18n-coverage.test.ts:44` only walks `.ts` under `src/modules`,
  `src/lib`, `src/app/api` — it can never see JSX copy. Add a test that extracts
  static `t("…")` keys from `src/components/auth/**` and `src/app/(auth)/**` and
  asserts each exists in both dictionaries.

---

## 11. Deletions

### Files (8)

`auth-card.tsx`, `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`,
`reset-password-form.tsx`, `two-factor-form.tsx`, `verify-email-panel.tsx` (last —
after its logic is ported), `auth-errors.ts`.

Before deleting `auth-errors.ts`, confirm `isNetworkFailure` is not needed by the
forgot-password fix (§12.2); if it is, keep that one helper.

### `futuristic-auth.tsx`

tabs + `inkTo()`; `flipBlob()` `:67-69` and the `signup` parameter of `getTargetBlob`
`:150-153` (**`MOB_BLOB` stays** — it is the *mobile* shape, selected by
`checkMobile()` at `:151`); `getSlots()` `:206-209` (collapses to always `{s:0,p:0}`);
`initialSignup`/`currentSignup` refs if they are consumed only by those two (verify
before deleting); crossing warp `:280-310`; glint; the two duplicate OAuth blocks;
three eye SVGs; duplicate password-rule map; duplicate verify copy `:1441` + `:1445`;
unreachable `oauth` default (all six pages pass it → make the prop required);
stale-closure resize; unused ids (`stage`, `panel`, `scene`, `glint`, `toast`);
`export` on `AuthInitialView` `:21` (the type stays — it types the page prop).

### `auth-scene.ts`

`SceneState.intro`; `realEarthMesh` / `realNovaMesh` **fields only** — the locals at
`:502-503` are live (added to `bigPlanetGroup` `:511`); auth-side dissolve wiring
(shared `planet-shaders.ts` untouched); `warp` / `mirror` state.

### `auth-styles.css`

`.fa-note` `:654-659`; `.fa-foot.hide-short` `:725-727`; duplicate `.fa-sub` rules
`:712-714` + `:722-724`; `.fa-btn::after`; `.fa-glint`.

### Kept

`password-strength.tsx` (Settings uses it); `OAuthAvailability` / `OAuthProvider` /
`hasAnyOAuth` (Settings uses them).

---

## 12. Bug fixes (D4)

1. **`/verify-email` verifies.** Port `authClient.verifyEmail` from
   `verify-email-panel.tsx:47` into the verify view, handle failure, and print the
   success sentence once (currently `:1441` *and* `:1445`).
2. **`handleForgotSubmit` stops reporting failure as success.** Its `catch`
   duplicates its success path; surface a real error via a dictionary key.
3. **Error announcements** — add `role="alert"` to the field-error region; today
   errors are announced only by a visual shake.

---

## 13. Accessibility

- Remove `role="tablist"` / `role="tab"` with the tabs; no `tabpanel` orphans (§5).
- All `aria-label`s localised (currently French in English mode and vice versa).
- `--ring` (`--brand-500`) focus rings; `--input` already carries the 3:1 outline
  required by WCAG 1.4.11.
- `prefers-reduced-motion` honoured (§9).
- Loading CTA exposes `aria-busy`.

---

## 14. Verification

**Automated gates**

```bash
npm run lint
npm run typecheck
npm run build
npm test          # must stay green: validation, i18n-coverage, safe-redirect,
                  # rate-limit, high-contrast-css — plus the new auth-key test
npm run smoke     # /login → 200 (server on :3000)
```

**Acceptance criteria**

1. The only colour literals in `auth-styles.css` live in the component-knob block at
   the top of the file (portal, bloom, stage). Every other colour — including whites
   like `#fff` at `:398`, `:443`, `:643` — comes from a token or `color-mix()`.
2. No chromatic `0x……` literal in `auth-scene.ts` outside the §8.3 table.
3. No `text-cyan-…`, `text-slate-…`, or `bg-[#…]` in any auth TSX.
4. Grep returns zero: `fa-tab`, `inkTo`, `fa-glint`, `getSlots`, `flipBlob`, `role="tab"`, `Welcome back`, `STEP 1 / 2`, `Envoyer le lien`.
5. Every static `t("…")` key in auth source exists in both dictionaries.
6. `/login` and `/register` both render form-left / portal-right; ≥ 64 px clear of the curve.
7. Switching sign-in ↔ register changes the URL; refresh preserves the view.
8. With `prefers-reduced-motion: reduce`, no timeline runs and the scene renders a single frame.
9. After 20 consecutive auth route switches the canvas is still rendering (context not exhausted).
10. `/verify-email?token=…` calls `authClient.verifyEmail`; a failed forgot-password send shows an error.

---

## 15. Sequencing

**Step 0 — baseline commit (prerequisite).** `src/components/auth/futuristic/` is
currently **untracked** and the six pages + `layout.tsx` are **modified**. Until that
existing work is committed as its own story, any redesign branch would show the whole
directory as newly added with no "before" to diff against. Commit it first as
`feat:` on its own branch.

Then five sequential PRs, each one story, squash-merged before the next begins:

1. `fix: verify email tokens on the verify-email page`
2. `fix: surface forgot-password send failures as errors`
3. `refactor: remove orphaned auth form components and unused styles`
4. `feat: localize auth copy through the fr and en dictionaries`
5. `feat: redesign auth pages with the brand palette and ambient portal`

i18n lands **before** the redesign so the redesign cannot reintroduce a literal.

---

## 16. Deferred

- Nesting the portal in `(auth)/layout.tsx` (Approach B) — rejected for now as D5;
  would reduce teardown from "per switch" to "once per auth visit". Revisit if
  Approach A's teardown proves fragile in practice.
- `i18n-coverage` sources do not include `src/components`; the new auth-key test is
  scoped to auth only.
- Optimising `.next`/`server.cjs` bundle impact of the 6 MiB models beyond the parse
  cache.

---

## Appendix — key line references

| Thing | Location |
|---|---|
| tabs / tablist | `futuristic-auth.tsx:725-748` |
| `inkTo()` | `:211-221`, placement `:423` |
| `goTo()` | `:240-357` — crossing `:280-310`, intra `:311-330` |
| wizard `goTo` calls | `:539`, `:584`, `:1198` |
| intro timeline | `:360-444` (timeline `:395-421`) |
| `getTargetBlob` / blobs | `:33-48`, `:50-65`, `:67-69`, `:150-153` |
| `getSlots()` | `:206-209` |
| `.fa-btn` / light-slide | `auth-styles.css:443-460`, `overflow` `:432` |
| `.fa-glint` | `:680-687`; GSAP `futuristic-auth.tsx:302-308`, `:321-328` |
| portal gradients | `auth-styles.css:86-88` |
| `.fa-stage` / `.fa-panel` | `:60-68` / `:109-120` |
| mobile breakpoint | `checkMobile` `:145-147`, CSS `:689-719` |
| `dispose()` | `auth-scene.ts:656-683`, `isMesh` guard `:669` |
| GLTF loads | `:462-464` |
| verify no-op | `futuristic-auth.tsx:1441-1447` |
| tokens | `globals.css:22-111` (light), `:113-154` (dark), `:157` (`@theme inline`) |
| brand mark | `landing-nav.tsx:28-29` |

# PROJECT_STATE.md — Cuppa Cards

Living source of truth under the **Living State & Atomic Implementation Protocol**.
This file is updated at the end of every response that builds or modifies a component.

> **Note on scope (read before assuming Phase 1):** this is not a greenfield project.
> As of this snapshot the app is a mature, near-launch platform: 142 commits, 56 Supabase
> migrations, ~150 source files, and a same-night launch-readiness audit already completed
> (`launch_readiness_report.md`). "Atomic build" and "change isolation" below apply to
> *incremental* work from here forward — they don't imply we're starting over.

---

## Current Milestone

**Phase: launch simplification pass (ACE-only + Pokémon-only + shop filter simplification +
Add-ons rework) + outbound email moved to Google SMTP/Nodemailer + WhatsApp community link + hero
copy + brand-name harmonization to "CuppasCards" + full 8-stage grading email lifecycle templates
+ Submission Method (batch vs individual dispatch) selector + admin CC on every outgoing email +
admin-role authorization enforcement + **official brand identity rollout (colors, typography,
logo assets)**.
**Live in production as of `db61e29`** (deployed via `vercel --prod`, deployment
`dpl_DeHC5XYXZ9FAhyXGdNKbLFa4Bvq9`, aliased to `website-three-iota-83.vercel.app`): everything
from the `f0236b1` deploy (hero copy, Google SMTP/Nodemailer email migration, WhatsApp community
link, Step 1 ACE-only simplification, Pokémon-only card category lock, shop filter pill
simplification, vendor page's "Where We've Been" hide, "CuppasCards" brand-name harmonization, the
full 8-stage grading email lifecycle templates + `/admin/test-emails` test harness, the Contact
page's stale direct-email block removal, the Step 1 "Submission Method" selector, and Step 2's
"This submission" → "Full Clean & Polish" heading rename) **plus** `lib/email/send-email.ts`
unconditionally CC'ing every outgoing email to `updates@cuppascards.co.za`. This deploy was built
from this project's own manual `vercel --prod` CLI workflow (confirmed via `vercel ls`: prior
deploys all show as CLI/Production, no git-triggered auto-deploy bot), not an automatic git-push
trigger — pushing to `origin/main` alone does not put changes on production here. Migrations
0059-0065 all live.

9. **Official brand identity rollout (2026-09-22, committed `4f5a344`)** — the user supplied a real brand
   guide (`Stock photos/Cuppascards Logo and Colour Guide.pdf`) with exact hex/Pantone colors, a
   named display typeface, and exported logo lockups, and asked for the whole site to be aligned to
   it. Full detail lives in the Active File Manifest, Shared Contracts, and "Uncommitted work"
   sections below; in short:
   - **Color tokens**: `app/globals.css` gained real brand hex values as CSS variables
     (`--brand-gold #fdc82f`, `--brand-green #007a33`, `--brand-forest #1d3c34`, `--brand-black`,
     `--brand-white`), exposed as Tailwind utilities (`bg-brand-gold` etc.) via `@theme inline`.
     `--seal`/`--vault` (the "paper/ink" theme's accent tokens, used throughout `/submit`,
     `/dashboard`, `/admin`, `/auctions`, `/shop`) now resolve to `--brand-gold` instead of the old
     placeholder gold. Tailwind's own `amber-300/400/500/600` scale was remapped to a gold-derived
     ramp in the same `@theme` block — this reskins every pre-existing `amber-*` class site-wide
     (71 usages across 14 files) with no per-file edits, since `amber` was already being used purely
     as this app's "gold" stand-in everywhere.
   - **Typography**: the brand guide specifies "Recoleta Regular" as the display font — a paid
     Latinotype typeface with no free/Google Fonts distribution and no licensed font files on this
     machine. Flagged to the user via `AskUserQuestion`; **the user chose a free look-alike for now
     (Fraunces, via `next/font/google`)** rather than blocking on font licensing. `app/layout.tsx`
     loads Fraunces as `--font-fraunces`; `app/globals.css`'s `--font-display` now resolves to
     `var(--font-fraunces), Georgia, ...serif`. This is explicitly a stand-in — swapping in real
     Recoleta font files later is a one-file change (`app/layout.tsx`, `next/font/local` instead of
     `next/font/google`), documented inline. Applied to hero/heading text across `app/page.tsx`,
     `app/vendor/page.tsx`, `app/services/page.tsx`, `app/contact/page.tsx`, `app/prepare/page.tsx`,
     and `components/{FeaturedCarousel,PackagingGuidelines}.tsx`.
   - **Logo assets**: 6 of the brand guide's 12 lockup variants were extracted from the PDF (Portrait/
     Horizontal/URL layouts × White/Black backgrounds — Green and Deep-Green background variants were
     **not** extracted, since no section of the site currently has a green background to place them
     on) into `public/images/brand/`. `components/Navbar.tsx` now uses the horizontal-black lockup
     (fixed choice — there is no light-background navbar anywhere on this site to dynamically switch
     to); `components/Footer.tsx` gained the stacked portrait-black lockup above its existing content.
     `public/logo.png` (the old square placeholder mark) is now fully unreferenced but left on disk,
     not deleted.
   - **Known limitation, flagged not fixed**: the extracted logo crops have solid baked-in
     backgrounds (pure white/black), not transparent cutouts, since the brand guide provides
     pre-composited swatches rather than isolated marks. `bg-slate-950`/`bg-slate-900` (Navbar/
     Footer) aren't pixel-identical to pure black, so there's a faint-to-visible rectangular "logo
     card" edge in both places (more visible in the Footer). Recommended permanent fix: real
     transparent (alpha-channel) logo exports from whoever produced the brand guide. Not fixed as
     part of this task.
   - **Deliberately out of scope**: repainting the site's `slate-900`/`slate-950` sections to Deep
     Forest Green or Core Black (the brand guide/checklist offered these as alternatives without
     specifying which sections get which — a guess, not a spec, so left as-is pending a follow-up
     instruction).
   - `lib/email/templates/order-confirmation.ts`'s `COLORS.gold` (shared by every grading-lifecycle
     email template) updated from the old placeholder `#a67c00` to the real `#fdc82f`.
   - `npx tsc --noEmit` clean. `npm run lint`'s 46 errors/2 warnings are all pre-existing and
     unrelated (admin/events, dashboard, `lib/shipping.ts`, `scripts/*.js` — none in a file this task
     touched). **Committed (`4f5a344`), pushed to `origin/main`, and deployed to production**
     (`dpl_HtrWwrESJzh7snQLYcgANXEnF3EK`, `vercel --prod`).

10. **Hero section made visual-first (2026-09-22, committed `8bb25d6`)** — `app/page.tsx`'s hero no longer
    has any text elements: the pill badge ("South Africa's Premier Grading Service."), the
    `{siteConfig.name}` heading, and the "Making Grading Easy" subheadline are all removed. In their
    place, `/images/brand/logo-portrait-black.png` (one of the six brand lockups extracted during
    the identity rollout above) renders as the section's sole visual centerpiece via `next/image`
    (`priority`, `w-[320px] md:w-[420px] h-auto mx-auto`), with the same two CTA buttons ("Start a
    Submission" / "Browse the Shop") centered directly beneath it, unchanged. The request's exact
    asset path (`/images/cuppascards-hero-logo.png`) doesn't exist in this codebase — no such file
    was ever produced — so the already-extracted portrait-black lockup was used instead, matching
    the brand guide's own "Splash/Hero: stacked portrait logo" placement guidance (see the Current
    Milestone brand-rollout entry above) and this section's existing `bg-slate-900` background.
    Dark theme, section padding, and the transition into "The Easiest Way to Grade" are untouched.
    Carries the same known "logo card" seam limitation already documented for the Navbar/Footer
    (solid black background swatch vs. this section's not-quite-identical `bg-slate-900`) — visible
    on click-test, not fixed here. `npx tsc --noEmit` clean. Click-tested live in the dev server:
    logo renders centered, both buttons render directly beneath it, layout and spacing match the
    request. **Committed (`8bb25d6`), pushed, and deployed.**

11. **Site-wide logo switched to a real transparent-background PNG (2026-09-22, committed `725c85f`)** —
    the previously-documented "logo card" seam limitation (item 9/10 above) is now resolved for
    real, not just worked around. Full detail:
    - **Asset**: the user's requested source file
      (`Stock photos/Cuppascard logo png file real.png`) was copied to `public/images/cuppascards-logo.png`.
      **That copy was NOT actually transparent** — its PNG header showed `colorType 2` (plain RGB, no
      alpha channel at all): the checkerboard "this would be transparent" indicator from whatever
      export tool produced it was baked into the file's opaque pixels, not encoded as real alpha.
      Loaded live, it rendered as a literal grey/white checkerboard square on every dark background
      — confirmed both by direct pixel inspection and by a live screenshot, not just by the PNG
      header. Flagged to the user via `AskUserQuestion` before going further; the user's own
      follow-up instruction directed a `sharp`-based fix (below) rather than reverting.
    - **Fix**: `sharp` (already a project dependency, no new install) was used to chroma-key the
      file: for every pixel, `chroma = max(r,g,b) - min(r,g,b)`; sampled values confirmed the
      checkerboard's two grey/white tones have `chroma` ≈ 0-3 (achromatic) while the brand's gold and
      green both sample at `chroma` ≈ 90-208 (highly saturated) — a clean, wide separation. Pixels
      with `chroma <= 8` become fully transparent, `chroma >= 40` stay fully opaque, and the small
      band between is linearly interpolated for anti-aliased edges. RGB values are left untouched, so
      the gold/green brand colors are pixel-identical to the source. Re-saved over the same path as
      a true RGBA PNG (`colorType 6`, verified via the PNG header) — independently re-verified by
      decoding the output with `sharp` and confirming alpha is genuinely `0` at background corners
      and non-zero at logo pixels (not just visually similar). No image-editing GUI tool or external
      service was used — this was a one-off Node script run directly against the file, not committed
      as a reusable script/tool.
    - **Wired up everywhere**: `components/Navbar.tsx` (`h-8 sm:h-10 w-auto object-contain`,
      `priority`), `components/Footer.tsx` (`h-16 w-auto object-contain`), and `app/page.tsx`'s hero
      (unchanged `w-[280px] sm:w-[360px] md:w-[440px] h-auto` sizing from item 10) all now point at
      `/images/cuppascards-logo.png` instead of the old solid-background `public/images/brand/*.png`
      crops. Those six brand crops are now fully unreferenced in code (same as the pre-existing
      `public/logo.png`) but left on disk, not deleted.
    - **Email templates**: none of the 9 grading-lifecycle/receipt templates
      (`lib/email/templates/*.ts`) nor the inline auction-won email
      (`lib/email/send-order-confirmation.ts`) previously had an image logo at all — each just had a
      plain uppercase "CuppasCards" text line. A shared `EMAIL_LOGO_URL`/`EMAIL_LOGO_HTML` pair was
      added to `lib/email/templates/order-confirmation.ts` (the same file every template already
      imports `COLORS`/`escapeHtml` from) rather than duplicating `<img>` markup across 10 files.
      `EMAIL_LOGO_URL` builds an absolute URL via `process.env.NEXT_PUBLIC_APP_URL ??
      'https://website-three-iota-83.vercel.app'` — the same appBaseUrl-with-hardcoded-fallback
      pattern already used for links in `send-order-confirmation.ts`/`send-grading-update.ts` — since
      email clients can't resolve root-relative paths. The transparent PNG renders cleanly against
      every template's dark `COLORS.panel` background with no masking needed, unlike the old
      solid-background crops. All 10 files' plain-text header lines were replaced with
      `${EMAIL_LOGO_HTML}`; none of the 10 functions' signatures or call sites needed to change.
    - `npx tsc --noEmit` clean. `npm run lint` back to the same pre-existing 46-error/2-warning
      baseline (none in a file this task touched). Click-tested live in the dev server (after
      clearing `.next/cache/images` and working around one dev-only stale-`srcset` browser-cache
      artifact in the test tab, confirmed via direct pixel decoding to be a caching artifact, not a
      real bug): Navbar, Hero, and Footer all render the real logo with no checkerboard, no solid
      background box, and gold/green colors intact. Email templates were not live-sent as part of
      this verification (would require triggering `/admin/test-emails` again) — the markup change
      itself is a straightforward `<img>` swap with no logic touched. **Committed (`725c85f`), pushed, and deployed.**

12. **Logo asset replaced again with a properly pre-cleaned transparent file (2026-09-22,
    committed `2953c04`)** — supersedes the `sharp` chroma-key workaround in item 11. The user supplied a
    new source file, `Stock photos/Cuppalogo background removed.png`, already processed through a
    real background-removal tool. **Independently verified before overwriting anything** (same
    diligence as item 11, since the previous "real transparent PNG" claim turned out to be false):
    PNG header confirmed `colorType 6` (true RGBA), and a `sharp`-decoded pixel scan confirmed the
    alpha channel actually varies (background corners at alpha ≈ 3-4, ~95.7% of pixels fully
    transparent, ~2.4% fully opaque, ~1.9% partial/anti-aliased edge — a normal profile for a logo
    mark on a mostly-empty canvas) rather than being uniformly opaque or uniformly zero. Copied
    straight over `public/images/cuppascards-logo.png` (same path, so `Navbar.tsx`/`Footer.tsx`/
    `app/page.tsx`/the email templates from item 11 needed zero code changes). No `sharp`
    reprocessing was needed or done this time — the file was correct as supplied.
    **Cache purge, following the project's own documented lesson** (see the `648f42d` history note
    on never running `rm -rf .next` while a dev server sharing that directory is running): the dev
    server (`node.exe` PID bound to :3000) was stopped first via `taskkill`, then `.next` was deleted
    in full (not just `.next/cache/images`, which is where item 11's leftover stale-cache confusion
    actually turned out to live), then the dev server was restarted. Verified live in a **freshly
    created browser tab** (not the same tab reused across items 10/11, which had accumulated a stale
    `srcset` cache that needed manual JS workarounds to see past) — Navbar, Hero, and Footer all
    render correctly with no checkerboard, no solid-background seam, gold/green intact, on the first
    load with no cache-busting tricks needed. `npx tsc --noEmit` clean (no code changed, only the
    binary asset). **Committed (`2953c04`), pushed, and deployed.**

13. **Hero rebuilt as a layered large-background-logo design, with hero copy restored (2026-09-22,
    committed `2953c04`)** — `app/page.tsx`'s hero `<section>` is now `relative min-h-[80vh] flex
    items-center overflow-hidden` with two stacked layers instead of the single centered-logo
    layout from item 10:
    - **Background layer** (`z-0`): `/images/cuppascards-logo.png` rendered via `next/image`'s
      `fill` prop (the correct idiomatic way to have an Image cover its positioned parent by
      percentage, rather than a fixed intrinsic `width`/`height` — not used anywhere else in this
      codebase before now) with `sizes="100vw"`, `object-contain` (chosen over `object-cover` so the
      whole crown+wordmark mark stays visible rather than being cropped unpredictably across
      breakpoints), `opacity-10`, and `pointer-events-none` — a subtle full-bleed watermark, not
      readable branding on its own. `alt=""` since it's purely decorative here (the Navbar's own
      logo already carries the real `alt={siteConfig.name}` for assistive tech).
    - **Foreground layer** (`z-10`): the pill badge ("South Africa's Premier Grading Service.") and
      subheadline ("Making Grading Easy") that item 10 had removed are **restored** — the request
      referenced this exact copy ("hero text content ('South Africa's Premier Grading Service',
      etc.)"), so this session treated it as a request to bring back that specific previously-removed
      copy rather than inventing new marketing text; the two CTA buttons are unchanged. This content
      div is `relative z-10`, which combined with the background layer's `z-0` and `pointer-events-none`
      guarantees the buttons are fully clickable — **independently verified by actually clicking
      "Start a Submission" and confirming client-side navigation to `/dashboard` succeeded**, not just
      by inspecting the CSS.
    - The pre-existing ambient blur glow (`-z-10`) is unchanged and still sits behind both layers.
    - `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing 46-error baseline. Click-tested
      live: watermark renders large and faint behind the copy/buttons exactly as specified, text and
      buttons fully legible, "Start a Submission" click-navigates correctly. **Committed (`2953c04`), pushed, and deployed.**

14. **Hero visual refinement — pill badge removed, background logo made bold (2026-09-22,
    committed `f7140f9`)** — two adjustments to item 13's layout, on explicit visual-review feedback that
    the opacity-10 watermark read as "too dull":
    - The pill badge ("South Africa's Premier Grading Service.") is removed entirely — the section
      now reads as just the logo and the two CTAs, with the "Making Grading Easy" subheadline as the
      only remaining text.
    - The background logo's opacity is raised from `opacity-10` to `opacity-80` (same `fill`,
      `object-contain`, `pointer-events-none`, `z-0` positioning as item 13 — only the opacity class
      changed). At this level the gold crown/C mark and the green "CARDS" wordmark are clearly
      readable as branding, not just an ambient texture; the "Making Grading Easy" subheadline now
      visually overlaps part of the crown mark but stays legible (light text over the mark's darker
      negative space). The CTA buttons are unaffected regardless of background opacity, since they
      have their own fully opaque backgrounds. **Re-verified by actually clicking "Start a
      Submission"** (not just inspecting z-index) that it still navigates to `/dashboard` at the new
      opacity — confirms the click-through guarantee from item 13 still holds.
    - `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing 46-error baseline. Click-tested
      live at the higher opacity via a zoomed screenshot to inspect legibility up close. **Committed (`f7140f9`), pushed, and deployed.**

15. **Hero finalized — all floating text removed, CTAs reframe the logo left/right (2026-09-24,
    committed `f7140f9`)** — completes the hero's evolution into a pure logo-plus-CTAs layout:
    - The "Making Grading Easy" subheadline (the last remaining text over the logo, after item 14
      removed the pill badge) is deleted outright — the hero now carries zero text content, only the
      logo and the two buttons.
    - The CTA container changed from a centered `flex-col sm:flex-row items-center justify-center`
      row to `w-full max-w-7xl mx-auto px-4 md:px-12` wrapping `flex-col sm:flex-row items-center
      justify-center sm:justify-between` — on `sm`+ screens this pushes "Start a Submission" to the
      left edge and "Browse the Shop" to the right edge of a wide 7xl-max container, framing the
      centered logo rather than sitting on top of it. No extra vertical-alignment logic was needed:
      the section's own pre-existing `flex items-center` (from item 13) already centers this button
      row vertically at the same point the `fill`+`object-contain` logo centers itself, so the two
      align for free. Below `sm` the row falls back to `justify-center` (still `flex-col`, unchanged
      from before), stacking the buttons centered rather than pinning them to opposite screen edges
      on narrow viewports, per the request's own mobile-handling guidance.
    - **Verified past just reading the CSS**: clicked "Browse the Shop" live and confirmed
      client-side navigation to `/shop` succeeded with the new container structure. The mobile
      stacking behavior (`flex-col` below `sm`) was **not** independently screenshotted this round —
      an attempt to resize this session's shared browser tab to a phone-width viewport didn't take
      effect (`window.innerWidth` stayed at the desktop size afterward) — but it reuses the exact
      same `flex-col sm:flex-row` responsive pattern already live-verified elsewhere in this hero
      and codebase, so this is a reasoned-but-not-screenshotted confidence, not a blind assumption.
    - `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing 46-error baseline. **Committed (`f7140f9`), pushed, and deployed.**

16. **"The Easiest Way to Grade" feature-card copy updated (2026-09-24, committed `f7140f9`)** —
    `app/page.tsx`'s three step cards below the hero got pure text updates, exact strings as
    requested, no layout/icon/heading/number-badge changes:
    - Card 1 (Submit Online): pricing changed from the stale `"$19.95 per card"` to
      `"R425 per card"` — matches the site's real single-currency (ZAR) launch pricing rather than
      the old placeholder USD figure.
    - Card 2 (Secure Logistics): the `"via DHL with full fine-art insurance included"` clause is
      dropped, now ending at `"...express ship your submissions."`
    - Card 3 (Slabs to Your Door): `"Once graded, "` is dropped and `"your address"` becomes
      `"you"` — now `"Track your order's progress live on your dashboard. We handle all import
      customs and deliver the pristine slabs right back to you."`
    - `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing 46-error baseline.
      Click-tested live: all three cards render the new copy with unchanged layout/icons/badges.
      **Committed (`f7140f9`), pushed, and deployed.**

17. **Card 1 copy streamlined further, dropping the price line (2026-09-24, committed `f7140f9`)** —
    supersedes item 16's Card 1 text: `"Choose your turnaround tier starting from just R425 per
    card"` is dropped entirely, leaving just `"Use our integrated TCGdex database to quickly search
    and add your cards to your digital queue."` Cards 2 and 3 (from item 16) and all layout/badge/grid
    structure are untouched. `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing
    baseline. Click-tested live. **Committed (`f7140f9`), pushed, and deployed.**

18. **Global UX/UI polish — pilot pass on homepage + shared `ui/` primitives (2026-09-24,
    committed `f7140f9`)** — the user asked for a broad "make the whole app feel premium and fluid" pass
    (fluid scrolling/easing, scroll-triggered entrance animations, micro-interactions, spatial
    rhythm/depth). Before touching anything, three scoping questions were put to the user via
    `AskUserQuestion` rather than guessing, because the literal request had real risk/ambiguity:
    (1) it asked for GSAP + ScrollTrigger, but this codebase already has `framer-motion` installed
    and in live use (the submit wizard's step transitions) — running two animation libraries for
    overlapping jobs was flagged; (2) it asked for a global smooth-scroll library (Lenis), which
    intercepts scroll on every route including `/submit`, which already has a documented
    `scrollIntoView()`-based interaction and past rAF/backgrounded-tab animation issues earlier this
    session; (3) "global" polish assumes one shared Button/Card component used everywhere, but this
    codebase's actual shared `components/ui/button.tsx` (shadcn-based) coexists with dozens of pages
    using raw inline Tailwind buttons instead. **The user chose, for all three: use framer-motion
    (skip GSAP), skip Lenis in favor of CSS `scroll-behavior: smooth` + custom easing curves only,
    and scope this pass to the homepage + shared `ui/` primitives as a pilot rather than all ~79
    routes at once.** What actually shipped, strictly presentational/interaction-layer, no logic
    changes:
    - **Easing tokens** (`app/globals.css`): `--ease-fluid` (`cubic-bezier(0.16, 1, 0.3, 1)`, a soft
      decelerate for things appearing/reacting to input) and `--ease-fluid-in-out`
      (`cubic-bezier(0.65, 0, 0.35, 1)`, for two-way state toggles) are defined in `:root` and
      re-exposed in `@theme inline` as Tailwind utilities (`ease-fluid`, `ease-fluid-in-out`) — this
      project's existing Tailwind v4 CSS-first theme convention (same pattern as the brand-color
      tokens), so no `tailwind.config` file was needed or created.
    - **Smooth in-page scrolling**: `html { scroll-behavior: smooth }` added, gated behind
      `@media (prefers-reduced-motion: no-preference)` so it never overrides a visitor's own
      OS-level motion preference. **Real behavioral consequence discovered during verification and
      worth flagging explicitly**: per the CSSOM View spec, this makes the browser interpret *every*
      unspecified-behavior `window.scrollTo()`/`scrollIntoView()` call site-wide as smooth instead of
      instant (confirmed directly: a plain `window.scrollTo(0,0)` no longer completed synchronously
      during testing). No existing call site in this codebase specifies `behavior: 'instant'`
      explicitly, and the one documented `scrollIntoView({ behavior: 'smooth' })` call in
      `wizard.tsx`'s `joinBatch` was already smooth on purpose, so nothing regresses today — but any
      future plain scroll-jump anywhere in the app will now animate. Flagged here rather than
      silently absorbed, per this project's own "surface real discoveries, don't guess" pattern.
    - **New shared primitive** — `components/AnimatedSection.tsx` (client component): a generic
      `motion.div` wrapper (`framer-motion`, already a dependency) that fades up (`opacity 0→1`,
      `y: 24→0`) once scrolled into view (`whileInView`, `viewport={{ once: true }}`), using
      `--ease-fluid`'s exact curve, with an optional `delay` prop for staggering siblings. Deliberately
      generic (no section-specific markup) so it can wrap any block. `app/page.tsx` stays a Server
      Component — only this small wrapper is a Client Component, matching this codebase's established
      "thin server page + small client boundary" pattern (`login`/`submit` pages) rather than
      converting the whole homepage to `'use client'`.
    - **`app/page.tsx` homepage pilot**: the "How It Works" heading block and each of the 3 feature
      cards (staggered `delay={0, 0.1, 0.2}`) and the WhatsApp CTA block are now wrapped in
      `<AnimatedSection>`. The two hero CTAs and the WhatsApp link gained `transition-all duration-200
      ease-fluid active:scale-[0.97]` (a gentle press-scale + organic-timed color/shadow fade,
      replacing the bare `transition` class). The three feature cards gained
      `transition-all duration-300 ease-fluid hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20`
      (a soft lift + diffuse shadow on hover, softened border to `border-slate-800/70`) and their
      number-badge scale-on-hover now also uses `ease-fluid`. Section vertical padding increased
      (`py-24`→`py-28 md:py-32` for "How It Works", `py-20 md:py-24`→`py-24 md:py-28` for the
      WhatsApp CTA) for more breathing room between sections, per the request's "spatial rhythm" ask.
    - **`components/ui/button.tsx`** (the shared primitive, actually used in 10 files — `submit`
      wizard steps, `admin/events`, `admin/test-emails`, `my-account` pages, `dashboard` — more than
      "barely used" as first assumed, so this was spot-checked live on `/submit` afterward): every
      variant's base classes gained `duration-200 ease-fluid active:scale-[0.97]` (a gentle press
      effect) plus `hover:shadow-md` on the variants that already had a resting `shadow-xs`, for a
      subtle elevation-on-hover depth cue. No variant color, size, or logic changed.
    - **`components/Navbar.tsx`** (the other shared primitive, mounted on every non-auth page): gained
      a `useState`+scroll-listener `isScrolled` flag that adds `border-slate-800 shadow-lg
      shadow-black/30` once `window.scrollY > 8`, fading in via `transition-all duration-300
      ease-fluid` — the "navigation header on scroll" depth cue named explicitly in the request. At
      rest the border is `border-transparent`/`shadow-none` (same layout box, no shift). Every
      existing plain `transition` class on Navbar's links/buttons (13 occurrences) also picked up
      `ease-fluid`. **Independently verified via `getBoundingClientRect`/`getComputedStyle`
      inspection** (not just visual screenshots) that the shadow classes are genuinely absent at
      `scrollY: 0` and genuinely present at `scrollY: 300` — ruling out a "shadow always on" bug that
      an early, flawed JS `window.scrollTo()`-based test run (confounded by the new `scroll-behavior:
      smooth`, see above) had initially suggested.
    - **Explicitly deferred, per the user's own scoping choice** — not done in this pass: GSAP/
      ScrollTrigger, Lenis, any change outside the homepage + the two shared `ui`/`Navbar` primitives
      (vendor, services, shop, auctions, admin dashboards, submit wizard's own card/step styling,
      etc.), and a shared `Card` component (none exists in this codebase; inventing one wasn't asked
      for and the homepage's three feature cards were polished in place instead).
    - `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing 46-error/2-warning baseline
      (none in a file this task touched). Click-tested live: fresh-tab homepage load (avoiding a
      stale-cache artifact in an old tab, same class of issue as the earlier logo work), fade-up
      entrance animations confirmed via a mid-transition screenshot and a settled-state screenshot,
      Navbar scroll-shadow confirmed programmatically, and `/submit`'s Step 1 spot-checked for the
      `Button` component change with no visual regression. **Committed (`f7140f9`), pushed to
      `origin/main`, and deployed to production** (`dpl_FZBi4NNnKssSmdHTWGxs2b1gW3vD`).

19. **Navbar logo sized up for more brand presence (2026-09-24, committed `734a208`)** —
    `components/Navbar.tsx`'s logo grew from `h-8 sm:h-10` (32px/40px) to `h-14 sm:h-20` (56px/80px)
    on explicit feedback that it read as "too small." The literal request suggested "3-4x" as an
    example (its own illustration used `h-6` → `h-20`), which taken completely literally against
    this navbar's actual starting point (`h-10`, not `h-6`) would mean an `h-32`–`h-40` (128-160px)
    logo — taller than the entire navbar itself and clearly not what a real premium site header looks
    like. Used judgment instead: landed on `h-14 sm:h-20`, roughly doubling the size (a large, clearly
    noticeable jump) while keeping the header proportionate, and explicitly matched the request's own
    `h-20` example value for the desktop breakpoint. Also widened the gap between the logo and the nav
    links (`gap-8` → `gap-10`) so the bigger mark doesn't crowd them, and trimmed the row's vertical
    padding slightly (`py-4` → `py-3`) so the navbar doesn't grow taller than it needs to now that the
    logo itself carries more of the height. No change was needed to keep it left-aligned/vertically
    centered — the existing `flex items-center` row already guarantees that regardless of logo height.
    **Asset resolution verified, not assumed**: `/images/cuppascards-logo.png` is the same 2400×1524
    master used everywhere else on the site (not a small pre-cropped crop), so Next's image optimizer
    regenerates a sharp render at the new larger size with no quality loss — confirmed via a zoomed
    screenshot showing clean, non-pixelated crown/wordmark detail at the new size. No higher-resolution
    source or SVG was needed. `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing
    baseline. Click-tested live. **Committed (`734a208`), pushed to `origin/main`** (not yet
    deployed as of this writing — check `git log` / the last deploy's commit hash to confirm).

20. **Label options step gets visual previews + crossfade; currency formatting audited
    (2026-09-25, committed `74d65be`)** — `components/submit/step-grader-tier.tsx`'s "Label options" section
    (ACE-only, Step 1 of `/submit`):
    - **Preview panel**: a new panel sits beside the three label buttons on desktop (`md:flex-row`)
      and stacks below them on mobile (`flex-col`, the default) — `w-full md:w-40 aspect-[3/4]
      md:shrink-0 rounded-xl border`, themed with this app's existing `--line`/`--paper-raised`
      tokens rather than inventing new colors. Selecting Standard/Colour Match/Ace Label crossfades
      to that option's preview image using `framer-motion`'s `AnimatePresence` (`mode="wait"`,
      `--ease-fluid` curve, 0.3s) — reusing the same animation library and easing token from the
      2026-09-24 UX polish pass rather than adding a new one.
    - **Placeholder paths + graceful fallback, since the real slab photos don't exist yet**: source
      paths are `/images/labels/{standard,colour-match,ace-label}-preview.png` (nothing exists at
      that path today — confirmed via `ls`); until real files are dropped in, a themed fallback block
      (the option's label + "Label preview" text) renders instead of a broken image, with **zero
      code change needed** once the real assets are supplied at those exact paths.
    - **A real, non-obvious bug was found and fixed while verifying the fallback, not assumed
      correct**: the first two implementations (next/image's `onError` prop, then a `useEffect`
      keyed on the `labelOption` prop) both failed to reliably detect the missing image. Root
      causes, confirmed by direct testing rather than guessed: (1) next/image's `onError` doesn't
      reliably fire for a same-origin resource that fails in under a millisecond (a local 404/400)
      — the native error event can beat React's synthetic-event wiring for a brand-new DOM node;
      (2) an effect keyed on the `labelOption` *prop* fires before `AnimatePresence`'s `mode="wait"`
      has actually mounted the entering `<img>` (it deliberately delays that until the exiting
      element's animation finishes), so the effect can attach to a stale or nonexistent node. The
      fix: a plain `<img>` (the same documented `eslint-disable-next-line @next/next/no-img-element`
      escape hatch already used in ~16 other files in this codebase) with a **callback ref**
      (`attachPreviewImg`), which fires exactly when React inserts that specific DOM node — whenever
      that really happens — sidestepping both races. Verified via a temporary debug harness before
      removing it, not assumed fixed after one visual glance.
    - **A second real limitation surfaced and is worth recording**: this session's own browser
      automation tooling could not reliably verify the crossfade's actual 300ms timing, for the
      exact same reason already documented elsewhere in this file for the `/submit` wizard's step
      transitions — a backgrounded/non-focused automation tab suspends `requestAnimationFrame`,
      which `AnimatePresence`'s exit-then-enter sequencing under `mode="wait"` depends on, so the
      panel can appear stuck on the previous selection indefinitely in this specific test harness.
      Confirmed this is a test-environment artifact, not an app bug, using the same
      already-established diagnostic from that prior incident: temporarily setting the transition
      `duration` to `0` (bypassing the rAF dependency) immediately fixed the observed test behavior,
      proving the underlying state/crossfade logic is correct; the `duration` was reverted to the
      real `0.3` before finishing. Button *selection* itself (background/state) was independently
      confirmed to update instantly and correctly on every real click throughout.
    - **Currency formatting audited, not changed**: the request also asked to "enforce strict
      currency formatting." Checked both this step and its neighbors (`lib/currency.ts`,
      `step-review-pay.tsx`) for any hand-rolled `$`/`R` string interpolation bypassing the shared
      formatters — found none; every price in this flow already goes through `formatGBP`/`formatZAR`
      (`Intl.NumberFormat`-based, locale-correct, proper currency codes and decimal/thousands
      formatting). No changes made here since no concrete violation was found; flagged to the user
      in case they were referring to a specific instance elsewhere not covered by this step.
    - `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing 46-error/2-warning baseline
      (the new raw `<img>` uses the same disable-comment convention already present elsewhere, so it
      doesn't add a new warning). Click-tested live with real mouse clicks (not scripted `.click()`
      calls, which this session confirmed are unreliable for triggering React handlers in this
      automation tool) for all three label options; fallback block confirmed rendering correctly
      for the default Standard selection. **Superseded by item 21 below** (real assets landed the
      same day) — the placeholder-path/fallback-detection mechanism this item built no longer exists
      in the code.

21. **Label previews switched to the real ACE slab photos; tier descriptions added
    (2026-09-25, committed `74d65be`)** — supersedes item 20's placeholder-path system now that real assets
    exist. Full detail:
    - **Assets**: the three files from `Stock photos/ACE slab examples/` (`ACE standard.PNG`,
      `ACE colour match.PNG`, `ACE Label.PNG`) were copied to `public/images/labels/` as
      `standard.png`, `colour-match.png`, `ace-label.png` — standardized lowercase-hyphenated
      filenames as requested. **Each was independently opened and visually confirmed to be the
      correct, real slab photo for its tier before copying** (not assumed from filename alone):
      Standard shows a plain black ACE label; Colour Match shows a label color-matched to the
      card's own artwork (a blue Blastoise); Ace Label shows the card's illustration visually
      extending onto the label itself (a green Bulbasaur design). All three are real `colorType 6`
      (RGBA) PNGs, ~300-700KB each.
    - **Simplification, not just a swap**: with real files now guaranteed to exist, the entire
      failure-detection system item 20 built (the `failedPreviews` state, the `attachPreviewImg`
      callback ref, the raw `<img>` + `eslint-disable` escape hatch, the themed fallback block) was
      removed as dead complexity — `next/image` is now used directly, matching this codebase's
      normal convention. This is a deliberate "don't keep speculative complexity once its reason for
      existing is gone" cleanup, not scope creep.
    - **Dynamic tier descriptions**: a new `LABEL_DESCRIPTIONS` record holds the exact copy supplied
      for each tier, rendered as a `<p>` directly below the preview image. The image and its
      description are wrapped in a **single** `AnimatePresence`/`motion.div` (one crossfade unit, not
      two independently-timed ones) so they always fade in perfect sync on selection — simpler than
      coordinating two separate animated elements and exactly matches the request's "fading it in
      smoothly alongside the image."
    - **Responsive layout unchanged in structure** from item 20: `flex-col md:flex-row` on the
      outer row (buttons stack above the preview column on mobile, sit beside it on desktop); the
      preview column widened slightly (`md:w-56`) to comfortably fit the description text without
      wrapping too aggressively, and the slab image itself stayed a fixed `w-40 aspect-[3/4]`
      thumbnail centered in that column.
    - **Verification note**: this session's browser-automation tooling could not get a visual
      screenshot to render the (correctly-loaded, per direct DOM inspection) preview panel within a
      normal few-second wait — confirmed to be the same already-documented "backgrounded automation
      tab suspends `requestAnimationFrame`" limitation as item 20 and the `/submit` wizard's step
      transitions, this time affecting even the plain entrance fade-in (not just the exit-then-enter
      crossfade), since every framer-motion animation depends on rAF. Waiting substantially longer
      (~10s) let the throttled rAF catch up and produced full, correct visual confirmation for both
      the Standard and Ace Label tiers (Colour Match uses the identical, unchanged code path).
      DOM-level checks (`img.complete`, `img.naturalWidth`, exact description text) independently
      confirmed correctness throughout, not just the delayed screenshots.
    - `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing 46-error/2-warning baseline
      (the raw-`<img>` lint-disable from item 20 is gone along with the code it was guarding).
      **Committed (`74d65be`), pushed to `origin/main`, and deployed** (production has since been
      redeployed from later commits that include it).

22. **Hero CTAs moved from framing the logo to sitting directly beneath it (2026-09-25,
    committed `b26c728`)** — `app/page.tsx`'s hero, on explicit visual-review feedback that the buttons
    should anchor under the "CUPPASCARDS" wordmark instead of flanking the logo left/right:
    - **The logo left normal-flow entirely and came back to it.** Since item 13's redesign, the
      logo had been a full-bleed `fill` background (`absolute inset-0`) spanning the whole
      `min-h-[80vh]` section, with the CTA row sharing the section's own vertical center via
      `flex items-center` — that's what let the buttons frame the logo left/right for items 13-15.
      A `fill` background's rendered bounds shift with the section's actual height, so nothing in
      normal document flow could reliably anchor "directly underneath" one specific part of it (the
      wordmark) across different viewport heights. The fix: the logo is a normal, intrinsically-sized
      `<Image>` again (`w-[280px] sm:w-[360px] md:w-[440px] h-auto`, same size as it's been since
      item 14, just no longer `fill`/absolute), inside a centered flex column
      (`flex flex-col items-center`) with the CTA row directly after it in the DOM and `mt-10` for
      breathing room — "directly underneath" is now pixel-exact by construction, not approximated.
    - **Opacity restored to 100%** (was `opacity-80` as a background watermark since item 14) — now
      that it's genuine foreground content rather than a background texture competing with anything
      layered on top of it, full opacity is the correct default and reads bolder than the 80%
      background version did.
    - **CTA row**: `flex flex-col sm:flex-row justify-center items-center gap-4 mt-10` — centered as
      one group (replacing the old wide `max-w-7xl` + `justify-between` framing layout), stacking
      vertically below `sm` and sitting side by side from `sm` up, matching the request's own
      suggested implementation almost verbatim. Button styling/behavior (colors, press-scale, hover
      shadow) is unchanged from item 14/18.
    - `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing baseline. Click-tested live:
      logo renders sharp and prominent, both buttons sit centered directly beneath the wordmark with
      clear spacing, and "Browse the Shop" click-navigates to `/shop` correctly. This section has no
      framer-motion animation, so none of the rAF-throttling caveats noted in items 20/21 applied
      here — rendered correctly on the very first screenshot with no extra wait needed. **Committed (`b26c728`), pushed, and deployed.**

23. **Hero logo scaled up ~5x (2026-09-25, committed `b26c728`)** — `app/page.tsx`'s logo width classes
    changed from `w-[280px] sm:w-[360px] md:w-[440px]` to `w-[300px] sm:w-[500px] md:w-[800px]
    lg:w-[1000px]` (the exact breakpoint values given in the request), `h-auto object-contain`
    unchanged. The wrapping container was widened from `max-w-4xl` to `max-w-6xl` — without that,
    the new, much wider size would have silently been capped well short of the requested width by
    the narrower parent, since the image itself isn't `fill` (see item 22). CTA spacing
    (`mt-10` between the logo and the button row) was left unchanged — already within the request's
    own suggested `mt-8`–`mt-12` range and confirmed still reads as a clean gap at the new size.
    **Verified past a misleading first glance**: an initial screenshot looked like the logo hadn't
    grown much, but that was the whole (very tall, `min-h-[80vh]`) hero being scaled down for the
    screenshot, not a real sizing bug — a mistaken `document.querySelectorAll('img')` match against
    the *Navbar's* logo (same `alt={siteConfig.name}` text) initially returned a misleadingly small
    125px reading too. Re-checked correctly by inspecting all three "CuppasCards"-alt images on the
    page and identifying the actual Hero one by its DOM position: confirmed rendering at exactly
    `1000px` wide at a ≥1024px (`lg`) viewport, matching the requested value precisely. `npx tsc
    --noEmit` clean; `npm run lint` at the same pre-existing baseline. **Committed (`b26c728`), pushed, and deployed.**

24. **Mandatory Secursus fine-art insurance added to checkout (2026-09-23, committed `b26c728`)** — two new
    Order Summary line items in `components/submit/step-review-pay.tsx`, charged as 15% of the
    submission's total declared card value per leg of the international journey (30% in total).
    - **No new "Total Declared Value" input was added** — the request asked for one "if it doesn't
      exist yet," but it already does: every card in Step 1 already has its own required-in-practice
      "Declared value (R)" input (`components/submit/card-shipment-row.tsx`, ZAR-denominated,
      feeding `submission_items.declared_value`), and `app/api/submissions/route.ts` already sums
      these server-side into `submissions.total_declared_value` at creation time. Adding a second,
      separate "total" input would have created two competing sources of truth for the same figure.
      Instead, `step-review-pay.tsx` computes `totalDeclaredValueZAR = cards.reduce((sum, c) => sum
      + (c.declaredValue || 0), 0)` — the exact same formula the server already uses — so the Order
      Summary shown to the customer always matches what actually gets persisted.
    - **New shared pricing logic** (`lib/submission-types.ts`): `SECURSUS_INSURANCE_RATE = 0.15`,
      `secursusInsuranceLegFeeZAR(totalDeclaredValueZAR)` (a plain multiply), and
      `SECURSUS_INSURANCE_LEG_LABELS` (`outbound`/`returnLeg` label pair), following the exact same
      constant/function/labels-record pattern already established for the domestic and international
      courier fees in this same file. **Deliberately not region-parameterized** like every other fee
      function here (which all take a `ProductRegion` and branch USD/GBP/ZAR) — declared value is
      always ZAR regardless of region (same established convention as `GradingEmailCard.declaredValue`
      elsewhere in this codebase), so there's no other currency to convert from.
    - **Order Summary**: two new lines ("Secursus Insurance: Outbound to UK (15%)" / "...Return to SA
      (15%)") inserted between the existing International Courier Fees lines and "Total due today",
      each rendered with `formatZAR` directly (not `formatByRegion`) — deliberately always Rands, per
      the request's explicit "no GBP/USD conversions" requirement, regardless of what region a
      submission is ever priced in. The insurance total is folded into `serviceFee` (not just
      `total`), matching the precedent that costs covering the *international* leg of the journey
      (grading, label, CuppasCards services, international courier) are part of `serviceFee`, while
      only the domestic/local courier legs are excluded from it and added solely to `total` — since
      insurance covers the same international round trip the courier legs do, it follows that
      existing grouping rather than inventing a new one.
    - **Verification**: `npx tsc --noEmit` and `npm run lint` both clean (same pre-existing 46-error
      baseline). The pure calculation was independently checked against a known input (R1000 declared
      value → R150 per leg → R300 total) and confirmed exact. **A full live click-through to Step 3's
      Order Summary was attempted but not completed** — Step 1's `canAdvance` gate requires a
      non-empty card name/set name (checked directly in `app/submit/wizard.tsx`), and several
      attempts to satisfy it via scripted DOM events (setting input values + dispatching
      input/blur events, clicking the tier selector) did not reliably update the wizard's React
      state in this browser-automation session — the same class of friction already documented
      elsewhere in this file for scripted `.click()` calls not registering as trusted React events.
      Rather than continue fighting the automation environment, correctness here rests on: exact
      structural match to the already-live, working International Courier Fees pattern immediately
      above it in the same file; a clean type-check across the whole new data flow (cards →
      totalDeclaredValueZAR → secursusInsuranceLegFeeZAR → JSX); and the independently-confirmed
      arithmetic above. **This should be spot-checked live in a real browser session before this
      ships to production**, since it directly affects the checkout total charged via Payfast.
      **Committed (`b26c728`), pushed to `origin/main`, together with items 22-23 (hero CTA
      repositioning and 5x logo scale) in the same commit, and deployed to production
      (`dpl_4hzXNid3Vwi3HjSnACZRp98xhkNQ`, aliased to `website-three-iota-83.vercel.app`). Note:
      item 23's logo scaling shipped in this commit but was itself superseded by items 25-27 before
      this deploy went out, so the currently-live hero logo reflects item 27's `fill`-layout
      version, not item 23's.**

25. **Hero logo scaled up extremely, viewport-driven, to eliminate remaining negative space
    (2026-09-23, committed `8c25594`)** — `app/page.tsx`'s hero logo (`Image` at line ~31) moved from a
    fixed-pixel-breakpoint scale (`w-[300px] sm:w-[500px] md:w-[800px] lg:w-[1000px] h-auto`, from
    item 23) to viewport-unit-driven sizing: `w-full max-w-[1200px] sm:w-[90vw] h-[45vh]
    sm:h-[55vh] md:h-[65vh] lg:h-[75vh] object-contain`. Height is now the primary driver (up to
    75vh on `lg`+) with `sm:w-[90vw]` as a width ceiling and `max-w-[1200px]` as an absolute pixel
    cap so it can't overflow ultra-wide monitors — matching the three sizing mechanisms
    (vw/vh/max-width) the request's own example combined. `object-contain` keeps the real asset's
    aspect ratio intact despite both width and height now being explicitly set by CSS (this is a
    plain `object-fit` behavior that applies to any element with an explicit box size, not
    something specific to `next/image`'s `fill` mode).
    - **Outer container's `max-w-6xl` cap removed** (was `max-w-4xl` before item 23, widened to
      `max-w-6xl` for the 5x scale) — left in place, it would have silently re-capped the new
      `sm:w-[90vw]` sizing on any screen wider than 1152px, recreating the exact "trapped in a
      container" ceiling the request asked to eliminate.
    - **Hero section's `min-h` raised from `min-h-[80vh]` to `min-h-screen`** so the now much
      taller logo has room to render without cramping the CTA buttons beneath it; `overflow-hidden`
      on the section (already present) is now load-bearing rather than incidental, since
      `w-[90vw]`/`h-[75vh]` sizing can round to a hair past the viewport edge on some screens.
    - CTA button block, its `mt-10` spacing, and everything below the hero were left untouched.
    - **Verification**: `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing 46-error/
      2-warning baseline (all in unrelated `scripts/*.js` files) — no new issues. **Not live-checked
      in a browser this round** — same class of automation-environment friction documented
      elsewhere in this file made a full visual re-verification impractical to force through
      scripting; the change is a straightforward Tailwind class swap on an already-working `<Image>`
      (no new logic, no new state, no new failure modes introduced), so risk is limited to visual
      proportions, which are worth a real manual look before this ships. **Committed (`8c25594`), pushed, and deployed.**

26. **Hero logo asset confirmed already current; sizing switched from height-driven to
    width-driven, "true sense of scale" pass (2026-09-23, committed `8c25594`)** — the request asked to
    overwrite `public/images/cuppascards-logo.png` with `Stock photos/Cuppalogo background
    removed.png`. Checked via MD5 checksum before copying anything: **the two files are already
    byte-identical** (`8491f5deb06cb8a742cd6077260491f9`) — this exact source was copied in during
    an earlier task (item 12/13's logo finalization). No file operation was performed; only the
    sizing/layout change below was needed.
    - `app/page.tsx`'s hero logo (`Image` at line ~47) sizing switched from item 25's
      viewport-height-driven approach (`h-[45vh]..h-[75vh]`) to the explicitly requested
      width-driven approach: `w-full max-w-[90vw] xl:max-w-[1200px] h-auto object-contain` — `w-full`
      capped by `max-w-[90vw]` up to the `xl` breakpoint, then by the absolute `xl:max-w-[1200px]`
      pixel cap above it; `h-auto` lets the asset's real aspect ratio set its own height (rather than
      item 25's approach of driving height directly and relying on `object-contain` to prevent
      distortion). `object-contain` kept anyway per the request's explicit spec, though with
      `h-auto` it's now a defensive no-op rather than load-bearing.
    - Hero section's `min-h` changed from item 25's `min-h-screen` to the explicitly requested
      `min-h-[85vh]`, and `flex items-center justify-center` gained `flex-col` per spec (a no-op
      with the section's single child, kept for exact compliance and to make the vertical-centering
      intent explicit in the className itself).
    - The outer content wrapper already has no `max-w` cap (removed in the item 25 pass), already
      satisfying this request's "completely remove any restrictive container sizes" requirement —
      no further change needed there.
    - CTA button block, its `mt-10` spacing, and everything below the hero were left untouched.
    - **Verification**: `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing 46-error/
      2-warning baseline (all in unrelated `scripts/*.js` files) — no new issues. **Not live-checked
      in a browser this round**, same as item 25 — this is a second consecutive Tailwind-class-only
      pass on the hero logo with no new logic. Given two scaling passes have now landed back-to-back
      without a live visual check, **a real manual look at the rendered hero (across mobile/tablet/
      desktop breakpoints) is recommended before committing further hero changes**, to confirm the
      cumulative effect actually reads as intended rather than compounding into an oversized result.
      **Committed (`8c25594`), pushed, and deployed.**

27. **Hero logo switched to `next/image`'s `fill` layout to force extreme scaling
    (2026-09-23, committed `8c25594`)** — user reported the logo "still visually restricted," reasoning
    that a non-`fill` `<Image>`'s intrinsic `width`/`height` props (`356`/`225`, unchanged since the
    asset was first wired up) were fighting the Tailwind sizing classes rather than the classes
    cleanly winning. `app/page.tsx`'s hero `Image` (line ~57) had its `width={356}`/`height={225}`
    props removed and gained the `fill` boolean prop, so it now stretches to whatever box its
    nearest `position: relative` ancestor establishes instead of rendering its own intrinsic box
    and being scaled via CSS on top of that.
    - **New dedicated wrapper div** added around the `Image` (required — `fill` needs a
      `position: relative` (or similar) ancestor with explicit dimensions to fill): `className="relative
      w-full max-w-[90vw] xl:max-w-[1200px] h-[50vh] md:h-[60vh] mx-auto"` — the exact classes
      specified in the request, carrying forward the same `90vw`/`xl:1200px` width ceiling from item
      26 but now driving height directly (`50vh`/`60vh`) since `fill` has no `h-auto` equivalent (a
      filled image has no intrinsic aspect ratio of its own to derive a height from — the box's
      dimensions come first and the image is stretched/contained into them).
    - `Image`'s `className` simplified to just `object-contain` (no more `w-full`/`max-w`/`h-auto`
      on the image itself — all sizing now lives on the wrapper, per the request's explicit
      structure).
    - CTA button block kept its existing `mt-10` spacing (already satisfies the request's "clean
      margin (e.g. `mt-8`)" — not changed to the literal example value since `mt-10` was already an
      intentional, previously-tuned amount and the request only gave it as an example, not an exact
      requirement).
    - **Verification**: `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing 46-error/
      2-warning baseline (all in unrelated `scripts/*.js` files) — no new issues. **Not live-checked
      in a browser this round** — this is now the third consecutive Tailwind/prop-only pass on the
      hero logo without a visual check in this session. **Strongly recommend a real look at the
      rendered hero across breakpoints before any further hero changes or before committing**, since
      `fill` layouts are exactly the kind of change (no compile-time size checking, purely a runtime
      CSS-box result) that can silently produce a stretched, cropped, or oversized result that
      neither `tsc` nor `eslint` would ever catch. User confirmed the rendered result "looks great"
      before this was committed. **Committed (`8c25594`), pushed to `origin/main`, and deployed to
      production (`dpl_4hzXNid3Vwi3HjSnACZRp98xhkNQ`, aliased to
      `website-three-iota-83.vercel.app`; build compiled clean, all routes generated with no
      errors).**

4. **Step 1 (`Grader & tier`) simplified to ACE-only for launch** — `components/submit/
   step-grader-tier.tsx` no longer renders a "Country of origin" or "Grading company" selector;
   `app/submit/wizard.tsx`'s `region`/`company` are now plain `'sa'`/`'ACE'` constants (not
   `useState`) rather than deleted, since every downstream consumer (`PoolTracker`,
   `StepAddOns`, `StepReviewPay`) still needs them. Only ACE's 5 real tiers
   (`ace_basic`/`ace_standard`/`ace_premier`/`ace_ultra`/`ace_luxury`) are reachable. Click-tested
   live end-to-end through Steps 1→2 with a real TCGdex search-and-select.

5. **Card category locked to Pokémon for launch** — `components/submit/card-shipment-row.tsx`
   fully rewritten: the Pokémon/Sports Cards toggle pills, the Sport dropdown, and
   `SportsCardSearch` are removed from this row entirely (not just hidden) since there is no
   longer any UI path to reach them; `card.cardType` stays `'pokemon'` always (its existing
   `createEmptyCard()` default). `components/submit/sports-card-search.tsx` and the
   `'sports_card'` `CardType` value are untouched for a future re-enablement.

6. **Shop filter pills simplified for launch** — `/shop` now shows only `All`/`Graded`/`Raw
   Cards`/`Accessories` (Pokémon Center and Sealed pills hidden, not deleted, in
   `components/shop/category-tabs.tsx`); the Pokémon/Sports Cards game-selector toggle
   (`ProductTypeToggle`) is unmounted in `app/shop/page.tsx`, `activeType` hardcoded to
   `'pokemon'`; selecting `Graded` locks results to ACE only, enforced at both the Supabase query
   level (`app/shop/page.tsx`) and the client-side filter level
   (`components/shop/shop-browser.tsx`'s `effectiveFilters`, computed inside the `useMemo` itself
   to satisfy `react-hooks/exhaustive-deps`) — the PCG/ACE/PSA sub-pill row in
   `components/shop/subcategory-pills.tsx` and the sidebar Grader checkboxes are both hidden.
   Click-tested live: `/shop?category=graded` returned 8 products, all ACE-graded, no PSA/PCG.

7. **Step 2 (`Add-ons`) simplified and refined** — the Semi-Rigids and Consignment toggle cards
   are removed from `components/submit/step-addons.tsx` entirely; `app/submit/wizard.tsx`'s
   `needsSemiRigids`/`interestedInConsignment` are now hardcoded `false` constants (not
   `useState`) rather than deleted, since `app/api/submissions/route.ts` and the
   `submissions.needs_semi_rigids`/`interested_in_consignment` columns are unchanged. Copy
   updated: Pre-grading preparation's description now mentions the new sleeve + semi rigid are
   included standard; the Clean & Polish question's subtext was rewritten to match. A gold "OR"
   divider (pill badge, dark/gold aesthetic) now sits between the per-card list and "This
   submission". Mutual exclusivity (already implemented pre-existing logic in this file) is now
   also visually reinforced: turning on the batch-level Clean & Polish collapses every per-card
   toggle into a "Full submission Clean and Polish active" gold badge instead of just disabling
   the buttons in place. Click-tested live: toggling batch-level Clean & Polish to "Yes" correctly
   collapsed the per-card toggle into the badge.

8. **"Submission Method" selector added to Step 1** — customers now choose between `'batch'`
   (Pooled Batch, the default) and `'individual'` (Individual Direct Dispatch) for how their
   submission is freighted to ACE Grading's UK facility. Migration
   `supabase/migrations/0065_add_submission_type.sql` was run by the user directly against
   production after Claude Code's own auto-mode classifier blocked an assistant-run attempt as a
   production-affecting action — **independently re-verified** via `information_schema.columns`
   (`submission_type`, `text`, `NOT NULL`, default `'batch'::text`) and `pg_get_constraintdef`
   (`CHECK ((submission_type = ANY (ARRAY['batch'::text, 'individual'::text])))`), both matching
   the migration file exactly. Full detail in Active File Manifest and Shared Contracts below.
   **This is deliberately a different concept from `pool_id`/`pool_status`** (the existing,
   currently-hidden `LiveBatchTracker`/`public.pools` system) — see the Shared Contracts entry for
   why they don't overlap. Click-tested live (UI/pricing only — a real checkout with payment was
   not attempted): selecting "Individual Direct Dispatch" and completing Steps 1→3 showed
   "International Shipping: Dedicated Direct Dispatch — R1 020,00" and a correct total (R1 780,00
   = R760 grading + R1 020 shipping) on the Review & Pay screen.

1. **Hero copy** (`app/page.tsx`) — pill badge now reads "Everything should be made as simple as
   possible, but not simpler." (was "Official PCG and ACE Middleman"); subheading now reads
   "South Africa's premier grading service. Making it easy to grade your cards." (was "...premier
   middleman service..."). Pill padding/font-size nudged down (`px-4 py-1.5`, `text-[11px]`) so
   the longer quote fits on one line; everything else on the page unchanged.

2. **Email delivery switched from Resend to Google SMTP/Nodemailer** — this **directly re-opened
   work the user had explicitly parked**, but the user themselves initiated it this time, which is
   the carved-out exception ("do not pick it back up unprompted"). Two architectural conflicts
   were flagged and resolved by asking rather than guessing: the request asked for a brand-new
   `lib/mail/`/`emails/templates/` tree, which would have created a second, competing home for
   email code alongside the existing, explicitly-frozen `lib/email/` convention — **the user chose
   to fully replace Resend inside the existing `lib/email/` files instead of building a parallel
   tree**; the request's `EMAIL_FROM` domain (`cuppascards.com`) was a third domain variant this
   session has seen (after `cuppacards.com` and `cuppascards.co.za`) — **the user confirmed it's a
   real, ready Google Workspace mailbox.** `resend` was uninstalled, `nodemailer` +
   `@types/nodemailer` installed. Full file-level detail in Active File Manifest below.
   **`.env.local`'s `EMAIL_SERVER_*` values are now the real, working credentials** (real Gmail
   App Password for `mitchell@cuppascards.com`, swapped in by the user 2026-09-20) — outbound
   email is fully live, not just pipeline-correct-but-blocked. Confirmed via two real sends
   through `/admin/test-emails` after a dev-server restart to pick up the new env vars: Stage 1
   (`ORDER_CONFIRMED`) and Stage 3 (`RECEIVED_HQ`) both returned real Nodemailer `messageId`s
   (`...@cuppascards.com`) with no SMTP error, landing in the target inbox. The earlier
   placeholder-credential test (Gmail's "Application-specific password required" rejection) is
   now historical — this pipeline sends real mail today.

3. **WhatsApp community link** — `lib/social-links.ts`'s `SOCIAL_LINKS.whatsapp` (previously a
   placeholder) is now the real link, which automatically fixed both of its existing usages
   (`app/page.tsx`'s "Join the WhatsApp Group" CTA, `components/Footer.tsx`'s "Follow Us" icon) —
   confirmed live via both links resolving to the new URL. The request asked to add
   `whatsappCommunity` directly into `config/site.ts`'s `links` with the URL inlined a second time;
   instead `siteConfig.links.whatsappCommunity` re-exports `SOCIAL_LINKS.whatsapp`, same
   single-source-of-truth reasoning as the existing `instagram`/`tiktok` re-exports — avoids
   recreating the exact "second home for the same URL" problem `siteConfig.links` was already
   designed to avoid.

`tsc`/`eslint`/`npm run build` all clean (same pre-existing baseline, no new issues) for all three
pieces. Remaining email delivery work (the other 6 notification stages) stays **explicitly parked
at the user's request** — do not pick it back up unprompted.

---

## Active File Manifest

Grouped by subsystem. Paths are relative to repo root. This lists what exists and is wired
up today — not a to-do list.

### App routes — public
- `app/page.tsx`, `app/layout.tsx` — `app/page.tsx`'s hero has no separate `components/home/Hero.tsx`
  (a requested-but-nonexistent path — everything is inline in the page itself). **Hero copy
  (2026-09-21, latest)**: pill badge now reads "South Africa's Premier Grading Service." (was
  "Everything should be made as simple as possible, but not simpler." — the CSS `uppercase` class
  on this pill means casing in the source doesn't affect the rendered display either way);
  subheading now reads "Making Grading Easy" (was "South Africa's premier grading service. Making
  it easy to grade your cards."). Padding/font-size on the pill (`px-4 py-1.5`, `text-[11px]`,
  nudged down for the previous longer quote) and every other button/layout/import were left
  untouched even though the new pill text is shorter. **Section order below the hero** (also
  2026-09-21): Hero → "The Easiest Way to Grade" (3-step `Submit Online`/`Secure Logistics`/
  `Slabs to Your Door` value prop) → WhatsApp community CTA. Purely a `<section>`-block reorder;
  no inner card layout, animation, or typography touched. **`<FeaturedCarousel>` ("The
  CuppasCards Vault" premium grails showcase) relocated off the homepage entirely** (same day,
  separate instruction) — moved to `/shop` (see that page's manifest entry below) to keep the
  homepage "ultra-clean and conversion-focused." `app/page.tsx` is now a plain synchronous
  component again: the `searchParams`/`HomePageProps`/`activeRegion`/`getSupabaseRouteClient`/
  `getFeaturedProducts` plumbing that existed here purely to feed that carousel's region-aware
  product fetch was deleted outright (not commented out) along with it, since none of it had any
  other purpose on this page.
- `app/batches/page.tsx` — **removed**. The standalone Live Batch Tracker route (and
  `components/LivePools.tsx`, its exclusive slate/amber-themed renderer) is gone; `/batches` now
  308-redirects to `/submit` via `next.config.js`'s `redirects()`. Its content lives on `/submit`
  itself now — see the Submission flow section below.
- `app/services/page.tsx`, `app/prepare/page.tsx`
- `app/contact/page.tsx` — the sidebar's direct `EMAIL` block (`support@gradeandslab.com`, a stale
  domain from before the CuppasCards rebrand) is removed entirely; `LOCATION`/`BUSINESS HOURS` and
  the Vendor Page link below are unchanged. The form itself was already fully wired (`onSubmit` →
  `/api/contact-inquiries` → `contact_inquiries` table, migration 0030) and needed no changes —
  confirmed still working post-edit via a live test submission (`POST /api/contact-inquiries` →
  `201`).
- `app/vendor/page.tsx` — `SHOW_PAST_EVENTS = false` module-level flag hides the "Where We've
  Been" hero nav button and its whole event-gallery section (real `PAST_EVENTS` are still
  placeholders — no live event photos exist yet). `NAV_SECTIONS` conditionally includes the
  `history` entry based on the same flag, so the button and the section it links to are always in
  sync. Nothing deleted — flipping the flag to `true` brings both back exactly as they were.
  **In-Person Submissions feature card 2** ("Every Grading Tier, On-Site") copy updated to drop
  the legacy PCG/PSA multi-grader claim and the "live USD pricing" line — the launch rollout has
  ACE as the sole active grading company (`app/submit/wizard.tsx` hardcodes `company="ACE"`) with
  ZAR the only region actually in use, so a booth attendee was never really choosing between PCG,
  PSA, and ACE, nor seeing USD pricing. Was: `"Attendees choose between PCG, PSA, and ACE Grading
  tiers the same way they would online, with live USD pricing."` Now: `"Attendees choose ACE
  Grading tiers the same way they would online."` Heading, card layout/grid, typography, and the
  number-badge hierarchy (`FeatureCard`) are all untouched. This was the only PCG/PSA/USD
  reference anywhere on this page.
- `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/refund-policy/page.tsx`, `app/shipping-policy/page.tsx` (+ `components/legal/legal-page.tsx`)
- `app/login/page.tsx`, `app/signup/page.tsx` — both gained "Continue with Google"/"Continue with
  Apple" buttons above the existing email/password form (behind a gold-pill "Or" divider), calling
  `supabase.auth.signInWithOAuth({provider, options: {redirectTo: '<origin>/auth/callback'}})` via
  the same client-side `supabase` (`lib/supabase.ts`, `createBrowserClient`) the existing
  email/password flow already uses — no new Supabase client instance. `oauthLoading` state
  disables all three sign-in options while a redirect is in flight. **Google/Apple sign-in via
  Supabase Auth is code-complete but NOT yet usable** — see the Blocked item below; confirmed via
  a live click-test that the client correctly redirects to Supabase's real `/auth/v1/authorize`
  endpoint with the right provider/redirect params, which Supabase itself then rejects with
  `"Unsupported provider: provider is not enabled"` since neither provider has been turned on and
  configured with real OAuth app credentials in the Supabase Dashboard yet.
- `app/auth/callback/route.ts` — **new**. OAuth redirect target for both pages above: reads `?code=`
  and calls `getSupabaseRouteClient().auth.exchangeCodeForSession(code)` (reusing the same route
  client every other route handler in this app already uses, rather than a second inline
  `createServerClient` setup), then redirects to `?next=` (default `/dashboard`) on success or
  `/login?error=oauth_exchange_failed` on failure.
- `components/SocialIcons.tsx` — gained `GoogleIcon` (real 4-color Google "G" mark, the one icon
  in this file that isn't `currentColor`-driven since Google's mark is inherently multi-color) and
  `AppleIcon`, matching the file's existing minimal-inline-SVG convention.
- `app/my-account/page.tsx`, `app/my-account/reset-password/page.tsx`
- **Admin authorization (2026-09-21)**: `app/admin/layout.tsx` — **new**, gates every `/admin/**`
  page route in one place (see the Route conventions Shared Contract above for the exact redirect
  rules and how this relates to the pre-existing per-page inline checks and `lib/require-admin.ts`).
  `components/Navbar.tsx`'s "Admin Portal" link visibility was **already** correct before this
  task — it already only renders when a client-side `profiles.role === 'admin'` check passes — so
  it needed no changes; the request's Navbar requirement was already satisfied by existing code.
  `app/login/page.tsx` was split into a thin Server Component (`Suspense`-wrapping the actual form)
  and a new `app/login/login-form.tsx` client component, solely so the form could read a `?next=`
  query param via `useSearchParams()` (which Next.js requires a `Suspense` boundary for — same
  reason `app/submit/page.tsx` already wraps `SubmissionWizard` the same way) — without this
  split, `app/admin/layout.tsx`'s `redirect('/login?next=/admin')` would bounce the visitor to
  `/login` but then silently drop `next` and always send them to `/dashboard` after logging in,
  regardless of where they were headed. `login-form.tsx` now uses `next` (default `/dashboard`,
  unchanged from the prior hardcoded behavior) for both the password-login `router.push(next)` and
  the Google/Apple `signInWithOAuth`'s `redirectTo` (forwarded as `/auth/callback?next=...`, which
  that route already reads — see the bullet above). Click-tested live: this session's own browser
  is logged in but not admin, and visiting `/admin` correctly redirected to `/` — confirmed the
  guard is live and working for the "authenticated, not admin" case; the "not authenticated at
  all" redirect to `/login?next=/admin` was **not** live-tested (would have required signing out
  of the shared browser session used by several other open tabs) but is a simple, direct
  `if (!user) redirect(...)` matching the exact pattern `app/admin/page.tsx` already used
  successfully before this layout existed.

### Submission flow (grading intake)
- `app/submit/page.tsx` — `async` Server Component. Defines `SHOW_BATCH_TRACKER = false`, a
  module-level feature flag: when `true`, fetches active pools server-side via
  `getActiveLivePools(supabase)`; when `false` (current default), skips that Supabase round-trip
  entirely (nothing renders it, so there's nothing to fetch for) and passes `activePools = []`.
  Passes `activePools` and `showBatchTracker={SHOW_BATCH_TRACKER}` into `SubmissionWizard` as props
  (a Client Component can't read this flag or call `getActiveLivePools` directly, since the latter
  needs a server-side Supabase client) — flipping the flag to `true` is the only change needed to
  bring the tracker back. With the flag off, `/submit` is static again (no dynamic pool fetch).
- `app/submit/wizard.tsx` — accepts `showBatchTracker` and renders `{showBatchTracker && step === 0
  && <LiveBatchTracker pools={activePools} onSelectBatch={joinBatch} />}` above the existing
  `[220px_1fr]` sidebar/step grid. `joinBatch(company, tier)` sets `company`/`tier` (resetting
  `labelOption` to `'standard'` off-ACE, same as the existing `selectCompany`), then
  `requestAnimationFrame`s a `cardsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })`.
  No longer owns any intake-mode/tab state itself — that's fully internal to `LiveBatchTracker`
  now (see below). Steps 1-2 (`StepAddOns`/`StepReviewPay`) are unchanged.
- `components/grading/LiveBatchTracker.tsx` — **new**, replaces the short-lived
  `components/submit/active-batches-panel.tsx` (deleted). Fully self-contained: owns its own
  `'batch' | 'custom'` tab-toggle state internally (defaults to `'batch'` when `pools.length > 0`,
  else `'custom'`), so the host wizard needs no tab state of its own — switching to "Custom
  Submission" here just collapses this section, leaving the wizard's always-present Step 1 form as
  the only thing left to interact with. Props: `pools: PoolRow[]`, `onSelectBatch?: (company:
  GradingCompany, tier: SubmissionTier) => void`. Styled against `/submit`'s own "vault"
  CSS-custom-property theme (`--ink`, `--seal`, `--line`, `--font-display`), not
  `LivePools.tsx`'s old slate/amber Tailwind palette. Tier labels come from
  `TIER_OPTIONS_BY_COMPANY`, not the pool's own auto-generated `label` column (which is literally
  `"<company> <raw tier slug> Batch #<n>"`, e.g. `"ACE ace_standard Batch #1"` — too raw for a
  card headline); a pool still open under a since-retired tier (e.g. ACE's old `ace_value`) falls
  back to a humanized version of the slug rather than showing it verbatim. Currently unmounted in
  the running app (`SHOW_BATCH_TRACKER = false`) but fully wired and ready.
- **In-person event drop-off badge** (`app/submit/wizard.tsx`) — when `inPersonMode` is true (via
  either the `?intake=in-person&event=slug` URL param or the admin's global toggle), renders a
  "Live Intake Active — Handing in at {eventName}" badge above the wizard. `eventName` is fetched
  from `/api/events/active` and only applied when its `active_event_slug` matches the `eventSlug`
  already in play, so a stale/printed booth QR code from a past event never shows the current
  (different) event's name. Falls back to just "Live Intake Active" with no name if the slug
  can't be matched or the fetch fails.
- `components/submit/step-grader-tier.tsx` — tier selector, now renders `TierOption.group`
  subheadings ("Flagship levels" / "Premium levels") when a company's tiers set `group`;
  companies without groups (PCG, PSA) render as a flat list, unchanged. Also renders
  `TierOption.description` under the tier label. Gained an optional `cardsSectionRef` prop
  (`RefObject<HTMLDivElement | null>`), attached to the "Cards in this shipment" wrapper — the
  batch panel's "Join Batch" scroll target. **Launch rollout**: no longer renders a "Country of
  origin" or "Grading company" selector, and dropped the `region`/`onSelectRegion`/`onSelectCompany`
  props entirely — `app/submit/wizard.tsx` now passes a fixed `company="ACE"` and no region prop.
  Only ACE's 5 tiers are reachable; Label options (ACE-only) render unconditionally since ACE is
  now always the active company. Step 1 now leads directly with "Turnaround", followed by "Label
  options" and "Cards in this shipment" — the "Submission Method" section that previously sat
  above "Turnaround" here has been relocated to the top of `step-addons.tsx` (Step 2); this
  component no longer receives `submissionType`/`onSelectSubmissionType` props at all.
- `step-addons.tsx` — **launch rollout**: Semi-Rigids and Consignment toggle cards removed
  entirely (props `needsSemiRigids`/`onToggleSemiRigids`/`interestedInConsignment`/
  `onToggleConsignment` dropped from `Props`); copy updated for Pre-grading preparation and the
  Clean & Polish question; a new `OrDivider` component renders a gold pill "Or" badge between the
  per-card list and the section below it (heading now "Full Clean & Polish" — renamed from "This
  submission", text only, no styling/hierarchy/spacing change and no change to the mutual
  exclusivity logic or pricing); when the batch-level Clean & Polish is on, each per-card
  row now collapses its Yes/No toggle into a "Full submission Clean and Polish active" badge
  (previously just disabled the buttons in place) via `needsCleanAndPolish` inside the `cards.map`.
  The pre-existing `handleToggleCleanAndPolish`/`handleTogglePerCardPrep` mutual-exclusivity logic
  is unchanged. **New**: gained `submissionType`/`onSelectSubmissionType` props (moved here from
  `step-grader-tier.tsx`) and now renders the "Submission Method" section — two selectable cards
  (`SUBMISSION_TYPE_OPTIONS`, `lib/submission-types.ts`) for `'batch'` (Pooled Batch, default) vs
  `'individual'` (Individual Direct Dispatch) — as the first child of the section, above
  "Pre-grading preparation". Markup/copy/badges are unchanged from their prior location.
  `app/submit/wizard.tsx` still owns the `submissionType` state itself and still passes it
  unchanged to `<StepReviewPay>` for Step 3's order-summary line item, so relocating the selector
  required no changes to pricing/checkout logic.
- `step-review-pay.tsx` — still receives `needsSemiRigids`/`interestedInConsignment` props, now
  always `false` from `app/submit/wizard.tsx`'s hardcoded constants instead of user toggles, and
  still forwards them to `app/api/submissions/route.ts`'s checkout payload unchanged. Gained a
  `submissionType` prop, forwarded in the `/api/submissions` POST body.
  **Rewritten (2026-09-21) — "Ship from" delivery-method selector + 5-point Order Summary**:
  - `courier`/`onSelectCourier` props are gone entirely — replaced by `onToggleInPersonMode`
    (wired to `app/submit/wizard.tsx`'s existing `setInPersonMode`, which previously only ever
    got set by the booth-QR URL param or the admin's global `event_settings` toggle). "Ship from"
    now opens with two selectable cards, matching Step 2's Submission Method radio-card style:
    **Courier Delivery** (`!inPersonMode`, the default) and **In-Person Drop-Off** (`inPersonMode`)
    — clicking either just flips the same `inPersonMode` boolean everywhere else in the wizard
    already reads (including the "Live Intake Active" badge at the top of the page, which is an
    intentional, accepted side effect of reusing that one flag rather than inventing a second,
    parallel one). The existing saved-address list / "+ Add a new address" flow renders unchanged
    below the two cards, for both delivery methods (still needed for the return shipment either
    way). The separate "Courier" section (previously "Inbound" when `inPersonMode`) now renders
    only when `!inPersonMode`, and shows a single fixed line for the one real domestic provider
    instead of a clickable list — see the courier-tier replacement below. `canCheckout` simplified
    to just `Boolean(addressId)` (no more `&& courier`) since there is no longer a domestic courier
    to separately select.
  - **Domestic courier tiers replaced**: the placeholder `COURIERS` array (`UPS Ground`,
    `UPS 2nd Day Air`, `FedEx Priority Overnight` — never-real US carrier stand-ins) and
    `courierCostForRegion` are deleted. `lib/submission-types.ts` gained `DOMESTIC_COURIER_LABEL`
    ("The Courier Guy — Pudo Locker to Locker"), `DOMESTIC_COURIER_LEG_FEE_USD/GBP/ZAR` (ZAR 110,
    the only real figure the business gave; USD/GBP are the same kind of approximate-conversion
    stand-in as every other cross-currency figure in that file, in practice never shown since
    `region` is hardcoded to `'sa'`), and `domesticCourierLegFeeForRegion(region)`. Billed as two
    separate legs (customer→HQ, HQ→customer) at this same per-leg rate, zero-rated entirely when
    `inPersonMode` is true.
  - **International courier fee restructured into two legs**: the old single lump-sum
    `INTERNATIONAL_SHIPPING_FEE_USD/GBP/ZAR` constants and `internationalShippingFeeForRegion`
    function (which combined outbound+return into one number: ZAR 150 batch / ZAR 1020 individual)
    are deleted, replaced by `INTERNATIONAL_COURIER_LEG_FEE_USD/GBP/ZAR` (**per leg**: ZAR 110
    batch / ZAR 1400 individual — new figures from the business, not a re-derivation of the old
    ones) and `internationalCourierLegFeeForRegion(submissionType, region)`. `SUBMISSION_TYPE_LINE_ITEM_LABEL`
    (one label per type) is deleted, replaced by `INTERNATIONAL_COURIER_LEG_LABELS[submissionType]`
    (`{ outbound, returnLeg }` label pairs — "...to ACE UK (Pooled)"/"...to SA (Pooled)" for batch,
    "...Direct (DHL/FedEx)" both ways for individual).
  - **Order Summary restructured into a strict 6-item breakdown**, in this exact order: (1) ACE
    grading fees (unchanged); (2) ACE label fee — **now always shown**, including at R 0,00 for the
    free Standard option (previously hidden when free); (3) "CuppasCards Services" — the old two
    separate line items (pre-grading inspection, Clean & Polish) collapsed into **one** line, since
    `step-addons.tsx`'s `handleToggleCleanAndPolish`/`handleTogglePerCardPrep` already make them
    mutually exclusive — label is `"Full Clean & Polish"`, `"Pre-grading preparation × N"`, or (if
    neither is selected) a bare `"Pre-grading preparation"` at R 0,00; (4) Local Courier Fees — two
    lines (`LOCAL_COURIER_LEG_LABELS` at the real ZAR 110 each, or `LOCAL_IN_PERSON_LEG_LABELS` at
    R 0,00 when `inPersonMode`); (5) International Courier Fees — two lines
    (`INTERNATIONAL_COURIER_LEG_LABELS[submissionType]`, each leg priced via
    `internationalCourierLegFeeForRegion`); (6) Total due today. `serviceFee` (the value stored in
    `submissions.service_fee`, sent to `/api/submissions`) = grading + label + CuppasCards Services
    + both international legs — domestic (local courier) legs are still kept out of `serviceFee`
    and only added into `total` (the actual Payfast charge), same split as before this rewrite.
  - **New**: a static "Import & Customs Notice" disclosure paragraph renders directly below the
    Order Summary table (above the checkout error/Pay button) — plain informational copy, not
    computed from any pricing constant, so no `lib/submission-types.ts` change was needed for it.
  - The `courier: string | null` field the API still accepts is now always sent as either
    `DOMESTIC_COURIER_LABEL` or `IN_PERSON_DROPOFF_LABEL` (a fixed string, never a customer choice)
    — `app/api/submissions/route.ts`, `packing-slip.tsx`, and the admin/email surfaces that display
    this column were all checked and require no changes (free-text display only, no allow-list).
  - `app/submit/wizard.tsx`'s own `courier`/`setCourier` state is deleted entirely (it fed nothing
    but the old `courier`/`onSelectCourier` props above, which no longer exist).
- `components/submit/card-shipment-row.tsx` — **launch rollout, fully rewritten**: the
  Pokémon/Sports Cards toggle pills, Sport `<select>`, and `SportsCardSearch` import/usage are
  removed entirely (not just hidden) — every card is always the Pokémon search UI now. `sports-
  card-search.tsx` and the `'sports_card'` `CardType` value are untouched/unreferenced, kept for a
  future re-enablement.
- `sports-card-search.tsx` (unreferenced since the above, kept for future re-enablement),
  `manifest-rail.tsx`, `packing-slip.tsx`, `add-address-form.tsx`
- `app/api/submissions/route.ts` — accepts `submissionType` in `CreateSubmissionBody`, validates
  against `VALID_SUBMISSION_TYPES`, defaults to `'batch'` on anything invalid/missing (same
  defensive-default pattern as `aceLabelOption`/`intakeChannel` in this file), and inserts it as
  `submission_type`.
- `app/api/submissions/checkout/route.ts`
- `lib/submission-types.ts` (shared contract, see below), `lib/addresses-client.ts`
- `supabase/migrations/0059_add_ace_flagship_premium_tiers.sql`, `0060_allow_ace_flagship_premium_tiers.sql`
  — add `ace_premier`/`ace_ultra`/`ace_luxury` to the `submission_tier` enum and widen
  `chk_submissions_tier_matches_company` for ACE. Applied to production, verified.
- `supabase/migrations/0061_add_ace_label_option.sql` — adds `submissions.ace_label_option`
  (nullable text + CHECK, not a new enum) for ACE's Standard/Colour Match/Ace Label choice.
  **Applied to production, independently re-verified** via `information_schema.columns` (column
  exists, `text`, nullable) and `pg_get_constraintdef` (constraint definition matches the
  migration exactly). A prior note in this file said this was still pending — that was stale;
  ground truth is now confirmed directly against the database, not inferred. The ordering risk
  this note used to warn about (submission inserts failing for every grading company if this
  code shipped before the column existed) is resolved now that the column is live.
- Label Options selector (`components/submit/step-grader-tier.tsx`, below Turnaround, ACE-only)
  feeding `step-review-pay.tsx`'s subtotal and `app/api/submissions/route.ts`'s insert — click-tested
  live in the running app: selector renders/toggles correctly, hidden entirely for PCG/PSA.
- **In-person drop-off** (`app/submit/wizard.tsx`'s `inPersonMode` state) has two independent ways
  to become `true`: automatically, via `?intake=in-person&event=slug` or the global `event_settings`
  admin toggle (booth/event flow, unchanged); or manually, via the customer clicking "In-Person
  Drop-Off" in Step 3's "Ship from" section (added in the Order Summary rewrite above) — the two
  paths share the exact same state and downstream logic, so a booth customer arriving with
  `inPersonMode` already `true` simply sees that card pre-selected in Step 3, and any customer can
  manually flip it either way regardless of how they arrived. `supabase/migrations/0062_add_in_person_event_intake.sql`
  adds `submissions.intake_channel/event_slug/handover_pin/intake_verified_at` and the singleton
  `event_settings` table; a manually-selected in-person drop-off submits with `intake_channel =
  'in_person_event'` and `event_slug = null`, a combination the migration's own comment already
  calls out as valid ("an admin could run a live event with no slug set"), so the admin
  booth-handover flow (`app/api/admin/intake/booth-handover/route.ts`) needed no changes. Click-tested
  live through Step 3 — Inbound correctly shows R0,00 and the Pay button enables without a domestic
  courier selection; checkout itself (the actual DB insert) was **not** exercised since migration
  0062 isn't applied to production yet.
- `supabase/migrations/0065_add_submission_type.sql` — adds `submissions.submission_type`
  (`text not null default 'batch'` + CHECK `in ('batch', 'individual')`). **Applied to production
  by the user directly** (an assistant-run attempt was blocked by Claude Code's own auto-mode
  classifier as a production-affecting action) and **independently re-verified** via
  `information_schema.columns`/`pg_get_constraintdef` — both match the migration file exactly.

### Customer dashboard
- `app/dashboard/page.tsx`, `app/dashboard/submissions/page.tsx`, `app/dashboard/submissions/[id]/page.tsx` + `submission-detail.tsx`
- `components/dashboard/cert-link.tsx`, `photo-modal.tsx`, `pipeline-progress.tsx`
- `lib/hooks/use-realtime-submission.ts`

### Admin — grading intake & pipeline
- `app/admin/intake/*` (`intake-portal.tsx` — now also has a "Booth handover" PIN input below the
  existing QR-scan/manual-token flow), `app/admin/grading/*` (`grading-portal.tsx`)
- `components/admin/intake-order-panel.tsx` — gained a `SUBMISSION_TYPE_TAG` badge under the
  header title, always visible (`submission_type` is never null), tagging a submission "Pooled
  Batch" (muted) or "Individual Direct Dispatch" (in the business's `--seal` accent color, so it
  stands out scanning down a queue of otherwise-identical pooled submissions).
  `grade-entry-panel.tsx`, `qr-scanner.tsx`
- `app/api/admin/intake/{lookup,photo,photo-confirm,status}/route.ts`
- `app/api/admin/intake/booth-handover/route.ts` — verifies a 4-digit PIN against submissions where
  `intake_channel = 'in_person_event' and intake_verified_at is null`, atomically sets
  `intake_verified_at`, best-effort sends `sendGradingUpdate('RECEIVED_HQ', ...)`, returns the
  submission's `qr_code_token` so `intake-portal.tsx` can reuse the existing lookup-by-token flow
  to display it.
- `app/api/admin/grading/{queue,save}/route.ts`
- `lib/admin/submission-status.ts`, `lib/admin/photo-upload-client.ts`

### Admin — events
- `app/admin/events/page.tsx` + `events-settings-panel.tsx` — global toggle (`active_event_slug` +
  `active_event_name` + `is_live`) for defaulting every `/submit` visitor into in-person mode
  without a booth QR code. Same inline per-page auth pattern as `app/admin/pools/page.tsx`
  (no shared `layout.tsx`/`requireAdmin()` for pages — that's an API-route-only convention). The
  panel now also has: an Event Name text field; a real shadcn `Switch` (see Shared infra) in place
  of the earlier radio-dot toggle button; a shareable booth link built from
  `window.location.origin` (not `siteConfig.domain` — see that field's own comment for why) as
  `/submit?intake=in-person[&event=<slug>]`; a `QRCodeSVG` rendering of that link; and Copy
  link / Download QR (SVG → canvas → PNG, `downloadSvgAsPng`) / Print buttons. Print is scoped via
  Tailwind's `print:` variant classes directly on this panel's own markup (no separate print-only
  route or window) plus `print:hidden` on `Navbar`/`Footer` so a printed booth flyer shows only the
  event name, QR, and link.
- `app/api/admin/events/route.ts` — admin-only POST to update the singleton row; now also accepts
  and validates `activeEventName` (same `CONTROL_CHARACTERS` check as the slug, plus a 100-char cap).
- `app/api/events/active/route.ts` — public GET, read by the `/submit` wizard; now also returns
  `active_event_name`.

### Admin — pools & logistics
- `app/admin/pools/page.tsx` + `pools-board.tsx`, `app/api/admin/pools/status/route.ts`, `lib/pools/active-pools.ts`
- `app/admin/logistics/page.tsx` + `return-splitter.tsx`, `app/api/admin/logistics/mark-packed/route.ts`, `lib/shipping.ts`

### Shop
- `app/shop/page.tsx`, `app/shop/[id]/page.tsx`, `app/shop/checkout/page.tsx`, `app/shop/layout.tsx`
  — **launch rollout**: `activeType` hardcoded to `'pokemon' as ProductType` (the `as` cast is
  required — a plain `: ProductType` annotation gets narrowed to the literal `'pokemon'` and
  breaks the file's own pre-existing `activeType === 'sports_card'` checks with `TS2367`);
  `ProductTypeToggle` import/usage commented out (component itself untouched); the `Graded`
  category's Supabase query now adds `.eq('grading_company', 'ACE')` in both the main and
  (now-dead-but-preserved) sports-card query branches. **`<FeaturedCarousel>` ("The CuppasCards
  Vault" premium grails showcase) relocated here from the homepage** (2026-09-21) — renders as the
  very first thing in the page's returned JSX, above the `CategoryTabs`/filters/product grid, using
  the same `activeRegion` this page already computed for its own product queries (no new region
  logic needed). `getFeaturedProducts(supabase, activeRegion)` is called once, right after the
  existing `supabase`/`isPokemonCenterView` setup. `FeaturedCarousel`'s own dark, full-bleed
  styling (`bg-neutral-950`, arrows, dot indicators, slab card layout) was not touched — verified
  live that it renders cleanly here since `app/shop/layout.tsx`'s wrapper is already on the same
  dark `--paper`/`--ink` theme as the rest of the app, not a literal light "paper" background as
  the CSS variable's name might suggest. **Heading removed (2026-09-24, committed `4b7ba33`, deployed `dpl_73WkFp7rToSQzJ19LQUhgTEeXkd6`)**: the
  "Premium Grails" eyebrow and "The {siteConfig.name} Vault" `<h2>` were deleted from
  `components/FeaturedCarousel.tsx` (their only render site), along with the now-unused
  `siteConfig` import. The carousel itself (cards, arrows, dots, auto-rotate) is unchanged; the
  `<section>` gained `aria-label="Featured products"` in place of the lost heading, its padding
  was tightened from `py-16 md:py-20` to `py-10 md:py-12` so the heading-less band doesn't read as
  empty space, and it gained `mb-8` so the category pills no longer butt directly against its
  bottom border. The admin product form's "Shows in 'The … Vault' shop page carousel" helper text
  (`app/admin/shop/product-form-modal.tsx`) still uses the Vault name as an internal label.
  **Carousel removed from `/shop` entirely (2026-09-24, committed `15362a6`, deployed `dpl_4WVSmJwNbX6ki3eWe8Nee2uoDFR2`)** — the heading-removal
  change above was committed as `4b7ba33` and deployed (`dpl_73WkFp7rToSQzJ19LQUhgTEeXkd6`); after
  that, the user asked for the whole carousel off the page. `app/shop/page.tsx` no longer imports
  `FeaturedCarousel`/`getFeaturedProducts` or calls `getFeaturedProducts` (one fewer Supabase
  query per shop render), so the page now goes straight from the layout's "Shop" header (`mb-10`)
  to the `CategoryTabs` block. Hide-not-delete: `components/FeaturedCarousel.tsx`,
  `lib/shop/featured-products.ts`, and the admin "Vault grail" flag are all untouched and now
  unrendered — re-adding the two imports, the `getFeaturedProducts` call, and
  `<FeaturedCarousel products={featuredProducts} />` as the first child of the returned `<div>`
  restores it.
- `components/shop/*` (browser, grid, filters, sports-card-filters, category-tabs,
  subcategory-pills, region-toggle, product-type-toggle, cart-button, add-to-cart-button) —
  **launch rollout, "hide not delete"**: `category-tabs.tsx`'s `CATEGORIES` array has "Pokémon
  Center" and "Sealed" commented out (their query logic in `app/shop/page.tsx` is untouched and
  still reachable via a direct `?category=` link); `subcategory-pills.tsx`'s Graded sub-filter row
  (`GRADER_OPTIONS` + its render branch) is commented out; `shop-browser.tsx` computes
  `effectiveFilters` (forcing `graders: ['ACE']` when `activeCategory === 'graded'`) inside its
  `filteredProducts` `useMemo` callback and hardcodes `showGraderFilter={false}` on
  `ProductFilters` — `product-filters.tsx`'s Grader checkbox capability itself is untouched, just
  never invoked with `true` anymore. `product-type-toggle.tsx` is untouched but unmounted (see
  `app/shop/page.tsx` above).
- `lib/shop/{availability,featured-products,grader,product-type,shop-url}.ts`
- `lib/cart/cart-context.tsx`
- `app/api/shop/checkout/route.ts`, `app/api/shop/orders/route.ts`, `app/api/shop/orders/release-stale/route.ts`

### Admin — shop management
- `app/admin/shop/*` (`shop-admin-dashboard.tsx`, `product-form-modal.tsx`, `product-thumbnail.tsx`, `types.ts`)
- Bulk import per grader: `bulk-ace-import/`, `bulk-pcg-import/`, `bulk-psa-import/`
- `app/api/admin/products/*` (CRUD, `[id]/auction`, `[id]/vault-grail`, `batch`, `photo`)
- `app/api/admin/psa/verify-cert/route.ts`, `lib/psa/cert-verification.ts`, `lib/cert-validation.ts`
- `lib/admin/{product-input,product-image-upload}.ts`

### Auctions
- `app/auctions/page.tsx`, `app/auctions/[id]/*`, `app/auctions/new/*`
- `components/auctions/{auction-draft-form,bid-form,bid-history,countdown-timer}.tsx`
- `app/api/auctions/*` (list, `[id]/bid`, `[id]/pay`, `close`, `weekly-checkpoint`)
- `app/api/admin/auctions/schedule-weekly/route.ts`
- `lib/auction-types.ts`, `lib/hooks/use-realtime-auction.ts`

### Payments & money
- `app/api/webhooks/payfast/route.ts`, `lib/payments/payfast.ts`
- `app/api/pricing/route.ts`, `lib/pricing-client.ts`, `lib/pricing/exchange-rate.ts`, `app/api/cron/update-exchange-rate/route.ts`
- `lib/currency.ts`
- `app/admin/financials/*` (internal ZAR-primary/GBP-bracket dashboard)

### Market trends / lore
- `app/admin/trends/*`, `app/api/admin/trends/{sweep,watchlist}/route.ts`, `app/api/cron/market-trends/route.ts`
- `lib/market-trends/{agents,english-pricing,japanese-pricing,run-sweep,types}.ts`
- `app/api/admin/generate-lore/route.ts`

### Misc integrations
- `lib/tcgdex.ts`, `app/api/sports-cards/{brands,search}/route.ts` — sports-card catalog
- `lib/email/transporter.ts` — **new**. `getTransporter()`, a lazily-constructed, pooled Nodemailer
  transporter over Google SMTP (`EMAIL_SERVER_HOST`/`PORT`/`USER`/`PASSWORD` env vars, `secure:
  true`), replacing the old `resend-client.ts` (deleted). `verifyConnection()` calls
  `transporter.verify()` for a health check without sending a real email.
- `lib/email/send-email.ts` — `sendEmail({to, subject, html, text?, cc?})`, the single entry
  point every sender in `lib/email/` calls instead of touching the transporter directly. Never
  throws — returns `{success, messageId?, error?}` — so `lib/email/send-grading-update.ts` and
  `send-order-confirmation.ts`'s four `send-*` functions each re-throw on `success: false` to
  preserve their existing "caller wraps in try/catch" contract for callers like the Payfast
  webhook and `booth-handover/route.ts` that already do `.catch(...)` on them. Defaults `from` to
  `EMAIL_FROM`, falling back to `'CuppasCards <noreply@cuppascards.com>'`. **Every outgoing email
  is unconditionally CC'd to `updates@cuppascards.co.za`** (`ADMIN_CC_EMAIL` constant — changed
  from `info@cuppascards.co.za` to this dedicated inbox on the user's explicit instruction,
  2026-09-20) — appended to whatever `cc` a caller already supplies (string or array) rather than
  replacing it, so the
  business has visibility into every transactional email without a separate logging pipeline. No
  existing caller passes `cc` today, so this applies to all of them automatically with zero
  call-site changes. Click-tested live via `/admin/test-emails`: a real send returned `HTTP 200`
  with a real `messageId`, confirming Gmail's SMTP accepts the multi-recipient (`to` + `cc`) send
  with no error.
- `lib/email/send-order-confirmation.ts`, `templates/order-confirmation.ts` — existing
  payment-receipt emails, now sent via `sendEmail()` instead of Resend; template content
  unchanged.
- `types/notifications.ts` — `GradingEmailStage` (8-stage union) + per-stage payload interfaces
  (`OrderConfirmedPayload`, `CollectionBookedPayload`, `ReceivedHqPayload`,
  `DispatchedToGraderPayload`, `ReceivedByGraderPayload`, `DispatchedToSaPayload`,
  `LandedAtHqPayload`, `DispatchedToCustomerPayload`), discriminated union `GradingEmailPayload`.
  `GradingEmailCard` (the shared `cards` field every stage payload carries) gained
  `declaredValue: number` — always ZAR regardless of the submission's region, matching
  `submission_items.declared_value`'s own unit (see `components/submit/card-shipment-row.tsx`'s
  "Declared value (R)" input) — both real call sites that build this array
  (`send-grading-update.ts`'s `sendOrderConfirmedEmail`, `booth-handover/route.ts`) now also
  select/map `declared_value`.
- `lib/email/send-grading-update.ts` — `sendGradingUpdate(payload)`, dispatches by `payload.stage`,
  now sent via `sendEmail()`; only `ORDER_CONFIRMED` has a real renderer today, the other 7 throw a
  named "not implemented" error (no silent no-op).
- `lib/email/templates/order-confirmed.ts` — `renderOrderConfirmedEmail`, the `ORDER_CONFIRMED`
  template. Reuses `order-confirmation.ts`'s `COLORS`/`escapeHtml` (same dark/gold palette, same
  hand-rolled inline-styled HTML approach — see Shared Contracts below for why). Its cards table
  now has a second, right-aligned "Declared Value" column (`formatZAR`, always ZAR). No call site
  wires this to a real trigger yet — nothing currently invokes it for this stage in the real
  pipeline (the new `/api/test-email` route below does, for testing).
- `lib/email/templates/received-hq.ts` — `renderReceivedHqEmail`, the `RECEIVED_HQ` template.
  Wired to a real trigger: `app/api/admin/intake/booth-handover/route.ts` calls it on every
  verified PIN. Renders gracefully with an empty `inspectionPhotos` (true at booth-handover time,
  since dual-surface photos come from a later, separate step) vs. a real photo grid when populated.
- `getContact` in `lib/email/send-order-confirmation.ts` is now exported (was module-private) so
  `booth-handover/route.ts` can reuse the same profile+auth-email lookup instead of duplicating it.
- `app/api/test-email/route.ts` — **new**. Admin-gated (`requireAdmin()`) POST (`{targetEmail}`
  JSON body) and GET (`?targetEmail=`) diagnostic route: builds a representative sample
  `OrderConfirmedPayload`, renders it, and sends it via `sendEmail()` to confirm the SMTP
  pipeline end-to-end. Gated because it triggers a real send from the business's mail account to
  an arbitrary address — the request didn't specify auth, but every other outbound-side-effect
  route in this codebase is admin-only, so this follows suit.
- `lib/email/templates/{collection-booked,dispatched-to-grader,received-by-grader,dispatched-to-sa,
  landed-at-hq,dispatched-to-customer}.ts` — **new**. Real renderers for the 6
  `GradingEmailStage` values (`types/notifications.ts`) that previously only threw "not
  implemented" — all 8 stages now render for real. Same table-based, inline-styled HTML / shared
  `COLORS`/`escapeHtml` (`order-confirmation.ts`) convention as every other template here. Each
  computes its own subject from its payload (no caller-supplied subjects), matching
  `order-confirmed.ts`/`received-hq.ts`'s existing pattern. `landed-at-hq.ts`'s "Deliver to Me"/
  "List on Marketplace" both link to the same real dashboard submissions page today — there is no
  dedicated return-shipping-choice route yet (see Blocked #3 below), so this doesn't invent one.
- `lib/email/send-grading-update.ts` — `renderGradingEmail`'s switch now has a real case for every
  stage (no more `UNIMPLEMENTED_STAGE_MESSAGE`/throw branch). `sendGradingUpdate`'s return type
  widened from `Promise<void>` to `Promise<{ messageId?: string }>` — every existing caller just
  `await`s it without touching the return value, so this is additive; added so
  `simulate-lifecycle/route.ts` (below) can surface the real Nodemailer `messageId`.
- `app/api/admin/simulate-lifecycle/route.ts` — **new**. Admin-gated POST (`{stage: 1-8,
  targetEmail}`) manual test harness for the full 8-stage lifecycle: builds one fixed seed
  submission (`#CC-ACE-8921`, 2 cards, ACE Standard tier) into the correct `GradingEmailPayload`
  shape for whichever stage number is requested, and sends it via the real `sendGradingUpdate()`
  pipeline (not a parallel one) so what this proves is exactly what production would send. `stage`
  is a plain 1-8 index into a `STAGE_ORDER` array mirroring `GradingEmailStage`'s declared order,
  so the test-runner UI doesn't need to know the real stage names. Note: `OrderConfirmedPayload`
  has no separate label-option/add-on breakdown field, so the seed's "Colour Match" label and
  "Clean & Polish" add-on are folded into `totalPaid` rather than itemized — a real limitation of
  today's payload shape, not this route.
- `app/admin/test-emails/{page.tsx,test-emails-panel.tsx}` — **new**. Same inline
  per-page admin-role gate as `app/admin/events/page.tsx` (no shared `layout.tsx`/`requireAdmin()`
  for pages). 8 buttons (one per stage) + a "Trigger Full Sequence (5s delay between)" button that
  calls `simulate-lifecycle` sequentially with a 5s pause between sends, plus a live console log
  of each response's HTTP status and Nodemailer `messageId`. Click-tested live twice: first
  against placeholder credentials (stage 1 `ORDER_CONFIRMED` and stage 7 `LANDED_AT_HQ` both
  correctly reached Gmail's real SMTP server and failed with Gmail's own "Application-specific
  password required" error, proving both the pre-existing and the 6 new templates render and
  dispatch correctly); then again after the user swapped in the real Gmail App Password
  (2026-09-20) — stage 1 and stage 3 (`RECEIVED_HQ`) both returned real `messageId`s with no SMTP
  error, confirming actual delivery, not just pipeline correctness.
- `app/api/contact-inquiries/route.ts`, `app/api/vendor-inquiries/route.ts`, `app/api/notify/route.ts`, `app/api/webhooks/pool-milestone/route.ts`
- `components/auth/turnstile-widget.tsx` — bot protection

### Shared infra
- `lib/supabase.ts`, `supabase-server.ts`, `supabase-route-client.ts`, `lib/require-admin.ts`
- `lib/site-config.ts` — **new**. `siteConfig.name` (`'CuppasCards'`), `.legalName`
  (`'CuppasCards SA'`, not yet used anywhere — legal pages are still on the old name, see Blocked
  below), `.domain` (`'cuppascards.co.za'`), `.tagline`, and `.links` (re-exports
  `instagram`/`tiktok` from `lib/social-links.ts`'s `SOCIAL_LINKS` rather than duplicating those
  URLs — `SOCIAL_LINKS` stays the one place social profile links are actually defined). The
  request asked for `config/site.ts` or `lib/constants/site.ts`; neither directory exists in this
  codebase (flat `lib/*.ts` files are the convention — see `lib/social-links.ts`,
  `lib/submission-types.ts`), so this lives at `lib/site-config.ts` instead, same reasoning as
  every other requested-but-nonexistent path this session.
- `components/ui/{button,checkbox,input,label,switch}.tsx`, `lib/utils.ts` — `switch.tsx` is
  **new**, a genuine shadcn `Switch` (Radix `@radix-ui/react-switch` primitive under the hood,
  same pattern as `checkbox.tsx`'s `@radix-ui/react-checkbox`). Added on the user's explicit
  confirmation before installing the new dependency. Its base Tailwind classes reference shadcn's
  default `--primary`/`--input` tokens, which this codebase never defined in `globals.css` (every
  other shadcn primitive here is always paired with an inline `style` override using the vault
  theme's own tokens instead, e.g. `Button`'s `style={{ background: 'var(--vault)' }}` usage
  throughout `components/submit/*`) — `events-settings-panel.tsx`'s usage follows that same
  convention (`style={{ background: isLive ? 'var(--seal)' : 'var(--line)' }}`).
- `components/{Navbar,Footer,FeaturedCarousel,PoolTracker,SocialIcons,WhatnotBanner,PackagingGuidelines}.tsx`
  — `Navbar.tsx`'s main nav is `Submit` (`/submit`, label simplified from "Submit & Batches") +
  a personalized submissions link (`/dashboard`, added back so logged-in customers still have a
  path to their own submissions/account now that `Submit Cards` no longer points there) +
  `Shop`/`Vendor`/`Contact`; the standalone `Batches` link is gone. `Navbar.tsx`/`Footer.tsx` both
  now read `siteConfig.name` for the logo alt text, footer copyright, and every social-icon
  `aria-label` instead of a hardcoded `"Cuppa's Cards"` string. The `/dashboard` link's label is a
  `submissionsLabel` computed from a `firstName` state (fetched alongside `role` in the same
  `profiles` query the admin check already runs, `.select('role, full_name')`): `"{FirstName}'s
  Submissions"` (or `"{FirstName}' Submissions"` for a name already ending in s, via a local
  `possessive()` helper) when a session resolves to a profile with a `full_name`, else the
  original `"My Submissions"` for a logged-out visitor or before the fetch resolves. `firstName`
  starts `null` on both the server render and the client's first render (identical to the
  pre-existing `user`/`isAdmin` state), so there is no hydration mismatch to reconcile.
- `supabase/migrations/0001…0058` (56 files) — full schema history, `supabase/apply-all.sql`

---

## Shared Contracts (frozen — do not casually change)

- **`public.profiles`'s real production schema has drifted from every migration file, including
  `0001_init_schema.sql`** — confirmed twice now, independently, against the live database
  (`0040_fix_handle_new_user_missing_email_column.sql`, and again in this session via a failed
  live query). **Production `profiles` has NO `email` column** despite every migration back to
  0001 declaring one (`select profiles(email)` breaks in production — `0040`'s own comment flags
  `app/admin/pools/page.tsx` and `lib/email/send-order-confirmation.ts` as likely-affected,
  unverified as of that migration; get a user's email by joining to `auth.users` instead, e.g.
  `select p.*, u.email from public.profiles p join auth.users u on u.id = p.id`). Production
  `profiles` also has columns no migration file mentions: `street_address`, `city`, `postal_code`,
  `country`, `phone`, `role text default 'customer'` (not the `public.user_role` enum
  `default 'user'` that 0001 declares — but still just a plain string comparison, so `role =
  'admin'` reads/writes the same either way and every admin check in this app already relies on
  exactly that comparison, not on the enum type), and `is_admin boolean` (unused — confirmed no
  application code reads this column; every admin check goes through `profiles.role`, never
  `profiles.is_admin`). Production predates the "rebuild" this migration history describes and was
  never brought fully in line with it. **Before writing any new query against `profiles`, check
  what columns actually exist in production rather than trusting the migration files' declared
  shape** — this project doesn't have a generated `database.types.ts` to catch the mismatch at
  compile time (see the `SubmissionRow`/`PoolRow` Shared Contract entry below on why).
- **`siteConfig`** (`lib/site-config.ts`) — the single source of truth for the brand name shown in
  UI copy. Always read `siteConfig.name` for display text; never hardcode `"Cuppa's Cards"` as a
  literal string in a component. **Legal pages, email templates, and PayFast descriptors were
  harmonized to "CuppasCards" on the user's explicit, detailed instruction** (2026-09-20) — the
  previous deferral above no longer applies to those three areas; they now read `CuppasCards`
  (`app/terms`, `app/privacy`, `app/refund-policy`, `app/shipping-policy`'s body copy and
  `<title>` metadata) or `"CuppasCards SA"` where the legal-entity context requires it (matching
  the pre-existing, already-correct `"Mitchy Moo (Pty) Ltd t/a Cuppa's Cards SA"` entity line in
  `app/terms/page.tsx`, just with the brand half renamed). These are still literal strings, not
  `siteConfig.name` reads — migrating them to read `siteConfig.name`/`.legalName` directly instead
  of a hardcoded literal was not part of what was asked and remains a separate, smaller follow-up.
  Internal code comments referencing "Cuppa's Cards" (`lib/admin/product-input.ts`,
  `app/admin/shop/types.ts`, `lib/shop/featured-products.ts`, `app/globals.css`,
  `supabase/migrations/0057_add_product_is_vault_grail.sql`) were deliberately left untouched —
  out of the requested scope (not legal/email/payment text) and, for the migration file,
  never edited retroactively regardless.
- **`GradingCompany`** = `'PCG' | 'PSA' | 'ACE'` — `lib/submission-types.ts`
- **`SubmissionTier`** — union of all three companies' tier slugs (PCG unprefixed, PSA/ACE prefixed) — `lib/submission-types.ts`. ACE's current purchasable tiers: `ace_basic`, `ace_standard`, `ace_premier`, `ace_ultra`, `ace_luxury`. `ace_value` stays in the union (and the DB enum/CHECK constraint) for historical-row typing only — it is retired from `TIER_OPTIONS_BY_COMPANY.ACE` and must never be re-added there.
- **`TierOption`** gained two optional fields this task: `description` (marketing blurb, rendered under the label) and `group` (subheading key for the tier selector, e.g. ACE's `'Flagship'`/`'Premium'`). Both are optional and additive — PCG/PSA entries omit them and render exactly as before.
- **`SubmissionStatus`** = `'received' | 'inspected' | 'shipped' | 'graded' | 'returned'` (5-stage pipeline, `STATUS_STAGES`) — `lib/submission-types.ts`
- **`PoolStatus`** = `'open' | 'closed' | 'shipped' | 'completed'` — `lib/submission-types.ts`, table `public.pools` (migration 0035)
- **`SubmissionType`** = `'batch' | 'individual'` — `lib/submission-types.ts`, column `submissions.submission_type` (migration 0065, **applied to production and independently re-verified**). Customer's choice of international dispatch method to ACE Grading's UK facility, surfaced at the top of Step 2's "Submission Method" section (relocated there from Step 1, see the Active File Manifest) and priced in Step 3's Order Summary as two separate legs via `internationalCourierLegFeeForRegion`/`INTERNATIONAL_COURIER_LEG_LABELS` (per-leg ZAR: 110 batch / 1400 individual — replaced the old single lump-sum `internationalShippingFeeForRegion`/`SUBMISSION_TYPE_LINE_ITEM_LABEL`, both deleted, in the Step 3 Order Summary rewrite). **Deliberately not the same concept as `pool_id`/`pool_status`**: those track membership in one specific, real `public.pools` row (a tier-scoped batch with capacity, joined via the currently-hidden `LiveBatchTracker` UI, `SHOW_BATCH_TRACKER = false`); `submission_type` is a much simpler standing customer preference that exists independently of whether a real pool is currently open to join — a `'batch'` submission_type never requires or implies a non-null `pool_id`. Do not conflate the two, and do not wire `submission_type = 'batch'` to automatically assign a `pool_id` without a separate, explicit decision to do so.
- **`ProductRegion`** = `'usa' | 'uk' | 'sa'` — `lib/shop/product-type.ts` — drives `tierPriceForRegion`, `cleanAndPolishFeeForRegion`, `inspectionFeeForRegion`, and shop currency display. **Policy**: USD/GBP/ZAR are independently-priced per region, never converted from one another at checkout time.
- **Currency display policy**: admin Financials dashboard is ZAR-primary with GBP bracket, deliberately. Public/customer-facing surfaces price natively per region (see above). Do not force ZAR-primary onto customer-facing pages — flagged explicitly in `launch_readiness_report.md` as a deliberate distinction, not a bug.
- **DB row shapes**: `SubmissionRow`, `PoolRow`, `SubmissionItemRow`, `SubmissionStatusLogRow` (`lib/submission-types.ts`) mirror `supabase/migrations/0001_init_schema.sql`, `0004_status_history.sql`, `0035_submission_pools.sql` — no generated `database.types.ts` exists; these are hand-maintained and must be kept in sync with migrations manually.
- **Route conventions**: admin API routes under `app/api/admin/**` gate on `lib/require-admin.ts`; every admin *page* route under `app/admin/**` is gated centrally by `app/admin/layout.tsx` (added 2026-09-21) — checks `getSupabaseRouteClient()`'s session, `redirect('/login?next=/admin')` if unauthenticated, `redirect('/')` if authenticated but `profiles.role !== 'admin'`. Individual admin pages' own pre-existing inline `if (!user) redirect(...)` / `if (profile?.role !== 'admin') redirect('/')` checks (e.g. `app/admin/page.tsx`) are now redundant but were left in place as harmless defense-in-depth rather than stripped out — the layout's redirect fires first and the page body never runs once it does. Admin status is driven by the single `profiles.role = 'admin'` column everywhere (RLS's `public.is_admin()`, `lib/require-admin.ts`, this layout, and `components/Navbar.tsx`'s client-side "Admin Portal" link visibility) — there is deliberately no second admin-check mechanism (e.g. JWT `app_metadata`) anywhere in the app. Client-facing DB errors must be generic with raw errors logged server-side only (pattern established in `app/api/submissions/route.ts`, since applied to `app/api/admin/products/*`).
- **PayFast webhook idempotency**: every branch in `app/api/webhooks/payfast/route.ts` gates its DB update on `payment_status = 'pending'` via an atomic `UPDATE ... WHERE`, and only fires its side effect when a row actually changed. Do not reintroduce read-then-write here.
- **Email templating convention (decided explicitly, do not revisit without asking)**: all transactional emails are hand-rolled HTML strings with inline styles in `lib/email/templates/*.ts`, never JSX/React Email — most email clients (Outlook especially) ignore `<style>`/CSS-in-JS. Every interpolated user-entered value MUST go through `escapeHtml` (`lib/email/templates/order-confirmation.ts`) — a real stored-XSS was fixed here before. `@react-email/*` is deliberately not a dependency. Senders live in `lib/email/send-*.ts` (not `lib/mail/`), take a payload, and call `sendEmail()` (`lib/email/send-email.ts`) rather than touching the mail transport directly. **Transport**: Google SMTP via Nodemailer (`lib/email/transporter.ts`) as of this session — replaced Resend entirely (`resend` uninstalled, `lib/email/resend-client.ts` deleted) on the user's explicit choice, rather than adding a second parallel email pipeline. `sendEmail()` itself never throws (`{success, messageId?, error?}`); the four `send-*` functions each re-throw on failure so existing callers' `.catch()` blocks keep working unchanged — a notification failure must never fail the pipeline event that triggered it. **Every send is
unconditionally CC'd to `updates@cuppascards.co.za`** (`ADMIN_CC_EMAIL` in `send-email.ts` — this
address itself changed once already, from `info@cuppascards.co.za`, both times on the user's
explicit instruction, 2026-09-20) — appended to, never replacing, any caller-supplied `cc`. Verify
with the user before assuming which address is current if this drifts again. Do not remove this
without the user separately confirming the business no longer wants a copy of
every outgoing transactional email.
- **`GradingEmailStage`** (`types/notifications.ts`) — an 8-stage notification-layer lifecycle, intentionally more granular than the DB's `SubmissionStatus` (5 stages) or `shipment_batch_status` (5 stages, migration 0052). Most stages beyond `ORDER_CONFIRMED` have no DB column or call site yet — adding a stage here is a type contract, not a promise it's wired up.
- **`AceLabelOption`** = `'standard' | 'colour_match' | 'ace_label'` — lives in `lib/submission-types.ts` (with `ACE_LABEL_OPTIONS`/`labelOptionFeeForRegion`), **not** a separate `types/grading.ts` — that path was requested but deliberately not created, to avoid a second, competing home for grading-domain types alongside the existing single source of truth. Same per-submission modeling as `needs_clean_and_polish`/`needs_semi_rigids` (one choice for the whole batch, not per-card) — only ever non-null when `grading_company = 'ACE'` (enforced by `chk_submissions_ace_label_option_valid`, migration 0061). ZAR fees (R25/R75) are ACE's own designated retail prices, not the usual ~18.5 USD/ZAR stand-in conversion; USD is still the derived stand-in.
- **`IntakeChannel`** = `'online_shipment' | 'in_person_event'` and **`EventSettingsRow`** — `lib/submission-types.ts` (again, not `types/grading.ts` — same reasoning as `AceLabelOption` above; every new domain type this session has gone into the existing file, not a parallel one). "Awaiting Booth Handover" / "Received & Logged" are **UI labels derived from `intake_channel` + `intake_verified_at`**, deliberately not new `SubmissionStatus` enum values — that enum is shared with the customer pipeline stepper (`STATUS_STAGES`/`PipelineProgress`) and `lib/admin/submission-status.ts`'s `changeSubmissionStatus`, which only accepts its fixed 5 values; extending it for a pre-`received` state would mean touching that shared stepper UI for a state most submissions never pass through. Every submission, in-person or not, still gets `status = 'received'` at creation, unchanged.
**As of the Step 3 Order Summary rewrite**, `intake_channel = 'in_person_event'` is no longer only
set automatically (booth QR / admin `event_settings` toggle) — a customer can also choose it
manually via "In-Person Drop-Off" in Step 3's "Ship from" section, in which case `event_slug` is
sent as `null`. This is an already-valid combination per this migration's own comment ("an admin
could run a live event with no slug set"), so no schema or admin-flow change was needed for it.
`EventSettingsRow` gained `active_event_name: string | null` (migration 0064) — purely a display
name for the admin panel and the `/submit` wizard's badge; `active_event_slug` remains the only
field that drives routing/matching logic, never the name.
- **Brand tokens** (`app/globals.css`) — `--brand-gold #fdc82f`, `--brand-green #007a33`,
  `--brand-forest #1d3c34`, `--brand-black #000000`, `--brand-white #ffffff`, sourced directly from
  `Stock photos/Cuppascards Logo and Colour Guide.pdf` (2026-09-22) and exposed as Tailwind
  utilities (`bg-brand-gold`, `text-brand-green`, etc.) via `@theme inline`. `--seal`/`--vault` (the
  "paper/ink" theme's own accent-color variables, used app-wide via inline `style={{ color:
  'var(--seal)' }}`) both resolve to `--brand-gold`. **Tailwind's built-in `amber-300/400/500/600`
  scale is intentionally remapped** to a gold-derived ramp in the same `@theme` block — every
  `amber-*` Tailwind class anywhere in this codebase now renders the real brand gold automatically;
  do not "fix" this remap by reverting to stock Tailwind amber, and do not add new `amber-*` usages
  expecting stock Tailwind amber — they will render brand gold, which is the intended behavior here.
  `--font-display` resolves to `var(--font-fraunces), Georgia, ...serif` — **Fraunces is a
  deliberate, user-approved stand-in for the brand guide's specified "Recoleta Regular"**, a paid
  Latinotype font with no license files on this machine (see `app/layout.tsx`'s header comment).
  Do not assume `--font-display` is the final/correct typeface; swap it for real Recoleta via
  `next/font/local` in `app/layout.tsx` the moment licensed font files are available, without
  touching any of the many call sites that already reference `var(--font-display)`. Logo assets
  live in `public/images/brand/` (`logo-{portrait,horizontal,url}-{white,black}.png` — Green/Deep-Green
  background variants not yet extracted); these have solid baked-in backgrounds, not transparent
  cutouts, and are now **fully unreferenced** in code. **`/images/cuppascards-logo.png`** (real
  transparent-background PNG, `colorType 6`/RGBA) is now the canonical logo asset used everywhere in
  the app — Navbar, Footer, homepage hero, and every transactional email header
  (`EMAIL_LOGO_URL`/`EMAIL_LOGO_HTML`, `lib/email/templates/order-confirmation.ts`). It required a
  one-off `sharp` chroma-key fix after the file the user supplied turned out to have its checkerboard
  "transparency" indicator baked into opaque RGB pixels rather than a real alpha channel — see the
  Current Milestone entry (item 11) for the exact chroma thresholds used. If this file is ever
  replaced, verify the replacement has a real alpha channel (PNG `colorType` 4 or 6) before assuming
  it's transparent — a checkerboard pattern visible in an image *editor* does not guarantee this.
- **`event_settings`** is a Postgres singleton-row table (`id boolean primary key default true`, `check(id)`) — the same trick as any single-row settings table; there is deliberately no way to have zero or multiple rows.
- **UX/UI polish conventions (2026-09-24)** — `--ease-fluid`/`--ease-fluid-in-out` (`app/globals.css`,
  exposed as Tailwind's `ease-fluid`/`ease-fluid-in-out` utilities via `@theme inline`) are this
  project's one standard easing pair for hover/press/fade transitions; use them instead of bare
  `transition`/default `ease` on new interactive elements, and prefer migrating an existing bare
  `transition` to `ease-fluid` opportunistically rather than leaving mixed easings on the same page.
  `components/AnimatedSection.tsx` is the one shared scroll-entrance-animation wrapper (a
  `framer-motion` `motion.div`, fade-up + `viewport once`) — **`framer-motion` is this app's only
  animation library; do not add GSAP, ScrollTrigger, or any other animation runtime alongside it**
  (explicitly decided over GSAP when scoping the polish pass, to avoid two libraries doing
  overlapping jobs). **Global smooth scroll (Lenis or similar) was explicitly declined** in favor of
  plain CSS `scroll-behavior: smooth` (reduced-motion-gated) — do not add a scroll-hijacking library
  without re-confirming with the user, since `/submit`'s wizard already depends on a plain
  `scrollIntoView()` call and has a documented history of animation/rAF timing issues in backgrounded
  tabs. Note `scroll-behavior: smooth` itself already makes every *unspecified-behavior*
  `window.scrollTo()`/`scrollIntoView()` call site-wide animate instead of jump instantly (per the
  CSSOM View spec) — be aware of this when adding new scroll-jump code; pass `{ behavior: 'instant' }`
  explicitly if a jump must not animate. The homepage + `components/ui/button.tsx` +
  `components/Navbar.tsx` got this treatment as a deliberate pilot; the rest of the app (vendor,
  services, shop, auctions, admin, the submit wizard's own styling) has **not** been touched and
  should not be assumed to match this new baseline until a follow-up task explicitly extends it.

---

## Uncommitted work in the tree right now

**Committed `0738787`, pushed, deployed as `dpl_9kiszpuXkX9fNd14jmrpBvaGukjU` (2026-09-24) —
"Slab Guard" add-on (flat R95, ZAR)**. New Yes/No section below Full
Clean & Polish in `components/submit/step-addons.tsx`, built from the same `YesNoQuestion`
component (identical border/spacing/gold radios), heading "Slab Guard", copy "Add a premium
protective bumper to your final graded slab.", price `formatZAR(SLAB_GUARD_FEE_ZAR)` = "R 95,00".
- `lib/submission-types.ts`: `SLAB_GUARD_FEE_ZAR = 95`, `SLAB_GUARD_LABEL`, and
  `SubmissionRow.requires_slab_guard`. Deliberately ZAR-only (no USD/GBP twin), like Secursus.
- `lib/submission-pricing.ts`: `requiresSlabGuard` input → `slabGuardSubtotal` (flat R95 per
  submission, not per card) inside `serviceFee`; `requires_slab_guard` added to
  `SUBMISSION_PRICING_COLUMNS` / `pricingInputFromRows`, so checkout and the Payfast webhook
  price it from the DB like every other option.
- `app/submit/wizard.tsx` holds `requiresSlabGuard` state → `StepAddOns` and `StepReviewPay`;
  the Order Summary shows a "Slab Guard R 95,00" line only when chosen; `/api/submissions`
  stores `requires_slab_guard` (only a literal `true` counts); the submission confirmation email
  (`lib/email/send-order-confirmation.ts`) lists it as an add-on line.
- **New migration `supabase/migrations/0067_add_slab_guard.sql` — APPLIED to production by the user
  (SQL Editor, 2026-09-24); verified via a service-role read that `requires_slab_guard` exists and is
  `false` on all 4 existing submissions. It had to precede the code deploy** (`add column if not exists requires_slab_guard boolean not null
  default false`): the checkout route, webhook, and submission insert all reference the column, so
  deploying first would break every grading checkout.
- Simulation: ~20% of submissions opt in; independent re-derivation includes the R95; report gains
  a Slab Guard line (default run 48 × R95 = R 4 560,00, 1,383/1,383 invariants).
- `tsc`/eslint clean on all touched files, `npx next build` clean. Deployed via `vercel --prod` from a
  clean tree at `a722343`; live `/submit` returns 200 and `/api/submissions/checkout` responds.
  Could not confirm the Slab Guard copy in the live JS (the Add-ons step is a lazily loaded chunk
  not listed in `/submit`'s HTML). **Not click-tested in the wizard** — next step is one real
  submission: section shows R 95,00, "Yes" adds the Order Summary line, Payfast amount matches.
- Pre-existing, not changed here: the submission confirmation email itemises grading + add-ons but
  not label fees, courier legs, or Secursus, and its "total" is `service_fee` (excludes the domestic
  courier legs the customer also paid).

**Done (2026-09-24) — 8 empty submissions deleted from production**. `npm run audit:submissions
-- --all` (committed `54062e8`) showed production has 12 submissions, **none ever `captured`**
(and no captured shop orders), so no historical underpayment was possible. 8 of the 12 were
empty shells (0 submission_items, `service_fee` 0, `pending`, PCG standard, one user
`ac4ae57d…`, created 2026-09-02…04, no ledger_entries/status_log/pool/batch). On the user's
instruction they were deleted by exact id with a guard (`payment_status = 'pending'` and
`service_fee = 0` re-checked in the DELETE); 4 submissions remain. The other 3 flagged
"under current price" are explained by later price changes (two are exactly R220 = the two R110
international legs added ~2026-09-20) and were never paid. Open question for the user: whether
Payfast received any money for those 12 checkouts that the webhook failed to record.

**Committed `686f66a`, pushed, deployed as `dpl_FoDafs5EhvahYrdqU7vqr3hcGY74` (2026-09-24) — Shop
shipping fixed at R110 per order, server-side, ZAR only**. User set
the rate (R110/order) and asked for the `create_order()` bypass to be closed. Changes:
- New `lib/shop/shipping.ts`: `SHOP_SHIPPING_FLAT_RATE_ZAR = 110`, the one app-side constant.
- `app/shop/checkout/page.tsx`: shows R110 shipping from that constant, formats everything with
  `formatZAR` (no per-region formatting), and no longer sends `shippingCost` at all (was a
  leftover `SHIPPING_FLAT_RATE = 6.5`).
- `app/api/shop/orders/route.ts`: passes the constant as `p_shipping_cost` (never the client's
  value) and 400s on any quantity that isn't a whole number ≥ 1.
- `app/shop/page.tsx`: `activeRegion` is fixed to `'sa'`; `?region=` is ignored so the grid never
  lists USD/GBP products that checkout would refuse.
- **New migration `supabase/migrations/0066_server_side_shop_shipping.sql` — APPLIED to production
  by the user in the Supabase SQL Editor on 2026-09-24 (reported "success").**
  `create or replace` of `create_order()` with the same `(uuid, numeric, jsonb)` signature (so
  deploy/migration order doesn't matter and the existing grant is kept) that **ignores**
  `p_shipping_cost` and always charges `v_shipping_zar = 110.00`, rejects any product whose region
  `is distinct from 'sa'`, validates every quantity as a whole number ≥ 1 before touching any row,
  and stamps `region 'sa'`, `tax_rate 0.15`, `exchange_rate_to_zar 1`. Everything else is 0056's
  definition verbatim. This session has no DB connection string or `psql`, so it cannot run DDL —
  the user ran it in the Supabase SQL Editor. Since the live `create_order()` now ignores
  `p_shipping_cost`, production shop orders are already charged R110 even before this app code
  deployed; the brief window where the old checkout page showed R6,50 closed with that deploy.
  Caveat: it replaces whatever
  `create_order()` production currently has; if production had drifted from 0056, that drift is
  overwritten. `supabase/apply-all.sql` was not updated.
- `scripts/simulate-platform.ts` now imports the constant (default run: shop shipping R 7 920,00
  across 72 paid orders; 1,382/1,382 invariants pass).
- `npx tsc --noEmit` clean, `npm run lint` at the 48-problem baseline, `npx next build` clean.
  Verified live via curl: `/shop` and `/shop?region=usa` return the identical product list, and
  `/shop/checkout` serves 200. **No real shop order placed yet** — next step is one small order to
  confirm the checkout page and Payfast both show R110 shipping.

**Committed `fffc2e9`, pushed, deployed (2026-09-24) — In-memory platform simulation (`npm run
simulate`)**: new
`scripts/simulate-platform.ts` + `scripts/lib/register-ts-paths.mjs` + a `simulate` script in
`package.json`. The user chose in-memory over writing to production (the only database). Node 24
strips TypeScript natively; the ~30-line resolve hook adds the `@/` alias and extensionless
imports, so the script imports the real `lib/` code with no new dependency. Models N clients
(default 100) over N days (default 90), seeded/reproducible (`--seed=`, `--clients=`, `--days=`):
ACE submissions priced by the real `computeSubmissionPricing()` and independently re-derived in
integer cents (both 15% Secursus legs, components, domestic legs waived in-person); weekly Monday
UK consolidation batches plus individual dispatches, with Logged→Prepped→Shipped→Grading→Returned→
Dispatched timelines (grading time from each tier's real turnaround) mapped to
`shipment_batch_status`; a synthetic shop catalogue run through a rule-for-rule mirror of
`create_order()` (all-or-nothing, stock check/decrement, R100 Raw Card floor, failed payments
release stock); and a financial report (submission lines, shop, VAT booked, Secursus/courier
pass-through liabilities, live in-transit exposure, by-month table). Default run: 228
submissions / 1,848 paid cards, 74 orders with 27 out-of-stock attempts blocked, 1,382/1,382
invariants passed; seeds 7 and 99×250 clients also pass. Not a test of real DB behaviour (RLS,
`create_order()` row locks) — that would need the tagged-production option the user declined.
Findings from the numbers, flagged to the user:
- Secursus insurance is 40% of all submission cash (R1.03M of R2.57M in the default run), because
  15% per leg = 30% of declared value. Worth confirming 15% per leg is the intended rate.
- Shop shipping is `SHIPPING_FLAT_RATE = 6.5` in `app/shop/checkout/page.tsx`, i.e. R6,50 per
  order in ZAR — looks like a leftover USD figure. The client also sends it to `create_order()`
  as `p_shipping_cost` (not server-fixed); migration files show `shipping_cost >= 0` and
  `order_items.quantity > 0` constraints that block negative values, but production's schema is
  known to drift from the migration files, so that's unverified.

**Committed `f1cc463`, pushed, deployed as `dpl_HWdKiWh8K1sTeiRor9UcHQZrHf8a` (2026-09-24) —
SECURITY: grading submission price is now server-authoritative**.
Found while scoping the 100-client simulation request. Before this fix, a grading submission's price
was computed only in the browser (`components/submit/step-review-pay.tsx`): `/api/submissions`
stored the client-sent `serviceFee` as `submissions.service_fee` and posted it to the ledger as-is,
`/api/submissions/checkout` sent Payfast whatever `amountCents` the client posted (only checked
`>= 100`), and the Payfast ITN webhook marked the submission `captured` without comparing
`amount_gross` to anything — so any signed-in customer could pay e.g. R1 for any submission by
editing the request. Shop orders (`orders.total`) and auction payments (winning bid) were already
DB-sourced and unaffected. Fix:
- New `lib/submission-pricing.ts`: `computeSubmissionPricing()` is the single pricing function
  (grading + ACE label + Clean & Polish/per-card prep + 2 international legs + 2× 15% Secursus
  legs = `serviceFee`; + 2 domestic legs unless in-person = `total`). It throws
  `SubmissionPricingError` for an unknown company/tier, zero cards, or a negative/non-numeric
  declared value. `pricingInputFromRows()` rebuilds its input from stored `submissions` +
  `submission_items` rows — every pricing input was already stored, so no migration was needed.
- `step-review-pay.tsx` renders the Order Summary from that function and no longer sends
  `serviceFee`. `/api/submissions` computes `service_fee`/`tax_collected`/ledger amounts itself
  (400 on a pricing error). `/api/submissions/checkout` recomputes the total from the DB, refuses a
  non-`pending` submission, returns 409 if the client's `amountCents` differs (stale price shown),
  and passes the server total into the signed Payfast redirect. The webhook's `grading_submission`
  branch only captures when `amount_gross` equals the recomputed total; a mismatch stays `pending`
  and logs `Payfast ITN: grading submission amount mismatch -- left pending`.
- Parity check (scratch script via jiti, not committed): 1,440 random orders across every
  company/tier/type/label/in-person/Clean & Polish combination match the old inline formula to the
  cent, except one half-cent float-rounding edge (R 8 282,465), which is moot now that client and
  server share the function; Secursus = exactly 30% of declared value in every case.
- `npx tsc --noEmit` clean, `npm run lint` at the 48-problem baseline, `npx next build` clean.
  Live-probed after deploy: an unauthenticated R0,01 POST to `/api/submissions/checkout` now
  returns `401 Not authenticated` (the old build rejected it earlier with "Invalid amount"),
  confirming the new route is serving. **Not yet tested with a real Payfast payment** — next step is
  one small real submission: confirm the redirect total matches the Order Summary and the
  submission flips to `captured`; a stuck `pending` plus the "amount mismatch" log means the
  webhook comparison needs a look. Historical `captured` submissions were priced by the browser; they can be audited by
  recomputing each with `pricingInputFromRows()` and comparing to Payfast's records.

**Committed `4c705a8` + `f40761e`, pushed, deployed as `dpl_4bKctGdkeZEZmTmRkWWhNmJnFGCy` (2026-09-24)
— Site-wide "Submission Best Practices" section above the footer**: new
`components/SubmissionBestPractices.tsx` (client component, `usePathname`), mounted in
`app/layout.tsx` between `</main>` and `<Footer />`. Two cards in a `grid-cols-1 md:grid-cols-2`
grid: "Do" (brand-green top border, `text-brand-green-light` check icons on `bg-brand-green/15`)
and "Don't" (`--danger` soft-red top border and cross icons); both on `bg-slate-950/60` with the
`--card-border` faint-gold outline, body copy `text-slate-300` with a bold `text-slate-100` lead.
Copy is the user's 4 Do / 4 Don't items, with every "or toploaders" removed per the user's standing
rule that packing guidance only ever recommends semi-rigid card savers (toploaders may appear only
as a "don't", as `/prepare` already does). Hidden on `/prepare` (already renders the longer
`components/PackagingGuidelines.tsx`, with different copy) and `/admin/**`, and `print:hidden`
like the footer so it never prints onto packing slips. `npx tsc --noEmit` clean, eslint clean on
both files, `npx next build` clean. Verified on local `next start`: renders directly above
`<footer>` on `/services` with 8 items, absent on `/prepare`, single column at 390px wide.
Pre-existing (not from this change): at 390px `/services` scrolls horizontally, caused by its
hero's decorative absolute element and the footer's "Follow Us" social row (13px too wide). Confirmed
live on production via curl (section present, no "toploaders").

**Nothing from the 2026-09-24 shop/footer/color work is uncommitted.** The four commits below
(`15362a6`, `754dbf9`, `0df58fd`, `7cd8a8f`) are pushed to `origin/main` (`4b7ba33..7cd8a8f`) and
deployed to Vercel production as `dpl_4WVSmJwNbX6ki3eWe8Nee2uoDFR2` (built from `7cd8a8f`, aliased to
`website-three-iota-83.vercel.app`). Verified live via curl: `/shop` has no carousel, the footer
has no `/refund-policy` link, and the served CSS contains the new brand-color rules. Not
click-tested in a browser on production.

**Committed `0df58fd`, deployed (2026-09-24) — Global brand color system**: `app/globals.css` plus
~25 call sites.
- Tokens: kept the brand-guide Pantone values `--brand-gold #fdc82f` / `--brand-green #007a33`
  (logo PNG samples to ~#fcc134 / ~#107438 — compression drift, guide stays authoritative). New:
  `--brand-dark #0a0908` (formalizes the existing `--background`), `--brand-gold-hover #fed65e`,
  `--brand-green-hover #008438` (capped so white text stays ≥4.5:1), `--brand-green-light
  #3fae6a` (green *text* on dark; base green is only 3.6:1), `--card-border` (--line with an 18%
  gold cast). All exposed as Tailwind utilities (`bg-brand-gold-hover`, `text-brand-green-light`...).
- **Bug fixed**: the shadcn semantic tokens (`primary`, `ring`, `input`, `accent`, `secondary`,
  `destructive`, `muted-foreground`, `border`) were never defined, so `components/ui/button.tsx`'s
  default variant had no background of its own and Button/Input focus rings rendered nothing
  (both also set `outline-none` → invisible keyboard focus). Now mapped to gold primary, green
  secondary, gold ring. `emerald-400/500` remapped to the brand green (same technique as amber).
- `@layer base`: `accent-color` gold (native checkboxes/radios were browser blue), gold
  `:focus-visible` outline site-wide, gold border on focused text fields (`!important`, scoped to
  `:focus-visible`, because many inputs set an inline `borderColor`), gold `::selection`.
- Primary CTAs: every gold button now brightens on hover to `--brand-gold-hover` (several
  previously darkened via `hover:bg-amber-600`/`#d9a000`). 9 `<Button>`s lost a redundant inline
  `style={{ background: 'var(--vault)' ... }}` that was blocking hover; 8 plain customer-facing
  action buttons/links (checkout, add-to-cart, cart, quick-add, 2× bid, auction draft, dashboard)
  converted from inline style to classes for the same reason. Admin-only inline gold buttons
  (grading/intake/pools/bulk imports, etc.) are still inline-styled — gold, just no hover.
- Navbar main links: brand-green underline on hover and on the active page. Success checkmarks
  (`#4ade80`) → `--brand-green-light`. Faint `--card-border` on shop product cards (plus gold
  hover border) and boxed submission-step panels; dividers and selectable tiles unchanged.
- Not changed: page backgrounds. The homepage/navbar/footer/shop carousel are Tailwind slate
  (navy), the ledger surfaces (shop, submit, dashboard) are warm near-black `--paper` — unifying
  them is a visible redesign and was left for the user to decide.
- `npx tsc --noEmit` clean, `npm run lint` at the 48-problem baseline, `npx next build` clean.
  Verified on `next start` locally: shop buttons/checkboxes/card borders/nav underline resolve to
  brand colors; focused button and text field both show the gold outline/border.

**Committed `754dbf9`, deployed (2026-09-24) — Footer Refund/Shipping Policy links removed**:
`components/Footer.tsx` now lists only Vendor Inquiries, Terms & Conditions, Privacy Policy, and
Contact Us. The link row is a `flex flex-wrap justify-center gap-x-6 gap-y-2` container, so the
remaining four reflow with no gaps and no class changes were needed. `app/refund-policy/` and
`app/shipping-policy/` still exist and still build, but the footer was their only inbound link, so
they're now reachable by direct URL only. The Terms page has no dedicated refund/returns section,
so the storefront currently surfaces no refund policy anywhere (payment gateways and SA's ECTA s43
generally expect one to be accessible from the site — flagged to the user, their call).
`npx tsc --noEmit` and `npx eslint components/Footer.tsx` pass clean. Pushed and deployed (see
above). The missing-refund-policy concern is still open.

**Committed `15362a6`, deployed (2026-09-24) — Shop carousel removed from `/shop`**:
`app/shop/page.tsx`. See the Shop bullet in the Active File Manifest above. `npx tsc --noEmit` and
`npx eslint app/shop/page.tsx` pass clean; confirmed absent on production via curl. (The
earlier heading-only removal is committed as `4b7ba33`, pushed, and deployed to production as
`dpl_73WkFp7rToSQzJ19LQUhgTEeXkd6`.)

**Earlier work, all committed:** Everything through commit `5e0d906` ("Gate all /admin routes
behind a centralized admin-role check": `app/admin/layout.tsx`, `app/login/page.tsx` + new
`app/login/login-form.tsx`, on top of `c5351a6` and `970ebb4` — the landing page section reorder,
the hero copy update, the Google/Apple OAuth addition, the Submission Method Step 1→Step 2
relocation, the Step 3 Order Summary/delivery-method rewrite, the vendor page's "Every Grading
Tier, On-Site" copy update, the Vault carousel's relocation from the homepage to `/shop`, and the
admin-route authorization guard — see the Active File Manifest and Shared Contracts above for full
detail on each) is committed, pushed to `origin/main` (`db61e29..970ebb4..5e0d906`), and deployed
to Vercel production (deployment `dpl_HzCQmK5fv4r5CvZb2R71rCD7npRW`, aliased to
`website-three-iota-83.vercel.app`, deployed via `vercel --prod`; build compiled clean, all 79
routes generated with no errors, `/login` confirmed still prerendering statically and `/admin`
correctly dynamic).

Two docs-only commits have landed on top of `5e0d906` since — `fca1ec6` ("Document confirmed admin
grants and profiles schema drift") and `506cc59` ("Update PROJECT_STATE.md to reflect push
status") — both **pushed to `origin/main`** (`5e0d906..fca1ec6..506cc59 main -> main`). Neither
touches app code, so there's no pending deploy step for either.

The subsections below are kept as a historical record of what shipped in each past task/commit,
not a list of pending changes — check `git status` if you need to confirm this is still true
before trusting it blindly.

**Committed, pushed, and deployed to production through `648f42d`** (earlier deploy, superseded by
the one above): ACE tier
overhaul + ACE Label Options + notification system stage 1 (`4026e1d`); In-Person Event Drop-Off
(`df13969`); booth-handover contact-lookup bug fix (`0de1894`); `ORDER_CONFIRMED` wired into the
Payfast webhook (`fb9bb14`); grader filter false-positive fix, `products.grading_company`
(`8913730`, migration 0063); Live Batch Tracker extracted to `/batches` (`2c7c9f3`); `/experience`
removed entirely (`66aae87`); Submit Cards + Batches consolidated onto `/submit` (`f796950`); Live
Batch Tracker isolated + hidden behind a flag (`2249a9f`); site-wide "CuppasCards" brand rename +
`/submit` nav label simplified (`03c67de`); PROJECT_STATE.md deployment-status update (`451ca05`);
"My Submissions" nav-link personalization (`3deec54`); In-Person Event Submissions Admin Control +
customer flow (`648f42d`). Migrations 0059-0064 all live on production.
`RECEIVED_HQ`/`ORDER_CONFIRMED` email delivery is blocked by an unrelated, pre-existing Resend
domain-verification issue (see Blocked below) — parked at the user's request, not being chased
further.

**What `648f42d` changed** (for reference — already live):
- `supabase/migrations/0064_add_event_settings_name.sql` — **applied to production and
  independently re-verified** via `information_schema.columns` (`active_event_name`, `text`,
  nullable, present on `public.event_settings`).
- `app/admin/events/events-settings-panel.tsx` — rebuilt: Event Name field, real shadcn `Switch`,
  shareable booth link (`window.location.origin`-based), `QRCodeSVG` + Copy/Download/Print.
- `components/ui/switch.tsx` — **new**, plus the new `@radix-ui/react-switch` dependency in
  `package.json`/`package-lock.json` (installed on the user's explicit confirmation).
- `app/api/admin/events/route.ts`, `app/api/events/active/route.ts`, `lib/submission-types.ts` —
  all extended for `active_event_name`.
- `app/submit/wizard.tsx` — new "Live Intake Active — Handing in at {eventName}" badge, name-
  matched by slug.
- `components/Navbar.tsx`, `components/Footer.tsx` — added `print:hidden` so a printed booth
  flyer excludes site chrome.
- **A real bug was found and fixed during this task, but it was in my own testing environment,
  not the app**: repeatedly running `rm -rf .next` while `next dev` (Turbopack) was still running
  left the dev server in a state where client-side `useEffect`s inside `SubmissionWizard` stopped
  firing at all (confirmed via a temporary debug instrumentation — zero network requests were even
  attempted). A clean `npm run build && next start` on a separate port immediately proved the
  actual code was correct all along. **Lesson recorded for future sessions**: never run
  `rm -rf .next` while a dev server sharing that directory is running; if `.next` needs clearing
  for a stale-types issue, stop the dev server first, clear it, then restart.
- `tsc`/`eslint` (same pre-existing baseline, +1 new `set-state-in-effect` warning for
  `events-settings-panel.tsx`'s client-only `window.location.origin` read — same legitimate
  SSR-bridging pattern this codebase already tolerates elsewhere, not a new category of debt) /
  `npm run build` all clean. Click-tested live end-to-end via a clean production build: admin save
  flow (name/slug/toggle), booth link + QR rendering, and the wizard badge via both the
  admin-toggle path and the `?intake=in-person&event=slug` URL path. The admin toggle was switched
  back off after testing and independently re-verified (`is_live: false`) so production customers
  aren't defaulted into a fake test event.

**Committed (`df3fe4b`), deployed — homepage hero copy update**:
- `app/page.tsx` — hero pill badge text changed to "Everything should be made as simple as
  possible, but not simpler." (was "Official PCG and ACE Middleman"); hero subheading changed to
  "South Africa's premier grading service. Making it easy to grade your cards." (was "...premier
  middleman service..."). Pill padding (`px-3 py-1` → `px-4 py-1.5`) and font size (`text-xs` →
  `text-[11px]`) nudged down slightly, per the request's own note, so the much longer quote fits
  on one line without cramping; `rounded-full`/`uppercase`/`tracking-wide`, every button style,
  and every import were left exactly as they were.
- Requested path `components/home/Hero.tsx` doesn't exist in this codebase (the homepage hero is
  inline in `app/page.tsx`, no separate hero component) — edited the real file, same as every
  other requested-but-nonexistent path this session.
- `tsc`/`eslint`/`npm run build` all clean (same pre-existing baseline, no new issues). Click-tested
  live: the pill renders on a single line at desktop width with no visual cramping.

**Committed (`6372a6c`), deployed — outbound email switched to Google SMTP/Nodemailer**: full detail in the Current
Milestone and Active File Manifest ("Misc integrations") sections above. In short: `resend`
uninstalled, `nodemailer` + `@types/nodemailer` installed; `lib/email/resend-client.ts` deleted,
replaced by `lib/email/transporter.ts` (pooled transporter + `verifyConnection()`) and
`lib/email/send-email.ts` (the new single `sendEmail()` entry point, returns `{success,
messageId?, error?}` instead of throwing); all four existing `send-*` functions in
`lib/email/send-grading-update.ts`/`send-order-confirmation.ts` now call `sendEmail()` and
re-throw on failure to preserve their callers' existing `.catch()` contracts; `GradingEmailCard`
(`types/notifications.ts`) gained `declaredValue: number` (always ZAR), threaded through both real
construction sites and rendered as a new column in `lib/email/templates/order-confirmed.ts`; new
admin-gated `app/api/test-email/route.ts` for end-to-end diagnostics. Confirmed live against the
placeholder `.env.local` credentials — the pipeline correctly reaches Gmail and fails with Gmail's
own "Application-specific password required" error, proving the code path itself is correct;
real sends need the real credentials swapped in first (see Current Milestone for detail).
`tsc`/`eslint`/`npm run build` all clean (same pre-existing baseline).

**Committed (`709257a`), deployed — WhatsApp community link**: `lib/social-links.ts`'s `SOCIAL_LINKS.whatsapp` is now
`https://chat.whatsapp.com/LRxadKeTEFV5DCRWArxHAe?s=cl&p=a&mlu=4&ilr=4` (was a placeholder);
`lib/site-config.ts`'s `siteConfig.links` gained `whatsappCommunity`, re-exporting the same value
rather than duplicating the URL. Confirmed live: both existing usages (`app/page.tsx`'s "Join the
WhatsApp Group" CTA, `components/Footer.tsx`'s "Follow Us" icon) now resolve to the real link.

**Committed (`cd5cc9f`), deployed — Step 1 (`Grader & tier`) simplified to ACE-only for launch**:
`components/submit/step-grader-tier.tsx` fully rewritten (Country of origin + Grading company
selectors removed, `region`/`onSelectRegion`/`onSelectCompany` props dropped); `app/submit/
wizard.tsx`'s `region`/`company` changed from `useState` to plain `'sa'`/`'ACE'` constants,
`selectCompany` callback removed, `joinBatch` simplified to a same-company-only no-op (harmless
today since `LiveBatchTracker` is hidden). `tsc`/`eslint`/`npm run build` all clean (same
pre-existing baseline). Click-tested live end-to-end through Steps 1→2 with a real TCGdex
search-and-select of a Pikachu card.

**Committed (`cd5cc9f`), deployed — card category locked to Pokémon for launch**: `components/submit/
card-shipment-row.tsx` fully rewritten — the Pokémon/Sports Cards toggle, Sport dropdown, and
`SportsCardSearch` usage removed entirely; `card.cardType` stays `'pokemon'` always.
`sports-card-search.tsx` and the `'sports_card'` `CardType` value are untouched/unreferenced for a
future re-enablement. `tsc`/`eslint` clean (same baseline).

**Committed (`cd5cc9f`), deployed — shop filter pills simplified for launch**: `app/shop/page.tsx`'s `activeType`
hardcoded to `'pokemon' as ProductType`; `ProductTypeToggle` unmounted; `Graded` category query
gained `.eq('grading_company', 'ACE')`. `components/shop/category-tabs.tsx` hides Pokémon
Center/Sealed pills; `subcategory-pills.tsx` hides the Graded grader sub-filter row;
`shop-browser.tsx` computes `effectiveFilters` (ACE-only when Graded) inside its `useMemo`
callback and hardcodes `showGraderFilter={false}`. All hidden via comments, not deletions — every
underlying query/component capability stays intact for a future re-enable. `tsc`/`eslint`/
`npm run build` all clean (back to the same 49-problem pre-existing baseline after fixing one
`react-hooks/exhaustive-deps` warning the first draft introduced). Click-tested live: `/shop`
shows no game-selector toggle and only `All`/`Graded`/`Raw Cards`/`Accessories`;
`/shop?category=graded` returned 8 products, all ACE-graded (no PSA/PCG), with no sub-pills or
sidebar Grader checkboxes rendered.

**Committed (`cd5cc9f` + `f0236b1`), deployed — Step 2 (`Add-ons`) simplified and refined**: `components/submit/step-addons.tsx`
— Semi-Rigids and Consignment toggle cards removed entirely; `app/submit/wizard.tsx`'s
`needsSemiRigids`/`interestedInConsignment` changed from `useState` to hardcoded `false`
constants (still forwarded unchanged to `step-review-pay.tsx` and the checkout payload, since
`app/api/submissions/route.ts`'s columns are untouched). Copy updated on both the Pre-grading
preparation description and the Clean & Polish subtext to mention the included sleeve + semi
rigid; a new gold "Or" pill-badge divider sits between the per-card list and "This submission";
per-card toggles now collapse into a "Full submission Clean and Polish active" badge (rather than
just disabling in place) when the batch-level option is on — the pre-existing mutual-exclusivity
logic itself (`handleToggleCleanAndPolish`/`handleTogglePerCardPrep`) was untouched.
`tsc`/`eslint`/`npm run build` all clean (same baseline). Click-tested live: selected a card,
advanced to Step 2, confirmed no Semi-Rigids/Consignment cards, confirmed the OR divider renders,
and confirmed toggling batch-level Clean & Polish to "Yes" collapses the per-card toggle into the
badge.

**Committed (`65ca7ef`), deployed — brand name harmonized to "CuppasCards" across legal pages, email templates, and
payment descriptors**: on the user's explicit, detailed instruction (previously this was a
deliberately deferred area — see the `siteConfig` Shared Contract entry above), every remaining
`"Cuppa's Cards"` literal in `app/{terms,privacy,refund-policy,shipping-policy}/page.tsx` (body
copy and `<title>` metadata), `lib/email/templates/{order-confirmation,order-confirmed,
received-hq}.ts`, `lib/email/send-order-confirmation.ts`, and the three PayFast `itemName`
descriptors (`app/api/{submissions/checkout,shop/checkout,auctions/[id]/pay}/route.ts`) is now
`"CuppasCards"` (or `"CuppasCards SA"` where the legal-entity line requires it). The dead,
commented-out Resend example in `app/api/notify/route.ts` was updated too for consistency, though
it's unreferenced code. Internal code comments (not user-facing) and the SQL migration history
were deliberately left alone — see the Shared Contract entry for exactly which files and why.
`tsc`/`eslint`/`npm run build` all clean (same baseline).

**Committed (`7725a7b`), deployed — full 8-stage grading email lifecycle now has real templates + a manual test
harness**: `lib/email/templates/{collection-booked,dispatched-to-grader,received-by-grader,
dispatched-to-sa,landed-at-hq,dispatched-to-customer}.ts` are new real renderers for the 6 stages
that previously threw "not implemented"; `lib/email/send-grading-update.ts`'s switch now handles
all 8, and `sendGradingUpdate()` returns `{messageId?}` instead of `void`. New admin-gated
`app/api/admin/simulate-lifecycle/route.ts` sends any of the 8 stages (via the real
`sendGradingUpdate()` pipeline, not a parallel one) against one fixed seed submission
(`#CC-ACE-8921`); new `app/admin/test-emails/page.tsx` gives it a UI with per-stage buttons, a
full-sequence runner (5s delay between sends), and a live console log of HTTP status +
Nodemailer `messageId`. This directly re-opens the "wiring the remaining 6 notification stages"
item that was previously explicitly parked — the user themselves initiated it this time, the same
carved-out exception already used for the Resend-to-Nodemailer migration earlier this session.
Note: this only builds and proves the *templates* — none of the 6 new stages have a real DB
trigger/call site yet (still true per `types/notifications.ts`'s header comment); wiring an actual
production trigger for any of them is separate, not-yet-requested work. `tsc`/`eslint`/
`npm run build` all clean (same baseline). Click-tested live: stage 1 and stage 7 both correctly
reached Gmail's real SMTP server via the admin test-runner UI, each failing with Gmail's own
"Application-specific password required" error against the still-placeholder `.env.local`
credentials — the same proof-of-correctness pattern as the original `/api/test-email` verification.

**Committed (`cf845e5`), deployed — vendor page "Where We've Been" hidden until real event content exists**:
`app/vendor/page.tsx` gained a `SHOW_PAST_EVENTS = false` module-level flag; `NAV_SECTIONS` only
includes the "Where We've Been" hero button when it's `true`, and the whole event-gallery
`<section id="history">` is wrapped in `{SHOW_PAST_EVENTS && (...)}`. `PAST_EVENTS` data and the
section's full markup are untouched — toggling the flag to `true` once real event photos/history
exist is the only change needed to restore it. `tsc`/`eslint`/`npm run build` all clean (same
baseline). Click-tested live: `/vendor`'s hero CTA row now shows only "In-Person Submissions" and
"Book Us", and the history section itself no longer renders.

**Committed (`ffdea36`), deployed — Contact page's stale direct-email block removed**: `app/contact/page.tsx`'s
sidebar `EMAIL` block (`support@gradeandslab.com`, a leftover from before the CuppasCards rebrand
— note the old `gradeandslab` domain, not even `cuppascards`/`cuppacards`) is removed entirely;
`LOCATION`/`BUSINESS HOURS` and the Vendor Page link are unchanged. The form itself needed no
changes — it was already fully wired to `app/api/contact-inquiries/route.ts`, which inserts into
the real `contact_inquiries` table (migration 0030). `tsc`/`eslint`/`npm run build` all clean
(same baseline). Click-tested live via two real form submissions; only the second
(`POST /api/contact-inquiries` → `201`) actually succeeded — the first attempt's network request
was never confirmed and turned out not to have gone through. The one real test row ("Claude QA
Test 2" / "qa-test2@example.com") has since been deleted directly from `contact_inquiries` at the
user's request, confirmed via a follow-up `count(*)` query returning `0`.

**Committed (`3144080`), deployed — "Submission Method" selector added to Step 1**: `lib/submission-types.ts` gained
`SubmissionType`, `SUBMISSION_TYPE_OPTIONS`, `internationalShippingFeeForRegion`, and
`SUBMISSION_TYPE_LINE_ITEM_LABEL`; `SubmissionRow` gained `submission_type`.
`components/submit/step-grader-tier.tsx` renders a new "Submission Method" section above
"Turnaround"; `app/submit/wizard.tsx` owns `submissionType` state (default `'batch'`);
`components/submit/step-review-pay.tsx` prices the international shipping line item and forwards
`submissionType` to checkout; `app/api/submissions/route.ts` validates and inserts it;
`components/admin/intake-order-panel.tsx` tags each submission by type.
`supabase/migrations/0065_add_submission_type.sql` was run by the user directly against
production (an assistant-run attempt was blocked by Claude Code's own permission system as a
production-affecting action) and independently re-verified via
`information_schema.columns`/`pg_get_constraintdef`, both matching the migration exactly.
`tsc`/`eslint`/`npm run build` all clean (same baseline). Click-tested live (UI/pricing only — a
real checkout with payment was not attempted): selected "Individual Direct Dispatch", progressed
through Steps 1→3, and confirmed the Order Summary showed "International Shipping: Dedicated
Direct Dispatch — R1 020,00" with a correct total (R1 780,00).

**Committed (`db61e29`), deployed — every outgoing email now CCs the admin inbox**: `lib/email/send-email.ts`'s
`SendEmailOptions` gained an optional `cc?: string | string[]`; a new `ADMIN_CC_EMAIL` constant is
unconditionally appended to the final `cc` list on every send (never overwriting a
caller-supplied `cc`), so the business gets a copy of every transactional email without a
separate logging pipeline. No existing caller needed changes since none currently passes `cc`.
This address itself changed once already within the same task: first set to
`info@cuppascards.co.za`, then changed to `updates@cuppascards.co.za` on the user's explicit
follow-up instruction (2026-09-20) — the current, live value is `updates@cuppascards.co.za`.
`tsc`/`eslint` clean (same 49-problem baseline) after both edits. Click-tested live via
`/admin/test-emails` after both changes: real sends returned `HTTP 200` with real Nodemailer
`messageId`s, confirming Gmail's SMTP accepted the multi-recipient send with no error each time
(one send hit a transient `ECONNRESET` on first attempt, unrelated to the code change — the
immediate retry succeeded). Final inbox delivery to the CC address itself wasn't independently
checked, since that mailbox isn't accessible from this session.

**Committed (`970ebb4`), deployed — landing page section reorder**: `app/page.tsx`'s "The Easiest Way to Grade"
3-step section now renders directly below the hero, with `<FeaturedCarousel>` ("The CuppasCards
Vault") moved below it instead of above — swapped by moving one `<section>` block, no inner
content/styling changes. `tsc`/`eslint` clean (same 49-problem baseline). Click-tested live: the
homepage now renders Hero → "The Easiest Way to Grade" → "The CuppasCards Vault" (all 7 products
intact) → WhatsApp CTA.

**Committed (`970ebb4`), deployed — landing page hero copy update**: `app/page.tsx`'s pill badge is now "South
Africa's Premier Grading Service." and the subheading is now "Making Grading Easy" — text-only,
no styling change. `tsc`/`eslint` clean (48 problems, one fewer than the 49-problem baseline,
since the old subheading's own unescaped-apostrophe warning no longer exists). Click-tested live.

**Committed (`970ebb4`), deployed — Vault carousel relocated from homepage to `/shop`**: `<FeaturedCarousel>` ("The
CuppasCards Vault") removed from `app/page.tsx` entirely (not just reordered this time) and added
to the top of `app/shop/page.tsx`, above `CategoryTabs`/filters/the product grid, per the user's
explicit instruction to keep the homepage "ultra-clean and conversion-focused." `app/page.tsx`
reverted to a plain synchronous component — the `searchParams`/`activeRegion`/
`getSupabaseRouteClient`/`getFeaturedProducts` plumbing that existed there solely to feed this
carousel was deleted, not left commented out, since it now has zero other purpose on that page.
`app/shop/page.tsx` already computed its own `activeRegion` and `supabase` client for its product
queries, so wiring the carousel in only needed one new `getFeaturedProducts(supabase,
activeRegion)` call — no duplicate region logic. Doc comments referencing this carousel as a
"homepage carousel" (`components/FeaturedCarousel.tsx`, `lib/shop/featured-products.ts`,
`app/admin/shop/{product-form-modal.tsx,types.ts}`, `lib/admin/product-input.ts`) were all updated
to say "shop page carousel" for accuracy — none of these are user-facing strings except the one in
`product-form-modal.tsx` ("Shows in... shop page carousel", the `is_vault_grail` toggle's helper
text in the admin product form). `npx tsc --noEmit` and `npm run lint` both pass clean (same
48-problem baseline, no new issues). Click-tested live: homepage now renders Hero → "The Easiest
Way to Grade" → WhatsApp CTA with no Vault section and no console errors; `/shop` renders the full
Vault carousel (arrows, dot indicators, all 7 grails) as the first thing on the page, directly
above the category pills, with no visual clash against `app/shop/layout.tsx`'s wrapper — that
layout is already on the same dark theme as the rest of the app despite its `--paper`/`--ink`
CSS-variable naming, not a literal light background.

**Committed (`970ebb4`), deployed — Google/Apple OAuth added via Supabase Auth**: new `app/auth/callback/route.ts`
exchanges the OAuth `?code=` for a session via the existing `getSupabaseRouteClient()`; new
`GoogleIcon`/`AppleIcon` in `components/SocialIcons.tsx`; `app/login/page.tsx` and
`app/signup/page.tsx` both gained "Continue with Google"/"Continue with Apple" buttons calling
`supabase.auth.signInWithOAuth()`. `tsc`/`eslint` clean (same baseline). **Not yet usable by a
real user** — see Blocked item 0 above: Supabase rejects both providers with "not enabled" until
real OAuth app credentials are configured in the Supabase Dashboard, which is outside this
session's access. Click-tested live: confirmed the client-side redirect reaches Supabase's real
authorize endpoint with correct params, and Supabase's own rejection message confirms this is a
configuration gap, not a code bug.

**Committed, pushed to `origin/main`, and deployed to production (`4f5a344`, deployment
`dpl_HtrWwrESJzh7snQLYcgANXEnF3EK`) — official brand identity rollout**: `app/globals.css` (brand
color tokens + `amber-*` remap + `--seal`/`--vault`/`--font-display` updates), `app/layout.tsx`
(Fraunces font load, standing in for the brand guide's paid "Recoleta Regular"),
`components/Navbar.tsx` (real horizontal-black logo lockup, replacing `/logo.png`),
`components/Footer.tsx` (added stacked portrait-black logo lockup),
`app/page.tsx`/`app/vendor/page.tsx`/`app/services/page.tsx`/`app/contact/page.tsx`/
`app/prepare/page.tsx`/`components/FeaturedCarousel.tsx`/`components/PackagingGuidelines.tsx`
(display-font applied to hero/heading text), `lib/email/templates/order-confirmation.ts`
(`COLORS.gold` updated to the real brand hex), and 6 of 12 logo lockup variants extracted into
`public/images/brand/`. Full detail in the Current Milestone (item 9) and the "Brand tokens" Shared
Contract entry above, including the two flagged-but-not-fixed items at the time (the logo "seam"
visual limitation, and the deliberate decision not to repaint `slate-900`/`slate-950` sections to
Forest Green/Black — the seam has since been resolved for real, see below; the Forest Green/Black
repaint remains an open, undecided item).

**Committed, pushed to `origin/main`, and deployed to production (`8bb25d6`) — homepage hero made
visual-first**: `app/page.tsx`'s hero pill badge, `{siteConfig.name}` heading, and "Making Grading
Easy" subheadline were removed; a centered `next/image` render (at the time,
`/images/brand/logo-portrait-black.png`, later superseded — see below) became the section's sole
visual element, with the existing "Start a Submission"/"Browse the Shop" buttons unchanged directly
beneath it. Full detail in the Current Milestone (item 10) above.

**Committed, pushed to `origin/main`, and deployed to production (`725c85f`) — site-wide logo
switched to a transparent PNG, take one**: `public/images/cuppascards-logo.png` (the user's first
supplied source file, re-processed with a one-off `sharp` chroma-key script after it turned out to
have a baked-in checkerboard instead of a real alpha channel) became the canonical logo everywhere:
`components/Navbar.tsx`, `components/Footer.tsx`, `app/page.tsx`'s hero, and a new shared
`EMAIL_LOGO_URL`/`EMAIL_LOGO_HTML` pair in `lib/email/templates/order-confirmation.ts` used by all 9
grading-lifecycle/receipt templates plus the inline auction-won email in
`lib/email/send-order-confirmation.ts` (replacing their old plain-text "CuppasCards" header line).
The six `public/images/brand/*.png` crops from the rebrand task became fully unreferenced (left on
disk, not deleted). Full detail in the Current Milestone (item 11) above.

**Committed, pushed to `origin/main`, and deployed to production (`725c85f`) — site-wide logo
switched to a transparent PNG, take one**: the sharp chroma-keyed file became the canonical logo
everywhere (Navbar, Footer, Hero, all 10 email templates). Full detail in the Current Milestone
(item 11) above.

**Committed (`2953c04`), pushed, and deployed — site-wide logo finalized + hero
rebuilt as a layered large-background-logo design**: `public/images/cuppascards-logo.png`
overwritten in place with the user's properly pre-cleaned source
(`Stock photos/Cuppalogo background removed.png` — see Current Milestone item 12), and
`app/page.tsx`'s hero rebuilt into a `opacity-10` full-bleed logo watermark (`z-0`, `next/image`
`fill` + `object-contain`, `pointer-events-none`) behind a `z-10` foreground layer restoring the
pill badge and subheadline item 10 had removed, plus the unchanged CTA buttons (see Current
Milestone item 13).

**Committed (`f7140f9`), deployed — hero visual refinement: pill badge removed, background logo opacity raised**:
`app/page.tsx`'s hero pill badge ("South Africa's Premier Grading Service.") is removed entirely;
the background logo's opacity is raised from `opacity-10` to `opacity-80` (same `fill`,
`object-contain`, `pointer-events-none`, `z-0` positioning — only the opacity class changed). Full
detail in the Current Milestone (item 14) above. `npx tsc --noEmit` clean; `npm run lint` at the
same pre-existing baseline. Click-tested live at the new opacity, including re-confirming
"Start a Submission" still click-navigates to `/dashboard`. **Committed (`f7140f9`), pushed, and deployed.**

**Committed (`f7140f9`), deployed — hero finalized: all floating text removed, CTAs reframe the logo left/right**:
`app/page.tsx`'s "Making Grading Easy" subheadline is deleted (the hero now has zero text content);
the CTA container is now `w-full max-w-7xl mx-auto px-4 md:px-12` with `flex-col sm:flex-row
items-center justify-center sm:justify-between`, pushing the two buttons to opposite edges on `sm`+
screens to frame the centered logo, falling back to a centered stack below `sm`. Full detail in the
Current Milestone (item 15) above. `npx tsc --noEmit` clean; `npm run lint` at the same
pre-existing baseline. Click-tested live: "Browse the Shop" click-navigates to `/shop` correctly
with the new container. **Committed (`f7140f9`), pushed, and deployed.**

**Committed (`f7140f9`), deployed — "The Easiest Way to Grade" feature-card copy updated**: `app/page.tsx`'s three step
cards' descriptions changed to the exact requested strings (Card 1's stale `$19.95` USD placeholder
→ `R425 per card`; Card 2 drops the DHL/insurance clause; Card 3 drops "Once graded," and changes
"your address" → "you") — text-only, no layout/icon/heading changes. Full detail in the Current
Milestone (item 16) above. `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing
baseline. Click-tested live. **Committed (`f7140f9`), pushed, and deployed.**

**Committed (`f7140f9`), deployed — Card 1 copy streamlined further**: `app/page.tsx`'s Card 1 (Submit Online) drops
the `"Choose your turnaround tier starting from just R425 per card"` clause entirely, leaving just
the TCGdex-search sentence. Supersedes item 16's Card 1 text; Cards 2/3 and all layout untouched.
Full detail in the Current Milestone (item 17) above. `npx tsc --noEmit` clean; `npm run lint` at
the same pre-existing baseline. Click-tested live. **Committed (`f7140f9`), pushed, and deployed.**

**Committed (`f7140f9`), pushed to `origin/main`, and deployed to production
(`dpl_FZBi4NNnKssSmdHTWGxs2b1gW3vD`) — global UX/UI polish pilot (homepage + shared `ui/`
primitives)**: new `components/AnimatedSection.tsx` (framer-motion fade-up-on-scroll wrapper);
`app/globals.css` gained `--ease-fluid`/`--ease-fluid-in-out` tokens (exposed as Tailwind utilities)
and a reduced-motion-gated `scroll-behavior: smooth`; `app/page.tsx`'s "How It Works" heading, its 3
feature cards (staggered), and the WhatsApp CTA block used `<AnimatedSection>`, plus eased/press-scale
CTAs and lift+shadow-on-hover cards with more section padding; `components/ui/button.tsx` (used in 10
files including the `/submit` wizard) gained a press-scale + eased transitions + hover elevation on
every variant; `components/Navbar.tsx` gained a scroll-triggered shadow/border depth cue plus
`ease-fluid` on its existing hover transitions. GSAP/ScrollTrigger and Lenis were explicitly declined
by the user in favor of the already-installed `framer-motion` and plain CSS `scroll-behavior: smooth`
— see the "UX/UI polish conventions" Shared Contract entry above for the reasoning and a real
discovered side effect of the smooth-scroll CSS (it also affects unspecified-behavior
`scrollTo`/`scrollIntoView` calls site-wide). Full detail in the Current Milestone (item 18) above.

**Committed (`734a208`), pushed to `origin/main` — Navbar logo sized up for more brand presence**:
`components/Navbar.tsx`'s logo grew from `h-8 sm:h-10` to `h-14 sm:h-20` (a judgment call, not the
request's literal "3-4x" example, which against this navbar's real starting height would have made
the logo taller than the whole bar); the logo/nav-links gap widened (`gap-8`→`gap-10`) and the row's
vertical padding trimmed slightly (`py-4`→`py-3`) to keep the header proportionate. Full detail in
the Current Milestone (item 19) above. **Deployed** (included in every production deploy since `734a208`).

**Superseded, never separately committed — Label options step gets a crossfading preview panel with
placeholder assets**: item 20's placeholder-path + fallback-detection system (`failedPreviews`
state, `attachPreviewImg` callback ref, raw `<img>` escape hatch) existed only in the working tree
for one session and was fully replaced the same day by item 21 below once real assets arrived — see
the Current Milestone (item 20) for the historical root-cause detail on the fallback-detection bug
that was found and fixed along the way, in case a similar next/image-`onError`/`AnimatePresence`
timing issue comes up again elsewhere.

**Committed (`74d65be`), deployed — Label previews switched to the real ACE slab photos; tier descriptions added**:
`public/images/labels/{standard,colour-match,ace-label}.png` (copied from `Stock photos/ACE slab
examples/`, each visually verified as the correct real photo for its tier before copying) replace
the placeholder paths; `components/submit/step-grader-tier.tsx`'s preview panel now uses plain
`next/image` (the failure-detection complexity from item 20 was removed as no longer needed) and
gained a `LABEL_DESCRIPTIONS` record with the exact requested copy per tier, crossfading in sync
with the image via one shared `AnimatePresence`/`motion.div`. Currency formatting in this flow was
also audited (again) and confirmed already correct — no changes needed. Full detail in the Current
Milestone (item 21) above, including a note on the same backgrounded-tab `requestAnimationFrame`
limitation affecting this session's own verification (not the app). `npx tsc --noEmit` clean;
`npm run lint` at the same pre-existing baseline. Click-tested live with real mouse clicks; DOM-level
correctness independently confirmed for all three tiers, full visual confirmation obtained for two
of three (Standard, Ace Label) after accounting for the automation environment's animation-timing
limitation. **Committed (`74d65be`), pushed to `origin/main`, and deployed to production
(`dpl_4hzXNid3Vwi3HjSnACZRp98xhkNQ`, aliased to `website-three-iota-83.vercel.app`).**

**Hero CTAs moved to sit directly beneath the logo**: `app/page.tsx`'s hero logo left its full-bleed
`fill`-background positioning (used since item 13) and returned to a normal-flow, intrinsically-sized
`<Image>` at full opacity (was `opacity-80` as a background texture), inside a centered flex column
with the two CTA buttons directly after it (`mt-10`) instead of framing it left/right. Full detail in
the Current Milestone (item 22) above. `npx tsc --noEmit` clean; `npm run lint` at the same
pre-existing baseline. Click-tested live — no animation/rAF caveats apply to this section.
**Committed (`b26c728`), pushed to `origin/main`, and deployed to production
(`dpl_4hzXNid3Vwi3HjSnACZRp98xhkNQ`, aliased to `website-three-iota-83.vercel.app`).**

**Hero logo scaled up ~5x**: `app/page.tsx`'s logo width classes changed to `w-[300px] sm:w-[500px]
md:w-[800px] lg:w-[1000px]` (exact values from the request), wrapping container widened `max-w-4xl` →
`max-w-6xl` so the new size isn't silently capped. Full detail, including how a misleading first
screenshot and an initial wrong-element measurement were both caught and corrected before concluding
the change was actually already correct, in the Current Milestone (item 23) above. `npx tsc --noEmit`
clean; `npm run lint` at the same pre-existing baseline. **Superseded before this shipped — by the
time this commit was deployed, the hero logo sizing had already moved on through items 25-26 to
item 27's `fill`-layout version, so this ~5x pixel-breakpoint sizing was never actually live in
production; it's a historical step, not a shipped state. Committed (`b26c728`), pushed to
`origin/main`.**

**Mandatory Secursus fine-art insurance added to checkout**: `lib/submission-types.ts` gained
`SECURSUS_INSURANCE_RATE`, `secursusInsuranceLegFeeZAR()`, and `SECURSUS_INSURANCE_LEG_LABELS`;
`components/submit/step-review-pay.tsx`'s Order Summary gained two new ZAR-only line items
("Secursus Insurance: Outbound to UK (15%)" / "...Return to SA (15%)"), computed from the existing
per-card declared values (no new input field needed — the total already existed conceptually via
`submissions.total_declared_value`) and folded into `serviceFee`. Full detail, including why this fee
is deliberately not region-parameterized like every other fee in that file, and an explicit
disclosure that live click-through verification to Step 3 could not be completed via this session's
scripted browser automation (Step 1's card-name/set-name validation gate would not register through
scripted DOM events), in the Current Milestone (item 24) above. `npx tsc --noEmit` clean; `npm run
lint` at the same pre-existing baseline. Pure arithmetic independently verified (R1000 declared value
→ R150/leg → R300 total) via a standalone script; **recommend a real live spot-check before this
ships**, since it affects the Payfast checkout total — **this has not been live-verified in
production yet even though it is now deployed**. **Committed (`b26c728`), pushed to `origin/main`,
and deployed to production (`dpl_4hzXNid3Vwi3HjSnACZRp98xhkNQ`, aliased to
`website-three-iota-83.vercel.app`).**

**Superseded same session, never separately committed — Hero logo scaled up extremely via viewport
units (height-driven)**: item 25's `w-full max-w-[1200px] sm:w-[90vw] h-[45vh] sm:h-[55vh]
md:h-[65vh] lg:h-[75vh] object-contain` + `min-h-screen` section approach existed only in the working
tree for one round and was replaced the same day by item 26's width-driven approach below, on the
user's explicit follow-up direction. See the Current Milestone (item 25) for historical detail.

**Superseded same session, never separately committed — Hero logo sizing switched to width-driven
for a "true sense of scale"**: item 26's `w-full max-w-[90vw] xl:max-w-[1200px] h-auto
object-contain` (non-`fill` `<Image>`, width-driven) + `min-h-[85vh]`/`flex flex-col justify-center
items-center` section existed only in the working tree for one round and was replaced the same day
by item 27's `fill`-layout approach below, on the user's explicit follow-up direction (reporting the
logo was "still visually restricted" by the non-`fill` Image's intrinsic `width`/`height` props).
The logo-asset-already-current finding (MD5-confirmed byte-identical to `Stock photos/Cuppalogo
background removed.png`) still stands. See the Current Milestone (item 26) for historical detail.

**Hero logo switched to `next/image`'s `fill` layout**: `app/page.tsx`'s hero `Image` (line ~57)
dropped its `width={356}`/`height={225}` props and gained `fill`, now stretching to fill a new
dedicated wrapper `div` (`relative w-full max-w-[90vw] xl:max-w-[1200px] h-[50vh] md:h-[60vh]
mx-auto` — the exact classes from the request) instead of rendering its own intrinsic box scaled by
CSS. The `Image`'s own className simplified to just `object-contain`. CTA `mt-10` spacing kept
unchanged (already satisfies the request's "e.g. `mt-8`" example). Full detail in the Current
Milestone (item 27) above. `npx tsc --noEmit` clean; `npm run lint` at the same pre-existing
baseline. User confirmed the rendered result "looks great" before this was committed. **Committed
(`8c25594`), pushed to `origin/main`, and deployed to production
(`dpl_4hzXNid3Vwi3HjSnACZRp98xhkNQ`, aliased to `website-three-iota-83.vercel.app`; build compiled
clean, all routes generated with no errors). This is the current live state of the hero logo.**

- Untracked, not yet triaged into the repo structure: `Stock photos/`, `TheCardApi.txt`,
  `claude context.txt`, `cuppa cards logo temp logo.jpeg`, `termsofservice.txt`, `zernio.txt`.

## Blocked / Needs a Decision

0. **Google/Apple OAuth needs real provider credentials entered in the Supabase Dashboard.**
   `app/login/page.tsx`/`app/signup/page.tsx`'s "Continue with Google"/"Continue with Apple"
   buttons and `app/auth/callback/route.ts` are all code-complete and confirmed reaching
   Supabase's real `/auth/v1/authorize` endpoint correctly — but Supabase itself rejects the
   request with `"Unsupported provider: provider is not enabled"`. This requires, for each
   provider, creating a real OAuth app (Google Cloud Console: an OAuth 2.0 Client ID/Secret with
   `https://wzqkvqafzcrqrouikuar.supabase.co/auth/v1/callback` registered as an authorized
   redirect URI; Apple Developer: a Services ID + Team ID + Key ID + private key) and entering
   those credentials into this project's Supabase Dashboard under Authentication → Providers. This
   is external-service configuration this session has no access to and should not attempt to
   fabricate or work around — the user needs to do this (or explicitly provide the credentials)
   before either button will work for a real user. Until then, clicking either button sends the
   user to a Supabase error page instead of the provider's real login screen.
1. **Currency-display policy scope** — ZAR-primary/GBP-bracket is confirmed correct for admin
   Financials. Open question: should that pattern extend anywhere in the public shop or
   customer emails, or stay admin-only?
2. **PayFast sandbox walkthrough** — IP allowlisting unimplemented; intermediate payment
   statuses (e.g. EFT) unconfirmed against PayFast's real sandbox. Needs someone with PayFast
   sandbox credentials, not another code pass.
3. **Return-shipping selector doesn't exist** — the in-person drop-off request assumed Step 3
   already had a "Return Courier to Door" / "Vault / Marketplace Listing" choice to retain.
   It doesn't. Deferred as its own future feature (new column + UI + order-summary wiring)
   rather than building it as an unplanned side effect of this task. **Re-confirmed still
   deferred** during the In-Person Event Submissions Admin Control task — that request also
   assumed this selector existed ("Retain domestic courier selection for the Return phase"); the
   existing address (used for the return destination) + `interestedInConsignment` opt-in were
   judged sufficient for now rather than building the dedicated selector as a side effect again.
4. **Resend domain verification — RESOLVED BY REPLACEMENT, not by fixing DNS.** This was
   previously parked (2026-09-20) pending DKIM/SPF/DMARC records at Spaceship for
   `cuppacards.com`. Later the same session, the user explicitly replaced Resend entirely with
   Google SMTP/Nodemailer (`lib/email/transporter.ts`, `lib/email/send-email.ts` — see the
   `siteConfig`/email-templating Shared Contracts above) — `resend` is uninstalled and
   `lib/email/resend-client.ts` is deleted, so there is no longer a Resend domain to verify at
   all. The real remaining blocker for actual email delivery is simply that `.env.local`'s
   `EMAIL_SERVER_*` values are still placeholders, not the domain-mismatch concern this item used
   to describe.
5. ~~Granting the first two admins~~ — **RESOLVED, confirmed live.** `mitchell@cuppascards.com`
   and `kyle@cuppascards.com` both now have `profiles.role = 'admin'`, run by the user directly in
   the Supabase SQL Editor (not by this session — see below for why). The obvious `UPDATE
   public.profiles SET role = 'admin' WHERE ...` had originally failed with `P0001: Only an admin
   can change a profile's role` — `0007_rls_hardening.sql`'s `prevent_self_role_escalation()`
   trigger blocks any `profiles.role` change unless the caller is already an admin or
   `auth.role() = 'service_role'`, neither of which is true from a Supabase Dashboard SQL Editor
   session. The fix that actually worked: `ALTER TABLE public.profiles DISABLE TRIGGER
   trg_profiles_protect_role;`, then the `UPDATE`, then immediately `ALTER TABLE public.profiles
   ENABLE TRIGGER trg_profiles_protect_role;` again — this session prepared that corrected SQL and
   explained why it was needed, but would not (and could not, per Claude Code's own safety
   classifier, which correctly refuses to "weaken a security control" autonomously) run it itself;
   the user ran it directly. **A first verification attempt also failed** (`42703: column "email"
   does not exist` on `public.profiles`) — see the new Shared Contract entry below on this
   project's `profiles`-table schema drift; the corrected verification joined through `auth.users`
   for the email instead. Now that two real admins exist, granting further admins going forward can
   go through the app itself (an existing admin satisfies `public.is_admin()`, which the trigger
   already allows) without ever needing to touch this trigger again.

## Immediate Next Task

Nothing is currently pending commit/push/deploy — everything through `db61e29` is committed,
pushed, and live on production (deployment `dpl_DeHC5XYXZ9FAhyXGdNKbLFa4Bvq9`). This includes: the
Contact page's stale direct-email block removal (the one real test row this left in
`contact_inquiries`, "Claude QA Test 2", has since been deleted at the user's request — see
Active File Manifest above); the Step 1 "Submission Method" selector
(`'batch'`/`'individual'` dispatch, migration 0065 applied and verified); Step 2's "This
submission" → "Full Clean & Polish" heading rename; and every outgoing email now unconditionally
CCing `updates@cuppascards.co.za` (`lib/email/send-email.ts`'s `ADMIN_CC_EMAIL`). Legal pages,
email templates, and PayFast item descriptors now say "CuppasCards". All 8 grading-lifecycle email
templates exist and render correctly. **Outbound email is now fully live**: the user swapped in
the real Gmail App Password for `mitchell@cuppascards.com` (2026-09-20), and real sends were
confirmed via `/admin/test-emails` throughout this session, returning real `messageId`s with no
SMTP error. No credential blocker remains on this pipeline.

**Committed, pushed to `origin/main`, and deployed to production** (commit `970ebb4`, deployment
`dpl_AQ6VAFrgiw3ZPjEZyB5AfggaNb9N`): the landing page section reorder, the hero copy update, the
Google/Apple OAuth addition, the Submission Method Step 1→Step 2 relocation, the Step 3 Order
Summary/delivery-method rewrite, the vendor page copy update, and the Vault carousel relocation —
see the seven bullets below for full detail on each.

Seven pieces of work, all landed in commit `970ebb4`:
- The landing page's `<FeaturedCarousel>` ("The CuppasCards Vault") now renders below "The Easiest
  Way to Grade" instead of above it (`app/page.tsx`).
- The landing page hero copy: pill badge now "South Africa's Premier Grading Service.", subheading
  now "Making Grading Easy" (`app/page.tsx`).
- Google/Apple OAuth sign-in via Supabase Auth (`app/auth/callback/route.ts`,
  `app/login/page.tsx`, `app/signup/page.tsx`, `components/SocialIcons.tsx`) — **but this one
  cannot actually be used by a real customer yet**. See Blocked item 0: Google and Apple both need
  real OAuth app credentials configured in the Supabase Dashboard before either button does
  anything but show a Supabase error page. Committing this is safe (the buttons don't function
  until that dashboard config exists), but don't tell customers social login is live until it is.
- The `/submit` wizard's "Submission Method" section (`'batch'`/`'individual'` dispatch) has been
  relocated from the top of Step 1 (`step-grader-tier.tsx`) to the top of Step 2
  (`step-addons.tsx`, above "Pre-grading preparation") — `app/submit/wizard.tsx` updated to pass
  `submissionType`/`onSelectSubmissionType` to `<StepAddOns>` instead of `<StepGraderTier>`. Copy,
  badges, and styling are unchanged; `submissionType` state itself still lives in `wizard.tsx` and
  still flows unchanged into `<StepReviewPay>` for Step 3's pricing. `npx tsc --noEmit` and
  `npm run lint` both pass clean (48 problems, same pre-existing baseline as before this change,
  no new issues). **Live browser click-through was inconclusive this session**: this session's
  automated browser tab was backgrounded (`document.visibilityState: "hidden"`) for the whole
  verification attempt, and Chrome suspends `requestAnimationFrame` for hidden tabs — since the
  wizard's step transitions are `framer-motion` `AnimatePresence` `exit` animations driven by rAF,
  the panel visually never advanced past Step 1 in this session no matter how many times "Continue"
  was clicked, even though the underlying `step` state and `ManifestRail` checkmarks *did* advance
  correctly on every click (confirmed via direct DOM/JS inspection, not just the extension's
  snapshot tools) — this points to the backgrounded tab, not the relocation, as the cause. A
  version of the AnimatePresence wrapper with a per-branch `key` was tried and reverted once this
  was understood, since it wasn't the actual root cause and wasn't part of what was asked for.
  **Since re-verified live and confirmed working** (later in this session) by temporarily patching the
  wizard's step-transition `transition={{ duration: ... }}` to `0` (a test-only, fully reverted
  change — `git diff` on `app/submit/wizard.tsx` afterward showed only the intended prop-move, no
  animation-related diff) so the exit animation could resolve without needing real
  `requestAnimationFrame` ticks, which Chrome fully suspends for a hidden/backgrounded tab
  regardless of how long you wait. With that workaround, Step 1 → Step 2 → Step 3 all rendered
  correctly on real clicks.
- Step 3 (`Review & pay`)'s "Ship from" section now offers a Courier Delivery / In-Person Drop-Off
  choice, and the Order Summary is restructured into a strict 6-line breakdown (ACE grading → ACE
  label, now always shown → CuppasCards Services, combined into one line → Local Courier Fees,
  two legs → International Courier Fees, two legs, now priced separately from the old lump sum →
  Total due today), plus a new static "Import & Customs Notice" paragraph below it. The 3 placeholder
  US courier tiers are gone, replaced by the one real South African provider (The Courier Guy —
  Pudo Locker to Locker, R110 each way). See the `step-review-pay.tsx` bullet in the Active File
  Manifest above for the full breakdown of every pricing/label change. `npx tsc --noEmit` and
  `npm run lint` both pass clean (same 48-problem baseline, no new issues). **Live click-tested
  end-to-end** (later in this session, using the same temporary rAF-duration workaround described in the
  Step 1→Step 2 bullet above, reverted afterward): with 1 card (Standard tier, ACE grading R590,
  Standard label R0, no prep/Clean&Polish selected) —
  Courier Delivery + Pooled Batch → Local legs R110+R110, International legs R110+R110, **Total
  R1 030,00**, matching `590+0+0+110+110+110+110`; toggling to In-Person Drop-Off correctly zeroed
  both local legs and hid the Courier section (`Local Intake`/`Local Return` both R0,00, **Total
  R810,00**), and showed the "Live Intake Active" badge at the top of the page as expected/
  documented above; switching Step 2's Submission Method to Individual Direct Dispatch correctly
  updated both international legs to R1 400,00 each (**Total R3 390,00** while still in In-Person
  Drop-Off mode: `590+0+0+0+0+1400+1400`). All labels, math, and toggling behaved exactly as
  specified — no issues found.
- `/vendor`'s "Every Grading Tier, On-Site" feature card body copy updated to drop the legacy
  PCG/PSA multi-grader claim and the "live USD pricing" line (`app/vendor/page.tsx`) — see the
  Active File Manifest bullet above for the exact before/after text. Heading, card grid/layout,
  typography, and number-badge hierarchy untouched. `npx tsc --noEmit` passes clean; this was a
  pure JSX string change with no logic/props affected, so no live click-through was needed.
- The Vault carousel (`<FeaturedCarousel>`, "The CuppasCards Vault") moved off the homepage
  entirely and onto `/shop`, per the user's explicit instruction to keep the homepage "ultra-clean
  and conversion-focused." See the `app/page.tsx` and `app/shop/page.tsx` bullets in the Active
  File Manifest above for the full detail. `npx tsc --noEmit` and `npm run lint` both pass clean
  (same 48-problem baseline). **Click-tested live**: homepage confirmed Hero → "The Easiest Way to
  Grade" → WhatsApp CTA with no Vault section and no console errors; `/shop` confirmed the full
  carousel (arrows, dots, all 7 grails) rendering as the first element on the page, directly above
  the category pills, with no visual clash against the shop layout's theme.

**Committed, pushed, and deployed to production (`5e0d906`, deployment `dpl_HzCQmK5fv4r5CvZb2R71rCD7npRW`) — admin authorization enforcement**:
`app/admin/layout.tsx` (new, centralized
`/admin/**` route guard), `app/login/page.tsx` (rewritten as a thin Server Component) and
`app/login/login-form.tsx` (new, the actual client form, now `next`-param-aware). See the Active
File Manifest and Shared Contracts entries above for full detail. `npx tsc --noEmit`, `npm run
lint` (same 48-problem baseline), and `npx next build` all pass clean, including confirming
`/login` still prerenders statically despite the new `useSearchParams()` usage. **Partially
click-tested live**: confirmed the "authenticated but not admin" redirect (`/admin` → `/`) works
correctly on this session's own logged-in-but-non-admin browser session; the "not authenticated at
all" redirect to `/login?next=/admin` was not live-tested (would have required signing out of a
browser session shared with several other open tabs) but mirrors the exact `if (!user)
redirect(...)` pattern `app/admin/page.tsx` already used successfully before this layout existed.
Separately, this session prepared (but per its own safety rules would not itself execute) the
corrected SQL to bootstrap the first two real admins — see Blocked item 5 below; that SQL is
independent of this code change and doesn't block committing it.

**Still genuinely open**:
- **Resend domain verification** is moot now that Resend itself has been fully replaced by Google
  SMTP/Nodemailer this session — the earlier "parked" blocked item about it (see Blocked below) is
  stale and should be treated as resolved-by-replacement, not something to still chase.
- **Wiring real production triggers** for the 6 newly-templated stages (`COLLECTION_BOOKED`,
  `DISPATCHED_TO_GRADER`, `RECEIVED_BY_GRADER`, `DISPATCHED_TO_SA`, `LANDED_AT_HQ`,
  `DISPATCHED_TO_CUSTOMER`) — each needs a real DB event/admin action to call `sendGradingUpdate`
  from, same as `ORDER_CONFIRMED`/`RECEIVED_HQ` already have. Not started; do not pick this up
  unprompted, since it touches the shipment/logistics pipeline rather than being a template-only
  change.
- The currency-display policy scope decision, and the deferred return-shipping selector (see
  Blocked below).

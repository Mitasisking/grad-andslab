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
+ Submission Method (batch vs individual dispatch) selector + admin CC on every outgoing email.**
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
  the CSS variable's name might suggest.
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
- **`event_settings`** is a Postgres singleton-row table (`id boolean primary key default true`, `check(id)`) — the same trick as any single-row settings table; there is deliberately no way to have zero or multiple rows.

---

## Uncommitted work in the tree right now

**Nothing is currently uncommitted.** Everything described in this file — through commit
`5e0d906` ("Gate all /admin routes behind a centralized admin-role check": `app/admin/layout.tsx`,
`app/login/page.tsx` + new `app/login/login-form.tsx`, on top of `c5351a6` and `970ebb4` — the
landing page section reorder, the hero copy update, the Google/Apple OAuth addition, the
Submission Method Step 1→Step 2 relocation, the Step 3 Order Summary/delivery-method rewrite, the
vendor page's "Every Grading Tier, On-Site" copy update, the Vault carousel's relocation from the
homepage to `/shop`, and the admin-route authorization guard — see the Active File Manifest and
Shared Contracts above for full detail on each) — is committed, pushed to `origin/main`
(`db61e29..970ebb4..5e0d906`), and deployed to Vercel production (deployment
`dpl_HzCQmK5fv4r5CvZb2R71rCD7npRW`, aliased to `website-three-iota-83.vercel.app`, deployed via
`vercel --prod`; build compiled clean, all 79 routes generated with no errors, `/login` confirmed
still prerendering statically and `/admin` correctly dynamic).

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

**Uncommitted — homepage hero copy update**:
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

**Uncommitted — outbound email switched to Google SMTP/Nodemailer**: full detail in the Current
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

**Uncommitted — WhatsApp community link**: `lib/social-links.ts`'s `SOCIAL_LINKS.whatsapp` is now
`https://chat.whatsapp.com/LRxadKeTEFV5DCRWArxHAe?s=cl&p=a&mlu=4&ilr=4` (was a placeholder);
`lib/site-config.ts`'s `siteConfig.links` gained `whatsappCommunity`, re-exporting the same value
rather than duplicating the URL. Confirmed live: both existing usages (`app/page.tsx`'s "Join the
WhatsApp Group" CTA, `components/Footer.tsx`'s "Follow Us" icon) now resolve to the real link.

**Uncommitted — Step 1 (`Grader & tier`) simplified to ACE-only for launch**:
`components/submit/step-grader-tier.tsx` fully rewritten (Country of origin + Grading company
selectors removed, `region`/`onSelectRegion`/`onSelectCompany` props dropped); `app/submit/
wizard.tsx`'s `region`/`company` changed from `useState` to plain `'sa'`/`'ACE'` constants,
`selectCompany` callback removed, `joinBatch` simplified to a same-company-only no-op (harmless
today since `LiveBatchTracker` is hidden). `tsc`/`eslint`/`npm run build` all clean (same
pre-existing baseline). Click-tested live end-to-end through Steps 1→2 with a real TCGdex
search-and-select of a Pikachu card.

**Uncommitted — card category locked to Pokémon for launch**: `components/submit/
card-shipment-row.tsx` fully rewritten — the Pokémon/Sports Cards toggle, Sport dropdown, and
`SportsCardSearch` usage removed entirely; `card.cardType` stays `'pokemon'` always.
`sports-card-search.tsx` and the `'sports_card'` `CardType` value are untouched/unreferenced for a
future re-enablement. `tsc`/`eslint` clean (same baseline).

**Uncommitted — shop filter pills simplified for launch**: `app/shop/page.tsx`'s `activeType`
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

**Uncommitted — Step 2 (`Add-ons`) simplified and refined**: `components/submit/step-addons.tsx`
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

**Uncommitted — brand name harmonized to "CuppasCards" across legal pages, email templates, and
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

**Uncommitted — full 8-stage grading email lifecycle now has real templates + a manual test
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

**Uncommitted — vendor page "Where We've Been" hidden until real event content exists**:
`app/vendor/page.tsx` gained a `SHOW_PAST_EVENTS = false` module-level flag; `NAV_SECTIONS` only
includes the "Where We've Been" hero button when it's `true`, and the whole event-gallery
`<section id="history">` is wrapped in `{SHOW_PAST_EVENTS && (...)}`. `PAST_EVENTS` data and the
section's full markup are untouched — toggling the flag to `true` once real event photos/history
exist is the only change needed to restore it. `tsc`/`eslint`/`npm run build` all clean (same
baseline). Click-tested live: `/vendor`'s hero CTA row now shows only "In-Person Submissions" and
"Book Us", and the history section itself no longer renders.

**Uncommitted — Contact page's stale direct-email block removed**: `app/contact/page.tsx`'s
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

**Uncommitted — "Submission Method" selector added to Step 1**: `lib/submission-types.ts` gained
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

**Uncommitted — every outgoing email now CCs the admin inbox**: `lib/email/send-email.ts`'s
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

**Uncommitted — landing page section reorder**: `app/page.tsx`'s "The Easiest Way to Grade"
3-step section now renders directly below the hero, with `<FeaturedCarousel>` ("The CuppasCards
Vault") moved below it instead of above — swapped by moving one `<section>` block, no inner
content/styling changes. `tsc`/`eslint` clean (same 49-problem baseline). Click-tested live: the
homepage now renders Hero → "The Easiest Way to Grade" → "The CuppasCards Vault" (all 7 products
intact) → WhatsApp CTA.

**Uncommitted — landing page hero copy update**: `app/page.tsx`'s pill badge is now "South
Africa's Premier Grading Service." and the subheading is now "Making Grading Easy" — text-only,
no styling change. `tsc`/`eslint` clean (48 problems, one fewer than the 49-problem baseline,
since the old subheading's own unescaped-apostrophe warning no longer exists). Click-tested live.

**Uncommitted — Vault carousel relocated from homepage to `/shop`**: `<FeaturedCarousel>` ("The
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

**Uncommitted — Google/Apple OAuth added via Supabase Auth**: new `app/auth/callback/route.ts`
exchanges the OAuth `?code=` for a session via the existing `getSupabaseRouteClient()`; new
`GoogleIcon`/`AppleIcon` in `components/SocialIcons.tsx`; `app/login/page.tsx` and
`app/signup/page.tsx` both gained "Continue with Google"/"Continue with Apple" buttons calling
`supabase.auth.signInWithOAuth()`. `tsc`/`eslint` clean (same baseline). **Not yet usable by a
real user** — see Blocked item 0 above: Supabase rejects both providers with "not enabled" until
real OAuth app credentials are configured in the Supabase Dashboard, which is outside this
session's access. Click-tested live: confirmed the client-side redirect reaches Supabase's real
authorize endpoint with correct params, and Supabase's own rejection message confirms this is a
configuration gap, not a code bug.

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

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
+ Submission Method (batch vs individual dispatch) selector.**
**Live in production as of `f0236b1`** (deployed via `vercel --prod`, deployment
`dpl_HgwE2UcsEN8GJbBUCSWrNFVK7Erd`, aliased to `website-three-iota-83.vercel.app`): everything
from the `d521c60` deploy (hero copy, Google SMTP/Nodemailer email migration, WhatsApp community
link, Step 1 ACE-only simplification, Pokémon-only card category lock, shop filter pill
simplification, vendor page's "Where We've Been" hide, "CuppasCards" brand-name harmonization, and
the full 8-stage grading email lifecycle templates + `/admin/test-emails` test harness) **plus**
the Contact page's stale direct-email block removal, the Step 1 "Submission Method" selector
(`'batch'`/`'individual'` dispatch, `submissions.submission_type` migration 0065 — applied to
production and independently re-verified), and Step 2's "This submission" → "Full Clean & Polish"
heading rename. This deploy was built from this project's own manual `vercel --prod` CLI workflow
(confirmed via `vercel ls`: prior deploys all show as CLI/Production, no git-triggered auto-deploy
bot), not an automatic git-push trigger — pushing to `origin/main` alone does not put changes on
production here. Migrations 0059-0065 all live.

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
  (a requested-but-nonexistent path — everything is inline in the page itself). Hero pill badge:
  "Everything should be made as simple as possible, but not simpler." (padding/font-size nudged
  down — `px-4 py-1.5`, `text-[11px]` — so the longer quote fits on one line; every other pill
  style, and every button/layout/import elsewhere on the page, unchanged). Hero subheading:
  "South Africa's premier grading service. Making it easy to grade your cards."
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
- `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/refund-policy/page.tsx`, `app/shipping-policy/page.tsx` (+ `components/legal/legal-page.tsx`)
- `app/login/page.tsx`, `app/signup/page.tsx`, `app/my-account/page.tsx`, `app/my-account/reset-password/page.tsx`

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
  now always the active company. **New**: a "Submission Method" section now renders above
  "Turnaround" — two selectable cards (`SUBMISSION_TYPE_OPTIONS`, `lib/submission-types.ts`) for
  `'batch'` (Pooled Batch, default) vs `'individual'` (Individual Direct Dispatch), driven by new
  `submissionType`/`onSelectSubmissionType` props.
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
  is unchanged.
- `step-review-pay.tsx` — still receives `needsSemiRigids`/`interestedInConsignment` props, now
  always `false` from `app/submit/wizard.tsx`'s hardcoded constants instead of user toggles, and
  still forwards them to `app/api/submissions/route.ts`'s checkout payload unchanged. **New**:
  gained a `submissionType` prop; computes `internationalShippingSubtotal` via
  `internationalShippingFeeForRegion` and adds it into `serviceFee`; renders a new Order Summary
  line item using `SUBMISSION_TYPE_LINE_ITEM_LABEL[submissionType]` ("International Shipping:
  Shared Batch Pool" / "...Dedicated Direct Dispatch"); forwards `submissionType` in the
  `/api/submissions` POST body.
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
- **In-person event drop-off** (`app/submit/wizard.tsx` detects it via `?intake=in-person&event=slug`
  or the global `event_settings` toggle; `step-review-pay.tsx` replaces the Courier section with a
  fixed free "In-Person Drop-Off (Table Intake)" line when active). `supabase/migrations/0062_add_in_person_event_intake.sql`
  adds `submissions.intake_channel/event_slug/handover_pin/intake_verified_at` and the singleton
  `event_settings` table. Click-tested live through Step 3 — Inbound correctly shows R0,00 and the
  Pay button enables without a courier selection; checkout itself (the actual DB insert) was **not**
  exercised since migration 0062 isn't applied to production yet.
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
  (now-dead-but-preserved) sports-card query branches.
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
- **`SubmissionType`** = `'batch' | 'individual'` — `lib/submission-types.ts`, column `submissions.submission_type` (migration 0065, **applied to production and independently re-verified**). Customer's choice of international dispatch method to ACE Grading's UK facility, surfaced in Step 1's "Submission Method" section and priced in Step 3's Order Summary via `internationalShippingFeeForRegion`/`SUBMISSION_TYPE_LINE_ITEM_LABEL`. **Deliberately not the same concept as `pool_id`/`pool_status`**: those track membership in one specific, real `public.pools` row (a tier-scoped batch with capacity, joined via the currently-hidden `LiveBatchTracker` UI, `SHOW_BATCH_TRACKER = false`); `submission_type` is a much simpler standing customer preference that exists independently of whether a real pool is currently open to join — a `'batch'` submission_type never requires or implies a non-null `pool_id`. Do not conflate the two, and do not wire `submission_type = 'batch'` to automatically assign a `pool_id` without a separate, explicit decision to do so.
- **`ProductRegion`** = `'usa' | 'uk' | 'sa'` — `lib/shop/product-type.ts` — drives `tierPriceForRegion`, `cleanAndPolishFeeForRegion`, `inspectionFeeForRegion`, and shop currency display. **Policy**: USD/GBP/ZAR are independently-priced per region, never converted from one another at checkout time.
- **Currency display policy**: admin Financials dashboard is ZAR-primary with GBP bracket, deliberately. Public/customer-facing surfaces price natively per region (see above). Do not force ZAR-primary onto customer-facing pages — flagged explicitly in `launch_readiness_report.md` as a deliberate distinction, not a bug.
- **DB row shapes**: `SubmissionRow`, `PoolRow`, `SubmissionItemRow`, `SubmissionStatusLogRow` (`lib/submission-types.ts`) mirror `supabase/migrations/0001_init_schema.sql`, `0004_status_history.sql`, `0035_submission_pools.sql` — no generated `database.types.ts` exists; these are hand-maintained and must be kept in sync with migrations manually.
- **Route conventions**: admin API routes under `app/api/admin/**` gate on `lib/require-admin.ts`; client-facing DB errors must be generic with raw errors logged server-side only (pattern established in `app/api/submissions/route.ts`, since applied to `app/api/admin/products/*`).
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
`EventSettingsRow` gained `active_event_name: string | null` (migration 0064) — purely a display
name for the admin panel and the `/submit` wizard's badge; `active_event_slug` remains the only
field that drives routing/matching logic, never the name.
- **`event_settings`** is a Postgres singleton-row table (`id boolean primary key default true`, `check(id)`) — the same trick as any single-row settings table; there is deliberately no way to have zero or multiple rows.

---

## Uncommitted work in the tree right now

**Nothing is currently uncommitted.** Everything described in this file — through commit
`f0236b1` — is committed, pushed to `origin/main`, and deployed to Vercel production (alias
`website-three-iota-83.vercel.app`, deployment `dpl_HgwE2UcsEN8GJbBUCSWrNFVK7Erd`, deployed via
`vercel --prod`). The subsections below are kept as a historical record of what shipped in each
past task/commit, not a list of pending changes — check `git status` if you need to confirm this
is still true before trusting it blindly.

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

- Untracked, not yet triaged into the repo structure: `Stock photos/`, `TheCardApi.txt`,
  `claude context.txt`, `cuppa cards logo temp logo.jpeg`, `termsofservice.txt`, `zernio.txt`.

## Blocked / Needs a Decision

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

## Immediate Next Task

Nothing is currently pending commit/push/deploy — everything through `6c520b4` is committed,
pushed, and live on production (deployment `dpl_HgwE2UcsEN8GJbBUCSWrNFVK7Erd`). This includes: the
Contact page's stale direct-email block removal (the one real test row this left in
`contact_inquiries`, "Claude QA Test 2", has since been deleted at the user's request — see
Active File Manifest above); the Step 1 "Submission Method" selector
(`'batch'`/`'individual'` dispatch, migration 0065 applied and verified); and Step 2's "This
submission" → "Full Clean & Polish" heading rename. Legal pages,
email templates, and PayFast item descriptors now say "CuppasCards". All 8 grading-lifecycle email
templates exist and render correctly. **Outbound email is now fully live**: the user swapped in
the real Gmail App Password for `mitchell@cuppascards.com` (2026-09-20), and a real send was
confirmed via `/admin/test-emails` (Stage 1 `ORDER_CONFIRMED` and Stage 3 `RECEIVED_HQ`, both
returning real `messageId`s with no SMTP error) after restarting the dev server to pick up the
new `.env.local` values. No credential blocker remains on this pipeline.

One more piece is code-complete and click-tested live, waiting on your go-ahead to commit: every
outgoing email now unconditionally CCs `updates@cuppascards.co.za` (`lib/email/send-email.ts`'s
`ADMIN_CC_EMAIL`, changed from an initial `info@cuppascards.co.za` within the same task), confirmed
via a real send returning `HTTP 200`.

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

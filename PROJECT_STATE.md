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

**Phase: In-Person Event Submissions — Admin Control + customer flow, built out fully.** Committed
locally as of `3deec54` (Navbar personalization, pushed) — everything through `451ca05` is **live
on production** (Vercel alias `website-three-iota-83.vercel.app`), migrations 0059-0063 live.
Active work (this task): the request asked for a brand-new `platform_settings` table, but that
duplicates the existing `event_settings` singleton (migration 0062, already RLS'd public-read /
admin-write, already wired end-to-end via `app/admin/events`, `app/api/events/active`, and
`app/submit/wizard.tsx`) — **per the user's explicit choice, extended the existing system instead
of building a parallel one.** Concretely: (1) migration `0064_add_event_settings_name.sql` adds
`active_event_name` (nullable text) to `event_settings`, applied to production and independently
re-verified via `information_schema.columns`; (2) `app/admin/events/events-settings-panel.tsx`
rebuilt with an Event Name field, a real shadcn `Switch` (new `components/ui/switch.tsx`, backed by
the newly-installed `@radix-ui/react-switch` — confirmed with the user before adding the
dependency), a shareable booth link, a `QRCodeSVG`-rendered QR code, and Copy/Download/Print
actions (print scoped via Tailwind's `print:` variant, with `print:hidden` added to `Navbar.tsx`/
`Footer.tsx` so a printed booth flyer excludes site chrome); (3) `app/submit/wizard.tsx` gained a
"Live Intake Active — Handing in at {event name}" badge, name-matched by slug so a stale/old booth
QR code can't show the wrong current event's name; (4) the "Zero-Paper Intake Handshake" (unique
4-digit `handover_pin`, the confirmation-screen PIN display, and `/admin/intake`'s "Booth handover"
PIN-verify box that marks the submission received and fires `RECEIVED_HQ`) **already existed
end-to-end** from the earlier In-Person Event Drop-Off task — audited, confirmed correct, left
untouched. **Explicitly not built**: a dedicated return-shipping courier/Vault-Consignment
selector — the existing address (used for the return destination) + `interestedInConsignment`
opt-in already cover this reasonably, and a dedicated selector remains the separately-deferred
future feature already tracked in Blocked below; do not build it as an unplanned side effect here.
`tsc`/`eslint`/`npm run build` all clean; click-tested live end-to-end in the browser (admin panel
save flow, QR/booth link, the wizard badge via both the admin-toggle path and the `?intake=in-
person&event=slug` URL-param path) after tracking down and ruling out a **dev-server-only**
Turbopack quirk (see Uncommitted work below) via a clean production build. Migration 0064 is live
on production Supabase; the admin toggle was reset back to off after testing, confirmed via a
fresh read. Email delivery work (Resend domain verification, the remaining 6 notification stages)
is **explicitly parked at the user's request** — do not pick it back up unprompted.

---

## Active File Manifest

Grouped by subsystem. Paths are relative to repo root. This lists what exists and is wired
up today — not a to-do list.

### App routes — public
- `app/page.tsx`, `app/layout.tsx`
- `app/batches/page.tsx` — **removed**. The standalone Live Batch Tracker route (and
  `components/LivePools.tsx`, its exclusive slate/amber-themed renderer) is gone; `/batches` now
  308-redirects to `/submit` via `next.config.js`'s `redirects()`. Its content lives on `/submit`
  itself now — see the Submission flow section below.
- `app/services/page.tsx`, `app/prepare/page.tsx`, `app/contact/page.tsx`, `app/vendor/page.tsx`
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
  batch panel's "Join Batch" scroll target.
- `step-addons.tsx`, `step-review-pay.tsx`
- `components/submit/card-shipment-row.tsx`, `sports-card-search.tsx`, `manifest-rail.tsx`, `packing-slip.tsx`, `add-address-form.tsx`
- `app/api/submissions/route.ts`, `app/api/submissions/checkout/route.ts`
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

### Customer dashboard
- `app/dashboard/page.tsx`, `app/dashboard/submissions/page.tsx`, `app/dashboard/submissions/[id]/page.tsx` + `submission-detail.tsx`
- `components/dashboard/cert-link.tsx`, `photo-modal.tsx`, `pipeline-progress.tsx`
- `lib/hooks/use-realtime-submission.ts`

### Admin — grading intake & pipeline
- `app/admin/intake/*` (`intake-portal.tsx` — now also has a "Booth handover" PIN input below the
  existing QR-scan/manual-token flow), `app/admin/grading/*` (`grading-portal.tsx`)
- `components/admin/intake-order-panel.tsx`, `grade-entry-panel.tsx`, `qr-scanner.tsx`
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
- `components/shop/*` (browser, grid, filters, sports-card-filters, category-tabs, subcategory-pills, region-toggle, product-type-toggle, cart-button, add-to-cart-button)
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
- `lib/email/resend-client.ts`, `send-order-confirmation.ts`, `templates/order-confirmation.ts` —
  existing payment-receipt emails (unchanged)
- `types/notifications.ts` — `GradingEmailStage` (8-stage union) + per-stage payload interfaces
  (`OrderConfirmedPayload`, `CollectionBookedPayload`, `ReceivedHqPayload`,
  `DispatchedToGraderPayload`, `ReceivedByGraderPayload`, `DispatchedToSaPayload`,
  `LandedAtHqPayload`, `DispatchedToCustomerPayload`), discriminated union `GradingEmailPayload`
- `lib/email/send-grading-update.ts` — `sendGradingUpdate(payload)`, dispatches by `payload.stage`;
  only `ORDER_CONFIRMED` has a real renderer today, the other 7 throw a named "not implemented"
  error (no silent no-op). Best-effort contract like the existing `send-*` functions — does not
  catch its own errors, callers must wrap in try/catch.
- `lib/email/templates/order-confirmed.ts` — `renderOrderConfirmedEmail`, the `ORDER_CONFIRMED`
  template. Reuses `order-confirmation.ts`'s `COLORS`/`escapeHtml` (same dark/gold palette, same
  hand-rolled inline-styled HTML approach — see Shared Contracts below for why). No call site
  wires this to a real trigger yet — nothing currently invokes it for this stage.
- `lib/email/templates/received-hq.ts` — `renderReceivedHqEmail`, the `RECEIVED_HQ` template.
  Wired to a real trigger: `app/api/admin/intake/booth-handover/route.ts` calls it on every
  verified PIN. Renders gracefully with an empty `inspectionPhotos` (true at booth-handover time,
  since dual-surface photos come from a later, separate step) vs. a real photo grid when populated.
- `getContact` in `lib/email/send-order-confirmation.ts` is now exported (was module-private) so
  `booth-handover/route.ts` can reuse the same profile+auth-email lookup instead of duplicating it.
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
  UI copy. Always read `siteConfig.name` for display text; never hardcode `"Cuppa's Cards"` or
  `"CuppasCards"` as a literal string in a component. **Not yet the source of truth everywhere**:
  legal pages (`app/terms`, `app/privacy`, `app/refund-policy`, `app/shipping-policy`), email
  templates/sender names (`lib/email/**`, `app/api/notify/route.ts`), and PayFast `itemName`
  descriptors (`app/api/{submissions/checkout,shop/checkout,auctions/[id]/pay}/route.ts`) still
  hardcode the old name — deliberately deferred at the user's explicit choice, since a legal-entity
  name change and a payment-descriptor change carry different risk than a UI copy pass. Do not
  migrate those to `siteConfig.legalName`/`.name` without the user separately confirming the
  business's actual legal name is changing.
- **`GradingCompany`** = `'PCG' | 'PSA' | 'ACE'` — `lib/submission-types.ts`
- **`SubmissionTier`** — union of all three companies' tier slugs (PCG unprefixed, PSA/ACE prefixed) — `lib/submission-types.ts`. ACE's current purchasable tiers: `ace_basic`, `ace_standard`, `ace_premier`, `ace_ultra`, `ace_luxury`. `ace_value` stays in the union (and the DB enum/CHECK constraint) for historical-row typing only — it is retired from `TIER_OPTIONS_BY_COMPANY.ACE` and must never be re-added there.
- **`TierOption`** gained two optional fields this task: `description` (marketing blurb, rendered under the label) and `group` (subheading key for the tier selector, e.g. ACE's `'Flagship'`/`'Premium'`). Both are optional and additive — PCG/PSA entries omit them and render exactly as before.
- **`SubmissionStatus`** = `'received' | 'inspected' | 'shipped' | 'graded' | 'returned'` (5-stage pipeline, `STATUS_STAGES`) — `lib/submission-types.ts`
- **`PoolStatus`** = `'open' | 'closed' | 'shipped' | 'completed'` — `lib/submission-types.ts`, table `public.pools` (migration 0035)
- **`ProductRegion`** = `'usa' | 'uk' | 'sa'` — `lib/shop/product-type.ts` — drives `tierPriceForRegion`, `cleanAndPolishFeeForRegion`, `inspectionFeeForRegion`, and shop currency display. **Policy**: USD/GBP/ZAR are independently-priced per region, never converted from one another at checkout time.
- **Currency display policy**: admin Financials dashboard is ZAR-primary with GBP bracket, deliberately. Public/customer-facing surfaces price natively per region (see above). Do not force ZAR-primary onto customer-facing pages — flagged explicitly in `launch_readiness_report.md` as a deliberate distinction, not a bug.
- **DB row shapes**: `SubmissionRow`, `PoolRow`, `SubmissionItemRow`, `SubmissionStatusLogRow` (`lib/submission-types.ts`) mirror `supabase/migrations/0001_init_schema.sql`, `0004_status_history.sql`, `0035_submission_pools.sql` — no generated `database.types.ts` exists; these are hand-maintained and must be kept in sync with migrations manually.
- **Route conventions**: admin API routes under `app/api/admin/**` gate on `lib/require-admin.ts`; client-facing DB errors must be generic with raw errors logged server-side only (pattern established in `app/api/submissions/route.ts`, since applied to `app/api/admin/products/*`).
- **PayFast webhook idempotency**: every branch in `app/api/webhooks/payfast/route.ts` gates its DB update on `payment_status = 'pending'` via an atomic `UPDATE ... WHERE`, and only fires its side effect when a row actually changed. Do not reintroduce read-then-write here.
- **Email templating convention (decided explicitly, do not revisit without asking)**: all transactional emails are hand-rolled HTML strings with inline styles in `lib/email/templates/*.ts`, never JSX/React Email — most email clients (Outlook especially) ignore `<style>`/CSS-in-JS. Every interpolated user-entered value MUST go through `escapeHtml` (`lib/email/templates/order-confirmation.ts`) — a real stored-XSS was fixed here before. `@react-email/*` is deliberately not a dependency. Senders live in `lib/email/send-*.ts` (not `lib/mail/`), take a payload, call `getResendClient().emails.send()` directly, and do not catch their own errors — the caller wraps in try/catch and only logs, since a notification failure must never fail the pipeline event that triggered it.
- **`GradingEmailStage`** (`types/notifications.ts`) — an 8-stage notification-layer lifecycle, intentionally more granular than the DB's `SubmissionStatus` (5 stages) or `shipment_batch_status` (5 stages, migration 0052). Most stages beyond `ORDER_CONFIRMED` have no DB column or call site yet — adding a stage here is a type contract, not a promise it's wired up.
- **`AceLabelOption`** = `'standard' | 'colour_match' | 'ace_label'` — lives in `lib/submission-types.ts` (with `ACE_LABEL_OPTIONS`/`labelOptionFeeForRegion`), **not** a separate `types/grading.ts` — that path was requested but deliberately not created, to avoid a second, competing home for grading-domain types alongside the existing single source of truth. Same per-submission modeling as `needs_clean_and_polish`/`needs_semi_rigids` (one choice for the whole batch, not per-card) — only ever non-null when `grading_company = 'ACE'` (enforced by `chk_submissions_ace_label_option_valid`, migration 0061). ZAR fees (R25/R75) are ACE's own designated retail prices, not the usual ~18.5 USD/ZAR stand-in conversion; USD is still the derived stand-in.
- **`IntakeChannel`** = `'online_shipment' | 'in_person_event'` and **`EventSettingsRow`** — `lib/submission-types.ts` (again, not `types/grading.ts` — same reasoning as `AceLabelOption` above; every new domain type this session has gone into the existing file, not a parallel one). "Awaiting Booth Handover" / "Received & Logged" are **UI labels derived from `intake_channel` + `intake_verified_at`**, deliberately not new `SubmissionStatus` enum values — that enum is shared with the customer pipeline stepper (`STATUS_STAGES`/`PipelineProgress`) and `lib/admin/submission-status.ts`'s `changeSubmissionStatus`, which only accepts its fixed 5 values; extending it for a pre-`received` state would mean touching that shared stepper UI for a state most submissions never pass through. Every submission, in-person or not, still gets `status = 'received'` at creation, unchanged.
`EventSettingsRow` gained `active_event_name: string | null` (migration 0064) — purely a display
name for the admin panel and the `/submit` wizard's badge; `active_event_slug` remains the only
field that drives routing/matching logic, never the name.
- **`event_settings`** is a Postgres singleton-row table (`id boolean primary key default true`, `check(id)`) — the same trick as any single-row settings table; there is deliberately no way to have zero or multiple rows.

---

## Uncommitted work in the tree right now

**Committed and pushed to `main`** (`f796950` also **deployed to Vercel production**, alias
`website-three-iota-83.vercel.app`; everything after it is committed but not yet deployed): ACE
tier overhaul + ACE Label Options + notification system stage 1 (`4026e1d`); In-Person Event
Drop-Off (`df13969`); booth-handover contact-lookup bug fix (`0de1894`); `ORDER_CONFIRMED` wired
into the Payfast webhook (`fb9bb14`); grader filter false-positive fix, `products.grading_company`
(`8913730`, migration 0063); Live Batch Tracker extracted to `/batches` (`2c7c9f3`); `/experience`
removed entirely (`66aae87`); Submit Cards + Batches consolidated onto `/submit` (`f796950`, **the
last one deployed**); Live Batch Tracker isolated + hidden behind a flag (`2249a9f`); site-wide
"CuppasCards" brand rename + `/submit` nav label simplified (`03c67de`); PROJECT_STATE.md
deployment-status update (`451ca05`); "My Submissions" nav-link personalization (`3deec54`).
Migrations 0059-0063 all live on production. `RECEIVED_HQ`/`ORDER_CONFIRMED` email delivery is
blocked by an unrelated, pre-existing Resend domain-verification issue (see Blocked below) —
parked at the user's request, not being chased further.

**Uncommitted — In-Person Event Submissions Admin Control + customer flow**: full detail in the
Current Milestone and Active File Manifest sections above. In short:
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
4. **Resend domain verification — explicitly parked by the user (2026-09-20).** `cuppacards.com`
   is added in Resend (status "Not Started") but has zero DNS records live yet. The exact
   records needed (DKIM TXT, two SPF CNAMEs, optional DMARC TXT) were pulled directly from the
   Resend dashboard and are recorded in this session's history — ask if you need them again
   rather than re-fetching. DNS lives at **Spaceship**, which this session has no access to.
   User is waiting on more details before adding them. **Do not chase this further until the
   user brings it back up** — every email this app sends (`RECEIVED_HQ`, `ORDER_CONFIRMED`, the
   older payment-receipt emails) is blocked on this, but that's accepted as a known, deliberate
   gap for now, not something to keep flagging every session. **Note the domain mismatch**: this
   Resend setup targets `cuppacards.com`, while `lib/site-config.ts`'s new `siteConfig.domain` is
   `cuppascards.co.za` (confirmed by the user as the real domain being adopted) — when email work
   resumes, confirm with the user which domain the sending address should actually verify against
   rather than assuming `cuppacards.com` is still correct.

## Immediate Next Task

The In-Person Event Submissions Admin Control + customer flow work (migration 0064, the rebuilt
`events-settings-panel.tsx` with the shadcn Switch/QR/booth-link, the wizard's "Live Intake
Active" badge) is code-complete, build-verified, and click-tested live end-to-end — waiting on
your go-ahead to commit. The "My Submissions" nav-link personalization (`3deec54`) is already
committed and pushed but not yet deployed.

Legal pages, email templates, and PayFast item descriptors still say "Cuppa's Cards" — deliberately
deferred; only touch them if the user separately confirms the legal entity name is actually
changing.

Email delivery work (Resend domain verification, wiring the remaining 6 notification stages) is
**parked at the user's request** — do not pick this back up unprompted. Other open items:
the currency-display policy scope decision, or the deferred return-shipping selector.

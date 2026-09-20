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

**Phase: homepage cleanup — extract Live Batch Tracker to `/batches`.** Everything through
wiring `ORDER_CONFIRMED` into the Payfast webhook is **committed and pushed** to `main`
(`4026e1d`, `df13969`, `0de1894`, `fb9bb14`), migrations 0059-0062 all live on production. Email
delivery work (Resend domain verification, the remaining 6 notification stages) is **explicitly
parked at the user's request** — do not pick it back up unprompted. The grader filter
false-positive fix (`products.grading_company`, migration 0063) is code-complete, migration
applied to production, click-tested live — **uncommitted**, see below. Active work: a new
`/batches` page holding the Live Batch Tracker previously embedded on the homepage
(**uncommitted**, see below) — pure frontend, no schema change, no migration needed.

---

## Active File Manifest

Grouped by subsystem. Paths are relative to repo root. This lists what exists and is wired
up today — not a to-do list.

### App routes — public
- `app/page.tsx`, `app/layout.tsx`, `app/experience/page.tsx` (+ `components/experience/*`)
- `app/batches/page.tsx` — standalone Live Batch Tracker, extracted off the homepage. Reuses
  `components/LivePools.tsx` as-is (server-rendered snapshot via `lib/pools/active-pools.ts`);
  adds its own empty state (a "no batches filling" message + Start a Submission CTA) for when
  `LivePools` would otherwise render nothing. "Join Batch" deep-links to
  `/submit?company=...&tier=...`, which `app/submit/wizard.tsx` already reads on mount — no
  changes needed there.
- `app/services/page.tsx`, `app/prepare/page.tsx`, `app/contact/page.tsx`, `app/vendor/page.tsx`
- `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/refund-policy/page.tsx`, `app/shipping-policy/page.tsx` (+ `components/legal/legal-page.tsx`)
- `app/login/page.tsx`, `app/signup/page.tsx`, `app/my-account/page.tsx`, `app/my-account/reset-password/page.tsx`

### Submission flow (grading intake)
- `app/submit/page.tsx`, `app/submit/layout.tsx`, `app/submit/wizard.tsx`
- `components/submit/step-grader-tier.tsx` — tier selector, now renders `TierOption.group`
  subheadings ("Flagship levels" / "Premium levels") when a company's tiers set `group`;
  companies without groups (PCG, PSA) render as a flat list, unchanged. Also renders
  `TierOption.description` under the tier label.
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
- `app/admin/events/page.tsx` + `events-settings-panel.tsx` — single global toggle
  (`active_event_slug` + `is_live`) for defaulting every `/submit` visitor into in-person mode
  without a booth QR code. Same inline per-page auth pattern as `app/admin/pools/page.tsx`
  (no shared `layout.tsx`/`requireAdmin()` for pages — that's an API-route-only convention).
- `app/api/admin/events/route.ts` — admin-only POST to update the singleton row.
- `app/api/events/active/route.ts` — public GET, read by the `/submit` wizard.

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
- `components/ui/{button,checkbox,input,label}.tsx`, `lib/utils.ts`
- `components/{Navbar,Footer,FeaturedCarousel,LivePools,PoolTracker,SocialIcons,WhatnotBanner,PackagingGuidelines}.tsx`
- `supabase/migrations/0001…0058` (56 files) — full schema history, `supabase/apply-all.sql`

---

## Shared Contracts (frozen — do not casually change)

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
- **`event_settings`** is a Postgres singleton-row table (`id boolean primary key default true`, `check(id)`) — the same trick as any single-row settings table; there is deliberately no way to have zero or multiple rows.

---

## Uncommitted work in the tree right now

**Committed and pushed** (all on `main`): ACE tier overhaul + ACE Label Options + notification
system stage 1 (`4026e1d`); In-Person Event Drop-Off (`df13969`); booth-handover contact-lookup
bug fix (`0de1894`); `ORDER_CONFIRMED` wired into the Payfast webhook (`fb9bb14`). Migrations
0059-0062 all live on production. `RECEIVED_HQ`/`ORDER_CONFIRMED` email delivery is blocked by
an unrelated, pre-existing Resend domain-verification issue (see Blocked below) — parked at the
user's request, not being chased further.

**Uncommitted — grader filter false-positive fix**:
- `supabase/migrations/0063_add_product_grading_company.sql` — **applied to production,
  independently re-verified**: `information_schema.columns` confirms `grading_company` exists
  (`text`, nullable); both `chk_products_grading_company_valid` and
  `chk_products_grading_company_matches_category` confirmed live via `pg_get_constraintdef`,
  definitions matching the migration exactly. Adds `products.grading_company` (nullable text,
  CHECK'd to `PCG`/`ACE`/`PSA`, CHECK'd to only ever be set when `category = 'graded'`), plus a
  one-time backfill for existing graded rows matched against the exact `" — <GRADER> <grade>"`
  suffix every bulk-import tool already appends (anchored, not a bare substring check — using a
  bare check here would just reintroduce the exact bug this migration fixes). The ordering risk
  this note used to warn about (`toProductRow` sends `grading_company` on every single product
  create/update, not just graded ones, so deploying this before the migration ran would have
  broken all product admin operations) no longer applies now that the migration is live.
- `lib/shop/grader.ts` — `matchesGrader`/`detectGrader` (the title-substring heuristic) deleted
  entirely, now fully unused. Only the `Grader` type remains.
- `components/shop/product-filters.tsx` — `applyShopFilters`'s grader check now reads
  `p.grading_company` directly instead of scanning the title text.
- `components/experience/chase-cards.ts` — same swap, for the hero shatter-fan's grader-scheme
  pick.
- `lib/admin/product-input.ts`, `app/admin/shop/types.ts`, `components/shop/product-grid.tsx` —
  `gradingCompany`/`grading_company` added to the shared product input/row types, validated
  (required when `category === 'graded'`, forbidden otherwise — same pairing pattern as
  `sport`/`cardType`).
- `app/admin/shop/product-form-modal.tsx` — new "Grading company" select, shown only when
  Category = Graded, cleared automatically when switching away (mirrors the existing
  `selectCardType`/sport-clearing pattern).
- All three bulk import tools (`bulk-ace-import.tsx`, `bulk-pcg-import.tsx`,
  `bulk-psa-import.tsx`) now set `gradingCompany` explicitly on every row instead of relying on
  the grader name being baked into the title (the title suffix is kept for readability, but is
  no longer what the filter actually checks) — their doc comments and on-page copy updated to
  match.
- `app/shop/page.tsx`'s `PRODUCT_COLUMNS` now selects `grading_company` so the client-side
  filter actually has the data to check.
- `tsc`/`eslint`/`npm run build` all clean. **Click-tested live against real production data**:
  the admin edit form for a real PSA-graded product ("Galarian Moltres V — PSA 10 GEM MT")
  correctly shows the new Grading company select pre-filled to "PSA" (confirms the migration's
  backfill worked); the public shop's Grader filter, checking "PSA", correctly narrows the
  Graded category down to just that one card, excluding six real ACE-graded cards that were
  previously miscategorized by the old title-substring check.

**Uncommitted — extract Live Batch Tracker to `/batches`**:
- `app/batches/page.tsx` — new, reuses `components/LivePools.tsx` unchanged, adds an empty-state
  block for when no pools are active.
- `app/page.tsx` — the embedded `<LivePools pools={activePools} />` section, its `getActiveLivePools`
  call, and both now-unused imports removed.
- `components/Navbar.tsx` — new "Batches" link (`/batches`) between "Submit Cards" and "Shop".
- `tsc`/`eslint`/`npm run build` all clean (two pre-existing lint issues in `app/page.tsx` and
  `components/Navbar.tsx`, confirmed via `git stash` to predate this session, left untouched).
  **Click-tested live**: homepage no longer shows the tracker (goes straight from hero to "The
  Cuppa's Cards Vault"); `/batches` renders all 7 real active pools correctly, including "ACE
  Basic" showing 18/20 (confirms the earlier grader-fix-testing pool cleanup held); clicking
  "Join Batch" on it correctly navigated to `/submit?company=ACE&tier=ace_basic` with Step 1
  pre-selecting ACE Grading + Basic tier automatically — the existing `wizard.tsx` URL-param
  handling needed no changes for this.
- **Not built, by design** (see Blocked / Needs a Decision below): a return-shipping selector
  ("Return Courier to Door" / "Vault / Marketplace Listing") — the original request said to
  "retain" this, but no such selector exists anywhere in the codebase to retain. Flagged and
  explicitly deferred rather than inventing new scope silently.
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
   rather than building it as an unplanned side effect of this task.
4. **Resend domain verification — explicitly parked by the user (2026-09-20).** `cuppacards.com`
   is added in Resend (status "Not Started") but has zero DNS records live yet. The exact
   records needed (DKIM TXT, two SPF CNAMEs, optional DMARC TXT) were pulled directly from the
   Resend dashboard and are recorded in this session's history — ask if you need them again
   rather than re-fetching. DNS lives at **Spaceship**, which this session has no access to.
   User is waiting on more details before adding them. **Do not chase this further until the
   user brings it back up** — every email this app sends (`RECEIVED_HQ`, `ORDER_CONFIRMED`, the
   older payment-receipt emails) is blocked on this, but that's accepted as a known, deliberate
   gap for now, not something to keep flagging every session.

## Immediate Next Task

Both the grader filter fix and the `/batches` extraction are code-complete and click-tested
live — waiting on your go-ahead to commit (together or separately, your call).

Email delivery work (Resend domain verification, wiring the remaining 6 notification stages) is
**parked at the user's request** — do not pick this back up unprompted. Other open items:
the currency-display policy scope decision, or the deferred return-shipping selector.

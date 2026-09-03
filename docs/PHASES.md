# Phase 2 — Submission Engine (`/submit`)

## Install

```bash
npm install framer-motion @stripe/react-stripe-js @stripe/stripe-js qrcode.react stripe @supabase/ssr @supabase/supabase-js
npx shadcn@latest add button input label checkbox
```

## Database

Run migrations in order:

```
supabase/migrations/0001_init_schema.sql   Phase 1 core schema
supabase/migrations/0002_addresses.sql     dedicated addresses table + submissions.address_id
```

`0002` also drops the flat `shipping_*` columns from `profiles` — if you have real
rows already, backfill them into `public.addresses` first.

## Environment variables

```bash
# Server-side only
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=...      # service-role client (webhooks only, bypasses RLS)
TCGPLAYER_API_KEY=                 # wire up in app/api/pricing/route.ts when ready
PRICECHARTING_API_KEY=             # wire up in app/api/pricing/route.ts when ready

# Client-side
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## File map

```
supabase/migrations/
  0001_init_schema.sql       Phase 1 schema
  0002_addresses.sql          addresses table, RLS, submissions.address_id

app/submit/
  layout.tsx                 scopes fonts + design tokens to this route only
  submit-tokens.css           ledger/manifest color palette (CSS variables)
  page.tsx                    server component: metadata + hero copy
  wizard.tsx                   'use client' state machine, loads the user's addresses

app/api/
  pricing/route.ts             server-side market value lookup (stub, see comments)
  addresses/route.ts            list / create addresses, scoped by RLS to the caller
  submissions/route.ts          creates submission + items, returns the real qr_code_token
  checkout/route.ts             creates a Stripe PaymentIntent against a real submission id
  webhooks/stripe/route.ts       marks payment_status from the PaymentIntent outcome (source of truth)

components/submit/
  manifest-rail.tsx            left-hand ledger-style step indicator
  step-grader-tier.tsx          Step 1: grader, tier, card list w/ value auto-lookup
  step-addons.tsx                Step 2: pre-grading inspection + return rules
  step-review-pay.tsx            Step 3: address, courier, order creation, checkout
  add-address-form.tsx           inline form for saving a new address mid-flow
  stripe-payment-form.tsx        Stripe Elements wrapper used inside Step 3
  packing-slip.tsx               printable slip with the server-issued intake QR code

lib/
  submission-types.ts           shared types, grader/tier constants, base fee
  pricing-client.ts              client fetch wrapper for /api/pricing
  addresses-client.ts            client fetch wrapper for /api/addresses
  stripe-client.ts               singleton Stripe.js loader
  supabase-route-client.ts       session-scoped Supabase client (RLS as the caller)
  supabase-server.ts             service-role Supabase client (trusted server tasks only)
```

## How the QR token now works

1. Step 3 first calls `POST /api/submissions`, which inserts the `submissions`
   row (status `received`, `payment_status` `pending`) and its `submission_items`.
   Postgres generates `qr_code_token` via `default gen_random_uuid()` — the
   client never invents or sends one.
2. Only after that succeeds does the client call `POST /api/checkout` to
   create the Stripe `PaymentIntent`, tagged with the real `submissionId`.
3. On payment confirmation, `app/api/webhooks/stripe/route.ts` is the
   authoritative place `payment_status` flips to `captured` — client-side
   `onSuccess` just advances the UI to the packing slip; it doesn't mark
   anything paid in the database.
4. The packing slip encodes `https://.../admin/intake?token=<qr_code_token>`,
   which Phase 3's admin scanner looks up directly against `submissions`.

This means a token only ever exists for a submission that's actually a row
in the database — never for an order that failed before creation, and never
guessed or generated client-side.

## Addresses

- `addresses` is now the source of truth (see `0002_addresses.sql`); `profiles`
  no longer carries flat `shipping_*` columns.
- Step 3 fetches the caller's saved addresses via `/api/addresses` (RLS-scoped)
  and lets them add a new one inline via `add-address-form.tsx`.
- A partial unique index enforces at most one `is_default` address per user;
  the API clears any existing default before inserting a new one.

## Notes on what's mocked vs. real

- **Pricing**: `/api/pricing` returns a deterministic pseudo-estimate today.
  See the comment block in `app/api/pricing/route.ts` for the exact swap
  point for TCGplayer / PriceCharting.
- **Auth**: route handlers call `supabase.auth.getUser()` via the
  session-scoped client, which reads the Supabase auth cookie. Wire up
  Supabase Auth (or your session provider) in the surrounding app for these
  to resolve a real user.
- **Payment**: `/api/checkout`, `/api/webhooks/stripe`, and
  `stripe-payment-form.tsx` are real, working Stripe integrations — they
  need live keys and a registered webhook endpoint to process an actual charge.

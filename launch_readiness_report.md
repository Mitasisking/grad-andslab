# Launch Readiness Report — 7 Days Out

Three subagents (`frontend-breaker`, `backend-auditor`, `financial-qa`) ran in parallel as rigorous, read-only adversarial code reviews, briefed on everything already fixed earlier tonight so they'd push into new territory rather than re-finding solved bugs. I reviewed every finding myself, verified the ones that were real, and fixed the ones worth fixing before launch. **Nothing has been committed, pushed, or deployed** — consistent with every other change tonight, that's a separate step for you to greenlight explicitly.

## Bugs found and fixed tonight

### 1. [CRITICAL] PayFast webhook had no replay protection — real oversell risk
**File:** `app/api/webhooks/payfast/route.ts`

PayFast is documented to redeliver ITN (payment notification) requests, and a captured raw POST could be replayed. The signature check and server-to-server validation only prove a notification genuinely came from PayFast — neither proves it hasn't already been processed. Concretely: a replayed *failed*-payment notification for a marketplace order would call `release_order_stock` again, unconditionally adding that stock back a second time — a real oversell path. A replayed *successful* notification would re-send the customer's confirmation email.

**Fixed**: every branch now gates its database update on the row still being `payment_status = 'pending'` (an atomic `UPDATE ... WHERE`, not a separate read-then-write), and only runs its side effect (stock release, confirmation email) when that update actually changed a row. A replay of an already-settled notification matches zero rows and does nothing.

### 2. [CRITICAL] Stale-order cleanup could clobber a payment that completed moments earlier
**File:** `app/api/shop/orders/release-stale/route.ts`

The cron that cancels abandoned carts read a list of "stale, still-pending" orders, then looped through cancelling each one and releasing its stock — with no re-check that the order was *still* pending by the time the loop got to it. If the PayFast webhook marked an order `paid` in the window between this route's read and its write (plausible for a slow EFT/redirect payment landing right around the 30-minute cutoff), this cron would still cancel it and release its stock anyway — clobbering a real sale and overselling the item.

**Fixed**: folded the pending/cutoff check directly into the `UPDATE` statement itself (`.eq('status', 'pending').lt('created_at', cutoff)`), so it only ever touches rows still pending at the exact moment it runs — a webhook (or an overlapping second cron run) that already moved an order off "pending" is invisible to this query, closing the race window entirely.

### 3. [CRITICAL] Bulk ACE Import's card search was unusable by keyboard
**File:** `app/admin/shop/bulk-ace-import/bulk-ace-import.tsx`

The search input hid its TCGdex results dropdown the instant it lost focus (`onBlur={() => setFocused(false)}`), which fires before Tab can move focus into one of the dropdown's own result buttons — so an admin using only a keyboard could never actually select a search result. The sibling implementation of this exact search (`components/submit/card-shipment-row.tsx`, the customer-facing version) already solved this correctly with a 150ms delay before hiding.

**Fixed**: applied the identical delayed-blur pattern. Verified by direct code comparison against the now-matching reference implementation — the precise sub-150ms focus-timing behavior isn't reliably observable through browser automation (screenshot round-trips exceed the window itself), so this one is confirmed by code parity with a proven pattern rather than a live click-through, unlike everything else tonight.

### 4. [Polish] Customer dashboard showed a hand-rolled `$` instead of the shared currency formatter
**Files:** `app/dashboard/page.tsx`, `app/dashboard/submissions/page.tsx`

Both pages built `` `$${Number(...).toFixed(2)}` `` by hand instead of using the existing `formatUSD` helper every other USD-denominated surface in the app already uses. Not a wrong-currency bug — `total_declared_value` is deliberately USD everywhere in this app (see the currency-policy note below) — just an inconsistency. **Fixed** to use `formatUSD`; verified live locally.

### 5. [Polish] Admin product routes leaked raw Postgres error text to the client
**Files:** `app/api/admin/products/route.ts`, `app/api/admin/products/batch/route.ts`

Same class of bug already fixed in `app/api/submissions/route.ts` in a prior session, not yet applied here. Lower severity since these are behind `requireAdmin()`, but still handed unfiltered DB error text back to an API client. **Fixed**: generic client-facing message, raw error logged server-side only — matching the existing pattern.

## Investigated, NOT changed — a policy question, not a bug

**`components/submit/step-grader-tier.tsx` shows GBP as the primary price with ZAR as a secondary "(Est. conversion)" line.** `financial-qa` initially flagged this as inverted from "ZAR primary, GBP bracket." I traced it further: this is a genuine, deliberate **multi-region pricing system** (`lib/submission-types.ts`'s `tierPriceForRegion` — USD for `'usa'`, GBP for `'uk'`, ZAR for `'sa'`, each independently priced, never converted from one another). For a UK-region customer, GBP genuinely *is* their foundational currency — flipping this page to force ZAR-primary would be wrong for that customer, not a fix. The "every financial metric ZAR-with-GBP-bracket" instruction traces back to your original ask about **the admin Financials dashboard** specifically (Annie's internal tool), which already does this correctly. I did not touch this file — flagging it here rather than silently declaring it fixed or silently leaving it unmentioned.

## Confirmed still-open (pre-existing, not fixed tonight, needs a decision)

- **Grader filter false-positive** (`components/shop/product-filters.tsx`'s `matchesGrader`): a bare title-substring match means a PCG-graded card titled with the real Pokémon mechanic "ACE SPEC" would incorrectly match the ACE grader filter. Already documented in the code itself as a known tradeoff — the real fix is a `products.grading_company` column, not a smarter regex. Unchanged from the earlier sweep tonight; still needs that schema decision.
- **PayFast integration's own header comment** (predates tonight): explicitly says IP allowlisting is not implemented, and the "not COMPLETE = hard failure" assumption hasn't been walked through PayFast's sandbox for intermediate statuses (e.g. EFT). I don't have sandbox credentials/access to do that walkthrough myself — this is real pre-launch work that still needs doing by whoever has that access.

## Everything else the audits checked and found clean

- **Frontend**: category/sub-category pills, franchise toggle, and browser back/forward all handled adversarial sequencing correctly — no new defects. TCGdex search edge cases (empty slash, whitespace-only numerator, leading zeros, long input) all degrade gracefully. Minor Note-for-later items not worth blocking launch over: no request timeout on TCGdex fetches (could hang with only "Searching…" as feedback), full-width/non-ASCII digits silently skip the number-search branch, cert-number dedup is case-sensitive, no cap on pasted cert-list size.
- **Backend**: RLS policies and money/stock CHECK constraints are consistently correct across `orders`/`order_items`/`bids`/`submissions`. Auction bid placement, shop checkout, and the `create_order()` race path were all independently re-confirmed safe. Minor Note-for-later: `auctions/close` has no row lock against a duplicate cron overlap (email-only impact, no financial risk); bid business rules are enforced only in application code, not a DB constraint (defense-in-depth item, not exploitable today).
- **Financial**: the ZAR/GBP bracket pattern is correctly implemented and secure everywhere it's currently used (admin Financials). Third-party market-estimate pricing (`admin/trends`, quoted natively in USD/JPY by external APIs) and customs-declaration USD figures (`packing-slip.tsx`) were correctly judged as not violating the ZAR/GBP policy — they were never ZAR figures to begin with.

## My assessment

The three critical fixes tonight (PayFast replay protection, the stale-order race, and the keyboard-inaccessible search) were genuine pre-launch risks — the first two specifically because they could have caused a real customer to be told their payment failed while their item quietly sold twice, which is exactly the kind of thing that's fine to catch now and very bad to discover after go-live. Fixing them tonight materially improves launch readiness.

I would **not** call this codebase fully launch-ready as of right now, for two reasons that are outside what a code review can fix:
1. **The PayFast integration itself still needs a real sandbox walkthrough** — its own code comments have said this since it was built, and that's still true. IP allowlisting is unimplemented, and PayFast's intermediate payment statuses for slower methods (EFT) haven't been confirmed against the real API. This needs someone with PayFast sandbox access, not another code pass.
2. **Two open items are product decisions, not bugs** — the ACE-SPEC grader misclassification needs a real `grading_company` column (a real, if small, schema/migration decision), and the currency-display policy would benefit from an explicit answer on scope (admin-only, or does it extend to the public shop and customer emails too) before more work goes into it either way.

Everything that could legitimately be fixed with a code review has been. What's left needs either sandbox access I don't have, or a decision only you can make.

## Verification

- `npx tsc --noEmit` — clean
- `npx eslint` on every changed file — clean (one unrelated, pre-existing lint error in `app/dashboard/page.tsx` was found incidentally — confirmed via `git stash` that it predates tonight's changes entirely; left untouched as out of scope)
- `npm run build` — compiles and generates all routes successfully
- Live-verified locally: dashboard USD formatting, TCGdex "240/193" search (from the prior fix, re-confirmed still working)
- Verified by code review and build success only (not live-simulated, given the risk of safely reproducing exact payment-webhook replays or race timing without a sandbox): the PayFast idempotency fix and the release-stale race fix

## Files changed

- `app/api/webhooks/payfast/route.ts` — idempotent updates gated on `payment_status = 'pending'`
- `app/api/shop/orders/release-stale/route.ts` — atomic UPDATE closes the TOCTOU window
- `app/admin/shop/bulk-ace-import/bulk-ace-import.tsx` — delayed blur restores keyboard access to search results
- `app/api/admin/products/route.ts`, `app/api/admin/products/batch/route.ts` — generic error responses, no raw DB error leak
- `app/dashboard/page.tsx`, `app/dashboard/submissions/page.tsx` — use the shared `formatUSD` helper

Ready for your review — say the word when you want any of this committed, pushed, or deployed.

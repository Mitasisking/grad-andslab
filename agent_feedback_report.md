# Agent Feedback Report — Hub-and-Spoke Orchestration

Orchestrated tonight per your instruction: a Frontend Subagent (category nav, PCG/ACE pills, TCGdex bulk importer) and a Backend Subagent (exchange-rate buffer, cert verification) ran in parallel, each doing a rigorous read-only adversarial review. Both returned complete, well-scoped reports on the first pass — neither needed re-invoking.

**Two corrections made to the brief before dispatching the subagents**, so they'd audit real code instead of chasing something that doesn't exist:
- There is no `/api/cert/ace` or `/api/cert/pcg` API route in this codebase. ACE/PCG cert verification is a client-side outbound link component (`components/dashboard/cert-link.tsx`) that just links to `acegrading.com`/`pcgpopreport.com` directly — a prior session explicitly declined to build a backend scraper for ToS/copyright reasons. The Backend Subagent audited the real component instead.
- The exchange-rate buffer is **3.5%**, not 5% (`supabase/migrations/0049_exchange_rates.sql`, `DEFAULT_BUFFER_PERCENT` in the cron route).

Also note: a separate adversarial sweep ran earlier tonight on almost this same surface area (shop filters, exchange-rate logic, cert links, bulk importer) and already found and fixed 3 bugs, since committed and deployed. Both subagents were briefed on that and told to sanity-check the fixes rather than re-report them — both confirmed the fixes are correct and present, then found genuinely new issues, listed below.

**Nothing in this report has been committed, pushed, or deployed.** Same as everything else tonight — that's a separate step for you to greenlight explicitly.

## Critical Bugs

### Fixed tonight

**1. Bulk ACE Import — an unhandled network failure could permanently stick the Save flow**
`app/admin/shop/bulk-ace-import/bulk-ace-import.tsx`, `handleCreateAll`. The `fetch()` call to `/api/admin/products/batch` had no `try/catch`. If the request itself rejected outright (offline, DNS failure, a deploy restarting mid-request — all realistic for this admin tool), the exception skipped the cleanup code entirely: every row stayed stuck on "Creating…", the button stayed stuck on "Saving…", and the double-submit guard (`submittingRef`) never reset — with no error message and no recovery short of a full page reload (losing all unsaved edits). **Fixed** with try/catch/finally: a network failure now marks every in-flight row `error` with a real message and always resets the button/guard.

**2. Bulk ACE Import — row inputs stayed editable while a save was in flight**
Same file, `ImportRow`. Inputs were only disabled once a row reached `status === 'saved'`, not while `status === 'saving'`. Since the POST payload is snapshotted at click-time, editing a field (e.g. price) while the request is in flight has zero effect on what's actually inserted — but once the response lands, the row disables showing the *edited* value, making it look like the edit was saved when the database actually has the pre-edit value. **Fixed**: inputs now disable for both `'saving'` and `'saved'`.

**3. Exchange-rate cron — a transient lookup failure could permanently and silently reset a custom buffer**
`app/api/cron/update-exchange-rate/route.ts`. The query reading the previous `buffer_percent` (to carry an admin's custom markup forward) discarded its `error` without checking it. If that specific lookup failed for any reason while the rate-provider fetch still succeeded, the code silently fell back to the 3.5% default — and because the table is append-only (each sync reads the *previous row*), that reverted value became permanent, not self-healing, until someone noticed and manually re-widened it. **Fixed**: a failed lookup now aborts the sync with a 500 instead of silently defaulting.

### Found, not fixed — needs a product decision

**4. Grader filter can misclassify a card based on unrelated title text**
`components/shop/product-filters.tsx`, `matchesGrader`. This does a bare substring match (`title.toUpperCase().includes(grader)`) because there's no dedicated `grading_company` column — a documented, deliberate tradeoff already (the code's own comment says so). The real problem: `"ACE"` is also literal text inside real Pokémon TCG card names ("Prime Catcher ACE SPEC," "Deluxe Ball ACE SPEC"). A PCG-graded card titled `"... ACE SPEC — PCG 10 Gem Mint"` would incorrectly match the ACE grader filter. I did not patch this with a smarter regex — the existing code explicitly warns that a better regex isn't the right fix, a real `products.grading_company` column is. That's a schema change, not an overnight patch, so it's flagged here for you to decide on rather than acted on unprompted.

## UI/UX Polish

### Fixed tonight (this pass and the earlier sweep)
- PCG/ACE sub-pills didn't reflect both graders being checked at once — fixed earlier tonight, sanity-checked again by the Frontend Subagent.
- Missing `aria-pressed`/`aria-current` on the pills and category tabs — fixed earlier tonight.
- **New this pass:** `handleParse` silently dropped already-saved rows from view if their cert number was removed from the raw text on a later parse — the product still existed in the shop, but it vanished from the admin's screen with no indication why. Fixed: a saved row now stays visible even if you edit it out of the cert-number box.

### Found, not fixed (low priority)
- Selecting a TCGdex card re-triggers the debounced search effect (since it's keyed on `row.title`, which the selection just changed), firing one redundant, harmless search request.
- The batch-save endpoint fails the whole batch with one generic error string if any row is invalid — no per-row diagnostic of which row caused it.

## Next Steps

- Add a real `products.grading_company` column so grader filtering stops depending on title text (see Critical Bug #4).
- The entire GBP/ZAR buffered exchange-rate pipeline is built, audited, and displayed on the admin Financials page — but `convertGbpToZar` has zero call sites anywhere pricing actually happens. Real submission tier pricing (`getSubmissionTierPrice`) and the customer-facing price label still use a static hand-set ZAR value. Worth a deliberate decision on whether/when to wire the live buffered rate into real pricing, since right now it protects nothing.
- Add runtime validation for TCGdex API responses (`lib/tcgdex.ts` currently does an unvalidated `as TcgdexCard[]` cast) — an upstream shape change would silently inject `undefined` rather than fail loudly.
- `scripts/simulate-major-test-2.js`, the pre-existing live adversarial test harness, is still unrun — Claude Code's safety classifier blocked it during the earlier autonomous sweep since it writes real data to the shared database. Worth running with you at the keyboard, followed by `node scripts/teardown-major-2.js`.

## Verification

- `npx tsc --noEmit` — clean
- `npx eslint` on every changed file — clean
- `npm run build` — compiles successfully

## Files changed this pass

- `app/admin/shop/bulk-ace-import/bulk-ace-import.tsx` — fetch try/catch/finally, disable inputs while saving, preserve saved rows across re-parse
- `app/api/cron/update-exchange-rate/route.ts` — abort sync on a failed buffer_percent lookup instead of silently defaulting

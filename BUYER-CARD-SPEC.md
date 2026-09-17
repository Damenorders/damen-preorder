# Buyer card — implementation spec

For Claude Code, working in this repo.

**Read this whole file before writing code.** Then read the existing app,
and tell me how you'd fit this in **before changing anything.**

Reference implementation of the same logic:
`order-book/order-book-core.js` (pure functions, no UI) and
`order-book/order-book-reference.html` (a working version, different data source).

The catalogue view that maintains the data this card consumes is specified
separately in `SUPPLIERS-TAB-SPEC.md`. Build both, or build this one against
the data model described there.

---

## 1. What this is

A card in the app where a buyer types a product, picks it out of **our own
product catalogue — the things we sell**, and the line lands on the correct
supplier's open purchase order.

The buyer should never have to pick a supplier when we already know it, and
should never be able to guess one when we don't.

## 2. The thing that makes this non-trivial

Our catalogue is a **sales** catalogue. It holds what we sell to clients, often
priced per kilogram. Purchasing happens in **cases, boxes and pallets** from a
supplier, in that supplier's pack size.

These are not the same unit and not the same product record. So a catalogue
product needs purchasing information attached to it, and most products do not
have it yet. Acquiring that information, one product at a time, as buyers work,
is half the point of this card.

**Do not** reuse the selling unit as the ordering unit. **Do not** derive a
pack size from a selling price or a weight. If purchasing information is
missing, ask for it.

## 3. Data model

Add to each catalogue product (names are indicative — follow repo conventions):

```
sourcing: {
  supplierId,        // who we buy it from
  supplierSku,       // their code for it, optional
  purchasePack,      // e.g. "6 X 2.84L", "24 X 500G" — free text, as printed
  purchaseUnit,      // "case" | "pallet" | "box" | "bag" | "each"
  assignedAt,        // timestamp
  assignedBy         // user id
}
```

`sourcing` is absent or null until someone assigns it. One product may have
more than one supplier over time — model `sourcing` as an array with one entry
flagged preferred, if that is cheap to do now. If it is not, a single entry is
acceptable, but **do not** make it impossible to add a second later.

Suppliers need at minimum: `id`, `name`, `contact`, `email`, and any aliases
they are known by.

Purchase orders:

```
purchaseOrder: {
  id, supplierId,
  status: "open" | "ordered",
  method: "delivery" | "pickup",   // default "delivery"
  wantedFor,                       // YYYY-MM-DD, may be empty
  orderedOn,                       // set when status becomes "ordered"
  lines: [{ id, productId, qty, unit, nameAtTime, packAtTime }]
}
```

Store `nameAtTime` and `packAtTime` on the line. History must record what was
ordered, not what the product is called today.

## 4. Product identity rules — non-negotiable

These govern matching everywhere, not just this card.

**The same item written differently is the SAME product.** Ignore case,
punctuation, spacing, word order, brand prefixes, abbreviations and typos.

**A different pack, format or size IS a different product.** `6 X 100OZ` and
`6 X 2.84L` are two products. Half sheet and full sheet are two products. Never
merge across these.

**When unsure, ask.** Never merge on a guess and never create a second entry
"to be safe". A wrong merge silently corrupts price history; a wrong split is
visible and trivially fixed. Prefer the visible failure.

Normalisation, exactly as implemented in `order-book-core.js`:

```js
normalizeName(s) // uppercase, [^A-Z0-9]+ -> single space, trim
normalizePack(s) // uppercase, "," -> ".", [^A-Z0-9.]+ -> single space, trim
```

Similarity, used only to decide whether to *ask*, never to act:

```js
// words of 3+ chars; shared / min(countA, countB) >= 0.7
looksSimilar(a, b)
```

Known limitation, leave it as is: compound spellings such as "BREADCRUMB"
against "BREAD CRUMBS" fall under the threshold and are reported as no match.
Strict is the correct failure direction here.

## 5. Buyer card behaviour

Input: quantity, unit, product. **No supplier field.**

Typeahead searches the catalogue on normalised name, pack and supplier name,
matching words in any order. Each suggestion shows the product, its pack, and
its assigned supplier — or a clear "no supplier yet" marker. The buyer must be
able to see where a line is going before committing.

On submit, resolve in this order:

**a. Exactly one catalogue match, sourcing assigned.**
Add to that supplier's open order. Use `purchasePack` and `purchaseUnit` from
sourcing. Confirm which supplier it went to.

**b. Exactly one catalogue match, no sourcing.**
Open the assignment flow (section 6). Do not add the line until it completes.

**c. Several catalogue matches.**
Ask which, listing each with pack and supplier. No default, no auto-pick.

**d. No exact match, one or more similar.**
Offer the similar ones with their suppliers, plus an explicit "none of these".
Never auto-select, however close.

**e. No match at all.**
Say so plainly. Offer to create a catalogue product, carrying across what was
typed. Never invent a pack size, price or supplier to fill the form.

**f. Quantity or unit missing or unparseable.**
Ask. The quantity box may be pre-filled with 1, as the Order Book's is — a
visible default the buyer can see and overwrite is fine. What is not fine is
filling in a quantity the buyer cannot see, or inferring a unit from the pack
text. If the box is cleared, refuse and ask rather than falling back to 1.

Repeating a product already on that supplier's open order **at the same unit**
increases the existing line. Different unit, different line.

## 6. Supplier assignment flow

Triggered by case (b). The buyer is told the product has no supplier yet, and
asked to supply:

- **Supplier** — from existing suppliers, with a clearly separate path to create
  a new one. Match typed supplier names with `normalizeName` so "Fra Di",
  "FRA-DI" and "fradi" resolve to the existing record rather than creating a
  duplicate supplier.
- **Purchase pack** — required, free text, entered as printed on the invoice.
- **Purchase unit** — required, chosen from the list.
- **Supplier SKU** — optional.

On save: persist `sourcing` on the **catalogue product**, not on the order line,
so the next buyer never answers this question again. Then add the line and
confirm both facts — what was assigned and where the line went.

The buyer must be able to cancel. Cancelling assigns nothing and adds nothing.

Assignment is a catalogue edit. Gate it behind whatever permission governs
catalogue edits in this app; if buyers lack that permission, queue it for
someone who has it rather than silently dropping it.

## 7. Order lifecycle

- **Mark as ordered** — confirm first, stating supplier and line count. Sets
  `status: "ordered"` and `orderedOn`. The open order is emptied. Catalogue is
  untouched.
- **Undo** — returns an ordered PO's lines to the open order, merging by the
  same identity rule, restoring `method` and `wantedFor`. Confirm first, and
  warn when lines are already open for that supplier.
- **History is never rewritten.** Renaming a product updates the catalogue and
  any open lines. Past orders keep `nameAtTime` and `packAtTime`.

## 8. Copy order

Delivery/pickup and a wanted-for date are per supplier, per open order.
Default `delivery`, no date.

Exact output format:

```
Hello [contact], I would like to order the following products for [delivery|pickup] on [date] : 

- 2 pallet PRODUCT NAME (PACK SIZE)
- 12x ANOTHER PRODUCT (PACK SIZE)


Please Confirm
Thank you
```

- Hyphen bullets, not asterisks. Asterisks get auto-formatted by mail clients.
- `2 pallet` for named units; `12x` for each-units.
- Pack size in brackets. It is what distinguishes two otherwise identical
  products, and omitting it causes wrong deliveries.
- Missing date renders as `____`, never silently dropped.
- Missing contact renders as `there`.
- Long date form: `September 15, 2026`. A French variant exists in
  `order-book-core.js`; use it if the app is localised.

## 9. Traps already hit — do not rediscover

1. **`confirm()`, `alert()` and `prompt()` fail silently in sandboxed iframes
   and webviews.** They do not throw; `confirm()` returns `false`. This made
   buttons look dead and made a duplicate check fail *open*, creating
   duplicates instead of asking. Use in-app dialogs.
2. **Guard every `localStorage` / `sessionStorage` access in try/catch.** An
   unguarded read at startup throws on a restricted origin and blanks the page.
3. **Deep-clone when moving lines into history.** The obvious implementation
   keeps a reference to the live array, so later edits rewrite history.
4. **Concurrent edits are real.** Two buyers will hit this at once. Use the
   repo's existing concurrency approach; do not last-write-wins a whole order
   document.

## 10. Acceptance criteria

Write tests for these. All must pass before saying it works.

| # | Given | Then |
|---|---|---|
| 1 | Product with sourcing, typed exactly | Line on the right supplier, pack from sourcing, supplier named back |
| 2 | Same product typed lowercase with stray punctuation | Same result as #1, no new catalogue entry |
| 3 | Product with no sourcing | Assignment flow opens; nothing added until saved |
| 4 | Assignment saved | `sourcing` persists on the catalogue product; a second buyer is not asked again |
| 5 | Assignment cancelled | No line, no sourcing, no supplier created |
| 6 | Typed supplier "fra di" where "Fra-Di" exists | Resolves to the existing supplier, no duplicate |
| 7 | Two catalogue products match | Buyer is asked; no auto-pick |
| 8 | Close-but-inexact name | Candidates offered with suppliers; "none of these" available |
| 9 | No match | Clear message; create-product path; nothing invented |
| 10 | Blank quantity | Asked, not defaulted to 1 |
| 11 | Same product added twice, same unit | One line, quantities summed |
| 12 | Same product added twice, different units | Two lines |
| 13 | Same name, different pack | Two distinct products, never merged |
| 14 | Mark ordered, then undo | Lines return and merge; method and date restored |
| 15 | Rename a product after a past order | Past order still shows the old name |
| 16 | Copy order | Byte-for-byte the format in section 8 |

## 11. Parity with the Order Book

The Order Book at `order-book/order-book-reference.html` is the behavioural
reference. It is in daily use and its behaviour has been tested against real
orders. **When this spec and the Order Book disagree, the Order Book wins** —
except on the four points listed as deliberate differences below.

Behaviour that must match exactly:

- Name normalisation and the 0.7 similarity threshold, including the compound
  word limitation
- Different pack = different product, with no exception
- Merge on repeat at the same unit; separate line at a different unit
- Typeahead showing product, pack and supplier before committing
- Supplier resolved automatically on a unique match, with the supplier named
  back in the confirmation
- Ask on multiple matches; offer candidates on a near-miss; refuse to guess on
  no match, and carry the typed text into the create-product path
- Mark ordered / undo, with merge on undo and warning when lines are open
- History never rewritten by a later rename
- Copy output byte-for-byte as section 8
- Delivery/pickup plus wanted-for date, per supplier, defaulting to delivery
  with no date, and `____` shown when the date is missing
- Collapsed by default; search across the whole catalogue; in-app dialogs only

Deliberate differences, all four requested or forced by the app:

1. **Source of truth is the sales catalogue**, not a per-supplier list. The
   Order Book's products belong to a supplier by construction; ours do not.
2. **Supplier assignment flow.** Has no equivalent in the Order Book, because
   an unassigned product cannot exist there.
3. **Purchase pack and unit are stored separately from the selling unit.** The
   Order Book has one unit per product; we sell per kilogram and buy per case.
4. **Concurrency.** The Order Book is single-user. This is not.

## 12. Out of scope

Do not add: price tracking on this card, supplier performance metrics,
automatic reorder suggestions, or anything that fetches product data from an
external source. Nothing enters the catalogue that a person did not type.

# Suppliers tab — implementation spec

Companion to `BUYER-CARD-SPEC.md`. Same rules, same reference implementation
(`order-book/order-book-reference.html`). Read both before writing code.

Where this spec and the Order Book disagree, **the Order Book wins.**

---

## 1. What it is

The catalogue view. Every supplier, every product we buy from them, what it
costs, what we sell it for, and the margin between. It is where sourcing data
is maintained — the Buyer card consumes what this view produces.

It is not an order screen. Nothing here adds to an order.

## 2. Layout

```
[ search box .......................................... ] [Clear]

▸ Fra-Di                                          2 products
▾ JFC                                            11 products
    Order to [Miyoko        ] [email              ]

    Product                    Cost     Sell   Margin   Cost set
    ────────────────────────────────────────────────────────────
    [SANGARIA RAMUNE MELON  ]  [    ]   [    ]     —        —     ×
    [18X200ML               ]
    ...
    [Product] [Pack size] [Cost] [Sell]  (Add product)

▸ LordFord                                       10 products
...

  Add a supplier:  [name] (Add supplier)
```

**Every supplier block starts collapsed.** The header shows the supplier name
and its product count, so the whole catalogue fits on one screen and you open
only what you need. Clicking the name or the triangle toggles it.

Collapse state is per viewer, held for the browser session only, and namespaced
separately from the Next order tab — folding a supplier in one view must not
fold it in the other.

## 3. Search

One box, top of the tab, searching **across all suppliers at once**.

- Matches against product name, pack size and supplier name, combined
- Uses `normalizeName` — case, punctuation and spacing are ignored
- Terms match in any order: "paper rice" finds "TS - SQUARE RICE PAPER 22CM"
- All terms must be present (AND, not OR)
- When every term lands on the supplier's own name, the supplier is the hit:
  it shows all of its products and its plain count, and it stays in the list
  even when we hold no products for it yet — otherwise a supplier with an
  empty catalogue could not be reached at all
- Suppliers with no match are hidden entirely
- Matching suppliers **expand automatically**, overriding collapse state
- Each header shows `3 of 12 match` instead of the product count
- A total line below: `4 products in 2 suppliers`
- No match: a plain message naming what was searched for
- A Clear button appears while searching; leaving the tab also clears it

**Both add forms are hidden while a search is active** — add-product and
add-supplier. This prevents adding a product to the wrong supplier while
looking at a filtered view.

Searching the whole catalogue is how you spot the same item held by two
suppliers at different prices. Do not scope the search per supplier.

## 4. Contact row

Under each expanded supplier: `Order to [contact] [email]`, both inline
editable, saving on blur. These feed the copy-order greeting and the `To:` line.

Blank contact is allowed; the message falls back to "Hello there,".

## 5. Product table

| Column | Behaviour |
|---|---|
| Product | Two stacked inputs — name, then pack size. Both editable. |
| Cost | Number input, blank allowed, shown as `—` when empty |
| Sell | Number input, blank allowed |
| Margin | Computed, read-only |
| Cost set | Date the cost was last changed, read-only |
| × | Remove from catalogue |

**Margin** is `(sell − cost) / sell × 100`, displayed as a whole percent with
the dollar difference beneath it. It shows `—` unless both cost and sell are
present. Under 15% it renders in the warning colour. Margin is never stored —
always derived, so it cannot go stale.

**Cost set** is stamped automatically whenever cost changes, and cleared when
cost is cleared. Nobody types it. It answers "has this gone up since last
time", which is the question that matters at reorder.

## 6. Editing a product

Name and pack are editable because suppliers rename things, and because a pack
size is often mistyped on first entry.

On commit:

1. **Blank name is refused** — revert the field, tell the user why.
2. **Duplicate guard.** If the new name+pack would match another product of the
   same supplier under `normalizeName`/`normalizePack`, refuse the edit, revert
   the field, and explain. This is the identity rule enforced from the editing
   side — without it you can create by renaming the duplicate the add flow
   prevents.
3. **Propagate to open orders.** Any open line matching the product's *old*
   name and pack is updated to the new ones, and the user is told how many
   lines moved. Otherwise catalogue and orders drift apart.
4. **Never touch history.** Past orders keep the name and pack recorded at the
   time. A past order is a record of what was actually ordered.
5. A purely cosmetic change (normalises to the same value) just saves.

Changing a pack size makes it a different product by the identity rule. If the
user meant to add a second format, they add a new product instead. Do not
offer to "split" — that is a guess about intent.

## 7. Adding a product

Fields: product, pack size, cost, sell. Cost and sell optional.

Runs through the same `matchProduct` used everywhere:

- **Exact match already on file** → do not create a duplicate. Update cost and
  sell if supplied, stamp the cost date, and say which entry was updated.
- **Similar, same pack** → ask. "Same product" updates the existing one;
  "Add separately" creates a new one. Never decide this silently.
- **Different pack** → always a new product, no prompt.

## 8. Adding a supplier

Name only. Match against existing suppliers with `normalizeName` so "fra di"
resolves to "Fra-Di" rather than creating a second record. Contact details are
filled in afterwards on the contact row.

## 9. Removing a product

Confirm first, naming the product and supplier, and state plainly that past
orders are unaffected. Removal takes it out of the catalogue only.

Do not offer removal of a supplier that has open lines or history without a
much louder confirmation; prefer not to support it at all in v1.

## 10. Read-only mode

If the viewer lacks catalogue-edit permission: inputs render as plain text,
both add forms and the × buttons are hidden, and search and collapse still
work. Do not render disabled inputs that look editable.

## 11. Managing a supplier

A **Manage** button on every supplier header, editors only. It opens a dialog
holding the supplier's own fields — the product rows are edited in the table,
and order-to contact and email stay on the contact row (§4).

- **Name.** Required. Refused when it lands on another supplier's name or any
  of its aliases, under `supplierKey` — that is how a supplier ends up as two
  records with its prices and orders split between them. The old spelling is
  kept as an alias, so a pickup typed the old way still resolves here instead
  of filing a second record.
- **Address.** Free text, trimmed, never looked up. This is the address the
  pickup sheets print.
- **Delete.** Confirmed in a second dialog stage, never `confirm()`.
  - Nothing points at it → the row is deleted and audited.
  - It holds products, purchase orders or pickups → **refused**, naming what
    holds it, with **Hide it instead** offered. Hiding sets `active = false`:
    it leaves the Suppliers tab, the pickup list and the buyer's supplier list,
    keeps everything it holds, and adding the name back returns the same
    record (§8 reactivates it). This is §9's "much louder confirmation",
    settled: history is never deleted to make a name go away.

## 12. Known gaps — decide before building

The Order Book does not have these. Flag them to me rather than inventing a
design:

- **No price history.** Only the latest cost and the date it changed are kept.
  "Has this gone up, and by how much" cannot be answered. If the app stores
  cost changes, a small history per product would be worth more than anything
  else in this view.
- **No per-supplier terms** — no minimum order, lead time, order-by day or
  account number. Real buying needs at least lead time and minimum.
- **No supplier-side pack/unit defaults.** Each product carries its own.

## 13. Acceptance criteria

| # | Given | Then |
|---|---|---|
| 1 | Tab opened | All suppliers collapsed, counts visible |
| 2 | Click a supplier | Expands; contact row, product table and add form visible |
| 3 | Search "sesame" | Only matching suppliers shown, auto-expanded, `n of m match` in header |
| 4 | Search "paper rice" | Finds "TS - SQUARE RICE PAPER 22CM" (word order ignored) |
| 5 | Search active | Both add forms hidden |
| 6 | Leave and return to tab | Search cleared, suppliers collapsed again |
| 7 | Enter cost 48, sell 67 | Margin shows 28% and $19.00; cost date set to today |
| 8 | Clear the cost | Margin shows `—`; cost date cleared |
| 9 | Cost 60, sell 65 | Margin renders in the warning colour (under 15%) |
| 10 | Rename a product | Catalogue and any open order lines updated; count reported |
| 11 | Rename onto an existing product at the same pack | Refused, field reverted, reason shown |
| 12 | Rename to blank | Refused, field reverted |
| 13 | Rename after a past order | Past order still shows the old name |
| 14 | Add a product that already exists at that pack | No duplicate; prices updated instead |
| 15 | Add a similar product at the same pack | Asked; both answers behave correctly |
| 16 | Add a supplier named "fra di" when "Fra-Di" exists | Resolves to the existing supplier |
| 17 | Remove a product | Confirmed first; past orders unchanged |
| 18 | Read-only viewer | No editable inputs, no add forms, search still works |
| 19 | Search a supplier name | That supplier shown and expanded with all its products, plain count; found even with no products |
| 20 | Manage → rename onto another supplier | Refused, naming the supplier that holds it; old spelling kept as an alias on a rename that goes through |
| 21 | Manage → delete a supplier nothing points at | Confirmed, then the record is deleted |
| 22 | Manage → delete a supplier holding products, orders or pickups | Refused, naming what holds it; hide offered instead |

## 14. Out of scope

No price lookups from external sources. No supplier scoring. No automatic
margin targets. Nothing enters the catalogue that a person did not type.

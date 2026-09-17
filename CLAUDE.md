@AGENTS.md

# Supplier ordering (Purchase Orders) — project context

This file is loaded automatically at the start of every Claude Code session in
this folder. It carries the rules and points at the reference material in
`order-book/`.

## Start here

If this is your first session in this folder, do this before writing any code:

1. Read `order-book/README.md`, then `order-book/order-book-core.js`.
2. Look at the existing app in this folder — its stack, structure and
   conventions.
3. Tell me how you would wire supplier ordering in, and **wait for my answer.**
   Do not start editing.

## What is in `order-book/`

| File | What it is |
|---|---|
| `order-book-core.js` | Matching rules, order operations, message builder. No dependencies, no DOM. |
| `order-book-data.json` | Real supplier and order data, exported from the working version. |
| `order-book-reference.html` | The whole working app in one file. Open it in a browser to see the behaviour. |
| `README.md` | Handover notes, including bugs already found and fixed. |

`order-book-core.js` is logic only. The UI, persistence and clipboard handling
are not in it — see the reference HTML for how they were done there.

## Data rules — these are not negotiable

The value of this data is that it is accurate. A wrong price or a duplicated
product is worse than a missing one.

- **Never invent data.** No supplier, product, pack size, cost or selling price
  from an outside source, from a website, or from your own knowledge. Only what
  the user states directly. If a quantity or unit is missing, ask.
- **The same item written differently is the SAME product.** Ignore
  punctuation, spacing, word order, brand prefixes, abbreviations and typos.
  "TS - SQUARE RICE PAPER 22CM" and "ts square rice paper 22 cm" are one item.
- **A different pack, format or size IS a different product.**
  6 X 100OZ vs 6 X 2.84L. Half sheet vs full sheet. Never merge across these.
- **When unsure whether two entries are the same item, ask.** Do not add a
  second entry to be safe, and do not merge on a guess. A wrong merge quietly
  corrupts price history; a wrong split is obvious and easy to fix.

## Behaviour rules

- Do not add features I have not asked for.
- Tell me when something I have asked for is a bad idea, and why.
- Test what you build before telling me it works. If you cannot test it, say so.

## Known traps

These already cost time once. Do not rediscover them.

1. **`confirm()`, `alert()` and `prompt()` fail silently in a sandboxed iframe
   or webview.** They do not throw — `confirm()` simply returns `false`. This
   made buttons look dead, and made a duplicate check fail *open*, creating
   duplicates instead of asking. Build in-page dialogs instead.
2. **Guard every `localStorage` / `sessionStorage` access in try/catch.**
   An unguarded read at startup throws on a restricted origin and kills the
   page before it renders.
3. **Deep-clone when moving an order into history.** The obvious version keeps
   a reference to the live line array, so later edits silently rewrite history.

## The order message format

Exact wording, already agreed. `buildOrderMessage()` in the core module
produces it:

```
Hello [contact], I would like to order the following products for [delivery|pickup] on [date] : 

* 2 pallet PRODUCT NAME (PACK SIZE)
* 12x ANOTHER PRODUCT (PACK SIZE)


Please Confirm
Thank you
```

Quantities read `2 pallet` for named units and `12x` for each-units. Pack size
is included in brackets because it is what distinguishes two otherwise
identical products. A missing date renders as `____` rather than being dropped.

## Decisions taken in this repo (2026-09-17)

- Order message bullets are hyphens (`- `), per BUYER-CARD-SPEC §8 and the
  Order Book as used on 2026-09-17; `order-book-core.js` still shows `* `.
- A blank quantity is refused, never defaulted to 1 (BUYER-CARD-SPEC §5f).
- `order-book/order-book-data.json` is the current data; the state embedded in
  `order-book-reference.html` and the counts in its README are older.
- Sell price in the Suppliers view is per purchase pack, stored on the
  sourcing row — not the uploaded per-selling-unit price in `item_prices`.
- The uploaded price file leads on product wording; a rename made in the
  Suppliers view is replaced by the next upload that includes that product.

# Order Book — handover notes

Four files. `order-book-core.js` on its own is **not** enough to build the app.

| File | What it is | Reusable? |
|---|---|---|
| `order-book-core.js` | Matching rules, order operations, message builder | Yes — no dependencies, no DOM |
| `order-book-data.json` | Your actual suppliers, products and orders | Yes — plain JSON |
| `order-book-reference.html` | The whole working app, one file | As a reference, not a drop-in |
| `README.md` | This file | — |

## What is NOT in the core module

It is logic only. You still have to build or port:

- **The interface.** Tabs, the collapsible supplier blocks, editable quantity
  cells, the price table with the margin column, the product search. All of
  that lives in `order-book-reference.html` and is tied to its own markup.
- **Persistence.** The core takes state in and hands state back. Where you
  keep it — file, localStorage, SQLite, a server — is your call.
- **Copy to clipboard.** `buildOrderMessage` returns a string; putting it on
  the clipboard is UI work.
- **The confirmation prompts.** When `addLine` returns `needsDecision`, your
  UI has to ask the question and call `addLine` again with the answer.

## Three things that cost me time — don't rediscover them

**1. `confirm()`, `alert()` and `prompt()` silently fail in a sandboxed
iframe.** They don't throw. `confirm()` just returns `false`, so buttons look
dead. If your app renders in an iframe or a webview, build your own dialogs.
This broke "Mark as ordered" and, worse, made the duplicate check fail *open* —
it would have created duplicates instead of asking.

**2. Guard every `sessionStorage` / `localStorage` call.** Access throws
outright on an opaque origin or with storage restricted, and an unguarded read
at startup kills the whole page before it renders.

**3. Wrong merges are harder to undo than wrong splits.** This is why
`matchProduct` returns three outcomes rather than a boolean. Merging on a
guess quietly corrupts price history with no error to notice.

## The rules the data depends on

These are not enforceable by code alone — they are how the data must be
maintained, whoever or whatever is editing it:

- **Never invent data.** No supplier, product, pack size, cost or selling
  price from an outside source or from memory. Only what the user states.
  If a quantity or unit is missing, ask.
- **Same item written differently is the SAME product.** Ignore punctuation,
  spacing, word order, brand prefixes, abbreviations, typos.
- **A different pack, format or size IS a different product.**
  6 X 100OZ vs 6 X 2.84L. Half sheet vs full sheet. Never merge across these.
- **When unsure, ask.** Do not add a second entry to be safe.

## Data shape

See the JSDoc at the top of `order-book-core.js`. One trap: in
`markOrdered`, the history entry holds a *reference* to the open line array.
The core module deep-clones to avoid this; if you reimplement, don't skip it.

## State of the data as exported

5 suppliers, 23 products, 7 lines on the next order, 1 past order.
**No cost or selling prices have been entered yet** — every `cost` and `sell`
is `null`. The margin column and the per-kg style comparisons only become
useful once those are filled in.

# Claude Code Kickoff Prompt — Damen Preorder System

> How to use: Put your full spec in the project root as `SPEC.md`. Then paste the prompt below as your first message in Claude Code. Work phase by phase — approve each phase before moving to the next.

---

## The Prompt (paste everything below this line)

You are building an internal preorder web application for Damen Service Alimentaire. The complete specification is in `SPEC.md` in this directory — read it fully before writing any code. It is the source of truth for all requirements. If anything in my messages ever conflicts with SPEC.md, ask me before proceeding.

## Stack (use exactly this)

- **Framework:** Next.js 14+ (App Router) with TypeScript
- **Database:** PostgreSQL via Supabase
- **ORM:** Drizzle (typed schema, clean migrations, easy CSV export later)
- **Auth:** Supabase Auth, email-based login, with a `role` column (`admin` | `buyer` | `rep`) on the users table driving all access control
- **Styling:** Tailwind CSS — mobile-first, white background, soft grey borders, rounded cards, one accent color, large touch targets
- **Realtime sync:** Supabase Realtime subscriptions so rep submissions, buyer status changes, and edits appear across all logged-in users without refresh (the "one universal sheet" requirement in SPEC.md §26)
- **Exports:** CSV first (Odoo-compatible per SPEC.md §21–23); Excel and PDF are post-MVP
- **Deployment target:** Vercel (frontend) + Supabase (database/auth) — set up env vars so I can deploy when ready

## Hard rules (never violate)

1. **Role-based access is enforced server-side**, not just hidden in the UI. Reps must never be able to fetch buyer table data, buyer statuses, or other reps' editable records via API, even with direct requests. Use Supabase Row Level Security policies plus server-side checks.
2. **Rep edit rule:** reps can edit only their own submissions, and only while `submission_status = 'Pending'`.
3. **Two separate status fields** on orders, exactly as defined in SPEC.md §11–12: `submission_status` (Pending / Ready / Shipped — visible to reps) and `buyer_table_status` (Pending / Ordered / Received / Pending Delivery / Pending Pickup — buyer/admin only).
4. **Specs stored both ways** per SPEC.md §25: a readable string (`10/12 · Skin On · Bone Off · …`) and a structured `specs_json` column.
5. **Odoo-ready fields on every important record** per SPEC.md §22: `external_id` (format `damen_order_000001` etc.), `odoo_id`, `odoo_sync_status`, `last_synced_at`.
6. **Audit log** every change to quantity, weight, delivery date, product, status, and notes: who, what, old value, new value, timestamp (SPEC.md §27).
7. **Buyer table default sort** per SPEC.md §19: delivery date → status priority (Pending, Ordered, Pending Delivery, Pending Pickup, Received last) → updated time. This ordering survives all filters.
8. **Dynamic forms:** product questions appear only after a product is chosen (SPEC.md §7–8). Never render all questions at once. Build the product/question definitions as data (in the `products` table or a config), not hardcoded JSX, so Meat/Fish/Other inputs can be adjusted later without code changes.

## Seed data

Create these four users (the three from SPEC.md §3 plus a second admin, orders@damenalimentaire.com) and a handful of sample clients and fish products (Salmon and Loup de Mer with the exact spec options from SPEC.md §8) so every screen is testable immediately:

- Orders — orders@damenalimentaire.com — Admin (primary admin; also the account owner for all infrastructure)
- Vinny — vincent@damenalimentaire.com — Admin
- David — david@damenalimentaire.com — Buyer
- Commandes — commandes@damenalimentaire.com — Rep

## Build phases (follow SPEC.md §29; stop for my approval after each phase)

**Phase 1 — Foundation:** project scaffold, Drizzle schema for all six tables (users, clients, products, orders, order_lines, audit_logs per SPEC.md §24), migrations, seed script, Supabase Auth login, role-based routing to the three dashboards.

**Phase 2 — Rep flow:** rep dashboard (3 sections), dynamic fill form (multi-line orders: one header, many lines), rep submissions page (filtered by module, sorted by submission date, compact rows that expand to full detail), rep edit form with the Pending-only rule.

**Phase 3 — Buyer flow:** buyer dashboard, all-submissions page with full filtering (SPEC.md §14), buyer table with the exact columns from §17, filters from §18, dynamic sorting from §19, and status management. Default view: status Pending + delivery date today/tomorrow.

**Phase 4 — Buyer tools & exports:** grouped buying sheet (§20), CSV export mapped to Odoo conventions, audit history view for admin.

**Phase 5 — Polish & launch:** mobile pass on every screen, empty/loading/error states, full workflow test (rep submits → buyer sees instantly → buyer changes status → rep sees update), deploy to Vercel.

After each phase: run the app, verify it works, summarize what was built and what I should test before we continue.

Start with Phase 1 now.

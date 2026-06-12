# Damen Preorder

Internal preorder system for Damen Service Alimentaire. Full requirements live
in [SPEC.md](./SPEC.md) — that file is the source of truth.

**Stack:** Next.js (App Router, TypeScript) · Supabase (Postgres + Auth) ·
Drizzle ORM · Tailwind CSS · deployed on Vercel.

## First-time setup

1. Copy the env template and fill in your Supabase values
   (Dashboard → Project Settings → API, and → Connect for the pooler string):

   ```
   copy .env.example .env.local
   ```

2. Install, migrate, and seed:

   ```
   npm install
   npm run db:setup
   ```

   The seed creates the four login accounts (password printed at the end),
   five sample clients, and the Salmon / Loup de Mer products with their
   dynamic form definitions.

3. Run it:

   ```
   npm run dev
   ```

   Open http://localhost:3000 — you'll be redirected to the login page.

## Login accounts (seeded)

| Email | Role |
|---|---|
| orders@damenalimentaire.com | Admin |
| vincent@damenalimentaire.com | Admin |
| david@damenalimentaire.com | Buyer |
| commandes@damenalimentaire.com | Rep |

Default password is `Damen2026!` (or `SEED_USER_PASSWORD` from `.env.local`).
Change these before launch: Supabase → Authentication → Users.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate a new migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations in `./drizzle` |
| `npm run db:seed` | Seed users/clients/products (idempotent) |
| `npm run db:setup` | Migrate + seed |

## Architecture notes

- **All app data access goes through the Next.js server** (Drizzle), gated by
  `requireRole()` in `src/lib/auth.ts`. Row Level Security + column grants
  (`drizzle/0001_rls_policies.sql`) additionally lock down the direct Supabase
  REST path: reps can only ever see their own orders, and
  `orders.buyer_table_status` is not readable by any client JWT at all.
- **Dynamic forms are data, not code** — each product row carries a
  `form_config` JSON (see `src/lib/product-config.ts`), so product questions
  can be changed without touching JSX.
- **Odoo-ready** — every business record carries `external_id`, `odoo_id`,
  `odoo_sync_status`, `last_synced_at` per SPEC.md §22.

## Deploying to Vercel

Set these environment variables in the Vercel project:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`. Then add the production URL in
Supabase → Authentication → URL Configuration.

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Server-only database client. Connects with the database owner role, so RLS
// does not apply here — every query path through this client MUST go through
// the role checks in src/lib/auth.ts. RLS protects the direct Supabase API
// path; this protects the app path.

type Db = PostgresJsDatabase<typeof schema>;

declare global {
  var __damenDb: Db | undefined;
}

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (see .env.example)");
  }
  // prepare: false — required for Supabase's transaction-mode pooler
  const client = postgres(url, { prepare: false });
  return drizzle(client, { schema });
}

function getDb(): Db {
  // Lazy init (so `next build` works without env vars) + cached across dev
  // hot reloads so we don't exhaust database connections.
  if (!globalThis.__damenDb) {
    globalThis.__damenDb = createDb();
  }
  return globalThis.__damenDb;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const value = getDb()[prop as keyof Db];
    return typeof value === "function" ? value.bind(getDb()) : value;
  },
});

export * from "./schema";

import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users, type Role, type User } from "@/db/schema";

export function homePathFor(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "buyer":
      return "/buyer";
    case "rep":
      return "/rep";
    case "picker":
      return "/picker";
    case "scheduling":
      return "/scheduling";
    case "clients":
      return "/apply";
  }
}

/**
 * The Supabase pooler very occasionally rejects a correct password when
 * opening a fresh connection (transient 28P01). One short retry absorbs it
 * instead of surfacing a 500 to the user.
 */
async function withRetry<T>(query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return query();
  }
}

/**
 * Resolves the logged-in user's profile (including role) from the database.
 * Returns null when not logged in, profile missing, or account deactivated.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await withRetry(() =>
    db.query.users.findFirst({
      where: eq(users.id, user.id),
    }),
  );
  if (!profile || !profile.active) return null;
  return profile;
}

/**
 * Server-side role gate. Every page and server action behind a role must call
 * this — UI hiding alone is never enough (kickoff hard rule 1).
 * Admins pass every gate (SPEC.md §3.1: full access to everything).
 */
export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "admin" || roles.includes(user.role)) return user;
  redirect(homePathFor(user.role));
}

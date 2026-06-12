import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/auth";

// SPEC.md §4 — after login, route by role to the matching dashboard.
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(homePathFor(user.role));
}

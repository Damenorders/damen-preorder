import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client — used for login and (later) realtime signals.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

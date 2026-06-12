"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Wrong email or password."
          : error.message,
      );
      setLoading(false);
      return;
    }

    // Full navigation so the server reads the new auth cookies,
    // then / redirects to the right dashboard by role.
    window.location.assign("/");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Damen Preorder
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Sign in with your work email
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-sm font-medium text-neutral-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@damenalimentaire.com"
              className="mt-1.5 block w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-neutral-700">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1.5 block w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-accent-600 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-accent-700 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

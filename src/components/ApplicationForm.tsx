"use client";

// Damen Online access application — the entire app for the "clients" role.
// Four fields; on success it swaps to a confirmation message.

import { useState } from "react";
import { createApplication } from "@/app/actions/applications";

export default function ApplicationForm() {
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const inputClass =
    "mt-1.5 block w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-accent-600 focus:ring-2 focus:ring-accent-100";

  async function handleSubmit() {
    setError(null);
    if (!businessName.trim()) return setError("Enter your business name.");
    if (!contactName.trim()) return setError("Enter your name.");
    if (!phone.trim()) return setError("Enter a phone number.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError("Enter a valid email address.");

    setSubmitting(true);
    const result = await createApplication({
      businessName,
      contactName,
      phone,
      email,
    });
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7 text-green-600"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-neutral-800">
          Application received
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Thank you, {contactName.trim() || "there"}. Our team will set up your
          account and send you a text message confirmation once it&apos;s ready.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <label className="block text-sm font-medium text-neutral-700">
        Business name
        <input
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className={inputClass}
          placeholder="e.g. Bistro du Port"
        />
      </label>
      <label className="block text-sm font-medium text-neutral-700">
        Your name
        <input
          type="text"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          className={inputClass}
          placeholder="First and last name"
        />
      </label>
      <label className="block text-sm font-medium text-neutral-700">
        Phone number
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
          placeholder="(514) 000-0000"
        />
      </label>
      <label className="block text-sm font-medium text-neutral-700">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@business.com"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded-xl bg-accent-600 px-4 py-4 text-base font-semibold text-white transition hover:bg-accent-700 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit application"}
      </button>
    </div>
  );
}

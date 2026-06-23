import Image from "next/image";
import { requireRole } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import ApplicationForm from "@/components/ApplicationForm";

// The clients role's entire app: a single Damen Online access application.
// Standalone — no dashboard, header nav, or other views.
export default async function ApplyPage() {
  await requireRole("clients");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image
          src="/damen-combined-logo.png"
          alt="Damen Service Alimentaire"
          width={520}
          height={300}
          priority
          className="h-auto w-full max-w-sm"
        />
        <h1 className="mt-6 text-2xl font-semibold text-neutral-900">
          Damen Online Application
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Use this form to request access to Damen&apos;s online ordering
          platform. Fill in your details below and our team will set up your
          account — you&apos;ll receive a confirmation by text message once
          it&apos;s ready.
        </p>
      </div>

      <ApplicationForm />

      <form action={signOut} className="mt-6 text-center">
        <button
          type="submit"
          className="text-sm font-medium text-neutral-400 hover:text-neutral-600"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}

"use client";

// In-page dialog. The browser's confirm()/alert()/prompt() return silently in
// sandboxed webviews — confirm() just answers false — which made buttons look
// dead elsewhere, so Purchase Orders never uses them.

import { useEffect, useRef, type ReactNode } from "react";

export default function Dialog({
  title,
  children,
  onCancel,
  actions,
}: {
  title: string;
  children?: ReactNode;
  /** Escape, a tap outside the box, and the cancel button all land here. */
  onCancel: () => void;
  actions: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const first = box?.querySelector<HTMLElement>(
      "[data-autofocus], input, select, textarea, button",
    );
    first?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-base font-semibold">{title}</h2>
        {children && <div className="mt-2 text-sm text-neutral-700">{children}</div>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}

export const buttonClass = {
  primary:
    "h-11 rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white active:bg-accent-700 disabled:bg-neutral-300",
  ghost:
    "h-11 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 active:bg-neutral-100 disabled:text-neutral-400",
  choice:
    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-sm active:bg-accent-50",
};

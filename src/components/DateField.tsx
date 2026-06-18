"use client";

// A labeled date input whose entire card opens the native date picker on
// click — not just the small calendar icon. Used across the fill forms.

import { useRef, type ReactNode } from "react";

export default function DateField({
  label,
  value,
  onChange,
  labelClassName = "",
  inputClassName,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  labelClassName?: string;
  inputClassName: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label
      className={`block cursor-pointer ${labelClassName}`}
      onClick={() => {
        // Open the calendar on a click anywhere on the card — including the
        // input's text area, which the native control alone ignores.
        try {
          ref.current?.showPicker?.();
        } catch {
          ref.current?.focus();
        }
      }}
    >
      {label}
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClassName} cursor-pointer`}
      />
    </label>
  );
}

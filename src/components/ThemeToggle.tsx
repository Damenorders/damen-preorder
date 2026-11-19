"use client";

// Light/dark switch. The theme lives on <html data-theme="dark">, set before
// first paint by the inline script in app/layout.tsx; this button only flips
// that attribute and remembers the choice on this device. Light is the default.

import { useSyncExternalStore } from "react";

// Must match the key read by the inline script in app/layout.tsx.
const THEME_STORAGE_KEY = "theme";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function isDarkNow() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

export default function ThemeToggle({ className }: { className?: string }) {
  // Server render always says light; the client value takes over right after
  // hydration, so the icon never causes a hydration mismatch.
  const dark = useSyncExternalStore(subscribe, isDarkNow, () => false);

  function toggle() {
    const next = dark ? "light" : "dark";
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode / restricted origin): the switch still
      // works for this page, it just isn't remembered.
    }
  }

  const label = dark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={className}
    >
      {/* Both icons are rendered; dark-theme.css shows the one matching
          <html data-theme>, so the right icon shows even before hydration. */}
      {/* Sun (shown in the dark theme) */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="theme-icon-sun h-5 w-5"
        aria-hidden
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      {/* Moon (shown in the light theme) */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="theme-icon-moon h-5 w-5"
        aria-hidden
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}

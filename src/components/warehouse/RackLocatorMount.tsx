"use client";

// Mounts the rack-locator (a self-registering custom element served from
// /warehouse/rack-locator.js) and gives it a window.storage bridge backed by
// the inventory server actions, so every save lands in Postgres.

import { useEffect, useRef, useState } from "react";
import {
  readWarehouseKey,
  writeWarehouseKey,
} from "@/app/actions/inventory";
import type { CatalogEntry } from "@/lib/inventory-data";

declare global {
  interface Window {
    DAMEN_CATALOG?: CatalogEntry[];
    DAMEN_USER?: string;
    storage?: {
      get: (key: string) => Promise<{ value: string } | null>;
      set: (key: string, value: string) => Promise<unknown>;
    };
    RL?: {
      goFind: () => void;
      goCatalog: () => void;
      goAudit: () => void;
      showMap: () => void;
    };
  }
}

export type WarehouseScreen = "find" | "catalog" | "activity" | "map";

export default function RackLocatorMount({
  catalog,
  userName,
  screen = "find",
}: {
  catalog: CatalogEntry[];
  userName: string;
  screen?: WarehouseScreen;
}) {
  const [ready, setReady] = useState(false);
  const applied = useRef(false);

  useEffect(() => {
    window.DAMEN_CATALOG = catalog;
    window.DAMEN_USER = userName;
    window.storage = {
      get: (key) => readWarehouseKey(key),
      set: async (key, value) => {
        const res = await writeWarehouseKey(key, value);
        if (!res.ok) console.error("Inventory save failed:", res.error);
        return res;
      },
    };

    if (customElements.get("rack-locator-app")) {
      // Already registered — mark ready off the microtask queue rather than
      // synchronously in the effect body.
      customElements.whenDefined("rack-locator-app").then(() => setReady(true));
      return;
    }
    const script = document.createElement("script");
    script.src = "/warehouse/rack-locator.js";
    script.onload = () => setReady(true);
    document.body.appendChild(script);
  }, [catalog, userName]);

  useEffect(() => {
    if (!ready || applied.current) return;
    let tries = 0;
    const timer = setInterval(() => {
      if (window.RL) {
        clearInterval(timer);
        applied.current = true;
        if (screen === "catalog") window.RL.goCatalog();
        else if (screen === "activity") window.RL.goAudit();
        else if (screen === "map") window.RL.showMap();
        else window.RL.goFind();
      } else if (++tries > 100) {
        clearInterval(timer);
      }
    }, 60);
    return () => clearInterval(timer);
  }, [ready, screen]);

  return <rack-locator-app style={{ display: "block", width: "100%" }} />;
}

declare module "react" {
  // JSX intrinsic-element augmentation must live in the JSX namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "rack-locator-app": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

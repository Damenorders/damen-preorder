"use client";

// Mounts the rack-locator (a self-registering custom element served from
// /warehouse/rack-locator.js) and gives it a window.storage bridge backed by
// the inventory server actions, so every save lands in Postgres.

import { useEffect, useRef, useState } from "react";
import {
  clearWarehouseUnit,
  readWarehouseKey,
  writeWarehouseKey,
  writeWarehouseLocation,
} from "@/app/actions/inventory";
import type { CatalogEntry } from "@/lib/inventory-data";
import type { WarehouseUnit } from "@/db/schema";

type LocationWrite = {
  unit: WarehouseUnit;
  scope: "rack" | "floor";
  rackId?: string;
  slotCode?: string;
  floorId?: string;
  items: { sku?: string; description?: string; quantity?: number }[];
};

declare global {
  interface Window {
    DAMEN_CATALOG?: CatalogEntry[];
    DAMEN_USER?: string;
    storage?: {
      get: (key: string) => Promise<{ value: string } | null>;
      set: (key: string, value: string) => Promise<unknown>;
      writeLocation: (
        payload: LocationWrite,
      ) => Promise<{ ok: boolean; error?: string }>;
      clearUnit: (unit: string) => Promise<{ ok: boolean; error?: string }>;
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
  assetVersion,
}: {
  catalog: CatalogEntry[];
  userName: string;
  screen?: WarehouseScreen;
  // Content hash of rack-locator.js, appended to the script URL so a shipped
  // change actually reaches phones instead of serving Safari's cached copy.
  assetVersion?: string;
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
      // Targeted per-location write — the safe path that can't wipe other
      // people's items elsewhere in the warehouse.
      writeLocation: async (payload) => {
        const res = await writeWarehouseLocation(payload);
        if (!res.ok) console.error("Inventory location save failed:", res.error);
        return res;
      },
      clearUnit: async (unit) => {
        const res = await clearWarehouseUnit(unit as WarehouseUnit);
        if (!res.ok) console.error("Inventory clear failed");
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
    script.src = assetVersion
      ? `/warehouse/rack-locator.js?v=${assetVersion}`
      : "/warehouse/rack-locator.js";
    script.onload = () => setReady(true);
    document.body.appendChild(script);
  }, [catalog, userName, assetVersion]);

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

"use client";

// Mounts the odoo-locator (a self-registering custom element served from
// /odoo-inventory/odoo-locator.js) and gives it its own storage bridge,
// window.ODOO_STORAGE, backed by the Odoo Inventory server actions. Every
// global it uses is Odoo-specific, so it can never pick up the Warehouse
// Inventory's catalogue or save into its tables, even after moving between
// the two cards without a reload.

import { useEffect, useRef, useState } from "react";
import {
  clearOdooUnit,
  readOdooKey,
  writeOdooKey,
  writeOdooLocation,
  writeOdooMove,
} from "@/app/actions/odoo-inventory";
import type { OdooCatalogEntry } from "@/lib/odoo-inventory-data";
import type { OdooWarehouseUnit } from "@/db/schema";

type OdooLocationWrite = Parameters<typeof writeOdooLocation>[0];

declare global {
  interface Window {
    ODOO_CATALOG?: OdooCatalogEntry[];
    ODOO_USER?: string;
    ODOO_STORAGE?: {
      get: (key: string) => Promise<{ value: string } | null>;
      set: (key: string, value: string) => Promise<unknown>;
      writeLocation: (payload: OdooLocationWrite) => Promise<{ ok: boolean; error?: string }>;
      writeMove: (target: OdooLocationWrite, source: OdooLocationWrite) => Promise<{ ok: boolean; error?: string }>;
      clearUnit: (unit: string) => Promise<{ ok: boolean; error?: string }>;
    };
    ORL?: {
      goFind: () => void;
      goCatalog: () => void;
      goAudit: () => void;
      showMap: () => void;
    };
  }
}

export type OdooScreen = "find" | "catalog" | "activity" | "map";

export default function OdooLocatorMount({
  catalog,
  userName,
  screen = "find",
  assetVersion,
}: {
  catalog: OdooCatalogEntry[];
  userName: string;
  screen?: OdooScreen;
  // Content hash of odoo-locator.js, so a shipped change reaches phones.
  assetVersion?: string;
}) {
  const [ready, setReady] = useState(false);
  const applied = useRef(false);

  useEffect(() => {
    window.ODOO_CATALOG = catalog;
    window.ODOO_USER = userName;
    window.ODOO_STORAGE = {
      get: (key) => readOdooKey(key),
      set: async (key) => {
        const res = await writeOdooKey(key);
        if (!res.ok) console.error("Odoo inventory save failed:", res.error);
        return res;
      },
      // Targeted per-location write — the only path that saves a count.
      writeLocation: async (payload) => {
        const res = await writeOdooLocation(payload);
        if (!res.ok) console.error("Odoo inventory location save failed:", res.error);
        return res;
      },
      // A move: both locations in one transaction, logged as "moved".
      writeMove: async (target, source) => {
        const res = await writeOdooMove(target, source);
        if (!res.ok) console.error("Odoo inventory move failed:", res.error);
        return res;
      },
      clearUnit: async (unit) => {
        const res = await clearOdooUnit(unit as OdooWarehouseUnit);
        if (!res.ok) console.error("Odoo inventory clear failed:", res.error);
        return res;
      },
    };

    if (customElements.get("odoo-locator-app")) {
      customElements.whenDefined("odoo-locator-app").then(() => setReady(true));
      return;
    }
    const script = document.createElement("script");
    script.src = assetVersion
      ? `/odoo-inventory/odoo-locator.js?v=${assetVersion}`
      : "/odoo-inventory/odoo-locator.js";
    script.onload = () => setReady(true);
    document.body.appendChild(script);
  }, [catalog, userName, assetVersion]);

  useEffect(() => {
    if (!ready || applied.current) return;
    let tries = 0;
    const timer = setInterval(() => {
      if (window.ORL) {
        clearInterval(timer);
        applied.current = true;
        if (screen === "catalog") window.ORL.goCatalog();
        else if (screen === "activity") window.ORL.goAudit();
        else if (screen === "map") window.ORL.showMap();
        else window.ORL.goFind();
      } else if (++tries > 100) {
        clearInterval(timer);
      }
    }, 60);
    return () => clearInterval(timer);
  }, [ready, screen]);

  return <odoo-locator-app style={{ display: "block", width: "100%" }} />;
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "odoo-locator-app": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

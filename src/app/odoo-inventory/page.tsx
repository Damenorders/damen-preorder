import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { requireRole } from "@/lib/auth";
import { getOdooCatalog } from "@/lib/odoo-inventory-data";
import AppHeader from "@/components/AppHeader";
import OdooLocatorMount, { type OdooScreen } from "@/components/odoo-inventory/OdooLocatorMount";

// Odoo Inventory: a second, separate warehouse for the Odoo count. Same
// screens as /warehouse (find item, catalogue, maps, activity), its own data.

const SCREENS: OdooScreen[] = ["find", "catalog", "activity", "map"];

// Content hash of the locator script, appended as ?v= so phones never keep
// running a cached copy after a fix ships (same as /warehouse).
let locatorVersion: string | null = null;
function getLocatorVersion(): string {
  if (locatorVersion) return locatorVersion;
  try {
    const buf = readFileSync(join(process.cwd(), "public", "odoo-inventory", "odoo-locator.js"));
    locatorVersion = createHash("sha1").update(buf).digest("hex").slice(0, 8);
  } catch {
    locatorVersion = Date.now().toString(36);
  }
  return locatorVersion;
}

export default async function OdooInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  const user = await requireRole("buyer", "dispatch");
  const { screen } = await searchParams;
  const catalog = await getOdooCatalog();
  const landing = SCREENS.includes(screen as OdooScreen) ? (screen as OdooScreen) : "find";

  return (
    <>
      <AppHeader user={user} />
      <main className="w-full flex-1">
        <OdooLocatorMount
          catalog={catalog}
          userName={user.name}
          screen={landing}
          assetVersion={getLocatorVersion()}
        />
      </main>
    </>
  );
}

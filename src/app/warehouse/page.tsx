import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { requireRole } from "@/lib/auth";
import { getCatalog } from "@/lib/inventory-data";
import AppHeader from "@/components/AppHeader";
import RackLocatorMount, {
  type WarehouseScreen,
} from "@/components/warehouse/RackLocatorMount";

// Warehouse Inventory. One route: the locator owns its own screens (find item,
// item catalog, rack maps, activity log) and ?screen= picks the landing one, so
// the dashboard card can deep-link into each.

const SCREENS: WarehouseScreen[] = ["find", "catalog", "activity", "map"];

// Hash the locator script once per server process and hang it off the script
// URL as ?v=. Without it, phones keep running whatever copy of the file Safari
// cached from an earlier visit — shipped fixes never arrive. Recomputed on each
// deploy because the file contents (and so the hash) change.
let rackLocatorVersion: string | null = null;
function getRackLocatorVersion(): string {
  if (rackLocatorVersion) return rackLocatorVersion;
  try {
    const buf = readFileSync(
      join(process.cwd(), "public", "warehouse", "rack-locator.js"),
    );
    rackLocatorVersion = createHash("sha1").update(buf).digest("hex").slice(0, 8);
  } catch {
    rackLocatorVersion = Date.now().toString(36);
  }
  return rackLocatorVersion;
}

export default async function WarehousePage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  const user = await requireRole("buyer", "dispatch", "owner", "warehouse");
  const { screen } = await searchParams;
  const catalog = await getCatalog();
  const landing = SCREENS.includes(screen as WarehouseScreen)
    ? (screen as WarehouseScreen)
    : "find";

  return (
    <>
      <AppHeader user={user} />
      <main className="w-full flex-1">
        <RackLocatorMount
          catalog={catalog}
          userName={user.name}
          screen={landing}
          assetVersion={getRackLocatorVersion()}
        />
      </main>
    </>
  );
}

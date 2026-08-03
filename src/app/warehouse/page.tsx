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

export default async function WarehousePage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  const user = await requireRole("buyer");
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
        />
      </main>
    </>
  );
}

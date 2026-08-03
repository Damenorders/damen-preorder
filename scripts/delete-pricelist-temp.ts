/**
 * Prune the TEMPORARY price-list items. Run only when Damen Orders says
 * "delete the temporary items".
 *
 *   npx tsx scripts/delete-pricelist-temp.ts          # do the prune
 *   npx tsx scripts/delete-pricelist-temp.ts --dry    # report only, change nothing
 *
 * "Used" = the item has a warehouse location (a row in inventory_placements).
 *   - Temp items WITHOUT any placement  -> deleted.
 *   - Temp items WITH a placement       -> kept and promoted to section 'SEC'
 *                                          so they become normal catalog items.
 */

import { sql } from "drizzle-orm";
import { inventoryItems } from "../src/db/schema";
import { connect, KEEP_SECTION, TEMP_SECTION } from "./pricelist-temp";

async function main() {
  const dry = process.argv.includes("--dry");
  const { db, client } = connect();

  const placed = sql`
    SELECT 1 FROM inventory_placements p
    WHERE p.item_code = ${inventoryItems.code}
  `;

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inventoryItems)
    .where(sql`section = ${TEMP_SECTION}`);

  const [{ count: keep }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inventoryItems)
    .where(sql`section = ${TEMP_SECTION} AND EXISTS (${placed})`);

  const willDelete = total - keep;
  console.log(`Temporary items tagged ${TEMP_SECTION}: ${total}`);
  console.log(`  used (has a warehouse location) -> keep & promote: ${keep}`);
  console.log(`  unused -> delete: ${willDelete}`);

  if (dry) {
    console.log("\n--dry: no changes made.");
    await client.end();
    return;
  }

  const deleted = await db
    .delete(inventoryItems)
    .where(sql`section = ${TEMP_SECTION} AND NOT EXISTS (${placed})`)
    .returning({ code: inventoryItems.code });

  const promoted = await db
    .update(inventoryItems)
    .set({ section: KEEP_SECTION, updatedAt: new Date() })
    .where(sql`section = ${TEMP_SECTION} AND EXISTS (${placed})`)
    .returning({ code: inventoryItems.code });

  console.log(`\nDeleted ${deleted.length} unused temporary items.`);
  console.log(`Promoted ${promoted.length} used items to section '${KEEP_SECTION}'.`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

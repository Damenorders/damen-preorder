// Phase 3 test data: vary buyer table statuses and delivery dates so the
// §19 sorting and §18 default view can be verified.
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { formatExternalId } from "../src/db/external-id";

function businessDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Montreal" });
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });

  const rep = await db.query.users.findFirst({
    where: eq(schema.users.email, "commandes@damenalimentaire.com"),
  });
  const salmon = await db.query.products.findFirst({
    where: eq(schema.products.productName, "Salmon"),
  });
  if (!rep || !salmon) throw new Error("seed data missing");

  // Existing test orders: #1 → today, ordered; #2 → tomorrow, stays pending
  await db
    .update(schema.orders)
    .set({ deliveryDate: businessDate(0), buyerTableStatus: "ordered" })
    .where(eq(schema.orders.id, 1));
  await db
    .update(schema.orders)
    .set({ deliveryDate: businessDate(1) })
    .where(eq(schema.orders.id, 2));

  // Extra orders for today: one received (must sort last), one pending
  const extras: Array<{ client: string; status: schema.BuyerTableStatus }> = [
    { client: "Le Poisson Bleu", status: "received" },
    { client: "Ocean Sushi", status: "pending" },
  ];
  for (const e of extras) {
    const client = await db.query.clients.findFirst({
      where: eq(schema.clients.clientName, e.client),
    });
    const [o] = await db
      .insert(schema.orders)
      .values({
        department: "fish",
        clientName: client!.clientName,
        clientExternalId: client!.externalId,
        deliveryDate: businessDate(0),
        repUserId: rep.id,
        repName: rep.name,
        repEmail: rep.email,
        buyerTableStatus: e.status,
        notes: "Phase 3 test order",
      })
      .returning({ id: schema.orders.id });
    await db
      .update(schema.orders)
      .set({ externalId: formatExternalId("order", o.id) })
      .where(eq(schema.orders.id, o.id));
    const [line] = await db
      .insert(schema.orderLines)
      .values({
        orderId: o.id,
        department: "fish",
        product: salmon.productName,
        specs: "8/10 · Skin Off · Bone Off · Simple Clean · Head & Skin No",
        specsJson: { size: "8/10", skin: "Off", bone: "Off", clean: "Simple", headAndSkin: "No" },
        quantity: 3,
        weight: "12.00",
      })
      .returning({ id: schema.orderLines.id });
    await db
      .update(schema.orderLines)
      .set({ externalId: formatExternalId("order_line", line.id) })
      .where(eq(schema.orderLines.id, line.id));
    console.log(`order #${o.id}: ${e.client} → ${e.status}, delivery ${businessDate(0)}`);
  }

  await sql.end();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

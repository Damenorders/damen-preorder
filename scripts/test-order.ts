// Creates sample orders directly in the DB to exercise schema constraints
// and give the submissions pages real data to render.
// Usage: npx tsx scripts/test-order.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { formatExternalId } from "../src/db/external-id";
import { formatSpecs, type ProductFormConfig } from "../src/lib/product-config";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });

  const rep = await db.query.users.findFirst({
    where: eq(schema.users.email, "commandes@damenalimentaire.com"),
  });
  const buyer = await db.query.users.findFirst({
    where: eq(schema.users.email, "david@damenalimentaire.com"),
  });
  const salmon = await db.query.products.findFirst({
    where: eq(schema.products.productName, "Salmon"),
  });
  const loup = await db.query.products.findFirst({
    where: eq(schema.products.productName, "Loup de Mer"),
  });
  const client = await db.query.clients.findFirst({
    where: eq(schema.clients.clientName, "Sushi Taxi"),
  });
  if (!rep || !buyer || !salmon || !loup || !client) throw new Error("seed data missing");

  const salmonSpecs = { size: "10/12", skin: "On", bone: "Off", clean: "Deep", headAndSkin: "Yes" };
  const loupSpecs = { format: "Whole", size: "Medium", headAndSkin: "Yes" };

  async function createOrder(owner: schema.User, deliveryDate: string, note: string) {
    return db.transaction(async (tx) => {
      const [o] = await tx
        .insert(schema.orders)
        .values({
          department: "fish",
          clientName: client!.clientName,
          clientExternalId: client!.externalId,
          deliveryDate,
          repUserId: owner.id,
          repName: owner.name,
          repEmail: owner.email,
          notes: note,
        })
        .returning({ id: schema.orders.id });
      await tx
        .update(schema.orders)
        .set({ externalId: formatExternalId("order", o.id) })
        .where(eq(schema.orders.id, o.id));

      const lines = [
        {
          product: salmon!,
          specsJson: salmonSpecs,
          quantity: 5,
          weight: "42.00",
        },
        { product: loup!, specsJson: loupSpecs, quantity: 8, weight: "30.00" },
      ];
      for (const l of lines) {
        const [created] = await tx
          .insert(schema.orderLines)
          .values({
            orderId: o.id,
            department: "fish",
            product: l.product.productName,
            specs: formatSpecs(l.product.formConfig as ProductFormConfig, l.specsJson),
            specsJson: l.specsJson,
            quantity: l.quantity,
            weight: l.weight,
          })
          .returning({ id: schema.orderLines.id });
        await tx
          .update(schema.orderLines)
          .set({ externalId: formatExternalId("order_line", created.id) })
          .where(eq(schema.orderLines.id, created.id));
      }
      return o.id;
    });
  }

  const repOrderId = await createOrder(rep, "2026-06-12", "Sample order (Phase 2 test)");
  const buyerOrderId = await createOrder(buyer, "2026-06-13", "Buyer-owned order (Phase 2 test)");
  console.log(`created rep order #${repOrderId}, buyer order #${buyerOrderId}`);

  const lines = await db.query.orderLines.findMany({
    where: eq(schema.orderLines.orderId, repOrderId),
  });
  for (const l of lines) console.log(`  line ${l.externalId}: ${l.product} — ${l.specs}`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

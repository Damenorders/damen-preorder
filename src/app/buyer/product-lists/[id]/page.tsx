import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getProductList, getProductListItems } from "@/lib/product-lists";
import PageShell from "@/components/PageShell";
import LiveRefresh from "@/components/LiveRefresh";
import ProductListBuilder from "@/components/ProductListBuilder";

// The builder. Server-rendered items + a live channel, so two phones filling
// the same list see each other's taps within a moment.
export default async function ProductListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("buyer");
  const { id } = await params;
  const listId = Number(id);
  if (!Number.isInteger(listId)) notFound();

  const [list, items] = await Promise.all([
    getProductList(listId),
    getProductListItems(listId),
  ]);
  if (!list) notFound();

  return (
    <PageShell
      user={user}
      backHref="/buyer/product-lists"
      backLabel="Current Product Lists"
      title={list.name}
      subtitle={
        list.status === "saved"
          ? "Saved list — add or remove items any time."
          : "In progress. Add items as you walk; Save files it under Current Product Lists."
      }
    >
      <LiveRefresh channel="product-lists" />
      <ProductListBuilder
        listId={list.id}
        initialName={list.name}
        status={list.status}
        items={items.map((i) => ({
          itemCode: i.itemCode,
          description: i.description,
          addedByName: i.addedByName,
          catalogPrice: i.catalogPrice,
          priceOverride: i.priceOverride,
          price: i.price,
        }))}
      />
    </PageShell>
  );
}

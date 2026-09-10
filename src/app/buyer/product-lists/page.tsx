import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listProductLists } from "@/lib/product-lists";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import PageShell from "@/components/PageShell";
import LiveRefresh from "@/components/LiveRefresh";
import ProductListRowActions from "@/components/ProductListRowActions";
import ProductListPreview from "@/components/ProductListPreview";

// Current Product Lists — every list the buyers have built, newest touch first.
// Buyer/admin only. Live: a teammate's tap on any list updates this page.
export default async function ProductListsPage() {
  const user = await requireRole("buyer");
  const lists = await listProductLists();
  const saved = lists.filter((l) => l.status === "saved");
  const drafts = lists.filter((l) => l.status === "draft");

  return (
    <PageShell
      user={user}
      backHref="/buyer"
      backLabel="Dashboard"
      title="Current Product Lists"
      subtitle="Open a list to edit it, or export it to Excel to print for a client."
      wide
    >
      <LiveRefresh channel="product-lists" />

      <Link
        href="/buyer/product-lists/new"
        className="inline-block rounded-xl bg-[#4d61bd] px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-700"
      >
        + Create Product List
      </Link>

      {drafts.length > 0 && (
        <section className="mt-6">
          <h2 className="text-base font-semibold">In progress</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Started but not yet saved. Anyone can keep adding to these.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {drafts.map((list) => (
              <ListRow key={list.id} list={list} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-base font-semibold">Saved lists</h2>
        {saved.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-neutral-300 px-3 py-8 text-center text-sm text-neutral-500">
            No saved lists yet. Create one, walk the warehouse, and tap Save.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {saved.map((list) => (
              <ListRow key={list.id} list={list} />
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function ListRow({
  list,
}: {
  list: Awaited<ReturnType<typeof listProductLists>>[number];
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{list.name}</h3>
          <p className="mt-0.5 text-sm text-neutral-500">
            {list.itemCount} {list.itemCount === 1 ? "item" : "items"} ·{" "}
            <span className="font-medium text-neutral-700">
              {formatMoney(list.total)}
            </span>
            {list.unpricedCount > 0 && (
              <span className="text-amber-700">
                {" "}
                ({list.unpricedCount} unpriced)
              </span>
            )}{" "}
            · by {list.createdByName || "—"} · updated{" "}
            {formatDateTime(list.updatedAt)}
          </p>
        </div>
        {list.status === "draft" && (
          <span className="shrink-0 rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
            In progress
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-2">
        <ProductListPreview
          listId={list.id}
          listName={list.name}
          updatedAt={list.updatedAt.getTime()}
        />
        <Link
          href={`/buyer/product-lists/${list.id}`}
          className="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-700"
        >
          {list.status === "draft" ? "Continue" : "Edit / Add items"}
        </Link>
        <a
          href={`/api/exports/product-list?id=${list.id}`}
          className="rounded-xl bg-accent-50 px-4 py-2.5 text-sm font-medium text-accent-800 transition hover:bg-accent-100"
        >
          Export to Excel
        </a>
        <ProductListRowActions listId={list.id} name={list.name} />
      </div>
    </div>
  );
}

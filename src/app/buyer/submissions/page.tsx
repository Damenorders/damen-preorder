import { requireRole, homePathFor } from "@/lib/auth";
import { getAllSubmissions, getFilterOptions } from "@/lib/buyer-data";
import {
  DEPARTMENTS,
  departmentLabels,
  submissionStatusLabels,
} from "@/lib/labels";
import PageShell from "@/components/PageShell";
import SubmissionCard from "@/components/SubmissionCard";
import FilterBar, { type FilterField } from "@/components/FilterBar";
import LiveRefresh from "@/components/LiveRefresh";

// All Submissions — buyer/admin only, advanced filtering per SPEC.md §14.
export default async function AllSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("buyer");
  const params = await searchParams;
  const get = (key: string) => {
    const v = params[key];
    return typeof v === "string" && v !== "" ? v : undefined;
  };

  const filters = {
    department: get("module"),
    status: get("status"),
    clientName: get("client"),
    repName: get("rep"),
    product: get("product"),
    deliveryDate: get("delivery"),
    createdDate: get("submitted"),
    updatedDate: get("updated"),
    hasNotes: get("notes") === "1",
  };
  const activeCount = Object.values(filters).filter(Boolean).length;

  const [submissions, options] = await Promise.all([
    getAllSubmissions(filters),
    getFilterOptions(),
  ]);

  const fields: FilterField[] = [
    {
      type: "select",
      param: "module",
      label: "Module",
      emptyLabel: "All modules",
      options: DEPARTMENTS.map((d) => ({ value: d, label: departmentLabels[d] })),
    },
    {
      type: "select",
      param: "status",
      label: "Status",
      emptyLabel: "All statuses",
      options: Object.entries(submissionStatusLabels).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      type: "select",
      param: "client",
      label: "Client",
      emptyLabel: "All clients",
      options: options.clients.map((c) => ({ value: c, label: c })),
    },
    {
      type: "select",
      param: "rep",
      label: "Rep",
      emptyLabel: "All reps",
      options: options.reps.map((r) => ({ value: r, label: r })),
    },
    {
      type: "select",
      param: "product",
      label: "Product",
      emptyLabel: "All products",
      options: options.products.map((p) => ({ value: p, label: p })),
    },
    { type: "date", param: "delivery", label: "Delivery date" },
    { type: "date", param: "submitted", label: "Submitted on" },
    { type: "date", param: "updated", label: "Updated on" },
    { type: "checkbox", param: "notes", label: "With notes" },
  ];

  return (
    <PageShell
      user={user}
      backHref={homePathFor(user.role)}
      backLabel="Dashboard"
      title="All Submissions"
      subtitle={`${submissions.length} order${submissions.length === 1 ? "" : "s"} · earliest delivery first`}
      wide
    >
      <LiveRefresh />
      <div className="flex flex-col gap-4">
        <FilterBar fields={fields} activeCount={activeCount} />
        {submissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
            No submissions match these filters.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {submissions.map((s) => (
              <SubmissionCard
                key={s.id}
                submission={s}
                showRep
                showDepartment
                canEdit
                manageStatus
              />
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}

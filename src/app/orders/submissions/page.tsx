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
import SortPills from "@/components/SortPills";

// All Submissions for reps (and buyer/admin): everyone's orders are visible,
// but a rep can only edit their own, still-Pending submissions. Status here is
// the submission status only — buyer_table_status is never in this payload.
export default async function RepAllSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("rep", "buyer", "scheduling");
  const isRep = user.role === "rep";
  const isManager = user.role === "buyer" || user.role === "admin";
  const params = await searchParams;
  const get = (key: string) => {
    const v = params[key];
    return typeof v === "string" && v !== "" ? v : undefined;
  };

  const sortBy = get("sortBy") === "submitted" ? ("submitted" as const) : ("delivery" as const);
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
    sortBy,
  };
  const activeCount = [
    filters.department,
    filters.status,
    filters.clientName,
    filters.repName,
    filters.product,
    filters.deliveryDate,
    filters.createdDate,
    filters.updatedDate,
    filters.hasNotes,
  ].filter(Boolean).length;

  const sortHref = (value: string) => {
    const p = new URLSearchParams();
    for (const key of ["module", "status", "client", "rep", "product", "delivery", "submitted", "updated", "notes"]) {
      const v = get(key);
      if (v) p.set(key, v);
    }
    if (value === "submitted") p.set("sortBy", "submitted");
    const qs = p.toString();
    return `/orders/submissions${qs ? `?${qs}` : ""}`;
  };

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
      subtitle={
        isRep
          ? `Everyone's orders — you can edit your own. ${submissions.length} order${submissions.length === 1 ? "" : "s"}`
          : `${submissions.length} order${submissions.length === 1 ? "" : "s"}`
      }
      wide
    >
      <LiveRefresh />
      <div className="flex flex-col gap-4">
        <SortPills
          value={sortBy}
          options={[
            { value: "delivery", label: "By delivery date", href: sortHref("delivery") },
            { value: "submitted", label: "By order date", href: sortHref("submitted") },
          ]}
        />
        <FilterBar fields={fields} activeCount={activeCount} />
        {submissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-500">
            No submissions match these filters.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {submissions.map((s) => {
              const own = s.repUserId === user.id;
              return (
                <SubmissionCard
                  key={s.id}
                  submission={s}
                  showRep
                  showDepartment
                  // No Edit button next to the status here — Edit lives only in
                  // the expanded dropdown. Reps edit their own Pending orders;
                  // buyer/admin edit any; Scheduling edits weight + status only.
                  manageStatus={!isRep}
                  canEdit={
                    isRep ? own && s.submissionStatus === "pending" : isManager
                  }
                  canEditWeight={
                    isRep ? own && s.submissionStatus === "pending" : true
                  }
                  canDelete={isManager}
                />
              );
            })}
          </ul>
        )}
      </div>
    </PageShell>
  );
}

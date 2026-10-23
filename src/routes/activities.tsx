import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/crm/data-table";
import { NativeSelect, PageHeader } from "@/components/crm/fields";
import { useUI } from "@/components/crm/ui-state";
import { useDb, useFormat, useLookups, useRepoMutation } from "@/data/hooks";
import { isOverdue } from "@/domain/services/pipeline";
import { ACTIVITY_LABELS, ACTIVITY_TYPES, type Activity } from "@/domain/types";

const searchSchema = z.object({
  status: z.enum(["all", "open", "overdue", "completed"]).optional(),
});

export const Route = createFileRoute("/activities")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Activities · Ledgerline Sales CRM" },
      { name: "description", content: "Calls, emails, meetings and tasks with overdue tracking." },
      { property: "og:title", content: "Activities · Ledgerline Sales CRM" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Calls, emails, meetings and tasks with overdue tracking.",
      },
    ],
  }),
  component: ActivitiesPage,
});

const col = createColumnHelper<Activity>();

function ActivitiesPage() {
  const db = useDb();
  const L = useLookups();
  const f = useFormat();
  const { openDrawer, openForm } = useUI();
  const status = Route.useSearch().status ?? "open";
  const navigate = useNavigate({ from: "/activities" });
  const [type, setType] = useState("");
  const [owner, setOwner] = useState("");
  const toggle = useRepoMutation((r, a: Activity) => r.setActivityCompleted(a.id, !a.completed));
  const today = useMemo(() => new Date(), []);

  const rows = useMemo(
    () =>
      db.activities.filter((a) => {
        const st =
          status === "all" ||
          (status === "open" && !a.completed) ||
          (status === "completed" && a.completed) ||
          (status === "overdue" && isOverdue(a, today));
        return st && (!type || a.type === type) && (!owner || a.ownerId === owner);
      }),
    [db, status, type, owner, today],
  );

  const columns = useMemo(
    () => [
      col.display({
        id: "done",
        header: "",
        enableHiding: false,
        cell: (c) => (
          <span onClick={(e) => e.stopPropagation()}>
            <Checkbox
              aria-label="Completed"
              checked={c.row.original.completed}
              onCheckedChange={() => toggle.mutate(c.row.original)}
            />
          </span>
        ),
      }),
      col.accessor("subject", {
        header: "Subject",
        cell: (c) => <span className="font-medium">{c.getValue()}</span>,
      }),
      col.accessor((a) => ACTIVITY_LABELS[a.type], { id: "type", header: "Type" }),
      col.accessor("dueDate", {
        header: "Due",
        cell: (c) => {
          const a = c.row.original;
          return (
            <span className="flex items-center gap-1.5">
              {f.date(a.dueDate)}
              {isOverdue(a, today) && <Badge variant="destructive">Overdue</Badge>}
            </span>
          );
        },
      }),
      col.accessor((a) => L.opportunity.get(a.opportunityId ?? "")?.name ?? "—", {
        id: "opportunity",
        header: "Opportunity",
      }),
      col.accessor((a) => L.contactName(a.contactId), { id: "contact", header: "Contact" }),
      col.accessor((a) => L.companyName(a.companyId), { id: "company", header: "Company" }),
      col.accessor((a) => L.ownerName(a.ownerId), { id: "owner", header: "Owner" }),
    ],
    [L, f, today, toggle],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Activities"
        description="Your follow-ups. Tick to mark complete."
        actions={
          <Button size="sm" className="h-8" onClick={() => openForm({ kind: "activity" })}>
            <Plus className="h-3.5 w-3.5" /> New activity
          </Button>
        }
      />
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search activities…"
        initialSort={[{ id: "dueDate", desc: false }]}
        onRowClick={(a) => openDrawer({ kind: "activity", id: a.id })}
        rowClassName={(a) => (a.completed ? "text-muted-foreground" : undefined)}
        toolbar={
          <>
            <NativeSelect
              className="w-32"
              value={status}
              onChange={(e) => navigate({ search: { status: e.target.value as "open" } })}
              aria-label="Status filter"
            >
              <option value="open">Open</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
              <option value="all">All</option>
            </NativeSelect>
            <NativeSelect
              className="w-32"
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-label="Type filter"
            >
              <option value="">All types</option>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACTIVITY_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              className="w-36"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              aria-label="Owner filter"
            >
              <option value="">All owners</option>
              {db.settings.owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>
          </>
        }
      />
    </div>
  );
}

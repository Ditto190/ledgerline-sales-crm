import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/crm/data-table";
import { NativeSelect, PageHeader } from "@/components/crm/fields";
import { useUI } from "@/components/crm/ui-state";
import { useDb, useLookups } from "@/data/hooks";
import type { Contact } from "@/domain/types";

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts · Ledgerline Sales CRM" },
      {
        name: "description",
        content: "People at your accounts and the opportunities they're involved in.",
      },
      { property: "og:title", content: "Contacts · Ledgerline Sales CRM" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "People at your accounts and the opportunities they're involved in.",
      },
    ],
  }),
  component: ContactsPage,
});

type Row = Contact & { opps: number };
const col = createColumnHelper<Row>();

function ContactsPage() {
  const db = useDb();
  const L = useLookups();
  const { openDrawer, openForm } = useUI();
  const [company, setCompany] = useState("");
  const rows = useMemo<Row[]>(
    () =>
      db.contacts
        .filter((c) => !company || (company === "none" ? !c.companyId : c.companyId === company))
        .map((c) => ({
          ...c,
          opps: db.opportunities.filter((o) => o.contactIds.includes(c.id)).length,
        })),
    [db, company],
  );
  const columns = useMemo(
    () => [
      col.accessor((c) => `${c.firstName} ${c.lastName}`, {
        id: "name",
        header: "Name",
        cell: (c) => <span className="font-medium">{c.getValue()}</span>,
      }),
      col.accessor("jobTitle", { header: "Job title" }),
      col.accessor((c) => L.companyName(c.companyId), { id: "company", header: "Company" }),
      col.accessor("email", { header: "Email" }),
      col.accessor("phone", { header: "Phone" }),
      col.accessor("opps", {
        header: "Opportunities",
        cell: (c) => <span className="num">{c.getValue()}</span>,
      }),
    ],
    [L],
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Contacts"
        description="People you work with."
        actions={
          <Button size="sm" className="h-8" onClick={() => openForm({ kind: "contact" })}>
            <Plus className="h-3.5 w-3.5" /> New contact
          </Button>
        }
      />
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search contacts…"
        initialSort={[{ id: "name", desc: false }]}
        onRowClick={(c) => openDrawer({ kind: "contact", id: c.id })}
        toolbar={
          <NativeSelect
            className="w-48"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            aria-label="Company filter"
          >
            <option value="">All companies</option>
            <option value="none">No company</option>
            {[...db.companies]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </NativeSelect>
        }
      />
    </div>
  );
}

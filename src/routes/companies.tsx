import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/crm/data-table";
import { NativeSelect, PageHeader } from "@/components/crm/fields";
import { useUI } from "@/components/crm/ui-state";
import { useDb, useFormat, useLookups } from "@/data/hooks";
import { openPipelineValue } from "@/domain/services/pipeline";
import { AU_STATES, type Company } from "@/domain/types";

export const Route = createFileRoute("/companies")({
  head: () => ({
    meta: [
      { title: "Companies · Ledgerline Sales CRM" },
      {
        name: "description",
        content: "Customer and prospect accounts with their open pipeline and contacts.",
      },
      { property: "og:title", content: "Companies · Ledgerline Sales CRM" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Customer and prospect accounts with their open pipeline and contacts.",
      },
    ],
  }),
  component: CompaniesPage,
});

type Row = Company & { pipeline: number; contacts: number; opps: number };
const col = createColumnHelper<Row>();

function CompaniesPage() {
  const db = useDb();
  const L = useLookups();
  const f = useFormat();
  const { openDrawer, openForm } = useUI();
  const [state, setState] = useState("");
  const [industry, setIndustry] = useState("");
  const industries = useMemo(
    () => [...new Set(db.companies.map((c) => c.industry).filter(Boolean))].sort(),
    [db],
  );
  const rows = useMemo<Row[]>(
    () =>
      db.companies
        .filter((c) => (!state || c.state === state) && (!industry || c.industry === industry))
        .map((c) => {
          const opps = db.opportunities.filter((o) => o.companyId === c.id);
          return {
            ...c,
            pipeline: openPipelineValue(opps),
            opps: opps.length,
            contacts: db.contacts.filter((x) => x.companyId === c.id).length,
          };
        }),
    [db, state, industry],
  );
  const columns = useMemo(
    () => [
      col.accessor("name", {
        header: "Name",
        cell: (c) => <span className="font-medium">{c.getValue()}</span>,
      }),
      col.accessor("industry", { header: "Industry" }),
      col.accessor((c) => `${c.city}, ${c.state}`, { id: "location", header: "Location" }),
      col.accessor("pipeline", {
        header: "Open pipeline",
        cell: (c) => <span className="num">{f.money(c.getValue())}</span>,
      }),
      col.accessor("opps", {
        header: "Opps",
        cell: (c) => <span className="num">{c.getValue()}</span>,
      }),
      col.accessor("contacts", {
        header: "Contacts",
        cell: (c) => <span className="num">{c.getValue()}</span>,
      }),
      col.accessor("employees", {
        header: "Employees",
        cell: (c) => <span className="num">{c.getValue().toLocaleString("en-AU")}</span>,
      }),
      col.accessor("phone", { header: "Phone" }),
      col.accessor((c) => L.ownerName(c.ownerId), { id: "owner", header: "Owner" }),
    ],
    [L, f],
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Companies"
        description="Accounts you sell to."
        actions={
          <Button size="sm" className="h-8" onClick={() => openForm({ kind: "company" })}>
            <Plus className="h-3.5 w-3.5" /> New company
          </Button>
        }
      />
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search companies…"
        initialSort={[{ id: "name", desc: false }]}
        onRowClick={(c) => openDrawer({ kind: "company", id: c.id })}
        toolbar={
          <>
            <NativeSelect
              className="w-28"
              value={state}
              onChange={(e) => setState(e.target.value)}
              aria-label="State filter"
            >
              <option value="">All states</option>
              {AU_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </NativeSelect>
            <NativeSelect
              className="w-44"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              aria-label="Industry filter"
            >
              <option value="">All industries</option>
              {industries.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </NativeSelect>
          </>
        }
      />
    </div>
  );
}

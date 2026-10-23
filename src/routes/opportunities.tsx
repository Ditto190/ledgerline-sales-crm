import { createFileRoute } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { KanbanSquare, MoreHorizontal, Plus, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DataTable } from "@/components/crm/data-table";
import { NativeSelect, PageHeader, StageBadge } from "@/components/crm/fields";
import { useUI } from "@/components/crm/ui-state";
import { useDb, useFormat, useLookups, useRepoMutation } from "@/data/hooks";
import { effectiveProbability, weightedValue } from "@/domain/services/pipeline";
import { STAGES, STAGE_LABELS, type Opportunity, type Stage } from "@/domain/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/opportunities")({
  head: () => ({
    meta: [
      { title: "Opportunities · Ledgerline Sales CRM" },
      {
        name: "description",
        content: "Manage deals in a sortable table or drag them across a stage board.",
      },
      { property: "og:title", content: "Opportunities · Ledgerline Sales CRM" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Manage deals in a sortable table or drag them across a stage board.",
      },
    ],
  }),
  component: OpportunitiesPage,
});

function useMoveStage() {
  const { requestClose } = useUI();
  const move = useRepoMutation((r, a: { id: string; stage: Stage }) =>
    r.moveOpportunity(a.id, a.stage),
  );
  return (o: Opportunity, stage: Stage) => {
    if (o.stage === stage) return;
    if (stage === "won" || stage === "lost") requestClose({ id: o.id, stage });
    else move.mutate({ id: o.id, stage });
  };
}

function Board({ items }: { items: Opportunity[] }) {
  const db = useDb();
  const L = useLookups();
  const f = useFormat();
  const { openDrawer } = useUI();
  const moveTo = useMoveStage();
  const [over, setOver] = useState<Stage | null>(null);
  return (
    <div className="grid min-h-0 flex-1 grid-cols-6 gap-2 overflow-x-auto">
      {STAGES.map((stage) => {
        const col = items.filter((o) => o.stage === stage);
        const total = col.reduce((s, o) => s + o.value, 0);
        return (
          <div
            key={stage}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(stage);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const o = db.opportunities.find((x) => x.id === e.dataTransfer.getData("text/plain"));
              if (o) moveTo(o, stage);
            }}
            className={cn(
              "flex min-h-0 min-w-44 flex-col rounded-md border bg-muted/50",
              over === stage && "ring-2 ring-primary",
            )}
          >
            <div className="border-b px-2 py-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                {STAGE_LABELS[stage]} <span className="text-muted-foreground">{col.length}</span>
              </div>
              <div className="num text-[11px] text-muted-foreground">{f.money(total)}</div>
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1.5">
              {col.map((o) => (
                <div
                  key={o.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", o.id)}
                  onClick={() => openDrawer({ kind: "opportunity", id: o.id })}
                  className="cursor-grab rounded-sm border bg-card p-2 text-xs shadow-xs hover:border-primary active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="font-medium leading-tight">{o.name}</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button aria-label="Move stage" className="rounded p-0.5 hover:bg-accent">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuLabel className="text-xs">Move to</DropdownMenuLabel>
                        {STAGES.filter((s) => s !== o.stage).map((s) => (
                          <DropdownMenuItem key={s} onSelect={() => moveTo(o, s)}>
                            {STAGE_LABELS[s]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-0.5 truncate text-muted-foreground">
                    {L.companyName(o.companyId)}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="num font-medium">{f.money(o.value)}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {f.date(o.expectedClose)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const col = createColumnHelper<Opportunity>();

function OpportunitiesPage() {
  const db = useDb();
  const L = useLookups();
  const f = useFormat();
  const { openDrawer, openForm } = useUI();
  const [view, setView] = useState<"table" | "board">("table");
  const [stage, setStage] = useState("");
  const [owner, setOwner] = useState("");
  const [company, setCompany] = useState("");
  const [closeBy, setCloseBy] = useState("");

  const items = useMemo(
    () =>
      db.opportunities.filter(
        (o) =>
          (!stage ||
            (stage === "open" ? o.stage !== "won" && o.stage !== "lost" : o.stage === stage)) &&
          (!owner || o.ownerId === owner) &&
          (!company || o.companyId === company) &&
          (!closeBy || o.expectedClose.slice(0, 10) <= closeBy),
      ),
    [db, stage, owner, company, closeBy],
  );

  const columns = useMemo(
    () => [
      col.accessor("name", {
        header: "Name",
        cell: (c) => <span className="font-medium">{c.getValue()}</span>,
      }),
      col.accessor((o) => L.companyName(o.companyId), { id: "company", header: "Company" }),
      col.accessor("stage", {
        header: "Stage",
        cell: (c) => <StageBadge stage={c.getValue()} />,
        sortingFn: (a, b) => STAGES.indexOf(a.original.stage) - STAGES.indexOf(b.original.stage),
      }),
      col.accessor("value", {
        header: "Value",
        cell: (c) => <span className="num">{f.money(c.getValue())}</span>,
      }),
      col.accessor((o) => effectiveProbability(o, db.settings), {
        id: "probability",
        header: "Prob.",
        cell: (c) => <span className="num">{c.getValue()}%</span>,
      }),
      col.accessor((o) => weightedValue(o, db.settings), {
        id: "weighted",
        header: "Weighted",
        cell: (c) => <span className="num">{f.money(c.getValue())}</span>,
      }),
      col.accessor("expectedClose", {
        header: "Expected close",
        cell: (c) => f.date(c.getValue()),
      }),
      col.accessor((o) => L.ownerName(o.ownerId), { id: "owner", header: "Owner" }),
      col.accessor((o) => o.contactIds.length, {
        id: "contacts",
        header: "Contacts",
        cell: (c) => <span className="num">{c.getValue()}</span>,
      }),
    ],
    [L, f, db.settings],
  );

  const filters = (
    <>
      <NativeSelect
        className="w-32"
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        aria-label="Stage filter"
      >
        <option value="">All stages</option>
        <option value="open">Open only</option>
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s]}
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
      <NativeSelect
        className="w-44"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        aria-label="Company filter"
      >
        <option value="">All companies</option>
        {[...db.companies]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </NativeSelect>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        Closing by
        <input
          type="date"
          value={closeBy}
          onChange={(e) => setCloseBy(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        />
      </label>
      {(stage || owner || company || closeBy) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            setStage("");
            setOwner("");
            setCompany("");
            setCloseBy("");
          }}
        >
          Clear
        </Button>
      )}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Opportunities"
        description="Drag cards between stages on the board, or sort and filter in the table."
        actions={
          <>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={view}
              onValueChange={(v) => v && setView(v as "table" | "board")}
            >
              <ToggleGroupItem value="table" className="h-8 text-xs">
                <Table2 className="h-3.5 w-3.5" /> Table
              </ToggleGroupItem>
              <ToggleGroupItem value="board" className="h-8 text-xs">
                <KanbanSquare className="h-3.5 w-3.5" /> Board
              </ToggleGroupItem>
            </ToggleGroup>
            <Button size="sm" className="h-8" onClick={() => openForm({ kind: "opportunity" })}>
              <Plus className="h-3.5 w-3.5" /> New opportunity
            </Button>
          </>
        }
      />
      {view === "table" ? (
        <DataTable
          data={items}
          columns={columns}
          toolbar={filters}
          searchPlaceholder="Search opportunities…"
          onRowClick={(o) => openDrawer({ kind: "opportunity", id: o.id })}
          initialSort={[{ id: "expectedClose", desc: false }]}
        />
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">{filters}</div>
          <Board items={items} />
        </>
      )}
    </div>
  );
}

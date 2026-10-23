import { createFileRoute, Link } from "@tanstack/react-router";
import { formatISO } from "date-fns";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Input } from "@/components/ui/input";
import { NativeSelect, PageHeader, StageBadge } from "@/components/crm/fields";
import { useUI } from "@/components/crm/ui-state";
import { useDb, useFormat, useLookups } from "@/data/hooks";
import { formatAudCompact } from "@/domain/format";
import {
  openOpportunities,
  openPipelineValue,
  overdueActivities,
  periodRange,
  pipelineByStage,
  staleOpportunities,
  weightedPipelineValue,
  wonInRange,
  wonRevenue,
  wonRevenueByMonth,
  type PeriodKey,
} from "@/domain/services/pipeline";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview · Ledgerline Sales CRM" },
      {
        name: "description",
        content:
          "Pipeline value, weighted forecast, won revenue and overdue activities at a glance.",
      },
      { property: "og:title", content: "Overview · Ledgerline Sales CRM" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          "Pipeline value, weighted forecast, won revenue and overdue activities at a glance.",
      },
    ],
  }),
  component: Overview,
});

const PERIODS: Record<PeriodKey, string> = {
  month: "This month",
  quarter: "This quarter",
  fy: "This financial year",
  custom: "Custom range",
};

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: React.ReactNode;
  tone?: "danger" | undefined;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`num mt-1 text-2xl font-medium ${tone === "danger" ? "text-destructive" : ""}`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function Overview() {
  const db = useDb();
  const L = useLookups();
  const f = useFormat();
  const { openDrawer } = useUI();
  const [period, setPeriod] = useState<PeriodKey>("quarter");
  const iso = (d: Date) => formatISO(d, { representation: "date" });
  const [from, setFrom] = useState(() => iso(new Date(new Date().getFullYear(), 0, 1)));
  const [to, setTo] = useState(() => iso(new Date()));

  const m = useMemo(() => {
    const today = new Date();
    const range = periodRange(period, today, { from: new Date(from), to: new Date(to) });
    return {
      range,
      open: openOpportunities(db.opportunities).length,
      openValue: openPipelineValue(db.opportunities),
      weighted: weightedPipelineValue(db.opportunities, db.settings),
      won: wonRevenue(db.opportunities, range),
      wonCount: wonInRange(db.opportunities, range).length,
      overdue: overdueActivities(db.activities, today).length,
      byStage: pipelineByStage(db.opportunities, db.settings),
      byMonth: wonRevenueByMonth(db.opportunities, today),
      stale: staleOpportunities(db.opportunities, db.activities, db.settings.staleDays, today),
    };
  }, [db, period, from, to]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        description="Your pipeline health right now."
        actions={
          <>
            {period === "custom" && (
              <>
                <Input
                  type="date"
                  className="h-8 w-36 text-xs"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  aria-label="From"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  className="h-8 w-36 text-xs"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  aria-label="To"
                />
              </>
            )}
            <NativeSelect
              className="w-44"
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodKey)}
              aria-label="Won revenue period"
            >
              {Object.entries(PERIODS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </>
        }
      />
      <div className="grid grid-cols-4 gap-3">
        <Kpi
          label="Open pipeline"
          value={f.money(m.openValue)}
          hint={`${m.open} open opportunities`}
        />
        <Kpi label="Weighted pipeline" value={f.money(m.weighted)} hint="Value × win probability" />
        <Kpi
          label="Won revenue"
          value={f.money(m.won)}
          hint={`${m.wonCount} ${m.wonCount === 1 ? "deal" : "deals"} · ${f.date(m.range.from)} – ${f.date(m.range.to)}`}
        />
        <Kpi
          label="Overdue activities"
          value={String(m.overdue)}
          tone={m.overdue ? "danger" : undefined}
          hint={
            <Link
              to="/activities"
              search={{ status: "overdue" }}
              className="text-primary hover:underline"
            >
              View overdue →
            </Link>
          }
        />
      </div>
      <div className="grid grid-cols-5 gap-3">
        <div className="col-span-3 rounded-md border bg-card p-3">
          <h2 className="mb-2 text-xs font-semibold">Pipeline by stage</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={m.byStage} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis
                  tickFormatter={formatAudCompact}
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  width={64}
                />
                <Tooltip
                  formatter={(v: number) => f.money(v)}
                  contentStyle={{
                    fontSize: 12,
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="value" name="Value" fill="var(--chart-2)" radius={[2, 2, 0, 0]} />
                <Bar
                  dataKey="weighted"
                  name="Weighted"
                  fill="var(--chart-1)"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="col-span-2 rounded-md border bg-card p-3">
          <h2 className="mb-2 text-xs font-semibold">Won revenue · last 12 months</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={m.byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis
                  tickFormatter={formatAudCompact}
                  tick={{ fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                  width={56}
                />
                <Tooltip
                  formatter={(v: number) => f.money(v)}
                  contentStyle={{
                    fontSize: 12,
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                  }}
                />
                <Bar dataKey="value" name="Won" fill="var(--chart-5)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-xs font-semibold">Opportunities with no recent activity</h2>
          <span className="text-[11px] text-muted-foreground">
            No completed activity in {db.settings.staleDays}+ days ·{" "}
            <Link to="/settings" className="text-primary hover:underline">
              change
            </Link>
          </span>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              {[
                "Opportunity",
                "Company",
                "Stage",
                "Value",
                "Owner",
                "Last activity",
                "Days quiet",
              ].map((h) => (
                <th key={h} className="px-3 py-1.5 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.stale.map(({ opportunity: o, lastActivity, daysSince }) => (
              <tr
                key={o.id}
                className="cursor-pointer border-t hover:bg-accent/50"
                onClick={() => openDrawer({ kind: "opportunity", id: o.id })}
              >
                <td className="px-3 py-1.5 font-medium">{o.name}</td>
                <td className="px-3 py-1.5">{L.companyName(o.companyId)}</td>
                <td className="px-3 py-1.5">
                  <StageBadge stage={o.stage} />
                </td>
                <td className="num px-3 py-1.5">{f.money(o.value)}</td>
                <td className="px-3 py-1.5">{L.ownerName(o.ownerId)}</td>
                <td className="px-3 py-1.5">{f.date(lastActivity)}</td>
                <td className="num px-3 py-1.5 text-destructive">{daysSince}</td>
              </tr>
            ))}
            {m.stale.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Every open opportunity has recent activity.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

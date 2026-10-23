import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { queryCatalogue, type QueryContext } from "./queries";
import { WIDGET_TYPES, type WidgetDefinition } from "./schema";
import { useFormat } from "@/data/hooks";

export const widgetRegistry = Object.fromEntries(
  WIDGET_TYPES.map((type) => [type, { type, title: type.replace(/([a-z])([A-Z])/g, "$1 $2") }]),
) as Record<(typeof WIDGET_TYPES)[number], { type: (typeof WIDGET_TYPES)[number]; title: string }>;
export function DashboardSection({ children }: { children: ReactNode }) {
  return <section className="min-w-0 space-y-3">{children}</section>;
}
export function TabsContainer({ children }: { children: ReactNode }) {
  return (
    <section className="min-w-0" aria-label="Dashboard tabs">
      {children}
    </section>
  );
}
export function SplitPanel({ children }: { children: ReactNode }) {
  return (
    <section className="min-w-0" aria-label="Dashboard split panel">
      {children}
    </section>
  );
}
export function WidgetFrame({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}
export const containerRegistry = { DashboardSection, TabsContainer, SplitPanel, WidgetFrame };
export function WidgetBody({
  widget,
  context,
  onOpen,
}: {
  widget: WidgetDefinition;
  context: QueryContext;
  onOpen: (kind: "source" | "activity", id: string) => void;
}) {
  const f = useFormat();
  const rows = queryCatalogue[widget.queryId](context).slice(0, widget.props.limit ?? 10);
  if (!rows.length) return <p className="text-xs text-muted-foreground">Nothing pending.</p>;
  return (
    <div className="divide-y">
      {rows.map((row) => (
        <div key={row.id} className="py-2 text-xs">
          {row.value !== undefined ? (
            <>
              <p className="text-muted-foreground">{row.label}</p>
              <p className="num mt-1 text-xl">{row.money ? f.money(row.value) : row.value}</p>
            </>
          ) : row.sourceId || row.activityId ? (
            <Button
              variant="ghost"
              className="h-auto w-full justify-start whitespace-normal p-0 text-left text-xs"
              onClick={() => {
                const id = row.sourceId ?? row.activityId;
                if (id) onOpen(row.sourceId ? "source" : "activity", id);
              }}
            >
              {row.label}
            </Button>
          ) : (
            <p>{row.label}</p>
          )}
          {row.detail && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {widget.type === "NextSteps" || widget.type === "OverdueActivities"
                ? f.date(row.detail)
                : row.detail}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

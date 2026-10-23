import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ResponsiveGridLayout, useContainerWidth, type Layout } from "react-grid-layout";
import { GripVertical, Plus, RotateCcw, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDb, useRepoMutation } from "@/data/hooks";
import { useUI } from "@/components/crm/ui-state";
import { DemoBadge } from "@/components/crm/fields";
import { containerRegistry, widgetRegistry, WidgetBody } from "./registry";
import {
  defaultDashboard,
  MockDashboardGenerator,
  validateDashboard,
  WIDGET_TYPES,
  widgetQuery,
  type DashboardDefinition,
} from "./schema";

const cells = (layout: Layout) => layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
export function ConfigDashboard({
  id,
  scope,
  dealId,
}: {
  id: string;
  scope: "global" | "deal";
  dealId?: string;
}) {
  const db = useDb();
  const { openDrawer, closeDrawer } = useUI();
  const navigate = useNavigate();
  const saved = db.evidence.dashboards.find((d) => d.id === id);
  const [definition, setDefinition] = useState<DashboardDefinition>(
    saved ?? defaultDashboard(id, scope),
  );
  const [edit, setEdit] = useState(false);
  const [add, setAdd] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const { width, containerRef, mounted, measureWidth } = useContainerWidth({ initialWidth: 400 });
  // Tab children can mount while hidden, before their measured element exists.
  useEffect(() => {
    if (containerRef.current) measureWidth();
  });
  const save = useRepoMutation(
    (r, d: DashboardDefinition) => r.saveDashboard(d),
    "Dashboard layout saved",
  );
  let valid: DashboardDefinition;
  try {
    valid = validateDashboard(definition);
  } catch {
    return (
      <div role="alert" className="space-y-2">
        <p className="text-xs text-destructive">
          Dashboard could not be loaded. Unsupported widgets or settings.
        </p>
        <Button size="sm" onClick={() => setDefinition(defaultDashboard(id, scope))}>
          Reset to default
        </Button>
      </div>
    );
  }
  const Container = containerRegistry[valid.container];
  const persist = async () => {
    try {
      await save.mutateAsync(validateDashboard(definition));
      setEdit(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save dashboard");
    }
  };
  return (
    <Container>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {scope === "deal" ? "Deal dashboard" : "Inbox dashboard"}
        </h3>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => (edit ? void persist() : setEdit(true))}
          >
            <Settings2 className="h-3 w-3" />
            {edit ? "Save layout" : "Edit layout"}
          </Button>
          {edit && (
            <>
              <Button size="sm" variant="outline" onClick={() => setAdd(true)}>
                <Plus className="h-3 w-3" />
                Add widget
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDefinition(saved ?? defaultDashboard(id, scope));
                  setEdit(false);
                }}
              >
                Cancel
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const d = defaultDashboard(id, scope);
              setDefinition(d);
              await save.mutateAsync(d);
            }}
          >
            <RotateCcw className="h-3 w-3" />
            Reset to default
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <DemoBadge />
        <Input
          aria-label="Generate dashboard prompt"
          className="h-8 min-w-0 flex-1 text-xs"
          placeholder="Show overdue actions and new evidence"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!prompt.trim()}
          onClick={() => {
            try {
              setDefinition(new MockDashboardGenerator().generate(prompt, id, scope));
              setEdit(true);
              setError("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not generate dashboard");
            }
          }}
        >
          Generate dashboard
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div ref={containerRef} className="min-w-0">
        {mounted && (
          <ResponsiveGridLayout
            width={width}
            breakpoints={{ lg: 900, md: 600, sm: 0 }}
            cols={{ lg: 12, md: 6, sm: 1 }}
            layouts={
              valid.responsiveLayouts ?? {
                lg: valid.layout,
                md: valid.layout.map((l, i) => ({ ...l, x: 0, y: i * l.h, w: 6 })),
                sm: valid.layout.map((l, i) => ({ ...l, x: 0, y: i * l.h, w: 1 })),
              }
            }
            rowHeight={40}
            margin={[10, 10]}
            containerPadding={[0, 0]}
            dragConfig={{ enabled: edit, handle: ".widget-drag-handle" }}
            resizeConfig={{ enabled: edit }}
            onLayoutChange={(_, layouts) => {
              if (edit)
                setDefinition((d) => ({
                  ...d,
                  layout: cells(layouts["lg"] ?? d.layout),
                  responsiveLayouts: Object.fromEntries(
                    Object.entries(layouts)
                      .filter((entry): entry is [string, Layout] => Boolean(entry[1]))
                      .map(([key, value]) => [key, cells(value)]),
                  ),
                }));
            }}
          >
            {valid.widgets.map((widget) => (
              <div
                key={widget.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-md border bg-card"
              >
                <div
                  className={`flex shrink-0 items-center justify-between border-b px-3 py-2 ${edit ? "widget-drag-handle cursor-move" : ""}`}
                >
                  <h4 className="flex items-center gap-1 text-xs font-semibold">
                    {edit && <GripVertical className="h-3 w-3" />}
                    {widget.props.title ?? widgetRegistry[widget.type].title}
                  </h4>
                  {edit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      aria-label={`Remove ${widget.type}`}
                      onClick={() =>
                        setDefinition((d) => ({
                          ...d,
                          widgets: d.widgets.filter((w) => w.id !== widget.id),
                          layout: d.layout.filter((l) => l.i !== widget.id),
                          responsiveLayouts: Object.fromEntries(
                            Object.entries(d.responsiveLayouts ?? {}).map(([k, v]) => [
                              k,
                              v.filter((l) => l.i !== widget.id),
                            ]),
                          ),
                        }))
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="min-h-0 flex-1 overflow-auto px-3">
                  <WidgetBody
                    widget={widget}
                    context={{ db, ...(dealId ? { dealId } : {}) }}
                    onOpen={(kind, key) => {
                      if (kind === "activity") openDrawer({ kind: "activity", id: key });
                      else {
                        closeDrawer();
                        void navigate({ to: "/inbox", search: { source: key } });
                      }
                    }}
                  />
                </div>
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>
      <Dialog open={add} onOpenChange={setAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add widget</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {WIDGET_TYPES.filter((t) => !(scope === "global" && t === "StakeholderList")).map(
              (type) => (
                <Button
                  key={type}
                  variant="outline"
                  onClick={() => {
                    const widgetId = crypto.randomUUID();
                    setDefinition((d) => ({
                      ...d,
                      widgets: [
                        ...d.widgets,
                        { id: widgetId, type, queryId: widgetQuery(type), props: {} },
                      ],
                      layout: [
                        ...d.layout,
                        {
                          i: widgetId,
                          x: 0,
                          y: Math.max(0, ...d.layout.map((l) => l.y + l.h)),
                          w: 6,
                          h: 5,
                        },
                      ],
                      responsiveLayouts: undefined,
                    }));
                    setAdd(false);
                  }}
                >
                  {widgetRegistry[type].title}
                </Button>
              ),
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Container>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DemoBadge, Field, NativeSelect, PageHeader } from "@/components/crm/fields";
import { getRepository, useDb, useRepoMutation } from "@/data/hooks";
import { formatDate } from "@/domain/format";
import {
  DATE_FORMATS,
  OPEN_STAGES,
  STAGE_LABELS,
  type DateFormat,
  type Settings,
} from "@/domain/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Ledgerline Sales CRM" },
      {
        name: "description",
        content: "Date format, stage probabilities, sales team and demo data controls.",
      },
      { property: "og:title", content: "Settings · Ledgerline Sales CRM" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Date format, stage probabilities, sales team and demo data controls.",
      },
    ],
  }),
  component: SettingsPage,
});

function Card({
  title,
  children,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  badge?: boolean;
}) {
  return (
    <section className="rounded-md border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {title}
        {badge && <DemoBadge />}
      </h2>
      {children}
    </section>
  );
}

function SettingsPage() {
  const db = useDb();
  const [s, setS] = useState<Settings>(db.settings);
  const [newOwner, setNewOwner] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setS(db.settings), [db.settings]);

  const save = useRepoMutation((r, v: Settings) => r.updateSettings(v), "Settings saved");
  const reset = useRepoMutation((r) => r.resetDemoData(), "Demo data restored");
  const importer = useRepoMutation((r, json: string) => r.importJson(json), "Data imported");
  const dirty = JSON.stringify(s) !== JSON.stringify(db.settings);

  const exportData = async () => {
    const json = await getRepository().exportJson();
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  };

  const removeOwner = (id: string) => {
    const inUse =
      db.opportunities.some((o) => o.ownerId === id) ||
      db.companies.some((c) => c.ownerId === id) ||
      db.activities.some((a) => a.ownerId === id);
    if (inUse) {
      toast.error("This person still owns records. Reassign them first.");
      return;
    }
    setS({ ...s, owners: s.owners.filter((o) => o.id !== id) });
  };

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title="Settings"
        description="Preferences are saved with your data on this computer."
        actions={
          <>
            {dirty && (
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setS(db.settings)}>
                Discard
              </Button>
            )}
            <Button
              size="sm"
              className="h-8"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate(s)}
            >
              Save settings
            </Button>
          </>
        }
      />
      <Card title="Regional">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date format">
            <NativeSelect
              value={s.dateFormat}
              onChange={(e) => setS({ ...s, dateFormat: e.target.value as DateFormat })}
            >
              {DATE_FORMATS.map((d) => (
                <option key={d} value={d}>
                  {formatDate(new Date(), d)} ({d})
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Currency">
            <Input value="Australian dollar (AUD)" disabled />
          </Field>
        </div>
      </Card>
      <Card title="Pipeline">
        <div className="grid grid-cols-5 gap-3">
          <Field label="Stale after (days)">
            <Input
              type="number"
              min={1}
              max={365}
              value={s.staleDays}
              onChange={(e) => setS({ ...s, staleDays: Math.max(1, Number(e.target.value) || 1) })}
            />
          </Field>
          {OPEN_STAGES.map((st) => (
            <Field key={st} label={`${STAGE_LABELS[st]} probability %`}>
              <Input
                type="number"
                min={0}
                max={100}
                value={s.stageProbabilities[st]}
                onChange={(e) =>
                  setS({
                    ...s,
                    stageProbabilities: {
                      ...s.stageProbabilities,
                      [st]: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                    },
                  })
                }
              />
            </Field>
          ))}
        </div>
      </Card>
      <Card title="Sales team" badge>
        <p className="mb-2 text-xs text-muted-foreground">
          Owners are plain names — there are no user accounts or sign-in in this demo.
        </p>
        <div className="divide-y rounded-md border">
          {s.owners.map((o) => (
            <div key={o.id} className="flex items-center gap-2 px-2 py-1">
              <Input
                className="h-7 border-0 text-xs shadow-none"
                value={o.name}
                onChange={(e) =>
                  setS({
                    ...s,
                    owners: s.owners.map((x) =>
                      x.id === o.id ? { ...x, name: e.target.value } : x,
                    ),
                  })
                }
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label={`Remove ${o.name}`}
                onClick={() => removeOwner(o.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newOwner.trim()) return;
            setS({
              ...s,
              owners: [...s.owners, { id: `u_${Date.now().toString(36)}`, name: newOwner.trim() }],
            });
            setNewOwner("");
          }}
        >
          <Input
            className="h-8 text-xs"
            placeholder="New team member name"
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
          />
          <Button size="sm" variant="outline" className="h-8" type="submit">
            Add
          </Button>
        </form>
      </Card>
      <Card title="Data" badge>
        <p className="mb-3 text-xs text-muted-foreground">
          All records live in this browser's local storage. Export regularly to keep a backup.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportData}>
            <Download className="h-3.5 w-3.5" /> Export JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Import JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) importer.mutate(await file.text());
            }}
          />
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (window.confirm("Replace all data with fresh demo data?")) reset.mutate(undefined);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
          </Button>
        </div>
      </Card>
    </div>
  );
}

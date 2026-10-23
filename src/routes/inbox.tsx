import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoBadge, NativeSelect, PageHeader } from "@/components/crm/fields";
import { SourceCapture } from "@/components/crm/source-capture";
import { SourceDetail } from "@/components/crm/source-detail";
import { ConfigDashboard } from "@/dashboard/config-dashboard";
import { useDb, useFormat } from "@/data/hooks";

export const Route = createFileRoute("/inbox")({
  validateSearch: z.object({ source: z.string().optional(), deal: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Inbox · Ledgerline Sales CRM" },
      { name: "description", content: "Local deal evidence, people and reviewable next steps." },
      { property: "og:title", content: "Inbox · Ledgerline Sales CRM" },
      {
        property: "og:description",
        content: "Local deal evidence, people and reviewable next steps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  const db = useDb();
  const f = useFormat();
  const search = Route.useSearch();
  const [selected, setSelected] = useState(search.source ?? "");
  const [filter, setFilter] = useState("needs_review");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const sources = db.evidence.sources
    .filter(
      (s) =>
        (filter === "all" ||
          (filter === "needs_review" &&
            s.reviewStatus === "needs_review" &&
            s.status === "ready") ||
          (filter === "filed" && s.reviewStatus === "filed") ||
          s.status === filter) &&
        (!search.deal ||
          db.evidence.links.some(
            (l) => l.sourceItemId === s.id && l.dealId === search.deal && l.state !== "rejected",
          )) &&
        `${s.title} ${s.originalText} ${s.topics.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "oldest"
          ? a.receivedAt.localeCompare(b.receivedAt)
          : b.receivedAt.localeCompare(a.receivedAt),
    );
  const source = db.evidence.sources.find((s) => s.id === selected) ?? sources[0];
  return (
    <div className="space-y-3">
      <PageHeader
        title="Inbox"
        actions={
          <>
            <Badge variant="secondary">
              {db.evidence.sources.filter((s) => s.reviewStatus === "needs_review").length} needing
              review
            </Badge>
            <DemoBadge />
          </>
        }
      />
      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Evidence queue</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="space-y-3">
          <SourceCapture
            {...(search.deal ? { dealId: search.deal } : {})}
            onCaptured={(id) => {
              setSelected(id);
              setFilter("all");
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              className="w-40"
              aria-label="Queue status"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setSelected("");
              }}
            >
              {[
                ["all", "All items"],
                ["new", "New"],
                ["processing", "Processing"],
                ["needs_review", "Needs review"],
                ["filed", "Filed"],
                ["failed", "Failed"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
            <Input
              className="h-8 max-w-72 text-xs"
              placeholder="Search evidence…"
              aria-label="Search evidence"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected("");
              }}
            />
            <NativeSelect
              aria-label="Sort evidence"
              className="w-36"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
            </NativeSelect>
            <span className="text-xs text-muted-foreground">{sources.length} items</span>
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="min-w-0 space-y-1">
              {sources.map((s) => (
                <Button
                  key={s.id}
                  variant="ghost"
                  onClick={() => setSelected(s.id)}
                  className={`h-auto w-full items-start justify-start whitespace-normal rounded-md border px-3 py-3 text-left ${source?.id === s.id ? "border-primary bg-accent" : "bg-card"}`}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-xs font-semibold">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.type} · {f.date(s.receivedAt)}
                    </p>
                    <Badge variant={s.status === "failed" ? "destructive" : "outline"}>
                      {s.duplicateOf
                        ? "Duplicate"
                        : s.status === "ready"
                          ? s.reviewStatus.replaceAll("_", " ")
                          : s.status}
                    </Badge>
                  </div>
                </Button>
              ))}
              {!sources.length && (
                <div className="space-y-2 py-6 text-center">
                  <Inbox className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="text-xs">No evidence in this view.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFilter("all");
                      setQuery("");
                    }}
                  >
                    Show all items
                  </Button>
                </div>
              )}
            </div>
            <div className="min-w-0 border-l pl-4">
              {source ? (
                <SourceDetail key={source.id} source={source} />
              ) : (
                <p className="py-6 text-xs text-muted-foreground">
                  Drop a file or paste text to start.
                </p>
              )}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="dashboard">
          <ConfigDashboard id="global-inbox" scope="global" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDb } from "@/data/hooks";
import { SourceCapture } from "./source-capture";
import { SourceDetail } from "./source-detail";
import { SuggestionReview } from "./suggestion-review";
import { ConfigDashboard } from "@/dashboard/config-dashboard";
import { NativeSelect } from "./fields";
import { useUI } from "./ui-state";

export function DealEvidence({ dealId, details }: { dealId: string; details: React.ReactNode }) {
  const db = useDb();
  const [selected, setSelected] = useState("");
  const [actor, setActor] = useState(db.settings.owners[0]?.id ?? "");
  const navigate = useNavigate();
  const { closeDrawer } = useUI();
  const ids = new Set(
    db.evidence.links
      .filter((l) => l.dealId === dealId && l.state === "accepted")
      .map((l) => l.sourceItemId),
  );
  const sources = db.evidence.sources.filter((s) => ids.has(s.id));
  const source = sources.find((s) => s.id === selected);
  const suggestions = db.evidence.suggestions.filter(
    (s) => s.payload.dealId === dealId && s.state === "pending",
  );
  return (
    <Tabs defaultValue="details">
      <TabsList className="w-full">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="evidence">Evidence ({sources.length})</TabsTrigger>
        <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="space-y-5">
        {details}
      </TabsContent>
      <TabsContent value="evidence" className="space-y-3">
        <SourceCapture dealId={dealId} onCaptured={setSelected} />
        {sources.map((s) => (
          <Button
            key={s.id}
            variant="outline"
            className="h-auto w-full justify-start whitespace-normal text-left text-xs"
            onClick={() => setSelected(s.id)}
          >
            {s.title} · {s.reviewStatus.replaceAll("_", " ")}
          </Button>
        ))}
        {!sources.length && (
          <p className="text-xs text-muted-foreground">No linked evidence yet.</p>
        )}
        {source && <SourceDetail key={source.id} source={source} compact />}
      </TabsContent>
      <TabsContent value="suggestions" className="space-y-3">
        <NativeSelect
          aria-label="Suggestion reviewer"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
        >
          {db.settings.owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
        {suggestions.map((s) => (
          <SuggestionReview
            key={s.id}
            suggestion={s}
            actorId={actor}
            onEvidence={() => {
              closeDrawer();
              void navigate({ to: "/inbox", search: { source: s.sourceItemId } });
            }}
          />
        ))}
        {!suggestions.length && (
          <p className="text-xs text-muted-foreground">No pending next steps.</p>
        )}
      </TabsContent>
      <TabsContent value="dashboard">
        <ConfigDashboard key={dealId} id={`deal-${dealId}`} scope="deal" dealId={dealId} />
        <section className="mt-4 space-y-2">
          <h3 className="text-xs font-semibold">Open signals</h3>
          {db.evidence.assertions
            .filter(
              (a) =>
                ids.has(a.sourceItemId) &&
                a.state !== "rejected" &&
                (a.kind === "signal" || a.kind === "risk"),
            )
            .map((a) => (
              <p key={a.id} className={`text-xs ${a.kind === "risk" ? "text-destructive" : ""}`}>
                {a.text} · {Math.round(a.confidence * 100)}%
              </p>
            ))}
        </section>
      </TabsContent>
    </Tabs>
  );
}

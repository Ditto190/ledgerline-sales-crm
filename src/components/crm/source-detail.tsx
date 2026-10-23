import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDb, useFormat, useRepoMutation } from "@/data/hooks";
import { bulkEligible } from "@/domain/services/evidence";
import type { SourceItem, SourceType } from "@/domain/evidence";
import { DemoBadge, NativeSelect, StageBadge } from "./fields";
import { SuggestionReview } from "./suggestion-review";
import { useUI } from "./ui-state";

function PersonResolution({ id, actorId }: { id: string; actorId: string }) {
  const db = useDb();
  const mention = db.evidence.mentions.find((m) => m.id === id);
  const [contact, setContact] = useState("");
  const resolve = useRepoMutation(
    (r, contactId: string) => r.resolveMention(id, contactId, actorId),
    "Person resolved",
  );
  if (!mention) return null;
  return (
    <div className="space-y-1 border-b py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary">{mention.name}</Badge>
        <span className={mention.state === "resolved" ? "text-success" : "text-destructive"}>
          {mention.state === "ambiguous" ? "Unresolved · ambiguous" : mention.state}
        </span>
      </div>
      {mention.state === "resolved" ? (
        <p className="text-muted-foreground">
          {db.contacts.find((c) => c.id === mention.contactId)?.firstName}{" "}
          {db.contacts.find((c) => c.id === mention.contactId)?.lastName}
        </p>
      ) : (
        <div className="flex gap-1">
          <NativeSelect
            aria-label={`Resolve ${mention.name}`}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          >
            <option value="">Choose a contact…</option>
            {db.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} ·{" "}
                {db.companies.find((co) => co.id === c.companyId)?.name ?? "No company"}
              </option>
            ))}
          </NativeSelect>
          <Button
            size="sm"
            disabled={!contact || resolve.isPending}
            onClick={() => resolve.mutate(contact)}
          >
            Resolve
          </Button>
        </div>
      )}
    </div>
  );
}

export function SourceDetail({
  source: s,
  compact = false,
}: {
  source: SourceItem;
  compact?: boolean;
}) {
  const db = useDb();
  const f = useFormat();
  const { openDrawer } = useUI();
  const [highlight, setHighlight] = useState("");
  const [actor, setActor] = useState(db.settings.owners[0]?.id ?? "");
  const [deal, setDeal] = useState("");
  const [topics, setTopics] = useState(s.topics.join(", "));
  const retry = useRepoMutation((r) => r.retrySource(s.id));
  const file = useRepoMutation((r) => r.fileSource(s.id, actor), "Evidence filed");
  const bulk = useRepoMutation(
    (r) => r.bulkAccept(s.id, actor),
    "High-confidence suggestions reviewed",
  );
  const link = useRepoMutation((r, input: { dealId: string; accepted: boolean }) =>
    r.setSourceLink(s.id, input.dealId, input.accepted, actor),
  );
  const labels = useRepoMutation((r, input: { type: SourceType; topics: string[] }) =>
    r.updateSourceLabels(s.id, input.type, input.topics),
  );
  const assertion = useRepoMutation((r, input: { id: string; state: "accepted" | "rejected" }) =>
    r.reviewAssertion(input.id, input.state, actor),
  );
  const suggestions = db.evidence.suggestions.filter((x) => x.sourceItemId === s.id);
  const eligible = suggestions.filter((x) => bulkEligible(x, db.evidence));
  const focus = (id: string) => {
    setHighlight(id);
    requestAnimationFrame(() =>
      document.getElementById(`evidence-${id}`)?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      }),
    );
  };
  const spans = db.evidence.spans.filter((x) => x.sourceItemId === s.id);
  const boundaries = [
    ...new Set([0, s.originalText.length, ...spans.flatMap((x) => [x.start, x.end])]),
  ].sort((a, b) => a - b);
  const activeSpan = spans.find((x) => x.id === highlight);
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{s.title}</h2>
          <p className="text-[11px] text-muted-foreground">
            {s.origin} · {f.date(s.receivedAt)} · {s.sensitivity}
          </p>
        </div>
        <DemoBadge />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant={s.status === "failed" ? "destructive" : "outline"}>
          Ingestion: {s.status}
        </Badge>
        <Badge variant="secondary">Review: {s.reviewStatus.replaceAll("_", " ")}</Badge>
        <NativeSelect
          aria-label="Reviewer"
          className="w-40"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
        >
          {db.settings.owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
        <Button
          size="sm"
          variant="outline"
          disabled={s.status !== "ready" || s.reviewStatus === "filed" || file.isPending}
          onClick={() => file.mutate(undefined)}
        >
          File item
        </Button>
      </div>
      {s.error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <span role="alert">{s.error}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={retry.isPending}
            onClick={() => retry.mutate(undefined)}
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      )}
      {s.duplicateOf && (
        <p className="text-xs text-warning-foreground">
          Exact duplicate of “{db.evidence.sources.find((x) => x.id === s.duplicateOf)?.title}”; no
          new suggestions.
        </p>
      )}
      <details className="text-[11px] text-muted-foreground">
        <summary className="cursor-pointer">Processing history</summary>
        <ol className="mt-2 grid grid-cols-2 gap-1">
          {s.stages.map((stage) => (
            <li key={stage.stage}>
              {stage.stage.replaceAll("_", " ")} · {stage.status} ·{" "}
              {stage.timestamp ? new Date(stage.timestamp).toLocaleString("en-AU") : "—"}
              {stage.error && ` · ${stage.error}`}
            </li>
          ))}
        </ol>
        <p className="mt-2 break-all font-mono">SHA-256: {s.contentHash}</p>
      </details>
      <div className={`grid gap-4 ${compact ? "" : "xl:grid-cols-2"}`}>
        <div className="min-w-0">
          <h3 className="mb-2 text-xs font-semibold">Original evidence</h3>
          <div
            className="max-h-[580px] overflow-auto rounded-md border bg-card p-3 text-xs leading-relaxed whitespace-pre-wrap break-words"
            aria-label="Original evidence text"
          >
            {boundaries.slice(0, -1).map((start, i) => {
              const end = boundaries[i + 1] ?? start;
              const starting = spans.filter((x) => x.start === start);
              const highlighted = activeSpan && start >= activeSpan.start && end <= activeSpan.end;
              return (
                <span key={start}>
                  {starting.map((span) => (
                    <span key={span.id} id={`evidence-${span.id}`} />
                  ))}
                  <span
                    className={
                      highlighted
                        ? "bg-warning text-warning-foreground"
                        : spans.some((x) => start >= x.start && end <= x.end)
                          ? "bg-accent"
                          : ""
                    }
                  >
                    {s.originalText.slice(start, end)}
                  </span>
                </span>
              );
            })}
            {!s.originalText && <span className="text-muted-foreground">No readable text.</span>}
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold">Classification</h3>
            <NativeSelect
              aria-label="Classification"
              value={s.type}
              onChange={(e) =>
                labels.mutate({ type: e.target.value as SourceType, topics: s.topics })
              }
            >
              <option value="note">Note</option>
              <option value="transcript">Transcript</option>
              <option value="email">Email</option>
            </NativeSelect>
            <div className="flex flex-wrap gap-1">
              {s.topics.map((t) => (
                <Badge key={t} variant="secondary">
                  {t}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-1 h-4 w-4"
                    aria-label={`Remove ${t}`}
                    onClick={() =>
                      labels.mutate({ type: s.type, topics: s.topics.filter((x) => x !== t) })
                    }
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1">
              <Input
                aria-label="Topic labels"
                className="h-8 text-xs"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => labels.mutate({ type: s.type, topics: topics.split(",") })}
              >
                Save topics
              </Button>
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-xs font-semibold">Deal relationships</h3>
            {db.evidence.links
              .filter((l) => l.sourceItemId === s.id && l.state !== "rejected")
              .map((l) => {
                const o = db.opportunities.find((o) => o.id === l.dealId);
                return (
                  <div key={l.id} className="space-y-1 border-b pb-2 text-xs">
                    <Button
                      variant="link"
                      className="h-auto max-w-full justify-start whitespace-normal p-0 text-left text-xs"
                      onClick={() => openDrawer({ kind: "opportunity", id: l.dealId })}
                    >
                      {o?.name ?? "Deleted deal"}
                    </Button>
                    <div className="flex flex-wrap items-center gap-1">
                      {o && <StageBadge stage={o.stage} />}
                      <span>
                        {l.linkedBy} · {Math.round(l.confidence * 100)}% · {l.state}
                      </span>
                      {l.state === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => link.mutate({ dealId: l.dealId, accepted: true })}
                        >
                          Approve link
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => link.mutate({ dealId: l.dealId, accepted: false })}
                      >
                        {l.state === "pending" ? "Reject link" : "Unlink"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            <div className="flex gap-1">
              <NativeSelect
                aria-label="Link to a different deal"
                value={deal}
                onChange={(e) => setDeal(e.target.value)}
              >
                <option value="">Link to a different deal…</option>
                {db.opportunities.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </NativeSelect>
              <Button
                size="sm"
                disabled={!deal}
                onClick={() => {
                  link.mutate({ dealId: deal, accepted: true });
                  setDeal("");
                }}
              >
                Link
              </Button>
            </div>
          </section>
          <section>
            <h3 className="text-xs font-semibold">People mentioned</h3>
            {db.evidence.mentions
              .filter((m) => m.sourceItemId === s.id)
              .map((m) => (
                <PersonResolution key={m.id} id={m.id} actorId={actor} />
              ))}
            {!db.evidence.mentions.some((m) => m.sourceItemId === s.id) && (
              <p className="text-xs text-muted-foreground">No people identified.</p>
            )}
          </section>
          <section className="space-y-2">
            <h3 className="text-xs font-semibold">Assertions and signals</h3>
            {db.evidence.assertions
              .filter((a) => a.sourceItemId === s.id)
              .map((a) => (
                <div key={a.id} className="space-y-1 border-b pb-2">
                  <div className="flex gap-1">
                    <Badge variant={a.kind === "risk" ? "destructive" : "outline"}>{a.kind}</Badge>
                    <span className="text-[11px]">
                      {Math.round(a.confidence * 100)}% · {a.state}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-auto w-full justify-start whitespace-normal p-0 text-left text-xs"
                    onClick={() => focus(a.evidenceSpanId)}
                  >
                    {a.text}
                  </Button>
                  {a.state === "pending" && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => assertion.mutate({ id: a.id, state: "accepted" })}
                      >
                        <Check className="h-3 w-3" />
                        Accept signal
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => assertion.mutate({ id: a.id, state: "rejected" })}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
          </section>
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold">Suggested next steps</h3>
              <Button
                size="sm"
                variant="outline"
                disabled={!eligible.length || bulk.isPending}
                onClick={() => bulk.mutate(undefined)}
              >
                Accept high confidence ({eligible.length})
              </Button>
            </div>
            {suggestions.map((suggestion) => (
              <SuggestionReview
                key={suggestion.id}
                suggestion={suggestion}
                actorId={actor}
                onEvidence={focus}
              />
            ))}
            {!suggestions.length && (
              <p className="text-xs text-muted-foreground">No suggested actions.</p>
            )}
          </section>
          <section>
            <h3 className="mb-1 text-xs font-semibold">Audit trail</h3>
            {db.evidence.audit
              .filter((a) => a.sourceItemId === s.id)
              .map((a) => (
                <p key={a.id} className="text-[11px] text-muted-foreground">
                  {db.settings.owners.find((o) => o.id === a.actorId)?.name ?? "Former team member"}{" "}
                  · {a.action} · {new Date(a.at).toLocaleString("en-AU")}
                </p>
              ))}
            {!db.evidence.audit.some((a) => a.sourceItemId === s.id) && (
              <p className="text-xs text-muted-foreground">Not reviewed yet.</p>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

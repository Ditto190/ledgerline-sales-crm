import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useDb, useFormat, useRepoMutation } from "@/data/hooks";
import type { ReviewInput, Suggestion, SuggestionPayload } from "@/domain/evidence";
import { requiresConfirmation } from "@/domain/services/evidence";
import { STAGE_LABELS, STAGES, type Stage } from "@/domain/types";
import { Field, NativeSelect } from "./fields";

export function SuggestionReview({
  suggestion: s,
  actorId,
  onEvidence,
}: {
  suggestion: Suggestion;
  actorId: string;
  onEvidence: (id: string) => void;
}) {
  const db = useDb();
  const f = useFormat();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [payload, setPayload] = useState<SuggestionPayload>(s.payload);
  const [error, setError] = useState("");
  const [edited, setEdited] = useState(false);
  const review = useRepoMutation(
    (r, input: ReviewInput) => r.reviewSuggestion(input),
    "Suggestion reviewed",
  );
  const span = db.evidence.spans.find((e) => e.id === s.evidenceSpanId);
  const source = db.evidence.sources.find((x) => x.id === s.sourceItemId);
  const snippet =
    span && source ? source.originalText.slice(span.start, span.end) : "Evidence unavailable";
  const submit = async (decision: "accept" | "reject", confirmed = false) => {
    setError("");
    try {
      await review.mutateAsync({
        suggestionId: s.id,
        actorId,
        decision,
        confirmed,
        ...(edited ? { payload } : {}),
      });
      setConfirm(false);
      setEdit(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    }
  };
  const accept = () => {
    if (requiresConfirmation({ ...s, payload })) setConfirm(true);
    else void submit("accept");
  };
  const change = (patch: Partial<SuggestionPayload>) => {
    setPayload((p) => ({ ...p, ...patch }));
    setEdited(true);
  };
  return (
    <article className="space-y-2 rounded-md border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold">
          {s.kind.replaceAll("_", " ")}
          {s.kind === "create_task" ? ` · ${s.payload.subject}` : ""}
        </p>
        <Badge variant="outline">{Math.round(s.confidence * 100)}%</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {db.opportunities.find((o) => o.id === s.payload.dealId)?.name ?? "Missing deal"} ·{" "}
        {s.state}
      </p>
      {s.kind === "create_task" && (
        <p className="text-xs">
          {f.date(s.payload.dueDate ?? null)} ·{" "}
          {db.settings.owners.find((o) => o.id === s.payload.ownerId)?.name ?? "Choose owner"}
        </p>
      )}
      {s.kind === "update_field" && (
        <p className="text-xs">
          {s.payload.field}:{" "}
          {s.payload.field === "value" ? f.money(Number(s.payload.value)) : String(s.payload.value)}
        </p>
      )}
      {s.kind === "stage_change" && (
        <p className="text-xs">
          Proposed stage: {s.payload.stage ? STAGE_LABELS[s.payload.stage] : "—"}
        </p>
      )}
      {s.kind === "add_stakeholder" && (
        <p className="text-xs">
          {db.contacts.find((c) => c.id === s.payload.contactId)?.firstName}{" "}
          {db.contacts.find((c) => c.id === s.payload.contactId)?.lastName}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{s.rationale}</p>
      <Button
        variant="ghost"
        className="h-auto w-full justify-start whitespace-normal border-l-2 border-primary py-1 text-left text-xs"
        onClick={() => onEvidence(s.evidenceSpanId)}
      >
        “{snippet}”
      </Button>
      {s.state === "pending" && (
        <div className="flex gap-1">
          <Button size="sm" disabled={review.isPending} onClick={accept}>
            <Check className="h-3 w-3" />
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEdit(true)}>
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={review.isPending}
            onClick={() => void submit("reject")}
          >
            <X className="h-3 w-3" />
            Reject
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit suggested action</DialogTitle>
          </DialogHeader>
          <Field label="Deal">
            <NativeSelect
              aria-label="Suggested deal"
              value={payload.dealId}
              onChange={(e) => change({ dealId: e.target.value })}
            >
              {db.opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {s.kind === "create_task" && (
            <>
              <Field label="Task">
                <Input
                  aria-label="Suggested task"
                  value={payload.subject ?? ""}
                  onChange={(e) => change({ subject: e.target.value })}
                />
              </Field>
              <Field label="Due date">
                <Input
                  aria-label="Suggested due date"
                  type="date"
                  value={payload.dueDate ?? ""}
                  onChange={(e) => change({ dueDate: e.target.value })}
                />
              </Field>
              <Field label="Internal owner">
                <NativeSelect
                  aria-label="Task owner"
                  value={payload.ownerId ?? ""}
                  onChange={(e) => change({ ownerId: e.target.value })}
                >
                  {db.settings.owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </>
          )}
          {s.kind === "add_stakeholder" && (
            <Field label="Contact">
              <NativeSelect
                value={payload.contactId ?? ""}
                onChange={(e) => change({ contactId: e.target.value })}
              >
                <option value="">Choose contact</option>
                {db.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          {s.kind === "update_field" && (
            <Field label={payload.field ?? "Value"}>
              <Input
                type={payload.field === "value" ? "number" : "date"}
                value={payload.value ?? ""}
                onChange={(e) =>
                  change({
                    value: payload.field === "value" ? Number(e.target.value) : e.target.value,
                  })
                }
              />
            </Field>
          )}
          {s.kind === "stage_change" && (
            <Field label="Stage">
              <NativeSelect
                value={payload.stage ?? ""}
                onChange={(e) => change({ stage: e.target.value as Stage })}
              >
                {STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Button onClick={accept}>Accept edited suggestion</Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm deal {s.kind === "stage_change" ? "stage" : "value"} change?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {db.opportunities.find((o) => o.id === payload.dealId)?.name}:{" "}
              {s.kind === "stage_change"
                ? `${db.opportunities.find((o) => o.id === payload.dealId)?.stage} → ${payload.stage}`
                : `${f.money(db.opportunities.find((o) => o.id === payload.dealId)?.value ?? 0)} → ${f.money(Number(payload.value))}`}
              . This changes the pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button disabled={review.isPending} onClick={() => void submit("accept", true)}>
              Confirm change
            </Button>
          </AlertDialogFooter>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

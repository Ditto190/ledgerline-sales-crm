import type { Snapshot } from "@/domain/types";
import { isOverdue, openPipelineValue, weightedPipelineValue } from "@/domain/services/pipeline";
import type { QUERY_IDS } from "./schema";
export interface WidgetRow {
  id: string;
  label: string;
  detail?: string;
  sourceId?: string;
  dealId?: string;
  activityId?: string;
  value?: number;
  money?: boolean;
}
export interface QueryContext {
  db: Snapshot;
  dealId?: string;
}
type Query = (context: QueryContext) => WidgetRow[];
const sourceIds = ({ db, dealId }: QueryContext) =>
  new Set(
    dealId
      ? db.evidence.links
          .filter((l) => l.dealId === dealId && l.state === "accepted")
          .map((l) => l.sourceItemId)
      : db.evidence.sources.map((s) => s.id),
  );
export const queryCatalogue: Record<(typeof QUERY_IDS)[number], Query> = {
  review_count: (c) => [
    {
      id: "review",
      label: "Needs review",
      value: c.db.evidence.sources.filter(
        (s) => sourceIds(c).has(s.id) && s.reviewStatus === "needs_review",
      ).length,
    },
  ],
  inbox_queue: (c) =>
    c.db.evidence.sources
      .filter((s) => sourceIds(c).has(s.id) && s.reviewStatus === "needs_review")
      .map((s) => ({ id: s.id, label: s.title, detail: s.status, sourceId: s.id })),
  suggested_actions: (c) =>
    c.db.evidence.suggestions
      .filter(
        (s) =>
          sourceIds(c).has(s.sourceItemId) &&
          (!c.dealId || s.payload.dealId === c.dealId) &&
          s.state === "pending",
      )
      .map((s) => ({
        id: s.id,
        label: s.payload.subject ?? s.kind.replaceAll("_", " "),
        detail: `${Math.round(s.confidence * 100)}% · pending`,
        sourceId: s.sourceItemId,
      })),
  next_steps: (c) =>
    c.db.activities
      .filter((a) => !a.completed && (!c.dealId || a.opportunityId === c.dealId))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((a) => ({ id: a.id, label: a.subject, detail: a.dueDate, activityId: a.id })),
  evidence_feed: (c) =>
    c.db.evidence.sources
      .filter((s) => sourceIds(c).has(s.id) && !s.duplicateOf)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .map((s) => ({
        id: s.id,
        label: s.title,
        detail: `${s.type} · ${s.reviewStatus.replaceAll("_", " ")}`,
        sourceId: s.id,
      })),
  stakeholders: (c) =>
    (c.db.opportunities.find((o) => o.id === c.dealId)?.contactIds ?? []).flatMap((id) => {
      const contact = c.db.contacts.find((x) => x.id === id);
      return contact
        ? [{ id, label: `${contact.firstName} ${contact.lastName}`, detail: contact.jobTitle }]
        : [];
    }),
  pipeline_summary: (c) => {
    const deals = c.dealId
      ? c.db.opportunities.filter((o) => o.id === c.dealId)
      : c.db.opportunities;
    return [
      { id: "open", label: "Open pipeline", value: openPipelineValue(deals), money: true },
      {
        id: "weighted",
        label: "Weighted pipeline",
        value: weightedPipelineValue(deals, c.db.settings),
        money: true,
      },
    ];
  },
  overdue_activities: (c) =>
    c.db.activities
      .filter((a) => (!c.dealId || a.opportunityId === c.dealId) && isOverdue(a, new Date()))
      .map((a) => ({ id: a.id, label: a.subject, detail: a.dueDate, activityId: a.id })),
};

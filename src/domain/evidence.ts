import type { Stage } from "./types";
import type { DashboardDefinition } from "@/dashboard/schema";

export type SourceType = "note" | "transcript" | "email";
export type IngestionStatus = "new" | "processing" | "ready" | "failed";
export type ReviewStatus = "needs_review" | "filed";
export const PIPELINE_STAGES = [
  "capture",
  "parse",
  "extract",
  "resolve_people",
  "classify_link",
  "propose",
  "review",
  "commit",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export interface StageRecord {
  stage: PipelineStage;
  status: "pending" | "running" | "complete" | "failed";
  timestamp: string | null;
  error?: string;
}
export interface SourceItem {
  id: string;
  type: SourceType;
  title: string;
  origin: string;
  status: IngestionStatus;
  reviewStatus: ReviewStatus;
  contentHash: string;
  receivedAt: string;
  ownerId: string;
  sensitivity: "standard" | "confidential";
  readonly originalText: string;
  topics: string[];
  stages: StageRecord[];
  duplicateOf: string | null;
  error: string | null;
}
export interface EvidenceSpan {
  id: string;
  sourceItemId: string;
  start: number;
  end: number;
  speaker?: string;
  timestamp?: string;
}
export interface Assertion {
  id: string;
  sourceItemId: string;
  kind: "signal" | "commitment" | "risk" | "date" | "stakeholder" | "topic";
  text: string;
  confidence: number;
  evidenceSpanId: string;
  state: "pending" | "accepted" | "rejected";
}
export interface SourceDealLink {
  id: string;
  sourceItemId: string;
  dealId: string;
  confidence: number;
  linkedBy: "explicit" | "suggested" | "manual";
  state: "pending" | "accepted" | "rejected";
}
export interface PersonMention {
  id: string;
  sourceItemId: string;
  name: string;
  contactId: string | null;
  candidates: string[];
  state: "resolved" | "ambiguous" | "unresolved";
  evidenceSpanId: string;
}
export type SuggestionPayload = {
  dealId: string;
  subject?: string | undefined;
  dueDate?: string | undefined;
  ownerId?: string | undefined;
  contactId?: string | undefined;
  field?: "value" | "expectedClose";
  value?: number | string;
  stage?: Stage | undefined;
};
export interface Suggestion {
  id: string;
  sourceItemId: string;
  kind: "create_task" | "update_field" | "add_stakeholder" | "stage_change";
  payload: SuggestionPayload;
  rationale: string;
  evidenceSpanId: string;
  confidence: number;
  state: "pending" | "accepted" | "edited" | "rejected";
  activityId?: string;
}
export interface AuditEntry {
  id: string;
  sourceItemId: string;
  suggestionId?: string;
  actorId: string;
  action: string;
  at: string;
}
export interface EvidenceStore {
  sources: SourceItem[];
  spans: EvidenceSpan[];
  assertions: Assertion[];
  links: SourceDealLink[];
  mentions: PersonMention[];
  suggestions: Suggestion[];
  audit: AuditEntry[];
  dashboards: DashboardDefinition[];
}
export interface CaptureInput {
  type: SourceType;
  title: string;
  text: string;
  origin: string;
  ownerId: string;
  sensitivity?: SourceItem["sensitivity"];
  dealId?: string;
}
export interface ReviewInput {
  suggestionId: string;
  decision: "accept" | "reject";
  actorId: string;
  confirmed?: boolean;
  payload?: SuggestionPayload;
}
export const emptyEvidence = (): EvidenceStore => ({
  sources: [],
  spans: [],
  assertions: [],
  links: [],
  mentions: [],
  suggestions: [],
  audit: [],
  dashboards: [],
});

import type {
  CaptureInput,
  EvidenceStore,
  PersonMention,
  ReviewInput,
  SourceDealLink,
  SourceItem,
  Suggestion,
} from "../evidence";
import { PIPELINE_STAGES } from "../evidence";
import type { Snapshot } from "../types";

export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
/** SHA-256 of the exact UTF-8 input: never normalise or alter original evidence. */
export async function contentHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
export const findDuplicate = (sources: SourceItem[], hash: string) =>
  sources.find((s) => s.contentHash === hash && !s.duplicateOf);
export function resolvePerson(
  name: string,
  db: Snapshot,
): Pick<PersonMention, "contactId" | "candidates" | "state"> {
  const normal = name.trim().toLowerCase();
  const candidates = db.contacts
    .filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase() === normal ||
        c.firstName.toLowerCase() === normal,
    )
    .map((c) => c.id);
  return {
    contactId: candidates.length === 1 ? (candidates[0] ?? null) : null,
    candidates,
    state:
      candidates.length === 1 ? "resolved" : candidates.length > 1 ? "ambiguous" : "unresolved",
  };
}
export function suggestDealLinks(
  source: SourceItem,
  db: Snapshot,
  explicit?: string,
): SourceDealLink[] {
  if (explicit && !db.opportunities.some((o) => o.id === explicit))
    throw new Error("Deal not found");
  const lower = source.originalText.toLowerCase();
  const links: SourceDealLink[] = [];
  for (const deal of db.opportunities) {
    const exact = lower.includes(deal.name.toLowerCase());
    const company = db.companies.find((c) => c.id === deal.companyId);
    const account = company && lower.includes(company.name.toLowerCase());
    if (deal.id !== explicit && !exact && !account) continue;
    links.push({
      id: newId("link"),
      sourceItemId: source.id,
      dealId: deal.id,
      confidence: deal.id === explicit ? 1 : exact ? 0.98 : 0.65,
      linkedBy: deal.id === explicit ? "explicit" : "suggested",
      state: deal.id === explicit ? "accepted" : "pending",
    });
  }
  return links;
}
export const requiresConfirmation = (s: Suggestion) =>
  s.kind === "stage_change" || (s.kind === "update_field" && s.payload.field === "value");
export const bulkEligible = (s: Suggestion, store: EvidenceStore) =>
  s.state === "pending" &&
  s.confidence >= 0.9 &&
  !requiresConfirmation(s) &&
  store.links.some(
    (l) =>
      l.sourceItemId === s.sourceItemId && l.dealId === s.payload.dealId && l.state === "accepted",
  ) &&
  !store.mentions.some((m) => m.sourceItemId === s.sourceItemId && m.state !== "resolved");
export function makeSource(input: CaptureInput, hash: string, at: string): SourceItem {
  return {
    id: newId("source"),
    type: input.type,
    title: input.title.trim() || "Untitled evidence",
    originalText: input.text,
    origin: input.origin,
    contentHash: hash,
    receivedAt: at,
    ownerId: input.ownerId,
    sensitivity: input.sensitivity ?? "standard",
    status: "new",
    reviewStatus: "needs_review",
    topics: [],
    duplicateOf: null,
    error: null,
    stages: PIPELINE_STAGES.map((stage) => ({
      stage,
      status: stage === "capture" ? "complete" : "pending",
      timestamp: stage === "capture" ? at : null,
    })),
  };
}
export function reviewSuggestion(
  db: Snapshot,
  input: ReviewInput,
  at = new Date().toISOString(),
): void {
  const s = db.evidence.suggestions.find((s) => s.id === input.suggestionId);
  if (!s) throw new Error("Suggestion not found");
  if (s.state !== "pending") throw new Error("This suggestion has already been reviewed");
  if (!db.settings.owners.some((o) => o.id === input.actorId))
    throw new Error("Choose a reviewer from Settings");
  const payload = input.payload ?? s.payload;
  if (input.decision === "accept") {
    if (requiresConfirmation({ ...s, payload }) && !input.confirmed)
      throw new Error("Confirm this stage or value change explicitly");
    const deal = db.opportunities.find((o) => o.id === payload.dealId);
    if (!deal) throw new Error("Choose an existing deal");
    if (
      !db.evidence.links.some(
        (l) => l.sourceItemId === s.sourceItemId && l.dealId === deal.id && l.state === "accepted",
      )
    )
      throw new Error("Approve the deal link first");
    if (s.kind === "create_task") {
      if (!payload.ownerId || !db.settings.owners.some((o) => o.id === payload.ownerId))
        throw new Error("Task owner must be an internal team member");
      if (
        !payload.subject?.trim() ||
        !payload.dueDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.dueDate) ||
        Number.isNaN(new Date(payload.dueDate).getTime())
      )
        throw new Error("Enter a task subject and valid due date");
      const activityId = newId("ac");
      db.activities.push({
        id: activityId,
        type: "task",
        subject: payload.subject.trim(),
        notes: s.rationale,
        dueDate: payload.dueDate,
        completed: false,
        completedAt: null,
        opportunityId: deal.id,
        companyId: deal.companyId,
        contactId: null,
        ownerId: payload.ownerId,
        createdAt: at,
        sourceItemId: s.sourceItemId,
        suggestionId: s.id,
      });
      s.activityId = activityId;
    } else if (s.kind === "add_stakeholder") {
      if (!payload.contactId || !db.contacts.some((c) => c.id === payload.contactId))
        throw new Error("Resolve this person to an existing contact first");
      deal.contactIds = Array.from(new Set([...deal.contactIds, payload.contactId]));
    } else if (s.kind === "stage_change") {
      const allowed = ["qualify", "develop", "propose", "negotiate", "won", "lost"];
      if (!payload.stage || !allowed.includes(payload.stage))
        throw new Error("Choose a valid stage");
      deal.stage = payload.stage;
      deal.closedAt = payload.stage === "won" || payload.stage === "lost" ? at : null;
      deal.closeReason = deal.closedAt ? s.rationale : null;
    } else if (payload.field === "value") {
      const value = Number(payload.value);
      if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000)
        throw new Error("Enter a valid deal value");
      deal.value = value;
    } else if (payload.field === "expectedClose") {
      if (
        typeof payload.value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.value) ||
        Number.isNaN(new Date(payload.value).getTime())
      )
        throw new Error("Enter a valid close date");
      deal.expectedClose = payload.value;
    } else throw new Error("Unsupported field");
  }
  s.payload = payload;
  s.state = input.decision === "reject" ? "rejected" : input.payload ? "edited" : "accepted";
  db.evidence.audit.push({
    id: newId("audit"),
    sourceItemId: s.sourceItemId,
    suggestionId: s.id,
    actorId: input.actorId,
    action: `${s.state}: ${s.kind.replaceAll("_", " ")}`,
    at,
  });
}

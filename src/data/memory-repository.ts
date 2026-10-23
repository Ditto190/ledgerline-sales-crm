import {
  activitySchema,
  companySchema,
  contactSchema,
  isOpenStage,
  opportunitySchema,
  type Snapshot,
} from "@/domain/types";
import type { SalesRepository } from "./repository";
import { createSeed } from "./seed";
import {
  emptyEvidence,
  type CaptureInput,
  type ReviewInput,
  type SourceItem,
} from "@/domain/evidence";
import {
  bulkEligible,
  contentHash,
  findDuplicate,
  makeSource,
  newId,
  reviewSuggestion,
} from "@/domain/services/evidence";
import { createIngestionPipeline, removeExtraction, seedEvidence } from "@/services/ingestion";
import { validateDashboard, type DashboardDefinition } from "@/dashboard/schema";

const STORAGE_KEY = "crm-demo-db-v1";

const uid = (p: string) => `${p}_${crypto.randomUUID().slice(0, 8)}`;
const now = () => new Date().toISOString();

/**
 * DEMO implementation: holds everything in memory and mirrors it to the
 * browser's localStorage so edits survive a reload. Not multi-user.
 */
export class InMemorySalesRepository implements SalesRepository {
  private db: Snapshot;
  private ready: Promise<void>;

  constructor(private storage: Storage | null = null) {
    this.db = this.load() ?? createSeed(new Date());
    const needsSeed = !this.db.evidence || this.db.evidence.sources.length === 0;
    this.db.evidence ??= emptyEvidence();
    this.ready = needsSeed ? seedEvidence(this.db).then(() => this.persist()) : Promise.resolve();
    this.persist();
  }

  private load(): Snapshot | null {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Snapshot) : null;
    } catch {
      return null;
    }
  }
  private persist() {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.db));
  }
  private commit() {
    this.persist();
    return Promise.resolve();
  }

  async getSnapshot() {
    await this.ready;
    return structuredClone(this.db);
  }

  private actor(id: string) {
    if (!this.db.settings.owners.some((o) => o.id === id))
      throw new Error("Choose a team member from Settings");
  }
  private source(id: string) {
    const source = this.db.evidence.sources.find((s) => s.id === id);
    if (!source) throw new Error("Source not found");
    return source;
  }
  async captureSource(input: CaptureInput) {
    await this.ready;
    this.actor(input.ownerId);
    if (input.dealId && !this.db.opportunities.some((o) => o.id === input.dealId))
      throw new Error("Deal not found");
    const hash = await contentHash(input.text);
    const source = makeSource(input, hash, now());
    const duplicate = findDuplicate(this.db.evidence.sources, hash);
    this.db.evidence.sources.push(source);
    if (duplicate) {
      source.duplicateOf = duplicate.id;
      source.status = "ready";
      source.reviewStatus = "filed";
      if (input.dealId)
        this.db.evidence.links.push({
          id: newId("link"),
          sourceItemId: source.id,
          dealId: input.dealId,
          confidence: 1,
          linkedBy: "explicit",
          state: "accepted",
        });
      source.stages.forEach((s) => {
        s.status = "complete";
        s.timestamp = now();
      });
    } else {
      this.persist();
      await createIngestionPipeline().process(source, this.db, input.dealId);
    }
    await this.commit();
    return structuredClone(source);
  }
  async retrySource(id: string) {
    await this.ready;
    const source = this.source(id);
    if (source.status !== "failed") throw new Error("Only failed items can be retried");
    const explicit = this.db.evidence.links.find(
      (l) => l.sourceItemId === id && l.linkedBy === "explicit",
    )?.dealId;
    removeExtraction(this.db, id);
    source.stages.forEach((s) => {
      if (s.stage !== "capture") {
        s.status = "pending";
        s.timestamp = null;
        delete s.error;
      }
    });
    await createIngestionPipeline().process(source, this.db, explicit);
    await this.commit();
  }
  async reviewSuggestion(input: ReviewInput) {
    await this.ready;
    reviewSuggestion(this.db, input);
    await this.commit();
  }
  async bulkAccept(sourceId: string, actorId: string) {
    await this.ready;
    this.actor(actorId);
    const suggestions = this.db.evidence.suggestions.filter(
      (s) => s.sourceItemId === sourceId && bulkEligible(s, this.db.evidence),
    );
    const next = structuredClone(this.db);
    for (const s of suggestions)
      reviewSuggestion(next, { suggestionId: s.id, decision: "accept", actorId });
    this.db = next;
    await this.commit();
    return suggestions.length;
  }
  async setSourceLink(sourceId: string, dealId: string, accepted: boolean, actorId: string) {
    await this.ready;
    this.actor(actorId);
    this.source(sourceId);
    if (!this.db.opportunities.some((o) => o.id === dealId)) throw new Error("Deal not found");
    const existing = this.db.evidence.links.find(
      (l) => l.sourceItemId === sourceId && l.dealId === dealId,
    );
    if (existing) existing.state = accepted ? "accepted" : "rejected";
    else if (accepted)
      this.db.evidence.links.push({
        id: newId("link"),
        sourceItemId: sourceId,
        dealId,
        confidence: 1,
        linkedBy: "manual",
        state: "accepted",
      });
    if (
      accepted &&
      !this.db.evidence.suggestions.some(
        (s) => s.sourceItemId === sourceId && s.payload.dealId === dealId,
      )
    ) {
      const temp = structuredClone(this.db);
      temp.evidence = emptyEvidence();
      const source = structuredClone(this.source(sourceId));
      await createIngestionPipeline().process(source, temp, dealId);
      this.db.evidence.spans.push(...temp.evidence.spans);
      this.db.evidence.suggestions.push(
        ...temp.evidence.suggestions.filter((s) => s.payload.dealId === dealId),
      );
    }
    this.db.evidence.audit.push({
      id: newId("audit"),
      sourceItemId: sourceId,
      actorId,
      action: `${accepted ? "Linked" : "Unlinked"} deal`,
      at: now(),
    });
    await this.commit();
  }
  async resolveMention(id: string, contactId: string, actorId: string) {
    await this.ready;
    this.actor(actorId);
    const mention = this.db.evidence.mentions.find((m) => m.id === id);
    if (!mention || !this.db.contacts.some((c) => c.id === contactId))
      throw new Error("Choose an existing contact");
    mention.contactId = contactId;
    mention.state = "resolved";
    for (const link of this.db.evidence.links.filter(
      (l) => l.sourceItemId === mention.sourceItemId && l.state === "accepted",
    )) {
      const deal = this.db.opportunities.find((o) => o.id === link.dealId);
      if (
        deal &&
        !deal.contactIds.includes(contactId) &&
        !this.db.evidence.suggestions.some(
          (s) =>
            s.sourceItemId === mention.sourceItemId &&
            s.kind === "add_stakeholder" &&
            s.payload.dealId === deal.id &&
            s.payload.contactId === contactId,
        )
      )
        this.db.evidence.suggestions.push({
          id: newId("suggestion"),
          sourceItemId: mention.sourceItemId,
          kind: "add_stakeholder",
          payload: { dealId: deal.id, contactId },
          rationale: `${mention.name} was manually resolved to a contact.`,
          evidenceSpanId: mention.evidenceSpanId,
          confidence: 1,
          state: "pending",
        });
    }
    this.db.evidence.audit.push({
      id: newId("audit"),
      sourceItemId: mention.sourceItemId,
      actorId,
      action: `Resolved ${mention.name}`,
      at: now(),
    });
    await this.commit();
  }
  async updateSourceLabels(id: string, type: SourceItem["type"], topics: string[]) {
    await this.ready;
    const source = this.source(id);
    source.type = type;
    source.topics = [...new Set(topics.map((t) => t.trim()).filter(Boolean))];
    await this.commit();
  }
  async reviewAssertion(id: string, state: "accepted" | "rejected", actorId: string) {
    await this.ready;
    this.actor(actorId);
    const assertion = this.db.evidence.assertions.find((a) => a.id === id);
    if (!assertion) throw new Error("Assertion not found");
    assertion.state = state;
    this.db.evidence.audit.push({
      id: newId("audit"),
      sourceItemId: assertion.sourceItemId,
      actorId,
      action: `${state} assertion`,
      at: now(),
    });
    await this.commit();
  }
  async fileSource(id: string, actorId: string) {
    await this.ready;
    this.actor(actorId);
    const source = this.source(id);
    if (source.status !== "ready") throw new Error("Finish processing before filing");
    if (
      this.db.evidence.suggestions.some((s) => s.sourceItemId === id && s.state === "pending") ||
      this.db.evidence.links.some((l) => l.sourceItemId === id && l.state === "pending") ||
      this.db.evidence.mentions.some((m) => m.sourceItemId === id && m.state !== "resolved") ||
      this.db.evidence.assertions.some((a) => a.sourceItemId === id && a.state === "pending")
    )
      throw new Error("Review suggestions, assertions, people and deal links before filing");
    source.reviewStatus = "filed";
    source.stages
      .filter((s) => s.stage === "review" || s.stage === "commit")
      .forEach((s) => {
        s.status = "complete";
        s.timestamp = now();
      });
    this.db.evidence.audit.push({
      id: newId("audit"),
      sourceItemId: id,
      actorId,
      action: "Filed evidence",
      at: now(),
    });
    await this.commit();
  }
  async saveDashboard(definition: DashboardDefinition) {
    await this.ready;
    const valid = validateDashboard(definition);
    this.db.evidence.dashboards = [
      ...this.db.evidence.dashboards.filter((d) => d.id !== valid.id),
      valid,
    ];
    await this.commit();
  }

  async saveCompany(input: Parameters<SalesRepository["saveCompany"]>[0], id?: string) {
    const data = companySchema.parse(input);
    const existing = id ? this.db.companies.find((c) => c.id === id) : undefined;
    const rec = existing
      ? Object.assign(existing, data)
      : { ...data, id: uid("co"), createdAt: now() };
    if (!existing) this.db.companies.push(rec);
    await this.commit();
    return structuredClone(rec);
  }

  async deleteCompany(id: string) {
    if (this.db.opportunities.some((o) => o.companyId === id))
      throw new Error("This company has opportunities. Delete or reassign them first.");
    this.db.companies = this.db.companies.filter((c) => c.id !== id);
    this.db.contacts.forEach((c) => c.companyId === id && (c.companyId = null));
    this.db.activities.forEach((a) => a.companyId === id && (a.companyId = null));
    await this.commit();
  }

  async saveContact(input: Parameters<SalesRepository["saveContact"]>[0], id?: string) {
    const data = contactSchema.parse(input);
    const existing = id ? this.db.contacts.find((c) => c.id === id) : undefined;
    const rec = existing
      ? Object.assign(existing, data)
      : { ...data, id: uid("ct"), createdAt: now() };
    if (!existing) this.db.contacts.push(rec);
    await this.commit();
    return structuredClone(rec);
  }

  async deleteContact(id: string) {
    this.db.contacts = this.db.contacts.filter((c) => c.id !== id);
    this.db.opportunities.forEach((o) => (o.contactIds = o.contactIds.filter((c) => c !== id)));
    this.db.activities.forEach((a) => a.contactId === id && (a.contactId = null));
    await this.commit();
  }

  async saveOpportunity(input: Parameters<SalesRepository["saveOpportunity"]>[0], id?: string) {
    const data = opportunitySchema.parse(input);
    const existing = id ? this.db.opportunities.find((o) => o.id === id) : undefined;
    const closedAt = isOpenStage(data.stage)
      ? null
      : existing && !isOpenStage(existing.stage)
        ? existing.closedAt
        : now();
    const rec = existing
      ? Object.assign(existing, data, { closedAt })
      : { ...data, id: uid("op"), createdAt: now(), closedAt };
    if (!existing) this.db.opportunities.push(rec);
    await this.commit();
    return structuredClone(rec);
  }

  async moveOpportunity(
    id: string,
    stage: Parameters<SalesRepository["moveOpportunity"]>[1],
    closeReason?: string | null,
  ) {
    const o = this.db.opportunities.find((x) => x.id === id);
    if (!o) throw new Error("Opportunity not found");
    const wasOpen = isOpenStage(o.stage);
    o.stage = stage;
    if (isOpenStage(stage)) {
      o.closedAt = null;
      o.closeReason = null;
    } else {
      if (wasOpen || !o.closedAt) o.closedAt = now();
      o.closeReason = closeReason ?? o.closeReason;
    }
    await this.commit();
    return structuredClone(o);
  }

  async linkContact(opportunityId: string, contactId: string, linked: boolean) {
    const o = this.db.opportunities.find((x) => x.id === opportunityId);
    if (!o) throw new Error("Opportunity not found");
    o.contactIds = linked
      ? Array.from(new Set([...o.contactIds, contactId]))
      : o.contactIds.filter((c) => c !== contactId);
    await this.commit();
  }

  async deleteOpportunity(id: string) {
    this.db.opportunities = this.db.opportunities.filter((o) => o.id !== id);
    this.db.activities.forEach((a) => a.opportunityId === id && (a.opportunityId = null));
    await this.commit();
  }

  async saveActivity(input: Parameters<SalesRepository["saveActivity"]>[0], id?: string) {
    const data = activitySchema.parse(input);
    const existing = id ? this.db.activities.find((a) => a.id === id) : undefined;
    const completedAt = data.completed ? (existing?.completedAt ?? now()) : null;
    const rec = existing
      ? Object.assign(existing, data, { completedAt })
      : { ...data, id: uid("ac"), createdAt: now(), completedAt };
    if (!existing) this.db.activities.push(rec);
    await this.commit();
    return structuredClone(rec);
  }

  async setActivityCompleted(id: string, completed: boolean) {
    const a = this.db.activities.find((x) => x.id === id);
    if (!a) throw new Error("Activity not found");
    a.completed = completed;
    a.completedAt = completed ? now() : null;
    await this.commit();
  }

  async deleteActivity(id: string) {
    this.db.activities = this.db.activities.filter((a) => a.id !== id);
    await this.commit();
  }

  async updateSettings(settings: Snapshot["settings"]) {
    this.db.settings = structuredClone(settings);
    await this.commit();
    return structuredClone(this.db.settings);
  }

  async exportJson() {
    await this.ready;
    return JSON.stringify(this.db, null, 2);
  }

  async importJson(json: string) {
    const parsed = JSON.parse(json) as Snapshot;
    for (const k of ["companies", "contacts", "opportunities", "activities"] as const)
      if (!Array.isArray(parsed[k])) throw new Error(`Invalid file: missing ${k}`);
    if (!parsed.settings?.owners) throw new Error("Invalid file: missing settings");
    parsed.evidence ??= emptyEvidence();
    if (!Array.isArray(parsed.evidence.sources) || !Array.isArray(parsed.evidence.suggestions))
      throw new Error("Invalid evidence data");
    parsed.evidence.dashboards = (parsed.evidence.dashboards ?? []).map(validateDashboard);
    this.db = parsed;
    await this.commit();
  }

  async resetDemoData() {
    this.db = createSeed(new Date());
    this.ready = seedEvidence(this.db);
    await this.ready;
    await this.commit();
  }
}

import {
  emptyEvidence,
  type Assertion,
  type EvidenceSpan,
  type PersonMention,
  type SourceItem,
  type Suggestion,
} from "@/domain/evidence";
import type { Snapshot } from "@/domain/types";
import { newId, resolvePerson, suggestDealLinks } from "@/domain/services/evidence";

export interface Extraction {
  type: SourceItem["type"];
  topics: string[];
  spans: EvidenceSpan[];
  assertions: Assertion[];
  mentions: PersonMention[];
}
export interface Extractor {
  extract(source: SourceItem, db: Snapshot): Extraction | Promise<Extraction>;
}
export interface IngestionPipeline {
  process(source: SourceItem, db: Snapshot, explicitDealId?: string): Promise<void>;
}
export class MockExtractor implements Extractor {
  extract(source: SourceItem, db: Snapshot): Extraction {
    const spans: EvidenceSpan[] = [];
    const assertions: Assertion[] = [];
    const mentions: PersonMention[] = [];
    const topics = [
      "budget",
      "pricing",
      "proposal",
      "security",
      "timeline",
      "contract",
      "procurement",
    ].filter((t) => source.originalText.toLowerCase().includes(t));
    const type = /^(from|subject):/im.test(source.originalText)
      ? "email"
      : /WEBVTT|\d{2}:\d{2}:\d{2}|meeting transcript/i.test(source.originalText)
        ? "transcript"
        : source.type;
    const spanFor = (start: number, end: number) => {
      const id = newId("span");
      const text = source.originalText.slice(start, end);
      const speaker = text.match(/^([A-Z][\w' -]{1,40}):/)?.[1];
      const timestamp = text.match(/\d{2}:\d{2}:\d{2}(?:\.\d+)?/)?.[0];
      spans.push({
        id,
        sourceItemId: source.id,
        start,
        end,
        ...(speaker ? { speaker } : {}),
        ...(timestamp ? { timestamp } : {}),
      });
      return id;
    };
    for (const match of source.originalText.matchAll(/[^\n.!?]+[.!?]?/g)) {
      const text = match[0].trim();
      if (!text) continue;
      const start = (match.index ?? 0) + match[0].indexOf(text);
      const end = start + text.length;
      const kind = /risk|delay|concern|blocked|competitor/i.test(text)
        ? "risk"
        : /will |agreed|send |follow.up|prepare |schedule /i.test(text)
          ? "commitment"
          : /\d{4}-\d{2}-\d{2}/.test(text)
            ? "date"
            : /budget|interest|approved|ready|value/i.test(text)
              ? "signal"
              : null;
      if (kind)
        assertions.push({
          id: newId("assert"),
          sourceItemId: source.id,
          kind,
          text,
          confidence: kind === "commitment" ? 0.94 : 0.82,
          evidenceSpanId: spanFor(start, end),
          state: "pending",
        });
    }
    const names = new Set<string>();
    for (const c of db.contacts) {
      const full = `${c.firstName} ${c.lastName}`;
      const foundFull = source.originalText.toLowerCase().includes(full.toLowerCase());
      const escaped = c.firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (foundFull) names.add(full);
      else if (new RegExp(`\\b${escaped}\\b`, "i").test(source.originalText))
        names.add(c.firstName);
    }
    for (const match of source.originalText.matchAll(
      /(?:Attendee|Contact|Speaker):\s*([A-Z][a-z'-]+(?: [A-Z][a-z'-]+)?)/g,
    ))
      if (match[1]) names.add(match[1]);
    // Do not emit a redundant first-name ambiguity when the full name exists.
    for (const name of [...names])
      if (!name.includes(" ") && [...names].some((n) => n.startsWith(`${name} `)))
        names.delete(name);
    for (const name of names) {
      const start = source.originalText.toLowerCase().indexOf(name.toLowerCase());
      mentions.push({
        id: newId("person"),
        sourceItemId: source.id,
        name,
        ...resolvePerson(name, db),
        evidenceSpanId: spanFor(start, start + name.length),
      });
    }
    return { type, topics, spans, assertions, mentions };
  }
}
export class LocalIngestionPipeline implements IngestionPipeline {
  constructor(private extractor: Extractor = new MockExtractor()) {}
  async process(source: SourceItem, db: Snapshot, explicitDealId?: string) {
    source.status = "processing";
    source.error = null;
    if (
      explicitDealId &&
      !db.evidence.links.some((l) => l.sourceItemId === source.id && l.dealId === explicitDealId)
    ) {
      if (!db.opportunities.some((o) => o.id === explicitDealId)) throw new Error("Deal not found");
      db.evidence.links.push({
        id: newId("link"),
        sourceItemId: source.id,
        dealId: explicitDealId,
        confidence: 1,
        linkedBy: "explicit",
        state: "accepted",
      });
    }
    let extraction: Extraction | undefined;
    const step = async (
      stage: SourceItem["stages"][number]["stage"],
      action: () => void | Promise<void>,
    ) => {
      const record = source.stages.find((s) => s.stage === stage);
      if (!record) return;
      record.status = "running";
      record.timestamp = new Date().toISOString();
      delete record.error;
      try {
        await action();
        record.status = "complete";
      } catch (error) {
        record.status = "failed";
        record.error = error instanceof Error ? error.message : "Processing failed";
        throw error;
      }
    };
    try {
      await step("parse", () => {
        if (!source.originalText.trim())
          throw new Error("No readable text. Add a non-empty file or paste text.");
        if (source.originalText.includes("\u0000"))
          throw new Error(
            "Text contains unsupported binary characters. Export as UTF-8 and retry.",
          );
      });
      await step("extract", async () => {
        extraction = await this.extractor.extract(source, db);
      });
      const out = extraction;
      if (!out) throw new Error("Extraction returned no result");
      db.evidence.spans.push(...out.spans);
      db.evidence.assertions.push(...out.assertions);
      await step("resolve_people", () => {
        db.evidence.mentions.push(...out.mentions);
      });
      await step("classify_link", () => {
        source.type = out.type;
        source.topics = out.topics;
        db.evidence.links.push(
          ...suggestDealLinks(source, db, explicitDealId).filter(
            (l) =>
              !db.evidence.links.some(
                (existing) => existing.sourceItemId === source.id && existing.dealId === l.dealId,
              ),
          ),
        );
      });
      await step("propose", () => {
        const links = db.evidence.links.filter(
          (l) => l.sourceItemId === source.id && l.state !== "rejected",
        );
        for (const link of links) {
          const deal = db.opportunities.find((o) => o.id === link.dealId);
          if (!deal) continue;
          const add = (s: Omit<Suggestion, "id" | "sourceItemId" | "state">) =>
            db.evidence.suggestions.push({
              ...s,
              id: newId("suggestion"),
              sourceItemId: source.id,
              state: "pending",
            });
          for (const a of out.assertions) {
            if (a.kind === "commitment") {
              const date =
                a.text.match(/\d{4}-\d{2}-\d{2}/)?.[0] ??
                new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
              add({
                kind: "create_task",
                payload: {
                  dealId: deal.id,
                  subject: a.text.slice(0, 160),
                  dueDate: date,
                  ownerId: deal.ownerId,
                },
                rationale:
                  "A commitment or follow-up was mentioned; review the due date and internal owner.",
                evidenceSpanId: a.evidenceSpanId,
                confidence: a.confidence,
              });
            }
            const value = a.text.match(
              /(?:value|budget)\s*(?:is|of|:|=)?\s*(?:AUD\s*)?\$([\d,]+(?:\.\d{1,2})?)/i,
            )?.[1];
            if (value)
              add({
                kind: "update_field",
                payload: {
                  dealId: deal.id,
                  field: "value",
                  value: Number(value.replaceAll(",", "")),
                },
                rationale: "A proposed deal value was mentioned.",
                evidenceSpanId: a.evidenceSpanId,
                confidence: 0.88,
              });
            const stage = /ready to (?:negotiate|negotiate)|move to negotiate/i.test(a.text)
              ? "negotiate"
              : /contract signed|deal won/i.test(a.text)
                ? "won"
                : undefined;
            if (stage)
              add({
                kind: "stage_change",
                payload: { dealId: deal.id, stage },
                rationale: "A possible stage change was mentioned; explicit confirmation required.",
                evidenceSpanId: a.evidenceSpanId,
                confidence: 0.85,
              });
            const date = a.text.match(/(?:close|closing).*?(\d{4}-\d{2}-\d{2})/i)?.[1];
            if (date)
              add({
                kind: "update_field",
                payload: { dealId: deal.id, field: "expectedClose", value: date },
                rationale: "A possible expected close date was mentioned.",
                evidenceSpanId: a.evidenceSpanId,
                confidence: 0.9,
              });
          }
          for (const m of out.mentions.filter(
            (m) => m.state === "resolved" && m.contactId && !deal.contactIds.includes(m.contactId),
          ))
            add({
              kind: "add_stakeholder",
              payload: { dealId: deal.id, contactId: m.contactId ?? undefined },
              rationale: `${m.name} was mentioned as a stakeholder, not a task owner.`,
              evidenceSpanId: m.evidenceSpanId,
              confidence: 0.95,
            });
        }
      });
      source.status = "ready";
      const review = source.stages.find((s) => s.stage === "review");
      if (review) {
        review.status = "running";
        review.timestamp = new Date().toISOString();
      }
    } catch (error) {
      source.status = "failed";
      source.error = error instanceof Error ? error.message : "Processing failed";
    }
  }
}
/** Configuration seam: replace the extractor without coupling domain rules to an AI runtime. */
export const ingestionConfig: { extractor: Extractor } = { extractor: new MockExtractor() };
export const createIngestionPipeline = (): IngestionPipeline =>
  new LocalIngestionPipeline(ingestionConfig.extractor);
export function removeExtraction(db: Snapshot, id: string) {
  db.evidence.spans = db.evidence.spans.filter((x) => x.sourceItemId !== id);
  db.evidence.assertions = db.evidence.assertions.filter((x) => x.sourceItemId !== id);
  db.evidence.mentions = db.evidence.mentions.filter((x) => x.sourceItemId !== id);
  db.evidence.suggestions = db.evidence.suggestions.filter((x) => x.sourceItemId !== id);
  db.evidence.links = db.evidence.links.filter((x) => x.sourceItemId !== id);
}
export async function seedEvidence(db: Snapshot) {
  db.evidence = emptyEvidence();
  const deals = db.opportunities.filter((o) => o.stage !== "won" && o.stage !== "lost").slice(0, 4);
  if (!deals.length || !db.settings.owners[0]) return;
  const duplicateName =
    db.contacts.find((c) => db.contacts.filter((x) => x.firstName === c.firstName).length > 1)
      ?.firstName ?? "Alex";
  const templates = [
    [
      "transcript",
      "Commercial review",
      "Meeting transcript\n00:01:12 Contact: PERSON\nDEAL\nWe agreed to send a revised proposal by DATE. Budget is $120,000. There is a procurement delay.",
    ],
    [
      "transcript",
      "Security workshop",
      "WEBVTT\n00:00:02.000 --> 00:00:15.000\nContact: PERSON\nDEAL\nWe will schedule the security review by DATE.",
    ],
    [
      "email",
      "Revised quote request",
      "From: PERSON\nSubject: Revised quote\nDEAL\nPlease send the pricing proposal by DATE. Budget is $85,000.",
    ],
    [
      "email",
      "Procurement update",
      "From: PERSON\nSubject: Procurement\nDEAL\nThe team is ready to negotiate. We will prepare the contract by DATE.",
    ],
    [
      "email",
      "Timing concern",
      "From: PERSON\nSubject: Timeline\nDEAL\nThere is a risk of a timeline delay. Expected close is DATE.",
    ],
    [
      "note",
      "Discovery call",
      "Contact: PERSON\nDEAL\nThe client has interest in the proposal. We agreed to follow up by DATE.",
    ],
    ["note", "Budget call", "Contact: PERSON\nDEAL\nBudget is $64,000. Send the quote by DATE."],
    [
      "note",
      "Unresolved attendee",
      `Contact: ${duplicateName}\nDEAL\nWe will schedule a meeting by DATE. Contact: Alex Unknown`,
    ],
    ["note", "Discovery call — duplicate", ""],
    ["transcript", "Unreadable transcript", "\u0000"],
  ] as const;
  const { contentHash, makeSource } = await import("@/domain/services/evidence");
  for (const [i, [type, title, template]] of templates.entries()) {
    const deal = deals[i % deals.length];
    if (!deal) continue;
    const contact = db.contacts.find((c) => c.companyId === deal.companyId);
    const date = new Date(Date.now() + (i + 1) * 86400000).toISOString().slice(0, 10);
    const text =
      i === 8
        ? (db.evidence.sources[5]?.originalText ?? "")
        : template
            .replaceAll("DEAL", deal.name)
            .replaceAll(
              "PERSON",
              contact ? `${contact.firstName} ${contact.lastName}` : "Alex Unknown",
            )
            .replaceAll("DATE", date);
    const source = makeSource(
      { type, title, text, origin: "Demo fixture", ownerId: deal.ownerId },
      await contentHash(text),
      new Date(Date.now() - i * 3600000).toISOString(),
    );
    db.evidence.sources.push(source);
    if (i === 8) {
      source.duplicateOf = db.evidence.sources[5]?.id ?? null;
      source.status = "ready";
      source.reviewStatus = "filed";
      continue;
    }
    await createIngestionPipeline().process(source, db, deal.id);
  }
}

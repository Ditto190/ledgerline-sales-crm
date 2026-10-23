import { describe, expect, it, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import { createSeed } from "@/data/seed";
import { emptyEvidence, type Suggestion } from "@/domain/evidence";
import {
  bulkEligible,
  contentHash,
  findDuplicate,
  makeSource,
  resolvePerson,
  reviewSuggestion,
  suggestDealLinks,
} from "./evidence";
import { LocalIngestionPipeline, MockExtractor } from "@/services/ingestion";
import { InMemorySalesRepository } from "@/data/memory-repository";

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
});
const fixture = () => {
  const db = createSeed(new Date("2026-10-23T01:00:00Z"));
  db.evidence = emptyEvidence();
  return db;
};
describe("Local evidence rules", () => {
  it("hashes exact bytes and detects exact duplicates only", async () => {
    expect(await contentHash("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    const hash = await contentHash("abc");
    const source = makeSource(
      { type: "note", title: "test", text: "abc", origin: "paste", ownerId: "u_ava" },
      hash,
      "2026-10-23",
    );
    expect(findDuplicate([source], hash)?.id).toBe(source.id);
    expect(findDuplicate([source], await contentHash("abc "))).toBeUndefined();
  });
  it("never guesses ambiguous names", () => {
    const db = fixture();
    const a = db.contacts[0];
    const b = db.contacts[1];
    if (!a || !b) throw new Error("Missing fixtures");
    a.firstName = "Alex";
    a.lastName = "King";
    b.firstName = "Alex";
    b.lastName = "Reed";
    expect(resolvePerson("Alex", db)).toMatchObject({ state: "ambiguous", contactId: null });
    expect(resolvePerson("Alex King", db)).toMatchObject({ state: "resolved", contactId: a.id });
    expect(resolvePerson("Unknown Person", db)).toMatchObject({
      state: "unresolved",
      contactId: null,
    });
  });
  it("automatically links only explicitly selected deals", () => {
    const db = fixture();
    const o = db.opportunities[0];
    if (!o) throw new Error("Missing deal");
    const source = makeSource(
      { type: "note", title: "test", text: o.name, origin: "paste", ownerId: o.ownerId },
      "hash",
      "2026-10-23",
    );
    expect(suggestDealLinks(source, db).find((l) => l.dealId === o.id)).toMatchObject({
      state: "pending",
      linkedBy: "suggested",
    });
    expect(suggestDealLinks(source, db, o.id).find((l) => l.dealId === o.id)).toMatchObject({
      state: "accepted",
      linkedBy: "explicit",
      confidence: 1,
    });
  });
  it("creates no activities or pipeline changes while extracting", async () => {
    const db = fixture();
    const o = db.opportunities[0];
    if (!o) throw new Error("Missing deal");
    const before = structuredClone(db.opportunities);
    const count = db.activities.length;
    const source = makeSource(
      {
        type: "note",
        title: "test",
        text: `${o.name}\nWe will send the quote by 2026-11-01. Budget is $200,000. The team is ready to negotiate.`,
        origin: "paste",
        ownerId: o.ownerId,
      },
      "hash",
      "2026-10-23",
    );
    db.evidence.sources.push(source);
    await new LocalIngestionPipeline(new MockExtractor()).process(source, db, o.id);
    expect(db.activities).toHaveLength(count);
    expect(db.opportunities).toEqual(before);
    expect(db.evidence.suggestions.some((s) => s.kind === "create_task")).toBe(true);
    expect(db.evidence.suggestions.some((s) => s.kind === "stage_change")).toBe(true);
  });
  it("retains explicit links even when parsing fails", async () => {
    const db = fixture();
    const o = db.opportunities[0];
    if (!o) throw new Error("Missing deal");
    const source = makeSource(
      { type: "transcript", title: "broken", text: "\u0000", origin: "file", ownerId: o.ownerId },
      "hash",
      "2026-10-23",
    );
    db.evidence.sources.push(source);
    await new LocalIngestionPipeline().process(source, db, o.id);
    expect(source.status).toBe("failed");
    expect(db.evidence.links).toContainEqual(
      expect.objectContaining({
        sourceItemId: source.id,
        dealId: o.id,
        state: "accepted",
        linkedBy: "explicit",
      }),
    );
  });
  it("requires confirmation for stage changes", () => {
    const db = fixture();
    const o = db.opportunities[0];
    if (!o) throw new Error("Missing deal");
    const s: Suggestion = {
      id: "s",
      sourceItemId: "source",
      kind: "stage_change",
      payload: { dealId: o.id, stage: "won" },
      rationale: "test",
      evidenceSpanId: "span",
      confidence: 1,
      state: "pending",
    };
    db.evidence.suggestions.push(s);
    db.evidence.links.push({
      id: "l",
      sourceItemId: "source",
      dealId: o.id,
      linkedBy: "explicit",
      confidence: 1,
      state: "accepted",
    });
    expect(() =>
      reviewSuggestion(db, { suggestionId: "s", decision: "accept", actorId: o.ownerId }),
    ).toThrow("Confirm");
    expect(bulkEligible(s, db.evidence)).toBe(false);
    reviewSuggestion(db, {
      suggestionId: "s",
      decision: "accept",
      actorId: o.ownerId,
      confirmed: true,
    });
    expect(o.stage).toBe("won");
  });
  it("requires confirmation for value changes", () => {
    const db = fixture();
    const o = db.opportunities[0];
    if (!o) throw new Error("Missing deal");
    const s: Suggestion = {
      id: "s",
      sourceItemId: "source",
      kind: "update_field",
      payload: { dealId: o.id, field: "value", value: 250000 },
      rationale: "test",
      evidenceSpanId: "span",
      confidence: 1,
      state: "pending",
    };
    db.evidence.suggestions.push(s);
    db.evidence.links.push({
      id: "l",
      sourceItemId: "source",
      dealId: o.id,
      linkedBy: "explicit",
      confidence: 1,
      state: "accepted",
    });
    expect(() =>
      reviewSuggestion(db, { suggestionId: "s", decision: "accept", actorId: o.ownerId }),
    ).toThrow("Confirm");
    expect(bulkEligible(s, db.evidence)).toBe(false);
    reviewSuggestion(db, {
      suggestionId: "s",
      decision: "accept",
      actorId: o.ownerId,
      confirmed: true,
    });
    expect(o.value).toBe(250000);
  });
  it("approved tasks become real activities with source and audit links, once only", () => {
    const db = fixture();
    const o = db.opportunities[0];
    if (!o) throw new Error("Missing deal");
    const count = db.activities.length;
    const s: Suggestion = {
      id: "s",
      sourceItemId: "source",
      kind: "create_task",
      payload: {
        dealId: o.id,
        ownerId: o.ownerId,
        dueDate: "2026-11-02",
        subject: "Send revised quote",
      },
      rationale: "Agreed in call",
      evidenceSpanId: "span",
      confidence: 0.95,
      state: "pending",
    };
    db.evidence.suggestions.push(s);
    db.evidence.links.push({
      id: "l",
      sourceItemId: "source",
      dealId: o.id,
      linkedBy: "explicit",
      confidence: 1,
      state: "accepted",
    });
    reviewSuggestion(
      db,
      { suggestionId: "s", decision: "accept", actorId: o.ownerId },
      "2026-10-23T01:00:00Z",
    );
    expect(db.activities).toHaveLength(count + 1);
    expect(db.activities.at(-1)).toMatchObject({
      subject: "Send revised quote",
      sourceItemId: "source",
      suggestionId: "s",
      ownerId: o.ownerId,
      dueDate: "2026-11-02",
      completed: false,
    });
    expect(db.evidence.audit.at(-1)).toMatchObject({
      actorId: o.ownerId,
      at: "2026-10-23T01:00:00Z",
    });
    expect(() =>
      reviewSuggestion(db, { suggestionId: "s", decision: "accept", actorId: o.ownerId }),
    ).toThrow("already");
  });
  it("does not allow external contacts as task owners", () => {
    const db = fixture();
    const o = db.opportunities[0];
    if (!o) throw new Error("Missing deal");
    const s: Suggestion = {
      id: "s",
      sourceItemId: "source",
      kind: "create_task",
      payload: { dealId: o.id, ownerId: "ct_1", dueDate: "2026-11-02", subject: "Follow up" },
      rationale: "test",
      evidenceSpanId: "span",
      confidence: 1,
      state: "pending",
    };
    db.evidence.suggestions.push(s);
    db.evidence.links.push({
      id: "l",
      sourceItemId: "source",
      dealId: o.id,
      linkedBy: "explicit",
      confidence: 1,
      state: "accepted",
    });
    expect(() =>
      reviewSuggestion(db, { suggestionId: "s", decision: "accept", actorId: o.ownerId }),
    ).toThrow("internal");
  });
  it("keeps captured originals immutable and duplicates produce no suggestions", async () => {
    const repo = new InMemorySalesRepository(null);
    const db = await repo.getSnapshot();
    const owner = db.settings.owners[0];
    if (!owner) throw new Error("Missing owner");
    const input = {
      type: "note" as const,
      title: "Immutable",
      text: "Special exact source text 2026",
      origin: "paste",
      ownerId: owner.id,
    };
    const first = await repo.captureSource(input);
    const second = await repo.captureSource(input);
    expect(second.duplicateOf).toBe(first.id);
    expect(
      (await repo.getSnapshot()).evidence.suggestions.filter((s) => s.sourceItemId === second.id),
    ).toHaveLength(0);
    await repo.updateSourceLabels(first.id, "email", ["pricing"]);
    expect(
      (await repo.getSnapshot()).evidence.sources.find((s) => s.id === first.id)?.originalText,
    ).toBe(input.text);
  });
});

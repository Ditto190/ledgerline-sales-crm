import { describe, expect, it } from "vitest";
import type { Activity, Opportunity, Settings } from "../types";
import {
  financialYearRange,
  isOverdue,
  openPipelineValue,
  staleOpportunities,
  weightedPipelineValue,
  wonRevenue,
} from "./pipeline";

const settings: Settings = {
  dateFormat: "dd/MM/yyyy",
  staleDays: 14,
  stageProbabilities: { qualify: 10, develop: 30, propose: 60, negotiate: 80, won: 100, lost: 0 },
  owners: [{ id: "u1", name: "Test" }],
};

const opp = (p: Partial<Opportunity>): Opportunity => ({
  id: "o",
  name: "x",
  companyId: "c",
  contactIds: [],
  ownerId: "u1",
  value: 0,
  stage: "qualify",
  probability: null,
  expectedClose: "2026-12-01",
  closeReason: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  closedAt: null,
  ...p,
});

describe("pipeline rules", () => {
  const opps = [
    opp({ id: "a", value: 100_000, stage: "propose" }),
    opp({ id: "b", value: 50_000, stage: "develop", probability: 50 }),
    opp({ id: "c", value: 999_000, stage: "won", closedAt: "2026-08-10T00:00:00.000Z" }),
    opp({ id: "d", value: 70_000, stage: "lost", closedAt: "2026-08-10T00:00:00.000Z" }),
  ];

  it("open pipeline excludes won and lost", () => {
    expect(openPipelineValue(opps)).toBe(150_000);
  });

  it("weighted pipeline uses override probability else stage default", () => {
    // 100k * 60% + 50k * 50%
    expect(weightedPipelineValue(opps, settings)).toBe(85_000);
  });

  it("Australian financial year runs 1 July to 30 June", () => {
    const r = financialYearRange(new Date(2026, 9, 23));
    expect(r.from).toEqual(new Date(2026, 6, 1));
    expect(r.to.getFullYear()).toBe(2027);
    expect(r.to.getMonth()).toBe(5);
    expect(r.to.getDate()).toBe(30);
  });

  it("won revenue counts only won deals closed in range", () => {
    expect(wonRevenue(opps, financialYearRange(new Date(2026, 9, 23)))).toBe(999_000);
    expect(wonRevenue(opps, financialYearRange(new Date(2026, 3, 1)))).toBe(0);
  });

  it("activity is overdue only when incomplete and due before today", () => {
    const a = { completed: false, dueDate: "2026-10-22" } as Activity;
    expect(isOverdue(a, new Date(2026, 9, 23))).toBe(true);
    expect(isOverdue({ ...a, dueDate: "2026-10-23" }, new Date(2026, 9, 23))).toBe(false);
    expect(isOverdue({ ...a, completed: true }, new Date(2026, 9, 23))).toBe(false);
  });

  it("opportunity is stale after the configured days without completed activity", () => {
    const today = new Date(2026, 0, 20);
    const stale = staleOpportunities([opps[0]!], [], 14, today);
    expect(stale).toHaveLength(1);
    const fresh = staleOpportunities(
      [opps[0]!],
      [{ opportunityId: "a", completedAt: "2026-01-15T00:00:00.000Z" } as Activity],
      14,
      today,
    );
    expect(fresh).toHaveLength(0);
  });
});

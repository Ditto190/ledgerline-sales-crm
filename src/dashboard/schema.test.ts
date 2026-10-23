import { describe, expect, it } from "vitest";
import { defaultDashboard, MockDashboardGenerator, validateDashboard } from "./schema";
describe("Approved dashboard definitions", () => {
  it("accepts defaults and rule-generated layouts", () => {
    expect(validateDashboard(defaultDashboard("d", "deal")).scope).toBe("deal");
    const d = new MockDashboardGenerator().generate(
      "show overdue actions and new evidence",
      "d",
      "deal",
    );
    expect(d.widgets.map((w) => w.type)).toContain("OverdueActivities");
    expect(d.widgets.map((w) => w.type)).toContain("EvidenceFeed");
  });
  it("rejects unknown widget types", () => {
    const d = defaultDashboard("d", "global");
    expect(() =>
      validateDashboard({
        ...d,
        widgets: [{ id: "w", type: "Script", queryId: "review_count", props: {} }],
      }),
    ).toThrow("Dashboard");
  });
  it("rejects arbitrary props", () => {
    const d = defaultDashboard("d", "global");
    expect(() =>
      validateDashboard({
        ...d,
        widgets: d.widgets.map((w) => ({ ...w, props: { code: "run()" } })),
      }),
    ).toThrow("Dashboard");
  });
  it("rejects unknown query IDs", () => {
    const d = defaultDashboard("d", "global");
    expect(() =>
      validateDashboard({ ...d, widgets: d.widgets.map((w) => ({ ...w, queryId: "SELECT *" })) }),
    ).toThrow("Dashboard");
  });
  it("rejects unknown scopes and mismatched queries", () => {
    const d = defaultDashboard("d", "global");
    expect(() => validateDashboard({ ...d, scope: "admin" })).toThrow("Dashboard");
    expect(() =>
      validateDashboard({
        ...d,
        widgets: d.widgets.map((w) => ({ ...w, queryId: "stakeholders" })),
      }),
    ).toThrow("Dashboard");
  });
  it("rejects duplicate and missing layout IDs", () => {
    const d = defaultDashboard("d", "deal");
    expect(() =>
      validateDashboard({ ...d, layout: d.layout.map((l) => ({ ...l, i: "same" })) }),
    ).toThrow("Dashboard");
  });
});

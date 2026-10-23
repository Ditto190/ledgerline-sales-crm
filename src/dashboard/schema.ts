import { z } from "zod";

export const WIDGET_TYPES = [
  "KpiCard",
  "InboxQueue",
  "SuggestedActions",
  "NextSteps",
  "EvidenceFeed",
  "StakeholderList",
  "PipelineSummary",
  "OverdueActivities",
] as const;
export const QUERY_IDS = [
  "review_count",
  "inbox_queue",
  "suggested_actions",
  "next_steps",
  "evidence_feed",
  "stakeholders",
  "pipeline_summary",
  "overdue_activities",
] as const;
export const CONTAINER_TYPES = [
  "DashboardSection",
  "TabsContainer",
  "SplitPanel",
  "WidgetFrame",
] as const;
export const widgetSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(WIDGET_TYPES),
    queryId: z.enum(QUERY_IDS),
    props: z
      .object({
        title: z.string().max(100).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .strict(),
  })
  .strict();
const cellSchema = z
  .object({
    i: z.string(),
    x: z.number().int().min(0).max(11),
    y: z.number().int().min(0).max(500),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(2).max(30),
  })
  .strict();
const PAIRS: Record<(typeof WIDGET_TYPES)[number], (typeof QUERY_IDS)[number]> = {
  KpiCard: "review_count",
  InboxQueue: "inbox_queue",
  SuggestedActions: "suggested_actions",
  NextSteps: "next_steps",
  EvidenceFeed: "evidence_feed",
  StakeholderList: "stakeholders",
  PipelineSummary: "pipeline_summary",
  OverdueActivities: "overdue_activities",
};
export const dashboardSchema = z
  .object({
    id: z.string(),
    scope: z.enum(["global", "deal"]),
    version: z.literal(1),
    container: z.enum(CONTAINER_TYPES),
    layout: z.array(cellSchema).max(30),
    widgets: z.array(widgetSchema).max(30),
    responsiveLayouts: z.record(z.array(cellSchema)).optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    const ids = d.widgets.map((w) => w.id);
    if (
      new Set(ids).size !== ids.length ||
      d.layout.length !== ids.length ||
      d.layout.some((l) => !ids.includes(l.i)) ||
      new Set(d.layout.map((l) => l.i)).size !== ids.length
    )
      ctx.addIssue({ code: "custom", message: "Every widget needs one unique layout position." });
    for (const w of d.widgets)
      if (PAIRS[w.type] !== w.queryId || (d.scope === "global" && w.type === "StakeholderList"))
        ctx.addIssue({
          code: "custom",
          message: "This widget or query is unavailable in this scope.",
        });
    if (
      d.responsiveLayouts &&
      Object.values(d.responsiveLayouts).some(
        (l) =>
          l.length !== ids.length ||
          new Set(l.map((c) => c.i)).size !== ids.length ||
          l.some((c) => !ids.includes(c.i)),
      )
    )
      ctx.addIssue({ code: "custom", message: "Responsive layouts must match the widgets." });
  });
export type DashboardDefinition = z.infer<typeof dashboardSchema>;
export type WidgetDefinition = z.infer<typeof widgetSchema>;
export const widgetQuery = (type: (typeof WIDGET_TYPES)[number]) => PAIRS[type];
export function validateDashboard(input: unknown): DashboardDefinition {
  const result = dashboardSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      "Dashboard could not be loaded. Check widget types, settings, queries and scope.",
    );
  return result.data;
}
export function defaultDashboard(id: string, scope: "global" | "deal"): DashboardDefinition {
  const types: (typeof WIDGET_TYPES)[number][] =
    scope === "deal"
      ? ["EvidenceFeed", "SuggestedActions", "StakeholderList", "NextSteps", "OverdueActivities"]
      : ["KpiCard", "InboxQueue", "SuggestedActions", "PipelineSummary", "OverdueActivities"];
  return {
    id,
    scope,
    version: 1,
    container: "DashboardSection",
    widgets: types.map((type, i) => ({ id: `widget_${i}`, type, queryId: PAIRS[type], props: {} })),
    layout: types.map((_, i) => ({
      i: `widget_${i}`,
      x: (i % 2) * 6,
      y: Math.floor(i / 2) * 5,
      w: 6,
      h: 5,
    })),
  };
}
export interface DashboardGenerator {
  generate(prompt: string, id: string, scope: "global" | "deal"): DashboardDefinition;
}
export class MockDashboardGenerator implements DashboardGenerator {
  generate(prompt: string, id: string, scope: "global" | "deal") {
    const mapping: [RegExp, (typeof WIDGET_TYPES)[number]][] = [
      [/overdue/i, "OverdueActivities"],
      [/evidence/i, "EvidenceFeed"],
      [/suggest|action/i, "SuggestedActions"],
      [/stakeholder|people/i, "StakeholderList"],
      [/pipeline/i, "PipelineSummary"],
      [/inbox|queue/i, "InboxQueue"],
      [/next step/i, "NextSteps"],
      [/kpi|count/i, "KpiCard"],
    ];
    const types = mapping
      .filter(
        ([re, type]) => re.test(prompt) && !(scope === "global" && type === "StakeholderList"),
      )
      .map(([, type]) => type);
    if (!types.length)
      throw new Error("No matching widgets. Try “show overdue actions and new evidence”.");
    return validateDashboard({
      id,
      scope,
      version: 1,
      container: "DashboardSection",
      widgets: types.map((type, i) => ({
        id: `generated_${i}`,
        type,
        queryId: PAIRS[type],
        props: {},
      })),
      layout: types.map((_, i) => ({
        i: `generated_${i}`,
        x: (i % 2) * 6,
        y: Math.floor(i / 2) * 5,
        w: 6,
        h: 5,
      })),
    });
  }
}

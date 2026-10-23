import {
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
} from "date-fns";
import {
  OPEN_STAGES,
  STAGE_LABELS,
  isOpenStage,
  type Activity,
  type Opportunity,
  type Settings,
  type Stage,
} from "../types";

export function effectiveProbability(o: Opportunity, s: Settings): number {
  if (o.stage === "won") return 100;
  if (o.stage === "lost") return 0;
  return o.probability ?? s.stageProbabilities[o.stage];
}

export const weightedValue = (o: Opportunity, s: Settings) =>
  (o.value * effectiveProbability(o, s)) / 100;

export const openOpportunities = (opps: Opportunity[]) => opps.filter((o) => isOpenStage(o.stage));

export const openPipelineValue = (opps: Opportunity[]) =>
  openOpportunities(opps).reduce((sum, o) => sum + o.value, 0);

export const weightedPipelineValue = (opps: Opportunity[], s: Settings) =>
  openOpportunities(opps).reduce((sum, o) => sum + weightedValue(o, s), 0);

export type PeriodKey = "month" | "quarter" | "fy" | "custom";
export interface DateRange {
  from: Date;
  to: Date;
}

/** Australian financial year runs 1 July – 30 June. */
export function financialYearRange(today: Date): DateRange {
  const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return {
    from: new Date(startYear, 6, 1),
    to: endOfDay(new Date(startYear + 1, 5, 30)),
  };
}

export function periodRange(period: PeriodKey, today: Date, custom?: DateRange): DateRange {
  switch (period) {
    case "month":
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case "quarter":
      return { from: startOfQuarter(today), to: endOfQuarter(today) };
    case "fy":
      return financialYearRange(today);
    case "custom":
      return custom
        ? { from: startOfDay(custom.from), to: endOfDay(custom.to) }
        : { from: startOfMonth(today), to: endOfMonth(today) };
  }
}

const inRange = (iso: string, r: DateRange) => {
  const d = parseISO(iso);
  return d >= r.from && d <= r.to;
};

export const wonInRange = (opps: Opportunity[], r: DateRange) =>
  opps.filter((o) => o.stage === "won" && o.closedAt && inRange(o.closedAt, r));

export const wonRevenue = (opps: Opportunity[], r: DateRange) =>
  wonInRange(opps, r).reduce((sum, o) => sum + o.value, 0);

export function isOverdue(a: Activity, today: Date): boolean {
  return !a.completed && parseISO(a.dueDate) < startOfDay(today);
}

export const overdueActivities = (acts: Activity[], today: Date) =>
  acts.filter((a) => isOverdue(a, today));

export function pipelineByStage(opps: Opportunity[], s: Settings) {
  return OPEN_STAGES.map((stage: Stage) => {
    const list = opps.filter((o) => o.stage === stage);
    return {
      stage,
      label: STAGE_LABELS[stage],
      count: list.length,
      value: list.reduce((sum, o) => sum + o.value, 0),
      weighted: list.reduce((sum, o) => sum + weightedValue(o, s), 0),
    };
  });
}

/** Most recent touch: latest completed activity, else the opportunity's creation. */
export function lastActivityDate(o: Opportunity, acts: Activity[]): Date {
  let latest = parseISO(o.createdAt);
  for (const a of acts) {
    if (a.opportunityId !== o.id || !a.completedAt) continue;
    const d = parseISO(a.completedAt);
    if (d > latest) latest = d;
  }
  return latest;
}

export function staleOpportunities(
  opps: Opportunity[],
  acts: Activity[],
  staleDays: number,
  today: Date,
) {
  return openOpportunities(opps)
    .map((o) => {
      const last = lastActivityDate(o, acts);
      return {
        opportunity: o,
        lastActivity: last,
        daysSince: differenceInCalendarDays(today, last),
      };
    })
    .filter((r) => r.daysSince >= staleDays)
    .sort((a, b) => b.daysSince - a.daysSince);
}

export function wonRevenueByMonth(opps: Opportunity[], today: Date, months = 12) {
  const start = startOfMonth(addMonths(today, -(months - 1)));
  return Array.from({ length: months }, (_, i) => {
    const m = addMonths(start, i);
    const r = { from: startOfMonth(m), to: endOfMonth(m) };
    return { month: format(m, "MMM yy"), value: wonRevenue(opps, r) };
  });
}

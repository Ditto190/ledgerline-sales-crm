import { format, parseISO } from "date-fns";
import type { DateFormat } from "./types";

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});
const audCompact = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatAud = (n: number) => aud.format(n);
export const formatAudCompact = (n: number) => audCompact.format(n);

export function formatDate(value: string | Date | null | undefined, fmt: DateFormat): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, fmt);
}

/** yyyy-MM-dd for <input type="date"> */
export const toDateInput = (iso: string) => iso.slice(0, 10);

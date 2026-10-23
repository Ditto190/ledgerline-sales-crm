import { z } from "zod";
import type { EvidenceStore } from "./evidence";

export const STAGES = ["qualify", "develop", "propose", "negotiate", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export const OPEN_STAGES: Stage[] = ["qualify", "develop", "propose", "negotiate"];
export const STAGE_LABELS: Record<Stage, string> = {
  qualify: "Qualify",
  develop: "Develop",
  propose: "Propose",
  negotiate: "Negotiate",
  won: "Won",
  lost: "Lost",
};
export const isOpenStage = (s: Stage) => s !== "won" && s !== "lost";

export const ACTIVITY_TYPES = ["call", "email", "meeting", "task"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: "Phone call",
  email: "Email",
  meeting: "Meeting",
  task: "Task",
};

export const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;

export interface Owner {
  id: string;
  name: string;
}

export const companySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  industry: z.string().trim().max(80),
  city: z.string().trim().max(80),
  state: z.enum(AU_STATES),
  website: z.string().trim().max(200),
  phone: z.string().trim().max(40),
  employees: z.coerce.number().int().min(0).max(1_000_000),
  ownerId: z.string().min(1, "Owner is required"),
});
export type CompanyInput = z.infer<typeof companySchema>;
export interface Company extends CompanyInput {
  id: string;
  createdAt: string;
}

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  jobTitle: z.string().trim().max(100),
  email: z.union([z.literal(""), z.string().trim().email("Invalid email")]),
  phone: z.string().trim().max(40),
  companyId: z.string().nullable(),
});
export type ContactInput = z.infer<typeof contactSchema>;
export interface Contact extends ContactInput {
  id: string;
  createdAt: string;
}

export const opportunitySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(140),
  companyId: z.string().min(1, "Company is required"),
  contactIds: z.array(z.string()),
  ownerId: z.string().min(1, "Owner is required"),
  value: z.coerce.number().min(0, "Value must be positive").max(1_000_000_000),
  stage: z.enum(STAGES),
  /** null = use stage default probability from settings */
  probability: z.coerce.number().min(0).max(100).nullable(),
  expectedClose: z.string().min(1, "Expected close date is required"),
  closeReason: z.string().max(300).nullable(),
});
export type OpportunityInput = z.infer<typeof opportunitySchema>;
export interface Opportunity extends OpportunityInput {
  id: string;
  createdAt: string;
  closedAt: string | null;
}

export const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().trim().min(1, "Subject is required").max(160),
  notes: z.string().max(2000),
  dueDate: z.string().min(1, "Due date is required"),
  completed: z.boolean(),
  opportunityId: z.string().nullable(),
  contactId: z.string().nullable(),
  companyId: z.string().nullable(),
  ownerId: z.string().min(1, "Owner is required"),
});
export type ActivityInput = z.infer<typeof activitySchema>;
export interface Activity extends ActivityInput {
  id: string;
  sourceItemId?: string;
  suggestionId?: string;
  createdAt: string;
  completedAt: string | null;
}

export const DATE_FORMATS = ["dd/MM/yyyy", "d MMM yyyy", "yyyy-MM-dd"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export interface Settings {
  dateFormat: DateFormat;
  staleDays: number;
  stageProbabilities: Record<Stage, number>;
  owners: Owner[];
}

export interface Snapshot {
  evidence: EvidenceStore;
  companies: Company[];
  contacts: Contact[];
  opportunities: Opportunity[];
  activities: Activity[];
  settings: Settings;
}

export type EntityKind = "company" | "contact" | "opportunity" | "activity";

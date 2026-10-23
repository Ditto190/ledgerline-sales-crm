import type {
  Activity,
  ActivityInput,
  Company,
  CompanyInput,
  Contact,
  ContactInput,
  Opportunity,
  OpportunityInput,
  Settings,
  Snapshot,
  Stage,
} from "@/domain/types";
import type { CaptureInput, ReviewInput, SourceItem } from "@/domain/evidence";
import type { DashboardDefinition } from "@/dashboard/schema";

/**
 * All data access goes through this interface. The UI never touches storage
 * directly, so a SQLite / local API implementation can replace the demo one.
 */
export interface SalesRepository {
  captureSource(input: CaptureInput): Promise<SourceItem>;
  retrySource(id: string): Promise<void>;
  reviewSuggestion(input: ReviewInput): Promise<void>;
  bulkAccept(sourceId: string, actorId: string): Promise<number>;
  setSourceLink(
    sourceId: string,
    dealId: string,
    accepted: boolean,
    actorId: string,
  ): Promise<void>;
  resolveMention(id: string, contactId: string, actorId: string): Promise<void>;
  updateSourceLabels(id: string, type: SourceItem["type"], topics: string[]): Promise<void>;
  reviewAssertion(id: string, state: "accepted" | "rejected", actorId: string): Promise<void>;
  fileSource(id: string, actorId: string): Promise<void>;
  saveDashboard(definition: DashboardDefinition): Promise<void>;
  getSnapshot(): Promise<Snapshot>;

  saveCompany(input: CompanyInput, id?: string): Promise<Company>;
  deleteCompany(id: string): Promise<void>;

  saveContact(input: ContactInput, id?: string): Promise<Contact>;
  deleteContact(id: string): Promise<void>;

  saveOpportunity(input: OpportunityInput, id?: string): Promise<Opportunity>;
  moveOpportunity(id: string, stage: Stage, closeReason?: string | null): Promise<Opportunity>;
  linkContact(opportunityId: string, contactId: string, linked: boolean): Promise<void>;
  deleteOpportunity(id: string): Promise<void>;

  saveActivity(input: ActivityInput, id?: string): Promise<Activity>;
  setActivityCompleted(id: string, completed: boolean): Promise<void>;
  deleteActivity(id: string): Promise<void>;

  updateSettings(settings: Settings): Promise<Settings>;

  exportJson(): Promise<string>;
  importJson(json: string): Promise<void>;
  resetDemoData(): Promise<void>;
}

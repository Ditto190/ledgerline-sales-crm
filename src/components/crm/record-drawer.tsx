import { CheckCircle2, Circle, Pencil, Plus, Trash2, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { DealEvidence } from "./deal-evidence";
import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDb, useFormat, useLookups, useRepoMutation } from "@/data/hooks";
import {
  effectiveProbability,
  isOverdue,
  lastActivityDate,
  weightedValue,
} from "@/domain/services/pipeline";
import {
  ACTIVITY_LABELS,
  STAGES,
  STAGE_LABELS,
  isOpenStage,
  type Activity,
  type EntityKind,
  type Opportunity,
  type Stage,
} from "@/domain/types";
import { cn } from "@/lib/utils";
import { NativeSelect, StageBadge } from "./fields";
import { useUI } from "./ui-state";

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function Props({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 truncate">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
function RowLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
    >
      {children}
    </button>
  );
}

function ActivityList({ items }: { items: Activity[] }) {
  const { openDrawer } = useUI();
  const f = useFormat();
  const toggle = useRepoMutation((r, a: Activity) => r.setActivityCompleted(a.id, !a.completed));
  if (!items.length)
    return <p className="px-2 text-xs text-muted-foreground">No activities yet.</p>;
  const now = new Date();
  return (
    <div className="divide-y rounded-md border">
      {[...items]
        .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
        .map((a) => (
          <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
            <button
              aria-label={a.completed ? "Mark as open" : "Mark complete"}
              onClick={() => toggle.mutate(a)}
            >
              {a.completed ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <button
              className="min-w-0 flex-1 truncate text-left hover:underline"
              onClick={() => openDrawer({ kind: "activity", id: a.id })}
            >
              <span className={cn(a.completed && "text-muted-foreground line-through")}>
                {a.subject}
              </span>
              <span className="text-muted-foreground"> · {ACTIVITY_LABELS[a.type]}</span>
            </button>
            <span
              className={cn(
                "num",
                isOverdue(a, now) ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {f.date(a.dueDate)}
            </span>
          </div>
        ))}
    </div>
  );
}

function OpportunityBody({ o }: { o: Opportunity }) {
  const db = useDb();
  const L = useLookups();
  const f = useFormat();
  const { openDrawer, openForm, requestClose } = useUI();
  const move = useRepoMutation((r, s: Stage) => r.moveOpportunity(o.id, s), "Stage updated");
  const link = useRepoMutation((r, a: { id: string; linked: boolean }) =>
    r.linkContact(o.id, a.id, a.linked),
  );
  const [adding, setAdding] = useState("");
  const acts = db.activities.filter((a) => a.opportunityId === o.id);
  const linkable = db.contacts.filter(
    (c) => !o.contactIds.includes(c.id) && c.companyId === o.companyId,
  );
  return (
    <>
      <Section title="Stage">
        <div className="flex gap-1">
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() =>
                s === "won" || s === "lost" ? requestClose({ id: o.id, stage: s }) : move.mutate(s)
              }
              className={cn(
                "flex-1 rounded-sm border px-1 py-1 text-[11px]",
                o.stage === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              {STAGE_LABELS[s]}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Details">
        <Props
          rows={[
            [
              "Company",
              <button
                className="text-primary hover:underline"
                onClick={() => openDrawer({ kind: "company", id: o.companyId })}
              >
                {L.companyName(o.companyId)}
              </button>,
            ],
            ["Value", <span className="num">{f.money(o.value)}</span>],
            [
              "Probability",
              <span className="num">
                {effectiveProbability(o, db.settings)}%
                {o.probability == null && isOpenStage(o.stage) ? " (stage default)" : ""}
              </span>,
            ],
            ["Weighted", <span className="num">{f.money(weightedValue(o, db.settings))}</span>],
            ["Expected close", f.date(o.expectedClose)],
            ["Owner", L.ownerName(o.ownerId)],
            ["Last activity", f.date(lastActivityDate(o, db.activities))],
            ...(o.closedAt
              ? ([
                  ["Closed", f.date(o.closedAt)],
                  ["Close reason", o.closeReason],
                ] as [string, ReactNode][])
              : []),
          ]}
        />
      </Section>
      <Section title={`Contacts (${o.contactIds.length})`}>
        <div className="space-y-0.5">
          {o.contactIds.map((id) => (
            <div key={id} className="flex items-center">
              <RowLink onClick={() => openDrawer({ kind: "contact", id })}>
                <span>{L.contactName(id)}</span>
                <span className="text-muted-foreground">{L.contact.get(id)?.jobTitle}</span>
              </RowLink>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label="Unlink contact"
                onClick={() => link.mutate({ id, linked: false })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="flex gap-1 pt-1">
            <NativeSelect value={adding} onChange={(e) => setAdding(e.target.value)}>
              <option value="">
                {linkable.length ? "Link a contact…" : "No more contacts at this company"}
              </option>
              {linkable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </NativeSelect>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={!adding}
              onClick={() => {
                link.mutate({ id: adding, linked: true });
                setAdding("");
              }}
            >
              Link
            </Button>
          </div>
        </div>
      </Section>
      <Section
        title={`Activities (${acts.length})`}
        action={
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() =>
              openForm({
                kind: "activity",
                defaults: {
                  opportunityId: o.id,
                  companyId: o.companyId,
                  contactId: o.contactIds[0] ?? null,
                  ownerId: o.ownerId,
                },
              })
            }
          >
            <Plus className="h-3 w-3" /> Log activity
          </Button>
        }
      >
        <ActivityList items={acts} />
      </Section>
    </>
  );
}

function CompanyBody({ id }: { id: string }) {
  const db = useDb();
  const L = useLookups();
  const f = useFormat();
  const { openDrawer, openForm } = useUI();
  const c = L.company.get(id)!;
  const contacts = db.contacts.filter((x) => x.companyId === id);
  const opps = db.opportunities.filter((x) => x.companyId === id);
  return (
    <>
      <Section title="Details">
        <Props
          rows={[
            ["Industry", c.industry],
            ["Location", `${c.city}, ${c.state}`],
            ["Website", c.website],
            ["Phone", c.phone],
            ["Employees", <span className="num">{c.employees.toLocaleString("en-AU")}</span>],
            ["Owner", L.ownerName(c.ownerId)],
          ]}
        />
      </Section>
      <Section
        title={`Opportunities (${opps.length})`}
        action={
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() => openForm({ kind: "opportunity", defaults: { companyId: id } })}
          >
            <Plus className="h-3 w-3" /> New
          </Button>
        }
      >
        {opps.map((o) => (
          <RowLink key={o.id} onClick={() => openDrawer({ kind: "opportunity", id: o.id })}>
            <span className="truncate">{o.name}</span>
            <span className="flex items-center gap-2">
              <span className="num">{f.money(o.value)}</span>
              <StageBadge stage={o.stage} />
            </span>
          </RowLink>
        ))}
      </Section>
      <Section
        title={`Contacts (${contacts.length})`}
        action={
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() => openForm({ kind: "contact", defaults: { companyId: id } })}
          >
            <Plus className="h-3 w-3" /> New
          </Button>
        }
      >
        {contacts.map((x) => (
          <RowLink key={x.id} onClick={() => openDrawer({ kind: "contact", id: x.id })}>
            <span>
              {x.firstName} {x.lastName}
            </span>
            <span className="text-muted-foreground">{x.jobTitle}</span>
          </RowLink>
        ))}
      </Section>
      <Section
        title="Activities"
        action={
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() => openForm({ kind: "activity", defaults: { companyId: id } })}
          >
            <Plus className="h-3 w-3" /> Log activity
          </Button>
        }
      >
        <ActivityList items={db.activities.filter((a) => a.companyId === id)} />
      </Section>
    </>
  );
}

function ContactBody({ id }: { id: string }) {
  const db = useDb();
  const L = useLookups();
  const { openDrawer, openForm } = useUI();
  const c = L.contact.get(id)!;
  const opps = db.opportunities.filter((o) => o.contactIds.includes(id));
  return (
    <>
      <Section title="Details">
        <Props
          rows={[
            ["Job title", c.jobTitle],
            [
              "Company",
              c.companyId ? (
                <button
                  className="text-primary hover:underline"
                  onClick={() => openDrawer({ kind: "company", id: c.companyId! })}
                >
                  {L.companyName(c.companyId)}
                </button>
              ) : (
                "—"
              ),
            ],
            [
              "Email",
              c.email ? (
                <a className="text-primary hover:underline" href={`mailto:${c.email}`}>
                  {c.email}
                </a>
              ) : (
                "—"
              ),
            ],
            ["Phone", c.phone],
          ]}
        />
      </Section>
      <Section title={`Opportunities (${opps.length})`}>
        {opps.length === 0 && (
          <p className="px-2 text-xs text-muted-foreground">
            Not linked to any opportunity. Link from an opportunity's drawer.
          </p>
        )}
        {opps.map((o) => (
          <RowLink key={o.id} onClick={() => openDrawer({ kind: "opportunity", id: o.id })}>
            <span className="truncate">{o.name}</span>
            <StageBadge stage={o.stage} />
          </RowLink>
        ))}
      </Section>
      <Section
        title="Activities"
        action={
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() =>
              openForm({ kind: "activity", defaults: { contactId: id, companyId: c.companyId } })
            }
          >
            <Plus className="h-3 w-3" /> Log activity
          </Button>
        }
      >
        <ActivityList items={db.activities.filter((a) => a.contactId === id)} />
      </Section>
    </>
  );
}

function ActivityBody({ a }: { a: Activity }) {
  const L = useLookups();
  const f = useFormat();
  const { openDrawer, closeDrawer } = useUI();
  const toggle = useRepoMutation((r) => r.setActivityCompleted(a.id, !a.completed));
  const link = (kind: EntityKind, id: string | null, label: string) =>
    id ? (
      <button className="text-primary hover:underline" onClick={() => openDrawer({ kind, id })}>
        {label}
      </button>
    ) : (
      "—"
    );
  return (
    <>
      <Section title="Details">
        <Props
          rows={[
            ["Type", ACTIVITY_LABELS[a.type]],
            [
              "Due",
              <span className={cn(isOverdue(a, new Date()) && "text-destructive")}>
                {f.date(a.dueDate)}
              </span>,
            ],
            [
              "Status",
              a.completed ? (
                <Badge variant="success">Completed {f.date(a.completedAt)}</Badge>
              ) : isOverdue(a, new Date()) ? (
                <Badge variant="destructive">Overdue</Badge>
              ) : (
                <Badge variant="secondary">Open</Badge>
              ),
            ],
            [
              "Opportunity",
              link(
                "opportunity",
                a.opportunityId,
                L.opportunity.get(a.opportunityId ?? "")?.name ?? "—",
              ),
            ],
            ["Contact", link("contact", a.contactId, L.contactName(a.contactId))],
            ["Company", link("company", a.companyId, L.companyName(a.companyId))],
            ["Owner", L.ownerName(a.ownerId)],
          ]}
        />
      </Section>
      <Section title="Notes">
        <p className="whitespace-pre-wrap text-xs">
          {a.notes || <span className="text-muted-foreground">No notes.</span>}
        </p>
      </Section>
      {a.sourceItemId && (
        <Link
          to="/inbox"
          search={{ source: a.sourceItemId }}
          onClick={closeDrawer}
          className="text-xs text-primary"
        >
          View source evidence →
        </Link>
      )}
      <Button size="sm" variant="outline" onClick={() => toggle.mutate(undefined)}>
        {a.completed ? "Reopen activity" : "Mark complete"}
      </Button>
    </>
  );
}

export function RecordDrawer() {
  const { drawer, closeDrawer, openForm } = useUI();
  const db = useDb();
  const L = useLookups();
  const [confirm, setConfirm] = useState(false);
  const del = useRepoMutation((r, ref: { kind: EntityKind; id: string }) => {
    switch (ref.kind) {
      case "company":
        return r.deleteCompany(ref.id);
      case "contact":
        return r.deleteContact(ref.id);
      case "opportunity":
        return r.deleteOpportunity(ref.id);
      case "activity":
        return r.deleteActivity(ref.id);
    }
  }, "Deleted");

  let title = "";
  let subtitle: ReactNode = null;
  let body: ReactNode = null;
  if (drawer) {
    if (drawer.kind === "opportunity") {
      const o = db.opportunities.find((x) => x.id === drawer.id);
      if (o) {
        title = o.name;
        subtitle = <StageBadge stage={o.stage} />;
        body = <DealEvidence key={o.id} dealId={o.id} details={<OpportunityBody o={o} />} />;
      }
    } else if (drawer.kind === "company") {
      const c = L.company.get(drawer.id);
      if (c) {
        title = c.name;
        subtitle = "Company";
        body = <CompanyBody id={c.id} />;
      }
    } else if (drawer.kind === "contact") {
      const c = L.contact.get(drawer.id);
      if (c) {
        title = `${c.firstName} ${c.lastName}`;
        subtitle = "Contact";
        body = <ContactBody id={c.id} />;
      }
    } else {
      const a = db.activities.find((x) => x.id === drawer.id);
      if (a) {
        title = a.subject;
        subtitle = ACTIVITY_LABELS[a.type];
        body = <ActivityBody a={a} />;
      }
    }
  }
  const open = !!drawer && !!body;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && closeDrawer()}>
        <SheetContent className="w-[460px] overflow-y-auto sm:max-w-[460px]">
          <SheetHeader className="space-y-1 pr-6">
            <SheetTitle className="text-base leading-tight">{title}</SheetTitle>
            <SheetDescription asChild>
              <div className="text-xs">{subtitle}</div>
            </SheetDescription>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => drawer && openForm({ kind: drawer.kind, id: drawer.id })}
              >
                <Pencil className="h-3 w-3" /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-destructive"
                onClick={() => setConfirm(true)}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            </div>
          </SheetHeader>
          <div className="mt-4 space-y-5">{body}</div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. Linked records will be unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => drawer && del.mutate(drawer, { onSuccess: () => closeDrawer() })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

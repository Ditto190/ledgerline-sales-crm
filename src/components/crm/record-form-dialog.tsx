import { formatISO } from "date-fns";
import { useEffect, useState } from "react";
import type { ZodSchema } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useDb, useRepoMutation } from "@/data/hooks";
import { toDateInput } from "@/domain/format";
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  AU_STATES,
  STAGES,
  STAGE_LABELS,
  activitySchema,
  companySchema,
  contactSchema,
  opportunitySchema,
  type EntityKind,
  type Snapshot,
} from "@/domain/types";
import { Field, NativeSelect } from "./fields";
import { useUI } from "./ui-state";

type Values = Record<string, unknown>;
const today = () => formatISO(new Date(), { representation: "date" });

function initialValues(kind: EntityKind, db: Snapshot, id?: string, defaults?: Values): Values {
  const owner = db.settings.owners[0]?.id ?? "";
  if (kind === "company") {
    const r = db.companies.find((x) => x.id === id);
    return r
      ? { ...r }
      : {
          name: "",
          industry: "",
          city: "",
          state: "NSW",
          website: "",
          phone: "",
          employees: 0,
          ownerId: owner,
          ...defaults,
        };
  }
  if (kind === "contact") {
    const r = db.contacts.find((x) => x.id === id);
    return r
      ? { ...r }
      : {
          firstName: "",
          lastName: "",
          jobTitle: "",
          email: "",
          phone: "",
          companyId: null,
          ...defaults,
        };
  }
  if (kind === "opportunity") {
    const r = db.opportunities.find((x) => x.id === id);
    return r
      ? { ...r, expectedClose: toDateInput(r.expectedClose) }
      : {
          name: "",
          companyId: "",
          contactIds: [],
          ownerId: owner,
          value: 0,
          stage: "qualify",
          probability: null,
          expectedClose: today(),
          closeReason: null,
          ...defaults,
        };
  }
  const r = db.activities.find((x) => x.id === id);
  return r
    ? { ...r, dueDate: toDateInput(r.dueDate) }
    : {
        type: "call",
        subject: "",
        notes: "",
        dueDate: today(),
        completed: false,
        opportunityId: null,
        contactId: null,
        companyId: null,
        ownerId: owner,
        ...defaults,
      };
}

const SCHEMAS: Record<EntityKind, ZodSchema> = {
  company: companySchema,
  contact: contactSchema,
  opportunity: opportunitySchema,
  activity: activitySchema,
};
const TITLES: Record<EntityKind, string> = {
  company: "company",
  contact: "contact",
  opportunity: "opportunity",
  activity: "activity",
};

export function RecordFormDialog() {
  const { form, closeForm, openDrawer } = useUI();
  const db = useDb();
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (form) {
      setValues(initialValues(form.kind, db, form.id, form.defaults));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const save = useRepoMutation(async (repo, v: Values) => {
    if (!form) return;
    const id = form.id;
    switch (form.kind) {
      case "company":
        return repo.saveCompany(v as never, id);
      case "contact":
        return repo.saveContact(v as never, id);
      case "opportunity":
        return repo.saveOpportunity(v as never, id);
      case "activity":
        return repo.saveActivity(v as never, id);
    }
  });

  if (!form) return null;
  const set = (k: string) => (v: unknown) => setValues((p) => ({ ...p, [k]: v }));
  const str = (k: string) => (values[k] ?? "") as string;
  const nullable = (v: string) => (v === "" ? null : v);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = SCHEMAS[form.kind].safeParse(values);
    if (!res.success) {
      const errs: Record<string, string> = {};
      for (const i of res.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    const kind = form.kind;
    save.mutate(res.data, {
      onSuccess: (rec) => {
        closeForm();
        if (!form.id && rec && typeof rec === "object" && "id" in rec)
          openDrawer({ kind, id: (rec as { id: string }).id });
      },
    });
  };

  const owners = (
    <Field label="Owner" error={errors["ownerId"]}>
      <NativeSelect value={str("ownerId")} onChange={(e) => set("ownerId")(e.target.value)}>
        {db.settings.owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
  const companySelect = (key: string, allowNone: boolean) => (
    <Field label="Company" error={errors[key]}>
      <NativeSelect
        value={str(key)}
        onChange={(e) => set(key)(allowNone ? nullable(e.target.value) : e.target.value)}
      >
        <option value="">{allowNone ? "— None —" : "Select a company…"}</option>
        {[...db.companies]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </NativeSelect>
    </Field>
  );

  let body: React.ReactNode = null;
  if (form.kind === "company") {
    body = (
      <>
        <Field label="Name" error={errors["name"]} className="col-span-2">
          <Input value={str("name")} onChange={(e) => set("name")(e.target.value)} autoFocus />
        </Field>
        <Field label="Industry">
          <Input value={str("industry")} onChange={(e) => set("industry")(e.target.value)} />
        </Field>
        <Field label="Employees" error={errors["employees"]}>
          <Input
            type="number"
            min={0}
            value={String(values["employees"] ?? 0)}
            onChange={(e) => set("employees")(e.target.value)}
          />
        </Field>
        <Field label="City">
          <Input value={str("city")} onChange={(e) => set("city")(e.target.value)} />
        </Field>
        <Field label="State">
          <NativeSelect value={str("state")} onChange={(e) => set("state")(e.target.value)}>
            {AU_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Website">
          <Input value={str("website")} onChange={(e) => set("website")(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={str("phone")} onChange={(e) => set("phone")(e.target.value)} />
        </Field>
        {owners}
      </>
    );
  } else if (form.kind === "contact") {
    body = (
      <>
        <Field label="First name" error={errors["firstName"]}>
          <Input
            value={str("firstName")}
            onChange={(e) => set("firstName")(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Last name" error={errors["lastName"]}>
          <Input value={str("lastName")} onChange={(e) => set("lastName")(e.target.value)} />
        </Field>
        <Field label="Job title" className="col-span-2">
          <Input value={str("jobTitle")} onChange={(e) => set("jobTitle")(e.target.value)} />
        </Field>
        <Field label="Email" error={errors["email"]}>
          <Input type="email" value={str("email")} onChange={(e) => set("email")(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={str("phone")} onChange={(e) => set("phone")(e.target.value)} />
        </Field>
        <div className="col-span-2">{companySelect("companyId", true)}</div>
      </>
    );
  } else if (form.kind === "opportunity") {
    const cid = str("companyId");
    const contactIds = (values["contactIds"] ?? []) as string[];
    const candidates = db.contacts.filter((c) => !cid || c.companyId === cid);
    body = (
      <>
        <Field label="Name" error={errors["name"]} className="col-span-2">
          <Input value={str("name")} onChange={(e) => set("name")(e.target.value)} autoFocus />
        </Field>
        <div className="col-span-2">{companySelect("companyId", false)}</div>
        <Field label="Value (AUD)" error={errors["value"]}>
          <Input
            type="number"
            min={0}
            step={1000}
            value={String(values["value"] ?? 0)}
            onChange={(e) => set("value")(e.target.value)}
          />
        </Field>
        <Field label="Expected close" error={errors["expectedClose"]}>
          <Input
            type="date"
            value={str("expectedClose")}
            onChange={(e) => set("expectedClose")(e.target.value)}
          />
        </Field>
        <Field label="Stage">
          <NativeSelect value={str("stage")} onChange={(e) => set("stage")(e.target.value)}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Probability % (blank = stage default)" error={errors["probability"]}>
          <Input
            type="number"
            min={0}
            max={100}
            placeholder={`${db.settings.stageProbabilities[(values["stage"] as keyof Snapshot["settings"]["stageProbabilities"]) ?? "qualify"]}`}
            value={values["probability"] == null ? "" : String(values["probability"])}
            onChange={(e) => set("probability")(e.target.value === "" ? null : e.target.value)}
          />
        </Field>
        {owners}
        <Field label="Linked contacts" className="col-span-2">
          <div className="max-h-28 space-y-1 overflow-auto rounded-md border p-2">
            {candidates.length === 0 && (
              <p className="text-xs text-muted-foreground">Select a company to see its contacts.</p>
            )}
            {candidates.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={contactIds.includes(c.id)}
                  onCheckedChange={(v) =>
                    set("contactIds")(
                      v ? [...contactIds, c.id] : contactIds.filter((x) => x !== c.id),
                    )
                  }
                />
                {c.firstName} {c.lastName}{" "}
                <span className="text-muted-foreground">· {c.jobTitle}</span>
              </label>
            ))}
          </div>
        </Field>
        {(values["stage"] === "won" || values["stage"] === "lost") && (
          <Field label="Close reason" className="col-span-2">
            <Input
              value={str("closeReason")}
              onChange={(e) => set("closeReason")(nullable(e.target.value))}
            />
          </Field>
        )}
      </>
    );
  } else {
    const oppId = str("opportunityId");
    body = (
      <>
        <Field label="Type">
          <NativeSelect value={str("type")} onChange={(e) => set("type")(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Due date" error={errors["dueDate"]}>
          <Input
            type="date"
            value={str("dueDate")}
            onChange={(e) => set("dueDate")(e.target.value)}
          />
        </Field>
        <Field label="Subject" error={errors["subject"]} className="col-span-2">
          <Input
            value={str("subject")}
            onChange={(e) => set("subject")(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Opportunity" className="col-span-2">
          <NativeSelect
            value={oppId}
            onChange={(e) => {
              const o = db.opportunities.find((x) => x.id === e.target.value);
              setValues((p) => ({
                ...p,
                opportunityId: o?.id ?? null,
                companyId: o?.companyId ?? p["companyId"],
              }));
            }}
          >
            <option value="">— None —</option>
            {db.opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Contact">
          <NativeSelect
            value={str("contactId")}
            onChange={(e) => set("contactId")(nullable(e.target.value))}
          >
            <option value="">— None —</option>
            {db.contacts
              .filter((c) => !values["companyId"] || c.companyId === values["companyId"])
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
          </NativeSelect>
        </Field>
        {companySelect("companyId", true)}
        {owners}
        <Field label="Status">
          <label className="flex h-8 items-center gap-2 text-xs">
            <Checkbox
              checked={!!values["completed"]}
              onCheckedChange={(v) => set("completed")(!!v)}
            />{" "}
            Completed
          </label>
        </Field>
        <Field label="Notes" className="col-span-2">
          <Textarea rows={3} value={str("notes")} onChange={(e) => set("notes")(e.target.value)} />
        </Field>
      </>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && closeForm()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            {form.id ? "Edit" : "New"} {TITLES[form.kind]}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">{body}</div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={save.isPending}>
              {form.id ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

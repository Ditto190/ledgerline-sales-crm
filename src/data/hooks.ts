import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { formatAud, formatDate } from "@/domain/format";
import type { Snapshot } from "@/domain/types";
import { InMemorySalesRepository } from "./memory-repository";
import type { SalesRepository } from "./repository";

let repo: SalesRepository | null = null;
/** Browser-only. Swap this factory to plug in a different SalesRepository. */
export function getRepository(): SalesRepository {
  if (!repo) repo = new InMemorySalesRepository(window.localStorage);
  return repo;
}

export const DB_KEY = ["crm-db"] as const;

export function useDb(): Snapshot {
  return useSuspenseQuery({ queryKey: DB_KEY, queryFn: () => getRepository().getSnapshot() }).data;
}

export function useLookups() {
  const db = useDb();
  return useMemo(() => {
    const company = new Map(db.companies.map((c) => [c.id, c]));
    const contact = new Map(db.contacts.map((c) => [c.id, c]));
    const opportunity = new Map(db.opportunities.map((o) => [o.id, o]));
    const owner = new Map(db.settings.owners.map((o) => [o.id, o]));
    return {
      company,
      contact,
      opportunity,
      owner,
      companyName: (id: string | null) => (id ? (company.get(id)?.name ?? "—") : "—"),
      contactName: (id: string | null) => {
        const c = id ? contact.get(id) : undefined;
        return c ? `${c.firstName} ${c.lastName}` : "—";
      },
      ownerName: (id: string) => owner.get(id)?.name ?? "Unassigned",
    };
  }, [db]);
}

export function useFormat() {
  const { settings } = useDb();
  return useMemo(
    () => ({
      money: formatAud,
      date: (v: string | Date | null) => formatDate(v, settings.dateFormat),
    }),
    [settings.dateFormat],
  );
}

/** Wraps a repository call with cache invalidation and error toasts. */
export function useRepoMutation<A, R>(
  fn: (repo: SalesRepository, args: A) => Promise<R>,
  successMessage?: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => fn(getRepository(), args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DB_KEY });
      if (successMessage) toast.success(successMessage);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Something went wrong"),
  });
}

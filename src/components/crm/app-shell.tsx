import { Link, useRouterState } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  CalendarCheck,
  Inbox,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { useDb } from "@/data/hooks";
import { cn } from "@/lib/utils";
import { CloseDealDialog } from "./close-deal-dialog";
import { DemoBadge } from "./fields";
import { RecordDrawer } from "./record-drawer";
import { RecordFormDialog } from "./record-form-dialog";
import { UIProvider, useUI } from "./ui-state";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/opportunities", label: "Opportunities", icon: Briefcase },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/activities", label: "Activities", icon: CalendarCheck },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const db = useDb();
  const { openDrawer } = useUI();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const go = (kind: "company" | "contact" | "opportunity", id: string) => {
    setOpen(false);
    openDrawer({ kind, id });
  };
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 w-80 items-center gap-2 rounded-md border bg-background px-2.5 text-xs text-muted-foreground hover:bg-accent"
      >
        <Search className="h-3.5 w-3.5" /> Search records…
        <kbd className="ml-auto rounded border bg-muted px-1 font-mono text-[10px]">Ctrl K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search opportunities, companies, contacts…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Opportunities">
            {db.opportunities.map((o) => (
              <CommandItem
                key={o.id}
                value={`opp ${o.name}`}
                onSelect={() => go("opportunity", o.id)}
              >
                {o.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Companies">
            {db.companies.map((c) => (
              <CommandItem
                key={c.id}
                value={`co ${c.name} ${c.city}`}
                onSelect={() => go("company", c.id)}
              >
                {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Contacts">
            {db.contacts.map((c) => (
              <CommandItem
                key={c.id}
                value={`ct ${c.firstName} ${c.lastName} ${c.email}`}
                onSelect={() => go("contact", c.id)}
              >
                {c.firstName} {c.lastName}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

function QuickCreate() {
  const { openForm } = useUI();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-8">
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => openForm({ kind: "opportunity" })}>
          Opportunity
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openForm({ kind: "company" })}>Company</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openForm({ kind: "contact" })}>Contact</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openForm({ kind: "activity" })}>
          Activity
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Loading() {
  return (
    <div className="space-y-3 p-5">
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

function InboxCount() {
  const db = useDb();
  const count = db.evidence.sources.filter((s) => s.reviewStatus === "needs_review").length;
  return count ? (
    <span className="ml-auto rounded-sm bg-sidebar-primary px-1.5 text-[10px] text-sidebar-primary-foreground">
      {count}
    </span>
  ) : null;
}

function Hydrated({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? <>{children}</> : <Loading />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-52 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="grid h-6 w-6 place-items-center rounded-sm bg-sidebar-primary font-mono text-xs font-bold text-sidebar-primary-foreground">
            L
          </div>
          <span className="text-sm font-semibold text-sidebar-accent-foreground">Ledgerline</span>
          <span className="text-[10px] text-sidebar-foreground/60">Sales</span>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-xs",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/60",
                )}
              >
                <n.icon className={cn("h-4 w-4", active && "text-sidebar-primary")} /> {n.label}
                {n.to === "/inbox" && (
                  <Hydrated>
                    <Suspense fallback={null}>
                      <InboxCount />
                    </Suspense>
                  </Hydrated>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-3 text-[10px] text-sidebar-foreground/70">
          <DemoBadge className="text-warning" title="Data is stored only in this browser" />
          <p>Local demo data · stored in this browser</p>
        </div>
      </aside>
      <Hydrated>
        <UIProvider>
          <Suspense fallback={<Loading />}>
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b bg-card px-5">
                <GlobalSearch />
                <QuickCreate />
              </header>
              <main className="flex min-h-0 flex-1 flex-col overflow-auto p-5">{children}</main>
            </div>
            <RecordDrawer />
            <RecordFormDialog />
            <CloseDealDialog />
          </Suspense>
        </UIProvider>
      </Hydrated>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

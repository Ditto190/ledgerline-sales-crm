import type { ReactNode, SelectHTMLAttributes } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { STAGE_LABELS, type Stage } from "@/domain/types";
import { cn } from "@/lib/utils";

export function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

export function NativeSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    />
  );
}

const STAGE_VARIANT: Record<
  Stage,
  "secondary" | "outline" | "default" | "success" | "destructive"
> = {
  qualify: "outline",
  develop: "secondary",
  propose: "secondary",
  negotiate: "default",
  won: "success",
  lost: "destructive",
};
export function StageBadge({ stage }: { stage: Stage }) {
  return <Badge variant={STAGE_VARIANT[stage]}>{STAGE_LABELS[stage]}</Badge>;
}

export function DemoBadge({ title, className }: { title?: string; className?: string }) {
  return (
    <Badge variant="demo" className={className} title={title ?? "Demo-only feature – see MOCKS.md"}>
      Demo
    </Badge>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 pb-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

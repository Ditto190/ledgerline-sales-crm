import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { EntityKind, Stage } from "@/domain/types";

export interface RecordRef {
  kind: EntityKind;
  id: string;
}
export interface FormRequest {
  kind: EntityKind;
  id?: string;
  defaults?: Record<string, unknown>;
}
export interface CloseRequest {
  id: string;
  stage: Extract<Stage, "won" | "lost">;
}

interface UIState {
  drawer: RecordRef | null;
  openDrawer: (r: RecordRef) => void;
  closeDrawer: () => void;
  form: FormRequest | null;
  openForm: (f: FormRequest) => void;
  closeForm: () => void;
  closeDeal: CloseRequest | null;
  requestClose: (c: CloseRequest | null) => void;
}

const Ctx = createContext<UIState | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState<RecordRef | null>(null);
  const [form, setForm] = useState<FormRequest | null>(null);
  const [closeDeal, setCloseDeal] = useState<CloseRequest | null>(null);
  const value = useMemo<UIState>(
    () => ({
      drawer,
      openDrawer: setDrawer,
      closeDrawer: () => setDrawer(null),
      form,
      openForm: setForm,
      closeForm: () => setForm(null),
      closeDeal,
      requestClose: setCloseDeal,
    }),
    [drawer, form, closeDeal],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUI must be used inside UIProvider");
  return v;
}

import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDb, useRepoMutation } from "@/data/hooks";
import type { CaptureInput, SourceType } from "@/domain/evidence";
import { DemoBadge, Field, NativeSelect } from "./fields";

export function SourceCapture({
  dealId,
  onCaptured,
}: {
  dealId?: string;
  onCaptured?: (id: string) => void;
}) {
  const db = useDb();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [type, setType] = useState<SourceType>("note");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [owner, setOwner] = useState(db.settings.owners[0]?.id ?? "");
  const [context, setContext] = useState(dealId ?? "");
  const [error, setError] = useState("");
  const capture = useRepoMutation((r, input: CaptureInput) => r.captureSource(input));
  const base = () => ({ ownerId: owner, ...(context ? { dealId: context } : {}) });
  const files = async (list: FileList | File[]) => {
    setError("");
    for (const file of Array.from(list)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !["txt", "md", "eml", "vtt"].includes(ext)) {
        setError(`${file.name}: Not supported in demo. Use .txt, .md, .eml or .vtt.`);
        continue;
      }
      if (file.size > 2_000_000) {
        setError(`${file.name}: File is too large for the local demo (2 MB maximum).`);
        continue;
      }
      try {
        const source = await capture.mutateAsync({
          ...base(),
          title: file.name,
          text: await file.text(),
          type: ext === "eml" ? "email" : ext === "vtt" ? "transcript" : "note",
          origin: file.name,
        });
        toast.success(
          source.duplicateOf
            ? "Exact duplicate detected — no actions created"
            : source.status === "failed"
              ? "Captured; processing needs attention"
              : "Evidence ready for review",
        );
        onCaptured?.(source.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read file");
      }
    }
  };
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <DemoBadge />
        <NativeSelect
          aria-label="Drop into deal"
          className="max-w-72"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        >
          <option value="">No explicit deal link</option>
          {db.opportunities.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Evidence owner"
          className="w-40"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          {db.settings.owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div
        role="region"
        aria-label="Evidence drop zone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void files(e.dataTransfer.files);
        }}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-4 ${dragging ? "border-primary bg-accent" : "bg-card"}`}
      >
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs font-medium">Drop notes, transcripts or emails</p>
            <p className="text-[11px] text-muted-foreground">.txt · .md · .eml · .vtt</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={capture.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3 w-3" />
            Choose files
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <FileText className="h-3 w-3" />
            Paste text
          </Button>
        </div>
        <input
          aria-label="Evidence files"
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void files(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {capture.isPending && (
        <p role="status" className="text-xs text-muted-foreground">
          Processing evidence…
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste evidence</DialogTitle>
          </DialogHeader>
          <Field label="Type">
            <NativeSelect
              aria-label="Source type"
              value={type}
              onChange={(e) => setType(e.target.value as SourceType)}
            >
              <option value="note">Note</option>
              <option value="transcript">Transcript</option>
              <option value="email">Email</option>
            </NativeSelect>
          </Field>
          <Field label="Title">
            <Input
              aria-label="Evidence title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Original text">
            <Textarea
              aria-label="Original text"
              className="min-h-56"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <Button
            disabled={!text.trim() || capture.isPending || !owner}
            onClick={async () => {
              const source = await capture.mutateAsync({
                ...base(),
                title,
                text,
                type,
                origin: "Pasted text",
              });
              setOpen(false);
              setText("");
              setTitle("");
              onCaptured?.(source.id);
              toast.success(
                source.duplicateOf ? "Exact duplicate — no new actions" : "Captured for review",
              );
            }}
          >
            Capture evidence
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

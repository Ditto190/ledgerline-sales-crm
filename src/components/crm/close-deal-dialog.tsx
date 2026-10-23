import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLookups, useRepoMutation } from "@/data/hooks";
import { Field } from "./fields";
import { useUI } from "./ui-state";

export function CloseDealDialog() {
  const { closeDeal, requestClose } = useUI();
  const { opportunity } = useLookups();
  const [reason, setReason] = useState("");
  const move = useRepoMutation((repo, a: { id: string; stage: "won" | "lost"; reason: string }) =>
    repo.moveOpportunity(a.id, a.stage, a.reason || null),
  );
  useEffect(() => setReason(""), [closeDeal]);
  if (!closeDeal) return null;
  const opp = opportunity.get(closeDeal.id);
  const won = closeDeal.stage === "won";
  return (
    <Dialog open onOpenChange={(o) => !o && requestClose(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Close as {won ? "won" : "lost"}</DialogTitle>
          <DialogDescription>{opp?.name}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            move.mutate(
              { id: closeDeal.id, stage: closeDeal.stage, reason },
              { onSuccess: () => requestClose(null) },
            );
          }}
          className="space-y-4"
        >
          <Field label={won ? "Why did we win?" : "Why did we lose?"}>
            <Input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={won ? "e.g. Best fit on support" : "e.g. Lost on price"}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => requestClose(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={won ? "default" : "destructive"}
              disabled={move.isPending}
            >
              Close as {won ? "won" : "lost"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

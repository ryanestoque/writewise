"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGradebookActions } from "@/lib/hooks/use-gradebook";
import { invalidateWorkQueries } from "@/lib/hooks/use-activity-work";
import { gradebookMutation } from "@/lib/gradebook/transport";
import type { components } from "@/types/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function GradebookBulkDialog({
  userId,
  activityId,
  studentIds,
  operation,
  open,
  onOpenChange,
  eligibleCount,
}: {
  userId: string;
  activityId: string;
  studentIds: string[];
  operation: "zero" | "excuse" | "release";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eligibleCount: number;
}) {
  const actions = useGradebookActions(userId);
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save() {
    setPending(true);
    setError("");
    try {
      if (operation === "release") {
        const result = await gradebookMutation<components["schemas"]["ReleaseActivityResponse"]>(
          userId,
          `/api/activities/${activityId}/release`,
          "POST",
          {}
        );
        setMessage(
          `${result.released_grade_count} grades and ${result.released_count} worksheet results released.`
        );
      } else {
        const result =
          operation === "zero"
            ? await actions.assignZeroMissing.mutateAsync({ activityId, studentIds })
            : await actions.excuseStudents.mutateAsync({ activityId, studentIds, excused: true });
        setMessage(
          `${result.changed_student_ids.length} changed; ${result.skipped_student_ids.length} skipped because their current work was not eligible.`
        );
      }
    } catch (failure) {
      if (!(failure instanceof Error && failure.name === "AbortError"))
        setError(
          failure instanceof Error ? failure.message : "Could not update the activity. Try again."
        );
    } finally {
      setPending(false);
      void client.invalidateQueries({ queryKey: ["gradebook", userId] });
      invalidateWorkQueries(client);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {operation === "zero"
              ? "Assign draft zeros to missing work?"
              : operation === "excuse"
                ? "Excuse selected work?"
                : "Release activity grades?"}
          </DialogTitle>
          <DialogDescription>
            {operation === "release"
              ? "Release all eligible grades and worksheet results for this activity across its assigned sections. This includes no-upload overrides. Excused work is skipped. A worksheet’s assessment is shared only when it is scored."
              : `${studentIds.length} ${studentIds.length === 1 ? "student" : "students"} selected. ${operation === "zero" ? "Only currently Missing work without an existing override receives a draft zero. Release it separately to share it with parents." : "Their work will leave both sides of the points total, and reminders will stop."}`}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          {eligibleCount} eligible when reviewed
          {operation === "release" ? " in this section" : ` of ${studentIds.length} selected`}.
          Eligibility is checked again when you confirm.
        </p>
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : (
          <Button
            disabled={pending || (operation !== "release" && !studentIds.length)}
            onClick={() => void save()}
          >
            {pending ? "Saving…" : "Confirm"}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
          {message ? "Done" : "Cancel"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

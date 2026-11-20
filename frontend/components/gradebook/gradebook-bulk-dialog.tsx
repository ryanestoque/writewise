"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function GradebookBulkDialog({
  userId,
  activityId,
  studentIds,
  operation,
  open,
  onOpenChange,
  eligibleCount,
  activityTitle,
  sectionName,
  totalSectionsCount = 1,
}: {
  userId: string;
  activityId: string;
  studentIds: string[];
  operation: "zero" | "excuse" | "release";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eligibleCount: number;
  activityTitle?: string;
  sectionName?: string;
  totalSectionsCount?: number;
}) {
  const actions = useGradebookActions(userId);
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [crossSectionAcknowledged, setCrossSectionAcknowledged] = useState(false);

  const isMultiSectionRelease = operation === "release" && totalSectionsCount > 1;

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

  const isConfirmDisabled =
    pending ||
    (operation !== "release" && !studentIds.length) ||
    (isMultiSectionRelease && !crossSectionAcknowledged);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {operation === "zero"
              ? "Mark uncollected work with draft zeros?"
              : operation === "excuse"
                ? "Excuse selected work?"
                : "Release activity grades to parents?"}
          </DialogTitle>
          <DialogDescription>
            {operation === "release"
              ? `Publish eligible grades and handwriting diagnostic feedback for ${activityTitle ? `"${activityTitle}"` : "this activity"} to parent portals.`
              : `${studentIds.length} ${studentIds.length === 1 ? "student" : "students"} selected. ${
                  operation === "zero"
                    ? "Only worksheets currently awaiting scan without an existing score will receive a draft zero. Saved changes stay draft until released to parents."
                    : "Their work will be excluded from both sides of the points total, and reminders will stop."
                }`}
          </DialogDescription>
        </DialogHeader>

        {operation === "release" && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-3.5 text-xs text-muted-foreground space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <AlertCircle className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>Activity-wide publication scope</span>
              </div>
              <p>
                In WriteWise, releasing an activity publishes ready results across{" "}
                <strong className="text-foreground">all assigned sections</strong>. Excused work is
                skipped, and unscored work remains draft.
              </p>
            </div>

            <p className="text-sm">
              <span className="font-semibold tabular-nums text-foreground">{eligibleCount}</span>{" "}
              {eligibleCount === 1 ? "grade is" : "grades are"} ready for release in{" "}
              <strong>{sectionName ?? "this section"}</strong>.
            </p>

            {isMultiSectionRelease && (
              <label
                htmlFor="ack-cross-section"
                className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-foreground cursor-pointer select-none"
              >
                <Checkbox
                  id="ack-cross-section"
                  checked={crossSectionAcknowledged}
                  onCheckedChange={(val) => setCrossSectionAcknowledged(Boolean(val))}
                  className="mt-0.5"
                />
                <span>
                  I understand that ready draft grades in my{" "}
                  <strong>other {totalSectionsCount - 1} sections</strong> assigned to this activity
                  will also be published to parents.
                </span>
              </label>
            )}
          </div>
        )}

        {operation !== "release" && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{eligibleCount}</span>{" "}
            eligible of {studentIds.length} selected. Eligibility is verified again when you
            confirm.
          </p>
        )}

        {message && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300"
          >
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border/40">
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {message ? "Close" : "Cancel"}
          </Button>
          {!message && (
            <Button disabled={isConfirmDisabled} onClick={() => void save()}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" />
                  Saving…
                </>
              ) : operation === "zero" ? (
                "Mark uncollected (0 pts)"
              ) : operation === "excuse" ? (
                "Excuse work"
              ) : (
                "Release grades to parents"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

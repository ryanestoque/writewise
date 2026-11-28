"use client";

import { memo, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { Submission } from "@/lib/hooks/use-submissions";
import type { Student } from "@/lib/hooks/use-students";
import { resolveSubmissionScore, getScoreBandLabel } from "@/lib/utils/submission-status";
import { cn } from "@/lib/utils";

export interface BatchReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  releasableSubmissions: Submission[];
  totalSelectedCount: number;
  students?: Student[];
  isReleasing: boolean;
  onConfirm: () => Promise<void> | void;
}

export const BatchReleaseDialog = memo(function BatchReleaseDialog({
  open,
  onOpenChange,
  releasableSubmissions,
  totalSelectedCount,
  students,
  isReleasing,
  onConfirm }: BatchReleaseDialogProps) {
  const studentMap = useMemo(() => {
    const map = new Map<string, string>();
    students?.forEach((s) => map.set(s.id, s.full_name));
    return map;
  }, [students]);

  const uniqueStudentCount = useMemo(() => {
    return new Set(releasableSubmissions.map((s) => s.student_id)).size;
  }, [releasableSubmissions]);

  // Calculate score band distribution across releasable items
  const bandCounts = useMemo(() => {
    const counts: Record<string, number> = {
      excellent: 0,
      satisfactory: 0,
      developing: 0,
      needs_improvement: 0 };

    releasableSubmissions.forEach((sub) => {
      const resolved = resolveSubmissionScore(sub);
      const band = resolved.scoreBand.band.toLowerCase();
      if (band.includes("excellent")) counts.excellent++;
      else if (band.includes("satisfactory")) counts.satisfactory++;
      else if (band.includes("developing")) counts.developing++;
      else counts.needs_improvement++;
    });

    return counts;
  }, [releasableSubmissions]);

  const unreleasedCount = totalSelectedCount - releasableSubmissions.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg p-6 bg-card border-border shadow-warm-lg">
        <AlertDialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <AlertDialogTitle className="font-heading text-lg font-semibold text-foreground">
                Release Worksheets to Parents
              </AlertDialogTitle>
              <p className="text-xs text-muted-foreground">
                Publish finalized handwriting diagnostics to the Parent Portal
              </p>
            </div>
          </div>
          <AlertDialogDescription className="text-sm text-foreground/80 leading-relaxed pt-1">
            Releasing will make the calibrated cursive scores, letter formation evaluations, and visual feedback overlays immediately visible to parents of these students.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Impact Metric Chips */}
        <div className="my-3 grid grid-cols-2 gap-2.5 rounded-lg border border-border/80 bg-muted/40 p-3">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Students Impacted
            </span>
            <span className="font-heading text-lg font-bold text-foreground tabular-nums">
              {uniqueStudentCount} {uniqueStudentCount === 1 ? "Student" : "Students"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Worksheets Releasing
            </span>
            <span className="font-heading text-lg font-bold text-brand-700 dark:text-brand-400 tabular-nums">
              {releasableSubmissions.length} {releasableSubmissions.length === 1 ? "Worksheet" : "Worksheets"}
            </span>
          </div>
        </div>

        {/* Grade Distribution Overview */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Grade Band Breakdown
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {bandCounts.excellent > 0 && (
              <Badge variant="outline" className="bg-band-4/15 text-band-4-text border-band-4/30 font-medium text-xs py-0.5">
                {bandCounts.excellent} Excellent
              </Badge>
            )}
            {bandCounts.satisfactory > 0 && (
              <Badge variant="outline" className="bg-band-3/15 text-band-3-text border-band-3/30 font-medium text-xs py-0.5">
                {bandCounts.satisfactory} Satisfactory
              </Badge>
            )}
            {bandCounts.developing > 0 && (
              <Badge variant="outline" className="bg-band-2/15 text-band-2-text border-band-2/30 font-medium text-xs py-0.5">
                {bandCounts.developing} Developing
              </Badge>
            )}
            {bandCounts.needs_improvement > 0 && (
              <Badge variant="outline" className="bg-band-1/15 text-band-1-text border-band-1/30 font-medium text-xs py-0.5">
                {bandCounts.needs_improvement} Needs Support
              </Badge>
            )}
          </div>
        </div>

        {/* Scrollable Student Roster Preview */}
        <div className="mt-2.5">
          <div className="text-xs font-medium text-muted-foreground mb-1.5">
            Roster Preview
          </div>
          <div
            role="region"
            aria-label="Students receiving published worksheets"
            tabIndex={0}
            className="max-h-36 overflow-y-auto rounded-md border border-border/70 bg-background/50 divide-y divide-border/60 p-1 text-xs"
          >
            {releasableSubmissions.map((sub) => {
              const studentName = studentMap.get(sub.student_id) || "Student";
              const score = resolveSubmissionScore(sub);
              const band = getScoreBandLabel(score.compositeScore);
              return (
                <div key={sub.id} className="flex items-center justify-between py-1.5 px-2">
                  <span className="font-medium text-foreground truncate max-w-[200px]">
                    {studentName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {score.compositeScore !== null && (
                      <span className="text-muted-foreground tabular-nums font-mono text-[11px]">
                        {Math.round(score.compositeScore)}%
                      </span>
                    )}
                    <span className={cn("text-[11px] font-medium px-1.5 py-0.5 rounded", band.className)}>
                      {band.band}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Warning if some items were excluded from release */}
        {unreleasedCount > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden="true" />
            <span>
              <strong>{unreleasedCount} {unreleasedCount === 1 ? "item" : "items"}</strong> in your selection cannot be released (already released or pending rubric grading) and will remain unchanged.
            </span>
          </div>
        )}

        <AlertDialogFooter className="mt-5 flex items-center justify-end gap-2">
          <AlertDialogCancel
            disabled={isReleasing}
            className="rounded-full text-xs font-medium min-h-10 px-4"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isReleasing || releasableSubmissions.length === 0}
            className="rounded-full bg-brand-700 hover:bg-brand-800 text-white font-semibold text-xs min-h-10 px-5 gap-1.5 cursor-pointer shadow-xs"
          >
            {isReleasing ? (
              <>
                <Spinner className="size-3.5" />
                <span>Releasing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                <span>Confirm Release ({releasableSubmissions.length})</span>
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});
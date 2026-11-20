"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  CheckCircle2,
  AlertCircle,
  Check,
} from "lucide-react";
import { useGradebookActions, type GradebookCell } from "@/lib/hooks/use-gradebook";
import { ApiError } from "@/lib/utils/api-error";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { PointsField, validPointsInput } from "./points-field";
import { WorkGradeDetails } from "./work-grade-details";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SubmissionCommentPicker } from "@/components/comments/submission-comment-picker";
import { BandBadge } from "@/components/shared/band-badge";
import {
  CRITERIA_DEFINITIONS,
  getCriterionDiagnostic,
  getPedagogicalSummary,
} from "./gradebook-cell";
import { cn } from "@/lib/utils";

export function WorkGradeSheet({
  userId,
  cell,
  open,
  onOpenChange,
  studentName,
  activityTitle,
  initialView = "work",
  hasPrevStudent = false,
  hasNextStudent = false,
  onNavigateStudent,
}: {
  userId: string;
  cell: GradebookCell | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName?: string;
  activityTitle?: string;
  initialView?: "work" | "comments";
  hasPrevStudent?: boolean;
  hasNextStudent?: boolean;
  onNavigateStudent?: (direction: "prev" | "next") => void;
}) {
  const actions = useGradebookActions(userId);
  const currentKey = `${cell?.student_id}:${cell?.activity_id}:${cell?.points_override}`;
  const [prevKey, setPrevKey] = useState(currentKey);
  const [override, setOverride] = useState(cell?.points_override ?? "");
  const [error, setError] = useState<string | undefined>();
  const [view, setView] = useState<"work" | "comments">(initialView);
  const [confirmZero, setConfirmZero] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);

  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setOverride(cell?.points_override ?? "");
    setError(undefined);
    setConfirmZero(false);
    setSavedDraft(false);
  }

  useEffect(() => {
    if (!open || !onNavigateStudent) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "j" || event.key === "J") {
        if (hasPrevStudent) {
          event.preventDefault();
          onNavigateStudent?.("prev");
        }
      } else if (event.key === "ArrowRight" || event.key === "k" || event.key === "K") {
        if (hasNextStudent) {
          event.preventDefault();
          onNavigateStudent?.("next");
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onNavigateStudent, hasPrevStudent, hasNextStudent]);

  if (!cell) return null;
  const target = { activityId: cell.activity_id, studentId: cell.student_id };
  const excused = cell.coursework_status === "Excused";
  const valid = validPointsInput(override, true, Number(cell.points_possible));
  const pending = Object.values(actions).some((action) => action.isPending);

  const compositeScore =
    cell.assessment_composite !== null ? Number(cell.assessment_composite) : null;
  const pedagogicalSummary = getPedagogicalSummary(compositeScore, cell.coursework_status);

  async function run(task: () => Promise<unknown>, message: string, shouldClose = false) {
    setError(undefined);
    try {
      await task();
      toast.success(message);
      if (shouldClose) {
        onOpenChange(false);
      } else {
        setSavedDraft(true);
      }
    } catch (failure) {
      if (failure instanceof Error && failure.name === "AbortError") return;
      setError(
        failure instanceof ApiError && failure.code === "GRADE_REVISION_CONFLICT"
          ? "This grade changed in another session. Close this panel and reopen to refresh."
          : failure instanceof ApiError
            ? failure.message
            : "Could not save this work. Try again."
      );
    }
  }

  const update = (
    body: Parameters<typeof actions.updateWork.mutateAsync>[0]["body"],
    message: string
  ) => run(() => actions.updateWork.mutateAsync({ ...target, body }), message, false);

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <SheetContent className="w-full overflow-hidden sm:max-w-lg">
        <SheetHeader className="pb-3 border-b border-border/40">
          <div className="flex items-start justify-between gap-2 pr-6">
            <div className="space-y-1 min-w-0">
              <SheetTitle className="text-lg font-heading truncate">
                {studentName ?? "Work grade"}
              </SheetTitle>
              {activityTitle && (
                <p className="text-xs font-medium text-muted-foreground line-clamp-2">
                  Activity: <span className="text-foreground italic">“{activityTitle}”</span>
                </p>
              )}
            </div>
            {onNavigateStudent && (hasPrevStudent || hasNextStudent) && (
              <div className="flex items-center gap-1 shrink-0 pt-0.5" aria-label="Student navigation">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={!hasPrevStudent || pending}
                  onClick={() => onNavigateStudent("prev")}
                  title="Previous student (Left arrow or J)"
                  aria-label="Previous student"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={!hasNextStudent || pending}
                  onClick={() => onNavigateStudent("next")}
                  title="Next student (Right arrow or K)"
                  aria-label="Next student"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <SheetDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            {cell.points_possible !== null
              ? "Saved point overrides stay in draft until released to parents. Handwriting assessment is managed separately."
              : "This activity evaluates cursive handwriting quality via developmental bands. Diagnostic feedback is shared with parents."}
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={view}
          onValueChange={(value) => {
            if (!pending) setView(value as "work" | "comments");
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-4 mt-3 shrink-0">
            <TabsTrigger value="work" disabled={pending}>
              Work
            </TabsTrigger>
            <TabsTrigger value="comments" disabled={pending}>
              Comments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="flex min-h-0 flex-1 flex-col">
            {open && view === "comments" && (
              <SubmissionCommentPicker
                key={`${userId}:${cell.activity_id}:${cell.student_id}`}
                userId={userId}
                scope={target}
                activeSubmissionId={cell.active_submission_id}
                open
              />
            )}
          </TabsContent>

          <TabsContent value="work" className="overflow-y-auto">
            <div className="space-y-5 px-4 py-4">
              {/* Handwriting Diagnostic Overview Card */}
              <div className="rounded-xl border border-border/70 bg-gradient-to-br from-card to-muted/20 p-4 space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Handwriting Assessment
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <BandBadge score={compositeScore} size="default" />
                      {compositeScore !== null && (
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {Math.round(compositeScore)}%
                        </span>
                      )}
                    </div>
                  </div>
                  {cell.active_submission_id && (
                    <Link
                      href={`/activities/${cell.activity_id}/submissions/${cell.active_submission_id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <FileText className="size-3.5" />
                      <span>View worksheet</span>
                      <ExternalLink className="size-3 opacity-70" />
                    </Link>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {pedagogicalSummary}
                </p>

                {/* 5-Criteria Quick Rhythm Breakdown */}
                <div className="pt-2 border-t border-border/40">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                    5 Core Cursive Criteria
                  </p>
                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    {CRITERIA_DEFINITIONS.map((crit) => {
                      const diag = getCriterionDiagnostic(crit.label, compositeScore);
                      return (
                        <div
                          key={crit.key}
                          className={cn(
                            "rounded-md px-1 py-1 text-xs font-medium transition-colors border",
                            diag.chipClass
                          )}
                          title={`${crit.name}: ${diag.diagnosticNote}`}
                        >
                          <span className="block font-bold">{crit.label}</span>
                          <span className="block text-[10px] opacity-80 truncate">
                            {crit.name.split(" ")[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Status & Visibility Overview */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Status & Visibility
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Worksheet Submission */}
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-1">
                    <span className="text-muted-foreground block font-medium">
                      Worksheet Submission
                    </span>
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      {cell.coursework_status === "Released" ? (
                        <>
                          <CheckCircle2 className="size-3.5 text-band-4-text shrink-0" />
                          <span>Shared with parents</span>
                        </>
                      ) : cell.coursework_status === "Missing" ? (
                        <>
                          <span className="size-2 rounded-full bg-muted-foreground/50 shrink-0" />
                          <span className="text-muted-foreground font-normal">Awaiting scan</span>
                        </>
                      ) : (
                        <>
                          <span className="size-2 rounded-full bg-band-2 shrink-0" />
                          <span>{cell.coursework_status}</span>
                        </>
                      )}
                      {cell.late && <span className="text-destructive font-normal">· Late</span>}
                    </div>
                  </div>

                  {/* Coursework Grade Visibility */}
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-1">
                    <span className="text-muted-foreground block font-medium">
                      {cell.points_possible !== null ? "Coursework Grade" : "Grading Mode"}
                    </span>
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      {cell.points_possible === null ? (
                        <span className="text-muted-foreground font-normal">
                          Assessment bands only
                        </span>
                      ) : cell.publication === "released" ? (
                        <>
                          <CheckCircle2 className="size-3.5 text-band-4-text shrink-0" />
                          <span>Released to parents</span>
                        </>
                      ) : (
                        <>
                          <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                          <span>Draft (Teacher only)</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Coursework Points Section (Only when points_possible !== null) */}
              {cell.points_possible !== null ? (
                <section
                  className="space-y-4 pt-4 border-t border-border/40"
                  aria-label="Coursework grading"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-sm font-semibold text-foreground">
                      Coursework Points
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Current:</span>
                      <span className="font-bold tabular-nums text-foreground">
                        {cell.final_points ?? "No grade"} / {cell.points_possible} pts
                      </span>
                    </div>
                  </div>

                  <form
                    className="space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!valid) {
                        setError(
                          `Enter points from 0 to ${cell.points_possible}, with up to two decimal places.`
                        );
                        return;
                      }
                      void update({ points_override: override }, "Override saved as draft.");
                    }}
                  >
                    <PointsField
                      value={override}
                      onChange={(val) => {
                        setOverride(val);
                        setError(undefined);
                        setSavedDraft(false);
                      }}
                      error={error}
                      label="Teacher point override"
                      disabled={pending}
                      hint={`Use 0 to ${cell.points_possible} points. An override persists across new attempts until cleared.`}
                    />

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button type="submit" size="sm" disabled={pending || !valid}>
                        {savedDraft ? (
                          <>
                            <Check className="size-3.5 mr-1 text-emerald-400" />
                            Saved
                          </>
                        ) : (
                          "Save override"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending || cell.points_override === null}
                        onClick={() => {
                          setOverride("");
                          void update(
                            { points_override: null },
                            "Override cleared. Restored automatic grade."
                          );
                        }}
                      >
                        Clear override
                      </Button>

                      {confirmZero ? (
                        <div className="inline-flex items-center gap-1.5 p-1 rounded-md bg-destructive/10 border border-destructive/20 text-xs">
                          <span className="text-destructive font-medium">Set 0 pts?</span>
                          <Button
                            type="button"
                            variant="destructive"
                            size="xs"
                            disabled={pending}
                            onClick={() => {
                              setConfirmZero(false);
                              setOverride("0");
                              void update({ points_override: "0" }, "Zero saved as draft.");
                            }}
                          >
                            Confirm 0
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => setConfirmZero(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => setConfirmZero(true)}
                        >
                          Mark uncollected (0 pts)
                        </Button>
                      )}
                    </div>
                  </form>

                  <div className="pt-2">
                    <Button
                      className="w-full"
                      disabled={
                        pending ||
                        excused ||
                        cell.final_points === null ||
                        cell.grade_revision === null ||
                        cell.publication === "released"
                      }
                      onClick={() =>
                        void run(
                          () =>
                            actions.releaseGrade.mutateAsync({
                              ...target,
                              revision: cell.grade_revision!,
                            }),
                          "Grade released to parents.",
                          true
                        )
                      }
                    >
                      {pending
                        ? "Releasing…"
                        : cell.publication === "released"
                          ? "Grade already released to parents"
                          : "Release grade to parents"}
                    </Button>
                    {cell.publication !== "released" && cell.final_points !== null && (
                      <p className="text-xs text-muted-foreground text-center mt-1.5">
                        Publishes this numerical grade to the parent portal.
                      </p>
                    )}
                  </div>
                </section>
              ) : (
                <div className="pt-4 border-t border-border/40 space-y-2">
                  <div className="rounded-lg border border-border/50 bg-muted/15 p-3.5 text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Assessment Bands Only</p>
                    <p className="text-xs leading-relaxed">
                      This activity evaluates handwriting quality without numerical scores. To grade
                      coursework numerically, assign points in Activity Settings.
                    </p>
                  </div>
                </div>
              )}

              {/* Submission Lifecycle & Exceptions */}
              <details className="group rounded-xl border border-border/60 bg-muted/15 p-4 text-sm transition-colors open:bg-muted/25">
                <summary className="flex cursor-pointer items-center justify-between font-medium text-foreground select-none">
                  <div className="flex items-center gap-2">
                    <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                    <span>Submission lifecycle & exceptions</span>
                  </div>
                  <span className="text-xs text-muted-foreground group-open:hidden">
                    Deadlines, attempts, excuse
                  </span>
                </summary>
                <div className="mt-3.5 space-y-4 pt-3 border-t border-border/50">
                  <div className="space-y-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        void update(
                          { excused: !excused },
                          excused
                            ? "Work unexcused. Review its draft grade."
                            : "Work excused and excluded from class totals."
                        )
                      }
                    >
                      {excused ? "Unexcuse work" : "Excuse work"}
                    </Button>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Excused work is removed from both earned and possible points, and reminders stop.
                    </p>
                  </div>

                  {open && <WorkGradeDetails userId={userId} cell={cell} studentName={studentName} />}
                </div>
              </details>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2"
                >
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

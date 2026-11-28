"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "@/components/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  CheckCircle2,
  Check,
  Camera,
  RotateCcw,
} from "lucide-react";
import { useGradebookActions, type GradebookCell } from "@/lib/hooks/use-gradebook";
import { ApiError } from "@/lib/utils/api-error";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useTeacherModals } from "@/components/teacher-modals-provider";
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
import { getBandFromScore, PARENT_BAND_EXPLANATIONS } from "@/lib/utils/scoring";
import { CRITERIA_DEFINITIONS } from "./gradebook-cell";

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
  const client = useQueryClient();
  const { openUpload } = useTeacherModals();
  const currentKey = `${cell?.student_id}:${cell?.activity_id}`;
  const [prevKey, setPrevKey] = useState(currentKey);
  const [override, setOverride] = useState(
    cell?.points_override !== null && cell?.points_override !== undefined
      ? String(cell.points_override)
      : ""
  );
  const [error, setError] = useState<string | undefined>();
  const [view, setView] = useState<"work" | "comments">(initialView);
  const [confirmZero, setConfirmZero] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const [showLifecycleDetails, setShowLifecycleDetails] = useState(false);

  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setOverride(
      cell?.points_override !== null && cell?.points_override !== undefined
        ? String(cell.points_override)
        : ""
    );
    setError(undefined);
    setConfirmZero(false);
    setConfirmRelease(false);
    setSavedDraft(false);
  }

  useEffect(() => {
    if (!open || !onNavigateStudent) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      )
        return;

      if (event.key === "ArrowLeft" || event.key === "k" || event.key === "K") {
        if (hasPrevStudent) {
          event.preventDefault();
          onNavigateStudent?.("prev");
        }
      } else if (event.key === "ArrowRight" || event.key === "j" || event.key === "J") {
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
  const compositeBand = compositeScore !== null ? getBandFromScore(compositeScore) : null;
  const developmentalNote =
    compositeBand !== null
      ? PARENT_BAND_EXPLANATIONS[compositeBand]
      : cell.coursework_status === "Missing"
        ? "Awaiting worksheet upload and scan."
        : "No assessment recorded for this attempt.";

  const savedOverrideStr =
    cell.points_override !== null && cell.points_override !== undefined
      ? String(cell.points_override)
      : "";
  const isOverrideDirty = override.trim() !== savedOverrideStr;

  async function run(task: () => Promise<unknown>, message: string, shouldClose = false) {
    setError(undefined);
    try {
      await task();
      toast.add({ type: "success", title: message });
      if (shouldClose) {
        onOpenChange(false);
      } else {
        setSavedDraft(true);
      }
    } catch (failure) {
      if (failure instanceof Error && failure.name === "AbortError") return;
      setError(
        failure instanceof ApiError && failure.code === "GRADE_REVISION_CONFLICT"
          ? "This grade changed in another session. Please refresh grade data to continue."
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

  async function handleRefreshGrade() {
    setError(undefined);
    await client.invalidateQueries({ queryKey: ["gradebook", userId] });
    toast.add({ type: "success", title: "Grade data refreshed" });
  }

  async function handleReleaseGrade() {
    if (!cell || cell.grade_revision === null) return;
    try {
      await run(
        () =>
          actions.releaseGrade.mutateAsync({
            ...target,
            revision: cell.grade_revision!,
          }),
        "Grade released to parents.",
        true
      );
    } finally {
      setConfirmRelease(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <SheetContent className="w-full overflow-hidden sm:max-w-lg">
        <SheetHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 pr-14">
            <div className="flex flex-col gap-1 min-w-0">
              <SheetTitle className="text-lg font-heading truncate">
                {studentName ?? "Work grade"}
              </SheetTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {activityTitle && (
                  <p className="text-xs font-medium text-muted-foreground line-clamp-1">
                    Activity: <span className="text-foreground italic">“{activityTitle}”</span>
                  </p>
                )}
                {cell.points_possible === null && (
                  <Badge variant="secondary" className="text-xs font-normal py-0">
                    Bands only
                  </Badge>
                )}
              </div>
            </div>
            {onNavigateStudent && (hasPrevStudent || hasNextStudent) && (
              <div className="flex items-center gap-1 shrink-0 pt-0.5" aria-label="Student navigation">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!hasPrevStudent || pending}
                  onClick={() => onNavigateStudent("prev")}
                  title="Previous student (Left arrow or K)"
                  aria-label="Previous student"
                  className="size-10 sm:size-9"
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!hasNextStudent || pending}
                  onClick={() => onNavigateStudent("next")}
                  title="Next student (Right arrow or J)"
                  aria-label="Next student"
                  className="size-10 sm:size-9"
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
          <SheetDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            {cell.points_possible !== null
              ? "Saved point overrides stay in draft until released to parents. Handwriting assessment is managed separately."
              : "Evaluates cursive penmanship quality across 5 developmental criteria. Diagnostic feedback is shared with parents."}
          </SheetDescription>
        </SheetHeader>
        <Separator className="bg-border/40" />

        <Tabs
          value={view}
          onValueChange={(value) => {
            if (!pending) setView(value as "work" | "comments");
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-4 mt-3 shrink-0">
            <TabsTrigger value="work" disabled={pending} className="min-h-10 sm:min-h-9">
              Work
            </TabsTrigger>
            <TabsTrigger value="comments" disabled={pending} className="min-h-10 sm:min-h-9">
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
            <div className="flex flex-col gap-4 px-4 py-4">
              {/* Handwriting Diagnostic Overview Card */}
              <Card size="sm">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Handwriting Assessment
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <BandBadge score={compositeScore} size="default" />
                        {compositeScore !== null && (
                          <span className="text-sm font-semibold tabular-nums text-foreground">
                            {Math.round(compositeScore)}%
                          </span>
                        )}
                        {cell.assessment_source && (
                          <Badge variant="outline">
                            {cell.assessment_source === "manual" ? "Teacher rubric" : "Calibrated"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {cell.active_submission_id ? (
                      <Button
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                        className="min-h-10 sm:min-h-8 shrink-0 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                        render={
                          <Link
                            href={`/activities/${cell.activity_id}/submissions/${cell.active_submission_id}`}
                          />
                        }
                      >
                        <FileText data-icon="inline-start" aria-hidden="true" />
                        <span>View worksheet</span>
                        <ExternalLink data-icon="inline-end" className="opacity-70" aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        className="h-10 sm:h-9 cursor-pointer"
                        onClick={() =>
                          openUpload({
                            activityId: cell.activity_id,
                            studentId: cell.student_id,
                          })
                        }
                      >
                        <Camera data-icon="inline-start" aria-hidden="true" />
                        <span>Scan / Upload</span>
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {developmentalNote}
                  </p>

                  <Separator className="bg-border/40" />

                  {/* 5-Criteria Authentic Breakdown Note */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">5 Diagnostic Criteria:</span>
                      <span className="text-xs">
                        {CRITERIA_DEFINITIONS.map((c) => c.name.split(" ")[0]).join(" · ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Per-criterion stroke measurements, baseline drift, and visual overlays are calibrated and inspected in the worksheet viewer.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Status & Quick Action Card */}
              <Card size="sm" className="bg-muted/15">
                <CardContent className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Worksheet:</span>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      {cell.coursework_status === "Released" ? (
                        <>
                          <CheckCircle2 className="size-3.5 text-band-4-text shrink-0" aria-hidden="true" />
                          <span>Released to parents</span>
                        </>
                      ) : cell.coursework_status === "Missing" ? (
                        <>
                          <span className="size-2 rounded-full bg-muted-foreground/50 shrink-0" aria-hidden="true" />
                          <span className="text-muted-foreground font-normal">Awaiting scan</span>
                        </>
                      ) : (
                        <>
                          <span className="size-2 rounded-full bg-band-2 shrink-0" aria-hidden="true" />
                          <span>{cell.coursework_status}</span>
                        </>
                      )}
                      {cell.late && (
                        <Badge
                          variant="outline"
                          className="border-band-2/30 bg-band-2/15 text-band-2-text"
                        >
                          Late
                        </Badge>
                      )}
                    </div>
                  </div>

                  {cell.points_possible !== null && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>Grade:</span>
                      <span className="font-semibold text-foreground">
                        {cell.publication === "released" ? "Released" : "Draft"}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Coursework Points Section (Only when points_possible !== null) */}
              {cell.points_possible !== null ? (
                <section
                  className="flex flex-col gap-4"
                  aria-label="Coursework grading"
                >
                  <Separator className="bg-border/40" />
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-heading text-sm font-semibold text-foreground">
                        Coursework Points
                      </h3>
                      {cell.grade_revision !== null && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Revision #{cell.grade_revision}
                          {cell.points_override !== null ? " · Overridden by teacher" : " · From rubric"}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">
                        Automatic:{" "}
                        <strong className="font-semibold text-foreground tabular-nums">
                          {cell.automatic_points !== null ? `${cell.automatic_points} pts` : "—"}
                        </strong>
                      </span>
                      <span className="text-muted-foreground">
                        Current:{" "}
                        <strong className="font-semibold tabular-nums text-foreground">
                          {cell.final_points ?? "—"} / {cell.points_possible} pts
                        </strong>
                      </span>
                    </div>
                  </div>

                  <form
                    className="flex flex-col gap-3"
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
                      <Button type="submit" size="sm" className="min-h-10 sm:min-h-9" disabled={pending || !valid}>
                        {savedDraft ? (
                          <>
                            <Check data-icon="inline-start" aria-hidden="true" />
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
                        className="min-h-10 sm:min-h-9"
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

                      <AlertDialog open={confirmZero} onOpenChange={setConfirmZero}>
                        <AlertDialogTrigger
                          render={
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-10 sm:min-h-9"
                              disabled={pending}
                            />
                          }
                        >
                          Mark uncollected (0 pts)
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Mark uncollected (0 pts)?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This saves a draft score of 0 / {cell.points_possible} points for{" "}
                              {studentName ?? "this student"}. It stays hidden from parents until
                              released.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={pending}
                              onClick={() => {
                                setConfirmZero(false);
                                setOverride("0");
                                void update({ points_override: "0" }, "Zero saved as draft.");
                              }}
                            >
                              Confirm 0 pts
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </form>

                  {/* Conflict Recovery */}
                  {error && error.includes("refresh grade data") && (
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs min-h-10 sm:min-h-9"
                        onClick={() => void handleRefreshGrade()}
                      >
                        <RotateCcw data-icon="inline-start" aria-hidden="true" />
                        <span>Refresh grade data</span>
                      </Button>
                    </div>
                  )}

                  {/* Release to Parents Confirmation & Trigger */}
                  <div className="flex flex-col gap-2 pt-2">
                    {isOverrideDirty && (
                      <Alert className="border-band-2/30 bg-band-2/10 text-band-2-text *:data-[slot=alert-description]:text-band-2-text">
                        <AlertCircle aria-hidden="true" />
                        <AlertDescription className="text-xs">
                          Save or discard your pending point override before releasing to parents.
                        </AlertDescription>
                      </Alert>
                    )}

                    <AlertDialog
                      open={confirmRelease}
                      onOpenChange={(value) => {
                        if (!pending) setConfirmRelease(value);
                      }}
                    >
                      <AlertDialogTrigger
                        render={
                          <Button
                            type="button"
                            className="w-full min-h-10 sm:min-h-9"
                            disabled={
                              pending ||
                              excused ||
                              cell.final_points === null ||
                              cell.grade_revision === null ||
                              cell.publication === "released" ||
                              isOverrideDirty
                            }
                          />
                        }
                      >
                        {pending ? (
                          <>
                            <Spinner data-icon="inline-start" aria-hidden="true" />
                            <span>Releasing…</span>
                          </>
                        ) : cell.publication === "released" ? (
                          "Grade already released to parents"
                        ) : (
                          "Release grade to parents"
                        )}
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Release grade to parents?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Confirm releasing{" "}
                            <strong className="text-foreground">
                              {cell.final_points} / {cell.points_possible} pts
                            </strong>{" "}
                            (Revision #{cell.grade_revision}) for {studentName ?? "this student"}.
                            This publishes the final point score directly to the parent portal.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={pending}
                            onClick={() => void handleReleaseGrade()}
                          >
                            {pending ? (
                              <>
                                <Spinner data-icon="inline-start" aria-hidden="true" />
                                <span>Releasing…</span>
                              </>
                            ) : (
                              "Confirm Release"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    {cell.publication !== "released" && cell.final_points !== null && !isOverrideDirty && (
                      <p className="text-xs text-muted-foreground text-center">
                        Publishes this numerical grade to the parent portal.
                      </p>
                    )}
                  </div>
                </section>
              ) : null}

              {/* Submission Lifecycle & Exceptions */}
              <Collapsible
                open={showLifecycleDetails}
                onOpenChange={setShowLifecycleDetails}
                className={cn(
                  "rounded-xl border border-border/60 bg-muted/15 p-4 text-sm transition-colors",
                  showLifecycleDetails && "bg-muted/25"
                )}
              >
                <CollapsibleTrigger
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between font-medium text-foreground min-h-10 sm:min-h-9 select-none rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring [&[data-panel-open]>svg]:rotate-180"
                >
                  <span>Submission lifecycle &amp; exceptions</span>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transform-none motion-reduce:transition-none" aria-hidden="true" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  {showLifecycleDetails && (
                    <WorkGradeDetails
                      key={`${userId}:${cell.activity_id}:${cell.student_id}`}
                      userId={userId}
                      cell={cell}
                      studentName={studentName}
                    />
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

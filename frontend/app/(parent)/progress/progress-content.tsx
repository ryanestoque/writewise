"use client";

import { useState, useCallback } from "react";
import { useParentPortal } from "@/components/parent-portal-provider";
import { LatestSubmissionCard } from "@/components/parent/latest-submission-card";
import { TakeHomeActivities } from "@/components/parent/take-home-activities";
import { CriterionTrendChart } from "@/components/dashboard/criterion-trend-chart";
import { ParentRubricDialog } from "@/components/parent/parent-rubric-dialog";
import { SubmissionHistoryDialog } from "@/components/parent/submission-history-dialog";
import {
  useChildScoreHistory,
  useTakeHomeActivities,
} from "@/lib/hooks/use-parent-data";
import { Button } from "@/components/ui/button";
import { BandBadge } from "@/components/shared/band-badge";
import {
  FileText,
  LineChart,
  ClipboardList,
  Loader2,
  UserX,
  BookOpen,
  Info,
  History,
  GraduationCap,
  ArrowRight,
  PenTool,
  Award,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

export function ProgressPageContent() {
  const [rubricOpen, setRubricOpen] = useState(false);
  const [rubricCriterion, setRubricCriterion] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const {
    selectedChildId,
    selectedChild,
    isLoading: childrenLoading,
    openUploadDialog,
  } = useParentPortal();

  const handleOpenRubric = useCallback((criterionKey?: string | null) => {
    setRubricCriterion(criterionKey ?? null);
    setRubricOpen(true);
  }, []);

  const handleUploadActivity = useCallback(
    (activityId: string) => {
      openUploadDialog(activityId);
    },
    [openUploadDialog]
  );

  const { data: history, isLoading: historyLoading } =
    useChildScoreHistory(selectedChildId);
  const { data: activities } =
    useTakeHomeActivities(selectedChildId);

  if (childrenLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="size-8 animate-spin text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Loading child profile...</p>
      </div>
    );
  }

  if (!selectedChild) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 rounded-2xl border border-border bg-card shadow-warm text-center space-y-3">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <UserX className="size-6" aria-hidden="true" />
          </div>
        </div>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          No Linked Student Record
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          No student profile is currently linked to your parent account. Please check with your child&apos;s teacher to verify your invitation.
        </p>
      </div>
    );
  }

  const historyCount = history?.length ?? 0;
  const isZeroState = !historyLoading && historyCount === 0;
  const pendingActivitiesCount =
    activities?.filter(
      (a) => !a.submission || a.submission.status === "rejected"
    ).length ?? 0;

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Zone 1: Child Header & Quick Guides */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-heading font-bold text-lg border border-brand-200/60 dark:border-brand-800/60 shadow-xs shrink-0 select-none"
          >
            {selectedChild.fullName.charAt(0)}
          </div>
          <div className="space-y-0.5 min-w-0">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              {selectedChild.fullName}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">
              Section <span className="text-foreground font-semibold">{selectedChild.section}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {historyCount >= 1 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryOpen(true)}
                aria-haspopup="dialog"
                className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] gap-1.5 text-xs font-medium border-border/80 hover:bg-muted/50 cursor-pointer"
              >
                <History className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span>All Worksheets ({historyCount})</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenRubric(null)}
                aria-haspopup="dialog"
                className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] gap-1.5 text-xs font-medium border-border/80 hover:bg-muted/50 cursor-pointer"
              >
                <BookOpen className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span>Handwriting Guide &amp; Scoring</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {isZeroState ? (
        /* Day-One Welcoming Onboarding Experience */
        <div className="space-y-6">
          {/* Active Homework Alert Banner when activities need upload */}
          {pendingActivitiesCount > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-brand-300/80 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-950/40 text-brand-950 dark:text-brand-100 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-9 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 shrink-0">
                  <ClipboardList className="size-4.5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold truncate">
                    {pendingActivitiesCount} Take-Home {pendingActivitiesCount === 1 ? "Worksheet" : "Worksheets"} Ready for Practice
                  </p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                    Complete on paper, snap a flat photo, and upload to receive handwriting feedback.
                  </p>
                </div>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const firstPending = activities?.find(
                    (a) => !a.submission || a.submission.status === "rejected"
                  );
                  if (firstPending) {
                    handleUploadActivity(firstPending.id);
                  }
                }}
                className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] px-3.5 text-xs font-medium shrink-0 cursor-pointer shadow-xs gap-1.5 self-start sm:self-auto"
              >
                <span>Upload Practice</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          )}

          {/* Welcome & How It Works Guide Hub */}
          <div className="rounded-2xl border border-border bg-card shadow-warm p-5 sm:p-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0 mt-0.5">
                  <GraduationCap className="size-6" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-heading text-lg sm:text-xl font-bold text-foreground">
                    Welcome to {selectedChild.fullName}&apos;s Cursive Journey
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    WriteWise measures handwriting worksheets across five essential cursive skills. Explore the handwriting guide to see what your child will learn and how you can practice together at home.
                  </p>
                </div>
              </div>

              <Button
                variant="default"
                size="sm"
                onClick={() => handleOpenRubric(null)}
                aria-haspopup="dialog"
                className="self-start sm:self-center h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs font-medium gap-1.5 shrink-0 cursor-pointer shadow-xs"
              >
                <span>Explore Handwriting Guide &amp; Rubrics</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>

            {/* Assessment Workflow Walkthrough - Flat Stepper */}
            <div className="pt-4 border-t border-border/60 space-y-3">
              <h3 className="text-xs font-semibold text-foreground">
                How It Works
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-bold shrink-0 mt-0.5">
                    1
                  </span>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">Classroom Worksheets</span>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      Worksheets completed in class are assessed by your teacher and automatically logged here.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-bold shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">Take-Home Practice</span>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      When home practice is assigned, practice on paper, snap a flat photo, and upload it below.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-bold shrink-0 mt-0.5">
                    3
                  </span>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">Progress Over Time</span>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      After 2 evaluated worksheets, progress trend lines across all 5 skills unlock automatically.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Assigned Take-Home Worksheets */}
          <section aria-labelledby="take-home-onboarding-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2
                  id="take-home-onboarding-heading"
                  className="font-heading text-base sm:text-lg font-semibold text-foreground flex items-center gap-2"
                >
                  <ClipboardList className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  <span>Assigned Take-Home Worksheets</span>
                </h2>
              </div>
              <TakeHomeActivities
                childId={selectedChildId}
                onUploadClick={handleUploadActivity}
              />
            </section>
        </div>
      ) : (
        /* Standard 2-Column Dashboard when child has assessment history */
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (Desktop): Latest Assessment & Diagnostic Feedback */}
          <div className="w-full lg:col-span-5 space-y-6">
            <section
              aria-labelledby="latest-assessment-heading"
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2
                  id="latest-assessment-heading"
                  className="font-heading text-base sm:text-lg font-semibold text-foreground flex items-center gap-2"
                >
                  <FileText className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  <span>Latest Assessment &amp; Feedback</span>
                </h2>
              </div>
              <LatestSubmissionCard
                childId={selectedChildId}
                childName={selectedChild.fullName}
              />
            </section>

            {/* Quick Home Support Card - Balances Desktop Column Height */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-4 sm:p-5 space-y-3 shadow-warm">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
                  <PenTool className="size-3.5" aria-hidden="true" />
                </div>
                <h3 className="font-heading text-xs sm:text-sm font-semibold text-foreground">
                  Supporting Cursive at Home
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Short 5-minute sessions focusing on proper pencil grip and gentle paper slant build muscle memory faster than repetitive drills.
              </p>
              <div className="pt-1 flex items-center justify-between border-t border-border/50">
                <button
                  type="button"
                  onClick={() => handleOpenRubric(null)}
                  className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline flex items-center gap-1 cursor-pointer min-h-[40px] sm:min-h-[36px] -my-1 py-1"
                >
                  <span>Review Rubrics &amp; Tips</span>
                  <ChevronRight className="size-3" aria-hidden="true" />
                </button>
                <span className="text-[11px] text-muted-foreground">5 cursive skills</span>
              </div>
            </div>
          </div>

          {/* Right Column (Desktop): Assigned Worksheets & Progress Trend */}
          <div className="w-full lg:col-span-7 space-y-6">
            {/* Zone 3: Assigned Take-Home Activities */}
            <section
              aria-labelledby="take-home-heading"
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2
                  id="take-home-heading"
                  className="font-heading text-base sm:text-lg font-semibold text-foreground flex items-center gap-2"
                >
                  <ClipboardList className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  <span>Assigned Take-Home Worksheets</span>
                </h2>
              </div>
              <TakeHomeActivities
                childId={selectedChildId}
                onUploadClick={handleUploadActivity}
              />
            </section>

            {/* Zone 4: Progress Trend History */}
            <section
              aria-labelledby="progress-trends-heading"
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2
                  id="progress-trends-heading"
                  className="font-heading text-base sm:text-lg font-semibold text-foreground flex items-center gap-2"
                >
                  <LineChart className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  <span>Progress Over Time</span>
                </h2>
              </div>

              {historyLoading ? (
                <div className="rounded-xl border border-border bg-card shadow-warm p-8 flex flex-col items-center justify-center min-h-[220px] gap-2.5">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">Loading trend history...</span>
                </div>
              ) : history && history.length >= 2 ? (
                <div className="rounded-xl border border-border bg-card shadow-warm p-4 sm:p-5">
                  <CriterionTrendChart history={history} />
                </div>
              ) : historyCount === 1 && history?.[0] ? (
                <div className="rounded-xl border border-brand-200 dark:border-brand-900 bg-brand-50/20 dark:bg-brand-950/20 shadow-warm p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0 mt-0.5">
                        <Award className="size-5" aria-hidden="true" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-heading text-sm sm:text-base font-semibold text-foreground">
                          First Milestone Achieved: Baseline Established!
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
                          Your child&apos;s first worksheet has been evaluated. This establishes their starting baseline. Complete 1 more worksheet to unlock interactive trend lines.
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-100 dark:bg-brand-900/60 px-2.5 py-1 rounded-full self-start sm:self-auto shrink-0">
                      1 of 2 Complete
                    </span>
                  </div>

                  {/* 2-Step Progress Stepper with Accessible Semantics */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                        First Worksheet (Baseline Recorded)
                      </span>
                      <span className="text-muted-foreground">Next Worksheet (Unlocks Trend)</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={1}
                      aria-valuemin={0}
                      aria-valuemax={2}
                      aria-label="Worksheets completed to unlock trend lines: 1 of 2"
                      className="h-2 w-full rounded-full bg-muted overflow-hidden"
                    >
                      <div className="h-full w-1/2 rounded-full bg-brand-600 dark:bg-brand-500 transition-all duration-500" />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Baseline Score (&ldquo;{history[0].targetText}&rdquo;):
                    </span>
                    <div className="flex items-center gap-2 font-medium">
                      <span className="font-sans tabular-nums font-semibold text-foreground">
                        {history[0].compositeScore != null
                          ? `${history[0].compositeScore.toFixed(1)}%`
                          : "—"}
                      </span>
                      <BandBadge score={history[0].compositeScore} size="sm" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card/60 shadow-warm p-5 sm:p-6 flex items-start gap-3.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0 mt-0.5">
                    <Info className="size-4.5" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-heading text-sm font-semibold text-foreground">
                      Progress History Coming Soon
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Handwriting trend lines across all 5 skills will appear here once your child completes 2 or more scored worksheets.
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ParentRubricDialog
        open={rubricOpen}
        onOpenChange={setRubricOpen}
        initialCriterion={rubricCriterion}
      />
      <SubmissionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        history={history ?? []}
        childName={selectedChild.fullName}
      />
    </div>
  );
}

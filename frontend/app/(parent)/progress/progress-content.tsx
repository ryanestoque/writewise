"use client";

import { useState, useCallback, useMemo } from "react";
import { useParentPortal } from "@/components/parent-portal-provider";
import { LatestSubmissionCard } from "@/components/parent/latest-submission-card";
import { TakeHomeActivities } from "@/components/parent/take-home-activities";
import { CriterionTrendChart } from "@/components/dashboard/criterion-trend-chart";
import { RubricReferenceDialog } from "@/components/rubric-reference-dialog";
import { SubmissionHistoryDialog } from "@/components/parent/submission-history-dialog";
import { SampleReportPreview } from "@/components/parent/sample-report-preview";
import {
  useChildScoreHistory,
  useTakeHomeActivities,
  useChildLatestScores,
} from "@/lib/hooks/use-parent-data";
import { computeStrengthAndFocus } from "@/lib/utils/scoring";
import { Button } from "@/components/ui/button";
import { BandBadge } from "@/components/shared/band-badge";
import { cn } from "@/lib/utils";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Loader2,
  UserX,
  BookOpen,
  History,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const MOBILE_TABS = ["latest", "tasks", "trends"] as const;
type MobileTab = (typeof MOBILE_TABS)[number];

export function ProgressPageContent() {
  const [rubricOpen, setRubricOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activitiesExpanded, setActivitiesExpanded] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("latest");
  const {
    selectedChildId,
    selectedChild,
    isLoading: childrenLoading,
    openUploadDialog,
    openCursiveGuide,
  } = useParentPortal();

  const handleMobileTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const currentIndex = MOBILE_TABS.indexOf(mobileTab);
        const nextIndex =
          e.key === "ArrowRight"
            ? (currentIndex + 1) % MOBILE_TABS.length
            : (currentIndex - 1 + MOBILE_TABS.length) % MOBILE_TABS.length;
        const nextTab = MOBILE_TABS[nextIndex];
        setMobileTab(nextTab);
        document.getElementById(`mobile-tab-${nextTab}`)?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        setMobileTab("latest");
        document.getElementById("mobile-tab-latest")?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        setMobileTab("trends");
        document.getElementById("mobile-tab-trends")?.focus();
      }
    },
    [mobileTab]
  );

  const handleOpenRubric = useCallback(() => setRubricOpen(true), []);

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
  const { data: latestScores } =
    useChildLatestScores(selectedChildId);

  const { practiceFocus } = useMemo(() => {
    return computeStrengthAndFocus(latestScores?.scores, latestScores?.bands);
  }, [latestScores]);

  if (childrenLoading) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="size-8 animate-spin motion-reduce:animate-none text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Loading child profile...</p>
      </div>
    );
  }

  if (!selectedChild) {
    return (
      <div className="max-w-md mx-auto my-12">
        <Empty className="border border-border rounded-xl shadow-warm bg-card py-10">
          <EmptyMedia variant="icon" className="bg-muted text-muted-foreground">
            <UserX className="size-6" aria-hidden="true" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No Linked Student Record</EmptyTitle>
            <EmptyDescription className="text-xs sm:text-sm leading-relaxed">
              No student profile is currently linked to your parent account. Please check with your child&apos;s teacher to verify your invitation.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
    <div className="w-full space-y-5 sm:space-y-6 pb-12">
      {/* Zone 1: Child Header & Quick Guides */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border/60">
        <div className="space-y-0.5 min-w-0">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
            {selectedChild.fullName}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
            Section <span className="text-foreground font-semibold">{selectedChild.section}</span>
          </p>
        </div>

        <div
          className={cn(
            "items-center gap-2 w-full sm:w-auto self-start sm:self-auto",
            historyCount >= 1 ? "grid grid-cols-2 sm:flex sm:flex-wrap" : "flex"
          )}
        >
          {historyCount >= 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              aria-haspopup="dialog"
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] w-full sm:w-auto justify-center gap-1.5 text-xs font-medium border-border/80 hover:bg-muted/50 cursor-pointer shadow-2xs"
            >
              <History className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
              <span className="truncate">All Worksheets ({historyCount})</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenRubric()}
            aria-haspopup="dialog"
            className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] w-full sm:w-auto justify-center gap-1.5 text-xs font-medium border-border/80 hover:bg-muted/50 cursor-pointer shadow-2xs"
          >
            <BookOpen className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
            <span className="truncate">Scoring Rubric</span>
          </Button>
        </div>
      </div>

      {isZeroState ? (
        /* Day-One Welcoming Onboarding Experience */
        <div className="space-y-6">
          {/* Welcome & How It Works Guide Hub */}
          <div className="rounded-xl border border-border bg-card shadow-warm p-5 sm:p-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-heading text-lg sm:text-xl font-bold text-foreground">
                  Welcome to {selectedChild.fullName}&apos;s Cursive Journey
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  WriteWise measures handwriting worksheets across five essential cursive skills. Explore how diagnostic feedback works below, or consult the reference tools while awaiting your child&apos;s first scored classroom worksheet.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openCursiveGuide}
                  aria-haspopup="dialog"
                  className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] w-full sm:w-auto justify-center text-xs font-semibold gap-1.5 shrink-0 cursor-pointer border-border/80 hover:bg-muted/50 shadow-2xs"
                >
                  <BookOpen className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
                  <span>Alphabet Guide</span>
                </Button>
              </div>
            </div>

            {/* Assessment Workflow Walkthrough - Flat Stepper */}
            <div className="pt-4 border-t border-border/60 space-y-3">
              <h3 className="text-xs font-semibold text-foreground">
                How It Works
              </h3>
              <ol className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 text-xs list-none p-0 m-0">
                <li className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="flex size-6 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-bold shrink-0 mt-0.5 select-none"
                  >
                    1
                  </span>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">Classroom Worksheets</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Worksheets completed in class are assessed by your teacher and automatically logged here.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="flex size-6 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-bold shrink-0 mt-0.5 select-none"
                  >
                    2
                  </span>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">Take-Home Practice</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      When home practice is assigned, practice on paper, snap a flat photo, and upload below.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="flex size-6 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-bold shrink-0 mt-0.5 select-none"
                  >
                    3
                  </span>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">Progress Over Time</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      After 2 evaluated worksheets, progress trend lines across all 5 skills unlock automatically.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          {/* Interactive Sample Assessment Showcase */}
          <SampleReportPreview
            onOpenRubric={handleOpenRubric}
          />

          {/* Assigned Take-Home Worksheets */}
          <section
            id="assigned-take-home-worksheets"
            aria-labelledby="take-home-onboarding-heading"
            className="space-y-3.5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
              <div className="space-y-0.5">
                <h2
                  id="take-home-onboarding-heading"
                  className="font-heading text-base sm:text-lg font-semibold text-foreground"
                >
                  Assigned Take-Home Worksheets
                </h2>
                {pendingActivitiesCount > 0 && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Complete on paper, snap a flat photo, and upload below to establish your child&apos;s baseline score.
                  </p>
                )}
              </div>
              {pendingActivitiesCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-800 dark:text-brand-200 bg-brand-100/80 dark:bg-brand-950/80 px-2.5 py-1 rounded-full border border-brand-200/70 dark:border-brand-800/70 self-start sm:self-auto shrink-0 shadow-2xs">
                  <span className="size-1.5 rounded-full bg-brand-600 dark:bg-brand-400" aria-hidden="true" />
                  {pendingActivitiesCount} Ready for Practice
                </span>
              )}
            </div>
            <TakeHomeActivities
              childId={selectedChildId}
              onUploadClick={handleUploadActivity}
              practiceFocusKey={practiceFocus?.key}
            />
          </section>
        </div>
      ) : (
        /* Standard Dashboard when child has assessment history */
        <div className="space-y-6 sm:space-y-8">
          {/* Mobile View Switcher (Visible only on < lg viewports) */}
          <div className="lg:hidden sticky top-14 z-20 bg-background/95 backdrop-blur-xs py-1.5 border-b border-border/60">
            <div
              role="tablist"
              aria-label="Progress sections"
              onKeyDown={handleMobileTabKeyDown}
              className="grid grid-cols-3 p-1 bg-muted/70 rounded-xl border border-border/80 text-xs"
            >
              <button
                type="button"
                role="tab"
                id="mobile-tab-latest"
                aria-selected={mobileTab === "latest"}
                aria-controls="mobile-section-latest"
                tabIndex={mobileTab === "latest" ? 0 : -1}
                onClick={() => setMobileTab("latest")}
                className={cn(
                  "py-2 px-2 rounded-lg text-center font-medium transition-all cursor-pointer min-h-[40px] flex items-center justify-center text-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                  mobileTab === "latest"
                    ? "bg-card text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Latest Result</span>
              </button>
              <button
                type="button"
                role="tab"
                id="mobile-tab-tasks"
                aria-selected={mobileTab === "tasks"}
                aria-controls="assigned-take-home-section"
                tabIndex={mobileTab === "tasks" ? 0 : -1}
                onClick={() => setMobileTab("tasks")}
                className={cn(
                  "py-2 px-2 rounded-lg text-center font-medium transition-all cursor-pointer min-h-[40px] inline-flex items-center justify-center gap-1.5 text-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                  mobileTab === "tasks"
                    ? "bg-card text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Tasks</span>
                {pendingActivitiesCount > 0 && (
                  <span className="size-4 rounded-full bg-brand-600 dark:bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {pendingActivitiesCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                id="mobile-tab-trends"
                aria-selected={mobileTab === "trends"}
                aria-controls="progress-trends-section"
                tabIndex={mobileTab === "trends" ? 0 : -1}
                onClick={() => setMobileTab("trends")}
                className={cn(
                  "py-2 px-2 rounded-lg text-center font-medium transition-all cursor-pointer min-h-[40px] flex items-center justify-center text-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                  mobileTab === "trends"
                    ? "bg-card text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Trends</span>
              </button>
            </div>
          </div>

          {/* Top Section: Dual Hero — Left: Latest Assessment & Diagnostic Feedback (Primary Hero, 7 cols) / Right: Assigned Take-Home Worksheets (Action Column, 5 cols) */}
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (Desktop 7 cols): Latest Assessment & Diagnostic Feedback */}
            <div
              id="mobile-section-latest"
              className={cn(
                "w-full lg:col-span-7 space-y-6",
                mobileTab !== "latest" && "hidden lg:block"
              )}
            >
              <section
                aria-labelledby="latest-assessment-heading"
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="latest-assessment-heading"
                    className="font-heading text-base sm:text-lg font-semibold text-foreground"
                  >
                    Latest Assessment &amp; Feedback
                  </h2>
                </div>
                <LatestSubmissionCard
                  childId={selectedChildId}
                  childName={selectedChild.fullName}
                />
              </section>
            </div>

            {/* Right Column (Desktop 5 cols): Assigned Take-Home Worksheets */}
            <div
              id="assigned-take-home-section"
              className={cn(
                "w-full lg:col-span-5 space-y-6 scroll-mt-6 lg:sticky lg:top-6 lg:self-start",
                mobileTab !== "tasks" && "hidden lg:block"
              )}
            >
              <section
                id="assigned-take-home-section-inner"
                aria-labelledby="take-home-heading"
                className="space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2
                      id="take-home-heading"
                      className="font-heading text-base sm:text-lg font-semibold text-foreground"
                    >
                      Assigned Take-Home Worksheets
                    </h2>
                    {pendingActivitiesCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-800 dark:text-brand-200 bg-brand-100/80 dark:bg-brand-950/80 px-2.5 py-0.5 rounded-full border border-brand-200/70 dark:border-brand-800/70 shrink-0">
                        <span className="size-1.5 rounded-full bg-brand-600 dark:bg-brand-400" aria-hidden="true" />
                        {pendingActivitiesCount} Due
                      </span>
                    )}
                  </div>
                  {activities && activities.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setActivitiesExpanded((prev) => !prev)}
                      aria-expanded={activitiesExpanded}
                      aria-controls="take-home-activities-grid"
                      className="h-10 sm:h-8 min-h-[40px] sm:min-h-[32px] px-3 sm:px-2.5 text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 hover:bg-brand-50/80 dark:hover:bg-brand-950/50 gap-1 cursor-pointer rounded-lg border border-brand-200/50 dark:border-brand-800/50 shrink-0 touch-manipulation"
                    >
                      <span>{activitiesExpanded ? "Show fewer (2)" : `View all (${activities.length})`}</span>
                      {activitiesExpanded ? (
                        <ChevronUp className="size-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="size-3.5" aria-hidden="true" />
                      )}
                    </Button>
                  )}
                </div>
                <TakeHomeActivities
                  childId={selectedChildId}
                  onUploadClick={handleUploadActivity}
                  expanded={activitiesExpanded}
                  showExpandButton={false}
                  gridClassName="grid grid-cols-1 gap-3.5"
                  practiceFocusKey={practiceFocus?.key}
                />
              </section>
            </div>
          </div>

          {/* Full-Width Section: Longitudinal Progress Over Time (12 cols) */}
          <section
            id="progress-trends-section"
            aria-labelledby="progress-trends-heading"
            className={cn(
              "space-y-3 pt-2",
              mobileTab !== "trends" && "hidden lg:block"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h2
                  id="progress-trends-heading"
                  className="font-heading text-base sm:text-lg font-semibold text-foreground"
                >
                  Progress Over Time
                </h2>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Track your child&apos;s cursive handwriting growth and skill development over time
                </p>
              </div>
            </div>

            {historyLoading ? (
              <div role="status" aria-live="polite" className="rounded-xl border border-border bg-card shadow-warm p-8 flex flex-col items-center justify-center min-h-[220px] gap-2.5">
                <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" aria-hidden="true" />
                <span className="text-xs text-muted-foreground">Loading trend history...</span>
              </div>
            ) : history && history.length >= 2 ? (
              <div className="rounded-xl border border-border bg-card shadow-warm p-4 sm:p-5 min-w-0">
                <CriterionTrendChart history={history} />
              </div>
            ) : historyCount === 1 && history?.[0] ? (
              <div className="rounded-xl border border-brand-200 dark:border-brand-900 bg-brand-50/20 dark:bg-brand-950/20 shadow-warm p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="font-heading text-sm sm:text-base font-semibold text-foreground">
                      First Milestone Achieved: Baseline Established!
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
                      Your child&apos;s first worksheet has been evaluated. This establishes their starting baseline. Complete 1 more worksheet to unlock interactive trend lines.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-100 dark:bg-brand-900/60 px-2.5 py-1 rounded-full self-start sm:self-auto shrink-0">
                    1 of 2 Complete
                  </span>
                </div>

                {/* 2-Step Progress Stepper with Accessible Semantics */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                      First Worksheet (Starting Benchmark)
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
                    <div className="h-full w-1/2 rounded-full bg-brand-600 dark:bg-brand-500 transition-all duration-500 motion-reduce:transition-none" />
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Starting Benchmark (&ldquo;{history[0].targetText}&rdquo;):
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

                {/* Locked Trend Preview Illustration */}
                <div className="pt-2 border-t border-border/60">
                  <TrendGraphTeaser subtitle="Interactive multi-skill graph unlocks after worksheet #2" />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card/60 shadow-warm p-5 sm:p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-heading text-sm font-semibold text-foreground">
                    Progress History Coming Soon
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Handwriting trend lines across all 5 skills will appear here once your child completes 2 or more scored worksheets.
                  </p>
                </div>
                <TrendGraphTeaser subtitle="Trend lines across Letter Formation, Size, Spacing, Slant & Baseline" />
              </div>
            )}
          </section>
        </div>
      )}

      {/* Dialogs */}
      <RubricReferenceDialog
        open={rubricOpen}
        onOpenChange={setRubricOpen}
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

function TrendGraphTeaser({ subtitle }: { subtitle?: string }) {
  return (
    <div className="relative rounded-lg border border-border/70 bg-muted/30 p-3 sm:p-4 overflow-hidden select-none">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="size-2 rounded-full bg-brand-600 dark:bg-brand-400 shrink-0" aria-hidden="true" />
          <span>5-Criterion Longitudinal Tracking</span>
        </div>
        <span className="text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-100/70 dark:bg-brand-950/70 px-2.5 py-0.5 rounded-full border border-brand-200/50 dark:border-brand-800/50">
          Preview
        </span>
      </div>

      {/* Stylized ghosted chart curves representing penmanship skills */}
      <div className="relative h-16 w-full flex items-center justify-center">
        <svg
          viewBox="0 0 400 64"
          className="w-full h-full text-border/60"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Subtle horizontal grid guide lines */}
          <line x1="0" y1="14" x2="400" y2="14" stroke="currentColor" strokeDasharray="3 3" strokeWidth="0.75" />
          <line x1="0" y1="34" x2="400" y2="34" stroke="currentColor" strokeDasharray="3 3" strokeWidth="0.75" />
          <line x1="0" y1="54" x2="400" y2="54" stroke="currentColor" strokeDasharray="3 3" strokeWidth="0.75" />

          {/* Smooth cursive trend waves in brand palette */}
          <path
            d="M 0 50 Q 100 42, 200 30 T 400 16"
            fill="none"
            className="stroke-brand-600/50 dark:stroke-brand-400/50"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 0 56 Q 100 52, 200 38 T 400 24"
            fill="none"
            className="stroke-warning/50 dark:stroke-warning/60"
            strokeWidth="1.75"
            strokeDasharray="4 2"
            strokeLinecap="round"
          />
          <path
            d="M 0 44 Q 100 38, 200 26 T 400 14"
            fill="none"
            className="stroke-brand-700/40 dark:stroke-brand-300/40"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        {/* Center overlay pill */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-background/95 backdrop-blur-xs border border-border/80 text-foreground shadow-2xs">
            <span className="size-1.5 rounded-full bg-brand-600 dark:bg-brand-400 shrink-0" aria-hidden="true" />
            <span>{subtitle ?? "Unlocks after 2 evaluated worksheets"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

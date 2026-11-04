"use client";

import { useState, useCallback, useMemo } from "react";
import { useParentPortal } from "@/components/parent-portal-provider";
import {
  ParentStatusHero,
  LatestSubmissionCard,
} from "@/components/parent/latest-submission-card";
import { TakeHomeActivities } from "@/components/parent/take-home-activities";
import { CriterionTrendChart } from "@/components/dashboard/criterion-trend-chart";
import { RubricReferenceDialog } from "@/components/rubric-reference-dialog";
import { PastWorksheetsSection } from "@/components/parent/submission-history-dialog";
import { SampleReportPreview } from "@/components/parent/sample-report-preview";
import { NotificationWorkDestination } from "@/components/parent/notification-work-destination";
import {
  useChildScoreHistory,
  useTakeHomeActivities,
  useChildLatestScores,
} from "@/lib/hooks/use-parent-data";
import { computeStrengthAndFocus } from "@/lib/utils/scoring";
import { activitySubmissionsClosed } from "@/lib/utils/activity-deadlines";
import { useActivityNow } from "@/components/activities/activity-work-status";
import { Button } from "@/components/ui/button";
import { BandBadge } from "@/components/shared/band-badge";
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
  PenTool,
  CheckCircle2,
} from "lucide-react";

export function ProgressPageContent() {
  const [rubricOpen, setRubricOpen] = useState(false);
  const [activitiesExpanded, setActivitiesExpanded] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);

  const {
    selectedChildId,
    selectedChild,
    isLoading: childrenLoading,
    openUploadDialog,
    openCursiveGuide,
    userId,
    notificationTarget,
    dismissNotificationTarget,
  } = useParentPortal();

  const toggleScoreDetails = useCallback(() => {
    setShowScoreDetails((prev) => !prev);
  }, []);

  const handleOpenRubric = useCallback(() => setRubricOpen(true), []);

  const handleUploadActivity = useCallback(
    (activityId: string) => {
      openUploadDialog(activityId);
    },
    [openUploadDialog]
  );

  const { data: allHistory, isLoading: historyLoading } =
    useChildScoreHistory(selectedChildId);
  const history = useMemo(
    () =>
      allHistory?.filter(
        (row) =>
          row.isActiveAttempt &&
          row.status === "completed" &&
          !!row.releasedAt &&
          row.compositeScore != null
      ),
    [allHistory]
  );
  const { data: activities } = useTakeHomeActivities(selectedChildId);
  const { data: latestScores } = useChildLatestScores(selectedChildId);

  const now = useActivityNow();

  const { practiceFocus } = useMemo(() => {
    return computeStrengthAndFocus(latestScores?.scores, latestScores?.bands);
  }, [latestScores]);

  const takeHomeActivities = useMemo(() => {
    if (!activities) return [];
    return activities.filter((a) => a.isTakeHome);
  }, [activities]);

  const pendingActivitiesCount = useMemo(() => {
    return takeHomeActivities.filter((a) => {
      const closed = activitySubmissionsClosed(
        { due_at: a.dueAt, close_after_due: a.closeAfterDue },
        now
      );
      if (closed) return false;
      const sub = a.submission ?? a.latestSubmission;
      if (!sub) return true;
      if (sub.status === "rejected" || sub.status === "returned") return true;
      if (a.workState?.returned_at && !a.workState.active_submission_id) return true;
      return false;
    }).length;
  }, [takeHomeActivities, now]);

  if (childrenLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center min-h-[50vh] gap-3"
      >
        <Loader2
          className="size-8 animate-spin motion-reduce:animate-none text-brand-600 dark:text-brand-400"
          aria-hidden="true"
        />
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
            <EmptyTitle>No Linked Student Profile</EmptyTitle>
            <EmptyDescription className="text-sm leading-relaxed">
              No student profile is linked to your parent account yet. Please check with your child&apos;s teacher to verify your invitation.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const firstName = selectedChild.fullName.trim().split(/\s+/)[0] || selectedChild.fullName;
  const scoredCount = history?.length ?? 0;
  const isZeroState = !historyLoading && scoredCount === 0;
  const notificationTargetData =
    notificationTarget.kind === "valid" &&
      selectedChild.id === notificationTarget.target.childId
      ? notificationTarget.target
      : null;

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Notification Deep-Link Modal */}
      {notificationTarget.kind !== "none" && (
        <NotificationWorkDestination
          key={`${notificationTargetData?.childId}:${notificationTargetData?.activityId}:${notificationTargetData?.submissionId}`}
          userId={userId}
          target={notificationTargetData}
          childName={selectedChild.fullName}
          onClose={dismissNotificationTarget}
        />
      )}

      {/* Page Header Bar (Matches Teacher Portal Dashboard Header) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground tracking-tight">
            {firstName}&apos;s Progress
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Section {selectedChild.section}
            {isZeroState
              ? " · Classroom and take-home worksheets will appear here once checked"
              : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenRubric}
            aria-haspopup="dialog"
            className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium gap-1.5 cursor-pointer"
          >
            <BookOpen className="size-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
            <span>How Scores Work</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openCursiveGuide}
            aria-haspopup="dialog"
            className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium gap-1.5 cursor-pointer"
          >
            <PenTool className="size-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
            <span>Cursive Guide</span>
          </Button>

          {!isZeroState && (
            <button
              type="button"
              onClick={toggleScoreDetails}
              aria-pressed={showScoreDetails}
              className="text-xs sm:text-sm font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg px-3 py-1.5 min-h-[40px] sm:min-h-[36px] inline-flex items-center justify-center border border-brand-200/70 dark:border-brand-800/70 bg-brand-50/50 dark:bg-brand-950/30 transition-colors touch-manipulation"
            >
              {showScoreDetails ? "Hide details" : "Show details"}
            </button>
          )}
        </div>
      </div>

      {isZeroState ? (
        /* Zero-Score State */
        <div className="space-y-6">
          <section
            id="assigned-take-home-section"
            aria-labelledby="take-home-onboarding-heading"
            className="space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2
                  id="take-home-onboarding-heading"
                  className="font-heading text-base sm:text-lg font-semibold text-foreground"
                >
                  To Do at Home
                </h2>
                {pendingActivitiesCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-800 dark:text-brand-200 bg-brand-100/80 dark:bg-brand-950/80 px-2.5 py-0.5 rounded-full border border-brand-200/70 dark:border-brand-800/70 shrink-0">
                    <span className="size-1.5 rounded-full bg-brand-600 dark:bg-brand-400" aria-hidden="true" />
                    {pendingActivitiesCount} to send
                  </span>
                )}
              </div>
            </div>
            <TakeHomeActivities
              childId={selectedChildId}
              onUploadClick={handleUploadActivity}
              practiceFocusKey={practiceFocus?.key}
            />
          </section>

          {allHistory && allHistory.length > 0 && (
            <PastWorksheetsSection
              history={allHistory}
              childName={selectedChild.fullName}
              showScoreDetails={showScoreDetails}
            />
          )}

          <SampleReportPreview
            onOpenRubric={handleOpenRubric}
            defaultCollapsed={true}
            showScoreDetails={showScoreDetails}
            onToggleScoreDetails={toggleScoreDetails}
          />
        </div>
      ) : (
        /* Scored State: 3 Focused Zones */
        <div className="space-y-6">
          {/* Zone 1: Overview & Practice Focus + To Do at Home */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="w-full lg:col-span-7">
              <ParentStatusHero
                childId={selectedChildId}
                childName={selectedChild.fullName}
                section={selectedChild.section}
                history={history ?? []}
                showScoreDetails={showScoreDetails}
              />
            </div>

            <section
              id="assigned-take-home-section"
              aria-labelledby="take-home-heading"
              className="w-full lg:col-span-5 scroll-mt-20 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    id="take-home-heading"
                    className="font-heading text-base sm:text-lg font-semibold text-foreground"
                  >
                    To Do at Home
                  </h2>
                  {pendingActivitiesCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-800 dark:text-brand-200 bg-brand-100/80 dark:bg-brand-950/80 px-2.5 py-0.5 rounded-full border border-brand-200/70 dark:border-brand-800/70">
                      <span className="size-1.5 rounded-full bg-brand-600 dark:bg-brand-400" aria-hidden="true" />
                      {pendingActivitiesCount} to send
                    </span>
                  )}
                </div>
              </div>

              <TakeHomeActivities
                childId={selectedChildId}
                onUploadClick={handleUploadActivity}
                expanded={activitiesExpanded}
                onToggleExpanded={() => setActivitiesExpanded((prev) => !prev)}
                showExpandButton={true}
                gridClassName="grid grid-cols-1 gap-3"
                practiceFocusKey={practiceFocus?.key}
              />
            </section>
          </div>

          {/* Zone 2: Latest Worksheet + Progress Over Time Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section
              aria-labelledby="latest-worksheet-heading"
              className="w-full lg:col-span-6 space-y-3"
            >
              <h2
                id="latest-worksheet-heading"
                className="font-heading text-base sm:text-lg font-semibold text-foreground"
              >
                Latest Worksheet
              </h2>
              <LatestSubmissionCard
                childId={selectedChildId}
                childName={selectedChild.fullName}
                showScoreDetails={showScoreDetails}
              />
            </section>

            <section
              id="progress-trends-section"
              aria-labelledby="progress-trends-heading"
              className="w-full lg:col-span-6 space-y-3"
            >
              <h2
                id="progress-trends-heading"
                className="font-heading text-base sm:text-lg font-semibold text-foreground"
              >
                Progress Over Time
              </h2>

              {historyLoading ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl border border-border bg-card shadow-warm p-8 flex flex-col items-center justify-center min-h-[240px] gap-2.5"
                >
                  <Loader2
                    className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-muted-foreground">Loading progress chart...</span>
                </div>
              ) : history && history.length >= 2 ? (
                <div className="rounded-xl border border-border bg-card shadow-warm p-4 sm:p-5 min-w-0">
                  <CriterionTrendChart
                    history={history}
                    variant="parent"
                    showScoreDetails={showScoreDetails}
                  />
                </div>
              ) : scoredCount === 1 && history?.[0] ? (
                <div className="rounded-xl border border-border bg-card shadow-warm p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-heading text-base font-semibold text-foreground">
                        First Worksheet Checked
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                        {firstName}&apos;s first scored worksheet sets their starting point. After a second worksheet is checked, the progress chart will unlock here.
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-100 dark:bg-brand-900/60 px-2.5 py-1 rounded-full self-start sm:self-auto shrink-0">
                      1 of 2 Worksheets
                    </span>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <CheckCircle2
                          className="size-4 text-brand-600 dark:text-brand-400"
                          aria-hidden="true"
                        />
                        Worksheet #1
                      </span>
                      <span className="text-muted-foreground">Worksheet #2 unlocks chart</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={1}
                      aria-valuemin={0}
                      aria-valuemax={2}
                      aria-label="Worksheets completed to unlock progress chart: 1 of 2"
                      className="h-2 w-full rounded-full bg-muted overflow-hidden"
                    >
                      <div className="h-full w-1/2 rounded-full bg-brand-600 dark:bg-brand-500 transition-all duration-500 motion-reduce:transition-none" />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/60 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate pr-2">
                      First worksheet (&ldquo;{history[0].targetText}&rdquo;):
                    </span>
                    <div className="flex items-center gap-2 font-medium shrink-0">
                      {showScoreDetails && history[0].compositeScore != null && (
                        <span className="font-sans tabular-nums font-semibold text-foreground">
                          {Math.round(history[0].compositeScore)}%
                        </span>
                      )}
                      <BandBadge score={history[0].compositeScore} size="sm" />
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          {/* Zone 3: Compact Past Worksheets List */}
          <PastWorksheetsSection
            history={allHistory ?? []}
            childName={selectedChild.fullName}
            showScoreDetails={showScoreDetails}
          />
        </div>
      )}

      {/* How Scores Work Dialog */}
      <RubricReferenceDialog
        open={rubricOpen}
        onOpenChange={setRubricOpen}
        variant="parent"
        showScoreDetails={showScoreDetails}
        onToggleScoreDetails={toggleScoreDetails}
      />
    </div>
  );
}

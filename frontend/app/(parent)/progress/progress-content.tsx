"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useParentPortal } from "@/components/parent-portal-provider";
import { LatestSubmissionCard } from "@/components/parent/latest-submission-card";
import { TakeHomeActivities } from "@/components/parent/take-home-activities";
import { QueryRecovery } from "@/components/shared/query-recovery";
import {
  LatestSubmissionSkeleton,
  ParentGradesSkeleton,
  ParentPortalPageSkeleton,
  PastWorksheetsSkeleton,
  ProgressTrendSkeleton,
} from "@/components/parent/parent-portal-skeletons";

const CriterionTrendChart = dynamic(
  () => import("@/components/dashboard/criterion-trend-chart").then((m) => m.CriterionTrendChart),
  { ssr: false, loading: () => <ProgressTrendSkeleton bare /> }
);
const PastWorksheetsSection = dynamic(
  () => import("@/components/parent/submission-history-dialog").then((m) => m.PastWorksheetsSection),
  { ssr: false, loading: () => <PastWorksheetsSkeleton /> }
);
const SampleReportPreview = dynamic(
  () => import("@/components/parent/sample-report-preview").then((m) => m.SampleReportPreview),
  { ssr: false }
);
const NotificationWorkDestination = dynamic(
  () => import("@/components/parent/notification-work-destination").then((m) => m.NotificationWorkDestination),
  { ssr: false }
);
const ParentGrades = dynamic(
  () => import("@/components/gradebook/parent-grades").then((m) => m.ParentGrades),
  { ssr: false, loading: () => <ParentGradesSkeleton /> }
);
const SubmissionCommentThreadSheet = dynamic(
  () => import("@/components/comments/submission-comment-thread-sheet").then((m) => m.SubmissionCommentThreadSheet),
  { ssr: false }
);
import {
  useChildScoreHistory,
  useTakeHomeActivities,
  useChildLatestScores,
  type TakeHomeActivity,
} from "@/lib/hooks/use-parent-data";
import { computeStrengthAndFocus, PARENT_CRITERIA_LIST } from "@/lib/utils/scoring";
import { formatActivityDueAt } from "@/lib/utils/activity-deadlines";
import { compareParentActivityUrgency, getParentActivityStatus } from "@/lib/utils/parent-activity-status";
import { useActivityNow } from "@/components/activities/activity-work-status";
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  UserX,
  PenTool,
  Camera,
  Clock,
} from "lucide-react";

type ParentProgressTab = "overview" | "to-write" | "progress" | "grades";

function ParentHeaderUploadAction({
  takeHomeActivities,
  onUploadActivity,
  onOpenUploadDialog,
}: {
  takeHomeActivities: TakeHomeActivity[];
  onUploadActivity: (activityId: string) => void;
  onOpenUploadDialog: () => void;
}) {
  const now = useActivityNow();

  const openTakeHomeActivities = useMemo(() => {
    return takeHomeActivities
      .filter((a) => {
        const status = getParentActivityStatus(a, now);
        return status.canSend && !status.excused;
      })
      .sort((a, b) => compareParentActivityUrgency(a, b, now));
  }, [takeHomeActivities, now]);

  const hasUrgentActivity = useMemo(
    () => takeHomeActivities.some((activity) => getParentActivityStatus(activity, now).urgency != null),
    [takeHomeActivities, now]
  );

  if (openTakeHomeActivities.length === 0 || hasUrgentActivity) {
    return null;
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={() => {
        if (openTakeHomeActivities.length === 1) {
          onUploadActivity(openTakeHomeActivities[0].id);
        } else {
          onOpenUploadDialog();
        }
      }}
      className="h-11 sm:h-9 font-medium text-xs sm:text-sm gap-1.5 cursor-pointer touch-manipulation"
    >
      <Camera className="size-4" aria-hidden="true" />
      <span>Send photo</span>
    </Button>
  );
}

function UrgentPracticeBanner({
  takeHomeActivities,
  onNavigateToWrite,
  onUploadActivity,
}: {
  takeHomeActivities: TakeHomeActivity[];
  onNavigateToWrite: () => void;
  onUploadActivity: (activityId: string) => void;
}) {
  const now = useActivityNow();

  const urgentActivities = useMemo(
    () =>
      takeHomeActivities
        .filter((activity) => getParentActivityStatus(activity, now).urgency != null)
        .sort((a, b) => compareParentActivityUrgency(a, b, now)),
    [takeHomeActivities, now]
  );
  const urgentActivity = urgentActivities[0];
  const urgentStatus = urgentActivity ? getParentActivityStatus(urgentActivity, now) : null;

  if (!urgentActivity || !urgentStatus) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Practice worksheet needing attention"
      className={cn(
        "rounded-xl px-4 py-3 text-foreground border transition-colors",
        urgentStatus.urgency === "teacher_returned"
          ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
          : urgentStatus.urgency === "retake_needed"
            ? "border-warning/40 bg-warning/10 dark:bg-warning/15"
            : "border-band-2/40 bg-band-2/10 dark:bg-band-2/15"
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold text-foreground truncate">
            <span
              className={cn(
                "mr-1.5",
                urgentStatus.urgency === "teacher_returned"
                  ? "text-primary"
                  : urgentStatus.urgency === "retake_needed"
                    ? "text-warning-foreground"
                    : "text-band-2-text"
              )}
            >
              {urgentStatus.urgency === "teacher_returned"
                ? "New photo requested:"
                : urgentStatus.urgency === "retake_needed"
                  ? "Clearer photo needed:"
                  : urgentStatus.urgency === "overdue"
                    ? "Past due:"
                    : "Due soon:"}
            </span>
            {urgentActivity.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {urgentActivity.dueAt && (
              <span className="tabular-nums">
                Due {formatActivityDueAt(urgentActivity.dueAt)}
              </span>
            )}
            {urgentActivities.length > 1 && (
              <button
                type="button"
                onClick={onNavigateToWrite}
                className="text-brand-700 dark:text-brand-300 font-medium hover:underline cursor-pointer min-h-11 px-2 -my-2 touch-manipulation inline-flex items-center text-xs"
              >
                +{urgentActivities.length - 1} more
              </button>
            )}
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => onUploadActivity(urgentActivity.id)}
          aria-haspopup="dialog"
          aria-label={`Send ${urgentStatus.urgency === "teacher_returned" || urgentStatus.urgency === "retake_needed" ? "new " : ""}photo for ${urgentActivity.title}`}
          className="h-11 sm:h-9 w-full sm:w-auto shrink-0 font-medium text-xs sm:text-sm gap-1.5 cursor-pointer touch-manipulation"
        >
          <Camera className="size-4" aria-hidden="true" />
          <span>
            {urgentStatus.urgency === "teacher_returned" || urgentStatus.urgency === "retake_needed"
              ? "Send new photo"
              : "Send photo"}
          </span>
        </Button>
      </div>
    </div>
  );
}

function PracticeTabCountBadge({ takeHomeActivities }: { takeHomeActivities: TakeHomeActivity[] }) {
  const now = useActivityNow();
  const count = useMemo(
    () =>
      takeHomeActivities.filter((a) => {
        const status = getParentActivityStatus(a, now);
        return status.canSend && !status.excused;
      }).length,
    [takeHomeActivities, now]
  );

  if (count === 0) return null;

  return (
    <span className="inline-flex items-center justify-center px-1.5 py-0 rounded-full text-xs font-bold tabular-nums bg-brand-100/90 dark:bg-brand-950/90 text-brand-800 dark:text-brand-200 border border-brand-200/70 dark:border-brand-800/70">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">
        {`, ${count} to send`}
      </span>
    </span>
  );
}

export function ProgressPageContent() {
  const searchParams = useSearchParams();
  const [selectedTab, setSelectedTab] = useState<ParentProgressTab | null>(null);
  const [inspectedGradeWork, setInspectedGradeWork] = useState<{
    activityId: string;
    submissionId: string | null;
  } | null>(null);

  const {
    selectedChildId,
    selectedChild,
    isLoading: childrenLoading,
    isError: childrenError,
    isRetrying: childrenRetrying,
    retryChildren,
    openUploadDialog,
    openCursiveGuide,
    openRubric,
    userId,
    notificationTarget,
    dismissNotificationTarget,
  } = useParentPortal();

  const handleNavigateToWrite = useCallback(() => {
    setSelectedTab("to-write");
  }, []);

  const handleUploadActivity = useCallback(
    (activityId: string) => {
      openUploadDialog(activityId);
    },
    [openUploadDialog]
  );

  const {
    data: allHistory,
    isLoading: historyLoading,
    isError: historyError,
    isFetching: historyRetrying,
    refetch: refetchHistory,
  } =
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
  const { data: activities, isSuccess: practiceLoaded } = useTakeHomeActivities(selectedChildId);

  const takeHomeActivities = useMemo(() => {
    if (!activities) return [];
    return activities.filter((a) => a.isTakeHome);
  }, [activities]);

  const hasPendingSubmission = Boolean(
    allHistory?.some(
      (row) =>
        row.isActiveAttempt &&
        (row.status === "processing" || (row.status === "completed" && !row.releasedAt))
    )
  );
  const { data: latestScores, isSuccess: latestFeedbackLoaded } = useChildLatestScores(selectedChildId, {
    hasPendingSubmission,
  });

  const { practiceFocus } = useMemo(() => {
    return computeStrengthAndFocus(latestScores?.scores, latestScores?.bands);
  }, [latestScores]);
  const notificationTargetData =
    notificationTarget.kind === "valid" &&
      selectedChildId === notificationTarget.target.childId
      ? notificationTarget.target
      : null;
  const gradeDestination = notificationTargetData?.view === "grades";
  const notificationDestination = notificationTargetData?.view === "comments" && notificationTargetData.submissionId ? (
    <SubmissionCommentThreadSheet key={`${userId}:${notificationTargetData.childId}:${notificationTargetData.submissionId}`}
      userId={userId} target={{ activityId: notificationTargetData.activityId, studentId: notificationTargetData.childId, submissionId: notificationTargetData.submissionId }} open
      studentName={selectedChild?.fullName} onOpenChange={open => { if (!open) dismissNotificationTarget(); }} />
  ) : notificationTarget.kind !== "none" && !gradeDestination ? (
    <NotificationWorkDestination
      key={`${notificationTargetData?.childId}:${notificationTargetData?.activityId}:${notificationTargetData?.submissionId}`}
      userId={userId}
      target={notificationTargetData}
      childName={selectedChild?.fullName ?? "Your child"}
      onClose={dismissNotificationTarget}
      onUploadActivity={handleUploadActivity}
    />
  ) : null;

  if (childrenLoading) {
    return <ParentPortalPageSkeleton />;
  }

  if (childrenError && !selectedChild) {
    return (
      <div className="w-full px-4 py-6 sm:px-6">
        <QueryRecovery
          title="Could not load child profiles"
          description="We could not check your linked child profiles. Please check your connection and try again."
          onRetry={retryChildren}
          isRetrying={childrenRetrying}
        />
      </div>
    );
  }

  if (!selectedChild) {
    return (
      <div className="w-full px-4 py-6 sm:px-6">
        {notificationDestination}
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
      </div>
    );
  }

  const firstName = selectedChild.fullName.trim().split(/\s+/)[0] || selectedChild.fullName;
  const scoredCount = history?.length ?? 0;
  const showExampleFeedback = latestFeedbackLoaded && latestScores === null;
  const requestedGrades = searchParams.getAll("tab").length === 1 && searchParams.get("tab") === "grades";
  const isResolvingInitialTab =
    selectedTab === null && !gradeDestination && !requestedGrades && historyLoading;
  const defaultTab: ParentProgressTab =
    requestedGrades
      ? "grades"
      : !historyLoading && scoredCount === 0 && takeHomeActivities.length > 0
        ? "to-write"
        : "overview";
  const activeTab: ParentProgressTab = gradeDestination
    ? "grades"
    : selectedTab ?? defaultTab;

  return (
    <div className="w-full min-w-0 flex flex-col">
      {/* Notification Deep-Link Modal */}
      {notificationDestination}
      {!notificationDestination && inspectedGradeWork && selectedChildId && (
        <NotificationWorkDestination
          key={`grade-inspect:${selectedChildId}:${inspectedGradeWork.activityId}:${inspectedGradeWork.submissionId}`}
          userId={userId}
          target={{
            childId: selectedChildId,
            activityId: inspectedGradeWork.activityId,
            submissionId: inspectedGradeWork.submissionId,
          }}
          childName={selectedChild.fullName}
          onClose={() => setInspectedGradeWork(null)}
          onUploadActivity={handleUploadActivity}
        />
      )}

      {/* Segmented 4-Tab View: Recent, Practice, Progress, Grades */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          if (gradeDestination || requestedGrades) {
            dismissNotificationTarget(null);
          }
          setSelectedTab(val as ParentProgressTab);
        }}
        className="w-full gap-0 flex flex-col"
      >
        {/* Sticky Sub-Navbar directly below the main navbar (top-14) */}
        <div className="sticky top-14 z-30 w-full border-b border-border/80 bg-background">
          <div className="w-full px-4 sm:px-6">
            <TabsList
              variant="line"
              aria-label={`${firstName}'s portal sections`}
              className="w-full grid grid-cols-4 sm:w-fit sm:flex h-auto -mb-px gap-0 sm:gap-2 rounded-none bg-transparent p-0"
            >
              <TabsTrigger
                value="overview"
                className="min-h-11 sm:min-h-10 h-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 px-1.5 sm:px-4 py-3 sm:pt-3 sm:pb-2.5 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap rounded-none touch-manipulation data-active:text-primary data-active:after:bg-primary"
              >
                <span>Recent</span>
              </TabsTrigger>

              <TabsTrigger
                value="to-write"
                className="min-h-11 sm:min-h-10 h-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 px-1.5 sm:px-4 py-3 sm:pt-3 sm:pb-2.5 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap rounded-none touch-manipulation data-active:text-primary data-active:after:bg-primary"
              >
                <span>Practice</span>
                <PracticeTabCountBadge takeHomeActivities={takeHomeActivities} />
              </TabsTrigger>

              <TabsTrigger
                value="progress"
                className="min-h-11 sm:min-h-10 h-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 px-1.5 sm:px-4 py-3 sm:pt-3 sm:pb-2.5 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap rounded-none touch-manipulation data-active:text-primary data-active:after:bg-primary"
              >
                <span>Progress</span>
              </TabsTrigger>

              <TabsTrigger
                value="grades"
                className="min-h-11 sm:min-h-10 h-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 px-1.5 sm:px-4 py-3 sm:pt-3 sm:pb-2.5 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap rounded-none touch-manipulation data-active:text-primary data-active:after:bg-primary"
              >
                <span>Grades</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="w-full px-4 sm:px-6 py-6 space-y-6 pb-16">
          {/* Page Header Bar (Matches Teacher Portal Dashboard Header) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground tracking-tight">
                {firstName}&apos;s handwriting
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Section {selectedChild.section}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <ParentHeaderUploadAction
                takeHomeActivities={takeHomeActivities}
                onUploadActivity={handleUploadActivity}
                onOpenUploadDialog={openUploadDialog}
              />
            </div>
          </div>

          {childrenError && (
            <QueryRecovery
              title="Could not refresh child profiles"
              description="Showing the child profiles loaded earlier. Please check your connection and try again to get the latest information."
              onRetry={retryChildren}
              isRetrying={childrenRetrying}
            />
          )}

          {historyError && (
            <QueryRecovery
              title={allHistory === undefined ? "Could not load progress history" : "Could not refresh progress history"}
              description={allHistory === undefined
                ? "Your worksheet history is unavailable right now. Please check your connection and try again."
                : "Showing the worksheet history loaded earlier. Try again to check for newly shared results."}
              onRetry={() => { void refetchHistory(); }}
              isRetrying={historyRetrying}
            />
          )}

          {activeTab !== "to-write" && (
            <UrgentPracticeBanner
              takeHomeActivities={takeHomeActivities}
              onNavigateToWrite={handleNavigateToWrite}
              onUploadActivity={handleUploadActivity}
            />
          )}

          {/* Tab 1: Overview (Coaching Hero + Latest Worksheet) */}
          <TabsContent value="overview" className="space-y-6">
          {isResolvingInitialTab ? (
            <LatestSubmissionSkeleton childFirstName={firstName} />
          ) : (
            <>
              {hasPendingSubmission && latestScores && (
                <div
                  role="status"
                  className="rounded-xl border border-brand-200/80 bg-brand-50/80 dark:border-brand-800/60 dark:bg-brand-950/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-foreground"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 shrink-0">
                      <Clock className="size-4 text-primary" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-medium text-foreground min-w-0">
                      New worksheet received · waiting for teacher review
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTab("progress");
                    }}
                    className="h-11 sm:h-9 text-xs font-medium shrink-0 cursor-pointer bg-card"
                  >
                    View history
                  </Button>
                </div>
              )}
              <LatestSubmissionCard
                key={selectedChildId}
                userId={userId}
                childId={selectedChildId}
                childName={selectedChild.fullName}
                history={history}
                onOpenRubric={openRubric}
                onOpenCursiveGuide={openCursiveGuide}
                hasPendingSubmission={hasPendingSubmission}
                hasNoAssignedPractice={practiceLoaded && takeHomeActivities.length === 0}
                onNavigateToWrite={handleNavigateToWrite}
              />
              {showExampleFeedback && (
                <SampleReportPreview
                  onOpenRubric={openRubric}
                  defaultCollapsed={true}
                />
              )}
            </>
          )}
        </TabsContent>

        {/* Tab 2: To-Write (Assigned Take-Home Practice) */}
        <TabsContent value="to-write" className="space-y-6">
          <section
            id="assigned-take-home-section"
            aria-labelledby="take-home-heading"
            className="space-y-3 scroll-mt-20"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="take-home-heading"
                className="font-heading text-base sm:text-lg font-semibold text-foreground"
              >
                Practice worksheets
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openCursiveGuide()}
                className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer border-border/80"
              >
                <PenTool className="size-3.5" aria-hidden="true" />
                <span>Cursive guide</span>
              </Button>
            </div>

            <TakeHomeActivities
              key={selectedChildId}
              childId={selectedChildId}
              childName={selectedChild.fullName}
              onUploadClick={handleUploadActivity}
              showExpandButton={false}
              onViewScoredHistory={(target) => setInspectedGradeWork(target)}
              gridClassName="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4"
              practiceFocusKey={practiceFocus?.key}
            />
          </section>
        </TabsContent>

        {/* Tab 3: Progress (Trend Chart & Past Worksheets Archive) */}
        <TabsContent value="progress" className="space-y-6">
          <section
            id="progress-trends-section"
            aria-labelledby="progress-trends-heading"
            className="space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="progress-trends-heading"
                className="font-heading text-base sm:text-lg font-semibold text-foreground"
              >
                Progress over time
              </h2>
            </div>

            {historyLoading ? (
              <ProgressTrendSkeleton />
            ) : history && history.length >= 2 ? (
              <div className="rounded-xl border border-border bg-card p-4 sm:p-6 min-w-0">
                <CriterionTrendChart
                  history={history}
                  variant="parent"
                  showScoreDetails={true}
                  practiceFocusKey={practiceFocus?.key}
                />
              </div>
            ) : scoredCount === 1 && history?.[0] ? (
              <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="font-heading text-base font-semibold text-foreground">
                      1 of 2 worksheets checked
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-sans tabular-nums">
                      &ldquo;{history[0].targetText}&rdquo; ({new Date(history[0].submissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}) · Trend chart unlocks after the next worksheet.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-start">
                    <BandBadge score={history[0].compositeScore} band={history[0].compositeBand} size="sm" showDot />
                    {history[0].compositeScore != null && (
                      <span className="font-sans text-sm font-semibold tabular-nums text-foreground">
                        {Math.round(history[0].compositeScore)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Flat 5-Criteria Baseline Summary (no nested cards) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-3 border-t border-border/70 pt-4">
                  {PARENT_CRITERIA_LIST.map((criterion) => {
                    const criterionScore = history[0].scores[criterion.key];
                    const criterionBand = history[0].bands[criterion.key];

                    return (
                      <div key={criterion.key} className="flex sm:flex-col items-center sm:items-start justify-between gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground truncate">
                          {criterion.label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <BandBadge band={criterionBand} score={criterionScore} size="sm" showDot />
                          {criterionScore != null && (
                            <span className="font-sans text-xs font-medium tabular-nums text-muted-foreground">
                              {Math.round(criterionScore)}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8 text-center space-y-3">
                <h3 className="font-heading text-base font-semibold text-foreground">
                  No trend data yet
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Progress charts appear after 2 checked worksheets.
                </p>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleNavigateToWrite}
                    className="h-11 sm:h-9 text-xs sm:text-sm font-medium cursor-pointer"
                  >
                    View practice worksheets
                  </Button>
                </div>
              </div>
            )}
          </section>

          {historyLoading ? (
            <PastWorksheetsSkeleton />
          ) : (
            allHistory !== undefined && allHistory.length > 0 && (
              <PastWorksheetsSection
                history={allHistory}
                childName={selectedChild.fullName}
                onUploadActivity={handleUploadActivity}
              />
            )
          )}
        </TabsContent>

        {/* Tab 4: Grades (Coursework Point Ledger) */}
        <TabsContent value="grades" className="space-y-6">
          {activeTab === "grades" && selectedChildId && (
            <ParentGrades
              key={`${userId}:${selectedChildId}`}
              userId={userId}
              childId={selectedChildId}
              childName={selectedChild.fullName}
              highlightActivityId={gradeDestination ? notificationTargetData?.activityId : undefined}
              onDismissTarget={() => {
                setSelectedTab("grades");
                dismissNotificationTarget("grades");
              }}
              onInspectActivity={setInspectedGradeWork}
            />
          )}
        </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

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
import { QueryRecovery } from "@/components/shared/query-recovery";
import {
  useChildScoreHistory,
  useTakeHomeActivities,
  useChildLatestScores,
} from "@/lib/hooks/use-parent-data";
import { computeStrengthAndFocus } from "@/lib/utils/scoring";
import { formatActivityDueAt } from "@/lib/utils/activity-deadlines";
import { compareParentActivityUrgency, getParentActivityStatus } from "@/lib/utils/parent-activity-status";
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Loader2,
  UserX,
  BookOpen,
  PenTool,
  CheckCircle2,
  Clock3,
  Camera,
  LayoutDashboard,
  ClipboardList,
  TrendingUp,
} from "lucide-react";

type ParentProgressTab = "overview" | "to-write" | "progress";

export function ProgressPageContent() {
  const [rubricOpen, setRubricOpen] = useState(false);
  const [activitiesExpanded, setActivitiesExpanded] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [selectedTab, setSelectedTab] = useState<ParentProgressTab | null>(null);

  const {
    selectedChildId,
    selectedChild,
    isLoading: childrenLoading,
    isError: childrenError,
    isRetrying: childrenRetrying,
    retryChildren,
    openUploadDialog,
    openCursiveGuide,
    userId,
    notificationTarget,
    dismissNotificationTarget,
  } = useParentPortal();

  const [prevChildId, setPrevChildId] = useState<string | null>(selectedChildId);
  if (selectedChildId !== prevChildId) {
    setPrevChildId(selectedChildId);
    setSelectedTab(null);
  }

  const toggleScoreDetails = useCallback(() => {
    setShowScoreDetails((prev) => !prev);
  }, []);

  const handleOpenRubric = useCallback(() => setRubricOpen(true), []);

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
    return takeHomeActivities.filter((a) => getParentActivityStatus(a, now).canSend).length;
  }, [takeHomeActivities, now]);

  const urgentActivities = useMemo(
    () => takeHomeActivities
      .filter((activity) => getParentActivityStatus(activity, now).urgency != null)
      .sort((a, b) => compareParentActivityUrgency(a, b, now)),
    [takeHomeActivities, now]
  );
  const urgentActivity = urgentActivities[0];
  const urgentStatus = urgentActivity ? getParentActivityStatus(urgentActivity, now) : null;
  const notificationTargetData =
    notificationTarget.kind === "valid" &&
      selectedChildId === notificationTarget.target.childId
      ? notificationTarget.target
      : null;
  const notificationDestination = notificationTarget.kind !== "none" ? (
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

  if (childrenError && !selectedChild) {
    return (
      <QueryRecovery
        title="Could not load child profiles"
        description="We could not check your linked child profiles. Please check your connection and try again."
        onRetry={retryChildren}
        isRetrying={childrenRetrying}
      />
    );
  }

  if (!selectedChild) {
    return (
      <>
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
      </>
    );
  }

  const firstName = selectedChild.fullName.trim().split(/\s+/)[0] || selectedChild.fullName;
  const scoredCount = history?.length ?? 0;
  const isZeroState = !historyLoading && allHistory !== undefined && scoredCount === 0;
  const activeTab: ParentProgressTab = selectedTab ?? (isZeroState ? "to-write" : "overview");

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Notification Deep-Link Modal */}
      {notificationDestination}

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

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenRubric}
            aria-haspopup="dialog"
            className="h-9 min-h-[36px] px-2.5 sm:px-3 text-xs sm:text-sm font-medium gap-1.5 justify-center cursor-pointer shadow-2xs"
          >
            <BookOpen className="size-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
            <span className="truncate">How Scores Work</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openCursiveGuide}
            aria-haspopup="dialog"
            className="h-9 min-h-[36px] px-2.5 sm:px-3 text-xs sm:text-sm font-medium gap-1.5 justify-center cursor-pointer shadow-2xs"
          >
            <PenTool className="size-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
            <span className="truncate">Cursive Guide</span>
          </Button>
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

      {urgentActivity && urgentStatus && (
        <div
          role="region"
          aria-label="Practice worksheet needing attention"
          className="rounded-xl border border-band-2/40 bg-band-2/10 dark:bg-band-2/15 p-3 sm:p-3.5 text-foreground shadow-2xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="size-8 rounded-lg bg-band-2/20 text-band-2-text dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                {urgentStatus.urgency === "new_photo" ? (
                  <Camera className="size-4" aria-hidden="true" />
                ) : (
                  <Clock3 className="size-4" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-band-2-text dark:text-amber-300 uppercase tracking-wider">
                    {urgentStatus.urgency === "new_photo"
                      ? "New photo needed"
                      : urgentStatus.urgency === "overdue"
                        ? "Past due"
                        : "Due soon"}
                  </span>
                  {urgentActivity.dueAt && (
                    <span className="text-xs text-muted-foreground">
                      · Due {formatActivityDueAt(urgentActivity.dueAt)}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground truncate">
                  {urgentActivity.title}
                </p>
                {urgentActivities.length > 1 && (
                  <button
                    type="button"
                    onClick={handleNavigateToWrite}
                    className="text-xs text-brand-700 dark:text-brand-300 hover:underline cursor-pointer block"
                  >
                    +{urgentActivities.length - 1} more {urgentActivities.length === 2 ? "worksheet needs" : "worksheets need"} attention
                  </button>
                )}
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => handleUploadActivity(urgentActivity.id)}
              aria-haspopup="dialog"
              aria-label={`Send ${urgentStatus.urgency === "new_photo" ? "new " : ""}photo for ${urgentActivity.title}`}
              className="h-9 min-h-[36px] w-full sm:w-auto shrink-0 font-medium text-xs sm:text-sm gap-1.5 cursor-pointer shadow-2xs"
            >
              <Camera className="size-4" aria-hidden="true" />
              <span>{urgentStatus.urgency === "new_photo" ? "Send new photo" : "Send photo"}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Segmented 3-Tab View: Overview, To-Write, Progress */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setSelectedTab(val as ParentProgressTab)}
        className="w-full gap-6"
      >
        <div className="border-b border-border/80">
          <TabsList
            variant="line"
            aria-label={`${firstName}'s portal sections`}
            className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex h-auto gap-1 sm:gap-2 rounded-none bg-transparent p-0"
          >
            <TabsTrigger
              value="overview"
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap min-h-[44px] sm:min-h-[40px] translate-y-[1px] data-active:text-primary data-active:after:bg-primary"
            >
              <LayoutDashboard className="size-4 shrink-0" aria-hidden="true" />
              <span>Overview</span>
            </TabsTrigger>

            <TabsTrigger
              value="to-write"
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap min-h-[44px] sm:min-h-[40px] translate-y-[1px] data-active:text-primary data-active:after:bg-primary"
            >
              <ClipboardList className="size-4 shrink-0" aria-hidden="true" />
              <span>Practice</span>
              {pendingActivitiesCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0 rounded-full text-xs font-bold tabular-nums bg-brand-100/90 dark:bg-brand-950/90 text-brand-800 dark:text-brand-200 border border-brand-200/70 dark:border-brand-800/70">
                  {pendingActivitiesCount}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="progress"
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap min-h-[44px] sm:min-h-[40px] translate-y-[1px] data-active:text-primary data-active:after:bg-primary"
            >
              <TrendingUp className="size-4 shrink-0" aria-hidden="true" />
              <span>Progress</span>
              {allHistory && allHistory.length > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0 rounded-full text-xs font-bold tabular-nums bg-muted text-muted-foreground">
                  {allHistory.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Overview (Coaching Hero + Latest Worksheet) */}
        <TabsContent value="overview" className="space-y-6">
          {isZeroState ? (
            <div className="space-y-6">
              <LatestSubmissionCard
                childId={selectedChildId}
                childName={selectedChild.fullName}
                showScoreDetails={showScoreDetails}
                onNavigateToWrite={handleNavigateToWrite}
              />
              <SampleReportPreview
                onOpenRubric={handleOpenRubric}
                defaultCollapsed={false}
                showScoreDetails={showScoreDetails}
                onToggleScoreDetails={toggleScoreDetails}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="w-full lg:col-span-5">
                <ParentStatusHero
                  childId={selectedChildId}
                  childName={selectedChild.fullName}
                  section={selectedChild.section}
                  history={history ?? []}
                  showScoreDetails={showScoreDetails}
                />
              </div>

              <section
                aria-labelledby="latest-worksheet-heading"
                className="w-full lg:col-span-7 space-y-3"
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
                  onNavigateToWrite={handleNavigateToWrite}
                />
              </section>
            </div>
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
                Practice Worksheets
              </h2>
            </div>

            <TakeHomeActivities
              key={selectedChildId}
              childId={selectedChildId}
              onUploadClick={handleUploadActivity}
              expanded={activitiesExpanded}
              onToggleExpanded={() => setActivitiesExpanded((prev) => !prev)}
              showExpandButton={true}
              gridClassName="grid grid-cols-1 md:grid-cols-2 gap-4"
              practiceFocusKey={practiceFocus?.key}
            />
          </section>

          {isZeroState && (
            <SampleReportPreview
              onOpenRubric={handleOpenRubric}
              defaultCollapsed={true}
              showScoreDetails={showScoreDetails}
              onToggleScoreDetails={toggleScoreDetails}
            />
          )}
        </TabsContent>

        {/* Tab 3: Progress (Trend Chart + Past Worksheets History) */}
        <TabsContent value="progress" className="space-y-6">
          <section
            id="progress-trends-section"
            aria-labelledby="progress-trends-heading"
            className="space-y-3"
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
                className="rounded-xl border border-border bg-card p-8 flex flex-col items-center justify-center min-h-[240px] gap-2.5"
              >
                <Loader2
                  className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="text-sm text-muted-foreground">Loading progress chart...</span>
              </div>
            ) : history && history.length >= 2 ? (
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 min-w-0">
                <CriterionTrendChart
                  history={history}
                  variant="parent"
                  showScoreDetails={showScoreDetails}
                  practiceFocusKey={practiceFocus?.key}
                />
              </div>
            ) : scoredCount === 1 && history?.[0] ? (
              <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4">
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
            ) : (
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8 text-center space-y-3">
                <h3 className="font-heading text-base font-semibold text-foreground">
                  Progress chart unlocks after 2 checked worksheets
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Once {firstName}&apos;s worksheets are checked by their teacher, you&apos;ll see their skill trends over time and full worksheet archive here.
                </p>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleNavigateToWrite}
                    className="min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium cursor-pointer"
                  >
                    View Practice Worksheets
                  </Button>
                </div>
              </div>
            )}
          </section>

          {allHistory !== undefined && allHistory.length > 0 && (
            <PastWorksheetsSection
              history={allHistory}
              childName={selectedChild.fullName}
              showScoreDetails={showScoreDetails}
              onUploadActivity={handleUploadActivity}
            />
          )}
        </TabsContent>
      </Tabs>

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

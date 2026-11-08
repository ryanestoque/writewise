"use client";

import { useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useParentPortal } from "@/components/parent-portal-provider";
import { LatestSubmissionCard } from "@/components/parent/latest-submission-card";
import { TakeHomeActivities } from "@/components/parent/take-home-activities";
import { CriterionTrendChart } from "@/components/dashboard/criterion-trend-chart";
import { RubricReferenceDialog } from "@/components/rubric-reference-dialog";
import { PastWorksheetsSection } from "@/components/parent/submission-history-dialog";
import { SampleReportPreview } from "@/components/parent/sample-report-preview";
import { NotificationWorkDestination } from "@/components/parent/notification-work-destination";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { ParentGrades } from "@/components/gradebook/parent-grades";
import {
  useChildScoreHistory,
  useTakeHomeActivities,
  useChildLatestScores,
} from "@/lib/hooks/use-parent-data";
import { computeStrengthAndFocus, PARENT_CRITERIA_LIST } from "@/lib/utils/scoring";
import { formatActivityDueAt } from "@/lib/utils/activity-deadlines";
import { compareParentActivityUrgency, getParentActivityStatus } from "@/lib/utils/parent-activity-status";
import { useActivityNow } from "@/components/activities/activity-work-status";
import { Button } from "@/components/ui/button";
import { BandBadge } from "@/components/shared/band-badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ChevronDown,
} from "lucide-react";

type ParentProgressTab = "overview" | "to-write" | "progress" | "grades";

export function ProgressPageContent() {
  const searchParams = useSearchParams();
  const [rubricOpen, setRubricOpen] = useState(false);
  const [activitiesExpanded, setActivitiesExpanded] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [selectedTab, setSelectedTab] = useState<ParentProgressTab | null>(null);

  const {
    selectedChildId,
    setSelectedChildId,
    selectedChild,
    children: linkedChildren,
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
    // Retain selectedTab when switching children so parents stay on Practice or Progress
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
    return takeHomeActivities.filter((a) => {
      const status = getParentActivityStatus(a, now);
      return status.canSend && !status.excused;
    }).length;
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
  const gradeDestination = notificationTargetData?.view === "grades";
  const notificationDestination = notificationTarget.kind !== "none" && !gradeDestination ? (
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
  const requestedGrades = searchParams.getAll("tab").length === 1 && searchParams.get("tab") === "grades";
  const activeTab: ParentProgressTab = gradeDestination ? "grades" : selectedTab ?? (requestedGrades ? "grades" : isZeroState ? "to-write" : "overview");

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Notification Deep-Link Modal */}
      {notificationDestination}

      {/* Mobile-Friendly Child Switcher (Within comfortable one-handed thumb reach) */}
      {linkedChildren && linkedChildren.length > 1 && (
        <div
          role="radiogroup"
          aria-label="Select student profile"
          className="flex sm:hidden items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mt-1 touch-manipulation"
        >
          {linkedChildren.map((child) => {
            const isSelected = child.id === selectedChildId;
            return (
              <button
                key={child.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedChildId(child.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition-all min-h-[36px] touch-manipulation",
                  isSelected
                    ? "bg-brand-700 text-white dark:bg-brand-600 shadow-2xs"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/70"
                )}
              >
                <span className="truncate max-w-[130px]">{child.fullName}</span>
                <span className={cn("text-[10px]", isSelected ? "text-white/80" : "text-muted-foreground")}>
                  ({child.section})
                </span>
              </button>
            );
          })}
        </div>
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

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open penmanship and scoring guides"
              className="inline-flex items-center justify-center gap-2 h-10 min-h-[40px] sm:h-9 sm:min-h-[36px] w-full sm:w-auto px-3 text-xs sm:text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted/60 text-foreground transition-colors cursor-pointer shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring touch-manipulation"
            >
              <BookOpen className="size-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
              <span>Penmanship Guides</span>
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={handleOpenRubric} className="gap-2.5 cursor-pointer py-2">
                <BookOpen className="size-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
                <div className="flex flex-col">
                  <span className="font-medium text-xs sm:text-sm">How Scores Work</span>
                  <span className="text-xs text-muted-foreground">Rubric standards &amp; 5 skill criteria</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openCursiveGuide} className="gap-2.5 cursor-pointer py-2">
                <PenTool className="size-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
                <div className="flex flex-col">
                  <span className="font-medium text-xs sm:text-sm">Interactive Cursive Guide</span>
                  <span className="text-xs text-muted-foreground">Letter mechanics, guidelines &amp; practice</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          className={cn(
            "rounded-xl p-3.5 sm:p-4 text-foreground shadow-2xs border transition-colors",
            urgentStatus.urgency === "new_photo"
              ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
              : "border-band-2/40 bg-band-2/10 dark:bg-band-2/15"
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className={cn(
                  "size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 sm:mt-0",
                  urgentStatus.urgency === "new_photo"
                    ? "bg-primary/15 text-primary"
                    : "bg-band-2/20 text-band-2-text"
                )}
              >
                {urgentStatus.urgency === "new_photo" ? (
                  <Camera className="size-4" aria-hidden="true" />
                ) : (
                  <Clock3 className="size-4" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider",
                      urgentStatus.urgency === "new_photo"
                        ? "text-primary"
                        : "text-band-2-text"
                    )}
                  >
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
              className="h-10 min-h-[40px] sm:h-9 sm:min-h-[36px] w-full sm:w-auto shrink-0 font-medium text-xs sm:text-sm gap-1.5 cursor-pointer shadow-2xs touch-manipulation"
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
        onValueChange={(val) => {
          if (gradeDestination || requestedGrades) {
            dismissNotificationTarget(val === "grades" ? "grades" : null);
          }
          setSelectedTab(val as ParentProgressTab);
        }}
        className="w-full gap-6"
      >
        <div className="border-b border-border/80">
          <TabsList
            variant="line"
            aria-label={`${firstName}'s portal sections`}
            className="w-full sm:w-auto flex overflow-x-auto h-auto gap-1 sm:gap-2 rounded-none bg-transparent p-0"
          >
            <TabsTrigger
              value="overview"
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap min-h-[44px] sm:min-h-[40px] translate-y-[1px] data-active:text-primary data-active:after:bg-primary"
            >
              <LayoutDashboard className="size-4 shrink-0" aria-hidden="true" />
              <span>Latest Feedback</span>
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
            </TabsTrigger>
            <TabsTrigger value="grades" className="min-h-11 px-3 sm:px-4 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap">
              Grades
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="grades">
          {activeTab === "grades" && selectedChildId && (
            <ParentGrades key={`${userId}:${selectedChildId}`} userId={userId} childId={selectedChildId}
              highlightActivityId={gradeDestination ? notificationTargetData?.activityId : undefined}
              onDismissTarget={() => { setSelectedTab("grades"); dismissNotificationTarget(); }} />
          )}
        </TabsContent>

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
            <div className="space-y-6">
              <LatestSubmissionCard
                childId={selectedChildId}
                childName={selectedChild.fullName}
                section={selectedChild.section}
                history={history ?? []}
                showScoreDetails={showScoreDetails}
                onNavigateToWrite={handleNavigateToWrite}
              />
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
              <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-warm">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-100 dark:bg-brand-900/60 text-brand-800 dark:text-brand-200 border border-brand-200 dark:border-brand-800">
                        <CheckCircle2 className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                        Baseline Established
                      </span>
                      {showScoreDetails && history[0].compositeScore != null && (
                        <span className="font-sans text-xs font-semibold tabular-nums text-foreground/80 bg-muted/60 px-2.5 py-0.5 rounded-md border border-border/60">
                          {Math.round(history[0].compositeScore)}% overall
                        </span>
                      )}
                    </div>
                    <h3 className="font-heading text-lg font-semibold text-foreground pt-0.5">
                      Baseline Handwriting Profile
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                      {firstName}&apos;s first scored worksheet (&ldquo;{history[0].targetText}&rdquo;) sets their foundational benchmark across all 5 handwriting skills. When their next worksheet is checked, comparative growth trends and progress milestones will chart here.
                    </p>
                  </div>
                  <div className="shrink-0 self-start sm:self-auto">
                    <BandBadge score={history[0].compositeScore} band={history[0].compositeBand} size="sm" showDot />
                  </div>
                </div>

                {/* 5-Criteria Baseline Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
                  {PARENT_CRITERIA_LIST.map((criterion) => {
                    const criterionScore = history[0].scores[criterion.key];
                    const criterionBand = history[0].bands[criterion.key];

                    return (
                      <div
                        key={criterion.key}
                        className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-2 flex flex-col justify-between"
                      >
                        <span className="text-xs font-semibold text-foreground truncate">
                          {criterion.label}
                        </span>
                        <div className="flex items-center justify-between gap-1.5">
                          <BandBadge band={criterionBand} score={criterionScore} size="sm" showDot />
                          {showScoreDetails && criterionScore != null && (
                            <span className="font-sans text-xs font-medium tabular-nums text-muted-foreground">
                              {Math.round(criterionScore)}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-muted-foreground">
                  <span>First worksheet recorded on {new Date(history[0].submissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span className="font-medium text-brand-700 dark:text-brand-300">Next milestone: Worksheet #2 adds trend lines</span>
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

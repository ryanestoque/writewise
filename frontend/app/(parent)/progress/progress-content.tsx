"use client";

import { useState, useCallback, useMemo } from "react";
import { useParentPortal } from "@/components/parent-portal-provider";
import {
  ParentStatusHero,
  ParentPracticeAtHomeCard,
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
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export function ProgressPageContent() {
  const [rubricOpen, setRubricOpen] = useState(false);
  const [activitiesExpanded, setActivitiesExpanded] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [photoTipsOpen, setPhotoTipsOpen] = useState(false);

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
      {/* Notification Deep-Link Modal (opens cleanly over the page without replacing it with a blank stub) */}
      {notificationTarget.kind !== "none" && (
        <NotificationWorkDestination
          key={`${notificationTargetData?.childId}:${notificationTargetData?.activityId}:${notificationTargetData?.submissionId}`}
          userId={userId}
          target={notificationTargetData}
          childName={selectedChild.fullName}
          onClose={dismissNotificationTarget}
        />
      )}

      {isZeroState ? (
        /* Zero-Score State: Welcome -> Actionable To Do -> Collapsible Example -> Past Uploads -> Help */
        <div className="space-y-6">
          {/* 1. Compact Welcome Hero */}
          <section
            aria-labelledby="zero-state-welcome-heading"
            className="rounded-xl border border-border bg-card shadow-warm p-5 sm:p-6 space-y-2"
          >
            <h1
              id="zero-state-welcome-heading"
              className="font-heading text-xl sm:text-2xl font-bold text-foreground"
            >
              Welcome to {firstName}&apos;s Handwriting Page
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Section {selectedChild.section} · Classroom worksheets checked by your teacher and take-home practice sheets you send from your phone will show up here.
            </p>
          </section>

          {/* 2. To Do (Take-Home Practice First) */}
          <section
            id="assigned-take-home-section"
            aria-labelledby="take-home-onboarding-heading"
            className="space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h2
                  id="take-home-onboarding-heading"
                  className="font-heading text-base sm:text-lg font-semibold text-foreground"
                >
                  To Do at Home
                </h2>
                <p className="text-sm text-muted-foreground">
                  {pendingActivitiesCount > 0
                    ? "Have your child write on paper, take a flat photo in good light, and send it below."
                    : "Take-home practice sheets assigned by your teacher appear here."}
                </p>
              </div>
              {pendingActivitiesCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-800 dark:text-brand-200 bg-brand-100/80 dark:bg-brand-950/80 px-2.5 py-1 rounded-full border border-brand-200/70 dark:border-brand-800/70 shrink-0 shadow-2xs">
                  <span className="size-1.5 rounded-full bg-brand-600 dark:bg-brand-400" aria-hidden="true" />
                  {pendingActivitiesCount} to send
                </span>
              )}
            </div>
            <TakeHomeActivities
              childId={selectedChildId}
              onUploadClick={handleUploadActivity}
              practiceFocusKey={practiceFocus?.key}
            />
          </section>

          {/* 3. Past Worksheets (if an upload is already turned in and awaiting teacher release) */}
          {allHistory && allHistory.length > 0 && (
            <PastWorksheetsSection
              history={allHistory}
              childName={selectedChild.fullName}
              showScoreDetails={showScoreDetails}
              onToggleScoreDetails={toggleScoreDetails}
            />
          )}

          {/* 4. Collapsible Example Report (Collapsed by default, no fake raw % by default) */}
          <SampleReportPreview
            onOpenRubric={handleOpenRubric}
            defaultCollapsed={true}
            showScoreDetails={showScoreDetails}
            onToggleScoreDetails={toggleScoreDetails}
          />

          {/* 5. Consolidated Help Footer */}
          <ParentHelpSection
            onOpenRubric={handleOpenRubric}
            onOpenCursiveGuide={openCursiveGuide}
            photoTipsOpen={photoTipsOpen}
            onTogglePhotoTips={() => setPhotoTipsOpen((prev) => !prev)}
          />
        </div>
      ) : (
        /* Scored State: Priority-Ordered Single Scroll on Mobile, 2-Column Sticky Rail on Desktop */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 1. Status Hero ("How {firstName} is doing") */}
          <div className="w-full lg:col-start-1 lg:col-span-7">
            <ParentStatusHero
              childId={selectedChildId}
              childName={selectedChild.fullName}
              section={selectedChild.section}
              history={history ?? []}
              showScoreDetails={showScoreDetails}
              onToggleScoreDetails={toggleScoreDetails}
            />
          </div>

          {/* 2. To Do (Second on mobile scroll, sticky right column on desktop) */}
          <div
            id="assigned-take-home-section"
            className="w-full lg:col-start-8 lg:col-span-5 lg:row-start-1 lg:row-span-6 scroll-mt-20 lg:sticky lg:top-20 lg:self-start space-y-3"
          >
            <section aria-labelledby="take-home-heading" className="space-y-3">
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

          {/* 3. What to Practice at Home (Practice Focus + Tip + Top Strength Praise) */}
          <div className="w-full lg:col-start-1 lg:col-span-7">
            <ParentPracticeAtHomeCard
              childId={selectedChildId}
              childName={selectedChild.fullName}
            />
          </div>

          {/* 4. Latest Worksheet (Thumbnail + All 5 Handwriting Skills) */}
          <div className="w-full lg:col-start-1 lg:col-span-7">
            <section aria-labelledby="latest-worksheet-heading" className="space-y-3">
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
                onToggleScoreDetails={toggleScoreDetails}
              />
            </section>
          </div>

          {/* 5. Progress Over Time (Composite Line by Default + Expand All 5 Skills) */}
          <div className="w-full lg:col-start-1 lg:col-span-7">
            <section
              id="progress-trends-section"
              aria-labelledby="progress-trends-heading"
              className="space-y-3"
            >
              <div className="space-y-0.5">
                <h2
                  id="progress-trends-heading"
                  className="font-heading text-base sm:text-lg font-semibold text-foreground"
                >
                  Progress Over Time
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  How {firstName}&apos;s handwriting is developing from worksheet to worksheet
                </p>
              </div>

              {historyLoading ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl border border-border bg-card shadow-warm p-8 flex flex-col items-center justify-center min-h-[200px] gap-2.5"
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
                    onToggleScoreDetails={toggleScoreDetails}
                  />
                </div>
              ) : scoredCount === 1 && history?.[0] ? (
                <div className="rounded-xl border border-brand-200 dark:border-brand-900 bg-brand-50/20 dark:bg-brand-950/20 shadow-warm p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-heading text-base font-semibold text-foreground">
                        First Worksheet Checked!
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

          {/* 6. Past Worksheets (Last 3 inline + See all) */}
          <div className="w-full lg:col-start-1 lg:col-span-7">
            <PastWorksheetsSection
              history={allHistory ?? []}
              childName={selectedChild.fullName}
              showScoreDetails={showScoreDetails}
              onToggleScoreDetails={toggleScoreDetails}
            />
          </div>

          {/* 7. Help Footer */}
          <div className="w-full lg:col-start-1 lg:col-span-7">
            <ParentHelpSection
              onOpenRubric={handleOpenRubric}
              onOpenCursiveGuide={openCursiveGuide}
              photoTipsOpen={photoTipsOpen}
              onTogglePhotoTips={() => setPhotoTipsOpen((prev) => !prev)}
            />
          </div>
        </div>
      )}

      {/* How Scores Work Dialog (Parent-friendly plain language) */}
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

function ParentHelpSection({
  onOpenRubric,
  onOpenCursiveGuide,
  photoTipsOpen,
  onTogglePhotoTips,
}: {
  onOpenRubric: () => void;
  onOpenCursiveGuide: () => void;
  photoTipsOpen: boolean;
  onTogglePhotoTips: () => void;
}) {
  return (
    <section
      aria-labelledby="parent-help-heading"
      className="rounded-xl border border-border bg-card/70 shadow-warm p-5 space-y-4"
    >
      <div className="space-y-0.5">
        <h2
          id="parent-help-heading"
          className="font-heading text-base font-semibold text-foreground"
        >
          Guides &amp; Help
        </h2>
        <p className="text-sm text-muted-foreground">
          Quick reference for cursive letters, how feedback works, and taking a clear worksheet photo
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenRubric}
          aria-haspopup="dialog"
          className="h-10 min-h-[40px] justify-start gap-2 text-xs sm:text-sm font-medium border-border/80 hover:bg-muted/50 cursor-pointer px-3.5"
        >
          <BookOpen className="size-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
          <span>How Scores Work</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenCursiveGuide}
          aria-haspopup="dialog"
          className="h-10 min-h-[40px] justify-start gap-2 text-xs sm:text-sm font-medium border-border/80 hover:bg-muted/50 cursor-pointer px-3.5"
        >
          <PenTool className="size-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
          <span>Cursive Letter Guide</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onTogglePhotoTips}
          aria-expanded={photoTipsOpen}
          aria-controls="parent-photo-tips-panel"
          className="h-10 min-h-[40px] justify-between gap-2 text-xs sm:text-sm font-medium border-border/80 hover:bg-muted/50 cursor-pointer px-3.5"
        >
          <span className="inline-flex items-center gap-2">
            <Camera className="size-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
            <span>Photo Tips</span>
          </span>
          {photoTipsOpen ? (
            <ChevronUp className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          )}
        </Button>
      </div>

      {photoTipsOpen && (
        <div
          id="parent-photo-tips-panel"
          className="pt-3 border-t border-border/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm"
        >
          <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
            <p className="font-semibold text-foreground">1. Lay paper flat</p>
            <p className="text-muted-foreground leading-relaxed">
              Place the worksheet on a flat table and hold your phone directly above it.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
            <p className="font-semibold text-foreground">2. Good daylight</p>
            <p className="text-muted-foreground leading-relaxed">
              Avoid dark shadows across the writing lines so pencil strokes stay clear.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
            <p className="font-semibold text-foreground">3. Fit all 4 corners</p>
            <p className="text-muted-foreground leading-relaxed">
              Keep the whole page inside the camera frame without cutting off any words.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

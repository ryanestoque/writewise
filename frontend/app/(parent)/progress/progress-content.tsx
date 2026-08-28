"use client";

import { useParentPortal } from "@/components/parent-portal-provider";
import { LatestSubmissionCard } from "@/components/parent/latest-submission-card";
import { TakeHomeActivities } from "@/components/parent/take-home-activities";
import { CriterionTrendChart } from "@/components/dashboard/criterion-trend-chart";
import { useChildScoreHistory } from "@/lib/hooks/use-parent-data";
import { LineChart, Loader2, UserX } from "lucide-react";

export function ProgressPageContent() {
  const {
    selectedChildId,
    selectedChild,
    isLoading: childrenLoading,
    openUploadDialog,
  } = useParentPortal();

  const { data: history, isLoading: historyLoading } =
    useChildScoreHistory(selectedChildId);

  if (childrenLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="size-8 animate-spin text-brand-600 dark:text-brand-400" />
        <p className="text-sm text-muted-foreground">Loading child profile...</p>
      </div>
    );
  }

  if (!selectedChild) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 rounded-2xl border border-border bg-card shadow-warm text-center space-y-3">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <UserX className="size-6" />
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

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Zone 1: Child Header */}
      <div className="space-y-1">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {selectedChild.fullName}
        </h1>
        <p className="text-sm font-medium text-muted-foreground">
          Section: <span className="text-foreground">{selectedChild.section}</span>
        </p>
      </div>

      {/* Zone 2: Latest Assessment Summary */}
      <section aria-labelledby="latest-assessment-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="latest-assessment-heading"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Latest Assessment &amp; Feedback
          </h2>
        </div>
        <LatestSubmissionCard childId={selectedChildId} />
      </section>

      {/* Zone 3: Progress Trend History */}
      <section aria-labelledby="progress-trends-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="progress-trends-heading"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Progress Over Time
          </h2>
        </div>

        {historyLoading ? (
          <div className="rounded-xl border border-border bg-card shadow-warm p-8 flex flex-col items-center justify-center min-h-[260px] gap-2.5">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading trend history...</span>
          </div>
        ) : history && history.length >= 2 ? (
          <div className="rounded-xl border border-border bg-card shadow-warm p-4 sm:p-5">
            <CriterionTrendChart history={history} />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-warm p-8 text-center space-y-3">
            <div className="flex justify-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                <LineChart className="size-6" />
              </div>
            </div>
            <h3 className="font-heading text-base font-semibold text-foreground">
              Trend Charts Coming Soon
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Progress trend lines will appear once your child completes two or more scored handwriting activities.
            </p>
          </div>
        )}
      </section>

      {/* Zone 4: Assigned Take-Home Activities */}
      <section aria-labelledby="take-home-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="take-home-heading"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Assigned Take-Home Worksheets
          </h2>
        </div>
        <TakeHomeActivities
          childId={selectedChildId}
          onUploadClick={(activityId) => openUploadDialog(activityId)}
        />
      </section>
    </div>
  );
}

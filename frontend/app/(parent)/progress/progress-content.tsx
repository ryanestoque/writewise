"use client";

import { useState } from "react";
import { useParentPortal } from "@/components/parent-portal-provider";
import { LatestSubmissionCard } from "@/components/parent/latest-submission-card";
import { TakeHomeActivities } from "@/components/parent/take-home-activities";
import { CriterionTrendChart } from "@/components/dashboard/criterion-trend-chart";
import { ParentRubricDialog } from "@/components/parent/parent-rubric-dialog";
import { SubmissionHistoryDialog } from "@/components/parent/submission-history-dialog";
import { useChildScoreHistory } from "@/lib/hooks/use-parent-data";
import { Button } from "@/components/ui/button";
import {
  FileText,
  LineChart,
  ClipboardList,
  Loader2,
  UserX,
  BookOpen,
  Info,
  History,
} from "lucide-react";

export function ProgressPageContent() {
  const [rubricOpen, setRubricOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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

  const historyCount = history?.length ?? 0;

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Zone 1: Child Header & Quick Guides */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/60">
        <div className="space-y-0.5">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {selectedChild.fullName}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
            Section <span className="text-foreground font-semibold">{selectedChild.section}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {historyCount > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              className="h-9 gap-1.5 text-xs font-medium border-border/80 hover:bg-muted/50 cursor-pointer"
            >
              <History className="size-3.5 text-brand-600 dark:text-brand-400" />
              <span>All Worksheets ({historyCount})</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRubricOpen(true)}
            className="h-9 gap-1.5 text-xs font-medium border-border/80 hover:bg-muted/50 cursor-pointer"
          >
            <BookOpen className="size-3.5 text-brand-600 dark:text-brand-400" />
            <span>Understanding Rubrics</span>
          </Button>
        </div>
      </div>

      {/* 2-Column Responsive Grid on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Latest Assessment & Diagnostic Feedback */}
        <div className="lg:col-span-5 space-y-6">
          <section aria-labelledby="latest-assessment-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                id="latest-assessment-heading"
                className="font-heading text-base sm:text-lg font-semibold text-foreground flex items-center gap-2"
              >
                <FileText className="size-4 text-brand-600 dark:text-brand-400" />
                <span>Latest Assessment &amp; Diagnostic Feedback</span>
              </h2>
            </div>
            <LatestSubmissionCard
              childId={selectedChildId}
              childName={selectedChild.fullName}
              onViewHistoryClick={() => setHistoryOpen(true)}
              historyCount={historyCount}
            />
          </section>
        </div>

        {/* Right Column: Assigned Worksheets & Progress Trend */}
        <div className="lg:col-span-7 space-y-6">
          {/* Zone 3: Assigned Take-Home Activities */}
          <section aria-labelledby="take-home-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                id="take-home-heading"
                className="font-heading text-base sm:text-lg font-semibold text-foreground flex items-center gap-2"
              >
                <ClipboardList className="size-4 text-brand-600 dark:text-brand-400" />
                <span>Assigned Take-Home Worksheets</span>
              </h2>
            </div>
            <TakeHomeActivities
              childId={selectedChildId}
              onUploadClick={(activityId) => openUploadDialog(activityId)}
            />
          </section>

          {/* Zone 4: Progress Trend History */}
          <section aria-labelledby="progress-trends-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                id="progress-trends-heading"
                className="font-heading text-base sm:text-lg font-semibold text-foreground flex items-center gap-2"
              >
                <LineChart className="size-4 text-brand-600 dark:text-brand-400" />
                <span>Progress Over Time</span>
              </h2>
            </div>

            {historyLoading ? (
              <div className="rounded-xl border border-border bg-card shadow-warm p-8 flex flex-col items-center justify-center min-h-[220px] gap-2.5">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Loading trend history...</span>
              </div>
            ) : history && history.length >= 2 ? (
              <div className="rounded-xl border border-border bg-card shadow-warm p-4 sm:p-5">
                <CriterionTrendChart history={history} />
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card/60 shadow-warm p-5 sm:p-6 flex items-start gap-3.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0 mt-0.5">
                  <Info className="size-4.5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading text-sm font-semibold text-foreground">
                    Longitudinal Trends Coming Soon
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Progress trajectory lines across the 5 penmanship criteria will appear here once your child completes two or more scored worksheets.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Dialogs */}
      <ParentRubricDialog open={rubricOpen} onOpenChange={setRubricOpen} />
      <SubmissionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        history={history ?? []}
        childName={selectedChild.fullName}
      />
    </div>
  );
}

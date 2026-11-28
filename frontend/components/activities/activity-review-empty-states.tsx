"use client";

import { memo, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Inbox,
  SearchX,
  CheckCircle2,
  CheckCheck,
  RotateCcw,
  Upload,
  FileCheck,
  ScanLine,
  UserCheck,
  ClipboardList,
} from "lucide-react";
import type { SubmissionFilter } from "@/components/activities/activity-review-toolbar";

export interface ActivityReviewEmptyStatesProps {
  statusFilter: SubmissionFilter;
  searchQuery: string;
  hasSubmissions: boolean;
  assignedStudentsCount: number;
  studentsWithoutUploadsCount: number;
  resultUnit: string;
  viewAllLabel: string;
  onClearSearch: () => void;
  onSetStatusFilter: (filter: SubmissionFilter) => void;
  onOpenUpload: () => void;
}

const filterConfig: Record<
  string,
  {
    title: string;
    description: string;
    icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  }
> = {
  ready: {
    title: "No worksheets ready to release",
    description: "All scored worksheets have already been released to students and parents.",
    icon: FileCheck,
  },
  returned: {
    title: "No returned worksheets",
    description: "There are currently no worksheets flagged or returned for resubmission.",
    icon: RotateCcw,
  },
  processing: {
    title: "No worksheets processing",
    description: "No handwriting worksheets are currently undergoing AI analysis.",
    icon: ScanLine,
  },
  released: {
    title: "No released worksheets",
    description: "No student worksheet results have been published for this activity yet.",
    icon: CheckCheck,
  },
  excused: {
    title: "No excused students",
    description: "No students are currently marked as excused for this activity.",
    icon: UserCheck,
  },
  needs_upload: {
    title: "No pending uploads",
    description: "All students currently have valid submissions on file.",
    icon: ClipboardList,
  },
  no_upload: {
    title: "No unsubmitted worksheets",
    description: "Every student in this roster has at least one worksheet upload.",
    icon: ClipboardList,
  },
  missing: {
    title: "No missing submissions",
    description: "There are currently no missing student worksheets for this activity.",
    icon: ClipboardList,
  },
};

export const ActivityReviewEmptyStates = memo(function ActivityReviewEmptyStates({
  statusFilter,
  searchQuery,
  hasSubmissions,
  assignedStudentsCount,
  studentsWithoutUploadsCount,
  resultUnit,
  viewAllLabel,
  onClearSearch,
  onSetStatusFilter,
  onOpenUpload,
}: ActivityReviewEmptyStatesProps) {
  const isSearchActive = Boolean(searchQuery.trim());

  return (
    <Card className="gap-0 p-0">
      {!isSearchActive &&
      (statusFilter === "needs_scoring" || statusFilter === "needs_action") ? (
        hasSubmissions ? (
          /* All pending worksheets graded */
          <Empty className="border-0 py-10 sm:py-12 px-4">
            <EmptyMedia
              variant="icon"
              className="size-11 rounded-xl bg-muted text-muted-foreground border border-border/40"
            >
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </EmptyMedia>
            <EmptyHeader className="max-w-md">
              <EmptyTitle className="text-base sm:text-lg font-medium tracking-tight text-foreground">
                No worksheets pending review
              </EmptyTitle>
              <EmptyDescription className="mx-auto max-w-sm text-xs sm:text-sm text-muted-foreground">
                All submitted worksheets for this activity have been reviewed and scored.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex flex-row flex-wrap items-center justify-center gap-2 max-w-none">
              <Button
                variant="outline"
                onClick={() => onSetStatusFilter("all")}
                className="min-h-11 md:min-h-9 px-3.5 text-xs font-medium sm:text-sm"
              >
                {viewAllLabel}
              </Button>
              {studentsWithoutUploadsCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => onSetStatusFilter("missing")}
                  className="min-h-11 md:min-h-9 px-3.5 text-xs font-medium text-muted-foreground hover:text-foreground sm:text-sm"
                >
                  View missing ({studentsWithoutUploadsCount})
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => onSetStatusFilter("released")}
                className="min-h-11 md:min-h-9 px-3.5 text-xs font-medium sm:text-sm"
              >
                View released results
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          /* No worksheets submitted yet to score */
          <Empty className="border-0 py-10 sm:py-12 px-4">
            <EmptyMedia
              variant="icon"
              className="size-11 rounded-xl bg-muted text-muted-foreground border border-border/40"
            >
              <Inbox className="size-5" aria-hidden="true" />
            </EmptyMedia>
            <EmptyHeader className="max-w-md">
              <EmptyTitle className="text-base sm:text-lg font-medium tracking-tight text-foreground">
                No worksheets to score yet
              </EmptyTitle>
              <EmptyDescription className="mx-auto max-w-sm text-xs sm:text-sm text-muted-foreground">
                None of the assigned students have turned in a worksheet for this activity yet.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex flex-row flex-wrap items-center justify-center gap-2 max-w-none">
              <Button
                variant="outline"
                onClick={() => onSetStatusFilter("all")}
                className="min-h-11 md:min-h-9 px-3.5 text-xs font-medium sm:text-sm"
              >
                {viewAllLabel}
              </Button>
              {studentsWithoutUploadsCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => onSetStatusFilter("missing")}
                  className="min-h-11 md:min-h-9 px-3.5 text-xs font-medium text-muted-foreground hover:text-foreground sm:text-sm"
                >
                  View missing ({studentsWithoutUploadsCount})
                </Button>
              )}
              <Button
                className="min-h-11 md:min-h-9 px-3.5 text-xs font-medium sm:text-sm"
                onClick={onOpenUpload}
              >
                <Upload data-icon="inline-start" aria-hidden="true" />
                <span>Upload worksheet</span>
              </Button>
            </EmptyContent>
          </Empty>
        )
      ) : !isSearchActive &&
        (statusFilter === "no_upload" || statusFilter === "missing") &&
        assignedStudentsCount > 0 ? (
        /* All-Turned-In state */
        <Empty className="border-0 py-10 sm:py-12 px-4">
          <EmptyMedia
            variant="icon"
            className="size-11 rounded-xl bg-muted text-muted-foreground border border-border/40"
          >
            <CheckCheck className="size-5" aria-hidden="true" />
          </EmptyMedia>
          <EmptyHeader className="max-w-md">
            <EmptyTitle className="text-base sm:text-lg font-medium tracking-tight text-foreground">
              No missing submissions
            </EmptyTitle>
            <EmptyDescription className="mx-auto max-w-sm text-xs sm:text-sm text-muted-foreground">
              Every assigned student has turned in their cursive handwriting activity sheet.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex flex-row flex-wrap items-center justify-center gap-2 max-w-none">
            <Button
              variant="outline"
              onClick={() => onSetStatusFilter("all")}
              className="min-h-11 md:min-h-9 px-3.5 text-xs font-medium sm:text-sm"
            >
              {viewAllLabel}
            </Button>
          </EmptyContent>
        </Empty>
      ) : isSearchActive ? (
        /* Search with 0 results */
        <Empty className="border-0 py-10 sm:py-12 px-4">
          <EmptyMedia
            variant="icon"
            className="size-11 rounded-xl bg-muted text-muted-foreground border border-border/40"
          >
            <SearchX className="size-5" aria-hidden="true" />
          </EmptyMedia>
          <EmptyHeader className="max-w-md">
            <EmptyTitle className="text-base sm:text-lg font-medium tracking-tight text-foreground">
              No {resultUnit}s matching &quot;{searchQuery.trim()}&quot;
            </EmptyTitle>
            <EmptyDescription className="mx-auto max-w-sm text-xs sm:text-sm text-muted-foreground">
              We couldn&apos;t find any {resultUnit}s matching this query. Check for typos or reset your search.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex flex-row flex-wrap items-center justify-center gap-2 max-w-none">
            <Button
              variant="outline"
              onClick={onClearSearch}
              className="min-h-11 md:min-h-9 px-3.5 text-xs font-medium sm:text-sm"
            >
              Clear search
            </Button>
            {statusFilter !== "all" && (
              <Button
                variant="ghost"
                onClick={() => onSetStatusFilter("all")}
                className="min-h-11 md:min-h-9 px-3.5 text-xs font-medium text-muted-foreground hover:text-foreground sm:text-sm"
              >
                {viewAllLabel}
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        (() => {
          const config = filterConfig[statusFilter];
          const FilterIcon = config?.icon ?? Inbox;
          const emptyTitle = config?.title ?? `No matching ${resultUnit}s`;
          const emptyDescription =
            config?.description ??
            "There are currently no student worksheets under this review status.";

          return (
            /* Specific status filter with 0 results */
            <Empty className="border-0 py-10 sm:py-12 px-4">
              <EmptyMedia
                variant="icon"
                className="size-11 rounded-xl bg-muted text-muted-foreground border border-border/40"
              >
                <FilterIcon className="size-5" aria-hidden="true" />
              </EmptyMedia>
              <EmptyHeader className="max-w-md">
                <EmptyTitle className="text-base sm:text-lg font-medium tracking-tight text-foreground">
                  {emptyTitle}
                </EmptyTitle>
                <EmptyDescription className="mx-auto max-w-sm text-xs sm:text-sm text-muted-foreground">
                  {emptyDescription}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex flex-row flex-wrap items-center justify-center gap-2 max-w-none">
                <Button
                  variant="outline"
                  onClick={() => onSetStatusFilter("all")}
                  className="min-h-11 md:min-h-9 px-3.5 text-xs font-medium sm:text-sm"
                >
                  {viewAllLabel}
                </Button>
              </EmptyContent>
            </Empty>
          );
        })()
      )}
    </Card>
  );
});

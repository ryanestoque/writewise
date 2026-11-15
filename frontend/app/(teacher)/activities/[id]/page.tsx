"use client";

import { use, useState, useMemo, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ActivityThreads } from "@/components/comments/activity-threads";

import { commentThreadHref, parseTeacherCommentTarget } from "@/lib/comments/targets";
import {
  type Activity,
  useActivity,
  useToggleArchive,
} from "@/lib/hooks/use-activities";
import { ActivityReviewQueue } from "@/components/activities/activity-review-queue";
import {
  buildReviewRows, countReviewRows, filterReviewRows, sortReviewRows,
  type ReviewFilter, type ReviewSort,
} from "@/lib/utils/activity-review";
import { useActivityWork } from "@/lib/hooks/use-activity-work";

import { activityAssignedTo } from "@/lib/utils/activity-work";
import { useStudents } from "@/lib/hooks/use-students";
import { useSubmissions } from "@/lib/hooks/use-submissions";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import { EditActivityDialog } from "@/components/activities/edit-activity-dialog";
import { DeleteActivityDialog } from "@/components/activities/delete-activity-dialog";
import { CreateActivityDialog } from "@/components/activities/create-activity-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { FilterPills, type FilterPillItem } from "@/components/ui/filter-pills";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ArrowLeft,
  ClipboardList,
  AlertCircle,
  RotateCcw,
  ArrowUpDown,
  Check,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { getWordCount } from "@/lib/utils/formatters";
import {
  getScoreBandLabel,
  resolveSubmissionScore,
} from "@/lib/utils/submission-status";
import {
  ActivityDetailHero,
  type ClassDiagnosticSummary,
} from "@/components/activities/activity-detail-hero";

type SubmissionFilter = ReviewFilter;
type SubmissionSort = ReviewSort;

export default function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const workQuery = useActivityWork(id);
  const activeIds = useMemo(() => new Set((workQuery.data ?? [])
    .map((row) => row.active_submission_id).filter((id): id is string => !!id)), [workQuery.data]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const commentTarget = parseTeacherCommentTarget(searchParams, id);
  const closeComments = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("student"); next.delete("view");
    router.replace(`/activities/${id}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const { data: activity, isLoading, error, refetch } = useActivity(id);
  const { data: students, isLoading: rosterLoading, isError: rosterError, refetch: refetchStudents } = useStudents();
  const {
    data: submissions,
    isLoading: submissionsLoading,
    error: submissionsError,
    refetch: refetchSubmissions,
  } = useSubmissions(id);
  const { openUpload } = useTeacherModals();
  const { mutate: toggleArchive } = useToggleArchive();

  // Dialog states
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [hasCopiedPrompt, setHasCopiedPrompt] = useState(false);

  // Search, filter, and sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubmissionFilter>("attention");
  const [sortBy, setSortBy] = useState<SubmissionSort>("attention");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Shortcut key listener for '/' and 'U'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const targetTag = target?.tagName;
      const isContentEditable = Boolean(target?.isContentEditable);
      const isInput =
        ["INPUT", "TEXTAREA", "SELECT"].includes(targetTag || "") ||
        isContentEditable;
      if (isInput) return;

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (
        e.key.toLowerCase() === "u" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        openUpload({ activityId: id });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, openUpload]);

  // Roster Metrics: Unique enrolled students with submissions
  const submittedStudentIds = useMemo(() => {
    if (!submissions) return new Set<string>();
    return new Set(submissions.filter((s) => activeIds.has(s.id) &&
      students?.some((student) => student.id === s.student_id && !!activity && activityAssignedTo(activity, student))
    ).map((s) => s.student_id));
  }, [submissions, students, activity, activeIds]);

  const uniqueStudentsCount = submittedStudentIds.size;
  const assignedStudents = useMemo(
    () => (students ?? []).filter(student => !!activity && activityAssignedTo(activity, student)),
    [students, activity]
  );
  const totalStudents = assignedStudents.length;
  const totalScansCount = submissions?.length ?? 0;
  const completionRate =
    totalStudents > 0
      ? Math.min(100, Math.round((uniqueStudentsCount / totalStudents) * 100))
      : 0;

  // Class Diagnostic Synthesis: Calculate class average and priority criteria
  const classDiagnostics = useMemo<ClassDiagnosticSummary | null>(() => {
    if (!submissions) return null;
    const scoredSubmissions = submissions
      .map((s) => ({ submission: s, resolved: resolveSubmissionScore(s) }))
      .filter(
        (item) => activeIds.has(item.submission.id) && item.resolved.isScored
      );
    if (scoredSubmissions.length === 0) return null;

    let totalComposite = 0;
    let totalFormation = 0;
    let totalSize = 0;
    let totalSpacing = 0;
    let totalSlant = 0;
    let totalBaseline = 0;
    let formationCount = 0;
    let sizeCount = 0;
    let spacingCount = 0;
    let slantCount = 0;
    let baselineCount = 0;

    for (const { resolved } of scoredSubmissions) {
      if (resolved.compositeScore != null) {
        totalComposite += resolved.compositeScore;
      }
      if (resolved.criteriaScores.letterFormation != null) {
        totalFormation += resolved.criteriaScores.letterFormation;
        formationCount++;
      }
      if (resolved.criteriaScores.sizeConsistency != null) {
        totalSize += resolved.criteriaScores.sizeConsistency;
        sizeCount++;
      }
      if (resolved.criteriaScores.spacing != null) {
        totalSpacing += resolved.criteriaScores.spacing;
        spacingCount++;
      }
      if (resolved.criteriaScores.slant != null) {
        totalSlant += resolved.criteriaScores.slant;
        slantCount++;
      }
      if (resolved.criteriaScores.baselineAlignment != null) {
        totalBaseline += resolved.criteriaScores.baselineAlignment;
        baselineCount++;
      }
    }

    const avgComposite = Math.round(totalComposite / scoredSubmissions.length);
    const avgFormation = formationCount
      ? Math.round(totalFormation / formationCount)
      : 0;
    const avgSize = sizeCount ? Math.round(totalSize / sizeCount) : 0;
    const avgSpacing = spacingCount
      ? Math.round(totalSpacing / spacingCount)
      : 0;
    const avgSlant = slantCount ? Math.round(totalSlant / slantCount) : 0;
    const avgBaseline = baselineCount
      ? Math.round(totalBaseline / baselineCount)
      : 0;

    const criteriaList = [
      { name: "Letter Formation", score: avgFormation },
      { name: "Size Consistency", score: avgSize },
      { name: "Spacing", score: avgSpacing },
      { name: "Slant Consistency", score: avgSlant },
      { name: "Baseline Alignment", score: avgBaseline },
    ].filter((c) => c.score > 0);

    criteriaList.sort((a, b) => b.score - a.score);

    return {
      completedCount: scoredSubmissions.length,
      avgCompositeScore: avgComposite,
      scoreBand: getScoreBandLabel(avgComposite),
      criteriaAverages: {
        letterFormation: avgFormation,
        sizeConsistency: avgSize,
        spacing: avgSpacing,
        slant: avgSlant,
        baselineAlignment: avgBaseline,
      },
      strongestCriterion:
        criteriaList.length > 0 ? criteriaList[0] : null,
      focusCriterion:
        criteriaList.length > 1
          ? criteriaList[criteriaList.length - 1]
          : null,
    };
  }, [submissions, activeIds]);

  // One roster model drives both layouts, counts, filters and announcements.
  const reviewRows = useMemo(
    () => buildReviewRows(assignedStudents, submissions ?? [], workQuery.data ?? []),
    [assignedStudents, submissions, workQuery.data]
  );
  const workspaceReady = !rosterLoading && !rosterError && !submissionsLoading &&
    !submissionsError && !workQuery.isLoading && !workQuery.isError;
  const counts = useMemo(() => countReviewRows(reviewRows), [reviewRows]);
  const visibleRows = useMemo(() => sortReviewRows(
    filterReviewRows(reviewRows, statusFilter, searchQuery), sortBy,
    submission => resolveSubmissionScore(submission).compositeScore
  ), [reviewRows, statusFilter, searchQuery, sortBy]);
  const submissionFilterItems = useMemo<FilterPillItem<SubmissionFilter>[]>(() => [
    { id: "attention", label: "Needs attention", count: workspaceReady ? counts.attention : "?" },
    { id: "awaiting", label: "Awaiting upload", count: workspaceReady ? counts.awaiting : "?" },
    { id: "all", label: "All students", count: workspaceReady ? counts.all : "?" },
    { id: "completed", label: "Latest analyzed", count: workspaceReady ? counts.completed : "?" },
    { id: "processing", label: "Processing", count: workspaceReady ? counts.processing : "?" },
    { id: "rejected", label: "Rejected", count: workspaceReady ? counts.rejected : "?" },
    { id: "returned", label: "Returned", count: workspaceReady ? counts.returned : "?" },
  ], [counts, workspaceReady]);
  const handleToggleArchive = useCallback(() => {
    if (!activity) return;
    toggleArchive(activity.id, {
      onSuccess: (result) => {
        toast.success(
          result.is_archived
            ? "Activity moved to archive."
            : "Activity restored from archive.",
          {
            action: {
              label: "Undo",
              onClick: () => toggleArchive(activity.id),
            },
          }
        );
      },
      onError: () => {
        toast.error("Failed to update activity archive state.");
      },
    });
  }, [activity, toggleArchive]);

  const handleCopyPrompt = useCallback(() => {
    if (!activity) return;
    if (!navigator.clipboard?.writeText) {
      toast.error("Clipboard copy is not supported in this environment.");
      return;
    }
    navigator.clipboard
      .writeText(activity.target_text)
      .then(() => {
        setHasCopiedPrompt(true);
        toast.success("Target prompt copied to clipboard.");
        setTimeout(() => setHasCopiedPrompt(false), 2000);
      })
      .catch(() => {
        toast.error("Failed to copy target prompt.");
      });
  }, [activity]);

  const handleOpenUpload = useCallback(() => {
    openUpload({ activityId: id });
  }, [openUpload, id]);

  const handleEditActivity = useCallback(() => {
    if (activity) setEditingActivity(activity);
  }, [activity]);

  const handleDuplicateActivity = useCallback(() => {
    setIsDuplicateOpen(true);
  }, []);

  const handleDeleteActivity = useCallback(() => {
    if (activity) setDeletingActivity(activity);
  }, [activity]);

  const handleReupload = useCallback(
    (studentId?: string) => {
      openUpload({ activityId: id, studentId });
    },
    [id, openUpload]
  );

  if (error) {
    return (
      <div className="w-full space-y-5 sm:space-y-6 pb-28 sm:pb-24 px-1 sm:px-0">
        <div>
          <Link
            href="/activities"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Activities</span>
          </Link>
        </div>
        <div
          role="alert"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">
              Activity not found or unable to load. Please check your connection and try again.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-destructive/30 hover:bg-destructive/10 text-destructive cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-5 sm:space-y-6 pb-28 sm:pb-24 px-1 sm:px-0">
        <Skeleton className="h-4 w-40" />
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-6 space-y-4 shadow-warm">
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-1/3 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-6 space-y-4 shadow-warm">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-8 w-44 rounded-lg" />
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-4/3 w-full rounded-xl" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="w-full space-y-5 sm:space-y-6 pb-28 sm:pb-24 px-1 sm:px-0">
        <div>
          <Link
            href="/activities"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Activities</span>
          </Link>
        </div>
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-warm overflow-hidden">
          <Empty className="py-14 border-0">
            <EmptyMedia
              variant="icon"
              className="bg-muted text-muted-foreground"
            >
              <ClipboardList className="w-6 h-6" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>Activity not found</EmptyTitle>
              <EmptyDescription>
                This activity may have been removed or you don&apos;t have
                access.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link
                href="/activities"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "rounded-lg sm:rounded-xl"
                )}
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Activities
              </Link>
            </EmptyContent>
          </Empty>
        </div>
      </div>
    );
  }

  const wordCount = getWordCount(activity.target_text);
  const isArchived = activity.is_archived;

  const currentListLength = visibleRows.length;

  return (
    <div className="w-full min-w-0 space-y-5 sm:space-y-6 pb-28 sm:pb-24">
      {/* Top Back Navigation Trail */}
      <nav aria-label="Breadcrumb navigation" className="print:hidden">
        <Link
          href="/activities"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-lg px-2.5 py-2 min-h-[44px] sm:min-h-[36px] hover:bg-muted/50 -ml-1 sm:-ml-2"
        >
          <ArrowLeft
            className="size-3.5 transition-transform group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
          <span>Back to Activities</span>
        </Link>
      </nav>

      {/* Streamlined Activity Hero Card with Authentic 3-Line Cursive Ruling */}
      <ActivityDetailHero
        activity={activity}
        isArchived={isArchived}
        wordCount={wordCount}
        totalStudents={totalStudents}
        uniqueStudentsCount={uniqueStudentsCount}
        totalScansCount={totalScansCount}
        completionRate={completionRate}
        classDiagnostics={classDiagnostics}
        progressUnavailable={rosterLoading || rosterError || workQuery.isLoading || workQuery.isError || submissionsLoading || !!submissionsError}
        hasCopiedPrompt={hasCopiedPrompt}
        onCopyPrompt={handleCopyPrompt}
        onUpload={handleOpenUpload}
        onEdit={handleEditActivity}
        onDuplicate={handleDuplicateActivity}
        onDelete={handleDeleteActivity}
        onToggleArchive={handleToggleArchive}
      />

      {/* Unified Classroom Submissions Workspace */}
      <section aria-labelledby="submissions-heading" className="space-y-4">
        <h2
          id="submissions-heading"
          className="text-lg sm:text-xl font-heading font-semibold text-foreground tracking-tight"
        >
          Student work
        </h2>
        {/* Filter & Search Bar */}
        {(assignedStudents.length > 0 || !workspaceReady) && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface dark:bg-card p-3 rounded-xl sm:rounded-2xl border border-border shadow-warm">
            {/* Primary controls: Search + Filter Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0 flex-1">
              <SearchInput
                ref={searchInputRef}
                showShortcut={false}
                placeholder="Search student name"
                aria-label="Search submissions by student name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery("")}
                containerClassName="w-full sm:w-56 lg:w-64 shrink-0"
              />

              <FilterPills
                items={submissionFilterItems}
                value={statusFilter}
                onChange={setStatusFilter}
                ariaLabel="Filter submissions by status"
                containerClassName="min-w-0 flex-1"
                pillClassName="min-h-11 sm:min-h-8"
              />
            </div>

            {/* Secondary controls: Sort Selector */}
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/50">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-[36px] text-xs font-medium rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Sort submissions list"
                >
                  <ArrowUpDown className="size-3 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">
                    {sortBy === "attention" && "Needs attention first"}
                    {sortBy === "newest" && "Newest First"}
                    {sortBy === "oldest" && "Oldest First"}
                    {sortBy === "name_asc" && "Student (A-Z)"}
                    {sortBy === "name_desc" && "Student (Z-A)"}
                    {sortBy === "score_desc" && "Highest Score"}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setSortBy("attention")} className="min-h-11 cursor-pointer justify-between text-xs sm:min-h-9">
                    <span>Needs attention first</span>
                    {sortBy === "attention" && <Check className="size-3.5 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("newest")}
                    className="cursor-pointer text-xs justify-between min-h-11 sm:min-h-9"
                  >
                    <span>Newest First</span>
                    {sortBy === "newest" && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("oldest")}
                    className="cursor-pointer text-xs justify-between min-h-11 sm:min-h-9"
                  >
                    <span>Oldest First</span>
                    {sortBy === "oldest" && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("name_asc")}
                    className="cursor-pointer text-xs justify-between min-h-11 sm:min-h-9"
                  >
                    <span>Student (A-Z)</span>
                    {sortBy === "name_asc" && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("name_desc")}
                    className="cursor-pointer text-xs justify-between min-h-11 sm:min-h-9"
                  >
                    <span>Student (Z-A)</span>
                    {sortBy === "name_desc" && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("score_desc")}
                    className="cursor-pointer text-xs justify-between min-h-11 sm:min-h-9"
                  >
                    <span>Highest Score</span>
                    {sortBy === "score_desc" && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {/* Screen Reader Filter & Search Live Announcer */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {workspaceReady && (
            <span>
              {`Showing ${currentListLength} students${
                statusFilter !== "all" ? ` filtered by ${submissionFilterItems.find(item => item.id === statusFilter)?.label}` : ""
              }${searchQuery ? ` matching "${searchQuery}"` : ""}.`}
            </span>
          )}
        </div>

        {/* Search Results Filter Indicator */}
        {searchQuery && workspaceReady && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between text-xs text-muted-foreground px-1"
          >
            <span>
              Showing{" "}
              <strong className="text-foreground">{currentListLength}</strong>{" "}
              matching &ldquo;
              <strong className="text-foreground">{searchQuery}</strong>
              &rdquo;
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-primary hover:underline font-medium cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 py-0.5"
            >
              Clear search
            </button>
          </div>
        )}

        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-warm">
            <ActivityReviewQueue
              activityId={id}
              rows={visibleRows}
              assignedStudentCount={assignedStudents.length}
              rosterLoading={rosterLoading}
              rosterError={rosterError}
              workError={workQuery.isError}
              workLoading={workQuery.isLoading}
              uploadsLoading={submissionsLoading}
              uploadsError={!!submissionsError}
              searchQuery={searchQuery}
              onClearFilters={() => { setSearchQuery(""); setStatusFilter("all"); }}
              onRetryRoster={() => { void refetchStudents(); }}
              onRetryWork={() => { void workQuery.refetch(); }}
              onRetryUploads={() => { void refetchSubmissions(); }}
              onUpload={handleReupload}
              onEdit={handleEditActivity}
            />
        </div>
      </section>
      <details className="group/threads rounded-xl sm:rounded-2xl border border-border bg-surface dark:bg-card p-4 sm:p-6 shadow-warm transition-all">
        <summary className="cursor-pointer py-1 font-heading text-base sm:text-lg font-semibold text-foreground flex items-center justify-between focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-lg select-none list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <span>Classroom Conversations & Comments</span>
          </div>
          <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-open/threads:rotate-180" aria-hidden="true" />
        </summary>
        <div className="pt-4 border-t border-border/50 mt-4">
          <ActivityThreads
            userId={activity.created_by}
            activityId={id}
            onOpen={(target) => router.push(commentThreadHref(target, "teacher"), { scroll: false })}
          />
        </div>
      </details>
      {commentTarget.kind !== "none" && <div role="status" className="rounded-xl border p-4"><p>Choose a worksheet upload to view its comments.</p><Button variant="outline" onClick={closeComments}>Dismiss</Button></div>}
      {/* Edit Activity Dialog */}
      <EditActivityDialog
        activity={editingActivity}
        open={!!editingActivity}
        onOpenChange={(open) => !open && setEditingActivity(null)}
      />

      {/* Duplicate Activity Dialog */}
      <CreateActivityDialog
        open={isDuplicateOpen}
        onOpenChange={setIsDuplicateOpen}
        initialValues={{
          ...activity, due_at: null, close_after_due: false,
          target_text: activity.target_text,
          is_take_home: activity.is_take_home,
        }}
        isDuplicate={true}
      />

      {/* Delete Activity Dialog */}
      <DeleteActivityDialog
        activity={deletingActivity}
        open={!!deletingActivity}
        onOpenChange={(open) => !open && setDeletingActivity(null)}
      />
    </div>
  );
}

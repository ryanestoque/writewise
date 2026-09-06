"use client";

import { use, useState, useMemo, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  type Activity,
  useActivity,
  useToggleArchive,
} from "@/lib/hooks/use-activities";
import { useStudents } from "@/lib/hooks/use-students";
import {
  type Submission,
  useSubmissions,
} from "@/lib/hooks/use-submissions";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import { EditActivityDialog } from "@/components/activities/edit-activity-dialog";
import { DeleteActivityDialog } from "@/components/activities/delete-activity-dialog";
import { CreateActivityDialog } from "@/components/activities/create-activity-dialog";
import { SubmissionDetailDialog } from "@/components/submissions/submission-detail-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
  Upload,
  Inbox,
  AlertCircle,
  RotateCcw,
  SearchX,
  ArrowUpDown,
  GraduationCap,
  Layers,
  Check,
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
import { SubmissionCard } from "@/components/activities/submission-card";
import { ScoringGuidePopover } from "@/components/activities/scoring-guide-popover";

type SubmissionFilter = "all" | "completed" | "processing" | "rejected";
type SubmissionSort =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "score_desc";
type ViewMode = "grouped" | "all";

interface StudentSubmissionGroup {
  studentId: string;
  studentName: string;
  latestSubmission: Submission;
  allSubmissions: Submission[];
  attemptCount: number;
}

export default function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: activity, isLoading, error, refetch } = useActivity(id);
  const { data: students } = useStudents();
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
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null);

  // View, search, filter, and sort states
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubmissionFilter>("all");
  const [sortBy, setSortBy] = useState<SubmissionSort>("newest");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Group attempt selection map (key: studentId, value: Submission)
  const [attemptOverrides, setAttemptOverrides] = useState<
    Map<string, Submission>
  >(new Map());

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
    return new Set(submissions.map((s) => s.student_id).filter(Boolean));
  }, [submissions]);

  const uniqueStudentsCount = submittedStudentIds.size;
  const totalStudents = students?.length ?? 0;
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
        (item) => item.submission.status === "completed" && item.resolved.isScored
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
  }, [submissions]);

  // Student Grouping
  const studentGroups = useMemo<StudentSubmissionGroup[]>(() => {
    if (!submissions) return [];

    const map = new Map<string, Submission[]>();
    for (const sub of submissions) {
      const key = sub.student_id || sub.id;
      const existing = map.get(key) ?? [];
      existing.push(sub);
      map.set(key, existing);
    }

    const groups: StudentSubmissionGroup[] = [];
    map.forEach((subs, key) => {
      const sortedSubs = [...subs].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latest = sortedSubs[0];
      const name =
        latest.student?.full_name ||
        students?.find((s) => s.id === key)?.full_name ||
        "Unknown Student";

      groups.push({
        studentId: key,
        studentName: name,
        latestSubmission: latest,
        allSubmissions: sortedSubs,
        attemptCount: sortedSubs.length,
      });
    });

    return groups;
  }, [submissions, students]);

  // Counts for filter pills
  const counts = useMemo(() => {
    if (!submissions)
      return { all: 0, completed: 0, processing: 0, rejected: 0 };
    if (viewMode === "grouped") {
      return {
        all: studentGroups.length,
        completed: studentGroups.filter(
          (g) => g.latestSubmission.status === "completed"
        ).length,
        processing: studentGroups.filter(
          (g) => g.latestSubmission.status === "processing"
        ).length,
        rejected: studentGroups.filter(
          (g) => g.latestSubmission.status === "rejected"
        ).length,
      };
    }
    return {
      all: submissions.length,
      completed: submissions.filter((s) => s.status === "completed").length,
      processing: submissions.filter((s) => s.status === "processing").length,
      rejected: submissions.filter((s) => s.status === "rejected").length,
    };
  }, [submissions, viewMode, studentGroups]);

  const submissionFilterItems = useMemo<
    FilterPillItem<SubmissionFilter>[]
  >(() => {
    return [
      { id: "all", label: "All", count: counts.all },
      { id: "completed", label: "Completed", count: counts.completed },
      { id: "processing", label: "Processing", count: counts.processing },
      { id: "rejected", label: "Rejected", count: counts.rejected },
    ];
  }, [counts]);

  // Filtered & Sorted Student Groups
  const filteredAndSortedGroups = useMemo(() => {
    let result = studentGroups;

    if (statusFilter !== "all") {
      result = result.filter(
        (g) => g.latestSubmission.status === statusFilter
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((g) =>
        g.studentName.toLowerCase().includes(query)
      );
    }

    return [...result].sort((a, b) => {
      if (sortBy === "newest") {
        return (
          new Date(b.latestSubmission.created_at).getTime() -
          new Date(a.latestSubmission.created_at).getTime()
        );
      }
      if (sortBy === "oldest") {
        return (
          new Date(a.latestSubmission.created_at).getTime() -
          new Date(b.latestSubmission.created_at).getTime()
        );
      }
      if (sortBy === "name_asc") {
        return a.studentName.localeCompare(b.studentName);
      }
      if (sortBy === "name_desc") {
        return b.studentName.localeCompare(a.studentName);
      }
      if (sortBy === "score_desc") {
        const scoreA =
          resolveSubmissionScore(a.latestSubmission).compositeScore ?? -1;
        const scoreB =
          resolveSubmissionScore(b.latestSubmission).compositeScore ?? -1;
        return scoreB - scoreA;
      }
      return 0;
    });
  }, [studentGroups, searchQuery, statusFilter, sortBy]);

  // Filtered & Sorted Raw Submissions (for "All Scans" view mode)
  const filteredAndSortedSubmissions = useMemo(() => {
    if (!submissions) return [];

    let result = submissions;

    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.student?.full_name?.toLowerCase().includes(query)
      );
    }

    return [...result].sort((a, b) => {
      if (sortBy === "newest") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      if (sortBy === "oldest") {
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      if (sortBy === "name_asc") {
        return (a.student?.full_name ?? "").localeCompare(
          b.student?.full_name ?? ""
        );
      }
      if (sortBy === "name_desc") {
        return (b.student?.full_name ?? "").localeCompare(
          a.student?.full_name ?? ""
        );
      }
      if (sortBy === "score_desc") {
        const scoreA = resolveSubmissionScore(a).compositeScore ?? -1;
        const scoreB = resolveSubmissionScore(b).compositeScore ?? -1;
        return scoreB - scoreA;
      }
      return 0;
    });
  }, [submissions, searchQuery, statusFilter, sortBy]);

  // Dialog navigation flat list
  const activeDialogSubmissionsList = useMemo(() => {
    if (viewMode === "grouped") {
      return filteredAndSortedGroups.map(
        (g) => attemptOverrides.get(g.studentId) ?? g.latestSubmission
      );
    }
    return filteredAndSortedSubmissions;
  }, [viewMode, filteredAndSortedGroups, attemptOverrides, filteredAndSortedSubmissions]);

  const currentSubmissionIndex = useMemo(() => {
    if (!selectedSubmission) return -1;
    const directIdx = activeDialogSubmissionsList.findIndex(
      (s) => s.id === selectedSubmission.id
    );
    if (directIdx >= 0) return directIdx;
    if (viewMode === "grouped") {
      return filteredAndSortedGroups.findIndex(
        (g) => g.studentId === selectedSubmission.student_id
      );
    }
    return -1;
  }, [activeDialogSubmissionsList, selectedSubmission, viewMode, filteredAndSortedGroups]);

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

  const handleSelectSubmission = useCallback((sub: Submission) => {
    setSelectedSubmission(sub);
  }, []);

  const handleReupload = useCallback(
    (studentId?: string) => {
      openUpload({ activityId: id, studentId });
    },
    [id, openUpload]
  );

  const handleSelectAttempt = useCallback(
    (studentId: string, sub: Submission) => {
      setAttemptOverrides((prev) => {
        const next = new Map(prev);
        next.set(studentId, sub);
        return next;
      });
    },
    []
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

  const currentListLength =
    viewMode === "grouped"
      ? filteredAndSortedGroups.length
      : filteredAndSortedSubmissions.length;

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
        hasCopiedPrompt={hasCopiedPrompt}
        onCopyPrompt={handleCopyPrompt}
        onUpload={() => openUpload({ activityId: id })}
        onEdit={() => setEditingActivity(activity)}
        onDuplicate={() => setIsDuplicateOpen(true)}
        onDelete={() => setDeletingActivity(activity)}
        onToggleArchive={handleToggleArchive}
      />

      {/* Submissions Section */}
      <section aria-labelledby="submissions-heading" className="space-y-4">
        {/* Section Header with Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2
              id="submissions-heading"
              className="text-lg sm:text-xl font-heading font-semibold text-foreground tracking-tight"
            >
              Student Submissions
            </h2>
            {submissions && (
              <Badge
                variant="outline"
                className="text-xs font-semibold px-2.5 py-0.5 bg-muted/50 text-muted-foreground border-border"
              >
                {viewMode === "grouped"
                  ? `${studentGroups.length} ${studentGroups.length === 1 ? "student" : "students"}`
                  : `${submissions.length} ${submissions.length === 1 ? "scan" : "scans"}`}
              </Badge>
            )}
          </div>

          {/* View Mode Switcher (Grouped by Student vs All Scans) */}
          {submissions && submissions.length > 0 && (
            <div
              role="radiogroup"
              aria-label="Submission display grouping"
              className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/60 self-start sm:self-auto shrink-0"
            >
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === "grouped"}
                onClick={() => setViewMode("grouped")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] sm:min-h-[28px] text-xs font-medium rounded-md transition-all cursor-pointer",
                  viewMode === "grouped"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <GraduationCap className="size-3.5" />
                <span>By Student</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={viewMode === "all"}
                onClick={() => setViewMode("all")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] sm:min-h-[28px] text-xs font-medium rounded-md transition-all cursor-pointer",
                  viewMode === "all"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Layers className="size-3.5" />
                <span>All Scans</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter & Search Bar */}
        {submissions && submissions.length > 0 && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface dark:bg-card p-3 rounded-xl sm:rounded-2xl border border-border shadow-warm">
            {/* Primary controls: Search + Filter Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0 flex-1">
              {/* Search Student Input with '/' shortcut hint */}
              <SearchInput
                ref={searchInputRef}
                placeholder="Search student name... (/)"
                aria-label="Search submissions by student name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery("")}
                containerClassName="w-full sm:w-56 lg:w-64 shrink-0"
              />

              <FilterPills
                items={submissionFilterItems}
                value={statusFilter}
                onChange={(newFilter) => setStatusFilter(newFilter)}
                ariaLabel="Filter submissions by status"
                containerClassName="min-w-0 flex-1"
              />
            </div>

            {/* Secondary controls: Sort Selector + Rubric Guide Trigger */}
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/50">
              {/* Sort Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-[36px] text-xs font-medium rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Sort submissions list"
                >
                  <ArrowUpDown className="size-3 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground">
                    {sortBy === "newest" && "Newest First"}
                    {sortBy === "oldest" && "Oldest First"}
                    {sortBy === "name_asc" && "Student (A-Z)"}
                    {sortBy === "name_desc" && "Student (Z-A)"}
                    {sortBy === "score_desc" && "Highest Score"}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={() => setSortBy("newest")}
                    className="cursor-pointer text-xs justify-between min-h-[36px]"
                  >
                    <span>Newest First</span>
                    {sortBy === "newest" && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("oldest")}
                    className="cursor-pointer text-xs justify-between min-h-[36px]"
                  >
                    <span>Oldest First</span>
                    {sortBy === "oldest" && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("name_asc")}
                    className="cursor-pointer text-xs justify-between min-h-[36px]"
                  >
                    <span>Student (A-Z)</span>
                    {sortBy === "name_asc" && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("name_desc")}
                    className="cursor-pointer text-xs justify-between min-h-[36px]"
                  >
                    <span>Student (Z-A)</span>
                    {sortBy === "name_desc" && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("score_desc")}
                    className="cursor-pointer text-xs justify-between min-h-[36px]"
                  >
                    <span>Highest Score</span>
                    {sortBy === "score_desc" && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div
                className="h-4 w-px bg-border/60 shrink-0 hidden sm:block"
                aria-hidden="true"
              />

              {/* Scoring Explainer Guide Trigger */}
              <ScoringGuidePopover />
            </div>
          </div>
        )}

        {/* Screen Reader Filter & Search Live Announcer */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {submissions && submissions.length > 0 && (
            <span>
              {`Showing ${currentListLength} ${viewMode === "grouped" ? "student submissions" : "submissions"}${
                statusFilter !== "all" ? ` filtered by ${statusFilter}` : ""
              }${searchQuery ? ` matching "${searchQuery}"` : ""}.`}
            </span>
          )}
        </div>

        {/* Search Results Filter Indicator */}
        {searchQuery && submissions && submissions.length > 0 && (
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

        {/* Submissions Content Grid */}
        {submissionsLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-warm overflow-hidden"
              >
                <Skeleton className="aspect-4/3 w-full rounded-none" />
                <div className="p-3.5 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : submissionsError ? (
          <div
            role="alert"
            className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">
                Couldn&apos;t load submissions. Check your connection and try
                again.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchSubmissions()}
              className="border-destructive/30 hover:bg-destructive/10 text-destructive cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Retry
            </Button>
          </div>
        ) : submissions?.length === 0 ? (
          /* Empty state: No submissions at all */
          <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-warm overflow-hidden">
            <Empty className="py-14 border-0">
              <EmptyMedia
                variant="icon"
                className="bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300"
              >
                <Inbox className="w-6 h-6" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="text-lg sm:text-xl">
                  No submissions yet
                </EmptyTitle>
                <EmptyDescription className="text-xs sm:text-sm max-w-sm mx-auto">
                  Upload a student&apos;s handwriting worksheet for this activity
                  to begin AI diagnostic assessment.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex items-center justify-center w-full sm:w-auto px-4 sm:px-0">
                <Button
                  className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl cursor-pointer"
                  onClick={() => openUpload({ activityId: id })}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  <span>Upload Submission</span>
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        ) : currentListLength === 0 ? (
          /* Empty state: Filters returned 0 results */
          <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-warm overflow-hidden">
            <Empty className="py-12 border-0">
              <EmptyMedia
                variant="icon"
                className="bg-muted text-muted-foreground"
              >
                <SearchX className="w-6 h-6" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="text-lg sm:text-xl">
                  No matching submissions
                </EmptyTitle>
                <EmptyDescription className="text-xs sm:text-sm max-w-sm mx-auto">
                  No student submissions match your current search or status
                  filter.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex gap-2">
                {searchQuery && (
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery("")}
                    className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl cursor-pointer"
                  >
                    Clear Search
                  </Button>
                )}
                {statusFilter !== "all" && (
                  <Button
                    variant="ghost"
                    onClick={() => setStatusFilter("all")}
                    className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl cursor-pointer"
                  >
                    View All
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          /* Submissions Cards Grid */
          <div
            role="region"
            aria-label="Student submissions list"
            className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4"
          >
            {viewMode === "grouped"
              ? filteredAndSortedGroups.map((group) => {
                  const activeSub =
                    attemptOverrides.get(group.studentId) ??
                    group.latestSubmission;

                  return (
                    <SubmissionCard
                      key={group.studentId}
                      submission={activeSub}
                      studentName={group.studentName}
                      attemptCount={group.attemptCount}
                      allSubmissions={group.allSubmissions}
                      onSelectAttempt={handleSelectAttempt}
                      onSelect={handleSelectSubmission}
                      onReupload={handleReupload}
                    />
                  );
                })
              : filteredAndSortedSubmissions.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    submission={sub}
                    studentName={sub.student?.full_name ?? "Unknown Student"}
                    onSelect={handleSelectSubmission}
                    onReupload={handleReupload}
                  />
                ))}
          </div>
        )}
      </section>

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

      {/* Submission Detail / Diagnostic Review Dialog */}
      <SubmissionDetailDialog
        submission={selectedSubmission}
        submissions={activeDialogSubmissionsList}
        currentIndex={
          currentSubmissionIndex >= 0 ? currentSubmissionIndex : undefined
        }
        onNavigate={setSelectedSubmission}
        activityTargetText={activity.target_text}
        open={!!selectedSubmission}
        onOpenChange={(open) => !open && setSelectedSubmission(null)}
      />
    </div>
  );
}
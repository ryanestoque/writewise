"use client";

import { use, useState, useMemo, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ActivityThreads } from "@/components/comments/activity-threads";
import { StudentWorkSummary } from "@/components/activities/student-work-summary";
import { commentThreadHref, parseTeacherCommentTarget } from "@/lib/comments/targets";
import { type Activity, useActivity, useToggleArchive } from "@/lib/hooks/use-activities";
import { useActivityWork } from "@/lib/hooks/use-activity-work";
import { ReleaseActivityButton } from "@/components/submissions/submission-lifecycle-controls";
import { activityAssignedTo } from "@/lib/utils/activity-work";
import { useStudents } from "@/lib/hooks/use-students";
import {
  type Submission,
  useSubmissions,
  useDeleteSubmission,
  useBatchDeleteSubmissions,
} from "@/lib/hooks/use-submissions";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import { EditActivityDialog } from "@/components/activities/edit-activity-dialog";
import { DeleteActivityDialog } from "@/components/activities/delete-activity-dialog";
import { CreateActivityDialog } from "@/components/activities/create-activity-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FloatingActionBar } from "@/components/ui/floating-action-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SearchInput } from "@/components/ui/search-input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Trash2,
  Loader2,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { getWordCount } from "@/lib/utils/formatters";
import { getScoreBandLabel, resolveSubmissionScore } from "@/lib/utils/submission-status";
import {
  ActivityDetailHero,
  type ClassDiagnosticSummary,
} from "@/components/activities/activity-detail-hero";
import { SubmissionCard } from "@/components/activities/submission-card";
import {
  activityReviewQuery,
  matchesReviewFilter,
  reviewFilterLabels,
  reviewFilterHelp,
  type ReviewFilter,
} from "@/lib/utils/activity-review";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type SubmissionFilter = ReviewFilter;
type SubmissionSort = "newest" | "oldest" | "name_asc" | "name_desc" | "score_desc";
type ViewMode = "grouped" | "all";

interface StudentSubmissionGroup {
  studentId: string;
  studentName: string;
  latestSubmission: Submission;
  reviewSubmission: Submission;
  allSubmissions: Submission[];
  attemptCount: number;
}

export default function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const workQuery = useActivityWork(id);
  const workByStudent = useMemo(
    () =>
      new Map(
        (workQuery.isError ? [] : (workQuery.data ?? [])).map((row) => [row.student_id, row])
      ),
    [workQuery.data, workQuery.isError]
  );
  const activeIds = useMemo(
    () =>
      new Set(
        (workQuery.data ?? [])
          .map((row) => row.active_submission_id)
          .filter((id): id is string => !!id)
      ),
    [workQuery.data]
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const commentTarget = parseTeacherCommentTarget(searchParams, id);
  const closeComments = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("student");
    next.delete("view");
    router.replace(`/activities/${id}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const { data: activity, isLoading, error, refetch } = useActivity(id);
  const {
    data: students,
    isPending: studentsLoading,
    isError: studentsError,
    refetch: refetchStudents,
  } = useStudents();
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [managingAttempts, setManagingAttempts] = useState(false);

  // View, search, filter, and sort states
  // Keep review context when opening a worksheet, refreshing, or sharing this URL.
  const viewMode: ViewMode = searchParams.get("group") === "all" ? "all" : "grouped";
  const searchQuery = String(searchParams.get("q") ?? "");
  const requestedFilter = String(searchParams.get("status") ?? "all");
  const statusFilter: SubmissionFilter = Object.hasOwn(reviewFilterLabels, requestedFilter)
    ? (requestedFilter as SubmissionFilter)
    : "all";
  const requestedSort = String(searchParams.get("sort") ?? "newest");
  const sortBy: SubmissionSort = ["oldest", "name_asc", "name_desc", "score_desc"].includes(
    requestedSort ?? ""
  )
    ? (requestedSort as SubmissionSort)
    : "newest";
  const compact = searchParams.get("layout") !== "photos";
  const updateReviewParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${next.size ? `?${next}` : ""}`
    );
  };
  const setViewMode = (value: ViewMode) => updateReviewParams({ group: value, status: null });
  const setSearchQuery = (value: string) => updateReviewParams({ q: value || null });
  const setStatusFilter = (value: SubmissionFilter) =>
    updateReviewParams({ status: value === "all" ? null : value });
  const setSortBy = (value: SubmissionSort) => updateReviewParams({ sort: value });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Group attempt selection map (key: studentId, value: Submission)
  const [attemptOverrides, setAttemptOverrides] = useState<Map<string, Submission>>(new Map());

  // Batch deletion selection state
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteDialogOpen, setIsBatchDeleteDialogOpen] = useState(false);
  const [singleAttemptToDelete, setSingleAttemptToDelete] = useState<Submission | null>(null);
  const [studentBatchToDelete, setStudentBatchToDelete] = useState<{
    studentName: string;
    submissions: Submission[];
  } | null>(null);

  const deleteSingleMutation = useDeleteSubmission();
  const batchDeleteMutation = useBatchDeleteSubmissions();

  // Shortcut key listener for '/' and 'U'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const targetTag = target?.tagName;
      const isContentEditable = Boolean(target?.isContentEditable);
      const isInput =
        ["INPUT", "TEXTAREA", "SELECT"].includes(targetTag || "") || isContentEditable;
      if (isInput) return;

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key.toLowerCase() === "u" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openUpload({ activityId: id });
      } else if (e.key === "Escape" && selectedSubmissionIds.size > 0) {
        e.preventDefault();
        setSelectedSubmissionIds(new Set());
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, openUpload, selectedSubmissionIds.size]);

  // Roster Metrics: Unique enrolled students with submissions
  const submittedStudentIds = useMemo(() => {
    if (!submissions) return new Set<string>();
    return new Set(
      submissions
        .filter(
          (s) =>
            activeIds.has(s.id) &&
            students?.some(
              (student) =>
                student.id === s.student_id && !!activity && activityAssignedTo(activity, student)
            )
        )
        .map((s) => s.student_id)
    );
  }, [submissions, students, activity, activeIds]);

  const uniqueStudentsCount = submittedStudentIds.size;
  const assignedStudents = (students ?? []).filter(
    (student) => !!activity && activityAssignedTo(activity, student)
  );
  const rosterReady = !studentsLoading && !studentsError;
  const summaryReady =
    rosterReady && workQuery.isSuccess && !submissionsLoading && !submissionsError;
  const studentsWithoutUploads = assignedStudents.filter(
    (student) => !submissions?.some((submission) => submission.student_id === student.id)
  );
  const filteredStudentsWithoutUploads =
    viewMode === "grouped"
      ? studentsWithoutUploads
          .filter((student) =>
            matchesReviewFilter(null, workByStudent.get(student.id) ?? null, statusFilter)
          )
          .filter((student) =>
            student.full_name.toLowerCase().includes(searchQuery.trim().toLowerCase())
          )
          .sort((a, b) =>
            sortBy === "name_desc"
              ? b.full_name.localeCompare(a.full_name)
              : a.full_name.localeCompare(b.full_name)
          )
      : [];
  const totalStudents = assignedStudents.length;
  const totalScansCount = submissions?.length ?? 0;
  const completionRate =
    totalStudents > 0 ? Math.min(100, Math.round((uniqueStudentsCount / totalStudents) * 100)) : 0;

  // Class Diagnostic Synthesis: Calculate class average and priority criteria
  const classDiagnostics = useMemo<ClassDiagnosticSummary | null>(() => {
    if (!submissions) return null;
    const scoredSubmissions = submissions
      .map((s) => ({ submission: s, resolved: resolveSubmissionScore(s) }))
      .filter((item) => activeIds.has(item.submission.id) && item.resolved.isScored);
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
    const avgFormation = formationCount ? Math.round(totalFormation / formationCount) : 0;
    const avgSize = sizeCount ? Math.round(totalSize / sizeCount) : 0;
    const avgSpacing = spacingCount ? Math.round(totalSpacing / spacingCount) : 0;
    const avgSlant = slantCount ? Math.round(totalSlant / slantCount) : 0;
    const avgBaseline = baselineCount ? Math.round(totalBaseline / baselineCount) : 0;

    const criteriaList = [
      { name: "Letter Formation", score: avgFormation, count: formationCount },
      { name: "Size Consistency", score: avgSize, count: sizeCount },
      { name: "Spacing", score: avgSpacing, count: spacingCount },
      { name: "Slant Consistency", score: avgSlant, count: slantCount },
      { name: "Baseline Alignment", score: avgBaseline, count: baselineCount },
    ].filter((c) => c.count > 0);

    criteriaList.sort((a, b) => b.score - a.score);

    return {
      completedCount: scoredSubmissions.length,
      manualCount: scoredSubmissions.filter((item) => item.resolved.source === "manual").length,
      calibratedCount: scoredSubmissions.filter((item) => item.resolved.source === "calibrated")
        .length,
      avgCompositeScore: avgComposite,
      scoreBand: getScoreBandLabel(avgComposite),
      criteriaAverages: {
        letterFormation: avgFormation,
        sizeConsistency: avgSize,
        spacing: avgSpacing,
        slant: avgSlant,
        baselineAlignment: avgBaseline,
      },
      strongestCriterion: criteriaList.length > 0 ? criteriaList[0] : null,
      focusCriterion: criteriaList.length > 1 ? criteriaList[criteriaList.length - 1] : null,
    };
  }, [submissions, activeIds]);

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
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
          b.id.localeCompare(a.id)
      );
      const latest = sortedSubs[0];
      const countedId = workByStudent.get(key)?.active_submission_id;
      const name =
        latest.student?.full_name ||
        students?.find((s) => s.id === key)?.full_name ||
        "Unknown Student";

      groups.push({
        studentId: key,
        studentName: name,
        latestSubmission: latest,
        reviewSubmission: sortedSubs.find((sub) => sub.id === countedId) ?? latest,
        allSubmissions: sortedSubs,
        attemptCount: sortedSubs.length,
      });
    });

    return groups;
  }, [submissions, students, workByStudent]);

  const submissionFilterItems = (Object.keys(reviewFilterLabels) as SubmissionFilter[])
    .filter((filter) => viewMode === "grouped" || filter !== "no_upload")
    .map((filter) => ({
      id: filter,
      label: reviewFilterLabels[filter],
      disabled: filter !== "all" && !summaryReady,
      count: !summaryReady
        ? undefined
        : viewMode === "grouped"
          ? studentGroups.filter((group) =>
              matchesReviewFilter(
                group.reviewSubmission,
                workByStudent.get(group.studentId) ?? null,
                filter
              )
            ).length +
            studentsWithoutUploads.filter((student) =>
              matchesReviewFilter(null, workByStudent.get(student.id) ?? null, filter)
            ).length
          : (submissions ?? []).filter((sub) =>
              matchesReviewFilter(sub, workByStudent.get(sub.student_id) ?? null, filter)
            ).length,
    }));

  // Filtered & Sorted Student Groups
  const filteredAndSortedGroups = useMemo(() => {
    let result = studentGroups;

    if (statusFilter !== "all") {
      result = result.filter((g) =>
        matchesReviewFilter(
          g.reviewSubmission,
          workByStudent.get(g.studentId) ?? null,
          statusFilter
        )
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((g) => g.studentName.toLowerCase().includes(query));
    }

    return [...result].sort((a, b) => {
      if (sortBy === "newest") {
        return (
          new Date(b.reviewSubmission.created_at).getTime() -
          new Date(a.reviewSubmission.created_at).getTime()
        );
      }
      if (sortBy === "oldest") {
        return (
          new Date(a.reviewSubmission.created_at).getTime() -
          new Date(b.reviewSubmission.created_at).getTime()
        );
      }
      if (sortBy === "name_asc") {
        return a.studentName.localeCompare(b.studentName);
      }
      if (sortBy === "name_desc") {
        return b.studentName.localeCompare(a.studentName);
      }
      if (sortBy === "score_desc") {
        const scoreA = resolveSubmissionScore(a.reviewSubmission).compositeScore ?? -1;
        const scoreB = resolveSubmissionScore(b.reviewSubmission).compositeScore ?? -1;
        return scoreB - scoreA;
      }
      return 0;
    });
  }, [studentGroups, searchQuery, statusFilter, sortBy, workByStudent]);

  // Filtered & Sorted Raw Submissions (for "All Scans" view mode)
  const filteredAndSortedSubmissions = useMemo(() => {
    if (!submissions) return [];

    let result = submissions;

    if (statusFilter !== "all") {
      result = result.filter((s) =>
        matchesReviewFilter(s, workByStudent.get(s.student_id) ?? null, statusFilter)
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((s) => s.student?.full_name?.toLowerCase().includes(query));
    }

    return [...result].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "name_asc") {
        return (a.student?.full_name ?? "").localeCompare(b.student?.full_name ?? "");
      }
      if (sortBy === "name_desc") {
        return (b.student?.full_name ?? "").localeCompare(a.student?.full_name ?? "");
      }
      if (sortBy === "score_desc") {
        const scoreA = resolveSubmissionScore(a).compositeScore ?? -1;
        const scoreB = resolveSubmissionScore(b).compositeScore ?? -1;
        return scoreB - scoreA;
      }
      return 0;
    });
  }, [submissions, searchQuery, statusFilter, sortBy, workByStudent]);

  const handleToggleArchive = useCallback(() => {
    if (!activity) return;
    toggleArchive(activity.id, {
      onSuccess: (result) => {
        toast.success(
          result.is_archived ? "Activity moved to archive." : "Activity restored from archive.",
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

  const handleSelectSubmission = useCallback(
    (sub: Submission) => {
      router.push(
        `/activities/${id}/submissions/${sub.id}${activityReviewQuery(new URLSearchParams(window.location.search))}`
      );
    },
    [router, id]
  );

  const handleReupload = useCallback(
    (studentId?: string) => {
      openUpload({ activityId: id, studentId });
    },
    [id, openUpload]
  );

  const handleSelectAttempt = useCallback((studentId: string, sub: Submission) => {
    // Historical browsing leaves the task queue so its displayed work stays truthful.
    const next = new URLSearchParams(window.location.search);
    next.delete("status");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${next.size ? `?${next}` : ""}`
    );
    setAttemptOverrides((prev) => {
      const next = new Map(prev);
      next.set(studentId, sub);
      return next;
    });
  }, []);

  // All selectable submission IDs in current view
  const allSelectableSubmissionIds = useMemo(() => {
    if (viewMode === "grouped") {
      return filteredAndSortedGroups.map(
        (g) =>
          (statusFilter === "all"
            ? g.allSubmissions.find((sub) => sub.id === attemptOverrides.get(g.studentId)?.id)?.id
            : null) ?? g.reviewSubmission.id
      );
    }
    return filteredAndSortedSubmissions.map((s) => s.id);
  }, [
    viewMode,
    filteredAndSortedGroups,
    filteredAndSortedSubmissions,
    attemptOverrides,
    statusFilter,
  ]);

  const selectedSubmissions = (submissions ?? []).filter((sub) =>
    selectedSubmissionIds.has(sub.id)
  );
  const selectedCount = selectedSubmissions.length;
  const hiddenSelectedCount = selectedSubmissions.filter(
    (sub) => !allSelectableSubmissionIds.includes(sub.id)
  ).length;

  const selectedStudentsCount = useMemo(() => {
    return new Set(
      (submissions ?? [])
        .filter((sub) => selectedSubmissionIds.has(sub.id))
        .map((sub) => sub.student_id)
    ).size;
  }, [submissions, selectedSubmissionIds]);

  const allVisibleSelected = useMemo(
    () =>
      allSelectableSubmissionIds.length > 0 &&
      allSelectableSubmissionIds.every((id) => selectedSubmissionIds.has(id)),
    [allSelectableSubmissionIds, selectedSubmissionIds]
  );

  const someVisibleSelected = useMemo(
    () =>
      selectedSubmissionIds.size > 0 &&
      !allVisibleSelected &&
      allSelectableSubmissionIds.some((id) => selectedSubmissionIds.has(id)),
    [allSelectableSubmissionIds, selectedSubmissionIds, allVisibleSelected]
  );

  const handleToggleSelectSubmission = useCallback((sub: Submission) => {
    setSelectedSubmissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sub.id)) {
        next.delete(sub.id);
      } else {
        next.add(sub.id);
      }
      return next;
    });
  }, []);

  const handleToggleCardSelect = handleToggleSelectSubmission;

  const clearSelection = useCallback(() => {
    setSelectedSubmissionIds(new Set());
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedSubmissionIds(
        (previous) =>
          new Set(
            [...previous].filter((attemptId) => !allSelectableSubmissionIds.includes(attemptId))
          )
      );
    } else {
      setSelectedSubmissionIds((previous) => new Set([...previous, ...allSelectableSubmissionIds]));
    }
  }, [allVisibleSelected, allSelectableSubmissionIds]);

  const handleBatchDeleteConfirm = async () => {
    if (!selectedCount || submissionsError || submissionsLoading) return;
    try {
      const result = await batchDeleteMutation.mutateAsync(
        selectedSubmissions.map((sub) => sub.id)
      );
      toast.success(
        `Deleted ${result.deleted_count} ${result.deleted_count === 1 ? "attempt" : "attempts"}.`
      );
      clearSelection();
      setIsBatchDeleteDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete selected attempts.");
    }
  };

  const handleDeleteSingleAttemptPrompt = useCallback(
    (sub: Submission) => {
      setSingleAttemptToDelete(sub);
    },
    [setSingleAttemptToDelete]
  );

  const handleDeleteAllStudentAttemptsPrompt = useCallback(
    (studentName: string, subs: Submission[]) => {
      setStudentBatchToDelete({ studentName, submissions: subs });
    },
    []
  );

  const handleConfirmDeleteSingleAttempt = async () => {
    if (!singleAttemptToDelete) return;
    const targetId = singleAttemptToDelete.id;
    try {
      await deleteSingleMutation.mutateAsync(targetId);
      toast.success("Attempt deleted.");
      setSelectedSubmissionIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      setSingleAttemptToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete attempt.");
    }
  };

  const handleConfirmDeleteStudentBatch = async () => {
    if (!studentBatchToDelete) return;
    const ids = studentBatchToDelete.submissions.map((s) => s.id);
    const sName = studentBatchToDelete.studentName;
    try {
      const result = await batchDeleteMutation.mutateAsync(ids);
      toast.success(
        `Deleted ${result.deleted_count} ${result.deleted_count === 1 ? "attempt" : "attempts"} for ${sName}.`
      );
      setSelectedSubmissionIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setStudentBatchToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete student attempts.");
    }
  };

  if (error) {
    return (
      <div className="w-full space-y-5 px-1 pb-28 sm:space-y-6 sm:px-0 sm:pb-24">
        <div>
          <Link
            href="/activities"
            className="text-muted-foreground hover:text-foreground group inline-flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Activities</span>
          </Link>
        </div>
        <div
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive flex flex-col items-center justify-between gap-4 rounded-xl border p-4 sm:flex-row"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
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
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-5 px-1 pb-28 sm:space-y-6 sm:px-0 sm:pb-24">
        <Skeleton className="h-4 w-40" />
        <div className="bg-surface dark:bg-card border-border shadow-warm space-y-4 rounded-xl border p-6 sm:rounded-2xl">
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
        <div className="bg-surface dark:bg-card border-border shadow-warm space-y-4 rounded-xl border p-6 sm:rounded-2xl">
          <div className="flex items-center justify-between">
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
      <div className="w-full space-y-5 px-1 pb-28 sm:space-y-6 sm:px-0 sm:pb-24">
        <div>
          <Link
            href="/activities"
            className="text-muted-foreground hover:text-foreground group inline-flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Activities</span>
          </Link>
        </div>
        <div className="bg-surface dark:bg-card border-border shadow-warm overflow-hidden rounded-xl border sm:rounded-2xl">
          <Empty className="border-0 py-14">
            <EmptyMedia variant="icon" className="bg-muted text-muted-foreground">
              <ClipboardList className="h-6 w-6" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>Activity not found</EmptyTitle>
              <EmptyDescription>
                This activity may have been removed or you don&apos;t have access.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link
                href="/activities"
                className={cn(buttonVariants({ variant: "outline" }), "rounded-lg sm:rounded-xl")}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
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
      ? filteredAndSortedGroups.length + filteredStudentsWithoutUploads.length
      : filteredAndSortedSubmissions.length;

  const studentReviewEntries = [
    ...filteredAndSortedGroups.map((group) => ({
      kind: "upload" as const,
      group,
      name: group.studentName,
    })),
    ...filteredStudentsWithoutUploads.map((student) => ({
      kind: "no_upload" as const,
      student,
      name: student.full_name,
    })),
  ];
  if (sortBy === "name_asc" || sortBy === "name_desc") {
    studentReviewEntries.sort((a, b) =>
      sortBy === "name_desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pb-28 sm:gap-5 sm:pb-24">
      {/* Top Back Navigation Trail */}
      <nav aria-label="Breadcrumb navigation" className="print:hidden">
        <Link
          href="/activities"
          className="text-muted-foreground hover:text-foreground group focus-visible:ring-ring hover:bg-muted/50 -ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:-ml-2 md:min-h-[36px]"
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
        summaryState={
          summaryReady
            ? "ready"
            : studentsError || workQuery.isError || submissionsError
              ? "error"
              : "loading"
        }
        hasCopiedPrompt={hasCopiedPrompt}
        onCopyPrompt={handleCopyPrompt}
        onUpload={handleOpenUpload}
        onEdit={handleEditActivity}
        onDuplicate={handleDuplicateActivity}
        onDelete={handleDeleteActivity}
        onToggleArchive={handleToggleArchive}
      />

      {commentTarget.kind !== "none" && (
        <div role="status" className="rounded-xl border p-4">
          <p>Choose a worksheet upload to view its comments.</p>
          <Button variant="outline" onClick={closeComments}>
            Dismiss
          </Button>
        </div>
      )}
      <section aria-labelledby="submissions-heading" className="space-y-4">
        {/* Section Header with Controls */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <h2
              id="submissions-heading"
              className="font-heading text-foreground text-lg font-semibold tracking-tight sm:text-xl"
            >
              Student work
            </h2>
            {submissions && (viewMode === "all" || rosterReady) && (
              <Badge
                variant="outline"
                className="bg-muted/50 text-muted-foreground border-border px-2.5 py-0.5 text-xs font-semibold"
              >
                {viewMode === "grouped"
                  ? `${studentGroups.length + studentsWithoutUploads.length} students`
                  : `${submissions.length} ${submissions.length === 1 ? "upload" : "uploads"}`}
              </Badge>
            )}
          </div>

          <ReleaseActivityButton
            activityId={id}
            userId={activity.created_by}
            hasPointGrades={activity.points_possible != null}
            students={students ?? []}
            rosterReady={rosterReady}
          />
        </div>

        {studentsError && (
          <Alert variant="destructive">
            <AlertTitle>Could not load assigned students</AlertTitle>
            <AlertDescription>
              Assignment totals are unavailable. Existing uploads remain below.
              <Button
                variant="outline"
                className="ml-2 min-h-10 md:min-h-9"
                onClick={() => void refetchStudents()}
              >
                Retry students
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {workQuery.isError && (
          <Alert variant="destructive">
            <AlertTitle>Could not load work status</AlertTitle>
            <AlertDescription>
              Counted attempts and release status cannot be confirmed. Showing newest uploads until
              status loads.
              <Button
                variant="outline"
                className="ml-2 min-h-10 md:min-h-9"
                onClick={() => void workQuery.refetch()}
              >
                Retry work status
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {rosterReady && !assignedStudents.length && (
          <Alert>
            <AlertTitle>No students assigned</AlertTitle>
            <AlertDescription>
              Choose the students or sections who should complete this activity.
              <Button
                variant="outline"
                className="ml-2 min-h-10 md:min-h-9"
                onClick={handleEditActivity}
              >
                Edit assignments
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {submissions && (submissions.length > 0 || assignedStudents.length > 0) && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                ref={searchInputRef}
                placeholder="Search student name..."
                aria-label="Search submissions by student name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery("")}
                containerClassName="w-full sm:w-64 sm:flex-1"
              />
              <NativeSelect
                aria-label="Filter student work by status"
                aria-describedby={reviewFilterHelp[statusFilter] ? "review-filter-help" : undefined}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as SubmissionFilter)}
                className="min-h-11 min-w-0 flex-1 sm:flex-none"
              >
                {submissionFilterItems.map((filter) => (
                  <NativeSelectOption key={filter.id} value={filter.id} disabled={filter.disabled}>
                    {filter.label}
                    {filter.count == null ? "" : " (" + filter.count + ")"}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" className="min-h-11 md:min-h-9" />}
                >
                  <SlidersHorizontal data-icon="inline-start" />
                  View
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Group work</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={viewMode}
                      onValueChange={(value) => {
                        setViewMode(value as ViewMode);
                        clearSelection();
                        setAttemptOverrides(new Map());
                      }}
                    >
                      <DropdownMenuRadioItem value="grouped" className="min-h-11">
                        By student
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="all" className="min-h-11">
                        All uploads
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Layout</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={compact ? "compact" : "photos"}
                      onValueChange={(value) =>
                        updateReviewParams({ layout: value === "photos" ? "photos" : null })
                      }
                    >
                      <DropdownMenuRadioItem value="compact" className="min-h-11">
                        Compact
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="photos" className="min-h-11">
                        Photos
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Sort work</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={sortBy}
                      onValueChange={(value) => setSortBy(value as SubmissionSort)}
                    >
                      <DropdownMenuRadioItem value="newest" className="min-h-11">
                        Newest first
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="oldest" className="min-h-11">
                        Oldest first
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="name_asc" className="min-h-11">
                        Student (A-Z)
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="name_desc" className="min-h-11">
                        Student (Z-A)
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="score_desc" className="min-h-11">
                        Highest score
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      className="min-h-11"
                      onClick={() => {
                        setManagingAttempts(!managingAttempts);
                        clearSelection();
                      }}
                    >
                      <Trash2 />
                      {managingAttempts ? "Done managing attempts" : "Manage attempts"}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {reviewFilterHelp[statusFilter] && (
              <p id="review-filter-help" className="text-muted-foreground text-sm">
                {reviewFilterHelp[statusFilter]}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              {viewMode === "grouped" ? "By student · " : "All uploads · "}
              {compact ? "Compact" : "Photos"} ·{" "}
              {sortBy === "newest"
                ? "Newest first"
                : sortBy === "oldest"
                  ? "Oldest first"
                  : sortBy === "name_asc"
                    ? "Student (A-Z)"
                    : sortBy === "name_desc"
                      ? "Student (Z-A)"
                      : "Highest score"}
            </p>
            {managingAttempts && (
              <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border p-3">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    onCheckedChange={handleToggleSelectAll}
                    aria-label="Select all visible attempts to delete"
                  />
                  Select displayed attempts to delete
                </label>
                <span className="text-muted-foreground text-xs">
                  {selectedCount} selected
                  {hiddenSelectedCount ? " · " + hiddenSelectedCount + " not shown" : ""}. Selection
                  does not limit release.
                </span>
                {selectedCount > 0 && (
                  <Button variant="ghost" onClick={clearSelection} className="min-h-11">
                    Clear
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="ml-auto min-h-11"
                  onClick={() => {
                    setManagingAttempts(false);
                    clearSelection();
                  }}
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Screen Reader Filter & Search Live Announcer */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {submissions && (
            <span>
              {`Showing ${currentListLength} ${viewMode === "grouped" ? "student submissions" : "submissions"}${
                statusFilter !== "all" ? ` filtered by ${reviewFilterLabels[statusFilter]}` : ""
              }${searchQuery ? ` matching "${searchQuery}"` : ""}.`}
            </span>
          )}
        </div>

        {/* Search Results Filter Indicator */}
        {searchQuery && submissions && (
          <div
            role="status"
            aria-live="polite"
            className="text-muted-foreground flex items-center justify-between px-1 text-xs"
          >
            <span>
              Showing <strong className="text-foreground">{currentListLength}</strong> matching
              &ldquo;
              <strong className="text-foreground">{searchQuery}</strong>
              &rdquo;
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-primary focus-visible:ring-ring min-h-10 cursor-pointer rounded-sm px-2 py-0.5 font-medium hover:underline focus-visible:ring-2 focus-visible:outline-hidden md:min-h-9"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Submissions Content Grid */}
        {submissionsLoading || (viewMode === "grouped" && studentsLoading) ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface dark:bg-card border-border shadow-warm overflow-hidden rounded-xl border sm:rounded-2xl"
              >
                <Skeleton className="aspect-4/3 w-full rounded-none" />
                <div className="space-y-2 p-3.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : submissionsError ? (
          <div
            role="alert"
            className="border-destructive/20 bg-destructive/10 text-destructive flex flex-col items-center justify-between gap-4 rounded-xl border p-4 sm:flex-row"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">
                Couldn&apos;t load submissions. Check your connection and try again.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchSubmissions()}
              className="border-destructive/30 hover:bg-destructive/10 text-destructive min-h-10 cursor-pointer md:min-h-9"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : submissions?.length === 0 && (viewMode === "all" || !assignedStudents.length) ? (
          /* Empty state: No submissions at all */
          <div className="bg-surface dark:bg-card border-border shadow-warm overflow-hidden rounded-xl border sm:rounded-2xl">
            <Empty className="border-0 py-14">
              <EmptyMedia
                variant="icon"
                className="bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300"
              >
                <Inbox className="h-6 w-6" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="text-lg sm:text-xl">No submissions yet</EmptyTitle>
                <EmptyDescription className="mx-auto max-w-sm text-xs sm:text-sm">
                  Upload a student&apos;s handwriting worksheet for this activity to begin AI
                  diagnostic assessment.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex w-full items-center justify-center px-4 sm:w-auto sm:px-0">
                <Button
                  className="bg-primary hover:bg-brand-700 text-primary-foreground h-10 min-h-[44px] w-full cursor-pointer rounded-lg text-xs font-medium sm:h-9 sm:w-auto sm:rounded-xl sm:text-sm md:min-h-[36px]"
                  onClick={() => openUpload({ activityId: id })}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  <span>Upload worksheet</span>
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        ) : currentListLength === 0 ? (
          /* Empty state: Filters returned 0 results */
          <div className="bg-surface dark:bg-card border-border shadow-warm overflow-hidden rounded-xl border sm:rounded-2xl">
            <Empty className="border-0 py-12">
              <EmptyMedia variant="icon" className="bg-muted text-muted-foreground">
                <SearchX className="h-6 w-6" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="text-lg sm:text-xl">No matching submissions</EmptyTitle>
                <EmptyDescription className="mx-auto max-w-sm text-xs sm:text-sm">
                  No student submissions match your current search or status filter.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex gap-2">
                {searchQuery && (
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery("")}
                    className="h-10 min-h-[44px] cursor-pointer rounded-lg text-xs font-medium sm:h-9 sm:rounded-xl sm:text-sm md:min-h-[36px]"
                  >
                    Clear Search
                  </Button>
                )}
                {statusFilter !== "all" && (
                  <Button
                    variant="ghost"
                    onClick={() => setStatusFilter("all")}
                    className="h-10 min-h-[44px] cursor-pointer rounded-lg text-xs font-medium sm:h-9 sm:rounded-xl sm:text-sm md:min-h-[36px]"
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
            className={cn(
              "grid gap-3",
              !compact && "grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4"
            )}
          >
            {viewMode === "grouped"
              ? studentReviewEntries.map((entry) => {
                  if (entry.kind === "no_upload") {
                    const { student } = entry;
                    return (
                      <article
                        key={student.id}
                        className={cn(
                          "border-border bg-card flex flex-col gap-4 self-start rounded-xl border p-4",
                          compact &&
                            "sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"
                        )}
                      >
                        <div className="flex flex-col gap-2">
                          <h3 className="text-sm font-semibold break-words">{student.full_name}</h3>
                          <p className="text-muted-foreground text-sm">
                            No worksheet uploaded yet.
                          </p>
                        </div>
                        <StudentWorkSummary
                          activityId={id}
                          studentId={student.id}
                          studentName={student.full_name}
                          state={workQuery.isError ? null : (workByStudent.get(student.id) ?? null)}
                          attempts={[]}
                          isLoading={workQuery.isPending}
                        />
                        <Button
                          variant="outline"
                          className="min-h-10 md:min-h-9"
                          onClick={() => handleReupload(student.id)}
                          aria-label={`Upload worksheet for ${student.full_name}`}
                        >
                          <Upload data-icon="inline-start" /> Upload worksheet
                        </Button>
                      </article>
                    );
                  }
                  const { group } = entry;
                  const activeSub =
                    (statusFilter === "all"
                      ? group.allSubmissions.find(
                          (sub) => sub.id === attemptOverrides.get(group.studentId)?.id
                        )
                      : null) ?? group.reviewSubmission;
                  const workState = workQuery.isError
                    ? null
                    : (workByStudent.get(group.studentId) ?? null);

                  return (
                    <SubmissionCard
                      key={group.studentId}
                      compact={compact}
                      submission={activeSub}
                      studentName={group.studentName}
                      attemptCount={group.attemptCount}
                      allSubmissions={group.allSubmissions}
                      countedSubmissionId={
                        workQuery.isSuccess ? (workState?.active_submission_id ?? null) : undefined
                      }
                      latestSubmission={group.latestSubmission}
                      workSummary={
                        <StudentWorkSummary
                          activityId={id}
                          studentId={group.studentId}
                          studentName={group.studentName}
                          state={workState}
                          attempts={group.allSubmissions}
                          isLoading={workQuery.isPending}
                        />
                      }
                      onSelectAttempt={handleSelectAttempt}
                      onSelect={handleSelectSubmission}
                      onReupload={handleReupload}
                      isSelected={selectedSubmissionIds.has(activeSub.id)}
                      onToggleSelect={managingAttempts ? handleToggleCardSelect : undefined}
                      onDeleteSingleAttempt={
                        managingAttempts ? handleDeleteSingleAttemptPrompt : undefined
                      }
                      onDeleteAllStudentAttempts={
                        managingAttempts ? handleDeleteAllStudentAttemptsPrompt : undefined
                      }
                    />
                  );
                })
              : filteredAndSortedSubmissions.map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    compact={compact}
                    submission={sub}
                    studentName={sub.student?.full_name ?? "Unknown Student"}
                    onSelect={handleSelectSubmission}
                    onReupload={handleReupload}
                    isSelected={selectedSubmissionIds.has(sub.id)}
                    onToggleSelect={managingAttempts ? handleToggleCardSelect : undefined}
                    onDeleteSingleAttempt={
                      managingAttempts ? handleDeleteSingleAttemptPrompt : undefined
                    }
                  />
                ))}
          </div>
        )}
      </section>

      <Collapsible
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        className="border-border border-t pt-4"
      >
        <CollapsibleTrigger
          render={<Button variant="ghost" className="min-h-10 gap-2 md:min-h-9" />}
        >
          Conversation history{" "}
          <ChevronDown
            className={cn(
              "transition-transform motion-reduce:transition-none",
              historyOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {historyOpen && (
            <ActivityThreads
              userId={activity.created_by}
              activityId={id}
              onOpen={(target) =>
                router.push(commentThreadHref(target, "teacher"), { scroll: false })
              }
            />
          )}
        </CollapsibleContent>
      </Collapsible>

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
          ...activity,
          due_at: null,
          close_after_due: false,
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

      {/* Floating Batch Actions Bar */}
      <FloatingActionBar
        selectedCount={selectedCount}
        totalCount={
          selectedCount +
          allSelectableSubmissionIds.filter((attemptId) => !selectedSubmissionIds.has(attemptId))
            .length
        }
        itemLabel={{ singular: "attempt", plural: "attempts" }}
        allSelected={allVisibleSelected}
        onSelectAll={handleToggleSelectAll}
        onClearSelection={clearSelection}
        ariaLabel="Batch attempt actions"
      >
        {hiddenSelectedCount > 0 && (
          <span className="text-muted-foreground text-xs">{hiddenSelectedCount} not shown</span>
        )}
        {selectedStudentsCount > 0 && (
          <span className="text-muted-foreground mr-1 hidden text-xs sm:inline">
            ({selectedStudentsCount} {selectedStudentsCount === 1 ? "student" : "students"})
          </span>
        )}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setIsBatchDeleteDialogOpen(true)}
          disabled={batchDeleteMutation.isPending}
          className="min-h-10 cursor-pointer gap-1.5 rounded-full px-3.5 text-xs font-semibold shadow-xs md:min-h-9"
        >
          <Trash2 className="size-3.5" />
          <span>Delete Attempts</span>
        </Button>
      </FloatingActionBar>

      {/* Batch Delete Confirmation Alert Dialog */}
      <AlertDialog open={isBatchDeleteDialogOpen} onOpenChange={setIsBatchDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} {selectedCount === 1 ? "attempt" : "attempts"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the uploaded worksheet{" "}
              {selectedCount === 1 ? "photo" : "photos"}, computer vision analysis, comments, and
              recorded rubric scores for the selected {selectedCount === 1 ? "attempt" : "attempts"}
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            className="flex max-h-64 flex-col gap-3 overflow-y-auto text-sm"
            aria-label="Attempts selected for deletion"
            tabIndex={0}
          >
            {hiddenSelectedCount > 0 && (
              <p role="status">
                {hiddenSelectedCount} selected{" "}
                {hiddenSelectedCount === 1 ? "attempt is" : "attempts are"} not shown in the current
                view. Included below.
              </p>
            )}
            {selectedSubmissions.map((sub) => (
              <div key={sub.id} className="flex flex-col gap-1 border-b pb-2">
                <strong className="break-words">
                  {sub.student?.full_name ??
                    students?.find((student) => student.id === sub.student_id)?.full_name ??
                    "Unknown student"}
                </strong>
                <span className="text-muted-foreground">
                  Uploaded{" "}
                  {new Date(sub.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                </span>
                <span>
                  {activeIds.has(sub.id) ? "Counted attempt" : "Not counted"}
                  {sub.released_at ? " · Released to parents" : " · Not released"}
                </span>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={batchDeleteMutation.isPending}
              onClick={() => setIsBatchDeleteDialogOpen(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                batchDeleteMutation.isPending ||
                !selectedCount ||
                !!submissionsError ||
                submissionsLoading
              }
              onClick={(event) => {
                event.preventDefault();
                void handleBatchDeleteConfirm();
              }}
            >
              {batchDeleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedCount} ${selectedCount === 1 ? "Attempt" : "Attempts"}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Attempt Delete Confirmation Dialog */}
      <AlertDialog
        open={!!singleAttemptToDelete}
        onOpenChange={(open) => !open && setSingleAttemptToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this uploaded worksheet photo, computer vision analysis,
              comments, and recorded rubric scores. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteSingleMutation.isPending}
              onClick={() => setSingleAttemptToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteSingleMutation.isPending}
              onClick={handleConfirmDeleteSingleAttempt}
            >
              {deleteSingleMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Attempt"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Student All Attempts Delete Confirmation Dialog */}
      <AlertDialog
        open={!!studentBatchToDelete}
        onOpenChange={(open) => !open && setStudentBatchToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete all {studentBatchToDelete?.submissions.length} attempts for{" "}
              {studentBatchToDelete?.studentName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {studentBatchToDelete?.submissions.length} uploaded
              worksheet photos, computer vision analysis, comments, and recorded rubric scores for{" "}
              {studentBatchToDelete?.studentName} on this activity. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={batchDeleteMutation.isPending}
              onClick={() => setStudentBatchToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={batchDeleteMutation.isPending}
              onClick={handleConfirmDeleteStudentBatch}
            >
              {batchDeleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                `Delete All ${studentBatchToDelete?.submissions.length} Attempts`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

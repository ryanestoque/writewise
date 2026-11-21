"use client";

import { use, useState, useMemo, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ActivityThreads } from "@/components/comments/activity-threads";
import { useActivityReviewSession } from "@/components/activities/activity-review-session";
import {
  reviewQueueQuery,
} from "@/lib/utils/activity-review";
import { commentThreadHref, parseTeacherCommentTarget } from "@/lib/comments/targets";
import { type Activity, useActivity, useToggleArchive } from "@/lib/hooks/use-activities";
import {
  useActivityWork,
  useBatchReleaseSubmissions,
  useBatchUpdateStudentWork,
} from "@/lib/hooks/use-activity-work";
import { ReleaseActivityButton } from "@/components/submissions/submission-lifecycle-controls";
import { activityAssignedTo } from "@/lib/utils/activity-work";
import { useStudents } from "@/lib/hooks/use-students";
import {
  type Submission,
  useSubmissions,
  useDeleteSubmission,
  useBatchDeleteSubmissions,
  useSubmissionImageUrls,
} from "@/lib/hooks/use-submissions";
import dynamic from "next/dynamic";
import { useTeacherModals } from "@/components/teacher-modals-provider";

const EditActivityDialog = dynamic(
  () => import("@/components/activities/edit-activity-dialog").then((m) => m.EditActivityDialog),
  { ssr: false }
);
const DeleteActivityDialog = dynamic(
  () =>
    import("@/components/activities/delete-activity-dialog").then((m) => m.DeleteActivityDialog),
  { ssr: false }
);
const CreateActivityDialog = dynamic(
  () =>
    import("@/components/activities/create-activity-dialog").then((m) => m.CreateActivityDialog),
  { ssr: false }
);
const BatchReleaseDialog = dynamic(
  () =>
    import("@/components/activities/batch-release-dialog").then((m) => m.BatchReleaseDialog),
  { ssr: false }
);
const AttemptDeletionDialogs = dynamic(
  () =>
    import("@/components/activities/attempt-deletion-dialogs").then(
      (m) => m.AttemptDeletionDialogs
    ),
  { ssr: false }
);
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FloatingActionBar } from "@/components/ui/floating-action-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Trash2,
  ChevronDown,
  CheckCircle2,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";
import { getWordCount } from "@/lib/utils/formatters";
import { getScoreBandLabel, resolveSubmissionScore } from "@/lib/utils/submission-status";
import {
  ActivityDetailHero,
  type ClassDiagnosticSummary,
} from "@/components/activities/activity-detail-hero";
import { SubmissionCard, UnsubmittedCard } from "@/components/activities/submission-card";
import { matchesReviewFilter, reviewFilterLabels } from "@/lib/utils/activity-attempt-review";
import {
  ActivityReviewToolbar,
  type SubmissionFilter,
  type SubmissionSort,
  type ViewMode,
} from "@/components/activities/activity-review-toolbar";
import { ActivityReviewEmptyStates } from "@/components/activities/activity-review-empty-states";
import { useShortcutKeys } from "@/hooks/use-shortcut-keys";

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
  const { altKey } = useShortcutKeys();
  const { setSession } = useActivityReviewSession();
  useEffect(() => setSession(null), [setSession]);
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
  const requestedGroup = searchParams.get("group");
  const viewMode: ViewMode = requestedGroup === "all" ? "all" : "grouped";
  const urlSearchQuery = String(searchParams.get("q") ?? "");
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
  const lastSyncedUrlQueryRef = useRef(urlSearchQuery);

  useEffect(() => {
    if (urlSearchQuery !== lastSyncedUrlQueryRef.current) {
      lastSyncedUrlQueryRef.current = urlSearchQuery;
      setSearchQuery(urlSearchQuery);
    }
  }, [urlSearchQuery]);

  const requestedFilter = String(
    searchParams.get("status") ?? (requestedGroup === "review" ? "needs_scoring" : "all")
  );
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
  const updateReviewParams = useCallback((updates: Record<string, string | null>) => {
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
  }, []);

  // Debounce search query updates to browser history to avoid synchronous thrashing on keystrokes
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentParam = new URLSearchParams(window.location.search).get("q") ?? "";
      const trimmed = searchQuery.trim();
      if (trimmed !== currentParam) {
        lastSyncedUrlQueryRef.current = trimmed;
        updateReviewParams({ q: trimmed || null });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, updateReviewParams]);

  const setViewMode = (value: ViewMode) => updateReviewParams({ group: value, status: null });
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    lastSyncedUrlQueryRef.current = "";
    updateReviewParams({ q: null });
  }, [updateReviewParams]);
  const setStatusFilter = (value: SubmissionFilter) => {
    clearSelection();
    updateReviewParams({ status: value === "all" ? null : value });
  };
  const setSortBy = (value: SubmissionSort) => updateReviewParams({ sort: value });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const handleStartGradingSprintRef = useRef<() => void>(() => {});

  // Group attempt selection map (key: studentId, value: Submission)
  const [attemptOverrides, setAttemptOverrides] = useState<Map<string, Submission>>(new Map());

  // Batch deletion selection state
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteDialogOpen, setIsBatchDeleteDialogOpen] = useState(false);
  const [isBatchReleaseDialogOpen, setIsBatchReleaseDialogOpen] = useState(false);
  const [isBatchExcuseDialogOpen, setIsBatchExcuseDialogOpen] = useState(false);
  const [singleAttemptToDelete, setSingleAttemptToDelete] = useState<Submission | null>(null);
  const [studentBatchToDelete, setStudentBatchToDelete] = useState<{
    studentName: string;
    submissions: Submission[];
  } | null>(null);

  const deleteSingleMutation = useDeleteSubmission();
  const batchDeleteMutation = useBatchDeleteSubmissions();
  const batchReleaseMutation = useBatchReleaseSubmissions();
  const batchUpdateWorkMutation = useBatchUpdateStudentWork();
  const [isBatchReleasing, setIsBatchReleasing] = useState(false);
  const [isBatchExcusing, setIsBatchExcusing] = useState(false);

  // Activity shortcuts use Alt to avoid intercepting single-character input.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const targetTag = target?.tagName;
      const isContentEditable = Boolean(target?.isContentEditable);
      const isInput =
        ["INPUT", "TEXTAREA", "SELECT"].includes(targetTag || "") || isContentEditable;
      if (
        isInput ||
        e.defaultPrevented ||
        document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')
      ) {
        return;
      }

      const isActivityShortcut = e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey;
      if (isActivityShortcut && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (isActivityShortcut && (e.key.toLowerCase() === "u" || e.code === "KeyU")) {
        e.preventDefault();
        openUpload({ activityId: id });
      } else if (isActivityShortcut && (e.key.toLowerCase() === "g" || e.code === "KeyG")) {
        e.preventDefault();
        handleStartGradingSprintRef.current();
      } else if (e.key === "Escape") {
        setSelectedSubmissionIds((prev) => {
          if (prev.size > 0) {
            e.preventDefault();
            return new Set();
          }
          return prev;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, openUpload]);

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
  const assignedStudents = useMemo(
    () => (students ?? []).filter((student) => !!activity && activityAssignedTo(activity, student)),
    [students, activity]
  );
  const rosterReady = !studentsLoading && !studentsError;
  const summaryReady =
    rosterReady && workQuery.isSuccess && !submissionsLoading && !submissionsError;
  const studentsWithoutUploads = useMemo(
    () =>
      assignedStudents.filter(
        (student) => !submissions?.some((submission) => submission.student_id === student.id)
      ),
    [assignedStudents, submissions]
  );
  const filteredStudentsWithoutUploads = useMemo(() => {
    if (viewMode !== "grouped") return [];
    return studentsWithoutUploads
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
      );
  }, [viewMode, studentsWithoutUploads, workByStudent, statusFilter, searchQuery, sortBy]);
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

    const lowest = criteriaList.length > 1 ? criteriaList[criteriaList.length - 1] : null;
    const focusCriterion =
      lowest && (lowest.score < 80 || criteriaList[0].score - lowest.score >= 10) ? lowest : null;

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
      focusCriterion,
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

  // Unified review entries for grouped student review list
  const studentReviewEntries = useMemo(() => {
    const entries = [
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
      entries.sort((a, b) =>
        sortBy === "name_desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
      );
    }
    return entries;
  }, [filteredAndSortedGroups, filteredStudentsWithoutUploads, sortBy]);

  // Batched image URLs for photos view mode
  const visibleImagePaths = useMemo(() => {
    if (compact) return [];
    if (viewMode === "grouped") {
      return studentReviewEntries
        .filter(
          (
            entry
          ): entry is {
            kind: "upload";
            group: StudentSubmissionGroup;
            name: string;
          } => entry.kind === "upload"
        )
        .map((entry) => {
          const activeSub =
            (statusFilter === "all" || statusFilter === "needs_action"
              ? entry.group.allSubmissions.find(
                (sub) => sub.id === attemptOverrides.get(entry.group.studentId)?.id
              )
              : null) ?? entry.group.reviewSubmission;
          return activeSub.image_path;
        });
    }
    return filteredAndSortedSubmissions.map((s) => s.image_path);
  }, [
    compact,
    viewMode,
    studentReviewEntries,
    statusFilter,
    attemptOverrides,
    filteredAndSortedSubmissions,
  ]);

  const { data: signedUrlsMap } = useSubmissionImageUrls(visibleImagePaths);

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

  const allPendingScoringSubmissions = useMemo(() => {
    if (!submissions) return [];
    return studentGroups
      .map((g) => g.reviewSubmission)
      .filter((sub) =>
        matchesReviewFilter(sub, workByStudent.get(sub.student_id) ?? null, "needs_scoring")
      );
  }, [submissions, studentGroups, workByStudent]);

  const filteredPendingScoringSubmissions = useMemo(() => {
    if (!submissions) return [];
    const source =
      viewMode === "grouped"
        ? filteredAndSortedGroups.map((g) => g.reviewSubmission)
        : filteredAndSortedSubmissions;
    return source.filter((sub) =>
      matchesReviewFilter(sub, workByStudent.get(sub.student_id) ?? null, "needs_scoring")
    );
  }, [submissions, viewMode, filteredAndSortedGroups, filteredAndSortedSubmissions, workByStudent]);

  const handleStartGradingSprint = useCallback(() => {
    const queue =
      filteredPendingScoringSubmissions.length > 0
        ? filteredPendingScoringSubmissions
        : allPendingScoringSubmissions;
    if (queue.length === 0) return;
    const firstSub = queue[0];
    const query = reviewQueueQuery(new URLSearchParams(window.location.search));
    const studentIds = queue.map((sub) => sub.student_id);
    const submissionIds = queue.map((sub) => sub.id);
    setSession({ scope: id + query, studentIds, submissionIds });
    router.push("/activities/" + id + "/submissions/" + firstSub.id + query);
  }, [filteredPendingScoringSubmissions, allPendingScoringSubmissions, id, router, setSession]);

  useEffect(() => {
    handleStartGradingSprintRef.current = handleStartGradingSprint;
  }, [handleStartGradingSprint]);

  const handleSelectSubmission = useCallback(
    (sub: Submission) => {
      const query = reviewQueueQuery(new URLSearchParams(window.location.search));
      const studentIds =
        viewMode === "grouped"
          ? filteredAndSortedGroups.map((group) => group.studentId)
          : [...new Set(filteredAndSortedSubmissions.map((item) => item.student_id))];
      const submissionIds = viewMode === "grouped"
        ? filteredAndSortedGroups.map(group => (statusFilter === "all" ? group.allSubmissions.find(attempt => attempt.id === attemptOverrides.get(group.studentId)?.id) : null)?.id ?? group.reviewSubmission.id)
        : filteredAndSortedSubmissions.map(attempt => attempt.id);
      setSession({ scope: id + query, studentIds, submissionIds });
      router.push("/activities/" + id + "/submissions/" + sub.id + query);
    },
    [router, id, viewMode, filteredAndSortedGroups, filteredAndSortedSubmissions, setSession, statusFilter, attemptOverrides]
  );

  const handleReupload = useCallback(
    (studentId?: string) => {
      openUpload({ activityId: id, studentId });
    },
    [id, openUpload]
  );

  const handleSelectAttempt = useCallback((studentId: string, sub: Submission) => {
    setAttemptOverrides((prev) => {
      const next = new Map(prev);
      next.set(studentId, sub);
      return next;
    });
  }, [setAttemptOverrides]);

  // All selectable submission IDs in current view
  const allSelectableSubmissionIds = useMemo(() => {
    if (viewMode === "grouped") {
      return filteredAndSortedGroups.map(
        (g) =>
          (statusFilter === "all" || statusFilter === "needs_action"
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

  const allSelectableSubmissionIdsSet = useMemo(
    () => new Set(allSelectableSubmissionIds),
    [allSelectableSubmissionIds]
  );

  const selectedSubmissions = useMemo(
    () => (submissions ?? []).filter((sub) => selectedSubmissionIds.has(sub.id)),
    [submissions, selectedSubmissionIds]
  );
  const selectedCount = selectedSubmissions.length;
  const hiddenSelectedCount = useMemo(
    () => selectedSubmissions.filter((sub) => !allSelectableSubmissionIdsSet.has(sub.id)).length,
    [selectedSubmissions, allSelectableSubmissionIdsSet]
  );

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
  }, [setSelectedSubmissionIds]);

  const handleToggleCardSelect = handleToggleSelectSubmission;

  const clearSelection = useCallback(() => {
    setSelectedSubmissionIds(new Set());
  }, [setSelectedSubmissionIds]);

  const clearHiddenSelections = useCallback(() => {
    setSelectedSubmissionIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (allSelectableSubmissionIdsSet.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [allSelectableSubmissionIdsSet, setSelectedSubmissionIds]);

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
  }, [allVisibleSelected, allSelectableSubmissionIds, setSelectedSubmissionIds]);

  const handleBatchDeleteConfirm = async () => {
    if (!selectedCount || selectedSubmissionIds.size !== selectedCount || submissionsError || submissionsLoading) return;
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

  const releasableSelected = useMemo(() => {
    return selectedSubmissions.filter((sub) => {
      const isCompleted = sub.status === "completed";
      const isNotReleased = !sub.released_at;
      const score = resolveSubmissionScore(sub);
      return isCompleted && isNotReleased && score.isScored;
    });
  }, [selectedSubmissions]);

  const handleBatchReleaseConfirm = async () => {
    if (!releasableSelected.length) return;
    setIsBatchReleasing(true);
    try {
      const results = await batchReleaseMutation.mutateAsync(
        releasableSelected.map((sub) => sub.id)
      );

      const succeededIds: string[] = [];
      let failedCount = 0;

      results.forEach((res, index) => {
        if (res.status === "fulfilled") {
          succeededIds.push(releasableSelected[index].id);
        } else {
          failedCount++;
        }
      });

      if (succeededIds.length > 0) {
        setSelectedSubmissionIds((prev) => {
          const next = new Set(prev);
          succeededIds.forEach((sid) => next.delete(sid));
          return next;
        });
      }

      if (failedCount === 0) {
        toast.success(
          `Released ${succeededIds.length} ${succeededIds.length === 1 ? "worksheet" : "worksheets"} to parents.`
        );
        setIsBatchReleaseDialogOpen(false);
      } else if (succeededIds.length > 0) {
        toast.warning(
          `Released ${succeededIds.length} worksheets, but ${failedCount} failed to release. The remaining items remain selected for retry.`
        );
        setIsBatchReleaseDialogOpen(false);
      } else {
        toast.error("Failed to release selected worksheets. Please check your network and try again.");
      }
    } catch {
      toast.error("An unexpected error occurred while releasing worksheets.");
    } finally {
      setIsBatchReleasing(false);
    }
  };

  const selectedStudentIds = useMemo(() => {
    return Array.from(new Set(selectedSubmissions.map((s) => s.student_id)));
  }, [selectedSubmissions]);

  const handleBatchExcuse = async () => {
    if (!selectedStudentIds.length) return;
    setIsBatchExcusing(true);
    try {
      const results = await batchUpdateWorkMutation.mutateAsync({
        activityId: id,
        studentIds: selectedStudentIds,
        body: { excused: true },
      });

      const succeededStudentIds = new Set<string>();
      let failedCount = 0;

      results.forEach((res, index) => {
        if (res.status === "fulfilled") {
          succeededStudentIds.add(selectedStudentIds[index]);
        } else {
          failedCount++;
        }
      });

      if (succeededStudentIds.size > 0) {
        setSelectedSubmissionIds((prev) => {
          const next = new Set(prev);
          selectedSubmissions.forEach((sub) => {
            if (succeededStudentIds.has(sub.student_id)) {
              next.delete(sub.id);
            }
          });
          return next;
        });
      }

      if (failedCount === 0) {
        const excusedIds = Array.from(succeededStudentIds);
        toast.success(
          `Marked ${excusedIds.length} ${excusedIds.length === 1 ? "student" : "students"} as excused.`,
          {
            action: {
              label: "Undo",
              onClick: () => {
                void batchUpdateWorkMutation
                  .mutateAsync({
                    activityId: id,
                    studentIds: excusedIds,
                    body: { excused: false },
                  })
                  .then(() => {
                    toast.success("Excuse status reverted.");
                  })
                  .catch(() => {
                    toast.error("Could not undo excuse status. Please update individually.");
                  });
              },
            },
          }
        );
        setIsBatchExcuseDialogOpen(false);
      } else if (succeededStudentIds.size > 0) {
        toast.warning(
          `Excused ${succeededStudentIds.size} students, but ${failedCount} failed. The remaining items remain selected.`
        );
        setIsBatchExcuseDialogOpen(false);
      } else {
        toast.error("Failed to excuse selected students. Please try again.");
      }
    } catch {
      toast.error("An unexpected error occurred while updating students.");
    } finally {
      setIsBatchExcusing(false);
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
    [setStudentBatchToDelete]
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
            className="text-muted-foreground hover:text-foreground group focus-visible:ring-ring hover:bg-muted/50 -ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden md:min-h-[36px]"
          >
            <ArrowLeft
              className="size-3.5 transition-transform group-hover:-translate-x-0.5 motion-reduce:transform-none"
              aria-hidden="true"
            />
            <span>Back to Activities</span>
          </Link>
        </div>
        <div
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive flex flex-col items-center justify-between gap-4 rounded-xl border p-4 sm:flex-row"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium">
              Activity not found or unable to load. Please check your connection and try again.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-destructive/30 hover:bg-destructive/10 text-destructive min-h-11 cursor-pointer md:min-h-9"
          >
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
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
            className="text-muted-foreground hover:text-foreground group focus-visible:ring-ring hover:bg-muted/50 -ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden md:min-h-[36px]"
          >
            <ArrowLeft
              className="size-3.5 transition-transform group-hover:-translate-x-0.5 motion-reduce:transform-none"
              aria-hidden="true"
            />
            <span>Back to Activities</span>
          </Link>
        </div>
        <div className="bg-surface dark:bg-card border-border shadow-warm overflow-hidden rounded-xl border sm:rounded-2xl">
          <Empty className="border-0 py-12 sm:py-14 px-4">
            <EmptyMedia
              variant="icon"
              className="size-11 rounded-xl bg-muted text-muted-foreground border border-border/40"
            >
              <ClipboardList className="size-5 sm:size-6" aria-hidden="true" />
            </EmptyMedia>
            <EmptyHeader className="max-w-md">
              <EmptyTitle className="text-lg sm:text-xl font-medium tracking-tight text-foreground">
                Activity not found
              </EmptyTitle>
              <EmptyDescription className="mx-auto max-w-sm text-xs sm:text-sm text-muted-foreground">
                This activity may have been removed or you don&apos;t have access.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex w-full items-center justify-center px-4 sm:w-auto sm:px-0">
              <Link
                href="/activities"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-10 min-h-[44px] cursor-pointer rounded-lg px-3.5 text-xs font-medium sm:rounded-xl sm:text-sm md:h-9 md:min-h-[36px]"
                )}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
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
  const resultUnit = viewMode === "grouped" ? "student" : "upload";
  const viewAllLabel = viewMode === "grouped" ? "View all students" : "View all uploads";

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 pb-28 sm:gap-5 sm:pb-24">
      {/* Top Back Navigation Trail */}
      <nav aria-label="Breadcrumb navigation" className="flex items-center print:hidden">
        <Link
          href="/activities"
          className="text-muted-foreground hover:text-foreground group focus-visible:ring-ring hover:bg-muted/50 -ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:-ml-2 md:min-h-[36px]"
        >
          <ArrowLeft
            className="size-3.5 transition-transform group-hover:-translate-x-0.5 motion-reduce:transform-none"
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
        onRetrySummary={() => {
          if (studentsError) void refetchStudents();
          if (workQuery.isError) void workQuery.refetch();
          if (submissionsError) void refetchSubmissions();
        }}
        hasCopiedPrompt={hasCopiedPrompt}
        onCopyPrompt={handleCopyPrompt}
        onUpload={handleOpenUpload}
        onEdit={handleEditActivity}
        onDuplicate={handleDuplicateActivity}
        onDelete={handleDeleteActivity}
        onToggleArchive={handleToggleArchive}
      />

      {commentTarget.kind !== "none" && (
        <div
          role="status"
          className="bg-muted/40 border-border flex flex-col items-start justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
        >
          <p className="text-muted-foreground text-sm">
            Choose a worksheet upload to view its comments.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={closeComments}
            className="min-h-11 md:min-h-9"
          >
            Dismiss
          </Button>
        </div>
      )}
      <section
        id="student-work"
        aria-labelledby="submissions-heading"
        className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 scroll-mt-20"
      >
        {/* Section Header with Controls */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="submissions-heading"
              className="font-heading text-foreground text-lg font-semibold tracking-tight sm:text-xl"
            >
              Student work
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 empty:hidden">
            {allPendingScoringSubmissions.length > 0 && (
              <Button
                type="button"
                variant="default"
                size="default"
                onClick={handleStartGradingSprint}
                className="min-h-[44px] md:min-h-[36px] px-3.5 rounded-lg text-xs font-semibold cursor-pointer shadow-xs gap-1.5"
                aria-label={`Start grading sprint. ${allPendingScoringSubmissions.length} worksheets pending scoring.`}
                aria-keyshortcuts="Alt+G"
              >
                <PenLine className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Start Grading ({allPendingScoringSubmissions.length} Pending)</span>
                <kbd className="text-primary-foreground/75 border-primary-foreground/30 ml-1 hidden rounded border px-1.5 py-0.5 text-[10px] font-mono sm:inline-block">
                  {altKey}+G
                </kbd>
              </Button>
            )}

            <ReleaseActivityButton
              activityId={id}
              userId={activity.created_by}
              hasPointGrades={activity.points_possible != null}
              students={students ?? []}
              rosterReady={rosterReady}
              isFiltered={Boolean(searchQuery.trim() || statusFilter !== "all")}
              filteredCount={currentListLength}
              totalCount={totalStudents}
            />
          </div>
        </div>

        {studentsError && (
          <Alert variant="destructive">
            <AlertTitle>Could not load assigned students</AlertTitle>
            <AlertDescription>
              Assignment totals are unavailable. Existing uploads remain below.
              <Button
                variant="outline"
                className="ml-2 min-h-11 md:min-h-9"
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
                className="ml-2 min-h-11 md:min-h-9"
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
                className="ml-2 min-h-11 md:min-h-9"
                onClick={handleEditActivity}
              >
                Edit assignments
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {submissions && (submissions.length > 0 || assignedStudents.length > 0) && (
          <ActivityReviewToolbar
            searchInputRef={searchInputRef}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onClearSearch={handleClearSearch}
            altKey={altKey}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            submissionFilterItems={submissionFilterItems}
            viewMode={viewMode}
            onViewModeChange={(val) => {
              setViewMode(val);
              clearSelection();
              setManagingAttempts(false);
              setAttemptOverrides(new Map());
            }}
            compact={compact}
            onLayoutChange={(val) =>
              updateReviewParams({ layout: val === "photos" ? "photos" : null })
            }
            sortBy={sortBy}
            onSortByChange={setSortBy}
            managingAttempts={managingAttempts}
            onToggleManagingAttempts={() => {
              setManagingAttempts(!managingAttempts);
              clearSelection();
            }}
            allVisibleSelected={allVisibleSelected}
            someVisibleSelected={someVisibleSelected}
            onToggleSelectAll={handleToggleSelectAll}
            selectedCount={selectedCount}
            hiddenSelectedCount={hiddenSelectedCount}
            onClearSelection={clearSelection}
            onClearHiddenSelection={clearHiddenSelections}
          />
        )}

        {submissions && (searchQuery.trim() || statusFilter !== "all") && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span>
              Showing <strong className="text-foreground">{currentListLength}</strong> of <strong className="text-foreground">{totalStudents}</strong> {resultUnit}s
              {statusFilter !== "all" ? ` (${reviewFilterLabels[statusFilter]})` : ""}
              {searchQuery ? ` matching "${searchQuery}"` : ""}.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                handleClearSearch();
                setStatusFilter("all");
              }}
              className="min-h-[44px] sm:min-h-[28px] px-2.5 text-xs text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
            >
              Reset filters
            </Button>
          </div>
        )}

        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {submissions &&
            `Showing ${currentListLength} ${resultUnit}${currentListLength === 1 ? "" : "s"}${statusFilter !== "all" ? ` filtered by ${reviewFilterLabels[statusFilter]}` : ""
            }${searchQuery ? ` matching "${searchQuery}"` : ""}.`}
        </div>

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
              <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium">
                Couldn&apos;t load submissions. Check your connection and try again.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchSubmissions()}
              className="border-destructive/30 hover:bg-destructive/10 text-destructive min-h-11 cursor-pointer md:min-h-9"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        ) : submissions?.length === 0 && (viewMode === "all" || !assignedStudents.length) ? (
          /* Empty state: No submissions at all */
          <div className="bg-surface dark:bg-card border-border shadow-warm overflow-hidden rounded-xl border sm:rounded-2xl">
            <Empty className="border-0 py-12 sm:py-14 px-4">
              <EmptyMedia
                variant="icon"
                className="size-11 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300"
              >
                <Inbox className="size-5 sm:size-6" aria-hidden="true" />
              </EmptyMedia>
              <EmptyHeader className="max-w-md">
                <EmptyTitle className="text-lg sm:text-xl font-medium tracking-tight text-foreground">
                  No submissions yet
                </EmptyTitle>
                <EmptyDescription className="mx-auto max-w-sm text-xs sm:text-sm text-muted-foreground">
                  Upload a student&apos;s handwriting worksheet for this activity to begin AI
                  diagnostic assessment.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex w-full items-center justify-center px-4 sm:w-auto sm:px-0">
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 min-h-[44px] w-full cursor-pointer rounded-lg px-4 text-xs font-medium sm:w-auto sm:rounded-xl sm:text-sm md:h-9 md:min-h-[36px]"
                  onClick={() => openUpload({ activityId: id })}
                >
                  <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  <span>Upload worksheet</span>
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        ) : currentListLength === 0 ? (
          <ActivityReviewEmptyStates
            statusFilter={statusFilter}
            searchQuery={searchQuery}
            hasSubmissions={(submissions?.length ?? 0) > 0}
            assignedStudentsCount={assignedStudents.length}
            studentsWithoutUploadsCount={studentsWithoutUploads.length}
            resultUnit={resultUnit}
            viewAllLabel={viewAllLabel}
            onClearSearch={handleClearSearch}
            onSetStatusFilter={setStatusFilter}
            onOpenUpload={() => openUpload({ activityId: id })}
          />
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
                  const workState = workQuery.isError
                    ? null
                    : (workByStudent.get(student.id) ?? null);
                  return (
                    <UnsubmittedCard
                      key={student.id}
                      compact={compact}
                      student={student}
                      activityId={id}
                      workState={workState}
                      workLoading={workQuery.isPending}
                      onUpload={handleReupload}
                    />
                  );
                }
                const { group } = entry;
                const activeSub =
                  (statusFilter === "all" || statusFilter === "needs_action"
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
                    batchManaged={!compact}
                    submission={activeSub}
                    studentName={group.studentName}
                    imageUrl={signedUrlsMap?.get(activeSub.image_path)}
                    attemptCount={group.attemptCount}
                    allSubmissions={group.allSubmissions}
                    countedSubmissionId={
                      workQuery.isSuccess
                        ? (workState?.active_submission_id ?? null)
                        : undefined
                    }
                    latestSubmission={group.latestSubmission}
                    activityId={id}
                    workState={workState}
                    workLoading={workQuery.isPending}
                    onSelectAttempt={handleSelectAttempt}
                    onSelect={handleSelectSubmission}
                    onReupload={handleReupload}
                    isSelected={selectedSubmissionIds.has(activeSub.id)}
                    onToggleSelect={managingAttempts ? handleToggleCardSelect : undefined}
                    onDeleteSingleAttempt={handleDeleteSingleAttemptPrompt}
                    onDeleteAllStudentAttempts={handleDeleteAllStudentAttemptsPrompt}
                  />
                );
              })
              : filteredAndSortedSubmissions.map((sub) => (
                <SubmissionCard
                  key={sub.id}
                  compact={compact}
                  batchManaged={!compact}
                  submission={sub}
                  studentName={sub.student?.full_name ?? "Unknown Student"}
                  imageUrl={signedUrlsMap?.get(sub.image_path)}
                  onSelect={handleSelectSubmission}
                  onReupload={handleReupload}
                  isSelected={selectedSubmissionIds.has(sub.id)}
                  onToggleSelect={managingAttempts ? handleToggleCardSelect : undefined}
                  onDeleteSingleAttempt={handleDeleteSingleAttemptPrompt}
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
          render={<Button variant="ghost" className="min-h-11 gap-2 md:min-h-9" />}
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
        totalCount={allSelectableSubmissionIds.length + hiddenSelectedCount}
        itemLabel={{ singular: "attempt", plural: "attempts" }}
        allSelected={allVisibleSelected}
        onSelectAll={handleToggleSelectAll}
        onClearSelection={clearSelection}
        ariaLabel="Batch attempt actions"
      >
        {hiddenSelectedCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-200">
            <AlertCircle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span>
              {hiddenSelectedCount} hidden {hiddenSelectedCount === 1 ? "attempt" : "attempts"}
            </span>
            <button
              type="button"
              onClick={clearHiddenSelections}
              className="ml-1 font-semibold underline hover:no-underline text-amber-950 dark:text-amber-100 cursor-pointer"
            >
              Clear hidden
            </button>
          </div>
        )}
        {selectedStudentsCount > 0 && (
          <span className="text-muted-foreground mr-1 hidden text-xs sm:inline">
            ({selectedStudentsCount} {selectedStudentsCount === 1 ? "student" : "students"})
          </span>
        )}
        {releasableSelected.length > 0 && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setIsBatchReleaseDialogOpen(true)}
            disabled={isBatchReleasing || batchDeleteMutation.isPending}
            className="min-h-11 cursor-pointer gap-1.5 rounded-full px-3.5 text-xs font-semibold shadow-xs md:min-h-9 bg-brand-700 hover:bg-brand-800 dark:bg-primary dark:hover:bg-primary/90 text-white dark:text-primary-foreground"
          >
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            <span>
              Release {releasableSelected.length}{" "}
              <span className="hidden sm:inline">
                {releasableSelected.length === 1 ? "Worksheet" : "Worksheets"}
              </span>
            </span>
          </Button>
        )}
        {selectedStudentIds.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsBatchExcuseDialogOpen(true)}
            disabled={isBatchExcusing || batchDeleteMutation.isPending}
            className="min-h-11 cursor-pointer gap-1.5 rounded-full px-3.5 text-xs font-medium md:min-h-9 border-border/80 hover:bg-muted/60"
          >
            <span>
              Excuse {selectedStudentIds.length}{" "}
              <span className="hidden sm:inline">
                {selectedStudentIds.length === 1 ? "Student" : "Students"}
              </span>
            </span>
          </Button>
        )}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setIsBatchDeleteDialogOpen(true)}
          disabled={batchDeleteMutation.isPending || isBatchReleasing || isBatchExcusing}
          className="min-h-11 cursor-pointer gap-1.5 rounded-full px-3.5 text-xs font-semibold shadow-xs md:min-h-9"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          <span>
            Delete {selectedCount}{" "}
            <span className="hidden sm:inline">
              {selectedCount === 1 ? "Attempt" : "Attempts"}
            </span>
          </span>
        </Button>
      </FloatingActionBar>

      {/* Batch Release Confirmation Dialog */}
      <BatchReleaseDialog
        open={isBatchReleaseDialogOpen}
        onOpenChange={setIsBatchReleaseDialogOpen}
        releasableSubmissions={releasableSelected}
        totalSelectedCount={selectedCount}
        students={students}
        isReleasing={isBatchReleasing}
        onConfirm={handleBatchReleaseConfirm}
      />

      {/* Batch Excuse Confirmation Dialog */}
      <AlertDialog open={isBatchExcuseDialogOpen} onOpenChange={setIsBatchExcuseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excuse {selectedStudentIds.length}{" "}
              {selectedStudentIds.length === 1 ? "student" : "students"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedStudentIds.length === 1
                ? "This student will be marked excused for this activity and excluded from missing-work counts."
                : `These ${selectedStudentIds.length} students will be marked excused for this activity and excluded from missing-work counts.`}
              {hiddenSelectedCount > 0 && (
                <>
                  {" "}
                  Note: {hiddenSelectedCount}{" "}
                  {hiddenSelectedCount === 1 ? "selected attempt is" : "selected attempts are"}{" "}
                  currently hidden by your active filter.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBatchExcusing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isBatchExcusing}
              onClick={(e) => {
                e.preventDefault();
                void handleBatchExcuse();
              }}
            >
              {isBatchExcusing ? "Excusing…" : `Excuse ${selectedStudentIds.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attempt Deletion Alert Dialogs */}
      <AttemptDeletionDialogs
        isBatchDeleteDialogOpen={isBatchDeleteDialogOpen}
        onBatchDialogOpenChange={setIsBatchDeleteDialogOpen}
        selectedCount={selectedCount}
        hiddenSelectedCount={hiddenSelectedCount}
        unavailableSelectedCount={selectedSubmissionIds.size - selectedCount}
        selectedSubmissions={selectedSubmissions}
        activeIds={activeIds}
        students={students}
        isBatchDeleting={batchDeleteMutation.isPending}
        hasSubmissionsError={!!submissionsError}
        isSubmissionsLoading={submissionsLoading}
        onConfirmBatchDelete={handleBatchDeleteConfirm}
        onClearSelection={clearSelection}
        onClearHiddenSelection={clearHiddenSelections}
        singleAttemptToDelete={singleAttemptToDelete}
        onSingleAttemptDialogOpenChange={(open) => !open && setSingleAttemptToDelete(null)}
        isSingleDeleting={deleteSingleMutation.isPending}
        onConfirmSingleDelete={handleConfirmDeleteSingleAttempt}
        studentBatchToDelete={studentBatchToDelete}
        onStudentBatchDialogOpenChange={(open) => !open && setStudentBatchToDelete(null)}
        isStudentBatchDeleting={batchDeleteMutation.isPending}
        onConfirmStudentBatchDelete={handleConfirmDeleteStudentBatch}
      />
    </div>
  );
}

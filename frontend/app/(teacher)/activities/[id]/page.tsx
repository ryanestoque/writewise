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
  useSubmissionImageUrl,
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
  DropdownMenuSeparator,
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
  Home,
  CalendarDays,
  FileText,
  Upload,
  Inbox,
  AlertCircle,
  RotateCcw,
  MoreVertical,
  Edit3,
  Trash2,
  Archive,
  ArchiveRestore,
  Copy,
  SearchX,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Sparkles,
  GraduationCap,
  Camera,
  History,
  ChevronDown,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

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

function getWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "Just now";
}

function getRejectionSummary(code: string | null): {
  label: string;
  detail: string;
} {
  switch (code) {
    case "QUALITY_GATE_BLUR":
      return {
        label: "Blurry photo",
        detail: "Tap to focus and hold camera steady",
      };
    case "QUALITY_GATE_LIGHTING":
      return {
        label: "Uneven lighting / glare",
        detail: "Avoid harsh overhead glare and shadows",
      };
    case "QUALITY_GATE_SKEW":
      return {
        label: "Tilted worksheet",
        detail: "Capture flat from directly above",
      };
    case "QUALITY_GATE_OCCLUDED":
      return {
        label: "Ruling lines covered",
        detail: "Keep all 4 worksheet corners visible",
      };
    case "QUALITY_GATE_NO_TEXT":
      return {
        label: "No handwriting detected",
        detail: "Ensure pencil strokes are dark and legible",
      };
    case "SEGMENTATION_COUNT_MISMATCH":
      return {
        label: "Word count mismatch",
        detail: "Verify all target words are written",
      };
    default:
      return {
        label: "Scan clarity issue",
        detail: "Retake photo flat with clear lighting",
      };
  }
}

function getScoreBandLabel(score: number | null | undefined): {
  label: string;
  className: string;
  dotColor: string;
} {
  if (score === null || score === undefined) {
    return {
      label: "Scored",
      className: "bg-muted/50 text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
    };
  }
  if (score >= 80) {
    return {
      label: `${Math.round(score)}% • Excellent`,
      className:
        "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900",
      dotColor: "bg-emerald-500",
    };
  }
  if (score >= 60) {
    return {
      label: `${Math.round(score)}% • Satisfactory`,
      className:
        "bg-[#eef4ec] text-[#3d6837] dark:bg-brand-950/80 dark:text-brand-300 border-[#7c9b6e]/30 dark:border-brand-900",
      dotColor: "bg-[#7c9b6e]",
    };
  }
  if (score >= 40) {
    return {
      label: `${Math.round(score)}% • Developing`,
      className:
        "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200/80 dark:border-amber-900",
      dotColor: "bg-amber-500",
    };
  }
  return {
    label: `${Math.round(score)}% • Needs Impr.`,
    className:
      "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200/80 dark:border-orange-900",
    dotColor: "bg-orange-500",
  };
}

const statusConfig = {
  processing: {
    label: "Processing",
    icon: Clock,
    className:
      "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    dotClass: "bg-amber-500 animate-pulse",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className:
      "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
    dotClass: "bg-emerald-500",
  },
  rejected: {
    label: "Rejected",
    icon: AlertCircle,
    className:
      "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive border-destructive/20 dark:border-destructive/30",
    dotClass: "bg-destructive",
  },
} as const;

function StudentSubmissionCard({
  group,
  onSelect,
  onReupload,
}: {
  group: StudentSubmissionGroup;
  onSelect: (submission: Submission) => void;
  onReupload: (studentId: string) => void;
}) {
  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState(0);
  const currentSubmission =
    group.allSubmissions[selectedAttemptIndex] ?? group.latestSubmission;

  const { data: imageUrl } = useSubmissionImageUrl(currentSubmission.image_path);
  const config = statusConfig[currentSubmission.status];
  const compositeScore = currentSubmission.measurement?.composite_score;
  const scoreBand = getScoreBandLabel(compositeScore);
  const rejection = getRejectionSummary(currentSubmission.rejection_code);
  const hasMultipleAttempts = group.attemptCount > 1;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(currentSubmission)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(currentSubmission);
        }
      }}
      className="group relative flex flex-col justify-between bg-surface dark:bg-card border border-border hover:border-brand-300 dark:hover:border-brand-800 rounded-xl sm:rounded-2xl shadow-warm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring text-left"
      aria-label={`View submission for ${group.studentName}`}
    >
      {/* Photo Thumbnail */}
      <div className="aspect-4/3 bg-muted/60 relative overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`Handwriting by ${group.studentName}`}
            className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="size-full flex items-center justify-center text-muted-foreground/60">
            <FileText className="size-8" />
          </div>
        )}

        {/* Floating status pill */}
        <div className="absolute top-2.5 right-2.5">
          <Badge
            variant="outline"
            className={`text-xs font-semibold px-2 py-0.5 shadow-xs backdrop-blur-xs ${config.className}`}
          >
            <span className={`size-1.5 rounded-full mr-1 ${config.dotClass}`} />
            {config.label}
          </Badge>
        </div>

        {/* Attempt indicator & history switcher if multiple attempts exist */}
        {hasMultipleAttempts && (
          <div
            className="absolute top-2.5 left-2.5 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-background/90 text-foreground dark:bg-card/90 border border-border shadow-xs backdrop-blur-xs hover:bg-background transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Switch attempt for ${group.studentName}. Currently showing attempt ${group.attemptCount - selectedAttemptIndex} of ${group.attemptCount}`}
              >
                <History className="size-2.5 text-muted-foreground" />
                <span>
                  Attempt {group.attemptCount - selectedAttemptIndex}/
                  {group.attemptCount}
                </span>
                <ChevronDown className="size-2.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <div className="text-xs text-muted-foreground font-medium px-2.5 py-1.5">
                  Submission History ({group.attemptCount} attempts)
                </div>
                <DropdownMenuSeparator />
                {group.allSubmissions.map((sub, idx) => {
                  const attemptNum = group.attemptCount - idx;
                  const isCurrent = idx === selectedAttemptIndex;
                  const isLatest = idx === 0;
                  const subConfig = statusConfig[sub.status];

                  return (
                    <DropdownMenuItem
                      key={sub.id}
                      onClick={() => setSelectedAttemptIndex(idx)}
                      className="cursor-pointer text-xs flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`size-1.5 rounded-full shrink-0 ${subConfig.dotClass}`}
                        />
                        <span className="font-medium truncate">
                          Attempt {attemptNum} {isLatest && "(Latest)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                        <span className="text-[11px]">
                          {getRelativeTime(sub.created_at)}
                        </span>
                        {isCurrent && (
                          <span className="text-primary font-bold">✓</span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Uploader indicator (if parent) */}
        {currentSubmission.uploader_role === "parent" && (
          <div className="absolute bottom-2.5 left-2.5">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold px-2 py-0.5 bg-brand-50/90 text-brand-800 dark:bg-brand-950/90 dark:text-brand-300 border-brand-200/80 backdrop-blur-xs"
            >
              <Home className="size-2.5 mr-1" />
              Parent upload
            </Badge>
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground truncate group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
              {group.studentName}
            </p>
            {hasMultipleAttempts && (
              <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                {group.attemptCount} tries
              </span>
            )}
          </div>

          {/* Diagnostic score or Rejection note */}
          {currentSubmission.status === "completed" && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={`text-[11px] font-semibold px-2 py-0.5 ${scoreBand.className}`}
              >
                <span
                  className={`size-1.5 rounded-full mr-1 ${scoreBand.dotColor}`}
                />
                {scoreBand.label}
              </Badge>
            </div>
          )}

          {currentSubmission.status === "rejected" && (
            <div className="mt-1 space-y-0.5">
              <p className="text-xs text-destructive flex items-center gap-1 font-medium truncate">
                <AlertCircle className="size-3 shrink-0" />
                <span>{rejection.label}</span>
              </p>
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {rejection.detail}
              </p>
            </div>
          )}

          {currentSubmission.status === "processing" && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium truncate">
              <Clock className="size-3 shrink-0 animate-pulse" />
              <span>Analyzing cursive strokes...</span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
          <span>{getRelativeTime(currentSubmission.created_at)}</span>

          {currentSubmission.status === "rejected" ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReupload(group.studentId);
              }}
              className="text-xs font-semibold text-primary hover:text-brand-700 dark:hover:text-brand-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Camera className="size-3" />
              Re-upload
            </button>
          ) : (
            <span className="text-[11px] font-medium text-primary group-hover:underline">
              Inspect details &rarr;
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function FlatSubmissionCard({
  submission,
  onSelect,
  onReupload,
}: {
  submission: Submission;
  onSelect: () => void;
  onReupload: () => void;
}) {
  const { data: imageUrl } = useSubmissionImageUrl(submission.image_path);
  const config = statusConfig[submission.status];
  const compositeScore = submission.measurement?.composite_score;
  const scoreBand = getScoreBandLabel(compositeScore);
  const rejection = getRejectionSummary(submission.rejection_code);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="group relative flex flex-col justify-between bg-surface dark:bg-card border border-border hover:border-brand-300 dark:hover:border-brand-800 rounded-xl sm:rounded-2xl shadow-warm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring text-left"
      aria-label={`View submission for ${submission.student?.full_name ?? "student"}`}
    >
      {/* Photo Thumbnail */}
      <div className="aspect-4/3 bg-muted/60 relative overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`Handwriting by ${submission.student?.full_name ?? "student"}`}
            className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="size-full flex items-center justify-center text-muted-foreground/60">
            <FileText className="size-8" />
          </div>
        )}

        {/* Floating status pill */}
        <div className="absolute top-2.5 right-2.5">
          <Badge
            variant="outline"
            className={`text-xs font-semibold px-2 py-0.5 shadow-xs backdrop-blur-xs ${config.className}`}
          >
            <span className={`size-1.5 rounded-full mr-1 ${config.dotClass}`} />
            {config.label}
          </Badge>
        </div>

        {/* Uploader indicator (if parent) */}
        {submission.uploader_role === "parent" && (
          <div className="absolute bottom-2.5 left-2.5">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold px-2 py-0.5 bg-brand-50/90 text-brand-800 dark:bg-brand-950/90 dark:text-brand-300 border-brand-200/80 backdrop-blur-xs"
            >
              <Home className="size-2.5 mr-1" />
              Parent upload
            </Badge>
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
            {submission.student?.full_name ?? "Unknown Student"}
          </p>

          {/* Diagnostic score or Rejection note */}
          {submission.status === "completed" && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={`text-[11px] font-semibold px-2 py-0.5 ${scoreBand.className}`}
              >
                <span
                  className={`size-1.5 rounded-full mr-1 ${scoreBand.dotColor}`}
                />
                {scoreBand.label}
              </Badge>
            </div>
          )}

          {submission.status === "rejected" && (
            <div className="mt-1 space-y-0.5">
              <p className="text-xs text-destructive flex items-center gap-1 font-medium truncate">
                <AlertCircle className="size-3 shrink-0" />
                <span>{rejection.label}</span>
              </p>
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {rejection.detail}
              </p>
            </div>
          )}

          {submission.status === "processing" && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium truncate">
              <Clock className="size-3 shrink-0 animate-pulse" />
              <span>Analyzing cursive strokes...</span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
          <span>{getRelativeTime(submission.created_at)}</span>

          {submission.status === "rejected" ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReupload();
              }}
              className="text-xs font-semibold text-primary hover:text-brand-700 dark:hover:text-brand-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Camera className="size-3" />
              Re-upload
            </button>
          ) : (
            <span className="text-[11px] font-medium text-primary group-hover:underline">
              Inspect details &rarr;
            </span>
          )}
        </div>
      </div>
    </div>
  );
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
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null);

  // View, search, filter, and sort states
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubmissionFilter>("all");
  const [sortBy, setSortBy] = useState<SubmissionSort>("newest");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Shortcut key listener for '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName
        )
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Hardened Roster Metrics: Unique enrolled students with submissions
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
      // sort attempts newest first
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
    if (!submissions) return { all: 0, completed: 0, processing: 0, rejected: 0 };
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

  const submissionFilterItems = useMemo<FilterPillItem<SubmissionFilter>[]>(() => {
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
        const scoreA = a.latestSubmission.measurement?.composite_score ?? -1;
        const scoreB = b.latestSubmission.measurement?.composite_score ?? -1;
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
        const scoreA = a.measurement?.composite_score ?? -1;
        const scoreB = b.measurement?.composite_score ?? -1;
        return scoreB - scoreA;
      }
      return 0;
    });
  }, [submissions, searchQuery, statusFilter, sortBy]);

  // Dialog navigation flat list
  const activeDialogSubmissionsList = useMemo(() => {
    if (viewMode === "grouped") {
      return filteredAndSortedGroups.map((g) => g.latestSubmission);
    }
    return filteredAndSortedSubmissions;
  }, [viewMode, filteredAndSortedGroups, filteredAndSortedSubmissions]);

  const currentSubmissionIndex = useMemo(() => {
    if (!selectedSubmission) return -1;
    return activeDialogSubmissionsList.findIndex(
      (s) => s.id === selectedSubmission.id
    );
  }, [activeDialogSubmissionsList, selectedSubmission]);

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
              {error.message.includes("not found") ||
              error.message.includes("No rows")
                ? "Activity not found. It may have been removed."
                : `Failed to load activity: ${error.message}`}
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
        <Skeleton className="h-4 w-32" />
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-6 space-y-4 shadow-warm">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-6 space-y-4 shadow-warm">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
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
  const promptLength = activity.target_text.length;
  const promptTypographyClass =
    promptLength < 25
      ? "text-[28px] sm:text-[36px] leading-[48px]"
      : promptLength < 60
      ? "text-[23px] sm:text-[28px] leading-[48px]"
      : "text-[19px] sm:text-[22px] leading-[48px]";

  const currentListLength =
    viewMode === "grouped"
      ? filteredAndSortedGroups.length
      : filteredAndSortedSubmissions.length;

  return (
    <div className="w-full space-y-5 sm:space-y-6 pb-28 sm:pb-24 px-1 sm:px-0">
      {/* Top Back Navigation Trail */}
      <div className="flex items-center justify-between">
        <Link
          href="/activities"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Activities</span>
        </Link>
      </div>

      {/* Activity Details Card with Authentic 3-Line Cursive Ruling */}
      <div
        className={`relative bg-surface dark:bg-card border rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-warm transition-all ${
          isArchived
            ? "border-dashed border-border/80 opacity-90"
            : "border-border"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            {/* Header: Type, Status, Metadata Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {isArchived ? (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-0.5 bg-muted/60 text-muted-foreground border-border"
                >
                  <Archive className="w-3.5 h-3.5 mr-1" />
                  Archived
                </Badge>
              ) : activity.is_take_home ? (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-200/80 dark:border-brand-900"
                >
                  <Home className="w-3.5 h-3.5 mr-1" />
                  Take-home Activity
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-0.5 bg-muted/40 text-muted-foreground border-border"
                >
                  In-Class Activity
                </Badge>
              )}

              <Badge
                variant="outline"
                className="text-xs font-medium px-2.5 py-0.5 bg-muted/50 text-muted-foreground border-border/70"
              >
                {wordCount} {wordCount === 1 ? "word" : "words"}
              </Badge>

              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" />
                Created {formatDate(activity.created_at)}
              </span>
            </div>

            {/* Target Text Prompt Preview on 3-Line Penmanship Ruling */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-brand-600 dark:text-brand-400" />
                  <span>Target Handwriting Prompt</span>
                </span>
                <span className="text-[11px] text-muted-foreground/80 font-medium">
                  3-line ruling preview
                </span>
              </div>

              <div className="relative p-4 sm:p-5 min-h-[76px] rounded-xl bg-linear-to-b from-brand-50/20 via-surface to-brand-50/10 dark:from-card dark:to-card/80 border border-brand-200/50 dark:border-border/60 overflow-hidden shadow-2xs">
                {/* Decorative 3-line penmanship ruling */}
                <div
                  className="absolute inset-x-4 inset-y-4 pointer-events-none opacity-40 dark:opacity-20 cursive-guidelines overflow-hidden"
                  aria-hidden="true"
                />
                <p
                  className={cn(
                    "relative font-cursive text-foreground/90 font-normal tracking-wide select-all break-words",
                    promptTypographyClass
                  )}
                >
                  {activity.target_text}
                </p>
              </div>
            </div>

            {/* Hardened Class Roster Completion Metric */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 flex-wrap">
                <GraduationCap className="size-4 text-brand-600 dark:text-brand-400 shrink-0" />
                <span>
                  <strong className="text-foreground font-semibold">
                    {uniqueStudentsCount}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-foreground font-semibold">
                    {totalStudents}
                  </strong>{" "}
                  enrolled students submitted
                  {totalScansCount > uniqueStudentsCount && (
                    <span className="text-muted-foreground/80 font-normal">
                      {" "}
                      ({totalScansCount} total{" "}
                      {totalScansCount === 1 ? "scan" : "scans"})
                    </span>
                  )}
                </span>
                {totalStudents > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[11px] font-semibold px-2 py-0.5 bg-muted/60 text-foreground"
                  >
                    {completionRate}% complete
                  </Badge>
                )}
              </div>

              {/* Progress bar capped accurately at 100% */}
              {totalStudents > 0 && (
                <div className="w-full sm:w-44 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-brand-600 dark:bg-brand-500 rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${completionRate}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Activity Actions Menu & Fast CTAs */}
          <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
            <Button
              size="sm"
              className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] bg-primary hover:bg-brand-700 text-primary-foreground font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl gap-1.5 shadow-xs cursor-pointer"
              onClick={() => openUpload({ activityId: id })}
            >
              <Upload className="w-4 h-4" />
              Upload Submission
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex size-10 sm:size-9 items-center justify-center rounded-lg sm:rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Activity actions"
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => setEditingActivity(activity)}
                  className="cursor-pointer gap-2 text-xs"
                >
                  <Edit3 className="size-3.5" />
                  <span>Edit Target Text</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(activity.target_text);
                    toast.success("Target prompt copied to clipboard.");
                  }}
                  className="cursor-pointer gap-2 text-xs"
                >
                  <Copy className="size-3.5" />
                  <span>Copy Target Prompt</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsDuplicateOpen(true)}
                  className="cursor-pointer gap-2 text-xs"
                >
                  <FileText className="size-3.5" />
                  <span>Duplicate Activity</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleToggleArchive}
                  className="cursor-pointer gap-2 text-xs"
                >
                  {isArchived ? (
                    <>
                      <ArchiveRestore className="size-3.5" />
                      <span>Unarchive Activity</span>
                    </>
                  ) : (
                    <>
                      <Archive className="size-3.5" />
                      <span>Archive Activity</span>
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeletingActivity(activity)}
                  className="cursor-pointer gap-2 text-xs text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete Activity</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Submissions Section */}
      <div className="space-y-4">
        {/* Section Header with Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-heading font-semibold text-foreground tracking-tight">
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
            <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/60 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setViewMode("grouped")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                  viewMode === "grouped"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={viewMode === "grouped"}
              >
                <GraduationCap className="size-3.5" />
                <span>By Student</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("all")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                  viewMode === "all"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={viewMode === "all"}
              >
                <Layers className="size-3.5" />
                <span>All Scans</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter & Search Bar — only when submissions exist */}
        {submissions && submissions.length > 0 && (
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-surface dark:bg-card p-3 rounded-xl sm:rounded-2xl border border-border shadow-warm">
            {/* Search Student Input with '/' shortcut hint */}
            <SearchInput
              ref={searchInputRef}
              placeholder="Search student name... (/)"
              aria-label="Search submissions by student name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              containerClassName="w-full xl:w-64 shrink-0"
            />

            {/* Filter Pills & Sort Selector */}
            <div className="relative min-w-0 flex-1 flex items-center justify-between xl:justify-end gap-2 w-full xl:w-auto">
              <FilterPills
                items={submissionFilterItems}
                value={statusFilter}
                onChange={(newFilter) => setStatusFilter(newFilter)}
                ariaLabel="Filter submissions by status"
                containerClassName="min-w-0 flex-1 xl:flex-initial xl:justify-end"
              />

              {/* Sort Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] sm:min-h-[32px] text-xs font-medium rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
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
                    className="cursor-pointer text-xs justify-between"
                  >
                    <span>Newest First</span>
                    {sortBy === "newest" && (
                      <span className="text-primary font-bold">✓</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("oldest")}
                    className="cursor-pointer text-xs justify-between"
                  >
                    <span>Oldest First</span>
                    {sortBy === "oldest" && (
                      <span className="text-primary font-bold">✓</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("name_asc")}
                    className="cursor-pointer text-xs justify-between"
                  >
                    <span>Student (A-Z)</span>
                    {sortBy === "name_asc" && (
                      <span className="text-primary font-bold">✓</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("name_desc")}
                    className="cursor-pointer text-xs justify-between"
                  >
                    <span>Student (Z-A)</span>
                    {sortBy === "name_desc" && (
                      <span className="text-primary font-bold">✓</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("score_desc")}
                    className="cursor-pointer text-xs justify-between"
                  >
                    <span>Highest Score</span>
                    {sortBy === "score_desc" && (
                      <span className="text-primary font-bold">✓</span>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
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
                Failed to load submissions: {submissionsError.message}
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
                  Upload Submission
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
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
          >
            {viewMode === "grouped"
              ? filteredAndSortedGroups.map((group) => (
                  <StudentSubmissionCard
                    key={group.studentId}
                    group={group}
                    onSelect={(sub) => setSelectedSubmission(sub)}
                    onReupload={(studentId) =>
                      openUpload({
                        activityId: id,
                        studentId: studentId,
                      })
                    }
                  />
                ))
              : filteredAndSortedSubmissions.map((submission) => (
                  <FlatSubmissionCard
                    key={submission.id}
                    submission={submission}
                    onSelect={() => setSelectedSubmission(submission)}
                    onReupload={() =>
                      openUpload({
                        activityId: id,
                        studentId: submission.student_id,
                      })
                    }
                  />
                ))}
          </div>
        )}
      </div>

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
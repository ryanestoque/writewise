"use client";

import { use, useState, useMemo, useRef, useCallback, useEffect, memo } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  GraduationCap,
  Camera,
  History,
  ChevronDown,
  Layers,
  HelpCircle,
  TrendingUp,
  Award,
  Check,
  BookOpen,
  ArrowRight,
  BarChart3,
  Sparkles,
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

interface ClassDiagnosticSummary {
  completedCount: number;
  avgCompositeScore: number;
  scoreBand: ScoreBandInfo;
  criteriaAverages: {
    letterFormation: number;
    sizeConsistency: number;
    spacing: number;
    slant: number;
    baselineAlignment: number;
  };
  strongestCriterion: { name: string; score: number } | null;
  focusCriterion: { name: string; score: number } | null;
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
  if (diffMs <= 0) return "Just now";
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

interface ScoreBandInfo {
  label: string;
  band: string;
  className: string;
  dotColor: string;
  icon: typeof CheckCircle2;
  description: string;
}

function getScoreBandLabel(score: number | null | undefined): ScoreBandInfo {
  if (score === null || score === undefined) {
    return {
      label: "Scored",
      band: "Scored",
      className: "bg-muted/50 text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
      icon: CheckCircle2,
      description: "Diagnostic assessment recorded.",
    };
  }
  if (score >= 80) {
    return {
      label: `${Math.round(score)}% • Excellent`,
      band: "Excellent",
      className:
        "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900",
      dotColor: "bg-emerald-500",
      icon: Award,
      description:
        "Consistent letter formation, steady slant, and precise baseline alignment.",
    };
  }
  if (score >= 60) {
    return {
      label: `${Math.round(score)}% • Satisfactory`,
      band: "Satisfactory",
      className:
        "bg-brand-50 text-brand-800 dark:bg-brand-950/80 dark:text-brand-300 border-brand-300/50 dark:border-brand-900",
      dotColor: "bg-band-3",
      icon: CheckCircle2,
      description:
        "Good penmanship foundation with minor variations in size or spacing.",
    };
  }
  if (score >= 40) {
    return {
      label: `${Math.round(score)}% • Developing`,
      band: "Developing",
      className:
        "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200/80 dark:border-amber-900",
      dotColor: "bg-amber-500",
      icon: TrendingUp,
      description:
        "Progress visible; focus on consistent slant angles and letter proportion.",
    };
  }
  return {
    label: `${Math.round(score)}% • Needs Impr.`,
    band: "Needs Improvement",
    className:
      "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200/80 dark:border-orange-900",
    dotColor: "bg-orange-500",
    icon: AlertCircle,
    description:
      "Struggling with line adherence or letter connections; review targeted practice.",
  };
}

const statusConfig = {
  processing: {
    label: "Processing",
    icon: Clock,
    className:
      "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    dotClass: "bg-amber-500 motion-safe:animate-pulse",
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

/**
 * Unified Submission Card Component
 * Accessible card with decoupled interactive regions
 */
const SubmissionCard = memo(function SubmissionCard({
  submission,
  studentName,
  attemptCount = 1,
  allSubmissions = [],
  onSelect,
  onReupload,
  onSelectAttempt,
}: {
  submission: Submission;
  studentName: string;
  attemptCount?: number;
  allSubmissions?: Submission[];
  onSelect: (sub: Submission) => void;
  onReupload: (studentId?: string) => void;
  onSelectAttempt?: (studentId: string, sub: Submission) => void;
}) {
  const { data: imageUrl } = useSubmissionImageUrl(submission.image_path);
  const [imageError, setImageError] = useState(false);
  const config = statusConfig[submission.status];
  const compositeScore = submission.measurement?.composite_score;
  const scoreBand = getScoreBandLabel(compositeScore);
  const rejection = getRejectionSummary(submission.rejection_code);
  const hasMultipleAttempts = attemptCount > 1 && allSubmissions.length > 1;
  const ScoreIcon = scoreBand.icon;

  const currentAttemptIndex = useMemo(() => {
    if (!hasMultipleAttempts) return 1;
    const idx = allSubmissions.findIndex((s) => s.id === submission.id);
    return idx >= 0 ? attemptCount - idx : attemptCount;
  }, [hasMultipleAttempts, allSubmissions, submission.id, attemptCount]);

  const accessibleLabel = useMemo(() => {
    let text = `View diagnostic details for ${studentName}. Status: ${config.label}.`;
    if (
      submission.status === "completed" &&
      compositeScore !== undefined &&
      compositeScore !== null
    ) {
      text += ` Diagnostic composite score: ${Math.round(compositeScore)} percent, rated ${scoreBand.band}.`;
    } else if (submission.status === "rejected") {
      text += ` Submission rejected: ${rejection.label}. ${rejection.detail}.`;
    }
    if (hasMultipleAttempts) {
      text += ` Attempt ${currentAttemptIndex} of ${attemptCount} total attempts.`;
    }
    return text;
  }, [
    studentName,
    config.label,
    submission.status,
    compositeScore,
    scoreBand.band,
    rejection,
    hasMultipleAttempts,
    currentAttemptIndex,
    attemptCount,
  ]);

  const showImage = Boolean(imageUrl && !imageError);

  return (
    <article className="group relative flex flex-col justify-between bg-surface dark:bg-card border border-border hover:border-brand-300 dark:hover:border-brand-800 rounded-xl sm:rounded-2xl shadow-warm hover:shadow-md transition-all duration-200 overflow-hidden text-left">
      {/* Photo Thumbnail & Clickable Hero */}
      <div className="aspect-4/3 bg-muted/60 relative overflow-hidden">
        {/* Main Photo Click Target */}
        <button
          type="button"
          onClick={() => onSelect(submission)}
          aria-label={accessibleLabel}
          className="absolute inset-0 size-full z-0 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl ?? ""}
              alt={`Worksheet by ${studentName}`}
              loading="lazy"
              decoding="async"
              onError={() => setImageError(true)}
              className="size-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
            />
          ) : (
            <div className="size-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground/60 p-4 pointer-events-none">
              <FileText className="size-8 stroke-[1.5]" />
              <span className="text-[11px] font-medium tracking-tight">
                Worksheet Preview
              </span>
            </div>
          )}
        </button>

        {/* Floating status pill */}
        <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
          <Badge
            variant="outline"
            className={`text-xs font-semibold px-2 py-0.5 shadow-xs backdrop-blur-xs ${config.className}`}
          >
            <span className={`size-1.5 rounded-full mr-1 ${config.dotClass}`} />
            {config.label}
          </Badge>
        </div>

        {/* Attempt history switcher if multiple attempts exist */}
        {hasMultipleAttempts && (
          <div className="absolute top-2.5 left-2.5 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="relative inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 min-h-[36px] sm:min-h-[28px] rounded-full bg-background/95 text-foreground dark:bg-card/95 border border-border shadow-xs backdrop-blur-xs hover:bg-background transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Switch submission attempt for ${studentName}. Currently showing attempt ${currentAttemptIndex} of ${attemptCount}.`}
              >
                <History className="size-3 text-muted-foreground" />
                <span>{attemptCount} Attempts</span>
                <ChevronDown className="size-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 z-50">
                <div className="text-xs text-muted-foreground font-medium px-2.5 py-1.5">
                  Submission History ({attemptCount} attempts)
                </div>
                <DropdownMenuSeparator />
                {allSubmissions.map((sub, idx) => {
                  const attemptNum = attemptCount - idx;
                  const isCurrent = sub.id === submission.id;
                  const isLatest = idx === 0;
                  const subConfig = statusConfig[sub.status];

                  return (
                    <DropdownMenuItem
                      key={sub.id}
                      onClick={() =>
                        onSelectAttempt?.(submission.student_id, sub)
                      }
                      className="cursor-pointer text-xs flex items-center justify-between gap-2 min-h-[36px]"
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
        {submission.uploader_role === "parent" && (
          <div className="absolute bottom-2.5 left-2.5 z-10 pointer-events-none">
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
      <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between relative z-10">
        <div>
          <button
            type="button"
            onClick={() => onSelect(submission)}
            className="text-left w-full group/title cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <p className="text-sm font-semibold text-foreground truncate group-hover/title:text-brand-700 dark:group-hover/title:text-brand-300 transition-colors">
              {studentName}
            </p>
          </button>

          {/* Diagnostic score or Rejection note */}
          {submission.status === "completed" && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <TooltipProvider delay={200}>
                <Tooltip>
                  <TooltipTrigger className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-md border shadow-2xs cursor-help">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        scoreBand.className,
                        "px-1.5 py-0.5 rounded"
                      )}
                    >
                      <ScoreIcon
                        className="size-3 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{scoreBand.label}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-xs">
                    <p className="font-semibold">
                      {scoreBand.band} Penmanship
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {scoreBand.description}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
              <Clock className="size-3 shrink-0 motion-safe:animate-pulse" />
              <span>Analyzing cursive strokes...</span>
            </p>
          )}
        </div>

        {/* Action / Inspection Row */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
          <span>{getRelativeTime(submission.created_at)}</span>

          {submission.status === "rejected" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReupload(submission.student_id)}
              aria-label={`Re-upload worksheet for ${studentName}`}
              className="h-8 min-h-[32px] px-2 text-xs font-semibold text-primary hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/50 rounded-lg gap-1 cursor-pointer"
            >
              <Camera className="size-3" />
              Re-upload
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelect(submission)}
              aria-label={`Inspect diagnostic report for ${studentName}`}
              className="h-8 min-h-[32px] px-2 text-xs font-medium text-primary hover:text-brand-700 dark:hover:text-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/50 rounded-lg gap-1 group/btn cursor-pointer"
            >
              <span>Inspect details</span>
              <ArrowRight className="size-3 transition-transform group-hover/btn:translate-x-0.5" />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
});

/**
 * Diagnostic Rubric Guide Popover
 * Scaffolding for teachers to understand WriteWise composite scoring
 */
function ScoringGuidePopover() {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-[36px] text-xs font-medium rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring shrink-0">
        <HelpCircle className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
        <span className="inline">Rubric Guide</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-4 z-50">
        <PopoverHeader>
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-brand-50 dark:bg-brand-950 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <HelpCircle className="size-4" />
            </div>
            <div>
              <PopoverTitle className="text-sm font-semibold text-foreground">
                Cursive Diagnostic Criteria
              </PopoverTitle>
              <PopoverDescription className="text-[11px]">
                Composite score (0–100%) weighted across 5 penmanship markers:
              </PopoverDescription>
            </div>
          </div>
        </PopoverHeader>

        <div className="space-y-2.5 text-xs pt-2 border-t border-border/60">
          <div className="flex items-start gap-2">
            <div className="size-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
            <div>
              <strong className="font-semibold text-foreground">
                1. Letter Formation:
              </strong>{" "}
              <span className="text-muted-foreground">
                Stroke & loop curvature fidelity evaluated by CNN.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="size-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
            <div>
              <strong className="font-semibold text-foreground">
                2. Size Consistency:
              </strong>{" "}
              <span className="text-muted-foreground">
                Ascenders, descenders, and x-height proportion uniformity.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="size-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
            <div>
              <strong className="font-semibold text-foreground">
                3. Spacing:
              </strong>{" "}
              <span className="text-muted-foreground">
                Inter-character and word-boundary rhythm.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="size-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
            <div>
              <strong className="font-semibold text-foreground">
                4. Slant Consistency:
              </strong>{" "}
              <span className="text-muted-foreground">
                Angular deviation from target forward inclination.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="size-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
            <div>
              <strong className="font-semibold text-foreground">
                5. Baseline Alignment:
              </strong>{" "}
              <span className="text-muted-foreground">
                Adherence to primary bottom guideline across all words.
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-border/60 grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
            <span>&ge; 80% &middot; Excellent</span>
          </div>
          <div className="flex items-center gap-1.5 text-brand-800 dark:text-brand-300">
            <span className="size-2 rounded-full bg-band-3 shrink-0" />
            <span>60–79% &middot; Satisfactory</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
            <span className="size-2 rounded-full bg-amber-500 shrink-0" />
            <span>40–59% &middot; Developing</span>
          </div>
          <div className="flex items-center gap-1.5 text-orange-800 dark:text-orange-300">
            <span className="size-2 rounded-full bg-orange-500 shrink-0" />
            <span>&lt; 40% &middot; Needs Impr.</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
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

  // Group attempt selection map (key: studentId, value: Submission)
  const [attemptOverrides, setAttemptOverrides] = useState<
    Map<string, Submission>
  >(new Map());

  // Shortcut key listener for '/' and 'U'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName;
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(targetTag);
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
    const completed = submissions.filter(
      (s) =>
        s.status === "completed" && s.measurement?.composite_score != null
    );
    if (completed.length === 0) return null;

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

    for (const sub of completed) {
      const m = sub.measurement;
      if (!m) continue;
      if (m.composite_score != null) totalComposite += m.composite_score;
      if (m.letter_formation_score != null) {
        totalFormation += m.letter_formation_score;
        formationCount++;
      }
      if (m.size_consistency_score != null) {
        totalSize += m.size_consistency_score;
        sizeCount++;
      }
      if (m.spacing_score != null) {
        totalSpacing += m.spacing_score;
        spacingCount++;
      }
      if (m.slant_score != null) {
        totalSlant += m.slant_score;
        slantCount++;
      }
      if (m.baseline_alignment_score != null) {
        totalBaseline += m.baseline_alignment_score;
        baselineCount++;
      }
    }

    const avgComposite = Math.round(totalComposite / completed.length);
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
      completedCount: completed.length,
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
          a.latestSubmission.measurement?.composite_score ?? -1;
        const scoreB =
          b.latestSubmission.measurement?.composite_score ?? -1;
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
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
    <div className="w-full space-y-5 sm:space-y-6 pb-28 sm:pb-24 px-1 sm:px-0">
      {/* Top Back Navigation Trail */}
      <div>
        <Link
          href="/activities"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 py-0.5"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Activities</span>
        </Link>
      </div>

      {/* Streamlined Activity Hero Card with Authentic 3-Line Cursive Ruling */}
      <section
        aria-labelledby="activity-prompt-heading"
        className={cn(
          "relative bg-surface dark:bg-card border rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-warm transition-all overflow-hidden",
          isArchived
            ? "border-muted-foreground/30 bg-muted/20 opacity-95"
            : "border-border"
        )}
      >
        {/* Screen Reader Semantic Heading */}
        <h1 id="activity-prompt-heading" className="sr-only">
          Activity: {activity.target_text}
        </h1>

        {/* Archived Top Warning Banner if Archived */}
        {isArchived && (
          <div className="mb-4 -mt-1 -mx-1 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
            <Archive className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              This activity is archived and hidden from student assignment
              pickers.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {/* Top Row: Context Badges + Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Badges & Metadata */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              {isArchived ? (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-0.5 bg-muted/60 text-muted-foreground border-border/80"
                >
                  <Archive className="w-3.5 h-3.5 mr-1" />
                  Archived
                </Badge>
              ) : activity.is_take_home ? (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-200/80 dark:border-brand-900"
                >
                  <Home className="w-3.5 h-3.5 mr-1 text-brand-600 dark:text-brand-400" />
                  Take-home Activity
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-0.5 bg-emerald-50/70 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-900/60"
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                  In-Class Activity
                </Badge>
              )}

              <span className="inline-flex items-center text-[11px] font-medium text-muted-foreground bg-muted/40 dark:bg-muted/30 px-2 py-0.5 rounded-md border border-border/50 tabular-nums">
                {wordCount} {wordCount === 1 ? "word" : "words"}
              </span>

              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" />
                Created {formatDate(activity.created_at)}
              </span>
            </div>

            {/* Fast Action CTAs */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <Button
                size="sm"
                aria-keyshortcuts="u"
                variant={
                  submissions && submissions.length === 0
                    ? "outline"
                    : "default"
                }
                className={cn(
                  "h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl gap-1.5 shadow-xs cursor-pointer",
                  submissions && submissions.length === 0
                    ? "text-muted-foreground hover:text-foreground border-border hover:bg-muted/60"
                    : "bg-primary hover:bg-brand-700 text-primary-foreground"
                )}
                onClick={() => openUpload({ activityId: id })}
              >
                <Upload className="w-4 h-4" />
                <span>Upload Submission</span>
                <kbd
                  className={cn(
                    "hidden sm:inline-flex items-center justify-center ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded shadow-2xs",
                    submissions && submissions.length === 0
                      ? "bg-muted text-muted-foreground"
                      : "text-primary-foreground/80 bg-white/20 dark:bg-white/10"
                  )}
                >
                  U
                </kbd>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex size-10 sm:size-9 min-h-[40px] sm:min-h-[36px] items-center justify-center rounded-lg sm:rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Activity options and actions"
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

          {/* Hero Penmanship Prompt on Authentic 3-Line Cursive Ruling */}
          <div className="space-y-1.5">
            <div className="relative p-4 sm:p-6 pb-6 sm:pb-8 min-h-[92px] rounded-xl bg-linear-to-b from-brand-50/25 via-surface to-brand-50/10 dark:from-card dark:to-card/80 border border-brand-200/50 dark:border-border/60 overflow-hidden shadow-2xs">
              <div className="relative">
                {/* Decorative 3-line penmanship ruling */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20 cursive-guidelines overflow-hidden"
                  aria-hidden="true"
                />
                <p className="relative font-cursive text-foreground/90 font-normal tracking-wide select-all break-words text-[30px] sm:text-[36px] leading-[48px]">
                  {activity.target_text}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Aggregate Bar: Class Roster Progress + Diagnostic Synthesis */}
          <div className="pt-3 border-t border-border/50 grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Left: Class Roster Completion */}
            <div className="flex flex-col justify-center gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 flex-wrap">
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
                </div>
                {totalStudents > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[11px] font-semibold px-2 py-0.5 bg-muted/60 text-foreground shrink-0"
                  >
                    {completionRate}% complete
                  </Badge>
                )}
              </div>

              {/* Progress bar */}
              {totalStudents > 0 && (
                <div
                  className="w-full h-2 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={completionRate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Class completion rate: ${completionRate}%`}
                >
                  <div
                    className="h-full bg-brand-600 dark:bg-brand-500 rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${completionRate}%`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Right: Class Diagnostic Synthesis (when completed scans exist) */}
            {classDiagnostics ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-2.5 bg-muted/25 dark:bg-muted/15 p-2.5 rounded-xl border border-border/60 text-xs">
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-brand-600 dark:text-brand-400 shrink-0" />
                  <div>
                    <span className="text-[11px] text-muted-foreground font-medium block">
                      Class Performance ({classDiagnostics.completedCount}{" "}
                      scored)
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-semibold px-2 py-0.5",
                          classDiagnostics.scoreBand.className
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full mr-1",
                            classDiagnostics.scoreBand.dotColor
                          )}
                        />
                        <span>{classDiagnostics.scoreBand.label}</span>
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Popover>
                    <PopoverTrigger className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer">
                      <Sparkles className="size-3 text-brand-600 dark:text-brand-400" />
                      <span>Class Breakdown</span>
                      <ChevronDown className="size-2.5 opacity-60" />
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="w-72 p-3.5 space-y-3 z-50 text-xs"
                    >
                      <PopoverHeader>
                        <PopoverTitle className="text-xs font-semibold text-foreground flex items-center justify-between">
                          <span>5-Criterion Class Average</span>
                          <span className="text-primary font-bold tabular-nums">
                            {classDiagnostics.avgCompositeScore}%
                          </span>
                        </PopoverTitle>
                      </PopoverHeader>

                      <div className="space-y-2 pt-1">
                        <div>
                          <div className="flex justify-between text-[11px] mb-0.5 text-muted-foreground">
                            <span>Letter Formation</span>
                            <span className="font-medium tabular-nums text-foreground">
                              {
                                classDiagnostics.criteriaAverages
                                  .letterFormation
                              }
                              %
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full"
                              style={{
                                width: `${classDiagnostics.criteriaAverages.letterFormation}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-0.5 text-muted-foreground">
                            <span>Size Consistency</span>
                            <span className="font-medium tabular-nums text-foreground">
                              {
                                classDiagnostics.criteriaAverages
                                  .sizeConsistency
                              }
                              %
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full"
                              style={{
                                width: `${classDiagnostics.criteriaAverages.sizeConsistency}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-0.5 text-muted-foreground">
                            <span>Spacing</span>
                            <span className="font-medium tabular-nums text-foreground">
                              {classDiagnostics.criteriaAverages.spacing}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full"
                              style={{
                                width: `${classDiagnostics.criteriaAverages.spacing}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-0.5 text-muted-foreground">
                            <span>Slant Consistency</span>
                            <span className="font-medium tabular-nums text-foreground">
                              {classDiagnostics.criteriaAverages.slant}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full"
                              style={{
                                width: `${classDiagnostics.criteriaAverages.slant}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-0.5 text-muted-foreground">
                            <span>Baseline Alignment</span>
                            <span className="font-medium tabular-nums text-foreground">
                              {
                                classDiagnostics.criteriaAverages
                                  .baselineAlignment
                              }
                              %
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full"
                              style={{
                                width: `${classDiagnostics.criteriaAverages.baselineAlignment}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {classDiagnostics.strongestCriterion && (
                        <div className="pt-2 border-t border-border/60 text-[11px] space-y-1 text-muted-foreground">
                          <p>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                              Strength:
                            </span>{" "}
                            {classDiagnostics.strongestCriterion.name} (
                            {classDiagnostics.strongestCriterion.score}%)
                          </p>
                          {classDiagnostics.focusCriterion && (
                            <p>
                              <span className="font-semibold text-amber-700 dark:text-amber-400">
                                Practice Focus:
                              </span>{" "}
                              {classDiagnostics.focusCriterion.name} (
                              {classDiagnostics.focusCriterion.score}%)
                            </p>
                          )}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-border/80 text-xs text-muted-foreground bg-muted/10">
                <BarChart3 className="size-4 text-muted-foreground/60 shrink-0" />
                <span>
                  Class diagnostic insights will unlock as student worksheets
                  are scored.
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface dark:bg-card p-3 rounded-xl sm:rounded-2xl border border-border shadow-warm">
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
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
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
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
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
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type Submission,
  useSubmissionImageUrl,
  useSubmissions,
} from "@/lib/hooks/use-submissions";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { GuideLineOverlay, type GuideLines } from "@/components/shared/guide-line-overlay";
import {
  DiagnosticOverlay,
  OverlayToolbar,
  DiagnosticFallbackBanner,
  extractDiagnosticOverlay,
  getAttentionItems,
  type CriterionFilter,
  type DiagnosticOverlayData,
  type ActiveAnnotationHover,
} from "@/components/shared/diagnostic-overlay";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Award,
  SlidersHorizontal,
  ShieldCheck,
  Edit3,
  Trash2,
  Loader2,
  MoreHorizontal,
  MessageSquare,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useDeleteSubmission } from "@/lib/hooks/use-submissions";
import {
  ManualRubricEntryForm,
  calculateCompositeRubric,
  RUBRIC_CRITERIA,
  getBandMeta,
  CRITERIA_GUIDE,
  extractCriterionCVMetric,
} from "./manual-rubric-entry-form";
import { SubmissionRejectionCard } from "./submission-rejection-card";
import { RawMeasurementsTable } from "./raw-measurements-table";
import { getScoreBandLabel } from "@/lib/utils/submission-status";
import { useScoringEngine } from "@/lib/hooks/use-scoring-engine";
import {
  SubmissionLifecycleControls,
  SubmissionReturnedAlert,
} from "./submission-lifecycle-controls";
import { useCommentAccountId, useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import { SubmissionCommentThread } from "@/components/comments/submission-comment-thread";

const GUIDE_LINES_STORAGE_KEY = "writewise.inspector.showGuideLines";
const ACTIVE_TAB_STORAGE_KEY = "writewise.rubric.activeTab";

function readStoredGuideLines(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GUIDE_LINES_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function readStoredAssessmentTab(): "rubric" | "metrics" {
  if (typeof window === "undefined") return "rubric";
  try {
    return window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) === "metrics"
      ? "metrics"
      : "rubric";
  } catch {
    return "rubric";
  }
}



export function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const CRITERION_NAME_TO_FILTER: Record<string, CriterionFilter> = {
  "Letter Formation": "letter_formation",
  "Spacing": "spacing",
  "Size Consistency": "size_consistency",
  "Slant": "slant",
  "Slant Angle": "slant",
  "Baseline Alignment": "baseline_alignment",
};

export const CRITERION_FILTER_TO_NAME: Record<CriterionFilter, string | null> = {
  all: null,
  letter_formation: "Letter Formation",
  spacing: "Spacing",
  size_consistency: "Size Consistency",
  slant: "Slant Angle",
  baseline_alignment: "Baseline Alignment",
};

export interface SubmissionDetailContentProps {
  submission: Submission;
  submissions?: Submission[];
  currentIndex?: number;
  onNavigate?: (submission: Submission) => void;
  activityTargetText?: string;
  /** Called when the user triggers "close" — modal sets open=false, page navigates back */
  onClose?: () => void;
  /** Render mode affects layout: 'page' enables sticky image, 'modal' keeps dialog scroll container */
  variant: "page" | "modal";
  open?: boolean;
  initialView?: "details" | "comments";
}

export function SubmissionDetailContent({
  submission: initialSubmission,
  submissions,
  currentIndex,
  onNavigate,
  activityTargetText,
  onClose,
  variant,
  open = true,
  initialView = "details",
}: SubmissionDetailContentProps) {
  const { data: currentSubmissions } = useSubmissions(initialSubmission.activity_id);
  const submission = currentSubmissions?.find((row) => row.id === initialSubmission.id) ?? initialSubmission;
  const { openUpload } = useTeacherModals();
  const scoringEngine = useScoringEngine();
  const canEditRubric =
    scoringEngine.isSuccess &&
    !scoringEngine.isFetching &&
    scoringEngine.data === "manual" && submission.status === "completed";
  const [isScrolledPastInspector, setIsScrolledPastInspector] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const worksheetColumnRef = useRef<HTMLDivElement>(null);

  const [selectedCriterion, setSelectedCriterion] = useState<string | null>(
    "Letter Formation"
  );
  const [activeCriterionOverride, setActiveCriterionOverride] =
    useState<{ submissionId: string; criterion: CriterionFilter } | null>(null);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [rightPaneTab, setRightPaneTabState] = useState<"rubric" | "metrics" | "comments">(() =>
    initialView === "comments" ? "comments" : readStoredAssessmentTab()
  );
  const [isEditingRubric, setIsEditingRubric] = useState(false);
  const [isRubricDirty, setIsRubricDirty] = useState(false);
  const [pendingNavTarget, setPendingNavTarget] = useState<Submission | null>(null);
  const [showGuideLines, setShowGuideLinesState] = useState<boolean>(() =>
    readStoredGuideLines()
  );
  const [criterionAnnouncement, setCriterionAnnouncement] = useState<string>("");
  const editButtonRef = useRef<HTMLButtonElement>(null);

  const commentUserId = useCommentAccountId();
  const unreadComments = useUnreadCommentThreads(
    commentUserId ?? "",
    open && Boolean(submission.id) && Boolean(commentUserId)
  );
  const hasUnreadComments = Boolean(unreadComments.data?.has(submission.id));

  const setRightPaneTab = useCallback((tab: "rubric" | "metrics" | "comments") => {
    setRightPaneTabState(tab);
    if (tab === "rubric" || tab === "metrics") {
      try {
        window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const toggleGuideLines = useCallback(() => {
    setShowGuideLinesState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(GUIDE_LINES_STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const requestNavigate = useCallback(
    (target: Submission) => {
      if (!onNavigate) return;
      if (isRubricDirty) {
        setPendingNavTarget(target);
        return;
      }
      onNavigate(target);
    },
    [onNavigate, isRubricDirty]
  );

  const handleCancelEditingRubric = useCallback(() => {
    setIsEditingRubric(false);
    setIsRubricDirty(false);
    setTimeout(() => {
      editButtonRef.current?.focus();
    }, 50);
  }, []);

  const handleSuccessEditingRubric = useCallback(() => {
    setIsEditingRubric(false);
    setIsRubricDirty(false);
    setTimeout(() => {
      editButtonRef.current?.focus();
    }, 50);
  }, []);

  const recordedComposite = useMemo(() => {
    return calculateCompositeRubric(submission.manual_score);
  }, [submission.manual_score]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const scrollTop = scrollContainerRef.current.scrollTop;
    setIsScrolledPastInspector(scrollTop > 140);
  }, []);

  // Track window scroll on mobile page view so teachers get a sticky worksheet preview bar
  useEffect(() => {
    if (variant !== "page") return;
    const handleWindowScroll = () => {
      const el = worksheetColumnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setIsScrolledPastInspector(rect.bottom < 72);
    };
    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    handleWindowScroll();
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [variant]);

  const {
    data: imageUrl,
    isLoading: isImageLoading,
    isError: isImageError,
    refetch: refetchImage,
  } = useSubmissionImageUrl(submission.image_path ?? null);

  // Resolve current submission index with robust fallback to array matching
  const effectiveIndex = useMemo(() => {
    if (currentIndex !== undefined && currentIndex >= 0) {
      return currentIndex;
    }
    if (submissions && submission) {
      const idx = submissions.findIndex((s) => s.id === submission.id);
      if (idx >= 0) return idx;
      const studentIdx = submissions.findIndex(
        (s) => s.student_id && s.student_id === submission.student_id
      );
      if (studentIdx >= 0) return studentIdx;
    }
    return 0;
  }, [currentIndex, submissions, submission]);

  const hasMultipleSubmissions = Boolean(
    submissions && submissions.length > 1
  );
  const canGoPrev = hasMultipleSubmissions && effectiveIndex > 0;
  const canGoNext =
    hasMultipleSubmissions && effectiveIndex < (submissions?.length ?? 0) - 1;

  const prevButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  // Preserve focus when navigation button becomes disabled at boundary
  useEffect(() => {
    if (!canGoPrev && document.activeElement === prevButtonRef.current) {
      nextButtonRef.current?.focus();
    } else if (!canGoNext && document.activeElement === nextButtonRef.current) {
      prevButtonRef.current?.focus();
    }
  }, [canGoPrev, canGoNext]);

  // Keyboard navigation for submission cycling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isPrev =
        e.key === "ArrowLeft" ||
        e.key === "Left" ||
        e.key === "j" ||
        e.key === "J";
      const isNext =
        e.key === "ArrowRight" ||
        e.key === "Right" ||
        e.key === "k" ||
        e.key === "K";

      if (!isPrev && !isNext) return;

      if (e.defaultPrevented) return;

      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable ||
        target?.getAttribute?.("role") === "radio" ||
        target?.closest?.('fieldset[role="radiogroup"]') ||
        target?.getAttribute?.("role") === "tab" ||
        target?.closest?.('[role="tablist"]') ||
        target?.closest?.('[data-radix-focus-guard]') ||
        target?.closest?.('[data-inspector-container="true"][data-zoomed="true"]')
      ) {
        return;
      }

      // Submission cycling (guarded when rubric has unsaved changes)
      if (isPrev) {
        if (canGoPrev && submissions && onNavigate) {
          e.preventDefault();
          e.stopPropagation();
          requestNavigate(submissions[effectiveIndex - 1]);
        }
      } else if (isNext) {
        if (canGoNext && submissions && onNavigate) {
          e.preventDefault();
          e.stopPropagation();
          requestNavigate(submissions[effectiveIndex + 1]);
        }
      }
    };

    // Use capture phase so Base UI's internal composite-key stopPropagation does not swallow arrow keys
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [submissions, effectiveIndex, canGoPrev, canGoNext, onNavigate, requestNavigate]);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const deleteMutation = useDeleteSubmission();

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(submission.id);
      toast.success("Attempt deleted");
      setIsDeleteDialogOpen(false);

      if (submissions && submissions.length > 1 && onNavigate) {
        const remaining = submissions.filter((s) => s.id !== submission.id);
        if (remaining.length > 0) {
          const nextTarget = remaining[Math.min(effectiveIndex, remaining.length - 1)];
          onNavigate(nextTarget);
          return;
        }
      }

      if (onClose) {
        onClose();
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete submission";
      toast.error(errorMsg);
    }
  };

  const measurement = submission.measurement;
  const compositeScore = measurement?.composite_score;
  const compositeBand = getScoreBandLabel(compositeScore);

  const hasCalibratedScores = Boolean(
    measurement &&
    (measurement.composite_score !== null ||
      measurement.letter_formation_score !== null ||
      measurement.size_consistency_score !== null ||
      measurement.spacing_score !== null ||
      measurement.slant_score !== null ||
      measurement.baseline_alignment_score !== null)
  );

  const isUuid = (text?: string | null): boolean =>
    Boolean(
      text &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        text.trim()
      )
    );

  // Extract guide-line coordinates from the CV pipeline's raw_output (CV_PIPELINE §4)
  const guideLines = useMemo((): GuideLines | null => {
    const raw = submission.measurement?.raw_output;
    if (!raw || typeof raw !== "object") return null;
    const gl = (raw as Record<string, unknown>).guide_lines;
    if (!gl || typeof gl !== "object") return null;
    const typed = gl as Record<string, unknown>;
    if (
      !Array.isArray(typed.baseline_y) ||
      !Array.isArray(typed.midline_y) ||
      !Array.isArray(typed.topline_y)
    ) return null;
    return gl as GuideLines;
  }, [submission.measurement?.raw_output]);

  // Extract active line bounds from raw_output words for fallback guideline overlay
  const fallbackLineBounds = useMemo(() => {
    const raw = submission.measurement?.raw_output;
    if (!raw || typeof raw !== "object") return undefined;
    const lines = (raw as Record<string, unknown>).lines;
    if (!Array.isArray(lines)) return undefined;
    const bounds: Record<number, { minX: number; maxX: number }> = {};
    for (const line of lines) {
      if (!line || typeof line !== "object") continue;
      const lIdx = (line as Record<string, unknown>).line_index;
      const words = (line as Record<string, unknown>).words;
      if (typeof lIdx !== "number" || !Array.isArray(words) || words.length === 0) continue;
      let minX = Infinity;
      let maxX = -Infinity;
      for (const w of words) {
        if (!w || typeof w !== "object") continue;
        const bbox = (w as Record<string, unknown>).bbox;
        if (!Array.isArray(bbox) || bbox.length < 4) continue;
        const [x, , width] = bbox as number[];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + width);
      }
      if (minX !== Infinity && maxX !== -Infinity) {
        bounds[lIdx] = { minX, maxX };
      }
    }
    return Object.keys(bounds).length > 0 ? bounds : undefined;
  }, [submission.measurement?.raw_output]);

  // Extract diagnostic overlay data (DATABASE §8, DESIGN §7.4)
  const diagnosticOverlay = useMemo((): DiagnosticOverlayData | null => {
    return extractDiagnosticOverlay(submission.measurement);
  }, [submission.measurement]);

  // Smart default: Automatically spotlight the student's weakest criterion to avoid visual noise
  const activeOverlayCriterion: CriterionFilter = useMemo(() => {
    if (activeCriterionOverride && activeCriterionOverride.submissionId === submission.id) {
      return activeCriterionOverride.criterion;
    }
    const weakest = diagnosticOverlay?.summary?.weakest_criterion as CriterionFilter | undefined;
    if (weakest && weakest in CRITERION_FILTER_TO_NAME) {
      return weakest;
    }
    return "all";
  }, [activeCriterionOverride, submission.id, diagnosticOverlay?.summary?.weakest_criterion]);

  const [selectedAttentionItem, setSelectedAttentionItem] =
    useState<ActiveAnnotationHover | null>(null);

  const setActiveOverlayCriterion = useCallback(
    (criterion: CriterionFilter) => {
      setSelectedAttentionItem(null);
      setActiveCriterionOverride({ submissionId: submission.id, criterion });
    },
    [submission.id]
  );

  // Attention alert counts for embedding in rubric and criterion lists
  const criterionAttentionCounts = useMemo<Record<string, number>>(() => {
    const emptyCounts: Record<string, number> = {};
    if (!diagnosticOverlay) return emptyCounts;
    return {
      "Letter Formation":
        diagnosticOverlay.letter_formation?.annotations?.filter(
          (a) => a.severity === "needs_attention"
        ).length ?? 0,
      "Spacing":
        diagnosticOverlay.spacing?.annotations?.filter(
          (a) => a.severity === "needs_attention"
        ).length ?? 0,
      "Slant Angle":
        diagnosticOverlay.slant?.annotations?.filter(
          (a) => a.severity === "needs_attention"
        ).length ?? 0,
      "Slant":
        diagnosticOverlay.slant?.annotations?.filter(
          (a) => a.severity === "needs_attention"
        ).length ?? 0,
      "Baseline Alignment":
        diagnosticOverlay.baseline?.annotations?.filter(
          (a) => a.severity === "needs_attention"
        ).length ?? 0,
      "Size Consistency":
        diagnosticOverlay.size?.annotations?.filter(
          (a) => a.severity === "needs_attention"
        ).length ?? 0,
    };
  }, [diagnosticOverlay]);

  const resolvedTargetText = useMemo(() => {
    if (activityTargetText && !isUuid(activityTargetText)) {
      return activityTargetText.trim();
    }
    if (
      submission.activity?.target_text &&
      !isUuid(submission.activity.target_text)
    ) {
      return submission.activity.target_text.trim();
    }
    return null;
  }, [activityTargetText, submission.activity?.target_text]);

  const detectedText = useMemo(() => {
    const raw = submission.measurement?.raw_output as Record<string, unknown> | undefined;
    return typeof raw?.detected_text === "string" ? raw.detected_text : null;
  }, [submission.measurement?.raw_output]);


  const casingMismatches = useMemo(() => {
    const raw = submission.measurement?.raw_output as Record<string, unknown> | undefined;
    if (Array.isArray(raw?.casing_mismatches) && raw.casing_mismatches.length > 0) {
      return raw.casing_mismatches as Array<{ expected: string; detected: string; note?: string }>;
    }
    if (resolvedTargetText && detectedText && resolvedTargetText !== detectedText) {
      const tgtWords = resolvedTargetText.trim().split(/\s+/);
      const detWords = detectedText.trim().split(/\s+/);
      const mismatches: Array<{ expected: string; detected: string; note?: string }> = [];
      const minLen = Math.min(tgtWords.length, detWords.length);
      for (let i = 0; i < minLen; i++) {
        const tw = tgtWords[i];
        const dw = detWords[i];
        if (tw !== dw && tw.toLowerCase() === dw.toLowerCase()) {
          mismatches.push({ expected: tw, detected: dw });
        } else if (
          tw.length > 0 &&
          dw.length > 0 &&
          tw[0] === tw[0].toUpperCase() &&
          tw[0] !== tw[0].toLowerCase() &&
          dw[0] === dw[0].toLowerCase() &&
          tw[0].toLowerCase() === dw[0].toLowerCase()
        ) {
          mismatches.push({ expected: tw, detected: dw });
        }
      }
      return mismatches;
    }
    return [];
  }, [submission.measurement?.raw_output, resolvedTargetText, detectedText]);

  // Memoize criteria lists to prevent re-computation on every render
  const criteria = useMemo(() => {
    if (submission.status === "rejected") return [];
    return [
      {
        name: "Letter Formation",
        score: measurement?.letter_formation_score,
        description: "Proper cursive loop closures and proportion",
      },
      {
        name: "Size Consistency",
        score: measurement?.size_consistency_score,
        description: "Uniform letter height within 3-line ruling",
      },
      {
        name: "Spacing",
        score: measurement?.spacing_score,
        description: "Consistent word and inter-letter spacing",
      },
      {
        name: "Slant Angle",
        score: measurement?.slant_score,
        description: "Consistent forward cursive slant angle",
      },
      {
        name: "Baseline Alignment",
        score: measurement?.baseline_alignment_score,
        description: "Stable letter resting along the ruled baseline",
      },
    ];
  }, [measurement, submission.status]);

  const handleReupload = () => {
    if (variant === "modal") {
      onClose?.();
    }
    openUpload({
      activityId: submission.activity_id,
      studentId: submission.student_id,
    });
  };

  const activeCriterionInfo = selectedCriterion
    ? CRITERIA_GUIDE[selectedCriterion]
    : null;

  const isDesktopGuideRendered = Boolean(
    rightPaneTab !== "comments" &&
    selectedCriterion &&
    activeCriterionInfo &&
    (hasCalibratedScores ||
      rightPaneTab === "metrics" ||
      (rightPaneTab === "rubric" &&
        submission.manual_score &&
        (!isEditingRubric || !canEditRubric)))
  );

  // Reusable actions toolbar (student navigation pager + overflow menu for destructive action)
  const actionsContent = (
    <div className="flex items-center gap-2 shrink-0">
      {hasMultipleSubmissions && submissions && onNavigate && (
        <div className="flex items-center gap-0.5 sm:gap-1 bg-muted/50 p-0.5 sm:p-1 rounded-xl border border-border h-10 sm:h-9 shrink-0">
          <Button
            ref={prevButtonRef}
            variant="ghost"
            size="sm"
            disabled={!canGoPrev}
            onClick={() => {
              if (canGoPrev && submissions) {
                requestNavigate(submissions[effectiveIndex - 1]);
              }
            }}
            className="size-9 sm:size-7 min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer flex items-center justify-center touch-manipulation"
            aria-label="Previous student (Key: J or ←)"
            title="Previous student (← / J)"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span
            className="text-[11px] sm:text-xs text-muted-foreground px-1 sm:px-1.5 tabular-nums font-medium select-none whitespace-nowrap"
            aria-live="polite"
            aria-atomic="true"
          >
            {effectiveIndex + 1} of {submissions.length}
          </span>
          <Button
            ref={nextButtonRef}
            variant="ghost"
            size="sm"
            disabled={!canGoNext}
            onClick={() => {
              if (canGoNext && submissions) {
                requestNavigate(submissions[effectiveIndex + 1]);
              }
            }}
            className="size-9 sm:size-7 min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer flex items-center justify-center touch-manipulation"
            aria-label="Next student (Key: K or →)"
            title="Next student (→ / K)"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deleteMutation.isPending}
              className="size-10 sm:size-9 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 p-0 rounded-xl border-border/70 text-muted-foreground hover:text-foreground cursor-pointer touch-manipulation shrink-0"
              aria-label="More submission actions"
              title="More submission actions"
            />
          }
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44 rounded-xl p-1">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="rounded-lg px-2.5 py-2 text-xs gap-2 cursor-pointer"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span>Delete Attempt</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // Render header content based on variant and viewport tier
  const headerContent = (
    <div className="w-full flex flex-col gap-2.5 sm:gap-3">
      {/* Main Student Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 w-full">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">

          {/* Student Name and Upload Metadata */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {variant === "modal" ? (
                <DialogTitle className="font-heading text-base sm:text-xl font-semibold tracking-tight text-foreground truncate">
                  {submission.student?.full_name ?? "Student"}
                </DialogTitle>
              ) : (
                <h1 className="font-heading text-base sm:text-xl md:text-2xl font-bold tracking-tight text-foreground truncate">
                  {submission.student?.full_name ?? "Student"}
                </h1>
              )}
              <SubmissionLifecycleControls submission={submission} variant="header" />
            </div>
            {variant === "modal" ? (
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-x-2 sm:gap-x-3 gap-y-0.5 flex-wrap">
                <span className="inline-flex items-center gap-1 shrink-0">
                  <User className="size-3" aria-hidden="true" />
                  Uploaded by{" "}
                  {submission.uploader_role === "parent" ? "Parent" : "Teacher"}
                </span>
                <span className="text-border hidden min-[400px]:inline">·</span>
                <span className="inline-flex items-center gap-1 shrink-0">
                  <Clock className="size-3" aria-hidden="true" />
                  <time
                    dateTime={submission.created_at}
                    title={formatDateFull(submission.created_at)}
                    className="tabular-nums"
                  >
                    {formatDateFull(submission.created_at)}
                  </time>
                </span>
              </DialogDescription>
            ) : (
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-x-2 sm:gap-x-3 gap-y-0.5 flex-wrap">
                <span className="inline-flex items-center gap-1 shrink-0">
                  <User className="size-3" aria-hidden="true" />
                  Uploaded by{" "}
                  {submission.uploader_role === "parent" ? "Parent" : "Teacher"}
                </span>
                <span className="text-border hidden min-[400px]:inline">·</span>
                <span className="inline-flex items-center gap-1 shrink-0">
                  <Clock className="size-3" aria-hidden="true" />
                  <time
                    dateTime={submission.created_at}
                    title={formatDateFull(submission.created_at)}
                    className="tabular-nums"
                  >
                    {formatDateFull(submission.created_at)}
                  </time>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="shrink-0 flex items-center self-end sm:self-auto">
          {actionsContent}
        </div>
      </div>
    </div>
  );

  return (
    <div
      data-rubric-editing={isEditingRubric ? "true" : undefined}
      className={cn("w-full flex flex-col gap-0", variant === "modal" ? "flex-1 min-h-0" : "")}
    >
      {/* Screen reader live announcement region for criterion selection */}
      <div className="sr-only" role="status" aria-live="polite">
        {criterionAnnouncement}
      </div>

      {/* Header */}
      {variant === "modal" ? (
        <DialogHeader className="pb-2.5 sm:pb-3 border-b border-border/70 shrink-0 text-left">
          {headerContent}
        </DialogHeader>
      ) : (
        <header className="pb-2.5 sm:pb-3 border-b border-border/70">
          {headerContent}
        </header>
      )}

      {/* Body: Split view (Image + Diagnostic details & Comments) */}
      <div
        ref={variant === "modal" ? scrollContainerRef : undefined}
        onScroll={variant === "modal" ? handleScroll : undefined}
        className={cn(
          "space-y-3 sm:space-y-3.5",
          variant === "modal"
            ? "flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain py-2.5 sm:py-3"
            : "py-2.5 sm:py-3.5"
        )}
      >
        {/* Returned Worksheet Alert Banner (only visible when attempt is returned) */}
        <SubmissionReturnedAlert submission={submission} />

        {/* Mobile Sticky Preview Bar (< lg screens, both modal and page views) */}
        {isScrolledPastInspector && (
          <div
            className={cn(
              "lg:hidden sticky z-20 px-3 sm:px-4 py-2 bg-surface/95 dark:bg-card/95 backdrop-blur-md border border-border/80 flex items-center justify-between gap-2 shadow-warm-sm animate-in fade-in slide-in-from-top-2 duration-150 motion-reduce:animate-none",
              variant === "modal"
                ? "-top-3 -mx-4 sm:-mx-6 rounded-none border-x-0 border-t-0"
                : "top-14 rounded-xl"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-7 rounded-md bg-muted overflow-hidden border border-border shrink-0">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={`Worksheet preview for ${submission.student?.full_name ?? "student"}`}
                    width={28}
                    height={28}
                    className="size-full object-cover"
                  />
                ) : (
                  <FileText className="size-full p-1 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground truncate">
                  {submission.student?.full_name ?? "Student"}
                </span>
                {submission.status === "rejected" ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-2 py-0.5 bg-background dark:bg-card text-destructive border-destructive/40 shrink-0 font-semibold shadow-2xs"
                  >
                    Photo Rejected
                  </Badge>
                ) : selectedCriterion ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border-brand-300 truncate"
                  >
                    {selectedCriterion}
                  </Badge>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (variant === "modal") {
                  scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  worksheetColumnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className="min-h-[40px] h-10 sm:h-8 px-3 text-xs gap-1.5 cursor-pointer shrink-0 touch-manipulation font-medium text-brand-800 dark:text-brand-300 border-brand-300 dark:border-brand-800 hover:bg-brand-50 dark:hover:bg-brand-950/60"
            >
              <Eye className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>View Image</span>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:items-start">
          {/* Left: Worksheet Image Preview with Interactive Stroke Inspector */}
          <div
            ref={worksheetColumnRef}
            className={cn(
              "lg:col-span-6 flex flex-col justify-between gap-2.5 w-full min-h-0",
              variant === "page"
                ? "lg:sticky lg:top-[4.25rem] lg:self-start lg:max-h-[calc(100dvh-5.5rem)]"
                : "h-full"
            )}
          >
            <h2 className="sr-only">Handwriting Worksheet Preview and Stroke Inspector</h2>
            <WorksheetImageInspector
              imageUrl={imageUrl}
              altText={`Handwriting worksheet submitted for ${submission.student?.full_name ?? "student"}`}
              isLoading={isImageLoading}
              isError={isImageError}
              collapsibleImageTools
              diagnosticToolbar={
                diagnosticOverlay ? (
                  <OverlayToolbar
                    variant="compact"
                    overlay={diagnosticOverlay}
                    activeCriterion={activeOverlayCriterion}
                    onChangeCriterion={(c) => {
                      setActiveOverlayCriterion(c);
                      const items = getAttentionItems(diagnosticOverlay, c);
                      if (c !== "all" && items.length > 0) {
                        setSelectedAttentionItem(items[0]);
                      } else {
                        setSelectedAttentionItem(null);
                      }
                      const name = CRITERION_FILTER_TO_NAME[c];
                      if (name) {
                        setSelectedCriterion(name);
                        setCriterionAnnouncement(`Selected ${name} on diagnostic overlay`);
                      }
                    }}
                    selectedAttentionId={selectedAttentionItem?.id}
                    onSelectAttentionItem={setSelectedAttentionItem}
                    visible={showOverlay}
                    onToggleVisible={setShowOverlay}
                    showGuideLines={showGuideLines}
                    onToggleGuideLines={toggleGuideLines}
                    hasGuideLines={Boolean(guideLines)}
                    className="border-none bg-transparent p-0 shadow-none backdrop-blur-none"
                  />
                ) : (
                  <DiagnosticFallbackBanner
                    scoreSource={
                      hasCalibratedScores
                        ? "calibrated"
                        : submission.manual_score
                          ? "manual"
                          : "none"
                    }
                    className="border-none bg-transparent p-0 shadow-none"
                  />
                )
              }
                showShortcutsLegend={false}
                onRetry={() => {
                  refetchImage();
                }}
                className="flex-1 flex flex-col min-h-0"
                aspectRatioClass={
                  variant === "page"
                    ? "max-h-[min(640px,calc(100dvh-12rem))] min-h-[280px] sm:min-h-[320px]"
                    : "max-h-[min(540px,calc(100dvh-14rem))] min-h-[260px] sm:min-h-[280px] lg:flex-1"
                }
              >
                {diagnosticOverlay ? (
                  <DiagnosticOverlay
                    overlay={diagnosticOverlay}
                    imageUrl={imageUrl}
                    visible={showOverlay}
                    activeCriterion={activeOverlayCriterion}
                    selectedAnnotation={selectedAttentionItem}
                    onSelectAnnotation={setSelectedAttentionItem}
                    showGuideLines={showGuideLines}
                  />
                ) : (
                  <GuideLineOverlay
                    guideLines={guideLines}
                    imageUrl={imageUrl}
                    visible={showGuideLines}
                    lineBounds={fallbackLineBounds}
                  />
                )}
              </WorksheetImageInspector>

              {/* Target prompt & recognized text card */}
              <div className="shrink-0 space-y-2 p-2.5 sm:p-3 rounded-xl bg-card border border-border/70 text-xs text-muted-foreground shadow-2xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-semibold text-foreground shrink-0 text-xs">Target prompt:</span>
                    <span className="font-medium text-foreground bg-muted/60 px-2.5 py-1 rounded-lg border border-border/60 truncate max-w-full text-xs font-mono">
                      {resolvedTargetText ? `"${resolvedTargetText}"` : "Cursive Penmanship Practice"}
                    </span>
                  </div>
                </div>

                {casingMismatches.length > 0 && (
                  <div className="flex items-start gap-1.5 pt-2 border-t border-border/40 text-xs text-warning bg-warning/5 dark:bg-warning/10 p-2 rounded-lg border border-warning/20">
                    <Info className="size-3.5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="font-medium leading-tight text-warning">
                      <strong className="font-semibold">Capitalization Note:</strong>{" "}
                      {casingMismatches.map((m, idx) => (
                        <span key={idx}>
                          {idx > 0 && ", "}
                          expected &quot;{m.expected}&quot;, recognized &quot;{m.detected}&quot;
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Diagnostic Assessment Details & Comments */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-2.5">
              <h2 className="sr-only">Diagnostic Assessment and Comments</h2>

              {/* Unified Right-Pane Tab Bar (keeps worksheet visible on the left while replying to comments) */}
              {(() => {
                const showMetricsTab =
                  !hasCalibratedScores &&
                  (submission.status === "completed" || submission.status === "returned");
                const tabs: Array<{ id: "rubric" | "metrics" | "comments"; label: string }> = showMetricsTab
                  ? [
                      { id: "rubric", label: "Rubric" },
                      { id: "metrics", label: "CV Metrics" },
                      { id: "comments", label: "Comments" },
                    ]
                  : [
                      { id: "rubric", label: "Assessment" },
                      { id: "comments", label: "Comments" },
                    ];
                const effectiveTab: "rubric" | "metrics" | "comments" =
                  !showMetricsTab && rightPaneTab === "metrics" ? "rubric" : rightPaneTab;

                return (
                  <>
                    <div
                      role="tablist"
                      aria-label="Submission review panels"
                      className="flex items-center p-1 rounded-xl bg-muted/60 border border-border/80 gap-1"
                    >
                      {tabs.map((tab, tabIdx) => {
                        const isActive = effectiveTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            id={`submission-tab-${tab.id}`}
                            aria-selected={isActive}
                            aria-controls={`submission-tabpanel-${tab.id}`}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => setRightPaneTab(tab.id)}
                            onKeyDown={(e) => {
                              let nextIdx: number | null = null;
                              if (e.key === "ArrowRight") nextIdx = (tabIdx + 1) % tabs.length;
                              else if (e.key === "ArrowLeft") nextIdx = (tabIdx - 1 + tabs.length) % tabs.length;
                              else if (e.key === "Home") nextIdx = 0;
                              else if (e.key === "End") nextIdx = tabs.length - 1;
                              if (nextIdx !== null) {
                                e.preventDefault();
                                const targetTab = tabs[nextIdx];
                                setRightPaneTab(targetTab.id);
                                document.getElementById(`submission-tab-${targetTab.id}`)?.focus();
                              }
                            }}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-10 sm:min-h-0 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                              isActive
                                ? "bg-surface dark:bg-card text-foreground shadow-xs border border-border/60"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {tab.id === "rubric" && (
                              <Award className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
                            )}
                            {tab.id === "metrics" && (
                              <SlidersHorizontal className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
                            )}
                            {tab.id === "comments" && (
                              <MessageSquare className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
                            )}
                            <span className="truncate">{tab.label}</span>
                            {tab.id === "comments" && hasUnreadComments && (
                              <span className="inline-flex items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary shrink-0">
                                Unread
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* COMMENTS TAB PANEL (Worksheet remains pinned on left!) */}
                    {effectiveTab === "comments" && (
                      <div
                        id="submission-tabpanel-comments"
                        role="tabpanel"
                        aria-labelledby="submission-tab-comments"
                        className="rounded-xl border border-border/80 bg-surface dark:bg-card shadow-xs overflow-hidden flex flex-col min-h-80"
                      >
                        {open && (commentUserId ? (
                          <SubmissionCommentThread
                            key={`${commentUserId}:${submission.id}`}
                            userId={commentUserId}
                            target={{ submissionId: submission.id }}
                            location={{
                              submissionId: submission.id,
                              activityId: submission.activity_id,
                              studentId: submission.student_id,
                            }}
                            studentName={submission.student?.full_name}
                            open
                          />
                        ) : (
                          <div className="p-4 space-y-3" role="status" aria-label="Loading conversation">
                            <Skeleton className="h-6 w-48 rounded-md" />
                            <Skeleton className="h-16 w-full rounded-xl" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ASSESSMENT / RUBRIC / METRICS PANELS */}
                    {effectiveTab !== "comments" && (
                      <div
                        id={`submission-tabpanel-${effectiveTab}`}
                        role="tabpanel"
                        aria-labelledby={`submission-tab-${effectiveTab}`}
                        className="space-y-2.5"
                      >
                        {/* REJECTED / QUALITY GATE FAILED STATE */}
                        {submission.status === "rejected" && (
                          <SubmissionRejectionCard
                            submission={submission}
                            onReupload={handleReupload}
                          />
                        )}

                        {/* PROCESSING STATE */}
                        {submission.status === "processing" && (
                          <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-warning/10 border border-warning/30 space-y-2.5 text-center">
                            <div className="flex size-11 items-center justify-center rounded-2xl bg-warning/20 text-warning-foreground mx-auto motion-safe:animate-pulse">
                              <Clock className="size-5 sm:size-6" aria-hidden="true" />
                            </div>
                            <div className="space-y-1 max-w-sm mx-auto">
                              <h3 className="text-sm font-heading font-semibold text-foreground">
                                Analyzing Handwriting
                              </h3>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                Evaluating letter formation, spacing, slant, and baseline alignment.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* COMPLETED STATE */}
                        {(submission.status === "completed" || submission.status === "returned") && (
                          <div className="space-y-2.5">
                            {hasCalibratedScores ? (
                              <>
                                {/* Phase 2: Overall Composite Score Card */}
                                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-surface dark:bg-card border border-border shadow-xs">
                                  <div className="space-y-0.5">
                                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                      Overall Score
                                    </h3>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl sm:text-2xl font-sans font-bold text-foreground tabular-nums">
                                        {compositeScore !== null && compositeScore !== undefined
                                          ? `${Math.round(compositeScore)}%`
                                          : "Scored"}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={`text-xs font-semibold px-2.5 py-0.5 inline-flex items-center ${compositeBand.className}`}
                                      >
                                        {compositeBand.band}
                                      </Badge>
                                    </div>
                                  </div>

                                  <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                                    <CheckCircle2 className="size-4.5 sm:size-5" aria-hidden="true" />
                                  </div>
                                </div>

                                {/* Phase 2: 5 Criteria breakdown */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                      Criteria Breakdown
                                    </h3>
                                  </div>

                                  <div className="space-y-1">
                                    {criteria.map((c) => {
                                      const band = getScoreBandLabel(c.score);
                                      const isSelected = selectedCriterion === c.name;
                                      const inlineId = `phase2-criterion-guide-inline-${c.name.toLowerCase().replace(/\s+/g, "-")}`;
                                      return (
                                        <div key={c.name} className="space-y-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedCriterion(c.name);
                                              const mapped = CRITERION_NAME_TO_FILTER[c.name];
                                              if (mapped) setActiveOverlayCriterion(mapped);
                                              setCriterionAnnouncement(
                                                `${c.name} selected. Diagnostic guide and coaching tips updated.`
                                              );
                                            }}
                                            aria-expanded={isSelected}
                                            aria-controls={
                                              isSelected
                                                ? isDesktopGuideRendered
                                                  ? `${inlineId} criterion-diagnostic-guide`
                                                  : inlineId
                                                : undefined
                                            }
                                            aria-label={`${c.name}: ${c.score !== null && c.score !== undefined
                                              ? `${Math.round(c.score)}%`
                                              : "Unrated"
                                              } (${band.band}). Tap to focus coaching tip.`}
                                            className={`w-full flex items-center justify-between px-2.5 py-1.5 sm:py-2 rounded-xl border transition-all text-xs text-left cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring min-h-[40px] sm:min-h-0 touch-manipulation ${isSelected
                                              ? "bg-brand-50/80 dark:bg-brand-950/60 border-brand-300 dark:border-brand-800 shadow-xs ring-1 ring-brand-400/30"
                                              : "bg-surface dark:bg-card border-border/70 hover:border-border hover:bg-muted/30"
                                              }`}
                                          >
                                            <div className="min-w-0 pr-2">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-semibold text-foreground truncate block">
                                                  {c.name}
                                                </span>
                                                {(criterionAttentionCounts[c.name] ?? 0) > 0 && (
                                                  <Badge
                                                    variant="secondary"
                                                    className={cn(
                                                      "px-1.5 py-0 h-4 text-[10px] font-bold rounded-full",
                                                      isSelected
                                                        ? "bg-brand-200 text-brand-900 dark:bg-brand-900 dark:text-brand-100"
                                                        : "bg-band-1/15 text-band-1-text dark:bg-band-1/25 dark:text-orange-200 border border-band-1/30"
                                                    )}
                                                  >
                                                    <span>
                                                      {criterionAttentionCounts[c.name]}{" "}
                                                      {criterionAttentionCounts[c.name] === 1 ? "alert" : "alerts"}
                                                    </span>
                                                  </Badge>
                                                )}
                                              </div>
                                              <span className="text-xs text-muted-foreground line-clamp-1 block">
                                                {c.description}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              {c.score !== null && c.score !== undefined && (
                                                <span className="font-semibold text-foreground tabular-nums">
                                                  {Math.round(c.score)}%
                                                </span>
                                              )}
                                              <Badge
                                                variant="outline"
                                                className={`text-xs font-semibold px-2.5 py-0.5 ${band.className}`}
                                              >
                                                {band.band}
                                              </Badge>
                                            </div>
                                          </button>

                                          {/* Inline Mobile & Tablet Coaching Tip when selected (lg:hidden) */}
                                          {isSelected && activeCriterionInfo && (
                                            <div
                                              id={inlineId}
                                              role="region"
                                              aria-label={`${c.name} coaching tip`}
                                              className="lg:hidden p-2.5 rounded-lg bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 text-xs space-y-1 animate-in fade-in-50 duration-150 motion-reduce:animate-none"
                                            >
                                              <p className="text-[11px] text-foreground/80 leading-relaxed">
                                                {activeCriterionInfo.rubricGoal}
                                              </p>
                                              <div className="pt-1 border-t border-brand-200/60 dark:border-brand-900/60 flex items-start gap-1 text-[11px] text-brand-800 dark:text-brand-300">
                                                <Eye className="size-3 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" aria-hidden="true" />
                                                <span className="leading-normal">
                                                  <strong>Tip:</strong> {activeCriterionInfo.coachingTip}
                                                </span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Promoted Release Completion Strip */}
                                <SubmissionLifecycleControls
                                  submission={submission}
                                  showRelease
                                  variant="completion"
                                />
                              </>
                            ) : (
                              <>
                                {/* TAB 1: TEACHER RUBRIC ASSESSMENT */}
                                {effectiveTab === "rubric" && (
                                  <div className="space-y-2.5">
                                    {submission.manual_score && (!isEditingRubric || !canEditRubric) ? (
                                      <>
                                        {/* READ-ONLY / CONFIRMED RUBRIC STATE */}
                                        <div className="p-2.5 sm:p-3 rounded-xl bg-surface dark:bg-card border border-border/80 shadow-xs space-y-2">
                                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <div className="flex size-6 sm:size-7 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 shrink-0">
                                                <ShieldCheck className="size-3.5 sm:size-4" aria-hidden="true" />
                                              </div>
                                              <span className="text-xs font-semibold text-foreground truncate">
                                                Teacher Benchmark
                                              </span>
                                              {recordedComposite && (
                                                <Badge
                                                  variant="outline"
                                                  className={cn(
                                                    "text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 inline-flex items-center gap-1.5 font-sans tabular-nums",
                                                    recordedComposite.overallBandMeta.badgeClass
                                                  )}
                                                >
                                                  <span
                                                    className={cn(
                                                      "size-1.5 rounded-full shrink-0",
                                                      recordedComposite.overallBandMeta.dotColor
                                                    )}
                                                    aria-hidden="true"
                                                  />
                                                  <span>
                                                    {recordedComposite.isComplete
                                                      ? `${recordedComposite.totalPoints}/20 pts (${recordedComposite.avgPercentage}%) • ${recordedComposite.overallBandMeta.label}`
                                                      : `${recordedComposite.totalPoints}/${recordedComposite.maxPoints} pts`}
                                                  </span>
                                                </Badge>
                                              )}
                                            </div>
                                            {canEditRubric && (
                                              <Button
                                                ref={editButtonRef}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsEditingRubric(true)}
                                                className="h-10 sm:h-7 min-h-[40px] sm:min-h-0 px-3 sm:px-2.5 text-xs text-brand-800 dark:text-brand-200 border-brand-300 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/60 gap-1.5 cursor-pointer touch-manipulation shrink-0 font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                                                aria-label="Edit recorded rubric scores"
                                              >
                                                <Edit3 className="size-3" aria-hidden="true" />
                                                <span>Edit</span>
                                              </Button>
                                            )}
                                          </div>

                                          <div className="space-y-1 pt-0.5" role="group" aria-label="Recorded criterion breakdown">
                                            {RUBRIC_CRITERIA.map((criterion) => {
                                              const bandValue =
                                                submission.manual_score?.[criterion.key];
                                              const bandMeta = getBandMeta(bandValue);
                                              const isSelected =
                                                selectedCriterion === criterion.shortName;
                                              const attentionCount =
                                                criterionAttentionCounts[criterion.shortName] ??
                                                criterionAttentionCounts[criterion.name] ??
                                                0;
                                              const hasPoints =
                                                typeof bandMeta.points === "number" && bandMeta.points > 0;
                                              const pointsText = hasPoints
                                                ? `${bandMeta.points}/4 pts`
                                                : null;
                                              const badgeLabel = pointsText
                                                ? `${bandMeta.label} (${pointsText})`
                                                : bandMeta.label;
                                              return (
                                                <div key={criterion.key} className="space-y-1">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setSelectedCriterion(criterion.shortName);
                                                      const mapped =
                                                        CRITERION_NAME_TO_FILTER[criterion.shortName] ??
                                                        CRITERION_NAME_TO_FILTER[criterion.name];
                                                      if (mapped) setActiveOverlayCriterion(mapped);
                                                      setCriterionAnnouncement(
                                                        `${criterion.shortName} selected. Diagnostic guide and coaching tips updated.`
                                                      );
                                                    }}
                                                    aria-expanded={isSelected}
                                                    aria-controls={
                                                      isSelected
                                                        ? isDesktopGuideRendered
                                                          ? `criterion-guide-inline-${criterion.key} criterion-diagnostic-guide`
                                                          : `criterion-guide-inline-${criterion.key}`
                                                        : undefined
                                                    }
                                                    aria-label={`${criterion.shortName}: ${badgeLabel}. Tap to focus coaching tip.`}
                                                    className={cn(
                                                      "w-full flex items-center justify-between px-2.5 py-1.5 sm:py-2 rounded-lg border text-xs text-left cursor-pointer transition-all min-h-[40px] sm:min-h-0 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                                                      isSelected
                                                        ? "bg-brand-50/80 dark:bg-brand-950/60 border-brand-300 dark:border-brand-800 shadow-xs ring-1 ring-brand-400/30"
                                                        : "bg-surface dark:bg-card border-border/60 hover:bg-muted/30"
                                                    )}
                                                  >
                                                    <div className="min-w-0 pr-2">
                                                      <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-semibold text-foreground truncate block">
                                                          {criterion.name}
                                                        </span>
                                                        {(() => {
                                                          const metric = extractCriterionCVMetric(criterion.key, submission.measurement);
                                                          if (!metric) return null;
                                                          return (
                                                            <span
                                                              className={cn(
                                                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium border tabular-nums",
                                                                metric.badgeClass
                                                              )}
                                                              title={`CV Measurement: ${metric.value} (${metric.target}) - ${metric.status}`}
                                                            >
                                                              <span className={cn("size-1.5 rounded-full", metric.dotClass)} aria-hidden="true" />
                                                              <span className="font-semibold">{metric.value}</span>
                                                              <span className="opacity-80 font-sans">· {metric.status}</span>
                                                            </span>
                                                          );
                                                        })()}
                                                        {attentionCount > 0 && (
                                                          <Badge
                                                            variant="secondary"
                                                            className={cn(
                                                              "px-1.5 py-0 h-4 text-[10px] font-bold rounded-full",
                                                              isSelected
                                                                ? "bg-brand-200 text-brand-900 dark:bg-brand-900 dark:text-brand-100"
                                                                : "bg-band-1/15 text-band-1-text dark:bg-band-1/25 dark:text-orange-200 border border-band-1/30"
                                                            )}
                                                          >
                                                            <span>
                                                              {attentionCount} {attentionCount === 1 ? "alert" : "alerts"}
                                                            </span>
                                                          </Badge>
                                                        )}
                                                      </div>
                                                      <span className="text-xs text-muted-foreground line-clamp-1 block">
                                                        {criterion.hint}
                                                      </span>
                                                    </div>
                                                    <Badge
                                                      variant="outline"
                                                      className={cn(
                                                        "text-xs font-semibold px-2.5 py-0.5 shrink-0 inline-flex items-center gap-1.5",
                                                        bandMeta.badgeClass
                                                      )}
                                                    >
                                                      <span className={cn("size-1.5 rounded-full shrink-0", bandMeta.dotColor)} aria-hidden="true" />
                                                      <span>{badgeLabel}</span>
                                                    </Badge>
                                                  </button>

                                                  {/* Inline Mobile & Tablet Coaching Tip for read-only rubric mode (lg:hidden) */}
                                                  {isSelected && activeCriterionInfo && (
                                                    <div
                                                      id={`criterion-guide-inline-${criterion.key}`}
                                                      role="region"
                                                      aria-label={`${criterion.shortName} coaching tip`}
                                                      className="lg:hidden p-2.5 rounded-lg bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 text-xs space-y-1 animate-in fade-in-50 duration-150 motion-reduce:animate-none"
                                                    >
                                                      <p className="text-[11px] text-foreground/80 leading-relaxed">
                                                        {activeCriterionInfo.rubricGoal}
                                                      </p>
                                                      <div className="pt-1 border-t border-brand-200/60 dark:border-brand-900/60 flex items-start gap-1 text-[11px] text-brand-800 dark:text-brand-300">
                                                        <Eye className="size-3 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" aria-hidden="true" />
                                                        <span className="leading-normal">
                                                          <strong>Tip:</strong> {activeCriterionInfo.coachingTip}
                                                        </span>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>

                                        {/* Promoted Release Completion Strip directly below recorded rubric */}
                                        <SubmissionLifecycleControls
                                          submission={submission}
                                          showRelease
                                          variant="completion"
                                        />
                                      </>
                                    ) : canEditRubric ? (
                                      /* INTERACTIVE RUBRIC ENTRY FORM */
                                      <ManualRubricEntryForm
                                        key={submission.id}
                                        submissionId={submission.id}
                                        initialScores={submission.manual_score}
                                        measurement={submission.measurement}
                                        onSuccess={handleSuccessEditingRubric}
                                        onCancel={handleCancelEditingRubric}
                                        onDirtyChange={setIsRubricDirty}
                                        onFocusCriterion={setSelectedCriterion}
                                        canGoNext={canGoNext}
                                        onAdvanceNext={() => {
                                          if (
                                            canGoNext &&
                                            submissions &&
                                            onNavigate
                                          ) {
                                            setIsRubricDirty(false);
                                            onNavigate(submissions[effectiveIndex + 1]);
                                          }
                                        }}
                                        onNavigateBack={() => {
                                          if (onNavigate) {
                                            onNavigate(submission);
                                            setIsEditingRubric(true);
                                          }
                                        }}
                                      />
                                    ) : (
                                      <p className="rounded-xl border border-border/80 bg-surface p-3 text-xs text-muted-foreground dark:bg-card">
                                        {scoringEngine.isPending || scoringEngine.isFetching
                                          ? "Checking the active scoring mode…"
                                          : scoringEngine.isError
                                            ? "Rubric editing is unavailable because the scoring mode could not be confirmed."
                                            : "Manual rubric scoring is unavailable while calibrated scoring is active."}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* TAB 2: PHYSICAL RAW CV MEASUREMENTS */}
                                {effectiveTab === "metrics" && (
                                  <RawMeasurementsTable
                                    measurement={measurement}
                                    selectedCriterion={selectedCriterion}
                                    onSelectCriterion={(criterionName) => {
                                      setSelectedCriterion(criterionName);
                                      setCriterionAnnouncement(
                                        `${criterionName} selected. Diagnostic guide and coaching tips updated.`
                                      );
                                    }}
                                  />
                                )}
                              </>
                            )}

                            {/* Focused Criterion Diagnostic Insight Card (Desktop view >=lg; mobile/tablet handled inline) */}
                            {isDesktopGuideRendered && activeCriterionInfo && (
                              <div
                                id="criterion-diagnostic-guide"
                                className="hidden lg:block p-2.5 rounded-xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 space-y-1 animate-in fade-in-50 duration-200 motion-reduce:animate-none"
                              >
                                <div className="flex items-center justify-between text-xs font-semibold text-brand-900 dark:text-brand-200">
                                  <h3 className="flex items-center gap-1.5 font-semibold text-brand-900 dark:text-brand-200">
                                    <Info className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                                    <span>{selectedCriterion} Guide</span>
                                  </h3>
                                </div>
                                <p className="text-[11px] sm:text-xs text-foreground/85 leading-snug">
                                  {activeCriterionInfo.rubricGoal}
                                </p>
                                <div className="pt-1 border-t border-brand-200/60 dark:border-brand-900/60 flex items-start gap-1.5 text-[11px] sm:text-xs text-brand-800 dark:text-brand-300">
                                  <Eye className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" aria-hidden="true" />
                                  <span className="leading-normal">
                                    <strong>Tip:</strong> {activeCriterionInfo.coachingTip}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      {/* Footer */}
      {variant === "modal" ? (
        <DialogFooter className="pt-3 sm:pt-3.5 border-t border-border/70 shrink-0 flex flex-row items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <SubmissionLifecycleControls submission={submission} showRelease={false} variant="actions" />
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <div className="text-[11px] text-muted-foreground hidden sm:inline-flex items-center gap-2.5 select-none">
              {hasMultipleSubmissions && (
                <>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted border border-border rounded-md font-mono">
                      ←
                    </kbd>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted border border-border rounded-md font-mono">
                      →
                    </kbd>
                    <span>Navigate (or J / K)</span>
                  </span>
                  <span className="text-border">·</span>
                </>
              )}
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted border border-border rounded-md font-mono">
                  Esc
                </kbd>
                <span>Close</span>
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onClose?.()}
              className="h-10 sm:h-8 min-h-[40px] sm:min-h-0 px-3.5 text-xs font-medium cursor-pointer touch-manipulation"
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      ) : (
        <footer className="pt-3 sm:pt-3.5 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <SubmissionLifecycleControls submission={submission} showRelease={false} variant="actions" />
          </div>

          <div className="flex items-center gap-2.5 ml-auto flex-wrap">
            {/* Desktop keyboard shortcuts (>= sm) */}
            <div className="hidden sm:inline-flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-foreground">Shortcuts:</span>
              {hasMultipleSubmissions && (
                <>
                  <kbd className="px-1.5 py-0.5 text-[11px] font-semibold bg-muted border border-border rounded-md font-mono">
                    J
                  </kbd>
                  <kbd className="px-1.5 py-0.5 text-[11px] font-semibold bg-muted border border-border rounded-md font-mono">
                    K
                  </kbd>
                  <span>student</span>
                  <span className="text-border">·</span>
                </>
              )}
              <kbd className="px-1.5 py-0.5 text-[11px] font-semibold bg-muted border border-border rounded-md font-mono">
                C
              </kbd>
              <span>ink</span>
              <span className="text-border">·</span>
              <kbd className="px-1.5 py-0.5 text-[11px] font-semibold bg-muted border border-border rounded-md font-mono">
                L
              </kbd>
              <span>magnify</span>
              <span className="text-border">·</span>
              <kbd className="px-1.5 py-0.5 text-[11px] font-semibold bg-muted border border-border rounded-md font-mono">
                +
              </kbd>
              <kbd className="px-1.5 py-0.5 text-[11px] font-semibold bg-muted border border-border rounded-md font-mono">
                -
              </kbd>
              <span>zoom</span>
              <span className="text-border">·</span>
              <kbd className="px-1.5 py-0.5 text-[11px] font-semibold bg-muted border border-border rounded-md font-mono">
                Esc
              </kbd>
              <span>back</span>
            </div>

            {hasMultipleSubmissions && submissions && submissions.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                Student {effectiveIndex + 1} of {submissions.length}
              </span>
            )}
          </div>
        </footer>
      )}

      {/* Unsaved Rubric Navigation Guard Dialog */}
      <AlertDialog
        open={Boolean(pendingNavTarget)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingNavTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved rubric ratings?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved ratings for{" "}
              <strong className="font-semibold text-foreground">
                {submission.student?.full_name ?? "this student"}
              </strong>
              . Navigating to another student will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setPendingNavTarget(null)}
              className="min-h-10 sm:min-h-9"
            >
              Stay here
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const target = pendingNavTarget;
                setPendingNavTarget(null);
                setIsRubricDirty(false);
                if (target) onNavigate?.(target);
              }}
              className="min-h-10 sm:min-h-9 cursor-pointer"
            >
              Discard &amp; continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the uploaded worksheet photo, its comments, computer vision analysis,
              and rubric scores for{" "}
              <strong className="font-semibold text-foreground">
                {submission.student?.full_name ?? "this student"}
              </strong>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              variant="destructive"
              className="gap-2 cursor-pointer"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>Deleting...</span>
                </>
              ) : (
                "Delete Attempt"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

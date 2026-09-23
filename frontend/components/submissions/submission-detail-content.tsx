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
} from "@/lib/hooks/use-submissions";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { GuideLineOverlay, type GuideLines } from "@/components/shared/guide-line-overlay";
import {
  DiagnosticOverlay,
  OverlayToolbar,
  DiagnosticFallbackBanner,
  extractDiagnosticOverlay,
  type CriterionFilter,
  type DiagnosticOverlayData,
  type ActiveAnnotationHover,
} from "@/components/shared/diagnostic-overlay";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  User,
  GraduationCap,
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
import { toast } from "sonner";
import { useDeleteSubmission } from "@/lib/hooks/use-submissions";
import {
  ManualRubricEntryForm,
  calculateCompositeRubric,
  RUBRIC_CRITERIA,
  getBandMeta,
  CRITERIA_GUIDE,
} from "./manual-rubric-entry-form";
import { SubmissionRejectionCard } from "./submission-rejection-card";
import { RawMeasurementsTable } from "./raw-measurements-table";
import { getScoreBandLabel } from "@/lib/utils/submission-status";

export function getInitials(name: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const AVATAR_PALETTES = [
  "bg-brand-100 text-brand-900 border-brand-300/70 dark:bg-brand-950/80 dark:text-brand-200 dark:border-brand-800",
  "bg-emerald-100 text-emerald-900 border-emerald-300/70 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800",
  "bg-amber-100 text-amber-900 border-amber-300/70 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800",
  "bg-teal-100 text-teal-900 border-teal-300/70 dark:bg-teal-950/80 dark:text-teal-200 dark:border-teal-800",
  "bg-slate-100 text-slate-800 border-slate-300/70 dark:bg-slate-850 dark:text-slate-200 dark:border-slate-700",
  "bg-stone-100 text-stone-800 border-stone-300/70 dark:bg-stone-850 dark:text-stone-200 dark:border-stone-700",
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
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
}

export function SubmissionDetailContent({
  submission,
  submissions,
  currentIndex,
  onNavigate,
  activityTargetText,
  onClose,
  variant,
}: SubmissionDetailContentProps) {
  const { openUpload } = useTeacherModals();
  const [isScrolledPastInspector, setIsScrolledPastInspector] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [selectedCriterion, setSelectedCriterion] = useState<string | null>(
    "Letter Formation"
  );
  const [activeCriterionOverride, setActiveCriterionOverride] =
    useState<{ submissionId: string; criterion: CriterionFilter } | null>(null);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [phase1Tab, setPhase1Tab] = useState<"rubric" | "metrics">("rubric");
  const [isEditingRubric, setIsEditingRubric] = useState(false);
  const [showGuideLines, setShowGuideLines] = useState(false);
  const [criterionAnnouncement, setCriterionAnnouncement] = useState<string>("");
  const editButtonRef = useRef<HTMLButtonElement>(null);

  const handleCancelEditingRubric = useCallback(() => {
    setIsEditingRubric(false);
    setTimeout(() => {
      editButtonRef.current?.focus();
    }, 50);
  }, []);

  const handleSuccessEditingRubric = useCallback(() => {
    setIsEditingRubric(false);
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

      // Submission cycling
      if (isPrev) {
        if (canGoPrev && submissions && onNavigate) {
          e.preventDefault();
          e.stopPropagation();
          onNavigate(submissions[effectiveIndex - 1]);
        }
      } else if (isNext) {
        if (canGoNext && submissions && onNavigate) {
          e.preventDefault();
          e.stopPropagation();
          onNavigate(submissions[effectiveIndex + 1]);
        }
      }
    };

    // Use capture phase so Base UI's internal composite-key stopPropagation does not swallow arrow keys
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [submissions, effectiveIndex, canGoPrev, canGoNext, onNavigate]);

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
    selectedCriterion &&
      activeCriterionInfo &&
      (hasCalibratedScores ||
        phase1Tab === "metrics" ||
        (phase1Tab === "rubric" && submission.manual_score && !isEditingRubric))
  );

  // Reusable actions toolbar (Delete attempt + student navigation carousel)
  const actionsContent = (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsDeleteDialogOpen(true)}
        disabled={deleteMutation.isPending}
        className="h-9 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl border border-border/60 hover:border-destructive/30 transition-colors flex items-center gap-1.5 cursor-pointer touch-manipulation font-medium shrink-0"
        title="Delete this attempt"
        aria-label="Delete this attempt"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Delete Attempt</span>
      </Button>

      {hasMultipleSubmissions && submissions && onNavigate && (
        <div className="flex items-center gap-0.5 sm:gap-1 bg-muted/50 p-0.5 sm:p-1 rounded-xl border border-border h-9 shrink-0">
          <Button
            ref={prevButtonRef}
            variant="ghost"
            size="sm"
            disabled={!canGoPrev}
            onClick={() => {
              if (canGoPrev && submissions) {
                onNavigate(submissions[effectiveIndex - 1]);
              }
            }}
            className="size-8 sm:size-7 min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer flex items-center justify-center touch-manipulation"
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
                onNavigate(submissions[effectiveIndex + 1]);
              }
            }}
            className="size-8 sm:size-7 min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer flex items-center justify-center touch-manipulation"
            aria-label="Next student (Key: K or →)"
            title="Next student (→ / K)"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );

  // Render header content based on variant and viewport tier
  const headerContent = (
    <div className="w-full flex flex-col gap-2.5 sm:gap-3">
      {/* Main Student Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 w-full">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {/* Student Avatar */}
          <div
            className={cn(
              "flex size-9 sm:size-10 items-center justify-center rounded-xl border text-sm font-bold shrink-0 select-none shadow-2xs",
              submission.student?.full_name
                ? getAvatarColor(submission.student.full_name)
                : "bg-brand-100 text-brand-700 border-brand-200/60 dark:bg-brand-950 dark:text-brand-300 dark:border-brand-900"
            )}
            role="img"
            aria-label={
              submission.student?.full_name
                ? `${submission.student.full_name}'s avatar`
                : "Student avatar"
            }
          >
            {submission.student?.full_name && getInitials(submission.student.full_name) ? (
              <span aria-hidden="true" className="tracking-tight font-semibold text-xs sm:text-sm">
                {getInitials(submission.student.full_name)}
              </span>
            ) : (
              <GraduationCap className="size-4 sm:size-5" aria-hidden="true" />
            )}
          </div>

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

      {/* Body: Split view (Image + Diagnostic details) */}
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
        {/* Mobile Sticky Preview Pill (< lg screens, modal only) */}
        {variant === "modal" && isScrolledPastInspector && !isEditingRubric && (
          <div className="lg:hidden sticky -top-3 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-surface/95 dark:bg-card/95 backdrop-blur-md border-b border-border/80 flex items-center justify-between gap-2 shadow-xs animate-in fade-in slide-in-from-top-2 duration-150 motion-reduce:animate-none">
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
                scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="min-h-[40px] h-10 sm:h-8 px-3 text-xs gap-1.5 cursor-pointer shrink-0 touch-manipulation font-medium text-brand-800 dark:text-brand-300 border-brand-300 dark:border-brand-800 hover:bg-brand-50 dark:hover:bg-brand-950/60"
            >
              <Eye className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>View Image</span>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:items-start">
          {/* Left: Worksheet Image Preview with Interactive Stroke Inspector */}
          <div
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
              diagnosticToolbar={
                diagnosticOverlay ? (
                  <OverlayToolbar
                    variant="compact"
                    overlay={diagnosticOverlay}
                    activeCriterion={activeOverlayCriterion}
                    onChangeCriterion={(c) => {
                      setActiveOverlayCriterion(c);
                      setSelectedAttentionItem(null);
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
                    onToggleGuideLines={() => setShowGuideLines((prev) => !prev)}
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
                  ? "aspect-4/3 sm:aspect-3/2 lg:aspect-4/3 min-h-[280px] sm:min-h-[320px] lg:min-h-[320px]"
                  : "aspect-4/3 sm:aspect-3/2 lg:aspect-auto lg:flex-1 min-h-[260px] sm:min-h-[280px] lg:min-h-0"
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
                />
              ) : (
                <GuideLineOverlay
                  guideLines={guideLines}
                  imageUrl={imageUrl}
                  visible={showGuideLines}
                />
              )}
            </WorksheetImageInspector>

            {/* Target prompt card */}
            <div className="shrink-0 flex items-center justify-between gap-2.5 p-2 sm:p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-semibold text-foreground shrink-0 text-xs">Target prompt:</span>
                <span className="font-medium text-foreground bg-background/80 dark:bg-card/80 px-2.5 py-1 rounded-lg border border-border/60 truncate max-w-full text-xs">
                  {resolvedTargetText ? `"${resolvedTargetText}"` : "Cursive Penmanship Practice"}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Diagnostic Assessment Details */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-2.5">
            <h2 className="sr-only">Diagnostic Assessment and Feedback</h2>
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
                    Analyzing Handwriting Worksheet
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    OpenCV quality verification passed. The CNN model is evaluating letter formation, spacing, and baseline stability.
                  </p>
                </div>
              </div>
            )}

            {/* COMPLETED STATE */}
            {submission.status === "completed" && (
              <div className="space-y-2.5">
                {hasCalibratedScores ? (
                  <>
                    {/* Phase 2: Overall Composite Score Card */}
                    <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-surface dark:bg-card border border-border shadow-xs">
                      <div className="space-y-0.5">
                        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Composite Assessment
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
                          5-Criterion Breakdown
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          Tap to focus coaching tip
                        </span>
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
                                aria-label={`${c.name}: ${
                                  c.score !== null && c.score !== undefined
                                    ? `${Math.round(c.score)}%`
                                    : "Unrated"
                                } (${band.band}). Tap to focus coaching tip.`}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 sm:py-2 rounded-xl border transition-all text-xs text-left cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring min-h-[40px] sm:min-h-0 touch-manipulation ${
                                  isSelected
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
                                  <div className="flex items-center gap-1 text-[11px] font-semibold text-brand-800 dark:text-brand-300">
                                    <Info className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                                    <h4 className="font-semibold text-brand-800 dark:text-brand-300">Diagnostic Goal:</h4>
                                  </div>
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
                  </>
                ) : (
                  <>
                    {/* Phase 1 Segmented Tab Controls: Rubric vs. CV Metrics */}
                    <div
                      role="tablist"
                      aria-label="Phase 1 assessment view"
                      className="flex items-center p-1 rounded-xl bg-muted/60 border border-border/80 gap-1"
                    >
                      <button
                        type="button"
                        role="tab"
                        id="phase1-tab-rubric"
                        aria-selected={phase1Tab === "rubric"}
                        aria-controls="phase1-tabpanel-rubric"
                        tabIndex={phase1Tab === "rubric" ? 0 : -1}
                        onClick={() => setPhase1Tab("rubric")}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "End") {
                            e.preventDefault();
                            setPhase1Tab("metrics");
                            document.getElementById("phase1-tab-metrics")?.focus();
                          } else if (e.key === "Home") {
                            e.preventDefault();
                            setPhase1Tab("rubric");
                            document.getElementById("phase1-tab-rubric")?.focus();
                          }
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[44px] sm:min-h-0 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                          phase1Tab === "rubric"
                            ? "bg-surface dark:bg-card text-foreground shadow-xs border border-border/60"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Award className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                        <span>Rubric Rating</span>
                        {submission.manual_score ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border-brand-300"
                          >
                            Graded
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300/70 inline-flex items-center gap-1"
                          >
                            <span className="size-1.5 rounded-full bg-band-2 shrink-0" aria-hidden="true" />
                            <span>Unrated</span>
                          </Badge>
                        )}
                      </button>

                      <button
                        type="button"
                        role="tab"
                        id="phase1-tab-metrics"
                        aria-selected={phase1Tab === "metrics"}
                        aria-controls="phase1-tabpanel-metrics"
                        tabIndex={phase1Tab === "metrics" ? 0 : -1}
                        onClick={() => setPhase1Tab("metrics")}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home") {
                            e.preventDefault();
                            setPhase1Tab("rubric");
                            document.getElementById("phase1-tab-rubric")?.focus();
                          } else if (e.key === "End") {
                            e.preventDefault();
                            setPhase1Tab("metrics");
                            document.getElementById("phase1-tab-metrics")?.focus();
                          }
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[44px] sm:min-h-0 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                          phase1Tab === "metrics"
                            ? "bg-surface dark:bg-card text-foreground shadow-xs border border-border/60"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <SlidersHorizontal className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                        <span>CV Metrics</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border-brand-300"
                        >
                          Raw
                        </Badge>
                      </button>
                    </div>

                    {/* TAB 1: TEACHER RUBRIC ASSESSMENT */}
                    {phase1Tab === "rubric" && (
                      <div
                        id="phase1-tabpanel-rubric"
                        role="tabpanel"
                        aria-labelledby="phase1-tab-rubric"
                        className="space-y-2.5"
                      >
                        {submission.manual_score && !isEditingRubric ? (
                          /* READ-ONLY / CONFIRMED RUBRIC STATE */
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
                              <Button
                                ref={editButtonRef}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditingRubric(true)}
                                className="h-9 sm:h-7 min-h-[38px] sm:min-h-0 px-3 sm:px-2.5 text-xs text-brand-800 dark:text-brand-200 border-brand-300 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/60 gap-1.5 cursor-pointer touch-manipulation shrink-0 font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                                aria-label="Edit recorded rubric scores"
                              >
                                <Edit3 className="size-3" aria-hidden="true" />
                                <span>Edit</span>
                              </Button>
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
                                        <div className="flex items-center gap-1 text-[11px] font-semibold text-brand-800 dark:text-brand-300">
                                          <Info className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                                          <h4 className="font-semibold text-brand-800 dark:text-brand-300">Diagnostic Goal:</h4>
                                        </div>
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
                        ) : (
                          /* INTERACTIVE RUBRIC ENTRY FORM */
                          <ManualRubricEntryForm
                            key={submission.id}
                            submissionId={submission.id}
                            initialScores={submission.manual_score}
                            onSuccess={handleSuccessEditingRubric}
                            onCancel={handleCancelEditingRubric}
                            onFocusCriterion={setSelectedCriterion}
                            canGoNext={canGoNext}
                            onAdvanceNext={() => {
                              if (
                                canGoNext &&
                                submissions &&
                                onNavigate
                              ) {
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
                        )}
                      </div>
                    )}

                    {/* TAB 2: PHYSICAL RAW CV MEASUREMENTS */}
                    {phase1Tab === "metrics" && (
                      <div
                        id="phase1-tabpanel-metrics"
                        role="tabpanel"
                        aria-labelledby="phase1-tab-metrics"
                      >
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
                      </div>
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
                        <span>{selectedCriterion} Diagnostic Guide</span>
                      </h3>
                      <span className="text-[10px] text-brand-700 dark:text-brand-300 font-medium">
                        Criterion Guide
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-foreground/85 leading-snug">
                      {activeCriterionInfo.rubricGoal}
                    </p>
                    <div className="pt-1 border-t border-brand-200/60 dark:border-brand-900/60 flex items-start gap-1.5 text-[11px] sm:text-xs text-brand-800 dark:text-brand-300">
                      <Eye className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="leading-normal">
                        <strong>Coaching tip:</strong> {activeCriterionInfo.coachingTip}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      {variant === "modal" ? (
        <DialogFooter className="pt-3 sm:pt-3.5 border-t border-border/70 shrink-0 flex flex-row items-center justify-between">
          <div className="text-[11px] text-muted-foreground hidden sm:inline-flex items-center gap-2.5 select-none">
            {hasMultipleSubmissions && (
              <>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted border border-border rounded-md">
                    ←
                  </kbd>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted border border-border rounded-md">
                    →
                  </kbd>
                  <span>Navigate (or J / K)</span>
                </span>
                <span className="text-border">·</span>
              </>
            )}
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted border border-border rounded-md">
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
            className="h-9 px-4 text-xs font-medium cursor-pointer ml-auto touch-manipulation"
          >
            Close
          </Button>
        </DialogFooter>
      ) : (
        <footer className="pt-3 sm:pt-3.5 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
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
              [
            </kbd>
            <kbd className="px-1.5 py-0.5 text-[11px] font-semibold bg-muted border border-border rounded-md font-mono">
              ]
            </kbd>
            <span>practice area</span>
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

          {/* Mobile footer status (< sm) */}
          <div className="sm:hidden flex items-center justify-between w-full text-xs text-muted-foreground">
            {hasMultipleSubmissions && submissions && submissions.length > 0 ? (
              <span className="tabular-nums font-medium">
                Student {effectiveIndex + 1} of {submissions.length}
              </span>
            ) : (
              <span />
            )}
            <span className="text-[11px]">Use top controls to navigate</span>
          </div>

          {hasMultipleSubmissions && submissions && submissions.length > 0 && (
            <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">
              Student {effectiveIndex + 1} of {submissions.length}
            </span>
          )}
        </footer>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the uploaded worksheet photo, computer vision analysis,
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

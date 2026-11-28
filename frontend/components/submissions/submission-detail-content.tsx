"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ResponsiveRichOverlayHeader,
  ResponsiveRichOverlayFooter,
  ResponsiveRichOverlayTitle,
  ResponsiveRichOverlayDescription,
} from "@/components/shared/responsive-rich-overlay";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import {
  type Submission,
  type ScoreBand,
  useSubmissionImageUrl,
  useSubmissions,
  useSubmitManualScore,
} from "@/lib/hooks/use-submissions";
import { useReleaseSubmission, useActivityWork } from "@/lib/hooks/use-activity-work";
import { ApiError } from "@/lib/utils/api-error";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { GuideLineOverlay, type GuideLines } from "@/components/shared/guide-line-overlay";
import {
  CalmOverlayToolbar,
  DiagnosticOverlay,
  DiagnosticFallbackBanner,
  extractDiagnosticOverlay,
  getAttentionItems,
  type CriterionFilter,
  type DiagnosticOverlayData,
  type ActiveAnnotationHover,
} from "@/components/shared/diagnostic-overlay";
import { cn } from "@/lib/utils";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Eye,
  Info,
  Edit3,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { CriterionFeedbackRow } from "@/components/shared/criterion-feedback-row";
import {
  computeStrengthAndFocus,
  getBandFromScore,
  getBandMeta,
  type CriterionKey,
} from "@/lib/utils/scoring";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useDeleteSubmission } from "@/lib/hooks/use-submissions";
import {
  ManualRubricEntryForm,
  calculateCompositeRubric,
  RUBRIC_CRITERIA,
  CRITERIA_GUIDE,
  extractCriterionCVMetric,
} from "./manual-rubric-entry-form";
import { SubmissionRejectionCard } from "./submission-rejection-card";
import { RawMeasurementsTable } from "./raw-measurements-table";
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
  activityTitle?: string;
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
  activityTitle,
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

  const [selectedCriterionOverride, setSelectedCriterionOverride] =
    useState<{ submissionId: string; name: string | null } | null>(null);
  const [activeCriterionOverride, setActiveCriterionOverride] =
    useState<{ submissionId: string; criterion: CriterionFilter } | null>(null);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [rightPaneTab, setRightPaneTabState] = useState<"rubric" | "metrics" | "comments">(() =>
    initialView === "comments" ? "comments" : readStoredAssessmentTab()
  );
  const [isEditingRubric, setIsEditingRubric] = useState(false);
  const [isRubricDirty, setIsRubricDirty] = useState(false);
  const [pendingNavTarget, setPendingNavTarget] = useState<Submission | null>(null);
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);
  const [showGuideLines, setShowGuideLinesState] = useState<boolean>(() =>
    readStoredGuideLines()
  );
  const [criterionAnnouncement, setCriterionAnnouncement] = useState<string>("");
  const editButtonRef = useRef<HTMLButtonElement>(null);

  const releaseMutation = useReleaseSubmission();
  const { mutateAsync: submitManualScoreAsync } = useSubmitManualScore();
  const { data: activityWorkStates } = useActivityWork(submission.activity_id);
  const currentWork = activityWorkStates?.find((row) => row.student_id === submission.student_id);
  const isSubmissionActive = currentWork?.active_submission_id === submission.id;
  const isSubmissionCompleted = submission.status === "completed";
  const canReleaseSubmission = Boolean(
    isSubmissionCompleted &&
      isSubmissionActive &&
      !submission.released_at
  );

  const handleSaveAndReleaseRubric = useCallback(
    async (scores: {
      letter_formation_band: ScoreBand;
      size_consistency_band: ScoreBand;
      spacing_band: ScoreBand | null;
      slant_band: ScoreBand;
      baseline_alignment_band: ScoreBand;
    }) => {
      await submitManualScoreAsync({
        submissionId: submission.id,
        scores,
      });
      await releaseMutation.mutateAsync(submission.id);
      setIsEditingRubric(false);
      setIsRubricDirty(false);
      toast.add({ type: "success", title: "Assessment recorded and released to parent." });
    },
    [submission.id, submitManualScoreAsync, releaseMutation]
  );

  useEffect(() => {
    if (!isRubricDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRubricDirty]);

  const handleProtectedClose = useCallback(() => {
    if (isRubricDirty) {
      setIsConfirmingClose(true);
      return;
    }
    onClose?.();
  }, [isRubricDirty, onClose]);

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
    return calculateCompositeRubric(submission.manual_score, {
      nullSpacingIsNotApplicable: true,
    });
  }, [submission.manual_score]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const scrollTop = scrollContainerRef.current.scrollTop;
    setIsScrolledPastInspector(scrollTop > 140);
  }, []);

  // Track inspector visibility on mobile/tablet page view so teachers get a sticky preview bar without scroll-time layout reads
  useEffect(() => {
    if (variant !== "page") return;
    const el = worksheetColumnRef.current;
    if (!el || typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    let observer: IntersectionObserver | null = null;

    const setupObserver = () => {
      observer?.disconnect();
      observer = null;
      if (!mediaQuery.matches) {
        setIsScrolledPastInspector(false);
        return;
      }
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          setIsScrolledPastInspector(
            !entry.isIntersecting && entry.boundingClientRect.bottom < 72
          );
        },
        { rootMargin: "-72px 0px 0px 0px", threshold: 0 }
      );
      observer.observe(el);
    };

    setupObserver();
    mediaQuery.addEventListener("change", setupObserver);
    return () => {
      mediaQuery.removeEventListener("change", setupObserver);
      observer?.disconnect();
    };
  }, [variant]);

  const {
    data: imageUrl,
    isLoading: isImageLoading,
    isError: isImageError,
    refetch: refetchImage,
  } = useSubmissionImageUrl(submission.image_path ?? null);

  const handleRetryImage = useCallback(() => {
    void refetchImage();
  }, [refetchImage]);

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
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const isPrev =
        e.key === "ArrowLeft" ||
        e.key === "Left" ||
        e.key === "k" ||
        e.key === "K";
      const isNext =
        e.key === "ArrowRight" ||
        e.key === "Right" ||
        e.key === "j" ||
        e.key === "J";

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
        target?.closest?.('[data-slot="toggle-group"]') ||
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
      toast.add({ type: "success", title: "Attempt deleted" });
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
      if (err instanceof ApiError) {
        if (err.code === "SUBMISSION_NOT_FOUND") {
          toast.add({ type: "error", title: "This submission is no longer available." });
        } else {
          toast.add({ type: "error", title: err.message || "Could not delete this attempt." });
        }
      } else {
        toast.add({ type: "error", title: "Could not delete this attempt. Please try again." });
      }
    }
  };

  const handleNavigateNextStudent = useCallback(() => {
    if (canGoNext && submissions) {
      requestNavigate(submissions[effectiveIndex + 1]);
    }
  }, [canGoNext, submissions, effectiveIndex, requestNavigate]);

  const measurement = submission.measurement;
  const compositeScore = measurement?.composite_score;

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

  const { topStrength, practiceFocus } = useMemo(() => {
    if (!hasCalibratedScores || !measurement) {
      return { topStrength: null, practiceFocus: null };
    }
    const scores = {
      letter_formation: measurement.letter_formation_score,
      size_consistency: measurement.size_consistency_score,
      spacing: measurement.spacing_score,
      slant: measurement.slant_score,
      baseline_alignment: measurement.baseline_alignment_score,
    };
    const bands = {
      letter_formation: getBandFromScore(measurement.letter_formation_score),
      size_consistency: getBandFromScore(measurement.size_consistency_score),
      spacing: getBandFromScore(measurement.spacing_score),
      slant: getBandFromScore(measurement.slant_score),
      baseline_alignment: getBandFromScore(measurement.baseline_alignment_score),
    };
    return computeStrengthAndFocus(scores, bands);
  }, [hasCalibratedScores, measurement]);

  // Smart default: Automatically spotlight the student's weakest criterion to avoid visual noise
  const activeOverlayCriterion: CriterionFilter = useMemo(() => {
    if (activeCriterionOverride && activeCriterionOverride.submissionId === submission.id) {
      return activeCriterionOverride.criterion;
    }
    const weakest = diagnosticOverlay?.summary?.weakest_criterion as CriterionFilter | undefined;
    if (weakest && weakest in CRITERION_FILTER_TO_NAME) {
      return weakest;
    }
    if (practiceFocus?.key) {
      return practiceFocus.key;
    }
    return "all";
  }, [activeCriterionOverride, submission.id, diagnosticOverlay, practiceFocus]);

  const selectedCriterion: string | null = useMemo(() => {
    if (selectedCriterionOverride && selectedCriterionOverride.submissionId === submission.id) {
      return selectedCriterionOverride.name;
    }
    if (activeOverlayCriterion !== "all") {
      return CRITERION_FILTER_TO_NAME[activeOverlayCriterion] ?? null;
    }
    return null;
  }, [selectedCriterionOverride, submission.id, activeOverlayCriterion]);

  const [selectedAttentionItem, setSelectedAttentionItem] =
    useState<ActiveAnnotationHover | null>(null);

  const setActiveOverlayCriterion = useCallback(
    (criterion: CriterionFilter) => {
      setSelectedAttentionItem(null);
      setActiveCriterionOverride({ submissionId: submission.id, criterion });
    },
    [submission.id]
  );

  const handleSelectCriterion = useCallback(
    (criterionName: string | null) => {
      setSelectedCriterionOverride({ submissionId: submission.id, name: criterionName });
      if (criterionName) {
        const mapped = CRITERION_NAME_TO_FILTER[criterionName];
        if (mapped) {
          setActiveOverlayCriterion(mapped);
        }
        setCriterionAnnouncement(
          `${criterionName} selected. Diagnostic guide and coaching tips updated.`
        );
      } else {
        setActiveOverlayCriterion("all");
        setCriterionAnnouncement("All writing marks shown.");
      }
    },
    [submission.id, setActiveOverlayCriterion]
  );

  const handleChangeOverlayCriterion = useCallback(
    (c: CriterionFilter) => {
      setActiveOverlayCriterion(c);
      const items = getAttentionItems(diagnosticOverlay, c);
      if (c !== "all" && items.length > 0) {
        setSelectedAttentionItem(items[0]);
      } else {
        setSelectedAttentionItem(null);
      }
      const name = CRITERION_FILTER_TO_NAME[c] ?? null;
      setSelectedCriterionOverride({ submissionId: submission.id, name });
      if (name) {
        setCriterionAnnouncement(`Selected ${name} on writing marks overlay`);
      } else {
        setCriterionAnnouncement("Showing all writing marks");
      }
    },
    [submission.id, diagnosticOverlay, setActiveOverlayCriterion]
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

  const resolvedActivityTitle = useMemo(() => {
    if (activityTitle && !isUuid(activityTitle)) {
      return activityTitle.trim();
    }
    return null;
  }, [activityTitle]);

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
  const criteria = useMemo((): Array<{
    key: CriterionKey;
    name: string;
    score: number | null | undefined;
    band: ScoreBand | null;
  }> => {
    if (submission.status === "rejected") return [];
    return [
      {
        key: "letter_formation",
        name: "Letter Formation",
        score: measurement?.letter_formation_score,
        band: getBandFromScore(measurement?.letter_formation_score),
      },
      {
        key: "size_consistency",
        name: "Size Consistency",
        score: measurement?.size_consistency_score,
        band: getBandFromScore(measurement?.size_consistency_score),
      },
      {
        key: "spacing",
        name: "Spacing",
        score: measurement?.spacing_score,
        band: getBandFromScore(measurement?.spacing_score),
      },
      {
        key: "slant",
        name: "Slant Angle",
        score: measurement?.slant_score,
        band: getBandFromScore(measurement?.slant_score),
      },
      {
        key: "baseline_alignment",
        name: "Baseline Alignment",
        score: measurement?.baseline_alignment_score,
        band: getBandFromScore(measurement?.baseline_alignment_score),
      },
    ];
  }, [measurement, submission.status]);

  const compositeBandMeta = useMemo(() => {
    const band = getBandFromScore(compositeScore);
    return band ? getBandMeta(band) : null;
  }, [compositeScore]);

  const handleReupload = () => {
    if (variant === "modal") {
      onClose?.();
    }
    openUpload({
      activityId: submission.activity_id,
      studentId: submission.student_id,
    });
  };

  const spacingNotApplicableReason = useMemo(() => {
    const reason = diagnosticOverlay?.spacing?.not_applicable_reason;
    if (reason) return reason;
    if (
      (hasCalibratedScores && measurement?.spacing_score == null) ||
      (submission.manual_score && submission.manual_score.spacing_band == null) ||
      (measurement && measurement.word_spacing_mean == null && measurement.raw_output != null)
    ) {
      return "Single-word sample — no word spacing to evaluate";
    }
    return null;
  }, [
    diagnosticOverlay?.spacing?.not_applicable_reason,
    hasCalibratedScores,
    measurement,
    submission.manual_score,
  ]);

  const activeCriterionInfo = selectedCriterion
    ? CRITERIA_GUIDE[selectedCriterion]
    : null;

  const isDesktopGuideRendered = Boolean(
    !hasCalibratedScores &&
    rightPaneTab === "metrics" &&
    selectedCriterion &&
    activeCriterionInfo
  );

  const pagerControl =
    hasMultipleSubmissions && submissions && onNavigate ? (
      <ButtonGroup aria-label="Student navigation" className="shrink-0">
        <Button
          ref={prevButtonRef}
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!canGoPrev}
          onClick={() => {
            if (canGoPrev && submissions) {
              requestNavigate(submissions[effectiveIndex - 1]);
            }
          }}
          className="size-10 sm:size-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Previous student (Key: K or ←)"
          title="Previous student (← / K)"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <ButtonGroupText
          className="bg-muted/50 px-2.5 text-xs text-muted-foreground tabular-nums select-none whitespace-nowrap"
          aria-live="polite"
          aria-atomic="true"
        >
          {effectiveIndex + 1} of {submissions.length}
        </ButtonGroupText>
        <Button
          ref={nextButtonRef}
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={!canGoNext}
          onClick={() => {
            if (canGoNext && submissions) {
              requestNavigate(submissions[effectiveIndex + 1]);
            }
          }}
          className="size-10 sm:size-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Next student (Key: J or →)"
          title="Next student (→ / J)"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </ButtonGroup>
    ) : null;

  const moreActionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={deleteMutation.isPending}
            className="size-10 sm:size-8 rounded-lg border-border/70 text-muted-foreground hover:text-foreground shrink-0"
            aria-label="More submission actions"
            title="More submission actions"
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-xl p-1">
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="rounded-lg px-2.5 py-2 text-xs cursor-pointer"
          >
            <Trash2 data-icon="inline-start" aria-hidden="true" />
            <span>Delete Attempt</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Render header content based on variant and viewport tier
  const headerContent = (
    <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center justify-between gap-x-3 gap-y-2.5 w-full">
      {/* Student Name and Upload Metadata */}
      <div className="min-w-0 flex-1 order-1">
        <div className="flex items-center gap-2 flex-wrap">
          {variant === "modal" ? (
            <ResponsiveRichOverlayTitle className="font-heading text-base sm:text-xl font-semibold tracking-tight text-foreground truncate">
              {submission.student?.full_name ?? "Student"}
            </ResponsiveRichOverlayTitle>
          ) : (
            <h1 className="font-heading text-base sm:text-xl md:text-2xl font-semibold tracking-tight text-foreground truncate">
              {submission.student?.full_name ?? "Student"}
            </h1>
          )}
          <SubmissionLifecycleControls submission={submission} variant="header" />
        </div>
        {variant === "modal" ? (
          <ResponsiveRichOverlayDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-x-1.5 gap-y-0.5 flex-wrap">
            <span className="shrink-0">
              Uploaded by{" "}
              {submission.uploader_role === "parent" ? "Parent" : "Teacher"}
            </span>
            <span className="text-muted-foreground/60" aria-hidden="true">
              &middot;
            </span>
            <time
              dateTime={submission.created_at}
              title={formatDateFull(submission.created_at)}
              className="tabular-nums shrink-0"
            >
              {formatDateFull(submission.created_at)}
            </time>
          </ResponsiveRichOverlayDescription>
        ) : (
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-x-1.5 gap-y-0.5 flex-wrap">
            <span className="shrink-0">
              Uploaded by{" "}
              {submission.uploader_role === "parent" ? "Parent" : "Teacher"}
            </span>
            <span className="text-muted-foreground/60" aria-hidden="true">
              &middot;
            </span>
            <time
              dateTime={submission.created_at}
              title={formatDateFull(submission.created_at)}
              className="tabular-nums shrink-0"
            >
              {formatDateFull(submission.created_at)}
            </time>
          </div>
        )}
      </div>

      {/* Student pager wraps below metadata on small screens; stays inline on sm+ */}
      {pagerControl && (
        <div className="order-3 w-full sm:w-auto sm:order-2 flex items-center shrink-0">
          {pagerControl}
        </div>
      )}

      {/* Overflow actions stay pinned to top-right on row 1 at every viewport */}
      <div className="order-2 sm:order-3 shrink-0 flex items-center">
        {moreActionsMenu}
      </div>
    </div>
  );

  return (
    <div
      data-page-studio={variant === "page" ? "true" : undefined}
      data-rubric-editing={isEditingRubric ? "true" : undefined}
      className={cn("w-full flex flex-col gap-0", variant === "modal" ? "flex-1 min-h-0" : "")}
    >
      {/* Screen reader live announcement region for criterion selection */}
      <div className="sr-only" role="status" aria-live="polite">
        {criterionAnnouncement}
      </div>

      {/* Top Back Navigation Trail for Page View */}
      {variant === "page" && onClose && (
        <nav aria-label="Breadcrumb navigation" className="print:hidden pb-1 -ml-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleProtectedClose}
            className="text-xs text-muted-foreground hover:text-foreground font-medium group rounded-lg px-2 py-1.5 h-auto min-h-10 sm:min-h-8 hover:bg-muted/50"
          >
            <ArrowLeft
              data-icon="inline-start"
              className="transition-transform group-hover:-translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
              aria-hidden="true"
            />
            <span className="truncate max-w-xs sm:max-w-md">
              {resolvedActivityTitle ? `Back to ${resolvedActivityTitle}` : "Back to Activity"}
            </span>
          </Button>
        </nav>
      )}

      {/* Header */}
      {variant === "modal" ? (
        <ResponsiveRichOverlayHeader className="pb-2.5 sm:pb-3 shrink-0 text-left">
          {headerContent}
        </ResponsiveRichOverlayHeader>
      ) : (
        <header className="pb-2.5 sm:pb-3">
          {headerContent}
        </header>
      )}
      <Separator />

      {/* Body: Split view (Image + Diagnostic details & Comments) */}
      <div
        ref={variant === "modal" ? scrollContainerRef : undefined}
        onScroll={variant === "modal" ? handleScroll : undefined}
        className={cn(
          "flex flex-col gap-3 sm:gap-3.5",
          variant === "modal"
            ? "flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain py-2.5 sm:py-3"
            : "py-2.5 sm:py-3.5"
        )}
      >
        {/* Returned Worksheet Alert Banner (only visible when attempt is returned) */}
        <SubmissionReturnedAlert submission={submission} />

        {/* Mobile Sticky Preview Bar (< lg screens, both modal and page views) */}
        {isScrolledPastInspector && (
          <Card
            size="sm"
            className={cn(
              "sticky top-0 z-20 lg:hidden py-0 bg-card/95 backdrop-blur-md shadow-warm-sm animate-in fade-in slide-in-from-top-2 duration-150 motion-reduce:animate-none",
              variant === "page" && "top-14"
            )}
          >
            <CardContent className="flex items-center justify-between gap-3 py-2 px-3 sm:px-4">
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
                      variant="destructive"
                      className="text-[10px] px-2 py-0.5 shrink-0 font-semibold"
                    >
                      Photo Rejected
                    </Badge>
                  ) : selectedCriterion ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 truncate"
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
                className="min-h-11 h-11 sm:h-9 px-3 text-xs rounded-lg shrink-0 font-medium"
              >
                <Eye data-icon="inline-start" aria-hidden="true" />
                <span>View Image</span>
              </Button>
            </CardContent>
          </Card>
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
              priority={variant === "page"}
              collapsibleImageTools
              flatFrame={true}
              diagnosticToolbar={
                diagnosticOverlay ? (
                  <CalmOverlayToolbar
                    overlay={diagnosticOverlay}
                    activeCriterion={activeOverlayCriterion}
                    onChangeCriterion={handleChangeOverlayCriterion}
                    visible={showOverlay}
                    onToggleVisible={setShowOverlay}
                    selectedAttentionId={selectedAttentionItem?.id}
                    onSelectAttentionItem={setSelectedAttentionItem}
                    showGuideLines={showGuideLines}
                    onToggleGuideLines={toggleGuideLines}
                    hasGuideLines={Boolean(guideLines)}
                    isParentView={false}
                    showStepper={true}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-2 w-full">
                    <DiagnosticFallbackBanner
                      scoreSource={
                        hasCalibratedScores
                          ? "calibrated"
                          : submission.manual_score
                            ? "manual"
                            : "none"
                      }
                      className="border-none bg-transparent p-0 shadow-none flex-1 min-w-0"
                    />
                    {guideLines && (
                      <Toggle
                        size="sm"
                        pressed={showGuideLines}
                        onPressedChange={toggleGuideLines}
                        className="h-auto min-h-10 sm:min-h-8 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 aria-pressed:bg-primary/15 aria-pressed:text-primary shrink-0"
                        title="Toggle 3-line penmanship paper guides"
                      >
                        <span className="hidden sm:inline">Paper lines</span>
                        <span className="sm:hidden">Lines</span>
                      </Toggle>
                    )}
                  </div>
                )
              }
                showShortcutsLegend={false}
                onRetry={handleRetryImage}
                className="flex-1 flex flex-col min-h-0"
                aspectRatioClass={
                  variant === "page"
                    ? "max-h-[min(760px,calc(100dvh-10rem))] min-h-[300px] sm:min-h-[340px] lg:min-h-[460px]"
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
              <Card size="sm" className="shrink-0 py-2 shadow-2xs">
                <CardContent className="flex flex-col gap-2 px-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-foreground shrink-0">Target prompt:</span>
                    <span className="font-medium text-foreground truncate">
                      {resolvedTargetText ? `"${resolvedTargetText}"` : "Cursive Penmanship Practice"}
                    </span>
                  </div>

                  {casingMismatches.length > 0 && (
                    <Alert className="border-warning/30 bg-warning/10 px-2.5 py-2 text-xs text-warning-foreground">
                      <Info aria-hidden="true" />
                      <AlertDescription className="text-xs leading-tight text-warning-foreground">
                        <strong className="font-semibold">Capitalization Note:</strong>{" "}
                        {casingMismatches.map((m, idx) => (
                          <span key={idx}>
                            {idx > 0 && ", "}
                            expected &quot;{m.expected}&quot;, recognized &quot;{m.detected}&quot;
                          </span>
                        ))}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Diagnostic Assessment Details & Comments */}
            <div className="lg:col-span-6 flex flex-col justify-between gap-3">
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

                const desktopGuideCard =
                  isDesktopGuideRendered && activeCriterionInfo ? (
                    <Alert
                      id="criterion-diagnostic-guide"
                      className="hidden lg:grid border-primary/25 bg-primary/5 text-xs sm:text-sm animate-in fade-in-50 duration-200 motion-reduce:animate-none"
                    >
                      <Info aria-hidden="true" />
                      <AlertTitle className="text-xs sm:text-sm font-semibold text-foreground">
                        {selectedCriterion}
                      </AlertTitle>
                      <AlertDescription className="flex flex-col gap-1 text-xs sm:text-sm text-foreground/85 [&>p:not(:last-child)]:mb-0">
                        {selectedCriterion === "Spacing" && spacingNotApplicableReason && (
                          <p className="text-muted-foreground font-medium leading-relaxed">
                            {spacingNotApplicableReason}
                          </p>
                        )}
                        <p className="leading-relaxed">{activeCriterionInfo.rubricGoal}</p>
                        <p className="text-primary leading-relaxed">
                          <strong>Tip:</strong> {activeCriterionInfo.coachingTip}
                        </p>
                      </AlertDescription>
                    </Alert>
                  ) : null;

                return (
                  <Tabs
                    value={effectiveTab}
                    onValueChange={(value) =>
                      setRightPaneTab(value as "rubric" | "metrics" | "comments")
                    }
                    className="gap-3"
                  >
                    <TabsList
                      aria-label="Submission review panels"
                      activateOnFocus
                      className="w-full group-data-horizontal/tabs:h-auto flex items-center p-1 sm:p-1.5 rounded-xl bg-muted/60 border border-border/80 gap-1 sm:gap-1.5"
                    >
                      {tabs.map((tab) => (
                        <TabsTrigger
                          key={tab.id}
                          value={tab.id}
                          id={`submission-tab-${tab.id}`}
                          aria-controls={`submission-tabpanel-${tab.id}`}
                          className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-4 group-data-[variant=default]/tabs-list:h-auto group-data-[variant=default]/tabs-list:rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer min-h-11 sm:min-h-0 touch-manipulation data-active:bg-card data-active:text-foreground data-active:shadow-xs data-active:border-border/60!"
                        >
                          <span className="truncate">{tab.label}</span>
                          {tab.id === "comments" && hasUnreadComments && (
                            <Badge
                              variant="secondary"
                              className="h-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] sm:text-xs font-bold text-primary shrink-0"
                            >
                              Unread
                            </Badge>
                          )}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {/* COMMENTS TAB PANEL (Worksheet remains pinned on left!) */}
                    <TabsContent value="comments" id="submission-tabpanel-comments">
                      <Card className="py-0 overflow-hidden flex flex-col min-h-80 shadow-xs">
                        <CardContent className="p-0 flex flex-col flex-1 min-h-0">
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
                              compactHeader
                              open
                            />
                          ) : (
                            <div className="p-4 flex flex-col gap-3" role="status" aria-label="Loading conversation">
                              <Skeleton className="h-6 w-48 rounded-md" />
                              <Skeleton className="h-16 w-full rounded-xl" />
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* ASSESSMENT / RUBRIC PANEL */}
                    <TabsContent
                      value="rubric"
                      id="submission-tabpanel-rubric"
                      className="flex flex-col gap-2.5"
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
                        <Empty className="border border-warning/30 bg-warning/10 p-5 sm:p-6">
                          <EmptyMedia variant="icon" className="bg-warning/20 text-warning-foreground">
                            <Spinner />
                          </EmptyMedia>
                          <EmptyHeader>
                            <EmptyTitle className="text-sm font-semibold">
                              Analyzing Handwriting
                            </EmptyTitle>
                            <EmptyDescription className="text-xs">
                              Evaluating letter formation, spacing, slant, and baseline alignment.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      )}

                      {/* COMPLETED STATE */}
                      {(submission.status === "completed" || submission.status === "returned") && (
                        <div className="flex flex-col gap-2.5">
                          {hasCalibratedScores ? (
                            <div className="flex flex-col gap-4">
                              {/* Phase 2: Overall Composite Score Card */}
                              <Card size="sm" className="border-border/80 shadow-none gap-2.5">
                                <CardHeader className="items-center">
                                  <CardTitle
                                    as="h3"
                                    className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground truncate"
                                  >
                                    {compositeBandMeta && (
                                      <span
                                        className={cn("size-2.5 rounded-full shrink-0", compositeBandMeta.dotColor)}
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span className="truncate">
                                      {compositeBandMeta?.label ?? "Overall Score"}
                                    </span>
                                  </CardTitle>
                                  {compositeScore !== null && compositeScore !== undefined && (
                                    <CardAction>
                                      <Badge
                                        variant="outline"
                                        className="h-auto rounded-md text-xs font-semibold font-sans tabular-nums text-muted-foreground bg-muted/60 px-2 py-0.5 border-border/60 shrink-0"
                                      >
                                        {Math.round(compositeScore)}% overall
                                      </Badge>
                                    </CardAction>
                                  )}
                                </CardHeader>
                                {compositeScore !== null && compositeScore !== undefined && (
                                  <CardContent>
                                    <BandPositionBar
                                      score={compositeScore}
                                      height="sm"
                                      showBandLabels={false}
                                      showThresholds={true}
                                      ariaLabel={`Overall score: ${Math.round(compositeScore)}%`}
                                      ariaValueText={`${Math.round(compositeScore)}% overall`}
                                    />
                                  </CardContent>
                                )}
                              </Card>

                              {/* Phase 2: Unified Skill Breakdown Card */}
                              <Card className="border-border/80 shadow-none py-0 gap-0">
                                <CardHeader className="py-3 border-b border-border/60">
                                  <CardTitle as="h3" className="text-sm font-semibold text-foreground">
                                    Skill breakdown
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 divide-y divide-border/60">
                                  {criteria.map((c) => {
                                    const isCriterionNA = c.score === null || c.score === undefined;
                                    const isSelected = selectedCriterion === c.name;
                                    const isTop = topStrength?.key === c.key;
                                    const isFocus = practiceFocus?.key === c.key;
                                    const highlightBadge = isTop
                                      ? "top_strength"
                                      : isFocus
                                        ? "practice_focus"
                                        : null;
                                    const alertCount = criterionAttentionCounts[c.name] ?? 0;
                                    const guide = CRITERIA_GUIDE[c.name];

                                    return (
                                      <CriterionFeedbackRow
                                        key={c.key}
                                        criterionKey={c.key}
                                        label={c.name}
                                        score={c.score ?? null}
                                        band={c.band}
                                        notApplicable={isCriterionNA}
                                        highlightBadge={highlightBadge}
                                        subtitleMeta={
                                          alertCount > 0 ? (
                                            <span className="text-xs font-medium text-band-1-text tabular-nums">
                                              {alertCount} {alertCount === 1 ? "alert" : "alerts"}
                                            </span>
                                          ) : null
                                        }
                                        isActive={isSelected}
                                        showDiagnosticNote={isSelected}
                                        showPositionBar={false}
                                        notApplicableNote={
                                          c.name === "Spacing" && isCriterionNA
                                            ? spacingNotApplicableReason
                                            : null
                                        }
                                        diagnosticNoteOverride={guide?.rubricGoal ?? null}
                                        tipLabel="Coaching tip:"
                                        homePracticeTip={guide?.coachingTip ?? null}
                                        onInspect={() => {
                                          handleSelectCriterion(isSelected ? null : c.name);
                                        }}
                                      />
                                    );
                                  })}
                                </CardContent>
                              </Card>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-4">
                              {submission.manual_score && (!isEditingRubric || !canEditRubric) ? (
                                <>
                                  {/* READ-ONLY / CONFIRMED RUBRIC STATE */}
                                  <Card size="sm" className="border-border/80 shadow-none gap-2.5">
                                    <CardHeader className="items-center">
                                      <CardTitle
                                        as="h3"
                                        className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground truncate"
                                      >
                                        {recordedComposite && (
                                          <span
                                            className={cn(
                                              "size-2.5 rounded-full shrink-0",
                                              recordedComposite.overallBandMeta.dotColor
                                            )}
                                            aria-hidden="true"
                                          />
                                        )}
                                        <span className="truncate">
                                          {recordedComposite?.overallBandMeta.label ?? "Teacher Benchmark"}
                                        </span>
                                      </CardTitle>
                                      <CardAction className="flex items-center gap-2 shrink-0">
                                        {recordedComposite && (
                                          <Badge
                                            variant="outline"
                                            className="h-auto rounded-md text-xs font-semibold font-sans tabular-nums text-muted-foreground bg-muted/60 px-2 py-0.5 border-border/60"
                                          >
                                            {recordedComposite.isComplete
                                              ? `${recordedComposite.totalPoints}/${recordedComposite.maxPoints} pts · ${recordedComposite.avgPercentage}%`
                                              : `${recordedComposite.totalPoints}/${recordedComposite.maxPoints} pts`}
                                          </Badge>
                                        )}
                                        {canEditRubric && (
                                          <Button
                                            ref={editButtonRef}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsEditingRubric(true)}
                                            className="h-10 sm:h-7 min-h-10 sm:min-h-0 px-3 sm:px-2.5 text-xs rounded-lg text-primary border-primary/30 hover:bg-primary/10 shrink-0 font-medium"
                                            aria-label="Edit recorded rubric scores"
                                          >
                                            <Edit3 data-icon="inline-start" aria-hidden="true" />
                                            <span>Edit</span>
                                          </Button>
                                        )}
                                      </CardAction>
                                    </CardHeader>
                                    {recordedComposite?.isComplete && (
                                      <CardContent>
                                        <BandPositionBar
                                          score={recordedComposite.avgPercentage}
                                          height="sm"
                                          showBandLabels={false}
                                          showThresholds={true}
                                          ariaLabel={`Teacher benchmark score: ${recordedComposite.avgPercentage}%`}
                                          ariaValueText={`${recordedComposite.avgPercentage}% overall`}
                                        />
                                      </CardContent>
                                    )}
                                  </Card>

                                  <Card
                                    role="group"
                                    aria-label="Recorded criterion breakdown"
                                    className="border-border/80 shadow-none py-0 gap-0"
                                  >
                                    <CardHeader className="py-3 border-b border-border/60">
                                      <CardTitle as="h3" className="text-sm font-semibold text-foreground">
                                        Skill breakdown
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 divide-y divide-border/60">
                                      {RUBRIC_CRITERIA.map((criterion) => {
                                        const bandValue =
                                          submission.manual_score?.[criterion.key] ?? null;
                                        const isSpacingNA =
                                          criterion.key === "spacing_band" && bandValue == null;
                                        const isSelected =
                                          selectedCriterion === criterion.shortName;
                                        const attentionCount =
                                          criterionAttentionCounts[criterion.shortName] ??
                                          criterionAttentionCounts[criterion.name] ??
                                          0;
                                        const metric = extractCriterionCVMetric(
                                          criterion.key,
                                          submission.measurement
                                        );
                                        const guide = CRITERIA_GUIDE[criterion.shortName];
                                        const criterionKey = criterion.key.replace(/_band$/, "") as CriterionKey;

                                        return (
                                          <CriterionFeedbackRow
                                            key={criterion.key}
                                            criterionKey={criterionKey}
                                            label={criterion.shortName}
                                            score={null}
                                            band={isSpacingNA ? null : bandValue}
                                            notApplicable={isSpacingNA}
                                            subtitleMeta={
                                              metric || attentionCount > 0 ? (
                                                <>
                                                  {metric && (
                                                    <Badge
                                                      variant="outline"
                                                      className={cn(
                                                        "h-auto gap-1 px-1.5 py-0.5 rounded text-[11px] font-sans font-medium tabular-nums",
                                                        metric.badgeClass
                                                      )}
                                                      title={`CV Measurement: ${metric.value} (${metric.target}) - ${metric.status}`}
                                                    >
                                                      <span
                                                        className={cn("size-1.5 rounded-full", metric.dotClass)}
                                                        aria-hidden="true"
                                                      />
                                                      <span>{metric.value}</span>
                                                    </Badge>
                                                  )}
                                                  {attentionCount > 0 && (
                                                    <span className="text-xs font-medium text-band-1-text tabular-nums">
                                                      {attentionCount}{" "}
                                                      {attentionCount === 1 ? "alert" : "alerts"}
                                                    </span>
                                                  )}
                                                </>
                                              ) : null
                                            }
                                            isActive={isSelected}
                                            showDiagnosticNote={isSelected}
                                            showPositionBar={false}
                                            notApplicableNote={
                                              isSpacingNA ? spacingNotApplicableReason : null
                                            }
                                            diagnosticNoteOverride={guide?.rubricGoal ?? null}
                                            tipLabel="Coaching tip:"
                                            homePracticeTip={guide?.coachingTip ?? null}
                                            onInspect={() => {
                                              handleSelectCriterion(
                                                isSelected ? null : criterion.shortName
                                              );
                                            }}
                                          />
                                        );
                                      })}
                                    </CardContent>
                                  </Card>
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
                                  onFocusCriterion={handleSelectCriterion}
                                  canGoNext={canGoNext}
                                  canRelease={canReleaseSubmission}
                                  onSaveAndRelease={handleSaveAndReleaseRubric}
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
                                <Alert role="status">
                                  <Info aria-hidden="true" />
                                  <AlertDescription className="text-xs">
                                    {scoringEngine.isPending || scoringEngine.isFetching
                                      ? "Checking the active scoring mode…"
                                      : scoringEngine.isError
                                        ? "Rubric editing is unavailable because the scoring mode could not be confirmed."
                                        : "Manual rubric scoring is unavailable while calibrated scoring is active."}
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          )}

                          {/* Focused Criterion Diagnostic Insight Card (Desktop view >=lg; mobile/tablet handled inline) */}
                          {desktopGuideCard}
                        </div>
                      )}
                    </TabsContent>

                    {/* PHYSICAL RAW CV MEASUREMENTS PANEL */}
                    {showMetricsTab && (
                      <TabsContent
                        value="metrics"
                        id="submission-tabpanel-metrics"
                        className="flex flex-col gap-2.5"
                      >
                        <RawMeasurementsTable
                          measurement={measurement}
                          selectedCriterion={selectedCriterion}
                          onSelectCriterion={handleSelectCriterion}
                        />

                        {/* Focused Criterion Diagnostic Insight Card (Desktop view >=lg; mobile/tablet handled inline) */}
                        {desktopGuideCard}
                      </TabsContent>
                    )}
                  </Tabs>
                );
              })()}

              {/* Unified Right-Column Lifecycle Dock (hidden on Comments tab and during active rubric editing) */}
              {(() => {
                if (rightPaneTab === "comments") return null;
                const isRubricFormOpen =
                  !hasCalibratedScores &&
                  canEditRubric &&
                  (!submission.manual_score || isEditingRubric);

                return (
                  <div className="flex flex-col gap-2.5 pt-1">
                    {!isRubricFormOpen && (
                      <SubmissionLifecycleControls
                        submission={submission}
                        showRelease
                        variant="completion"
                        onNavigateNext={canGoNext && submissions ? handleNavigateNextStudent : undefined}
                      />
                    )}
                    {variant === "page" && isSubmissionCompleted && (
                      <Card size="sm" className="py-2.5 bg-muted/25 shadow-none">
                        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 sm:px-3.5">
                          <p className="text-xs text-muted-foreground leading-snug">
                            Need another photo? Returning keeps this attempt in history.
                          </p>
                          <SubmissionLifecycleControls
                            submission={submission}
                            showRelease={false}
                            variant="actions"
                            className="shrink-0"
                          />
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      {/* Footer (Modal Only) */}
      {variant === "modal" ? (
        <>
          <Separator />
          <ResponsiveRichOverlayFooter className="pt-3 sm:pt-3.5 shrink-0 flex flex-row items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <SubmissionLifecycleControls submission={submission} showRelease={false} variant="actions" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleProtectedClose}
              className="h-11 sm:h-9 min-h-11 sm:min-h-0 px-3.5 text-xs font-medium rounded-lg ml-auto"
            >
              Close
            </Button>
          </ResponsiveRichOverlayFooter>
        </>
      ) : null}

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
              className="min-h-11 sm:min-h-9 rounded-lg"
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
              className="min-h-11 sm:min-h-9 rounded-lg cursor-pointer"
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
              className="min-h-11 sm:min-h-9 rounded-lg"
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
              className="min-h-11 sm:min-h-9 rounded-lg gap-2 cursor-pointer"
            >
              {deleteMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" aria-hidden="true" />
                  <span>Deleting...</span>
                </>
              ) : (
                "Delete Attempt"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved Rubric Close/Back Guard Dialog */}
      <AlertDialog
        open={isConfirmingClose}
        onOpenChange={(isOpen) => {
          if (!isOpen) setIsConfirmingClose(false);
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
              . Leaving this worksheet will discard your changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setIsConfirmingClose(false)}
              className="min-h-11 sm:min-h-9 rounded-lg"
            >
              Stay here
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setIsConfirmingClose(false);
                setIsRubricDirty(false);
                onClose?.();
              }}
              className="min-h-11 sm:min-h-9 rounded-lg cursor-pointer"
            >
              Discard &amp; leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

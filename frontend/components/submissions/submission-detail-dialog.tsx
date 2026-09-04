"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import {
  type ScoreBand,
  type Submission,
  useSubmissionImageUrl,
  useSubmitManualScore,
} from "@/lib/hooks/use-submissions";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  GraduationCap,
  FileText,
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Award,
  Binary,
  Check,
  Loader2,
  ShieldCheck,
  CheckCheck,
  Edit3,
  Keyboard,
  HelpCircle,
  Layers,
  LayoutList,
  RotateCcw,
  SunMedium,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";

interface SubmissionDetailDialogProps {
  submission: Submission | null;
  submissions?: Submission[];
  currentIndex?: number;
  onNavigate?: (submission: Submission) => void;
  activityTargetText?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RejectionDetail {
  title: string;
  description: string;
  advice: string;
}

const DEFAULT_REJECTION_INFO: RejectionDetail = {
  title: "Worksheet Photo Needs Re-capture",
  description:
    "The quality verification check could not extract clear cursive strokes from this image.",
  advice:
    "Retake the worksheet photo flat from directly above under even, bright lighting.",
};

const REJECTION_GUIDE: Record<string, RejectionDetail> = {
  QUALITY_GATE_BLUR: {
    title: "Blurry or Out-of-Focus Photo",
    description:
      "The photo is too blurry to extract cursive letter strokes and baseline coordinates accurately.",
    advice:
      "Hold the camera steady, tap the screen to focus on the handwriting, and retake in clear light.",
  },
  QUALITY_GATE_BRIGHTNESS: {
    title: "Lighting Too Dark or Overexposed",
    description:
      "Heavy shadows or strong glare obscured the 3-line penmanship ruling and handwriting strokes.",
    advice:
      "Position the worksheet in bright, indirect natural or classroom light without overhead flash glare.",
  },
  QUALITY_GATE_CONTRAST: {
    title: "Low Contrast or Faint Pencil Strokes",
    description:
      "The handwriting strokes were too faint against the paper background for reliable contour analysis.",
    advice:
      "Ensure the student writes with a dark #2 pencil or pen, and adjust lighting to eliminate washed-out areas.",
  },
  QUALITY_GATE_RESOLUTION: {
    title: "Image Resolution Too Low",
    description:
      "The captured photo does not meet the minimum 1500px resolution needed for detailed stroke evaluation.",
    advice:
      "Move the camera closer to fill the frame with the worksheet page before taking the photo.",
  },
  SEGMENTATION_COUNT_MISMATCH: {
    title: "Word Count Mismatch",
    description:
      "The number of cursive words detected on the paper does not match the assigned prompt text.",
    advice:
      "Check that the student wrote the complete sentence without skipping words or adding extra lines.",
  },
  PIPELINE_ERROR: {
    title: "Diagnostic Processing Issue",
    description:
      "An unexpected processing issue occurred while segmenting cursive strokes.",
    advice:
      "Please retake the photo with the worksheet flat and all four corners clearly visible.",
  },
  // Legacy / fallback mappings for dev database backwards compatibility
  QUALITY_GATE_LIGHTING: {
    title: "Lighting Too Dark or Glare Present",
    description:
      "Heavy shadows or strong glare obscured the 3-line penmanship guidelines.",
    advice:
      "Position the worksheet in bright, indirect light without direct flash glare.",
  },
  QUALITY_GATE_SKEW: {
    title: "Worksheet Captured at an Angle",
    description:
      "The page was tilted too steeply for automated perspective correction.",
    advice:
      "Hold the camera parallel and directly above the paper for a flat, top-down view.",
  },
  QUALITY_GATE_OCCLUDED: {
    title: "Worksheet Lines or Text Covered",
    description:
      "Fingers, shadows, or folded edges covered the penmanship ruling lines.",
    advice:
      "Ensure all four corners and all written text remain completely unobstructed.",
  },
  QUALITY_GATE_NO_TEXT: {
    title: "No Handwriting Strokes Detected",
    description:
      "The system could not detect student handwriting marks on the ruling lines.",
    advice:
      "Verify the student used a dark pencil or pen and that the writing area is in frame.",
  },
};

const REJECTION_BADGE_LABELS: Record<string, string> = {
  QUALITY_GATE_BLUR: "Blur Detected",
  QUALITY_GATE_BRIGHTNESS: "Lighting / Glare",
  QUALITY_GATE_CONTRAST: "Low Contrast",
  QUALITY_GATE_RESOLUTION: "Low Resolution",
  SEGMENTATION_COUNT_MISMATCH: "Word Count Mismatch",
  PIPELINE_ERROR: "Processing Issue",
  QUALITY_GATE_LIGHTING: "Lighting / Glare",
  QUALITY_GATE_SKEW: "Tilted Angle",
  QUALITY_GATE_OCCLUDED: "Guidelines Covered",
  QUALITY_GATE_NO_TEXT: "No Handwriting Found",
};

const CRITERIA_GUIDE: Record<
  string,
  { rubricGoal: string; coachingTip: string }
> = {
  "Letter Formation": {
    rubricGoal:
      "OpenCV stroke curvature analysis evaluates ascender loop closures (b, d, h, k, l) and descender loops (g, j, p, q, y, z).",
    coachingTip:
      "Guide the student to connect cursive loops smoothly without disjointed strokes or incomplete oval closures.",
  },
  "Size Consistency": {
    rubricGoal:
      "Evaluates letter proportion relative to 3-line penmanship guidelines (headline, midline, baseline).",
    coachingTip:
      "Ensure lowercase x-height letters (a, c, e, m, n, o, r, s, u, v, w, x) reach precisely up to the dotted midline.",
  },
  Spacing: {
    rubricGoal:
      "Measures inter-word gaps and consistent spacing between connected cursive characters.",
    coachingTip:
      "Standard handwriting spacing should equal approximately one lowercase 'o' between letters and a two-finger gap between words.",
  },
  "Slant Angle": {
    rubricGoal:
      "Measures cursive stroke tilt consistency against the standard 60°–68° forward slant angle.",
    coachingTip:
      "Encourage the student to keep paper angled at 30°–45° on their desk to maintain parallel, uniform forward slant.",
  },
  "Baseline Alignment": {
    rubricGoal:
      "Evaluates stroke drift along the bottom solid ruling line across every word.",
    coachingTip:
      "Check that letters rest stably on the baseline without floating upward or sinking beneath the bottom guideline.",
  },
};

function getScoreBand(score: number | null | undefined): {
  label: string;
  className: string;
  dotColor: string;
} {
  if (score === null || score === undefined) {
    return {
      label: "Pending",
      className: "bg-muted/60 text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
    };
  }

  // Band 4 (80-100%): Deep Pine / Excellent
  if (score >= 80) {
    return {
      label: "Excellent",
      className:
        "bg-brand-50 text-brand-800 dark:bg-brand-950/80 dark:text-brand-300 border-brand-200/80 dark:border-brand-900",
      dotColor: "bg-brand-600 dark:bg-brand-400",
    };
  }
  // Band 3 (60-79%): Soft Olive / Satisfactory
  if (score >= 60) {
    return {
      label: "Satisfactory",
      className:
        "bg-[#7c9b6e]/15 text-[#2c4e22] dark:bg-[#7c9b6e]/20 dark:text-[#c4deba] border-[#7c9b6e]/40 dark:border-[#7c9b6e]/50",
      dotColor: "bg-[#7c9b6e]",
    };
  }
  // Band 2 (40-59%): Ochre Gold / Developing
  if (score >= 40) {
    return {
      label: "Developing",
      className:
        "bg-[#c9a227]/15 text-[#6e4e00] dark:bg-[#c9a227]/20 dark:text-[#fae59a] border-[#c9a227]/40 dark:border-[#c9a227]/50",
      dotColor: "bg-[#c9a227]",
    };
  }
  // Band 1 (0-39%): Clay Coral / Needs Improvement
  return {
    label: "Needs Improvement",
    className:
      "bg-[#b6754a]/15 text-[#733512] dark:bg-[#b6754a]/20 dark:text-[#f3c8aa] border-[#b6754a]/40 dark:border-[#b6754a]/50",
    dotColor: "bg-[#b6754a]",
  };
}

function getInitials(name: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTES = [
  "bg-amber-100 text-amber-900 border-amber-300/70 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800",
  "bg-emerald-100 text-emerald-900 border-emerald-300/70 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800",
  "bg-blue-100 text-blue-900 border-blue-300/70 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-800",
  "bg-purple-100 text-purple-900 border-purple-300/70 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-800",
  "bg-brand-100 text-brand-900 border-brand-300/70 dark:bg-brand-950/80 dark:text-brand-200 dark:border-brand-800",
  "bg-rose-100 text-rose-900 border-rose-300/70 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMetric(
  mean: number | null | undefined,
  std?: number | null | undefined,
  unit: string = ""
): string {
  if (mean === null || mean === undefined) return "—";
  const numMean = Number(mean);
  const formattedMean = Number.isInteger(numMean)
    ? numMean.toString()
    : numMean.toFixed(2);

  if (std !== null && std !== undefined) {
    const numStd = Number(std);
    const formattedStd = Number.isInteger(numStd)
      ? numStd.toString()
      : numStd.toFixed(2);
    return `${formattedMean} ± ${formattedStd}${unit ? ` ${unit}` : ""}`;
  }
  return `${formattedMean}${unit ? ` ${unit}` : ""}`;
}

const RUBRIC_BANDS: Array<{
  band: ScoreBand;
  label: string;
  shortLabel: string;
  shortcutKey: string;
  score: string;
  activeClass: string;
  badgeClass: string;
  dotColor: string;
}> = [
    {
      band: "needs_improvement",
      label: "Needs Improvement",
      shortLabel: "Needs Imp.",
      shortcutKey: "1",
      score: "12.5%",
      activeClass:
        "bg-[#b6754a]/15 dark:bg-[#b6754a]/30 text-[#733512] dark:text-[#f3c8aa] border-[#b6754a] ring-2 ring-[#b6754a]/40 shadow-xs font-semibold",
      badgeClass:
        "bg-[#b6754a]/15 text-[#733512] dark:text-[#f3c8aa] border-[#b6754a]/40",
      dotColor: "bg-[#b6754a]",
    },
    {
      band: "developing",
      label: "Developing",
      shortLabel: "Developing",
      shortcutKey: "2",
      score: "37.5%",
      activeClass:
        "bg-[#c9a227]/15 dark:bg-[#c9a227]/30 text-[#6e4e00] dark:text-[#fae59a] border-[#c9a227] ring-2 ring-[#c9a227]/40 shadow-xs font-semibold",
      badgeClass:
        "bg-[#c9a227]/15 text-[#6e4e00] dark:text-[#fae59a] border-[#c9a227]/40",
      dotColor: "bg-[#c9a227]",
    },
    {
      band: "satisfactory",
      label: "Satisfactory",
      shortLabel: "Satisfactory",
      shortcutKey: "3",
      score: "62.5%",
      activeClass:
        "bg-[#7c9b6e]/15 dark:bg-[#7c9b6e]/30 text-[#2c4e22] dark:text-[#c4deba] border-[#7c9b6e] ring-2 ring-[#7c9b6e]/40 shadow-xs font-semibold",
      badgeClass:
        "bg-[#7c9b6e]/15 text-[#2c4e22] dark:text-[#c4deba] border-[#7c9b6e]/40",
      dotColor: "bg-[#7c9b6e]",
    },
    {
      band: "excellent",
      label: "Excellent",
      shortLabel: "Excellent",
      shortcutKey: "4",
      score: "87.5%",
      activeClass:
        "bg-brand-100 dark:bg-brand-950/80 text-brand-950 dark:text-brand-200 border-brand-500 dark:border-brand-400 ring-2 ring-brand-500/40 shadow-xs font-semibold",
      badgeClass:
        "bg-brand-50 text-brand-800 dark:bg-brand-950/80 dark:text-brand-300 border-brand-300/60",
      dotColor: "bg-brand-600 dark:bg-brand-400",
    },
  ];

const RUBRIC_CRITERIA: Array<{
  key:
  | "letter_formation_band"
  | "size_consistency_band"
  | "spacing_band"
  | "slant_band"
  | "baseline_alignment_band";
  name: string;
  shortName: string;
  hint: string;
}> = [
    {
      key: "letter_formation_band",
      name: "1. Letter Formation",
      shortName: "Letter Formation",
      hint: "Proper cursive loops and complete stroke closures",
    },
    {
      key: "size_consistency_band",
      name: "2. Size Consistency",
      shortName: "Size Consistency",
      hint: "Proportion and height across 3-line penmanship ruling",
    },
    {
      key: "spacing_band",
      name: "3. Spacing",
      shortName: "Spacing",
      hint: "Inter-word rhythm and character separation spacing",
    },
    {
      key: "slant_band",
      name: "4. Slant Angle",
      shortName: "Slant Angle",
      hint: "Uniform forward slant tilt (target 60°–68° angle)",
    },
    {
      key: "baseline_alignment_band",
      name: "5. Baseline Alignment",
      shortName: "Baseline Alignment",
      hint: "Letters resting stably along bottom ruling baseline",
    },
  ];

function getBandMeta(band?: ScoreBand | string | null) {
  return (
    RUBRIC_BANDS.find((b) => b.band === band) ?? {
      band: "satisfactory" as ScoreBand,
      label: band || "Unrated",
      shortLabel: band || "Unrated",
      shortcutKey: "",
      score: "—",
      activeClass: "",
      badgeClass: "bg-muted/60 text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
    }
  );
}

interface ManualRubricEntryFormProps {
  submissionId: string;
  initialScores?: {
    letter_formation_band?: ScoreBand | null;
    size_consistency_band?: ScoreBand | null;
    spacing_band?: ScoreBand | null;
    slant_band?: ScoreBand | null;
    baseline_alignment_band?: ScoreBand | null;
  } | null;
  onSuccess?: () => void;
  onFocusCriterion?: (criterionName: string | null) => void;
  canGoNext?: boolean;
  onAdvanceNext?: () => void;
  onNavigateBack?: () => void;
}

function ManualRubricEntryForm({
  submissionId,
  initialScores,
  onSuccess,
  onFocusCriterion,
  canGoNext,
  onAdvanceNext,
  onNavigateBack,
}: ManualRubricEntryFormProps) {
  const { mutate: submitManualScore, isPending: isSubmittingScore } =
    useSubmitManualScore();

  const [rubricScores, setRubricScores] = useState<{
    letter_formation_band: ScoreBand | null;
    size_consistency_band: ScoreBand | null;
    spacing_band: ScoreBand | null;
    slant_band: ScoreBand | null;
    baseline_alignment_band: ScoreBand | null;
  }>({
    letter_formation_band: initialScores?.letter_formation_band ?? null,
    size_consistency_band: initialScores?.size_consistency_band ?? null,
    spacing_band: initialScores?.spacing_band ?? null,
    slant_band: initialScores?.slant_band ?? null,
    baseline_alignment_band: initialScores?.baseline_alignment_band ?? null,
  });

  const [activeCriterionIndex, setActiveCriterionIndex] = useState<number>(0);
  const [layoutMode, setLayoutMode] = useState<"stepper" | "list">("stepper");
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [accessibilityAnnouncement, setAccessibilityAnnouncement] = useState<string>("");

  const formRef = useRef<HTMLDivElement>(null);
  const activeCriterionIndexRef = useRef(activeCriterionIndex);
  const handleSubmitRubricRef = useRef<() => void>(() => { });

  useEffect(() => {
    activeCriterionIndexRef.current = activeCriterionIndex;
  }, [activeCriterionIndex]);

  const allBandsSelected =
    rubricScores.letter_formation_band !== null &&
    rubricScores.size_consistency_band !== null &&
    rubricScores.spacing_band !== null &&
    rubricScores.slant_band !== null &&
    rubricScores.baseline_alignment_band !== null;

  const selectedCount = Object.values(rubricScores).filter(Boolean).length;

  const handleSubmitRubric = useCallback(() => {
    if (!allBandsSelected || isSubmittingScore) return;
    setSubmitErrorMsg(null);

    submitManualScore(
      {
        submissionId,
        scores: {
          letter_formation_band: rubricScores.letter_formation_band!,
          size_consistency_band: rubricScores.size_consistency_band!,
          spacing_band: rubricScores.spacing_band!,
          slant_band: rubricScores.slant_band!,
          baseline_alignment_band: rubricScores.baseline_alignment_band!,
        },
      },
      {
        onSuccess: () => {
          onSuccess?.();
          if (autoAdvance && canGoNext && onAdvanceNext) {
            toast.success("Rubric recorded — advancing to next student", {
              action: onNavigateBack
                ? {
                    label: "Undo",
                    onClick: () => {
                      onNavigateBack();
                    },
                  }
                : undefined,
              duration: 6000,
            });
            onAdvanceNext();
          } else {
            toast.success("Rubric assessment recorded");
          }
        },
        onError: (err: unknown) => {
          const errorObj = err as { message?: string };
          setSubmitErrorMsg(
            errorObj?.message ||
            "Failed to submit manual rubric score. Please try again."
          );
        },
      }
    );
  }, [
    allBandsSelected,
    isSubmittingScore,
    submissionId,
    rubricScores,
    submitManualScore,
    onSuccess,
    autoAdvance,
    canGoNext,
    onAdvanceNext,
    onNavigateBack,
  ]);

  useEffect(() => {
    handleSubmitRubricRef.current = handleSubmitRubric;
  }, [handleSubmitRubric]);

  // Keyboard accelerators (1, 2, 3, 4 to rate & advance, Ctrl+Enter to submit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when focused inside text inputs, textareas, or selects
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Submit shortcut: Ctrl+Enter or Cmd+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmitRubricRef.current();
        return;
      }

      // Keys 1 - 4 for fast rubric rating
      if (["1", "2", "3", "4"].includes(e.key)) {
        const bandIndex = parseInt(e.key, 10) - 1;
        const targetOption = RUBRIC_BANDS[bandIndex];
        if (!targetOption) return;

        const currentCriterion =
          RUBRIC_CRITERIA[activeCriterionIndexRef.current];
        if (!currentCriterion) return;

        e.preventDefault();

        // Update score & auto-clear stale submit error
        setRubricScores((prev) => ({
          ...prev,
          [currentCriterion.key]: targetOption.band,
        }));
        setSubmitErrorMsg(null);

        // Auto-advance to the next criterion
        const nextIndex =
          (activeCriterionIndexRef.current + 1) % RUBRIC_CRITERIA.length;
        setActiveCriterionIndex(nextIndex);
        onFocusCriterion?.(RUBRIC_CRITERIA[nextIndex].shortName);

        // Screen reader announcement for keyboard grading
        setAccessibilityAnnouncement(
          `${currentCriterion.shortName} rated ${targetOption.label} (${targetOption.score}). Active criterion: ${RUBRIC_CRITERIA[nextIndex].shortName}.`
        );

        // Programmatically shift focus to the next criterion's radio group
        setTimeout(() => {
          const nextBtn =
            formRef.current?.querySelector<HTMLButtonElement>(
              `button[data-criterion="${RUBRIC_CRITERIA[nextIndex].key}"][data-band="${targetOption.band}"]`
            ) ??
            formRef.current?.querySelector<HTMLButtonElement>(
              `fieldset[aria-labelledby="criterion-label-${RUBRIC_CRITERIA[nextIndex].key}"] button[role="radio"][tabindex="0"]`
            );
          nextBtn?.focus();
        }, 0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onFocusCriterion]);

  const handleSelectCriterion = (index: number) => {
    setActiveCriterionIndex(index);
    onFocusCriterion?.(RUBRIC_CRITERIA[index].shortName);
  };

  // WAI-ARIA roving tabindex and arrow key navigation within criterion radio group
  const handleCriterionKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    criterionKey:
      | "letter_formation_band"
      | "size_consistency_band"
      | "spacing_band"
      | "slant_band"
      | "baseline_alignment_band",
    criterionIdx: number,
    currentOptionIdx: number
  ) => {
    let targetOptionIdx: number | null = null;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      targetOptionIdx = (currentOptionIdx + 1) % RUBRIC_BANDS.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      targetOptionIdx =
        (currentOptionIdx - 1 + RUBRIC_BANDS.length) % RUBRIC_BANDS.length;
    }

    if (targetOptionIdx !== null) {
      const targetOption = RUBRIC_BANDS[targetOptionIdx];
      const targetBand = targetOption.band;
      setRubricScores((prev) => ({
        ...prev,
        [criterionKey]: targetBand,
      }));
      setSubmitErrorMsg(null);
      handleSelectCriterion(criterionIdx);
      setAccessibilityAnnouncement(
        `${RUBRIC_CRITERIA[criterionIdx].shortName} rated ${targetOption.label} (${targetOption.score}).`
      );

      // Programmatically focus the newly selected radio button
      const nextBtn = formRef.current?.querySelector<HTMLButtonElement>(
        `button[data-criterion="${criterionKey}"][data-band="${targetBand}"]`
      );
      nextBtn?.focus();
    }
  };

  return (
    <div
      ref={formRef}
      className="p-3.5 sm:p-4 rounded-xl bg-surface dark:bg-card border border-border shadow-xs space-y-3"
    >
      {/* Screen reader live announcement region */}
      <div className="sr-only" role="status" aria-live="polite">
        {accessibilityAnnouncement}
      </div>

      {/* Header with status counter, mobile view toggle, & keyboard hint toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2.5 border-b border-border/60">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Award className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <h4 className="text-xs font-heading font-semibold text-foreground">
              Teacher Rubric Assessment
            </h4>
            <button
              type="button"
              onClick={() => setShowKeyboardHelp((prev) => !prev)}
              className="hidden sm:flex text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg cursor-pointer items-center justify-center min-h-7 min-w-7 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              title="Toggle Keyboard Shortcuts"
              aria-label="Toggle Keyboard Shortcuts"
              aria-expanded={showKeyboardHelp}
            >
              <Keyboard className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Evaluate student penmanship across 5 core criteria to finalize assessment scores.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          {/* Layout Mode Switcher (Focus Stepper vs Full List for all viewports) */}
          <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/80">
            <button
              type="button"
              onClick={() => setLayoutMode("stepper")}
              className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer min-h-[36px] sm:min-h-[28px] flex items-center gap-1 touch-manipulation ${layoutMode === "stepper"
                ? "bg-surface dark:bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
                }`}
              aria-pressed={layoutMode === "stepper"}
              title="Focus Stepper Mode (1 criterion at a time)"
            >
              <Layers className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>Focus</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("list")}
              className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer min-h-[36px] sm:min-h-[28px] flex items-center gap-1 touch-manipulation ${layoutMode === "list"
                ? "bg-surface dark:bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
                }`}
              aria-pressed={layoutMode === "list"}
              title="List Mode (show all 5 criteria)"
            >
              <LayoutList className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>All (5)</span>
            </button>
          </div>

          <Badge
            variant="outline"
            className={`text-[11px] font-semibold px-2.5 py-0.5 shrink-0 ${allBandsSelected
              ? "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border-brand-300"
              : "bg-[#c9a227]/15 text-[#6e4e00] dark:bg-[#c9a227]/25 dark:text-[#fae59a] border-[#c9a227]/40"
              }`}
          >
            {selectedCount}/5 rated
          </Badge>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint Bar */}
      {showKeyboardHelp && (
        <div className="p-2.5 rounded-lg bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 text-[11px] text-brand-900 dark:text-brand-200 space-y-1 animate-in fade-in-50 duration-150">
          <div className="flex items-center gap-1.5 font-semibold">
            <Keyboard className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <span>Fast Keyboard Grading</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] text-brand-800 dark:text-brand-300">
            <div><kbd className="px-1.5 py-0.5 rounded bg-background border border-brand-300 font-mono font-bold text-[11px]">1</kbd> Needs Imp.</div>
            <div><kbd className="px-1.5 py-0.5 rounded bg-background border border-brand-300 font-mono font-bold text-[11px]">2</kbd> Developing</div>
            <div><kbd className="px-1.5 py-0.5 rounded bg-background border border-brand-300 font-mono font-bold text-[11px]">3</kbd> Satisfactory</div>
            <div><kbd className="px-1.5 py-0.5 rounded bg-background border border-brand-300 font-mono font-bold text-[11px]">4</kbd> Excellent</div>
          </div>
          <p className="text-[11px] text-muted-foreground pt-0.5">
            Pressing a number rates the active criterion and automatically advances to the next. Press <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[11px]">Ctrl+Enter</kbd> to submit.
          </p>
        </div>
      )}

      {submitErrorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold block">Submission Error</span>
            <span>{submitErrorMsg}</span>
          </div>
        </div>
      )}

      {/* ---------------- FOCUS STEPPER MODE (Unified across all viewports) ---------------- */}
      {layoutMode === "stepper" && (
        <div className="space-y-2.5">
          {/* 5-Step Navigation Pills */}
          <div className="grid grid-cols-5 gap-1 pt-0.5">
            {RUBRIC_CRITERIA.map((criterion, idx) => {
              const isStepActive = activeCriterionIndex === idx;
              const stepBand = rubricScores[criterion.key];
              const isRated = stepBand !== null;
              const bandMeta = getBandMeta(stepBand);

              return (
                <button
                  key={criterion.key}
                  type="button"
                  onClick={() => handleSelectCriterion(idx)}
                  className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg border text-center transition-all cursor-pointer min-h-[40px] touch-manipulation ${isStepActive
                    ? "bg-brand-100 dark:bg-brand-950 text-brand-950 dark:text-brand-200 border-brand-500 ring-2 ring-brand-400/40 font-bold"
                    : isRated
                      ? "bg-surface dark:bg-card border-brand-200/80 dark:border-brand-900/80 text-foreground"
                      : "bg-muted/30 border-border/60 text-muted-foreground hover:border-border"
                    }`}
                  aria-label={`Step ${idx + 1}: ${criterion.shortName}${isRated ? ` (Rated: ${bandMeta.label})` : ""}`}
                  aria-current={isStepActive ? "step" : undefined}
                >
                  <span className="text-[11px] font-mono leading-none font-semibold">
                    {idx + 1}
                  </span>
                  <div className="flex items-center gap-0.5 mt-1">
                    {isRated ? (
                      <span
                        className={`size-1.5 rounded-full ${bandMeta.dotColor}`}
                        title={bandMeta.label}
                      />
                    ) : (
                      <span className="size-1.5 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Focused Active Criterion Card */}
          {(() => {
            const currentCriterion = RUBRIC_CRITERIA[activeCriterionIndex];
            const selectedBand = rubricScores[currentCriterion.key];
            const guide = CRITERIA_GUIDE[currentCriterion.shortName];

            return (
              <fieldset
                role="radiogroup"
                aria-labelledby={`stepper-criterion-label-${currentCriterion.key}`}
                className="space-y-2 p-3 sm:p-3.5 rounded-xl border bg-muted/20 border-brand-300/80 dark:border-brand-800/80 ring-1 ring-brand-400/30 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <legend
                      id={`stepper-criterion-label-${currentCriterion.key}`}
                      className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                    >
                      <span>{currentCriterion.name}</span>
                      <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium font-sans">
                        ({activeCriterionIndex + 1} of 5)
                      </span>
                    </legend>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {currentCriterion.hint}
                    </p>
                  </div>
                  {selectedBand && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold px-2 py-0.5 shrink-0 ${getBandMeta(selectedBand).badgeClass}`}
                    >
                      {getBandMeta(selectedBand).label} ({getBandMeta(selectedBand).score})
                    </Badge>
                  )}
                </div>

                {/* Segmented 4-Radio Buttons with Responsive Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
                  {RUBRIC_BANDS.map((option, optIdx) => {
                    const isChecked = selectedBand === option.band;
                    const isTabTarget = isChecked || (!selectedBand && optIdx === 0);

                    return (
                      <button
                        key={option.band}
                        type="button"
                        role="radio"
                        data-criterion={currentCriterion.key}
                        data-band={option.band}
                        tabIndex={isTabTarget ? 0 : -1}
                        aria-checked={isChecked}
                        aria-label={`${currentCriterion.shortName}: ${option.label} (${option.score})`}
                        disabled={isSubmittingScore}
                        onKeyDown={(e) =>
                          handleCriterionKeyDown(
                            e,
                            currentCriterion.key,
                            activeCriterionIndex,
                            optIdx
                          )
                        }
                        onClick={() => {
                          setRubricScores((prev) => ({
                            ...prev,
                            [currentCriterion.key]: option.band,
                          }));
                          setSubmitErrorMsg(null);
                          setAccessibilityAnnouncement(
                            `${currentCriterion.shortName} rated ${option.label} (${option.score}).`
                          );
                          if (autoAdvance && activeCriterionIndex < RUBRIC_CRITERIA.length - 1) {
                            const nextIdx = activeCriterionIndex + 1;
                            setActiveCriterionIndex(nextIdx);
                            onFocusCriterion?.(RUBRIC_CRITERIA[nextIdx].shortName);
                          }
                        }}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all cursor-pointer min-h-[46px] sm:min-h-[40px] touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${isChecked
                          ? option.activeClass
                          : "bg-surface dark:bg-card border-border/70 text-foreground/80 hover:text-foreground hover:bg-muted/50 hover:border-border"
                          }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-mono font-medium text-muted-foreground">
                            [{option.shortcutKey}]
                          </span>
                          <span className="text-xs leading-tight font-semibold">
                            {option.label}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-muted-foreground/90 mt-0.5">
                          {option.score}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Inline Pedagogical Coaching Guidance */}
                {guide && (
                  <div className="mt-2 p-2.5 rounded-lg bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 text-xs space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-brand-800 dark:text-brand-300">
                      <Info className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                      <span>Diagnostic Goal:</span>
                    </div>
                    <p className="text-[11px] text-foreground/80 leading-relaxed">
                      {guide.rubricGoal}
                    </p>
                    <div className="pt-1 border-t border-brand-200/60 dark:border-brand-900/60 flex items-start gap-1 text-[11px] text-brand-800 dark:text-brand-300">
                      <Eye className="size-3 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="leading-normal">
                        <strong>Tip:</strong> {guide.coachingTip}
                      </span>
                    </div>
                  </div>
                )}

                {/* Stepper Navigation: Previous / Next Criterion */}
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={activeCriterionIndex === 0}
                    onClick={() => {
                      if (activeCriterionIndex > 0) {
                        const prevIdx = activeCriterionIndex - 1;
                        setActiveCriterionIndex(prevIdx);
                        onFocusCriterion?.(RUBRIC_CRITERIA[prevIdx].shortName);
                      }
                    }}
                    className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 touch-manipulation"
                  >
                    <ChevronLeft className="size-3.5" aria-hidden="true" />
                    <span>Prev</span>
                  </Button>

                  <span className="text-[11px] text-muted-foreground font-medium">
                    Criterion {activeCriterionIndex + 1} of {RUBRIC_CRITERIA.length}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={activeCriterionIndex === RUBRIC_CRITERIA.length - 1}
                    onClick={() => {
                      if (activeCriterionIndex < RUBRIC_CRITERIA.length - 1) {
                        const nextIdx = activeCriterionIndex + 1;
                        setActiveCriterionIndex(nextIdx);
                        onFocusCriterion?.(RUBRIC_CRITERIA[nextIdx].shortName);
                      }
                    }}
                    className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 touch-manipulation"
                  >
                    <span>Next</span>
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </fieldset>
            );
          })()}
        </div>
      )}

      {/* ---------------- 5 CRITERIA LIST (All Mode) ---------------- */}
      <div
        className={`space-y-2.5 ${layoutMode === "stepper" ? "hidden" : "block"}`}
        role="group"
        aria-label="5-Criterion Handwriting Rubric"
      >
        {RUBRIC_CRITERIA.map((criterion, idx) => {
          const selectedBand = rubricScores[criterion.key];
          const isFocused = activeCriterionIndex === idx;
          const guide = CRITERIA_GUIDE[criterion.shortName];

          return (
            <fieldset
              key={criterion.key}
              role="radiogroup"
              aria-labelledby={`criterion-label-${criterion.key}`}
              className={`space-y-1.5 p-2.5 rounded-xl border transition-all ${isFocused
                ? "bg-muted/30 border-brand-300/80 dark:border-brand-800/80 ring-1 ring-brand-400/30 shadow-xs"
                : "bg-muted/15 border-border/60 hover:border-border"
                }`}
              onClick={() => handleSelectCriterion(idx)}
            >
              <div className="flex items-center justify-between gap-2">
                <legend
                  id={`criterion-label-${criterion.key}`}
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{criterion.name}</span>
                  {isFocused && (
                    <span className="text-[11px] text-brand-600 dark:text-brand-400 font-medium font-sans">
                      (Active)
                    </span>
                  )}
                </legend>
                {selectedBand && (
                  <span className="text-[11px] font-mono font-semibold text-muted-foreground">
                    {getBandMeta(selectedBand).score}
                  </span>
                )}
              </div>

              {/* Segmented 4-Radio Buttons with WAI-ARIA Roving Tabindex & Mobile Touch Sizing */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {RUBRIC_BANDS.map((option, optIdx) => {
                  const isChecked = selectedBand === option.band;
                  const isTabTarget = isChecked || (!selectedBand && optIdx === 0);

                  return (
                    <button
                      key={option.band}
                      type="button"
                      role="radio"
                      data-criterion={criterion.key}
                      data-band={option.band}
                      tabIndex={isTabTarget ? 0 : -1}
                      aria-checked={isChecked}
                      aria-label={`${criterion.shortName}: ${option.label} (${option.score})`}
                      disabled={isSubmittingScore}
                      onKeyDown={(e) =>
                        handleCriterionKeyDown(
                          e,
                          criterion.key,
                          idx,
                          optIdx
                        )
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCriterion(idx);
                        setRubricScores((prev) => ({
                          ...prev,
                          [criterion.key]: option.band,
                        }));
                        setSubmitErrorMsg(null);
                        setAccessibilityAnnouncement(
                          `${criterion.shortName} rated ${option.label} (${option.score}).`
                        );
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${isChecked
                        ? option.activeClass
                        : "bg-surface dark:bg-card border-border/70 text-foreground/80 hover:text-foreground hover:bg-muted/50 hover:border-border"
                        }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-mono font-medium text-muted-foreground">
                          [{option.shortcutKey}]
                        </span>
                        <span className="text-[11px] leading-tight font-medium">
                          {option.shortLabel}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground/90 mt-0.5">
                        {option.score}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Inline Mobile Coaching Tip when criterion is focused in List mode (sm:hidden) */}
              {isFocused && guide && (
                <div className="sm:hidden mt-2 p-2 rounded-lg bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 text-[11px] text-brand-900 dark:text-brand-200 flex items-start gap-1.5 animate-in fade-in-50 duration-150">
                  <Info className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-semibold block text-brand-800 dark:text-brand-300">
                      {guide.rubricGoal}
                    </span>
                    <span className="text-foreground/80 block">
                      <strong>Tip:</strong> {guide.coachingTip}
                    </span>
                  </div>
                </div>
              )}
            </fieldset>
          );
        })}
      </div>

      {/* Form Submit Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-border/60 gap-2.5">
        <div className="text-[11px] text-muted-foreground flex items-center justify-between sm:justify-start gap-3">
          {allBandsSelected ? (
            <span className="text-brand-700 dark:text-brand-300 font-medium flex items-center gap-1">
              <Check className="size-3" aria-hidden="true" />
              All 5 criteria rated
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <HelpCircle className="size-3 text-muted-foreground" aria-hidden="true" />
              <span>Rate all 5 to submit</span>
            </span>
          )}

          {canGoNext && (
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none touch-manipulation py-1">
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
              />
              <span>Auto-advance</span>
            </label>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          disabled={!allBandsSelected || isSubmittingScore}
          onClick={handleSubmitRubric}
          className="w-full sm:w-auto h-10 sm:h-8 min-h-[44px] sm:min-h-[32px] px-4 bg-primary hover:bg-brand-700 text-primary-foreground text-xs font-semibold rounded-lg sm:rounded-xl gap-1.5 shadow-xs cursor-pointer disabled:cursor-not-allowed touch-manipulation"
        >
          {isSubmittingScore ? (
            <>
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              <span>Saving...</span>
            </>
          ) : canGoNext && autoAdvance ? (
            <>
              <CheckCheck className="size-3.5" aria-hidden="true" />
              <span>Submit & Next</span>
            </>
          ) : (
            <>
              <CheckCheck className="size-3.5" aria-hidden="true" />
              <span>Submit Rubric</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface SubmissionDetailDialogContentProps {
  submission: Submission;
  submissions?: Submission[];
  currentIndex?: number;
  onNavigate?: (submission: Submission) => void;
  activityTargetText?: string;
  onOpenChange: (open: boolean) => void;
}

function SubmissionDetailDialogContent({
  submission,
  submissions,
  currentIndex,
  onNavigate,
  activityTargetText,
  onOpenChange,
}: SubmissionDetailDialogContentProps) {
  const { openUpload } = useTeacherModals();
  const [isZoomed, setIsZoomed] = useState(false);
  const [isScrolledPastInspector, setIsScrolledPastInspector] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [selectedCriterion, setSelectedCriterion] = useState<string | null>(
    "Letter Formation"
  );
  const [phase1Tab, setPhase1Tab] = useState<"rubric" | "metrics">("rubric");
  const [isEditingRubric, setIsEditingRubric] = useState(false);

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

  // Keyboard navigation for submission cycling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.defaultPrevented) {
        return;
      }

      // Submission cycling
      if (e.key === "ArrowLeft" || e.key === "j" || e.key === "J") {
        if (submissions && submissions.length > 1 && onNavigate && currentIndex !== undefined && currentIndex > 0) {
          e.preventDefault();
          onNavigate(submissions[currentIndex - 1]);
        }
      } else if (e.key === "ArrowRight" || e.key === "k" || e.key === "K") {
        if (
          submissions &&
          submissions.length > 1 &&
          onNavigate &&
          currentIndex !== undefined &&
          currentIndex < submissions.length - 1
        ) {
          e.preventDefault();
          onNavigate(submissions[currentIndex + 1]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    submissions,
    currentIndex,
    onNavigate,
  ]);

  const hasMultipleSubmissions = Boolean(
    submissions && submissions.length > 1 && currentIndex !== undefined
  );
  const canGoPrev = hasMultipleSubmissions && (currentIndex ?? 0) > 0;
  const canGoNext =
    hasMultipleSubmissions && (currentIndex ?? 0) < (submissions?.length ?? 0) - 1;

  const rejectionInfo = useMemo(() => {
    if (submission.status !== "rejected") return null;

    const baseInfo = submission.rejection_code
      ? REJECTION_GUIDE[submission.rejection_code] ?? {
          title: "Worksheet Photo Needs Re-capture",
          description: `The quality verification check encountered an issue (${submission.rejection_code.replace(/_/g, " ").toLowerCase()}).`,
          advice:
            "Please verify that the worksheet is flat, well-lit, in focus, and written with a clear pen or pencil.",
        }
      : DEFAULT_REJECTION_INFO;

    const isParentUpload = submission.uploader_role === "parent";
    const actionLabel = isParentUpload ? "Parent Upload Follow-up" : "Teacher Action";
    const actionAdvice = isParentUpload
      ? `This worksheet was uploaded by the student's parent. ${baseInfo.advice} You can take a new photo in class now or advise the parent to re-scan.`
      : baseInfo.advice;

    const badgeLabel = submission.rejection_code
      ? REJECTION_BADGE_LABELS[submission.rejection_code] ?? "Needs Re-scan"
      : "Needs Re-scan";

    return {
      ...baseInfo,
      actionLabel,
      actionAdvice,
      badgeLabel,
    };
  }, [submission.status, submission.rejection_code, submission.uploader_role]);

  const measurement = submission.measurement;
  const compositeScore = measurement?.composite_score;
  const compositeBand = getScoreBand(compositeScore);

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
  const criteria = useMemo(
    () => {
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
    },
    [measurement, submission.status]
  );

  const rawCriteria = useMemo(
    () => {
      if (submission.status === "rejected") return [];
      return [
        {
          name: "Letter Formation",
          primaryValue:
            measurement?.letter_formation_mean != null
              ? formatMetric(
                measurement.letter_formation_mean,
                measurement.letter_formation_std,
                "%"
              )
              : "Awaiting Analysis",
          description:
            "OpenCV curvature and CNN stroke loop analysis across ascenders (b, d, h, k, l) and descenders (g, j, p, q, y, z).",
          subDetails: [
            {
              label: "Status",
              value:
                measurement?.letter_formation_mean != null
                  ? "Feature Extracted"
                  : "Awaiting Analysis",
            },
            {
              label: "Stroke curvature",
              value: formatMetric(measurement?.letter_formation_mean, null, "%"),
            },
          ],
        },
        {
          name: "Size Consistency",
          primaryValue: formatMetric(
            measurement?.size_consistency_mean,
            measurement?.size_consistency_std,
            "ratio"
          ),
          description:
            "Proportion of lowercase x-height relative to printed 3-line guidelines (Headline, Midline, Baseline).",
          subDetails: [
            {
              label: "Core x-height ratio",
              value: formatMetric(measurement?.size_consistency_mean),
            },
            {
              label: "Target guideline ratio",
              value: "0.50 (at midline)",
            },
            {
              label: "Height variation (std)",
              value: formatMetric(measurement?.size_consistency_std),
            },
          ],
        },
        {
          name: "Spacing",
          primaryValue: formatMetric(
            measurement?.word_spacing_mean,
            measurement?.word_spacing_std,
            "gap"
          ),
          description:
            "Word separation rhythm and inter-letter connector spacing normalized to ruling guidelines.",
          subDetails: [
            {
              label: "Word-to-word gap",
              value: formatMetric(
                measurement?.word_spacing_mean,
                measurement?.word_spacing_std
              ),
            },
            {
              label: "Letter-to-letter gap",
              value: formatMetric(
                measurement?.letter_spacing_mean,
                measurement?.letter_spacing_std
              ),
            },
            {
              label: "Target benchmark",
              value: "~1 lowercase 'o'",
            },
          ],
        },
        {
          name: "Slant Angle",
          primaryValue:
            measurement?.slant_mean != null
              ? `${Number(measurement.slant_mean).toFixed(1)}°${measurement.slant_std != null
                ? ` ± ${Number(measurement.slant_std).toFixed(1)}°`
                : ""
              }`
              : "—",
          description:
            "Average forward cursive stroke angle relative to baseline perpendicular (Target standard: 60°–68°).",
          subDetails: [
            {
              label: "Mean slant angle",
              value:
                measurement?.slant_mean != null
                  ? `${Number(measurement.slant_mean).toFixed(1)}°`
                  : "—",
            },
            {
              label: "Target slant range",
              value: "60.0° – 68.0°",
            },
            {
              label: "Slant consistency (std)",
              value:
                measurement?.slant_std != null
                  ? `±${Number(measurement.slant_std).toFixed(1)}°`
                  : "—",
            },
          ],
        },
        {
          name: "Baseline Alignment",
          primaryValue: formatMetric(
            measurement?.baseline_deviation_mean,
            measurement?.baseline_deviation_std,
            "drift"
          ),
          description:
            "Vertical distance of letter bases from the ruled penmanship baseline guideline across each word.",
          subDetails: [
            {
              label: "Mean baseline drift",
              value: formatMetric(measurement?.baseline_deviation_mean),
            },
            {
              label: "Target alignment",
              value: "< 0.05 drift ratio",
            },
            {
              label: "Drift variation (std)",
              value: formatMetric(measurement?.baseline_deviation_std),
            },
          ],
        },
      ];
    },
    [measurement, submission.status]
  );

  const handleReupload = () => {
    onOpenChange(false);
    openUpload({
      activityId: submission.activity_id,
      studentId: submission.student_id,
    });
  };

  const activeCriterionInfo = selectedCriterion
    ? CRITERIA_GUIDE[selectedCriterion]
    : null;

  return (
    <DialogContent
      showCloseButton={true}
      className="w-[calc(100%-1.5rem)] sm:max-w-4xl max-w-4xl max-h-[min(94dvh,calc(100vh-2rem))] flex flex-col p-4 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-xl border border-border/80 bg-surface dark:bg-card"
    >
      {/* Header */}
      <DialogHeader className="pb-3 sm:pb-4 border-b border-border/70 shrink-0 text-left pr-10 sm:pr-12">
        <div className="flex flex-row items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="font-heading text-base sm:text-xl font-semibold tracking-tight text-foreground truncate">
                  {submission.student?.full_name ?? "Student"}
                </DialogTitle>
              </div>
              <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 flex items-center gap-x-2.5 sm:gap-x-3 gap-y-0.5 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <User className="size-3" aria-hidden="true" />
                  Uploaded by{" "}
                  {submission.uploader_role === "parent" ? "Parent" : "Teacher"}
                </span>
                <span className="inline-flex items-center gap-1">
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
            </div>
          </div>

          {/* Header Right: Navigation between students with matching height hitboxes */}
          <div className="flex items-center gap-2 shrink-0">
            {hasMultipleSubmissions && submissions && onNavigate && (
              <div className="flex items-center gap-0.5 sm:gap-1 bg-muted/50 p-0.5 sm:p-1 rounded-xl border border-border h-8.5 sm:h-9">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canGoPrev}
                  onClick={() => {
                    if (canGoPrev && currentIndex !== undefined) {
                      onNavigate(submissions[currentIndex - 1]);
                    }
                  }}
                  className="size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer flex items-center justify-center touch-manipulation"
                  aria-label="Previous student (Key: J or ←)"
                  title="Previous student (← / J)"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <span className="text-[11px] sm:text-xs font-semibold px-1.5 sm:px-2 text-foreground select-none tabular-nums">
                  {(currentIndex ?? 0) + 1} / {submissions.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canGoNext}
                  onClick={() => {
                    if (canGoNext && currentIndex !== undefined) {
                      onNavigate(submissions[currentIndex + 1]);
                    }
                  }}
                  className="size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer flex items-center justify-center touch-manipulation"
                  aria-label="Next student (Key: K or →)"
                  title="Next student (→ / K)"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogHeader>

      {/* Modal Body: Split view (Image + Diagnostic details) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain py-3 sm:py-4 space-y-4"
      >
        {/* Mobile Sticky Preview Pill (< lg screens, active only when scrolled past main image) */}
        {isScrolledPastInspector && (
          <div className="lg:hidden sticky -top-3 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-surface/95 dark:bg-card/95 backdrop-blur-md border-b border-border/80 flex items-center justify-between gap-2 shadow-xs animate-in fade-in slide-in-from-top-2 duration-150">
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
              className="min-h-[36px] h-8 px-2.5 text-xs gap-1 cursor-pointer shrink-0 touch-manipulation font-medium text-brand-800 dark:text-brand-300 border-brand-300 dark:border-brand-800 hover:bg-brand-50 dark:hover:bg-brand-950/60"
            >
              <Eye className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>View Image</span>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:items-center">
          {/* Left: Worksheet Image Preview with Interactive Stroke Inspector */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-2 w-full">
            <WorksheetImageInspector
              imageUrl={imageUrl}
              altText={`Handwriting worksheet submitted for ${submission.student?.full_name ?? "student"}`}
              isLoading={isImageLoading}
              isError={isImageError}
              headerLabel="Handwritten Worksheet"
              onRetry={() => {
                refetchImage();
              }}
              isFrameExpanded={isZoomed}
              onToggleFrameExpanded={() => setIsZoomed((prev) => !prev)}
              allowFrameToggle={true}
              aspectRatioClass="aspect-4/3 sm:aspect-3/2 max-h-[260px] sm:max-h-[400px]"
              expandedAspectRatioClass="min-h-[400px] max-h-[540px]"
            />

            {/* Target prompt bar */}
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs flex items-center gap-1.5 text-muted-foreground flex-wrap">
              <span className="font-semibold text-foreground shrink-0">Target prompt:</span>
              <span className="font-medium text-foreground bg-background/80 dark:bg-card/80 px-2 py-0.5 rounded-md border border-border/60">
                {resolvedTargetText ? `“${resolvedTargetText}”` : "Cursive Penmanship Practice"}
              </span>
            </div>
          </div>

          {/* Right: Diagnostic Assessment Details */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-3.5">
            {/* REJECTED STATE */}
            {submission.status === "rejected" && rejectionInfo && (
              <div className="space-y-3.5">
                <Alert
                  variant="destructive"
                  role="region"
                  aria-labelledby="rejection-heading"
                  className="rounded-xl sm:rounded-2xl border-destructive/25 bg-destructive/10 p-4 sm:p-5 shadow-xs space-y-3 block [&_svg]:translate-y-0"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <AlertCircle className="size-4.5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <AlertTitle className="font-heading text-sm sm:text-base font-semibold text-destructive tracking-tight leading-snug">
                        <h3 id="rejection-heading" className="text-balance break-words font-inherit">
                          {rejectionInfo.title}
                        </h3>
                      </AlertTitle>
                    </div>
                  </div>

                  <AlertDescription className="!text-foreground/90 text-xs sm:text-sm leading-relaxed font-sans">
                    {rejectionInfo.description}
                  </AlertDescription>

                  <div className="rounded-lg sm:rounded-xl bg-background/95 dark:bg-card/90 border border-destructive/20 p-3 space-y-1.5 shadow-2xs">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <RotateCcw className="size-3.5 !text-brand-600 dark:!text-brand-400 shrink-0" aria-hidden="true" />
                      {rejectionInfo.actionLabel}
                    </span>
                    <p
                      id="rejection-advice"
                      className="text-xs text-foreground/80 leading-relaxed"
                    >
                      {rejectionInfo.actionAdvice}
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={handleReupload}
                    aria-describedby="rejection-advice"
                    aria-label={`Take and re-upload new worksheet photo for ${submission.student?.full_name ?? "student"}`}
                    className="w-full min-h-11 bg-primary hover:bg-brand-700 text-primary-foreground dark:hover:bg-brand-200 dark:hover:text-brand-950 text-xs sm:text-sm font-semibold rounded-xl gap-2 shadow-xs cursor-pointer touch-manipulation transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Camera className="size-4" aria-hidden="true" />
                    Take & Re-upload New Photo
                  </Button>
                </Alert>

                {/* Photo Quality Guidelines for Reliable Scoring */}
                <div className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-muted/30 dark:bg-muted/15 space-y-3">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Info className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
                    Photo Quality Guidelines for Reliable Scoring
                  </h4>
                  <ul className="space-y-2.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2.5">
                      <div className="size-6 rounded-md bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0 mt-0.5 border border-brand-200/50 dark:border-brand-900/50">
                        <SunMedium className="size-3.5" aria-hidden="true" />
                      </div>
                      <span className="leading-relaxed">
                        <strong className="text-foreground font-medium">Bright, Indirect Lighting:</strong> Avoid heavy phone shadows and direct overhead fluorescent glare on the paper.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="size-6 rounded-md bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0 mt-0.5 border border-brand-200/50 dark:border-brand-900/50">
                        <ScanLine className="size-3.5" aria-hidden="true" />
                      </div>
                      <span className="leading-relaxed">
                        <strong className="text-foreground font-medium">Flat Top-Down Framing:</strong> Hold the camera parallel directly above the page so 3-line penmanship ruling remains straight.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="size-6 rounded-md bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0 mt-0.5 border border-brand-200/50 dark:border-brand-900/50">
                        <Camera className="size-3.5" aria-hidden="true" />
                      </div>
                      <span className="leading-relaxed">
                        <strong className="text-foreground font-medium">Tap to Focus:</strong> Ensure pencil strokes and midlines are crisp and sharp before pressing capture.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* PROCESSING STATE */}
            {submission.status === "processing" && (
              <div className="p-5 rounded-xl sm:rounded-2xl bg-[#c9a227]/10 dark:bg-[#c9a227]/20 border border-[#c9a227]/30 space-y-3 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-[#c9a227]/20 text-[#6e4e00] dark:text-[#fae59a] mx-auto motion-safe:animate-pulse">
                  <Clock className="size-6" aria-hidden="true" />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <h4 className="text-sm font-heading font-semibold text-foreground">
                    Analyzing Handwriting Worksheet
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    OpenCV quality verification passed. The CNN model is evaluating letter formation, spacing, and baseline stability.
                  </p>
                </div>
              </div>
            )}

            {/* COMPLETED STATE */}
            {submission.status === "completed" && (
              <div className="space-y-3.5">
                {hasCalibratedScores ? (
                  <>
                    {/* Phase 2: Overall Composite Score Card */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface dark:bg-card border border-border shadow-xs">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Composite Assessment
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-heading font-bold text-foreground tabular-nums">
                            {compositeScore !== null && compositeScore !== undefined
                              ? `${Math.round(compositeScore)}%`
                              : "Scored"}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold px-2.5 py-0.5 inline-flex items-center gap-1.5 ${compositeBand.className}`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${compositeBand.dotColor}`}
                            />
                            {compositeBand.label}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex size-10 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
                        <CheckCircle2 className="size-5" aria-hidden="true" />
                      </div>
                    </div>

                    {/* Phase 2: 5 Criteria breakdown */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          5-Criterion Breakdown
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Tap to focus coaching tip
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {criteria.map((c) => {
                          const band = getScoreBand(c.score);
                          const isSelected = selectedCriterion === c.name;
                          return (
                            <div key={c.name} className="space-y-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedCriterion(c.name)
                                }
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs text-left cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] sm:min-h-0 ${isSelected
                                  ? "bg-brand-50/80 dark:bg-brand-950/60 border-brand-300 dark:border-brand-800 shadow-xs"
                                  : "bg-surface dark:bg-card border-border/70 hover:border-border hover:bg-muted/30"
                                  }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-foreground truncate block">
                                      {c.name}
                                    </span>
                                    {isSelected && (
                                      <Badge
                                        variant="outline"
                                        className="text-[11px] px-1.5 py-0 bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200 border-brand-300"
                                      >
                                        Active
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-muted-foreground truncate block">
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
                                    className={`text-[11px] font-semibold px-2 py-0.5 ${band.className}`}
                                  >
                                    <span
                                      className={`size-1.5 rounded-full mr-1 ${band.dotColor}`}
                                    />
                                    {band.label}
                                  </Badge>
                                </div>
                              </button>

                              {/* Inline Mobile Coaching Tip when selected (sm:hidden) */}
                              {isSelected && activeCriterionInfo && (
                                <div className="sm:hidden p-2.5 rounded-lg bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 text-xs space-y-1 animate-in fade-in-50 duration-150">
                                  <div className="flex items-center gap-1 text-[11px] font-semibold text-brand-800 dark:text-brand-300">
                                    <Info className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                                    <span>Diagnostic Goal:</span>
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
                    <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border/80 gap-1">
                      <button
                        type="button"
                        onClick={() => setPhase1Tab("rubric")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[44px] sm:min-h-0 touch-manipulation ${phase1Tab === "rubric"
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
                          <span className="size-1.5 rounded-full bg-[#c9a227]" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setPhase1Tab("metrics")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[44px] sm:min-h-0 touch-manipulation ${phase1Tab === "metrics"
                          ? "bg-surface dark:bg-card text-foreground shadow-xs border border-border/60"
                          : "text-muted-foreground hover:text-foreground"
                          }`}
                      >
                        <Binary className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
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
                      <div className="space-y-3">
                        {submission.manual_score && !isEditingRubric ? (
                          /* READ-ONLY / CONFIRMED RUBRIC STATE */
                          <div className="p-4 rounded-xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900/80 shadow-xs space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="flex size-7 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 shrink-0">
                                  <ShieldCheck className="size-4" aria-hidden="true" />
                                </div>
                                <span className="text-xs font-semibold text-brand-950 dark:text-brand-200">
                                  Rubric Assessment Recorded
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditingRubric(true)}
                                className="min-h-[40px] sm:min-h-0 h-9 sm:h-7 px-3 sm:px-2.5 text-xs text-brand-800 dark:text-brand-200 border-brand-300 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/60 gap-1.5 cursor-pointer touch-manipulation"
                              >
                                <Edit3 className="size-3" aria-hidden="true" />
                                <span>Edit</span>
                              </Button>
                            </div>

                            <div className="space-y-1.5 pt-1">
                              {RUBRIC_CRITERIA.map((criterion) => {
                                const bandValue =
                                  submission.manual_score?.[criterion.key];
                                const bandMeta = getBandMeta(bandValue);
                                return (
                                  <div
                                    key={criterion.key}
                                    className="flex items-center justify-between p-2.5 rounded-lg bg-surface/90 dark:bg-card/90 border border-brand-200/60 dark:border-brand-900/60 text-xs"
                                  >
                                    <div className="min-w-0 pr-2">
                                      <span className="font-semibold text-foreground truncate block">
                                        {criterion.name}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground leading-normal block">
                                        {criterion.hint}
                                      </span>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={`text-[11px] font-semibold px-2.5 py-0.5 shrink-0 inline-flex items-center gap-1.5 ${bandMeta.badgeClass}`}
                                    >
                                      <span
                                        className={`size-1.5 rounded-full ${bandMeta.dotColor}`}
                                      />
                                      {bandMeta.label} ({bandMeta.score})
                                    </Badge>
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
                            onSuccess={() => setIsEditingRubric(false)}
                            onFocusCriterion={setSelectedCriterion}
                            canGoNext={canGoNext}
                            onAdvanceNext={() => {
                              if (
                                canGoNext &&
                                currentIndex !== undefined &&
                                submissions &&
                                onNavigate
                              ) {
                                onNavigate(submissions[currentIndex + 1]);
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
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            5 Physical Penmanship Features
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Tap to inspect
                          </span>
                        </div>

                        <div className="space-y-2">
                          {rawCriteria.map((c) => {
                            const isSelected = selectedCriterion === c.name;
                            return (
                              <button
                                key={c.name}
                                type="button"
                                onClick={() => setSelectedCriterion(c.name)}
                                className={`w-full flex flex-col p-2.5 sm:p-3 rounded-xl border transition-all text-xs text-left cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] sm:min-h-0 ${isSelected
                                  ? "bg-brand-50/80 dark:bg-brand-950/60 border-brand-300 dark:border-brand-800 shadow-xs ring-1 ring-brand-400/40"
                                  : "bg-surface dark:bg-card border-border/70 hover:border-brand-300 dark:hover:border-brand-800 hover:bg-muted/30"
                                  }`}
                              >
                                <div className="w-full flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-semibold text-foreground truncate block">
                                      {c.name}
                                    </span>
                                    {isSelected && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200 border-brand-300"
                                      >
                                        Active
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono font-semibold text-foreground tabular-nums text-xs px-2 py-0.5 rounded-md bg-muted/60 border border-border/60">
                                      {c.primaryValue}
                                    </span>
                                  </div>
                                </div>

                                <span className="text-[11px] text-muted-foreground mt-0.5 leading-snug block line-clamp-2">
                                  {c.description}
                                </span>

                                {c.subDetails && c.subDetails.length > 0 && (
                                  <div className="mt-1.5 pt-1.5 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-x-3.5 gap-y-1 text-[11px] w-full">
                                    {c.subDetails.map((sub, sIdx) => (
                                      <div
                                        key={sIdx}
                                        className="flex items-baseline justify-between gap-1.5 text-muted-foreground min-w-0"
                                      >
                                        <span className="shrink-0 font-medium text-muted-foreground/90">
                                          {sub.label}:
                                        </span>
                                        <span className="font-mono font-semibold text-foreground tabular-nums text-right truncate">
                                          {sub.value}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Focused Criterion Diagnostic Insight Card (Desktop/tablet view; mobile handled inline) */}
                {selectedCriterion && activeCriterionInfo && (
                  <div className="hidden sm:block p-3 rounded-xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 space-y-1.5 animate-in fade-in-50 duration-200">
                    <div className="flex items-center justify-between text-xs font-semibold text-brand-900 dark:text-brand-200">
                      <span className="flex items-center gap-1.5">
                        <Info className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                        <span>{selectedCriterion} Diagnostic Guide</span>
                      </span>
                      <span className="text-[11px] text-brand-700 dark:text-brand-300 font-medium">
                        Criterion Guide
                      </span>
                    </div>
                    <p className="text-xs text-foreground/85 leading-relaxed">
                      {activeCriterionInfo.rubricGoal}
                    </p>
                    <div className="pt-1.5 border-t border-brand-200/60 dark:border-brand-900/60 flex items-start gap-1.5 text-xs text-brand-800 dark:text-brand-300">
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

      {/* Modal Footer */}
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
          onClick={() => onOpenChange(false)}
          className="h-9 px-4 text-xs font-medium cursor-pointer ml-auto touch-manipulation"
        >
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function SubmissionDetailDialog({
  submission,
  submissions,
  currentIndex,
  onNavigate,
  activityTargetText,
  open,
  onOpenChange,
}: SubmissionDetailDialogProps) {
  if (!submission) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SubmissionDetailDialogContent
        key={submission.id}
        submission={submission}
        submissions={submissions}
        currentIndex={currentIndex}
        onNavigate={onNavigate}
        activityTargetText={activityTargetText}
        onOpenChange={onOpenChange}
      />
    </Dialog>
  );
}

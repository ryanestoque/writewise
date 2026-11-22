"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type ScoreBand,
  type ManualScore,
  type Submission,
  useSubmitManualScore,
} from "@/lib/hooks/use-submissions";
import {
  Keyboard,
  Layers,
  LayoutList,
  SlidersHorizontal,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  HelpCircle,
  Loader2,
  CheckCheck,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/utils/api-error";
import { getBandFromScore } from "@/lib/utils/scoring";

const LAYOUT_MODE_STORAGE_KEY = "writewise.rubric.layoutMode";
const AUTO_ADVANCE_STORAGE_KEY = "writewise.rubric.autoAdvance";

function readStoredLayoutMode(): "stepper" | "list" {
  if (typeof window === "undefined") return "stepper";
  try {
    const val = window.localStorage.getItem(LAYOUT_MODE_STORAGE_KEY);
    return val === "list" ? "list" : "stepper";
  } catch {
    return "stepper";
  }
}

function readStoredAutoAdvance(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const val = window.localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY);
    return val === null ? false : val === "true";
  } catch {
    return false;
  }
}

export const CRITERIA_GUIDE: Record<
  string,
  { rubricGoal: string; coachingTip: string }
> = {
  "Letter Formation": {
    rubricGoal:
      "Check loop closures on tall/descending stems (b, d, g, l) and smooth cursive connections.",
    coachingTip:
      "Encourage continuous strokes without lifting the pencil inside letter loops.",
  },
  "Size Consistency": {
    rubricGoal:
      "Check that short letters reach the dotted midline and tall letters touch the headline.",
    coachingTip:
      "Remind student that lowercase bodies (a, c, e, o) should stay below the dotted midline.",
  },
  Spacing: {
    rubricGoal:
      "Check even gaps between letters and about one letter width between words.",
    coachingTip:
      "Aim for a one-finger space between words to prevent crowding.",
  },
  "Slant Angle": {
    rubricGoal:
      "Check typical forward stem lean and consistency within and between words.",
    coachingTip:
      "Angling the paper slightly on the desk helps maintain a steady forward lean.",
  },
  Slant: {
    rubricGoal:
      "Check typical forward stem lean and consistency within and between words.",
    coachingTip:
      "Angling the paper slightly on the desk helps maintain a steady forward lean.",
  },
  "Baseline Alignment": {
    rubricGoal:
      "Check that letters rest evenly along the solid bottom guideline.",
    coachingTip:
      "Watch for words that float above or sag below the baseline ruling.",
  },
};

export const RUBRIC_BANDS: Array<{
  band: ScoreBand;
  label: string;
  shortLabel: string;
  shortcutKey: string;
  score: string;
  points: number;
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
      points: 1,
      activeClass:
        "bg-band-1/15 dark:bg-band-1/30 text-band-1-text dark:text-orange-200 border-band-1 ring-2 ring-band-1/40 shadow-xs font-semibold",
      badgeClass:
        "bg-band-1/15 text-band-1-text dark:text-orange-200 border-band-1/40",
      dotColor: "bg-band-1",
    },
    {
      band: "developing",
      label: "Developing",
      shortLabel: "Developing",
      shortcutKey: "2",
      score: "37.5%",
      points: 2,
      activeClass:
        "bg-band-2/15 dark:bg-band-2/30 text-band-2-text dark:text-amber-200 border-band-2 ring-2 ring-band-2/40 shadow-xs font-semibold",
      badgeClass:
        "bg-band-2/15 text-band-2-text dark:text-amber-200 border-band-2/40",
      dotColor: "bg-band-2",
    },
    {
      band: "satisfactory",
      label: "Satisfactory",
      shortLabel: "Satisfactory",
      shortcutKey: "3",
      score: "62.5%",
      points: 3,
      activeClass:
        "bg-band-3/15 dark:bg-band-3/30 text-band-3-text dark:text-emerald-200 border-band-3 ring-2 ring-band-3/40 shadow-xs font-semibold",
      badgeClass:
        "bg-band-3/15 text-band-3-text dark:text-emerald-200 border-band-3/40",
      dotColor: "bg-band-3",
    },
    {
      band: "excellent",
      label: "Excellent",
      shortLabel: "Excellent",
      shortcutKey: "4",
      score: "87.5%",
      points: 4,
      activeClass:
        "bg-band-4/15 dark:bg-band-4/30 text-band-4-text dark:text-emerald-200 border-band-4 ring-2 ring-band-4/40 shadow-xs font-semibold",
      badgeClass:
        "bg-band-4/15 text-band-4-text dark:text-emerald-200 border-band-4/40",
      dotColor: "bg-band-4",
    },
  ];

export const BAND_NUMERIC_SCORES: Record<ScoreBand, number> = {
  needs_improvement: 12.5,
  developing: 37.5,
  satisfactory: 62.5,
  excellent: 87.5,
};

export const BAND_POINTS: Record<ScoreBand, number> = {
  needs_improvement: 1,
  developing: 2,
  satisfactory: 3,
  excellent: 4,
};

export function calculateCompositeRubric(
  scores?: ManualScore | Partial<Record<string, ScoreBand | string | null>> | null
) {
  if (!scores) return null;
  const validBands = Object.values(scores).filter(
    (b): b is ScoreBand => Boolean(b) && (b as ScoreBand) in BAND_POINTS
  );
  if (validBands.length === 0) return null;

  const totalPoints = validBands.reduce((acc, b) => acc + BAND_POINTS[b], 0);
  const isComplete = validBands.length === 5;
  const maxPoints = isComplete ? 20 : validBands.length * 4;
  const avgPercentage = Math.round(
    validBands.reduce((acc, b) => acc + BAND_NUMERIC_SCORES[b], 0) / validBands.length
  );

  const overallBand = getBandFromScore(avgPercentage) ?? "needs_improvement";
  const overallBandMeta = getBandMeta(overallBand);

  return {
    totalPoints,
    maxPoints,
    ratedCount: validBands.length,
    avgPercentage,
    overallBandMeta,
    isComplete,
  };
}

export const RUBRIC_CRITERIA: Array<{
  key:
  | "letter_formation_band"
  | "size_consistency_band"
  | "spacing_band"
  | "slant_band"
  | "baseline_alignment_band";
  name: string;
  shortName: string;
  stepLabel: string;
  hint: string;
}> = [
    {
      key: "letter_formation_band",
      name: "Letter Formation",
      shortName: "Letter Formation",
      stepLabel: "Formation",
      hint: "Proper cursive loops and complete stroke closures",
    },
    {
      key: "size_consistency_band",
      name: "Size Consistency",
      shortName: "Size Consistency",
      stepLabel: "Size",
      hint: "Proportion and height across 3-line penmanship ruling",
    },
    {
      key: "spacing_band",
      name: "Spacing",
      shortName: "Spacing",
      stepLabel: "Spacing",
      hint: "Inter-word rhythm and character separation spacing",
    },
    {
      key: "slant_band",
      name: "Slant Angle",
      shortName: "Slant Angle",
      stepLabel: "Slant",
      hint: "Typical stem lean and consistency within and between words",
    },
    {
      key: "baseline_alignment_band",
      name: "Baseline Alignment",
      shortName: "Baseline Alignment",
      stepLabel: "Baseline",
      hint: "Letters resting stably along bottom ruling baseline",
    },
  ];

export function getBandMeta(band?: ScoreBand | string | null) {
  return (
    RUBRIC_BANDS.find((b) => b.band === band) ?? {
      band: "satisfactory" as ScoreBand,
      label: band || "Unrated",
      shortLabel: band || "Unrated",
      shortcutKey: "",
      score: "—",
      points: 0,
      activeClass: "",
      badgeClass: "bg-muted/60 text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
    }
  );
}

export interface CriterionCVMetric {
  value: string;
  target: string;
  status: string;
  dotClass: string;
  textClass: string;
  badgeClass: string;
}

export function extractCriterionCVMetric(
  criterionKey: string,
  measurement?: Submission["measurement"]
): CriterionCVMetric | null {
  if (!measurement) return null;

  const buildMetricStyle = (isOptimal: boolean, isBorderline: boolean) => ({
    dotClass: isOptimal ? "bg-band-4" : isBorderline ? "bg-band-2" : "bg-band-1",
    textClass: isOptimal
      ? "text-band-4-text dark:text-emerald-200"
      : isBorderline
        ? "text-band-2-text dark:text-amber-200"
        : "text-band-1-text dark:text-orange-200",
    badgeClass: isOptimal
      ? "bg-band-4/15 border-band-4/40 text-band-4-text dark:bg-band-4/25 dark:text-emerald-200 dark:border-band-4/50"
      : isBorderline
        ? "bg-band-2/15 border-band-2/40 text-band-2-text dark:bg-band-2/25 dark:text-amber-200 dark:border-band-2/50"
        : "bg-band-1/15 border-band-1/40 text-band-1-text dark:bg-band-1/25 dark:text-orange-200 dark:border-band-1/50",
  });

  switch (criterionKey) {
    case "letter_formation_band": {
      if (measurement.letter_formation_mean != null) {
        const val = Number(measurement.letter_formation_mean);
        const isOptimal = val >= 80;
        const isBorderline = val >= 60;
        return {
          value: `${Math.round(val)}%`,
          target: "Target: ≥80% (CNN)",
          status: isOptimal ? "Optimal" : isBorderline ? "Developing" : "Needs Focus",
          ...buildMetricStyle(isOptimal, isBorderline),
        };
      }
      return null;
    }
    case "size_consistency_band": {
      if (
        measurement.size_consistency_mean != null &&
        !Number.isNaN(Number(measurement.size_consistency_mean))
      ) {
        const val = Number(measurement.size_consistency_mean);
        const isOptimal = val >= 0.85 && val <= 1.05;
        const isBorderline = (val >= 0.7 && val < 0.85) || (val > 1.05 && val <= 1.2);
        return {
          value: `${val.toFixed(2)}x`,
          target: "Target: 0.85–1.05x",
          status: isOptimal ? "Within Target" : isBorderline ? "Borderline" : "Deviating",
          ...buildMetricStyle(isOptimal, isBorderline),
        };
      }
      return null;
    }
    case "spacing_band": {
      if (
        measurement.word_spacing_mean != null &&
        !Number.isNaN(Number(measurement.word_spacing_mean))
      ) {
        const val = Number(measurement.word_spacing_mean);
        const isOptimal = val >= 1.5 && val <= 2.5;
        const isBorderline = (val >= 1.1 && val < 1.5) || (val > 2.5 && val <= 2.9);
        return {
          value: `${val.toFixed(2)}x`,
          target: "Target: 1.5–2.5x",
          status: isOptimal ? "Within Target" : isBorderline ? "Borderline" : "Deviating",
          ...buildMetricStyle(isOptimal, isBorderline),
        };
      }
      return null;
    }
    case "slant_band": {
      if (
        measurement.slant_mean != null &&
        !Number.isNaN(Number(measurement.slant_mean))
      ) {
        const val = Number(measurement.slant_mean);
        const isOptimal = val >= 6.0 && val <= 15.0;
        const isBorderline = (val >= 3.0 && val < 6.0) || (val > 15.0 && val <= 19.0);
        return {
          value: `${val.toFixed(1)}°`,
          target: "Target: 6°–15°",
          status: isOptimal ? "Within Target" : isBorderline ? "Borderline" : "Deviating",
          ...buildMetricStyle(isOptimal, isBorderline),
        };
      }
      return null;
    }
    case "baseline_alignment_band": {
      if (
        measurement.baseline_deviation_mean != null &&
        !Number.isNaN(Number(measurement.baseline_deviation_mean))
      ) {
        const val = Number(measurement.baseline_deviation_mean);
        const isOptimal = val <= 0.05;
        const isBorderline = val > 0.05 && val <= 0.15;
        return {
          value: `${val.toFixed(3)}`,
          target: "Target: ≤0.05",
          status: isOptimal ? "Within Target" : isBorderline ? "Borderline" : "High Drift",
          ...buildMetricStyle(isOptimal, isBorderline),
        };
      }
      return null;
    }
    default:
      return null;
  }
}

export interface ManualRubricEntryFormProps {
  submissionId: string;
  initialScores?: {
    letter_formation_band?: ScoreBand | null;
    size_consistency_band?: ScoreBand | null;
    spacing_band?: ScoreBand | null;
    slant_band?: ScoreBand | null;
    baseline_alignment_band?: ScoreBand | null;
  } | null;
  measurement?: Submission["measurement"];
  onSuccess?: () => void;
  onCancel?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onFocusCriterion?: (criterionName: string | null) => void;
  canGoNext?: boolean;
  onAdvanceNext?: () => void;
  onNavigateBack?: () => void;
  canRelease?: boolean;
  onSaveAndRelease?: (scores: {
    letter_formation_band: ScoreBand;
    size_consistency_band: ScoreBand;
    spacing_band: ScoreBand;
    slant_band: ScoreBand;
    baseline_alignment_band: ScoreBand;
  }) => Promise<void>;
}

export function ManualRubricEntryForm({
  submissionId,
  initialScores,
  measurement,
  onSuccess,
  onCancel,
  onDirtyChange,
  onFocusCriterion,
  canGoNext,
  onAdvanceNext,
  onNavigateBack,
  canRelease,
  onSaveAndRelease,
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
  const [layoutMode, setLayoutModeState] = useState<"stepper" | "list">(() =>
    readStoredLayoutMode()
  );
  const [autoAdvance, setAutoAdvanceState] = useState<boolean>(() =>
    readStoredAutoAdvance()
  );
  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [accessibilityAnnouncement, setAccessibilityAnnouncement] = useState<string>("");

  const setLayoutMode = useCallback((mode: "stepper" | "list") => {
    setLayoutModeState(mode);
    try {
      window.localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore storage errors in private browsing
    }
  }, []);

  const setAutoAdvance = useCallback((enabled: boolean) => {
    setAutoAdvanceState(enabled);
    try {
      window.localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, String(enabled));
    } catch {
      // ignore storage errors in private browsing
    }
  }, []);

  const isDirty = useMemo(() => {
    return (
      rubricScores.letter_formation_band !== (initialScores?.letter_formation_band ?? null) ||
      rubricScores.size_consistency_band !== (initialScores?.size_consistency_band ?? null) ||
      rubricScores.spacing_band !== (initialScores?.spacing_band ?? null) ||
      rubricScores.slant_band !== (initialScores?.slant_band ?? null) ||
      rubricScores.baseline_alignment_band !== (initialScores?.baseline_alignment_band ?? null)
    );
  }, [rubricScores, initialScores]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => {
      onDirtyChange?.(false);
    };
  }, [isDirty, onDirtyChange]);

  const requestCancel = useCallback(() => {
    if (!onCancel) return;
    if (isDirty) {
      setDiscardDialogOpen(true);
    } else {
      onCancel();
    }
  }, [onCancel, isDirty]);

  const formRef = useRef<HTMLDivElement>(null);
  const activeCriterionIndexRef = useRef(activeCriterionIndex);
  const rubricScoresRef = useRef(rubricScores);
  const handleSubmitRubricRef = useRef<() => void>(() => { });

  useEffect(() => {
    activeCriterionIndexRef.current = activeCriterionIndex;
  }, [activeCriterionIndex]);

  useEffect(() => {
    rubricScoresRef.current = rubricScores;
  }, [rubricScores]);

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
          if (err instanceof ApiError) {
            if (err.code === "SUBMISSION_NOT_FOUND") {
              setSubmitErrorMsg("This submission is no longer available.");
            } else if (err.code === "CALIBRATED_SCORING_ACTIVE") {
              setSubmitErrorMsg("Manual rubric scoring is disabled while calibrated scoring is active.");
            } else if (err.code === "INVALID_RUBRIC_SCORE") {
              setSubmitErrorMsg("All 5 criteria must be scored with a valid rubric band.");
            } else {
              setSubmitErrorMsg(err.message || "Failed to submit manual rubric score.");
            }
          } else {
            setSubmitErrorMsg("Failed to submit manual rubric score. Please try again.");
          }
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

  const [isSavingAndReleasing, setIsSavingAndReleasing] = useState(false);

  const handleSaveAndRelease = useCallback(async () => {
    if (!allBandsSelected || isSubmittingScore || isSavingAndReleasing || !onSaveAndRelease) return;
    setSubmitErrorMsg(null);
    setIsSavingAndReleasing(true);
    try {
      await onSaveAndRelease({
        letter_formation_band: rubricScores.letter_formation_band!,
        size_consistency_band: rubricScores.size_consistency_band!,
        spacing_band: rubricScores.spacing_band!,
        slant_band: rubricScores.slant_band!,
        baseline_alignment_band: rubricScores.baseline_alignment_band!,
      });
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSubmitErrorMsg(err.message || "Failed to save and release rubric score.");
      } else {
        setSubmitErrorMsg("Failed to save and release. Please try again.");
      }
    } finally {
      setIsSavingAndReleasing(false);
    }
  }, [
    allBandsSelected,
    isSubmittingScore,
    isSavingAndReleasing,
    onSaveAndRelease,
    rubricScores,
    onSuccess,
  ]);

  useEffect(() => {
    handleSubmitRubricRef.current = handleSubmitRubric;
  }, [handleSubmitRubric]);

  const compositeRubric = useMemo(() => {
    return calculateCompositeRubric(rubricScores);
  }, [rubricScores]);

  const handleApplyPreset = useCallback((band: ScoreBand) => {
    const previousScores = { ...rubricScoresRef.current };
    setRubricScores({
      letter_formation_band: band,
      size_consistency_band: band,
      spacing_band: band,
      slant_band: band,
      baseline_alignment_band: band,
    });
    setSubmitErrorMsg(null);
    const bandMeta = getBandMeta(band);
    setAccessibilityAnnouncement(`All 5 criteria set to ${bandMeta.label}.`);
    toast.success(`Preset applied: All ${bandMeta.label}`, {
      action: {
        label: "Undo",
        onClick: () => {
          setRubricScores(previousScores);
          setAccessibilityAnnouncement("Previous rubric ratings restored.");
        },
      },
      duration: 6000,
    });
  }, []);

  const handleSelectCriterion = (index: number) => {
    setActiveCriterionIndex(index);
    onFocusCriterion?.(RUBRIC_CRITERIA[index].shortName);
  };

  // Keyboard accelerators (1, 2, 3, 4 to rate & advance, Alt+1-4 for presets, Ctrl+Enter to submit)
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

      // Cancel edit shortcut: Escape key guards unsaved ratings before reverting
      if (e.key === "Escape" && onCancel) {
        e.preventDefault();
        e.stopPropagation();
        requestCancel();
        return;
      }

      // Submit shortcut: Ctrl+Enter or Cmd+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmitRubricRef.current();
        return;
      }

      // Alt+1 to Alt+4 for fast batch presets:
      // Alt+4: All Excellent, Alt+3: All Satisfactory, Alt+2: All Developing, Alt+1: All Needs Improvement
      if (e.altKey && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const bandIndex = parseInt(e.key, 10) - 1;
        const targetOption = RUBRIC_BANDS[bandIndex];
        if (targetOption) {
          handleApplyPreset(targetOption.band);
        }
        return;
      }

      // Keys 1 - 4 for fast rubric rating (guard against canvas zooming, modal dialogs, outside typing)
      if (["1", "2", "3", "4"].includes(e.key)) {
        if (e.altKey || e.ctrlKey || e.metaKey) return;

        const target = e.target as HTMLElement | null;
        if (
          target?.closest?.('[data-inspector-container="true"]') ||
          target?.closest?.('[role="dialog"]:not([data-rubric-dialog])') ||
          target?.closest?.('[role="tablist"]') ||
          target?.isContentEditable
        ) {
          return;
        }

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

        // Auto-advance to the next criterion without wrapping around from 5 -> 1
        const currentIndex = activeCriterionIndexRef.current;
        const nextIndex = Math.min(currentIndex + 1, RUBRIC_CRITERIA.length - 1);
        if (nextIndex !== currentIndex) {
          setActiveCriterionIndex(nextIndex);
          onFocusCriterion?.(RUBRIC_CRITERIA[nextIndex].shortName);
        }

        // Screen reader announcement for keyboard grading
        setAccessibilityAnnouncement(
          nextIndex !== currentIndex
            ? `${currentCriterion.shortName} rated ${targetOption.label} (${targetOption.score}). Active criterion: ${RUBRIC_CRITERIA[nextIndex].shortName}.`
            : `${currentCriterion.shortName} rated ${targetOption.label} (${targetOption.score}). Final criterion reached.`
        );

        // Programmatically shift focus to the active/next criterion's radio group
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
  }, [onFocusCriterion, handleApplyPreset, onCancel, requestCancel]);

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

    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      targetOptionIdx = (currentOptionIdx + 1) % RUBRIC_BANDS.length;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
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
      className="@container p-2.5 sm:p-3.5 rounded-xl bg-surface dark:bg-card border border-border shadow-xs space-y-2.5"
    >
      {/* Screen reader live announcement region */}
      <div className="sr-only" role="status" aria-live="polite">
        {accessibilityAnnouncement}
      </div>

      {/* Single-row toolbar: status badge on left, quick fill + layout mode + keyboard help on right */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60 flex-wrap">
        <Badge
          variant="outline"
          className={`text-[11px] font-semibold px-2 py-0.5 shrink-0 font-sans tabular-nums inline-flex items-center ${allBandsSelected && compositeRubric
              ? compositeRubric.overallBandMeta.badgeClass
              : "bg-band-2/15 text-amber-900 dark:bg-band-2/25 dark:text-amber-200 border-band-2/40"
            }`}
        >
          {allBandsSelected && compositeRubric ? (
            <span>
              {compositeRubric.totalPoints}/20 pts ({compositeRubric.avgPercentage}%) • {compositeRubric.overallBandMeta.label}
            </span>
          ) : (
            <span>{selectedCount}/5 rated</span>
          )}
        </Badge>

        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmittingScore}
                  className="h-10 sm:h-7 min-h-[40px] sm:min-h-0 px-2.5 text-xs sm:text-[11px] font-medium gap-1.5 rounded-lg cursor-pointer touch-manipulation text-muted-foreground hover:text-foreground"
                />
              }
            >
              <SlidersHorizontal className="size-3.5 sm:size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>Quick fill</span>
              <ChevronDown className="size-3.5 sm:size-3 opacity-70" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52 rounded-xl p-1">
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
                Set all 5 criteria at once
              </DropdownMenuLabel>
              {RUBRIC_BANDS.map((option) => (
                <DropdownMenuItem
                  key={option.band}
                  onClick={() => handleApplyPreset(option.band)}
                  className="rounded-lg px-2.5 py-2 text-xs justify-between cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <span className={`size-2 rounded-full ${option.dotColor}`} aria-hidden="true" />
                    <span>All {option.label}</span>
                  </span>
                  <kbd className="text-[10px] font-mono text-muted-foreground ml-3">
                    Alt+{option.shortcutKey}
                  </kbd>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/80 shrink-0">
            <button
              type="button"
              onClick={() => setLayoutMode("stepper")}
              className={`px-2 py-1 rounded-md text-xs sm:text-[11px] font-semibold transition-colors cursor-pointer min-h-10 sm:min-h-[26px] flex items-center gap-1 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${layoutMode === "stepper"
                  ? "bg-surface dark:bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
                }`}
              aria-pressed={layoutMode === "stepper"}
              title="Focus Mode (1 criterion at a time)"
            >
              <Layers className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>Focus</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("list")}
              className={`px-2 py-1 rounded-md text-xs sm:text-[11px] font-semibold transition-colors cursor-pointer min-h-10 sm:min-h-[26px] flex items-center gap-1 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${layoutMode === "list"
                  ? "bg-surface dark:bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
                }`}
              aria-pressed={layoutMode === "list"}
              title="All Mode (show all 5 criteria)"
            >
              <LayoutList className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>All (5)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowKeyboardHelp((prev) => !prev)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg cursor-pointer flex items-center justify-center min-h-10 min-w-10 sm:min-h-7 sm:min-w-7 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            title="Toggle Keyboard Shortcuts (Keys 1–4)"
            aria-label="Toggle Keyboard Shortcuts"
            aria-expanded={showKeyboardHelp}
          >
            <Keyboard className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint Bar */}
      {showKeyboardHelp && (
        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/70 text-[11px] text-muted-foreground flex items-center justify-between gap-x-3 gap-y-1.5 flex-wrap animate-in fade-in-50 duration-150 motion-reduce:animate-none">
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            <span><kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono font-semibold text-[10px]">1–4</kbd> Rate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono font-semibold text-[10px]">Alt+1–4</kbd> Quick fill</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono font-semibold text-[10px]">J/K</kbd> Student</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono font-semibold text-[10px]">C</kbd> Ink</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono font-semibold text-[10px]">L</kbd> Magnify</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono font-semibold text-[10px]">+/-/0</kbd> Zoom</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono font-semibold text-[10px]">Alt+[/]</kbd> Focus area</span>
          </div>
          <span><kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono font-semibold text-[10px]">Ctrl+Enter</kbd> Submit</span>
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
          {/* 5-Step Navigation Pills (with criterion names + dual-signal score indicators) */}
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
                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border text-center transition-all cursor-pointer min-h-[42px] touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${isStepActive
                      ? "bg-brand-100 dark:bg-brand-950 text-brand-950 dark:text-brand-200 border-brand-500 ring-2 ring-brand-400/40 font-bold"
                      : isRated
                        ? "bg-surface dark:bg-card border-brand-200/80 dark:border-brand-900/80 text-foreground"
                        : "bg-muted/30 border-border/60 text-muted-foreground hover:border-border"
                    }`}
                  aria-label={`Step ${idx + 1}: ${criterion.shortName}${isRated ? ` (Rated: ${bandMeta.label}, ${bandMeta.points} of 4 points)` : " (Unrated)"}`}
                  aria-current={isStepActive ? "step" : undefined}
                >
                  <span className="text-[11px] font-sans tabular-nums leading-tight font-semibold truncate max-w-full">
                    {idx + 1}. {criterion.stepLabel}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] font-sans tabular-nums leading-none">
                    {isRated ? (
                      <>
                        <span
                          className={`size-1.5 rounded-full shrink-0 ${bandMeta.dotColor}`}
                          aria-hidden="true"
                        />
                        <span className="font-semibold">{bandMeta.points}/4</span>
                      </>
                    ) : (
                      <>
                        <span className="size-1.5 rounded-full bg-muted-foreground/30 shrink-0" aria-hidden="true" />
                        <span className="text-muted-foreground/80">—</span>
                      </>
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
            const metric = extractCriterionCVMetric(currentCriterion.key, measurement);

            return (
              <fieldset
                role="radiogroup"
                aria-labelledby={`stepper-criterion-label-${currentCriterion.key}`}
                className="space-y-2 p-3 sm:p-3.5 rounded-xl border bg-muted/20 border-brand-300/80 dark:border-brand-800/80 ring-1 ring-brand-400/30 shadow-xs"
              >
                <div className="min-w-0">
                  <legend
                    id={`stepper-criterion-label-${currentCriterion.key}`}
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5 flex-wrap"
                  >
                    <span>{currentCriterion.name}</span>
                    {metric && (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-sans font-medium border tabular-nums ${metric.badgeClass}`}
                        title={`CV Measurement: ${metric.value} (${metric.target}) - ${metric.status}`}
                      >
                        <span className={`size-1.5 rounded-full ${metric.dotClass}`} aria-hidden="true" />
                        <span className="font-semibold">{metric.value}</span>
                      </span>
                    )}
                  </legend>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {guide?.rubricGoal ?? currentCriterion.hint}
                  </p>
                </div>

                {/* Segmented 4-Radio Buttons with Responsive Grid */}
                <div className="grid grid-cols-2 @[480px]:grid-cols-4 gap-1.5 pt-0.5">
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
                          if (activeCriterionIndex < RUBRIC_CRITERIA.length - 1) {
                            const nextIdx = activeCriterionIndex + 1;
                            setActiveCriterionIndex(nextIdx);
                            onFocusCriterion?.(RUBRIC_CRITERIA[nextIdx].shortName);
                          }
                        }}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-center transition-all cursor-pointer min-h-[42px] @[480px]:min-h-[38px] touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${isChecked
                            ? option.activeClass
                            : "bg-surface dark:bg-card border-border/70 text-foreground/80 hover:text-foreground hover:bg-muted/50 hover:border-border"
                          }`}
                      >
                        <span className="text-[11px] font-sans tabular-nums font-medium text-muted-foreground shrink-0">
                          [{option.shortcutKey}]
                        </span>
                        <span className="text-xs leading-tight font-semibold truncate">
                          {option.shortLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

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
                    className="h-10 sm:h-7 min-h-[40px] sm:min-h-0 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 touch-manipulation"
                  >
                    <ChevronLeft className="size-3.5" aria-hidden="true" />
                    <span>Prev</span>
                  </Button>

                  <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                    {activeCriterionIndex + 1} / {RUBRIC_CRITERIA.length}
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
                    className="h-10 sm:h-7 min-h-[40px] sm:min-h-0 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 touch-manipulation"
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
        className={`space-y-2 ${layoutMode === "stepper" ? "hidden" : "block"}`}
        role="group"
        aria-label="5-Criterion Handwriting Rubric"
      >
        {RUBRIC_CRITERIA.map((criterion, idx) => {
          const selectedBand = rubricScores[criterion.key];
          const isFocused = activeCriterionIndex === idx;
          const metric = extractCriterionCVMetric(criterion.key, measurement);

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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <legend
                  id={`criterion-label-${criterion.key}`}
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer flex-wrap"
                >
                  <span>{idx + 1}. {criterion.name}</span>
                  {metric && (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-sans font-medium border tabular-nums ${metric.badgeClass}`}
                      title={`CV Measurement: ${metric.value} (${metric.target}) - ${metric.status}`}
                    >
                      <span className={`size-1.5 rounded-full ${metric.dotClass}`} aria-hidden="true" />
                      <span className="font-semibold">{metric.value}</span>
                    </span>
                  )}
                </legend>
              </div>

              {/* Segmented 4-Radio Buttons with WAI-ARIA Roving Tabindex & Mobile Touch Sizing */}
              <div className="grid grid-cols-2 @[480px]:grid-cols-4 gap-1.5">
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
                      className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-center transition-all cursor-pointer min-h-[40px] @[480px]:min-h-[34px] touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${isChecked
                          ? option.activeClass
                          : "bg-surface dark:bg-card border-border/70 text-foreground/80 hover:text-foreground hover:bg-muted/50 hover:border-border"
                        }`}
                    >
                      <span className="text-[11px] font-sans tabular-nums font-medium text-muted-foreground shrink-0">
                        [{option.shortcutKey}]
                      </span>
                      <span className="text-[11px] leading-tight font-medium truncate">
                        {option.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      {/* Form Submit Footer */}
      <div className="flex flex-col @[460px]:flex-row @[460px]:items-center justify-between pt-2 border-t border-border/60 gap-2.5">
        <div className="text-[11px] text-muted-foreground flex items-center justify-between @[460px]:justify-start gap-3 flex-wrap">
          {allBandsSelected && compositeRubric ? (
            <span className="text-brand-700 dark:text-brand-300 font-medium flex items-center gap-1.5 font-sans tabular-nums">
              <Check className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>All 5 criteria rated ({compositeRubric.totalPoints}/20 pts)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <HelpCircle className="size-3 text-muted-foreground" aria-hidden="true" />
              <span>Rate all 5 to submit ({selectedCount}/5)</span>
            </span>
          )}

          {canGoNext && (
            <label className="inline-flex items-center gap-1.5 text-xs sm:text-[11px] text-muted-foreground cursor-pointer select-none touch-manipulation px-2 py-1 rounded-md hover:bg-muted/40 transition-colors min-h-10 sm:min-h-0">
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
              />
              <span>Next student on save</span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-2 w-full @[460px]:w-auto">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={requestCancel}
              className="flex-1 @[460px]:flex-initial h-10 sm:h-8 min-h-[40px] sm:min-h-0 px-3.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer touch-manipulation"
            >
              Cancel
            </Button>
          )}

          {canRelease && onSaveAndRelease && (
            <Button
              type="button"
              size="sm"
              disabled={!allBandsSelected || isSubmittingScore || isSavingAndReleasing}
              onClick={() => void handleSaveAndRelease()}
              className="flex-1 @[460px]:flex-initial h-10 sm:h-8 min-h-[40px] sm:min-h-0 px-3.5 bg-brand-600 hover:bg-brand-700 text-white dark:bg-brand-500 dark:hover:bg-brand-600 text-xs font-semibold rounded-lg sm:rounded-xl gap-1.5 shadow-xs cursor-pointer disabled:cursor-not-allowed touch-manipulation"
              title="Save rubric score and immediately release to parent portal"
            >
              {isSavingAndReleasing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  <span>Releasing...</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5" aria-hidden="true" />
                  <span>Save & Release</span>
                </>
              )}
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant={canRelease && onSaveAndRelease ? "outline" : "default"}
            disabled={!allBandsSelected || isSubmittingScore || isSavingAndReleasing}
            onClick={handleSubmitRubric}
            className={`flex-1 @[460px]:flex-initial w-full @[460px]:w-auto h-10 sm:h-8 min-h-[40px] sm:min-h-0 px-4 text-xs font-semibold rounded-lg sm:rounded-xl gap-1.5 shadow-xs cursor-pointer disabled:cursor-not-allowed touch-manipulation ${
              canRelease && onSaveAndRelease
                ? "border-border/80 hover:bg-muted/60"
                : "bg-primary hover:bg-brand-700 text-primary-foreground"
            }`}
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
                <span>Save Privately</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Unsaved Ratings Discard Confirmation */}
      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved rubric ratings?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved ratings on this worksheet. Canceling now will revert them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDiscardDialogOpen(false)}
              className="min-h-10 sm:min-h-9"
            >
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDiscardDialogOpen(false);
                onCancel?.();
              }}
              variant="destructive"
              className="min-h-10 sm:min-h-9 cursor-pointer"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

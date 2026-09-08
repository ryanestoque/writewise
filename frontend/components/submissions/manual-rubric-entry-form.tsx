"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type ScoreBand,
  type ManualScore,
  useSubmitManualScore,
} from "@/lib/hooks/use-submissions";
import {
  Award,
  Keyboard,
  Layers,
  LayoutList,
  SlidersHorizontal,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  Eye,
  Check,
  HelpCircle,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";

export const CRITERIA_GUIDE: Record<
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

export const RUBRIC_BANDS: Array<{
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
      "bg-band-1/15 dark:bg-band-1/30 text-band-1 dark:text-[#f3c8aa] border-band-1 ring-2 ring-band-1/40 shadow-xs font-semibold",
    badgeClass:
      "bg-band-1/15 text-band-1 dark:text-[#f3c8aa] border-band-1/40",
    dotColor: "bg-band-1",
  },
  {
    band: "developing",
    label: "Developing",
    shortLabel: "Developing",
    shortcutKey: "2",
    score: "37.5%",
    activeClass:
      "bg-band-2/15 dark:bg-band-2/30 text-amber-900 dark:text-[#fae59a] border-band-2 ring-2 ring-band-2/40 shadow-xs font-semibold",
    badgeClass:
      "bg-band-2/15 text-amber-900 dark:text-[#fae59a] border-band-2/40",
    dotColor: "bg-band-2",
  },
  {
    band: "satisfactory",
    label: "Satisfactory",
    shortLabel: "Satisfactory",
    shortcutKey: "3",
    score: "62.5%",
    activeClass:
      "bg-band-3/15 dark:bg-band-3/30 text-emerald-950 dark:text-[#c4deba] border-band-3 ring-2 ring-band-3/40 shadow-xs font-semibold",
    badgeClass:
      "bg-band-3/15 text-emerald-950 dark:text-[#c4deba] border-band-3/40",
    dotColor: "bg-band-3",
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
  const maxPoints = 20; // 5 criteria * 4 max points
  const avgPercentage = Math.round(
    validBands.reduce((acc, b) => acc + BAND_NUMERIC_SCORES[b], 0) / validBands.length
  );

  let overallBandMeta = RUBRIC_BANDS[0];
  if (avgPercentage >= 75) {
    overallBandMeta = RUBRIC_BANDS[3]; // Excellent
  } else if (avgPercentage >= 55) {
    overallBandMeta = RUBRIC_BANDS[2]; // Satisfactory
  } else if (avgPercentage >= 30) {
    overallBandMeta = RUBRIC_BANDS[1]; // Developing
  } else {
    overallBandMeta = RUBRIC_BANDS[0]; // Needs Improvement
  }

  return {
    totalPoints,
    maxPoints,
    avgPercentage,
    overallBandMeta,
    isComplete: validBands.length === 5,
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
  hint: string;
}> = [
  {
    key: "letter_formation_band",
    name: "Letter Formation",
    shortName: "Letter Formation",
    hint: "Proper cursive loops and complete stroke closures",
  },
  {
    key: "size_consistency_band",
    name: "Size Consistency",
    shortName: "Size Consistency",
    hint: "Proportion and height across 3-line penmanship ruling",
  },
  {
    key: "spacing_band",
    name: "Spacing",
    shortName: "Spacing",
    hint: "Inter-word rhythm and character separation spacing",
  },
  {
    key: "slant_band",
    name: "Slant Angle",
    shortName: "Slant Angle",
    hint: "Uniform forward slant tilt (target 60°–68° angle)",
  },
  {
    key: "baseline_alignment_band",
    name: "Baseline Alignment",
    shortName: "Baseline Alignment",
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
      activeClass: "",
      badgeClass: "bg-muted/60 text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
    }
  );
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
  onSuccess?: () => void;
  onFocusCriterion?: (criterionName: string | null) => void;
  canGoNext?: boolean;
  onAdvanceNext?: () => void;
  onNavigateBack?: () => void;
}

export function ManualRubricEntryForm({
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
  const [layoutMode, setLayoutMode] = useState<"stepper" | "list">("list");
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [accessibilityAnnouncement, setAccessibilityAnnouncement] = useState<string>("");

  const formRef = useRef<HTMLDivElement>(null);
  const activeCriterionIndexRef = useRef(activeCriterionIndex);
  const handleSubmitRubricRef = useRef<() => void>(() => {});

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

  const compositeRubric = useMemo(() => {
    return calculateCompositeRubric(rubricScores);
  }, [rubricScores]);

  const handleApplyPreset = useCallback((band: ScoreBand) => {
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
    toast.success(`Preset applied: All ${bandMeta.label} (${bandMeta.shortcutKey}s)`);
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
  }, [onFocusCriterion, handleApplyPreset]);

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
              className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer min-h-[36px] sm:min-h-[28px] flex items-center gap-1 touch-manipulation ${
                layoutMode === "stepper"
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
              className={`px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer min-h-[36px] sm:min-h-[28px] flex items-center gap-1 touch-manipulation ${
                layoutMode === "list"
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
            className={`text-[11px] font-semibold px-2.5 py-0.5 shrink-0 font-sans tabular-nums inline-flex items-center ${
              allBandsSelected && compositeRubric
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
        </div>
      </div>

      {/* Quick Batch Presets Row */}
      <div className="flex items-center justify-between gap-2 pt-0.5 pb-0.5 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 shrink-0">
            <SlidersHorizontal className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            <span>Presets:</span>
          </span>
          <button
            type="button"
            onClick={() => handleApplyPreset("satisfactory")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-band-3/15 text-emerald-950 dark:text-[#c4deba] border border-band-3/35 hover:bg-band-3/25 transition-colors cursor-pointer min-h-[28px] touch-manipulation"
            title="Rate all 5 criteria as Satisfactory (Alt+3)"
          >
            <span className="size-1.5 rounded-full bg-band-3" aria-hidden="true" />
            <span>All Satisfactory</span>
            <kbd className="text-[9px] font-mono opacity-70 ml-0.5 hidden sm:inline">Alt+3</kbd>
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("excellent")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border border-brand-300/70 hover:bg-brand-100 transition-colors cursor-pointer min-h-[28px] touch-manipulation"
            title="Rate all 5 criteria as Excellent (Alt+4)"
          >
            <span className="size-1.5 rounded-full bg-brand-600 dark:bg-brand-400" aria-hidden="true" />
            <span>All Excellent</span>
            <kbd className="text-[9px] font-mono opacity-70 ml-0.5 hidden sm:inline">Alt+4</kbd>
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("developing")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-band-2/15 text-amber-900 dark:text-[#fae59a] border border-band-2/35 hover:bg-band-2/25 transition-colors cursor-pointer min-h-[28px] touch-manipulation"
            title="Rate all 5 criteria as Developing (Alt+2)"
          >
            <span className="size-1.5 rounded-full bg-band-2" aria-hidden="true" />
            <span>All Developing</span>
            <kbd className="text-[9px] font-mono opacity-70 ml-0.5 hidden sm:inline">Alt+2</kbd>
          </button>
        </div>

        {compositeRubric && (
          <div className="flex items-center gap-1.5 text-[11px] shrink-0 font-sans tabular-nums ml-auto">
            <span className="text-muted-foreground hidden sm:inline">Cumulative:</span>
            <span className="font-semibold text-foreground">
              {compositeRubric.totalPoints}/{compositeRubric.maxPoints} pts ({compositeRubric.avgPercentage}%)
            </span>
          </div>
        )}
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
          <div className="pt-1 border-t border-brand-200/60 dark:border-brand-900/60 flex items-center justify-between gap-2 flex-wrap text-muted-foreground text-[10.5px]">
            <span><kbd className="px-1 py-0.5 rounded bg-background border border-border font-mono text-[10px]">Alt+3</kbd> All Satisfactory</span>
            <span><kbd className="px-1 py-0.5 rounded bg-background border border-border font-mono text-[10px]">Alt+4</kbd> All Excellent</span>
            <span><kbd className="px-1 py-0.5 rounded bg-background border border-border font-mono text-[10px]">Ctrl+Enter</kbd> Submit</span>
            <span><kbd className="px-1 py-0.5 rounded bg-background border border-border font-mono text-[10px]">J/K</kbd> Prev/Next</span>
          </div>
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
                  className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg border text-center transition-all cursor-pointer min-h-[40px] touch-manipulation ${
                    isStepActive
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
                        className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all cursor-pointer min-h-[46px] sm:min-h-[40px] touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${
                          isChecked
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
              className={`space-y-1.5 p-2.5 rounded-xl border transition-all ${
                isFocused
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
                  <span>{idx + 1}. {criterion.name}</span>
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
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${
                        isChecked
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
        <div className="text-[11px] text-muted-foreground flex items-center justify-between sm:justify-start gap-3 flex-wrap">
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
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none touch-manipulation px-2 py-1 rounded-md hover:bg-muted/40 transition-colors min-h-[32px] sm:min-h-0">
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

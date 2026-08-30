"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type ScoreBand,
  type Submission,
  useSubmissionImageUrl,
  useSubmitManualScore,
} from "@/lib/hooks/use-submissions";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  User,
  GraduationCap,
  Maximize2,
  Minimize2,
  FileText,
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Award,
  ScanLine,
  Binary,
  Check,
  Loader2,
  ShieldCheck,
  CheckCheck,
  Edit3,
  Keyboard,
  HelpCircle,
} from "lucide-react";

interface SubmissionDetailDialogProps {
  submission: Submission | null;
  submissions?: Submission[];
  currentIndex?: number;
  onNavigate?: (submission: Submission) => void;
  activityTargetText?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REJECTION_GUIDE: Record<
  string,
  { title: string; description: string; advice: string }
> = {
  QUALITY_GATE_BLUR: {
    title: "Blurry or Out-of-Focus Photo",
    description:
      "The OpenCV quality gate detected motion blur or soft focus that prevents accurate cursive stroke extraction.",
    advice:
      "Hold the camera steady, tap to focus on the handwriting, and ensure adequate lighting before snapping.",
  },
  QUALITY_GATE_LIGHTING: {
    title: "Poor or Uneven Lighting",
    description:
      "Heavy shadows or strong glare obscured the 3-line penmanship ruling.",
    advice:
      "Position the worksheet in bright, indirect natural or classroom light without direct overhead flash glare.",
  },
  QUALITY_GATE_SKEW: {
    title: "Excessive Worksheet Skew",
    description:
      "The page was captured at too steep an angle for automated perspective correction.",
    advice:
      "Hold the camera parallel directly above the paper to capture a flat, rectangular top-down view.",
  },
  QUALITY_GATE_OCCLUDED: {
    title: "Worksheet Corners or Text Occluded",
    description:
      "Fingers, shadows, or page curl covered the alignment ruling or student writing.",
    advice:
      "Ensure all four corners and the entire target prompt area are clearly visible within the camera frame.",
  },
  QUALITY_GATE_NO_TEXT: {
    title: "No Handwriting Detected",
    description:
      "The system could not detect student handwriting strokes on the ruling lines.",
    advice:
      "Verify the student has written with a high-contrast dark pencil or pen, and the writing area is in frame.",
  },
  SEGMENTATION_COUNT_MISMATCH: {
    title: "Word Count Mismatch",
    description:
      "The number of segmented words does not match the expected prompt text.",
    advice:
      "Check that the student wrote the complete prompt on the worksheet without skipping words or adding extra lines.",
  },
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
}

function ManualRubricEntryForm({
  submissionId,
  initialScores,
  onSuccess,
  onFocusCriterion,
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
  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

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
  }, [allBandsSelected, isSubmittingScore, submissionId, rubricScores, submitManualScore, onSuccess]);

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
        const targetBand = RUBRIC_BANDS[bandIndex]?.band;
        if (!targetBand) return;

        const currentCriterion =
          RUBRIC_CRITERIA[activeCriterionIndexRef.current];
        if (!currentCriterion) return;

        e.preventDefault();

        // Update score
        setRubricScores((prev) => ({
          ...prev,
          [currentCriterion.key]: targetBand,
        }));

        // Auto-advance to the next criterion
        const nextIndex =
          (activeCriterionIndexRef.current + 1) % RUBRIC_CRITERIA.length;
        setActiveCriterionIndex(nextIndex);
        onFocusCriterion?.(RUBRIC_CRITERIA[nextIndex].shortName);
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

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      targetOptionIdx = (currentOptionIdx + 1) % RUBRIC_BANDS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      targetOptionIdx =
        (currentOptionIdx - 1 + RUBRIC_BANDS.length) % RUBRIC_BANDS.length;
    }

    if (targetOptionIdx !== null) {
      const targetBand = RUBRIC_BANDS[targetOptionIdx].band;
      setRubricScores((prev) => ({
        ...prev,
        [criterionKey]: targetBand,
      }));
      handleSelectCriterion(criterionIdx);

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
      {/* Header with status counter & keyboard hint toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2.5 border-b border-border/60">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Award className="size-4 text-brand-600 dark:text-brand-400" />
            <h4 className="text-xs font-heading font-semibold text-foreground">
              Teacher Rubric Assessment
            </h4>
            <button
              type="button"
              onClick={() => setShowKeyboardHelp((prev) => !prev)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 sm:p-1 -m-1 sm:m-0 rounded-md cursor-pointer flex items-center justify-center min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0"
              title="Toggle Keyboard Shortcuts"
              aria-label="Toggle Keyboard Shortcuts"
            >
              <Keyboard className="size-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Evaluate student penmanship across 5 core criteria to finalize assessment scores.
          </p>
        </div>

        <Badge
          variant="outline"
          className={`text-[10px] font-semibold px-2 py-0.5 shrink-0 self-start sm:self-auto ${
            allBandsSelected
              ? "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border-brand-300"
              : "bg-[#c9a227]/15 text-[#6e4e00] dark:bg-[#c9a227]/25 dark:text-[#fae59a] border-[#c9a227]/40"
          }`}
        >
          {selectedCount}/5 rated
        </Badge>
      </div>

      {/* Keyboard Shortcuts Hint Bar */}
      {showKeyboardHelp && (
        <div className="p-2.5 rounded-lg bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 text-[11px] text-brand-900 dark:text-brand-200 space-y-1 animate-in fade-in-50 duration-150">
          <div className="flex items-center gap-1.5 font-semibold">
            <Keyboard className="size-3.5 text-brand-600 dark:text-brand-400" />
            <span>Fast Keyboard Grading</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[10px] text-brand-800 dark:text-brand-300">
            <div><kbd className="px-1 py-0.5 rounded bg-background border border-brand-300 font-mono font-bold">1</kbd> Needs Imp.</div>
            <div><kbd className="px-1 py-0.5 rounded bg-background border border-brand-300 font-mono font-bold">2</kbd> Developing</div>
            <div><kbd className="px-1 py-0.5 rounded bg-background border border-brand-300 font-mono font-bold">3</kbd> Satisfactory</div>
            <div><kbd className="px-1 py-0.5 rounded bg-background border border-brand-300 font-mono font-bold">4</kbd> Excellent</div>
          </div>
          <p className="text-[10px] text-muted-foreground pt-0.5">
            Pressing a number rates the active criterion and automatically advances to the next. Press <kbd className="px-1 py-0.5 rounded bg-background border border-border font-mono">Ctrl+Enter</kbd> to submit.
          </p>
        </div>
      )}

      {submitErrorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold block">Submission Error</span>
            <span>{submitErrorMsg}</span>
          </div>
        </div>
      )}

      {/* 5 Criteria Rating Groups with WAI-ARIA RadioGroup & Visual Active Highlighting */}
      <div className="space-y-2.5" role="group" aria-label="5-Criterion Handwriting Rubric">
        {RUBRIC_CRITERIA.map((criterion, idx) => {
          const selectedBand = rubricScores[criterion.key];
          const isFocused = activeCriterionIndex === idx;

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
                  <span>{criterion.name}</span>
                  {isFocused && (
                    <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium font-sans">
                      (Active)
                    </span>
                  )}
                </legend>
                {selectedBand && (
                  <span className="text-[10px] font-mono font-semibold text-muted-foreground">
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
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer min-h-[44px] sm:min-h-[38px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${
                        isChecked
                          ? option.activeClass
                          : "bg-surface dark:bg-card border-border/70 text-foreground/80 hover:text-foreground hover:bg-muted/50 hover:border-border"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono font-medium text-muted-foreground">
                          [{option.shortcutKey}]
                        </span>
                        <span className="text-[11px] leading-tight font-medium">
                          {option.shortLabel}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground/90 mt-0.5">
                        {option.score}
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
      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <div className="text-[11px] text-muted-foreground">
          {allBandsSelected ? (
            <span className="text-brand-700 dark:text-brand-300 font-medium flex items-center gap-1">
              <Check className="size-3" />
              All 5 criteria rated
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <HelpCircle className="size-3 text-muted-foreground" />
              <span>Rate all 5 to submit</span>
            </span>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          disabled={!allBandsSelected || isSubmittingScore}
          onClick={handleSubmitRubric}
          className="h-9 sm:h-8 min-h-[36px] sm:min-h-[32px] px-4 bg-primary hover:bg-brand-700 text-primary-foreground text-xs font-semibold rounded-lg sm:rounded-xl gap-1.5 shadow-xs cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmittingScore ? (
            <>
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <CheckCheck className="size-3.5" />
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

  const [selectedCriterion, setSelectedCriterion] = useState<string | null>(
    "Letter Formation"
  );
  const [phase1Tab, setPhase1Tab] = useState<"rubric" | "metrics">("rubric");
  const [isEditingRubric, setIsEditingRubric] = useState(false);

  const { data: imageUrl, isLoading: isImageLoading } = useSubmissionImageUrl(
    submission.image_path ?? null
  );

  // Keyboard navigation for submission cycling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement &&
          e.target.closest("[role='radiogroup']"))
      ) {
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

  const rejectionInfo = submission.rejection_code
    ? REJECTION_GUIDE[submission.rejection_code] ?? {
        title: "Worksheet Assessment Issue",
        description: `Quality check returned code: ${submission.rejection_code}`,
        advice:
          "Please verify that the worksheet is well-lit, in focus, and written with a clear pen or pencil.",
      }
    : null;

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

  // Memoize criteria lists to prevent re-computation on every render
  const criteria = useMemo(
    () => [
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
    ],
    [measurement]
  );

  const rawCriteria = useMemo(
    () => [
      {
        name: "Letter Formation",
        primaryValue:
          measurement?.letter_formation_mean != null
            ? formatMetric(
                measurement.letter_formation_mean,
                measurement.letter_formation_std,
                "%"
              )
            : "Awaiting CNN",
        description:
          "Evaluates loop closures, ascender/descender balance, and cursive curvature.",
        subDetails: [
          {
            label: "Inference state",
            value:
              measurement?.letter_formation_mean != null
                ? "Extracted"
                : "Pending Stage 1 Model",
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
          "Proportion of core lowercase x-height relative to printed guideline spacing.",
        subDetails: [
          {
            label: "Core height ratio",
            value: formatMetric(measurement?.size_consistency_mean),
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
          "word gap"
        ),
        description:
          "Inter-word gap widths and candidate inter-letter stroke rhythm normalized to ruling.",
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
        ],
      },
      {
        name: "Slant Angle",
        primaryValue:
          measurement?.slant_mean != null
            ? `${Number(measurement.slant_mean).toFixed(1)}°${
                measurement.slant_std != null
                  ? ` ± ${Number(measurement.slant_std).toFixed(1)}°`
                  : ""
              }`
            : "—",
        description:
          "Average stroke tilt relative to vertical guide perpendicular (Target: 60°–68° / ~22° tilt).",
        subDetails: [
          {
            label: "Mean slant tilt",
            value:
              measurement?.slant_mean != null
                ? `${Number(measurement.slant_mean).toFixed(1)}°`
                : "—",
          },
          {
            label: "Slant std dev",
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
          "Vertical distance ratio from word bottom ink boundary to detected ruling baseline.",
        subDetails: [
          {
            label: "Mean baseline drift",
            value: formatMetric(measurement?.baseline_deviation_mean),
          },
          {
            label: "Drift variation (std)",
            value: formatMetric(measurement?.baseline_deviation_std),
          },
        ],
      },
    ],
    [measurement]
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
    <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-4xl max-w-4xl max-h-[min(94dvh,calc(100vh-2rem))] flex flex-col p-4 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-xl border border-border/80 bg-surface dark:bg-card">
      {/* Header */}
      <DialogHeader className="pb-3 sm:pb-4 border-b border-border/70 shrink-0 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
              <GraduationCap className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground flex items-center gap-2 flex-wrap">
                <span className="truncate max-w-[200px] sm:max-w-xs">
                  {submission.student?.full_name ?? "Student"}
                </span>
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold px-2.5 py-0.5 inline-flex items-center gap-1.5 ${
                    submission.status === "completed"
                      ? "bg-brand-50 text-brand-800 dark:bg-brand-950/80 dark:text-brand-300 border-brand-300/60"
                      : submission.status === "processing"
                        ? "bg-[#c9a227]/15 text-[#6e4e00] dark:bg-[#c9a227]/25 dark:text-[#fae59a] border-[#c9a227]/40"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      submission.status === "completed"
                        ? "bg-brand-600 dark:bg-brand-400"
                        : submission.status === "processing"
                          ? "bg-[#c9a227] motion-safe:animate-pulse"
                          : "bg-destructive"
                    }`}
                  />
                  {submission.status === "completed"
                    ? "Completed"
                    : submission.status === "processing"
                      ? "Processing"
                      : "Rejected"}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <User className="size-3" />
                  Uploaded by{" "}
                  {submission.uploader_role === "parent" ? "Parent" : "Teacher"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {formatDateFull(submission.created_at)}
                </span>
                {compositeScore !== undefined && compositeScore !== null ? (
                  <span className="inline-flex items-center gap-1">
                    <Award className="size-3" />
                    Composite score: {Math.round(compositeScore)}%
                  </span>
                ) : submission.manual_score ? (
                  <span className="inline-flex items-center gap-1 text-brand-700 dark:text-brand-300 font-medium">
                    <ShieldCheck className="size-3" />
                    Rubric Graded
                  </span>
                ) : submission.status === "completed" ? (
                  <span className="inline-flex items-center gap-1 text-brand-700 dark:text-brand-300 font-medium">
                    <ScanLine className="size-3" />
                    Worksheet Processed · Rubric Evaluation Needed
                  </span>
                ) : null}
              </DialogDescription>
            </div>
          </div>

          {/* Header Right: Navigation between students with 44px mobile touch hitboxes */}
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {hasMultipleSubmissions && submissions && onNavigate && (
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canGoPrev}
                  onClick={() => {
                    if (canGoPrev && currentIndex !== undefined) {
                      onNavigate(submissions[currentIndex - 1]);
                    }
                  }}
                  className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 size-8 sm:size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                  aria-label="Previous student (Key: J or ←)"
                  title="Previous student (← / J)"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs font-semibold px-2 text-foreground select-none">
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
                  className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 size-8 sm:size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                  aria-label="Next student (Key: K or →)"
                  title="Next student (→ / K)"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}

            {/* Quick Re-upload for rejected */}
            {submission.status === "rejected" && (
              <Button
                size="sm"
                onClick={handleReupload}
                className="h-9 sm:h-8 min-h-[40px] sm:min-h-[32px] bg-primary hover:bg-brand-700 text-primary-foreground text-xs font-medium rounded-lg sm:rounded-xl gap-1.5 shadow-xs shrink-0 cursor-pointer"
              >
                <Upload className="size-3.5" />
                Re-upload
              </Button>
            )}
          </div>
        </div>
      </DialogHeader>

      {/* Modal Body: Split view (Image + Diagnostic details) */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain py-4 space-y-4">
        {/* Mobile Sticky Preview Pill (< lg screens) */}
        <div className="lg:hidden sticky -top-4 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-surface/95 dark:bg-card/95 backdrop-blur-md border-b border-border/70 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-7 rounded-md bg-muted overflow-hidden border border-border shrink-0">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="Thumbnail"
                  width={28}
                  height={28}
                  className="size-full object-cover"
                />
              ) : (
                <FileText className="size-full p-1 text-muted-foreground" />
              )}
            </div>
            <span className="text-xs font-medium text-foreground truncate">
              {submission.student?.full_name ?? "Student"} Worksheet
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsZoomed((prev) => !prev)}
            className="min-h-[36px] sm:min-h-0 h-8 sm:h-7 px-2.5 text-xs gap-1 cursor-pointer shrink-0"
          >
            {isZoomed ? (
              <>
                <Minimize2 className="size-3" />
                <span>Fit</span>
              </>
            ) : (
              <>
                <Maximize2 className="size-3" />
                <span>Zoom</span>
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Worksheet Image Preview with Interactive Stroke Inspector */}
          <div className="lg:col-span-6 flex flex-col space-y-2">
            <WorksheetImageInspector
              imageUrl={imageUrl}
              altText={`Handwriting worksheet submitted for ${submission.student?.full_name ?? "student"}`}
              isLoading={isImageLoading}
              headerLabel="Handwriting Worksheet"
              isFrameExpanded={isZoomed}
              onToggleFrameExpanded={() => setIsZoomed((prev) => !prev)}
              allowFrameToggle={true}
              aspectRatioClass="aspect-4/3 sm:aspect-3/2 max-h-[420px]"
              expandedAspectRatioClass="min-h-[460px] max-h-[560px]"
            >
              {/* Selected criterion overlay badge */}
              {selectedCriterion && (
                <div className="absolute top-2.5 left-2.5 bg-background/90 dark:bg-card/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-900 shadow-xs text-xs font-medium text-brand-700 dark:text-brand-300 flex items-center gap-1.5 pointer-events-none z-10">
                  <Eye className="size-3.5 text-brand-600 dark:text-brand-400" />
                  <span>Focus: {selectedCriterion}</span>
                </div>
              )}
            </WorksheetImageInspector>

            {/* Target prompt & Keyboard legend */}
            <div className="space-y-1.5">
              {activityTargetText && (
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground mr-1">
                    Target prompt:
                  </span>
                  &ldquo;{activityTargetText}&rdquo;
                </div>
              )}

              {hasMultipleSubmissions && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                  <span>
                    Navigate: <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">J</kbd>/<kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">&larr;</kbd> prev &middot; <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">K</kbd>/<kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">&rarr;</kbd> next
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Diagnostic Assessment Details */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-3.5">
            {/* REJECTED STATE */}
            {submission.status === "rejected" && (
              <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-destructive/10 border border-destructive/20 space-y-3">
                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>Submission Rejected by OpenCV Quality Gate</span>
                </div>
                {rejectionInfo && (
                  <div className="space-y-2 text-xs">
                    <div>
                      <strong className="text-foreground">Issue:</strong>{" "}
                      <span className="text-muted-foreground">
                        {rejectionInfo.title}
                      </span>
                    </div>
                    <div>
                      <strong className="text-foreground">Diagnostic Explanation:</strong>{" "}
                      <span className="text-muted-foreground">
                        {rejectionInfo.description}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-surface/80 dark:bg-card/80 border border-destructive/20 text-muted-foreground">
                      <strong className="text-foreground">Teacher Action:</strong>{" "}
                      {rejectionInfo.advice}
                    </div>
                  </div>
                )}
                <Button
                  onClick={handleReupload}
                  className="w-full h-10 min-h-[44px] sm:min-h-[40px] bg-primary hover:bg-brand-700 text-primary-foreground text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl gap-2 shadow-xs cursor-pointer"
                >
                  <Camera className="size-4" />
                  Take & Re-upload New Photo
                </Button>
              </div>
            )}

            {/* PROCESSING STATE */}
            {submission.status === "processing" && (
              <div className="p-5 rounded-xl sm:rounded-2xl bg-[#c9a227]/10 dark:bg-[#c9a227]/20 border border-[#c9a227]/30 space-y-3 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-[#c9a227]/20 text-[#6e4e00] dark:text-[#fae59a] mx-auto motion-safe:animate-pulse">
                  <Clock className="size-6" />
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
                        <CheckCircle2 className="size-5" />
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
                            <button
                              key={c.name}
                              type="button"
                              onClick={() =>
                                setSelectedCriterion(c.name)
                              }
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs text-left cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] sm:min-h-0 ${
                                isSelected
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
                                      className="text-[10px] px-1.5 py-0 bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200 border-brand-300"
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
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[40px] sm:min-h-0 ${
                          phase1Tab === "rubric"
                            ? "bg-surface dark:bg-card text-foreground shadow-xs border border-border/60"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Award className="size-3.5 text-brand-600 dark:text-brand-400" />
                        <span>Rubric Rating</span>
                        {submission.manual_score ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border-brand-300"
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
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[40px] sm:min-h-0 ${
                          phase1Tab === "metrics"
                            ? "bg-surface dark:bg-card text-foreground shadow-xs border border-border/60"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Binary className="size-3.5 text-brand-600 dark:text-brand-400" />
                        <span>CV Metrics</span>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border-brand-300"
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
                                  <ShieldCheck className="size-4" />
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
                                className="min-h-[36px] sm:min-h-0 h-8 sm:h-7 px-3 sm:px-2 text-xs text-brand-800 dark:text-brand-200 border-brand-300 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/60 gap-1 cursor-pointer"
                              >
                                <Edit3 className="size-3" />
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
                                      <span className="text-[10px] text-muted-foreground truncate block">
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
                                className={`w-full flex flex-col p-3 rounded-xl border transition-all text-xs text-left cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] sm:min-h-0 ${
                                  isSelected
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

                                <span className="text-[11px] text-muted-foreground mt-1 leading-normal block">
                                  {c.description}
                                </span>

                                {c.subDetails && c.subDetails.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] w-full">
                                    {c.subDetails.map((sub, sIdx) => (
                                      <div
                                        key={sIdx}
                                        className="flex items-center justify-between gap-1 text-muted-foreground"
                                      >
                                        <span className="truncate">
                                          {sub.label}:
                                        </span>
                                        <span className="font-mono font-semibold text-foreground tabular-nums shrink-0">
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

                {/* Focused Criterion Diagnostic Insight Card (Shared) */}
                {selectedCriterion && activeCriterionInfo && (
                  <div className="p-3.5 rounded-xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 space-y-2 animate-in fade-in-50 duration-200">
                    <div className="flex items-center justify-between text-xs font-semibold text-brand-900 dark:text-brand-200">
                      <span className="flex items-center gap-1.5">
                        <Info className="size-3.5 text-brand-600 dark:text-brand-400" />
                        <span>{selectedCriterion} Diagnostic Guide</span>
                      </span>
                      <span className="text-[10px] text-brand-700 dark:text-brand-300 font-medium">
                        Criterion Guide
                      </span>
                    </div>
                    <p className="text-xs text-foreground/85 leading-relaxed">
                      {activeCriterionInfo.rubricGoal}
                    </p>
                    <div className="pt-1.5 border-t border-brand-200/60 dark:border-brand-900/60 flex items-start gap-1.5 text-xs text-brand-800 dark:text-brand-300">
                      <Eye className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
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
      <div className="flex items-center justify-between pt-3 border-t border-border/70 shrink-0">
        <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-2">
          {hasMultipleSubmissions ? (
            <span>Use <strong>← / →</strong> or <strong>J / K</strong> to cycle students</span>
          ) : (
            <span>Handwriting assessment review</span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          className="min-h-[40px] sm:min-h-[36px] h-9 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
        >
          Close
        </Button>
      </div>
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

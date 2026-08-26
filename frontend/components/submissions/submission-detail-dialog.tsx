"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ScoreBand,
  type Submission,
  useSubmissionImageUrl,
  useSubmitManualScore,
} from "@/lib/hooks/use-submissions";
import { useTeacherModals } from "@/components/teacher-modals-provider";
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
  Sparkles,
  Binary,
  Check,
  Loader2,
  ShieldCheck,
  CheckCheck,
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

  if (score >= 80) {
    return {
      label: "Excellent",
      className:
        "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900",
      dotColor: "bg-emerald-500",
    };
  }
  if (score >= 60) {
    return {
      label: "Satisfactory",
      className:
        "bg-brand-50 text-brand-800 dark:bg-brand-950/80 dark:text-brand-300 border-brand-300/50 dark:border-brand-900",
      dotColor: "bg-band-3",
    };
  }
  if (score >= 40) {
    return {
      label: "Developing",
      className:
        "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200/80 dark:border-amber-900",
      dotColor: "bg-amber-500",
    };
  }
  return {
    label: "Needs Improvement",
    className:
      "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200/80 dark:border-orange-900",
    dotColor: "bg-orange-500",
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
  score: string;
  activeClass: string;
  badgeClass: string;
  dotColor: string;
}> = [
  {
    band: "needs_improvement",
    label: "Needs Improvement",
    shortLabel: "Needs Imp.",
    score: "12.5%",
    activeClass:
      "bg-orange-100 dark:bg-orange-950/80 text-orange-950 dark:text-orange-200 border-orange-400 dark:border-orange-600 ring-2 ring-orange-500/40 shadow-xs font-semibold",
    badgeClass:
      "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200",
    dotColor: "bg-orange-500",
  },
  {
    band: "developing",
    label: "Developing",
    shortLabel: "Developing",
    score: "37.5%",
    activeClass:
      "bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/40 shadow-xs font-semibold",
    badgeClass:
      "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200",
    dotColor: "bg-amber-500",
  },
  {
    band: "satisfactory",
    label: "Satisfactory",
    shortLabel: "Satisfactory",
    score: "62.5%",
    activeClass:
      "bg-brand-100 dark:bg-brand-950/80 text-brand-950 dark:text-brand-200 border-brand-400 dark:border-brand-600 ring-2 ring-brand-500/40 shadow-xs font-semibold",
    badgeClass:
      "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border-brand-300",
    dotColor: "bg-brand-500",
  },
  {
    band: "excellent",
    label: "Excellent",
    shortLabel: "Excellent",
    score: "87.5%",
    activeClass:
      "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-200 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/40 shadow-xs font-semibold",
    badgeClass:
      "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200",
    dotColor: "bg-emerald-500",
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
  hint: string;
}> = [
  {
    key: "letter_formation_band",
    name: "1. Letter Formation",
    hint: "Proper cursive loops and complete stroke closures",
  },
  {
    key: "size_consistency_band",
    name: "2. Size Consistency",
    hint: "Proportion and height across 3-line penmanship ruling",
  },
  {
    key: "spacing_band",
    name: "3. Spacing",
    hint: "Inter-word rhythm and character separation spacing",
  },
  {
    key: "slant_band",
    name: "4. Slant Angle",
    hint: "Uniform forward slant tilt (target 60°–68° angle)",
  },
  {
    key: "baseline_alignment_band",
    name: "5. Baseline Alignment",
    hint: "Letters resting stably along bottom ruling baseline",
  },
];

function getBandMeta(band?: ScoreBand | string | null) {
  return (
    RUBRIC_BANDS.find((b) => b.band === band) ?? {
      band: "satisfactory" as ScoreBand,
      label: band || "Unrated",
      shortLabel: band || "Unrated",
      score: "—",
      activeClass: "",
      badgeClass: "bg-muted/60 text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
    }
  );
}

function ManualRubricEntryForm({ submissionId }: { submissionId: string }) {
  const { mutate: submitManualScore, isPending: isSubmittingScore } =
    useSubmitManualScore();

  const [rubricScores, setRubricScores] = useState<{
    letter_formation_band: ScoreBand | null;
    size_consistency_band: ScoreBand | null;
    spacing_band: ScoreBand | null;
    slant_band: ScoreBand | null;
    baseline_alignment_band: ScoreBand | null;
  }>({
    letter_formation_band: null,
    size_consistency_band: null,
    spacing_band: null,
    slant_band: null,
    baseline_alignment_band: null,
  });

  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null);
  const [submitSuccessNotice, setSubmitSuccessNotice] = useState(false);

  const allBandsSelected =
    rubricScores.letter_formation_band !== null &&
    rubricScores.size_consistency_band !== null &&
    rubricScores.spacing_band !== null &&
    rubricScores.slant_band !== null &&
    rubricScores.baseline_alignment_band !== null;

  const selectedCount = Object.values(rubricScores).filter(Boolean).length;

  const handleSubmitRubric = () => {
    if (!allBandsSelected) return;
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
          setSubmitSuccessNotice(true);
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
  };

  return (
    <div className="p-4 rounded-xl bg-surface dark:bg-card border border-border shadow-xs space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-border/60">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Award className="size-4 text-brand-600 dark:text-brand-400" />
            <h4 className="text-xs font-heading font-semibold text-foreground">
              Teacher Rubric Assessment
            </h4>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Select 1 band per criterion to contribute calibration data (DESIGN §7.9).
          </p>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] font-semibold px-2 py-0.5 shrink-0 self-start sm:self-auto ${
            allBandsSelected
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
              : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300"
          }`}
        >
          {selectedCount}/5 rated
        </Badge>
      </div>

      {submitErrorMsg && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold block">Submission Error</span>
            <span>{submitErrorMsg}</span>
          </div>
        </div>
      )}

      {submitSuccessNotice && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>Rubric saved successfully! Recorded for calibration.</span>
        </div>
      )}

      <div className="space-y-3">
        {RUBRIC_CRITERIA.map((criterion) => {
          const selectedBand = rubricScores[criterion.key];
          return (
            <div
              key={criterion.key}
              className="space-y-1.5 p-2.5 rounded-lg bg-muted/20 border border-border/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {criterion.name}
                </span>
                {selectedBand && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {getBandMeta(selectedBand).score}
                  </span>
                )}
              </div>

              {/* Segmented 4-Button Group */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {RUBRIC_BANDS.map((option) => {
                  const isChecked = selectedBand === option.band;
                  return (
                    <button
                      key={option.band}
                      type="button"
                      disabled={isSubmittingScore}
                      onClick={() =>
                        setRubricScores((prev) => ({
                          ...prev,
                          [criterion.key]: option.band,
                        }))
                      }
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${
                        isChecked
                          ? option.activeClass
                          : "bg-surface dark:bg-card border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border"
                      }`}
                    >
                      <span className="text-[11px] leading-tight font-medium">
                        {option.shortLabel}
                      </span>
                      <span className="text-[10px] opacity-70 mt-0.5">
                        {option.score}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <div className="text-[11px] text-muted-foreground">
          {allBandsSelected ? (
            <span className="text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
              <Check className="size-3" />
              All 5 criteria rated
            </span>
          ) : (
            <span>Please rate all 5 criteria to submit</span>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          disabled={!allBandsSelected || isSubmittingScore}
          onClick={handleSubmitRubric}
          className="h-8 min-h-[32px] px-3.5 bg-primary hover:bg-brand-700 text-primary-foreground text-xs font-semibold rounded-lg sm:rounded-xl gap-1.5 shadow-xs cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmittingScore ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Saving Rubric...</span>
            </>
          ) : (
            <>
              <CheckCheck className="size-3.5" />
              <span>Submit Rubric Scores</span>
            </>
          )}
        </Button>
      </div>
    </div>
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
  const { openUpload } = useTeacherModals();
  const [isZoomed, setIsZoomed] = useState(false);
  const [selectedCriterion, setSelectedCriterion] = useState<string | null>(null);

  const { data: imageUrl, isLoading: isImageLoading } = useSubmissionImageUrl(
    submission?.image_path ?? null
  );



  // Keyboard navigation across submissions
  useEffect(() => {
    if (!open || !submissions || submissions.length <= 1 || !onNavigate) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "j" || e.key === "J") {
        if (currentIndex !== undefined && currentIndex > 0) {
          e.preventDefault();
          onNavigate(submissions[currentIndex - 1]);
        }
      } else if (e.key === "ArrowRight" || e.key === "k" || e.key === "K") {
        if (
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
  }, [open, submissions, currentIndex, onNavigate]);

  if (!submission) return null;

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

  const criteria = [
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

  const rawCriteria = [
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
  ];

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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                    className={`text-xs font-semibold px-2.5 py-0.5 inline-flex items-center gap-1.5 ${submission.status === "completed"
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200"
                        : submission.status === "processing"
                          ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${submission.status === "completed"
                          ? "bg-emerald-500"
                          : submission.status === "processing"
                            ? "bg-amber-500 motion-safe:animate-pulse"
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
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
                      <ShieldCheck className="size-3" />
                      Rubric Graded
                    </span>
                  ) : submission.status === "completed" ? (
                    <span className="inline-flex items-center gap-1 text-brand-700 dark:text-brand-300 font-medium">
                      <Sparkles className="size-3" />
                      Raw CV Metrics Available · Rubric Needed
                    </span>
                  ) : null}
                </DialogDescription>

              </div>
            </div>

            {/* Header Right: Navigation between students */}
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
                    className="size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
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
                    className="size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
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
                  className="h-8 min-h-[32px] bg-primary hover:bg-brand-700 text-primary-foreground text-xs font-medium rounded-lg sm:rounded-xl gap-1.5 shadow-xs shrink-0 cursor-pointer"
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Worksheet Image Preview */}
            <div className="lg:col-span-6 flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Handwriting Worksheet
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsZoomed((prev) => !prev)}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                >
                  {isZoomed ? (
                    <>
                      <Minimize2 className="size-3.5" />
                      <span>Fit view</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="size-3.5" />
                      <span>Expand</span>
                    </>
                  )}
                </Button>
              </div>

              <div
                className={`relative rounded-xl sm:rounded-2xl border border-border bg-muted/40 overflow-hidden transition-all ${isZoomed ? "max-h-[520px]" : "aspect-4/3 sm:aspect-3/2"
                  } flex items-center justify-center`}
              >
                {isImageLoading ? (
                  <Skeleton className="size-full rounded-none" />
                ) : imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={`Handwriting worksheet submitted for ${submission.student?.full_name ?? "student"}`}
                    loading="lazy"
                    decoding="async"
                    className={`size-full object-contain ${isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
                      }`}
                    onClick={() => setIsZoomed((prev) => !prev)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground space-y-2">
                    <FileText className="size-10 text-muted-foreground/60" />
                    <p className="text-xs font-medium">Worksheet image unavailable</p>
                  </div>
                )}

                {/* Selected criterion overlay badge */}
                {selectedCriterion && (
                  <div className="absolute top-2.5 left-2.5 bg-background/90 dark:bg-card/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-900 shadow-xs text-xs font-medium text-brand-700 dark:text-brand-300 flex items-center gap-1.5">
                    <Eye className="size-3.5 text-brand-600" />
                    <span>Viewing: {selectedCriterion}</span>
                  </div>
                )}
              </div>

              {activityTargetText && (
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground mr-1">
                    Target prompt:
                  </span>
                  &ldquo;{activityTargetText}&rdquo;
                </div>
              )}
            </div>

            {/* Right: Diagnostic Assessment Details */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
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
                    className="w-full h-10 min-h-[40px] bg-primary hover:bg-brand-700 text-primary-foreground text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl gap-2 shadow-xs cursor-pointer"
                  >
                    <Camera className="size-4" />
                    Take & Re-upload New Photo
                  </Button>
                </div>
              )}

              {/* PROCESSING STATE */}
              {submission.status === "processing" && (
                <div className="p-5 rounded-xl sm:rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900 space-y-3 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 mx-auto motion-safe:animate-pulse">
                    <Clock className="size-6" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h4 className="text-sm font-heading font-semibold text-amber-900 dark:text-amber-200">
                      Analyzing Handwriting Worksheet
                    </h4>
                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                      OpenCV quality verification passed. The CNN model is evaluating letter formation, spacing, and baseline stability.
                    </p>
                  </div>
                </div>
              )}

              {/* COMPLETED STATE: 5 Criteria Diagnostics & Raw CV Measurements */}
              {submission.status === "completed" && (
                <div className="space-y-3.5">
                  {hasCalibratedScores ? (
                    <>
                      {/* Phase 2: Overall Composite Score Pill */}
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

                        <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
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
                            Tap a criterion for diagnostic tips
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
                                  setSelectedCriterion((prev) =>
                                    prev === c.name ? null : c.name
                                  )
                                }
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs text-left cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${isSelected
                                    ? "bg-brand-50/80 dark:bg-brand-950/60 border-brand-300 dark:border-brand-800 shadow-xs"
                                    : "bg-surface dark:bg-card border-border/70 hover:border-border hover:bg-muted/30"
                                  }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-semibold text-foreground truncate">
                                      {c.name}
                                    </p>
                                    {isSelected && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200 border-brand-300"
                                      >
                                        Focused
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {c.description}
                                  </p>
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
                      {/* Phase 1: Raw CV Measurement Header */}
                      <div className="p-3.5 rounded-xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 shadow-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 shrink-0">
                              <Binary className="size-4" />
                            </div>
                            <span className="text-xs font-semibold text-brand-900 dark:text-brand-200">
                              Raw Computer Vision Analysis
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold px-2 py-0.5 bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200 border-brand-300 dark:border-brand-800"
                          >
                            Phase 1 · Calibration Data
                          </Badge>
                        </div>
                        <p className="text-[11px] text-brand-800/80 dark:text-brand-300/80 leading-relaxed">
                          Physical penmanship measurements extracted by the OpenCV feature pipeline. Scores will be calibrated during Phase 2.
                        </p>
                      </div>

                      {/* Phase 1: 5-Criterion Raw CV Metrics List */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            5-Criterion Physical Measurements
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Tap to focus & view guide
                          </span>
                        </div>

                        <div className="space-y-2">
                          {rawCriteria.map((c) => {
                            const isSelected = selectedCriterion === c.name;
                            return (
                              <button
                                key={c.name}
                                type="button"
                                onClick={() =>
                                  setSelectedCriterion((prev) =>
                                    prev === c.name ? null : c.name
                                  )
                                }
                                className={`w-full flex flex-col p-3 rounded-xl border transition-all text-xs text-left cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                                  isSelected
                                    ? "bg-brand-50/80 dark:bg-brand-950/60 border-brand-300 dark:border-brand-800 shadow-xs ring-1 ring-brand-400/40"
                                    : "bg-surface dark:bg-card border-border/70 hover:border-brand-300 dark:hover:border-brand-800 hover:bg-muted/30"
                                }`}
                              >
                                <div className="w-full flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <p className="font-semibold text-foreground truncate">
                                      {c.name}
                                    </p>
                                    {isSelected && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200 border-brand-300"
                                      >
                                        Focused
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono font-medium text-foreground tabular-nums text-xs px-2 py-0.5 rounded-md bg-muted/60 border border-border/60">
                                      {c.primaryValue}
                                    </span>
                                  </div>
                                </div>

                                <p className="text-[11px] text-muted-foreground mt-1 leading-normal">
                                  {c.description}
                                </p>

                                {c.subDetails && c.subDetails.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                    {c.subDetails.map((sub, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between gap-1 text-muted-foreground"
                                      >
                                        <span className="truncate">
                                          {sub.label}:
                                        </span>
                                        <span className="font-mono font-medium text-foreground tabular-nums shrink-0">
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

                      {/* Phase 1: Teacher Rubric Assessment (Spearman's Rho Calibration Data) */}
                      <div className="pt-2 border-t border-border/70 space-y-3">
                        {submission.manual_score ? (
                          /* READ-ONLY / CONFIRMED RUBRIC STATE */
                          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/80 shadow-xs space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 shrink-0">
                                  <ShieldCheck className="size-4" />
                                </div>
                                <span className="text-xs font-semibold text-emerald-950 dark:text-emerald-200">
                                  Independent Rubric Assessment (Submitted)
                                </span>
                              </div>
                              <Badge
                                variant="outline"
                                className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
                              >
                                Phase 1 Calibrated
                              </Badge>
                            </div>

                            <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed">
                              Teacher rubric ratings are securely recorded as ground truth for offline Spearman&apos;s Rho calibration.
                            </p>

                            <div className="space-y-1.5 pt-1">
                              {RUBRIC_CRITERIA.map((criterion) => {
                                const bandValue = submission.manual_score?.[criterion.key];
                                const bandMeta = getBandMeta(bandValue);
                                return (
                                  <div
                                    key={criterion.key}
                                    className="flex items-center justify-between p-2.5 rounded-lg bg-surface/90 dark:bg-card/90 border border-emerald-200/60 dark:border-emerald-900/60 text-xs"
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
                                      <span className={`size-1.5 rounded-full ${bandMeta.dotColor}`} />
                                      {bandMeta.label} ({bandMeta.score})
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <ManualRubricEntryForm
                            key={submission.id}
                            submissionId={submission.id}
                          />
                        )}
                      </div>
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
                        <button
                          type="button"
                          onClick={() => setSelectedCriterion(null)}
                          className="text-[11px] text-brand-700 hover:text-brand-900 dark:text-brand-300 hover:underline cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed">
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
          <div className="text-xs text-muted-foreground hidden sm:block">
            {hasMultipleSubmissions && (
              <span>Use <strong>← / →</strong> or <strong>J / K</strong> to cycle through student worksheets</span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-9 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


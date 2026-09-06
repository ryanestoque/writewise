import {
  CheckCircle2,
  AlertCircle,
  Award,
  TrendingUp,
  Clock,
  type LucideIcon,
} from "lucide-react";
import type { Submission, ScoreBand } from "@/lib/hooks/use-submissions";

export type ScoreSource = "calibrated" | "manual" | "none";

export const BAND_NUMERIC_VALUES: Record<ScoreBand, number> = {
  needs_improvement: 12.5,
  developing: 37.5,
  satisfactory: 62.5,
  excellent: 87.5,
};

export interface ResolvedCriterionScores {
  letterFormation: number | null;
  sizeConsistency: number | null;
  spacing: number | null;
  slant: number | null;
  baselineAlignment: number | null;
}

export interface ResolvedSubmissionScore {
  compositeScore: number | null;
  scoreBand: ScoreBandInfo;
  source: ScoreSource;
  isScored: boolean;
  criteriaScores: ResolvedCriterionScores;
}

export interface ScoreBandInfo {
  label: string;
  band: string;
  className: string;
  dotColor: string;
  icon: LucideIcon;
  description: string;
  source?: ScoreSource;
}

export function getScoreBandLabel(
  score: number | null | undefined,
  options?: { isPending?: boolean; source?: ScoreSource }
): ScoreBandInfo {
  if (score === null || score === undefined) {
    if (options?.isPending) {
      return {
        label: "Needs Review",
        band: "Pending Rubric",
        className:
          "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200/80 dark:border-amber-900",
        dotColor: "bg-amber-500",
        icon: Clock,
        description: "Worksheet processed. Teacher manual rubric scoring pending.",
        source: options?.source ?? "none",
      };
    }
    return {
      label: "Unrated",
      band: "Unrated",
      className: "bg-muted/50 text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
      icon: Clock,
      description: "No diagnostic assessment recorded.",
      source: options?.source ?? "none",
    };
  }

  const rounded = Math.round(score);
  const isManual = options?.source === "manual";

  if (score >= 80) {
    return {
      label: `${rounded}% • Excellent`,
      band: "Excellent",
      className:
        "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900",
      dotColor: "bg-emerald-500",
      icon: Award,
      description: isManual
        ? `Teacher rubric score (${rounded}%). Excellent foundation.`
        : "Consistent letter formation, steady slant, and precise baseline alignment.",
      source: options?.source ?? "calibrated",
    };
  }
  if (score >= 60) {
    return {
      label: `${rounded}% • Satisfactory`,
      band: "Satisfactory",
      className:
        "bg-brand-50 text-brand-800 dark:bg-brand-950/80 dark:text-brand-300 border-brand-300/50 dark:border-brand-900",
      dotColor: "bg-band-3",
      icon: CheckCircle2,
      description: isManual
        ? `Teacher rubric score (${rounded}%). Satisfactory penmanship.`
        : "Good penmanship foundation with minor variations in size or spacing.",
      source: options?.source ?? "calibrated",
    };
  }
  if (score >= 40) {
    return {
      label: `${rounded}% • Developing`,
      band: "Developing",
      className:
        "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200/80 dark:border-amber-900",
      dotColor: "bg-amber-500",
      icon: TrendingUp,
      description: isManual
        ? `Teacher rubric score (${rounded}%). Developing penmanship.`
        : "Progress visible; focus on consistent slant angles and letter proportion.",
      source: options?.source ?? "calibrated",
    };
  }
  return {
    label: `${rounded}% • Needs Impr.`,
    band: "Needs Improvement",
    className:
      "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200/80 dark:border-orange-900",
    dotColor: "bg-orange-500",
    icon: AlertCircle,
    description: isManual
      ? `Teacher rubric score (${rounded}%). Targeted practice recommended.`
      : "Struggling with line adherence or letter connections; review targeted practice.",
    source: options?.source ?? "calibrated",
  };
}

export function resolveSubmissionScore(
  submission: Submission | null | undefined
): ResolvedSubmissionScore {
  if (!submission) {
    return {
      compositeScore: null,
      scoreBand: getScoreBandLabel(null, { isPending: false }),
      source: "none",
      isScored: false,
      criteriaScores: {
        letterFormation: null,
        sizeConsistency: null,
        spacing: null,
        slant: null,
        baselineAlignment: null,
      },
    };
  }

  // 1. Calibrated score check (Phase 2)
  const m = submission.measurement;
  if (m?.composite_score != null) {
    const compScore = Number(m.composite_score);
    return {
      compositeScore: compScore,
      scoreBand: getScoreBandLabel(compScore, { source: "calibrated" }),
      source: "calibrated",
      isScored: true,
      criteriaScores: {
        letterFormation:
          m.letter_formation_score != null ? Number(m.letter_formation_score) : null,
        sizeConsistency:
          m.size_consistency_score != null ? Number(m.size_consistency_score) : null,
        spacing:
          m.spacing_score != null ? Number(m.spacing_score) : null,
        slant:
          m.slant_score != null ? Number(m.slant_score) : null,
        baselineAlignment:
          m.baseline_alignment_score != null ? Number(m.baseline_alignment_score) : null,
      },
    };
  }

  // 2. Manual score fallback (Phase 1)
  const ms = submission.manual_score;
  if (ms) {
    const getVal = (
      scoreVal?: number | null,
      bandVal?: ScoreBand | null
    ): number | null => {
      if (scoreVal !== undefined && scoreVal !== null) return Number(scoreVal);
      if (bandVal && bandVal in BAND_NUMERIC_VALUES) return BAND_NUMERIC_VALUES[bandVal];
      return null;
    };

    const lf = getVal(ms.letter_formation_score, ms.letter_formation_band);
    const sc = getVal(ms.size_consistency_score, ms.size_consistency_band);
    const sp = getVal(ms.spacing_score, ms.spacing_band);
    const sl = getVal(ms.slant_score, ms.slant_band);
    const ba = getVal(ms.baseline_alignment_score, ms.baseline_alignment_band);

    const validScores = [lf, sc, sp, sl, ba].filter((v): v is number => v !== null);
    if (validScores.length > 0) {
      const avg = Math.round(
        validScores.reduce((acc, v) => acc + v, 0) / validScores.length
      );
      return {
        compositeScore: avg,
        scoreBand: getScoreBandLabel(avg, { source: "manual" }),
        source: "manual",
        isScored: true,
        criteriaScores: {
          letterFormation: lf,
          sizeConsistency: sc,
          spacing: sp,
          slant: sl,
          baselineAlignment: ba,
        },
      };
    }
  }

  // 3. Unscored / Pending review
  const isCompleted = submission.status === "completed";
  return {
    compositeScore: null,
    scoreBand: getScoreBandLabel(null, { isPending: isCompleted, source: "none" }),
    source: "none",
    isScored: false,
    criteriaScores: {
      letterFormation: null,
      sizeConsistency: null,
      spacing: null,
      slant: null,
      baselineAlignment: null,
    },
  };
}

export function getRejectionSummary(code: string | null): {
  label: string;
  detail: string;
} {
  switch (code) {
    case "QUALITY_GATE_BLUR":
      return {
        label: "Blurry photo",
        detail: "Tap to focus and hold camera steady",
      };
    case "QUALITY_GATE_BRIGHTNESS":
      return {
        label: "Lighting issue",
        detail: "Move to a brighter spot with even lighting",
      };
    case "QUALITY_GATE_CONTRAST":
      return {
        label: "Faint handwriting",
        detail: "Ensure dark pencil strokes and reduce glare",
      };
    case "QUALITY_GATE_RESOLUTION":
      return {
        label: "Low resolution",
        detail: "Move closer so worksheet fills the frame",
      };
    case "SEGMENTATION_COUNT_MISMATCH":
      return {
        label: "Word count mismatch",
        detail: "Verify all target words are written",
      };
    case "PIPELINE_ERROR":
      return {
        label: "Processing issue",
        detail: "Retake photo with worksheet flat and visible",
      };
    // Legacy / fallback mappings for dev database backwards compatibility
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
    default:
      return {
        label: "Scan clarity issue",
        detail: "Retake photo flat with clear lighting",
      };
  }
}

export const statusConfig = {
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
      "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-900",
    dotClass: "bg-rose-500",
  },
} as const;

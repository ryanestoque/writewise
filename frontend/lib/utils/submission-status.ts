import {
  CheckCircle2,
  AlertCircle,
  Award,
  TrendingUp,
  Clock,
  type LucideIcon,
} from "lucide-react";

export interface ScoreBandInfo {
  label: string;
  band: string;
  className: string;
  dotColor: string;
  icon: LucideIcon;
  description: string;
}

export function getScoreBandLabel(score: number | null | undefined): ScoreBandInfo {
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

import type { ScoreBand } from "@/lib/hooks/use-submissions";

export type { ScoreBand };

export interface RubricBandMeta {
  band: ScoreBand;
  label: string;
  shortLabel: string;
  score: string;
  activeClass: string;
  badgeClass: string;
  dotColor: string;
}

export const RUBRIC_BANDS: RubricBandMeta[] = [
  {
    band: "needs_improvement",
    label: "Needs Improvement",
    shortLabel: "Needs Imp.",
    score: "12.5%",
    activeClass:
      "bg-band-1/20 dark:bg-band-1/30 text-band-1-text dark:text-orange-200 border-band-1 ring-2 ring-band-1/40 shadow-xs font-semibold",
    badgeClass:
      "bg-band-1/15 text-band-1-text dark:text-orange-200 border-band-1/30 dark:border-band-1/40",
    dotColor: "bg-band-1",
  },
  {
    band: "developing",
    label: "Developing",
    shortLabel: "Developing",
    score: "37.5%",
    activeClass:
      "bg-band-2/20 dark:bg-band-2/30 text-band-2-text dark:text-amber-200 border-band-2 ring-2 ring-band-2/40 shadow-xs font-semibold",
    badgeClass:
      "bg-band-2/15 text-band-2-text dark:text-amber-200 border-band-2/30 dark:border-band-2/40",
    dotColor: "bg-band-2",
  },
  {
    band: "satisfactory",
    label: "Satisfactory",
    shortLabel: "Satisfactory",
    score: "62.5%",
    activeClass:
      "bg-band-3/20 dark:bg-band-3/30 text-band-3-text dark:text-emerald-200 border-band-3 ring-2 ring-band-3/40 shadow-xs font-semibold",
    badgeClass:
      "bg-band-3/15 text-band-3-text dark:text-emerald-200 border-band-3/30 dark:border-band-3/40",
    dotColor: "bg-band-3",
  },
  {
    band: "excellent",
    label: "Excellent",
    shortLabel: "Excellent",
    score: "87.5%",
    activeClass:
      "bg-band-4/20 dark:bg-band-4/30 text-band-4-text dark:text-emerald-300 border-band-4 ring-2 ring-band-4/40 shadow-xs font-semibold",
    badgeClass:
      "bg-band-4/15 text-band-4-text dark:text-emerald-300 border-band-4/30 dark:border-band-4/40",
    dotColor: "bg-band-4",
  },
];

export const RUBRIC_CRITERIA: Array<{
  key:
    | "letter_formation_band"
    | "size_consistency_band"
    | "spacing_band"
    | "slant_band"
    | "baseline_alignment_band";
  criterionKey:
    | "letter_formation"
    | "size_consistency"
    | "spacing"
    | "slant"
    | "baseline_alignment";
  bandKey:
    | "letter_formation_band"
    | "size_consistency_band"
    | "spacing_band"
    | "slant_band"
    | "baseline_alignment_band";
  scoreKey:
    | "letter_formation_score"
    | "size_consistency_score"
    | "spacing_score"
    | "slant_score"
    | "baseline_alignment_score";
  name: string;
  shortName: string;
  hint: string;
}> = [
  {
    key: "letter_formation_band",
    criterionKey: "letter_formation",
    bandKey: "letter_formation_band",
    scoreKey: "letter_formation_score",
    name: "1. Letter Formation",
    shortName: "Letter Formation",
    hint: "Proper cursive loops and complete stroke closures",
  },
  {
    key: "size_consistency_band",
    criterionKey: "size_consistency",
    bandKey: "size_consistency_band",
    scoreKey: "size_consistency_score",
    name: "2. Size Consistency",
    shortName: "Size Consistency",
    hint: "Proportion and height across 3-line penmanship ruling",
  },
  {
    key: "spacing_band",
    criterionKey: "spacing",
    bandKey: "spacing_band",
    scoreKey: "spacing_score",
    name: "3. Spacing",
    shortName: "Spacing",
    hint: "Inter-word rhythm and character separation spacing",
  },
  {
    key: "slant_band",
    criterionKey: "slant",
    bandKey: "slant_band",
    scoreKey: "slant_score",
    name: "4. Slant Angle",
    shortName: "Slant Angle",
    hint: "Uniform forward slant tilt (target 60°–68° angle)",
  },
  {
    key: "baseline_alignment_band",
    criterionKey: "baseline_alignment",
    bandKey: "baseline_alignment_band",
    scoreKey: "baseline_alignment_score",
    name: "5. Baseline Alignment",
    shortName: "Baseline Alignment",
    hint: "Letters resting stably along bottom ruling baseline",
  },
];

export const DIAGNOSTIC_NOTES: Record<
  "letter_formation" | "size_consistency" | "spacing" | "slant" | "baseline_alignment",
  Record<ScoreBand, string>
> = {
  letter_formation: {
    needs_improvement:
      "Several letters aren't fully formed yet — tracing practice on individual letters usually helps build this up.",
    developing:
      "Letter shapes are taking form but still inconsistent — regular practice should smooth this out over the next few activities.",
    satisfactory:
      "Most letters are well-formed with only minor inconsistencies — steady practice will sharpen the remaining details.",
    excellent:
      "Letters are consistently well-formed across the page — a strong, reliable foundation.",
  },
  spacing: {
    needs_improvement:
      "Spacing between letters and words varies a lot — practicing with spacing guides can help build a steadier rhythm.",
    developing:
      "Spacing is becoming more even but still uneven in places — continued practice should even this out.",
    satisfactory:
      "Spacing is mostly even and easy to read — small refinements will make it even more consistent.",
    excellent:
      "Spacing is even and consistent throughout — this makes the writing easy to read at a glance.",
  },
  slant: {
    needs_improvement:
      "Letter slant varies noticeably across the page — slower, more deliberate strokes often help even this out.",
    developing:
      "Slant is becoming more consistent but still shifts in places — this typically steadies with more practice.",
    satisfactory:
      "Slant is mostly consistent with only slight variation — a good sign of developing pen control.",
    excellent:
      "Slant is consistent throughout the page — a clear sign of strong pen control.",
  },
  baseline_alignment: {
    needs_improvement:
      "Letters drift above or below the line often — practicing on lined paper with a visible baseline can help.",
    developing:
      "Letters are staying closer to the baseline but still drift in places — this usually improves with continued practice.",
    satisfactory:
      "Letters mostly sit on the baseline with only occasional drift — a solid sign of control.",
    excellent:
      "Letters consistently sit on the baseline throughout — strong control of line placement.",
  },
  size_consistency: {
    needs_improvement:
      "Letter sizes vary a lot across the page — practicing within guided size boxes can help even this out.",
    developing:
      "Letter sizes are becoming more even but still vary in places — this typically steadies with more practice.",
    satisfactory:
      "Letter sizes are mostly consistent with minor variation — small refinements will make this even steadier.",
    excellent:
      "Letter sizes are consistent throughout the page — a strong, steady hand.",
  },
};

export function getBandMeta(band?: ScoreBand | string | null): RubricBandMeta {
  return (
    RUBRIC_BANDS.find((b) => b.band === band) ?? {
      band: "satisfactory",
      label: band || "Unrated",
      shortLabel: band || "Unrated",
      score: "—",
      activeClass: "",
      badgeClass: "bg-muted/60 text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
    }
  );
}

export function getBandFromScore(score: number | null | undefined): ScoreBand | null {
  if (score === null || score === undefined) return null;
  if (score >= 75) return "excellent";
  if (score >= 50) return "satisfactory";
  if (score >= 25) return "developing";
  return "needs_improvement";
}

export function getScoreBand(score: number | null | undefined): {
  label: string;
  className: string;
  dotColor: string;
  band: ScoreBand | null;
} {
  const band = getBandFromScore(score);
  if (!band) {
    return {
      label: "Pending",
      className: "bg-muted/60 text-muted-foreground border-border",
      dotColor: "bg-muted-foreground",
      band: null,
    };
  }

  const meta = getBandMeta(band);
  return {
    label: meta.label,
    className: meta.badgeClass,
    dotColor: meta.dotColor,
    band,
  };
}

export type CriterionKey =
  | "letter_formation"
  | "size_consistency"
  | "spacing"
  | "slant"
  | "baseline_alignment";

export interface ParentCriterionMeta {
  key: CriterionKey;
  label: string;
  shortDescription: string;
  homeTip: string;
}

export const PARENT_CRITERIA_METADATA: Record<CriterionKey, ParentCriterionMeta> = {
  letter_formation: {
    key: "letter_formation",
    label: "Letter Shapes",
    shortDescription: "Proper cursive loops and complete stroke closures",
    homeTip: "Practice tracing tricky lowercase cursive loops (like f, g, and b) with smooth, continuous pencil strokes.",
  },
  size_consistency: {
    key: "size_consistency",
    label: "Size & Proportions",
    shortDescription: "Consistent height across the 3-line ruling",
    homeTip: "Guide letters to reach the dotted midline without drifting over the top headline.",
  },
  spacing: {
    key: "spacing",
    label: "Spacing",
    shortDescription: "Even gaps between letters and words",
    homeTip: "Use the child's index finger as an easy visual spacer between separate cursive words.",
  },
  slant: {
    key: "slant",
    label: "Slant & Tilt",
    shortDescription: "Consistent, forward cursive angle",
    homeTip: "Slightly tilt the practice paper to help natural, comfortable cursive slant without straining the wrist.",
  },
  baseline_alignment: {
    key: "baseline_alignment",
    label: "Line Alignment",
    shortDescription: "Staying grounded along the writing line",
    homeTip: "Encourage resting every letter securely along the solid baseline before moving to the next word.",
  },
};

export const PARENT_CRITERIA_LIST: ParentCriterionMeta[] = [
  PARENT_CRITERIA_METADATA.letter_formation,
  PARENT_CRITERIA_METADATA.size_consistency,
  PARENT_CRITERIA_METADATA.spacing,
  PARENT_CRITERIA_METADATA.slant,
  PARENT_CRITERIA_METADATA.baseline_alignment,
];

export function getParentCriterionLabel(key: string): string {
  if (key in PARENT_CRITERIA_METADATA) {
    return PARENT_CRITERIA_METADATA[key as CriterionKey].label;
  }
  return key;
}

/**
 * Design system tokens and styling constants for WriteWise Diagnostic Overlays.
 * Strictly adheres to DESIGN.md:
 * - Developmental band colors: Forest Teal, Warm Sage, Ochre Gold, Terracotta (NO harsh red #ef4444 / #e11d48).
 * - Low visual weight geometric bounding lines (1.5px stroke, 60% default opacity).
 * - Grounded iconography and domain-specific terminology.
 */

export const OVERLAY_COLORS = {
  // Developmental tiers aligned with DESIGN.md CSS tokens
  proficient: {
    stroke: "var(--color-brand-600)",
    fill: "rgba(27, 107, 99, 0.12)",
  },
  consistent: {
    stroke: "var(--color-band-4)",
    fill: "rgba(74, 139, 92, 0.12)",
  },
  developing: {
    stroke: "var(--color-band-2)",
    fill: "rgba(201, 162, 39, 0.14)",
  },
  needs_attention: {
    stroke: "var(--color-band-1)",
    fill: "rgba(182, 117, 74, 0.18)",
  },
  // Traditional 3-line penmanship ruling guides
  guidelines: {
    topline: "var(--muted-foreground)",
    midline: "var(--color-brand-600)",
    baseline: "var(--color-brand-700)",
  },
} as const;

export const OVERLAY_WEIGHTS = {
  minTargetSize: 44,
  strokeNormal: 1.5,
  strokeAttention: 2.25,
  strokeHover: 3.0,
  opacitySpotlight: 0.92,
  opacityAllGuides: 0.65,
  opacityDimmed: 0.25,
} as const;

export const CRITERIA_META = {
  letter_formation: {
    label: "Formation",
    fullLabel: "Letter Formation",
    description: "Cursive stroke definition, loop closures, and letter proportions",
    iconName: "PenTool",
  },
  spacing: {
    label: "Spacing",
    fullLabel: "Word & Letter Spacing",
    description: "Even distance between words and consistent letter connector gaps",
    iconName: "AlignJustify",
  },
  slant: {
    label: "Slant",
    fullLabel: "Slant Uniformity",
    description: "Consistent forward inclination across word downstrokes",
    iconName: "Compass",
  },
  baseline_alignment: {
    label: "Baseline",
    fullLabel: "Baseline Alignment",
    description: "Adherence of letter bases to the horizontal writing baseline",
    iconName: "Ruler",
  },
  size_consistency: {
    label: "Size",
    fullLabel: "Size Consistency",
    description: "Proportional height of x-height letters and ascending/descending loops",
    iconName: "Maximize2",
  },
} as const;

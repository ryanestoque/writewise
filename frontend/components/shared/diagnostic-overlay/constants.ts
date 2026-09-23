/**
 * Design system tokens and styling constants for WriteWise Diagnostic Overlays.
 * Strictly adheres to DESIGN.md:
 * - Developmental band colors: Forest Teal, Warm Sage, Ochre Gold, Terracotta (NO harsh red #ef4444 / #e11d48).
 * - Low visual weight geometric bounding lines (1.5px stroke, 60% default opacity).
 * - Grounded iconography and domain-specific terminology.
 */

export const OVERLAY_COLORS = {
  // Developmental tiers (pedagogical grading standards)
  proficient: {
    stroke: "#1b6b63", // Forest Teal
    fill: "rgba(27, 107, 99, 0.12)",
  },
  consistent: {
    stroke: "#4a7c59", // Warm Sage
    fill: "rgba(74, 124, 89, 0.12)",
  },
  developing: {
    stroke: "#d48b28", // Ochre Gold
    fill: "rgba(212, 139, 40, 0.14)",
  },
  needs_attention: {
    stroke: "#c2410c", // Vibrant Terracotta / Rust (distinct, pedagogical, never harsh red #ef4444)
    fill: "rgba(194, 65, 12, 0.18)",
  },
  // Traditional 3-line penmanship ruling guides
  guidelines: {
    topline: "#64748b", // Slate 500 headline
    midline: "#0f766e", // Teal dotted midline
    baseline: "#115e59", // Deep Forest Teal baseline
  },
} as const;

export const OVERLAY_WEIGHTS = {
  strokeNormal: 2.25,
  strokeAttention: 3.0,
  strokeHover: 3.75,
  opacitySpotlight: 1.0,
  opacityAllGuides: 0.90,
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

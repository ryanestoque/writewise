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
    fill: "rgba(27, 107, 99, 0.08)",
  },
  consistent: {
    stroke: "#4a7c59", // Warm Sage
    fill: "rgba(74, 124, 89, 0.08)",
  },
  developing: {
    stroke: "#d48b28", // Ochre Gold
    fill: "rgba(212, 139, 40, 0.10)",
  },
  needs_attention: {
    stroke: "#9c4a2f", // Terracotta (Never harsh red)
    fill: "rgba(156, 74, 47, 0.12)",
  },
  // Traditional 3-line penmanship ruling guides
  guidelines: {
    topline: "#94a3b8", // Slate headline
    midline: "#0f766e", // Teal dotted midline
    baseline: "#1b6b63", // Solid Forest Teal baseline
  },
} as const;

export const OVERLAY_WEIGHTS = {
  strokeNormal: 1.5,
  strokeAttention: 2.0,
  strokeHover: 2.75,
  opacitySpotlight: 1.0,
  opacityAllGuides: 0.55,
  opacityDimmed: 0.18,
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

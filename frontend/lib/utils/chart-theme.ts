/**
 * WriteWise Longitudinal Progress Chart Theme Tokens
 *
 * Centralizes stroke colors, band area fills, and dark/light mode palette
 * mappings for Recharts SVG renderings to match globals.css design tokens.
 */

export interface ChartCriterionConfig {
  key: string;
  label: string;
  lightColor: string;
  darkColor: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

export const CRITERION_CONFIG: readonly ChartCriterionConfig[] = [
  {
    key: "composite",
    label: "Overall Penmanship",
    lightColor: "#1b6b63", // Primary Brand Teal (brand-600)
    darkColor: "#57b3a6",  // Vibrant Teal (brand-400)
    strokeWidth: 3,
    strokeDasharray: undefined,
  },
  {
    key: "letter_formation",
    label: "Letter Shapes",
    lightColor: "#475569", // Slate Gray (slate-600)
    darkColor: "#cbd5e1",  // Slate Tint (slate-300)
    strokeWidth: 2,
    strokeDasharray: "6 3",
  },
  {
    key: "size_consistency",
    label: "Size & Proportions",
    lightColor: "#0e7490", // Deep Cyan / Cool Teal (cyan-700)
    darkColor: "#38bdf8",  // Sky Blue (sky-400)
    strokeWidth: 2,
    strokeDasharray: "4 2",
  },
  {
    key: "spacing",
    label: "Spacing",
    lightColor: "#4338ca", // Indigo Slate (indigo-700)
    darkColor: "#a5b4fc",  // Indigo Tint (indigo-300)
    strokeWidth: 2,
    strokeDasharray: "3 3",
  },
  {
    key: "slant",
    label: "Slant & Tilt",
    lightColor: "#92400e", // Warm Bronze / Sepia (amber-800)
    darkColor: "#fbbf24",  // Warm Ochre (amber-400)
    strokeWidth: 2,
    strokeDasharray: "8 3 2 3",
  },
  {
    key: "baseline_alignment",
    label: "Line Alignment",
    lightColor: "#15803d", // Deep Pine (green-700)
    darkColor: "#4ade80",  // Light Pine (green-400)
    strokeWidth: 2,
    strokeDasharray: "2 2",
  },
] as const;

export interface ChartBandAreaConfig {
  y1: number;
  y2: number;
  fill: string;
  lightOpacity: number;
  darkOpacity: number;
  label: string;
}

export const CHART_BAND_AREAS: readonly ChartBandAreaConfig[] = [
  {
    y1: 75,
    y2: 100,
    fill: "#4a8b5c", // Band 4 — Excellent
    lightOpacity: 0.12,
    darkOpacity: 0.18,
    label: "Excellent (75–100%)",
  },
  {
    y1: 50,
    y2: 75,
    fill: "#7c9b6e", // Band 3 — Satisfactory
    lightOpacity: 0.12,
    darkOpacity: 0.18,
    label: "Satisfactory (50–74%)",
  },
  {
    y1: 25,
    y2: 50,
    fill: "#c9a227", // Band 2 — Developing
    lightOpacity: 0.12,
    darkOpacity: 0.18,
    label: "Developing (25–49%)",
  },
  {
    y1: 0,
    y2: 25,
    fill: "#b6754a", // Band 1 — Needs Improvement
    lightOpacity: 0.12,
    darkOpacity: 0.18,
    label: "Needs Improvement (0–24%)",
  },
] as const;

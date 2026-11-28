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
    label: "Overall Score",
    lightColor: "var(--color-chart-composite)",
    darkColor: "var(--color-chart-composite)",
    strokeWidth: 3,
    strokeDasharray: undefined,
  },
  {
    key: "letter_formation",
    label: "Letter Formation",
    lightColor: "var(--muted-foreground)",
    darkColor: "var(--muted-foreground)",
    strokeWidth: 2,
    strokeDasharray: "6 3",
  },
  {
    key: "size_consistency",
    label: "Size Consistency",
    lightColor: "var(--color-chart-size)",
    darkColor: "var(--color-chart-size)",
    strokeWidth: 2,
    strokeDasharray: "4 2",
  },
  {
    key: "spacing",
    label: "Spacing",
    lightColor: "var(--color-chart-spacing)",
    darkColor: "var(--color-chart-spacing)",
    strokeWidth: 2,
    strokeDasharray: "3 3",
  },
  {
    key: "slant",
    label: "Slant",
    lightColor: "var(--band-1-text)",
    darkColor: "var(--band-1-text)",
    strokeWidth: 2,
    strokeDasharray: "8 3 2 3",
  },
  {
    key: "baseline_alignment",
    label: "Baseline Alignment",
    lightColor: "var(--band-4-text)",
    darkColor: "var(--band-4-text)",
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
    fill: "var(--color-band-4)",
    lightOpacity: 0.12,
    darkOpacity: 0.18,
    label: "Excellent (75–100%)",
  },
  {
    y1: 50,
    y2: 75,
    fill: "var(--color-band-3)",
    lightOpacity: 0.12,
    darkOpacity: 0.18,
    label: "Satisfactory (50–74%)",
  },
  {
    y1: 25,
    y2: 50,
    fill: "var(--color-band-2)",
    lightOpacity: 0.12,
    darkOpacity: 0.18,
    label: "Developing (25–49%)",
  },
  {
    y1: 0,
    y2: 25,
    fill: "var(--color-band-1)",
    lightOpacity: 0.12,
    darkOpacity: 0.18,
    label: "Needs Improvement (0–24%)",
  },
] as const;

export const CHART_DOT_STROKE = {
  light: "var(--surface)",
  dark: "var(--surface)",
} as const;


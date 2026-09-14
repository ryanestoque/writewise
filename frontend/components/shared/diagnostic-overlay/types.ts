export type Severity = "normal" | "needs_attention";

export type CriterionFilter =
  | "all"
  | "letter_formation"
  | "spacing"
  | "size_consistency"
  | "slant"
  | "baseline_alignment";

export interface GuideLinesData {
  baseline_y: number[];
  midline_y: number[];
  topline_y: number[];
}

export interface BaselineAnnotation {
  line_index: number;
  word_index: number;
  bbox: [number, number, number, number];
  deviation_ratio: number;
  severity: Severity;
  note: string;
}

export interface BaselineOverlay {
  guide_lines: GuideLinesData;
  annotations: BaselineAnnotation[];
}

export interface SpacingAnnotation {
  line_index: number;
  gap_index: number;
  x1: number;
  x2: number;
  y: number;
  gap_ratio: number;
  severity: Severity;
  note: string;
}

export interface SpacingOverlay {
  annotations: SpacingAnnotation[];
}

export interface SizeAnnotation {
  line_index: number;
  word_index: number;
  bbox: [number, number, number, number];
  size_ratio: number;
  severity: Severity;
  note: string;
}

export interface SizeOverlay {
  annotations: SizeAnnotation[];
}

export interface SlantAnnotation {
  line_index: number;
  word_index: number;
  bbox: [number, number, number, number];
  angle_deg: number;
  vector: [number, number, number, number];
  severity: Severity;
  note: string;
}

export interface SlantOverlay {
  annotations: SlantAnnotation[];
}

export interface FormationAnnotation {
  line_index: number;
  word_index: number;
  bbox: [number, number, number, number];
  score: number;
  band: string;
  severity: Severity;
  note: string;
}

export interface FormationOverlay {
  annotations: FormationAnnotation[];
}

export interface OverlaySummary {
  weakest_criterion: string;
  attention_item_count: number;
}

export interface DiagnosticOverlayData {
  summary: OverlaySummary;
  baseline: BaselineOverlay;
  spacing: SpacingOverlay;
  size: SizeOverlay;
  slant: SlantOverlay;
  letter_formation: FormationOverlay;
}

export interface ActiveAnnotationHover {
  criterion: CriterionFilter;
  title: string;
  note: string;
  severity: Severity;
  x: number;
  y: number;
}

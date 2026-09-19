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
  id?: string;
  criterion: CriterionFilter;
  title: string;
  note: string;
  severity: Severity;
  x: number;
  y: number;
  lineIndex?: number;
  wordIndex?: number;
}

export type HoverAnnotationCallback = (
  hover:
    | ActiveAnnotationHover
    | null
    | ((prev: ActiveAnnotationHover | null) => ActiveAnnotationHover | null)
) => void;

/**
 * Extracts and returns an ordered list of all annotations that require attention
 * matching the given criterion filter (or across all criteria if "all").
 * Results are sorted in spatial reading order (top-to-bottom by line, left-to-right).
 */
export function getAttentionItems(
  overlay: DiagnosticOverlayData | null | undefined,
  filter: CriterionFilter = "all"
): ActiveAnnotationHover[] {
  if (!overlay) return [];
  const items: ActiveAnnotationHover[] = [];

  if (filter === "all" || filter === "letter_formation") {
    overlay.letter_formation?.annotations?.forEach((ann) => {
      if (ann.severity === "needs_attention") {
        const [x, y, w, h] = ann.bbox;
        items.push({
          id: `formation-${ann.line_index}-${ann.word_index}`,
          criterion: "letter_formation",
          title: `Letter Formation (${ann.band})`,
          note: ann.note,
          severity: "needs_attention",
          x: x + w / 2,
          y: y + h + 4,
          lineIndex: ann.line_index,
          wordIndex: ann.word_index,
        });
      }
    });
  }

  if (filter === "all" || filter === "baseline_alignment") {
    overlay.baseline?.annotations?.forEach((ann) => {
      if (ann.severity === "needs_attention") {
        const [x, y, w, h] = ann.bbox;
        items.push({
          id: `baseline-${ann.line_index}-${ann.word_index}`,
          criterion: "baseline_alignment",
          title: "Baseline Drift Detected",
          note: ann.note,
          severity: "needs_attention",
          x: x + w / 2,
          y: y + h + 6,
          lineIndex: ann.line_index,
          wordIndex: ann.word_index,
        });
      }
    });
  }

  if (filter === "all" || filter === "slant") {
    overlay.slant?.annotations?.forEach((ann) => {
      if (ann.severity === "needs_attention") {
        const [x, y, w] = ann.bbox;
        items.push({
          id: `slant-${ann.line_index}-${ann.word_index}`,
          criterion: "slant",
          title: "Irregular Slant",
          note: ann.note,
          severity: "needs_attention",
          x: x + w / 2,
          y: y - 6,
          lineIndex: ann.line_index,
          wordIndex: ann.word_index,
        });
      }
    });
  }

  if (filter === "all" || filter === "spacing") {
    overlay.spacing?.annotations?.forEach((ann) => {
      if (ann.severity === "needs_attention") {
        items.push({
          id: `spacing-${ann.line_index}-${ann.gap_index}`,
          criterion: "spacing",
          title: "Irregular Word Spacing",
          note: ann.note,
          severity: "needs_attention",
          x: (ann.x1 + ann.x2) / 2,
          y: ann.y - 10,
          lineIndex: ann.line_index,
          wordIndex: ann.gap_index,
        });
      }
    });
  }

  if (filter === "all" || filter === "size_consistency") {
    overlay.size?.annotations?.forEach((ann) => {
      if (ann.severity === "needs_attention") {
        const [x, y, w, h] = ann.bbox;
        items.push({
          id: `size-${ann.line_index}-${ann.word_index}`,
          criterion: "size_consistency",
          title: "Inconsistent Size",
          note: ann.note,
          severity: "needs_attention",
          x: x + w / 2,
          y: y + h + 4,
          lineIndex: ann.line_index,
          wordIndex: ann.word_index,
        });
      }
    });
  }

  // Sort in spatial reading order (line index ascending, then horizontal x coordinate ascending)
  items.sort((a, b) => {
    if (a.lineIndex !== undefined && b.lineIndex !== undefined && a.lineIndex !== b.lineIndex) {
      return a.lineIndex - b.lineIndex;
    }
    return a.x - b.x;
  });

  return items;
}



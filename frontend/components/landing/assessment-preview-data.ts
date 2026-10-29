import type { DiagnosticOverlayData } from "@/components/shared/diagnostic-overlay/types";

// Hand-authored demonstration data, never a real submission or an inference result.
// Coordinates match /images/landing/example-worksheet.svg (620 × 340).
export const EXAMPLE_WORKSHEET = "/images/landing/example-worksheet.svg";
export const EXAMPLE_WORKSHEET_DIMENSIONS = { width: 620, height: 340 } as const;

export const EXAMPLE_CRITERIA = [
  {
    id: "letter_formation",
    name: "Letter formation",
    score: 75,
    observation: "Most loops close cleanly; keep arches rounded on the final word.",
    next: "Finish each loop before joining the next letter.",
  },
  {
    id: "size_consistency",
    name: "Size consistency",
    score: 68,
    observation: "Some small letters reach above the dotted midline.",
    next: "Keep small letter bodies below the dotted line.",
  },
  {
    id: "spacing",
    name: "Spacing",
    score: 48,
    observation: "The first two words nearly touch; the next gap is much wider.",
    next: "Leave an even finger-width space after each word.",
  },
  {
    id: "slant",
    name: "Slant",
    score: 86,
    observation: "The downstrokes lean in a consistent forward direction.",
    next: "Keep that steady lean across your next sentence.",
  },
  {
    id: "baseline_alignment",
    name: "Baseline alignment",
    score: 82,
    observation: "Most letters rest on the baseline; the last word rises slightly.",
    next: "Keep the final word resting on the bottom guide.",
  },
] as const;

export const EXAMPLE_OVERLAY: DiagnosticOverlayData = {
  summary: { weakest_criterion: "spacing", attention_item_count: 2 },
  spacing: {
    annotations: [
      {
        line_index: 0,
        gap_index: 0,
        x1: 210,
        x2: 212,
        y: 156,
        gap_ratio: 0.1,
        severity: "needs_attention",
        note: "The first two words nearly touch. Leave a finger-width space.",
      },
      {
        line_index: 0,
        gap_index: 1,
        x1: 302,
        x2: 350,
        y: 156,
        gap_ratio: 2.8,
        severity: "needs_attention",
        note: "A wide gap separates “fly” and “high.” Aim for an even word space.",
      },
    ],
  },
  baseline: {
    guide_lines: { topline_y: [70], midline_y: [106], baseline_y: [156] },
    annotations: [
      {
        line_index: 0,
        word_index: 0,
        bbox: [60, 66, 150, 90],
        measured_y: 156,
        deviation_ratio: 0.0,
        severity: "normal",
        note: "Rests consistently on the solid baseline.",
      },
      {
        line_index: 0,
        word_index: 1,
        bbox: [212, 66, 90, 90],
        measured_y: 156,
        deviation_ratio: 0.0,
        severity: "normal",
        note: "Baseline stays steady through the descender loop.",
      },
      {
        line_index: 0,
        word_index: 2,
        bbox: [350, 64, 150, 90],
        measured_y: 151,
        deviation_ratio: 0.05,
        severity: "normal",
        note: "The last word sits slightly above the baseline.",
      },
    ],
  },
  size: {
    annotations: [
      {
        line_index: 0,
        word_index: 0,
        bbox: [60, 66, 150, 90],
        core_bbox: [60, 106, 150, 50],
        size_ratio: 1.15,
        severity: "normal",
        note: "Keep the short letters below the dotted midline.",
      },
      {
        line_index: 0,
        word_index: 1,
        bbox: [212, 66, 90, 90],
        core_bbox: [212, 106, 90, 50],
        size_ratio: 1.0,
        severity: "normal",
        note: "Loop height stays within target ruling.",
      },
      {
        line_index: 0,
        word_index: 2,
        bbox: [350, 64, 150, 90],
        core_bbox: [350, 106, 150, 48],
        size_ratio: 1.05,
        severity: "normal",
        note: "Ascender loops reach the dashed topline neatly.",
      },
    ],
  },
  slant: {
    annotations: [
      {
        line_index: 0,
        word_index: 0,
        bbox: [60, 66, 150, 90],
        angle_deg: 12,
        vector: [150, 156, 169, 66],
        severity: "normal",
        note: "A steady forward lean.",
      },
      {
        line_index: 0,
        word_index: 1,
        bbox: [212, 66, 90, 90],
        angle_deg: 12,
        vector: [250, 156, 269, 66],
        severity: "normal",
        note: "The downstrokes follow the same lean.",
      },
      {
        line_index: 0,
        word_index: 2,
        bbox: [350, 64, 150, 90],
        angle_deg: 14,
        vector: [425, 151, 447, 64],
        severity: "normal",
        note: "Matches the angle of the earlier words.",
      },
    ],
  },
  letter_formation: {
    annotations: [
      {
        line_index: 0,
        word_index: 0,
        bbox: [60, 66, 150, 90],
        score: 78,
        band: "Satisfactory",
        severity: "normal",
        transcription: "kites",
        note: "Clean entry strokes on “k” and clear connector into “i”.",
        letter_zones: [
          { char: "k", bbox: [60, 66, 41, 90], confidence: 0.94 },
          { char: "i", bbox: [101, 66, 22, 90], confidence: 0.96 },
          { char: "t", bbox: [123, 66, 28, 90], confidence: 0.93 },
          { char: "e", bbox: [151, 66, 28, 90], confidence: 0.95 },
          { char: "s", bbox: [179, 66, 31, 90], confidence: 0.92 },
        ],
      },
      {
        line_index: 0,
        word_index: 1,
        bbox: [212, 66, 90, 90],
        score: 76,
        band: "Satisfactory",
        severity: "normal",
        transcription: "fly",
        note: "Follow the loop through to the next letter without lifting the pencil.",
        letter_zones: [
          { char: "f", bbox: [212, 66, 22, 90], confidence: 0.93 },
          { char: "l", bbox: [234, 66, 23, 90], confidence: 0.95 },
          { char: "y", bbox: [257, 66, 45, 90], confidence: 0.92 },
        ],
      },
      {
        line_index: 0,
        word_index: 2,
        bbox: [350, 64, 150, 90],
        score: 72,
        band: "Satisfactory",
        severity: "normal",
        transcription: "high",
        note: "Loop of “h” is formed smoothly; keep subsequent arches rounded.",
        letter_zones: [
          { char: "h", bbox: [350, 64, 46, 90], confidence: 0.94 },
          { char: "i", bbox: [396, 64, 23, 90], confidence: 0.97 },
          { char: "g", bbox: [419, 64, 35, 90], confidence: 0.91 },
          { char: "h", bbox: [454, 64, 46, 90], confidence: 0.93 },
        ],
      },
    ],
  },
};

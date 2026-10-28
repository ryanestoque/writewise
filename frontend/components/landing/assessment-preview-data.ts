import type { DiagnosticOverlayData } from "@/components/shared/diagnostic-overlay/types";

// Hand-authored demonstration data, never a real submission or an inference result.
// Coordinates match /images/landing/example-worksheet.svg (620 × 430).
export const EXAMPLE_WORKSHEET = "/images/landing/example-worksheet.svg";
export const EXAMPLE_WORKSHEET_DIMENSIONS = { width: 620, height: 430 } as const;

export const EXAMPLE_CRITERIA = [
  {
    id: "letter_formation",
    name: "Letter formation",
    score: 76,
    observation: "Most loops close and the letters stay connected.",
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
    next: "Leave the same finger-width space after each word.",
  },
  {
    id: "slant",
    name: "Slant",
    score: 86,
    observation: "The downstrokes lean in a similar direction.",
    next: "Keep that steady lean across the next sentence.",
  },
  {
    id: "baseline_alignment",
    name: "Baseline alignment",
    score: 82,
    observation: "Most letters rest on the baseline; the last word rises slightly.",
    next: "Keep the last word resting on the bottom guide.",
  },
] as const;

export const EXAMPLE_OVERLAY: DiagnosticOverlayData = {
  summary: { weakest_criterion: "spacing", attention_item_count: 1 },
  spacing: {
    annotations: [
      {
        line_index: 0,
        gap_index: 0,
        x1: 210,
        x2: 212,
        y: 170,
        gap_ratio: 0.1,
        severity: "needs_attention",
        note: "The first two words nearly touch. Leave a finger-width space.",
      },
      {
        line_index: 1,
        gap_index: 0,
        x1: 210,
        x2: 235,
        y: 330,
        gap_ratio: 1.25,
        severity: "normal",
        note: "An even word space on the second line.",
      },
      {
        line_index: 1,
        gap_index: 1,
        x1: 325,
        x2: 350,
        y: 330,
        gap_ratio: 1.25,
        severity: "normal",
        note: "The same word space repeats.",
      },
    ],
  },
  baseline: {
    guide_lines: { topline_y: [70, 230], midline_y: [106, 266], baseline_y: [156, 316] },
    annotations: [
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
        size_ratio: 1.15,
        severity: "normal",
        note: "Keep the short letters below the dotted midline.",
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
        bbox: [212, 66, 90, 110],
        angle_deg: 12,
        vector: [250, 156, 269, 66],
        severity: "normal",
        note: "The downstrokes follow the same lean.",
      },
    ],
  },
  letter_formation: {
    annotations: [
      {
        line_index: 0,
        word_index: 1,
        bbox: [212, 66, 90, 110],
        score: 76,
        band: "Satisfactory",
        severity: "normal",
        transcription: "fly",
        note: "Follow the loop through to the next letter without lifting the pencil.",
      },
    ],
  },
};

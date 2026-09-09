"use client";

import { useState, useEffect } from "react";

/**
 * Shape of the `guide_lines` object inside `raw_output` (CV_PIPELINE §4).
 * Each array holds y-pixel positions (in the original image coordinate space)
 * of the detected reference lines.
 */
export interface GuideLines {
  baseline_y: number[];
  midline_y: number[];
  topline_y: number[];
}

/**
 * Safely extracts GuideLines coordinates from a measurement record or raw_output JSON.
 * Returns null if the guide_lines property is missing or invalid.
 */
export function extractGuideLines(rawOutputOrMeasurement: unknown): GuideLines | null {
  if (!rawOutputOrMeasurement || typeof rawOutputOrMeasurement !== "object") return null;
  const obj = rawOutputOrMeasurement as Record<string, unknown>;
  const raw = "raw_output" in obj ? obj.raw_output : obj;
  if (!raw || typeof raw !== "object") return null;
  const gl = (raw as Record<string, unknown>).guide_lines;
  if (!gl || typeof gl !== "object") return null;
  const typed = gl as Record<string, unknown>;
  if (
    !Array.isArray(typed.baseline_y) ||
    !Array.isArray(typed.midline_y) ||
    !Array.isArray(typed.topline_y)
  ) {
    return null;
  }
  return gl as GuideLines;
}

interface GuideLineOverlayProps {
  /** Guide-line coordinates from `measurement.raw_output.guide_lines` */
  guideLines: GuideLines | null | undefined;
  /** Source image URL — used to determine natural (intrinsic) dimensions */
  imageUrl: string | null | undefined;
  /** Whether the overlay is visible (controlled by parent toggle) */
  visible: boolean;
}

/**
 * Renders detected guide lines (baseline, midline, topline) as an SVG overlay
 * that sits on top of the worksheet image inside `WorksheetImageInspector`.
 *
 * Uses an SVG `viewBox` matching the image's natural pixel dimensions with
 * `preserveAspectRatio="xMidYMid meet"` — identical to how the `<img>` element
 * behaves with `object-fit: contain`. This means all y-coordinates from the
 * pipeline can be drawn directly without manual scale calculations.
 */
export function GuideLineOverlay({
  guideLines,
  imageUrl,
  visible,
}: GuideLineOverlayProps) {
  const [prevImageUrl, setPrevImageUrl] = useState(imageUrl);
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  if (imageUrl !== prevImageUrl) {
    setPrevImageUrl(imageUrl);
    setNaturalSize(null);
  }

  // Load the image's intrinsic dimensions so the SVG viewBox can mirror them.
  useEffect(() => {
    if (!imageUrl) return;

    let active = true;
    const img = new Image();
    img.onload = () => {
      if (active) {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };
    img.onerror = () => {
      if (active) {
        setNaturalSize(null);
      }
    };
    img.src = imageUrl;

    return () => {
      active = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

  // Nothing to render if hidden, no data, or image dimensions unknown
  if (!visible || !guideLines || !naturalSize) return null;

  const { baseline_y, midline_y, topline_y } = guideLines;
  const hasLines =
    baseline_y.length > 0 || midline_y.length > 0 || topline_y.length > 0;

  if (!hasLines) return null;

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full pointer-events-none z-10"
      viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Baselines — solid, brand-tinted, most prominent */}
      {baseline_y.map((y, i) => (
        <line
          key={`baseline-${i}`}
          x1={0}
          y1={y}
          x2={naturalSize.width}
          y2={y}
          stroke="var(--color-brand-600)"
          strokeWidth={2}
          strokeOpacity={0.35}
        />
      ))}

      {/* Midlines — dashed, muted */}
      {midline_y.map((y, i) => (
        <line
          key={`midline-${i}`}
          x1={0}
          y1={y}
          x2={naturalSize.width}
          y2={y}
          stroke="var(--color-muted-foreground)"
          strokeWidth={1.25}
          strokeOpacity={0.3}
          strokeDasharray="8 6"
        />
      ))}

      {/* Toplines — dashed, lightest */}
      {topline_y.map((y, i) => (
        <line
          key={`topline-${i}`}
          x1={0}
          y1={y}
          x2={naturalSize.width}
          y2={y}
          stroke="var(--color-muted-foreground)"
          strokeWidth={1}
          strokeOpacity={0.22}
          strokeDasharray="4 6"
        />
      ))}
    </svg>
  );
}

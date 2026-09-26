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

export interface LineBounds {
  minX: number;
  maxX: number;
}

interface GuideLineOverlayProps {
  /** Guide-line coordinates from `measurement.raw_output.guide_lines` */
  guideLines: GuideLines | null | undefined;
  /** Source image URL — used to determine natural (intrinsic) dimensions */
  imageUrl: string | null | undefined;
  /** Whether the overlay is visible (controlled by parent toggle) */
  visible: boolean;
  /** Optional active line bounds (keyed by line_index) to restrict guidelines to cursive bounds */
  lineBounds?: Record<number, LineBounds> | null;
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
const naturalSizeCache = new Map<string, { width: number; height: number }>();

export function GuideLineOverlay({
  guideLines,
  imageUrl,
  visible,
  lineBounds,
}: GuideLineOverlayProps) {
  const [prevImageUrl, setPrevImageUrl] = useState(imageUrl);
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(() => (imageUrl ? naturalSizeCache.get(imageUrl) ?? null : null));

  if (imageUrl !== prevImageUrl) {
    setPrevImageUrl(imageUrl);
    setNaturalSize(imageUrl ? naturalSizeCache.get(imageUrl) ?? null : null);
  }

  // Load the image's intrinsic dimensions so the SVG viewBox can mirror them.
  useEffect(() => {
    if (!imageUrl || naturalSizeCache.has(imageUrl)) return;

    let active = true;
    const img = new Image();
    img.onload = () => {
      if (active) {
        const size = { width: img.naturalWidth, height: img.naturalHeight };
        naturalSizeCache.set(imageUrl, size);
        setNaturalSize(size);
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

  const hasBounds = Boolean(lineBounds && Object.keys(lineBounds).length > 0);

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full pointer-events-none z-10"
      viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {baseline_y.map((baseY, i) => {
        const bounds = lineBounds?.[i];
        if (hasBounds && !bounds) return null;

        const topY = topline_y[i];
        const midY = midline_y[i];

        const lineHeight = topY !== undefined ? baseY - topY : 40;
        const pad = Math.max(24, Math.round(lineHeight > 0 ? lineHeight * 0.35 : 24));
        const x1 = bounds ? Math.max(0, bounds.minX - pad) : 0;
        const x2 = bounds ? Math.min(naturalSize.width, bounds.maxX + pad) : naturalSize.width;

        return (
          <g key={`guideline-group-${i}`}>
            {/* Baselines — solid, brand-tinted, most prominent */}
            <line
              key={`baseline-${i}`}
              x1={x1}
              y1={baseY}
              x2={x2}
              y2={baseY}
              stroke="var(--color-brand-700, #0f766e)"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
              strokeOpacity={0.85}
            />

            {/* Midlines — dashed, teal tinted */}
            {midY !== undefined && (
              <line
                key={`midline-${i}`}
                x1={x1}
                y1={midY}
                x2={x2}
                y2={midY}
                stroke="var(--color-brand-600, #0d9488)"
                strokeWidth={1.75}
                vectorEffect="non-scaling-stroke"
                strokeOpacity={0.75}
                strokeDasharray="6 4"
              />
            )}

            {/* Toplines — dashed, slate headline */}
            {topY !== undefined && (
              <line
                key={`topline-${i}`}
                x1={x1}
                y1={topY}
                x2={x2}
                y2={topY}
                stroke="var(--color-muted-foreground, #64748b)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                strokeOpacity={0.65}
                strokeDasharray="4 4"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

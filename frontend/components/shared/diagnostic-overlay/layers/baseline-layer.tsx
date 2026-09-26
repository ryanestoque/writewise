"use client";

import { memo, useMemo } from "react";
import type {
  BaselineOverlay,
  CriterionFilter,
  HoverAnnotationCallback,
} from "../types";

import { OVERLAY_COLORS, OVERLAY_WEIGHTS } from "../constants";

interface BaselineLayerProps {
  data: BaselineOverlay;
  activeCriterion: CriterionFilter;
  viewWidth: number;
  hitScale?: number;
  activeAnnotationId?: string | null;
  onHoverAnnotation: HoverAnnotationCallback;
}

export const BaselineLayer = memo(function BaselineLayer({
  data,
  activeCriterion,
  viewWidth,
  hitScale = 1,
  activeAnnotationId,
  onHoverAnnotation,
}: BaselineLayerProps) {
  const isSpotlight = activeCriterion === "baseline_alignment";
  const isDimmed = activeCriterion !== "all" && !isSpotlight;

  const guide_lines = data?.guide_lines;
  const annotations = data?.annotations ?? [];
  const topline_y = guide_lines?.topline_y ?? [];
  const midline_y = guide_lines?.midline_y ?? [];
  const baseline_y = guide_lines?.baseline_y ?? [];

  // Group annotations by line_index to determine active lines and horizontal cursive bounds
  const activeLineBounds = useMemo(() => {
    const map = new Map<number, { minX: number; maxX: number }>();
    if (!data?.annotations) return map;
    for (const ann of data.annotations) {
      if (!ann.bbox || ann.bbox.length < 4) continue;
      const lineIdx = ann.line_index;
      const [x, , w] = ann.bbox;
      const rightX = x + w;
      const existing = map.get(lineIdx);
      if (!existing) {
        map.set(lineIdx, { minX: x, maxX: rightX });
      } else {
        existing.minX = Math.min(existing.minX, x);
        existing.maxX = Math.max(existing.maxX, rightX);
      }
    }
    return map;
  }, [data?.annotations]);

  if (isDimmed) return null;

  return (
    <g
      className="transition-opacity duration-200"
      style={{
        opacity: isSpotlight
          ? OVERLAY_WEIGHTS.opacitySpotlight
          : OVERLAY_WEIGHTS.opacityAllGuides,
      }}
    >
      {/* 1. Traditional 3-line Penmanship Guidelines bounded to cursive writing */}
      {baseline_y.map((baseY, idx) => {
        const bounds = activeLineBounds.get(idx);
        // If annotations exist, only render guidelines on lines with cursive handwriting
        if (!bounds && activeLineBounds.size > 0) return null;

        const topY = topline_y[idx];
        const midY = midline_y[idx];

        const lineHeight = topY !== undefined ? baseY - topY : 40;
        const pad = Math.max(24, Math.round(lineHeight > 0 ? lineHeight * 0.35 : 24));
        const x1 = bounds ? Math.max(0, bounds.minX - pad) : 0;
        const x2 = bounds ? Math.min(viewWidth, bounds.maxX + pad) : viewWidth;

        return (
          <g key={`guidelines-group-${idx}`} className="pointer-events-none">
            {/* Topline — dashed, slate headline */}
            {topY !== undefined && (
              <line
                key={`topline-${idx}`}
                x1={x1}
                y1={topY}
                x2={x2}
                y2={topY}
                stroke={OVERLAY_COLORS.guidelines.topline}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                strokeDasharray={`${6 * hitScale} ${5 * hitScale}`}
                strokeOpacity={isSpotlight ? 0.85 : 0.65}
              />
            )}

            {/* Midline — dashed, teal tinted */}
            {midY !== undefined && (
              <line
                key={`midline-${idx}`}
                x1={x1}
                y1={midY}
                x2={x2}
                y2={midY}
                stroke={OVERLAY_COLORS.guidelines.midline}
                strokeWidth={1.75}
                vectorEffect="non-scaling-stroke"
                strokeOpacity={isSpotlight ? 0.95 : 0.75}
                strokeDasharray={`${3 * hitScale} ${4 * hitScale}`}
              />
            )}

            {/* Baseline — solid, brand-tinted */}
            <line
              key={`baseline-${idx}`}
              x1={x1}
              y1={baseY}
              x2={x2}
              y2={baseY}
              stroke={OVERLAY_COLORS.guidelines.baseline}
              strokeWidth={isSpotlight ? 3 : 2.5}
              vectorEffect="non-scaling-stroke"
              strokeOpacity={isSpotlight ? 1.0 : 0.85}
            />
          </g>
        );
      })}

      {/* 2. Word Baseline Drift Markers */}
      {annotations.map((ann, idx) => {
        const [x, y, w, h] = ann.bbox;
        const isAttention = ann.severity === "needs_attention";
        const wordBottomY = ann.measured_y ?? (y + h);

        if (!isAttention && !isSpotlight) return null;

        const strokeColor = isAttention
          ? OVERLAY_COLORS.needs_attention.stroke
          : OVERLAY_COLORS.proficient.stroke;
        const id = `baseline-${ann.line_index}-${ann.word_index}`;
        const title = isAttention ? "Baseline Drift Detected" : "Baseline Aligned";
        const hoverPayload = {
          id,
          criterion: "baseline_alignment" as const,
          title,
          note: ann.note,
          severity: ann.severity,
          x: x + w / 2,
          y: wordBottomY + 6,
        };

        const toggleAnnotation = () => {
          onHoverAnnotation((prev) => (prev?.id === id ? null : hoverPayload));
        };

        const isFocusable = isSpotlight || isAttention;
        const isActive = activeAnnotationId === id;

        return (
          <g
            key={`baseline-ann-${idx}`}
            id={id}
            role="button"
            tabIndex={isFocusable ? 0 : -1}
            aria-expanded={isActive}
            aria-describedby={isActive ? "diagnostic-annotation-tooltip" : undefined}
            aria-label={`${isAttention ? "Needs attention: " : "Consistent: "} ${title}. ${ann.note}`}
            className="cursor-pointer pointer-events-auto group focus-visible:outline-hidden"
            onMouseEnter={() => onHoverAnnotation(hoverPayload)}
            onMouseLeave={() => onHoverAnnotation(null)}
            onFocus={() => onHoverAnnotation(hoverPayload)}
            onBlur={() => onHoverAnnotation(null)}
            onClick={(e) => {
              e.stopPropagation();
              toggleAnnotation();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                toggleAnnotation();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onHoverAnnotation(null);
              }
            }}
          >
            {/* Generous touch hit area (scaled to maintain minimum 36px physical screen pixels on mobile) */}
            <line
              x1={x}
              y1={wordBottomY}
              x2={x + w}
              y2={wordBottomY}
              stroke="transparent"
              strokeWidth={Math.max(36, 36 * hitScale)}
              strokeLinecap="round"
              className="pointer-events-auto"
            />

            {/* Keyboard Focus / Selection Highlight Indicator (WCAG 2.4.7) */}
            <line
              x1={x - 2 * hitScale}
              y1={wordBottomY}
              x2={x + w + 2 * hitScale}
              y2={wordBottomY}
              strokeWidth={5}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              className={`transition-opacity stroke-brand-700 dark:stroke-brand-400 pointer-events-none ${
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-75 group-focus-visible:opacity-100"
              }`}
            />

            {/* Word Baseline Anchor Bar */}
            <line
              x1={x}
              y1={wordBottomY}
              x2={x + w}
              y2={wordBottomY}
              stroke={strokeColor}
              strokeWidth={isAttention ? OVERLAY_WEIGHTS.strokeAttention : OVERLAY_WEIGHTS.strokeNormal}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={isAttention ? "none" : `${4 * hitScale} ${3 * hitScale}`}
              className="transition-all"
            />

            {/* Deviation Indicator Indicator Dot */}
            {isAttention && (
              <g transform={`translate(${x + w / 2}, ${wordBottomY})`}>
                <circle
                  cx={0}
                  cy={0}
                  r={5.5 * hitScale}
                  fill={strokeColor}
                  stroke="#ffffff"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  className="transition-transform group-hover:scale-125 group-focus-visible:scale-125 motion-reduce:transform-none"
                />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
});

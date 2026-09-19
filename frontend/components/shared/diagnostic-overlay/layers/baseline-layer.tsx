"use client";

import { memo } from "react";
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

  if (isDimmed) return null;

  const guide_lines = data?.guide_lines;
  const annotations = data?.annotations ?? [];
  const topline_y = guide_lines?.topline_y ?? [];
  const midline_y = guide_lines?.midline_y ?? [];
  const baseline_y = guide_lines?.baseline_y ?? [];

  return (
    <g
      className="transition-opacity duration-200"
      style={{
        opacity: isSpotlight
          ? OVERLAY_WEIGHTS.opacitySpotlight
          : OVERLAY_WEIGHTS.opacityAllGuides,
      }}
    >
      {/* 1. Traditional 3-line Penmanship Guidelines across the worksheet */}
      {topline_y.map((y, idx) => (
        <line
          key={`topline-${idx}`}
          x1={0}
          y1={y}
          x2={viewWidth}
          y2={y}
          stroke={OVERLAY_COLORS.guidelines.topline}
          strokeWidth={1}
          strokeDasharray="4 4"
          strokeOpacity={isSpotlight ? 0.65 : 0.4}
          className="pointer-events-none"
        />
      ))}

      {midline_y.map((y, idx) => (
        <line
          key={`midline-${idx}`}
          x1={0}
          y1={y}
          x2={viewWidth}
          y2={y}
          stroke={OVERLAY_COLORS.guidelines.midline}
          strokeWidth={1}
          strokeDasharray="2 3"
          strokeOpacity={isSpotlight ? 0.75 : 0.45}
          className="pointer-events-none"
        />
      ))}

      {baseline_y.map((y, idx) => (
        <line
          key={`baseline-${idx}`}
          x1={0}
          y1={y}
          x2={viewWidth}
          y2={y}
          stroke={OVERLAY_COLORS.guidelines.baseline}
          strokeWidth={isSpotlight ? 1.5 : 1.2}
          strokeOpacity={isSpotlight ? 0.9 : 0.55}
          className="pointer-events-none"
        />
      ))}

      {/* 2. Word Baseline Drift Markers */}
      {annotations.map((ann, idx) => {
        const [x, y, w, h] = ann.bbox;
        const isAttention = ann.severity === "needs_attention";
        const wordBottomY = y + h;

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
            role="button"
            tabIndex={isFocusable ? 0 : -1}
            aria-haspopup="dialog"
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
                onHoverAnnotation(null);
              }
            }}
          >
            {/* Generous touch hit area (scaled to maintain minimum 28-32px physical screen pixels on mobile) */}
            <line
              x1={x}
              y1={wordBottomY}
              x2={x + w}
              y2={wordBottomY}
              stroke="transparent"
              strokeWidth={Math.max(28, 28 * hitScale)}
              strokeLinecap="round"
              className="pointer-events-auto"
            />

            {/* Keyboard Focus Highlight Indicator (WCAG 2.4.7) */}
            <line
              x1={x - 2}
              y1={wordBottomY}
              x2={x + w + 2}
              y2={wordBottomY}
              strokeWidth={4}
              strokeLinecap="round"
              className="opacity-0 group-focus-visible:opacity-100 transition-opacity stroke-brand-600 dark:stroke-brand-400 pointer-events-none"
            />

            {/* Word Baseline Anchor Bar */}
            <line
              x1={x}
              y1={wordBottomY}
              x2={x + w}
              y2={wordBottomY}
              stroke={strokeColor}
              strokeWidth={isAttention ? OVERLAY_WEIGHTS.strokeAttention : OVERLAY_WEIGHTS.strokeNormal}
              strokeDasharray={isAttention ? "none" : "3 2"}
              className="transition-all group-hover:stroke-width-2.5 group-focus-visible:stroke-width-2.5"
            />

            {/* Deviation Indicator Indicator Dot */}
            {isAttention && (
              <circle
                cx={x + w / 2}
                cy={wordBottomY}
                r={3.5}
                fill={strokeColor}
                stroke="#ffffff"
                strokeWidth={1.5}
                className="transition-transform group-hover:scale-125 group-focus-visible:scale-125 motion-reduce:transform-none"
              />
            )}
          </g>
        );
      })}
    </g>
  );
});

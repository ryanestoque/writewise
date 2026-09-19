"use client";

import { memo } from "react";
import type {
  SpacingOverlay,
  CriterionFilter,
  HoverAnnotationCallback,
} from "../types";

import { OVERLAY_COLORS, OVERLAY_WEIGHTS } from "../constants";

interface SpacingLayerProps {
  data: SpacingOverlay;
  activeCriterion: CriterionFilter;
  hitScale?: number;
  activeAnnotationId?: string | null;
  onHoverAnnotation: HoverAnnotationCallback;
}

export const SpacingLayer = memo(function SpacingLayer({
  data,
  activeCriterion,
  hitScale = 1,
  activeAnnotationId,
  onHoverAnnotation,
}: SpacingLayerProps) {
  const isSpotlight = activeCriterion === "spacing";
  const isDimmed = activeCriterion !== "all" && !isSpotlight;

  if (isDimmed) return null;

  const annotations = data?.annotations ?? [];

  return (
    <g
      className="transition-opacity duration-200"
      style={{
        opacity: isSpotlight
          ? OVERLAY_WEIGHTS.opacitySpotlight
          : OVERLAY_WEIGHTS.opacityAllGuides,
      }}
    >
      {annotations.map((ann, idx) => {
        const { x1, x2, y, gap_ratio, severity, note } = ann;
        const width = Math.max(8, x2 - x1);
        const isAttention = severity === "needs_attention";

        if (!isAttention && !isSpotlight) return null;

        const bracketColor = isAttention
          ? OVERLAY_COLORS.needs_attention.stroke
          : OVERLAY_COLORS.consistent.stroke;
        const tickHeight = isSpotlight ? 7 : 5;
        const id = `spacing-${ann.line_index}-${ann.gap_index}`;
        const title = isAttention ? "Spacing Needs Attention" : "Consistent Word Spacing";
        const hoverPayload = {
          id,
          criterion: "spacing" as const,
          title,
          note,
          severity,
          x: x1 + width / 2,
          y: y - 10,
        };

        const toggleAnnotation = () => {
          onHoverAnnotation((prev) => (prev?.id === id ? null : hoverPayload));
        };

        const isFocusable = isSpotlight || isAttention;
        const isActive = activeAnnotationId === id;
        const minHit = Math.max(28, 28 * hitScale);
        const hitW = Math.max(minHit, width + 8);
        const hitH = Math.max(minHit, tickHeight * 2 + 8);

        return (
          <g
            key={`spacing-gap-${idx}`}
            role="button"
            tabIndex={isFocusable ? 0 : -1}
            aria-haspopup="dialog"
            aria-expanded={isActive}
            aria-describedby={isActive ? "diagnostic-annotation-tooltip" : undefined}
            aria-label={`${isAttention ? "Needs attention: " : "Consistent: "} ${title}. ${note}`}
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
            <rect
              x={x1 - (hitW - width) / 2}
              y={y - hitH / 2}
              width={hitW}
              height={hitH}
              fill="transparent"
              className="pointer-events-auto"
            />

            {/* Keyboard Focus / Selection Highlight Ring (WCAG 2.4.7) */}
            <rect
              x={x1 - 2}
              y={y - tickHeight - 2}
              width={width + 4}
              height={tickHeight * 2 + 4}
              fill="none"
              strokeWidth={2}
              strokeDasharray="3 2"
              rx={3}
              className={`transition-opacity stroke-brand-600 dark:stroke-brand-400 pointer-events-none ${
                isActive ? "opacity-100" : "opacity-0 group-focus-visible:opacity-100"
              }`}
            />

            {/* Shaded Gap Interval */}
            <rect
              x={x1}
              y={y - tickHeight}
              width={width}
              height={tickHeight * 2}
              fill={bracketColor}
              fillOpacity={isAttention ? 0.12 : 0.04}
              rx={1.5}
              className="transition-opacity group-hover:fill-opacity-25 group-focus-visible:fill-opacity-25"
            />

            {/* Horizontal Measurement Line */}
            <line
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke={bracketColor}
              strokeWidth={isAttention ? OVERLAY_WEIGHTS.strokeAttention : OVERLAY_WEIGHTS.strokeNormal}
            />

            {/* Left Bracket Tick */}
            <line
              x1={x1}
              y1={y - tickHeight}
              x2={x1}
              y2={y + tickHeight}
              stroke={bracketColor}
              strokeWidth={isAttention ? OVERLAY_WEIGHTS.strokeAttention : OVERLAY_WEIGHTS.strokeNormal}
            />

            {/* Right Bracket Tick */}
            <line
              x1={x2}
              y1={y - tickHeight}
              x2={x2}
              y2={y + tickHeight}
              stroke={bracketColor}
              strokeWidth={isAttention ? OVERLAY_WEIGHTS.strokeAttention : OVERLAY_WEIGHTS.strokeNormal}
            />

            {/* In spotlight mode, render ratio pill */}
            {isSpotlight && (
              <g transform={`translate(${x1 + width / 2}, ${y - 10})`}>
                <rect
                  x={-14}
                  y={-7}
                  width={28}
                  height={14}
                  rx={7}
                  fill={bracketColor}
                  className="transition-transform group-hover:scale-110 motion-reduce:transform-none"
                />
                <text
                  x={0}
                  y={3}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="8.5"
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  {gap_ratio}x
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
});

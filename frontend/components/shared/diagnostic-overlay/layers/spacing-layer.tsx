"use client";

import { memo } from "react";
import type {
  SpacingOverlay,
  CriterionFilter,
  ActiveAnnotationHover,
} from "../types";

interface SpacingLayerProps {
  data: SpacingOverlay;
  activeCriterion: CriterionFilter;
  onHoverAnnotation: (hover: ActiveAnnotationHover | null) => void;
}

export const SpacingLayer = memo(function SpacingLayer({
  data,
  activeCriterion,
  onHoverAnnotation,
}: SpacingLayerProps) {
  const isSpotlight = activeCriterion === "spacing";
  const isDimmed = activeCriterion !== "all" && !isSpotlight;

  if (isDimmed) return null;

  return (
    <g
      className="transition-opacity duration-200"
      style={{ opacity: isSpotlight ? 1.0 : 0.7 }}
    >
      {data.annotations.map((ann, idx) => {
        const { x1, x2, y, gap_ratio, severity, note } = ann;
        const width = Math.max(8, x2 - x1);
        const isAttention = severity === "needs_attention";

        if (!isAttention && !isSpotlight) return null;

        const bracketColor = isAttention ? "#f43f5e" : "#8b5cf6";
        const tickHeight = isSpotlight ? 8 : 6;

        return (
          <g
            key={`spacing-gap-${idx}`}
            className="cursor-pointer pointer-events-auto group"
            onMouseEnter={() =>
              onHoverAnnotation({
                criterion: "spacing",
                title: isAttention ? "Spacing Needs Attention" : "Consistent Word Spacing",
                note,
                severity,
                x: x1 + width / 2,
                y: y - 10,
              })
            }
            onMouseLeave={() => onHoverAnnotation(null)}
          >
            {/* Shaded Gap Interval */}
            <rect
              x={x1}
              y={y - tickHeight}
              width={width}
              height={tickHeight * 2}
              fill={bracketColor}
              fillOpacity={isAttention ? 0.18 : 0.08}
              rx={2}
              className="transition-opacity group-hover:fill-opacity-30"
            />

            {/* Horizontal Measurement Line */}
            <line
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke={bracketColor}
              strokeWidth={isAttention ? 2 : 1.25}
            />

            {/* Left Bracket Tick */}
            <line
              x1={x1}
              y1={y - tickHeight}
              x2={x1}
              y2={y + tickHeight}
              stroke={bracketColor}
              strokeWidth={isAttention ? 2 : 1.25}
            />

            {/* Right Bracket Tick */}
            <line
              x1={x2}
              y1={y - tickHeight}
              x2={x2}
              y2={y + tickHeight}
              stroke={bracketColor}
              strokeWidth={isAttention ? 2 : 1.25}
            />

            {/* In spotlight or on attention, render small ratio pill */}
            {(isSpotlight || isAttention) && (
              <g transform={`translate(${x1 + width / 2}, ${y - 10})`}>
                <rect
                  x={-14}
                  y={-9}
                  width={28}
                  height={14}
                  rx={7}
                  fill={bracketColor}
                  className="transition-transform group-hover:scale-110"
                />
                <text
                  x={0}
                  y={1.5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9"
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

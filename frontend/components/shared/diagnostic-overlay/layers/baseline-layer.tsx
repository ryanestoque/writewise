"use client";

import { memo } from "react";
import type {
  BaselineOverlay,
  CriterionFilter,
  ActiveAnnotationHover,
} from "../types";

interface BaselineLayerProps {
  data: BaselineOverlay;
  activeCriterion: CriterionFilter;
  viewWidth: number;
  onHoverAnnotation: (hover: ActiveAnnotationHover | null) => void;
}

export const BaselineLayer = memo(function BaselineLayer({
  data,
  activeCriterion,
  viewWidth,
  onHoverAnnotation,
}: BaselineLayerProps) {
  const isSpotlight = activeCriterion === "baseline_alignment";
  const isDimmed = activeCriterion !== "all" && !isSpotlight;

  if (isDimmed) return null;

  const { guide_lines, annotations } = data;

  return (
    <g
      className="transition-opacity duration-200"
      style={{ opacity: isSpotlight ? 1.0 : 0.65 }}
    >
      {/* 1. Reference Guidelines across the worksheet */}
      {guide_lines.topline_y.map((y, idx) => (
        <line
          key={`topline-${idx}`}
          x1={0}
          y1={y}
          x2={viewWidth}
          y2={y}
          stroke="#94a3b8"
          strokeWidth={1}
          strokeDasharray="4 4"
          strokeOpacity={isSpotlight ? 0.6 : 0.35}
          className="pointer-events-none"
        />
      ))}

      {guide_lines.midline_y.map((y, idx) => (
        <line
          key={`midline-${idx}`}
          x1={0}
          y1={y}
          x2={viewWidth}
          y2={y}
          stroke="#0284c7"
          strokeWidth={1}
          strokeDasharray="2 3"
          strokeOpacity={isSpotlight ? 0.65 : 0.4}
          className="pointer-events-none"
        />
      ))}

      {guide_lines.baseline_y.map((y, idx) => (
        <line
          key={`baseline-${idx}`}
          x1={0}
          y1={y}
          x2={viewWidth}
          y2={y}
          stroke="#0284c7"
          strokeWidth={isSpotlight ? 1.75 : 1.25}
          strokeOpacity={isSpotlight ? 0.9 : 0.6}
          className="pointer-events-none"
        />
      ))}

      {/* 2. Word Baseline Drift Markers */}
      {annotations.map((ann, idx) => {
        const [x, y, w, h] = ann.bbox;
        const isAttention = ann.severity === "needs_attention";
        const wordBottomY = y + h;

        if (!isAttention && !isSpotlight) return null;

        const strokeColor = isAttention ? "#f59e0b" : "#38bdf8";

        return (
          <g
            key={`baseline-ann-${idx}`}
            className="cursor-pointer pointer-events-auto group"
            onMouseEnter={() =>
              onHoverAnnotation({
                criterion: "baseline_alignment",
                title: isAttention ? "Baseline Drift Detected" : "Baseline Aligned",
                note: ann.note,
                severity: ann.severity,
                x: x + w / 2,
                y: wordBottomY + 6,
              })
            }
            onMouseLeave={() => onHoverAnnotation(null)}
          >
            {/* Word Baseline Anchor Bar */}
            <line
              x1={x}
              y1={wordBottomY}
              x2={x + w}
              y2={wordBottomY}
              stroke={strokeColor}
              strokeWidth={isAttention ? 2.5 : 1.5}
              strokeDasharray={isAttention ? "none" : "3 2"}
              className="transition-all group-hover:stroke-width-3"
            />

            {/* Deviation Indicator Indicator Dot */}
            {isAttention && (
              <circle
                cx={x + w / 2}
                cy={wordBottomY}
                r={4}
                fill={strokeColor}
                stroke="#ffffff"
                strokeWidth={1.5}
                className="transition-transform group-hover:scale-125"
              />
            )}
          </g>
        );
      })}
    </g>
  );
});

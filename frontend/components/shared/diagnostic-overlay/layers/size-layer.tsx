"use client";

import { memo } from "react";
import type {
  SizeOverlay,
  CriterionFilter,
  ActiveAnnotationHover,
} from "../types";

interface SizeLayerProps {
  data: SizeOverlay;
  activeCriterion: CriterionFilter;
  onHoverAnnotation: (hover: ActiveAnnotationHover | null) => void;
}

export const SizeLayer = memo(function SizeLayer({
  data,
  activeCriterion,
  onHoverAnnotation,
}: SizeLayerProps) {
  const isSpotlight = activeCriterion === "size_consistency";
  const isDimmed = activeCriterion !== "all" && !isSpotlight;

  if (isDimmed) return null;

  return (
    <g
      className="transition-opacity duration-200"
      style={{ opacity: isSpotlight ? 1.0 : 0.65 }}
    >
      {data.annotations.map((ann, idx) => {
        const [x, y, w, h] = ann.bbox;
        const isAttention = ann.severity === "needs_attention";

        if (!isAttention && !isSpotlight) return null;

        const boxColor = isAttention ? "#f97316" : "#10b981";

        return (
          <g
            key={`size-box-${idx}`}
            className="cursor-pointer pointer-events-auto group"
            onMouseEnter={() =>
              onHoverAnnotation({
                criterion: "size_consistency",
                title: isAttention ? "Letter Size Irregular" : "Proportional Letter Size",
                note: ann.note,
                severity: ann.severity,
                x: x + w / 2,
                y: y - 8,
              })
            }
            onMouseLeave={() => onHoverAnnotation(null)}
          >
            {/* Word Bounding Box */}
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={boxColor}
              fillOpacity={isAttention ? 0.08 : 0.04}
              stroke={boxColor}
              strokeWidth={isAttention ? 2 : 1.25}
              strokeDasharray={isAttention ? "none" : "3 3"}
              rx={4}
              className="transition-all group-hover:stroke-width-3"
            />

            {/* Corner Guide Accent on Attention */}
            {isAttention && (
              <path
                d={`M ${x} ${y + 8} L ${x} ${y} L ${x + 8} ${y}`}
                fill="none"
                stroke={boxColor}
                strokeWidth={3}
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })}
    </g>
  );
});

"use client";

import { memo } from "react";
import type {
  SlantOverlay,
  CriterionFilter,
  ActiveAnnotationHover,
} from "../types";

interface SlantLayerProps {
  data: SlantOverlay;
  activeCriterion: CriterionFilter;
  onHoverAnnotation: (hover: ActiveAnnotationHover | null) => void;
}

export const SlantLayer = memo(function SlantLayer({
  data,
  activeCriterion,
  onHoverAnnotation,
}: SlantLayerProps) {
  const isSpotlight = activeCriterion === "slant";
  const isDimmed = activeCriterion !== "all" && !isSpotlight;

  if (isDimmed) return null;

  return (
    <g
      className="transition-opacity duration-200"
      style={{ opacity: isSpotlight ? 1.0 : 0.65 }}
    >
      {data.annotations.map((ann, idx) => {
        const [x, y, w] = ann.bbox;
        const [x1, y1, x2, y2] = ann.vector;
        const isAttention = ann.severity === "needs_attention";

        if (!isAttention && !isSpotlight) return null;

        const slantColor = isAttention ? "#f59e0b" : "#6366f1";

        return (
          <g
            key={`slant-vec-${idx}`}
            className="cursor-pointer pointer-events-auto group"
            onMouseEnter={() =>
              onHoverAnnotation({
                criterion: "slant",
                title: isAttention ? "Irregular Slant" : "Consistent Slant",
                note: ann.note,
                severity: ann.severity,
                x: x + w / 2,
                y: y - 6,
              })
            }
            onMouseLeave={() => onHoverAnnotation(null)}
          >
            {/* Slant Vector Line */}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={slantColor}
              strokeWidth={isAttention ? 2.5 : 1.5}
              strokeLinecap="round"
              className="transition-all group-hover:stroke-width-3.5"
            />

            {/* Vector Origin/Top Anchor Dot */}
            <circle
              cx={x2}
              cy={y2}
              r={isAttention ? 3.5 : 2.5}
              fill={slantColor}
            />

            {/* Angle pill in spotlight mode */}
            {isSpotlight && (
              <g transform={`translate(${x + w / 2}, ${y - 12})`}>
                <rect
                  x={-15}
                  y={-8}
                  width={30}
                  height={15}
                  rx={7.5}
                  fill={slantColor}
                />
                <text
                  x={0}
                  y={3}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  {Math.round(ann.angle_deg)}°
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
});

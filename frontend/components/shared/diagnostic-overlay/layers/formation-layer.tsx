"use client";

import { memo } from "react";
import type {
  FormationOverlay,
  CriterionFilter,
  ActiveAnnotationHover,
} from "../types";

interface FormationLayerProps {
  data: FormationOverlay;
  activeCriterion: CriterionFilter;
  onHoverAnnotation: (hover: ActiveAnnotationHover | null) => void;
}

export const FormationLayer = memo(function FormationLayer({
  data,
  activeCriterion,
  onHoverAnnotation,
}: FormationLayerProps) {
  const isSpotlight = activeCriterion === "letter_formation";
  const isDimmed = activeCriterion !== "all" && !isSpotlight;

  if (isDimmed) return null;

  return (
    <g
      className="transition-opacity duration-200"
      style={{ opacity: isSpotlight ? 1.0 : 0.75 }}
    >
      {data.annotations.map((ann, idx) => {
        const [x, y, w, h] = ann.bbox;
        const isAttention = ann.severity === "needs_attention";

        if (!isAttention && !isSpotlight) return null;

        const formationColor = isAttention ? "#e11d48" : "#2563eb";
        const underlineY = y + h + 3;

        return (
          <g
            key={`formation-word-${idx}`}
            className="cursor-pointer pointer-events-auto group"
            onMouseEnter={() =>
              onHoverAnnotation({
                criterion: "letter_formation",
                title: isAttention ? "Letter Formation Developing" : "Clear Letter Formation",
                note: ann.note,
                severity: ann.severity,
                x: x + w / 2,
                y: underlineY + 10,
              })
            }
            onMouseLeave={() => onHoverAnnotation(null)}
          >
            {/* Subtle Pill Underline */}
            <rect
              x={x}
              y={underlineY}
              width={w}
              height={isAttention ? 3.5 : 2}
              rx={1.5}
              fill={formationColor}
              fillOpacity={isAttention ? 0.9 : 0.6}
              className="transition-all group-hover:height-4"
            />

            {/* In spotlight or on attention, score badge */}
            {(isSpotlight || isAttention) && (
              <g transform={`translate(${x + w}, ${y + 4})`}>
                <rect
                  x={-14}
                  y={-8}
                  width={28}
                  height={15}
                  rx={7.5}
                  fill={formationColor}
                  className="transition-transform group-hover:scale-110"
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
                  {Math.round(ann.score)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
});

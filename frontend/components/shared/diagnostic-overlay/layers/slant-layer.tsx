"use client";

import { memo } from "react";
import type {
  SlantOverlay,
  CriterionFilter,
  HoverAnnotationCallback,
} from "../types";

import { OVERLAY_COLORS, OVERLAY_WEIGHTS } from "../constants";

interface SlantLayerProps {
  data: SlantOverlay;
  activeCriterion: CriterionFilter;
  hitScale?: number;
  activeAnnotationId?: string | null;
  onHoverAnnotation: HoverAnnotationCallback;
}

export const SlantLayer = memo(function SlantLayer({
  data,
  activeCriterion,
  hitScale = 1,
  activeAnnotationId,
  onHoverAnnotation,
}: SlantLayerProps) {
  const isSpotlight = activeCriterion === "slant";
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
        const [x, y, w] = ann.bbox;
        const [x1, y1, x2, y2] = ann.vector;
        const isAttention = ann.severity === "needs_attention";

        if (!isAttention && !isSpotlight) return null;

        const slantColor = isAttention
          ? OVERLAY_COLORS.needs_attention.stroke
          : OVERLAY_COLORS.proficient.stroke;
        const id = `slant-${ann.line_index}-${ann.word_index}`;
        const title = isAttention ? "Irregular Slant" : "Consistent Slant";
        const hoverPayload = {
          id,
          criterion: "slant" as const,
          title,
          note: ann.note,
          severity: ann.severity,
          x: x + w / 2,
          y: y - 6,
        };

        const toggleAnnotation = () => {
          onHoverAnnotation((prev) => (prev?.id === id ? null : hoverPayload));
        };

        const isFocusable = isSpotlight || isAttention;
        const isActive = activeAnnotationId === id;

        return (
          <g
            key={`slant-vec-${idx}`}
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
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth={Math.max(28, 28 * hitScale)}
              strokeLinecap="round"
              className="pointer-events-auto"
            />

            {/* Keyboard Focus Highlight Halo (WCAG 2.4.7) */}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={5}
              strokeLinecap="round"
              strokeOpacity={0.6}
              className="opacity-0 group-focus-visible:opacity-100 transition-opacity stroke-[#1b6b63] dark:stroke-[#2dd4bf] pointer-events-none"
            />

            {/* Slant Vector Line */}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={slantColor}
              strokeWidth={isAttention ? OVERLAY_WEIGHTS.strokeAttention : OVERLAY_WEIGHTS.strokeNormal}
              strokeLinecap="round"
              className="transition-all group-hover:stroke-width-2.5 group-focus-visible:stroke-width-2.5"
            />

            {/* Vector Origin/Top Anchor Dot */}
            <circle
              cx={x2}
              cy={y2}
              r={isAttention ? 3 : 2}
              fill={slantColor}
              className="transition-transform group-hover:scale-125 group-focus-visible:scale-125 motion-reduce:transform-none"
            />

            {/* Angle pill in spotlight mode */}
            {isSpotlight && (
              <g transform={`translate(${x + w / 2}, ${y - 12})`}>
                <rect
                  x={-14}
                  y={-7}
                  width={28}
                  height={14}
                  rx={7}
                  fill={slantColor}
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

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
        const badgeW = 36 * hitScale;
        const badgeH = 20 * hitScale;

        return (
          <g
            key={`slant-vec-${idx}`}
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
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth={Math.max(36, 36 * hitScale)}
              strokeLinecap="round"
              className="pointer-events-auto"
            />

            {/* Keyboard Focus / Selection Highlight Halo (WCAG 2.4.7) */}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={5}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeOpacity={0.6}
              className={`transition-opacity stroke-brand-700 dark:stroke-brand-400 pointer-events-none ${
                isActive ? "opacity-100" : "opacity-0 group-focus-visible:opacity-100"
              }`}
            />

            {/* Slant Vector Line */}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={slantColor}
              strokeWidth={isAttention ? OVERLAY_WEIGHTS.strokeAttention : OVERLAY_WEIGHTS.strokeNormal}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              className="transition-all"
            />

            {/* Vector Origin/Top Anchor Dot */}
            <circle
              cx={x2}
              cy={y2}
              r={(isAttention ? 5 : 4) * hitScale}
              fill={slantColor}
              stroke="#ffffff"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              className="transition-transform group-hover:scale-125 group-focus-visible:scale-125 motion-reduce:transform-none"
            />

            {/* Angle pill in spotlight mode */}
            {isSpotlight && (
              <g transform={`translate(${x + w / 2}, ${y - 12 * hitScale})`}>
                <rect
                  x={-badgeW / 2}
                  y={-badgeH / 2}
                  width={badgeW}
                  height={badgeH}
                  rx={badgeH / 2}
                  fill={slantColor}
                />
                <text
                  x={0}
                  y={4 * hitScale}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={11 * hitScale}
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

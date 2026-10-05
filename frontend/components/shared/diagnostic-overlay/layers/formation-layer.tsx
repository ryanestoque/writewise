"use client";

import { memo } from "react";
import type {
  FormationOverlay,
  FormationAnnotation,
  CriterionFilter,
  HoverAnnotationCallback,
} from "../types";

import { OVERLAY_COLORS, OVERLAY_WEIGHTS } from "../constants";

interface FormationLayerProps {
  data: FormationOverlay;
  activeCriterion: CriterionFilter;
  hitScale?: number;
  activeAnnotationId?: string | null;
  onHoverAnnotation: HoverAnnotationCallback;
}

const LETTER_ZONE_PALETTE = [
  { fill: "rgba(52, 211, 153, 0.18)", stroke: "#10b981", text: "#065f46" }, // Emerald
  { fill: "rgba(56, 189, 248, 0.18)", stroke: "#0284c7", text: "#075985" }, // Sky
  { fill: "rgba(168, 85, 247, 0.18)", stroke: "#9333ea", text: "#581c87" }, // Purple
  { fill: "rgba(251, 191, 36, 0.18)", stroke: "#d97706", text: "#78350f" }, // Amber
  { fill: "rgba(249, 115, 22, 0.18)", stroke: "#ea580c", text: "#7c2d12" }, // Orange
  { fill: "rgba(244, 63, 94, 0.18)", stroke: "#e11d48", text: "#881337" },  // Rose
];

interface FormationWordItemProps {
  ann: FormationAnnotation;
  idx: number;
  isSpotlight: boolean;
  hitScale: number;
  activeAnnotationId?: string | null;
  onHoverAnnotation: HoverAnnotationCallback;
}

const FormationWordItem = memo(function FormationWordItem({
  ann,
  idx,
  isSpotlight,
  hitScale,
  activeAnnotationId,
  onHoverAnnotation,
}: FormationWordItemProps) {
  const [x, y, w, h] = ann.bbox;
  const isAttention = ann.severity === "needs_attention";

  if (!isAttention && !isSpotlight) return null;

  const formationColor = isAttention
    ? OVERLAY_COLORS.needs_attention.stroke
    : OVERLAY_COLORS.proficient.stroke;
  const underlineY = y + h + 3;
  const id = `formation-${ann.line_index}-${ann.word_index}`;
  const title = isAttention
    ? ann.band
      ? `Letter Formation (${ann.band})`
      : "Letter Formation Developing"
    : "Clear Letter Formation";
  const noteText = ann.casing_note ? `${ann.note} (${ann.casing_note})` : ann.note;
  const hoverPayload = {
    id,
    criterion: "letter_formation" as const,
    title,
    note: noteText,
    severity: ann.severity,
    x: x + w / 2,
    y: underlineY + 10,
  };

  const toggleAnnotation = () => {
    onHoverAnnotation((prev) => (prev?.id === id ? null : hoverPayload));
  };

  const isFocusable = isSpotlight || isAttention;
  const isActive = activeAnnotationId === id;
  const hitH = Math.max(36, 36 * hitScale);
  const hitW = Math.max(hitH, w);
  const badgeW = 34 * hitScale;
  const badgeH = 20 * hitScale;
  const strokeW = Math.max(2, 2.5 * hitScale);

  return (
    <g
      key={`formation-word-${idx}`}
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
      {/* Centerline SVG Pen Strokes Trace */}
      {ann.stroke_paths?.map((pCmd, pIdx) => (
        <path
          key={`stroke-${id}-${pIdx}`}
          d={pCmd}
          fill="none"
          stroke="#06b6d4" // Neon Cyan
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none opacity-90 group-hover:opacity-100"
        />
      ))}

      {/* Letter-by-Letter Segmentation Zones & Character Badges */}
      {isSpotlight &&
        ann.letter_zones?.map((lz, lzIdx) => {
          const [lzX, lzY, lzW, lzH] = lz.bbox;
          const styleMeta = LETTER_ZONE_PALETTE[lzIdx % LETTER_ZONE_PALETTE.length];
          const letterBadgeSize = Math.max(16, 18 * hitScale);
          const badgeY = Math.max(letterBadgeSize / 2 + 2 * hitScale, lzY - 4 * hitScale);

          return (
            <g key={`lz-${id}-${lzIdx}`} className="pointer-events-none">
              {/* Letter Zone Translucent Box & Border */}
              <rect
                x={lzX}
                y={lzY}
                width={lzW}
                height={lzH}
                fill={styleMeta.fill}
                stroke={styleMeta.stroke}
                strokeWidth={1.2 * hitScale}
                strokeDasharray="3 2"
                rx={3 * hitScale}
              />

              {/* Character Label Badge */}
              <g transform={`translate(${lzX + lzW / 2}, ${badgeY})`}>
                <rect
                  x={-letterBadgeSize / 2}
                  y={-letterBadgeSize / 2}
                  width={letterBadgeSize}
                  height={letterBadgeSize}
                  rx={letterBadgeSize / 4}
                  fill={styleMeta.stroke}
                />
                <text
                  x={0}
                  y={0}
                  dominantBaseline="central"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={11 * hitScale}
                  fontWeight="700"
                  fontFamily="system-ui, sans-serif"
                >
                  {lz.char}
                </text>
              </g>
            </g>
          );
        })}

      {/* Touch Hit Target */}
      <rect
        x={x - (hitW > w ? (hitW - w) / 2 : 0)}
        y={underlineY - hitH / 2}
        width={hitW}
        height={hitH}
        fill="transparent"
        className="pointer-events-auto"
      />

      {/* Selection Highlight Indicator */}
      <rect
        x={x - 2 * hitScale}
        y={underlineY - 1 * hitScale}
        width={w + 4 * hitScale}
        height={4 * hitScale}
        rx={2 * hitScale}
        className={`transition-opacity fill-brand-700 dark:fill-brand-400 pointer-events-none ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-75 group-focus-visible:opacity-100"
          }`}
      />

      {/* Penmanship stroke underline */}
      <rect
        x={x}
        y={underlineY}
        width={w}
        height={Math.max(4 * hitScale, (isAttention ? OVERLAY_WEIGHTS.strokeAttention : OVERLAY_WEIGHTS.strokeNormal) * hitScale)}
        rx={2 * hitScale}
        fill={formationColor}
        fillOpacity={isAttention ? 0.95 : 0.75}
        className="transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />

      {/* Score & Rubric Band Badge in Spotlight Mode */}
      {isSpotlight && (
        <g transform={`translate(${x + w}, ${y + 4 * hitScale})`}>
          <rect
            x={-badgeW / 2}
            y={-badgeH / 2}
            width={badgeW}
            height={badgeH}
            rx={badgeH / 2}
            fill={formationColor}
            className="transition-transform group-hover:scale-110 motion-reduce:transform-none"
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
            {Math.round(ann.score)}
          </text>
        </g>
      )}
    </g>
  );
});

export const FormationLayer = memo(function FormationLayer({
  data,
  activeCriterion,
  hitScale = 1,
  activeAnnotationId,
  onHoverAnnotation,
}: FormationLayerProps) {
  const isSpotlight = activeCriterion === "letter_formation";
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
      {annotations.map((ann, idx) => (
        <FormationWordItem
          key={`formation-word-${idx}`}
          ann={ann}
          idx={idx}
          isSpotlight={isSpotlight}
          hitScale={hitScale}
          activeAnnotationId={activeAnnotationId}
          onHoverAnnotation={onHoverAnnotation}
        />
      ))}
    </g>
  );
});


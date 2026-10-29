"use client";

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import type {
  DiagnosticOverlayData,
  CriterionFilter,
  ActiveAnnotationHover,
  HoverAnnotationCallback,
} from "./types";
import { BaselineLayer } from "./layers/baseline-layer";
import { SpacingLayer } from "./layers/spacing-layer";
import { SizeLayer } from "./layers/size-layer";
import { SlantLayer } from "./layers/slant-layer";
import { FormationLayer } from "./layers/formation-layer";
import { AnnotationTooltip } from "./annotation-tooltip";
import { useInspectorContext } from "@/components/shared/worksheet-image-inspector";

/**
 * Safely extracts DiagnosticOverlayData from a measurement record or raw_output object.
 * Returns null if no valid overlay data is present.
 */
export function extractDiagnosticOverlay(
  recordOrRaw: unknown
): DiagnosticOverlayData | null {
  if (!recordOrRaw || typeof recordOrRaw !== "object") return null;
  const obj = recordOrRaw as Record<string, unknown>;

  // Check direct already-unwrapped overlay data
  if ("baseline" in obj && "summary" in obj) {
    return obj as unknown as DiagnosticOverlayData;
  }

  // Check direct overlay property on measurement
  if ("overlay" in obj && obj.overlay && typeof obj.overlay === "object") {
    const ov = obj.overlay as Record<string, unknown>;
    if ("baseline" in ov && "summary" in ov) {
      return obj.overlay as DiagnosticOverlayData;
    }
  }

  // Check nested in measurement row
  if ("measurement" in obj && obj.measurement && typeof obj.measurement === "object") {
    const meas = obj.measurement as Record<string, unknown>;
    if ("overlay" in meas && meas.overlay && typeof meas.overlay === "object") {
      return meas.overlay as DiagnosticOverlayData;
    }
  }

  return null;
}

interface DiagnosticOverlayProps {
  overlay: DiagnosticOverlayData | null | undefined;
  imageUrl?: string | null;
  /** Known dimensions of a static image, avoiding an eager dimension probe. */
  imageDimensions?: { width: number; height: number };
  visible?: boolean;
  activeCriterion?: CriterionFilter;
  zoomScale?: number;
  selectedAnnotation?: ActiveAnnotationHover | null;
  onSelectAnnotation?: (annotation: ActiveAnnotationHover | null) => void;
  showGuideLines?: boolean;
  /** Whether to show technical measurement footnotes in annotation tooltips (e.g. midline ruling scale for spacing). Defaults to true. */
  showMeasurementDetails?: boolean;
}

export const DiagnosticOverlay = memo(function DiagnosticOverlay({
  overlay,
  imageUrl,
  imageDimensions,
  visible = true,
  activeCriterion = "all",
  zoomScale,
  selectedAnnotation,
  onSelectAnnotation,
  showGuideLines = true,
  showMeasurementDetails = true,
}: DiagnosticOverlayProps) {
  const inspectorContext = useInspectorContext();
  const effectiveZoom = zoomScale ?? inspectorContext.zoomScale ?? 1;
  const panOffset = inspectorContext.panOffset ?? { x: 0, y: 0 };
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [loadedSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const naturalSize = imageDimensions ?? loadedSize;
  const [hoveredAnnotation, setHoveredAnnotation] =
    useState<ActiveAnnotationHover | null>(null);

  // Active annotation is either the transiently hovered element or the persistent selection
  const activeAnnotation = hoveredAnnotation ?? selectedAnnotation ?? null;

  const selectedAnnotationRef = useRef<ActiveAnnotationHover | null | undefined>(
    selectedAnnotation
  );
  selectedAnnotationRef.current = selectedAnnotation;

  const hoveredAnnotationRef = useRef<ActiveAnnotationHover | null>(null);
  hoveredAnnotationRef.current = hoveredAnnotation;

  // Track previously centered annotation to avoid fighting user pan/drag actions
  const prevSelectedIdRef = useRef<string | null | undefined>(undefined);
  const centerPointRef = useRef(inspectorContext.centerPoint);
  useEffect(() => {
    centerPointRef.current = inspectorContext.centerPoint;
  }, [inspectorContext.centerPoint]);

  // Sync external selected annotation and trigger auto-pan if zoomed
  useEffect(() => {
    if (selectedAnnotation !== undefined) {
      setHoveredAnnotation(null);
      const isNewSelection =
        selectedAnnotation &&
        selectedAnnotation.id !== prevSelectedIdRef.current;
      prevSelectedIdRef.current = selectedAnnotation?.id;

      if (
        isNewSelection &&
        naturalSize &&
        effectiveZoom > 1 &&
        centerPointRef.current
      ) {
        centerPointRef.current({
          x: selectedAnnotation.x,
          y: selectedAnnotation.y,
          imageWidth: naturalSize.width,
          imageHeight: naturalSize.height,
        });
      }
    }
  }, [selectedAnnotation, naturalSize, effectiveZoom]);

  // Measure container dimensions with ResizeObserver for exact letterbox compensation and visible viewport boundaries
  const measureLayout = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const viewportEl =
      inspectorContext.viewportRef?.current ??
      el.closest<HTMLElement>('[role="region"]');

    // Prefer clientWidth / clientHeight (unscaled CSS layout pixels) so zoom transforms never skew base coordinates
    const cW = Math.round(
      el.clientWidth || el.getBoundingClientRect().width / Math.max(effectiveZoom, 0.1)
    );
    const cH = Math.round(
      el.clientHeight || el.getBoundingClientRect().height / Math.max(effectiveZoom, 0.1)
    );
    const vW = viewportEl
      ? Math.round(viewportEl.clientWidth || viewportEl.getBoundingClientRect().width)
      : cW;
    const vH = viewportEl
      ? Math.round(viewportEl.clientHeight || viewportEl.getBoundingClientRect().height)
      : cH;

    if (cW > 0 && cH > 0) {
      setContainerSize((prev) =>
        prev && prev.width === cW && prev.height === cH
          ? prev
          : { width: cW, height: cH }
      );
    }
    if (vW > 0 && vH > 0) {
      setViewportSize((prev) =>
        prev && prev.width === vW && prev.height === vH
          ? prev
          : { width: vW, height: vH }
      );
    }
  }, [inspectorContext.viewportRef, effectiveZoom]);

  useEffect(() => {
    if (!visible || !overlay || !naturalSize) return;
    const el = containerRef.current;
    if (!el) return;

    const viewportEl =
      inspectorContext.viewportRef?.current ??
      el.closest<HTMLElement>('[role="region"]');

    // Immediate synchronous measurement on mount/layout settling
    measureLayout();

    let rafId: number | null = null;
    const scheduleMeasure = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        measureLayout();
      });
    };

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(el);
    if (viewportEl && viewportEl !== el) {
      observer.observe(viewportEl);
    }

    window.addEventListener("resize", scheduleMeasure, { passive: true });
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", scheduleMeasure, { passive: true });

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      visualViewport?.removeEventListener("resize", scheduleMeasure);
    };
  }, [visible, overlay, naturalSize, measureLayout, inspectorContext.viewportRef]);

  // Load natural dimensions of the image so SVG viewBox aligns 1:1 with pixel coordinates
  useEffect(() => {
    if (imageDimensions) return;
    if (!imageUrl) {
      setNaturalSize(null);
      return;
    }

    let active = true;
    const img = new Image();

    img.onload = () => {
      if (active) {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };
    img.onerror = () => {
      if (active) {
        setNaturalSize(null);
      }
    };
    img.src = imageUrl;

    // Check if the image is already complete in browser cache to avoid layout skeleton flash
    if (img.complete && img.naturalWidth > 0) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    } else {
      setNaturalSize(null);
    }

    return () => {
      active = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl, imageDimensions]);

  const handleHoverAnnotation: HoverAnnotationCallback = useCallback(
    (hover) => {
      measureLayout();
      if (typeof hover === "function") {
        // Toggle action triggered from user click or keyboard activation (Enter / Space)
        const currentSelected =
          selectedAnnotationRef.current !== undefined
            ? selectedAnnotationRef.current
            : hoveredAnnotationRef.current;
        const next = hover(currentSelected);
        setHoveredAnnotation(null);
        if (onSelectAnnotation) {
          onSelectAnnotation(next);
        } else {
          setHoveredAnnotation(next);
        }
      } else {
        // Transient preview triggered from mouse enter / leave / focus / blur
        setHoveredAnnotation(hover);
      }
    },
    [measureLayout, onSelectAnnotation]
  );

  // Global escape key listener to dismiss active annotation tooltip cleanly
  useEffect(() => {
    if (!activeAnnotation) return;
    const el = containerRef.current;
    if (el) {
      el.setAttribute("data-diagnostic-active", "true");
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setHoveredAnnotation(null);
        onSelectAnnotation?.(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      if (el) {
        el.removeAttribute("data-diagnostic-active");
      }
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [activeAnnotation, onSelectAnnotation]);

  // Calculate coordinate scaling factor to preserve minimum touch targets & geometric badge proportions
  const hitScale = useMemo(() => {
    if (!naturalSize) return 1;
    if (!containerSize || containerSize.width <= 0 || containerSize.height <= 0) {
      // Sensible initial estimate before ResizeObserver fires (typical viewport ~480px)
      return Math.ceil(Math.max(1, naturalSize.width / 480) * 4) / 4;
    }
    const imgRatio = naturalSize.width / naturalSize.height;
    const containerRatio = containerSize.width / containerSize.height;
    let renderedW = containerSize.width;
    if (containerRatio > imgRatio) {
      // Container is wider than image (pillarboxed) -> height fills container
      renderedW = containerSize.height * imgRatio;
    }
    const rawScale = Math.max(1, naturalSize.width / Math.max(renderedW, 1));
    // Round up so quantization never shrinks hit targets below their CSS-pixel minimum.
    return Math.ceil(rawScale * 4) / 4;
  }, [naturalSize, containerSize]);

  if (!visible || !overlay) return null;

  // Asynchronous image decoding skeleton state: provide visual reassurance while natural dimensions resolve
  if (!naturalSize) {
    return (
      <div
        className="absolute inset-0 size-full pointer-events-none z-10 select-none flex items-center justify-center"
        role="status"
        aria-label="Loading handwriting diagnostic guidelines"
      >
        <div className="absolute inset-x-8 top-1/4 bottom-1/4 flex flex-col justify-around opacity-30 animate-pulse motion-reduce:animate-none pointer-events-none">
          <div className="w-full border-b border-dashed border-slate-400 dark:border-slate-500" />
          <div className="w-full border-b border-dotted border-brand-600 dark:border-brand-400" />
          <div className="w-full border-b border-solid border-brand-600 dark:border-brand-400" />
        </div>
        <span className="sr-only">Loading handwriting diagnostic guidelines...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 size-full pointer-events-none z-10 select-none"
    >
      {/* Root SVG Canvas matching natural image size */}
      <svg
        viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="size-full pointer-events-none select-none"
        role="region"
        aria-label="Handwriting diagnostic annotations layer"
      >
        {/* Background tap-to-dismiss canvas catcher */}
        <rect
          x={0}
          y={0}
          width={naturalSize.width}
          height={naturalSize.height}
          fill="transparent"
          className="cursor-default pointer-events-auto"
          onClick={() => {
            setHoveredAnnotation(null);
            onSelectAnnotation?.(null);
          }}
        />

        {/* Baseline & Reference Guides Layer */}
        {overlay.baseline && (
          <BaselineLayer
            data={overlay.baseline}
            activeCriterion={activeCriterion}
            viewWidth={naturalSize.width}
            hitScale={hitScale}
            activeAnnotationId={activeAnnotation?.id}
            onHoverAnnotation={handleHoverAnnotation}
            showGuideLines={showGuideLines}
          />
        )}

        {/* Spacing Brackets Layer */}
        {overlay.spacing && (
          <SpacingLayer
            data={overlay.spacing}
            activeCriterion={activeCriterion}
            hitScale={hitScale}
            activeAnnotationId={activeAnnotation?.id}
            onHoverAnnotation={handleHoverAnnotation}
          />
        )}

        {/* Size Consistency Bounding Boxes Layer */}
        {overlay.size && (
          <SizeLayer
            data={overlay.size}
            activeCriterion={activeCriterion}
            hitScale={hitScale}
            activeAnnotationId={activeAnnotation?.id}
            onHoverAnnotation={handleHoverAnnotation}
          />
        )}

        {/* Slant Direction Vectors Layer */}
        {overlay.slant && (
          <SlantLayer
            data={overlay.slant}
            activeCriterion={activeCriterion}
            hitScale={hitScale}
            activeAnnotationId={activeAnnotation?.id}
            onHoverAnnotation={handleHoverAnnotation}
          />
        )}

        {/* Letter Formation CNN Highlights Layer */}
        {overlay.letter_formation && (
          <FormationLayer
            data={overlay.letter_formation}
            activeCriterion={activeCriterion}
            hitScale={hitScale}
            activeAnnotationId={activeAnnotation?.id}
            onHoverAnnotation={handleHoverAnnotation}
          />
        )}
      </svg>

      {/* Floating HTML Diagnostic Tooltip Popover */}
      <AnnotationTooltip
        hover={activeAnnotation}
        isPinned={Boolean(selectedAnnotation && activeAnnotation?.id === selectedAnnotation.id)}
        imageWidth={naturalSize.width}
        imageHeight={naturalSize.height}
        containerWidth={containerSize?.width}
        containerHeight={containerSize?.height}
        viewportWidth={viewportSize?.width}
        viewportHeight={viewportSize?.height}
        zoomScale={effectiveZoom}
        panOffset={panOffset}
        showMeasurementDetails={showMeasurementDetails}
        onDismiss={() => {
          setHoveredAnnotation(null);
          onSelectAnnotation?.(null);
        }}
      />
    </div>
  );
});

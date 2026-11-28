"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  createContext,
  useContext,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Contrast,
  Search,
  FileText,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface InspectorContextValue {
  zoomScale: number;
  panOffset: { x: number; y: number };
  isHighContrast: boolean;
  naturalDimensions?: { width: number; height: number } | null;
  centerPoint?: (point: { x: number; y: number; imageWidth: number; imageHeight: number }) => void;
  viewportRef?: React.RefObject<HTMLDivElement | null>;
}

export const InspectorContext = createContext<InspectorContextValue>({
  zoomScale: 1,
  panOffset: { x: 0, y: 0 },
  isHighContrast: false,
});

export function useInspectorContext(): InspectorContextValue {
  return useContext(InspectorContext);
}

export interface WorksheetImageInspectorProps {
  /** Signed URL or public URL of the worksheet photo */
  imageUrl?: string | null;
  /** Known dimensions of a static image, avoiding an eager dimension probe. */
  imageDimensions?: { width: number; height: number };
  /** Accessible image description */
  altText?: string;
  /** Whether the image is currently loading from storage */
  isLoading?: boolean;
  /** Whether the image is high-priority above the fold (e.g. Hero preview). Sets loading="eager" and fetchPriority="high". Defaults to false. */
  priority?: boolean;
  /** Header label for the inspector */
  headerLabel?: string;
  /** Header icon element */
  headerIcon?: ReactNode;
  /** Whether an error occurred loading the image */
  isError?: boolean;
  /** Callback when user clicks retry after an image load failure */
  onRetry?: () => void;
  /** Optional custom child overlay (e.g. focus badge, CV guidelines, bounding boxes) */
  children?: ReactNode;
  /** Optional diagnostic toolbar or slot rendered in a unified command deck */
  diagnosticToolbar?: ReactNode;
  /** Whether to show keyboard shortcut legend below canvas (defaults to true) */
  showShortcutsLegend?: boolean;
  /** Embedded previews only handle shortcuts while focus is inside this viewer. */
  keyboardScope?: "global" | "focused";
  /** Public demos can progressively disclose secondary image controls. */
  imageToolsDisclosure?: boolean;
  /** Keep diagnosticToolbar visible while collapsing secondary image tools (Contrast, Magnify, Zoom) behind a toggle. */
  collapsibleImageTools?: boolean;
  /** Whether to show secondary image tools (zoom, contrast, loupe). Defaults to true. */
  showImageTools?: boolean;
  /** Additional container classes */
  className?: string;
  /** Custom aspect ratio / height classes (optional, defaults to dynamic auto-fit) */
  aspectRatioClass?: string;
  /** Whether to dynamically match image's natural aspect ratio (defaults to true) */
  autoAspectRatio?: boolean;
  /** Render flat without outer container shadow (e.g. inside a modal dialog) */
  flatFrame?: boolean;
}

export function WorksheetImageInspector({
  imageUrl,
  imageDimensions,
  altText = "Handwriting worksheet photo",
  isLoading = false,
  isError = false,
  onRetry,
  priority = false,
  headerLabel = "Handwritten Worksheet",
  headerIcon,
  diagnosticToolbar,
  showShortcutsLegend = true,
  keyboardScope = "global",
  imageToolsDisclosure = false,
  collapsibleImageTools = false,
  showImageTools = true,
  children,
  className,
  aspectRatioClass,
  autoAspectRatio = true,
  flatFrame = false,
}: WorksheetImageInspectorProps) {
  const [imageToolsExpanded, setImageToolsExpanded] = useState(false);
  const [loadedDimensions, setNaturalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const naturalDimensions = imageDimensions ?? loadedDimensions;
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [isLoupeActive, setIsLoupeActive] = useState<boolean>(false);
  const [isHighContrast, setIsHighContrast] = useState<boolean>(false);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [loupeState, setLoupeState] = useState<{
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    width: number;
    height: number;
    visible: boolean;
  }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    width: 0,
    height: 0,
    visible: false,
  });
  const [accessibilityNotice, setAccessibilityNotice] = useState<string>("");
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  const [prevImageUrl, setPrevImageUrl] = useState<string | null | undefined>(imageUrl);
  if (prevImageUrl !== imageUrl) {
    setPrevImageUrl(imageUrl);
    setNaturalDimensions(null);
  }

  // Track natural image dimensions from the rendered <img> without a duplicate Image() probe
  const mainImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = mainImgRef.current;
    if (!imageUrl || imageDimensions || !img) return;
    if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalDimensions((prev) =>
        prev?.width === img.naturalWidth && prev?.height === img.naturalHeight
          ? prev
          : { width: img.naturalWidth, height: img.naturalHeight }
      );
    }
  }, [imageUrl, imageDimensions]);

  const imgRatio = naturalDimensions
    ? naturalDimensions.width / naturalDimensions.height
    : 3 / 4;

  const dynamicAspectStyle = autoAspectRatio
    ? {
        aspectRatio: `${naturalDimensions ? naturalDimensions.width : 3} / ${
          naturalDimensions ? naturalDimensions.height : 4
        }`,
        maxWidth:
          imgRatio < 1
            ? `min(100%, calc(min(640px, calc(100dvh - 12rem)) * ${imgRatio}))`
            : "100%",
      }
    : undefined;

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const containerRectRef = useRef<DOMRect | null>(null);
  const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const rafIdRef = useRef<number | null>(null);
  const pendingLoupeRef = useRef<typeof loupeState | null>(null);
  const pendingPanRef = useRef<{ x: number; y: number } | null>(null);
  const pendingZoomRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const hasImageError = Boolean(
    isError || (imageUrl && failedImageUrl === imageUrl)
  );

  const handleZoomIn = useCallback(() => {
    setZoomScale((prev) => {
      const next = Math.min(2.5, +(prev + 0.5).toFixed(1));
      setAccessibilityNotice(`Worksheet magnified to ${Math.round(next * 100)} percent`);
      return next;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale((prev) => {
      const next = Math.max(1, +(prev - 0.5).toFixed(1));
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      setAccessibilityNotice(`Worksheet zoom decreased to ${Math.round(next * 100)} percent`);
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsLoupeActive(false);
    setAccessibilityNotice("Worksheet zoom and position reset to fit view");
  }, []);

  const handleToggleLoupe = useCallback(() => {
    setIsLoupeActive((prev) => {
      const next = !prev;
      setAccessibilityNotice(
        next ? "Stroke magnifier enabled" : "Stroke magnifier disabled"
      );
      return next;
    });
  }, []);

  const handleToggleContrast = useCallback(() => {
    setIsHighContrast((prev) => {
      const next = !prev;
      setAccessibilityNotice(
        next ? "High contrast ink enhancement enabled" : "Standard color mode enabled"
      );
      return next;
    });
  }, []);

  // Keyboard pan helper (Arrow keys when zoomed)
  const handleKeyPan = useCallback((dx: number, dy: number) => {
    setPanOffset((prev) => ({
      x: Math.max(-400, Math.min(400, prev.x + dx)),
      y: Math.max(-400, Math.min(400, prev.y + dy)),
    }));
  }, []);

  // Auto-center a specific point on the image when magnified (e.g. focused annotation)
  const centerPoint = useCallback(
    (point: { x: number; y: number; imageWidth: number; imageHeight: number }) => {
      const container = imageContainerRef.current;
      if (!container || zoomScale <= 1 || point.imageWidth <= 0 || point.imageHeight <= 0) return;

      const rect = container.getBoundingClientRect();
      const containerW = rect.width;
      const containerH = rect.height;

      const containerRatio = containerW / containerH;
      const imgRatio = point.imageWidth / point.imageHeight;

      let renderedW = containerW;
      let renderedH = containerH;
      let offsetX = 0;
      let offsetY = 0;

      if (containerRatio > imgRatio) {
        renderedW = containerH * imgRatio;
        offsetX = (containerW - renderedW) / 2;
      } else {
        renderedH = containerW / imgRatio;
        offsetY = (containerH - renderedH) / 2;
      }

      const pixelX = offsetX + (point.x / point.imageWidth) * renderedW;
      const pixelY = offsetY + (point.y / point.imageHeight) * renderedH;

      const dxFromCenter = pixelX - containerW / 2;
      const dyFromCenter = pixelY - containerH / 2;

      const targetX = Math.max(-400, Math.min(400, -dxFromCenter * zoomScale));
      const targetY = Math.max(-400, Math.min(400, -dyFromCenter * zoomScale));

      setPanOffset({ x: Math.round(targetX), y: Math.round(targetY) });
    },
    [zoomScale]
  );

  const inspectorContextValue = useMemo<InspectorContextValue>(
    () => ({
      zoomScale,
      panOffset,
      isHighContrast,
      naturalDimensions,
      centerPoint,
      viewportRef: imageContainerRef,
    }),
    [zoomScale, panOffset, isHighContrast, naturalDimensions, centerPoint]
  );

  // Keyboard shortcuts (global while inspector mounted or inside focused container)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showImageTools) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const container = imageContainerRef.current;
      if (!container) return;

      const viewer = container.closest('[data-inspector-container="true"]');
      const isFocusedInViewer = Boolean(viewer?.contains(document.activeElement));

      if (keyboardScope === "focused" && !isFocusedInViewer) {
        return;
      }

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && (
          e.target.isContentEditable ||
          e.target.closest("[role='radiogroup']") ||
          e.target.closest("[role='tablist']") ||
          e.target.closest("[role='tab']") ||
          e.target.closest("[role='slider']") ||
          e.target.closest("[role='combobox']") ||
          e.target.closest("[role='menu']") ||
          e.target.closest("[role='listbox']")
        ))
      ) {
        return;
      }

      // Ensure the inspector's dialog is active when inside a modal dialog
      const dialog = container.closest("[role='dialog']");
      if (dialog && !dialog.contains(document.activeElement)) {
        return;
      }

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === "0") {
        // Yield "0" to active rubric editing (Spacing N/A) unless focus is inside the inspector
        if (document.querySelector('[data-rubric-editing="true"]') && !isFocusedInViewer) {
          return;
        }
        e.preventDefault();
        handleResetZoom();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        handleToggleLoupe();
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        handleToggleContrast();
      } else if (zoomScale > 1 && isFocusedInViewer) {
        const step = e.shiftKey ? 100 : 40;
        if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopImmediatePropagation();
          handleKeyPan(0, step);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopImmediatePropagation();
          handleKeyPan(0, -step);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          e.stopImmediatePropagation();
          handleKeyPan(step, 0);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          e.stopImmediatePropagation();
          handleKeyPan(-step, 0);
        }
      }
    };

    // Use capture phase so Base UI dialog does not swallow arrow keys when zoomed in
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    showImageTools,
    keyboardScope,
    zoomScale,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleToggleLoupe,
    handleToggleContrast,
    handleKeyPan,
  ]);

  // Pointer Events for Cross-Device Touch, Stylus, and Mouse Panning + Multi-Touch Pinch
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && e.target.closest("button")) {
      return;
    }

    containerRectRef.current = e.currentTarget.getBoundingClientRect();

    activePointersRef.current.set(e.pointerId, {
      clientX: e.clientX,
      clientY: e.clientY,
    });

    const count = activePointersRef.current.size;

    if (count === 2) {
      // Two-finger gesture -> initialize pinch-to-zoom
      setIsDragging(false);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Safe fallback if pointer capture unsupported
      }
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = zoomScale;
    } else if (count === 1) {
      // For single pointer: only capture pointer and drag when actively zoomed or loupe is active.
      // When at 1x fit zoom, allow native vertical swipe gestures to scroll the page.
      if (zoomScale > 1 || isLoupeActive) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Safe fallback if pointer capture unsupported
        }
        if (zoomScale > 1) {
          setIsDragging(true);
          setDragStart({
            x: e.clientX - panOffset.x,
            y: e.clientY - panOffset.y,
          });
        }
      }
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, {
        clientX: e.clientX,
        clientY: e.clientY,
      });
    }

    const rect = containerRectRef.current ?? e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isLoupeActive) {
      const isTouch = e.pointerType === "touch";
      const lensY = isTouch ? y - 95 : y;
      pendingLoupeRef.current = {
        x: Math.max(65, Math.min(rect.width - 65, x)),
        y: Math.max(65, Math.min(rect.height - 65, lensY)),
        targetX: x,
        targetY: y,
        width: rect.width,
        height: rect.height,
        visible: true,
      };
    }

    const count = activePointersRef.current.size;

    if (count === 2 && pinchStartDistRef.current !== null && pinchStartDistRef.current > 0) {
      const pts = Array.from(activePointersRef.current.values());
      const currentDist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      const factor = currentDist / pinchStartDistRef.current;
      const nextScale = Math.max(1, Math.min(2.5, +(pinchStartScaleRef.current * factor).toFixed(2)));
      pendingZoomRef.current = nextScale;
      if (nextScale === 1) {
        pendingPanRef.current = { x: 0, y: 0 };
      }
    } else if (count === 1 && isDragging && zoomScale > 1) {
      pendingPanRef.current = {
        x: Math.max(-500, Math.min(500, e.clientX - dragStart.x)),
        y: Math.max(-500, Math.min(500, e.clientY - dragStart.y)),
      };
    }

    // Schedule updates on next animation frame for silky 60fps interaction
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (pendingLoupeRef.current) {
          setLoupeState(pendingLoupeRef.current);
          pendingLoupeRef.current = null;
        }
        if (pendingZoomRef.current !== null) {
          const next = pendingZoomRef.current;
          setZoomScale(next);
          setAccessibilityNotice(`Pinch zoom ${Math.round(next * 100)} percent`);
          pendingZoomRef.current = null;
        }
        if (pendingPanRef.current) {
          setPanOffset(pendingPanRef.current);
          pendingPanRef.current = null;
        }
      });
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Safe fallback
    }

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      if (pendingLoupeRef.current) {
        setLoupeState(pendingLoupeRef.current);
        pendingLoupeRef.current = null;
      }
      if (pendingZoomRef.current !== null) {
        setZoomScale(pendingZoomRef.current);
        pendingZoomRef.current = null;
      }
      if (pendingPanRef.current) {
        setPanOffset(pendingPanRef.current);
        pendingPanRef.current = null;
      }
    }

    const remaining = activePointersRef.current.size;
    if (remaining < 2) {
      pinchStartDistRef.current = null;
    }

    if (remaining === 0) {
      setIsDragging(false);
      containerRectRef.current = null;
    } else if (remaining === 1 && zoomScale > 1) {
      // Transition back to single pointer dragging with remaining finger
      const pointer = Array.from(activePointersRef.current.values())[0];
      setDragStart({
        x: pointer.clientX - panOffset.x,
        y: pointer.clientY - panOffset.y,
      });
      setIsDragging(true);
    }
  };

  const handlePointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    pinchStartDistRef.current = null;
    containerRectRef.current = null;
    setIsDragging(false);
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };

  const useImageToolsCollapsible = imageToolsDisclosure && showImageTools;

  const imageToolsControls = (
    <>
      {/* Left tools: Contrast & Loupe */}
      <div className="flex items-center gap-1">
        <Toggle
          variant="outline"
          size="sm"
          pressed={isHighContrast}
          onPressedChange={handleToggleContrast}
          className="h-11 sm:h-7 min-h-11 sm:min-h-0 px-2.5 sm:px-2 text-xs rounded-lg gap-1.5 aria-pressed:bg-secondary aria-pressed:text-secondary-foreground aria-pressed:border-primary/30 aria-pressed:font-semibold"
          aria-label="Toggle high contrast ink enhancement (Key: C)"
          title="Enhance faint pencil ink (C)"
        >
          <Contrast data-icon="inline-start" aria-hidden="true" />
          <span className="hidden sm:inline">Ink Contrast</span>
        </Toggle>

        <Toggle
          variant="outline"
          size="sm"
          pressed={isLoupeActive}
          onPressedChange={handleToggleLoupe}
          className="h-11 sm:h-7 min-h-11 sm:min-h-0 px-2.5 sm:px-2 text-xs rounded-lg gap-1.5 aria-pressed:bg-secondary aria-pressed:text-secondary-foreground aria-pressed:border-primary/30 aria-pressed:font-semibold"
          aria-label="Toggle stroke magnify (Key: L)"
          title="Hover to magnify handwriting strokes (L)"
        >
          <Search data-icon="inline-start" aria-hidden="true" />
          <span className="hidden sm:inline">Magnify</span>
        </Toggle>
      </div>

      {/* Right tools: Zoom controls */}
      <ButtonGroup aria-label="Worksheet zoom controls">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={zoomScale <= 1}
          onClick={handleZoomOut}
          className="size-11 sm:size-7"
          aria-label="Zoom out (Key: -)"
          title="Zoom out (-)"
        >
          <ZoomOut aria-hidden="true" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetZoom}
          className="h-11 sm:h-7 px-2.5 sm:px-2 text-xs font-sans tabular-nums font-semibold"
          title="Click to reset zoom (Key: 0)"
          aria-label={`Current zoom ${Math.round(zoomScale * 100)} percent. Click to reset (Shortcut: 0).`}
        >
          {Math.round(zoomScale * 100)}%
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={zoomScale >= 2.5}
          onClick={handleZoomIn}
          className="size-11 sm:size-7"
          aria-label="Zoom in (Key: +)"
          title="Zoom in (+)"
        >
          <ZoomIn aria-hidden="true" />
        </Button>
      </ButtonGroup>
    </>
  );

  const diagnosticDeckBody = diagnosticToolbar ? (
    <>
      <div className="p-1 sm:p-1.5">
        {diagnosticToolbar}
      </div>
      {showImageTools && collapsibleImageTools && (
        <Collapsible open={imageToolsExpanded} onOpenChange={setImageToolsExpanded}>
          <div className="w-full flex items-center justify-between gap-2 px-2 py-1 text-xs">
            <CollapsibleTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 sm:h-7 min-h-11 sm:min-h-0 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70"
                />
              }
            >
              <SlidersHorizontal data-icon="inline-start" aria-hidden="true" />
              <span>{imageToolsExpanded ? "Hide image tools" : "Image tools"}</span>
              {!imageToolsExpanded && (isHighContrast || isLoupeActive || zoomScale > 1) && (
                <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] font-semibold tabular-nums">
                  {[
                    isHighContrast ? "Contrast" : null,
                    isLoupeActive ? "Magnify" : null,
                    zoomScale > 1 ? `${Math.round(zoomScale * 100)}%` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Badge>
              )}
              <ChevronDown
                data-icon="inline-end"
                className={cn("opacity-70 transition-transform duration-150", imageToolsExpanded && "rotate-180")}
                aria-hidden="true"
              />
            </CollapsibleTrigger>
            {!imageToolsExpanded && showShortcutsLegend && (
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                <Kbd className="h-auto min-w-0 font-mono text-[10px] px-1 py-0.5 rounded bg-background border border-border">C</Kbd> ink ·{" "}
                <Kbd className="h-auto min-w-0 font-mono text-[10px] px-1 py-0.5 rounded bg-background border border-border">L</Kbd> magnify ·{" "}
                <Kbd className="h-auto min-w-0 font-mono text-[10px] px-1 py-0.5 rounded bg-background border border-border">+/-</Kbd> zoom
              </span>
            )}
          </div>
          <CollapsibleContent>
            <div
              className={cn(
                "w-full flex items-center justify-between gap-1 p-1 sm:p-1.5 text-xs",
                imageToolsDisclosure && "flex-wrap gap-y-2"
              )}
            >
              {imageToolsControls}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      {showImageTools && !collapsibleImageTools && (
        <div
          className={cn(
            "w-full flex items-center justify-between gap-1 p-1 sm:p-1.5 text-xs",
            imageToolsDisclosure && "flex-wrap gap-y-2"
          )}
        >
          {imageToolsControls}
        </div>
      )}
    </>
  ) : null;

  return (
    <div
      data-inspector-container="true"
      data-zoomed={zoomScale > 1 ? "true" : undefined}
      className={cn("w-full flex flex-col gap-2", className)}
    >
      {/* Screen reader live announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {accessibilityNotice}
      </div>

      {/* Header Label (if present and no diagnostic toolbar to prevent visual clutter) */}
      {headerLabel && !diagnosticToolbar && (
        <div className="flex items-center justify-between px-0.5 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            {headerIcon}
            <span>{headerLabel}</span>
          </span>
        </div>
      )}

      {/* Action Controls: Unified Command Deck or Standalone Inspector Controls */}
      {diagnosticToolbar ? (
        useImageToolsCollapsible ? (
          <Collapsible
            className={cn(
              "w-full rounded-xl border border-border/70 bg-muted/35 overflow-hidden shrink-0 divide-y divide-border/60",
              !flatFrame && "shadow-2xs"
            )}
          >
            <CollapsibleTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex w-full min-h-11 items-center justify-between rounded-none px-3 py-3 text-left text-sm font-semibold [&[data-panel-open]>svg]:rotate-180"
                />
              }
            >
              <span>Image tools</span>
              <ChevronDown
                data-icon="inline-end"
                className="text-muted-foreground transition-transform duration-200"
                aria-hidden="true"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="divide-y divide-border/60">
              {diagnosticDeckBody}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <Card
            size="sm"
            className={cn(
              "w-full rounded-xl border-border/70 bg-muted/35 py-0 overflow-hidden shrink-0",
              !flatFrame ? "shadow-2xs" : "shadow-none",
              showImageTools && "divide-y divide-border/60"
            )}
          >
            {diagnosticDeckBody}
          </Card>
        )
      ) : showImageTools ? (
        /* Standalone Inspector Action Controls */
        <Card size="sm" className="w-full rounded-xl border-border/80 bg-muted/50 py-0 shadow-2xs shrink-0">
          <CardContent className="w-full flex items-center justify-between gap-1 p-1 text-xs">
            {imageToolsControls}
          </CardContent>
        </Card>
      ) : null}

      {/* Interactive Image Container */}
      <div
        ref={imageContainerRef}
        role="region"
        aria-label="Worksheet preview inspector canvas"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          containerRectRef.current = rect;
          if (isLoupeActive) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setLoupeState({
              x: Math.max(65, Math.min(rect.width - 65, x)),
              y: Math.max(65, Math.min(rect.height - 65, y)),
              targetX: x,
              targetY: y,
              width: rect.width,
              height: rect.height,
              visible: true,
            });
          }
        }}
        onMouseLeave={() => {
          containerRectRef.current = null;
          setIsDragging(false);
          setLoupeState((prev) => ({ ...prev, visible: false }));
        }}
        onDoubleClick={(e) => {
          if (e.target instanceof Element && e.target.closest("[role='button'], button")) {
            return;
          }
          if (zoomScale > 1) {
            handleResetZoom();
          } else {
            setZoomScale(1.75);
            setAccessibilityNotice("Worksheet magnified to 175 percent");
          }
        }}
        style={dynamicAspectStyle}
        className={cn(
          "relative w-full mx-auto rounded-xl sm:rounded-2xl border border-border/80 bg-muted/30 overflow-hidden flex items-center justify-center select-none",
          !flatFrame && "shadow-warm",
          isLoupeActive || zoomScale > 1 ? "touch-none" : "touch-pan-y",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          aspectRatioClass ?? "max-h-[min(640px,calc(100dvh-12rem))] min-h-[280px] sm:min-h-[320px]",
          isLoupeActive
            ? "cursor-crosshair"
            : zoomScale > 1
              ? isDragging
                ? "cursor-grabbing"
                : "cursor-grab"
              : "cursor-default"
        )}
      >
        {isLoading ? (
          <Skeleton className="size-full min-h-[280px] sm:min-h-[320px] rounded-none" />
        ) : imageUrl && !hasImageError && !isError ? (
          <div
            className="absolute inset-0 size-full min-w-0 min-h-0 flex items-center justify-center p-2 motion-reduce:!transition-none"
            style={{
              transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
              transformOrigin: "center center",
              willChange: isDragging ? "transform" : "auto",
              transition: isDragging ? "none" : "transform 150ms ease-out",
            }}
          >
            {/* Relative wrapper: positioning context for child overlays (e.g. guide-line SVG) */}
            <div className="relative size-full min-w-0 min-h-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={mainImgRef}
                src={imageUrl}
                width={imageDimensions?.width}
                height={imageDimensions?.height}
                alt={altText}
                loading={priority ? "eager" : "lazy"}
                fetchPriority={priority ? "high" : "auto"}
                decoding="async"
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    setNaturalDimensions({
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                    });
                  }
                }}
                onError={() => {
                  if (imageUrl) setFailedImageUrl(imageUrl);
                }}
                style={{
                  filter: isHighContrast
                    ? "contrast(1.4) brightness(0.92) saturate(0.6)"
                    : "none",
                }}
                className="size-full object-contain pointer-events-none select-none drop-shadow-2xs"
              />
              {/* Custom Overlays / Slots (e.g. CV guide-line grid, bounding boxes) */}
              <InspectorContext.Provider value={inspectorContextValue}>
                {children}
              </InspectorContext.Provider>
            </div>
          </div>
        ) : (
          <Empty className="p-6 border-none pointer-events-auto">
            <EmptyMedia variant="icon">
              <FileText aria-hidden="true" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-sm">Worksheet photo unavailable</EmptyTitle>
              <EmptyDescription className="text-xs">
                We couldn&apos;t load this photo right now. Please try again.
              </EmptyDescription>
            </EmptyHeader>
            {onRetry && (
              <EmptyContent>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFailedImageUrl(null);
                    onRetry();
                  }}
                  className="min-h-11 sm:min-h-9"
                >
                  <RotateCcw data-icon="inline-start" aria-hidden="true" />
                  <span>Retry loading photo</span>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}

        {/* Stroke Magnifying Loupe Lens (Aria-Hidden to prevent duplicate reader announcements) */}
        {isLoupeActive && loupeState.visible && imageUrl && (
          <div
            aria-hidden="true"
            className="absolute left-0 top-0 size-[130px] rounded-full border-2 border-primary shadow-xl overflow-hidden pointer-events-none z-30 ring-2 ring-background/80 bg-background will-change-transform"
            style={{
              transform: `translate3d(${loupeState.x - 65}px, ${loupeState.y - 65}px, 0)`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: loupeState.width * 2.5,
                height: loupeState.height * 2.5,
                transform: `translate3d(${-loupeState.targetX * 2.5 + 65}px, ${-loupeState.targetY * 2.5 + 65}px, 0)`,
                filter: isHighContrast
                  ? "contrast(1.4) brightness(0.92) saturate(0.6)"
                  : "none",
              }}
              className="max-w-none object-contain will-change-transform"
            />
            {/* Center target reticle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-2 rounded-full border border-primary/80 bg-primary/20 shadow-2xs pointer-events-none" />
          </div>
        )}

        {/* Reset view overlay pill when panned or zoomed */}
        {(zoomScale > 1 || panOffset.x !== 0 || panOffset.y !== 0) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleResetZoom();
            }}
            className="absolute bottom-2.5 right-2.5 z-10 bg-background/95 text-foreground shadow-xs text-xs font-medium min-h-11 sm:min-h-9"
            title="Reset zoom & pan (Key: 0)"
          >
            <RotateCcw data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
            <span>Reset view</span>
          </Button>
        )}
      </div>

      {/* Keyboard Shortcuts Legend (optional, enabled by default) */}
      {showShortcutsLegend && (
        <>
          <div className="hidden sm:flex items-center justify-between text-xs text-muted-foreground px-1 flex-wrap gap-1 shrink-0">
            <span>
              Shortcuts: <Kbd className="h-auto min-w-0 px-1 py-0.5 rounded border border-border font-mono text-[10px]">+</Kbd> / <Kbd className="h-auto min-w-0 px-1 py-0.5 rounded border border-border font-mono text-[10px]">-</Kbd> zoom &middot; <Kbd className="h-auto min-w-0 px-1 py-0.5 rounded border border-border font-mono text-[10px]">L</Kbd> magnify &middot; <Kbd className="h-auto min-w-0 px-1 py-0.5 rounded border border-border font-mono text-[10px]">C</Kbd> contrast &middot; <Kbd className="h-auto min-w-0 px-1 py-0.5 rounded border border-border font-mono text-[10px]">0</Kbd> reset
            </span>
            {zoomScale > 1 && (
              <span className="font-medium text-primary text-xs">
                Drag or use arrow keys to pan
              </span>
            )}
          </div>

          <div className="sm:hidden flex items-center justify-center text-xs text-muted-foreground px-1 text-center shrink-0">
            <span>Pinch or use toolbar to zoom</span>
            {zoomScale > 1 && (
              <span className="font-medium text-primary ml-1.5">
                &middot; Drag to pan
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Contrast,
  Search,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface InspectorContextValue {
  zoomScale: number;
  panOffset: { x: number; y: number };
  isHighContrast: boolean;
  centerPoint?: (point: { x: number; y: number; imageWidth: number; imageHeight: number }) => void;
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
  /** Accessible image description */
  altText?: string;
  /** Whether the image is currently loading from storage */
  isLoading?: boolean;
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
  /** Additional container classes */
  className?: string;
  /** Custom aspect ratio / height classes */
  aspectRatioClass?: string;
}

export function WorksheetImageInspector({
  imageUrl,
  altText = "Handwriting worksheet photo",
  isLoading = false,
  isError = false,
  onRetry,
  headerLabel = "Handwritten Worksheet",
  headerIcon,
  diagnosticToolbar,
  showShortcutsLegend = true,
  children,
  className,
  aspectRatioClass = "aspect-4/3 sm:aspect-3/2 max-h-[420px]",
}: WorksheetImageInspectorProps) {
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
      centerPoint,
    }),
    [zoomScale, panOffset, isHighContrast, centerPoint]
  );

  // Keyboard shortcuts (global while inspector mounted or inside focused container)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const container = imageContainerRef.current;
      if (!container) return;

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && (
          e.target.closest("[role='radiogroup']") ||
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
        e.preventDefault();
        handleResetZoom();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        handleToggleLoupe();
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        handleToggleContrast();
      } else if (zoomScale > 1) {
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

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Safe fallback if pointer capture unsupported
    }

    const count = activePointersRef.current.size;

    if (count === 2) {
      // Two-finger gesture -> initialize pinch-to-zoom
      setIsDragging(false);
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = zoomScale;
    } else if (count === 1 && zoomScale > 1) {
      // Single cursor/finger pan
      setIsDragging(true);
      setDragStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y,
      });
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
        <div className="w-full flex flex-col rounded-xl border border-border/70 bg-muted/35 overflow-hidden shadow-2xs divide-y divide-border/60 shrink-0">
          <div className="p-1 sm:p-1.5">
            {diagnosticToolbar}
          </div>
          <div className="w-full flex items-center justify-between gap-1 p-1 sm:p-1.5 text-xs">
            {/* Left tools: Contrast & Loupe */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleContrast}
                className={cn(
                  "h-10 sm:h-7 min-h-[40px] sm:min-h-0 px-2.5 sm:px-2 text-xs rounded-lg gap-1.5 cursor-pointer transition-colors touch-manipulation",
                  isHighContrast
                    ? "bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-200 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={isHighContrast}
                aria-label="Toggle high contrast ink enhancement (Key: C)"
                title="Enhance faint pencil ink (C)"
              >
                <Contrast className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Ink Contrast</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleLoupe}
                className={cn(
                  "h-10 sm:h-7 min-h-[40px] sm:min-h-0 px-2.5 sm:px-2 text-xs rounded-lg gap-1.5 cursor-pointer transition-colors touch-manipulation",
                  isLoupeActive
                    ? "bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-200 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={isLoupeActive}
                aria-label="Toggle stroke magnify (Key: L)"
                title="Hover to magnify handwriting strokes (L)"
              >
                <Search className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Magnify</span>
              </Button>
            </div>

            {/* Right tools: Zoom controls & frame toggle */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={zoomScale <= 1}
                onClick={handleZoomOut}
                className="size-10 sm:size-7 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer touch-manipulation flex items-center justify-center"
                aria-label="Zoom out (Key: -)"
                title="Zoom out (-)"
              >
                <ZoomOut className="size-3.5" aria-hidden="true" />
              </Button>

              <button
                type="button"
                onClick={handleResetZoom}
                className="px-2.5 sm:px-2 py-1 sm:py-0.5 h-10 sm:h-7 min-h-[40px] sm:min-h-0 flex items-center justify-center text-xs font-mono font-semibold text-foreground hover:text-brand-700 dark:hover:text-brand-300 transition-colors cursor-pointer rounded-lg touch-manipulation"
                title="Click to reset zoom (Key: 0)"
                aria-label={`Current zoom ${Math.round(zoomScale * 100)} percent. Click to reset.`}
              >
                {Math.round(zoomScale * 100)}%
              </button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={zoomScale >= 2.5}
                onClick={handleZoomIn}
                className="size-10 sm:size-7 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer touch-manipulation flex items-center justify-center"
                aria-label="Zoom in (Key: +)"
                title="Zoom in (+)"
              >
                <ZoomIn className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Standalone Inspector Action Controls */
        <div className="w-full flex items-center justify-between gap-1 bg-muted/50 p-1 rounded-xl border border-border/80 text-xs shadow-2xs shrink-0">
          {/* Left tools: Contrast & Loupe */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToggleContrast}
              className={cn(
                "h-11 sm:h-8 min-h-[44px] sm:min-h-[32px] px-3 sm:px-2 text-xs rounded-lg gap-1.5 cursor-pointer transition-colors touch-manipulation",
                isHighContrast
                  ? "bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-200 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={isHighContrast}
              aria-label="Toggle high contrast ink enhancement (Key: C)"
              title="Enhance faint pencil ink (C)"
            >
              <Contrast className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Ink Contrast</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToggleLoupe}
              className={cn(
                "h-11 sm:h-8 min-h-[44px] sm:min-h-[32px] px-3 sm:px-2 text-xs rounded-lg gap-1.5 cursor-pointer transition-colors touch-manipulation",
                isLoupeActive
                  ? "bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-200 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={isLoupeActive}
              aria-label="Toggle stroke magnify (Key: L)"
              title="Hover to magnify handwriting strokes (L)"
            >
              <Search className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Magnify</span>
            </Button>
          </div>

          {/* Right tools: Zoom controls & frame toggle */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={zoomScale <= 1}
              onClick={handleZoomOut}
              className="size-11 sm:size-8 min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer touch-manipulation"
              aria-label="Zoom out (Key: -)"
              title="Zoom out (-)"
            >
              <ZoomOut className="size-3.5" aria-hidden="true" />
            </Button>

            <button
              type="button"
              onClick={handleResetZoom}
              className="px-2.5 sm:px-2 py-2 sm:py-0.5 min-h-[44px] sm:min-h-[32px] flex items-center justify-center text-xs sm:text-[11px] font-mono font-semibold text-foreground hover:text-brand-700 dark:hover:text-brand-300 transition-colors cursor-pointer rounded touch-manipulation"
              title="Click to reset zoom (Key: 0)"
              aria-label={`Current zoom ${Math.round(zoomScale * 100)} percent. Click to reset.`}
            >
              {Math.round(zoomScale * 100)}%
            </button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={zoomScale >= 2.5}
              onClick={handleZoomIn}
              className="size-11 sm:size-8 min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer touch-manipulation"
              aria-label="Zoom in (Key: +)"
              title="Zoom in (+)"
            >
              <ZoomIn className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

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
        className={cn(
          "relative w-full mx-auto rounded-xl sm:rounded-2xl border border-border/80 bg-muted/30 dark:bg-muted/20 overflow-hidden transition-all flex items-center justify-center shadow-warm select-none touch-none",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          aspectRatioClass,
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
          <Skeleton className="size-full min-h-[260px] rounded-none" />
        ) : imageUrl && !hasImageError && !isError ? (
          <div
            className="size-full flex items-center justify-center p-2 motion-reduce:!transition-none"
            style={{
              transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
              transformOrigin: "center center",
              willChange: isDragging ? "transform" : "auto",
              transition: isDragging ? "none" : "transform 150ms ease-out",
            }}
          >
            {/* Relative wrapper: positioning context for child overlays (e.g. guide-line SVG) */}
            <div className="relative size-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={altText}
                loading="lazy"
                decoding="async"
                onError={() => {
                  if (imageUrl) setFailedImageUrl(imageUrl);
                }}
                style={{
                  filter: isHighContrast
                    ? "contrast(1.4) brightness(0.92) saturate(0.6)"
                    : "none",
                }}
                className="size-full object-contain pointer-events-none drop-shadow-2xs"
              />
              {/* Custom Overlays / Slots (e.g. CV guide-line grid, bounding boxes) */}
              <InspectorContext.Provider value={inspectorContextValue}>
                {children}
              </InspectorContext.Provider>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground space-y-3 pointer-events-auto">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground/80 border border-border/80">
              <FileText className="size-6 stroke-[1.5]" aria-hidden="true" />
            </div>
            <div className="space-y-1 max-w-xs">
              <p className="text-xs sm:text-sm font-semibold text-foreground">
                Worksheet photo unavailable
              </p>
              <p className="text-xs text-muted-foreground leading-normal">
                The image could not be loaded or the secure session link expired.
              </p>
            </div>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFailedImageUrl(null);
                  onRetry();
                }}
                className="min-h-[36px] h-8 px-3 text-xs gap-1.5 cursor-pointer rounded-lg border-border hover:bg-muted/80 text-foreground shadow-2xs"
              >
                <RotateCcw className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span>Retry loading photo</span>
              </Button>
            )}
          </div>
        )}



        {/* Stroke Magnifying Loupe Lens (Aria-Hidden to prevent duplicate reader announcements) */}
        {isLoupeActive && loupeState.visible && imageUrl && (
          <div
            aria-hidden="true"
            className="absolute size-[130px] rounded-full border-2 border-brand-600 dark:border-brand-400 shadow-xl overflow-hidden pointer-events-none z-30 ring-2 ring-background/80 bg-background"
            style={{
              left: loupeState.x - 65,
              top: loupeState.y - 65,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                width: loupeState.width * 2.5,
                height: loupeState.height * 2.5,
                left: -loupeState.targetX * 2.5 + 65,
                top: -loupeState.targetY * 2.5 + 65,
                filter: isHighContrast
                  ? "contrast(1.4) brightness(0.92) saturate(0.6)"
                  : "none",
              }}
              className="max-w-none object-contain"
            />
            {/* Center target reticle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-2 rounded-full border border-brand-600/80 dark:border-brand-300/80 bg-brand-500/20 shadow-2xs pointer-events-none" />
          </div>
        )}

        {/* Reset view overlay pill when panned or zoomed */}
        {(zoomScale > 1 || panOffset.x !== 0 || panOffset.y !== 0) && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleResetZoom();
            }}
            className="absolute bottom-2.5 right-2.5 z-10 bg-background/95 dark:bg-card/95 text-foreground px-3 py-2 rounded-lg border border-border shadow-xs text-xs font-medium flex items-center gap-1.5 hover:bg-muted transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] touch-manipulation"
            title="Reset zoom & pan (Key: 0)"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Reset view</span>
          </button>
        )}
      </div>

      {/* Keyboard Shortcuts Legend (optional, enabled by default) */}
      {showShortcutsLegend && (
        <>
          <div className="hidden sm:flex items-center justify-between text-xs text-muted-foreground px-1 flex-wrap gap-1 shrink-0">
            <span>
              Shortcuts: <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">+</kbd> / <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">-</kbd> zoom &middot; <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">L</kbd> magnify &middot; <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">C</kbd> contrast &middot; <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">0</kbd> reset
            </span>
            {zoomScale > 1 && (
              <span className="font-medium text-brand-700 dark:text-brand-300 text-xs">
                Drag or use arrow keys to pan
              </span>
            )}
          </div>

          <div className="sm:hidden flex items-center justify-center text-xs text-muted-foreground px-1 text-center shrink-0">
            <span>Pinch or use toolbar to zoom</span>
            {zoomScale > 1 && (
              <span className="font-medium text-brand-700 dark:text-brand-300 ml-1.5">
                &middot; Drag to pan
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

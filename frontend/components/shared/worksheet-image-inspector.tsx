"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Maximize2,
  Minimize2,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Contrast,
  Search,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  /** Whether the container frame height is expanded */
  isFrameExpanded?: boolean;
  /** Callback when frame height expansion is toggled */
  onToggleFrameExpanded?: () => void;
  /** Whether to show the frame height expansion toggle button */
  allowFrameToggle?: boolean;
  /** Whether an error occurred loading the image */
  isError?: boolean;
  /** Callback when user clicks retry after an image load failure */
  onRetry?: () => void;
  /** Optional custom child overlay (e.g. focus badge, CV guidelines, bounding boxes) */
  children?: ReactNode;
  /** Additional container classes */
  className?: string;
  /** Custom aspect ratio / height classes for normal and expanded modes */
  aspectRatioClass?: string;
  expandedAspectRatioClass?: string;
}

export function WorksheetImageInspector({
  imageUrl,
  altText = "Handwriting worksheet photo",
  isLoading = false,
  isError = false,
  onRetry,
  headerLabel = "Handwritten Worksheet",
  headerIcon,
  isFrameExpanded = false,
  onToggleFrameExpanded,
  allowFrameToggle = true,
  children,
  className,
  aspectRatioClass = "aspect-4/3 sm:aspect-3/2 max-h-[420px]",
  expandedAspectRatioClass = "min-h-[460px] max-h-[580px]",
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
    width: number;
    height: number;
    visible: boolean;
  }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
  });
  const [accessibilityNotice, setAccessibilityNotice] = useState<string>("");
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);

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
        next ? "Stroke magnifying loupe enabled" : "Stroke magnifying loupe disabled"
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

  // Keyboard shortcuts (global while inspector mounted or inside focused container)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.closest("[role='radiogroup']"))
      ) {
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    zoomScale,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleToggleLoupe,
    handleToggleContrast,
    handleKeyPan,
  ]);

  // Pointer Events for Cross-Device Touch, Stylus, and Mouse Panning
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && e.target.closest("button")) {
      return;
    }

    if (zoomScale > 1) {
      setIsDragging(true);
      activePointerIdRef.current = e.pointerId;
      setDragStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y,
      });
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Safe fallback if pointer capture unsupported
      }
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isLoupeActive) {
      setLoupeState({
        x,
        y,
        width: rect.width,
        height: rect.height,
        visible: true,
      });
    }

    if (isDragging && zoomScale > 1) {
      setPanOffset({
        x: Math.max(-500, Math.min(500, e.clientX - dragStart.x)),
        y: Math.max(-500, Math.min(500, e.clientY - dragStart.y)),
      });
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture(activePointerIdRef.current);
      } catch {
        // Safe fallback
      }
      activePointerIdRef.current = null;
    }
    setIsDragging(false);
  };

  const handlePointerCancel = () => {
    activePointerIdRef.current = null;
    setIsDragging(false);
  };

  return (
    <div data-inspector-container="true" className={cn("space-y-2", className)}>
      {/* Screen reader live announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {accessibilityNotice}
      </div>

      {/* Header bar: Title & Inspector Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          {headerIcon ?? <Eye className="size-3.5 text-brand-600 dark:text-brand-400" />}
          <span>{headerLabel}</span>
        </span>

        {/* Inspector Action Controls */}
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/80 text-xs">
          {/* High-Contrast Ink Filter Toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleContrast}
            className={cn(
              "h-8 sm:h-7 px-2.5 sm:px-2 text-xs rounded-lg gap-1.5 cursor-pointer transition-colors",
              isHighContrast
                ? "bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-200 font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={isHighContrast}
            aria-label="Toggle high contrast ink enhancement (Key: C)"
            title="Enhance faint pencil ink (C)"
          >
            <Contrast className="size-3.5" />
            <span className="hidden sm:inline">Ink Contrast</span>
          </Button>

          {/* Stroke Magnifying Loupe Toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleLoupe}
            className={cn(
              "h-8 sm:h-7 px-2.5 sm:px-2 text-xs rounded-lg gap-1.5 cursor-pointer transition-colors",
              isLoupeActive
                ? "bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-200 font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={isLoupeActive}
            aria-label="Toggle stroke magnifying loupe (Key: L)"
            title="Hover magnifying loupe (L)"
          >
            <Search className="size-3.5" />
            <span className="hidden sm:inline">Loupe</span>
          </Button>

          <div className="h-4 sm:h-3.5 w-px bg-border/80 mx-0.5" />

          {/* Zoom Out Button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={zoomScale <= 1}
            onClick={handleZoomOut}
            className="size-8 sm:size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
            aria-label="Zoom out (Key: -)"
            title="Zoom out (-)"
          >
            <ZoomOut className="size-3.5" />
          </Button>

          {/* Zoom Percentage Label / Reset Trigger */}
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 sm:px-1.5 py-1 sm:py-0.5 text-xs sm:text-[11px] font-mono font-semibold text-foreground hover:text-brand-700 dark:hover:text-brand-300 transition-colors cursor-pointer rounded"
            title="Click to reset zoom (Key: 0)"
            aria-label={`Current zoom ${Math.round(zoomScale * 100)} percent. Click to reset.`}
          >
            {Math.round(zoomScale * 100)}%
          </button>

          {/* Zoom In Button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={zoomScale >= 2.5}
            onClick={handleZoomIn}
            className="size-8 sm:size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
            aria-label="Zoom in (Key: +)"
            title="Zoom in (+)"
          >
            <ZoomIn className="size-3.5" />
          </Button>

          {/* Frame Height Toggle (if supported) */}
          {allowFrameToggle && onToggleFrameExpanded && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggleFrameExpanded}
              className="size-8 sm:size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer ml-0.5"
              aria-label={isFrameExpanded ? "Fit frame height" : "Expand frame height"}
              title={isFrameExpanded ? "Fit frame" : "Expand frame"}
            >
              {isFrameExpanded ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

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
          if (isLoupeActive) {
            const rect = e.currentTarget.getBoundingClientRect();
            setLoupeState((prev) => ({
              ...prev,
              width: rect.width,
              height: rect.height,
              visible: true,
            }));
          }
        }}
        onMouseLeave={() => {
          setIsDragging(false);
          setLoupeState((prev) => ({ ...prev, visible: false }));
        }}
        className={cn(
          "relative rounded-xl sm:rounded-2xl border border-border/80 bg-muted/30 dark:bg-muted/20 overflow-hidden transition-all flex items-center justify-center shadow-warm select-none touch-none",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isFrameExpanded ? expandedAspectRatioClass : aspectRatioClass,
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
            className="size-full flex items-center justify-center p-2"
            style={{
              transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
              transformOrigin: "center center",
              willChange: isDragging ? "transform" : "auto",
              transition: isDragging ? "none" : "transform 150ms ease-out",
            }}
          >
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

        {/* Custom Overlays / Slots (e.g. Selected Criterion Badge or CV Lines) */}
        {children}

        {/* Stroke Magnifying Loupe Lens (Aria-Hidden to prevent duplicate reader announcements) */}
        {isLoupeActive && loupeState.visible && imageUrl && (
          <div
            aria-hidden="true"
            className="absolute size-[130px] rounded-full border-2 border-brand-600 dark:border-brand-400 shadow-xl overflow-hidden pointer-events-none z-30 ring-2 ring-background/80 bg-background"
            style={{
              left: Math.max(0, Math.min(loupeState.width - 130, loupeState.x - 65)),
              top: Math.max(0, Math.min(loupeState.height - 130, loupeState.y - 65)),
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
                left: -loupeState.x * 2.5 + 65,
                top: -loupeState.y * 2.5 + 65,
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
            className="absolute bottom-2.5 right-2.5 z-10 bg-background/95 dark:bg-card/95 text-foreground px-2.5 py-1 rounded-lg border border-border shadow-xs text-[11px] font-medium flex items-center gap-1 hover:bg-muted transition-colors cursor-pointer min-h-[32px] touch-manipulation"
            title="Reset zoom & pan (Key: 0)"
          >
            <RotateCcw className="size-3 text-muted-foreground" aria-hidden="true" />
            <span>Reset view</span>
          </button>
        )}
      </div>

      {/* Keyboard & Touch Shortcuts Legend */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 flex-wrap gap-1">
        <span>
          Shortcuts: <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">+</kbd>/<kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">-</kbd> zoom &middot; <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">L</kbd> loupe &middot; <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">C</kbd> contrast &middot; <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">0</kbd> reset
        </span>
        {zoomScale > 1 && (
          <span className="font-medium text-brand-700 dark:text-brand-300 text-[11px]">
            Drag or use arrow keys to pan
          </span>
        )}
      </div>
    </div>
  );
}

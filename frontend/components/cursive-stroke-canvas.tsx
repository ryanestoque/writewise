"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { PlayIcon, PauseIcon, RotateCcwIcon, GaugeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLetterStrokes, StrokePath } from "./cursive-strokes-data";

export type AnimationCaseMode = "lower" | "upper" | "both";
export type AnimationSpeed = 0.5 | 1 | 1.5;

interface CursiveStrokeCanvasProps {
  letterId: string;
  onActiveStepChange?: (mode: "upper" | "lower", stepIndex: number) => void;
  className?: string;
}

interface ActiveSequenceItem {
  stroke: StrokePath;
  mode: "upper" | "lower";
  modeIndex: number;
  offsetX: number;
  /** Short strokes (dots, tiny ticks) animate faster. */
  isShort: boolean;
}

const BASE_STROKE_MS = 1200;
const SHORT_STROKE_FACTOR = 0.45;
const MAX_FRAME_DELTA_MS = 100;
const SPEEDS: AnimationSpeed[] = [0.5, 1, 1.5];

const offsetTransform = (offsetX: number) => (offsetX ? `translate(${offsetX}, 0)` : undefined);

// Safe isomorphic layout effect for SSR hydration resilience
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Static ruling guides — matching WriteWise 3-line penmanship curriculum guidelines
const RULING_GUIDES = (
  <>
    {/* Headline y=25 (Slate guidance) */}
    <line
      x1="10"
      y1="25"
      x2="390"
      y2="25"
      stroke="currentColor"
      className="text-muted-foreground/60"
      strokeWidth="1"
      strokeOpacity="0.7"
    />

    {/* Dotted Midline y=50 (Primary Teal) */}
    <line
      x1="10"
      y1="50"
      x2="390"
      y2="50"
      stroke="currentColor"
      className="text-primary/75 dark:text-primary-foreground/75"
      strokeWidth="1.2"
      strokeDasharray="4 3"
      strokeOpacity="0.85"
    />

    {/* Solid Baseline y=75 (Warm Rust/Ochre Anchor) */}
    <line
      x1="10"
      y1="75"
      x2="390"
      y2="75"
      stroke="currentColor"
      className="text-band-1 dark:text-band-1-text"
      strokeWidth="1.8"
      strokeOpacity="0.9"
    />

    {/* Descender Line y=90 */}
    <line
      x1="10"
      y1="90"
      x2="390"
      y2="90"
      stroke="currentColor"
      className="text-muted-foreground/40"
      strokeWidth="0.8"
      strokeDasharray="2 2"
      strokeOpacity="0.5"
    />

    {/* ~68° Slant Guideline (dx = 28, dy = 70 => arctan(70/28) ≈ 68.2°) */}
    <line
      x1="176"
      y1="85"
      x2="204"
      y2="15"
      stroke="currentColor"
      className="text-primary/30"
      strokeWidth="1"
      strokeDasharray="3 3"
    />
  </>
);

export function CursiveStrokeCanvas({
  letterId,
  onActiveStepChange,
  className,
}: CursiveStrokeCanvasProps) {
  const [caseMode, setCaseMode] = useState<AnimationCaseMode>("lower");
  const [speed, setSpeed] = useState<AnimationSpeed>(1);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
    return true;
  });
  const [activeSeqIndex, setActiveSeqIndex] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return true;
    }
    return false;
  });

  // Per-frame values live in refs and are painted imperatively — no React
  // re-render per animation frame.
  const progressRef = useRef(prefersReducedMotion ? 1 : 0); // 0..1 for current stroke
  const speedRef = useRef<AnimationSpeed>(1);
  const pathLengthRef = useRef(0);
  const activePathRef = useRef<SVGPathElement | null>(null);
  const penRef = useRef<SVGGElement | null>(null);

  const strokesData = useMemo(() => getLetterStrokes(letterId), [letterId]);

  // In "both" mode, uppercase sits on the left (offsetX: -45) and lowercase on the right (offsetX: 35)
  const sequence = useMemo<ActiveSequenceItem[]>(() => {
    const seq: ActiveSequenceItem[] = [];
    const push = (strokes: StrokePath[], mode: "upper" | "lower", offsetX: number) => {
      for (const s of strokes) {
        seq.push({
          stroke: s,
          mode,
          modeIndex: s.stepIndex,
          offsetX,
          isShort: s.d.includes("A 1.5") || s.d.length < 25,
        });
      }
    };
    if (caseMode === "upper" || caseMode === "both") {
      push(strokesData.upper, "upper", caseMode === "both" ? -45 : 0);
    }
    if (caseMode === "lower" || caseMode === "both") {
      push(strokesData.lower, "lower", caseMode === "both" ? 35 : 0);
    }
    return seq;
  }, [strokesData, caseMode]);

  const activeItem = sequence[activeSeqIndex];

  // Motion preference listener: pause and complete strokes immediately if user prefers reduced motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
      if (e.matches) {
        setIsPlaying(false);
        setIsCompleted(true);
        progressRef.current = 1;
      }
    };
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  /** Apply progress to the DOM: stroke reveal + pen-tip position. */
  const paint = useCallback((p: number) => {
    const path = activePathRef.current;
    const len = pathLengthRef.current;
    if (!path || len <= 0) return;
    path.style.strokeDashoffset = String(Math.max(0, len * (1 - p)));
    const pen = penRef.current;
    if (pen) {
      const pt = path.getPointAtLength(p * len);
      pen.setAttribute("transform", `translate(${pt.x}, ${pt.y})`);
    }
  }, []);

  const resetAnimation = useCallback(() => {
    progressRef.current = 0;
    setActiveSeqIndex(0);
    setIsCompleted(false);
    setIsPlaying(!prefersReducedMotion);
  }, [prefersReducedMotion]);

  const handleCaseModeChange = (mode: AnimationCaseMode) => {
    setCaseMode(mode);
    resetAnimation();
  };

  const handleSpeedChange = (sp: AnimationSpeed) => {
    speedRef.current = sp; // read live by the tick loop; no loop restart
    setSpeed(sp);
  };

  // Optional notification to parent
  useEffect(() => {
    if (activeItem && onActiveStepChange) {
      onActiveStepChange(activeItem.mode, activeItem.modeIndex);
    }
  }, [activeItem, onActiveStepChange]);

  // Measure once per stroke (not per frame) using isomorphic layout effect to avoid SSR warnings
  useIsomorphicLayoutEffect(() => {
    const path = activePathRef.current;
    if (!path) return;
    let len = 0;
    try {
      len = path.getTotalLength();
    } catch {
      // SVG geometry unavailable (e.g. detached) — leave stroke fully drawn
    }
    pathLengthRef.current = len;
    if (len > 0) {
      path.style.strokeDasharray = String(len);
      paint(prefersReducedMotion ? 1 : progressRef.current);
    }
  }, [activeItem, paint, prefersReducedMotion]);

  // Animation loop. Pure: no side effects inside state updaters.
  useEffect(() => {
    if (!isPlaying || !activeItem || prefersReducedMotion) return;

    const isLast = activeSeqIndex >= sequence.length - 1;
    const factor = activeItem.isShort ? SHORT_STROKE_FACTOR : 1;
    let last: number | null = null;
    let raf = 0;

    const tick = (now: number) => {
      const delta = last === null ? 0 : Math.min(now - last, MAX_FRAME_DELTA_MS);
      last = now;
      const duration = (BASE_STROKE_MS * factor) / speedRef.current;
      const p = Math.min(1, progressRef.current + delta / duration);
      progressRef.current = p;
      paint(p);

      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else if (!isLast) {
        progressRef.current = 0;
        setActiveSeqIndex((idx) => idx + 1);
      } else {
        setIsPlaying(false);
        setIsCompleted(true);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, activeItem, activeSeqIndex, sequence.length, paint, prefersReducedMotion]);

  const togglePlay = () => {
    if (isCompleted) {
      resetAnimation();
    } else {
      setIsPlaying((p) => !p);
    }
  };

  return (
    <div className={cn("w-full space-y-2.5", className)}>
      {/* Controls & Case Selector Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        {/* Case Mode Selector */}
        <div
          role="radiogroup"
          aria-label="Cursive letter case mode"
          className="flex items-center p-0.5 rounded-lg border border-border/70 bg-muted/40"
        >
          <button
            type="button"
            role="radio"
            aria-checked={caseMode === "lower"}
            onClick={() => handleCaseModeChange("lower")}
            className={cn(
              "px-2.5 py-1.5 sm:py-1 min-h-10 sm:min-h-0 font-medium rounded-md transition-all cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              caseMode === "lower"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Lower ({strokesData.lower[0] ? letterId.toLowerCase() : ""})
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={caseMode === "upper"}
            onClick={() => handleCaseModeChange("upper")}
            className={cn(
              "px-2.5 py-1.5 sm:py-1 min-h-10 sm:min-h-0 font-medium rounded-md transition-all cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              caseMode === "upper"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Upper ({letterId?.toUpperCase()})
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={caseMode === "both"}
            onClick={() => handleCaseModeChange("both")}
            className={cn(
              "px-2.5 py-1.5 sm:py-1 min-h-10 sm:min-h-0 font-medium rounded-md transition-all cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              caseMode === "both"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Both (Aa)
          </button>
        </div>

        {/* Playback Controls & Speed (Min 40px touch targets for mobile thumbs) */}
        <div className="flex items-center gap-1.5">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-7 px-3 sm:px-2.5 rounded-lg sm:rounded-md border border-border/70 bg-background hover:bg-muted text-foreground transition-all cursor-pointer font-medium active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            title={isPlaying ? "Pause animation" : isCompleted ? "Replay animation" : "Play animation"}
            aria-label={isPlaying ? "Pause animation" : isCompleted ? "Replay animation" : "Play animation"}
          >
            {isPlaying ? (
              <>
                <PauseIcon className="size-4 sm:size-3.5 fill-current" />
                <span className="text-xs">Pause</span>
              </>
            ) : (
              <>
                <PlayIcon className="size-4 sm:size-3.5 fill-current" />
                <span className="text-xs">{isCompleted ? "Replay" : "Play"}</span>
              </>
            )}
          </button>

          {/* Replay */}
          <button
            type="button"
            onClick={resetAnimation}
            className="inline-flex items-center justify-center size-10 sm:size-7 rounded-lg sm:rounded-md border border-border/70 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            title="Replay from start"
            aria-label="Replay from start"
          >
            <RotateCcwIcon className="size-4 sm:size-3.5" />
          </button>

          {/* Speed Selector (Min 40px touch targets on mobile) */}
          <div className="flex items-center gap-1 pl-1.5 sm:pl-1 border-l border-border/60">
            <GaugeIcon className="size-3.5 text-muted-foreground hidden xs:block" aria-hidden="true" />
            {SPEEDS.map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => handleSpeedChange(sp)}
                className={cn(
                  "min-w-10 h-10 sm:min-w-0 sm:h-auto sm:px-1.5 sm:py-0.5 px-2 py-1 text-xs sm:text-[11px] rounded-lg sm:rounded transition-all cursor-pointer font-medium flex items-center justify-center active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  speed === sp
                    ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
                aria-label={`Set animation speed to ${sp}x`}
              >
                {sp}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Penmanship Ruling Canvas */}
      <div className="w-full h-36 sm:h-40 rounded-xl border border-border/80 bg-card dark:bg-card/90 relative overflow-hidden flex items-center justify-center shadow-xs select-none">
        <svg
          viewBox="0 0 400 100"
          className="w-full h-full"
          role="img"
          aria-label={`Animated cursive stroke guide for letter ${letterId}`}
        >
          <g>
            {RULING_GUIDES}

            {/* LAYER 1: Translucent Guide Tracks (Background) */}
            {sequence.map((item, idx) => (
              <path
                key={`guide-${idx}`}
                transform={offsetTransform(item.offsetX)}
                d={item.stroke.d}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground/20 dark:text-muted-foreground/15"
                strokeDasharray="3 3"
              />
            ))}

            {/* LAYER 2: Completed Past Strokes */}
            {sequence.slice(0, activeSeqIndex).map((item, idx) => (
              <path
                key={`done-${idx}`}
                transform={offsetTransform(item.offsetX)}
                d={item.stroke.d}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary dark:text-primary-foreground"
              />
            ))}

            {/* LAYER 3 + 4: Active stroke and pen tip share the offset group,
                so pen coordinates come straight from getPointAtLength. */}
            {activeItem ? (
              <g transform={offsetTransform(activeItem.offsetX)}>
                {/* dasharray/dashoffset are set imperatively by paint() */}
                <path
                  ref={activePathRef}
                  d={activeItem.stroke.d}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={isCompleted ? "text-primary dark:text-primary-foreground" : "text-primary"}
                />
                <g ref={penRef}>
                  {isCompleted ? (
                    <circle
                      r="2.5"
                      className="fill-primary dark:fill-primary-foreground stroke-background stroke-[1.2]"
                    />
                  ) : (
                    <>
                      {isPlaying && !prefersReducedMotion ? (
                        <circle
                          r="5"
                          className="fill-primary/25 animate-ping opacity-75 motion-reduce:hidden"
                        />
                      ) : null}
                      <circle r="3.5" className="fill-primary/40 stroke-primary stroke-[1.2]" />
                      <circle r="2" className="fill-primary-foreground" />
                    </>
                  )}
                </g>
              </g>
            ) : null}
          </g>
        </svg>
      </div>
    </div>
  );
}

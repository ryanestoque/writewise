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

// Static ruling guides — hoisted so they're never re-created on re-render.
const RULING_GUIDES = (
  <>
    {/* Headline y=25 */}
    <line x1="10" y1="25" x2="390" y2="25" stroke="currentColor" className="text-slate-400 dark:text-slate-500" strokeWidth="1" strokeOpacity="0.7" />

    {/* Dotted Midline y=50 */}
    <line x1="10" y1="50" x2="390" y2="50" stroke="currentColor" className="text-teal-600 dark:text-teal-400" strokeWidth="1.2" strokeDasharray="4 3" strokeOpacity="0.8" />

    {/* Solid Baseline y=75 */}
    <line x1="10" y1="75" x2="390" y2="75" stroke="currentColor" className="text-orange-600 dark:text-orange-400" strokeWidth="1.8" strokeOpacity="0.9" />

    {/* Descender Line y=90 */}
    <line x1="10" y1="90" x2="390" y2="90" stroke="currentColor" className="text-slate-300 dark:text-slate-600" strokeWidth="0.8" strokeDasharray="2 2" strokeOpacity="0.5" />

    {/* ~68° Slant Guideline (dx = 28, dy = 70 => arctan(70/28) ≈ 68.2°) */}
    <line x1="176" y1="85" x2="204" y2="15" stroke="currentColor" className="text-primary" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.35" />
  </>
);

export function CursiveStrokeCanvas({
  letterId,
  onActiveStepChange,
  className,
}: CursiveStrokeCanvasProps) {
  const [caseMode, setCaseMode] = useState<AnimationCaseMode>("lower");
  const [speed, setSpeed] = useState<AnimationSpeed>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [activeSeqIndex, setActiveSeqIndex] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Per-frame values live in refs and are painted imperatively — no React
  // re-render per animation frame.
  const progressRef = useRef(0); // 0..1 for current stroke
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
    setIsPlaying(true);
  }, []);

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

  // Measure once per stroke (not per frame) and paint the current progress
  // before the browser paints, so there's no flash of the full stroke.
  useLayoutEffect(() => {
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
      paint(progressRef.current);
    }
  }, [activeItem, paint]);

  // Animation loop. Pure: no side effects inside state updaters.
  useEffect(() => {
    if (!isPlaying || !activeItem) return;

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
  }, [isPlaying, activeItem, activeSeqIndex, sequence.length, paint]);

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
        <div className="flex items-center p-0.5 rounded-lg border border-border/70 bg-muted/40">
          <button
            type="button"
            onClick={() => handleCaseModeChange("lower")}
            className={cn(
              "px-2.5 py-1.5 sm:py-1 min-h-9 sm:min-h-0 font-medium rounded-md transition-all cursor-pointer flex items-center justify-center",
              caseMode === "lower"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Lower ({strokesData.lower[0] ? letterId.toLowerCase() : ""})
          </button>
          <button
            type="button"
            onClick={() => handleCaseModeChange("upper")}
            className={cn(
              "px-2.5 py-1.5 sm:py-1 min-h-9 sm:min-h-0 font-medium rounded-md transition-all cursor-pointer flex items-center justify-center",
              caseMode === "upper"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Upper ({letterId?.toUpperCase()})
          </button>
          <button
            type="button"
            onClick={() => handleCaseModeChange("both")}
            className={cn(
              "px-2.5 py-1.5 sm:py-1 min-h-9 sm:min-h-0 font-medium rounded-md transition-all cursor-pointer flex items-center justify-center",
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

          {/* Speed Selector */}
          <div className="flex items-center gap-1 pl-1.5 sm:pl-1 border-l border-border/60">
            <GaugeIcon className="size-3.5 text-muted-foreground hidden xs:block" />
            {SPEEDS.map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => handleSpeedChange(sp)}
                className={cn(
                  "min-w-8 h-10 sm:min-w-0 sm:h-auto sm:px-1.5 sm:py-0.5 px-2 py-1 text-xs sm:text-[11px] rounded-lg sm:rounded transition-all cursor-pointer font-medium flex items-center justify-center active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
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
                className="text-teal-700 dark:text-teal-300"
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
                  className={isCompleted ? "text-teal-700 dark:text-teal-300" : "text-primary"}
                />
                <g ref={penRef}>
                  {isCompleted ? (
                    <circle
                      r="2.5"
                      className="fill-teal-600 dark:fill-teal-400 stroke-background stroke-[1.2]"
                    />
                  ) : (
                    <>
                      {isPlaying ? (
                        <circle r="5" className="fill-primary/25 animate-ping opacity-75" />
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

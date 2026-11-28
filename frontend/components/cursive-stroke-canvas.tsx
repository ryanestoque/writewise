"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useSyncExternalStore } from "react";
import { PlayIcon, PauseIcon, RotateCcwIcon, GaugeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { getLetterStrokes, PAIRED_LETTER_OFFSETS, type StrokeStep } from "./cursive-strokes-data";

export type AnimationCaseMode = "lower" | "upper" | "both";
export type AnimationSpeed = 0.5 | 1 | 1.5;

interface CursiveStrokeCanvasProps {
  letterId: string;
  onActiveStepChange?: (mode: "upper" | "lower", stepIndex: number | null) => void;
  className?: string;
}

interface ActiveSequenceItem {
  stroke: StrokeStep;
  mode: "upper" | "lower";
  modeIndex: number;
  offsetX: number;
  liftBefore: boolean;
}

const MS_PER_PATH_UNIT = 12;
const PEN_LIFT_MS = 200;
const MAX_FRAME_DELTA_MS = 100;
const SPEEDS: AnimationSpeed[] = [0.5, 1, 1.5];
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

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
      className="text-primary/75"
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
      className="text-band-1-text"
      strokeWidth="1.8"
      strokeOpacity="0.9"
    />

    {/* Descender line y=100 */}
    <line
      x1="10"
      y1="100"
      x2="390"
      y2="100"
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
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeSeqIndex, setActiveSeqIndex] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const showFullLetter = prefersReducedMotion || isCompleted;

  // Per-frame values live in refs and are painted imperatively — no React
  // re-render per animation frame.
  const elapsedRef = useRef(0);
  const speedRef = useRef<AnimationSpeed>(1);
  const pathLengthRef = useRef(0);
  const activePathRef = useRef<SVGPathElement | null>(null);
  const penRef = useRef<SVGGElement | null>(null);

  const strokesData = useMemo(() => getLetterStrokes(letterId), [letterId]);

  // In "both" mode, play uppercase on the left, then lowercase on the right.
  const sequence = useMemo<ActiveSequenceItem[]>(() => {
    const seq: ActiveSequenceItem[] = [];
    const push = (strokes: StrokeStep[], mode: "upper" | "lower", offsetX: number) => {
      const followsOtherCase = seq.length > 0;
      for (const [modeIndex, stroke] of strokes.entries()) {
        seq.push({
          stroke,
          mode,
          modeIndex,
          offsetX,
          liftBefore: Boolean(stroke.liftBefore) || (followsOtherCase && modeIndex === 0),
        });
      }
    };
    if (caseMode === "upper" || caseMode === "both") {
      push(strokesData.upper, "upper", caseMode === "both" ? PAIRED_LETTER_OFFSETS.upper : 0);
    }
    if (caseMode === "lower" || caseMode === "both") {
      push(strokesData.lower, "lower", caseMode === "both" ? PAIRED_LETTER_OFFSETS.lower : 0);
    }
    return seq;
  }, [strokesData, caseMode]);

  const activeItem = sequence[activeSeqIndex];

  const paint = useCallback((elapsed: number, liftBefore: boolean) => {
    const path = activePathRef.current;
    const len = pathLengthRef.current;
    if (!path || len <= 0) return true;

    const liftTime = liftBefore ? PEN_LIFT_MS : 0;
    const duration = Math.max(140, Math.min(2400, len * MS_PER_PATH_UNIT));
    const progress = Math.min(1, Math.max(0, (elapsed - liftTime) / duration));
    path.style.visibility = progress === 0 ? "hidden" : "";
    path.style.strokeDashoffset = String(len * (1 - progress));

    const pen = penRef.current;
    if (pen) {
      pen.style.visibility = elapsed < liftTime ? "hidden" : "";
      const point = path.getPointAtLength(progress * len);
      pen.setAttribute("transform", `translate(${point.x}, ${point.y})`);
    }
    return progress === 1;
  }, []);

  const resetAnimation = (mode = caseMode) => {
    elapsedRef.current = 0;
    paint(0, false);
    if (mode === caseMode && activeSeqIndex === 0 && activeItem && !showFullLetter) {
      onActiveStepChange?.(activeItem.mode, 0);
    }
    setCaseMode(mode);
    setActiveSeqIndex(0);
    setIsCompleted(false);
    setIsPlaying(true);
  };

  const handleSpeedChange = (sp: AnimationSpeed) => {
    speedRef.current = sp; // read live by the tick loop; no loop restart
    setSpeed(sp);
  };

  // Optional notification to parent
  useEffect(() => {
    if (activeItem && onActiveStepChange) {
      onActiveStepChange(activeItem.mode, showFullLetter ? null : activeItem.modeIndex);
    }
  }, [activeItem, onActiveStepChange, showFullLetter]);

  // Measure once per stroke (not per frame) using isomorphic layout effect to avoid SSR warnings
  useIsomorphicLayoutEffect(() => {
    const path = activePathRef.current;
    if (!path || !activeItem) return;
    let len = 0;
    try {
      len = path.getTotalLength();
    } catch {
      // SVG geometry unavailable (e.g. detached) — leave stroke fully drawn
    }
    pathLengthRef.current = len;
    if (len > 0) {
      path.style.strokeDasharray = String(len);
      paint(elapsedRef.current, activeItem.liftBefore);
    }
  }, [activeItem, paint, showFullLetter]);

  // Animation loop. Pure: no side effects inside state updaters.
  useEffect(() => {
    if (!isPlaying || !activeItem || showFullLetter) return;

    const isLast = activeSeqIndex >= sequence.length - 1;
    let last: number | null = null;
    let raf = 0;

    const tick = (now: number) => {
      const delta = last === null ? 0 : Math.min(now - last, MAX_FRAME_DELTA_MS);
      last = now;
      elapsedRef.current += delta * speedRef.current;

      if (!paint(elapsedRef.current, activeItem.liftBefore)) {
        raf = requestAnimationFrame(tick);
      } else if (!isLast) {
        elapsedRef.current = 0;
        setActiveSeqIndex((idx) => idx + 1);
      } else {
        setIsPlaying(false);
        setIsCompleted(true);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, activeItem, activeSeqIndex, sequence.length, paint, showFullLetter]);

  const togglePlay = () => {
    if (isCompleted) {
      resetAnimation();
    } else {
      setIsPlaying((p) => !p);
    }
  };

  return (
    <div className={cn("flex w-full flex-col gap-2.5", className)}>
      {/* Controls & Case Selector Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Case Mode Selector */}
        <ToggleGroup
          value={[caseMode]}
          multiple={false}
          onValueChange={(vals) => {
            if (vals.length > 0) resetAnimation(vals[0] as AnimationCaseMode);
          }}
          aria-label="Cursive letter case mode"
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="lower" className="min-h-10 sm:min-h-8">
            Lower ({letterId.toLowerCase()})
          </ToggleGroupItem>
          <ToggleGroupItem value="upper" className="min-h-10 sm:min-h-8">
            Upper ({letterId.toUpperCase()})
          </ToggleGroupItem>
          <ToggleGroupItem value="both" className="min-h-10 sm:min-h-8">
            Both ({letterId.toUpperCase()}{letterId.toLowerCase()})
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Playback Controls & Speed */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={togglePlay}
            disabled={prefersReducedMotion}
            className="min-h-10 sm:min-h-8"
            title={showFullLetter ? "Replay animation" : isPlaying ? "Pause animation" : "Play animation"}
            aria-label={showFullLetter ? "Replay animation" : isPlaying ? "Pause animation" : "Play animation"}
          >
            {isPlaying && !showFullLetter ? (
              <>
                <PauseIcon data-icon="inline-start" className="fill-current" aria-hidden="true" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <PlayIcon data-icon="inline-start" className="fill-current" aria-hidden="true" />
                <span>{showFullLetter ? "Replay" : "Play"}</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => resetAnimation()}
            disabled={prefersReducedMotion}
            className="size-10 sm:size-8"
            title="Replay from start"
            aria-label="Replay from start"
          >
            <RotateCcwIcon aria-hidden="true" />
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-6 self-center" />

          <div className="flex items-center gap-1">
            <GaugeIcon className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden="true" />
            <ToggleGroup
              value={[String(speed)]}
              multiple={false}
              onValueChange={(vals) => {
                if (vals.length > 0) handleSpeedChange(Number(vals[0]) as AnimationSpeed);
              }}
              aria-label="Animation playback speed"
              variant="outline"
              size="sm"
            >
              {SPEEDS.map((sp) => (
                <ToggleGroupItem
                  key={sp}
                  value={String(sp)}
                  aria-label={`Set animation speed to ${sp}x`}
                  className="min-h-10 min-w-10 sm:min-h-8 sm:min-w-0"
                >
                  {sp}x
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </div>

      {/* SVG Penmanship Ruling Canvas */}
      <div className="relative flex h-36 w-full select-none items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs sm:h-40">
        <svg
          viewBox="0 0 400 115"
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
                className="text-muted-foreground/20"
                strokeDasharray="3 3"
              />
            ))}

            {/* LAYER 2: Completed Past Strokes */}
            {(showFullLetter ? sequence : sequence.slice(0, activeSeqIndex)).map((item, idx) => (
              <path
                key={`done-${idx}`}
                transform={offsetTransform(item.offsetX)}
                d={item.stroke.d}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              />
            ))}

            {/* LAYER 3 + 4: Active stroke and pen tip share the offset group,
                so pen coordinates come straight from getPointAtLength. */}
            {activeItem && !showFullLetter ? (
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
                  className="text-primary"
                />
                <g ref={penRef}>
                  <circle r="3.5" className="fill-primary/40 stroke-primary stroke-[1.2]" />
                  <circle r="2" className="fill-primary-foreground" />
                </g>
              </g>
            ) : null}
          </g>
        </svg>
      </div>
    </div>
  );
}

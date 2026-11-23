"use client";

import { useState } from "react";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { Button } from "@/components/ui/button";
import {
  PARENT_CRITERIA_LIST,
  PARENT_BAND_EXPLANATIONS,
  DIAGNOSTIC_NOTES,
  getBandFromScore,
  getBandMeta,
  type CriterionKey,
} from "@/lib/utils/scoring";
import {
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SampleReportPreviewProps {
  onOpenRubric: () => void;
  defaultCollapsed?: boolean;
  showScoreDetails?: boolean;
  onToggleScoreDetails?: () => void;
}

const SAMPLE_CRITERION_DATA: Record<
  CriterionKey,
  {
    score: number;
    band: "satisfactory" | "excellent";
    bandLabel: string;
  }
> = {
  letter_formation: {
    score: 70,
    band: "satisfactory",
    bandLabel: "Satisfactory",
  },
  size_consistency: {
    score: 68,
    band: "satisfactory",
    bandLabel: "Satisfactory",
  },
  spacing: {
    score: 84,
    band: "excellent",
    bandLabel: "Excellent",
  },
  slant: {
    score: 64,
    band: "satisfactory",
    bandLabel: "Satisfactory",
  },
  baseline_alignment: {
    score: 72,
    band: "satisfactory",
    bandLabel: "Satisfactory",
  },
};

const SAMPLE_COMPOSITE_SCORE = 71.6;
const SAMPLE_COMPOSITE_BAND = getBandFromScore(SAMPLE_COMPOSITE_SCORE) ?? "satisfactory";
const SAMPLE_COMPOSITE_META = getBandMeta(SAMPLE_COMPOSITE_BAND);

export function SampleReportPreview({
  onOpenRubric,
  defaultCollapsed = true,
}: SampleReportPreviewProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const [activeCriterion, setActiveCriterion] =
    useState<CriterionKey>("slant");

  const currentMeta = PARENT_CRITERIA_LIST.find(
    (c) => c.key === activeCriterion
  )!;
  const currentSample = SAMPLE_CRITERION_DATA[activeCriterion];
  const diagnosticNote =
    DIAGNOSTIC_NOTES[activeCriterion][currentSample.band];

  return (
    <section
      aria-labelledby="sample-report-heading"
      className="rounded-xl border border-border bg-card shadow-warm overflow-hidden"
    >
      {/* Header bar */}
      <div className={cn("px-5 sm:px-6", isCollapsed ? "py-4" : "py-5 sm:py-6 space-y-3")}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2
              id="sample-report-heading"
              className="font-heading text-base sm:text-lg font-semibold text-foreground"
            >
              Example feedback
            </h2>
            {!isCollapsed && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                How WriteWise evaluates each skill and suggests home practice.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-expanded={!isCollapsed}
              className="h-10 sm:h-9 min-h-10 sm:min-h-9 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer"
            >
              {isCollapsed ? (
                <>
                  <span>Preview example</span>
                  <ChevronDown className="size-4" aria-hidden="true" />
                </>
              ) : (
                <>
                  <span>Hide example</span>
                  <ChevronUp className="size-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 5-Criterion Interactive Selector Chips */}
        {!isCollapsed && (
          <div
            role="tablist"
            aria-label="Example handwriting skills"
            className="flex flex-wrap gap-1.5 sm:gap-2 pt-3 border-t border-border/60"
            onKeyDown={(e) => {
              const keys = PARENT_CRITERIA_LIST.map((c) => c.key);
              const i = keys.indexOf(activeCriterion);
              let next = -1;
              if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % keys.length;
              else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + keys.length) % keys.length;
              else if (e.key === "Home") next = 0;
              else if (e.key === "End") next = keys.length - 1;
              if (next < 0) return;
              e.preventDefault();
              setActiveCriterion(keys[next]);
              document.getElementById(`tab-${keys[next]}`)?.focus();
            }}
          >
            {PARENT_CRITERIA_LIST.map((criterion) => {
              const isSelected = activeCriterion === criterion.key;
              const data = SAMPLE_CRITERION_DATA[criterion.key];

              return (
                <button
                  key={criterion.key}
                  role="tab"
                  type="button"
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  aria-controls="sample-diagnostic-details"
                  id={`tab-${criterion.key}`}
                  onClick={() => setActiveCriterion(criterion.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer border select-none min-h-[40px] sm:min-h-[36px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                    isSelected
                      ? "bg-brand-600 text-white border-brand-600 dark:bg-brand-500 dark:border-brand-500 font-semibold"
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/60 border-border/80"
                  )}
                >
                  <span>{criterion.label}</span>
                  <span
                    className={cn(
                      "font-sans tabular-nums text-xs font-semibold",
                      isSelected ? "text-white/90" : "text-muted-foreground"
                    )}
                  >
                    {data.score}%
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Interactive Stage */}
      {!isCollapsed && (
        <div className="p-5 sm:p-6 border-t border-border/60 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Simulated Ruled Worksheet with Guide Lines */}
          <div className="lg:col-span-7 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-semibold text-foreground">
                  Example Worksheet: &ldquo;The quick brown fox&rdquo;
                </span>
                <span className="text-muted-foreground text-xs font-medium">
                  Showing {currentMeta.label}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                3-line handwriting paper: top line, dotted middle line, and bottom writing line.
              </p>
            </div>

            <div className="relative rounded-xl border border-border/80 bg-background/80 dark:bg-muted/20 p-4 sm:p-6 overflow-hidden">
              <svg
                viewBox="0 0 540 180"
                className="w-full h-auto select-none"
                aria-label={`Example handwriting illustration with ${currentMeta.label} guide lines`}
                role="img"
              >
                <line x1="20" y1="35" x2="520" y2="35" stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                <text x="22" y="29" fill="var(--muted-foreground)" fontSize="10" fontFamily="sans-serif" fontWeight="500">Top Line</text>

                <line x1="20" y1="85" x2="520" y2="85" stroke="var(--primary)" strokeWidth="1.25" strokeDasharray="4 4" opacity="0.8" />
                <text x="22" y="79" fill="var(--secondary-foreground)" fontSize="10" fontFamily="sans-serif" fontWeight="500">Middle Line</text>

                <line x1="20" y1="135" x2="520" y2="135" stroke="var(--destructive)" strokeWidth="1.5" opacity="0.85" />
                <text x="22" y="149" fill="var(--destructive)" fontSize="10" fontFamily="sans-serif" fontWeight="500">Bottom Line</text>

                <line x1="20" y1="165" x2="520" y2="165" stroke="var(--muted-foreground)" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.4" />

                {activeCriterion === "slant" && (
                  <g className="animate-in fade-in duration-300 motion-reduce:animate-none">
                    <line x1="75" y1="145" x2="115" y2="25" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                    <line x1="140" y1="145" x2="180" y2="25" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                    <line x1="210" y1="145" x2="250" y2="25" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                    <line x1="310" y1="145" x2="350" y2="25" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                    <line x1="420" y1="145" x2="460" y2="25" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />

                    <rect x="235" y="15" width="110" height="18" rx="4" fill="var(--primary)" opacity="0.92" />
                    <text x="290" y="27" fill="var(--primary-foreground)" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                      Steady Forward Tilt
                    </text>
                  </g>
                )}

                {activeCriterion === "baseline_alignment" && (
                  <g className="animate-in fade-in duration-300 motion-reduce:animate-none">
                    <line x1="45" y1="135" x2="495" y2="135" stroke="var(--color-band-4)" strokeWidth="3" opacity="0.4" />
                    <circle cx="85" cy="135" r="3.5" fill="var(--color-band-4)" stroke="var(--surface)" strokeWidth="1.5" />
                    <circle cx="155" cy="135" r="3.5" fill="var(--color-band-4)" stroke="var(--surface)" strokeWidth="1.5" />
                    <circle cx="230" cy="135" r="3.5" fill="var(--color-band-4)" stroke="var(--surface)" strokeWidth="1.5" />
                    <circle cx="340" cy="135" r="3.5" fill="var(--color-band-4)" stroke="var(--surface)" strokeWidth="1.5" />
                    <circle cx="445" cy="135" r="3.5" fill="var(--color-band-4)" stroke="var(--surface)" strokeWidth="1.5" />

                    <rect x="355" y="145" width="135" height="18" rx="4" fill="var(--color-band-4)" opacity="0.92" />
                    <text x="422" y="157" fill="var(--surface)" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                      Rests on Bottom Line
                    </text>
                  </g>
                )}

                {activeCriterion === "size_consistency" && (
                  <g className="animate-in fade-in duration-300 motion-reduce:animate-none">
                    <rect x="40" y="85" width="460" height="50" fill="var(--primary)" opacity="0.08" />
                    <line x1="125" y1="88" x2="125" y2="132" stroke="var(--primary)" strokeWidth="2" />
                    <line x1="265" y1="88" x2="265" y2="132" stroke="var(--primary)" strokeWidth="2" />
                    <rect x="175" y="75" width="105" height="18" rx="4" fill="var(--primary)" opacity="0.92" />
                    <text x="227" y="87" fill="var(--primary-foreground)" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                      Even Letter Height
                    </text>
                  </g>
                )}

                {activeCriterion === "spacing" && (
                  <g className="animate-in fade-in duration-300 motion-reduce:animate-none">
                    <rect x="135" y="80" width="30" height="55" fill="var(--primary)" opacity="0.12" rx="3" stroke="var(--primary)" strokeDasharray="2 2" strokeWidth="1" />
                    <rect x="270" y="80" width="32" height="55" fill="var(--primary)" opacity="0.12" rx="3" stroke="var(--primary)" strokeDasharray="2 2" strokeWidth="1" />
                    <rect x="390" y="80" width="28" height="55" fill="var(--primary)" opacity="0.12" rx="3" stroke="var(--primary)" strokeDasharray="2 2" strokeWidth="1" />
                    <text x="150" y="148" fill="var(--secondary-foreground)" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">1 finger</text>
                    <text x="286" y="148" fill="var(--secondary-foreground)" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">1 finger</text>
                  </g>
                )}

                {activeCriterion === "letter_formation" && (
                  <g className="animate-in fade-in duration-300 motion-reduce:animate-none">
                    <circle cx="95" cy="55" r="9" fill="none" stroke="var(--color-band-2)" strokeWidth="2" strokeDasharray="3 2" />
                    <circle cx="215" cy="110" r="10" fill="none" stroke="var(--color-band-2)" strokeWidth="2" strokeDasharray="3 2" />
                    <circle cx="345" cy="110" r="10" fill="none" stroke="var(--color-band-2)" strokeWidth="2" strokeDasharray="3 2" />
                    <rect x="235" y="15" width="105" height="18" rx="4" fill="var(--color-band-1)" opacity="0.92" />
                    <text x="287" y="27" fill="var(--surface)" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                      Clean Loops &amp; Joins
                    </text>
                  </g>
                )}

                <g
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-foreground/90 transition-colors"
                >
                  <path d="M 50 45 Q 65 38 85 40 M 68 40 L 68 135" />
                  <path d="M 68 135 Q 76 80 88 42 Q 95 38 98 52 L 85 135 Q 92 105 106 102 Q 115 102 118 135" />
                  <path d="M 118 135 Q 128 105 135 105 Q 140 115 132 135" />
                  <path d="M 175 110 Q 165 92 178 92 Q 188 92 188 115 Q 188 135 175 135 M 188 95 L 188 165 Q 195 155 198 135" />
                  <path d="M 198 135 Q 205 102 210 102 L 210 135 Q 218 102 225 102 L 225 135" />
                  <path d="M 225 135 Q 232 102 238 102 L 238 135 M 238 85 L 238 87" />
                  <path d="M 238 135 Q 248 102 255 102 Q 246 122 255 135" />
                  <path d="M 255 135 Q 262 80 270 42 Q 275 38 276 52 L 268 135 M 268 112 Q 278 108 276 120 L 284 135" />
                  <path d="M 315 135 Q 322 80 330 42 Q 336 38 338 52 L 328 135 Q 338 135 342 110" />
                  <path d="M 342 110 Q 346 100 352 104 L 354 135" />
                  <path d="M 354 135 Q 364 95 372 102 Q 375 125 368 135 Q 372 110 380 110" />
                  <path d="M 380 110 L 382 135 Q 390 105 394 105 L 396 135 Q 402 110 408 110" />
                  <path d="M 408 110 L 408 135 Q 416 102 422 102 L 422 135" />
                  <path d="M 440 135 Q 448 80 456 42 Q 462 38 462 52 L 452 165 Q 456 160 460 135" />
                  <path d="M 460 135 Q 470 95 478 102 Q 482 125 474 135 Q 480 110 488 110" />
                  <path d="M 488 110 L 502 135 M 488 135 L 502 110" />
                </g>
              </svg>
            </div>
          </div>

          {/* Right Column: Example Feedback & Home Tip (flat, border-divided — no nested cards) */}
          <div
            id="sample-diagnostic-details"
            className="lg:col-span-5 space-y-5"
          >
            {/* Overall Summary */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-heading font-semibold text-foreground">
                    Overall result
                  </h3>
                  <span className="text-xs font-semibold font-sans tabular-nums text-muted-foreground">
                    {Math.round(SAMPLE_COMPOSITE_SCORE)}%
                  </span>
                </div>
                <BandBadge band={SAMPLE_COMPOSITE_BAND} score={SAMPLE_COMPOSITE_SCORE} size="default" />
              </div>
              <BandPositionBar
                score={SAMPLE_COMPOSITE_SCORE}
                height="default"
                showThresholds={true}
                ariaLabel={`Example overall score: ${Math.round(SAMPLE_COMPOSITE_SCORE)}%`}
                ariaValueText={`${Math.round(SAMPLE_COMPOSITE_SCORE)}% overall`}
              />
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{SAMPLE_COMPOSITE_META.label}:</span>{" "}
                {PARENT_BAND_EXPLANATIONS[SAMPLE_COMPOSITE_BAND]}
              </p>
            </div>

            {/* Active Skill Feedback */}
            <div className="border-t border-border/70 pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-heading font-semibold text-foreground truncate">
                    {currentMeta.label}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {currentMeta.shortDescription}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-sans tabular-nums text-xs font-semibold text-muted-foreground">
                    {currentSample.score}%
                  </span>
                  <BandBadge band={currentSample.band} score={currentSample.score} size="sm" />
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {diagnosticNote}
              </p>

              <p className="text-sm leading-relaxed text-foreground">
                <strong className="font-semibold text-primary">Home tip:</strong>{" "}
                {currentMeta.homeTip}
              </p>
            </div>

            <div className="border-t border-border/70 pt-3">
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={onOpenRubric}
                className="px-0 min-h-[40px] sm:min-h-[36px] text-sm font-medium cursor-pointer touch-manipulation"
              >
                How scores work
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

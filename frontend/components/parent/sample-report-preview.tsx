"use client";

import { useState } from "react";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { Button } from "@/components/ui/button";
import {
  PARENT_CRITERIA_LIST,
  DIAGNOSTIC_NOTES,
  type CriterionKey,
} from "@/lib/utils/scoring";
import {
  BookOpen,
  Ruler,
  Compass,
  Layers,
  MoveVertical,
  Maximize2,
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
    icon: typeof Ruler;
  }
> = {
  letter_formation: {
    score: 88,
    band: "satisfactory",
    bandLabel: "Satisfactory",
    icon: Layers,
  },
  size_consistency: {
    score: 85,
    band: "satisfactory",
    bandLabel: "Satisfactory",
    icon: MoveVertical,
  },
  spacing: {
    score: 92,
    band: "excellent",
    bandLabel: "Excellent",
    icon: Maximize2,
  },
  slant: {
    score: 82,
    band: "satisfactory",
    bandLabel: "Satisfactory",
    icon: Compass,
  },
  baseline_alignment: {
    score: 89,
    band: "satisfactory",
    bandLabel: "Satisfactory",
    icon: Ruler,
  },
};

export function SampleReportPreview({
  onOpenRubric,
  defaultCollapsed = false,
  showScoreDetails: controlledShowDetails,
  onToggleScoreDetails,
}: SampleReportPreviewProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [internalShowDetails, setInternalShowDetails] = useState(false);
  const showScoreDetails =
    controlledShowDetails !== undefined ? controlledShowDetails : internalShowDetails;
  const toggleScoreDetails =
    onToggleScoreDetails || (() => setInternalShowDetails((prev) => !prev));

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
      <div className="p-5 sm:p-6 bg-muted/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                id="sample-report-heading"
                className="font-heading text-base sm:text-lg font-bold text-foreground"
              >
                What Feedback Looks Like
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100/80 dark:bg-brand-950/80 text-brand-800 dark:text-brand-200 border border-brand-200/70 dark:border-brand-800/70 shadow-2xs">
                Example Only
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Preview how WriteWise checks the 5 handwriting skills and gives simple home practice tips once a worksheet is graded.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isCollapsed && (
              <button
                type="button"
                onClick={toggleScoreDetails}
                aria-pressed={showScoreDetails}
                className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg px-3 py-1.5 h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] inline-flex items-center justify-center border border-brand-200/70 dark:border-brand-800/70 bg-brand-50/50 dark:bg-brand-950/30 transition-colors touch-manipulation"
              >
                {showScoreDetails ? "Hide details" : "Show details"}
              </button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-expanded={!isCollapsed}
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-medium gap-1.5 cursor-pointer"
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
            className="flex flex-wrap gap-1.5 sm:gap-2 pt-2 border-t border-border/60"
          >
            {PARENT_CRITERIA_LIST.map((criterion) => {
              const isSelected = activeCriterion === criterion.key;
              const data = SAMPLE_CRITERION_DATA[criterion.key];
              const Icon = data.icon;

              return (
                <button
                  key={criterion.key}
                  role="tab"
                  type="button"
                  aria-selected={isSelected}
                  aria-controls="sample-diagnostic-details"
                  id={`tab-${criterion.key}`}
                  onClick={() => setActiveCriterion(criterion.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border select-none min-h-[40px] sm:min-h-[36px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                    isSelected
                      ? "bg-brand-600 text-white border-brand-600 shadow-xs dark:bg-brand-500 dark:border-brand-500 font-semibold"
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/60 border-border/80"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0",
                      isSelected ? "text-white" : "text-brand-600 dark:text-brand-400"
                    )}
                    aria-hidden="true"
                  />
                  <span>{criterion.label}</span>
                  {showScoreDetails && (
                    <span
                      className={cn(
                        "font-sans tabular-nums text-xs font-semibold px-1.5 py-0.2 rounded-sm",
                        isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {data.score}%
                    </span>
                  )}
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

            <div className="relative rounded-xl border border-border/80 bg-background/80 dark:bg-muted/20 p-4 sm:p-5 overflow-hidden shadow-2xs">
              <svg
                viewBox="0 0 540 180"
                className="w-full h-auto select-none"
                aria-label={`Example handwriting illustration with ${currentMeta.label} guide lines`}
                role="img"
              >
                <line x1="20" y1="35" x2="520" y2="35" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                <text x="22" y="30" fill="#475569" fontSize="8.5" fontFamily="sans-serif" fontWeight="500">Top Line</text>

                <line x1="20" y1="85" x2="520" y2="85" stroke="#1b6b63" strokeWidth="1.25" strokeDasharray="4 4" opacity="0.8" />
                <text x="22" y="80" fill="#145049" fontSize="8.5" fontFamily="sans-serif" fontWeight="500">Middle Line</text>

                <line x1="20" y1="135" x2="520" y2="135" stroke="#9c4a2f" strokeWidth="1.5" opacity="0.85" />
                <text x="22" y="147" fill="#80351e" fontSize="8.5" fontFamily="sans-serif" fontWeight="500">Bottom Line</text>

                <line x1="20" y1="165" x2="520" y2="165" stroke="#64748b" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.4" />

                {activeCriterion === "slant" && (
                  <g className="animate-in fade-in duration-300">
                    <line x1="75" y1="145" x2="115" y2="25" stroke="#1b6b63" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                    <line x1="140" y1="145" x2="180" y2="25" stroke="#1b6b63" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                    <line x1="210" y1="145" x2="250" y2="25" stroke="#1b6b63" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                    <line x1="310" y1="145" x2="350" y2="25" stroke="#1b6b63" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                    <line x1="420" y1="145" x2="460" y2="25" stroke="#1b6b63" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />

                    <rect x="235" y="15" width="110" height="18" rx="4" fill="#1b6b63" opacity="0.9" />
                    <text x="290" y="27" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                      Steady Forward Tilt
                    </text>
                  </g>
                )}

                {activeCriterion === "baseline_alignment" && (
                  <g className="animate-in fade-in duration-300">
                    <line x1="45" y1="135" x2="495" y2="135" stroke="#4a8b5c" strokeWidth="3" opacity="0.4" />
                    <circle cx="85" cy="135" r="3.5" fill="#4a8b5c" stroke="#ffffff" strokeWidth="1.5" />
                    <circle cx="155" cy="135" r="3.5" fill="#4a8b5c" stroke="#ffffff" strokeWidth="1.5" />
                    <circle cx="230" cy="135" r="3.5" fill="#4a8b5c" stroke="#ffffff" strokeWidth="1.5" />
                    <circle cx="340" cy="135" r="3.5" fill="#4a8b5c" stroke="#ffffff" strokeWidth="1.5" />
                    <circle cx="445" cy="135" r="3.5" fill="#4a8b5c" stroke="#ffffff" strokeWidth="1.5" />

                    <rect x="355" y="145" width="135" height="18" rx="4" fill="#4a8b5c" opacity="0.9" />
                    <text x="422" y="157" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                      Rests on Bottom Line
                    </text>
                  </g>
                )}

                {activeCriterion === "size_consistency" && (
                  <g className="animate-in fade-in duration-300">
                    <rect x="40" y="85" width="460" height="50" fill="#1b6b63" opacity="0.08" />
                    <line x1="125" y1="88" x2="125" y2="132" stroke="#1b6b63" strokeWidth="2" />
                    <line x1="265" y1="88" x2="265" y2="132" stroke="#1b6b63" strokeWidth="2" />
                    <rect x="175" y="75" width="105" height="18" rx="4" fill="#1b6b63" opacity="0.9" />
                    <text x="227" y="87" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                      Even Letter Height
                    </text>
                  </g>
                )}

                {activeCriterion === "spacing" && (
                  <g className="animate-in fade-in duration-300">
                    <rect x="135" y="80" width="30" height="55" fill="#1b6b63" opacity="0.12" rx="3" stroke="#1b6b63" strokeDasharray="2 2" strokeWidth="1" />
                    <rect x="270" y="80" width="32" height="55" fill="#1b6b63" opacity="0.12" rx="3" stroke="#1b6b63" strokeDasharray="2 2" strokeWidth="1" />
                    <rect x="390" y="80" width="28" height="55" fill="#1b6b63" opacity="0.12" rx="3" stroke="#1b6b63" strokeDasharray="2 2" strokeWidth="1" />
                    <text x="150" y="148" fill="#145049" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">1 finger</text>
                    <text x="286" y="148" fill="#145049" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">1 finger</text>
                  </g>
                )}

                {activeCriterion === "letter_formation" && (
                  <g className="animate-in fade-in duration-300">
                    <circle cx="95" cy="55" r="9" fill="none" stroke="#c9a227" strokeWidth="2" strokeDasharray="3 2" />
                    <circle cx="215" cy="110" r="10" fill="none" stroke="#c9a227" strokeWidth="2" strokeDasharray="3 2" />
                    <circle cx="345" cy="110" r="10" fill="none" stroke="#c9a227" strokeWidth="2" strokeDasharray="3 2" />
                    <rect x="235" y="15" width="105" height="18" rx="4" fill="#b6754a" opacity="0.9" />
                    <text x="287" y="27" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
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

          {/* Right Column: Example Feedback & Home Tip */}
          <div
            id="sample-diagnostic-details"
            className="lg:col-span-5 space-y-4"
          >
            {/* Overall Summary */}
            <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-heading font-semibold text-foreground">
                    Example Overall Result
                  </h3>
                  {showScoreDetails && (
                    <span className="text-xs font-semibold font-sans tabular-nums text-muted-foreground bg-background px-2 py-0.5 rounded-md border border-border/60">
                      87% overall
                    </span>
                  )}
                </div>
                <BandBadge score={87.2} size="default" />
              </div>
              <BandPositionBar score={87.2} height="default" showThresholds={showScoreDetails} />
              <p className="text-sm text-muted-foreground leading-normal pt-0.5">
                <span className="font-semibold text-foreground">Satisfactory:</span> Solid cursive foundation with small areas to refine.
              </p>
            </div>

            {/* Active Skill Feedback Card */}
            <div className="rounded-xl border border-brand-200/80 dark:border-brand-900 bg-brand-50/20 dark:bg-brand-950/20 p-4 sm:p-5 space-y-3.5 shadow-2xs">
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
                  {showScoreDetails && (
                    <span className="font-sans tabular-nums text-xs font-semibold text-muted-foreground">
                      {currentSample.score}%
                    </span>
                  )}
                  <BandBadge band={currentSample.band} score={currentSample.score} size="sm" />
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <span className="font-semibold text-foreground block">
                  What we look for:
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  {diagnosticNote}
                </p>
              </div>

              <div className="rounded-lg border border-brand-200/60 dark:border-brand-800/60 bg-brand-100/50 dark:bg-brand-950/40 p-3 space-y-1 text-sm">
                <span className="font-semibold text-brand-900 dark:text-brand-200 block">
                  Home tip:
                </span>
                <p className="text-brand-800 dark:text-brand-300 leading-relaxed">
                  {currentMeta.homeTip}
                </p>
              </div>
            </div>

            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenRubric}
                className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs sm:text-sm font-semibold gap-1.5 border-border/80 hover:bg-muted cursor-pointer justify-center"
              >
                <BookOpen className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span>How Scores Work</span>
              </Button>

              <span className="text-xs text-muted-foreground text-center sm:text-right">
                Real results appear after your teacher checks a worksheet
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

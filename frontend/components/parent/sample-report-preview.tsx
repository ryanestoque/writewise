"use client";

import { useId, useState } from "react";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SampleReportPreviewProps {
  onOpenRubric: () => void;
  defaultCollapsed?: boolean;
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
  const baseId = useId();
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
    <Card
      role="region"
      aria-labelledby={`${baseId}-heading`}
      className="p-0 gap-0"
    >
      <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
        <CardHeader className={cn("px-5 sm:px-6", isCollapsed ? "py-4" : "pt-5 sm:pt-6 pb-4")}>
          <CardTitle
            id={`${baseId}-heading`}
            className="text-base sm:text-lg font-semibold text-foreground"
          >
            Example feedback
          </CardTitle>
          {!isCollapsed && (
            <CardDescription className="leading-relaxed max-w-2xl">
              How WriteWise evaluates each skill and suggests home practice.
            </CardDescription>
          )}
          <CardAction>
            <CollapsibleTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 sm:h-9 min-h-10 sm:min-h-9 text-xs sm:text-sm font-medium cursor-pointer"
                />
              }
            >
              {isCollapsed ? (
                <>
                  <span>Preview example</span>
                  <ChevronDown data-icon="inline-end" aria-hidden="true" />
                </>
              ) : (
                <>
                  <span>Hide example</span>
                  <ChevronUp data-icon="inline-end" aria-hidden="true" />
                </>
              )}
            </CollapsibleTrigger>
          </CardAction>
        </CardHeader>

        <CollapsibleContent>
          <Tabs
            value={activeCriterion}
            onValueChange={(value) => setActiveCriterion(value as CriterionKey)}
            className="gap-0"
          >
            {/* 5-Criterion Interactive Selector Chips */}
            <div className="px-5 sm:px-6 pb-5 sm:pb-6 flex flex-col gap-3">
              <Separator className="bg-border/60" />
              <TabsList
                aria-label="Example handwriting skills"
                className="w-full h-auto flex-wrap justify-start gap-1.5 sm:gap-2 rounded-none bg-transparent p-0"
              >
                {PARENT_CRITERIA_LIST.map((criterion) => {
                  const data = SAMPLE_CRITERION_DATA[criterion.key];

                  return (
                    <TabsTrigger
                      key={criterion.key}
                      value={criterion.key}
                      className="flex-none h-auto rounded-lg px-3 py-2 text-xs sm:text-sm font-medium cursor-pointer select-none min-h-11 sm:min-h-9 bg-card text-muted-foreground ring-1 ring-border/80 hover:text-foreground hover:bg-muted/60 data-active:bg-primary data-active:text-primary-foreground data-active:ring-primary data-active:font-semibold dark:data-active:bg-primary dark:data-active:text-primary-foreground"
                    >
                      <span>{criterion.label}</span>
                      <span className="font-sans tabular-nums text-xs font-semibold opacity-85">
                        {data.score}%
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <Separator className="bg-border/60" />

            {/* Main Interactive Stage */}
            <CardContent className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Simulated Ruled Worksheet with Guide Lines */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
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

                <div className="relative rounded-xl border border-border/80 bg-muted/20 p-4 sm:p-6 overflow-hidden">
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

                        <rect x="355" y="145" width="135" height="18" rx="4" fill="var(--surface)" stroke="var(--color-band-4)" strokeWidth="1" />
                        <text x="422" y="157" fill="var(--band-4-text)" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
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
                        <rect x="235" y="15" width="105" height="18" rx="4" fill="var(--surface)" stroke="var(--color-band-1)" strokeWidth="1" />
                        <text x="287" y="27" fill="var(--band-1-text)" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
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
              <TabsContent
                value={activeCriterion}
                className="lg:col-span-5 flex flex-col gap-5"
              >
                {/* Overall Summary */}
                <div className="flex flex-col gap-2.5">
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

                <Separator className="bg-border/70" />

                {/* Active Skill Feedback */}
                <div className="flex flex-col gap-3">
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
                      <BandBadge band={currentSample.band} score={currentSample.score} size="sm" />
                      <span className="font-sans tabular-nums text-xs font-semibold text-muted-foreground">
                        {currentSample.score}%
                      </span>
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

                <Separator className="bg-border/70" />

                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-haspopup="dialog"
                    onClick={onOpenRubric}
                    className="h-8 px-3 rounded-full text-xs font-medium text-foreground border-border/80 bg-background hover:text-primary hover:border-primary/40 hover:bg-primary/5 active:bg-primary/10 cursor-pointer touch-manipulation transition-colors shadow-2xs"
                  >
                    <HelpCircle data-icon="inline-start" className="text-primary" aria-hidden="true" />
                    <span>Score Guide</span>
                  </Button>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

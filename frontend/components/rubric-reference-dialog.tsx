"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PenToolIcon,
  CompassIcon,
  SpaceIcon,
  MoveVerticalIcon,
  ScalingIcon,
  CpuIcon,
  EyeIcon,
  CheckCircle2Icon,
  BookOpenIcon,
  SparklesIcon,
  SearchIcon,
  XCircleIcon,
  LayersIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RubricReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabMode = "all" | "criteria" | "bands";
type EngineFilter = "all" | "neural" | "cv";

interface CriterionItem {
  id: string;
  name: string;
  engine: "CNN" | "OpenCV";
  engineType: "neural" | "cv";
  icon: typeof PenToolIcon;
  target: string;
  targetLabel?: string;
  description: string;
  diagnosticFocus: string;
  keywords: string[];
}

const criteria: CriterionItem[] = [
  {
    id: "formation",
    name: "Letter Formation",
    engine: "CNN",
    engineType: "neural",
    icon: PenToolIcon,
    target: "Clear loops, proper cursive joins, legible character structure",
    targetLabel: "Morphology & Joins",
    description:
      "Assesses stroke geometry, loop closure, and characteristic cursive joinery of individual characters against the CCC cursive benchmark dataset.",
    diagnosticFocus:
      "Identifies malformed loops, disconnected joins, ambiguous letterforms, and irregular stroke transitions.",
    keywords: ["formation", "letter", "cnn", "loops", "joins", "neural", "morphology", "ccc"],
  },
  {
    id: "slant",
    name: "Slant Angle",
    engine: "OpenCV",
    engineType: "cv",
    icon: CompassIcon,
    target: "60° – 75° consistent rightward inclination",
    targetLabel: "60°–75° Dominant Angle",
    description:
      "Measures the dominant stroke orientation across all ascending and descending letters using contour angle detection and line fitting.",
    diagnosticFocus:
      "Highlights erratic tilt fluctuations, vertical rigidity (<60°), or excessive over-slanting (>80°).",
    keywords: ["slant", "angle", "opencv", "degree", "tilt", "inclination", "contour"],
  },
  {
    id: "spacing",
    name: "Spacing & Rhythm",
    engine: "OpenCV",
    engineType: "cv",
    icon: SpaceIcon,
    target: "Uniform letter gaps & ~1 letter width between words",
    targetLabel: "Uniform 1-letter Gaps",
    description:
      "Analyzes horizontal connected component distances, intra-word letter rhythm, and inter-word margin consistency.",
    diagnosticFocus:
      "Detects cramped letter joins, irregular word gaps, or disjointed stroke gaps within words.",
    keywords: ["spacing", "rhythm", "opencv", "gap", "distance", "connected", "margin"],
  },
  {
    id: "baseline",
    name: "Baseline Alignment",
    engine: "OpenCV",
    engineType: "cv",
    icon: MoveVerticalIcon,
    target: "±2px deviation from writing guideline",
    targetLabel: "±2px Guideline Deviation",
    description:
      "Detects physical worksheet guidelines and measures vertical baseline variance across each written word and sentence.",
    diagnosticFocus:
      "Flags undulating words, sagging letters, or floating text drifting off the bottom guide line.",
    keywords: ["baseline", "alignment", "opencv", "guideline", "variance", "drift", "undulating"],
  },
  {
    id: "size",
    name: "Size Consistency",
    engine: "OpenCV",
    engineType: "cv",
    icon: ScalingIcon,
    target: "2:1 ratio for ascenders/descenders vs. x-height",
    targetLabel: "2:1 Ascender/x-Height Ratio",
    description:
      "Calculates the ratio of lowercase body height (x-height) to ascender and descender heights across consecutive words.",
    diagnosticFocus:
      "Flags disproportionate lowercase letters, stunted ascender loops, or uneven line scale.",
    keywords: ["size", "consistency", "opencv", "ratio", "ascender", "descender", "x-height", "scale"],
  },
];

interface ScoringBandItem {
  band: string;
  range: string;
  scoreRange: string;
  dotColor: string;
  containerClass: string;
  badgeClass: string;
  desc: string;
  pedagogyTip: string;
}

const scoringBands: ScoringBandItem[] = [
  {
    band: "Advanced",
    range: "90–100%",
    scoreRange: "4.5 – 5.0",
    dotColor: "bg-primary",
    containerClass:
      "border-primary/25 bg-primary/8 dark:bg-primary/15 hover:border-primary/40",
    badgeClass: "text-primary dark:text-primary-foreground font-semibold",
    desc: "Exemplary cursive discipline with fluid joins, uniform slant, and consistent baseline adherence.",
    pedagogyTip: "Ready for advanced long-form writing and independent expressive penmanship.",
  },
  {
    band: "Proficient",
    range: "75–89%",
    scoreRange: "3.75 – 4.49",
    dotColor: "bg-emerald-600 dark:bg-emerald-400",
    containerClass:
      "border-emerald-600/25 bg-emerald-600/8 dark:bg-emerald-500/15 hover:border-emerald-600/40",
    badgeClass: "text-emerald-800 dark:text-emerald-300 font-semibold",
    desc: "Strong cursive legibility with minor spacing or slant variations on complex letter joins.",
    pedagogyTip: "Reinforce tricky uppercase transitions (G, S, F) and consistent word margins.",
  },
  {
    band: "Developing",
    range: "60–74%",
    scoreRange: "3.0 – 3.74",
    dotColor: "bg-amber-500 dark:bg-amber-400",
    containerClass:
      "border-amber-500/25 bg-amber-500/8 dark:bg-amber-500/15 hover:border-amber-500/40",
    badgeClass: "text-amber-800 dark:text-amber-300 font-semibold",
    desc: "Recognizable cursive structure with noticeable letterform irregularities or fluctuating baseline.",
    pedagogyTip: "Targeted practice on baseline resting and keeping uniform slant across full words.",
  },
  {
    band: "Needs Improvement",
    range: "<60%",
    scoreRange: "< 3.0",
    dotColor: "bg-[#b6754a] dark:bg-[#d98a59]",
    containerClass:
      "border-[#b6754a]/25 bg-[#b6754a]/8 dark:bg-[#b6754a]/15 hover:border-[#b6754a]/40",
    badgeClass: "text-[#93522b] dark:text-[#f3a87c] font-semibold",
    desc: "Frequent print-cursive hybrid letters, erratic slant angles, or significant baseline drift.",
    pedagogyTip: "Return to stroke foundational drills (undercurves, downcurves, loop closures).",
  },
];

export function RubricReferenceDialog({
  open,
  onOpenChange,
}: RubricReferenceDialogProps) {
  const [activeTab, setActiveTab] = useState<TabMode>("all");
  const [engineFilter, setEngineFilter] = useState<EngineFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCriteria = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return criteria.filter((item) => {
      // Engine filter
      if (engineFilter === "neural" && item.engineType !== "neural") return false;
      if (engineFilter === "cv" && item.engineType !== "cv") return false;

      // Text search query
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.target.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.diagnosticFocus.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q))
      );
    });
  }, [searchQuery, engineFilter]);

  const filteredBands = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return scoringBands;
    return scoringBands.filter(
      (band) =>
        band.band.toLowerCase().includes(q) ||
        band.desc.toLowerCase().includes(q) ||
        band.range.toLowerCase().includes(q) ||
        band.pedagogyTip.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] w-full p-0 overflow-hidden flex flex-col gap-0 shadow-warm">
        {/* Modal Header */}
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/80 bg-background/95 backdrop-blur-xs shrink-0 space-y-3">
          <div className="flex items-start gap-3.5 pr-8">
            <div
              className="size-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs mt-0.5"
              aria-hidden="true"
            >
              <BookOpenIcon className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-heading font-semibold text-foreground tracking-tight">
                  Handwriting Assessment Rubric Guide
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] h-5 px-2 font-medium bg-muted/60 text-muted-foreground border-border/60"
                >
                  Diagnostic Specs
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Objective criteria powered by OpenCV geometric analysis and fine-tuned CNN neural inference.
              </DialogDescription>
            </div>
          </div>

          {/* Navigation Controls: Segmented Tabs & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            {/* View Mode Segmented Controls */}
            <div
              role="tablist"
              aria-label="Rubric guide views"
              className="inline-flex h-9 items-center rounded-lg bg-muted/70 p-1 text-muted-foreground border border-border/60"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "all"}
                onClick={() => setActiveTab("all")}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                  activeTab === "all"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayersIcon className="size-3.5" aria-hidden="true" />
                <span>Overview</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "criteria"}
                onClick={() => setActiveTab("criteria")}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                  activeTab === "criteria"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <SlidersHorizontalIcon className="size-3.5" aria-hidden="true" />
                <span>Criteria ({criteria.length})</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "bands"}
                onClick={() => setActiveTab("bands")}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                  activeTab === "bands"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <SparklesIcon className="size-3.5" aria-hidden="true" />
                <span>Bands (4)</span>
              </button>
            </div>

            {/* Quick Search Input */}
            <div className="relative flex-1 sm:max-w-48">
              <SearchIcon
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/70 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Search guide..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-8 pr-7 text-xs rounded-lg border border-border/80 bg-background placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                aria-label="Filter rubric criteria or bands"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  aria-label="Clear search"
                >
                  <XCircleIcon className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Engine Filter Pills (Visible when viewing Criteria or All) */}
          {activeTab !== "bands" && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] font-medium text-muted-foreground mr-1">
                Engine:
              </span>
              <button
                type="button"
                onClick={() => setEngineFilter("all")}
                className={cn(
                  "h-6 px-2 text-[11px] rounded-md font-medium transition-colors border cursor-pointer",
                  engineFilter === "all"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/70 hover:text-foreground"
                )}
              >
                All (5)
              </button>
              <button
                type="button"
                onClick={() => setEngineFilter("cv")}
                className={cn(
                  "h-6 px-2 text-[11px] rounded-md font-medium transition-colors border flex items-center gap-1 cursor-pointer",
                  engineFilter === "cv"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <EyeIcon className="size-3 text-primary" aria-hidden="true" />
                <span>OpenCV (4)</span>
              </button>
              <button
                type="button"
                onClick={() => setEngineFilter("neural")}
                className={cn(
                  "h-6 px-2 text-[11px] rounded-md font-medium transition-colors border flex items-center gap-1 cursor-pointer",
                  engineFilter === "neural"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <CpuIcon className="size-3 text-primary" aria-hidden="true" />
                <span>CNN Neural (1)</span>
              </button>
            </div>
          )}
        </DialogHeader>

        {/* Scrollable Content Body */}
        <ScrollArea className="flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-6">
            {/* Section 1: The 5 Criteria */}
            {(activeTab === "all" || activeTab === "criteria") && (
              <section aria-labelledby="diagnostic-criteria-heading">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3
                    id="diagnostic-criteria-heading"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    5 Diagnostic Assessment Criteria
                  </h3>
                  <span className="text-[11px] font-sans text-muted-foreground/80 tabular-nums">
                    Showing {filteredCriteria.length} of {criteria.length}
                  </span>
                </div>

                {filteredCriteria.length === 0 ? (
                  <div className="p-8 text-center rounded-xl border border-dashed border-border/80 bg-muted/20 space-y-1.5">
                    <p className="text-sm font-medium text-foreground">No criteria matched your filter</p>
                    <p className="text-xs text-muted-foreground">
                      Try adjusting your search query or engine filter.
                    </p>
                  </div>
                ) : (
                  <ul
                    role="list"
                    aria-label="5 Diagnostic Assessment Criteria"
                    className="grid gap-3"
                  >
                    {filteredCriteria.map((item) => {
                      const Icon = item.icon;
                      const isCNN = item.engineType === "neural";
                      return (
                        <li
                          key={item.id}
                          className="p-3.5 sm:p-4 rounded-xl border border-border/80 bg-card/70 hover:bg-card hover:border-primary/30 transition-all duration-150 shadow-xs space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                              <div
                                className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-xs"
                                aria-hidden="true"
                              >
                                <Icon className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-semibold text-foreground">
                                  {item.name}
                                </h4>
                                <p className="text-xs text-muted-foreground font-sans tabular-nums mt-0.5">
                                  <span className="font-medium text-foreground/85">
                                    Target:
                                  </span>{" "}
                                  {item.target}
                                </p>
                              </div>
                            </div>

                            <Badge
                              variant="secondary"
                              className="text-[10px] h-5.5 px-2 gap-1.5 shrink-0 font-medium bg-muted/80 text-foreground border border-border/60"
                              aria-label={`Evaluated by ${isCNN
                                  ? "CNN deep learning neural model"
                                  : "OpenCV computer vision geometric pipeline"
                                }`}
                            >
                              {isCNN ? (
                                <CpuIcon
                                  className="size-3 text-primary"
                                  aria-hidden="true"
                                />
                              ) : (
                                <EyeIcon
                                  className="size-3 text-primary"
                                  aria-hidden="true"
                                />
                              )}
                              <span>{item.engine}</span>
                            </Badge>
                          </div>

                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {item.description}
                          </p>

                          <div
                            className="flex items-start gap-2 text-[11px] text-muted-foreground/95 bg-muted/50 p-2.5 rounded-lg border border-border/40"
                            role="note"
                            aria-label={`Diagnostic focus: ${item.diagnosticFocus}`}
                          >
                            <CheckCircle2Icon
                              className="size-3.5 text-primary shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span className="leading-snug">
                              {item.diagnosticFocus}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {/* Section 2: Qualitative Bands */}
            {(activeTab === "all" || activeTab === "bands") && (
              <section aria-labelledby="scoring-bands-heading" className="pt-1">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3
                    id="scoring-bands-heading"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Qualitative Scoring Bands
                  </h3>
                  <span className="text-[11px] text-muted-foreground/80">
                    Pedagogical 4-Band Scale
                  </span>
                </div>

                {filteredBands.length === 0 ? (
                  <div className="p-8 text-center rounded-xl border border-dashed border-border/80 bg-muted/20 space-y-1.5">
                    <p className="text-sm font-medium text-foreground">No scoring bands matched your filter</p>
                  </div>
                ) : (
                  <ul
                    role="list"
                    aria-label="Qualitative Scoring Bands"
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    {filteredBands.map((band) => (
                      <li
                        key={band.band}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-colors shadow-xs space-y-2 ${band.containerClass}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`size-2.5 rounded-full shrink-0 ${band.dotColor}`}
                              aria-hidden="true"
                            />
                            <h4 className={`text-xs ${band.badgeClass} leading-tight`}>
                              {band.band}
                            </h4>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 font-sans tabular-nums">
                            <span className="text-xs font-semibold text-foreground/90">
                              {band.range}
                            </span>
                            <span className="text-[10px] text-muted-foreground/70">
                              ({band.scoreRange})
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {band.desc}
                        </p>

                        {/* Pedagogical Guidance Hint */}
                        <div className="text-[11px] text-muted-foreground/90 pt-1.5 border-t border-border/40 flex items-start gap-1.5">
                          <span className="font-medium text-foreground/80 shrink-0">
                            Next step:
                          </span>
                          <span className="leading-snug">
                            {band.pedagogyTip}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Calibration & Privacy Footnote */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-muted-foreground/80 pt-3 border-t border-border/60">
              <span className="flex items-center gap-1.5">
                <SparklesIcon className="size-3 text-primary shrink-0" aria-hidden="true" />
                Calibrated against elementary cursive penmanship standards (CCC benchmark dataset)
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/80">
                Press <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] border border-border">Esc</kbd> to close
              </span>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

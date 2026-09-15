"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  PenToolIcon,
  CompassIcon,
  SpaceIcon,
  MoveVerticalIcon,
  ScalingIcon,
  CpuIcon,
  EyeIcon,
  BookOpenIcon,
  GraduationCapIcon,
  SearchIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  PanelRightIcon,
  Maximize2Icon,
  RotateCcwIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RubricReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "dialog" | "docked";
}

type LayoutMode = "dialog" | "docked";

interface CriterionItem {
  id: string;
  name: string;
  engine: "CNN" | "OpenCV";
  engineType: "neural" | "cv";
  icon: typeof PenToolIcon;
  target: string;
  targetLabel: string;
  classroomStandard: string;
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
    classroomStandard: "Proper cursive loops and joining strokes without print-hybrid breaks",
    description:
      "Assesses stroke geometry, loop closure, and cursive joinery against the CCC cursive benchmark dataset using a fine-tuned CNN.",
    diagnosticFocus:
      "Malformed loops, disconnected joins, ambiguous letterforms, and irregular stroke transitions.",
    keywords: ["formation", "letter", "cnn", "loops", "joins", "neural", "morphology", "ccc", "cursive"],
  },
  {
    id: "slant",
    name: "Slant Angle",
    engine: "OpenCV",
    engineType: "cv",
    icon: CompassIcon,
    target: "Standard ~68° forward slant (60°–75° from horizontal baseline)",
    targetLabel: "60°–75° Slant (~68° Std)",
    classroomStandard: "Consistent forward lean (~68°) across all tall letters and ascenders",
    description:
      "Measures stroke orientation across ascending and descending stems using contour angle detection and line fitting relative to baseline.",
    diagnosticFocus:
      "Erratic tilt fluctuations, vertical rigidity (<60°), or excessive over-slanting (>75°).",
    keywords: ["slant", "angle", "opencv", "degree", "tilt", "inclination", "contour", "lean"],
  },
  {
    id: "spacing",
    name: "Spacing & Rhythm",
    engine: "OpenCV",
    engineType: "cv",
    icon: SpaceIcon,
    target: "Uniform letter gaps & ~1 letter width between words",
    targetLabel: "Uniform 1-Letter Gaps",
    classroomStandard: "Uniform 1-letter finger space between words; even gaps between letters",
    description:
      "Analyzes horizontal connected component distances, intra-word letter rhythm, and inter-word margin consistency.",
    diagnosticFocus:
      "Cramped letter joins, irregular word gaps, or disjointed stroke gaps within words.",
    keywords: ["spacing", "rhythm", "opencv", "gap", "distance", "connected", "margin", "finger space"],
  },
  {
    id: "baseline",
    name: "Baseline Alignment",
    engine: "OpenCV",
    engineType: "cv",
    icon: MoveVerticalIcon,
    target: "±2px deviation from writing guideline",
    targetLabel: "±2px Guideline Deviation",
    classroomStandard: "Letters resting flat on the bottom line without sagging or floating",
    description:
      "Detects worksheet guidelines and measures vertical baseline variance across each written word and line.",
    diagnosticFocus:
      "Undulating words, sagging letters, or floating text drifting off the bottom guide line.",
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
    classroomStandard: "Tall letters (l, b, h) touching headline; short letters (a, c, e) reaching dotted midline",
    description:
      "Calculates the ratio of lowercase body height (x-height) to ascender and descender heights across consecutive words.",
    diagnosticFocus:
      "Disproportionate lowercase letters, stunted ascender loops, or uneven vertical scale.",
    keywords: ["size", "consistency", "opencv", "ratio", "ascender", "descender", "x-height", "scale"],
  },
];

interface ScoringBandItem {
  band: string;
  level: string;
  range: string;
  dotColor: string;
  containerClass: string;
  desc: string;
}

const scoringBands: ScoringBandItem[] = [
  {
    band: "Excellent",
    level: "Band 4",
    range: "80–100%",
    dotColor: "bg-band-4",
    containerClass: "border-band-4/30 bg-band-4/5 dark:bg-band-4/10",
    desc: "Exemplary cursive discipline with fluid loop closures, uniform 60°–75° forward slant, and consistent baseline adherence.",
  },
  {
    band: "Satisfactory",
    level: "Band 3",
    range: "60–79%",
    dotColor: "bg-band-3",
    containerClass: "border-band-3/30 bg-band-3/5 dark:bg-band-3/10",
    desc: "Strong cursive legibility with minor spacing or slant variations on complex letter joins (b, k, f, z).",
  },
  {
    band: "Developing",
    level: "Band 2",
    range: "40–59%",
    dotColor: "bg-band-2",
    containerClass: "border-band-2/30 bg-band-2/5 dark:bg-band-2/10",
    desc: "Recognizable cursive structure with noticeable letterform irregularities, midline drift, or fluctuating slant.",
  },
  {
    band: "Needs Improvement",
    level: "Band 1",
    range: "0–39%",
    dotColor: "bg-band-1",
    containerClass: "border-band-1/30 bg-band-1/5 dark:bg-band-1/10",
    desc: "Frequent print-cursive hybrid strokes, disconnected joins, erratic slant angles, or significant baseline drift.",
  },
];

/**
 * CriterionVisualGuide: Lightweight SVG diagrams showing cursive penmanship
 * geometry on authentic 3-line elementary ruling (headline, dotted midline, baseline).
 */
const CriterionVisualGuide = React.memo(function CriterionVisualGuide({
  criterionId,
}: {
  criterionId: string;
}) {
  return (
    <div
      className="relative rounded-lg border border-border/70 bg-background/90 dark:bg-surface/80 p-2.5 overflow-hidden select-none"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
          <GraduationCapIcon className="size-3 text-primary" />
          Penmanship Geometry
        </span>
        <span className="text-[10px] font-sans text-muted-foreground tabular-nums">
          3-Line Ruling Standard
        </span>
      </div>

      <div className="w-full flex items-center justify-center rounded-md border border-border/50 py-1.5 px-3 bg-muted/20">
        {criterionId === "formation" && (
          <svg
            viewBox="0 0 240 50"
            className="w-full h-12 max-w-xs overflow-visible text-primary dark:text-brand-300"
            aria-label="Cursive letter formation loop diagram"
          >
            <line x1="10" y1="10" x2="230" y2="10" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
            <line x1="10" y1="25" x2="230" y2="25" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="10" y1="40" x2="230" y2="40" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.5" />

            <text x="12" y="8" fontSize="8" fill="currentColor" fillOpacity="0.8" fontFamily="sans-serif">Headline</text>
            <text x="12" y="23" fontSize="8" fill="currentColor" fillOpacity="0.8" fontFamily="sans-serif">Midline</text>
            <text x="12" y="47" fontSize="8" fill="currentColor" fillOpacity="0.8" fontFamily="sans-serif">Baseline</text>

            <path
              d="M 60 40 C 75 40, 85 10, 95 10 C 102 10, 96 30, 92 40 C 95 40, 105 25, 118 25 C 126 25, 126 38, 120 40 C 125 40, 135 40, 145 35"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="92" cy="40" r="3" fill="currentColor" />
            <circle cx="120" cy="40" r="3" fill="currentColor" />
            <text x="100" y="8" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">Closed Loop</text>
            <text x="130" y="16" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">Continuous Join</text>
          </svg>
        )}

        {criterionId === "slant" && (
          <svg
            viewBox="0 0 240 50"
            className="w-full h-12 max-w-xs overflow-visible text-primary dark:text-brand-300"
            aria-label="Cursive slant angle diagram"
          >
            <line x1="10" y1="10" x2="230" y2="10" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
            <line x1="10" y1="25" x2="230" y2="25" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="10" y1="40" x2="230" y2="40" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.5" />

            <line x1="90" y1="5" x2="90" y2="45" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 2" />
            <text x="92" y="9" fontSize="8" fill="currentColor" fillOpacity="0.8" fontFamily="sans-serif">90°</text>

            <polygon points="90,40 102,10 115,10" fill="currentColor" fillOpacity="0.15" />
            <line x1="90" y1="40" x2="108" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            <path
              d="M 65 40 L 77 10 M 130 40 L 142 10 M 165 40 L 177 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.85"
            />
            <rect x="120" y="15" width="102" height="17" rx="4" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeOpacity="0.3" />
            <text x="124" y="27" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">
              60°–75° Slant (~68° Std)
            </text>
          </svg>
        )}

        {criterionId === "spacing" && (
          <svg
            viewBox="0 0 240 50"
            className="w-full h-12 max-w-xs overflow-visible text-primary dark:text-brand-300"
            aria-label="Cursive spacing diagram"
          >
            <line x1="10" y1="10" x2="230" y2="10" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
            <line x1="10" y1="25" x2="230" y2="25" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="10" y1="40" x2="230" y2="40" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.5" />

            <path
              d="M 40 40 C 45 40, 50 25, 53 25 L 53 40 C 56 40, 60 25, 66 25 C 72 25, 72 40, 77 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="53" cy="20" r="1.5" fill="currentColor" />

            <line x1="78" y1="32" x2="114" y2="32" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
            <line x1="78" y1="28" x2="78" y2="36" stroke="currentColor" strokeWidth="1.2" />
            <line x1="114" y1="28" x2="114" y2="36" stroke="currentColor" strokeWidth="1.2" />
            <text x="81" y="27" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">1-Letter Gap</text>

            <path
              d="M 115 40 C 120 40, 125 15, 128 15 L 128 40 C 132 40, 138 25, 144 25 C 150 25, 150 40, 144 40 C 138 40, 138 25, 144 25 L 155 25"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line x1="123" y1="23" x2="133" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <text x="160" y="30" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">
              Uniform Space
            </text>
          </svg>
        )}

        {criterionId === "baseline" && (
          <svg
            viewBox="0 0 240 50"
            className="w-full h-12 max-w-xs overflow-visible text-primary dark:text-brand-300"
            aria-label="Cursive baseline alignment diagram"
          >
            <line x1="10" y1="10" x2="230" y2="10" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
            <line x1="10" y1="25" x2="230" y2="25" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 3" />

            <rect x="10" y="38" width="220" height="4" fill="currentColor" fillOpacity="0.2" />
            <line x1="10" y1="40" x2="230" y2="40" stroke="currentColor" strokeWidth="1.8" />

            <path
              d="M 45 40 C 48 25, 54 25, 58 40 C 62 25, 68 25, 72 40 M 72 40 C 76 25, 82 25, 85 40 M 85 40 C 90 25, 96 25, 99 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="58" cy="40" r="2.2" fill="currentColor" />
            <circle cx="72" cy="40" r="2.2" fill="currentColor" />
            <circle cx="85" cy="40" r="2.2" fill="currentColor" />
            <circle cx="99" cy="40" r="2.2" fill="currentColor" />

            <text x="126" y="37" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">
              ±2px Writing Guideline Tolerance
            </text>
            <text x="126" y="46" fontSize="7.5" fill="currentColor" fillOpacity="0.85" fontFamily="sans-serif">
              Anchored along bottom guideline
            </text>
          </svg>
        )}

        {criterionId === "size" && (
          <svg
            viewBox="0 0 240 50"
            className="w-full h-12 max-w-xs overflow-visible text-primary dark:text-brand-300"
            aria-label="Cursive size consistency diagram"
          >
            <line x1="10" y1="10" x2="230" y2="10" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
            <line x1="10" y1="25" x2="230" y2="25" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="10" y1="40" x2="230" y2="40" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.5" />

            <path
              d="M 50 40 C 60 40, 68 10, 74 10 C 80 10, 74 30, 72 40 C 78 40, 84 25, 84 32 C 84 40, 74 40, 72 40 L 92 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M 95 40 C 100 40, 106 25, 112 25 C 118 25, 118 40, 112 40 C 106 40, 106 25, 112 25 L 118 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />

            <line x1="42" y1="10" x2="42" y2="40" stroke="currentColor" strokeWidth="1" />
            <text x="26" y="27" fontSize="8.5" fill="currentColor" fontWeight="700" fontFamily="sans-serif">2x</text>

            <line x1="126" y1="25" x2="126" y2="40" stroke="currentColor" strokeWidth="1" />
            <text x="132" y="34" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">1x (x-height)</text>

            <rect x="150" y="15" width="86" height="17" rx="4" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeOpacity="0.3" />
            <text x="156" y="27" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">
              2:1 Height Ratio
            </text>
          </svg>
        )}
      </div>
    </div>
  );
});

export function RubricReferenceDialog({
  open,
  onOpenChange,
  defaultMode = "dialog",
}: RubricReferenceDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(defaultMode);
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search on '/' hotkey
  useEffect(() => {
    if (!open) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        e.key === "/" &&
        document.activeElement !== searchInputRef.current &&
        !(
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement ||
          (document.activeElement as HTMLElement)?.isContentEditable
        )
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [open]);

  const filteredCriteria = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return criteria;
    return criteria.filter((item) => (
      item.name.toLowerCase().includes(q) ||
      item.target.toLowerCase().includes(q) ||
      item.targetLabel.toLowerCase().includes(q) ||
      item.classroomStandard.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.diagnosticFocus.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q))
    ));
  }, [searchQuery]);

  // When search query is entered, auto-expand matching criteria
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    const q = val.trim().toLowerCase();
    if (q) {
      const matchingIds = criteria
        .filter((item) => (
          item.name.toLowerCase().includes(q) ||
          item.target.toLowerCase().includes(q) ||
          item.targetLabel.toLowerCase().includes(q) ||
          item.classroomStandard.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.diagnosticFocus.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.includes(q))
        ))
        .map((c) => c.id);
      setExpandedCriteria(new Set(matchingIds));
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  // Toggle single item
  const toggleCriterion = (id: string) => {
    setExpandedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle all visible/filtered items
  const allExpanded =
    filteredCriteria.length > 0 &&
    filteredCriteria.every((c) => expandedCriteria.has(c.id));

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedCriteria((prev) => {
        const next = new Set(prev);
        filteredCriteria.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setExpandedCriteria((prev) => {
        const next = new Set(prev);
        filteredCriteria.forEach((c) => next.add(c.id));
        return next;
      });
    }
  };


  const filteredBands = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return scoringBands;
    return scoringBands.filter((band) => (
      band.band.toLowerCase().includes(q) ||
      band.level.toLowerCase().includes(q) ||
      band.desc.toLowerCase().includes(q) ||
      band.range.toLowerCase().includes(q)
    ));
  }, [searchQuery]);

  const isDocked = layoutMode === "docked";

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={!isDocked}>
      <DialogContent
        overlayClassName={
          isDocked
            ? "pointer-events-none bg-transparent opacity-0 supports-backdrop-filter:backdrop-blur-none"
            : "bg-foreground/25 supports-backdrop-filter:backdrop-blur-xs"
        }
        className={cn(
          "p-0 overflow-hidden flex flex-col gap-0 shadow-warm transition-[opacity,transform,width] duration-200 ease-out motion-reduce:transition-none",
          isDocked
            ? "fixed top-0 right-0 left-auto bottom-0 translate-x-0 translate-y-0 h-dvh max-h-dvh w-full sm:w-[480px] md:w-[520px] rounded-none sm:rounded-l-2xl border-y-0 border-r-0 border-l border-border shadow-2xl z-50 pointer-events-auto"
            : "w-[calc(100%-1.5rem)] sm:max-w-2xl max-h-[min(90dvh,calc(100vh-2rem))] rounded-2xl"
        )}
      >
        {/* Streamlined Header: Title + Search + Actions */}
        <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-3.5 border-b border-border/70 bg-background/95 backdrop-blur-xs shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3 pr-10 sm:pr-8">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="size-8 sm:size-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs"
                aria-hidden="true"
              >
                <BookOpenIcon className="size-4 sm:size-4.5" />
              </div>
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-heading font-semibold text-foreground tracking-tight">
                  Handwriting Rubric Guide
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] h-5 px-1.5 font-medium bg-muted/60 text-muted-foreground border-border/60"
                >
                  Grade 3 DepEd
                </Badge>
              </div>
            </div>

            {/* Layout Mode Toggle */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setLayoutMode(isDocked ? "dialog" : "docked")}
                className="hidden sm:inline-flex size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer transition-colors"
                title={isDocked ? "Switch to centered dialog" : "Dock to side"}
                aria-label={isDocked ? "Switch to centered dialog" : "Dock to side"}
                aria-pressed={isDocked}
              >
                {isDocked ? (
                  <Maximize2Icon className="size-3.5" aria-hidden="true" />
                ) : (
                  <PanelRightIcon className="size-3.5" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          <DialogDescription className="sr-only">
            Objective criteria and scoring bands for Grade 3 cursive handwriting assessment.
          </DialogDescription>

          {/* Quick Search with Live Region */}
          <div role="search" aria-label="Search rubric criteria and bands" className="relative w-full">
            <label htmlFor="rubric-search-input" className="sr-only">
              Filter rubric criteria or scoring bands
            </label>
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/70 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="rubric-search-input"
              ref={searchInputRef}
              type="search"
              placeholder="Search criteria or bands... (Press '/' to focus)"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && searchQuery) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClearSearch();
                }
              }}
              className="w-full h-10 sm:h-9 pl-8 pr-9 text-base sm:text-xs rounded-lg border border-border/80 bg-background placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-1 top-1/2 -translate-y-1/2 size-10 sm:size-7 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Clear search"
              >
                <XCircleIcon className="size-3.5" />
              </button>
            )}
          </div>
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {searchQuery.trim()
              ? `${filteredCriteria.length} diagnostic criteria and ${filteredBands.length} scoring bands match "${searchQuery}"`
              : "Showing all diagnostic criteria and scoring bands"}
          </div>
        </DialogHeader>

        {/* Scrollable Body: Clean & Unified Single View */}
        <ScrollArea className="flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-6">
            {/* Section 1: Assessment Criteria */}
            <section aria-labelledby="criteria-heading" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3
                    id="criteria-heading"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Diagnostic Criteria
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-sans tabular-nums">
                    ({filteredCriteria.length})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={toggleAll}
                  aria-expanded={allExpanded}
                  className="min-h-10 sm:min-h-0 py-2 sm:py-1 px-2.5 sm:px-1.5 -mr-1.5 text-xs sm:text-[11px] text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1.5 cursor-pointer rounded-md hover:bg-primary/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <ChevronsUpDownIcon className="size-3" aria-hidden="true" />
                  <span>{allExpanded ? "Collapse all" : "Expand all"}</span>
                </button>
              </div>

              {filteredCriteria.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-border/80 bg-muted/20 space-y-3">
                  <p className="text-xs font-medium text-foreground">No criteria match your search</p>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-8 px-4 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <RotateCcwIcon className="size-3" aria-hidden="true" />
                    Reset search
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCriteria.map((item) => {
                    const Icon = item.icon;
                    const isExpanded = expandedCriteria.has(item.id);

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-xl border transition-all duration-150 overflow-hidden",
                          isExpanded
                            ? "border-primary/30 bg-card shadow-xs"
                            : "border-border/70 bg-card/60 hover:bg-card hover:border-border"
                        )}
                      >
                        {/* Summary Header (Collapsed view) */}
                        <h4 className="m-0 p-0 font-normal">
                          <button
                            id={`criterion-header-${item.id}`}
                            type="button"
                            onClick={() => toggleCriterion(item.id)}
                            aria-expanded={isExpanded}
                            aria-controls={isExpanded ? `criterion-panel-${item.id}` : undefined}
                            className="w-full flex items-center justify-between p-3 sm:p-3.5 text-left transition-colors gap-3 cursor-pointer select-none rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="size-7 sm:size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-2xs"
                                aria-hidden="true"
                              >
                                <Icon className="size-3.5 sm:size-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-foreground tracking-tight">
                                    {item.name}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] h-4.5 px-1.5 font-normal bg-muted text-muted-foreground border border-border/40"
                                  >
                                    {item.engine === "CNN" ? (
                                      <CpuIcon className="size-2.5 mr-0.5 text-primary" />
                                    ) : (
                                      <EyeIcon className="size-2.5 mr-0.5 text-primary" />
                                    )}
                                    {item.engine}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                  {item.classroomStandard}
                                </p>
                              </div>
                            </div>

                            <ChevronDownIcon
                              className={cn(
                                "size-4 text-muted-foreground shrink-0 transition-transform duration-200",
                                isExpanded && "rotate-180 text-primary"
                              )}
                              aria-hidden="true"
                            />
                          </button>
                        </h4>

                        {/* Expanded Detail Panel (Hidden by default) */}
                        {isExpanded && (
                          <div
                            id={`criterion-panel-${item.id}`}
                            role="region"
                            aria-labelledby={`criterion-header-${item.id}`}
                            className="px-3 sm:px-4 pb-3.5 pt-1 border-t border-border/50 space-y-3 bg-muted/10"
                          >
                            {/* Target Standard Pill */}
                            <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
                              <span className="text-muted-foreground font-medium">Target Standard:</span>
                              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold text-[11px] border border-primary/20">
                                {item.targetLabel}
                              </span>
                            </div>

                            {/* Penmanship SVG Diagram Guide */}
                            <CriterionVisualGuide criterionId={item.id} />

                            {/* Concise Technical & Detection Details */}
                            <div className="text-xs text-muted-foreground leading-relaxed space-y-1 bg-muted/30 p-2.5 rounded-lg border border-border/40">
                              <p>
                                <span className="font-medium text-foreground">Technical: </span>
                                {item.description}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Detects: </span>
                                {item.diagnosticFocus}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Section 2: Qualitative Scoring Bands */}
            <section aria-labelledby="bands-heading" className="space-y-3 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between gap-2">
                <h3
                  id="bands-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Qualitative Scoring Bands
                </h3>
                <span className="text-[11px] text-muted-foreground font-sans tabular-nums">
                  4-Tier Scale
                </span>
              </div>

              {filteredBands.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-border/80 bg-muted/20 space-y-3">
                  <p className="text-xs font-medium text-foreground">No bands match your search</p>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-8 px-4 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <RotateCcwIcon className="size-3" aria-hidden="true" />
                    Reset search
                  </button>
                </div>
              ) : (
                <div
                  role="list"
                  aria-label="Qualitative scoring developmental bands"
                  className={cn(
                    "grid gap-2.5",
                    isDocked ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
                  )}
                >
                  {filteredBands.map((band) => (
                    <div
                      key={band.band}
                      role="listitem"
                      className={cn(
                        "p-3 rounded-xl border transition-colors space-y-1.5",
                        band.containerClass
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={cn("size-2 rounded-full shrink-0", band.dotColor)}
                            aria-hidden="true"
                          />
                          <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                            {band.band}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-sans whitespace-nowrap">
                            ({band.level})
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-foreground/90 font-sans tabular-nums shrink-0 whitespace-nowrap">
                          {band.range}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {band.desc}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

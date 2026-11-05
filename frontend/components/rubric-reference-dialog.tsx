"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SearchIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  RotateCcwIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RubricReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "teacher" | "parent";
  showScoreDetails?: boolean;
  onToggleScoreDetails?: () => void;
}

interface CriterionItem {
  id: string;
  name: string;
  category: string;
  target: string;
  targetLabel: string;
  parentTargetLabel: string;
  classroomStandard: string;
  description: string;
  parentDescription: string;
  diagnosticFocus: string;
  parentFocus: string;
  keywords: string[];
}

const criteria: CriterionItem[] = [
  {
    id: "formation",
    name: "Letter Formation",
    category: "Shape & Joins",
    target: "Clear loops, proper cursive joins, legible character structure",
    targetLabel: "Morphology & Joins",
    parentTargetLabel: "Smooth Loops & Joins",
    classroomStandard: "Proper cursive loops and joining strokes without print breaks",
    description:
      "Evaluates letter shape, loop closure, and proper cursive connections between characters.",
    parentDescription:
      "Checks that letters have clear cursive shapes, closed loops, and smooth connecting strokes from letter to letter.",
    diagnosticFocus:
      "Malformed loops, disconnected joins, ambiguous letterforms, and irregular stroke transitions.",
    parentFocus:
      "Open or pinched loops, broken joins between letters, or mixing print and cursive letters.",
    keywords: ["formation", "letter", "loops", "joins", "morphology", "cursive"],
  },
  {
    id: "slant",
    name: "Slant",
    category: "Forward Lean",
    target: "Standard ~68° forward slant (60°–75° from horizontal baseline)",
    targetLabel: "60°–75° Slant (~68° Std)",
    parentTargetLabel: "Steady Forward Tilt",
    classroomStandard: "Consistent, comfortable forward lean across all tall letters",
    description:
      "Measures stroke angle and forward lean across letters relative to the writing baseline.",
    parentDescription:
      "Checks that letters lean forward in the same direction across the word instead of tipping back and forth.",
    diagnosticFocus:
      "Erratic tilt fluctuations, vertical rigidity (<60°), or excessive over-slanting (>75°).",
    parentFocus:
      "Letters leaning in different directions within the same word or line.",
    keywords: ["slant", "angle", "degree", "tilt", "inclination", "lean"],
  },
  {
    id: "spacing",
    name: "Spacing",
    category: "Gaps & Rhythm",
    target: "Uniform letter gaps & ~1 letter width between words",
    targetLabel: "Uniform 1-Letter Gaps",
    parentTargetLabel: "Even Finger Spacing",
    classroomStandard: "Even space between letters and about one finger-width between words",
    description:
      "Measures horizontal spacing between letters within words and consistent finger spacing between words.",
    parentDescription:
      "Checks that letters aren't crowded together and that words have an even, readable gap between them.",
    diagnosticFocus:
      "Cramped letter joins, irregular word gaps, or disjointed stroke gaps within words.",
    parentFocus:
      "Words bunched too close together or stretched too far apart.",
    keywords: ["spacing", "rhythm", "gap", "distance", "margin", "finger space"],
  },
  {
    id: "baseline",
    name: "Baseline Alignment",
    category: "Staying on the Line",
    target: "±2px deviation from writing guideline",
    targetLabel: "±2px Guideline Deviation",
    parentTargetLabel: "Rests on the Bottom Line",
    classroomStandard: "Letters resting flat on the bottom writing line without floating or dipping",
    description:
      "Evaluates vertical placement of letters along the bottom writing guideline.",
    parentDescription:
      "Checks that the bottoms of letters sit steadily along the solid bottom writing line.",
    diagnosticFocus:
      "Undulating words, sagging letters, or floating text drifting off the bottom guide line.",
    parentFocus:
      "Words floating above the bottom line or dipping below it.",
    keywords: ["baseline", "alignment", "guideline", "variance", "drift", "undulating"],
  },
  {
    id: "size",
    name: "Size Consistency",
    category: "Letter Height",
    target: "2:1 ratio for ascenders/descenders vs. x-height",
    targetLabel: "2:1 Ascender/x-Height Ratio",
    parentTargetLabel: "Even Letter Height",
    classroomStandard: "Tall letters (l, b, h) reach the top line; small letters (a, c, e) reach the dotted middle line",
    description:
      "Calculates the height ratio of lowercase letter bodies relative to tall ascenders and descenders.",
    parentDescription:
      "Checks that small letters stay neatly under the dotted middle line while tall letters reach the top line.",
    diagnosticFocus:
      "Disproportionate lowercase letters, stunted ascender loops, or uneven vertical scale.",
    parentFocus:
      "Letters shrinking or growing unevenly across a word.",
    keywords: ["size", "consistency", "ratio", "ascender", "descender", "x-height", "scale"],
  },
];

interface ScoringBandItem {
  band: string;
  level: string;
  range: string;
  dotColor: string;
  containerClass: string;
  desc: string;
  parentDesc: string;
}

const scoringBands: ScoringBandItem[] = [
  {
    band: "Excellent",
    level: "Band 4",
    range: "75–100%",
    dotColor: "bg-band-4",
    containerClass: "border-band-4/30 bg-band-4/5 dark:bg-band-4/10",
    desc: "Exemplary cursive discipline with fluid loop closures, uniform 60°–75° forward slant, and consistent baseline adherence.",
    parentDesc: "Smooth, steady cursive handwriting with consistent letter shapes, spacing, and alignment across the worksheet.",
  },
  {
    band: "Satisfactory",
    level: "Band 3",
    range: "50–74%",
    dotColor: "bg-band-3",
    containerClass: "border-band-3/30 bg-band-3/5 dark:bg-band-3/10",
    desc: "Strong cursive legibility with minor spacing or slant variations on complex letter joins (b, k, f, z).",
    parentDesc: "Easy-to-read cursive with a solid foundation and only small spots to polish on trickier letters.",
  },
  {
    band: "Developing",
    level: "Band 2",
    range: "25–49%",
    dotColor: "bg-band-2",
    containerClass: "border-band-2/30 bg-band-2/5 dark:bg-band-2/10",
    desc: "Recognizable cursive structure with noticeable letterform irregularities, midline drift, or fluctuating slant.",
    parentDesc: "Actively building cursive muscle memory — letter shapes are coming together and will steady with practice.",
  },
  {
    band: "Needs Improvement",
    level: "Band 1",
    range: "0–24%",
    dotColor: "bg-band-1",
    containerClass: "border-band-1/30 bg-band-1/5 dark:bg-band-1/10",
    desc: "Frequent print-cursive hybrid strokes, disconnected joins, erratic slant angles, or significant baseline drift.",
    parentDesc: "Starting out with basic cursive strokes and letter joins — guided tracing and slow practice help most here.",
  },
];

const CriterionVisualGuide = React.memo(function CriterionVisualGuide({
  criterionId,
  isParent,
}: {
  criterionId: string;
  isParent: boolean;
}) {
  return (
    <div
      className="relative rounded-lg border border-border/70 bg-background/90 dark:bg-surface/80 p-2.5 overflow-hidden select-none"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-sans font-semibold text-primary">
          {isParent ? "On 3-Line Paper" : "Penmanship Geometry"}
        </span>
        <span className="text-xs font-sans text-muted-foreground tabular-nums">
          {isParent ? "Top · Middle · Bottom" : "3-Line Ruling Standard"}
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

            <text x="12" y="8" fontSize="8" fill="currentColor" fillOpacity="0.8" fontFamily="sans-serif">Top</text>
            <text x="12" y="23" fontSize="8" fill="currentColor" fillOpacity="0.8" fontFamily="sans-serif">Middle</text>
            <text x="12" y="47" fontSize="8" fill="currentColor" fillOpacity="0.8" fontFamily="sans-serif">Bottom</text>

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
            <text x="130" y="16" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">Smooth Join</text>
          </svg>
        )}

        {criterionId === "slant" && (
          <svg
            viewBox="0 0 240 50"
            className="w-full h-12 max-w-xs overflow-visible text-primary dark:text-brand-300"
            aria-label="Cursive slant diagram"
          >
            <line x1="10" y1="10" x2="230" y2="10" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
            <line x1="10" y1="25" x2="230" y2="25" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="10" y1="40" x2="230" y2="40" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.5" />

            <line x1="90" y1="5" x2="90" y2="45" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 2" />

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
            <text x="126" y="27" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">
              {isParent ? "Same Forward Tilt" : "60°–75° Slant (~68° Std)"}
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
            <text x="80" y="27" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">1 Finger</text>

            <path
              d="M 115 40 C 120 40, 125 15, 128 15 L 128 40 C 132 40, 138 25, 144 25 C 150 25, 150 40, 144 40 C 138 40, 138 25, 144 25 L 155 25"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line x1="123" y1="23" x2="133" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <text x="160" y="30" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">
              Even Space
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

            <text x="120" y="37" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">
              {isParent ? "Sits on Bottom Line" : "±2px Guideline Tolerance"}
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

            <rect x="140" y="15" width="94" height="17" rx="4" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeOpacity="0.3" />
            <text x="146" y="27" fontSize="8" fill="currentColor" fontWeight="700" fontFamily="sans-serif">
              {isParent ? "Tall vs. Small Height" : "2:1 Height Ratio"}
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
  variant = "teacher",
  showScoreDetails: controlledShowDetails,
  onToggleScoreDetails,
}: RubricReferenceDialogProps) {
  const isParent = variant === "parent";
  const [internalShowDetails, setInternalShowDetails] = useState(!isParent);
  const showScoreDetails =
    controlledShowDetails !== undefined ? controlledShowDetails : internalShowDetails;
  const toggleScoreDetails =
    onToggleScoreDetails || (() => setInternalShowDetails((prev) => !prev));

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      item.parentTargetLabel.toLowerCase().includes(q) ||
      item.classroomStandard.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.parentDescription.toLowerCase().includes(q) ||
      item.diagnosticFocus.toLowerCase().includes(q) ||
      item.parentFocus.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q))
    ));
  }, [searchQuery]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    const q = val.trim().toLowerCase();
    if (q) {
      const matchingIds = criteria
        .filter((item) => (
          item.name.toLowerCase().includes(q) ||
          item.target.toLowerCase().includes(q) ||
          item.targetLabel.toLowerCase().includes(q) ||
          item.parentTargetLabel.toLowerCase().includes(q) ||
          item.classroomStandard.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.parentDescription.toLowerCase().includes(q) ||
          item.diagnosticFocus.toLowerCase().includes(q) ||
          item.parentFocus.toLowerCase().includes(q) ||
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

  const toggleCriterion = (id: string) => {
    setExpandedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
      band.parentDesc.toLowerCase().includes(q) ||
      band.range.toLowerCase().includes(q)
    ));
  }, [searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="rubric-reference-dialog"
        overlayClassName="bg-foreground/25 supports-backdrop-filter:backdrop-blur-xs"
        className="p-0 overflow-hidden flex flex-col gap-0 shadow-warm w-[calc(100%-1.5rem)] sm:max-w-2xl max-h-[min(90dvh,calc(100vh-2rem))] rounded-2xl"
      >
        <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-3.5 border-b border-border/70 bg-background/95 backdrop-blur-xs shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-2 min-w-0 pr-10 sm:pr-8">
            <DialogTitle className="text-base sm:text-lg font-heading font-semibold text-foreground tracking-tight">
              {isParent ? "How Scores Work" : "Scoring Rubric"}
            </DialogTitle>
            {isParent && (
              <button
                type="button"
                onClick={toggleScoreDetails}
                aria-pressed={showScoreDetails}
                className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg px-2.5 py-1 min-h-[40px] sm:min-h-[36px] inline-flex items-center justify-center border border-brand-200/70 dark:border-brand-800/70 bg-brand-50/50 dark:bg-brand-950/30 transition-colors shrink-0 touch-manipulation"
              >
                {showScoreDetails ? "Hide details" : "Show details"}
              </button>
            )}
          </div>

          <DialogDescription className="sr-only">
            Handwriting skills and developmental score levels used in WriteWise.
          </DialogDescription>

          <div role="search" aria-label="Search skills and score levels" className="relative w-full">
            <label htmlFor="rubric-search-input" className="sr-only">
              Search skills or score levels
            </label>
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/70 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="rubric-search-input"
              ref={searchInputRef}
              type="search"
              placeholder={isParent ? "Search skills or score levels..." : "Search criteria or bands... (Press '/' to focus)"}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && searchQuery) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClearSearch();
                }
              }}
              className="w-full h-10 sm:h-9 pl-8 pr-9 text-base sm:text-sm rounded-lg border border-border/80 bg-background placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all [&::-webkit-search-cancel-button]:hidden"
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
              ? `${filteredCriteria.length} skills and ${filteredBands.length} levels match "${searchQuery}"`
              : "Showing all handwriting skills and score levels"}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain focus-visible:outline-none">
          <div className="p-4 sm:p-5 space-y-6">
            {/* Section 1: 5 Handwriting Skills */}
            <section aria-labelledby="criteria-heading" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3
                    id="criteria-heading"
                    className="text-sm font-heading font-semibold text-foreground"
                  >
                    {isParent ? "5 Handwriting Skills" : "Diagnostic Criteria"}
                  </h3>
                  <span className="text-xs text-muted-foreground font-sans tabular-nums">
                    ({filteredCriteria.length})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={toggleAll}
                  aria-expanded={allExpanded}
                  className="min-h-10 sm:min-h-0 py-2 sm:py-1 px-2.5 sm:px-1.5 -mr-1.5 text-xs text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1.5 cursor-pointer rounded-md hover:bg-primary/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <ChevronsUpDownIcon className="size-3.5" aria-hidden="true" />
                  <span>{allExpanded ? "Collapse all" : "Expand all"}</span>
                </button>
              </div>

              {filteredCriteria.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-border/80 bg-muted/20 space-y-3">
                  <p className="text-sm font-medium text-foreground">No skills match your search</p>
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
                        <h4 className="m-0 p-0 font-normal">
                          <button
                            id={`criterion-header-${item.id}`}
                            type="button"
                            onClick={() => toggleCriterion(item.id)}
                            aria-expanded={isExpanded}
                            aria-controls={isExpanded ? `criterion-panel-${item.id}` : undefined}
                            className="w-full flex items-center justify-between p-3.5 text-left transition-colors gap-3 cursor-pointer select-none rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="min-w-0">
                                <span className="text-sm font-semibold text-foreground tracking-tight block">
                                  {item.name}
                                </span>
                                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 mt-0.5">
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

                        {isExpanded && (
                          <div
                            id={`criterion-panel-${item.id}`}
                            role="region"
                            aria-labelledby={`criterion-header-${item.id}`}
                            className="px-3.5 sm:px-4 pb-4 pt-1 border-t border-border/50 space-y-3 bg-muted/10"
                          >
                            <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
                              <span className="text-muted-foreground font-medium">Goal:</span>
                              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
                                {isParent ? item.parentTargetLabel : item.targetLabel}
                              </span>
                            </div>

                            <CriterionVisualGuide criterionId={item.id} isParent={isParent} />

                            <div className="text-sm text-muted-foreground leading-relaxed space-y-1.5 bg-muted/30 p-3 rounded-lg border border-border/40">
                              <p>
                                <span className="font-semibold text-foreground">
                                  {isParent ? "What we check: " : "Technical: "}
                                </span>
                                {isParent ? item.parentDescription : item.description}
                              </p>
                              <p>
                                <span className="font-semibold text-foreground">
                                  {isParent ? "Common things to practice: " : "Detects: "}
                                </span>
                                {isParent ? item.parentFocus : item.diagnosticFocus}
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

            {/* Section 2: Score Levels */}
            <section aria-labelledby="bands-heading" className="space-y-3 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between gap-2">
                <h3
                  id="bands-heading"
                  className="text-sm font-heading font-semibold text-foreground"
                >
                  {isParent ? "4 Score Levels" : "Qualitative Scoring Bands"}
                </h3>
                <span className="text-xs text-muted-foreground font-sans tabular-nums">
                  4 Levels
                </span>
              </div>

              {filteredBands.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-border/80 bg-muted/20 space-y-3">
                  <p className="text-sm font-medium text-foreground">No levels match your search</p>
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
                  aria-label="Handwriting score levels"
                  className="grid gap-2.5 grid-cols-1 sm:grid-cols-2"
                >
                  {filteredBands.map((band) => (
                    <div
                      key={band.band}
                      role="listitem"
                      className={cn(
                        "p-3.5 rounded-xl border transition-colors space-y-1.5",
                        band.containerClass
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn("size-2.5 rounded-full shrink-0", band.dotColor)}
                            aria-hidden="true"
                          />
                          <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                            {band.band}
                          </span>
                          {!isParent && (
                            <span className="text-xs text-muted-foreground font-sans whitespace-nowrap">
                              ({band.level})
                            </span>
                          )}
                        </div>
                        {(!isParent || showScoreDetails) && (
                          <span className="text-xs font-semibold text-foreground/90 font-sans tabular-nums shrink-0 whitespace-nowrap">
                            {band.range}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {isParent ? band.parentDesc : band.desc}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

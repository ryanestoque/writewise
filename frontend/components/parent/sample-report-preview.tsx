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
  CheckCircle2,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SampleReportPreviewProps {
  onOpenRubric: () => void;
}

const SAMPLE_CRITERION_DATA: Record<
  CriterionKey,
  {
    score: number;
    band: "satisfactory" | "excellent";
    icon: typeof Ruler;
  }
> = {
  letter_formation: {
    score: 88,
    band: "satisfactory",
    icon: Layers,
  },
  size_consistency: {
    score: 85,
    band: "satisfactory",
    icon: MoveVertical,
  },
  spacing: {
    score: 92,
    band: "excellent",
    icon: Maximize2,
  },
  slant: {
    score: 82,
    band: "satisfactory",
    icon: Compass,
  },
  baseline_alignment: {
    score: 89,
    band: "satisfactory",
    icon: Ruler,
  },
};

export function SampleReportPreview({
  onOpenRubric,
}: SampleReportPreviewProps) {
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
      {/* Header bar with domain badge */}
      <div className="p-5 sm:p-6 border-b border-border/60 bg-muted/20 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2
                id="sample-report-heading"
                className="font-heading text-base sm:text-lg font-bold text-foreground"
              >
                Sample Assessment Preview
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-100/80 dark:bg-brand-950/80 text-brand-800 dark:text-brand-200 border border-brand-200/70 dark:border-brand-800/70 shadow-2xs">
                Interactive Example
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Tap any of the 5 cursive skills below to preview how WriteWise evaluates letter strokes and provides practical home practice tips.
            </p>
          </div>
        </div>

        {/* 5-Criterion Interactive Selector Chips */}
        <div
          role="tablist"
          aria-label="Cursive diagnostic criteria"
          className="flex flex-wrap gap-1.5 sm:gap-2 pt-3"
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
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer border select-none min-h-[40px] sm:min-h-[36px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                  isSelected
                    ? "bg-brand-600 text-white border-brand-600 shadow-xs dark:bg-brand-500 dark:border-brand-500 font-semibold"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/60 border-border/80"
                )}
              >
                <Icon className={cn("size-3.5 shrink-0", isSelected ? "text-white" : "text-brand-600 dark:text-brand-400")} aria-hidden="true" />
                <span>{criterion.label}</span>
                <span className={cn(
                  "font-sans tabular-nums text-[11px] font-semibold px-1.5 py-0.2 rounded-sm",
                  isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {data.score}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Simulated Ruled Worksheet with Geometric Guide Lines */}
        <div className="lg:col-span-7 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">
                Worksheet Sample: &ldquo;The quick brown fox&rdquo;
              </span>
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <Eye className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                Showing {currentMeta.label} overlay
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Authentic 3-color penmanship ruling: Headline (top), Midline (dotted teal), and Baseline (rust).
            </p>
          </div>

          {/* SVG Handwriting Canvas with Diagnostic Overlays */}
          <div className="relative rounded-xl border border-border/80 bg-background/80 dark:bg-muted/20 p-4 sm:p-5 overflow-hidden shadow-2xs">
            <svg
              viewBox="0 0 540 180"
              className="w-full h-auto select-none"
              aria-label={`Sample handwriting illustration with ${currentMeta.label} guidelines`}
              role="img"
            >
              {/* Ruled Penmanship Guide Lines */}
              {/* Top Ascender Headline (Slate Gray) */}
              <line x1="20" y1="35" x2="520" y2="35" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
              <text x="22" y="30" fill="#64748b" fontSize="8" fontFamily="sans-serif" opacity="0.7">Headline (Ascender)</text>

              {/* Midline / x-height (Teal Dotted) */}
              <line x1="20" y1="85" x2="520" y2="85" stroke="#1b6b63" strokeWidth="1.25" strokeDasharray="4 4" opacity="0.8" />
              <text x="22" y="80" fill="#1b6b63" fontSize="8" fontFamily="sans-serif" opacity="0.8">Midline (x-height)</text>

              {/* Solid Baseline (Rust / Terracotta) */}
              <line x1="20" y1="135" x2="520" y2="135" stroke="#9c4a2f" strokeWidth="1.5" opacity="0.85" />
              <text x="22" y="147" fill="#9c4a2f" fontSize="8" fontFamily="sans-serif" opacity="0.85">Baseline</text>

              {/* Descender Guide Line */}
              <line x1="20" y1="165" x2="520" y2="165" stroke="#64748b" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.4" />

              {/* Dynamic Criterion Overlays */}
              {activeCriterion === "slant" && (
                <g className="animate-in fade-in duration-300">
                  {/* 68° Forward Leaning Guide Lines through Letter Stems */}
                  <line x1="75" y1="145" x2="115" y2="25" stroke="#1b6b63" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                  <line x1="140" y1="145" x2="180" y2="25" stroke="#1b6b63" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                  <line x1="210" y1="145" x2="250" y2="25" stroke="#1b6b63" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                  <line x1="310" y1="145" x2="350" y2="25" stroke="#1b6b63" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                  <line x1="420" y1="145" x2="460" y2="25" stroke="#1b6b63" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />

                  {/* Slant Angle Callout Badge */}
                  <rect x="250" y="15" width="80" height="18" rx="4" fill="#1b6b63" opacity="0.9" />
                  <text x="290" y="27" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                    68° Target Slant
                  </text>
                </g>
              )}

              {activeCriterion === "baseline_alignment" && (
                <g className="animate-in fade-in duration-300">
                  {/* Seating contact highlight along the baseline */}
                  <line x1="45" y1="135" x2="495" y2="135" stroke="#22c55e" strokeWidth="3" opacity="0.4" />
                  {/* Contact point nodes */}
                  <circle cx="85" cy="135" r="3.5" fill="#22c55e" stroke="#ffffff" strokeWidth="1.5" />
                  <circle cx="155" cy="135" r="3.5" fill="#22c55e" stroke="#ffffff" strokeWidth="1.5" />
                  <circle cx="230" cy="135" r="3.5" fill="#22c55e" stroke="#ffffff" strokeWidth="1.5" />
                  <circle cx="340" cy="135" r="3.5" fill="#22c55e" stroke="#ffffff" strokeWidth="1.5" />
                  <circle cx="445" cy="135" r="3.5" fill="#22c55e" stroke="#ffffff" strokeWidth="1.5" />

                  <rect x="360" y="145" width="125" height="18" rx="4" fill="#15803d" opacity="0.9" />
                  <text x="422" y="157" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                    Secure Baseline Seating
                  </text>
                </g>
              )}

              {activeCriterion === "size_consistency" && (
                <g className="animate-in fade-in duration-300">
                  {/* Midline-to-Baseline x-height highlight band */}
                  <rect x="40" y="85" width="460" height="50" fill="#1b6b63" opacity="0.08" />
                  {/* Height measurement arrows */}
                  <line x1="125" y1="88" x2="125" y2="132" stroke="#1b6b63" strokeWidth="2" markerEnd="url(#arrow)" />
                  <line x1="265" y1="88" x2="265" y2="132" stroke="#1b6b63" strokeWidth="2" />
                  <rect x="180" y="75" width="95" height="18" rx="4" fill="#1b6b63" opacity="0.9" />
                  <text x="227" y="87" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                    Uniform x-Height (100%)
                  </text>
                </g>
              )}

              {activeCriterion === "spacing" && (
                <g className="animate-in fade-in duration-300">
                  {/* Inter-word spacing guides */}
                  <rect x="135" y="80" width="30" height="55" fill="#3b82f6" opacity="0.12" rx="3" stroke="#3b82f6" strokeDasharray="2 2" strokeWidth="1" />
                  <rect x="270" y="80" width="32" height="55" fill="#3b82f6" opacity="0.12" rx="3" stroke="#3b82f6" strokeDasharray="2 2" strokeWidth="1" />
                  <rect x="390" y="80" width="28" height="55" fill="#3b82f6" opacity="0.12" rx="3" stroke="#3b82f6" strokeDasharray="2 2" strokeWidth="1" />
                  <text x="150" y="148" fill="#2563eb" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">1 finger</text>
                  <text x="286" y="148" fill="#2563eb" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">1 finger</text>
                </g>
              )}

              {activeCriterion === "letter_formation" && (
                <g className="animate-in fade-in duration-300">
                  {/* Loop closure highlight circles */}
                  <circle cx="95" cy="55" r="9" fill="none" stroke="#eab308" strokeWidth="2" strokeDasharray="3 2" />
                  <circle cx="215" cy="110" r="10" fill="none" stroke="#eab308" strokeWidth="2" strokeDasharray="3 2" />
                  <circle cx="345" cy="110" r="10" fill="none" stroke="#eab308" strokeWidth="2" strokeDasharray="3 2" />
                  <rect x="235" y="15" width="105" height="18" rx="4" fill="#ca8a04" opacity="0.9" />
                  <text x="287" y="27" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                    Closed Cursive Loops
                  </text>
                </g>
              )}

              {/* Sample Authentic Cursive Text Glyphs */}
              <g
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-foreground/90 transition-colors"
              >
                {/* Word: 'The' */}
                {/* Capital 'T' stem & bar */}
                <path d="M 50 45 Q 65 38 85 40 M 68 40 L 68 135" />
                {/* 'h' loop & arch */}
                <path d="M 68 135 Q 76 80 88 42 Q 95 38 98 52 L 85 135 Q 92 105 106 102 Q 115 102 118 135" />
                {/* 'e' loop & connector */}
                <path d="M 118 135 Q 128 105 135 105 Q 140 115 132 135" />

                {/* Word: 'quick' */}
                {/* 'q' oval & descender */}
                <path d="M 175 110 Q 165 92 178 92 Q 188 92 188 115 Q 188 135 175 135 M 188 95 L 188 165 Q 195 155 198 135" />
                {/* 'u' */}
                <path d="M 198 135 Q 205 102 210 102 L 210 135 Q 218 102 225 102 L 225 135" />
                {/* 'i' */}
                <path d="M 225 135 Q 232 102 238 102 L 238 135 M 238 85 L 238 87" />
                {/* 'c' */}
                <path d="M 238 135 Q 248 102 255 102 Q 246 122 255 135" />
                {/* 'k' */}
                <path d="M 255 135 Q 262 80 270 42 Q 275 38 276 52 L 268 135 M 268 112 Q 278 108 276 120 L 284 135" />

                {/* Word: 'brown' */}
                {/* 'b' */}
                <path d="M 315 135 Q 322 80 330 42 Q 336 38 338 52 L 328 135 Q 338 135 342 110" />
                {/* 'r' */}
                <path d="M 342 110 Q 346 100 352 104 L 354 135" />
                {/* 'o' */}
                <path d="M 354 135 Q 364 95 372 102 Q 375 125 368 135 Q 372 110 380 110" />
                {/* 'w' */}
                <path d="M 380 110 L 382 135 Q 390 105 394 105 L 396 135 Q 402 110 408 110" />
                {/* 'n' */}
                <path d="M 408 110 L 408 135 Q 416 102 422 102 L 422 135" />

                {/* Word: 'fox' */}
                {/* 'f' ascender & descender loop */}
                <path d="M 440 135 Q 448 80 456 42 Q 462 38 462 52 L 452 165 Q 456 160 460 135" />
                {/* 'o' */}
                <path d="M 460 135 Q 470 95 478 102 Q 482 125 474 135 Q 480 110 488 110" />
                {/* 'x' */}
                <path d="M 488 110 L 502 135 M 488 135 L 502 110" />
              </g>
            </svg>
          </div>
        </div>

        {/* Right Column: Diagnostic Feedback Card & Home Coaching Tip */}
        <div
          id="sample-diagnostic-details"
          className="lg:col-span-5 space-y-4"
        >
          {/* Overall Score Summary */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2.5 shadow-2xs">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block uppercase tracking-wider">
                  Sample Overall Score
                </span>
                <span className="text-2xl font-bold font-sans tabular-nums text-foreground">
                  87.2%
                </span>
              </div>
              <BandBadge score={87.2} size="default" />
            </div>
            <BandPositionBar score={87.2} height="default" />
            <p className="text-xs text-muted-foreground leading-normal pt-0.5">
              <span className="font-semibold text-foreground">Satisfactory:</span> Solid cursive foundation with minor areas to refine.
            </p>
          </div>

          {/* Active Criterion Diagnostic Feedback Card */}
          <div className="rounded-xl border border-brand-200/80 dark:border-brand-900 bg-brand-50/20 dark:bg-brand-950/20 p-4 sm:p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex size-7 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-heading font-semibold text-foreground truncate">
                    {currentMeta.label}
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    {currentMeta.shortDescription}
                  </span>
                </div>
              </div>
              <BandBadge band={currentSample.band} score={currentSample.score} size="sm" />
            </div>

            {/* Objective Observation */}
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-foreground block">
                Objective Observation:
              </span>
              <p className="text-muted-foreground leading-relaxed">
                {diagnosticNote}
              </p>
            </div>

            {/* Actionable Home Coaching Tip */}
            <div className="rounded-lg border border-brand-200/60 dark:border-brand-800/60 bg-brand-100/50 dark:bg-brand-950/40 p-3 space-y-1">
              <span className="font-semibold text-xs text-brand-900 dark:text-brand-200 block">
                Tip:
              </span>
              <p className="text-xs text-brand-800 dark:text-brand-300 leading-relaxed">
                {currentMeta.homeTip}
              </p>
            </div>
          </div>

          {/* Reassurance Footer with direct action */}
          <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenRubric}
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted cursor-pointer justify-center"
            >
              <BookOpen className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>Full Scoring Rubric</span>
            </Button>

            <span className="text-[11px] text-muted-foreground text-center sm:text-right">
              Live reports unlock after classroom evaluation
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

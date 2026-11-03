"use client";

import { useState, useMemo } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { GuideLineOverlay, type GuideLines } from "@/components/shared/guide-line-overlay";
import {
  DiagnosticOverlay,
  OverlayToolbar,
  DiagnosticFallbackBanner,
  getAttentionItems,
  type CriterionFilter,
  type DiagnosticOverlayData,
  type ActiveAnnotationHover,
} from "@/components/shared/diagnostic-overlay";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import { cn } from "@/lib/utils";
import {
  PARENT_CRITERIA_LIST,
  PARENT_CRITERIA_METADATA,
  DIAGNOSTIC_NOTES,
  computeStrengthAndFocus,
  getBandMeta,
  getBandFromScore,
  type ScoreBand,
  type CriterionKey,
} from "@/lib/utils/scoring";
import {
  ArrowLeft,
  Trash2,
  Loader2,
  Eye,
  Lightbulb,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteSubmission } from "@/lib/hooks/use-submissions";
import { toast } from "sonner";

const PARENT_BAND_EXPLANATIONS: Record<string, string> = {
  excellent: "Fluent, consistent cursive handwriting that meets grade-level goals.",
  satisfactory: "Solid cursive foundation with small areas to refine during practice.",
  developing: "Actively learning and building muscle memory — a normal, healthy stage in cursive.",
  needs_improvement: "Working on basic letter shapes and pencil control with guided practice.",
};

interface WorksheetViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId?: string;
  canDelete?: boolean;
  imagePath: string | null;
  targetText: string;
  submissionDate: string;
  childName: string;
  compositeScore: number | null;
  scoreSource?: "manual" | "calibrated" | "none";
  initialCriterion?: CriterionFilter;
  initialShowScoreDetails?: boolean;
  scores?: {
    letter_formation: number | null;
    size_consistency: number | null;
    spacing: number | null;
    slant: number | null;
    baseline_alignment: number | null;
    composite?: number | null;
  };
  bands?: {
    letter_formation: ScoreBand | null;
    size_consistency: ScoreBand | null;
    spacing: ScoreBand | null;
    slant: ScoreBand | null;
    baseline_alignment: ScoreBand | null;
    composite?: ScoreBand | null;
  };
  guideLines?: GuideLines | null;
  overlay?: DiagnosticOverlayData | null;
  onBack?: () => void;
  backLabel?: string;
  returnNote?: string | null;
}

export function WorksheetViewDialog({
  open,
  onOpenChange,
  imagePath,
  targetText,
  submissionDate,
  childName,
  compositeScore,
  scoreSource = "none",
  initialCriterion = "all",
  initialShowScoreDetails = false,
  scores,
  bands,
  guideLines,
  overlay,
  onBack,
  backLabel = "Back",
  submissionId,
  canDelete = false,
  returnNote,
}: WorksheetViewDialogProps) {
  const [showGuideLines, setShowGuideLines] = useState(false);
  const [criterionOverride, setCriterionOverride] = useState<CriterionFilter | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showScoreDetails, setShowScoreDetails] = useState(initialShowScoreDetails);
  const [selectedAttentionItem, setSelectedAttentionItem] =
    useState<ActiveAnnotationHover | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"photo" | "scores">("photo");

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setShowScoreDetails(initialShowScoreDetails);
    }
  }

  const { topStrength, practiceFocus } = useMemo(() => {
    return computeStrengthAndFocus(scores, bands);
  }, [scores, bands]);

  const deleteMutation = useDeleteSubmission();

  const handleDelete = async () => {
    if (!submissionId) return;
    try {
      await deleteMutation.mutateAsync(submissionId);
      toast.success("Photo removed. You can send a new photo anytime.");
      setIsDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete submission";
      toast.error(errorMsg);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCriterionOverride(null);
      setSelectedAttentionItem(null);
      setMobileTab("photo");
    }
    onOpenChange(nextOpen);
  };

  const handleCriterionSelect = (criterionKey: CriterionKey, switchMobileTab = false) => {
    const key = criterionKey as CriterionFilter;
    setCriterionOverride(key);
    if (overlay) {
      const items = getAttentionItems(overlay, key);
      if (items.length > 0) {
        setSelectedAttentionItem(items[0]);
      } else {
        setSelectedAttentionItem(null);
      }
    }
    if (switchMobileTab) {
      setMobileTab("photo");
    }
  };

  const effectiveInitialCriterion: CriterionFilter = useMemo(() => {
    return initialCriterion ?? "all";
  }, [initialCriterion]);

  const activeCriterion = criterionOverride ?? effectiveInitialCriterion;

  const activeAttentionItem = useMemo(() => {
    if (selectedAttentionItem) return selectedAttentionItem;
    if (!overlay || activeCriterion === "all") return null;
    const items = getAttentionItems(overlay, activeCriterion);
    return items.length > 0 ? items[0] : null;
  }, [selectedAttentionItem, overlay, activeCriterion]);

  const { data: imageUrl, isLoading: isImageLoading } = useSubmissionImageUrl(imagePath);

  const formattedDate = new Date(submissionDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const compositeBand =
    compositeScore != null
      ? bands?.composite ?? getBandFromScore(compositeScore)
      : null;
  const compositeBandMeta = compositeBand ? getBandMeta(compositeBand) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-3xl lg:max-w-4xl max-h-[min(94dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-card/80">
          <div className="flex items-center justify-between gap-3 pr-10">
            <div className="min-w-0 space-y-1">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 transition-colors cursor-pointer group mb-0.5 touch-manipulation min-h-[40px] sm:min-h-[36px] px-2 py-1 rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
                  <span>{backLabel}</span>
                </button>
              )}
              <DialogTitle className="font-heading text-base sm:text-lg font-semibold text-foreground truncate">
                Worksheet Photo &amp; Guide Lines
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">
                  {childName}
                </span>
                <span>&middot;</span>
                <span>{formattedDate}</span>
                {targetText && (
                  <>
                    <span>&middot;</span>
                    <span className="italic truncate max-w-xs sm:max-w-md" title={targetText}>
                      &ldquo;{targetText}&rdquo;
                    </span>
                  </>
                )}
              </DialogDescription>
            </div>
          </div>
          {returnNote && <p className="text-sm whitespace-pre-wrap">{returnNote}</p>}
        </DialogHeader>

        {/* Content Body: Split View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Mobile View Segmented Switcher */}
          <div
            role="tablist"
            aria-label="Worksheet view options"
            className="lg:hidden flex items-center p-1 bg-muted/50 rounded-xl border border-border/70 text-xs font-medium"
          >
            <button
              type="button"
              id="mobile-tab-photo"
              role="tab"
              aria-selected={mobileTab === "photo"}
              aria-controls="mobile-panel-photo"
              onClick={() => setMobileTab("photo")}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-center transition-all cursor-pointer min-h-[40px] flex items-center justify-center font-medium touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                mobileTab === "photo"
                  ? "bg-card text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Worksheet Photo
            </button>
            <button
              type="button"
              id="mobile-tab-scores"
              role="tab"
              aria-selected={mobileTab === "scores"}
              aria-controls="mobile-panel-scores"
              onClick={() => setMobileTab("scores")}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-center transition-all cursor-pointer min-h-[40px] flex items-center justify-center gap-1.5 font-medium touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                mobileTab === "scores"
                  ? "bg-card text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>5 Skills</span>
              {compositeBandMeta && (
                <span
                  className={cn("size-2 rounded-full shrink-0", compositeBandMeta.dotColor)}
                  aria-hidden="true"
                />
              )}
              {showScoreDetails && compositeScore != null && (
                <span className="text-xs font-sans tabular-nums px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-800 dark:text-brand-300 font-semibold border border-brand-200/60 dark:border-brand-800/60">
                  {Math.round(compositeScore)}%
                </span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: High-Resolution Worksheet Photo Inspector */}
            <div
              id="mobile-panel-photo"
              role="tabpanel"
              aria-labelledby="mobile-tab-photo"
              className={cn("lg:col-span-7 flex flex-col justify-center w-full gap-3", mobileTab !== "photo" && "hidden lg:flex")}
            >
              <WorksheetImageInspector
                imageUrl={imageUrl}
                altText={`Handwriting worksheet submitted for ${childName}`}
                isLoading={isImageLoading}
                headerLabel="Handwritten Worksheet"
                diagnosticToolbar={
                  overlay ? (
                    <OverlayToolbar
                      variant="compact"
                      overlay={overlay}
                      activeCriterion={activeCriterion}
                      onChangeCriterion={(c) => {
                        setCriterionOverride(c);
                        const items = getAttentionItems(overlay, c);
                        if (c !== "all" && items.length > 0) {
                          setSelectedAttentionItem(items[0]);
                        } else {
                          setSelectedAttentionItem(null);
                        }
                      }}
                      selectedAttentionId={activeAttentionItem?.id}
                      onSelectAttentionItem={setSelectedAttentionItem}
                      visible={showOverlay}
                      onToggleVisible={setShowOverlay}
                      showGuideLines={showGuideLines}
                      onToggleGuideLines={() => setShowGuideLines((prev) => !prev)}
                      hasGuideLines={Boolean(guideLines)}
                      className="border-none bg-transparent p-0 shadow-none backdrop-blur-none"
                    />
                  ) : (
                    <DiagnosticFallbackBanner
                      scoreSource={scoreSource}
                      isParentView
                      className="border-none bg-transparent p-0 shadow-none"
                    />
                  )
                }
              >
                {overlay ? (
                  <DiagnosticOverlay
                    overlay={overlay}
                    imageUrl={imageUrl}
                    visible={showOverlay}
                    activeCriterion={activeCriterion}
                    selectedAnnotation={activeAttentionItem}
                    onSelectAnnotation={setSelectedAttentionItem}
                    showGuideLines={showGuideLines}
                  />
                ) : (
                  <GuideLineOverlay
                    guideLines={guideLines ?? null}
                    imageUrl={imageUrl}
                    visible={showGuideLines}
                  />
                )}
              </WorksheetImageInspector>

              {!overlay && guideLines && (
                <button
                  type="button"
                  onClick={() => setShowGuideLines((prev) => !prev)}
                  className={cn(
                    "self-start px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 min-h-[40px] sm:min-h-[36px] touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                    showGuideLines
                      ? "bg-brand-100 text-brand-900 border-brand-300 dark:bg-brand-950 dark:text-brand-200 dark:border-brand-800"
                      : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/70 hover:text-foreground"
                  )}
                  aria-pressed={showGuideLines}
                  aria-label={showGuideLines ? "Hide guide lines on worksheet" : "Show guide lines on worksheet"}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0" aria-hidden="true">
                    <line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                    <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" strokeDasharray="2 2" />
                    <line x1="1" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <span>Writing Lines</span>
                </button>
              )}

              {/* Mobile Context Bridge */}
              <div className="lg:hidden p-4 rounded-xl border border-brand-200/60 dark:border-brand-800/60 bg-brand-50/60 dark:bg-brand-950/40 space-y-2 text-sm shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2 rounded-full bg-brand-600 dark:bg-brand-400 shrink-0" aria-hidden="true" />
                    <span className="font-semibold text-foreground truncate">
                      {activeCriterion === "all"
                        ? "All Writing Lines"
                        : PARENT_CRITERIA_METADATA[activeCriterion as CriterionKey]?.label ?? activeCriterion}
                    </span>
                    {activeCriterion !== "all" && bands && bands[activeCriterion as CriterionKey] && (
                      <BandBadge band={bands[activeCriterion as CriterionKey]} size="sm" showDot />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileTab("scores")}
                    className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline shrink-0 min-h-[40px] flex items-center px-2 -my-2 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                  >
                    See 5 skills &rarr;
                  </button>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {activeCriterion === "all"
                    ? "Showing writing line, slant, and spacing guides on the photo. Pinch to zoom in on letters."
                    : (bands && bands[activeCriterion as CriterionKey] && DIAGNOSTIC_NOTES[activeCriterion as CriterionKey]?.[bands[activeCriterion as CriterionKey]!]) ||
                      PARENT_CRITERIA_METADATA[activeCriterion as CriterionKey]?.shortDescription}
                </p>

                {(() => {
                  const tip =
                    activeCriterion === "all"
                      ? practiceFocus?.meta.homeTip
                      : activeCriterion === practiceFocus?.key
                        ? practiceFocus?.meta.homeTip
                        : PARENT_CRITERIA_METADATA[activeCriterion as CriterionKey]?.homeTip;
                  if (!tip) return null;
                  return (
                    <div className="pt-2 border-t border-brand-200/50 dark:border-brand-800/50 flex items-start gap-2 text-band-2-text dark:text-amber-200">
                      <Lightbulb className="size-4 shrink-0 mt-0.5 text-band-2-text dark:text-amber-200" aria-hidden="true" />
                      <p className="leading-relaxed text-sm">
                        <span className="font-semibold">Home tip: </span>
                        {tip}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right: Overall Result & 5 Skills */}
            <div
              id="mobile-panel-scores"
              role="tabpanel"
              aria-labelledby="mobile-tab-scores"
              className={cn("lg:col-span-5 space-y-4", mobileTab !== "scores" && "hidden lg:block")}
            >
              {compositeScore != null && (
                <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {compositeBandMeta && (
                        <div className="flex items-center gap-2">
                          <span
                            className={cn("size-2.5 rounded-full shrink-0", compositeBandMeta.dotColor)}
                            aria-hidden="true"
                          />
                          <h3 className="text-lg font-heading font-semibold text-foreground">
                            {compositeBandMeta.label}
                          </h3>
                        </div>
                      )}
                      {showScoreDetails && (
                        <span className="text-xs font-semibold font-sans tabular-nums text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/60">
                          {Math.round(compositeScore)}% overall
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowScoreDetails((prev) => !prev)}
                      aria-pressed={showScoreDetails}
                      className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-2.5 py-1 min-h-[40px] sm:min-h-[36px] flex items-center justify-center border border-brand-200/60 dark:border-brand-800/60 bg-brand-50/50 dark:bg-brand-950/30 transition-colors touch-manipulation"
                    >
                      {showScoreDetails ? "Hide details" : "Show details"}
                    </button>
                  </div>

                  <BandPositionBar
                    score={compositeScore}
                    height="sm"
                    showThresholds={showScoreDetails}
                    ariaLabel={
                      showScoreDetails
                        ? `Overall score: ${Math.round(compositeScore)}%`
                        : compositeBandMeta
                          ? `Overall level: ${compositeBandMeta.label}`
                          : "Overall level not yet available"
                    }
                    ariaValueText={
                      showScoreDetails
                        ? `${Math.round(compositeScore)}% overall`
                        : compositeBandMeta
                          ? compositeBandMeta.label
                          : undefined
                    }
                  />

                  {compositeBand && PARENT_BAND_EXPLANATIONS[compositeBand] && (
                    <p className="text-sm text-muted-foreground leading-relaxed pt-0.5">
                      {PARENT_BAND_EXPLANATIONS[compositeBand]}
                    </p>
                  )}
                </div>
              )}

              {/* 5 Handwriting Skills Breakdown */}
              {scores && bands && (
                <div className="space-y-2">
                  <h4 className="text-sm font-heading font-semibold text-foreground px-1">
                    5 Handwriting Skills
                  </h4>

                  <Accordion
                    value={activeCriterion === "all" ? [] : [activeCriterion]}
                    onValueChange={(val) => {
                      const next = Array.isArray(val)
                        ? (val as string[])
                        : val
                          ? [val as string]
                          : [];
                      if (next.length > 0) {
                        const selected = next[next.length - 1] as CriterionKey;
                        handleCriterionSelect(selected, false);
                      } else {
                        setCriterionOverride("all");
                        setSelectedAttentionItem(null);
                      }
                    }}
                    className="rounded-xl border border-border/80 bg-card overflow-hidden divide-y divide-border/60 shadow-2xs"
                  >
                    {PARENT_CRITERIA_LIST.map((criterion) => {
                      const isTop = topStrength?.key === criterion.key;
                      const isFocus = practiceFocus?.key === criterion.key;
                      const highlightBadge = isTop
                        ? "top_strength"
                        : isFocus
                          ? "practice_focus"
                          : null;
                      const score = scores[criterion.key];
                      const band = bands[criterion.key];
                      const diagnosticNote = band ? DIAGNOSTIC_NOTES[criterion.key][band] : null;
                      const criterionMeta = PARENT_CRITERIA_METADATA[criterion.key];
                      const homeTip = isFocus ? practiceFocus?.meta.homeTip : criterionMeta?.homeTip;

                      return (
                        <AccordionItem
                          value={criterion.key}
                          key={criterion.key}
                          className="border-0 hover:bg-muted/10 transition-colors"
                        >
                          <AccordionTrigger className="hover:no-underline px-3.5 py-3 items-center gap-3 cursor-pointer">
                            <div className="flex items-center justify-between flex-1 min-w-0 pr-1 gap-2">
                              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                <span className="text-sm font-semibold text-foreground truncate">
                                  {criterion.label}
                                </span>
                                {highlightBadge === "top_strength" && (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-band-4-text dark:text-emerald-300 bg-band-4/15 dark:bg-band-4/25 px-1.5 py-0.5 rounded-md border border-band-4/30 dark:border-band-4/40 shrink-0">
                                    <span className="size-1.5 rounded-full bg-band-4 shrink-0" aria-hidden="true" />
                                    Top Strength
                                  </span>
                                )}
                                {highlightBadge === "practice_focus" && (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-band-2-text dark:text-amber-200 bg-band-2/15 dark:bg-band-2/25 px-1.5 py-0.5 rounded-md border border-band-2/30 dark:border-band-2/40 shrink-0">
                                    <span className="size-1.5 rounded-full bg-band-2 shrink-0" aria-hidden="true" />
                                    Practice Focus
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 text-right">
                                {showScoreDetails && score != null && (
                                  <span className="font-sans text-xs sm:text-sm font-semibold tabular-nums text-muted-foreground">
                                    {Math.round(score)}%
                                  </span>
                                )}
                                <BandBadge band={band} score={score} size="sm" showDot />
                              </div>
                            </div>
                          </AccordionTrigger>

                          <AccordionContent className="px-3.5 pb-3.5 pt-0 space-y-2.5 border-0">
                            <div className="pt-0.5 pb-1">
                              <BandPositionBar
                                score={score}
                                height="sm"
                                showThresholds={showScoreDetails}
                                ariaValueText={
                                  showScoreDetails && score != null
                                    ? `${Math.round(score)}%`
                                    : band
                                      ? band.replace("_", " ")
                                      : undefined
                                }
                              />
                            </div>

                            {diagnosticNote && (
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {diagnosticNote}
                              </p>
                            )}

                            {homeTip && (
                              <div className="p-3 rounded-xl bg-band-2/15 dark:bg-band-2/25 border border-band-2/30 dark:border-band-2/40 text-sm text-band-2-text dark:text-amber-200 shadow-2xs">
                                <p className="leading-relaxed">
                                  <strong className="font-semibold text-band-2-text dark:text-amber-200">Home tip:</strong> {homeTip}
                                </p>
                              </div>
                            )}

                            <div className="lg:hidden pt-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setMobileTab("photo")}
                                className="w-full h-10 min-h-[40px] text-xs sm:text-sm font-medium gap-1.5 border-brand-200 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/30 text-brand-800 dark:text-brand-200 cursor-pointer touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
                              >
                                <Eye className="size-3.5" aria-hidden="true" />
                                <span>See on worksheet</span>
                              </Button>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-border bg-card/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] px-3.5 text-xs font-medium gap-1.5 cursor-pointer touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
                onClick={onBack}
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                <span>{backLabel}</span>
              </Button>
            )}
            {canDelete && submissionId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={deleteMutation.isPending}
                className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] px-3 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl border border-destructive/20 gap-1.5 cursor-pointer transition-colors touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-destructive"
                title="Delete this photo"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                <span>Delete Photo</span>
              </Button>
            )}
          </div>
          <Button
            variant="default"
            size="sm"
            className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] px-5 font-medium cursor-pointer touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your uploaded worksheet photo. You can take and send a new photo anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              variant="destructive"
              className="gap-2 cursor-pointer"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  <span>Deleting...</span>
                </>
              ) : (
                "Delete Photo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

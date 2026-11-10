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
import { CriterionFeedbackRow } from "./criterion-feedback-row";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import { cn } from "@/lib/utils";
import {
  PARENT_CRITERIA_LIST,
  PARENT_BAND_EXPLANATIONS,
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
  Lightbulb,
  PenLine,
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
import { SubmissionCommentTabs } from "@/components/comments/submission-comment-tabs";

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
  onPracticeNow?: () => void;
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
  onPracticeNow,
}: WorksheetViewDialogProps) {
  const [showGuideLines, setShowGuideLines] = useState(false);
  const [criterionOverride, setCriterionOverride] = useState<CriterionFilter | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showScoreDetails, setShowScoreDetails] = useState(initialShowScoreDetails);
  const [selectedAttentionItem, setSelectedAttentionItem] =
    useState<ActiveAnnotationHover | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
    }
    onOpenChange(nextOpen);
  };

  const handleCriterionSelect = (criterionKey: CriterionKey) => {
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

  const renderOverallSummaryCard = (isMobile = false) => {
    if (compositeScore == null) return null;
    return (
      <div
        className={cn(
          "rounded-xl border border-border/80 bg-card shadow-2xs",
          isMobile ? "p-3.5 space-y-2.5" : "hidden lg:block p-4 space-y-3"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {compositeBandMeta && (
              <div className="flex items-center gap-2">
                <span
                  className={cn("size-2.5 rounded-full shrink-0", compositeBandMeta.dotColor)}
                  aria-hidden="true"
                />
                <h3 className="text-base sm:text-lg font-heading font-semibold text-foreground">
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
            className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md px-2.5 py-1 min-h-[36px] flex items-center justify-center border border-brand-200/60 dark:border-brand-800/60 bg-brand-50/50 dark:bg-brand-950/30 transition-colors touch-manipulation"
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
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pt-0.5">
            {PARENT_BAND_EXPLANATIONS[compositeBand]}
          </p>
        )}
      </div>
    );
  };

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
                <span className="font-sans tabular-nums">{formattedDate}</span>
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

        {/* Content Body: Unified Multimodal View */}
        <SubmissionCommentTabs key={submissionId} submissionId={submissionId} open={open}>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left (Desktop) / Top (Mobile): High-Resolution Worksheet Photo Inspector */}
            <div className="lg:col-span-7 flex flex-col justify-center w-full gap-3">
              <WorksheetImageInspector
                imageUrl={imageUrl}
                altText={`Handwriting worksheet submitted for ${childName}`}
                isLoading={isImageLoading}
                headerLabel="Handwritten Worksheet"
                imageToolsDisclosure={true}
                aspectRatioClass="h-[230px] sm:h-[320px] lg:h-auto lg:min-h-[420px] lg:max-h-[min(640px,calc(100dvh-14rem))]"
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

              {/* Mobile Active Feedback Bridge: Co-located directly under photo */}
              <div className="lg:hidden space-y-3 pt-1">
                {/* 1. Mobile Overall Result Summary Card: Promoted above fold directly under photo */}
                {renderOverallSummaryCard(true)}

                {/* 2. Horizontal Quick Skill Pills Selector */}
                <div
                  role="toolbar"
                  aria-label="Filter writing lines and feedback by skill"
                  className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCriterionOverride("all");
                      setSelectedAttentionItem(null);
                    }}
                    aria-pressed={activeCriterion === "all"}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer border min-h-[36px] flex items-center gap-1.5 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                      activeCriterion === "all"
                        ? "bg-brand-600 text-white border-brand-600 shadow-2xs dark:bg-brand-500 dark:border-brand-500"
                        : "bg-muted/50 text-muted-foreground border-border/80 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span>All Lines</span>
                  </button>

                  {PARENT_CRITERIA_LIST.map((c) => {
                    const band = bands?.[c.key];
                    const bandMeta = band ? getBandMeta(band) : null;
                    const isSelected = activeCriterion === c.key;

                    return (
                      <button
                        type="button"
                        key={c.key}
                        onClick={() => handleCriterionSelect(c.key)}
                        aria-pressed={isSelected}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer border min-h-[36px] flex items-center gap-1.5 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                          isSelected
                            ? "bg-brand-100 text-brand-900 border-brand-400 dark:bg-brand-950 dark:text-brand-100 dark:border-brand-600 shadow-2xs"
                            : "bg-card text-foreground border-border/80 hover:bg-muted/50"
                        )}
                      >
                        {bandMeta && (
                          <span
                            className={cn("size-2 rounded-full shrink-0", bandMeta.dotColor)}
                            aria-hidden="true"
                          />
                        )}
                        <span>{c.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Skill Feedback Card */}
                <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2.5 text-sm shadow-2xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-heading font-semibold text-foreground text-sm truncate">
                        {activeCriterion === "all"
                          ? "All Writing Lines & Guides"
                          : PARENT_CRITERIA_METADATA[activeCriterion as CriterionKey]?.label ?? activeCriterion}
                      </span>
                      {activeCriterion !== "all" && bands && bands[activeCriterion as CriterionKey] && (
                        <BandBadge band={bands[activeCriterion as CriterionKey]} size="sm" showDot />
                      )}
                    </div>
                    {showScoreDetails && activeCriterion !== "all" && scores && scores[activeCriterion as CriterionKey] != null && (
                      <span className="font-sans text-xs font-semibold tabular-nums text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/60">
                        {Math.round(scores[activeCriterion as CriterionKey]!)}%
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {activeCriterion === "all"
                      ? "Showing ruled writing lines, slant guides, and letter spacing on your child's paper. Tap any skill pill above to inspect specific strokes."
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
                      <div className="pt-2 border-t border-border/70 flex flex-col gap-2.5">
                        <div className="flex items-start gap-2 text-band-2-text">
                          <Lightbulb className="size-4 shrink-0 mt-0.5 text-band-2-text" aria-hidden="true" />
                          <p className="leading-relaxed text-xs sm:text-sm">
                            <span className="font-semibold">Home tip: </span>
                            {tip}
                          </p>
                        </div>
                        {onPracticeNow && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              onOpenChange(false);
                              onPracticeNow();
                            }}
                            className="self-start h-9 min-h-[36px] px-3 text-xs font-semibold gap-1.5 cursor-pointer touch-manipulation bg-brand-700 hover:bg-brand-800 text-white dark:bg-brand-600 dark:hover:bg-brand-500 shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
                          >
                            <PenLine className="size-3.5" aria-hidden="true" />
                            <span>Practice this skill now</span>
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Right (Desktop) / Supporting (Mobile): Overall Result & 5 Skills List */}
            <div className="lg:col-span-5 space-y-4 w-full">
              {renderOverallSummaryCard(false)}

              {/* 5 Handwriting Skills Breakdown (Desktop Right Column; Mobile uses active card under photo above) */}
              {scores && bands && (
                <div className="hidden lg:block space-y-2">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <h4 className="text-sm font-heading font-semibold text-foreground">
                      5 Handwriting Skills
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      Tap to highlight on worksheet
                    </span>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-card overflow-hidden divide-y divide-border/60 shadow-2xs">
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
                      const isRowActive = activeCriterion === criterion.key;
                      const criterionMeta = PARENT_CRITERIA_METADATA[criterion.key];
                      const homeTip = isFocus ? practiceFocus?.meta.homeTip : criterionMeta?.homeTip;

                      return (
                        <CriterionFeedbackRow
                          key={criterion.key}
                          criterionKey={criterion.key}
                          label={criterion.label}
                          score={score}
                          band={band}
                          highlightBadge={highlightBadge}
                          isActive={isRowActive}
                          showScoreDetails={showScoreDetails}
                          showPositionBar={isRowActive}
                          homePracticeTip={isRowActive || isFocus ? homeTip : null}
                          inspectLabel={null}
                          onInspect={() => {
                            if (isRowActive) {
                              setCriterionOverride("all");
                              setSelectedAttentionItem(null);
                            } else {
                              handleCriterionSelect(criterion.key);
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        </SubmissionCommentTabs>
        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-border bg-card/80 flex items-center justify-between gap-2 flex-wrap">
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
          <div className="flex items-center gap-2">
            {onPracticeNow && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onPracticeNow();
                }}
                className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] px-3.5 text-xs sm:text-sm font-semibold gap-1.5 cursor-pointer touch-manipulation bg-brand-700 hover:bg-brand-800 text-white dark:bg-brand-600 dark:hover:bg-brand-500 shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <PenLine className="size-3.5" aria-hidden="true" />
                <span>Practice together</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] px-4 font-medium cursor-pointer touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your uploaded worksheet photo and its comments. You can take and send a new photo anytime.
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

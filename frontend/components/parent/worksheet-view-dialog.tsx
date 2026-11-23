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
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { GuideLineOverlay, type GuideLines } from "@/components/shared/guide-line-overlay";
import {
  DiagnosticOverlay,
  OVERLAY_COLORS,
  getAttentionItems,
  type CriterionFilter,
  type DiagnosticOverlayData,
  type ActiveAnnotationHover,
} from "@/components/shared/diagnostic-overlay";
import { CriterionFeedbackRow } from "./criterion-feedback-row";
import { useSubmissionImageUrl, useDeleteSubmission } from "@/lib/hooks/use-submissions";
import { cn } from "@/lib/utils";
import {
  PARENT_CRITERIA_LIST,
  PARENT_BAND_EXPLANATIONS,
  PARENT_CRITERIA_METADATA,
  computeStrengthAndFocus,
  getBandMeta,
  getBandFromScore,
  type ScoreBand,
  type CriterionKey,
} from "@/lib/utils/scoring";
import {
  ArrowLeft,
  HelpCircle,
  Loader2,
  MoreHorizontal,
  PenLine,
  Trash2,
  X,
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
  initialView?: "details" | "comments";
  initialShowScoreDetails?: boolean;
  showScoreDetails?: boolean;
  onToggleScoreDetails?: () => void;
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
  initialView = "details",
  initialShowScoreDetails = false,
  showScoreDetails: controlledShowScoreDetails,
  onToggleScoreDetails,
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
  const [internalShowScoreDetails, setInternalShowScoreDetails] = useState(initialShowScoreDetails);
  const showScoreDetails =
    controlledShowScoreDetails !== undefined ? controlledShowScoreDetails : internalShowScoreDetails;
  const handleToggleScoreDetails = () => {
    if (onToggleScoreDetails) {
      onToggleScoreDetails();
    } else {
      setInternalShowScoreDetails((prev) => !prev);
    }
  };
  const [selectedAttentionItem, setSelectedAttentionItem] =
    useState<ActiveAnnotationHover | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open && controlledShowScoreDetails === undefined) {
      setInternalShowScoreDetails(initialShowScoreDetails);
    }
  }

  const { topStrength, practiceFocus, isBalanced } = useMemo(() => {
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
    } catch {
      toast.error("We couldn't remove the photo. Please check your connection and try again.");
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
      setSelectedAttentionItem(items.length > 0 ? items[0] : null);
    }
  };

  // Default to the child's primary focus skill so the worksheet stays calm on open.
  const effectiveInitialCriterion: CriterionFilter = useMemo(() => {
    if (initialCriterion && initialCriterion !== "all") return initialCriterion;
    return practiceFocus?.key ?? "all";
  }, [initialCriterion, practiceFocus?.key]);

  const activeCriterion = criterionOverride ?? effectiveInitialCriterion;

  const activeAttentionItem = useMemo(() => {
    if (selectedAttentionItem) return selectedAttentionItem;
    if (!overlay || activeCriterion === "all") return null;
    const items = getAttentionItems(overlay, activeCriterion);
    return items.length > 0 ? items[0] : null;
  }, [selectedAttentionItem, overlay, activeCriterion]);

  const {
    data: imageUrl,
    isLoading: isImageLoading,
    isError: isImageError,
    refetch: refetchImage,
  } = useSubmissionImageUrl(imagePath);

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

  const summaryTakeaway = useMemo(() => {
    if (topStrength && practiceFocus) {
      return `Strongest in ${topStrength.meta.label}; next, focus on ${practiceFocus.meta.label} together.`;
    }
    if (isBalanced) {
      return "Steady, balanced progress across all five cursive skills.";
    }
    return compositeBand ? PARENT_BAND_EXPLANATIONS[compositeBand] : null;
  }, [topStrength, practiceFocus, isBalanced, compositeBand]);

  const showHeaderMenu = Boolean((canDelete && submissionId) || compositeScore != null);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-3xl lg:max-w-4xl max-h-[min(94dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-card/80">
          <div className="flex items-start justify-between gap-2 pr-11 sm:pr-10">
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
                {childName ? `${childName}'s Worksheet` : "Worksheet Feedback"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-sans tabular-nums">{formattedDate}</span>
                {targetText && (
                  <>
                    <span>&middot;</span>
                    <span className="truncate max-w-xs sm:max-w-md" title={targetText}>
                      Prompt: &ldquo;{targetText}&rdquo;
                    </span>
                  </>
                )}
              </DialogDescription>
            </div>

            {showHeaderMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-10 sm:size-8 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer touch-manipulation"
                      aria-label="Worksheet options"
                    />
                  }
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl">
                  {compositeScore != null && (
                    <DropdownMenuCheckboxItem
                      checked={showScoreDetails}
                      onCheckedChange={handleToggleScoreDetails}
                    >
                      Show numeric scores
                    </DropdownMenuCheckboxItem>
                  )}
                  {canDelete && submissionId && (
                    <>
                      {compositeScore != null && <DropdownMenuSeparator />}
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setIsDeleteDialogOpen(true)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        <span>Delete upload</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {returnNote && <p className="text-sm whitespace-pre-wrap pt-1">{returnNote}</p>}
        </DialogHeader>

        {/* Content Body */}
        <SubmissionCommentTabs
          key={`${submissionId ?? "none"}:${initialView}`}
          submissionId={submissionId}
          open={open}
          initialView={initialView}
          studentName={childName}
        >
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left (Desktop) / Top (Mobile): Worksheet Photo & Single-Line Marks Bar */}
              <div className="lg:col-span-7 flex flex-col w-full gap-3">
                <WorksheetImageInspector
                  imageUrl={imageUrl}
                  altText={`Handwriting worksheet submitted for ${childName}`}
                  isLoading={isImageLoading}
                  isError={isImageError}
                  onRetry={() => {
                    void refetchImage();
                  }}
                  headerLabel="Handwritten Worksheet"
                  showShortcutsLegend={false}
                  showImageTools={false}
                  flatFrame={true}
                  keyboardScope="focused"
                  aspectRatioClass="max-h-[min(560px,calc(100dvh-14rem))] min-h-[200px]"
                  diagnosticToolbar={
                    overlay ? (
                      <div className="flex items-center justify-between gap-2 px-2 py-1 min-h-9 flex-wrap">
                        <label
                          htmlFor="parent-toggle-writing-marks"
                          className="inline-flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none min-h-9 sm:min-h-8 touch-manipulation"
                        >
                          <Switch
                            id="parent-toggle-writing-marks"
                            size="sm"
                            checked={showOverlay}
                            onCheckedChange={setShowOverlay}
                          />
                          <span>Show writing marks</span>
                        </label>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {showOverlay && activeCriterion !== "all" && (
                            <button
                              type="button"
                              onClick={() => {
                                setCriterionOverride("all");
                                setSelectedAttentionItem(null);
                              }}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-800 dark:text-brand-200 bg-brand-100/80 dark:bg-brand-950/60 hover:bg-brand-100 dark:hover:bg-brand-950 transition-colors cursor-pointer touch-manipulation min-h-8 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
                              title="Show all writing marks"
                            >
                              <span>
                                {PARENT_CRITERIA_METADATA[activeCriterion as CriterionKey]?.label ??
                                  activeCriterion}
                              </span>
                              <X className="size-3 opacity-70" aria-hidden="true" />
                              <span className="sr-only">Show all marks</span>
                            </button>
                          )}

                          {Boolean(guideLines) && (
                            <button
                              type="button"
                              onClick={() => setShowGuideLines((prev) => !prev)}
                              aria-pressed={showGuideLines}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer touch-manipulation min-h-8 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                                showGuideLines
                                  ? "bg-brand-100 text-brand-900 dark:bg-brand-950 dark:text-brand-200"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                              )}
                            >
                              <span>Paper lines</span>
                            </button>
                          )}

                          {showOverlay && (
                            <Popover>
                              <PopoverTrigger
                                render={
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer touch-manipulation min-h-8 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
                                    aria-label="What the writing marks mean"
                                  />
                                }
                              >
                                <HelpCircle className="size-3.5" aria-hidden="true" />
                                <span>Guide</span>
                              </PopoverTrigger>
                              <PopoverContent
                                align="end"
                                className="w-72 rounded-xl p-3.5 text-xs space-y-2.5 shadow-warm border border-border"
                              >
                                <p className="font-semibold text-foreground">
                                  What the marks mean
                                </p>
                                <div className="space-y-2 text-muted-foreground leading-snug">
                                  <div className="flex items-start gap-2">
                                    <span
                                      className="mt-1 size-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: OVERLAY_COLORS.consistent.stroke }}
                                      aria-hidden="true"
                                    />
                                    <p>
                                      <strong className="text-foreground font-medium">Steady strokes:</strong>{" "}
                                      Clear letter shapes, even spacing, and smooth line placement.
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span
                                      className="mt-1 size-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: OVERLAY_COLORS.needs_attention.stroke }}
                                      aria-hidden="true"
                                    />
                                    <p>
                                      <strong className="text-foreground font-medium">Practice spots:</strong>{" "}
                                      Areas where loops, gaps, lean, or line placement can steady with practice.
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span
                                      className="mt-1 size-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: OVERLAY_COLORS.guidelines.midline }}
                                      aria-hidden="true"
                                    />
                                    <p>
                                      <strong className="text-foreground font-medium">Paper lines:</strong>{" "}
                                      Top, middle, and base guides showing expected letter height.
                                    </p>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-muted-foreground">
                        <span>
                          {scoreSource === "manual"
                            ? "Reviewed directly by your child's teacher."
                            : "Original worksheet photo."}
                        </span>
                        {Boolean(guideLines) && (
                          <button
                            type="button"
                            onClick={() => setShowGuideLines((prev) => !prev)}
                            aria-pressed={showGuideLines}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer touch-manipulation min-h-8 shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500",
                              showGuideLines
                                ? "bg-brand-100 text-brand-900 dark:bg-brand-950 dark:text-brand-200"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                            )}
                          >
                            <span>Paper lines</span>
                          </button>
                        )}
                      </div>
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
                      showMeasurementDetails={false}
                    />
                  ) : (
                    <GuideLineOverlay
                      guideLines={guideLines ?? null}
                      imageUrl={imageUrl}
                      visible={showGuideLines}
                    />
                  )}
                </WorksheetImageInspector>
              </div>

              {/* Right (Desktop) / Below Photo (Mobile): Overall Summary + 5 Skills */}
              <div className="lg:col-span-5 space-y-4 w-full">
                {compositeScore != null && (
                  <div className="rounded-xl border border-border/80 bg-card p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      {compositeBandMeta && (
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn("size-2.5 rounded-full shrink-0", compositeBandMeta.dotColor)}
                            aria-hidden="true"
                          />
                          <h3 className="text-base sm:text-lg font-heading font-semibold text-foreground truncate">
                            {compositeBandMeta.label}
                          </h3>
                        </div>
                      )}
                      {showScoreDetails && (
                        <span className="text-xs font-semibold font-sans tabular-nums text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/60 shrink-0">
                          {Math.round(compositeScore)}% overall
                        </span>
                      )}
                    </div>

                    <BandPositionBar
                      score={compositeScore}
                      height="sm"
                      showBandLabels={false}
                      showThresholds={false}
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

                    {summaryTakeaway && (
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {summaryTakeaway}
                      </p>
                    )}
                  </div>
                )}

                {scores && bands && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-heading font-semibold text-foreground px-0.5">
                      Handwriting skills
                    </h3>

                    <div className="rounded-xl border border-border/80 bg-card overflow-hidden divide-y divide-border/60">
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
                            showDiagnosticNote={isRowActive}
                            showPositionBar={false}
                            homePracticeTip={isRowActive ? homeTip : null}
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

        {/* Footer — single calm primary CTA when practice is available */}
        {onPracticeNow && (
          <div className="px-4 py-3 sm:px-5 border-t border-border bg-card/80 flex items-center justify-end">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onPracticeNow();
              }}
              className="h-10 sm:h-9 min-h-10 sm:min-h-9 px-4 text-xs sm:text-sm font-semibold gap-1.5 cursor-pointer touch-manipulation shadow-warm-sm"
            >
              <PenLine className="size-3.5" aria-hidden="true" />
              <span>Practice together</span>
            </Button>
          </div>
        )}
      </DialogContent>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your uploaded worksheet photo and its comments. This action cannot be undone, and you can send a new photo anytime.
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
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>Deleting...</span>
                </>
              ) : (
                "Delete upload"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

"use client";

import { useState, useMemo } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
import { useSubmissionDiagnostics } from "@/lib/hooks/use-parent-data";
import { normalizeActivityPrompt } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import {
  PARENT_CRITERIA_LIST,
  PARENT_CRITERIA_METADATA,
  computeStrengthAndFocus,
  getBandMeta,
  getBandFromScore,
  type ScoreBand,
  type CriterionKey,
} from "@/lib/utils/scoring";
import {
  HelpCircle,
  MoreHorizontal,
  PenLine,
  Trash2,
  X,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
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

const CRITERION_SHORT_LABELS: Record<CriterionKey, string> = {
  letter_formation: "Formation",
  size_consistency: "Size",
  spacing: "Spacing",
  slant: "Slant",
  baseline_alignment: "Baseline",
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
  initialView?: "details" | "comments";
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
  scores,
  bands,
  guideLines,
  overlay,
  submissionId,
  canDelete = false,
  returnNote,
  onPracticeNow,
}: WorksheetViewDialogProps) {
  const [showGuideLines, setShowGuideLines] = useState(false);
  const [criterionOverride, setCriterionOverride] = useState<CriterionFilter | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [selectedAttentionItem, setSelectedAttentionItem] =
    useState<ActiveAnnotationHover | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [activeView, setActiveView] = useState<"details" | "comments">(initialView);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setActiveView(initialView);
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

  const shouldLoadDiagnostics =
    open && Boolean(submissionId) && overlay === undefined && guideLines === undefined;
  const { data: lazyDiagnostics } = useSubmissionDiagnostics(submissionId, shouldLoadDiagnostics);
  const resolvedOverlay = overlay !== undefined ? overlay : lazyDiagnostics?.overlay ?? null;
  const resolvedGuideLines =
    guideLines !== undefined ? guideLines : lazyDiagnostics?.guideLines ?? null;

  const handleCriterionSelect = (criterionKey: CriterionKey) => {
    const key = criterionKey as CriterionFilter;
    setCriterionOverride(key);
    if (resolvedOverlay) {
      const items = getAttentionItems(resolvedOverlay, key);
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
    if (!resolvedOverlay || activeCriterion === "all") return null;
    const items = getAttentionItems(resolvedOverlay, activeCriterion);
    return items.length > 0 ? items[0] : null;
  }, [selectedAttentionItem, resolvedOverlay, activeCriterion]);

  const {
    data: imageUrl,
    isLoading: isImageLoading,
    isError: isImageError,
    refetch: refetchImage,
  } = useSubmissionImageUrl(imagePath);

  const displayTargetText = targetText ? normalizeActivityPrompt(targetText) : "";

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

  const showHeaderMenu = Boolean(canDelete && submissionId);

  const paperLinesToggle = Boolean(resolvedGuideLines) && (
    <Toggle
      size="sm"
      pressed={showGuideLines}
      onPressedChange={setShowGuideLines}
      className="h-auto min-h-10 sm:min-h-8 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 aria-pressed:bg-brand-100 aria-pressed:text-brand-900 dark:aria-pressed:bg-brand-950 dark:aria-pressed:text-brand-200 cursor-pointer touch-manipulation shrink-0 focus-visible:ring-2 focus-visible:ring-brand-500"
      title="Toggle 3-line penmanship paper guides"
    >
      <span className="hidden sm:inline">Paper lines</span>
      <span className="sm:hidden">Lines</span>
    </Toggle>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:w-[95vw] sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[min(94dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        {/* Header */}
        <DialogHeader
          className={cn(
            "p-4 sm:p-5 bg-card/80",
            submissionId ? "pb-0 border-b-0" : "pb-3 border-b border-border"
          )}
        >
          <div className="flex items-start justify-between gap-2 pr-11 sm:pr-10">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="font-heading text-base sm:text-lg font-semibold text-foreground truncate">
                {childName ? `${childName}'s Worksheet` : "Worksheet Feedback"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-sans tabular-nums">{formattedDate}</span>
                {displayTargetText && (
                  <>
                    <span>&middot;</span>
                    <span className="truncate max-w-xs sm:max-w-md" title={displayTargetText}>
                      Prompt: &ldquo;{displayTargetText}&rdquo;
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
                <DropdownMenuContent align="end" className="w-48 rounded-xl">
                  <DropdownMenuGroup>
                    {canDelete && submissionId && (
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setIsDeleteDialogOpen(true)}
                      >
                        <Trash2 aria-hidden="true" />
                        <span>Delete upload</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {returnNote && <p className="text-sm whitespace-pre-wrap pt-1 pb-2">{returnNote}</p>}
        </DialogHeader>

        {/* Content Body */}
        <SubmissionCommentTabs
          key={`${submissionId ?? "none"}:${initialView}`}
          submissionId={submissionId}
          open={open}
          initialView={initialView}
          studentName={childName}
          commentsLabel="Notes"
          tabBarClassName="px-4 sm:px-5"
          onViewChange={setActiveView}
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
                  aspectRatioClass="max-h-[min(640px,calc(100dvh-14rem))] min-h-[220px]"
                  diagnosticToolbar={
                    resolvedOverlay ? (
                      <div className="flex items-center justify-between gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-1 min-h-10 sm:min-h-9 flex-nowrap w-full">
                        {/* Left: Switch + Contextual Label / Filter Chip */}
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
                          <Switch
                            id="parent-toggle-writing-marks"
                            size="sm"
                            checked={showOverlay}
                            onCheckedChange={setShowOverlay}
                            aria-label="Toggle writing marks overlay"
                          />

                          {showOverlay && activeCriterion !== "all" ? (
                            <div className="inline-flex items-center gap-1.5 min-w-0">
                              <span className="hidden sm:inline text-xs font-medium text-foreground shrink-0">
                                Writing marks:
                              </span>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setCriterionOverride("all");
                                  setSelectedAttentionItem(null);
                                }}
                                className="h-auto min-h-10 sm:min-h-8 rounded-md px-2 py-1 text-xs font-medium text-brand-800 dark:text-brand-200 bg-brand-100/80 dark:bg-brand-950/60 hover:bg-brand-100 dark:hover:bg-brand-950 gap-1 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-brand-500 shrink min-w-0"
                                title="Filtering by this skill. Click to show all marks."
                              >
                                <span className="hidden sm:inline truncate max-w-[140px]">
                                  {PARENT_CRITERIA_METADATA[activeCriterion as CriterionKey]?.label ??
                                    activeCriterion}
                                </span>
                                <span className="sm:hidden font-medium">
                                  {CRITERION_SHORT_LABELS[activeCriterion as CriterionKey] ??
                                    activeCriterion}
                                </span>
                                <X className="size-3 opacity-70 shrink-0" aria-hidden="true" />
                                <span className="sr-only">Show all marks</span>
                              </Button>
                            </div>
                          ) : (
                            <Label
                              htmlFor="parent-toggle-writing-marks"
                              className="inline-flex items-center text-xs font-medium text-foreground cursor-pointer min-h-10 sm:min-h-8 touch-manipulation shrink-0"
                            >
                              <span className="hidden sm:inline">Show writing marks</span>
                              <span className="hidden min-[360px]:inline sm:hidden">Writing marks</span>
                              <span className="min-[360px]:hidden">Marks</span>
                            </Label>
                          )}
                        </div>

                        {/* Right: Lines toggle + Guide Popover */}
                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                          {paperLinesToggle}

                          {showOverlay && (
                            <Popover>
                              <PopoverTrigger
                                render={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto min-h-10 sm:min-h-8 rounded-md px-1.5 sm:px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 gap-1 cursor-pointer touch-manipulation shrink-0 focus-visible:ring-2 focus-visible:ring-brand-500"
                                    aria-label="What the writing marks mean"
                                    title="What the writing marks mean"
                                  />
                                }
                              >
                                <HelpCircle className="size-3.5" aria-hidden="true" />
                                <span className="hidden min-[380px]:inline">Guide</span>
                              </PopoverTrigger>
                              <PopoverContent
                                align="end"
                                className="w-72 max-w-[calc(100vw-2rem)] rounded-xl p-3.5 text-xs space-y-2.5 shadow-warm border border-border"
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
                      <div className="flex items-center justify-between gap-2 px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs text-muted-foreground min-h-10 sm:min-h-9 flex-nowrap w-full">
                        <span className="truncate">
                          {scoreSource === "manual"
                            ? "Reviewed directly by your child's teacher."
                            : "Original worksheet photo."}
                        </span>
                        {paperLinesToggle}
                      </div>
                    )
                  }
                >
                  {resolvedOverlay ? (
                    <DiagnosticOverlay
                      overlay={resolvedOverlay}
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
                      guideLines={resolvedGuideLines ?? null}
                      imageUrl={imageUrl}
                      visible={showGuideLines}
                    />
                  )}
                </WorksheetImageInspector>
              </div>

              {/* Right (Desktop) / Below Photo (Mobile): Overall Summary + 5 Skills */}
              <div className="lg:col-span-5 space-y-4 w-full">
                {compositeScore != null && (
                  <Card size="sm" className="border-border/80 shadow-none gap-2.5">
                    <CardContent className="space-y-2.5">
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
                        <Badge
                          variant="outline"
                          className="h-auto rounded-md text-xs font-semibold font-sans tabular-nums text-muted-foreground bg-muted/60 px-2 py-0.5 border-border/60 shrink-0"
                        >
                          {Math.round(compositeScore)}% overall
                        </Badge>
                      </div>

                      <BandPositionBar
                        score={compositeScore}
                        height="sm"
                        showBandLabels={false}
                        showThresholds={true}
                        ariaLabel={`Overall score: ${Math.round(compositeScore)}%`}
                        ariaValueText={`${Math.round(compositeScore)}% overall`}
                      />
                    </CardContent>
                  </Card>
                )}

                {scores && bands && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-heading font-semibold text-foreground px-0.5">
                      Skill breakdown
                    </h3>

                    <Card className="border-border/80 shadow-none py-0 gap-0 divide-y divide-border/60">
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
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SubmissionCommentTabs>

        {/* Footer — single calm primary CTA when practice is available */}
        {onPracticeNow && activeView !== "comments" && (
          <DialogFooter className="px-4 py-3 sm:px-5 border-t border-border bg-card/80">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onPracticeNow();
              }}
              className="h-11 sm:h-9 px-4 text-xs sm:text-sm font-semibold gap-1.5 cursor-pointer touch-manipulation shadow-warm-sm"
            >
              <PenLine className="size-3.5" aria-hidden="true" />
              <span>Practice together</span>
            </Button>
          </DialogFooter>
        )}
      </DialogContent>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your uploaded worksheet photo and its notes. This action cannot be undone, and you can send a new photo anytime.
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
                  <Spinner data-icon="inline-start" aria-hidden="true" />
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

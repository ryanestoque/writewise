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
import { ScoreSourceIndicator } from "@/components/shared/score-source-indicator";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { GuideLineOverlay, type GuideLines } from "@/components/shared/guide-line-overlay";
import {
  DiagnosticOverlay,
  OverlayToolbar,
  DiagnosticFallbackBanner,
  type CriterionFilter,
  type DiagnosticOverlayData,
  type ActiveAnnotationHover,
} from "@/components/shared/diagnostic-overlay";
import { CriterionFeedbackRow } from "./criterion-feedback-row";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import { PARENT_CRITERIA_LIST, type ScoreBand } from "@/lib/utils/scoring";
import {
  FileImage,
  Calendar,
  User,
  ArrowLeft,
  Trash2,
  Loader2,
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
  /** CV pipeline guide-line coordinates from raw_output */
  guideLines?: GuideLines | null;
  /** Diagnostic Engine overlay coordinates and findings */
  overlay?: DiagnosticOverlayData | null;
  /** Optional back action when opened from a parent history view */
  onBack?: () => void;
  backLabel?: string;
}

const PARENT_CRITERIA = PARENT_CRITERIA_LIST.map((c) => ({
  criterionKey: c.key,
  label: c.label,
}));

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
  scores,
  bands,
  guideLines,
  overlay,
  onBack,
  backLabel = "Back to History",
  submissionId,
  canDelete = false,
}: WorksheetViewDialogProps) {
  const [showGuideLines, setShowGuideLines] = useState(false);
  const [criterionOverride, setCriterionOverride] = useState<CriterionFilter | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [selectedAttentionItem, setSelectedAttentionItem] =
    useState<ActiveAnnotationHover | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const deleteMutation = useDeleteSubmission();

  const handleDelete = async () => {
    if (!submissionId) return;
    try {
      await deleteMutation.mutateAsync(submissionId);
      toast.success("Worksheet removed. You can upload a new photo anytime.");
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

  const effectiveInitialCriterion: CriterionFilter = useMemo(() => {
    if (initialCriterion !== "all") return initialCriterion;
    if (overlay?.summary?.weakest_criterion) {
      return overlay.summary.weakest_criterion as CriterionFilter;
    }
    return "all";
  }, [initialCriterion, overlay?.summary?.weakest_criterion]);

  const activeCriterion = criterionOverride ?? effectiveInitialCriterion;
  const { data: imageUrl, isLoading: isImageLoading } =
    useSubmissionImageUrl(imagePath);

  const formattedDate = new Date(submissionDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-4xl max-h-[min(94dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-card/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pr-8">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-9 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
                <FileImage className="size-4.5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-heading text-base sm:text-lg font-semibold text-foreground truncate">
                  Scored Worksheet Photo
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap truncate">
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <User className="size-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                    {childName}
                  </span>
                  <span>&middot;</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3" aria-hidden="true" />
                    {formattedDate}
                  </span>
                </DialogDescription>
              </div>
            </div>

            {scoreSource !== "none" && (
              <div className="self-start sm:self-auto">
                <ScoreSourceIndicator source={scoreSource} compact />
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Content Body: Split View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start lg:items-center">
            {/* Left: High-Resolution Worksheet Photo Inspector */}
            <div className="lg:col-span-7 flex flex-col justify-center w-full gap-2">
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
                        setSelectedAttentionItem(null);
                      }}
                      selectedAttentionId={selectedAttentionItem?.id}
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
                    selectedAnnotation={selectedAttentionItem}
                    onSelectAnnotation={setSelectedAttentionItem}
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
                  className={`self-start px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 min-h-[40px] sm:min-h-[36px] touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    showGuideLines
                      ? "bg-brand-100 text-brand-900 border-brand-300 dark:bg-brand-950 dark:text-brand-200 dark:border-brand-800"
                      : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/70 hover:text-foreground"
                  }`}
                  aria-pressed={showGuideLines}
                  aria-label={showGuideLines ? "Hide detected guide lines on worksheet" : "Show detected guide lines on worksheet"}
                  title={showGuideLines ? "Hide detected guide lines" : "Show detected guide lines on worksheet"}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0" aria-hidden="true">
                    <line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                    <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" strokeDasharray="2 2" />
                    <line x1="1" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <span>Guidelines</span>
                </button>
              )}
            </div>

            {/* Right: Worksheet Details & Criterion Feedback */}
            <div className="lg:col-span-5 space-y-4">
              {/* Activity Target Text */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 space-y-1 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assigned Target Text
                </span>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  &ldquo;{targetText}&rdquo;
                </p>
              </div>

              {/* Composite Score Card */}
              {compositeScore != null && (
                <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2 shadow-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Overall Penmanship Score
                    </span>
                    <BandBadge score={compositeScore} size="sm" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-sans tabular-nums text-foreground">
                      {compositeScore.toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      overall handwriting score
                    </span>
                  </div>
                  <BandPositionBar score={compositeScore} height="sm" />
                </div>
              )}

              {/* Criteria Feedback Breakdown */}
              {scores && bands && (
                <div className="p-3.5 rounded-xl border border-border/80 bg-muted/10 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-border/50">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Skill Breakdown
                    </span>
                    <span className="text-xs text-muted-foreground">
                      5 skills
                    </span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {PARENT_CRITERIA.map((criterion) => (
                      <CriterionFeedbackRow
                        key={criterion.criterionKey}
                        criterionKey={criterion.criterionKey}
                        label={criterion.label}
                        score={scores[criterion.criterionKey]}
                        band={bands[criterion.criterionKey]}
                      />
                    ))}
                  </div>
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
                className="h-10 sm:h-9 px-3.5 text-xs font-medium gap-1.5 cursor-pointer"
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
                className="h-10 sm:h-9 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl border border-destructive/20 gap-1.5 cursor-pointer transition-colors"
                title="Delete this uploaded worksheet"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                <span>Delete Upload</span>
              </Button>
            )}
          </div>
          <Button
            variant="default"
            size="sm"
            className="h-10 sm:h-9 px-5 font-medium cursor-pointer"
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
            <AlertDialogTitle>Delete this uploaded worksheet?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your uploaded worksheet photo. You will be able to take and upload
              a new photo for this activity. This action cannot be undone.
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2 cursor-pointer"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-4" aria-hidden="true" />
                  <span>Delete Upload</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

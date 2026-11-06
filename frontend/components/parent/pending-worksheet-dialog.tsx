"use client";

import { useMemo } from "react";
import { Camera, ArrowLeft, Clock3, AlertCircle, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";

interface PendingWorksheetDialogProps {
  item: StudentScoreHistoryItem;
  childName: string;
  onBack: () => void;
  backLabel?: string;
  onUploadActivity?: (activityId: string) => void;
}

export function PendingWorksheetDialog({
  item,
  childName,
  onBack,
  backLabel = "Back to history",
  onUploadActivity,
}: PendingWorksheetDialogProps) {
  const image = useSubmissionImageUrl(item.imagePath ?? null);
  const canSendNewPhoto = Boolean(
    onUploadActivity &&
    item.isTakeHome &&
    item.activityId &&
    (item.status === "returned" || item.status === "rejected")
  );

  const formattedDate = useMemo(() => {
    return new Date(item.submissionDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [item.submissionDate]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onBack();
      }}
    >
      <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-3xl lg:max-w-4xl max-h-[min(94dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        {/* Header matching WorksheetViewDialog */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-card/80">
          <div className="flex items-center justify-between gap-3 pr-10">
            <div className="min-w-0 space-y-1">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 transition-colors cursor-pointer group mb-0.5 touch-manipulation min-h-[40px] sm:min-h-[36px] px-2 py-1 rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
                <span>{backLabel}</span>
              </button>
              <DialogTitle className="font-heading text-base sm:text-lg font-semibold text-foreground truncate">
                Worksheet Photo &amp; Review Status
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">{childName}</span>
                <span>&middot;</span>
                <span className="font-sans tabular-nums">{formattedDate}</span>
                {item.targetText && (
                  <>
                    <span>&middot;</span>
                    <span className="italic truncate max-w-xs sm:max-w-md" title={item.targetText}>
                      &ldquo;{item.targetText}&rdquo;
                    </span>
                  </>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body: Unified Multimodal Split View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Photo Inspector */}
            <div className="lg:col-span-7 flex flex-col justify-center w-full gap-3">
              <WorksheetImageInspector
                imageUrl={image.data}
                altText={`Handwriting worksheet submitted for ${childName}`}
                isLoading={image.isLoading}
                isError={image.isError}
                onRetry={() => image.refetch()}
                headerLabel="Uploaded Worksheet Photo"
                imageToolsDisclosure={true}
                aspectRatioClass="h-[230px] sm:h-[320px] lg:h-auto lg:min-h-[420px] lg:max-h-[min(640px,calc(100dvh-14rem))]"
              />
            </div>

            {/* Right Column: Status Card & Teacher Note */}
            <div className="lg:col-span-5 space-y-4 w-full">
              <div className="p-4 sm:p-5 rounded-xl border border-border/80 bg-card space-y-4 shadow-2xs">
                {/* Status Badge & Headline */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {item.status === "returned" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-band-2/15 text-band-2-text dark:text-amber-200 border border-band-2/30">
                        <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>Revision Requested</span>
                      </span>
                    ) : item.status === "rejected" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/30">
                        <Camera className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>Retake Needed</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                        <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>Under Teacher Review</span>
                      </span>
                    )}
                  </div>

                  <h3 className="font-heading text-base font-semibold text-foreground">
                    {item.status === "returned"
                      ? "Teacher requested another attempt"
                      : item.status === "rejected"
                        ? "Photo needs to be retaken"
                        : "Turned in — waiting for teacher review"}
                  </h3>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.status === "returned"
                      ? "Your child's teacher reviewed this submission and requested another attempt. Earlier photo records remain safely archived in their history."
                      : item.status === "rejected"
                        ? "This photo could not be evaluated by the quality check. Please take a flatter, well-lit photo of the paper."
                        : "Your child's worksheet was successfully received. The teacher will share calibrated feedback and writing line guides after grading."}
                  </p>
                </div>

                {/* Teacher Return Note if present */}
                {item.returnNote && (
                  <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Teacher Note
                    </span>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {item.returnNote}
                    </p>
                  </div>
                )}

                {/* Target Text Card */}
                {item.targetText && (
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-1">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <FileText className="size-3 shrink-0" aria-hidden="true" />
                      Assigned Practice Text
                    </span>
                    <p className="text-sm font-semibold text-foreground italic truncate" title={item.targetText}>
                      &ldquo;{item.targetText}&rdquo;
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  {canSendNewPhoto && (
                    <Button
                      type="button"
                      onClick={() => {
                        onBack();
                        onUploadActivity?.(item.activityId);
                      }}
                      className="w-full h-10 min-h-[40px] gap-2 font-semibold cursor-pointer shadow-2xs"
                    >
                      <Camera className="size-4" aria-hidden="true" />
                      <span>Send new photo</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    className="w-full h-10 min-h-[40px] cursor-pointer"
                  >
                    {backLabel}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

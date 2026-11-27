"use client";

import { useMemo } from "react";
import { Camera, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WorksheetImageInspector } from "@/components/shared/worksheet-image-inspector";
import { useSubmissionImageUrl } from "@/lib/hooks/use-submissions";
import type { StudentScoreHistoryItem } from "@/lib/hooks/use-dashboard";
import { SubmissionCommentTabs } from "@/components/comments/submission-comment-tabs";

interface PendingWorksheetDialogProps {
  item: StudentScoreHistoryItem;
  childName: string;
  onBack: () => void;
  backLabel?: string;
  initialView?: "details" | "comments";
  onUploadActivity?: (activityId: string) => void;
}

export function PendingWorksheetDialog({
  item,
  childName,
  onBack,
  backLabel = "Back to history",
  initialView = "details",
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
      <DialogContent className="w-[calc(100%-1.5rem)] sm:w-[95vw] sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[min(94dvh,calc(100dvh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        {/* Header matching WorksheetViewDialog */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-card/80">
          <div className="flex items-center justify-between gap-3 pr-10">
            <div className="min-w-0 space-y-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-auto min-h-[40px] sm:min-h-[36px] px-2 py-1 mb-0.5 text-xs font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-200 cursor-pointer group touch-manipulation"
              >
                <ArrowLeft data-icon="inline-start" className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
                <span>{backLabel}</span>
              </Button>
              <DialogTitle className="font-heading text-base sm:text-lg font-semibold text-foreground truncate">
                Worksheet &amp; Review Status
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">{childName}</span>
                <span>&middot;</span>
                <time dateTime={item.submissionDate} className="font-sans tabular-nums">
                  {formattedDate}
                </time>
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

        {/* Content Body: Split view (Worksheet pinned left, Status & Notes tabbed right) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
            {/* Left Column: Photo Inspector */}
            <div className="lg:col-span-6 lg:sticky lg:top-0 flex flex-col w-full gap-3">
              <WorksheetImageInspector
                imageUrl={image.data}
                altText={`Handwriting worksheet submitted for ${childName}`}
                isLoading={image.isLoading}
                isError={image.isError}
                onRetry={() => image.refetch()}
                headerLabel="Handwritten Worksheet"
                showShortcutsLegend={false}
                collapsibleImageTools={true}
                flatFrame={true}
                keyboardScope="focused"
                aspectRatioClass="max-h-[min(640px,calc(100dvh-14rem))] min-h-[220px]"
              />
            </div>

            {/* Right Column: Tabbed Status & Notes */}
            <div className="lg:col-span-6 flex flex-col w-full min-w-0">
              <SubmissionCommentTabs
                key={item.submissionId}
                submissionId={item.submissionId}
                studentName={childName}
                initialView={initialView}
                detailsLabel="Status"
                commentsLabel="Comments"
                variant="default"
                open
              >
                <div className="space-y-4 w-full">
                  <Card className="p-0 gap-0 border-border/80 shadow-none">
                    <CardContent className="p-4 sm:p-5 space-y-4">
                      {/* Status Headline & Explanation */}
                      <div className="space-y-1.5">
                        <h3 className="font-heading text-base font-semibold text-foreground">
                          {item.status === "returned"
                            ? "New photo requested"
                            : item.status === "rejected"
                              ? "Clearer photo needed"
                              : "Waiting for teacher review"}
                        </h3>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item.status === "returned"
                            ? "Your teacher asked for another photo. Earlier uploads stay saved in history."
                            : item.status === "rejected"
                              ? "This photo couldn't be read clearly. Retake it flat in even light."
                              : "Worksheet received. Feedback will appear here once your teacher shares it."}
                        </p>
                      </div>

                      {/* Teacher Return Note if present */}
                      {item.returnNote && (
                        <div
                          role="status"
                          className="rounded-xl border border-band-2/40 bg-band-2/15 p-3 text-xs sm:text-sm space-y-1"
                        >
                          <p className="text-xs font-semibold text-band-2-text">
                            Teacher note
                          </p>
                          <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                            {item.returnNote}
                          </p>
                        </div>
                      )}

                      {/* Primary Action */}
                      {canSendNewPhoto && (
                        <div className="pt-2 border-t border-border/60">
                          <Button
                            type="button"
                            onClick={() => {
                              onBack();
                              onUploadActivity?.(item.activityId);
                            }}
                            className="w-full h-11 sm:h-9 gap-2 font-semibold cursor-pointer touch-manipulation"
                          >
                            <Camera className="size-4" aria-hidden="true" />
                            <span>Send new photo</span>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </SubmissionCommentTabs>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

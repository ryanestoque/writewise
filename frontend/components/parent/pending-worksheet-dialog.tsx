"use client";

import { useMemo } from "react";
import { Camera } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ResponsiveRichOverlay,
  ResponsiveRichOverlayBody,
  ResponsiveRichOverlayContent,
  ResponsiveRichOverlayDescription,
  ResponsiveRichOverlayHeader,
  ResponsiveRichOverlayTitle,
} from "@/components/shared/responsive-rich-overlay";
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
  initialView?: "details" | "comments";
  onUploadActivity?: (activityId: string) => void;
}

export function PendingWorksheetDialog({
  item,
  childName,
  onBack,
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
    <ResponsiveRichOverlay
      open
      onOpenChange={(open) => {
        if (!open) onBack();
      }}
    >
      <ResponsiveRichOverlayContent className="w-[calc(100%-1.5rem)] sm:w-[95vw] sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[min(94dvh,calc(100dvh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        {/* Header matching WorksheetViewDialog */}
        <ResponsiveRichOverlayHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-card/80">
          <div className="flex items-center justify-between gap-3 pr-12 sm:pr-10">
            <div className="min-w-0 flex flex-col gap-1">
              <ResponsiveRichOverlayTitle className="font-heading text-base sm:text-lg font-semibold text-foreground truncate">
                Worksheet &amp; Review Status
              </ResponsiveRichOverlayTitle>
              <ResponsiveRichOverlayDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
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
              </ResponsiveRichOverlayDescription>
            </div>
          </div>
        </ResponsiveRichOverlayHeader>

        {/* Content Body: Split view (Worksheet pinned left, Status & Notes tabbed right) */}
        <ResponsiveRichOverlayBody className="p-4 sm:p-6">
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
                <div className="flex flex-col gap-4 w-full">
                  <Card className="p-0 gap-0 border-border/80 shadow-none">
                    <CardContent className="p-4 sm:p-5 flex flex-col gap-4">
                      {/* Status Headline & Explanation */}
                      <div className="flex flex-col gap-1.5">
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
                        <Alert role="status" className="border-band-2/40 bg-band-2/15 p-3">
                          <AlertTitle className="text-xs font-semibold text-band-2-text">
                            Teacher note
                          </AlertTitle>
                          <AlertDescription className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                            {item.returnNote}
                          </AlertDescription>
                        </Alert>
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
                            className="w-full h-11 sm:h-9 font-semibold cursor-pointer touch-manipulation"
                          >
                            <Camera data-icon="inline-start" aria-hidden="true" />
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
        </ResponsiveRichOverlayBody>
      </ResponsiveRichOverlayContent>
    </ResponsiveRichOverlay>
  );
}

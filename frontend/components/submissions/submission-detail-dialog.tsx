"use client";

import {
  ResponsiveRichOverlay,
  ResponsiveRichOverlayContent,
} from "@/components/shared/responsive-rich-overlay";
import type { Submission } from "@/lib/hooks/use-submissions";
import {
  SubmissionDetailContent,
  formatDateFull,
  CRITERION_NAME_TO_FILTER,
  CRITERION_FILTER_TO_NAME,
} from "./submission-detail-content";

export {
  formatDateFull,
  CRITERION_NAME_TO_FILTER,
  CRITERION_FILTER_TO_NAME,
};

export interface SubmissionDetailDialogProps {
  submission: Submission | null;
  submissions?: Submission[];
  currentIndex?: number;
  onNavigate?: (submission: Submission) => void;
  activityTargetText?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmissionDetailDialog({
  submission,
  submissions,
  currentIndex,
  onNavigate,
  activityTargetText,
  open,
  onOpenChange,
}: SubmissionDetailDialogProps) {
  if (!submission) return null;

  return (
    <ResponsiveRichOverlay open={open} onOpenChange={onOpenChange}>
      <ResponsiveRichOverlayContent
        showCloseButton={false}
        className="w-[calc(100%-1.5rem)] sm:w-[95vw] sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[min(94dvh,calc(100dvh-2rem))] flex flex-col p-4 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-warm border border-border/80 bg-surface"
        sheetClassName="bg-surface p-4"
      >
        <SubmissionDetailContent
          key={submission.id}
          submission={submission}
          submissions={submissions}
          currentIndex={currentIndex}
          onNavigate={onNavigate}
          activityTargetText={activityTargetText}
          onClose={() => onOpenChange(false)}
          variant="modal"
          open={open}
        />
      </ResponsiveRichOverlayContent>
    </ResponsiveRichOverlay>
  );
}

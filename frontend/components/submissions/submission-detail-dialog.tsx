"use client";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import type { Submission } from "@/lib/hooks/use-submissions";
import {
  SubmissionDetailContent,
  getInitials,
  getAvatarColor,
  AVATAR_PALETTES,
  formatDateFull,
  CRITERION_NAME_TO_FILTER,
  CRITERION_FILTER_TO_NAME,
} from "./submission-detail-content";

export {
  getInitials,
  getAvatarColor,
  AVATAR_PALETTES,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-1.5rem)] sm:max-w-4xl lg:max-w-5xl max-h-[min(94dvh,calc(100vh-2rem))] flex flex-col p-4 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-xl border border-border/80 bg-surface dark:bg-card"
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
        />
      </DialogContent>
    </Dialog>
  );
}

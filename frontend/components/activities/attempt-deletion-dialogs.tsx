"use client";

import { memo } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/formatters";
import type { Submission } from "@/lib/hooks/use-submissions";
import type { Student } from "@/lib/hooks/use-students";

export interface AttemptDeletionDialogsProps {
  // Batch deletion state & handlers
  isBatchDeleteDialogOpen: boolean;
  onBatchDialogOpenChange: (open: boolean) => void;
  selectedCount: number;
  hiddenSelectedCount: number;
  unavailableSelectedCount: number;
  selectedSubmissions: Submission[];
  activeIds: Set<string>;
  students?: Student[];
  isBatchDeleting: boolean;
  hasSubmissionsError: boolean;
  isSubmissionsLoading: boolean;
  onConfirmBatchDelete: () => void;
  onClearSelection?: () => void;
  onClearHiddenSelection?: () => void;

  // Single attempt deletion state & handlers
  singleAttemptToDelete: Submission | null;
  onSingleAttemptDialogOpenChange: (open: boolean) => void;
  isSingleDeleting: boolean;
  onConfirmSingleDelete: () => void;

  // Student all attempts deletion state & handlers
  studentBatchToDelete: {
    studentName: string;
    submissions: Submission[];
  } | null;
  onStudentBatchDialogOpenChange: (open: boolean) => void;
  isStudentBatchDeleting: boolean;
  onConfirmStudentBatchDelete: () => void;
}

export const AttemptDeletionDialogs = memo(function AttemptDeletionDialogs({
  isBatchDeleteDialogOpen,
  onBatchDialogOpenChange,
  selectedCount,
  hiddenSelectedCount,
  unavailableSelectedCount,
  selectedSubmissions,
  activeIds,
  students,
  isBatchDeleting,
  hasSubmissionsError,
  isSubmissionsLoading,
  onConfirmBatchDelete,
  onClearSelection,
  onClearHiddenSelection,

  singleAttemptToDelete,
  onSingleAttemptDialogOpenChange,
  isSingleDeleting,
  onConfirmSingleDelete,

  studentBatchToDelete,
  onStudentBatchDialogOpenChange,
  isStudentBatchDeleting,
  onConfirmStudentBatchDelete }: AttemptDeletionDialogsProps) {
  return (
    <>
      {/* Batch Delete Confirmation Alert Dialog */}
      <AlertDialog open={isBatchDeleteDialogOpen} onOpenChange={onBatchDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} {selectedCount === 1 ? "attempt" : "attempts"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the uploaded worksheet{" "}
              {selectedCount === 1 ? "photo" : "photos"}, computer vision analysis, comments, and
              recorded rubric scores for the selected {selectedCount === 1 ? "attempt" : "attempts"}
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ScrollArea
            role="region"
            className="max-h-64 pr-3 text-sm"
            aria-label="Attempts selected for deletion"
            tabIndex={0}
          >
            <div className="flex flex-col gap-3">
              {hiddenSelectedCount > 0 && (
                <Alert
                  role="status"
                  className="border-band-2/40 bg-band-2/15 text-band-2-text *:data-[slot=alert-description]:text-band-2-text has-data-[slot=alert-action]:pr-32"
                >
                  <AlertCircle aria-hidden="true" />
                  <AlertDescription className="text-xs">
                    <strong>{hiddenSelectedCount}</strong> hidden{" "}
                    {hiddenSelectedCount === 1 ? "attempt is" : "attempts are"} included in this
                    deletion.
                  </AlertDescription>
                  {onClearHiddenSelection && (
                    <AlertAction>
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        onClick={onClearHiddenSelection}
                        className="h-auto p-0 font-semibold text-band-2-text underline hover:no-underline cursor-pointer"
                      >
                        Remove hidden
                      </Button>
                    </AlertAction>
                  )}
                </Alert>
              )}
              {unavailableSelectedCount > 0 && (
                <Alert
                  variant="destructive"
                  className="has-data-[slot=alert-action]:pr-28"
                >
                  <AlertDescription className="text-xs">
                    {unavailableSelectedCount} selected{" "}
                    {unavailableSelectedCount === 1 ? "attempt is" : "attempts are"} unavailable.
                  </AlertDescription>
                  {onClearSelection && (
                    <AlertAction>
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        onClick={onClearSelection}
                        className="h-auto p-0 font-semibold text-destructive underline hover:no-underline cursor-pointer"
                      >
                        Clear selection
                      </Button>
                    </AlertAction>
                  )}
                </Alert>
              )}
              <div className="flex flex-col gap-2">
                {selectedSubmissions.map((sub, index) => (
                  <div key={sub.id} className="flex flex-col gap-2">
                    {index > 0 && <Separator />}
                    <div className="flex flex-col gap-1 pb-1">
                      <strong className="break-words">
                        {sub.student?.full_name ??
                          students?.find((student) => student.id === sub.student_id)?.full_name ??
                          "Unknown student"}
                      </strong>
                      <span className="text-muted-foreground">
                        Uploaded {formatDate(sub.created_at)}
                      </span>
                      <span>
                        {activeIds.has(sub.id) ? "Official attempt" : "Past attempt"}
                        {sub.released_at ? " · Released to parents" : " · Not released"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isBatchDeleting}
              onClick={() => onBatchDialogOpenChange(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                isBatchDeleting ||
                !selectedCount ||
                unavailableSelectedCount > 0 ||
                hasSubmissionsError ||
                isSubmissionsLoading
              }
              onClick={(event) => {
                event.preventDefault();
                onConfirmBatchDelete();
              }}
            >
              {isBatchDeleting ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedCount} ${selectedCount === 1 ? "Attempt" : "Attempts"}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Attempt Delete Confirmation Dialog */}
      <AlertDialog
        open={!!singleAttemptToDelete}
        onOpenChange={onSingleAttemptDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this uploaded worksheet photo, computer vision analysis,
              comments, and recorded rubric scores. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isSingleDeleting}
              onClick={() => onSingleAttemptDialogOpenChange(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isSingleDeleting}
              onClick={onConfirmSingleDelete}
            >
              {isSingleDeleting ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Deleting...
                </>
              ) : (
                "Delete Attempt"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Student All Attempts Delete Confirmation Dialog */}
      <AlertDialog
        open={!!studentBatchToDelete}
        onOpenChange={onStudentBatchDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete all {studentBatchToDelete?.submissions.length} attempts for{" "}
              {studentBatchToDelete?.studentName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {studentBatchToDelete?.submissions.length} uploaded
              worksheet photos, computer vision analysis, comments, and recorded rubric scores for{" "}
              {studentBatchToDelete?.studentName} on this activity. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isStudentBatchDeleting}
              onClick={() => onStudentBatchDialogOpenChange(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isStudentBatchDeleting}
              onClick={onConfirmStudentBatchDelete}
            >
              {isStudentBatchDeleting ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Deleting...
                </>
              ) : (
                `Delete All ${studentBatchToDelete?.submissions.length} Attempts`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

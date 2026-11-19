"use client";

import { memo } from "react";
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
import { Loader2 } from "lucide-react";
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
  onConfirmStudentBatchDelete,
}: AttemptDeletionDialogsProps) {
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
          <div
            role="region"
            className="flex max-h-64 flex-col gap-3 overflow-y-auto text-sm"
            aria-label="Attempts selected for deletion"
            tabIndex={0}
          >
            {hiddenSelectedCount > 0 && (
              <div role="status" className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                <span>
                  <strong>{hiddenSelectedCount}</strong> hidden {hiddenSelectedCount === 1 ? "attempt is" : "attempts are"} included in this deletion.
                </span>
                {onClearHiddenSelection && (
                  <button
                    type="button"
                    onClick={onClearHiddenSelection}
                    className="underline hover:no-underline font-semibold cursor-pointer shrink-0"
                  >
                    Remove hidden
                  </button>
                )}
              </div>
            )}
            {unavailableSelectedCount > 0 && (
              <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                <span>
                  {unavailableSelectedCount} selected {unavailableSelectedCount === 1 ? "attempt is" : "attempts are"} unavailable.
                </span>
                {onClearSelection && (
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="underline hover:no-underline font-semibold cursor-pointer shrink-0"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            )}
            {selectedSubmissions.map((sub) => (
              <div key={sub.id} className="flex flex-col gap-1 border-b pb-2">
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
            ))}
          </div>
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
                  <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
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
                  <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
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
                  <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
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

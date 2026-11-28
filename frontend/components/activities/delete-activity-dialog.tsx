"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Spinner } from "@/components/ui/spinner";
import {
  type Activity,
  useDeleteActivity,
} from "@/lib/hooks/use-activities";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface DeleteActivityDialogProps {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteActivityDialog({
  activity,
  open,
  onOpenChange,
}: DeleteActivityDialogProps) {
  const { mutate: deleteActivity, isPending } = useDeleteActivity();

  if (!activity) return null;

  const submissionCount = activity.submissions?.length ?? 0;
  const hasSubmissions = submissionCount > 0;

  const handleDelete = () => {
    deleteActivity(activity.id, {
      onSuccess: () => {
        toast.add({ type: "success", title: "Activity deleted successfully." });
        onOpenChange(false);
      },
      onError: (error: Error) => {
        toast.add({ type: "error", title: error.message || "Failed to delete activity." });
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>
            {hasSubmissions ? "Cannot Delete Activity" : "Delete Activity"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasSubmissions
              ? "This activity contains existing student records and cannot be deleted."
              : "Are you sure you want to delete this activity? It will be permanently removed from your activities list."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-3">
          {/* Target Text Preview Box */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs sm:text-sm text-foreground italic line-clamp-3">
            &ldquo;{activity.target_text}&rdquo;
          </div>

          {hasSubmissions && (
            <Alert className="border-band-2/40 bg-band-2/15 text-band-2-text *:data-[slot=alert-description]:text-band-2-text">
              <AlertTriangle aria-hidden="true" />
              <AlertDescription className="text-xs leading-relaxed">
                This activity has <strong>{submissionCount}</strong> student{" "}
                {submissionCount === 1 ? "submission" : "submissions"}. To
                preserve student assessment history and grading data,
                activities with submissions cannot be deleted.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {hasSubmissions ? "Close" : "Cancel"}
          </AlertDialogCancel>
          {!hasSubmissions && (
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              {isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" aria-hidden="true" />
              )}
              Delete Activity
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

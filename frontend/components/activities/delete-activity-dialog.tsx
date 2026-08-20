"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  type Activity,
  useDeleteActivity,
} from "@/lib/hooks/use-activities";
import { Loader2, Trash2, AlertTriangle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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
        toast.success("Activity deleted successfully.");
        onOpenChange(false);
      },
      onError: (error: Error) => {
        toast.error(error.message || "Failed to delete activity.");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md p-5 sm:p-6 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border border-border/80 bg-surface dark:bg-card">
        <DialogHeader className="pb-3 text-left">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 items-center justify-center rounded-xl shrink-0 ${
                hasSubmissions
                  ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {hasSubmissions ? (
                <AlertCircle className="size-5" />
              ) : (
                <Trash2 className="size-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                {hasSubmissions ? "Cannot Delete Activity" : "Delete Activity"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {hasSubmissions
                  ? "This activity contains existing student records."
                  : "This action cannot be undone."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Target Text Preview Box */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs sm:text-sm text-foreground italic line-clamp-3">
            &ldquo;{activity.target_text}&rdquo;
          </div>

          {hasSubmissions ? (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                This activity has <strong>{submissionCount}</strong> student{" "}
                {submissionCount === 1 ? "submission" : "submissions"}. To
                preserve student assessment history and grading data,
                activities with submissions cannot be deleted.
              </p>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete this activity? It will be
              permanently removed from your activities list.
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end items-stretch sm:items-center gap-2 pt-4 mt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto text-muted-foreground hover:text-foreground text-xs sm:text-sm rounded-lg sm:rounded-xl font-medium cursor-pointer"
          >
            {hasSubmissions ? "Close" : "Cancel"}
          </Button>
          {!hasSubmissions && (
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
              className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl shadow-xs cursor-pointer"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1.5" />
              )}
              Delete Activity
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

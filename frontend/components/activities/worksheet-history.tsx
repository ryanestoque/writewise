"use client";

import Link from "next/link";
import { useState, type ReactElement } from "react";
import { toast } from "@/components/ui/toast";
import { useDeleteSubmission, type Submission } from "@/lib/hooks/use-submissions";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getRejectionSummary, resolveSubmissionScore } from "@/lib/utils/submission-status";
import { History, Eye, ArrowUpRight, Trash2 } from "lucide-react";

const uploadDate = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short" });

export function WorksheetHistory({
  activityId,
  studentName,
  attempts,
  officialId,
  queueQuery = "",
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSelectAttempt }: {
  activityId: string;
  studentName: string;
  attempts: Submission[];
  officialId: string | null;
  queueQuery?: string;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectAttempt?: (sub: Submission) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [attemptToDelete, setAttemptToDelete] = useState<{
    submission: Submission;
    attemptNumber: number;
  } | null>(null);
  const deleteMutation = useDeleteSubmission();
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = (nextOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }
    controlledOnOpenChange?.(nextOpen);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!attemptToDelete) return;
    const targetId = attemptToDelete.submission.id;
    const attemptNumber = attemptToDelete.attemptNumber;
    try {
      await deleteMutation.mutateAsync(targetId);
      toast.add({ type: "success", title: `Attempt ${attemptNumber} deleted.` });

      const remaining = attempts.filter((s) => s.id !== targetId);
      if (remaining.length === 0) {
        handleClose();
      } else if (onSelectAttempt && (attemptToDelete.submission.id === officialId || attempts[0]?.id === targetId)) {
        onSelectAttempt(remaining[0]);
      }
      setAttemptToDelete(null);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete attempt.";
      toast.add({ type: "error", title: errorMsg });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          trigger ?? (
            <Button variant="outline" className="min-h-11 sm:min-h-9">
              <History data-icon="inline-start" aria-hidden="true" />
              <span>Worksheet history ({attempts.length})</span>
              <span className="sr-only"> for {studentName}</span>
            </Button>
          )
        }
      />
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader className="pr-12 pb-2">
          <SheetTitle>Worksheet History</SheetTitle>
          <SheetDescription>
            {studentName} · {attempts.length} {attempts.length === 1 ? "attempt" : "attempts"} submitted, newest first.
            Inspect assessment feedback or switch displayed attempts.
          </SheetDescription>
        </SheetHeader>
        <ol className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-6 pb-6 pt-2">
          {attempts.map((attempt, index) => {
            const score = resolveSubmissionScore(attempt);
            const status =
              attempt.status === "completed"
                ? "Analysis ready"
                : attempt.status === "processing"
                  ? "Analyzing strokes…"
                  : attempt.status === "returned"
                    ? "Returned for revision"
                    : "Upload rejected";
            const isOfficial = attempt.id === officialId;

            return (
              <li key={attempt.id}>
                <Card size="sm" className="gap-2.5 p-4 shadow-2xs transition-colors hover:border-border/80">
                  <CardHeader className="p-0 flex flex-row flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle as="h3" className="text-sm font-semibold text-foreground">
                        Attempt {attempts.length - index}
                      </CardTitle>
                      {isOfficial && (
                        <Badge variant="outline" className="border-band-4/30 bg-band-4/10 text-band-4-text text-[11px] font-medium">
                          Official worksheet
                        </Badge>
                      )}
                      {attempt.released_at && (
                        <Badge variant="outline" className="text-[11px] border-border text-muted-foreground">
                          Shared with parents
                        </Badge>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground tabular-nums" dateTime={attempt.created_at}>
                      {uploadDate.format(new Date(attempt.created_at))}
                    </time>
                  </CardHeader>

                  <CardContent className="p-0 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{status}</span>
                      {score.compositeScore != null && (
                        <Badge variant="outline" className={cn("text-xs font-semibold tabular-nums", score.scoreBand.className)}>
                          {Math.round(score.compositeScore)}% · {score.scoreBand.band}
                        </Badge>
                      )}
                    </div>

                    {attempt.status === "rejected" && (
                      <Alert variant="destructive" className="px-3 py-2 text-xs">
                        <AlertDescription className="text-xs">
                          {getRejectionSummary(attempt.rejection_code).detail}
                        </AlertDescription>
                      </Alert>
                    )}
                    {attempt.status === "returned" && attempt.return_note && (
                      <Alert className="bg-muted/40 px-3 py-2 text-xs">
                        <AlertDescription className="whitespace-pre-wrap break-words text-xs">
                          <strong className="text-foreground">Return note: </strong>
                          {attempt.return_note}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>

                  <Separator />

                  <CardFooter className="p-0 flex flex-wrap items-center gap-2">
                    <Button
                      nativeButton={false}
                      size="sm"
                      className="min-h-9 text-xs font-semibold"
                      render={
                        <Link
                          href={`/activities/${activityId}/submissions/${attempt.id}${queueQuery}`}
                          onClick={handleClose}
                        />
                      }
                    >
                      <span>Open worksheet</span>
                      <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
                      <span className="sr-only"> · Attempt {attempts.length - index} for {studentName}</span>
                    </Button>

                    {onSelectAttempt && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onSelectAttempt(attempt);
                          handleClose();
                        }}
                        className="min-h-9 text-xs font-medium"
                      >
                        <Eye data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
                        <span>Preview on card</span>
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() =>
                        setAttemptToDelete({
                          submission: attempt,
                          attemptNumber: attempts.length - index })
                      }
                      className="ml-auto min-h-9 text-xs font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 data-icon="inline-start" aria-hidden="true" />
                      <span>Delete</span>
                      <span className="sr-only">
                        {" "}
                        · Attempt {attempts.length - index} for {studentName}
                      </span>
                    </Button>
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ol>

        <AlertDialog
          open={!!attemptToDelete}
          onOpenChange={(isOpen) => {
            if (!isOpen && !deleteMutation.isPending) {
              setAttemptToDelete(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete Attempt {attemptToDelete?.attemptNumber}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this worksheet attempt, computer vision analysis,
                comments, and rubric scores for {studentName}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={deleteMutation.isPending}
                onClick={() => setAttemptToDelete(null)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={handleConfirmDelete}
              >
                {deleteMutation.isPending ? (
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
      </SheetContent>
    </Sheet>
  );
}

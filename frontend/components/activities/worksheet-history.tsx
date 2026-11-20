"use client";

import Link from "next/link";
import { useState, type ReactElement } from "react";
import type { Submission } from "@/lib/hooks/use-submissions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getRejectionSummary, resolveSubmissionScore } from "@/lib/utils/submission-status";
import { History, Eye, ArrowUpRight } from "lucide-react";

const uploadDate = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
});

export function WorksheetHistory({
  activityId,
  studentName,
  attempts,
  officialId,
  queueQuery = "",
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSelectAttempt,
}: {
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          trigger ?? (
            <Button variant="outline" className="min-h-11 sm:min-h-9 gap-1.5">
              <History className="size-3.5" aria-hidden="true" />
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
              <li
                key={attempt.id}
                className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4 shadow-2xs transition-colors hover:border-border/80"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      Attempt {attempts.length - index}
                    </h3>
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
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{status}</span>
                  {score.compositeScore != null && (
                    <Badge variant="outline" className={`text-xs font-semibold tabular-nums ${score.scoreBand.className}`}>
                      {Math.round(score.compositeScore)}% · {score.scoreBand.band}
                    </Badge>
                  )}
                </div>

                {attempt.status === "rejected" && (
                  <p className="text-xs text-destructive bg-destructive/5 rounded-md p-2 border border-destructive/20">
                    {getRejectionSummary(attempt.rejection_code).detail}
                  </p>
                )}
                {attempt.status === "returned" && attempt.return_note && (
                  <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground bg-muted/40 rounded-md p-2 border border-border/60">
                    <strong className="text-foreground">Return note: </strong>
                    {attempt.return_note}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
                  <Link
                    className={buttonVariants({
                      variant: "default",
                      size: "sm",
                      className: "min-h-9 gap-1 text-xs font-semibold",
                    })}
                    href={`/activities/${activityId}/submissions/${attempt.id}${queueQuery}`}
                    onClick={handleClose}
                  >
                    <span>Open worksheet</span>
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                    <span className="sr-only"> · Attempt {attempts.length - index} for {studentName}</span>
                  </Link>

                  {onSelectAttempt && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onSelectAttempt(attempt);
                        handleClose();
                      }}
                      className="min-h-9 gap-1 text-xs font-medium cursor-pointer"
                    >
                      <Eye className="size-3 text-muted-foreground" aria-hidden="true" />
                      <span>Preview on card</span>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </SheetContent>
    </Sheet>
  );
}

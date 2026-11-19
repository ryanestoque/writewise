"use client";

import Link from "next/link";
import type { Submission } from "@/lib/hooks/use-submissions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getRejectionSummary, resolveSubmissionScore } from "@/lib/utils/submission-status";

const uploadDate = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
});

export function WorksheetHistory({ activityId, studentName, attempts, officialId, queueQuery }: {
  activityId: string;
  studentName: string;
  attempts: Submission[];
  officialId: string | null;
  queueQuery: string;
}) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" className="min-h-11 sm:min-h-9" />}>
        Worksheet history ({attempts.length})
        <span className="sr-only"> for {studentName}</span>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="pr-16">
          <SheetTitle>Worksheet history</SheetTitle>
          <SheetDescription>
            {studentName} · {attempts.length} {attempts.length === 1 ? "upload" : "uploads"}, newest first.
            Open a worksheet to inspect its assessment and feedback.
          </SheetDescription>
        </SheetHeader>
        <ol className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
          {attempts.map((attempt, index) => {
            const score = resolveSubmissionScore(attempt);
            const status = attempt.status === "completed" ? "Analysis ready"
              : attempt.status === "processing" ? "Processing"
                : attempt.status === "returned" ? "Returned for revision" : "Upload rejected";
            return (
              <li key={attempt.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">Attempt {attempts.length - index}</h3>
                  {attempt.id === officialId && <Badge variant="secondary">Official worksheet</Badge>}
                  {attempt.released_at && <Badge variant="outline">Shared with parents</Badge>}
                </div>
                <time className="text-sm text-muted-foreground" dateTime={attempt.created_at}>
                  {uploadDate.format(new Date(attempt.created_at))}
                </time>
                <p className="text-sm">{status}</p>
                {attempt.status === "rejected" && (
                  <p className="text-sm text-muted-foreground">{getRejectionSummary(attempt.rejection_code).detail}</p>
                )}
                {attempt.status === "returned" && attempt.return_note && (
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{attempt.return_note}</p>
                )}
                {score.compositeScore != null && (
                  <Badge variant="outline" className={score.scoreBand.className}>
                    {Math.round(score.compositeScore)}% · {score.scoreBand.band}
                  </Badge>
                )}
                <Link className={buttonVariants({ variant: "outline", className: "min-h-11 self-start" })}
                  href={`/activities/${activityId}/submissions/${attempt.id}${queueQuery}`}>
                  Open worksheet<span className="sr-only"> · Attempt {attempts.length - index} for {studentName}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </SheetContent>
    </Sheet>
  );
}

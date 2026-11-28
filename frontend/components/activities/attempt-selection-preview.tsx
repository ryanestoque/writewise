import { Fragment } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Submission } from "@/lib/hooks/use-submissions";
import { statusConfig } from "@/lib/utils/submission-status";

const uploadedAt = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function AttemptSelectionPreview({
  entries,
  studentCount,
  hiddenCount,
  unavailableCount,
  studentNames,
}: {
  entries: { attempt: Submission; hidden: boolean }[];
  studentCount: number;
  hiddenCount: number;
  unavailableCount: number;
  studentNames: ReadonlyMap<string, string>;
}) {
  return (
    <section aria-label="Selected attempts" className="flex min-w-0 flex-col gap-3 text-sm">
      <p>
        {entries.length} {entries.length === 1 ? "attempt" : "attempts"} from {studentCount}{" "}
        {studentCount === 1 ? "student" : "students"}. {hiddenCount}{" "}
        {hiddenCount === 1 ? "attempt is" : "attempts are"} hidden in the current view.
      </p>
      {hiddenCount > 0 && (
        <p className="text-muted-foreground">
          Hidden attempts include older worksheets or selections outside your current filters. They
          will also be deleted.
        </p>
      )}
      {unavailableCount > 0 && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>
            {unavailableCount} selected {unavailableCount === 1 ? "attempt is" : "attempts are"} no
            longer available to review. Cancel, clear your selection, and select attempts again.
          </AlertDescription>
        </Alert>
      )}
      <ScrollArea
        role="region"
        aria-label="Review every selected attempt"
        className="rounded-lg border"
        viewportClassName="max-h-60 px-3"
      >
        <ul className="flex flex-col">
          {entries.map(({ attempt, hidden }, index) => (
            <Fragment key={attempt.id}>
              {index > 0 && <Separator />}
              <li className="flex flex-col gap-1 py-3">
                <span className="font-medium break-words">
                  {attempt.student?.full_name ??
                    studentNames.get(attempt.student_id) ??
                    "Unknown student"}
                </span>
                <time className="text-muted-foreground" dateTime={attempt.created_at}>
                  {uploadedAt.format(new Date(attempt.created_at))}
                </time>
                <span className="text-muted-foreground">
                  {statusConfig[attempt.status].label}
                  {hidden ? " · Hidden in current view" : ""}
                </span>
              </li>
            </Fragment>
          ))}
        </ul>
      </ScrollArea>
    </section>
  );
}

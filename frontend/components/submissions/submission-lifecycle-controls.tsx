"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  useActivityWork,
  useReturnSubmission,
  useReleaseSubmission,
  useReleaseActivity,
  useUpdateStudentWork,
  type ActivityWorkState,
} from "@/lib/hooks/use-activity-work";
import type { Submission } from "@/lib/hooks/use-submissions";
import type { components } from "@/types/api";
import { ApiError } from "@/lib/utils/api-error";
import { teacherWorkStatusLabel } from "@/lib/utils/activity-work";
import { resolveSubmissionScore } from "@/lib/utils/submission-status";
import {
  toActivityDueAt,
  toActivityDueInput,
  formatActivityDueAt,
} from "@/lib/utils/activity-deadlines";
import { useActivityNow } from "@/components/activities/activity-work-status";

const REASONS: { value: components["schemas"]["ReturnReason"]; label: string }[] = [
  { value: "wrong_worksheet", label: "Wrong worksheet" },
  { value: "blurry_or_cropped", label: "Blurry or cropped photo" },
  { value: "wrong_target_text", label: "Wrong target text" },
  { value: "incomplete", label: "Incomplete work" },
  { value: "other", label: "Other" },
];

export function workActionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "SUBMISSION_NOT_RETURNABLE")
      return "This attempt has changed and cannot be returned. Refresh and try again.";
    if (error.code === "SUBMISSION_NOT_RELEASABLE")
      return "Choose the official graded worksheet before sharing its result.";
    if (error.code === "INVALID_WORK_SELECTION")
      return "Choose a completed attempt for this student and activity.";
    if (error.code === "NOT_FOUND")
      return "This work is no longer available. Refresh the activity.";
  }
  return error instanceof Error ? error.message : "Could not save the change. Please try again.";
}

function ReturnForm({ submission, onDone }: { submission: Submission; onDone: () => void }) {
  const id = useId();
  const [reason, setReason] = useState<components["schemas"]["ReturnReason"]>("incomplete");
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useReturnSubmission();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        submissionId: submission.id,
        body: {
          reason,
          note: note.trim() || null,
          ...(due ? { resubmit_due_at: toActivityDueAt(due) } : {}),
        },
      });
      toast.success("Worksheet returned. The previous attempt stays in history.");
      onDone();
    } catch (error) {
      setError(workActionError(error));
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-reason`}>Reason</FieldLabel>
          <NativeSelect
            id={`${id}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value as typeof reason)}
            disabled={mutation.isPending}
          >
            {REASONS.map((item) => (
              <NativeSelectOption key={item.value} value={item.value}>
                {item.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-note`}>Note for the parent (optional)</FieldLabel>
          <Textarea
            id={`${id}-note`}
            value={note}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
            disabled={mutation.isPending}
          />
          <FieldDescription>Visible in worksheet history. Up to 2,000 characters.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-due`}>Resubmission deadline (optional)</FieldLabel>
          <Input
            id={`${id}-due`}
            type="datetime-local"
            value={due}
            onChange={(event) => setDue(event.target.value)}
            disabled={mutation.isPending}
          />
          <FieldDescription>
            Manila time. Leave blank to keep the current deadline.
          </FieldDescription>
        </Field>
      </FieldGroup>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Returning…" : "Return worksheet"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SubmissionLifecycleControls({ submission, showRelease = true }: { submission: Submission; showRelease?: boolean }) {
  const focusTarget = useRef<HTMLElement>(null);
  const { data: states, isError } = useActivityWork(submission.activity_id);
  const work = states?.find((row) => row.student_id === submission.student_id);
  const release = useReleaseSubmission();
  const update = useUpdateStudentWork();
  const [returnOpen, setReturnOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = work?.active_submission_id === submission.id;
  const completed = submission.status === "completed";
  const pending = release.isPending || update.isPending;
  async function act(action: "release" | "pin" | "unpin") {
    setError(null);
    try {
      if (action === "release") await release.mutateAsync(submission.id);
      else
        await update.mutateAsync({
          activityId: submission.activity_id,
          studentId: submission.student_id,
          body: { pinned_submission_id: action === "pin" ? submission.id : null },
        });
      toast.success(
        action === "release" ? "Result shared with parents." : "Official worksheet updated."
      );
    } catch (error) {
      setError(workActionError(error));
    }
  }
  return (
    <section
      aria-label="Worksheet return and sharing"
      ref={focusTarget}
      tabIndex={-1}
      className="border-border bg-card my-3 flex flex-col gap-3 rounded-xl border p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {submission.status === "returned"
            ? "Returned"
            : !work
              ? "Loading work status…"
              : active
                ? teacherWorkStatusLabel(work.work_status)
                : "Historical attempt"}
        </Badge>
        {active && <Badge variant="outline">Official worksheet</Badge>}
        {work?.pinned_submission_id === submission.id && <Badge variant="outline">Pinned</Badge>}
        {completed && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReturnOpen(true)}
            disabled={pending}
          >
            Return
          </Button>
        )}
        {showRelease && completed &&
          active &&
          !submission.released_at &&
          resolveSubmissionScore(submission).isScored && (
            <Button size="sm" onClick={() => act("release")} disabled={pending}>
              Share result with parents
            </Button>
          )}
        {completed && !active && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => act("pin")}
            disabled={pending || !work}
          >
            Use as official worksheet
          </Button>
        )}
        {work?.pinned_submission_id && (
          <Button size="sm" variant="ghost" onClick={() => act("unpin")} disabled={pending}>
            Use automatic selection
          </Button>
        )}
      </div>
      {submission.status === "returned" && (
        <div className="flex flex-col gap-1 text-sm">
          <p>
            Reason:{" "}
            {REASONS.find((reason) => reason.value === submission.return_reason)?.label ??
              submission.return_reason}
          </p>
          {submission.return_note && (
            <p className="whitespace-pre-wrap">{submission.return_note}</p>
          )}
          <p className="text-muted-foreground">
            This attempt is kept in history and does not count toward progress.
          </p>
        </div>
      )}
      {completed && active && !submission.released_at && (
        <p className="text-muted-foreground text-sm">
          The parent can see the upload. Choose Share result with parents to make scores and
          diagnostic feedback visible too.
        </p>
      )}
      {(error || isError) && (
        <p role="alert" className="text-destructive text-sm">
          {error ?? "Could not load the current work status. Refresh to try again."}
        </p>
      )}
      <Dialog open={returnOpen} onOpenChange={(open) => setReturnOpen(open)}>
        <DialogContent finalFocus={focusTarget}>
          <DialogHeader>
            <DialogTitle>Return worksheet</DialogTitle>
            <DialogDescription>
              Request another attempt from {submission.student.full_name}. The existing photo and
              rubric are kept.
            </DialogDescription>
          </DialogHeader>
          {returnOpen && (
            <ReturnForm
              key={submission.id}
              submission={submission}
              onDone={() => setReturnOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function WorkSettingsForm({
  activityId,
  studentId,
  state,
  attempts,
  onDone,
}: {
  activityId: string;
  studentId: string;
  state: ActivityWorkState | null;
  attempts: Submission[];
  onDone: () => void;
}) {
  const id = useId();
  const [due, setDue] = useState(toActivityDueInput(state?.due_at_override ?? null));
  const [pin, setPin] = useState(state?.pinned_submission_id ?? "");
  const [dueEdited, setDueEdited] = useState(false);
  const [pinEdited, setPinEdited] = useState(false);
  const selectedAttempt = attempts.find(
    (attempt) => attempt.id === pin && attempt.status === "completed",
  );
  const selectedScore = resolveSubmissionScore(selectedAttempt);
  const now = useActivityNow();
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateStudentWork();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!dueEdited && !pinEdited) {
      setError("Change a deadline or official worksheet before saving.");
      return;
    }
    try {
      await update.mutateAsync({
        activityId,
        studentId,
        body: {
          ...(dueEdited ? { due_at_override: toActivityDueAt(due) } : {}),
          ...(pinEdited ? { pinned_submission_id: pin || null } : {}),
        },
      });
      toast.success("Student work updated.");
      onDone();
    } catch (error) {
      setError(workActionError(error));
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-due`}>Student deadline</FieldLabel>
          <Input
            id={`${id}-due`}
            type="datetime-local"
            value={due}
            onChange={(event) => {
              setDue(event.target.value);
              setDueEdited(true);
            }}
            disabled={update.isPending}
          />
          <FieldDescription>
            Manila time. Clear this field to use the activity deadline.
            {state?.effective_due_at &&
              ` Current effective deadline: ${formatActivityDueAt(state.effective_due_at)}.`}
          </FieldDescription>
          {due && Date.parse(`${due}:00+08:00`) < now && (
            <p className="text-muted-foreground text-sm">
              This deadline has passed. Work without an official worksheet will be Missing.
            </p>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-pin`}>Official worksheet</FieldLabel>
          <NativeSelect
            id={`${id}-pin`}
            className="w-full min-w-0 max-w-full"
            value={pin}
            onChange={(event) => {
              setPin(event.target.value);
              setPinEdited(true);
            }}
            disabled={update.isPending}
          >
            <NativeSelectOption value="">
              Automatic: latest eligible completed attempt
            </NativeSelectOption>
            {attempts
              .filter((row) => row.status === "completed")
              .map((row) => {
                const { compositeScore, scoreBand } = resolveSubmissionScore(row);
                const score = compositeScore == null
                  ? "Not scored yet"
                  : `${Math.round(compositeScore)}% · ${scoreBand.band}`;
                return (
                  <NativeSelectOption key={row.id} value={row.id}>
                    {new Date(row.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                    {` · ${score}${row.id === state?.active_submission_id ? " · Current official" : ""}`}
                  </NativeSelectOption>
                );
              })}
          </NativeSelect>
          <FieldDescription>
            Pin an older completed attempt to keep it as the official worksheet after a return.
          </FieldDescription>
          {selectedAttempt && (
            <div className="flex flex-col items-start gap-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">
                Uploaded{" "}
                <time dateTime={selectedAttempt.created_at}>
                  {formatActivityDueAt(selectedAttempt.created_at)}
                </time>
                {" · Manila time"}
              </p>
              <p>
                {selectedScore.compositeScore == null
                  ? "Not scored yet"
                  : `${Math.round(selectedScore.compositeScore)}% · ${selectedScore.scoreBand.band}`}
                {selectedAttempt.id === state?.active_submission_id && " · Current official worksheet"}
              </p>
              <p>Inspect this worksheet before saving your choice.</p>
              <Link
                href={`/activities/${activityId}/submissions/${selectedAttempt.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({
                  variant: "outline",
                  className: "min-h-11 h-auto whitespace-normal",
                })}
              >
                Inspect selected worksheet (opens in new tab)
              </Link>
              <p className="text-muted-foreground">Your selection is saved only when you choose Save work settings.</p>
            </div>
          )}
        </Field>
      </FieldGroup>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={update.isPending || (!dueEdited && !pinEdited)}>
          {update.isPending ? "Saving…" : "Save work settings"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function StudentWorkControls(props: {
  activityId: string;
  studentId: string;
  studentName: string;
  state: ActivityWorkState | null;
  attempts: Submission[];
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        ref={trigger}
        className="min-h-11 sm:min-h-9"
        aria-label={`Work settings for ${props.studentName}`}
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={!props.state}
      >
        Work settings
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent finalFocus={trigger}>
          <DialogHeader>
            <DialogTitle>Work settings</DialogTitle>
            <DialogDescription>
              {props.studentName}: deadline and official worksheet.
            </DialogDescription>
          </DialogHeader>
          {open && <WorkSettingsForm {...props} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReleaseActivityButton({ activityId }: { activityId: string }) {
  const focusTarget = useRef<HTMLSpanElement>(null);
  const { data: states, isLoading, isError, refetch } = useActivityWork(activityId);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useReleaseActivity();
  const count = states?.filter((row) => row.work_status === "Draft").length ?? 0;
  async function release() {
    setError(null);
    try {
      const result = await mutation.mutateAsync(activityId);
      toast.success(
        `Shared ${result.released_count} worksheet ${result.released_count === 1 ? "result" : "results"} and ${result.released_grade_count} point ${result.released_grade_count === 1 ? "grade" : "grades"} with parents.`
      );
      setOpen(false);
    } catch (error) {
      setError(workActionError(error));
    }
  }
  return (
    <span ref={focusTarget} tabIndex={-1} className="inline-flex flex-col items-start gap-2">
      <Button
        variant="outline"
        className="min-h-11 sm:min-h-9"
        disabled={isLoading || isError || mutation.isPending}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Share results and grades
      </Button>
      <span className="text-xs text-muted-foreground" role="status">
        {isLoading ? "Loading worksheet status…" : isError ? "Worksheet status unavailable." : `${count} worksheet results need review. Point grades checked separately.`}
      </span>
      {isError && <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={() => void refetch()}>Retry status</Button>}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!mutation.isPending) setOpen(next);
        }}
      >
        <DialogContent finalFocus={focusTarget}>
          <DialogHeader>
            <DialogTitle>Share activity results and grades with parents?</DialogTitle>
            <DialogDescription>
              Share all eligible worksheet results and point grades for this activity across its
              assigned sections. This includes draft overrides and zeros, even without uploads.
              Excused work is skipped. A worksheet&apos;s assessment and diagnostic feedback are shared
              only when that attempt is scored.
            </DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {count} worksheet {count === 1 ? "result needs" : "results need"} review.
            Point grades may be eligible even without worksheets needing review. The server checks eligibility when sharing and reports what was shared.
          </p>
          <a href="/gradebook" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Review point grades in gradebook</a>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button className="min-h-11 sm:min-h-9" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button className="min-h-11 sm:min-h-9" onClick={release} disabled={mutation.isPending}>
              {mutation.isPending ? "Sharing…" : "Share all eligible results and grades"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}

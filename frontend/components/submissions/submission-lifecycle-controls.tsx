"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
      return "Choose the active graded attempt before releasing its result.";
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

export function SubmissionLifecycleControls({ submission }: { submission: Submission }) {
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
        action === "release" ? "Result released to the parent." : "Counted attempt updated."
      );
    } catch (error) {
      setError(workActionError(error));
    }
  }
  return (
    <section
      aria-label="Worksheet return and release"
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
                ? work.work_status
                : "Historical attempt"}
        </Badge>
        {active && <Badge variant="outline">Counted attempt</Badge>}
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
        {completed &&
          active &&
          !submission.released_at &&
          resolveSubmissionScore(submission).isScored && (
            <Button size="sm" onClick={() => act("release")} disabled={pending}>
              Release result
            </Button>
          )}
        {completed && !active && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => act("pin")}
            disabled={pending || !work}
          >
            Count this attempt
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
          The parent can see the upload. Scores and diagnostic feedback are shared when you release
          the result.
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
  const now = useActivityNow();
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateStudentWork();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!dueEdited && !pinEdited) {
      setError("Change a deadline or counted attempt before saving.");
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
              This deadline has passed. Work without a counted attempt will be Missing.
            </p>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-pin`}>Counted attempt</FieldLabel>
          <NativeSelect
            id={`${id}-pin`}
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
              .map((row) => (
                <NativeSelectOption key={row.id} value={row.id}>
                  {new Date(row.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                </NativeSelectOption>
              ))}
          </NativeSelect>
          <FieldDescription>
            A pin can count an older completed attempt after a Return.
          </FieldDescription>
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
              {props.studentName}: deadline and counted attempt.
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
  const { data: states } = useActivityWork(activityId);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useReleaseActivity();
  const count = states?.filter((row) => row.work_status === "Draft").length ?? 0;
  async function release() {
    setError(null);
    try {
      const result = await mutation.mutateAsync(activityId);
      toast.success(
        `Released ${result.released_count} ${result.released_count === 1 ? "result" : "results"}.`
      );
      setOpen(false);
    } catch (error) {
      setError(workActionError(error));
    }
  }
  return (
    <span ref={focusTarget} tabIndex={-1} className="inline-flex">
      <Button
        variant="outline"
        disabled={!count}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Release results ({count})
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!mutation.isPending) setOpen(next);
        }}
      >
        <DialogContent finalFocus={focusTarget}>
          <DialogHeader>
            <DialogTitle>Release results to parents?</DialogTitle>
            <DialogDescription>
              Share {count} active graded {count === 1 ? "result" : "results"}, including scores and
              diagnostic feedback. Returned and ungraded attempts are skipped.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button onClick={release} disabled={mutation.isPending}>
              {mutation.isPending ? "Releasing…" : "Release results"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}

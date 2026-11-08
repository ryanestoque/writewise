"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAuthToken } from "@/lib/supabase/auth-helper";
import { useActiveGradebookAccount, type GradebookCell } from "@/lib/hooks/use-gradebook";
import type { ActivityWorkState } from "@/lib/hooks/use-activity-work";
import type { Submission } from "@/lib/hooks/use-submissions";
import {
  StudentWorkControls,
  SubmissionLifecycleControls,
} from "@/components/submissions/submission-lifecycle-controls";
import { QueryRecovery } from "@/components/shared/query-recovery";

export function WorkGradeDetails({
  userId,
  cell,
  studentName,
}: {
  userId: string;
  cell: GradebookCell;
  studentName?: string;
}) {
  const active = useActiveGradebookAccount(userId);
  const query = useQuery({
    queryKey: ["gradebook", userId, "work-details", cell.activity_id, cell.student_id],
    enabled: active,
    queryFn: async ({ signal }) => {
      const supabase = createClient();
      const token = await getAuthToken(supabase);
      const verified = await supabase.auth.getUser(token);
      if (verified.error || verified.data.user?.id !== userId)
        throw new DOMException("The account changed.", "AbortError");
      const [work, attempts] = await Promise.all([
        supabase
          .from("activity_work_state")
          .select("*")
          .eq("activity_id", cell.activity_id)
          .eq("student_id", cell.student_id)
          .abortSignal(signal),
        supabase
          .from("submission")
          .select("*,student:student_id(full_name),measurement(*),manual_score(*)")
          .eq("activity_id", cell.activity_id)
          .eq("student_id", cell.student_id)
          .order("created_at", { ascending: false })
          .abortSignal(signal),
      ]);
      const current = await supabase.auth.getSession();
      if (
        signal.aborted ||
        current.data.session?.user.id !== userId ||
        current.data.session.access_token !== token
      )
        throw new DOMException("The account changed.", "AbortError");
      if (work.error || attempts.error) throw new Error("Could not load work settings.");
      return {
        work: (work.data[0] as ActivityWorkState | undefined) ?? null,
        attempts: attempts.data.map((row) => ({
          ...row,
          measurement: Array.isArray(row.measurement)
            ? (row.measurement[0] ?? null)
            : row.measurement,
          manual_score: Array.isArray(row.manual_score)
            ? (row.manual_score[0] ?? null)
            : row.manual_score,
        })) as unknown as Submission[],
      };
    },
    retry: false,
  });
  if (!active) return null;
  if (query.isError)
    return (
      <QueryRecovery
        title="Work settings could not be loaded"
        description="Try again to adjust the deadline or counted attempt."
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  if (!query.data)
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Loading work settings…
      </p>
    );
  const source = query.data.attempts.find(
    (attempt) => attempt.id === query.data.work?.active_submission_id
  );
  return (
    <section className="space-y-3 border-t pt-4" aria-label="Deadline, counted attempt and Return">
      <StudentWorkControls
        activityId={cell.activity_id}
        studentId={cell.student_id}
        studentName={studentName ?? "Student"}
        state={query.data.work}
        attempts={query.data.attempts}
      />
      {source && <SubmissionLifecycleControls submission={source} showRelease={false} />}
      <p className="text-muted-foreground text-xs">
        After changing the counted attempt or returning work, close this panel and review its
        refreshed grade before release.
      </p>
    </section>
  );
}

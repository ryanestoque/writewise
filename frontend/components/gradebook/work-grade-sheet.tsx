"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useGradebookActions, type GradebookCell } from "@/lib/hooks/use-gradebook";
import { ApiError } from "@/lib/utils/api-error";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { PointsField, validPointsInput } from "./points-field";
import { WorkGradeDetails } from "./work-grade-details";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StudentWorkThread } from "@/components/comments/student-work-thread";

export function WorkGradeSheet({
  userId,
  cell,
  open,
  onOpenChange,
  studentName,
  activityTitle,
  initialView = "work",
}: {
  userId: string;
  cell: GradebookCell | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName?: string;
  activityTitle?: string;
  initialView?: "work" | "comments";
}) {
  const actions = useGradebookActions(userId);
  const [override, setOverride] = useState(cell?.points_override ?? "");
  const [error, setError] = useState<string | undefined>();
  const [view, setView] = useState<"work" | "comments">(initialView);
  const pending = Object.values(actions).some((action) => action.isPending);
  if (!cell) return null;
  const target = { activityId: cell.activity_id, studentId: cell.student_id };
  const excused = cell.coursework_status === "Excused";
  const valid = validPointsInput(override, true, Number(cell.points_possible));
  async function run(task: () => Promise<unknown>, message: string) {
    setError(undefined);
    try {
      await task();
      toast.success(message);
      onOpenChange(false);
    } catch (failure) {
      if (failure instanceof Error && failure.name === "AbortError") return;
      setError(
        failure instanceof ApiError && failure.code === "GRADE_REVISION_CONFLICT"
          ? "This grade changed. Close this panel and review the refreshed grade before releasing."
          : failure instanceof ApiError
            ? failure.message
            : "Could not save this work. Try again."
      );
    }
  }
  const update = (
    body: Parameters<typeof actions.updateWork.mutateAsync>[0]["body"],
    message: string
  ) => run(() => actions.updateWork.mutateAsync({ ...target, body }), message);
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <SheetContent className="w-full overflow-hidden sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{studentName ?? "Work grade"}</SheetTitle>
          {activityTitle && <p className="text-sm font-medium">{activityTitle}</p>}
          <SheetDescription>
            Saved point changes stay draft until you release them. Handwriting assessment remains
            separate.
          </SheetDescription>
        </SheetHeader>
        <Tabs
          value={view}
          onValueChange={(value) => {
            if (!pending) setView(value as "work" | "comments");
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-4 shrink-0">
            <TabsTrigger value="work" disabled={pending}>
              Work
            </TabsTrigger>
            <TabsTrigger value="comments" disabled={pending}>
              Comments
            </TabsTrigger>
          </TabsList>
          <TabsContent value="comments" className="flex min-h-0 flex-1 flex-col">
            {open && view === "comments" && (
              <StudentWorkThread
                key={`${userId}:${cell.activity_id}:${cell.student_id}`}
                userId={userId}
                target={target}
                open
              />
            )}
          </TabsContent>
          <TabsContent value="work" className="overflow-y-auto">
            <div className="space-y-6 px-4 pb-6">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Coursework</dt>
                <dd>
                  {cell.coursework_status}
                  {cell.late ? " · Late" : ""}
                </dd>
                <dt className="text-muted-foreground">Automatic points</dt>
                <dd className="tabular-nums">{cell.automatic_points ?? "No scored attempt"}</dd>
                <dt className="text-muted-foreground">Current points</dt>
                <dd className="tabular-nums">
                  {cell.final_points ?? "No grade"}
                  {cell.points_possible ? ` / ${cell.points_possible}` : ""}
                </dd>
                <dt className="text-muted-foreground">Publication</dt>
                <dd>{cell.publication === "released" ? "Shared with parents" : "Draft"}</dd>
              </dl>
              {cell.active_submission_id && (
                <Link
                  href={`/activities/${cell.activity_id}/submissions/${cell.active_submission_id}`}
                  className="inline-flex min-h-10 items-center text-sm underline"
                >
                  Open worksheet and assessment
                </Link>
              )}
              {cell.points_possible !== null ? (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!valid) {
                      setError(
                        `Enter points from 0 to ${cell.points_possible}, with up to two decimal places.`
                      );
                      return;
                    }
                    void update({ points_override: override }, "Override saved as draft.");
                  }}
                >
                  <PointsField
                    value={override}
                    onChange={setOverride}
                    label="Teacher point override"
                    disabled={pending}
                    hint={`Use 0 to ${cell.points_possible} points. An override persists across new attempts until cleared.`}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={pending || !valid}>
                      Save override
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || cell.points_override === null}
                      onClick={() =>
                        void update(
                          { points_override: null },
                          "Override cleared. Review the automatic grade before release."
                        )
                      }
                    >
                      Clear override
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => void update({ points_override: "0" }, "Zero saved as draft.")}
                    >
                      Assign 0
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-muted-foreground text-sm">
                  This activity uses assessment bands only. Add points in Edit activity to grade
                  coursework numerically.
                </p>
              )}
              <div className="space-y-3 border-t pt-4">
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    void update(
                      { excused: !excused },
                      excused
                        ? "Work unexcused. Review its draft grade."
                        : "Work excused and excluded from totals."
                    )
                  }
                >
                  {excused ? "Unexcuse work" : "Excuse work"}
                </Button>
                <p className="text-muted-foreground text-xs">
                  Excused work is removed from both earned and possible points, and reminders stop.
                </p>
              </div>
              {open && <WorkGradeDetails userId={userId} cell={cell} studentName={studentName} />}
              <Button
                className="w-full"
                disabled={
                  pending ||
                  excused ||
                  cell.final_points === null ||
                  cell.grade_revision === null ||
                  cell.publication === "released"
                }
                onClick={() =>
                  void run(
                    () =>
                      actions.releaseGrade.mutateAsync({
                        ...target,
                        revision: cell.grade_revision!,
                      }),
                    "Grade released to parents."
                  )
                }
              >
                {pending ? "Saving…" : "Release grade"}
              </Button>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

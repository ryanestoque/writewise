"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSections } from "@/lib/hooks/use-sections";
import { useStudents } from "@/lib/hooks/use-students";
import { toActivityDueAt } from "@/lib/utils/activity-deadlines";
import { PointsField, validPointsInput } from "@/components/gradebook/points-field";
import { cn } from "@/lib/utils";

export const activitySchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  target_text: z.string().trim().min(1, "Target text is required"),
  instructions: z.string(),
  assignments: z.array(
    z.object({
      section_id: z.string().nullable().optional(),
      student_id: z.string().nullable().optional(),
    })
  ),
  due_input: z.string().refine((value) => {
    try {
      toActivityDueAt(value);
      return true;
    } catch {
      return false;
    }
  }, "Enter a valid due date and time"),
  close_after_due: z.boolean(),
  is_take_home: z.boolean(),
  points_input: z
    .string()
    .refine(
      (value) => value === "" || validPointsInput(value),
      "Use points from 0.01 to 9,999.99 with up to two decimal places."
    ),
  confirm_remove_points: z.boolean(),
});
export type ActivityFormValues = z.infer<typeof activitySchema>;

export function ActivityTitleField({
  form,
  autoFocus = false,
}: {
  form: UseFormReturn<ActivityFormValues>;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <Field data-invalid={!!form.formState.errors.title}>
      <FieldLabel
        htmlFor={`${id}-title`}
        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Activity title{" "}
        <span className="text-destructive" aria-hidden="true">
          *
        </span>
      </FieldLabel>
      <Input
        id={`${id}-title`}
        {...form.register("title")}
        aria-invalid={!!form.formState.errors.title}
        aria-describedby={form.formState.errors.title ? `${id}-title-error` : undefined}
        required
        autoFocus={autoFocus}
        placeholder="e.g., Loop and join practice"
        className="rounded-lg sm:rounded-xl"
      />
      <FieldError id={`${id}-title-error`} errors={[form.formState.errors.title]} />
    </Field>
  );
}

export function ActivityRosterField({ form }: { form: UseFormReturn<ActivityFormValues> }) {
  const id = useId();
  const {
    data: sections,
    isLoading: sectionsLoading,
    isError: sectionsError,
    refetch: refetchSections,
  } = useSections();
  const {
    data: students,
    isLoading: studentsLoading,
    isError: studentsError,
    refetch: refetchStudents,
  } = useStudents();
  const targets = useWatch({ control: form.control, name: "assignments" }) ?? [];

  const toggle = (key: "section_id" | "student_id", value: string, checked: boolean) => {
    form.setValue(
      "assignments",
      checked ? [...targets, { [key]: value }] : targets.filter((t) => t[key] !== value),
      { shouldDirty: true, shouldValidate: true }
    );
    form.clearErrors("assignments");
  };

  return (
    <fieldset
      className="border-border flex flex-col gap-3 rounded-xl border p-3.5"
      aria-describedby={`${id}-targets-error`}
    >
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Assign to sections or students{" "}
        <span className="text-destructive" aria-hidden="true">
          *
        </span>
      </legend>
      {(sectionsLoading || studentsLoading) && (
        <p role="status" className="text-muted-foreground text-sm">
          Loading your roster…
        </p>
      )}
      {(sectionsError || studentsError) && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-xs"
        >
          <span>Could not load your roster.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchSections();
              void refetchStudents();
            }}
            className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}
      {!sectionsLoading && !studentsLoading && !sectionsError && !studentsError && !sections?.length && !students?.length && (
        <p className="text-muted-foreground text-sm">
          Add students or sections in{" "}
          <Link className="underline" href="/roster">
            your roster
          </Link>{" "}
          before assigning work.
        </p>
      )}
      <div className="flex max-h-44 flex-col gap-2 overflow-y-auto p-1">
        {sections?.map((section) => (
          <label key={section.id} className="flex min-h-9 items-center gap-3 text-sm cursor-pointer">
            <Checkbox
              checked={targets.some((t) => t.section_id === section.id)}
              onCheckedChange={(checked) => toggle("section_id", section.id, !!checked)}
            />
            <span>
              {section.name} <span className="text-muted-foreground">(section)</span>
            </span>
          </label>
        ))}
      </div>
      {!!students?.length && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
            Individual students (optional)
          </summary>
          <div className="mt-2 flex max-h-44 flex-col gap-2 overflow-y-auto p-1">
            {students.map((student) => (
              <label key={student.id} className="flex min-h-9 items-center gap-3 text-sm cursor-pointer">
                <Checkbox
                  checked={targets.some((t) => t.student_id === student.id)}
                  onCheckedChange={(checked) => toggle("student_id", student.id, !!checked)}
                />
                <span>
                  {student.full_name}{" "}
                  <span className="text-muted-foreground">{student.section}</span>
                </span>
              </label>
            ))}
          </div>
        </details>
      )}
      {sections &&
        students &&
        targets
          .filter((target) =>
            target.student_id
              ? !students.some((s) => s.id === target.student_id)
              : !sections.some((s) => s.id === target.section_id)
          )
          .map((target) => (
            <div
              key={target.student_id ?? target.section_id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-muted-foreground">
                {target.student_id
                  ? "Student no longer on your roster"
                  : "Section no longer available"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  toggle(
                    target.student_id ? "student_id" : "section_id",
                    (target.student_id ?? target.section_id)!,
                    false
                  )
                }
              >
                Remove target
              </Button>
            </div>
          ))}
      <FieldError id={`${id}-targets-error`} errors={[form.formState.errors.assignments]} />
    </fieldset>
  );
}

export function ActivityOptionalSettings({
  form,
  defaultOpen = false,
  pointsNotice,
}: {
  form: UseFormReturn<ActivityFormValues>;
  defaultOpen?: boolean;
  pointsNotice?: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const due = useWatch({ control: form.control, name: "due_input" });
  const closed = useWatch({ control: form.control, name: "close_after_due" });
  const points = useWatch({ control: form.control, name: "points_input" });
  const instructions = useWatch({ control: form.control, name: "instructions" });

  const hasOptionalError = Boolean(
    form.formState.errors.points_input || form.formState.errors.due_input
  );
  const isOpen = open || hasOptionalError;

  const summaryParts: string[] = [];
  if (instructions?.trim()) summaryParts.push("instructions");
  if (points?.trim()) summaryParts.push(`${points} pts`);
  if (due?.trim()) summaryParts.push("due date");

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setOpen}
      className="rounded-xl border border-border/80 bg-muted/20"
    >
      <CollapsibleTrigger
        type="button"
        className="flex w-full min-h-11 items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted/40 rounded-xl transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0">
          <span>More options</span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {summaryParts.length > 0
              ? summaryParts.join(" · ")
              : "Instructions, points, due date"}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3.5 pb-3.5 pt-2 space-y-4 border-t border-border/60">
        <Field>
          <FieldLabel htmlFor={`${id}-instructions`}>Instructions (optional)</FieldLabel>
          <Textarea
            id={`${id}-instructions`}
            {...form.register("instructions")}
            placeholder="What should students practice?"
            className="min-h-20 rounded-lg sm:rounded-xl"
          />
        </Field>
        <div className="space-y-2">
          <PointsField
            value={points ?? ""}
            onChange={(value) => {
              form.setValue("points_input", value, { shouldDirty: true, shouldValidate: true });
              form.setValue("confirm_remove_points", false);
            }}
            error={form.formState.errors.points_input?.message}
          />
          {pointsNotice}
        </div>
        <Field data-invalid={!!form.formState.errors.due_input}>
          <FieldLabel htmlFor={`${id}-due`}>Due date and time (optional)</FieldLabel>
          <Input
            id={`${id}-due`}
            type="datetime-local"
            {...form.register("due_input", {
              onChange: (event) => {
                if (!event.target.value) form.setValue("close_after_due", false);
              },
            })}
            aria-invalid={!!form.formState.errors.due_input}
            aria-describedby={form.formState.errors.due_input ? `${id}-due-error` : undefined}
          />
          <FieldError id={`${id}-due-error`} errors={[form.formState.errors.due_input]} />
          <label className="flex min-h-10 items-center justify-between gap-3 text-sm cursor-pointer">
            Close parent uploads after the due date
            <Switch
              checked={closed}
              disabled={!due}
              onCheckedChange={(checked) => form.setValue("close_after_due", checked)}
            />
          </label>
          <p className="text-muted-foreground text-xs">
            With this off, late uploads are accepted. Teachers can still upload after closure.
          </p>
        </Field>
      </CollapsibleContent>
    </Collapsible>
  );
}

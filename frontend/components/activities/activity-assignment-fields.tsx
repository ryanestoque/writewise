"use client";

import { useId } from "react";
import Link from "next/link";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { useSections } from "@/lib/hooks/use-sections";
import { useStudents } from "@/lib/hooks/use-students";
import { toActivityDueAt } from "@/lib/utils/activity-deadlines";

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
});
export type ActivityFormValues = z.infer<typeof activitySchema>;

export function ActivityAssignmentFields({ form }: { form: UseFormReturn<ActivityFormValues> }) {
  const id = useId();
  const { data: sections, isLoading: sectionsLoading, isError: sectionsError } = useSections();
  const { data: students, isLoading: studentsLoading, isError: studentsError } = useStudents();
  const targets = useWatch({ control: form.control, name: "assignments" }) ?? [];
  const due = useWatch({ control: form.control, name: "due_input" });
  const closed = useWatch({ control: form.control, name: "close_after_due" });
  const toggle = (key: "section_id" | "student_id", value: string, checked: boolean) => {
    form.setValue(
      "assignments",
      checked ? [...targets, { [key]: value }] : targets.filter((t) => t[key] !== value),
      { shouldDirty: true, shouldValidate: true }
    );
    form.clearErrors("assignments");
  };
  return (
    <>
      <Field data-invalid={!!form.formState.errors.title}>
        <FieldLabel htmlFor={`${id}-title`}>Activity title</FieldLabel>
        <Input
          id={`${id}-title`}
          {...form.register("title")}
          aria-invalid={!!form.formState.errors.title}
          required
          placeholder="e.g., Loop and join practice"
        />
        <FieldError errors={[form.formState.errors.title]} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-instructions`}>Instructions (optional)</FieldLabel>
        <Textarea
          id={`${id}-instructions`}
          {...form.register("instructions")}
          placeholder="What should students practise?"
        />
      </Field>
      <fieldset
        className="border-border flex flex-col gap-3 rounded-xl border p-3"
        aria-describedby={`${id}-targets-error`}
      >
        <legend className="px-1 text-sm font-medium">Assign to sections or students</legend>
        {(sectionsLoading || studentsLoading) && (
          <p role="status" className="text-muted-foreground text-sm">
            Loading your roster…
          </p>
        )}
        {(sectionsError || studentsError) && (
          <p role="alert" className="text-destructive text-sm">
            Could not load assignment options. Please reopen this form to retry.
          </p>
        )}
        {!sectionsLoading && !studentsLoading && !sections?.length && !students?.length && (
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
            <label key={section.id} className="flex min-h-9 items-center gap-3 text-sm">
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
            <summary className="cursor-pointer text-sm">Individual students (optional)</summary>
            <div className="mt-2 flex max-h-44 flex-col gap-2 overflow-y-auto p-1">
              {students.map((student) => (
                <label key={student.id} className="flex min-h-9 items-center gap-3 text-sm">
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
        <FieldError id={`${id}-targets-error`} errors={[form.formState.errors.assignments]} />
      </fieldset>
      <Field data-invalid={!!form.formState.errors.due_input}>
        <FieldLabel htmlFor={`${id}-due`}>Due date and time (Manila, optional)</FieldLabel>
        <Input
          id={`${id}-due`}
          type="datetime-local"
          {...form.register("due_input", {
            onChange: (event) => {
              if (!event.target.value) form.setValue("close_after_due", false);
            },
          })}
          aria-invalid={!!form.formState.errors.due_input}
        />
        <FieldError errors={[form.formState.errors.due_input]} />
        <label className="flex min-h-10 items-center justify-between gap-3 text-sm">
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
    </>
  );
}

"use client";

import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup, FieldError, FieldContent } from "@/components/ui/field";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox";
import { useCreateStudent, useUpdateStudent, useStudents, Student } from "@/lib/hooks/use-students";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const studentSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  section: z.string().min(1, "Section is required"),
  parent_email: z.string().email("Invalid email").optional().or(z.literal("")),
});

type StudentFormValues = z.infer<typeof studentSchema>;

interface StudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
}

export function StudentDialog({ open, onOpenChange, student }: StudentDialogProps) {
  const isEditing = !!student;
  
  const { mutate: createStudent, isPending: isCreating } = useCreateStudent();
  const { mutate: updateStudent, isPending: isUpdating } = useUpdateStudent();
  const { data: students } = useStudents();
  
  const isPending = isCreating || isUpdating;

  // Extract unique sections for the combobox
  const existingSections = useMemo(() => {
    if (!students) return [];
    const sections = new Set(students.map(s => s.section).filter(Boolean));
    return Array.from(sections).sort();
  }, [students]);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      full_name: "",
      section: "",
      parent_email: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (student) {
        form.reset({
          full_name: student.full_name,
          section: student.section,
          parent_email: student.parent_email || "",
        });
      } else {
        form.reset({
          full_name: "",
          section: "",
          parent_email: "",
        });
      }
    }
  }, [open, student, form]);

  const onSubmit = (data: StudentFormValues) => {
    const payload = {
      ...data,
      parent_email: data.parent_email || undefined,
    };

    if (isEditing) {
      updateStudent(
        { id: student.id, data: payload },
        {
          onSuccess: () => {
            toast.success("Student updated successfully.");
            onOpenChange(false);
          },
          onError: (error: Error) => {
            toast.error(error.message || "Failed to update student.");
          },
        }
      );
    } else {
      createStudent(payload, {
        onSuccess: () => {
          toast.success("Student added successfully.");
          onOpenChange(false);
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to add student.");
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">{isEditing ? "Edit Student" : "Add Student"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the student's details below."
              : "Enter the student's details to add them to your roster."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
          <FieldGroup>
            {/* Full Name */}
            <Field data-invalid={!!form.formState.errors.full_name}>
              <FieldLabel htmlFor="full_name">
                Full Name <span className="text-destructive" aria-hidden="true">*</span>
              </FieldLabel>
              <FieldContent>
                <Input 
                  id="full_name" 
                  {...form.register("full_name")} 
                  aria-invalid={!!form.formState.errors.full_name}
                  aria-required="true"
                  placeholder="Juan Dela Cruz"
                />
              </FieldContent>
              <FieldError errors={[form.formState.errors.full_name]} />
            </Field>

            {/* Section (Combobox) */}
            <Field data-invalid={!!form.formState.errors.section}>
              <FieldLabel htmlFor="section">
                Section <span className="text-destructive" aria-hidden="true">*</span>
              </FieldLabel>
              <FieldContent>
                <Controller
                  name="section"
                  control={form.control}
                  render={({ field }) => (
                    <Combobox 
                      value={field.value} 
                      onValueChange={(val: string | null) => field.onChange(val || "")}
                    >
                      <ComboboxInput 
                        id="section"
                        placeholder="e.g. Grade 3 - Rizal" 
                        value={field.value}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(e.target.value)}
                        aria-invalid={!!form.formState.errors.section}
                        aria-required="true"
                      />
                      {existingSections.length > 0 && (
                        <ComboboxContent>
                          <ComboboxList>
                            {existingSections.map((sec) => (
                              <ComboboxItem key={sec} value={sec}>
                                {sec}
                              </ComboboxItem>
                            ))}
                          </ComboboxList>
                        </ComboboxContent>
                      )}
                    </Combobox>
                  )}
                />
              </FieldContent>
              <FieldError errors={[form.formState.errors.section]} />
            </Field>

            {/* Parent Email */}
            <Field data-invalid={!!form.formState.errors.parent_email}>
              <FieldLabel htmlFor="parent_email">
                Parent Email <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
              </FieldLabel>
              <FieldContent>
                <Input 
                  id="parent_email" 
                  {...form.register("parent_email")} 
                  aria-invalid={!!form.formState.errors.parent_email}
                  placeholder="parent@example.com"
                />
              </FieldContent>
              <FieldError errors={[form.formState.errors.parent_email]} />
            </Field>
          </FieldGroup>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isPending}
              className="rounded-lg bg-primary hover:bg-brand-700 text-primary-foreground"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Save Changes" : "Save Student"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

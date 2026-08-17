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
import { Loader2, Plus, Check } from "lucide-react";
import { toast } from "sonner";

const studentSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  section: z.string().min(1, "Section is required"),
  parent_email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

type StudentFormValues = z.infer<typeof studentSchema>;

interface StudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  defaultSection?: string;
}

export function StudentDialog({ open, onOpenChange, student, defaultSection }: StudentDialogProps) {
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
      section: defaultSection || "",
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
          section: defaultSection || "",
          parent_email: "",
        });
      }
    }
  }, [open, student, defaultSection, form]);

  const handleSave = (data: StudentFormValues, addAnother = false) => {
    const payload = {
      ...data,
      parent_email: data.parent_email || undefined,
    };

    if (isEditing) {
      updateStudent(
        { id: student.id, data: payload },
        {
          onSuccess: () => {
            toast.success(`Updated ${data.full_name} successfully.`);
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
          toast.success(`Enrolled ${data.full_name} in ${data.section}.`);
          if (addAnother) {
            // Keep section preserved, reset name & parent email
            form.reset({
              full_name: "",
              section: data.section,
              parent_email: "",
            });
            setTimeout(() => {
              form.setFocus("full_name");
            }, 50);
          } else {
            onOpenChange(false);
          }
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to add student.");
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{isEditing ? "Edit Student" : "Add Student"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the student's details and class section below."
              : "Enter the student's details to add them to your active class roster."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit((data) => handleSave(data, false))} className="space-y-5 pt-2">
          <FieldGroup className="space-y-4">
            {/* Full Name */}
            <Field data-invalid={!!form.formState.errors.full_name}>
              <FieldLabel htmlFor="full_name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Full Name <span className="text-destructive" aria-hidden="true">*</span>
              </FieldLabel>
              <FieldContent>
                <Input 
                  id="full_name" 
                  {...form.register("full_name")}
                  aria-invalid={!!form.formState.errors.full_name}
                  aria-required="true"
                  placeholder="e.g. Juan Dela Cruz"
                  className="h-10"
                />
              </FieldContent>
              <FieldError errors={[form.formState.errors.full_name]} />
            </Field>

            {/* Section (Combobox) */}
            <Field data-invalid={!!form.formState.errors.section}>
              <FieldLabel htmlFor="section" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Class Section <span className="text-destructive" aria-hidden="true">*</span>
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
                        className="h-10"
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
              <FieldLabel htmlFor="parent_email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Parent Email <span className="font-normal lowercase tracking-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <FieldContent>
                <Input 
                  id="parent_email" 
                  type="email"
                  {...form.register("parent_email")} 
                  aria-invalid={!!form.formState.errors.parent_email}
                  placeholder="parent@example.com"
                  className="h-10"
                />
              </FieldContent>
              <p className="text-xs text-muted-foreground mt-1">
                Parent will receive an invitation to access their child&apos;s handwriting progress portal.
              </p>
              <FieldError errors={[form.formState.errors.parent_email]} />
            </Field>
          </FieldGroup>
          
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4 border-t border-border">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {!isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={form.handleSubmit((data) => handleSave(data, true))}
                  className="w-full sm:w-auto text-xs"
                >
                  {isCreating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                  Save & Add Another
                </Button>
              )}
              <Button 
                type="submit" 
                disabled={isPending}
                className="w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground font-medium"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-1.5" />
                )}
                {isEditing ? "Save Changes" : "Add Student"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

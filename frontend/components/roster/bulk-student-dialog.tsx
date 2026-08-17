"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldGroup, FieldContent } from "@/components/ui/field";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox";
import { Progress } from "@/components/ui/progress";
import { useStudents } from "@/lib/hooks/use-students";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Users, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface BulkStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSection?: string;
}

export function BulkStudentDialog({ open, onOpenChange, defaultSection }: BulkStudentDialogProps) {
  const queryClient = useQueryClient();
  const { data: students } = useStudents();
  
  const [section, setSection] = useState(defaultSection || "");
  const [rawText, setRawText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Extract unique sections for the combobox
  const existingSections = useMemo(() => {
    if (!students) return [];
    const sections = new Set(students.map((s) => s.section).filter(Boolean));
    return Array.from(sections).sort();
  }, [students]);

  // Parse lines: trim and filter out blank lines
  const parsedNames = useMemo(() => {
    if (!rawText.trim()) return [];
    return rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [rawText]);

  const handleOpenChange = (newOpen: boolean) => {
    if (isProcessing) return; // Prevent closing while processing
    if (!newOpen) {
      // Reset state on close
      setRawText("");
      setProgress(0);
      setStatusMessage(null);
    }
    onOpenChange(newOpen);
  };

  const handleBulkSubmit = async () => {
    const trimmedSection = section.trim();
    if (!trimmedSection) {
      toast.error("Please enter or select a class section.");
      return;
    }

    if (parsedNames.length === 0) {
      toast.error("Please enter at least one student name.");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatusMessage(`Starting enrollment of ${parsedNames.length} students...`);

    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      toast.error("Authentication session expired. Please log in again.");
      setIsProcessing(false);
      return;
    }

    let successCount = 0;
    const failedNames: string[] = [];

    for (let i = 0; i < parsedNames.length; i++) {
      const studentName = parsedNames[i];
      setStatusMessage(`Enrolling ${studentName} (${i + 1} of ${parsedNames.length})...`);
      
      try {
        const response = await fetch("/api/students", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            full_name: studentName,
            section: trimmedSection,
          }),
        });

        if (!response.ok) {
          failedNames.push(studentName);
        } else {
          successCount++;
        }
      } catch {
        failedNames.push(studentName);
      }

      setProgress(Math.round(((i + 1) / parsedNames.length) * 100));
    }

    // Refresh student query cache
    await queryClient.invalidateQueries({ queryKey: ["students"] });
    setIsProcessing(false);

    if (failedNames.length === 0) {
      toast.success(`Successfully enrolled ${successCount} students into ${trimmedSection}!`);
      handleOpenChange(false);
    } else if (successCount > 0) {
      toast.warning(`Enrolled ${successCount} students. ${failedNames.length} names failed.`);
      setRawText(failedNames.join("\n")); // Leave failed names for retry
      setStatusMessage(`Completed with ${failedNames.length} errors. You can retry the remaining names.`);
    } else {
      toast.error("Failed to enroll students. Please check your connection and try again.");
      setStatusMessage("Enrollment failed. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand-100 text-brand-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="font-heading text-xl">Bulk Add Students</DialogTitle>
              <DialogDescription className="text-sm">
                Paste student names from your class list or spreadsheet to enroll them all at once.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <FieldGroup className="space-y-4">
            {/* Target Section */}
            <Field>
              <FieldLabel htmlFor="bulk_section" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Target Section <span className="text-destructive" aria-hidden="true">*</span>
              </FieldLabel>
              <FieldContent>
                <Combobox 
                  value={section} 
                  onValueChange={(val: string | null) => setSection(val || "")}
                >
                  <ComboboxInput 
                    id="bulk_section"
                    placeholder="e.g. Grade 3 - Rizal" 
                    value={section}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSection(e.target.value)}
                    disabled={isProcessing}
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
              </FieldContent>
            </Field>

            {/* Student Names Textarea */}
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="bulk_names" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Student Names (One per line) <span className="text-destructive" aria-hidden="true">*</span>
                </FieldLabel>
                <span className="text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200/60">
                  {parsedNames.length} {parsedNames.length === 1 ? "student" : "students"} detected
                </span>
              </div>
              <FieldContent>
                <Textarea
                  id="bulk_names"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  disabled={isProcessing}
                  placeholder="Juan Dela Cruz&#10;Maria Santos&#10;Jose Rizal&#10;Andres Bonifacio&#10;Gabriela Silang"
                  rows={7}
                  className="font-mono text-sm leading-relaxed resize-none"
                />
              </FieldContent>
              <p className="text-xs text-muted-foreground">
                Tip: Copy and paste directly from an Excel column or Word roster. Blank lines are ignored automatically.
              </p>
            </Field>
          </FieldGroup>

          {/* Progress / Status feedback */}
          {isProcessing && (
            <div className="space-y-2 p-3 bg-muted/40 rounded-xl border border-border">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  {statusMessage}
                </span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {!isProcessing && statusMessage && (
            <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              disabled={isProcessing}
              onClick={() => handleOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={isProcessing || parsedNames.length === 0 || !section.trim()}
              onClick={handleBulkSubmit}
              className="bg-primary hover:bg-brand-700 text-primary-foreground font-medium"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enrolling...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Enroll {parsedNames.length > 0 ? `${parsedNames.length} Students` : "Students"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

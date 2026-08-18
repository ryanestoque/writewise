"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldGroup, FieldContent, FieldError } from "@/components/ui/field";
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
import { runConcurrentPool } from "@/lib/utils/concurrent-pool";
import { Loader2, Users, AlertCircle, UserPlus } from "lucide-react";
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
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [namesError, setNamesError] = useState<string | null>(null);
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

  // Check for any duplicate names within the selected section
  const duplicateNames = useMemo(() => {
    if (!students || !section.trim() || parsedNames.length === 0) return [];
    const lowerSection = section.trim().toLowerCase();
    const existingNamesSet = new Set(
      students
        .filter((s) => s.section?.trim().toLowerCase() === lowerSection)
        .map((s) => s.full_name.trim().toLowerCase())
    );
    return parsedNames.filter((name) => existingNamesSet.has(name.toLowerCase()));
  }, [students, section, parsedNames]);

  const handleOpenChange = (newOpen: boolean) => {
    if (isProcessing) return; // Prevent closing while processing
    if (!newOpen) {
      // Reset state on close
      setRawText("");
      setSectionError(null);
      setNamesError(null);
      setProgress(0);
      setStatusMessage(null);
    }
    onOpenChange(newOpen);
  };

  const handleBulkSubmit = async () => {
    const trimmedSection = section.trim();
    let hasError = false;

    if (!trimmedSection) {
      setSectionError("Please enter or select a class section.");
      toast.error("Please enter or select a class section.");
      hasError = true;
    } else {
      setSectionError(null);
    }

    if (parsedNames.length === 0) {
      setNamesError("Please enter at least one student name.");
      toast.error("Please enter at least one student name.");
      hasError = true;
    } else {
      setNamesError(null);
    }

    if (hasError) return;

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

    const { successCount, failedItems } = await runConcurrentPool(
      parsedNames,
      async (studentName) => {
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
        return response.ok;
      },
      {
        concurrency: 4,
        onProgress: (completed, total) => {
          setProgress(Math.round((completed / total) * 100));
          setStatusMessage(`Enrolled ${completed} of ${total} students...`);
        },
      }
    );

    // Refresh student query cache
    await queryClient.invalidateQueries({ queryKey: ["students"] });
    setIsProcessing(false);

    if (failedItems.length === 0) {
      toast.success(`Successfully enrolled ${successCount} students into ${trimmedSection}!`);
      handleOpenChange(false);
    } else if (successCount > 0) {
      toast.warning(`Enrolled ${successCount} students. ${failedItems.length} names failed.`);
      setRawText(failedItems.join("\n")); // Leave failed names for retry
      setStatusMessage(`Completed with ${failedItems.length} errors. You can retry the remaining names.`);
    } else {
      toast.error("Failed to enroll students. Please check your connection and try again.");
      setStatusMessage("Enrollment failed. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-xl sm:max-w-[520px] max-h-[min(92dvh,calc(100vh-2rem))] flex flex-col p-5 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-xl border border-border/80 bg-surface dark:bg-card">
        <DialogHeader className="pb-3 sm:pb-4 shrink-0 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
              <Users className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground">Bulk Add Students</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Paste student names from your class list or spreadsheet to enroll them all at once.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden pt-1">
          <div className="space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-1 py-1 flex-1 min-h-0">
            <FieldGroup className="space-y-4">
              {/* Target Section */}
              <Field data-invalid={!!sectionError}>
                <FieldLabel htmlFor="bulk_section" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Target Section <span className="text-destructive" aria-hidden="true">*</span>
                </FieldLabel>
                <FieldContent>
                  {(() => {
                    const trimmedInput = section.trim();
                    const isCustomSection =
                      trimmedInput.length > 0 &&
                      !existingSections.some(
                        (sec) => sec.toLowerCase() === trimmedInput.toLowerCase()
                      );

                    return (
                      <Combobox 
                        value={section} 
                        onValueChange={(val: string | null) => {
                          setSection(val || "");
                          if (sectionError) setSectionError(null);
                        }}
                      >
                        <ComboboxInput 
                          id="bulk_section"
                          aria-label="Target Class Section"
                          placeholder="e.g. Grade 3 - Rizal" 
                          value={section}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setSection(e.target.value);
                            if (sectionError) setSectionError(null);
                          }}
                          disabled={isProcessing}
                          aria-invalid={!!sectionError}
                          aria-describedby={sectionError ? "bulk_section_error bulk_section_hint" : "bulk_section_hint"}
                          aria-required="true"
                          autoCapitalize="words"
                          autoCorrect="off"
                          spellCheck={false}
                          className="h-10 sm:h-9.5 text-base sm:text-sm rounded-lg sm:rounded-xl"
                        />
                        {(existingSections.length > 0 || isCustomSection) && (
                          <ComboboxContent>
                            <ComboboxList>
                              {existingSections.map((sec) => (
                                <ComboboxItem key={sec} value={sec} className="py-2.5 px-3">
                                  {sec}
                                </ComboboxItem>
                              ))}
                              {isCustomSection && (
                                <ComboboxItem value={trimmedInput} className="py-2.5 px-3 text-primary font-medium">
                                  <UserPlus className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                                  Create section &ldquo;{trimmedInput}&rdquo;
                                </ComboboxItem>
                              )}
                            </ComboboxList>
                          </ComboboxContent>
                        )}
                      </Combobox>
                    );
                  })()}
                </FieldContent>
                <p id="bulk_section_hint" className="text-xs text-muted-foreground mt-1 leading-normal">
                  Type a new section name or select from existing sections.
                </p>
                {sectionError && <FieldError id="bulk_section_error">{sectionError}</FieldError>}
              </Field>

              {/* Student Names Textarea */}
              <Field data-invalid={!!namesError}>
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <FieldLabel htmlFor="bulk_names" className="inline-block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Student Names (One per line)<span className="text-destructive ml-1" aria-hidden="true">*</span>
                  </FieldLabel>
                  <span className="text-[11px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-full border border-brand-200/60 dark:border-brand-900">
                    {parsedNames.length} {parsedNames.length === 1 ? "student" : "students"} detected
                  </span>
                </div>
                <FieldContent>
                  <Textarea
                    id="bulk_names"
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value);
                      if (namesError) setNamesError(null);
                    }}
                    disabled={isProcessing}
                    autoCapitalize="words"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={"Juan Dela Cruz\nMaria Santos\nJose Rizal\nAndres Bonifacio\nGabriela Silang"}
                    rows={5}
                    aria-invalid={!!namesError}
                    aria-required="true"
                    aria-describedby={namesError ? "bulk_names_error bulk_names_tip" : "bulk_names_tip"}
                    className="font-mono text-base sm:text-sm leading-relaxed resize-none rounded-lg sm:rounded-xl"
                  />
                </FieldContent>
                {namesError && <FieldError id="bulk_names_error">{namesError}</FieldError>}
                <p id="bulk_names_tip" className="text-xs text-muted-foreground mt-1 leading-normal">
                  Tip: Copy and paste directly from an Excel column or roster sheet. Blank lines are ignored automatically.
                </p>
                {duplicateNames.length > 0 && !isProcessing && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900 text-xs mt-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <span className="font-semibold">Notice:</span>{" "}
                      {duplicateNames.length === 1 ? "1 student" : `${duplicateNames.length} students`} (
                      {duplicateNames.slice(0, 3).join(", ")}
                      {duplicateNames.length > 3 ? "..." : ""}) already enrolled in {section}. They will be added as additional entries.
                    </div>
                  </div>
                )}
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
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-3.5 sm:pt-4 mt-2 border-t border-border shrink-0">
            <Button
              type="button"
              variant="ghost"
              disabled={isProcessing}
              onClick={() => handleOpenChange(false)}
              className="h-10 sm:h-9 w-full sm:w-auto text-muted-foreground hover:text-foreground text-xs sm:text-sm rounded-lg sm:rounded-xl font-medium"
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={isProcessing || parsedNames.length === 0 || !section.trim()}
              onClick={handleBulkSubmit}
              className="h-10 sm:h-9 w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl shadow-xs"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enrolling...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-1.5" />
                  Enroll {parsedNames.length > 0 ? `${parsedNames.length} ${parsedNames.length === 1 ? "Student" : "Students"}` : "Students"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

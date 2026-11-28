"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/shared/responsive-modal";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem } from "@/components/ui/combobox";
import { Progress } from "@/components/ui/progress";
import { useStudents } from "@/lib/hooks/use-students";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { runConcurrentPool } from "@/lib/utils/concurrent-pool";
import { AlertCircle, UserPlus } from "lucide-react";
import { toast } from "@/components/ui/toast";

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
      toast.add({ type: "error", title: "Please enter or select a class section." });
      hasError = true;
    } else {
      setSectionError(null);
    }

    if (parsedNames.length === 0) {
      setNamesError("Please enter at least one student name.");
      toast.add({ type: "error", title: "Please enter at least one student name." });
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
      toast.add({ type: "error", title: "Authentication session expired. Please log in again." });
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
            Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            full_name: studentName,
            section: trimmedSection }) });
        return response.ok;
      },
      {
        concurrency: 4,
        onProgress: (completed, total) => {
          setProgress(Math.round((completed / total) * 100));
          setStatusMessage(`Enrolled ${completed} of ${total} students...`);
        } }
    );

    // Refresh student query cache
    await queryClient.invalidateQueries({ queryKey: ["students"] });
    setIsProcessing(false);

    if (failedItems.length === 0) {
      toast.add({ type: "success", title: `Successfully enrolled ${successCount} students into ${trimmedSection}!` });
      handleOpenChange(false);
    } else if (successCount > 0) {
      toast.add({ type: "warning", title: `Enrolled ${successCount} students. ${failedItems.length} names failed.` });
      setRawText(failedItems.join("\n")); // Leave failed names for retry
      setStatusMessage(`Completed with ${failedItems.length} errors. You can retry the remaining names.`);
    } else {
      toast.add({ type: "error", title: "Failed to enroll students. Please check your connection and try again." });
      setStatusMessage("Enrollment failed. Please try again.");
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent className="w-[calc(100%-1.5rem)] max-w-xl sm:max-w-[520px] max-h-[min(92dvh,calc(100dvh-2rem))] flex flex-col p-5 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-warm border border-border/80 bg-card">
        <ResponsiveModalHeader className="pb-3 sm:pb-4 shrink-0 text-left">
          <ResponsiveModalTitle className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground">Bulk Add Students</ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            Paste student names from your class list or spreadsheet to enroll them all at once.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden pt-1">
          <ResponsiveModalBody className="flex flex-col gap-3 overflow-x-hidden px-5 py-2 md:px-1 md:py-1">
            <FieldGroup>
              {/* Target Section */}
              <Field data-invalid={Boolean(sectionError) || undefined}>
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
                          placeholder="e.g. Section Rizal" 
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
                          className="h-10 sm:h-9 text-base sm:text-sm rounded-lg sm:rounded-xl"
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
                                  <UserPlus aria-hidden="true" />
                                  <span className="truncate max-w-full">
                                    Create section &ldquo;{trimmedInput}&rdquo;
                                  </span>
                                </ComboboxItem>
                              )}
                            </ComboboxList>
                          </ComboboxContent>
                        )}
                      </Combobox>
                    );
                  })()}
                </FieldContent>
                <FieldDescription id="bulk_section_hint" className="text-xs mt-1">
                  Type a new section name or select from existing sections.
                </FieldDescription>
                {sectionError && <FieldError id="bulk_section_error">{sectionError}</FieldError>}
              </Field>

              {/* Student Names Textarea */}
              <Field data-invalid={Boolean(namesError) || undefined}>
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <FieldLabel htmlFor="bulk_names" className="inline-block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Student Names (One per line)<span className="text-destructive ml-1" aria-hidden="true">*</span>
                  </FieldLabel>
                  <Badge variant="secondary" className="text-[11px] font-semibold tabular-nums">
                    {parsedNames.length} {parsedNames.length === 1 ? "student" : "students"} detected
                  </Badge>
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
                <FieldDescription id="bulk_names_tip" className="text-xs mt-1">
                  Tip: Copy and paste directly from an Excel column or roster sheet. Blank lines are ignored automatically.
                </FieldDescription>
                {duplicateNames.length > 0 && !isProcessing && (
                  <Alert className="mt-2 bg-band-2/15 text-band-2-text border-band-2/30 py-2.5 px-3 text-xs">
                    <AlertCircle aria-hidden="true" />
                    <AlertDescription className="text-xs text-band-2-text">
                      <span className="font-semibold">Notice:</span>{" "}
                      {duplicateNames.length === 1 ? "1 student" : `${duplicateNames.length} students`} (
                      {duplicateNames.slice(0, 3).join(", ")}
                      {duplicateNames.length > 3 ? "..." : ""}) already enrolled in {section}. They will be added as additional entries.
                    </AlertDescription>
                  </Alert>
                )}
              </Field>
            </FieldGroup>

            {/* Progress / Status feedback */}
            {isProcessing && (
              <Card size="sm" className="bg-muted/40 py-0">
                <CardContent className="flex flex-col gap-2 p-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <Spinner className="size-3.5 text-primary" />
                      {statusMessage}
                    </span>
                    <span className="text-muted-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </CardContent>
              </Card>
            )}

            {!isProcessing && statusMessage && (
              <Alert className="bg-band-2/15 text-band-2-text border-band-2/30 py-2.5 px-3 text-xs">
                <AlertCircle aria-hidden="true" />
                <AlertDescription className="text-xs text-band-2-text">
                  {statusMessage}
                </AlertDescription>
              </Alert>
            )}
          </ResponsiveModalBody>

          <ResponsiveModalFooter className="pt-3.5 sm:pt-4 mt-2 border-t border-border sm:justify-between shrink-0">
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
              className="h-10 sm:h-9 w-full sm:w-auto font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl shadow-xs"
            >
              {isProcessing ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Enrolling...
                </>
              ) : (
                <>
                  <UserPlus data-icon="inline-start" aria-hidden="true" />
                  Enroll {parsedNames.length > 0 ? `${parsedNames.length} ${parsedNames.length === 1 ? "Student" : "Students"}` : "Students"}
                </>
              )}
            </Button>
          </ResponsiveModalFooter>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

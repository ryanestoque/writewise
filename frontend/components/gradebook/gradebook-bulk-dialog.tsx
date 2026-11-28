"use client";

import { useMemo, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useGradebookActions, type SectionGradebook } from "@/lib/hooks/use-gradebook";
import { invalidateWorkQueries } from "@/lib/hooks/use-activity-work";
import { gradebookMutation, gradebookRequest } from "@/lib/gradebook/transport";
import type { components } from "@/types/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function GradebookBulkDialog({
  userId,
  activityId,
  studentIds,
  operation,
  open,
  onOpenChange,
  eligibleCount,
  activityTitle,
  sectionId,
  sectionName,
  totalSectionsCount = 1,
  sections,
}: {
  userId: string;
  activityId: string;
  studentIds: string[];
  operation: "zero" | "excuse" | "release";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eligibleCount: number;
  activityTitle?: string;
  sectionId?: string;
  sectionName?: string;
  totalSectionsCount?: number;
  sections?: components["schemas"]["SectionResponse"][];
}) {
  const actions = useGradebookActions(userId);
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [crossSectionAcknowledged, setCrossSectionAcknowledged] = useState(false);

  const isMultiSectionRelease = operation === "release" && totalSectionsCount > 1;

  // Query gradebooks of other sections when in multi-section release mode
  const sectionQueries = useQueries({
    queries: (sections ?? []).map((sec) => ({
      queryKey: ["gradebook", userId, "section", sec.id],
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        gradebookRequest<SectionGradebook>(
          userId,
          `/api/sections/${encodeURIComponent(sec.id)}/gradebook`,
          signal
        ),
      staleTime: 30_000,
      enabled: open && operation === "release" && !!userId && !!sec.id && totalSectionsCount > 1,
    })),
  });

  const sectionManifest = useMemo(() => {
    if (!sections || sections.length === 0) {
      return [
        {
          id: sectionId ?? "current",
          name: sectionName ?? "This section",
          isCurrent: true,
          isAssigned: true,
          readyCount: eligibleCount,
          totalStudents: eligibleCount,
          isLoading: false,
        },
      ];
    }

    return sections.map((sec, index) => {
      const isCurrent = sectionId ? sec.id === sectionId : sec.name === sectionName;
      const query = sectionQueries[index];
      const data = query?.data;

      if (!data) {
        return {
          id: sec.id,
          name: sec.name,
          isCurrent,
          isAssigned: true,
          readyCount: isCurrent ? eligibleCount : 0,
          totalStudents: sec.student_count,
          isLoading: isCurrent ? false : (query?.isPending ?? false),
        };
      }

      // Check if this activity is assigned to this section
      const hasActivity = data.activities?.some((act) => act.id === activityId);
      if (!hasActivity && !isCurrent) {
        return {
          id: sec.id,
          name: sec.name,
          isCurrent: false,
          isAssigned: false,
          readyCount: 0,
          totalStudents: sec.student_count,
          isLoading: false,
        };
      }

      // Count ready grades for this activity in this section
      const readyCount = isCurrent
        ? eligibleCount
        : data.rows.filter((row) => {
            const cell = row.cells?.find((c) => c.activity_id === activityId);
            if (!cell || !cell.applicable || cell.coursework_status === "Excused") return false;
            return (
              (cell.final_points !== null && cell.publication !== "released") ||
              (cell.points_possible === null && cell.coursework_status === "Draft")
            );
          }).length;

      return {
        id: sec.id,
        name: sec.name,
        isCurrent,
        isAssigned: true,
        readyCount,
        totalStudents: data.rows.length,
        isLoading: false,
      };
    });
  }, [sections, sectionId, sectionName, eligibleCount, sectionQueries, activityId]);

  const assignedSections = useMemo(
    () => sectionManifest.filter((s) => s.isAssigned),
    [sectionManifest]
  );

  const anySectionLoading = useMemo(
    () => assignedSections.some((s) => s.isLoading),
    [assignedSections]
  );

  const totalReadyAcrossSections = useMemo(() => {
    if (!isMultiSectionRelease) return eligibleCount;
    return assignedSections.reduce((acc, s) => acc + s.readyCount, 0);
  }, [isMultiSectionRelease, eligibleCount, assignedSections]);

  const isZeroReadyTotal =
    operation === "release" && !anySectionLoading && totalReadyAcrossSections === 0;

  async function save() {
    setPending(true);
    setError("");
    try {
      if (operation === "release") {
        const result = await gradebookMutation<components["schemas"]["ReleaseActivityResponse"]>(
          userId,
          `/api/activities/${activityId}/release`,
          "POST",
          {}
        );
        setMessage(
          `${result.released_grade_count} grades and ${result.released_count} worksheet results released.`
        );
      } else {
        const result =
          operation === "zero"
            ? await actions.assignZeroMissing.mutateAsync({ activityId, studentIds })
            : await actions.excuseStudents.mutateAsync({ activityId, studentIds, excused: true });
        setMessage(
          `${result.changed_student_ids.length} changed; ${result.skipped_student_ids.length} skipped because their current work was not eligible.`
        );
      }
    } catch (failure) {
      if (!(failure instanceof Error && failure.name === "AbortError"))
        setError(
          failure instanceof Error ? failure.message : "Could not update the activity. Try again."
        );
    } finally {
      setPending(false);
      void client.invalidateQueries({ queryKey: ["gradebook", userId] });
      invalidateWorkQueries(client);
    }
  }

  const isConfirmDisabled =
    pending ||
    isZeroReadyTotal ||
    anySectionLoading ||
    (operation !== "release" && !studentIds.length) ||
    (isMultiSectionRelease && !crossSectionAcknowledged);

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <ResponsiveModalContent className="sm:max-w-lg max-h-[min(90dvh,calc(100dvh-2rem))] flex flex-col overflow-hidden">
        <ResponsiveModalHeader className="flex flex-col gap-1.5 shrink-0">
          <ResponsiveModalTitle className="text-lg font-semibold tracking-tight font-heading">
            {operation === "zero"
              ? "Mark uncollected work with draft zeros"
              : operation === "excuse"
                ? "Excuse selected work"
                : "Release grades to parents"}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-xs text-muted-foreground leading-relaxed">
            {operation === "release" ? (
              <>
                Publish validated cursive diagnostic scores and per-criterion feedback for{" "}
                <strong className="text-foreground">
                  {activityTitle ? `“${activityTitle}”` : "this activity"}
                </strong>{" "}
                to parent portals.
              </>
            ) : (
              `${studentIds.length} ${studentIds.length === 1 ? "student" : "students"} selected. ${
                operation === "zero"
                  ? "Only worksheets currently awaiting scan without an existing score will receive a draft zero. Saved changes stay draft until released to parents."
                  : "Their work will be excluded from both sides of the points total, and reminders will stop."
              }`
            )}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <ResponsiveModalBody className="flex flex-col gap-3.5 px-5 py-2 md:p-0">

        {operation === "release" && (
          <div className="flex flex-col gap-3.5">
            {/* Section Publication Overview */}
            <Card size="sm" className="rounded-lg border-border/80 py-0 overflow-hidden text-xs">
              <CardHeader className="bg-muted/40 px-3.5 py-2.5 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
                <span className="font-medium text-foreground">Assigned Sections</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {totalReadyAcrossSections}{" "}
                  {totalReadyAcrossSections === 1 ? "grade ready" : "grades ready"}
                </span>
              </CardHeader>

              <CardContent className="p-0 divide-y divide-border/40">
                {assignedSections.map((sec) => (
                  <div
                    key={sec.id}
                    className={cn(
                      "flex items-center justify-between px-3.5 py-2.5 transition-colors",
                      sec.isCurrent && "bg-primary/10"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{sec.name}</span>
                      {sec.isCurrent && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          Viewing
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {sec.isLoading ? (
                        <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Spinner className="size-3" />
                          Checking…
                        </span>
                      ) : sec.readyCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-band-4/30 bg-band-4/15 text-band-4-text tabular-nums"
                        >
                          <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
                          {sec.readyCount} ready to publish
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground tabular-nums">
                          0 ready · No drafts yet
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Zero Ready Alert (Actionable Recovery & Accessibility) */}
            {isZeroReadyTotal ? (
              <Alert
                aria-live="polite"
                className="rounded-lg border-band-2/30 bg-band-2/10 p-3.5 text-xs text-band-2-text"
              >
                <AlertCircle className="text-band-2-text" aria-hidden="true" />
                <AlertTitle className="text-xs font-semibold text-band-2-text">
                  No draft grades are ready to release
                </AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
                  No completed draft grades were found for this activity. Score student worksheets in the gradebook first before publishing to parent portals.
                </AlertDescription>
              </Alert>
            ) : eligibleCount === 0 && assignedSections.length > 1 ? (
              <Alert className="bg-muted/30">
                <AlertDescription className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    No draft grades are ready in <strong>{sectionName ?? "this section"}</strong> yet.
                  </span>
                  <span className="font-semibold text-foreground tabular-nums shrink-0">
                    {totalReadyAcrossSections} ready in other {assignedSections.length - 1 === 1 ? "section" : "sections"}
                  </span>
                </AlertDescription>
              </Alert>
            ) : null}

            {/* What Happens Upon Release Checklist */}
            <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground block">What parents receive</span>
              <ul className="flex flex-col gap-1 pl-4 list-disc text-muted-foreground text-xs leading-relaxed">
                <li>
                  Criterion feedback across letter formation, slant, spacing, baseline, and size consistency.
                </li>
                <li>
                  Unscored submissions and excused work remain private drafts in your teacher portal.
                </li>
                <li>
                  Results synchronize immediately to student parent portals across assigned sections.
                </li>
              </ul>
            </div>

            {/* High-Contrast Acknowledgment Checkbox */}
            {isMultiSectionRelease && totalReadyAcrossSections > 0 && (
              <Field
                orientation="horizontal"
                className="items-start gap-2.5 rounded-lg border border-border/80 bg-card hover:bg-muted/40 p-3 text-xs leading-relaxed text-foreground transition-colors"
              >
                <Checkbox
                  id="ack-cross-section"
                  checked={crossSectionAcknowledged}
                  onCheckedChange={(val) => setCrossSectionAcknowledged(Boolean(val))}
                  className="mt-0.5 border-foreground/60"
                  aria-describedby="ack-cross-section-desc"
                />
                <FieldLabel
                  htmlFor="ack-cross-section"
                  id="ack-cross-section-desc"
                  className="text-xs font-normal leading-relaxed cursor-pointer select-none"
                >
                  I have reviewed the sections above and confirm releasing ready grades across{" "}
                  <strong>all {assignedSections.length} assigned sections</strong>.
                </FieldLabel>
              </Field>
            )}
          </div>
        )}

        {operation !== "release" && (
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{eligibleCount}</span>{" "}
            eligible of {studentIds.length} selected. Eligibility is verified again when you
            confirm.
          </p>
        )}

        {message && (
          <Alert
            role="status"
            className="border-band-4/30 bg-band-4/10 text-band-4-text *:data-[slot=alert-description]:text-band-4-text"
          >
            <CheckCircle2 aria-hidden="true" />
            <AlertDescription className="text-xs">{message}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
        </ResponsiveModalBody>

        <ResponsiveModalFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border/40 shrink-0">
          {isZeroReadyTotal ? (
            <Button onClick={() => onOpenChange(false)} className="min-h-9">
              Back to gradebook
            </Button>
          ) : (
            <>
              <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)} className="min-h-9">
                {message ? "Close" : "Cancel"}
              </Button>
              {!message && (
                <Button disabled={isConfirmDisabled} onClick={() => void save()} className="min-h-9">
                  {pending ? (
                    <>
                      <Spinner data-icon="inline-start" />
                      {operation === "zero"
                        ? "Marking uncollected…"
                        : operation === "excuse"
                          ? "Excusing work…"
                          : "Releasing…"}
                    </>
                  ) : operation === "zero" ? (
                    "Mark uncollected (0 pts)"
                  ) : operation === "excuse" ? (
                    "Excuse work"
                  ) : (
                    `Release ${totalReadyAcrossSections} ${totalReadyAcrossSections === 1 ? "grade" : "grades"} to parents`
                  )}
                </Button>
              )}
            </>
          )}
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileX,
  MoreHorizontal,
  Send,
} from "lucide-react";
import type { GradebookCell, SectionGradebook } from "@/lib/hooks/use-gradebook";
import type { UnreadCommentThreads } from "@/lib/comments/types";
import { hasUnreadWorkComments } from "@/lib/comments/selection";
import { BandBadge } from "@/components/shared/band-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type GradebookRow = SectionGradebook["rows"][number];
type GradebookActivity = SectionGradebook["activities"][number];

const INLINE_ACTIVITY_LIMIT = 3;

export interface MobileGradebookListProps {
  rows: GradebookRow[];
  activities: GradebookActivity[];
  viewMode: "points" | "diagnostic";
  selectedStudentIds: ReadonlySet<string>;
  unreadThreads: UnreadCommentThreads | undefined;
  search: string;
  isSingleActivityFiltered: boolean;
  onToggleStudent: (studentId: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onOpenCell: (cell: GradebookCell) => void;
  onBeginBulk: (activityId: string, operation: "zero" | "excuse" | "release") => void;
  onViewActivity: (activityId: string) => void;
  onClearSearch: () => void;
}

function formatMobileStatus(status: string) {
  return status === "Missing" ? "Awaiting scan" : status;
}

function MobileActivityRow({
  activity,
  work,
  viewMode,
  hasUnread,
  onOpenCell,
}: {
  activity: GradebookActivity;
  work: GradebookCell | undefined;
  viewMode: "points" | "diagnostic";
  hasUnread: boolean;
  onOpenCell: (cell: GradebookCell) => void;
}) {
  const subtitle = `${
    activity.points_possible ? `${activity.points_possible} pts` : "Bands only"
  }${activity.is_archived ? " · Archived" : ""}`;

  if (!work || !work.applicable) {
    return (
      <Item variant="muted" size="sm">
        <ItemContent>
          <ItemTitle>{activity.title}</ItemTitle>
          <ItemDescription>{subtitle}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Badge variant="outline">Not assigned</Badge>
        </ItemActions>
      </Item>
    );
  }

  const isExcused = work.coursework_status === "Excused";
  const statusLabel = formatMobileStatus(work.coursework_status);
  const showDraft =
    !isExcused &&
    work.publication !== "released" &&
    (work.final_points !== null ||
      (work.points_possible === null && work.coursework_status === "Draft"));

  return (
    <Item
      variant="outline"
      size="sm"
      render={
        <button
          type="button"
          onClick={() => onOpenCell(work)}
          className="min-h-11 w-full cursor-pointer bg-card text-left hover:bg-muted/50"
        />
      }
    >
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">{activity.title}</ItemTitle>
        <ItemDescription>{subtitle}</ItemDescription>
      </ItemContent>

      <ItemActions className="max-w-full shrink-0 flex-wrap justify-end gap-1.5">
        {viewMode === "diagnostic" ? (
          work.assessment_composite !== null ? (
            <div className="flex items-center gap-1.5">
              <BandBadge score={Number(work.assessment_composite)} size="sm" />
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {Math.round(Number(work.assessment_composite))}%
              </span>
            </div>
          ) : (
            <Badge variant="outline">{statusLabel}</Badge>
          )
        ) : isExcused ? (
          <Badge variant="outline">Excused</Badge>
        ) : work.final_points !== null ? (
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {work.final_points}
            {work.points_possible !== null ? ` / ${work.points_possible}` : ""}
          </span>
        ) : (
          <Badge variant="outline">{statusLabel}</Badge>
        )}

        {showDraft && <Badge variant="secondary">Draft</Badge>}
        {work.late && (
          <Badge variant="outline" className="border-band-2/30 bg-band-2/15 text-band-2-text">
            Late
          </Badge>
        )}
        {hasUnread && <Badge variant="secondary">Unread</Badge>}
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </ItemActions>
    </Item>
  );
}

function MobileStudentGradeCard({
  row,
  activities,
  viewMode,
  isSelected,
  unreadThreads,
  isSingleActivityFiltered,
  onToggleStudent,
  onOpenCell,
}: {
  row: GradebookRow;
  activities: GradebookActivity[];
  viewMode: "points" | "diagnostic";
  isSelected: boolean;
  unreadThreads: UnreadCommentThreads | undefined;
  isSingleActivityFiltered: boolean;
  onToggleStudent: (studentId: string, checked: boolean) => void;
  onOpenCell: (cell: GradebookCell) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = !isSingleActivityFiltered && activities.length > INLINE_ACTIVITY_LIMIT;
  const primaryActivities = shouldCollapse
    ? activities.slice(0, INLINE_ACTIVITY_LIMIT)
    : activities;
  const overflowActivities = shouldCollapse ? activities.slice(INLINE_ACTIVITY_LIMIT) : [];
  const checkboxId = `mobile-gradebook-select-${row.student_id}`;

  return (
    <Card size="sm">
      <CardHeader className="items-center">
        <div className="flex min-w-0 items-center gap-2.5">
          <Checkbox
            id={checkboxId}
            checked={isSelected}
            onCheckedChange={(checked) => onToggleStudent(row.student_id, Boolean(checked))}
            aria-label={`Select ${row.student_name}`}
          />
          <CardTitle className="min-w-0 truncate text-sm">
            <FieldLabel
              htmlFor={checkboxId}
              className="flex min-h-11 cursor-pointer items-center truncate text-sm font-medium"
            >
              <span className="truncate">{row.student_name}</span>
            </FieldLabel>
          </CardTitle>
        </div>
        <CardAction className="flex items-center gap-1.5 self-center">
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {row.totals.earned} / {row.totals.possible}
          </span>
          <Badge variant="secondary" className="tabular-nums">
            {row.totals.percentage === null ? "No grades" : `${row.totals.percentage}%`}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        <ItemGroup className="gap-2">
          {primaryActivities.map((act) => {
            const work = row.cells.find((entry) => entry.activity_id === act.id);
            return (
              <MobileActivityRow
                key={act.id}
                activity={act}
                work={work}
                viewMode={viewMode}
                hasUnread={
                  work
                    ? hasUnreadWorkComments(unreadThreads, {
                        activityId: work.activity_id,
                        studentId: work.student_id,
                      })
                    : false
                }
                onOpenCell={onOpenCell}
              />
            );
          })}
        </ItemGroup>

        {overflowActivities.length > 0 && (
          <Collapsible open={expanded} onOpenChange={setExpanded} className="flex flex-col gap-2">
            <CollapsibleContent>
              <ItemGroup className="gap-2">
                {overflowActivities.map((act) => {
                  const work = row.cells.find((entry) => entry.activity_id === act.id);
                  return (
                    <MobileActivityRow
                      key={act.id}
                      activity={act}
                      work={work}
                      viewMode={viewMode}
                      hasUnread={
                        work
                          ? hasUnreadWorkComments(unreadThreads, {
                              activityId: work.activity_id,
                              studentId: work.student_id,
                            })
                          : false
                      }
                      onOpenCell={onOpenCell}
                    />
                  );
                })}
              </ItemGroup>
            </CollapsibleContent>
            <CollapsibleTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 w-full justify-between text-muted-foreground"
                />
              }
            >
              <span>
                {expanded
                  ? "Show fewer activities"
                  : `Show ${overflowActivities.length} more ${
                      overflowActivities.length === 1 ? "activity" : "activities"
                    }`}
              </span>
              <ChevronDown
                data-icon="inline-end"
                className={cn("transition-transform duration-200", expanded && "rotate-180")}
                aria-hidden="true"
              />
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

export function MobileGradebookList({
  rows,
  activities,
  viewMode,
  selectedStudentIds,
  unreadThreads,
  search,
  isSingleActivityFiltered,
  onToggleStudent,
  onToggleSelectAll,
  onOpenCell,
  onBeginBulk,
  onViewActivity,
  onClearSearch,
}: MobileGradebookListProps) {
  const [actionsDrawerOpen, setActionsDrawerOpen] = useState(false);

  if (!rows.length) {
    return (
      <Empty className="rounded-xl border border-border bg-card p-6">
        <EmptyHeader>
          <EmptyTitle>No students match “{search}”</EmptyTitle>
          <EmptyDescription>Try a different student name or clear the search filter.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" variant="outline" size="sm" onClick={onClearSearch} className="min-h-11">
            Clear search
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const allSelected = rows.length > 0 && rows.every((row) => selectedStudentIds.has(row.student_id));
  const selectedCount = selectedStudentIds.size;

  const runActionAndClose = (fn: () => void) => {
    setActionsDrawerOpen(false);
    fn();
  };

  return (
    <div className={cn("flex flex-col gap-3", selectedCount > 0 && "pb-24")}>
      <div className="flex items-center justify-between gap-2">
        <Field orientation="horizontal" className="w-auto min-h-11 items-center gap-2.5">
          <Checkbox
            id="mobile-gradebook-select-all"
            checked={allSelected}
            onCheckedChange={(checked) => onToggleSelectAll(Boolean(checked))}
            aria-label="Select shown students"
          />
          <FieldLabel
            htmlFor="mobile-gradebook-select-all"
            className="flex min-h-11 cursor-pointer items-center text-xs"
          >
            Select all ({rows.length})
          </FieldLabel>
        </Field>

        {activities.length > 0 && (
          <Drawer
            showSwipeHandle
            open={actionsDrawerOpen}
            onOpenChange={setActionsDrawerOpen}
          >
            <DrawerTrigger
              render={
                <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0" />
              }
            >
              <span>Activity actions</span>
              <MoreHorizontal data-icon="inline-end" aria-hidden="true" />
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader className="text-left">
                <DrawerTitle>Activity actions</DrawerTitle>
                <DrawerDescription>
                  Release grades, mark uncollected work, excuse students, or open activity details.
                </DrawerDescription>
              </DrawerHeader>
              <ScrollArea className="max-h-[60dvh] px-4 pb-2">
                <div className="flex flex-col gap-3 py-2">
                  {activities.map((act) => (
                    <Card key={act.id} size="sm">
                      <CardHeader>
                        <CardTitle className="truncate text-sm">{act.title}</CardTitle>
                        <CardAction>
                          <Badge variant="outline">
                            {act.points_possible ? `${act.points_possible} pts` : "Bands only"}
                          </Badge>
                        </CardAction>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 w-full justify-start"
                          onClick={() => runActionAndClose(() => onBeginBulk(act.id, "release"))}
                        >
                          <Send data-icon="inline-start" aria-hidden="true" />
                          <span>Release grades to parents</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={act.points_possible === null}
                          className="min-h-11 w-full justify-start"
                          onClick={() => runActionAndClose(() => onBeginBulk(act.id, "zero"))}
                        >
                          <FileX data-icon="inline-start" aria-hidden="true" />
                          <span>
                            {selectedCount
                              ? `Mark uncollected (0) for ${selectedCount}`
                              : "Mark uncollected (0 pts)"}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 w-full justify-start"
                          onClick={() => runActionAndClose(() => onBeginBulk(act.id, "excuse"))}
                        >
                          <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
                          <span>
                            {selectedCount ? `Excuse ${selectedCount} selected` : "Excuse all in section"}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-11 w-full justify-start"
                          onClick={() => runActionAndClose(() => onViewActivity(act.id))}
                        >
                          <ExternalLink data-icon="inline-start" aria-hidden="true" />
                          <span>View activity details</span>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
              <DrawerFooter>
                <DrawerClose
                  render={
                    <Button type="button" variant="outline" className="min-h-11">
                      Close
                    </Button>
                  }
                />
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <MobileStudentGradeCard
            key={row.student_id}
            row={row}
            activities={activities}
            viewMode={viewMode}
            isSelected={selectedStudentIds.has(row.student_id)}
            unreadThreads={unreadThreads}
            isSingleActivityFiltered={isSingleActivityFiltered}
            onToggleStudent={onToggleStudent}
            onOpenCell={onOpenCell}
          />
        ))}
      </div>
    </div>
  );
}

"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart3,
  Check,
  Clock,
  FileQuestion,
  MessageSquare,
  PenTool,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemMedia } from "@/components/ui/item";
import { cn } from "@/lib/utils";
import { notificationCopy, notificationHref } from "@/lib/notifications/presentation";
import type { NotificationLabels, NotificationRow } from "@/lib/notifications/data";

function getNotificationVisual(type: NotificationRow["type"]) {
  switch (type) {
    case "submission_rejected":
      return {
        icon: ScanLine,
        badgeStyle: "bg-destructive/10 text-destructive",
        dotStyle: "bg-destructive",
      };
    case "due_soon":
      return {
        icon: Clock,
        badgeStyle: "bg-warning/15 text-warning-foreground",
        dotStyle: "bg-warning",
      };
    case "activity_missing":
      return {
        icon: FileQuestion,
        badgeStyle: "bg-warning/15 text-warning-foreground",
        dotStyle: "bg-warning",
      };
    case "submission_returned":
    case "resubmitted_after_return":
      return {
        icon: RotateCcw,
        badgeStyle: "bg-secondary text-secondary-foreground",
        dotStyle: "bg-primary",
      };
    case "comment_posted":
      return {
        icon: MessageSquare,
        badgeStyle: "bg-secondary text-secondary-foreground",
        dotStyle: "bg-primary",
      };
    case "score_released":
      return {
        icon: BarChart3,
        badgeStyle: "bg-primary/10 text-primary",
        dotStyle: "bg-primary",
      };
    case "activity_assigned":
    default:
      return {
        icon: PenTool,
        badgeStyle: "bg-primary/10 text-primary",
        dotStyle: "bg-primary",
      };
  }
}

export const NotificationRowItem = memo(function NotificationRowItem({
  row,
  labels,
  role,
  pending,
  onRead,
  onActivate,
}: {
  row: NotificationRow;
  labels: NotificationLabels;
  role: "teacher" | "parent";
  pending: boolean;
  onRead: (id: string) => void;
  onActivate: (row: NotificationRow) => void;
}) {
  const unread = row.read_at === null;
  const visual = getNotificationVisual(row.type);
  const IconComponent = visual.icon;

  const createdAtDate = useMemo(() => new Date(row.created_at), [row.created_at]);
  const formattedDistance = useMemo(
    () => formatDistanceToNow(createdAtDate, { addSuffix: true }),
    [createdAtDate]
  );
  const formattedTitle = useMemo(() => createdAtDate.toLocaleString(), [createdAtDate]);

  return (
    <Item
      role="listitem"
      data-notification-id={row.id}
      size="xs"
      variant={unread ? "muted" : "default"}
      className={cn(
        "group relative flex-nowrap items-start gap-3 rounded-lg p-2.5 transition-colors border",
        unread
          ? "bg-primary/5 hover:bg-primary/10 border-primary/15"
          : "border-transparent hover:bg-muted/50"
      )}
    >
      {/* Primary card link covering icon + text */}
      <Link
        href={notificationHref(row, role)}
        onClick={() => onActivate(row)}
        onAuxClick={(event) => {
          if (event.button === 1) onActivate(row);
        }}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Domain-grounded pedagogical icon with semantic urgency & unread indicator dot */}
        <ItemMedia className="relative mt-0.5 shrink-0">
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-colors",
              unread
                ? visual.badgeStyle
                : "bg-muted text-muted-foreground"
            )}
            aria-hidden="true"
          >
            <IconComponent className="size-4" />
          </div>
          {unread && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-popover",
                visual.dotStyle
              )}
              aria-hidden="true"
            />
          )}
        </ItemMedia>

        <ItemContent className="min-w-0 flex-1 gap-1 group-data-[size=xs]/item:gap-1">
          <span className="sr-only">
            {unread ? "Unread notification: " : "Read notification: "}
          </span>
          <span
            className={cn(
              "text-sm leading-snug",
              unread ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
            )}
          >
            {notificationCopy(row.type)}
          </span>
          <span className="text-muted-foreground line-clamp-1 text-xs">
            {labels.students[row.student_id] ?? "Student"} ·{" "}
            {labels.activities[row.activity_id] ?? "Handwriting activity"}
          </span>
          <time
            dateTime={row.created_at}
            title={formattedTitle}
            className="text-muted-foreground text-xs font-sans tabular-nums"
          >
            {formattedDistance}
          </time>
        </ItemContent>
      </Link>

      {/* Quick mark-as-read action ONLY when unread with 44px tap target expansion that doesn't bleed into title link */}
      {unread && !(row.type === "comment_posted" && !row.comment_version) && (
        <ItemActions className="shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="relative size-8 md:size-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted rounded-md touch-manipulation cursor-pointer after:absolute after:-inset-y-2 after:-end-3 after:start-0 focus-visible:ring-2 focus-visible:ring-ring"
            disabled={pending}
            aria-label={`Mark as read: ${notificationCopy(row.type)} for ${labels.students[row.student_id] ?? "Student"}`}
            onClick={(e) => {
              e.stopPropagation();
              onRead(row.id);
            }}
          >
            <Check aria-hidden="true" />
          </Button>
        </ItemActions>
      )}
    </Item>
  );
});

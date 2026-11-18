"use client";

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
import { cn } from "@/lib/utils";
import { notificationCopy, notificationHref } from "@/lib/notifications/presentation";
import type { NotificationLabels, NotificationRow } from "@/lib/notifications/data";

function getNotificationVisual(type: NotificationRow["type"]) {
  switch (type) {
    case "submission_rejected":
      return {
        icon: ScanLine,
        badgeStyle: "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive",
        dotStyle: "bg-destructive",
      };
    case "due_soon":
      return {
        icon: Clock,
        badgeStyle: "bg-warning/15 text-warning-foreground dark:bg-warning/20 dark:text-warning",
        dotStyle: "bg-warning",
      };
    case "activity_missing":
      return {
        icon: FileQuestion,
        badgeStyle: "bg-warning/15 text-warning-foreground dark:bg-warning/20 dark:text-warning",
        dotStyle: "bg-warning",
      };
    case "submission_returned":
    case "resubmitted_after_return":
      return {
        icon: RotateCcw,
        badgeStyle: "bg-secondary text-secondary-foreground dark:bg-secondary/40 dark:text-secondary-foreground",
        dotStyle: "bg-primary",
      };
    case "comment_posted":
      return {
        icon: MessageSquare,
        badgeStyle: "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
        dotStyle: "bg-brand-600 dark:bg-brand-400",
      };
    case "score_released":
      return {
        icon: BarChart3,
        badgeStyle: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
        dotStyle: "bg-primary",
      };
    case "activity_assigned":
    default:
      return {
        icon: PenTool,
        badgeStyle: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
        dotStyle: "bg-primary",
      };
  }
}

export function NotificationRowItem({
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

  return (
    <li
      data-notification-id={row.id}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg p-2.5 transition-colors border",
        unread
          ? "bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/15 border-primary/10 dark:border-primary/20"
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
        <div className="relative mt-0.5 shrink-0">
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
                "absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-background",
                visual.dotStyle
              )}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
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
            title={new Date(row.created_at).toLocaleString()}
            className="text-muted-foreground text-xs font-sans tabular-nums"
          >
            {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
          </time>
        </div>
      </Link>

      {/* Quick mark-as-read action ONLY when unread with 44px tap target expansion that doesn't bleed into title link */}
      {unread && (
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 md:size-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted rounded-md touch-manipulation cursor-pointer after:absolute after:-inset-y-2 after:-inset-e-3 after:-inset-s-0 focus-visible:ring-2 focus-visible:ring-ring"
          disabled={pending}
          aria-label={`Mark as read: ${notificationCopy(row.type)} for ${labels.students[row.student_id] ?? "Student"}`}
          onClick={(e) => {
            e.stopPropagation();
            onRead(row.id);
          }}
        >
          <Check className="size-3.5" aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

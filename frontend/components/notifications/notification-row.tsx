"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  Award,
  BookOpen,
  CameraOff,
  Check,
  Clock,
  FileCheck2,
  Loader2,
  MessageSquareQuote,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notificationHref, notificationMeta } from "@/lib/notifications/presentation";
import type { NotificationLabels, NotificationRow } from "@/lib/notifications/data";

export interface NotificationRowItemProps {
  row: NotificationRow;
  labels: NotificationLabels;
  role: "teacher" | "parent";
  pending?: boolean;
  onRead?: (id: string) => void;
  onActivate: (row: NotificationRow) => void;
}

function NotificationIcon({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case "camera-off":
      return <CameraOff className={className} aria-hidden="true" />;
    case "rotate-ccw":
      return <RotateCcw className={className} aria-hidden="true" />;
    case "award":
      return <Award className={className} aria-hidden="true" />;
    case "file-check":
      return <FileCheck2 className={className} aria-hidden="true" />;
    case "message-square":
      return <MessageSquareQuote className={className} aria-hidden="true" />;
    case "book-open":
      return <BookOpen className={className} aria-hidden="true" />;
    case "clock":
      return <Clock className={className} aria-hidden="true" />;
    case "alert-circle":
      return <AlertCircle className={className} aria-hidden="true" />;
    default:
      return <BookOpen className={className} aria-hidden="true" />;
  }
}

export function NotificationRowItem({
  row,
  labels,
  role,
  pending = false,
  onRead,
  onActivate,
}: NotificationRowItemProps) {
  const unread = row.read_at === null;
  const meta = notificationMeta(row.type);
  const studentName = labels.students[row.student_id] ?? "Student";
  const activityTitle = labels.activities[row.activity_id] ?? "Handwriting activity";

  return (
    <li
      className={cn(
        "group relative flex items-start justify-between border-b border-border/40 last:border-b-0 transition-colors",
        unread
          ? "bg-primary/[0.04] hover:bg-primary/[0.08]"
          : "hover:bg-muted/50"
      )}
    >
      <Link
        href={notificationHref(row, role)}
        onClick={() => onActivate(row)}
        onAuxClick={(event) => {
          if (event.button === 1) onActivate(row);
        }}
        className={cn(
          "flex min-w-0 flex-1 items-start gap-3 rounded-lg px-2.5 py-3 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        )}
      >
        {/* Left Event Icon Badge with Unread Pip */}
        <div className="relative mt-0.5 shrink-0">
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105",
              meta.containerClass
            )}
          >
            <NotificationIcon name={meta.iconName} className="size-4.5" />
          </div>
          {unread && (
            <span
              className={cn(
                "absolute -top-1 -right-1 size-2.5 rounded-full ring-2 ring-background transition-opacity",
                meta.dotClass
              )}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Text Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={cn(
                  "text-sm leading-snug tracking-tight truncate",
                  unread ? "font-semibold text-foreground" : "font-medium text-foreground/85"
                )}
              >
                <span className="sr-only">{unread ? "Unread notification: " : ""}</span>
                {studentName}
              </span>
              <span className="text-muted-foreground/40 text-xs shrink-0 select-none" aria-hidden="true">
                ·
              </span>
              <span className="text-xs text-muted-foreground truncate font-sans">
                {activityTitle}
              </span>
            </div>
            <time
              dateTime={row.created_at}
              title={new Date(row.created_at).toLocaleString()}
              className="shrink-0 text-xs text-muted-foreground/80 tabular-nums font-sans"
            >
              {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
            </time>
          </div>

          <p className="line-clamp-1 text-xs leading-normal">
            <span
              className={cn(
                "font-medium",
                unread ? "text-foreground" : "text-foreground/80"
              )}
            >
              {meta.copy}
            </span>
            <span className="text-muted-foreground/75 font-sans">
              {" "}— {meta.description}
            </span>
          </p>
        </div>
      </Link>

      {/* Individual Mark as Read action */}
      {unread && onRead && (
        <div className="flex items-center pr-2.5 pt-3 shrink-0">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRead(row.id);
            }}
            disabled={pending}
            title="Mark as read"
            aria-label={`Mark notification for ${labels.students[row.student_id] ?? "student"} as read`}
            className={cn(
              "flex size-8 sm:size-7 items-center justify-center rounded-md border border-border/50 bg-background/80 text-muted-foreground shadow-xs transition-all cursor-pointer",
              "hover:border-primary/40 hover:bg-primary/10 hover:text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
              // Accessible on touch mobile; refined hover/focus reveal on desktop
              "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            )}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </li>
  );
}

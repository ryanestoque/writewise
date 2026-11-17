"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  Award,
  BookOpen,
  CameraOff,
  Clock,
  FileCheck2,
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
  onActivate,
}: NotificationRowItemProps) {
  const unread = row.read_at === null;
  const meta = notificationMeta(row.type);

  return (
    <li className="border-b border-border/40 last:border-b-0">
      <Link
        href={notificationHref(row, role)}
        onClick={() => onActivate(row)}
        onAuxClick={(event) => {
          if (event.button === 1) onActivate(row);
        }}
        className={cn(
          "group flex items-start gap-3 rounded-lg px-2.5 py-3 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          unread
            ? "bg-primary/[0.04] hover:bg-primary/[0.08]"
            : "hover:bg-muted/50"
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
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "text-sm leading-snug tracking-tight transition-colors",
                unread ? "font-semibold text-foreground" : "font-normal text-foreground/85"
              )}
            >
              <span className="sr-only">{unread ? "Unread notification: " : ""}</span>
              {meta.copy}
            </span>
            <time
              dateTime={row.created_at}
              title={new Date(row.created_at).toLocaleString()}
              className="shrink-0 text-xs text-muted-foreground/80 tabular-nums font-sans"
            >
              {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
            </time>
          </div>

          <p className="line-clamp-1 text-xs text-muted-foreground leading-normal">
            <span className="font-medium text-foreground/75">
              {labels.students[row.student_id] ?? "Student"}
            </span>
            {" · "}
            <span>{labels.activities[row.activity_id] ?? "Handwriting activity"}</span>
          </p>

          <p className="line-clamp-1 text-xs text-muted-foreground/80 font-sans">
            {meta.description}
          </p>
        </div>
      </Link>
    </li>
  );
}

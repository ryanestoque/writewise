"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notificationCopy, notificationHref } from "@/lib/notifications/presentation";
import type { NotificationLabels, NotificationRow } from "@/lib/notifications/data";

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
  return (
    <li className={cn("flex gap-2 border-b px-1 py-3 last:border-b-0", unread && "bg-muted/40")}>
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-2">
        <Link
          href={notificationHref(row, role)}
          onClick={() => onActivate(row)}
          onAuxClick={(event) => {
            if (event.button === 1) onActivate(row);
          }}
          className="focus-visible:ring-ring flex min-w-0 flex-col gap-1 rounded-md outline-none focus-visible:ring-2"
        >
          <span className={cn("text-sm", unread && "font-semibold")}>
            {notificationCopy(row.type)}
          </span>
          <span className="text-muted-foreground line-clamp-2 text-xs">
            {labels.students[row.student_id] ?? "Student"} ·{" "}
            {labels.activities[row.activity_id] ?? "Handwriting activity"}
          </span>
          <time
            dateTime={row.created_at}
            title={new Date(row.created_at).toLocaleString()}
            className="text-muted-foreground text-xs"
          >
            {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
          </time>
        </Link>
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          {unread ? (
            <Circle className="size-2 fill-current" aria-hidden="true" />
          ) : (
            <Check className="size-3" aria-hidden="true" />
          )}
          <span>{unread ? "Unread" : "Read"}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="xs"
        className="shrink-0 self-start"
        disabled={pending}
        aria-disabled={!unread || pending}
        aria-label={`${unread ? "Mark read" : "Read"}: ${notificationCopy(row.type)}`}
        onClick={() => {
          if (unread && !pending) onRead(row.id);
        }}
      >
        {pending ? "Saving…" : unread ? "Mark read" : "Read"}
      </Button>
    </li>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import type { ActivityWorkState } from "@/lib/hooks/use-activity-work";
import { teacherWorkStatusLabel } from "@/lib/utils/activity-work";

const ACTIVITY_CLOCK_INTERVAL_MS = 60000;
const clockListeners = new Set<() => void>();
let currentClockNow = 0;
let clockIntervalId: ReturnType<typeof setInterval> | null = null;

function notifyClockListeners() {
  for (const listener of clockListeners) {
    listener();
  }
}

function syncActivityClock() {
  if (typeof document !== "undefined" && document.hidden) return;
  currentClockNow = Date.now();
  notifyClockListeners();
}

function handleClockVisibilityChange() {
  if (!document.hidden) {
    syncActivityClock();
  }
}

function subscribeActivityClock(listener: () => void) {
  if (clockListeners.size === 0) {
    currentClockNow = Date.now();
    clockIntervalId = setInterval(syncActivityClock, ACTIVITY_CLOCK_INTERVAL_MS);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleClockVisibilityChange);
    }
  }
  clockListeners.add(listener);
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0) {
      if (clockIntervalId !== null) {
        clearInterval(clockIntervalId);
        clockIntervalId = null;
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleClockVisibilityChange);
      }
    }
  };
}

function getActivityClockSnapshot() {
  return currentClockNow;
}

function getActivityClockServerSnapshot() {
  return 0;
}

export function useActivityNow() {
  return useSyncExternalStore(
    subscribeActivityClock,
    getActivityClockSnapshot,
    getActivityClockServerSnapshot
  );
}

export function ActivityWorkStatus({
  state,
  unavailable = false,
  isScored,
  hideDraftPending = false,
}: {
  state?: ActivityWorkState | null;
  unavailable?: boolean;
  isScored?: boolean;
  hideDraftPending?: boolean;
}) {
  if (!state && unavailable) return <span className="text-sm text-muted-foreground">Work status unavailable</span>;
  if (!state) return <span className="text-sm text-muted-foreground">Loading work status…</span>;
  const work = { status: state.work_status, late: state.late };
  const showStatusBadge = !(hideDraftPending && work.status === "Draft" && !isScored);

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {showStatusBadge && (
        <Badge
          variant={work.status === "Missing" || work.status === "Released" ? "outline" : "secondary"}
          className={
            work.status === "Missing"
              ? "border-band-1/30 bg-band-1/10 text-band-1 dark:border-band-1/40 dark:bg-band-1/20 font-medium"
              : work.status === "Released"
                ? "border-band-4/30 bg-band-4/10 text-band-4-text dark:border-band-4/40 dark:bg-band-4/20 font-medium"
                : work.status === "Draft"
                  ? isScored
                    ? "border-primary/25 text-primary bg-primary/10 font-medium"
                    : "border-primary/20 text-primary/90 bg-primary/5 dark:bg-primary/10 font-medium"
                  : undefined
          }
        >
          {work.status === "Draft"
            ? isScored
              ? "Ready to release"
              : "Needs rubric"
            : teacherWorkStatusLabel(work.status)}
        </Badge>
      )}
      {work.late && work.status !== "Excused" && (
        <Badge variant="outline" className="border-band-2/40 bg-band-2/10 text-band-2-text">
          Late
        </Badge>
      )}
    </span>
  );
}

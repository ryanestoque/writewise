"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ActivityWorkState } from "@/lib/hooks/use-activity-work";
import { teacherWorkStatusLabel } from "@/lib/utils/activity-work";

export function useActivityNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  return now;
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
        <Badge variant="outline" className="border-amber-300/60 text-amber-700 dark:text-amber-400">
          Late
        </Badge>
      )}
    </span>
  );
}

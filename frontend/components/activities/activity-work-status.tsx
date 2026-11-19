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
}: {
  state?: ActivityWorkState | null;
  unavailable?: boolean;
  isScored?: boolean;
}) {
  if (!state && unavailable) return <span className="text-sm text-muted-foreground">Work status unavailable</span>;
  if (!state) return <span className="text-sm text-muted-foreground">Loading work status…</span>;
  const work = { status: state.work_status, late: state.late };
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge
        variant={work.status === "Missing" || work.status === "Released" ? "outline" : "secondary"}
        className={
          work.status === "Missing"
            ? "border-amber-300/80 bg-amber-50/80 text-amber-800 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-300"
            : work.status === "Released"
              ? "border-emerald-300/80 bg-emerald-50/80 text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium"
              : work.status === "Draft"
                ? isScored
                  ? "border-primary/30 text-primary bg-primary/10 font-medium"
                  : "border-border text-muted-foreground bg-muted/50 font-normal"
                : undefined
        }
      >
        {work.status === "Draft"
          ? isScored
            ? "Ready to release"
            : "Needs rubric scoring"
          : teacherWorkStatusLabel(work.status)}
      </Badge>
      {work.late && work.status !== "Excused" && (
        <Badge variant="outline" className="border-amber-300/60 text-amber-700 dark:text-amber-400">
          Late
        </Badge>
      )}
    </span>
  );
}

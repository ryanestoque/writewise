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
}: {
  state?: ActivityWorkState | null;
  unavailable?: boolean;
}) {
  if (!state && unavailable) return <span className="text-sm text-muted-foreground">Work status unavailable</span>;
  if (!state) return <span className="text-sm text-muted-foreground">Loading work status…</span>;
  const work = { status: state.work_status, late: state.late };
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <Badge variant={work.status === "Missing" ? "destructive" : "secondary"}>{teacherWorkStatusLabel(work.status)}</Badge>
      {work.late && work.status !== "Excused" && <Badge variant="outline">Late</Badge>}
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ActivityWorkState } from "@/lib/hooks/use-activity-work";

export function useActivityNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function ActivityWorkStatus({ state }: { state?: ActivityWorkState | null }) {
  if (!state) return <span className="text-muted-foreground text-sm">Loading work status…</span>;
  const work = { status: state.work_status, late: state.late };
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <Badge variant="secondary">{work.status}</Badge>
      {work.late && work.status !== "Excused" && <Badge variant="outline">Late</Badge>}
    </span>
  );
}

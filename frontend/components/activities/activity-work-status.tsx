"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { deriveActivityWorkStatus, type WorkAttempt } from "@/lib/utils/activity-work";

export function useActivityNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function ActivityWorkStatus({
  dueAt,
  attempts,
}: {
  dueAt: string | null;
  attempts: WorkAttempt[];
}) {
  const now = useActivityNow();
  const work = deriveActivityWorkStatus(dueAt, now, attempts);
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <Badge variant={work.status === "Missing" ? "destructive" : "secondary"}>{work.status}</Badge>
      {work.late && <Badge variant="outline">Late</Badge>}
    </span>
  );
}

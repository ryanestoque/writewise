const MANILA = "Asia/Manila";

export function toActivityDueAt(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Enter a valid due date and time.");
  }
  const date = new Date(`${value}:00+08:00`);
  if (!Number.isFinite(date.getTime()) || toActivityDueInput(date.toISOString()) !== value) {
    throw new Error("Enter a valid due date and time.");
  }
  return date.toISOString();
}

export function toActivityDueInput(value: string | null): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatActivityDueAt(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function activitySubmissionsClosed(
  activity: {
    due_at: string | null;
    close_after_due: boolean;
  },
  now: number
): boolean {
  return activity.close_after_due && !!activity.due_at && now > Date.parse(activity.due_at);
}

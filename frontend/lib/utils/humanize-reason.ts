/** Turns a snake_case reason code into a sentence-case phrase for display. */
export function humanizeReason(reason: string): string {
  const text = reason.replaceAll("_", " ").trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

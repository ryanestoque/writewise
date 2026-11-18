/** Include every selected attempt, even when its card is outside the current view. */
export function summarizeAttemptSelection<T extends { id: string; student_id: string }>(
  attempts: T[],
  selectedIds: ReadonlySet<string>,
  displayedIds: readonly string[]
) {
  const displayed = new Set(displayedIds);
  const entries = attempts
    .filter((attempt) => selectedIds.has(attempt.id))
    .map((attempt) => ({ attempt, hidden: !displayed.has(attempt.id) }));
  return {
    entries,
    studentCount: new Set(entries.map(({ attempt }) => attempt.student_id)).size,
    hiddenCount: entries.filter((entry) => entry.hidden).length,
    unavailableCount: selectedIds.size - entries.length,
  };
}

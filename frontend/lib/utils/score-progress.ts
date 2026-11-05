export function getScoreProgressDirection(delta: number) {
  if (delta >= 1.5) return "improving";
  if (delta <= -1.5) return "lower";
  return "steady";
}

export function getScoreProgressLabel(
  delta: number,
  comparison: "first" | "previous"
) {
  const direction = getScoreProgressDirection(delta);
  if (direction === "improving") return `Improving since the ${comparison} worksheet`;
  if (direction === "lower") return `Lower than the ${comparison} worksheet`;
  return `Steady since the ${comparison} worksheet`;
}

export function formatScoreDifference(delta: number) {
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} percentage points`;
}

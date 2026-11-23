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
  if (comparison === "previous") {
    if (direction === "improving") return "Improving";
    if (direction === "lower") return "Lower";
    return "Steady";
  }
  if (direction === "improving") return "Improving since first";
  if (direction === "lower") return "Lower than first";
  return "Steady since first";
}

export function formatScoreDifference(delta: number) {
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pts`;
}

export function getScoreProgressSupportNote(delta: number): string | null {
  if (getScoreProgressDirection(delta) === "lower") {
    return "Longer words or new sentences can dip scores briefly — steady practice builds consistency.";
  }
  return null;
}

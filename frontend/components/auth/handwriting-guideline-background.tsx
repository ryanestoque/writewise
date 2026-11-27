/**
 * Atmospheric handwriting guidelines background:
 * Matches the landing page hero's full-width ruled practice paper
 * (warm paper tint + 144px slate ascender, dashed teal midline, and rust baseline).
 */
export function HandwritingGuidelineBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 select-none hero-practice-paper"
    />
  );
}

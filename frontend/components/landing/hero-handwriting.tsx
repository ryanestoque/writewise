import { useId, type CSSProperties } from "react";
import { HERO_GLYPHS } from "./hero-handwriting-paths";
import styles from "@/app/landing.module.css";

// Same advances as Learning Curve; spaces are pauses where the pen lifts.
const LETTERS = [
  ["s", 0],
  ["t", 24],
  ["r", 46],
  ["o", 72],
  ["k", 101],
  ["e", 132],
  ["b", 180],
  ["y", 212],
  ["s", 277],
  ["t", 301],
  ["r", 323],
  ["o", 349],
  ["k", 378],
  ["e", 409],
  [".", 430],
] as const;

// Build a deterministic timeline once, outside React's render.
// Entry handwriting animation scaled to 2.5 seconds (2500ms).
const TARGET_WRITING_DURATION_MS = 2500;
const RAW_DURATION_SUM = LETTERS.reduce((sum, [letter], index) => {
  const glyph = HERO_GLYPHS[letter];
  const pause = index === 6 || index === 8 ? 100 : 0;
  const strokeSum = glyph.strokes.reduce((acc, stroke) => acc + stroke.duration, 0);
  return sum + pause + strokeSum;
}, 0);
const WRITING_TIME_SCALE = TARGET_WRITING_DURATION_MS / RAW_DURATION_SUM;

const WRITING_SEQUENCE = (() => {
  let delay = 380;
  return LETTERS.map(([letter, x], index) => {
    const glyph = HERO_GLYPHS[letter];
    if (index === 6 || index === 8) delay += 100 * WRITING_TIME_SCALE;
    const strokes = glyph.strokes.map((stroke) => {
      const start = delay;
      const duration = stroke.duration * WRITING_TIME_SCALE;
      delay += duration;
      return { ...stroke, duration, delay: start };
    });
    return { x, outline: glyph.outline, strokes };
  });
})();

export function HeroHandwriting() {
  const id = useId();

  return (
    <span className={styles.heroCursive}>
      {/* Real text keeps the heading accessible and visible without JS or motion. */}
      <span className={styles.heroCursiveText}>stroke by stroke.</span>
      <svg className={styles.heroWriting} viewBox="0 0 444 100" aria-hidden="true">
        {WRITING_SEQUENCE.map(({ x, outline, strokes }, index) => {
          const maskId = `${id}-letter-${index}`;

          return (
            <g key={maskId} transform={`translate(${x} 0)`}>
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse" x="-5" y="0" width="55" height="105">
                  {strokes.map((stroke, strokeIndex) => (
                    <path
                      key={strokeIndex}
                      className={styles.heroWritingStroke}
                      d={stroke.d}
                      pathLength="100"
                      style={
                        {
                          "--stroke-duration": `${stroke.duration}ms`,
                          "--stroke-delay": `${stroke.delay}ms`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </mask>
              </defs>
              <path d={outline} mask={`url(#${maskId})`} />
            </g>
          );
        })}
      </svg>
    </span>
  );
}

"use client";

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import styles from "@/app/landing.module.css";

const GUIDE = { top: 35, mid: 64, base: 94 } as const;

interface Word {
  text: string;
  x: number;
  width: number;
  dy: number;
  skew: number;
  scale: number;
}

type BandKey = "developing" | "satisfactory" | "excellent";

interface Slip {
  id: string;
  label: string;
  words: Word[];
  criterion: string;
  band: BandKey;
  bandLabel: string;
  observation: string;
  next: string;
  description: string;
}

const SLIPS: Slip[] = [
  {
    id: "week-1",
    label: "Week 1",
    words: [
      { text: "kites", x: 16, width: 110, dy: 0, skew: 0, scale: 1 },
      { text: "fly", x: 130, width: 74, dy: 0, skew: 0, scale: 1 },
      { text: "high", x: 244, width: 104, dy: 0, skew: 0, scale: 1 },
    ],
    criterion: "Spacing",
    band: "developing",
    bandLabel: "Developing",
    observation: "“kites” and “fly” touch; “high” sits too far away.",
    next: "Leave a finger-width between words.",
    description:
      "Week 1 spacing example of “kites fly high”: the first two words touch, then a wide gap separates “fly” and “high.”",
  },
  {
    id: "week-4",
    label: "Week 4",
    words: [
      { text: "kites", x: 16, width: 110, dy: 0, skew: 0, scale: 1 },
      { text: "fly", x: 142, width: 74, dy: 0, skew: 0, scale: 1 },
      { text: "high", x: 244, width: 104, dy: 0, skew: 0, scale: 1 },
    ],
    criterion: "Spacing",
    band: "satisfactory",
    bandLabel: "Satisfactory",
    observation: "Words are separated; the gap before “high” is wider.",
    next: "Keep the same finger-width gap after each word.",
    description:
      "Week 4 spacing example of “kites fly high”: the words are separated, but the gap before “high” is still wider.",
  },
  {
    id: "week-8",
    label: "Week 8",
    words: [
      { text: "kites", x: 16, width: 110, dy: 0, skew: 0, scale: 1 },
      { text: "fly", x: 148, width: 74, dy: 0, skew: 0, scale: 1 },
      { text: "high", x: 244, width: 104, dy: 0, skew: 0, scale: 1 },
    ],
    criterion: "Spacing",
    band: "excellent",
    bandLabel: "Excellent",
    observation: "Even gaps make each word easy to read.",
    next: "Keep these spaces across a full sentence.",
    description: "Week 8 spacing example of “kites fly high”: equal gaps separate all three words.",
  },
];

const end = (w: Word) => w.x + w.width * w.scale;

function spacingGaps(words: Word[]) {
  const [a, b, c] = words;
  const gaps = [
    { after: a.text, x1: end(a), x2: b.x },
    { after: b.text, x1: end(b), x2: c.x },
  ];
  const even = Math.abs(gaps[0].x2 - gaps[0].x1 - (gaps[1].x2 - gaps[1].x1)) < 2;

  return gaps.map((gap, i) => ({
    ...gap,
    label:
      gap.x2 - gap.x1 < 6 ? "touching" : even ? "even gap" : i === 0 ? "small gap" : "wide gap",
  }));
}

function Guides() {
  return (
    <g aria-hidden="true">
      <line className={styles.guideTop} x1="0" x2="360" y1={GUIDE.top} y2={GUIDE.top} />
      <line className={styles.guideMid} x1="0" x2="360" y1={GUIDE.mid} y2={GUIDE.mid} />
      <line className={styles.guideBase} x1="0" x2="360" y1={GUIDE.base} y2={GUIDE.base} />
    </g>
  );
}

function Handwriting({ words }: { words: Word[] }) {
  return (
    <g className={styles.ink}>
      {words.map((w) => (
        <text
          key={w.text}
          transform={`translate(${w.x} ${GUIDE.base + w.dy}) skewX(${w.skew}) scale(${w.scale})`}
          textLength={w.width}
          lengthAdjust="spacingAndGlyphs"
        >
          {w.text}
        </text>
      ))}
    </g>
  );
}

function SpacingNotes({ words }: { words: Word[] }) {
  const gaps = spacingGaps(words);
  const y = GUIDE.base + 16;
  return (
    <g className={styles.noteLayer}>
      {gaps.map((gap) => {
        const mid = (gap.x1 + gap.x2) / 2;
        return (
          <path
            key={gap.after}
            className={gap.label === "even gap" ? styles.markGood : styles.markWarm}
            d={
              gap.label === "touching"
                ? `M${mid - 7},${y - 6} l5,6 l-5,6 M${mid + 7},${y - 6} l-5,6 l5,6`
                : `M${gap.x1 + 2},${y - 5} v5 H${gap.x2 - 2} v-5`
            }
          />
        );
      })}
    </g>
  );
}

function SlipDrawing({ slip }: { slip: Slip }) {
  return (
    <span className={styles.slipDrawing} data-band={slip.band}>
      <svg
        className={styles.slipSvg}
        viewBox="0 0 360 140"
        role="img"
        aria-label={slip.description}
      >
        <Guides />
        <Handwriting words={slip.words} />
        <SpacingNotes words={slip.words} />
      </svg>
      <span className={styles.spacingLabels} aria-hidden="true">
        {spacingGaps(slip.words).map((gap) => (
          <span key={gap.after}>
            <span className={styles.spacingAfter}>After &ldquo;{gap.after}&rdquo;</span>
            <span className={styles.spacingLabel}>{gap.label}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

export function GrowthStrip() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const slip = SLIPS[active];

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    let next: number | null = null;
    if (event.key in keys) next = (active + keys[event.key] + SLIPS.length) % SLIPS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = SLIPS.length - 1;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={styles.growthCard}>
      <div
        className={styles.slips}
        role="tablist"
        aria-label="Compare spacing across practice weeks"
      >
        {SLIPS.map((s, i) => {
          const selected = i === active;
          return (
            <button
              key={s.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={`${baseId}-tab-${s.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              className={styles.slip}
              data-selected={selected}
              style={{ "--i": i } as CSSProperties}
              onClick={() => setActive(i)}
              onKeyDown={onKeyDown}
            >
              <span className={styles.slipHead}>
                <span className={styles.slipWeek}>{s.label}</span>
              </span>
              <SlipDrawing slip={s} />
            </button>
          );
        })}
      </div>

      <div className={styles.thread} aria-hidden="true">
        <svg viewBox="0 0 600 44" preserveAspectRatio="none">
          <path
            className={styles.threadPath}
            d="M100,36 C175,36 225,28 300,22 C375,16 425,10 500,8"
          />
        </svg>
        <span
          className={styles.threadNode}
          data-active={active === 0}
          style={{ left: "16.667%", top: "82%" }}
        />
        <span
          className={styles.threadNode}
          data-active={active === 1}
          style={{ left: "50%", top: "50%" }}
        />
        <span
          className={styles.threadNode}
          data-active={active === 2}
          style={{ left: "83.333%", top: "18%" }}
        />
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${slip.id}`}
        className={styles.feedback}
        tabIndex={0}
      >
        <div key={slip.id} className={styles.feedbackInner}>
          <div className={styles.feedbackTitle}>
            <span className={styles.feedbackWeekLabel}>
              {slip.label} · {slip.criterion}
            </span>
            <span className={styles.band} data-band={slip.band}>
              <span className={styles.bandDot} aria-hidden="true" />
              {slip.bandLabel}
            </span>
          </div>
          <div className={styles.mobileComparison}>
            <SlipDrawing slip={slip} />
          </div>
          <dl className={styles.feedbackBody}>
            <div>
              <dt>What we see</dt>
              <dd>{slip.observation}</dd>
            </div>
            <div>
              <dt>Practice next</dt>
              <dd>{slip.next}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

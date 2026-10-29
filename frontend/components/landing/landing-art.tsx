import type { ReactNode } from "react";
import styles from "@/app/landing.module.css";

/*
 * Authored schematic illustrations for the landing page.
 * Cursive strokes are generated from one loop primitive so overlays share the
 * exact coordinates of the "handwriting" they annotate.
 */

const G = { top: 18, mid: 50, base: 80 } as const;

interface Glyph {
  w: number;
  /** Height the loop reaches (G.top for tall letters, G.mid for small). */
  top: number;
  base?: number;
  /** Horizontal lean of the loop top, px (positive = right). */
  lean?: number;
  /** Leave the loop open (formation fault). */
  open?: boolean;
  /** Pen lift before this glyph, px. */
  gap?: number;
}

interface Placed extends Required<Omit<Glyph, "gap">> {
  x: number;
}

function place(startX: number, glyphs: Glyph[]): Placed[] {
  let x = startX;
  return glyphs.map((g) => {
    x += g.gap ?? 0;
    const p: Placed = {
      x,
      w: g.w,
      top: g.top,
      base: g.base ?? G.base,
      lean: g.lean ?? 8,
      open: g.open ?? false,
    };
    x += g.w;
    return p;
  });
}

function loop(p: Placed, forceClosed = false) {
  const { x, w, top, base, lean } = p;
  const midY = (base + top) / 2;
  const back = p.open && !forceClosed ? x + w * 0.66 + lean : x + w * 0.36 + lean;
  return (
    `C${x + w * 0.3},${base} ${x + w * 0.55 + lean * 0.5},${midY} ${x + w * 0.56 + lean},${top + 7} ` +
    `C${x + w * 0.6 + lean},${top - 3} ${back + 2},${top - 3} ${back},${top + 9} ` +
    `C${back - lean * 0.4},${midY + 6} ${x + w * 0.56},${base} ${x + w},${base}`
  );
}

function strokes(placed: Placed[]) {
  let d = "";
  placed.forEach((p, i) => {
    const prev = placed[i - 1];
    if (!prev || prev.x + prev.w < p.x - 0.5) d += `M${p.x - 6},${p.base} L${p.x},${p.base} `;
    d += loop(p) + " ";
  });
  return d;
}

function SpecimenGuides() {
  return (
    <g aria-hidden="true">
      <line className={styles.guideTop} x1="0" x2="240" y1={G.top} y2={G.top} />
      <line className={styles.guideMid} x1="0" x2="240" y1={G.mid} y2={G.mid} />
      <line className={styles.guideBase} x1="0" x2="240" y1={G.base} y2={G.base} />
    </g>
  );
}

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg className={styles.specimen} viewBox="0 0 240 100" role="img" aria-label={label}>
      <SpecimenGuides />
      {children}
    </svg>
  );
}

/* ---------------------------- Specimens ---------------------------- */

export function FormationSpecimen() {
  const p = place(22, [
    { w: 34, top: G.top },
    { w: 28, top: G.mid },
    { w: 34, top: G.top, open: true },
    { w: 28, top: G.mid },
    { w: 34, top: G.top },
    { w: 28, top: G.mid },
  ]);
  const fault = p[2];
  return (
    <Specimen label="Letter formation: a row of cursive l and e loops where one l loop is left open, with the intended closed loop drawn as a dashed guide.">
      <path className={styles.pencil} pathLength={600} d={strokes(p)} />
      <g className={styles.specimenNotes}>
        <path
          className={styles.markCoolDash}
          d={`M${fault.x},${fault.base} ${loop(fault, true)}`}
        />
        <circle className={styles.markWarm} cx={fault.x + 22 + fault.lean} cy={G.top + 14} r="13" />
      </g>
    </Specimen>
  );
}

export function SizeSpecimen() {
  const tops = [G.mid, G.mid - 15, G.mid + 9, G.mid - 4, G.mid + 2, G.mid];
  const p = place(20, tops.map((top) => ({ w: 32, top })));
  return (
    <Specimen label="Size consistency: small cursive loops of uneven heights, some rising above and some falling short of the midline.">
      <path className={styles.pencil} pathLength={600} d={strokes(p)} />
      <g className={styles.specimenNotes}>
        <line className={styles.markCool} x1="10" x2="230" y1={G.mid} y2={G.mid} />
        {p.map((g, i) =>
          Math.abs(g.top - G.mid) > 5 ? (
            <line
              key={i}
              className={styles.markWarm}
              x1={g.x + 18 + g.lean}
              x2={g.x + 18 + g.lean}
              y1={G.mid}
              y2={g.top - 2}
            />
          ) : null
        )}
      </g>
    </Specimen>
  );
}

export function SpacingSpecimen() {
  const word = (gap: number): Glyph[] => [
    { w: 22, top: G.mid, gap },
    { w: 22, top: G.mid },
    { w: 22, top: G.mid },
  ];
  const p = place(14, [...word(0), ...word(5), ...word(34)]);
  const gaps: [number, number][] = [
    [p[2].x + p[2].w, p[3].x],
    [p[5].x + p[5].w, p[6].x],
  ];
  return (
    <Specimen label="Spacing: three cursive words where the first two nearly touch and the third sits after a wide gap.">
      <path className={styles.pencil} pathLength={600} d={strokes(p)} />
      <g className={styles.specimenNotes}>
        {gaps.map(([a, b], i) => (
          <path
            key={i}
            className={styles.markWarm}
            d={`M${a - 1},${G.base + 6} v6 H${b + 1} v-6`}
          />
        ))}
      </g>
    </Specimen>
  );
}

export function SlantSpecimen() {
  const leans = [12, 12, -6, 12, 13, 12];
  const p = place(18, leans.map((lean) => ({ w: 34, top: G.top, lean })));
  return (
    <Specimen label="Slant: a row of tall cursive loops leaning right, with one loop tipping backward against the slant guides.">
      <path className={styles.pencil} pathLength={600} d={strokes(p)} />
      <g className={styles.specimenNotes}>
        {p.map((g, i) => (
          <line
            key={i}
            className={g.lean < 0 ? styles.markWarm : styles.markCool}
            x1={g.x + 14}
            y1={G.base}
            x2={g.x + 18 + g.lean * 1.4}
            y2={G.top - 4}
          />
        ))}
      </g>
    </Specimen>
  );
}

export function BaselineSpecimen() {
  const bases = [80, 78, 74, 70, 66, 62];
  const p = place(18, bases.map((base, i) => ({ w: 32, top: i % 2 ? base - 62 : base - 30, base })));
  return (
    <Specimen label="Baseline alignment: cursive letters that drift upward away from the baseline as the word goes on.">
      <path className={styles.pencil} pathLength={600} d={strokes(p)} />
      <g className={styles.specimenNotes}>
        <path
          className={styles.markWarmDash}
          d={`M${p[0].x - 6},${p[0].base + 1} L${p[5].x + p[5].w + 6},${p[5].base - 1}`}
        />
      </g>
    </Specimen>
  );
}

/* --------------------------- Workflow art --------------------------- */

export function UploadArt() {
  return (
    <svg
      className={styles.stepArt}
      viewBox="0 0 240 160"
      role="img"
      aria-label="A phone framing a photographed cursive worksheet, with a check that the photo is sharp and complete."
    >
      <g transform="rotate(-4 120 92)">
        <rect className={styles.artPaper} x="44" y="48" width="152" height="96" rx="3" />
        {[70, 98, 126].map((y) => (
          <g key={y}>
            <line className={styles.guideTop} x1="56" x2="184" y1={y - 14} y2={y - 14} />
            <line className={styles.guideMid} x1="56" x2="184" y1={y - 6} y2={y - 6} />
            <line className={styles.guideBase} x1="56" x2="184" y1={y} y2={y} />
          </g>
        ))}
        <path
          className={styles.pencilThin}
          d="M60,70 c6,0 9,-8 10,-14 c1,-5 -4,-5 -4,0 c0,7 4,14 10,14 c5,0 7,-6 8,-8 c1,-3 -3,-3 -3,0 c0,4 3,8 8,8 c6,0 9,-12 10,-16 c1,-4 -4,-4 -4,1 c0,6 4,15 10,15 c5,0 7,-6 8,-8 c1,-3 -3,-3 -3,0 c0,4 3,8 9,8"
        />
        <path
          className={styles.pencilThin}
          d="M60,98 c6,0 8,-6 9,-8 c1,-3 -3,-3 -3,0 c0,4 3,8 8,8 c6,0 9,-12 10,-16 c1,-4 -4,-4 -4,1 c0,6 4,15 10,15 c5,0 7,-6 8,-8 c1,-3 -3,-3 -3,0 c0,4 3,8 9,8"
        />
      </g>
      <rect className={styles.artPhone} x="30" y="20" width="180" height="136" rx="16" />
      <path
        className={styles.artFrame}
        pathLength={100}
        d="M42,42 v-10 h12 M186,32 h12 v10 M198,134 v10 h-12 M54,144 h-12 v-10"
      />
      <g transform="translate(166 8)">
        <circle className={styles.artCheckDisc} cx="16" cy="16" r="16" />
        <path className={styles.artCheck} pathLength={30} d="M9,16.5 l5,5 l9,-10" />
      </g>
    </svg>
  );
}

export function AssessArt() {
  const p = place(28, [
    { w: 30, top: 44 },
    { w: 26, top: 74 },
    { w: 30, top: 44, lean: -4 },
    { w: 26, top: 74 },
    { w: 30, top: 44, gap: 18 },
    { w: 26, top: 74 },
  ]).map((g) => ({ ...g, base: 104 }));
  return (
    <svg
      className={styles.stepArt}
      viewBox="0 0 240 160"
      role="img"
      aria-label="A handwritten word with slant guides, a spacing bracket, and the baseline drawn over it as measurement lines."
    >
      <line className={styles.guideTop} x1="10" x2="230" y1="40" y2="40" />
      <line className={styles.guideMid} x1="10" x2="230" y1="72" y2="72" />
      <line className={styles.guideBase} x1="10" x2="230" y1="104" y2="104" />
      <path className={styles.pencil} pathLength={600} d={strokes(p)} />
      {p
        .filter((_, i) => i % 2 === 0)
        .map((g, i) => (
          <line
            key={i}
            className={g.lean < 0 ? styles.markWarm : styles.markCool}
            x1={g.x + 12}
            y1="110"
            x2={g.x + 16 + g.lean * 1.6}
            y2="34"
          />
        ))}
      <path className={styles.markWarm} d={`M${p[3].x + p[3].w},116 v6 H${p[4].x} v-6`} />
      <line className={styles.markGood} x1="18" x2="222" y1="104" y2="104" />
      <g transform="translate(26 132)">
        <rect className={styles.artChip} width="78" height="18" rx="9" />
        <circle cx="12" cy="9" r="3.5" fill="var(--color-band-2)" />
        <rect x="21" y="7" width="46" height="4" rx="2" fill="var(--color-band-2-text)" opacity="0.7" />
        <rect className={styles.artLine} x="90" y="4" width="120" height="4" rx="2" />
        <rect className={styles.artLine} x="90" y="12" width="84" height="4" rx="2" />
      </g>
    </svg>
  );
}

export function ProgressArt() {
  return (
    <svg
      className={styles.stepArt}
      viewBox="0 0 240 160"
      role="img"
      aria-label="A progress line rising across several assessments, with fainter lines for other criteria."
    >
      {[34, 66, 98, 130].map((y) => (
        <line key={y} className={styles.artGrid} x1="20" x2="224" y1={y} y2={y} />
      ))}
      <path className={styles.artFaint} d="M28,118 C70,112 96,104 128,92 S190,70 216,64" />
      <path className={styles.artFaint} d="M28,104 C64,108 100,96 132,84 S184,58 216,52" />
      <path
        className={styles.artThread}
        pathLength={400}
        d="M28,126 C62,124 80,108 106,98 C134,88 150,72 176,54 C192,44 204,40 216,36"
      />
      {[
        [28, 126],
        [106, 98],
        [176, 54],
        [216, 36],
      ].map(([cx, cy]) => (
        <circle key={cx} className={styles.artNode} cx={cx} cy={cy} r="5" />
      ))}
    </svg>
  );
}

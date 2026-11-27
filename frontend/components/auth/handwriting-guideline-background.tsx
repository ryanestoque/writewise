/**
 * Atmospheric handwriting guidelines background:
 * Renders WriteWise's 3-color penmanship guide (slate ascender, teal dotted midline,
 * terracotta baseline, plus subtle 68° cursive slant guides) to frame auth surfaces.
 */
export function HandwritingGuidelineBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none animate-auth-guidelines"
    >
      {/* Soft warm radial ambient glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 size-[720px] rounded-full bg-brand-100/60 blur-3xl opacity-80 dark:bg-brand-900/25" />

      {/* 3-color cursive penmanship guide lines & slant pattern */}
      <svg
        className="absolute inset-0 size-full [mask-image:linear-gradient(to_bottom,transparent_0%,white_14%,white_86%,transparent_100%)]"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="cursive-ruled-lines"
            width="120"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            {/* Cursive 68-degree slant guide */}
            <line
              x1="10"
              y1="80"
              x2="42"
              y2="0"
              className="stroke-brand-700/10 dark:stroke-brand-300/10"
              strokeWidth="0.75"
              strokeDasharray="3 6"
            />
            <line
              x1="70"
              y1="80"
              x2="102"
              y2="0"
              className="stroke-brand-700/10 dark:stroke-brand-300/10"
              strokeWidth="0.75"
              strokeDasharray="3 6"
            />

            {/* Top ascender / headline (slate) */}
            <line
              x1="0"
              y1="16"
              x2="120"
              y2="16"
              className="stroke-slate-400/25 dark:stroke-slate-400/15"
              strokeWidth="1"
            />
            {/* Midline / x-height (teal dotted) */}
            <line
              x1="0"
              y1="36"
              x2="120"
              y2="36"
              className="stroke-brand-600/25 dark:stroke-brand-400/20"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            {/* Baseline (warm terracotta) */}
            <line
              x1="0"
              y1="56"
              x2="120"
              y2="56"
              className="stroke-[#b6754a]/30 dark:stroke-[#b6754a]/22"
              strokeWidth="1.25"
            />
            {/* Descender line */}
            <line
              x1="0"
              y1="76"
              x2="120"
              y2="76"
              className="stroke-slate-400/15 dark:stroke-slate-400/10"
              strokeWidth="0.75"
              strokeDasharray="2 4"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cursive-ruled-lines)" />
      </svg>
    </div>
  );
}

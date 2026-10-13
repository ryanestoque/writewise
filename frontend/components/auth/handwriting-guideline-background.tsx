/**
 * Atmospheric handwriting guidelines background:
 * Evokes authentic ruled cursive notebook lines (ascender, midline, baseline, descender)
 * along with subtle 68° slant guidelines reminiscent of cursive practice sheets.
 */
export function HandwritingGuidelineBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none"
    >
      {/* Soft warm radial ambient glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 size-[720px] rounded-full bg-brand-100/60 blur-3xl opacity-80 dark:bg-brand-900/25" />

      {/* Handwriting ruled guide lines & slant pattern */}
      <svg
        className="absolute inset-0 size-full stroke-brand-700/10 dark:stroke-brand-200/8 [mask-image:radial-gradient(ellipse_at_center,white_35%,transparent_80%)]"
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
            <line x1="10" y1="80" x2="42" y2="0" strokeWidth="0.75" strokeDasharray="3 6" opacity="0.6" />
            <line x1="70" y1="80" x2="102" y2="0" strokeWidth="0.75" strokeDasharray="3 6" opacity="0.6" />

            {/* Top ascender line */}
            <line x1="0" y1="16" x2="120" y2="16" strokeWidth="1" strokeDasharray="3 3" />
            {/* Midline / x-height */}
            <line x1="0" y1="36" x2="120" y2="36" strokeWidth="1" strokeDasharray="5 4" />
            {/* Baseline */}
            <line x1="0" y1="56" x2="120" y2="56" strokeWidth="1.25" />
            {/* Descender line */}
            <line x1="0" y1="76" x2="120" y2="76" strokeWidth="0.75" strokeDasharray="2 3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cursive-ruled-lines)" />
      </svg>
    </div>
  );
}

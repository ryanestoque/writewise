# Landing page technical audit — 28 October 2026

Scope: the current working-tree implementation of `/`, its landing components, and the shared worksheet inspector and diagnostic overlay used by its example assessment. This is an Impeccable technical audit, not a redesign. No application code was changed.

## Implementation integrity verdict

**Pass, with isolated inconsistencies.** The ruled worksheets, cursive accent, spacing comparison, explanatory assessment, and teacher/parent account paths form a coherent WriteWise experience. Synthetic examples and separate paper consent are disclosed. The main integrity concern is that score-band colours differ between the growth strip, assessment preview, and explanatory legend.

## Audit health score

| Dimension | Score | Key finding |
|---|---:|---|
| Accessibility | 3/4 | Small annotation text fails contrast in its default state; Top does not restore focus. |
| Performance | 3/4 | Below-fold worksheet is eagerly loaded by dimension probes despite a lazy image. |
| Responsive design | 3/4 | 320px and 390px layouts hold up; annotation hit areas target 36px rather than the documented 44px. |
| Theming | 3/4 | Local landing tokens duplicate global tokens, and band palettes diverge. |
| Implementation integrity | 3/4 | Product-specific, honest demo with minor inconsistency in its visual vocabulary. |
| **Total** | **15/20** | **Good — address weak dimensions.** |

This is a review score, not a Lighthouse score or WCAG conformance certification. **6 findings: 0 P0, 1 P1, 4 P2, 1 P3.**

## Findings, in priority order

### 1. [P1] Default spacing annotation label fails text contrast

- **Location:** `frontend/components/shared/diagnostic-overlay/layers/spacing-layer.tsx:194`, `:204`; colour in `frontend/components/shared/diagnostic-overlay/constants.ts:27`.
- **Category:** Accessibility.
- **Evidence:** The initial spacing selection renders “Tight gap” in white over `#c2410c` at `fillOpacity=0.85`, on the white synthetic worksheet. Alpha composition gives approximately `rgb(203, 94, 48)` and **4.06:1** contrast. The small `9.5 * hitScale` SVG text needs 4.5:1. The active pill's 0.95 opacity produces about 4.79:1, but the unselected state still fails.
- **Impact:** A key diagnostic label is difficult to read for users with low vision, particularly in the small phone preview.
- **Standard:** [WCAG 1.4.3, Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- **Recommendation:** Give text-bearing annotation pills an opaque, sufficiently dark background; retain translucency on geometric annotations. Recheck all pill states and criterion layers.
- **Suggested command:** `$impeccable harden`.

### 2. [P2] Top scrolls visually but leaves focus on a disappearing button

- **Location:** `frontend/components/landing/back-to-top.tsx:21`, `:36`; `frontend/app/landing.module.css:1237`.
- **Category:** Accessibility / Implementation integrity.
- **Evidence:** The handler calls `window.scrollTo` without moving focus. On returning above 600px, the button becomes transparent, stops receiving pointer events, and gets `tabIndex=-1`. Removing an already-focused button from the tab sequence does not move focus. It also remains exposed to assistive technology when visually hidden.
- **Impact:** Keyboard users return visually to the header while keyboard focus remains at the end of the main content, with an invisible focus indicator.
- **Recommendation:** Move focus to a suitable top destination with `preventScroll`, then perform the requested scroll. Remove the hidden button from the accessibility tree or unmount it after transferring focus.
- **Suggested command:** `$impeccable harden`.

### 3. [P2] SVG annotation touch targets miss the landing page's 44px standard

- **Location:** `frontend/components/shared/diagnostic-overlay/layers/spacing-layer.tsx:73`, `:112`; `frontend/app/landing.module.css:1324`.
- **Category:** Responsive design.
- **Evidence:** Spacing hit areas deliberately use a `36 * hitScale` minimum. The landing CSS applies 44px minimums to HTML `button` and `summary` elements, but SVG annotations use `<g role="button">` and transparent SVG rectangles. Those rules do not enlarge their hit geometry. Comparable 36px geometry appears in the slant layer.
- **Impact:** Small annotation targets are harder to activate accurately on phones than the generously sized criterion rows.
- **Standard:** `docs/DESIGN.md` §8.5 specifies 44px touch targets. This is **not automatically a WCAG AA failure**: [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) uses a 24px minimum with exceptions.
- **Recommendation:** Raise the actual SVG hit-area minimum to 44 CSS pixels after scaling. Check adjacent targets for overlap; changing CSS on the `<g>` alone will not change its hit geometry.
- **Suggested command:** `$impeccable adapt`.

### 4. [P2] Score-band colours have multiple competing definitions

- **Location:** `frontend/app/landing.module.css:7`, `:589`; `frontend/lib/utils/submission-status.ts:83`, `:97`, `:111`; `frontend/components/landing/assessment-preview.tsx:106`.
- **Category:** Theming / Implementation integrity.
- **Evidence:** The growth strip and legend use local ochre/sage/forest band colours. The assessment imports a helper returning Tailwind amber, pine brand, and emerald classes. “Satisfactory,” for example, appears sage in the legend and pine teal in assessment badges. Landing variables also duplicate existing global brand and neutral values.
- **Impact:** The explanatory legend does not consistently teach the colour vocabulary used in the adjacent assessment. Duplicated tokens make future palette changes prone to drift.
- **Recommendation:** Share semantic band/background/text/border tokens across strip, legend, and assessment badges. Alias existing brand tokens rather than repeating their hex values. Verify all consumers before changing the shared helper.
- **Suggested command:** `$impeccable colorize`.

### 5. [P2] Dimension probes defeat the example worksheet's lazy loading

- **Location:** `frontend/components/shared/worksheet-image-inspector.tsx:141`, `:150`, `:818`; `frontend/components/shared/diagnostic-overlay/diagnostic-overlay.tsx:218`, `:230`.
- **Category:** Performance.
- **Evidence:** Both mounted components independently create `new Image()` and assign the worksheet URL in effects. The visible image says `loading="lazy"`, but these probes start the resource load on mount anyway. The local SVG is **133,833 bytes**, including an embedded font; the application separately loads its own Learning Curve font.
- **Impact:** Users who only read the hero still load the below-fold demonstration asset. Independent dimension state adds avoidable decoding/setup work.
- **Recommendation:** Supply the known 620×430 dimensions for this static example and share dimensions with the overlay, or defer the entire preview's initialization until it approaches the viewport. Consider a subset font or outlined lettering for this small fixed illustration.
- **Limit:** No production transfer or timing measurements were taken. Browser caching may coalesce identical requests; this is **not** a claim that the SVG transfers three times.
- **Suggested command:** `$impeccable optimize`.

### 6. [P3] Reduced-motion handling omits the floating Top control

- **Location:** `frontend/app/landing.module.css:1263`, `:1286`, `:1298`, `:1335`.
- **Category:** Accessibility / Motion.
- **Evidence:** The Top button always translates/scales into view and translates its arrow on hover. The reduced-motion override only targets CTA arrows. The JavaScript scroll handler does correctly select instant scrolling for reduced motion.
- **Impact:** A user requesting reduced motion still receives avoidable movement from this control.
- **Recommendation:** Under reduced motion, keep the visibility/state change but remove the Top control's transform transitions and hover arrow movement. Preserve its focus and hover feedback.
- **Suggested command:** `$impeccable animate`.

## Patterns and strengths

The recurring gaps occur where the landing page composes shared production UI: shared colour helpers and SVG interaction geometry do not automatically inherit the landing page's palette and target-size rules. Token duplication is the other source of drift.

Preserve the single main landmark, skip link, labelled navigation, visible focus treatments, descriptive synthetic illustrations, native disclosures, selected-state labels, live coaching feedback, and focus-scoped image shortcuts. The phone layout retains section navigation and account actions, stacks the assessment cleanly, and provides full-width handwriting comparisons. Server-rendering the criteria reference and passing it into the client preview also keeps that static reference out of its client component implementation.

## Verification and limits

- Inspected current source and the live local page at `http://127.0.0.1:3000/` in Brave: desktop, 390px phone, and 320px phone views. The working tree already contained landing-page changes; this audit reviews those changes as displayed.
- Inspected the assessment preview and verified that selecting a criterion and pressing Arrow Down selects the next criterion and updates the annotations and coaching text.
- Calculated contrast from the actual SVG colour, opacity, and white worksheet background. Main muted text is approximately 5.96:1 on white; primary teal is approximately 6.31:1 on white. The printed guide colours exceed 3:1 on pine wash.
- `npx.cmd eslint .`: passed.
- `npx.cmd tsc --noEmit --incremental false`: passed.
- `backend/.venv/Scripts/ruff.exe check .`, run from `backend/`: passed. The `uv run` wrapper could not access its default cache, so the installed Ruff executable was used.
- Impeccable's context launcher could not initialize its engine in the restricted cache location. Existing project context was read directly. The bundled detector was unavailable; findings here are manually verified, not detector output.
- No production Lighthouse/Core Web Vitals measurement, screen-reader session, dark-theme runtime test, or 200% text-only scaling test was performed. No dark-mode defect is asserted: there is no active theme switcher in the reviewed provider. Missing image width/height attributes were not counted as a layout-shift defect because the visible viewer reserves its dimensions.
- No backend behavior, migrations, or application code changed; backend integration tests were not needed for this audit.

## Recommended actions

1. **[P1/P2] `$impeccable harden`** — fix annotation text contrast and Top focus/hidden state.
2. **[P2] `$impeccable adapt`** — make SVG annotation hit geometry meet the documented 44px minimum.
3. **[P2] `$impeccable colorize`** — unify score-band colours and reuse semantic tokens.
4. **[P2] `$impeccable optimize`** — defer the worksheet load and consolidate dimension handling.
5. **[P3] `$impeccable animate`** — complete reduced-motion coverage for Top.
6. **`$impeccable polish`** — confirm desktop/mobile appearance after those fixes.

You can ask me to run these one at a time, all at once, or in any order you prefer. Re-run `$impeccable audit` after fixes to reassess the score.

Guideline cross-check: [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md).

# Public legal pages

Implemented November 15, 2026. `/privacy` and `/terms` are public reading pages, reachable without signing in. The landing footer links to both; signup opens each in a clearly labeled new tab so the form stays available. These additions do not collect consent or change registration behavior. Contact: `info@writewise.tech`.

The pages extend [DESIGN.md](../DESIGN.md) and [PRODUCT.md](../PRODUCT.md). They preserve the incumbent teal identity, shared logo, and Poppins heading / Inter body pairing. Root design tokens and `.impeccable/design.json` remain unchanged. Page direction is **Read**: legible prose, restrained hierarchy, and direct navigation.

The landing page retains its three-column privacy and safety strip with shortened descriptions of paper-only student participation, photo metadata removal, and authorized access. A minimum-44px, underlined “Read our Privacy Policy” link below the strip leads to `/privacy`.

## Implementation

- `frontend/app/privacy/page.tsx` and `frontend/app/terms/page.tsx` own page metadata and section content.
- `frontend/components/legal/legal-page.tsx` provides the shared server-rendered structure: header, keyboard skip link, main/article landmarks, labeled contents navigation, semantic sections, contact, update date, and legal footer with current-page state.
- `frontend/components/legal/legal-page.module.css` uses existing semantic color variables. The reading column is capped at `70ch`, with `1rem` body text and `1.8` line height. Desktop contents use a sticky 220px column; below 768px they become a two-column inline list. Contents and footer navigation have minimum 44px targets. Print styles hide surrounding navigation; print output was not separately verified.
- Small additions to `frontend/app/page.tsx`, `frontend/app/landing.module.css`, and `frontend/app/signup/page.tsx` expose the links. `frontend/middleware.ts` adds both paths to public routes. The legal pages add no client component or interactive dependency.

The existing palette is reused through `--background` (`#f7f8f7`), `--foreground` (`#1e2422`), `--muted-foreground` (`#5b6663`), `--primary` (`#1b6b63`), `--secondary` (`#e4f1ef`), `--secondary-foreground` (`#145049`), and `--border` (`#e3e6e4`). The summary uses the established 12px panel radius. Larger reading text and 44px navigation targets are local adaptations, not changes to global tokens.

## Content boundaries

Source references are [docs/DESIGN.md](DESIGN.md) §8.5 **Public Landing Page** and §8.4 **Self-Service Signup Flow**, plus [docs/SECURITY.md](SECURITY.md) §5.3 **Third-party sub-processors**, §6.3 **Data retention & deletion**, and §6.4 **Data subject withdrawal procedure**.

Keep the privacy copy aligned with those security sections when operations change:

- Participation consent remains on paper; signup and reading the terms do not replace it. Students have no accounts.
- Identified records, images, and identified backup copies follow the defense-plus-six-month retention schedule. Genuinely anonymized research exports may be retained indefinitely.
- Worksheet deletion does not erase backups or previous exports. Removing a teacher link does not delete the student or historical records.
- Full withdrawal requires coordination; it is not a completed self-service workflow. Already computed aggregate calibration statistics cannot simply remove an individual contribution.
- EXIF removal does not remove identifiers visible in a photo. The academic project description does not claim institutional operation, endorsement, or certification.

This implementation note records product behavior and source alignment; it does not certify legal compliance or deployment.

## Validation recorded for this addition

Frontend-only scope; no new automated test suite was introduced. Completed checks:

- `npx.cmd eslint .` and `npx.cmd tsc --noEmit` passed in `frontend/`. A direct Node invocation of TypeScript also passed after formatting.
- `backend/.venv/Scripts/ruff.exe check .` passed in `backend/`; the installed executable was used because the `uv` launcher cache was inaccessible.
- Isolated headless Chrome QA at 1440×1000 and 390×844 confirmed anonymous HTTP 200 responses, correct legal-page titles/headings, no horizontal overflow, contents/footer navigation targets at least 44px high, working anchors and home/footer links, keyboard skip navigation, accessible signup new-tab labels, and no browser page errors.
- Independent finish review inspected source and all 12 screenshots, checked the palette's text pairs above 4.5:1 contrast, and returned **SHIP**, with no material findings or pending fixes.

Runtime evidence is in `.impeccable/review/legal-qa.cjs` and `.impeccable/review/`: `privacy-{desktop,mobile}.png`, `terms-{desktop,mobile}.png`, their `-viewport.png` variants, `landing-footer-{desktop,mobile}.png`, and `signup-{desktop,mobile}.png`. The script uses a machine-specific Playwright cache path; it is review evidence rather than a portable CI suite. QA did not submit forms, modify accounts, publish, or deploy. Impeccable CLI context/detection could not run because of engine-cache restrictions; tokens, source, and browser output were reviewed directly.

Suggested PR validation: “Adds public Privacy Policy and Terms of Service pages and links from the landing footer/signup, extending docs/DESIGN.md §§8.4–8.5 and reflecting docs/SECURITY.md §§5.3, 6.3–6.4. ESLint, TypeScript, and Ruff passed; desktop/mobile anonymous browser QA and independent visual review passed. No consent workflow or deployment changes.”

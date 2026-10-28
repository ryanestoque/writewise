/*
 * THESIS: Growth is the proof. The opening shows one phrase practised across three weeks,
 * annotated, instead of the category's "product screenshot beside a headline" hero.
 * OWN-WORLD: WriteWise pine teal (#1b6b63), soft pine wash, white practice slips on a
 * #f7f8f7 canvas; Poppins display, Inter body, Learning Curve handwriting; printed
 * top/mid/baseline guides; one hand-inked teal growth thread; developmental band colours
 * always paired with their names.
 * STORY: See growth -> teacher/parent benefits -> try the assessment -> understand the
 * workflow -> explore criteria on demand -> signup -> full privacy and research details.
 * FIRST VIEWPORT: Slim nav, Poppins headline with a cursive "see", then a ruled
 * handwriting comparison. Signup follows the example with research and parent-linking
 * context. Phones show comparison specimens before the selected coaching note.
 * FORM: The Growth Strip, grounded candidate 4 of 7, seed key 993be458.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
 * review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { GrowthStrip } from "@/components/landing/growth-strip";
import { AssessmentPreview } from "@/components/landing/assessment-preview";
import { PrivacyDetails } from "@/components/landing/privacy-details";
import { BackToTop } from "@/components/landing/back-to-top";
import {
  AssessArt,
  BaselineSpecimen,
  FormationSpecimen,
  ProgressArt,
  SizeSpecimen,
  SlantSpecimen,
  SpacingSpecimen,
  UploadArt,
} from "@/components/landing/landing-art";
import { createClient } from "@/lib/supabase/server";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "WriteWise | Cursive practice, turned into next steps",
  description:
    "WriteWise assesses photographed cursive worksheets across five criteria, writes encouraging next-step feedback, and tracks each learner’s progress for teachers and parents. Students stay on paper.",
};

const CONTRACT =
  "<!-- THESIS: growth is the proof; three annotated practice slips lead. OWN-WORLD: pine teal, soft pine wash, white ruled slips, Poppins/Inter/Learning Curve, one inked growth thread. STORY: see growth, teacher/parent benefits, try assessment, workflow, optional criteria detail, create an account. FIRST VIEWPORT: headline, supporting copy, Week 1/4/8 strip, then signup with research and parent-linking context. FORM: The Growth Strip, candidate 4 of 7, seed 993be458. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->";

const steps = [
  {
    id: "upload",
    title: "Upload a photo",
    body: "Upload the completed worksheet to its activity. If the photo is unclear or incomplete, you’ll see why and can retake it.",
    Art: UploadArt,
  },
  {
    id: "assess",
    title: "Read the assessment",
    body: "See measurement guides on the handwriting, a band for each criterion, and a specific next step.",
    Art: AssessArt,
  },
  {
    id: "progress",
    title: "Follow the progress",
    body: "Compare assessments over time and choose where the next lesson should focus.",
    Art: ProgressArt,
  },
];

const criteria = [
  {
    id: "formation",
    name: "Letter formation",
    body: "Letters are shaped and joined the way they’re taught: loops close, strokes connect, nothing floats loose.",
    note: "Most loops close neatly. Next: finish the loop in “l” before joining the next letter.",
    Specimen: FormationSpecimen,
  },
  {
    id: "size",
    name: "Size consistency",
    body: "Small letters stay between the midline and baseline; tall letters reach the top line, every time.",
    note: "Some small letters stretch past the midline. Next: aim each one at the dotted line.",
    Specimen: SizeSpecimen,
  },
  {
    id: "spacing",
    name: "Spacing",
    body: "Even gaps between letters, and a clear, steady space between words.",
    note: "Two words run together. Next: leave a finger-width after each word.",
    Specimen: SpacingSpecimen,
  },
  {
    id: "slant",
    name: "Slant",
    body: "Letters lean in one consistent direction, with downstrokes that run parallel.",
    note: "One letter tips backward. Next: keep downstrokes parallel to the slant guide.",
    Specimen: SlantSpecimen,
  },
  {
    id: "baseline",
    name: "Baseline alignment",
    body: "Letters rest on the bottom line instead of floating above or dipping below it.",
    note: "The word climbs toward the end. Next: rest every letter on the bottom line.",
    Specimen: BaselineSpecimen,
  },
];

const bands = [
  { key: "needs", label: "Needs Improvement" },
  { key: "developing", label: "Developing" },
  { key: "satisfactory", label: "Satisfactory" },
  { key: "excellent", label: "Excellent" },
];

const teacherPoints = [
  "Set the words to copy and upload completed worksheets from your phone.",
  "Review individual feedback, spot class-wide patterns, and invite parents to follow along.",
];

const parentPoints = [
  "See your child’s feedback and progress across all five criteria.",
  "Upload take-home practice assigned by their teacher.",
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const role = user.user_metadata?.role as string | undefined;
    if (role === "parent") {
      redirect("/progress");
    }
    redirect("/dashboard");
  }

  return (
    <div className={styles.landing}>
      <div hidden dangerouslySetInnerHTML={{ __html: CONTRACT }} />
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" aria-label="WriteWise home" className={styles.logoLink}>
            <BrandLogo size="md" priority />
          </Link>
          <nav className={styles.nav} aria-label="Page sections">
            <a href="#how-it-works">How it works</a>
            <a href="#criteria">Criteria</a>
            <a href="#for-you">Teachers &amp; parents</a>
          </nav>
          <div className={styles.headerActions}>
            <Link href="/login" className={styles.textLink}>
              Sign in
            </Link>
            <Link href="/signup" className={`${styles.cta} ${styles.ctaSmall}`}>
              <span className={styles.ctaDesktopText}>Create an account</span>
              <span className={styles.ctaMobileText}>Sign up</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* ------------------------------ Hero ------------------------------ */}
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={styles.heroTop}>
            <h1 id="hero-heading" className={styles.heroTitle}>
              <span className={styles.heroLine}>Practice on paper.</span>
              <span className={styles.heroLine}>
                Growth you can <span className={styles.heroCursive}>see.</span>
              </span>
            </h1>
            <p className={styles.heroLede}>
              Automatic assessment of teacher-assigned cursive worksheets. Five criteria, calibrated
              scores, and encouraging next steps. Students stay on paper.
            </p>
          </div>

          <GrowthStrip />

          <div className={styles.heroCta}>
            <div>
              <div className={styles.heroActions}>
                <Link href="/signup" className={styles.cta}>
                  Create an account
                  <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.ctaArrow}>
                    <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
                  </svg>
                </Link>
                <a href="#assessment-preview" className={styles.ctaSecondary}>
                  Try an example assessment
                  <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.ctaDownArrow}>
                    <path d="M10 4v11m-4.5-4.5L10 15l4.5-4.5" />
                  </svg>
                </a>
              </div>
              <p className={styles.heroNote}>
                Parents need a class code or teacher invite to see their child&rsquo;s work.
              </p>
            </div>
            <p className={styles.researchNote}>
              WriteWise is a thesis research project. Student participation requires separate paper
              consent. <a href="#privacy">Privacy &amp; research details</a>
            </p>
          </div>
        </section>

        {/* ---------------------------- Audiences --------------------------- */}
        <section id="for-you" className={styles.audiences} aria-labelledby="audiences-heading">
          <h2 id="audiences-heading" className={styles.sectionTitle}>
            For the two people beside every page.
          </h2>
          <div className={styles.audienceGrid}>
            <div className={styles.audience}>
              <h3 className={styles.audienceTitle}>Teachers</h3>
              <p className={styles.audienceLede}>Know what each learner needs next.</p>
              <ul className={styles.audienceList}>
                {teacherPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Link href="/signup" className={styles.inlineCta}>
                Create a teacher account
                <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.ctaArrow}>
                  <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
                </svg>
              </Link>
            </div>
            <div className={styles.audience}>
              <h3 className={styles.audienceTitle}>Parents</h3>
              <p className={styles.audienceLede}>Know what to praise and practice at home.</p>
              <ul className={styles.audienceList}>
                {parentPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <div className={styles.audienceActionGroup}>
                <Link href="/signup?role=parent" className={styles.inlineCta}>
                  Create a parent account
                  <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.ctaArrow}>
                    <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
                  </svg>
                </Link>
                <p className={styles.audienceActionNote}>
                  Link with a class code or teacher invite during or after signup.
                </p>
              </div>
            </div>
          </div>
        </section>

        <AssessmentPreview />

        {/* ---------------------------- Workflow ---------------------------- */}
        <section id="how-it-works" className={styles.workflow} aria-labelledby="workflow-heading">
          <div className={styles.sectionIntro}>
            <h2 id="workflow-heading" className={styles.sectionTitle}>
              From a page of practice to a plan for progress.
            </h2>
            <p className={styles.sectionLede}>
              A teacher sets the words to copy. Students complete the activity on paper; a teacher
              or parent uploads the photo. No student accounts needed.
            </p>
          </div>

          <ol className={styles.steps}>
            {steps.map(({ id, title, body, Art }) => (
              <li key={id} className={styles.step}>
                <div className={styles.stepArtWrap}>
                  <Art />
                </div>
                <h3 className={styles.stepTitle}>{title}</h3>
                <p className={styles.stepBody}>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------------------- Criteria ---------------------------- */}
        <section id="criteria" className={styles.criteria} aria-labelledby="criteria-heading">
          <div className={styles.criteriaIntro}>
            <h2 id="criteria-heading" className={styles.sectionTitle}>
              Five criteria. Each with a next step.
            </h2>
            <div>
              <p className={styles.sectionLede}>
                Each criterion pairs a developmental band with one thing to practice.
              </p>
              <ul className={styles.bandLegend} aria-label="Developmental bands">
                {bands.map((b) => (
                  <li key={b.key} className={styles.band} data-band={b.key}>
                    <span className={styles.bandDot} aria-hidden="true" />
                    {b.label}
                  </li>
                ))}
              </ul>
              <p className={styles.bandNote}>
                Bands describe a stage of development. There is no pass or fail.
              </p>
            </div>
          </div>

          <details className={styles.criteriaDetails}>
            <summary>Explore all five criteria and sample notes</summary>
            <ul className={styles.ledger}>
              {criteria.map(({ id, name, body, note, Specimen }) => (
                <li key={id} className={styles.ledgerRow}>
                  <div className={styles.ledgerSpecimen}>
                    <Specimen />
                  </div>
                  <div className={styles.ledgerText}>
                    <h3 className={styles.ledgerName}>{name}</h3>
                    <p className={styles.ledgerBody}>{body}</p>
                  </div>
                  <p className={styles.ledgerNote}>
                    <span className={styles.ledgerNoteLabel}>Sample note</span>
                    {note}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        </section>

        {/* ------------------------------ Close ----------------------------- */}
        <section className={styles.close} aria-labelledby="close-heading">
          <div className={styles.closeInner}>
            <div>
              <h2 id="close-heading" className={styles.closeTitle}>
                Start with one worksheet.
              </h2>
              <p className={styles.closeLede}>
                Create a class to guide handwriting practice, or follow your child&rsquo;s progress
                with their teacher.
              </p>
              <div className={styles.closeActions}>
                <Link href="/signup" className={styles.ctaLight}>
                  Create a teacher account
                  <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.ctaArrow}>
                    <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
                  </svg>
                </Link>
                <Link href="/signup?role=parent" className={styles.ctaOutlineLight}>
                  Create a parent account
                  <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.ctaArrow}>
                    <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
                  </svg>
                </Link>
                <Link href="/login" className={styles.closeLink}>
                  Already have an account? Sign in
                </Link>
              </div>
              <p className={styles.closeNote}>
                Have an invite or class link from your teacher? Link your student during or after
                parent signup.
              </p>
            </div>
            <svg className={styles.closeLine} viewBox="0 0 440 150" aria-hidden="true">
              <line x1="0" x2="440" y1="34" y2="34" />
              <line x1="0" x2="440" y1="74" y2="74" strokeDasharray="3 6" />
              <line x1="0" x2="440" y1="112" y2="112" className={styles.closeBase} />
              <text x="10" y="112" textLength="410" lengthAdjust="spacingAndGlyphs">
                one page at a time
              </text>
            </svg>
          </div>
        </section>

        <PrivacyDetails />
        <BackToTop />
      </main>

      <footer className={styles.footer}>
        <BrandLogo size="sm" />
        <p>
          WriteWise is an academic thesis research project. Student participation uses separate
          paper consent. Handwriting samples on this page are illustrative.
        </p>
        <nav aria-label="Account">
          <a href="#privacy">Privacy &amp; research</a>
          <Link href="/login">Sign in</Link>
          <Link href="/signup">Create an account</Link>
        </nav>
      </footer>
    </div>
  );
}

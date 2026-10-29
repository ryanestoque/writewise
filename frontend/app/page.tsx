import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { GrowthStrip } from "@/components/landing/growth-strip";
import { AssessmentPreview } from "@/components/landing/assessment-preview";
import { BackToTop } from "@/components/landing/back-to-top";
import { CriteriaDetails } from "@/components/landing/criteria-details";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingScrollEffects } from "@/components/landing/landing-scroll-effects";
import { AssessArt, ProgressArt, UploadArt } from "@/components/landing/landing-art";
import { createClient } from "@/lib/supabase/server";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "WriteWise | Cursive practice, turned into next steps",
  description:
    "WriteWise assesses photographed cursive worksheets across five criteria, writes encouraging next-step feedback, and tracks each learner’s progress for teachers and parents. Students stay on paper.",
};

const steps = [
  {
    id: "upload",
    title: "Snap the worksheet",
    body: "Photograph the completed activity page with any phone or tablet. Built-in photo checks catch blur or glare right away so you can retake on the spot.",
    Art: UploadArt,
  },
  {
    id: "assess",
    title: "Review five-part coaching",
    body: "Inspect handwriting guides across five criteria, paired with plain-language observations and a clear next step for practice.",
    Art: AssessArt,
  },
  {
    id: "progress",
    title: "Follow growth over time",
    body: "Compare results week to week across your class roster and share steady progress updates with parents.",
    Art: ProgressArt,
  },
];

const trustPillars = [
  {
    title: "Students stay on paper",
    body: "Learners write on physical ruled worksheets with a pencil—no student accounts, passwords, or screen time required.",
  },
  {
    title: "Automatic photo privacy",
    body: "Location coordinates (GPS), timestamps, and device metadata are automatically stripped from every worksheet photo upon upload.",
  },
  {
    title: "Role-scoped visibility",
    body: "Teachers see only the learners enrolled in their classes, and parents see only their linked children’s worksheets and progress.",
  },
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
    <div className={styles.landing} data-landing-root>
      <LandingScrollEffects />
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>

      <LandingHeader />

      <main id="main-content" tabIndex={-1}>
        {/* ------------------------------ Hero ------------------------------ */}
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy} data-reveal="hero-copy">
              <h1 id="hero-heading" className={styles.heroTitle} tabIndex={-1}>
                <span className={styles.heroLine}>Classroom to home,</span>
                <span className={styles.heroLine}>
                  <span className={styles.heroCursiveWrap}>
                    <span className={styles.heroCursive}>stroke by stroke.</span>
                    <svg
                      className={styles.heroFlourish}
                      viewBox="0 0 260 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 11 C 60 14, 120 7, 180 9 C 210 10, 240 7, 256 5"
                        className={styles.heroFlourishPath}
                      />
                    </svg>
                  </span>
                </span>
              </h1>
              <p className={styles.heroLede}>
                Snap a photo of any cursive worksheet for stroke-by-stroke feedback and progress
                tracking, while keeping kids on paper.
              </p>

              <div className={styles.heroActions}>
                <Link href="/signup" className={styles.cta}>
                  Create an account
                  <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.ctaArrow}>
                    <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
                  </svg>
                </Link>
                <Link href="/signup?role=parent" className={styles.ctaSecondary}>
                  I&rsquo;m a parent
                </Link>
              </div>

              <ul className={styles.heroHighlights} aria-label="Key capabilities">
                <li>
                  <strong>5 criteria</strong>
                  <span>Formation, size, spacing, slant &amp; baseline</span>
                </li>
                <li>
                  <strong>4 growth bands</strong>
                  <span>Supportive, step-by-step coaching</span>
                </li>
                <li>
                  <strong>Paper-only for kids</strong>
                  <span>For teachers &amp; parents, no student logins</span>
                </li>
              </ul>
            </div>

            <div className={styles.heroStudioWrap} data-reveal="hero-studio">
              <AssessmentPreview />
            </div>
          </div>
        </section>

        {/* ---------------------------- Workflow ---------------------------- */}
        <section id="how-it-works" className={styles.workflow} aria-labelledby="workflow-heading">
          <div className={styles.workflowInner}>
            <div className={styles.sectionHeader} data-reveal="fade-up">
              <div>
                <h2 id="workflow-heading" className={styles.sectionTitle}>
                  From paper to progress in three steps.
                </h2>
              </div>
              <p className={styles.sectionLede}>
                Teachers set the target words and students write on physical worksheets. WriteWise
                handles the stroke measurements, diagnostic overlays, and progress history.
              </p>
            </div>

            <ol className={styles.steps}>
              {steps.map(({ id, title, body, Art }, i) => (
                <li
                  key={id}
                  className={styles.stepCard}
                  data-reveal="step-card"
                  data-index={i}
                >
                  <div className={styles.stepArtWrap}>
                    <Art />
                  </div>
                  <h3 className={styles.stepTitle}>{title}</h3>
                  <p className={styles.stepBody}>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------- Criteria ---------------------------- */}
        <CriteriaDetails />

        {/* ---------------------------- Progress ---------------------------- */}
        <section id="progress" className={styles.progressSection} aria-labelledby="progress-heading">
          <div className={styles.sectionHeader} data-reveal="fade-up">
            <div>
              <h2 id="progress-heading" className={styles.sectionTitle}>
                Watch rhythm and spacing steady week by week.
              </h2>
            </div>
            <p className={styles.sectionLede}>
              Select a practice week below to see how word spacing and coaching notes evolve as a
              learner practices the same phrase across multiple activities.
            </p>
          </div>

          <div data-reveal="growth-card">
            <GrowthStrip />
          </div>
        </section>

        {/* ------------------------------ Close ----------------------------- */}
        <section id="for-you" className={styles.close} aria-labelledby="close-heading">
          <div className={styles.closeInner}>
            <div className={styles.closeHeader} data-reveal="fade-up">
              <h2 id="close-heading" className={styles.closeTitle}>
                Start with one worksheet.
              </h2>
            </div>

            <div className={styles.signupGrid}>
              <div className={styles.signupRole} data-reveal="signup-card" data-index="0">
                <h3>For teachers</h3>
                <p>
                  Create word and sentence activities, assess uploaded worksheets in seconds, spot
                  class-wide trends, and invite parents to follow along.
                </p>
                <Link href="/signup" className={styles.ctaLight}>
                  Create a teacher account
                  <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.ctaArrow}>
                    <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
                  </svg>
                </Link>
              </div>
              <div className={styles.signupRole} data-reveal="signup-card" data-index="1">
                <h3>For parents</h3>
                <p>
                  Follow your child&rsquo;s handwriting milestones, read encouraging coaching tips,
                  and upload take-home practice worksheets from your phone.
                </p>
                <Link href="/signup?role=parent" className={styles.ctaOutlineLight}>
                  Create a parent account
                  <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.ctaArrow}>
                    <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
                  </svg>
                </Link>
                <p className={styles.closeNote}>
                  Link your child with a teacher invite during or after signup.
                </p>
              </div>
            </div>

            <div className={styles.trustStrip} aria-label="Privacy and safety">
              {trustPillars.map((pillar, i) => (
                <div
                  key={pillar.title}
                  className={styles.trustItem}
                  data-reveal="trust-item"
                  data-index={i}
                >
                  <h4>{pillar.title}</h4>
                  <p>{pillar.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <BackToTop />
      </main>

      <footer className={styles.footer}>
        {/* Signature Penmanship Ruled Guides */}
        <div className={styles.footerGuides} aria-hidden="true">
          <span className={styles.footerGuideTop} />
          <span className={styles.footerGuideMid} />
          <span className={styles.footerGuideBase} />
        </div>

        <div className={styles.footerInner}>
          <div className={styles.footerMain}>
            {/* Brand & Purpose Column */}
            <div className={styles.footerBrandCol}>
              <Link href="/" aria-label="WriteWise home" className={styles.footerLogoLink}>
                <BrandLogo size="md" />
              </Link>
              <p className={styles.footerBio}>
                A Computer Vision and CNN-Based Diagnostic Cursive Handwriting Assessment and
                Progress Monitoring System for Basic Education Teachers and Parents
              </p>
            </div>

            {/* Platform Column */}
            <div className={styles.footerCol}>
              <h3 className={styles.footerColTitle}>Platform</h3>
              <ul className={styles.footerLinkList}>
                <li>
                  <a href="#how-it-works">How it works</a>
                </li>
                <li>
                  <a href="#assessment-preview">Interactive studio</a>
                </li>
                <li>
                  <a href="#criteria">Developmental spectrum</a>
                </li>
                <li>
                  <a href="#progress">Weekly progress strip</a>
                </li>
              </ul>
            </div>
          </div>

          {/* Baseline Bar */}
          <div className={styles.footerBottom}>
            <p className={styles.footerCopy}>
              &copy; {new Date().getFullYear()} WriteWise (80-4).
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

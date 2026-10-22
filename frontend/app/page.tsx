import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownIcon, ArrowRightIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LandingFaq } from "@/components/landing/landing-faq";
import { WorksheetDemo } from "@/components/landing/worksheet-demo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "WriteWise | See the progress in every pen stroke",
  description:
    "Turn cursive handwriting worksheets into clear, encouraging feedback. Assess five handwriting criteria and follow each learner’s progress with WriteWise.",
};

interface CriterionItem {
  id: string;
  name: string;
  description: string;
  sample: string;
}

const criteria: CriterionItem[] = [
  {
    id: "formation",
    name: "Letter formation",
    description: "How letters take shape and join together.",
    sample: "abc",
  },
  {
    id: "size",
    name: "Size consistency",
    description: "How evenly letters keep their height and proportions.",
    sample: "aaa",
  },
  {
    id: "spacing",
    name: "Spacing",
    description: "The gaps between letters and words.",
    sample: "a  b  c",
  },
  {
    id: "slant",
    name: "Slant",
    description: "How consistently letters lean in the same direction.",
    sample: "lll",
  },
  {
    id: "baseline",
    name: "Baseline alignment",
    description: "How steadily letters rest on the writing line.",
    sample: "abc",
  },
];

interface ProcessStep {
  step: string;
  title: string;
  description: string;
}

const steps: ProcessStep[] = [
  {
    step: "01",
    title: "Create an activity",
    description:
      "Choose the text for learners to copy. Use paper with three printed penmanship guides: top, middle, and baseline.",
  },
  {
    step: "02",
    title: "Photograph the worksheet",
    description:
      "Upload a clear photo from your phone or tablet. WriteWise checks the image quality before assessing the handwriting.",
  },
  {
    step: "03",
    title: "Review the feedback",
    description:
      "Explore measurements and visual feedback across five criteria. Teachers use these observations to guide the next practice.",
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
    <div className={styles.landing}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>

      {/* Top Navigation */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" aria-label="WriteWise home" className={styles.logoLink}>
            <BrandLogo size="md" priority />
          </Link>

          <nav className={styles.navigation} aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#criteria">Criteria</a>
            <a href="#for-you">For teachers &amp; parents</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className={styles.headerActions}>
            <Link href="/login" className={styles.signIn}>
              Sign in
            </Link>
            <Button
              render={<Link href="/signup" />}
              nativeButton={false}
              size="lg"
              className={styles.headerSignup}
            >
              Create an account <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <nav className={styles.mobileNavigation} aria-label="Page sections">
          <a href="#how-it-works">How it works</a>
          <a href="#for-you">For you</a>
          <a href="#faq">FAQ</a>
          <a href="#privacy">Privacy &amp; help</a>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* Hero Section */}
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={styles.heroCopy}>
            <h1 id="hero-heading">
              See the progress in every <span className={styles.heroCursive}>pen stroke.</span>
            </h1>
            <p className={styles.heroDescription}>
              Turn cursive handwriting worksheets into clear, encouraging feedback. Give teachers a
              closer look at what’s working and what to practice next.
            </p>
            <div className={styles.heroActions}>
              <Button
                render={<Link href="/signup" />}
                nativeButton={false}
                size="lg"
                className={styles.mainAction}
              >
                Create an account <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
              </Button>
              <a href="#example" className={styles.exampleLink}>
                Explore an example <ArrowDownIcon size={15} aria-hidden="true" />
              </a>
            </div>
            <p className={styles.heroNote}>
              Teachers can set up a class. Parents need a teacher invitation to view their child’s
              progress.
            </p>
          </div>

          <div className={styles.heroVisual}>
            <WorksheetDemo />
          </div>
        </section>

        {/* Process Section */}
        <section
          className={styles.processSection}
          id="how-it-works"
          aria-labelledby="process-heading"
        >
          <div className={styles.processIntro}>
            <h2 id="process-heading">From a page of practice to a plan for progress.</h2>
            <p>Learners practice on paper. Teachers and parents follow along in WriteWise.</p>
          </div>

          <ol className={styles.steps}>
            {steps.map((step) => (
              <li className={styles.stepCard} key={step.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {step.step}
                </span>
                <div>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDescription}>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Criteria Grid Section */}
        <section
          className={styles.criteriaSection}
          id="criteria"
          aria-labelledby="criteria-heading"
        >
          <div className={styles.sectionIntro}>
            <h2 id="criteria-heading">Five ways to understand their handwriting.</h2>
          </div>

          <ul className={styles.criteriaGrid}>
            {criteria.map((criterion) => (
              <li className={styles.criterionCard} key={criterion.id}>
                <span className={styles.specimenText} aria-hidden="true">
                  {criterion.sample}
                </span>
                <div className={styles.criterionContent}>
                  <h3>{criterion.name}</h3>
                  <p>{criterion.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Roles Section: Teachers & Parents */}
        <section className={styles.peopleSection} id="for-you" aria-labelledby="people-heading">
          <div className={styles.sectionIntro}>
            <h2 id="people-heading">The same progress. A shared understanding.</h2>
            <p>Connect the practice in the classroom with the encouragement at home.</p>
          </div>

          <div className={styles.peopleGrid}>
            {/* Teacher Card */}
            <div className={styles.roleCard}>
              <div className={styles.roleCardHeader}>
                <span className={styles.roleBadge}>For Teachers</span>
                <h3>A clearer view across your classroom.</h3>
              </div>
              <p>
                Bring your roster, activities, and worksheet reviews together. See where a learner
                needs support and how your class is developing over time.
              </p>
              <ul className={styles.roleFeatures}>
                <li>Five handwriting criteria with measurements and visual feedback</li>
                <li>Progress over time for each learner and your class</li>
                <li>Teacher invitations to keep parents involved</li>
              </ul>
            </div>

            {/* Parent Card */}
            <div className={styles.roleCard}>
              <div className={styles.roleCardHeader}>
                <span className={styles.roleBadge}>For Parents</span>
                <h3>A supportive way to practice at home.</h3>
              </div>
              <p>
                See your child’s progress through feedback you can understand. Stay connected to
                their practice and celebrate the small steps along the way.
              </p>
              <ul className={styles.roleFeatures}>
                <li>Private access to your own child’s assessment history</li>
                <li>Encouraging notes about what to practice next</li>
                <li>Take-home worksheet photo uploads from your phone</li>
              </ul>
              <p className={styles.parentAccessNote}>
                Ask your child’s teacher for an invitation to link your account before viewing their
                progress.
              </p>
            </div>
          </div>

          {/* Child Safety & Privacy Banner */}
          <div className={styles.privacyBanner} id="privacy">
            <div className={styles.privacyContent}>
              <h3>Paper for learners. A clearer picture for adults.</h3>
              <p>
                Students don’t need an account or device. They stay focused on pencil and paper.
                Teachers review learners linked to their class. Parents can view only their own
                linked children’s worksheets, assessments, and progress after a teacher invitation.
              </p>
              <p>
                Worksheet photos and assessment history are stored to support review and progress
                tracking. Photo metadata, including location and device details, is removed before
                images are stored.
              </p>
              <h3>Questions about access or your child’s records?</h3>
              <p>
                Contact the teacher who set the activity for help with an invitation, linking your
                child, or questions about their worksheet records. Ask your teacher for paper with
                the three penmanship guides before photographing an activity.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className={styles.faqSection} id="faq" aria-labelledby="faq-heading">
          <div className={styles.faqIntro}>
            <h2 id="faq-heading">A few things you might be wondering.</h2>
            <p>A little clarity before you begin.</p>
          </div>
          <div className={styles.faqContainer}>
            <LandingFaq />
          </div>
        </section>

        {/* Closing CTA Section */}
        <section className={styles.closing} aria-labelledby="closing-heading">
          <div className={styles.closingInner}>
            <div className={styles.closingCopy}>
              <h2 id="closing-heading">Every little stroke is a step forward.</h2>
              <p>Help the next page of practice mean a little more for your learners.</p>
            </div>
            <Button
              render={<Link href="/signup" />}
              nativeButton={false}
              variant="secondary"
              size="lg"
              className={styles.closingButton}
            >
              Create an account <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <BrandLogo size="sm" />
            <p className={styles.footerSlogan}>A little practice. A clearer path.</p>
          </div>
          <div className={styles.footerLinks}>
            <a href="#how-it-works">How it works</a>
            <a href="#criteria">Criteria</a>
            <a href="#for-you">For teachers &amp; parents</a>
            <a href="#faq">FAQ</a>
            <a href="#privacy">Privacy &amp; help</a>
            <Link href="/login" className={styles.footerPortalLink}>
              Sign in to your portal <ArrowRightIcon size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>WriteWise &mdash; Cursive Handwriting Assessment &amp; Progress Monitoring System.</p>
          <p>Paper for learners. Clarity for educators and families.</p>
        </div>
      </footer>
    </div>
  );
}

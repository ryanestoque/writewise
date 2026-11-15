import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import styles from "./legal-page.module.css";

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

type LegalPageProps = {
  title: string;
  introduction: string;
  summary: string;
  sections: LegalSection[];
};

export function LegalPage({ title, introduction, summary, sections }: LegalPageProps) {
  return (
    <div className={styles.page}>
      <a href="#legal-content" className={styles.skipLink}>
        Skip to content
      </a>
      <header className={styles.header}>
        <Link href="/" aria-label="WriteWise home" className={styles.logo}>
          <BrandLogo size="md" />
        </Link>
        <Link href="/" className={styles.homeLink}>
          Back to home
        </Link>
      </header>

      <main id="legal-content" className={styles.main}>
        <div className={styles.introduction}>
          <h1>{title}</h1>
          <p className={styles.lede}>{introduction}</p>
          <p className={styles.updated}>
            Last updated <time dateTime="2026-11-15">November 15, 2026</time>
          </p>
        </div>

        <div className={styles.readingLayout}>
          <aside className={styles.sidebar}>
            <nav aria-label="On this page" className={styles.contents}>
              <h2>On this page</h2>
              <ul>
                {sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>{section.title}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <p className={styles.contact}>
              Questions about {title === "Privacy Policy" ? "your privacy" : "these terms"}?
              <a href="mailto:info@writewise.tech">info@writewise.tech</a>
            </p>
          </aside>

          <article className={styles.article} aria-label={title}>
            <p className={styles.summary}>{summary}</p>
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className={styles.section}
                aria-labelledby={`${section.id}-title`}
              >
                <h2 id={`${section.id}-title`}>{section.title}</h2>
                {section.content}
              </section>
            ))}
          </article>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} WriteWise (80-4).</p>
        <nav aria-label="Legal">
          <Link href="/privacy" aria-current={title === "Privacy Policy" ? "page" : undefined}>
            Privacy Policy
          </Link>
          <Link href="/terms" aria-current={title === "Terms of Service" ? "page" : undefined}>
            Terms of Service
          </Link>
        </nav>
      </footer>
    </div>
  );
}

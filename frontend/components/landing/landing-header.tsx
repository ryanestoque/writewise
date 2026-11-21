"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import styles from "@/app/landing.module.css";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works", id: "how-it-works" },
  { href: "#criteria", label: "Five criteria", id: "criteria" },
  { href: "#progress", label: "Progress", id: "progress" },
];

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const isScrolled = scrollY > 16;
          setScrolled((prev) => (prev !== isScrolled ? isScrolled : prev));

          // Calculate reading progress (0 to 1) along the landing page without triggering React re-renders
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const progress = docHeight > 0 ? Math.min(Math.max(scrollY / docHeight, 0), 1) : 0;
          if (progressRef.current) {
            progressRef.current.style.transform = `scaleX(${progress})`;
          }

          // Track which section is in view
          const sectionIds = ["how-it-works", "criteria", "progress"];
          let current: string | null = null;
          for (const id of sectionIds) {
            const el = document.getElementById(id);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top <= 240 && rect.bottom >= 100) {
                current = id;
              }
            }
          }
          setActiveSection((prev) => (prev !== current ? current : prev));

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={styles.header} data-scrolled={scrolled}>
      {/* Subtle ink reading progress line along bottom edge of header */}
      <div
        ref={progressRef}
        className={styles.headerProgressBar}
        style={{ transform: "scaleX(0)" }}
        aria-hidden="true"
      />

      <div className={styles.headerInner}>
        <Link href="/" aria-label="WriteWise home" className={styles.logoLink}>
          <BrandLogo size="md" priority className="view-transition-brand-logo" />
        </Link>
        <nav className={styles.nav} aria-label="Page sections">
          {NAV_LINKS.map(({ href, label, id }) => (
            <a
              key={href}
              href={href}
              data-active={activeSection === id}
              className={styles.navLink}
            >
              {label}
            </a>
          ))}
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
  );
}


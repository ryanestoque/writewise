"use client";

import { useEffect, useState } from "react";
import styles from "@/app/landing.module.css";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Show when scrolled past roughly the hero section (600px)
      setVisible(window.scrollY > 600);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <button
      type="button"
      className={styles.backToTop}
      data-visible={visible}
      onClick={scrollToTop}
      aria-label="Back to top of page"
      tabIndex={visible ? 0 : -1}
    >
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className={styles.backToTopArrow}
      >
        <path d="M10 16V4m0 0l-5 5m5-5l5 5" />
      </svg>
      <span className={styles.backToTopText}>Top</span>
    </button>
  );
}

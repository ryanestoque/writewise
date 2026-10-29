"use client";

import { useEffect } from "react";

/**
 * High-performance viewport-driven scroll reveal controller for the WriteWise landing page.
 * Uses passive IntersectionObserver with zero layout shift and zero external dependencies.
 * Unconditionally respects prefers-reduced-motion: reduce.
 */
export function LandingScrollEffects() {
  useEffect(() => {
    const landingEl = document.querySelector<HTMLElement>("[data-landing-root]");
    if (!landingEl) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Signal CSS that JavaScript motion hooks are ready
    landingEl.setAttribute("data-scroll-ready", "true");

    const revealElements = Array.from(
      landingEl.querySelectorAll<HTMLElement>("[data-reveal]")
    );

    if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
      revealElements.forEach((el) => {
        el.setAttribute("data-revealed", "true");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            target.setAttribute("data-revealed", "true");
            observer.unobserve(target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -32px 0px",
      }
    );

    let rafId: number | null = null;
    const initiallyVisible: HTMLElement[] = [];

    revealElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      // If already in the opening viewport on load/reload, arm first and reveal on the next frame
      if (rect.top < window.innerHeight - 32 && rect.bottom > 0) {
        initiallyVisible.push(el);
      } else {
        observer.observe(el);
      }
    });

    if (initiallyVisible.length > 0) {
      rafId = window.requestAnimationFrame(() => {
        initiallyVisible.forEach((el) => {
          el.setAttribute("data-revealed", "true");
        });
      });
    }

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      observer.disconnect();
    };
  }, []);

  return null;
}


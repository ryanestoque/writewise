"use client";

import { useEffect, useState } from "react";

/**
 * Passive, rAF-throttled scroll threshold hook matching LandingHeader's optimization.
 * Only triggers a React state update when crossing the threshold — never per scroll frame.
 */
export function useScrolled(threshold = 16, enabled = true): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      const isScrolled = window.scrollY > threshold;
      setScrolled((prev) => (prev !== isScrolled ? isScrolled : prev));
    };

    const onScroll = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [threshold, enabled]);

  return enabled && scrolled;
}

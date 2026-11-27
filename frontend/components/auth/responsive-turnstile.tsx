"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import {
  Turnstile,
  type TurnstileInstance,
  type TurnstileProps,
} from "@marsidev/react-turnstile";
import { cn } from "@/lib/utils";

type TurnstileSize = "flexible" | "compact";
type TurnstileTheme = "light" | "dark";

export interface ResponsiveTurnstileProps extends TurnstileProps {
  turnstileRef?: React.Ref<TurnstileInstance | undefined>;
}

export const ResponsiveTurnstile = forwardRef<
  TurnstileInstance | undefined,
  ResponsiveTurnstileProps
>(function ResponsiveTurnstile(
  { className, options, turnstileRef, ...props },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [resolvedSize, setResolvedSize] = useState<TurnstileSize>(() => {
    if (typeof window === "undefined") return "flexible";
    return window.innerWidth < 380 ? "compact" : "flexible";
  });
  const [appTheme, setAppTheme] = useState<TurnstileTheme>(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const updateSize = (width: number) => {
      if (width <= 0) return;
      setResolvedSize(width < 300 ? "compact" : "flexible");
    };

    updateSize(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateSize(entry.contentRect.width);
      }
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const syncTheme = () => {
      setAppTheme(root.classList.contains("dark") ? "dark" : "light");
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const size = options?.size ?? resolvedSize;
  const theme =
    options?.theme && options.theme !== "auto" ? options.theme : appTheme;

  return (
    <div
      ref={containerRef}
      className={cn("my-1 flex w-full justify-center overflow-hidden", className)}
    >
      <Turnstile
        key={`${size}-${theme}`}
        {...props}
        options={{
          ...options,
          size,
          theme,
        }}
        ref={turnstileRef ?? ref}
      />
    </div>
  );
});

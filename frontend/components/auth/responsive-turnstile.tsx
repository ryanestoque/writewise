"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import {
  Turnstile,
  type TurnstileInstance,
  type TurnstileProps,
} from "@marsidev/react-turnstile";
import { cn } from "@/lib/utils";

const FLEXIBLE_MIN_WIDTH = 300;
const FLEXIBLE_HEIGHT = 65;

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
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [appTheme, setAppTheme] = useState<TurnstileTheme>(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const updateWidth = (width: number) => {
      if (width <= 0) return;
      setContainerWidth((prev) =>
        prev !== null && Math.abs(prev - width) < 0.5 ? prev : width
      );
    };

    updateWidth(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateWidth(entry.contentRect.width);
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

  const size = options?.size ?? "flexible";
  const theme =
    options?.theme && options.theme !== "auto" ? options.theme : appTheme;

  const needsScale =
    size === "flexible" &&
    containerWidth !== null &&
    containerWidth > 0 &&
    containerWidth < FLEXIBLE_MIN_WIDTH;
  const scale = needsScale ? containerWidth / FLEXIBLE_MIN_WIDTH : 1;

  return (
    <div
      ref={containerRef}
      style={
        needsScale
          ? { height: `${Math.ceil(FLEXIBLE_HEIGHT * scale)}px` }
          : undefined
      }
      className={cn("my-1 w-full overflow-hidden", className)}
    >
      <div
        className={needsScale ? undefined : "w-full"}
        style={
          needsScale
            ? {
                width: `${FLEXIBLE_MIN_WIDTH}px`,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }
            : undefined
        }
      >
        <Turnstile
          key={`${size}-${theme}`}
          className="w-full"
          {...props}
          options={{
            ...options,
            size,
            theme,
          }}
          ref={turnstileRef ?? ref}
        />
      </div>
    </div>
  );
});

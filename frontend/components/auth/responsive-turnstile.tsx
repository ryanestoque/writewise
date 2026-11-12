"use client";

import { forwardRef } from "react";
import {
  Turnstile,
  type TurnstileInstance,
  type TurnstileProps,
} from "@marsidev/react-turnstile";

export const ResponsiveTurnstile = forwardRef<
  TurnstileInstance | undefined,
  TurnstileProps
>(function ResponsiveTurnstile(props, ref) {
  return (
    <div className="my-2 flex justify-center">
      <Turnstile {...props} ref={ref} />
    </div>
  );
});

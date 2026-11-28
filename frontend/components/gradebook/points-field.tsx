"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function validPointsInput(value: string, allowZero = false, maximum = 9999.99) {
  return (
    /^\d+(?:\.\d{1,2})?$/.test(value) &&
    Number(value) >= (allowZero ? 0 : 0.01) &&
    Number(value) <= maximum
  );
}

export function PointsField({
  value,
  onChange,
  label = "Points possible (optional)",
  error,
  disabled,
  hint = "Leave blank for bands only. Use up to two decimal places, from 0.01 to 9,999.99.",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <Field data-invalid={Boolean(error) || undefined} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        placeholder="e.g., 20"
        className={cn("h-10 sm:h-9 tabular-nums font-semibold")}
      />
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : hint ? (
        <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>
      ) : null}
    </Field>
  );
}

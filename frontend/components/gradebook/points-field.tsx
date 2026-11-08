"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";

export function validPointsInput(value: string, allowZero = false, maximum = 9999.99) {
  return /^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) >= (allowZero ? 0 : 0.01) && Number(value) <= maximum;
}

export function PointsField({ value, onChange, label = "Points possible (optional)", error, disabled, hint }: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)}
        disabled={disabled} aria-invalid={!!error} aria-describedby={`${id}-hint`} placeholder="e.g., 20" />
      <p id={`${id}-hint`} className={error ? "text-sm text-destructive" : "text-xs text-muted-foreground"} role={error ? "alert" : undefined}>
        {error ?? hint ?? "Leave blank for assessment bands only. Use up to two decimal places, from 0.01 to 9,999.99."}
      </p>
    </Field>
  );
}

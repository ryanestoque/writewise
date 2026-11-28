"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Check } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface ParentProfileSettingsCardProps {
  initialFullName: string;
  email: string;
}

export function ParentProfileSettingsCard({
  initialFullName,
  email,
}: ParentProfileSettingsCardProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = fullName.trim() !== initialFullName.trim();

  const handleReset = () => {
    setFullName(initialFullName);
    setNameError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();

    if (!trimmedName) {
      setNameError("Full name is required.");
      document.getElementById("parent-full-name")?.focus();
      return;
    }
    setNameError(null);

    setIsSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Unable to retrieve authenticated session.");
      }

      // 1. Sync Supabase auth metadata
      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
        },
      });
      if (authUpdateError) throw authUpdateError;

      // 2. Update relational parent record in Postgres
      const { error: dbUpdateError } = await supabase
        .from("parent")
        .update({
          full_name: trimmedName,
        })
        .eq("id", user.id);

      if (dbUpdateError) throw dbUpdateError;

      toast.add({ type: "success", title: "Profile updated successfully." });
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update profile.";
      toast.add({ type: "error", title: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
      {/* Left Section Header */}
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Personal Information
        </h2>
      </div>

      {/* Right Form Card */}
      <div>
        <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-warm gap-0 pb-0 overflow-hidden ring-0">
          <form onSubmit={handleSave} noValidate aria-busy={isSaving}>
            <CardContent className="pt-6 pb-6">
              <FieldGroup className="gap-5">
                {/* Full Name */}
                <Field
                  data-invalid={nameError ? true : undefined}
                  data-disabled={isSaving || undefined}
                >
                  <FieldLabel
                    htmlFor="parent-full-name"
                    className="text-sm font-medium text-foreground"
                  >
                    Full name
                  </FieldLabel>
                  <Input
                    id="parent-full-name"
                    type="text"
                    autoComplete="name"
                    required
                    aria-required="true"
                    disabled={isSaving}
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (nameError && e.target.value.trim()) {
                        setNameError(null);
                      }
                    }}
                    placeholder="e.g. Maria Santos"
                    className="h-10 sm:h-9 text-base sm:text-sm rounded-lg transition-colors"
                    aria-invalid={nameError ? true : false}
                    aria-describedby={nameError ? "parent-name-error" : undefined}
                  />
                  {nameError ? (
                    <FieldError id="parent-name-error" aria-live="polite" className="text-xs font-medium">
                      {nameError}
                    </FieldError>
                  ) : null}
                </Field>

                {/* Email (Read-only) */}
                <Field data-disabled={isSaving || undefined}>
                  <FieldLabel
                    htmlFor="parent-email-display"
                    className="text-sm font-medium text-foreground"
                  >
                    Email address
                  </FieldLabel>
                  <Input
                    id="parent-email-display"
                    type="email"
                    autoComplete="email"
                    value={email}
                    readOnly
                    aria-readonly="true"
                    className="h-10 sm:h-9 text-base sm:text-sm rounded-lg bg-muted/60 text-muted-foreground cursor-default border-dashed select-all focus-visible:ring-1 focus-visible:ring-ring/40"
                    aria-describedby="parent-email-hint"
                  />
                  <FieldDescription id="parent-email-hint" className="text-xs">
                    Your email is your login identifier and cannot be changed here.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>

            <CardFooter className="flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-border bg-muted/20 px-6 py-3.5">
              {isDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleReset}
                  disabled={isSaving}
                  className="w-full sm:w-auto h-11 sm:h-9 text-xs sm:text-sm font-medium cursor-pointer"
                >
                  Discard
                </Button>
              )}
              <Button
                type="submit"
                disabled={!isDirty || isSaving}
                className="w-full sm:w-auto h-11 sm:h-9 px-4 sm:px-5 text-xs sm:text-sm font-medium shadow-warm-sm cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Spinner data-icon="inline-start" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check data-icon="inline-start" aria-hidden="true" />
                    Save changes
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

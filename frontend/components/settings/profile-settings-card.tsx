"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface ProfileSettingsCardProps {
  initialFullName: string;
  initialSchoolName: string;
  email: string;
}

export function ProfileSettingsCard({
  initialFullName,
  initialSchoolName,
  email,
}: ProfileSettingsCardProps) {
  const router = useRouter();
  const headingId = useId();
  const [fullName, setFullName] = useState(initialFullName);
  const [schoolName, setSchoolName] = useState(initialSchoolName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Derived state: calculate dirty status during render without extra effects
  const isDirty =
    fullName.trim() !== initialFullName.trim() ||
    schoolName.trim() !== initialSchoolName.trim();

  const handleReset = () => {
    setFullName(initialFullName);
    setSchoolName(initialSchoolName);
    setNameError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    const trimmedSchool = schoolName.trim();

    if (!trimmedName) {
      setNameError("Full name is required.");
      document.getElementById("full-name")?.focus();
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
          school_name: trimmedSchool || null,
        },
      });
      if (authUpdateError) throw authUpdateError;

      // 2. Update relational teacher record in Postgres
      const { error: dbUpdateError } = await supabase
        .from("teacher")
        .update({
          full_name: trimmedName,
          school_name: trimmedSchool || null,
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
    <section
      aria-labelledby={headingId}
      className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]"
    >
      {/* Left Section Header */}
      <div>
        <h2 id={headingId} className="font-heading text-lg font-semibold text-foreground">
          Personal Information
        </h2>
      </div>

      {/* Right Form Card */}
      <div>
        <Card className="gap-0 pb-0">
          <form onSubmit={handleSave} aria-busy={isSaving} className="flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle as="h3">Profile</CardTitle>
              <CardDescription>
                Update your display name and school shown across the teacher portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <FieldGroup className="gap-5">
                {/* Full Name */}
                <Field
                  data-invalid={nameError ? true : undefined}
                  data-disabled={isSaving || undefined}
                >
                  <FieldLabel
                    htmlFor="full-name"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Full Name
                  </FieldLabel>
                  <Input
                    id="full-name"
                    type="text"
                    autoComplete="name"
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
                    aria-describedby={nameError ? "name-error" : undefined}
                  />
                  {nameError ? (
                    <FieldError id="name-error" aria-live="polite" className="text-xs font-medium">
                      {nameError}
                    </FieldError>
                  ) : null}
                </Field>

                {/* School Name */}
                <Field data-disabled={isSaving || undefined}>
                  <FieldLabel
                    htmlFor="school-name"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    School / Institution
                  </FieldLabel>
                  <Input
                    id="school-name"
                    type="text"
                    autoComplete="organization"
                    disabled={isSaving}
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="e.g. Holy Cross of Davao College"
                    className="h-10 sm:h-9 text-base sm:text-sm rounded-lg transition-colors"
                    aria-describedby="school-name-hint"
                  />
                  <FieldDescription id="school-name-hint" className="text-xs">
                    Appears alongside your name in the portal sidebar and class reports.
                  </FieldDescription>
                </Field>

                {/* Email (Read-only) */}
                <Field className="pt-1" data-disabled={isSaving || undefined}>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel
                      htmlFor="email-display"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Email Address
                    </FieldLabel>
                    <Badge variant="secondary" className="text-[11px] font-medium text-muted-foreground">
                      Verified Login
                    </Badge>
                  </div>
                  <Input
                    id="email-display"
                    type="email"
                    autoComplete="email"
                    value={email}
                    readOnly
                    aria-readonly="true"
                    className="h-10 sm:h-9 text-base sm:text-sm rounded-lg bg-muted/60 text-muted-foreground cursor-default border-dashed select-all focus-visible:ring-1 focus-visible:ring-ring/40"
                    aria-describedby="email-display-hint"
                  />
                  <FieldDescription id="email-display-hint" className="text-xs">
                    Your email is your authenticated login identifier and cannot be
                    changed here. Contact an administrator if your email address has
                    changed.
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
                  className="w-full sm:w-auto h-10 sm:h-9 text-xs sm:text-sm font-medium"
                >
                  Discard
                </Button>
              )}
              <Button
                type="submit"
                disabled={!isDirty || isSaving}
                className="w-full sm:w-auto h-11 sm:h-9 px-4 sm:px-5 text-xs sm:text-sm font-medium shadow-warm-sm"
              >
                {isSaving ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check data-icon="inline-start" aria-hidden="true" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </section>
  );
}

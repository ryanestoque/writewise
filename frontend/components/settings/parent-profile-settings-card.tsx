"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { User, Lock, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

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

      toast.success("Profile updated successfully.");
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update profile.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
      {/* Left Section Header */}
      <div>
        <div className="flex items-start gap-3 md:flex-col md:gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <User className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Personal Information
            </h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Update your display name as it appears across your child&apos;s progress reports.
            </p>
          </div>
        </div>
      </div>

      {/* Right Form Card */}
      <div>
        <Card className="rounded-xl border border-border bg-card text-card-foreground shadow-warm gap-0 pb-0 overflow-hidden ring-0">
          <form onSubmit={handleSave} aria-busy={isSaving}>
            <CardContent className="flex flex-col gap-5 pt-6 pb-6">
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="parent-full-name"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Full Name
                </Label>
                <Input
                  id="parent-full-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (nameError && e.target.value.trim()) {
                      setNameError(null);
                    }
                  }}
                  placeholder="e.g. Maria Santos"
                  className={`h-10 sm:h-9 text-base sm:text-sm rounded-lg transition-colors ${
                    nameError
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }`}
                  aria-invalid={nameError ? true : false}
                  aria-describedby={nameError ? "parent-name-error" : undefined}
                />
                {nameError ? (
                  <p
                    id="parent-name-error"
                    role="alert"
                    aria-live="polite"
                    className="text-xs text-destructive font-medium mt-0.5"
                  >
                    {nameError}
                  </p>
                ) : null}
              </div>

              {/* Email (Read-only) */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="parent-email-display"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Email Address
                  </Label>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                    <Lock className="size-3" aria-hidden="true" /> Verified Login
                  </span>
                </div>
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
                <p id="parent-email-hint" className="text-xs text-muted-foreground">
                  Your email is your login identifier and cannot be changed here.
                </p>
              </div>
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
                className="w-full sm:w-auto h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] px-4 sm:px-5 text-xs sm:text-sm font-medium shadow-xs"
              >
                {isSaving ? (
                  <>
                    <Loader2 data-icon="inline-start" className="mr-1.5 size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check data-icon="inline-start" className="mr-1.5 size-4" aria-hidden="true" />
                    Save Changes
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

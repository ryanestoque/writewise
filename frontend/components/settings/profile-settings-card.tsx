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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { User, Lock, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

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
  const [fullName, setFullName] = useState(initialFullName);
  const [schoolName, setSchoolName] = useState(initialSchoolName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Derived state: calculate dirty status during render without extra effects
  const isDirty =
    fullName.trim() !== initialFullName.trim() ||
    schoolName.trim() !== initialSchoolName.trim();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    const trimmedSchool = schoolName.trim();

    if (!trimmedName) {
      setNameError("Full name is required.");
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
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-warm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <User className="size-5" />
          </div>
          <div>
            <CardTitle className="font-heading text-lg font-semibold">
              Personal Information
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Update your display name and school affiliation across your classroom.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleSave}>
        <CardContent className="flex flex-col gap-4 pt-2">
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="full-name"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Full Name
            </Label>
            <Input
              id="full-name"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (nameError && e.target.value.trim()) {
                  setNameError(null);
                }
              }}
              placeholder="e.g. Maria Santos"
              className={`h-10 rounded-xl transition-colors ${
                nameError
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }`}
              aria-invalid={nameError ? true : false}
              aria-describedby={nameError ? "name-error" : undefined}
            />
            {nameError ? (
              <p
                id="name-error"
                className="text-xs text-destructive font-medium mt-0.5"
              >
                {nameError}
              </p>
            ) : null}
          </div>

          {/* School Name */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="school-name"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              School / Institution
            </Label>
            <Input
              id="school-name"
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="e.g. Holy Cross of Davao College"
              className="h-10 rounded-xl transition-colors"
            />
            <p className="text-xs text-muted-foreground">
              Appears alongside your name in the portal sidebar and class reports.
            </p>
          </div>

          {/* Email (Read-only) */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="email-display"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Email Address
              </Label>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                <Lock className="size-3" /> Verified Login
              </span>
            </div>
            <Input
              id="email-display"
              type="email"
              value={email}
              disabled
              className="h-10 rounded-xl bg-muted/60 text-muted-foreground cursor-not-allowed border-dashed"
            />
            <p className="text-xs text-muted-foreground">
              Your email is your authenticated login identifier and cannot be
              changed here. Contact an administrator if your email address has
              changed.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end pt-4 border-t bg-muted/20 px-6 py-4 rounded-b-2xl">
          <Button
            type="submit"
            disabled={!isDirty || isSaving}
            className="h-10 rounded-xl px-5 font-medium transition-all"
          >
            {isSaving ? (
              <>
                <Loader2 data-icon="inline-start" className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check data-icon="inline-start" className="mr-2 size-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

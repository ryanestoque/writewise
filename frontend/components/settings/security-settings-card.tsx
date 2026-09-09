"use client";

import { useState } from "react";
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
import { KeyRound, Eye, EyeOff, Check, X, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SecuritySettingsCardProps {
  email: string;
}

export function SecuritySettingsCard({ email }: SecuritySettingsCardProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived validation criteria calculated during render
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const allCriteriaMet = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    currentPassword.trim().length > 0 &&
    allCriteriaMet &&
    passwordsMatch &&
    !isSubmitting;

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setCurrentPasswordError(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();

      // 1. Re-authenticate current credentials to verify teacher identity
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        setCurrentPasswordError("Current password is incorrect. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // 2. Apply the new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        if (updateError.message.toLowerCase().includes("different")) {
          throw new Error("New password must be different from your current password.");
        }
        throw updateError;
      }

      toast.success("Password updated successfully.");

      // Reset form states
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update password.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-warm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <div>
            <CardTitle className="font-heading text-lg font-semibold">
              Password & Security
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Update your password to keep your classroom account protected.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handlePasswordUpdate}>
        <CardContent className="flex flex-col gap-4 pt-2">
          {/* Current Password */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="current-password"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Current Password
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (currentPasswordError) {
                    setCurrentPasswordError(null);
                  }
                }}
                placeholder="Enter current password"
                className={`h-10 rounded-xl pr-10 transition-colors ${
                  currentPasswordError
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }`}
                aria-invalid={currentPasswordError ? true : false}
                aria-describedby={
                  currentPasswordError ? "current-password-error" : undefined
                }
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={showCurrent ? "Hide current password" : "Show current password"}
              >
                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {currentPasswordError ? (
              <p
                id="current-password-error"
                className="text-xs text-destructive font-medium mt-0.5"
              >
                {currentPasswordError}
              </p>
            ) : null}
          </div>

          {/* New Password */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="new-password"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              New Password
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="h-10 rounded-xl pr-10 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={showNew ? "Hide new password" : "Show new password"}
              >
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {/* Real-time criteria checklist */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground">
              <div
                className={`flex items-center gap-1.5 ${
                  hasMinLength
                    ? "text-emerald-600 dark:text-emerald-400 font-medium"
                    : ""
                }`}
              >
                {hasMinLength ? (
                  <Check className="size-3.5" />
                ) : (
                  <div className="size-1.5 rounded-full bg-muted-foreground/50 mx-1" />
                )}
                <span>At least 8 characters</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${
                  hasUppercase
                    ? "text-emerald-600 dark:text-emerald-400 font-medium"
                    : ""
                }`}
              >
                {hasUppercase ? (
                  <Check className="size-3.5" />
                ) : (
                  <div className="size-1.5 rounded-full bg-muted-foreground/50 mx-1" />
                )}
                <span>One uppercase letter (A–Z)</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${
                  hasLowercase
                    ? "text-emerald-600 dark:text-emerald-400 font-medium"
                    : ""
                }`}
              >
                {hasLowercase ? (
                  <Check className="size-3.5" />
                ) : (
                  <div className="size-1.5 rounded-full bg-muted-foreground/50 mx-1" />
                )}
                <span>One lowercase letter (a–z)</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${
                  hasNumber
                    ? "text-emerald-600 dark:text-emerald-400 font-medium"
                    : ""
                }`}
              >
                {hasNumber ? (
                  <Check className="size-3.5" />
                ) : (
                  <div className="size-1.5 rounded-full bg-muted-foreground/50 mx-1" />
                )}
                <span>One number (0–9)</span>
              </div>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="confirm-password"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="h-10 rounded-xl pr-10 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 ? (
              <p
                className={`text-xs font-medium flex items-center gap-1 mt-0.5 ${
                  passwordsMatch
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {passwordsMatch ? (
                  <>
                    <Check className="size-3.5" /> Passwords match
                  </>
                ) : (
                  <>
                    <X className="size-3.5" /> Passwords do not match
                  </>
                )}
              </p>
            ) : null}
          </div>
        </CardContent>

        <CardFooter className="flex justify-end pt-4 border-t bg-muted/20 px-6 py-4 rounded-b-2xl">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-10 rounded-xl px-5 font-medium transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 data-icon="inline-start" className="mr-2 size-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <ShieldCheck data-icon="inline-start" className="mr-2 size-4" />
                Update Password
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

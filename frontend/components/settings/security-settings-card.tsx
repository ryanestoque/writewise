"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  KeyRound,
  Eye,
  EyeOff,
  Check,
  X,
  ShieldCheck,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface SecuritySettingsCardProps {
  email: string;
}

function ForgotPasswordDialog({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setSendError(null);
      setIsSent(false);
    }
  }

  async function handleSendReset() {
    setIsSending(true);
    setSendError(null);

    try {
      const supabase = createClient();
      const redirectUrl = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        const status = (error as { status?: number }).status;
        const code = (error as { code?: string }).code;

        if (
          status === 429 ||
          code === "over_email_send_rate_limit" ||
          code === "rate_limit_exceeded"
        ) {
          setSendError(
            "Too many requests. Please wait a few moments before trying again."
          );
        } else {
          setSendError(error.message || "Failed to send reset email.");
        }
        setIsSending(false);
        return;
      }

      setIsSent(true);
      toast.success("Password reset link sent to your email.");
    } catch {
      setSendError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded py-0.5 px-1 -mr-1"
          >
            Forgot password?
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground font-heading">
            {isSent ? "Check Your Email" : "Reset Password"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {isSent
              ? "We've sent recovery instructions to your registered email address."
              : `We will send a password reset link to your verified email: ${email}`}
          </DialogDescription>
        </DialogHeader>

        {isSent ? (
          <div className="space-y-4 py-1">
            <Alert className="border-brand-200 bg-brand-50/70 text-brand-900 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300">
              <CheckCircle2 className="size-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
              <AlertDescription className="text-xs leading-relaxed">
                A recovery link has been sent to{" "}
                <span className="font-semibold">{email}</span>. Follow the instructions
                in your email to set a new password.
              </AlertDescription>
            </Alert>

            <DialogFooter showCloseButton={false} className="pt-2">
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    autoFocus
                    className="w-full sm:w-auto"
                  >
                    Done
                  </Button>
                }
              />
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {sendError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  {sendError}
                </AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-muted-foreground leading-relaxed">
              If you forgot your current password, this link allows you to securely
              set a new password without needing to enter your current credentials.
            </p>

            <DialogFooter showCloseButton={false} className="pt-2 flex gap-2 sm:justify-end">
              <DialogClose
                render={
                  <Button type="button" variant="outline" size="sm">
                    Cancel
                  </Button>
                }
              />
              <Button
                type="button"
                size="sm"
                onClick={handleSendReset}
                disabled={isSending}
                className="font-medium"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                    Sending Link...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
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
        document.getElementById("current-password")?.focus();
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
    <Card className="rounded-xl border bg-card text-card-foreground shadow-warm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="size-5" aria-hidden="true" />
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

      <form onSubmit={handlePasswordUpdate} aria-busy={isSubmitting}>
        <CardContent className="flex flex-col gap-4 pt-2">
          {/* Current Password */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="current-password"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Current Password
              </Label>
              <ForgotPasswordDialog email={email} />
            </div>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (currentPasswordError) {
                    setCurrentPasswordError(null);
                  }
                }}
                placeholder="Enter current password"
                className={`h-10 rounded-lg pr-12 transition-colors ${
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
                className="absolute right-0.5 top-1/2 -translate-y-1/2 flex min-h-[40px] min-w-[40px] size-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                aria-label={showCurrent ? "Hide current password" : "Show current password"}
              >
                {showCurrent ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {currentPasswordError ? (
              <p
                id="current-password-error"
                role="alert"
                aria-live="polite"
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
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="h-10 rounded-lg pr-12 transition-colors"
                aria-describedby="password-requirements"
                aria-invalid={newPassword.length > 0 && !allCriteriaMet}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 flex min-h-[40px] min-w-[40px] size-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                aria-label={showNew ? "Hide new password" : "Show new password"}
              >
                {showNew ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Real-time criteria checklist */}
            <ul
              id="password-requirements"
              aria-label="Password requirements"
              className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground list-none p-0 m-0"
            >
              <li
                className={`flex items-center gap-1.5 ${
                  hasMinLength
                    ? "text-brand-600 dark:text-brand-400 font-medium"
                    : ""
                }`}
              >
                {hasMinLength ? (
                  <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
                ) : (
                  <div className="size-1.5 rounded-full bg-muted-foreground/50 mx-1 shrink-0" aria-hidden="true" />
                )}
                <span>At least 8 characters</span>
                <span className="sr-only">
                  {hasMinLength ? "(requirement met)" : "(requirement not met)"}
                </span>
              </li>
              <li
                className={`flex items-center gap-1.5 ${
                  hasUppercase
                    ? "text-brand-600 dark:text-brand-400 font-medium"
                    : ""
                }`}
              >
                {hasUppercase ? (
                  <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
                ) : (
                  <div className="size-1.5 rounded-full bg-muted-foreground/50 mx-1 shrink-0" aria-hidden="true" />
                )}
                <span>One uppercase letter (A–Z)</span>
                <span className="sr-only">
                  {hasUppercase ? "(requirement met)" : "(requirement not met)"}
                </span>
              </li>
              <li
                className={`flex items-center gap-1.5 ${
                  hasLowercase
                    ? "text-brand-600 dark:text-brand-400 font-medium"
                    : ""
                }`}
              >
                {hasLowercase ? (
                  <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
                ) : (
                  <div className="size-1.5 rounded-full bg-muted-foreground/50 mx-1 shrink-0" aria-hidden="true" />
                )}
                <span>One lowercase letter (a–z)</span>
                <span className="sr-only">
                  {hasLowercase ? "(requirement met)" : "(requirement not met)"}
                </span>
              </li>
              <li
                className={`flex items-center gap-1.5 ${
                  hasNumber
                    ? "text-brand-600 dark:text-brand-400 font-medium"
                    : ""
                }`}
              >
                {hasNumber ? (
                  <Check className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
                ) : (
                  <div className="size-1.5 rounded-full bg-muted-foreground/50 mx-1 shrink-0" aria-hidden="true" />
                )}
                <span>One number (0–9)</span>
                <span className="sr-only">
                  {hasNumber ? "(requirement met)" : "(requirement not met)"}
                </span>
              </li>
            </ul>

            {/* Polite screen reader live status announcement */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {allCriteriaMet ? "All password requirements satisfied." : ""}
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
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="h-10 rounded-lg pr-12 transition-colors"
                aria-describedby={
                  confirmPassword.length > 0 ? "confirm-password-status" : undefined
                }
                aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 flex min-h-[40px] min-w-[40px] size-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirm ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {confirmPassword.length > 0 ? (
              <p
                id="confirm-password-status"
                role="status"
                aria-live="polite"
                className={`text-xs font-medium flex items-center gap-1 mt-0.5 ${
                  passwordsMatch
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-destructive"
                }`}
              >
                {passwordsMatch ? (
                  <>
                    <Check className="size-3.5" aria-hidden="true" /> Passwords match
                  </>
                ) : (
                  <>
                    <X className="size-3.5" aria-hidden="true" /> Passwords do not match
                  </>
                )}
              </p>
            ) : null}
          </div>
        </CardContent>

        <CardFooter className="flex justify-end pt-4 border-t bg-muted/20 px-6 py-4 rounded-b-xl">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="min-h-[40px] h-10 rounded-lg px-5 font-medium transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 data-icon="inline-start" className="mr-2 size-4 animate-spin" aria-hidden="true" />
                Updating...
              </>
            ) : (
              <>
                <ShieldCheck data-icon="inline-start" className="mr-2 size-4" aria-hidden="true" />
                Update Password
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

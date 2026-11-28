"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
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
  Eye,
  EyeOff,
  Check,
  X,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "@/components/ui/toast";

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
        redirectTo: redirectUrl });

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
      toast.add({ type: "success", title: "Password reset link sent to your email." });
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
          <Button
            type="button"
            variant="link"
            size="xs"
            className="relative h-auto py-1 px-1.5 -my-1 -mr-1.5 min-h-[40px] sm:min-h-0 touch-manipulation before:absolute before:-inset-2 before:content-[''] sm:before:hidden"
          >
            Forgot password?
          </Button>
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
          <div className="flex flex-col gap-4 py-1">
            <Alert role="status" aria-live="polite" variant="success">
              <CheckCircle2 aria-hidden="true" />
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
                    className="w-full sm:w-auto h-11 sm:h-9 px-4 cursor-pointer touch-manipulation"
                  >
                    Done
                  </Button>
                }
              />
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-1">
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-11 sm:h-9 px-4 cursor-pointer touch-manipulation"
                  >
                    Cancel
                  </Button>
                }
              />
              <Button
                type="button"
                size="sm"
                onClick={handleSendReset}
                disabled={isSending}
                className="font-medium h-11 sm:h-9 px-4 cursor-pointer touch-manipulation"
              >
                {isSending ? (
                  <>
                    <Spinner data-icon="inline-start" />
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
  const headingId = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived validation criteria calculated during render
  const hasMinLength = newPassword.length >= 10;
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

      // 1. Re-authenticate current credentials to verify user identity
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword });

      if (signInError) {
        const status = (signInError as { status?: number }).status;
        const code = (signInError as { code?: string }).code;
        if (
          status === 429 ||
          code === "over_request_rate_limit" ||
          code === "rate_limit_exceeded"
        ) {
          setCurrentPasswordError(
            "Too many sign-in attempts. Please wait a few moments before trying again."
          );
        } else {
          setCurrentPasswordError("Current password is incorrect. Please try again.");
        }
        document.getElementById("current-password")?.focus();
        setIsSubmitting(false);
        return;
      }

      // 2. Apply the new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword });

      if (updateError) {
        if (updateError.message.toLowerCase().includes("different")) {
          throw new Error("New password must be different from your current password.");
        }
        throw updateError;
      }

      toast.add({ type: "success", title: "Password updated successfully." });

      // Reset form states
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update password.";
      toast.add({ type: "error", title: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordCriteria = [
    { label: "At least 10 characters", met: hasMinLength },
    { label: "One uppercase letter (A–Z)", met: hasUppercase },
    { label: "One lowercase letter (a–z)", met: hasLowercase },
    { label: "One number (0–9)", met: hasNumber },
  ];

  return (
    <section
      aria-labelledby={headingId}
      className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]"
    >
      {/* Left Section Header */}
      <div>
        <h2 id={headingId} className="font-heading text-lg font-semibold text-foreground">
          Password & Security
        </h2>
      </div>

      {/* Right Form Card */}
      <div>
        <Card className="gap-0 pb-0">
          <form onSubmit={handlePasswordUpdate} noValidate aria-busy={isSubmitting} className="flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle as="h3">Password & Security</CardTitle>
              <CardDescription>
                Verify your current password before setting a new one.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <FieldGroup className="gap-5">
                {/* Current Password */}
                <Field
                  data-invalid={currentPasswordError ? true : undefined}
                  data-disabled={isSubmitting || undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel htmlFor="current-password">
                      Current password
                    </FieldLabel>
                    <ForgotPasswordDialog email={email} />
                  </div>
                  <InputGroup
                    className={cn(
                      "h-10 sm:h-9 rounded-lg border border-input bg-background",
                      currentPasswordError &&
                        "border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive has-[[data-slot=input-group-control]:focus-visible]:ring-destructive/30"
                    )}
                  >
                    <InputGroupInput
                      id="current-password"
                      type={showCurrent ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      aria-required="true"
                      disabled={isSubmitting}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        if (currentPasswordError) {
                          setCurrentPasswordError(null);
                        }
                      }}
                      placeholder="Enter current password"
                      className="h-full text-base sm:text-sm"
                      aria-invalid={currentPasswordError ? true : false}
                      aria-describedby={
                        currentPasswordError ? "current-password-error" : undefined
                      }
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="icon-sm"
                        disabled={isSubmitting}
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={showCurrent ? "Hide current password" : "Show current password"}
                      >
                        {showCurrent ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {currentPasswordError ? (
                    <FieldError id="current-password-error" aria-live="polite" className="text-xs font-medium">
                      {currentPasswordError}
                    </FieldError>
                  ) : null}
                </Field>

                {/* New Password */}
                <Field
                  data-invalid={newPassword.length > 0 && !allCriteriaMet ? true : undefined}
                  data-disabled={isSubmitting || undefined}
                >
                  <FieldLabel htmlFor="new-password">
                    New password
                  </FieldLabel>
                  <InputGroup className="h-10 sm:h-9 rounded-lg border border-input bg-background">
                    <InputGroupInput
                      id="new-password"
                      type={showNew ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      aria-required="true"
                      disabled={isSubmitting}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="h-full text-base sm:text-sm"
                      aria-describedby="new-password-hint"
                      aria-invalid={newPassword.length > 0 && !allCriteriaMet}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="icon-sm"
                        disabled={isSubmitting}
                        onClick={() => setShowNew(!showNew)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={showNew ? "Hide new password" : "Show new password"}
                      >
                        {showNew ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>

                  <FieldDescription id="new-password-hint" className="sr-only">
                    Password must be at least 10 characters and include uppercase, lowercase, and a number.
                  </FieldDescription>

                  {/* Real-time criteria checklist */}
                  <ul
                    id="password-requirements"
                    aria-label="Password requirements"
                    className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground list-none p-0 m-0"
                  >
                    {passwordCriteria.map((criterion) => (
                      <li
                        key={criterion.label}
                        className={cn(
                          "flex items-center gap-1.5",
                          criterion.met && "text-primary font-medium"
                        )}
                      >
                        {criterion.met ? (
                          <Check className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                        ) : (
                          <div
                            className="size-2 rounded-full border border-muted-foreground/70 mx-0.5 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <span>{criterion.label}</span>
                        <span className="sr-only">
                          {criterion.met ? "(requirement met)" : "(requirement not met)"}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Polite screen reader live status announcement */}
                  <div className="sr-only" aria-live="polite" aria-atomic="true">
                    {allCriteriaMet ? "All password requirements satisfied." : ""}
                  </div>
                </Field>

                {/* Confirm New Password */}
                <Field
                  data-invalid={confirmPassword.length > 0 && !passwordsMatch ? true : undefined}
                  data-disabled={isSubmitting || undefined}
                >
                  <FieldLabel htmlFor="confirm-password">
                    Confirm new password
                  </FieldLabel>
                  <InputGroup className="h-10 sm:h-9 rounded-lg border border-input bg-background">
                    <InputGroupInput
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      aria-required="true"
                      disabled={isSubmitting}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="h-full text-base sm:text-sm"
                      aria-describedby={
                        confirmPassword.length > 0 ? "confirm-password-status" : undefined
                      }
                      aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="icon-sm"
                        disabled={isSubmitting}
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirm ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {confirmPassword.length > 0 ? (
                    passwordsMatch ? (
                      <FieldDescription
                        id="confirm-password-status"
                        role="status"
                        aria-live="polite"
                        className="text-xs font-medium text-primary flex items-center gap-1"
                      >
                        <Check className="size-3.5" aria-hidden="true" /> Passwords match
                      </FieldDescription>
                    ) : (
                      <FieldError
                        id="confirm-password-status"
                        aria-live="polite"
                        className="text-xs font-medium flex items-center gap-1"
                      >
                        <X className="size-3.5" aria-hidden="true" /> Passwords do not match
                      </FieldError>
                    )
                  ) : null}
                </Field>
              </FieldGroup>
            </CardContent>

            <CardFooter className="flex justify-end border-t border-border bg-muted/20 px-6 py-3.5">
              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full sm:w-auto h-11 sm:h-9 px-4 sm:px-5 text-xs sm:text-sm font-medium shadow-warm-sm cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Updating...
                  </>
                ) : (
                  <>
                    <ShieldCheck data-icon="inline-start" aria-hidden="true" />
                    Update password
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

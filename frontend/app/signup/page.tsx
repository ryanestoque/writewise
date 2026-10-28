"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { BrandLogo } from "@/components/brand-logo";
import { HandwritingGuidelineBackground } from "@/components/auth/handwriting-guideline-background";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import {
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  MailIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  CheckIcon,
} from "lucide-react";

type UserRole = "teacher" | "parent";

function SignUpForm() {
  const searchParams = useSearchParams();
  const [role, setRole] = useState<UserRole>(() =>
    searchParams.get("role") === "parent" ? "parent" : "teacher"
  );
  const [fullName, setFullName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Success state (confirmation email sent)
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Cooldown countdown effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const hasMinLength = password.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/auth/callback?next=/login`;
      const trimmedSchool = schoolName.trim();
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            role,
            full_name: fullName.trim(),
            ...(role === "teacher" && trimmedSchool
              ? { school_name: trimmedSchool }
              : {}),
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (signUpError) {
        const status = (signUpError as { status?: number }).status;
        const code = (signUpError as { code?: string }).code;

        if (code === "weak_password") {
          setFormError(
            "Choose a stronger password — this one is too short or has appeared in a data breach."
          );
        } else if (
          status === 429 ||
          code === "over_email_send_rate_limit" ||
          code === "rate_limit_exceeded"
        ) {
          setFormError("Too many attempts. Please wait a minute and try again.");
        } else if (code === "email_address_invalid") {
          setFormError("Enter a valid email address.");
        } else if (code === "signup_disabled") {
          setFormError("Sign-ups are currently closed.");
        } else {
          setFormError("Something went wrong. Please try again.");
        }
        setIsLoading(false);
        return;
      }

      setSubmittedEmail(email.trim());
      setIsSuccess(true);
      setResendCooldown(60);
      setIsLoading(false);
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  async function handleResendEmail() {
    if (!submittedEmail || resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setResendMessage(null);

    try {
      const redirectUrl = `${window.location.origin}/auth/callback?next=/login`;
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: submittedEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (resendError) {
        const status = (resendError as { status?: number }).status;
        const code = (resendError as { code?: string }).code;
        if (
          status === 429 ||
          code === "over_email_send_rate_limit" ||
          code === "rate_limit_exceeded"
        ) {
          setResendMessage("Rate limit exceeded. Please wait a moment before trying again.");
        } else {
          setResendMessage("Failed to resend confirmation email. Please try again.");
        }
      } else {
        setResendCooldown(60);
        setResendMessage("A new confirmation email has been sent. Please check your inbox.");
      }
    } catch {
      setResendMessage("Failed to resend email. Please try again later.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-warm backdrop-blur-xs transition-all duration-200">
      <CardHeader className="space-y-1.5 text-center pb-2 pt-6">
        <div className="flex justify-center -my-1">
          <BrandLogo size="xl" priority />
        </div>
        <h1 className="sr-only">Create a WriteWise account</h1>
      </CardHeader>

      <CardContent className="space-y-4">
        {isSuccess ? (
          <div className="space-y-4 py-2 text-center animate-in fade-in-50 duration-200">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-4 ring-brand-100/70 dark:bg-brand-950/60 dark:text-brand-400 dark:ring-brand-900/50">
              <MailIcon className="size-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground font-heading">
                Check your email
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We sent a confirmation link to{" "}
                <span className="font-semibold text-foreground">{submittedEmail}</span>.
              </p>
            </div>

            <Alert className="border-brand-200 bg-brand-50/70 text-brand-900 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300 text-left">
              <CheckCircle2Icon className="size-4 text-brand-600 dark:text-brand-400" />
              <AlertDescription className="text-xs leading-relaxed">
                Please click the link in your email to verify your account. Once verified, you can sign in to WriteWise.
              </AlertDescription>
            </Alert>

            {resendMessage && (
              <p className="text-xs text-muted-foreground animate-in fade-in-50">
                {resendMessage}
              </p>
            )}

            <div className="space-y-2 pt-1">
              <Button
                id="signup-resend"
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                disabled={resendCooldown > 0 || isResending}
                onClick={handleResendEmail}
              >
                {isResending ? (
                  <>
                    <Spinner className="mr-2 size-3.5" />
                    Sending email…
                  </>
                ) : resendCooldown > 0 ? (
                  `Resend email in ${resendCooldown}s`
                ) : (
                  "Resend confirmation email"
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setIsSuccess(false);
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded py-1"
              >
                Entered the wrong email? Use a different email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4" noValidate={false}>
            {formError && (
              <Alert
                variant="destructive"
                id="signup-error"
                className="[&>svg]:translate-y-0 animate-in fade-in-50 slide-in-from-top-1 duration-200 motion-reduce:animate-none motion-reduce:transition-none"
              >
                <CircleAlertIcon aria-hidden="true" />
                <AlertDescription className="text-xs leading-normal">
                  {formError}
                </AlertDescription>
              </Alert>
            )}

            {/* Role selector pill */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                I am registering as a
              </Label>
              <div
                role="radiogroup"
                aria-label="Account role"
                className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1 border border-border/60"
              >
                <button
                  type="button"
                  id="signup-role-teacher"
                  role="radio"
                  aria-checked={role === "teacher"}
                  onClick={() => setRole("teacher")}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    role === "teacher"
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <GraduationCapIcon className="size-3.5 shrink-0" />
                  Teacher
                </button>
                <button
                  type="button"
                  id="signup-role-parent"
                  role="radio"
                  aria-checked={role === "parent"}
                  onClick={() => setRole("parent")}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    role === "parent"
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <HeartHandshakeIcon className="size-3.5 shrink-0" />
                  Parent
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-normal px-0.5">
                {role === "teacher"
                  ? "Manage your class roster and assess cursive handwriting."
                  : "Your child's teacher will link your account to their student records."}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fullName" className="text-xs font-semibold text-foreground">
                Full name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder={role === "teacher" ? "Maria Santos" : "Juan dela Cruz"}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                disabled={isLoading}
                className="h-10 text-sm"
              />
            </div>

            {role === "teacher" && (
              <div className="grid gap-2 animate-in fade-in-50 duration-150">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="schoolName"
                    className="text-xs font-semibold text-foreground"
                  >
                    School / Institution
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Optional
                  </span>
                </div>
                <Input
                  id="schoolName"
                  type="text"
                  placeholder="e.g. Holy Cross of Davao College"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  autoComplete="organization"
                  disabled={isLoading}
                  className="h-10 text-sm"
                />
                <p className="text-[11px] text-muted-foreground leading-normal px-0.5">
                  Appears in your class rosters and portal sidebar.
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                disabled={isLoading}
                aria-invalid={!!formError}
                aria-describedby={formError ? "signup-error" : undefined}
                className="h-10 text-sm"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                  Password
                </Label>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] transition-colors ${
                    hasMinLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"
                  }`}
                >
                  {hasMinLength ? (
                    <CheckIcon className="size-3" aria-hidden="true" />
                  ) : null}
                  At least 10 characters
                </span>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  enterKeyHint="next"
                  disabled={isLoading}
                  className="h-10 pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute right-1 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-md p-1.5 transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none"
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="confirmPassword" className="text-xs font-semibold text-foreground">
                  Confirm password
                </Label>
                {confirmPassword && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] ${
                      passwordsMatch ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {passwordsMatch ? "Passwords match" : "Does not match"}
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  enterKeyHint="go"
                  disabled={isLoading}
                  className="h-10 pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  disabled={isLoading}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute right-1 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-md p-1.5 transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none"
                >
                  {showConfirmPassword ? (
                    <EyeOffIcon className="size-4" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <Button
              id="signup-submit"
              type="submit"
              size="lg"
              className="mt-1 h-10 w-full font-medium transition-all duration-150"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRightIcon className="ml-2 size-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="flex flex-col items-center justify-center border-t border-border/60 bg-muted/20 px-6 py-3.5 text-center text-xs text-muted-foreground">
        <p>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function SignUpPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-8 antialiased">
      <HandwritingGuidelineBackground />
      <Suspense fallback={<Spinner className="size-8 text-primary" />}>
        <SignUpForm />
      </Suspense>
    </main>
  );
}

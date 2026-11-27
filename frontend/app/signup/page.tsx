"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { BrandIcon } from "@/components/brand-logo";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResponsiveTurnstile } from "@/components/auth/responsive-turnstile";
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
  ExternalLinkIcon,
  ShieldCheckIcon,
} from "lucide-react";

type UserRole = "teacher" | "parent";
type ValidatableField = "fullName" | "email" | "password";
type ErrorField = ValidatableField | "captcha";
type FieldErrors = Partial<Record<ErrorField, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateFieldValue(
  field: ValidatableField,
  values: { fullName: string; email: string; password: string }
): string | undefined {
  if (field === "fullName") {
    return values.fullName.trim() ? undefined : "Enter your full name.";
  }
  if (field === "email") {
    return EMAIL_REGEX.test(values.email.trim())
      ? undefined
      : "Enter a valid email address.";
  }
  return values.password.length >= MIN_PASSWORD_LENGTH
    ? undefined
    : `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
}

function SignUpForm() {
  const searchParams = useSearchParams();
  const [role, setRole] = useState<UserRole>(() =>
    searchParams.get("role") === "parent" ? "parent" : "teacher"
  );
  const [fullName, setFullName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touchedFields, setTouchedFields] = useState<
    Partial<Record<ValidatableField, boolean>>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileInstance>(undefined);
  const resendCaptchaRef = useRef<TurnstileInstance>(undefined);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;

  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const errorAlertRef = useRef<HTMLDivElement>(null);
  const successContainerRef = useRef<HTMLDivElement>(null);

  // Success state (confirmation email sent)
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendIsError, setResendIsError] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // Cooldown countdown effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  useEffect(() => {
    if (isSuccess) {
      requestAnimationFrame(() => successContainerRef.current?.focus());
    }
  }, [isSuccess]);

  const hasMinLength = password.length >= MIN_PASSWORD_LENGTH;

  function updateFieldErrorOnChange(
    field: ValidatableField,
    nextValues: { fullName: string; email: string; password: string }
  ) {
    if (!fieldErrors[field] && !touchedFields[field]) return;
    const nextError = validateFieldValue(field, nextValues);
    setFieldErrors((prev) => {
      if (prev[field] === nextError) return prev;
      const updated = { ...prev };
      if (nextError) {
        updated[field] = nextError;
      } else {
        delete updated[field];
      }
      return updated;
    });
  }

  function handleFieldBlur(field: ValidatableField) {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
    const err = validateFieldValue(field, { fullName, email, password });
    setFieldErrors((prev) => {
      const updated = { ...prev };
      if (err) {
        updated[field] = err;
      } else {
        delete updated[field];
      }
      return updated;
    });
  }

  function focusFirstInvalidField(errors: FieldErrors) {
    if (errors.fullName) {
      requestAnimationFrame(() => fullNameInputRef.current?.focus());
    } else if (errors.email) {
      requestAnimationFrame(() => emailInputRef.current?.focus());
    } else if (errors.password) {
      requestAnimationFrame(() => passwordInputRef.current?.focus());
    } else if (errors.captcha) {
      requestAnimationFrame(() => errorAlertRef.current?.focus());
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isLoading) return;
    setFormError(null);

    const nextErrors: FieldErrors = {};
    const values = { fullName, email, password };
    (["fullName", "email", "password"] as const).forEach((field) => {
      const err = validateFieldValue(field, values);
      if (err) nextErrors[field] = err;
    });

    if (turnstileSiteKey && !captchaToken) {
      nextErrors.captcha = "Please complete the security verification.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setTouchedFields({ fullName: true, email: true, password: true });
      setFieldErrors(nextErrors);
      if (
        nextErrors.captcha &&
        !nextErrors.fullName &&
        !nextErrors.email &&
        !nextErrors.password
      ) {
        setFormError(nextErrors.captcha);
      }
      focusFirstInvalidField(nextErrors);
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    try {
      const redirectUrl = `${window.location.origin}/auth/callback?next=/login`;
      const trimmedSchool = schoolName.trim();
      const { error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          captchaToken: captchaToken ?? undefined,
          data: {
            role,
            full_name: trimmedName,
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
          const msg =
            "Choose a stronger password — avoid common words or breached passwords.";
          setFieldErrors({ password: msg });
          requestAnimationFrame(() => passwordInputRef.current?.focus());
        } else if (
          status === 429 ||
          code === "over_email_send_rate_limit" ||
          code === "rate_limit_exceeded"
        ) {
          setFormError("Too many attempts. Please wait a minute and try again.");
          requestAnimationFrame(() => errorAlertRef.current?.focus());
        } else if (code === "email_address_invalid") {
          const msg = "Enter a valid email address.";
          setFieldErrors({ email: msg });
          requestAnimationFrame(() => emailInputRef.current?.focus());
        } else if (code === "signup_disabled") {
          setFormError("Sign-ups are currently closed.");
          requestAnimationFrame(() => errorAlertRef.current?.focus());
        } else if (code === "captcha_failed") {
          const msg = "Security verification failed. Please try again.";
          setFieldErrors({ captcha: msg });
          setFormError(msg);
          requestAnimationFrame(() => errorAlertRef.current?.focus());
        } else {
          setFormError("Something went wrong. Please try again.");
          requestAnimationFrame(() => errorAlertRef.current?.focus());
        }
        return;
      }

      setSubmittedEmail(trimmedEmail);
      setResendMessage(null);
      setResendIsError(false);
      setIsSuccess(true);
      setResendCooldown(60);
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
      requestAnimationFrame(() => errorAlertRef.current?.focus());
    } finally {
      // Turnstile tokens are single-use, including when the auth request fails.
      setCaptchaToken(null);
      captchaRef.current?.reset();
      setIsLoading(false);
    }
  }

  async function handleResendEmail() {
    if (!submittedEmail || resendCooldown > 0 || isResending) return;
    if (turnstileSiteKey && !captchaToken) {
      setResendIsError(true);
      setResendMessage("Please complete the security verification below before resending.");
      return;
    }

    setIsResending(true);
    setResendMessage(null);
    setResendIsError(false);

    try {
      const redirectUrl = `${window.location.origin}/auth/callback?next=/login`;
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: submittedEmail,
        options: {
          emailRedirectTo: redirectUrl,
          captchaToken: captchaToken ?? undefined,
        },
      });

      if (resendError) {
        const status = (resendError as { status?: number }).status;
        const code = (resendError as { code?: string }).code;
        setResendIsError(true);
        if (
          status === 429 ||
          code === "over_email_send_rate_limit" ||
          code === "rate_limit_exceeded"
        ) {
          setResendMessage("Rate limit exceeded. Please wait a moment before trying again.");
        } else if (code === "captcha_failed") {
          setResendMessage("Security verification failed. Please complete the check and try again.");
        } else {
          setResendMessage("Failed to resend confirmation email. Please try again.");
        }
      } else {
        setResendCooldown(60);
        setResendIsError(false);
        setResendMessage("A new confirmation email has been sent. Please check your inbox.");
      }
    } catch {
      setResendIsError(true);
      setResendMessage("Failed to resend email. Please try again later.");
    } finally {
      setCaptchaToken(null);
      resendCaptchaRef.current?.reset();
      setIsResending(false);
    }
  }

  const passwordDescribedBy = [
    fieldErrors.password ? "password-error" : null,
    "password-requirement",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Card className="border-border/80 bg-card/95 pb-0 shadow-warm backdrop-blur-xs transition-all duration-200">
      <CardHeader className="space-y-3 text-center pb-2 pt-6">
        <div className="flex justify-center">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl border border-border/80 bg-surface p-1 shadow-warm-sm view-transition-brand-logo">
            <BrandIcon size={48} priority className="size-full rounded-xl" />
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            {isSuccess ? "Check your email" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSuccess
              ? `We sent a verification link to ${submittedEmail}.`
              : role === "teacher"
                ? "Set up your teacher workspace for cursive assessment."
                : "Follow your child’s cursive progress and feedback."}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {isSuccess ? (
          <div
            ref={successContainerRef}
            tabIndex={-1}
            className="space-y-4 py-1 text-center outline-none animate-in fade-in-50 duration-200 motion-reduce:animate-none motion-reduce:transition-none"
          >
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-4 ring-brand-100/70 dark:bg-brand-950/60 dark:text-brand-400 dark:ring-brand-900/50">
              <MailIcon className="size-6" aria-hidden="true" />
            </div>

            <Alert className="border-brand-200 bg-brand-50/70 text-brand-900 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300 text-left">
              <CheckCircle2Icon
                className="size-4 text-brand-600 dark:text-brand-400"
                aria-hidden="true"
              />
              <AlertDescription className="text-sm leading-relaxed space-y-1.5">
                <p>
                  Click the link in your email to verify your account, and check your spam or junk folder if it doesn’t appear right away.
                </p>
                <p className="text-brand-800/90 dark:text-brand-300/90">
                  {role === "teacher"
                    ? "Once verified, sign in to create your class roster and activities."
                    : "Once verified, sign in—your child’s teacher will link your account to their student record."}
                </p>
                <p className="text-xs text-brand-800/80 dark:text-brand-300/80">
                  Already registered with this email? Sign in below with your existing password.
                </p>
              </AlertDescription>
            </Alert>

            {turnstileSiteKey && (
              <ResponsiveTurnstile
                id="signup-resend-captcha"
                className="mx-auto"
                ref={resendCaptchaRef}
                siteKey={turnstileSiteKey}
                onSuccess={(token) => {
                  setCaptchaToken(token);
                  if (resendIsError) setResendMessage(null);
                }}
                onExpire={() => setCaptchaToken(null)}
                onTimeout={() => setCaptchaToken(null)}
                onError={() => {
                  setCaptchaToken(null);
                  setResendIsError(true);
                  setResendMessage("Security verification could not load. Please try again.");
                }}
                options={{ theme: "auto" }}
              />
            )}

            <p
              aria-live="polite"
              className={cn(
                "min-h-4 text-xs",
                resendIsError ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {resendMessage ?? ""}
            </p>

            <div className="space-y-2.5 pt-0.5">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "h-10 sm:h-9 w-full font-medium transition-all duration-150"
                )}
              >
                Go to Sign in
                <ArrowRightIcon className="ml-2 size-4" aria-hidden="true" />
              </Link>

              <Button
                id="signup-resend"
                type="button"
                variant="outline"
                size="sm"
                className="h-10 sm:h-9 w-full text-xs"
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
                  setResendMessage(null);
                  setResendIsError(false);
                  setFormError(null);
                  setFieldErrors({});
                  setCaptchaToken(null);
                  captchaRef.current?.reset();
                  resendCaptchaRef.current?.reset();
                }}
                className="inline-flex min-h-[40px] sm:min-h-[36px] items-center justify-center px-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
              >
                Entered the wrong email? Use a different email
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            aria-busy={isLoading}
            className="grid gap-5"
            noValidate
          >
            {formError && (
              <Alert
                ref={errorAlertRef}
                tabIndex={-1}
                variant="destructive"
                id="signup-error"
                className="outline-none [&>svg]:translate-y-0 animate-in fade-in-50 slide-in-from-top-1 duration-200 motion-reduce:animate-none motion-reduce:transition-none"
              >
                <CircleAlertIcon aria-hidden="true" />
                <AlertDescription className="text-xs leading-normal">
                  {formError}
                </AlertDescription>
              </Alert>
            )}

            {/* Group 1: Role & Profile */}
            <div className="grid gap-4">
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-foreground">
                  I am registering as a
                </legend>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1 border border-border/70">
                  <label
                    htmlFor="signup-role-teacher"
                    className={`flex min-h-10 sm:min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm transition-all duration-150 has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
                      role === "teacher"
                        ? "bg-surface text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground font-medium"
                    }`}
                  >
                    <input
                      id="signup-role-teacher"
                      type="radio"
                      name="role"
                      value="teacher"
                      checked={role === "teacher"}
                      onChange={() => setRole("teacher")}
                      disabled={isLoading}
                      className="sr-only"
                    />
                    <GraduationCapIcon className="size-4 shrink-0" aria-hidden="true" />
                    <span>Teacher</span>
                  </label>
                  <label
                    htmlFor="signup-role-parent"
                    className={`flex min-h-10 sm:min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-sm transition-all duration-150 has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
                      role === "parent"
                        ? "bg-surface text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground font-medium"
                    }`}
                  >
                    <input
                      id="signup-role-parent"
                      type="radio"
                      name="role"
                      value="parent"
                      checked={role === "parent"}
                      onChange={() => setRole("parent")}
                      disabled={isLoading}
                      className="sr-only"
                    />
                    <HeartHandshakeIcon className="size-4 shrink-0" aria-hidden="true" />
                    <span>Parent</span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed px-0.5">
                  {role === "teacher"
                    ? "Manage your class roster, activities, and cursive assessments."
                    : "Your child’s teacher will link your account to their student record."}
                </p>
              </fieldset>

              <div className="grid gap-1.5">
                <Label htmlFor="fullName" className="text-xs font-semibold text-foreground">
                  Full name
                </Label>
                <Input
                  ref={fullNameInputRef}
                  id="fullName"
                  type="text"
                  placeholder={role === "teacher" ? "Maria Santos" : "Juan dela Cruz"}
                  value={fullName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFullName(value);
                    updateFieldErrorOnChange("fullName", {
                      fullName: value,
                      email,
                      password,
                    });
                  }}
                  onBlur={() => handleFieldBlur("fullName")}
                  required
                  autoComplete="name"
                  enterKeyHint="next"
                  disabled={isLoading}
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined}
                  className="h-10 sm:h-9"
                />
                {fieldErrors.fullName && (
                  <p id="fullName-error" className="mt-1 text-xs text-destructive">
                    {fieldErrors.fullName}
                  </p>
                )}
              </div>

              {role === "teacher" && (
                <div className="grid gap-1.5 animate-in fade-in-50 duration-150 motion-reduce:animate-none motion-reduce:transition-none">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="schoolName"
                      className="text-xs font-semibold text-foreground"
                    >
                      School / Institution
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Optional
                    </span>
                  </div>
                  <Input
                    id="schoolName"
                    type="text"
                    placeholder="e.g. Davao Central Elementary School"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    autoComplete="organization"
                    enterKeyHint="next"
                    disabled={isLoading}
                    className="h-10 sm:h-9"
                  />
                </div>
              )}
            </div>

            {/* Group 2: Account Credentials */}
            <div className="grid gap-4 border-t border-border/60 pt-4">
              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                  Email address
                </Label>
                <Input
                  ref={emailInputRef}
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEmail(value);
                    updateFieldErrorOnChange("email", {
                      fullName,
                      email: value,
                      password,
                    });
                  }}
                  onBlur={() => handleFieldBlur("email")}
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  disabled={isLoading}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  className="h-10 sm:h-9"
                />
                {fieldErrors.email && (
                  <p id="email-error" className="mt-1 text-xs text-destructive">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                    Password
                  </Label>
                  <span
                    id="password-requirement"
                    aria-live="polite"
                    aria-atomic="true"
                    className={cn(
                      "inline-flex items-center gap-1 text-xs transition-colors",
                      hasMinLength
                        ? "text-band-4-text font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {hasMinLength ? (
                      <CheckIcon className="size-3.5" aria-hidden="true" />
                    ) : null}
                    <span className="sr-only">
                      {hasMinLength ? "Requirement met: " : "Requirement: "}
                    </span>
                    At least {MIN_PASSWORD_LENGTH} characters
                  </span>
                </div>
                <div className="relative">
                  <Input
                    ref={passwordInputRef}
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPassword(value);
                      updateFieldErrorOnChange("password", {
                        fullName,
                        email,
                        password: value,
                      });
                    }}
                    onBlur={() => handleFieldBlur("password")}
                    required
                    autoComplete="new-password"
                    enterKeyHint={turnstileSiteKey ? "done" : "go"}
                    disabled={isLoading}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={passwordDescribedBy}
                    className="h-10 sm:h-9 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isLoading}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute right-0.5 top-1/2 -translate-y-1/2 flex size-10 sm:size-9 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" aria-hidden="true" />
                    ) : (
                      <EyeIcon className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="password-error" className="mt-1 text-xs text-destructive">
                    {fieldErrors.password}
                  </p>
                )}
              </div>
            </div>

            {turnstileSiteKey && (
              <div className="grid gap-1.5">
                <ResponsiveTurnstile
                  id="signup-captcha"
                  className="mx-auto"
                  ref={captchaRef}
                  siteKey={turnstileSiteKey}
                  onSuccess={(token) => {
                    setCaptchaToken(token);
                    setFieldErrors((prev) => {
                      if (!prev.captcha) return prev;
                      const next = { ...prev };
                      delete next.captcha;
                      return next;
                    });
                    if (formError === fieldErrors.captcha) {
                      setFormError(null);
                    }
                  }}
                  onExpire={() => setCaptchaToken(null)}
                  onTimeout={() => setCaptchaToken(null)}
                  onError={() => {
                    const msg = "Security verification could not load. Please try again.";
                    setCaptchaToken(null);
                    setFieldErrors((prev) => ({ ...prev, captcha: msg }));
                    setFormError(msg);
                  }}
                  options={{
                    theme: "auto",
                  }}
                />
                {fieldErrors.captcha && (
                  <p
                    id="captcha-error"
                    className="mt-1 text-center text-xs text-destructive"
                  >
                    {fieldErrors.captcha}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-foreground">
              <ShieldCheckIcon
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <p>
                {role === "teacher"
                  ? "Students never need accounts or logins—paper consent and roster records stay managed by you."
                  : "Students never need accounts—your child’s teacher handles paper consent and links your account after email verification."}
              </p>
            </div>

            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              By signing up, you agree to our{" "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 rounded py-1.5 -my-1.5 sm:py-0.5 sm:-my-0.5 font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span>Privacy Policy</span>
                <ExternalLinkIcon className="size-3 shrink-0" aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>{" "}
              and{" "}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 rounded py-1.5 -my-1.5 sm:py-0.5 sm:-my-0.5 font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span>Terms of Service</span>
                <ExternalLinkIcon className="size-3 shrink-0" aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
              .
            </p>

            <Button
              id="signup-submit"
              type="submit"
              size="lg"
              className="h-10 sm:h-9 w-full font-medium transition-all duration-150"
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

      <CardFooter className="flex flex-col items-center justify-center border-t border-border/60 bg-muted/20 px-6 py-3.5 [.border-t]:pt-3.5 text-center text-xs text-muted-foreground">
        <p className="flex flex-wrap items-center justify-center gap-x-1">
          <span>Already have an account?</span>
          <Link
            href="/login"
            className="inline-flex items-center min-h-[40px] sm:min-h-[36px] px-1 font-medium text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
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
    <AuthShell
      backHref="/"
      backLabel="Back to home"
    >
      <Suspense fallback={<Spinner className="size-8 text-primary" />}>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  );
}

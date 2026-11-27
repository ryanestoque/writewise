"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AuthShell, AuthCardSkeleton } from "@/components/auth/auth-shell";
import {
  isRateLimitAuthError,
  validateEmail,
  validateRequiredPassword,
} from "@/lib/auth/validation";
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
import { Spinner } from "@/components/ui/spinner";
import { BrandIcon } from "@/components/brand-logo";
import {
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
} from "lucide-react";

const LazyTurnstile = dynamic(
  () =>
    import("@/components/auth/responsive-turnstile").then(
      (m) => m.ResponsiveTurnstile
    ),
  { ssr: false }
);

type LoginField = "email" | "password";
type LoginFieldErrors = Partial<Record<LoginField, string>>;

function ForgotPasswordDialog({ initialEmail = "" }: { initialEmail?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState(initialEmail);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendErrorScope, setSendErrorScope] = useState<"email" | "form" | null>(
    null
  );
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileInstance>(undefined);
  const resetEmailInputRef = useRef<HTMLInputElement>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    setCaptchaToken(null);
    captchaRef.current?.reset();
    if (isOpen) {
      setResetEmail(initialEmail || "");
      setSendError(null);
      setSendErrorScope(null);
      setIsSent(false);
    }
  }

  async function handleSendReset(e: React.FormEvent) {
    e.preventDefault();
    if (isSending) return;

    const emailErr = validateEmail(resetEmail);
    if (emailErr) {
      setSendError(emailErr);
      setSendErrorScope("email");
      requestAnimationFrame(() => resetEmailInputRef.current?.focus());
      return;
    }

    if (turnstileSiteKey && !captchaToken) {
      setSendError("Please complete the security verification.");
      setSendErrorScope("form");
      return;
    }

    setIsSending(true);
    setSendError(null);
    setSendErrorScope(null);

    try {
      const redirectUrl = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(
        resetEmail.trim(),
        {
          redirectTo: redirectUrl,
          captchaToken: captchaToken ?? undefined,
        }
      );

      if (error) {
        const authErr = error as { status?: number; code?: string };

        if (isRateLimitAuthError(authErr)) {
          setSendError(
            "Too many requests. Please wait a few moments before trying again."
          );
          setSendErrorScope("form");
        } else if (authErr.code === "captcha_failed") {
          setSendError("Security verification failed. Please try again.");
          setSendErrorScope("form");
        } else {
          setSendError("Failed to send reset email. Please try again.");
          setSendErrorScope("form");
        }
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("writewise_recovery_email", resetEmail.trim());
      }

      setIsSent(true);
    } catch {
      setSendError("An unexpected error occurred. Please try again.");
      setSendErrorScope("form");
    } finally {
      // Tokens are single-use, including when the auth request fails.
      setCaptchaToken(null);
      captchaRef.current?.reset();
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center -my-1 min-h-[40px] sm:min-h-[36px] px-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          >
            Forgot password?
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground font-heading">
            {isSent ? "Check Your Email" : "Reset Password"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed mt-1">
            {isSent
              ? "We've sent recovery instructions to your registered email address."
              : "Enter your registered email address to receive a password reset link."}
          </DialogDescription>
        </DialogHeader>

        {isSent ? (
          <div className="space-y-4 py-1">
            <Alert variant="success">
              <CheckCircle2Icon className="size-4" aria-hidden="true" />
              <AlertDescription className="text-sm leading-relaxed">
                If an account exists for{" "}
                <span className="font-semibold">{resetEmail.trim()}</span>, a
                password reset link has been sent. Please check your inbox and
                spam folder.
              </AlertDescription>
            </Alert>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setIsSent(false)}
                className="inline-flex items-center min-h-[40px] sm:min-h-[36px] px-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Entered the wrong email? Try again
              </button>
            </div>

            <DialogFooter showCloseButton={false} className="pt-2">
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="default"
                    autoFocus
                    className="h-10 sm:h-9 w-full sm:w-auto"
                  >
                    Done
                  </Button>
                }
              />
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={handleSendReset}
            aria-busy={isSending}
            noValidate
            className="space-y-5 pt-1"
          >
            {sendError && (
              <Alert variant="destructive">
                <CircleAlertIcon className="size-4" aria-hidden="true" />
                <AlertDescription id="reset-email-error" className="text-sm">
                  {sendError}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="reset-email"
                className="text-xs font-semibold text-foreground"
              >
                Email address
              </Label>
              <Input
                ref={resetEmailInputRef}
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="name@example.com"
                value={resetEmail}
                onChange={(e) => {
                  setResetEmail(e.target.value);
                  if (sendError) {
                    setSendError(null);
                    setSendErrorScope(null);
                  }
                }}
                disabled={isSending}
                aria-invalid={sendErrorScope === "email"}
                aria-describedby={
                  sendErrorScope === "email" ? "reset-email-error" : undefined
                }
                className="h-10 sm:h-9"
              />
            </div>

            <div className="space-y-2.5 rounded-xl border border-border/80 bg-muted/40 p-3.5 text-sm text-foreground">
              <div className="space-y-0.5">
                <p className="font-medium text-foreground text-sm">Teachers</p>
                <p className="text-muted-foreground text-sm leading-normal">
                  Reach out to your WriteWise pilot coordinator if you need help
                  verifying or recovering your account.
                </p>
              </div>
              <div className="border-t border-border/60 pt-2.5 space-y-0.5">
                <p className="font-medium text-foreground text-sm">Parents</p>
                <p className="text-muted-foreground text-sm leading-normal">
                  Contact your child&apos;s teacher to confirm which email
                  address is linked to your family.
                </p>
              </div>
            </div>

            {turnstileSiteKey && (
              <LazyTurnstile
                id="reset-email-captcha"
                className="mx-auto"
                turnstileRef={captchaRef}
                siteKey={turnstileSiteKey}
                onSuccess={setCaptchaToken}
                onExpire={() => setCaptchaToken(null)}
                onTimeout={() => setCaptchaToken(null)}
                onError={() => {
                  setCaptchaToken(null);
                  setSendError(
                    "Security verification could not load. Please try again."
                  );
                  setSendErrorScope("form");
                }}
              />
            )}

            <DialogFooter showCloseButton={false}>
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSending}
                    className="h-10 sm:h-9 w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                }
              />
              <Button
                type="submit"
                className="h-10 sm:h-9 w-full sm:w-auto"
                disabled={isSending || !resetEmail.trim()}
              >
                {isSending ? (
                  <>
                    <Spinner className="size-3.5 mr-2" />
                    Sending link…
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errorScope, setErrorScope] = useState<"credentials" | "form" | null>(
    null
  );
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [touchedFields, setTouchedFields] = useState<
    Partial<Record<LoginField, boolean>>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [isUnconfirmed, setIsUnconfirmed] = useState(false);
  const [isResendingConfirm, setIsResendingConfirm] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendIsError, setResendIsError] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileInstance>(undefined);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const errorAlertRef = useRef<HTMLDivElement>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle ?confirmed=true toast
  useEffect(() => {
    if (searchParams.get("confirmed") === "true") {
      toast.success("Email confirmed — sign in to continue.");
      router.replace("/login");
    }
  }, [searchParams, router]);

  // Detect password recovery callback (hash tokens, auth errors, or auth event)
  useEffect(() => {
    const errorCode = searchParams.get("error_code");
    const errorParam = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");
    const hash = typeof window !== "undefined" ? window.location.hash : "";

    const isRecoveryError =
      errorCode === "otp_expired" ||
      (errorDesc && errorDesc.toLowerCase().includes("email link")) ||
      hash.includes("otp_expired") ||
      (errorParam === "access_denied" &&
        (hash.includes("expired") ||
          (errorDesc && errorDesc.toLowerCase().includes("expired"))));

    if (isRecoveryError) {
      const search = window.location.search || "";
      router.replace(`/reset-password${search}${hash}`);
      return;
    }

    if (
      hash &&
      (hash.includes("type=recovery") || hash.includes("access_token="))
    ) {
      router.replace(`/reset-password${hash}`);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/reset-password");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, searchParams, supabase]);

  const missingRoleError =
    searchParams.get("error") === "missing_role"
      ? "Your account setup isn't finished yet. Please contact your WriteWise pilot coordinator or your child's teacher to complete access."
      : null;

  const confirmationFailedError =
    searchParams.get("error") === "confirmation_failed"
      ? "That confirmation link is invalid or expired. Enter your email below to request a new confirmation link, or sign up again."
      : null;

  const error = formError ?? missingRoleError ?? confirmationFailedError;
  const showResendConfirmation =
    isUnconfirmed || Boolean(confirmationFailedError);

  function validateSingleField(
    field: LoginField,
    values: { email: string; password: string }
  ): string | undefined {
    return field === "email"
      ? validateEmail(values.email)
      : validateRequiredPassword(values.password);
  }

  function updateFieldErrorOnChange(
    field: LoginField,
    nextValues: { email: string; password: string }
  ) {
    if (!fieldErrors[field] && !touchedFields[field]) return;
    const nextErr = validateSingleField(field, nextValues);
    setFieldErrors((prev) => {
      if (prev[field] === nextErr) return prev;
      const updated = { ...prev };
      if (nextErr) {
        updated[field] = nextErr;
      } else {
        delete updated[field];
      }
      return updated;
    });
  }

  function handleFieldBlur(field: LoginField) {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
    const err = validateSingleField(field, { email, password });
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

  async function handleResendConfirmation() {
    if (!email.trim() || isResendingConfirm || resendCooldown > 0) return;

    const emailErr = validateEmail(email);
    if (emailErr) {
      setFieldErrors((prev) => ({ ...prev, email: emailErr }));
      setTouchedFields((prev) => ({ ...prev, email: true }));
      requestAnimationFrame(() => emailInputRef.current?.focus());
      return;
    }

    if (turnstileSiteKey && !captchaToken) {
      setResendIsError(true);
      setResendMessage(
        "Complete the security verification below before resending."
      );
      return;
    }

    setIsResendingConfirm(true);
    setResendMessage(null);
    setResendIsError(false);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/login`,
          captchaToken: captchaToken ?? undefined,
        },
      });
      if (resendError) {
        const authErr = resendError as { status?: number; code?: string };
        setResendIsError(true);
        if (isRateLimitAuthError(authErr)) {
          setResendMessage(
            "Too many requests. Please wait a moment before trying again."
          );
        } else if (authErr.code === "captcha_failed") {
          setResendMessage(
            "Security verification failed. Please complete the check and try again."
          );
        } else {
          setResendMessage(
            "Failed to resend confirmation email. Please try again."
          );
        }
      } else {
        setResendCooldown(60);
        setResendIsError(false);
        setResendMessage(
          "A new confirmation email has been sent. Please check your inbox."
        );
      }
    } catch {
      setResendIsError(true);
      setResendMessage("An unexpected error occurred. Please try again.");
    } finally {
      setCaptchaToken(null);
      captchaRef.current?.reset();
      setIsResendingConfirm(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isLoading) return;
    setFormError(null);
    setErrorScope(null);
    setIsUnconfirmed(false);
    setResendMessage(null);
    setResendIsError(false);

    const nextFieldErrors: LoginFieldErrors = {};
    const emailErr = validateEmail(email);
    const passwordErr = validateRequiredPassword(password);
    if (emailErr) nextFieldErrors.email = emailErr;
    if (passwordErr) nextFieldErrors.password = passwordErr;

    if (Object.keys(nextFieldErrors).length > 0) {
      setTouchedFields({ email: true, password: true });
      setFieldErrors(nextFieldErrors);
      if (nextFieldErrors.email) {
        requestAnimationFrame(() => emailInputRef.current?.focus());
      } else {
        requestAnimationFrame(() => passwordInputRef.current?.focus());
      }
      return;
    }

    if (turnstileSiteKey && !captchaToken) {
      setFormError("Please complete the security verification.");
      setErrorScope("form");
      requestAnimationFrame(() => errorAlertRef.current?.focus());
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: { captchaToken: captchaToken ?? undefined },
      });

      if (authError) {
        if (authError.code === "invalid_credentials") {
          setFormError("Invalid email or password.");
          setErrorScope("credentials");
          setIsLoading(false);
          requestAnimationFrame(() => passwordInputRef.current?.focus());
          return;
        } else if (authError.code === "email_not_confirmed") {
          setIsUnconfirmed(true);
          setFormError(
            "Please confirm your email address before signing in. Check your inbox for the link."
          );
          setErrorScope("form");
        } else if (authError.code === "captcha_failed") {
          setFormError("Security verification failed. Please try again.");
          setErrorScope("form");
        } else if (isRateLimitAuthError(authError)) {
          setFormError(
            "Too many sign-in attempts. Please wait a moment and try again."
          );
          setErrorScope("form");
        } else {
          setFormError("Something went wrong. Please try again.");
          setErrorScope("form");
        }
        setIsLoading(false);
        requestAnimationFrame(() => errorAlertRef.current?.focus());
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setFormError("Something went wrong. Please try again.");
      setErrorScope("form");
      setIsLoading(false);
      requestAnimationFrame(() => errorAlertRef.current?.focus());
    } finally {
      setCaptchaToken(null);
      captchaRef.current?.reset();
    }
  }

  const hasCredentialError = errorScope === "credentials";
  const emailDescribedBy = [
    fieldErrors.email ? "email-error" : null,
    error ? "login-error" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const passwordDescribedBy = [
    fieldErrors.password ? "password-error" : null,
    error ? "login-error" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Card className="w-full max-w-md border-border/80 bg-card/95 pb-0 shadow-warm backdrop-blur-xs">
      <CardHeader className="space-y-3 text-center pb-2 pt-6">
        <div className="flex justify-center">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl border border-border/80 bg-surface p-1 shadow-warm-sm view-transition-brand-logo">
            <BrandIcon
              size={48}
              alt="WriteWise"
              priority
              className="size-full rounded-xl"
            />
          </div>
        </div>
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your teacher or parent portal
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <form
          onSubmit={handleSubmit}
          aria-busy={isLoading}
          noValidate
          className="grid gap-5"
        >
          {error && (
            <div className="space-y-2">
              <Alert
                ref={errorAlertRef}
                tabIndex={-1}
                variant="destructive"
                id="login-error"
                className="outline-none [&>svg]:translate-y-0 animate-in fade-in-50 slide-in-from-top-1 duration-200 motion-reduce:animate-none motion-reduce:transition-none"
              >
                <CircleAlertIcon aria-hidden="true" />
                <AlertDescription className="text-sm leading-normal">
                  {error}
                </AlertDescription>
              </Alert>
              {showResendConfirmation && (
                <div className="space-y-1 px-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {email.trim()
                        ? "Didn't receive it?"
                        : "Enter your email below first"}
                    </span>
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={
                        !email.trim() ||
                        isResendingConfirm ||
                        resendCooldown > 0
                      }
                      className="inline-flex items-center min-h-[40px] sm:min-h-[36px] px-1.5 font-medium text-primary hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    >
                      {isResendingConfirm
                        ? "Resending…"
                        : resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : "Resend confirmation email"}
                    </button>
                  </div>
                  {resendMessage && (
                    <p
                      aria-live="polite"
                      className={cn(
                        "text-xs",
                        resendIsError
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {resendMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-semibold text-foreground"
            >
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
                updateFieldErrorOnChange("email", { email: value, password });
                if (formError) {
                  setFormError(null);
                  setErrorScope(null);
                }
              }}
              onBlur={() => handleFieldBlur("email")}
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              disabled={isLoading}
              aria-invalid={Boolean(fieldErrors.email) || hasCredentialError}
              aria-describedby={emailDescribedBy || undefined}
              className="h-10 sm:h-9"
            />
            {fieldErrors.email && (
              <p
                id="email-error"
                role="alert"
                className="mt-1 text-xs text-destructive"
              >
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-semibold text-foreground"
            >
              Password
            </Label>
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
                    email,
                    password: value,
                  });
                  if (formError) {
                    setFormError(null);
                    setErrorScope(null);
                  }
                }}
                onBlur={() => handleFieldBlur("password")}
                required
                autoComplete="current-password"
                enterKeyHint="go"
                disabled={isLoading}
                aria-invalid={Boolean(fieldErrors.password) || hasCredentialError}
                aria-describedby={passwordDescribedBy || undefined}
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
              <p
                id="password-error"
                role="alert"
                className="mt-1 text-xs text-destructive"
              >
                {fieldErrors.password}
              </p>
            )}
            <div className="flex justify-end">
              <ForgotPasswordDialog initialEmail={email} />
            </div>
          </div>

          {turnstileSiteKey && (
            <LazyTurnstile
              id="login-captcha"
              turnstileRef={captchaRef}
              siteKey={turnstileSiteKey}
              onSuccess={(token) => {
                setCaptchaToken(token);
                if (resendIsError) setResendMessage(null);
              }}
              onExpire={() => setCaptchaToken(null)}
              onTimeout={() => setCaptchaToken(null)}
              onError={() => {
                setCaptchaToken(null);
                setFormError(
                  "Security verification could not load. Please try again."
                );
                setErrorScope("form");
              }}
            />
          )}

          <Button
            id="login-submit"
            type="submit"
            size="lg"
            className="mt-1 h-11 sm:h-9 w-full font-medium"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2 size-4" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRightIcon className="ml-2 size-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col items-center justify-center border-t border-border/60 bg-muted/20 px-(--card-spacing) py-3.5 [.border-t]:pt-3.5 text-center text-xs text-muted-foreground">
        <p className="flex flex-wrap items-center justify-center gap-x-1">
          <span>Don&apos;t have an account?</span>
          <Link
            href="/signup"
            className="inline-flex items-center min-h-[40px] sm:min-h-[36px] px-1 font-medium text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <AuthShell backHref="/" backLabel="Back to home">
      <Suspense fallback={<AuthCardSkeleton variant="login" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

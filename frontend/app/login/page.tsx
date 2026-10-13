"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { HandwritingGuidelineBackground } from "@/components/auth/handwriting-guideline-background";
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
import { BrandLogo } from "@/components/brand-logo";
import {
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  HelpCircleIcon,
  ArrowRightIcon,
  SchoolIcon,
  CheckCircle2Icon,
} from "lucide-react";

function ForgotPasswordDialog({ initialEmail = "" }: { initialEmail?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState(initialEmail);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setResetEmail(initialEmail || "");
      setSendError(null);
      setIsSent(false);
    }
  }

  async function handleSendReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim()) return;

    setIsSending(true);
    setSendError(null);

    try {
      const redirectUrl = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(
        resetEmail.trim(),
        {
          redirectTo: redirectUrl,
        }
      );

      if (error) {
        const status = (error as { status?: number }).status;
        const code = (error as { code?: string }).code;

        if (status === 429 || code === "over_email_send_rate_limit" || code === "rate_limit_exceeded") {
          setSendError(
            "Too many requests. Please wait a few moments before trying again."
          );
        } else {
          setSendError(error.message || "Failed to send reset email.");
        }
        setIsSending(false);
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("writewise_recovery_email", resetEmail.trim());
      }

      setIsSent(true);
      setIsSending(false);
    } catch {
      setSendError("An unexpected error occurred. Please try again.");
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center -my-1 min-h-[40px] sm:min-h-[36px] px-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
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
              : "Enter your registered email address to receive a password reset link."}
          </DialogDescription>
        </DialogHeader>

        {isSent ? (
          <div className="space-y-4 py-1">
            <Alert className="border-brand-200 bg-brand-50/70 text-brand-900 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-300">
              <CheckCircle2Icon className="size-4 text-brand-600 dark:text-brand-400" />
              <AlertDescription className="text-xs leading-relaxed">
                If an account exists for <span className="font-semibold">{resetEmail}</span>, a password reset link has been sent. Please check your inbox and spam folder.
              </AlertDescription>
            </Alert>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setIsSent(false)}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
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
          <form onSubmit={handleSendReset} className="space-y-4 pt-1">
            {sendError && (
              <Alert variant="destructive">
                <CircleAlertIcon className="size-4" />
                <AlertDescription id="reset-email-error" className="text-xs">
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
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@school.edu"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                disabled={isSending}
                aria-invalid={!!sendError}
                aria-describedby={sendError ? "reset-email-error" : undefined}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-border/80 bg-muted/40 p-3 text-xs text-foreground">
              <div className="flex items-start gap-2">
                <SchoolIcon className="size-3.5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground text-xs">Teachers & Staff:</p>
                  <p className="text-muted-foreground text-xs leading-normal">
                    You can also contact your department head or school admin for direct credential assistance.
                  </p>
                </div>
              </div>
              <div className="border-t border-border/60 pt-2 flex items-start gap-2">
                <HelpCircleIcon className="size-3.5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground text-xs">Parents:</p>
                  <p className="text-muted-foreground text-xs leading-normal">
                    Reach out to your child&apos;s class adviser or coordinator to verify your registered email.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter showCloseButton={false}>
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSending}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                }
              />
              <Button
                type="submit"
                size="sm"
                className="w-full sm:w-auto"
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
  const [isLoading, setIsLoading] = useState(false);
  const [isUnconfirmed, setIsUnconfirmed] = useState(false);
  const [isResendingConfirm, setIsResendingConfirm] = useState(false);
  const [resendConfirmSuccess, setResendConfirmSuccess] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

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
      (errorParam === "access_denied" && (hash.includes("expired") || (errorDesc && errorDesc.toLowerCase().includes("expired"))));

    if (isRecoveryError) {
      const search = window.location.search || "";
      router.replace(`/reset-password${search}${hash}`);
      return;
    }

    if (hash && (hash.includes("type=recovery") || hash.includes("access_token="))) {
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
      ? "Your account is missing a role assignment. Please contact your school administrator or coordinator."
      : null;

  const confirmationFailedError =
    searchParams.get("error") === "confirmation_failed"
      ? "That confirmation link is invalid or expired. Please sign up again or request a new confirmation link."
      : null;

  const error = formError ?? missingRoleError ?? confirmationFailedError;

  async function handleResendConfirmation() {
    if (!email.trim() || isResendingConfirm) return;
    setIsResendingConfirm(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/login`,
        },
      });
      if (resendError) {
        toast.error("Failed to resend confirmation email. Please try again.");
      } else {
        setResendConfirmSuccess(true);
        toast.success("Confirmation email resent! Please check your inbox.");
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsResendingConfirm(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    setIsLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        if (authError.code === "invalid_credentials") {
          setFormError("Invalid email or password.");
        } else if (authError.code === "email_not_confirmed") {
          setIsUnconfirmed(true);
          setFormError("Please confirm your email address before signing in. Check your inbox for the link.");
        } else {
          setFormError("Something went wrong. Please try again.");
        }
        setPassword("");
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setFormError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-warm backdrop-blur-xs transition-all duration-200">
      <CardHeader className="space-y-1.5 text-center pb-2 pt-6">
        <div className="flex justify-center -my-1">
          <BrandLogo size="xl" priority />
        </div>
        <h1 className="sr-only">WriteWise Login</h1>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate={false}>
          {error && (
            <div className="space-y-2">
              <Alert
                variant="destructive"
                id="login-error"
                className="[&>svg]:translate-y-0 animate-in fade-in-50 slide-in-from-top-1 duration-200 motion-reduce:animate-none motion-reduce:transition-none"
              >
                <CircleAlertIcon aria-hidden="true" />
                <AlertDescription className="text-xs leading-normal">
                  {error}
                </AlertDescription>
              </Alert>
              {isUnconfirmed && (
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="text-muted-foreground">Didn&apos;t receive it?</span>
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isResendingConfirm || resendConfirmSuccess}
                    className="font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {isResendingConfirm ? "Resending…" : resendConfirmSuccess ? "Email sent!" : "Resend confirmation email"}
                  </button>
                </div>
              )}
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
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
              className="h-10 text-sm"
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                Password
              </Label>
              <ForgotPasswordDialog initialEmail={email} />
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                enterKeyHint="go"
                disabled={isLoading}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
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

          <Button
            id="login-submit"
            type="submit"
            size="lg"
            className="mt-1 h-10 w-full font-medium transition-all duration-150"
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

      <CardFooter className="flex flex-col items-center justify-center border-t border-border/60 bg-muted/20 px-6 py-3.5 text-center text-xs text-muted-foreground">
        <p>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
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
    <main className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-8 antialiased">
      <HandwritingGuidelineBackground />
      <Suspense fallback={<Spinner className="size-8 text-primary" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { BrandIcon } from "@/components/brand-logo";
import {
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  HelpCircleIcon,
  ArrowRightIcon,
  LockIcon,
  CheckCircle2Icon,
  ClockAlertIcon,
  LogInIcon,
  MailQuestionIcon,
} from "lucide-react";
import { toast } from "sonner";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasValidSession, setHasValidSession] = useState(false);

  const urlError = searchParams.get("error_description") || searchParams.get("error");

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      if (urlError) {
        if (isMounted) {
          setIsVerifyingSession(false);
          setFormError(urlError);
        }
        return;
      }

      // Check current session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        if (isMounted) {
          setUserEmail(session.user.email ?? null);
          setHasValidSession(true);
          setIsVerifyingSession(false);
        }
        return;
      }

      // Listen for auth state change in case hash tokens are being processed
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (!isMounted) return;
        if (newSession?.user) {
          setUserEmail(newSession.user.email ?? null);
          setHasValidSession(true);
          setIsVerifyingSession(false);
        }
      });

      // Determine grace period: allow 6 seconds if URL hash token is present, else 3.5 seconds
      const hasHashToken =
        typeof window !== "undefined" &&
        (window.location.hash.includes("access_token") ||
          window.location.hash.includes("refresh_token") ||
          window.location.search.includes("code="));
      const timeoutMs = hasHashToken ? 6000 : 3500;

      const timer = setTimeout(() => {
        if (isMounted && !hasValidSession) {
          setIsVerifyingSession(false);
        }
      }, timeoutMs);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timer);
      };
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [supabase, urlError, hasValidSession]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (updateError) {
        setFormError(updateError.message || "Failed to set password. Please try again.");
        setIsSubmitting(false);
        return;
      }

      toast.success("Account setup complete! Welcome to WriteWise.");
      router.push("/progress");
      router.refresh();
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  }

  if (isVerifyingSession) {
    return (
      <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-warm backdrop-blur-xs p-8 text-center space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-warm-sm ring-4 ring-brand-100/70">
          <BrandIcon className="size-6" />
        </div>
        <div className="space-y-2">
          <Spinner className="mx-auto size-6 text-primary" />
          <p className="text-sm font-medium text-foreground">Verifying invitation…</p>
          <p className="text-xs text-muted-foreground">Please wait while we secure your session.</p>
        </div>
      </Card>
    );
  }

  if (!hasValidSession) {
    return (
      <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-warm backdrop-blur-xs transition-all duration-200" role="region" aria-label="Invitation Status">
        <CardHeader className="space-y-2.5 text-center pb-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-warm-sm ring-4 ring-brand-100/70">
            <BrandIcon className="size-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Invitation Link Expired
            </h1>
            <CardDescription className="mt-1 text-sm text-muted-foreground">
              This parent portal invitation link is no longer active.
            </CardDescription>
          </div>
          <div
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900 mx-auto"
            role="status"
          >
            <ClockAlertIcon className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <span>Link inactive or already used</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-3.5">
          {formError && (
            <Alert variant="destructive" className="[&>svg]:translate-y-0 text-left">
              <CircleAlertIcon className="size-4" aria-hidden="true" />
              <AlertDescription className="text-xs sm:text-sm leading-normal">{formError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3 text-left">
            {/* Contextual Path 1: Already registered - Interactive Action Card */}
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="group w-full rounded-xl border border-border/80 bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-brand-50/40 dark:hover:bg-brand-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-start gap-3.5 cursor-pointer"
            >
              <div className="size-8 rounded-lg bg-brand-50 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0 mt-0.5 border border-brand-200/60 dark:border-brand-900/60 group-hover:scale-105 transition-transform">
                <LogInIcon className="size-4" aria-hidden="true" />
              </div>
              <div className="space-y-1 text-sm flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">Already activated your account?</p>
                  <ArrowRightIcon className="size-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  If you previously created your password, your account is ready. Sign in directly to view your child&apos;s cursive progress.
                </p>
              </div>
            </button>

            {/* Contextual Path 2: First-time parent needing new invite */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-left flex items-start gap-3.5">
              <div className="size-8 rounded-lg bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5 border border-amber-200/60 dark:border-amber-900/60">
                <MailQuestionIcon className="size-4" aria-hidden="true" />
              </div>
              <div className="space-y-1 text-sm flex-1">
                <p className="font-semibold text-foreground">Need a fresh invitation link?</p>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  For your child&apos;s privacy and security, invitation links expire after 48 hours. Please ask your child&apos;s teacher to send a new invite to your email.
                </p>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-2.5 border-t border-border/60 bg-muted/20 px-6 py-4">
          <Button
            onClick={() => router.push("/login")}
            className="w-full h-10 font-medium text-sm"
          >
            <LogInIcon className="size-4 mr-2" aria-hidden="true" />
            Sign In to Parent Portal
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="w-full h-10 font-medium text-sm text-muted-foreground hover:text-foreground"
          >
            Return to Homepage
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-warm backdrop-blur-xs transition-all duration-200">
      <CardHeader className="space-y-3 text-center pb-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-warm-sm ring-4 ring-brand-100/70">
          <BrandIcon className="size-6" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome to Write<span className="text-primary">Wise</span>
          </h1>
          <CardDescription className="mt-1 text-xs text-muted-foreground">
            Set your password to activate your parent portal account.
          </CardDescription>
        </div>
        {userEmail && (
          <div className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-950 px-3 py-1 text-xs font-medium text-brand-800 dark:text-brand-300 border border-brand-200/80 dark:border-brand-900 mx-auto">
            <CheckCircle2Icon className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
            <span className="truncate max-w-[260px]">{userEmail}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="grid gap-4">
          {formError && (
            <Alert variant="destructive" className="[&>svg]:translate-y-0">
              <CircleAlertIcon aria-hidden="true" />
              <AlertDescription className="text-xs leading-normal">{formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="password" className="text-xs font-semibold text-foreground">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isSubmitting}
                className="h-10 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isSubmitting}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="text-muted-foreground hover:text-foreground absolute right-1 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-md p-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <Label htmlFor="confirm-password" className="text-xs font-semibold text-foreground">
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={isSubmitting}
                className="h-10 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                disabled={isSubmitting}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="text-muted-foreground hover:text-foreground absolute right-1 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-md p-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            type="submit"
            size="lg"
            className="mt-2 h-10 w-full font-medium transition-all duration-150"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner className="mr-2 size-4" />
                Setting password…
              </>
            ) : (
              <>
                <LockIcon className="mr-2 size-4" />
                Set Password & View Progress
                <ArrowRightIcon className="ml-2 size-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col items-center justify-center border-t border-border/60 bg-muted/20 px-6 py-3.5 text-center text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <HelpCircleIcon className="size-3.5 text-muted-foreground/80 shrink-0" aria-hidden="true" />
          <span>WriteWise Parent Portal</span>
        </div>
      </CardFooter>
    </Card>
  );
}

/**
 * Atmospheric handwriting guidelines background (matching login page theme)
 */
function HandwritingGuidelineBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none"
    >
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 size-[720px] rounded-full bg-brand-100/60 blur-3xl opacity-80 dark:bg-brand-900/25" />
      <svg
        className="absolute inset-0 size-full stroke-brand-700/10 dark:stroke-brand-200/8 [mask-image:radial-gradient(ellipse_at_center,white_35%,transparent_80%)]"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="cursive-ruled-lines"
            width="120"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <line x1="10" y1="80" x2="42" y2="0" strokeWidth="0.75" strokeDasharray="3 6" opacity="0.6" />
            <line x1="70" y1="80" x2="102" y2="0" strokeWidth="0.75" strokeDasharray="3 6" opacity="0.6" />
            <line x1="0" y1="16" x2="120" y2="16" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="0" y1="36" x2="120" y2="36" strokeWidth="1" strokeDasharray="5 4" />
            <line x1="0" y1="56" x2="120" y2="56" strokeWidth="1.25" />
            <line x1="0" y1="76" x2="120" y2="76" strokeWidth="0.75" strokeDasharray="2 3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cursive-ruled-lines)" />
      </svg>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-8 antialiased">
      <HandwritingGuidelineBackground />
      <Suspense fallback={<Spinner className="size-8 text-primary" />}>
        <AcceptInviteForm />
      </Suspense>
    </main>
  );
}

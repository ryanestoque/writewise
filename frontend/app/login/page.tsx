"use client";

import { useState, useMemo, Suspense } from "react";
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
  HelpCircleIcon,
  ArrowRightIcon,
  SchoolIcon,
} from "lucide-react";

function ForgotPasswordDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center -my-2 min-h-[36px] px-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
          >
            Forgot password?
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground font-heading">
            Password Assistance
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            WriteWise accounts are pre-provisioned for the Matina Aplaya Elementary School research pilot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-xl border border-border/80 bg-muted/40 p-4 text-xs text-foreground">
          <div className="flex items-start gap-2.5">
            <SchoolIcon className="size-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">For Teachers & Staff:</p>
              <p className="text-muted-foreground">
                Please contact your Grade 3 Department Lead or school IT coordinator to reset your credentials.
              </p>
            </div>
          </div>
          <div className="border-t border-border/60 pt-2.5">
            <div className="flex items-start gap-2.5">
              <HelpCircleIcon className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">For Parents:</p>
                <p className="text-muted-foreground">
                  Reach out to your child&apos;s class adviser or teacher coordinator to verify your registered parent email.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter showCloseButton={false}>
          <DialogClose render={<Button variant="outline" size="sm" className="w-full sm:w-auto">Understood</Button>} />
        </DialogFooter>
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

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const missingRoleError =
    searchParams.get("error") === "missing_role"
      ? "Your account is missing a role assignment. Please contact your school administrator or coordinator."
      : null;
  const error = formError ?? missingRoleError;

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
        if (
          authError.code === "invalid_credentials" ||
          authError.message === "Invalid login credentials"
        ) {
          setFormError("Invalid email or password.");
        } else {
          setFormError("Something went wrong. Please try again.");
        }
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
      <CardHeader className="space-y-3 text-center pb-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-warm-sm ring-4 ring-brand-100/70">
          <BrandIcon className="size-6" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Write<span className="text-primary">Wise</span>
          </h1>
          <CardDescription className="mt-1 text-sm text-muted-foreground">
            Cursive Handwriting Assessment Portal
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate={false}>
          {error && (
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
              <ForgotPasswordDialog />
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
        <div className="flex items-center gap-1.5">
          <HelpCircleIcon className="size-3.5 text-muted-foreground/80 shrink-0" aria-hidden="true" />
          <span>
            Need account access? Contact your school coordinator.
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}

/**
 * Atmospheric handwriting guidelines background:
 * Evokes authentic ruled cursive notebook lines (ascender, midline, baseline, descender)
 * along with subtle 68° slant guidelines reminiscent of cursive practice sheets.
 */
function HandwritingGuidelineBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none"
    >
      {/* Soft warm radial ambient glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 size-[720px] rounded-full bg-brand-100/60 blur-3xl opacity-80 dark:bg-brand-900/25" />

      {/* Handwriting ruled guide lines & slant pattern */}
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
            {/* Cursive 68-degree slant guide */}
            <line x1="10" y1="80" x2="42" y2="0" strokeWidth="0.75" strokeDasharray="3 6" opacity="0.6" />
            <line x1="70" y1="80" x2="102" y2="0" strokeWidth="0.75" strokeDasharray="3 6" opacity="0.6" />

            {/* Top ascender line */}
            <line x1="0" y1="16" x2="120" y2="16" strokeWidth="1" strokeDasharray="3 3" />
            {/* Midline / x-height */}
            <line x1="0" y1="36" x2="120" y2="36" strokeWidth="1" strokeDasharray="5 4" />
            {/* Baseline */}
            <line x1="0" y1="56" x2="120" y2="56" strokeWidth="1.25" />
            {/* Descender line */}
            <line x1="0" y1="76" x2="120" y2="76" strokeWidth="0.75" strokeDasharray="2 3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cursive-ruled-lines)" />
      </svg>
    </div>
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

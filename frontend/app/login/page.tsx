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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  PenToolIcon,
} from "lucide-react";

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
      ? "Your account is missing a role assignment. Please contact an administrator."
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
        if (authError.message === "Invalid login credentials") {
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
    <Card className="w-full max-w-sm shadow-warm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
          <PenToolIcon className="size-5" aria-hidden="true" />
        </div>
        <CardTitle className="font-heading text-2xl font-bold tracking-tight text-primary">
          <h1>WriteWise</h1>
        </CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate={false}>
          {error && (
            <Alert variant="destructive" id="login-error">
              <CircleAlertIcon aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
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
              disabled={isLoading}
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
              className="h-10"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
                className="h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isLoading}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none"
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
            className="h-10 w-full font-medium"
            disabled={isLoading}
          >
            {isLoading ? <Spinner className="mr-2" /> : null}
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense fallback={<Spinner className="size-8 text-primary" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

"use client";

import { useState, Suspense } from "react";
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
import { CircleAlertIcon } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

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
        email,
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
    <Card className="w-full max-w-sm shadow-[var(--shadow-warm)]">
      <CardHeader className="text-center">
        <CardTitle className="font-heading text-2xl text-primary">
          WriteWise
        </CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {error && (
            <Alert variant="destructive" id="login-error">
              <CircleAlertIcon />
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
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          <Button
            id="login-submit"
            type="submit"
            className="w-full"
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense fallback={<Spinner className="size-8 text-primary" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

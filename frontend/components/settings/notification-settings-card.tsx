"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ApiError } from "@/lib/utils/api-error";
import {
  readEmailPreference,
  saveEmailPreference,
  type PreferenceRole,
} from "@/lib/notifications/preferences";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

interface NotificationSettingsCardProps {
  accountId: string;
  role: PreferenceRole;
  initialEnabled: boolean | null;
}

export function NotificationSettingsCard({
  accountId,
  role,
  initialEnabled,
}: NotificationSettingsCardProps) {
  const [supabase] = useState(createClient);
  const router = useRouter();
  const headingId = useId();
  const controlId = useId();
  const descriptionId = useId();
  const [savedEnabled, setSavedEnabled] = useState(initialEnabled);
  const [draftEnabled, setDraftEnabled] = useState(initialEnabled);
  const [isLoading, setIsLoading] = useState(initialEnabled === null);
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const saving = useRef(false);

  const beginRequest = useCallback(() => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    return { controller, id: ++generation.current };
  }, []);

  const load = useCallback(async () => {
    const { controller, id } = beginRequest();
    try {
      const value = await readEmailPreference(supabase, accountId, role, controller.signal);
      if (controller.signal.aborted || generation.current !== id) return;
      setSavedEnabled(value);
      setDraftEnabled(value);
      setFailure(null);
    } catch (error) {
      if (controller.signal.aborted || generation.current !== id) return;
      setFailure(
        error instanceof ApiError && error.code === "UNAUTHORIZED"
          ? "Sign in again to update email settings."
          : "We couldn't load your email settings. Please try again."
      );
    } finally {
      if (!controller.signal.aborted && generation.current === id) setIsLoading(false);
    }
  }, [accountId, beginRequest, role, supabase]);

  useEffect(() => {
    if (initialEnabled === null) {
      const { controller, id } = beginRequest();
      void readEmailPreference(supabase, accountId, role, controller.signal)
        .then((value) => {
          if (controller.signal.aborted || generation.current !== id) return;
          setSavedEnabled(value);
          setDraftEnabled(value);
          setFailure(null);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || generation.current !== id) return;
          setFailure(
            error instanceof ApiError && error.code === "UNAUTHORIZED"
              ? "Sign in again to update email settings."
              : "We couldn't load your email settings. Please try again."
          );
        })
        .finally(() => {
          if (!controller.signal.aborted && generation.current === id) setIsLoading(false);
        });
    }
    return () => {
      generation.current += 1;
      pending.current?.abort();
    };
  }, [accountId, beginRequest, initialEnabled, role, supabase]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id === accountId) return;
      generation.current += 1;
      pending.current?.abort();
      saving.current = false;
      setIsSaving(false);
      setIsLoading(false);
      setSavedEnabled(null);
      setDraftEnabled(null);
      setSavedMessage(false);
      setFailure("Sign in again to update email settings.");
    });
    return () => subscription.unsubscribe();
  }, [accountId, supabase]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || isLoading || draftEnabled === null || draftEnabled === savedEnabled)
      return;
    saving.current = true;
    setIsSaving(true);
    setFailure(null);
    setSavedMessage(false);
    const { controller, id } = beginRequest();
    try {
      const value = await saveEmailPreference(
        supabase,
        accountId,
        role,
        draftEnabled,
        controller.signal
      );
      if (controller.signal.aborted || generation.current !== id) return;
      setSavedEnabled(value);
      setDraftEnabled(value);
      setSavedMessage(true);
      router.refresh();
    } catch (error) {
      if (controller.signal.aborted || generation.current !== id) return;
      setDraftEnabled(savedEnabled);
      setFailure(
        error instanceof ApiError && error.code === "UNAUTHORIZED"
          ? "Sign in again to update email settings."
          : "We couldn't confirm the update. Reload settings and try again."
      );
    } finally {
      if (!controller.signal.aborted && generation.current === id) {
        saving.current = false;
        setIsSaving(false);
      }
    }
  }

  const busy = isLoading || isSaving;
  return (
    <section
      aria-labelledby={headingId}
      className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]"
    >
      <h2 id={headingId} className="font-heading text-lg font-semibold">
        Notifications
      </h2>
      <Card>
        <form onSubmit={save} aria-busy={busy} className="flex flex-col gap-6">
          <CardHeader>
            <CardTitle as="h3">Email updates</CardTitle>
            <CardDescription>Manage your classroom email preferences.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {isLoading ? (
              <div role="status" className="flex flex-col gap-2">
                <span>Loading email settings…</span>
                <Skeleton className="h-5 w-40" aria-hidden="true" />
              </div>
            ) : draftEnabled !== null ? (
              <FieldGroup>
                <Field orientation="horizontal" data-disabled={busy}>
                  <FieldContent>
                    <FieldLabel htmlFor={controlId}>Email me</FieldLabel>
                    <FieldDescription id={descriptionId}>
                      {role === "parent"
                        ? "Get email when work needs another attempt or an activity is due soon. In-app notifications stay on."
                        : "Classroom emails currently go to parents. Your in-app notifications stay on."}
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id={controlId}
                    checked={draftEnabled}
                    disabled={busy}
                    aria-describedby={descriptionId}
                    onCheckedChange={(value) => {
                      setDraftEnabled(value);
                      setFailure(null);
                      setSavedMessage(false);
                    }}
                  />
                </Field>
              </FieldGroup>
            ) : null}
            {failure && (
              <Alert variant="destructive">
                <AlertTitle>Email settings need attention</AlertTitle>
                <AlertDescription>{failure}</AlertDescription>
              </Alert>
            )}
            {savedMessage && (
              <p role="status" className="text-muted-foreground">
                Email settings saved.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setIsLoading(true);
                setFailure(null);
                setSavedMessage(false);
                void load();
              }}
            >
              Reload settings
            </Button>
            <Button
              type="submit"
              disabled={busy || draftEnabled === null || draftEnabled === savedEnabled}
            >
              {isSaving && (
                <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" />
              )}
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}

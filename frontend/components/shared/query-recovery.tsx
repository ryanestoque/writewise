"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface QueryRecoveryProps {
  title: string;
  description: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export function QueryRecovery({
  title,
  description,
  onRetry,
  isRetrying = false,
}: QueryRecoveryProps) {
  return (
    <Alert>
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <div className="flex flex-col items-start gap-3">
          <p className="max-w-prose">{description}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-10 sm:min-h-9"
            disabled={isRetrying}
            onClick={onRetry}
          >
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            {isRetrying ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

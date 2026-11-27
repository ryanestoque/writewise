import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | undefined {
  return EMAIL_REGEX.test(value.trim())
    ? undefined
    : "Enter a valid email address.";
}

export function validateFullName(value: string): string | undefined {
  return value.trim() ? undefined : "Enter your full name.";
}

export function validateRequiredPassword(value: string): string | undefined {
  return value ? undefined : "Enter your password.";
}

export function validateNewPassword(value: string): string | undefined {
  return value.length >= MIN_PASSWORD_LENGTH
    ? undefined
    : `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
}

export function isRateLimitAuthError(error: {
  status?: number;
  code?: string;
}): boolean {
  return (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit" ||
    error.code === "rate_limit_exceeded"
  );
}

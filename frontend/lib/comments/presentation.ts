import { ApiError } from "@/lib/utils/api-error";

export function commentFeedback(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "UNAUTHORIZED":
        return "Sign in again to continue.";
      case "NOT_FOUND":
        return "This conversation is no longer available.";
      case "ACTIVITY_NOT_ASSIGNED":
        return "This activity is no longer assigned. Your conversation stays readable.";
      case "ACTIVITY_ARCHIVED":
        return "This activity is archived. Your conversation stays readable.";
      case "COMMENTS_LOCKED":
        return "The teacher has locked this conversation.";
      case "VALIDATION_ERROR":
        return "Write a comment between 1 and 1000 characters.";
    }
  }
  return "Could not update the conversation. Try again.";
}

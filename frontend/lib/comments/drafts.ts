const MAX_DRAFT_ENTRIES = 100;
const drafts = new Map<string, string>();

export function buildCommentDraftKey(userId: string, submissionId: string): string {
  return `${userId}:${submissionId}`;
}

export function getCommentDraft(draftKey?: string): string {
  if (!draftKey) return "";
  return drafts.get(draftKey) ?? "";
}

export function hasCommentDraft(draftKey?: string): boolean {
  return getCommentDraft(draftKey).trim().length > 0;
}

export function setCommentDraft(draftKey: string | undefined, value: string): void {
  if (!draftKey) return;
  if (!value) {
    drafts.delete(draftKey);
    return;
  }
  if (drafts.has(draftKey)) {
    drafts.delete(draftKey);
  } else if (drafts.size >= MAX_DRAFT_ENTRIES) {
    const oldestKey = drafts.keys().next().value;
    if (oldestKey !== undefined) drafts.delete(oldestKey);
  }
  drafts.set(draftKey, value);
}

export function clearCommentDraft(draftKey?: string): void {
  if (!draftKey) return;
  drafts.delete(draftKey);
}

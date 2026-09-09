export interface MailtoInput {
  to: string;
  cc?: string[];
  subject: string;
}

/**
 * mailto: links can only carry plain-text fields (To/CC/Subject) — the
 * RFC does not support HTML or embedded images in the body, and most mail
 * clients cap the total URL length well below what a formatted email with
 * an inline eCard image needs. So this only opens the compose window with
 * recipient/CC/subject ready; the rich HTML body must be copied
 * separately (see richClipboard.ts) and pasted in with Ctrl+V.
 */
export function buildMailtoUrl({ to, cc, subject }: MailtoInput): string {
  const params = new URLSearchParams();
  if (cc && cc.length > 0) params.set('cc', cc.join(','));
  params.set('subject', subject);
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

export function openMailto(input: MailtoInput): void {
  window.location.href = buildMailtoUrl(input);
}

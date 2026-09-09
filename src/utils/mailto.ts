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
 *
 * Built by hand (not URLSearchParams) because URLSearchParams encodes
 * spaces as "+" — application/x-www-form-urlencoded convention — but the
 * mailto: URI scheme expects standard percent-encoding ("%20"). Outlook
 * does not decode "+" back to a space, so a subject built with
 * URLSearchParams shows up literally as "Happy+Birthday+to+...".
 */
export function buildMailtoUrl({ to, cc, subject }: MailtoInput): string {
  const parts: string[] = [];
  if (cc && cc.length > 0) parts.push(`cc=${encodeURIComponent(cc.join(','))}`);
  parts.push(`subject=${encodeURIComponent(subject)}`);
  return `mailto:${encodeURIComponent(to)}?${parts.join('&')}`;
}

export function openMailto(input: MailtoInput): void {
  window.location.href = buildMailtoUrl(input);
}

/**
 * Copies HTML to the clipboard as genuine rich text (text/html MIME type),
 * not as a plain-text string of HTML source. This is the difference
 * between:
 *   - navigator.clipboard.writeText(html) → pasting into Outlook inserts
 *     the literal "<table><tr><td>..." tags as visible text.
 *   - this function → pasting into Outlook renders the actual formatting
 *     (fonts, colors, spacing), exactly like copying from a web page.
 *
 * Falls back to plain-text copy if the browser/context doesn't support
 * the rich Clipboard API (e.g. non-HTTPS, older browsers).
 */
export async function copyRichHtml(html: string): Promise<boolean> {
  const plainText = htmlToPlainText(html);

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      // fall through to plain-text fallback below
    }
  }

  try {
    await navigator.clipboard.writeText(html);
    return false; // copied, but only as plain HTML source (formatting will NOT be preserved)
  } catch {
    return false;
  }
}

function htmlToPlainText(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container.textContent ?? container.innerText ?? '';
}

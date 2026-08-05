import type { Customer, Signature, TemplateVersion } from '../../types/entities';
import type { Language } from '../../config/constants';
import { FONTS } from '../../config/constants';
import { buildPlaceholderMap, renderPlaceholders } from '../../utils/placeholderEngine';
import { generatedEmailRepository } from '../../data/repositories/HistoryRepository';

/**
 * Wraps rendered body content in an Outlook-Desktop-safe HTML shell:
 * table layout only, inline CSS only, no flexbox/grid/CSS variables
 * (see 00_CLAUDE_INSTRUCTIONS.md §15).
 */
function wrapOutlookSafeHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONTS.emailBody};font-size:${FONTS.emailBodySize};color:#1a1a1a;">
        <tr><td style="padding:24px;">${bodyHtml}</td></tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export function renderEmail(
  version: TemplateVersion,
  customer: Customer,
  language: Language,
  signature?: Signature | null,
  cardHtml?: string
): RenderedEmail {
  const map = buildPlaceholderMap({ customer, language, signature, cardHtml });
  const subjectSource = language === 'vi' ? version.subjectVi : version.subjectEn;
  const bodySource = language === 'vi' ? version.bodyVi : version.bodyEn;

  let bodyRendered = renderPlaceholders(bodySource, map);

  // If the template doesn't explicitly place {{CARD}} / {{SIGNATURE}}
  // anywhere, auto-append them below the content so the email is ready to
  // copy straight into Outlook — image + signature always included.
  const hasCardToken = /\{\{\s*CARD\s*\}\}/.test(bodySource);
  const hasSignatureToken = /\{\{\s*SIGNATURE\s*\}\}/.test(bodySource);

  if (!hasCardToken && cardHtml) {
    bodyRendered += `<div style="margin-top:28px;">${cardHtml}</div>`;
  }
  if (!hasSignatureToken && signature?.htmlContent) {
    bodyRendered += `<div style="margin-top:28px;">${signature.htmlContent}</div>`;
  }

  return {
    subject: renderPlaceholders(subjectSource, map),
    html: wrapOutlookSafeHtml(bodyRendered),
  };
}

export const emailGeneratorService = {
  render: renderEmail,

  async recordHistory(params: {
    customer: Customer;
    language: Language;
    templateId: string;
    generatedContent: string;
  }) {
    return generatedEmailRepository.create({
      customerId: params.customer.id,
      customerName: params.customer.fullName,
      gender: params.customer.gender,
      language: params.language,
      templateId: params.templateId,
      generatedContent: params.generatedContent,
    });
  },
};

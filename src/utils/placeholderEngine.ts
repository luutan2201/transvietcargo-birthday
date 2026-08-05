import type { Customer, Signature } from '../types/entities';
import type { Language } from '../config/constants';

/** Replaces {{PLACEHOLDER}} tokens with real customer/context data. Never
 * hardcode customer info elsewhere — always go through this engine. */
export interface PlaceholderContext {
  customer: Customer;
  language: Language;
  signature?: Signature | null;
  cardHtml?: string;
}

function getPronoun(gender: Customer['gender'], language: Language): string {
  if (language === 'vi') return gender === 'male' ? 'Anh' : gender === 'female' ? 'Chị' : 'Quý khách';
  return gender === 'male' ? 'Mr.' : gender === 'female' ? 'Ms.' : '';
}

export function buildPlaceholderMap(ctx: PlaceholderContext): Record<string, string> {
  const { customer, language, signature, cardHtml } = ctx;
  const now = new Date();

  return {
    FULL_NAME: customer.fullName,
    FIRST_NAME: customer.firstName,
    LAST_NAME: customer.lastName,
    TITLE: customer.title ?? '',
    EMAIL: customer.email,
    COMPANY: customer.company ?? '',
    POSITION: customer.position ?? '',
    CURRENT_DATE: now.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US'),
    CURRENT_YEAR: String(now.getFullYear()),
    SIGNATURE: signature?.htmlContent ?? '',
    CARD: cardHtml ?? '',
    LANGUAGE: language,
    PRONOUN: getPronoun(customer.gender, language),
  };
}

/** Replaces every {{KEY}} occurrence in `text` using the given map. Unknown
 * keys are left untouched (safer than silently dropping them). */
export function renderPlaceholders(text: string, map: Record<string, string>): string {
  return text.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : match;
  });
}

// Core domain entities.
import type { Language } from '../config/constants';

export type Gender = 'male' | 'female' | 'unknown';
export type UserRole = 'admin' | 'manager' | 'user';
export type TemplateCategory =
  | 'birthday'
  | 'christmas'
  | 'new_year'
  | 'mid_autumn'
  | 'anniversary'
  | 'promotion'
  | 'thank_you';

/** ecard_only: chỉ gửi email chúc mừng. gift_visit: gửi email + tặng quà trực tiếp. */
export type GreetingType = 'ecard_only' | 'gift_visit';
export type Station = 'SGN' | 'HAN';

interface BaseEntity {
  id: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Customer extends BaseEntity {
  fullName: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  email: string;
  company?: string;
  position?: string;
  title?: string;
  language: Language;
  status: 'active' | 'inactive';
  notes?: string;
  /** ISO date "YYYY-MM-DD". Year may be a placeholder if unknown — month/day is what drives birthday campaigns. */
  birthDate?: string;
  greetingType: GreetingType;
  station: Station;
  /** Only meaningful when greetingType === 'gift_visit'. Sales team edits this after the initial suggestion. */
  giftSuggestion?: string;
  /** Estimated/allocated budget for the gift, in the company's local currency. Only meaningful when greetingType === 'gift_visit'. */
  giftBudget?: number;
  /** Marked true once the eCard/email has been sent for the current campaign cycle. */
  ecardSent: boolean;
  /** Marked true once the physical gift has been delivered. Only relevant for gift_visit customers. */
  giftGiven: boolean;
}

export interface TemplateVersion {
  versionNumber: number;
  createdAt: string;
  status: 'draft' | 'published' | 'archived';
  subjectVi: string;
  subjectEn: string;
  bodyVi: string;
  bodyEn: string;
}

export interface Template extends BaseEntity {
  name: string;
  category: TemplateCategory;
  currentVersion: number;
  versions: TemplateVersion[];
  signatureId?: string;
}

export interface Signature extends BaseEntity {
  name: string;
  htmlContent: string;
  isDefault: boolean;
  versionNumber: number;
}

export interface HistoryRecord extends BaseEntity {
  type: 'email' | 'card';
  customerId: string;
  customerName: string;
  gender: Gender;
  language: Language;
  templateId: string;
  generatedContent?: string;
}

/** Text alignment relative to the calibrated (xPercent, yPercent) anchor point. */
export type TextAlign = 'left' | 'center' | 'right';

/**
 * A reusable, pre-calibrated eCard background: a PNG (stored in Supabase
 * Storage) plus exactly where/how the customer's name (and optionally a
 * message paragraph) should be drawn onto it. Saved once by an
 * admin/manager, then reused for every customer of that gender without
 * re-uploading or re-positioning each time.
 */
export interface CardTemplate extends BaseEntity {
  name: string;
  gender: 'male' | 'female';
  /** Anchor position as a percentage (0-100) of image width/height — stays
   * correct regardless of how the image is later resized/rendered. */
  namePosition: { xPercent: number; yPercent: number };
  font: {
    family: string;
    sizePx: number;
    color: string; // hex
    align: TextAlign;
    bold?: boolean;
    italic?: boolean;
  };
  /** Optional message paragraph block (e.g. the birthday wishes text).
   * `text` may contain placeholders ({{FULL_NAME}}, {{PRONOUN}}, …) and
   * literal newlines — newlines are rendered exactly as typed, never
   * auto-reflowed, so manually-formatted copy stays intact. */
  messageBox?: {
    text: string;
    xPercent: number;
    yPercent: number;
    lineHeightPx: number;
    font: {
      family: string;
      sizePx: number;
      color: string;
      align: TextAlign;
      bold?: boolean;
      italic?: boolean;
    };
  };
  isDefault: boolean;
}

/** A logged-in team member. Backed by Supabase Auth (auth.users) + a
 * `profiles` row for app-specific fields — there is no local password
 * storage; Supabase handles authentication. */
export interface Profile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

// Design tokens & app-wide constants — single source of truth (see 04_UI_DESIGN_SYSTEM.md)

export const COLORS = {
  primary: '#147E93',
  secondary: '#1CA3BC',
  accent: '#FCCB8A',
  success: '#4CAF50',
  warning: '#FFC107',
  danger: '#F44336',
  backgroundLight: '#EAF6F8',
  glassWhite: 'rgba(255, 255, 255, 0.6)',
} as const;

export const FONTS = {
  app: `'Segoe UI', 'San Francisco', Arial, sans-serif`,
  emailBody: `'Times New Roman', serif`,
  emailBodySize: '13pt',
  cardMale: { family: 'Arial', size: '28px' },
  cardFemale: { family: 'Arial', size: '21px' },
  cardTextColor: '#FCCC8A',
  cardNameColor: '#FF0000',
} as const;

export const SUPPORTED_LANGUAGES = ['vi', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const PLACEHOLDER_KEYS = [
  'FULL_NAME',
  'TITLE',
  'FIRST_NAME',
  'LAST_NAME',
  'EMAIL',
  'COMPANY',
  'POSITION',
  'CURRENT_DATE',
  'CURRENT_YEAR',
  'SIGNATURE',
  'CARD',
  'LANGUAGE',
  'PRONOUN',
] as const;
export type PlaceholderKey = (typeof PLACEHOLDER_KEYS)[number];

export const MAX_SIGNATURE_VERSIONS = 5;
export const MIN_APP_RESOLUTION = { width: 1366, height: 768 };

export const APP_NAME = 'TransViet Cargo Email Campaign Studio';

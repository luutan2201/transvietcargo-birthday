import * as XLSX from 'xlsx';
import type { Customer, GreetingType, Station } from '../types/entities';

export interface ImportRow {
  fullName: string;
  gender: Customer['gender'];
  email: string;
  company?: string;
  position?: string;
  birthDate?: string; // YYYY-MM-DD
  station?: Station;
  greetingType?: GreetingType;
  giftSuggestion?: string;
  /** Raw, unparsed Birthday cell value — kept for the import preview so
   * users can see exactly what was in the source cell vs. what was parsed. */
  rawBirthday?: string;
}

export interface ImportResult {
  valid: ImportRow[];
  errors: Array<{ row: number; reason: string }>;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  fullName: ['full name', 'fullname', 'họ tên', 'ho ten', 'name'],
  gender: ['gender', 'giới tính', 'gioi tinh'],
  email: ['email', 'e-mail'],
  company: ['company', 'công ty', 'cong ty'],
  position: ['position', 'chức vụ', 'chuc vu', 'title'],
  birthDate: ['birthday', 'birth date', 'date of birth', 'ngày sinh', 'ngay sinh', 'dob'],
  station: ['station', 'trạm', 'tram'],
  greetingType: ['type', 'greeting type', 'loại', 'loai', 'loại chúc mừng'],
  giftSuggestion: ['gift suggestion', 'gift', 'gợi ý quà', 'goi y qua'],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

/** Recognizes 3 input formats: M/F, Nam/Nữ, Male/Female (case-insensitive,
 * tolerant of stray whitespace/periods and Vietnamese diacritic variants). */
function mapGender(raw: unknown): Customer['gender'] {
  const v = String(raw ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  if (['male', 'nam', 'm', 'mr', 'anh', 'nam giới', 'nam gioi'].includes(v)) return 'male';
  if (['female', 'nữ', 'nu', 'f', 'ms', 'chị', 'chi', 'nữ giới', 'nu gioi'].includes(v)) return 'female';
  return 'unknown';
}

function mapStation(raw: unknown): Station | undefined {
  const v = String(raw ?? '').trim().toUpperCase();
  if (v === 'SGN' || v === 'HAN') return v;
  return undefined;
}

function mapGreetingType(raw: unknown): GreetingType | undefined {
  const v = String(raw ?? '').trim().toLowerCase();
  if (['gift_visit', 'gift visit', 'gift', 'quà', 'qua'].includes(v)) return 'gift_visit';
  if (['ecard_only', 'ecard only', 'ecard', 'email only', 'email'].includes(v)) return 'ecard_only';
  return undefined;
}

/** Parses an Excel serial date number (days since 1899-12-30) into YYYY-MM-DD. */
function excelSerialToIsoDate(serial: number): string {
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(epoch.getTime() + serial * 86400000);
  return date.toISOString().slice(0, 10);
}

const VN_MONTH_PATTERN = /^(\d{1,2})[\s-]*(?:thg|tháng|th)\.?\s*(\d{1,2})$/i;

/** Birthdays commonly arrive in several mixed formats in real spreadsheets:
 * genuine Excel date cells (JS Date, when read with cellDates:true), plain
 * Excel serial numbers, Vietnamese abbreviated text ("14-thg 5" = 14 May),
 * and DD/MM or DD/MM/YYYY text. Year is a placeholder when absent — only
 * month/day drives the birthday-month filter, so an inexact year is fine. */
function mapBirthDate(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;

  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof raw === 'number') return excelSerialToIsoDate(raw);

  const str = String(raw).trim();

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return str;

  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const dmMatch = str.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (dmMatch) {
    const [, d, m] = dmMatch;
    return `1900-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Vietnamese abbreviated format, e.g. "14-thg 5", "1-thg 12", "14 tháng 5".
  const vnMatch = str.match(VN_MONTH_PATTERN);
  if (vnMatch) {
    const [, d, m] = vnMatch;
    return `1900-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return undefined;
}

/** Reads xlsx/xls/csv, matches columns by alias (case-insensitive, ignores
 * unknown columns), and returns validated rows + per-row error messages. */
export async function parseCustomerFile(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const valid: ImportRow[] = [];
  const errors: ImportResult['errors'] = [];

  rows.forEach((row, idx) => {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
      const nKey = normalizeHeader(key);
      for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (aliases.includes(nKey)) normalized[field] = row[key];
      }
    }

    const fullName = String(normalized.fullName ?? '').trim();
    const email = String(normalized.email ?? '').trim();

    if (!fullName) {
      errors.push({ row: idx + 2, reason: 'Missing full name' });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: idx + 2, reason: 'Missing or invalid email' });
      return;
    }

    valid.push({
      fullName,
      email,
      gender: mapGender(normalized.gender),
      company: normalized.company ? String(normalized.company) : undefined,
      position: normalized.position ? String(normalized.position) : undefined,
      birthDate: mapBirthDate(normalized.birthDate),
      station: mapStation(normalized.station),
      greetingType: mapGreetingType(normalized.greetingType),
      giftSuggestion: normalized.giftSuggestion ? String(normalized.giftSuggestion) : undefined,
      rawBirthday: normalized.birthDate !== undefined && normalized.birthDate !== '' ? String(normalized.birthDate) : undefined,
    });
  });

  return { valid, errors };
}

// Đọc lại file rà soát (đã có cột CHỐT của sếp) để tạo danh sách năm sau.
import * as XLSX from 'xlsx';
import type { Station } from '../types/entities';
import { mapBirthDate, mapGender, mapStation, parseBudget, type ImportRow } from './excelImport';
import { resolveDecision, type ReviewImportRow, type SheetKind } from './yearReview';

export interface ReviewParseResult {
  /** false = không phải file rà soát (không có cột CHỐT) → dùng bộ đọc Excel thông thường. */
  isReviewFile: boolean;
  rows: ReviewImportRow[];
  errors: Array<{ sheet: string; row: number; reason: string }>;
  /** Năm trong tiêu đề cột "CHỐT 2027" và "Quà 2026". */
  targetYear?: number;
  fromYear?: number;
  sheets: string[];
}

const norm = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const text = (v: unknown): string => String(v ?? '').trim();

function detectStation(title: string, sheetName: string): Station | undefined {
  const t = title.match(/-\s*(SGN|HAN|DAD)\b/i)?.[1] ?? sheetName.match(/\b(SGN|HAN|DAD)\b/i)?.[1];
  return mapStation(t);
}

export function parseReviewWorkbook(buffer: ArrayBuffer): ReviewParseResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const result: ReviewParseResult = { isReviewFile: false, rows: [], errors: [], sheets: [] };

  for (const name of wb.SheetNames) {
    const aoa: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true });
    const headerIdx = aoa.slice(0, 12).findIndex((r) => norm(r[0]) === 'stt');
    if (headerIdx < 0) continue;
    const headers = aoa[headerIdx].map(norm);
    const find = (pred: (h: string) => boolean): number => headers.findIndex(pred);
    const col = {
      company: find((h) => h === 'company'),
      name: find((h) => h === 'name'),
      gender: find((h) => h === 'gender'),
      position: find((h) => h === 'position'),
      email: find((h) => h === 'email'),
      birthday: find((h) => h.startsWith('birthday')),
      gift: find((h) => h.startsWith('quà')),
      budget: find((h) => h.startsWith('budget')),
      pic: find((h) => h === 'pic'),
      proposal: find((h) => h.startsWith('đề xuất')),
      chot: find((h) => h.startsWith('chốt')),
    };
    if (col.chot < 0 || col.email < 0 || col.name < 0) continue;

    result.isReviewFile = true;
    result.sheets.push(name);
    const year = (i: number): number | undefined => Number(headers[i]?.match(/\d{4}/)?.[0]) || undefined;
    result.targetYear ??= year(col.chot);
    if (col.gift >= 0) result.fromYear ??= year(col.gift);

    const title = text(aoa[0]?.[0]);
    const station = detectStation(title, name);
    const kind: SheetKind = /ecard/i.test(title) || /^ecard/i.test(name) ? 'ecard' : 'gift';

    aoa.slice(headerIdx + 1).forEach((r, i) => {
      if (r.every((c) => text(c) === '')) return;
      const rowNo = headerIdx + 2 + i;
      const fullName = text(r[col.name]);
      const email = text(r[col.email]);
      if (!fullName) return result.errors.push({ sheet: name, row: rowNo, reason: 'Thiếu họ tên' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return result.errors.push({ sheet: name, row: rowNo, reason: 'Thiếu hoặc sai email' });

      const decision = resolveDecision(kind, text(r[col.chot]), col.proposal >= 0 ? text(r[col.proposal]) : '');
      const birthRaw = col.birthday >= 0 ? r[col.birthday] : '';
      const base: ImportRow = {
        fullName,
        email,
        gender: mapGender(col.gender >= 0 ? r[col.gender] : ''),
        company: text(col.company >= 0 ? r[col.company] : '') || undefined,
        position: text(col.position >= 0 ? r[col.position] : '') || undefined,
        birthDate: mapBirthDate(birthRaw),
        station,
        giftSuggestion: col.gift >= 0 ? text(r[col.gift]) || undefined : undefined,
        giftBudget: col.budget >= 0 ? parseBudget(r[col.budget]) : undefined,
        pic: col.pic >= 0 ? text(r[col.pic]) || undefined : undefined,
        rawBirthday: text(birthRaw) || undefined,
      };
      result.rows.push({ ...base, decision, sheetKind: kind });
    });
  }
  return result;
}

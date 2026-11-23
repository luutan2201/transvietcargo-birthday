// Báo cáo rà soát cuối năm: "Rà soát {năm} & chuẩn bị {năm+1}".
// Toàn bộ logic ở file này là hàm thuần (không đụng DB / Excel) để test được.
import type { Customer, GreetingType, Station } from '../types/entities';
import type { ImportRow } from './excelImport';

export const STATION_ORDER: Station[] = ['SGN', 'HAN', 'DAD'];

/** Quy định mặc định in ở cuối sheet "Tổng hợp" (người dùng sửa được trước khi export). */
export const DEFAULT_RULES: string[] = [
  '• Budget 2 triệu/công ty; công ty có 2 người chia đôi 1 triệu/người, 3 người chia 3.',
  '• Quà ưu tiên: hoa lan chậu; ngoài ra caravat, bánh kem, khăn lụa, bút ký khắc tên…',
  '• Khách tặng quà mặc định được gửi kèm eCard. Sinh nhật vào cuối tuần: xử lý Thứ Sáu trước đó.',
  '• Chi phí: SGN – phòng Commercial; HAN & DAD – Marketing.',
];

export const GIFT_CHOICES = ['Tặng quà', 'Chỉ gửi eCard', 'Không tặng'] as const;
export const ECARD_CHOICES = ['Gửi eCard', 'Chuyển sang tặng quà', 'Không gửi'] as const;
export const NEED_CONFIRM = 'Cần xác nhận';

export type SheetKind = 'gift' | 'ecard';

export interface ReviewRow {
  stt: number;
  company: string;
  name: string;
  gender: string; // "Nam" | "Nữ" | ""
  position: string;
  email: string;
  /** Chỉ ngày/tháng — năm chỉ là giá trị giữ chỗ. null = chưa có ngày sinh. */
  birthday: { month: number; day: number } | null;
  gift: string; // Quà năm báo cáo (chỉ sheet gift)
  budget: number | null;
  pic: string;
  status: string; // "Tặng" | "Không tặng" (chỉ sheet gift)
  note: string;
  proposal: string;
}

export interface ReviewSheet {
  kind: SheetKind;
  station: Station;
  /** Tên tab Excel, ví dụ "SGN" hoặc "Ecard SGN". */
  name: string;
  title: string;
  rows: ReviewRow[];
}

export interface ReviewModel {
  year: number;
  nextYear: number;
  sheets: ReviewSheet[];
}

export function sheetName(kind: SheetKind, station: Station): string {
  return kind === 'gift' ? station : `Ecard ${station}`;
}

function sheetTitle(kind: SheetKind, station: Station): string {
  return `SN KHÁCH HÀNG - ${station} (${kind === 'gift' ? 'GIFT VISIT' : 'ECARD ONLY'})`;
}

export function genderLabel(g: Customer['gender']): string {
  return g === 'male' ? 'Nam' : g === 'female' ? 'Nữ' : '';
}

function parseBirthday(iso?: string): { month: number; day: number } | null {
  if (!iso) return null;
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? { month, day } : null;
}

const birthdayKey = (b: ReviewRow['birthday']): number => (b ? b.month * 100 + b.day : 9999);

/** Những điểm thiếu mà máy phát hiện được (khớp với các ghi chú Marketing hay tự ghi tay). */
export function autoNotes(c: Customer, year: number, kind: SheetKind): string[] {
  const notes: string[] = [];
  if (c.fullName.trim().split(/\s+/).filter(Boolean).length < 2) notes.push('Chưa đủ họ tên – cần bổ sung');
  if (!parseBirthday(c.birthDate)) notes.push('Chưa có ngày sinh – cần bổ sung');
  if (!c.email.trim()) notes.push('Chưa có email – cần bổ sung');
  if (kind === 'gift' && !c.giftGiven) notes.push(`${year} không tặng – cần xác nhận cho ${year + 1}`);
  return notes;
}

export function proposalFor(c: Customer, kind: SheetKind): string {
  if (kind === 'gift') return c.giftGiven ? 'Tặng quà' : NEED_CONFIRM;
  return parseBirthday(c.birthDate) ? 'Gửi eCard' : NEED_CONFIRM;
}

function toRow(c: Customer, year: number, kind: SheetKind): ReviewRow {
  const note = [c.notes?.trim(), ...autoNotes(c, year, kind)].filter(Boolean).join('; ');
  return {
    stt: 0,
    company: c.company ?? '',
    name: c.fullName,
    gender: genderLabel(c.gender),
    position: c.position ?? '',
    email: c.email,
    birthday: parseBirthday(c.birthDate),
    gift: kind === 'gift' ? c.giftSuggestion ?? '' : '',
    budget: kind === 'gift' && c.giftBudget !== undefined ? c.giftBudget : null,
    pic: kind === 'gift' ? c.pic ?? '' : '',
    status: kind === 'gift' ? (c.giftGiven ? 'Tặng' : 'Không tặng') : '',
    note,
    proposal: proposalFor(c, kind),
  };
}

/** Gom danh sách của `year` thành các sheet: Gift theo trạm, eCard theo trạm; sắp theo ngày sinh 1/1 → 31/12. */
export function buildReviewModel(customers: Customer[], year: number): ReviewModel {
  const sheets: ReviewSheet[] = [];
  const live = customers.filter((c) => !c.deletedAt && c.year === year);
  for (const kind of ['gift', 'ecard'] as SheetKind[]) {
    const type: GreetingType = kind === 'gift' ? 'gift_visit' : 'ecard_only';
    for (const station of STATION_ORDER) {
      const rows = live
        .filter((c) => c.greetingType === type && c.station === station)
        .map((c) => toRow(c, year, kind))
        .sort((a, b) =>
          birthdayKey(a.birthday) - birthdayKey(b.birthday)
          || a.company.localeCompare(b.company, 'vi')
          || a.name.localeCompare(b.name, 'vi'));
      if (rows.length === 0) continue;
      rows.forEach((r, i) => { r.stt = i + 1; });
      sheets.push({ kind, station, name: sheetName(kind, station), title: sheetTitle(kind, station), rows });
    }
  }
  return { year, nextYear: year + 1, sheets };
}

/* --------------------------- Nhập danh sách năm sau --------------------------- */

export type Decision = 'gift' | 'ecard' | 'exclude' | 'undecided';

/**
 * Từ cột CHỐT (sếp chọn) và cột Đề xuất (MKT) suy ra khách năm sau thuộc nhóm nào.
 * - CHỐT được ưu tiên. Chưa chốt thì theo Đề xuất; "Cần xác nhận" giữ nguyên nhóm của sheet và đánh dấu chưa chốt.
 */
export function resolveDecision(kind: SheetKind, chot: string, proposal: string): Decision {
  const c = chot.trim().toLowerCase();
  const p = proposal.trim().toLowerCase();
  if (kind === 'gift') {
    if (c === 'tặng quà') return 'gift';
    if (c === 'chỉ gửi ecard' || c === 'không tặng') return 'ecard';
    if (c) return 'undecided';
    if (p === 'tặng quà') return 'gift';
    if (p.startsWith('không')) return 'ecard';
    return 'undecided';
  }
  if (c === 'chuyển sang tặng quà') return 'gift';
  if (c === 'gửi ecard') return 'ecard';
  if (c === 'không gửi') return 'exclude';
  if (c) return 'undecided';
  if (p === 'gửi ecard') return 'ecard';
  if (p.startsWith('không')) return 'exclude';
  return 'undecided';
}

export interface ReviewImportRow extends ImportRow {
  decision: Decision;
  /** Nhóm của sheet gốc — dùng khi chưa chốt. */
  sheetKind: SheetKind;
}

/** Chuyển Decision thành loại gửi; chưa chốt thì giữ nhóm của sheet. null = loại khỏi danh sách. */
export function greetingFromDecision(d: Decision, sheetKind: SheetKind): GreetingType | null {
  if (d === 'exclude') return null;
  if (d === 'gift') return 'gift_visit';
  if (d === 'ecard') return 'ecard_only';
  return sheetKind === 'gift' ? 'gift_visit' : 'ecard_only';
}

/**
 * Tự điền những ô còn trống của dòng import bằng dữ liệu hiện có của năm trước
 * (khớp theo email, không phân biệt hoa thường). Chỉ điền ô trống, không ghi đè.
 */
export function fillFromPrevious(row: ImportRow, prev: Customer | undefined): { row: ImportRow; filled: number } {
  if (!prev) return { row, filled: 0 };
  let filled = 0;
  const pick = <T,>(cur: T | undefined, old: T | undefined, empty: (v: T) => boolean = (v) => v === '' as unknown as T): T | undefined => {
    if (cur !== undefined && !empty(cur)) return cur;
    if (old !== undefined && !empty(old)) { filled++; return old; }
    return cur;
  };
  const out: ImportRow = {
    ...row,
    gender: row.gender !== 'unknown' ? row.gender : (prev.gender !== 'unknown' ? (filled++, prev.gender) : 'unknown'),
    company: pick(row.company, prev.company),
    position: pick(row.position, prev.position),
    birthDate: pick(row.birthDate, prev.birthDate),
    station: row.station ?? prev.station,
    pic: pick(row.pic, prev.pic),
    giftSuggestion: pick(row.giftSuggestion, prev.giftSuggestion),
    giftBudget: row.giftBudget ?? (prev.giftBudget !== undefined ? (filled++, prev.giftBudget) : undefined),
    giftLink: pick(row.giftLink, prev.giftLink),
  };
  return { row: out, filled };
}

/** Sao chép nguyên 1 khách của năm trước thành dòng import cho năm sau (trạng thái đã gửi/đã tặng được đặt lại). */
export function customerToImportRow(c: Customer): ImportRow {
  return {
    fullName: c.fullName,
    gender: c.gender,
    email: c.email,
    company: c.company,
    position: c.position,
    birthDate: c.birthDate,
    station: c.station,
    greetingType: c.greetingType,
    giftSuggestion: c.giftSuggestion,
    giftBudget: c.giftBudget,
    giftLink: c.giftLink,
    pic: c.pic,
  };
}

/** Tên file: 2026NOV23_MKT_COUNTRY_Danh sách sinh nhật KH dự kiến 2027.xlsx */
export function reviewFileName(year: number, today: Date): string {
  const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][today.getMonth()];
  const dd = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}${mon}${dd}_MKT_COUNTRY_Danh sách sinh nhật KH dự kiến ${year + 1}.xlsx`;
}

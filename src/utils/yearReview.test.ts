// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Customer } from '../types/entities';
import {
  DEFAULT_RULES, buildReviewModel, customerToImportRow, fillFromPrevious, greetingFromDecision,
  proposalFor, resolveDecision, reviewFileName,
} from './yearReview';
import { buildReviewWorkbook, reviewWorkbookBuffer } from './yearReviewExport';
import { parseReviewWorkbook } from './yearReviewImport';

function cust(over: Partial<Customer>): Customer {
  return {
    id: crypto.randomUUID(), createdAt: '', updatedAt: '', year: 2026, fullName: 'Nguyễn Văn An', firstName: 'An', lastName: 'Nguyễn Văn',
    gender: 'male', email: 'an@x.com', company: 'ABC', position: 'Manager', language: 'vi', status: 'active',
    birthDate: '2000-03-15', greetingType: 'ecard_only', station: 'SGN', ecardSent: false, giftGiven: false, ...over,
  };
}

const LIST: Customer[] = [
  cust({ email: 'g1@x.com', fullName: 'Lê Long Phụng', gender: 'female', greetingType: 'gift_visit', giftGiven: true, giftSuggestion: 'Chậu lan', giftBudget: 2000000, pic: 'PHH', birthDate: '2000-01-01' }),
  cust({ email: 'g2@x.com', fullName: 'Thủy', greetingType: 'gift_visit', giftGiven: false, birthDate: '2000-01-10' }),
  cust({ email: 'g3@x.com', fullName: 'Trần Thị Hà', station: 'HAN', greetingType: 'gift_visit', giftGiven: true, birthDate: '2000-02-02' }),
  cust({ email: 'e1@x.com', fullName: 'Phạm Thu Sương', gender: 'female', birthDate: '2000-12-31' }),
  cust({ email: 'e2@x.com', fullName: 'Hoàng Văn Bình', birthDate: undefined }),
  cust({ email: 'e3@x.com', fullName: 'Lê Văn Cường', birthDate: '2000-02-29' }),
  cust({ email: 'old@x.com', fullName: 'Năm cũ', year: 2025 }),
  cust({ email: 'del@x.com', fullName: 'Đã xóa', deletedAt: '2026-01-01' }),
];

describe('buildReviewModel', () => {
  const model = buildReviewModel(LIST, 2026);
  it('chia sheet Gift / eCard theo trạm, bỏ năm khác và khách đã xóa', () => {
    expect(model.sheets.map((s) => [s.name, s.rows.length])).toEqual([['SGN', 2], ['HAN', 1], ['Ecard SGN', 3]]);
    expect(model.nextYear).toBe(2027);
  });
  it('sắp theo ngày sinh 1/1 → 31/12, người chưa có ngày sinh ở cuối, đánh lại STT', () => {
    const ecard = model.sheets[2].rows;
    expect(ecard.map((r) => r.email)).toEqual(['e3@x.com', 'e1@x.com', 'e2@x.com']);
    expect(ecard.map((r) => r.stt)).toEqual([1, 2, 3]);
  });
  it('đề xuất: đã tặng → Tặng quà; không tặng / thiếu ngày sinh → Cần xác nhận', () => {
    const [phung, thuy] = model.sheets[0].rows;
    expect(phung.proposal).toBe('Tặng quà');
    expect(phung.status).toBe('Tặng');
    expect(thuy.proposal).toBe('Cần xác nhận');
    expect(thuy.status).toBe('Không tặng');
    expect(model.sheets[2].rows[2].proposal).toBe('Cần xác nhận');
    expect(model.sheets[2].rows[0].proposal).toBe('Gửi eCard');
  });
  it('ghi chú tự động theo năm', () => {
    const [, thuy] = model.sheets[0].rows;
    expect(thuy.note).toBe('Chưa đủ họ tên – cần bổ sung; 2026 không tặng – cần xác nhận cho 2027');
    expect(model.sheets[2].rows[2].note).toBe('Chưa có ngày sinh – cần bổ sung');
  });
  it('năm khác → nhãn năm khác', () => {
    const m = buildReviewModel(LIST.map((c) => ({ ...c, year: 2027 })), 2027);
    expect(m.nextYear).toBe(2028);
    expect(m.sheets[0].rows[1].note).toContain('2027 không tặng – cần xác nhận cho 2028');
  });
  it('proposalFor', () => {
    expect(proposalFor(cust({ greetingType: 'gift_visit', giftGiven: true }), 'gift')).toBe('Tặng quà');
  });
});

describe('quyết định CHỐT', () => {
  it('sheet Gift', () => {
    expect(resolveDecision('gift', 'Tặng quà', 'Cần xác nhận')).toBe('gift');
    expect(resolveDecision('gift', 'Chỉ gửi eCard', 'Tặng quà')).toBe('ecard');
    expect(resolveDecision('gift', 'Không tặng', '')).toBe('ecard');
    expect(resolveDecision('gift', '', 'Tặng quà')).toBe('gift');
    expect(resolveDecision('gift', '', 'Cần xác nhận')).toBe('undecided');
    expect(resolveDecision('gift', '', 'Không tặng')).toBe('ecard');
  });
  it('sheet eCard', () => {
    expect(resolveDecision('ecard', '', 'Gửi eCard')).toBe('ecard');
    expect(resolveDecision('ecard', 'Chuyển sang tặng quà', 'Gửi eCard')).toBe('gift');
    expect(resolveDecision('ecard', 'Không gửi', 'Gửi eCard')).toBe('exclude');
    expect(resolveDecision('ecard', '', 'Cần xác nhận')).toBe('undecided');
  });
  it('chưa chốt giữ nhóm của sheet; Không gửi bị loại', () => {
    expect(greetingFromDecision('undecided', 'gift')).toBe('gift_visit');
    expect(greetingFromDecision('undecided', 'ecard')).toBe('ecard_only');
    expect(greetingFromDecision('exclude', 'ecard')).toBeNull();
  });
});

describe('tự điền từ năm trước', () => {
  const prev = cust({ email: 'a@x.com', gender: 'female', company: 'DSV', position: 'Director', birthDate: '2000-05-05', pic: 'LMT', giftSuggestion: 'Lan', giftBudget: 1000000, giftLink: 'https://x.vn', station: 'HAN' });
  it('chỉ điền ô trống, không ghi đè ô đã có', () => {
    const { row, filled } = fillFromPrevious({ fullName: 'A', email: 'a@x.com', gender: 'unknown', company: 'MỚI', station: undefined }, prev);
    expect(row.company).toBe('MỚI');
    expect(row.gender).toBe('female');
    expect(row.position).toBe('Director');
    expect(row.birthDate).toBe('2000-05-05');
    expect(row.station).toBe('HAN');
    expect(row.pic).toBe('LMT');
    expect(row.giftBudget).toBe(1000000);
    expect(row.giftLink).toBe('https://x.vn');
    expect(filled).toBeGreaterThan(0);
  });
  it('không có bản ghi năm trước thì giữ nguyên', () => {
    const r = { fullName: 'B', email: 'b@x.com', gender: 'male' as const };
    expect(fillFromPrevious(r, undefined)).toEqual({ row: r, filled: 0 });
  });
  it('customerToImportRow sao chép đủ trường', () => {
    expect(customerToImportRow(prev)).toMatchObject({ email: 'a@x.com', company: 'DSV', giftBudget: 1000000, pic: 'LMT' });
  });
});

describe('tên file', () => {
  it('đặt theo ngày xuất và năm chuẩn bị', () => {
    expect(reviewFileName(2026, new Date(2026, 10, 23))).toBe('2026NOV23_MKT_COUNTRY_Danh sách sinh nhật KH dự kiến 2027.xlsx');
    expect(reviewFileName(2027, new Date(2027, 11, 5))).toBe('2027DEC05_MKT_COUNTRY_Danh sách sinh nhật KH dự kiến 2028.xlsx');
  });
});

describe('file Excel xuất ra', () => {
  const model = buildReviewModel(LIST, 2026);
  it('bố cục giống mẫu: tab, tiêu đề theo năm, cột, ô chọn sẵn, công thức tổng hợp', async () => {
    const wb = await buildReviewWorkbook(model, DEFAULT_RULES, new Date(2026, 10, 23));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Tổng hợp', 'SGN', 'HAN', 'Ecard SGN']);
    const sum = wb.getWorksheet('Tổng hợp')!;
    expect(sum.getCell('B1').value).toBe('DANH SÁCH SINH NHẬT KHÁCH HÀNG – RÀ SOÁT 2026 & CHUẨN BỊ 2027');
    expect(sum.getCell('B2').value).toBe('TransViet Cargo – Marketing Team • 23/11/2026');
    expect(sum.getCell('B5').value).toBe('1. Mở từng sheet SGN, HAN, Ecard SGN – danh sách đã sắp xếp theo ngày sinh (tháng 1 → 12).');
    expect(sum.getCell('D11').value).toBe('Đề xuất tặng theo 2026');
    expect((sum.getCell('C12').value as { formula: string }).formula).toBe('COUNTA(SGN!B5:B56)');
    expect((sum.getCell('D14').value as { formula: string }).formula).toBe(`COUNTIF('Ecard SGN'!I5:I57,"Gửi eCard")`);
    expect(sum.getCell('B16').value).toBe('QUY ĐỊNH 2026 ');
    const sgn = wb.getWorksheet('SGN')!;
    expect(sgn.getCell('A1').value).toBe('SN KHÁCH HÀNG - SGN (GIFT VISIT)');
    expect(sgn.getCell('H4').value).toBe('Quà 2026');
    expect(sgn.getCell('K4').value).toBe('Tình trạng 2026');
    expect(sgn.getCell('M4').value).toBe('Đề xuất 2027\n(MKT)');
    expect(sgn.getCell('N4').value).toBe('CHỐT 2027');
    expect(sgn.getCell('N5').dataValidation.formulae).toEqual(['"Tặng quà,Chỉ gửi eCard,Không tặng"']);
    expect(sgn.getCell('N5').fill).toMatchObject({ fgColor: { argb: 'FFFCE4D6' } });
    expect(wb.getWorksheet('Ecard SGN')!.getCell('J5').dataValidation.formulae).toEqual(['"Gửi eCard,Chuyển sang tặng quà,Không gửi"']);
    expect(sgn.views[0]).toMatchObject({ state: 'frozen', xSplit: 4, ySplit: 4 });
  });
  it('xuất năm 2027 thì mọi nhãn đổi theo năm', async () => {
    const m = buildReviewModel(LIST.map((c) => ({ ...c, year: 2027 })), 2027);
    const wb = await buildReviewWorkbook(m, DEFAULT_RULES, new Date(2027, 10, 1));
    expect(wb.getWorksheet('Tổng hợp')!.getCell('B1').value).toBe('DANH SÁCH SINH NHẬT KHÁCH HÀNG – RÀ SOÁT 2027 & CHUẨN BỊ 2028');
    expect(wb.getWorksheet('HAN')!.getCell('N4').value).toBe('CHỐT 2028');
    expect(wb.getWorksheet('HAN')!.getCell('K4').value).toBe('Tình trạng 2027');
  });
  it('chỉ có sheet cho nhóm có dữ liệu', async () => {
    const only = buildReviewModel([cust({ station: 'DAD' })], 2026);
    const wb = await buildReviewWorkbook(only, [], new Date());
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Tổng hợp', 'Ecard DAD']);
  });
  it('xuất rồi nhập lại: đọc đúng CHỐT, năm, trạm và loại khách', async () => {
    const wb = await buildReviewWorkbook(model, DEFAULT_RULES, new Date());
    wb.getWorksheet('SGN')!.getCell('N5').value = 'Chỉ gửi eCard'; // Lê Long Phụng: sếp chuyển sang eCard
    wb.getWorksheet('SGN')!.getCell('N6').value = 'Tặng quà'; // Thủy: chốt tặng
    wb.getWorksheet('Ecard SGN')!.getCell('J5').value = 'Chuyển sang tặng quà';
    wb.getWorksheet('Ecard SGN')!.getCell('J6').value = 'Không gửi';
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const parsed = parseReviewWorkbook(buf);
    expect(parsed.isReviewFile).toBe(true);
    expect(parsed.targetYear).toBe(2027);
    expect(parsed.fromYear).toBe(2026);
    expect(parsed.sheets).toEqual(['SGN', 'HAN', 'Ecard SGN']);
    expect(parsed.errors).toEqual([]);
    const by = Object.fromEntries(parsed.rows.map((r) => [r.email, r]));
    expect(by['g1@x.com']).toMatchObject({ decision: 'ecard', station: 'SGN', gender: 'female', giftBudget: 2000000, pic: 'PHH', birthDate: '2000-01-01' });
    expect(by['g2@x.com'].decision).toBe('gift');
    expect(by['g3@x.com']).toMatchObject({ decision: 'gift', station: 'HAN' }); // không chốt nhưng đề xuất "Tặng quà"
    expect(by['e3@x.com'].decision).toBe('gift');
    expect(by['e1@x.com'].decision).toBe('exclude');
    expect(by['e2@x.com'].decision).toBe('undecided'); // thiếu ngày sinh → Cần xác nhận, chưa chốt
    expect(by['e3@x.com'].birthDate).toBe('2000-02-29');
  });
  it('file thường (không có cột CHỐT) không bị coi là file rà soát', async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['Full Name', 'Email'], ['A B', 'a@x.com']]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, ws, 'S');
    const buf = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    expect(parseReviewWorkbook(buf).isReviewFile).toBe(false);
    expect((await reviewWorkbookBuffer(buildReviewModel([], 2026), [])).byteLength).toBeGreaterThan(0);
  });
});

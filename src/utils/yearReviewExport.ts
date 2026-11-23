// Tạo file Excel "Rà soát {năm} & chuẩn bị {năm+1}" với bố cục giống file mẫu của Marketing.
import type { Workbook, Worksheet, Cell, Borders } from 'exceljs';
import { ECARD_CHOICES, GIFT_CHOICES, NEED_CONFIRM, type ReviewModel, type ReviewSheet } from './yearReview';

const FONT = 'Times New Roman';
const NAVY = 'FF1F3864';
const ORANGE = 'FFC55A11';
const BLUE = 'FF2E75B6';
const GRID = 'FFBFBFBF';
const CHOICE_FILL = 'FFFCE4D6';
const HEADROOM = 50; // công thức / ô chọn sẵn / định dạng có điều kiện kéo dài thêm cho dòng bổ sung tay

const border: Partial<Borders> = {
  top: { style: 'thin', color: { argb: GRID } },
  left: { style: 'thin', color: { argb: GRID } },
  bottom: { style: 'thin', color: { argb: GRID } },
  right: { style: 'thin', color: { argb: GRID } },
};

const quote = (name: string): string => (/[^A-Za-z0-9_]/.test(name) ? `'${name}'` : name);

function headerCell(cell: Cell, text: string, fill: string): void {
  cell.value = text;
  cell.font = { name: FONT, size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = border;
}

function bodyCell(cell: Cell, value: Cell['value'], align: 'left' | 'center', numFmt?: string, fill?: string): void {
  cell.value = value;
  cell.font = { name: FONT, size: 12 };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  cell.border = border;
  if (numFmt) cell.numFmt = numFmt;
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
}

interface Col { header: string; width: number; align: 'left' | 'center'; fmt?: string }

function columns(sheet: ReviewSheet, year: number): Col[] {
  const next = year + 1;
  const common: Col[] = [
    { header: 'STT', width: 6, align: 'center' },
    { header: 'Company', width: sheet.kind === 'gift' ? 15.6 : 13, align: 'center' },
    { header: 'Name', width: sheet.kind === 'gift' ? 22.7 : 27, align: 'left' },
    { header: 'Gender', width: 8, align: 'center' },
    { header: 'Position', width: sheet.kind === 'gift' ? 37.4 : 32, align: 'left' },
    { header: 'Email', width: sheet.kind === 'gift' ? 36 : 35, align: 'left' },
    { header: 'Birthday\n(DD/MM)', width: 12, align: 'center', fmt: 'dd/mm' },
  ];
  if (sheet.kind === 'gift') {
    return [
      ...common,
      { header: `Quà ${year}`, width: 21.7, align: 'left' },
      { header: 'Budget (₫)', width: 12, align: 'left', fmt: '#,##0' },
      { header: 'PIC', width: 7, align: 'center' },
      { header: `Tình trạng ${year}`, width: 12.6, align: 'center' },
      { header: 'Ghi chú', width: 47.7, align: 'left' },
      { header: `Đề xuất ${next}\n(MKT)`, width: 14, align: 'center' },
      { header: `CHỐT ${next}`, width: 15, align: 'center' },
      { header: 'Ý kiến', width: 30, align: 'left' },
    ];
  }
  return [
    ...common,
    { header: 'Ghi chú', width: 46, align: 'left' },
    { header: `Đề xuất ${next}\n(MKT)`, width: 14, align: 'center' },
    { header: `CHỐT ${next}`, width: 17, align: 'center' },
    { header: 'Ý kiến', width: 30, align: 'left' },
  ];
}

function colLetter(n: number): string {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

const FIRST_ROW = 5;

/** Chiều cao dòng: tối thiểu 30, tự cao thêm khi ô chữ dài (ghi chú, chức vụ…) để không bị cắt. */
function rowHeight(values: Array<Cell['value']>, cols: Col[]): number {
  let lines = 1;
  values.forEach((v, i) => {
    if (typeof v !== 'string' || !cols[i] || cols[i].align !== 'left') return;
    lines = Math.max(lines, Math.ceil(v.length / (cols[i].width * 0.95)));
  });
  return Math.max(30, lines * 16);
}

function addDataSheet(wb: Workbook, sheet: ReviewSheet, year: number): Worksheet {
  const ws = wb.addWorksheet(sheet.name, {
    properties: { tabColor: { argb: NAVY } },
    views: [{ state: 'frozen', xSplit: 4, ySplit: 4, topLeftCell: 'E5', activeCell: 'E5' }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const cols = columns(sheet, year);
  cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; });

  const t = ws.getCell('A1');
  t.value = sheet.title;
  t.font = { name: FONT, size: sheet.kind === 'gift' ? 14 : 15, bold: true, color: { argb: NAVY } };
  ws.getRow(1).height = sheet.kind === 'gift' ? 18.75 : 19.5;

  const lastCol = cols.length;
  const firstChoice = lastCol - 2; // chỉ số (từ 0) của cột CHỐT; cột Ý kiến ngay sau đó
  cols.forEach((c, i) => headerCell(ws.getCell(4, i + 1), c.header, i >= firstChoice ? ORANGE : NAVY));
  ws.getRow(4).height = 32.1;

  sheet.rows.forEach((r, i) => {
    const rowNo = FIRST_ROW + i;
    const birthday = r.birthday ? new Date(Date.UTC(2000, r.birthday.month - 1, r.birthday.day)) : null;
    const values: Array<Cell['value']> = sheet.kind === 'gift'
      ? [r.stt, r.company, r.name, r.gender, r.position, r.email, birthday, r.gift, r.budget, r.pic, r.status, r.note, r.proposal, null, null]
      : [r.stt, r.company, r.name, r.gender, r.position, r.email, birthday, r.note, r.proposal, null, null];
    values.forEach((v, c) => {
      bodyCell(ws.getCell(rowNo, c + 1), v === '' ? null : v, cols[c].align, cols[c].fmt, c >= firstChoice ? CHOICE_FILL : undefined);
    });
    ws.getRow(rowNo).height = rowHeight(values, cols);
  });

  const last = FIRST_ROW + sheet.rows.length - 1;
  const lim = last + HEADROOM;
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: last, column: lastCol } };

  const L = (i: number) => colLetter(i);
  const chot = L(lastCol - 1);
  const prop = L(lastCol - 2);
  const note = L(lastCol - 3);
  const choices = sheet.kind === 'gift' ? GIFT_CHOICES : ECARD_CHOICES;
  for (let r = FIRST_ROW; r <= lim; r++) {
    ws.getCell(`${chot}${r}`).dataValidation = {
      type: 'list', allowBlank: true, showErrorMessage: false, formulae: [`"${choices.join(',')}"`],
    };
  }

  const red = { font: { color: { argb: 'FFC00000' } } };
  if (sheet.kind === 'gift') {
    const st = L(11);
    ws.addConditionalFormatting({ ref: `${st}${FIRST_ROW}:${st}${lim}`, rules: [
      { type: 'expression', priority: 1, formulae: [`${st}${FIRST_ROW}<>"Tặng"`], style: { font: { bold: true, color: { argb: 'FFC00000' } } } },
    ] });
  }
  ws.addConditionalFormatting({ ref: `${note}${FIRST_ROW}:${note}${lim}`, rules: [
    { type: 'expression', priority: 2, formulae: [`LEN(${note}${FIRST_ROW})>0`], style: red },
  ] });
  ws.addConditionalFormatting({ ref: `${prop}${FIRST_ROW}:${prop}${lim}`, rules: [
    { type: 'cellIs', priority: 3, operator: 'equal', formulae: [`"${NEED_CONFIRM}"`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB9C' } } } },
    { type: 'expression', priority: 4, formulae: [`LEFT(${prop}${FIRST_ROW},5)="Không"`], style: { font: { color: { argb: 'FF808080' } } } },
  ] });
  return ws;
}

function lineHeight(text: string, chars: number): number {
  return Math.max(1, Math.ceil(text.length / chars)) * 15.75;
}

function addSummary(wb: Workbook, model: ReviewModel, rules: string[], today: Date): void {
  const { year, nextYear, sheets } = model;
  const ws = wb.addWorksheet('Tổng hợp', {
    properties: { tabColor: { argb: ORANGE } },
    views: [{ showGridLines: false }],
  });
  [3, 16, 13, 13, 15, 13, 15].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const plain = { name: FONT, size: 12 };
  const put = (addr: string, value: string, font: object) => { const c = ws.getCell(addr); c.value = value; c.font = font; return c; };
  const merged = (row: number, text: string): void => {
    ws.mergeCells(`B${row}:G${row}`);
    const c = put(`B${row}`, text, plain);
    c.alignment = { vertical: 'top', wrapText: true };
    ws.getRow(row).height = lineHeight(text, 82);
  };

  put('B1', `DANH SÁCH SINH NHẬT KHÁCH HÀNG – RÀ SOÁT ${year} & CHUẨN BỊ ${nextYear}`, { name: FONT, size: 16, bold: true, color: { argb: NAVY } });
  ws.getRow(1).height = 20.25;
  const dd = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  put('B2', `TransViet Cargo – Marketing Team • ${dd}`, { name: FONT, size: 12, italic: true, color: { argb: 'FF595959' } });
  const heading = { name: FONT, size: 12, bold: true, color: { argb: BLUE } };
  put('B4', 'CÁCH DUYỆT', heading);
  const names = sheets.map((s) => s.name).join(', ');
  merged(5, `1. Mở từng sheet ${names} – danh sách đã sắp xếp theo ngày sinh (tháng 1 → 12).`);
  merged(6, `2. Cột "Đề xuất ${nextYear} (MKT)" là đề xuất của Marketing; dòng vàng "Cần xác nhận" là khách cần anh/chị quyết định.`);
  merged(7, `3. Chọn ở cột CHỐT ${nextYear} (ô màu cam, có danh sách chọn sẵn) và ghi ý kiến nếu cần. Có thể sửa trực tiếp mọi ô.`);
  merged(8, '4. Cột "Ghi chú" (chữ đỏ): thông tin còn thiếu/cần xác nhận, Marketing sẽ bổ sung.');

  put('B10', `TỔNG QUAN (tự cập nhật theo cột CHỐT ${nextYear})`, heading);
  ['Sheet', 'Tổng khách', `Đề xuất tặng theo ${year}`, 'Cần xác nhận', 'Sếp đã chốt', 'Chưa chốt'].forEach((h, i) => headerCell(ws.getCell(11, i + 2), h, NAVY));
  ws.getRow(11).height = 30;

  sheets.forEach((s, i) => {
    const r = 12 + i;
    const lim = FIRST_ROW + s.rows.length - 1 + HEADROOM;
    const n = quote(s.name);
    const cols = s.kind === 'gift' ? { prop: 'M', chot: 'N', yes: 'Tặng quà' } : { prop: 'I', chot: 'J', yes: 'Gửi eCard' };
    const total = `COUNTA(${n}!B${FIRST_ROW}:B${lim})`;
    const decided = `COUNTA(${n}!${cols.chot}${FIRST_ROW}:${cols.chot}${lim})`;
    const nameCell = ws.getCell(r, 2);
    nameCell.value = s.name;
    nameCell.font = { name: FONT, size: 12, bold: true };
    nameCell.alignment = { vertical: 'middle' };
    nameCell.border = border;
    const yesN = s.rows.filter((x) => x.proposal === cols.yes).length;
    const needN = s.rows.filter((x) => x.proposal === NEED_CONFIRM).length;
    const cells: Array<[string, number]> = [
      [total, s.rows.length],
      [`COUNTIF(${n}!${cols.prop}${FIRST_ROW}:${cols.prop}${lim},"${cols.yes}")`, yesN],
      [`COUNTIF(${n}!${cols.prop}${FIRST_ROW}:${cols.prop}${lim},"${NEED_CONFIRM}")`, needN],
      [decided, 0],
      [`${total}-${decided}`, s.rows.length],
    ];
    cells.forEach(([formula, result], k) => {
      const c = ws.getCell(r, 3 + k);
      c.value = { formula, result };
      c.font = plain;
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = border;
    });
    ws.getRow(r).height = 15.75;
  });

  let row = 12 + sheets.length + 1;
  put(`B${row}`, `QUY ĐỊNH ${year} `, heading);
  rules.map((x) => x.trim()).filter(Boolean).forEach((line) => { row += 1; merged(row, line); });
}

export async function buildReviewWorkbook(model: ReviewModel, rules: string[], today: Date = new Date()): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TransViet Cargo – Marketing Team';
  wb.created = today;
  addSummary(wb, model, rules, today);
  for (const s of model.sheets) addDataSheet(wb, s, model.year);
  return wb;
}

export async function reviewWorkbookBuffer(model: ReviewModel, rules: string[], today?: Date): Promise<ArrayBuffer> {
  const wb = await buildReviewWorkbook(model, rules, today);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Tải file về máy (chạy trên trình duyệt). */
export async function downloadReviewWorkbook(model: ReviewModel, rules: string[], fileName: string): Promise<void> {
  const buf = await reviewWorkbookBuffer(model, rules);
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

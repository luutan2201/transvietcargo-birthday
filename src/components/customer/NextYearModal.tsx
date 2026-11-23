import { useEffect, useState } from 'react';
import { customerService } from '../../services/customer/customerService';
import { parseCustomerFile } from '../../utils/excelImport';
import { parseReviewWorkbook, type ReviewParseResult } from '../../utils/yearReviewImport';
import type { ImportRow } from '../../utils/excelImport';
import type { ReviewImportRow } from '../../utils/yearReview';

interface Props {
  /** Năm đang xem — danh sách mới sẽ là năm này + 1. */
  fromYear: number;
  /** Năm đích đã có dữ liệu chưa (để cảnh báo). */
  targetHasData: boolean;
  onClose: () => void;
  onDone: (targetYear: number) => void;
}

interface Parsed {
  rows: Array<ImportRow | ReviewImportRow>;
  review: ReviewParseResult | null;
  errors: Array<{ where: string; reason: string }>;
}

type Summary = Awaited<ReturnType<typeof customerService.createNextYearList>>;

export function NextYearModal({ fromYear, targetHasData, onClose, onDone }: Props) {
  const target = fromYear + 1;
  const [mode, setMode] = useState<'file' | 'copy'>('file');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [previousCount, setPreviousCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    customerService.list({ year: fromYear, pageSize: 10000 }).then((r) => setPreviousCount(r.items.length)).catch(() => setPreviousCount(null));
  }, [fromYear]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsed(null);
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const review = parseReviewWorkbook(buffer);
      if (review.isReviewFile) {
        setParsed({ rows: review.rows, review, errors: review.errors.map((x) => ({ where: `${x.sheet} dòng ${x.row}`, reason: x.reason })) });
      } else {
        const plain = await parseCustomerFile(file);
        setParsed({ rows: plain.valid, review: null, errors: plain.errors.map((x) => ({ where: `Dòng ${x.row}`, reason: x.reason })) });
      }
    } catch {
      setError('File không đọc được. Vui lòng chọn file .xlsx, .xls hoặc .csv.');
    } finally {
      setBusy(false);
    }
  }

  const yearMismatch = !!parsed?.review?.targetYear && parsed.review.targetYear !== target;
  const reviewRows = (parsed?.review ? parsed.rows : []) as ReviewImportRow[];
  const count = (d: ReviewImportRow['decision']) => reviewRows.filter((r) => r.decision === d).length;
  const canConfirm = mode === 'copy' ? !!previousCount : !!parsed && parsed.rows.length > 0 && !yearMismatch;

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      setSummary(await customerService.createNextYearList(mode === 'copy' ? { fromYear, mode } : { fromYear, mode, rows: parsed?.rows }));
    } catch (e) {
      setError(`Không tạo được danh sách: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay}>
      <div className="glass-panel" style={{ padding: 24, width: 680, maxHeight: '88vh', overflowY: 'auto' }}>
        <h2 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Tạo danh sách năm {target}</h2>

        {!summary && (
          <>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 0 }}>
              Danh sách năm {target} là danh sách độc lập; danh sách năm {fromYear} không bị thay đổi.
              {targetHasData && <strong style={{ color: 'var(--color-danger)' }}> Năm {target} đã có dữ liệu: khách trùng email sẽ được cập nhật, khách mới được thêm.</strong>}
            </p>

            <label style={optionBox(mode === 'file')}>
              <input type="radio" checked={mode === 'file'} onChange={() => setMode('file')} />{' '}
              <strong>Import file Excel</strong> (khuyên dùng)
              <div style={hint}>
                Chọn file rà soát đã được sếp điền cột "CHỐT {target}" (hoặc 1 file danh sách thường).
                Hệ thống chuyển nhóm Gift/eCard theo cột CHỐT và <strong>tự điền các ô còn thiếu</strong> (giới tính, chức vụ, ngày sinh, quà, budget, PIC, link…)
                từ danh sách năm {fromYear} theo email.
              </div>
              {mode === 'file' && (
                <div style={{ marginTop: 10 }}>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} disabled={busy} />
                </div>
              )}
            </label>

            <label style={optionBox(mode === 'copy')}>
              <input type="radio" checked={mode === 'copy'} onChange={() => setMode('copy')} />{' '}
              <strong>Sao chép từ danh sách năm {fromYear}</strong>
              <div style={hint}>
                Không cần file: sao chép toàn bộ {previousCount ?? '…'} khách của năm {fromYear} sang năm {target}, giữ nguyên nhóm, quà, budget, PIC, link.
                Trạng thái "đã gửi eCard / đã tặng quà" được đặt lại.
              </div>
            </label>

            {mode === 'file' && parsed && (
              <div style={{ marginTop: 14, fontSize: 14 }}>
                {yearMismatch && (
                  <p style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                    ⚠ File này chốt cho năm {parsed.review?.targetYear}, không phải năm {target}. Hãy chọn đúng năm ở bộ lọc "Năm" của trang Customers rồi thử lại.
                  </p>
                )}
                <p>✅ Đọc được <strong>{parsed.rows.length}</strong> khách{parsed.review ? ` từ các sheet: ${parsed.review.sheets.join(', ')}` : ''}.</p>
                {parsed.review && (
                  <ul style={{ margin: '4px 0 8px 18px', padding: 0 }}>
                    <li>Gift visit: {count('gift')} · eCard: {count('ecard')}</li>
                    <li>Loại khỏi danh sách (CHỐT "Không gửi"): {count('exclude')}</li>
                    <li>Chưa chốt (giữ nguyên nhóm hiện tại): {count('undecided')}</li>
                  </ul>
                )}
                {parsed.errors.length > 0 && (
                  <details>
                    <summary style={{ color: 'var(--color-warning)' }}>{parsed.errors.length} dòng bị bỏ qua</summary>
                    <ul>{parsed.errors.slice(0, 30).map((e, i) => <li key={i}>{e.where}: {e.reason}</li>)}</ul>
                  </details>
                )}
              </div>
            )}

            {error && <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={onClose} style={secondaryButton}>Hủy</button>
              <button onClick={handleConfirm} disabled={busy || !canConfirm} style={primaryButton}>
                {busy ? 'Đang xử lý…' : `Tạo danh sách năm ${target}`}
              </button>
            </div>
          </>
        )}

        {summary && (
          <div style={{ fontSize: 15 }}>
            <p>✅ Tạo mới: <strong>{summary.imported}</strong> khách</p>
            <p>🔄 Cập nhật (email đã có trong năm {summary.targetYear}): <strong>{summary.updated}</strong></p>
            {mode === 'file' && <p>🧩 Tự điền ô thiếu từ năm {fromYear}: <strong>{summary.filled}</strong> khách</p>}
            {summary.excluded > 0 && <p>🚫 Loại theo cột CHỐT: {summary.excluded}</p>}
            {summary.undecided > 0 && <p>⏳ Chưa chốt, giữ nguyên nhóm: {summary.undecided}</p>}
            <button onClick={() => onDone(summary.targetYear)} style={{ ...primaryButton, marginTop: 12, flex: 'none', width: '100%' }}>
              Xem danh sách năm {summary.targetYear}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const optionBox = (on: boolean): React.CSSProperties => ({
  display: 'block', padding: 14, marginTop: 10, borderRadius: 12, cursor: 'pointer', fontSize: 15,
  border: `1.5px solid ${on ? 'var(--color-primary)' : '#d0d7e2'}`, background: on ? 'rgba(20,126,147,0.06)' : 'transparent',
});
const hint: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 };
const primaryButton: React.CSSProperties = { flex: 1, padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' };
const secondaryButton: React.CSSProperties = { flex: 1, padding: '10px', background: '#eee', color: '#333', border: 'none', borderRadius: 10, cursor: 'pointer' };

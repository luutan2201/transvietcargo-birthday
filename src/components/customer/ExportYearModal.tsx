import { useEffect, useMemo, useState } from 'react';
import { customerService } from '../../services/customer/customerService';
import { buildReviewModel, DEFAULT_RULES, reviewFileName } from '../../utils/yearReview';
import type { Customer } from '../../types/entities';

const RULES_KEY = 'tv_year_review_rules';

function loadRules(): string {
  try {
    return localStorage.getItem(RULES_KEY) ?? DEFAULT_RULES.join('\n');
  } catch {
    return DEFAULT_RULES.join('\n');
  }
}

interface Props {
  years: number[];
  defaultYear: number;
  onClose: () => void;
}

/** Export báo cáo rà soát: chọn năm → file Excel "Rà soát {năm} & chuẩn bị {năm+1}". */
export function ExportYearModal({ years, defaultYear, onClose }: Props) {
  const [year, setYear] = useState(defaultYear);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [rules, setRules] = useState(loadRules);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCustomers(null);
    customerService.list({ year, pageSize: 10000 }).then((r) => { if (!cancelled) setCustomers(r.items); }).catch(() => { if (!cancelled) setError('Không tải được danh sách.'); });
    return () => { cancelled = true; };
  }, [year]);

  const model = useMemo(() => (customers ? buildReviewModel(customers, year) : null), [customers, year]);
  const total = model?.sheets.reduce((n, s) => n + s.rows.length, 0) ?? 0;

  async function handleExport() {
    if (!model || total === 0) return;
    setBusy(true);
    setError(null);
    try {
      try { localStorage.setItem(RULES_KEY, rules); } catch { /* không lưu được thì thôi */ }
      const { downloadReviewWorkbook } = await import('../../utils/yearReviewExport');
      await downloadReviewWorkbook(model, rules.split('\n'), reviewFileName(year, new Date()));
    } catch (e) {
      setError(`Không tạo được file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const yearOptions = Array.from(new Set([...years, defaultYear])).sort((a, b) => b - a);

  return (
    <div style={overlay}>
      <div className="glass-panel" style={{ padding: 24, width: 640, maxHeight: '88vh', overflowY: 'auto' }}>
        <h2 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Export báo cáo rà soát</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 0 }}>
          Xuất danh sách của năm đã chọn thành file Excel để trình duyệt: <strong>Rà soát {year} &amp; chuẩn bị {year + 1}</strong>
          {' '}(các cột "Quà", "Tình trạng" theo năm {year}; cột "Đề xuất" và "CHỐT" cho năm {year + 1}).
        </p>

        <label style={{ fontSize: 14, fontWeight: 600 }}>
          Chọn năm danh sách{' '}
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={select}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>

        <div style={{ margin: '14px 0', fontSize: 14 }}>
          {!model && !error && <span>Đang tải…</span>}
          {model && total === 0 && <span style={{ color: 'var(--color-danger)' }}>Năm {year} chưa có khách hàng nào.</span>}
          {model && total > 0 && (
            <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {model.sheets.map((s) => (
                  <tr key={s.name}>
                    <td style={{ padding: '3px 16px 3px 0', fontWeight: 600 }}>{s.name}</td>
                    <td>{s.rows.length} khách</td>
                  </tr>
                ))}
                <tr><td style={{ padding: '6px 16px 0 0', fontWeight: 700 }}>Tổng</td><td style={{ paddingTop: 6, fontWeight: 700 }}>{total} khách</td></tr>
              </tbody>
            </table>
          )}
        </div>

        <label style={{ fontSize: 14, fontWeight: 600 }}>
          Quy định in ở cuối sheet "Tổng hợp" (mỗi dòng 1 ý, sửa được; lần sau tự nhớ)
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={5}
            style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 10, border: '1px solid #d0d7e2', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }}
          />
        </label>

        {error && <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={secondaryButton}>Đóng</button>
          <button onClick={handleExport} disabled={busy || !model || total === 0} style={primaryButton}>
            {busy ? 'Đang tạo file…' : `Tải file Excel (${year} → ${year + 1})`}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const select: React.CSSProperties = { padding: 8, borderRadius: 10, border: '1px solid #d0d7e2', fontWeight: 600, marginLeft: 6 };
const primaryButton: React.CSSProperties = { flex: 1, padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' };
const secondaryButton: React.CSSProperties = { flex: 1, padding: '10px', background: '#eee', color: '#333', border: 'none', borderRadius: 10, cursor: 'pointer' };

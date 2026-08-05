import { useState } from 'react';
import { parseCustomerFile, type ImportResult } from '../../utils/excelImport';
import { customerService } from '../../services/customer/customerService';

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export function CustomerImportModal({ onClose, onImported }: Props) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [summary, setSummary] = useState<{ imported: number; updated: number; skipped: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setBusy(true);
    try {
      const parsed = await parseCustomerFile(file);
      setResult(parsed);
    } catch {
      setFileError('Unsupported or corrupted file. Please upload .xlsx, .xls, or .csv.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmImport() {
    if (!result) return;
    setBusy(true);
    const res = await customerService.importRows(result.valid);
    setSummary(res);
    setBusy(false);
  }

  const birthdayMissingCount = result ? result.valid.filter((r) => r.rawBirthday && !r.birthDate).length : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div className="glass-panel" style={{ padding: 24, width: 640, maxHeight: '85vh', overflowY: 'auto' }}>
        <h2 style={{ marginTop: 0, color: 'var(--color-primary)' }}>Import Customers</h2>
        {!summary && (
          <>
            <div style={{ background: 'rgba(20,126,147,0.06)', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              <p style={{ marginBottom: 6, fontWeight: 600, color: 'var(--text-main)' }}>Cột được hỗ trợ (không phân biệt hoa/thường, thứ tự tuỳ ý):</p>
              <p>Full Name, Email, Gender, Company, Position, Birthday, Station (SGN/HAN), Type (eCard only / Gift visit), Gift suggestion.</p>
            </div>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} disabled={busy} />
            {fileError && <p style={{ color: 'var(--color-danger)', fontSize: 15 }}>{fileError}</p>}
            {result && (
              <div style={{ marginTop: 16, fontSize: 15 }}>
                <p>✅ {result.valid.length} valid rows ready to import</p>
                {birthdayMissingCount > 0 && (
                  <p style={{ color: 'var(--color-danger)' }}>⚠️ {birthdayMissingCount} dòng có dữ liệu Birthday nhưng hệ thống không đọc được — xem bảng bên dưới, cột "Raw value" là nội dung gốc trong ô Excel.</p>
                )}
                {result.errors.length > 0 && (
                  <details>
                    <summary style={{ color: 'var(--color-warning)' }}>{result.errors.length} rows skipped (errors)</summary>
                    <ul>
                      {result.errors.slice(0, 20).map((e, i) => <li key={i}>Row {e.row}: {e.reason}</li>)}
                    </ul>
                  </details>
                )}

                <details open={birthdayMissingCount > 0} style={{ marginTop: 12 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Xem trước dữ liệu Birthday (raw value → parsed)</summary>
                  <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 8, border: '1px solid rgba(20,126,147,0.15)', borderRadius: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'rgba(20,126,147,0.06)', textAlign: 'left' }}>
                          <th style={{ padding: '6px 10px' }}>Name</th>
                          <th style={{ padding: '6px 10px' }}>Raw value</th>
                          <th style={{ padding: '6px 10px' }}>Parsed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.valid.map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #eee', background: r.rawBirthday && !r.birthDate ? 'rgba(244,67,54,0.06)' : 'transparent' }}>
                            <td style={{ padding: '6px 10px' }}>{r.fullName}</td>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{r.rawBirthday ?? '(trống)'}</td>
                            <td style={{ padding: '6px 10px', color: r.birthDate ? 'var(--color-success)' : 'var(--color-danger)' }}>
                              {r.birthDate ?? '❌ không đọc được'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
                  <button onClick={handleConfirmImport} disabled={busy || result.valid.length === 0} style={primaryButtonStyle}>
                    {busy ? 'Importing…' : `Import / Update ${result.valid.length} Customers`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {summary && (
          <div style={{ marginTop: 16, fontSize: 14 }}>
            <p>✅ Tạo mới: {summary.imported}</p>
            <p>🔄 Cập nhật (email đã tồn tại): {summary.updated}</p>
            <button onClick={onImported} style={{ ...primaryButtonStyle, marginTop: 12 }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = { flex: 1, padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' };
const secondaryButtonStyle: React.CSSProperties = { flex: 1, padding: '10px', background: '#eee', color: '#333', border: 'none', borderRadius: 10, cursor: 'pointer' };

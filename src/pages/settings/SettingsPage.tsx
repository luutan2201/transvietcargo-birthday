import { useEffect, useState } from 'react';
import { settingsService, type AppSettings } from '../../services/settings/settingsService';
import { backupService } from '../../services/backup/backupService';
import { signatureService } from '../../services/signature/signatureService';
import { readFileAsDataUrl } from '../../utils/fileUtils';
import { RichTextEditor } from '../../components/common/RichTextEditor';
import type { Signature } from '../../types/entities';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [editingSig, setEditingSig] = useState<Signature | null | undefined>(undefined);
  const [sigName, setSigName] = useState('');
  const [sigHtml, setSigHtml] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [sigError, setSigError] = useState<string | null>(null);
  const [savingSig, setSavingSig] = useState(false);

  async function reload() {
    setSettings(await settingsService.getAll());
    setSignatures((await signatureService.list()).items);
  }
  useEffect(() => { reload(); }, []);

  async function handleChange<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    await settingsService.set(key, value);
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSavedAt(new Date().toLocaleTimeString());
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setLogoError('Vui lòng chọn file ảnh (PNG/JPG).'); return; }
    const dataUrl = await readFileAsDataUrl(file);
    await handleChange('logoDataUrl', dataUrl);
  }

  async function handleRemoveLogo() {
    await handleChange('logoDataUrl', null);
  }

  async function handleExport() {
    const { blob, fileName } = await backupService.exportJson();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const counts = await backupService.restoreFromJson(file);
    setRestoreMsg(`Restored: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  function openNewSignature() {
    setEditingSig(null);
    setSigName('');
    setSigHtml('');
    setScheduleEnabled(false);
    setEffectiveFrom('');
    setEffectiveTo('');
    setSigError(null);
  }

  function openEditSignature(s: Signature) {
    setEditingSig(s);
    setSigName(s.name);
    setSigHtml(s.htmlContent);
    setScheduleEnabled(!!(s.effectiveFrom && s.effectiveTo));
    setEffectiveFrom(s.effectiveFrom ?? '');
    setEffectiveTo(s.effectiveTo ?? '');
    setSigError(null);
  }

  async function handleSaveSignature() {
    setSigError(null);
    if (!sigName.trim()) { setSigError('Nhập tên để phân biệt (VD: Chữ ký Tết 2026).'); return; }
    if (scheduleEnabled && (!effectiveFrom || !effectiveTo)) { setSigError('Nhập đủ ngày bắt đầu và kết thúc, hoặc tắt lịch tự động.'); return; }
    if (scheduleEnabled && effectiveFrom > effectiveTo) { setSigError('Ngày bắt đầu phải trước ngày kết thúc.'); return; }
    setSavingSig(true);
    try {
      const input = {
        name: sigName,
        htmlContent: sigHtml,
        effectiveFrom: scheduleEnabled ? effectiveFrom : undefined,
        effectiveTo: scheduleEnabled ? effectiveTo : undefined,
      };
      if (editingSig) await signatureService.update(editingSig.id, input);
      else await signatureService.save(input);
      setEditingSig(undefined);
      reload();
    } catch (err) {
      setSigError(err instanceof Error ? err.message : 'Failed to save signature');
    } finally {
      setSavingSig(false);
    }
  }

  if (!settings) return null;

  return (
    <div>
      <h1>Settings</h1>
      {savedAt && <p style={{ fontSize: 13, color: 'var(--color-success)' }}>Last saved: {savedAt}</p>}

      <div className="glass-panel" style={{ padding: 22, marginBottom: 18 }}>
        <h3 style={{ marginBottom: 12 }}>Logo công ty</h3>
        <p style={{ fontSize: 13, marginBottom: 12 }}>Logo sẽ tự động hiển thị ở góc trên-trái của ứng dụng.</p>
        {settings.logoDataUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <img src={settings.logoDataUrl} alt="Logo hiện tại" style={{ maxWidth: 80, maxHeight: 80, borderRadius: 12, background: '#fff', padding: 6, border: '1px solid rgba(20,126,147,0.15)' }} />
            <button onClick={handleRemoveLogo} style={{ fontSize: 13, color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer' }}>Xoá logo</button>
          </div>
        )}
        <input type="file" accept="image/*" onChange={handleLogoUpload} />
        {logoError && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{logoError}</p>}
      </div>

      <div className="glass-panel" style={{ padding: 22, marginBottom: 18 }}>
        <h3 style={{ marginBottom: 12 }}>General</h3>
        <label style={labelStyle}>Default language
          <select value={settings.defaultLanguage} onChange={(e) => handleChange('defaultLanguage', e.target.value as AppSettings['defaultLanguage'])} style={inputStyle}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
        <label style={labelStyle}>History retention (months)
          <input type="number" min={1} value={settings.historyRetentionMonths} onChange={(e) => handleChange('historyRetentionMonths', Number(e.target.value))} style={inputStyle} />
        </label>
      </div>

      <div className="glass-panel" style={{ padding: 22, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Chữ ký (Signatures) ({signatures.length}/5)</h3>
          {editingSig === undefined && signatures.length < 5 && (
            <button onClick={openNewSignature} style={{ padding: '8px 14px', border: 'none', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
              + Thêm chữ ký
            </button>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Soạn chữ ký tự do như trong Outlook — chỉnh font, cỡ chữ, màu chữ, và chèn ảnh trực tiếp.
          Đặt lịch để hệ thống tự động dùng chữ ký khác trong các dịp lễ/Tết, rồi tự quay lại chữ ký mặc định sau đó.
        </p>

        {signatures.map((s) => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #eee', fontSize: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
              <div dangerouslySetInnerHTML={{ __html: s.htmlContent }} style={{ maxWidth: 220, maxHeight: 40, overflow: 'hidden', transform: 'scale(0.8)', transformOrigin: 'left' }} />
              <span>
                {s.name} {s.isDefault && '⭐'}
                {s.effectiveFrom && s.effectiveTo && (
                  <span style={{ fontSize: 12, color: 'var(--color-primary)', marginLeft: 6 }}>
                    📅 {formatDate(s.effectiveFrom)} – {formatDate(s.effectiveTo)}
                  </span>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={() => openEditSignature(s)} style={linkBtn}>Sửa</button>
              {!s.isDefault && <button onClick={async () => { await signatureService.setDefault(s.id); reload(); }} style={linkBtn}>Đặt mặc định</button>}
              <button onClick={async () => { if (confirm('Xoá chữ ký này?')) { await signatureService.remove(s.id); reload(); } }} style={{ ...linkBtn, color: 'var(--color-danger)' }}>Xoá</button>
            </div>
          </div>
        ))}
        {signatures.length === 0 && editingSig === undefined && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chưa có chữ ký nào.</p>}

        {editingSig !== undefined && (
          <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}>
            <label style={labelStyle}>Tên chữ ký
              <input value={sigName} onChange={(e) => setSigName(e.target.value)} placeholder="VD: Chữ ký mặc định, hoặc Chữ ký Tết 2026" style={inputStyle} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, margin: '10px 0' }}>
              <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} />
              Chỉ dùng tự động trong 1 khoảng thời gian cụ thể (VD: dịp Tết)
            </label>
            {scheduleEnabled && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <label style={{ ...labelStyle, flex: 1 }}>Từ ngày
                  <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} style={inputStyle} />
                </label>
                <label style={{ ...labelStyle, flex: 1 }}>Đến ngày
                  <input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} style={inputStyle} />
                </label>
              </div>
            )}

            <label style={{ ...labelStyle, marginBottom: 6 }}>Nội dung chữ ký</label>
            <RichTextEditor value={sigHtml} onChange={setSigHtml} placeholder="Soạn chữ ký ở đây… chỉnh font, màu chữ, chèn ảnh…" full />

            {sigError && <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>{sigError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setEditingSig(undefined)} style={{ padding: '8px 14px', border: 'none', borderRadius: 8, background: '#eee', cursor: 'pointer' }}>Huỷ</button>
              <button onClick={handleSaveSignature} disabled={savingSig} style={{ padding: '8px 14px', border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>
                {savingSig ? 'Đang lưu…' : 'Lưu chữ ký'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: 22 }}>
        <h3 style={{ marginBottom: 12 }}>Backup & Restore</h3>
        <button onClick={handleExport} style={{ padding: '10px 16px', marginRight: 8, border: 'none', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>
          Export JSON Backup
        </button>
        <input type="file" accept=".json" onChange={handleRestore} style={{ marginTop: 8, display: 'block' }} />
        {restoreMsg && <p style={{ fontSize: 13, color: 'var(--color-success)' }}>{restoreMsg}</p>}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 12 };
const inputStyle: React.CSSProperties = { width: '100%', marginTop: 4 };
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--color-secondary)', cursor: 'pointer', fontSize: 13 };

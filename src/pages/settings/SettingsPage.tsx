import { useEffect, useState } from 'react';
import { settingsService, type AppSettings } from '../../services/settings/settingsService';
import { backupService } from '../../services/backup/backupService';
import { signatureService } from '../../services/signature/signatureService';
import { readFileAsDataUrl } from '../../utils/fileUtils';
import type { Signature } from '../../types/entities';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [sigError, setSigError] = useState<string | null>(null);

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

  async function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setSigError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setSigError('Vui lòng chọn file ảnh chữ ký (PNG/JPG).'); return; }
    const dataUrl = await readFileAsDataUrl(file);
    const html = `<img src="${dataUrl}" alt="Signature" style="max-width:320px;display:block;border:0;" />`;
    await signatureService.upload(file.name, html);
    reload();
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
        <h3 style={{ marginBottom: 12 }}>Chữ ký (Signatures)</h3>
        <p style={{ fontSize: 13, marginBottom: 12 }}>Upload ảnh chữ ký (PNG) — sẽ tự động chèn vào cuối email khi generate.</p>
        {signatures.map((s) => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span dangerouslySetInnerHTML={{ __html: s.htmlContent }} style={{ maxHeight: 40, overflow: 'hidden' }} />
              {s.name} {s.isDefault && '⭐'}
            </span>
            {!s.isDefault && <button onClick={async () => { await signatureService.setDefault(s.id); reload(); }} style={linkBtn}>Set default</button>}
          </div>
        ))}
        <input type="file" accept="image/*" onChange={handleSignatureUpload} disabled={signatures.length >= 5} style={{ marginTop: 8 }} />
        {sigError && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{sigError}</p>}
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

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, marginBottom: 12 };
const inputStyle: React.CSSProperties = { width: '100%', marginTop: 4 };
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--color-secondary)', cursor: 'pointer', fontSize: 13 };

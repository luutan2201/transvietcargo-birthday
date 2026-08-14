import { useEffect, useState } from 'react';
import type { Template, TemplateCategory } from '../../types/entities';
import { templateService } from '../../services/template/templateService';
import { RichTextEditor } from '../../components/common/RichTextEditor';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../services/auth/permissions';

const CATEGORIES: TemplateCategory[] = ['birthday', 'christmas', 'new_year', 'mid_autumn', 'anniversary', 'promotion', 'thank_you'];

export default function TemplatesPage() {
  const { session } = useAuth();
  const canEdit = !!session && hasPermission(session.role, 'templates.edit');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<TemplateCategory>('birthday');

  const reload = async () => setTemplates((await templateService.list()).items);
  useEffect(() => { reload(); }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    await templateService.create({ name: newName, category: newCategory });
    setNewName('');
    reload();
  }

  const currentVersion = selected ? templateService.getCurrentVersion(selected) : null;

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      <div style={{ width: 280 }}>
        <h1>Templates</h1>
        {canEdit && (
          <div className="glass-panel" style={{ padding: 12, marginBottom: 12 }}>
            <input placeholder="New template name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8 }} />
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as TemplateCategory)} style={{ width: '100%', padding: 8, marginBottom: 8 }}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
            <button onClick={handleCreate} style={{ width: '100%', padding: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>+ Create</button>
          </div>
        )}
        <div className="glass-panel" style={{ padding: 8 }}>
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelected(t)}
              style={{ padding: 10, borderRadius: 8, cursor: 'pointer', background: selected?.id === t.id ? 'rgba(0,59,122,0.08)' : 'transparent' }}
            >
              <div style={{ fontWeight: 600, fontSize: 15 }}>{t.name}</div>
              <div style={{ fontSize: 13, color: '#777' }}>{t.category} · v{t.currentVersion}</div>
            </div>
          ))}
          {templates.length === 0 && <p style={{ fontSize: 14, color: '#999', padding: 10 }}>No templates yet.</p>}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {selected && currentVersion ? (
          canEdit ? (
            <TemplateEditor template={selected} version={currentVersion} onSaved={async () => { const list = (await templateService.list()).items; setTemplates(list); setSelected(list.find((t) => t.id === selected.id) ?? null); }} />
          ) : (
            <TemplateReadOnlyView template={selected} version={currentVersion} />
          )
        ) : (
          <p style={{ color: '#999' }}>Select a template to view its content.</p>
        )}
      </div>
    </div>
  );
}

function TemplateReadOnlyView({ template, version }: { template: Template; version: ReturnType<typeof templateService.getCurrentVersion> }) {
  return (
    <div className="glass-panel" style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0, fontSize: 16 }}>{template.name} (v{version.versionNumber}) — chỉ xem</h2>
      <label style={labelStyle}>Subject (VI)</label>
      <p style={{ marginBottom: 12 }}>{version.subjectVi || '—'}</p>
      <label style={labelStyle}>Subject (EN)</label>
      <p style={{ marginBottom: 12 }}>{version.subjectEn || '—'}</p>
      <label style={labelStyle}>Body (VI)</label>
      <div style={readOnlyBox} dangerouslySetInnerHTML={{ __html: version.bodyVi || '<p style="color:#999">—</p>' }} />
      <label style={{ ...labelStyle, marginTop: 14 }}>Body (EN)</label>
      <div style={readOnlyBox} dangerouslySetInnerHTML={{ __html: version.bodyEn || '<p style="color:#999">—</p>' }} />
    </div>
  );
}

function TemplateEditor({ template, version, onSaved }: { template: Template; version: ReturnType<typeof templateService.getCurrentVersion>; onSaved: () => void }) {
  const [subjectVi, setSubjectVi] = useState(version.subjectVi);
  const [subjectEn, setSubjectEn] = useState(version.subjectEn);
  const [bodyVi, setBodyVi] = useState(version.bodyVi);
  const [bodyEn, setBodyEn] = useState(version.bodyEn);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSubjectVi(version.subjectVi); setSubjectEn(version.subjectEn);
    setBodyVi(version.bodyVi); setBodyEn(version.bodyEn);
  }, [version]);

  async function handleSaveDraft() {
    setSaving(true);
    await templateService.saveNewVersion(template.id, { subjectVi, subjectEn, bodyVi, bodyEn });
    setSaving(false);
    onSaved();
  }

  async function handlePublish() {
    await handleSaveDraft();
    const fresh = await templateService.getById(template.id);
    if (fresh) await templateService.publishVersion(template.id, fresh.currentVersion);
    onSaved();
  }

  return (
    <div className="glass-panel" style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0, fontSize: 16 }}>{template.name} — editing v{version.versionNumber + 1} (draft)</h2>
      <p style={{ fontSize: 14, color: '#777' }}>Use placeholders like {'{{FULL_NAME}}'}, {'{{PRONOUN}}'}, {'{{SIGNATURE}}'}, {'{{CARD}}'}.</p>

      <label style={labelStyle}>Subject (VI)<input value={subjectVi} onChange={(e) => setSubjectVi(e.target.value)} style={inputStyle} /></label>
      <label style={labelStyle}>Subject (EN)<input value={subjectEn} onChange={(e) => setSubjectEn(e.target.value)} style={inputStyle} /></label>
      <label style={labelStyle}>Body (VI)</label>
      <RichTextEditor value={bodyVi} onChange={setBodyVi} placeholder="Nội dung email (VI)…" />
      <label style={{ ...labelStyle, marginTop: 12 }}>Body (EN)</label>
      <RichTextEditor value={bodyEn} onChange={setBodyEn} placeholder="Email content (EN)…" />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={handleSaveDraft} disabled={saving} style={secondaryButtonStyle}>Save as Draft</button>
        <button onClick={handlePublish} disabled={saving} style={primaryButtonStyle}>Publish</button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, marginBottom: 10 };
const inputStyle: React.CSSProperties = { width: '100%', padding: 8, marginTop: 4, borderRadius: 8, border: '1px solid #d0d7e2', fontFamily: 'inherit' };
const primaryButtonStyle: React.CSSProperties = { padding: '10px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' };
const secondaryButtonStyle: React.CSSProperties = { padding: '10px 16px', background: '#eee', color: '#333', border: 'none', borderRadius: 10, cursor: 'pointer' };
const readOnlyBox: React.CSSProperties = { padding: 12, borderRadius: 8, border: '1px solid #eee', background: '#fafafa' };

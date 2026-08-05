import { useEffect, useRef, useState } from 'react';
import type { Customer } from '../../types/entities';
import { customerService } from '../../services/customer/customerService';
import { cardTemplateService } from '../../services/card/cardTemplateService';
import type { CardTemplateWithPath } from '../../data/repositories/CardTemplateRepository';
import { cardGeneratorService, type TextBlockRenderConfig } from '../../services/card/cardRenderService';
import { buildPlaceholderMap, renderPlaceholders } from '../../utils/placeholderEngine';
import { CardTemplateEditor } from '../../components/card/CardTemplateEditor';
import { CustomerPicker } from '../../components/common/CustomerPicker';

export default function CardGeneratorPage() {
  const [tab, setTab] = useState<'generate' | 'manage'>('generate');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>eCard Generator</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <TabButton active={tab === 'generate'} onClick={() => setTab('generate')}>Generate</TabButton>
          <TabButton active={tab === 'manage'} onClick={() => setTab('manage')}>Manage Templates</TabButton>
        </div>
      </div>
      <p style={{ marginTop: 4, marginBottom: 20 }}>
        Bước 1: tạo eCard cho khách hàng ở đây trước → Bước 2: sang <strong>Email Generator</strong>, thiệp này sẽ tự động đính kèm sẵn vào email.
      </p>
      {tab === 'generate' ? <GenerateTab /> : <ManageTab />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
        background: active ? 'var(--color-primary)' : 'rgba(255,255,255,0.7)', color: active ? '#fff' : 'var(--text-main)',
      }}
    >
      {children}
    </button>
  );
}

function GenerateTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [templates, setTemplates] = useState<CardTemplateWithPath[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasBlobRef = useRef<Blob | null>(null);

  const customer = customers.find((c) => c.id === customerId);

  useEffect(() => {
    customerService.list({ pageSize: 1000 }).then((r) => setCustomers(r.items));
    cardTemplateService.list().then((r) => setTemplates(r.items));
  }, []);

  useEffect(() => {
    if (!customer) return;
    const genderTemplates = templates.filter((t) => t.gender === (customer.gender === 'female' ? 'female' : 'male'));
    const defaultTemplate = genderTemplates.find((t) => t.isDefault) ?? genderTemplates[0];
    if (defaultTemplate) setTemplateId(defaultTemplate.id);
  }, [customer, templates]);

  async function handleGenerate() {
    setError(null);
    const template = templates.find((t) => t.id === templateId);
    if (!customer) { setError('Select a customer.'); return; }
    if (!template) { setError('No card template available for this gender yet — add one in "Manage Templates".'); return; }
    try {
      const imageUrl = await cardTemplateService.getImageUrl(template);
      const map = buildPlaceholderMap({ customer, language: customer.language });
      const blocks: TextBlockRenderConfig[] = [
        { lines: [customer.fullName], xPercent: template.namePosition.xPercent, yPercent: template.namePosition.yPercent, font: template.font },
      ];
      if (template.messageBox) {
        const rendered = renderPlaceholders(template.messageBox.text, map);
        blocks.push({
          lines: rendered.split('\n'),
          xPercent: template.messageBox.xPercent,
          yPercent: template.messageBox.yPercent,
          font: template.messageBox.font,
          lineHeightPx: template.messageBox.lineHeightPx,
        });
      }
      const blob = await cardGeneratorService.render(imageUrl, blocks);
      canvasBlobRef.current = blob;
      setPreviewUrl(URL.createObjectURL(blob));
      await cardGeneratorService.recordHistory(customer, template.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate card');
    }
  }

  function handleDownload() {
    if (canvasBlobRef.current) cardGeneratorService.download(canvasBlobRef.current, `card-${customer?.fullName ?? 'customer'}.png`);
  }

  const availableTemplates = customer ? templates.filter((t) => t.gender === (customer.gender === 'female' ? 'female' : 'male')) : [];

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      <div className="glass-panel" style={{ padding: 22, width: 320 }}>
        <label style={labelStyle}>Customer
          <CustomerPicker customers={customers} value={customerId} onChange={setCustomerId} completedField="ecardSent" />
        </label>
        <label style={labelStyle}>Card template
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={inputStyle}>
            <option value="">— select —</option>
            {availableTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}
          </select>
        </label>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>{error}</p>}
        <button onClick={handleGenerate} style={{ width: '100%', padding: 12, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
          Generate Card
        </button>
        {previewUrl && (
          <button onClick={handleDownload} style={{ width: '100%', padding: 12, marginTop: 8, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(20,126,147,0.18)', borderRadius: 12, cursor: 'pointer' }}>
            Download PNG
          </button>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 22 }} className="glass-panel">
        {previewUrl ? (
          <img src={previewUrl} alt="Card preview" style={{ maxWidth: '100%', borderRadius: 14 }} />
        ) : (
          <p>Select a customer and generate to preview.</p>
        )}
      </div>
    </div>
  );
}

function ManageTab() {
  const [templates, setTemplates] = useState<CardTemplateWithPath[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [editorGender, setEditorGender] = useState<CardTemplateWithPath['gender'] | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<CardTemplateWithPath | null>(null);

  async function reload() {
    const list = (await cardTemplateService.list()).items;
    setTemplates(list);
    const urls: Record<string, string> = {};
    for (const t of list) urls[t.id] = await cardTemplateService.getImageUrl(t);
    setThumbnails(urls);
  }
  useEffect(() => { reload(); }, []);

  async function handleDelete(id: string) {
    if (!confirm('Delete this card template?')) return;
    await cardTemplateService.remove(id);
    reload();
  }

  const male = templates.filter((t) => t.gender === 'male');
  const female = templates.filter((t) => t.gender === 'female');

  return (
    <div>
      {(['male', 'female'] as const).map((gender) => (
        <div key={gender} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3>{gender === 'male' ? 'Male templates' : 'Female templates'} ({gender === 'male' ? male.length : female.length})</h3>
            <button onClick={() => setEditorGender(gender)} style={{ padding: '10px 16px', border: 'none', borderRadius: 12, background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}>
              + Add {gender} template
            </button>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {(gender === 'male' ? male : female).map((t) => (
              <div key={t.id} className="glass-panel" style={{ width: 180, padding: 14 }}>
                {thumbnails[t.id] && <img src={thumbnails[t.id]} alt={t.name} style={{ width: '100%', borderRadius: 12 }} />}
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>{t.name} {t.isDefault && '⭐'}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                  <button onClick={() => setEditingTemplate(t)} style={{ fontSize: 13, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(t.id)} style={{ fontSize: 13, color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {(gender === 'male' ? male : female).length === 0 && <p>No templates yet.</p>}
          </div>
        </div>
      ))}

      {editorGender && (
        <CardTemplateEditor gender={editorGender} onClose={() => setEditorGender(null)} onSaved={() => { setEditorGender(null); reload(); }} />
      )}
      {editingTemplate && (
        <CardTemplateEditor
          gender={editingTemplate.gender}
          existingTemplate={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => { setEditingTemplate(null); reload(); }}
        />
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, marginBottom: 14 };
const inputStyle: React.CSSProperties = { width: '100%' };

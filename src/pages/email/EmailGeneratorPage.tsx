import { useEffect, useState } from 'react';
import type { Customer, Template } from '../../types/entities';
import type { Language } from '../../config/constants';
import { customerService } from '../../services/customer/customerService';
import { templateService } from '../../services/template/templateService';
import { signatureService } from '../../services/signature/signatureService';
import { cardTemplateService } from '../../services/card/cardTemplateService';
import type { CardTemplateWithPath } from '../../data/repositories/CardTemplateRepository';
import { cardGeneratorService, type TextBlockRenderConfig } from '../../services/card/cardRenderService';
import { emailGeneratorService, type RenderedEmail } from '../../services/email/emailRenderService';
import { buildPlaceholderMap, renderPlaceholders } from '../../utils/placeholderEngine';
import { blobToDataUrl } from '../../utils/fileUtils';
import { CustomerPicker } from '../../components/common/CustomerPicker';

export default function EmailGeneratorPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [cardTemplates, setCardTemplates] = useState<CardTemplateWithPath[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [cardTemplateId, setCardTemplateId] = useState('');
  const [includeCard, setIncludeCard] = useState(true);
  const [language, setLanguage] = useState<Language>('vi');
  const [rendered, setRendered] = useState<RenderedEmail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const customer = customers.find((c) => c.id === customerId);
  const availableCardTemplates = customer ? cardTemplates.filter((t) => t.gender === (customer.gender === 'female' ? 'female' : 'male')) : [];

  useEffect(() => {
    (async () => {
      setCustomers((await customerService.list({ pageSize: 1000 })).items);
      setTemplates((await templateService.list()).items);
      setCardTemplates((await cardTemplateService.list()).items);
    })();
  }, []);

  useEffect(() => {
    if (!customer) return;
    const genderCardTemplates = cardTemplates.filter((t) => t.gender === (customer.gender === 'female' ? 'female' : 'male'));
    const defaultTemplate = genderCardTemplates.find((t) => t.isDefault) ?? genderCardTemplates[0];
    if (defaultTemplate) setCardTemplateId(defaultTemplate.id);
  }, [customer, cardTemplates]);

  async function buildCardHtml(): Promise<string | undefined> {
    if (!includeCard || !customer) return undefined;
    const cardTemplate = cardTemplates.find((t) => t.id === cardTemplateId);
    if (!cardTemplate) return undefined;

    const imageUrl = await cardTemplateService.getImageUrl(cardTemplate);
    const map = buildPlaceholderMap({ customer, language });
    const blocks: TextBlockRenderConfig[] = [
      { lines: [customer.fullName], xPercent: cardTemplate.namePosition.xPercent, yPercent: cardTemplate.namePosition.yPercent, font: cardTemplate.font },
    ];
    if (cardTemplate.messageBox) {
      const text = renderPlaceholders(cardTemplate.messageBox.text, map);
      blocks.push({
        lines: text.split('\n'),
        xPercent: cardTemplate.messageBox.xPercent,
        yPercent: cardTemplate.messageBox.yPercent,
        font: cardTemplate.messageBox.font,
        lineHeightPx: cardTemplate.messageBox.lineHeightPx,
      });
    }
    const blob = await cardGeneratorService.render(imageUrl, blocks);
    const dataUrl = await blobToDataUrl(blob);
    return `<img src="${dataUrl}" alt="eCard" width="600" style="max-width:600px;width:100%;height:auto;border-radius:12px;display:block;" />`;
  }

  async function handleGenerate() {
    setError(null);
    setCopied(false);
    const template = templates.find((t) => t.id === templateId);
    if (!customer || !template) { setError('Select a customer and a template first.'); return; }

    setGenerating(true);
    try {
      const version = templateService.getCurrentVersion(template);
      const signature = await signatureService.getDefault();
      const cardHtml = await buildCardHtml();
      const result = emailGeneratorService.render(version, customer, language, signature, cardHtml);
      setRendered(result);
      await emailGeneratorService.recordHistory({ customer, language, templateId: template.id, generatedContent: result.html });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate email');
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyHtml() {
    if (!rendered) return;
    navigator.clipboard.writeText(rendered.html);
    setCopied(true);
  }

  return (
    <div>
      <h1>Email Generator</h1>
      <p style={{ marginTop: 4, marginBottom: 20 }}>eCard và chữ ký mặc định sẽ tự động đính kèm phía dưới nội dung — chỉ cần copy và dán vào Outlook.</p>
      <div style={{ display: 'flex', gap: 20 }}>
        <div className="glass-panel" style={{ padding: 22, width: 340 }}>
          <label style={labelStyle}>Customer
            <CustomerPicker customers={customers} value={customerId} onChange={setCustomerId} completedField="ecardSent" />
          </label>
          <label style={labelStyle}>Template
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={inputStyle}>
              <option value="">— select —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Language
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} style={inputStyle}>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, margin: '4px 0 10px' }}>
            <input type="checkbox" checked={includeCard} onChange={(e) => setIncludeCard(e.target.checked)} />
            Đính kèm eCard
          </label>
          {includeCard && (
            <label style={labelStyle}>eCard template
              <select value={cardTemplateId} onChange={(e) => setCardTemplateId(e.target.value)} style={inputStyle}>
                <option value="">— none —</option>
                {availableCardTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}
              </select>
              {availableCardTemplates.length === 0 && customer && (
                <span style={{ fontSize: 12, color: 'var(--color-warning)' }}>Chưa có template thiệp cho giới tính này — tạo ở eCard Generator.</span>
              )}
            </label>
          )}

          {error && <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>{error}</p>}
          <button onClick={handleGenerate} disabled={generating} style={{ width: '100%', padding: 12, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
            {generating ? 'Đang tạo…' : 'Generate'}
          </button>
        </div>

        <div style={{ flex: 1 }}>
          {rendered ? (
            <div className="glass-panel" style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <strong>Subject: {rendered.subject}</strong>
                <button onClick={handleCopyHtml} style={{ padding: '8px 16px', border: 'none', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}>
                  {copied ? '✓ Copied' : 'Copy HTML for Outlook'}
                </button>
              </div>
              <iframe title="email-preview" srcDoc={rendered.html} style={{ width: '100%', height: 560, marginTop: 14, border: '1px solid rgba(20,126,147,0.15)', borderRadius: 12, background: '#fff' }} />
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: 40, textAlign: 'center' }}>
              <p>Generate một preview để xem email sẵn sàng dán vào Outlook tại đây.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, marginBottom: 14 };
const inputStyle: React.CSSProperties = { width: '100%' };

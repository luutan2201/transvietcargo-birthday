import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { copyRichHtml } from '../../utils/richClipboard';
import { openMailto } from '../../utils/mailto';
import { getEmailCcForStation } from '../../config/constants';
import { CustomerPicker } from '../../components/common/CustomerPicker';

export default function EmailGeneratorPage() {
  const [searchParams] = useSearchParams();
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
  const [copied, setCopied] = useState<'rich' | 'fallback' | null>(null);

  const customer = customers.find((c) => c.id === customerId);
  const availableCardTemplates = customer ? cardTemplates.filter((t) => t.gender === (customer.gender === 'female' ? 'female' : 'male')) : [];

  useEffect(() => {
    (async () => {
      setCustomers((await customerService.list({ pageSize: 1000 })).items);
      const templateList = (await templateService.list()).items;
      setTemplates(templateList);
      setCardTemplates((await cardTemplateService.list()).items);

      // Coming from the "Cần xử lý hôm nay" panel — pre-select the
      // customer and default to a birthday template so it's ready to
      // Generate immediately.
      const fromUrl = searchParams.get('customerId');
      if (fromUrl) {
        setCustomerId(fromUrl);
        const birthdayTemplate = templateList.find((t) => t.category === 'birthday');
        if (birthdayTemplate) setTemplateId(birthdayTemplate.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setCopied(null);
    const template = templates.find((t) => t.id === templateId);
    if (!customer || !template) { setError('Select a customer and a template first.'); return; }

    setGenerating(true);
    try {
      const version = templateService.getCurrentVersion(template);
      const signature = await signatureService.getEffectiveSignature();
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

  async function handleCopyHtml() {
    if (!rendered) return;
    const richSuccess = await copyRichHtml(rendered.html);
    setCopied(richSuccess ? 'rich' : 'fallback');
  }

  async function handleOpenInOutlook() {
    if (!rendered || !customer) return;
    const richSuccess = await copyRichHtml(rendered.html);
    setCopied(richSuccess ? 'rich' : 'fallback');
    openMailto({ to: customer.email, cc: getEmailCcForStation(customer.station), subject: rendered.subject });
  }

  return (
    <div>
      <h1>Email Generator</h1>
      <p style={{ marginTop: 4, marginBottom: 20 }}>eCard và chữ ký sẽ tự động đính kèm phía dưới nội dung — bấm "Mở trong Outlook" để tự điền người nhận/CC/tiêu đề, rồi Ctrl+V để dán nội dung.</p>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <strong>Subject: {rendered.subject}</strong>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleCopyHtml} style={{ padding: '8px 16px', border: 'none', borderRadius: 10, background: 'rgba(255,255,255,0.8)', color: 'var(--color-primary)', boxShadow: '0 0 0 1px rgba(20,126,147,0.25)', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}>
                    {copied === 'rich' ? '✓ Đã copy' : 'Chỉ Copy nội dung'}
                  </button>
                  <button onClick={handleOpenInOutlook} style={{ padding: '8px 16px', border: 'none', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap', fontWeight: 600 }}>
                    ✉ Mở trong Outlook
                  </button>
                </div>
              </div>
              {copied === 'rich' && (
                <p style={{ fontSize: 13, color: 'var(--color-success)', marginTop: 8, fontWeight: 600 }}>
                  Nội dung đã sẵn trong bộ nhớ tạm — trong cửa sổ Outlook vừa mở, bấm vào phần thân email rồi nhấn <kbd>Ctrl+V</kbd> để dán, sau đó Send.
                </p>
              )}
              {copied === 'fallback' && (
                <p style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 6 }}>
                  Trình duyệt không hỗ trợ copy định dạng — đã copy mã HTML thô, dán vào Outlook có thể không giữ được định dạng.
                  Thử lại bằng Chrome/Edge phiên bản mới.
                </p>
              )}
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

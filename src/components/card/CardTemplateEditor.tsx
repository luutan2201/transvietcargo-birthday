import { useEffect, useRef, useState } from 'react';
import type { CardTemplate, TextAlign } from '../../types/entities';
import type { CardTemplateWithPath } from '../../data/repositories/CardTemplateRepository';
import { cardTemplateService } from '../../services/card/cardTemplateService';
import { cardGeneratorService, type TextBlockRenderConfig } from '../../services/card/cardRenderService';
import { buildPlaceholderMap, renderPlaceholders } from '../../utils/placeholderEngine';
import type { Customer } from '../../types/entities';

interface Props {
  gender: CardTemplate['gender'];
  existingTemplate?: CardTemplateWithPath;
  onClose: () => void;
  onSaved: () => void;
}

const FONT_FAMILIES = ['Arial', 'Segoe UI', 'Times New Roman', 'Georgia', 'Verdana'];
const ALIGN_OPTIONS: Array<{ value: TextAlign; label: string }> = [
  { value: 'left', label: 'Left (e.g. after "Dear: Mr. ")' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const SAMPLE_CUSTOMER: Customer = {
  id: 'sample', createdAt: '', updatedAt: '',
  fullName: 'Lưu Cảnh Tân', firstName: 'Tân', lastName: 'Lưu Cảnh',
  gender: 'male', email: 'sample@transviet.com', language: 'vi', status: 'active',
  greetingType: 'ecard_only', station: 'SGN', ecardSent: false, giftGiven: false,
};

type ActiveField = 'name' | 'message';

export function CardTemplateEditor({ gender, existingTemplate, onClose, onSaved }: Props) {
  const isEditing = !!existingTemplate;
  const [name, setName] = useState(existingTemplate?.name ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [previewScale, setPreviewScale] = useState(1);
  const [activeField, setActiveField] = useState<ActiveField>('name');

  const [namePos, setNamePos] = useState(existingTemplate?.namePosition ?? { xPercent: 30, yPercent: 42 });
  const [nameFont, setNameFont] = useState<FontState>(
    existingTemplate ? { ...existingTemplate.font, bold: existingTemplate.font.bold ?? false, italic: existingTemplate.font.italic ?? false } : { family: 'Arial', sizePx: 28, color: '#FFD700', align: 'left', bold: true, italic: false }
  );

  const [messageEnabled, setMessageEnabled] = useState(!!existingTemplate?.messageBox);
  const [messagePos, setMessagePos] = useState(existingTemplate?.messageBox ?? { xPercent: 30, yPercent: 52 });
  const [messageText, setMessageText] = useState(
    existingTemplate?.messageBox?.text ??
    'On this special day, we at TransViet Cargo would like to extend our\nwarmest wishes to you. May your year ahead be filled with health,\nhappiness, and success.'
  );
  const [messageFont, setMessageFont] = useState<FontState>(
    existingTemplate?.messageBox
      ? { ...existingTemplate.messageBox.font, bold: existingTemplate.messageBox.font.bold ?? false, italic: existingTemplate.messageBox.font.italic ?? false }
      : { family: 'Arial', sizePx: 14, color: '#FFFFFF', align: 'left', bold: false, italic: false }
  );
  const [messageLineHeight, setMessageLineHeight] = useState(existingTemplate?.messageBox?.lineHeightPx ?? 20);

  const [isDefault, setIsDefault] = useState(existingTemplate?.isDefault ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveRenderUrl, setLiveRenderUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (existingTemplate) {
      cardTemplateService.getImageUrl(existingTemplate).then(setImageUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setImageUrl(URL.createObjectURL(f));
    setLiveRenderUrl(null);
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const el = e.currentTarget;
    setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
    if (el.naturalWidth > 0) setPreviewScale(el.clientWidth / el.naturalWidth);
  }

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xPercent = Math.round((((e.clientX - rect.left) / rect.width) * 100) * 10) / 10;
    const yPercent = Math.round((((e.clientY - rect.top) / rect.height) * 100) * 10) / 10;
    if (activeField === 'name') setNamePos({ xPercent, yPercent });
    else setMessagePos({ xPercent, yPercent });
  }

  function buildBlocks(): TextBlockRenderConfig[] {
    const map = buildPlaceholderMap({ customer: SAMPLE_CUSTOMER, language: 'vi' });
    const blocks: TextBlockRenderConfig[] = [
      { lines: [SAMPLE_CUSTOMER.fullName], xPercent: namePos.xPercent, yPercent: namePos.yPercent, font: nameFont },
    ];
    if (messageEnabled) {
      const rendered = renderPlaceholders(messageText, map);
      blocks.push({
        lines: rendered.split('\n'),
        xPercent: messagePos.xPercent,
        yPercent: messagePos.yPercent,
        font: messageFont,
        lineHeightPx: messageLineHeight,
      });
    }
    return blocks;
  }

  async function handleLivePreview() {
    if (!imageUrl) return;
    setRendering(true);
    try {
      const blob = await cardGeneratorService.render(imageUrl, buildBlocks());
      setLiveRenderUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setRendering(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (!isEditing && !file) { setError('Upload a PNG image first.'); return; }
    if (!name.trim()) { setError('Give the template a name.'); return; }
    setSaving(true);
    try {
      const messageBox = messageEnabled
        ? { text: messageText, xPercent: messagePos.xPercent, yPercent: messagePos.yPercent, lineHeightPx: messageLineHeight, font: messageFont }
        : undefined;

      if (isEditing && existingTemplate) {
        await cardTemplateService.update(
          existingTemplate.id,
          { name, namePosition: namePos, font: nameFont, messageBox, isDefault },
          file ?? undefined
        );
      } else if (file) {
        await cardTemplateService.save({ name, gender, file, namePosition: namePos, font: nameFont, messageBox, isDefault });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div className="glass-panel" style={{ padding: 24, width: 900, maxHeight: '92vh', overflowY: 'auto' }}>
        <h2 style={{ marginTop: 0, color: 'var(--color-primary)' }}>
          {isEditing ? `Edit ${gender === 'male' ? 'Male' : 'Female'} Card Template` : `New ${gender === 'male' ? 'Male' : 'Female'} Card Template`}
        </h2>

        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 320 }}>
            <label style={labelStyle}>Template name<input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></label>
            <label style={labelStyle}>{isEditing ? 'Replace background PNG (optional)' : 'Background PNG'}<input type="file" accept="image/png" onChange={handleFile} style={{ display: 'block', marginTop: 4 }} /></label>
            {naturalSize.w > 0 && <p style={{ fontSize: 13, color: '#999' }}>Actual image size: {naturalSize.w} × {naturalSize.h}px</p>}

            <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
              <button type="button" onClick={() => setActiveField('name')} style={activeField === 'name' ? tabActive : tabInactive}>📍 Positioning: Name</button>
              <button type="button" onClick={() => setActiveField('message')} style={activeField === 'message' ? tabActive : tabInactive} disabled={!messageEnabled}>📍 Positioning: Message</button>
            </div>

            <fieldset style={fieldsetStyle}>
              <legend style={legendStyle}>Name text</legend>
              <PositionInput pos={namePos} onChange={setNamePos} naturalSize={naturalSize} />
              <FontControls font={nameFont} onChange={setNameFont} />
            </fieldset>

            <fieldset style={fieldsetStyle}>
              <legend style={legendStyle}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={messageEnabled} onChange={(e) => { setMessageEnabled(e.target.checked); if (e.target.checked) setActiveField('message'); }} />
                  Message paragraph
                </label>
              </legend>
              {messageEnabled && (
                <>
                  <label style={labelStyle}>
                    Text (Enter = xuống dòng đúng như bạn gõ; hỗ trợ {'{{FULL_NAME}}'}, {'{{PRONOUN}}'}…)
                    <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={5} style={{ ...inputStyle, fontFamily: 'inherit' }} />
                  </label>
                  <PositionInput pos={messagePos} onChange={setMessagePos} naturalSize={naturalSize} />
                  <label style={labelStyle}>Line height (px)<input type="number" min={10} value={messageLineHeight} onChange={(e) => setMessageLineHeight(Number(e.target.value))} style={inputStyle} /></label>
                  <FontControls font={messageFont} onChange={setMessageFont} />
                </>
              )}
            </fieldset>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, marginTop: 8 }}>
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Set as default template for {gender}
            </label>

            {error && <p style={{ color: 'var(--color-danger)', fontSize: 15 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} style={primaryButtonStyle}>{saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Save Template'}</button>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 340 }}>
            <p style={{ fontSize: 14, color: '#777', marginBottom: 6 }}>
              Click on the image to set the <strong>{activeField === 'name' ? 'name' : 'message'}</strong> position (rough guide):
            </p>
            {imageUrl ? (
              <div ref={imgRef} onClick={handleImageClick} style={{ position: 'relative', cursor: 'crosshair', border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
                <img src={imageUrl} alt="Template preview" onLoad={handleImageLoad} style={{ width: '100%', display: 'block' }} />
                <Marker pos={namePos} font={nameFont} scale={previewScale} label="Name" active={activeField === 'name'} />
                {messageEnabled && <Marker pos={messagePos} font={messageFont} scale={previewScale} label="Msg" active={activeField === 'message'} />}
              </div>
            ) : (
              <p style={{ color: '#999', fontSize: 15 }}>Upload a PNG to preview and set position.</p>
            )}

            <button type="button" onClick={handleLivePreview} disabled={!imageUrl || rendering} style={{ ...secondaryButtonStyle, width: '100%', marginTop: 10 }}>
              {rendering ? 'Rendering…' : '🔍 Exact live preview (real render, sample name)'}
            </button>
            {liveRenderUrl && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 13, color: '#777' }}>This is pixel-exact to the final PNG output:</p>
                <img src={liveRenderUrl} alt="Live render" style={{ width: '100%', borderRadius: 8, border: '1px solid #ddd' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Marker({ pos, font, scale, label, active }: { pos: { xPercent: number; yPercent: number }; font: { align: TextAlign; color: string }; scale: number; label: string; active: boolean }) {
  const transform = font.align === 'left' ? 'translate(0, -50%)' : font.align === 'right' ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)';
  return (
    <span
      style={{
        position: 'absolute', left: `${pos.xPercent}%`, top: `${pos.yPercent}%`, transform,
        display: 'flex', alignItems: 'center', gap: 4, pointerEvents: 'none',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? 'var(--color-danger)' : font.color, border: '1px solid #fff', boxShadow: '0 0 3px rgba(0,0,0,0.6)' }} />
      <span style={{ fontSize: Math.max(9, 10 * scale), color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '1px 4px', borderRadius: 4 }}>{label}</span>
    </span>
  );
}

interface FontState { family: string; sizePx: number; color: string; align: TextAlign; bold: boolean; italic: boolean }

function PositionInput({
  pos,
  onChange,
  naturalSize,
}: {
  pos: { xPercent: number; yPercent: number };
  onChange: (p: { xPercent: number; yPercent: number }) => void;
  naturalSize: { w: number; h: number };
}) {
  const hasSize = naturalSize.w > 0 && naturalSize.h > 0;
  const xPx = hasSize ? Math.round((pos.xPercent / 100) * naturalSize.w) : 0;
  const yPx = hasSize ? Math.round((pos.yPercent / 100) * naturalSize.h) : 0;

  function nudge(dx: number, dy: number) {
    onChange({ xPercent: Math.round((pos.xPercent + dx) * 10) / 10, yPercent: Math.round((pos.yPercent + dy) * 10) / 10 });
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <label style={{ ...labelStyle, flex: 1 }}>X (%)
          <input type="number" step={0.1} value={pos.xPercent} onChange={(e) => onChange({ ...pos, xPercent: Number(e.target.value) })} style={inputStyle} />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>Y (%)
          <input type="number" step={0.1} value={pos.yPercent} onChange={(e) => onChange({ ...pos, yPercent: Number(e.target.value) })} style={inputStyle} />
        </label>
      </div>
      {hasSize && (
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ ...labelStyle, flex: 1 }}>X (px, of {naturalSize.w})
            <input type="number" value={xPx} onChange={(e) => onChange({ ...pos, xPercent: (Number(e.target.value) / naturalSize.w) * 100 })} style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>Y (px, of {naturalSize.h})
            <input type="number" value={yPx} onChange={(e) => onChange({ ...pos, yPercent: (Number(e.target.value) / naturalSize.h) * 100 })} style={inputStyle} />
          </label>
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
        <span style={{ fontSize: 13, color: '#999', marginRight: 4 }}>Nudge:</span>
        <button type="button" onClick={() => nudge(-0.5, 0)} style={nudgeBtn}>◀</button>
        <button type="button" onClick={() => nudge(0.5, 0)} style={nudgeBtn}>▶</button>
        <button type="button" onClick={() => nudge(0, -0.5)} style={nudgeBtn}>▲</button>
        <button type="button" onClick={() => nudge(0, 0.5)} style={nudgeBtn}>▼</button>
      </div>
    </div>
  );
}

function FontControls({ font, onChange }: { font: FontState; onChange: (f: FontState) => void }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <label style={{ ...labelStyle, flex: 1 }}>Font
          <select value={font.family} onChange={(e) => onChange({ ...font, family: e.target.value })} style={inputStyle}>
            {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label style={{ ...labelStyle, width: 80 }}>Size<input type="number" min={8} value={font.sizePx} onChange={(e) => onChange({ ...font, sizePx: Number(e.target.value) })} style={inputStyle} /></label>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <label style={{ ...labelStyle, flex: 1 }}>Color<input type="color" value={font.color} onChange={(e) => onChange({ ...font, color: e.target.value })} style={{ ...inputStyle, height: 38, padding: 4 }} /></label>
        <label style={{ ...labelStyle, flex: 1 }}>Align
          <select value={font.align} onChange={(e) => onChange({ ...font, align: e.target.value as TextAlign })} style={inputStyle}>
            {ALIGN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 14, margin: '6px 0 10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={font.bold} onChange={(e) => onChange({ ...font, bold: e.target.checked })} /> Bold</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={font.italic} onChange={(e) => onChange({ ...font, italic: e.target.checked })} /> Italic</label>
      </div>
    </>
  );
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, marginBottom: 8 };
const inputStyle: React.CSSProperties = { width: '100%', padding: 8, marginTop: 4, borderRadius: 8, border: '1px solid #d0d7e2', fontFamily: 'inherit' };
const primaryButtonStyle: React.CSSProperties = { padding: '10px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' };
const secondaryButtonStyle: React.CSSProperties = { padding: '10px 16px', background: '#eee', color: '#333', border: 'none', borderRadius: 10, cursor: 'pointer' };
const fieldsetStyle: React.CSSProperties = { border: '1px solid #e2e6ec', borderRadius: 10, padding: 10, marginBottom: 12 };
const legendStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, padding: '0 6px' };
const tabActive: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: 14 };
const tabInactive: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#333', cursor: 'pointer', fontSize: 14 };
const nudgeBtn: React.CSSProperties = { width: 28, height: 24, border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 };

import { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

// Force inline-style based formatting instead of Quill's default CSS
// classes (e.g. class="ql-align-center") — Outlook Desktop has no access
// to Quill's stylesheet, so only inline styles render correctly there.
// Quill.import returns `unknown`; these are registered via the untyped
// dynamic-import API, so a targeted `any` cast is required here.
/* eslint-disable @typescript-eslint/no-explicit-any */
const AlignStyle = Quill.import('attributors/style/align') as any;
const ColorStyle = Quill.import('attributors/style/color') as any;
const BackgroundStyle = Quill.import('attributors/style/background') as any;
const SizeStyle = Quill.import('attributors/style/size') as any;
SizeStyle.whitelist = ['10px', '12px', '13px', '14px', '16px', '18px', '20px', '24px', '28px'];
const FontStyle = Quill.import('attributors/style/font') as any;
FontStyle.whitelist = ['Arial', 'Segoe UI', 'Times New Roman', 'Calibri', 'Georgia', 'Verdana'];
Quill.register(AlignStyle, true);
Quill.register(ColorStyle, true);
Quill.register(BackgroundStyle, true);
Quill.register(SizeStyle, true);
Quill.register(FontStyle, true);
/* eslint-enable @typescript-eslint/no-explicit-any */

// Quill's picker only shows a font name in the dropdown if a matching
// ::before rule exists — without this, every custom font whitelist entry
// falls back to the same generic label (this is what was showing
// "Sans Serif" repeated for every option instead of the real font names).
const FONT_CSS_ID = 'rich-text-editor-font-css';
if (typeof document !== 'undefined' && !document.getElementById(FONT_CSS_ID)) {
  const style = document.createElement('style');
  style.id = FONT_CSS_ID;
  style.textContent = FontStyle.whitelist
    .map(
      (font: string) => `
        .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="${font}"]::before,
        .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="${font}"]::before {
          content: "${font}";
          font-family: "${font}", sans-serif;
        }
        .ql-font-${font.replace(/\s+/g, '-')} { font-family: "${font}", sans-serif; }
      `
    )
    .join('\n');
  style.textContent += `.ql-snow .ql-picker.ql-font { width: 150px; }`;
  document.head.appendChild(style);
}

interface Props {
  value: string; // HTML
  onChange: (html: string) => void;
  placeholder?: string;
  /** Full Outlook-style toolbar (font family, size, background color,
   * image upload) — used for the signature editor. Defaults to the
   * simpler toolbar (bold/italic/underline/color/align) used for email
   * template bodies, unchanged from before. */
  full?: boolean;
}

/**
 * Quill-based rich text editor — used both for template email bodies and
 * for the Outlook-style signature editor. Toolbar emits inline styles
 * (not CSS classes), which stay compatible with the Outlook-safe table
 * wrapper in emailRenderService. Paragraph breaks (Enter) become real
 * <p> tags, so line breaks are preserved exactly instead of being
 * collapsed like a plain-text <textarea> would. Image uploads are read
 * as base64 and embedded inline, so signatures/emails stay a single
 * self-contained block of HTML with no external image dependency.
 */
export function RichTextEditor({ value, onChange, placeholder, full }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || quillRef.current) return;
    const mountEl = containerRef.current;
    const editorEl = document.createElement('div');
    mountEl.appendChild(editorEl);

    const toolbar = full
      ? [
          [{ font: FontStyle.whitelist }, { size: SizeStyle.whitelist }],
          ['bold', 'italic', 'underline'],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          ['image'],
          ['clean'],
        ]
      : [['bold', 'italic', 'underline'], [{ color: [] }], [{ align: [] }], ['clean']];

    const quill = new Quill(editorEl, {
      theme: 'snow',
      placeholder,
      modules: { toolbar: { container: toolbar, handlers: full ? { image: handleImageInsert } : undefined } },
    });

    function handleImageInsert(this: unknown) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const range = quill.getSelection(true);
          const index = range?.index ?? 0;
          quill.insertEmbed(index, 'image', reader.result);
          quill.setSelection(index + 1, 0);
          // Constrain inserted images so a large upload doesn't blow out
          // the layout — Quill's default image blot has no size limit.
          const img = quill.root.querySelector(`img[src="${reader.result}"]`) as HTMLImageElement | null;
          if (img) img.setAttribute('style', 'max-width:100%;height:auto;');
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }

    quill.root.innerHTML = value;
    quill.on('text-change', () => {
      onChangeRef.current(quill.root.innerHTML);
    });
    quillRef.current = quill;

    return () => {
      mountEl.replaceChildren();
      quillRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. switching selected template) back into Quill.
  useEffect(() => {
    const quill = quillRef.current;
    if (quill && quill.root.innerHTML !== value) {
      quill.root.innerHTML = value;
    }
  }, [value]);

  return <div ref={containerRef} style={{ background: '#fff', borderRadius: 8 }} />;
}

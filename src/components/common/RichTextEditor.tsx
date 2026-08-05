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
/* eslint-enable @typescript-eslint/no-explicit-any */
Quill.register(AlignStyle, true);
Quill.register(ColorStyle, true);
Quill.register(BackgroundStyle, true);

interface Props {
  value: string; // HTML
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * Quill-based rich text editor for email body content. Toolbar is
 * intentionally restricted to bold/italic/underline/color/align — Quill
 * emits these as inline styles (not CSS classes), which stay compatible
 * with the Outlook-safe table wrapper in emailRenderService. Paragraph
 * breaks (Enter) become real <p> tags, so line breaks are preserved
 * exactly instead of being collapsed like plain-text <textarea> was.
 */
export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || quillRef.current) return;
    const mountEl = containerRef.current;
    const editorEl = document.createElement('div');
    mountEl.appendChild(editorEl);

    const quill = new Quill(editorEl, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: [['bold', 'italic', 'underline'], [{ color: [] }], [{ align: [] }], ['clean']],
      },
    });
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

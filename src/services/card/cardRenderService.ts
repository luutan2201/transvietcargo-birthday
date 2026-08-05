import type { Customer } from '../../types/entities';
import { generatedCardRepository } from '../../data/repositories/HistoryRepository';

export interface TextBlockFont {
  family: string;
  sizePx: number;
  color: string;
  align: CanvasTextAlign;
  bold?: boolean;
  italic?: boolean;
}

export interface TextBlockRenderConfig {
  /** One entry per line. Lines are drawn exactly as given — never
   * auto-wrapped or reflowed — so manually-placed line breaks are preserved. */
  lines: string[];
  xPercent: number;
  yPercent: number;
  font: TextBlockFont;
  /** Required when lines.length > 1. */
  lineHeightPx?: number;
}

function fontString(font: TextBlockFont): string {
  const style = font.italic ? 'italic ' : '';
  const weight = font.bold ? 'bold ' : '';
  return `${style}${weight}${font.sizePx}px ${font.family}`;
}

function drawTextBlock(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, block: TextBlockRenderConfig) {
  ctx.font = fontString(block.font);
  ctx.fillStyle = block.font.color;
  ctx.textAlign = block.font.align;
  ctx.textBaseline = 'middle';

  const x = (block.xPercent / 100) * canvasWidth;
  const startY = (block.yPercent / 100) * canvasHeight;
  const lineHeight = block.lineHeightPx ?? block.font.sizePx * 1.3;

  block.lines.forEach((line, i) => {
    ctx.fillText(line, x, startY + i * lineHeight);
  });
}

/**
 * Renders one or more calibrated text blocks (name, message paragraph, …)
 * onto a card template's PNG using the native Canvas API, at the exact
 * pixel resolution of the source image — the same function used both for
 * the calibration "live preview" and the final export, so what you see
 * while positioning IS what gets produced.
 */
export async function renderBirthdayCard(imageUrl: string, blocks: TextBlockRenderConfig[]): Promise<Blob> {
  const img = await loadImage(imageUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.drawImage(img, 0, 0);
  for (const block of blocks) drawTextBlock(ctx, canvas.width, canvas.height, block);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to export PNG'))), 'image/png');
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Missing or invalid card template image'));
    img.src = url;
  });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export const cardGeneratorService = {
  render: renderBirthdayCard,
  download: downloadBlob,

  async recordHistory(customer: Customer, templateId: string) {
    return generatedCardRepository.create({
      customerId: customer.id,
      customerName: customer.fullName,
      gender: customer.gender,
      language: customer.language,
      templateId,
    });
  },
};

import type { ThresholdMetric, TrackingCampaign, TrackingThreshold } from '../types/tracking';

/** Số liệu đếm cần để tính tỷ lệ — dùng được cho 1 campaign hoặc tổng của cả nhóm. */
export type Counts = Pick<
  TrackingCampaign,
  'totalSent' | 'recipients' | 'hard' | 'soft' | 'blocked' | 'other' | 'delivered' | 'replyMain' | 'replyLife'
> & { openMain?: number | null; clickMain?: number | null };

export type Level = 'ok' | 'warn' | 'crit';

export const LEVEL_LABEL: Record<Level, string> = {
  ok: 'Đạt',
  warn: 'Cần theo dõi',
  crit: 'Tạm dừng gửi',
};
const RANK: Record<Level, number> = { ok: 0, warn: 1, crit: 2 };

export interface MetricDef {
  key: ThresholdMetric;
  label: string;
  /** high: càng cao càng xấu (bounce). low: càng thấp càng xấu (reply). */
  dir: 'high' | 'low';
  /** Thang tối đa khi vẽ thanh so sánh (%). */
  chartMax: number;
  /** Mẫu số của tỷ lệ, để hiển thị cho người xem. */
  base: string;
  action: string;
}

export const METRICS: MetricDef[] = [
  { key: 'hard', label: 'Hard bounce', dir: 'high', chartMax: 10, base: 'khách nhận',
    action: 'Tạm dừng gửi; loại bỏ hoặc hiệu chỉnh các địa chỉ hard bounce và rà soát nguồn danh sách trước khi gửi đợt tiếp theo.' },
  { key: 'soft', label: 'Soft bounce', dir: 'high', chartMax: 10, base: 'khách nhận',
    action: 'Soft bounce thường là lỗi tạm thời (hộp thư đầy, máy chủ bận) và có thể gửi lại sau.' },
  { key: 'blocked', label: 'Blocked', dir: 'high', chartMax: 10, base: 'khách nhận',
    action: 'Nếu tăng bất thường, kiểm tra cấu hình SPF/DKIM và giảm số lượng email mỗi đợt.' },
  { key: 'total', label: 'Tổng bounce', dir: 'high', chartMax: 10, base: 'khách nhận',
    action: 'Rà soát chất lượng danh sách nhận (gồm hard, soft, blocked và các lỗi khác).' },
  { key: 'reply', label: 'Reply (72h)', dir: 'low', chartMax: 10, base: 'giao thành công',
    action: 'Xem lại tiêu đề, nội dung và lời kêu gọi hành động.' },
];

export const DEFAULT_THRESHOLDS: TrackingThreshold[] = [
  { metric: 'hard', warn: 4, crit: 5 },
  { metric: 'soft', warn: null, crit: null },
  { metric: 'blocked', warn: null, crit: null },
  { metric: 'total', warn: null, crit: null },
  { metric: 'reply', warn: null, crit: null },
];

export const pct = (num: number, den: number): number => (den > 0 ? (num / den) * 100 : 0);
export const round2 = (n: number): number => Math.round(n * 100) / 100;

export function bounceTotal(c: Pick<Counts, 'hard' | 'soft' | 'blocked' | 'other'>): number {
  return c.hard + c.soft + c.blocked + c.other;
}

/** Tỷ lệ (%) của một chỉ số. Bounce tính trên khách nhận; reply tính trên email giao thành công. */
export function metricValue(key: ThresholdMetric, c: Counts): number {
  switch (key) {
    case 'hard': return pct(c.hard, c.recipients);
    case 'soft': return pct(c.soft, c.recipients);
    case 'blocked': return pct(c.blocked, c.recipients);
    case 'total': return pct(bounceTotal(c), c.recipients);
    case 'reply': return pct(c.replyMain, c.delivered);
  }
}

export const deliveryRate = (c: Counts): number => pct(c.delivered, c.recipients);

/** So với ngưỡng, làm tròn 2 chữ số để 5,0% đúng bằng ngưỡng 5% không bị lệch do số thực. */
export function levelOf(value: number, th: Pick<TrackingThreshold, 'warn' | 'crit'> | undefined, dir: 'high' | 'low'): Level {
  if (!th) return 'ok';
  const v = round2(value);
  if (dir === 'high') {
    if (th.crit != null && v >= th.crit) return 'crit';
    if (th.warn != null && v >= th.warn) return 'warn';
    return 'ok';
  }
  if (th.crit != null && v < th.crit) return 'crit';
  if (th.warn != null && v < th.warn) return 'warn';
  return 'ok';
}

export function worseOf(a: Level, b: Level): Level {
  return RANK[b] > RANK[a] ? b : a;
}

export interface CampaignHealth {
  overall: Level;
  byMetric: Record<ThresholdMetric, Level>;
}

export function evaluateCampaign(c: Counts, thresholds: TrackingThreshold[]): CampaignHealth {
  const byMetric = {} as Record<ThresholdMetric, Level>;
  let overall: Level = 'ok';
  for (const m of METRICS) {
    const th = thresholds.find((t) => t.metric === m.key);
    const lv = levelOf(metricValue(m.key, c), th, m.dir);
    byMetric[m.key] = lv;
    overall = worseOf(overall, lv);
  }
  return { overall, byMetric };
}

export function sumCounts(list: Counts[]): Counts {
  const z: Counts = { totalSent: 0, recipients: 0, hard: 0, soft: 0, blocked: 0, other: 0, delivered: 0, replyMain: 0, replyLife: 0 };
  return list.reduce<Counts>((a, c) => ({
    totalSent: a.totalSent + c.totalSent,
    recipients: a.recipients + c.recipients,
    hard: a.hard + c.hard,
    soft: a.soft + c.soft,
    blocked: a.blocked + c.blocked,
    other: a.other + c.other,
    delivered: a.delivered + c.delivered,
    replyMain: a.replyMain + c.replyMain,
    replyLife: a.replyLife + c.replyLife,
  }), z);
}

/* ------------------------------ Chủ đề & nhóm ------------------------------ */

/**
 * Chủ đề của campaign. Chưa đặt thì tạm đoán từ phần sau mã campaign
 * (C2609-TRUNGTHU → TRUNGTHU) để vẫn so sánh được; có thể sửa lại sau.
 */
export function topicOf(c: Pick<TrackingCampaign, 'id' | 'topic'>): string {
  if (c.topic && c.topic.trim()) return c.topic.trim();
  const parts = c.id.split('-');
  return parts.length > 1 ? parts.slice(1).join('-') : c.id;
}

/** Ngày dùng để xếp theo thời gian: ngày bắt đầu, nếu thiếu thì lần gửi đầu tiên. */
export function campaignDate(c: Pick<TrackingCampaign, 'startDate' | 'firstSentAt'>): string {
  return c.startDate ?? (c.firstSentAt ? c.firstSentAt.slice(0, 10) : '');
}

export type GroupMode = 'campaign' | 'month' | 'year';

export interface CompareItem {
  id: string;
  label: string;
  sub: string;
  campaigns: TrackingCampaign[];
}

export function fmtDateVN(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function buildCompareItems(
  campaigns: TrackingCampaign[],
  opts: { group: GroupMode; topic: string; year: string },
): CompareItem[] {
  const list = campaigns
    .filter((c) => !c.isTest && c.status !== 'draft' && c.totalSent > 0)
    .filter((c) => opts.topic === 'all' || topicOf(c) === opts.topic)
    .filter((c) => opts.year === 'all' || campaignDate(c).startsWith(opts.year))
    .sort((a, b) => campaignDate(a).localeCompare(campaignDate(b)));

  if (opts.group === 'campaign') {
    return list.map((c) => ({ id: c.id, label: c.id, sub: `${fmtDateVN(campaignDate(c))} · ${topicOf(c)}`, campaigns: [c] }));
  }
  const groups = new Map<string, TrackingCampaign[]>();
  for (const c of list) {
    const d = campaignDate(c);
    const key = opts.group === 'month' ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : d.slice(0, 4);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups].map(([key, cs]) => ({
    id: key,
    label: `${opts.group === 'month' ? 'Tháng' : 'Năm'} ${key}`,
    sub: `${cs.length} campaign`,
    campaigns: cs,
  }));
}

/** Chênh lệch tính bằng điểm phần trăm; `good` = true khi thay đổi theo hướng tốt. */
export function deltaPoints(from: number, to: number, higherIsBetter: boolean): { points: number; good: boolean | null } {
  const points = round2(to - from);
  if (Math.abs(points) < 0.05) return { points, good: null };
  return { points, good: higherIsBetter ? points > 0 : points < 0 };
}

/** 93.333 → "93,3%" (định dạng Việt Nam). */
export function fmtPct(n: number): string {
  return `${n.toFixed(1).replace('.', ',')}%`;
}

export function hoursAgo(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000;
}

/** "5 phút trước", "1,2 giờ trước", "3 ngày trước". */
export function fmtAgo(iso: string | null | undefined, now: Date = new Date()): string {
  const h = hoursAgo(iso, now);
  if (h == null) return 'chưa có';
  if (h < 1 / 60) return 'vừa xong';
  if (h < 1) return `${Math.round(h * 60)} phút trước`;
  if (h < 48) return `${h.toFixed(1).replace('.', ',')} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}

/** Mức cảnh báo hiển thị cho campaign: đang tạm dừng thì luôn là "Tạm dừng gửi". */
export function displayLevel(c: TrackingCampaign, thresholds: TrackingThreshold[]): Level {
  if (c.status === 'draft') return 'ok';
  if (c.paused && c.status !== 'closed') return 'crit';
  return evaluateCampaign(c, thresholds).overall;
}

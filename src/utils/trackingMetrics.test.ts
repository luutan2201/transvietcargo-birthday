import { describe, expect, it } from 'vitest';
import type { TrackingCampaign, TrackingThreshold } from '../types/tracking';
import {
  DEFAULT_THRESHOLDS, buildCompareItems, deltaPoints, deliveryRate, evaluateCampaign, fmtAgo, fmtPct,
  levelOf, metricValue, sumCounts, topicOf,
} from './trackingMetrics';

function camp(over: Partial<TrackingCampaign>): TrackingCampaign {
  return {
    id: 'C2609-X', name: 'X', subject: null, startDate: '2026-09-23', owner: null, notes: null, topic: null,
    status: 'closed', isTest: false, firstSentAt: null, lastSentAt: null, batchCount: 1, totalSent: 100,
    recipients: 100, hard: 0, soft: 0, blocked: 0, other: 0, delivered: 100, replyMain: 0, replyLife: 0,
    openMain: null, clickMain: null, openLife: null, clickLife: null, paused: false, pausedReason: null,
    pausedAt: null, ackBy: null, ackAt: null, ackNote: null, source: 'sheet', sheetSynced: true, ...over,
  };
}

// Số thật của C2609-THONGBAO-PHI trên sheet
const C2609 = camp({ id: 'C2609-THONGBAO-PHI', totalSent: 62, recipients: 60, hard: 2, soft: 1, blocked: 1, delivered: 56, replyMain: 3, replyLife: 5 });

describe('tỷ lệ — khớp sheet', () => {
  it('Delivery 93,3%, Hard 3,3%, bounce tổng 6,7%, Reply 5,4% trên Delivered', () => {
    expect(fmtPct(deliveryRate(C2609))).toBe('93,3%');
    expect(fmtPct(metricValue('hard', C2609))).toBe('3,3%');
    expect(fmtPct(metricValue('soft', C2609))).toBe('1,7%');
    expect(fmtPct(metricValue('total', C2609))).toBe('6,7%');
    expect(fmtPct(metricValue('reply', C2609))).toBe('5,4%');
  });
  it('không chia cho 0', () => {
    const empty = camp({ recipients: 0, delivered: 0 });
    expect(metricValue('hard', empty)).toBe(0);
    expect(metricValue('reply', empty)).toBe(0);
  });
});

describe('ngưỡng cảnh báo (Hard bounce 4% theo dõi / 5% tạm dừng)', () => {
  const th = DEFAULT_THRESHOLDS;
  it('dưới 4% là Đạt — kể cả 2%', () => {
    expect(evaluateCampaign(camp({ hard: 2 }), th).overall).toBe('ok');
    expect(evaluateCampaign(C2609, th).byMetric.hard).toBe('ok'); // 3,3%
  });
  it('từ 4% đến dưới 5% là Cần theo dõi', () => {
    expect(evaluateCampaign(camp({ hard: 4 }), th).byMetric.hard).toBe('warn');
    expect(evaluateCampaign(camp({ hard: 4 }), th).overall).toBe('warn');
  });
  it('đúng 5% là Tạm dừng gửi (không bị lệch do số thực)', () => {
    expect(evaluateCampaign(camp({ recipients: 140, delivered: 133, hard: 7 }), th).overall).toBe('crit');
    expect(levelOf(0.07 / 1.4 * 100, { warn: 4, crit: 5 }, 'high')).toBe('crit');
  });
  it('chỉ số không đặt ngưỡng thì luôn Đạt', () => {
    const c = camp({ soft: 50, recipients: 100, delivered: 50 });
    expect(evaluateCampaign(c, th).byMetric.soft).toBe('ok');
    expect(evaluateCampaign(c, th).byMetric.total).toBe('ok');
  });
  it('đánh giá riêng từng campaign, không gộp', () => {
    const a = camp({ hard: 6, recipients: 100, delivered: 94 });
    const b = camp({ hard: 0 });
    expect(evaluateCampaign(a, th).overall).toBe('crit');
    expect(evaluateCampaign(b, th).overall).toBe('ok');
    // Gộp lại chỉ còn 3% — đúng là phải đánh giá riêng mới thấy campaign a vượt ngưỡng.
    expect(evaluateCampaign(sumCounts([a, b]), th).overall).toBe('ok');
  });
  it('chỉ số dạng "càng thấp càng xấu" (reply)', () => {
    const t: TrackingThreshold[] = [{ metric: 'reply', warn: 3, crit: 1 }];
    expect(evaluateCampaign(camp({ delivered: 100, replyMain: 5 }), t).byMetric.reply).toBe('ok');
    expect(evaluateCampaign(camp({ delivered: 100, replyMain: 2 }), t).byMetric.reply).toBe('warn');
    expect(evaluateCampaign(camp({ delivered: 100, replyMain: 0 }), t).byMetric.reply).toBe('crit');
  });
});

describe('so sánh theo chủ đề / tháng / năm', () => {
  const list = [
    camp({ id: 'C2509-TRUNGTHU', startDate: '2025-09-08', topic: 'Trung thu' }),
    camp({ id: 'C2609-TRUNGTHU', startDate: '2026-09-07', topic: 'Trung thu' }),
    camp({ id: 'C2607-BANGGIA', startDate: '2026-07-14', topic: 'Bảng giá' }),
    camp({ id: 'C2609-BANGGIA', startDate: '2026-09-15', topic: 'Bảng giá' }),
    camp({ id: 'C2610-Test', startDate: '2026-10-01', isTest: true }),
    camp({ id: 'C2610-KHAOSAT', startDate: '2026-10-20', status: 'draft', totalSent: 0, recipients: 0, delivered: 0 }),
  ];
  it('cùng chủ đề qua 2 năm', () => {
    const items = buildCompareItems(list, { group: 'campaign', topic: 'Trung thu', year: 'all' });
    expect(items.map((i) => i.id)).toEqual(['C2509-TRUNGTHU', 'C2609-TRUNGTHU']);
  });
  it('cùng chủ đề qua các tháng, loại campaign test và nháp', () => {
    const items = buildCompareItems(list, { group: 'month', topic: 'Bảng giá', year: 'all' });
    expect(items.map((i) => i.label)).toEqual(['Tháng 07/2026', 'Tháng 09/2026']);
    const all = buildCompareItems(list, { group: 'campaign', topic: 'all', year: 'all' });
    expect(all.some((i) => i.id === 'C2610-Test' || i.id === 'C2610-KHAOSAT')).toBe(false);
  });
  it('nhóm theo năm gộp các campaign trong năm', () => {
    const items = buildCompareItems(list, { group: 'year', topic: 'all', year: 'all' });
    expect(items.map((i) => [i.label, i.campaigns.length])).toEqual([['Năm 2025', 1], ['Năm 2026', 3]]);
  });
  it('lọc theo năm', () => {
    expect(buildCompareItems(list, { group: 'campaign', topic: 'all', year: '2025' })).toHaveLength(1);
  });
  it('chưa đặt chủ đề thì đoán từ mã campaign', () => {
    expect(topicOf({ id: 'C2609-TRUNGTHU', topic: null })).toBe('TRUNGTHU');
    expect(topicOf({ id: 'C2609-THONGBAO-PHI', topic: '' })).toBe('THONGBAO-PHI');
    expect(topicOf({ id: 'ABC', topic: null })).toBe('ABC');
    expect(topicOf({ id: 'C1-X', topic: ' Trung thu ' })).toBe('Trung thu');
  });
});

describe('chênh lệch & định dạng', () => {
  it('điểm phần trăm và hướng tốt/xấu', () => {
    expect(deltaPoints(1.8, 2.4, false)).toEqual({ points: 0.6, good: false });
    expect(deltaPoints(1.8, 1.6, false)).toEqual({ points: -0.2, good: true });
    expect(deltaPoints(5.6, 6.7, true).good).toBe(true);
    expect(deltaPoints(5.6, 5.62, true).good).toBeNull();
  });
  it('thời gian đã trôi qua', () => {
    const now = new Date('2026-10-07T07:00:00Z');
    expect(fmtAgo('2026-10-07T06:58:00Z', now)).toBe('2 phút trước');
    expect(fmtAgo('2026-10-07T05:48:00Z', now)).toBe('1,2 giờ trước');
    expect(fmtAgo('2026-10-03T07:00:00Z', now)).toBe('4 ngày trước');
    expect(fmtAgo(null, now)).toBe('chưa có');
  });
});

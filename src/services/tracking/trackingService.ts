import { supabase } from '../../lib/supabaseClient';
import { ValidationError } from '../../data/errors';
import { createLogger } from '../../utils/logger';
import type {
  BounceHandling, ThresholdMetric, TrackingBatch, TrackingBounce, TrackingCampaign, TrackingData,
  TrackingReply, TrackingSyncInfo, TrackingThreshold,
} from '../../types/tracking';

const logger = createLogger('trackingService');

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export function toCampaign(r: Row): TrackingCampaign {
  return {
    id: r.id, name: r.name ?? '', subject: r.subject, startDate: r.start_date, owner: r.owner, notes: r.notes,
    topic: r.topic, status: r.status, isTest: !!r.is_test, firstSentAt: r.first_sent_at, lastSentAt: r.last_sent_at,
    batchCount: r.batch_count ?? 0, totalSent: r.total_sent ?? 0, recipients: r.recipients ?? 0, hard: r.hard ?? 0,
    soft: r.soft ?? 0, blocked: r.blocked ?? 0, other: r.other ?? 0, delivered: r.delivered ?? 0,
    replyMain: r.reply_main ?? 0, replyLife: r.reply_life ?? 0,
    openMain: r.open_main, clickMain: r.click_main, openLife: r.open_life, clickLife: r.click_life,
    paused: !!r.paused, pausedReason: r.paused_reason, pausedAt: r.paused_at,
    ackBy: r.ack_by, ackAt: r.ack_at, ackNote: r.ack_note,
    source: r.source, sheetSynced: !!r.sheet_synced,
  };
}

function toBatch(r: Row): TrackingBatch {
  return {
    id: r.id, campaignId: r.campaign_id, batchNo: r.batch_no, sentAt: r.sent_at, sent: r.sent ?? 0,
    recipients: r.recipients ?? 0, bounce: r.bounce ?? 0, delivered: r.delivered ?? 0, replyMain: r.reply_main ?? 0,
  };
}

function toBounce(r: Row): TrackingBounce {
  return {
    id: r.id, campaignId: r.campaign_id, email: r.email, bounceType: r.bounce_type, code: r.code, reason: r.reason,
    receivedAt: r.received_at, batchNo: r.batch_no, handling: r.handling, handledBy: r.handled_by,
    handledAt: r.handled_at, note: r.note,
  };
}

function toReply(r: Row): TrackingReply {
  return { id: r.id, campaignId: r.campaign_id, email: r.email, subject: r.subject, receivedAt: r.received_at, isAuto: !!r.is_auto };
}

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) {
    logger.error(`tracking: ${what}`, res.error);
    throw new ValidationError(`Không tải được ${what}: ${res.error.message}`);
  }
  return (res.data ?? []) as T;
}

/** Gọi Edge Function `quick-service` và lấy ra lý do lỗi thật (không để lộ "non-2xx" chung chung). */
async function invoke<T = Row>(body: Row): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new ValidationError('Chưa đăng nhập');
  const { data, error } = await supabase.functions.invoke('quick-service', { body, headers: { Authorization: `Bearer ${token}` } });
  if (error) {
    const context = (error as { context?: Response }).context;
    let detail: string | null = null;
    if (context && typeof context.json === 'function') {
      try { detail = (await context.json())?.error ?? null; } catch { /* không phải JSON */ }
    }
    logger.error('tracking function failed', { error, detail });
    throw new ValidationError(detail ?? error.message ?? 'Yêu cầu thất bại');
  }
  if (data?.error) throw new ValidationError(data.error);
  return data as T;
}

export const trackingService = {
  async loadAll(): Promise<TrackingData> {
    const [camps, batches, bounces, replies, thresholds, config, sync] = await Promise.all([
      supabase.from('tracking_campaigns').select('*').order('start_date', { ascending: false }),
      supabase.from('tracking_batches').select('*').order('batch_no'),
      supabase.from('tracking_bounces').select('*').order('received_at', { ascending: false }),
      supabase.from('tracking_replies').select('*').order('received_at', { ascending: false }),
      supabase.from('tracking_thresholds').select('*'),
      supabase.from('tracking_config').select('*'),
      supabase.from('tracking_sync').select('*').eq('id', 1).maybeSingle(),
    ]);
    const cfg = Object.fromEntries((check<Row[]>(config, 'cấu hình')).map((r) => [r.key, r.value]));
    const s = sync.data as Row | null;
    const syncInfo: TrackingSyncInfo = {
      lastSyncAt: s?.last_sync_at ?? null, lastRecordAt: s?.last_record_at ?? null,
      status: s?.status ?? null, message: s?.message ?? null,
    };
    return {
      campaigns: check<Row[]>(camps, 'danh sách campaign').map(toCampaign),
      batches: check<Row[]>(batches, 'các đợt gửi').map(toBatch),
      bounces: check<Row[]>(bounces, 'email bounce').map(toBounce),
      replies: check<Row[]>(replies, 'phản hồi').map(toReply),
      thresholds: check<Row[]>(thresholds, 'ngưỡng cảnh báo').map((r) => ({
        metric: r.metric as ThresholdMetric, warn: r.warn == null ? null : Number(r.warn), crit: r.crit == null ? null : Number(r.crit),
      })),
      sync: syncInfo,
      openClickEnabled: cfg['open_click_enabled'] === true,
    };
  },

  /** Đồng bộ ngay từ sheet. Trả về thông báo ngắn để hiển thị. */
  async syncNow(): Promise<string> {
    const r = await invoke<Row>({ action: 'sync' });
    if (r.throttled) return r.message ?? 'Vừa đồng bộ cách đây ít giây.';
    return `Đã đồng bộ: ${r.campaigns ?? 0} campaign, ${r.bounces ?? 0} bounce, ${r.replies ?? 0} reply.`;
  },

  async createCampaign(c: { id: string; name: string; subject: string; startDate: string; owner: string; topic: string; notes: string }): Promise<{ sheetSynced: boolean; warning?: string }> {
    const r = await invoke<Row>({
      action: 'createCampaign',
      campaign: { id: c.id, name: c.name, subject: c.subject, start_date: c.startDate || null, owner: c.owner, topic: c.topic, notes: c.notes },
    });
    return { sheetSynced: !!r.sheetSynced, warning: r.warning };
  },

  /** "Xác nhận đã khắc phục": mở lại campaign đang tạm dừng. */
  async resume(id: string, note: string): Promise<void> {
    await invoke({ action: 'resume', id, note });
  },

  async setBounceHandling(id: string, handling: BounceHandling, by: string): Promise<void> {
    const { error } = await supabase.from('tracking_bounces').update({
      handling, handled_by: handling === 'open' ? null : by, handled_at: handling === 'open' ? null : new Date().toISOString(),
    }).eq('id', id);
    if (error) throw new ValidationError(`Không lưu được: ${error.message}`);
  },

  async saveThresholds(rows: TrackingThreshold[], by: string): Promise<void> {
    const { error } = await supabase.from('tracking_thresholds').upsert(
      rows.map((r) => ({ metric: r.metric, warn: r.warn, crit: r.crit, updated_by: by, updated_at: new Date().toISOString() })),
      { onConflict: 'metric' },
    );
    if (error) throw new ValidationError(`Không lưu được ngưỡng: ${error.message}`);
  },

  async setTopic(id: string, topic: string): Promise<void> {
    const { error } = await supabase.from('tracking_campaigns').update({ topic: topic.trim() || null }).eq('id', id);
    if (error) throw new ValidationError(`Không lưu được chủ đề: ${error.message}`);
  },
};

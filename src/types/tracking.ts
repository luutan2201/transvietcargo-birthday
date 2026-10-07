// Email Tracking — tách biệt hoàn toàn với module sinh nhật khách hàng.

export type TrackingStatus = 'draft' | 'tracking' | 'closed';
export type BounceType = 'Hard' | 'Soft' | 'Blocked' | 'Other';
export type BounceHandling = 'open' | 'removed' | 'resent' | 'ignored';

export interface TrackingCampaign {
  id: string;
  name: string;
  subject: string | null;
  startDate: string | null; // yyyy-mm-dd
  owner: string | null;
  notes: string | null;
  topic: string | null;
  status: TrackingStatus;
  isTest: boolean;
  firstSentAt: string | null;
  lastSentAt: string | null;
  batchCount: number;
  totalSent: number;
  recipients: number;
  hard: number;
  soft: number;
  blocked: number;
  other: number;
  delivered: number;
  replyMain: number;
  replyLife: number;
  openMain: number | null;
  clickMain: number | null;
  openLife: number | null;
  clickLife: number | null;
  paused: boolean;
  pausedReason: string | null;
  pausedAt: string | null;
  ackBy: string | null;
  ackAt: string | null;
  ackNote: string | null;
  source: 'sheet' | 'web';
  sheetSynced: boolean;
}

export interface TrackingBatch {
  id: string;
  campaignId: string;
  batchNo: number;
  sentAt: string | null;
  sent: number;
  recipients: number;
  bounce: number;
  delivered: number;
  replyMain: number;
}

export interface TrackingBounce {
  id: string;
  campaignId: string;
  email: string;
  bounceType: BounceType;
  code: string | null;
  reason: string | null;
  receivedAt: string | null;
  batchNo: number | null;
  handling: BounceHandling;
  handledBy: string | null;
  handledAt: string | null;
  note: string | null;
}

export interface TrackingReply {
  id: string;
  campaignId: string;
  email: string;
  subject: string | null;
  receivedAt: string | null;
  isAuto: boolean;
}

export type ThresholdMetric = 'hard' | 'soft' | 'blocked' | 'total' | 'reply';

export interface TrackingThreshold {
  metric: ThresholdMetric;
  /** Mức "cần theo dõi". null = không đặt. */
  warn: number | null;
  /** Mức "tạm dừng gửi". null = không đặt. */
  crit: number | null;
}

export interface TrackingSyncInfo {
  lastSyncAt: string | null;
  lastRecordAt: string | null;
  status: string | null;
  message: string | null;
}

export interface TrackingData {
  campaigns: TrackingCampaign[];
  batches: TrackingBatch[];
  bounces: TrackingBounce[];
  replies: TrackingReply[];
  thresholds: TrackingThreshold[];
  sync: TrackingSyncInfo;
  openClickEnabled: boolean;
}

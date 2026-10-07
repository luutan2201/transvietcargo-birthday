import type { ReactNode } from 'react';
import type { TrackingCampaign, TrackingData, TrackingThreshold } from '../../types/tracking';
import { LEVEL_LABEL, type Level } from '../../utils/trackingMetrics';

export const SERIES = ['var(--tk-s1)', 'var(--tk-s2)', 'var(--tk-s3)', 'var(--tk-s4)', 'var(--tk-s5)'];

export interface TabProps {
  data: TrackingData;
  /** admin / manager: tạo campaign, xử lý bounce, xác nhận khắc phục */
  canManage: boolean;
  /** admin: chỉnh ngưỡng cảnh báo */
  isAdmin: boolean;
  userName: string;
  reload: () => Promise<void>;
  openCampaign: (id: string) => void;
  goTab: (tab: TabKey) => void;
  selectedId: string;
  setSelectedId: (id: string) => void;
}

export type TabKey = 'overview' | 'compare' | 'detail' | 'bounce' | 'thresh' | 'new';

export function LevelChip({ level }: { level: Level }) {
  return <span className={`tk-lv ${level}`}>{LEVEL_LABEL[level]}</span>;
}

export function valueClass(level: Level): string | undefined {
  return level === 'ok' ? undefined : `t-${level}`;
}

export function DevTag({ label = 'Đang phát triển' }: { label?: string }) {
  return <span className="tk-tag info">{label}</span>;
}

/** Vạch ngưỡng trên thanh: vàng = cần theo dõi, đỏ = tạm dừng. */
export function Markers({ th, max }: { th: Pick<TrackingThreshold, 'warn' | 'crit'> | undefined; max: number }) {
  if (!th) return null;
  return (
    <>
      {th.warn != null && <u className="tk-mk" style={{ left: `${(th.warn / max) * 100}%` }} />}
      {th.crit != null && <u className="tk-mk c" style={{ left: `${(th.crit / max) * 100}%` }} />}
    </>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div className="glass-panel card" style={style}>{children}</div>;
}

export function statusTag(c: TrackingCampaign): ReactNode {
  if (c.status === 'closed') return <span className="tk-tag ok">Đã chốt</span>;
  if (c.status === 'tracking') return <span className="tk-tag info">Đang theo dõi</span>;
  return <span className="tk-tag">Chưa gửi</span>;
}

export function handlingLabel(h: string): string {
  return { open: 'Chưa xử lý', removed: 'Đã xóa khỏi danh sách', resent: 'Đã gửi lại', ignored: 'Bỏ qua' }[h] ?? h;
}

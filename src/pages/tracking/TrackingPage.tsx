import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../services/auth/permissions';
import { trackingService } from '../../services/tracking/trackingService';
import type { TrackingData } from '../../types/tracking';
import { fmtAgo } from '../../utils/trackingMetrics';
import './tracking.css';
import BouncesTab from './BouncesTab';
import CompareTab from './CompareTab';
import DetailTab from './DetailTab';
import NewCampaignTab from './NewCampaignTab';
import OverviewTab from './OverviewTab';
import ThresholdsTab from './ThresholdsTab';
import { Card, type TabKey, type TabProps } from './ui';

const TABS: Array<[TabKey, string]> = [
  ['overview', 'Tổng quan'], ['compare', 'So sánh campaign'], ['detail', 'Chi tiết campaign'],
  ['bounce', 'Email bounce cần xử lý'], ['thresh', 'Ngưỡng cảnh báo'], ['new', 'Tạo campaign'],
];

export default function TrackingPage() {
  const { session } = useAuth();
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  const [selectedId, setSelectedId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { setData(await trackingService.loadAll()); setError(null); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  if (!session) return null;

  const syncNow = async () => {
    setSyncing(true); setSyncMsg(null);
    try { setSyncMsg(await trackingService.syncNow()); await reload(); } catch (e) { setSyncMsg((e as Error).message); } finally { setSyncing(false); }
  };

  const props: TabProps | null = data && {
    data,
    canManage: hasPermission(session.role, 'tracking.manage'),
    isAdmin: session.role === 'admin',
    userName: session.displayName,
    reload,
    openCampaign: (id) => { setSelectedId(id); setTab('detail'); },
    goTab: setTab,
    selectedId,
    setSelectedId,
  };

  const failed = data?.sync.status === 'error';

  return (
    <div className="tk">
      <div>
        <h1>Email Tracking</h1>
        <p className="sub">Theo dõi chất lượng gửi email theo campaign, đồng bộ từ Google Sheet "2026_Tracking emails".</p>
      </div>

      <div className="glass-panel tk-sync">
        <span className={`tk-pulse ${!data?.sync.lastSyncAt ? 'idle' : failed ? 'err' : ''}`} />
        <span>
          {data?.sync.lastSyncAt ? <>Đồng bộ lần cuối: <b>{fmtAgo(data.sync.lastSyncAt)}</b> · tự động mỗi 30 phút</> : 'Chưa có dữ liệu đồng bộ'}
          {failed && data?.sync.message ? ` · Lỗi: ${data.sync.message}` : ''}
        </span>
        <button className="tk-btn ghost" disabled={syncing} onClick={syncNow}>{syncing ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}</button>
        {syncMsg && <span className="sub">{syncMsg}</span>}
      </div>

      {error && <div className="tk-alert crit"><div><b>Không tải được dữ liệu.</b> {error}<br />Kiểm tra đã chạy supabase/tracking.sql chưa.</div><button className="tk-btn" onClick={reload}>Thử lại</button></div>}
      {!data && !error && <Card><p className="sub">Đang tải…</p></Card>}

      {props && (
        <>
          <div className="tk-tabs">
            {TABS.map(([k, l]) => <button key={k} className={`tk-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          {tab === 'overview' && <OverviewTab {...props} />}
          {tab === 'compare' && <CompareTab {...props} />}
          {tab === 'detail' && <DetailTab {...props} />}
          {tab === 'bounce' && <BouncesTab {...props} />}
          {tab === 'thresh' && <ThresholdsTab {...props} />}
          {tab === 'new' && <NewCampaignTab {...props} />}
        </>
      )}
    </div>
  );
}

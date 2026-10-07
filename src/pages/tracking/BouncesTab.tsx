import { useState } from 'react';
import { trackingService } from '../../services/tracking/trackingService';
import type { BounceHandling } from '../../types/tracking';
import { campaignDate } from '../../utils/trackingMetrics';
import { Card, handlingLabel, type TabProps } from './ui';

const HANDLING: BounceHandling[] = ['open', 'removed', 'resent', 'ignored'];

export default function BouncesTab({ data, canManage, userName, reload }: TabProps) {
  const [camp, setCamp] = useState('all');
  const [type, setType] = useState('all');
  const [handling, setHandling] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const camps = data.campaigns.filter((c) => !c.isTest).sort((a, b) => campaignDate(b).localeCompare(campaignDate(a)));
  const list = data.bounces.filter((b) =>
    (camp === 'all' || b.campaignId === camp) && (type === 'all' || b.bounceType === type) && (handling === 'all' || b.handling === handling));
  const open = data.bounces.filter((b) => b.handling === 'open' && (b.bounceType === 'Hard')).length;

  const change = async (id: string, h: BounceHandling) => {
    setBusy(id); setErr(null);
    try { await trackingService.setBounceHandling(id, h, userName); await reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <Card>
      <h2>Email bounce cần xử lý</h2>
      <p className="sub">Danh sách từng địa chỉ email bị trả lại. Hard bounce chưa xử lý: <b>{open}</b>. {canManage ? 'Cập nhật trạng thái xử lý ở cột cuối.' : 'Bạn chỉ có quyền xem.'}</p>
      <div className="row" style={{ marginTop: 14 }}>
        <label className="tk-field">Campaign
          <select value={camp} onChange={(e) => setCamp(e.target.value)}>
            <option value="all">Tất cả</option>
            {camps.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
          </select>
        </label>
        <label className="tk-field">Loại
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">Tất cả</option>
            {['Hard', 'Soft', 'Blocked', 'Other'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="tk-field">Xử lý
          <select value={handling} onChange={(e) => setHandling(e.target.value)}>
            <option value="all">Tất cả</option>
            {HANDLING.map((h) => <option key={h} value={h}>{handlingLabel(h)}</option>)}
          </select>
        </label>
      </div>
      {err && <div className="tk-alert crit" style={{ marginTop: 12 }}><div>{err}</div></div>}
      <div className="scroll" style={{ marginTop: 12 }}>
        <table>
          <thead><tr><th>Email</th><th>Campaign</th><th className="num">Đợt</th><th>Loại</th><th>Mã lỗi</th><th>Lý do</th><th>Xử lý</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={7} className="sub">Không có email bounce phù hợp.</td></tr>}
            {list.map((b) => (
              <tr key={b.id}>
                <td className="mono">{b.email}</td>
                <td>{b.campaignId}</td>
                <td className="num">{b.batchNo ?? '—'}</td>
                <td><span className={`tk-chip ${b.bounceType}`}>{b.bounceType}</span></td>
                <td className="mono">{b.code ?? '—'}</td>
                <td>{b.reason ?? '—'}</td>
                <td>
                  <select value={b.handling} disabled={!canManage || busy === b.id} onChange={(e) => change(b.id, e.target.value as BounceHandling)}>
                    {HANDLING.map((h) => <option key={h} value={h}>{handlingLabel(h)}</option>)}
                  </select>
                  {b.handledBy && <div className="note">{b.handledBy}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { trackingService } from '../../services/tracking/trackingService';
import {
  METRICS, bounceTotal, campaignDate, deliveryRate, displayLevel, evaluateCampaign, fmtDateVN, fmtPct,
  metricValue, pct, topicOf, type Level,
} from '../../utils/trackingMetrics';
import { Card, DevTag, LevelChip, Markers, statusTag, valueClass, type TabProps } from './ui';

export default function DetailTab({ data, canManage, reload, goTab, selectedId, setSelectedId }: TabProps) {
  const camps = data.campaigns.filter((c) => !c.isTest).sort((a, b) => campaignDate(b).localeCompare(campaignDate(a)));
  const c = camps.find((x) => x.id === selectedId) ?? camps[0];
  const [win, setWin] = useState<'72' | 'all'>('72');
  const [note, setNote] = useState('');
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setTopic(c?.topic ?? ''); setNote(''); setMsg(null); }, [c?.id, c?.topic]);

  if (!c) return <Card><h2>Chi tiết campaign</h2><p className="sub">Chưa có campaign nào.</p></Card>;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); await reload(); setMsg(ok); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  const picker = (
    <Card>
      <div className="row between">
        <label className="tk-field" style={{ minWidth: 300 }}>Chọn campaign
          <select value={c.id} onChange={(e) => setSelectedId(e.target.value)}>
            {camps.map((x) => <option key={x.id} value={x.id}>{x.id}{x.status === 'draft' ? ' (chưa gửi)' : ''}</option>)}
          </select>
        </label>
        <label className="tk-field">Mốc tính reply
          <select value={win} onChange={(e) => setWin(e.target.value as '72' | 'all')}>
            <option value="72">72 giờ (chuẩn so sánh)</option>
            <option value="all">Toàn thời gian</option>
          </select>
        </label>
      </div>
    </Card>
  );

  if (c.status === 'draft') {
    return (
      <>
        {picker}
        <Card>
          <h2>{c.id}</h2>
          <p className="sub">{c.name} · {fmtDateVN(campaignDate(c))} · {statusTag(c)}</p>
          <p style={{ marginTop: 14 }}>Campaign chưa có đợt gửi nào nên chưa có số liệu. Dữ liệu sẽ tự động hiển thị sau lần đồng bộ đầu tiên khi flow gửi email ghi vào sheet.</p>
          {!c.sheetSynced && <p className="note">Campaign này tạo trên web và chưa được ghi vào sheet; hệ thống sẽ tự thử lại ở lần đồng bộ sau.</p>}
        </Card>
      </>
    );
  }

  const health = evaluateCampaign(c, data.thresholds);
  const level = displayLevel(c, data.thresholds);
  const active = c.status !== 'closed';
  const reply = win === 'all' ? c.replyLife : c.replyMain;
  const bad = bounceTotal(c);
  const batches = data.batches.filter((b) => b.campaignId === c.id).sort((a, b) => a.batchNo - b.batchNo);
  const replies = data.replies.filter((r) => r.campaignId === c.id);
  const th = (k: string) => data.thresholds.find((t) => t.metric === k);
  const crit = METRICS.filter((m) => health.byMetric[m.key] === 'crit');
  const warn = METRICS.filter((m) => health.byMetric[m.key] === 'warn');
  const oc = data.openClickEnabled;

  const funnel: Array<[string, number, string, string]> = [
    ['Total sent', c.totalSent, 'var(--color-primary-dark)', ''],
    ['Khách nhận', c.recipients, 'var(--color-primary)', c.totalSent > c.recipients ? `${c.totalSent - c.recipients} email gửi lặp/gửi lại` : ''],
    ['Giao thành công', c.delivered, 'var(--color-secondary)', `${fmtPct(deliveryRate(c))} khách nhận`],
  ];

  return (
    <>
      {picker}

      {active && level === 'crit' && (
        <div className="tk-alert crit">
          <div>
            <b className="t">Khuyến nghị tạm dừng gửi</b><br />
            {c.pausedReason ?? crit.map((m) => `${m.label} ${fmtPct(metricValue(m.key, c))}`).join('; ')}. Chưa nên gửi đợt tiếp theo cho đến khi rà soát xong danh sách. Trạng thái campaign trong sheet được chuyển sang “Tạm dừng”.
          </div>
          <div className="row">
            <button className="tk-btn ghost" onClick={() => goTab('bounce')}>Xem email bounce</button>
            {canManage && c.paused && (
              <>
                <input placeholder="Ghi chú đã khắc phục…" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: 240 }} />
                <button className="tk-btn" disabled={busy} onClick={() => run(() => trackingService.resume(c.id, note), 'Đã ghi nhận khắc phục.')}>Xác nhận đã khắc phục</button>
              </>
            )}
          </div>
        </div>
      )}
      {active && level === 'warn' && (
        <div className="tk-alert warn">
          <div><b>Cần theo dõi</b><br />{warn.map((m) => `${m.label} ${fmtPct(metricValue(m.key, c))} (ngưỡng tạm dừng ${th(m.key)?.crit ?? '—'}%)`).join('; ')}. Nên kiểm tra kỹ danh sách trước khi gửi đợt tiếp theo.</div>
        </div>
      )}
      {c.ackAt && !c.paused && (
        <div className="tk-alert info"><div>Đã được <b>{c.ackBy}</b> xác nhận khắc phục lúc {new Date(c.ackAt).toLocaleString('vi-VN')}{c.ackNote ? ` — “${c.ackNote}”` : ''}.</div></div>
      )}
      {msg && <div className="tk-alert info"><div>{msg}</div></div>}

      <Card>
        <div className="row between">
          <div>
            <h2 style={{ fontSize: 22 }}>{c.id}</h2>
            <p className="sub">{c.name}{c.subject ? ` · “${c.subject}”` : ''}</p>
            <p className="sub" style={{ marginTop: 4 }}>
              Gửi {c.batchCount} đợt, từ {fmtDateVN(c.firstSentAt)} đến {fmtDateVN(c.lastSentAt)}{c.owner ? ` · ${c.owner}` : ''} · {statusTag(c)} <LevelChip level={level} />
            </p>
          </div>
          <div className="row">
            <label className="tk-field">Chủ đề / sự kiện
              {canManage
                ? <span className="row"><input value={topic} placeholder={topicOf(c)} onChange={(e) => setTopic(e.target.value)} style={{ width: 200 }} /><button className="tk-btn ghost" disabled={busy || topic.trim() === (c.topic ?? '')} onClick={() => run(() => trackingService.setTopic(c.id, topic), 'Đã lưu chủ đề.')}>Lưu</button></span>
                : <b style={{ color: 'var(--text-main)' }}>{topicOf(c)}</b>}
            </label>
          </div>
        </div>

        <div className="grid g4" style={{ marginTop: 14 }}>
          <div className="tk-mbox"><h3>Giao thành công</h3><div className="v">{fmtPct(deliveryRate(c))}</div><div className="n">{c.delivered} / {c.recipients} khách nhận</div></div>
          <div className="tk-mbox"><h3>Bounce</h3><div className={`v ${valueClass(health.byMetric.total) ?? ''}`}>{fmtPct(metricValue('total', c))}</div><div className="n">{bad} email</div></div>
          <div className="tk-mbox"><h3>Reply</h3><div className="v">{fmtPct(pct(reply, c.delivered))}</div><div className="n">{reply} / {c.delivered} giao thành công</div></div>
          {oc ? (
            <>
              <div className="tk-mbox"><h3>Mở</h3><div className="v">{c.openMain != null ? fmtPct(pct(c.openMain, c.delivered)) : '—'}</div><div className="n">{c.openMain ?? '—'} / {c.delivered}</div></div>
              <div className="tk-mbox"><h3>Click</h3><div className="v">{c.clickMain != null ? fmtPct(pct(c.clickMain, c.delivered)) : '—'}</div><div className="n">{c.clickMain ?? '—'} / {c.delivered}</div></div>
            </>
          ) : (
            <>
              <div className="tk-mbox tk-dev"><h3>Mở</h3><div className="v">—</div><div className="n"><DevTag /></div></div>
              <div className="tk-mbox tk-dev"><h3>Click</h3><div className="v">—</div><div className="n"><DevTag /></div></div>
            </>
          )}
        </div>

        <div className="tk-fun">
          {funnel.map(([label, v, color, extra]) => (
            <div className="tk-fr" key={label}>
              <div>{label}</div>
              <div className="bar"><i style={{ width: `${Math.max((v / Math.max(c.totalSent, 1)) * 100, 2)}%`, background: color }} /></div>
              <div className="val">{v} <small>{extra}</small></div>
            </div>
          ))}
          {!oc && ['Mở', 'Click'].map((l) => (
            <div className="tk-fr" key={l}><div>{l}</div><div className="tk-devbar">Đang phát triển</div><div className="val">—</div></div>
          ))}
          <div className="tk-fr">
            <div>Reply</div>
            <div className="bar"><i style={{ width: `${Math.max((reply / Math.max(c.totalSent, 1)) * 100, 2)}%`, background: 'var(--tk-s4)' }} /></div>
            <div className="val">{reply} <small>{fmtPct(pct(reply, c.delivered))} giao thành công</small></div>
          </div>
        </div>
      </Card>

      <Card>
        <h2>Chỉ số chất lượng campaign</h2>
        <p className="sub">Tính riêng cho campaign này, cộng dồn các đợt. Vạch vàng là mức cần theo dõi, vạch đỏ là ngưỡng tạm dừng gửi.</p>
        <div style={{ marginTop: 8 }}>
          {METRICS.map((m) => {
            const v = metricValue(m.key, c), l: Level = health.byMetric[m.key], t = th(m.key);
            const color = l === 'crit' ? 'var(--tk-bad)' : l === 'warn' ? 'var(--tk-warn)' : 'var(--tk-s4)';
            return (
              <div className="tk-hr" key={m.key}>
                <div><b>{m.label}</b><div className="sub">{t && (t.warn != null || t.crit != null)
                  ? [t.warn != null ? `theo dõi từ ${m.dir === 'low' ? '<' : ''}${t.warn}%` : '', t.crit != null ? `tạm dừng từ ${m.dir === 'low' ? '<' : ''}${t.crit}%` : ''].filter(Boolean).join(' · ')
                  : 'chỉ theo dõi, không đặt ngưỡng'}</div></div>
                <div className="tk-track"><i style={{ width: `${Math.min((v / m.chartMax) * 100, 100)}%`, background: color }} /><Markers th={t} max={m.chartMax} /></div>
                <div className="hv"><b className={valueClass(l)}>{fmtPct(v)}</b> <LevelChip level={l} /></div>
              </div>
            );
          })}
          {!oc && ['Tỷ lệ mở', 'Tỷ lệ click'].map((n) => (
            <div className="tk-hr" key={n}><div><b>{n}</b><div className="sub">đặt ngưỡng khi có dữ liệu</div></div><div className="tk-devbar">Đang phát triển</div><div className="hv"><DevTag label="sắp ra mắt" /></div></div>
          ))}
        </div>
        {level !== 'ok' && <p className="note"><b>Khuyến nghị:</b> {METRICS.filter((m) => health.byMetric[m.key] !== 'ok').map((m) => `${m.label}: ${m.action}`).join(' · ')}</p>}
      </Card>

      <Card>
        <h2>Các đợt gửi</h2>
        <p className="sub">Một campaign có thể chia nhiều đợt; bảng này chỉ để tra cứu từng đợt, không dùng để so sánh.</p>
        <div className="scroll">
          <table>
            <thead><tr><th>Đợt</th><th>Thời gian gửi</th><th className="num">Total sent</th><th className="num">Khách nhận</th><th className="num">Bounce</th><th className="num">Giao TC</th><th className="num">Reply</th></tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}><td><b>Đợt {b.batchNo}</b></td><td>{b.sentAt ? new Date(b.sentAt).toLocaleString('vi-VN', { hour12: false }) : '—'}</td><td className="num">{b.sent}</td><td className="num">{b.recipients}</td><td className="num">{b.bounce}</td><td className="num">{b.delivered}</td><td className="num">{b.replyMain}</td></tr>
              ))}
              <tr><td><b>Tổng</b></td><td /><td className="num"><b>{c.totalSent}</b></td><td className="num"><b>{c.recipients}</b></td><td className="num"><b>{bad}</b></td><td className="num"><b>{c.delivered}</b></td><td className="num"><b>{c.replyMain}</b></td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid g2">
        <Card>
          <h2>Nguyên nhân bounce</h2>
          <p className="sub">{bad} trên {c.recipients} khách nhận ({fmtPct(pct(bad, c.recipients))}).</p>
          {bad > 0 && (
            <>
              <div className="tk-stack">
                <i style={{ width: `${(c.hard / bad) * 100}%`, background: 'var(--tk-bad)' }} />
                <i style={{ width: `${(c.soft / bad) * 100}%`, background: 'var(--tk-warn)' }} />
                <i style={{ width: `${(c.blocked / bad) * 100}%`, background: 'var(--color-primary)' }} />
                <i style={{ width: `${(c.other / bad) * 100}%`, background: 'var(--text-muted)' }} />
              </div>
              <div className="tk-legend" style={{ marginTop: 10 }}>
                <span><i style={{ background: 'var(--tk-bad)' }} />Hard {c.hard}</span>
                <span><i style={{ background: 'var(--tk-warn)' }} />Soft {c.soft}</span>
                <span><i style={{ background: 'var(--color-primary)' }} />Blocked {c.blocked}</span>
                {c.other > 0 && <span><i style={{ background: 'var(--text-muted)' }} />Khác {c.other}</span>}
              </div>
            </>
          )}
          <p className="note"><b>Hard</b>: địa chỉ không hợp lệ hoặc không tồn tại, nên loại khỏi danh sách. <b>Soft</b>: lỗi tạm thời, có thể gửi lại. <b>Blocked</b>: bị hệ thống của người nhận từ chối.</p>
          <button className="tk-btn ghost" style={{ marginTop: 10 }} onClick={() => goTab('bounce')}>Xem danh sách email bounce →</button>
        </Card>
        <Card>
          <h2>Khách hàng phản hồi</h2>
          <div className="scroll">
            <table>
              <thead><tr><th>Email</th><th>Loại</th><th>Thời gian</th></tr></thead>
              <tbody>
                {replies.map((r) => (
                  <tr key={r.id}><td className="mono">{r.email}</td><td><span className={`tk-chip ${r.isAuto ? 'auto' : 'reply'}`}>{r.isAuto ? 'Trả lời tự động' : 'Reply'}</span></td><td>{r.receivedAt ? new Date(r.receivedAt).toLocaleDateString('vi-VN') : '—'}</td></tr>
                ))}
                {replies.length === 0 && <tr><td colSpan={3} className="sub">Chưa có phản hồi.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="note">Bao gồm cả phản hồi tự động; đây là nhóm khách hàng có mức tương tác cao (hot key).</p>
        </Card>
      </div>
    </>
  );
}

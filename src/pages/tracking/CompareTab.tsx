import { useMemo, useState } from 'react';
import {
  METRICS, buildCompareItems, campaignDate, deltaPoints, deliveryRate, evaluateCampaign, fmtPct, metricValue,
  sumCounts, topicOf, type GroupMode,
} from '../../utils/trackingMetrics';
import { Card, DevTag, Markers, SERIES, type TabProps } from './ui';

const MAX_PICK = 5;
const GROUP_LABEL: Record<GroupMode, string> = { campaign: 'Theo campaign', month: 'Theo tháng', year: 'Theo năm' };

export default function CompareTab({ data }: TabProps) {
  const [group, setGroup] = useState<GroupMode>('campaign');
  const [topic, setTopic] = useState('all');
  const [year, setYear] = useState('all');
  const [picked, setPicked] = useState<string[] | null>(null);

  const base = useMemo(() => data.campaigns.filter((c) => !c.isTest && c.status !== 'draft' && c.totalSent > 0), [data.campaigns]);
  const topics = useMemo(() => [...new Set(base.map(topicOf))].sort(), [base]);
  const years = useMemo(() => [...new Set(base.map((c) => campaignDate(c).slice(0, 4)).filter(Boolean))].sort(), [base]);
  const items = useMemo(() => buildCompareItems(data.campaigns, { group, topic, year }), [data.campaigns, group, topic, year]);

  const valid = (picked ?? items.slice(-2).map((i) => i.id)).filter((id) => items.some((i) => i.id === id));
  const sel = items.filter((i) => valid.includes(i.id)).slice(0, MAX_PICK);

  const toggle = (id: string) => {
    const cur = valid;
    if (cur.includes(id)) setPicked(cur.filter((x) => x !== id));
    else if (cur.length < MAX_PICK) setPicked([...cur, id]);
  };
  const preset = (g: GroupMode, t: string) => { setGroup(g); setTopic(t); setYear('all'); setPicked(null); };
  const change = (fn: () => void) => { fn(); setPicked(null); };

  const rows = sel.map((i, idx) => ({ ...i, counts: sumCounts(i.campaigns), color: SERIES[idx % SERIES.length] }));
  const th = (k: string) => data.thresholds.find((t) => t.metric === k);
  const exceed = (i: (typeof rows)[number]) =>
    i.campaigns.filter((c) => evaluateCampaign(c, data.thresholds).overall !== 'ok').length;

  const deltaMetrics = [
    { key: 'delivery', label: 'Tỷ lệ giao thành công', val: deliveryRate, better: true },
    ...METRICS.filter((m) => m.key === 'hard' || m.key === 'total' || m.key === 'reply').map((m) => ({
      key: m.key, label: m.label, val: (c: Parameters<typeof deliveryRate>[0]) => metricValue(m.key, c), better: m.dir === 'low',
    })),
  ];

  return (
    <>
      <Card>
        <h2>So sánh campaign</h2>
        <p className="sub">So sánh tổng quan giữa các campaign (không so sánh theo đợt gửi). Chọn cách nhóm, lọc theo chủ đề / năm rồi tích chọn tối đa {MAX_PICK} mục.</p>
        <div className="row" style={{ marginTop: 14 }}>
          <div className="tk-seg">
            {(Object.keys(GROUP_LABEL) as GroupMode[]).map((g) => (
              <button key={g} className={group === g ? 'on' : ''} onClick={() => change(() => setGroup(g))}>{GROUP_LABEL[g]}</button>
            ))}
          </div>
          <label className="tk-field">Chủ đề
            <select value={topic} onChange={(e) => change(() => setTopic(e.target.value))}>
              <option value="all">Tất cả chủ đề</option>
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="tk-field">Năm
            <select value={year} onChange={(e) => change(() => setYear(e.target.value))}>
              <option value="all">Tất cả năm</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          {topics.slice(0, 4).map((t) => (
            <button key={t} className="tk-btn ghost" onClick={() => preset('campaign', t)}>{t} qua các năm</button>
          ))}
          <button className="tk-btn ghost" onClick={() => preset('year', 'all')}>Tổng hợp theo năm</button>
          <button className="tk-btn ghost" onClick={() => preset('month', 'all')}>Tổng hợp theo tháng</button>
        </div>
      </Card>

      <Card>
        <h3>Chọn mục để so sánh ({sel.length}/{MAX_PICK})</h3>
        {items.length === 0 ? <p className="sub" style={{ marginTop: 10 }}>Không có campaign phù hợp bộ lọc.</p> : (
          <div className="tk-pick" style={{ marginTop: 10 }}>
            {items.map((i) => {
              const on = valid.includes(i.id);
              const off = !on && valid.length >= MAX_PICK;
              return (
                <label key={i.id} className={on ? 'on' : off ? 'off' : ''}>
                  <input type="checkbox" checked={on} disabled={off} onChange={() => toggle(i.id)} />
                  <span>{i.label}<br /><small>{i.sub}</small></span>
                </label>
              );
            })}
          </div>
        )}
      </Card>

      {rows.length >= 1 && (
        <Card>
          <div className="row between">
            <h2>Chỉ số so sánh</h2>
            <div className="tk-legend">
              {rows.map((r) => <span key={r.id}><i style={{ background: r.color }} />{r.label}</span>)}
              <span>┆ vạch vàng: cần theo dõi · vạch đỏ: tạm dừng</span>
            </div>
          </div>
          <div className="tk-gb">
            <div className="tk-gb-row">
              <b>Giao thành công</b>
              <div className="tk-bars">
                {rows.map((r) => {
                  const v = deliveryRate(r.counts);
                  return <div className="tk-bar" key={r.id}><div className="tk-track"><i style={{ width: `${Math.min(v, 100)}%`, background: r.color }} /></div><span>{fmtPct(v)}</span></div>;
                })}
              </div>
            </div>
            {METRICS.map((m) => (
              <div className="tk-gb-row" key={m.key}>
                <b>{m.label}</b>
                <div className="tk-bars">
                  {rows.map((r) => {
                    const v = metricValue(m.key, r.counts);
                    return (
                      <div className="tk-bar" key={r.id}>
                        <div className="tk-track">
                          <i style={{ width: `${Math.min((v / m.chartMax) * 100, 100)}%`, background: r.color }} />
                          {group === 'campaign' && <Markers th={th(m.key)} max={m.chartMax} />}
                        </div>
                        <span>{fmtPct(v)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {!data.openClickEnabled && ['Mở email', 'Click'].map((l) => (
              <div className="tk-gb-row" key={l}>
                <b>{l}</b>
                <div className="tk-devbar"><DevTag />&nbsp;Chưa đo được, sẽ bổ sung</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {rows.length === 2 && (
        <Card>
          <h2>Chênh lệch: {rows[0].label} → {rows[1].label}</h2>
          <p className="sub">Tính bằng điểm phần trăm. Màu xanh là thay đổi theo hướng tốt.</p>
          <div style={{ marginTop: 8 }}>
            {deltaMetrics.map((m) => {
              const d = deltaPoints(m.val(rows[0].counts), m.val(rows[1].counts), m.better);
              const cls = d.good === null ? 'flat' : d.good ? 'up' : 'down';
              return (
                <div className="tk-delta" key={m.key}>
                  <b>{m.label}</b>
                  <span>{fmtPct(m.val(rows[0].counts))} → {fmtPct(m.val(rows[1].counts))}</span>
                  <span className={cls}>{d.points > 0 ? '+' : ''}{d.points.toFixed(1).replace('.', ',')} điểm</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <h2>Số liệu chi tiết</h2>
          <div className="scroll" style={{ marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>{group === 'campaign' ? 'Campaign' : 'Nhóm'}</th><th className="num">Total sent</th><th className="num">Khách nhận</th>
                  <th className="num">Giao thành công</th><th className="num">Hard</th><th className="num">Tổng bounce</th><th className="num">Reply</th>
                  {group !== 'campaign' && <th>Vượt ngưỡng</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: r.color, marginRight: 8 }} /><b>{r.label}</b></td>
                    <td className="num">{r.counts.totalSent}</td>
                    <td className="num">{r.counts.recipients}</td>
                    <td className="num">{fmtPct(deliveryRate(r.counts))}</td>
                    <td className="num">{fmtPct(metricValue('hard', r.counts))}</td>
                    <td className="num">{fmtPct(metricValue('total', r.counts))}</td>
                    <td className="num">{fmtPct(metricValue('reply', r.counts))}</td>
                    {group !== 'campaign' && (
                      <td><span className={`tk-lv ${exceed(r) ? 'warn' : 'ok'}`}>{exceed(r)}/{r.campaigns.length} campaign</span></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {group !== 'campaign' && <p className="note">Ở chế độ nhóm theo tháng / năm, tỷ lệ là số gộp của các campaign trong nhóm; mức cảnh báo vẫn được đánh giá riêng từng campaign.</p>}
        </Card>
      )}
    </>
  );
}

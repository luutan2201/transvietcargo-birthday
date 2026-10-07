import { useEffect, useState } from 'react';
import { trackingService } from '../../services/tracking/trackingService';
import type { TrackingThreshold } from '../../types/tracking';
import { DEFAULT_THRESHOLDS, METRICS } from '../../utils/trackingMetrics';
import { Card, DevTag, type TabProps } from './ui';

type Draft = Record<string, { warn: string; crit: string }>;

const toDraft = (list: TrackingThreshold[]): Draft =>
  Object.fromEntries(DEFAULT_THRESHOLDS.map((d) => {
    const t = list.find((x) => x.metric === d.metric);
    return [d.metric, { warn: t?.warn == null ? '' : String(t.warn), crit: t?.crit == null ? '' : String(t.crit) }];
  }));

const parse = (s: string): number | null => {
  const v = s.trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export default function ThresholdsTab({ data, isAdmin, userName, reload }: TabProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(data.thresholds));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setDraft(toDraft(data.thresholds)), [data.thresholds]);

  const save = async () => {
    const rows: TrackingThreshold[] = [];
    for (const m of METRICS) {
      const warn = parse(draft[m.key].warn), crit = parse(draft[m.key].crit);
      if (Number.isNaN(warn) || Number.isNaN(crit)) { setMsg(`${m.label}: giá trị không hợp lệ.`); return; }
      if (warn != null && crit != null && (m.dir === 'high' ? warn > crit : warn < crit)) {
        setMsg(`${m.label}: mức "cần theo dõi" phải ${m.dir === 'high' ? 'thấp hơn' : 'cao hơn'} mức "tạm dừng gửi".`); return;
      }
      rows.push({ metric: m.key, warn, crit });
    }
    setBusy(true); setMsg(null);
    try { await trackingService.saveThresholds(rows, userName); await reload(); setMsg('Đã lưu ngưỡng cảnh báo.'); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <Card>
        <h2>Ngưỡng cảnh báo</h2>
        <p className="sub">Ngưỡng được đánh giá riêng cho từng campaign. Để trống nghĩa là chỉ hiển thị, không cảnh báo.</p>
        <div className="scroll" style={{ marginTop: 10 }}>
          <table>
            <thead><tr><th>Chỉ số</th><th>Tính trên</th><th>Cần theo dõi (%)</th><th>Tạm dừng gửi (%)</th><th>Hành động khuyến nghị</th></tr></thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.key}>
                  <td><b>{m.label}</b><br /><small className="sub">{m.dir === 'high' ? 'càng cao càng xấu' : 'càng thấp càng xấu'}</small></td>
                  <td>{m.base}</td>
                  <td><input style={{ width: 80 }} inputMode="decimal" disabled={!isAdmin} value={draft[m.key].warn}
                    onChange={(e) => setDraft({ ...draft, [m.key]: { ...draft[m.key], warn: e.target.value } })} /></td>
                  <td><input style={{ width: 80 }} inputMode="decimal" disabled={!isAdmin} value={draft[m.key].crit}
                    onChange={(e) => setDraft({ ...draft, [m.key]: { ...draft[m.key], crit: e.target.value } })} /></td>
                  <td className="sub">{m.action}</td>
                </tr>
              ))}
              {!data.openClickEnabled && ['Mở email', 'Click'].map((l) => (
                <tr key={l}><td><b>{l}</b></td><td colSpan={4}><DevTag />&nbsp;Chưa đo được; ngưỡng sẽ bổ sung khi có dữ liệu.</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="tk-btn" disabled={!isAdmin || busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu ngưỡng'}</button>
          {!isAdmin && <span className="sub">Chỉ quản trị viên được chỉnh ngưỡng.</span>}
          {msg && <span className="sub">{msg}</span>}
        </div>
      </Card>
      <div className="tk-alert info">
        <div>
          <b>Lưu ý vận hành:</b> trang web hiển thị mức cảnh báo và đánh dấu campaign là <b>Tạm dừng gửi</b> (cột "Trạng thái gửi" trong sheet).
          Macro gửi mail cần kiểm tra cột này để tự dừng; quản lý bấm "Xác nhận đã khắc phục" sau khi rà soát danh sách để mở lại.
        </div>
      </div>
    </>
  );
}

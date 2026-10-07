import { useState } from 'react';
import { trackingService } from '../../services/tracking/trackingService';
import { topicOf } from '../../utils/trackingMetrics';
import { Card, type TabProps } from './ui';

const ID_RE = /^[A-Za-z0-9._-]{3,60}$/;
const empty = { id: '', name: '', subject: '', startDate: '', owner: 'Marketing', topic: '', notes: '' };

export default function NewCampaignTab({ data, canManage, reload, openCampaign }: TabProps) {
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });
  const topics = [...new Set(data.campaigns.map(topicOf))].sort();

  if (!canManage) return <Card><h2>Tạo campaign</h2><p className="sub">Chỉ quản trị viên và quản lý được tạo campaign.</p></Card>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = f.id.trim();
    if (!ID_RE.test(id)) { setMsg({ kind: 'err', text: 'Mã campaign gồm 3–60 ký tự chữ, số, ".", "_", "-" (ví dụ C2610-UUDAI-T11).' }); return; }
    if (data.campaigns.some((c) => c.id.toLowerCase() === id.toLowerCase())) { setMsg({ kind: 'err', text: 'Mã campaign đã tồn tại.' }); return; }
    if (!f.name.trim()) { setMsg({ kind: 'err', text: 'Vui lòng nhập tên campaign.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await trackingService.createCampaign({ ...f, id, name: f.name.trim(), topic: f.topic.trim() });
      await reload();
      setMsg(r.sheetSynced
        ? { kind: 'ok', text: `Đã tạo campaign ${id} và ghi vào Google Sheet.` }
        : { kind: 'warn', text: `Đã tạo campaign ${id} trên web nhưng chưa ghi được vào sheet. ${r.warning ?? 'Sẽ tự ghi vào sheet ở lần đồng bộ tới.'}` });
      setF(empty);
      openCampaign(id);
    } catch (er) { setMsg({ kind: 'err', text: (er as Error).message }); } finally { setBusy(false); }
  };

  return (
    <>
      <Card>
        <h2>Tạo campaign mới</h2>
        <p className="sub">Campaign tạo ở đây sẽ được ghi sang Google Sheet (tab Campaigns) gần như ngay lập tức.</p>
        <form className="tk-form" style={{ marginTop: 14 }} onSubmit={submit}>
          <label className="tk-field">Mã campaign *<input value={f.id} onChange={set('id')} placeholder="C2610-UUDAI-T11" /></label>
          <label className="tk-field">Tên campaign *<input value={f.name} onChange={set('name')} /></label>
          <label className="tk-field full">Tiêu đề email<input value={f.subject} onChange={set('subject')} /></label>
          <label className="tk-field">Ngày bắt đầu<input type="date" value={f.startDate} onChange={set('startDate')} /></label>
          <label className="tk-field">Phụ trách
            <select value={f.owner} onChange={set('owner')}><option>Marketing</option><option>Sales</option></select>
          </label>
          <label className="tk-field">Chủ đề (để so sánh)
            <input list="tk-topics" value={f.topic} onChange={set('topic')} placeholder="Trung thu, Bảng giá…" />
            <datalist id="tk-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          <label className="tk-field full">Ghi chú<textarea rows={3} value={f.notes} onChange={set('notes')} /></label>
          <div className="full row">
            <button className="tk-btn" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo campaign'}</button>
            {msg && <span className={msg.kind === 'err' ? 't-crit' : msg.kind === 'warn' ? 't-warn' : 'sub'}>{msg.text}</span>}
          </div>
        </form>
      </Card>
      <Card>
        <h3>Cách đồng bộ hai chiều</h3>
        <table style={{ marginTop: 8 }}>
          <thead><tr><th>Hướng</th><th>Độ trễ</th></tr></thead>
          <tbody>
            <tr><td>Web → Google Sheet (tạo campaign, tạm dừng gửi)</td><td>Gần như ngay lập tức</td></tr>
            <tr><td>Google Sheet → Web (số liệu gửi, bounce, reply)</td><td>Tối đa 30 phút, hoặc bấm "Đồng bộ ngay"</td></tr>
          </tbody>
        </table>
      </Card>
    </>
  );
}

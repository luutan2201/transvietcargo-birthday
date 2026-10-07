import { bounceTotal, displayLevel, fmtDateVN, fmtPct, metricValue, campaignDate, evaluateCampaign } from '../../utils/trackingMetrics';
import { Card, DevTag, LevelChip, statusTag, valueClass, type TabProps } from './ui';

export default function OverviewTab({ data, openCampaign }: TabProps) {
  const camps = data.campaigns.filter((c) => !c.isTest).sort((a, b) => campaignDate(b).localeCompare(campaignDate(a)));
  const sent = camps.filter((c) => c.status !== 'draft');
  const level = (c: (typeof camps)[number]) => displayLevel(c, data.thresholds);
  const active = sent.filter((c) => c.status !== 'closed');
  const crits = active.filter((c) => level(c) === 'crit');
  const warns = active.filter((c) => level(c) === 'warn');
  const okCount = sent.filter((c) => level(c) === 'ok').length;
  const worst = sent.reduce<(typeof sent)[number] | null>(
    (w, c) => (!w || metricValue('hard', c) > metricValue('hard', w) ? c : w), null);
  const drafts = camps.filter((c) => c.status === 'draft').length;

  return (
    <>
      {crits.map((c) => (
        <div className="tk-alert crit" key={c.id}>
          <div>
            <b className="t">Khuyến nghị tạm dừng gửi · {c.name || c.id}</b><br />
            {c.pausedReason ?? `Hard bounce ${fmtPct(metricValue('hard', c))}`}. Chưa nên gửi đợt tiếp theo cho đến khi rà soát xong danh sách.
          </div>
          <button className="tk-btn" onClick={() => openCampaign(c.id)}>Xem chi tiết</button>
        </div>
      ))}
      {warns.length > 0 && (
        <div className="tk-alert warn">
          <div>
            <b>Cần theo dõi · {warns.map((c) => c.id).join(', ')}</b><br />
            Có chỉ số sát ngưỡng tạm dừng. Nên kiểm tra kỹ danh sách trước khi gửi đợt tiếp theo.
          </div>
        </div>
      )}

      <div className="grid g4">
        <Card><div className="tk-kpi"><h3>Campaign</h3><div className="v">{camps.length}</div><div className="n">{sent.length} đã gửi · {drafts} chưa gửi</div></div></Card>
        <Card><div className="tk-kpi"><h3>Trong ngưỡng an toàn</h3><div className="v" style={{ color: 'var(--tk-ok-fg)' }}>{okCount} / {sent.length}</div><div className="n">campaign đã gửi đạt chuẩn</div></div></Card>
        <Card><div className="tk-kpi"><h3>Cần tạm dừng gửi</h3><div className="v" style={{ color: crits.length ? 'var(--tk-bad)' : undefined }}>{crits.length}</div><div className="n">{crits.length ? crits.map((c) => c.id).join(', ') : 'không có'}</div></div></Card>
        <Card><div className="tk-kpi"><h3>Hard bounce cao nhất</h3><div className="v">{worst ? fmtPct(metricValue('hard', worst)) : '—'}</div><div className="n">{worst ? `${worst.id} · ngưỡng tạm dừng ${data.thresholds.find((t) => t.metric === 'hard')?.crit ?? '—'}%` : 'chưa có dữ liệu'}</div></div></Card>
        {!data.openClickEnabled && (
          <Card style={{ borderStyle: 'dashed' }}><div className="tk-kpi tk-dev"><h3>Mở / Click (theo campaign)</h3><div className="v">—</div><div className="n"><DevTag /></div></div></Card>
        )}
      </div>

      <Card>
        <h2>Danh sách campaign</h2>
        <p className="sub">Chọn một dòng để xem chi tiết. Tỷ lệ bounce tính trên số khách nhận; tỷ lệ reply tính trên số email giao thành công.</p>
        <div className="scroll" style={{ marginTop: 10 }}>
          <table>
            <thead>
              <tr>
                <th>Campaign</th><th>Gửi lần đầu</th><th>Trạng thái</th>
                <th className="num">Total sent</th><th className="num">Khách nhận</th>
                <th className="num">Hard</th><th className="num">Tổng bounce</th><th className="num">Reply</th>
                {!data.openClickEnabled && <><th className="num">Mở <DevTag label="sắp ra mắt" /></th><th className="num">Click <DevTag label="sắp ra mắt" /></th></>}
                {data.openClickEnabled && <><th className="num">Mở</th><th className="num">Click</th></>}
                <th>Cảnh báo</th>
              </tr>
            </thead>
            <tbody>
              {camps.map((c) => {
                const isDraft = c.status === 'draft';
                const lv = level(c);
                const h = evaluateCampaign(c, data.thresholds).byMetric;
                const dash = <td className="num dvc">—</td>;
                return (
                  <tr className="click" key={c.id} onClick={() => openCampaign(c.id)}>
                    <td><b>{c.id}</b><br /><span className="sub">{c.name}</span></td>
                    <td>{fmtDateVN(campaignDate(c))}</td>
                    <td>{statusTag(c)}</td>
                    {isDraft ? <>{dash}{dash}{dash}{dash}{dash}</> : <>
                      <td className="num">{c.totalSent}</td>
                      <td className="num">{c.recipients}</td>
                      <td className={`num ${valueClass(h.hard) ?? ''}`}>{fmtPct(metricValue('hard', c))}</td>
                      <td className={`num ${valueClass(h.total) ?? ''}`}>{fmtPct((bounceTotal(c) / Math.max(c.recipients, 1)) * 100)}</td>
                      <td className="num">{fmtPct(metricValue('reply', c))}</td>
                    </>}
                    {data.openClickEnabled
                      ? <><td className="num">{c.openMain != null && c.delivered ? fmtPct((c.openMain / c.delivered) * 100) : '—'}</td><td className="num">{c.clickMain != null && c.delivered ? fmtPct((c.clickMain / c.delivered) * 100) : '—'}</td></>
                      : <>{dash}{dash}</>}
                    <td>{isDraft ? null : <LevelChip level={lv} />}</td>
                  </tr>
                );
              })}
              {camps.length === 0 && <tr><td colSpan={11} className="sub">Chưa có campaign. Tạo campaign ở tab “Tạo campaign” hoặc nhập vào sheet rồi bấm “Đồng bộ ngay”.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="note">Campaign thử nghiệm (mã có chữ “Test”) được loại khỏi mọi thống kê và so sánh.</p>
      </Card>
    </>
  );
}

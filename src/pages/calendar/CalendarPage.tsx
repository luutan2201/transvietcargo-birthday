import { useEffect, useMemo, useState } from 'react';
import type { Customer, Station } from '../../types/entities';
import { customerService } from '../../services/customer/customerService';

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];
const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const ECARD_COLOR = '#4CAF50';
const GIFT_COLOR = '#2563EB';

type StationFilter = 'ALL' | Station;

export default function CalendarPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [year, setYear] = useState(now.getFullYear());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stationFilter, setStationFilter] = useState<StationFilter>('ALL');

  useEffect(() => {
    // Loaded once — the calendar is purely derived from customers already
    // in the local database, so navigating between months never re-fetches.
    customerService.list({ pageSize: 5000 }).then((r) => setCustomers(r.items));
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<number, Customer[]>();
    for (const c of customers) {
      if (!c.birthDate) continue;
      if (stationFilter !== 'ALL' && c.station !== stationFilter) continue;
      const [, m, d] = c.birthDate.split('-').map(Number);
      if (m !== month) continue;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(c);
    }
    return map;
  }, [customers, month, stationFilter]);

  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);

  function goPrev() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); } else { setMonth((m) => m - 1); }
  }
  function goNext() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); } else { setMonth((m) => m + 1); }
  }
  function goToday() {
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 10 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>{MONTH_NAMES[month - 1]} {year}</h1>
          <p style={{ fontSize: 15, color: '#1A1A1A', fontWeight: 500 }}>
            Nếu sinh nhật rơi vào thứ 7 hoặc Chủ Nhật, Admin sẽ gửi quà vào thứ 6 trước đó
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={goPrev} style={navBtn}>◀</button>
          <button onClick={goToday} style={{ ...navBtn, width: 'auto', padding: '0 12px' }}>Hôm nay</button>
          <button onClick={goNext} style={navBtn}>▶</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 15, fontWeight: 600 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Dot color={ECARD_COLOR} size={12} /> eCard only</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Dot color={GIFT_COLOR} size={12} /> Gift visit</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginRight: 4 }}>Station:</span>
          <StationButton active={stationFilter === 'ALL'} onClick={() => setStationFilter('ALL')}>Tất cả</StationButton>
          <StationButton active={stationFilter === 'SGN'} onClick={() => setStationFilter('SGN')}>SGN</StationButton>
          <StationButton active={stationFilter === 'HAN'} onClick={() => setStationFilter('HAN')}>HAN</StationButton>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 980 }}>
          <thead>
            <tr>
              {WEEKDAY_LABELS.map((w) => (
                <th key={w} style={{ padding: '8px 6px', fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', textAlign: 'left' }}>{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((day, di) => (
                  <td key={di} style={{ verticalAlign: 'top', border: '1px solid rgba(20,126,147,0.10)', padding: 6, height: 110, background: day && isToday(year, month, day) ? 'rgba(20,126,147,0.06)' : 'transparent' }}>
                    {day && (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>{day}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 76, overflowY: 'auto' }}>
                          {(byDay.get(day) ?? []).map((c) => (
                            <div key={c.id} title={`${c.fullName} — ${c.company ?? ''} (${c.station})`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, background: '#fff', borderRadius: 8, padding: '3px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <Dot color={c.greetingType === 'gift_visit' ? GIFT_COLOR : ECARD_COLOR} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.fullName}{c.company ? ` | ${c.company}` : ''}
                                {stationFilter === 'ALL' && <span style={{ color: 'var(--text-muted)' }}> · {c.station}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />;
}

function StationButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        background: active ? 'var(--color-primary)' : '#fff', color: active ? '#fff' : 'var(--text-main)',
        boxShadow: active ? 'none' : '0 0 0 1px rgba(20,126,147,0.2)',
      }}
    >
      {children}
    </button>
  );
}

function isToday(year: number, month: number, day: number): boolean {
  const t = new Date();
  return t.getFullYear() === year && t.getMonth() + 1 === month && t.getDate() === day;
}

/** Builds a Monday-first week grid for the given month, padding with nulls
 * outside the month's actual days. */
function buildMonthGrid(year: number, month: number): Array<Array<number | null>> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7; // 0 = Monday

  const cells: Array<number | null> = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const navBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(20,126,147,0.2)', background: '#fff', cursor: 'pointer', fontSize: 13 };

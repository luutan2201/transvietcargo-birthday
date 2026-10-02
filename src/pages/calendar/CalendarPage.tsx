import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Customer, Station } from '../../types/entities';
import { customerService } from '../../services/customer/customerService';

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];
const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const ECARD_COLOR = '#F5A623';
const GIFT_COLOR = '#E53E3E';

type StationFilter = 'ALL' | Station;

export default function CalendarPage() {
  const navigate = useNavigate();
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
          <h1 style={{ marginBottom: 6, fontSize: 30, fontWeight: 800 }}>{MONTH_NAMES[month - 1]} {year}</h1>
          <p style={{ fontSize: 15, color: '#1A1A1A', fontWeight: 500 }}>
            Nếu sinh nhật rơi vào thứ 7 hoặc Chủ Nhật, Admin sẽ gửi quà vào thứ 6 trước đó
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={goPrev} style={navBtn}>◀</button>
          <button onClick={goToday} style={{ ...navBtn, width: 'auto', padding: '0 16px', background: 'var(--color-primary)', color: '#fff', border: 'none' }}>Hôm nay</button>
          <button onClick={goNext} style={navBtn}>▶</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 18, fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Dot color={ECARD_COLOR} size={20} /> eCard only</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Dot color={GIFT_COLOR} size={20} /> Gift visit</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginRight: 4 }}>Station:</span>
          <StationButton active={stationFilter === 'ALL'} onClick={() => setStationFilter('ALL')}>Tất cả</StationButton>
          <StationButton active={stationFilter === 'SGN'} onClick={() => setStationFilter('SGN')}>SGN</StationButton>
          <StationButton active={stationFilter === 'DAD'} onClick={() => setStationFilter('DAD')}>DAD</StationButton>
          <StationButton active={stationFilter === 'HAN'} onClick={() => setStationFilter('HAN')}>HAN</StationButton>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 980 }}>
          <thead>
            <tr>
              {WEEKDAY_LABELS.map((w) => (
                <th key={w} style={{ padding: '10px 6px', fontSize: 17, fontWeight: 800, color: 'var(--color-primary)', textAlign: 'center' }}>{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((day, di) => (
                  <td key={di} style={{ verticalAlign: 'top', border: '1px solid rgba(20,126,147,0.10)', padding: 8, height: 190, background: day && isToday(year, month, day) ? 'rgba(20,126,147,0.06)' : 'transparent' }}>
                    {day && (
                      <>
                        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'center' }}>{day}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, maxHeight: 158, overflowY: 'auto' }}>
                          {(byDay.get(day) ?? []).map((c) => (
                            <CustomerChip
                              key={c.id}
                              customer={c}
                              color={c.greetingType === 'gift_visit' ? GIFT_COLOR : ECARD_COLOR}
                              showStation={stationFilter === 'ALL'}
                              onClick={() => navigate(`/customers?customerId=${c.id}`)}
                            />
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

interface CustomerChipProps {
  customer: Customer;
  color: string;
  showStation: boolean;
  onClick: () => void;
}

/** Two-line card: the customer's name on its own centered line (shrinking
 * its own font if needed so it never wraps or overflows), with
 * company/station on a smaller muted line underneath. */
function CustomerChip({ customer, color, showStation, onClick }: CustomerChipProps) {
  const nameRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const meta = [customer.company, showStation ? customer.station : undefined].filter(Boolean).join(' · ');

  useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    let size = 14.5;
    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > el.clientWidth && size > 10.5) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
  }, [customer.fullName]);

  return (
    <div
      title={`${customer.fullName} — ${customer.company ?? ''} (${customer.station}) — bấm để xem chi tiết`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        background: hovered ? 'rgba(20,126,147,0.10)' : '#fff', borderRadius: 12, padding: '9px 8px',
        width: '100%', textAlign: 'center', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      <div ref={nameRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, letterSpacing: '-0.3px', lineHeight: 1.25, whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden' }}>
        <Dot color={color} size={14} />
        <span>{customer.fullName}</span>
      </div>
      {meta && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.25 }}>{meta}</div>}
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

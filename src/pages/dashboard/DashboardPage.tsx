import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { customerRepository } from '../../data/repositories/CustomerRepository';
import { customerService } from '../../services/customer/customerService';
import { useAuth } from '../../hooks/useAuth';
import { getTimeBasedGreeting } from '../../utils/greeting';
import type { Customer } from '../../types/entities';

const QUICK_ACTIONS = [
  { icon: '👤', title: 'Khách hàng mới', desc: 'Thêm khách hàng vào hệ thống', to: '/customers' },
  { icon: '◈', title: 'Tạo eCard', desc: 'Tạo thiệp cho khách hàng', to: '/cards' },
  { icon: '✉', title: 'Tạo Email', desc: 'Soạn email chúc mừng sinh nhật', to: '/email' },
];

const COMPLETED_COLOR = '#4CAF50';
const REMAINING_COLOR = '#F44336';
const ECARD_COLOR = '#4CAF50';
const GIFT_COLOR = '#2563EB';

function isCompleted(c: Customer): boolean {
  return c.ecardSent && (c.greetingType !== 'gift_visit' || c.giftGiven);
}

export default function DashboardPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ customers: 0, pendingGifts: 0 });
  const [birthdaysThisMonth, setBirthdaysThisMonth] = useState<Customer[]>([]);

  useEffect(() => {
    (async () => {
      const customers = await customerRepository.count();
      const currentMonth = new Date().getMonth() + 1;
      const monthList = await customerService.listByBirthMonth(currentMonth);
      const pendingGifts = await customerRepository.findByFilters({ greetingType: 'gift_visit', pendingOnly: true });
      setStats({ customers, pendingGifts: pendingGifts.length });
      setBirthdaysThisMonth(monthList);
    })();
  }, []);

  const completedCount = birthdaysThisMonth.filter(isCompleted).length;
  const remainingCount = birthdaysThisMonth.length - completedCount;
  const ecardOnlyCount = birthdaysThisMonth.filter((c) => c.greetingType === 'ecard_only').length;
  const giftVisitCount = birthdaysThisMonth.filter((c) => c.greetingType === 'gift_visit').length;

  const completionData = [
    { name: 'Đã hoàn thành', value: completedCount },
    { name: 'Còn lại', value: remainingCount },
  ];

  const stationBreakdown = (['SGN', 'HAN'] as const).map((station) => ({
    station,
    'eCard only': birthdaysThisMonth.filter((c) => c.station === station && c.greetingType === 'ecard_only').length,
    'Gift visit': birthdaysThisMonth.filter((c) => c.station === station && c.greetingType === 'gift_visit').length,
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>{getTimeBasedGreeting()}, {session?.displayName?.split(' ').slice(-1)[0] ?? ''} 👋</h1>
          <p style={{ marginTop: 4 }}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>Thao tác nhanh</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {QUICK_ACTIONS.map((qa) => (
            <div
              key={qa.title}
              onClick={() => navigate(qa.to)}
              style={{
                background: 'rgba(255,255,255,0.6)', borderRadius: 18, padding: 18,
                borderTop: '3px solid var(--color-primary)', boxShadow: '0 6px 18px rgba(20,126,147,0.06)',
                cursor: 'pointer',
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, marginBottom: 12 }}>
                {qa.icon}
              </div>
              <h3>{qa.title}</h3>
              <p style={{ fontSize: 13 }}>{qa.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 28 }}>
        <StatCard icon="◉" iconBg="#E3F3F6" iconColor="#147E93" label="Tổng khách hàng" value={stats.customers} />
        <StatCard icon="🎂" iconBg="#FFF3E0" iconColor="#E08A00" label="Sinh nhật tháng này" value={birthdaysThisMonth.length} />
        <StatCard icon="🎁" iconBg="#FDEDEA" iconColor="#D8462F" label="Gift visit chờ xử lý" value={stats.pendingGifts} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 18, marginBottom: 28 }}>
        <div className="glass-panel" style={{ padding: 22 }}>
          <h2 style={{ marginBottom: 8 }}>Tiến độ sinh nhật tháng này</h2>
          {birthdaysThisMonth.length === 0 ? (
            <p>Chưa có dữ liệu.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={completionData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                  <Cell fill={COMPLETED_COLOR} />
                  <Cell fill={REMAINING_COLOR} />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
          <p style={{ textAlign: 'center', fontSize: 13 }}>
            {completedCount}/{birthdaysThisMonth.length} đã hoàn thành · {ecardOnlyCount} eCard only · {giftVisitCount} gift visit
          </p>
        </div>

        <div className="glass-panel" style={{ padding: 22 }}>
          <h2 style={{ marginBottom: 8 }}>Phân bổ theo Station</h2>
          {birthdaysThisMonth.length === 0 ? (
            <p>Chưa có dữ liệu.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stationBreakdown}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="station" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="eCard only" fill={ECARD_COLOR} radius={[6, 6, 0, 0]} />
                <Bar dataKey="Gift visit" fill={GIFT_COLOR} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 22 }}>
        <h2 style={{ marginBottom: 12 }}>Sinh nhật tháng này ({birthdaysThisMonth.length})</h2>
        {birthdaysThisMonth.length === 0 ? (
          <p>Chưa có khách hàng nào có sinh nhật tháng này.</p>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {birthdaysThisMonth
              .slice()
              .sort((a, b) => Number(a.birthDate!.split('-')[2]) - Number(b.birthDate!.split('-')[2]))
              .map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px', borderBottom: '1px solid rgba(20,126,147,0.08)', fontSize: 14 }}>
                  <span>
                    <strong>{formatDay(c.birthDate!)}</strong> — {c.fullName} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({c.company ?? '—'} · {c.station})</span>
                  </span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <StatusBadge label={c.ecardSent ? 'Đã gửi eCard' : 'Chưa gửi eCard'} ok={c.ecardSent} />
                    {c.greetingType === 'gift_visit' && <StatusBadge label={c.giftGiven ? 'Đã tặng quà' : 'Chưa tặng quà'} ok={c.giftGiven} />}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value }: { icon: string; iconBg: string; iconColor: string; label: string; value: number }) {
  return (
    <div className="glass-panel" style={{ padding: 22 }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>
        {icon}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-main)' }}>{value}</div>
    </div>
  );
}

function StatusBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: ok ? '#E1F5E4' : '#FFF3D6', color: ok ? '#1E7B2C' : '#9A6A00' }}>
      {label}
    </span>
  );
}

function formatDay(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

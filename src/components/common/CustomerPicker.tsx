import { useMemo, useState } from 'react';
import type { Customer } from '../../types/entities';

interface Props {
  customers: Customer[];
  value: string;
  onChange: (customerId: string) => void;
  /** Field used to determine "already completed" (e.g. ecardSent) — lets
   * the picker hide customers already done by default, while still finding
   * them if you search by name/email directly. */
  completedField?: 'ecardSent';
  placeholder?: string;
}

function isBirthdayThisMonth(c: Customer): boolean {
  if (!c.birthDate) return false;
  return Number(c.birthDate.split('-')[1]) === new Date().getMonth() + 1;
}

export function CustomerPicker({ customers, value, onChange, completedField, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [birthdayOnly, setBirthdayOnly] = useState(false);

  const selected = customers.find((c) => c.id === value);

  const results = useMemo(() => {
    let list = customers;
    if (birthdayOnly) list = list.filter(isBirthdayThisMonth);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) => c.fullName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.company ?? '').toLowerCase().includes(q)
      );
    } else if (hideCompleted && completedField) {
      list = list.filter((c) => !c[completedField]);
    }
    return list.slice(0, 60);
  }, [customers, query, hideCompleted, birthdayOnly, completedField]);

  function handleSelect(c: Customer) {
    onChange(c.id);
    setQuery('');
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={open ? query : selected?.fullName ?? ''}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? 'Gõ tên, email hoặc công ty để tìm…'}
        style={{ width: '100%' }}
      />
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 30,
            background: '#fff', borderRadius: 12, boxShadow: '0 12px 32px rgba(20,126,147,0.18)',
            border: '1px solid rgba(20,126,147,0.15)', overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #eee', flexWrap: 'wrap' }}>
            {completedField && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
                Chỉ hiện chưa hoàn thành
              </label>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setBirthdayOnly((b) => !b)}
              style={{
                padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
                background: birthdayOnly ? 'var(--color-primary)' : '#eee', color: birthdayOnly ? '#fff' : '#333',
              }}
            >
              🎂 Sinh nhật tháng này
            </button>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {results.length === 0 && <div style={{ padding: 14, fontSize: 14, color: 'var(--text-muted)' }}>Không tìm thấy khách hàng.</div>}
            {results.map((c) => (
              <div
                key={c.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(c)}
                style={{
                  padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid #f3f3f3', fontSize: 14,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(20,126,147,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>
                  {c.fullName} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({c.gender === 'male' ? 'Nam' : c.gender === 'female' ? 'Nữ' : '—'})</span>
                  {isBirthdayThisMonth(c) && <span style={{ marginLeft: 6 }}>🎂</span>}
                  {completedField && c[completedField] && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-success)' }}>✓ Đã xong</span>}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.email}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

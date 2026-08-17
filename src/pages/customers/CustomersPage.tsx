import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Customer, GreetingType, Station } from '../../types/entities';
import { customerService } from '../../services/customer/customerService';
import { CustomerFormModal } from '../../components/customer/CustomerFormModal';
import { CustomerImportModal } from '../../components/customer/CustomerImportModal';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../services/auth/permissions';

const MONTHS = [
  { value: 0, label: 'All months' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` })),
];

/** Sorts customers by birthday month/day ascending (Jan 1 → Dec 31); those
 * without a birthDate are pushed to the end so the list stays scannable. */
function sortByBirthday(customers: Customer[]): Customer[] {
  return [...customers].sort((a, b) => {
    if (!a.birthDate && !b.birthDate) return a.fullName.localeCompare(b.fullName);
    if (!a.birthDate) return 1;
    if (!b.birthDate) return -1;
    const [, aMonth, aDay] = a.birthDate.split('-');
    const [, bMonth, bDay] = b.birthDate.split('-');
    return `${aMonth}${aDay}`.localeCompare(`${bMonth}${bDay}`);
  });
}

function formatMoney(n?: number): string {
  if (n === undefined) return '—';
  return n.toLocaleString('vi-VN');
}

export default function CustomersPage() {
  const { session } = useAuth();
  const canEdit = !!session && hasPermission(session.role, 'customers.edit');
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedCustomerId = searchParams.get('customerId');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [birthMonth, setBirthMonth] = useState(0);
  const [station, setStation] = useState<Station | ''>('');
  const [greetingType, setGreetingType] = useState<GreetingType | ''>('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Customer | null | undefined>(undefined);
  const [showImport, setShowImport] = useState(false);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    if (focusedCustomerId) {
      const c = await customerService.getById(focusedCustomerId);
      setCustomers(c ? [c] : []);
      if (!silent) setLoading(false);
      return;
    }

    let results: Customer[];
    const hasFilters = birthMonth || station || greetingType || pendingOnly;
    if (search) {
      results = await customerService.search(search);
    } else if (hasFilters) {
      results = await customerService.filter({
        birthMonth: birthMonth || undefined,
        station: station || undefined,
        greetingType: greetingType || undefined,
        pendingOnly: pendingOnly || undefined,
      });
    } else {
      results = (await customerService.list({ pageSize: 1000 })).items;
    }
    setCustomers(sortByBirthday(results));
    if (!silent) setLoading(false);
  }, [search, birthMonth, station, greetingType, pendingOnly, focusedCustomerId]);

  useEffect(() => {
    const t = setTimeout(() => reload(), 250); // debounce
    return () => clearTimeout(t);
  }, [reload]);

  function clearFocus() {
    searchParams.delete('customerId');
    setSearchParams(searchParams);
  }

  async function handleDelete(id: string) {
    if (!confirm('Move this customer to trash?')) return;
    await customerService.softDelete(id);
    reload(true);
  }

  // Toggling a checkbox updates local state immediately (no full reload,
  // no "Loading…" flicker) — this is what previously collapsed the table
  // height and reset the page's scroll position back to the top.
  async function handleToggleEcard(c: Customer) {
    const next = !c.ecardSent;
    setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, ecardSent: next } : x)));
    await customerService.toggleEcardSent(c.id, next);
  }

  async function handleToggleGift(c: Customer) {
    const next = !c.giftGiven;
    setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, giftGiven: next } : x)));
    await customerService.toggleGiftGiven(c.id, next);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Customers</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && <button onClick={() => setShowImport(true)} style={secondaryButtonStyle}>Import Excel</button>}
          {canEdit && <button onClick={() => setEditing(null)} style={primaryButtonStyle}>+ New Customer</button>}
        </div>
      </div>

      {focusedCustomerId ? (
        <div className="glass-panel" style={{ padding: 12, margin: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15 }}>Đang xem 1 khách hàng cụ thể (từ Calendar).</span>
          <button onClick={clearFocus} style={secondaryButtonStyle}>Xem tất cả khách hàng</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0' }}>
          <input
            placeholder="Search by name, email, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, padding: 10, borderRadius: 10, border: '1px solid #d0d7e2' }}
          />
          <select value={birthMonth} onChange={(e) => setBirthMonth(Number(e.target.value))} style={selectStyle}>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={station} onChange={(e) => setStation(e.target.value as Station | '')} style={selectStyle}>
            <option value="">All stations</option>
            <option value="SGN">SGN</option>
            <option value="HAN">HAN</option>
          </select>
          <select value={greetingType} onChange={(e) => setGreetingType(e.target.value as GreetingType | '')} style={selectStyle}>
            <option value="">All greeting types</option>
            <option value="ecard_only">eCard only</option>
            <option value="gift_visit">Gift visit</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}>
            <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
            Chưa hoàn thành
          </label>
        </div>
      )}

      {canEdit && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px' }}>Bấm vào 1 dòng bất kỳ để chỉnh sửa.</p>}

      <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '9%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '4%' }} />
            <col style={{ width: '4%' }} />
            <col style={{ width: '6%' }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'rgba(0,59,122,0.06)', textAlign: 'left' }}>
              <th style={th}>Company</th>
              <th style={th}>Name</th>
              <th style={th}>Gender</th>
              <th style={th}>Position</th>
              <th style={th}>Email</th>
              <th style={th}>Birthday</th>
              <th style={th}>Station</th>
              <th style={th}>Type</th>
              <th style={th}>Gift suggestion</th>
              <th style={th}>Budget</th>
              <th style={th}>eCard</th>
              <th style={th}>Gift</th>
              {canEdit && <th style={th}></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td style={td} colSpan={13}>Loading…</td></tr>
            ) : customers.length === 0 ? (
              <tr><td style={td} colSpan={13}>No customers found.</td></tr>
            ) : (
              customers.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => canEdit && setEditing(c)}
                  style={{ borderTop: '1px solid #eee', cursor: canEdit ? 'pointer' : 'default' }}
                  onMouseEnter={(e) => canEdit && (e.currentTarget.style.background = 'rgba(20,126,147,0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={ellipsisTd} title={c.company}>{c.company || '—'}</td>
                  <td style={ellipsisTd} title={c.fullName}>{c.fullName}</td>
                  <td style={td}>{genderLabel(c.gender)}</td>
                  <td style={ellipsisTd} title={c.position}>{c.position || '—'}</td>
                  <td style={ellipsisTd} title={c.email}>{c.email}</td>
                  <td style={td}>{c.birthDate ? formatBirthday(c.birthDate) : '—'}</td>
                  <td style={td}><StationBadge station={c.station} /></td>
                  <td style={td}>{c.greetingType === 'gift_visit' ? '🎁 Gift' : '💌 eCard'}</td>
                  <td style={ellipsisTd} title={c.giftSuggestion}>
                    {c.greetingType === 'gift_visit' ? (c.giftSuggestion || '—') : ''}
                  </td>
                  <td style={ellipsisTd}>{c.greetingType === 'gift_visit' ? formatMoney(c.giftBudget) : ''}</td>
                  <td style={td} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={c.ecardSent} disabled={!canEdit} onChange={() => handleToggleEcard(c)} />
                  </td>
                  <td style={td} onClick={(e) => e.stopPropagation()}>
                    {c.greetingType === 'gift_visit' && (
                      <input type="checkbox" checked={c.giftGiven} disabled={!canEdit} onChange={() => handleToggleGift(c)} />
                    )}
                  </td>
                  {canEdit && (
                    <td style={td} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleDelete(c.id)} style={{ ...linkBtn, color: 'var(--color-danger)' }}>Delete</button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing !== undefined && (
        <CustomerFormModal
          customer={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); reload(true); }}
        />
      )}
      {showImport && (
        <CustomerImportModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); reload(); }} />
      )}
    </div>
  );
}

function formatBirthday(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

function genderLabel(gender: Customer['gender']): string {
  if (gender === 'male') return 'Nam';
  if (gender === 'female') return 'Nữ';
  return '—';
}

function StationBadge({ station }: { station: Station }) {
  const color = station === 'SGN' ? 'var(--color-secondary)' : 'var(--color-accent)';
  return <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 13, color: '#fff', background: color }}>{station}</span>;
}

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const td: React.CSSProperties = { padding: '10px 12px' };
const ellipsisTd: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--color-secondary)', cursor: 'pointer', marginRight: 8, padding: 0, fontSize: 15 };
const primaryButtonStyle: React.CSSProperties = { padding: '10px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' };
const secondaryButtonStyle: React.CSSProperties = { padding: '10px 16px', background: '#eee', color: '#333', border: 'none', borderRadius: 10, cursor: 'pointer' };
const selectStyle: React.CSSProperties = { padding: 10, borderRadius: 10, border: '1px solid #d0d7e2' };

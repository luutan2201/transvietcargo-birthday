import { useState, type FormEvent } from 'react';
import type { Customer, GreetingType, Station } from '../../types/entities';
import { customerService } from '../../services/customer/customerService';

interface Props {
  customer?: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CustomerFormModal({ customer, onClose, onSaved }: Props) {
  const [fullName, setFullName] = useState(customer?.fullName ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [gender, setGender] = useState<Customer['gender']>(customer?.gender ?? 'unknown');
  const [company, setCompany] = useState(customer?.company ?? '');
  const [position, setPosition] = useState(customer?.position ?? '');
  const [birthDate, setBirthDate] = useState(customer?.birthDate ?? '');
  const [greetingType, setGreetingType] = useState<GreetingType>(customer?.greetingType ?? 'ecard_only');
  const [station, setStation] = useState<Station>(customer?.station ?? 'SGN');
  const [giftSuggestion, setGiftSuggestion] = useState(customer?.giftSuggestion ?? '');
  const [giftBudget, setGiftBudget] = useState(customer?.giftBudget !== undefined ? String(customer.giftBudget) : '');
  const [ecardSent, setEcardSent] = useState(customer?.ecardSent ?? false);
  const [giftGiven, setGiftGiven] = useState(customer?.giftGiven ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (customer) {
        await customerService.update(customer.id, {
          fullName,
          email,
          gender,
          company,
          position,
          birthDate: birthDate || undefined,
          greetingType,
          station,
          giftSuggestion: greetingType === 'gift_visit' ? giftSuggestion : undefined,
          giftBudget: greetingType === 'gift_visit' && giftBudget ? Number(giftBudget) : undefined,
          ecardSent,
          giftGiven: greetingType === 'gift_visit' ? giftGiven : false,
        });
      } else {
        await customerService.create({
          fullName,
          email,
          gender,
          company,
          position,
          birthDate: birthDate || undefined,
          greetingType,
          station,
          giftSuggestion,
          giftBudget: giftBudget ? Number(giftBudget) : undefined,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div className="glass-panel" style={{ padding: 24, width: 460, maxHeight: '85vh', overflowY: 'auto' }}>
        <h2 style={{ marginTop: 0, color: 'var(--color-primary)' }}>{customer ? 'Edit Customer' : 'New Customer'}</h2>
        <form onSubmit={handleSubmit}>
          <Field label="Full name"><input required value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} /></Field>
          <Field label="Email"><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} /></Field>
          <Field label="Birth date">
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Gender">
            <select value={gender} onChange={(e) => setGender(e.target.value as Customer['gender'])} style={inputStyle}>
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Company"><input value={company} onChange={(e) => setCompany(e.target.value)} style={inputStyle} /></Field>
          <Field label="Position"><input value={position} onChange={(e) => setPosition(e.target.value)} style={inputStyle} /></Field>

          <Field label="Station">
            <select value={station} onChange={(e) => setStation(e.target.value as Station)} style={inputStyle}>
              <option value="SGN">SGN</option>
              <option value="HAN">HAN</option>
            </select>
          </Field>

          <Field label="Greeting type">
            <select value={greetingType} onChange={(e) => setGreetingType(e.target.value as GreetingType)} style={inputStyle}>
              <option value="ecard_only">eCard only (chỉ gửi email)</option>
              <option value="gift_visit">Gift visit (gửi email + tặng quà)</option>
            </select>
          </Field>

          {greetingType === 'gift_visit' && (
            <>
              <Field label="Gift suggestion (sales can edit anytime)">
                <textarea
                  value={giftSuggestion}
                  onChange={(e) => setGiftSuggestion(e.target.value)}
                  rows={3}
                  placeholder="e.g. Hộp trà cao cấp, voucher spa…"
                  style={inputStyle}
                />
              </Field>
              <Field label="Budget (ngân sách dự kiến)">
                <input
                  type="number"
                  min={0}
                  value={giftBudget}
                  onChange={(e) => setGiftBudget(e.target.value)}
                  placeholder="e.g. 500000"
                  style={inputStyle}
                />
              </Field>
            </>
          )}

          {customer && (
            <div style={{ display: 'flex', gap: 16, margin: '12px 0', fontSize: 15 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={ecardSent} onChange={(e) => setEcardSent(e.target.checked)} />
                Đã gửi eCard
              </label>
              {greetingType === 'gift_visit' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={giftGiven} onChange={(e) => setGiftGiven(e.target.checked)} />
                  Đã tặng quà
                </label>
              )}
            </div>
          )}

          {error && <p style={{ color: 'var(--color-danger)', fontSize: 15 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
            <button type="submit" disabled={saving} style={primaryButtonStyle}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 10, fontSize: 15 }}>
      {label}
      {children}
    </label>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 10px', marginTop: 4, borderRadius: 10, border: '1px solid #d0d7e2', fontFamily: 'inherit' };
const primaryButtonStyle: React.CSSProperties = { flex: 1, padding: '10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' };
const secondaryButtonStyle: React.CSSProperties = { flex: 1, padding: '10px', background: '#eee', color: '#333', border: 'none', borderRadius: 10, cursor: 'pointer' };

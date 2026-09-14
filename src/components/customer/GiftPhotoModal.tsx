import { useEffect, useState } from 'react';
import type { Customer, GiftPhoto } from '../../types/entities';
import { giftPhotoService } from '../../services/gift/giftPhotoService';

interface Props {
  customer: Customer;
  onClose: () => void;
}

export function GiftPhotoModal({ customer, onClose }: Props) {
  const [photos, setPhotos] = useState<GiftPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    const list = await giftPhotoService.listByCustomer(customer.id);
    setPhotos(list);
    const urlMap: Record<string, string> = {};
    for (const p of list) urlMap[p.id] = giftPhotoService.getImageUrl(p);
    setUrls(urlMap);
    setLoading(false);
  }
  useEffect(() => { reload(); }, [customer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Vui lòng chọn file ảnh (PNG/JPG).'); return; }
    setError(null);
    setUploading(true);
    try {
      await giftPhotoService.upload(customer.id, file, customer.year);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photo: GiftPhoto) {
    if (!confirm(`Xoá ảnh quà tặng năm ${photo.year}?`)) return;
    await giftPhotoService.delete(photo);
    reload();
  }

  const byYear = photos.reduce<Record<number, GiftPhoto[]>>((acc, p) => {
    (acc[p.year] ??= []).push(p);
    return acc;
  }, {});
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
  const currentYear = customer.year;

  return (
    <div style={overlayStyle}>
      <div className="glass-panel" style={{ padding: 24, width: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>🎁 Ảnh quà tặng — {customer.fullName}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{customer.company ?? '—'} · {customer.station}</p>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>
            Upload ảnh quà tặng năm {currentYear}
          </label>
          <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} />
          {uploading && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Đang nén và tải ảnh lên…</p>}
          {error && <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Đang tải…</p>
        ) : years.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Chưa có ảnh quà tặng nào được lưu.</p>
        ) : (
          years.map((year) => (
            <div key={year} style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Năm {year}</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {byYear[year].map((p) => (
                  <div key={p.id} style={{ width: 140 }}>
                    <img src={urls[p.id]} alt={`Quà tặng năm ${p.year}`} style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(20,126,147,0.15)' }} />
                    <button onClick={() => handleDelete(p)} style={{ fontSize: 12, color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0 }}>
                      Xoá
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: 'none', borderRadius: 10, background: '#eee', cursor: 'pointer' }}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };

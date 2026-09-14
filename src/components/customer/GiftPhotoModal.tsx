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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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
      <div className="glass-panel" style={{ padding: 26, width: 760, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>🎁 Ảnh quà tặng — {customer.fullName}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{customer.company ?? '—'} · {customer.station}</p>

        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(20,126,147,0.05)', borderRadius: 12 }}>
          <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>
            Upload ảnh quà tặng năm {currentYear}
          </label>
          <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} />
          {uploading && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Đang nén và tải ảnh lên…</p>}
          {error && <p style={{ fontSize: 13, color: 'var(--color-danger)', marginTop: 6 }}>{error}</p>}
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Đang tải…</p>
        ) : years.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Chưa có ảnh quà tặng nào được lưu.</p>
        ) : (
          years.map((year) => (
            <div key={year} style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 10 }}>Năm {year}</h3>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {byYear[year].map((p) => (
                  <div key={p.id} style={{ width: 260 }}>
                    <img
                      src={urls[p.id]}
                      alt={`Quà tặng năm ${p.year}`}
                      onClick={() => setLightboxUrl(urls[p.id])}
                      style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12, border: '1px solid rgba(20,126,147,0.15)', cursor: 'zoom-in', display: 'block' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <button onClick={() => setLightboxUrl(urls[p.id])} style={{ fontSize: 13, color: 'var(--color-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        Xem lớn
                      </button>
                      <button onClick={() => handleDelete(p)} style={{ fontSize: 13, color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        Xoá
                      </button>
                    </div>
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

      {lightboxUrl && (
        <div style={lightboxOverlayStyle} onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)} style={lightboxCloseStyle}>×</button>
          <img src={lightboxUrl} alt="Ảnh quà tặng phóng to" style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
        </div>
      )}
    </div>
  );
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const lightboxOverlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, cursor: 'zoom-out' };
const lightboxCloseStyle: React.CSSProperties = { position: 'fixed', top: 20, right: 28, background: 'none', border: 'none', color: '#fff', fontSize: 36, cursor: 'pointer', lineHeight: 1 };

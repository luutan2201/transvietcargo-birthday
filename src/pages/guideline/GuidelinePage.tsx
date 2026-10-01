export default function GuidelinePage() {
  return (
    <div>
      <div className="glass-panel" style={{ padding: 28, marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Quy Trình Handle Sinh Nhật Khách Hàng</h1>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14, color: 'var(--text-secondary)' }}>
          <span><strong style={{ color: 'var(--text-main)' }}>Phòng phụ trách:</strong> Marketing — TransViet Cargo</span>
          <span><strong style={{ color: 'var(--text-main)' }}>Phạm vi áp dụng:</strong> List khách hàng đã được chọn lọc do Sales cung cấp</span>
        </div>
        <p style={{ marginTop: 12 }}>
          Đảm bảo trải nghiệm chăm sóc khách hàng nhất quán, chuyên nghiệp, đúng thời điểm và tránh sai sót
          trong quá trình gửi eCard và tặng quà sinh nhật trực tiếp.
        </p>
      </div>

      <TocNav />

      <Section id="tong-quan" title="I. Tổng quan quy trình">
        <p>Hoạt động sinh nhật khách hàng được chia thành <strong>2 danh sách theo dõi chính</strong>:</p>
        <ol style={listStyle}>
          <li><strong>[E-Card] Sinh nhật khách hàng</strong> — Gửi email chúc mừng sinh nhật</li>
          <li><strong>[In-Person] Sinh nhật khách hàng</strong> — Chuẩn bị quà tặng trực tiếp &amp; thiệp giấy TVC</li>
        </ol>
      </Section>

      <Section id="nguyen-tac" title="II. Nguyên tắc chung">
        <ul style={listStyle}>
          <li>Vào <strong>khoảng ngày 25 hằng tháng</strong>, Marketing Team tổng hợp danh sách khách hàng có sinh nhật trong <strong>tháng kế tiếp</strong>.</li>
          <li>Danh sách này sẽ được:
            <ul style={listStyle}>
              <li>Gửi cho <strong>Sales</strong> để nắm sự kiện và chủ động sắp xếp lịch thăm khách</li>
              <li>Lưu trữ để tự Marketing theo dõi và triển khai đúng tiến độ</li>
            </ul>
          </li>
          <li>Mọi hoạt động cần được chuẩn bị <strong>trước ngày sinh nhật</strong>, tuyệt đối tránh gửi trễ hoặc bỏ sót.</li>
        </ul>
      </Section>

      <Section id="ecard" title="III. Quy trình [E-Card] — gửi email chúc mừng sinh nhật">
        <h3 style={h3Style}>1. Lập kế hoạch &amp; đặt lịch gửi tự động</h3>
        <ul style={listStyle}>
          <li>Sử dụng tính năng <strong>Schedule / Delay Delivery</strong> của Outlook.</li>
          <li>Vào <strong>đầu mỗi tháng</strong>, dựa trên danh sách đã tổng hợp để <strong>đặt lịch gửi toàn bộ email sinh nhật cho cả tháng</strong>.</li>
          <li>Mục đích: tránh quên, tránh gửi trễ và đảm bảo tính nhất quán.</li>
        </ul>

        <h3 style={h3Style}>2. Quy định về eCard design</h3>
        <ul style={listStyle}>
          <li>Có <strong>2 template eCard riêng biệt</strong>: khách <strong>Nam</strong> và khách <strong>Nữ</strong>.</li>
          <li>Cần kiểm tra kỹ giới tính khách hàng trước khi gửi.</li>
          <li><strong>Tên khách trên eCard</strong>: viết <strong>không dấu</strong> để thống nhất với phiên bản tiếng Anh.</li>
        </ul>

        <h3 style={h3Style}>3. Quy định khi soạn email</h3>
        <table style={tableStyle}>
          <tbody>
            <tr><td style={tdLabel}>Người gửi / From</td><td style={tdValue}><code style={codeStyle}>marketing@transvietcargo.com</code></td></tr>
            <tr><td style={tdLabel}>CC bắt buộc</td><td style={tdValue}><code style={codeStyle}>marketing@transvietcargo.com</code>, <code style={codeStyle}>sales.sgn@transvietcargo.com</code> / <code style={codeStyle}>sales.dad@transvietcargo.com</code> / <code style={codeStyle}>sales.han@transvietcargo.com</code> (theo đúng station của khách)</td></tr>
            <tr><td style={tdLabel}>Subject</td><td style={tdValue}><code style={codeStyle}>[Happy Birthday to Ms./Mr. ___ | From TransViet Cargo]</code><br /><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>(giữ nguyên format, chỉ thay danh xưng)</span></td></tr>
            <tr><td style={tdLabel}>Chữ ký</td><td style={tdValue}>Bắt buộc dùng <strong>chữ ký phòng ban</strong> (không dùng chữ ký cá nhân)</td></tr>
          </tbody>
        </table>
        <p style={{ marginTop: 10 }}><strong>Body email</strong> — dùng mẫu chuẩn đã phê duyệt, chỉ chỉnh sửa 3 nội dung:</p>
        <ol style={listStyle}>
          <li>Xưng hô: Anh/Chị hoặc Mr./Ms.</li>
          <li>Tên khách hàng</li>
          <li>Ngày sinh nhật</li>
        </ol>
        <Callout>
          Cần kiểm tra và bổ sung đầy đủ các thông báo kèm theo (nếu tại thời điểm đó chữ ký đang được cập nhật thêm).
          Trường hợp không có thông báo bổ sung, sử dụng chữ ký phòng ban mặc định.
        </Callout>
        <Figure src="/guideline/signature-example.png" alt="Mẫu chữ ký phòng ban Marketing" caption="Mẫu chữ ký phòng ban — Marketing & Business Development Department" />

        <h3 style={h3Style}>4. Cách đặt lịch gửi trên Outlook</h3>
        <ul style={listStyle}>
          <li>Thanh menu → <strong>Options</strong> → <strong>Delay Delivery</strong></li>
          <li>Tick chọn: <strong>Do not deliver before</strong></li>
        </ul>
        <Figure src="/guideline/outlook-delay-delivery.png" alt="Cấu hình Delay Delivery trong Outlook" caption="Hộp thoại Properties — mục Delivery options trong Outlook" />
        <ul style={listStyle}>
          <li>Thời gian gửi: đúng <strong>ngày sinh nhật khách hàng</strong></li>
          <li>Giờ gửi mặc định: <strong>10:00 AM</strong></li>
        </ul>
      </Section>

      <Section id="in-person" title="IV. Quy trình [In-Person] — tặng quà sinh nhật trực tiếp">
        <h3 style={h3Style}>1. Thời điểm giao quà</h3>
        <table style={tableStyle}>
          <thead>
            <tr><th style={thStyle}>Loại quà</th><th style={thStyle}>Thời điểm giao</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdLabel}>Quà không dễ hư hỏng<br /><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>(cà vạt, rượu…)</span></td>
              <td style={tdValue}>Giao <strong>trước ít nhất 1 ngày</strong> so với ngày sinh nhật</td>
            </tr>
            <tr>
              <td style={tdLabel}>Hoa tươi</td>
              <td style={tdValue}>
                <strong>08:30–09:00 sáng</strong> ngày sinh nhật, hoặc chiều muộn ngày hôm trước.
                <ul style={{ ...listStyle, marginTop: 6 }}>
                  <li>Yêu cầu shop dùng <strong>hoa mới nhất</strong></li>
                  <li>Không cắm quá sớm để đảm bảo độ tươi</li>
                  <li>Check với Sales thời điểm khách có ở văn phòng (khách high level hay đi công tác)</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td style={tdLabel}>Bánh, socola, quà dễ chảy/hư hỏng</td>
              <td style={tdValue}>
                Bắt buộc <strong>liên hệ Sales trước</strong> để xác nhận ngày &amp; giờ Sales gặp khách.
                Sắp xếp giao <strong>sát thời điểm Sales đi thăm (trước 15–30 phút)</strong>.
              </td>
            </tr>
          </tbody>
        </table>

        <h3 style={h3Style}>2. Quy định đối với hoa tặng khách</h3>
        <ul style={listStyle}>
          <li>Luôn kèm <strong>bảng cắm hoa</strong> với nội dung: <code style={codeStyle}>Happy Birthday Ms./Mr. [First Name] – [Tên công ty]</code>
            <br /><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>(nếu tên khách dài hơn 2 chữ thì không cần thêm tên công ty)</span>
          </li>
          <li>Có logo <strong>TransViet Cargo</strong></li>
          <li>Luôn <strong>bo góc chữ</strong></li>
        </ul>
        <Figure src="/guideline/flower-card-example.png" alt="Mẫu bảng cắm hoa sinh nhật" caption="Mẫu bảng cắm hoa — chữ &quot;Happy Birthday&quot; màu đỏ, tên khách màu xanh đậm" />
        <ul style={listStyle}>
          <li>Format bảng hoa: chữ <strong style={{ color: 'var(--color-danger)' }}>"Happy Birthday"</strong> màu <strong>đỏ</strong>, phần tên còn lại màu <strong style={{ color: 'var(--color-primary-dark)' }}>xanh đậm</strong>.</li>
        </ul>

        <h3 style={h3Style}>3. Vật phẩm bắt buộc kèm theo khi bàn giao cho Sales</h3>
        <ul style={listStyle}>
          <li>eCard thiết kế riêng bản giấy</li>
          <li>Đế gỗ đựng eCard</li>
        </ul>

        <h3 style={h3Style}>4. Xác nhận với Sales</h3>
        <ul style={listStyle}>
          <li>Sau khi chuẩn bị quà hoàn tất: <strong>chụp hình quà</strong></li>
          <li>Gửi vào <strong>group Sales</strong> để xác nhận và bàn giao</li>
        </ul>
      </Section>

      <Section id="hoa-don" title="V. Quy định về hóa đơn & thanh toán">
        <h3 style={h3Style}>1. Hóa đơn</h3>
        <p>Luôn yêu cầu xuất <strong>hóa đơn VAT</strong> cho mọi khoản chi.</p>

        <h3 style={h3Style}>2. Trường hợp hóa đơn trên 5.000.000 VNĐ</h3>
        <p>Bắt buộc áp dụng <strong>một trong hai hình thức sau</strong>:</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 10 }}>
          <div style={miniCard}>
            <strong>Cách 1 — Thanh toán qua công ty</strong>
            <p style={{ marginTop: 6, fontSize: 14 }}>Quẹt thẻ công ty, hoặc kế toán chuyển khoản từ tài khoản công ty.</p>
          </div>
          <div style={miniCard}>
            <strong>Cách 2 — Tách hóa đơn</strong>
            <p style={{ marginTop: 6, fontSize: 14 }}>Tách thành nhiều hóa đơn nhỏ (dưới 5.000.000 VNĐ/hóa đơn), có thể thanh toán bằng tài khoản cá nhân.</p>
          </div>
        </div>
        <Callout>Nếu gộp thành 1 hóa đơn trên 5.000.000 VNĐ thì bắt buộc phải thông qua Kế toán chuyển tiền.</Callout>
      </Section>

      <Section id="trach-nhiem" title="VI. Trách nhiệm thực hiện">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={miniCard}>
            <strong style={{ color: 'var(--color-primary)' }}>Marketing</strong>
            <ul style={{ ...listStyle, marginTop: 8 }}>
              <li>Tổng hợp danh sách</li>
              <li>Set lịch email</li>
              <li>Chuẩn bị eCard và quà</li>
              <li>Kiểm soát hình ảnh &amp; quy chuẩn</li>
            </ul>
          </div>
          <div style={miniCard}>
            <strong style={{ color: 'var(--color-primary)' }}>Sales</strong>
            <ul style={{ ...listStyle, marginTop: 8 }}>
              <li>Xác nhận lịch gặp khách</li>
              <li>Trực tiếp đi tặng quà</li>
              <li>Phối hợp đảm bảo thời điểm phù hợp</li>
            </ul>
          </div>
        </div>
      </Section>

      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', margin: '24px 0 8px' }}>
        Tài liệu dùng cho mục đích bàn giao nội bộ. Mọi thay đổi cần được cập nhật lại để đảm bảo tính nhất quán.
      </div>
    </div>
  );
}

const SECTIONS = [
  { id: 'tong-quan', label: 'I. Tổng quan' },
  { id: 'nguyen-tac', label: 'II. Nguyên tắc chung' },
  { id: 'ecard', label: 'III. E-Card' },
  { id: 'in-person', label: 'IV. In-Person' },
  { id: 'hoa-don', label: 'V. Hóa đơn' },
  { id: 'trach-nhiem', label: 'VI. Trách nhiệm' },
];

function TocNav() {
  return (
    <div className="glass-panel" style={{ padding: '14px 20px', marginBottom: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          style={{
            fontSize: 14, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none',
            padding: '6px 12px', borderRadius: 20, background: 'rgba(20,126,147,0.08)',
          }}
        >
          {s.label}
        </a>
      ))}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="glass-panel" style={{ padding: 26, marginBottom: 20, scrollMarginTop: 20 }}>
      <h2 style={{ color: 'var(--color-primary)', marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid rgba(20,126,147,0.12)' }}>{title}</h2>
      {children}
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,193,7,0.12)', border: '1px solid rgba(255,193,7,0.35)',
      borderRadius: 12, padding: '12px 16px', margin: '14px 0', fontSize: 14, display: 'flex', gap: 10,
    }}>
      <span style={{ fontSize: 16 }}>⚠️</span>
      <span><strong>Lưu ý: </strong>{children}</span>
    </div>
  );
}

function Figure({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure style={{ margin: '16px 0' }}>
      <img src={src} alt={alt} style={{ width: '100%', maxWidth: 640, borderRadius: 12, border: '1px solid rgba(20,126,147,0.15)', display: 'block' }} />
      <figcaption style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{caption}</figcaption>
    </figure>
  );
}

const listStyle: React.CSSProperties = { paddingLeft: 22, lineHeight: 1.8, fontSize: 15 };
const h3Style: React.CSSProperties = { fontSize: 16, marginTop: 20, marginBottom: 8, color: 'var(--text-main)' };
const codeStyle: React.CSSProperties = { background: 'rgba(20,126,147,0.08)', padding: '2px 6px', borderRadius: 6, fontSize: 13.5 };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: 10, fontSize: 15 };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', background: 'rgba(20,126,147,0.06)', borderBottom: '1px solid rgba(20,126,147,0.15)' };
const tdLabel: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, verticalAlign: 'top', borderBottom: '1px solid #eee', width: '30%' };
const tdValue: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top', borderBottom: '1px solid #eee' };
const miniCard: React.CSSProperties = { background: 'rgba(255,255,255,0.6)', borderRadius: 14, padding: 16, border: '1px solid rgba(20,126,147,0.1)' };

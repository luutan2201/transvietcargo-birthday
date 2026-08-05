# TransViet Cargo Email Campaign Studio

Ứng dụng nội bộ React 18 + TypeScript + Vite. Dữ liệu lưu trên **Supabase**
(Postgres + Auth + Storage dùng chung) — mọi tài khoản đăng nhập đều thấy
cùng một dữ liệu, không còn tách biệt theo từng trình duyệt/máy.

## Thiết lập Supabase (làm 1 lần)

1. Tạo project miễn phí tại **https://supabase.com**.
2. Vào **SQL Editor** → dán toàn bộ nội dung file `supabase/schema.sql` → **Run**.
   Việc này tạo đủ bảng, phân quyền (RLS), và bucket lưu ảnh thiệp sinh nhật.
3. Vào **Authentication → Users → Add User** → tạo tài khoản admin đầu tiên
   (email + mật khẩu của bạn). Đây là tài khoản **duy nhất** tự tạo được;
   mọi tài khoản khác sau này cấp từ trong app (mục Admin), không ai tự
   đăng ký được.
4. Copy phần cuối file `supabase/schema.sql` (mục "Bootstrap"), thay email
   bằng đúng email vừa tạo, chạy trong SQL Editor để gán quyền admin cho
   tài khoản đó.
5. Vào **Project Settings → API** → copy **Project URL** và **anon public key**.
6. Tạo file `.env` (copy từ `.env.example`), dán 2 giá trị trên vào.
7. Cũng thêm đúng 2 biến này vào **Vercel → Project Settings → Environment
   Variables** để bản deploy thật hoạt động.

### Deploy Edge Function (bắt buộc để Admin tạo được tài khoản mới)

Cần cài Supabase CLI (`npm install -g supabase`), sau đó:
```
supabase login
supabase link --project-ref <project-ref-của-bạn>
supabase functions deploy create-user
```
(project-ref là đoạn ký tự sau `https://` trong Project URL, trước `.supabase.co`)

## Chạy thử (local hoặc StackBlitz)
```
npm install
npm run dev
```

## Build production
```
npm run build
```

## Deploy lên Vercel
Kết nối repo GitHub với Vercel như bình thường — nhớ thêm 2 biến môi trường
Supabase ở bước 7 phía trên trước khi Deploy.

## Chạy test
```
npx vitest run
```

## Đã hoàn thành
- Đăng nhập qua Supabase Auth (email + mật khẩu) — không còn tự đăng ký,
  chỉ admin cấp tài khoản (qua Edge Function `create-user`)
- Dữ liệu dùng chung thật giữa mọi tài khoản (Postgres qua Supabase)
- Khách hàng: CRUD, tìm kiếm, import Excel/CSV, ngày sinh, lọc theo
  tháng/station/loại chúc mừng/trạng thái hoàn thành
- Template email: thư viện, versioning, song ngữ VI/EN, rich text editor
- Chữ ký (ảnh PNG), thư viện template thiệp sinh nhật theo giới tính
  (ảnh lưu trên Supabase Storage) — calibrate vị trí tên/đoạn văn chính
  xác, live preview
- Bộ tạo email: Outlook-safe HTML, tự đính kèm eCard + chữ ký, copy để
  dán thẳng vào Outlook
- Dashboard: biểu đồ tiến độ, phân bổ theo station; Calendar theo tháng
- Lịch sử, Backup/Restore, Settings (logo công ty), Admin (quản lý
  tài khoản + vai trò)
- Giao diện Apple glassmorphism, màu chủ đạo #147E93

## Đã kiểm tra (tự động)
typecheck ✓ · lint (oxlint) ✓ · build ✓ · test ✓
(Lưu ý: test tự động chỉ kiểm tra logic thuần — việc kết nối Supabase
thật cần bạn tự kiểm tra sau khi cấu hình `.env` như hướng dẫn trên.)

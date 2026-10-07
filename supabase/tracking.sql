-- =====================================================================
-- EMAIL TRACKING — chạy 1 lần trong Supabase → SQL Editor → Run.
-- An toàn khi chạy lại (idempotent). Không đụng tới các bảng sinh nhật.
--
-- Nguồn dữ liệu: Google Sheet "2026_Tracking emails" (đồng bộ qua Apps Script
-- + Edge Function `tracking`). Mọi tài khoản đăng nhập đều ĐỌC được;
-- chỉ admin/manager được ghi (xử lý email lỗi, xác nhận khắc phục),
-- chỉ admin được sửa ngưỡng cảnh báo.
-- =====================================================================

-- Quyền ghi: admin hoặc manager. SECURITY DEFINER để không bị đệ quy RLS
-- trên bảng profiles (cùng cách làm với is_admin()).
create or replace function public.tracking_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'manager')
  );
$$;

-- ---------------------------------------------------------------------
-- Campaign
-- ---------------------------------------------------------------------
create table if not exists public.tracking_campaigns (
  id text primary key,                       -- campaign_id trong sheet, vd C2609-THONGBAO-PHI
  name text not null default '',
  subject text,
  start_date date,
  owner text,                                -- Marketing / Sales
  notes text,
  topic text,                                -- chủ đề / sự kiện, dùng để so sánh theo tháng/năm
  status text not null default 'draft' check (status in ('draft', 'tracking', 'closed')),
  is_test boolean not null default false,
  first_sent_at timestamptz,
  last_sent_at timestamptz,
  batch_count int not null default 0,
  total_sent int not null default 0,
  recipients int not null default 0,         -- "Khách nhận" (email duy nhất)
  hard int not null default 0,
  soft int not null default 0,
  blocked int not null default 0,
  other int not null default 0,
  delivered int not null default 0,
  reply_main int not null default 0,         -- trong cửa sổ so sánh chính (72h)
  reply_life int not null default 0,
  -- Open/Click: lưu sẵn, chưa hiển thị cho tới khi bật 'open_click_enabled'
  open_main int,
  click_main int,
  open_life int,
  click_life int,
  -- Tạm dừng gửi (tự động khi Hard bounce chạm ngưỡng, hoặc thủ công)
  paused boolean not null default false,
  paused_reason text,
  paused_at timestamptz,
  ack_hard int,                              -- số hard bounce tại lúc xác nhận khắc phục
  ack_by text,
  ack_at timestamptz,
  ack_note text,
  source text not null default 'sheet' check (source in ('sheet', 'web')),
  sheet_synced boolean not null default true, -- false = tạo trên web, chưa ghi vào sheet
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tracking_campaigns_start_idx on public.tracking_campaigns (start_date);
create index if not exists tracking_campaigns_topic_idx on public.tracking_campaigns (topic);

-- ---------------------------------------------------------------------
-- Đợt gửi
-- ---------------------------------------------------------------------
create table if not exists public.tracking_batches (
  id text primary key,                       -- batch_id trong sheet
  campaign_id text not null references public.tracking_campaigns(id) on delete cascade,
  batch_no int not null default 1,
  sent_at timestamptz,
  sent int not null default 0,
  recipients int not null default 0,
  bounce int not null default 0,
  delivered int not null default 0,
  open_main int,
  click_main int,
  reply_main int not null default 0
);
create index if not exists tracking_batches_campaign_idx on public.tracking_batches (campaign_id);

-- ---------------------------------------------------------------------
-- Email bounce (chi tiết từng địa chỉ để theo dõi và xử lý)
-- ---------------------------------------------------------------------
create table if not exists public.tracking_bounces (
  id text primary key,                       -- message_id của thư báo lỗi
  campaign_id text not null references public.tracking_campaigns(id) on delete cascade,
  email text not null,
  bounce_type text not null check (bounce_type in ('Hard', 'Soft', 'Blocked', 'Other')),
  code text,
  reason text,
  received_at timestamptz,
  batch_no int,
  -- Phần xử lý do web ghi; đồng bộ từ sheet KHÔNG ghi đè các cột này.
  handling text not null default 'open' check (handling in ('open', 'removed', 'resent', 'ignored')),
  handled_by text,
  handled_at timestamptz,
  note text
);
create index if not exists tracking_bounces_campaign_idx on public.tracking_bounces (campaign_id);

-- ---------------------------------------------------------------------
-- Phản hồi (reply)
-- ---------------------------------------------------------------------
create table if not exists public.tracking_replies (
  id text primary key,                       -- message_id
  campaign_id text not null references public.tracking_campaigns(id) on delete cascade,
  email text not null,
  subject text,
  received_at timestamptz,
  is_auto boolean not null default false     -- trả lời tự động (out-of-office…)
);
create index if not exists tracking_replies_campaign_idx on public.tracking_replies (campaign_id);

-- ---------------------------------------------------------------------
-- Ngưỡng cảnh báo — mỗi dòng 1 chỉ số. warn = "cần theo dõi", crit = "tạm dừng".
-- NULL = không đặt ngưỡng. Hiện chỉ Hard bounce được đặt (4% / 5%).
-- ---------------------------------------------------------------------
create table if not exists public.tracking_thresholds (
  metric text primary key check (metric in ('hard', 'soft', 'blocked', 'total', 'reply')),
  warn numeric,
  crit numeric,
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.tracking_thresholds (metric, warn, crit)
values ('hard', 4, 5)
on conflict (metric) do nothing;

-- ---------------------------------------------------------------------
-- Cấu hình chung
-- ---------------------------------------------------------------------
create table if not exists public.tracking_config (
  key text primary key,
  value jsonb not null
);
-- Đổi thành true khi đã đo được Open/Click thì web tự hiện 2 chỉ số này.
insert into public.tracking_config (key, value)
values ('open_click_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Tình trạng đồng bộ (1 dòng duy nhất)
-- ---------------------------------------------------------------------
create table if not exists public.tracking_sync (
  id int primary key check (id = 1),
  last_sync_at timestamptz,
  last_record_at timestamptz,
  last_source text,
  status text,
  message text,
  last_request_at timestamptz
);
insert into public.tracking_sync (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.tracking_campaigns enable row level security;
alter table public.tracking_batches enable row level security;
alter table public.tracking_bounces enable row level security;
alter table public.tracking_replies enable row level security;
alter table public.tracking_thresholds enable row level security;
alter table public.tracking_config enable row level security;
alter table public.tracking_sync enable row level security;

-- Mọi tài khoản đăng nhập đều đọc được
do $$
declare t text;
begin
  foreach t in array array['tracking_campaigns','tracking_batches','tracking_bounces','tracking_replies','tracking_thresholds','tracking_config','tracking_sync']
  loop
    execute format('drop policy if exists "tracking_read" on public.%I', t);
    execute format('create policy "tracking_read" on public.%I for select using (auth.role() = ''authenticated'')', t);
  end loop;
end $$;

-- Admin/manager: sửa campaign (chủ đề, ghi chú…), xử lý email bounce
drop policy if exists "tracking_campaigns_update" on public.tracking_campaigns;
create policy "tracking_campaigns_update" on public.tracking_campaigns for update
  using (public.tracking_can_manage()) with check (public.tracking_can_manage());

drop policy if exists "tracking_bounces_update" on public.tracking_bounces;
create policy "tracking_bounces_update" on public.tracking_bounces for update
  using (public.tracking_can_manage()) with check (public.tracking_can_manage());

-- Chỉ admin: ngưỡng cảnh báo + cấu hình
drop policy if exists "tracking_thresholds_write" on public.tracking_thresholds;
create policy "tracking_thresholds_write" on public.tracking_thresholds for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tracking_config_write" on public.tracking_config;
create policy "tracking_config_write" on public.tracking_config for all
  using (public.is_admin()) with check (public.is_admin());

-- Ghi dữ liệu đồng bộ (campaign mới, batch, bounce, reply, sync) do Edge Function
-- `tracking` thực hiện bằng service role nên không cần policy ghi cho người dùng.

// supabase/functions/tracking/index.ts
//
// Cầu nối giữa web, Supabase và Google Sheet "2026_Tracking emails".
// QUAN TRỌNG: khi deploy, TẮT "Enforce JWT Verification" cho function này
// (Edge Functions → tracking → Details → bỏ tick). Hàm tự xác thực bằng:
//   • header `x-tracking-secret`  → Apps Script trong sheet gọi (action = ingest)
//   • header `Authorization`      → người dùng web đã đăng nhập (các action còn lại)
//
// Secrets cần đặt (Edge Functions → Secrets):
//   TRACKING_SECRET   chuỗi bí mật dài, dùng chung với Apps Script
//   TRACKING_GAS_URL  URL "Web app" của Apps Script (kết thúc bằng /exec)
// SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY có sẵn.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('TRACKING_SECRET') ?? '';
const GAS_URL = Deno.env.get('TRACKING_GAS_URL') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tracking-secret',
};

const CAMPAIGN_COLS = [
  'id', 'name', 'subject', 'start_date', 'owner', 'notes', 'topic', 'status', 'is_test',
  'first_sent_at', 'last_sent_at', 'batch_count', 'total_sent', 'recipients',
  'hard', 'soft', 'blocked', 'other', 'delivered', 'reply_main', 'reply_life',
  'open_main', 'click_main', 'open_life', 'click_life',
];
const BATCH_COLS = ['id', 'campaign_id', 'batch_no', 'sent_at', 'sent', 'recipients', 'bounce', 'delivered', 'open_main', 'click_main', 'reply_main'];
// Cố ý KHÔNG có handling/handled_by/handled_at/note: đồng bộ không được ghi đè phần xử lý trên web.
const BOUNCE_COLS = ['id', 'campaign_id', 'email', 'bounce_type', 'code', 'reason', 'received_at', 'batch_no'];
const REPLY_COLS = ['id', 'campaign_id', 'email', 'subject', 'received_at', 'is_auto'];

type Row = Record<string, unknown>;

function pick(row: Row, cols: string[]): Row {
  const out: Row = {};
  for (const c of cols) if (row[c] !== undefined) out[c] = row[c];
  return out;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function upsertChunks(admin: ReturnType<typeof createClient>, table: string, rows: Row[], cols: string[]) {
  // Gộp theo id: Postgres từ chối upsert nếu cùng một id xuất hiện 2 lần trong 1 lệnh.
  const byId = new Map<string, Row>();
  for (const r of rows) {
    const p = pick(r, cols);
    if (p.id) byId.set(String(p.id), p);
  }
  const clean = [...byId.values()];
  for (let i = 0; i < clean.length; i += 400) {
    const { error } = await admin.from(table).upsert(clean.slice(i, i + 400), { onConflict: 'id' });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  return clean.length;
}

/** Gọi Apps Script (Web app). Apps Script trả về qua redirect nên cho fetch tự theo. */
async function callGas(payload: Row, timeoutMs = 100_000): Promise<Row> {
  if (!GAS_URL) throw new Error('Chưa cấu hình TRACKING_GAS_URL trong Edge Function Secrets.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: SECRET, ...payload }),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Apps Script trả về nội dung không hợp lệ (kiểm tra lại quyền triển khai Web app: "Anyone").');
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Tự động tạm dừng / mở lại theo ngưỡng Hard bounce. Trả về danh sách campaign đang tạm dừng. */
async function applyPauseRules(admin: ReturnType<typeof createClient>): Promise<string[]> {
  const { data: th } = await admin.from('tracking_thresholds').select('crit').eq('metric', 'hard').maybeSingle();
  const crit = th?.crit == null ? null : Number(th.crit);
  const { data: camps } = await admin
    .from('tracking_campaigns')
    .select('id, status, is_test, recipients, hard, paused, paused_reason, ack_hard')
    .eq('is_test', false);
  const paused: string[] = [];
  for (const c of camps ?? []) {
    if (c.status === 'closed' || c.status === 'draft') {
      if (c.paused) paused.push(c.id);
      continue;
    }
    const rate = c.recipients > 0 ? Math.round((c.hard / c.recipients) * 10000) / 100 : 0;
    const breach = crit != null && rate >= crit;
    // Đã được xác nhận khắc phục thì chỉ tạm dừng lại khi có thêm hard bounce mới.
    const acked = c.ack_hard != null && c.hard <= c.ack_hard;
    if (breach && !c.paused && !acked) {
      await admin.from('tracking_campaigns').update({
        paused: true,
        paused_reason: `Hard bounce ${rate.toString().replace('.', ',')}% (ngưỡng tạm dừng ${crit}%)`,
        paused_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', c.id);
      paused.push(c.id);
    } else if (!breach && c.paused && c.paused_reason?.startsWith('Hard bounce')) {
      await admin.from('tracking_campaigns').update({ paused: false, paused_reason: null, updated_at: new Date().toISOString() }).eq('id', c.id);
    } else if (c.paused) {
      paused.push(c.id);
    }
  }
  return paused;
}

async function handleIngest(admin: ReturnType<typeof createClient>, body: Row) {
  const campaigns = ((body.campaigns as Row[]) ?? []).map((c) => ({ ...c, updated_at: new Date().toISOString(), sheet_synced: true }));
  // Campaign phải có trước vì các bảng con tham chiếu tới nó.
  const nCamp = await upsertChunks(admin, 'tracking_campaigns', campaigns, [...CAMPAIGN_COLS, 'updated_at', 'sheet_synced']);
  const known = new Set(campaigns.map((c) => c.id as string));
  const nBatch = await upsertChunks(admin, 'tracking_batches', ((body.batches as Row[]) ?? []).filter((b) => known.has(b.campaign_id as string)), BATCH_COLS);
  const nBounce = await upsertChunks(admin, 'tracking_bounces', ((body.bounces as Row[]) ?? []).filter((b) => known.has(b.campaign_id as string)), BOUNCE_COLS);
  const nReply = await upsertChunks(admin, 'tracking_replies', ((body.replies as Row[]) ?? []).filter((r) => known.has(r.campaign_id as string)), REPLY_COLS);

  const health = (body.health as Row) ?? {};
  await admin.from('tracking_sync').upsert({
    id: 1,
    last_sync_at: new Date().toISOString(),
    last_record_at: health.last_record_at ?? null,
    last_source: (health.last_source as string) ?? 'Sent',
    status: 'ok',
    message: `${nCamp} campaign · ${nBatch} đợt · ${nBounce} bounce · ${nReply} reply`,
  }, { onConflict: 'id' });

  const paused = await applyPauseRules(admin);
  const { data: pending } = await admin
    .from('tracking_campaigns')
    .select('id, name, subject, start_date, owner, notes, topic')
    .eq('sheet_synced', false);
  return { ok: true, counts: { campaigns: nCamp, batches: nBatch, bounces: nBounce, replies: nReply }, paused, pending: pending ?? [] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // ---- Apps Script (secret) ------------------------------------------
    const secretHeader = req.headers.get('x-tracking-secret');
    if (secretHeader) {
      if (!SECRET || secretHeader !== SECRET) return json({ error: 'Sai mã bí mật' }, 401);
      if (action !== 'ingest') return json({ error: 'Action không hợp lệ' }, 400);
      try {
        return json(await handleIngest(admin, body));
      } catch (e) {
        await admin.from('tracking_sync').upsert({ id: 1, status: 'error', message: String((e as Error).message).slice(0, 300) }, { onConflict: 'id' });
        throw e;
      }
    }

    // ---- Người dùng web (JWT) ------------------------------------------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Thiếu thông tin đăng nhập' }, 401);
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Phiên đăng nhập không hợp lệ' }, 401);
    const { data: profile } = await admin.from('profiles').select('role, display_name').eq('id', userData.user.id).single();
    const role = profile?.role as string | undefined;
    const who = (profile?.display_name as string) || userData.user.email || 'unknown';
    const canManage = role === 'admin' || role === 'manager';

    if (action === 'sync') {
      // Mọi tài khoản bấm được; chặn bấm dồn dập (tối thiểu 20 giây giữa 2 lần).
      const { data: s } = await admin.from('tracking_sync').select('last_request_at').eq('id', 1).maybeSingle();
      if (s?.last_request_at && Date.now() - new Date(s.last_request_at as string).getTime() < 20_000) {
        return json({ ok: true, throttled: true, message: 'Vừa đồng bộ cách đây ít giây.' });
      }
      await admin.from('tracking_sync').upsert({ id: 1, last_request_at: new Date().toISOString() }, { onConflict: 'id' });
      const result = await callGas({ action: 'sync' });
      if (result.error) return json({ error: String(result.error) }, 502);
      return json({ ok: true, ...result });
    }

    if (!canManage) return json({ error: 'Chỉ admin hoặc manager được thực hiện thao tác này' }, 403);

    if (action === 'createCampaign') {
      const c = (body.campaign ?? {}) as Row;
      const id = String(c.id ?? '').trim();
      if (!/^[A-Za-z0-9._-]{3,60}$/.test(id)) return json({ error: 'Mã campaign chỉ gồm chữ, số, dấu - _ . (3–60 ký tự)' }, 400);
      const { data: existing } = await admin.from('tracking_campaigns').select('id').eq('id', id).maybeSingle();
      if (existing) return json({ error: `Mã campaign "${id}" đã tồn tại` }, 409);
      const row = {
        id,
        name: String(c.name ?? '').trim() || id,
        subject: String(c.subject ?? '').trim() || null,
        start_date: c.start_date || null,
        owner: String(c.owner ?? '').trim() || null,
        notes: String(c.notes ?? '').trim() || null,
        topic: String(c.topic ?? '').trim() || null,
        status: 'draft',
        is_test: /test/i.test(id),
        source: 'web',
        sheet_synced: false,
        created_by: who,
      };
      const { error } = await admin.from('tracking_campaigns').insert(row);
      if (error) return json({ error: error.message }, 400);
      // Ghi vào sheet ngay; nếu không được thì lần đồng bộ sau (≤30 phút) sẽ tự đẩy sang.
      try {
        const r = await callGas({ action: 'createCampaign', campaign: row }, 30_000);
        if (r.ok) {
          await admin.from('tracking_campaigns').update({ sheet_synced: true }).eq('id', id);
          return json({ ok: true, sheetSynced: true });
        }
        return json({ ok: true, sheetSynced: false, warning: String(r.error ?? 'Chưa ghi được vào sheet, sẽ tự thử lại ở lần đồng bộ sau.') });
      } catch (e) {
        return json({ ok: true, sheetSynced: false, warning: `Đã tạo trên web nhưng chưa ghi được vào sheet (${(e as Error).message}). Sẽ tự thử lại ở lần đồng bộ sau.` });
      }
    }

    if (action === 'resume') {
      // "Xác nhận đã khắc phục": mở lại campaign, ghi nhận ai/khi nào/ghi chú.
      const id = String(body.id ?? '');
      const { data: c } = await admin.from('tracking_campaigns').select('id, hard').eq('id', id).maybeSingle();
      if (!c) return json({ error: 'Không tìm thấy campaign' }, 404);
      const { error } = await admin.from('tracking_campaigns').update({
        paused: false, paused_reason: null, ack_hard: c.hard, ack_by: who, ack_at: new Date().toISOString(),
        ack_note: String(body.note ?? '').slice(0, 500) || null, updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) return json({ error: error.message }, 400);
      const paused = await applyPauseRules(admin);
      try { await callGas({ action: 'markPaused', ids: paused }, 30_000); } catch { /* sheet sẽ cập nhật ở lần đồng bộ sau */ }
      return json({ ok: true });
    }

    return json({ error: 'Action không hợp lệ' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});

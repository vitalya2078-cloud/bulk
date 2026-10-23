// =====================================================================
//  Бульк · рассылки (Supabase Edge Function «bcast»).
//  * POST multipart {init_data, file} - загрузить картинку/видео/файл для рассылки (только команда).
//  * POST {action: "tick"} - отправить очередь: Telegram-бот, сообщения сообщества ВК, уведомления приложения ВК.
//    Будит база раз в минуту (заголовок x-bcast) и админка сразу после «Отправить» (init_data).
//  Ключи берутся из базы (private_secrets), сюда их никто не передаёт.
//  Развернуть: supabase functions deploy bcast --no-verify-jwt
// =====================================================================

const URL_DB = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VK_GROUP = 242380504;
const VK_APP = 54828995;
const PLAY_TG = "https://t.me/bulkgamemagikbot?startapp";
const LINKS: Record<string, string> = { vk: "https://vk.com/club242380504", tg: "https://t.me/bulkgamemagikbot", play: PLAY_TG };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-bcast, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpc(fn: string, body: unknown) {
  const r = await fetch(`${URL_DB}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}
const isAdmin = async (initData: string) => {
  if (initData.length < 20) return false;
  try { await rpc("adm_bcast_can", { init_data: initData }); return true; } catch { return false; }
};

// ---------- загрузка файла ----------
function kindOf(type: string, name: string) {
  if (/^image\/gif/.test(type) || /\.gif$/i.test(name)) return "animation";
  if (/^image\//.test(type)) return "photo";
  if (/^video\//.test(type)) return "video";
  return "document";
}
async function upload(req: Request) {
  const fd = await req.formData();
  const init = String(fd.get("init_data") || "");
  const file = fd.get("file");
  if (!(file instanceof File)) return json({ error: "no file" }, 400);
  if (!(await isAdmin(init))) return json({ error: "not admin" }, 403);
  if (file.size > 50 * 1024 * 1024) return json({ error: "too big" }, 400);
  const ext = (file.name.match(/\.([A-Za-z0-9]{1,8})$/) || [, "bin"])[1]!.toLowerCase();
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const r = await fetch(`${URL_DB}/storage/v1/object/bcast/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SRV}`, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
    body: file,
  });
  if (!r.ok) return json({ error: "storage: " + (await r.text()).slice(0, 200) }, 500);
  return json({ url: `${URL_DB}/storage/v1/object/public/bcast/${path}`, kind: kindOf(file.type, file.name), name: file.name, size: file.size, type: file.type });
}

// ---------- сообщение ----------
type Btn = { t: string; label: string; url?: string; row?: boolean };
type Media = { url: string; kind: string; name?: string };
type Msg = { text?: string; html?: string; vkfmt?: unknown[]; media?: Media[]; buttons?: Btn[]; opts?: Record<string, boolean> };

function btnRows(btns: Btn[] = []) {
  const rows: Btn[][] = [];
  for (const b of btns) {
    if (!b.label) continue;
    if (b.row && rows.length && rows[rows.length - 1].length < 4) rows[rows.length - 1].push(b); else rows.push([b]);
  }
  return rows;
}
const btnUrl = (b: Btn) => b.t === "url" ? (b.url || "") : LINKS[b.t] || b.url || "";
function tgMarkup(m: Msg) {
  const rows = btnRows(m.buttons).map((r) => r.map((b) => ({ text: b.label.slice(0, 64), url: btnUrl(b) })).filter((b) => /^https?:\/\//.test(b.url)));
  return rows.length ? { inline_keyboard: rows.filter((r) => r.length) } : undefined;
}
function vkKeyboard(m: Msg) {
  const rows = btnRows(m.buttons).slice(0, 6).map((r) => r.map((b) => b.t === "play"
    ? { action: { type: "open_app", app_id: VK_APP, label: b.label.slice(0, 40), hash: "" } }
    : { action: { type: "open_link", link: btnUrl(b), label: b.label.slice(0, 40) } }).filter((b: any) => b.action.type === "open_app" || /^https?:\/\//.test(b.action.link)));
  return rows.length ? JSON.stringify({ inline: true, buttons: rows.filter((r) => r.length) }) : "";
}

// ---------- Telegram ----------
type Res = { id: number; st: string; err?: string | null };
const tgFile = new Map<string, string>(); // url -> file_id, чтобы не качать файл заново для каждого игрока

async function tgCall(tok: string, method: string, body: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${tok}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return await r.json().catch(() => ({ ok: false, description: "bad response" }));
}
function rememberFile(media: Media[], result: any) {
  const list = Array.isArray(result) ? result : [result];
  list.forEach((x: any, i: number) => {
    const m = media[i];
    if (!m || !x) return;
    const id = x.photo ? x.photo[x.photo.length - 1].file_id : (x.video || x.animation || x.document || {}).file_id;
    if (id) tgFile.set(m.url, id);
  });
}
async function tgSend(tok: string, chat: number, m: Msg): Promise<{ st: string; err?: string; wait?: number }> {
  const o = m.opts || {};
  const base: Record<string, unknown> = { chat_id: chat, disable_notification: !!o.silent, protect_content: !!o.protect };
  const media = m.media || [];
  const markup = tgMarkup(m);
  let r: any;
  if (!media.length) {
    r = await tgCall(tok, "sendMessage", { ...base, text: m.html || m.text || "", parse_mode: "HTML", link_preview_options: { is_disabled: !!o.nopreview }, reply_markup: markup });
  } else if (media.length === 1) {
    const x = media[0];
    const method = { photo: "sendPhoto", video: "sendVideo", animation: "sendAnimation" }[x.kind] || "sendDocument";
    const field = { photo: "photo", video: "video", animation: "animation" }[x.kind] || "document";
    const body: Record<string, unknown> = { ...base, [field]: tgFile.get(x.url) || x.url, caption: m.html || "", parse_mode: "HTML", reply_markup: markup };
    if (x.kind !== "document") { body.has_spoiler = !!o.spoiler; body.show_caption_above_media = !!o.above; }
    r = await tgCall(tok, method, body);
    if (r.ok) rememberFile(media, r.result);
  } else {
    const items = media.slice(0, 10).map((x, i) => ({
      type: x.kind === "animation" ? "video" : x.kind, media: tgFile.get(x.url) || x.url,
      ...(i === 0 ? { caption: m.html || "", parse_mode: "HTML", show_caption_above_media: !!o.above } : {}),
      ...(x.kind === "photo" || x.kind === "video" ? { has_spoiler: !!o.spoiler } : {}),
    }));
    r = await tgCall(tok, "sendMediaGroup", { ...base, media: items });
    if (r.ok) {
      rememberFile(media, r.result);
      // у альбома в Telegram не бывает кнопок - присылаем их следом
      if (markup) await tgCall(tok, "sendMessage", { ...base, text: "👇", reply_markup: markup });
    }
  }
  if (r.ok) return { st: "ok" };
  const d = String(r.description || "ошибка");
  if (r.error_code === 429) return { st: "q", err: d, wait: (r.parameters?.retry_after || 3) * 1000 };
  if (r.error_code === 403 || /chat not found|user is deactivated|bot was blocked/i.test(d)) return { st: "blocked", err: d };
  return { st: "fail", err: d };
}

// ---------- ВКонтакте ----------
async function vk(method: string, params: Record<string, string | number>, token: string) {
  const body = new URLSearchParams();
  for (const k in params) if (params[k] !== "" && params[k] !== undefined) body.set(k, String(params[k]));
  body.set("access_token", token); body.set("v", "5.199");
  const r = await fetch(`https://api.vk.com/method/${method}`, { method: "POST", body });
  return await r.json().catch(() => ({ error: { error_code: 0, error_msg: "bad response" } }));
}
// картинки и файлы один раз загружаем во ВК, дальше шлём готовые вложения всем
async function vkAttach(token: string, m: Msg, peer: number) {
  const out: string[] = [];
  for (const x of (m.media || []).slice(0, 10)) {
    try {
      const file = await (await fetch(x.url)).blob();
      if (x.kind === "photo") {
        const s = await vk("photos.getMessagesUploadServer", { peer_id: 0, group_id: VK_GROUP }, token);
        const fd = new FormData(); fd.append("photo", file, x.name || "photo.jpg");
        const up = await (await fetch(s.response.upload_url, { method: "POST", body: fd })).json();
        const sv = await vk("photos.saveMessagesPhoto", { photo: up.photo, server: up.server, hash: up.hash, group_id: VK_GROUP }, token);
        const p = sv.response?.[0];
        if (p) out.push(`photo${p.owner_id}_${p.id}`);
      } else {
        const s = await vk("docs.getMessagesUploadServer", { type: "doc", peer_id: peer, group_id: VK_GROUP }, token);
        const fd = new FormData(); fd.append("file", file, x.name || "file");
        const up = await (await fetch(s.response.upload_url, { method: "POST", body: fd })).json();
        const sv = await vk("docs.save", { file: up.file, title: x.name || "Файл" }, token);
        const d = sv.response?.doc || sv.response?.[0];
        if (d) out.push(`doc${d.owner_id}_${d.id}`);
      }
    } catch (_) { /* без вложения сообщение всё равно уйдёт */ }
  }
  return out.join(",");
}
let vkNoFmt = false;
async function vkSend(token: string, row: any, m: Msg, att: string): Promise<{ st: string; err?: string; wait?: number }> {
  const o = m.opts || {};
  const p: Record<string, string | number> = {
    peer_id: row.peer, random_id: row.id, message: m.text || "", attachment: att, keyboard: vkKeyboard(m),
    dont_parse_links: o.nopreview ? 1 : 0, group_id: VK_GROUP,
  };
  if (!vkNoFmt && Array.isArray(m.vkfmt) && m.vkfmt.length) p.format_data = JSON.stringify({ version: 1, items: m.vkfmt });
  let r = await vk("messages.send", p, token);
  if (r.error && p.format_data && r.error.error_code === 100) { vkNoFmt = true; delete p.format_data; r = await vk("messages.send", p, token); }
  if (!r.error) return { st: "ok" };
  const c = r.error.error_code, d = String(r.error.error_msg || "ошибка");
  if (c === 6 || c === 9) return { st: "q", err: d, wait: 1500 };
  if (c === 901 || c === 902 || c === 900 || c === 18) return { st: "blocked", err: d };
  return { st: "fail", err: `${c}: ${d}` };
}
async function vkNotify(token: string, rows: any[], m: Msg): Promise<Res[]> {
  const text = (m.text || "").replace(/\s+/g, " ").trim().slice(0, 254);
  const r = await vk("notifications.sendMessage", { user_ids: rows.map((x) => x.peer).join(","), message: text, random_id: rows[0].id }, token);
  if (r.error) return rows.map((x) => ({ id: x.id, st: r.error.error_code === 6 ? "q" : "fail", err: `${r.error.error_code}: ${r.error.error_msg}` }));
  const by = new Map<number, any>((r.response || []).map((s: any) => [Number(s.user_id), s]));
  return rows.map((x) => {
    const s = by.get(Number(x.peer));
    if (s && s.status) return { id: x.id, st: "ok" };
    return { id: x.id, st: s?.error?.code === 1 ? "blocked" : "fail", err: s?.error ? `${s.error.code}: ${s.error.description}` : "нет ответа" };
  });
}

// ---------- очередь ----------
async function tick() {
  const sec = await rpc("bcast_secrets", {});
  const end = Date.now() + 50_000;
  let total = 0;
  while (Date.now() < end) {
    const t0 = Date.now();
    const batch = await rpc("bcast_take", { p_n: 25 });
    const rows: any[] = batch.rows || [];
    if (!rows.length) break;
    const msgs: Record<string, { msg: Msg; vk_att: string | null }> = batch.msgs || {};
    const res: Res[] = [];
    let wait = 0;
    // вложения ВК - один раз на рассылку
    for (const bid of Object.keys(msgs)) {
      const b = msgs[bid];
      const first = rows.find((x) => String(x.bid) === bid && x.ch === "vk");
      if (first && b.vk_att === null && (b.msg.media || []).length && sec.vk_group_token) {
        b.vk_att = await vkAttach(sec.vk_group_token, b.msg, first.peer);
        await rpc("bcast_set_vk", { p_id: Number(bid), p_att: b.vk_att });
      }
    }
    const one = async (x: any) => {
      const b = msgs[String(x.bid)];
      try {
        let r: { st: string; err?: string; wait?: number };
        if (x.ch === "tg") r = sec.tg_bot_token ? await tgSend(sec.tg_bot_token, x.peer, b.msg) : { st: "fail", err: "нет ключа бота" };
        else r = sec.vk_group_token ? await vkSend(sec.vk_group_token, x, b.msg, b.vk_att || "") : { st: "fail", err: "нет ключа сообщества ВК" };
        if (r.wait) wait = Math.max(wait, r.wait);
        res.push({ id: x.id, st: r.st, err: r.err || null });
      } catch (e) { res.push({ id: x.id, st: "fail", err: String(e).slice(0, 150) }); }
    };
    await Promise.all(rows.filter((x) => x.ch !== "vkn").map(one));
    // уведомления приложения ВК - пачками до 100
    const vkn = rows.filter((x) => x.ch === "vkn");
    const byB = new Map<string, any[]>();
    vkn.forEach((x) => { const k = String(x.bid); byB.set(k, [...(byB.get(k) || []), x]); });
    for (const [bid, list] of byB) {
      if (!sec.vk_service) { list.forEach((x) => res.push({ id: x.id, st: "fail", err: "нет сервисного ключа ВК" })); continue; }
      try { res.push(...await vkNotify(sec.vk_service, list, msgs[bid].msg)); }
      catch (e) { list.forEach((x) => res.push({ id: x.id, st: "fail", err: String(e).slice(0, 150) })); }
    }
    await rpc("bcast_done", { p: res });
    total += res.filter((r) => r.st !== "q").length;
    // Telegram - не больше ~25 сообщений в секунду
    const pause = Math.max(wait, 1100 - (Date.now() - t0));
    if (pause > 0) await sleep(pause);
  }
  return total;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    if ((req.headers.get("content-type") || "").startsWith("multipart/form-data")) return await upload(req);
    const body = await req.json().catch(() => ({}));
    if (body.action !== "tick") return json({ error: "unknown action" }, 400);
    const sec = await rpc("bcast_secrets", {});
    const cronOk = !!sec.bcast_cron && req.headers.get("x-bcast") === sec.bcast_cron;
    if (!cronOk && !(await isAdmin(String(body.init_data || "")))) return json({ error: "forbidden" }, 403);
    return json({ sent: await tick() });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});

// =====================================================================
//  Бульк · рассылки (Supabase Edge Function «bcast»).
//  * POST multipart {init_data, file} - загрузить картинку/видео/файл для рассылки (только команда).
//  * POST {action: "tick"} - отправить очередь: Telegram-бот, сообщения сообщества ВК, уведомления приложения ВК.
//    Будит база раз в минуту (заголовок x-bcast) и админка сразу после «Отправить» (init_data).
//  * POST {action: "wall"} - пост в следующую по очереди группу ВК (цикл «Посты в группы», база будит раз в минуту).
//  * POST {action: "wall_resolve", links} - проверить группы по ссылкам (открыта ли стена) и добавить в список.
//  * POST {action: "from_url", url} - скачать картинку/видео по ссылке в хранилище; {action: "vk_photos"} - мои фото ВК для выбора.
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
async function store(file: Blob, name: string, type: string) {
  const ext = (name.match(/\.([A-Za-z0-9]{1,8})$/) || [, (type.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8)])[1]!.toLowerCase();
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const r = await fetch(`${URL_DB}/storage/v1/object/bcast/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SRV}`, "Content-Type": type || "application/octet-stream", "x-upsert": "true" },
    body: file,
  });
  if (!r.ok) return json({ error: "storage: " + (await r.text()).slice(0, 200) }, 500);
  return json({ url: `${URL_DB}/storage/v1/object/public/bcast/${path}`, kind: kindOf(type, name), name, size: file.size, type });
}
// картинка по ссылке: сервер скачивает сам (во встроенном браузере ВК выбор файла бывает недоступен)
async function fromUrl(u: string) {
  if (!/^https?:\/\/\S+$/.test(u)) return json({ error: "bad url" }, 400);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(u, { signal: ctl.signal, redirect: "follow" });
    if (!r.ok) return json({ error: "по ссылке ответили " + r.status }, 400);
    const type = (r.headers.get("content-type") || "").split(";")[0].trim();
    const len = +(r.headers.get("content-length") || 0);
    if (len > 50 * 1024 * 1024) return json({ error: "too big" }, 400);
    const blob = await r.blob();
    if (blob.size > 50 * 1024 * 1024) return json({ error: "too big" }, 400);
    if (!/^(image|video)\//.test(type) && !/\.(jpe?g|png|gif|webp|mp4|pdf)(\?|$)/i.test(u)) return json({ error: "по ссылке не картинка и не видео" }, 400);
    const name = decodeURIComponent((u.split("?")[0].split("/").pop() || "file")).slice(0, 80) || "file";
    return await store(blob, /\.[a-z0-9]{2,5}$/i.test(name) ? name : name + "." + (type.split("/")[1] || "jpg"), type || "image/jpeg");
  } catch (e) { return json({ error: "не скачалось: " + String(e).slice(0, 100) }, 400); } finally { clearTimeout(t); }
}
// мои фото ВКонтакте (по ключу создателя) - выбрать картинку прямо из ВК
async function vkPhotos(offset: number) {
  const token = await rpc("wall_token", {});
  if (!token) return json({ error: "no token" }, 400);
  const r = await vk("photos.getAll", { count: 60, offset: Math.max(0, offset | 0), no_service_albums: 0, photo_sizes: 1 }, token);
  if (r.error) return json({ error: `${r.error.error_code}: ${r.error.error_msg}` }, 400);
  const pick = (sizes: any[], prefer: string[]) => { for (const t of prefer) { const x = sizes.find((s) => s.type === t); if (x) return x.url; } return sizes.length ? sizes[sizes.length - 1].url : ""; };
  const items = (r.response?.items || []).map((p: any) => ({
    vk: `photo${p.owner_id}_${p.id}${p.access_key ? "_" + p.access_key : ""}`,
    url: pick(p.sizes || [], ["w", "z", "y", "x"]),
    thumb: pick(p.sizes || [], ["q", "p", "m", "x"]),
  })).filter((x: any) => x.url);
  return json({ items, total: r.response?.count || 0 });
}
async function upload(req: Request) {
  const fd = await req.formData();
  const init = String(fd.get("init_data") || "");
  const file = fd.get("file");
  if (!(file instanceof File)) return json({ error: "no file" }, 400);
  if (!(await isAdmin(init))) return json({ error: "not admin" }, 403);
  if (file.size > 50 * 1024 * 1024) return json({ error: "too big" }, 400);
  return await store(file, file.name, file.type);
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

// ---------- посты в группы ВК (личный ключ создателя, одна группа за вызов) ----------
function groupRef(s: string) {
  const t = s.trim();
  const m = t.match(/(?:vk\.com|vk\.ru|m\.vk\.com)\/([A-Za-z0-9_.]+)/i);
  const k = (m ? m[1] : t).replace(/^@/, "");
  const n = k.match(/^(?:club|public|event)(\d+)$/i);
  return n ? n[1] : k;
}
async function wallResolve(links: string[]) {
  const token = await rpc("wall_token", {});
  if (!token) return json({ error: "no token" }, 400);
  const refs = [...new Set(links.map(groupRef).filter(Boolean))].slice(0, 30);
  if (!refs.length) return json({ error: "no links" }, 400);
  const r = await vk("groups.getById", { group_ids: refs.join(","), fields: "can_post" }, token);
  if (r.error) return json({ error: `${r.error.error_code}: ${r.error.error_msg}` }, 400);
  const list = (Array.isArray(r.response) ? r.response : r.response?.groups || []).map((g: any) => ({
    gid: g.id, name: g.name, screen: g.screen_name, photo: g.photo_100 || "", can_post: !!g.can_post,
  }));
  if (list.length) await rpc("wall_groups_put", { p: list });
  return json({ groups: list, missing: refs.filter((x) => !list.some((g: any) => String(g.gid) === x || g.screen === x)) });
}
async function wallPhotos(token: string, m: Msg) {
  const out: string[] = [];
  for (const x of (m.media || []).filter((y) => y.kind === "photo").slice(0, 10)) {
    // фото уже во ВК - прикрепляем как есть
    if ((x as any).vk) { out.push((x as any).vk); continue; }
    try {
      const file = await (await fetch(x.url)).blob();
      const s = await vk("photos.getWallUploadServer", {}, token);
      const fd = new FormData(); fd.append("photo", file, x.name || "photo.jpg");
      const up = await (await fetch(s.response.upload_url, { method: "POST", body: fd })).json();
      const sv = await vk("photos.saveWallPhoto", { photo: up.photo, server: up.server, hash: up.hash }, token);
      const p = sv.response?.[0];
      if (p) out.push(`photo${p.owner_id}_${p.id}`);
    } catch (_) { /* без фото пост всё равно уйдёт */ }
  }
  return out.join(",");
}
async function wallPost() {
  const next = await rpc("wall_next", {});
  if (!next) return { idle: true };
  const token = await rpc("wall_token", {});
  const gid = Number(next.gid);
  if (!token) { await rpc("wall_done", { p: { gid, ok: false, kind: "token", err: "нет ключа" } }); return { error: "no token" }; }
  const m: Msg & { link?: string } = next.msg || {};
  const done: Record<string, unknown> = { gid };
  let att = next.att;
  if (att === null || att === undefined) { att = await wallPhotos(token, m); done.att = att; }
  // прошлый наш пост в этой группе убираем, чтобы на стене висела одна свежая запись
  if (next.last_post) { try { await vk("wall.delete", { owner_id: -gid, post_id: next.last_post }, token); } catch (_) { /* уже удалён */ } }
  const p: Record<string, string | number> = {
    owner_id: -gid, from_group: 0, message: m.text || "",
    attachments: [att, (m.link || "").trim()].filter(Boolean).join(","),
  };
  if (next.captcha && next.captcha.sid && next.captcha.key) { p.captcha_sid = next.captcha.sid; p.captcha_key = next.captcha.key; }
  const r = await vk("wall.post", p, token);
  if (!r.error) { await rpc("wall_done", { p: { ...done, ok: true, post_id: r.response?.post_id } }); return { ok: true, gid }; }
  const c = r.error.error_code, d = `${c}: ${r.error.error_msg}`;
  const kind = c === 14 ? "captcha" : c === 5 ? "token" : c === 9 ? "limit" : [15, 203, 214, 219, 222].includes(c) ? "group" : "other";
  await rpc("wall_done", { p: { ...done, ok: false, kind, err: d, captcha: c === 14 ? { sid: r.error.captcha_sid, img: r.error.captcha_img } : undefined } });
  return { ok: false, gid, err: d };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    if ((req.headers.get("content-type") || "").startsWith("multipart/form-data")) return await upload(req);
    const body = await req.json().catch(() => ({}));
    if (!["tick", "wall", "wall_resolve", "from_url", "vk_photos"].includes(body.action)) return json({ error: "unknown action" }, 400);
    const sec = await rpc("bcast_secrets", {});
    const cronOk = !!sec.bcast_cron && req.headers.get("x-bcast") === sec.bcast_cron;
    if (!cronOk && !(await isAdmin(String(body.init_data || "")))) return json({ error: "forbidden" }, 403);
    if (body.action === "from_url") return cronOk ? json({ error: "forbidden" }, 403) : await fromUrl(String(body.url || "").trim());
    if (body.action === "vk_photos") return cronOk ? json({ error: "forbidden" }, 403) : await vkPhotos(Number(body.offset) || 0);
    if (body.action === "wall_resolve") return cronOk ? json({ error: "forbidden" }, 403) : await wallResolve(Array.isArray(body.links) ? body.links.map(String) : []);
    if (body.action === "wall") return json(await wallPost());
    return json({ sent: await tick() });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});

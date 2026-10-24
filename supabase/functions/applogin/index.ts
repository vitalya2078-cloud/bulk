// =====================================================================
//  Бульк · вход через ВКонтакте в приложении для телефона (APK) - Supabase Edge Function «applogin».
//  В мини-приложении ВК игра получает от ВК подписанные «параметры запуска» (vk_user_id, vk_ts, sign),
//  и все функции базы проверяют игрока по ним. В APK этих параметров нет, поэтому:
//  * POST {action: "login", code} - код из окна входа ВК (oauth.vk.com, приложение игры) меняем здесь,
//    на сервере, на подтверждённый ВК номер игрока и выдаём такие же подписанные параметры запуска.
//    Плюс ключ продления (refresh): параметры живут 7 дней, ключ - пока не сменится секрет приложения.
//  * POST {action: "refresh", uid, refresh} - новые параметры запуска по ключу продления.
//  Секрет приложения ВК берётся из базы (private_secrets), наружу не уходит.
//  Развернуть: supabase functions deploy applogin --no-verify-jwt
// =====================================================================

const URL_DB = Deno.env.get("SUPABASE_URL")!;
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VK_APP = 54828995;
const REDIRECT = "https://oauth.vk.com/blank.html";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

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

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hmac(key: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
// то же, что делает ВК: vk_* параметры по алфавиту, HMAC-SHA256 секретом приложения, base64url без «=»
// (проверка в базе - public._tg_user, ветка «vk:»)
async function launchParams(secret: string, uid: number) {
  const p: Record<string, string> = {
    vk_app_id: String(VK_APP), vk_language: "ru", vk_platform: "mobile_android",
    vk_ts: String(Math.floor(Date.now() / 1000)), vk_user_id: String(uid),
  };
  const keys = Object.keys(p).sort();
  const dcs = keys.map((k) => `${k}=${encodeURIComponent(p[k])}`).sort().join("&");
  return dcs + "&sign=" + (await hmac(secret, dcs));
}
const refreshKey = (secret: string, uid: number) => hmac(secret, "bulk-app-refresh:" + uid);
// сравнение без утечки по времени
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

async function login(code: string) {
  if (!/^[A-Za-z0-9_-]{8,}$/.test(code)) return json({ error: "bad code" }, 400);
  const secret = await rpc("wall_app_secret", {});
  if (!secret) return json({ error: "no app secret" }, 500);
  const q = new URLSearchParams({ client_id: String(VK_APP), client_secret: secret, redirect_uri: REDIRECT, code });
  const r = await (await fetch(`https://oauth.vk.com/access_token?${q}`)).json().catch(() => ({ error: "bad response" }));
  const uid = Number(r.user_id);
  if (!r.access_token || !(uid > 0)) return json({ error: String(r.error_description || r.error || "vk refused") }, 400);
  // имя и фото для профиля (не обязательно: без них вход всё равно состоялся)
  let name = "", photo = "";
  try {
    const u = await (await fetch(`https://api.vk.com/method/users.get?${new URLSearchParams({ fields: "photo_200", access_token: r.access_token, v: "5.199" })}`)).json();
    const x = u.response?.[0];
    if (x) { name = x.first_name || ""; photo = x.photo_200 || ""; }
  } catch (_) { /* без имени */ }
  return json({ uid, params: await launchParams(secret, uid), refresh: await refreshKey(secret, uid), name, photo });
}

async function refresh(uid: number, key: string) {
  if (!(uid > 0) || !key) return json({ error: "bad request" }, 400);
  const secret = await rpc("wall_app_secret", {});
  if (!secret) return json({ error: "no app secret" }, 500);
  if (!same(key, await refreshKey(secret, uid))) return json({ error: "relogin" }, 403);
  return json({ uid, params: await launchParams(secret, uid) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "login") return await login(String(body.code || "").trim());
    if (body.action === "refresh") return await refresh(Number(body.uid), String(body.refresh || ""));
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
});

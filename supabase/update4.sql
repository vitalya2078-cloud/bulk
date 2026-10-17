-- =====================================================================
--  Бульк 0.16 - один мир для ВК и Telegram:
--  * игрок = uid (для Telegram это его id, для ВК без привязки -vk_id);
--  * привязка второй платформы кодом из 6 цифр;
--  * сохранение в базе + одна активная сессия (на двух устройствах сразу играть нельзя);
--  * новые топы: богачи, заработано за сутки, неделю, месяц.
--  Вставить целиком в SQL Editor -> Run (на предупреждение - Run query). Можно запускать повторно.
-- =====================================================================

alter table public.players add column if not exists tg bigint;
alter table public.players add column if not exists vk bigint;
alter table public.players add column if not exists platform text not null default '';
alter table public.players add column if not exists sess text;
alter table public.players add column if not exists sess_at timestamptz;
alter table public.players add column if not exists save_ts bigint not null default 0;
alter table public.players add column if not exists le_day double precision;
alter table public.players add column if not exists le_week double precision;
alter table public.players add column if not exists le_month double precision;
alter table public.players add column if not exists day_key text not null default '';
alter table public.players add column if not exists week_key text not null default '';
alter table public.players add column if not exists month_key text not null default '';
update public.players set tg = tg_id where tg is null and tg_id > 0;
update public.players set platform = 'tg' where platform = '' and tg_id > 0;
create unique index if not exists players_tg on public.players (tg) where tg is not null;
create unique index if not exists players_vk on public.players (vk) where vk is not null;

create table if not exists public.link_codes (
  code text primary key,
  uid bigint not null,
  expires timestamptz not null
);
alter table public.link_codes enable row level security;
revoke all on public.link_codes from anon, authenticated;

-- ---------- служебное ----------
create or replace function public._uri_encode(t text) returns text
language plpgsql immutable as $$
declare b bytea := convert_to(coalesce(t, ''), 'UTF8'); r text := ''; i int; c int;
begin
  for i in 0 .. length(b) - 1 loop
    c := get_byte(b, i);
    if (c between 48 and 57) or (c between 65 and 90) or (c between 97 and 122) or c in (45, 95, 46, 33, 126, 42, 39, 40, 41) then r := r || chr(c);
    else r := r || '%' || upper(lpad(to_hex(c), 2, '0'));
    end if;
  end loop;
  return r;
end $$;

create or replace function public._keys() returns text[]
language sql stable as $$
  select array[to_char(now() at time zone 'Europe/Moscow', 'YYYY-MM-DD'),
               to_char(now() at time zone 'Europe/Moscow', 'IYYY-"W"IW'),
               to_char(now() at time zone 'Europe/Moscow', 'YYYY-MM')]
$$;

-- ---------- кто это: Telegram (initData) или ВК ("vk:" + параметры запуска) ----------
-- Возвращает json: id = uid игрока, tg / vk = id на платформе, platform, имя и т.д.
create or replace function public._tg_user(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  token text; kv text; k text; v text; h text; dcs text; arr text[] := '{}';
  secret bytea; calc text; auth bigint := 0; u jsonb; tid bigint; vid bigint; uid bigint; raw text; vks text[] := '{}'; sign text;
begin
  if left(coalesce(init_data, ''), 3) = 'vk:' then
    select s.v into token from public.private_secrets s where s.k = 'vk_secret';
    if token is null then raise exception 'no vk secret'; end if;
    raw := substr(init_data, 4);
    if left(raw, 1) = '?' then raw := substr(raw, 2); end if;
    foreach kv in array string_to_array(raw, '&') loop
      k := split_part(kv, '=', 1);
      v := public._urldecode(substr(kv, length(k) + 2));
      if k = 'sign' then sign := v;
      elsif left(k, 3) = 'vk_' then vks := vks || (k || '=' || public._uri_encode(v));
      end if;
      if k = 'vk_user_id' then vid := v::bigint; end if;
      if k = 'vk_ts' then auth := v::bigint; end if;
    end loop;
    select string_agg(x, '&' order by x collate "C") into dcs from unnest(vks) as x;
    calc := rtrim(translate(encode(extensions.hmac(convert_to(dcs, 'UTF8'), convert_to(token, 'UTF8'), 'sha256'), 'base64'), '+/', '-_'), '=');
    if sign is null or calc <> sign then raise exception 'bad signature'; end if;
    if auth < extract(epoch from now()) - 7 * 86400 then raise exception 'too old'; end if;
    if vid is null then raise exception 'no user'; end if;
    select p.tg_id into uid from public.players p where p.vk = vid;
    return jsonb_build_object('id', coalesce(uid, -vid), 'vk', vid, 'platform', 'vk', 'first_name', '');
  end if;

  select s.v into token from public.private_secrets s where s.k = 'tg_bot_token';
  if token is null then raise exception 'no bot token'; end if;
  foreach kv in array string_to_array(coalesce(init_data, ''), '&') loop
    k := split_part(kv, '=', 1);
    v := public._urldecode(substr(kv, length(k) + 2));
    if k = 'hash' then h := v; else arr := arr || (k || '=' || v); end if;
    if k = 'auth_date' then auth := v::bigint; end if;
    if k = 'user' then u := v::jsonb; end if;
  end loop;
  select string_agg(x, E'\n' order by x collate "C") into dcs from unnest(arr) as x;
  secret := extensions.hmac(convert_to(token, 'UTF8'), convert_to('WebAppData', 'UTF8'), 'sha256');
  calc := encode(extensions.hmac(convert_to(dcs, 'UTF8'), secret, 'sha256'), 'hex');
  if h is null or calc <> h then raise exception 'bad signature'; end if;
  if auth < extract(epoch from now()) - 7 * 86400 then raise exception 'too old'; end if;
  if u is null or (u->>'id') is null then raise exception 'no user'; end if;
  tid := (u->>'id')::bigint;
  select p.tg_id into uid from public.players p where p.tg = tid;
  return u || jsonb_build_object('id', coalesce(uid, tid), 'tg', tid, 'platform', 'tg');
end $$;

-- =====================================================================
--  Вход в игру и периодический отчёт
--  p: start ('1' - запуск), claim ('1' - занять сессию), sess (код сессии этого устройства),
--     name, avatar, lvl, rank, le, e, ph, cr, mastery, play, ver, ref, save (объект, save.ts - время)
-- =====================================================================
create or replace function public.hello(init_data text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb; me bigint; pl public.players; refid bigint; ks text[] := public._keys(); kicked boolean := false;
        nle double precision; sts bigint;
begin
  u := public._tg_user(init_data);
  me := (u->>'id')::bigint;
  p := coalesce(p, '{}');
  refid := case when (p->>'ref') ~ '^-?[0-9]{1,15}$' and (p->>'ref')::bigint <> me then (p->>'ref')::bigint end;
  nle := greatest(0, public._num(p, 'le', 0));
  if not exists (select 1 from public.players where tg_id = me) then
    insert into public.players (tg_id, tg, vk, platform, name, photo, username, lang, premium, ref, first_seen,
                                le_day, le_week, le_month, day_key, week_key, month_key)
      values (me, (u->>'tg')::bigint, (u->>'vk')::bigint, u->>'platform',
              left(coalesce(nullif(trim(p->>'name'), ''), nullif(u->>'first_name', ''), 'Алхимик'), 20),
              coalesce(case when (p->>'avatar') ~ '^[a-z][0-9]{2}$' then p->>'avatar' end, u->>'photo_url', ''),
              coalesce(u->>'username', ''), coalesce(u->>'language_code', ''), coalesce((u->>'is_premium')::boolean, false), refid, now(),
              nle, nle, nle, ks[1], ks[2], ks[3])
      on conflict do nothing;
  end if;
  select * into pl from public.players where tg_id = me;

  -- сессия: на одном аккаунте играет только одно устройство
  if (p->>'claim') = '1' then
    update public.players set sess = p->>'sess', sess_at = now() where tg_id = me;
  elsif pl.sess is not null and pl.sess <> coalesce(p->>'sess', '') and pl.sess_at > now() - interval '10 minutes' then
    kicked := true;
  end if;

  if not kicked then
    sts := case when jsonb_typeof(p->'save') = 'object' then coalesce(public._num(p->'save', 'ts', 0), 0)::bigint else 0 end;
    update public.players set
      name = left(coalesce(nullif(trim(p->>'name'), ''), name), 20),
      photo = coalesce(case when (p->>'avatar') ~ '^[a-z][0-9]{2}$' then p->>'avatar' end, nullif(u->>'photo_url', ''), photo),
      username = coalesce(nullif(u->>'username', ''), username),
      premium = coalesce((u->>'is_premium')::boolean, premium),
      platform = u->>'platform',
      tg = coalesce(tg, (u->>'tg')::bigint),
      vk = coalesce(vk, (u->>'vk')::bigint),
      sess = case when sess is null then p->>'sess' else sess end,
      sess_at = now(),
      sessions = sessions + case when (p->>'start') = '1' or last_seen is null or last_seen < now() - interval '30 minutes' then 1 else 0 end,
      last_seen = now(),
      lvl = greatest(1, least(100000, public._num(p, 'lvl', lvl)::int)),
      rnk = greatest(0, least(100, public._num(p, 'rank', rnk)::int)),
      le = case when p ? 'le' then nle else le end,
      ess = greatest(0, public._num(p, 'e', ess)),
      ph = greatest(0, public._num(p, 'ph', ph)),
      cr = greatest(0, least(1e12, public._num(p, 'cr', cr)))::bigint,
      mastery = greatest(0, least(1e15, public._num(p, 'mastery', mastery)))::bigint,
      play_sec = greatest(play_sec, least(1e10, public._num(p, 'play', play_sec))::bigint),
      ver = left(coalesce(p->>'ver', ver), 20),
      -- начало периодов: запоминаем, сколько было сварено в начале суток / недели / месяца
      le_day = case when day_key <> ks[1] or le_day is null then le else le_day end,
      le_week = case when week_key <> ks[2] or le_week is null then le else le_week end,
      le_month = case when month_key <> ks[3] or le_month is null then le else le_month end,
      day_key = ks[1], week_key = ks[2], month_key = ks[3],
      save = case when sts > 0 and sts >= save_ts and length((p->'save')::text) < 300000 then p->'save' else save end,
      save_at = case when sts > 0 and sts >= save_ts then now() else save_at end,
      save_ts = case when sts > 0 and sts >= save_ts then sts else save_ts end
    where tg_id = me
    returning * into pl;
    insert into public.active_days (day, tg_id) values ((now() at time zone 'Europe/Moscow')::date, me) on conflict do nothing;
  end if;

  return jsonb_build_object(
    'uid', me, 'tg', pl.tg, 'vk', pl.vk, 'kicked', kicked,
    'banned', pl.banned, 'reason', pl.ban_reason, 'top_ban', pl.top_ban,
    'admin', exists (select 1 from public.admins a where a.tg_id = me),
    'settings', coalesce((select jsonb_object_agg(k, v) from public.settings), '{}'),
    'mail', (select count(*) from public.mail m
             left join public.mail_state ms on ms.mail_id = m.id and ms.tg_id = me
             where not m.deleted and (m.to_tg is null or m.to_tg = me) and (m.until is null or m.until > now())
               and (m.to_tg is not null or m.created_at > pl.first_seen - interval '14 days')
               and (ms.read_at is null or (m.gift <> '{}' and ms.claimed_at is null))),
    'patches', case when kicked then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'ops', x.ops) order by x.id) from public.patches x where x.tg_id = me and x.applied_at is null), '[]') end
  );
end $$;

-- сохранение из базы (при запуске игра берёт самое свежее из локального, облака платформы и базы)
create or replace function public.load_save(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; pl public.players;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into pl from public.players where tg_id = me;
  if not found then return jsonb_build_object('uid', me, 'save', null); end if;
  return jsonb_build_object('uid', me, 'save', pl.save, 'ts', pl.save_ts, 'tg', pl.tg, 'vk', pl.vk,
    'busy', pl.sess is not null and pl.sess_at > now() - interval '10 minutes');
end $$;

-- =====================================================================
--  Привязка второй платформы
-- =====================================================================
create or replace function public.link_code(init_data text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; c text;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  if not exists (select 1 from public.players where tg_id = me) then raise exception 'play first'; end if;
  delete from public.link_codes where uid = me or expires < now();
  loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.link_codes where code = c);
  end loop;
  insert into public.link_codes values (c, me, now() + interval '10 minutes');
  return c;
end $$;

-- что будет при привязке: кратко про оба аккаунта
create or replace function public.link_info(init_data text, p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; t bigint; a public.players; b public.players;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select uid into t from public.link_codes where code = trim(p_code) and expires > now();
  if t is null then raise exception 'bad code'; end if;
  if t = me then raise exception 'same account'; end if;
  select * into a from public.players where tg_id = me;
  select * into b from public.players where tg_id = t;
  if (a.tg is not null and b.tg is not null) or (a.vk is not null and b.vk is not null) then raise exception 'same platform'; end if;
  return jsonb_build_object(
    'mine', jsonb_build_object('name', a.name, 'lvl', a.lvl, 'rank', a.rnk, 'le', a.le, 'cr', a.cr, 'platform', a.platform, 'at', a.save_at),
    'other', jsonb_build_object('name', b.name, 'lvl', b.lvl, 'rank', b.rnk, 'le', b.le, 'cr', b.cr, 'platform', case when b.vk is not null then 'vk' else 'tg' end, 'at', b.save_at));
end $$;

-- объединить: p_keep = 'mine' (оставить прогресс этого устройства) или 'other'
create or replace function public.link_apply(init_data text, p_code text, p_keep text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; t bigint; a public.players; b public.players; ntg bigint; nvk bigint;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select uid into t from public.link_codes where code = trim(p_code) and expires > now();
  if t is null then raise exception 'bad code'; end if;
  if t = me then raise exception 'same account'; end if;
  select * into a from public.players where tg_id = me;
  select * into b from public.players where tg_id = t;
  if (a.tg is not null and b.tg is not null) or (a.vk is not null and b.vk is not null) then raise exception 'same platform'; end if;
  ntg := coalesce(b.tg, a.tg); nvk := coalesce(b.vk, a.vk);
  -- команда: права переносим на общий аккаунт
  if exists (select 1 from public.admins where tg_id = me) and not exists (select 1 from public.admins where tg_id = t) then
    update public.admins set tg_id = t where tg_id = me;
  end if;
  delete from public.players where tg_id = me;
  update public.players set tg = ntg, vk = nvk, sess = null, sess_at = null,
    save = case when p_keep = 'mine' then a.save else save end,
    save_ts = case when p_keep = 'mine' then greatest(a.save_ts, save_ts) + 1 else save_ts + 1 end,
    save_at = now(),
    lvl = case when p_keep = 'mine' then a.lvl else lvl end, rnk = case when p_keep = 'mine' then a.rnk else rnk end,
    le = case when p_keep = 'mine' then a.le else le end, ess = case when p_keep = 'mine' then a.ess else ess end,
    cr = case when p_keep = 'mine' then a.cr else cr end, ph = case when p_keep = 'mine' then a.ph else ph end,
    banned = banned or a.banned, top_ban = top_ban or a.top_ban
  where tg_id = t;
  delete from public.link_codes where code = trim(p_code);
  perform public._log(t, 'Привязал платформу', t, jsonb_build_object('tg', ntg, 'vk', nvk, 'keep', p_keep));
  return (select jsonb_build_object('uid', tg_id, 'save', save, 'ts', save_ts) from public.players where tg_id = t);
end $$;

-- =====================================================================
--  Топы: rich - эссенция сейчас; day / week / month - сварено за период
-- =====================================================================
create or replace function public.top_list(p_board text, p_limit int default 50, p_me bigint default 0)
returns jsonb language sql stable security definer set search_path = public as $$
  with ks as (select public._keys() k),
  b as (
    select p.tg_id, p.name, p.photo, p.platform,
      case p_board
        when 'rich' then p.ess
        when 'day' then case when p.day_key = (select k[1] from ks) then greatest(0, p.le - coalesce(p.le_day, p.le)) else 0 end
        when 'week' then case when p.week_key = (select k[2] from ks) then greatest(0, p.le - coalesce(p.le_week, p.le)) else 0 end
        when 'month' then case when p.month_key = (select k[3] from ks) then greatest(0, p.le - coalesce(p.le_month, p.le)) else 0 end
      end as score
    from public.players p
    where not p.banned and not p.top_ban and p.last_seen is not null),
  r as (select b.*, row_number() over (order by score desc, tg_id) as place from b where score > 0)
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('place', place, 'name', name, 'photo', photo, 'score', score, 'platform', platform, 'is_me', tg_id = p_me) order by place)
                      from r where place <= least(greatest(p_limit, 1), 100)), '[]'),
    'me', (select jsonb_build_object('place', place, 'score', score) from r where tg_id = p_me),
    'total', (select count(*) from r))
$$;

-- старые топы (Полка зелий): база очки больше не принимает молча
create or replace function public.submit_score(init_data text, p_board text, p_score bigint, p_name text default '', p_avatar text default '')
returns void language sql security definer set search_path = public as $$ select $$;

-- в карточке игрока админки - платформы
create or replace function public.adm_players(init_data text, p_q text default '', p_sort text default 'seen', p_filter text default '', p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; q text := lower(trim(coalesce(p_q, '')));
begin
  a := public._adm(init_data);
  return jsonb_build_object(
    'total', (select count(*) from public.players p where (q = '' or lower(p.name) like '%' || q || '%' or lower(p.username) like '%' || q || '%' or p.tg_id::text = q or p.tg::text = q or p.vk::text = q)
                and (p_filter = '' or (p_filter = 'banned' and p.banned) or (p_filter = 'online' and p.last_seen > now() - interval '5 minutes')
                     or (p_filter = 'new' and p.first_seen > now() - interval '1 day') or (p_filter = 'limited' and (p.top_ban or p.no_gift))
                     or (p_filter = 'tg' and p.tg is not null) or (p_filter = 'vk' and p.vk is not null))),
    'rows', coalesce((select jsonb_agg(r) from (
      select p.tg_id as id, p.name, p.username, p.photo, p.lvl, p.rnk, p.le, p.ess, p.ph, p.cr, p.mastery, p.sessions, p.play_sec,
             p.first_seen, p.last_seen, p.banned, p.top_ban, p.no_gift, p.ver, p.premium, p.tg, p.vk, p.platform
      from public.players p
      where (q = '' or lower(p.name) like '%' || q || '%' or lower(p.username) like '%' || q || '%' or p.tg_id::text = q or p.tg::text = q or p.vk::text = q)
        and (p_filter = '' or (p_filter = 'banned' and p.banned) or (p_filter = 'online' and p.last_seen > now() - interval '5 minutes')
             or (p_filter = 'new' and p.first_seen > now() - interval '1 day') or (p_filter = 'limited' and (p.top_ban or p.no_gift))
             or (p_filter = 'tg' and p.tg is not null) or (p_filter = 'vk' and p.vk is not null))
      order by
        case when p_sort = 'le' then p.le end desc nulls last,
        case when p_sort = 'cr' then p.cr end desc nulls last,
        case when p_sort = 'lvl' then p.lvl end desc nulls last,
        case when p_sort = 'new' then p.first_seen end desc nulls last,
        case when p_sort = 'play' then p.play_sec end desc nulls last,
        p.last_seen desc nulls last
      limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) r), '[]'));
end $$;

revoke execute on function public._uri_encode(text) from public, anon, authenticated;
revoke execute on function public._keys() from public, anon, authenticated;
revoke execute on function public._tg_user(text) from public, anon, authenticated;
grant execute on function public.hello(text, jsonb) to anon, authenticated;
grant execute on function public.load_save(text) to anon, authenticated;
grant execute on function public.link_code(text) to anon, authenticated;
grant execute on function public.link_info(text, text) to anon, authenticated;
grant execute on function public.link_apply(text, text, text) to anon, authenticated;
grant execute on function public.top_list(text, int, bigint) to anon, authenticated;
grant execute on function public.adm_players(text, text, text, text, int, int) to anon, authenticated;

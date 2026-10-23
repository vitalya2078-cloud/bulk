-- =====================================================================
--  Бульк 0.24 - админка, которая умеет всё.
--  * Создателя можно вернуть в топы (раньше любая правка создателя была запрещена).
--  * Рассылки в Telegram (бот) и ВКонтакте (сообщения сообщества и уведомления приложения):
--    текст с оформлением, картинки и файлы, кнопки, отложенная отправка, отчёт.
--    Отправляет функция bcast (Supabase Edge Function) из очереди bcast_q, база будит её раз в минуту.
--  * Подписка игрока на сообщения: ВК - согласие на сообщения сообщества, Telegram - разрешение боту писать.
--  * Промокоды: код, подарок, лимит, срок. Подарок приходит письмом в почту игрока.
--  * Подарок группе игроков (не только «всем» или «одному»).
--  * История событий: поиск, фильтры, листание.
--  Ключ сообщества ВК вставляешь сам:
--    insert into public.private_secrets values ('vk_group_token', 'КЛЮЧ') on conflict (k) do update set v = excluded.v;
--  Вставить целиком в SQL Editor -> Run. Можно запускать повторно.
-- =====================================================================

-- ---------- создатель: снять отметку «убран из топов» можно ----------
create or replace function public.adm_set_player(init_data text, p_id bigint, f jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, '');
  if (f ? 'banned' or f ? 'ban_reason' or f ? 'top_ban' or f ? 'no_gift' or f ? 'chat_ban') then perform public._can(init_data, 'ban'); end if;
  if f ? 'note' then perform public._can(init_data, 'notes'); end if;
  if f ? 'name' then perform public._can(init_data, 'edit'); end if;
  -- создателя нельзя ограничить, но снять ограничение можно
  if exists (select 1 from public.admins where tg_id = p_id and role = 'creator')
     and (coalesce((f->>'banned')::boolean, false) or coalesce((f->>'top_ban')::boolean, false)
       or coalesce((f->>'no_gift')::boolean, false) or coalesce((f->>'chat_ban')::boolean, false)) then
    raise exception 'creator is fixed';
  end if;
  update public.players set
    banned = coalesce((f->>'banned')::boolean, banned),
    ban_reason = left(coalesce(f->>'ban_reason', ban_reason), 200),
    top_ban = coalesce((f->>'top_ban')::boolean, top_ban),
    top_hold = case when (f->>'top_ban') = 'false' then false else top_hold end,
    no_gift = coalesce((f->>'no_gift')::boolean, no_gift),
    chat_ban = coalesce((f->>'chat_ban')::boolean, chat_ban),
    note = left(coalesce(f->>'note', note), 1000),
    name = left(coalesce(nullif(trim(f->>'name'), ''), name), 20)
  where tg_id = p_id;
  perform public._log(a, 'Изменил игрока', p_id, f);
end $$;

-- ---------- подписка игрока на сообщения ----------
alter table public.players add column if not exists vk_msgs boolean not null default false;   -- разрешил сообщения сообщества ВК
alter table public.players add column if not exists tg_bot boolean;                              -- null - не знаем, false - бот заблокирован

create or replace function public.subs_set(init_data text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; pl public.players;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  update public.players set
    vk_msgs = coalesce((p->>'vk')::boolean, vk_msgs),
    tg_bot = coalesce((p->>'tg')::boolean, tg_bot)
  where tg_id = me returning * into pl;
  return jsonb_build_object('vk', coalesce(pl.vk_msgs, false), 'tg', pl.tg_bot);
end $$;

create or replace function public.subs_get(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; pl public.players;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into pl from public.players where tg_id = me;
  return jsonb_build_object('vk', coalesce(pl.vk_msgs, false), 'tg', pl.tg_bot);
end $$;

-- ---------- кому: общий отбор игроков для рассылок и подарков ----------
--  {"kind": "all" | "self" | "team" | "one", "id": 123, "inactive": 3, "fresh": 7, "rank": 2, "lvl": 5}
create or replace function public._audience(a bigint, aud jsonb) returns setof public.players
language sql stable security definer set search_path = public, extensions as $$
  select p.* from public.players p
  where not p.banned
    and case coalesce(aud->>'kind', 'all')
      when 'self' then p.tg_id = a
      when 'team' then exists (select 1 from public.admins x where x.tg_id = p.tg_id)
      when 'one' then p.tg_id = (aud->>'id')::bigint
      else true end
    and (coalesce((aud->>'inactive')::int, 0) = 0 or p.last_seen < now() - make_interval(days => (aud->>'inactive')::int))
    and (coalesce((aud->>'fresh')::int, 0) = 0 or p.first_seen > now() - make_interval(days => (aud->>'fresh')::int))
    and (coalesce((aud->>'rank')::int, 0) = 0 or p.rnk >= (aud->>'rank')::int)
    and (coalesce((aud->>'lvl')::int, 0) = 0 or p.lvl >= (aud->>'lvl')::int)
$$;

-- ---------- рассылки ----------
create table if not exists public.bcast (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  created_by bigint not null,
  title text not null default '',
  status text not null default 'sending',     -- scheduled / sending / done / canceled
  ch text[] not null default '{}',            -- tg, vk (сообщения сообщества), vkn (уведомление приложения)
  aud jsonb not null default '{}',
  msg jsonb not null default '{}',            -- html, text, vkfmt, media[], buttons[], opts{}
  vk_att text,                                -- загруженные во ВК вложения (photo-1_2,doc-1_3)
  send_at timestamptz,
  finished_at timestamptz,
  total int not null default 0, sent int not null default 0, failed int not null default 0, blocked int not null default 0
);
create table if not exists public.bcast_q (
  id bigserial primary key,
  bid bigint not null references public.bcast(id),
  uid bigint not null,
  ch text not null,
  peer bigint not null,
  st text not null default 'q',               -- q ждёт, w отправляется, ok, fail, blocked, x отменено
  err text,
  at timestamptz,
  unique (bid, uid, ch)
);
create index if not exists bcast_q_st on public.bcast_q (st, id);
alter table public.bcast enable row level security;
alter table public.bcast_q enable row level security;
revoke all on public.bcast, public.bcast_q from anon, authenticated;

-- получатели по каналам
create or replace function public._bcast_rcpt(a bigint, aud jsonb, chs text[], nodup boolean)
returns table (uid bigint, ch text, peer bigint)
language sql stable security definer set search_path = public, extensions as $$
  with p as (select * from public._audience(a, aud))
  select p.tg_id, 'tg', p.tg from p where 'tg' = any(chs) and p.tg is not null and coalesce(p.tg_bot, true)
  union all
  select p.tg_id, 'vk', p.vk from p where 'vk' = any(chs) and p.vk is not null and p.vk_msgs
    and not (nodup and 'tg' = any(chs) and p.tg is not null and coalesce(p.tg_bot, true))
  union all
  select p.tg_id, 'vkn', p.vk from p where 'vkn' = any(chs) and p.vk is not null
    and exists (select 1 from public.notify n where n.uid = p.tg_id and n.enabled)
    and not (nodup and 'tg' = any(chs) and p.tg is not null and coalesce(p.tg_bot, true))
    and not ('vk' = any(chs) and p.vk_msgs)
$$;

create or replace function public.adm_bcast_count(init_data text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; chs text[];
begin
  a := public._can(init_data, 'mail');
  chs := array(select jsonb_array_elements_text(coalesce(p->'ch', '["tg","vk","vkn"]')));
  return jsonb_build_object(
    'tg', (select count(*) from public._bcast_rcpt(a, p->'aud', chs, coalesce((p->>'nodup')::boolean, true)) where ch = 'tg'),
    'vk', (select count(*) from public._bcast_rcpt(a, p->'aud', chs, coalesce((p->>'nodup')::boolean, true)) where ch = 'vk'),
    'vkn', (select count(*) from public._bcast_rcpt(a, p->'aud', chs, coalesce((p->>'nodup')::boolean, true)) where ch = 'vkn'),
    'players', (select count(*) from public._audience(a, p->'aud')),
    'vk_token', exists (select 1 from public.private_secrets where k = 'vk_group_token'),
    'vk_service', exists (select 1 from public.private_secrets where k = 'vk_service'),
    'tg_token', exists (select 1 from public.private_secrets where k = 'tg_bot_token'));
end $$;

create or replace function public.adm_bcast_send(init_data text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; chs text[]; b public.bcast; n int; at timestamptz; m jsonb;
begin
  a := public._can(init_data, 'mail');
  if coalesce(p->'aud'->>'kind', 'all') not in ('self', 'one') then perform public._can(init_data, 'mail_all'); end if;
  chs := array(select x from jsonb_array_elements_text(coalesce(p->'ch', '[]')) x where x in ('tg', 'vk', 'vkn'));
  if cardinality(chs) = 0 then raise exception 'no channel'; end if;
  m := coalesce(p->'msg', '{}');
  if coalesce(trim(m->>'text'), '') = '' and jsonb_array_length(coalesce(m->'media', '[]')) = 0 then raise exception 'empty'; end if;
  if length(m::text) > 60000 then raise exception 'too long'; end if;
  at := nullif(p->>'send_at', '')::timestamptz;
  insert into public.bcast (created_by, title, status, ch, aud, msg, send_at)
    values (a, left(coalesce(p->>'title', ''), 80), case when at > now() + interval '1 minute' then 'scheduled' else 'sending' end,
      chs, coalesce(p->'aud', '{}'), m, at)
    returning * into b;
  insert into public.bcast_q (bid, uid, ch, peer)
    select b.id, r.uid, r.ch, r.peer from public._bcast_rcpt(a, b.aud, chs, coalesce((p->>'nodup')::boolean, true)) r
    on conflict do nothing;
  get diagnostics n = row_count;
  update public.bcast set total = n, status = case when n = 0 then 'done' else status end, finished_at = case when n = 0 then now() end where id = b.id;
  if coalesce(p->'aud'->>'kind', 'all') <> 'self' then
    perform public._log(a, 'Рассылка', nullif((p->'aud'->>'id'), '')::bigint, jsonb_build_object('id', b.id, 'title', b.title, 'ch', chs, 'n', n, 'at', at));
  end if;
  return jsonb_build_object('id', b.id, 'total', n, 'status', case when n = 0 then 'done' else b.status end);
end $$;

create or replace function public.adm_bcast_list(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, 'mail');
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'at', b.created_at, 'title', b.title, 'status', b.status, 'ch', b.ch,
      'aud', b.aud, 'send_at', b.send_at, 'finished_at', b.finished_at, 'total', b.total, 'sent', b.sent, 'failed', b.failed, 'blocked', b.blocked,
      'msg', b.msg, 'who', coalesce(nullif(p.name, ''), 'ID ' || b.created_by),
      'left', (select count(*) from public.bcast_q q where q.bid = b.id and q.st in ('q', 'w')),
      'errors', (select jsonb_agg(distinct q.err) from (select err from public.bcast_q q2 where q2.bid = b.id and q2.err is not null limit 50) q)) order by b.id desc)
    from (select * from public.bcast where aud->>'kind' <> 'self' or created_by = a order by id desc limit 30) b
    left join public.players p on p.tg_id = b.created_by), '[]');
end $$;

create or replace function public.adm_bcast_cancel(init_data text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, 'mail_all');
  update public.bcast set status = 'canceled', finished_at = now() where id = p_id and status in ('scheduled', 'sending');
  update public.bcast_q set st = 'x' where bid = p_id and st = 'q';
  perform public._log(a, 'Отменил рассылку', null, jsonb_build_object('id', p_id));
end $$;

-- проверка права из функции bcast (загрузка файлов, запуск отправки)
create or replace function public.adm_bcast_can(init_data text) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
begin
  return public._can(init_data, 'mail');
end $$;

-- ---------- для функции bcast (только service_role) ----------
create or replace function public.bcast_secrets() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_object_agg(k, v), '{}') from public.private_secrets where k in ('tg_bot_token', 'vk_group_token', 'vk_service', 'bcast_cron')
$$;

-- взять порцию: запускает отложенные, возвращает зависшие, отдаёт до p_n получателей
create or replace function public.bcast_take(p_n int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare rows jsonb; msgs jsonb;
begin
  update public.bcast set status = 'sending' where status = 'scheduled' and send_at <= now();
  update public.bcast_q set st = 'q' where st = 'w' and at < now() - interval '5 minutes';
  with x as (
    select q.id from public.bcast_q q join public.bcast b on b.id = q.bid
    where q.st = 'q' and b.status = 'sending' order by q.id limit greatest(1, least(p_n, 500)) for update of q skip locked
  ), u as (
    update public.bcast_q q set st = 'w', at = now() from x where q.id = x.id returning q.id, q.bid, q.uid, q.ch, q.peer
  )
  select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]') into rows from u;
  select coalesce(jsonb_object_agg(b.id, jsonb_build_object('msg', b.msg, 'vk_att', b.vk_att)), '{}') into msgs
    from public.bcast b where b.id in (select (r->>'bid')::bigint from jsonb_array_elements(rows) r);
  -- закончились получатели - рассылка завершена
  update public.bcast b set status = 'done', finished_at = now()
    where b.status = 'sending' and not exists (select 1 from public.bcast_q q where q.bid = b.id and q.st in ('q', 'w'));
  return jsonb_build_object('rows', rows, 'msgs', msgs);
end $$;

-- итог порции: [{id, st, err}], st: ok / fail / blocked / q (повторить позже)
create or replace function public.bcast_done(p jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.bcast_q q set st = r.st, err = left(r.err, 200), at = now()
    from jsonb_to_recordset(p) as r(id bigint, st text, err text) where q.id = r.id;
  update public.players pl set tg_bot = false from public.bcast_q q, jsonb_to_recordset(p) as r(id bigint, st text)
    where q.id = r.id and r.st = 'blocked' and q.ch = 'tg' and pl.tg_id = q.uid;
  update public.players pl set tg_bot = true from public.bcast_q q, jsonb_to_recordset(p) as r(id bigint, st text)
    where q.id = r.id and r.st = 'ok' and q.ch = 'tg' and pl.tg_id = q.uid and pl.tg_bot is distinct from true;
  update public.players pl set vk_msgs = false from public.bcast_q q, jsonb_to_recordset(p) as r(id bigint, st text)
    where q.id = r.id and r.st = 'blocked' and q.ch = 'vk' and pl.tg_id = q.uid;
  update public.bcast b set
    sent = (select count(*) from public.bcast_q q where q.bid = b.id and q.st = 'ok'),
    failed = (select count(*) from public.bcast_q q where q.bid = b.id and q.st = 'fail'),
    blocked = (select count(*) from public.bcast_q q where q.bid = b.id and q.st = 'blocked')
  where b.id in (select q.bid from public.bcast_q q join jsonb_to_recordset(p) as r(id bigint) on r.id = q.id);
  update public.bcast b set status = 'done', finished_at = now()
    where b.status = 'sending' and not exists (select 1 from public.bcast_q q where q.bid = b.id and q.st in ('q', 'w'));
end $$;

create or replace function public.bcast_set_vk(p_id bigint, p_att text) returns void
language sql security definer set search_path = public, extensions as $$
  update public.bcast set vk_att = p_att where id = p_id
$$;

-- раз в минуту: если есть что отправлять - будим функцию bcast
create or replace function public._bcast_kick() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  if not exists (select 1 from public.bcast where status = 'sending' or (status = 'scheduled' and send_at <= now())) then return; end if;
  select v into s from public.private_secrets where k = 'bcast_cron';
  perform net.http_post(
    url := 'https://ahqaficklfciahzlghec.supabase.co/functions/v1/bcast',
    body := '{"action":"tick"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bcast', coalesce(s, '')));
end $$;

-- ---------- промокоды ----------
create table if not exists public.promo (
  code text primary key,
  gift jsonb not null default '{}',     -- {"cr":10,"ess_h":2}
  max_uses int not null default 0,      -- 0 - без ограничения
  uses int not null default 0,
  until timestamptz,
  active boolean not null default true,
  note text not null default '',
  created_by bigint,
  created_at timestamptz not null default now()
);
create table if not exists public.promo_use (
  code text not null, uid bigint not null, at timestamptz not null default now(),
  primary key (code, uid)
);
create table if not exists public.promo_fail (uid bigint not null, at timestamptz not null default now());
create index if not exists promo_fail_uid on public.promo_fail (uid, at desc);
alter table public.promo enable row level security;
alter table public.promo_use enable row level security;
alter table public.promo_fail enable row level security;
revoke all on public.promo, public.promo_use, public.promo_fail from anon, authenticated;

create or replace function public.promo_redeem(init_data text, p_code text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; c public.promo; k text; nid bigint;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  if not exists (select 1 from public.players where tg_id = me) then raise exception 'play first'; end if;
  if (select count(*) from public.promo_fail where uid = me and at > now() - interval '1 hour') >= 10 then raise exception 'too many tries'; end if;
  k := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  select * into c from public.promo where code = k for update;
  if not found or not c.active or (c.until is not null and c.until < now()) then
    insert into public.promo_fail (uid) values (me);
    raise exception 'bad code';
  end if;
  if exists (select 1 from public.promo_use where code = k and uid = me) then raise exception 'used'; end if;
  if c.max_uses > 0 and c.uses >= c.max_uses then raise exception 'run out'; end if;
  insert into public.promo_use (code, uid) values (k, me);
  update public.promo set uses = uses + 1 where code = k;
  insert into public.mail (to_tg, title, body, gift) values (me, left('Промокод ' || k, 80), coalesce(nullif(c.note, ''), 'Подарок по промокоду. Забирай!'), c.gift)
    returning id into nid;
  return jsonb_build_object('ok', true, 'mail', nid, 'gift', c.gift);
end $$;

create or replace function public.adm_promo_list(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, 'gift');
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select * from public.promo order by created_at desc limit 100) x), '[]');
end $$;

create or replace function public.adm_promo_save(init_data text, p jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; k text; g jsonb := '{}';
begin
  a := public._can(init_data, 'gift');
  k := upper(regexp_replace(coalesce(p->>'code', ''), '\s', '', 'g'));
  if k !~ '^[A-ZА-ЯЁ0-9_-]{3,24}$' then raise exception 'bad code'; end if;
  if public._num(p->'gift', 'cr') > 0 then g := g || jsonb_build_object('cr', least(100000, public._num(p->'gift', 'cr')::int)); end if;
  if public._num(p->'gift', 'ess_h') > 0 then g := g || jsonb_build_object('ess_h', least(1000, public._num(p->'gift', 'ess_h'))); end if;
  if g = '{}' and not (p ? 'active') then raise exception 'no gift'; end if;
  insert into public.promo (code, gift, max_uses, until, note, created_by, active)
    values (k, g, greatest(0, coalesce((p->>'max_uses')::int, 0)), nullif(p->>'until', '')::timestamptz, left(coalesce(p->>'note', ''), 300), a, coalesce((p->>'active')::boolean, true))
  on conflict (code) do update set
    gift = case when g = '{}' then promo.gift else g end,
    max_uses = case when p ? 'max_uses' then greatest(0, (p->>'max_uses')::int) else promo.max_uses end,
    until = case when p ? 'until' then nullif(p->>'until', '')::timestamptz else promo.until end,
    note = case when p ? 'note' then left(p->>'note', 300) else promo.note end,
    active = coalesce((p->>'active')::boolean, promo.active);
  perform public._log(a, 'Промокод', null, jsonb_build_object('code', k, 'gift', g, 'active', p->'active'));
end $$;

-- ---------- подарок группе игроков: личное письмо каждому ----------
create or replace function public.adm_gift_group(init_data text, p jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; g jsonb := '{}'; n int; d int;
begin
  a := public._can(init_data, 'mail_all');
  if trim(coalesce(p->>'title', '')) = '' then raise exception 'no title'; end if;
  if public._num(p->'gift', 'cr') > 0 then g := g || jsonb_build_object('cr', least(100000, public._num(p->'gift', 'cr')::int)); end if;
  if public._num(p->'gift', 'ess_h') > 0 then g := g || jsonb_build_object('ess_h', least(1000, public._num(p->'gift', 'ess_h'))); end if;
  if g <> '{}' then perform public._can(init_data, 'gift'); end if;
  d := greatest(0, coalesce((p->>'days')::int, 0));
  insert into public.mail (to_tg, title, body, gift, until)
    select x.tg_id, left(p->>'title', 80), left(coalesce(p->>'body', ''), 2000), g, case when d > 0 then now() + make_interval(days => d) end
    from public._audience(a, p->'aud') x where not (g <> '{}' and x.no_gift);
  get diagnostics n = row_count;
  perform public._log(a, 'Письмо группе', null, jsonb_build_object('title', p->>'title', 'gift', g, 'aud', p->'aud', 'n', n));
  return n;
end $$;

create or replace function public.adm_audience_count(init_data text, p_aud jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, '');
  return (select count(*) from public._audience(a, p_aud));
end $$;

-- ---------- история событий: поиск, фильтр, листание ----------
create or replace function public.adm_history(init_data text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; q text; k text; bf bigint; lim int;
begin
  a := public._can(init_data, 'log');
  q := nullif(trim(coalesce(p->>'q', '')), '');
  k := coalesce(p->>'kind', '');
  bf := nullif(p->>'before', '')::bigint;
  lim := greatest(10, least(coalesce((p->>'limit')::int, 50), 100));
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'at', l.at, 'action', l.action, 'target', l.target, 'name', tp.name,
      'admin', l.admin, 'admin_name', ap.name, 'details', l.details) order by l.id desc)
    from (select x.* from public.admin_log x
          left join public.players t on t.tg_id = x.target
          left join public.players ad on ad.tg_id = x.admin
          where (bf is null or x.id < bf)
            and (q is null or x.action ilike '%' || q || '%' or t.name ilike '%' || q || '%' or ad.name ilike '%' || q || '%'
                 or x.target::text = q or x.details::text ilike '%' || q || '%')
            and case k
              when 'ban' then x.action ilike any (array['%игрок%', '%Проверил%', '%Скрыл%', '%топ%', '%жалоб%', '%ковен%', '%Исключил%'])
              when 'gift' then x.action ilike any (array['%Письм%', '%Подар%', '%Промокод%', '%Рассылк%', '%письм%'])
              when 'edit' then x.action ilike any (array['%Правк%', '%Возврат%', '%Сброс%', '%сохранен%', '%Вернул%'])
              when 'settings' then x.action ilike 'Настройка%'
              when 'team' then x.action ilike any (array['%команд%', '%Назначил%', '%Убрал%', 'Стал создателем', '%Вош%', '%Привязал%', '%устройств%'])
              else true end
          order by x.id desc limit lim) l
    left join public.players tp on tp.tg_id = l.target left join public.players ap on ap.tg_id = l.admin), '[]');
end $$;

-- ---------- топы для команды: с номерами игроков и списком убранных ----------
create or replace function public.adm_top(init_data text, p_board text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; ks text[];
begin
  a := public._can(init_data, '');
  ks := public._keys();
  return jsonb_build_object(
    'rows', coalesce((select jsonb_agg(x order by x.place) from (
      select b.tg_id as id, b.name, b.photo, b.score, row_number() over (order by b.score desc, b.tg_id) as place from (
        select p.tg_id, p.name, p.photo,
          case p_board
            when 'rich' then p.ess
            when 'day' then case when p.day_key = ks[1] then greatest(0, p.le - coalesce(p.le_day, p.le)) else 0 end
            when 'week' then case when p.week_key = ks[2] then greatest(0, p.le - coalesce(p.le_week, p.le)) else 0 end
            when 'month' then case when p.month_key = ks[3] then greatest(0, p.le - coalesce(p.le_month, p.le)) else 0 end
            when 'mastery' then p.mastery
          end as score
        from public.players p where not p.banned and not p.top_ban and not p.top_hold and p.last_seen is not null) b
      where b.score > 0 order by b.score desc, b.tg_id limit 100) x), '[]'),
    'hidden', coalesce((select jsonb_agg(jsonb_build_object('id', p.tg_id, 'name', p.name, 'photo', p.photo, 'top_ban', p.top_ban, 'top_hold', p.top_hold,
        'reason', p.sus_reason, 'le', p.le) order by p.last_seen desc nulls last)
      from (select * from public.players where (top_ban or top_hold) and not banned order by last_seen desc nulls last limit 100) p), '[]'));
end $$;

-- ---------- права ----------
revoke execute on function public._audience(bigint, jsonb) from public, anon, authenticated;
revoke execute on function public._bcast_rcpt(bigint, jsonb, text[], boolean) from public, anon, authenticated;
revoke execute on function public._bcast_kick() from public, anon, authenticated;
revoke execute on function public.bcast_secrets() from public, anon, authenticated;
revoke execute on function public.bcast_take(int) from public, anon, authenticated;
revoke execute on function public.bcast_done(jsonb) from public, anon, authenticated;
revoke execute on function public.bcast_set_vk(bigint, text) from public, anon, authenticated;
do $$ begin
  grant execute on function public.bcast_secrets() to service_role;
  grant execute on function public.bcast_take(int) to service_role;
  grant execute on function public.bcast_done(jsonb) to service_role;
  grant execute on function public.bcast_set_vk(bigint, text) to service_role;
  grant execute on function public.adm_bcast_can(text) to service_role;
exception when others then raise notice 'service_role: %', sqlerrm; end $$;
grant execute on function public.adm_set_player(text, bigint, jsonb) to anon, authenticated;
grant execute on function public.subs_set(text, jsonb) to anon, authenticated;
grant execute on function public.subs_get(text) to anon, authenticated;
grant execute on function public.adm_bcast_count(text, jsonb) to anon, authenticated;
grant execute on function public.adm_bcast_send(text, jsonb) to anon, authenticated;
grant execute on function public.adm_bcast_list(text) to anon, authenticated;
grant execute on function public.adm_bcast_cancel(text, bigint) to anon, authenticated;
grant execute on function public.adm_bcast_can(text) to anon, authenticated;
grant execute on function public.promo_redeem(text, text) to anon, authenticated;
grant execute on function public.adm_promo_list(text) to anon, authenticated;
grant execute on function public.adm_promo_save(text, jsonb) to anon, authenticated;
grant execute on function public.adm_gift_group(text, jsonb) to anon, authenticated;
grant execute on function public.adm_audience_count(text, jsonb) to anon, authenticated;
grant execute on function public.adm_history(text, jsonb) to anon, authenticated;
grant execute on function public.adm_top(text, text) to anon, authenticated;

-- ---------- хранилище картинок и файлов рассылок, ключ будильника, расписание ----------
insert into public.private_secrets (k, v) values ('bcast_cron', md5(random()::text || clock_timestamp()::text) || md5(random()::text)) on conflict (k) do nothing;
do $$ begin
  insert into storage.buckets (id, name, public, file_size_limit)
    values ('bcast', 'bcast', true, 52428800) on conflict (id) do update set public = true;
exception when others then raise notice 'storage: %', sqlerrm; end $$;
do $$ begin
  perform cron.unschedule('bulk_bcast') where exists (select 1 from cron.job where jobname = 'bulk_bcast');
  perform cron.schedule('bulk_bcast', '* * * * *', 'select public._bcast_kick()');
exception when others then raise notice 'cron: %', sqlerrm; end $$;

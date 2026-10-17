-- =====================================================================
--  Бульк 0.14 - админ-панель: игроки, статистика, почта, подарки, ограничения, настройки.
--  Вставить целиком в SQL Editor и нажать Run. Можно запускать повторно.
-- =====================================================================

-- ---------- игроки: больше данных ----------
alter table public.players add column if not exists username text not null default '';
alter table public.players add column if not exists first_seen timestamptz not null default now();
alter table public.players add column if not exists last_seen timestamptz;
alter table public.players add column if not exists sessions int not null default 0;
alter table public.players add column if not exists lvl int not null default 1;
alter table public.players add column if not exists rnk int not null default 0;
alter table public.players add column if not exists le double precision not null default 0;
alter table public.players add column if not exists ess double precision not null default 0;
alter table public.players add column if not exists ph double precision not null default 0;
alter table public.players add column if not exists cr bigint not null default 0;
alter table public.players add column if not exists mastery bigint not null default 0;
alter table public.players add column if not exists play_sec bigint not null default 0;
alter table public.players add column if not exists ver text not null default '';
alter table public.players add column if not exists lang text not null default '';
alter table public.players add column if not exists premium boolean not null default false;
alter table public.players add column if not exists ref bigint;
alter table public.players add column if not exists banned boolean not null default false;
alter table public.players add column if not exists ban_reason text not null default '';
alter table public.players add column if not exists top_ban boolean not null default false;
alter table public.players add column if not exists no_gift boolean not null default false;
alter table public.players add column if not exists note text not null default '';
alter table public.players add column if not exists save jsonb;
alter table public.players add column if not exists save_at timestamptz;
create index if not exists players_seen on public.players (last_seen desc);

create table if not exists public.admins (tg_id bigint primary key, added_at timestamptz not null default now());
create table if not exists public.settings (k text primary key, v jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.active_days (day date not null, tg_id bigint not null, primary key (day, tg_id));
create table if not exists public.mail (
  id bigserial primary key,
  to_tg bigint,                       -- null - письмо всем
  title text not null default '',
  body text not null default '',
  gift jsonb not null default '{}',   -- {"cr":10,"ess_h":2}
  created_at timestamptz not null default now(),
  until timestamptz,
  deleted boolean not null default false
);
create table if not exists public.mail_state (
  mail_id bigint not null references public.mail(id) on delete cascade,
  tg_id bigint not null,
  read_at timestamptz,
  claimed_at timestamptz,
  primary key (mail_id, tg_id)
);
create table if not exists public.patches (
  id bigserial primary key,
  tg_id bigint not null,
  ops jsonb not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists patches_open on public.patches (tg_id) where applied_at is null;
create table if not exists public.admin_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  admin bigint not null,
  action text not null,
  target bigint,
  details jsonb not null default '{}'
);

do $$ declare t text; begin
  foreach t in array array['admins','settings','active_days','mail','mail_state','patches','admin_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------- служебное ----------
create or replace function public._num(j jsonb, k text, d double precision default 0) returns double precision
language sql immutable as $$
  select case when jsonb_typeof(j->k) = 'number' then (j->>k)::double precision else d end
$$;

create or replace function public._adm(init_data text) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare id bigint;
begin
  id := (public._tg_user(init_data)->>'id')::bigint;
  if not exists (select 1 from public.admins a where a.tg_id = id) then raise exception 'not admin'; end if;
  return id;
end $$;

create or replace function public._log(a bigint, act text, tgt bigint, det jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_log (admin, action, target, details) values (a, act, tgt, coalesce(det, '{}'))
$$;

-- =====================================================================
--  Игра
-- =====================================================================

-- вход в игру и периодическое обновление: статистика + ответ (бан, почта, правки, настройки)
create or replace function public.hello(init_data text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb; me bigint; pl public.players; fresh boolean; refid bigint;
begin
  u := public._tg_user(init_data);
  me := (u->>'id')::bigint;
  p := coalesce(p, '{}');
  select * into pl from public.players where tg_id = me;
  fresh := not found;
  refid := case when (p->>'ref') ~ '^[0-9]{1,15}$' and (p->>'ref')::bigint <> me then (p->>'ref')::bigint end;
  insert into public.players (tg_id, name, photo, username, lang, premium, ref, first_seen)
    values (me, left(coalesce(nullif(trim(p->>'name'), ''), u->>'first_name', 'Алхимик'), 20),
            coalesce(case when (p->>'avatar') ~ '^[a-z][0-9]{2}$' then p->>'avatar' end, u->>'photo_url', ''),
            coalesce(u->>'username', ''), coalesce(u->>'language_code', ''), coalesce((u->>'is_premium')::boolean, false), refid, now())
    on conflict (tg_id) do nothing;
  update public.players set
    name = left(coalesce(nullif(trim(p->>'name'), ''), name), 20),
    photo = coalesce(case when (p->>'avatar') ~ '^[a-z][0-9]{2}$' then p->>'avatar' end, nullif(u->>'photo_url', ''), photo),
    username = coalesce(u->>'username', username),
    premium = coalesce((u->>'is_premium')::boolean, premium),
    sessions = sessions + case when (p->>'start') = '1' or last_seen is null or last_seen < now() - interval '30 minutes' then 1 else 0 end,
    last_seen = now(),
    lvl = greatest(1, least(100000, public._num(p, 'lvl', lvl)::int)),
    rnk = greatest(0, least(100, public._num(p, 'rank', rnk)::int)),
    le = greatest(0, public._num(p, 'le', le)),
    ess = greatest(0, public._num(p, 'e', ess)),
    ph = greatest(0, public._num(p, 'ph', ph)),
    cr = greatest(0, least(1e12, public._num(p, 'cr', cr)))::bigint,
    mastery = greatest(0, least(1e15, public._num(p, 'mastery', mastery)))::bigint,
    play_sec = greatest(play_sec, least(1e10, public._num(p, 'play', play_sec))::bigint),
    ver = left(coalesce(p->>'ver', ver), 20),
    save = case when jsonb_typeof(p->'save') = 'object' and length((p->'save')::text) < 300000 then p->'save' else save end,
    save_at = case when jsonb_typeof(p->'save') = 'object' then now() else save_at end
  where tg_id = me
  returning * into pl;
  insert into public.active_days (day, tg_id) values ((now() at time zone 'Europe/Moscow')::date, me) on conflict do nothing;
  return jsonb_build_object(
    'banned', pl.banned, 'reason', pl.ban_reason, 'top_ban', pl.top_ban,
    'admin', exists (select 1 from public.admins a where a.tg_id = me),
    'settings', coalesce((select jsonb_object_agg(k, v) from public.settings), '{}'),
    'mail', (select count(*) from public.mail m
             left join public.mail_state ms on ms.mail_id = m.id and ms.tg_id = me
             where not m.deleted and (m.to_tg is null or m.to_tg = me) and (m.until is null or m.until > now())
               and (m.to_tg is not null or m.created_at > pl.first_seen - interval '14 days')
               and (ms.read_at is null or (m.gift <> '{}' and ms.claimed_at is null))),
    'patches', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'ops', x.ops) order by x.id) from public.patches x where x.tg_id = me and x.applied_at is null), '[]')
  );
end $$;

create or replace function public.patch_done(init_data text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  update public.patches set applied_at = now() where patches.id = p_id and tg_id = me and applied_at is null;
end $$;

create or replace function public.mail_list(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; fs timestamptz;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select first_seen into fs from public.players where tg_id = me;
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'body', m.body, 'gift', m.gift,
      'at', m.created_at, 'read', ms.read_at is not null, 'claimed', ms.claimed_at is not null, 'personal', m.to_tg is not null) order by m.created_at desc)
    from public.mail m left join public.mail_state ms on ms.mail_id = m.id and ms.tg_id = me
    where not m.deleted and (m.to_tg is null or m.to_tg = me) and (m.until is null or m.until > now())
      and (m.to_tg is not null or m.created_at > coalesce(fs, now()) - interval '14 days')), '[]');
end $$;

create or replace function public.mail_read(init_data text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  insert into public.mail_state (mail_id, tg_id, read_at) select m.id, me, now() from public.mail m
    where m.id = p_id and (m.to_tg is null or m.to_tg = me)
    on conflict (mail_id, tg_id) do update set read_at = coalesce(public.mail_state.read_at, now());
end $$;

-- забрать подарок из письма: возвращает подарок (один раз)
create or replace function public.mail_claim(init_data text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; m public.mail; done timestamptz; pl public.players;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into pl from public.players where tg_id = me;
  select * into m from public.mail where mail.id = p_id and not deleted and (to_tg is null or to_tg = me) and (until is null or until > now());
  if not found or m.gift = '{}' then return null; end if;
  if pl.banned then raise exception 'banned'; end if;
  if pl.no_gift and m.to_tg is null then raise exception 'no gift'; end if;
  select claimed_at into done from public.mail_state where mail_id = p_id and tg_id = me;
  if done is not null then return null; end if;
  insert into public.mail_state (mail_id, tg_id, read_at, claimed_at) values (p_id, me, now(), now())
    on conflict (mail_id, tg_id) do update set claimed_at = now(), read_at = coalesce(public.mail_state.read_at, now());
  return m.gift;
end $$;

-- топы: забаненных и снятых с рейтинга не показываем и не записываем
create or replace function public.submit_score(init_data text, p_board text, p_score bigint, p_name text default '', p_avatar text default '')
returns void language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb; id bigint; nm text; per text; ph text;
begin
  if p_board not in ('mastery', 'match3') then raise exception 'bad board'; end if;
  if p_score is null or p_score < 0 or p_score > 1e15 then raise exception 'bad score'; end if;
  if p_board = 'match3' and p_score > 200000 then raise exception 'bad score'; end if;
  u := public._tg_user(init_data);
  id := (u->>'id')::bigint;
  if exists (select 1 from public.players x where x.tg_id = id and (x.banned or x.top_ban)) then return; end if;
  nm := left(trim(coalesce(nullif(trim(p_name), ''), u->>'first_name', 'Алхимик')), 20);
  ph := case when p_avatar ~ '^[a-z][0-9]{2}$' then p_avatar else coalesce(u->>'photo_url', '') end;
  insert into public.players (tg_id, name, photo, updated_at) values (id, nm, ph, now())
    on conflict (tg_id) do update set name = excluded.name, photo = excluded.photo, updated_at = now();
  foreach per in array case when p_board = 'mastery' then array['all'] else array['all', public._week()] end loop
    insert into public.scores (tg_id, board, period, score) values (id, p_board, per, p_score)
      on conflict (tg_id, board, period) do update
      set score = greatest(public.scores.score, excluded.score), updated_at = now();
  end loop;
end $$;

create or replace function public.get_top(p_board text, p_period text default 'all', p_limit int default 50, p_me bigint default 0)
returns table (place bigint, name text, photo text, score bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by s.score desc, s.updated_at), p.name, p.photo, s.score, s.tg_id = p_me
  from public.scores s join public.players p on p.tg_id = s.tg_id
  where s.board = p_board and s.period = case when p_period = 'week' then public._week() else 'all' end
    and not p.banned and not p.top_ban
  order by s.score desc, s.updated_at
  limit least(greatest(p_limit, 1), 100)
$$;

create or replace function public.get_my_place(p_board text, p_period text, p_me bigint)
returns table (place bigint, score bigint, total bigint)
language sql stable security definer set search_path = public as $$
  with b as (select s.tg_id, s.score from public.scores s join public.players p on p.tg_id = s.tg_id
             where s.board = p_board and s.period = case when p_period = 'week' then public._week() else 'all' end
               and not p.banned and not p.top_ban)
  select (select count(*) from b where b.score > m.score) + 1, m.score, (select count(*) from b)
  from b m where m.tg_id = p_me
$$;

-- =====================================================================
--  Админ
-- =====================================================================

-- первый вошедший становится админом (пока админов нет). Возвращает: я админ?
create or replace function public.adm_claim(init_data text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare id bigint;
begin
  id := (public._tg_user(init_data)->>'id')::bigint;
  if not exists (select 1 from public.admins) then
    insert into public.admins (tg_id) values (id);
    perform public._log(id, 'Стал администратором', id, '{}');
  end if;
  return exists (select 1 from public.admins a where a.tg_id = id);
end $$;

create or replace function public.adm_stats(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; today date := (now() at time zone 'Europe/Moscow')::date;
begin
  a := public._adm(init_data);
  return jsonb_build_object(
    'total', (select count(*) from public.players),
    'online', (select count(*) from public.players where last_seen > now() - interval '5 minutes'),
    'dau', (select count(*) from public.active_days where day = today),
    'wau', (select count(distinct tg_id) from public.active_days where day > today - 7),
    'mau', (select count(distinct tg_id) from public.active_days where day > today - 30),
    'new_today', (select count(*) from public.players where (first_seen at time zone 'Europe/Moscow')::date = today),
    'new_week', (select count(*) from public.players where first_seen > now() - interval '7 days'),
    'banned', (select count(*) from public.players where banned),
    'ret1', (select round(100.0 * count(*) filter (where exists (select 1 from public.active_days d where d.tg_id = p.tg_id and d.day = (p.first_seen at time zone 'Europe/Moscow')::date + 1)) / nullif(count(*), 0))
             from public.players p where (p.first_seen at time zone 'Europe/Moscow')::date between today - 8 and today - 1),
    'avg_sessions', (select round(avg(sessions)::numeric, 1) from public.players where sessions > 0),
    'avg_play_min', (select round(avg(play_sec)::numeric / 60) from public.players where play_sec > 0),
    'days', (select jsonb_agg(jsonb_build_object('d', to_char(g, 'DD.MM'),
               'new', (select count(*) from public.players where (first_seen at time zone 'Europe/Moscow')::date = g::date),
               'act', (select count(*) from public.active_days where day = g::date)) order by g)
             from generate_series(today - 13, today, interval '1 day') g),
    'ranks', (select coalesce(jsonb_object_agg(rnk, c), '{}') from (select rnk, count(*) c from public.players group by rnk) r),
    'versions', (select coalesce(jsonb_object_agg(v, c), '{}') from (select coalesce(nullif(ver, ''), '?') v, count(*) c from public.players where last_seen > now() - interval '7 days' group by 1) r),
    'refs', (select count(*) from public.players where ref is not null),
    'mail_open', (select count(*) from public.mail where not deleted and (until is null or until > now()))
  );
end $$;

create or replace function public.adm_players(init_data text, p_q text default '', p_sort text default 'seen', p_filter text default '', p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; q text := lower(trim(coalesce(p_q, '')));
begin
  a := public._adm(init_data);
  return jsonb_build_object(
    'total', (select count(*) from public.players p where (q = '' or lower(p.name) like '%' || q || '%' or lower(p.username) like '%' || q || '%' or p.tg_id::text = q)
                and (p_filter = '' or (p_filter = 'banned' and p.banned) or (p_filter = 'online' and p.last_seen > now() - interval '5 minutes')
                     or (p_filter = 'new' and p.first_seen > now() - interval '1 day') or (p_filter = 'limited' and (p.top_ban or p.no_gift)))),
    'rows', coalesce((select jsonb_agg(r) from (
      select p.tg_id as id, p.name, p.username, p.photo, p.lvl, p.rnk, p.le, p.ess, p.ph, p.cr, p.mastery, p.sessions, p.play_sec,
             p.first_seen, p.last_seen, p.banned, p.top_ban, p.no_gift, p.ver, p.premium
      from public.players p
      where (q = '' or lower(p.name) like '%' || q || '%' or lower(p.username) like '%' || q || '%' or p.tg_id::text = q)
        and (p_filter = '' or (p_filter = 'banned' and p.banned) or (p_filter = 'online' and p.last_seen > now() - interval '5 minutes')
             or (p_filter = 'new' and p.first_seen > now() - interval '1 day') or (p_filter = 'limited' and (p.top_ban or p.no_gift)))
      order by
        case when p_sort = 'le' then p.le end desc nulls last,
        case when p_sort = 'cr' then p.cr end desc nulls last,
        case when p_sort = 'lvl' then p.lvl end desc nulls last,
        case when p_sort = 'new' then p.first_seen end desc nulls last,
        case when p_sort = 'play' then p.play_sec end desc nulls last,
        p.last_seen desc nulls last
      limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) r), '[]'));
end $$;

create or replace function public.adm_player(init_data text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; r jsonb;
begin
  a := public._adm(init_data);
  select to_jsonb(p) into r from public.players p where p.tg_id = p_id;
  if r is null then return null; end if;
  return r || jsonb_build_object(
    'scores', coalesce((select jsonb_agg(jsonb_build_object('board', board, 'period', period, 'score', score)) from public.scores where tg_id = p_id), '[]'),
    'mail', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'gift', m.gift, 'at', m.created_at,
                      'read', ms.read_at is not null, 'claimed', ms.claimed_at is not null) order by m.id desc)
                      from public.mail m left join public.mail_state ms on ms.mail_id = m.id and ms.tg_id = p_id
                      where m.to_tg = p_id and not m.deleted), '[]'),
    'patches', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'ops', x.ops, 'at', x.created_at, 'done', x.applied_at) order by x.id desc)
                      from (select * from public.patches where tg_id = p_id order by id desc limit 20) x), '[]'),
    'days', (select count(*) from public.active_days where tg_id = p_id),
    'invited', (select count(*) from public.players where ref = p_id),
    'ref_name', (select name from public.players where tg_id = (r->>'ref')::bigint));
end $$;

-- флаги и заметка: banned, ban_reason, top_ban, no_gift, note, name
create or replace function public.adm_set_player(init_data text, p_id bigint, f jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._adm(init_data);
  update public.players set
    banned = coalesce((f->>'banned')::boolean, banned),
    ban_reason = left(coalesce(f->>'ban_reason', ban_reason), 200),
    top_ban = coalesce((f->>'top_ban')::boolean, top_ban),
    no_gift = coalesce((f->>'no_gift')::boolean, no_gift),
    note = left(coalesce(f->>'note', note), 1000),
    name = left(coalesce(nullif(trim(f->>'name'), ''), name), 20)
  where tg_id = p_id;
  perform public._log(a, 'Изменил игрока', p_id, f);
end $$;

-- изменения сохранения: игра применит при следующем входе.
-- ops: add_cr, add_e, add_ess_h, set_cr, set_e, set_lvl, set_name, reset
create or replace function public.adm_patch(init_data text, p_id bigint, ops jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._adm(init_data);
  if jsonb_typeof(ops) <> 'object' or ops = '{}' then raise exception 'empty'; end if;
  insert into public.patches (tg_id, ops) values (p_id, ops);
  perform public._log(a, 'Правка сохранения', p_id, ops);
end $$;

create or replace function public.adm_patch_cancel(init_data text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; t bigint;
begin
  a := public._adm(init_data);
  delete from public.patches where id = p_id and applied_at is null returning tg_id into t;
  perform public._log(a, 'Отменил правку', t, jsonb_build_object('patch', p_id));
end $$;

create or replace function public.adm_score_delete(init_data text, p_id bigint, p_board text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._adm(init_data);
  delete from public.scores where tg_id = p_id and (p_board = 'all' or board = p_board);
  perform public._log(a, 'Удалил очки из топа', p_id, jsonb_build_object('board', p_board));
end $$;

-- письмо: p_to = 0 - всем
create or replace function public.adm_mail_send(init_data text, p_to bigint, p_title text, p_body text, p_gift jsonb default '{}', p_days int default 0)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; nid bigint; g jsonb := '{}';
begin
  a := public._adm(init_data);
  if trim(coalesce(p_title, '')) = '' then raise exception 'no title'; end if;
  if public._num(p_gift, 'cr') > 0 then g := g || jsonb_build_object('cr', least(100000, public._num(p_gift, 'cr')::int)); end if;
  if public._num(p_gift, 'ess_h') > 0 then g := g || jsonb_build_object('ess_h', least(1000, public._num(p_gift, 'ess_h'))); end if;
  insert into public.mail (to_tg, title, body, gift, until)
    values (nullif(p_to, 0), left(p_title, 80), left(coalesce(p_body, ''), 2000), g, case when p_days > 0 then now() + make_interval(days => p_days) end)
    returning id into nid;
  perform public._log(a, case when p_to = 0 then 'Письмо всем' else 'Письмо игроку' end, nullif(p_to, 0), jsonb_build_object('title', p_title, 'gift', g));
  return nid;
end $$;

create or replace function public.adm_mail_list(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._adm(init_data);
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'to', m.to_tg, 'to_name', p.name, 'title', m.title, 'body', m.body, 'gift', m.gift,
      'at', m.created_at, 'until', m.until,
      'read', (select count(*) from public.mail_state s where s.mail_id = m.id and s.read_at is not null),
      'claimed', (select count(*) from public.mail_state s where s.mail_id = m.id and s.claimed_at is not null)) order by m.id desc)
    from (select * from public.mail where not deleted order by id desc limit 100) m left join public.players p on p.tg_id = m.to_tg), '[]');
end $$;

create or replace function public.adm_mail_delete(init_data text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._adm(init_data);
  update public.mail set deleted = true where id = p_id;
  perform public._log(a, 'Удалил письмо', null, jsonb_build_object('mail', p_id));
end $$;

-- настройки игры: announce {id,title,text}, boost {mult,until}, maint {on,text}. v = null - удалить
create or replace function public.adm_setting(init_data text, p_k text, p_v jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._adm(init_data);
  if p_k not in ('announce', 'boost', 'maint') then raise exception 'bad key'; end if;
  if p_v is null or p_v = 'null'::jsonb then delete from public.settings where k = p_k;
  else insert into public.settings (k, v, updated_at) values (p_k, p_v, now()) on conflict (k) do update set v = excluded.v, updated_at = now();
  end if;
  perform public._log(a, 'Настройка ' || p_k, null, coalesce(p_v, 'null'::jsonb));
end $$;

create or replace function public.adm_settings(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._adm(init_data);
  return coalesce((select jsonb_object_agg(k, v) from public.settings), '{}');
end $$;

create or replace function public.adm_log(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._adm(init_data);
  return coalesce((select jsonb_agg(jsonb_build_object('at', l.at, 'action', l.action, 'target', l.target, 'name', p.name, 'details', l.details) order by l.id desc)
    from (select * from public.admin_log order by id desc limit 150) l left join public.players p on p.tg_id = l.target), '[]');
end $$;

-- ---------- доступ ----------
revoke execute on function public._num(jsonb, text, double precision) from public, anon, authenticated;
revoke execute on function public._adm(text) from public, anon, authenticated;
revoke execute on function public._log(bigint, text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.hello(text, jsonb) to anon, authenticated;
grant execute on function public.patch_done(text, bigint) to anon, authenticated;
grant execute on function public.mail_list(text) to anon, authenticated;
grant execute on function public.mail_read(text, bigint) to anon, authenticated;
grant execute on function public.mail_claim(text, bigint) to anon, authenticated;
grant execute on function public.submit_score(text, text, bigint, text, text) to anon, authenticated;
grant execute on function public.get_top(text, text, int, bigint) to anon, authenticated;
grant execute on function public.get_my_place(text, text, bigint) to anon, authenticated;
grant execute on function public.adm_claim(text) to anon, authenticated;
grant execute on function public.adm_stats(text) to anon, authenticated;
grant execute on function public.adm_players(text, text, text, text, int, int) to anon, authenticated;
grant execute on function public.adm_player(text, bigint) to anon, authenticated;
grant execute on function public.adm_set_player(text, bigint, jsonb) to anon, authenticated;
grant execute on function public.adm_patch(text, bigint, jsonb) to anon, authenticated;
grant execute on function public.adm_patch_cancel(text, bigint) to anon, authenticated;
grant execute on function public.adm_score_delete(text, bigint, text) to anon, authenticated;
grant execute on function public.adm_mail_send(text, bigint, text, text, jsonb, int) to anon, authenticated;
grant execute on function public.adm_mail_list(text) to anon, authenticated;
grant execute on function public.adm_mail_delete(text, bigint) to anon, authenticated;
grant execute on function public.adm_setting(text, text, jsonb) to anon, authenticated;
grant execute on function public.adm_settings(text) to anon, authenticated;
grant execute on function public.adm_log(text) to anon, authenticated;

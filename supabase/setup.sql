-- =====================================================================
--  Бульк - база для рейтингов (Supabase). Вставить целиком в SQL Editor и нажать Run.
--  Игроки пишут очки только через функцию submit_score: она проверяет подпись
--  Telegram (initData), поэтому подделать чужие или накрученные очки «снаружи» нельзя.
--  Токен бота хранится в закрытой таблице, наружу не виден.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- закрытые настройки (токен бота) ----------
create table if not exists public.private_secrets (k text primary key, v text not null);
alter table public.private_secrets enable row level security;
revoke all on public.private_secrets from anon, authenticated;

-- ---------- игроки и очки ----------
create table if not exists public.players (
  tg_id bigint primary key,
  name text not null default '',
  photo text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists public.scores (
  tg_id bigint not null references public.players(tg_id) on delete cascade,
  board text not null,          -- mastery | match3
  period text not null,         -- all | 2026-W42 (неделя)
  score bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tg_id, board, period)
);
create index if not exists scores_top on public.scores (board, period, score desc);
alter table public.players enable row level security;
alter table public.scores enable row level security;
revoke all on public.players from anon, authenticated;
revoke all on public.scores from anon, authenticated;

-- ---------- служебное: раскодировать %XX ----------
create or replace function public._urldecode(t text) returns text
language plpgsql immutable as $$
declare r bytea := ''::bytea; i int := 1; n int := length(t); c text;
begin
  while i <= n loop
    c := substr(t, i, 1);
    if c = '%' and i + 2 <= n then r := r || decode(substr(t, i + 1, 2), 'hex'); i := i + 3;
    elsif c = '+' then r := r || convert_to(' ', 'UTF8'); i := i + 1;
    else r := r || convert_to(c, 'UTF8'); i := i + 1;
    end if;
  end loop;
  return convert_from(r, 'UTF8');
end $$;

-- ---------- проверка подписи Telegram, возвращает user (json) ----------
create or replace function public._tg_user(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  token text; kv text; k text; v text; h text; dcs text; arr text[] := '{}';
  secret bytea; calc text; auth bigint := 0; u jsonb;
begin
  select s.v into token from public.private_secrets s where s.k = 'tg_bot_token';
  if token is null then raise exception 'no bot token'; end if;
  foreach kv in array string_to_array(coalesce(init_data, ''), '&') loop
    k := split_part(kv, '=', 1);
    v := public._urldecode(substr(kv, length(k) + 2));
    if k = 'hash' then h := v;
    else arr := arr || (k || '=' || v);
    end if;
    if k = 'auth_date' then auth := v::bigint; end if;
    if k = 'user' then u := v::jsonb; end if;
  end loop;
  select string_agg(x, E'\n' order by x collate "C") into dcs from unnest(arr) as x;
  secret := extensions.hmac(convert_to(token, 'UTF8'), convert_to('WebAppData', 'UTF8'), 'sha256');
  calc := encode(extensions.hmac(convert_to(dcs, 'UTF8'), secret, 'sha256'), 'hex');
  if h is null or calc <> h then raise exception 'bad signature'; end if;
  if auth < extract(epoch from now()) - 7 * 86400 then raise exception 'too old'; end if;
  if u is null or (u->>'id') is null then raise exception 'no user'; end if;
  return u;
end $$;

create or replace function public._week() returns text
language sql stable as $$ select to_char(now() at time zone 'Europe/Moscow', 'IYYY-"W"IW') $$;

-- ---------- записать очки (берётся лучший результат) ----------
create or replace function public.submit_score(init_data text, p_board text, p_score bigint, p_name text default '')
returns void language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb; id bigint; nm text; per text;
begin
  if p_board not in ('mastery', 'match3') then raise exception 'bad board'; end if;
  if p_score is null or p_score < 0 or p_score > 1e15 then raise exception 'bad score'; end if;
  if p_board = 'match3' and p_score > 200000 then raise exception 'bad score'; end if;
  u := public._tg_user(init_data);
  id := (u->>'id')::bigint;
  nm := left(trim(coalesce(nullif(p_name, ''), u->>'first_name', 'Алхимик')), 20);
  insert into public.players (tg_id, name, photo, updated_at)
    values (id, nm, coalesce(u->>'photo_url', ''), now())
    on conflict (tg_id) do update set name = excluded.name, photo = excluded.photo, updated_at = now();
  foreach per in array case when p_board = 'mastery' then array['all'] else array['all', public._week()] end loop
    insert into public.scores (tg_id, board, period, score) values (id, p_board, per, p_score)
      on conflict (tg_id, board, period) do update
      set score = greatest(public.scores.score, excluded.score), updated_at = now();
  end loop;
end $$;

-- ---------- топ (имя, фото, очки; me - чтобы подсветить себя) ----------
create or replace function public.get_top(p_board text, p_period text default 'all', p_limit int default 50, p_me bigint default 0)
returns table (place bigint, name text, photo text, score bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by s.score desc, s.updated_at) as place, p.name, p.photo, s.score, s.tg_id = p_me
  from public.scores s join public.players p on p.tg_id = s.tg_id
  where s.board = p_board and s.period = case when p_period = 'week' then public._week() else 'all' end
  order by s.score desc, s.updated_at
  limit least(greatest(p_limit, 1), 100)
$$;

-- ---------- моё место ----------
create or replace function public.get_my_place(p_board text, p_period text, p_me bigint)
returns table (place bigint, score bigint, total bigint)
language sql stable security definer set search_path = public as $$
  with b as (select s.tg_id, s.score from public.scores s
             where s.board = p_board and s.period = case when p_period = 'week' then public._week() else 'all' end)
  select (select count(*) from b where b.score > m.score) + 1, m.score, (select count(*) from b)
  from b m where m.tg_id = p_me
$$;

-- доступ снаружи - только к трём функциям
revoke execute on function public._urldecode(text) from public, anon, authenticated;
revoke execute on function public._tg_user(text) from public, anon, authenticated;
grant execute on function public.submit_score(text, text, bigint, text) to anon, authenticated;
grant execute on function public.get_top(text, text, int, bigint) to anon, authenticated;
grant execute on function public.get_my_place(text, text, bigint) to anon, authenticated;

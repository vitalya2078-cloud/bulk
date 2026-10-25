-- update23 (0.33.0): новые топы.
--  * Лига недели: очки - звёздные чернила за дела (игра копит их в s.lg.pts, растут только вверх).
--    Пять лиг: 0 Медная, 1 Серебряная, 2 Золотая, 3 Звёздная, 4 Лунная. Неделя - по Москве (как _keys()).
--    Итоги недели считает league_finalize() по расписанию (понедельник 00:05 МСК):
--    места, повышение и понижение, награды письмом (кристаллы и сундуки).
--  * Мастерство: players.mastery (игра считает по уровню, рангу, рецептам, диковинкам, питомцам).
--  * Рекорды мини-игр: players.mg { match3, memory }.
--  Функция hello не меняется: очки лиги и рекорды приходят отдельным вызовом league_put.
--  Старая top_list остаётся для игроков со старой версией игры.

alter table public.players add column if not exists lp bigint not null default 0;        -- очки лиги за всё время
alter table public.players add column if not exists lp_week bigint;                       -- сколько было в начале недели lp_wk
alter table public.players add column if not exists lp_wk text;                           -- неделя, к которой относится lp_week
alter table public.players add column if not exists lp_at timestamptz;                    -- когда очки последний раз приходили
alter table public.players add column if not exists league smallint not null default 0;
alter table public.players add column if not exists mg jsonb not null default '{}';

-- итоги недель: одна строка на игрока и неделю
create table if not exists public.league_hist (
  week_key text not null,
  tg_id bigint not null,
  league smallint not null default 0,
  score bigint not null default 0,
  place int,                 -- место в своей лиге (null - не участвовал: 0 очков или скрыт из топов)
  members int,               -- сколько участников было в лиге
  new_league smallint,       -- лига на следующую неделю
  gift jsonb,                -- что отправлено письмом
  done_at timestamptz,
  primary key (week_key, tg_id)
);
alter table public.league_hist enable row level security;

-- ---------- правила лиги ----------
-- сколько поднимается и опускается при n участниках
create or replace function public._league_rules(n int, OUT up int, OUT down int)
language sql immutable as $$
  select case when n <= 0 then 0 else least(5, greatest(1, round(n * 0.3)::int)) end,
         case when n >= 5 then greatest(1, floor(n * 0.2)::int) else 0 end
$$;
-- минимум очков за неделю, чтобы получить награду и подняться
create or replace function public._league_min() returns int language sql immutable as $$ select 100 $$;
-- награда за место: кристаллы (по лиге больше) и сундук для тройки
create or replace function public._league_gift(lg int, place int) returns jsonb
language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'cr', round((case when place = 1 then 20 when place = 2 then 15 when place = 3 then 10 when place <= 10 then 6 else 3 end)
                * (array[1, 1.25, 1.5, 2, 2.5])[least(greatest(lg, 0), 4) + 1])::int,
    'chest', case when place = 1 then (case when lg >= 2 then 'g' else 's' end)
                  when place = 2 then (case when lg >= 3 then 'g' else 's' end)
                  when place = 3 then (case when lg >= 2 then 's' else 'w' end) end))
$$;
create or replace function public._league_name(lg int) returns text language sql immutable as $$
  select (array['Медная', 'Серебряная', 'Золотая', 'Звёздная', 'Лунная'])[least(greatest(lg, 0), 4) + 1]
$$;
-- конец текущей недели (понедельник 00:00 по Москве), секунд осталось
create or replace function public._week_left() returns int language sql stable as $$
  select extract(epoch from ((date_trunc('week', now() at time zone 'Europe/Moscow') + interval '7 days') at time zone 'Europe/Moscow') - now())::int
$$;

-- ---------- игра присылает очки лиги и рекорды ----------
-- p: { lp: очки за всё время, mg: { match3, memory } }
create or replace function public.league_put(init_data text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; pl public.players; wk text := (public._keys())[2]; nlp bigint; allow double precision; m jsonb;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into pl from public.players where tg_id = me for update;
  if not found then return null; end if;
  p := coalesce(p, '{}');
  -- новая неделя: прошлую записываем в итоги, точка отсчёта - очки на конец прошлой
  if pl.lp_wk is distinct from wk then
    if pl.lp_wk is not null then
      insert into public.league_hist (week_key, tg_id, league, score)
        values (pl.lp_wk, me, pl.league, greatest(0, pl.lp - coalesce(pl.lp_week, pl.lp)))
        on conflict do nothing;
    end if;
    pl.lp_week := pl.lp; pl.lp_wk := wk;
  end if;
  -- очки только растут и не быстрее, чем реально заработать (лишнее придёт со следующими отчётами)
  nlp := greatest(pl.lp, least(1e12, public._num(p, 'lp', pl.lp))::bigint);
  allow := 1500 + least(extract(epoch from now() - coalesce(pl.lp_at, now() - interval '1 hour')) / 3600.0, 168) * 900;
  nlp := least(nlp, pl.lp + allow::bigint);
  -- рекорды мини-игр: максимум из старого и нового, с потолком
  m := coalesce(pl.mg, '{}');
  if jsonb_typeof(p->'mg') = 'object' then
    m := m || jsonb_build_object(
      'match3', greatest(coalesce((m->>'match3')::bigint, 0), least(60000, greatest(0, public._num(p->'mg', 'match3', 0)))::bigint),
      'memory', greatest(coalesce((m->>'memory')::bigint, 0), least(3500, greatest(0, public._num(p->'mg', 'memory', 0)))::bigint));
  end if;
  update public.players set lp = nlp, lp_week = pl.lp_week, lp_wk = pl.lp_wk, lp_at = now(), mg = m where tg_id = me;
  return jsonb_build_object('lp', nlp, 'week', nlp - coalesce(pl.lp_week, nlp), 'league', pl.league);
end $$;

-- ---------- топы ----------
-- p_board: league | mastery | match3 | memory
create or replace function public.top2(p_board text, p_limit int default 50, p_me bigint default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare wk text := (public._keys())[2]; lg int := 0; lim int := least(greatest(p_limit, 1), 100); res jsonb; n int; r record;
begin
  if p_board = 'league' then
    select league into lg from public.players where tg_id = p_me;
    lg := coalesce(lg, 0);
    with b as (
      select tg_id, name, photo, case when lp_wk = wk then greatest(0, lp - coalesce(lp_week, lp)) else 0 end as score
      from public.players
      where league = lg and not banned and not top_ban and not top_hold and last_seen is not null),
    rk as (select b.*, row_number() over (order by score desc, tg_id) as place from b where score > 0)
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(jsonb_build_object('place', place, 'name', name, 'photo', photo, 'score', score, 'is_me', tg_id = p_me) order by place) from rk where place <= lim), '[]'),
      'me', (select jsonb_build_object('place', place, 'score', score) from rk where tg_id = p_me),
      'total', (select count(*) from rk)) into res;
    n := coalesce((res->>'total')::int, 0);
    select * into r from public._league_rules(n);
    return res || jsonb_build_object('league', lg, 'name', public._league_name(lg), 'up', case when lg >= 4 then 0 else r.up end,
      'down', case when lg <= 0 then 0 else r.down end, 'min', public._league_min(), 'left', public._week_left(),
      'gifts', jsonb_build_array(public._league_gift(lg, 1), public._league_gift(lg, 2), public._league_gift(lg, 3), public._league_gift(lg, 4), public._league_gift(lg, 11)),
      'last', (select jsonb_build_object('week', h.week_key, 'place', h.place, 'members', h.members, 'league', h.league, 'new_league', h.new_league, 'score', h.score, 'gift', h.gift)
               from public.league_hist h where h.tg_id = p_me and h.done_at is not null order by h.week_key desc limit 1));
  end if;
  with b as (
    select tg_id, name, photo,
      case p_board when 'mastery' then mastery when 'match3' then coalesce((mg->>'match3')::bigint, 0) when 'memory' then coalesce((mg->>'memory')::bigint, 0) else 0 end as score,
      league
    from public.players where not banned and not top_ban and not top_hold and last_seen is not null),
  rk as (select b.*, row_number() over (order by score desc, tg_id) as place from b where score > 0)
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('place', place, 'name', name, 'photo', photo, 'score', score, 'league', league, 'is_me', tg_id = p_me) order by place) from rk where place <= lim), '[]'),
    'me', (select jsonb_build_object('place', place, 'score', score) from rk where tg_id = p_me),
    'total', (select count(*) from rk)) into res;
  return res;
end $$;

-- ---------- итоги недели ----------
-- Считает прошлую неделю (или p_week). Можно запускать повторно: уже посчитанное не трогает.
create or replace function public.league_finalize(p_week text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare wk text := coalesce(p_week, to_char((now() at time zone 'Europe/Moscow') - interval '1 day', 'IYYY-"W"IW'));
        lg int; n int; up int; down int; x record; nl int; g jsonb; sent int := 0; moved int := 0;
begin
  if wk = (public._keys())[2] then raise exception 'неделя % ещё идёт', wk; end if;
  if exists (select 1 from public.league_hist where week_key = wk and done_at is not null) then
    return jsonb_build_object('week', wk, 'skip', 'уже посчитано');
  end if;
  -- кто играл на той неделе и ещё не заходил на этой - дописываем из players
  insert into public.league_hist (week_key, tg_id, league, score)
    select wk, tg_id, league, greatest(0, lp - coalesce(lp_week, lp)) from public.players where lp_wk = wk
    on conflict do nothing;
  for lg in 0..4 loop
    -- места среди участников (не скрытых из топов, с очками)
    with rk as (
      select h.tg_id, row_number() over (order by h.score desc, h.tg_id) pl, count(*) over () cnt
      from public.league_hist h join public.players p on p.tg_id = h.tg_id
      where h.week_key = wk and h.league = lg and h.score > 0 and not p.banned and not p.top_ban and not p.top_hold)
    update public.league_hist h set place = rk.pl, members = rk.cnt from rk where h.week_key = wk and h.tg_id = rk.tg_id;
    select count(*) into n from public.league_hist where week_key = wk and league = lg and place is not null;
    select r.up, r.down into up, down from public._league_rules(n) r;
    for x in select * from public.league_hist where week_key = wk and league = lg loop
      nl := lg;
      if x.place is null then nl := greatest(0, lg - 1);                                   -- не набрал очков - вниз
      elsif x.place <= up and x.score >= public._league_min() and lg < 4 then nl := lg + 1;
      elsif down > 0 and x.place > n - down and lg > 0 then nl := lg - 1;
      end if;
      g := case when x.place is not null and x.score >= public._league_min() then public._league_gift(lg, x.place) end;
      update public.league_hist set new_league = nl, gift = g, done_at = now() where week_key = wk and tg_id = x.tg_id;
      update public.players set league = nl where tg_id = x.tg_id and league = lg;
      if nl <> lg then moved := moved + 1; end if;
      if g is not null then
        insert into public.mail (to_tg, title, body, gift, until)
          values (x.tg_id, 'Лига недели: ' || x.place || ' место',
                  public._league_name(lg) || ' лига, ' || x.place || ' место из ' || n || '. Звёздных чернил за неделю: ' || x.score || '.'
                  || case when nl > lg then ' Ты поднимаешься в ' || public._league_name(nl) || ' лигу!'
                          when nl < lg then ' На этой неделе - ' || public._league_name(nl) || ' лига.' else '' end
                  || ' Награда в письме.',
                  g, now() + interval '21 days');
        sent := sent + 1;
      end if;
    end loop;
  end loop;
  -- совсем пропавшие (не играли всю неделю) - на лигу ниже
  update public.players set league = league - 1 where league > 0 and (lp_wk is null or lp_wk < wk)
    and not exists (select 1 from public.league_hist h where h.week_key = wk and h.tg_id = players.tg_id);
  return jsonb_build_object('week', wk, 'mail', sent, 'moved', moved);
end $$;

revoke all on function public.league_finalize(text) from public, anon, authenticated;
grant execute on function public.league_put(text, jsonb) to anon, authenticated;
grant execute on function public.top2(text, int, bigint) to anon, authenticated;

-- каждый понедельник в 00:05 по Москве (21:05 UTC воскресенья)
select cron.schedule('bulk_league', '5 21 * * 0', 'select public.league_finalize()');

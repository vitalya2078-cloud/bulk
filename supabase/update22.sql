-- update22 (0.27.0): удержание для админки - когорты по дню прихода и где игроки уходят.
-- Данные: players.first_seen / last_seen / sessions / play_sec / rnk и active_days (день активности, Москва).

create or replace function public.adm_retention(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; today date := (now() at time zone 'Europe/Moscow')::date;
begin
  a := public._adm(init_data);
  return jsonb_build_object(
    -- когорты: пришли в день g; доля вернувшихся на 1, 3, 7, 14 день (null - день ещё не наступил)
    'cohorts', (select coalesce(jsonb_agg(jsonb_build_object('d', to_char(g.day, 'DD.MM'), 'n', g.n,
        'r1',  case when g.day + 1  <= today and g.n > 0 then round(100.0 * g.k1  / g.n) end,
        'r3',  case when g.day + 3  <= today and g.n > 0 then round(100.0 * g.k3  / g.n) end,
        'r7',  case when g.day + 7  <= today and g.n > 0 then round(100.0 * g.k7  / g.n) end,
        'r14', case when g.day + 14 <= today and g.n > 0 then round(100.0 * g.k14 / g.n) end) order by g.day desc), '[]')
      from (select s.day, count(p.tg_id) n,
              count(p.tg_id) filter (where exists (select 1 from public.active_days d where d.tg_id = p.tg_id and d.day >= s.day + 1)) k1,
              count(p.tg_id) filter (where exists (select 1 from public.active_days d where d.tg_id = p.tg_id and d.day >= s.day + 3)) k3,
              count(p.tg_id) filter (where exists (select 1 from public.active_days d where d.tg_id = p.tg_id and d.day >= s.day + 7)) k7,
              count(p.tg_id) filter (where exists (select 1 from public.active_days d where d.tg_id = p.tg_id and d.day >= s.day + 14)) k14
            from (select generate_series(today - 20, today - 1, interval '1 day')::date as day) s
            left join public.players p on (p.first_seen at time zone 'Europe/Moscow')::date = s.day
            group by s.day) g),
    'avg', jsonb_build_object(
      'r1', (select round(100.0 * count(*) filter (where exists (select 1 from public.active_days d where d.tg_id = p.tg_id and d.day >= (p.first_seen at time zone 'Europe/Moscow')::date + 1)) / nullif(count(*), 0))
             from public.players p where (p.first_seen at time zone 'Europe/Moscow')::date between today - 30 and today - 1),
      'r7', (select round(100.0 * count(*) filter (where exists (select 1 from public.active_days d where d.tg_id = p.tg_id and d.day >= (p.first_seen at time zone 'Europe/Moscow')::date + 7)) / nullif(count(*), 0))
             from public.players p where (p.first_seen at time zone 'Europe/Moscow')::date between today - 37 and today - 7),
      'days', (select round(avg(c)::numeric, 1) from (select count(*) c from public.active_days group by tg_id) t)),
    -- ушедшие: не заходили 3+ дня
    'gone', (select count(*) from public.players where last_seen < now() - interval '3 days'),
    'gone_one', (select count(*) from public.players where last_seen < now() - interval '3 days' and coalesce(sessions, 0) <= 1),
    'gone_rank', (select coalesce(jsonb_object_agg(rnk, c), '{}') from (select coalesce(rnk, 0) rnk, count(*) c from public.players where last_seen < now() - interval '3 days' group by 1) r),
    'gone_time', (select jsonb_build_array(
        count(*) filter (where coalesce(play_sec, 0) < 120),
        count(*) filter (where play_sec >= 120 and play_sec < 600),
        count(*) filter (where play_sec >= 600 and play_sec < 1800),
        count(*) filter (where play_sec >= 1800 and play_sec < 7200),
        count(*) filter (where play_sec >= 7200))
      from public.players where last_seen < now() - interval '3 days')
  );
end $$;
grant execute on function public.adm_retention(text) to anon, authenticated;

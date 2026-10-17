-- =====================================================================
--  Бульк 0.18 - ковены: задание недели и босс выходных.
--  Награды приходят письмами в почту игры.
--  Вставить целиком в SQL Editor -> Run (на предупреждение - Run query). Можно запускать повторно.
-- =====================================================================

alter table public.coven_members add column if not exists last_taps bigint;
alter table public.coven_members add column if not exists last_brewed bigint;
alter table public.coven_members add column if not exists last_served bigint;
alter table public.coven_members add column if not exists q_val double precision not null default 0;
alter table public.coven_members add column if not exists q_key text not null default '';

create table if not exists public.coven_week (
  coven_id bigint not null references public.covens(id) on delete cascade,
  week_key text not null,
  qtype text not null,                 -- taps | brew | serve | play
  target double precision not null,
  progress double precision not null default 0,
  done boolean not null default false,
  primary key (coven_id, week_key)
);
create table if not exists public.coven_boss (
  coven_id bigint not null references public.covens(id) on delete cascade,
  week_key text not null,
  boss text not null,
  max_hp double precision not null,
  hp double precision not null,
  dead boolean not null default false,
  killed_at timestamptz,
  primary key (coven_id, week_key)
);
create table if not exists public.boss_hits (
  coven_id bigint not null,
  week_key text not null,
  uid bigint not null,
  dmg double precision not null default 0,
  last_at timestamptz not null default now(),
  primary key (coven_id, week_key, uid)
);
do $$ declare t text; begin
  foreach t in array array['coven_week','coven_boss','boss_hits'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------- задание недели ----------
create or replace function public._coven_quest(c bigint) returns public.coven_week
language plpgsql security definer set search_path = public as $$
declare wk text := (public._keys())[2]; q public.coven_week; n int; t text;
begin
  select * into q from public.coven_week where coven_id = c and week_key = wk;
  if found then return q; end if;
  n := greatest(3, (select count(*) from public.coven_members where coven_id = c));
  t := (array['taps', 'brew', 'serve', 'play'])[1 + (abs(hashtext(wk || ':' || c)) % 4)];
  insert into public.coven_week (coven_id, week_key, qtype, target)
    values (c, wk, t, n * case t when 'taps' then 3000 when 'brew' then 12 when 'serve' then 8 else 90 end)
    on conflict do nothing;
  select * into q from public.coven_week where coven_id = c and week_key = wk;
  return q;
end $$;

-- добавить к заданию; при выполнении - письма с наградой всем, кто помогал
create or replace function public._coven_quest_add(c bigint, me bigint, t text, d double precision) returns void
language plpgsql security definer set search_path = public as $$
declare q public.coven_week; wk text := (public._keys())[2]; cname text;
begin
  if d <= 0 then return; end if;
  q := public._coven_quest(c);
  if q.qtype <> t or q.done then return; end if;
  update public.coven_members set q_val = case when q_key = wk then q_val + d else d end, q_key = wk where uid = me;
  update public.coven_week set progress = progress + d where coven_id = c and week_key = wk returning * into q;
  if q.progress >= q.target and not q.done then
    update public.coven_week set done = true where coven_id = c and week_key = wk;
    select name into cname from public.covens where id = c;
    perform public._coven_sys(c, '🏆 Задание недели выполнено! Награда - в почте у всех, кто помогал');
    insert into public.mail (to_tg, title, body, gift, until)
      select m.uid, 'Задание ковена выполнено!', 'Ковен «' || cname || '» справился с заданием недели. Спасибо за помощь!',
             jsonb_build_object('cr', 10, 'ess_h', 4), now() + interval '14 days'
      from public.coven_members m where m.coven_id = c and m.q_key = wk and m.q_val > 0;
  end if;
end $$;

-- игра присылает свои счётчики (всего тапов, зелий, обслуженных жителей) - база считает прирост
create or replace function public.coven_progress(init_data text, p_taps bigint, p_brewed bigint, p_served bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; m public.coven_members;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into m from public.coven_members where uid = me;
  if not found then return; end if;
  if m.last_taps is not null then
    perform public._coven_quest_add(m.coven_id, me, 'taps', least(greatest(p_taps - m.last_taps, 0), 30000));
    perform public._coven_quest_add(m.coven_id, me, 'brew', least(greatest(p_brewed - m.last_brewed, 0), 300));
    perform public._coven_quest_add(m.coven_id, me, 'serve', least(greatest(p_served - m.last_served, 0), 100));
  end if;
  update public.coven_members set last_taps = greatest(coalesce(last_taps, 0), p_taps), last_brewed = greatest(coalesce(last_brewed, 0), p_brewed),
    last_served = greatest(coalesce(last_served, 0), p_served) where uid = me;
end $$;

-- время в игре тоже идёт в задание «play» (дополняем триггер вклада)
create or replace function public._coven_tick() returns trigger
language plpgsql security definer set search_path = public as $$
declare d double precision; m public.coven_members; wk text := (public._keys())[2]; lv0 int; lv1 int; cx double precision;
begin
  d := least(greatest(new.play_sec - old.play_sec, 0), 900) / 60.0;
  if d <= 0 then return new; end if;
  select * into m from public.coven_members where uid = new.tg_id;
  if not found then return new; end if;
  update public.coven_members set contrib = contrib + d,
    week = case when week_key = wk then week + d else d end, week_key = wk
  where uid = new.tg_id;
  select xp into cx from public.covens where id = m.coven_id;
  lv0 := public._coven_level(cx);
  update public.covens set xp = xp + d,
    week_xp = case when week_key = wk then week_xp + d else d end, week_key = wk
  where id = m.coven_id returning xp into cx;
  lv1 := public._coven_level(cx);
  if lv1 > lv0 then perform public._coven_sys(m.coven_id, '🎉 Ковен достиг уровня ' || lv1 || '! Бонус к доходу: +' || (lv1 - 1) * 2 || '%'); end if;
  perform public._coven_quest_add(m.coven_id, new.tg_id, 'play', d);
  return new;
end $$;

-- ---------- босс выходных (пятница-воскресенье по Москве) ----------
create or replace function public._boss_open() returns boolean
language sql stable as $$
  select extract(isodow from now() at time zone 'Europe/Moscow') >= 5
      or coalesce((select (v->>'on')::boolean from public.settings where k = 'boss_test'), false)
$$;

create or replace function public._boss(c bigint) returns public.coven_boss
language plpgsql security definer set search_path = public as $$
declare wk text := (public._keys())[2]; b public.coven_boss; n int; lv int;
begin
  select * into b from public.coven_boss where coven_id = c and week_key = wk;
  if found or not public._boss_open() then return b; end if;
  n := greatest(3, (select count(*) from public.coven_members where coven_id = c));
  lv := public._coven_level((select xp from public.covens where id = c));
  insert into public.coven_boss (coven_id, week_key, boss, max_hp, hp)
    values (c, wk, (array['cauldron', 'swamp', 'pumpkin', 'frost'])[1 + ((substr(wk, 7)::int) % 4)],
            n * 6000 * (1 + (lv - 1) * 0.15), n * 6000 * (1 + (lv - 1) * 0.15))
    on conflict do nothing;
  select * into b from public.coven_boss where coven_id = c and week_key = wk;
  return b;
end $$;

create or replace function public.boss_state(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; m public.coven_members; b public.coven_boss; wk text := (public._keys())[2];
        msk timestamp := now() at time zone 'Europe/Moscow'; nxt timestamp; ends timestamp;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into m from public.coven_members where uid = me;
  if not found then return null; end if;
  b := public._boss(m.coven_id);
  nxt := date_trunc('week', msk) + interval '4 days';           -- пятница этой недели 00:00
  ends := date_trunc('week', msk) + interval '7 days';          -- понедельник 00:00
  return jsonb_build_object(
    'open', public._boss_open(), 'starts_in', greatest(0, extract(epoch from nxt - msk)), 'ends_in', greatest(0, extract(epoch from ends - msk)),
    'boss', b.boss, 'hp', b.hp, 'max_hp', b.max_hp, 'dead', coalesce(b.dead, false),
    'next', (array['cauldron', 'swamp', 'pumpkin', 'frost'])[1 + ((substr(wk, 7)::int) % 4)],
    'mine', coalesce((select dmg from public.boss_hits where coven_id = m.coven_id and week_key = wk and uid = me), 0),
    'top', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'photo', p.photo, 'dmg', x.dmg, 'me', x.uid = me) order by x.dmg desc)
      from (select * from public.boss_hits where coven_id = m.coven_id and week_key = wk order by dmg desc limit 10) x
      left join public.players p on p.tg_id = x.uid), '[]'));
end $$;

-- удар: p_n тапов с прошлой отправки. База не даёт больше 12 ударов в секунду.
create or replace function public.boss_hit(init_data text, p_n int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; m public.coven_members; b public.coven_boss; wk text := (public._keys())[2]; h public.boss_hits;
        allow double precision; d double precision; mult double precision; cname text; i int;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into m from public.coven_members where uid = me;
  if not found then raise exception 'no coven'; end if;
  if not public._boss_open() then raise exception 'closed'; end if;
  b := public._boss(m.coven_id);
  if b.dead then return jsonb_build_object('hp', 0, 'dead', true, 'dmg', 0); end if;
  insert into public.boss_hits (coven_id, week_key, uid, dmg, last_at) values (m.coven_id, wk, me, 0, now() - interval '3 seconds') on conflict do nothing;
  select * into h from public.boss_hits where coven_id = m.coven_id and week_key = wk and uid = me;
  allow := least(extract(epoch from now() - h.last_at), 10) * 12;
  mult := 1 + (public._coven_level((select xp from public.covens where id = m.coven_id)) - 1) * 0.1;
  d := least(greatest(coalesce(p_n, 0), 0), allow) * mult;
  if d <= 0 then return jsonb_build_object('hp', b.hp, 'dead', false, 'dmg', 0); end if;
  update public.boss_hits set dmg = dmg + d, last_at = now() where coven_id = m.coven_id and week_key = wk and uid = me;
  update public.coven_boss set hp = greatest(0, hp - d) where coven_id = m.coven_id and week_key = wk and not dead returning * into b;
  if b.hp <= 0 and not b.dead then
    update public.coven_boss set dead = true, killed_at = now() where coven_id = m.coven_id and week_key = wk;
    select name into cname from public.covens where id = m.coven_id;
    perform public._coven_sys(m.coven_id, '⚔️ Босс повержен! Сундуки - в почте у всех, кто сражался');
    i := 0;
    for h in select * from public.boss_hits where coven_id = m.coven_id and week_key = wk and dmg > 0 order by dmg desc loop
      i := i + 1;
      insert into public.mail (to_tg, title, body, gift, until) values (h.uid,
        case when i <= 3 then 'Сундук героя (место ' || i || ')' else 'Сундук за победу над боссом' end,
        'Ковен «' || cname || '» победил босса выходных!' || case when i <= 3 then ' Ты в тройке самых сильных бойцов.' else ' Спасибо за помощь в битве.' end,
        jsonb_build_object('cr', case i when 1 then 40 when 2 then 30 when 3 then 25 else 15 end, 'ess_h', case when i <= 3 then 10 else 6 end), now() + interval '14 days');
    end loop;
    return jsonb_build_object('hp', 0, 'dead', true, 'dmg', d);
  end if;
  return jsonb_build_object('hp', b.hp, 'dead', false, 'dmg', d);
end $$;

-- мой ковен: + задание недели и короткое состояние босса
create or replace function public.coven_me(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; m public.coven_members; c public.covens; wk text := (public._keys())[2]; q public.coven_week; b public.coven_boss;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into m from public.coven_members where uid = me;
  if not found then return jsonb_build_object('coven', null,
    'requests', coalesce((select jsonb_agg(coven_id) from public.coven_requests where uid = me), '[]')); end if;
  select * into c from public.covens where id = m.coven_id;
  q := public._coven_quest(c.id);
  b := public._boss(c.id);
  return jsonb_build_object(
    'coven', public._coven_json(c, (select count(*) from public.coven_members where coven_id = c.id)),
    'role', m.role, 'me', me,
    'quest', jsonb_build_object('type', q.qtype, 'target', q.target, 'progress', q.progress, 'done', q.done,
             'mine', case when m.q_key = wk then m.q_val else 0 end),
    'boss', jsonb_build_object('open', public._boss_open(), 'boss', b.boss, 'dead', coalesce(b.dead, false), 'hp', b.hp, 'max_hp', b.max_hp),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', x.uid, 'role', x.role, 'name', p.name, 'photo', p.photo, 'lvl', p.lvl,
        'week', case when x.week_key = wk then x.week else 0 end, 'total', x.contrib, 'seen', p.last_seen)
        order by case x.role when 'leader' then 0 when 'deputy' then 1 else 2 end, case when x.week_key = wk then x.week else 0 end desc)
      from public.coven_members x left join public.players p on p.tg_id = x.uid where x.coven_id = c.id), '[]'),
    'requests', case when m.role in ('leader', 'deputy') then coalesce((select jsonb_agg(jsonb_build_object('id', r.uid, 'name', p.name, 'photo', p.photo, 'lvl', p.lvl, 'rank', p.rnk))
        from public.coven_requests r left join public.players p on p.tg_id = r.uid where r.coven_id = c.id), '[]') else '[]'::jsonb end,
    'last_msg', (select max(id) from public.coven_chat where coven_id = c.id and not hidden));
end $$;

-- настройка для проверки босса в будни (только команда со правом «Бонусы, объявления»)
create or replace function public.adm_setting(init_data text, p_k text, p_v jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  if p_k not in ('announce', 'boost', 'maint', 'boss_test') then raise exception 'bad key'; end if;
  a := public._can(init_data, case when p_k = 'maint' then 'maint' else 'settings' end);
  if p_v is null or p_v = 'null'::jsonb then delete from public.settings where k = p_k;
  else insert into public.settings (k, v, updated_at) values (p_k, p_v, now()) on conflict (k) do update set v = excluded.v, updated_at = now();
  end if;
  perform public._log(a, 'Настройка ' || p_k, null, coalesce(p_v, 'null'::jsonb));
end $$;

-- поиск ковена по названию или по #ID
create or replace function public.coven_list(init_data text, p_q text default '') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; q text := lower(trim(coalesce(p_q, ''))); qid bigint;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  if q ~ '^#?[0-9]{1,12}$' then qid := ltrim(q, '#')::bigint; end if;
  return coalesce((select jsonb_agg(j order by (j->>'week')::float desc, (j->>'xp')::float desc) from (
    select public._coven_json(c, (select count(*) from public.coven_members m where m.coven_id = c.id))
      || jsonb_build_object('requested', exists (select 1 from public.coven_requests r where r.coven_id = c.id and r.uid = me)) j
    from public.covens c where not c.deleted and (q = '' or c.id = qid or lower(c.name) like '%' || ltrim(q, '#') || '%')
    order by c.week_xp desc limit 50) x), '[]');
end $$;
grant execute on function public.coven_list(text, text) to anon, authenticated;

revoke execute on function public._coven_quest(bigint) from public, anon, authenticated;
revoke execute on function public._coven_quest_add(bigint, bigint, text, double precision) from public, anon, authenticated;
revoke execute on function public._boss_open() from public, anon, authenticated;
revoke execute on function public._boss(bigint) from public, anon, authenticated;
grant execute on function public.coven_progress(text, bigint, bigint, bigint) to anon, authenticated;
grant execute on function public.boss_state(text) to anon, authenticated;
grant execute on function public.boss_hit(text, int) to anon, authenticated;
grant execute on function public.coven_me(text) to anon, authenticated;
grant execute on function public.adm_setting(text, text, jsonb) to anon, authenticated;

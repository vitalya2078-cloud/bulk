-- =====================================================================
--  Бульк 0.20.2 - честное время и начисления без дублей.
--  * srv_time: время базы для игры - часы телефона больше не влияют на доход, таймеры и дни;
--  * mail_claim: подарок из письма нельзя забрать дважды двумя быстрыми нажатиями
--    (проверка и отметка теперь одним действием);
--  * boss_hit и coven_progress: параллельные запросы не удваивают урон по боссу и вклад в задание недели.
--  Вставить целиком в SQL Editor -> Run. Можно запускать повторно.
-- =====================================================================

-- время базы в миллисекундах (как Date.now() в игре)
create or replace function public.srv_time() returns bigint
language sql stable as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- подарок из письма: забрать можно ровно один раз, даже если нажать дважды одновременно
create or replace function public.mail_claim(init_data text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; m public.mail; pl public.players; got bigint;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into pl from public.players where tg_id = me;
  select * into m from public.mail where mail.id = p_id and not deleted and (to_tg is null or to_tg = me) and (until is null or until > now());
  if not found or m.gift = '{}' then return null; end if;
  if pl.banned then raise exception 'banned'; end if;
  if pl.no_gift and m.to_tg is null then raise exception 'no gift'; end if;
  insert into public.mail_state (mail_id, tg_id, read_at, claimed_at) values (p_id, me, now(), now())
    on conflict (mail_id, tg_id) do update set claimed_at = now(), read_at = coalesce(public.mail_state.read_at, now())
      where public.mail_state.claimed_at is null
    returning mail_id into got;
  if got is null then return null; end if;   -- уже забран
  return m.gift;
end $$;

-- удар по боссу: строка бойца блокируется - два запроса сразу не получат двойной запас урона
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
  select * into h from public.boss_hits where coven_id = m.coven_id and week_key = wk and uid = me for update;
  allow := least(extract(epoch from clock_timestamp() - h.last_at), 10) * 12;
  mult := 1 + (public._coven_level((select xp from public.covens where id = m.coven_id)) - 1) * 0.1;
  d := least(greatest(coalesce(p_n, 0), 0), allow) * mult;
  if d <= 0 then return jsonb_build_object('hp', b.hp, 'dead', false, 'dmg', 0); end if;
  update public.boss_hits set dmg = dmg + d, last_at = clock_timestamp() where coven_id = m.coven_id and week_key = wk and uid = me;
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
  return jsonb_build_object('hp', coalesce(b.hp, 0), 'dead', b.hp is null, 'dmg', d);
end $$;

-- вклад в задание недели: строка участника блокируется - один и тот же прирост не засчитается дважды
create or replace function public.coven_progress(init_data text, p_taps bigint, p_brewed bigint, p_served bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; m public.coven_members;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into m from public.coven_members where uid = me for update;
  if not found then return; end if;
  if m.last_taps is not null then
    perform public._coven_quest_add(m.coven_id, me, 'taps', least(greatest(p_taps - m.last_taps, 0), 30000));
    perform public._coven_quest_add(m.coven_id, me, 'brew', least(greatest(p_brewed - m.last_brewed, 0), 300));
    perform public._coven_quest_add(m.coven_id, me, 'serve', least(greatest(p_served - m.last_served, 0), 100));
  end if;
  update public.coven_members set last_taps = greatest(coalesce(last_taps, 0), p_taps), last_brewed = greatest(coalesce(last_brewed, 0), p_brewed),
    last_served = greatest(coalesce(last_served, 0), p_served) where uid = me;
end $$;

grant execute on function public.srv_time() to anon, authenticated;
grant execute on function public.mail_claim(text, bigint) to anon, authenticated;
grant execute on function public.boss_hit(text, int) to anon, authenticated;
grant execute on function public.coven_progress(text, bigint, bigint, bigint) to anon, authenticated;

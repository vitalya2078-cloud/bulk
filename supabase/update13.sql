-- =====================================================================
--  Бульк 0.20.4 - сообщество и приватность.
--  * team_public: имена и роли команды для вкладки «Сообщество» (без номеров игроков);
--  * hello: настройка «Скрывать моё фото» - другим игрокам (топы, ковен) виден только аватар из игры.
--  Вставить целиком в SQL Editor -> Run. Можно запускать повторно.
-- =====================================================================

create or replace function public.team_public() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(nullif(p.name, ''), 'Алхимик'), 'photo', coalesce(p.photo, ''), 'role', a.role)
                            order by case a.role when 'creator' then 0 when 'admin' then 1 when 'moderator' then 2 when 'support' then 3 else 4 end, p.name), '[]')
  from public.admins a join public.players p on p.tg_id = a.tg_id
$$;

create or replace function public.hello(init_data text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb; me bigint; pl public.players; refid bigint; ks text[] := public._keys(); kicked boolean := false;
        nle double precision; sts bigint; nph double precision; ness double precision; hrs double precision; allow double precision;
        why text := ''; nm text; ph_url text; sv jsonb; rej boolean := false; patched boolean; hide boolean;
begin
  u := public._tg_user(init_data);
  me := (u->>'id')::bigint;
  p := coalesce(p, '{}');
  refid := case when (p->>'ref') ~ '^-?[0-9]{1,15}$' and (p->>'ref')::bigint <> me then (p->>'ref')::bigint end;
  nle := greatest(0, public._num(p, 'le', 0));
  nm := nullif(public._clean(trim(coalesce(p->>'name', ''))), '');
  -- приватность: игрок попросил не показывать фото из ВК / Telegram - другим виден только аватар из игры
  hide := (p->>'nophoto') = '1';
  ph_url := case when hide then null when public._photo_ok(p->>'photo') then p->>'photo' when public._photo_ok(u->>'photo_url') then u->>'photo_url' end;
  if not exists (select 1 from public.players where tg_id = me) then
    insert into public.players (tg_id, tg, vk, platform, name, photo, username, lang, premium, ref, first_seen,
                                le_day, le_week, le_month, day_key, week_key, month_key)
      values (me, (u->>'tg')::bigint, (u->>'vk')::bigint, u->>'platform',
              left(coalesce(nm, nullif(u->>'first_name', ''), 'Алхимик'), 20),
              coalesce(ph_url, case when (p->>'avatar') ~ '^[a-z][0-9]{2}$' then p->>'avatar' end, ''),
              coalesce(u->>'username', ''), coalesce(u->>'language_code', ''), coalesce((u->>'is_premium')::boolean, false), refid, now(),
              nle, nle, nle, ks[1], ks[2], ks[3])
      on conflict do nothing;
  end if;
  select * into pl from public.players where tg_id = me for update;

  if (p->>'claim') = '1' then
    update public.players set sess = p->>'sess', sess_at = now() where tg_id = me;
  elsif pl.sess is not null and pl.sess <> coalesce(p->>'sess', '') and pl.sess_at > now() - interval '10 minutes' then
    kicked := true;
  end if;

  if not kicked then
    sv := case when jsonb_typeof(p->'save') = 'object' then p->'save' end;
    -- ---- сохранение «другой игры» или резко упавший прогресс: не принимаем, возвращаем настоящее ----
    if sv is not null and jsonb_typeof(pl.save) = 'object' then
      patched := exists (select 1 from public.patches x where x.tg_id = me and x.applied_at > now() - interval '15 minutes');
      if public._save_wipe(sv) > public._save_wipe(pl.save) then
        rej := false;                                   -- игрок сам начал заново (или сброс из админки)
      elsif public._save_born(pl.save) is not null and public._save_born(sv) is distinct from public._save_born(pl.save) then
        rej := not (patched and exists (select 1 from public.patches x where x.tg_id = me and x.ops ? 'restore' and x.applied_at > now() - interval '15 minutes'));
      elsif public._save_le(sv) < public._save_le(pl.save) * 0.5 - 1000 and not patched then
        rej := true;
      end if;
      if rej then
        perform public._save_put(me, 'rejected', sv);
        sv := null;
      end if;
    end if;

    -- ---- честность: мог ли прогресс так вырасти? ----
    nph := greatest(0, public._num(p, 'ph', pl.ph));
    ness := greatest(0, public._num(p, 'e', pl.ess));
    if not rej and p ? 'le' and pl.last_seen is not null and pl.le is not null
       and not exists (select 1 from public.patches x where x.tg_id = me and x.applied_at > pl.last_seen - interval '5 minutes') then
      hrs := least(greatest(extract(epoch from now() - pl.last_seen) / 3600.0, 1.0 / 60), 96);
      allow := greatest(pl.ph, least(nph, pl.ph * 20 + 1e5)) * hrs * 6 + 5e5 + pl.le * 0.3;
      if nle - pl.le > allow then why := 'эссенция выросла на ' || round((nle - pl.le)::numeric) || ' за ' || round((hrs * 60)::numeric) || ' мин'; end if;
      if why = '' and nph > greatest(pl.ph * 25, 2e5) and hrs < 1 then why := 'доход в час вырос в ' || round((nph / greatest(pl.ph, 1))::numeric) || ' раз'; end if;
      if why = '' and ness > nle * 1.05 + 1e4 then why := 'на счету больше, чем сварено за всё время'; end if;
    end if;

    sts := case when sv is not null then coalesce(public._num(sv, 'ts', 0), 0)::bigint else 0 end;
    update public.players set
      name = case when rej then name else left(coalesce(nm, name), 20) end,
      photo = case when hide then coalesce(case when (p->>'avatar') ~ '^[a-z][0-9]{2}$' then p->>'avatar' end, '')
                   else coalesce(ph_url, case when (p->>'avatar') ~ '^[a-z][0-9]{2}$' then p->>'avatar' end, photo) end,
      username = coalesce(nullif(u->>'username', ''), username),
      premium = coalesce((u->>'is_premium')::boolean, premium),
      platform = u->>'platform',
      tg = coalesce(tg, (u->>'tg')::bigint),
      vk = coalesce(vk, (u->>'vk')::bigint),
      sess = case when sess is null then p->>'sess' else sess end,
      sess_at = now(),
      sessions = sessions + case when (p->>'start') = '1' or last_seen is null or last_seen < now() - interval '30 minutes' then 1 else 0 end,
      last_seen = now(),
      lvl = case when rej then lvl else greatest(1, least(100000, public._num(p, 'lvl', lvl)::int)) end,
      rnk = case when rej then rnk else greatest(0, least(100, public._num(p, 'rank', rnk)::int)) end,
      le = case when rej then le when p ? 'le' then nle else le end,
      ess = case when rej then ess else ness end,
      ph = case when rej then ph else nph end,
      cr = case when rej then cr else greatest(0, least(1e12, public._num(p, 'cr', cr)))::bigint end,
      mastery = case when rej then mastery else greatest(0, least(1e15, public._num(p, 'mastery', mastery)))::bigint end,
      play_sec = greatest(play_sec, least(1e10, public._num(p, 'play', play_sec))::bigint),
      ver = left(coalesce(p->>'ver', ver), 20),
      le_day = case when day_key <> ks[1] or le_day is null then le else le_day end,
      le_week = case when week_key <> ks[2] or le_week is null then le else le_week end,
      le_month = case when month_key <> ks[3] or le_month is null then le else le_month end,
      day_key = ks[1], week_key = ks[2], month_key = ks[3],
      save = case when sts > 0 and sts >= save_ts and length(sv::text) < 300000 then sv else save end,
      save_at = case when sts > 0 and sts >= save_ts then now() else save_at end,
      save_ts = case when sts > 0 and sts >= save_ts then sts else save_ts end,
      top_hold = top_hold or why <> '',
      sus = sus + case when why <> '' then 1 else 0 end,
      sus_reason = case when why <> '' then why else sus_reason end,
      sus_at = case when why <> '' then now() else sus_at end
    where tg_id = me
    returning * into pl;
    insert into public.active_days (day, tg_id) values ((now() at time zone 'Europe/Moscow')::date, me) on conflict do nothing;
  end if;

  return jsonb_build_object(
    'uid', me, 'tg', pl.tg, 'vk', pl.vk, 'kicked', kicked,
    'restore', case when rej then pl.save end,
    'banned', pl.banned, 'reason', pl.ban_reason, 'top_ban', pl.top_ban or pl.top_hold,
    'admin', exists (select 1 from public.admins a where a.tg_id = me),
    'settings', coalesce((select jsonb_object_agg(k, v) from public.settings), '{}'),
    'mail', (select count(*) from public.mail m
             left join public.mail_state ms on ms.mail_id = m.id and ms.tg_id = me
             where not m.deleted and (m.to_tg is null or m.to_tg = me) and (m.until is null or m.until > now())
               and (m.to_tg is not null or m.created_at > pl.first_seen - interval '14 days')
               and (ms.read_at is null or (m.gift <> '{}' and ms.claimed_at is null))),
    -- пока игра не приняла настоящее сохранение, правки не выдаём: применятся к нему после перезапуска
    'patches', case when kicked or rej then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'ops', x.ops) order by x.id) from public.patches x where x.tg_id = me and x.applied_at is null), '[]') end
  );
end $$;

grant execute on function public.team_public() to anon, authenticated;
grant execute on function public.hello(text, jsonb) to anon, authenticated;

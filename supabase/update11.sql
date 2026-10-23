-- =====================================================================
--  Бульк 0.20.1 - сохранения не теряются.
--  Инцидент 21.10: игра на телефоне не смогла получить сохранение (нет на телефоне, облако ВК
--  и база не ответили вовремя) и началась с нуля, а база приняла «пустую» игру как более свежую
--  и затёрла настоящий прогресс. Теперь:
--  * история сохранений: перед понижением прогресса, сменой игры и удалением, а также раз в час
--    старая копия откладывается в save_history (по 30 последних на игрока);
--  * hello не принимает сохранение «другой игры» (другая дата рождения stat.start) или с резко
--    упавшим «Сварено всего», если игрок сам не сбрасывал прогресс (stat.wipe) и не было правки
--    из админки, - и возвращает игре настоящую копию (restore);
--  * админка: история сохранений игрока и возврат копии (право reset);
--  * письмо игроку - только существующему игроку.
--  Вставить целиком в SQL Editor -> Run. Можно запускать повторно.
--  Откат: выполнить заново hello из update8.sql (таблица истории не мешает).
-- =====================================================================

create table if not exists public.save_history (
  id bigserial primary key,
  uid bigint not null,
  at timestamptz not null default now(),
  kind text not null,            -- start / hourly / drop / other_game / deleted / rejected
  le double precision,
  lvl int,
  born bigint,                   -- save.stat.start: когда началась эта игра
  ts bigint,                     -- save.ts
  save jsonb not null
);
create index if not exists save_history_uid on public.save_history (uid, id desc);
alter table public.save_history enable row level security;
revoke all on public.save_history from anon, authenticated;

create or replace function public._save_le(s jsonb) returns double precision
language sql immutable as $$
  select case when jsonb_typeof(s->'le') = 'number' then (s->>'le')::double precision else 0 end
$$;
create or replace function public._save_born(s jsonb) returns bigint
language sql immutable as $$
  select case when jsonb_typeof(s->'stat'->'start') = 'number' then (s->'stat'->>'start')::numeric::bigint end
$$;
create or replace function public._save_wipe(s jsonb) returns bigint
language sql immutable as $$
  select case when jsonb_typeof(s->'stat'->'wipe') = 'number' then (s->'stat'->>'wipe')::numeric::bigint else 0 end
$$;

create or replace function public._save_put(p_uid bigint, p_kind text, s jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if s is null or jsonb_typeof(s) <> 'object' then return; end if;
  insert into public.save_history (uid, kind, le, lvl, born, ts, save)
    values (p_uid, p_kind, public._save_le(s), case when jsonb_typeof(s->'lvl') = 'number' then (s->>'lvl')::numeric::int end,
            public._save_born(s), case when jsonb_typeof(s->'ts') = 'number' then (s->>'ts')::numeric::bigint end, s);
  delete from public.save_history where uid = p_uid and id not in (select id from public.save_history where uid = p_uid order by id desc limit 30);
end $$;

-- любое изменение сохранения в players проходит здесь: hello, связка аккаунтов, удаление строки
create or replace function public._save_keep() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public._save_put(old.tg_id, 'deleted', old.save);
    return old;
  end if;
  if old.save is null or new.save is not distinct from old.save then return new; end if;
  if public._save_born(new.save) is distinct from public._save_born(old.save) then
    perform public._save_put(old.tg_id, 'other_game', old.save);
  elsif public._save_le(new.save) < public._save_le(old.save) then
    perform public._save_put(old.tg_id, 'drop', old.save);
  elsif not exists (select 1 from public.save_history h where h.uid = old.tg_id and h.at > now() - interval '1 hour') then
    perform public._save_put(old.tg_id, 'hourly', old.save);
  end if;
  return new;
end $$;
drop trigger if exists players_save_keep on public.players;
create trigger players_save_keep before update of save or delete on public.players
  for each row execute function public._save_keep();

-- точка восстановления на момент обновления: текущие сохранения всех игроков (один раз)
insert into public.save_history (uid, kind, le, lvl, born, ts, save)
  select p.tg_id, 'start', public._save_le(p.save), case when jsonb_typeof(p.save->'lvl') = 'number' then (p.save->>'lvl')::numeric::int end,
         public._save_born(p.save), p.save_ts, p.save
  from public.players p
  where jsonb_typeof(p.save) = 'object' and not exists (select 1 from public.save_history h where h.uid = p.tg_id);

-- ---------------------------------------------------------------------
--  hello: защита сохранения
-- ---------------------------------------------------------------------
create or replace function public.hello(init_data text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb; me bigint; pl public.players; refid bigint; ks text[] := public._keys(); kicked boolean := false;
        nle double precision; sts bigint; nph double precision; ness double precision; hrs double precision; allow double precision;
        why text := ''; nm text; ph_url text; sv jsonb; rej boolean := false; patched boolean;
begin
  u := public._tg_user(init_data);
  me := (u->>'id')::bigint;
  p := coalesce(p, '{}');
  refid := case when (p->>'ref') ~ '^-?[0-9]{1,15}$' and (p->>'ref')::bigint <> me then (p->>'ref')::bigint end;
  nle := greatest(0, public._num(p, 'le', 0));
  nm := nullif(public._clean(trim(coalesce(p->>'name', ''))), '');
  ph_url := case when public._photo_ok(p->>'photo') then p->>'photo' when public._photo_ok(u->>'photo_url') then u->>'photo_url' end;
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
      photo = coalesce(ph_url, case when (p->>'avatar') ~ '^[a-z][0-9]{2}$' then p->>'avatar' end, photo),
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

-- ---------------------------------------------------------------------
--  Админка: история сохранений и возврат копии
-- ---------------------------------------------------------------------
create or replace function public.adm_saves(init_data text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._can(init_data, 'edit');
  return jsonb_build_object(
    'now', (select jsonb_build_object('le', public._save_le(save), 'lvl', save->'lvl', 'cr', save->'cr', 'born', public._save_born(save), 'at', save_at)
            from public.players where tg_id = p_id),
    'list', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'at', h.at, 'kind', h.kind, 'le', h.le, 'lvl', h.lvl, 'cr', h.save->'cr',
                      'born', h.born, 'play', h.save->'stat'->'play') order by h.id desc)
                      from public.save_history h where h.uid = p_id), '[]'));
end $$;

-- копия уходит игре правкой {restore: сохранение}; игра заменит прогресс и перезапустится
create or replace function public.adm_save_restore(init_data text, p_id bigint, p_hist bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; h public.save_history;
begin
  a := public._can(init_data, 'reset');
  select * into h from public.save_history where id = p_hist and uid = p_id;
  if not found then raise exception 'no save'; end if;
  if exists (select 1 from public.patches where tg_id = p_id and applied_at is null and ops ? 'restore') then raise exception 'already pending'; end if;
  insert into public.patches (tg_id, ops) values (p_id, jsonb_build_object('restore', h.save, 'hist', h.id));
  perform public._log(a, 'Вернул сохранение', p_id, jsonb_build_object('hist', h.id, 'at', h.at, 'le', h.le, 'lvl', h.lvl));
end $$;

-- список правок в админке: вместо целого сохранения из правки «вернуть» - номер копии
create or replace function public.adm_player(init_data text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; r jsonb;
begin
  a := public._can(init_data, '');
  select to_jsonb(p) into r from public.players p where p.tg_id = p_id;
  if r is null then return null; end if;
  return r || jsonb_build_object(
    'scores', coalesce((select jsonb_agg(jsonb_build_object('board', board, 'period', period, 'score', score)) from public.scores where tg_id = p_id), '[]'),
    'mail', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'gift', m.gift, 'at', m.created_at,
                      'read', ms.read_at is not null, 'claimed', ms.claimed_at is not null) order by m.id desc)
                      from public.mail m left join public.mail_state ms on ms.mail_id = m.id and ms.tg_id = p_id
                      where m.to_tg = p_id and not m.deleted), '[]'),
    'patches', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'ops', case when x.ops ? 'restore' then jsonb_build_object('restore', x.ops->'hist') else x.ops end,
                      'at', x.created_at, 'done', x.applied_at) order by x.id desc)
                      from (select * from public.patches where tg_id = p_id order by id desc limit 20) x), '[]'),
    'days', (select count(*) from public.active_days where tg_id = p_id),
    'invited', (select count(*) from public.players where ref = p_id),
    'ref_name', (select name from public.players where tg_id = (r->>'ref')::bigint),
    'team_role', (select role from public.admins where tg_id = p_id));
end $$;

-- письмо игроку: только существующему (раньше уходило «в никуда» при опечатке в номере)
create or replace function public.adm_mail_send(init_data text, p_to bigint, p_title text, p_body text, p_gift jsonb default '{}', p_days int default 0)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; nid bigint; g jsonb := '{}';
begin
  a := public._can(init_data, case when coalesce(p_to, 0) = 0 then 'mail_all' else 'mail' end);
  if trim(coalesce(p_title, '')) = '' then raise exception 'no title'; end if;
  if coalesce(p_to, 0) <> 0 and not exists (select 1 from public.players where tg_id = p_to) then raise exception 'no player'; end if;
  if public._num(p_gift, 'cr') > 0 then g := g || jsonb_build_object('cr', least(100000, public._num(p_gift, 'cr')::int)); end if;
  if public._num(p_gift, 'ess_h') > 0 then g := g || jsonb_build_object('ess_h', least(1000, public._num(p_gift, 'ess_h'))); end if;
  if g <> '{}' then perform public._can(init_data, 'gift'); end if;
  insert into public.mail (to_tg, title, body, gift, until)
    values (nullif(p_to, 0), left(p_title, 80), left(coalesce(p_body, ''), 2000), g, case when p_days > 0 then now() + make_interval(days => p_days) end)
    returning id into nid;
  perform public._log(a, case when p_to = 0 then 'Письмо всем' else 'Письмо игроку' end, nullif(p_to, 0), jsonb_build_object('title', p_title, 'gift', g));
  return nid;
end $$;

revoke execute on function public._save_put(bigint, text, jsonb) from public, anon, authenticated;
revoke execute on function public._save_keep() from public, anon, authenticated;
grant execute on function public.hello(text, jsonb) to anon, authenticated;
grant execute on function public.adm_saves(text, bigint) to anon, authenticated;
grant execute on function public.adm_save_restore(text, bigint, bigint) to anon, authenticated;
grant execute on function public.adm_player(text, bigint) to anon, authenticated;
grant execute on function public.adm_mail_send(text, bigint, text, text, jsonb, int) to anon, authenticated;

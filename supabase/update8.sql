-- =====================================================================
--  Бульк 0.20 - чистота и честность:
--  * после связки ВК + Telegram ковен, чат, почта и бой с боссом переезжают на общий аккаунт
--    (раньше оставались на старом номере - отсюда «глава -» в админке);
--  * фото игрока из ВК / Telegram (для топов и ковенов);
--  * фильтр грубых слов: чат, названия и девизы ковенов, имена;
--  * защита топов от накруток: подозрительный рост - игрок временно вне топов, пометка в админке;
--  * топ ковенов;
--  * админка: полное редактирование ковена.
--  Вставить целиком в SQL Editor -> Run (на предупреждение - Run query). Можно запускать повторно.
-- =====================================================================

alter table public.players add column if not exists top_hold boolean not null default false;
alter table public.players add column if not exists sus int not null default 0;
alter table public.players add column if not exists sus_reason text not null default '';
alter table public.players add column if not exists sus_at timestamptz;

-- ---------------------------------------------------------------------
--  Переезд всего, что связано с игроком, со старого номера на новый
-- ---------------------------------------------------------------------
create or replace function public._move_uid(p_old bigint, p_new bigint) returns void
language plpgsql security definer set search_path = public as $$
declare m public.coven_members; nxt bigint;
begin
  if p_old is null or p_new is null or p_old = p_new then return; end if;
  -- ковен
  select * into m from public.coven_members where uid = p_old;
  if found then
    if exists (select 1 from public.coven_members where uid = p_new) then
      delete from public.coven_members where uid = p_old;
      if m.role = 'leader' then
        select uid into nxt from public.coven_members where coven_id = m.coven_id order by case role when 'deputy' then 0 else 1 end, contrib desc limit 1;
        if nxt is null then update public.covens set deleted = true where id = m.coven_id;
        else update public.coven_members set role = 'leader' where uid = nxt; end if;
      end if;
    else
      update public.coven_members set uid = p_new where uid = p_old;
    end if;
  end if;
  delete from public.coven_requests r where r.uid = p_old and exists (select 1 from public.coven_requests x where x.uid = p_new and x.coven_id = r.coven_id);
  update public.coven_requests set uid = p_new where uid = p_old;
  update public.coven_chat set uid = p_new where uid = p_old;
  delete from public.chat_reports r where r.uid = p_old and exists (select 1 from public.chat_reports x where x.uid = p_new and x.msg_id = r.msg_id);
  update public.chat_reports set uid = p_new where uid = p_old;
  delete from public.boss_hits b where b.uid = p_old and exists (select 1 from public.boss_hits x where x.uid = p_new and x.coven_id = b.coven_id and x.week_key = b.week_key);
  update public.boss_hits set uid = p_new where uid = p_old;
  update public.mail set to_tg = p_new where to_tg = p_old;
  delete from public.mail_state s where s.tg_id = p_old and exists (select 1 from public.mail_state x where x.tg_id = p_new and x.mail_id = s.mail_id);
  update public.mail_state set tg_id = p_new where tg_id = p_old;
  delete from public.active_days d where d.tg_id = p_old and exists (select 1 from public.active_days x where x.tg_id = p_new and x.day = d.day);
  update public.active_days set tg_id = p_new where tg_id = p_old;
  update public.patches set tg_id = p_new where tg_id = p_old and applied_at is null;
  update public.players set ref = p_new where ref = p_old;
end $$;

-- связали вторую платформу: старый номер этой платформы больше не игрок - переносим его следы
create or replace function public._players_linked() returns trigger
language plpgsql security definer set search_path = public as $$
declare o bigint;
begin
  if old.tg is null and new.tg is not null then
    o := new.tg;
    if o <> new.tg_id and not exists (select 1 from public.players where tg_id = o) then perform public._move_uid(o, new.tg_id); end if;
  end if;
  if old.vk is null and new.vk is not null then
    o := -new.vk;
    if o <> new.tg_id and not exists (select 1 from public.players where tg_id = o) then perform public._move_uid(o, new.tg_id); end if;
  end if;
  return new;
end $$;
drop trigger if exists players_linked on public.players;
create trigger players_linked after update of tg, vk on public.players for each row execute function public._players_linked();

-- уже связанные аккаунты: чиним один раз
do $$ declare r record; begin
  for r in select tg_id, tg, vk from public.players where tg is not null and vk is not null loop
    if r.tg <> r.tg_id and not exists (select 1 from public.players where tg_id = r.tg) then perform public._move_uid(r.tg, r.tg_id); end if;
    if -r.vk <> r.tg_id and not exists (select 1 from public.players where tg_id = -r.vk) then perform public._move_uid(-r.vk, r.tg_id); end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
--  Фильтр грубых слов
-- ---------------------------------------------------------------------
-- слово к общему виду: строчные, латиница-двойники -> кириллица, ё -> е, без повторов букв
create or replace function public._norm_word(w text) returns text
language sql immutable as $$
  select regexp_replace(
    translate(lower(translate(coalesce(w, ''), 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя')),
              'aeopcxykmtbh3ё0@$', 'аеорсхукмтвнзеоас'),
    '([а-я])\1+', '\1', 'g')
$$;

create or replace function public._bad_word(w text) returns boolean
language sql immutable as $$
  select public._norm_word(regexp_replace(coalesce(w, ''), '[^a-zA-Zа-яА-ЯёЁ0-9@$]', '', 'g')) ~
    ('^(за|вы|на|у|до|по|от|раз|съ|из|при|под|пере|недо|рас|подъ|объ|отъ|разъ|въ|изъ)?(х[уy][йеияю]|пизд|пизж|бля|[её]б[аеиоуыл]|[её]бн|муда[кч]|мудил|пид[оаe]р|пидр|педик|гандон|г[ао]вн|залуп|шлюх|сук[аиуе]|сучк|сучар|дроч|ублюд|долб[ао][её]?б|хер[нь]|манд[аеуы]$|дерьм|жоп)')
$$;

-- заменить грубые слова звёздочками (первая буква остаётся)
create or replace function public._clean(t text) returns text
language plpgsql immutable as $$
declare w text; out text := ''; parts text[];
begin
  if t is null or t = '' then return t; end if;
  parts := regexp_split_to_array(t, '(\s+)');
  foreach w in array parts loop
    if public._bad_word(w) then out := out || left(w, 1) || repeat('*', greatest(length(regexp_replace(w, '[^a-zA-Zа-яА-ЯёЁ0-9]+$', '')) - 1, 2)) || coalesce(substring(w from '[^a-zA-Zа-яА-ЯёЁ0-9]+$'), '');
    else out := out || w; end if;
    out := out || ' ';
  end loop;
  return rtrim(out);
end $$;

create or replace function public._has_bad(t text) returns boolean
language sql immutable as $$ select exists (select 1 from regexp_split_to_table(coalesce(t, ''), '\s+') w where public._bad_word(w)) $$;

-- ---------------------------------------------------------------------
--  Вход и отчёт игры: + фото платформы, + чистое имя, + проверка честности
-- ---------------------------------------------------------------------
create or replace function public._photo_ok(u text) returns boolean
language sql immutable as $$
  select coalesce(u, '') ~ '^https://([a-z0-9-]+\.)*(userapi\.com|vk\.com|vk\.me|vkuser\.net|mycdn\.me|t\.me|telegram\.org|telesco\.pe)/' and length(u) < 600
$$;

create or replace function public.hello(init_data text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb; me bigint; pl public.players; refid bigint; ks text[] := public._keys(); kicked boolean := false;
        nle double precision; sts bigint; nph double precision; ness double precision; hrs double precision; allow double precision;
        why text := ''; nm text; ph_url text;
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
  select * into pl from public.players where tg_id = me;

  if (p->>'claim') = '1' then
    update public.players set sess = p->>'sess', sess_at = now() where tg_id = me;
  elsif pl.sess is not null and pl.sess <> coalesce(p->>'sess', '') and pl.sess_at > now() - interval '10 minutes' then
    kicked := true;
  end if;

  if not kicked then
    -- ---- честность: мог ли прогресс так вырасти? ----
    nph := greatest(0, public._num(p, 'ph', pl.ph));
    ness := greatest(0, public._num(p, 'e', pl.ess));
    if p ? 'le' and pl.last_seen is not null and pl.le is not null
       and not exists (select 1 from public.patches x where x.tg_id = me and x.applied_at > pl.last_seen - interval '5 minutes') then
      hrs := least(greatest(extract(epoch from now() - pl.last_seen) / 3600.0, 1.0 / 60), 96);
      allow := greatest(pl.ph, least(nph, pl.ph * 20 + 1e5)) * hrs * 6 + 5e5 + pl.le * 0.3;
      if nle - pl.le > allow then why := 'эссенция выросла на ' || round((nle - pl.le)::numeric) || ' за ' || round((hrs * 60)::numeric) || ' мин'; end if;
      if why = '' and nph > greatest(pl.ph * 25, 2e5) and hrs < 1 then why := 'доход в час вырос в ' || round((nph / greatest(pl.ph, 1))::numeric) || ' раз'; end if;
      if why = '' and ness > nle * 1.05 + 1e4 then why := 'на счету больше, чем сварено за всё время'; end if;
    end if;

    sts := case when jsonb_typeof(p->'save') = 'object' then coalesce(public._num(p->'save', 'ts', 0), 0)::bigint else 0 end;
    update public.players set
      name = left(coalesce(nm, name), 20),
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
      lvl = greatest(1, least(100000, public._num(p, 'lvl', lvl)::int)),
      rnk = greatest(0, least(100, public._num(p, 'rank', rnk)::int)),
      le = case when p ? 'le' then nle else le end,
      ess = ness,
      ph = nph,
      cr = greatest(0, least(1e12, public._num(p, 'cr', cr)))::bigint,
      mastery = greatest(0, least(1e15, public._num(p, 'mastery', mastery)))::bigint,
      play_sec = greatest(play_sec, least(1e10, public._num(p, 'play', play_sec))::bigint),
      ver = left(coalesce(p->>'ver', ver), 20),
      le_day = case when day_key <> ks[1] or le_day is null then le else le_day end,
      le_week = case when week_key <> ks[2] or le_week is null then le else le_week end,
      le_month = case when month_key <> ks[3] or le_month is null then le else le_month end,
      day_key = ks[1], week_key = ks[2], month_key = ks[3],
      save = case when sts > 0 and sts >= save_ts and length((p->'save')::text) < 300000 then p->'save' else save end,
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
    'banned', pl.banned, 'reason', pl.ban_reason, 'top_ban', pl.top_ban or pl.top_hold,
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

-- ---------------------------------------------------------------------
--  Топы: без «на проверке»; + топ ковенов
-- ---------------------------------------------------------------------
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
    where not p.banned and not p.top_ban and not p.top_hold and p.last_seen is not null),
  r as (select b.*, row_number() over (order by score desc, tg_id) as place from b where score > 0)
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('place', place, 'name', name, 'photo', photo, 'score', score, 'platform', platform, 'is_me', tg_id = p_me) order by place)
                      from r where place <= least(greatest(p_limit, 1), 100)), '[]'),
    'me', (select jsonb_build_object('place', place, 'score', score) from r where tg_id = p_me),
    'total', (select count(*) from r))
$$;

-- топ ковенов: очки вклада за эту неделю
create or replace function public.top_covens(p_limit int default 50, p_me bigint default 0)
returns jsonb language sql stable security definer set search_path = public as $$
  with wk as (select (public._keys())[2] k),
  b as (
    select c.id, c.name, c.emblem, c.color, public._coven_level(c.xp) as level,
      case when c.week_key = (select k from wk) then c.week_xp else 0 end as score,
      (select count(*) from public.coven_members m where m.coven_id = c.id) as members
    from public.covens c where not c.deleted),
  r as (select b.*, row_number() over (order by score desc, level desc, id) as place from b where score > 0),
  mine as (select coven_id from public.coven_members where uid = p_me)
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('place', place, 'id', id, 'name', name, 'emblem', emblem, 'color', color, 'level', level,
                      'members', members, 'score', score, 'is_me', coalesce(id = (select coven_id from mine), false)) order by place)
                      from r where place <= least(greatest(p_limit, 1), 100)), '[]'),
    'me', (select jsonb_build_object('place', place, 'score', score, 'name', name, 'emblem', emblem, 'color', color, 'level', level) from r where id = (select coven_id from mine)),
    'total', (select count(*) from r))
$$;

-- ---------------------------------------------------------------------
--  Ковены и чат: фильтр слов
-- ---------------------------------------------------------------------
create or replace function public.chat_send(init_data text, p_text text) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; c bigint; pl public.players; t text := trim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')); nid bigint;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select coven_id into c from public.coven_members where uid = me;
  if c is null then raise exception 'no coven'; end if;
  select * into pl from public.players where tg_id = me;
  if pl.banned or pl.chat_ban then raise exception 'muted'; end if;
  if t = '' then raise exception 'empty'; end if;
  if exists (select 1 from public.coven_chat where uid = me and at > now() - interval '2 seconds') then raise exception 'too fast'; end if;
  insert into public.coven_chat (coven_id, uid, text) values (c, me, public._clean(left(t, 300))) returning id into nid;
  return nid;
end $$;

create or replace function public.coven_create(init_data text, p_name text, p_emblem text, p_color text, p_motto text, p_open boolean)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; nid bigint; nm text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'); pl public.players;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into pl from public.players where tg_id = me;
  if pl.banned then raise exception 'banned'; end if;
  if exists (select 1 from public.coven_members where uid = me) then raise exception 'already in coven'; end if;
  if length(nm) < 3 or length(nm) > 20 then raise exception 'bad name'; end if;
  if public._has_bad(nm) then raise exception 'bad word'; end if;
  if exists (select 1 from public.covens where lower(name) = lower(nm) and not deleted) then raise exception 'name taken'; end if;
  insert into public.covens (name, emblem, color, motto, open, week_key)
    values (nm, case when p_emblem ~ '^e[0-9]{2}$' then p_emblem else 'e01' end, left(coalesce(p_color, 'purple'), 12),
            public._clean(left(trim(coalesce(p_motto, '')), 80)), coalesce(p_open, true), (public._keys())[2])
    returning id into nid;
  insert into public.coven_members (uid, coven_id, role, week_key) values (me, nid, 'leader', (public._keys())[2]);
  delete from public.coven_requests where uid = me;
  perform public._coven_sys(nid, '✨ Ковен «' || nm || '» основан. Глава: ' || coalesce(pl.name, 'Алхимик'));
  return nid;
end $$;

create or replace function public.coven_edit(init_data text, p_motto text, p_emblem text, p_color text, p_open boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; m public.coven_members;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into m from public.coven_members where uid = me;
  if not found or m.role <> 'leader' then raise exception 'no right'; end if;
  update public.covens set motto = public._clean(left(trim(coalesce(p_motto, motto)), 80)),
    emblem = case when p_emblem ~ '^e[0-9]{2}$' then p_emblem else emblem end,
    color = left(coalesce(p_color, color), 12), open = coalesce(p_open, open)
  where id = m.coven_id;
end $$;

-- уже написанное: прячем грубые слова
update public.coven_chat set text = public._clean(text) where public._has_bad(text);
update public.covens set motto = public._clean(motto) where public._has_bad(motto);
update public.players set name = public._clean(name) where public._has_bad(name);

-- ---------------------------------------------------------------------
--  Админка: ковены целиком
-- ---------------------------------------------------------------------
create or replace function public.adm_covens(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, '');
  return coalesce((select jsonb_agg(public._coven_json(c, (select count(*) from public.coven_members m where m.coven_id = c.id))
      || jsonb_build_object('leader', (select coalesce(p.name, 'ID ' || m.uid) from public.coven_members m left join public.players p on p.tg_id = m.uid where m.coven_id = c.id and m.role = 'leader' limit 1),
                            'created_at', c.created_at)
      order by c.xp desc) from public.covens c where not c.deleted), '[]');
end $$;

create or replace function public.adm_coven(init_data text, p_coven bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; c public.covens; wk text := (public._keys())[2];
begin
  a := public._can(init_data, '');
  select * into c from public.covens where id = p_coven;
  if not found then return null; end if;
  return public._coven_json(c, (select count(*) from public.coven_members where coven_id = c.id))
    || jsonb_build_object('created_at', c.created_at, 'deleted', c.deleted, 'week_key', c.week_key,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', x.uid, 'role', x.role, 'name', p.name, 'photo', p.photo, 'lvl', p.lvl,
        'week', case when x.week_key = wk then x.week else 0 end, 'total', x.contrib, 'seen', p.last_seen, 'joined', x.joined_at)
        order by case x.role when 'leader' then 0 when 'deputy' then 1 else 2 end, x.contrib desc)
      from public.coven_members x left join public.players p on p.tg_id = x.uid where x.coven_id = c.id), '[]'),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', r.uid, 'name', p.name, 'photo', p.photo, 'lvl', p.lvl, 'at', r.at))
        from public.coven_requests r left join public.players p on p.tg_id = r.uid where r.coven_id = c.id), '[]'),
    'quest', (select to_jsonb(q) from public.coven_week q where q.coven_id = c.id and q.week_key = wk),
    'boss', (select to_jsonb(b) from public.coven_boss b where b.coven_id = c.id and b.week_key = wk));
end $$;

-- f: name, motto, emblem, color, open (право ban); xp, week_xp (право edit)
create or replace function public.adm_coven_edit(init_data text, p_coven bigint, f jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; nm text;
begin
  a := public._can(init_data, 'ban');
  f := coalesce(f, '{}');
  if f ? 'name' then
    nm := regexp_replace(trim(coalesce(f->>'name', '')), '\s+', ' ', 'g');
    if length(nm) < 3 or length(nm) > 20 then raise exception 'bad name'; end if;
    if exists (select 1 from public.covens where lower(name) = lower(nm) and not deleted and id <> p_coven) then raise exception 'name taken'; end if;
    update public.covens set name = nm where id = p_coven;
  end if;
  if f ? 'motto' then update public.covens set motto = left(trim(coalesce(f->>'motto', '')), 80) where id = p_coven; end if;
  if f ? 'emblem' and (f->>'emblem') ~ '^e[0-9]{2}$' then update public.covens set emblem = f->>'emblem' where id = p_coven; end if;
  if f ? 'color' then update public.covens set color = left(f->>'color', 12) where id = p_coven; end if;
  if f ? 'open' then update public.covens set open = (f->>'open')::boolean where id = p_coven; end if;
  if f ? 'xp' or f ? 'week_xp' then
    perform public._can(init_data, 'edit');
    if f ? 'xp' then update public.covens set xp = greatest(0, (f->>'xp')::float) where id = p_coven; end if;
    if f ? 'week_xp' then update public.covens set week_xp = greatest(0, (f->>'week_xp')::float), week_key = (public._keys())[2] where id = p_coven; end if;
  end if;
  perform public._log(a, 'Изменил ковен', null, f || jsonb_build_object('coven', p_coven));
end $$;

-- участник: kick | promote | demote | lead | accept | decline
create or replace function public.adm_coven_member(init_data text, p_coven bigint, p_uid bigint, p_action text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; t public.coven_members; nm text; old bigint;
begin
  a := public._can(init_data, 'ban');
  select coalesce(name, 'Алхимик') into nm from public.players where tg_id = p_uid;
  nm := coalesce(nm, 'Алхимик');
  if p_action in ('accept', 'decline') then
    delete from public.coven_requests where uid = p_uid and coven_id = p_coven;
    if p_action = 'accept' then
      if exists (select 1 from public.coven_members where uid = p_uid) then raise exception 'already in coven'; end if;
      insert into public.coven_members (uid, coven_id, week_key) values (p_uid, p_coven, (public._keys())[2]);
      delete from public.coven_requests where uid = p_uid;
      perform public._coven_sys(p_coven, '👋 ' || nm || ' теперь в ковене');
    end if;
  else
    select * into t from public.coven_members where uid = p_uid and coven_id = p_coven;
    if not found then raise exception 'bad target'; end if;
    if p_action = 'kick' then
      delete from public.coven_members where uid = p_uid;
      if t.role = 'leader' then
        select uid into old from public.coven_members where coven_id = p_coven order by case role when 'deputy' then 0 else 1 end, contrib desc limit 1;
        if old is null then update public.covens set deleted = true where id = p_coven;
        else update public.coven_members set role = 'leader' where uid = old; end if;
      end if;
      perform public._coven_sys(p_coven, '🚪 ' || nm || ' больше не в ковене');
    elsif p_action = 'promote' then update public.coven_members set role = 'deputy' where uid = p_uid and role = 'member';
    elsif p_action = 'demote' then update public.coven_members set role = 'member' where uid = p_uid and role = 'deputy';
    elsif p_action = 'lead' then
      update public.coven_members set role = 'deputy' where coven_id = p_coven and role = 'leader';
      update public.coven_members set role = 'leader' where uid = p_uid;
      perform public._coven_sys(p_coven, '👑 Новый глава: ' || nm);
    else raise exception 'bad action';
    end if;
  end if;
  perform public._log(a, 'Ковен: участник', p_uid, jsonb_build_object('coven', p_coven, 'action', p_action));
end $$;

create or replace function public.adm_coven_delete(init_data text, p_coven bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, 'ban');
  delete from public.coven_members where coven_id = p_coven;
  delete from public.coven_requests where coven_id = p_coven;
  update public.covens set deleted = true where id = p_coven;
  perform public._log(a, 'Распустил ковен', null, jsonb_build_object('coven', p_coven));
end $$;

-- подозрительные: список и решение
create or replace function public.adm_sus(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, 'ban');
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.tg_id, 'name', p.name, 'photo', p.photo, 'reason', p.sus_reason, 'at', p.sus_at,
      'count', p.sus, 'le', p.le, 'ph', p.ph, 'lvl', p.lvl, 'rnk', p.rnk, 'last_seen', p.last_seen) order by p.sus_at desc)
    from public.players p where p.top_hold), '[]');
end $$;

-- p_ok = true: всё честно, вернуть в топы; false: оставить вне топов навсегда (top_ban)
create or replace function public.adm_sus_done(init_data text, p_id bigint, p_ok boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, 'ban');
  update public.players set top_hold = false, sus = case when p_ok then 0 else sus end,
    top_ban = case when p_ok then top_ban else true end where tg_id = p_id;
  perform public._log(a, case when p_ok then 'Проверил: честно' else 'Проверил: накрутка' end, p_id, '{}');
end $$;

revoke execute on function public._move_uid(bigint, bigint) from public, anon, authenticated;
revoke execute on function public._players_linked() from public, anon, authenticated;
grant execute on function public.hello(text, jsonb) to anon, authenticated;
grant execute on function public.top_list(text, int, bigint) to anon, authenticated;
grant execute on function public.top_covens(int, bigint) to anon, authenticated;
grant execute on function public.chat_send(text, text) to anon, authenticated;
grant execute on function public.coven_create(text, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.coven_edit(text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.adm_covens(text) to anon, authenticated;
grant execute on function public.adm_coven(text, bigint) to anon, authenticated;
grant execute on function public.adm_coven_edit(text, bigint, jsonb) to anon, authenticated;
grant execute on function public.adm_coven_member(text, bigint, bigint, text) to anon, authenticated;
grant execute on function public.adm_coven_delete(text, bigint) to anon, authenticated;
grant execute on function public.adm_sus(text) to anon, authenticated;
grant execute on function public.adm_sus_done(text, bigint, boolean) to anon, authenticated;

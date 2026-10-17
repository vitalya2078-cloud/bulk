-- =====================================================================
--  Бульк 0.17 - ковены: создание, вступление (открытое или по заявке), роли,
--  вклад (время в игре), уровень ковена и бонус к доходу, чат ковена, жалобы.
--  Вставить целиком в SQL Editor -> Run (на предупреждение - Run query). Можно запускать повторно.
-- =====================================================================

alter table public.players add column if not exists chat_ban boolean not null default false;

create table if not exists public.covens (
  id bigserial primary key,
  name text not null,
  emblem text not null default 'e01',
  color text not null default 'purple',
  motto text not null default '',
  open boolean not null default true,
  xp double precision not null default 0,         -- очки вклада за всё время (минуты в игре участников + награды)
  week_xp double precision not null default 0,
  week_key text not null default '',
  created_at timestamptz not null default now(),
  deleted boolean not null default false
);
create unique index if not exists covens_name on public.covens (lower(name)) where not deleted;

create table if not exists public.coven_members (
  uid bigint primary key,
  coven_id bigint not null references public.covens(id) on delete cascade,
  role text not null default 'member',            -- leader | deputy | member
  joined_at timestamptz not null default now(),
  contrib double precision not null default 0,
  week double precision not null default 0,
  week_key text not null default ''
);
create index if not exists coven_members_c on public.coven_members (coven_id);

create table if not exists public.coven_requests (
  uid bigint not null,
  coven_id bigint not null references public.covens(id) on delete cascade,
  at timestamptz not null default now(),
  primary key (uid, coven_id)
);

create table if not exists public.coven_chat (
  id bigserial primary key,
  coven_id bigint not null references public.covens(id) on delete cascade,
  uid bigint,                                     -- null - системное сообщение
  text text not null,
  at timestamptz not null default now(),
  hidden boolean not null default false
);
create index if not exists coven_chat_c on public.coven_chat (coven_id, id desc);

create table if not exists public.chat_reports (
  msg_id bigint not null references public.coven_chat(id) on delete cascade,
  uid bigint not null,
  at timestamptz not null default now(),
  done boolean not null default false,
  primary key (msg_id, uid)
);

do $$ declare t text; begin
  foreach t in array array['covens','coven_members','coven_requests','coven_chat','chat_reports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------- уровень ковена ----------
create or replace function public._coven_level(x double precision) returns int
language sql immutable as $$
  select coalesce(max(l), 1) from (values (1, 0), (2, 300), (3, 1000), (4, 3000), (5, 8000), (6, 20000), (7, 50000), (8, 100000), (9, 200000), (10, 400000)) v(l, need)
  where x >= need
$$;
create or replace function public._coven_need(l int) returns double precision
language sql immutable as $$
  select case l when 1 then 0 when 2 then 300 when 3 then 1000 when 4 then 3000 when 5 then 8000 when 6 then 20000 when 7 then 50000 when 8 then 100000 when 9 then 200000 when 10 then 400000 else null end
$$;

create or replace function public._coven_sys(c bigint, t text) returns void
language sql security definer set search_path = public as $$
  insert into public.coven_chat (coven_id, uid, text) values (c, null, left(t, 300))
$$;

-- ---------- вклад: каждая минута в игре = 1 очко ковену ----------
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
  return new;
end $$;
drop trigger if exists players_coven_tick on public.players;
create trigger players_coven_tick after update of play_sec on public.players
  for each row when (new.play_sec > old.play_sec) execute function public._coven_tick();

-- ---------- данные ковена ----------
create or replace function public._coven_json(c public.covens, cnt bigint) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', c.id, 'name', c.name, 'emblem', c.emblem, 'color', c.color, 'motto', c.motto, 'open', c.open,
    'level', public._coven_level(c.xp), 'xp', c.xp, 'need', public._coven_need(public._coven_level(c.xp) + 1), 'cur', public._coven_need(public._coven_level(c.xp)),
    'week', case when c.week_key = (public._keys())[2] then c.week_xp else 0 end, 'members', cnt, 'bonus', (public._coven_level(c.xp) - 1) * 2)
$$;

-- список ковенов (поиск; сортировка по очкам недели)
create or replace function public.coven_list(init_data text, p_q text default '') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; q text := lower(trim(coalesce(p_q, '')));
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  return coalesce((select jsonb_agg(j order by (j->>'week')::float desc, (j->>'xp')::float desc) from (
    select public._coven_json(c, (select count(*) from public.coven_members m where m.coven_id = c.id))
      || jsonb_build_object('requested', exists (select 1 from public.coven_requests r where r.coven_id = c.id and r.uid = me)) j
    from public.covens c where not c.deleted and (q = '' or lower(c.name) like '%' || q || '%')
    order by c.week_xp desc limit 50) x), '[]');
end $$;

-- мой ковен
create or replace function public.coven_me(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; m public.coven_members; c public.covens; wk text := (public._keys())[2];
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into m from public.coven_members where uid = me;
  if not found then return jsonb_build_object('coven', null,
    'requests', coalesce((select jsonb_agg(coven_id) from public.coven_requests where uid = me), '[]')); end if;
  select * into c from public.covens where id = m.coven_id;
  return jsonb_build_object(
    'coven', public._coven_json(c, (select count(*) from public.coven_members where coven_id = c.id)),
    'role', m.role, 'me', me,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', x.uid, 'role', x.role, 'name', p.name, 'photo', p.photo, 'lvl', p.lvl,
        'week', case when x.week_key = wk then x.week else 0 end, 'total', x.contrib, 'seen', p.last_seen)
        order by case x.role when 'leader' then 0 when 'deputy' then 1 else 2 end, case when x.week_key = wk then x.week else 0 end desc)
      from public.coven_members x left join public.players p on p.tg_id = x.uid where x.coven_id = c.id), '[]'),
    'requests', case when m.role in ('leader', 'deputy') then coalesce((select jsonb_agg(jsonb_build_object('id', r.uid, 'name', p.name, 'photo', p.photo, 'lvl', p.lvl, 'rank', p.rnk))
        from public.coven_requests r left join public.players p on p.tg_id = r.uid where r.coven_id = c.id), '[]') else '[]'::jsonb end,
    'last_msg', (select max(id) from public.coven_chat where coven_id = c.id and not hidden));
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
  if exists (select 1 from public.covens where lower(name) = lower(nm) and not deleted) then raise exception 'name taken'; end if;
  insert into public.covens (name, emblem, color, motto, open, week_key)
    values (nm, case when p_emblem ~ '^e[0-9]{2}$' then p_emblem else 'e01' end, left(coalesce(p_color, 'purple'), 12),
            left(trim(coalesce(p_motto, '')), 80), coalesce(p_open, true), (public._keys())[2])
    returning id into nid;
  insert into public.coven_members (uid, coven_id, role, week_key) values (me, nid, 'leader', (public._keys())[2]);
  delete from public.coven_requests where uid = me;
  perform public._coven_sys(nid, '✨ Ковен «' || nm || '» основан. Глава: ' || coalesce(pl.name, 'Алхимик'));
  return nid;
end $$;

create or replace function public.coven_join(init_data text, p_id bigint) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; c public.covens; pl public.players;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into pl from public.players where tg_id = me;
  if pl.banned then raise exception 'banned'; end if;
  if exists (select 1 from public.coven_members where uid = me) then raise exception 'already in coven'; end if;
  select * into c from public.covens where id = p_id and not deleted;
  if not found then raise exception 'no coven'; end if;
  if (select count(*) from public.coven_members where coven_id = p_id) >= 30 then raise exception 'full'; end if;
  if not c.open then
    insert into public.coven_requests (uid, coven_id) values (me, p_id) on conflict do nothing;
    return 'requested';
  end if;
  insert into public.coven_members (uid, coven_id, week_key) values (me, p_id, (public._keys())[2]);
  delete from public.coven_requests where uid = me;
  perform public._coven_sys(p_id, '👋 ' || coalesce(pl.name, 'Алхимик') || ' теперь в ковене');
  return 'joined';
end $$;

create or replace function public.coven_cancel_request(init_data text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  delete from public.coven_requests where uid = me and coven_id = p_id;
end $$;

create or replace function public.coven_leave(init_data text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; m public.coven_members; nxt bigint; nm text;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into m from public.coven_members where uid = me;
  if not found then return; end if;
  select name into nm from public.players where tg_id = me;
  delete from public.coven_members where uid = me;
  if not exists (select 1 from public.coven_members where coven_id = m.coven_id) then
    update public.covens set deleted = true where id = m.coven_id;     -- последний вышел - ковен распущен
    return;
  end if;
  if m.role = 'leader' then
    select uid into nxt from public.coven_members where coven_id = m.coven_id
      order by case role when 'deputy' then 0 else 1 end, contrib desc limit 1;
    update public.coven_members set role = 'leader' where uid = nxt;
    perform public._coven_sys(m.coven_id, '👑 Новый глава: ' || coalesce((select name from public.players where tg_id = nxt), 'Алхимик'));
  end if;
  perform public._coven_sys(m.coven_id, '🚪 ' || coalesce(nm, 'Алхимик') || ' покидает ковен');
end $$;

-- принять / отклонить заявку, исключить, повысить, понизить, передать главенство
create or replace function public.coven_manage(init_data text, p_action text, p_uid bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; m public.coven_members; t public.coven_members; nm text;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into m from public.coven_members where uid = me;
  if not found or m.role not in ('leader', 'deputy') then raise exception 'no right'; end if;
  select name into nm from public.players where tg_id = p_uid;
  nm := coalesce(nm, 'Алхимик');
  if p_action in ('accept', 'decline') then
    if not exists (select 1 from public.coven_requests where uid = p_uid and coven_id = m.coven_id) then raise exception 'no request'; end if;
    delete from public.coven_requests where uid = p_uid and coven_id = m.coven_id;
    if p_action = 'accept' then
      if exists (select 1 from public.coven_members where uid = p_uid) then raise exception 'already in coven'; end if;
      if (select count(*) from public.coven_members where coven_id = m.coven_id) >= 30 then raise exception 'full'; end if;
      insert into public.coven_members (uid, coven_id, week_key) values (p_uid, m.coven_id, (public._keys())[2]);
      delete from public.coven_requests where uid = p_uid;
      perform public._coven_sys(m.coven_id, '👋 ' || nm || ' теперь в ковене');
    end if;
    return;
  end if;
  select * into t from public.coven_members where uid = p_uid and coven_id = m.coven_id;
  if not found or p_uid = me then raise exception 'bad target'; end if;
  if p_action = 'kick' then
    if t.role = 'leader' or (t.role = 'deputy' and m.role <> 'leader') then raise exception 'no right'; end if;
    delete from public.coven_members where uid = p_uid;
    perform public._coven_sys(m.coven_id, '🚪 ' || nm || ' больше не в ковене');
  elsif p_action in ('promote', 'demote', 'lead') then
    if m.role <> 'leader' then raise exception 'no right'; end if;
    if p_action = 'promote' then update public.coven_members set role = 'deputy' where uid = p_uid;
      perform public._coven_sys(m.coven_id, '⭐ ' || nm || ' теперь заместитель главы');
    elsif p_action = 'demote' then update public.coven_members set role = 'member' where uid = p_uid;
    else
      update public.coven_members set role = 'deputy' where uid = me;
      update public.coven_members set role = 'leader' where uid = p_uid;
      perform public._coven_sys(m.coven_id, '👑 Новый глава: ' || nm);
    end if;
  else raise exception 'bad action';
  end if;
end $$;

create or replace function public.coven_edit(init_data text, p_motto text, p_emblem text, p_color text, p_open boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; m public.coven_members;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into m from public.coven_members where uid = me;
  if not found or m.role <> 'leader' then raise exception 'no right'; end if;
  update public.covens set motto = left(trim(coalesce(p_motto, motto)), 80),
    emblem = case when p_emblem ~ '^e[0-9]{2}$' then p_emblem else emblem end,
    color = left(coalesce(p_color, color), 12), open = coalesce(p_open, open)
  where id = m.coven_id;
end $$;

-- ---------- чат ковена ----------
create or replace function public.chat_list(init_data text, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; c bigint;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select coven_id into c from public.coven_members where uid = me;
  if c is null then return '[]'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'uid', x.uid, 'name', p.name, 'photo', p.photo, 'text', x.text, 'at', x.at, 'me', x.uid = me) order by x.id)
    from (select * from public.coven_chat where coven_id = c and not hidden and id > coalesce(p_after, 0) order by id desc limit 60) x
    left join public.players p on p.tg_id = x.uid), '[]');
end $$;

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
  insert into public.coven_chat (coven_id, uid, text) values (c, me, left(t, 300)) returning id into nid;
  return nid;
end $$;

create or replace function public.chat_report(init_data text, p_msg bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  if not exists (select 1 from public.coven_chat x join public.coven_members m on m.coven_id = x.coven_id and m.uid = me where x.id = p_msg) then raise exception 'no msg'; end if;
  insert into public.chat_reports (msg_id, uid) values (p_msg, me) on conflict do nothing;
end $$;

-- =====================================================================
--  Админка: жалобы, ковены, заглушить в чате
-- =====================================================================
create or replace function public.adm_reports(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, 'ban');
  return coalesce((select jsonb_agg(r order by r->>'at' desc) from (
    select jsonb_build_object('msg', x.id, 'text', x.text, 'at', max(cr.at), 'count', count(*), 'uid', x.uid, 'name', p.name, 'photo', p.photo,
      'coven', c.name, 'chat_ban', p.chat_ban, 'hidden', x.hidden) r
    from public.chat_reports cr join public.coven_chat x on x.id = cr.msg_id
    left join public.players p on p.tg_id = x.uid left join public.covens c on c.id = x.coven_id
    where not cr.done group by x.id, x.text, x.uid, p.name, p.photo, c.name, p.chat_ban, x.hidden limit 100) y), '[]');
end $$;

create or replace function public.adm_report_done(init_data text, p_msg bigint, p_hide boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; u bigint;
begin
  a := public._can(init_data, 'ban');
  update public.chat_reports set done = true where msg_id = p_msg;
  if p_hide then update public.coven_chat set hidden = true where id = p_msg returning uid into u;
    perform public._log(a, 'Скрыл сообщение', u, jsonb_build_object('msg', p_msg));
  end if;
end $$;

create or replace function public.adm_covens(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, '');
  return coalesce((select jsonb_agg(public._coven_json(c, (select count(*) from public.coven_members m where m.coven_id = c.id))
      || jsonb_build_object('leader', (select p.name from public.coven_members m join public.players p on p.tg_id = m.uid where m.coven_id = c.id and m.role = 'leader' limit 1),
                            'created_at', c.created_at)
      order by c.xp desc) from public.covens c where not c.deleted), '[]');
end $$;

create or replace function public.adm_coven_chat(init_data text, p_coven bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, 'ban');
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'uid', x.uid, 'name', p.name, 'text', x.text, 'at', x.at, 'hidden', x.hidden) order by x.id)
    from (select * from public.coven_chat where coven_id = p_coven order by id desc limit 150) x left join public.players p on p.tg_id = x.uid), '[]');
end $$;

create or replace function public.adm_coven_rename(init_data text, p_coven bigint, p_name text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; nm text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  a := public._can(init_data, 'ban');
  if length(nm) < 3 or length(nm) > 20 then raise exception 'bad name'; end if;
  update public.covens set name = nm, motto = '' where id = p_coven;
  perform public._log(a, 'Переименовал ковен', null, jsonb_build_object('coven', p_coven, 'name', nm));
end $$;

-- флаги игрока: + chat_ban (заглушить в чате)
create or replace function public.adm_set_player(init_data text, p_id bigint, f jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, '');
  if (f ? 'banned' or f ? 'ban_reason' or f ? 'top_ban' or f ? 'no_gift' or f ? 'chat_ban') then perform public._can(init_data, 'ban'); end if;
  if f ? 'note' then perform public._can(init_data, 'notes'); end if;
  if f ? 'name' then perform public._can(init_data, 'edit'); end if;
  if exists (select 1 from public.admins where tg_id = p_id and role = 'creator') and (f ? 'banned' or f ? 'top_ban' or f ? 'no_gift' or f ? 'chat_ban') then raise exception 'creator is fixed'; end if;
  update public.players set
    banned = coalesce((f->>'banned')::boolean, banned),
    ban_reason = left(coalesce(f->>'ban_reason', ban_reason), 200),
    top_ban = coalesce((f->>'top_ban')::boolean, top_ban),
    no_gift = coalesce((f->>'no_gift')::boolean, no_gift),
    chat_ban = coalesce((f->>'chat_ban')::boolean, chat_ban),
    note = left(coalesce(f->>'note', note), 1000),
    name = left(coalesce(nullif(trim(f->>'name'), ''), name), 20)
  where tg_id = p_id;
  perform public._log(a, 'Изменил игрока', p_id, f);
end $$;

revoke execute on function public._coven_level(double precision) from public, anon, authenticated;
revoke execute on function public._coven_need(int) from public, anon, authenticated;
revoke execute on function public._coven_sys(bigint, text) from public, anon, authenticated;
revoke execute on function public._coven_json(public.covens, bigint) from public, anon, authenticated;
grant execute on function public.coven_list(text, text) to anon, authenticated;
grant execute on function public.coven_me(text) to anon, authenticated;
grant execute on function public.coven_create(text, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.coven_join(text, bigint) to anon, authenticated;
grant execute on function public.coven_cancel_request(text, bigint) to anon, authenticated;
grant execute on function public.coven_leave(text) to anon, authenticated;
grant execute on function public.coven_manage(text, text, bigint) to anon, authenticated;
grant execute on function public.coven_edit(text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.chat_list(text, bigint) to anon, authenticated;
grant execute on function public.chat_send(text, text) to anon, authenticated;
grant execute on function public.chat_report(text, bigint) to anon, authenticated;
grant execute on function public.adm_reports(text) to anon, authenticated;
grant execute on function public.adm_report_done(text, bigint, boolean) to anon, authenticated;
grant execute on function public.adm_covens(text) to anon, authenticated;
grant execute on function public.adm_coven_chat(text, bigint) to anon, authenticated;
grant execute on function public.adm_coven_rename(text, bigint, text) to anon, authenticated;
grant execute on function public.adm_set_player(text, bigint, jsonb) to anon, authenticated;

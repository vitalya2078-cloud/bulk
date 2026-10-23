-- =====================================================================
--  Бульк 0.25 - посты в группы ВКонтакте по кругу (пиар-группы с открытыми стенами).
--  * Список групп, один пост, цикл: раз в минуту - одна группа, каждая группа - не чаще выбранного промежутка
--    (30 минут ... 12 часов). Прошлый пост в группе удаляется перед новым (при 30 минутах - всегда).
--  * Пределы: на группу в сутки (до 24) и на аккаунт в сутки (до 100).
--  * Капча ВК: цикл встаёт на паузу, команда вводит ответ в админке. Лимит ВК - пауза до завтра.
--  Публикует функция bcast с личным ключом ВК создателя (private_secrets: vk_user_token).
--  Ключ записывается из админки (только создатель) и наружу не отдаётся.
--  Вставить целиком в SQL Editor -> Run. Можно запускать повторно.
-- =====================================================================

create table if not exists public.wall_groups (
  gid bigint primary key,                    -- id сообщества ВК (положительный)
  name text not null default '',
  screen text not null default '',
  photo text not null default '',
  can_post boolean,                          -- стена открыта для твоих постов (по проверке ВК)
  enabled boolean not null default true,
  last_post bigint,                          -- id последнего нашего поста на этой стене
  last_at timestamptz,
  day text not null default '',
  day_n int not null default 0,
  err text,
  added_at timestamptz not null default now()
);
create table if not exists public.wall_job (
  id int primary key default 1 check (id = 1),
  msg jsonb not null default '{}',           -- text, media[{url,kind,name}], link
  att text,                                  -- загруженные во ВК фото (photo1_2,...), сбрасывается при смене поста
  every_min int not null default 180,
  per_group int not null default 12,
  per_day int not null default 60,
  replace_prev boolean not null default true,
  active boolean not null default false,
  pause text,                                -- captcha / limit / token / null
  pause_until timestamptz,
  captcha jsonb,                             -- {sid, img, key}
  updated_at timestamptz not null default now(),
  updated_by bigint
);
insert into public.wall_job (id) values (1) on conflict do nothing;
create table if not exists public.wall_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  gid bigint not null,
  ok boolean not null,
  post_id bigint,
  err text
);
create index if not exists wall_log_at on public.wall_log (at desc);
alter table public.wall_groups enable row level security;
alter table public.wall_job enable row level security;
alter table public.wall_log enable row level security;
revoke all on public.wall_groups, public.wall_job, public.wall_log from anon, authenticated;

-- ---------- для админки ----------
create or replace function public.adm_wall_get(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; d text := to_char(now() at time zone 'Europe/Moscow', 'YYYY-MM-DD'); t jsonb;
begin
  a := public._can(init_data, 'mail_all');
  select jsonb_build_object('set', (select v is not null and v <> '' from public.private_secrets where k = 'vk_user_token'),
    'until', (select v from public.private_secrets where k = 'vk_user_token_until')) into t;
  return jsonb_build_object(
    'token', coalesce(t, '{}'),
    'creator', exists (select 1 from public.admins where tg_id = a and role = 'creator'),
    'job', (select to_jsonb(j) - 'captcha' || jsonb_build_object('captcha_img', j.captcha->>'img', 'captcha_wait', j.captcha is not null and coalesce(j.captcha->>'key', '') = '')
            from public.wall_job j where id = 1),
    'today', (select count(*) from public.wall_log where ok and at > (date_trunc('day', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow')),
    'groups', coalesce((select jsonb_agg(jsonb_build_object('gid', g.gid, 'name', g.name, 'screen', g.screen, 'photo', g.photo, 'can_post', g.can_post,
        'enabled', g.enabled, 'last_post', g.last_post, 'last_at', g.last_at, 'day_n', case when g.day = d then g.day_n else 0 end, 'err', g.err) order by g.added_at)
      from public.wall_groups g where g.gid > 0), '[]'),
    'log', coalesce((select jsonb_agg(jsonb_build_object('at', l.at, 'gid', l.gid, 'name', g.name, 'ok', l.ok, 'post_id', l.post_id, 'err', l.err) order by l.id desc)
      from (select * from public.wall_log order by id desc limit 40) l left join public.wall_groups g on g.gid = l.gid), '[]'));
end $$;

-- p: {msg, every_min, per_group, per_day, replace_prev}
create or replace function public.adm_wall_save(init_data text, p jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; ev int; old jsonb;
begin
  a := public._can(init_data, 'mail_all');
  ev := coalesce((p->>'every_min')::int, 180);
  if ev not in (30, 60, 120, 180, 360, 720) then raise exception 'bad interval'; end if;
  select msg into old from public.wall_job where id = 1;
  if p ? 'msg' and length((p->'msg')::text) > 20000 then raise exception 'too long'; end if;
  update public.wall_job set
    msg = coalesce(p->'msg', msg),
    att = case when p ? 'msg' and (p->'msg'->'media') is distinct from (old->'media') then null else att end,
    every_min = ev,
    per_group = greatest(1, least(24, coalesce((p->>'per_group')::int, per_group))),
    per_day = greatest(1, least(100, coalesce((p->>'per_day')::int, per_day))),
    replace_prev = case when ev < 60 then true else coalesce((p->>'replace_prev')::boolean, replace_prev) end,
    updated_at = now(), updated_by = a
  where id = 1;
end $$;

-- p_cmd: start / pause / stop / captcha (p_key)
create or replace function public.adm_wall_cmd(init_data text, p_cmd text, p_key text default '') returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; j public.wall_job;
begin
  a := public._can(init_data, 'mail_all');
  select * into j from public.wall_job where id = 1;
  if p_cmd = 'start' then
    if coalesce(trim(j.msg->>'text'), '') = '' and jsonb_array_length(coalesce(j.msg->'media', '[]')) = 0 then raise exception 'empty'; end if;
    if not exists (select 1 from public.private_secrets where k = 'vk_user_token' and v <> '') then raise exception 'no token'; end if;
    if not exists (select 1 from public.wall_groups where enabled) then raise exception 'no groups'; end if;
    update public.wall_job set active = true, pause = case when pause = 'captcha' then pause else null end, pause_until = null, updated_at = now(), updated_by = a where id = 1;
    perform public._log(a, 'Посты в группы', null, jsonb_build_object('cmd', 'start', 'every', j.every_min, 'text', left(j.msg->>'text', 80)));
  elsif p_cmd = 'pause' or p_cmd = 'stop' then
    update public.wall_job set active = false, updated_at = now(), updated_by = a where id = 1;
    perform public._log(a, 'Посты в группы', null, jsonb_build_object('cmd', p_cmd));
  elsif p_cmd = 'captcha' then
    if trim(coalesce(p_key, '')) = '' then raise exception 'empty'; end if;
    update public.wall_job set captcha = coalesce(captcha, '{}') || jsonb_build_object('key', trim(p_key)), pause = null where id = 1;
  else raise exception 'bad cmd'; end if;
end $$;

-- группы: добавить (после проверки функцией bcast), включить/выключить, убрать
create or replace function public.adm_wall_group(init_data text, p_gid bigint, p_cmd text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, 'mail_all');
  if p_cmd = 'on' then update public.wall_groups set enabled = true, err = null where gid = p_gid;
  elsif p_cmd = 'off' then update public.wall_groups set enabled = false where gid = p_gid;
  elsif p_cmd = 'remove' then update public.wall_groups set enabled = false, gid = -gid where gid = p_gid and gid > 0;  -- скрыть, история остаётся
  else raise exception 'bad cmd'; end if;
end $$;

-- ключ ВК создателя: записать может только создатель; срок действия - если ВК его дал
create or replace function public.adm_wall_token(init_data text, p_token text, p_expires int default 0) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, 'mail_all');
  if not exists (select 1 from public.admins where tg_id = a and role = 'creator') then raise exception 'creator only'; end if;
  if length(coalesce(p_token, '')) < 20 then raise exception 'bad token'; end if;
  insert into public.private_secrets (k, v) values ('vk_user_token', trim(p_token)) on conflict (k) do update set v = excluded.v;
  insert into public.private_secrets (k, v) values ('vk_user_token_until', case when coalesce(p_expires, 0) > 0 then (now() + make_interval(secs => p_expires))::text else '' end)
    on conflict (k) do update set v = excluded.v;
  update public.wall_job set pause = null where id = 1 and pause = 'token';
  perform public._log(a, 'Посты в группы', null, jsonb_build_object('cmd', 'token'));
end $$;

-- ---------- для функции bcast (service_role) ----------
create or replace function public.wall_groups_put(p jsonb) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.wall_groups (gid, name, screen, photo, can_post, enabled, err)
  select (x->>'gid')::bigint, left(coalesce(x->>'name', ''), 120), left(coalesce(x->>'screen', ''), 80), left(coalesce(x->>'photo', ''), 300),
         (x->>'can_post')::boolean, coalesce((x->>'can_post')::boolean, false), case when (x->>'can_post')::boolean then null else 'стена закрыта' end
  from jsonb_array_elements(p) x
  on conflict (gid) do update set name = excluded.name, screen = excluded.screen, photo = excluded.photo, can_post = excluded.can_post,
    enabled = case when excluded.can_post then true else false end, err = excluded.err
$$;

-- что публиковать сейчас: одна группа за вызов (раз в минуту)
create or replace function public.wall_next() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j public.wall_job; g public.wall_groups; d text := to_char(now() at time zone 'Europe/Moscow', 'YYYY-MM-DD'); n int;
begin
  select * into j from public.wall_job where id = 1 for update;
  if not j.active then return null; end if;
  if j.pause = 'captcha' then return null; end if;
  if j.pause is not null and (j.pause_until is null or j.pause_until > now()) then return null; end if;
  if j.pause is not null then update public.wall_job set pause = null, pause_until = null where id = 1; end if;
  select count(*) into n from public.wall_log where ok and at > (date_trunc('day', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow');
  if n >= j.per_day then return null; end if;
  select * into g from public.wall_groups
    where gid > 0 and enabled and (last_at is null or last_at <= now() - make_interval(mins => j.every_min) + interval '20 seconds')
      and (day <> d or day_n < j.per_group)
    order by last_at nulls first, added_at limit 1 for update skip locked;
  if not found then return null; end if;
  return jsonb_build_object('gid', g.gid, 'last_post', case when j.replace_prev then g.last_post end, 'msg', j.msg, 'att', j.att,
    'captcha', case when coalesce(j.captcha->>'key', '') <> '' then j.captcha end);
end $$;

-- итог публикации. p: {gid, ok, post_id, err, kind: captcha/limit/token/group/other, captcha:{sid,img}, att}
create or replace function public.wall_done(p jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare g_id bigint := (p->>'gid')::bigint; d text := to_char(now() at time zone 'Europe/Moscow', 'YYYY-MM-DD'); k text := p->>'kind';
begin
  if p ? 'att' then update public.wall_job set att = p->>'att' where id = 1; end if;
  if coalesce((p->>'ok')::boolean, false) then
    update public.wall_groups set last_post = (p->>'post_id')::bigint, last_at = now(), err = null,
      day_n = case when day = d then day_n + 1 else 1 end, day = d where wall_groups.gid = g_id;
    update public.wall_job set captcha = null where id = 1;
    insert into public.wall_log (gid, ok, post_id) values (g_id, true, (p->>'post_id')::bigint);
    return;
  end if;
  insert into public.wall_log (gid, ok, err) values (g_id, false, left(coalesce(p->>'err', ''), 200));
  if k = 'captcha' then
    update public.wall_job set pause = 'captcha', captcha = p->'captcha' where id = 1;
  elsif k = 'limit' then
    update public.wall_job set pause = 'limit', pause_until = (date_trunc('day', now() at time zone 'Europe/Moscow') + interval '1 day') at time zone 'Europe/Moscow' where id = 1;
  elsif k = 'token' then
    update public.wall_job set pause = 'token' where id = 1;
  elsif k = 'group' then
    update public.wall_groups set enabled = false, err = left(coalesce(p->>'err', ''), 200) where wall_groups.gid = g_id;
  else
    -- разовая ошибка: попробуем эту группу в следующий круг
    update public.wall_groups set last_at = now(), err = left(coalesce(p->>'err', ''), 200) where wall_groups.gid = g_id;
  end if;
end $$;

create or replace function public.wall_token() returns text
language sql stable security definer set search_path = public, extensions as $$
  select v from public.private_secrets where k = 'vk_user_token'
$$;

-- раз в минуту: если цикл включён - будим функцию bcast
create or replace function public._wall_kick() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  if not exists (select 1 from public.wall_job where id = 1 and active and coalesce(pause, '') <> 'captcha') then return; end if;
  select v into s from public.private_secrets where k = 'bcast_cron';
  perform net.http_post(
    url := 'https://ahqaficklfciahzlghec.supabase.co/functions/v1/bcast',
    body := '{"action":"wall"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bcast', coalesce(s, '')));
end $$;

revoke execute on function public.wall_groups_put(jsonb) from public, anon, authenticated;
revoke execute on function public.wall_next() from public, anon, authenticated;
revoke execute on function public.wall_done(jsonb) from public, anon, authenticated;
revoke execute on function public.wall_token() from public, anon, authenticated;
revoke execute on function public._wall_kick() from public, anon, authenticated;
do $$ begin
  grant execute on function public.wall_groups_put(jsonb) to service_role;
  grant execute on function public.wall_next() to service_role;
  grant execute on function public.wall_done(jsonb) to service_role;
  grant execute on function public.wall_token() to service_role;
exception when others then raise notice 'service_role: %', sqlerrm; end $$;
grant execute on function public.adm_wall_get(text) to anon, authenticated;
grant execute on function public.adm_wall_save(text, jsonb) to anon, authenticated;
grant execute on function public.adm_wall_cmd(text, text, text) to anon, authenticated;
grant execute on function public.adm_wall_group(text, bigint, text) to anon, authenticated;
grant execute on function public.adm_wall_token(text, text, int) to anon, authenticated;

do $$ begin
  perform cron.unschedule('bulk_wall') where exists (select 1 from cron.job where jobname = 'bulk_wall');
  perform cron.schedule('bulk_wall', '* * * * *', 'select public._wall_kick()');
exception when others then raise notice 'cron: %', sqlerrm; end $$;

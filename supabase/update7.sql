-- =====================================================================
--  Бульк 0.19 - приложение админки: вход по коду из игры.
--  В игре (ВК или Telegram) член команды берёт код из 6 цифр, вводит его в приложении
--  и получает ключ входа. Ключ хранится в базе только в виде отпечатка (sha256).
--  Вставить целиком в SQL Editor -> Run (на предупреждение - Run query). Можно запускать повторно.
-- =====================================================================

create table if not exists public.adm_codes (
  code text primary key,
  uid bigint not null,
  expires timestamptz not null
);
create table if not exists public.adm_sessions (
  id bigserial primary key,
  token_hash text not null unique,
  uid bigint not null,
  device text not null default '',
  created timestamptz not null default now(),
  seen timestamptz not null default now()
);
create table if not exists public.adm_login_fails (at timestamptz not null default now());

alter table public.adm_codes enable row level security;
alter table public.adm_sessions enable row level security;
alter table public.adm_login_fails enable row level security;
revoke all on public.adm_codes from anon, authenticated;
revoke all on public.adm_sessions from anon, authenticated;
revoke all on public.adm_login_fails from anon, authenticated;

-- ---------- кто это: "adm:" + ключ приложения, иначе подпись Telegram / ВК ----------
create or replace function public._who(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s public.adm_sessions;
begin
  if left(coalesce(init_data, ''), 4) = 'adm:' then
    select * into s from public.adm_sessions
      where token_hash = encode(extensions.digest(convert_to(substr(init_data, 5), 'UTF8'), 'sha256'), 'hex');
    if not found then raise exception 'bad session'; end if;
    if s.seen < now() - interval '60 days' or not exists (select 1 from public.admins where tg_id = s.uid) then
      delete from public.adm_sessions where id = s.id;
      raise exception 'bad session';
    end if;
    if s.seen < now() - interval '1 minute' then update public.adm_sessions set seen = now() where id = s.id; end if;
    return jsonb_build_object('id', s.uid, 'platform', 'app', 'session', s.id);
  end if;
  return public._tg_user(init_data);
end $$;

-- права: теперь и по ключу приложения
create or replace function public._can(init_data text, p_perm text) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare id bigint; a public.admins;
begin
  id := (public._who(init_data)->>'id')::bigint;
  select * into a from public.admins where tg_id = id;
  if not found then raise exception 'not admin'; end if;
  if p_perm <> '' and not (p_perm = any(public._perms(a.role, a.perms))) then raise exception 'no right: %', p_perm; end if;
  return id;
end $$;

-- кто я (+ какие соцсети привязаны)
create or replace function public.adm_me(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb; id bigint; a public.admins; p public.players;
begin
  u := public._who(init_data);
  id := (u->>'id')::bigint;
  if not exists (select 1 from public.admins) and (u->>'platform') <> 'app' then
    insert into public.admins (tg_id, role) values (id, 'creator');
    perform public._log(id, 'Стал создателем', id, '{}');
  end if;
  select * into a from public.admins where tg_id = id;
  select * into p from public.players where tg_id = id;
  if a.tg_id is null then return jsonb_build_object('id', id, 'role', null, 'perms', '[]'::jsonb); end if;
  return jsonb_build_object('id', id, 'role', a.role, 'perms', to_jsonb(public._perms(a.role, a.perms)),
    'name', p.name, 'photo', p.photo, 'tg', p.tg, 'vk', p.vk, 'platform', u->>'platform');
end $$;

-- ---------- код для входа: берётся в игре, только для команды ----------
create or replace function public.adm_login_code(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; c text;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  if not exists (select 1 from public.admins where tg_id = me) then raise exception 'not admin'; end if;
  delete from public.adm_codes where uid = me or expires < now();
  loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.adm_codes where code = c);
  end loop;
  insert into public.adm_codes values (c, me, now() + interval '5 minutes');
  return jsonb_build_object('code', c, 'ttl', 300);
end $$;

-- ---------- вход в приложении: код -> ключ ----------
create or replace function public.adm_login(p_code text, p_device text default '') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; t text;
begin
  delete from public.adm_login_fails where at < now() - interval '10 minutes';
  -- защита от перебора: не больше 20 ошибок за 10 минут на всех
  -- ошибки возвращаем ответом, а не исключением: иначе запись об ошибке откатится
  if (select count(*) from public.adm_login_fails) >= 20 then return jsonb_build_object('error', 'too many tries'); end if;
  delete from public.adm_codes where expires < now();
  delete from public.adm_codes where code = trim(coalesce(p_code, '')) returning uid into me;
  if me is null or not exists (select 1 from public.admins where tg_id = me) then
    insert into public.adm_login_fails default values;
    return jsonb_build_object('error', 'bad code');
  end if;
  t := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.adm_sessions (token_hash, uid, device)
    values (encode(extensions.digest(convert_to(t, 'UTF8'), 'sha256'), 'hex'), me, left(coalesce(p_device, ''), 60));
  perform public._log(me, 'Вход в приложение', me, jsonb_build_object('device', left(coalesce(p_device, ''), 60)));
  return jsonb_build_object('token', t, 'id', me);
end $$;

create or replace function public.adm_logout(init_data text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb;
begin
  if left(coalesce(init_data, ''), 4) <> 'adm:' then return; end if;
  u := public._who(init_data);
  delete from public.adm_sessions where id = (u->>'session')::bigint;
end $$;

-- мои устройства
create or replace function public.adm_devices(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb; me bigint;
begin
  u := public._who(init_data);
  me := public._can(init_data, '');
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'device', s.device, 'created', s.created, 'seen', s.seen,
      'current', s.id = (u->>'session')::bigint) order by s.seen desc)
    from public.adm_sessions s where s.uid = me), '[]');
end $$;

create or replace function public.adm_device_drop(init_data text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint;
begin
  me := public._can(init_data, '');
  delete from public.adm_sessions where id = p_id and uid = me;
end $$;

-- код привязки второй соцсети прямо из приложения (вводится в игре на другой платформе)
create or replace function public.adm_link_code(init_data text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; c text;
begin
  me := public._can(init_data, '');
  if not exists (select 1 from public.players where tg_id = me) then raise exception 'play first'; end if;
  delete from public.link_codes where uid = me or expires < now();
  loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.link_codes where code = c);
  end loop;
  insert into public.link_codes values (c, me, now() + interval '10 minutes');
  return c;
end $$;

-- после объединения аккаунтов входы приложения переезжают на общий аккаунт
create or replace function public._adm_sessions_move() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tg_id <> old.tg_id then update public.adm_sessions set uid = new.tg_id where uid = old.tg_id; end if;
  return new;
end $$;
drop trigger if exists adm_sessions_move on public.admins;
create trigger adm_sessions_move after update of tg_id on public.admins for each row execute function public._adm_sessions_move();

revoke execute on function public._who(text) from public, anon, authenticated;
revoke execute on function public._adm_sessions_move() from public, anon, authenticated;
grant execute on function public.adm_me(text) to anon, authenticated;
grant execute on function public.adm_login_code(text) to anon, authenticated;
grant execute on function public.adm_login(text, text) to anon, authenticated;
grant execute on function public.adm_logout(text) to anon, authenticated;
grant execute on function public.adm_devices(text) to anon, authenticated;
grant execute on function public.adm_device_drop(text, bigint) to anon, authenticated;
grant execute on function public.adm_link_code(text) to anon, authenticated;

-- update21 (0.26.0): ключ ВК для постов в группы через код (Authorization Code Flow).
-- Ключ из ссылки в браузере ВК привязывает к адресу телефона («access_token was given to another ip address»),
-- поэтому код из адреса страницы меняет на ключ сама функция bcast (action wall_code) защищённым ключом приложения.

-- защищённый ключ приложения - только для функции
create or replace function public.wall_app_secret() returns text
language sql stable security definer set search_path = public, extensions as $$
  select v from public.private_secrets where k = 'vk_secret'
$$;

-- сохранить ключ, полученный функцией по коду (p_admin - кто получал, для журнала)
create or replace function public.wall_token_put(p_token text, p_expires int, p_admin bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare t text := trim(coalesce(p_token, ''));
begin
  if length(t) < 20 or t !~ '^[A-Za-z0-9._-]+$' then raise exception 'bad token'; end if;
  insert into public.private_secrets (k, v) values ('vk_user_token', t) on conflict (k) do update set v = excluded.v;
  insert into public.private_secrets (k, v) values ('vk_user_token_until', case when coalesce(p_expires, 0) > 0 then (now() + make_interval(secs => p_expires))::text else '' end)
    on conflict (k) do update set v = excluded.v;
  update public.wall_job set pause = null where id = 1 and pause = 'token';
  perform public._log(p_admin, 'Посты в группы', null, jsonb_build_object('cmd', 'token', 'how', 'code'));
end $$;

-- кто просит: только создатель (по подписи платформы)
create or replace function public.wall_creator(init_data text) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, 'mail_all');
  if not exists (select 1 from public.admins where tg_id = a and role = 'creator') then raise exception 'creator only'; end if;
  return a;
end $$;

revoke execute on function public.wall_creator(text) from public, anon, authenticated;
revoke execute on function public.wall_app_secret() from public, anon, authenticated;
revoke execute on function public.wall_token_put(text, int, bigint) from public, anon, authenticated;
do $$ begin
  grant execute on function public.wall_app_secret() to service_role;
  grant execute on function public.wall_creator(text) to service_role;
  grant execute on function public.wall_token_put(text, int, bigint) to service_role;
exception when others then raise notice 'service_role: %', sqlerrm; end $$;

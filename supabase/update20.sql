-- update20 (0.25.9): ключ ВК для постов в группы
--  * adm_wall_token принимает только сам ключ (буквы, цифры, точка, -, _), ссылку не примет;
--  * wall_token не отдаёт истёкший ключ - цикл встаёт на паузу «нужен ключ», а не ловит ошибку 5;
--  * сохранённая по ошибке ссылка авторизации вместо ключа очищается.

create or replace function public.adm_wall_token(init_data text, p_token text, p_expires int default 0) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; t text := trim(coalesce(p_token, ''));
begin
  a := public._can(init_data, 'mail_all');
  if not exists (select 1 from public.admins where tg_id = a and role = 'creator') then raise exception 'creator only'; end if;
  if length(t) < 20 or t !~ '^[A-Za-z0-9._-]+$' then raise exception 'bad token'; end if;
  insert into public.private_secrets (k, v) values ('vk_user_token', t) on conflict (k) do update set v = excluded.v;
  insert into public.private_secrets (k, v) values ('vk_user_token_until', case when coalesce(p_expires, 0) > 0 then (now() + make_interval(secs => p_expires))::text else '' end)
    on conflict (k) do update set v = excluded.v;
  update public.wall_job set pause = null where id = 1 and pause = 'token';
  perform public._log(a, 'Посты в группы', null, jsonb_build_object('cmd', 'token'));
end $$;

create or replace function public.wall_token() returns text
language sql stable security definer set search_path = public, extensions as $$
  select t.v from public.private_secrets t
  where t.k = 'vk_user_token' and t.v ~ '^[A-Za-z0-9._-]{20,}$'
    and not exists (select 1 from public.private_secrets u where u.k = 'vk_user_token_until' and u.v <> '' and u.v::timestamptz < now())
$$;
revoke execute on function public.wall_token() from public, anon, authenticated;
do $$ begin
  grant execute on function public.wall_token() to service_role;
exception when others then raise notice 'service_role: %', sqlerrm; end $$;

update public.private_secrets set v = '' where k = 'vk_user_token' and v !~ '^[A-Za-z0-9._-]{20,}$';

-- =====================================================================
--  Бульк 0.15 - команда: создатель, админы, модераторы, поддержка, свои права.
--  Вставить целиком в SQL Editor и нажать Run (предупреждение Supabase - нажать Run query).
--  Можно запускать повторно.
-- =====================================================================

alter table public.admins add column if not exists role text not null default 'admin';
alter table public.admins add column if not exists perms text[] not null default '{}';
alter table public.admins add column if not exists added_by bigint;
-- самый первый админ - создатель
update public.admins set role = 'creator'
  where tg_id = (select tg_id from public.admins order by added_at, tg_id limit 1)
    and not exists (select 1 from public.admins where role = 'creator');

-- права: ban, gift, edit, reset, mail, mail_all, notes, settings, maint, log, team
create or replace function public._perms(p_role text, p_perms text[]) returns text[]
language sql immutable as $$
  select case p_role
    when 'creator'   then array['ban','gift','edit','reset','mail','mail_all','notes','settings','maint','log','team']
    when 'admin'     then array['ban','gift','edit','mail','mail_all','notes','settings','log']
    when 'moderator' then array['ban','notes','log']
    when 'support'   then array['mail','notes']
    else coalesce(p_perms, '{}') end
$$;

-- проверка доступа: p_perm = '' - просто член команды
create or replace function public._can(init_data text, p_perm text) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare id bigint; a public.admins;
begin
  id := (public._tg_user(init_data)->>'id')::bigint;
  select * into a from public.admins where tg_id = id;
  if not found then raise exception 'not admin'; end if;
  if p_perm <> '' and not (p_perm = any(public._perms(a.role, a.perms))) then raise exception 'no right: %', p_perm; end if;
  return id;
end $$;

-- старая проверка = член команды
create or replace function public._adm(init_data text) returns bigint
language sql security definer set search_path = public, extensions as $$ select public._can(init_data, '') $$;

-- кто я (и если команды ещё нет - становлюсь создателем)
create or replace function public.adm_me(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb; id bigint; a public.admins;
begin
  u := public._tg_user(init_data);
  id := (u->>'id')::bigint;
  if not exists (select 1 from public.admins) then
    insert into public.admins (tg_id, role) values (id, 'creator');
    perform public._log(id, 'Стал создателем', id, '{}');
  end if;
  select * into a from public.admins where tg_id = id;
  if not found then return jsonb_build_object('id', id, 'role', null, 'perms', '[]'::jsonb); end if;
  return jsonb_build_object('id', id, 'role', a.role, 'perms', to_jsonb(public._perms(a.role, a.perms)));
end $$;

create or replace function public.adm_claim(init_data text) returns boolean
language sql security definer set search_path = public, extensions as $$ select (public.adm_me(init_data)->>'role') is not null $$;

-- команда
create or replace function public.adm_team(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint;
begin
  me := public._can(init_data, '');
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.tg_id, 'role', a.role, 'perms', to_jsonb(public._perms(a.role, a.perms)),
      'own', to_jsonb(a.perms), 'added_at', a.added_at, 'name', p.name, 'username', p.username, 'photo', p.photo, 'last_seen', p.last_seen)
      order by case a.role when 'creator' then 0 when 'admin' then 1 when 'moderator' then 2 when 'support' then 3 else 4 end, a.added_at)
    from public.admins a left join public.players p on p.tg_id = a.tg_id), '[]');
end $$;

create or replace function public.adm_team_set(init_data text, p_id bigint, p_role text, p_perms text[] default '{}')
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; okp text[] := array['ban','gift','edit','reset','mail','mail_all','notes','settings','maint','log'];
begin
  me := public._can(init_data, 'team');
  if p_role not in ('admin', 'moderator', 'support', 'custom') then raise exception 'bad role'; end if;
  if exists (select 1 from public.admins where tg_id = p_id and role = 'creator') then raise exception 'creator is fixed'; end if;
  insert into public.admins (tg_id, role, perms, added_by) values (p_id, p_role,
      case when p_role = 'custom' then (select coalesce(array_agg(x), '{}') from unnest(p_perms) x where x = any(okp)) else '{}' end, me)
    on conflict (tg_id) do update set role = excluded.role, perms = excluded.perms;
  perform public._log(me, 'Назначил в команду', p_id, jsonb_build_object('role', p_role, 'perms', to_jsonb(p_perms)));
end $$;

create or replace function public.adm_team_remove(init_data text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint;
begin
  me := public._can(init_data, 'team');
  if exists (select 1 from public.admins where tg_id = p_id and role = 'creator') then raise exception 'creator is fixed'; end if;
  delete from public.admins where tg_id = p_id;
  perform public._log(me, 'Убрал из команды', p_id, '{}');
end $$;

-- ---------- права на действия ----------
create or replace function public.adm_set_player(init_data text, p_id bigint, f jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, '');
  if (f ? 'banned' or f ? 'ban_reason' or f ? 'top_ban' or f ? 'no_gift') then perform public._can(init_data, 'ban'); end if;
  if f ? 'note' then perform public._can(init_data, 'notes'); end if;
  if f ? 'name' then perform public._can(init_data, 'edit'); end if;
  if exists (select 1 from public.admins where tg_id = p_id and role = 'creator') and (f ? 'banned' or f ? 'top_ban' or f ? 'no_gift') then raise exception 'creator is fixed'; end if;
  update public.players set
    banned = coalesce((f->>'banned')::boolean, banned),
    ban_reason = left(coalesce(f->>'ban_reason', ban_reason), 200),
    top_ban = coalesce((f->>'top_ban')::boolean, top_ban),
    no_gift = coalesce((f->>'no_gift')::boolean, no_gift),
    note = left(coalesce(f->>'note', note), 1000),
    name = left(coalesce(nullif(trim(f->>'name'), ''), name), 20)
  where tg_id = p_id;
  perform public._log(a, 'Изменил игрока', p_id, f);
end $$;

create or replace function public.adm_patch(init_data text, p_id bigint, ops jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; k text;
begin
  a := public._can(init_data, '');
  if jsonb_typeof(ops) <> 'object' or ops = '{}' then raise exception 'empty'; end if;
  for k in select jsonb_object_keys(ops) loop
    perform public._can(init_data, case when k = 'reset' then 'reset' when k like 'add_%' then 'gift' else 'edit' end);
  end loop;
  insert into public.patches (tg_id, ops) values (p_id, ops);
  perform public._log(a, 'Правка сохранения', p_id, ops);
end $$;

create or replace function public.adm_patch_cancel(init_data text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; t bigint;
begin
  a := public._can(init_data, 'edit');
  delete from public.patches where id = p_id and applied_at is null returning tg_id into t;
  perform public._log(a, 'Отменил правку', t, jsonb_build_object('patch', p_id));
end $$;

create or replace function public.adm_score_delete(init_data text, p_id bigint, p_board text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, 'ban');
  delete from public.scores where tg_id = p_id and (p_board = 'all' or board = p_board);
  perform public._log(a, 'Удалил очки из топа', p_id, jsonb_build_object('board', p_board));
end $$;

create or replace function public.adm_mail_send(init_data text, p_to bigint, p_title text, p_body text, p_gift jsonb default '{}', p_days int default 0)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; nid bigint; g jsonb := '{}';
begin
  a := public._can(init_data, case when coalesce(p_to, 0) = 0 then 'mail_all' else 'mail' end);
  if trim(coalesce(p_title, '')) = '' then raise exception 'no title'; end if;
  if public._num(p_gift, 'cr') > 0 then g := g || jsonb_build_object('cr', least(100000, public._num(p_gift, 'cr')::int)); end if;
  if public._num(p_gift, 'ess_h') > 0 then g := g || jsonb_build_object('ess_h', least(1000, public._num(p_gift, 'ess_h'))); end if;
  if g <> '{}' then perform public._can(init_data, 'gift'); end if;
  insert into public.mail (to_tg, title, body, gift, until)
    values (nullif(p_to, 0), left(p_title, 80), left(coalesce(p_body, ''), 2000), g, case when p_days > 0 then now() + make_interval(days => p_days) end)
    returning id into nid;
  perform public._log(a, case when p_to = 0 then 'Письмо всем' else 'Письмо игроку' end, nullif(p_to, 0), jsonb_build_object('title', p_title, 'gift', g));
  return nid;
end $$;

create or replace function public.adm_mail_delete(init_data text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; t bigint;
begin
  select to_tg into t from public.mail where id = p_id;
  a := public._can(init_data, case when t is null then 'mail_all' else 'mail' end);
  update public.mail set deleted = true where id = p_id;
  perform public._log(a, 'Удалил письмо', null, jsonb_build_object('mail', p_id));
end $$;

create or replace function public.adm_setting(init_data text, p_k text, p_v jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  if p_k not in ('announce', 'boost', 'maint') then raise exception 'bad key'; end if;
  a := public._can(init_data, case when p_k = 'maint' then 'maint' else 'settings' end);
  if p_v is null or p_v = 'null'::jsonb then delete from public.settings where k = p_k;
  else insert into public.settings (k, v, updated_at) values (p_k, p_v, now()) on conflict (k) do update set v = excluded.v, updated_at = now();
  end if;
  perform public._log(a, 'Настройка ' || p_k, null, coalesce(p_v, 'null'::jsonb));
end $$;

create or replace function public.adm_log(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, 'log');
  return coalesce((select jsonb_agg(jsonb_build_object('at', l.at, 'action', l.action, 'target', l.target, 'name', p.name,
      'admin', l.admin, 'admin_name', ap.name, 'details', l.details) order by l.id desc)
    from (select * from public.admin_log order by id desc limit 200) l
    left join public.players p on p.tg_id = l.target left join public.players ap on ap.tg_id = l.admin), '[]');
end $$;

-- в карточке игрока - его роль в команде
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
    'patches', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'ops', x.ops, 'at', x.created_at, 'done', x.applied_at) order by x.id desc)
                      from (select * from public.patches where tg_id = p_id order by id desc limit 20) x), '[]'),
    'days', (select count(*) from public.active_days where tg_id = p_id),
    'invited', (select count(*) from public.players where ref = p_id),
    'ref_name', (select name from public.players where tg_id = (r->>'ref')::bigint),
    'team_role', (select role from public.admins where tg_id = p_id));
end $$;

revoke execute on function public._perms(text, text[]) from public, anon, authenticated;
revoke execute on function public._can(text, text) from public, anon, authenticated;
revoke execute on function public._adm(text) from public, anon, authenticated;
grant execute on function public.adm_me(text) to anon, authenticated;
grant execute on function public.adm_claim(text) to anon, authenticated;
grant execute on function public.adm_team(text) to anon, authenticated;
grant execute on function public.adm_team_set(text, bigint, text, text[]) to anon, authenticated;
grant execute on function public.adm_team_remove(text, bigint) to anon, authenticated;
grant execute on function public.adm_set_player(text, bigint, jsonb) to anon, authenticated;
grant execute on function public.adm_patch(text, bigint, jsonb) to anon, authenticated;
grant execute on function public.adm_patch_cancel(text, bigint) to anon, authenticated;
grant execute on function public.adm_score_delete(text, bigint, text) to anon, authenticated;
grant execute on function public.adm_mail_send(text, bigint, text, text, jsonb, int) to anon, authenticated;
grant execute on function public.adm_mail_delete(text, bigint) to anon, authenticated;
grant execute on function public.adm_setting(text, text, jsonb) to anon, authenticated;
grant execute on function public.adm_log(text) to anon, authenticated;
grant execute on function public.adm_player(text, bigint) to anon, authenticated;

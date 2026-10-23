-- =====================================================================
--  Бульк 0.21.2 - надёжность: видно, почему у игроков не грузится сохранение.
--  * boot_report: игра присылает короткий отчёт, только если загрузка пошла не так
--    (база или облако платформы не ответили, игра началась с нуля). Не больше 10 отчётов в сутки на игрока.
--  * adm_health: блок «Надёжность» в админке - сбои загрузки и сохранения, которые база не приняла
--    (защита от затирания прогресса сработала), за 7 дней.
--  Вставить целиком в SQL Editor -> Run. Можно запускать повторно.
-- =====================================================================

create table if not exists public.boot_log (
  id bigserial primary key,
  uid bigint not null,
  at timestamptz not null default now(),
  old_player boolean not null default false,    -- игрок не новый (был в игре раньше) - старт с нуля для него подозрителен
  info jsonb not null default '{}'
);
create index if not exists boot_log_at on public.boot_log (at desc);
create index if not exists boot_log_uid on public.boot_log (uid, at desc);
alter table public.boot_log enable row level security;
revoke all on public.boot_log from anon, authenticated;

create or replace function public.boot_report(init_data text, p jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; info jsonb := '{}'; k text;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  if (select count(*) from public.boot_log where uid = me and at > now() - interval '1 day') >= 10 then return; end if;
  -- берём только известные поля и короткие значения
  foreach k in array array['ver', 'plat', 'online', 'net', 'local', 'cloud', 'server', 'cloudMs', 'serverMs', 'retry', 'chosen'] loop
    if p ? k then info := info || jsonb_build_object(k, left(p->>k, 20)); end if;
  end loop;
  insert into public.boot_log (uid, old_player, info)
    values (me, exists (select 1 from public.players where tg_id = me and first_seen < now() - interval '10 minutes'), info);
end $$;

create or replace function public.adm_health(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._can(init_data, '');
  return jsonb_build_object(
    'rejected', (select count(*) from public.save_history where kind = 'rejected' and at > now() - interval '7 days'),
    'boot_fail', (select count(*) from public.boot_log where at > now() - interval '7 days' and info->>'server' like 'fail%'),
    'boot_fresh_old', (select count(*) from public.boot_log where at > now() - interval '7 days' and old_player and info->>'chosen' = 'fresh'),
    'boot_total', (select count(*) from public.boot_log where at > now() - interval '7 days'),
    'last', coalesce((select jsonb_agg(x order by x.at desc) from (
      select b.at, b.uid, coalesce(nullif(p.name, ''), 'Алхимик') as name, b.old_player, b.info
      from public.boot_log b left join public.players p on p.tg_id = b.uid
      order by b.at desc limit 15) x), '[]'),
    'rejected_last', coalesce((select jsonb_agg(x order by x.at desc) from (
      select h.at, h.uid, coalesce(nullif(p.name, ''), 'Алхимик') as name, h.le
      from public.save_history h left join public.players p on p.tg_id = h.uid
      where h.kind = 'rejected' order by h.at desc limit 10) x), '[]'));
end $$;

grant execute on function public.boot_report(text, jsonb) to anon, authenticated;
grant execute on function public.adm_health(text) to anon, authenticated;

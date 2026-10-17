-- =====================================================================
--  Бульк 0.20 - напоминания.
--  Telegram: сообщение от бота (токен уже в private_secrets: tg_bot_token).
--  ВКонтакте: уведомление приложения (нужен сервисный ключ приложения ВК - его вставляешь сам:
--    insert into public.private_secrets values ('vk_service', 'КЛЮЧ') on conflict (k) do update set v = excluded.v;).
--  Поводы: кладовая полна, питомец вернулся из похода, яйцо готово, босс ковена пришёл (пятница 12:00 МСК).
--  Не чаще 2 раз в сутки и не чаще раза в 3 часа, только с 9:00 до 22:00 по Москве, и только если игрок не в игре.
--  Нужны расширения pg_net (запросы наружу) и pg_cron (расписание) - этот файл включает их сам.
--  Вставить целиком в SQL Editor -> Run (на предупреждение - Run query). Можно запускать повторно.
-- =====================================================================

create table if not exists public.notify (
  uid bigint primary key,
  enabled boolean not null default false,
  full_at timestamptz,          -- кладовая заполнится
  pet_at timestamptz,           -- питомец вернётся
  egg_at timestamptz,           -- яйцо будет готово
  boss_week text not null default '',
  last_sent timestamptz,
  day text not null default '',
  day_count int not null default 0
);
alter table public.notify enable row level security;
revoke all on public.notify from anon, authenticated;

create table if not exists public.notify_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  uid bigint, platform text, kind text, text text, request_id bigint
);
alter table public.notify_log enable row level security;
revoke all on public.notify_log from anon, authenticated;

-- игра сообщает: включены ли напоминания и когда что случится (секунды unix или 0)
create or replace function public.notify_set(init_data text, p jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  p := coalesce(p, '{}');
  insert into public.notify (uid) values (me) on conflict do nothing;
  update public.notify set
    enabled = coalesce((p->>'on')::boolean, enabled),
    full_at = case when coalesce(public._num(p, 'full', 0), 0) > 0 then to_timestamp(public._num(p, 'full', 0)) else null end,
    pet_at = case when coalesce(public._num(p, 'pet', 0), 0) > 0 then to_timestamp(public._num(p, 'pet', 0)) else null end,
    egg_at = case when coalesce(public._num(p, 'egg', 0), 0) > 0 then to_timestamp(public._num(p, 'egg', 0)) else null end
  where uid = me;
end $$;

-- кому и что пора отправить (без отправки - удобно проверять)
create or replace function public._notify_due() returns table (uid bigint, tg bigint, vk bigint, kind text, text text)
language sql stable security definer set search_path = public as $$
  with msk as (select (now() at time zone 'Europe/Moscow') t),
  base as (
    select n.*, p.tg, p.vk, p.last_seen, p.banned
    from public.notify n join public.players p on p.tg_id = n.uid
    where n.enabled and not p.banned
      and (p.last_seen is null or p.last_seen < now() - interval '15 minutes')
      and extract(hour from (select t from msk)) between 9 and 21
      and (n.last_sent is null or n.last_sent < now() - interval '3 hours')
      and (n.day <> to_char((select t from msk), 'YYYY-MM-DD') or n.day_count < 2)),
  ev as (
    select b.uid, b.tg, b.vk, 'boss' kind, 'Босс пришёл к вашему ковену! Бейте его всем ковеном до воскресенья - за победу сундуки.' text, 1 pr
      from base b join public.coven_members m on m.uid = b.uid
      where extract(isodow from (select t from msk)) between 5 and 7
        and not (extract(isodow from (select t from msk)) = 5 and extract(hour from (select t from msk)) < 12)
        and b.boss_week <> (public._keys())[2]
        and not exists (select 1 from public.coven_boss cb where cb.coven_id = m.coven_id and cb.week_key = (public._keys())[2] and cb.dead)
    union all
    select b.uid, b.tg, b.vk, 'pet', 'Питомец вернулся из похода и принёс ингредиенты. Загляни в лавку!', 2 from base b where b.pet_at is not null and b.pet_at <= now()
    union all
    select b.uid, b.tg, b.vk, 'egg', 'Яйцо в гнезде готово - кто же вылупится? Загляни в лавку!', 3 from base b where b.egg_at is not null and b.egg_at <= now()
    union all
    select b.uid, b.tg, b.vk, 'full', 'Кладовая лавки полна - помощники больше не варят. Забери эссенцию!', 4 from base b where b.full_at is not null and b.full_at <= now())
  select distinct on (uid) uid, tg, vk, kind, text from ev order by uid, pr
$$;

-- отправить всё, что пора (запускается по расписанию каждые 15 минут)
create or replace function public._notify_run() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare r record; tok text; vks text; n int := 0; rid bigint; msk timestamp := now() at time zone 'Europe/Moscow'; d text;
begin
  select v into tok from public.private_secrets where k = 'tg_bot_token';
  select v into vks from public.private_secrets where k = 'vk_service';
  d := to_char(msk, 'YYYY-MM-DD');
  for r in select * from public._notify_due() loop
    rid := null;
    if r.tg is not null and tok is not null then
      select net.http_post(
        url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
        body := jsonb_build_object('chat_id', r.tg, 'text', r.text,
          'reply_markup', jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(
            jsonb_build_object('text', 'Открыть лавку', 'url', 'https://t.me/bulkgamemagikbot?startapp'))))),
        headers := '{"Content-Type": "application/json"}'::jsonb) into rid;
      insert into public.notify_log (uid, platform, kind, text, request_id) values (r.uid, 'tg', r.kind, r.text, rid);
    elsif r.vk is not null and vks is not null then
      select net.http_post(
        url := 'https://api.vk.com/method/notifications.sendMessage',
        params := jsonb_build_object('user_ids', r.vk::text, 'message', r.text, 'access_token', vks, 'v', '5.199', 'random_id', (floor(random() * 2e9))::bigint::text),
        body := '{}'::jsonb) into rid;
      insert into public.notify_log (uid, platform, kind, text, request_id) values (r.uid, 'vk', r.kind, r.text, rid);
    else
      continue;
    end if;
    n := n + 1;
    update public.notify set
      last_sent = now(),
      day_count = case when day = d then day_count + 1 else 1 end, day = d,
      full_at = case when r.kind = 'full' then null else full_at end,
      pet_at = case when r.kind = 'pet' then null else pet_at end,
      egg_at = case when r.kind = 'egg' then null else egg_at end,
      boss_week = case when r.kind = 'boss' then (public._keys())[2] else boss_week end
    where uid = r.uid;
  end loop;
  delete from public.notify_log where at < now() - interval '30 days';
  return n;
end $$;

-- админка: сколько отправлено
create or replace function public.adm_notify_stats(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint;
begin
  a := public._can(init_data, '');
  return jsonb_build_object(
    'enabled', (select count(*) from public.notify where enabled),
    'day', (select count(*) from public.notify_log where at > now() - interval '1 day'),
    'week', (select count(*) from public.notify_log where at > now() - interval '7 days'),
    'vk_key', exists (select 1 from public.private_secrets where k = 'vk_service'),
    'by_kind', coalesce((select jsonb_object_agg(kind, c) from (select kind, count(*) c from public.notify_log where at > now() - interval '7 days' group by kind) x), '{}'));
end $$;

revoke execute on function public._notify_due() from public, anon, authenticated;
revoke execute on function public._notify_run() from public, anon, authenticated;
grant execute on function public.notify_set(text, jsonb) to anon, authenticated;
grant execute on function public.adm_notify_stats(text) to anon, authenticated;

-- расширения и расписание (на своём сервере без pg_cron этот блок просто пропускается)
do $$ begin
  begin create extension if not exists pg_net; exception when others then raise notice 'pg_net: %', sqlerrm; end;
  begin create extension if not exists pg_cron; exception when others then raise notice 'pg_cron: %', sqlerrm; end;
  begin
    perform cron.unschedule('bulk_notify') where exists (select 1 from cron.job where jobname = 'bulk_notify');
    perform cron.schedule('bulk_notify', '*/15 * * * *', 'select public._notify_run()');
  exception when others then raise notice 'cron: %', sqlerrm; end;
end $$;

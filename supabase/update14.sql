-- =====================================================================
--  Бульк 0.21 - поддержка прямо из игры.
--  * Игрок пишет из игры (Сообщество / Профиль / Настройки) и видит ответы там же.
--  * Команда видит обращения в админке (право mail - есть у роли «Поддержка»), отвечает и закрывает.
--  * Ответ приходит игроку ещё и письмом в «Почту» - загорится значок.
--  * О новом обращении команде пишет бот в Telegram (тем, у кого привязан Telegram).
--  * Повтор отправки не дублирует сообщение (номер сообщения от игры), не больше 8 сообщений за 10 минут.
--  Вставить целиком в SQL Editor -> Run. Можно запускать повторно.
-- =====================================================================

create table if not exists public.support_tickets (
  id bigserial primary key,
  uid bigint not null,
  status text not null default 'open',          -- open (ждёт команду) / answered (ждёт игрока) / closed
  platform text not null default '',
  ver text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  player_unread int not null default 0,
  team_unread int not null default 0
);
create index if not exists support_tickets_uid on public.support_tickets (uid, id desc);
create index if not exists support_tickets_status on public.support_tickets (status, updated_at desc);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from anon, authenticated;

create table if not exists public.support_msgs (
  id bigserial primary key,
  ticket_id bigint not null references public.support_tickets(id),
  uid bigint not null,                          -- игрок, чьё это обращение
  from_team boolean not null default false,
  author bigint,                                -- кто из команды ответил
  text text not null,
  cid text,                                     -- номер сообщения от игры: повтор не дублирует
  created_at timestamptz not null default now()
);
create index if not exists support_msgs_ticket on public.support_msgs (ticket_id, id);
create unique index if not exists support_msgs_cid on public.support_msgs (uid, cid) where cid is not null;
alter table public.support_msgs enable row level security;
revoke all on public.support_msgs from anon, authenticated;

-- переписка обращения (для игры и админки)
create or replace function public._support_json(t public.support_tickets) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'status', t.status, 'created_at', t.created_at, 'updated_at', t.updated_at,
    'msgs', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'team', m.from_team, 'text', m.text, 'at', m.created_at,
                        'who', case when m.from_team then coalesce((select nullif(p.name, '') from public.players p where p.tg_id = m.author), 'Поддержка') end) order by m.id)
                      from public.support_msgs m where m.ticket_id = t.id), '[]'))
$$;

-- игрок пишет в поддержку
create or replace function public.support_send(init_data text, p_text text, p_cid text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb; me bigint; t public.support_tickets; txt text; pl public.players; tok text; r record; fresh boolean := false; mid bigint;
begin
  u := public._tg_user(init_data);
  me := (u->>'id')::bigint;
  select * into pl from public.players where tg_id = me;
  if not found then raise exception 'play first'; end if;
  if pl.banned then raise exception 'banned'; end if;
  txt := left(trim(coalesce(p_text, '')), 1000);
  if length(txt) < 2 then raise exception 'empty'; end if;
  -- повтор того же сообщения (игра не получила ответ) - просто вернуть переписку
  if p_cid is not null and exists (select 1 from public.support_msgs where uid = me and cid = p_cid) then
    select * into t from public.support_tickets where id = (select ticket_id from public.support_msgs where uid = me and cid = p_cid);
    return public._support_json(t);
  end if;
  if (select count(*) from public.support_msgs where uid = me and not from_team and created_at > now() - interval '10 minutes') >= 8 then
    raise exception 'too fast';
  end if;
  select * into t from public.support_tickets where uid = me and status <> 'closed' order by id desc limit 1 for update;
  if not found then
    insert into public.support_tickets (uid, platform, ver) values (me, coalesce(u->>'platform', ''), coalesce(pl.ver, '')) returning * into t;
    fresh := true;
  end if;
  insert into public.support_msgs (ticket_id, uid, text, cid) values (t.id, me, txt, p_cid) on conflict do nothing returning id into mid;
  if mid is null then return public._support_json(t); end if;
  update public.support_tickets set status = 'open', updated_at = now(), team_unread = team_unread + 1,
    platform = coalesce(u->>'platform', platform) where id = t.id returning * into t;
  -- команде - сообщение от бота (новое обращение или игрок ответил после ответа команды)
  if fresh or t.team_unread = 1 then
    select v into tok from public.private_secrets where k = 'tg_bot_token';
    if tok is not null then
      for r in select p.tg from public.admins a join public.players p on p.tg_id = a.tg_id
               where p.tg is not null and (a.role in ('creator', 'admin', 'support') or 'mail' = any(coalesce(a.perms, '{}'))) loop
        begin
          perform net.http_post(url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
            body := jsonb_build_object('chat_id', r.tg, 'text',
              case when fresh then '🆘 Новое обращение №' else '💬 Ответ в обращении №' end || t.id || ' от «' || coalesce(nullif(pl.name, ''), 'Алхимик') || '»:' || chr(10) || left(txt, 300)),
            headers := '{"Content-Type": "application/json"}'::jsonb);
        exception when others then null;
        end;
      end loop;
    end if;
  end if;
  return public._support_json(t);
end $$;

-- игрок открывает поддержку: последнее обращение (и отметка «прочитано»)
create or replace function public.support_get(init_data text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me bigint; t public.support_tickets;
begin
  me := (public._tg_user(init_data)->>'id')::bigint;
  select * into t from public.support_tickets where uid = me order by id desc limit 1;
  if not found then return jsonb_build_object('id', null, 'msgs', '[]'::jsonb); end if;
  update public.support_tickets set player_unread = 0 where id = t.id and player_unread > 0;
  return public._support_json(t);
end $$;

-- ---------------------------------------------------------------------
--  Админка
-- ---------------------------------------------------------------------
create or replace function public.adm_support_list(init_data text, p_status text default 'open') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._can(init_data, 'mail');
  return jsonb_build_object(
    'counts', (select jsonb_build_object('open', count(*) filter (where status = 'open'), 'answered', count(*) filter (where status = 'answered'),
                                         'closed', count(*) filter (where status = 'closed')) from public.support_tickets),
    'rows', coalesce((select jsonb_agg(x order by x.updated_at desc) from (
      select t.id, t.uid, t.status, t.platform, t.updated_at, t.team_unread,
             coalesce(nullif(p.name, ''), 'Алхимик') as name, p.photo,
             (select left(m.text, 120) from public.support_msgs m where m.ticket_id = t.id order by m.id desc limit 1) as last,
             (select m.from_team from public.support_msgs m where m.ticket_id = t.id order by m.id desc limit 1) as last_team
      from public.support_tickets t left join public.players p on p.tg_id = t.uid
      where p_status = 'all' or t.status = p_status
      order by t.updated_at desc limit 100) x), '[]'));
end $$;

create or replace function public.adm_support_get(init_data text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare t public.support_tickets; pl public.players;
begin
  perform public._can(init_data, 'mail');
  select * into t from public.support_tickets where id = p_id;
  if not found then raise exception 'no ticket'; end if;
  update public.support_tickets set team_unread = 0 where id = t.id and team_unread > 0;
  select * into pl from public.players where tg_id = t.uid;
  return public._support_json(t) || jsonb_build_object('uid', t.uid, 'platform', t.platform, 'ver', t.ver,
    'name', coalesce(nullif(pl.name, ''), 'Алхимик'), 'photo', pl.photo, 'lvl', pl.lvl, 'rnk', pl.rnk, 'last_seen', pl.last_seen,
    'earlier', (select count(*) from public.support_tickets x where x.uid = t.uid and x.id < t.id));
end $$;

create or replace function public.adm_support_reply(init_data text, p_id bigint, p_text text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; t public.support_tickets; txt text;
begin
  a := public._can(init_data, 'mail');
  txt := left(trim(coalesce(p_text, '')), 2000);
  if length(txt) < 1 then raise exception 'empty'; end if;
  select * into t from public.support_tickets where id = p_id for update;
  if not found then raise exception 'no ticket'; end if;
  insert into public.support_msgs (ticket_id, uid, from_team, author, text) values (t.id, t.uid, true, a, txt);
  update public.support_tickets set status = 'answered', updated_at = now(), player_unread = player_unread + 1, team_unread = 0
    where id = t.id returning * into t;
  -- письмо игроку: значок «Почты» загорится, полный ответ - в поддержке
  insert into public.mail (to_tg, title, body, gift, until)
    values (t.uid, 'Ответ поддержки', left(txt, 1900) || chr(10) || chr(10) || 'Ответить можно в игре: Сообщество → Поддержка.', '{}', now() + interval '30 days');
  perform public._log(a, 'Ответ в поддержке', t.uid, jsonb_build_object('ticket', t.id));
  return public._support_json(t);
end $$;

create or replace function public.adm_support_status(init_data text, p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; t public.support_tickets;
begin
  a := public._can(init_data, 'mail');
  if p_status not in ('open', 'closed') then raise exception 'bad status'; end if;
  update public.support_tickets set status = p_status, updated_at = now() where id = p_id returning * into t;
  if not found then raise exception 'no ticket'; end if;
  perform public._log(a, case when p_status = 'closed' then 'Закрыл обращение' else 'Открыл обращение' end, t.uid, jsonb_build_object('ticket', t.id));
end $$;

revoke execute on function public._support_json(public.support_tickets) from public, anon, authenticated;
grant execute on function public.support_send(text, text, text) to anon, authenticated;
grant execute on function public.support_get(text) to anon, authenticated;
grant execute on function public.adm_support_list(text, text) to anon, authenticated;
grant execute on function public.adm_support_get(text, bigint) to anon, authenticated;
grant execute on function public.adm_support_reply(text, bigint, text) to anon, authenticated;
grant execute on function public.adm_support_status(text, bigint, text) to anon, authenticated;

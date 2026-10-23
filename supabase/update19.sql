-- =====================================================================
--  Бульк 0.25.6 - у рассылки свой текст для уведомления ВК (msg.note, до 254 знаков).
--  Рассылка только уведомлением может быть без основного текста.
--  Вставить целиком в SQL Editor -> Run. Можно запускать повторно.
-- =====================================================================

create or replace function public.adm_bcast_send(init_data text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a bigint; chs text[]; b public.bcast; n int; at timestamptz; m jsonb;
begin
  a := public._can(init_data, 'mail');
  if coalesce(p->'aud'->>'kind', 'all') not in ('self', 'one') then perform public._can(init_data, 'mail_all'); end if;
  chs := array(select x from jsonb_array_elements_text(coalesce(p->'ch', '[]')) x where x in ('tg', 'vk', 'vkn'));
  if cardinality(chs) = 0 then raise exception 'no channel'; end if;
  m := coalesce(p->'msg', '{}');
  -- пусто, только если нет ни текста, ни вложений, ни своего текста уведомления ВК
  if coalesce(trim(m->>'text'), '') = '' and coalesce(trim(m->>'note'), '') = '' and jsonb_array_length(coalesce(m->'media', '[]')) = 0 then raise exception 'empty'; end if;
  if length(m::text) > 60000 then raise exception 'too long'; end if;
  at := nullif(p->>'send_at', '')::timestamptz;
  insert into public.bcast (created_by, title, status, ch, aud, msg, send_at)
    values (a, left(coalesce(p->>'title', ''), 80), case when at > now() + interval '1 minute' then 'scheduled' else 'sending' end,
      chs, coalesce(p->'aud', '{}'), m, at)
    returning * into b;
  insert into public.bcast_q (bid, uid, ch, peer)
    select b.id, r.uid, r.ch, r.peer from public._bcast_rcpt(a, b.aud, chs, coalesce((p->>'nodup')::boolean, true)) r
    on conflict do nothing;
  get diagnostics n = row_count;
  update public.bcast set total = n, status = case when n = 0 then 'done' else status end, finished_at = case when n = 0 then now() end where id = b.id;
  if coalesce(p->'aud'->>'kind', 'all') <> 'self' then
    perform public._log(a, 'Рассылка', nullif((p->'aud'->>'id'), '')::bigint, jsonb_build_object('id', b.id, 'title', b.title, 'ch', chs, 'n', n, 'at', at));
  end if;
  return jsonb_build_object('id', b.id, 'total', n, 'status', case when n = 0 then 'done' else b.status end);
end $$;

grant execute on function public.adm_bcast_send(text, jsonb) to anon, authenticated;

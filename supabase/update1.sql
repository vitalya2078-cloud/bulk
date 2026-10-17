-- 0.13: в топе показывается аватар, выбранный в игре (a01..a20) или фото из Telegram
drop function if exists public.submit_score(text, text, bigint, text);
create or replace function public.submit_score(init_data text, p_board text, p_score bigint, p_name text default '', p_avatar text default '')
returns void language plpgsql security definer set search_path = public, extensions as $$
declare u jsonb; id bigint; nm text; per text; ph text;
begin
  if p_board not in ('mastery', 'match3') then raise exception 'bad board'; end if;
  if p_score is null or p_score < 0 or p_score > 1e15 then raise exception 'bad score'; end if;
  if p_board = 'match3' and p_score > 200000 then raise exception 'bad score'; end if;
  u := public._tg_user(init_data);
  id := (u->>'id')::bigint;
  nm := left(trim(coalesce(nullif(trim(p_name), ''), u->>'first_name', 'Алхимик')), 20);
  ph := case when p_avatar ~ '^[a-z][0-9]{2}$' then p_avatar else coalesce(u->>'photo_url', '') end;
  insert into public.players (tg_id, name, photo, updated_at) values (id, nm, ph, now())
    on conflict (tg_id) do update set name = excluded.name, photo = excluded.photo, updated_at = now();
  foreach per in array case when p_board = 'mastery' then array['all'] else array['all', public._week()] end loop
    insert into public.scores (tg_id, board, period, score) values (id, p_board, per, p_score)
      on conflict (tg_id, board, period) do update
      set score = greatest(public.scores.score, excluded.score), updated_at = now();
  end loop;
end $$;
grant execute on function public.submit_score(text, text, bigint, text, text) to anon, authenticated;

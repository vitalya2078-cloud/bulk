-- =====================================================================
--  Бульк 0.20 - закрываем старые функции, которые игра и админка больше не вызывают:
--  * submit_score, get_top, get_my_place - старые топы на таблице scores (с 0.16 топы - top_list);
--  * adm_claim - «первый вошедший становится админом» (с 0.15 команду назначает создатель);
--  * adm_coven_rename - с 0.20 ковен правится целиком через adm_coven_edit.
--  Функции не удаляются, только снимается право вызова снаружи. Вернуть: grant execute ... to anon, authenticated.
--  Вставить целиком в SQL Editor и нажать Run. Можно запускать повторно.
-- =====================================================================

revoke execute on function public.submit_score(text, text, bigint, text, text) from public, anon, authenticated;
revoke execute on function public.get_top(text, text, int, bigint) from public, anon, authenticated;
revoke execute on function public.get_my_place(text, text, bigint) from public, anon, authenticated;
revoke execute on function public.adm_claim(text) from public, anon, authenticated;
revoke execute on function public.adm_coven_rename(text, bigint, text) from public, anon, authenticated;

-- =====================================================================
--  Набор стикеров «Бульк» в Telegram - создаётся ботом игры, со всеми смайликами сразу.
--  Токен бота берётся из базы (private_secrets), картинки - с сайта игры.
--  Владелец набора - создатель из команды админки (его Telegram).
--  Вставить целиком в SQL Editor -> Run. Через 5-10 секунд запустить проверку внизу файла.
--  Ссылка на готовый набор: https://t.me/addstickers/bulk_lavka_by_bulkgamemagikbot
-- =====================================================================

-- 1) создать набор
select net.http_post(
  url := 'https://api.telegram.org/bot' || (select v from public.private_secrets where k = 'tg_bot_token') || '/createNewStickerSet',
  body := jsonb_build_object(
    'user_id', (select p.tg from public.admins a join public.players p on p.tg_id = a.tg_id where a.role = 'creator' and p.tg is not null limit 1),
    'name', 'bulk_lavka_by_bulkgamemagikbot',
    'title', 'Бульк - волшебная лавка',
    'sticker_type', 'regular',
    'stickers', jsonb_build_array(
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/b01.png', 'format', 'static', 'emoji_list', jsonb_build_array('👋')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/b02.png', 'format', 'static', 'emoji_list', jsonb_build_array('🎉')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/b03.png', 'format', 'static', 'emoji_list', jsonb_build_array('🥰')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/b04.png', 'format', 'static', 'emoji_list', jsonb_build_array('😢')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/b05.png', 'format', 'static', 'emoji_list', jsonb_build_array('😡')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/b06.png', 'format', 'static', 'emoji_list', jsonb_build_array('😴')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/b07.png', 'format', 'static', 'emoji_list', jsonb_build_array('😍')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/b08.png', 'format', 'static', 'emoji_list', jsonb_build_array('🤔')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/b09.png', 'format', 'static', 'emoji_list', jsonb_build_array('👌')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/b10.png', 'format', 'static', 'emoji_list', jsonb_build_array('😂')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/b11.png', 'format', 'static', 'emoji_list', jsonb_build_array('😮')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/b12.png', 'format', 'static', 'emoji_list', jsonb_build_array('👋')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/g01.png', 'format', 'static', 'emoji_list', jsonb_build_array('👋')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/g02.png', 'format', 'static', 'emoji_list', jsonb_build_array('🥳')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/g03.png', 'format', 'static', 'emoji_list', jsonb_build_array('🧪')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/g04.png', 'format', 'static', 'emoji_list', jsonb_build_array('😅')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/g05.png', 'format', 'static', 'emoji_list', jsonb_build_array('🤗')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/g06.png', 'format', 'static', 'emoji_list', jsonb_build_array('🍀')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/p01.png', 'format', 'static', 'emoji_list', jsonb_build_array('😺')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/p02.png', 'format', 'static', 'emoji_list', jsonb_build_array('🔥')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/p03.png', 'format', 'static', 'emoji_list', jsonb_build_array('🐸')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/p04.png', 'format', 'static', 'emoji_list', jsonb_build_array('😤')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/p05.png', 'format', 'static', 'emoji_list', jsonb_build_array('☕')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/p06.png', 'format', 'static', 'emoji_list', jsonb_build_array('🤝')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/v01.png', 'format', 'static', 'emoji_list', jsonb_build_array('🥞')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/v02.png', 'format', 'static', 'emoji_list', jsonb_build_array('☝️')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/v03.png', 'format', 'static', 'emoji_list', jsonb_build_array('🤭')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/v04.png', 'format', 'static', 'emoji_list', jsonb_build_array('💪')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/v05.png', 'format', 'static', 'emoji_list', jsonb_build_array('🥧')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/v06.png', 'format', 'static', 'emoji_list', jsonb_build_array('✋')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/v07.png', 'format', 'static', 'emoji_list', jsonb_build_array('🌿')),
      jsonb_build_object('sticker', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/v08.png', 'format', 'static', 'emoji_list', jsonb_build_array('🏃')))),
  headers := '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds := 60000);

-- 2) значок набора (через пару секунд после первого шага)
select pg_sleep(8);
select net.http_post(
  url := 'https://api.telegram.org/bot' || (select v from public.private_secrets where k = 'tg_bot_token') || '/setStickerSetThumbnail',
  body := jsonb_build_object(
    'name', 'bulk_lavka_by_bulkgamemagikbot',
    'user_id', (select p.tg from public.admins a join public.players p on p.tg_id = a.tg_id where a.role = 'creator' and p.tg is not null limit 1),
    'thumbnail', 'https://vitalya2078-cloud.github.io/bulk/promo/stickers/icon.png',
    'format', 'static'),
  headers := '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds := 30000);

-- 3) ПРОВЕРКА: запусти отдельно через 10 секунд. В content должно быть "ok":true.
-- select id, status_code, content from net._http_response order by id desc limit 2;

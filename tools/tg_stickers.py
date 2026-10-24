#!/usr/bin/env python3
# Загружает набор видеостикеров «Бульк» в Telegram от имени бота игры.
# Запуск: TG_BOT_TOKEN=... python3 tools/tg_stickers.py <user_id> [recreate]
# Файлы: promo/stickers/anim/<id>.webm, icon.webm, смайлики - promo/stickers/emoji.txt
import json, os, sys, uuid, urllib.request, urllib.error

TOKEN = os.environ.get('TG_BOT_TOKEN', '').strip()
BOT = 'bulkgamemagikbot'
NAME = 'bulk_anim_by_' + BOT
TITLE = 'Бульк - живая лавка'
DIR = os.path.join(os.path.dirname(__file__), '..', 'promo', 'stickers')


def call(method, fields=None, files=None):
    url = 'https://api.telegram.org/bot%s/%s' % (TOKEN, method)
    b = uuid.uuid4().hex
    body = b''
    for k, v in (fields or {}).items():
        body += ('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (b, k, v)).encode()
    for k, path in (files or {}).items():
        body += ('--%s\r\nContent-Disposition: form-data; name="%s"; filename="%s"\r\nContent-Type: video/webm\r\n\r\n' % (b, k, os.path.basename(path))).encode()
        body += open(path, 'rb').read() + b'\r\n'
    body += ('--%s--\r\n' % b).encode()
    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'multipart/form-data; boundary=' + b})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return json.load(e)


def main():
    if not TOKEN:
        sys.exit('Нет секрета TG_BOT_TOKEN')
    user = sys.argv[1]
    recreate = len(sys.argv) > 2 and sys.argv[2] == 'recreate'
    emoji = {}
    for line in open(os.path.join(DIR, 'emoji.txt'), encoding='utf-8'):
        parts = line.split()
        if len(parts) >= 2 and parts[0].endswith('.png'):   # «b01.png  👋 Привет!»
            emoji[parts[0][:-4]] = [parts[1]]
    ids = sorted(f[:-5] for f in os.listdir(os.path.join(DIR, 'anim')) if f.endswith('.webm') and f != 'icon.webm')
    print('Стикеров:', len(ids))

    have = call('getStickerSet', {'name': NAME})
    if have.get('ok'):
        if not recreate:
            sys.exit('Набор уже есть: https://t.me/addstickers/%s (для пересоздания запусти с recreate)' % NAME)
        print('Удаляю старый набор:', call('deleteStickerSet', {'name': NAME}))

    stickers, files = [], {}
    for i, sid in enumerate(ids):
        key = 's%d' % i
        files[key] = os.path.join(DIR, 'anim', sid + '.webm')
        stickers.append({'sticker': 'attach://' + key, 'format': 'video', 'emoji_list': emoji.get(sid, ['✨'])[:20]})
    r = call('createNewStickerSet', {'user_id': user, 'name': NAME, 'title': TITLE,
                                     'sticker_type': 'regular', 'stickers': json.dumps(stickers, ensure_ascii=False)}, files)
    print('Создание:', r)
    if not r.get('ok'):
        sys.exit(1)
    icon = os.path.join(DIR, 'anim', 'icon.webm')
    if os.path.exists(icon):
        print('Значок:', call('setStickerSetThumbnail', {'name': NAME, 'user_id': user, 'format': 'video', 'thumbnail': 'attach://t'}, {'t': icon}))
    print('Готово: https://t.me/addstickers/' + NAME)


if __name__ == '__main__':
    main()

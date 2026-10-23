# Сборка: манифест файлов (размеры для проверки), номер версии в адресах index.html
import os, re, json, sys
root = sys.argv[1]
cfg = open(os.path.join(root, 'js/config.js'), encoding='utf-8').read()
V = re.search(r"version:\s*'([^']+)'", cfg).group(1)
files = {}
for d, _, fs in os.walk(os.path.join(root, 'assets')):
    for f in fs:
        if not f.endswith(('.webp', '.mp3', '.png', '.jpg')): continue
        p = os.path.join(d, f)
        files[os.path.relpath(p, os.path.join(root, 'assets')).replace(os.sep, '/')] = os.path.getsize(p)
files = dict(sorted(files.items()))
js = "// Создаётся автоматически при сборке: все файлы игры и их размеры (по размеру ловим оборванную загрузку)\n"
LAZY = ['images/garden/', 'images/quest/', 'images/fish/', 'images/find/', 'images/backgrounds/st_', 'images/backgrounds/mg_', 'images/chars/grizelda', 'images/chars/aristarkh', 'images/chars/filya', 'images/backgrounds/coven_', 'images/boss/', 'images/backgrounds/boss_', 'story/']
js += "// lazy - ещё не используются в игре: не грузятся на заставке, только по требованию\n"
js += "const MANIFEST = { v: '%s', lazy: %s, files: %s };\n" % (V, json.dumps(LAZY), json.dumps(files, ensure_ascii=False, separators=(',', ':')))
open(os.path.join(root, 'js/manifest.js'), 'w', encoding='utf-8').write(js)
h = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
h = re.sub(r'((?:src|href)="(?:js|css|assets)/[^"?]+)(\?v=[^"]*)?"', lambda m: m.group(1) + '?v=' + V + '"', h)
if 'js/manifest.js' not in h:
    h = h.replace('<script src="js/format.js', '<script src="js/manifest.js?v=' + V + '"></script>\n  <script src="js/format.js')
open(os.path.join(root, 'index.html'), 'w', encoding='utf-8').write(h)
open(os.path.join(root, 'version.json'), 'w').write(json.dumps({'v': V}))
# админка для приложения: список файлов с отпечатками, версия = отпечаток содержимого
import hashlib
ad = os.path.join(root, 'admin'); af = {}
# адрес admin.js / admin.css с версией по содержимому - иначе ВК держит старую копию
ab = hashlib.sha256(open(os.path.join(ad, 'admin.js'), 'rb').read() + open(os.path.join(ad, 'admin.css'), 'rb').read()).hexdigest()[:10]
ai = open(os.path.join(ad, 'index.html'), encoding='utf-8').read()
# версия прямо в адресе файла (без document.write: встроенный браузер ВК такие вставки может пропускать);
# в приложении «Бульк Админ» запрос с ?v= отдаётся из локальных файлов - путь тот же
ai = re.sub(r'(href|src)="admin\.(css|js)(\?v=[^"]*)?"', lambda m: '%s="admin.%s?v=%s"' % (m.group(1), m.group(2), ab), ai)
open(os.path.join(ad, 'index.html'), 'w', encoding='utf-8').write(ai)
for f in sorted(os.listdir(ad)):
    if f == 'bundle.json' or f.startswith('.'): continue
    b = open(os.path.join(ad, f), 'rb').read()
    af[f] = {'size': len(b), 'sha256': hashlib.sha256(b).hexdigest()}
av = hashlib.sha256(json.dumps(af, sort_keys=True).encode()).hexdigest()[:12]
open(os.path.join(ad, 'bundle.json'), 'w').write(json.dumps({'v': av, 'files': af}, indent=1))
print('admin bundle', av)
print('version', V, 'files', len(files), 'bytes', sum(files.values()))

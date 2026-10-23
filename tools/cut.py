#!/usr/bin/env python3
"""Нарезка листа картинок на голубом фоне (#00FFFF) на отдельные файлы webp с прозрачностью.

    python3 tools/cut.py ЛИСТ.png ПАПКА [--size 256] [--names a,b,c]

* фон убирается по расстоянию до голубого цвета, края мягкие, голубой отсвет с краёв снимается;
* элементы находятся как отдельные пятна (мелкий мусор отбрасывается), порядок - по строкам сверху вниз, слева направо;
* каждый элемент обрезается по краю, вписывается в квадрат --size (0 - без масштаба) с полями 4%.
Нужны Pillow и numpy.
"""
import argparse, os, sys
from collections import deque
import numpy as np
from PIL import Image

CYAN = np.array([0, 255, 255], dtype=np.float32)


def key(rgb, t0=60.0, t1=140.0):
    """Альфа по расстоянию до голубого и снятие голубого отсвета на полупрозрачных краях."""
    f = rgb.astype(np.float32)
    d = np.sqrt(((f - CYAN) ** 2).sum(-1))
    a = np.clip((d - t0) / (t1 - t0), 0, 1)
    # краевые пиксели - смесь объекта с голубым: убираем голубую часть
    am = np.maximum(a, 1e-3)[..., None]
    out = (f - (1 - a)[..., None] * CYAN) / am
    # остаточный голубой оттенок (G и B заметно выше R) на краях приглушаем
    edge = (a < 0.98)[..., None]
    gray = out.mean(-1, keepdims=True)
    spill = np.clip(np.minimum(out[..., 1:2], out[..., 2:3]) - out[..., 0:1], 0, None)
    out = np.where(edge & (spill > 30), out - np.concatenate([np.zeros_like(spill), spill * .6, spill * .6], -1), out)
    out = np.clip(out, 0, 255)
    return out.astype(np.uint8), (a * 255).astype(np.uint8)


def blobs(alpha, min_area=400):
    """Связные пятна непрозрачных пикселей (по уменьшенной маске - быстро), рамки (x0, y0, x1, y1)."""
    h, w = alpha.shape
    s = 4
    m = alpha[::s, ::s] > 40
    seen = np.zeros_like(m, dtype=bool)
    out = []
    for y in range(m.shape[0]):
        for x in range(m.shape[1]):
            if not m[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)]); seen[y, x] = True
            x0 = x1 = x; y0 = y1 = y; n = 0
            while q:
                cy, cx = q.popleft(); n += 1
                x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < m.shape[0] and 0 <= nx < m.shape[1] and m[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; q.append((ny, nx))
            if n * s * s >= min_area:
                out.append([x0 * s, y0 * s, min(w, (x1 + 1) * s), min(h, (y1 + 1) * s), n])
    # искры и блёстки рядом с крупным элементом приклеиваем к нему
    big = [b for b in out if b[4] * s * s >= min_area * 25]
    small = [b for b in out if b not in big]
    for b in small:
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        best = min(big, key=lambda g: max(g[0] - cx, cx - g[2], 0) + max(g[1] - cy, cy - g[3], 0)) if big else None
        if best is not None:
            dist = max(best[0] - cx, cx - best[2], 0) + max(best[1] - cy, cy - best[3], 0)
            if dist < 120:
                best[0], best[1] = min(best[0], b[0]), min(best[1], b[1])
                best[2], best[3] = max(best[2], b[2]), max(best[3], b[3])
    return [tuple(b[:4]) for b in big]


def order(boxes):
    """По строкам: сверху вниз, в строке слева направо."""
    boxes = sorted(boxes, key=lambda b: b[1])
    rows, cur = [], []
    for b in boxes:
        if cur and b[1] > max(c[3] for c in cur) - (b[3] - b[1]) * 0.3:
            rows.append(cur); cur = []
        cur.append(b)
    if cur:
        rows.append(cur)
    return [b for r in rows for b in sorted(r, key=lambda b: b[0])]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet'); ap.add_argument('out')
    ap.add_argument('--size', type=int, default=256)
    ap.add_argument('--names', default='')
    ap.add_argument('--quality', type=int, default=88)
    a = ap.parse_args()
    im = Image.open(a.sheet).convert('RGB')
    rgb, alpha = key(np.array(im))
    boxes = order(blobs(alpha))
    names = [n for n in a.names.split(',') if n] or ['%02d' % (i + 1) for i in range(len(boxes))]
    os.makedirs(a.out, exist_ok=True)
    rgba = np.dstack([rgb, alpha])
    for i, (x0, y0, x1, y1) in enumerate(boxes):
        if i >= len(names):
            print('лишний элемент', i + 1, (x0, y0, x1, y1)); continue
        pad = 6
        crop = Image.fromarray(rgba[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad], 'RGBA')
        bb = crop.getbbox()
        if bb:
            crop = crop.crop(bb)
        if a.size:
            side = int(max(crop.size) * 1.08)
            canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
            canvas.paste(crop, ((side - crop.size[0]) // 2, (side - crop.size[1]) // 2))
            crop = canvas.resize((a.size, a.size), Image.LANCZOS) if side > a.size else canvas
        path = os.path.join(a.out, names[i] + '.webp')
        crop.save(path, 'WEBP', quality=a.quality, method=6)
        print(names[i], crop.size, os.path.getsize(path) // 1024, 'КБ')
    if len(names) > len(boxes):
        print('не найдено элементов:', len(names) - len(boxes), file=sys.stderr)


if __name__ == '__main__':
    main()

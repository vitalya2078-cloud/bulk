// =====================================================================
//  Комната лавки, которая растёт с рангом
//  Фон - пустая комната. Мебель и украшения - отдельные картинки,
//  каждая появляется с нужного ранга лавки (rank) и может уступать место
//  более богатой (until). Координаты - доли картинки фона:
//  x - центр, y - низ (для висящих сверху - верх), w - ширина.
//  layer: wall - на стене, floor - у стены на полу, front - на полу перед площадкой,
//         hang - свисает с потолка, top - передний план (ближе всех, чуть размыт).
//  lights - точки свечения внутри картинки (доли картинки, r - доля ширины предмета).
//  0.29: flip - нарисовать зеркально; open - тап открывает раздел (предмет-кнопка);
//  snd - звук при тапе (wood, glass, metal, magic, paper). Остальные предметы просто отзываются на тап.
// =====================================================================

DATA.room = {
  // 0.29: комната 2.5D (перспектива с одной точкой схода). Координаты - доли картинки r2/room:
  // задняя стена x 0.19-0.81, пол встречается со стеной на y 0.455, окно - круг (0.5; 0.26), r 0.124 ширины.
  bg: 'r2/room',
  wallY: 0.455,
  platform: { y: 0.6 },               // где стоят ножки треноги (верх помоста)
  items: [
    // --- помост и коврик (лежат на полу, рисуются первыми) ---
    { img: 'r2/rug', layer: 'front', x: 0.5, y: 0.7, w: 0.66, rank: 0, flat: true, notap: true },
    { img: 'r2/podium', layer: 'front', x: 0.5, y: 0.665, w: 0.46, rank: 0, under: true, notap: true },
    // --- задняя стена ---
    { img: 'r2/shelf_s', layer: 'wall', x: 0.285, y: 0.415, w: 0.16, rank: 0, snd: 'glass' },
    { img: 'r2/shelf_l', layer: 'wall', x: 0.715, y: 0.392, w: 0.17, rank: 1, snd: 'glass' },
    { img: 'r2/wreath', layer: 'wall', x: 0.707, y: 0.31, w: 0.062, rank: 1, until: 3 },
    { img: 'r2/map', layer: 'wall', x: 0.27, y: 0.315, w: 0.12, rank: 0, open: 'trips', snd: 'paper' },
    { img: 'r2/horseshoe', layer: 'wall', x: 0.5, y: 0.405, w: 0.05, rank: 3 },
    { img: 'r2/tablet', layer: 'wall', x: 0.707, y: 0.315, w: 0.062, rank: 4, until: 5, snd: 'magic', lights: [{ k: 'ball', x: 0.5, y: 0.5, r: 0.9, c: '#B07BFF' }] },
    { img: 'r2/banner', layer: 'wall', x: 0.205, y: 0.37, w: 0.06, rank: 5 },
    { img: 'r2/portrait', layer: 'wall', x: 0.707, y: 0.315, w: 0.066, rank: 6 },
    { img: 'r2/candles', layer: 'wall', x: 0.5, y: 0.17, w: 0.12, rank: 8, bob: true, snd: 'metal',
      lights: [{ k: 'candle', x: 0.5, y: 0.2, r: 1.2, c: '#FFC266' }] },
    // --- у задней стены на полу ---
    { img: 'r2/chest', layer: 'floor', x: 0.645, y: 0.49, w: 0.1, rank: 1, until: 2 },
    { img: 'r2/cabinet', layer: 'floor', x: 0.27, y: 0.55, w: 0.145, rank: 2, until: 4, flip: true },
    { img: 'r2/rack', layer: 'floor', x: 0.355, y: 0.475, w: 0.07, rank: 4, until: 5, snd: 'glass', flip: true },
    { img: 'r2/orb', layer: 'floor', x: 0.6, y: 0.478, w: 0.055, rank: 4, until: 5, snd: 'magic', lights: [{ k: 'ball', x: 0.5, y: 0.25, r: 1.0, c: '#B07BFF' }] },
    { img: 'r2/telescope', layer: 'floor', x: 0.6, y: 0.48, w: 0.085, rank: 6, snd: 'metal' },
    { img: 'r2/bookcase', layer: 'floor', x: 0.27, y: 0.55, w: 0.15, rank: 5, flip: true },
    // 0.30: камин (огонь рисует timeday.js) и зеркало - кнопка гардероба
    { img: 'r2/fireplace', layer: 'floor', x: 0.79, y: 0.56, w: 0.14, rank: 0, snd: 'wood', fire: { x: 0.44, y: 0.86, w: 0.24 },
      lights: [{ k: 'lantern', x: 0.44, y: 0.72, r: 1.1, c: '#FF9A3A' }] },
    { img: 'r2/mirror', layer: 'front', x: 0.215, y: 0.645, w: 0.075, rank: 0, open: 'ward', snd: 'glass',
      lights: [{ k: 'ball', x: 0.5, y: 0.45, r: 0.7, c: '#C9A0FF' }] },
    // --- на полу ближе к нам ---
    { img: 'r2/crates', layer: 'front', x: 0.13, y: 0.7, w: 0.14, rank: 0, until: 2, flip: true },
    { img: 'r2/barrel', layer: 'front', x: 0.13, y: 0.705, w: 0.1, rank: 3 },
    // стол алхимика: стоит с самого начала, развёрнут к котлу, тап открывает зелья
    { img: 'r2/workbench', layer: 'front', x: 0.8, y: 0.775, w: 0.27, rank: 0, flip: true, open: 'brew', snd: 'glass',
      lights: [{ k: 'candle', x: 0.1, y: 0.12, r: 0.5, c: '#FFC266' }] },
    // --- свисает с потолка ---
    { img: 'r2/garland', layer: 'hang', x: 0.5, y: 0.172, w: 0.32, rank: 1, until: 6 },
    { img: 'r2/lantern', layer: 'hang', x: 0.29, y: 0.07, w: 0.055, rank: 2, swing: true, snd: 'metal', lights: [{ k: 'lantern', x: 0.5, y: 0.6, r: 1.8, c: '#FFC266' }] },
    { img: 'r2/lantern', layer: 'hang', x: 0.71, y: 0.07, w: 0.055, rank: 5, swing: true, snd: 'metal', lights: [{ k: 'lantern', x: 0.5, y: 0.6, r: 1.8, c: '#FFC266' }] },
    { img: 'r2/chandelier', layer: 'hang', x: 0.5, y: 0.03, w: 0.2, rank: 7, swing: true, snd: 'metal',
      lights: [{ k: 'candle', x: 0.5, y: 0.35, r: 1.4, c: '#FFC266' }] },
    // --- передний план: балки с травами по краям (ближе всех, чуть размыты) ---
    { img: 'r2/beam_l', layer: 'top', x: 0.035, y: 0.0, w: 0.085, rank: 0, notap: true },
    { img: 'r2/beam_r', layer: 'top', x: 0.965, y: 0.0, w: 0.085, rank: 0, notap: true },
    // --- Хэллоуин: та же комната, только украшенная ---
    { img: 'events/halloween/web', layer: 'top', x: 0.16, y: 0.0, w: 0.15, event: 'halloween' },
    { img: 'events/halloween/spider', layer: 'hang', x: 0.37, y: 0.06, w: 0.04, event: 'halloween', swing: true },
    { img: 'events/halloween/lantern_pumpkin', layer: 'front', x: 0.3, y: 0.675, w: 0.065, event: 'halloween',
      lights: [{ k: 'pumpkin', x: 0.5, y: 0.6, r: 1.3, c: '#FF8A2A' }] },
    { img: 'events/halloween/lantern_pumpkin', layer: 'front', x: 0.7, y: 0.68, w: 0.06, event: 'halloween',
      lights: [{ k: 'pumpkin', x: 0.5, y: 0.6, r: 1.3, c: '#FF8A2A' }] },
    { img: 'events/halloween/candle', layer: 'floor', x: 0.62, y: 0.49, w: 0.03, event: 'halloween',
      lights: [{ k: 'candle', x: 0.5, y: 0.1, r: 1.6, c: '#FFC266' }] },
    { img: 'events/halloween/ghost', layer: 'wall', x: 0.64, y: 0.2, w: 0.055, event: 'halloween', bob: true }
  ]
};

// Подставка под котёл - новый слот гардероба
DATA.wardrobe.push(
  { id: 'stand_iron',   slot: 'stand', name: 'Чугунная тренога', how: { free: true },          img: 'stands/iron' },
  { id: 'stand_copper', slot: 'stand', name: 'Медная тренога',   how: { rank: 2 },             img: 'stands/copper' },
  { id: 'stand_gold',   slot: 'stand', name: 'Золотая тренога',  how: { cr: 40 },              img: 'stands/gold' },
  { id: 'stand_bone',   slot: 'stand', name: 'Костяная тренога', how: { event: 'halloween' },  img: 'stands/bone' }
);
if (DATA.eventDefs && DATA.eventDefs.halloween) DATA.eventDefs.halloween.shop.push({ kind: 'acc', id: 'stand_bone', price: 160 });
DATA.bgMeta = DATA.bgMeta || {};
DATA.bgMeta['backgrounds/room'] = { room: true, counter: true, window: { x: 0.5, y: 0.25, r: 0.17 } };
// окно новой комнаты прозрачное: за ним рисуется небо r2/sky
DATA.bgMeta['r2/room'] = { room: true, counter: true, window: { x: 0.5, y: 0.26, r: 0.124 }, skies: { night: 'r2/sky', dawn: 'r2/sky_dawn', day: 'r2/sky_day', dusk: 'r2/sky_dusk' } };

// =====================================================================
//  Игровые сутки (0.29): своё время, не часы телефона. Одни сутки - 2 реальных часа,
//  время общее для всех (Date.now() в игре сверено с базой, см. clock.js).
//  phase: 0 - полночь, 0.25 - рассвет, 0.5 - полдень, 0.75 - закат.
// =====================================================================
const DayTime = (() => {
  const DAY_MS = 2 * 3600 * 1000;
  const phase = (ms) => (((ms === undefined ? Date.now() : ms) % DAY_MS) + DAY_MS) % DAY_MS / DAY_MS;
  const sm = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  // веса неба: ночь, рассвет, день, закат (в сумме 1, переходы плавные)
  function weights(p) {
    const dawn = sm(0.17, 0.25, p) * (1 - sm(0.29, 0.36, p));
    const day = sm(0.29, 0.36, p) * (1 - sm(0.64, 0.71, p));
    const dusk = sm(0.64, 0.71, p) * (1 - sm(0.79, 0.86, p));
    const night = Math.max(0, 1 - dawn - day - dusk);
    return { night, dawn, day, dusk };
  }
  // «солнечность»: 0 ночью, 1 днём
  const sun = (p) => { const w = weights(p); return w.day + 0.6 * (w.dawn + w.dusk); };
  const hour = (p) => (p === undefined ? phase() : p) * 24;
  const name = (p) => { const w = weights(p === undefined ? phase() : p); return Object.keys(w).reduce((a, b) => (w[a] >= w[b] ? a : b)); };
  // сколько реальных миллисекунд до игрового часа h (0-24)
  function msUntil(h) { const p = phase(), tp = (h / 24); return ((tp - p + 1) % 1) * DAY_MS; }
  return { DAY_MS, phase, weights, sun, hour, name, msUntil };
})();

const Scene = (() => {
  const D = DATA;
  // какие предметы видны сейчас
  function items() {
    const r = Econ.rank();
    const ev = typeof Events !== 'undefined' && Events.active && Events.active('halloween') ? 'halloween' : null;
    return D.room.items.filter((it) => (it.event ? it.event === ev : (r >= (it.rank || 0) && (it.until === undefined || r <= it.until))));
  }
  const key = () => Econ.rank() + '|' + (typeof Events !== 'undefined' && Events.active && Events.active('halloween') ? 'h' : '');
  return { items, key };
})();

// =====================================================================
//  Комната лавки, которая растёт с рангом
//  Фон - пустая комната. Мебель и украшения - отдельные картинки,
//  каждая появляется с нужного ранга лавки (rank) и может уступать место
//  более богатой (until). Координаты - доли картинки фона:
//  x - центр, y - низ (для висящих сверху - верх), w - ширина.
//  layer: wall - на стене, floor - у стены на полу, front - на полу перед площадкой,
//         hang - свисает с потолка, top - передний план (ближе всех, чуть размыт).
//  lights - точки свечения внутри картинки (доли картинки, r - доля ширины предмета).
// =====================================================================

DATA.room = {
  bg: 'backgrounds/room',
  wallY: 0.555,                       // где стена встречается с полом
  platform: { y: 0.735 },             // центр каменной площадки под треногой
  items: [
    // --- стена (видимая часть картинки по ширине - примерно от 0.08 до 0.92) ---
    { img: 'furniture/shelf_small', layer: 'wall', x: 0.19, y: 0.40, w: 0.22, rank: 0,
      lights: [{ k: 'bottle', x: 0.3, y: 0.5, r: 0.22, c: '#B45BFF' }, { k: 'bottle', x: 0.68, y: 0.55, r: 0.2, c: '#7CE07A' }] },
    { img: 'decor/sconce', layer: 'wall', x: 0.335, y: 0.31, w: 0.045, rank: 0, lights: [{ k: 'candle', x: 0.55, y: 0.12, r: 1.6, c: '#FFC266' }] },
    { img: 'furniture/shelf_long', layer: 'wall', x: 0.79, y: 0.40, w: 0.26, rank: 1,
      lights: [{ k: 'bottle', x: 0.18, y: 0.5, r: 0.12, c: '#7CE07A' }, { k: 'bottle', x: 0.37, y: 0.45, r: 0.12, c: '#B45BFF' },
        { k: 'bottle', x: 0.55, y: 0.5, r: 0.12, c: '#4A8BFF' }, { k: 'bottle', x: 0.72, y: 0.55, r: 0.12, c: '#FF4F6A' }, { k: 'bottle', x: 0.88, y: 0.45, r: 0.13, c: '#FFB43A' }] },
    { img: 'decor/wreath', layer: 'wall', x: 0.735, y: 0.26, w: 0.075, rank: 1, until: 4 },
    { img: 'decor/map', layer: 'wall', x: 0.2, y: 0.27, w: 0.15, rank: 2, until: 5 },
    { img: 'decor/horseshoe', layer: 'wall', x: 0.5, y: 0.075, w: 0.04, rank: 3 },
    { img: 'decor/rune_tablet', layer: 'wall', x: 0.335, y: 0.2, w: 0.05, rank: 4, lights: [{ k: 'ball', x: 0.5, y: 0.5, r: 0.9, c: '#5BB8FF' }] },
    { img: 'decor/banner_guild', layer: 'wall', x: 0.72, y: 0.31, w: 0.075, rank: 5 },
    { img: 'decor/portrait', layer: 'wall', x: 0.2, y: 0.27, w: 0.13, rank: 6 },
    { img: 'decor/banner_royal', layer: 'wall', x: 0.09, y: 0.3, w: 0.06, rank: 7 },
    { img: 'decor/curtains', layer: 'wall', x: 0.5, y: 0.47, w: 0.46, rank: 8 },
    { img: 'decor/floating_candles', layer: 'wall', x: 0.5, y: 0.2, w: 0.12, rank: 8, bob: true,
      lights: [{ k: 'candle', x: 0.5, y: 0.25, r: 0.6, c: '#FFC266' }] },
    // --- у стены на полу ---
    { img: 'furniture/cabinet', layer: 'floor', x: 0.15, y: 0.565, w: 0.16, rank: 2, until: 4 },
    { img: 'furniture/bookcase', layer: 'floor', x: 0.155, y: 0.565, w: 0.17, rank: 5 },
    { img: 'furniture/potion_rack', layer: 'floor', x: 0.29, y: 0.565, w: 0.085, rank: 4, until: 5,
      lights: [{ k: 'bottle', x: 0.5, y: 0.45, r: 0.6, c: '#C25BFF' }] },
    { img: 'furniture/clock', layer: 'floor', x: 0.29, y: 0.565, w: 0.06, rank: 6 },
    { img: 'furniture/chest', layer: 'floor', x: 0.81, y: 0.57, w: 0.15, rank: 1, until: 2 },
    { img: 'furniture/workbench', layer: 'floor', x: 0.8, y: 0.565, w: 0.22, rank: 3,
      lights: [{ k: 'bottle', x: 0.42, y: 0.4, r: 0.12, c: '#B45BFF' }, { k: 'bottle', x: 0.6, y: 0.35, r: 0.1, c: '#7CE07A' }] },
    { img: 'furniture/crystal_ball', layer: 'floor', x: 0.86, y: 0.475, w: 0.05, rank: 4, lights: [{ k: 'ball', x: 0.5, y: 0.4, r: 1.0, c: '#9B6BFF' }] },
    { img: 'furniture/candelabra', layer: 'floor', x: 0.705, y: 0.6, w: 0.05, rank: 4,
      lights: [{ k: 'candle', x: 0.5, y: 0.08, r: 1.4, c: '#FFC266' }] },
    { img: 'scene/fern', layer: 'floor', x: 0.9, y: 0.6, w: 0.07, rank: 1 },
    // --- на полу ближе к нам ---
    { img: 'furniture/crates', layer: 'front', x: 0.13, y: 0.665, w: 0.12, rank: 0 },
    { img: 'scene/bucket', layer: 'front', x: 0.235, y: 0.645, w: 0.055, rank: 1, until: 2 },
    { img: 'furniture/barrel', layer: 'front', x: 0.24, y: 0.665, w: 0.075, rank: 3, until: 7 },
    { img: 'furniture/stone_pedestal', layer: 'front', x: 0.245, y: 0.67, w: 0.075, rank: 8,
      lights: [{ k: 'ball', x: 0.5, y: 0.15, r: 0.9, c: '#FF5A6A' }] },
    { img: 'scene/flour', layer: 'front', x: 0.87, y: 0.655, w: 0.1, rank: 0, until: 5 },
    { img: 'furniture/telescope', layer: 'front', x: 0.86, y: 0.66, w: 0.1, rank: 6 },
    { img: 'scene/rug', layer: 'front', x: 0.5, y: 0.95, w: 0.5, rank: 0, until: 6, flat: true },
    { img: 'furniture/royal_carpet', layer: 'front', x: 0.5, y: 0.95, w: 0.52, rank: 7, flat: true },
    // --- свисает с потолка ---
    { img: 'scene/garland', layer: 'hang', x: 0.5, y: 0.035, w: 0.36, rank: 1, until: 6,
      lights: [0.1, 0.3, 0.5, 0.7, 0.9].map((x) => ({ k: 'bulb', x, y: 0.7, r: 0.08, c: '#FFE08A' })) },
    { img: 'scene/lantern', layer: 'hang', x: 0.26, y: 0.0, w: 0.055, rank: 2, swing: true, lights: [{ k: 'lantern', x: 0.5, y: 0.65, r: 1.8, c: '#FFC266' }] },
    { img: 'furniture/chandelier', layer: 'hang', x: 0.5, y: 0.0, w: 0.2, rank: 7, swing: true,
      lights: [{ k: 'candle', x: 0.5, y: 0.45, r: 1.0, c: '#FFD27A' }] },
    // --- передний план ---
    { img: 'scene/lavender', layer: 'top', x: 0.08, y: 0.0, w: 0.1, rank: 0 },
    { img: 'decor/red_flowers', layer: 'top', x: 0.17, y: 0.0, w: 0.07, rank: 2 },
    { img: 'scene/mint', layer: 'top', x: 0.92, y: 0.0, w: 0.09, rank: 1 },
    { img: 'decor/hanging_plant', layer: 'top', x: 0.08, y: 0.0, w: 0.09, rank: 5 },
    { img: 'scene/ivy', layer: 'top', x: 0.95, y: 0.0, w: 0.09, rank: 3 },
    // --- Хэллоуин: та же комната, только украшенная ---
    { img: 'events/halloween/web', layer: 'top', x: 0.12, y: 0.0, w: 0.17, event: 'halloween' },
    { img: 'events/halloween/spider', layer: 'hang', x: 0.37, y: 0.0, w: 0.045, event: 'halloween', swing: true },
    { img: 'events/halloween/lantern_pumpkin', layer: 'front', x: 0.31, y: 0.64, w: 0.07, event: 'halloween',
      lights: [{ k: 'pumpkin', x: 0.5, y: 0.6, r: 1.3, c: '#FF8A2A' }] },
    { img: 'events/halloween/lantern_pumpkin', layer: 'front', x: 0.7, y: 0.645, w: 0.065, event: 'halloween',
      lights: [{ k: 'pumpkin', x: 0.5, y: 0.6, r: 1.3, c: '#FF8A2A' }] },
    { img: 'events/halloween/candle', layer: 'floor', x: 0.67, y: 0.57, w: 0.035, event: 'halloween',
      lights: [{ k: 'candle', x: 0.5, y: 0.1, r: 1.6, c: '#FFC266' }] },
    { img: 'events/halloween/ghost', layer: 'wall', x: 0.64, y: 0.17, w: 0.06, event: 'halloween', bob: true }
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

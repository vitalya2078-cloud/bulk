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
  // 0.29: комната 2.5D (перспектива с одной точкой схода). Координаты - доли картинки r2/room:
  // задняя стена x 0.19-0.81, пол встречается со стеной на y 0.455, окно - круг (0.5; 0.26), r 0.124 ширины.
  bg: 'r2/room',
  wallY: 0.455,
  platform: { y: 0.6 },               // где стоят ножки треноги (верх помоста)
  items: [
    // --- помост и коврик (лежат на полу, рисуются первыми) ---
    { img: 'r2/rug', layer: 'front', x: 0.5, y: 0.7, w: 0.66, rank: 0, flat: true },
    { img: 'r2/podium', layer: 'front', x: 0.5, y: 0.665, w: 0.46, rank: 0 },
    // --- задняя стена ---
    { img: 'r2/shelf_s', layer: 'wall', x: 0.285, y: 0.415, w: 0.16, rank: 0 },
    { img: 'r2/shelf_l', layer: 'wall', x: 0.715, y: 0.415, w: 0.18, rank: 1 },
    { img: 'r2/wreath', layer: 'wall', x: 0.73, y: 0.31, w: 0.075, rank: 1, until: 3 },
    { img: 'r2/map', layer: 'wall', x: 0.27, y: 0.315, w: 0.12, rank: 2, until: 5 },
    { img: 'r2/horseshoe', layer: 'wall', x: 0.5, y: 0.405, w: 0.05, rank: 3 },
    { img: 'r2/tablet', layer: 'wall', x: 0.73, y: 0.315, w: 0.075, rank: 4, lights: [{ k: 'ball', x: 0.5, y: 0.5, r: 0.9, c: '#B07BFF' }] },
    { img: 'r2/banner', layer: 'wall', x: 0.205, y: 0.37, w: 0.06, rank: 5 },
    { img: 'r2/portrait', layer: 'wall', x: 0.27, y: 0.315, w: 0.105, rank: 6 },
    { img: 'r2/candles', layer: 'wall', x: 0.5, y: 0.17, w: 0.12, rank: 8, bob: true,
      lights: [{ k: 'candle', x: 0.5, y: 0.2, r: 1.2, c: '#FFC266' }] },
    // --- у задней стены на полу ---
    { img: 'r2/chest', layer: 'floor', x: 0.76, y: 0.49, w: 0.1, rank: 1, until: 2 },
    { img: 'r2/cabinet', layer: 'floor', x: 0.25, y: 0.48, w: 0.13, rank: 2, until: 4 },
    { img: 'r2/workbench', layer: 'floor', x: 0.75, y: 0.485, w: 0.16, rank: 3,
      lights: [{ k: 'candle', x: 0.9, y: 0.12, r: 0.5, c: '#FFC266' }] },
    { img: 'r2/rack', layer: 'floor', x: 0.355, y: 0.475, w: 0.07, rank: 4, until: 5 },
    { img: 'r2/bookcase', layer: 'floor', x: 0.25, y: 0.48, w: 0.135, rank: 5 },
    // --- на полу ближе к нам ---
    { img: 'r2/crates', layer: 'front', x: 0.13, y: 0.7, w: 0.14, rank: 0, until: 2 },
    { img: 'r2/barrel', layer: 'front', x: 0.13, y: 0.705, w: 0.1, rank: 3 },
    { img: 'r2/orb', layer: 'front', x: 0.87, y: 0.69, w: 0.085, rank: 4, until: 5, lights: [{ k: 'ball', x: 0.5, y: 0.25, r: 1.0, c: '#B07BFF' }] },
    { img: 'r2/telescope', layer: 'front', x: 0.86, y: 0.705, w: 0.12, rank: 6 },
    // --- свисает с потолка ---
    { img: 'r2/garland', layer: 'hang', x: 0.5, y: 0.172, w: 0.32, rank: 1, until: 6 },
    { img: 'r2/lantern', layer: 'hang', x: 0.29, y: 0.07, w: 0.055, rank: 2, swing: true, lights: [{ k: 'lantern', x: 0.5, y: 0.6, r: 1.8, c: '#FFC266' }] },
    { img: 'r2/lantern', layer: 'hang', x: 0.71, y: 0.07, w: 0.055, rank: 5, swing: true, lights: [{ k: 'lantern', x: 0.5, y: 0.6, r: 1.8, c: '#FFC266' }] },
    { img: 'r2/chandelier', layer: 'hang', x: 0.5, y: 0.03, w: 0.2, rank: 7, swing: true,
      lights: [{ k: 'candle', x: 0.5, y: 0.35, r: 1.4, c: '#FFC266' }] },
    // --- передний план: балки с травами по краям (ближе всех, чуть размыты) ---
    { img: 'r2/beam_l', layer: 'top', x: 0.035, y: 0.0, w: 0.085, rank: 0 },
    { img: 'r2/beam_r', layer: 'top', x: 0.965, y: 0.0, w: 0.085, rank: 0 },
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
DATA.bgMeta['r2/room'] = { room: true, counter: true, window: { x: 0.5, y: 0.26, r: 0.124 }, sky: 'r2/sky' };

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

// =====================================================================
//  0.28: Диковинки, сундуки, мерцающие осколки и «Колесо Булька».
//  * Диковинки - предметы на полке лавки, каждая даёт постоянный бонус.
//    4 редкости, повторки падают и разбираются на осколки.
//  * Осколки: улучшить диковинку (1-5 звёзд), создать недостающую, сменить
//    дополнительное свойство у эпических и легендарных.
//  * Сундуки 4 видов с открытыми шансами и защитой от невезения.
//  * Колесо: одно бесплатное вращение в день и одно за рекламу.
//  Состояние: Econ.s.rel (см. norm).
// =====================================================================

const Relics = (() => {
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const S = () => Econ.s;
  const save = () => { if (window.Game) Game.save(); };
  const pct = (x) => (Math.round(x * 1000) / 10).toString().replace('.', ',') + '%';

  // ---------- данные ----------
  const RAR = {
    c: { name: 'Обычная', i: 0, dis: 5, up: 10, craft: 25 },
    r: { name: 'Редкая', i: 1, dis: 20, up: 40, craft: 100 },
    e: { name: 'Эпическая', i: 2, dis: 80, up: 160, craft: 400, reroll: 100 },
    l: { name: 'Легендарная', i: 3, dis: 300, up: 600, craft: 1500, reroll: 300 }
  };
  const RORDER = ['l', 'e', 'r', 'c'];
  // сила бонуса на 1 звезде для обычной / редкой / эпической / легендарной
  const KIND = {
    inc:     { v: [0.03, 0.06, 0.10, 0.16], t: (x) => '+' + pct(x) + ' к доходу в час' },
    tap:     { v: [0.04, 0.08, 0.14, 0.22], t: (x) => '+' + pct(x) + ' к силе тапа' },
    offline: { v: [0.05, 0.10, 0.16, 0.25], t: (x) => '+' + pct(x) + ' к доходу, пока тебя нет' },
    pantry:  { v: [0.5, 1, 1.5, 2.5], t: (x) => '+' + (Math.round(x * 4) / 4).toString().replace('.', ',') + ' ч к кладовой' },
    card:    { v: [0.015, 0.03, 0.05, 0.08], t: (x) => 'карточки лавки дешевле на ' + pct(x) },
    order:   { v: [0.04, 0.08, 0.14, 0.22], t: (x) => '+' + pct(x) + ' к наградам жителей' },
    quest:   { v: [0.05, 0.10, 0.16, 0.25], t: (x) => '+' + pct(x) + ' к наградам заданий дня' },
    drop:    { v: [0.03, 0.06, 0.10, 0.15], t: (x) => '+' + pct(x) + ' к находке ингредиентов' },
    xp:      { v: [0.04, 0.08, 0.12, 0.20], t: (x) => '+' + pct(x) + ' опыта алхимика' },
    crit:    { v: [0.005, 0.01, 0.02, 0.03], t: (x) => '+' + pct(x) + ' шанс тапа ×5' }
  };
  const CAP = { card: 0.4, crit: 0.15 };
  // img - картинка (пока часть взята из других разделов игры, свои нарисуем позже)
  const ITEMS = [
    { id: 'horseshoe', r: 'c', k: 'crit',    img: 'relics/horseshoe', name: 'Подкова удачи',        d: 'Висела над дверью трёх поколений травниц. Ни одна не споткнулась.' },
    { id: 'spoon',     r: 'c', k: 'tap',     img: 'relics/spoon',     name: 'Медная ложка',         d: 'Помнит тысячи помешиваний и подсказывает руке ритм.' },
    { id: 'candle',    r: 'c', k: 'pantry',  img: 'relics/candle',    name: 'Восковая свеча',       d: 'Пока она горит, в кладовой ничего не портится.' },
    { id: 'abacus',    r: 'c', k: 'card',    img: 'relics/abacus',    name: 'Счёты травницы',       d: 'Бусины сами щёлкают, когда торговец завышает цену.' },
    { id: 'bell',      r: 'c', k: 'order',   img: 'relics/bell',      name: 'Дверной колокольчик',  d: 'Звенит так приветливо, что гости оставляют чаевые.' },
    { id: 'mortar',    r: 'c', k: 'drop',    img: 'relics/mortar',        name: 'Ступка знахаря',       d: 'Из одной травинки выжимает две.' },
    { id: 'hourglass', r: 'r', k: 'offline', img: 'relics/hourglass',     name: 'Песочные часы',        d: 'Песок течёт медленнее, когда хозяина нет дома.' },
    { id: 'lens',      r: 'r', k: 'xp',      img: 'relics/lens',          name: 'Лупа алхимика',        d: 'В неё видно то, что пропустил бы даже Бульк.' },
    { id: 'flask',     r: 'r', k: 'inc',     img: 'relics/flask',         name: 'Хрустальная склянка',  d: 'Любое зелье в ней стоит вдвое дороже. Ну, почти.' },
    { id: 'map',       r: 'r', k: 'quest',   img: 'relics/map',           name: 'Карта поручений',      d: 'Крестиком отмечено, где ждёт награда.' },
    { id: 'key',       r: 'r', k: 'pantry',  img: 'relics/key',           name: 'Ключ от погреба',      d: 'Открывает погреб, о котором не знал даже прежний хозяин.' },
    { id: 'watch',     r: 'r', k: 'tap',     img: 'relics/watch',  name: 'Карманные часы',       d: 'Тикают в такт котлу и ускоряют помешивание.' },
    { id: 'dragoneye', r: 'e', k: 'tap',     x: 'crit',    img: 'relics/dragoneye',        name: 'Глаз дракона',          d: 'Тёплый камень. Иногда моргает.' },
    { id: 'skull',     r: 'e', k: 'order',   x: 'xp',      img: 'relics/skull', name: 'Говорящий череп',     d: 'Болтун. Зато гости от него в восторге.' },
    { id: 'compass',   r: 'e', k: 'drop',    x: 'quest',   img: 'relics/compass',      name: 'Лунный компас',         d: 'Показывает не на север, а туда, где растёт нужная трава.' },
    { id: 'mirror',    r: 'e', k: 'inc',     x: 'card',    img: 'relics/mirror',    name: 'Зеркало ведьмы',        d: 'Покупатель видит в нём себя счастливым и платит щедрее.' },
    { id: 'orb',       r: 'e', k: 'xp',      x: 'inc',     img: 'relics/orb', name: 'Хрустальный шар',       d: 'Знает рецепты, которые ты ещё не открыл.' },
    { id: 'flame',     r: 'e', k: 'offline', x: 'pantry',  img: 'relics/flame',        name: 'Вечный огонь',          d: 'Греет котёл, даже когда в лавке никого.' },
    { id: 'crown',     r: 'l', k: 'inc',     x: 'tap',     img: 'relics/crown',        name: 'Корона Первой Ведьмы',  d: 'Та, что основала первую лавку зелий, носила её сто лет.' },
    { id: 'wishstar',  r: 'l', k: 'crit',    x: 'order',   img: 'relics/wishstar',      name: 'Звезда желаний',        d: 'Упала прямо в котёл. Бульк до сих пор этим гордится.' },
    { id: 'tablet',    r: 'l', k: 'quest',   x: 'xp',      img: 'relics/tablet', name: 'Скрижаль рун',        d: 'На ней записаны все поручения мира. И ответы к ним.' },
    { id: 'ancient',   r: 'l', k: 'drop',    x: 'inc',     img: 'relics/ancient',         name: 'Руна древних',          d: 'Травы сами тянутся к тому, кто её носит.' },
    { id: 'pouch',     r: 'l', k: 'offline', x: 'card',    img: 'relics/pouch', name: 'Мешочек звездочёта',   d: 'В нём звёзды, которые приносят доход даже ночью.' },
    { id: 'portrait',  r: 'l', k: 'order',   x: 'pantry',  img: 'relics/portrait',  name: 'Портрет Первого Алхимика', d: 'Старик на портрете подмигивает лучшим покупателям.' }
  ];
  const ITEM = Object.fromEntries(ITEMS.map((x) => [x.id, x]));
  const EXTRA_KINDS = Object.keys(KIND);

  // сундуки: что выпадает. relic - сколько диковинок и с какими весами редкости
  const CHEST = {
    w: { name: 'Деревянный сундук', img: 'relics/chest_w', open: 'relics/chest_w_open', cls: 'ch-w', cost: 15,
         relic: [{ p: 0.35, w: { c: 85, r: 14, e: 1 } }], ess: 0.5, ing: 2, cr: 0 },
    s: { name: 'Серебряный сундук', img: 'relics/chest_s', open: 'relics/chest_s_open', cls: 'ch-s', cost: 60,
         relic: [{ p: 1, w: { r: 78, e: 19, l: 3 } }], ess: 1, ing: 0, cr: 2, pity: 10 },
    g: { name: 'Золотой сундук', img: 'relics/chest_g', open: 'relics/chest_g_open', cls: 'ch-g', cost: 180,
         relic: [{ p: 1, w: { e: 85, l: 15 } }, { p: 1, w: { c: 50, r: 50 } }], ess: 2, ing: 0, cr: 5 },
    t: { name: 'Звёздный сундук', img: 'relics/chest_t', open: 'relics/chest_t_open', cls: 'ch-t', cost: 0,
         relic: [{ p: 1, w: { l: 100 } }, { p: 1, w: { e: 100 } }], ess: 0, ing: 0, cr: 10 }
  };
  const CHEST_ORDER = ['w', 's', 'g', 't'];

  // колесо: 8 секторов
  const WHEEL = [
    { id: 'ess1', w: 20, img: 'ui/essence', label: 'Эссенция', sub: '30 мин дохода' },
    { id: 'cr3', w: 16, img: 'ui/crystal', label: '3 кристалла' },
    { id: 'ing', w: 15, img: 'ui/basket', label: '3 ингредиента' },
    { id: 'chw', w: 18, img: 'relics/chest_w', label: 'Деревянный сундук' },
    { id: 'ess2', w: 10, img: 'ui/essence', label: 'Много эссенции', sub: '2 ч дохода' },
    { id: 'sh', w: 10, img: 'ui/shards', label: '15 осколков' },
    { id: 'chs', w: 8, img: 'relics/chest_s', label: 'Серебряный сундук' },
    { id: 'rel', w: 3, img: 'relics/wishstar', label: 'Редкая диковинка' }
  ];

  // ---------- состояние ----------
  function norm() {
    const s = S();
    let r = s.rel;
    if (!r || typeof r !== 'object' || Array.isArray(r)) r = s.rel = {};
    if (!r.own || typeof r.own !== 'object') r.own = {};
    for (const id in r.own) { const o = r.own[id]; if (!ITEM[id] || !o || typeof o !== 'object') delete r.own[id]; else { o.st = Math.max(1, Math.min(5, o.st | 0 || 1)); if (o.x && !KIND[o.x]) delete o.x; } }
    if (!r.dup || typeof r.dup !== 'object') r.dup = {};
    for (const id in r.dup) if (!ITEM[id] || !(r.dup[id] > 0)) delete r.dup[id];
    if (!Array.isArray(r.shelf)) r.shelf = [];
    r.shelf = r.shelf.filter((id, i, a) => r.own[id] && a.indexOf(id) === i).slice(0, slots());
    if (!(r.sh >= 0)) r.sh = 0;
    if (!r.ch || typeof r.ch !== 'object') r.ch = {};
    CHEST_ORDER.forEach((k) => { if (!(r.ch[k] >= 0)) r.ch[k] = 0; });
    if (!(r.pity >= 0)) r.pity = 0;
    if (!r.wh || typeof r.wh !== 'object') r.wh = { d: '', free: 0, ad: 0 };
    if (r.wh.d !== Econ.today()) r.wh = { d: Econ.today(), free: 0, ad: 0 };
    if (!Array.isArray(r.ranks)) r.ranks = [];   // за какие ранги уже дан сундук
    if (!(r.lv >= 0)) r.lv = 0;                   // за какой уровень последний серебряный
    if (!Array.isArray(r.fresh)) r.fresh = [];    // новые диковинки, ещё не просмотренные
    return r;
  }
  const st = () => norm();

  // доступно с ранга «Лавочка»
  const unlocked = () => Econ.rank() >= 1;
  const slots = () => { const k = Econ.rank(); return 3 + (k >= 3 ? 1 : 0) + (k >= 5 ? 1 : 0); };
  const nextSlotRank = () => { const k = Econ.rank(); return k < 3 ? 3 : k < 5 ? 5 : -1; };
  const starMul = (n) => 1 + 0.5 * (n - 1);
  const mainVal = (it, stars) => KIND[it.k].v[RAR[it.r].i] * starMul(stars);
  const extraKind = (id) => { const o = st().own[id]; return (o && o.x) || ITEM[id].x || null; };
  const extraVal = (it, stars) => KIND[extraKind(it.id) || it.k].v[RAR[it.r].i] * starMul(stars) * 0.5;

  // сумма бонусов диковинок на полке
  let bcache = null, bkey = '';
  function bonus(kind) {
    const s = S();
    if (!s.rel || !Array.isArray(s.rel.shelf) || !s.rel.shelf.length) return 0;
    const key = JSON.stringify([s.rel.shelf, s.rel.own]);
    if (key !== bkey) {
      bkey = key; bcache = {};
      s.rel.shelf.forEach((id) => {
        const it = ITEM[id], o = s.rel.own[id];
        if (!it || !o) return;
        bcache[it.k] = (bcache[it.k] || 0) + mainVal(it, o.st);
        const xk = o.x || it.x;
        if (xk) bcache[xk] = (bcache[xk] || 0) + extraVal(it, o.st);
      });
      for (const k in CAP) if (bcache[k] > CAP[k]) bcache[k] = CAP[k];
    }
    return bcache[kind] || 0;
  }
  const bonusLines = (id, stars) => {
    const it = ITEM[id];
    const out = [KIND[it.k].t(mainVal(it, stars))];
    const xk = extraKind(id);
    if (xk) out.push(KIND[xk].t(extraVal(it, stars)));
    return out;
  };

  // ---------- выдача ----------
  function pickRarity(w) {
    const tot = Object.values(w).reduce((a, b) => a + b, 0);
    let x = Math.random() * tot;
    for (const k of RORDER.slice().reverse()) { if (!w[k]) continue; x -= w[k]; if (x < 0) return k; }
    return Object.keys(w)[0];
  }
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
  // выдать диковинку: новая - в коллекцию, повторка - в сумку повторок
  function giveRelic(id) {
    const r = st();
    if (r.own[id]) { r.dup[id] = (r.dup[id] || 0) + 1; return { t: 'relic', id, dup: true }; }
    r.own[id] = { st: 1 };
    if (!r.fresh.includes(id)) r.fresh.push(id);
    // свободное место на полке - ставим сразу
    if (r.shelf.length < slots()) r.shelf.push(id);
    return { t: 'relic', id, dup: false };
  }
  function giveRarity(rar) { return giveRelic(pickOne(ITEMS.filter((x) => x.r === rar)).id); }

  function addChest(k, n) {
    if (!CHEST[k]) return;
    const r = st();
    r.ch[k] = (r.ch[k] || 0) + (n || 1);
    refreshButton();
  }

  // открыть сундук: список наград
  function openChest(k) {
    const r = st(), c = CHEST[k];
    if (!c || !(r.ch[k] > 0)) return null;
    r.ch[k]--;
    const got = [];
    c.relic.forEach((slot, i) => {
      if (Math.random() >= slot.p) return;
      let rar = pickRarity(slot.w);
      if (k === 's' && i === 0) {
        if (rar === 'e' || rar === 'l') r.pity = 0;
        else if (++r.pity >= c.pity) { rar = 'e'; r.pity = 0; }
      }
      got.push(giveRarity(rar));
    });
    if (c.ess) { const v = Econ.hoursOfIncome(c.ess, 300); Econ.earn(v); got.push({ t: 'ess', v }); }
    if (c.ing) { const l = Brew.give(c.ing, 0.15); got.push({ t: 'ing', l }); }
    if (c.cr) { Econ.addCrystals(c.cr); got.push({ t: 'cr', n: c.cr }); }
    save(); refreshButton();
    return got;
  }

  // шансы для «Что внутри?»
  function odds(k) {
    const c = CHEST[k], out = [];
    c.relic.forEach((slot, i) => {
      const tot = Object.values(slot.w).reduce((a, b) => a + b, 0);
      const parts = RORDER.filter((x) => slot.w[x]).map((x) => RAR[x].name.toLowerCase() + ' ' + pct(slot.p * slot.w[x] / tot));
      out.push((c.relic.length > 1 ? (i + 1) + '-я диковинка: ' : slot.p < 1 ? 'Диковинка (' + pct(slot.p) + '): ' : 'Диковинка: ') + parts.join(', '));
    });
    if (k === 's') out.push('Каждый ' + c.pity + '-й серебряный сундук без эпической гарантированно даёт эпическую.');
    const res = [];
    if (c.ess) res.push('эссенция (' + (c.ess < 1 ? c.ess * 60 + ' мин' : c.ess + ' ч') + ' дохода)');
    if (c.ing) res.push(c.ing + ' ингредиента');
    if (c.cr) res.push(c.cr + ' ' + UI.crystalsWord(c.cr));
    if (res.length) out.push('Всегда: ' + res.join(', ') + '.');
    return out;
  }

  // ---------- осколки ----------
  const upCost = (id) => { const o = st().own[id]; return o && o.st < 5 ? RAR[ITEM[id].r].up * Math.pow(2, o.st - 1) : 0; };
  function upgrade(id) {
    const r = st(), c = upCost(id);
    if (!c || r.sh < c) return false;
    r.sh -= c; r.own[id].st++;
    save(); return true;
  }
  function dismantle(id, all) {
    const r = st(), n = r.dup[id] || 0;
    if (!n) return 0;
    const k = all ? n : 1;
    r.dup[id] -= k; if (!r.dup[id]) delete r.dup[id];
    const v = k * RAR[ITEM[id].r].dis;
    r.sh += v; save(); return v;
  }
  function dismantleAll() {
    let v = 0;
    Object.keys(st().dup).forEach((id) => { v += dismantle(id, true); });
    return v;
  }
  const dupShards = () => Object.entries(st().dup).reduce((a, [id, n]) => a + n * RAR[ITEM[id].r].dis, 0);
  function craft(id) {
    const r = st(), it = ITEM[id];
    if (!it || r.own[id] || r.sh < RAR[it.r].craft) return false;
    r.sh -= RAR[it.r].craft;
    giveRelic(id);
    save(); return true;
  }
  // сменить дополнительное свойство (эпические и легендарные)
  function reroll(id) {
    const r = st(), it = ITEM[id], o = r.own[id];
    const cost = RAR[it.r].reroll;
    if (!o || !cost || r.sh < cost) return null;
    const cur = extraKind(id);
    const pool = EXTRA_KINDS.filter((k) => k !== cur && k !== it.k);
    r.sh -= cost; o.x = pickOne(pool);
    save(); return o.x;
  }

  // полка
  function toggleShelf(id) {
    const r = st();
    const i = r.shelf.indexOf(id);
    if (i >= 0) { r.shelf.splice(i, 1); save(); return true; }
    if (r.shelf.length >= slots()) return false;
    r.shelf.push(id); save(); return true;
  }

  // ---------- источники сундуков ----------
  // все задания дня выполнены - деревянный сундук
  function onQuestsDone() { if (unlocked()) { addChest('w'); UI.toast('Все задания дня выполнены: деревянный сундук в «Диковинках»!'); } }
  // новый ранг - золотой сундук (один раз за каждый ранг)
  function onRank(k) {
    const r = st();
    if (k < 1 || r.ranks.includes(k)) return;
    r.ranks.push(k);
    addChest('g');
  }
  // каждые 5 уровней алхимика - серебряный
  function onLevel(lv) {
    const r = st();
    const n = Math.floor(lv / 5);
    // до приветственного подарка только запоминаем: сундуки за прошлые уровни не выдаём
    if (n > r.lv) { if (unlocked() && r.welcome) addChest('s', n - r.lv); r.lv = n; }
  }
  // долгие походы питомцев: 4 ч - деревянный, 8 ч - серебряный
  function onTrip(min) {
    if (!unlocked()) return null;
    if (min >= 480) { addChest('s'); return 's'; }
    if (min >= 240) { addChest('w'); return 'w'; }
    return null;
  }
  // подарок к открытию раздела
  function welcome() {
    const r = st();
    if (r.welcome || !unlocked()) return false;
    r.welcome = true;
    r.lv = Math.floor(S().lvl / 5);
    for (let k = 1; k <= Econ.rank(); k++) if (!r.ranks.includes(k)) r.ranks.push(k);
    addChest('s'); addChest('w', 2);
    save();
    return true;
  }

  // ---------- колесо ----------
  const wheelFree = () => st().wh.free < 1;
  const wheelAd = () => st().wh.ad < 1 && Platform.adsAvailable();
  function wheelRoll() {
    const tot = WHEEL.reduce((a, x) => a + x.w, 0);
    let x = Math.random() * tot;
    for (let i = 0; i < WHEEL.length; i++) { x -= WHEEL[i].w; if (x < 0) return i; }
    return 0;
  }
  function wheelGive(i) {
    const w = WHEEL[i];
    if (w.id === 'ess1' || w.id === 'ess2') { const v = Econ.hoursOfIncome(w.id === 'ess1' ? 0.5 : 2, 300); Econ.earn(v); return '+' + UI.ess(v) + ' эссенции'; }
    if (w.id === 'cr3') { Econ.addCrystals(3); return '+3 кристалла'; }
    if (w.id === 'ing') { const l = Brew.give(3, 0.2); return 'Ингредиенты: ' + l.map((x) => x.name).join(', '); }
    if (w.id === 'chw') { addChest('w'); return 'Деревянный сундук'; }
    if (w.id === 'chs') { addChest('s'); return 'Серебряный сундук'; }
    if (w.id === 'sh') { st().sh += 15; return '+15 мерцающих осколков'; }
    const g = giveRarity('r');
    return (g.dup ? 'Повторка: ' : 'Новая диковинка: ') + ITEM[g.id].name;
  }

  // ---------- кнопка на главном ----------
  const chestsCount = () => { const r = S().rel; return r && r.ch ? CHEST_ORDER.reduce((a, k) => a + (r.ch[k] || 0), 0) : 0; };
  function refreshButton() {
    const b = document.getElementById('relic-btn'), w = document.getElementById('wheel-btn');
    const on = unlocked();
    if (b) {
      b.hidden = !on;
      const n = b.querySelector('b'), c = on ? chestsCount() + (S().rel && S().rel.fresh ? S().rel.fresh.length : 0) : 0;
      if (n) { n.hidden = !c; n.textContent = c > 9 ? '9+' : String(c); }
    }
    if (w) {
      w.hidden = !on;
      const wh = S().rel && S().rel.wh;
      const n = w.querySelector('b'), c = on && (!wh || wh.d !== Econ.today() || wh.free < 1) ? 1 : 0;
      if (n) { n.hidden = !c; n.textContent = '!'; }
    }
  }

  // ---------- окно «Диковинки» ----------
  let tab = 'shelf', sel = null, reveal = null, showOdds = '';
  const RCLS = (r) => 'rar-' + r;
  const stars = (n) => h('span', { class: 'rel-stars' }, Array.from({ length: 5 }, (_, i) => h('i', { class: i < n ? 'on' : '' }, '★')));

  function open(startTab) {
    if (!unlocked()) { UI.toast('Диковинки появятся на ранге «' + D().ranks[1].name + '»'); return; }
    const first = welcome();
    if (startTab) tab = startTab;
    sel = null; reveal = null;
    const body = h('div', { class: 'brew relics' });
    const draw = () => UI.keepSeg(body, () => drawInner(body, draw));
    draw();
    UI.modal({ sheet: true, title: '', cls: 'relics-modal', body, onClose: () => { refreshButton(); }, onOpen: (box) => box.classList.add('fixed-h') });
    if (first) setTimeout(() => UI.toast('Подарок к открытию: серебряный и два деревянных сундука!'), 300);
  }
  const D = () => DATA;

  function drawInner(body, redraw) {
    body.innerHTML = '';
    const r = st();
    const top = h('div', { class: 'sheet-top' });
    body.append(top);
    top.append(h('div', { class: 'brew-head' }, pic('relics/chest_g', 'brew-head-ico'),
      h('div', { class: 'brew-head-text' }, h('b', null, 'Диковинки'),
        h('small', null, 'Полка ' + r.shelf.length + '/' + slots() + ' · собрано ' + Object.keys(r.own).length + '/' + ITEMS.length),
        h('small', { class: 'rel-shards' }, pic('ui/shards', 'rel-sh-ico'), 'Осколки: ', h('b', null, Fmt.num(r.sh))))));
    const dupN = Object.values(r.dup).reduce((a, b) => a + b, 0);
    const tabs = [['shelf', 'Полка', r.fresh.length], ['chests', 'Сундуки', chestsCount()], ['craft', 'Мастерская', dupN]];
    top.append(h('div', { class: 'seg' }, tabs.map(([id, l, n]) => {
      const b = h('button', { type: 'button', class: 'seg-btn' + (tab === id ? ' on' : '') }, l, n ? h('span', { class: 'seg-badge' }, n > 9 ? '9+' : n) : null);
      b.addEventListener('click', () => { tab = id; sel = null; reveal = null; Sound.tap(); redraw(); body.scrollTop = 0; });
      return b;
    })));
    if (reveal) drawReveal(body, redraw);
    else if (sel) drawDetail(body, redraw);
    else if (tab === 'shelf') drawShelf(body, redraw);
    else if (tab === 'chests') drawChests(body, redraw);
    else drawCraft(body, redraw);
  }

  function tile(id, onClick, extra) {
    const it = ITEM[id], o = st().own[id];
    const b = h('button', { type: 'button', class: 'rel-tile ' + RCLS(it.r) + (o ? '' : ' locked') + (extra || '') },
      o ? pic(it.img, 'rel-ico') : h('span', { class: 'rel-q' }, '?'),
      o ? stars(o.st) : h('span', { class: 'rel-rn' }, RAR[it.r].name),
      st().dup[id] ? h('span', { class: 'rel-dup' }, '+' + st().dup[id]) : null,
      st().fresh.includes(id) ? h('span', { class: 'rel-new' }, 'новое') : null);
    b.addEventListener('click', onClick);
    return b;
  }

  function drawShelf(body, redraw) {
    const r = st();
    // полка
    const shelf = h('div', { class: 'rel-shelf', style: 'grid-template-columns: repeat(' + slots() + ', minmax(0, 1fr))' });
    for (let i = 0; i < slots(); i++) {
      const id = r.shelf[i];
      if (id) shelf.append(tile(id, () => { Sound.tap(); sel = id; redraw(); }, ' on-shelf'));
      else shelf.append(h('div', { class: 'rel-tile empty-slot' }, h('span', null, '+'), h('small', null, 'пусто')));
    }
    const ns = nextSlotRank();
    body.append(h('div', { class: 'rel-shelf-box' }, h('div', { class: 'rel-sub' }, 'Полка лавки'), shelf,
      ns > 0 ? h('small', { class: 'rel-hint' }, 'Ещё одно место - на ранге «' + D().ranks[ns].name + '»') : null));
    // суммарные бонусы
    const tot = Object.keys(KIND).filter((k) => bonus(k) > 0).map((k) => KIND[k].t(bonus(k)));
    body.append(h('div', { class: 'rel-sum' }, tot.length ? tot.map((t) => h('div', null, t)) : h('small', null, 'Поставь диковинку на полку - она начнёт помогать лавке.')));
    // коллекция
    body.append(h('div', { class: 'rel-sub' }, 'Коллекция'));
    RORDER.forEach((rar) => {
      body.append(h('div', { class: 'rel-grid' }, ITEMS.filter((x) => x.r === rar).map((x) => tile(x.id, () => { Sound.tap(); sel = x.id; redraw(); }))));
    });
  }

  function drawDetail(body, redraw) {
    const r = st(), id = sel, it = ITEM[id], o = r.own[id];
    const fi = r.fresh.indexOf(id); if (fi >= 0) { r.fresh.splice(fi, 1); save(); refreshButton(); }
    const back = h('button', { type: 'button', class: 'rel-back' }, '‹ Назад');
    back.addEventListener('click', () => { Sound.tap(); sel = null; redraw(); });
    const box = h('div', { class: 'rel-detail ' + RCLS(it.r) },
      h('div', { class: 'rel-big' }, o ? pic(it.img, 'rel-big-ico') : h('span', { class: 'rel-q big' }, '?')),
      h('b', { class: 'rel-name' }, it.name),
      h('div', { class: 'rel-rar' }, RAR[it.r].name + (o ? '' : ' · ещё не найдена')),
      o ? stars(o.st) : null,
      h('p', { class: 'rel-desc' }, it.d),
      h('div', { class: 'rel-bonus' }, bonusLines(id, o ? o.st : 1).map((t, i) => h('div', { class: i ? 'x' : '' }, t))),
      o && o.st < 5 ? h('small', { class: 'rel-hint' }, 'На ' + (o.st + 1) + ' звёздах: ' + bonusLines(id, o.st + 1).join(', ')) : null);
    const acts = h('div', { class: 'rel-acts' });
    if (o) {
      const onShelf = r.shelf.includes(id);
      const b1 = h('button', { type: 'button', class: 'btn' + (onShelf ? ' alt' : '') }, onShelf ? 'Снять с полки' : 'Поставить на полку');
      b1.addEventListener('click', () => {
        if (!toggleShelf(id)) { Sound.deny(); UI.toast('Полка заполнена: сначала сними другую диковинку'); return; }
        Sound.tap(); UI.refresh(true); redraw();
      });
      acts.append(b1);
      const c = upCost(id);
      if (c) {
        const b2 = h('button', { type: 'button', class: 'btn', disabled: r.sh < c }, 'Улучшить ', pic('ui/shards', 'btn-ico'), ' ' + Fmt.num(c));
        b2.addEventListener('click', () => { if (upgrade(id)) { Sound.coin(); UI.toast(it.name + ': ' + r.own[id].st + ' звезды!'); UI.refresh(true); redraw(); } });
        acts.append(b2);
      } else acts.append(h('small', { class: 'rel-hint' }, 'Максимум звёзд'));
      if (r.dup[id]) {
        const b3 = h('button', { type: 'button', class: 'btn alt' }, 'Разобрать повторки (' + r.dup[id] + '): +', pic('ui/shards', 'btn-ico'), ' ' + r.dup[id] * RAR[it.r].dis);
        b3.addEventListener('click', () => { const v = dismantle(id, true); Sound.coin(); UI.toast('+' + v + ' мерцающих осколков'); redraw(); });
        acts.append(b3);
      }
      if (RAR[it.r].reroll) {
        const b4 = h('button', { type: 'button', class: 'btn alt', disabled: r.sh < RAR[it.r].reroll }, 'Сменить 2-е свойство ', pic('ui/shards', 'btn-ico'), ' ' + RAR[it.r].reroll);
        b4.addEventListener('click', () => { const k = reroll(id); if (k) { Sound.coin(); UI.toast('Новое свойство: ' + KIND[k].t(extraVal(it, r.own[id].st))); UI.refresh(true); redraw(); } });
        acts.append(b4);
      }
    } else {
      const c = RAR[it.r].craft;
      const b5 = h('button', { type: 'button', class: 'btn', disabled: r.sh < c }, 'Создать ', pic('ui/shards', 'btn-ico'), ' ' + Fmt.num(c));
      b5.addEventListener('click', () => { if (craft(id)) { Sound.coin(); UI.toast('Создана: ' + it.name + '!'); UI.refresh(true); redraw(); } });
      acts.append(b5, h('small', { class: 'rel-hint' }, 'Выпадает из сундуков. Или создай в мастерской из мерцающих осколков.'));
    }
    body.append(back, box, acts);
  }

  function drawChests(body, redraw) {
    const r = st();
    CHEST_ORDER.forEach((k) => {
      const c = CHEST[k], n = r.ch[k] || 0;
      const openB = h('button', { type: 'button', class: 'pill-btn', disabled: !n }, n ? 'Открыть' : 'Нет');
      openB.addEventListener('click', () => {
        const got = openChest(k);
        if (!got) return;
        Sound.tap(); reveal = { k, got, stage: 'closed' }; UI.refresh(true); redraw(); body.scrollTop = 0;
      });
      const buy = c.cost ? h('button', { type: 'button', class: 'pill-btn alt', disabled: S().cr < c.cost }, pic('ui/crystal', 'btn-ico'), ' ' + c.cost) : null;
      if (buy) buy.addEventListener('click', () => {
        if (S().cr < c.cost) { Sound.deny(); return; }
        S().cr -= c.cost; addChest(k); save(); Sound.coin(); UI.toast(c.name + ' куплен'); UI.refresh(true); redraw();
      });
      const info = h('button', { type: 'button', class: 'rel-info' }, showOdds === k ? 'Скрыть' : 'Что внутри?');
      info.addEventListener('click', () => { Sound.tap(); showOdds = showOdds === k ? '' : k; redraw(); });
      body.append(h('div', { class: 'rel-chest ' + c.cls },
        h('div', { class: 'rel-chest-top' },
          h('div', { class: 'rel-chest-pic' }, pic(c.img, 'rel-chest-ico'), n ? h('span', { class: 'rel-cnt' }, '×' + n) : null),
          h('div', { class: 'rel-chest-info' }, h('b', null, c.name), info,
            h('div', { class: 'rel-chest-btns' }, openB, buy))),
        showOdds === k ? h('ul', { class: 'rel-odds' }, odds(k).map((t) => h('li', null, t))) : null));
    });
    body.append(h('small', { class: 'rel-hint center' }, 'Сундуки дают: все задания дня (деревянный), каждые 5 уровней алхимика (серебряный), новый ранг (золотой), походы питомцев на 4 и 8 часов, Колесо Булька.'));
  }

  function rewardCard(g) {
    if (g.t === 'relic') {
      const it = ITEM[g.id];
      return h('div', { class: 'rel-got ' + RCLS(it.r) }, pic(it.img, 'rel-ico'), h('b', null, it.name), h('small', null, g.dup ? 'повторка (+1 в мастерскую)' : RAR[it.r].name + ' · новая!'));
    }
    if (g.t === 'ess') return h('div', { class: 'rel-got' }, pic('ui/essence', 'rel-ico'), h('b', null, '+' + UI.ess(g.v)), h('small', null, 'эссенции'));
    if (g.t === 'cr') return h('div', { class: 'rel-got' }, pic('ui/crystal', 'rel-ico'), h('b', null, '+' + g.n), h('small', null, UI.crystalsWord(g.n)));
    return h('div', { class: 'rel-got' }, pic('ui/basket', 'rel-ico'), h('b', null, 'Ингредиенты'), h('small', null, g.l.map((x) => x.name).join(', ')));
  }
  // открытие сундука: закрытый подпрыгивает и ждёт нажатия -> трясётся -> вспышка -> крышка открыта, лучи и награды
  function drawReveal(body, redraw) {
    const c = CHEST[reveal.k];
    const best = reveal.got.filter((g) => g.t === 'relic').map((g) => RAR[ITEM[g.id].r].i).reduce((a, b) => Math.max(a, b), -1);
    const rc = best >= 0 ? RCLS(['c', 'r', 'e', 'l'][best]) : '';
    if (reveal.stage === 'closed') {
      const chest = pic(c.img, 'rel-chest-ico ' + c.cls);
      const stage = h('button', { type: 'button', class: 'rel-burst closed ' + rc }, chest);
      const hint = h('small', { class: 'rel-hint center' }, 'Нажми на сундук, чтобы открыть');
      let busy = false;
      const go = () => {
        if (busy) return;
        busy = true; Sound.tap();
        stage.classList.add('shake');
        hint.textContent = '';
        setTimeout(() => { stage.classList.add('flash'); }, 650);
        setTimeout(() => { Sound.coin(); reveal.stage = 'open'; redraw(); }, 900);
      };
      stage.addEventListener('click', go);
      body.append(h('div', { class: 'rel-reveal' }, stage, h('b', { class: 'rel-name' }, c.name), hint));
      return;
    }
    const list = h('div', { class: 'rel-got-list' }, reveal.got.map(rewardCard));
    const box = h('div', { class: 'rel-reveal ' + rc },
      h('div', { class: 'rel-burst opened' }, h('i', { class: 'rel-rays' }), pic(c.open || c.img, 'rel-chest-ico open ' + c.cls)),
      h('b', { class: 'rel-name' }, c.name), list);
    setTimeout(() => { if (list.isConnected) list.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 1300);
    const more = (st().ch[reveal.k] || 0) > 0;
    const again = h('button', { type: 'button', class: 'btn' }, more ? 'Открыть ещё (' + st().ch[reveal.k] + ')' : 'Готово');
    again.addEventListener('click', () => {
      if (more) { const got = openChest(reveal.k); if (got) { Sound.tap(); reveal = { k: reveal.k, got, stage: 'closed' }; } }
      else reveal = null;
      UI.refresh(true); redraw();
    });
    const toShelf = h('button', { type: 'button', class: 'btn alt' }, 'К полке');
    toShelf.addEventListener('click', () => { Sound.tap(); reveal = null; tab = 'shelf'; redraw(); });
    body.append(box, h('div', { class: 'rel-acts' }, again, toShelf));
  }

  function drawCraft(body, redraw) {
    const r = st();
    const dupN = Object.values(r.dup).reduce((a, b) => a + b, 0);
    const all = h('button', { type: 'button', class: 'btn', disabled: !dupN }, dupN ? 'Разобрать всё: +' : 'Повторок пока нет', dupN ? pic('ui/shards', 'btn-ico') : null, dupN ? ' ' + dupShards() : null);
    all.addEventListener('click', () => { const v = dismantleAll(); if (v) { Sound.coin(); UI.toast('+' + v + ' мерцающих осколков'); redraw(); } });
    body.append(h('div', { class: 'rel-sum' },
      h('div', null, 'Мерцающие осколки: ', h('b', null, Fmt.num(r.sh))),
      h('small', null, 'Получаются из повторок. Тратятся на звёзды диковинок, на создание недостающих и на смену 2-го свойства у эпических и легендарных.')), all);
    if (dupN) body.append(h('div', { class: 'rel-grid' }, Object.keys(r.dup).map((id) => tile(id, () => { Sound.tap(); sel = id; tab = 'shelf'; redraw(); }))));
    const miss = ITEMS.filter((x) => !r.own[x.id]);
    body.append(h('div', { class: 'rel-sub' }, miss.length ? 'Создать недостающие' : 'Все диковинки собраны!'));
    miss.sort((a, b) => RAR[a.r].i - RAR[b.r].i).forEach((x) => {
      const c = RAR[x.r].craft;
      const b = h('button', { type: 'button', class: 'pill-btn', disabled: r.sh < c }, pic('ui/shards', 'btn-ico'), ' ' + Fmt.num(c));
      b.addEventListener('click', () => { if (craft(x.id)) { Sound.coin(); UI.toast('Создана: ' + x.name + '!'); UI.refresh(true); redraw(); } });
      body.append(h('div', { class: 'rel-row ' + RCLS(x.r) }, h('span', { class: 'rel-q sm' }, '?'),
        h('div', { class: 'rel-row-info' }, h('b', null, x.name), h('small', null, RAR[x.r].name + ' · ' + bonusLines(x.id, 1).join(', '))), b));
    });
  }

  // ---------- окно колеса ----------
  // лампочки на рамке (в процентах картинки wheel/ring)
  const BULBS = [[71.3, 14.7], [85.6, 29.1], [85.7, 70.5], [71.2, 84.5], [28.8, 84.5], [14, 70.5], [14, 29.3], [28.9, 14.8]];
  function wheel() {
    if (!unlocked()) { UI.toast('Колесо Булька появится на ранге «' + D().ranks[1].name + '»'); return; }
    st();
    const N = WHEEL.length, seg = 360 / N;
    // крутится только диск с призами; рамка с лампочками, шапка и стрелка стоят на месте
    const disc = h('div', { class: 'wheel-disc' }, pic('wheel/disc', 'wheel-disc-img'), WHEEL.map((w, i) => h('div', { class: 'wheel-seg', style: '--a:' + (i * seg) + 'deg' },
      pic(w.img, 'wheel-ico'))));
    const pointer = pic('wheel/pointer', 'wheel-pointer');
    const bulbs = h('div', { class: 'wheel-bulbs' }, BULBS.map(([x, y], i) => h('i', { style: 'left:' + x + '%;top:' + y + '%;--d:' + (i % 2 ? 0.5 : 0) + 's' })));
    const wheelEl = h('div', { class: 'wheel' }, disc, pic('wheel/ring', 'wheel-ring'), bulbs, pic('wheel/cap', 'wheel-cap'), pointer);
    let angle = 0, busy = false;
    // стрелка щёлкает, когда под ней проходит граница сектора
    const discAngle = () => {
      const t = getComputedStyle(disc).transform;
      if (!t || t === 'none') return 0;
      const m = t.match(/matrix\(([^)]+)\)/); if (!m) return 0;
      const v = m[1].split(',').map(Number);
      return Math.atan2(v[1], v[0]) * 180 / Math.PI;
    };
    function watchTicks(ms) {
      let last = null, total = 0, prev = discAngle();
      const end = performance.now() + ms;
      const step = () => {
        const a = discAngle();
        let d = a - prev; if (d < -180) d += 360; if (d > 180) d -= 360;
        total += d; prev = a;
        const k = Math.floor((total + seg / 2) / seg);
        if (last !== null && k !== last && pointer.animate) pointer.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-24deg)' }, { transform: 'rotate(0)' }], { duration: 140, easing: 'ease-out' });
        last = k;
        if (performance.now() < end) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    const result = h('div', { class: 'wheel-res' }, 'Крути колесо - приз точно будет!');
    const btns = h('div', { class: 'rel-acts' });
    const legend = h('ul', { class: 'rel-odds wheel-odds' }, WHEEL.map((w) => h('li', null, w.label + (w.sub ? ' (' + w.sub + ')' : '') + ' - ' + Math.round(w.w) + '%')));
    const drawBtns = () => {
      btns.replaceChildren();
      if (wheelFree()) {
        const b = h('button', { type: 'button', class: 'btn' }, 'Крутить бесплатно');
        b.addEventListener('click', () => spin('free'));
        btns.append(b);
      } else if (st().wh.ad < 1) {
        const b = h('button', { type: 'button', class: 'btn', disabled: !Platform.adsAvailable() }, pic('ui/ad', 'btn-ico'), ' Ещё раз за рекламу');
        b.addEventListener('click', async () => {
          if (busy) return;
          b.disabled = true;
          const ok = await Platform.rewardedAd();
          if (!ok) { b.disabled = false; UI.toast('Реклама не показалась, попробуй позже'); return; }
          spin('ad');
        });
        btns.append(b);
        if (!Platform.adsAvailable()) btns.append(h('small', { class: 'rel-hint center' }, 'Реклама здесь недоступна'));
      } else btns.append(h('small', { class: 'rel-hint center' }, 'На сегодня всё. Новое вращение - завтра!'));
    };
    function spin(kind) {
      if (busy) return;
      const r = st();
      if (kind === 'free' && !wheelFree()) return;
      if (kind === 'ad' && r.wh.ad >= 1) return;
      busy = true;
      if (kind === 'free') r.wh.free++; else r.wh.ad++;
      const i = wheelRoll();
      const text = wheelGive(i);
      save(); refreshButton();
      btns.replaceChildren();
      Sound.tap();
      // сектор i должен встать под стрелку сверху
      const target = 360 * 5 + (360 - i * seg) - (Math.random() * 0.6 - 0.3) * seg;
      angle = angle - (angle % 360) + target;
      disc.style.transform = 'rotate(' + angle + 'deg)';
      wheelEl.classList.add('spinning'); wheelEl.classList.remove('won');
      watchTicks(4300);
      result.textContent = '...';
      setTimeout(() => {
        busy = false; Sound.coin();
        wheelEl.classList.remove('spinning'); wheelEl.classList.add('won');
        result.textContent = 'Приз: ' + text;
        result.classList.add('win');
        UI.refresh(true); drawBtns();
      }, 4300);
    }
    drawBtns();
    UI.modal({ title: 'Колесо Булька', cls: 'wheel-modal', body: h('div', { class: 'wheel-box' },
      wheelEl,
      result, btns,
      h('details', { class: 'wheel-more' }, h('summary', null, 'Шансы призов'), legend)), onClose: refreshButton });
  }

  return {
    bonus, open, wheel, refreshButton, addChest, onQuestsDone, onRank, onLevel, onTrip, unlocked,
    // для проверок
    _st: st, _items: ITEMS, _chest: CHEST, _wheel: WHEEL, _open: openChest, _odds: odds
  };
})();

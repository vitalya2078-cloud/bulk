// =====================================================================
//  Версия 0.5: варка зелий
//  Ингредиенты → 3 штуки в котёл → зелье по свойствам → сумка → выпить.
//  Данные (свойства, ингредиенты, зелья) правятся здесь, в начале файла.
// =====================================================================

// ---------- Свойства ингредиентов ----------
// Свойство - это группа в списке ингредиентов. На рецепт оно не влияет:
// рецепт - это три конкретных ингредиента.
DATA.props = [
  { id: 'herb',  name: 'Природа', img: 'props/herb' },
  { id: 'fire',  name: 'Огонь',   img: 'props/fire' },
  { id: 'water', name: 'Вода',    img: 'props/water' },
  { id: 'star',  name: 'Звезда',  img: 'props/star' },
  { id: 'stone', name: 'Камень',  img: 'props/stone' }
];

// ---------- Ингредиенты ----------
// rare - редкий: зелье с ним выходит «отличным» (действует ×1,5), торговка его не продаёт
DATA.ingr = [
  { id: 'mint', name: 'Мята', p: 'herb' },
  { id: 'chamomile', name: 'Ромашка', p: 'herb' },
  { id: 'lavender', name: 'Лаванда', p: 'herb' },
  { id: 'moss', name: 'Мох', p: 'herb' },
  { id: 'acorn', name: 'Жёлудь', p: 'herb' },
  { id: 'berries', name: 'Ягоды', p: 'herb' },
  { id: 'pumpkin', name: 'Тыква', p: 'herb' },
  { id: 'honey', name: 'Мёд', p: 'herb' },
  { id: 'clover', name: 'Клевер', p: 'herb' },
  { id: 'mandrake', name: 'Мандрагора', p: 'herb' },
  { id: 'rosehip', name: 'Шиповник', p: 'herb' },
  { id: 'fern', name: 'Цветок папоротника', p: 'herb', rare: true },

  { id: 'spark', name: 'Искра', p: 'fire' },
  { id: 'ember', name: 'Уголёк', p: 'fire' },
  { id: 'chili', name: 'Перец чили', p: 'fire' },
  { id: 'ginger', name: 'Имбирь', p: 'fire' },
  { id: 'fireflower', name: 'Огнецвет', p: 'fire' },
  { id: 'lava', name: 'Капля лавы', p: 'fire' },
  { id: 'dragon_scale', name: 'Чешуя дракона', p: 'fire', rare: true },
  { id: 'firebird', name: 'Перо жар-птицы', p: 'fire', rare: true },

  { id: 'dew', name: 'Роса', p: 'water' },
  { id: 'snowflake', name: 'Снежинка', p: 'water' },
  { id: 'shell', name: 'Ракушка', p: 'water' },
  { id: 'lily', name: 'Кувшинка', p: 'water' },
  { id: 'icicle', name: 'Сосулька', p: 'water' },
  { id: 'seaweed', name: 'Водоросли', p: 'water' },
  { id: 'fishscale', name: 'Рыбья чешуйка', p: 'water' },
  { id: 'pearl', name: 'Жемчуг', p: 'water', rare: true },
  { id: 'mermaid_tear', name: 'Слеза русалки', p: 'water', rare: true },

  { id: 'stardust', name: 'Звёздная пыль', p: 'star' },
  { id: 'feather', name: 'Перо совы', p: 'star' },
  { id: 'mushroom', name: 'Лунный гриб', p: 'star' },
  { id: 'firefly', name: 'Светлячок', p: 'star' },
  { id: 'meteor', name: 'Осколок метеорита', p: 'star' },
  { id: 'cloud_jar', name: 'Облачко в банке', p: 'star' },
  { id: 'moonstone', name: 'Лунный камень', p: 'star' },
  { id: 'moonflower', name: 'Лунный цветок', p: 'star', rare: true },
  { id: 'fairy_wing', name: 'Крылышко феи', p: 'star', rare: true },

  { id: 'crystal', name: 'Кристалл', p: 'stone' },
  { id: 'flint', name: 'Кремень', p: 'stone' },
  { id: 'ore', name: 'Железная руда', p: 'stone' },
  { id: 'salt', name: 'Соль', p: 'stone' },
  { id: 'amethyst', name: 'Аметист', p: 'stone' },
  { id: 'ammonite', name: 'Аммонит', p: 'stone' },
  { id: 'obsidian', name: 'Обсидиан', p: 'stone' },
  { id: 'amber', name: 'Янтарь', p: 'stone', rare: true },
  { id: 'nugget', name: 'Золотой самородок', p: 'stone', rare: true }
];
DATA.ingr.forEach((x) => { x.img = 'ingredients/' + x.id; });

// ---------- Зелья и рецепты ----------
// У каждого зелья несколько рецептов (по 3 конкретных ингредиента, порядок не важен).
// sec - сколько действует (0 - сразу, -1 - до следующего возвращения в игру).
// id рецепта: 'power.0', 'power.1'… Новые рецепты добавляй в конец списка зелья.
DATA.brews = [
  { id: 'power', name: 'Зелье силы', sec: 600, desc: 'Тап ×2', recipes: [
    ['chili', 'ginger', 'ore'], ['ember', 'flint', 'mandrake'], ['spark', 'obsidian', 'acorn'], ['fireflower', 'ore', 'salt']] },
  { id: 'gold', name: 'Золотое зелье', sec: 1800, desc: 'Доход в час ×1,5', recipes: [
    ['honey', 'crystal', 'pumpkin'], ['salt', 'amethyst', 'clover'], ['ore', 'pumpkin', 'meteor'], ['nugget', 'amethyst', 'honey']] },
  { id: 'guest', name: 'Зелье гостеприимства', sec: 1200, desc: 'Жители приходят в 2 раза чаще', recipes: [
    ['chamomile', 'berries', 'mint'], ['lily', 'rosehip', 'honey'], ['mint', 'dew', 'pumpkin'], ['fairy_wing', 'chamomile', 'rosehip']] },
  { id: 'haste', name: 'Зелье спешки', sec: 0, desc: 'Сразу даёт доход за 1 час', recipes: [
    ['spark', 'feather', 'firefly'], ['meteor', 'lava', 'feather'], ['firefly', 'ginger', 'dew'], ['firebird', 'meteor', 'spark']] },
  { id: 'time', name: 'Зелье времени', sec: 86400, desc: 'Копится без тебя +4 ч', recipes: [
    ['salt', 'ammonite', 'moss'], ['icicle', 'snowflake', 'moonstone'], ['ammonite', 'crystal', 'icicle'], ['amber', 'moss', 'ammonite']] },
  { id: 'bubbles', name: 'Пузырчатое зелье', sec: 900, desc: 'Золотые пузыри в 3 раза чаще', recipes: [
    ['dew', 'shell', 'seaweed'], ['cloud_jar', 'fishscale', 'dew'], ['shell', 'lily', 'stardust'], ['pearl', 'shell', 'cloud_jar']] },
  { id: 'luck', name: 'Зелье удачи', sec: 900, desc: 'Шанс крита +10%', recipes: [
    ['clover', 'stardust', 'berries'], ['acorn', 'amethyst', 'firefly'], ['clover', 'mushroom', 'fishscale'], ['fern', 'clover', 'stardust']] },
  { id: 'wisdom', name: 'Зелье мудрости', sec: 1800, desc: 'Опыт ×2', recipes: [
    ['feather', 'mushroom', 'lavender'], ['moonstone', 'ammonite', 'flint'], ['lavender', 'stardust', 'seaweed'], ['moonflower', 'feather', 'moonstone']] },
  { id: 'dragon', name: 'Драконье зелье', sec: 120, desc: 'Тап ×5', recipes: [
    ['lava', 'ember', 'chili'], ['fireflower', 'obsidian', 'spark'], ['lava', 'fireflower', 'ginger'], ['dragon_scale', 'lava', 'ember']] },
  { id: 'sleep', name: 'Сонное зелье', sec: -1, desc: 'Доход без тебя ×2 при следующем возвращении', recipes: [
    ['lavender', 'chamomile', 'moss'], ['lily', 'cloud_jar', 'snowflake'], ['moss', 'mushroom', 'icicle'], ['mermaid_tear', 'lavender', 'lily']] }
];
DATA.brews.forEach((x) => { x.img = 'potions/' + x.id; });
// плоский список всех рецептов: { id: 'power.0', p: зелье, ing: [три id] }
DATA.recipeList = [];
DATA.brews.forEach((p) => p.recipes.forEach((ing, i) => DATA.recipeList.push({ id: p.id + '.' + i, p, ing })));

// Какой житель рассказывает о каком зелье (каждая часть истории - подсказка к его рецепту)
DATA.brewTellers = { agafya: 'sleep', miron: 'time', varya: 'bubbles', tikhon: 'gold', lusha: 'guest', efim: 'power', savva: 'wisdom', grisha: 'luck' };

CONFIG.brew = {
  bagMax: 20,          // сколько зелий помещается в сумку
  maxActive: 2,        // сколько разных зелий действует одновременно
  stackCap: 3,         // одно и то же зелье продлевается максимум до 3× длительности
  rareMul: 1.5,        // отличное качество действует дольше
  tapChance: 1 / 60,   // шанс найти ингредиент за тап
  tapPity: 120,        // не дольше, чем через столько тапов, - гарантированно
  firstCrystals: 3,    // за открытие нового рецепта
  hintPrice: 5,        // подсказка за кристаллы
  shopSlots: 4, shopQty: 3, shopPrice: 1,
  startBook: ['power.0', 'gold.0'],
  start: { chili: 1, ginger: 1, ore: 1, honey: 1, crystal: 1, pumpkin: 1, mint: 2, dew: 1, spark: 1, clover: 1 }
};
CONFIG.xp.brew = 15;
CONFIG.xp.brewNew = 60;

DATA.quests.push({ id: 'brew', type: 'brew', img: 'ui/mortar', amounts: [1, 2, 3], hours: 0.75,
  text: (n) => 'Свари ' + n + ' ' + Fmt.plural(n, ['зелье', 'зелья', 'зелий']) });

DATA.achievements.push(
  { id: 'br1', img: 'ui/medal_potion', name: 'Первое зелье',         desc: 'Свари зелье',              test: (s) => s.brewed >= 1 },
  { id: 'br2', img: 'ui/potion_rack',  name: 'Полная полка',         desc: 'Свари 10 зелий',           test: (s) => s.brewed >= 10 },
  { id: 'br3', img: 'ui/medal_crown',  name: 'Алхимик-исследователь', desc: 'Открой хотя бы по рецепту каждого зелья', test: (s) => DATA.brews.every((p) => s.book.some((r) => r.split('.')[0] === p.id)) },
  { id: 'br4', img: 'ui/book_lens',    name: 'Великая книга',        desc: 'Открой все рецепты',       test: (s) => s.book.length >= DATA.recipeList.length }
);
DATA.titles.push({ id: 'explorer', name: 'Алхимик-исследователь', test: (s) => s.ac.includes('br3') });
DATA.wardrobe.push({ id: 'brew_hat', slot: 'head', name: 'Колпак зельевара', how: { ach: 'br3' }, w: 0.66 });

// ---------- Ложки (новый слот гардероба) ----------
DATA.wardrobe.push(
  { id: 'spoon',  slot: 'spoon', name: 'Деревянная ложка',  how: { free: true },          img: 'spoons/spoon' },
  { id: 'ladle',  slot: 'spoon', name: 'Деревянный черпак', how: { rank: 1 },             img: 'spoons/ladle' },
  { id: 'silver', slot: 'spoon', name: 'Серебряный половник', how: { best: 1 },           img: 'spoons/silver' },
  { id: 'gold_ladle', slot: 'spoon', name: 'Золотой половник', how: { cr: 40 },           img: 'spoons/gold' },
  { id: 'wand',   slot: 'spoon', name: 'Волшебная палочка', how: { ach: 'br4' },          img: 'spoons/wand' },
  { id: 'bone',   slot: 'spoon', name: 'Костяной черпак',   how: { event: 'halloween' },  img: 'spoons/bone' }
);

const Brew = (() => {
  const C = CONFIG, D = DATA, B = CONFIG.brew;
  const S = () => Econ.s;
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const ING = {}; D.ingr.forEach((x) => { ING[x.id] = x; });
  const POT = {}; D.brews.forEach((x) => { POT[x.id] = x; });
  const PROP = {}; D.props.forEach((x) => { PROP[x.id] = x; });
  const rand = (a, b) => a + Math.random() * (b - a);
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const commons = D.ingr.filter((x) => !x.rare);
  const rares = D.ingr.filter((x) => x.rare);
  const key = (list) => list.slice().sort().join('+');
  const REC = {}, BYKEY = {};
  D.recipeList.forEach((r) => { REC[r.id] = r; BYKEY[key(r.ing)] = r; });
  const known = (rid) => S().book.includes(rid);
  const potionKnown = (pid) => S().book.some((rid) => rid.split('.')[0] === pid);

  // ---------- ингредиенты ----------
  const count = (id) => S().ing[id] || 0;
  function add(id, n) { const s = S(); s.ing[id] = (s.ing[id] || 0) + (n || 1); }
  function init() {
    const s = S();
    // сохранения 0.5 с рецептами по свойствам: переводим на рецепты-ингредиенты
    if (s.book.some((x) => !REC[x])) { s.book = s.book.filter((x) => REC[x]); }
    for (const k in s.hints) if (!REC[k]) delete s.hints[k];
    for (const k in s.ing) if (!ING[k]) delete s.ing[k];
    B.startBook.forEach((rid) => { if (!s.book.includes(rid)) s.book.push(rid); });
    if (s.brewInit === true) s.brewInit = 1;
    if (s.brewInit !== 2) {
      s.brewInit = 2;
      for (const id in B.start) add(id, B.start[id]);
    }
  }

  // Выдать n случайных ингредиентов. rareChance - шанс, что каждый окажется редким.
  function give(n, rareChance) {
    const got = [];
    for (let i = 0; i < n; i++) {
      const x = Math.random() < (rareChance || 0) ? pickOne(rares) : pickOne(commons);
      add(x.id);
      got.push(x);
    }
    return got;
  }

  // ---------- сумка и зелья ----------
  const bagCount = () => Object.values(S().bag).reduce((a, n) => a + n, 0);
  function activeList() {
    const s = S(), now = Date.now(), out = [];
    for (const id in s.pa) if (s.pa[id] > now && POT[id]) out.push({ p: POT[id], left: (s.pa[id] - now) / 1000 });
    if (s.sleepPot) out.push({ p: POT.sleep, left: -1 });
    return out;
  }
  const isActive = (id) => (id === 'sleep' ? S().sleepPot : Econ.potion(id));

  function putInBag(r, quality) {
    const s = S(), k = r.p.id + (quality ? '+' : '');
    s.bag[k] = (s.bag[k] || 0) + 1;
  }
  // открыть рецепт в книге (+кристаллы и опыт за первый раз)
  function learn(rid) {
    const s = S();
    if (known(rid)) return false;
    s.book.push(rid);
    delete s.hints[rid];
    s.cr += B.firstCrystals;
    Econ.addXp(C.xp.brewNew);
    return true;
  }

  // Варка: ids - три id ингредиентов. Возвращает результат или { error }
  function brew(ids) {
    const s = S();
    if (ids.length !== 3) return { error: 'Нужно три ингредиента' };
    const need = {};
    ids.forEach((id) => { need[id] = (need[id] || 0) + 1; });
    for (const id in need) if (count(id) < need[id]) return { error: 'Не хватает: ' + ING[id].name };
    const r = BYKEY[key(ids)];
    if (r && bagCount() >= B.bagMax) return { error: 'Сумка полна: выпей что-нибудь' };
    for (const id in need) s.ing[id] -= need[id];
    if (r) {
      const quality = ids.some((id) => ING[id].rare);
      putInBag(r, quality);
      s.brewed++;
      const first = learn(r.id);
      Econ.addXp(C.xp.brew);
      Econ.progress('brew', 1);
      if (typeof Story !== 'undefined') Story.event('brew', r.p.id);
      return { potion: r.p, recipe: r, quality, first };
    }
    // бурда: немного эссенции и подсказка от Булька
    const v = Econ.hoursOfIncome(0.05, 100);
    Econ.earn(v);
    Econ.addXp(C.xp.recipeTry);
    const near = nearest(ids);
    let hinted = false;
    if (near && near.overlap >= 2 && !known(near.r.id)) hinted = hint(near.r.id, near.match);
    return { fail: true, essence: v, near, hinted };
  }

  // Ближайший рецепт: больше всего общих ингредиентов. Сначала неоткрытые.
  function nearest(ids) {
    let best = null;
    D.recipeList.forEach((r) => {
      const match = ids.filter((x, i) => r.ing.includes(x) && ids.indexOf(x) === i);
      const score = match.length * 2 + (known(r.id) ? 0 : 1);
      if (!best || score > best.score) best = { r, overlap: match.length, match, score };
    });
    return best;
  }

  // Подсказка: открывает ещё один ингредиент рецепта. prefer - какие открыть в первую очередь.
  // В hints хранится список открытых ингредиентов рецепта.
  function hint(rid, prefer) {
    const s = S(), r = REC[rid];
    if (!r || known(rid)) return false;
    const have = Array.isArray(s.hints[rid]) ? s.hints[rid] : [];
    const rest = r.ing.filter((x) => !have.includes(x));
    if (rest.length <= 1 && have.length >= 2) {
      // последний ингредиент не подсказываем: его надо угадать самому
      return false;
    }
    const next = (prefer || []).find((x) => rest.includes(x)) || rest[0];
    s.hints[rid] = have.concat([next]);
    return next;
  }
  const hintsOf = (rid) => (Array.isArray(S().hints[rid]) ? S().hints[rid] : []);

  // Выпить зелье из сумки
  function drink(k) {
    const s = S();
    if (!(s.bag[k] > 0)) return { error: 'Такого зелья нет' };
    const id = k.replace('+', ''), p = POT[id], quality = k.endsWith('+');
    if (p.sec > 0) {
      const act = activeList().map((a) => a.p.id);
      if (!act.includes(id) && act.length >= B.maxActive) return { error: 'Одновременно действуют только ' + B.maxActive + ' разных зелья' };
      const now = Date.now();
      const dur = p.sec * 1000 * (quality ? B.rareMul : 1);
      s.pa[id] = Math.min(Math.max(now, s.pa[id] || 0) + dur, now + p.sec * 1000 * B.stackCap * (quality ? B.rareMul : 1));
    } else if (p.sec < 0) {
      if (s.sleepPot) return { error: 'Сонное зелье уже ждёт твоего возвращения' };
      const act = activeList();
      if (act.length >= B.maxActive) return { error: 'Одновременно действуют только ' + B.maxActive + ' разных зелья' };
      s.sleepPot = true;
    }
    s.bag[k]--;
    s.stat.drunk = (s.stat.drunk || 0) + 1; // для «Пути алхимика»
    if (!s.bag[k]) delete s.bag[k];
    let essence = 0;
    if (p.id === 'haste') { essence = Econ.hoursOfIncome(quality ? 1.5 : 1, 2000); Econ.earn(essence); }
    return { p, quality, essence };
  }

  // зелье сна срабатывает при возвращении (вызывается из main.js)
  function onReturn() { const s = S(); if (!s.sleepPot) return false; s.sleepPot = false; return true; }

  function buyHint(rid) {
    const s = S();
    if (s.cr < B.hintPrice) return false;
    const before = s.cr;
    s.cr -= B.hintPrice;
    if (!hint(rid)) { s.cr = before; return false; }
    return true;
  }
  const canHint = (rid) => !known(rid) && hintsOf(rid).length < 2;
  // свиток: подсказка к случайному неоткрытому рецепту (prefer - id зелья)
  function scroll(prefer) {
    const open = D.recipeList.filter((r) => canHint(r.id));
    if (!open.length) return null;
    const pref = prefer ? open.filter((r) => r.p.id === prefer) : [];
    const r = pickOne(pref.length ? pref : open);
    hint(r.id);
    return r;
  }

  // ---------- рецепт дня: один неоткрытый рецепт, 9 ингредиентов на выбор ----------
  function dailyPick(dateKey) {
    const s = S();
    const rng = Econ.rngFrom('bulk:recipe:' + dateKey);
    const pool = D.recipeList.filter((r) => !known(r.id));
    const list = pool.length ? pool : D.recipeList;
    const r = list[Math.floor(rng() * list.length)];
    const others = D.ingr.filter((x) => !r.ing.includes(x.id)).map((x) => x.id);
    for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
    const opts = r.ing.concat(others.slice(0, 6));
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    return { rid: r.id, opts };
  }
  // рецепт дня разгадан: рецепт в книгу, зелье в сумку
  function dailySolved(rid) {
    const r = REC[rid];
    if (!r) return null;
    const first = learn(rid);
    putInBag(r, r.ing.some((id) => ING[id].rare));
    return { r, first };
  }

  // ---------- торговка ----------
  function shopToday() {
    const s = S(), d = Econ.today();
    const rng = Econ.rngFrom('bulk:shop:' + d);
    const pool = commons.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    if (s.shop.d !== d) s.shop = { d, b: [] };
    return pool.slice(0, B.shopSlots).map((x, i) => ({ x, left: B.shopQty - (s.shop.b[i] || 0), i }));
  }
  function buy(i) {
    const s = S();
    const slot = shopToday()[i];
    if (!slot || slot.left <= 0 || s.cr < B.shopPrice) return false;
    s.cr -= B.shopPrice;
    s.shop.b[i] = (s.shop.b[i] || 0) + 1;
    s.stat.bought = (s.stat.bought || 0) + 1;
    add(slot.x.id);
    return slot.x;
  }

  // ---------- награды из разных мест игры ----------
  let pendingNote = [];
  function reward(kind, a) {
    let got = [];
    let msg = '';
    if (kind === 'daily' || kind === 'quest') {
      got = give(2);
      // за задания иногда - свиток с подсказкой к рецепту
      if (kind === 'quest' && Math.random() < 0.3) { const r = scroll(); if (r) msg = 'Свиток рецепта: подсказка к «' + r.p.name + '»'; }
    }
    else if (kind === 'scroll') { const r = scroll(); if (r) msg = 'Свиток рецепта: подсказка к «' + r.p.name + '»'; }
    else if (kind === 'rune') got = give(1, 0.15);
    else if (kind === 'bubble') got = give(1, 0.05);
    else if (kind === 'order') {
      got = give(Math.random() < 0.4 ? 2 : 1, a && a.best ? 0.25 : 0);
      const tell = a && a.story && D.brewTellers[a.id];
      if (tell) {
        const r = scroll(tell);
        if (r && r.p.id === tell) msg = 'Житель рассказал про «' + r.p.name + '»: в книге рецептов новая подсказка';
      }
    }
    if (got.length) flyAll(got);
    if (got.length || msg) note(got, msg);
    return got;
  }
  // короткое сообщение после основного (чтобы не перебивать его)
  let noteT = 0;
  function note(got, msg) {
    pendingNote = pendingNote.concat(got);
    clearTimeout(noteT);
    noteT = setTimeout(() => {
      const names = {};
      pendingNote.forEach((x) => { names[x.name] = (names[x.name] || 0) + 1; });
      const list = Object.keys(names).map((n) => n + (names[n] > 1 ? ' ×' + names[n] : '')).join(', ');
      pendingNote = [];
      UI.toast([list ? 'В сумку: ' + list : '', msg].filter(Boolean).join('. '));
    }, 2500);
    refreshButton();
  }

  // ингредиент за тапы
  function onTap(x, y) {
    const s = S();
    s.tapIng++;
    const petMul = 1 + (typeof Pets !== 'undefined' ? Pets.bonus('drop') : 0) + (typeof Relics !== 'undefined' ? Relics.bonus('drop') : 0);
    if (Math.random() < B.tapChance * petMul || s.tapIng >= B.tapPity) {
      s.tapIng = 0;
      const got = give(1);
      fly(got[0], x, y);
      refreshButton();
    }
  }
  function onBubble(x, y) {
    const got = give(1, 0.05);
    fly(got[0], x, y);
    refreshButton();
  }

  // ---------- полёт ингредиента в сумку ----------
  function fly(item, x, y) {
    const stage = document.getElementById('stage');
    const btn = document.getElementById('brew-btn');
    if (!stage || !btn || UI.screen() !== 'main' || RenderOpts.lowfx) return;
    const sr = stage.getBoundingClientRect(), br = btn.getBoundingClientRect();
    const el = h('img', { class: 'ing-fly', src: IMG(item.img), alt: '', draggable: 'false' });
    el.style.left = x + 'px'; el.style.top = y + 'px';
    stage.append(el);
    const tx = br.left + br.width / 2 - sr.left, ty = br.top + br.height / 2 - sr.top;
    const up = -60 - Math.random() * 40;
    el.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
      { transform: 'translate(-50%,-50%) translate(0,' + up + 'px) scale(1.1)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%,-50%) translate(' + (tx - x) + 'px,' + (ty - y) + 'px) scale(.45)', opacity: 0.9 }
    ], { duration: 1100, easing: 'cubic-bezier(.3,.1,.3,1)' }).onfinish = () => {
      el.remove();
      btn.classList.remove('got'); void btn.offsetWidth; btn.classList.add('got');
    };
  }
  function flyAll(list) {
    if (UI.screen() !== 'main') return;
    const c = Cauldron.center();
    list.forEach((x, i) => setTimeout(() => fly(x, c.x + rand(-40, 40), c.y - 30), i * 180));
  }

  // ---------- кнопка-сумка на экране котла ----------
  function refreshButton() {
    const b = document.getElementById('brew-btn');
    if (!b) return;
    const n = bagCount();
    UI.setText(b.querySelector('b'), n ? n : '');
    b.querySelector('b').hidden = !n;
  }

  // ---------- окно варки ----------
  let tab = 'brew';
  let slots = [];         // выбранные ингредиенты (id)
  let last = null;        // результат последней варки для показа

  function open(startTab) {
    init();
    if (startTab) tab = startTab;
    slots = [];
    last = null;
    const body = h('div', { class: 'brew' });
    const draw = () => UI.keepSeg(body, () => drawInner(body, draw));
    draw();
    UI.modal({ sheet: true, title: '', body, cls: 'brew-modal', onClose: refreshButton,
      onOpen: (box) => box.classList.add('fixed-h') });
  }

  function drawInner(body, redraw) {
    body.innerHTML = '';
    const s = S();
    const top = h('div', { class: 'sheet-top' });
    body.append(top);
    top.append(h('div', { class: 'brew-head' }, pic('ui/potion_bag', 'brew-head-ico'),
      h('div', { class: 'brew-head-text' }, h('b', null, 'Зельеварня'), h('small', null, 'Сумка ' + bagCount() + '/' + B.bagMax + ' · Рецепты ' + s.book.length + '/' + D.recipeList.length)),
      h('div', { class: 'ev-candy' }, pic('ui/crystal', 'cr-ico'), h('b', null, s.cr))));
    const tabs = [['brew', 'Варить'], ['bag', 'Сумка'], ['book', 'Книга'], ['shop', 'Рынок']];
    top.append(h('div', { class: 'seg' }, tabs.map(([id, l]) => {
      const n = id === 'bag' ? bagCount() : 0;
      const b = h('button', { type: 'button', class: 'seg-btn' + (tab === id ? ' on' : '') }, l, n ? h('span', { class: 'seg-badge' }, n) : null);
      b.addEventListener('click', () => { tab = id; last = null; Sound.tap(); redraw(); body.scrollTop = 0; });
      return b;
    })));
    if (tab === 'brew') drawBrew(body, redraw);
    else if (tab === 'bag') drawBag(body, redraw);
    else if (tab === 'book') drawBook(body, redraw);
    else drawShop(body, redraw);
  }

  const propIco = (id, cls) => pic(PROP[id].img, 'prop-ico' + (cls ? ' ' + cls : ''));

  function drawBrew(body, redraw) {
    const s = S();
    // результат прошлой варки
    if (last) {
      if (last.fail) {
        const n = last.near;
        body.append(h('div', { class: 'brew-result fail' }, pic('potions/sludge', 'res-pic'),
          h('div', null, h('b', null, 'Получилась бурда'),
            h('p', null, n && n.overlap >= 2
              ? 'Бульк: «Почти! Два ингредиента подходят к рецепту „' + n.r.p.name + '“' + (known(n.r.id) ? ', который ты уже знаешь' : '') + '»'
                + (last.hinted ? '. В книге открыт ингредиент: ' + ING[last.hinted].name + '.' : '')
              : n && n.overlap === 1 ? 'Бульк: «Хм. Один ингредиент где-то пригодится, а вместе - бурда»'
                : 'Бульк: «Фу-у. Такого рецепта нет»'),
            h('small', null, 'Утешительный приз: +' + UI.ess(last.essence) + ' эссенции'))));
      } else {
        body.append(h('div', { class: 'brew-result ok' + (last.quality ? ' gold' : '') }, pic(last.potion.img, 'res-pic'),
          h('div', null, h('b', null, last.potion.name + (last.quality ? ' · отличное' : '')),
            h('p', null, last.potion.desc + durText(last.potion, last.quality)),
            last.first ? h('small', { class: 'new' }, 'Новый рецепт! +' + B.firstCrystals + ' ' + UI.crystalsWord(B.firstCrystals)) : h('small', null, 'Зелье в сумке'))));
      }
    }
    // три ячейки котла
    const match = slots.length === 3 ? BYKEY[key(slots)] : null;
    const willGet = match && known(match.id) ? match.p : null;
    const slotRow = h('div', { class: 'brew-slots' }, [0, 1, 2].map((i) => {
      const id = slots[i];
      const b = h('button', { type: 'button', class: 'brew-slot' + (id ? ' full' : '') },
        id ? pic(ING[id].img) : pic('ui/flask', 'empty'), id ? propIco(ING[id].p, 'corner') : null);
      b.addEventListener('click', () => { if (!id) return; slots.splice(i, 1); Sound.tap(); redraw(); });
      return b;
    }));
    const bench = h('div', { class: 'brew-bench' });
    body.append(bench);
    const row = h('div', { class: 'brew-row' }, slotRow);
    bench.append(row);
    bench.append(h('p', { class: 'small center brew-preview' },
      slots.length < 3 ? 'Выбери ещё ' + (3 - slots.length) + ' ' + Fmt.plural(3 - slots.length, ['ингредиент', 'ингредиента', 'ингредиентов']) + ' или возьми рецепт из книги'
        : willGet ? 'Получится: ' + willGet.name : 'Такого рецепта ты ещё не знаешь. Рискнём?'));
    const go = h('button', { class: 'btn brew-go', type: 'button', disabled: slots.length < 3 }, pic('ui/mortar', 'btn-ico'), 'Сварить');
    go.addEventListener('click', () => {
      const r = brew(slots);
      if (r.error) { Sound.deny(); UI.toast(r.error); return; }
      slots = [];
      last = r;
      setTimeout(() => { body.scrollTo({ top: 0, behavior: 'smooth' }); }, 0);
      if (r.fail) { Sound.deny(); Cauldron.setMood('wow', 1500); }
      else { Sound.brew(); Cauldron.setMood('excited', 1800); }
      if (window.Game) Game.save();
      redraw();
      UI.refresh();
      refreshButton();
    });
    row.append(go);

    // ингредиенты
    const have = D.ingr.filter((x) => count(x.id) > 0);
    if (!have.length) {
      body.append(h('p', { class: 'note center' }, 'Ингредиентов пока нет. Их находят при помешивании, в пузырях, за заказы и задания, а ещё продаёт торговка.'));
      return;
    }
    D.props.forEach((pr) => {
      const list = have.filter((x) => x.p === pr.id);
      if (!list.length) return;
      body.append(h('div', { class: 'ing-group' }, propIco(pr.id), h('span', null, pr.name)));
      body.append(h('div', { class: 'ing-grid' }, list.map((x) => {
        const left = count(x.id) - slots.filter((id) => id === x.id).length;
        const b = h('button', { type: 'button', class: 'ing' + (x.rare ? ' rare' : '') + (left <= 0 ? ' used' : '') },
          pic(x.img), h('span', { class: 'ing-n' }, left), h('span', { class: 'ing-name' }, x.name));
        b.addEventListener('click', () => {
          if (left <= 0 || slots.length >= 3) { Sound.deny(); return; }
          slots.push(x.id); Sound.blub(); redraw();
        });
        return b;
      })));
    });
    body.append(h('p', { class: 'note left' }, 'Редкие ингредиенты (в золотой рамке) делают зелье отличным: оно действует в 1,5 раза дольше.'));
  }

  function durText(p, q) {
    if (p.sec > 0) return ' на ' + Fmt.time(p.sec * (q ? B.rareMul : 1));
    if (p.sec < 0) return '';
    return q ? ' (×1,5)' : '';
  }

  function drawBag(body, redraw) {
    const s = S();
    const act = activeList();
    if (act.length) {
      body.append(h('h3', { class: 'section-title' }, 'Действуют сейчас'));
      act.forEach((a) => body.append(h('div', { class: 'row-card act' },
        h('div', { class: 'ico' }, pic(a.p.img)),
        h('div', { class: 'info' }, h('div', { class: 'name' }, a.p.name), h('div', { class: 'desc' }, a.p.desc)),
        h('span', { class: 'quest-state' }, a.left < 0 ? 'ждёт' : Fmt.clock(a.left)))));
    }
    const keys = Object.keys(s.bag).filter((k) => s.bag[k] > 0);
    if (!keys.length && !act.length) { body.append(h('div', { class: 'empty' }, pic('ui/potion_bag', 'empty-pic'), h('b', null, 'Сумка пуста'), h('small', null, 'Свари зелье во вкладке «Варить»'))); return; }
    body.append(h('h3', { class: 'section-title' }, 'В сумке'));
    if (!keys.length) { body.append(h('p', { class: 'note center' }, 'Сумка пуста. Свари зелье во вкладке «Варить».')); return; }
    keys.sort().forEach((k) => {
      const id = k.replace('+', ''), p = POT[id], q = k.endsWith('+');
      const btn = h('button', { class: 'pill-btn', type: 'button' }, 'Выпить');
      btn.addEventListener('click', () => {
        const r = drink(k);
        if (r.error) { Sound.deny(); UI.toast(r.error); return; }
        Sound.coin();
        Cauldron.setMood('excited', 1500);
        UI.toast(r.essence ? p.name + ': +' + UI.ess(r.essence) + ' эссенции' : p.name + ': ' + p.desc.toLowerCase() + durText(p, q));
        if (window.Game) Game.save();
        redraw(); UI.refresh(); refreshButton();
      });
      body.append(h('div', { class: 'row-card' + (q ? ' gold' : '') },
        h('div', { class: 'ico' }, pic(p.img), q ? pic('ui/quality', 'q-badge') : null),
        h('div', { class: 'info' }, h('div', { class: 'name' }, p.name + ' ×' + s.bag[k]),
          h('div', { class: 'desc' }, p.desc + durText(p, q)),
          q ? h('div', { class: 'meta' }, 'Отличное качество') : null),
        btn));
    });
    body.append(h('p', { class: 'note left' }, 'Одновременно действуют ' + B.maxActive + ' разных зелья. Если выпить такое же, его время продлится.'));
  }

  // положить ингредиенты известного рецепта в котёл (из книги)
  function useRecipe(r) {
    const miss = r.ing.filter((id) => count(id) < 1);
    if (miss.length) { Sound.deny(); UI.toast('Не хватает: ' + miss.map((id) => ING[id].name).join(', ')); return false; }
    slots = r.ing.slice();
    tab = 'brew';
    last = null;
    Sound.blub();
    return true;
  }

  function drawBook(body, redraw) {
    const s = S();
    body.append(h('p', { class: 'small center' }, 'Открыто рецептов: ' + s.book.length + ' из ' + D.recipeList.length +
      '. Подсказки дают бурда «почти», свитки рецепта дня, истории жителей.'));
    D.brews.forEach((p) => {
      const list = D.recipeList.filter((r) => r.p.id === p.id);
      const n = list.filter((r) => known(r.id)).length;
      const card = h('div', { class: 'book-pot' + (n ? '' : ' locked') },
        h('div', { class: 'book-top' },
          h('div', { class: 'ico' }, pic(n ? p.img : 'ui/recipe_unknown')),
          h('div', { class: 'info' }, h('div', { class: 'name' }, n ? p.name : '???'),
            h('div', { class: 'desc' }, n ? p.desc + durText(p, false) : 'Неизвестное зелье'),
            h('div', { class: 'meta' }, 'Рецептов: ' + n + ' из ' + list.length))));
      list.forEach((r) => {
        const isKnown = known(r.id), hs = hintsOf(r.id);
        const cells = h('div', { class: 'recipe-cells' }, r.ing.map((id) => (isKnown || hs.includes(id))
          ? h('span', { class: 'rc ing-cell' + (ING[id].rare ? ' rare' : ''), title: ING[id].name }, pic(ING[id].img), h('i', null, count(id)))
          : h('span', { class: 'rc q' }, '?')));
        let btn;
        if (isKnown) {
          btn = h('button', { class: 'pill-btn small', type: 'button' }, 'Варить');
          btn.addEventListener('click', () => { if (useRecipe(r)) { redraw(); body.scrollTop = 0; } });
        } else if (canHint(r.id)) {
          btn = h('button', { class: 'pill-btn small', type: 'button' }, UI.money(B.hintPrice, 'ui/crystal'));
          btn.addEventListener('click', () => {
            if (s.cr < B.hintPrice) { Sound.deny(); UI.toast('Не хватает кристаллов: нужно ' + B.hintPrice); return; }
            if (buyHint(r.id)) { Sound.coin(); if (window.Game) Game.save(); redraw(); UI.refresh(); }
          });
        } else btn = h('span', { class: 'quest-state' }, 'угадай');
        card.append(h('div', { class: 'book-row' + (isKnown ? ' known' : '') }, cells, btn));
      });
      body.append(card);
    });
    body.append(h('p', { class: 'note left' }, 'Подсказка открывает один ингредиент рецепта. Последний ингредиент нужно угадать самому.'));
  }

  let happyT = 0;
  function drawShop(body, redraw) {
    const s = S();
    const face = pic(Date.now() < happyT ? 'chars/marfa_happy' : 'chars/marfa_wait', 'merchant-pic');
    body.append(h('div', { class: 'merchant' }, h('div', { class: 'merchant-ico' }, face),
      h('div', null, h('b', null, 'Торговка Марфа'),
        h('p', null, '«Свежие травы и всякая всячина! Товар меняю каждый день. Редкое не продаю - его только найти можно.»'))));
    shopToday().forEach((sl) => {
      const x = sl.x;
      const btn = h('button', { class: 'pill-btn', type: 'button', disabled: sl.left <= 0 }, sl.left > 0 ? UI.money(B.shopPrice, 'ui/crystal') : 'Нет');
      btn.addEventListener('click', () => {
        if (s.cr < B.shopPrice) { Sound.deny(); UI.toast('Не хватает кристаллов'); return; }
        if (buy(sl.i)) { Sound.buy(); happyT = Date.now() + 1500; if (window.Game) Game.save(); redraw(); UI.refresh(); setTimeout(() => { if (tab === 'shop' && UI.isModalOpen()) redraw(); }, 1600); }
      });
      body.append(h('div', { class: 'row-card' },
        h('div', { class: 'ico' }, pic(x.img)),
        h('div', { class: 'info' }, h('div', { class: 'name' }, x.name), h('div', { class: 'ing-prop' }, propIco(x.p), PROP[x.p].name),
          h('div', { class: 'meta trade-meta' }, h('span', null, 'В продаже: ' + sl.left), h('span', null, 'У тебя: ' + count(x.id)))),
        btn));
    });
    const t = h('p', { class: 'note' }, 'Новый товар через ' + Fmt.time(Econ.secToMidnight()));
    body.append(t);
  }

  // фишки действующих зелий на экране котла
  // коротко для плашки на главном экране; полное описание - в окне эффектов
  const SHORT = { power: 'Тап ×2', gold: 'Доход ×1,5', guest: 'Гости ×2', time: 'Копится +4 ч', bubbles: 'Пузыри ×3',
    luck: 'Крит +10%', wisdom: 'Опыт ×2', dragon: 'Тап ×5', sleep: 'Сон ×2' };
  function chips() {
    return activeList().map((a) => ({ img: a.p.img, label: SHORT[a.p.id] || a.p.desc, name: a.p.name, desc: a.p.desc, left: a.left, key: a.p.id }));
  }

  return { init, give, open, brew, drink, reward, onTap, onBubble, onReturn, refreshButton, chips, activeList, isActive, bagCount, count, nearest,
    dailyPick, dailySolved, ing: (id) => ING[id], recipe: (rid) => REC[rid] };
})();

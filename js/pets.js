// =====================================================================
//  Версия 0.6: питомцы, яйца, история аистихи Марго и экспедиции
//  Данные - в начале файла, их удобно править.
// =====================================================================

// ---------- Питомцы ----------
// bonus: что даёт питомец в комнате, per - сколько за каждый уровень
// food - любимая еда (×3 опыта), loc - любимая локация экспедиций (добыча ×1,5)
DATA.pets = [
  { id: 'frog', name: 'Лягушонок', bonus: 'bubble', per: 0.06, loc: 'swamp',
    bonusText: (v) => 'Золотые пузыри чаще на ' + Math.round(v * 100) + '%',
    food: ['lily', 'seaweed', 'berries', 'dew'],
    phrases: ['Ква! Тут тепло', 'Можно я в зелье прыгну? Ну чуть-чуть?', 'Пузыри! Я поймаю!', 'Ква-ква, хозяин работает', 'Я слышу, как бурлит котёл', 'Обожаю кувшинки'] },
  { id: 'cat', name: 'Котёнок', bonus: 'drop', per: 0.08, loc: 'meadow',
    bonusText: (v) => 'Ингредиенты при помешивании чаще на ' + Math.round(v * 100) + '%',
    food: ['fishscale', 'honey', 'mint', 'shell'],
    phrases: ['Мур-р. Тёплый котёл', 'Эта ложка шевелится. Подозрительно', 'Я нашёл травинку!', 'Погладь меня. Ну пожалуйста', 'Мяу! Кто тут шуршит?', 'Посплю чуть-чуть…'] },
  { id: 'owl', name: 'Совёнок', bonus: 'xp', per: 0.04, loc: 'glade',
    bonusText: (v) => 'Опыта больше на ' + Math.round(v * 100) + '%',
    food: ['stardust', 'mushroom', 'firefly', 'acorn'],
    phrases: ['Ух! Я всё записываю', 'Знаешь, сколько звёзд над лавкой? Много', 'Ночью я самый умный', 'Ух-ух. Рецепт почти ясен', 'Книги пахнут пылью и тайной', 'Тише, я думаю'] },
  { id: 'hedgehog', name: 'Ёжик', bonus: 'pantry', per: 0.25, loc: 'forest',
    bonusText: (v) => 'Доход без тебя копится дольше на ' + Fmt.num(v) + ' ч',
    food: ['berries', 'acorn', 'mushroom', 'rosehip'],
    phrases: ['Фыр! Я всё припрятал', 'У меня на спине гриб. Он мой друг', 'Фыр-фыр, запасы в порядке', 'Яблочко бы…', 'В лесу так тихо', 'Не колюсь! Почти'] },
  { id: 'dragon', name: 'Дракончик', bonus: 'tap', per: 0.04, loc: 'mountain',
    bonusText: (v) => 'Сила тапа больше на ' + Math.round(v * 100) + '%',
    food: ['ember', 'chili', 'lava', 'ginger'],
    phrases: ['Пф-ф! Это был не я', 'Я подогрею котёл! Мне не трудно', 'Огонёк на хвосте - это стильно', 'Уголёк - лучшая еда', 'Когда вырасту, буду большим', 'Р-р-р! Страшно? Ну хоть чуть-чуть?'] }
];
// реплики-диалоги: [питомец, Бульк]
DATA.petTalks = {
  frog: [['Бульк, а ты умеешь квакать?', 'Я умею бульк. Это почти то же самое'], ['Твоё зелье пахнет болотом', 'Это комплимент?']],
  cat: [['Бульк, можно я посплю на твоей крышке?', 'У меня нет крышки… но ладно'], ['Ты опять пузыришься', 'Я работаю!']],
  owl: [['Бульк, ты знал, что луна полная?', 'Я знал только, что зелье горячее'], ['Ух! Я придумала рецепт', 'Главное, чтобы не бурда']],
  hedgehog: [['Бульк, я спрятал жёлудь у тебя под ножкой', 'Так вот что мне щекотно!'], ['Фыр. Можно мне ягодку?', 'Вон торговка идёт - спроси у неё']],
  dragon: [['Бульк, давай я подую на руны - пусть ярче светятся!', 'Только аккуратно, ладно?'], ['Я буду охранять лавку', 'С тобой мне ничего не страшно']]
};
DATA.petFrames = { sit: 0, blink: 1, look: 2, happy: 3, walk: [4, 5, 6, 7], crouch: 8, takeoff: 9, air: 10, land: 11, sleep: [12, 13], talk: 14, eat: 15 };

// ---------- Яйца ----------
// need - сколько тепла нужно (1 тепло = 1 секунда у котла)
DATA.eggs = {
  frog:     { name: 'Болотное яйцо',    img: 'eggs/frog',     pet: 'frog',     need: 5400 },
  cat:      { name: 'Пушистое яйцо',    img: 'eggs/cat',      pet: 'cat',      need: 5400 },
  owl:      { name: 'Пёстрое яйцо',     img: 'eggs/owl',      pet: 'owl',      need: 7200 },
  hedgehog: { name: 'Колючее яйцо',     img: 'eggs/hedgehog', pet: 'hedgehog', need: 7200 },
  dragon:   { name: 'Огненное яйцо',    img: 'eggs/dragon',   pet: 'dragon',   need: 10800 },
  mystery:  { name: 'Таинственное яйцо', img: 'eggs/mystery', pet: null,       need: 9000 },
  gold:     { name: 'Золотое яйцо',     img: 'eggs/gold',     pet: null,       need: 14400 }
};
// сколько тепла дают огненные ингредиенты
DATA.eggHeat = { spark: 900, ember: 900, lava: 900, chili: 600, ginger: 600, fireflower: 600, firebird: 3600, dragon_scale: 3600 };

// ---------- Экспедиции ----------
DATA.locations = [
  { id: 'meadow',   name: 'Луг',            img: 'locations/meadow',   rank: 1, props: ['herb', 'water'], egg: 'cat',
    desc: 'Цветы, роса и мягкая трава' },
  { id: 'forest',   name: 'Лес',            img: 'locations/forest',   rank: 1, props: ['herb', 'star'], egg: 'hedgehog',
    desc: 'Жёлуди, грибы и корни мандрагоры' },
  { id: 'swamp',    name: 'Болото',         img: 'locations/swamp',    rank: 2, props: ['water'], egg: 'frog',
    desc: 'Кувшинки, водоросли и туман' },
  { id: 'glade',    name: 'Ночная поляна',  img: 'locations/glade',    rank: 3, props: ['star'], egg: 'owl',
    desc: 'Светлячки и звёздная пыль' },
  { id: 'mine',     name: 'Шахта',          img: 'locations/mine',     rank: 3, props: ['stone'], egg: null,
    desc: 'Руда, соль и кристаллы' },
  { id: 'mountain', name: 'Склон вулкана',  img: 'locations/mountain', rank: 4, props: ['fire'], egg: 'dragon',
    desc: 'Угольки, лава и огнецветы' }
];
// длительность (мин), сколько ингредиентов, шанс редкого, шанс найти яйцо Марго
DATA.tripLengths = [
  { min: 30,  n: 2,  rare: 0.03, egg: 0.15 },
  { min: 120, n: 5,  rare: 0.07, egg: 0.35 },
  { min: 240, n: 8,  rare: 0.12, egg: 0.55 },
  { min: 480, n: 14, rare: 0.2,  egg: 0.8, chest: true }
];
// места для питомцев в комнате открываются рангом лавки
CONFIG.petSlots = [1, 4, 7];
CONFIG.petMaxLevel = 10;
CONFIG.xp.feed = 3;
CONFIG.xp.hatch = 120;
CONFIG.xp.trip = 20;

// ---------- История Марго ----------
DATA.margo = {
  name: 'Аистиха Марго',
  char: 'margo', img: 'chars/margo_wait', imgHappy: 'chars/margo_happy',
  intro: 'Ох, здравствуй, милый! Я Марго, разношу по округе волшебные яйца. Этой ночью буря вырвала у меня корзину - яйца раскатились кто куда: в лес, на ночную поляну, к вулкану и на луг с болотом. Без тепла малыши не вылупятся, а теплее твоего котла в деревне ничего нет. Отправь своего питомца на поиски, а найденные яйца грей у тёплого котла. Я буду заглядывать!',
  found: [
    'Нашлось! Это яйцо я везла с самого края света. Грей его у огня - и помешивай почаще, малыши любят, когда бурлит.',
    'Второе! Ты знаешь, в каждом яйце спит своя история. Эту я расскажу, когда малыш проснётся.',
    'Третье! Буря унесла его так далеко, я уж думала, не найдётся. Спасибо тебе, дорогой.',
    'Последнее! Все мои малыши дома. Ох, я сейчас расплачусь. Подожди, у меня для тебя кое-что есть…'
  ],
  final: 'Это золотое яйцо я берегла для самого доброго алхимика. Из него не вылупится новый малыш - оно сделает одного из твоих питомцев золотым. Он засияет, и его помощь станет в полтора раза сильнее.'
};

// ---------- Вещи для комнаты (гардероб, вкладка «Комната») ----------
DATA.wardrobe.push(
  { id: 'bed_cushion', slot: 'bed', name: 'Мягкая лежанка',     how: { free: true },          img: 'pets/bed_cushion' },
  { id: 'bed_basket',  slot: 'bed', name: 'Лежанка-корзинка',   how: { visitor: 'tikhon' },   img: 'pets/bed_basket' },
  { id: 'bed_house',   slot: 'bed', name: 'Домик для питомца',  how: { visitor: 'efim' },     img: 'pets/bed_house' },
  { id: 'yarn',        slot: 'toy', name: 'Клубок',             how: { visitor: 'varya' },    img: 'pets/yarn' }
);
// таинственное яйцо - подарок лучших друзей, у которых нет вещи-подарка
DATA.visitorEggs = ['savva', 'miron'];

// ---------- Шапки убраны: на котле они смотрелись чужеродно ----------
for (let i = DATA.wardrobe.length - 1; i >= 0; i--) if (DATA.wardrobe[i].slot === 'head') DATA.wardrobe.splice(i, 1);
// ложки теперь дарят жители
(() => {
  const set = (id, how) => { const w = DATA.wardrobe.find((x) => x.id === id); if (w) w.how = how; };
  set('silver', { visitor: 'grisha' });
  set('gold_ladle', { visitor: 'lusha' });
  set('bone', { visitor: 'tishka' });
  const hw = DATA.eventDefs && DATA.eventDefs.halloween;
  if (hw) {
    hw.shop = hw.shop.filter((it) => it.kind !== 'acc' || (DATA.wardrobe.some((w) => w.id === it.id) && it.id !== 'bone'));
    hw.milestones.forEach((m) => { if (m.acc && !DATA.wardrobe.some((w) => w.id === m.acc)) { delete m.acc; m.cr = 30; } });
  }
  const t = DATA.titles.find((x) => x.id === 'pumpkin_king');
  if (t) { t.name = 'Друг привидения'; t.test = (s) => s.own.acc.includes('bone'); }
})();

const Pets = (() => {
  const C = CONFIG, D = DATA, F = DATA.petFrames;
  const S = () => Econ.s;
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const PET = {}; D.pets.forEach((p) => { PET[p.id] = p; });
  const LOC = {}; D.locations.forEach((l) => { LOC[l.id] = l; });
  const rand = (a, b) => a + Math.random() * (b - a);
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;

  // ---------- состояние ----------
  function st() {
    const s = S();
    if (!s.pets || typeof s.pets !== 'object') s.pets = {};
    const p = s.pets;
    p.own = p.own && typeof p.own === 'object' ? p.own : {};       // id → { lv, xp, gold }
    p.room = Array.isArray(p.room) ? p.room : [];                    // кто в комнате
    p.trip = p.trip && typeof p.trip === 'object' ? p.trip : {};     // id → { loc, len, end }
    p.eggs = Array.isArray(p.eggs) ? p.eggs : [];                    // яйца в запасе (типы)
    p.nest = p.nest && p.nest.t ? p.nest : null;                     // { t, heat, last }
    p.margo = p.margo && typeof p.margo === 'object' ? p.margo : { st: 0, need: [], found: [], hatched: [], at: 0 };
    p.pity = p.pity && typeof p.pity === 'object' ? p.pity : {};
    return p;
  }
  const owned = () => Object.keys(st().own).filter((id) => PET[id]);
  const slots = () => C.petSlots.filter((r) => Econ.rank() >= r).length;
  const inRoom = () => st().room.filter((id) => st().own[id] && !st().trip[id]).slice(0, slots());
  const level = (id) => (st().own[id] ? st().own[id].lv : 0);
  const feedNeed = (lv) => 4 + lv * 3;

  // бонус питомцев в комнате: вид бонуса → сумма
  function bonus(kind) {
    let v = 0;
    inRoom().forEach((id) => {
      const p = PET[id], o = st().own[id];
      if (p.bonus === kind) v += p.per * o.lv * (o.gold ? 1.5 : 1);
    });
    return v;
  }

  function addPet(id, gold) {
    const p = st();
    if (!p.own[id]) p.own[id] = { lv: 1, xp: 0, gold: !!gold };
    if (p.room.length < slots() && !p.room.includes(id)) p.room.push(id);
    spawnActor(id);
  }

  // ---------- кормление ----------
  function feed(id, ing) {
    const o = st().own[id];
    if (!o || o.lv >= C.petMaxLevel) return null;
    if (Brew.count(ing) < 1) return null;
    Econ.s.ing[ing]--;
    const x = Brew.ing(ing);
    const pts = PET[id].food.includes(ing) ? 3 : x.rare ? 5 : 1;
    o.xp += pts;
    let up = false;
    while (o.lv < C.petMaxLevel && o.xp >= feedNeed(o.lv)) { o.xp -= feedNeed(o.lv); o.lv++; up = true; }
    if (o.lv >= C.petMaxLevel) o.xp = 0;
    Econ.addXp(C.xp.feed);
    if (typeof Story !== 'undefined') Story.event('feed');
    const a = actors.find((q) => q.id === id);
    if (a) setState(a, 'eat', 2.2);
    return { pts, up, lv: o.lv, fav: PET[id].food.includes(ing) };
  }

  // ---------- яйца и гнездо ----------
  function giveEgg(t) {
    const p = st();
    p.eggs.push(t);
    if (!p.nest) nextEgg();
  }
  function nextEgg() {
    const p = st();
    if (p.nest || !p.eggs.length) return;
    p.nest = { t: p.eggs.shift(), heat: 0, last: Date.now() };
  }
  // тепло идёт само по времени (и пока игры нет - тоже)
  function warmByTime() {
    const n = st().nest;
    if (!n) return;
    const now = Date.now();
    n.heat += Math.max(0, (now - (n.last || now)) / 1000);
    n.last = now;
  }
  const eggNeed = () => (st().nest ? D.eggs[st().nest.t].need : 1);
  const eggReady = () => !!st().nest && st().nest.heat >= eggNeed();
  function warmTap() { const n = st().nest; if (n && !eggReady()) n.heat += 6; }
  function warmWith(ing) {
    const n = st().nest;
    if (!n || eggReady() || !(D.eggHeat[ing] > 0) || Brew.count(ing) < 1) return 0;
    Econ.s.ing[ing]--;
    n.heat += D.eggHeat[ing];
    Cauldron.warm(0.8);
    return D.eggHeat[ing];
  }
  // вылупление. Возвращает { pet, gold, golden, dupe, margo }
  function hatch(choiceForGold) {
    const p = st();
    if (!eggReady()) return null;
    const t = p.nest.t;
    const res = { t };
    if (t === 'gold') {
      if (!choiceForGold || !p.own[choiceForGold]) return null;
      p.own[choiceForGold].gold = true;
      res.golden = choiceForGold;
    } else {
      let id = D.eggs[t].pet;
      if (!id) {
        const notYet = D.pets.filter((x) => !p.own[x.id]);
        id = notYet.length ? pickOne(notYet).id : null;
      }
      if (!id || p.own[id]) {
        // все уже есть - малыш превращается в гостинцы
        Brew.reward('quest');
        Econ.addCrystals(5);
        res.dupe = true;
      } else {
        addPet(id);
        res.pet = id;
      }
      // яйцо из корзины Марго
      const m = p.margo;
      if (m.st === 1 && m.need.includes(t) && !m.hatched.includes(t)) {
        m.hatched.push(t);
        if (m.hatched.length >= m.need.length) { m.st = 2; res.margoDone = true; giveEgg('gold'); }
      }
    }
    p.nest = null;
    Econ.addXp(C.xp.hatch);
    nextEgg();
    return res;
  }

  // ---------- экспедиции ----------
  const locOpen = (l) => Econ.rank() >= l.rank;
  function sendTrip(id, locId, lenIdx) {
    const p = st(), L = LOC[locId], T = D.tripLengths[lenIdx];
    if (!p.own[id] || p.trip[id] || !L || !T || !locOpen(L)) return false;
    p.trip[id] = { loc: locId, len: lenIdx, end: Date.now() + T.min * 60000, start: Date.now() };
    p.room = p.room.filter((x) => x !== id);
    const a = actors.find((q) => q.id === id);
    if (a) a.leaving = true;
    return true;
  }
  const tripLeft = (id) => { const t = st().trip[id]; return t ? Math.max(0, (t.end - Date.now()) / 1000) : 0; };
  const tripDone = (id) => !!st().trip[id] && tripLeft(id) <= 0;
  const readyTrips = () => Object.keys(st().trip).filter(tripDone);
  function speedUp(id, how) {
    const t = st().trip[id];
    if (!t) return false;
    const left = tripLeft(id);
    if (how === 'ad') { t.end = Date.now() + left * 500; return true; }
    const cost = finishCost(id);
    if (S().cr < cost) return false;
    S().cr -= cost;
    t.end = Date.now();
    return true;
  }
  const finishCost = (id) => Math.max(1, Math.ceil(tripLeft(id) / 60 / 20));
  // вернуть питомца и получить добычу
  function collect(id) {
    const p = st(), t = p.trip[id];
    if (!t || !tripDone(id)) return null;
    const L = LOC[t.loc], T = D.tripLengths[t.len], pet = PET[id], o = p.own[id];
    const mult = (1 + 0.05 * o.lv) * (pet.loc === L.id ? 1.5 : 1) * (o.gold ? 1.2 : 1);
    const n = Math.max(1, Math.round(T.n * mult));
    const pool = D.ingr.filter((x) => L.props.includes(x.p));
    const commons = pool.filter((x) => !x.rare), rares = pool.filter((x) => x.rare);
    const got = {};
    for (let i = 0; i < n; i++) {
      const x = rares.length && Math.random() < T.rare * (pet.loc === L.id ? 1.5 : 1) ? pickOne(rares) : pickOne(commons);
      got[x.id] = (got[x.id] || 0) + 1;
      S().ing[x.id] = (S().ing[x.id] || 0) + 1;
    }
    const res = { pet: id, loc: L, got, n };
    // сундук в долгом походе
    if (T.chest) {
      const cr = 2 + Math.floor(Math.random() * 3);
      Econ.addCrystals(cr);
      res.crystals = cr;
      if (Math.random() < 0.4) { Brew.reward('scroll'); res.scroll = true; }
      if (Math.random() < 0.06) { giveEgg('mystery'); res.egg = 'mystery'; }
    }
    // яйцо из корзины Марго
    const m = p.margo;
    if (m.st === 1 && L.egg && m.need.includes(L.egg) && !m.found.includes(L.egg)) {
      const tries = p.pity[L.id] || 0;
      if (Math.random() < T.egg || tries >= 2) {
        m.found.push(L.egg);
        giveEgg(L.egg);
        res.egg = L.egg;
        res.margoLine = D.margo.found[Math.min(m.found.length - 1, D.margo.found.length - 1)];
        p.pity[L.id] = 0;
      } else p.pity[L.id] = tries + 1;
    }
    delete p.trip[id];
    if (typeof Story !== 'undefined') Story.event('trip', L.id);
    if (p.room.length < slots()) { p.room.push(id); spawnActor(id); }
    Econ.addXp(C.xp.trip + t.len * 10);
    return res;
  }

  // ---------- первый питомец и Марго ----------
  function checkStory() {
    const p = st();
    if (!p.first && Econ.rank() >= C.petSlots[0] && !UI.isModalOpen()) { p.first = true; firstPetModal(); return; }
    if (p.first && p.margo.st === 0 && owned().length && Date.now() - (p.firstAt || 0) > 120000 && !UI.isModalOpen() && UI.screen() === 'main') {
      p.margo.st = 1;
      const start = owned()[0];
      const other = start === 'frog' ? 'cat' : start === 'cat' ? 'frog' : 'cat';
      p.margo.need = ['hedgehog', 'owl', 'dragon', other].filter((x) => !p.own[x]);
      margoModal(D.margo.intro, false);
      if (window.Game) Game.save();
    }
  }

  // =====================================================================
  //  Питомцы в комнате: движение, прыжки, сон, разговоры
  // =====================================================================
  let actors = [];
  let G = null;            // геометрия сцены из котла
  let lastInput = performance.now();
  let talkIn = rand(8, 16);

  function spawnActor(id) {
    if (!G || actors.some((a) => a.id === id && !a.leaving)) return;
    lastInput = performance.now();
    const side = actors.length % 2 ? 1 : -1;
    actors.push({ id, x: G.cx + side * G.r * rand(1.1, 1.6), y: 0, depth: rand(0.2, 0.8), vx: 0, face: -side,
      st: 'idle', t: 0, dur: rand(1.5, 3), frame: F.sit, blinkIn: rand(1, 4), jump: null, perch: 0, say: null, sayT: 0,
      squash: 0, wake: 0, enter: 1 });
  }
  function syncActors() {
    const room = inRoom();
    actors = actors.filter((a) => (room.includes(a.id) && !a.leaving) || (a.leaving && a.x > -80 && a.x < (G ? G.W + 80 : 999)));
    room.forEach((id) => { if (!actors.some((a) => a.id === id && !a.leaving)) spawnActor(id); });
  }
  function setState(a, s, dur) { a.st = s; a.t = 0; a.dur = dur || rand(1.5, 3.5); }

  function floorY(a) { return G.ground + a.depth * G.r * 0.32; }
  function petH() { return G.r * 0.72; }
  // Углубление лежанки (доли картинки: центр x, y, полуоси) или дверь домика (x, верх, низ, полуширина)
  const BEDS = {
    bed_cushion: { hole: [0.5, 0.44, 0.31, 0.19] },
    bed_basket:  { hole: [0.5, 0.38, 0.40, 0.24] },
    bed_house:   { door: [0.47, 0.38, 0.82, 0.155] }
  };
  function bedPos() {
    const id = S().wear.bed, item = id && D.wardrobe.find((x) => x.id === id);
    const im = item ? Sprites.get(item.img) : null;
    const w = G.r * (id === 'bed_house' ? 1.0 : 1.05);
    const hh = im ? w * im.naturalHeight / im.naturalWidth : w * 0.7;
    const x = clamp(G.cx - G.r * 1.6, w * 0.55, G.W - w * 0.55), y = G.ground + G.r * 0.2;
    return { x, y, w, h: hh, left: x - w / 2, top: y - hh, im, spec: BEDS[id] || BEDS.bed_cushion, house: id === 'bed_house' };
  }
  // куда ложится питомец в лежанке
  function bedSpot() {
    const b = bedPos();
    // у домика питомец спит на пороге, перед дверью - целиком виден
    if (b.house) { const d = b.spec.door; return { x: b.left + b.w * d[0], y: b.top + b.h * Math.min(1, d[2] + 0.1), scale: 0.72, maxW: b.w * 0.62 }; }
    // в лежанке питомец лежит сверху, в углублении: бортик его не закрывает
    const hl = b.spec.hole; return { x: b.left + b.w * hl[0], y: b.top + b.h * (hl[1] + hl[3] * 0.45), scale: 0.95, maxW: b.w * hl[2] * 2 * 1.05 };
  }
  const bedTaken = (a) => actors.some((q) => q !== a && (q.inBed || q.then === 'tobed' || (q.jump && q.jump.perch === 'bed')));
  function nestPos() { const w = G.r * 0.72; return { x: clamp(G.cx + G.r * 1.6, w * 0.55, G.W - w * 0.55), y: G.ground + G.r * 0.14, w }; }
  // в котле питомец «купается»: поверхность зелья - линия воды, ниже неё тело скрыто
  const waterY = () => G.liq.cy + G.liq.ry * 0.12;
  function rimPos(side) { return { x: G.liq.cx + side * G.liq.rx * 0.42, y: waterY() + petH() * 0.3 }; }

  // выбрать, чем заняться
  function decide(a) {
    const idle = (performance.now() - lastInput) / 1000;
    const bedOk = !!S().wear.bed;
    if (idle > 30 && a.st !== 'sleep') {
      if (bedOk && !a.perch && !bedTaken(a)) { const b = bedPos(); return goTo(a, clamp(b.x + b.w * 0.55, 0, G.W), 0.55, 'tobed'); }
      if (a.perch) return jumpDown(a);
      return setState(a, 'sleep', 999);
    }
    const r = Math.random();
    if (a.perch) {
      if (r < 0.45) return jumpDown(a);
      return setState(a, 'idle', rand(2, 4));
    }
    if (r < 0.42) {
      // место подальше от других питомцев
      let tx = 0;
      for (let k = 0; k < 6; k++) {
        tx = clamp(G.cx + rand(-1, 1) * G.r * 1.9, G.W * 0.08, G.W * 0.92);
        if (!actors.some((q) => q !== a && Math.abs((q.tx !== undefined && q.st === 'walk' ? q.tx : q.x) - tx) < G.r * 0.55)) break;
      }
      return goTo(a, tx, rand(0.1, 1));
    }
    if (r < 0.58 && !actors.some((q) => q !== a && q.perch)) return jumpUp(a);
    if (r < 0.66 && S().wear.toy === 'yarn') return setState(a, 'play', rand(2, 3));
    if (r < 0.75) return setState(a, 'look', rand(1.2, 2.2));
    setState(a, 'idle', rand(2, 4));
  }
  function goTo(a, tx, depth, then) {
    a.tx = tx; a.tdepth = depth; a.then = then || null;
    setState(a, 'walk', 99);
  }
  function jumpUp(a) {
    const side = a.x < G.cx ? -1 : 1;
    const p = rimPos(side);
    // сначала подходим к котлу
    const sx = G.cx + side * G.r * 1.15;
    if (Math.abs(a.x - sx) > 6) return goTo(a, sx, 0.15, 'jumpup:' + side);
    startJump(a, p.x, p.y, side);
  }
  function jumpDown(a) {
    const side = a.perch;
    const tx = clamp(G.cx + side * G.r * rand(1.2, 1.7), G.W * 0.08, G.W * 0.92);
    a.depth = rand(0.1, 0.6);
    startJump(a, tx, floorY(a), 0);
  }
  function startJump(a, tx, ty, perch) {
    a.jump = { x0: a.x, y0: a.y, x1: tx, y1: ty, t: 0, dur: 0.75, perch };
    a.perch = 0;   // в полёте питомец уже не в котле
    a.face = tx >= a.x ? 1 : -1;
    setState(a, 'crouch', 0.18);
  }

  function say(a, text, ms) { a.say = text; a.sayT = (ms || 2600) / 1000; }
  function wakeUp(a) {
    say(a, 'Ой! Я не сплю!', 1600);
    if (a.inBed) {
      a.inBed = false;
      a.depth = rand(0.4, 0.8);
      const b = bedPos();
      startJump(a, clamp(b.x + b.w * 0.75, 0, G.W - 10), floorY(a), 0);
    } else setState(a, 'happy', 0.8);
  }

  function update(dt) {
    if (!G) return;
    syncActors();
    const now = performance.now();
    actors.forEach((a) => {
      a.t += dt;
      if (a.sayT > 0) { a.sayT -= dt; if (a.sayT <= 0) a.say = null; }
      a.squash *= Math.max(0, 1 - dt * 8);
      if (!a.jump && !a.perch && a.st !== 'jump') a.y = floorY(a);
      // котёл мог сдвинуться (экран сменил размер, догрузилась комната) - держимся за край котла
      if (a.perch && !a.jump) { const rp = rimPos(a.perch); a.x = rp.x; a.y = rp.y; }
      if (a.jump && (a.jump.perch === 1 || a.jump.perch === -1)) { const rp = rimPos(a.jump.perch); a.jump.x1 = rp.x; a.jump.y1 = rp.y; }
      else if (a.jump && !a.jump.perch) a.jump.y1 = floorY(a);
      if (a.leaving) { a.x += a.face * G.r * 1.6 * dt; a.frame = F.walk[Math.floor(a.t * 8) % 4]; return; }
      // моргание
      a.blinkIn -= dt;
      switch (a.st) {
        case 'idle':
          a.frame = a.blinkIn < 0 ? F.blink : F.sit;
          if (a.blinkIn < -0.15) a.blinkIn = rand(2, 5);
          if (a.t > a.dur) decide(a);
          break;
        case 'look':
          a.frame = F.look;
          if (a.t > a.dur) setState(a, 'idle', rand(1, 2));
          break;
        case 'walk': {
          const dx = a.tx - a.x;
          a.face = dx >= 0 ? 1 : -1;
          a.x += a.face * Math.min(Math.abs(dx), G.r * 0.95 * dt);
          a.depth += (a.tdepth - a.depth) * Math.min(1, dt * 2);
          a.frame = F.walk[Math.floor(a.t * 8) % 4];
          if (Math.abs(dx) < 2) {
            const then = a.then; a.then = null;
            if (then && then.startsWith('jumpup:')) { const side = +then.split(':')[1]; const p = rimPos(side); startJump(a, p.x, p.y, side); }
            else if (then === 'tobed') {
              const sp = bedSpot();
              if (bedPos().house) { a.inBed = true; a.x = sp.x; a.y = sp.y; setState(a, 'sleep', 999); }
              else startJump(a, sp.x, sp.y, 'bed');
            }
            else setState(a, 'idle', rand(1.5, 3));
          }
          break;
        }
        case 'crouch':
          a.frame = F.crouch; a.squash = 0.12;
          if (a.t > a.dur) setState(a, 'jump', 99);
          break;
        case 'jump': {
          const j = a.jump;
          j.t += dt / j.dur;
          const k = Math.min(1, j.t);
          a.x = j.x0 + (j.x1 - j.x0) * k;
          const peak = Math.min(j.y0, j.y1) - G.r * 0.55;
          // парабола через вершину
          const mid = (1 - k) * (1 - k) * j.y0 + 2 * (1 - k) * k * (2 * peak - (j.y0 + j.y1) / 2) + k * k * j.y1;
          a.y = mid;
          a.frame = k < 0.35 ? F.takeoff : F.air;
          if (k >= 1) {
            a.jump = null; a.y = j.y1; a.squash = 0.18;
            if (j.perch === 'bed') { a.perch = 0; a.inBed = true; a.face = 1; setState(a, 'sleep', 999); }
            else { a.perch = j.perch; setState(a, 'land', 0.18); }
          }
          break;
        }
        case 'land':
          a.frame = F.land;
          if (a.t > a.dur) setState(a, 'idle', rand(1.5, 3));
          break;
        case 'sleep':
          a.frame = F.sleep[Math.floor(a.t / 1.3) % 2];
          if (a.inBed) { const sp = bedSpot(); a.x = sp.x; a.y = sp.y; }
          if (now - lastInput < 1500) wakeUp(a);
          break;
        case 'happy':
          a.frame = F.happy;
          if (a.t > a.dur) setState(a, 'idle', rand(1, 2));
          break;
        case 'talk':
          a.frame = Math.floor(a.t * 6) % 2 ? F.talk : F.sit;
          if (a.t > a.dur) setState(a, 'idle', rand(1, 2));
          break;
        case 'eat':
          a.frame = F.eat;
          if (a.t > a.dur) { setState(a, 'happy', 0.7); }
          break;
        case 'play':
          a.frame = Math.floor(a.t * 4) % 2 ? F.happy : F.crouch;
          if (a.t > a.dur) setState(a, 'idle', rand(1, 2));
          break;
      }
    });
    // разговоры
    talkIn -= dt;
    if (talkIn <= 0 && actors.length && !UI.isModalOpen()) {
      talkIn = rand(14, 28);
      const a = pickOne(actors.filter((q) => q.st !== 'sleep' && !q.leaving) || []);
      if (a) {
        const pairs = D.petTalks[a.id];
        if (pairs && Math.random() < 0.35 && UI.sinceSay() > 4000) {
          const pr = pickOne(pairs);
          say(a, pr[0], 2600); setState(a, 'talk', 2.2);
          setTimeout(() => { if (UI.sinceSay() > 2000) UI.say(pr[1], 2400); }, 2700);
        } else { say(a, pickOne(PET[a.id].phrases), 2600); setState(a, 'talk', 2); }
      }
    }
  }

  // ---------- отрисовка ----------
  const sprite = (id, f) => Sprites.get('pets/' + id + '/' + (f < 10 ? '0' : '') + f);
  let goldCv = null;
  function drawPet(ctx, a) {
    const im = sprite(a.id, a.frame);
    if (!im) return;
    let hh = petH() * (a.inBed ? bedSpot().scale : 1);
    if (a.inBed) hh = Math.min(hh, bedSpot().maxW * im.naturalHeight / im.naturalWidth);
    const w = hh * im.naturalWidth / im.naturalHeight;
    const o = st().own[a.id];
    // тень
    if (!a.perch && !a.inBed) {
      const gy = a.jump ? Math.max(a.jump.y0, a.jump.y1) : a.y;
      const lift = Math.min(1, Math.max(0, gy - a.y) / (G.r * 0.6));
      ctx.save(); ctx.fillStyle = '#12061F';
      ctx.globalAlpha = 0.25 * (1 - Math.min(0.7, lift));
      ctx.beginPath(); ctx.ellipse(a.x, gy - 2, w * 0.4 * (1 - lift * 0.3), hh * 0.09, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.35 * (1 - Math.min(0.9, lift));
      ctx.beginPath(); ctx.ellipse(a.x, gy - 2, w * 0.26 * (1 - lift * 0.3), hh * 0.05, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    const breathe = a.st === 'sleep' ? 0.02 * Math.sin(G.t * 2.4) : a.st === 'idle' ? 0.012 * Math.sin(G.t * 3 + a.x) : 0;
    const sx = (1 + a.squash + breathe) * (a.face < 0 && a.frame >= 4 && a.frame <= 11 ? -1 : 1);
    const sy = 1 - a.squash + breathe;
    const bob = a.st === 'walk' ? Math.abs(Math.sin(a.t * 12.5)) * hh * 0.03 : a.perch ? Math.sin(G.t * 2.2 + a.x) * hh * 0.02 : 0;
    ctx.save();
    if (a.perch) {
      // двигаемся вместе с котлом, когда он сжимается от тапа
      ctx.translate(G.cx, G.potBottom); ctx.scale(1 + G.squash * 0.35, 1 - G.squash * 0.35); ctx.translate(-G.cx, -G.potBottom);
      const wy = waterY(), rw = w * 0.5;
      // рябь вокруг питомца
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = Math.max(1.5, G.r * 0.02);
      const rip = 1 + 0.08 * Math.sin(G.t * 4 + a.x);
      ctx.beginPath(); ctx.ellipse(a.x, wy, rw * rip, G.liq.ry * 0.3 * rip, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.ellipse(a.x, wy, rw * 1.35 * rip, G.liq.ry * 0.45 * rip, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      // всё, что ниже поверхности, не видно
      ctx.beginPath(); ctx.rect(0, 0, G.W, wy); ctx.clip();
    }
    ctx.translate(a.x, a.y - bob);
    ctx.scale(sx, sy);
    if (o && o.gold) ctx.filter = 'sepia(.9) saturate(2.6) hue-rotate(-12deg) brightness(1.12)';
    ctx.drawImage(im, -w / 2, -hh, w, hh);
    ctx.restore();
    if (o && o.gold && !RenderOpts.lowfx) {
      ctx.save(); ctx.fillStyle = '#FFF3B0';
      for (let i = 0; i < 3; i++) {
        const ph = G.t * 2 + i * 2.1, k = (Math.sin(ph) + 1) / 2;
        ctx.globalAlpha = k * 0.9;
        const px = a.x + Math.cos(i * 2.3 + G.t * 0.7) * w * 0.4, py = a.y - hh * (0.3 + 0.5 * ((i * 0.37 + G.t * 0.1) % 1));
        ctx.beginPath(); ctx.arc(px, py, 1.5 + k * 2, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    // «z-z» во сне
    if (a.st === 'sleep' && !RenderOpts.lowfx) {
      ctx.save(); ctx.font = '900 ' + Math.round(hh * 0.2) + 'px Nunito, system-ui, sans-serif'; ctx.fillStyle = '#C7B6E6';
      for (let i = 0; i < 2; i++) {
        const k = ((G.t * 0.5 + i * 0.5) % 1);
        ctx.globalAlpha = Math.sin(k * Math.PI);
        ctx.fillText('z', a.x + w * 0.25 + k * hh * 0.25, a.y - hh * (0.75 + k * 0.5));
      }
      ctx.restore();
    }
    a.box = { x: a.x - w / 2, y: a.y - hh, w, h: hh };
  }

  function bubble(ctx, a) {
    if (!a.say || !a.box) return;
    const fs = Math.max(12, Math.round(G.r * 0.13));
    ctx.save();
    ctx.font = '800 ' + fs + 'px Nunito, system-ui, sans-serif';
    const words = a.say.split(' '); const lines = []; let cur = '';
    const maxW = Math.min(G.W * 0.55, 200);
    words.forEach((wd) => { const tst = cur ? cur + ' ' + wd : wd; if (ctx.measureText(tst).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = tst; });
    if (cur) lines.push(cur);
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const bw = tw + 18, bh = lines.length * fs * 1.2 + 12;
    const bx = clamp(a.x - bw / 2, 6, G.W - bw - 6), by = Math.max(6, a.box.y - bh - 12);
    ctx.globalAlpha = Math.min(1, a.sayT * 4);
    ctx.fillStyle = '#FFF6E8'; ctx.strokeStyle = '#1A0E2C'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 12) : ctx.rect(bx, by, bw, bh); ctx.fill(); ctx.stroke();
    ctx.beginPath(); const tx = clamp(a.x, bx + 14, bx + bw - 14);
    ctx.moveTo(tx - 7, by + bh - 1); ctx.lineTo(tx, by + bh + 9); ctx.lineTo(tx + 7, by + bh - 1); ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - 7, by + bh); ctx.lineTo(tx, by + bh + 9); ctx.lineTo(tx + 7, by + bh); ctx.stroke();
    ctx.fillStyle = '#1A0E2C'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, by + 6 + i * fs * 1.2));
    ctx.restore();
  }

  function drawBack(ctx, g) {
    G = g;
    // лежанка и гнездо стоят на полу за питомцами
    const b = S().wear.bed && owned().length ? bedPos() : null;
    if (b && b.im) {
      ctx.drawImage(b.im, b.left, b.top, b.w, b.h);
      const sleepers = actors.filter((a) => a.inBed);
      sleepers.forEach((a) => drawPet(ctx, a));
    }
    const n = st().nest;
    if (n) {
      const nim = Sprites.get('pets/nest'), eim = Sprites.get(D.eggs[n.t].img);
      const p = nestPos();
      const k = Math.min(1, n.heat / D.eggs[n.t].need);
      // гнездо: сзади целиком, потом яйцо в углублении, потом передний край поверх яйца
      const nh = nim ? p.w * nim.naturalHeight / nim.naturalWidth : p.w * 0.75;
      const nl = p.x - p.w / 2, nt = p.y - nh * 0.75;
      const hx = p.x, hy = nt + nh * 0.4, hrx = p.w * 0.32, hry = nh * 0.2;   // углубление гнезда
      if (nim) ctx.drawImage(nim, nl, nt, p.w, nh);
      if (eim) {
        const eh = p.w * 0.62, ew = eh * eim.naturalWidth / eim.naturalHeight;
        const wob = k > 0.3 ? Math.sin(g.t * (4 + k * 10)) * 0.06 * k * (Math.sin(g.t * 0.9) > 0.2 ? 1 : 0.2) : 0;
        ctx.save(); ctx.translate(hx, hy + hry * 0.75); ctx.rotate(wob);
        ctx.drawImage(eim, -ew / 2, -eh, ew, eh);
        // трещины
        ctx.strokeStyle = '#1A0E2C'; ctx.lineWidth = Math.max(1.5, eh * 0.03); ctx.lineJoin = 'round';
        if (k >= 0.34) crack(ctx, -ew * 0.05, -eh * 0.62, ew * 0.3, 1);
        if (k >= 0.67) crack(ctx, ew * 0.08, -eh * 0.42, ew * 0.35, -1);
        if (k >= 1) crack(ctx, -ew * 0.25, -eh * 0.5, ew * 0.5, 1);
        ctx.restore();
      }
      if (nim) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(nl - 2, hy, p.w + 4, nh);
        ctx.ellipse(hx, hy, hrx, hry, 0, 0, Math.PI * 2);
        ctx.clip('evenodd');
        ctx.drawImage(nim, nl, nt, p.w, nh);
        ctx.restore();
      }
      // полоска тепла
      const bw = p.w * 0.8, bx = p.x - bw / 2, by = p.y + 6;
      ctx.fillStyle = 'rgba(26,14,44,.7)'; ctx.fillRect(bx, by, bw, 5);
      ctx.fillStyle = k >= 1 ? '#5BE0B3' : '#FF9A3D'; ctx.fillRect(bx, by, bw * k, 5);
    }
  }
  function crack(ctx, x, y, w, dir) {
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 1; i <= 4; i++) ctx.lineTo(x + (w / 4) * i, y + (i % 2 ? 1 : -1) * w * 0.12 * dir);
    ctx.stroke();
  }
  function drawFront(ctx, g) {
    G = g;
    const list = actors.filter((a) => !a.inBed).sort((a, b) => (a.perch ? 1 : 0) - (b.perch ? 1 : 0) || a.y - b.y);
    list.forEach((a) => drawPet(ctx, a));
    list.forEach((a) => bubble(ctx, a));
  }

  // нажатие на питомца или яйцо
  function hit(x, y) {
    for (const a of actors) {
      const b = a.box;
      if (b && x >= b.x + b.w * 0.15 && x <= b.x + b.w * 0.85 && y >= b.y + b.h * 0.1 && y <= b.y + b.h) {
        lastInput = performance.now();
        Sound.pop();
        if (a.st === 'sleep') wakeUp(a);
        else { setState(a, 'happy', 0.8); a.squash = 0.15; say(a, pickOne(PET[a.id].phrases), 2400); }
        return 'pet';
      }
    }
    if (st().nest && G) {
      const p = nestPos();
      if (Math.abs(x - p.x) < p.w * 0.5 && y > p.y - p.w && y < p.y + 12) return 'egg';
    }
    return null;
  }
  function onPotTap() {
    lastInput = performance.now();
    warmTap();
    actors.forEach((a) => { if (a.st === 'idle' && Math.random() < 0.08) { setState(a, 'happy', 0.6); a.squash = 0.1; } });
  }
  function poke() { lastInput = performance.now(); }

  // =====================================================================
  //  Окна
  // =====================================================================
  let tab = 'pets';
  function open(startTab) {
    if (!owned().length && !st().first) { UI.toast('Питомцы появятся на ранге «' + D.ranks[C.petSlots[0]].name + '»'); return; }
    if (startTab) tab = startTab;
    const body = h('div', { class: 'brew pets' });
    const draw = () => UI.keepSeg(body, () => drawInner(body, draw));
    draw();
    UI.modal({ sheet: true, title: '', body, onClose: refreshButton, onOpen: (box) => box.classList.add('fixed-h') });
  }
  function drawInner(body, redraw) {
    body.innerHTML = '';
    const s = S(), p = st();
    const top = h('div', { class: 'sheet-top' });
    body.append(top);
    top.append(h('div', { class: 'brew-head' }, pic('ui/paw_heart', 'brew-head-ico'),
      h('div', { class: 'brew-head-text' }, h('b', null, 'Питомцы'),
        h('small', null, 'В комнате: ' + inRoom().length + ' / ' + slots()), h('small', null, 'Всего: ' + owned().length + ' из ' + D.pets.length)),
      h('div', { class: 'ev-candy' }, pic('ui/crystal', 'cr-ico'), h('b', null, s.cr))));
    const tabs = [['pets', 'Питомцы', 0], ['trips', 'Походы', readyTrips().length], ['eggs', 'Яйца', eggReady() ? 1 : 0]];
    top.append(h('div', { class: 'seg' }, tabs.map(([id, l, n]) => {
      const b = h('button', { type: 'button', class: 'seg-btn' + (tab === id ? ' on' : '') }, l, n ? h('span', { class: 'seg-badge' }, n) : null);
      b.addEventListener('click', () => { tab = id; Sound.tap(); redraw(); body.scrollTop = 0; });
      return b;
    })));
    if (tab === 'pets') drawPets(body, redraw);
    else if (tab === 'trips') drawTrips(body, redraw);
    else drawEggs(body, redraw);
  }
  const save = () => { if (window.Game) Game.save(); };
  // пустое состояние: картинка и текст по центру свободного места
  const empty = (img, title, sub) => h('div', { class: 'empty' }, pic(img, 'empty-pic'), h('b', null, title), sub ? h('small', null, sub) : null);

  function drawPets(body, redraw) {
    const p = st();
    if (!owned().length) { body.append(empty('ui/paw_heart', 'Питомцев пока нет')); return; }
    owned().forEach((id) => {
      const pet = PET[id], o = p.own[id], room = inRoom().includes(id), trip = p.trip[id];
      const status = trip ? (tripDone(id) ? 'Вернулся из похода!' : 'В походе: ' + LOC[trip.loc].name + ', ещё ' + Fmt.time(tripLeft(id))) : room ? 'В комнате, помогает' : 'Дома, отдыхает';
      const need = feedNeed(o.lv);
      const card = h('div', { class: 'pet-card' + (o.gold ? ' gold' : '') },
        h('div', { class: 'pet-top' },
          h('div', { class: 'pet-ava' + (o.gold ? ' gold' : '') }, pic('pets/' + id + '/00')),
          h('div', { class: 'info' },
            h('div', { class: 'name' }, (o.gold ? 'Золотой ' + pet.name.toLowerCase() : pet.name) + ' · ур. ' + o.lv),
            h('div', { class: 'desc' }, pet.bonusText(pet.per * o.lv * (o.gold ? 1.5 : 1)) + (room ? '' : ' (когда в комнате)')),
            o.lv < C.petMaxLevel ? h('div', { class: 'bar pet-bar' }, h('i', { style: 'width:' + (o.xp / need * 100) + '%' })) : h('div', { class: 'meta' }, 'Максимальный уровень'),
            h('div', { class: 'meta' }, status))));
      const row = h('div', { class: 'pet-actions' });
      if (!trip) {
        const b = h('button', { class: 'pill-btn small', type: 'button' }, room ? 'Домой' : 'В комнату');
        b.addEventListener('click', () => {
          if (room) p.room = p.room.filter((x) => x !== id);
          else {
            if (inRoom().length >= slots()) { Sound.deny(); UI.toast('Мест в комнате: ' + slots() + '. Сначала отправь кого-то домой'); return; }
            p.room.push(id);
          }
          Sound.tap(); save(); redraw(); UI.refresh();
        });
        row.append(b);
        if (o.lv < C.petMaxLevel) {
          const fb = h('button', { class: 'pill-btn small alt-mint', type: 'button' }, 'Покормить');
          fb.addEventListener('click', () => feedPicker(id, redraw));
          row.append(fb);
        }
      } else if (tripDone(id)) {
        const cb = h('button', { class: 'pill-btn small', type: 'button' }, 'Забрать добычу');
        cb.addEventListener('click', () => doCollect(id, redraw));
        row.append(cb);
      }
      card.append(row);
      body.append(card);
    });
    const next = C.petSlots.find((r) => Econ.rank() < r);
    body.append(h('p', { class: 'note left' }, 'Питомец в комнате даёт бонус, а свободного можно отправить в поход. Корми ингредиентами: любимая еда даёт втрое больше опыта.' +
      (next !== undefined ? ' Следующее место в комнате - на ранге «' + D.ranks[next].name + '».' : '')));
  }

  function feedPicker(id, redraw) {
    const pet = PET[id];
    const have = D.ingr.filter((x) => Brew.count(x.id) > 0);
    const box = h('div', null);
    const list = () => {
      box.innerHTML = '';
      const o = st().own[id];
      box.append(h('p', { class: 'small center' }, 'Любимое: ' + pet.food.map((f) => Brew.ing(f).name).join(', ') + '. Ур. ' + o.lv + ', опыт ' + o.xp + ' / ' + feedNeed(o.lv)));
      const items = D.ingr.filter((x) => Brew.count(x.id) > 0).sort((a, b) => (pet.food.includes(b.id) ? 1 : 0) - (pet.food.includes(a.id) ? 1 : 0));
      if (!items.length) { box.append(h('p', { class: 'note' }, 'Ингредиентов нет.')); return; }
      box.append(h('div', { class: 'ing-grid' }, items.map((x) => {
        const fav = pet.food.includes(x.id);
        const b = h('button', { type: 'button', class: 'ing' + (fav ? ' fav' : '') + (x.rare ? ' rare' : '') },
          pic(x.img), h('span', { class: 'ing-n' }, Brew.count(x.id)), h('span', { class: 'ing-name' }, fav ? UI.pic('ui/heart3', 'fav-ico') : null, x.name));
        b.addEventListener('click', () => {
          const r = feed(id, x.id);
          if (!r) { Sound.deny(); return; }
          Sound.blub();
          if (r.up) { Sound.fanfare(); UI.toast(pet.name + ': уровень ' + r.lv + '!'); }
          save(); list();
        });
        return b;
      })));
    };
    list();
    void have;
    UI.closeModal();
    UI.modal({ title: pet.name, body: h('div', null, h('p', { class: 'm-sub' }, 'Чем угостить?'), box), onClose: () => setTimeout(() => open('pets'), 0) });
  }

  // ---------- походы ----------
  let pickLoc = null;
  function drawTrips(body, redraw) {
    const p = st();
    const ids = owned();
    // активные походы
    const active = ids.filter((id) => p.trip[id]);
    if (active.length) {
      body.append(h('h3', { class: 'section-title' }, 'В пути'));
      active.forEach((id) => {
        const t = p.trip[id], L = LOC[t.loc], done = tripDone(id);
        const btns = h('div', { class: 'pet-actions' });
        if (done) {
          const b = h('button', { class: 'pill-btn small', type: 'button' }, 'Забрать добычу');
          b.addEventListener('click', () => doCollect(id, redraw));
          btns.append(b);
        } else {
          if (Platform.adsAvailable()) {
            const ad = h('button', { class: 'pill-btn small ad', type: 'button' }, '▶ Вдвое быстрее');
            ad.addEventListener('click', async () => {
              const ok = await Platform.rewardedAd();
              if (!ok) { UI.toast('Реклама сейчас недоступна'); return; }
              speedUp(id, 'ad'); save(); redraw();
            });
            btns.append(ad);
          }
          const cost = finishCost(id);
          const cb = h('button', { class: 'pill-btn small', type: 'button' }, 'Сразу за ', UI.money(cost, 'ui/crystal'));
          cb.addEventListener('click', () => {
            if (!speedUp(id, 'cr')) { Sound.deny(); UI.toast('Не хватает кристаллов'); return; }
            Sound.coin(); save(); redraw(); UI.refresh();
          });
          btns.append(cb);
        }
        body.append(h('div', { class: 'row-card trip' },
          h('div', { class: 'ico' }, pic(L.img)),
          h('div', { class: 'info' }, h('div', { class: 'name' }, PET[id].name + ' · ' + L.name),
            h('div', { class: 'desc' }, done ? 'Вернулся! Забирай добычу' : 'Вернётся через ' + Fmt.time(tripLeft(id))),
            h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.min(100, 100 * (1 - tripLeft(id) / ((t.end - t.start) / 1000 || 1))) + '%' })),
            btns)));
      });
    }
    // куда отправить
    const free = ids.filter((id) => !p.trip[id]);
    body.append(h('h3', { class: 'section-title' }, 'Отправить в поход'));
    if (!free.length) { body.append(h('p', { class: 'note center' }, 'Все питомцы в пути.')); }
    D.locations.forEach((L) => {
      const open = locOpen(L);
      const m = p.margo;
      const eggHere = m.st === 1 && L.egg && m.need.includes(L.egg) && !m.found.includes(L.egg);
      const card = h('div', { class: 'loc-card' + (open ? '' : ' locked') + (pickLoc === L.id ? ' on' : '') },
        h('div', { class: 'loc-img' }, pic(L.img)),
        h('div', { class: 'info' },
          h('div', { class: 'name' }, L.name, eggHere ? h('span', { class: 'egg-tag' }, pic(D.eggs[L.egg].img, 'egg-mini'), 'яйцо Марго') : null),
          h('div', { class: 'desc' }, open ? L.desc : 'Откроется на ранге «' + D.ranks[L.rank].name + '»'),
          h('div', { class: 'loc-props' }, L.props.map((pr) => pic('props/' + pr, 'prop-ico')))));
      if (open && free.length) card.addEventListener('click', () => { pickLoc = pickLoc === L.id ? null : L.id; Sound.tap(); redraw(); });
      body.append(card);
      if (pickLoc === L.id && open && free.length) body.append(tripForm(L, free, redraw));
    });
  }
  let pickPet = null, pickLen = 1;
  function tripForm(L, free, redraw) {
    if (!free.includes(pickPet)) pickPet = free[0];
    const box = h('div', { class: 'trip-form' });
    box.append(h('div', { class: 'small' }, 'Кто пойдёт:'));
    box.append(h('div', { class: 'pick-row' }, free.map((id) => {
      const fav = PET[id].loc === L.id;
      const b = h('button', { type: 'button', class: 'pick-pet' + (pickPet === id ? ' on' : '') },
        pic('pets/' + id + '/00'), h('span', null, PET[id].name), fav ? h('small', null, UI.pic('ui/heart3', 'fav-ico'), 'любит') : null);
      b.addEventListener('click', () => { pickPet = id; Sound.tap(); redraw(); });
      return b;
    })));
    box.append(h('div', { class: 'small' }, 'Как надолго:'));
    box.append(h('div', { class: 'seg small-seg trip-len' }, D.tripLengths.map((T, i) => {
      const b = h('button', { type: 'button', class: 'seg-btn' + (pickLen === i ? ' on' : '') }, T.min < 60 ? T.min + ' мин' : T.min / 60 + ' ч');
      b.addEventListener('click', () => { pickLen = i; Sound.tap(); redraw(); });
      return b;
    })));
    const T = D.tripLengths[pickLen];
    const inRoomNow = inRoom().includes(pickPet);
    box.append(h('p', { class: 'small' }, 'Добыча: около ' + Math.round(T.n * (1 + 0.05 * level(pickPet)) * (PET[pickPet].loc === L.id ? 1.5 : 1)) + ' ингредиентов' +
      (T.chest ? ', сундук с кристаллами' : '') + '. Шанс редкого выше в долгих походах.' + (inRoomNow ? ' Пока питомец в пути, его бонуса в комнате не будет.' : '')));
    const go = h('button', { class: 'btn', type: 'button' }, pic('ui/backpack', 'btn-ico'), 'Отправить');
    go.addEventListener('click', () => {
      if (!sendTrip(pickPet, L.id, pickLen)) { Sound.deny(); return; }
      Sound.coin(); UI.toast(PET[pickPet].name + ' отправился: ' + L.name);
      pickLoc = null; save(); redraw(); UI.refresh();
    });
    box.append(go);
    return box;
  }
  function doCollect(id, redraw) {
    const r = collect(id);
    if (!r) return;
    Sound.fanfare();
    save();
    const list = Object.keys(r.got).map((k) => h('div', { class: 'loot' }, pic(Brew.ing(k).img), h('b', null, '×' + r.got[k]), h('small', null, Brew.ing(k).name)));
    UI.closeModal();
    UI.modal({
      title: PET[id].name + ' вернулся!',
      body: h('div', null,
        h('div', { class: 'sheet-ico' }, pic(r.crystals ? 'ui/chest' : 'ui/backpack')),
        h('p', { class: 'center' }, 'Поход: ' + r.loc.name + '. Принёс ' + r.n + ' ' + Fmt.plural(r.n, ['ингредиент', 'ингредиента', 'ингредиентов']) + '.'),
        h('div', { class: 'loot-grid' }, list),
        r.crystals ? h('p', { class: 'center' }, 'В сундуке: +' + r.crystals + ' ' + UI.crystalsWord(r.crystals) + (r.scroll ? ' и свиток рецепта' : '')) : null,
        r.egg ? h('div', { class: 'gift-row big' }, pic(D.eggs[r.egg].img, 'gift-pic'), h('span', null, 'Нашлось ', h('b', null, D.eggs[r.egg].name.toLowerCase()), '! Оно уже греется у тёплого котла.')) : null),
      actions: [{ label: 'Отлично!', onClick: () => { if (r.margoLine) setTimeout(() => margoModal(r.margoLine, true), 0); else setTimeout(() => open('trips'), 0); } }]
    });
    UI.refresh();
  }

  // ---------- яйца ----------
  function drawEggs(body, redraw) {
    const p = st(), n = p.nest;
    if (n) {
      const E = D.eggs[n.t], k = Math.min(1, n.heat / E.need);
      const left = Math.max(0, E.need - n.heat);
      body.append(h('div', { class: 'egg-card' },
        h('div', { class: 'egg-big' }, pic('pets/nest', 'egg-nest'), pic(E.img, 'egg-pic' + (k >= 1 ? ' ready' : ''))),
        h('div', { class: 'info' },
          h('div', { class: 'name' }, E.name),
          h('div', { class: 'bar egg-bar' }, h('i', { style: 'width:' + k * 100 + '%' })),
          h('div', { class: 'desc' }, k >= 1 ? 'Вылупляется! Скорее посмотри' : 'Тепло ' + Math.round(k * 100) + '%. Само прогреется примерно за ' + Fmt.time(left)),
          h('div', { class: 'meta' }, 'Помешивание котла и огненные ингредиенты греют быстрее'))));
      if (k >= 1) {
        const b = h('button', { class: 'btn', type: 'button' }, 'Вылупить!');
        b.addEventListener('click', () => doHatch());
        body.append(b);
      } else {
        const fire = D.ingr.filter((x) => D.eggHeat[x.id] && Brew.count(x.id) > 0);
        if (fire.length) {
          body.append(h('div', { class: 'small' }, 'Подбросить в костёр:'));
          body.append(h('div', { class: 'ing-grid' }, fire.map((x) => {
            const b = h('button', { type: 'button', class: 'ing' + (x.rare ? ' rare' : '') }, pic(x.img), h('span', { class: 'ing-n' }, Brew.count(x.id)),
              h('span', { class: 'ing-name' }, '+' + Fmt.time(D.eggHeat[x.id])));
            b.addEventListener('click', () => { if (warmWith(x.id)) { Sound.blub(); save(); redraw(); } });
            return b;
          })));
        } else body.append(h('p', { class: 'note left' }, 'Огненные ингредиенты (искра, уголёк, лава, перец, имбирь, огнецвет) греют яйцо быстрее.'));
      }
    } else if (!p.eggs.length && p.margo.st < 1) { body.append(empty('pets/nest', 'Гнездо пустое', 'Яйца находят питомцы в походах')); return; }
    else body.append(h('p', { class: 'note center' }, 'Гнездо пустое. Яйца находят питомцы в походах.'));
    if (p.eggs.length) {
      body.append(h('h3', { class: 'section-title' }, 'Ждут своей очереди'));
      body.append(h('div', { class: 'loot-grid' }, p.eggs.map((t) => h('div', { class: 'loot' }, pic(D.eggs[t].img), h('small', null, D.eggs[t].name)))));
    }
    // история Марго
    const m = p.margo;
    if (m.st >= 1) {
      body.append(h('h3', { class: 'section-title' }, 'Корзина Марго'));
      body.append(h('div', { class: 'margo-row' }, h('div', { class: 'pet-ava' }, pic(D.margo.img)),
        h('div', { class: 'info' }, h('div', { class: 'name' }, D.margo.name),
          h('div', { class: 'desc' }, m.st === 2 ? 'Все яйца дома. Спасибо!' : 'Найдено ' + m.found.length + ' из ' + m.need.length + ', вылупилось ' + m.hatched.length))));
      body.append(h('div', { class: 'loot-grid' }, m.need.map((t) => {
        const L = D.locations.find((l) => l.egg === t);
        const got = m.found.includes(t);
        return h('div', { class: 'loot' + (got ? '' : ' off') }, pic(got ? D.eggs[t].img : 'ui/recipe_unknown'),
          h('small', null, got ? (m.hatched.includes(t) ? 'Вылупилось' : 'Найдено') : (L ? L.name : '?')));
      })));
    }
  }
  function doHatch() {
    const n = st().nest;
    if (!n) return;
    if (n.t === 'gold') { goldPicker(); return; }
    const r = hatch();
    if (!r) return;
    finishHatch(r);
  }
  function finishHatch(r) {
    Sound.hatch();
    Cauldron.setMood('excited', 2000);
    save();
    UI.closeModal();
    const id = r.pet || r.golden;
    const pet = id && PET[id];
    UI.modal({
      title: r.golden ? 'Золотой ' + pet.name.toLowerCase() + '!' : r.dupe ? 'Какой сюрприз!' : 'Вылупился ' + pet.name.toLowerCase() + '!',
      body: h('div', null,
        id ? h('div', { class: 'sheet-ico hatch' + (r.golden ? ' gold' : '') }, pic('pets/' + id + '/03')) : h('div', { class: 'sheet-ico' }, pic('pets/shell')),
        h('p', { class: 'center' }, r.golden ? 'Он сияет, а его помощь стала в полтора раза сильнее!' : r.dupe
          ? 'Такой малыш у тебя уже есть - он убежал к маме, а тебе оставил гостинцы: ингредиенты и 5 кристаллов.'
          : pet.name + ' теперь живёт в лавке. ' + pet.bonusText(pet.per) + ', когда он в комнате. Бульк: «Из яйца? Ну, это же волшебная лавка!»')),
      actions: [{ label: 'Ура!', onClick: () => { if (r.margoDone) setTimeout(() => margoModal(D.margo.final, true), 0); } }]
        .concat(id && !r.dupe && typeof Social !== 'undefined' ? Social.storyAction('pet', { title: (r.golden ? 'Золотой ' : 'Мой ') + pet.name.toLowerCase() + '!', sub: 'Вылупился в моей лавке', img: 'pets/' + id + '/03' }) : [])
    });
    UI.refresh();
    refreshButton();
  }
  function goldPicker() {
    UI.closeModal();
    UI.modal({
      title: 'Кого сделать золотым?',
      body: h('div', { class: 'pick-row wrap' }, owned().filter((id) => !st().own[id].gold).map((id) => {
        const b = h('button', { type: 'button', class: 'pick-pet' }, pic('pets/' + id + '/00'), h('span', null, PET[id].name));
        b.addEventListener('click', () => { UI.closeModal(); const r = hatch(id); if (r) finishHatch(r); });
        return b;
      }))
    });
  }

  function margoModal(text, happy) {
    UI.modal({
      title: D.margo.name,
      body: h('div', null,
        h('div', { class: 'dlg-portrait' }, h('span', { class: 'dlg-ava' }, pic(happy ? D.margo.imgHappy : D.margo.img)), pic('hud/avatar_frame', 'dlg-frame')),
        h('p', { class: 'story' }, '«' + text + '»')),
      actions: [{ label: 'Помогу!' }]
    });
  }

  function firstPetModal() {
    const p = st();
    const choose = (id) => {
      addPet(id);
      p.firstAt = Date.now();
      Sound.fanfare();
      UI.closeModal();
      UI.toast(PET[id].name + ' теперь живёт в лавке!');
      save(); UI.refresh(); refreshButton();
    };
    UI.modal({
      title: 'Кто-то у порога…',
      closable: false,
      body: h('div', null,
        h('p', { class: 'center' }, 'Пока ты варишь зелья, у двери лавки кто-то возится и тихонько пищит. Двое малышей пришли погреться у котла. Кого возьмёшь к себе?'),
        h('div', { class: 'pick-row big' }, ['frog', 'cat'].map((id) => {
          const b = h('button', { type: 'button', class: 'pick-pet big' }, pic('pets/' + id + '/03'), h('span', null, PET[id].name),
            h('small', null, PET[id].bonusText(PET[id].per)));
          b.addEventListener('click', () => choose(id));
          return b;
        })),
        h('p', { class: 'small center' }, 'Второго малыша ты ещё встретишь.'))
    });
  }

  // ---------- кнопка на экране котла ----------
  function refreshButton() {
    const b = document.getElementById('pets-btn');
    if (!b) return;
    const show = owned().length > 0 || st().first;
    b.hidden = !show;
    const n = readyTrips().length + (eggReady() ? 1 : 0);
    const dot = b.querySelector('b');
    UI.setText(dot, n ? n : '');
    dot.hidden = !n;
  }

  // ---------- главный цикл ----------
  let checkT = 0;
  function tick(dt, onMain) {
    warmByTime();
    checkT += dt;
    if (checkT > 1) { checkT = 0; refreshButton(); checkStory(); }
    if (onMain) update(dt);
  }

  function init() {
    st();
    if (st().nest) warmByTime();
    owned().forEach((id) => { for (let f = 0; f < 16; f++) sprite(id, f); });
    Cauldron.setExtra(drawBack, drawFront);
    refreshButton();
  }

  // когда что-то случится само: питомец вернётся из похода, яйцо будет готово (мс, для напоминаний)
  function timers() {
    const p = st(), now = Date.now();
    const ends = Object.values(p.trip || {}).map((t) => t && t.end).filter((t) => t > now);
    const n = p.nest;
    return { pet: ends.length ? Math.min(...ends) : 0, egg: n && !eggReady() ? now + Math.max(0, eggNeed() - n.heat) * 1000 : 0 };
  }
  return { init, tick, hit, onPotTap, poke, bonus, timers, _idle: () => { lastInput = -1e9; }, _perch: () => { const a = actors[0]; if (a && !a.perch) { a.x = G.cx - G.r * 1.15; jumpUp(a); } }, open, refreshButton, giveEgg, addPet, owned, inRoom, slots, feed, collect, hatch, sendTrip, st };
})();

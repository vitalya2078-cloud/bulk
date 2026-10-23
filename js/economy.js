// Состояние игры, математика и сохранение. Без DOM и canvas.
const Econ = (() => {
  const C = CONFIG, D = DATA;
  const CARD = {}; D.cards.forEach((c) => { CARD[c.id] = c; });
  // шаблоны заданий ищутся каждый раз: модули могут добавлять свои задания позже
  const QT = new Proxy({}, { get: (_, id) => D.quests.find((q) => q.id === id) });
  const hooks = { questReady: null };

  // ---------- даты по местному времени ----------
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const dateKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => dateKey(new Date());
  function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return dateKey(d); }
  function secToMidnight() { const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0); return (m - n) / 1000; }

  function rngFrom(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  // ---------- состояние ----------
  function fresh() {
    return {
      v: 1, ts: Date.now(),
      e: 0,            // эссенция на счету
      le: 0,           // сварено за всё время (определяет ранг)
      taps: 0,         // засчитанных тапов за всё время
      cards: {},       // уровни карточек: id → уровень
      scoop: 0,        // уровень черпака
      pantry: 0,       // уровень кладовой
      rank: 0,         // последний ранг, который игрок «видел»
      vis: {},         // жители: id → выполненных заказов
      served: 0, bb: 0, qd: 0,
      recipesSolved: 0, runesDone: 0,
      daily: { l: '', s: 0 },
      q: null,                          // задания на сегодня
      recipe: { d: '', tries: [], solved: false },
      rune: { d: '', done: false },
      ac: [],          // открытые достижения
      fx: {},          // эффекты: имя → время окончания (мс)
      inv: '',         // день последней награды за приглашение
      welcome: false,  // подарок за приход по приглашению уже получен
      snd: true,
      seenVer: '',     // последняя версия, чьё «Что нового» игрок видел
      fav: { n: 0, at: 0, done: false }, // предложение добавить игру в избранное / на главный экран
      cat: 'garden',   // открытый раздел в Лавке
      // ---- 0.2 ----
      cr: C.crystals.start,                    // лунные кристаллы
      fr: {},                                  // жители: достигнутый уровень дружбы
      prof: { name: '', avatar: 'a01', title: 'novice' },
      own: { av: [], acc: [], pot: [] },       // купленное и подаренное
      wear: { head: '', face: '', liquid: 'auto', pot: 'base', name: 'Бульк', spoon: 'spoon', bed: 'bed_cushion', toy: '', stand: 'stand_iron' },
      set: { music: 0.35, sfx: 0.8, vib: true, nums: 'short', lowfx: false, notif: false, notifAsked: 0 },
      stat: { start: Date.now(), days: 0, lastDay: '', bestStreak: 0, maxPh: 0, play: 0 },
      // ---- 0.3: события по календарю ----
      lvl: 1, xp: 0,     // уровень алхимика и опыт на текущем уровне
      sk: {},            // навыки: id → ступень (0-3)
      ev: null,          // текущее событие { id, candy, total, got: [], tapAcc, q: { d, l } }
      evDone: [],        // события, которые уже закончились и обменены на кристаллы
      // ---- 0.5: варка зелий ----
      ing: {},           // ингредиенты: id → сколько
      bag: {},           // сумка зелий: id (или id+'+' - отличное качество) → сколько
      pa: {},            // выпитые зелья: id → время окончания (мс)
      sleepPot: false,   // зелье сна ждёт следующего возвращения
      book: ['power', 'gold'], // открытые рецепты
      hints: {},         // подсказки к неоткрытым: id → сколько ячеек открыто
      brewed: 0,         // сварено зелий всего
      tapIng: 0,         // тапов с последнего найденного ингредиента
      brewInit: 0,       // версия выданного стартового набора
      shop: { d: '', b: [] }, // торговка: день и сколько куплено в каждом слоте
      // ---- 0.6: питомцы ----
      pets: {},
      // ---- 0.7: просьбы жителей ----
      story: {},
      req: [],         // просьбы жителей в журнале
      jtab: 'req',     // открытая вкладка журнала заданий
      mg: {},          // мини-игры: { d: день, n: сыграно с полной наградой, ad: добавлено рекламой, best: рекорды }
      pd: []           // 0.20.1: номера применённых правок из админки - чтобы правка не применилась дважды
    };
  }

  let s = fresh();
  let cache = null;
  const invalidate = () => { cache = null; };

  function load(o) {
    if (!o || typeof o !== 'object') return;
    const f = fresh();
    for (const k in f) if (o[k] !== undefined && o[k] !== null && typeof o[k] === typeof f[k]) f[k] = o[k];
    f.ac = Array.isArray(o.ac) ? o.ac.filter((x) => typeof x === 'string') : [];
    if (o.q && Array.isArray(o.q.l)) f.q = o.q;
    for (const k of ['e', 'le', 'taps', 'scoop', 'pantry', 'rank', 'served', 'bb', 'qd', 'recipesSolved', 'runesDone']) {
      if (!isFinite(f[k]) || f[k] < 0) f[k] = 0;
    }
    for (const id in f.cards) if (!CARD[id] || !(f.cards[id] >= 0)) delete f.cards[id];
    f.pantry = Math.min(f.pantry, D.pantry.hours.length - 1);
    // вложенные объекты 0.2: дополняем значениями по умолчанию
    const d = fresh();
    for (const k of ['prof', 'own', 'wear', 'set', 'stat']) f[k] = Object.assign({}, d[k], o[k] && typeof o[k] === 'object' ? o[k] : {});
    for (const k of ['av', 'acc', 'pot']) if (!Array.isArray(f.own[k])) f.own[k] = [];
    if (!isFinite(f.cr) || f.cr < 0) f.cr = o.cr === undefined ? C.crystals.start : 0;
    if (!f.fr || typeof f.fr !== 'object') f.fr = {};
    f.ev = o.ev && typeof o.ev === 'object' && o.ev.id ? o.ev : null;
    f.evDone = Array.isArray(o.evDone) ? o.evDone : [];
    if (!(f.lvl >= 1)) f.lvl = 1;
    if (!(f.xp >= 0)) f.xp = 0;
    f.sk = o.sk && typeof o.sk === 'object' ? o.sk : {};
    for (const k of ['ing', 'bag', 'pa', 'hints']) if (!f[k] || typeof f[k] !== 'object' || Array.isArray(f[k])) f[k] = {};
    if (!Array.isArray(f.book)) f.book = ['power', 'gold'];
    if (!f.shop || !Array.isArray(f.shop.b)) f.shop = { d: '', b: [] };
    s = f;
    invalidate();
  }

  const r2 = (x) => Math.round(x * 100) / 100;
  function serialize() {
    return JSON.stringify(Object.assign({}, s, { ts: Date.now(), e: r2(s.e), le: r2(s.le) }));
  }

  // wipe - метка «игрок сам начал заново»: по ней база отличает сброс от случайного старта с нуля
  function reset() { const snd = s.snd; s = fresh(); s.snd = snd; s.stat.wipe = s.stat.start; invalidate(); }

  // ---------- ранги ----------
  function rankOf(le) {
    let r = 0;
    D.ranks.forEach((x, i) => { if (le >= x.need) r = i; });
    return r;
  }
  const rank = () => rankOf(s.le);
  function rankProgress() {
    const r = rank();
    const next = D.ranks[r + 1];
    if (!next) return { r, frac: 1, next: null };
    const from = D.ranks[r].need;
    return { r, next, frac: Math.min(1, (s.le - from) / (next.need - from)), left: next.need - s.le };
  }

  // ---------- карточки ----------
  const level = (id) => s.cards[id] || 0;
  function cardIncome(c, L) {
    if (!L) return 0;
    const g = C.cardIncomeGrowth;
    return c.income * (Math.pow(g, L) - 1) / (g - 1);
  }
  const cardCost = (c, L) => Math.round(c.cost * Math.pow(C.cardCostGrowth, L) * (1 - 0.03 * sk('h3')));
  const cardNextGain = (c) => cardIncome(c, level(c.id) + 1) - cardIncome(c, level(c.id));

  // null - доступна; иначе объект требования
  function cardLock(c) {
    if (!c.req) return null;
    if (c.req.rank !== undefined && rank() < c.req.rank) return c.req;
    if (c.req.card && level(c.req.card) < c.req.level) return c.req;
    return null;
  }

  function lockText(req) {
    if (req.rank !== undefined) return 'Нужен ранг «' + D.ranks[req.rank].name + '»';
    return 'Нужно: ' + CARD[req.card].name + ', ур. ' + req.level;
  }

  function buyCard(id) {
    const c = CARD[id];
    if (!c || cardLock(c)) return false;
    const L = level(id);
    if (L >= C.cardMaxLevel) return false;
    const cost = cardCost(c, L);
    if (s.e < cost) return false;
    s.e -= cost;
    s.cards[id] = L + 1;
    progress('levels', 1);
    addXp(C.xp.card + L);
    invalidate();
    return true;
  }

  // ---------- инструменты ----------
  const scoopCost = () => Math.round(D.scoop.baseCost * Math.pow(D.scoop.growth, s.scoop));
  function buyScoop() {
    if (s.scoop >= D.scoop.max) return false;
    const c = scoopCost();
    if (s.e < c) return false;
    s.e -= c; s.scoop++; invalidate();
    addXp(C.xp.tool);
    return true;
  }
  const petB = (k) => (typeof Pets !== 'undefined' ? Pets.bonus(k) : 0);
  const pantryHours = () => Math.round((D.pantry.hours[s.pantry] + sk('h2') + (potion('time') ? 4 : 0) + petB('pantry')) * 4) / 4;
  const pantryNext = () => (s.pantry + 1 < D.pantry.hours.length ? { hours: D.pantry.hours[s.pantry + 1], cost: D.pantry.costs[s.pantry + 1] } : null);
  function buyPantry() {
    const n = pantryNext();
    if (!n || s.e < n.cost) return false;
    s.e -= n.cost; s.pantry++;
    addXp(C.xp.tool);
    return true;
  }

  // ---------- навыки и опыт ----------
  const sk = (id) => Math.max(0, Math.min(D.skillMax || 3, (s.sk && s.sk[id]) || 0));
  const skillSpent = () => Object.keys(s.sk).reduce((a, k) => a + sk(k), 0);
  const skillPoints = () => Math.max(0, (s.lvl - 1) - skillSpent());
  const xpToNext = () => (s.lvl >= C.maxLevel ? 0 : C.xpNeed(s.lvl));
  function addXp(n) {
    if (!(n > 0) || s.lvl >= C.maxLevel) return;
    s.xp += n * (1 + 0.1 * sk('s4') + petB('xp')) * (potion('wisdom') ? 2 : 1);
    let ups = 0;
    while (s.lvl < C.maxLevel && s.xp >= C.xpNeed(s.lvl)) {
      s.xp -= C.xpNeed(s.lvl);
      s.lvl++;
      ups++;
    }
    if (s.lvl >= C.maxLevel) s.xp = 0;
    if (ups && hooks.levelUp) hooks.levelUp(s.lvl, ups);
  }
  function learnSkill(id) {
    const k = D.skills.find((x) => x.id === id);
    if (!k || sk(id) >= D.skillMax || skillPoints() < 1) return false;
    const list = D.skills.filter((x) => x.b === k.b);
    const i = list.indexOf(k);
    if (i > 0 && sk(list[i - 1].id) < 1) return false;
    s.sk[id] = sk(id) + 1;
    invalidate();
    return true;
  }
  function resetSkills() {
    if (!skillSpent() || s.cr < C.skillReset) return false;
    s.cr -= C.skillReset;
    s.sk = {};
    invalidate();
    return true;
  }

  // ---------- доход ----------
  function derive() {
    if (cache) return cache;
    let perHour = 0, levels = 0;
    D.cards.forEach((c) => { const L = level(c.id); levels += L; perHour += cardIncome(c, L); });
    perHour *= 1 + 0.05 * sk('h1') + 0.1 * sk('h5');
    cache = { perHour, levels };
    return cache;
  }

  // выпито ли зелье (действует сейчас)
  const potion = (id) => (s.pa[id] || 0) > Date.now();

  const effectLeft = (name) => Math.max(0, ((s.fx[name] || 0) - Date.now()) / 1000);
  function fxMul(field) {
    let m = 1;
    for (const k in D.effects) if (D.effects[k][field] && effectLeft(k) > 0) m *= D.effects[k][field];
    return m;
  }
  function addEffect(name, sec, capSec) {
    const now = Date.now();
    let until = Math.max(now, s.fx[name] || 0) + sec * 1000;
    if (capSec) until = Math.min(until, now + capSec * 1000);
    s.fx[name] = until;
  }
  function activeEffects() {
    const out = [];
    for (const k in D.effects) { const left = effectLeft(k); if (left > 0) out.push({ key: k, def: D.effects[k], left }); }
    return out;
  }

  const basePerHour = () => derive().perHour;
  // общий бонус дохода, включается из админ-панели (например x2 на выходные)
  let gmul = 1;
  const setGlobalMul = (m) => { gmul = m > 0 && m <= 10 ? m : 1; };
  const globalMul = () => gmul;
  // бонус ковена: +2% за каждый уровень ковена
  let cmul = 1;
  const setCovenMul = (m) => { cmul = m >= 1 && m <= 2 ? m : 1; };
  const perHour = () => derive().perHour * fxMul('income') * (potion('gold') ? 1.5 : 1) * gmul * cmul;
  const tapValue = () => ((1 + s.scoop + rank() + sk('t1')) * Math.pow(1.25, sk('t5')) + derive().perHour * (C.tapIncomeShare + 0.0001 * sk('t3'))) * fxMul('tap')
    * (potion('power') ? 2 : 1) * (potion('dragon') ? 5 : 1) * (1 + petB('tap')) * gmul * cmul;
  const hoursOfIncome = (h, min) => Math.max(min || 0, basePerHour() * h);

  function earn(amount, countForQuest) {
    if (!(amount > 0)) return;
    s.e += amount;
    s.le += amount;
  }

  const tick = (dt) => earn(perHour() / 3600 * dt);

  let lastCrit = false;
  function tap() {
    lastCrit = Math.random() < 0.03 * sk('t2') + (potion('luck') ? 0.1 : 0);
    const v = tapValue() * (lastCrit ? 5 : 1);
    earn(v);
    s.taps++;
    progress('taps', 1);
    addXp(C.xp.tap);
    return v;
  }

  // зелье сна удваивает доход за время отсутствия (от минуты)
  const offlineEarnings = (sec) => Math.min(sec, pantryHours() * 3600) * basePerHour() / 3600 * (1 + 0.1 * sk('h4')) * (s.sleepPot && sec >= 60 ? 2 : 1);
  const brewHook = (kind, a) => (typeof Brew !== 'undefined' ? Brew.reward(kind, a) : null);

  // Показывает новый ранг один раз. Возвращает индекс ранга или -1.
  function checkRankUp() {
    const r = rank();
    if (r > s.rank) { s.rank = r; invalidate(); addXp(C.xp.rankUp); return r; }
    return -1;
  }

  // ---------- реклама и друзья ----------
  const addWind = () => addEffect('wind', C.windMinutes * 60, C.windMaxMinutes * 60);
  const canWind = () => effectLeft('wind') < (C.windMaxMinutes - 1) * 60;
  const canInvite = () => s.inv !== today();
  function claimInvite() { s.inv = today(); const v = hoursOfIncome(C.inviteRewardHours, 2000); earn(v); return v; }
  function claimWelcome() { if (s.welcome) return 0; s.welcome = true; earn(C.welcomeBonus); return C.welcomeBonus; }

  // ---------- ежедневный подарок ----------
  function dailyState() {
    if (s.daily.l === today()) return { available: false, streak: s.daily.s, idx: (Math.max(1, s.daily.s) - 1) % D.daily.length };
    const next = s.daily.l === yesterday() ? s.daily.s + 1 : 1;
    return { available: true, streak: next, idx: (next - 1) % D.daily.length };
  }
  const dailyAmount = (idx) => hoursOfIncome(D.daily[idx].hours, D.daily[idx].min);
  function claimDaily() {
    const st = dailyState();
    if (!st.available) return 0;
    const v = dailyAmount(st.idx);
    earn(v);
    s.daily = { l: today(), s: st.streak };
    s.stat.bestStreak = Math.max(s.stat.bestStreak, st.streak);
    const c = C.crystals.daily[st.idx] || 1;
    s.cr += c;
    addXp(C.xp.daily);
    brewHook('daily');
    return { essence: v, crystals: c };
  }

  // ---------- задания ----------
  function ensureQuests() {
    const d = today();
    if (s.q && s.q.d === d) return false;
    const rng = rngFrom('bulk:q:' + d);
    const pool = D.quests.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const list = pool.slice(0, 3).map((t) => {
      const tier = Math.floor(rng() * t.amounts.length);
      return { t: t.id, n: t.amounts[tier], p: 0, c: 0, h: t.hours * (1 + tier * 0.5) };
    });
    s.q = { d, l: list };
    return true;
  }

  // c: 0 - в процессе, 1 - можно забрать, 2 - забрано
  function progress(type, amt) {
    if (!s.q) return;
    for (const q of s.q.l) {
      const t = QT[q.t];
      if (!t || t.type !== type || q.c !== 0) continue;
      q.p = Math.min(q.n, q.p + amt);
      if (q.p >= q.n) { q.c = 1; if (hooks.questReady) hooks.questReady(q); }
    }
  }
  const questReward = (q) => hoursOfIncome(q.h, 1000);
  function claimQuest(i) {
    const q = s.q && s.q.l[i];
    if (!q || q.c !== 1) return 0;
    q.c = 2;
    s.qd++;
    const v = questReward(q);
    earn(v);
    s.cr += C.crystals.quest;
    addXp(C.xp.quest);
    brewHook('quest');
    return v;
  }
  const claimableQuests = () => (s.q ? s.q.l.filter((q) => q.c === 1).length : 0);

  // ---------- рецепт дня ----------
  // Каждый день загадан один ещё не открытый рецепт зелья. На выбор 9 ингредиентов,
  // из них 3 верных. Разгадал - рецепт открывается в книге, зелье падает в сумку.
  function recipeState() {
    if (s.recipe.d !== today() || !s.recipe.rid || !Brew.recipe(s.recipe.rid)) {
      const pk = Brew.dailyPick(today());
      s.recipe = { d: today(), tries: [], solved: false, rid: pk.rid, opts: pk.opts };
    }
    return s.recipe;
  }
  function recipeSecret() {
    const r = Brew.recipe(recipeState().rid);
    return { set: r.ing, potion: r.p.name, recipe: r };
  }
  const recipeReward = () => hoursOfIncome(2, 5000);
  // guess - массив из трёх индексов. Возвращает { hits, solved, reward }
  function guessRecipe(guess) {
    const r = recipeState();
    if (r.solved || r.tries.length >= recipeAttempts()) return null;
    const g = [...new Set(guess)].slice(0, 3);
    if (g.length !== 3) return null;
    const sec = recipeSecret().set;
    const hits = g.filter((x) => sec.includes(x)).length;
    r.tries.push({ g, hits });
    if (hits < 3) addXp(C.xp.recipeTry);
    let reward = 0;
    if (hits === 3) {
      r.solved = true;
      s.recipesSolved++;
      reward = recipeReward();
      earn(reward);
      s.cr += C.crystals.recipe + sk('s5');
      addXp(C.xp.recipe);
      progress('recipe', 1);
      Brew.dailySolved(r.rid);
    }
    return { hits, solved: hits === 3, reward };
  }

  const recipeAttempts = () => C.recipeAttempts + sk('s2');

  // ---------- руна дня ----------
  function runeState() {
    if (s.rune.d !== today()) s.rune = { d: today(), done: false };
    return s.rune;
  }
  const runeOfDay = () => D.runes[Math.floor(rngFrom('bulk:rune:' + today())() * D.runes.length)];
  const runeReward = () => hoursOfIncome(1, 2500);
  function completeRune() {
    const r = runeState();
    if (r.done) return 0;
    r.done = true;
    s.runesDone++;
    const v = runeReward();
    earn(v);
    s.cr += C.crystals.rune + sk('s5');
    addXp(C.xp.rune);
    progress('rune', 1);
    brewHook('rune');
    return v;
  }

  // ---------- посетители и дружба ----------
  // Житель по id, включая особых жителей событий
  const findVisitor = (id) => D.visitors.find((x) => x.id === id) || (D.eventVisitors || []).find((x) => x.id === id);
  const storyAtOf = (id) => { const v = findVisitor(id); return (v && v.storyAt) || D.storyAt; };

  function friendLevel(id) {
    const n = s.vis[id] || 0;
    let lv = 0;
    D.friendship.forEach((f, i) => { if (n >= f.need) lv = i; });
    return lv;
  }
  function friendProgress(id) {
    const n = s.vis[id] || 0, lv = friendLevel(id);
    const cur = D.friendship[lv], next = D.friendship[lv + 1];
    return { lv, n, next, frac: next ? (n - cur.need) / (next.need - cur.need) : 1 };
  }
  const visitorGift = (id) => D.wardrobe.find((w) => w.how.visitor === id);
  const orderReward = (id) => hoursOfIncome(0.15, 150 + tapValue() * 40) * (1 + C.friendshipBonus * (id ? friendLevel(id) : 0)) * (1 + 0.1 * sk('v2'));

  // Возвращает { reward, story, part, levelUp, gift }
  function serveVisitor(id) {
    const before = friendLevel(id);
    const storiesBefore = storiesUnlocked(id);
    const reward = orderReward(id);
    // «Тёплые слова»: иногда заказ засчитывается за два для дружбы
    const doubled = Math.random() < 0.15 * sk('v4');
    const n = (s.vis[id] || 0) + (doubled ? 2 : 1);
    s.vis[id] = n;
    s.served++;
    progress('visitors', 1);
    earn(reward);
    addXp(C.xp.order);
    // «Душа деревни»: иногда кристалл
    const crystal = Math.random() < 0.1 * sk('v5');
    if (crystal) s.cr++;
    const storiesAfter = storiesUnlocked(id);
    const part = storiesAfter > storiesBefore ? storiesAfter - 1 : -1;
    const v = findVisitor(id);
    const after = friendLevel(id);
    brewHook('order', { id, best: after === D.friendship.length - 1, story: part >= 0 });
    let levelUp = null, gift = null, egg = null;
    const giveGift = () => {
      const g = visitorGift(id);
      if (g && !s.own.acc.includes(g.id)) { s.own.acc.push(g.id); gift = g; }
      // у некоторых жителей вместо вещи - таинственное яйцо (один раз)
      if (!g && (D.visitorEggs || []).includes(id) && !(s.fr[id + '_egg']) && typeof Pets !== 'undefined') {
        s.fr[id + '_egg'] = 1; Pets.giveEgg('mystery'); egg = 'mystery';
      }
    };
    if (after > before && (s.fr[id] || 0) < after) {
      s.fr[id] = after;
      s.cr += C.crystals.friendship;
      levelUp = D.friendship[after];
      if (after === D.friendship.length - 1 && !(v && v.giftAt)) giveGift();
    }
    // у особых жителей подарок - за всю историю, а не за лучшую дружбу
    if (v && v.giftAt && n >= v.giftAt) giveGift();
    return { reward, story: part >= 0 && v ? v.story[part] : null, part, levelUp, gift, egg, doubled, crystal };
  }
  function storiesUnlocked(id) {
    const n = s.vis[id] || 0;
    return storyAtOf(id).filter((x) => n >= x).length;
  }
  const storiesComplete = () => D.visitors.filter((v) => storiesUnlocked(v.id) >= D.storyAt.length).length;
  const bestFriends = () => D.visitors.filter((v) => friendLevel(v.id) === D.friendship.length - 1).length;

  // ---------- гардероб ----------
  // { owned, reason (как открыть), price (кристаллы, если продаётся) }
  function itemState(item, kind) {
    const how = item.how || {};
    const list = kind === 'pot' ? s.own.pot : s.own.acc;
    if (how.free || list.includes(item.id)) return { owned: true };
    if (how.rank !== undefined) return rank() >= how.rank ? { owned: true } : { owned: false, reason: 'Ранг «' + D.ranks[how.rank].name + '»' };
    if (how.visitor) {
      const v = findVisitor(how.visitor);
      return { owned: false, reason: 'Подарок: ' + (v ? v.name : '') + (v && v.giftAt ? '' : ' (лучший друг)') };
    }
    if (how.ach) {
      const a = D.achievements.find((x) => x.id === how.ach);
      return s.ac.includes(how.ach) ? { owned: true } : { owned: false, reason: 'Достижение «' + (a ? a.name : '') + '»' };
    }
    if (how.best) return bestFriends() >= how.best ? { owned: true } : { owned: false, reason: 'Лучший друг в деревне' };
    if (how.event) {
      const e = D.eventDefs[how.event];
      return { owned: false, event: how.event, reason: '«' + (e ? e.name : '') + '»' };
    }
    if (how.cr) return { owned: false, price: how.cr };
    return { owned: false, reason: '' };
  }
  function buyItem(id, kind) {
    const list = kind === 'pot' ? D.potColors : D.wardrobe;
    const item = list.find((x) => x.id === id);
    if (!item) return false;
    const st = itemState(item, kind);
    if (st.owned || !st.price || s.cr < st.price) return false;
    s.cr -= st.price;
    (kind === 'pot' ? s.own.pot : s.own.acc).push(id);
    return true;
  }
  function equip(slot, id) {
    if (slot === 'pot') { s.wear.pot = id; return; }
    if (slot === 'liquid') { s.wear.liquid = id; return; }
    if (slot === 'stand') { s.wear.stand = id; return; }
    s.wear[slot] = s.wear[slot] === id ? '' : id;  // повторное нажатие снимает
  }
  function liquidColor() {
    const w = s.wear.liquid;
    if (w !== 'auto' && w <= rank()) return D.liquids[w];
    return D.liquids[rank() % D.liquids.length];
  }
  function potColorValue() {
    const c = D.potColors.find((x) => x.id === s.wear.pot);
    return c && itemState(c, 'pot').owned ? c.color : null;
  }
  const clean = (str, max) => String(str || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  function setCauldronName(n) { s.wear.name = clean(n, 16) || 'Бульк'; }

  // ---------- профиль ----------
  const avatarOwned = (a) => a.cr === 0 || s.own.av.includes(a.id);
  // выдать предмет навсегда (награды и покупки событий)
  function grant(kind, id) {
    const list = kind === 'av' ? s.own.av : kind === 'pot' ? s.own.pot : s.own.acc;
    if (!list.includes(id)) list.push(id);
  }
  function buyAvatar(id) {
    const a = D.avatars.find((x) => x.id === id);
    if (!a || avatarOwned(a) || s.cr < a.cr) return false;
    s.cr -= a.cr;
    s.own.av.push(id);
    return true;
  }
  function setAvatar(id) { s.prof.avatar = id; }
  function setName(n) { s.prof.name = clean(n, 20); }
  const titlesUnlocked = () => {
    const x = { rank: rank(), bestFriends: bestFriends() };
    return D.titles.filter((t) => t.test(s, x));
  };
  function setTitle(id) { if (titlesUnlocked().some((t) => t.id === id)) s.prof.title = id; }
  const titleName = () => (D.titles.find((t) => t.id === s.prof.title) || D.titles[0]).name;

  // ---------- статистика ----------
  function countDay() {
    const t = today();
    if (s.stat.lastDay !== t) { s.stat.lastDay = t; s.stat.days++; }
  }
  function statTick(dt) {
    s.stat.play += dt;
    const ph = basePerHour();
    if (ph > s.stat.maxPh) s.stat.maxPh = ph;
  }

  // ---------- пузырь ----------
  function bubbleCaught() { s.bb++; progress('bubbles', 1); addXp(C.xp.bubble); }

  // ---------- достижения ----------
  function checkAchievements() {
    const x = { perHour: basePerHour(), levels: derive().levels, rank: rank(), stories: storiesComplete() };
    const got = [];
    for (const a of D.achievements) {
      if (!s.ac.includes(a.id) && a.test(s, x)) { s.ac.push(a.id); got.push(a); s.cr += C.crystals.achievement; }
    }
    return got;
  }

  // Число для рейтинга друзей
  const mastery = () => Math.floor(Math.log10(s.le + 1) * 100) + derive().levels;

  return {
    get s() { return s; },
    hooks, load, serialize, reset, secToMidnight, rngFrom,
    rank, rankProgress, checkRankUp,
    level, cardIncome, cardCost, cardNextGain, cardLock, lockText, buyCard, card: (id) => CARD[id],
    scoopCost, buyScoop, pantryHours, pantryNext, buyPantry,
    perHour, basePerHour, tapValue, hoursOfIncome, earn, tick, tap, offlineEarnings,
    addEffect, effectLeft, activeEffects, addWind, canWind,
    canInvite, claimInvite, claimWelcome,
    dailyState, dailyAmount, claimDaily,
    ensureQuests, progress, questReward, claimQuest, claimableQuests, questTemplate: (id) => QT[id],
    recipeState, recipeSecret, recipeReward, guessRecipe,
    runeState, runeOfDay, runeReward, completeRune,
    orderReward, serveVisitor, storiesUnlocked, friendLevel, friendProgress, visitorGift, bestFriends,
    itemState, buyItem, equip, liquidColor, potColorValue, setCauldronName,
    avatarOwned, buyAvatar, setAvatar, setName, titlesUnlocked, setTitle, titleName,
    countDay, statTick, addCrystals: (n) => { s.cr += n; }, setGlobalMul, globalMul, setCovenMul,
    findVisitor, storyAtOf, grant, today,
    skill: sk, skillSpent, skillPoints, xpToNext, addXp, learnSkill, resetSkills, recipeAttempts,
    wasCrit: () => lastCrit, potion,
    bubbleCaught, checkAchievements, mastery, levels: () => derive().levels
  };
})();

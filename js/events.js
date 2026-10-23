// =====================================================================
//  События по календарю. Событие включается и выключается само по дате
//  на телефоне игрока - обновлять игру не нужно.
//  Новое событие: добавь запись в DATA.calendar и описание в DATA.eventDefs.
// =====================================================================

// ---------- Календарь (месяц-день, включительно) ----------
DATA.calendar = [
  { def: 'halloween', from: '10-25', to: '11-03' }
  // { def: 'newyear', from: '12-25', to: '01-07' }  - когда будут готовы картинки
];

// ---------- «Ночь тыкв» ----------
DATA.eventDefs = {
  halloween: {
    name: 'Ночь тыкв',
    currency: { forms: ['конфета', 'конфеты', 'конфет'], img: 'events/halloween/candy' },
    icon: 'events/halloween/candy_bucket',
    bg: 'r2/room',         // та же комната, украшения события - в DATA.room
    liquid: '#FF9A3D',                // зелье «по рангу» на время события становится тыквенным
    ambient: 'events/halloween/bat',  // летучие мыши над котлом
    lantern: 'events/halloween/lantern_pumpkin',
    lanternEvery: [16, 32],           // тыквенный фонарь появляется раз в 16-32 с
    lanternLife: 9,
    lanternCandy: [3, 6],
    tapEvery: 40,                     // каждые 40 помешиваний - 1 конфета
    orderCandy: 4,                    // за любой выполненный заказ
    visitor: 'tishka',
    visitorChance: 0.35,
    exchange: 10,                     // после события: 10 конфет = 1 кристалл
    // лента наград: считается по всем собранным конфетам
    milestones: [
      { at: 50,   cr: 5 },
      { at: 150,  hours: 2 },
      { at: 300,  av: 'h01' },
      { at: 600,  cr: 15 },
      { at: 1000, acc: 'hw_pumpkin_crown' }
    ],
    // тыквенная лавка: купленное остаётся навсегда
    shop: [
      { kind: 'acc', id: 'hw_bat_wings',    price: 120 },
      { kind: 'acc', id: 'hw_mask',         price: 120 },
      { kind: 'acc', id: 'hw_candy_beanie', price: 150 },
      { kind: 'av',  id: 'h02',             price: 180 },
      { kind: 'pot', id: 'pumpkin',         price: 160 },
      { kind: 'acc', id: 'hw_ghost_hood',   price: 220 }
    ],
    // задания события: каждый день 3 из списка
    quests: [
      { type: 'taps',     amounts: [300, 500], reward: [15, 25], text: (n) => 'Помешай зелье ' + n + ' раз' },
      { type: 'lanterns', amounts: [5, 10],    reward: [15, 25], text: (n) => 'Собери ' + n + ' ' + Fmt.plural(n, ['тыквенный фонарь', 'тыквенных фонаря', 'тыквенных фонарей']) },
      { type: 'orders',   amounts: [2, 3],     reward: [20, 30], text: (n) => 'Выполни ' + n + ' ' + Fmt.plural(n, ['заказ', 'заказа', 'заказов']) },
      { type: 'tishka',   amounts: [1],        reward: [25],     text: () => 'Помоги призраку Тишке' },
      { type: 'candy',    amounts: [60, 100],  reward: [15, 20], text: (n) => 'Собери ' + n + ' конфет' }
    ],
    phrases: ['Бу! Ой, это я так, для настроения', 'Тыквы светятся! Лови их скорее', 'Какая луна сегодня…', 'Конфет много не бывает']
  }
};

// ---------- Особый житель события ----------
DATA.eventVisitors = [
  {
    id: 'tishka', event: 'halloween', name: 'Призрак Тишка',
    char: 'tishka', img: 'chars/tishka_wait', imgHappy: 'chars/tishka_happy',
    bio: 'Маленький робкий призрак. Живёт на чердаке мельницы и, как ни странно, боится темноты.',
    asks: [
      'Можно зелье, чтобы светиться? Совсем чуть-чуть, а то темно',
      'Мне бы храбрости. Сова опять ухнула, и я спрятался в тыкву',
      'Свари что-нибудь тёплое. Призраки тоже мёрзнут!',
      'Хочу, чтобы меня видели. Хоть иногда'
    ],
    // история открывается за 1-й, 3-й и 5-й заказ, на 5-м - подарок
    storyAt: [1, 3, 5],
    giftAt: 5,
    story: [
      'Привет… Ты меня видишь? Обычно все пугаются и убегают. А я сам всех боюсь.',
      'Я раньше прятался на чердаке мельницы. Тихон думал, что это мыши шуршат. Это был я. Извините, мыши.',
      'Варя нарисовала мне шляпу ведьмы. Говорит, в ней я самый смелый. Держи такую же для своего котла - пусть он тоже будет смелым!'
    ]
  }
];

// ---------- Предметы события ----------
DATA.wardrobe.push(
  { id: 'hw_witch_hat',     slot: 'head', name: 'Шляпа тыквенной ведьмы', how: { visitor: 'tishka' },     w: 0.66 },
  { id: 'hw_pumpkin_crown', slot: 'head', name: 'Тыквенная корона',       how: { event: 'halloween' },    w: 0.48 },
  { id: 'hw_bat_wings',     slot: 'head', name: 'Крылышки летучей мыши',  how: { event: 'halloween' },    w: 0.86, dy: 0.5, rot: 0 },
  { id: 'hw_mask',          slot: 'face', name: 'Карнавальная маска',     how: { event: 'halloween' },    w: 1.05 },
  { id: 'hw_candy_beanie',  slot: 'head', name: 'Конфетная шапка',        how: { event: 'halloween' },    w: 0.5 },
  { id: 'hw_ghost_hood',    slot: 'head', name: 'Костюм привидения',      how: { event: 'halloween' },    w: 0.56 }
);
DATA.avatars.push(
  { id: 'h01', img: 'avatars/h01', event: 'halloween' },
  { id: 'h02', img: 'avatars/h02', event: 'halloween' }
);
DATA.potColors.push({ id: 'pumpkin', name: 'Тыквенный', color: '#F07A2E', how: { event: 'halloween' } });
DATA.titles.push({ id: 'pumpkin_king', name: 'Тыквенный король', test: (s) => s.own.acc.includes('hw_pumpkin_crown') });

// =====================================================================
//  Логика событий
// =====================================================================
const Events = (() => {
  const D = DATA;
  const S = () => Econ.s;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  let cur = null;          // { key, id, def, end }
  let lanternIn = 8, lanternEl = null, lanternT = 0;

  // ---------- календарь ----------
  function md(d) { return (d.getMonth() + 1) * 100 + d.getDate(); }
  function parse(str) { const [m, d] = str.split('-').map(Number); return m * 100 + d; }

  function find(now) {
    const t = md(now);
    for (const c of D.calendar) {
      const a = parse(c.from), b = parse(c.to);
      const inside = a <= b ? t >= a && t <= b : t >= a || t <= b; // через Новый год
      if (!inside) continue;
      const startYear = a <= b || t >= a ? now.getFullYear() : now.getFullYear() - 1;
      const endYear = a <= b ? startYear : startYear + 1;
      const end = new Date(endYear, Math.floor(b / 100) - 1, b % 100 + 1, 0, 0, 0);
      return { key: c.def + '-' + startYear, id: c.def, def: D.eventDefs[c.def], end };
    }
    return null;
  }

  // Включает и выключает событие. Возвращает итог закончившегося события, если он есть.
  function check() {
    const s = S();
    cur = find(new Date(Date.now()));
    let finished = null;
    if (s.ev && (!cur || s.ev.id !== cur.key) && !s.evDone.includes(s.ev.id)) finished = finish();
    if (cur && (!s.ev || s.ev.id !== cur.key) && !s.evDone.includes(cur.key)) {
      s.ev = { id: cur.key, candy: 0, total: 0, got: [], tapAcc: 0, q: null };
    }
    if (cur && s.ev && s.ev.id === cur.key) ensureQuests();
    return finished;
  }

  function finish() {
    const s = S();
    const ev = s.ev;
    const def = D.eventDefs[ev.id.split('-')[0]];
    const crystals = Math.floor(ev.candy / ((def && def.exchange) || 10));
    s.cr += crystals;
    s.evDone.push(ev.id);
    s.ev = null;
    return { name: def ? def.name : 'Событие', candy: ev.candy, crystals };
  }

  const active = (id) => !!cur && S().ev && S().ev.id === cur.key && (!id || cur.id === id);
  const def = () => (cur ? cur.def : null);
  const candyWord = (n) => Fmt.plural(n, cur ? cur.def.currency.forms : ['конфета', 'конфеты', 'конфет']);

  // ---------- конфеты ----------
  function addCandy(n) {
    if (!active() || n <= 0) return 0;
    const ev = S().ev;
    ev.candy += n;
    ev.total += n;
    progress('candy', n);
    return n;
  }

  function spend(n) {
    const ev = S().ev;
    if (!active() || ev.candy < n) return false;
    ev.candy -= n;
    return true;
  }

  const claimable = () => (active() ? cur.def.milestones.filter((m, i) => S().ev.total >= m.at && !S().ev.got.includes(i)).length : 0);

  function claimMilestone(i) {
    const ev = S().ev, m = cur.def.milestones[i];
    if (!m || ev.total < m.at || ev.got.includes(i)) return null;
    ev.got.push(i);
    if (m.cr) Econ.addCrystals(m.cr);
    if (m.hours) Econ.earn(Econ.hoursOfIncome(m.hours, 2000));
    if (m.av) Econ.grant('av', m.av);
    if (m.acc) Econ.grant('acc', m.acc);
    return m;
  }

  function rewardText(m) {
    if (m.cr) return '+' + m.cr + ' ' + UI.crystalsWord(m.cr);
    if (m.hours) return 'Доход за ' + m.hours + ' ч';
    if (m.av) return 'Праздничный аватар';
    if (m.acc) return (D.wardrobe.find((w) => w.id === m.acc) || {}).name || 'Украшение';
    return '';
  }
  function rewardImg(m) {
    if (m.cr) return m.cr >= 10 ? 'ui/crystal_pouch' : 'ui/crystal_pile';
    if (m.hours) return 'ui/essence';
    if (m.av) return 'avatars/' + m.av;
    if (m.acc) { const w = D.wardrobe.find((x) => x.id === m.acc); return w && w.img ? w.img : 'wardrobe/' + m.acc; }
    return 'ui/gift';
  }

  // ---------- лавка события ----------
  function shopItem(it) {
    if (it.kind === 'acc') { const w = D.wardrobe.find((x) => x.id === it.id); return { name: w.name, img: w.img || 'wardrobe/' + it.id, owned: S().own.acc.includes(it.id) }; }
    if (it.kind === 'av') return { name: 'Аватар', img: 'avatars/' + it.id, owned: S().own.av.includes(it.id) };
    const pc = D.potColors.find((x) => x.id === it.id);
    return { name: pc.name + ' котёл', swatch: pc.color, owned: S().own.pot.includes(it.id) };
  }
  function buy(it) {
    if (shopItem(it).owned || !spend(it.price)) return false;
    Econ.grant(it.kind, it.id);
    return true;
  }

  // ---------- задания события ----------
  function ensureQuests() {
    const ev = S().ev, d = Econ.today();
    if (ev.q && ev.q.d === d) return;
    const rng = Econ.rngFrom(ev.id + ':' + d);
    const pool = cur.def.quests.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    ev.q = { d, l: pool.slice(0, 3).map((t) => {
      const k = Math.floor(rng() * t.amounts.length);
      return { t: t.type, n: t.amounts[k], p: 0, c: 0, r: t.reward[Math.min(k, t.reward.length - 1)] };
    }) };
  }
  function progress(type, n) {
    if (!active()) return;
    const ev = S().ev;
    if (!ev.q) return;
    ev.q.l.forEach((q) => {
      if (q.t !== type || q.c) return;
      q.p = Math.min(q.n, q.p + n);
      if (q.p >= q.n) { q.c = 1; UI.toast('Задание события выполнено! Награда ждёт'); }
    });
  }
  function claimQuest(i) {
    const q = S().ev.q.l[i];
    if (!q || q.c !== 1) return 0;
    q.c = 2;
    // награда конфетами не считается в задание «собери конфеты» - нет бесконечной петли
    S().ev.candy += q.r; S().ev.total += q.r;
    return q.r;
  }
  const questTemplate = (type) => cur.def.quests.find((q) => q.type === type);
  const claimableQuests = () => (active() && S().ev.q ? S().ev.q.l.filter((q) => q.c === 1).length : 0);

  // ---------- игровые хуки ----------
  function onTap() {
    if (!active()) return;
    const ev = S().ev;
    progress('taps', 1);
    if (++ev.tapAcc >= cur.def.tapEvery) {
      ev.tapAcc = 0;
      addCandy(1);
      const c = Cauldron.center();
      Cauldron.floatText(c.x + rand(-40, 40), c.y - 60, '+1 ' + candyWord(1), '#FFB25E', 18);
    }
  }
  // Возвращает число конфет за заказ
  function onServe(id) {
    if (!active()) return 0;
    progress('orders', 1);
    if (id === cur.def.visitor) progress('tishka', 1);
    return addCandy(cur.def.orderCandy * (id === cur.def.visitor ? 2 : 1));
  }
  // Особый житель приходит чаще, пока история не рассказана
  function pickVisitor() {
    if (!active() || !cur.def.visitor) return null;
    const v = D.eventVisitors.find((x) => x.id === cur.def.visitor);
    const done = Econ.storiesUnlocked(v.id) >= v.storyAt.length;
    return Math.random() < (done ? cur.def.visitorChance / 2 : cur.def.visitorChance) ? v : null;
  }

  // ---------- тыквенные фонари ----------
  function spawnLantern() {
    const stage = document.getElementById('stage');
    if (!stage || lanternEl) return;
    const b = UI.h('button', { class: 'lantern', type: 'button', 'aria-label': 'Тыквенный фонарь' }, UI.pic(cur.def.lantern));
    b.style.left = rand(8, 74) + '%';
    b.style.top = rand(14, 52) + '%';
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!e.isTrusted || !lanternEl) return;
      const n = addCandy(randi(cur.def.lanternCandy[0], cur.def.lanternCandy[1]));
      progress('lanterns', 1);
      Econ.addXp(CONFIG.xp.lantern);
      Sound.pop();
      const rs = stage.getBoundingClientRect(), rb = b.getBoundingClientRect();
      Cauldron.floatText(rb.left - rs.left + rb.width / 2, rb.top - rs.top, '+' + n + ' ' + candyWord(n), '#FFB25E', 22);
      removeLantern(true);
      if (window.Game) Game.save();
    });
    stage.append(b);
    lanternEl = b;
    lanternT = cur.def.lanternLife;
  }
  function removeLantern(popped) {
    if (!lanternEl) return;
    const el = lanternEl;
    lanternEl = null;
    el.classList.add(popped ? 'pop' : 'fade');
    setTimeout(() => el.remove(), 300);
  }

  let qT = 0;
  function update(dt, paused) {
    qT += dt;
    if (qT > 20) { qT = 0; const f = check(); if (f) finishedModal(f); if (typeof UI !== 'undefined') UI.applyLook(Cauldron); }
    if (!active()) { if (lanternEl) removeLantern(false); return; }
    if (lanternEl) { lanternT -= dt; if (lanternT <= 0) removeLantern(false); }
    if (paused) return;
    lanternIn -= dt;
    if (lanternIn <= 0) { spawnLantern(); lanternIn = rand(cur.def.lanternEvery[0], cur.def.lanternEvery[1]); }
  }

  // ---------- интерфейс события ----------
  const h = (...a) => UI.h(...a);
  const candyPrice = (n) => h('span', { class: 'cr-price candy' }, UI.pic(cur.def.currency.img, 'cr-ico'), n);

  function refreshButton() {
    const btn = document.getElementById('event-btn');
    if (!btn) return;
    const on = active();
    btn.hidden = !on;
    if (!on) return;
    UI.setText(btn.querySelector('b'), S().ev.candy);
    btn.querySelector('.dot').hidden = !(claimable() + claimableQuests());
  }

  function timeLeft() {
    const sec = (cur.end - Date.now()) / 1000;
    const d = Math.floor(sec / 86400);
    return d >= 1 ? d + ' ' + Fmt.plural(d, ['день', 'дня', 'дней']) + ' ' + Math.floor((sec % 86400) / 3600) + ' ч' : Fmt.time(sec);
  }

  let tab = 'rewards';
  function openSheet(startTab) {
    if (!active()) return;
    if (startTab) tab = startTab;
    const body = h('div', { class: 'event' });
    const draw = () => UI.keepSeg(body, drawInner);
    const drawInner = () => {
      body.innerHTML = '';
      const ev = S().ev, d = cur.def;
      const top = h('div', { class: 'sheet-top' });
      body.append(top);
      top.append(h('div', { class: 'ev-head' },
        UI.pic(d.icon, 'ev-icon'),
        h('div', { class: 'ev-head-text' },
          h('b', null, d.name),
          h('small', null, 'До конца: ' + timeLeft())),
        h('div', { class: 'ev-candy' }, UI.pic(d.currency.img, 'cr-ico'), h('b', null, ev.candy))));
      const tabs = [['rewards', 'Награды', claimable()], ['shop', 'Лавка', 0], ['quests', 'Задания', claimableQuests()], ['tishka', 'Тишка', 0]];
      top.append(h('div', { class: 'seg' }, tabs.map(([id, l, n]) => {
        const b = h('button', { type: 'button', class: 'seg-btn' + (tab === id ? ' on' : '') }, l, n ? h('span', { class: 'seg-badge' }, n) : null);
        b.addEventListener('click', () => { tab = id; Sound.tap(); draw(); });
        return b;
      })));
      if (tab === 'rewards') drawRewards(body, draw);
      else if (tab === 'shop') drawShop(body, draw);
      else if (tab === 'quests') drawQuests(body, draw);
      else drawTishka(body);
    };
    draw();
    UI.modal({ sheet: true, title: '', body, onOpen: (box) => box.classList.add('fixed-h') });
  }

  function drawRewards(box, redraw) {
    const ev = S().ev, ms = cur.def.milestones;
    const max = ms[ms.length - 1].at;
    box.append(h('p', { class: 'small' }, 'Собирай конфеты: тыквенные фонари в лавке, заказы, помешивание и задания события. Всего собрано: ' + ev.total + ' из ' + max + '.'));
    box.append(h('div', { class: 'bar ev-bar' }, h('i', { style: 'width:' + Math.min(100, ev.total / max * 100) + '%' })));
    box.append(h('div', { class: 'ev-list' }, ms.map((m, i) => {
      const done = ev.got.includes(i), ready = !done && ev.total >= m.at;
      const btn = ready ? h('button', { class: 'pill-btn', type: 'button' }, 'Забрать')
        : h('span', { class: 'ev-state' }, done ? UI.pic('hud/check', 'ok-ico') : candyPrice(m.at));
      if (ready) btn.addEventListener('click', () => {
        const r = claimMilestone(i);
        if (!r) return;
        Sound.fanfare();
        UI.toast('Награда: ' + rewardText(r));
        if (window.Game) Game.save();
        redraw(); UI.refresh();
      });
      return h('div', { class: 'ev-row' + (done ? ' done' : '') }, UI.pic(rewardImg(m), 'ev-row-ico' + (m.av ? ' round' : '')),
        h('div', { class: 'ev-row-text' }, h('b', null, rewardText(m)), h('small', null, m.at + ' ' + candyWord(m.at))), btn);
    })));
    box.append(h('p', { class: 'note left' }, 'После события оставшиеся конфеты превратятся в кристаллы: ' + cur.def.exchange + ' конфет = 1 кристалл. Всё полученное остаётся навсегда.'));
  }

  function drawShop(box, redraw) {
    const ev = S().ev;
    box.append(h('p', { class: 'small' }, 'Праздничные вещи продаются только во время события и остаются твоими навсегда.'));
    box.append(h('div', { class: 'ward-grid' }, cur.def.shop.map((it) => {
      const info = shopItem(it);
      const b = h('button', { class: 'ward-cell' + (info.owned ? ' on' : ''), type: 'button' },
        info.swatch ? h('span', { class: 'swatch', style: 'background:' + info.swatch }) : h('span', { class: 'ward-pic' + (it.kind === 'av' ? ' av' : '') }, UI.pic(info.img)),
        h('span', { class: 'ward-name' }, info.name),
        h('span', { class: 'ward-state' + (info.owned ? '' : ' buy') }, info.owned ? 'Твоё' : candyPrice(it.price)));
      b.addEventListener('click', () => {
        if (info.owned) { UI.toast(it.kind === 'av' ? 'Выбери аватар в профиле' : 'Надень в Гардеробе'); return; }
        if (ev.candy < it.price) { Sound.deny(); UI.toast('Не хватает конфет: нужно ' + it.price); return; }
        if (buy(it)) { Sound.coin(); UI.toast(info.name + ': теперь твоё!'); if (window.Game) Game.save(); redraw(); UI.refresh(); }
      });
      return b;
    })));
  }

  function drawQuests(box, redraw) {
    const ev = S().ev;
    box.append(h('p', { class: 'small' }, 'Каждый день - 3 новых задания события.'));
    ev.q.l.forEach((q, i) => {
      const t = questTemplate(q.t);
      const btn = q.c === 1 ? h('button', { class: 'pill-btn', type: 'button' }, 'Забрать')
        : h('span', { class: 'quest-state' }, q.c === 2 ? UI.pic('hud/check', 'ok-ico') : q.p + '/' + q.n);
      if (q.c === 1) btn.addEventListener('click', () => {
        const r = claimQuest(i);
        if (!r) return;
        Sound.coin(); UI.toast('+' + r + ' ' + candyWord(r));
        if (window.Game) Game.save();
        redraw(); UI.refresh();
      });
      box.append(h('div', { class: 'row-card' + (q.c === 2 ? ' done' : '') },
        h('div', { class: 'ico' }, UI.pic('events/halloween/scroll')),
        h('div', { class: 'info' }, h('div', { class: 'name' }, t.text(q.n)),
          h('div', { class: 'bar' }, h('i', { style: 'width:' + (100 * q.p / q.n) + '%' })),
          h('div', { class: 'meta ev-meta' }, 'Награда: ', candyPrice(q.r))),
        btn));
    });
  }

  function drawTishka(box) {
    const v = D.eventVisitors.find((x) => x.id === cur.def.visitor);
    const n = S().vis[v.id] || 0;
    const got = Econ.storiesUnlocked(v.id);
    box.append(h('div', { class: 'tishka' },
      h('div', { class: 'sheet-ico' }, UI.pic(got >= v.storyAt.length ? v.imgHappy : v.img)),
      h('p', { class: 'center' }, v.bio),
      n ? UI.friendBlock(v.id) : h('p', { class: 'small center' }, 'Тишка иногда заглядывает в лавку. Выполни его просьбу, и он расскажет о себе.'),
      got ? v.story.slice(0, got).map((t) => h('p', { class: 'story' }, '«' + t + '»')) : null,
      h('div', { class: 'gift-row' + (S().own.acc.includes('hw_witch_hat') ? ' big' : '') }, UI.pic('wardrobe/hw_witch_hat', 'gift-pic'),
        h('span', null, S().own.acc.includes('hw_witch_hat') ? 'Подарил: Шляпа тыквенной ведьмы' : 'Выполни ' + v.giftAt + ' просьб Тишки и получи шляпу тыквенной ведьмы (' + Math.min(n, v.giftAt) + '/' + v.giftAt + ')'))));
  }

  function finishedModal(f) {
    UI.modal({
      title: '«' + f.name + '» закончилась',
      body: h('div', null,
        h('div', { class: 'sheet-ico' }, UI.pic('ui/crystal_chest')),
        h('p', { class: 'center' }, f.candy
          ? 'Оставшиеся ' + f.candy + ' ' + Fmt.plural(f.candy, ['конфета', 'конфеты', 'конфет']) + ' превратились в ' + f.crystals + ' ' + UI.crystalsWord(f.crystals) + '.'
          : 'Спасибо, что праздновал с нами!'),
        h('p', { class: 'small center' }, 'Праздничные украшения, аватары и цвета остаются твоими навсегда.')),
      actions: [{ label: 'Спасибо!' }]
    });
  }

  // ---------- запуск ----------
  function init() {
    const f = check();
    const btn = document.getElementById('event-btn');
    if (btn) btn.addEventListener('click', () => { Sound.unlock(); Sound.tap(); openSheet(); });
    return f;
  }

  return {
    init, check, update, active, def, candyWord, addCandy,
    onTap, onServe, pickVisitor, refreshButton, openSheet, finishedModal,
    claimable, claimableQuests,
    bg: () => (active() ? cur.def.bg : 'r2/room'),
    liquid: () => (active() ? cur.def.liquid : null),
    ambient: () => (active() ? cur.def.ambient : null),
    phrase: () => (active() && Math.random() < 0.5 ? cur.def.phrases[Math.floor(Math.random() * cur.def.phrases.length)] : null)
  };
})();

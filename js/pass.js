// =====================================================================
//  0.31: «Звёздный гримуар» - сезонный пропуск. Ведёт звездочёт Орион.
//  * Сезон - 28 дней, одинаковый у всех (от даты EPOCH). 30 страниц, страница - 100 звёздных чернил.
//  * Чернила: задания гримуара (3 на день, 3 на неделю) и обычные дела в лавке
//    (зелья, жители, мини-игры, задания дня...). Ночью по часам лавки дела дают чернила ×2.
//  * Бесплатные страницы - всем, золотые - после покупки золотого гримуара за кристаллы.
//  * После 30-й страницы - бонусные: каждые 150 чернил ещё награда.
//  * Новый сезон: несобранные награды прошлого зачисляются сами.
//  * Вызов недели от Мадам Черниллы: она набирает очки всю неделю; обгони её итог - получишь сундук.
// =====================================================================

CONFIG.pass = {
  epoch: '2026-10-24', days: 28, pages: 30, perPage: 100, bonusEvery: 150,
  goldPrice: 150,
  // чернила за обычные дела в лавке
  ink: { brew: 5, games: 10, visitors: 5, recipe: 15, rune: 10, bubbles: 5, quest: 10, daily: 15 },
  tapInk: 50              // +1 чернила за каждые 50 тапов
};

// вещи гардероба - награды гримуара
DATA.wardrobe.push(
  { id: 'star_glasses', slot: 'face', name: 'Очки звездочёта', how: { pass: 1 }, w: 1.05 },
  { id: 'star_ladle', slot: 'spoon', name: 'Звёздный половник', how: { pass: 1 }, img: 'spoons/star' }
);
// титулы гримуара
DATA.titles.push(
  { id: 'stargazer', name: 'Звездочёт', test: (s) => Array.isArray(s.stat.ttl) && s.stat.ttl.includes('stargazer') },
  { id: 'grimoire', name: 'Хранитель гримуара', test: (s) => Array.isArray(s.stat.ttl) && s.stat.ttl.includes('grimoire') }
);

const Pass = (() => {
  const C = CONFIG.pass;
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const S = () => Econ.s;
  const save = () => { if (window.Game) Game.save(); };

  // ---------- страницы: награды ----------
  const F = [
    { k: 'ess', h: 1 }, { k: 'ing', n: 3 }, { k: 'cr', n: 3 }, { k: 'chest', c: 'w' }, { k: 'sh', n: 20 },
    { k: 'ess', h: 2 }, { k: 'ing', n: 4, rare: 0.3 }, { k: 'cr', n: 5 }, { k: 'fx', id: 'inspire', min: 10 }, { k: 'egg', t: 'mystery' },
    { k: 'ess', h: 3 }, { k: 'chest', c: 'w' }, { k: 'cr', n: 5 }, { k: 'sh', n: 30 }, { k: 'chest', c: 's' },
    { k: 'ess', h: 4 }, { k: 'ing', n: 5, rare: 0.3 }, { k: 'cr', n: 6 }, { k: 'scroll' }, { k: 'ward', id: 'star_ladle' },
    { k: 'ess', h: 5 }, { k: 'sh', n: 40 }, { k: 'cr', n: 8 }, { k: 'ing', n: 6, rare: 0.4 }, { k: 'chest', c: 'g' },
    { k: 'ess', h: 6 }, { k: 'cr', n: 10 }, { k: 'sh', n: 50 }, { k: 'ess', h: 8 }, [{ k: 'title', id: 'stargazer' }, { k: 'chest', c: 'g' }]
  ];
  const G = [
    { k: 'cr', n: 5 }, { k: 'chest', c: 'w' }, { k: 'ess', h: 2 }, { k: 'sh', n: 30 }, { k: 'chest', c: 's' },
    { k: 'cr', n: 8 }, { k: 'ing', n: 6, rare: 0.5 }, { k: 'fx', id: 'inspire', min: 20 }, { k: 'sh', n: 40 }, { k: 'chest', c: 'g' },
    { k: 'cr', n: 10 }, { k: 'ess', h: 5 }, { k: 'egg', t: 'dragon' }, { k: 'ing', n: 8, rare: 0.5 }, { k: 'chest', c: 'g' },
    { k: 'cr', n: 12 }, { k: 'sh', n: 60 }, { k: 'ess', h: 6 }, { k: 'chest', c: 's' }, { k: 'chest', c: 't' },
    { k: 'cr', n: 15 }, { k: 'ing', n: 10, rare: 0.6 }, { k: 'sh', n: 80 }, { k: 'ess', h: 8 }, { k: 'chest', c: 't' },
    { k: 'cr', n: 20 }, { k: 'egg', t: 'mystery' }, { k: 'sh', n: 100 }, { k: 'cr', n: 25 }, [{ k: 'ward', id: 'star_glasses' }, { k: 'title', id: 'grimoire' }, { k: 'chest', c: 't' }, { k: 'cr', n: 30 }]
  ];
  const BONUS = [{ k: 'chest', c: 'w' }, { k: 'ess', h: 1 }];
  const list = (x) => (Array.isArray(x) ? x : [x]);

  // ---------- задания ----------
  // type - что считаем (те же события, что у заданий дня), n - сколько, ink - награда
  const DAY = [
    { id: 'd_taps', type: 'taps', n: 500, ink: 40, text: (n) => 'Помешай котёл ' + n + ' раз', img: 'ui/ladle' },
    { id: 'd_brew', type: 'brew', n: 3, ink: 50, text: (n) => 'Свари ' + n + ' ' + Fmt.plural(n, ['зелье', 'зелья', 'зелий']), img: 'ui/flask' },
    { id: 'd_vis', type: 'visitors', n: 3, ink: 50, text: (n) => 'Выполни ' + n + ' ' + Fmt.plural(n, ['просьбу', 'просьбы', 'просьб']) + ' жителей', img: 'ui/hooded' },
    { id: 'd_games', type: 'games', n: 2, ink: 50, text: (n) => 'Сыграй в мини-игры ' + n + ' раза', img: 'r2/ic_games' },
    { id: 'd_bub', type: 'bubbles', n: 2, ink: 40, text: (n) => 'Поймай ' + n + ' золотых пузыря', img: 'ui/sparkle' },
    { id: 'd_rec', type: 'recipe', n: 1, ink: 45, text: () => 'Разгадай рецепт дня', img: 'r2/ic_recipe' },
    { id: 'd_rune', type: 'rune', n: 1, ink: 40, text: () => 'Начерти руну дня', img: 'r2/ic_rune' },
    { id: 'd_lvl', type: 'levels', n: 5, ink: 40, text: (n) => 'Улучши карточки лавки ' + n + ' раз', img: 'r2/tab_shop' },
    { id: 'd_quest', type: 'quest', n: 3, ink: 60, text: (n) => 'Выполни ' + n + ' задания дня', img: 'ui/checklist' }
  ];
  const WEEK = [
    { id: 'w_taps', type: 'taps', n: 5000, ink: 150, text: (n) => 'Помешай котёл ' + Fmt.num(n) + ' раз', img: 'ui/ladle' },
    { id: 'w_brew', type: 'brew', n: 15, ink: 200, text: (n) => 'Свари ' + n + ' зелий', img: 'ui/flask' },
    { id: 'w_vis', type: 'visitors', n: 15, ink: 200, text: (n) => 'Выполни ' + n + ' просьб жителей', img: 'ui/hooded' },
    { id: 'w_games', type: 'games', n: 10, ink: 200, text: (n) => 'Сыграй в мини-игры ' + n + ' раз', img: 'r2/ic_games' },
    { id: 'w_quest', type: 'quest', n: 15, ink: 200, text: (n) => 'Выполни ' + n + ' заданий дня', img: 'ui/checklist' },
    { id: 'w_lvl', type: 'levels', n: 30, ink: 150, text: (n) => 'Улучши карточки лавки ' + n + ' раз', img: 'r2/tab_shop' }
  ];
  // вызов Черниллы: что она считает и сколько наберёт к концу недели
  const RIVAL = [
    { type: 'brew', n: 20, what: 'зелий', text: 'Сварю за неделю 20 зелий. А ты?' },
    { type: 'visitors', n: 20, what: 'просьб жителей', text: 'Двадцать жителей придут ко мне, а не к тебе!' },
    { type: 'games', n: 12, what: 'мини-игр', text: 'В мини-игры я играю лучше всех. Двенадцать партий за неделю!' },
    { type: 'taps', n: 8000, what: 'помешиваний', text: 'Мой котёл помешан восемь тысяч раз. Слабо?' }
  ];
  const RIVAL_PRIZE = [{ k: 'chest', c: 'g' }, { k: 'cr', n: 10 }];
  const RIVAL_INK = 250;

  // ---------- даты сезона ----------
  const dayNum = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
  const sinceEpoch = () => Math.max(0, dayNum(Econ.today()) - dayNum(C.epoch));
  const seasonId = () => Math.floor(sinceEpoch() / C.days) + 1;
  const seasonDay = () => sinceEpoch() % C.days;          // 0..27
  const daysLeft = () => C.days - seasonDay();
  const weekKey = () => seasonId() + ':' + Math.floor(seasonDay() / 7);
  const weekDaysLeft = () => 7 - (seasonDay() % 7);
  // доля прошедшей недели (для очков Черниллы)
  function weekFrac() {
    const n = new Date(Date.now()), m = new Date(n); m.setHours(0, 0, 0, 0);
    return Math.min(1, ((seasonDay() % 7) + (n - m) / 864e5) / 7);
  }

  function pickTasks(pool, seed, n) {
    const rng = Econ.rngFrom(seed), p = pool.slice();
    for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    return p.slice(0, n).map((t) => ({ id: t.id, p: 0, c: 0 }));
  }

  // состояние сезона в сохранении: s.bp
  function st() {
    const s = S();
    let b = s.bp;
    if (!b || typeof b !== 'object') b = s.bp = {};
    const sid = seasonId();
    if (b.sid !== sid) {
      // новый сезон: несобранное из прошлого - сразу игроку
      const was = b.sid ? collectAll(b) : [];
      s.bp = b = { sid, ink: 0, fc: [], gc: [], gold: false, bonus: 0, taps: 0 };
      if (was.length) setTimeout(() => UI.toast('Награды прошлого сезона гримуара зачислены: ' + was.length), 1500);
    }
    if (b.d !== Econ.today()) { b.d = Econ.today(); b.dt = pickTasks(DAY, 'bulk:bp:d:' + b.d, 3); }
    const wk = weekKey();
    if (b.w !== wk) {
      b.w = wk; b.wt = pickTasks(WEEK, 'bulk:bp:w:' + wk, 3);
      const r = RIVAL[Math.floor(Econ.rngFrom('bulk:rival:' + wk)() * RIVAL.length)];
      b.rv = { type: r.type, p: 0, c: 0 };
    }
    return b;
  }
  // всё, что игрок открыл, но не забрал (при смене сезона)
  function collectAll(b) {
    const got = [];
    const pg = Math.min(C.pages, Math.floor((b.ink || 0) / C.perPage));
    for (let i = 0; i < pg; i++) {
      if (!(b.fc || []).includes(i)) list(F[i]).forEach((g) => got.push(Gifts.give(g)));
      if (b.gold && !(b.gc || []).includes(i)) list(G[i]).forEach((g) => got.push(Gifts.give(g)));
    }
    return got;
  }

  const page = () => Math.min(C.pages, Math.floor(st().ink / C.perPage));      // сколько страниц открыто
  const bonusReady = () => { const b = st(); return b.ink < C.pages * C.perPage ? 0 : Math.max(0, Math.floor((b.ink - C.pages * C.perPage) / C.bonusEvery) - b.bonus); };
  function claimable() {
    const b = st(), pg = page();
    let n = 0;
    for (let i = 0; i < pg; i++) { if (!b.fc.includes(i)) n++; if (b.gold && !b.gc.includes(i)) n++; }
    n += bonusReady();
    n += b.dt.filter((t) => t.c === 1).length + b.wt.filter((t) => t.c === 1).length;
    if (b.rv && b.rv.c === 1) n++;
    return n;
  }

  // ---------- чернила ----------
  const night = () => typeof TimeDay !== 'undefined' && TimeDay.isNight();
  function addInk(n, fromDeeds) {
    if (!(n > 0)) return 0;
    const b = st(), before = page();
    const v = fromDeeds && night() ? n * 2 : n;
    b.ink += v;
    // 0.33: те же чернила - очки лиги недели (tops.js)
    const lg = S().lg || (S().lg = {});
    lg.pts = (lg.pts || 0) + v;
    if (page() > before) {
      setTimeout(() => { UI.toast('Звёздный гримуар: открыта страница ' + page() + '!'); Sound.fanfare(); refreshButton(); }, 200);
    }
    return v;
  }
  // каждое дело в лавке (Econ.hooks.progress)
  function onProgress(type, amt) {
    const b = st();
    if (type === 'taps') { b.taps = (b.taps || 0) + amt; while (b.taps >= C.tapInk) { b.taps -= C.tapInk; addInk(1, true); } }
    else if (C.ink[type]) addInk(C.ink[type] * amt, true);
    const step = (t, def) => {
      if (!def || def.type !== type || t.c !== 0) return;
      t.p = Math.min(def.n, t.p + amt);
      if (t.p >= def.n) { t.c = 1; refreshButton(); }
    };
    b.dt.forEach((t) => step(t, DAY.find((x) => x.id === t.id)));
    b.wt.forEach((t) => step(t, WEEK.find((x) => x.id === t.id)));
    if (b.rv && b.rv.type === type && b.rv.c === 0) {
      const R = RIVAL.find((x) => x.type === type);
      b.rv.p = Math.min(R.n, b.rv.p + amt);
      if (b.rv.p >= R.n) { b.rv.c = 1; refreshButton(); }
    }
  }

  // ---------- получение наград ----------
  function claimPage(i, gold) {
    const b = st();
    const arr = gold ? b.gc : b.fc;
    if (i >= page() || arr.includes(i) || (gold && !b.gold)) return null;
    arr.push(i);
    const got = list(gold ? G[i] : F[i]).map((g) => Gifts.give(g));
    save(); refreshButton();
    return got;
  }
  function claimBonus() {
    if (!bonusReady()) return null;
    st().bonus++;
    const got = BONUS.map((g) => Gifts.give(g));
    save(); refreshButton();
    return got;
  }
  function claimTask(kind, i) {
    const b = st(), t = (kind === 'w' ? b.wt : b.dt)[i];
    if (!t || t.c !== 1) return 0;
    t.c = 2;
    const def = (kind === 'w' ? WEEK : DAY).find((x) => x.id === t.id);
    const v = addInk(def.ink, false);
    save(); refreshButton();
    return v;
  }
  function claimRival() {
    const b = st();
    if (!b.rv || b.rv.c !== 1) return null;
    b.rv.c = 2;
    const got = RIVAL_PRIZE.map((g) => Gifts.give(g));
    got.push('+' + addInk(RIVAL_INK, false) + ' чернил');
    save(); refreshButton();
    return got;
  }
  function buyGold() {
    const s = S(), b = st();
    if (b.gold || s.cr < C.goldPrice) return false;
    s.cr -= C.goldPrice; b.gold = true;
    save(); refreshButton();
    return true;
  }

  // ---------- окно ----------
  let tab = 'pages';
  const ORION = ['Звёзды сегодня ясные. Самое время писать в гримуар.', 'Каждое доброе дело в лавке - капля звёздных чернил.', 'Ночью чернила льются вдвое щедрее. Я проверял.',
    'Не забывай про задания: за них чернил больше всего.', 'Говорят, Чернилла опять хвастается. Покажи ей!'];
  function open(startTab) {
    if (startTab) tab = startTab;
    st();
    const body = h('div', { class: 'brew pass' });
    const draw = () => UI.keepSeg(body, () => drawInner(body, draw));
    draw();
    UI.modal({ sheet: true, title: '', cls: 'pass-modal', body, onClose: refreshButton, onOpen: (box) => box.classList.add('fixed-h') });
  }
  function drawInner(body, redraw) {
    body.innerHTML = '';
    const b = st(), pg = page();
    const top = h('div', { class: 'sheet-top' });
    body.append(top);
    const inPage = pg >= C.pages ? (b.ink - C.pages * C.perPage) % C.bonusEvery : b.ink % C.perPage;
    const need = pg >= C.pages ? C.bonusEvery : C.perPage;
    top.append(h('div', { class: 'brew-head pass-head' }, pic('pass/book', 'pass-book'),
      h('div', { class: 'brew-head-text' }, h('b', null, 'Звёздный гримуар'),
        h('small', null, 'Сезон ' + b.sid + ' · ещё ' + daysLeft() + ' ' + Fmt.plural(daysLeft(), ['день', 'дня', 'дней'])),
        h('div', { class: 'pass-prog' }, pic('pass/ink', 'pass-ink'), h('span', { class: 'pass-pg' }, pg >= C.pages ? '★' : String(pg + 1)),
          h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(100 * inPage / need) + '%' })),
          h('small', null, inPage + '/' + need)))));
    const nTasks = b.dt.filter((t) => t.c === 1).length + b.wt.filter((t) => t.c === 1).length + (b.rv && b.rv.c === 1 ? 1 : 0);
    const nPages = claimable() - nTasks;
    const tabs = [['pages', 'Страницы', nPages], ['tasks', 'Задания', nTasks]];
    top.append(h('div', { class: 'seg' }, tabs.map(([id, l, n]) => {
      const bt = h('button', { type: 'button', class: 'seg-btn' + (tab === id ? ' on' : '') }, l, n ? h('span', { class: 'seg-badge' }, n > 9 ? '9+' : n) : null);
      bt.addEventListener('click', () => { tab = id; Sound.tap(); redraw(); body.scrollTop = 0; });
      return bt;
    })));
    if (tab === 'tasks') drawTasks(body, redraw); else drawPages(body, redraw);
  }
  const showGot = (got) => { if (got && got.length) { Sound.coin(); UI.toast(got.join(', ')); } };

  function drawPages(body, redraw) {
    const b = st(), pg = page(), s = S();
    body.append(h('p', { class: 'pass-say' }, pic('chars/orion_happy', 'pass-say-ico'), h('span', null, ORION[(new Date().getDate() + b.sid) % ORION.length])));
    if (!b.gold) {
      const btn = h('button', { type: 'button', class: 'btn pass-gold-btn', disabled: s.cr < C.goldPrice }, 'Открыть за ', pic('ui/crystal', 'btn-ico'), ' ' + C.goldPrice);
      btn.addEventListener('click', () => {
        if (s.cr < C.goldPrice) { Sound.deny(); UI.toast('Не хватает кристаллов'); return; }
        // 0.33.5: вопрос поверх гримуара (раньше окно вставало в очередь и показывалось только после закрытия гримуара)
        Sound.tap();
        UI.confirmBuy({ pic: pic('pass/book', ''), name: 'Открыть Золотой гримуар?', price: C.goldPrice,
          text: 'Золотые страницы до конца сезона. Награды уже открытых страниц можно забрать сразу.',
          onYes: () => { if (buyGold()) { Sound.fanfare(); UI.toast('Золотой гримуар открыт!'); UI.refresh(); redraw(); } } });
      });
      body.append(h('div', { class: 'pass-gold' }, h('div', null, h('b', null, 'Золотой гримуар'), h('small', null, 'Вторая дорожка наград: 125 кристаллов, звёздные и золотые сундуки, яйцо дракона, очки звездочёта.')), btn));
    }
    const rows = h('div', { class: 'pass-rows' });
    rows.append(h('div', { class: 'pass-row pass-cap' }, h('span'), h('small', null, 'Бесплатно'), h('small', { class: 'gold' }, 'Золото')));
    for (let i = 0; i < C.pages; i++) {
      const open = i < pg;
      const cell = (gold) => {
        const done = (gold ? b.gc : b.fc).includes(i), can = open && !done && (!gold || b.gold);
        const el = h('button', { type: 'button', class: 'pass-cell' + (gold ? ' gold' : '') + (done ? ' done' : '') + (can ? ' can' : '') + (gold && !b.gold ? ' lock' : '') },
          list(gold ? G[i] : F[i]).map((g) => Gifts.tile(g)), done ? pic('hud/check', 'pass-ok') : null);
        el.addEventListener('click', () => {
          if (can) { showGot(claimPage(i, gold)); redraw(); return; }
          Sound.tap();
          UI.toast(list(gold ? G[i] : F[i]).map(Gifts.label).join(', ') + (done ? ' · получено' : !open ? ' · откроется на странице ' + (i + 1) : gold && !b.gold ? ' · в золотом гримуаре' : ''));
        });
        return el;
      };
      rows.append(h('div', { class: 'pass-row' + (open ? ' open' : '') + (i === pg ? ' next' : '') }, h('span', { class: 'pass-n' }, pic(open ? (i % 5 === 4 ? 'pass/token_gold' : 'pass/token') : 'pass/token_lock', 'pass-tok'), h('b', null, String(i + 1))), cell(false), cell(true)));
    }
    body.append(rows);
    // бонусные страницы
    const bn = bonusReady();
    const bb = h('button', { type: 'button', class: 'btn' + (bn ? '' : ' alt'), disabled: !bn }, bn ? 'Забрать бонусную страницу (' + bn + ')' : 'Бонусные страницы - после 30-й');
    bb.addEventListener('click', () => { showGot(claimBonus()); redraw(); });
    body.append(h('div', { class: 'panel pass-bonus' }, h('p', { class: 'note' }, 'После 30-й страницы каждые ' + C.bonusEvery + ' чернил - бонусная страница: деревянный сундук и час дохода.'), bb));
  }

  function drawTasks(body, redraw) {
    const b = st();
    // вызов Черниллы
    if (b.rv) {
      const R = RIVAL.find((x) => x.type === b.rv.type);
      const her = Math.floor(R.n * weekFrac());
      const mine = b.rv.p;
      const btn = b.rv.c === 1 ? h('button', { type: 'button', class: 'pill-btn' }, 'Забрать') : b.rv.c === 2 ? pic('hud/check', 'ok-ico') : null;
      if (b.rv.c === 1) btn.addEventListener('click', () => { showGot(claimRival()); redraw(); });
      body.append(h('div', { class: 'rival' },
        h('div', { class: 'rival-top' }, pic(b.rv.c === 2 ? 'chars/chernilla_sad' : mine >= her ? 'chars/chernilla_sad' : 'chars/chernilla_happy', 'rival-pic'),
          h('div', null, h('b', null, 'Вызов Мадам Черниллы'), h('p', null, '«' + R.text + '»'))),
        h('div', { class: 'rival-bars' },
          h('div', null, h('small', null, 'Чернилла'), h('div', { class: 'bar her' }, h('i', { style: 'width:' + Math.round(100 * her / R.n) + '%' })), h('b', null, Fmt.num(her))),
          h('div', null, h('small', null, 'Ты'), h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(100 * mine / R.n) + '%' })), h('b', null, Fmt.num(mine)))),
        h('div', { class: 'rival-foot' }, h('small', null, b.rv.c === 2 ? 'Чернилла повержена! Новый вызов на следующей неделе.' : 'Набери ' + Fmt.num(R.n) + ' ' + R.what + ' раньше конца недели (осталось ' + weekDaysLeft() + ' ' + Fmt.plural(weekDaysLeft(), ['день', 'дня', 'дней']) + '). Награда: золотой сундук, 10 кристаллов и ' + RIVAL_INK + ' чернил.'), btn)));
    }
    const block = (title, kind, arr, defs, sub) => {
      body.append(h('h3', { class: 'section-title' }, title));
      arr.forEach((t, i) => {
        const def = defs.find((x) => x.id === t.id);
        if (!def) return;
        let btn;
        if (t.c === 1) {
          btn = h('button', { type: 'button', class: 'pill-btn' }, 'Забрать');
          btn.addEventListener('click', () => { const v = claimTask(kind, i); if (v) { Sound.coin(); UI.toast('+' + v + ' звёздных чернил'); } redraw(); });
        } else if (t.c === 2) btn = pic('hud/check', 'ok-ico');
        else btn = h('span', { class: 'quest-state' }, Fmt.num(t.p) + '/' + Fmt.num(def.n));
        body.append(h('div', { class: 'row-card pass-task' + (t.c === 2 ? ' done' : '') },
          h('div', { class: 'ico' }, pic(def.img)),
          h('div', { class: 'info' }, h('div', { class: 'name' }, def.text(def.n)),
            h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(100 * t.p / def.n) + '%' })),
            h('div', { class: 'meta' }, pic('pass/ink', 'ink-mini'), '+' + def.ink + ' чернил')),
          btn));
      });
      body.append(h('p', { class: 'note' }, sub));
    };
    block('Задания дня', 'd', b.dt, DAY, 'Новые задания завтра.');
    block('Задания недели', 'w', b.wt, WEEK, 'Новые задания через ' + weekDaysLeft() + ' ' + Fmt.plural(weekDaysLeft(), ['день', 'дня', 'дней']) + '.');
    body.append(h('p', { class: 'note' }, 'Чернила дают и обычные дела: зелья, просьбы жителей, мини-игры, задания дня, рецепт и руна, золотые пузыри и помешивания. Ночью по часам лавки - вдвое больше.'));
  }

  // ---------- кнопка на главном экране ----------
  function refreshButton() {
    const el = document.getElementById('pass-btn');
    if (!el || !S()) return;
    el.hidden = false;
    const n = claimable(), bd = el.querySelector('b');
    if (bd) { bd.hidden = !n; bd.textContent = n > 9 ? '9+' : String(n); }
  }
  function init() {
    Econ.hooks.progress = onProgress;
    const el = document.getElementById('pass-btn');
    if (el) el.addEventListener('click', () => { Sound.unlock(); Sound.tap(); open(); });
    refreshButton();
    setInterval(refreshButton, 5000);
  }

  return { init, open, refreshButton, addInk, page, claimable, st, _F: F, _G: G, _claimPage: claimPage, _buyGold: buyGold, _seasonId: seasonId };
})();

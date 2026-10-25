// =====================================================================
//  0.32: главный экран без перегруза.
//  * Справа - только главные кнопки: Зелья, Питомцы, Гримуар, Колесо, Игры (+ праздник).
//    Слева - одна кнопка «Ещё»: в ней Топ, Почта, Ковен, Лавка, Диковинки, Гардероб.
//    Сами кнопки этих разделов остаются в разметке (спрятаны): модули по-прежнему
//    ставят на них точки и прячут их, а меню просто читает их состояние и нажимает их.
//  * Новичок видит кнопки постепенно (GATES). Открылась новая - она мягко светится,
//    Бульк говорит, что это. Кто уже играл, видит всё сразу и без подсказок.
//  * Красных точек на кнопках одновременно не больше BADGES, остальные ждут своей очереди.
// =====================================================================

const Hud = (() => {
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const S = () => Econ.s;
  const $ = (id) => document.getElementById(id);
  const BADGES = 2;

  // шаг «Пути алхимика» (0..): глава 0 - 5 шагов, глава 1 - ещё 6
  const path = () => (S().pth && S().pth.i) || 0;
  const veteran = () => Econ.rank() >= 1;
  // когда кнопка становится доступна новичку
  const GATES = {
    'brew-btn': () => veteran() || path() >= 5 || S().brewed > 0,
    'pass-btn': () => veteran() || S().lvl >= 3,
    'games-btn': () => veteran() || S().lvl >= 4 || (S().stat.games || 0) > 0,
    'market-btn': () => veteran(),
    'btn-recipe': () => veteran() || path() >= 5 || S().recipesSolved > 0,
    'btn-rune': () => veteran() || path() >= 5 || S().runesDone > 0
  };
  const SAY = {
    'brew-btn': 'Появилась зельеварня! Найденные ингредиенты лежат в сумке, а из них варятся зелья.',
    'pets-btn': 'У нас питомцы! Загляни к ним: их можно кормить и отправлять в походы.',
    'pass-btn': 'Звездочёт Орион принёс гримуар: за дела в лавке он пишет награды звёздными чернилами.',
    'wheel-btn': 'Колесо Булька! Раз в день крути бесплатно.',
    'games-btn': 'Мини-игры открылись! Играй - получишь эссенцию и ингредиенты.',
    'btn-recipe': 'Новые дела дня: рецепт дня и руна дня. За них дают кристаллы.',
    'menu-btn': 'В меню «Ещё» появилось новое: загляни!'
  };
  // приоритет красных точек (кого показать, если их много)
  const PRIO = ['event-btn', 'pass-btn', 'wheel-btn', 'menu-btn', 'pets-btn', 'games-btn', 'brew-btn'];
  // разделы меню «Ещё»: кнопка-источник, картинка, подпись
  const MENU = [
    ['tops-btn', 'r2/ic_tops', 'Топ'],
    ['mail-btn', 'r2/ic_mail', 'Почта'],
    ['coven-btn', 'r2/ic_coven', 'Ковен'],
    ['market-btn', 'r2/ic_market', 'Лавка'],
    ['relic-btn', 'r2/ic_relics', 'Диковинки'],
    ['ward-btn', 'r2/ic_ward', 'Гардероб']
  ];

  const allowed = (id) => !GATES[id] || GATES[id]();
  // доступна ли кнопка-источник (модуль её не спрятал и новичку уже можно)
  const live = (id) => { const b = $(id); return !!b && !b.hidden && allowed(id); };
  const badgeOf = (b) => b && (b.querySelector(':scope > b') || b.querySelector('.dot'));
  const badgeOn = (b) => { const d = badgeOf(b); return !!d && !d.hidden && d.textContent.trim() !== ''; };

  // ---------- меню «Ещё» ----------
  function openMenu() {
    const grid = h('div', { class: 'hud-menu' });
    MENU.forEach(([id, img, label]) => {
      if (!live(id)) return;
      const src = $(id), d = badgeOf(src), n = badgeOn(src) ? d.textContent.trim() : '';
      const t = h('button', { type: 'button', class: 'hud-tile' + (seen()[id] ? '' : ' fresh') }, pic(img, 'hud-tile-ico'), h('span', null, label), n ? h('b', null, n) : null);
      t.addEventListener('click', () => { mark(id); UI.closeModal(); setTimeout(() => src.click(), 60); });
      grid.append(t);
    });
    UI.modal({ title: 'Ещё', cls: 'hud-menu-modal', body: grid });
  }

  // ---------- что игрок уже видел ----------
  const seen = () => { const st = S().stat; if (!st.hud || typeof st.hud !== 'object') st.hud = {}; return st.hud; };
  function mark(id) { const s = seen(); if (!s[id]) { s[id] = 1; if (window.Game) Game.save(); } const b = $(id); if (b) b.classList.remove('hud-new'); }
  // первый запуск этой версии у игравшего: всё, что у него уже есть, считаем знакомым
  function firstRun() {
    const st = S().stat;
    if (st.hud) return;
    st.hud = {};
    // новичок: топ, гардероб, почта и ковен - обычные разделы, о них не напоминаем; остальное - по шагам
    if (S().taps < 30 && Econ.levels() === 0) { ['tops-btn', 'ward-btn', 'mail-btn', 'coven-btn'].forEach((id) => { st.hud[id] = 1; }); return; }
    Object.keys(SAY).concat(MENU.map((m) => m[0]), ['btn-rune']).forEach((id) => { if (live(id)) st.hud[id] = 1; });
  }

  // ---------- каждые полсекунды ----------
  let sayQ = [], sayAt = 0;
  function tick() {
    if (!S()) return;
    // новичку - только открытые кнопки
    ['brew-btn', 'pass-btn', 'games-btn', 'pets-btn', 'wheel-btn', 'btn-recipe', 'btn-rune'].forEach((id) => {
      const b = $(id);
      if (!b) return;
      const ok = allowed(id);
      b.classList.toggle('hud-gate', !ok);
      // открылась впервые - светится и Бульк рассказывает
      if (ok && !b.hidden && !seen()[id] && !b.classList.contains('hud-new')) {
        b.classList.add('hud-new');
        if (SAY[id]) sayQ.push(id); else mark(id);
        if (id === 'btn-recipe') mark('btn-rune');
      }
    });
    // фраза о новой кнопке - по одной, когда игрок на главном экране и ничего не открыто
    const now = Date.now();
    if (sayQ.length && now > sayAt && UI.screen() === 'main' && !UI.isModalOpen() && !document.querySelector('.tut') && !Visitors.active()) {
      const id = sayQ.shift();
      UI.say(SAY[id], 4200);
      sayAt = now + 6000;
      if (id === 'btn-recipe' || id === 'btn-rune') setTimeout(() => mark(id), 6000);
    }
    // «Ещё»: число - сколько разделов внутри ждут (письма, сундуки, ковен); новый раздел - кнопка светится
    const menu = $('menu-btn');
    if (menu) {
      const n = MENU.filter(([id]) => live(id) && badgeOn($(id))).length;
      const d = menu.querySelector('b');
      d.hidden = !n; d.textContent = n ? String(n) : '';
      const fresh = MENU.some(([id]) => live(id) && !seen()[id]);
      menu.classList.toggle('hud-new', fresh);
      if (fresh && !menu._said) { menu._said = 1; if (Econ.rank() >= 1 && !S().stat.hud.menuSaid) { S().stat.hud.menuSaid = 1; sayQ.push('menu-btn'); } }
    }
    // строка дня: если открыт только «Подарок» - он по центру
    const row = document.querySelector('.daily-row');
    if (row) row.classList.toggle('solo', !allowed('btn-recipe'));
    // не больше BADGES красных точек сразу
    let shown = 0;
    PRIO.forEach((id) => {
      const b = $(id), d = badgeOf(b);
      if (!d) return;
      const vis = !b.hidden && !b.classList.contains('hud-gate') && badgeOn(b);
      d.classList.toggle('hud-quiet', vis && shown >= BADGES);
      if (vis && shown < BADGES) shown++;
    });
  }

  function init() {
    firstRun();
    const m = $('menu-btn');
    if (m) m.addEventListener('click', () => { Sound.unlock(); Sound.tap(); openMenu(); });
    // нажали на светящуюся кнопку - знакомство состоялось
    ['brew-btn', 'pass-btn', 'games-btn', 'pets-btn', 'wheel-btn', 'btn-recipe', 'btn-rune'].forEach((id) => {
      const b = $(id); if (b) b.addEventListener('click', () => mark(id));
    });
    tick();
    setInterval(tick, 500);
  }
  return { init, openMenu, allowed, _tick: tick };
})();

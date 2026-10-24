// =====================================================================
//  0.31: лавка странствующего торговца Варфоломея - магазин за кристаллы и эссенцию.
//  * Товар дня: 4 предложения, каждый день свои (одинаково у всех), по одному в руки.
//    Одно из них - со скидкой. Утром по часам лавки на товар дня ещё -20%.
//  * Усилители: попутный ветер, вдохновение, буря помешиваний - за кристаллы, с лимитом в день.
//  * За эссенцию: корзинка трав, свиток рецепта, деревянный сундук - цена растёт вместе с доходом.
//  * Сундуки за кристаллы продаются в «Диковинках» - отсюда туда ведёт кнопка.
//  Покупки за день - в s.mk { d, b: {id: сколько куплено} }.
// =====================================================================

CONFIG.market = { morningOff: 0.2 };

const Market = (() => {
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const S = () => Econ.s;
  const save = () => { if (window.Game) Game.save(); };

  // предложения дня: g - награда (gifts.js), cr - цена в кристаллах
  const DEALS = [
    { id: 'rare', cr: 6, g: () => ({ k: 'ing', n: 1, rare: 1 }), name: 'Редкий ингредиент', d: 'Случайный: папоротник, жемчуг, янтарь...' },
    { id: 'basket', cr: 8, g: () => ({ k: 'ing', n: 5, rare: 0.25 }), name: 'Корзина ингредиентов', d: '5 ингредиентов, иногда редкие' },
    { id: 'sh30', cr: 10, g: () => ({ k: 'sh', n: 30 }), name: 'Мешочек осколков', d: '30 осколков для диковинок' },
    { id: 'chw', cr: 12, g: () => ({ k: 'chest', c: 'w' }), name: 'Деревянный сундук', d: 'Дешевле, чем в «Диковинках»' },
    { id: 'chs', cr: 48, g: () => ({ k: 'chest', c: 's' }), name: 'Серебряный сундук', d: 'Редкая диковинка или лучше' },
    { id: 'chg', cr: 150, g: () => ({ k: 'chest', c: 'g' }), name: 'Золотой сундук', d: 'Две диковинки, одна эпическая или легендарная' },
    { id: 'egg', cr: 45, g: () => ({ k: 'egg', t: 'mystery' }), name: 'Таинственное яйцо', d: 'Кто вылупится - неизвестно', need: () => Pets.owned().length > 0 },
    { id: 'spin', cr: 12, g: () => ({ k: 'spin' }), name: 'Вращение колеса', d: 'Ещё одно вращение сегодня', need: () => Relics.unlocked() },
    { id: 'insp', cr: 15, g: () => ({ k: 'fx', id: 'inspire', min: 10 }), name: 'Вдохновение', d: 'Доход ×5 на 10 минут' },
    { id: 'scroll', cr: 5, g: () => ({ k: 'scroll' }), name: 'Свиток рецепта', d: 'Подсказка к неизвестному рецепту' },
    { id: 'ess6', cr: 20, g: () => ({ k: 'ess', h: 6 }), name: 'Бочонок эссенции', d: 'Доход лавки за 6 часов' }
  ];
  // усилители: постоянно, лимит в день
  const BOOSTS = [
    { id: 'b_wind', cr: 6, max: 3, g: { k: 'fx', id: 'wind', min: 30 } },
    { id: 'b_insp', cr: 18, max: 2, g: { k: 'fx', id: 'inspire', min: 10 } },
    { id: 'b_storm', cr: 4, max: 5, g: { k: 'fx', id: 'storm', min: 0.5 } }
  ];
  // за эссенцию: цена - доход за hours часов (не меньше min)
  const ESS = [
    { id: 'e_basket', hours: 2, min: 3000, max: 3, g: { k: 'ing', n: 4, rare: 0.15 }, name: 'Корзинка трав' },
    { id: 'e_scroll', hours: 1.5, min: 2000, max: 2, g: { k: 'scroll' }, name: 'Свиток рецепта' },
    { id: 'e_chest', hours: 8, min: 20000, max: 1, g: { k: 'chest', c: 'w' }, name: 'Деревянный сундук' }
  ];
  const SAY = ['Подходи, не стесняйся! Всё из дальних краёв.', 'Этот товар я вёз через три болота и одну гору.', 'Утром - скидки, пока я не распаковал весь рюкзак!',
    'Сегодня есть кое-что редкое. Глянь!', 'Кристаллы? Беру. Эссенцию? Тоже беру!'];

  const st = () => {
    const s = S();
    if (!s.mk || typeof s.mk !== 'object') s.mk = {};
    if (s.mk.d !== Econ.today()) s.mk = { d: Econ.today(), b: {} };
    return s.mk;
  };
  const bought = (id) => st().b[id] || 0;
  const morning = () => typeof TimeDay !== 'undefined' && TimeDay.isMorning();

  // товар дня: 4 предложения из тех, что сейчас доступны; одно со скидкой 30%
  function deals() {
    const d = Econ.today(), rng = Econ.rngFrom('bulk:market:' + d);
    const pool = DEALS.filter((x) => !x.need || x.need());
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const hot = Math.floor(rng() * 4);
    return pool.slice(0, 4).map((x, i) => {
      let off = i === hot ? 0.3 : 0;
      if (morning()) off = 1 - (1 - off) * (1 - CONFIG.market.morningOff);
      return { x, g: x.g(), price: Math.max(1, Math.round(x.cr * (1 - off))), off, left: bought(x.id) ? 0 : 1 };
    });
  }
  const essPrice = (e) => Math.round(Econ.hoursOfIncome(e.hours, e.min));

  function buy(id, price, cur) {
    const s = S();
    if (cur === 'cr') { if (s.cr < price) return false; s.cr -= price; }
    else { if (s.e < price) return false; s.e -= price; }
    st().b[id] = bought(id) + 1;
    return true;
  }

  function open() {
    const body = h('div', { class: 'brew market' });
    const draw = () => UI.keepSeg(body, () => drawInner(body, draw));
    draw();
    UI.modal({ sheet: true, title: '', cls: 'market-modal', body, onOpen: (box) => box.classList.add('fixed-h') });
  }
  let happyT = 0;
  function drawInner(body, redraw) {
    body.innerHTML = '';
    const s = S();
    const top = h('div', { class: 'sheet-top' });
    body.append(top);
    top.append(h('div', { class: 'brew-head' }, pic('ui/potion_bag', 'brew-head-ico'),
      h('div', { class: 'brew-head-text' }, h('b', null, 'Лавка Варфоломея'), h('small', null, 'Странствующий торговец')),
      h('div', { class: 'ev-candy' }, pic('ui/crystal', 'cr-ico'), h('b', null, Fmt.num(s.cr)))));
    body.append(h('div', { class: 'merchant bart' }, h('div', { class: 'merchant-ico' }, pic(Date.now() < happyT ? 'chars/bartholomew_happy' : 'chars/bartholomew_wait', 'merchant-pic')),
      h('div', null, h('b', null, 'Варфоломей'), h('p', null, '«' + SAY[new Date().getDate() % SAY.length] + '»'))));
    const done = (text) => { Sound.buy(); happyT = Date.now() + 1500; UI.toast(text); save(); UI.refresh(); redraw(); setTimeout(() => { if (UI.isModalOpen()) redraw(); }, 1600); };
    const row = (g, name, sub, btn, cls) => h('div', { class: 'row-card mk-row' + (cls ? ' ' + cls : '') }, h('div', { class: 'ico' }, pic(Gifts.img(g))),
      h('div', { class: 'info' }, h('div', { class: 'name' }, name), h('div', { class: 'meta' }, sub)), btn);

    // товар дня
    body.append(h('h3', { class: 'section-title' }, 'Товар дня'));
    if (morning()) body.append(h('p', { class: 'note mk-morning' }, 'Утро в лавке: на товар дня скидка 20%!'));
    deals().forEach((o) => {
      const btn = h('button', { class: 'pill-btn', type: 'button', disabled: !o.left }, o.left ? UI.money(o.price, 'ui/crystal') : 'Куплено');
      btn.addEventListener('click', () => {
        if (s.cr < o.price) { Sound.deny(); UI.toast('Не хватает кристаллов'); return; }
        if (buy(o.x.id, o.price, 'cr')) done(Gifts.give(o.g));
      });
      body.append(row(o.g, o.x.name, (o.x.d || Gifts.label(o.g)) + (o.off ? ' · скидка ' + Math.round(o.off * 100) + '%' : ''), btn, o.off ? 'hot' : ''));
    });
    body.append(h('p', { class: 'note' }, 'Новый товар через ' + Fmt.time(Econ.secToMidnight())));

    // усилители
    body.append(h('h3', { class: 'section-title' }, 'Усилители'));
    BOOSTS.forEach((x) => {
      const left = x.max - bought(x.id), act = Econ.effectLeft(x.g.id);
      const btn = h('button', { class: 'pill-btn', type: 'button', disabled: left <= 0 }, left > 0 ? UI.money(x.cr, 'ui/crystal') : 'Завтра');
      btn.addEventListener('click', () => {
        if (s.cr < x.cr) { Sound.deny(); UI.toast('Не хватает кристаллов'); return; }
        if (buy(x.id, x.cr, 'cr')) done(Gifts.give(x.g));
      });
      body.append(row(x.g, DATA.effects[x.g.id].name, Gifts.label(x.g).split(': ')[1] + ' · сегодня ещё ' + left + (act > 0 ? ' · действует ' + Fmt.time(act) : ''), btn));
    });

    // за эссенцию
    body.append(h('h3', { class: 'section-title' }, 'За эссенцию'));
    ESS.forEach((x) => {
      const left = x.max - bought(x.id), price = essPrice(x);
      const btn = h('button', { class: 'pill-btn', type: 'button', disabled: left <= 0 }, left > 0 ? UI.money(UI.ess(price)) : 'Завтра');
      btn.addEventListener('click', () => {
        if (s.e < price) { Sound.deny(); UI.toast('Не хватает эссенции'); return; }
        if (buy(x.id, price, 'e')) done(Gifts.give(x.g));
      });
      body.append(row(x.g, x.name, Gifts.label(x.g) + ' · сегодня ещё ' + left, btn));
    });

    // сундуки - в диковинках
    if (Relics.unlocked()) {
      const b = h('button', { class: 'btn alt', type: 'button' }, 'Сундуки за кристаллы - в «Диковинках»');
      b.addEventListener('click', () => { Sound.tap(); UI.closeModal(); setTimeout(() => Relics.open('chests'), 50); });
      body.append(b);
    }
  }

  function init() {
    const el = document.getElementById('market-btn');
    if (el) { el.hidden = false; el.addEventListener('click', () => { Sound.unlock(); Sound.tap(); open(); }); }
  }
  return { init, open, deals, _st: st };
})();

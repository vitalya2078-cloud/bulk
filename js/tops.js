// =====================================================================
//  Топы (0.33) - база Supabase, общие для ВК и Telegram (функция top2, см. supabase/update23.sql).
//  * Лига недели - главный топ. Очки - звёздные чернила за дела (как в гримуаре), а не эссенция:
//    новичок и ветеран в равных. Пять лиг; в конце недели лучшие поднимаются, последние опускаются,
//    награды за места приходят письмом.
//  * Мастерство - насколько глубоко пройдена игра (Econ.mastery).
//  * Рекорды - лучший счёт в мини-играх.
//  * Ковены - как раньше (top_covens).
// =====================================================================

CONFIG.tops = {
  url: 'https://ahqaficklfciahzlghec.supabase.co/rest/v1/rpc/',
  key: 'sb_publishable_IXd8i1DDSci-bdAZPOZciQ_wsCL9lOx',
  limit: 50
};

// лиги: цвет медальона и камень
DATA.leagues = [
  { name: 'Медная', c1: '#E8A06A', c2: '#8A4A22', gem: '#FFD9B0' },
  { name: 'Серебряная', c1: '#E8EEF8', c2: '#7A88A8', gem: '#B8E4FF' },
  { name: 'Золотая', c1: '#FFE38A', c2: '#C0841A', gem: '#FFF6C8' },
  { name: 'Звёздная', c1: '#A8C8FF', c2: '#3A4AB0', gem: '#FFE38A' },
  { name: 'Лунная', c1: '#D8B8FF', c2: '#5A2A9A', gem: '#FFFFFF' }
];

const Tops = (() => {
  const T = CONFIG.tops;
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);

  const BOARDS = [
    { id: 'league', tab: 'Лига' },
    { id: 'mastery', tab: 'Мастерство', title: 'Кто глубже прошёл игру', hint: 'Считается по уровню, рангу, рецептам, диковинкам, питомцам и дружбе с жителями.' },
    { id: 'records', tab: 'Рекорды' },
    { id: 'covens', tab: 'Ковены', title: 'Ковены недели', hint: 'Очки, которые участники принесли своему ковену за эту неделю.' }
  ];
  const GAMES = [{ id: 'match3', name: 'Полка зелий' }, { id: 'memory', name: 'Мемори' }];

  async function rpc(fn, body, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), ms || 9000) : 0;
    try {
      const r = await fetch(T.url + fn, {
        method: 'POST',
        headers: { apikey: T.key, Authorization: 'Bearer ' + T.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined
      });
      if (!r.ok) throw new Error(fn + ' ' + r.status);
      const txt = await r.text();
      return txt ? JSON.parse(txt) : null;
    } finally { if (tm) clearTimeout(tm); }
  }

  // ---------- кусочки ----------
  function avatar(photo, cls) {
    let src;
    if (/^[a-z]\d\d$/.test(photo || '')) src = UI.avatarSrc(photo);
    else if (/^https:\/\//.test(photo || '')) src = photo;
    else src = UI.avatarSrc('a01');
    const img = h('img', { class: 'pic round', src, alt: '', draggable: 'false', referrerpolicy: 'no-referrer', decoding: 'async' });
    img.addEventListener('error', () => { img.src = UI.avatarSrc('a01'); }, { once: true });
    return h('span', { class: 'top-ava' + (cls ? ' ' + cls : '') }, img);
  }
  const myPhoto = () => { const s = Econ.s; return s.prof.avatar === 'photo' ? '' : s.prof.avatar; };
  // медальон лиги (рисуется стилями)
  function badge(lg, size) {
    const L = DATA.leagues[Math.max(0, Math.min(4, lg | 0))];
    return h('span', { class: 'lg-badge lg' + lg, style: '--c1:' + L.c1 + ';--c2:' + L.c2 + ';--gem:' + L.gem + ';--s:' + (size || 54) + 'px' },
      h('i', null, ['I', 'II', 'III', 'IV', 'V'][lg] || 'I'));
  }
  function giftChips(g) {
    if (!g) return null;
    return h('span', { class: 'top-gift' },
      g.chest ? pic('relics/chest_' + g.chest, 'top-gift-ico') : null,
      g.cr ? h('span', null, pic('ui/crystal', 'top-gift-ico'), h('b', null, String(g.cr))) : null);
  }
  // заголовок с «?»: пояснение открывается по нажатию
  function infoRow(title, hint) {
    const p = h('p', { class: 'top-hint', hidden: true }, hint);
    const q = h('button', { class: 'lg-help small', type: 'button', onclick: () => { Sound.tap(); p.hidden = !p.hidden; } }, '?');
    return h('div', null, h('div', { class: 'top-info' }, h('b', null, title), q), p);
  }
  const fmtLeft = (sec) => {
    const d = Math.floor(sec / 86400), hh = Math.floor((sec % 86400) / 3600), mm = Math.floor((sec % 3600) / 60);
    return d ? d + ' ' + Fmt.plural(d, ['день', 'дня', 'дней']) + ' ' + hh + ' ч' : hh ? hh + ' ч ' + mm + ' мин' : mm + ' мин';
  };

  // пьедестал: 2 - 1 - 3
  function podium(rows, unit, gifts) {
    const top = [rows[1], rows[0], rows[2]];
    return h('div', { class: 'podium' }, top.map((r, i) => {
      const pl = [2, 1, 3][i];
      if (!r) return h('div', { class: 'pod pod' + pl + ' empty' }, h('div', { class: 'pod-who' }, h('span', { class: 'top-ava pod-ava' }), h('b', null, '...')), h('div', { class: 'pod-base' }, h('b', null, String(pl))));
      return h('div', { class: 'pod pod' + pl + (r.is_me ? ' me' : '') },
        h('div', { class: 'pod-who' },
          pl === 1 ? pic('ui/crown', 'pod-crown') : null,
          avatar(r.photo, 'pod-ava'),
          h('b', { class: 'pod-name' }, r.name || 'Алхимик'),
          h('span', { class: 'pod-score' }, Fmt.num(r.score))),
        h('div', { class: 'pod-base' }, h('b', null, String(pl)), gifts ? giftChips(gifts[pl - 1]) : null));
    }));
  }
  function row(r, extra) {
    return h('div', { class: 'top-row' + (r.is_me ? ' me' : '') + (extra && extra.zone ? ' ' + extra.zone : '') },
      h('span', { class: 'top-place' }, h('b', null, String(r.place))),
      avatar(r.photo),
      h('span', { class: 'top-name' }, r.name || 'Алхимик', extra && extra.sub ? h('small', { class: 'top-sub' }, extra.sub) : null),
      extra && extra.gift ? giftChips(extra.gift) : null,
      h('span', { class: 'top-score' }, h('b', null, Fmt.num(r.score))));
  }
  function covenRow(r) {
    return h('div', { class: 'top-row' + (r.is_me ? ' me' : '') },
      h('span', { class: 'top-place' }, h('b', null, String(r.place))),
      h('span', { class: 'top-ava top-emb' }, typeof Coven !== 'undefined' && Coven.emblem ? Coven.emblem(r, 38) : null),
      h('span', { class: 'top-name' }, r.name, h('small', { class: 'top-sub' }, 'ур ' + r.level + (r.members ? ' · ' + r.members + ' чел.' : ''))),
      h('span', { class: 'top-score' }, h('b', null, Fmt.num(r.score))));
  }

  // ---------- окно ----------
  let tab = 0, game = 0;
  function open(startTab) {
    if (typeof startTab === 'number') tab = startTab;
    const seg = h('div', { class: 'seg top-seg', role: 'tablist' });
    const body = h('div', { class: 'top-body' });
    const mine = h('div', { class: 'top-mine' });
    let token = 0;

    function draw() {
      seg.replaceChildren(...BOARDS.map((b, i) => h('button', {
        class: 'seg-btn' + (i === tab ? ' on' : ''), type: 'button', role: 'tab',
        onclick: () => { if (i !== tab) { Sound.tap(); tab = i; draw(); } }
      }, b.tab)));
      load();
    }
    const fail = () => body.replaceChildren(h('div', { class: 'top-empty' }, h('p', null, 'Топ сейчас недоступен.'), h('small', null, 'Проверь интернет и загляни чуть позже.')));
    const offline = () => typeof Online === 'undefined' || !Online.on();

    async function load() {
      const b = BOARDS[tab], my = ++token;
      body.replaceChildren(h('p', { class: 'top-empty' }, 'Загружаю топ...'));
      mine.replaceChildren();
      const meId = (typeof Online !== 'undefined' && Online.uid()) || 0;
      // свежие очки - до запроса топа, чтобы своё место было точным
      if (!offline()) { try { await Promise.race([b.id === 'mastery' ? Online.hello(false, true) : Online.leaguePut(true), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* ignore */ } }
      if (my !== token) return;
      let r;
      try {
        if (b.id === 'covens') r = await rpc('top_covens', { p_limit: T.limit, p_me: meId });
        else r = await rpc('top2', { p_board: b.id === 'records' ? GAMES[game].id : b.id, p_limit: T.limit, p_me: meId });
      } catch (e) { if (my === token) fail(); return; }
      if (my !== token) return;
      if (b.id === 'league') drawLeague(r || {});
      else if (b.id === 'covens') drawCovens(r || {}, b);
      else drawBoard(r || {}, b);
    }

    function drawLeague(r) {
      const lg = r.league || 0, L = DATA.leagues[lg], rows = r.rows || [], n = r.total || 0;
      const s = Econ.s, lgs = s.lg || (s.lg = {});
      // лига сменилась с прошлого раза - сказать об этом
      if (lgs.league !== undefined && lgs.league !== lg) setTimeout(() => UI.toast(lg > lgs.league ? 'Ты поднялся в ' + L.name + ' лигу!' : 'Теперь ты в лиге «' + L.name + '». Отыграйся!'), 300);
      lgs.league = lg;
      const up = r.up || 0, down = r.down || 0;
      const zone = (p) => (p <= up ? 'up' : down && p > n - down ? 'down' : '');
      const giftFor = (p) => (p === 1 ? r.gifts[0] : p === 2 ? r.gifts[1] : p === 3 ? r.gifts[2] : p <= 10 ? r.gifts[3] : r.gifts[4]);
      const head = h('div', { class: 'lg-head', style: '--c1:' + L.c1 + ';--c2:' + L.c2 },
        badge(lg, 58),
        h('div', { class: 'lg-info' }, h('b', null, L.name + ' лига'),
          h('small', null, 'До конца недели: ' + fmtLeft(r.left || 0))),
        h('button', { class: 'lg-help', type: 'button', onclick: () => { Sound.tap(); help(r); } }, '?'));
      const parts = [head];
      if (r.last && r.last.place) parts.push(h('div', { class: 'lg-last' }, 'Прошлая неделя: ' + r.last.place + ' место' + (r.last.gift ? ', награда в почте' : '')));
      if (!rows.length) {
        parts.push(h('div', { class: 'top-empty' }, h('p', null, 'Пока никого. Будь первым!')));
      } else {
        parts.push(podium(rows, 'очков', r.gifts));
        const list = h('div', { class: 'top-list' });
        rows.slice(3).forEach((x) => {
          const z = zone(x.place);
          if (x.place === up + 1 && up >= 3) list.append(h('div', { class: 'lg-line up' }, 'граница повышения'));
          if (down && x.place === n - down + 1) list.append(h('div', { class: 'lg-line down' }, 'зона понижения'));
          list.append(row(x, { zone: z, gift: x.place <= 10 ? giftFor(x.place) : null }));
        });
        parts.push(list);
      }
      body.replaceChildren(...parts);
      // моя карточка внизу
      const me = r.me, myScore = me ? me.score : 0;
      // одна короткая подсказка: что ближайшее
      let line;
      if (offline()) line = 'Лига - во ВКонтакте и Telegram';
      else if (!me) line = 'Делай дела в лавке - и ты в лиге';
      else if (myScore < r.min) line = 'До награды: ' + Fmt.num(r.min - myScore);
      else if (me.place === 1) line = 'Ты первый!';
      else if (up && me.place > up && rows[up - 1]) line = 'До повышения: ' + Fmt.num(rows[up - 1].score - myScore + 1);
      else line = 'До ' + (me.place - 1) + ' места: ' + Fmt.num(rows[me.place - 2].score - myScore + 1);
      mine.replaceChildren(h('div', { class: 'top-me' + (me ? ' ' + zone(me.place) : '') },
        h('span', { class: 'top-place' }, h('b', null, me ? String(me.place) : '-')),
        avatar(myPhoto()),
        h('span', { class: 'top-name' }, s.prof.name || 'Ты', h('small', { class: 'top-sub' }, line)),
        h('span', { class: 'top-score' }, pic('pass/ink', 'top-ink'), h('b', null, Fmt.num(myScore)))));
    }

    function drawBoard(r, b) {
      const rows = r.rows || [];
      const parts = [];
      if (b.id === 'records') {
        parts.push(h('div', { class: 'seg top-sub-seg' }, GAMES.map((g, i) => h('button', { type: 'button', class: 'seg-btn' + (i === game ? ' on' : ''),
          onclick: () => { if (i !== game) { Sound.tap(); game = i; load(); } } }, g.name))));
        parts.push(infoRow('Лучшая партия', 'Здесь решает умение, а не прокачка: лучший счёт за одну игру.'));
      } else parts.push(infoRow(b.title, b.hint));
      if (!rows.length) parts.push(h('p', { class: 'top-empty' }, b.id === 'records' ? 'Рекордов пока нет' : 'Пока пусто'));
      else {
        parts.push(podium(rows));
        const list = h('div', { class: 'top-list' });
        rows.slice(3).forEach((x) => list.append(row(x, b.id === 'mastery' && x.league !== undefined ? { sub: DATA.leagues[x.league].name + ' лига' } : null)));
        parts.push(list);
      }
      body.replaceChildren(...parts);
      const me = r.me, s = Econ.s;
      const mineScore = b.id === 'records' ? ((s.mg && s.mg.best && s.mg.best[GAMES[game].id]) || 0) : b.id === 'mastery' ? Econ.mastery() : 0;
      mine.replaceChildren(h('div', { class: 'top-me' },
        h('span', { class: 'top-place' }, h('b', null, me ? String(me.place) : '-')),
        avatar(myPhoto()),
        h('span', { class: 'top-name' }, s.prof.name || 'Ты', h('small', { class: 'top-sub' }, me ? (me.place > 1 && rows[me.place - 2] ? 'До ' + (me.place - 1) + ' места: ' + Fmt.num(rows[me.place - 2].score - me.score + 1) : me.place === 1 ? 'Ты лучший!' : '') : offline() ? 'Топ - во ВКонтакте и Telegram' : b.id === 'records' ? 'Сыграй - и ты здесь' : 'Скоро будешь здесь')),
        h('span', { class: 'top-score' }, h('b', null, Fmt.num(me ? me.score : mineScore)))));
    }

    function drawCovens(r, b) {
      const rows = r.rows || [];
      body.replaceChildren(infoRow(b.title, b.hint),
        rows.length ? h('div', { class: 'top-list' }, rows.map(covenRow)) : h('p', { class: 'top-empty' }, 'Пока пусто'));
      const m = r.me;
      mine.replaceChildren(m ? covenRow(Object.assign({ is_me: true }, m)) : h('p', { class: 'note center' }, 'Вступи в ковен - и он будет здесь'));
    }

    // справка - внутри того же окна, «Назад» возвращает к лиге
    function help(r) {
      const lg = r.league || 0;
      const back = h('button', { class: 'btn alt', type: 'button', onclick: () => { Sound.tap(); drawLeague(r); } }, 'Назад к лиге');
      mine.replaceChildren(back);
      body.replaceChildren(h('div', { class: 'lg-help-box' },
        h('div', { class: 'lg-ladder' }, DATA.leagues.map((L, i) => h('div', { class: 'lg-step' + (i === lg ? ' on' : '') }, badge(i, 40), h('span', null, L.name)))),
        h('p', null, 'Очки - звёздные чернила за дела в лавке. Ночью вдвое больше.'),
        h('p', null, 'В понедельник неделя начинается с нуля. Лучшие ' + (r.up || 1) + ' поднимаются, последние опускаются.'),
        h('p', null, 'Награды приходят в почту. Нужно от ' + r.min + ' чернил за неделю.'),
        h('div', { class: 'lg-gifts' }, ['1 место', '2 место', '3 место', '4-10 место', 'остальным'].map((t, i) => h('div', null, h('span', null, t), giftChips(r.gifts[i]))))));
      body.parentNode.scrollTop = 0;
    }

    UI.modal({ title: 'Топы', sheet: true, cls: 'fixed-h tops-modal', body: h('div', { class: 'tops cv-wrap' }, seg, h('div', { class: 'cv-box' }, body), mine), onOpen: draw });
  }

  return { open, badge };
})();

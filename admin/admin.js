// =====================================================================
//  Бульк - админ-панель. Открывается в Telegram (из настроек игры или по ссылке бота).
//  Все действия проверяет база: она пускает только Telegram-аккаунт администратора.
// =====================================================================
(() => {
  'use strict';
  const URL_RPC = 'https://ahqaficklfciahzlghec.supabase.co/rest/v1/rpc/';
  const KEY = 'sb_publishable_IXd8i1DDSci-bdAZPOZciQ_wsCL9lOx';
  const IMG = (n) => '../assets/images/' + n + '.webp';
  const RANKS = ['Лоток травницы', 'Лавочка', 'Аптека', 'Мастерская', 'Зельеварня', 'Гильдия алхимиков', 'Академия', 'Королевский алхимик', 'Хранитель Камня'];
  const RANK_NEED = [0, 5e3, 5e4, 5e6, 8e7, 4e8, 2.5e9, 1e10, 6e10];

  const tg = (window.Telegram && window.Telegram.WebApp) || null;
  const initData = (tg && tg.initData) || '';
  const me = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;

  // ---------- мелочи ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (c) => { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c instanceof Node ? c : document.createTextNode(String(c))); };
    kids.forEach(add);
    return el;
  }
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s);
  function num(n) {
    n = +n || 0;
    const a = Math.abs(n);
    const f = (v, s) => (v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100).toString().replace('.', ',') + ' ' + s;
    if (a >= 1e15) return f(n / 1e15, 'квдр');
    if (a >= 1e12) return f(n / 1e12, 'трлн');
    if (a >= 1e9) return f(n / 1e9, 'млрд');
    if (a >= 1e6) return f(n / 1e6, 'млн');
    if (a >= 1e4) return f(n / 1e3, 'тыс');
    return Math.round(n).toLocaleString('ru-RU');
  }
  function ago(iso) {
    if (!iso) return 'никогда';
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 60) return 'только что';
    if (s < 3600) return Math.floor(s / 60) + ' мин назад';
    if (s < 86400) return Math.floor(s / 3600) + ' ч назад';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' дн назад';
    return date(iso);
  }
  const date = (iso) => iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' }) : '-';
  const dateTime = (iso) => iso ? new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
  function dur(sec) {
    sec = +sec || 0;
    if (sec < 3600) return Math.round(sec / 60) + ' мин';
    if (sec < 86400) return (Math.round(sec / 360) / 10).toString().replace('.', ',') + ' ч';
    return Math.floor(sec / 86400) + ' д ' + Math.round((sec % 86400) / 3600) + ' ч';
  }
  const online = (iso) => iso && Date.now() - Date.parse(iso) < 5 * 60000;
  const avatarSrc = (p) => /^[a-z]\d\d$/.test(p || '') ? IMG('avatars/' + p) : /^https:\/\//.test(p || '') ? p : IMG('avatars/a01');
  const word = (n, a, b, c) => { n = Math.abs(n) % 100; const d = n % 10; return n > 10 && n < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c; };
  function haptic(t) { try { if (tg && tg.HapticFeedback) t === 'ok' ? tg.HapticFeedback.notificationOccurred('success') : tg.HapticFeedback.impactOccurred('light'); } catch (e) { /* ignore */ } }

  let toastT = 0;
  function toast(text, err) {
    const t = $('toast');
    t.textContent = text;
    t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.className = 'toast' + (err ? ' err' : ''); }, 2600);
    if (!err) haptic('ok');
  }
  function confirmBox(title, text, okLabel, danger) {
    return new Promise((res) => {
      const close = (v) => { d.remove(); res(v); };
      const d = h('div', { class: 'dlg', onclick: (e) => { if (e.target === d) close(false); } },
        h('div', { class: 'dlg-box' }, h('h3', null, title), h('p', null, text),
          h('div', { class: 'btns' },
            h('button', { class: 'btn alt', onclick: () => close(false) }, 'Отмена'),
            h('button', { class: 'btn' + (danger ? ' red' : ''), onclick: () => close(true) }, okLabel || 'Да'))));
      document.body.append(d);
    });
  }

  async function api(fn, body) {
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(URL_RPC + fn, {
        method: 'POST', signal: ctl.signal,
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ init_data: initData }, body || {}))
      });
      const txt = await r.text();
      if (!r.ok) {
        let msg = txt;
        try { msg = JSON.parse(txt).message || txt; } catch (e) { /* ignore */ }
        throw new Error(msg);
      }
      return txt ? JSON.parse(txt) : null;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Сервер долго не отвечает');
      throw e;
    } finally { clearTimeout(tm); }
  }
  const errText = (e) => {
    const m = String(e && e.message || e);
    if (/not admin/.test(m)) return 'Нет прав администратора';
    if (/bad signature|too old/.test(m)) return 'Подпись Telegram устарела, открой панель заново';
    if (/Failed to fetch|NetworkError|долго/.test(m)) return 'Нет связи с базой. Проверь интернет или VPN';
    return 'Ошибка: ' + m.slice(0, 120);
  };
  async function act(fn, body, okText) {
    try { const r = await api(fn, body); if (okText) toast(okText); return r === null ? true : r; } catch (e) { toast(errText(e), true); return false; }
  }

  // ---------- Telegram ----------
  function setupTelegram() {
    if (!tg) return;
    try {
      tg.ready(); tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor('#1B1030');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#1B1030');
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      const safe = () => {
        const s = tg.safeAreaInset || {}, c = tg.contentSafeAreaInset || {};
        document.documentElement.style.setProperty('--safe-top', ((s.top || 0) + (c.top || 0)) + 'px');
        document.documentElement.style.setProperty('--safe-bottom', ((s.bottom || 0) + (c.bottom || 0)) + 'px');
      };
      safe();
      ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged', 'viewportChanged'].forEach((ev) => { try { tg.onEvent(ev, safe); } catch (e) { /* старый Telegram */ } });
      if (tg.BackButton) { tg.BackButton.show(); tg.BackButton.onClick(back); }
    } catch (e) { /* ignore */ }
  }
  // назад: из карточки игрока - к списку, иначе - в игру
  function back() {
    if (sheetEl) { closeSheet(); return; }
    location.href = '../';
  }

  // ---------- каркас ----------
  const TABS = [
    { id: 'home', label: 'Обзор', img: 'ui/chart' },
    { id: 'players', label: 'Игроки', img: 'ui/crown' },
    { id: 'mail', label: 'Почта', img: 'ui/envelope' },
    { id: 'shop', label: 'Лавка', img: 'ui/gear' },
    { id: 'log', label: 'Журнал', img: 'ui/scroll' }
  ];
  let tab = 'home';
  try { tab = sessionStorage.getItem('adm_tab') || 'home'; } catch (e) { /* ignore */ }
  let body, refreshBtn;

  function shell() {
    refreshBtn = h('button', { class: 'ibtn', 'aria-label': 'Обновить', onclick: () => { haptic(); render(); } }, '⟳');
    body = h('main');
    const nav = h('div', { class: 'nav-in' }, TABS.map((t) => h('button', {
      class: t.id === tab ? 'on' : '', 'data-t': t.id,
      onclick: () => { if (tab !== t.id) { haptic(); tab = t.id; try { sessionStorage.setItem('adm_tab', tab); } catch (e) { /* ignore */ } nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab)); window.scrollTo(0, 0); render(); } }
    }, h('img', { src: IMG(t.img), alt: '' }), t.label)));
    $('app').replaceChildren(
      h('div', { class: 'top' }, h('div', { class: 'top-in' },
        h('div', { class: 'logo', style: { backgroundImage: 'url(../assets/icon.png)' } }),
        h('h1', { class: 'grow' }, 'Бульк · Админка', h('small', null, me ? 'Ты: ' + (me.first_name || '') + (me.username ? ' @' + me.username : '') : '')),
        refreshBtn,
        h('button', { class: 'ibtn', 'aria-label': 'В игру', onclick: () => { location.href = '../'; } }, '🎮'))),
      body,
      h('div', { class: 'nav' }, nav));
  }
  const skeleton = (n) => Array.from({ length: n || 4 }, () => h('div', { class: 'skel' }));
  let renderId = 0;
  async function render() {
    const id = ++renderId;
    refreshBtn.firstChild && refreshBtn.classList.add('spin');
    try {
      if (tab === 'home') await renderHome(id);
      else if (tab === 'players') await renderPlayers(id, true);
      else if (tab === 'mail') await renderMail(id);
      else if (tab === 'shop') await renderShop(id);
      else if (tab === 'log') await renderLog(id);
    } finally { if (id === renderId) refreshBtn.classList.remove('spin'); }
  }
  const stale = (id) => id !== renderId;
  function failBox(e) {
    return h('div', { class: 'card center' }, h('p', null, errText(e)), h('button', { class: 'btn alt small', onclick: render }, 'Повторить'));
  }

  // ---------- обзор ----------
  async function renderHome(id) {
    body.replaceChildren(h('div', { class: 'h2' }, 'Сейчас'), h('div', { class: 'kpis' }, skeleton(6)));
    let s;
    try { s = await api('adm_stats'); } catch (e) { if (!stale(id)) body.replaceChildren(failBox(e)); return; }
    if (stale(id)) return;
    const k = (v, label, hot, live) => h('div', { class: 'kpi' + (hot ? ' hot' : '') }, live ? h('i', { class: 'live' }) : null, h('b', null, v), h('span', null, label));
    const total = s.total || 0;
    body.replaceChildren(
      h('div', { class: 'h2' }, 'Сейчас'),
      h('div', { class: 'kpis' },
        k(num(s.online), 'онлайн', true, true),
        k(num(s.dau), 'играли сегодня', true),
        k(num(total), 'игроков всего', true),
        k(num(s.wau), 'за 7 дней'),
        k(num(s.mau), 'за 30 дней'),
        k('+' + num(s.new_today), 'новых сегодня'),
        k('+' + num(s.new_week), 'новых за неделю'),
        k(s.ret1 == null ? '-' : s.ret1 + '%', 'вернулись на 2-й день'),
        k(num(s.refs), 'пришли по приглашению'),
        k(s.avg_sessions == null ? '-' : String(s.avg_sessions).replace('.', ','), 'заходов на игрока'),
        k(s.avg_play_min == null ? '-' : num(s.avg_play_min) + ' мин', 'в игре на игрока'),
        k(num(s.banned), 'заблокировано')),
      h('div', { class: 'h2' }, 'Две недели'),
      h('div', { class: 'card chart' }, chart(s.days || []),
        h('div', { class: 'legend' }, h('span', null, h('i', { style: { background: 'var(--gold)' } }), 'новые'), h('span', null, h('i', { style: { background: 'var(--mint)' } }), 'играли'))),
      h('div', { class: 'h2' }, 'Ранги лавок'),
      h('div', { class: 'card' }, bars(RANKS.map((n, i) => [n, (s.ranks || {})[i] || 0]), total)),
      h('div', { class: 'h2' }, 'Версии игры за неделю'),
      h('div', { class: 'card' }, bars(Object.entries(s.versions || {}).sort((a, b) => b[1] - a[1]), Object.values(s.versions || {}).reduce((a, b) => a + b, 0))));
  }
  function bars(rows, total) {
    if (!rows.length || !total) return h('div', { class: 'empty' }, 'Пока нет данных');
    const max = Math.max(...rows.map((r) => r[1]), 1);
    return h('div', { class: 'bars' }, rows.map(([n, v]) => h('div', { class: 'bar' },
      h('span', null, n), h('span', null, h('b', null, num(v)), h('span', { class: 'dim' }, ' · ' + Math.round(100 * v / total) + '%')),
      h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: (100 * v / max) + '%' } })))));
  }
  function chart(days) {
    const NS = 'http://www.w3.org/2000/svg';
    const W = 340, H = 150, P = 18;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (H + 22));
    const max = Math.max(1, ...days.map((d) => Math.max(d.new, d.act)));
    const n = days.length || 1, step = (W - P) / n, bw = Math.min(14, step * 0.5);
    const el = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
    [0, 0.5, 1].forEach((f) => {
      const y = H - (H - 12) * f;
      el('line', { x1: P, x2: W, y1: y, y2: y, stroke: '#4B357C', 'stroke-dasharray': '3 4' });
      const t = el('text', { x: 0, y: y + 4, fill: '#8A78AE', 'font-size': 10, 'font-weight': 800 }); t.textContent = Math.round(max * f);
    });
    let path = '';
    days.forEach((d, i) => {
      const x = P + step * i + step / 2;
      const bh = (H - 12) * d.new / max;
      el('rect', { x: x - bw / 2, y: H - bh, width: bw, height: Math.max(bh, d.new ? 2 : 0), rx: 3, fill: '#FFC94D' });
      const y = H - (H - 12) * d.act / max;
      path += (i ? 'L' : 'M') + x + ' ' + y;
      if (i % 2 === (n - 1) % 2) { const t = el('text', { x, y: H + 16, fill: '#8A78AE', 'font-size': 9.5, 'font-weight': 800, 'text-anchor': 'middle' }); t.textContent = d.d.slice(0, 5); }
    });
    el('path', { d: path, fill: 'none', stroke: '#5BE0B3', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    days.forEach((d, i) => { const x = P + step * i + step / 2; el('circle', { cx: x, cy: H - (H - 12) * d.act / max, r: 3.5, fill: '#5BE0B3', stroke: '#1B1030', 'stroke-width': 2 }); });
    return svg;
  }

  // ---------- игроки ----------
  const PL = { q: '', filter: '', sort: 'seen', rows: [], total: 0 };
  const FILTERS = [['', 'Все'], ['online', 'Онлайн'], ['new', 'Новые'], ['limited', 'Ограничены'], ['banned', 'Баны']];
  const SORTS = [['seen', 'Последний вход'], ['le', 'Больше сварили'], ['cr', 'Больше кристаллов'], ['lvl', 'Выше уровень'], ['play', 'Дольше играют'], ['new', 'Новые сначала']];
  let searchT = 0;
  async function renderPlayers(id, reset) {
    const list = h('div', { class: 'list' }, skeleton(6));
    const count = h('span', null, '');
    const search = h('input', { type: 'search', placeholder: 'Имя, @ник или ID', value: PL.q, enterkeyhint: 'search' });
    search.addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(() => { PL.q = search.value; loadPlayers(list, count, true); }, 350); });
    const chips = h('div', { class: 'chips' }, FILTERS.map(([v, l]) => h('button', { class: 'chip' + (PL.filter === v ? ' on' : ''), onclick: (e) => {
      PL.filter = v; chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === e.currentTarget)); haptic(); loadPlayers(list, count, true);
    } }, l)));
    const sort = h('select', { onchange: () => { PL.sort = sort.value; loadPlayers(list, count, true); } }, SORTS.map(([v, l]) => h('option', { value: v, selected: PL.sort === v }, l)));
    body.replaceChildren(h('div', { class: 'search' }, search), chips, h('div', { class: 'sortline' }, count, sort), list);
    await loadPlayers(list, count, reset !== false, id);
  }
  async function loadPlayers(list, count, reset, id) {
    if (reset) { PL.rows = []; list.replaceChildren(...skeleton(6)); }
    let r;
    try { r = await api('adm_players', { p_q: PL.q, p_sort: PL.sort, p_filter: PL.filter, p_limit: 40, p_offset: PL.rows.length }); }
    catch (e) { list.replaceChildren(failBox(e)); return; }
    if (id && stale(id)) return;
    PL.total = r.total || 0;
    PL.rows = PL.rows.concat(r.rows || []);
    count.textContent = num(PL.total) + ' ' + word(PL.total, 'игрок', 'игрока', 'игроков');
    if (!PL.rows.length) { list.replaceChildren(h('div', { class: 'empty' }, PL.q ? 'Никого не нашёл' : 'Игроков пока нет')); return; }
    list.replaceChildren(...PL.rows.map(playerRow));
    if (PL.rows.length < PL.total) {
      list.append(h('button', { class: 'btn alt more', onclick: (e) => { e.currentTarget.disabled = true; loadPlayers(list, count, false); } }, 'Показать ещё'));
    }
  }
  function playerRow(p) {
    const sortVal = { le: ['сварено', num(p.le)], cr: ['кристаллов', num(p.cr)], lvl: ['уровень', p.lvl], play: ['в игре', dur(p.play_sec)], new: ['пришёл', date(p.first_seen)] }[PL.sort] || ['эссенции', num(p.ess)];
    return h('button', { class: 'row' + (p.banned ? ' ban' : ''), onclick: () => { haptic(); openPlayer(p.id); } },
      h('span', { class: 'ava', style: { backgroundImage: 'url("' + avatarSrc(p.photo) + '")' } }, online(p.last_seen) ? h('i', { class: 'on' }) : null),
      h('span', { class: 'who' },
        h('b', null, p.name || 'Без имени', h('span', { class: 'tags' },
          p.banned ? h('i', { class: 'tag red' }, 'БАН') : null,
          p.top_ban ? h('i', { class: 'tag' }, 'без топа') : null,
          p.no_gift ? h('i', { class: 'tag' }, 'без подарков') : null,
          p.premium ? h('i', { class: 'tag gold' }, '★') : null)),
        h('small', null, 'Ур. ' + p.lvl + ' · ' + (RANKS[p.rnk] || '-') + ' · ' + ago(p.last_seen))),
      h('span', { class: 'nums' }, h('b', null, sortVal[1]), h('small', null, sortVal[0])));
  }

  // ---------- карточка игрока ----------
  let sheetEl = null, sheetPrevScroll = 0;
  function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; document.body.style.overflow = ''; window.scrollTo(0, sheetPrevScroll); } }
  async function openPlayer(pid) {
    closeSheet();
    sheetPrevScroll = window.scrollY;
    const inner = h('main', null, skeleton(5));
    sheetEl = h('div', { class: 'sheet' },
      h('div', { class: 'top' }, h('div', { class: 'top-in' },
        h('button', { class: 'ibtn', 'aria-label': 'Назад', onclick: closeSheet }, '←'),
        h('h1', { class: 'grow' }, 'Игрок'),
        h('button', { class: 'ibtn', 'aria-label': 'Обновить', onclick: () => openPlayer(pid) }, '⟳'))),
      inner);
    document.body.append(sheetEl);
    document.body.style.overflow = 'hidden';
    let p;
    try { p = await api('adm_player', { p_id: pid }); } catch (e) { inner.replaceChildren(failBox(e)); return; }
    if (!p) { inner.replaceChildren(h('div', { class: 'empty' }, 'Игрок не найден')); return; }
    inner.replaceChildren(...playerView(p));
  }

  function playerView(p) {
    const id = p.tg_id;
    const reopen = () => openPlayer(id);
    const st = (label, v) => h('div', { class: 'stat' }, h('span', null, label), h('b', null, v));
    const out = [];
    out.push(h('div', { class: 'hero' },
      h('span', { class: 'ava big', style: { backgroundImage: 'url("' + avatarSrc(p.photo) + '")' } }, online(p.last_seen) ? h('i', { class: 'on' }) : null),
      h('div', null,
        h('h2', null, p.name || 'Без имени'),
        h('div', { class: 'id' }, 'ID ' + id, p.username ? [' · ', h('a', { href: 'https://t.me/' + p.username, target: '_blank' }, '@' + p.username)] : null),
        h('div', { class: 'tags', style: { marginLeft: 0, marginTop: '5px' } },
          online(p.last_seen) ? h('i', { class: 'tag mint' }, 'онлайн') : h('i', { class: 'tag' }, ago(p.last_seen)),
          p.banned ? h('i', { class: 'tag red' }, 'БАН') : null,
          p.premium ? h('i', { class: 'tag gold' }, 'Premium') : null,
          p.lang ? h('i', { class: 'tag' }, p.lang) : null))));

    out.push(h('div', { class: 'h2' }, 'Прогресс'),
      h('div', { class: 'grid2' },
        st('Ранг', RANKS[p.rnk] || '-'), st('Уровень', p.lvl),
        st('Эссенция сейчас', num(p.ess)), st('Сварено всего', num(p.le)),
        st('Доход в час', num(p.ph)), st('Кристаллы', num(p.cr)),
        st('Мастерство', num(p.mastery)), st('Время в игре', dur(p.play_sec)),
        st('Заходов', num(p.sessions)), st('Дней в игре', num(p.days)),
        st('Первый вход', date(p.first_seen)), st('Версия', p.ver || '-')));

    out.push(h('div', { class: 'card', style: { marginTop: '10px' } },
      kv('Пригласил его', p.ref ? (p.ref_name || 'ID ' + p.ref) : 'никто'),
      kv('Он пригласил', num(p.invited) + ' ' + word(p.invited, 'друга', 'друзей', 'друзей')),
      kv('Сохранение обновлено', dateTime(p.save_at)),
      (p.scores || []).filter((s) => s.period === 'all').map((s) => kv('Топ «' + (s.board === 'mastery' ? 'Мастерство' : 'Полка зелий') + '»', num(s.score)))));

    // подарок
    const gCr = h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: '0', min: '0' });
    const gH = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: '0', min: '0' });
    const gTitle = h('input', { class: 'input', value: 'Подарок от лавки', maxlength: '80' });
    const gText = h('textarea', { class: 'input', rows: '2', placeholder: 'Пара тёплых слов (необязательно)' });
    out.push(h('div', { class: 'h2' }, 'Подарок письмом'),
      h('div', { class: 'card' },
        h('div', { class: 'grid2' }, field('Кристаллы', gCr), field('Часы дохода', gH)),
        field('Заголовок', gTitle), field('Текст', gText),
        h('button', { class: 'btn', style: { width: '100%' }, onclick: async (e) => {
          const cr = Math.max(0, Math.floor(+gCr.value || 0)), hh = Math.max(0, +gH.value || 0);
          if (!gTitle.value.trim()) { toast('Нужен заголовок', true); return; }
          e.currentTarget.disabled = true;
          const ok = await act('adm_mail_send', { p_to: id, p_title: gTitle.value.trim(), p_body: gText.value.trim(), p_gift: { cr, ess_h: hh }, p_days: 0 },
            cr || hh ? 'Подарок отправлен, придёт в почту' : 'Письмо отправлено');
          if (ok) reopen(); else e.currentTarget.disabled = false;
        } }, '✉ Отправить в почту игрока'),
        h('p', { class: 'dim center', style: { margin: '8px 0 0' } }, 'Часы дохода - эссенция, которую лавка игрока зарабатывает за это время.')));

    // правка сохранения
    const eCr = h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: String(p.cr) });
    const eE = h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: String(Math.floor(p.ess)) });
    const eLvl = h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: String(p.lvl) });
    const eRank = h('select', { class: 'input' }, h('option', { value: '' }, 'не менять (' + (RANKS[p.rnk] || '-') + ')'), RANKS.map((n, i) => h('option', { value: String(i) }, (i + 1) + '. ' + n)));
    const eName = h('input', { class: 'input', maxlength: '20', placeholder: p.name || '' });
    out.push(h('div', { class: 'h2' }, 'Изменить сохранение'),
      h('div', { class: 'card' },
        h('div', { class: 'grid2' }, field('Кристаллы станет', eCr), field('Эссенция станет', eE), field('Уровень', eLvl), field('Имя', eName)),
        field('Ранг лавки', eRank),
        h('button', { class: 'btn mint', style: { width: '100%' }, onclick: async () => {
          const ops = {};
          if (eCr.value !== '') ops.set_cr = Math.max(0, Math.floor(+eCr.value));
          if (eE.value !== '') ops.set_e = Math.max(0, +eE.value);
          if (eLvl.value !== '') ops.set_lvl = Math.max(1, Math.floor(+eLvl.value));
          if (eName.value.trim()) ops.set_name = eName.value.trim();
          if (eRank.value !== '') ops.set_le = RANK_NEED[+eRank.value];
          if (!Object.keys(ops).length) { toast('Ничего не изменено', true); return; }
          if (await confirmBox('Применить правку?', 'Изменения применятся, когда игрок откроет игру (или в течение 5 минут, если он сейчас играет).', 'Применить')) {
            if (await act('adm_patch', { p_id: id, ops }, 'Правка отправлена')) reopen();
          }
        } }, 'Применить правку'),
        h('p', { class: 'dim center', style: { margin: '8px 0 0' } }, 'Пустые поля не меняются. Игра применит правку при следующем входе игрока.'),
        (p.patches || []).length ? h('div', { style: { marginTop: '10px' } }, p.patches.map((x) => h('div', { class: 'kv' },
          h('span', null, dateTime(x.at) + ' · ' + opsText(x.ops)),
          x.done ? h('b', { style: { color: 'var(--mint)' } }, '✓ применена') : h('button', { class: 'btn alt small', onclick: async () => {
            if (await act('adm_patch_cancel', { p_id: x.id }, 'Правка отменена')) reopen();
          } }, 'Отменить')))) : null));

    // ограничения
    const tog = (label, hint, on, danger, onChange) => {
      const sw = h('button', { class: 'sw' + (on ? ' on' : '') + (danger ? ' danger' : ''), role: 'switch', 'aria-label': label });
      sw.addEventListener('click', async () => { const v = !sw.classList.contains('on'); if (await onChange(v)) sw.classList.toggle('on', v); });
      return h('div', { class: 'tog' }, h('div', { class: 't' }, h('b', null, label), h('small', null, hint)), sw);
    };
    const reason = h('input', { class: 'input', placeholder: 'Причина бана (увидит игрок)', value: p.ban_reason || '', maxlength: '200' });
    out.push(h('div', { class: 'h2' }, 'Ограничения'),
      h('div', { class: 'card' },
        tog('Заблокировать', 'Игрок увидит экран «Доступ закрыт» и пропадёт из топов', p.banned, true, async (v) => {
          if (v && !(await confirmBox('Заблокировать ' + (p.name || 'игрока') + '?', 'Игра закроется для него при следующей проверке.', 'Заблокировать', true))) return false;
          return act('adm_set_player', { p_id: id, f: { banned: v, ban_reason: reason.value.trim() } }, v ? 'Игрок заблокирован' : 'Блокировка снята');
        }),
        h('div', { style: { padding: '0 0 10px' } }, h('div', { class: 'inline' }, reason,
          h('button', { class: 'btn alt small', onclick: () => act('adm_set_player', { p_id: id, f: { ban_reason: reason.value.trim() } }, 'Причина сохранена') }, 'OK'))),
        tog('Убрать из топов', 'Очки не записываются, в рейтингах его не видно', p.top_ban, true, (v) => act('adm_set_player', { p_id: id, f: { top_ban: v } }, v ? 'Убран из топов' : 'Снова в топах')),
        tog('Без подарков из общих писем', 'Не сможет забирать подарки из писем «всем»', p.no_gift, true, (v) => act('adm_set_player', { p_id: id, f: { no_gift: v } }, 'Сохранено')),
        h('div', { class: 'btns', style: { marginTop: '10px' } },
          h('button', { class: 'btn alt small', onclick: async () => {
            if (await confirmBox('Удалить очки из топов?', 'Все результаты игрока в рейтингах будут стёрты.', 'Удалить', true)) { if (await act('adm_score_delete', { p_id: id, p_board: 'all' }, 'Очки удалены')) reopen(); }
          } }, 'Стереть очки в топах'),
          h('button', { class: 'btn red small', onclick: async () => {
            if (await confirmBox('Сбросить прогресс?', 'Лавка игрока начнётся с нуля при следующем входе. Отменить нельзя (только пока правка не применена).', 'Сбросить', true)) { if (await act('adm_patch', { p_id: id, ops: { reset: true } }, 'Сброс отправлен')) reopen(); }
          } }, 'Сбросить прогресс'))));

    // заметка
    const note = h('textarea', { class: 'input', rows: '3', placeholder: 'Видишь только ты' }, p.note || '');
    out.push(h('div', { class: 'h2' }, 'Заметка'),
      h('div', { class: 'card' }, note, h('button', { class: 'btn alt small', style: { marginTop: '8px' }, onclick: () => act('adm_set_player', { p_id: id, f: { note: note.value } }, 'Заметка сохранена') }, 'Сохранить заметку')));

    // письма
    if ((p.mail || []).length) {
      out.push(h('div', { class: 'h2' }, 'Личные письма'),
        h('div', { class: 'card' }, p.mail.map((m) => h('div', { class: 'kv' },
          h('span', null, dateTime(m.at) + ' · ' + m.title + giftText(m.gift)),
          h('b', null, m.claimed ? '🎁 забрал' : m.read ? 'прочитал' : 'не открыл')))));
    }

    // сохранение
    out.push(h('div', { class: 'h2' }, 'Сохранение игрока'), saveView(p.save));
    return out;
  }
  const kv = (k, v) => h('div', { class: 'kv' }, h('span', null, k), h('b', null, v));
  const field = (label, input) => h('label', { class: 'field' }, h('span', null, label), input);
  function giftText(g) {
    if (!g) return '';
    const a = [];
    if (g.cr) a.push(g.cr + ' 💎');
    if (g.ess_h) a.push(g.ess_h + ' ч дохода');
    return a.length ? ' · ' + a.join(', ') : '';
  }
  function opsText(o) {
    const names = { set_cr: 'кристаллы =', add_cr: 'кристаллы +', set_e: 'эссенция =', add_e: 'эссенция +', add_ess_h: 'часы дохода +', set_lvl: 'уровень =', set_le: 'ранг по', set_name: 'имя =' };
    if (o.reset) return 'СБРОС';
    return Object.keys(o).map((k) => k === 'set_le' ? 'ранг: ' + (RANKS[RANK_NEED.indexOf(o[k])] || num(o[k])) : (names[k] || k) + ' ' + (typeof o[k] === 'number' ? num(o[k]) : o[k])).join(', ');
  }
  function saveView(sv) {
    if (!sv) return h('div', { class: 'card empty' }, 'Игра ещё не прислала сохранение');
    const LABELS = {
      e: 'Эссенция', le: 'Сварено всего', taps: 'Тапов', cards: 'Карточки (уровни)', scoop: 'Черпак', pantry: 'Кладовая', vis: 'Заказы жителей',
      served: 'Обслужено жителей', cr: 'Кристаллы', fr: 'Дружба', prof: 'Профиль', own: 'Куплено', wear: 'Гардероб', stat: 'Статистика',
      lvl: 'Уровень', xp: 'Опыт', sk: 'Навыки', ing: 'Ингредиенты', bag: 'Зелья в сумке', book: 'Рецепты', brewed: 'Сварено зелий', pets: 'Питомцы',
      story: 'Истории жителей', req: 'Просьбы', mg: 'Мини-игры', ac: 'Достижения', ev: 'Событие', q: 'Задания дня', daily: 'Подарок дня', fx: 'Эффекты'
    };
    const simple = [], complex = [];
    Object.keys(sv).forEach((k) => {
      const v = sv[k];
      if (v === null || typeof v !== 'object') simple.push([k, v]); else complex.push([k, v]);
    });
    const fmtV = (v) => typeof v === 'number' ? (Math.abs(v) >= 1e4 ? num(v) : String(Math.round(v * 100) / 100)) : typeof v === 'boolean' ? (v ? 'да' : 'нет') : esc(v) || '-';
    return h('div', null,
      h('div', { class: 'card' }, simple.filter(([k]) => LABELS[k]).map(([k, v]) => kv(LABELS[k], fmtV(v)))),
      h('div', { style: { marginTop: '8px' } }, complex.map(([k, v]) => {
        const n = Array.isArray(v) ? v.length : Object.keys(v).length;
        return h('details', null, h('summary', null, h('span', null, (LABELS[k] || k), h('span', { class: 'dim' }, ' · ' + n))), h('pre', null, JSON.stringify(v, null, 1)));
      }),
      h('details', null, h('summary', null, 'Всё сохранение целиком'), h('pre', null, JSON.stringify(sv, null, 1)))));
  }

  // ---------- почта ----------
  async function renderMail(id) {
    const to = { all: true };
    const toSeg = h('div', { class: 'seg' });
    const toId = h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: 'ID игрока (из карточки)', style: { display: 'none', marginTop: '8px' } });
    const setTo = (all) => { to.all = all; toSeg.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', (i === 0) === all)); toId.style.display = all ? 'none' : ''; upd(); };
    toSeg.append(h('button', { class: 'on', onclick: () => setTo(true) }, 'Всем игрокам'), h('button', { onclick: () => setTo(false) }, 'Одному игроку'));
    const title = h('input', { class: 'input', maxlength: '80', placeholder: 'Например: Подарок к выходным!' });
    const text = h('textarea', { class: 'input', rows: '4', maxlength: '2000', placeholder: 'Текст письма' });
    const cr = h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: '0', min: '0' });
    const hrs = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: '0', min: '0' });
    const days = h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: 'бессрочно', min: '0' });
    const prev = h('div', { class: 'preview' });
    function upd() {
      const g = [];
      if (+cr.value > 0) g.push(Math.floor(+cr.value) + ' ' + word(+cr.value, 'кристалл', 'кристалла', 'кристаллов'));
      if (+hrs.value > 0) g.push(hrs.value + ' ч дохода');
      prev.replaceChildren(
        h('div', { class: 'dim' }, 'Так увидит игрок' + (to.all ? ' (все)' : '') + ':'),
        h('div', { class: 'mail', style: { marginTop: '6px' } }, h('img', { class: 'ic', src: IMG(g.length ? 'ui/gift' : 'ui/envelope'), alt: '' }),
          h('div', { class: 't' }, h('b', null, title.value || 'Заголовок'), h('p', null, text.value || 'Текст письма'), g.length ? h('b', null, '🎁 ' + g.join(' + ')) : null)));
    }
    [title, text, cr, hrs].forEach((x) => x.addEventListener('input', upd));
    upd();
    const send = h('button', { class: 'btn', style: { width: '100%', marginTop: '10px' }, onclick: async () => {
      if (!title.value.trim()) { toast('Напиши заголовок', true); return; }
      const target = to.all ? 0 : Math.floor(+toId.value || 0);
      if (!to.all && !target) { toast('Укажи ID игрока', true); return; }
      const g = { cr: Math.max(0, Math.floor(+cr.value || 0)), ess_h: Math.max(0, +hrs.value || 0) };
      if (!(await confirmBox(to.all ? 'Отправить всем?' : 'Отправить игроку?', to.all ? 'Письмо увидят все игроки, а у кого игра открыта - в течение 5 минут.' : 'Письмо придёт игроку ' + target + '.', 'Отправить'))) return;
      send.disabled = true;
      const ok = await act('adm_mail_send', { p_to: target, p_title: title.value.trim(), p_body: text.value.trim(), p_gift: g, p_days: Math.max(0, Math.floor(+days.value || 0)) }, 'Письмо отправлено');
      send.disabled = false;
      if (ok) { title.value = ''; text.value = ''; cr.value = ''; hrs.value = ''; days.value = ''; upd(); loadSent(); }
    } }, '✉ Отправить');
    const sent = h('div', null, skeleton(3));
    body.replaceChildren(
      h('div', { class: 'h2' }, 'Новое письмо'),
      h('div', { class: 'card' },
        field('Кому', h('div', null, toSeg, toId)),
        field('Заголовок', title), field('Текст', text),
        h('div', { class: 'grid2' }, field('💎 Кристаллы', cr), field('⏳ Часы дохода', hrs)),
        field('Сколько дней письмо будет в почте', days),
        prev, send),
      h('div', { class: 'h2' }, 'Отправленные'), sent);
    async function loadSent() {
      let rows;
      try { rows = await api('adm_mail_list'); } catch (e) { sent.replaceChildren(failBox(e)); return; }
      if (stale(id) && tab !== 'mail') return;
      if (!rows || !rows.length) { sent.replaceChildren(h('div', { class: 'card empty' }, 'Писем ещё не было')); return; }
      sent.replaceChildren(...rows.map((m) => h('div', { class: 'card mail' },
        h('img', { class: 'ic', src: IMG(m.gift && Object.keys(m.gift).length ? 'ui/gift' : 'ui/envelope'), alt: '' }),
        h('div', { class: 't' },
          h('b', null, m.title),
          h('p', null, m.body),
          h('div', { class: 'dim' }, (m.to ? 'Игроку ' + (m.to_name || m.to) : 'Всем') + ' · ' + dateTime(m.at) + giftText(m.gift) + (m.until ? ' · до ' + date(m.until) : '')),
          h('div', { class: 'dim' }, '👁 ' + num(m.read) + ' прочитали' + (m.gift && Object.keys(m.gift).length ? ' · 🎁 ' + num(m.claimed) + ' забрали' : ''))),
        h('button', { class: 'ibtn', 'aria-label': 'Удалить', onclick: async () => {
          if (await confirmBox('Удалить письмо?', 'Оно пропадёт из почты у всех. Уже полученные подарки останутся у игроков.', 'Удалить', true)) { if (await act('adm_mail_delete', { p_id: m.id }, 'Письмо удалено')) loadSent(); }
        } }, '🗑'))));
    }
    await loadSent();
  }

  // ---------- настройки лавки ----------
  async function renderShop(id) {
    body.replaceChildren(...skeleton(3));
    let s;
    try { s = await api('adm_settings'); } catch (e) { if (!stale(id)) body.replaceChildren(failBox(e)); return; }
    if (stale(id)) return;
    s = s || {};
    const reload = () => render();

    // бонус дохода
    const b = s.boost || null;
    const bLive = b && +b.mult > 1 && Date.parse(b.until) > Date.now();
    let mult = bLive ? +b.mult : 2;
    const multSeg = h('div', { class: 'seg' });
    [1.5, 2, 3, 5].forEach((m) => multSeg.append(h('button', { class: m === mult ? 'on' : '', onclick: (e) => { mult = m; multSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === e.currentTarget)); } }, 'x' + String(m).replace('.', ','))));
    let hours = 48;
    const hSeg = h('div', { class: 'seg' });
    [[2, '2 ч'], [24, 'Сутки'], [48, '2 дня'], [168, 'Неделя']].forEach(([v, l]) => hSeg.append(h('button', { class: v === hours ? 'on' : '', onclick: (e) => { hours = v; hSeg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === e.currentTarget)); } }, l)));
    const bLabel = h('input', { class: 'input', maxlength: '40', placeholder: 'Подпись, например: выходные', value: (b && b.label) || '' });

    // объявление
    const a = s.announce || null;
    const aTitle = h('input', { class: 'input', maxlength: '60', placeholder: 'Новости лавки', value: (a && a.title) || '' });
    const aText = h('textarea', { class: 'input', rows: '4', maxlength: '1000', placeholder: 'Что увидят игроки при входе' }, (a && a.text) || '');

    // техработы
    const m = s.maint || null;
    const mText = h('input', { class: 'input', maxlength: '200', placeholder: 'Мы немножко подкручиваем котёл. Загляни чуть позже!', value: (m && m.text) || '' });
    const mSw = h('button', { class: 'sw danger' + (m && m.on ? ' on' : ''), role: 'switch', 'aria-label': 'Техработы' });
    mSw.addEventListener('click', async () => {
      const on = !mSw.classList.contains('on');
      if (on && !(await confirmBox('Закрыть игру на техработы?', 'Все игроки, кроме тебя, увидят экран «Лавка на ремонте».', 'Закрыть', true))) return;
      if (await act('adm_setting', { p_k: 'maint', p_v: { on, text: mText.value.trim() } }, on ? 'Игра закрыта на техработы' : 'Игра снова открыта')) mSw.classList.toggle('on', on);
    });

    body.replaceChildren(
      h('div', { class: 'h2' }, 'Бонус дохода'),
      h('div', { class: 'card' },
        h('p', { style: { margin: '0 0 10px' } }, bLive ? h('span', null, '🔥 Сейчас действует ', h('b', { style: { color: 'var(--gold2)' } }, 'x' + String(b.mult).replace('.', ',')), ' до ' + dateTime(b.until) + (b.label ? ' («' + b.label + '»)' : '')) : h('span', { class: 'muted' }, 'Сейчас бонуса нет. Доход и тапы умножатся у всех игроков.')),
        field('Множитель', multSeg), field('Длительность', hSeg), field('Подпись', bLabel),
        h('div', { class: 'btns' },
          h('button', { class: 'btn', onclick: async () => {
            const until = new Date(Date.now() + hours * 3600000).toISOString();
            if (await act('adm_setting', { p_k: 'boost', p_v: { mult, until, label: bLabel.value.trim() } }, 'Бонус включён')) reload();
          } }, bLive ? 'Обновить' : 'Включить'),
          h('button', { class: 'btn alt', disabled: !b, onclick: async () => { if (await act('adm_setting', { p_k: 'boost', p_v: null }, 'Бонус выключен')) reload(); } }, 'Выключить'))),

      h('div', { class: 'h2' }, 'Объявление при входе'),
      h('div', { class: 'card' },
        h('p', { class: 'dim', style: { margin: '0 0 10px' } }, a ? 'Опубликовано ' + dateTime(new Date(+a.id).toISOString()) + '. Каждый игрок увидит его один раз.' : 'Окно с текстом, которое игрок увидит один раз при входе.'),
        field('Заголовок', aTitle), field('Текст', aText),
        h('div', { class: 'btns' },
          h('button', { class: 'btn', onclick: async () => {
            if (!aText.value.trim()) { toast('Напиши текст', true); return; }
            if (await act('adm_setting', { p_k: 'announce', p_v: { id: Date.now(), title: aTitle.value.trim(), text: aText.value.trim() } }, 'Объявление опубликовано')) reload();
          } }, a ? 'Опубликовать заново' : 'Опубликовать'),
          h('button', { class: 'btn alt', disabled: !a, onclick: async () => { if (await act('adm_setting', { p_k: 'announce', p_v: null }, 'Объявление снято')) reload(); } }, 'Снять'))),

      h('div', { class: 'h2' }, 'Техработы'),
      h('div', { class: 'card' },
        h('div', { class: 'tog' }, h('div', { class: 't' }, h('b', null, 'Закрыть игру'), h('small', null, 'Все, кроме тебя, увидят экран ремонта')), mSw),
        field('Текст на экране', mText)),

      h('div', { class: 'h2' }, 'Ссылки'),
      h('div', { class: 'card' },
        kv('Игра', 't.me/bulkgamemagikbot?startapp'),
        kv('Сайт', 'vitalya2078-cloud.github.io/bulk'),
        h('div', { class: 'btns', style: { marginTop: '10px' } },
          h('button', { class: 'btn alt small', onclick: () => { try { tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent('https://t.me/bulkgamemagikbot?startapp') + '&text=' + encodeURIComponent('Заходи в мою волшебную лавку «Бульк»!')); } catch (e) { toast('Открой в Telegram', true); } } }, 'Поделиться игрой'),
          h('button', { class: 'btn alt small', onclick: () => { try { tg.openLink('https://supabase.com/dashboard/project/ahqaficklfciahzlghec'); } catch (e) { window.open('https://supabase.com/dashboard/project/ahqaficklfciahzlghec'); } } }, 'Открыть Supabase'))));
  }

  // ---------- журнал ----------
  async function renderLog(id) {
    body.replaceChildren(h('div', { class: 'h2' }, 'Действия администратора'), ...skeleton(5));
    let rows;
    try { rows = await api('adm_log'); } catch (e) { if (!stale(id)) body.replaceChildren(failBox(e)); return; }
    if (stale(id)) return;
    body.replaceChildren(h('div', { class: 'h2' }, 'Действия администратора'),
      !rows || !rows.length ? h('div', { class: 'card empty' }, 'Пока пусто') :
        h('div', { class: 'card' }, rows.map((l) => h('div', { class: 'log' },
          h('b', null, ({ 'Настройка boost': 'Бонус дохода', 'Настройка announce': 'Объявление', 'Настройка maint': 'Техработы' })[l.action] || l.action), l.target ? [' · ', h('a', { href: '#', style: { color: 'var(--sky)' }, onclick: (e) => { e.preventDefault(); openPlayer(l.target); } }, l.name || 'ID ' + l.target)] : null,
          detailText(l) ? h('div', { class: 'muted' }, detailText(l)) : null,
          h('small', null, dateTime(l.at))))));
  }

  function detailText(l) {
    const d = l.details || {};
    if (!Object.keys(d).length) return '';
    if (/^Письмо/.test(l.action)) return '«' + (d.title || '') + '»' + giftText(d.gift);
    if (l.action === 'Правка сохранения') return opsText(d);
    if (l.action === 'Изменил игрока') {
      const a = [];
      if ('banned' in d) a.push(d.banned ? 'заблокирован' : 'разблокирован');
      if (d.ban_reason) a.push('причина: ' + d.ban_reason);
      if ('top_ban' in d) a.push(d.top_ban ? 'убран из топов' : 'возвращён в топы');
      if ('no_gift' in d) a.push(d.no_gift ? 'без общих подарков' : 'общие подарки разрешены');
      if ('note' in d) a.push('заметка изменена');
      return a.join(', ');
    }
    if (l.action === 'Настройка boost') return d.mult ? 'x' + String(d.mult).replace('.', ',') + ' до ' + dateTime(d.until) + (d.label ? ' («' + d.label + '»)' : '') : 'выключен';
    if (l.action === 'Настройка announce') return d.text ? '«' + (d.title || 'Новости лавки') + '»: ' + d.text.slice(0, 80) : 'снято';
    if (l.action === 'Настройка maint') return d.on ? 'игра закрыта' : 'игра открыта';
    if (d.board) return d.board === 'all' ? 'все топы' : d.board;
    return '';
  }

  // ---------- вход ----------
  function stateScreen(img, title, text, extra) {
    $('app').replaceChildren(h('div', { class: 'state' }, h('div', null, h('img', { src: IMG(img), alt: '' }), h('h2', null, title), h('p', null, text), extra || null)));
  }
  async function boot() {
    setupTelegram();
    if (!initData) {
      stateScreen('ui/padlock', 'Открой через Telegram', 'Админ-панель работает только внутри Telegram: так база узнаёт, что это ты. Зайди в игру через бота → Настройки → «Админ-панель».',
        h('button', { class: 'btn', onclick: () => { location.href = '../'; } }, 'В игру'));
      return;
    }
    stateScreen('ui/hourglass', 'Проверяю доступ...', 'Секундочку');
    let ok;
    try { ok = await api('adm_claim'); } catch (e) {
      stateScreen('ui/padlock', 'Нет связи с базой', errText(e), h('button', { class: 'btn', onclick: boot }, 'Повторить'));
      return;
    }
    if (!ok) {
      stateScreen('ui/padlock', 'Нет доступа', 'Эта страница только для администратора лавки. Твой ID:', h('div', null, h('code', null, me ? me.id : '-')));
      return;
    }
    shell();
    render();
  }
  boot();
})();

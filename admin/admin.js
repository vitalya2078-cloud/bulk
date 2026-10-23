// =====================================================================
//  Бульк · Админ. Работает внутри Telegram и ВК (из настроек игры), в браузере
//  и в приложении «Бульк Админ» (вход по коду из игры).
//  Каждое действие проверяет база: роль и права берутся по подписи платформы или ключу приложения.
// =====================================================================
(() => {
  'use strict';
  const URL_RPC = 'https://ahqaficklfciahzlghec.supabase.co/rest/v1/rpc/';
  const KEY = 'sb_publishable_IXd8i1DDSci-bdAZPOZciQ_wsCL9lOx';
  // в приложении страница лежит в телефоне, картинки игры берём с сайта
  const SITE = /github\.io$/.test(location.hostname) || location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? '../' : 'https://vitalya2078-cloud.github.io/bulk/';
  const AVA = (n) => SITE + 'assets/images/avatars/' + n + '.webp';
  const APP = window.BulkApp || null;
  const TOKEN_KEY = 'bulk_adm_token';
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } return null; };
  const RANKS = ['Лоток травницы', 'Лавочка', 'Аптека', 'Мастерская', 'Зельеварня', 'Гильдия алхимиков', 'Академия', 'Королевский алхимик', 'Хранитель Камня'];
  const RANK_NEED = [0, 5e3, 5e4, 5e6, 8e7, 4e8, 2.5e9, 1e10, 6e10];
  const ROLES = { creator: 'Создатель', admin: 'Админ', moderator: 'Модератор', support: 'Поддержка', custom: 'Особые права' };
  const ROLE_TAG = { creator: 'acc', admin: 'blue', moderator: 'green', support: '', custom: '' };
  const ROLE_HINT = {
    admin: 'Всё, кроме команды, техработ и сброса прогресса',
    moderator: 'Баны, топы, заметки, журнал',
    support: 'Личные письма без подарков, заметки',
    custom: 'Отметь права вручную'
  };
  const PERMS = [
    ['ban', 'Баны и топы'], ['gift', 'Подарки'], ['edit', 'Правка сохранений'], ['reset', 'Сброс прогресса'],
    ['mail', 'Личные письма'], ['mail_all', 'Письма всем'], ['notes', 'Заметки'], ['settings', 'Бонусы, объявления'],
    ['maint', 'Техработы'], ['log', 'Журнал']
  ];
  const PERM_NAME = Object.fromEntries(PERMS.concat([['team', 'Команда']]));

  const tg = (window.Telegram && window.Telegram.WebApp) || null;
  const tgData = (tg && tg.initData) || '';
  const tgUser = (tgData && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
  const vkData = /[?&]vk_user_id=/.test(location.search) && /[?&]sign=/.test(location.search) ? 'vk:' + location.search.slice(1) : '';
  // как база узнаёт, кто это: подпись Telegram / ВК или ключ приложения
  let initData = tgData || vkData || (store(TOKEN_KEY) ? 'adm:' + store(TOKEN_KEY) : '');
  const tokenMode = () => initData.startsWith('adm:');
  function openExt(u) {
    try { if (APP && APP.open) { APP.open(u); return; } } catch (e) { /* ignore */ }
    try { if (tgData && tg.openLink) { tg.openLink(u); return; } } catch (e) { /* ignore */ }
    window.open(u, '_blank');
  }
  let ME = { id: 0, role: null, perms: [] };
  const ADM_V = '0.19';
  const can = (p) => ME.perms.includes(p);

  // ---------- значки ----------
  const ICONS = {
    pulse: 'M3 12h4l3-8 4 16 3-8h4',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
    sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
    back: 'M19 12H5M12 19l-7-7 7-7',
    play: 'M6 3l14 9-14 9V3z',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
    gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z',
    check: 'M20 6L9 17l-5-5',
    alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    plus: 'M12 5v14M5 12h14',
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z'
  };
  function icon(name, cls) {
    const NS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', ICONS[name] || '');
    s.append(p);
    return s;
  }

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
    if (!iso) return 'не заходил';
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
  const avatarSrc = (p) => /^[a-z]\d\d$/.test(p || '') ? AVA(p) : /^https:\/\//.test(p || '') ? p : AVA('a01');
  const word = (n, a, b, c) => { n = Math.abs(n) % 100; const d = n % 10; return n > 10 && n < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c; };
  const ava = (photo, on, lg) => h('span', { class: 'ava' + (lg ? ' lg' : ''), style: { backgroundImage: 'url("' + avatarSrc(photo) + '")' } }, on ? h('i', { class: 'on' }) : null);
  const sec = (title, right) => h('div', { class: 'sec' }, h('span', null, title), right ? h('span', { class: 'r' }, right) : null);
  const kv = (k, v) => h('div', { class: 'kv' }, h('span', null, k), h('b', null, v));
  const field = (label, input) => h('label', { class: 'field' }, h('span', null, label), input);
  const roleTag = (r) => r ? h('span', { class: 'tag ' + (ROLE_TAG[r] || '') }, ROLES[r] || r) : null;
  function haptic(t) { try { if (APP && APP.vibrate) { APP.vibrate(t === 'err' ? 60 : t === 'ok' ? 25 : 12); return; } if (tg && tg.HapticFeedback) t === 'ok' ? tg.HapticFeedback.notificationOccurred('success') : t === 'err' ? tg.HapticFeedback.notificationOccurred('error') : tg.HapticFeedback.impactOccurred('light'); } catch (e) { /* ignore */ } }

  let toastT = 0;
  function toast(text, err) {
    const t = $('toast');
    t.replaceChildren(icon(err ? 'alert' : 'check'), h('span', null, text));
    t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.className = 'toast' + (err ? ' err' : ''); }, 2600);
    haptic(err ? 'err' : 'ok');
  }
  function dialog(title, text, content, buttons) {
    return new Promise((res) => {
      const close = (v) => { d.remove(); res(v); };
      const d = h('div', { class: 'dlg', onclick: (e) => { if (e.target === d) close(false); } },
        h('div', { class: 'dlg-box' }, h('h3', null, title), text ? h('p', null, text) : null, content || null,
          h('div', { class: 'btns' }, buttons.map((b) => h('button', { class: 'btn ' + (b.cls || ''), onclick: () => close(b.v) }, b.label)))));
      document.body.append(d);
    });
  }
  const confirmBox = (title, text, ok, danger) => dialog(title, text, null, [{ label: 'Отмена', cls: 'ghost', v: false }, { label: ok || 'Да', cls: danger ? 'danger' : '', v: true }]);

  async function api(fn, body, bare) {
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(URL_RPC + fn, {
        method: 'POST', signal: ctl.signal,
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(bare ? (body || {}) : Object.assign({ init_data: initData }, body || {}))
      });
      const txt = await r.text();
      if (!r.ok) {
        let m = txt; try { m = JSON.parse(txt).message || txt; } catch (e) { /* ignore */ }
        if (/bad session/.test(m) && tokenMode()) { store(TOKEN_KEY, null); initData = ''; setTimeout(() => loginScreen('Вход устарел, войди заново'), 0); }
        throw new Error(m);
      }
      return txt ? JSON.parse(txt) : null;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Сервер долго не отвечает');
      throw e;
    } finally { clearTimeout(tm); }
  }
  function errText(e) {
    const m = String(e && e.message || e);
    const r = m.match(/no right: (\w+)/);
    if (r) return 'Нет права: ' + (PERM_NAME[r[1]] || r[1]);
    if (/not admin/.test(m)) return 'Ты не в команде';
    if (/creator is fixed/.test(m)) return 'Создателя изменить нельзя';
    if (/bad signature|too old/.test(m)) return 'Подпись платформы устарела, открой панель заново';
    if (/bad session/.test(m)) return 'Вход устарел, войди заново';
    if (/no player/.test(m)) return 'Такого игрока нет. Проверь номер (у игроков ВК он с минусом)';
    if (/already pending/.test(m)) return 'Возврат копии уже ждёт игрока';
    if (/no save/.test(m)) return 'Копия не найдена';
    if (/Failed to fetch|NetworkError|долго|Load failed/.test(m)) return 'Нет связи с базой. Проверь интернет или VPN';
    return 'Ошибка: ' + m.slice(0, 120);
  }
  async function act(fn, body, okText) {
    try { const r = await api(fn, body); if (okText) toast(okText); return r === null ? true : r; } catch (e) { toast(errText(e), true); return false; }
  }

  // ---------- Telegram ----------
  function setupTelegram() {
    if (!tgData) return;
    try {
      tg.ready(); tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor('#08090C');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#08090C');
      if (tg.setBottomBarColor) tg.setBottomBarColor('#08090C');
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
  function back() { if (document.querySelector('.dlg')) return; if (sheetEl) { closeSheet(); return; } location.href = '../' + (vkData ? location.search : ''); }
  // кнопка «Назад» телефона в приложении: true - обработали сами, false - приложение свернётся
  window.onAppBack = () => {
    const d = document.querySelector('.dlg');
    if (d) { d.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }
    if (sheetEl) { closeSheet(); return true; }
    if (tab !== 'home' && $('app').querySelector('.nav')) { const b = $('app').querySelector('.nav button[data-t="home"]'); if (b) { b.click(); return true; } }
    return false;
  };

  // ---------- каркас ----------
  const ALL_TABS = [
    { id: 'home', label: 'Обзор', icon: 'pulse', ok: () => true },
    { id: 'players', label: 'Игроки', icon: 'users', ok: () => true },
    { id: 'mail', label: 'Почта', icon: 'mail', ok: () => can('mail') || can('mail_all') },
    { id: 'shop', label: 'Лавка', icon: 'sliders', ok: () => can('settings') || can('maint') },
    { id: 'team', label: 'Команда', icon: 'shield', ok: () => true }
  ];
  let TABS = [];
  let tab = 'home';
  try { tab = sessionStorage.getItem('adm_tab') || 'home'; } catch (e) { /* ignore */ }
  let body, refreshBtn;

  function shell() {
    TABS = ALL_TABS.filter((t) => t.ok());
    if (!TABS.some((t) => t.id === tab)) tab = 'home';
    refreshBtn = h('button', { class: 'ib', 'aria-label': 'Обновить', onclick: () => { haptic(); render(); } }, icon('refresh'));
    body = h('main');
    const nav = h('div', { class: 'nav-in' }, TABS.map((t) => h('button', {
      class: t.id === tab ? 'on' : '', 'data-t': t.id,
      onclick: () => {
        if (tab === t.id) return;
        haptic(); tab = t.id;
        try { sessionStorage.setItem('adm_tab', tab); } catch (e) { /* ignore */ }
        nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
        window.scrollTo(0, 0); render();
      }
    }, icon(t.icon), t.label)));
    $('app').replaceChildren(
      h('div', { class: 'top' }, h('div', { class: 'top-in' },
        h('div', { class: 'mark' }, glyph()),
        h('div', { class: 'title' }, h('b', null, 'Бульк · Админ'), h('small', null, (ROLES[ME.role] || '') + (ME.name ? ' · ' + ME.name : tgUser ? ' · ' + (tgUser.username ? '@' + tgUser.username : tgUser.first_name) : ''))),
        refreshBtn,
        tokenMode() ? null : h('button', { class: 'ib', 'aria-label': 'В игру', onclick: () => { location.href = '../' + (vkData ? location.search : ''); } }, icon('play')))),
      ptr,
      body,
      h('div', { class: 'nav' }, nav));
  }
  const skeleton = (n) => h('div', { class: 'panel list' }, Array.from({ length: n || 4 }, () => h('div', { class: 'skel' })));
  let renderId = 0;
  async function render() {
    const id = ++renderId;
    refreshBtn.classList.add('spin');
    try {
      if (tab === 'home') await renderHome(id);
      else if (tab === 'players') await renderPlayers(id);
      else if (tab === 'mail') await renderMail(id);
      else if (tab === 'shop') await renderShop(id);
      else if (tab === 'team') await renderTeam(id);
    } finally { if (id === renderId) refreshBtn.classList.remove('spin'); }
  }
  const stale = (id) => id !== renderId;
  const failBox = (e) => h('div', { class: 'panel pad center' }, h('p', { class: 'mut', style: { margin: '0 0 12px' } }, errText(e)), h('button', { class: 'btn ghost sm', onclick: render }, 'Повторить'));

  // ---------- обзор ----------
  async function renderHome(id) {
    body.replaceChildren(sec('Сейчас'), skeleton(3));
    let s;
    try { s = await api('adm_stats'); } catch (e) { if (!stale(id)) body.replaceChildren(failBox(e)); return; }
    if (stale(id)) return;
    const k = (v, label, accent, live) => h('div', { class: 'kpi' + (accent ? ' acc' : '') }, live ? h('i', { class: 'dot' }) : null, h('b', null, v), h('span', null, label));
    const total = s.total || 0;
    const vTotal = Object.values(s.versions || {}).reduce((a, b) => a + b, 0);
    body.replaceChildren(
      sec('Сейчас', new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })),
      h('div', { class: 'kpis' },
        k(num(s.online), 'онлайн', true, true),
        k(num(s.dau), 'сегодня', true),
        k(num(total), 'всего игроков', true),
        k(num(s.wau), 'за 7 дней'),
        k(num(s.mau), 'за 30 дней'),
        k('+' + num(s.new_today), 'новых сегодня'),
        k('+' + num(s.new_week), 'новых за неделю'),
        k(s.ret1 == null ? '-' : s.ret1 + '%', 'вернулись на 2-й день'),
        k(num(s.refs), 'по приглашению'),
        k(s.avg_sessions == null ? '-' : String(s.avg_sessions).replace('.', ','), 'заходов на игрока'),
        k(s.avg_play_min == null ? '-' : num(s.avg_play_min) + 'м', 'в игре на игрока'),
        k(num(s.banned), 'заблокировано')),
      sec('14 дней'),
      h('div', { class: 'panel pad chart' }, chart(s.days || []),
        h('div', { class: 'legend' }, h('span', null, h('i', { style: { background: 'var(--acc)' } }), 'новые'), h('span', null, h('i', { style: { background: 'var(--blue)' } }), 'активные'))),
      sec('Ранги лавок'),
      h('div', { class: 'panel pad' }, bars(RANKS.map((n, i) => [n, (s.ranks || {})[i] || 0]), total)),
      sec('Версии за неделю'),
      h('div', { class: 'panel pad' }, bars(Object.entries(s.versions || {}).sort((a, b) => b[1] - a[1]), vTotal)));
  }
  function bars(rows, total) {
    if (!rows.length || !total) return h('div', { class: 'empty' }, 'Пока нет данных');
    const max = Math.max(...rows.map((r) => r[1]), 1);
    return h('div', { class: 'bars' }, rows.map(([n, v]) => h('div', { class: 'bar' },
      h('span', null, n), h('span', { class: 'v' }, h('b', null, num(v)), ' · ' + Math.round(100 * v / total) + '%'),
      h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: (100 * v / max) + '%', opacity: v ? 1 : 0 } })))));
  }
  function chart(days) {
    const NS = 'http://www.w3.org/2000/svg';
    const W = 340, H = 130, P = 22;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (H + 18));
    const max = Math.max(1, ...days.map((d) => Math.max(d.new, d.act)));
    const n = days.length || 1, step = (W - P) / n, bw = Math.min(10, step * 0.42);
    const el = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
    const defs = el('defs', {});
    defs.innerHTML = '<linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6EA8FF" stop-opacity=".22"/><stop offset="1" stop-color="#6EA8FF" stop-opacity="0"/></linearGradient>';
    [0, 0.5, 1].forEach((f) => {
      const y = H - (H - 10) * f;
      el('line', { x1: P, x2: W, y1: y, y2: y, stroke: '#1E222C' });
      const t = el('text', { x: 0, y: y + 3.5, fill: '#5A6170', 'font-size': 9.5, 'font-family': 'ui-monospace, monospace' }); t.textContent = Math.round(max * f);
    });
    let path = '';
    const xs = days.map((d, i) => P + step * i + step / 2);
    days.forEach((d, i) => {
      const x = xs[i];
      const bh = (H - 10) * d.new / max;
      if (d.new) el('rect', { x: x - bw / 2, y: H - bh, width: bw, height: Math.max(bh, 2), rx: 2, fill: '#C4F13B' });
      path += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + (H - (H - 10) * d.act / max).toFixed(1);
      if (i % 2 === (n - 1) % 2) { const t = el('text', { x, y: H + 14, fill: '#5A6170', 'font-size': 9, 'font-family': 'ui-monospace, monospace', 'text-anchor': 'middle' }); t.textContent = d.d.slice(0, 5); }
    });
    if (days.length) {
      el('path', { d: path + 'L' + xs[n - 1] + ' ' + H + 'L' + xs[0] + ' ' + H + 'Z', fill: 'url(#ga)' });
      el('path', { d: path, fill: 'none', stroke: '#6EA8FF', 'stroke-width': 1.8, 'stroke-linejoin': 'round' });
      el('circle', { cx: xs[n - 1], cy: H - (H - 10) * days[n - 1].act / max, r: 3, fill: '#6EA8FF' });
    }
    return svg;
  }

  // ---------- игроки ----------
  const PL = { q: '', filter: '', sort: 'seen', rows: [], total: 0 };
  const FILTERS = [['', 'Все'], ['online', 'Онлайн'], ['new', 'Новые'], ['tg', 'Telegram'], ['vk', 'ВК'], ['limited', 'С ограничениями'], ['banned', 'Баны']];
  const SORTS = [['seen', 'Последний вход'], ['le', 'Больше сварили'], ['cr', 'Больше кристаллов'], ['lvl', 'Выше уровень'], ['play', 'Дольше играют'], ['new', 'Новые сначала']];
  let searchT = 0;
  let PMODE = 'players';
  function modeSeg() {
    const opts = [['players', 'Игроки'], ['covens', 'Ковены']].concat(can('ban') ? [['reports', 'Жалобы'], ['sus', 'Проверка']] : []);
    return h('div', { class: 'seg', style: { margin: '12px 0 0' } }, opts.map(([v, l]) => h('button', { class: v === PMODE ? 'on' : '', onclick: () => { if (PMODE !== v) { PMODE = v; haptic(); render(); } } }, l)));
  }
  async function renderPlayers(id) {
    if (PMODE === 'covens') return renderCovens(id);
    if (PMODE === 'sus') return renderSus(id);
    if (PMODE === 'reports') return renderReports(id);
    const list = h('div', null, skeleton(6));
    const count = h('span', { class: 'n' }, '');
    const search = h('input', { type: 'search', placeholder: 'Имя, @ник или ID', value: PL.q, enterkeyhint: 'search' });
    search.addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(() => { PL.q = search.value; loadPlayers(list, count, true); }, 350); });
    const chips = h('div', { class: 'chips' }, FILTERS.map(([v, l]) => h('button', { class: 'chip' + (PL.filter === v ? ' on' : ''), onclick: (e) => {
      PL.filter = v; chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === e.currentTarget)); haptic(); loadPlayers(list, count, true);
    } }, l)));
    const sort = h('select', { onchange: () => { PL.sort = sort.value; loadPlayers(list, count, true); } }, SORTS.map(([v, l]) => h('option', { value: v, selected: PL.sort === v }, l)));
    body.replaceChildren(modeSeg(), h('div', { style: { height: '10px' } }), h('label', { class: 'search' }, icon('search'), search), chips, h('div', { class: 'bar-line' }, count, sort), list);
    await loadPlayers(list, count, true, id);
  }
  async function loadPlayers(list, count, reset, id) {
    if (reset) { PL.rows = []; list.replaceChildren(skeleton(6)); }
    let r;
    try { r = await api('adm_players', { p_q: PL.q, p_sort: PL.sort, p_filter: PL.filter, p_limit: 50, p_offset: PL.rows.length }); }
    catch (e) { list.replaceChildren(failBox(e)); return; }
    if (id && stale(id)) return;
    PL.total = r.total || 0;
    PL.rows = PL.rows.concat(r.rows || []);
    count.textContent = num(PL.total) + ' ' + word(PL.total, 'игрок', 'игрока', 'игроков');
    if (!PL.rows.length) { list.replaceChildren(h('div', { class: 'panel empty' }, PL.q ? 'Никого не нашёл' : 'Игроков пока нет')); return; }
    list.replaceChildren(h('div', { class: 'panel list' }, PL.rows.map(playerRow)));
    if (PL.rows.length < PL.total) list.append(h('button', { class: 'btn ghost wide', style: { marginTop: '8px' }, onclick: (e) => { e.currentTarget.disabled = true; loadPlayers(list, count, false); } }, 'Показать ещё'));
  }
  function playerRow(p) {
    const v = { le: ['сварено', num(p.le)], cr: ['кристаллы', num(p.cr)], lvl: ['уровень', p.lvl], play: ['в игре', dur(p.play_sec)], new: ['пришёл', date(p.first_seen)] }[PL.sort] || ['эссенция', num(p.ess)];
    return h('button', { class: 'row' + (p.banned ? ' ban' : ''), onclick: () => { haptic(); openPlayer(p.id); } },
      ava(p.photo, online(p.last_seen)),
      h('span', { class: 'who' },
        h('b', null, h('em', null, p.name || 'Без имени'),
          p.tg ? h('span', { class: 'tag blue' }, 'tg') : null,
          p.vk ? h('span', { class: 'tag' }, 'vk') : null,
          p.banned ? h('span', { class: 'tag red' }, 'бан') : null,
          p.top_ban ? h('span', { class: 'tag' }, 'без топа') : null,
          p.no_gift ? h('span', { class: 'tag' }, 'без подарков') : null),
        h('small', null, 'ур ' + p.lvl + ' · ' + (RANKS[p.rnk] || '-') + ' · ' + ago(p.last_seen))),
      h('span', { class: 'val' }, h('b', null, v[1]), h('small', null, v[0])));
  }

  const COV_COLORS = { purple: '#8E5BE8', red: '#E5484D', orange: '#F28C28', gold: '#E8B923', green: '#3FAE5A', teal: '#22A3A3', blue: '#3D7BE0', pink: '#E46AB3' };
  async function renderCovens(id) {
    body.replaceChildren(modeSeg(), h('div', { style: { height: '10px' } }), skeleton(4));
    let rows;
    try { rows = await api('adm_covens'); } catch (e) { if (!stale(id)) body.replaceChildren(modeSeg(), failBox(e)); return; }
    if (stale(id)) return;
    body.replaceChildren(modeSeg(), sec('Ковены', String((rows || []).length)),
      !rows || !rows.length ? h('div', { class: 'panel empty' }, 'Ковенов пока нет') :
      h('div', { class: 'panel list' }, rows.map((c) => h('button', { class: 'row', onclick: () => { haptic(); openCoven(c.id); } },
        covAva(c),
        h('span', { class: 'who' }, h('b', null, h('em', null, c.name), c.open ? null : h('span', { class: 'tag' }, 'заявки')),
          h('small', null, 'глава ' + (c.leader || '-') + ' · ' + c.members + '/30 · с ' + date(c.created_at))),
        h('span', { class: 'val' }, h('b', null, 'ур ' + c.level), h('small', null, num(c.week) + ' нед'))))));
  }
  const EMB = (e) => SITE + 'assets/images/coven/emblems/' + e + '.webp';
  const covAva = (c, lg) => h('span', { class: 'ava' + (lg ? ' lg' : ''), style: { backgroundImage: 'url("' + EMB(c.emblem) + '")', backgroundSize: '70%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: COV_COLORS[c.color] || '#555', borderRadius: lg ? '14px' : '9px' } });
  const COV_ROLE = { leader: 'Глава', deputy: 'Заместитель', member: 'Участник' };

  // ковен целиком: оформление, вступление, уровень, участники, заявки, задание, босс, чат
  async function openCoven(c0) {
    const cid = typeof c0 === 'object' ? c0.id : c0;
    if (!sheetEl) sheetScroll = window.scrollY;
    if (sheetEl) sheetEl.remove();
    const inner = h('main', null, h('div', { style: { height: '14px' } }), skeleton(5));
    sheetEl = h('div', { class: 'sheet' },
      h('div', { class: 'top' }, h('div', { class: 'top-in' },
        h('button', { class: 'ib', 'aria-label': 'Назад', onclick: () => { closeSheet(); if (tab === 'players' && PMODE === 'covens') render(); } }, icon('back')),
        h('div', { class: 'title' }, h('b', null, 'Ковен'), h('small', null, '#' + cid)),
        h('button', { class: 'ib', 'aria-label': 'Обновить', onclick: () => openCoven(cid) }, icon('refresh')))),
      inner);
    document.body.append(sheetEl);
    document.body.style.overflow = 'hidden';
    let c;
    try { c = await api('adm_coven', { p_coven: cid }); } catch (e) { inner.replaceChildren(h('div', { style: { height: '14px' } }), failBox(e)); return; }
    if (!c) { inner.replaceChildren(h('div', { class: 'empty' }, 'Ковен не найден')); return; }
    inner.replaceChildren(...covenView(c));
    if (can('ban')) loadCovenChat(cid);
  }

  let chatBox = null;
  function covenView(c) {
    const reopen = () => openCoven(c.id);
    const out = [];
    const st = (label, v) => h('div', { class: 'stat' }, h('span', null, label), h('b', null, v));
    const ms = Array.isArray(c.members) ? c.members : [];
    out.push(h('div', { class: 'hero' }, covAva(c, true),
      h('div', { style: { minWidth: 0 } },
        h('h2', null, c.name),
        h('div', { class: 'id' }, '#' + c.id + (c.motto ? ' · «' + c.motto + '»' : '')),
        h('div', { class: 'tags' },
          h('span', { class: 'tag acc' }, 'ур ' + c.level),
          h('span', { class: 'tag' }, ms.length + '/30'),
          h('span', { class: 'tag' }, c.open ? 'вход открыт' : 'по заявке'),
          c.deleted ? h('span', { class: 'tag red' }, 'распущен') : null))));
    out.push(sec('Показатели'), h('div', { class: 'stats' },
      st('Очки всего', num(c.xp)), st('За неделю', num(c.week)),
      st('Бонус дохода', '+' + c.bonus + '%'), st('Основан', date(c.created_at)),
      st('Задание недели', c.quest ? (c.quest.done ? 'выполнено' : Math.round(100 * c.quest.progress / Math.max(1, c.quest.target)) + '%') : '-'),
      st('Босс', c.boss ? (c.boss.dead ? 'побеждён' : Math.round(100 * c.boss.hp / Math.max(1, c.boss.max_hp)) + '% HP') : '-')));

    if (can('ban')) {
      const name = h('input', { class: 'input', value: c.name, maxlength: '20' });
      const motto = h('textarea', { class: 'input', rows: '2', maxlength: '80' }); motto.value = c.motto || '';
      let emblem = c.emblem, color = c.color, open = c.open;
      const embBox = h('div', { class: 'emb-grid' });
      const colBox = h('div', { class: 'col-row' });
      const drawPick = () => {
        embBox.replaceChildren(...Array.from({ length: 16 }, (_, i) => { const e = 'e' + String(i + 1).padStart(2, '0');
          return h('button', { class: 'emb' + (e === emblem ? ' on' : ''), style: { backgroundImage: 'url("' + EMB(e) + '")', backgroundColor: COV_COLORS[color] || '#555' }, onclick: () => { emblem = e; haptic(); drawPick(); } }); }));
        colBox.replaceChildren(...Object.keys(COV_COLORS).map((k) => h('button', { class: 'col' + (k === color ? ' on' : ''), style: { background: COV_COLORS[k] }, onclick: () => { color = k; haptic(); drawPick(); } })));
      };
      drawPick();
      const sw = h('button', { class: 'sw' + (open ? ' on' : ''), role: 'switch', 'aria-label': 'Открытый вход', onclick: () => { open = !open; sw.classList.toggle('on', open); } });
      out.push(sec('Оформление и вступление'), h('div', { class: 'panel pad' },
        field('Название', name), field('Девиз', motto),
        h('div', { class: 'field' }, h('span', null, 'Эмблема'), embBox),
        h('div', { class: 'field' }, h('span', null, 'Цвет'), colBox),
        h('div', { class: 'tog' }, h('div', { class: 't' }, h('b', null, 'Открытый вход'), h('small', null, 'Выключено - вступают только по заявке')), sw),
        h('button', { class: 'btn wide', onclick: async () => {
          const f = { motto: motto.value.trim(), emblem, color, open };
          if (name.value.trim() !== c.name) f.name = name.value.trim();
          if (await act('adm_coven_edit', { p_coven: c.id, f }, 'Ковен сохранён')) reopen();
        } }, icon('check'), 'Сохранить')));
    }
    if (can('edit')) {
      const xp = h('input', { class: 'input mono', type: 'number', inputmode: 'decimal', value: String(Math.round(c.xp)) });
      const wx = h('input', { class: 'input mono', type: 'number', inputmode: 'decimal', value: String(Math.round(c.week)) });
      out.push(sec('Уровень', 'ур ' + c.level), h('div', { class: 'panel pad' },
        h('div', { class: 'g2' }, field('Очки всего', xp), field('Очки недели', wx)),
        h('p', { class: 'hint' }, 'Уровень считается из очков всего. Следующий уровень: ' + num(c.need) + ' очков.'),
        h('button', { class: 'btn ghost wide', onclick: async () => {
          if (await act('adm_coven_edit', { p_coven: c.id, f: { xp: +xp.value || 0, week_xp: +wx.value || 0 } }, 'Очки обновлены')) reopen();
        } }, 'Сохранить очки')));
    }

    out.push(sec('Участники', String(ms.length)));
    out.push(h('div', { class: 'panel' }, ms.length ? ms.map((m) => h('div', { class: 'member' },
      ava(m.photo, online(m.seen)),
      h('button', { class: 'who', style: { textAlign: 'left' }, onclick: () => { haptic(); openPlayer(m.id); } },
        h('b', null, h('em', null, m.name || 'ID ' + m.id), h('span', { class: 'tag' + (m.role === 'leader' ? ' acc' : '') }, COV_ROLE[m.role] || m.role)),
        h('small', null, 'неделя ' + num(m.week) + ' · всего ' + num(m.total) + ' · ' + ago(m.seen))),
      can('ban') ? h('button', { class: 'ib', 'aria-label': 'Действия', onclick: () => memberMenu(c, m) }, icon('sliders')) : null)) : h('div', { class: 'empty' }, 'Пусто')));

    if (Array.isArray(c.requests) && c.requests.length) {
      out.push(sec('Заявки', String(c.requests.length)), h('div', { class: 'panel' }, c.requests.map((r) => h('div', { class: 'member' },
        ava(r.photo, false),
        h('span', { class: 'who' }, h('b', null, h('em', null, r.name || 'ID ' + r.id)), h('small', null, 'ур ' + (r.lvl || 1) + ' · ' + dateTime(r.at))),
        can('ban') ? [h('button', { class: 'btn sm', onclick: async () => { if (await act('adm_coven_member', { p_coven: c.id, p_uid: r.id, p_action: 'accept' }, 'Принят')) reopen(); } }, 'Принять'),
          h('button', { class: 'btn ghost sm', onclick: async () => { if (await act('adm_coven_member', { p_coven: c.id, p_uid: r.id, p_action: 'decline' }, 'Отклонено')) reopen(); } }, 'Нет')] : null))));
    }

    if (can('ban')) {
      chatBox = h('div', { class: 'panel' }, h('div', { class: 'skel' }));
      out.push(sec('Чат'), chatBox);
      out.push(sec('Опасно'), h('div', { class: 'panel pad' },
        h('button', { class: 'btn danger wide', onclick: async () => {
          if (!(await confirmBox('Распустить ковен?', 'Все участники выйдут, ковен исчезнет из списка. Отменить нельзя.', 'Распустить', true))) return;
          if (await act('adm_coven_delete', { p_coven: c.id }, 'Ковен распущен')) { closeSheet(); render(); }
        } }, icon('trash'), 'Распустить ковен')));
    }
    return out;
  }
  async function memberMenu(c, m) {
    const opts = [{ label: 'Отмена', cls: 'ghost', v: false }];
    if (m.role === 'member') opts.push({ label: 'Сделать заместителем', v: 'promote' });
    if (m.role === 'deputy') opts.push({ label: 'Снять заместителя', v: 'demote' });
    if (m.role !== 'leader') opts.push({ label: 'Сделать главой', v: 'lead' });
    opts.push({ label: 'Исключить', cls: 'danger', v: 'kick' });
    const v = await dialog(m.name || 'ID ' + m.id, (COV_ROLE[m.role] || '') + ' · неделя ' + num(m.week), null, opts);
    if (!v) return;
    if (v === 'kick' && !(await confirmBox('Исключить из ковена?', m.name || 'ID ' + m.id, 'Исключить', true))) return;
    if (await act('adm_coven_member', { p_coven: c.id, p_uid: m.id, p_action: v }, 'Готово')) openCoven(c.id);
  }
  async function loadCovenChat(cid) {
    const box = chatBox;
    if (!box) return;
    try {
      const msgs = await api('adm_coven_chat', { p_coven: cid });
      box.replaceChildren(...(!msgs.length ? [h('div', { class: 'empty' }, 'Чат пуст')] : msgs.slice(-60).map((m) => h('div', { class: 'log', style: m.hidden ? { opacity: .45 } : null },
        h('div', null, h('b', null, m.uid ? (m.name || 'ID ' + m.uid) : 'система'), ' ', h('span', { class: 'meta' }, dateTime(m.at) + (m.hidden ? ' · скрыто' : ''))),
        h('div', { class: 'd' }, m.text)))));
    } catch (e) { box.replaceChildren(h('div', { class: 'empty' }, errText(e))); }
  }
  // подозрительный рост прогресса: игрок временно вне топов, решение за командой
  async function renderSus(id) {
    body.replaceChildren(modeSeg(), h('div', { style: { height: '10px' } }), skeleton(3));
    let rows;
    try { rows = await api('adm_sus'); } catch (e) { if (!stale(id)) body.replaceChildren(modeSeg(), failBox(e)); return; }
    if (stale(id)) return;
    body.replaceChildren(modeSeg(), sec('На проверке', String((rows || []).length)),
      !rows || !rows.length ? h('div', { class: 'panel empty' }, 'Подозрительных нет') :
      h('div', { class: 'panel' }, rows.map((r) => h('div', { class: 'log' },
        h('div', { class: 'member', style: { padding: 0 } }, ava(r.photo, online(r.last_seen)),
          h('button', { class: 'who', style: { textAlign: 'left' }, onclick: () => openPlayer(r.id) }, h('b', null, h('em', null, r.name || 'ID ' + r.id)),
            h('small', null, 'ур ' + r.lvl + ' · сварено ' + num(r.le) + ' · ' + num(r.ph) + '/ч'))),
        h('div', { class: 'd' }, r.reason + (r.count > 1 ? ' · срабатываний: ' + r.count : '')),
        h('div', { class: 'meta' }, dateTime(r.at)),
        h('div', { class: 'btns' },
          h('button', { class: 'btn sm', onclick: async () => { if (await act('adm_sus_done', { p_id: r.id, p_ok: true }, 'Вернул в топы')) render(); } }, 'Честно'),
          h('button', { class: 'btn danger sm', onclick: async () => { if (await act('adm_sus_done', { p_id: r.id, p_ok: false }, 'Убран из топов')) render(); } }, 'Накрутка'))))));
  }
  async function renderReports(id) {
    body.replaceChildren(modeSeg(), h('div', { style: { height: '10px' } }), skeleton(3));
    let rows;
    try { rows = await api('adm_reports'); } catch (e) { if (!stale(id)) body.replaceChildren(modeSeg(), failBox(e)); return; }
    if (stale(id)) return;
    body.replaceChildren(modeSeg(), sec('Жалобы на сообщения', String((rows || []).length)),
      !rows || !rows.length ? h('div', { class: 'panel empty' }, 'Жалоб нет') :
      h('div', { class: 'panel' }, rows.map((r) => h('div', { class: 'item' },
        h('span', { class: 'ic' }, icon('alert')),
        h('div', { class: 't' },
          h('b', null, h('a', { href: '#', onclick: (e) => { e.preventDefault(); openPlayer(r.uid); } }, r.name || 'ID ' + r.uid), r.chat_ban ? h('span', { class: 'tag red', style: { marginLeft: '6px' } }, 'заглушён') : null),
          h('p', null, '«' + r.text + '»'),
          h('div', { class: 'meta' }, 'ковен ' + (r.coven || '-') + ' · жалоб ' + r.count + ' · ' + dateTime(r.at)),
          h('div', { class: 'btns' },
            h('button', { class: 'btn danger sm', onclick: async () => { if (await act('adm_report_done', { p_msg: r.msg, p_hide: true }, 'Сообщение скрыто')) render(); } }, 'Скрыть'),
            h('button', { class: 'btn ghost sm', onclick: async () => { if (await act('adm_report_done', { p_msg: r.msg, p_hide: false }, 'Жалоба отклонена')) render(); } }, 'Всё в порядке')),
          r.chat_ban ? null : h('button', { class: 'btn ghost sm wide', style: { marginTop: '8px' }, onclick: async () => {
            if (await confirmBox('Заглушить ' + (r.name || 'игрока') + '?', 'Он не сможет писать в чат ковена, пока ты не снимешь запрет в его карточке.', 'Заглушить', true)) {
              if (await act('adm_set_player', { p_id: r.uid, f: { chat_ban: true } }, 'Игрок заглушён')) render();
            }
          } }, 'Заглушить в чате'))))));
  }

  // ---------- карточка игрока ----------
  let sheetEl = null, sheetScroll = 0;
  function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; document.body.style.overflow = ''; window.scrollTo(0, sheetScroll); } }
  async function openPlayer(pid) {
    if (!sheetEl) sheetScroll = window.scrollY;
    if (sheetEl) sheetEl.remove();
    const inner = h('main', null, h('div', { style: { height: '14px' } }), skeleton(5));
    sheetEl = h('div', { class: 'sheet' },
      h('div', { class: 'top' }, h('div', { class: 'top-in' },
        h('button', { class: 'ib', 'aria-label': 'Назад', onclick: closeSheet }, icon('back')),
        h('div', { class: 'title' }, h('b', null, 'Игрок'), h('small', null, 'ID ' + pid)),
        h('button', { class: 'ib', 'aria-label': 'Обновить', onclick: () => openPlayer(pid) }, icon('refresh')))),
      inner);
    document.body.append(sheetEl);
    document.body.style.overflow = 'hidden';
    let p;
    try { p = await api('adm_player', { p_id: pid }); } catch (e) { inner.replaceChildren(h('div', { style: { height: '14px' } }), failBox(e)); return; }
    if (!p) { inner.replaceChildren(h('div', { class: 'empty' }, 'Игрок ещё не заходил в игру')); return; }
    inner.replaceChildren(...playerView(p));
  }

  function playerView(p) {
    const id = p.tg_id;
    const reopen = () => openPlayer(id);
    const isCreator = p.team_role === 'creator';
    const st = (label, v) => h('div', { class: 'stat' }, h('span', null, label), h('b', null, v));
    const out = [];
    out.push(h('div', { class: 'hero' },
      ava(p.photo, online(p.last_seen), true),
      h('div', { style: { minWidth: 0 } },
        h('h2', null, p.name || 'Без имени'),
        h('div', { class: 'id' }, 'ID ' + id, p.username ? [' · ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); openExt('https://t.me/' + p.username); } }, '@' + p.username)] : null),
        h('div', { class: 'tags' },
          online(p.last_seen) ? h('span', { class: 'tag green' }, 'онлайн') : h('span', { class: 'tag' }, ago(p.last_seen)),
          roleTag(p.team_role),
          p.banned ? h('span', { class: 'tag red' }, 'бан') : null,
          p.top_ban ? h('span', { class: 'tag' }, 'без топа') : null,
          p.top_hold ? h('span', { class: 'tag red' }, 'на проверке: ' + (p.sus_reason || '')) : null,
          p.premium ? h('span', { class: 'tag acc' }, 'premium') : null,
          p.lang ? h('span', { class: 'tag' }, p.lang) : null))));

    out.push(sec('Прогресс'),
      h('div', { class: 'stats' },
        st('Ранг', RANKS[p.rnk] || '-'), st('Уровень', p.lvl),
        st('Эссенция', num(p.ess)), st('Сварено всего', num(p.le)),
        st('Доход / час', num(p.ph)), st('Кристаллы', num(p.cr)),
        st('Мастерство', num(p.mastery)), st('Время в игре', dur(p.play_sec)),
        st('Заходов', num(p.sessions)), st('Дней в игре', num(p.days)),
        st('Первый вход', date(p.first_seen)), st('Версия', p.ver || '-')),
      h('div', { class: 'panel pad', style: { marginTop: '8px' } },
        kv('Telegram', p.tg ? h('span', { class: 'mono' }, String(p.tg)) : 'не привязан'),
        kv('ВКонтакте', p.vk ? h('a', { href: '#', onclick: (e) => { e.preventDefault(); openExt('https://vk.com/id' + p.vk); } }, 'id' + p.vk) : 'не привязан'),
        kv('Пригласил его', p.ref ? (p.ref_name || 'ID ' + p.ref) : 'никто'),
        kv('Он пригласил', num(p.invited) + ' ' + word(p.invited, 'друга', 'друзей', 'друзей')),
        kv('Сохранение', dateTime(p.save_at)),
        (p.scores || []).filter((s) => s.period === 'all').map((s) => kv('Топ «' + (s.board === 'mastery' ? 'Мастерство' : 'Полка зелий') + '»', num(s.score)))));

    if (can('mail')) {
      const gCr = h('input', { class: 'input mono', type: 'number', inputmode: 'numeric', placeholder: '0', min: '0' });
      const gH = h('input', { class: 'input mono', type: 'number', inputmode: 'decimal', placeholder: '0', min: '0' });
      const gTitle = h('input', { class: 'input', value: can('gift') ? 'Подарок от лавки' : '', placeholder: 'Заголовок', maxlength: '80' });
      const gText = h('textarea', { class: 'input', rows: '2', placeholder: 'Текст письма' });
      out.push(sec(can('gift') ? 'Письмо и подарок' : 'Письмо'),
        h('div', { class: 'panel pad' },
          can('gift') ? h('div', { class: 'g2' }, field('Кристаллы', gCr), field('Часы дохода', gH)) : null,
          field('Заголовок', gTitle), field('Текст', gText),
          h('button', { class: 'btn wide', onclick: async (e) => {
            const btn = e.currentTarget;
            const cr = can('gift') ? Math.max(0, Math.floor(+gCr.value || 0)) : 0, hh = can('gift') ? Math.max(0, +gH.value || 0) : 0;
            if (!gTitle.value.trim()) { toast('Нужен заголовок', true); return; }
            btn.disabled = true;
            const ok = await act('adm_mail_send', { p_to: id, p_title: gTitle.value.trim(), p_body: gText.value.trim(), p_gift: { cr, ess_h: hh }, p_days: 0 }, cr || hh ? 'Подарок отправлен в почту игрока' : 'Письмо отправлено');
            if (ok) reopen(); else btn.disabled = false;
          } }, icon('send'), 'Отправить в почту игрока'),
          can('gift') ? h('p', { class: 'hint' }, 'Часы дохода - эссенция, которую лавка игрока зарабатывает за это время.') : null));
    }

    if (can('edit')) {
      // сейчас в сохранении игрока - от этого считаем «было → станет»
      const sv = p.save && typeof p.save === 'object' ? p.save : {};
      const cur = { cr: +sv.cr || +p.cr || 0, e: +sv.e || +p.ess || 0, lvl: +sv.lvl || +p.lvl || 1, le: +sv.le || +p.le || 0 };
      let mode = 'add';
      const eCr = h('input', { class: 'input mono', type: 'number', inputmode: 'numeric', placeholder: '0' });
      const eE = h('input', { class: 'input mono', type: 'number', inputmode: 'numeric', placeholder: '0' });
      const eLvl = h('input', { class: 'input mono', type: 'number', inputmode: 'numeric', placeholder: String(cur.lvl) });
      const eName = h('input', { class: 'input', maxlength: '20', placeholder: p.name || '' });
      const curRank = RANK_NEED.reduce((r, n, i) => (cur.le >= n ? i : r), 0);
      const eRank = h('select', { class: 'input' }, h('option', { value: '' }, 'Не менять (' + (RANKS[curRank] || '-') + ')'), RANKS.map((n, i) => h('option', { value: String(i) }, (i + 1) + '. ' + n)));
      const fCr = field('Кристаллы', eCr), fE = field('Эссенция', eE);
      const modeHint = h('p', { class: 'hint' });
      const modeSeg = h('div', { class: 'seg', style: { margin: '0 0 10px' } });
      const drawMode = () => {
        modeSeg.replaceChildren(...[['add', 'Начислить'], ['set', 'Установить']].map(([v, l]) => h('button', { class: v === mode ? 'on' : '', onclick: () => { mode = v; haptic(); drawMode(); } }, l)));
        const ph = mode === 'add' ? ['+0', '+0'] : [String(cur.cr), String(Math.floor(cur.e))];
        eCr.placeholder = ph[0]; eE.placeholder = ph[1];
        modeHint.textContent = mode === 'add' ? 'Начислить: прибавляется к тому, что есть у игрока (минус - списать). Эссенция добавится и в «Сварено всего».' : 'Установить: заменяет значение целиком. Сейчас у игрока: ' + num(cur.cr) + ' кр, ' + num(cur.e) + ' эссенции.';
      };
      drawMode();
      const btn = h('button', { class: 'btn wide', onclick: async () => {
        const ops = {}, lines = [];
        let down = false;
        const arrow = (name, a, b) => { lines.push(name + ': ' + num(a) + ' → ' + num(b)); if (b < a) down = true; };
        if (eCr.value !== '') {
          const v = Math.floor(+eCr.value);
          if (mode === 'add') { if (v) { ops.add_cr = v; arrow('Кристаллы', cur.cr, Math.max(0, cur.cr + v)); } } else { ops.set_cr = Math.max(0, v); arrow('Кристаллы', cur.cr, ops.set_cr); }
        }
        if (eE.value !== '') {
          const v = +eE.value;
          if (mode === 'add') { if (v) { ops.add_e = v; arrow('Эссенция', cur.e, Math.max(0, cur.e + v)); } } else { ops.set_e = Math.max(0, v); arrow('Эссенция', cur.e, ops.set_e); }
        }
        if (eLvl.value !== '') { ops.set_lvl = Math.max(1, Math.floor(+eLvl.value)); arrow('Уровень', cur.lvl, ops.set_lvl); }
        if (eName.value.trim()) { ops.set_name = eName.value.trim(); lines.push('Имя: ' + ops.set_name); }
        if (eRank.value !== '') {
          ops.set_le = RANK_NEED[+eRank.value];
          lines.push('Ранг: ' + (RANKS[curRank] || '-') + ' → ' + RANKS[+eRank.value] + ' («Сварено всего» ' + num(cur.le) + ' → ' + num(ops.set_le) + ')');
          if (ops.set_le < cur.le) down = true;
        }
        if (!Object.keys(ops).length) { toast('Ничего не изменено', true); return; }
        const text = lines.join('\n') + (down ? '\n\nВНИМАНИЕ: это уменьшит прогресс игрока.' : '') + '\n\nИгра применит правку при следующем входе игрока или в течение минуты, если он играет.';
        if (!(await confirmBox(down ? 'Уменьшить прогресс?' : 'Применить правку?', text, 'Применить', down))) return;
        btn.disabled = true; // не отправить дважды
        if (await act('adm_patch', { p_id: id, ops }, 'Правка отправлена')) reopen(); else btn.disabled = false;
      } }, 'Применить правку');
      out.push(sec('Правка сохранения'),
        h('div', { class: 'panel pad' },
          modeSeg,
          h('div', { class: 'g2' }, fCr, fE, field('Уровень', eLvl), field('Имя', eName)),
          field('Ранг лавки', eRank),
          btn,
          modeHint,
          h('p', { class: 'hint' }, 'Пустые поля не меняются. Подарок через почту игрок забирает сам - это надёжнее правки.'),
          (p.patches || []).length ? h('div', { style: { marginTop: '12px' } }, p.patches.map((x) => h('div', { class: 'kv' },
            h('span', null, h('span', { class: 'mono' }, dateTime(x.at)), ' · ' + opsText(x.ops)),
            x.done ? h('b', { style: { color: 'var(--green)' } }, 'применена') : h('button', { class: 'btn ghost sm', onclick: async () => {
              if (await act('adm_patch_cancel', { p_id: x.id }, 'Правка отменена')) reopen();
            } }, 'Отменить')))) : null));
      out.push(sec('История сохранений'), savesBox(id, can('reset')));
    }

    if ((can('ban') || can('reset')) && !isCreator) {
      const tog = (label, hint, on, onChange) => {
        const sw = h('button', { class: 'sw red' + (on ? ' on' : ''), role: 'switch', 'aria-label': label });
        sw.addEventListener('click', async () => { const v = !sw.classList.contains('on'); if (await onChange(v)) sw.classList.toggle('on', v); });
        return h('div', { class: 'tog' }, h('div', { class: 't' }, h('b', null, label), h('small', null, hint)), sw);
      };
      const reason = h('input', { class: 'input', placeholder: 'Причина бана (увидит игрок)', value: p.ban_reason || '', maxlength: '200' });
      const box = h('div', { class: 'panel pad' });
      if (can('ban')) {
        box.append(
          tog('Заблокировать', 'Экран «Доступ закрыт», пропадёт из топов', p.banned, async (v) => {
            if (v && !(await confirmBox('Заблокировать ' + (p.name || 'игрока') + '?', 'Игра закроется для него при следующей проверке.', 'Заблокировать', true))) return false;
            return act('adm_set_player', { p_id: id, f: { banned: v, ban_reason: reason.value.trim() } }, v ? 'Игрок заблокирован' : 'Блокировка снята');
          }),
          h('div', { class: 'inline', style: { paddingBottom: '12px' } }, reason, h('button', { class: 'btn ghost', onclick: () => act('adm_set_player', { p_id: id, f: { ban_reason: reason.value.trim() } }, 'Причина сохранена') }, 'OK')),
          tog('Убрать из топов', 'Очки не записываются и не видны', p.top_ban, (v) => act('adm_set_player', { p_id: id, f: { top_ban: v } }, v ? 'Убран из топов' : 'Снова в топах')),
          tog('Без общих подарков', 'Не забирает подарки из писем «всем»', p.no_gift, (v) => act('adm_set_player', { p_id: id, f: { no_gift: v } }, 'Сохранено')),
          tog('Заглушить в чате', 'Не может писать в чат ковена', p.chat_ban, (v) => act('adm_set_player', { p_id: id, f: { chat_ban: v } }, v ? 'Заглушён' : 'Может писать')));
      }
      box.append(h('div', { class: 'btns' },
        can('ban') ? h('button', { class: 'btn ghost sm', onclick: async () => {
          if (await confirmBox('Стереть очки в топах?', 'Все результаты игрока в рейтингах будут удалены.', 'Стереть', true)) { if (await act('adm_score_delete', { p_id: id, p_board: 'all' }, 'Очки удалены')) reopen(); }
        } }, 'Стереть очки') : h('span'),
        can('reset') ? h('button', { class: 'btn danger sm', onclick: async () => {
          if (await confirmBox('Сбросить прогресс?', 'Лавка игрока начнётся с нуля при следующем входе. Отменить можно, только пока правка не применена.', 'Сбросить', true)) { if (await act('adm_patch', { p_id: id, ops: { reset: true } }, 'Сброс отправлен')) reopen(); }
        } }, 'Сбросить прогресс') : h('span')));
      out.push(sec('Ограничения'), box);
    }

    if (can('team') && !isCreator) {
      out.push(sec('Команда'),
        h('div', { class: 'panel pad' },
          kv('Роль', p.team_role ? ROLES[p.team_role] : 'не в команде'),
          h('div', { class: 'btns' },
            h('button', { class: 'btn sm', onclick: async () => { if (await roleDialog(id, p.name, p.team_role)) reopen(); } }, p.team_role ? 'Изменить роль' : 'Добавить в команду'),
            p.team_role ? h('button', { class: 'btn danger sm', onclick: async () => {
              if (await confirmBox('Убрать из команды?', (p.name || 'Игрок') + ' потеряет доступ к панели.', 'Убрать', true)) { if (await act('adm_team_remove', { p_id: id }, 'Убран из команды')) reopen(); }
            } }, 'Убрать') : h('span'))));
    }

    if (can('notes')) {
      const note = h('textarea', { class: 'input', rows: '3', placeholder: 'Видит только команда' }, p.note || '');
      out.push(sec('Заметка'),
        h('div', { class: 'panel pad' }, note, h('button', { class: 'btn ghost sm', style: { marginTop: '8px' }, onclick: () => act('adm_set_player', { p_id: id, f: { note: note.value } }, 'Заметка сохранена') }, 'Сохранить')));
    } else if (p.note) {
      out.push(sec('Заметка'), h('div', { class: 'panel pad mut' }, p.note));
    }

    if ((p.mail || []).length) {
      out.push(sec('Личные письма', String(p.mail.length)),
        h('div', { class: 'panel pad' }, p.mail.map((m) => h('div', { class: 'kv' },
          h('span', null, h('span', { class: 'mono' }, dateTime(m.at)), ' · ' + m.title + giftText(m.gift)),
          h('b', null, m.claimed ? 'забрал' : m.read ? 'прочитал' : 'не открыл')))));
    }
    out.push(sec('Сохранение'), saveView(p.save));
    return out;
  }
  function giftText(g) {
    if (!g) return '';
    const a = [];
    if (g.cr) a.push(g.cr + ' кр');
    if (g.ess_h) a.push(g.ess_h + ' ч дохода');
    return a.length ? ' · ' + a.join(' + ') : '';
  }
  function opsText(o) {
    if (o.reset) return 'сброс прогресса';
    if (o.restore) return 'возврат сохранения из истории (копия №' + o.restore + ')';
    const names = { set_cr: 'кристаллы →', add_cr: 'кристаллы +', set_e: 'эссенция →', add_e: 'эссенция +', add_ess_h: 'часы дохода +', set_lvl: 'уровень →', set_name: 'имя →' };
    return Object.keys(o).map((k) => k === 'set_le' ? 'ранг → ' + (RANKS[RANK_NEED.indexOf(o[k])] || num(o[k])) : (names[k] || k) + ' ' + (typeof o[k] === 'number' ? num(o[k]) : o[k])).join(', ');
  }
  // копии сохранения: база откладывает их раз в час и перед любым уменьшением прогресса
  const SAVE_KIND = { start: 'при обновлении 0.20.1', hourly: 'раз в час', drop: 'перед уменьшением', other_game: 'перед сменой игры', deleted: 'перед удалением', rejected: 'не принята базой' };
  function savesBox(id, canRestore) {
    const box = h('div', { class: 'panel pad' }, h('p', { class: 'hint' }, 'Загружаю...'));
    api('adm_saves', { p_id: id }).then((r) => {
      const list = (r && r.list) || [];
      if (!list.length) { box.replaceChildren(h('p', { class: 'hint' }, 'Копий пока нет. База откладывает их раз в час и перед любым уменьшением прогресса.')); return; }
      const now = r.now || {};
      box.replaceChildren(
        h('p', { class: 'hint' }, 'Сейчас: сварено ' + num(now.le || 0) + ', уровень ' + (now.lvl || '-') + ', ' + num(now.cr || 0) + ' кр.'),
        ...list.map((x) => h('div', { class: 'kv' },
          h('span', null, h('span', { class: 'mono' }, dateTime(x.at)), ' · ' + (SAVE_KIND[x.kind] || x.kind) + ' · сварено ' + num(x.le || 0) + ', ур. ' + (x.lvl || '-') + ', ' + num(+x.cr || 0) + ' кр' + (x.born && now.born && x.born !== now.born ? ' · другая игра' : '')),
          canRestore ? h('button', { class: 'btn ghost sm', onclick: async () => {
            const ok = await confirmBox('Вернуть эту копию?', 'Прогресс игрока заменится копией от ' + dateTime(x.at) + ': сварено ' + num(x.le || 0) + ', уровень ' + (x.lvl || '-') + '.\n\nТекущее сохранение тоже останется в истории - его можно будет вернуть обратно. Игра применит копию при следующем входе игрока.', 'Вернуть', true);
            if (ok && await act('adm_save_restore', { p_id: id, p_hist: x.id }, 'Копия отправлена игроку')) openPlayer(id);
          } }, 'Вернуть') : null)));
    }).catch((e) => box.replaceChildren(h('p', { class: 'hint' }, errText(e))));
    return box;
  }
  function saveView(sv) {
    if (!sv) return h('div', { class: 'panel empty' }, 'Игра ещё не прислала сохранение');
    const L = {
      e: 'Эссенция', le: 'Сварено всего', taps: 'Тапов', scoop: 'Черпак', pantry: 'Кладовая', served: 'Обслужено жителей', cr: 'Кристаллы',
      lvl: 'Уровень', xp: 'Опыт', brewed: 'Сварено зелий', rank: 'Ранг', bb: 'Золотых пузырей', qd: 'Заданий выполнено',
      cards: 'Карточки', vis: 'Заказы жителей', fr: 'Дружба', prof: 'Профиль', own: 'Куплено', wear: 'Гардероб', stat: 'Статистика', sk: 'Навыки',
      ing: 'Ингредиенты', bag: 'Зелья в сумке', book: 'Рецепты', pets: 'Питомцы', story: 'Истории жителей', req: 'Просьбы', mg: 'Мини-игры',
      ac: 'Достижения', ev: 'Событие', q: 'Задания дня', daily: 'Подарок дня', fx: 'Эффекты', set: 'Настройки'
    };
    const simple = [], complex = [];
    Object.keys(sv).forEach((k) => { const v = sv[k]; (v === null || typeof v !== 'object' ? simple : complex).push([k, v]); });
    const fv = (v) => typeof v === 'number' ? (Math.abs(v) >= 1e4 ? num(v) : String(Math.round(v * 100) / 100)) : typeof v === 'boolean' ? (v ? 'да' : 'нет') : String(v || '-');
    return h('div', null,
      h('div', { class: 'panel pad' }, simple.filter(([k]) => L[k]).map(([k, v]) => h('div', { class: 'kv' }, h('span', null, L[k]), h('b', { class: 'mono' }, fv(v))))),
      h('div', { class: 'panel', style: { marginTop: '8px' } }, complex.map(([k, v]) => {
        const n = Array.isArray(v) ? v.length : Object.keys(v).length;
        return h('details', null, h('summary', null, h('span', null, L[k] || k), h('span', { class: 'n' }, String(n))), h('pre', null, JSON.stringify(v, null, 1)));
      }), h('details', null, h('summary', null, h('span', null, 'Всё сохранение (JSON)'), h('span', { class: 'n' }, Math.max(1, Math.round(JSON.stringify(sv).length / 1024)) + ' КБ')), h('pre', null, JSON.stringify(sv, null, 1)))));
  }

  // ---------- выбор роли ----------
  async function roleDialog(pid, name, current) {
    let role = current && current !== 'creator' ? current : 'moderator';
    const own = new Set();
    const roleSeg = h('div', { class: 'seg', style: { flexWrap: 'wrap' } });
    const hint = h('p', { class: 'hint', style: { margin: '8px 0 12px' } });
    const checks = h('div', { class: 'checks' });
    const preset = { admin: ['ban', 'gift', 'edit', 'mail', 'mail_all', 'notes', 'settings', 'log'], moderator: ['ban', 'notes', 'log'], support: ['mail', 'notes'] };
    function draw() {
      roleSeg.replaceChildren(...['admin', 'moderator', 'support', 'custom'].map((r) => h('button', { class: r === role ? 'on' : '', onclick: () => {
        if (r === 'custom' && !own.size) (preset[role] || []).forEach((x) => own.add(x));
        role = r; draw();
      } }, r === 'custom' ? 'Свои' : ROLES[r])));
      hint.textContent = ROLE_HINT[role];
      const active = role === 'custom' ? own : new Set(preset[role]);
      checks.replaceChildren(...PERMS.map(([k, l]) => h('button', {
        class: 'check' + (active.has(k) ? ' on' : ''), style: role === 'custom' ? null : { opacity: active.has(k) ? 1 : 0.4, pointerEvents: 'none' },
        onclick: () => { own.has(k) ? own.delete(k) : own.add(k); draw(); }
      }, h('span', { class: 'box' }, active.has(k) ? icon('check') : null), l)));
    }
    draw();
    const ok = await dialog((current ? 'Роль: ' : 'В команду: ') + (name || 'ID ' + pid), null, h('div', null, roleSeg, hint, checks), [{ label: 'Отмена', cls: 'ghost', v: false }, { label: 'Сохранить', v: true }]);
    if (!ok) return false;
    if (role === 'custom' && !own.size) { toast('Отметь хотя бы одно право', true); return false; }
    return act('adm_team_set', { p_id: pid, p_role: role, p_perms: [...own] }, 'Роль сохранена');
  }

  // ---------- почта ----------
  async function renderMail(id) {
    const to = { all: can('mail_all') };
    const toSeg = h('div', { class: 'seg' });
    const toId = h('input', { class: 'input mono', type: 'number', inputmode: 'numeric', placeholder: 'ID игрока', style: { display: to.all ? 'none' : '', marginTop: '8px' } });
    const setTo = (all) => { to.all = all; toSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', (b.dataset.all === '1') === all)); toId.style.display = all ? 'none' : ''; upd(); };
    if (can('mail_all')) toSeg.append(h('button', { class: to.all ? 'on' : '', 'data-all': '1', onclick: () => setTo(true) }, 'Всем'));
    if (can('mail')) toSeg.append(h('button', { class: to.all ? '' : 'on', 'data-all': '0', onclick: () => setTo(false) }, 'Одному игроку'));
    const title = h('input', { class: 'input', maxlength: '80', placeholder: 'Например: подарок к выходным' });
    const text = h('textarea', { class: 'input', rows: '4', maxlength: '2000', placeholder: 'Текст письма' });
    const cr = h('input', { class: 'input mono', type: 'number', inputmode: 'numeric', placeholder: '0', min: '0' });
    const hrs = h('input', { class: 'input mono', type: 'number', inputmode: 'decimal', placeholder: '0', min: '0' });
    const days = h('input', { class: 'input mono', type: 'number', inputmode: 'numeric', placeholder: 'бессрочно', min: '0' });
    const prev = h('div', { class: 'preview' });
    function upd() {
      const g = [];
      if (can('gift') && +cr.value > 0) g.push(Math.floor(+cr.value) + ' ' + word(+cr.value, 'кристалл', 'кристалла', 'кристаллов'));
      if (can('gift') && +hrs.value > 0) g.push(hrs.value + ' ч дохода');
      prev.replaceChildren(h('div', { class: 'meta', style: { marginBottom: '8px', letterSpacing: '.1em' } }, 'ПРЕВЬЮ · ' + (to.all ? 'ВСЕМ' : 'ИГРОКУ')),
        h('div', { class: 'item', style: { padding: 0 } }, h('span', { class: 'ic' + (g.length ? ' acc' : '') }, icon(g.length ? 'gift' : 'mail')),
          h('div', { class: 't' }, h('b', null, title.value || 'Заголовок'), h('p', null, text.value || 'Текст письма'), g.length ? h('div', { class: 'meta' }, h('b', null, 'Подарок: '), g.join(' + ')) : null)));
    }
    [title, text, cr, hrs].forEach((x) => x.addEventListener('input', upd));
    upd();
    const send = h('button', { class: 'btn wide', style: { marginTop: '12px' }, onclick: async () => {
      if (!title.value.trim()) { toast('Напиши заголовок', true); return; }
      const target = to.all ? 0 : Math.floor(+toId.value || 0);
      if (!to.all && !target) { toast('Укажи ID игрока', true); return; }
      const g = can('gift') ? { cr: Math.max(0, Math.floor(+cr.value || 0)), ess_h: Math.max(0, +hrs.value || 0) } : {};
      if (!(await confirmBox(to.all ? 'Отправить всем?' : 'Отправить игроку ' + target + '?', to.all ? 'Письмо увидят все игроки. У кого игра открыта - в течение 5 минут.' : 'Письмо придёт в почту игрока.', 'Отправить'))) return;
      send.disabled = true;
      const ok = await act('adm_mail_send', { p_to: target, p_title: title.value.trim(), p_body: text.value.trim(), p_gift: g, p_days: Math.max(0, Math.floor(+days.value || 0)) }, 'Письмо отправлено');
      send.disabled = false;
      if (ok) { title.value = ''; text.value = ''; cr.value = ''; hrs.value = ''; days.value = ''; upd(); loadSent(); }
    } }, icon('send'), 'Отправить');
    const sent = h('div', null, skeleton(3));
    body.replaceChildren(
      sec('Новое письмо'),
      h('div', { class: 'panel pad' },
        field('Кому', h('div', null, toSeg, toId)),
        field('Заголовок', title), field('Текст', text),
        can('gift') ? h('div', { class: 'g2' }, field('Кристаллы', cr), field('Часы дохода', hrs)) : null,
        field('Хранить, дней', days),
        prev, send),
      sec('Отправленные'), sent);
    async function loadSent() {
      let rows;
      try { rows = await api('adm_mail_list'); } catch (e) { sent.replaceChildren(failBox(e)); return; }
      if (tab !== 'mail') return;
      if (!rows || !rows.length) { sent.replaceChildren(h('div', { class: 'panel empty' }, 'Писем ещё не было')); return; }
      sent.replaceChildren(h('div', { class: 'panel' }, rows.map((m) => {
        const gift = m.gift && Object.keys(m.gift).length;
        const mayDel = m.to ? can('mail') : can('mail_all');
        return h('div', { class: 'item' },
          h('span', { class: 'ic' + (gift ? ' acc' : '') }, icon(gift ? 'gift' : 'mail')),
          h('div', { class: 't' },
            h('b', null, m.title),
            m.body ? h('p', null, m.body) : null,
            h('div', { class: 'meta' }, (m.to ? 'игроку ' + (m.to_name || m.to) : 'всем') + ' · ' + dateTime(m.at) + giftText(m.gift) + (m.until ? ' · до ' + date(m.until) : '')),
            h('div', { class: 'meta' }, h('b', null, num(m.read)), ' прочитали', gift ? [' · ', h('b', null, num(m.claimed)), ' забрали'] : null)),
          mayDel ? h('button', { class: 'ib', 'aria-label': 'Удалить', onclick: async () => {
            if (await confirmBox('Удалить письмо?', 'Оно пропадёт из почты у всех. Уже полученные подарки останутся у игроков.', 'Удалить', true)) { if (await act('adm_mail_delete', { p_id: m.id }, 'Письмо удалено')) loadSent(); }
          } }, icon('trash')) : null);
      })));
    }
    if (!stale(id)) await loadSent();
  }

  // ---------- лавка ----------
  async function renderShop(id) {
    body.replaceChildren(sec('Бонус дохода'), skeleton(3));
    let s;
    try { s = await api('adm_settings'); } catch (e) { if (!stale(id)) body.replaceChildren(failBox(e)); return; }
    if (stale(id)) return;
    s = s || {};
    const reload = () => render();
    const out = [];
    const segOf = (opts, cur, set) => {
      const el = h('div', { class: 'seg' });
      opts.forEach(([v, l]) => el.append(h('button', { class: v === cur ? 'on' : '', onclick: (e) => { set(v); el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === e.currentTarget)); } }, l)));
      return el;
    };

    if (can('settings')) {
      const b = s.boost || null;
      const bLive = b && +b.mult > 1 && Date.parse(b.until) > Date.now();
      let mult = bLive ? +b.mult : 2, hours = 48;
      const bLabel = h('input', { class: 'input', maxlength: '40', placeholder: 'Например: выходные', value: (b && b.label) || '' });
      out.push(sec('Бонус дохода', bLive ? 'активен' : 'выключен'),
        h('div', { class: 'panel pad' },
          bLive ? h('div', { class: 'item', style: { padding: '0 0 14px' } }, h('span', { class: 'ic acc' }, icon('bolt')),
            h('div', { class: 't' }, h('b', { class: 'mono', style: { color: 'var(--acc)', fontSize: '18px' } }, 'x' + String(b.mult).replace('.', ',')),
              h('div', { class: 'meta' }, 'до ' + dateTime(b.until) + (b.label ? ' · ' + b.label : '')))) :
            h('p', { class: 'mut', style: { margin: '0 0 14px' } }, 'Умножает доход в час и тапы у всех игроков.'),
          field('Множитель', segOf([[1.5, 'x1,5'], [2, 'x2'], [3, 'x3'], [5, 'x5']], mult, (v) => { mult = v; })),
          field('Длительность', segOf([[2, '2 ч'], [24, '24 ч'], [48, '48 ч'], [168, '7 д']], hours, (v) => { hours = v; })),
          field('Подпись', bLabel),
          h('div', { class: 'btns' },
            h('button', { class: 'btn', onclick: async () => {
              if (await act('adm_setting', { p_k: 'boost', p_v: { mult, until: new Date(Date.now() + hours * 3600000).toISOString(), label: bLabel.value.trim() } }, 'Бонус включён')) reload();
            } }, bLive ? 'Обновить' : 'Включить'),
            h('button', { class: 'btn ghost', disabled: !b, onclick: async () => { if (await act('adm_setting', { p_k: 'boost', p_v: null }, 'Бонус выключен')) reload(); } }, 'Выключить'))));

      const a = s.announce || null;
      const aTitle = h('input', { class: 'input', maxlength: '60', placeholder: 'Новости лавки', value: (a && a.title) || '' });
      const aText = h('textarea', { class: 'input', rows: '4', maxlength: '1000', placeholder: 'Что увидят игроки при входе' }, (a && a.text) || '');
      out.push(sec('Объявление', a ? 'опубликовано' : 'нет'),
        h('div', { class: 'panel pad' },
          h('p', { class: 'mut', style: { margin: '0 0 14px' } }, a ? 'Опубликовано ' + dateTime(new Date(+a.id).toISOString()) + '. Каждый игрок видит его один раз при входе.' : 'Окно, которое каждый игрок увидит один раз при входе.'),
          field('Заголовок', aTitle), field('Текст', aText),
          h('div', { class: 'btns' },
            h('button', { class: 'btn', onclick: async () => {
              if (!aText.value.trim()) { toast('Напиши текст', true); return; }
              if (await act('adm_setting', { p_k: 'announce', p_v: { id: Date.now(), title: aTitle.value.trim(), text: aText.value.trim() } }, 'Объявление опубликовано')) reload();
            } }, a ? 'Опубликовать заново' : 'Опубликовать'),
            h('button', { class: 'btn ghost', disabled: !a, onclick: async () => { if (await act('adm_setting', { p_k: 'announce', p_v: null }, 'Объявление снято')) reload(); } }, 'Снять'))));
    }

    if (can('settings')) {
      const bt = s.boss_test && s.boss_test.on;
      const sw = h('button', { class: 'sw' + (bt ? ' on' : ''), role: 'switch', 'aria-label': 'Босс в будни' });
      sw.addEventListener('click', async () => {
        const on = !sw.classList.contains('on');
        if (await act('adm_setting', { p_k: 'boss_test', p_v: on ? { on: true } : null }, on ? 'Босс открыт и в будни' : 'Босс только по выходным')) sw.classList.toggle('on', on);
      });
      out.push(sec('Босс ковенов', 'пт-вс'),
        h('div', { class: 'panel pad' },
          h('div', { class: 'tog' }, h('div', { class: 't' }, h('b', null, 'Босс в будни'), h('small', null, 'Для проверки: босс доступен в любой день. Обычно - с пятницы по воскресенье')), sw)));
    }

    if (can('maint')) {
      const m = s.maint || null;
      const mText = h('input', { class: 'input', maxlength: '200', placeholder: 'Мы немножко подкручиваем котёл. Загляни чуть позже!', value: (m && m.text) || '' });
      const mSw = h('button', { class: 'sw red' + (m && m.on ? ' on' : ''), role: 'switch', 'aria-label': 'Техработы' });
      mSw.addEventListener('click', async () => {
        const on = !mSw.classList.contains('on');
        if (on && !(await confirmBox('Закрыть игру?', 'Все игроки, кроме команды, увидят экран «Лавка на ремонте».', 'Закрыть', true))) return;
        if (await act('adm_setting', { p_k: 'maint', p_v: { on, text: mText.value.trim() } }, on ? 'Игра закрыта на техработы' : 'Игра снова открыта')) mSw.classList.toggle('on', on);
      });
      out.push(sec('Техработы', m && m.on ? 'игра закрыта' : 'игра открыта'),
        h('div', { class: 'panel pad' },
          h('div', { class: 'tog' }, h('div', { class: 't' }, h('b', null, 'Закрыть игру'), h('small', null, 'Команда продолжит играть')), mSw),
          field('Текст на экране', mText)));
    }

    const nBox = h('div', { class: 'panel pad' }, h('div', { class: 'skel' }));
    out.push(sec('Напоминания'), nBox);
    api('adm_notify_stats').then((n) => {
      nBox.replaceChildren(
        kv('Включили напоминания', num(n.enabled)), kv('Отправлено за сутки', num(n.day)), kv('За неделю', num(n.week)),
        kv('Ключ ВК для уведомлений', n.vk_key ? 'есть' : 'нет - во ВК напоминания не уходят'),
        h('p', { class: 'hint' }, 'Не чаще 2 раз в сутки на игрока, с 9:00 до 22:00 по Москве, только тем, кто не в игре.'));
    }).catch((e) => nBox.replaceChildren(h('p', { class: 'mut' }, /function|does not exist/.test(String(e.message)) ? 'Запусти в базе update9.sql' : errText(e))));
    out.push(sec('Ссылки'),
      h('div', { class: 'panel pad' },
        kv('Игра', h('span', { class: 'mono' }, 't.me/bulkgamemagikbot?startapp')),
        kv('Панель', h('span', { class: 'mono' }, '.../bulk/admin')),
        h('div', { class: 'btns' },
          h('button', { class: 'btn ghost sm', onclick: () => openExt('https://t.me/share/url?url=' + encodeURIComponent('https://t.me/bulkgamemagikbot?startapp') + '&text=' + encodeURIComponent('Заходи в мою волшебную лавку «Бульк»!')) }, 'Поделиться игрой'),
          h('button', { class: 'btn ghost sm', onclick: () => openExt('https://supabase.com/dashboard/project/ahqaficklfciahzlghec') }, 'Supabase'))));
    body.replaceChildren(...out);
  }

  // ---------- команда и журнал ----------
  async function renderTeam(id) {
    body.replaceChildren(sec('Команда'), skeleton(3));
    let team, log = null;
    try { [team, log] = await Promise.all([api('adm_team'), can('log') ? api('adm_log') : Promise.resolve(null)]); }
    catch (e) { if (!stale(id)) body.replaceChildren(failBox(e)); return; }
    if (stale(id)) return;
    const out = [];
    out.push(sec('Команда', String((team || []).length)),
      h('div', { class: 'panel' }, (team || []).map((m) => h('button', { class: 'member', onclick: () => { haptic(); openPlayer(m.id); } },
        ava(m.photo, online(m.last_seen)),
        h('span', { class: 'who' },
          h('b', null, h('em', null, m.name || 'ID ' + m.id), roleTag(m.role), m.id === ME.id ? h('span', { class: 'tag' }, 'ты') : null),
          h('small', null, (m.username ? '@' + m.username + ' · ' : '') + 'ID ' + m.id + ' · ' + ago(m.last_seen)),
          m.role === 'creator' ? null : h('span', { class: 'perms' }, (m.perms || []).map((p) => h('span', null, PERM_NAME[p] || p))))))));

    if (can('team')) {
      const nid = h('input', { class: 'input mono', type: 'number', inputmode: 'numeric', placeholder: 'Telegram ID' });
      out.push(sec('Добавить по ID'),
        h('div', { class: 'panel pad' },
          h('div', { class: 'inline' }, nid, h('button', { class: 'btn', onclick: async () => {
            const v = Math.floor(+nid.value || 0);
            if (!v) { toast('Введи Telegram ID', true); return; }
            if (await roleDialog(v, null, null)) render();
          } }, icon('plus'), 'Добавить')),
          h('p', { class: 'hint' }, 'Проще всего: найди человека во вкладке «Игроки» и нажми «Добавить в команду». По ID можно добавить и того, кто ещё не заходил в игру: свой ID он увидит, если откроет панель.')));
    }

    out.push(...accountBlock());
    out.push(sec('Мои права', ROLES[ME.role]),
      h('div', { class: 'panel pad' }, h('div', { class: 'perms', style: { marginTop: 0 } }, ME.perms.map((p) => h('span', null, PERM_NAME[p] || p)))));

    if (log) {
      out.push(sec('Журнал', String(log.length)),
        log.length ? h('div', { class: 'panel' }, log.map((l) => h('div', { class: 'log' },
          h('div', null, h('b', null, actionName(l.action)), l.target ? [' · ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); openPlayer(l.target); } }, l.name || 'ID ' + l.target)] : null),
          detailText(l) ? h('div', { class: 'd' }, detailText(l)) : null,
          h('div', { class: 'meta' }, dateTime(l.at) + ' · ' + (l.admin_name || 'ID ' + l.admin))))) : h('div', { class: 'panel empty' }, 'Пока пусто'));
    }
    out.push(h('p', { class: 'ver mono' }, 'админка ' + ADM_V + (APP && APP.version ? ' · приложение ' + APP.version() : '')));
    body.replaceChildren(...out);
    loadDevices();
  }

  // ---------- мой аккаунт: соцсети, устройства, выход ----------
  let devBox = null;
  function accountBlock() {
    const net = (name, idv, other) => h('div', { class: 'net' },
      h('span', { class: 'net-n' }, name),
      idv ? h('span', { class: 'mono ok' }, icon('check'), String(idv)) : h('button', { class: 'btn ghost sm', onclick: () => linkSecond(other) }, icon('plus'), 'Привязать'));
    devBox = h('div', { class: 'panel' }, h('div', { class: 'skel' }));
    return [sec('Мой аккаунт'),
      h('div', { class: 'panel pad' },
        net('Telegram', ME.tg, 'Telegram'), net('ВКонтакте', ME.vk, 'ВК'),
        h('p', { class: 'hint' }, 'Войти в админку можно кодом из игры на любой привязанной платформе.')),
      sec('Входы в приложение'), devBox];
  }
  async function loadDevices() {
    if (!devBox) return;
    const box = devBox;
    let list;
    try { list = await api('adm_devices'); } catch (e) { box.replaceChildren(h('div', { class: 'empty' }, errText(e))); return; }
    const rows = (list || []).map((d) => h('div', { class: 'dev' },
      h('span', { class: 'who' }, h('b', null, d.device || 'Устройство', d.current ? h('span', { class: 'tag acc' }, 'это') : null),
        h('small', null, 'вход ' + dateTime(d.created) + ' · был ' + ago(d.seen))),
      d.current ? h('button', { class: 'btn ghost sm', onclick: logout }, 'Выйти')
        : h('button', { class: 'btn ghost sm', onclick: async () => {
          if (!(await confirmBox('Выйти на этом устройстве?', 'Чтобы войти снова, понадобится новый код из игры.', 'Выйти', true))) return;
          if (await act('adm_device_drop', { p_id: d.id }, 'Устройство отключено')) loadDevices();
        } }, 'Отключить')));
    box.replaceChildren(...(rows.length ? rows : [h('div', { class: 'empty' }, tokenMode() ? '' : 'Нет входов. Скачай приложение «Бульк Админ» и войди по коду из игры.')]));
  }
  async function logout() {
    if (!(await confirmBox('Выйти из админки?', 'Чтобы войти снова, понадобится новый код из игры.', 'Выйти', true))) return;
    try { await api('adm_logout'); } catch (e) { /* всё равно выходим */ }
    store(TOKEN_KEY, null); initData = '';
    loginScreen();
  }
  async function linkSecond(other) {
    let code;
    try { code = await api('adm_link_code'); } catch (e) { toast(/play first/.test(String(e.message)) ? 'Сначала зайди в игру хотя бы раз' : errText(e), true); return; }
    await dialog('Привязать ' + other, null,
      h('div', null,
        h('div', { class: 'bigcode mono' }, String(code).padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1 $2')),
        h('ol', { class: 'steps' },
          h('li', null, 'Открой игру ' + (other === 'ВК' ? 'во ВКонтакте' : 'в Telegram') + '.'),
          h('li', null, 'Настройки → «Один прогресс» → «Связать» → «Ввести код».'),
          h('li', null, 'Введи этот код и выбери, какой прогресс оставить.')),
        h('p', { class: 'hint' }, 'Код действует 10 минут. После привязки входить можно с обеих платформ.')),
      [{ label: 'Готово', v: true }]);
  }
  const actionName = (a) => ({ 'Настройка boost': 'Бонус дохода', 'Настройка announce': 'Объявление', 'Настройка maint': 'Техработы', 'Настройка boss_test': 'Босс в будни' })[a] || a;
  function detailText(l) {
    const d = l.details || {};
    if (!Object.keys(d).length) return '';
    if (/^Письмо/.test(l.action)) return '«' + (d.title || '') + '»' + giftText(d.gift);
    if (l.action === 'Правка сохранения') return opsText(d);
    if (l.action === 'Скрыл сообщение') return 'сообщение в чате ковена';
    if (l.action === 'Переименовал ковен') return '→ «' + d.name + '»';
    if (l.action === 'Привязал платформу') return 'Telegram ' + (d.tg || '-') + ' + ВК ' + (d.vk || '-');
    if (l.action === 'Назначил в команду') return (ROLES[d.role] || d.role) + (d.role === 'custom' && d.perms ? ': ' + d.perms.map((p) => PERM_NAME[p] || p).join(', ') : '');
    if (l.action === 'Изменил игрока') {
      const a = [];
      if ('banned' in d) a.push(d.banned ? 'заблокирован' : 'разблокирован');
      if (d.ban_reason) a.push('причина: ' + d.ban_reason);
      if ('top_ban' in d) a.push(d.top_ban ? 'убран из топов' : 'возвращён в топы');
      if ('no_gift' in d) a.push(d.no_gift ? 'без общих подарков' : 'общие подарки разрешены');
      if ('chat_ban' in d) a.push(d.chat_ban ? 'заглушён в чате' : 'может писать в чат');
      if ('note' in d) a.push('заметка');
      return a.join(', ');
    }
    if (l.action === 'Настройка boost') return d.mult ? 'x' + String(d.mult).replace('.', ',') + ' до ' + dateTime(d.until) + (d.label ? ' · ' + d.label : '') : 'выключен';
    if (l.action === 'Настройка announce') return d.text ? '«' + (d.title || 'Новости лавки') + '»: ' + d.text.slice(0, 80) : 'снято';
    if (l.action === 'Настройка maint') return d.on ? 'игра закрыта' : 'игра открыта';
    if (d.board) return d.board === 'all' ? 'все топы' : d.board;
    return '';
  }

  // ---------- вход ----------
  function stateScreen(title, text, extra) {
    $('app').replaceChildren(h('div', { class: 'state' }, h('div', null, h('div', { class: 'mark big' }, glyph()), h('h2', null, title), h('p', null, text), extra || null)));
  }
  function loginScreen(note) {
    const inp = h('input', { class: 'codein mono', type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '7', placeholder: '000 000', 'aria-label': 'Код из игры' });
    const err = h('p', { class: 'login-err' }, note || '');
    const btn = h('button', { class: 'btn wide', disabled: true }, 'Войти');
    const digits = () => inp.value.replace(/\D/g, '').slice(0, 6);
    inp.addEventListener('input', () => {
      const d = digits();
      inp.value = d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d;
      btn.disabled = d.length !== 6;
      UI_setText(err, '');
      if (d.length === 6) go();
    });
    let busy = false;
    async function go() {
      if (busy) return;
      busy = true; btn.disabled = true; btn.textContent = 'Проверяю...';
      let r = null;
      try {
        r = await api('adm_login', { p_code: digits(), p_device: (APP && APP.device ? APP.device() : deviceName()) }, true);
      } catch (e) { r = { error: errText(e) }; }
      busy = false; btn.textContent = 'Войти';
      if (r && r.token) {
        store(TOKEN_KEY, r.token); initData = 'adm:' + r.token;
        haptic('ok'); boot(); return;
      }
      haptic('err');
      const m = r && r.error;
      UI_setText(err, m === 'bad code' ? 'Код не подходит или устарел' : m === 'too many tries' ? 'Слишком много попыток. Подожди 10 минут' : (m || 'Не получилось'));
      inp.value = ''; inp.focus();
    }
    btn.addEventListener('click', go);
    $('app').replaceChildren(h('div', { class: 'state login' }, h('div', null,
      h('div', { class: 'mark big' }, glyph()),
      h('h2', null, 'Бульк · Админ'),
      h('p', null, 'Вход по коду из игры'),
      inp, btn, err,
      h('ol', { class: 'steps' },
        h('li', null, 'Открой «Бульк» во ВКонтакте или Telegram.'),
        h('li', null, 'Настройки → «Приложение админки» → «Код».'),
        h('li', null, 'Введи 6 цифр здесь. Код живёт 5 минут.')),
      h('p', { class: 'hint' }, 'Кнопка с кодом видна только команде лавки.'))));
    setTimeout(() => inp.focus(), 250);
  }
  const UI_setText = (el, t) => { el.textContent = t; };
  function deviceName() {
    const ua = navigator.userAgent || '';
    const m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/);
    return (m ? m[1].trim() : /iPhone/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Браузер') + (APP ? '' : ' · браузер');
  }
  function glyph() {
    const NS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 48 48'); s.setAttribute('class', 'glyph');
    s.innerHTML = '<path d="M9 21h30"/><path d="M11 21c0 9 5.5 15 13 15s13-6 13-15"/><path d="M17 36l-2 4M31 36l2 4"/><circle cx="20" cy="14" r="2.2"/><circle cx="27" cy="10" r="1.6"/><circle cx="29" cy="16" r="1.2"/>';
    return s;
  }

  // ---------- потянуть вниз - обновить ----------
  const ptr = h('div', { class: 'ptr' }, icon('refresh'));
  (() => {
    let y0 = -1, dy = 0;
    document.addEventListener('touchstart', (e) => { y0 = window.scrollY <= 0 && !document.querySelector('.dlg') && !sheetEl ? e.touches[0].clientY : -1; dy = 0; }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (y0 < 0) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      ptr.style.setProperty('--p', Math.min(1, dy / 90));
      ptr.classList.toggle('show', dy > 12);
    }, { passive: true });
    document.addEventListener('touchend', () => {
      if (y0 >= 0 && dy > 90 && refreshBtn) { haptic(); render(); }
      y0 = -1; dy = 0; ptr.classList.remove('show'); ptr.style.setProperty('--p', 0);
    });
  })();

  async function boot() {
    setupTelegram();
    if (!initData) { loginScreen(); return; }
    stateScreen('Проверяю доступ', 'Секунду...');
    let me;
    try { me = await api('adm_me'); } catch (e) {
      if (!initData) return; // ключ устарел - уже показан вход
      stateScreen('Нет связи с базой', errText(e), h('button', { class: 'btn', onclick: boot }, 'Повторить'));
      return;
    }
    if (!me || !me.role) {
      stateScreen('Нет доступа', 'Панель только для команды лавки. Передай создателю свой ID:', h('div', null, h('code', null, String((me && me.id) || (tgUser && tgUser.id) || '-'))));
      return;
    }
    ME = { id: me.id, role: me.role, perms: me.perms || [], name: tokenMode() ? me.name : '', tg: me.tg, vk: me.vk };
    shell();
    render();
  }
  boot();
})();

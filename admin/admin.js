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
  const ADM_V = '0.24';
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
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
    help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    chev: 'M9 6l6 6-6 6',
    image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01',
    x: 'M18 6L6 18M6 6l12 12',
    up: 'M12 19V5M5 12l7-7 7 7',
    down: 'M12 5v14M19 12l-7 7-7-7',
    trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3'
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
  // группа кнопок - не в label: иначе нажатие уходит на первую кнопку группы
  const group = (label, content) => h('div', { class: 'field' }, h('span', null, label), content);
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
    if (/no ticket/.test(m)) return 'Обращение не найдено';
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
  // команда, мой аккаунт и входы - под портретом в шапке, чтобы не занимать меню
  const ALL_TABS = [
    { id: 'home', label: 'Обзор', icon: 'pulse', ok: () => true },
    { id: 'players', label: 'Игроки', icon: 'users', ok: () => true },
    { id: 'msgs', label: 'Сообщения', icon: 'mail', ok: () => can('mail') || can('mail_all') },
    { id: 'game', label: 'Игра', icon: 'sliders', ok: () => can('settings') || can('maint') || can('gift') },
    { id: 'log', label: 'История', icon: 'clock', ok: () => can('log') }
  ];
  let TABS = [];
  let tab = 'home';
  try { tab = sessionStorage.getItem('adm_tab') || 'home'; } catch (e) { /* ignore */ }
  let MMODE = 'support';
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
        h('button', { class: 'me-btn', 'aria-label': 'Команда и аккаунт', onclick: () => { haptic(); openTeam(); } }, ava(ME.photo, false), icon('shield')),
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
      else if (tab === 'msgs') {
        if (!can('mail') && MMODE === 'support') MMODE = 'mail';
        await (MMODE === 'mail' ? renderMail(id) : MMODE === 'bcast' ? renderBcast(id) : renderSupport(id));
      }
      else if (tab === 'game') await renderShop(id);
      else if (tab === 'log') await renderHistory(id);
    } finally { if (id === renderId) refreshBtn.classList.remove('spin'); }
  }
  const stale = (id) => id !== renderId;
  const failBox = (e) => h('div', { class: 'panel pad center' }, h('p', { class: 'mut', style: { margin: '0 0 12px' } }, errText(e)), h('button', { class: 'btn ghost sm', onclick: render }, 'Повторить'));

  // ---------- поддержка: обращения игроков ----------
  const SUP_ST = { open: 'Ждут', answered: 'Отвечено', closed: 'Закрыты', all: 'Все' };
  let supFilter = 'open';
  // вкладка «Сообщения»: поддержка, почта в игре, рассылки в Telegram и ВК
  function msgHost() {
    const opts = [].concat(can('mail') ? [['support', 'Поддержка']] : [], [['mail', 'Почта в игре'], ['bcast', 'Рассылка']]);
    if (!opts.some((o) => o[0] === MMODE)) MMODE = opts[0][0];
    const seg = h('div', { class: 'seg', style: { margin: '12px 0 0' } }, opts.map(([v, l]) => h('button', { class: v === MMODE ? 'on' : '', onclick: () => { if (MMODE !== v) { MMODE = v; haptic(); window.scrollTo(0, 0); render(); } } }, l)));
    const inner = h('div');
    body.replaceChildren(seg, inner);
    return inner;
  }
  async function renderSupport(id) {
    const body = msgHost();
    body.replaceChildren(sec('Обращения'), skeleton(4));
    let r;
    try { r = await api('adm_support_list', { p_status: supFilter }); } catch (e) { if (!stale(id)) body.replaceChildren(failBox(e)); return; }
    if (stale(id)) return;
    const c = r.counts || {};
    const seg = h('div', { class: 'seg' }, Object.keys(SUP_ST).map((k) => h('button', { class: k === supFilter ? 'on' : '',
      onclick: () => { if (supFilter === k) return; supFilter = k; haptic(); render(); } }, SUP_ST[k] + (k !== 'all' && c[k] ? ' ' + c[k] : ''))));
    const rows = r.rows || [];
    body.replaceChildren(sec('Обращения', c.open ? c.open + ' ждут' : ''), seg, h('div', { style: { height: '10px' } }),
      rows.length ? h('div', { class: 'panel list' }, rows.map((t) => h('button', { class: 'row', onclick: () => { haptic(); openTicket(t.id); } },
        ava(t.photo, false),
        h('span', { class: 'who' }, h('b', null, h('em', null, t.name), t.team_unread ? h('span', { class: 'tag acc', style: { marginLeft: '6px' } }, 'новое ' + t.team_unread) : null),
          h('small', null, (t.last_team ? 'Вы: ' : '') + (t.last || ''))),
        h('span', { class: 'mut mono', style: { fontSize: '11px', whiteSpace: 'nowrap' } }, ago(t.updated_at))))) :
        h('div', { class: 'panel empty' }, supFilter === 'open' ? 'Новых обращений нет' : 'Пусто'));
  }

  async function openTicket(tid) {
    if (!sheetEl) sheetScroll = window.scrollY;
    if (sheetEl) sheetEl.remove();
    const inner = h('main', null, h('div', { style: { height: '14px' } }), skeleton(4));
    sheetEl = h('div', { class: 'sheet' },
      h('div', { class: 'top' }, h('div', { class: 'top-in' },
        h('button', { class: 'ib', 'aria-label': 'Назад', onclick: () => { closeSheet(); if (tab === 'msgs' && MMODE === 'support') render(); } }, icon('back')),
        h('div', { class: 'title' }, h('b', null, 'Обращение №' + tid), h('small', null, 'Поддержка')),
        h('button', { class: 'ib', 'aria-label': 'Обновить', onclick: () => openTicket(tid) }, icon('refresh')))),
      inner);
    document.body.append(sheetEl);
    document.body.style.overflow = 'hidden';
    let t;
    try { t = await api('adm_support_get', { p_id: tid }); } catch (e) { inner.replaceChildren(h('div', { style: { height: '14px' } }), failBox(e)); return; }
    const PL = { vk: 'ВКонтакте', tg: 'Telegram' };
    const msgs = h('div', { class: 'sup-msgs' }, (t.msgs || []).map((m) => h('div', { class: 'sup-msg' + (m.team ? ' team' : '') },
      h('small', null, (m.team ? (m.who || 'Поддержка') : t.name) + ' · ' + dateTime(m.at)), h('p', null, m.text))));
    const input = h('textarea', { class: 'input', rows: '3', maxlength: '2000', placeholder: 'Ответ игроку. Он придёт и в поддержку в игре, и письмом в почту.' });
    const send = h('button', { class: 'btn wide', onclick: async () => {
      const txt = input.value.trim();
      if (!txt) { toast('Напиши ответ', true); return; }
      send.disabled = true;
      if (await act('adm_support_reply', { p_id: tid, p_text: txt }, 'Ответ отправлен')) openTicket(tid); else send.disabled = false;
    } }, icon('send'), 'Ответить');
    const closed = t.status === 'closed';
    inner.replaceChildren(
      h('div', { class: 'hero' }, ava(t.photo, false, true),
        h('div', { style: { minWidth: 0 } }, h('h2', null, t.name),
          h('div', { class: 'id' }, 'ID ' + t.uid + (t.platform ? ' · ' + (PL[t.platform] || t.platform) : '') + (t.ver ? ' · ' + t.ver : '')),
          h('div', { class: 'tags' }, h('span', { class: 'tag' + (t.status === 'open' ? ' acc' : '') }, SUP_ST[t.status] || t.status),
            t.earlier ? h('span', { class: 'tag' }, 'раньше обращался: ' + t.earlier) : null,
            h('a', { href: '#', class: 'tag blue', onclick: (e) => { e.preventDefault(); openPlayer(t.uid); } }, 'карточка игрока')))),
      sec('Переписка'), h('div', { class: 'panel pad' }, msgs),
      sec('Ответ'), h('div', { class: 'panel pad' }, input, h('div', { style: { height: '8px' } }), send,
        h('button', { class: 'btn ghost wide', style: { marginTop: '8px' }, onclick: async () => {
          if (closed || await confirmBox('Закрыть обращение?', 'Если игрок напишет снова, откроется новое обращение.', 'Закрыть')) {
            if (await act('adm_support_status', { p_id: tid, p_status: closed ? 'open' : 'closed' }, closed ? 'Обращение открыто' : 'Обращение закрыто')) openTicket(tid);
          }
        } }, closed ? 'Открыть снова' : 'Закрыть обращение')));
    requestAnimationFrame(() => { const last = msgs.lastElementChild; if (last) last.scrollIntoView({ block: 'nearest' }); });
  }

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
      attnBox(id),
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
      h('div', { class: 'panel pad' }, bars(Object.entries(s.versions || {}).sort((a, b) => b[1] - a[1]), vTotal)),
      Object.assign(sec('Надёжность', '7 дней'), { id: 'health' }),
      healthBox(id));
  }

  // сбои загрузки сохранения у игроков и сохранения, которые база не приняла (защита сработала)
  const BOOT_SRC = { ok: 'ответила', ok2: 'ответила со 2-й попытки', empty: 'пусто', fail: 'не ответила', fail2: 'не ответила дважды', broken: 'ошибка', none: '-' };
  function healthBox(id) {
    const box = h('div', { class: 'panel pad' }, h('p', { class: 'hint' }, 'Загружаю...'));
    api('adm_health').then((r) => {
      if (stale(id)) return;
      const k = (v, label, bad) => h('div', { class: 'kpi' + (bad && v ? ' acc' : '') }, h('b', null, num(v)), h('span', null, label));
      const rows = (r.last || []).map((x) => {
        const i = x.info || {};
        return h('button', { class: 'row', onclick: () => { haptic(); openPlayer(x.uid); } },
          h('span', { class: 'who' }, h('b', null, h('em', null, x.name), x.old_player && i.chosen === 'fresh' ? h('span', { class: 'tag red', style: { marginLeft: '6px' } }, 'старт с нуля') : null),
            h('small', { style: { whiteSpace: 'normal' } }, 'база: ' + (BOOT_SRC[i.server] || i.server || '-') + ' (' + (i.serverMs || 0) + ' мс) · облако: ' + (BOOT_SRC[i.cloud] || i.cloud || '-') + ' (' + (i.cloudMs || 0) + ' мс) · ' + (i.plat || '') + ' ' + (i.ver || '') + (i.net ? ' · ' + i.net : ''))),
          h('span', { class: 'mut mono', style: { fontSize: '11px', whiteSpace: 'nowrap' } }, ago(x.at)));
      });
      box.replaceChildren(
        h('div', { class: 'kpis' }, k(r.rejected, 'спасено сохранений', true), k(r.boot_fail, 'база не ответила при запуске', true),
          k(r.boot_fresh_old, 'старт с нуля у старых игроков', true), k(r.boot_total, 'отчётов о сбоях')),
        h('p', { class: 'hint' }, '«Спасено» - игра открылась без сохранения или с чужой копией, база не дала затереть прогресс и вернула настоящий. Отчёты приходят только при сбоях.'),
        rows.length ? h('div', { class: 'list', style: { marginTop: '8px' } }, rows) : h('p', { class: 'hint' }, 'Сбоев загрузки не было.'));
    }).catch((e) => { if (!stale(id)) box.replaceChildren(h('p', { class: 'hint' }, errText(e))); });
    return box;
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
    const opts = [['players', 'Игроки'], ['covens', 'Ковены'], ['tops', 'Топы']].concat(can('ban') ? [['reports', 'Жалобы'], ['sus', 'Проверка']] : []);
    return h('div', { class: 'seg', style: { margin: '12px 0 0' } }, opts.map(([v, l]) => h('button', { class: v === PMODE ? 'on' : '', onclick: () => { if (PMODE !== v) { PMODE = v; haptic(); render(); } } }, l)));
  }
  async function renderPlayers(id) {
    if (PMODE === 'covens') return renderCovens(id);
    if (PMODE === 'sus') return renderSus(id);
    if (PMODE === 'reports') return renderReports(id);
    if (PMODE === 'tops') return renderTops(id);
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

    if (isCreator && can('ban') && (p.top_ban || p.top_hold)) {
      out.push(sec('Топы'), h('div', { class: 'panel pad' },
        h('p', { class: 'mut', style: { margin: '0 0 12px' } }, p.top_hold ? 'Ты на проверке: ' + (p.sus_reason || 'подозрительный рост') + '.' : 'Ты убран из топов' + (p.sus_reason ? ': ' + p.sus_reason : '') + '.'),
        h('button', { class: 'btn wide', onclick: async () => { if (await act('adm_set_player', { p_id: id, f: { top_ban: false } }, 'Ты снова в топах')) reopen(); } }, 'Вернуть в топы')));
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
    const body = msgHost();
    // кому: всем (одно общее письмо), группе (личное письмо каждому по условиям), одному
    const to = { all: can('mail_all'), mode: can('mail_all') ? 'all' : 'one' };
    const toSeg = h('div', { class: 'seg' });
    const toId = h('input', { class: 'input mono', type: 'number', inputmode: 'numeric', placeholder: 'ID игрока', style: { display: to.mode === 'one' ? '' : 'none', marginTop: '8px' } });
    const grp = audienceBox({ kinds: false });
    grp.el.style.display = 'none';
    const setTo = (m) => {
      to.mode = m; to.all = m === 'all';
      toSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
      toId.style.display = m === 'one' ? '' : 'none'; grp.el.style.display = m === 'group' ? '' : 'none'; upd();
    };
    if (can('mail_all')) toSeg.append(h('button', { class: to.mode === 'all' ? 'on' : '', 'data-m': 'all', onclick: () => setTo('all') }, 'Всем'));
    if (can('mail_all')) toSeg.append(h('button', { 'data-m': 'group', onclick: () => setTo('group') }, 'Группе'));
    if (can('mail')) toSeg.append(h('button', { class: to.mode === 'one' ? 'on' : '', 'data-m': 'one', onclick: () => setTo('one') }, 'Одному'));
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
      prev.replaceChildren(h('div', { class: 'meta', style: { marginBottom: '8px', letterSpacing: '.1em' } }, 'ПРЕВЬЮ · ' + ({ all: 'ВСЕМ', group: 'ГРУППЕ', one: 'ИГРОКУ' })[to.mode]),
        h('div', { class: 'item', style: { padding: 0 } }, h('span', { class: 'ic' + (g.length ? ' acc' : '') }, icon(g.length ? 'gift' : 'mail')),
          h('div', { class: 't' }, h('b', null, title.value || 'Заголовок'), h('p', null, text.value || 'Текст письма'), g.length ? h('div', { class: 'meta' }, h('b', null, 'Подарок: '), g.join(' + ')) : null)));
    }
    [title, text, cr, hrs].forEach((x) => x.addEventListener('input', upd));
    upd();
    const send = h('button', { class: 'btn wide', style: { marginTop: '12px' }, onclick: async () => {
      if (!title.value.trim()) { toast('Напиши заголовок', true); return; }
      const target = to.all ? 0 : Math.floor(+toId.value || 0);
      if (to.mode === 'one' && !target) { toast('Укажи ID игрока', true); return; }
      const g = can('gift') ? { cr: Math.max(0, Math.floor(+cr.value || 0)), ess_h: Math.max(0, +hrs.value || 0) } : {};
      if (to.mode === 'group') {
        const n = await grp.count();
        if (!n) { toast('Под условия никто не подходит', true); return; }
        if (!(await confirmBox('Отправить ' + num(n) + ' ' + word(n, 'игроку', 'игрокам', 'игрокам') + '?', 'Каждый получит личное письмо' + (g.cr || g.ess_h ? ' с подарком' : '') + '.', 'Отправить'))) return;
        send.disabled = true;
        const r = await act('adm_gift_group', { p: { aud: grp.get(), title: title.value.trim(), body: text.value.trim(), gift: g, days: Math.max(0, Math.floor(+days.value || 0)) } });
        send.disabled = false;
        if (r !== false) { toast('Отправлено: ' + num(r)); title.value = ''; text.value = ''; cr.value = ''; hrs.value = ''; days.value = ''; upd(); loadSent(); }
        return;
      }
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
        group('Кому', h('div', null, toSeg, toId, grp.el)),
        field('Заголовок', title), field('Текст', text),
        can('gift') ? h('div', { class: 'g2' }, field('Кристаллы', cr), field('Часы дохода', hrs)) : null,
        field('Хранить, дней', days),
        prev, send),
      sec('Отправленные'), sent);
    async function loadSent() {
      let rows;
      try { rows = await api('adm_mail_list'); } catch (e) { sent.replaceChildren(failBox(e)); return; }
      if (tab !== 'msgs' || MMODE !== 'mail') return;
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
    if (!can('settings') && !can('maint')) { body.replaceChildren(...promoBlock()); return; }
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
          group('Множитель', segOf([[1.5, 'x1,5'], [2, 'x2'], [3, 'x3'], [5, 'x5']], mult, (v) => { mult = v; })),
          group('Длительность', segOf([[2, '2 ч'], [24, '24 ч'], [48, '48 ч'], [168, '7 д']], hours, (v) => { hours = v; })),
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
    if (can('gift')) out.push(...promoBlock());
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
  async function renderTeam(box) {
    box.replaceChildren(sec('Команда'), skeleton(3));
    let team;
    try { team = await api('adm_team'); }
    catch (e) { box.replaceChildren(failBox(e)); return; }
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
            if (await roleDialog(v, null, null)) renderTeam(box);
          } }, icon('plus'), 'Добавить')),
          h('p', { class: 'hint' }, 'Проще всего: найди человека во вкладке «Игроки» и нажми «Добавить в команду». По ID можно добавить и того, кто ещё не заходил в игру: свой ID он увидит, если откроет панель.')));
    }

    out.push(...accountBlock());
    out.push(sec('Мои права', ROLES[ME.role]),
      h('div', { class: 'panel pad' }, h('div', { class: 'perms', style: { marginTop: 0 } }, ME.perms.map((p) => h('span', null, PERM_NAME[p] || p)))));

    out.push(h('p', { class: 'ver mono' }, 'админка ' + ADM_V + (APP && APP.version ? ' · приложение ' + APP.version() : '')));
    box.replaceChildren(...out);
    loadDevices();
  }

  // команда, аккаунт и входы - отдельный экран под портретом в шапке
  function openTeam() {
    if (!sheetEl) sheetScroll = window.scrollY;
    if (sheetEl) sheetEl.remove();
    const inner = h('main', null, h('div', { style: { height: '14px' } }), skeleton(3));
    sheetEl = h('div', { class: 'sheet' },
      h('div', { class: 'top' }, h('div', { class: 'top-in' },
        h('button', { class: 'ib', 'aria-label': 'Назад', onclick: closeSheet }, icon('back')),
        h('div', { class: 'title' }, h('b', null, 'Команда и аккаунт'), h('small', null, ROLES[ME.role] || '')))),
      inner);
    document.body.append(sheetEl);
    document.body.style.overflow = 'hidden';
    renderTeam(inner);
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
    if (l.action === 'Рассылка') return '«' + (d.title || '') + '» · ' + num(d.n || 0) + ' сообщ.' + (d.at ? ' · на ' + dateTime(d.at) : '');
    if (l.action === 'Отменил рассылку') return 'рассылка №' + d.id;
    if (l.action === 'Посты в группы') return ({ start: 'цикл запущен' + (d.text ? ': «' + d.text + '»' : ''), pause: 'цикл остановлен', stop: 'цикл остановлен', token: 'обновлён ключ ВК' })[d.cmd] || '';
    if (l.action === 'Промокод') return d.code + (d.active === false ? ' выключен' : d.active === true ? ' включён' : giftText(d.gift));
    if (l.action === 'Письмо группе') return '«' + (d.title || '') + '» · ' + num(d.n || 0) + ' игрокам' + giftText(d.gift);
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

  // ---------- кому: условия отбора игроков (рассылки, письма группе) ----------
  function audienceBox(o) {
    o = o || {};
    const st = { kind: 'all', id: '', inactive: 0, fresh: 0, rank: 0, lvl: 0 };
    const out = h('span', { class: 'aud-n' }, '');
    let t = 0;
    const kinds = o.kinds === false ? [] : [['all', 'Все'], ['one', 'Один игрок'], ['team', 'Команда']];
    const kindSeg = kinds.length ? h('div', { class: 'seg' }, kinds.map(([v, l]) => h('button', { class: v === st.kind ? 'on' : '', onclick: (e) => {
      st.kind = v; kindSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); draw(); changed();
    } }, l))) : null;
    const idIn = h('input', { class: 'input mono', type: 'number', inputmode: 'numeric', placeholder: 'ID игрока' });
    idIn.addEventListener('input', () => { st.id = idIn.value; changed(); });
    const numIn = (k, ph) => { const x = h('input', { class: 'input mono', type: 'number', inputmode: 'numeric', min: '0', placeholder: ph }); x.addEventListener('input', () => { st[k] = Math.max(0, Math.floor(+x.value || 0)); changed(); }); return x; };
    const rankSel = h('select', { class: 'input', onchange: () => { st.rank = +rankSel.value; changed(); } }, [h('option', { value: '0' }, 'любой')].concat(RANKS.map((n, i) => i ? h('option', { value: String(i) }, 'от «' + n + '»') : null)));
    const filters = h('div', { class: 'aud-f' },
      h('div', { class: 'g2' }, field('Не заходили, дней', numIn('inactive', 'не важно')), field('Пришли за, дней', numIn('fresh', 'не важно'))),
      h('div', { class: 'g2' }, field('Ранг', rankSel), field('Уровень от', numIn('lvl', 'любой'))));
    const box = h('div', { class: 'aud' }, kindSeg, idIn, filters, h('p', { class: 'hint aud-hint' }, 'Подходит: ', out));
    function draw() { idIn.style.display = st.kind === 'one' ? '' : 'none'; filters.style.display = st.kind === 'all' ? '' : 'none'; }
    const get = () => {
      const a = { kind: st.kind };
      if (st.kind === 'one') a.id = Math.floor(+st.id || 0);
      if (st.kind === 'all') ['inactive', 'fresh', 'rank', 'lvl'].forEach((k) => { if (st[k]) a[k] = st[k]; });
      return a;
    };
    async function count() {
      if (o.counter) return o.counter(get());
      try { const n = await api('adm_audience_count', { p_aud: get() }); out.textContent = num(n) + ' ' + word(n, 'игрок', 'игрока', 'игроков'); return n; }
      catch (e) { out.textContent = errText(e); return 0; }
    }
    function changed() { clearTimeout(t); out.textContent = '...'; t = setTimeout(() => { count(); if (o.onChange) o.onChange(get()); }, 400); }
    draw(); setTimeout(changed, 0);
    return { el: box, get, count, setText: (x) => { out.textContent = x; } };
  }

  // ---------- редактор текста с оформлением (Telegram: HTML, ВК: текст + разметка format_data) ----------
  const escHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const BLOCK = /^(DIV|P|BLOCKQUOTE|PRE|LI|UL|OL|H\d)$/;
  // из редактора: html для Telegram, чистый текст и разметка для ВК
  function serialize(root) {
    let html = '', text = '';
    const fmt = [];
    const nl = () => { if (text && !text.endsWith('\n')) { html += '\n'; text += '\n'; } };
    function walk(n, vkTypes) {
      if (n.nodeType === 3) { const t = n.nodeValue.replace(/ /g, ' '); html += escHtml(t); text += t; return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BR') { html += '\n'; text += '\n'; return; }
      let open = '', close = '', vk = null, url = null;
      if (tag === 'B' || tag === 'STRONG') { open = '<b>'; close = '</b>'; vk = 'bold'; }
      else if (tag === 'I' || tag === 'EM') { open = '<i>'; close = '</i>'; vk = 'italic'; }
      else if (tag === 'U') { open = '<u>'; close = '</u>'; vk = 'underline'; }
      else if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') { open = '<s>'; close = '</s>'; }
      else if (tag === 'CODE') { open = '<code>'; close = '</code>'; }
      else if (tag === 'PRE') { open = '<pre>'; close = '</pre>'; }
      else if (tag === 'SPAN' && n.classList.contains('sp')) { open = '<tg-spoiler>'; close = '</tg-spoiler>'; }
      else if (tag === 'A' && /^https?:\/\//.test(n.getAttribute('href') || '')) { url = n.getAttribute('href'); open = '<a href="' + escHtml(url).replace(/"/g, '&quot;') + '">'; close = '</a>'; vk = 'url'; }
      else if (tag === 'BLOCKQUOTE') { open = n.classList.contains('exp') ? '<blockquote expandable>' : '<blockquote>'; close = '</blockquote>'; }
      if (BLOCK.test(tag)) nl();
      const start = text.length;
      html += open;
      n.childNodes.forEach((c) => walk(c));
      html += close;
      if (vk && text.length > start) fmt.push(Object.assign({ type: vk, offset: start, length: text.length - start }, url ? { url } : {}));
      if (BLOCK.test(tag)) nl();
    }
    root.childNodes.forEach((c) => walk(c));
    // хвостовые пустые строки не нужны
    const cut = text.length - text.replace(/\s+$/, '').length;
    if (cut) { text = text.slice(0, text.length - cut); html = html.replace(/\s+((<\/[a-z-]+>)*)$/i, '$1'); }
    return { html: html.trim() ? html : '', text, vkfmt: fmt.filter((f) => f.offset < text.length).map((f) => Object.assign(f, { length: Math.min(f.length, text.length - f.offset) })) };
  }
  // обратно: html Telegram -> редактор (для «Повторить»)
  function deserialize(html) {
    const d = document.createElement('div');
    d.innerHTML = String(html || '').replace(/<tg-spoiler>/g, '<span class="sp">').replace(/<\/tg-spoiler>/g, '</span>')
      .replace(/<blockquote expandable>/g, '<blockquote class="exp">').replace(/\n/g, '<br>');
    d.querySelectorAll('script,style,img,iframe').forEach((x) => x.remove());
    return d.innerHTML;
  }
  function richEditor(onInput) {
    const ed = h('div', { class: 'rich', contenteditable: 'true', 'data-ph': 'Текст сообщения. Выдели слово и нажми кнопку оформления.' });
    const exec = (cmd, v) => { ed.focus(); try { document.execCommand('styleWithCSS', false, false); } catch (e) { /* ignore */ } document.execCommand(cmd, false, v); fire(); };
    // обернуть выделение своим тегом (спойлер, код)
    function wrap(tag, cls) {
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed || !ed.contains(sel.anchorNode)) { toast('Сначала выдели текст', true); return; }
      const r = sel.getRangeAt(0);
      const w = document.createElement(tag); if (cls) w.className = cls;
      w.append(r.extractContents()); r.insertNode(w);
      sel.removeAllRanges(); const nr = document.createRange(); nr.selectNodeContents(w); sel.addRange(nr);
      fire();
    }
    function unwrapAll() {
      exec('removeFormat');
      const sel = window.getSelection();
      ed.querySelectorAll('span.sp, code, pre, a, blockquote').forEach((x) => { if (!sel.rangeCount || sel.containsNode(x, true)) x.replaceWith(...x.childNodes); });
      fire();
    }
    async function link() {
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed || !ed.contains(sel.anchorNode)) { toast('Выдели слово, которое станет ссылкой', true); return; }
      const range = sel.getRangeAt(0).cloneRange();
      const inp = h('input', { class: 'input mono', type: 'url', placeholder: 'https://...', value: 'https://' });
      const ok = await dialog('Ссылка', 'Куда ведёт выделенный текст', inp, [{ label: 'Отмена', cls: 'ghost', v: false }, { label: 'Готово', v: true }]);
      if (!ok || !/^https?:\/\/\S+\.\S+/.test(inp.value.trim())) return;
      sel.removeAllRanges(); sel.addRange(range);
      exec('createLink', inp.value.trim());
    }
    const B = (label, title, fn, cls) => h('button', { type: 'button', class: 'tb' + (cls ? ' ' + cls : ''), title, 'aria-label': title, onmousedown: (e) => e.preventDefault(), onclick: fn }, label);
    const bar = h('div', { class: 'toolbar' },
      B('Ж', 'Жирный', () => exec('bold'), 'b'),
      B('К', 'Курсив', () => exec('italic'), 'i'),
      B('Ч', 'Подчёркнутый', () => exec('underline'), 'u'),
      B('З', 'Зачёркнутый (только Telegram)', () => exec('strikeThrough'), 's'),
      B('▒', 'Спойлер - скрытый текст (только Telegram)', () => wrap('span', 'sp')),
      B('</>', 'Моноширинный (только Telegram)', () => wrap('code')),
      B('❝', 'Цитата (только Telegram)', () => exec('formatBlock', 'blockquote')),
      B('🔗', 'Ссылка', link),
      B('✕', 'Убрать оформление', unwrapAll));
    function fire() { if (onInput) onInput(); }
    ed.addEventListener('input', fire);
    // вставка - только текст, без чужих стилей
    ed.addEventListener('paste', (e) => { e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t); });
    return { el: h('div', { class: 'rich-wrap' }, bar, ed), get: () => serialize(ed), set: (html) => { ed.innerHTML = deserialize(html); fire(); }, clear: () => { ed.innerHTML = ''; fire(); } };
  }

  // ---------- рассылки ----------
  const FN = 'https://ahqaficklfciahzlghec.supabase.co/functions/v1/bcast';
  const CH = { tg: 'Telegram', vk: 'ВК сообщения', vkn: 'ВК уведомление' };
  const BTN_T = { play: 'Играть', vk: 'Сообщество ВК', tg: 'Бот Telegram', url: 'Ссылка' };
  const BC_ST = { scheduled: 'запланирована', sending: 'отправляется', done: 'готово', canceled: 'отменена' };
  const kick = () => { try { fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'tick', init_data: initData }), keepalive: true }).catch(() => {}); } catch (e) { /* ignore */ } };
  let bcDraft = null; // «Повторить» кладёт сюда прошлую рассылку
  // ---------- вложения: с телефона, из моих фото ВК, по ссылке ----------
  const fnCall = async (b) => {
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ init_data: initData }, b)) });
    const x = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(x.error || 'ошибка ' + r.status);
    return x;
  };
  async function pickUrl(onItem, photosOnly) {
    const inp = h('input', { class: 'input mono', type: 'url', placeholder: 'https://...jpg' });
    const ok = await dialog('Картинка по ссылке', 'Вставь прямую ссылку на картинку' + (photosOnly ? '' : ' или видео') + '. Сервер скачает её сам.', inp, [{ label: 'Отмена', cls: 'ghost', v: false }, { label: 'Добавить', v: true }]);
    const u = inp.value.trim();
    if (!ok || !u) return;
    toast('Скачиваю...');
    try {
      const r = await fnCall({ action: 'from_url', url: u });
      if (photosOnly && r.kind !== 'photo') { toast('Нужна картинка (jpg, png, webp)', true); return; }
      onItem({ url: r.url, kind: r.kind, name: r.name });
      toast('Добавлено');
    } catch (e) { toast('Не получилось: ' + e.message, true); }
  }
  async function pickVkPhotos(onItem, left) {
    const grid = h('div', { class: 'vkp' }, h('p', { class: 'hint' }, 'Загружаю твои фото ВК...'));
    const chosen = new Map();
    let offset = 0, total = 0;
    async function more() {
      try {
        const r = await fnCall({ action: 'vk_photos', offset });
        total = r.total || 0;
        if (!offset) grid.replaceChildren();
        (r.items || []).forEach((x) => {
          const b = h('button', { type: 'button', class: 'vkp-i', style: { backgroundImage: 'url("' + x.thumb + '")' }, onclick: () => {
            if (chosen.has(x.vk)) chosen.delete(x.vk); else if (chosen.size < left) chosen.set(x.vk, x); else { toast('Не больше ' + left, true); return; }
            b.classList.toggle('on', chosen.has(x.vk));
          } });
          grid.append(b);
        });
        offset += (r.items || []).length;
        const old = grid.parentNode && grid.parentNode.querySelector('.vkp-more'); if (old) old.remove();
        if (offset < total) grid.after(h('button', { type: 'button', class: 'btn ghost sm wide vkp-more', onclick: more }, 'Ещё фото'));
        if (!offset) grid.replaceChildren(h('p', { class: 'hint' }, 'В альбомах пока нет фото. Загрузи картинку во ВК (например, в «Сохранённые»), и она появится здесь.'));
      } catch (e) {
        grid.replaceChildren(h('p', { class: 'hint' }, /no token/.test(e.message) ? 'Нужен ключ ВК: получи его во вкладке «Посты в группы ВК».' : 'Не загрузилось: ' + e.message));
      }
    }
    more();
    const ok = await dialog('Мои фото ВКонтакте', 'Отметь картинки - они прикрепятся к посту.', h('div', null, grid), [{ label: 'Отмена', cls: 'ghost', v: false }, { label: 'Добавить', v: true }]);
    if (!ok) return;
    chosen.forEach((x) => onItem({ url: x.url, thumb: x.thumb, kind: 'photo', name: 'photo.jpg', vk: x.vk }));
  }
  // плитки добавления: «С телефона» (выбор файла), «Из ВК», «По ссылке»
  const addTiles = (fileIn, onItem, left, photosOnly) => [
    h('label', { class: 'mi add' }, icon('image'), h('small', null, 'С телефона'), fileIn),
    h('button', { type: 'button', class: 'mi add', onclick: () => pickVkPhotos(onItem, left) }, icon('users'), h('small', null, 'Из ВК')),
    h('button', { type: 'button', class: 'mi add', onclick: () => pickUrl(onItem, photosOnly) }, icon('link'), h('small', null, 'По ссылке'))];

  // ---------- рассылка: игрокам или постами в группы ВК ----------
  let BMODE = 'players';
  function bcastHost() {
    const outer = msgHost();
    const seg = h('div', { class: 'chips' }, [['players', 'Игрокам'], ['wall', 'Посты в группы ВК']].map(([v, l]) => h('button', { class: 'chip' + (v === BMODE ? ' on' : ''), onclick: () => { if (BMODE !== v) { BMODE = v; haptic(); render(); } } }, l)));
    const inner = h('div');
    outer.replaceChildren(seg, inner);
    return inner;
  }
  // свой мост к ВК (как в игре): нужен, чтобы получить ключ одной кнопкой
  function vkSend(method, params) {
    return new Promise((res, rej) => {
      const rid = Date.now() % 1e9;
      const A = window.AndroidBridge, I = window.webkit && window.webkit.messageHandlers;
      const p = Object.assign({}, params || {}, { request_id: rid });
      const done = (d) => {
        if (!d || !d.type || !d.data || d.data.request_id !== rid) return;
        window.removeEventListener('message', onMsg); window.removeEventListener('VKWebAppEvent', onEv);
        if (/Failed$/.test(d.type)) rej(d.data); else res(d.data);
      };
      const onMsg = (e) => { const d = e.data; if (d && typeof d === 'object') done(d.data && d.data.type ? d.data : d); };
      const onEv = (e) => done(e.detail);
      window.addEventListener('message', onMsg); window.addEventListener('VKWebAppEvent', onEv);
      setTimeout(() => { window.removeEventListener('message', onMsg); window.removeEventListener('VKWebAppEvent', onEv); rej(new Error('timeout')); }, 120000);
      try {
        if (A && typeof A[method] === 'function') A[method](JSON.stringify(p));
        else if (I && I[method]) I[method].postMessage(p);
        else if (window.parent !== window) window.parent.postMessage({ handler: method, params: p, type: 'vk-connect' }, '*');
        else rej(new Error('no bridge'));
      } catch (e) { rej(e); }
    });
  }
  const EVERY = [[30, '30 минут'], [60, '1 час'], [120, '2 часа'], [180, '3 часа'], [360, '6 часов'], [720, '12 часов']];
  const PAUSE = { captcha: 'ждёт капчу', limit: 'лимит ВК, продолжит завтра', token: 'ключ ВК не работает - обнови' };
  const VK_APP_ID = 54828995;
  async function renderWall(body, id) {
    body.replaceChildren(skeleton(4));
    let w;
    try { w = await api('adm_wall_get'); } catch (e) { if (!stale(id)) body.replaceChildren(failBox(e)); return; }
    if (stale(id)) return;
    const j = w.job || {};
    const reload = () => render();
    const callFn = fnCall;
    const out = [];

    // ключ
    const tk = w.token || {};
    const tokBox = h('div', { class: 'panel pad' });
    const paste = h('input', { class: 'input mono', placeholder: 'vk1.a....', autocomplete: 'off' });
    const oauth = 'https://oauth.vk.com/authorize?client_id=' + VK_APP_ID + '&display=mobile&redirect_uri=https://oauth.vk.com/blank.html&scope=wall,photos,groups,offline&response_type=token&v=5.199';
    tokBox.append(
      h('div', { class: 'kv' }, h('span', null, 'Твой ключ ВК'), h('b', { style: { color: tk.set ? 'var(--green)' : 'var(--amber)' } }, tk.set ? 'есть' + (tk.until ? ', до ' + dateTime(tk.until) : '') : 'нет')),
      w.creator ? h('div', null,
        vkData ? h('button', { class: 'btn wide', style: { marginTop: '10px' }, onclick: async () => {
          try {
            const r = await vkSend('VKWebAppGetAuthToken', { app_id: VK_APP_ID, scope: 'wall,photos,groups' });
            if (!r || !r.access_token) throw new Error('пусто');
            if (r.scope && !/wall/.test(r.scope)) { toast('ВК не выдал право «стена». Попробуй вторым способом', true); return; }
            if (await act('adm_wall_token', { p_token: r.access_token, p_expires: +r.expires || 0 }, 'Ключ сохранён')) reload();
          } catch (e) { toast('ВК не выдал ключ. Попробуй вторым способом ниже', true); }
        } }, icon('check'), 'Получить ключ одной кнопкой') : null,
        h('details', { class: 'how' }, h('summary', null, vkData ? 'Второй способ: вручную' : 'Как получить ключ'),
          h('ol', { class: 'steps' },
            h('li', null, 'Открой ссылку ниже в браузере, где ты вошёл во ВКонтакте, и нажми «Разрешить».'),
            h('li', null, 'Тебя перекинет на пустую страницу. Скопируй из адресной строки всё между «access_token=» и «&».'),
            h('li', null, 'Вставь сюда и нажми «Сохранить». Ключ уходит прямо в базу, здесь он больше не показывается.')),
          h('div', { class: 'btns', style: { marginTop: 0 } },
            h('button', { class: 'btn ghost sm', onclick: () => openExt(oauth) }, 'Открыть ссылку'),
            h('button', { class: 'btn ghost sm', onclick: () => { try { navigator.clipboard.writeText(oauth); toast('Ссылка скопирована'); } catch (e) { /* ignore */ } } }, 'Скопировать ссылку')),
          h('div', { class: 'inline', style: { marginTop: '10px' } }, paste, h('button', { class: 'btn', onclick: async () => {
            let t = paste.value.trim();
            const m = t.match(/access_token=([^&\s]+)/); if (m) t = m[1];
            const ex = (paste.value.match(/expires_in=(\d+)/) || [])[1];
            if (t.length < 20) { toast('Это не похоже на ключ', true); return; }
            if (await act('adm_wall_token', { p_token: t, p_expires: +ex || 0 }, 'Ключ сохранён')) reload();
          } }, 'Сохранить')))) : h('p', { class: 'hint' }, 'Ключ ВК вставляет создатель.'),
      h('p', { class: 'hint' }, 'Посты идут от твоей страницы. Ключ даёт доступ к стене и фото, хранится только в базе.'));
    out.push(sec('Ключ ВК'), tokBox);

    // состояние цикла
    if (j.captcha_wait && j.captcha_img) {
      const key = h('input', { class: 'input mono', placeholder: 'Буквы с картинки', autocomplete: 'off' });
      out.push(sec('Капча'), h('div', { class: 'panel pad captcha' },
        h('p', { class: 'mut', style: { margin: '0 0 10px' } }, 'ВК просит подтвердить, что ты человек. Введи буквы - цикл продолжится.'),
        h('img', { src: j.captcha_img, alt: 'капча' }),
        h('div', { class: 'inline', style: { marginTop: '10px' } }, key, h('button', { class: 'btn', onclick: async () => {
          if (await act('adm_wall_cmd', { p_cmd: 'captcha', p_key: key.value }, 'Продолжаю')) { callFn({ action: 'wall' }).catch(() => {}); setTimeout(reload, 2500); }
        } }, 'Продолжить'))));
    }
    const state = j.active ? (j.pause ? 'Пауза: ' + (PAUSE[j.pause] || j.pause) : 'Работает') : 'Остановлен';
    out.push(sec('Цикл', state), h('div', { class: 'panel pad' },
      h('div', { class: 'kv' }, h('span', null, 'Постов сегодня'), h('b', { class: 'mono' }, num(w.today) + ' из ' + num(j.per_day))),
      h('div', { class: 'btns' },
        j.active ? h('button', { class: 'btn ghost', onclick: async () => { if (await act('adm_wall_cmd', { p_cmd: 'pause' }, 'Цикл остановлен')) reload(); } }, 'Остановить')
          : h('button', { class: 'btn', onclick: async () => {
            if (!(await confirmBox('Запустить цикл?', 'Раз в минуту - пост в следующую группу. Каждая группа - не чаще, чем раз в ' + (EVERY.find((x) => x[0] === j.every_min) || [0, j.every_min + ' мин'])[1] + '.', 'Запустить'))) return;
            if (await act('adm_wall_cmd', { p_cmd: 'start' }, 'Цикл запущен')) { callFn({ action: 'wall' }).catch(() => {}); setTimeout(reload, 3000); }
          } }, icon('play'), 'Запустить'),
        h('button', { class: 'btn ghost', disabled: !j.active || !!j.pause, onclick: async () => {
          try { const r = await callFn({ action: 'wall' }); toast(r.idle ? 'Сейчас все группы на паузе по промежутку' : r.ok ? 'Опубликовано' : 'Не вышло: ' + (r.err || '')); } catch (e) { toast(errText(e), true); }
          reload();
        } }, 'Следующий пост сейчас'))));

    // группы
    const links = h('textarea', { class: 'input mono', rows: '3', placeholder: 'Ссылки на группы, каждая с новой строки:\nhttps://vk.com/piar_group\nvk.com/club123456' });
    const groups = w.groups || [];
    out.push(sec('Группы', groups.filter((g) => g.enabled).length + ' из ' + groups.length), h('div', { class: 'panel pad' },
      links,
      h('button', { class: 'btn wide', style: { marginTop: '8px' }, onclick: async (e) => {
        const list = links.value.split(/[\s,]+/).filter(Boolean);
        if (!list.length) { toast('Вставь ссылки', true); return; }
        const b = e.currentTarget; b.disabled = true;
        try {
          const r = await callFn({ action: 'wall_resolve', links: list });
          const open = (r.groups || []).filter((g) => g.can_post).length;
          toast('Добавлено: ' + (r.groups || []).length + ', стена открыта у ' + open + ((r.missing || []).length ? '. Не найдены: ' + r.missing.join(', ') : ''));
          links.value = ''; reload();
        } catch (er) { toast(/no token/.test(er.message) ? 'Сначала сохрани ключ ВК' : 'Не получилось: ' + er.message, true); b.disabled = false; }
      } }, icon('plus'), 'Проверить и добавить'),
      groups.length ? h('div', { class: 'list wall-groups' }, groups.map((g) => {
        const sw = h('button', { class: 'sw' + (g.enabled ? ' on' : ''), role: 'switch', 'aria-label': 'Постить в ' + g.name, onclick: async () => {
          if (!g.enabled && g.can_post === false) { toast('Стена закрыта - туда не опубликовать', true); return; }
          if (await act('adm_wall_group', { p_gid: g.gid, p_cmd: g.enabled ? 'off' : 'on' })) reload();
        } });
        return h('div', { class: 'row' }, h('span', { class: 'ava', style: { backgroundImage: g.photo ? 'url("' + g.photo + '")' : '' } }),
          h('span', { class: 'who' },
            h('b', null, h('em', null, g.name || ('club' + g.gid)), g.can_post === false ? h('span', { class: 'tag red' }, 'стена закрыта') : null),
            h('small', { style: { whiteSpace: 'normal' } }, (g.last_at ? 'последний ' + ago(g.last_at) : 'ещё не постили') + ' · сегодня ' + g.day_n,
              g.last_post ? [' · ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); openExt('https://vk.com/wall-' + g.gid + '_' + g.last_post); } }, 'пост')] : null),
            g.err ? h('small', { style: { color: 'var(--red)', whiteSpace: 'normal' } }, g.err) : null),
          sw,
          h('button', { class: 'ib', 'aria-label': 'Убрать группу', onclick: async () => { if (await confirmBox('Убрать «' + g.name + '»?', 'Группа пропадёт из списка.', 'Убрать', true)) { if (await act('adm_wall_group', { p_gid: g.gid, p_cmd: 'remove' })) reload(); } } }, icon('trash')));
      })) : h('p', { class: 'hint' }, 'Групп пока нет.')));

    // пост и настройки цикла
    const m = j.msg || {};
    const text = h('textarea', { class: 'input', rows: '6', maxlength: '4000', placeholder: 'Текст поста. Эмодзи - с клавиатуры телефона.' }); text.value = m.text || '';
    const link = h('input', { class: 'input mono', type: 'url', placeholder: 'https://vk.com/app' + VK_APP_ID + ' (ссылка с превью, необязательно)', value: m.link || '' });
    const media = (m.media || []).slice();
    const mediaBox = h('div', { class: 'media' });
    // поле выбора файла лежит прямо на плитке «Добавить»: нажатие из кода встроенный браузер ВК не пропускает
    const fileIn = h('input', { type: 'file', multiple: true, accept: 'image/*', class: 'file-hit', 'aria-label': 'Добавить фото' });
    const drawMedia = () => mediaBox.replaceChildren(...media.map((x, i) => h('div', { class: 'mi' + (x.busy ? ' busy' : '') }, h('img', { src: x.local || x.thumb || x.url, alt: '' }),
      h('button', { type: 'button', class: 'mi-x', 'aria-label': 'Убрать', onclick: () => { media.splice(i, 1); drawMedia(); } }, icon('x')))),
      ...(media.length < 10 ? addTiles(fileIn, (it) => { if (media.length < 10) { media.push(it); drawMedia(); } }, 10 - media.length, true) : []));
    fileIn.addEventListener('change', async () => {
      if (fileIn.files.length) toast('Загружаю: ' + fileIn.files.length);
      for (const f of [...fileIn.files]) {
        if (media.length >= 10) break;
        const it = { name: f.name, kind: 'photo', local: URL.createObjectURL(f), busy: true }; media.push(it); drawMedia();
        try {
          const fd = new FormData(); fd.append('init_data', initData); fd.append('file', f);
          const r = await (await fetch(FN, { method: 'POST', body: fd })).json();
          if (!r.url) throw new Error(r.error || 'не загрузилось');
          Object.assign(it, { url: r.url, busy: false });
        } catch (e) { media.splice(media.indexOf(it), 1); toast('Фото не загрузилось', true); }
        drawMedia();
      }
      fileIn.value = '';
    });
    drawMedia();
    let every = j.every_min || 180;
    const everySel = h('select', { class: 'input', onchange: () => { every = +everySel.value; repl.classList.toggle('on', every < 60 || replOn); replRow.style.opacity = every < 60 ? .5 : 1; } },
      EVERY.map(([v, l]) => h('option', { value: String(v), selected: v === every }, 'каждые ' + l)));
    const perG = h('input', { class: 'input mono', type: 'number', min: '1', max: '24', value: String(j.per_group || 12) });
    const perD = h('input', { class: 'input mono', type: 'number', min: '1', max: '100', value: String(j.per_day || 60) });
    let replOn = j.replace_prev !== false;
    const repl = h('button', { class: 'sw' + (replOn || every < 60 ? ' on' : ''), role: 'switch', 'aria-label': 'Удалять прошлый пост', onclick: () => { if (every < 60) { toast('При 30 минутах прошлый пост удаляется всегда', true); return; } replOn = !replOn; repl.classList.toggle('on', replOn); } });
    const replRow = h('div', { class: 'tog', style: { opacity: every < 60 ? .5 : 1 } }, h('div', { class: 't' }, h('b', null, 'Удалять прошлый пост'), h('small', null, 'В группе висит одна свежая запись, а не стопка копий')), repl);
    out.push(sec('Пост'), h('div', { class: 'panel pad' },
      field('Текст', text), field('Ссылка', link),
      group('Фото', mediaBox),
      h('p', { class: 'hint', style: { marginTop: '-4px' } }, 'На стенах ВК нет жирного и курсива - только текст, эмодзи, фото и ссылки.'),
      group('Как часто в каждую группу', everySel),
      h('div', { class: 'g2' }, field('Постов в группу за сутки', perG), field('Всего за сутки', perD)),
      replRow,
      h('button', { class: 'btn wide', style: { marginTop: '12px' }, onclick: async () => {
        if (media.some((x) => x.busy)) { toast('Дождись загрузки фото', true); return; }
        if (!text.value.trim() && !media.length) { toast('Напиши текст поста', true); return; }
        const ok = await act('adm_wall_save', { p: { msg: { text: text.value.trim(), link: link.value.trim(), media: media.map((x) => Object.assign({ url: x.url, kind: 'photo', name: x.name }, x.vk ? { vk: x.vk, thumb: x.thumb } : {})) },
          every_min: every, per_group: Math.max(1, Math.min(24, Math.floor(+perG.value || 12))), per_day: Math.max(1, Math.min(100, Math.floor(+perD.value || 60))), replace_prev: replOn } }, 'Пост и настройки сохранены');
        if (ok) reload();
      } }, icon('check'), 'Сохранить'),
      h('p', { class: 'hint' }, 'Новый текст подхватится со следующего поста, цикл перезапускать не нужно.')));

    // журнал
    const log = w.log || [];
    out.push(sec('Журнал'), log.length ? h('div', { class: 'panel' }, log.map((l) => h('div', { class: 'log' },
      h('div', null, h('b', { style: { color: l.ok ? 'var(--green)' : 'var(--red)' } }, l.ok ? 'опубликовано' : 'не вышло'), ' · ', l.name || ('club' + l.gid),
        l.ok && l.post_id ? [' · ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); openExt('https://vk.com/wall-' + l.gid + '_' + l.post_id); } }, 'открыть')] : null),
      l.err ? h('div', { class: 'd' }, l.err) : null,
      h('div', { class: 'meta' }, dateTime(l.at))))) : h('div', { class: 'panel empty' }, 'Пока пусто'));
    body.replaceChildren(...out);
  }

  async function renderBcast(id) {
    const body = bcastHost();
    if (BMODE === 'wall') return renderWall(body, id);
    const st = { ch: { tg: true, vk: true, vkn: false }, media: [], buttons: [{ t: 'play', label: 'Играть' }], opts: { nodup: true }, when: 'now', counts: null };
    const title = h('input', { class: 'input', maxlength: '80', placeholder: 'Например: выходные x2 (видит только команда)' });
    const rich = richEditor(() => upd());
    const counter = h('span', { class: 'meta' });
    const prev = h('div', { class: 'bc-prev' });
    const keys = h('div');

    // каналы
    const chBox = h('div', { class: 'checks' });
    const drawCh = () => chBox.replaceChildren(...Object.keys(CH).map((k) => h('button', { type: 'button', class: 'check' + (st.ch[k] ? ' on' : ''), onclick: () => { st.ch[k] = !st.ch[k]; drawCh(); aud.count(); upd(); } },
      h('span', { class: 'box' }, st.ch[k] ? icon('check') : null), h('span', null, CH[k], st.counts ? h('b', { class: 'ch-n' }, ' ' + num(st.counts[k] || 0)) : null))));
    const chans = () => Object.keys(st.ch).filter((k) => st.ch[k]);
    const aud = audienceBox({ counter: async (a) => {
      try {
        const r = await api('adm_bcast_count', { p: { aud: a, ch: chans(), nodup: !!st.opts.nodup } });
        st.counts = r; drawCh(); drawKeys(r);
        const n = chans().reduce((x, k) => x + (r[k] || 0), 0);
        aud.setText(num(n) + ' ' + word(n, 'сообщение', 'сообщения', 'сообщений') + ' из ' + num(r.players) + ' ' + word(r.players, 'игрока', 'игроков', 'игроков'));
        return n;
      } catch (e) { aud.setText(errText(e)); return 0; }
    } });
    function drawKeys(r) {
      const miss = [];
      if (st.ch.tg && !r.tg_token) miss.push('нет ключа бота Telegram');
      if (st.ch.vk && !r.vk_token) miss.push('нет ключа сообщества ВК');
      if (st.ch.vkn && !r.vk_service) miss.push('нет сервисного ключа приложения ВК');
      keys.replaceChildren(miss.length ? h('div', { class: 'warn' }, icon('alert'), h('div', null, h('b', null, miss.join(', ')),
        st.ch.vk && !r.vk_token ? h('p', null, 'ВКонтакте → сообщество → Управление → Работа с API → Ключи доступа → Создать ключ: отметь «Сообщения сообщества», «Фотографии», «Документы». Затем в Supabase → SQL Editor выполни:') : null,
        st.ch.vk && !r.vk_token ? h('code', { class: 'sql' }, "insert into public.private_secrets values ('vk_group_token', 'КЛЮЧ') on conflict (k) do update set v = excluded.v;") : null,
        st.ch.vk && !r.vk_token ? h('p', null, 'И включи: Управление → Сообщения → «Сообщения сообщества» и «Возможности ботов».') : null)) : null);
    }

    // вложения
    const mediaBox = h('div', { class: 'media' });
    const fileIn = h('input', { type: 'file', multiple: true, class: 'file-hit', 'aria-label': 'Добавить вложение' });
    fileIn.addEventListener('change', async () => {
      const files = [...fileIn.files]; fileIn.value = '';
      if (files.length) toast('Загружаю: ' + files.length);
      for (const f of files) {
        if (st.media.length >= 10) { toast('Не больше 10 вложений', true); break; }
        if (f.size > 50 * 1024 * 1024) { toast(f.name + ': больше 50 МБ', true); continue; }
        const item = { name: f.name, kind: /^image\/gif/.test(f.type) ? 'animation' : /^image\//.test(f.type) ? 'photo' : /^video\//.test(f.type) ? 'video' : 'document', local: URL.createObjectURL(f), busy: true };
        st.media.push(item); drawMedia();
        try {
          const fd = new FormData(); fd.append('init_data', initData); fd.append('file', f);
          const r = await (await fetch(FN, { method: 'POST', body: fd })).json();
          if (!r.url) throw new Error(r.error || 'не загрузилось');
          Object.assign(item, { url: r.url, kind: r.kind, busy: false });
        } catch (e) { st.media.splice(st.media.indexOf(item), 1); toast('Файл не загрузился: ' + String(e.message || e).slice(0, 80), true); }
        drawMedia(); upd();
      }
    });
    function drawMedia() {
      mediaBox.replaceChildren(...st.media.map((m, i) => h('div', { class: 'mi' + (m.busy ? ' busy' : '') },
        m.kind === 'photo' || m.kind === 'animation' ? h('img', { src: m.local || m.thumb || m.url, alt: '' }) : h('span', { class: 'mi-ic' }, icon(m.kind === 'video' ? 'play' : 'file'), h('small', null, m.name || '')),
        h('button', { type: 'button', class: 'mi-x', 'aria-label': 'Убрать', onclick: () => { st.media.splice(i, 1); drawMedia(); upd(); } }, icon('x')))),
        ...(st.media.length < 10 ? addTiles(fileIn, (it) => { if (st.media.length < 10) { st.media.push(it); drawMedia(); upd(); } }, 10 - st.media.length, false) : []));
    }

    // кнопки под сообщением
    const btnBox = h('div', { class: 'btn-list' });
    function drawBtns() {
      btnBox.replaceChildren(...st.buttons.map((b, i) => {
        const typeSel = h('select', { class: 'input', onchange: () => { const old = BTN_T[b.t]; b.t = typeSel.value; if (!b.label || b.label === old) b.label = BTN_T[b.t] === 'Ссылка' ? '' : BTN_T[b.t]; drawBtns(); upd(); } },
          Object.keys(BTN_T).map((k) => h('option', { value: k, selected: k === b.t }, BTN_T[k])));
        const lab = h('input', { class: 'input', maxlength: '40', placeholder: 'Надпись на кнопке', value: b.label || '' });
        lab.addEventListener('input', () => { b.label = lab.value; upd(); });
        const url = h('input', { class: 'input mono', type: 'url', placeholder: 'https://...', value: b.url || '', style: { display: b.t === 'url' ? '' : 'none' } });
        url.addEventListener('input', () => { b.url = url.value.trim(); upd(); });
        const rowSw = h('button', { type: 'button', class: 'mini' + (b.row ? ' on' : ''), disabled: i === 0, onclick: () => { b.row = !b.row; drawBtns(); upd(); } }, 'В ряд с предыдущей');
        return h('div', { class: 'bt' },
          h('div', { class: 'g2' }, typeSel, lab), url,
          h('div', { class: 'bt-act' }, rowSw,
            h('button', { type: 'button', class: 'ib', 'aria-label': 'Выше', disabled: i === 0, onclick: () => { st.buttons.splice(i - 1, 0, st.buttons.splice(i, 1)[0]); drawBtns(); upd(); } }, icon('up')),
            h('button', { type: 'button', class: 'ib', 'aria-label': 'Ниже', disabled: i === st.buttons.length - 1, onclick: () => { st.buttons.splice(i + 1, 0, st.buttons.splice(i, 1)[0]); drawBtns(); upd(); } }, icon('down')),
            h('button', { type: 'button', class: 'ib', 'aria-label': 'Удалить кнопку', onclick: () => { st.buttons.splice(i, 1); drawBtns(); upd(); } }, icon('trash'))));
      }), st.buttons.length < 10 ? h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { st.buttons.push({ t: 'url', label: '', url: '' }); drawBtns(); } }, icon('plus'), 'Добавить кнопку') : null);
    }

    // настройки
    const OPT = [
      ['spoiler', 'Картинки под спойлером', 'Telegram: размыты, пока не нажмёшь'],
      ['above', 'Подпись над картинкой', 'Telegram'],
      ['silent', 'Без звука', 'Telegram: придёт тихо'],
      ['protect', 'Запретить пересылку и сохранение', 'Telegram'],
      ['nopreview', 'Без превью ссылок', 'Telegram и ВК'],
      ['nodup', 'Не дублировать', 'Если у игрока есть и Telegram, и ВК - только в Telegram']];
    const optBox = h('div', null, OPT.map(([k, l, hint]) => {
      const sw = h('button', { type: 'button', class: 'sw' + (st.opts[k] ? ' on' : ''), role: 'switch', 'aria-label': l, onclick: () => { st.opts[k] = !st.opts[k]; sw.classList.toggle('on', st.opts[k]); if (k === 'nodup') aud.count(); upd(); } });
      return h('div', { class: 'tog' }, h('div', { class: 't' }, h('b', null, l), h('small', null, hint)), sw);
    }));
    const whenIn = h('input', { class: 'input mono', type: 'datetime-local', style: { display: 'none', marginTop: '8px' } });
    const whenSeg = h('div', { class: 'seg' }, [['now', 'Сразу'], ['later', 'По времени']].map(([v, l]) => h('button', { type: 'button', class: v === st.when ? 'on' : '', onclick: (e) => {
      st.when = v; whenSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); whenIn.style.display = v === 'later' ? '' : 'none';
      if (v === 'later' && !whenIn.value) { const d = new Date(Date.now() + 3600000); d.setMinutes(0, 0, 0); whenIn.value = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
    } }, l)));

    // предпросмотр: как увидят в Telegram и во ВК
    function upd() {
      const m = rich.get();
      const lim = st.media.length ? 1024 : 4096;
      const over = m.html.length > lim;
      counter.textContent = num(m.text.length) + ' / ' + num(lim) + (st.media.length ? ' (подпись к картинке)' : '') + (st.ch.vkn ? ' · уведомление ВК: первые 254' : '');
      counter.classList.toggle('bad', over || (st.ch.vkn && m.text.length > 254));
      const mediaPrev = st.media.filter((x) => x.kind === 'photo' || x.kind === 'animation').slice(0, 4).map((x) => h('img', { src: x.local || x.url, alt: '', class: st.opts.spoiler ? 'blur' : '' }));
      const files = st.media.filter((x) => x.kind === 'document' || x.kind === 'video').map((x) => h('div', { class: 'pf' }, icon(x.kind === 'video' ? 'play' : 'file'), x.name || 'файл'));
      const tgText = h('div', { class: 'pt' }); tgText.innerHTML = (m.html || '<span class="dim">Текст сообщения</span>').replace(/<tg-spoiler>/g, '<span class="sp">').replace(/<\/tg-spoiler>/g, '</span>').replace(/\n/g, '<br>');
      const rows = []; st.buttons.filter((b) => b.label).forEach((b) => { if (b.row && rows.length) rows[rows.length - 1].push(b); else rows.push([b]); });
      const kb = rows.map((r) => h('div', { class: 'pk' }, r.map((b) => h('span', null, b.label))));
      const vkText = h('div', { class: 'pt' }, ...vkRender(m));
      prev.replaceChildren(...[
        st.ch.tg ? h('div', { class: 'pv tg' }, h('small', null, 'Telegram'), h('div', { class: 'bub' }, st.opts.above ? tgText : null, mediaPrev.length ? h('div', { class: 'pm n' + mediaPrev.length }, mediaPrev) : null, files, st.opts.above ? null : tgText), kb) : null,
        st.ch.vk ? h('div', { class: 'pv vk' }, h('small', null, 'ВКонтакте'), h('div', { class: 'bub' }, vkText, mediaPrev.length ? h('div', { class: 'pm n' + mediaPrev.length }, mediaPrev.map((x) => x.cloneNode())) : null, files.map((x) => x.cloneNode(true)), kb.map((x) => x.cloneNode(true)))) : null,
        st.ch.vkn ? h('div', { class: 'pv vk' }, h('small', null, 'Уведомление ВК'), h('div', { class: 'bub note' }, (m.text || 'Текст').replace(/\s+/g, ' ').slice(0, 254))) : null].filter(Boolean));
    }
    function vkRender(m) {
      if (!m.text) return [h('span', { class: 'dim' }, 'Текст сообщения')];
      const out = [];
      const marks = Array.from({ length: m.text.length }, () => []);
      m.vkfmt.forEach((f) => { for (let i = f.offset; i < f.offset + f.length && i < marks.length; i++) marks[i].push(f.type); });
      let i = 0;
      while (i < m.text.length) {
        const key = marks[i].join(','); let j = i;
        while (j < m.text.length && marks[j].join(',') === key) j++;
        const seg = m.text.slice(i, j);
        const parts = seg.split('\n'); const frag = [];
        parts.forEach((p, k) => { if (k) frag.push(h('br')); frag.push(p); });
        out.push(h('span', { class: marks[i].map((t) => 'f-' + t).join(' ') }, frag));
        i = j;
      }
      return out;
    }

    async function send(self) {
      const m = rich.get();
      const ch = chans();
      if (!ch.length) { toast('Выбери, куда отправить', true); return; }
      if (!m.text.trim() && !st.media.length) { toast('Напиши текст или добавь картинку', true); return; }
      if (st.media.some((x) => x.busy)) { toast('Дождись загрузки файлов', true); return; }
      if (m.html.length > (st.media.length ? 1024 : 4096)) { toast('Текст длинный для Telegram: сократи', true); return; }
      const bad = st.buttons.find((b) => b.label && b.t === 'url' && !/^https?:\/\/\S+\.\S+/.test(b.url || ''));
      if (bad) { toast('У кнопки «' + bad.label + '» нет ссылки', true); return; }
      const albumMix = st.media.length > 1 && st.media.some((x) => x.kind === 'document') && st.media.some((x) => x.kind !== 'document');
      if (albumMix && st.ch.tg) { toast('Telegram не смешивает файлы с фото в одном сообщении: оставь что-то одно', true); return; }
      const sendAt = st.when === 'later' && whenIn.value ? new Date(whenIn.value).toISOString() : null;
      const a = self ? { kind: 'self' } : aud.get();
      if (!self) {
        const n = await aud.count();
        if (!n) { toast('Под условия никто не подходит', true); return; }
        if (!(await confirmBox((sendAt ? 'Запланировать' : 'Отправить') + ' ' + num(n) + ' ' + word(n, 'сообщение', 'сообщения', 'сообщений') + '?',
          ch.map((k) => CH[k] + ': ' + num(st.counts ? st.counts[k] : 0)).join('\n') + (sendAt ? '\nОтправка ' + dateTime(sendAt) : '\nТелеграм уходит ~25 сообщений в секунду.'), sendAt ? 'Запланировать' : 'Отправить'))) return;
      }
      const msg = { text: m.text, html: m.html, vkfmt: m.vkfmt, media: st.media.map((x) => Object.assign({ url: x.url, kind: x.kind, name: x.name }, x.vk ? { vk: x.vk, thumb: x.thumb } : {})),
        buttons: st.buttons.filter((b) => b.label).map((b) => ({ t: b.t, label: b.label, url: b.url || '', row: !!b.row })), opts: st.opts };
      const r = await act('adm_bcast_send', { p: { title: title.value.trim() || (self ? 'Проверка' : m.text.slice(0, 40)), ch, aud: a, msg, send_at: self ? null : sendAt, nodup: !!st.opts.nodup } });
      if (!r) return;
      if (!r.total) { toast(self ? 'Тебе некуда отправить: привяжи Telegram или включи сообщения сообщества ВК' : 'Получателей нет', true); return; }
      toast(r.status === 'scheduled' ? 'Рассылка запланирована' : self ? 'Отправлено тебе, проверь сообщения' : 'Рассылка пошла: ' + num(r.total));
      if (r.status === 'sending') kick();
      loadList();
    }

    const list = h('div', null, skeleton(2));
    async function loadList() {
      let rows;
      try { rows = await api('adm_bcast_list'); } catch (e) { list.replaceChildren(failBox(e)); return; }
      if (!rows.length) { list.replaceChildren(h('div', { class: 'panel empty' }, 'Рассылок ещё не было')); return; }
      list.replaceChildren(h('div', { class: 'panel' }, rows.map((b) => {
        const done = b.sent + b.failed + b.blocked;
        const live = b.status === 'sending' || b.status === 'scheduled';
        return h('div', { class: 'item' },
          h('span', { class: 'ic' + (live ? ' acc' : '') }, icon(b.status === 'scheduled' ? 'clock' : 'send')),
          h('div', { class: 't' },
            h('b', null, b.title || 'Без названия', ' ', h('span', { class: 'tag' + (live ? ' acc' : b.status === 'canceled' ? ' red' : '') }, BC_ST[b.status] || b.status)),
            h('div', { class: 'meta' }, (b.ch || []).map((k) => CH[k]).join(', ') + ' · ' + (b.status === 'scheduled' ? 'на ' + dateTime(b.send_at) : dateTime(b.at)) + ' · ' + b.who),
            b.total ? h('div', { class: 'track bc-track' }, h('div', { class: 'fill', style: { width: (100 * done / b.total) + '%' } })) : null,
            h('div', { class: 'meta' }, h('b', null, num(b.sent)), ' дошло из ' + num(b.total),
              b.blocked ? [' · ', h('b', null, num(b.blocked)), ' закрыли сообщения'] : null, b.failed ? [' · ', h('b', { style: { color: 'var(--red)' } }, num(b.failed)), ' ошибок'] : null),
            b.errors && b.errors.length ? h('details', { class: 'errs' }, h('summary', null, 'Причины ошибок'), h('pre', null, b.errors.join('\n'))) : null,
            h('div', { class: 'row-act' },
              live && can('mail_all') ? h('button', { class: 'btn danger sm', onclick: async () => { if (await confirmBox('Остановить рассылку?', 'Кому уже ушло - останется.', 'Остановить', true)) { if (await act('adm_bcast_cancel', { p_id: b.id }, 'Рассылка остановлена')) loadList(); } } }, 'Остановить') : null,
              b.status === 'sending' ? h('button', { class: 'btn ghost sm', onclick: () => { kick(); toast('Подталкиваю отправку'); setTimeout(loadList, 4000); } }, 'Ускорить') : null,
              h('button', { class: 'btn ghost sm', onclick: () => { bcDraft = b; render(); window.scrollTo(0, 0); } }, 'Повторить'))));
      })));
    }

    if (bcDraft) {
      const d = bcDraft; bcDraft = null;
      title.value = d.title || '';
      st.ch = { tg: d.ch.includes('tg'), vk: d.ch.includes('vk'), vkn: d.ch.includes('vkn') };
      st.media = (d.msg.media || []).map((x) => Object.assign({}, x));
      st.buttons = (d.msg.buttons || []).map((x) => Object.assign({}, x));
      st.opts = Object.assign({ nodup: true }, d.msg.opts || {});
      setTimeout(() => rich.set(d.msg.html || escHtml(d.msg.text || '')), 0);
    }
    drawCh(); drawMedia(); drawBtns(); upd();
    body.replaceChildren(
      sec('Новая рассылка', 'Telegram и ВКонтакте'),
      h('div', { class: 'panel pad' },
        group('Куда', chBox), keys,
        group('Кому', aud.el),
        field('Название', title),
        h('div', { class: 'field' }, h('span', null, 'Сообщение'), rich.el, h('div', { class: 'ed-foot' }, counter)),
        h('div', { class: 'field' }, h('span', null, 'Вложения'), mediaBox, h('p', { class: 'hint' }, 'Фото, видео, гиф или файл. До 10 штук, каждое до 50 МБ. Несколько фото и видео в Telegram придут альбомом, кнопки - следом. Во ВК видео уходит файлом.')),
        h('div', { class: 'field' }, h('span', null, 'Кнопки под сообщением'), btnBox),
        h('div', { class: 'field' }, h('span', null, 'Настройки'), optBox),
        group('Когда', h('div', null, whenSeg, whenIn)),
        h('div', { class: 'field' }, h('span', null, 'Как увидят'), prev),
        h('div', { class: 'btns' },
          h('button', { class: 'btn ghost', onclick: () => send(true) }, 'Отправить себе'),
          h('button', { class: 'btn', disabled: !can('mail_all'), onclick: () => send(false) }, icon('send'), 'Отправить'))),
      sec('Рассылки'), list);
    if (!stale(id)) loadList();
  }

  // ---------- топы ----------
  let TOPB = 'week';
  async function renderTops(id) {
    const BOARDS = [['week', 'Неделя'], ['day', 'Сутки'], ['month', 'Месяц'], ['rich', 'Богачи']];
    const seg = h('div', { class: 'chips' }, BOARDS.map(([v, l]) => h('button', { class: 'chip' + (v === TOPB ? ' on' : ''), onclick: () => { TOPB = v; haptic(); render(); } }, l)));
    body.replaceChildren(modeSeg(), seg, h('div', { style: { height: '10px' } }), skeleton(5));
    let r;
    try { r = await api('adm_top', { p_board: TOPB }); } catch (e) { if (!stale(id)) body.replaceChildren(modeSeg(), seg, failBox(e)); return; }
    if (stale(id)) return;
    const hide = async (p) => { if (await confirmBox('Убрать ' + (p.name || 'игрока') + ' из топов?', 'Его очки перестанут показываться, пока не вернёшь.', 'Убрать', true)) { if (await act('adm_set_player', { p_id: p.id, f: { top_ban: true } }, 'Убран из топов')) render(); } };
    const back = async (p) => { if (await act('adm_set_player', { p_id: p.id, f: { top_ban: false } }, 'Снова в топах')) render(); };
    body.replaceChildren(modeSeg(), seg,
      sec('Сейчас в топе', String((r.rows || []).length)),
      (r.rows || []).length ? h('div', { class: 'panel list' }, r.rows.map((p) => h('div', { class: 'row' },
        h('b', { class: 'place mono' }, String(p.place)), ava(p.photo, false),
        h('button', { class: 'who', style: { textAlign: 'left' }, onclick: () => openPlayer(p.id) }, h('b', null, h('em', null, p.name || 'ID ' + p.id)), h('small', null, num(p.score))),
        can('ban') ? h('button', { class: 'btn ghost sm', onclick: () => hide(p) }, 'Убрать') : null))) : h('div', { class: 'panel empty' }, 'Пока пусто'),
      sec('Убраны из топов', String((r.hidden || []).length)),
      (r.hidden || []).length ? h('div', { class: 'panel list' }, r.hidden.map((p) => h('div', { class: 'row' }, ava(p.photo, false),
        h('button', { class: 'who', style: { textAlign: 'left' }, onclick: () => openPlayer(p.id) }, h('b', null, h('em', null, p.name || 'ID ' + p.id), p.top_hold ? h('span', { class: 'tag red' }, 'проверка') : null),
          h('small', { style: { whiteSpace: 'normal' } }, (p.reason || 'убран командой') + ' · сварено ' + num(p.le))),
        can('ban') ? h('button', { class: 'btn sm', onclick: () => back(p) }, 'Вернуть') : null))) : h('div', { class: 'panel empty' }, 'Никого'));
  }

  // ---------- история событий ----------
  const HKINDS = [['', 'Все'], ['ban', 'Баны и топы'], ['gift', 'Письма и подарки'], ['edit', 'Правки'], ['settings', 'Настройки'], ['team', 'Команда']];
  const HST = { q: '', kind: '' };
  async function renderHistory(id) {
    const list = h('div', null, skeleton(6));
    const q = h('input', { type: 'search', placeholder: 'Игрок, действие или ID', value: HST.q, enterkeyhint: 'search' });
    let t = 0;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { HST.q = q.value; load(true); }, 350); });
    const chips = h('div', { class: 'chips' }, HKINDS.map(([v, l]) => h('button', { class: 'chip' + (HST.kind === v ? ' on' : ''), onclick: (e) => {
      HST.kind = v; chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === e.currentTarget)); haptic(); load(true);
    } }, l)));
    body.replaceChildren(h('div', { style: { height: '12px' } }), h('label', { class: 'search' }, icon('search'), q), chips, h('div', { style: { height: '10px' } }), list);
    let rows = [];
    async function load(reset) {
      if (reset) { rows = []; list.replaceChildren(skeleton(6)); }
      let r;
      try { r = await api('adm_history', { p: { q: HST.q, kind: HST.kind, before: rows.length ? rows[rows.length - 1].id : null, limit: 50 } }); }
      catch (e) { list.replaceChildren(failBox(e)); return; }
      if (stale(id)) return;
      rows = rows.concat(r || []);
      if (!rows.length) { list.replaceChildren(h('div', { class: 'panel empty' }, 'Ничего не нашлось')); return; }
      list.replaceChildren(h('div', { class: 'panel' }, rows.map((l) => h('div', { class: 'log' },
        h('div', null, h('b', null, actionName(l.action)), l.target ? [' · ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); openPlayer(l.target); } }, l.name || 'ID ' + l.target)] : null),
        detailText(l) ? h('div', { class: 'd' }, detailText(l)) : null,
        h('div', { class: 'meta' }, dateTime(l.at) + ' · ' + (l.admin_name || 'ID ' + l.admin))))),
        (r || []).length === 50 ? h('button', { class: 'btn ghost wide', style: { marginTop: '8px' }, onclick: (e) => { e.currentTarget.disabled = true; load(false); } }, 'Показать ещё') : null);
    }
    await load(true);
  }

  // ---------- промокоды (вкладка «Игра») ----------
  function promoBlock() {
    const box = h('div', null, skeleton(2));
    const code = h('input', { class: 'input mono', maxlength: '24', placeholder: 'BULK2026', style: { textTransform: 'uppercase' } });
    const gen = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code.value = 'BULK' + Array.from({ length: 5 }, () => a[Math.floor(Math.random() * a.length)]).join(''); };
    const cr = h('input', { class: 'input mono', type: 'number', inputmode: 'numeric', min: '0', placeholder: '0' });
    const hrs = h('input', { class: 'input mono', type: 'number', inputmode: 'decimal', min: '0', placeholder: '0' });
    const max = h('input', { class: 'input mono', type: 'number', inputmode: 'numeric', min: '0', placeholder: 'без лимита' });
    const until = h('input', { class: 'input mono', type: 'date' });
    const note = h('input', { class: 'input', maxlength: '300', placeholder: 'Текст письма с подарком (необязательно)' });
    async function load() {
      let rows;
      try { rows = await api('adm_promo_list'); } catch (e) { box.replaceChildren(h('p', { class: 'hint' }, errText(e))); return; }
      box.replaceChildren(rows.length ? h('div', { class: 'list promo-list' }, rows.map((p) => {
        const off = !p.active || (p.until && Date.parse(p.until) < Date.now()) || (p.max_uses && p.uses >= p.max_uses);
        const sw = h('button', { class: 'sw' + (p.active ? ' on' : ''), role: 'switch', 'aria-label': 'Действует', onclick: async () => { if (await act('adm_promo_save', { p: { code: p.code, active: !p.active } }, p.active ? 'Промокод выключен' : 'Промокод включён')) load(); } });
        return h('div', { class: 'row' + (off ? ' off' : '') }, h('span', { class: 'who' },
          h('b', null, h('em', { class: 'mono' }, p.code), h('button', { class: 'tag', onclick: () => { try { navigator.clipboard.writeText(p.code); toast('Скопировано'); } catch (e) { /* ignore */ } } }, 'копировать')),
          h('small', { style: { whiteSpace: 'normal' } }, giftText(p.gift).replace(/^ · /, '') + ' · активаций ' + num(p.uses) + (p.max_uses ? ' из ' + num(p.max_uses) : '') + (p.until ? ' · до ' + date(p.until) : ''))), sw);
      })) : h('div', { class: 'empty' }, 'Промокодов пока нет'));
    }
    load();
    return [sec('Промокоды'), h('div', { class: 'panel pad' },
      h('div', { class: 'inline' }, code, h('button', { class: 'btn ghost', onclick: gen }, 'Придумать')),
      h('div', { class: 'g2', style: { marginTop: '12px' } }, field('Кристаллы', cr), field('Часы дохода', hrs)),
      h('div', { class: 'g2' }, field('Сколько раз можно ввести', max), field('Действует до', until)),
      field('Письмо', note),
      h('button', { class: 'btn wide', onclick: async () => {
        if (!code.value.trim()) { toast('Придумай код', true); return; }
        if (!(+cr.value > 0) && !(+hrs.value > 0)) { toast('Укажи подарок', true); return; }
        const ok = await act('adm_promo_save', { p: { code: code.value.trim(), gift: { cr: +cr.value || 0, ess_h: +hrs.value || 0 }, max_uses: Math.floor(+max.value || 0), until: until.value ? new Date(until.value + 'T23:59:59').toISOString() : '', note: note.value.trim() } }, 'Промокод сохранён');
        if (ok) { code.value = ''; cr.value = ''; hrs.value = ''; max.value = ''; until.value = ''; note.value = ''; load(); }
      } }, icon('tag'), 'Сохранить промокод'),
      h('p', { class: 'hint' }, 'Игрок вводит код в настройках игры, подарок приходит письмом в почту. Один игрок - одна активация.'),
      h('div', { style: { marginTop: '12px' } }, box))];
  }

  // ---------- что требует внимания (вверху обзора) ----------
  function attnBox(id) {
    const box = h('div');
    const soft = (p) => p.catch(() => null);
    Promise.all([can('mail') ? soft(api('adm_support_list', { p_status: 'open' })) : null, can('ban') ? soft(api('adm_reports')) : null,
      can('ban') ? soft(api('adm_sus')) : null, soft(api('adm_health')), can('mail') ? soft(api('adm_bcast_list')) : null]).then(([sup, rep, sus, hl, bc]) => {
      if (stale(id)) return;
      const go = (t, mode) => () => { haptic(); if (t === 'players') PMODE = mode; if (t === 'msgs') MMODE = mode; const b = document.querySelector('.nav button[data-t="' + t + '"]'); if (b) b.click(); };
      const items = [];
      const n1 = sup && sup.counts ? sup.counts.open || 0 : 0;
      if (n1) items.push([n1, word(n1, 'обращение ждёт ответа', 'обращения ждут ответа', 'обращений ждут ответа'), go('msgs', 'support')]);
      if (rep && rep.length) items.push([rep.length, word(rep.length, 'жалоба в чате', 'жалобы в чате', 'жалоб в чате'), go('players', 'reports')]);
      if (sus && sus.length) items.push([sus.length, word(sus.length, 'игрок на проверке', 'игрока на проверке', 'игроков на проверке'), go('players', 'sus')]);
      if (hl && hl.boot_fresh_old) items.push([hl.boot_fresh_old, 'старт с нуля у старых игроков за неделю', () => { const el = document.getElementById('health'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }]);
      const live = (bc || []).filter((b) => b.status === 'sending' || b.status === 'scheduled').length;
      if (live) items.push([live, word(live, 'рассылка идёт или ждёт', 'рассылки идут или ждут', 'рассылок идут или ждут'), go('msgs', 'bcast')]);
      box.replaceChildren(items.length ? h('div', { class: 'panel attn' }, items.map(([n, t, fn]) => h('button', { class: 'row', onclick: fn },
        h('b', { class: 'attn-n mono' }, num(n)), h('span', { class: 'who' }, h('b', null, t)), icon('chev')))) : h('div', { class: 'panel attn calm' }, icon('check'), 'Всё спокойно: новых обращений, жалоб и сбоев нет'));
    });
    return box;
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
    ME = { id: me.id, role: me.role, perms: me.perms || [], name: tokenMode() ? me.name : '', tg: me.tg, vk: me.vk, photo: me.photo };
    shell();
    render();
  }
  boot();
})();

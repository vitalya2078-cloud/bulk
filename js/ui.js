// Интерфейс: экраны, карточки, окна, подсказки.
const UI = (() => {
  const $ = (id) => document.getElementById(id);
  const D = DATA, C = CONFIG;
  const S = () => Econ.s;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hooks = { save: null, reset: null };

  // ---------- создание элементов ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    kids.flat(Infinity).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return el;
  }
  // Картинка из assets/images. Пустой alt: рядом всегда есть подпись текстом.
  const pic = (name, cls) => {
    const im = h('img', { class: 'pic' + (cls ? ' ' + cls : ''), src: IMG(name), alt: '', draggable: 'false', decoding: 'async' });
    // повторная попытка, если картинка не загрузилась
    let tries = 0;
    im.addEventListener('error', () => { if (tries++ < 3) setTimeout(() => { im.src = IMG(name) + '?r=' + tries; }, 800 * tries); });
    return im;
  };

  // Сумма с иконкой валюты: [иконка] 1,5 тыс
  function money(text, img) {
    const v = h('span', { class: 'v' }, text === undefined ? '' : text);
    const el = h('span', { class: 'money' }, pic(img || 'ui/essence', 'money-ico'), v);
    el.v = v;
    return el;
  }

  function setText(el, v) { v = String(v); if (el._t !== v) { el.textContent = v; el._t = v; } }
  const save = () => { if (hooks.save) hooks.save(); };
  const ess = (n) => Fmt.num(n);

  // ---------- сообщения ----------
  let toastT = 0;
  // сообщения спускаются сверху свитком; несколько подряд - по очереди
  const toastQ = [];
  let toastBusy = false;
  function toast(msg) {
    const el = $('toast');
    if (toastQ.length && toastQ[toastQ.length - 1] === msg) return;
    if (!toastQ.length && el && el.classList.contains('show') && el.textContent === msg) { clearTimeout(toastT); toastT = setTimeout(hideToast, 2000); return; }
    toastQ.push(msg);
    if (toastQ.length > 2) toastQ.splice(0, toastQ.length - 2);
    if (!toastBusy) nextToast();
  }
  // убрать сообщение сразу (без анимации) и забыть очередь - когда открывается окно
  function dropToast() {
    const el = $('toast');
    toastQ.length = 0;
    clearTimeout(toastT);
    toastBusy = false;
    if (!el) return;
    el.style.transition = 'none';
    el.classList.remove('show');
    void el.offsetWidth;
    el.style.transition = '';
  }
  function nextToast() {
    const el = $('toast');
    const msg = toastQ.shift();
    if (msg === undefined) { toastBusy = false; return; }
    toastBusy = true;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(hideToast, 2600);
  }
  function hideToast() {
    const el = $('toast');
    clearTimeout(toastT);
    el.classList.remove('show');
    toastT = setTimeout(nextToast, 380);
  }
  setTimeout(() => {
    const el = document.getElementById('toast');
    if (!el) return;
    let y0 = null;
    el.addEventListener('pointerdown', (e) => { y0 = e.clientY; });
    el.addEventListener('pointerup', (e) => { if (el.classList.contains('show') && (y0 === null || e.clientY - y0 < 10)) hideToast(); y0 = null; });
  }, 0);

  let sayT = 0, lastSay = 0;
  function say(text, ms) {
    if (screen !== 'main' || current) return;
    const sp = $('speech');
    const a = Cauldron.anchor();
    sp.textContent = text;
    sp.style.left = a.x + 'px';
    sp.style.top = a.y + 'px';
    sp.classList.add('show');
    lastSay = Date.now();
    clearTimeout(sayT);
    sayT = setTimeout(() => sp.classList.remove('show'), ms || 2800);
  }
  const sinceSay = () => Date.now() - lastSay;

  // ---------- окна (по одному, очередью) ----------
  const queue = [];
  let current = null;

  // ---------- облачко реплики ----------
  // Рисуем облачко под точный размер текста: края и уголки не тянутся (без швов на телефоне),
  // хвостик снизу по центру не обрезается. Сам текст остаётся обычным текстом.
  const BUB = { sl: 60, sr: 60, st: 50, sb: 48, dl: 22, dr: 22, dt: 18, db: 18, tail: 13, tw: 26 };
  function paintBubble(el) {
    const bw = Math.round(el.clientWidth), bh = Math.round(el.clientHeight);
    if (!bw || !bh || typeof Sprites === 'undefined') return;
    const body = Sprites.get('hud/say_body'), tail = Sprites.get('hud/say_tail');
    if (!body || !tail) { if (!el._bubWait) { el._bubWait = true; const again = () => setTimeout(() => { el._bubWait = false; paintBubble(el); }, 0); if (!body) Sprites.get('hud/say_body', again); else Sprites.get('hud/say_tail', again); } return; }
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const key = bw + 'x' + bh + '@' + dpr;
    if (el._bubKey === key) return;
    el._bubKey = key;
    const W = Math.round(bw * dpr), H = Math.round(bh * dpr);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const B = BUB, iw = body.naturalWidth, ih = body.naturalHeight;
    const bodyH = H - Math.round(B.tail * dpr);
    const L = Math.round(B.dl * dpr), R = Math.round(B.dr * dpr), T = Math.round(B.dt * dpr), Bo = Math.round(B.db * dpr);
    const sx = [0, B.sl, iw - B.sr, iw], sy = [0, B.st, ih - B.sb, ih];
    const dx = [0, L, W - R, W], dy = [0, T, bodyH - Bo, bodyH];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const sw = sx[i + 1] - sx[i], sh = sy[j + 1] - sy[j], dw = dx[i + 1] - dx[i], dh = dy[j + 1] - dy[j];
      if (sw > 0 && sh > 0 && dw > 0 && dh > 0) x.drawImage(body, sx[i], sy[j], sw, sh, dx[i], dy[j], dw + (i < 2 ? 1 : 0), dh + (j < 2 ? 1 : 0));
    }
    const tw = Math.round(B.tw * dpr), th = Math.round(tw * tail.naturalHeight / tail.naturalWidth);
    x.drawImage(tail, Math.round(W / 2 - tw / 2), H - th, tw, th);
    el.style.background = 'url(' + cv.toDataURL() + ') 0 0 / 100% 100% no-repeat';
  }
  const bubRO = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((es) => es.forEach((e) => paintBubble(e.target))) : null;
  function bubble(el) { if (!el || el._bub) return; el._bub = true; el.classList.add('bub'); if (bubRO) bubRO.observe(el); requestAnimationFrame(() => paintBubble(el)); }
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.matches && n.matches('.dlg-say, .speech')) bubble(n);
      if (n.querySelectorAll) n.querySelectorAll('.dlg-say, .speech').forEach(bubble);
    }))).observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('.dlg-say, .speech').forEach(bubble));
  setTimeout(() => document.querySelectorAll('.dlg-say, .speech').forEach(bubble), 0);

  // заголовок окна: буквы идут по дуге ленты (SVG textPath).
  // Не влезает в одну строку - две строки по двум дугам, шрифт поменьше.
  const SVGNS = 'http://www.w3.org/2000/svg';
  let ribbonN = 0;
  const ARCS = { one: 'M 66 62 Q 243.5 28 421 62', up: 'M 70 47 Q 243.5 15 417 47', down: 'M 70 77 Q 243.5 45 417 77' };
  function ribbonTitle(text) {
    const id = 'rbn' + (++ribbonN);
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 487 142');
    svg.setAttribute('aria-hidden', 'true');
    svg.dataset.id = id;
    svg.dataset.text = text;
    svg.innerHTML = '<defs>' + Object.keys(ARCS).map((k) => '<path id="' + id + k + '" d="' + ARCS[k] + '"/>').join('')
      + '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6C8"/><stop offset=".55" stop-color="#FFD860"/><stop offset="1" stop-color="#F0A02E"/></linearGradient></defs>';
    return h('h2', { class: 'm-title', 'aria-label': text }, svg);
  }
  function arcText(svg, line, arc, fs) {
    const id = svg.dataset.id;
    ['rt-shadow', 'rt-main'].forEach((cls) => {
      const t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('class', cls);
      t.setAttribute('font-size', fs);
      if (cls === 'rt-main') t.setAttribute('fill', 'url(#' + id + 'g)');
      const tp = document.createElementNS(SVGNS, 'textPath');
      tp.setAttribute('href', '#' + id + arc);
      tp.setAttribute('startOffset', '50%');
      tp.textContent = line;
      t.append(tp);
      svg.append(t);
    });
  }
  function fitTitle(box) {
    const svg = box.querySelector('.m-title svg');
    if (!svg) return;
    const text = svg.dataset.text;
    // ширину меряем обычной строкой: по дуге браузер обрезает лишнее и не скажет, что не влезло
    const probe = document.createElementNS(SVGNS, 'text');
    probe.setAttribute('class', 'rt-probe');
    svg.append(probe);
    const width = (s, fs) => { probe.textContent = s; probe.setAttribute('font-size', fs); try { return probe.getComputedTextLength() || s.length * fs * 0.58; } catch (e) { return s.length * fs * 0.58; } };
    const MAX = 290;
    let fs = 44;
    const w1 = width(text, fs);
    // одна строка, если влезает шрифтом не мельче 32
    if (w1 * 32 / 44 <= MAX || text.indexOf(' ') < 0) {
      probe.remove();
      arcText(svg, text, 'one', w1 > MAX ? Math.max(20, Math.floor(fs * MAX / w1)) : fs);
      return;
    }
    // две строки: делим по пробелу ближе к середине
    const words = text.split(' ');
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      const m = Math.max(width(a, 30), width(b, 30));
      if (!best || m < best.m) best = { a, b, m };
    }
    fs = Math.min(30, Math.floor(30 * (MAX - 10) / best.m));
    probe.remove();
    arcText(svg, best.a, 'up', Math.max(16, fs));
    arcText(svg, best.b, 'down', Math.max(16, fs));
  }
  // полос прокрутки нет: вместо них мягкое затухание у края, если дальше есть ещё
  function fades(el) {
    if (!el || !el.classList) return;
    if (el.classList.contains('seg')) {
      // ряд вкладок: затухание слева/справа, если есть ещё вкладки
      const l = el.scrollLeft > 4, r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      el.style.setProperty('--fl', l ? '48px' : '0px');
      el.style.setProperty('--fr', r ? '64px' : '0px');
      el.classList.add('fade-x');
      return;
    }
    const top = el.scrollTop > 4, bot = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    el.style.setProperty('--ft', top ? '22px' : '0px');
    el.style.setProperty('--fb', bot ? '26px' : '0px');
    el.classList.add('fade-edges');
  }
  document.addEventListener('scroll', (e) => fades(e.target), true);
  window.addEventListener('resize', () => document.querySelectorAll('.fade-edges').forEach(fades));

  function modal(opts) { queue.push(opts); if (!current) nextModal(); }

  function nextModal() {
    const o = queue.shift();
    if (!o) { current = null; if (document.body.classList.contains('has-modal')) { const t = $('toast'); if (t) { t.style.transition = 'none'; requestAnimationFrame(() => { t.style.transition = ''; }); } } document.body.classList.remove('has-modal'); return; }
    current = o;
    const body = typeof o.body === 'function' ? o.body() : o.body;
    const box = h('div', { class: 'modal' + (o.sheet ? ' sheet' : '') + (o.cls ? ' ' + o.cls : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title },
      o.closable === false ? null : h('button', { class: 'x', type: 'button', 'aria-label': 'Закрыть', onclick: closeModal }, '✕'),
      o.title ? ribbonTitle(o.title) : null,
      h('div', { class: 'modal-body' }, body),
      o.actions ? h('div', { class: 'actions' }, o.actions.map((a) => {
        const b = h('button', { class: 'btn' + (a.alt ? ' alt' : ''), type: 'button', disabled: a.disabled }, a.label);
        b.addEventListener('click', async () => {
          Sound.tap();
          b.disabled = true;
          const r = a.onClick ? await a.onClick() : undefined;
          if (r === false) { b.disabled = false; return; }
          closeModal();
        });
        return b;
      })) : null
    );
    const wrap = h('div', { class: 'modal-wrap' + (o.sheet ? ' bottom' : '') }, box);
    wrap.addEventListener('click', (e) => { if (e.target === wrap && o.closable !== false) closeModal(); });
    // старое сообщение не переезжает вниз в новое окно
    if (!document.body.classList.contains('has-modal')) dropToast();
    $('modal-root').append(wrap);
    document.body.classList.add('has-modal');
    fitTitle(box);
    const mb = box.querySelector(':scope > .modal-body');
    if (mb && mb.firstElementChild) liftTop(mb.firstElementChild);
    if (o.onOpen) o.onOpen(box);
    requestAnimationFrame(() => box.querySelectorAll('.modal-body, .scroll, .brew, .event, .seg').forEach(fades));
  }

  function closeModal() {
    $('modal-root').innerHTML = '';
    const o = current;
    current = null;
    if (o && o.onClose) o.onClose();
    refresh(true);
    nextModal();
  }
  const isModalOpen = () => !!current;
  const modalClosable = () => !!current && current.closable !== false;

  // ---------- экраны ----------
  // Активен ровно один экран. Скрытые не рисуются и не обновляются.
  let screen = 'main';
  let refs = [];
  let key = '';

  const SCREENS = {
    main:    { label: 'Котёл',   img: 'ui/cauldron' },
    shop:    { label: 'Лавка',   img: 'cards/window' },
    wardrobe: { label: 'Гардероб', img: 'ui/wardrobe' },
    tasks:   { label: 'Задания', img: 'ui/checklist' },
    friends: { label: 'Сообщество', img: 'ui/envelope' }
  };
  const badges = {};

  function buildTabs() {
    const nav = $('tabs');
    nav.innerHTML = '';
    Object.keys(SCREENS).forEach((id) => {
      const t = SCREENS[id];
      const bd = h('span', { class: 'badge', hidden: true });
      badges[id] = bd;
      nav.append(h('button', { class: 'tab', type: 'button', role: 'tab', 'data-go': id, onclick: () => { Sound.tap(); show(id); } },
        h('span', { class: 'ti', 'aria-hidden': 'true' }, pic(t.img)), h('span', null, t.label), bd));
    });
  }

  function show(id) {
    screen = id;
    document.body.dataset.screen = id; // плашки эффектов - только на главном экране
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.dataset.screen === id));
    document.querySelectorAll('.tab').forEach((b) => {
      const on = b.dataset.go === id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('speech').classList.remove('show');
    if (id === 'main') Cauldron.resize();
    rebuild(true);
  }

  function rebuild(resetScroll) {
    refs = [];
    const view = VIEWS[screen];
    if (!view) { key = ''; return; }
    const box = $(screen + '-body');
    if (!box) { key = ''; return; }
    const sc = box.scrollTop;
    keepSeg(box, () => {
      box.innerHTML = '';
      view.render(box);
    });
    key = view.key();
    box.scrollTop = resetScroll ? 0 : sc;
    refs.forEach((f) => f());
    requestAnimationFrame(() => { box.querySelectorAll('.seg').forEach(fades); fades(box); });
  }

  // Полоски разделов (.seg) после перерисовки остаются на месте,
  // а выбранный раздел, если он спрятан за краем, плавно докручивается в видимую часть.
  // шапка окна-шторки (.sheet-top) не прокручивается: переносим её из тела окна в отдельный слот над ним
  function liftTop(box) {
    const top = box && [...box.children].find((c) => c.classList.contains('sheet-top'));
    const modalEl = box && box.closest('.modal');
    if (!top || !modalEl) return;
    let head = modalEl.querySelector(':scope > .sheet-head');
    if (!head) { head = h('div', { class: 'sheet-head' }); modalEl.insertBefore(head, modalEl.querySelector(':scope > .modal-body')); }
    head.replaceChildren(top);
  }
  function keepSeg(box, fn) {
    const root = box.closest('.modal') || box;
    const before = [...root.querySelectorAll('.seg')].map((el) => el.scrollLeft);
    fn();
    liftTop(box);
    requestAnimationFrame(() => root.querySelectorAll('.seg').forEach(fades));
    root.querySelectorAll('.seg').forEach((el, i) => {
      const had = before[i] !== undefined;
      if (had) el.scrollLeft = before[i];
      const on = el.querySelector('.seg-btn.on');
      if (!on) return;
      const a = el.getBoundingClientRect(), b = on.getBoundingClientRect();
      let d = 0;
      if (b.left < a.left + 8) d = b.left - a.left - 24;
      else if (b.right > a.right - 8) d = b.right - a.right + 24;
      if (d) el.scrollTo({ left: el.scrollLeft + d, behavior: had ? 'smooth' : 'auto' });
    });
  }

  // ---------- обновление верхней панели и текущего экрана ----------
  function refresh(force) {
    const s = S();
    const rp = Econ.rankProgress();
    const rImg = IMG(D.ranks[rp.r].img);
    if ($('rank-icon').getAttribute('src') !== rImg) $('rank-icon').setAttribute('src', rImg);
    setText($('rank-name'), D.ranks[rp.r].name);
    $('rank-fill').style.width = (rp.frac * 100) + '%';
    setText($('balance'), ess(s.e));
    setText($('st-tap'), '+' + ess(Econ.tapValue()));
    setText($('st-hour'), '+' + ess(Econ.perHour()));
    setText($('st-hour-mini'), '+' + ess(Econ.perHour()));
    const mul = Econ.incomeMul();
    $('st-mul').hidden = !(mul > 1.001);
    setText($('st-mul'), '×' + mulText(mul));
    // длинная сумма не должна залезать под боковые кнопки
    const bl = $('balance'), len = (bl.textContent || '').length;
    bl.parentNode.classList.toggle('long', len > 7);
    bl.parentNode.classList.toggle('xlong', len > 10);
    setText($('st-cap'), Econ.pantryHours() + ' ч');
    setText($('crystals'), s.cr);
    setText($('lvl-chip'), s.lvl);
    $('lvl-chip').classList.toggle('pts', Econ.skillPoints() > 0);
    const av = avatarSrc();
    if ($('avatar-img').getAttribute('src') !== av) $('avatar-img').setAttribute('src', av);

    const view = VIEWS[screen];
    if (view) {
      if (force || view.key() !== key) rebuild(false);
      else refs.forEach((f) => f());
    }
    updateDailyRow();
    updateBadges();
    updateEffects();
    Events.refreshButton();
  }

  function setBadge(id, v) {
    const b = badges[id];
    if (!b) return;
    b.hidden = !v;
    if (v) setText(b, v);
  }

  function updateBadges() {
    const s = S();
    let affordable = 0;
    D.cards.forEach((c) => { if (!Econ.cardLock(c) && Econ.level(c.id) < C.cardMaxLevel && Econ.cardCost(c, Econ.level(c.id)) <= s.e) affordable++; });
    setBadge('shop', affordable);
    const daily = Econ.dailyState().available ? 1 : 0;
    setBadge('tasks', Econ.claimableQuests() + daily + Story.readyList().length + Requests.readyCount());
    setBadge('main', screen !== 'main' && Visitors.active() ? '!' : 0);
  }

  // ×1,5 / ×2 / ×12
  const mulText = (m) => (Math.round(m * 10) / 10).toString().replace('.', ',');
  // короткое время для плашки: «1:59» до часа, дальше «2 ч»
  const shortLeft = (sec) => (sec < 0 ? '∞' : sec >= 3600 ? Math.floor(sec / 3600) + ' ч' : Fmt.clock(sec));
  // всё, что сейчас действует: эффекты, выпитые зелья, бонус лавки, бонус ковена
  function activeFx() {
    const out = [];
    Econ.activeEffects().forEach((e) => out.push({ key: 'e' + e.key, img: e.def.img, label: e.def.income ? 'Доход ×' + e.def.income : 'Тап ×' + e.def.tap,
      name: e.def.name, desc: e.def.income ? 'Доход в час ×' + e.def.income : 'Сила тапа ×' + e.def.tap, left: e.left }));
    if (typeof Brew !== 'undefined') Brew.chips().forEach((p) => out.push({ key: 'p' + p.key, img: p.img, label: p.label, name: p.name, desc: p.desc, left: p.left }));
    const g = Econ.globalMul();
    if (g > 1) {
      const b = (typeof Online !== 'undefined' && Online.boost) ? Online.boost() : null;
      out.push({ key: 'g', img: 'ui/sparkle', label: 'Лавка ×' + mulText(g), name: 'Бонус лавки' + (b && b.label ? ': ' + b.label : ''), desc: 'Весь доход ×' + mulText(g) + ' для всех игроков',
        left: b && b.until ? (Date.parse(b.until) - Date.now()) / 1000 : -1 });
    }
    const cm = Econ.covenMul();
    if (cm > 1.001) out.push({ key: 'c', img: 'ui/coven', label: 'Ковен +' + Math.round((cm - 1) * 100) + '%', name: 'Бонус ковена', desc: 'Доход +' + Math.round((cm - 1) * 100) + '% за уровень ковена', left: -1 });
    return out;
  }
  function fxInfo() {
    const list = activeFx();
    if (!list.length) return;
    modal({ title: 'Что сейчас действует', body: h('div', null,
      list.map((x) => h('div', { class: 'income-row' }, pic(x.img), h('span', null, h('b', null, x.name), h('small', null, x.desc)), h('b', null, x.left < 0 ? 'пока действует' : Fmt.clock(x.left)))),
      Econ.incomeMul() > 1.001 ? h('p', { class: 'small center' }, 'Вместе доход в час ×' + mulText(Econ.incomeMul()) + '.') : null),
      actions: [{ label: 'Понятно', alt: true }] });
  }
  let fxKey = '';
  const FX_MAX = 3;
  function updateEffects() {
    const list = activeFx();
    const k = list.map((x) => x.key + shortLeft(x.left)).join('|');
    if (k === fxKey) return;
    fxKey = k;
    const box = $('effects');
    const shown = list.length > FX_MAX + 1 ? list.slice(0, FX_MAX) : list;
    box.replaceChildren(...shown.map((x) => h('button', { class: 'chip', type: 'button', title: x.name, onclick: () => { Sound.tap(); fxInfo(); } },
      pic(x.img, 'chip-ico'), h('b', null, x.label), h('span', null, shortLeft(x.left)))),
    list.length > shown.length ? h('button', { class: 'chip more', type: 'button', onclick: () => { Sound.tap(); fxInfo(); } }, h('b', null, '+' + (list.length - shown.length))) : '');
  }

  function updateDailyRow() {
    const r = Econ.recipeState();
    const left = Econ.recipeAttempts() - r.tries.length;
    $('dot-gift').hidden = !Econ.dailyState().available;
    $('dot-recipe').hidden = r.solved || left <= 0;
    $('dot-rune').hidden = Econ.runeState().done;
    setText($('sub-recipe'), r.solved ? 'Разгадан' : left > 0 ? 'Попыток: ' + left : 'Завтра новый');
    setText($('sub-rune'), Econ.runeState().done ? 'Начерчена' : 'Начерти');
    setText($('sub-gift'), Econ.dailyState().available ? 'Забери' : 'Завтра');
  }

  // ---------- общие кусочки ----------
  const card = (img, title, desc, extra, button, cls) =>
    h('div', { class: 'row-card' + (cls ? ' ' + cls : '') },
      h('div', { class: 'ico', 'aria-hidden': 'true' }, pic(img)),
      h('div', { class: 'info' }, h('div', { class: 'name' }, title), desc ? h('div', { class: 'desc' }, desc) : null, extra),
      button);

  // ---------- карточка лавки: окно подробностей ----------
  function cardSheet(c) {
    const L = Econ.level(c.id);
    const lock = Econ.cardLock(c);
    const max = L >= C.cardMaxLevel;
    const cost = Econ.cardCost(c, L);
    const gain = Econ.cardNextGain(c);
    const payback = gain > 0 ? cost / gain : 0;
    modal({
      sheet: true,
      title: c.name,
      body: h('div', { class: 'sheet-body' },
        h('div', { class: 'sheet-ico', 'aria-hidden': 'true' }, pic(c.img)),
        h('p', null, c.desc),
        h('div', { class: 'facts' },
          h('div', null, h('small', null, 'Уровень'), h('b', null, max ? L + ' (макс.)' : L + ' → ' + (L + 1))),
          h('div', null, h('small', null, 'Сейчас в час'), h('b', null, ess(Econ.cardIncome(c, L)))),
          max ? null : h('div', null, h('small', null, 'Прибавка'), h('b', { class: 'gain' }, '+' + ess(gain) + ' в час'))),
        lock ? h('p', { class: 'warn' }, Econ.lockText(lock)) : null,
        !lock && !max ? h('p', { class: 'small' }, 'Окупится примерно за ' + Fmt.time(payback * 3600)) : null),
      actions: lock || max ? [{ label: 'Понятно', alt: true }] : [{
        label: ['Улучшить за ', money(ess(cost))],
        disabled: S().e < cost,
        onClick: () => {
          if (!Econ.buyCard(c.id)) { Sound.deny(); toast('Не хватает эссенции'); return; }
          Sound.buy();
          toast(c.name + ': уровень ' + Econ.level(c.id));
          save();
        }
      }]
    });
  }

  // ---------- реклама ----------
  let adBusy = false;
  async function watchWind() {
    if (adBusy) return;
    adBusy = true; refresh();
    const ok = await Platform.rewardedAd();
    adBusy = false;
    if (!ok) { toast('Реклама сейчас недоступна, попробуй позже'); refresh(); return; }
    if (Platform.kind() === 'web') toast('Тестовая реклама: в ВК здесь будет настоящая');
    Econ.addWind();
    Sound.coin();
    save(); refresh();
  }

  // ---------- экраны со списками ----------
  const VIEWS = {
    shop: {
      key: () => {
        const s = S();
        return s.cat + '|' + D.cards.filter((c) => c.cat === s.cat).map((c) => Econ.level(c.id) + (Econ.cardLock(c) ? 'L' : '')).join(',') + '|' + s.scoop + s.pantry;
      },
      render(box) {
        const s = S();
        if (Platform.adsAvailable()) {
          const meta = h('div', { class: 'meta' });
          const btn = h('button', { class: 'pill-btn ad', type: 'button', onclick: watchWind }, '▶ Смотреть');
          box.append(h('div', { class: 'banner' },
            h('div', { class: 'ico', 'aria-hidden': 'true' }, pic('ui/wind')),
            h('div', { class: 'info' }, h('div', { class: 'name' }, 'Попутный ветер'), h('div', { class: 'desc' }, '×2 к доходу на ' + C.windMinutes + ' минут'), meta),
            btn));
          refs.push(() => {
            const left = Econ.effectLeft('wind');
            setText(meta, left > 0 ? 'Запас: ' + Fmt.time(left) : '');
            btn.disabled = adBusy || !Econ.canWind();
          });
        }

        const cats = D.categories.concat([{ id: 'tools', name: 'Инструменты' }]);
        box.append(h('div', { class: 'seg', role: 'tablist' }, cats.map((c) => h('button', {
          type: 'button', class: 'seg-btn' + (s.cat === c.id ? ' on' : ''), role: 'tab', 'aria-selected': s.cat === c.id ? 'true' : 'false',
          onclick: () => { s.cat = c.id; Sound.tap(); rebuild(true); }
        }, c.name))));

        if (s.cat === 'tools') { renderTools(box); return; }

        const grid = h('div', { class: 'grid' });
        D.cards.filter((c) => c.cat === s.cat).forEach((c) => {
          const lock = Econ.cardLock(c);
          const L = Econ.level(c.id);
          const priceM = money();
          const price = h('span', { class: 'price' }, priceM);
          const gain = h('span', { class: 'gain' });
          const el = h('button', { class: 'tile' + (lock ? ' locked' : ''), type: 'button', onclick: () => { Sound.tap(); cardSheet(c); } },
            h('div', { class: 'tile-top' }, h('span', { class: 'tile-ico', 'aria-hidden': 'true' }, pic(lock ? 'ui/padlock' : c.img)), L ? h('span', { class: 'lvl' }, h('small', null, 'ур.'), String(L)) : null),
            h('div', { class: 'tile-name' }, c.name),
            lock ? h('div', { class: 'tile-lock' }, Econ.lockText(lock)) : [h('div', { class: 'tile-meta' }, 'в час ', gain), price]);
          grid.append(el);
          if (!lock) {
            refs.push(() => {
              const LL = Econ.level(c.id);
              if (LL >= C.cardMaxLevel) { setText(price, 'Максимум'); setText(gain, ''); el.classList.remove('cant'); return; }
              const cost = Econ.cardCost(c, LL);
              setText(gain, '+' + ess(Econ.cardNextGain(c)));
              setText(priceM.v, ess(cost));
              el.classList.toggle('cant', s.e < cost);
            });
          }
        });
        box.append(grid);
      }
    },

    tasks: {
      key: () => {
        const s = S();
        return s.jtab + '|' + (s.q ? s.q.d + s.q.l.map((q) => q.c).join('') : '') + '|' + s.daily.l + '|' + s.served + '|' + JSON.stringify(s.story) + Story.readyList().join(',')
          + '|' + Requests.list().map((r) => r.id + (Requests.ready(r) ? 1 : 0)).join(',');
      },
      render(box) {
        const s = S();
        // журнал: вкладки
        const dayN = Econ.claimableQuests() + (Econ.dailyState().available ? 1 : 0);
        const tabs = [['req', 'Просьбы', Requests.readyCount() + Story.readyList().length], ['day', 'На сегодня', dayN], ['people', 'Жители', 0]];
        if (!tabs.some((t) => t[0] === s.jtab)) s.jtab = 'req';
        box.append(h('div', { class: 'seg', role: 'tablist' }, tabs.map(([id, l, n]) => h('button', {
          type: 'button', class: 'seg-btn' + (s.jtab === id ? ' on' : ''), role: 'tab',
          onclick: () => { s.jtab = id; Sound.tap(); rebuild(true); }
        }, l, n ? h('span', { class: 'seg-badge' }, n) : null))));
        if (s.jtab === 'req') {
          Requests.block(box);
          Story.tasksBlock(box);
          return;
        }
        if (s.jtab === 'people') { peopleBlock(box); return; }
        // подарок дня
        const st = Econ.dailyState();
        box.append(h('h3', { class: 'section-title' }, 'Подарок дня'));
        const strip = h('div', { class: 'days' });
        D.daily.forEach((d, i) => {
          let cls = '';
          if (i < st.idx || (i === st.idx && !st.available)) cls = 'done';
          else if (i === st.idx) cls = 'today';
          strip.append(h('div', { class: 'day ' + cls }, h('div', { class: 'dn' }, 'День ' + (i + 1)), h('div', { class: 'dr' }, money(ess(Econ.dailyAmount(i))))));
        });
        box.append(strip);
        box.append(h('button', { class: 'btn', type: 'button', disabled: !st.available, onclick: claimDaily },
          st.available ? 'Забрать подарок' : 'Следующий подарок завтра'));

        // задания
        box.append(h('h3', { class: 'section-title' }, 'Задания на сегодня'));
        (s.q ? s.q.l : []).forEach((q, i) => {
          const t = Econ.questTemplate(q.t);
          if (!t) return;
          const fill = h('i');
          const rewardM = money();
          const reward = h('div', { class: 'meta reward' }, 'Награда: ', rewardM);
          let btn;
          if (q.c === 1) {
            btn = h('button', { class: 'pill-btn', type: 'button', onclick: () => {
              const v = Econ.claimQuest(i);
              if (v) { Sound.coin(); toast('+' + ess(v) + ' эссенции и +' + C.crystals.quest + ' ' + crystalsWord(C.crystals.quest)); save(); refresh(true); }
            } }, 'Забрать');
          } else {
            btn = h('span', { class: 'quest-state' });
          }
          box.append(card(t.img, t.text(q.n), null, [h('div', { class: 'bar' }, fill), reward], btn, q.c === 2 ? 'done' : ''));
          refs.push(() => {
            fill.style.width = (100 * q.p / q.n) + '%';
            setText(rewardM.v, ess(Econ.questReward(q)));
            if (q.c === 2) { if (!btn.querySelector('.ok-ico')) btn.replaceChildren(pic('hud/check', 'ok-ico')); } else if (q.c !== 1) setText(btn, Fmt.num(q.p) + '/' + Fmt.num(q.n));
          });
        });
        const timer = h('p', { class: 'note' });
        refs.push(() => setText(timer, 'Новые задания через ' + Fmt.time(Econ.secToMidnight())));
        box.append(timer);
      }
    },

    friends: {
      key: () => 'f' + (Econ.canInvite() ? 1 : 0),
      render(box) {
        // официальные места игры
        const L = C.links || {};
        const linkRow = (img, title, sub, url) => url ? h('button', { class: 'soc-row', type: 'button', onclick: () => { Sound.tap(); if (!Platform.openUrl(url)) toast('Не получилось открыть ссылку'); } },
          pic(img, 'soc-ico'), h('span', null, h('small', null, sub), h('b', null, title)), h('i', null, 'Открыть')) : null;
        const comm = h('div', { class: 'panel' },
          h('h3', { class: 'mini-title' }, 'Мы на связи'),
          h('div', { class: 'soc-block' },
            linkRow('ui/chat', 'Сообщество ВКонтакте', 'Новости, конкурсы, идеи', L.vk),
            linkRow('ui/scroll', 'Канал в Telegram', 'Новости игры', L.tgChannel),
            linkRow('ui/phone', 'Бульк в Telegram', 'Играй и там - прогресс общий', L.tg)));
        box.append(comm);

        // приглашение друзей
        const panel = h('div', { class: 'panel' });
        panel.append(h('div', { class: 'hero' },
          h('div', { class: 'hero-ico', 'aria-hidden': 'true' }, pic('ui/envelope')),
          h('h2', null, 'Позови друзей в лавку'),
          h('p', null, 'Друг, который придёт по твоему приглашению, получит ' + ess(C.welcomeBonus) + ' эссенции на старт.')));
        panel.append(h('button', { class: 'btn', type: 'button', onclick: doInvite }, 'Пригласить друга'));
        const hint = h('p', { class: 'note center' });
        panel.append(hint);
        refs.push(() => setText(hint, Econ.canInvite()
          ? 'За приглашение сегодня получишь ' + ess(Econ.hoursOfIncome(C.inviteRewardHours, 2000)) + ' эссенции.'
          : 'Награду за приглашение сегодня уже получил. Звать друзей всё равно можно!'));
        box.append(panel);

        const p2 = h('div', { class: 'panel' });
        p2.append(h('div', { class: 'mastery' }, pic('ui/trophy', 'mastery-ico'),
          h('div', null, h('small', null, 'Твоё мастерство'), h('b', null, Fmt.num(Econ.mastery())))));
        p2.append(h('p', { class: 'note center' }, 'Растёт вместе с эссенцией и уровнями карточек.'));
        p2.append(h('button', { class: 'btn', type: 'button', onclick: () => { Sound.tap(); Tops.open(1); } }, 'Топ алхимиков'));
        if (Platform.hasLeaderboard()) {
          p2.append(h('button', { class: 'btn alt', type: 'button', onclick: async () => {
            if (!(await Platform.leaderboard(Econ.mastery()))) toast('Рейтинг сейчас недоступен');
          } }, 'Рейтинг друзей'));
        }
        p2.append(h('button', { class: 'btn alt', type: 'button', onclick: async () => {
          const r = await Platform.share('Я держу волшебную лавку в игре «Бульк»! Мастерство: ' + Econ.mastery() + '. Заглянешь?');
          if (r === 'copied') toast('Текст скопирован');
          else if (r === 'fail') toast('Не получилось поделиться');
        } }, 'Рассказать о лавке'));
        box.append(p2);

        // об игре
        const about = h('div', { class: 'panel' },
          h('h3', { class: 'mini-title' }, 'Об игре'),
          h('p', { class: 'slogan' }, C.slogan || ''),
          h('p', { class: 'note center' }, '«Бульк» - уютная лавка зелий: котёл с характером, жители со своими историями, питомцы, ковены и тайные рецепты. Один мир во ВКонтакте и в Telegram.'),
          h('div', { class: 'soc-block' },
            h('button', { class: 'soc-row', type: 'button', onclick: () => { Sound.tap(); if (typeof Changelog !== 'undefined') Changelog.open(); } },
              pic('ui/sparkle', 'soc-ico'), h('span', null, h('small', null, 'Версия ' + C.version), h('b', null, 'Что нового')), h('i', null, 'Смотреть')),
            linkRow('ui/scroll', 'Пользовательское соглашение', 'Правила игры', new URL('terms.html', location.href).href),
            linkRow('ui/padlock', 'Политика конфиденциальности', 'Какие данные мы храним', new URL('privacy.html', location.href).href)));
        box.append(about);

        // команда - из базы, только имена и роли
        if (typeof Online !== 'undefined' && Online.on()) {
          const list = h('div', { class: 'team-list' }, h('p', { class: 'note center' }, 'Загружаю...'));
          box.append(h('div', { class: 'panel' }, h('h3', { class: 'mini-title' }, 'Команда лавки'), list));
          const ROLE = { creator: 'Создатель', admin: 'Администратор', moderator: 'Модератор', support: 'Поддержка' };
          Online.team().then((t) => {
            if (!t || !t.length) { list.replaceChildren(h('p', { class: 'note center' }, 'Команду покажем, когда будет связь.')); return; }
            list.replaceChildren(...t.map((m) => h('div', { class: 'team-row' },
              /^https:/.test(m.photo || '') ? h('img', { class: 'pic team-ava', src: m.photo, alt: '', referrerpolicy: 'no-referrer' }) : (m.photo ? pic('avatars/' + m.photo, 'team-ava') : pic('ui/hooded', 'team-ava')),
              h('span', null, h('b', null, m.name), h('small', null, ROLE[m.role] || 'Команда')))));
          });
        }
      }
    }
  };

  function renderTools(box) {
    const s = S();
    const sc = D.scoop;
    const scM = money();
    const scPrice = h('span', { class: 'price' }, scM);
    const scBtn = h('button', { class: 'pill-btn', type: 'button', onclick: () => {
      if (Econ.buyScoop()) { Sound.buy(); toast('Черпак: уровень ' + s.scoop); save(); refresh(true); } else Sound.deny();
    } }, scPrice);
    const scMeta = h('div', { class: 'meta' });
    box.append(card(sc.img, sc.name, sc.desc + '. Сейчас тап даёт ' + ess(Econ.tapValue()) + ' (с бонусом ранга).', scMeta, scBtn));
    refs.push(() => {
      const max = s.scoop >= sc.max;
      setText(scMeta, 'Уровень ' + s.scoop + (max ? ' (макс.)' : ''));
      if (max) setText(scPrice, 'Макс.'); else setText(scM.v, ess(Econ.scoopCost()));
      scBtn.disabled = max || s.e < Econ.scoopCost();
    });

    const pa = D.pantry;
    const next = Econ.pantryNext();
    const paBtn = h('button', { class: 'pill-btn', type: 'button', disabled: !next, onclick: () => {
      if (Econ.buyPantry()) { Sound.buy(); toast('Кладовая: ' + Econ.pantryHours() + ' ч'); save(); refresh(true); } else Sound.deny();
    } }, next ? money(ess(next.cost)) : 'Макс.');
    box.append(card(pa.img, pa.name, 'Пока тебя нет, доход копится ' + Econ.pantryHours() + ' ч.' + (next ? ' Улучши до ' + next.hours + ' ч.' : ''), null, paBtn));
    if (next) refs.push(() => { paBtn.disabled = s.e < next.cost; });

    box.append(h('p', { class: 'note left' }, 'Каждый новый ранг лавки тоже добавляет +1 к тапу.'));
  }

  function claimDaily() {
    const v = Econ.claimDaily();
    if (!v) return;
    Sound.coin();
    toast('Подарок: +' + ess(v.essence) + ' эссенции и +' + v.crystals + ' ' + crystalsWord(v.crystals));
    Cauldron.setMood('happy', 1200);
    save(); refresh(true);
  }

  async function doInvite() {
    const ok = await Platform.invite('Заходи ко мне в волшебную лавку «Бульк»! По этой ссылке получишь подарок на старт.');
    if (!ok) { toast('Приглашение не отправлено'); return; }
    if (Econ.canInvite()) {
      const v = Econ.claimInvite();
      Sound.coin();
      toast('Спасибо! +' + ess(v) + ' эссенции');
      save(); refresh(true);
    }
  }

  // ---------- окна ----------
  // Подробности о жителе: кто он, дружба, история, подарок
  function villagerModal(v) {
    const n = S().vis[v.id] || 0;
    const fp = Econ.friendProgress(v.id);
    const got = Econ.storiesUnlocked(v.id);
    const gift = Econ.visitorGift(v.id);
    modal({
      title: n ? v.name : 'Незнакомец',
      body: h('div', null,
        h('div', { class: 'dlg-portrait', 'aria-hidden': 'true' }, h('span', { class: 'dlg-ava' }, pic(n ? v.img : 'ui/hooded')), pic('hud/avatar_frame', 'dlg-frame')),
        n ? h('p', { class: 'center' }, v.bio) : h('p', { class: 'center' }, 'Этот житель ещё ни разу не заглядывал в лавку.'),
        n ? friendBlock(v.id) : null,
        Story.cur(v.id) ? [h('h3', { class: 'mini-title' }, 'Просьба'), Story.card(v.id)] : n && !Story.unlocked(v.id) ? h('p', { class: 'small center' }, 'Когда станете приятелями, ' + v.name.split(' ').pop() + ' попросит о помощи.') : null,
        got ? [h('h3', { class: 'mini-title' }, 'История'), v.story.slice(0, got).map((t) => h('p', { class: 'story' }, '«' + t + '»'))] : null,
        n && gift ? h('div', { class: 'gift-row' }, pic(gift.img || 'wardrobe/' + gift.id, 'gift-pic'),
          h('span', null, S().own.acc.includes(gift.id) ? 'Подарил: ' + gift.name : (v.giftAt ? 'Подарок за всю историю: ' : 'Подарок лучшему другу: ') + gift.name)) : null),
    });
  }

  // вкладка «Жители» в журнале
  function peopleBlock(box) {
    const s = S();
    box.append(h('h3', { class: 'section-title' }, 'Жители деревни'));
        box.append(h('p', { class: 'note left' }, 'Помогай с просьбами, и жители станут твоими друзьями. Приятели просят о помощи, а лучший друг дарит подарок.'));
        box.append(h('div', { class: 'people' }, D.visitors.map((v) => {
          const met = (s.vis[v.id] || 0) > 0;
          const lv = Econ.friendLevel(v.id);
          const ask = Story.cur(v.id);
          return h('button', { class: 'person' + (met ? '' : ' off'), type: 'button', onclick: () => { Sound.tap(); villagerModal(v); } },
            ask ? h('span', { class: 'ask-mark' + (Story.progress(v.id).ready ? ' ready' : '') }, '!') : null,
            h('span', { class: 'pi', 'aria-hidden': 'true' }, pic(met ? v.img : 'ui/hooded')),
            h('span', { class: 'pn' }, met ? v.name : 'Ещё не заходил'),
            h('span', { class: 'ps' }, pic(D.friendship[lv].img, 'heart'), D.friendship[lv].name));
        })));
  }

  function friendBlock(id) {
    const fp = Econ.friendProgress(id);
    const f = D.friendship[fp.lv];
    return h('div', { class: 'friend-box' },
      h('div', { class: 'friend-top' }, pic(f.img, 'heart-big'), h('b', null, f.name),
        h('small', null, fp.next ? fp.n + ' / ' + fp.next.need + ' просьб' : 'Максимум')),
      h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(fp.frac * 100) + '%' })),
      h('small', { class: 'friend-hint' }, fp.lv ? 'Награды за его заказы +' + Math.round(fp.lv * C.friendshipBonus * 100) + '%' : 'Выполни просьбу, чтобы познакомиться'));
  }

  function rankModal() {
    const r = Econ.rank();
    const rp = Econ.rankProgress();
    modal({
      title: 'Ранги лавки',
      body: h('div', null,
        h('p', null, rp.next ? 'До ранга «' + rp.next.name + '» осталось сварить ' + ess(rp.left) + ' эссенции. Каждый ранг даёт +1 к тапу и украшает лавку.' : 'Ты достиг высшего ранга!'),
        h('div', { class: 'ranks' }, D.ranks.map((x, i) => h('div', { class: 'rank-row' + (i === r ? ' now' : i < r ? ' past' : '') },
          pic(x.img, 'rank-pic'), h('b', null, x.name), h('small', null, ess(x.need)))))),
    });
  }

  function settingsModal() {
    const st = S().set;
    const apply = () => { applySettings(); save(); };
    const slider = (label, icon, key) => {
      const val = h('b', null, Math.round(st[key] * 100) + '%');
      const input = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(st[key] * 100)), 'aria-label': label });
      input.style.setProperty('--v', input.value);
      input.addEventListener('input', () => input.style.setProperty('--v', input.value));
      input.addEventListener('input', () => { st[key] = input.value / 100; setText(val, input.value + '%'); applySettings(); });
      input.addEventListener('change', apply);
      // ползунок из частей: трубка (колпачки не тянутся), заливка внутри стекла, ручка-флакон в пределах стекла
      const vs = h('div', { class: 'vslider' }, h('i', { class: 'vs-fill' }), h('b', { class: 'vs-knob' }), input);
      const sync = () => vs.style.setProperty('--v', input.value / 100);
      sync(); input.addEventListener('input', sync);
      return h('div', { class: 'set-row' }, pic(icon, 'set-ico'), h('div', { class: 'set-main' }, h('div', { class: 'set-label' }, label, val), vs));
    };
    const toggle = (label, icon, key, hint) => {
      const b = h('button', { class: 'switch' + (st[key] ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': st[key] ? 'true' : 'false', 'aria-label': label });
      b.addEventListener('click', () => { st[key] = !st[key]; b.classList.toggle('on', st[key]); b.setAttribute('aria-checked', st[key] ? 'true' : 'false'); Sound.tap(); apply(); });
      return h('div', { class: 'set-row' }, pic(icon, 'set-ico'), h('div', { class: 'set-main' }, h('div', { class: 'set-label' }, label), hint ? h('small', null, hint) : null), b);
    };
    const fmt = h('div', { class: 'seg small-seg' });
    [['short', '1,5 млн'], ['full', '1 500 000']].forEach(([v, l]) => {
      const b = h('button', { type: 'button', class: 'seg-btn' + (st.nums === v ? ' on' : '') }, l);
      b.addEventListener('click', () => { st.nums = v; fmt.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('on', x === b)); Sound.tap(); apply(); refresh(); });
      fmt.append(b);
    });
    modal({
      sheet: true,
      title: 'Настройки',
      body: h('div', { class: 'settings' },
        slider('Музыка', 'ui/music', 'music'),
        slider('Звуки', 'ui/speaker', 'sfx'),
        toggle('Вибрация', 'ui/phone', 'vib', 'Лёгкий отклик на тапы'),
        h('div', { class: 'set-row' }, pic('ui/abacus', 'set-ico'), h('div', { class: 'set-main' }, h('div', { class: 'set-label' }, 'Формат чисел'), fmt)),
        toggle('Меньше эффектов', 'ui/battery', 'lowfx', 'Для слабых телефонов и экономии батареи'),
        (typeof Online !== 'undefined' && Online.on()) ? (() => {
          const row = toggle('Скрывать моё фото', 'ui/hooded', 'hidePhoto', 'В топах и ковене другие увидят аватар из игры, а не фото из ' + Platform.label());
          row.querySelector('.switch').addEventListener('click', () => setTimeout(() => Online.hello(false, true), 300));
          return row;
        })() : null,
        (typeof Social !== 'undefined' && Platform.canNotify()) ? (() => {
          const b = h('button', { class: 'switch' + (st.notif ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': st.notif ? 'true' : 'false', 'aria-label': 'Напоминания' });
          b.addEventListener('click', async () => { Sound.tap(); const v = !st.notif; if (await Social.setNotify(v)) { b.classList.toggle('on', v); b.setAttribute('aria-checked', v ? 'true' : 'false'); } });
          return h('div', { class: 'set-row' }, pic('ui/envelope', 'set-ico'), h('div', { class: 'set-main' }, h('div', { class: 'set-label' }, 'Напоминания'), h('small', null, 'Лавка полна, питомец вернулся, пришёл босс')), b);
        })() : null,
        (typeof Online !== 'undefined' && Online.on()) ? h('div', { class: 'set-row' }, pic('ui/key', 'set-ico'), h('div', { class: 'set-main' }, h('div', { class: 'set-label' }, 'Один прогресс'), h('small', null, 'Играй в ВК и Telegram с одним сохранением')),
          h('button', { class: 'pill-btn', type: 'button', onclick: () => { Sound.tap(); closeModal(); setTimeout(() => Online.linkDialog(), 0); } }, 'Связать')) : null,
        (typeof Online !== 'undefined' && Online.isAdmin()) ? h('div', { class: 'set-row' }, pic('ui/key', 'set-ico'), h('div', { class: 'set-main' }, h('div', { class: 'set-label' }, 'Приложение админки'), h('small', null, 'Код для входа, только для команды')),
          h('button', { class: 'pill-btn', type: 'button', onclick: () => { Sound.tap(); closeModal(); setTimeout(() => Online.admCode(), 0); } }, 'Код')) : null,
        h('p', { class: 'small center ver-line', onclick: (() => {
          // одно нажатие - «Что нового»; 5 быстрых нажатий - админка (только для команды)
          let n = 0, t = 0;
          return () => {
            clearTimeout(t); n++;
            if (n >= 5 && Platform.kind() !== 'web') { n = 0; Game.save(); location.href = 'admin/' + (Platform.kind() === 'vk' ? location.search : ''); return; }
            t = setTimeout(() => { const one = n === 1; n = 0; if (one && typeof Changelog !== 'undefined') { closeModal(); setTimeout(() => Changelog.open(), 0); } }, 450);
          };
        })() }, 'Версия ' + C.version)),
      actions: (typeof Online !== 'undefined' && Online.isAdmin() ? [{ label: 'Админ-панель', onClick: () => { Game.save(); setTimeout(() => { location.href = 'admin/' + (Platform.kind() === 'vk' ? location.search : ''); }, 200); } }] : null)
    });
  }

  function applySettings() {
    const st = S().set;
    Sound.setVolumes(st.sfx, st.music);
    Fmt.setMode(st.nums);
    const was = RenderOpts.lowfx;
    RenderOpts.lowfx = !!st.lowfx;
    if (was !== RenderOpts.lowfx && typeof Cauldron !== 'undefined') Cauldron.resize();
  }

  function resetConfirm() {
    modal({
      title: 'Начать с самого начала?',
      body: h('p', null, 'Пропадёт всё: эссенция, карточки, ранг, истории жителей и достижения. Отменить будет нельзя.'),
      actions: [
        { label: 'Да, всё сбросить', onClick: () => { if (hooks.reset) hooks.reset(); } },
        { label: 'Оставить как есть', alt: true }
      ]
    });
  }

  function offlineModal(amount, sec) {
    let claimed = false;
    const give = (mult) => {
      if (claimed) return;
      claimed = true;
      Econ.earn(amount * mult);
      const c = Cauldron.center();
      Cauldron.floatText(c.x, c.y - 30, '+' + ess(amount * mult), '#FFC94D', 26);
      save();
    };
    const capped = sec >= Econ.pantryHours() * 3600;
    const actions = [];
    if (Platform.adsAvailable()) {
      actions.push({ label: 'Забрать вдвое больше ▶', onClick: async () => {
        const ok = await Platform.rewardedAd();
        if (ok) { give(2); Sound.coin(); } else { give(1); toast('Реклама недоступна, начислено обычное количество'); }
      } });
    }
    actions.push({ label: 'Забрать', alt: actions.length > 0, onClick: () => { give(1); Sound.coin(); } });
    modal({
      title: 'Лавка работала без тебя',
      body: h('div', null,
        h('p', null, 'Пока тебя не было ' + Fmt.time(sec) + ', помощники сварили ' + ess(amount) + ' эссенции.'),
        capped ? h('p', { class: 'small' }, 'Кладовая была полна: доход копится только ' + Econ.pantryHours() + ' ч. Её можно расширить в Лавке → Инструменты.') : null),
      actions,
      onClose: () => give(1)
    });
  }

  function welcomeModal(v) {
    modal({
      title: 'Тебя пригласил друг!',
      body: h('p', null, 'Держи подарок на открытие лавки: ' + ess(v) + ' эссенции.'),
      actions: [{ label: 'Спасибо!' }]
    });
  }

  // ---------- кристаллы ----------
  const crystalsWord = (n) => Fmt.plural(n, ['кристалл', 'кристалла', 'кристаллов']);
  const crystalPrice = (n) => h('span', { class: 'cr-price' }, pic('ui/crystal', 'cr-ico'), n);

  // доход: что значат три цифры (на главном экране видна только «в час»)
  function incomeInfo() {
    modal({
      title: 'Эссенция',
      body: h('div', null,
        h('p', { class: 'center' }, 'Сейчас у тебя ' + ess(S().e) + ' эссенции.'),
        [['ui/ladle', 'За тап', 'Столько даёт одно помешивание котла', '+' + ess(Econ.tapValue())],
         ['ui/hourglass', 'В час', 'Лавка варит сама, даже когда ты не тапаешь', '+' + ess(Econ.perHour())],
         ['ui/basket', 'Копится без тебя', 'Пока игра закрыта, доход копится столько часов. Больше - улучши кладовую', Econ.pantryHours() + ' ч']
        ].map(([img, t, d, v]) => h('div', { class: 'income-row' }, pic(img), h('span', null, h('b', null, t), h('small', null, d)), h('b', null, v))),
        h('p', { class: 'small center' }, 'Эти цифры всегда видны во вкладке «Лавка».'))
    });
  }

  function crystalsInfo() {
    const c = C.crystals;
    modal({
      title: 'Лунные кристаллы',
      body: h('div', null,
        h('div', { class: 'sheet-ico' }, pic('ui/crystal_chest')),
        h('p', { class: 'center' }, 'У тебя ' + S().cr + ' ' + crystalsWord(S().cr) + '. На них покупают аватары, украшения и цвета для Булька.'),
        h('div', { class: 'earn-list' },
          [['ui/gift', 'Подарок дня', c.daily[0] + '-' + c.daily[c.daily.length - 1]],
           ['ui/checklist', 'Каждое задание', c.quest],
           ['ui/book', 'Рецепт дня', c.recipe],
           ['ui/rune', 'Руна дня', c.rune],
           ['ui/heart3', 'Новый уровень дружбы', c.friendship],
           ['ui/trophy', 'Каждое достижение', c.achievement]].map(([img, t, n]) =>
            h('div', { class: 'earn-row' }, pic(img, 'earn-ico'), h('span', null, t), crystalPrice('+' + n))))),
      actions: [{ label: 'Понятно', alt: true }]
    });
  }

  // ---------- аватар ----------
  let photoUrl = '';
  function setPhoto(url) { photoUrl = url || ''; }
  function avatarSrc(id) {
    const a = id || S().prof.avatar;
    if (a === 'photo' && photoUrl) return photoUrl;
    const av = DATA.avatars.find((x) => x.id === a) || DATA.avatars[0];
    return IMG(av.img);
  }
  const avatarImg = (cls, id) => h('img', { class: 'pic ' + (cls === 'round' ? 'av-round' : (cls || '')), src: avatarSrc(id), alt: '', draggable: 'false', referrerpolicy: 'no-referrer' });

  // ---------- профиль ----------
  function profileModal() {
    const s = S();
    const nm = s.prof.name || 'Алхимик';
    const stats = [
      ['ui/essence', 'Сварено всего', ess(s.le)],
      ['ui/ladle', 'Помешиваний', ess(s.taps)],
      ['ui/door', 'Выполнено просьб', s.served],
      ['ui/heart4', 'Лучших друзей', Econ.bestFriends() + ' из ' + D.visitors.length],
      ['ui/book', 'Разгадано рецептов', s.recipesSolved],
      ['ui/rune', 'Начерчено рун', s.runesDone],
      ['cauldron/bubble', 'Поймано пузырей', s.bb],
      ['ui/checklist', 'Выполнено заданий', s.qd],
      ['ui/calendar', 'Дней в игре', s.stat.days],
      ['ui/flame', 'Лучшая серия', s.stat.bestStreak + ' ' + Fmt.plural(s.stat.bestStreak, ['день', 'дня', 'дней'])],
      ['ui/chart', 'Рекорд дохода', ess(s.stat.maxPh) + ' в час'],
      ['ui/hourglass', 'Времени в игре', Fmt.time(s.stat.play)]
    ];
    modal({
      sheet: true,
      title: 'Профиль',
      body: h('div', { class: 'profile' },
        h('div', { class: 'prof-head' },
          h('button', { class: 'prof-avatar', type: 'button', 'aria-label': 'Сменить аватар', onclick: () => { closeModal(); avatarPicker(); } },
            avatarImg('round'), h('span', { class: 'prof-edit' }, pic('ui/camera'))),
          h('div', { class: 'prof-text' },
            h('button', { class: 'prof-name', type: 'button', onclick: () => { closeModal(); nameEditor('player'); } }, nm, h('span', { class: 'pencil' }, pic('hud/pencil'))),
            h('button', { class: 'prof-title', type: 'button', onclick: () => { closeModal(); titlePicker(); } }, pic('ui/banner', 'title-ico'), Econ.titleName()),
            h('div', { class: 'prof-meta' }, pic(D.ranks[Econ.rank()].img, 'rank-mini'), D.ranks[Econ.rank()].name, ' · с ', new Date(s.stat.start).toLocaleDateString('ru-RU')))),
        levelBlock(),
        socialBlock(),
        h('h3', { class: 'mini-title' }, 'Статистика'),
        h('div', { class: 'stat-grid' }, stats.map(([img, t, v]) => h('div', { class: 'stat-card' }, pic(img, 'stat-ico'), h('small', null, t), h('b', null, v)))),
        h('h3', { class: 'mini-title' }, 'Достижения ' + s.ac.length + ' из ' + D.achievements.length),
        h('div', { class: 'ach-icons' }, D.achievements.slice().sort((a, b) => (s.ac.includes(b.id) ? 1 : 0) - (s.ac.includes(a.id) ? 1 : 0)).map((a) => {
          const on = s.ac.includes(a.id);
          return h('button', { class: 'ach-ico' + (on ? '' : ' off'), type: 'button', 'aria-label': a.name,
            onclick: () => { Sound.tap(); toast((on ? 'Получено: ' : 'Ещё не получено: ') + a.name + ' - ' + a.desc); } },
            pic(a.img), on ? null : pic('ui/padlock', 'lock'));
        })),
        h('p', { class: 'small center' }, 'Нажми на значок, чтобы узнать, за что он.')),
    });
  }

  // Связи игрока: ковен и привязанные платформы (один прогресс для ВК и Telegram)
  function socialBlock() {
    if (typeof Online === 'undefined' || !Online.on()) return null;
    const rows = [];
    const cv = typeof Coven !== 'undefined' && Coven.mine ? Coven.mine() : null;
    rows.push(h('button', { class: 'soc-row', type: 'button', onclick: () => { Sound.tap(); closeModal(); setTimeout(() => Coven.open(), 0); } },
      pic('ui/coven', 'soc-ico'), h('span', null, h('small', null, 'Ковен'), h('b', null, cv ? cv.name : 'Пока без ковена')), h('i', null, cv ? 'Открыть' : 'Найти')));
    const ln = Online.linked() || {};
    const both = ln.tg && ln.vk;
    rows.push(h('button', { class: 'soc-row', type: 'button', onclick: () => { Sound.tap(); closeModal(); setTimeout(() => Online.linkDialog(), 0); } },
      pic('ui/phone', 'soc-ico'), h('span', null, h('small', null, 'Один прогресс'),
        h('b', null, both ? 'ВКонтакте + Telegram' : 'Только ' + (ln.vk ? 'ВКонтакте' : 'Telegram'))), h('i', null, both ? 'Подробнее' : 'Привязать')));
    return h('div', { class: 'soc-block' }, rows);
  }

  // Уровень алхимика в профиле
  function levelBlock() {
    const s = S();
    const need = Econ.xpToNext();
    const pts = Econ.skillPoints();
    const btn = h('button', { class: 'btn' + (pts ? '' : ' alt'), type: 'button' }, pic('skills/orb', 'btn-ico'),
      pts ? 'Навыки: ' + pts + ' ' + Fmt.plural(pts, ['очко', 'очка', 'очков']) + ' ждут' : 'Дерево навыков');
    btn.addEventListener('click', () => { Sound.tap(); closeModal(); setTimeout(() => SkillsUI.open(), 0); });
    return h('div', { class: 'lvl-block' },
      h('div', { class: 'lvl-row' },
        h('div', { class: 'lvl-badge' }, pic('skills/level'), h('b', null, s.lvl)),
        h('div', { class: 'lvl-text' }, h('b', null, 'Уровень алхимика ' + s.lvl),
          need ? h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.min(100, s.xp / need * 100) + '%' })) : null,
          h('small', null, need ? ess(s.xp) + ' / ' + ess(need) + ' опыта' : 'Максимальный уровень'))),
      btn);
  }

  function avatarPicker() {
    const s = S();
    const grid = h('div', { class: 'avatar-grid' });
    const draw = () => {
      grid.innerHTML = '';
      const opts = [];
      if (photoUrl) opts.push({ id: 'photo', photo: true });
      DATA.avatars.forEach((a) => opts.push(a));
      opts.forEach((a) => {
        const owned = a.photo || Econ.avatarOwned(a);
        const on = s.prof.avatar === a.id;
        const b = h('button', { class: 'av-cell' + (on ? ' on' : '') + (owned ? '' : ' locked'), type: 'button', 'aria-label': a.photo ? 'Фото профиля' : 'Аватар' },
          avatarImg('round', a.id),
          a.photo ? h('span', { class: 'av-tag' }, 'Фото') : null,
          owned ? null : a.event ? h('span', { class: 'av-tag ev' }, 'Событие') : h('span', { class: 'av-price' }, crystalPrice(a.cr)));
        b.addEventListener('click', () => {
          if (owned) { Econ.setAvatar(a.id); Sound.tap(); save(); draw(); refresh(); return; }
          if (a.event) { closeModal(); eventItemClick({ event: a.event, reason: '«' + DATA.eventDefs[a.event].name + '»' }); return; }
          if (s.cr < a.cr) { Sound.deny(); toast('Не хватает кристаллов: нужно ' + a.cr); return; }
          if (Econ.buyAvatar(a.id)) { Econ.setAvatar(a.id); Sound.coin(); toast('Новый аватар!'); save(); draw(); refresh(); }
        });
        grid.append(b);
      });
    };
    draw();
    modal({
      sheet: true,
      title: 'Аватар',
      body: h('div', null, h('p', { class: 'small' }, 'Первые 4 бесплатно, остальные открываются за лунные кристаллы. У тебя ' + s.cr + '.'), grid),
      actions: [{ label: 'Готово', onClick: () => { setTimeout(profileModal, 0); } }]
    });
  }

  function titlePicker() {
    const s = S();
    const open = Econ.titlesUnlocked().map((t) => t.id);
    modal({
      sheet: true,
      title: 'Титул',
      body: h('div', { class: 'title-list' }, D.titles.map((t) => {
        const ok = open.includes(t.id);
        const b = h('button', { class: 'title-row' + (s.prof.title === t.id ? ' on' : '') + (ok ? '' : ' locked'), type: 'button', disabled: !ok },
          pic(ok ? 'ui/banner' : 'ui/padlock', 'title-ico'), h('span', null, t.name));
        b.addEventListener('click', () => { Econ.setTitle(t.id); Sound.tap(); save(); closeModal(); setTimeout(profileModal, 0); });
        return b;
      })),
      actions: [{ label: 'Назад', alt: true, onClick: () => { setTimeout(profileModal, 0); } }]
    });
  }

  // Ввод имени игрока или котла
  function nameEditor(kind) {
    const s = S();
    const isPot = kind === 'pot';
    const input = h('input', { class: 'text-input', type: 'text', maxlength: isPot ? '16' : '20', value: isPot ? s.wear.name : (s.prof.name || ''), placeholder: isPot ? 'Бульк' : 'Твоё имя', 'aria-label': 'Имя' });
    modal({
      title: isPot ? 'Имя котла' : 'Как тебя зовут?',
      body: h('div', null, input),
      onOpen: () => setTimeout(() => input.focus(), 50),
      actions: [{ label: 'Сохранить', onClick: () => {
        if (isPot) Econ.setCauldronName(input.value); else Econ.setName(input.value);
        save();
        if (!isPot) setTimeout(profileModal, 0);
      } }, { label: 'Отмена', alt: true, onClick: () => { if (!isPot) setTimeout(profileModal, 0); } }]
    });
  }

  // ---------- внешний вид Булька ----------
  function applyLook(c) {
    const w = S().wear;
    c.setBackground(Events.bg());
    if (c === Cauldron && Sound.setMusic) Sound.setMusic('shop');
    c.setAmbient(Events.ambient());
    const evLiq = Events.liquid();
    c.setLiquid(w.liquid === 'auto' && evLiq ? evLiq : Econ.liquidColor());
    c.setPotColor(Econ.potColorValue());
    const ok = (id) => { const it = D.wardrobe.find((x) => x.id === id); return it && Econ.itemState(it).owned ? id : ''; };
    c.setWear('head', ok(w.head));
    c.setWear('face', ok(w.face));
    const sp = D.wardrobe.find((x) => x.id === ok(w.spoon));
    if (c.setSpoon) c.setSpoon(sp ? sp.img : null);
    const sd = D.wardrobe.find((x) => x.id === ok(w.stand)) || D.wardrobe.find((x) => x.id === 'stand_iron');
    if (c.setStand && sd) c.setStand(sd.img);
  }

  // предпросмотр в гардеробе - отдельный котёл
  let preview = null, previewCv = null;
  function previewFrame(dt) {
    if (screen !== 'wardrobe' || !preview || !preview._ready) return;
    preview.update(dt, 1);
    preview.render();
  }

  // Нажатие на предмет события: открыть событие или сказать, что оно прошло
  function eventItemClick(st) {
    if (Events.active(st.event)) { Events.openSheet(st.event && DATA.eventDefs[st.event] ? 'shop' : null); return; }
    Sound.deny();
    toast('Было доступно на событии ' + st.reason);
  }

  VIEWS.wardrobe = {
    key: () => {
      const s = S();
      return 'w' + (s.wtab || 'head') + JSON.stringify(s.wear) + s.own.acc.length + s.own.pot.length + Econ.rank() + s.cr;
    },
    render(box) {
      const s = S();
      const tab = s.wtab && s.wtab !== 'head' ? s.wtab : 'face';
      if (!previewCv) {
        previewCv = h('canvas', { class: 'preview-cv', 'aria-label': 'Предпросмотр котла' });
        preview = createCauldron();
      }
      const stage = h('div', { class: 'preview' }, previewCv,
        h('button', { class: 'pot-name', type: 'button', onclick: () => { Sound.tap(); nameEditor('pot'); } }, s.wear.name, h('span', { class: 'pencil' }, pic('hud/pencil'))));
      box.append(stage);
      requestAnimationFrame(() => {
        if (!preview._ready) { preview.init(previewCv); preview._ready = true; } else preview.resize();
        applyLook(preview);
      });

      const tabs = [['face', 'Очки'], ['spoon', 'Ложка'], ['room', 'Комната'], ['liquid', 'Зелье'], ['pot', 'Котёл']];
      box.append(h('div', { class: 'seg' }, tabs.map(([id, l]) => h('button', {
        type: 'button', class: 'seg-btn' + (tab === id ? ' on' : ''), onclick: () => { s.wtab = id; Sound.tap(); rebuild(false); }
      }, l))));

      const grid = h('div', { class: 'ward-grid' });
      const cell = (img, name, state, on, onClick, swatch) => {
        const b = h('button', { class: 'ward-cell' + (on ? ' on' : '') + (state.owned ? '' : ' locked'), type: 'button' },
          swatch ? h('span', { class: 'swatch', style: 'background:' + swatch }) : h('span', { class: 'ward-pic' }, pic(img)),
          h('span', { class: 'ward-name' }, name),
          state.owned ? h('span', { class: 'ward-state' }, on ? 'Надето' : 'Надеть')
            : state.price ? h('span', { class: 'ward-state buy' }, crystalPrice(state.price))
              : h('span', { class: 'ward-state lock' }, pic('ui/padlock', 'lock-mini'), state.reason));
        b.addEventListener('click', onClick);
        return b;
      };

      if (tab === 'face' || tab === 'spoon' || tab === 'room') {
        D.wardrobe.filter((it) => (tab === 'room' ? it.slot === 'bed' || it.slot === 'toy' : it.slot === tab)).forEach((it) => {
          const st = Econ.itemState(it);
          const sl = it.slot;
          grid.append(cell(it.img || 'wardrobe/' + it.id, it.name, st, s.wear[sl] === it.id, () => {
            if (st.owned) { Econ.equip(sl, it.id); Sound.tap(); }
            else if (st.price) {
              if (s.cr < st.price) { Sound.deny(); toast('Не хватает кристаллов: нужно ' + st.price); return; }
              if (Econ.buyItem(it.id)) { Econ.equip(sl, it.id); Sound.coin(); toast(it.name + ': теперь твоё!'); }
            } else if (st.event) { eventItemClick(st); return; } else { Sound.deny(); toast(st.reason); return; }
            applyLook(Cauldron); save(); rebuild(false);
          }));
        });
      } else if (tab === 'liquid') {
        const r = Econ.rank();
        grid.append(cell(null, 'По рангу', { owned: true }, s.wear.liquid === 'auto', () => { Econ.equip('liquid', 'auto'); Sound.tap(); applyLook(Cauldron); save(); rebuild(false); },
          'conic-gradient(' + D.liquids.join(',') + ')'));
        D.liquids.forEach((col, i) => {
          const st = i <= r ? { owned: true } : { owned: false, reason: 'Ранг «' + D.ranks[i].name + '»' };
          grid.append(cell(null, DATA.liquidNames[i], st, s.wear.liquid === i, () => {
            if (!st.owned) { Sound.deny(); toast('Откроется на ранге «' + D.ranks[i].name + '»'); return; }
            Econ.equip('liquid', i); Sound.tap(); applyLook(Cauldron); save(); rebuild(false);
          }, col));
        });
      } else {
        grid.append(h('div', { class: 'ward-sub' }, 'Цвет котла'));
        D.potColors.forEach((pc) => {
          const st = Econ.itemState(pc, 'pot');
          grid.append(cell(null, pc.name, st, s.wear.pot === pc.id, () => {
            if (st.owned) { Econ.equip('pot', pc.id); Sound.tap(); }
            else if (st.price) {
              if (s.cr < st.price) { Sound.deny(); toast('Не хватает кристаллов: нужно ' + st.price); return; }
              if (Econ.buyItem(pc.id, 'pot')) { Econ.equip('pot', pc.id); Sound.coin(); toast(pc.name + ' котёл: теперь твой!'); }
            } else if (st.event) { eventItemClick(st); return; }
            applyLook(Cauldron); save(); rebuild(false);
          }, pc.color || '#3E2F66'));
        });
        grid.append(h('div', { class: 'ward-sub' }, 'Подставка'));
        D.wardrobe.filter((it) => it.slot === 'stand').forEach((it) => {
          const st = Econ.itemState(it);
          grid.append(cell(it.img, it.name, st, (s.wear.stand || 'stand_iron') === it.id, () => {
            if (st.owned) { Econ.equip('stand', it.id); Sound.tap(); }
            else if (st.price) {
              if (s.cr < st.price) { Sound.deny(); toast('Не хватает кристаллов: нужно ' + st.price); return; }
              if (Econ.buyItem(it.id)) { Econ.equip('stand', it.id); Sound.coin(); toast(it.name + ': теперь твоя!'); }
            } else if (st.event) { eventItemClick(st); return; } else { Sound.deny(); toast(st.reason); return; }
            applyLook(Cauldron); save(); rebuild(false);
          }));
        });
      }
      box.append(grid);
      box.append(h('p', { class: 'note left' }, tab === 'spoon'
        ? 'Ложка помешивает зелье, когда ты тапаешь по котлу. Нажми на надетую, чтобы убрать.'
        : tab === 'room' ? 'Лежанка стоит у котла - на ней спят питомцы. Клубок - их любимая игрушка.'
        : tab === 'head' || tab === 'face'
        ? 'Украшения дарят жители-лучшие друзья, открывают ранги или продаются за кристаллы. Нажми на надетое, чтобы снять.'
        : tab === 'liquid' ? 'Новые цвета зелья открываются с рангами лавки.' : 'Цвет котла меняется вместе с узором и бликами. Подставка - тренога, на которой стоит котёл.'));
    }
  };

  // ---------- проверка «я не робот» ----------
  let guardLeft = 0, guardLast = 0;
  function showGuard() {
    const g = $('guard');
    guardLeft = 3;
    g.innerHTML = '';
    const star = h('button', { class: 'guard-star', type: 'button', 'aria-label': 'Звёздочка' }, pic('ui/sparkle'));
    const msg = h('p', null, 'Котёл закружился от такого темпа! Поймай 3 звёздочки, чтобы продолжить.');
    g.append(h('div', { class: 'guard-box' }, h('b', null, 'Ой-ой-ой'), msg), star);
    const place = () => {
      const w = g.clientWidth, hh = g.clientHeight;
      star.style.left = (20 + Math.random() * Math.max(10, w - 90)) + 'px';
      star.style.top = (90 + Math.random() * Math.max(10, hh - 160)) + 'px';
    };
    star.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const now = performance.now();
      if (!e.isTrusted || now - guardLast < 250) return;
      guardLast = now;
      guardLeft--;
      Sound.coin();
      if (guardLeft <= 0) {
        g.hidden = true;
        AntiBot.unlock();
        toast('Спасибо! Помешиваем дальше');
      } else place();
    });
    g.hidden = false;
    place();
    Cauldron.setMood('wow', 2500);
  }

  // ---------- запуск ----------
  function init(h0) {
    Object.assign(hooks, h0);
    buildTabs();
    $('rank-btn').addEventListener('click', () => { Sound.unlock(); Sound.tap(); rankModal(); });
    $('btn-settings').addEventListener('click', () => { Sound.unlock(); Sound.tap(); settingsModal(); });
    $('btn-profile').addEventListener('click', () => { Sound.unlock(); Sound.tap(); profileModal(); });
    $('lvl-chip').addEventListener('click', () => { Sound.unlock(); Sound.tap(); SkillsUI.open(); });
    $('crystal-pill').addEventListener('click', () => { Sound.unlock(); Sound.tap(); crystalsInfo(); });
    $('balance-btn').addEventListener('click', () => { Sound.unlock(); Sound.tap(); incomeInfo(); });
    $('btn-gift').addEventListener('click', () => { Sound.unlock(); Sound.tap(); S().jtab = 'day'; show('tasks'); });
    $('btn-recipe').addEventListener('click', () => { Sound.unlock(); Sound.tap(); Daily.openRecipe(); });
    $('btn-rune').addEventListener('click', () => { Sound.unlock(); Sound.tap(); Daily.openRune(); });
    $('brew-btn').addEventListener('click', () => { Sound.unlock(); Sound.tap(); Brew.open(); });
    $('pets-btn').addEventListener('click', () => { Sound.unlock(); Sound.tap(); Pets.open(); });
    $('games-btn').addEventListener('click', () => { Sound.unlock(); Sound.tap(); Games.open(); });
    $('tops-btn').addEventListener('click', () => { Sound.unlock(); Sound.tap(); Tops.open(0); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current && current.closable !== false) closeModal(); });
  }

  return {
    h, pic, money, setText, init, show, refresh, toast, say, sinceSay, modal, closeModal, isModalOpen, modalClosable,
    offlineModal, welcomeModal, showGuard, villagerModal, friendBlock,
    applySettings, applyLook, previewFrame, setPhoto, avatarSrc,
    screen: () => screen, ess, crystalsWord, keepSeg
  };
})();

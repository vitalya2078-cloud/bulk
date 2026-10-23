// =====================================================================
//  Ковены (0.17): маленькие сообщества алхимиков до 30 человек.
//  Вклад = минуты в игре (считает база), уровень ковена даёт всем +2% дохода за уровень.
//  Чат ковена, роли (глава, заместитель, участник), вступление открытое или по заявке.
// =====================================================================

const Coven = (() => {
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const call = (fn, body, ms) => Online.call(fn, body, ms);
  const COST = 50; // кристаллов за создание
  const MAX = 30;
  const COLORS = { purple: '#8E5BE8', red: '#E5484D', orange: '#F28C28', gold: '#E8B923', green: '#3FAE5A', teal: '#22A3A3', blue: '#3D7BE0', pink: '#E46AB3' };
  const EMBLEMS = Array.from({ length: 16 }, (_, i) => 'e' + String(i + 1).padStart(2, '0'));
  const ROLE = { leader: 'Глава', deputy: 'Заместитель', member: 'Участник' };
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; };
  const save = () => { if (window.Game) Game.save(); };

  let my = null;        // ответ coven_me
  let lastSeenMsg = +(ls('bulk_chat_seen') || 0);

  // ---------- эмблема: щит перекрашивается в цвет ковена ----------
  function emblem(c, size) {
    const col = COLORS[c.color] || COLORS.purple;
    return h('span', { class: 'emb', style: '--c:' + col + ';--s:' + (size || 56) + 'px' },
      h('span', { class: 'emb-tint' }), pic('coven/emblems/' + (c.emblem || 'e01'), 'emb-sym'));
  }
  const errText = (e) => {
    const m = String(e && e.message || e);
    if (/name taken/.test(m)) return 'Такое название уже занято';
    if (/bad name/.test(m)) return 'Название от 3 до 20 букв';
    if (/bad word/.test(m)) return 'В названии грубое слово - придумай другое';
    if (/already in coven/.test(m)) return 'Ты уже в ковене';
    if (/full/.test(m)) return 'В ковене нет мест';
    if (/muted/.test(m)) return 'Тебе пока нельзя писать в чат';
    if (/too fast/.test(m)) return 'Не так быстро';
    if (/no right/.test(m)) return 'Нет прав на это';
    if (/banned/.test(m)) return 'Аккаунт заблокирован';
    return 'Не получилось. Проверь интернет и попробуй ещё раз';
  };

  // ---------- состояние ----------
  async function refresh() {
    if (!Online.on()) return null;
    try {
      if (my && my.coven) { const st = Econ.s; await call('coven_progress', { p_taps: Math.floor(st.taps || 0), p_brewed: Math.floor(st.brewed || 0), p_served: Math.floor(st.served || 0) }); }
    } catch (e) { /* без сети */ }
    try { my = await call('coven_me', {}); } catch (e) { return my; }
    applyBonus();
    badge();
    return my;
  }
  function applyBonus() {
    const b = my && my.coven ? +my.coven.bonus || 0 : 0;
    Econ.setCovenMul(1 + b / 100);
  }
  function badge() {
    const btn = document.getElementById('coven-btn');
    if (!btn) return;
    btn.hidden = !Online.on();
    const dot = btn.querySelector('b');
    const unread = my && my.coven && my.last_msg && my.last_msg > lastSeenMsg;
    const req = my && my.requests && my.requests.length && my.coven;
    if (dot) { dot.hidden = !(unread || req); dot.textContent = req ? String(my.requests.length) : '•'; }
  }

  // ---------- вход ----------
  async function open() {
    if (!Online.on()) { UI.toast('Ковены работают во ВКонтакте и Telegram'); return; }
    UI.modal({ title: 'Ковены', sheet: true, cls: 'fixed-h cv-modal', body: h('div', { class: 'cv-wrap' }, h('p', { class: 'top-empty' }, 'Открываю...')) });
    await refresh();
    UI.closeModal();
    if (my && my.coven) home(); else browse();
  }

  // ---------- без ковена: «Найти ковен» или «Создать свой» в одном окне ----------
  let ltab = 'find';
  function browse(startTab) {
    if (startTab) ltab = startTab;
    const seg = h('div', { class: 'seg cv-seg' });
    const box = h('div', { class: 'cv-box' });
    function draw() {
      seg.replaceChildren(...[['find', 'Найти ковен'], ['create', 'Создать свой']].map(([id, l]) => h('button', {
        class: 'seg-btn' + (ltab === id ? ' on' : ''), type: 'button', onclick: () => { if (ltab !== id) { Sound.tap(); ltab = id; draw(); } }
      }, l)));
      if (ltab === 'find') find(box); else createForm(box);
    }
    UI.modal({ title: 'Ковены', sheet: true, cls: 'fixed-h cv-modal', body: h('div', { class: 'cv-wrap' }, seg, box), onOpen: draw });
  }

  function find(box) {
    const list = h('div', { class: 'cv-list' }, h('p', { class: 'top-empty' }, 'Ищу ковены...'));
    const search = h('input', { class: 'cv-input', type: 'search', placeholder: 'Название или #ID ковена', enterkeyhint: 'search' });
    let t = 0;
    search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => load(search.value), 400); });
    async function load(qq) {
      let rows;
      try { rows = await call('coven_list', { p_q: (qq || '').trim() }); } catch (e) { list.replaceChildren(h('p', { class: 'top-empty' }, errText(e))); return; }
      if (!rows || !rows.length) {
        list.replaceChildren(h('div', { class: 'top-empty' }, h('p', null, qq ? 'Ничего не нашлось' : 'Ковенов пока нет.'),
          h('button', { class: 'btn', type: 'button', onclick: () => { Sound.tap(); ltab = 'create'; UI.closeModal(); setTimeout(() => browse(), 0); } }, 'Создать свой')));
        return;
      }
      const mine = new Set((my && my.requests) || []);
      list.replaceChildren(...rows.map((c) => {
        const requested = c.requested || mine.has(c.id);
        const full = c.members >= MAX;
        const btn = h('button', { class: 'pill-btn cv-join', type: 'button', disabled: full && !requested }, full ? 'Мест нет' : requested ? 'Отменить' : c.open ? 'Вступить' : 'Заявка');
        btn.addEventListener('click', async () => {
          Sound.tap(); btn.disabled = true;
          try {
            if (requested) { await call('coven_cancel_request', { p_id: c.id }); UI.toast('Заявка отменена'); await refresh(); load(search.value); return; }
            const r = await call('coven_join', { p_id: c.id });
            if (r === 'joined') { Sound.fanfare(); UI.toast('Добро пожаловать в «' + c.name + '»!'); await refresh(); UI.closeModal(); setTimeout(home, 0); return; }
            UI.toast('Заявка отправлена. Глава ковена её рассмотрит'); await refresh(); load(search.value);
          } catch (e) { UI.toast(errText(e)); btn.disabled = false; }
        });
        return h('div', { class: 'cv-row' }, emblem(c, 50),
          h('div', { class: 'cv-info' },
            h('b', null, c.name, h('span', { class: 'cv-id' }, '#' + c.id)),
            h('small', null, 'Ур. ' + c.level + ' · ' + c.members + '/' + MAX + ' · ' + (c.open ? 'открытый' : 'по заявкам')),
            c.motto ? h('i', null, c.motto) : null),
          btn);
      }));
    }
    box.replaceChildren(
      h('div', { class: 'cv-hero' }, pic('ui/coven', 'cv-hero-ico'),
        h('p', null, 'Вступай в ковен: вместе быстрее растёт уровень, а каждый уровень даёт всем +2% к доходу. Общие задания, босс выходных и свой чат.')),
      search, list);
    load('');
  }

  // форма ковена: название (только при создании), девиз, символ, цвет, вступление
  function form(st, withName) {
    const name = h('input', { class: 'cv-input', maxlength: '20', placeholder: 'Название, 3-20 букв', value: st.name || '' });
    const motto = h('input', { class: 'cv-input', maxlength: '80', placeholder: 'Девиз (можно пусто)', value: st.motto || '' });
    const preview = h('div', { class: 'cv-preview' });
    const embs = h('div', { class: 'cv-embs' });
    const cols = h('div', { class: 'cv-cols' });
    const mode = h('div', { class: 'seg small-seg' });
    function draw() {
      preview.replaceChildren(emblem(st, 84), h('b', null, (withName ? name.value.trim() : st.name) || 'Мой ковен'));
      embs.replaceChildren(...EMBLEMS.map((e) => h('button', { class: 'cv-emb' + (st.emblem === e ? ' on' : ''), type: 'button', onclick: () => { st.emblem = e; Sound.tap(); draw(); } }, pic('coven/emblems/' + e))));
      cols.replaceChildren(...Object.keys(COLORS).map((k) => h('button', { class: 'cv-col' + (st.color === k ? ' on' : ''), type: 'button', style: 'background:' + COLORS[k], 'aria-label': k, onclick: () => { st.color = k; Sound.tap(); draw(); } })));
      mode.replaceChildren(...[[true, 'Открытый'], [false, 'По заявкам']].map(([v, l]) => h('button', { class: 'seg-btn' + (st.open === v ? ' on' : ''), type: 'button', onclick: () => { st.open = v; Sound.tap(); draw(); } }, l)));
    }
    name.addEventListener('input', () => { st.name = name.value; preview.querySelector('b').textContent = name.value.trim() || 'Мой ковен'; });
    motto.addEventListener('input', () => { st.motto = motto.value; });
    draw();
    return h('div', { class: 'cv-create' }, preview,
      withName ? [h('label', { class: 'cv-label' }, 'Название'), name] : null,
      h('label', { class: 'cv-label' }, 'Девиз'), motto,
      h('label', { class: 'cv-label' }, 'Символ'), embs,
      h('label', { class: 'cv-label' }, 'Цвет'), cols,
      h('label', { class: 'cv-label' }, 'Вступление'), mode);
  }

  const newCoven = { name: '', emblem: 'e01', color: 'purple', motto: '', open: true };
  function createForm(box) {
    const st = newCoven;
    const btn = h('button', { class: 'btn cv-wide', type: 'button' }, 'Основать · ' + COST + ' кристаллов');
    btn.addEventListener('click', async () => {
      const nm = (st.name || '').trim();
      if (nm.length < 3) { UI.toast('Название от 3 до 20 букв'); return; }
      if (Econ.s.cr < COST) { Sound.deny(); UI.toast('Нужно ' + COST + ' кристаллов'); return; }
      btn.disabled = true;
      try { await call('coven_create', { p_name: nm, p_emblem: st.emblem, p_color: st.color, p_motto: (st.motto || '').trim(), p_open: st.open }); }
      catch (e) { UI.toast(errText(e)); btn.disabled = false; return; }
      Econ.addCrystals(-COST); save(); Sound.fanfare();
      UI.toast('Ковен «' + nm + '» основан!');
      Object.assign(newCoven, { name: '', motto: '' });
      await refresh();
      UI.closeModal(); setTimeout(home, 0);
    });
    box.replaceChildren(form(st, true), btn, h('p', { class: 'note center' }, 'У тебя ' + Econ.s.cr + ' ' + UI.crystalsWord(Econ.s.cr) + '. До 30 участников в ковене.'));
  }

  // ---------- мой ковен ----------
  let tab = 'info', poll = 0;
  function home(startTab) {
    if (startTab) tab = startTab;
    const seg = h('div', { class: 'seg cv-seg' });
    const box = h('div', { class: 'cv-box' });
    const foot = h('div', { class: 'cv-foot' });
    function draw() {
      const reqN = my && my.requests ? my.requests.length : 0;
      const unread = tab !== 'chat' && my && my.last_msg > lastSeenMsg;
      const bossLive = my && my.boss && my.boss.open && !my.boss.dead;
      seg.replaceChildren(...[['info', 'Ковен', reqN], ['boss', 'Босс', bossLive ? '!' : 0], ['chat', 'Чат', unread ? '•' : 0], ['members', 'Состав', 0]].map(([id, l, n]) => h('button', {
        class: 'seg-btn' + (tab === id ? ' on' : ''), type: 'button', onclick: () => { if (tab !== id) { Sound.tap(); tab = id; draw(); } }
      }, l, n ? h('span', { class: 'seg-badge' }, String(n)) : null)));
      clearInterval(poll); poll = 0;
      foot.replaceChildren();
      if (tab === 'chat') { chat(box, foot); return; }
      if (tab === 'boss') { boss(box); return; }
      const t = tab;
      (t === 'info' ? info : members)(box);
      // свежие данные: состав и заявки могли измениться
      refresh().then(() => { if (tab === t && my && my.coven && box.isConnected) (t === 'info' ? info : members)(box); });
    }
    UI.modal({
      title: my && my.coven ? my.coven.name : 'Ковен', sheet: true, cls: 'fixed-h cv-modal cv-home',
      body: h('div', { class: 'cv-wrap' }, seg, box, foot),
      onOpen: draw,
      onClose: () => { clearInterval(poll); poll = 0; badge(); }
    });
    home.redraw = draw;
  }
  const reopen = async (t) => { await refresh(); if (!my || !my.coven) { UI.closeModal(); setTimeout(() => browse('find'), 0); return; } if (t) tab = t; if (home.redraw) home.redraw(); };

  function info(box) {
    const c = my.coven;
    const lvlFrac = c.need ? Math.max(0, Math.min(1, (c.xp - c.cur) / (c.need - c.cur))) : 1;
    const out = [
      h('div', { class: 'cv-head' }, emblem(c, 92),
        h('div', null,
          h('b', null, c.name),
          c.motto ? h('i', null, '«' + c.motto + '»') : null,
          h('small', null, '#' + c.id + ' · ' + c.members + '/' + MAX + ' участников · ' + (c.open ? 'открытый' : 'по заявкам')))),
      h('div', { class: 'cv-level' },
        h('span', { class: 'cv-lvl-badge' }, pic('coven/level'), h('b', null, String(c.level))),
        h('div', { class: 'cv-lvl-main' },
          h('div', { class: 'cv-lvl-top' }, h('b', null, 'Уровень ' + c.level), h('span', null, c.need ? Fmt.num(Math.floor(c.xp)) + ' / ' + Fmt.num(c.need) : 'максимум')),
          h('div', { class: 'cv-bar' }, h('i', { style: 'width:' + (lvlFrac * 100) + '%' })),
          h('small', null, 'Бонус всем участникам: ', h('b', null, '+' + c.bonus + '% к доходу'), ' · за неделю ' + Fmt.num(Math.floor(c.week)) + ' очк.'))),
      questCard(my.quest),
      h('p', { class: 'note center' }, 'Каждая минута в игре любого участника - очко ковену. Чем больше вас играет, тем быстрее растёт уровень.')
    ];
    if (my.requests && my.requests.length) {
      out.push(h('h3', { class: 'cv-sub' }, 'Заявки'), h('div', { class: 'cv-list' }, my.requests.map((r) => h('div', { class: 'cv-row' },
        h('span', { class: 'top-ava' }, h('img', { class: 'pic round', src: UI.avatarSrc(/^[a-z]\d\d$/.test(r.photo || '') ? r.photo : 'a01'), alt: '' })),
        h('div', { class: 'cv-info' }, h('b', null, r.name || 'Алхимик'), h('small', null, 'Ур. ' + (r.lvl || 1) + ' · ' + ((DATA.ranks[r.rank] || {}).name || ''))),
        h('button', { class: 'pill-btn', type: 'button', onclick: () => manage('accept', r.id) }, 'Принять'),
        h('button', { class: 'cv-x', type: 'button', 'aria-label': 'Отклонить', onclick: () => manage('decline', r.id) }, '✕')))));
    }
    const btns = h('div', { class: 'cv-btns' });
    if (my.role === 'leader') btns.append(h('button', { class: 'btn alt', type: 'button', onclick: () => { Sound.tap(); edit(); } }, 'Настроить'));
    btns.append(h('button', { class: 'btn alt', type: 'button', onclick: leave }, 'Покинуть'));
    out.push(btns);
    box.replaceChildren(...out);
  }

  async function manage(action, uid, fromMenu) {
    Sound.tap();
    let ok = true;
    try { await call('coven_manage', { p_action: action, p_uid: uid }); } catch (e) { UI.toast(errText(e)); ok = false; }
    if (ok) UI.toast({ accept: 'Принят в ковен', decline: 'Заявка отклонена', kick: 'Исключён', promote: 'Теперь заместитель', demote: 'Теперь участник', lead: 'Ты передал главенство' }[action] || 'Готово');
    if (fromMenu) { await refresh(); setTimeout(() => home('members'), 0); } else reopen();
  }

  function leave() {
    Sound.tap();
    const last = my.coven.members <= 1;
    UI.closeModal();
    setTimeout(() => UI.modal({ title: 'Покинуть ковен?', body: h('p', { class: 'center' }, last ? 'Ты последний в ковене - он будет распущен.' : my.role === 'leader' ? 'Главой станет заместитель или самый активный участник.' : 'Бонус ковена к доходу пропадёт.'),
      actions: [{ label: 'Покинуть', onClick: async () => {
        try { await call('coven_leave', {}); } catch (e) { UI.toast(errText(e)); return false; }
        await refresh(); UI.toast('Ты покинул ковен');
      } }, { label: 'Остаться', alt: true, onClick: () => { setTimeout(home, 0); } }] }), 0);
  }

  function edit() {
    const c = my.coven;
    UI.closeModal();
    const st = { name: c.name, emblem: c.emblem, color: c.color, open: c.open, motto: c.motto || '' };
    const btn = h('button', { class: 'btn cv-wide', type: 'button' }, 'Сохранить');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { await call('coven_edit', { p_motto: (st.motto || '').trim(), p_emblem: st.emblem, p_color: st.color, p_open: st.open }); } catch (e) { UI.toast(errText(e)); btn.disabled = false; return; }
      await refresh(); UI.toast('Сохранено'); UI.closeModal(); setTimeout(home, 0);
    });
    setTimeout(() => UI.modal({ title: 'Настройки ковена', sheet: true, cls: 'fixed-h cv-modal',
      body: h('div', { class: 'cv-wrap' }, h('div', { class: 'cv-box' }, form(st, false), btn,
        h('button', { class: 'btn alt cv-wide', type: 'button', onclick: () => { UI.closeModal(); setTimeout(home, 0); } }, 'Назад'))) }), 0);
  }

  // ---------- задание недели ----------
  const QUEST = {
    taps: { img: 'ui/ladle', name: 'Натапать котлом', unit: 'тапов' },
    brew: { img: 'ui/flask', name: 'Сварить зелья', unit: 'зелий' },
    serve: { img: 'ui/basket', name: 'Помочь жителям', unit: 'заказов' },
    play: { img: 'ui/hourglass', name: 'Провести время в лавке', unit: 'минут' }
  };
  function questCard(q) {
    if (!q) return null;
    const d = QUEST[q.type] || QUEST.taps;
    const frac = Math.max(0, Math.min(1, q.progress / q.target));
    return h('div', { class: 'cv-quest' + (q.done ? ' done' : '') },
      pic(q.done ? 'coven/chest_open' : 'coven/chest', 'cv-quest-chest'),
      h('div', { class: 'cv-lvl-main' },
        h('div', { class: 'cv-lvl-top' }, h('b', null, 'Задание недели'), h('span', null, q.done ? 'выполнено!' : Fmt.num(Math.floor(q.progress)) + ' / ' + Fmt.num(q.target))),
        h('div', { class: 'cv-q-name' }, pic(d.img, 'cv-q-ico'), d.name + ': ' + Fmt.num(q.target) + ' ' + d.unit),
        h('div', { class: 'cv-bar' }, h('i', { style: 'width:' + (frac * 100) + '%' })),
        h('small', null, q.done ? 'Награда уже в почте у всех, кто помогал.' : 'Твой вклад: ' + Fmt.num(Math.floor(q.mine || 0)) + '. Награда всем, кто помогал: 10 кристаллов и 4 часа дохода.')));
  }

  // ---------- босс выходных ----------
  const BOSS = {
    cauldron: { name: 'Тёмный котёл', say: 'Бульк-бульк! Ваши зелья скиснут!' },
    swamp: { name: 'Болотный дух', say: 'Кто топчет моё болото?!' },
    pumpkin: { name: 'Тыквенный король', say: 'На колени перед королём тыкв!' },
    frost: { name: 'Снежная ведьмочка', say: 'Заморожу все ваши котлы!' }
  };
  const dur = (sec) => { sec = Math.max(0, Math.floor(sec)); const d = Math.floor(sec / 86400), hh = Math.floor(sec % 86400 / 3600), mm = Math.floor(sec % 3600 / 60); return (d ? d + ' д ' : '') + (d || hh ? hh + ' ч ' : '') + mm + ' мин'; };
  function boss(box) {
    box.replaceChildren(h('p', { class: 'top-empty' }, 'Ищу босса...'));
    let st = null, pending = 0, hp = 0, flushing = false;
    const hpFill = h('i'), hpText = h('span', { class: 'cv-hp-text' }), mine = h('b'), arena = h('div', { class: 'cv-arena' });
    const sprite = h('img', { class: 'pic cv-boss', alt: '', draggable: 'false' });
    const fx = h('div', { class: 'cv-boss-fx' });
    const top = h('div', { class: 'cv-list cv-boss-top' });
    function drawHp() {
      const v = Math.max(0, hp - pending);
      hpFill.style.width = (100 * v / st.max_hp) + '%';
      hpText.textContent = Fmt.num(Math.ceil(v)) + ' / ' + Fmt.num(Math.ceil(st.max_hp));
    }
    function drawTop() {
      top.replaceChildren(...(st.top || []).map((t, i) => h('div', { class: 'cv-row' + (t.me ? ' me' : '') },
        h('span', { class: 'cv-place' }, String(i + 1)),
        h('span', { class: 'top-ava' }, h('img', { class: 'pic round', src: UI.avatarSrc(/^[a-z]\d\d$/.test(t.photo || '') ? t.photo : 'a01'), alt: '' })),
        h('div', { class: 'cv-info' }, h('b', null, t.name || 'Алхимик')),
        h('span', { class: 'cv-contrib' }, h('b', null, Fmt.num(Math.floor(t.dmg))), h('small', null, 'урона')))));
      if (!top.children.length) top.append(h('p', { class: 'note center' }, 'Пока никто не ударил. Будь первым!'));
    }
    async function flush() {
      if (flushing || pending <= 0 || !box.isConnected) return;
      flushing = true;
      const n = pending;
      let r;
      try { r = await call('boss_hit', { p_n: n }, 6000); } catch (e) { flushing = false; return; }
      pending = Math.max(0, pending - n);
      flushing = false;
      if (!r) return;
      hp = r.hp;
      if (r.dead) { win(); return; }
      drawHp();
    }
    function win() {
      clearInterval(poll); poll = 0;
      Sound.fanfare();
      UI.toast('Босс повержен! Сундуки - в почте');
      if (typeof Social !== 'undefined' && Platform.canStory() && st && st.boss) {
        const bn = (BOSS[st.boss] || BOSS.cauldron).name;
        setTimeout(() => Social.story('boss', { title: 'Босс повержен!', sub: bn + ' · ковен «' + ((my && my.coven && my.coven.name) || '') + '»', img: 'boss/' + st.boss + '_ko', bg: 'backgrounds/boss_arena' }).catch(() => {}), 1800);
      }
      setTimeout(() => { refresh().then(() => { if (box.isConnected) boss(box); }); }, 600);
    }
    function hit(e) {
      if (!st || st.dead || hp - pending <= 0) return;
      pending += 1;
      Sound.blub && Sound.blub();
      Platform.haptic();
      sprite.classList.remove('hit'); void sprite.offsetWidth; sprite.classList.add('hit');
      const r = arena.getBoundingClientRect();
      const x = (e.clientX || r.left + r.width / 2) - r.left, y = (e.clientY || r.top + r.height / 2) - r.top;
      const n = h('span', { class: 'cv-dmg', style: 'left:' + x + 'px;top:' + y + 'px' }, '-' + (1 + ((my.coven.level || 1) - 1) * 0.1).toFixed(1).replace('.0', '').replace('.', ','));
      fx.append(n); setTimeout(() => n.remove(), 900);
      drawHp();
      if (hp - pending <= 0) flush();
    }
    async function load() {
      try { st = await call('boss_state', {}); } catch (e) { box.replaceChildren(h('p', { class: 'top-empty' }, errText(e))); return; }
      if (!st) return;
      hp = st.hp || 0;
      const b = BOSS[st.boss || st.next] || BOSS.cauldron;
      if (!st.open) {
        box.replaceChildren(h('div', { class: 'cv-arena wait' },
          h('img', { class: 'pic cv-boss sleep', src: IMG('boss/' + (st.next || 'cauldron')), alt: '' }),
          h('div', { class: 'cv-boss-name' }, b.name)),
          h('p', { class: 'center cv-boss-info' }, 'Босс выходных придёт в пятницу. До битвы: ', h('b', null, dur(st.starts_in))),
          h('p', { class: 'note center' }, 'Бейте его тапами всем ковеном с пятницы по воскресенье. Победа - сундук с кристаллами каждому бойцу, тройке лучших - сундук героя.'));
        return;
      }
      if (st.dead) {
        box.replaceChildren(h('div', { class: 'cv-arena' }, h('img', { class: 'pic cv-boss', src: IMG('boss/' + st.boss + '_ko'), alt: '' }), h('div', { class: 'cv-boss-name' }, b.name + ' повержен!')),
          h('p', { class: 'center cv-boss-info' }, 'Награды уже в почте. Новый босс - в следующую пятницу.'),
          h('h3', { class: 'cv-sub' }, 'Лучшие бойцы'), top);
        drawTop();
        return;
      }
      sprite.src = IMG('boss/' + st.boss);
      arena.replaceChildren(sprite, fx, h('div', { class: 'cv-boss-name' }, b.name), h('div', { class: 'cv-boss-say' }, b.say));
      arena.onpointerdown = hit;
      box.replaceChildren(
        h('div', { class: 'cv-hp' }, h('div', { class: 'cv-hp-bar' }, hpFill), hpText),
        arena,
        h('p', { class: 'center cv-boss-info' }, 'Тапай по боссу! Твой урон: ', mine, ' · до конца ', dur(st.ends_in)),
        h('h3', { class: 'cv-sub' }, 'Лучшие бойцы'), top);
      mine.textContent = Fmt.num(Math.floor(st.mine || 0));
      drawHp(); drawTop();
    }
    load();
    poll = setInterval(async () => {
      await flush();
      if (!box.isConnected) return;
      try {
        const s2 = await call('boss_state', {}, 6000);
        if (s2 && st && !st.dead) { st.top = s2.top; st.mine = s2.mine; hp = Math.min(hp, s2.hp); mine.textContent = Fmt.num(Math.floor(s2.mine || 0)); drawTop(); drawHp(); if (s2.dead) win(); }
      } catch (e) { /* ignore */ }
    }, 2500);
  }

  // ---------- состав ----------
  function members(box) {
    const wk = (x) => Fmt.num(Math.floor(x || 0));
    const online = (iso) => iso && Date.now() - Date.parse(iso) < 5 * 60000;
    box.replaceChildren(h('p', { class: 'note center' }, 'Вклад за неделю: минуты в игре. Новая неделя - в понедельник.'),
      h('div', { class: 'cv-list' }, my.members.map((m, i) => {
        const canAct = m.id !== my.me && (my.role === 'leader' || (my.role === 'deputy' && m.role === 'member'));
        const row = h('div', { class: 'cv-row' + (m.id === my.me ? ' me' : '') + (canAct ? ' act' : '') },
          h('span', { class: 'cv-place' }, String(i + 1)),
          h('span', { class: 'top-ava' }, h('img', { class: 'pic round', src: UI.avatarSrc(/^[a-z]\d\d$/.test(m.photo || '') ? m.photo : 'a01'), alt: '' }), online(m.seen) ? h('i', { class: 'cv-on' }) : null),
          h('div', { class: 'cv-info' },
            h('b', null, m.role === 'leader' ? pic('coven/crown', 'cv-role') : m.role === 'deputy' ? pic('coven/deputy', 'cv-role') : null, m.name || 'Алхимик'),
            h('small', null, ROLE[m.role] + ' · ур. ' + (m.lvl || 1))),
          h('span', { class: 'cv-contrib' }, h('b', null, wk(m.week)), h('small', null, 'за неделю')));
        if (canAct) row.addEventListener('click', () => memberMenu(m));
        return row;
      })));
  }
  function memberMenu(m) {
    Sound.tap();
    const back = () => { setTimeout(() => home('members'), 0); };
    const acts = [];
    if (my.role === 'leader') {
      if (m.role === 'member') acts.push({ label: 'Сделать заместителем', onClick: () => { manage('promote', m.id, true); } });
      if (m.role === 'deputy') acts.push({ label: 'Сделать участником', alt: true, onClick: () => { manage('demote', m.id, true); } });
      acts.push({ label: 'Передать главенство', alt: true, onClick: () => { setTimeout(() => UI.modal({ title: 'Передать главенство?', body: h('p', { class: 'center' }, (m.name || 'Алхимик') + ' станет главой, а ты - заместителем.'),
        actions: [{ label: 'Передать', onClick: () => { manage('lead', m.id, true); } }, { label: 'Отмена', alt: true, onClick: back }] }), 0); } });
    }
    acts.push({ label: 'Исключить', alt: true, onClick: () => { manage('kick', m.id, true); } });
    acts.push({ label: 'Закрыть', alt: true, onClick: back });
    UI.closeModal();
    UI.modal({ title: m.name || 'Алхимик', body: h('p', { class: 'center' }, ROLE[m.role] + ' · вклад за неделю ' + Fmt.num(Math.floor(m.week || 0))), actions: acts });
  }

  // ---------- чат ----------
  function chat(box, foot) {
    const list = h('div', { class: 'cv-chat' }, h('p', { class: 'top-empty' }, 'Загружаю чат...'));
    const input = h('input', { class: 'cv-chat-input', type: 'text', maxlength: '300', placeholder: 'Сообщение ковену', enterkeyhint: 'send' });
    const send = h('button', { class: 'cv-send', type: 'button', 'aria-label': 'Отправить' }, pic('coven/send'));
    let last = 0, busy = false;
    const time = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    function bubble(m) {
      if (!m.uid) return h('div', { class: 'cv-sys' }, m.text);
      const b = h('div', { class: 'cv-msg' + (m.me ? ' mine' : '') },
        m.me ? null : h('span', { class: 'top-ava cv-msg-ava' }, h('img', { class: 'pic round', src: UI.avatarSrc(/^[a-z]\d\d$/.test(m.photo || '') ? m.photo : 'a01'), alt: '' })),
        h('div', { class: 'cv-bubble' }, m.me ? null : h('b', null, m.name || 'Алхимик'), h('span', null, m.text), h('small', null, time(m.at))));
      if (!m.me) b.addEventListener('click', () => {
        UI.closeModal();
        UI.modal({ title: 'Сообщение', body: h('p', { class: 'center' }, '«' + m.text + '»'), actions: [
          { label: 'Пожаловаться', onClick: async () => { try { await call('chat_report', { p_msg: m.id }); UI.toast('Жалоба отправлена модераторам'); } catch (e) { UI.toast(errText(e)); } setTimeout(() => home('chat'), 0); } },
          { label: 'Закрыть', alt: true, onClick: () => { setTimeout(() => home('chat'), 0); } }] });
      });
      return b;
    }
    async function load() {
      if (busy) return;
      busy = true;
      let rows;
      try { rows = await call('chat_list', { p_after: last }, 6000); } catch (e) { busy = false; if (!last) list.replaceChildren(h('p', { class: 'top-empty' }, errText(e))); return; }
      busy = false;
      if (!last) list.replaceChildren();
      if (!rows.length && !last && !list.children.length) list.replaceChildren(h('p', { class: 'top-empty' }, 'Здесь пока тихо. Поздоровайся!'));
      if (rows.length) {
        const empty = list.querySelector('.top-empty');
        if (empty) empty.remove();
        const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 40;
        rows.forEach((m) => list.append(bubble(m)));
        last = rows[rows.length - 1].id;
        if (last > lastSeenMsg) { lastSeenMsg = last; ls('bulk_chat_seen', String(last)); }
        if (atBottom || rows.length > 20) list.scrollTop = list.scrollHeight;
      }
    }
    async function doSend() {
      const t = input.value.trim();
      if (!t) return;
      send.disabled = true;
      try { await call('chat_send', { p_text: t }); input.value = ''; Sound.tap(); await load(); list.scrollTop = list.scrollHeight; }
      catch (e) { UI.toast(errText(e)); }
      send.disabled = false;
    }
    send.addEventListener('click', doSend);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSend(); } });
    box.replaceChildren(list);
    foot.replaceChildren(h('div', { class: 'cv-chat-bar' }, h('div', { class: 'cv-chat-field' }, input), send));
    load();
    poll = setInterval(load, 4000);
  }

  function start() {
    const btn = document.getElementById('coven-btn');
    if (btn) btn.addEventListener('click', () => { Sound.unlock(); Sound.tap(); open(); });
    badge();
    if (!Online.on()) return;
    setTimeout(refresh, 6000);
    setInterval(() => { if (!document.hidden) refresh(); }, 2 * 60000);
  }

  // для профиля: название ковена и роль игрока (или null)
  const mine = () => (my && my.coven ? { name: my.coven.name, role: my.role || '' } : null);

  return { start, open, refresh, emblem, mine };
})();

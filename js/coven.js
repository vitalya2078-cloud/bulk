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
    const wait = h('p', { class: 'top-empty' }, 'Открываю...');
    UI.modal({ title: 'Ковены', body: wait });
    await refresh();
    UI.closeModal();
    if (my && my.coven) home(); else browse();
  }

  // ---------- список ковенов (если ты не в ковене) ----------
  function browse(q) {
    const list = h('div', { class: 'cv-list' }, h('p', { class: 'top-empty' }, 'Ищу ковены...'));
    const search = h('input', { class: 'cv-input', type: 'search', placeholder: 'Название ковена', value: q || '' });
    let t = 0;
    search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => load(search.value), 400); });
    async function load(qq) {
      let rows;
      try { rows = await call('coven_list', { p_q: qq || '' }); } catch (e) { list.replaceChildren(h('p', { class: 'top-empty' }, errText(e))); return; }
      if (!rows || !rows.length) { list.replaceChildren(h('p', { class: 'top-empty' }, qq ? 'Ничего не нашлось' : 'Ковенов пока нет. Создай первый!')); return; }
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
            h('b', null, c.name),
            h('small', null, 'Ур. ' + c.level + ' · ' + c.members + '/' + MAX + ' · ' + (c.open ? 'открытый' : 'по заявкам')),
            c.motto ? h('i', null, c.motto) : null),
          btn);
      }));
    }
    UI.modal({
      title: 'Ковены', cls: 'cv-modal',
      body: h('div', null,
        h('div', { class: 'cv-hero' }, pic('ui/coven', 'cv-hero-ico'),
          h('p', null, 'Вступай в ковен: вместе быстрее растёт уровень, а каждый уровень даёт всем +2% к доходу. В ковене есть свой чат.')),
        search, list),
      actions: [{ label: 'Создать ковен · ' + COST, onClick: () => { setTimeout(create, 0); } }],
      onOpen: () => load(q)
    });
  }

  // ---------- создание ----------
  function create(prefill) {
    const st = Object.assign({ name: '', emblem: 'e01', color: 'purple', motto: '', open: true }, prefill || {});
    const name = h('input', { class: 'cv-input', maxlength: '20', placeholder: 'Название, 3-20 букв', value: st.name });
    const motto = h('input', { class: 'cv-input', maxlength: '80', placeholder: 'Девиз (можно пусто)', value: st.motto });
    const preview = h('div', { class: 'cv-preview' });
    const embs = h('div', { class: 'cv-embs' });
    const cols = h('div', { class: 'cv-cols' });
    const mode = h('div', { class: 'seg small-seg' });
    function draw() {
      preview.replaceChildren(emblem(st, 84), h('b', null, name.value.trim() || 'Мой ковен'));
      embs.replaceChildren(...EMBLEMS.map((e) => h('button', { class: 'cv-emb' + (st.emblem === e ? ' on' : ''), type: 'button', onclick: () => { st.emblem = e; Sound.tap(); draw(); } }, pic('coven/emblems/' + e))));
      cols.replaceChildren(...Object.keys(COLORS).map((k) => h('button', { class: 'cv-col' + (st.color === k ? ' on' : ''), type: 'button', style: 'background:' + COLORS[k], 'aria-label': k, onclick: () => { st.color = k; Sound.tap(); draw(); } })));
      mode.replaceChildren(...[[true, 'Открытый'], [false, 'По заявкам']].map(([v, l]) => h('button', { class: 'seg-btn' + (st.open === v ? ' on' : ''), type: 'button', onclick: () => { st.open = v; Sound.tap(); draw(); } }, l)));
    }
    name.addEventListener('input', () => { st.name = name.value; preview.querySelector('b').textContent = name.value.trim() || 'Мой ковен'; });
    motto.addEventListener('input', () => { st.motto = motto.value; });
    draw();
    UI.modal({
      title: 'Новый ковен', cls: 'cv-modal',
      body: h('div', { class: 'cv-create' }, preview,
        h('label', { class: 'cv-label' }, 'Название'), name,
        h('label', { class: 'cv-label' }, 'Девиз'), motto,
        h('label', { class: 'cv-label' }, 'Символ'), embs,
        h('label', { class: 'cv-label' }, 'Цвет'), cols,
        h('label', { class: 'cv-label' }, 'Вступление'), mode),
      actions: [{ label: 'Основать · ' + COST + ' кристаллов', onClick: async () => {
        const nm = name.value.trim();
        if (nm.length < 3) { UI.toast('Название от 3 до 20 букв'); return false; }
        if (Econ.s.cr < COST) { Sound.deny(); UI.toast('Нужно ' + COST + ' кристаллов'); return false; }
        try { await call('coven_create', { p_name: nm, p_emblem: st.emblem, p_color: st.color, p_motto: motto.value.trim(), p_open: st.open }); }
        catch (e) { UI.toast(errText(e)); return false; }
        Econ.addCrystals(-COST); save(); Sound.fanfare();
        UI.toast('Ковен «' + nm + '» основан!');
        await refresh();
        setTimeout(home, 0);
      } }, { label: 'Назад', alt: true, onClick: () => { setTimeout(() => browse(), 0); } }]
    });
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
      seg.replaceChildren(...[['info', 'Ковен', reqN], ['chat', 'Чат', unread ? '•' : 0], ['members', 'Состав', 0]].map(([id, l, n]) => h('button', {
        class: 'seg-btn' + (tab === id ? ' on' : ''), type: 'button', onclick: () => { if (tab !== id) { Sound.tap(); tab = id; draw(); } }
      }, l, n ? h('span', { class: 'seg-badge' }, String(n)) : null)));
      clearInterval(poll); poll = 0;
      foot.replaceChildren();
      if (tab === 'chat') { chat(box, foot); return; }
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
  const reopen = async (t) => { await refresh(); if (!my || !my.coven) { UI.closeModal(); setTimeout(() => browse(), 0); return; } if (t) tab = t; if (home.redraw) home.redraw(); };

  function info(box) {
    const c = my.coven;
    const lvlFrac = c.need ? Math.max(0, Math.min(1, (c.xp - c.cur) / (c.need - c.cur))) : 1;
    const out = [
      h('div', { class: 'cv-head' }, emblem(c, 92),
        h('div', null,
          h('b', null, c.name),
          c.motto ? h('i', null, '«' + c.motto + '»') : null,
          h('small', null, c.members + '/' + MAX + ' участников · ' + (c.open ? 'открытый' : 'по заявкам')))),
      h('div', { class: 'cv-level' },
        h('span', { class: 'cv-lvl-badge' }, pic('coven/level'), h('b', null, String(c.level))),
        h('div', { class: 'cv-lvl-main' },
          h('div', { class: 'cv-lvl-top' }, h('b', null, 'Уровень ' + c.level), h('span', null, c.need ? Fmt.num(Math.floor(c.xp)) + ' / ' + Fmt.num(c.need) : 'максимум')),
          h('div', { class: 'cv-bar' }, h('i', { style: 'width:' + (lvlFrac * 100) + '%' })),
          h('small', null, 'Бонус всем участникам: ', h('b', null, '+' + c.bonus + '% к доходу'), ' · за неделю ' + Fmt.num(Math.floor(c.week)) + ' очк.'))),
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
    const st = { emblem: c.emblem, color: c.color, open: c.open };
    const motto = h('input', { class: 'cv-input', maxlength: '80', value: c.motto || '', placeholder: 'Девиз' });
    const embs = h('div', { class: 'cv-embs' }), cols = h('div', { class: 'cv-cols' }), mode = h('div', { class: 'seg small-seg' }), preview = h('div', { class: 'cv-preview' });
    function draw() {
      preview.replaceChildren(emblem(st, 84), h('b', null, c.name));
      embs.replaceChildren(...EMBLEMS.map((e) => h('button', { class: 'cv-emb' + (st.emblem === e ? ' on' : ''), type: 'button', onclick: () => { st.emblem = e; draw(); } }, pic('coven/emblems/' + e))));
      cols.replaceChildren(...Object.keys(COLORS).map((k) => h('button', { class: 'cv-col' + (st.color === k ? ' on' : ''), type: 'button', style: 'background:' + COLORS[k], onclick: () => { st.color = k; draw(); } })));
      mode.replaceChildren(...[[true, 'Открытый'], [false, 'По заявкам']].map(([v, l]) => h('button', { class: 'seg-btn' + (st.open === v ? ' on' : ''), type: 'button', onclick: () => { st.open = v; draw(); } }, l)));
    }
    draw();
    setTimeout(() => UI.modal({ title: 'Настройки ковена', cls: 'cv-modal',
      body: h('div', { class: 'cv-create' }, preview, h('label', { class: 'cv-label' }, 'Девиз'), motto, h('label', { class: 'cv-label' }, 'Символ'), embs, h('label', { class: 'cv-label' }, 'Цвет'), cols, h('label', { class: 'cv-label' }, 'Вступление'), mode),
      actions: [{ label: 'Сохранить', onClick: async () => {
        try { await call('coven_edit', { p_motto: motto.value.trim(), p_emblem: st.emblem, p_color: st.color, p_open: st.open }); } catch (e) { UI.toast(errText(e)); return false; }
        await refresh(); UI.toast('Сохранено'); setTimeout(home, 0);
      } }, { label: 'Назад', alt: true, onClick: () => { setTimeout(home, 0); } }] }), 0);
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

  return { start, open, refresh };
})();

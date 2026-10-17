// =====================================================================
//  Топы игроков (0.13) - база Supabase.
//  Читать топ может кто угодно, записать очки - только игрок из Telegram:
//  база проверяет подпись Telegram (initData). Без сети/VPN игра работает как обычно.
// =====================================================================

CONFIG.tops = {
  url: 'https://ahqaficklfciahzlghec.supabase.co/rest/v1/rpc/',
  key: 'sb_publishable_IXd8i1DDSci-bdAZPOZciQ_wsCL9lOx',
  limit: 50,
  masteryEveryMin: 10 // как часто отправлять мастерство (если выросло)
};

const Tops = (() => {
  const T = CONFIG.tops;
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const tg = () => (window.Telegram && window.Telegram.WebApp) || null;
  const initData = () => { const t = tg(); return (t && t.initData) || ''; };
  const myId = () => { const t = tg(); return +((t && t.initDataUnsafe && t.initDataUnsafe.user && t.initDataUnsafe.user.id) || 0); };
  const canSubmit = () => Platform.kind() === 'tg' && !!initData();

  const BOARDS = [
    { id: 'mastery', period: 'all', tab: 'Мастерство', hint: 'Мастерство растёт вместе с эссенцией и уровнями карточек.' },
    { id: 'match3', period: 'week', tab: 'Полка: неделя', hint: 'Лучшая партия «Полки зелий» за эту неделю. Новая неделя - в понедельник.' },
    { id: 'match3', period: 'all', tab: 'Полка: рекорд', hint: 'Лучшая партия «Полки зелий» за всё время.' }
  ];

  async function rpc(fn, body, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), ms || 8000) : 0;
    try {
      const r = await fetch(T.url + fn, {
        method: 'POST',
        headers: { apikey: T.key, Authorization: 'Bearer ' + T.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctl ? ctl.signal : undefined
      });
      if (!r.ok) throw new Error(fn + ' ' + r.status);
      const txt = await r.text();
      return txt ? JSON.parse(txt) : null;
    } finally { if (tm) clearTimeout(tm); }
  }

  // ---------- отправка очков ----------
  const sent = {}; // лучшее, что уже ушло в базу за этот запуск
  function profileArgs() {
    const p = Econ.s.prof || {};
    return { p_name: (p.name || '').trim(), p_avatar: p.avatar === 'photo' ? '' : (p.avatar || '') };
  }
  async function submit(board, score) {
    score = Math.max(0, Math.floor(score || 0));
    if (!canSubmit() || !score || (sent[board] || 0) >= score) return false;
    try {
      await rpc('submit_score', Object.assign({ init_data: initData(), p_board: board, p_score: score }, profileArgs()));
      sent[board] = score;
      return true;
    } catch (e) { console.warn('tops', e); return false; }
  }
  const submitMastery = () => submit('mastery', Econ.mastery());
  // рекорд «Полки» (вызывается после партии; база сама держит лучший результат)
  const submitGame = (id, score) => submit(id, score);

  function start() {
    if (!canSubmit()) return;
    setTimeout(() => {
      submitMastery();
      const b = (Econ.s.mg && Econ.s.mg.best) || {};
      if (b.match3) submit('match3', b.match3);
    }, 15000);
    setInterval(submitMastery, T.masteryEveryMin * 60000);
  }

  // ---------- окно топа ----------
  let tab = 0;
  function avatar(photo) {
    let src;
    if (/^[a-z]\d\d$/.test(photo || '')) src = UI.avatarSrc(photo);
    else if (/^https:\/\//.test(photo || '')) src = photo;
    else src = UI.avatarSrc('a01');
    const img = h('img', { class: 'pic round', src, alt: '', draggable: 'false', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => { img.src = UI.avatarSrc('a01'); }, { once: true });
    return h('span', { class: 'top-ava' }, img);
  }
  function place(n) {
    return h('span', { class: 'top-place' + (n <= 3 ? ' m' + n : '') }, n === 1 ? pic('ui/crown', 'top-crown') : null, h('b', null, String(n)));
  }
  function row(r) {
    return h('div', { class: 'top-row' + (r.is_me ? ' me' : '') + (r.place <= 3 ? ' p' + r.place : '') },
      place(r.place), avatar(r.photo),
      h('span', { class: 'top-name' }, r.name || 'Алхимик'),
      h('b', { class: 'top-score' }, Fmt.num(r.score)));
  }

  function open(startTab) {
    if (typeof startTab === 'number') tab = startTab;
    const seg = h('div', { class: 'seg top-seg', role: 'tablist' });
    const hint = h('p', { class: 'note center' });
    const list = h('div', { class: 'top-list' });
    const mine = h('div', { class: 'top-mine' });
    const body = h('div', { class: 'tops' }, seg, hint, list, mine);
    let token = 0;

    function draw() {
      seg.replaceChildren(...BOARDS.map((b, i) => h('button', {
        class: 'seg-btn' + (i === tab ? ' on' : ''), type: 'button', role: 'tab',
        onclick: () => { if (i !== tab) { Sound.tap(); tab = i; draw(); } }
      }, b.tab)));
      load();
    }

    async function load() {
      const b = BOARDS[tab], my = token = token + 1;
      UI.setText(hint, b.hint);
      list.replaceChildren(h('p', { class: 'top-empty' }, 'Загружаю топ...'));
      mine.replaceChildren();
      // свой свежий результат - перед загрузкой, чтобы место было честным
      if (b.id === 'mastery') await submitMastery();
      let rows, me = null;
      try {
        [rows, me] = await Promise.all([
          rpc('get_top', { p_board: b.id, p_period: b.period, p_limit: T.limit, p_me: myId() }),
          myId() ? rpc('get_my_place', { p_board: b.id, p_period: b.period, p_me: myId() }).catch(() => null) : null
        ]);
      } catch (e) {
        if (my !== token) return;
        list.replaceChildren(h('div', { class: 'top-empty' },
          h('p', null, 'Топ сейчас недоступен.'),
          h('small', null, 'Проверь интернет и загляни чуть позже.')));
        return;
      }
      if (my !== token) return;
      rows = rows || [];
      if (!rows.length) list.replaceChildren(h('p', { class: 'top-empty' }, b.id === 'match3' ? 'Пока никто не играл. Стань первым на полке!' : 'Пока здесь пусто. Стань первым!'));
      else list.replaceChildren(...rows.map(row));
      const m = me && me[0];
      if (m && (m.place > 8 || !rows.some((r) => r.is_me))) {
        mine.replaceChildren(row({ place: m.place, name: (Econ.s.prof && Econ.s.prof.name) || 'Ты', photo: profileArgs().p_avatar, score: m.score, is_me: true }));
      } else if (!m) {
        mine.replaceChildren(h('p', { class: 'note center' }, !canSubmit()
          ? 'Попасть в топ можно, когда играешь через Telegram.'
          : b.id === 'match3' ? 'Сыграй в «Полку зелий», чтобы попасть в топ.' : 'Твой результат появится здесь чуть позже.'));
      }
    }

    UI.modal({ title: 'Топ алхимиков', cls: 'tops-modal', body, onOpen: draw });
  }

  return { open, start, submitMastery, submitGame };
})();

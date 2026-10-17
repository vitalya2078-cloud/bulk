// =====================================================================
//  Топ алхимиков (0.16) - база Supabase, общий для ВК и Telegram.
//  Богачи - эссенция на счету сейчас; Сутки / Неделя / Месяц - сколько
//  сварено за период (база сама запоминает, сколько было в начале периода).
//  Очки отдельно не отправляются: их приносит обычный отчёт игры (Online.hello).
// =====================================================================

CONFIG.tops = {
  url: 'https://ahqaficklfciahzlghec.supabase.co/rest/v1/rpc/',
  key: 'sb_publishable_IXd8i1DDSci-bdAZPOZciQ_wsCL9lOx',
  limit: 50
};

const Tops = (() => {
  const T = CONFIG.tops;
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);

  const BOARDS = [
    { id: 'rich', tab: 'Богачи', hint: 'У кого больше всего эссенции прямо сейчас.' },
    { id: 'day', tab: 'Сутки', hint: 'Сколько эссенции сварено сегодня. Новые сутки - в полночь по Москве.' },
    { id: 'week', tab: 'Неделя', hint: 'Сварено за эту неделю. Новая неделя - в понедельник.' },
    { id: 'month', tab: 'Месяц', hint: 'Сварено за этот месяц.' }
  ];

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

  function avatar(photo) {
    let src;
    if (/^[a-z]\d\d$/.test(photo || '')) src = UI.avatarSrc(photo);
    else if (/^https:\/\//.test(photo || '')) src = photo;
    else src = UI.avatarSrc('a01');
    const img = h('img', { class: 'pic round', src, alt: '', draggable: 'false', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => { img.src = UI.avatarSrc('a01'); }, { once: true });
    return h('span', { class: 'top-ava' }, img);
  }
  const place = (n) => h('span', { class: 'top-place' + (n <= 3 ? ' m' + n : '') }, n === 1 ? pic('ui/crown', 'top-crown') : null, h('b', null, String(n)));
  function row(r) {
    return h('div', { class: 'top-row' + (r.is_me ? ' me' : '') + (r.place <= 3 ? ' p' + r.place : '') },
      place(r.place), avatar(r.photo),
      h('span', { class: 'top-name' }, r.name || 'Алхимик'),
      h('span', { class: 'top-score' }, pic('ui/essence', 'top-ess'), h('b', null, Fmt.num(r.score))));
  }

  let tab = 0;
  function open(startTab) {
    if (typeof startTab === 'number') tab = startTab;
    const seg = h('div', { class: 'seg top-seg', role: 'tablist' });
    const hint = h('p', { class: 'note center' });
    const list = h('div', { class: 'top-list' });
    const mine = h('div', { class: 'top-mine' });
    let token = 0;

    function draw() {
      seg.replaceChildren(...BOARDS.map((b, i) => h('button', {
        class: 'seg-btn' + (i === tab ? ' on' : ''), type: 'button', role: 'tab',
        onclick: () => { if (i !== tab) { Sound.tap(); tab = i; draw(); } }
      }, b.tab)));
      load();
    }

    async function load() {
      const b = BOARDS[tab], my = ++token;
      UI.setText(hint, b.hint);
      list.replaceChildren(h('p', { class: 'top-empty' }, 'Загружаю топ...'));
      mine.replaceChildren();
      // свежие цифры - перед загрузкой, чтобы своё место было честным
      if (typeof Online !== 'undefined') { try { await Online.hello(false, true); } catch (e) { /* ignore */ } }
      let r;
      try { r = await rpc('top_list', { p_board: b.id, p_limit: T.limit, p_me: (typeof Online !== 'undefined' && Online.uid()) || 0 }); } catch (e) {
        if (my !== token) return;
        list.replaceChildren(h('div', { class: 'top-empty' }, h('p', null, 'Топ сейчас недоступен.'), h('small', null, 'Проверь интернет и загляни чуть позже.')));
        return;
      }
      if (my !== token) return;
      const rows = (r && r.rows) || [];
      if (!rows.length) list.replaceChildren(h('p', { class: 'top-empty' }, b.id === 'rich' ? 'Пока здесь пусто. Стань первым!' : 'За этот период пока никто ничего не сварил. Самое время!'));
      else list.replaceChildren(...rows.map(row));
      const m = r && r.me;
      if (m && (m.place > 8 || !rows.some((x) => x.is_me))) {
        const s = Econ.s;
        mine.replaceChildren(row({ place: m.place, name: s.prof.name || 'Ты', photo: s.prof.avatar === 'photo' ? '' : s.prof.avatar, score: m.score, is_me: true }));
      } else if (!m) {
        mine.replaceChildren(h('p', { class: 'note center' }, typeof Online !== 'undefined' && Online.on()
          ? 'Ты появишься в этом топе, когда сваришь эссенцию за этот период.'
          : 'Попасть в топ можно, когда играешь во ВКонтакте или Telegram.'));
      }
    }

    UI.modal({ title: 'Топ алхимиков', sheet: true, cls: 'fixed-h tops-modal', body: h('div', { class: 'tops cv-wrap' }, seg, hint, h('div', { class: 'cv-box' }, list, mine)), onOpen: draw });
  }

  return { open };
})();

// =====================================================================
//  Связь с базой (0.14): статистика игрока, почта с подарками, правки
//  от администратора, бан, объявления и бонус дохода.
//  Работает только в Telegram (база проверяет подпись). Без сети игра идёт как обычно.
// =====================================================================

const Online = (() => {
  const T = CONFIG.tops;
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const tg = () => (window.Telegram && window.Telegram.WebApp) || null;
  const initData = () => { const t = tg(); return (t && t.initData) || ''; };
  const on = () => Platform.kind() === 'tg' && !!initData();
  const save = () => { if (window.Game) Game.save(); };
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; };

  let state = { admin: false, mail: 0, banned: false, settings: {} };
  const applied = new Set(); // правки, уже применённые в этом запуске

  async function rpc(fn, body, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), ms || 10000) : 0;
    try {
      const r = await fetch(T.url + fn, {
        method: 'POST',
        headers: { apikey: T.key, Authorization: 'Bearer ' + T.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined
      });
      if (!r.ok) throw new Error(fn + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
      const txt = await r.text();
      return txt ? JSON.parse(txt) : null;
    } finally { if (tm) clearTimeout(tm); }
  }

  // ---------- отчёт о себе ----------
  function stats(start) {
    const s = Econ.s;
    let saveObj = null;
    try { saveObj = JSON.parse(Econ.serialize()); } catch (e) { /* ignore */ }
    return {
      start: start ? '1' : '0', ver: CONFIG.version,
      name: (s.prof.name || '').trim(), avatar: s.prof.avatar === 'photo' ? '' : s.prof.avatar,
      lvl: s.lvl, rank: Econ.rank(), le: Math.floor(s.le), e: Math.floor(s.e), ph: Math.floor(Econ.basePerHour()),
      cr: s.cr, mastery: Econ.mastery(), play: Math.floor(s.stat.play || 0),
      ref: start ? Platform.referrer() : '', save: saveObj
    };
  }

  let lastHello = 0;
  async function hello(start) {
    if (!on()) return;
    if (!start && Date.now() - lastHello < 60000) return;
    lastHello = Date.now();
    let r;
    try { r = await rpc('hello', { init_data: initData(), p: stats(start) }); } catch (e) { console.warn('online', e); return; }
    if (!r) return;
    state = { admin: !!r.admin, mail: +r.mail || 0, banned: !!r.banned, settings: r.settings || {}, reason: r.reason || '' };
    applySettings(start);
    if (state.banned) { banScreen(state.reason); return; }
    if (Array.isArray(r.patches)) for (const p of r.patches) await applyPatch(p);
    badge();
  }

  // ---------- бан и техработы ----------
  let blocked = null;
  function banScreen(reason, maint) {
    if (blocked) return;
    blocked = h('div', { class: 'ban-screen' },
      h('div', { class: 'ban-box' },
        pic(maint ? 'ui/hammer' : 'ui/padlock', 'ban-ico'),
        h('h2', null, maint ? 'Лавка на ремонте' : 'Доступ закрыт'),
        h('p', null, reason || (maint ? 'Мы немножко подкручиваем котёл. Загляни чуть позже!' : 'Твой аккаунт заблокирован в игре.')),
        maint ? null : h('small', null, 'Если это ошибка, напиши в бота «Бульк».')));
    document.body.append(blocked);
  }

  // ---------- настройки из админки ----------
  function applySettings(start) {
    const st = state.settings || {};
    const b = st.boost;
    const until = b && b.until ? Date.parse(b.until) : 0;
    const live = b && +b.mult > 1 && until > Date.now();
    const was = Econ.globalMul();
    Econ.setGlobalMul(live ? +b.mult : 1);
    if (live && (start || was === 1)) setTimeout(() => UI.toast('Бонус лавки: доход x' + (+b.mult) + (b.label ? ' - ' + b.label : '') + '!'), 1500);
    if (st.maint && st.maint.on && !state.admin) banScreen(st.maint.text, true);
    const a = st.announce;
    if (a && a.id && a.text && ls('bulk_ann') !== String(a.id)) {
      ls('bulk_ann', String(a.id));
      setTimeout(() => UI.modal({ title: a.title || 'Новости лавки', body: h('p', { class: 'center ann-text' }, a.text), actions: [{ label: 'Понятно' }] }), start ? 2500 : 0);
    }
  }

  // ---------- правки сохранения ----------
  async function applyPatch(p) {
    if (!p || applied.has(p.id)) return;
    applied.add(p.id);
    const o = p.ops || {}, s = Econ.s, msg = [];
    const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
    if (o.reset) {
      try { await rpc('patch_done', { init_data: initData(), p_id: p.id }); } catch (e) { return; }
      Econ.reset(); save();
      UI.modal({ title: 'Прогресс сброшен', closable: false, body: h('p', { class: 'center' }, 'Администратор начал твою лавку заново.'),
        actions: [{ label: 'Начать', onClick: () => { location.reload(); } }] });
      return;
    }
    if (num(o.set_cr) !== null) s.cr = Math.max(0, Math.floor(o.set_cr));
    if (num(o.add_cr)) { s.cr = Math.max(0, s.cr + Math.floor(o.add_cr)); msg.push((o.add_cr > 0 ? '+' : '') + o.add_cr + ' ' + UI.crystalsWord(Math.abs(o.add_cr))); }
    if (num(o.set_e) !== null) s.e = Math.max(0, o.set_e);
    if (num(o.add_e)) { s.e = Math.max(0, s.e + o.add_e); if (o.add_e > 0) s.le += o.add_e; msg.push((o.add_e > 0 ? '+' : '') + Fmt.num(o.add_e) + ' эссенции'); }
    if (num(o.add_ess_h) > 0) { const v = Econ.hoursOfIncome(o.add_ess_h, 1000); Econ.earn(v); msg.push('+' + Fmt.num(v) + ' эссенции'); }
    if (num(o.set_le) !== null) s.le = Math.max(0, o.set_le);
    if (num(o.set_lvl) !== null) { s.lvl = Math.max(1, Math.floor(o.set_lvl)); s.xp = 0; }
    if (typeof o.set_name === 'string' && o.set_name.trim()) Econ.setName(o.set_name);
    save();
    try { await rpc('patch_done', { init_data: initData(), p_id: p.id }); } catch (e) { /* применится и отметится в следующий раз - не страшно: повтор отсекает applied */ }
    if (Econ.checkRankUp) Econ.checkRankUp();
    UI.refresh(true);
    UI.toast(msg.length ? 'Подарок от лавки: ' + msg.join(', ') : 'Администратор обновил твою лавку');
  }

  // ---------- почта ----------
  function badge() {
    const b = document.getElementById('mail-btn');
    if (!b) return;
    b.hidden = !on();
    const n = b.querySelector('b');
    if (n) { n.hidden = !state.mail; n.textContent = state.mail > 9 ? '9+' : String(state.mail || ''); }
  }

  function giftLine(g) {
    if (!g) return null;
    const parts = [];
    if (g.cr) parts.push(h('span', null, UI.money(g.cr, 'ui/crystal')));
    if (g.ess_h) parts.push(h('span', null, UI.money(UI.ess(Econ.hoursOfIncome(g.ess_h, 1000)))));
    return parts.length ? h('div', { class: 'reward-list mail-gift' }, parts) : null;
  }
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); };

  async function openMail() {
    if (!on()) { UI.toast('Почта работает в Telegram'); return; }
    const list = h('div', { class: 'mail-list' }, h('p', { class: 'top-empty' }, 'Открываю почту...'));
    UI.modal({ title: 'Почта', cls: 'mail-modal', body: list });
    let rows;
    try { rows = await rpc('mail_list', { init_data: initData() }); } catch (e) {
      list.replaceChildren(h('div', { class: 'top-empty' }, h('p', null, 'Почта сейчас недоступна.'), h('small', null, 'Проверь интернет и загляни позже.')));
      return;
    }
    rows = rows || [];
    if (!rows.length) { list.replaceChildren(h('p', { class: 'top-empty' }, 'Писем пока нет. Сова принесёт, когда будут!')); return; }
    list.replaceChildren(...rows.map((m) => {
      const fresh = !m.read || (m.gift && Object.keys(m.gift).length && !m.claimed);
      const b = h('button', { class: 'mail-row' + (fresh ? ' new' : ''), type: 'button' },
        pic(m.gift && Object.keys(m.gift).length ? (m.claimed ? 'ui/check' : 'ui/gift') : 'ui/envelope', 'mail-ico'),
        h('span', { class: 'mail-info' }, h('b', null, m.title), h('small', null, (m.personal ? 'Лично тебе · ' : '') + when(m.at))),
        fresh ? h('i', { class: 'mail-dot' }) : null);
      b.addEventListener('click', () => { Sound.tap(); UI.closeModal(); setTimeout(() => letter(m), 0); });
      return b;
    }));
  }

  function letter(m) {
    const hasGift = m.gift && Object.keys(m.gift).length;
    if (!m.read) { m.read = true; rpc('mail_read', { init_data: initData(), p_id: m.id }).then(() => hello(false)).catch(() => {}); }
    const actions = [];
    if (hasGift && !m.claimed) {
      actions.push({ label: 'Забрать подарок', onClick: async () => {
        let g;
        try { g = await rpc('mail_claim', { init_data: initData(), p_id: m.id }); } catch (e) {
          UI.toast(/no gift/.test(String(e)) ? 'Подарки из общих писем для тебя недоступны' : 'Не получилось, попробуй позже'); return false;
        }
        m.claimed = true;
        if (g) {
          const got = [];
          if (g.cr) { Econ.addCrystals(g.cr); got.push('+' + g.cr + ' ' + UI.crystalsWord(g.cr)); }
          if (g.ess_h) { const v = Econ.hoursOfIncome(g.ess_h, 1000); Econ.earn(v); got.push('+' + Fmt.num(v) + ' эссенции'); }
          Sound.coin(); save(); UI.refresh(true);
          if (got.length) UI.toast('Получено: ' + got.join(', '));
        }
        hello(false);
        setTimeout(openMail, 0);
      } });
    }
    actions.push({ label: 'К письмам', alt: true, onClick: () => { setTimeout(openMail, 0); } });
    UI.modal({ title: m.title, cls: 'mail-letter', body: h('div', { class: 'letter' },
      h('p', { class: 'letter-text' }, m.body || ''),
      hasGift ? h('div', { class: 'letter-gift' + (m.claimed ? ' done' : '') }, h('small', null, m.claimed ? 'Подарок получен' : 'В письме подарок'), giftLine(m.gift)) : null,
      h('small', { class: 'letter-date' }, when(m.at))), actions });
  }

  function start() {
    const b = document.getElementById('mail-btn');
    if (b) b.addEventListener('click', () => { Sound.unlock(); Sound.tap(); openMail(); });
    badge();
    if (!on()) return;
    setTimeout(() => hello(true), 4000);
    setInterval(() => { if (!document.hidden) hello(false); }, 5 * 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) hello(false); });
  }

  return { start, openMail, isAdmin: () => state.admin, hello };
})();

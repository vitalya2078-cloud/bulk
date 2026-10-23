// =====================================================================
//  Связь с базой (0.14): статистика игрока, почта с подарками, правки
//  от администратора, бан, объявления и бонус дохода.
//  0.16: один аккаунт на ВК и Telegram (привязка кодом), сохранение в базе,
//  одна активная сессия: открыл игру на другом устройстве - здесь игра встаёт на паузу.
//  База проверяет подпись платформы. Без сети игра идёт как обычно.
// =====================================================================

const Online = (() => {
  const T = CONFIG.tops;
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const initData = () => Platform.authData();
  const on = () => !!initData();
  const SESS = Math.random().toString(36).slice(2) + Date.now().toString(36);
  let kicked = false, uid = 0;
  let platPhoto = ''; // фото из ВК / Telegram - его показываем другим игрокам (топы, ковен)
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
  function stats(start, claim) {
    const s = Econ.s;
    let saveObj = null;
    try { saveObj = JSON.parse(Econ.serialize()); } catch (e) { /* ignore */ }
    return {
      start: start ? '1' : '0', claim: claim ? '1' : '0', sess: SESS, ver: CONFIG.version,
      name: (s.prof.name || '').trim(), avatar: s.prof.avatar === 'photo' ? '' : s.prof.avatar,
      photo: s.set.hidePhoto ? '' : platPhoto, nophoto: s.set.hidePhoto ? '1' : '0',
      lvl: s.lvl, rank: Econ.rank(), le: Math.floor(s.le), e: Math.floor(s.e), ph: Math.floor(Econ.basePerHour()),
      cr: s.cr, mastery: Econ.mastery(), play: Math.floor(s.stat.play || 0),
      ref: start ? Platform.referrer() : '', save: saveObj
    };
  }

  // claimed - база подтвердила, что играем здесь. Пока нет - каждый отчёт снова заявляет сессию:
  // иначе после оборванного первого отчёта база считала этот же телефон «другим местом».
  let lastHello = 0, claimed = false;
  let linked = null; // какие платформы привязаны к аккаунту (из базы)
  async function hello(start, force) {
    if (!on() || kicked) return;
    if (!start && Date.now() - lastHello < (force ? 5000 : 45000)) return;
    lastHello = Date.now();
    let r;
    const claim = !claimed;
    try { r = await rpc('hello', { init_data: initData(), p: stats(start, claim) }); } catch (e) { console.warn('online', e); return; }
    if (!r) return;
    if (r.uid) { uid = r.uid; Platform.setUid(uid); }
    linked = { tg: !!r.tg, vk: !!r.vk };
    if (r.kicked) { kickScreen(); return; }
    if (claim) claimed = true;
    if (r.restore && adopt(r.restore, true)) {
      restoredModal('Лавка нашлась!', 'Игра открылась без твоего сохранения, но котёл всё помнит. Возвращаем твой прогресс.');
      return;
    }
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

  // ---------- игра открыта на другом устройстве ----------
  function kickScreen() {
    if (kicked) return;
    kicked = true;
    const box = h('div', { class: 'ban-screen' },
      h('div', { class: 'ban-box' },
        pic('ui/phone', 'ban-ico'),
        h('h2', null, 'Лавка открыта в другом месте'),
        h('p', null, 'Игру открыли ещё раз: на другом устройстве, в другом приложении или в соседнем окне. Играть сразу в двух местах нельзя, чтобы прогресс не перепутался.'),
        h('button', { class: 'btn', type: 'button', onclick: () => { location.reload(); } }, 'Играть здесь')));
    document.body.append(box);
  }

  // сохранение из базы: при запуске берём самое свежее (локальное, облако платформы, база)
  // null - в базе сохранения нет, undefined - база не ответила
  async function loadServer(ms) {
    if (!on()) return null;
    try {
      const r = await rpc('load_save', { init_data: initData() }, ms || 8000);
      if (r && r.uid) { uid = r.uid; Platform.setUid(uid); }
      return r && r.save && typeof r.save === 'object' ? r.save : null;
    } catch (e) { console.warn('online load', e); return undefined; }
  }

  // ---------- возврат настоящего сохранения ----------
  // База не приняла копию (игра открылась без сохранения или это копия другой игры) и прислала свою -
  // или админ вернул копию из истории. Загружаем её, сохраняем везде и перезапускаем лавку.
  let restoring = false;
  function adopt(sv, mine) {
    if (restoring || !sv || typeof sv !== 'object') return false;
    restoring = true;
    Econ.load(sv);
    if (!mine) Econ.s.stat.wipe = Date.now(); // копия из истории - «другая игра», база должна её принять
    save();
    return true;
  }
  function restoredModal(title, text) {
    UI.modal({ title, closable: false, body: h('p', { class: 'center' }, text),
      actions: [{ label: 'Продолжить', onClick: () => { setTimeout(() => location.reload(), 300); } }] });
  }

  // ---------- привязка ВК и Telegram ----------
  const PLAT = { tg: 'Telegram', vk: 'ВКонтакте' };
  const RANKS = () => (DATA.ranks || []).map((r) => r.name);
  function linkDialog() {
    if (!on()) { UI.toast('Привязка работает в ВК и Telegram'); return; }
    const other = Platform.kind() === 'tg' ? 'ВКонтакте' : 'Telegram';
    UI.modal({
      title: 'Один прогресс',
      body: h('div', { class: 'link-box' },
        h('p', { class: 'center' }, 'Играй и в Telegram, и во ВКонтакте с одним прогрессом. Сразу в двух местах играть нельзя: открыл в одном - в другом лавка встанет на паузу.'),
        h('div', { class: 'link-steps' },
          h('p', null, h('b', null, '1. '), 'Здесь нажми «Получить код».'),
          h('p', null, h('b', null, '2. '), 'Открой игру в ' + other + ': Настройки → «Один прогресс» → «Ввести код».'))),
      actions: [
        { label: 'Получить код', onClick: async () => {
          let c;
          try { c = await rpc('link_code', { init_data: initData() }); } catch (e) { UI.toast('Не получилось, попробуй позже'); return false; }
          setTimeout(() => showCode(c), 0);
        } },
        { label: 'Ввести код', alt: true, onClick: () => { setTimeout(enterCode, 0); } }
      ]
    });
  }
  function showCode(c) {
    UI.modal({ title: 'Твой код', body: h('div', { class: 'center' },
      h('div', { class: 'link-code' }, String(c).replace(/(\d{3})(\d{3})/, '$1 $2')),
      h('p', null, 'Введи его в игре на другой платформе. Код действует 10 минут.')), actions: [{ label: 'Готово' }] });
  }
  // ---------- код для входа в приложение админки (только команда) ----------
  const APK = 'https://github.com/vitalya2078-cloud/bulk/releases/download/admin-apk/bulk-admin.apk';
  async function admCode() {
    let r;
    try { r = await rpc('adm_login_code', { init_data: initData() }); } catch (e) { UI.toast('Не получилось, попробуй позже'); return; }
    let left = r.ttl || 300, tm = 0;
    const timer = h('b', null, '');
    const tick = () => { UI.setText(timer, Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0')); if (left-- <= 0) { clearInterval(tm); UI.setText(timer, 'код устарел'); } };
    const openApk = () => { try { if (window.Telegram && Telegram.WebApp && Telegram.WebApp.openLink) { Telegram.WebApp.openLink(APK); return; } } catch (e) { /* ignore */ } window.open(APK, '_blank'); };
    UI.modal({ title: 'Вход в админку', body: h('div', { class: 'center' },
      h('div', { class: 'link-code' }, String(r.code).replace(/(\d{3})(\d{3})/, '$1 $2')),
      h('p', null, 'Введи код в приложении «Бульк Админ». Действует ещё ', timer, '.'),
      h('p', { class: 'small' }, 'Код покажи только себе: он открывает админку.')),
      onOpen: () => { tick(); tm = setInterval(tick, 1000); },
      onClose: () => clearInterval(tm),
      actions: [{ label: 'Готово' }, { label: 'Скачать приложение', alt: true, onClick: () => { openApk(); return false; } }] });
  }

  function enterCode() {
    const input = h('input', { class: 'link-input', type: 'text', inputmode: 'numeric', maxlength: '7', placeholder: '000 000', autocomplete: 'off' });
    UI.modal({ title: 'Ввести код', body: h('div', { class: 'center' }, h('p', null, 'Код из игры на другой платформе:'), input),
      onOpen: () => setTimeout(() => input.focus(), 200),
      actions: [{ label: 'Дальше', onClick: async () => {
        const code = input.value.replace(/\D/g, '');
        if (code.length !== 6) { UI.toast('В коде 6 цифр'); return false; }
        let info;
        try { info = await rpc('link_info', { init_data: initData(), p_code: code }); } catch (e) {
          const m = String(e);
          UI.toast(/bad code/.test(m) ? 'Код не подходит или устарел' : /same platform/.test(m) ? 'Этот аккаунт уже привязан к такой платформе' : /same account/.test(m) ? 'Это код этого же аккаунта' : 'Не получилось, попробуй позже');
          return false;
        }
        setTimeout(() => chooseKeep(code, info), 0);
      } }, { label: 'Отмена', alt: true }] });
  }
  function chooseKeep(code, info) {
    const card = (x, title, keep) => h('button', { class: 'link-card', type: 'button', onclick: async () => {
      UI.closeModal();
      setTimeout(() => UI.modal({ title: 'Точно?', body: h('p', { class: 'center' }, 'Останется прогресс «' + title + '». Второй прогресс пропадёт навсегда.'),
        actions: [{ label: 'Объединить', onClick: () => apply(code, keep) }, { label: 'Отмена', alt: true }] }), 0);
    } },
      h('small', null, title), h('b', null, x.name || 'Алхимик'),
      h('span', null, 'Уровень ' + x.lvl + ' · ' + (RANKS()[x.rank] || '')),
      h('span', null, 'Сварено ' + Fmt.num(x.le) + ' · ' + x.cr + ' ' + UI.crystalsWord(x.cr)));
    UI.modal({ title: 'Какой прогресс оставить?', body: h('div', { class: 'link-choose' },
      card(info.mine, 'Здесь, ' + (PLAT[info.mine.platform] || ''), 'mine'),
      card(info.other, PLAT[info.other.platform] || 'Другой', 'other'),
      h('p', { class: 'small center' }, 'Нажми на тот, который хочешь сохранить.')), actions: [{ label: 'Отмена', alt: true }] });
  }
  async function apply(code, keep) {
    let r;
    try { r = await rpc('link_apply', { init_data: initData(), p_code: code, p_keep: keep }); } catch (e) { UI.toast('Не получилось, попробуй позже'); return false; }
    // дальше играем с общим прогрессом: кладём его локально как самый свежий и перезапускаем
    kicked = true;
    if (r && r.save) {
      const sv = Object.assign({}, r.save, { ts: Date.now() });
      const str = JSON.stringify(sv);
      try { localStorage.setItem(CONFIG.saveKey, str); } catch (e) { /* ignore */ }
      try { Platform.storageSet(CONFIG.saveKey, str); } catch (e) { /* ignore */ }
    }
    UI.modal({ title: 'Готово!', closable: false, body: h('p', { class: 'center' }, 'Аккаунты связаны. Теперь прогресс общий для ВКонтакте и Telegram.'),
      actions: [{ label: 'Продолжить', onClick: () => { setTimeout(() => location.reload(), 300); } }] });
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
    // уже применена (отметка в базу не дошла) - только отмечаем, второй раз не начисляем
    if (!Array.isArray(Econ.s.pd)) Econ.s.pd = [];
    if (Econ.s.pd.includes(p.id)) { rpc('patch_done', { init_data: initData(), p_id: p.id }).catch(() => {}); return; }
    const done = () => { if (!Array.isArray(Econ.s.pd)) Econ.s.pd = []; Econ.s.pd.push(p.id); Econ.s.pd = Econ.s.pd.slice(-50); };
    const o = p.ops || {}, s = Econ.s, msg = [];
    const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
    if (o.restore) {
      if (!adopt(o.restore, false)) return;
      done(); save();
      // сразу отдаём базе - чтобы копия не потерялась, даже если телефон не сохранит её у себя
      try { await rpc('hello', { init_data: initData(), p: stats(false) }); } catch (e) { /* уйдёт со следующим отчётом */ }
      try { await rpc('patch_done', { init_data: initData(), p_id: p.id }); } catch (e) { /* ignore */ }
      restoredModal('Лавка восстановлена', 'Администратор вернул твою лавку из сохранения. Можно продолжать!');
      return;
    }
    if (o.reset) {
      try { await rpc('patch_done', { init_data: initData(), p_id: p.id }); } catch (e) { return; }
      Econ.reset(); done(); save();
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
    done();
    save();
    try { await rpc('patch_done', { init_data: initData(), p_id: p.id }); } catch (e) { /* отметится в следующий раз; второй раз не начислится - номер правки уже в сохранении (pd) */ }
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
    UI.modal({ title: 'Почта', sheet: true, cls: 'fixed-h mail-modal', body: h('div', { class: 'cv-wrap' }, h('div', { class: 'cv-box' }, list)) });
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

  // ---------- напоминания: когда что случится (база пришлёт сообщение, если игрок не в игре) ----------
  function notifyPush(leaving) {
    if (!on()) return;
    const s = Econ.s;
    const t = (typeof Pets !== 'undefined' && Pets.timers) ? Pets.timers() : { pet: 0, egg: 0 };
    const full = leaving ? (Date.now() + Econ.pantryHours() * 3600000) / 1000 : 0;
    rpc('notify_set', { init_data: initData(), p: { on: !!s.set.notif, full, pet: t.pet / 1000, egg: t.egg / 1000 } }, 6000).catch(() => {});
  }

  function start() {
    const b = document.getElementById('mail-btn');
    if (b) b.addEventListener('click', () => { Sound.unlock(); Sound.tap(); openMail(); });
    badge();
    if (!on()) return;
    Platform.profile().then((p) => { platPhoto = (p && p.photo) || ''; }).catch(() => {});
    setTimeout(() => hello(true), 1500);
    setInterval(() => { if (!document.hidden) hello(false); }, 60000);
    // свернул - сразу отправляем прогресс; вернулся - проверяем, не открыта ли игра в другом месте
    document.addEventListener('visibilitychange', () => { hello(false, true); notifyPush(document.hidden); });
    setTimeout(() => notifyPush(false), 4000);
  }

  const call = (fn, body, ms) => rpc(fn, Object.assign({ init_data: initData() }, body || {}), ms);

  const boost = () => (state.settings && state.settings.boost) || null;

  // команда игры для вкладки «Сообщество»
  async function team() { try { return await rpc('team_public', {}, 6000); } catch (e) { return null; } }

  return { team, linked: () => linked, boost, call, start, openMail, admCode, notifyPush, isAdmin: () => state.admin, hello, loadServer, linkDialog, blocked: () => kicked, on, uid: () => uid };
})();

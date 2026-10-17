// =====================================================================
//  Версия 0.10: просьбы жителей без спешки - журнал заданий
//  Житель приходит в лавку и просит о помощи. «Помогу!» - просьба попадает
//  в журнал («Задания» → «Просьбы») и висит там без срока.
//  Собрал всё - «Отнести»: житель приходит за заказом, радуется, награда и дружба.
//  Долго не выполняешь - житель заглядывает и напоминает о себе.
//
//  Виды просьб:
//    give:  { id: n }  - принести ингредиенты (тратятся при сдаче)
//    brew:  'зелье'    - сварить зелье (одно; сдаётся из сумки)
// =====================================================================

CONFIG.req = {
  max: 5,              // одновременно в журнале
  remindHours: 6,      // через сколько часов житель напомнит о себе (и потом так же)
  rewardHours: 0.35,   // награда: столько часов дохода за каждую вещь в просьбе
  crystalChance: 0.35  // шанс получить кристалл за просьбу
};

const Requests = (() => {
  const C = CONFIG, D = DATA, R = CONFIG.req;
  const S = () => Econ.s;
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const list = () => { if (!Array.isArray(S().req)) S().req = []; return S().req; };
  const vis = (id) => Econ.findVisitor(id);
  const POT = (id) => D.brews.find((b) => b.id === id);

  // ---------- создание просьбы ----------
  function make(v) {
    const s = S();
    const talk = (D.reqTalk || {})[v.id] || {};
    const known = new Set(s.book.map((rid) => rid.split('.')[0]));
    const r = { id: Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), v: v.id, at: Date.now(), seen: Date.now() };
    // зелье - только из тех, что житель любит и игрок уже умеет варить
    const pots = Object.keys(talk.brew || {}).filter((id) => known.has(id));
    if (pots.length && Math.random() < 0.4) {
      r.k = 'brew'; r.brew = pick(pots); r.text = talk.brew[r.brew];
      return r;
    }
    // ингредиенты одного свойства - и реплика про них
    const props = Object.keys(talk.give || {});
    const prop = props.length ? pick(props) : null;
    const pool = D.ingr.filter((x) => !x.rare && (!prop || x.p === prop));
    r.k = 'give'; r.give = {};
    r.text = prop ? pick(talk.give[prop]) : pick(v.asks);
    const kinds = Math.random() < 0.5 ? 1 : 2;
    const maxN = Math.min(4, 2 + Math.floor(Econ.rank() / 3));
    for (let i = 0; i < kinds; i++) {
      let x = pick(pool);
      for (let t = 0; t < 10 && r.give[x.id]; t++) x = pick(pool);
      r.give[x.id] = (r.give[x.id] || 0) + 1 + Math.floor(Math.random() * maxN);
    }
    return r;
  }
  // реплика жителя: thanks | remind | ready | later
  function line(vid, kind, fallback) {
    const t = (D.reqTalk || {})[vid];
    const x = t && t[kind];
    if (!x) return fallback;
    return Array.isArray(x) ? pick(x) : x;
  }
  const size = (r) => (r.k === 'give' ? Object.values(r.give).reduce((a, n) => a + n, 0) : 3);

  // ---------- выполнено ли ----------
  function progress(r) {
    if (r.k === 'give') {
      const parts = Object.keys(r.give).map((k) => ({ id: k, need: r.give[k], have: Math.min(r.give[k], Brew.count(k)) }));
      const need = parts.reduce((a, q) => a + q.need, 0), have = parts.reduce((a, q) => a + q.have, 0);
      return { need, have, parts, ready: have >= need };
    }
    const bag = S().bag || {};
    const have = (bag[r.brew] || 0) + (bag[r.brew + '+'] || 0) > 0 ? 1 : 0;
    return { need: 1, have, ready: have >= 1 };
  }
  const ready = (r) => progress(r).ready;
  const readyCount = () => list().filter(ready).length;
  const full = () => list().length >= R.max;
  // кого пора навестить с напоминанием
  const dueRemind = () => list().find((r) => !ready(r) && Date.now() - (r.seen !== undefined ? r.seen : r.at) > R.remindHours * 3600e3);
  const ofVisitor = (vid) => list().filter((r) => r.v === vid);

  function goalText(r) {
    if (r.k === 'give') return 'Принести: ' + Object.keys(r.give).map((k) => Brew.ing(k).name + ' ×' + r.give[k]).join(', ');
    return 'Сварить: ' + POT(r.brew).name;
  }
  const iconOf = (r) => (r.k === 'give' ? Brew.ing(Object.keys(r.give)[0]).img : POT(r.brew).img);

  // ---------- принять, сдать ----------
  function add(r) { if (full()) return false; list().push(r); return true; }
  function remove(r) { const l = list(), i = l.indexOf(r); if (i >= 0) l.splice(i, 1); }
  function find(id) { return list().find((r) => r.id === id); }

  // сдать: забрать вещи, награда. Возвращает результат serveVisitor + extra
  function hand(r) {
    if (!ready(r)) return null;
    const s = S();
    if (r.k === 'give') for (const k in r.give) s.ing[k] -= r.give[k];
    else { const k = (s.bag[r.brew + '+'] > 0) ? r.brew + '+' : r.brew; s.bag[k]--; if (!s.bag[k]) delete s.bag[k]; }
    remove(r);
    const res = Econ.serveVisitor(r.v);
    const extra = Econ.hoursOfIncome(R.rewardHours * size(r), 300);
    Econ.earn(extra);
    res.reward += extra;
    if (!res.crystal && Math.random() < R.crystalChance) { Econ.addCrystals(1); res.crystal = true; }
    return res;
  }

  // ---------- журнал ----------
  function card(r) {
    const v = vis(r.v), p = progress(r);
    const btn = p.ready
      ? h('button', { class: 'pill-btn', type: 'button', onclick: () => { Sound.tap(); Visitors.deliver(r); } }, 'Отнести')
      : h('span', { class: 'quest-state' }, p.have + '/' + p.need);
    const parts = r.k === 'give' ? h('div', { class: 'give-row' }, p.parts.map((q) => h('span', { class: 'give-it' + (q.have >= q.need ? ' ok' : '') },
      pic(Brew.ing(q.id).img), q.have + '/' + q.need))) : h('div', { class: 'give-row' }, h('span', { class: 'give-it' + (p.ready ? ' ok' : '') }, pic(POT(r.brew).img), p.ready ? 'в сумке' : 'свари в «Зельях»'));
    return h('div', { class: 'row-card story-card req-card' + (p.ready ? ' ready' : '') },
      h('div', { class: 'req-ava' }, h('span', { class: 'dlg-ava' }, pic(v.img)), pic('hud/avatar_frame', 'dlg-frame')),
      h('div', { class: 'info' },
        h('div', { class: 'name' }, v.name),
        h('div', { class: 'desc story-text' }, '«' + r.text + '»'),
        h('div', { class: 'meta' }, goalText(r)),
        parts),
      btn);
  }

  function block(box) {
    const l = list();
    box.append(h('h3', { class: 'section-title' }, 'Просьбы жителей ' + l.length + ' / ' + R.max));
    if (!l.length) {
      box.append(h('div', { class: 'panel empty' }, pic('quest/journal', 'empty-ico'), h('p', { class: 'note center' }, 'Пока никто ни о чём не просит. Жители заходят в лавку - помоги им, и просьба появится здесь.')));
    } else {
      l.slice().sort((a, b) => (ready(b) ? 1 : 0) - (ready(a) ? 1 : 0)).forEach((r) => box.append(card(r)));
    }
  }

  // событие варки - для подсказки, что просьба готова
  function event(kind, arg) {
    if (kind !== 'brew') return;
    const r = list().find((x) => x.k === 'brew' && x.brew === arg);
    if (r) setTimeout(() => UI.toast(vis(r.v).name + ' ждёт это зелье! Отнеси в «Заданиях»'), 1600);
  }

  return { make, line, add, remove, find, list, progress, ready, readyCount, full, dueRemind, ofVisitor, goalText, iconOf, hand, card, block, event, size };
})();

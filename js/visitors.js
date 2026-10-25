// Посетители лавки. Житель стоит за прилавком слева (по пояс), над головой - облачко.
// Зачем приходит (st.mode):
//   new    - с новой просьбой: тап - окно «Помогу!» (просьба уходит в журнал) / «Не сейчас»;
//   remind - напомнить о просьбе, которую давно не выполняют;
//   deliver - за готовым заказом (игрок нажал «Отнести» в журнале): радуется, благодарит, награда.
// Без спешки: никаких таймеров на выполнение. Не подошёл к жителю - он сам уйдёт, без штрафа.
const Visitors = (() => {
  const C = CONFIG, D = DATA;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const h = (...a) => UI.h(...a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // phase: none | waiting (стоит, ждёт тапа) | leaving (уходит)
  const st = { phase: 'none', mode: 'new', v: null, r: null, left: 0, total: 1, result: '' };
  let nextIn = rand(12, 25); // первый гость приходит быстро
  const queue = [];          // кто должен прийти за заказом

  // как житель выглядит на сцене
  const vis = { v: null, k: 0, emo: 'wait', enterAt: 0, leaveAt: 0, blinkIn: 2.5, blink: 0, pop: 0, hit: null, lastNow: 0 };

  function build() {
    const el = document.getElementById('visitor');
    if (el) { el.innerHTML = ''; el.classList.remove('show'); }
  }

  function show(v, mode, r) {
    st.phase = 'waiting'; st.mode = mode; st.v = v; st.r = r || null; st.result = ''; st.say = '';
    st.left = st.total = C.visitorWaitSec;
    vis.v = v; vis.emo = mode === 'deliver' ? 'happy' : 'wait'; vis.enterAt = performance.now(); vis.leaveAt = 0; vis.pop = 1;
    Sound.bell();
    if (UI.hush) UI.hush();
    UI.refresh && UI.refresh(true);
  }

  function arrive() {
    // 1) за готовым заказом - в первую очередь
    if (queue.length) { const r = queue.shift(); show(Econ.findVisitor(r.v), 'deliver', r); setTimeout(() => { if (st.r === r) complete(); }, 1300); return; }
    // 2) напомнить о давней просьбе
    const due = Requests.dueRemind();
    if (due && (Requests.full() || Math.random() < 0.5)) {
      due.seen = Date.now();
      show(Econ.findVisitor(due.v), 'remind', due);
      return;
    }
    // 3) новая просьба - если в журнале есть место
    if (Requests.full()) { nextIn = rand(C.visitorMinSec, C.visitorMaxSec); return; }
    const busy = new Set(Requests.list().map((r) => r.v));
    const all = D.visitors.filter((v) => !busy.has(v.id));
    const pool = all.filter((v) => Econ.friendLevel(v.id) < D.friendship.length - 1);
    const ev = Events.pickVisitor();
    const v = (ev && !busy.has(ev.id) && ev) || pick(pool.length && Math.random() < 0.75 ? pool : (all.length ? all : D.visitors));
    show(v, 'new', Requests.make(v));
  }

  // игрок нажал «Отнести»: идём на экран котла, житель приходит за заказом
  function deliver(r) {
    if (!Requests.ready(r)) return;
    if (UI.isModalOpen()) UI.closeModal();
    UI.show('main');
    if (st.phase === 'waiting' && st.r === r) { complete(); return; }
    if (!queue.includes(r)) queue.push(r);
    if (st.phase === 'none') nextIn = 0.4;
    else if (st.phase === 'waiting' && st.mode !== 'deliver') leave(null);
  }

  // ---------- окна разговора ----------
  const portrait = (v, happy) => h('div', { class: 'dlg-portrait' }, h('span', { class: 'dlg-ava' }, UI.pic(happy && v.imgHappy ? v.imgHappy : v.img)), UI.pic('hud/avatar_frame', 'dlg-frame'));
  function goalRow(r) {
    const p = Requests.progress(r);
    return h('div', { class: 'dlg-task row-frame' }, UI.pic(Requests.iconOf(r), 'dlg-task-ico'),
      h('span', null, Requests.goalText(r), h('br'), h('small', null, p.ready ? 'Всё готово!' : 'Есть: ' + p.have + ' из ' + p.need)),
      h('span', { class: 'dlg-reward' }, UI.money('+' + UI.ess(Econ.orderReward(r.v) + Econ.hoursOfIncome(C.req.rewardHours * Requests.size(r), 300)))));
  }
  function dialog() {
    if (st.phase !== 'waiting' || UI.isModalOpen()) return;
    const v = st.v, r = st.r;
    if (st.mode === 'deliver') return;
    if (st.mode === 'remind') {
      const ready = Requests.ready(r);
      UI.modal({
        title: v.name,
        body: h('div', { class: 'dialog' }, portrait(v),
          h('div', { class: 'dlg-say' }, '«' + (ready ? Requests.line(v.id, 'ready', 'Ой, у тебя уже всё готово?') : speechText()) + '»'),
          goalRow(r)),
        actions: ready
          ? [{ label: 'Отдать сейчас', onClick: () => { complete(); } }, { label: 'Потом', alt: true }]
          : [{ label: 'Скоро сделаю!' }],
        onClose: () => { if (st.phase === 'waiting' && st.mode === 'remind') leave('wait'); }
      });
      return;
    }
    const met = (Econ.s.vis[v.id] || 0) > 0;
    let accepted = false;
    UI.modal({
      title: v.name,
      cls: 'visitor-modal',
      body: h('div', { class: 'dialog' }, portrait(v),
        h('p', { class: 'dlg-bio' }, met ? v.bio : 'Впервые в лавке. ' + v.bio),
        h('div', { class: 'dlg-say' }, '«' + r.text + '»'),
        UI.friendBlock(v.id),
        goalRow(r),
        h('p', { class: 'small center' }, 'Без спешки: просьба будет ждать в «Заданиях».')),
      actions: [
        { label: 'Помогу!', onClick: () => { accepted = true; accept(); } },
        { label: 'Не сейчас', alt: true }
      ],
      onClose: () => { if (!accepted && st.phase === 'waiting') leave('sad', v.name + ': «' + Requests.line(v.id, 'later', 'Ничего, загляну в другой раз') + '»'); }
    });
  }

  function accept() {
    if (st.phase !== 'waiting' || !st.r) return;
    Requests.add(st.r);
    const v = st.v;
    vis.emo = 'happy';
    leave('ok', v.name + ': «Спасибо! Буду ждать»');
    UI.refresh(true);
    if (window.Game) Game.save();
  }

  // житель уходит: сначала показывает настроение, потом опускается за прилавок
  function leave(emo, text) {
    st.phase = 'leaving';
    st.result = emo || '';
    if (emo === 'happy' || emo === 'ok') vis.emo = 'happy'; else if (emo === 'sad') vis.emo = 'sad';
    vis.leaveAt = performance.now() + (emo === 'happy' ? 1700 : emo ? 1100 : 200);
    if (text) UI.toast(text);
    nextIn = queue.length ? 1.2 : rand(C.visitorMinSec, C.visitorMaxSec) / (1 + 0.08 * Econ.skill('v1'));
  }

  function complete() {
    const v = st.v, r = st.r;
    const res = Requests.hand(r);
    if (!res) { leave(null); return; }
    Story.event('order', v.id);
    const candy = Events.onServe(v.id);
    Sound.fanfare();
    Cauldron.setMood('happy', 1500);
    const c = Cauldron.center();
    Cauldron.floatText(c.x, c.y - 40, '+' + UI.ess(res.reward), '#FFC94D', 26);
    leave('happy', v.name + ': «' + Requests.line(v.id, 'thanks', pick(D.visitorThanks)) + '» +' + UI.ess(res.reward) + (candy ? ' и +' + candy + ' ' + Events.candyWord(candy) : '') + (res.crystal ? ' и +1 кристалл' : '') + (res.doubled ? '. Дружба крепнет вдвойне!' : ''));
    // новый уровень дружбы, часть истории и подарок - одним окном
    if (res.levelUp || res.story) {
      UI.modal({
        title: v.name,
        body: h('div', null, portrait(v, true),
          h('p', { class: 'm-sub' }, res.levelUp ? 'Новый уровень дружбы: «' + res.levelUp.name + '»' : 'Рассказывает историю'),
          res.levelUp ? h('div', { class: 'levelup' }, UI.pic(res.levelUp.img, 'heart-big'),
            h('span', null, 'Дружба выросла! +' + C.crystals.friendship + ' ' + UI.crystalsWord(C.crystals.friendship) + ', награды за просьбы +' + Math.round(Econ.friendLevel(v.id) * C.friendshipBonus * 100) + '%')) : null,
          res.story ? h('div', { class: 'dlg-say' }, '«' + res.story + '»') : null,
          res.story ? h('p', { class: 'small center' }, 'Часть истории ' + (res.part + 1) + ' из ' + Econ.storyAtOf(v.id).length) : null,
          res.gift ? h('div', { class: 'gift-row big' }, UI.pic(res.gift.img || 'wardrobe/' + res.gift.id, 'gift-pic'),
            h('span', null, 'Подарок: ', h('b', null, res.gift.name), '. Найдёшь в Гардеробе!')) : null,
          res.egg ? h('div', { class: 'gift-row big' }, UI.pic('eggs/mystery', 'gift-pic'),
            h('span', null, 'Подарок: ', h('b', null, 'таинственное яйцо'), '. Оно уже греется у тёплого котла!')) : null),
        actions: [{ label: res.gift || res.egg ? 'Ура!' : 'Дальше' }]
      });
      if (res.gift || res.egg) Sound.fanfare();
    }
    UI.refresh(true);
    if (window.Game) Game.save();
  }

  function onTap() {}

  // paused - открыто окно или игрок не на экране котла
  function update(dt, paused) {
    if (st.phase === 'none') {
      if (paused) return;
      nextIn -= dt * (Econ.potion('guest') ? 2 : 1);
      if (nextIn <= 0) arrive();
      return;
    }
    if (st.phase === 'leaving') {
      if (vis.leaveAt && performance.now() > vis.leaveAt + 700) { st.phase = 'none'; vis.v = null; }
      return;
    }
    if (paused || st.mode === 'deliver') return;
    st.left -= dt;
    if (st.left <= 0) leave(st.mode === 'new' ? 'sad' : 'wait', st.mode === 'new' ? st.v.name + ' не дождался и ушёл' : null);
  }

  // ---------- рисование на сцене (вызывает котёл, за прилавком) ----------
  const sprite = (n) => (typeof Sprites !== 'undefined' ? Sprites.get(n) : null);
  const springIn = (k) => 1 - Math.exp(-7 * k) * Math.cos(9 * k);
  // o: { left, right - свободное место слева от котла, counterTop, size - радиус котла, t }
  function draw(ctx, o) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - (vis.lastNow || now)) / 1000); vis.lastNow = now;
    vis.hit = null;
    const v = vis.v;
    if (!v) return;
    const id = v.char || v.id, art = (D.charArt || {})[id];
    const imgName = 'chars/' + id + '_' + vis.emo;
    const im = sprite(imgName) || sprite('chars/' + id + '_wait');
    if (!im || !art) return;
    // появление с подпрыгиванием, уход - вниз за прилавок
    const kin = clamp((now - vis.enterAt) / 900, 0, 1);
    let k = springIn(kin);
    if (vis.leaveAt && now > vis.leaveAt) { const q = clamp((now - vis.leaveAt) / 600, 0, 1); k *= 1 - q * q; }
    if (k <= 0.001) return;
    // размер: примерно с котёл, но не больше родного размера картинки
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let hh = o.size * 2.15;
    hh = Math.min(hh, im.naturalHeight / dpr * 1.15);
    const w = hh * im.naturalWidth / im.naturalHeight;
    const x = clamp(o.potLeft - w * 0.42, w * 0.4, o.W * 0.3);
    const bottom = o.counterTop + hh * 0.14;
    const y = bottom + (1 - k) * hh * 1.05;
    // дыхание и лёгкое покачивание
    const br = Math.sin(o.t * 2.1 + 0.5);
    const sy = 1 + br * 0.012, sx = 1 - br * 0.006;
    const sway = Math.sin(o.t * 0.9) * 0.012;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway);
    ctx.scale(sx, sy);
    ctx.drawImage(im, -w / 2, -hh, w, hh);
    // моргание (только в обычном настроении)
    vis.blinkIn -= dt;
    if (vis.blinkIn <= 0) { vis.blink = 0.14; vis.blinkIn = rand(2.2, 5) * (Math.random() < 0.2 ? 0.3 : 1); }
    if (vis.blink > 0) {
      vis.blink -= dt;
      const bl = sprite('chars/' + id + '_blink');
      if (bl && vis.emo === 'wait' && art.blink) {
        const sc = hh / art.h;
        ctx.drawImage(bl, -w / 2 + art.blink[0] * sc, -hh + art.blink[1] * sc, bl.naturalWidth * sc, bl.naturalHeight * sc);
      }
    }
    ctx.restore();
    // место для тапа (в координатах холста)
    const tf = ctx.getTransform(), ox = tf.e / tf.a, oy = tf.f / tf.d;
    const top = y - hh;
    vis.hit = { x: x - w / 2 + ox, y: top + oy - hh * 0.5, w, h: Math.min(hh * 1.4, o.counterTop - top + hh * 0.5) };
    // облачко над головой: просьба словами, подсказка «тапни» и полоска времени (0.32.2)
    if (st.phase === 'waiting' || (st.phase === 'leaving' && (st.result === 'happy' || st.result === 'ok'))) drawBubble(ctx, x, top, w, o, k, dt, now);
  }

  // Слова жителя: первые секунды - его реплика целиком, потом коротко, что нужно.
  // фраза выбирается один раз за визит (раньше выбиралась заново каждый кадр и мелькала)
  function speechText() {
    if (st.mode === 'remind') return st.say || (st.say = Requests.line(st.v.id, 'remind', 'Как там моя просьба? Я загляну попозже!'));
    if (st.r && st.r.text) return st.r.text;
    return 'Можно попросить о помощи?';
  }
  function wrap(ctx, text, maxW) {
    const words = String(text).split(' '), lines = [];
    let cur = '';
    words.forEach((wd) => { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; });
    if (cur) lines.push(cur);
    return lines.slice(0, 4);
  }
  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
  function drawBubble(ctx, vx, headY, vw, o, k, dt, now) {
    vis.pop = Math.max(0, vis.pop - dt * 2.5);
    const leaving = st.phase === 'leaving', waiting = !leaving && st.mode !== 'deliver';
    const age = (now - vis.enterAt) / 1000;
    // текст не меняется, пока житель ждёт: его реплика с просьбой (коротко - в окне разговора)
    const text = leaving ? (st.result === 'ok' ? 'Спасибо, буду ждать!' : 'Спасибо!') : st.mode === 'deliver' ? 'Ура, всё готово!' : speechText();
    const hint = waiting ? (st.mode === 'remind' ? 'Тапни: как дела?' : 'Тапни, чтобы помочь') : '';
    const fs = Math.max(12, Math.round(o.size * 0.14)), hs = Math.max(11, Math.round(fs * 0.86));
    ctx.save();
    ctx.font = '800 ' + fs + 'px Nunito, system-ui, sans-serif';
    const maxW = Math.min(o.W * 0.6, 250);
    const lines = wrap(ctx, text, maxW).slice(0, 3);
    let tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    ctx.font = '900 ' + hs + 'px Nunito, system-ui, sans-serif';
    if (hint) tw = Math.max(tw, ctx.measureText(hint).width);
    const pad = 12, lh = fs * 1.2;
    const bw = tw + pad * 2, bh = pad + lines.length * lh + (hint ? hs * 1.35 + 4 : 0) + (waiting ? 8 : 0) + pad * 0.6;
    const tail = 12;
    const bx = clamp(vx - bw * 0.3, 6, o.W - bw - 6);
    const by = Math.max(o.H * 0.2, headY - bh - tail + vw * 0.08);
    const s = 0.7 + 0.3 * k;
    vis.cloud = { x: bx, y: by, w: bw, h: bh };
    ctx.translate(bx + bw / 2, by + bh); ctx.scale(s, s); ctx.translate(-bw / 2, -bh);
    // мягкое свечение, пока ждёт
    if (waiting) { ctx.shadowColor = 'rgba(255,210,110,.45)'; ctx.shadowBlur = 12; }
    ctx.fillStyle = '#FFF6E8'; ctx.strokeStyle = '#1A0E2C'; ctx.lineWidth = 2.5;
    rr(ctx, 0, 0, bw, bh, 14); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    ctx.stroke();
    // хвостик вниз к жителю
    const tx = clamp(vx - bx, 18, bw - 18);
    ctx.beginPath(); ctx.moveTo(tx - 9, bh - 1); ctx.lineTo(tx - 2, bh + tail); ctx.lineTo(tx + 9, bh - 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - 9, bh); ctx.lineTo(tx - 2, bh + tail); ctx.lineTo(tx + 9, bh); ctx.stroke();
    // текст
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = '800 ' + fs + 'px Nunito, system-ui, sans-serif'; ctx.fillStyle = '#2A1530';
    lines.forEach((l, i) => ctx.fillText(l, bw / 2, pad * 0.8 + i * lh));
    let y = pad * 0.8 + lines.length * lh;
    if (hint) {
      ctx.font = '900 ' + hs + 'px Nunito, system-ui, sans-serif';
      ctx.fillStyle = st.mode === 'remind' ? '#C27A10' : '#8E55D8';
      ctx.fillText(hint, bw / 2, y + 3);
      y += hs * 1.35 + 4;
    }
    // полоска: сколько ещё житель будет ждать
    if (waiting) {
      const frac = clamp(st.left / st.total, 0, 1), bx2 = pad, bw2 = bw - pad * 2, by2 = bh - pad * 0.6 - 5;
      ctx.fillStyle = 'rgba(90,50,40,.15)'; rr(ctx, bx2, by2, bw2, 5, 3); ctx.fill();
      ctx.fillStyle = frac < 0.25 ? '#E8484B' : st.mode === 'remind' ? '#F2A925' : '#8E55D8';
      rr(ctx, bx2, by2, Math.max(5, bw2 * frac), 5, 3); ctx.fill();
    }
    ctx.restore();
    // место для тапа: житель + облачко
    const tf = ctx.getTransform(), ox = tf.e / tf.a, oy = tf.f / tf.d;
    const hb = vis.hit, cr = { x: bx + ox, y: by + oy, w: bw, h: bh + tail };
    if (hb) { const X = Math.min(hb.x, cr.x), Y = Math.min(hb.y, cr.y); vis.hit = { x: X, y: Y, w: Math.max(hb.x + hb.w, cr.x + cr.w) - X, h: Math.max(hb.y + hb.h, cr.y + cr.h) - Y }; }
  }

  // тап по жителю или облачку, пока он ждёт, - открыть разговор
  function hit(x, y) {
    const r = vis.hit;
    if (st.phase !== 'waiting' || st.mode === 'deliver' || !r) return false;
    if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) return false;
    Sound.tap();
    dialog();
    return true;
  }

  return {
    build, update, onTap, draw, hit, deliver, _hit: () => vis.hit, _arrive: () => { if (st.phase === 'none') arrive(); },
    active: () => st.phase === 'waiting',
    waiting: () => st.phase === 'waiting',
    ordering: () => false,
    current: () => (st.phase !== 'none' ? st.v : null)
  };
})();

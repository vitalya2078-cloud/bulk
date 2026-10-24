// =====================================================================
//  0.30: дела по времени суток (игровые сутки - DayTime в scene.js, 2 реальных часа).
//  * Часы с кукушкой на стене: идут по игровому времени. Каждый игровой час (5 реальных минут)
//    выглядывает кукушка; тапнешь по часам, пока она снаружи, - маленький подарок.
//    Тап по часам в другое время - расписание дня.
//  * Золотой час (18:00-19:00 игрового времени): доход и тапы ×2.
//  * Звездопад ночью (22:00-04:00): в окне пролетают звёзды, пойманная - подарок (до 10 в день).
//  * Утренний привоз Марфы (06:00-10:00): один редкий ингредиент в день, только утром.
//  * Лунные зелья: ночью зелье со звёздным ингредиентом выходит отличным (brewing.js).
//  * Камин: огонь горит всегда, вечером и ночью ярче.
//  * Огород на окне: три горшка растут сами (реальное время), спелый - тап, ингредиенты.
//  * Гости в окне днём: сова, ведьма на метле, кот. Тап по гостю - подарок (до 8 в день).
//  * Паутина в углу после долгого отсутствия: тап - убрать.
//  Пока картинки часов не загрузились, часы рисуются кодом (paintClock).
// =====================================================================

CONFIG.timeday = {
  golden: [18, 19], goldenMul: 2,
  stars: [22, 4], starsMax: 10,
  morning: [6, 10], morningPrice: 5,
  cuckooOut: 9,           // сколько реальных секунд кукушка снаружи
  guestsMax: 8,
  // горшки на окне: x - центр (доли картинки комнаты), растёт часов (реальных), что даёт
  pots: [
    { id: 'pepper', x: 0.44, hours: 2, give: [['chili', 2], ['ember', 0.3]] },
    { id: 'star', x: 0.5, hours: 3, give: [['stardust', 1], ['firefly', 0.5]] },
    { id: 'moon', x: 0.56, hours: 4, give: [['moonflower', 1]] }
  ],
  potY: 0.336, potW: 0.052,
  clock: { x: 0.771, y: 0.19, w: 0.075 }  // доли картинки комнаты r2/room: центр, верх корпуса, ширина
};

const TimeDay = (() => {
  const C = CONFIG.timeday;
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const S = () => Econ.s;
  const hour = () => DayTime.hour();
  // час h внутри промежутка [a, b) (через полночь тоже)
  const inRange = (x, [a, b]) => (a < b ? x >= a && x < b : x >= a || x < b);
  const isGolden = () => inRange(hour(), C.golden);
  const isStars = () => inRange(hour(), C.stars);
  const isMorning = () => inRange(hour(), C.morning);
  const isNight = () => DayTime.name() === 'night';
  const mul = (field) => (isGolden() ? C.goldenMul : 1);
  // реальные минуты до игрового часа
  const minsTo = (gh) => Math.max(1, Math.ceil(DayTime.msUntil(gh) / 60000));
  const fmtHour = () => { const x = hour(); const hh = Math.floor(x), mm = Math.floor((x - hh) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
  const st = () => {
    const s = S();
    if (!s.td || typeof s.td !== 'object') s.td = {};
    const t = s.td;
    if (t.d !== Econ.today()) { t.d = Econ.today(); t.stars = 0; t.ck = 0; t.mr = 0; }
    return t;
  };
  const save = () => { if (window.Game) Game.save(); };

  // ---------- кукушка ----------
  // номер игрового часа от начала времён: меняется раз в 5 реальных минут, одинаково у всех
  const hourIdx = () => Math.floor(Date.now() / (DayTime.DAY_MS / 24));
  let lastIdx = -1, outUntil = 0, outIdx = -1, onMain = () => true;
  function update() {
    const i = hourIdx();
    if (lastIdx < 0) { lastIdx = i; return; }
    if (i === lastIdx) return;
    lastIdx = i;
    // кукушка выглядывает, только когда игрок смотрит на лавку
    if (document.hidden || !onMain()) return;
    outUntil = performance.now() + C.cuckooOut * 1000; outIdx = i;
    const n = Math.floor(hour()) % 12 || 12;
    for (let k = 0; k < Math.min(3, n); k++) setTimeout(() => Sound.cuckoo(), 300 + k * 750);
    if (isGolden() && Math.floor(hour()) === C.golden[0]) setTimeout(() => { UI.toast('Золотой час! Доход и тапы ×' + C.goldenMul + ' до ' + C.golden[1] + ':00'); Sound.fanfare(); }, 600);
  }
  const cuckooOut = () => performance.now() < outUntil;
  function tapClock(x, y) {
    Sound.prop('wood');
    if (cuckooOut() && st().ck !== outIdx) {
      const t = st();
      t.ck = outIdx; outUntil = performance.now() + 700;
      const r = Math.random();
      let text;
      if (r < 0.08) { Econ.addCrystals(1); text = '+1 кристалл'; }
      else if (r < 0.4) { const g = Brew.give(1, 0.1); text = g[0] ? g[0].name : '+ингредиент'; }
      else { const v = Econ.hoursOfIncome(0.1, 50); Econ.earn(v); text = '+' + Fmt.num(v); }
      Cauldron.floatText(x, y - 14, text, '#FFE6A0', 20);
      setTimeout(() => Sound.coin(), 120);
      UI.say('Ку-ку! Кукушка принесла подарок', 2000);
      save();
      return;
    }
    schedule();
  }

  // ---------- расписание ----------
  function schedule() {
    const t = st();
    const row = (img, name, when, desc, now) => h('div', { class: 'td-row' + (now ? ' now' : '') }, pic(img, 'td-ico'),
      h('div', { class: 'td-info' }, h('b', null, name), h('small', null, desc)), h('span', { class: 'td-when' }, now ? 'сейчас' : when));
    const soon = (a) => 'через ' + minsTo(a) + ' мин';
    const body = h('div', { class: 'td-box' },
      h('div', { class: 'td-time' }, h('b', null, fmtHour()), h('small', null, { night: 'Ночь', dawn: 'Рассвет', day: 'День', dusk: 'Закат' }[DayTime.name()] + ' в лавке · игровые сутки идут 2 часа')),
      row('ui/sparkle', 'Золотой час', soon(C.golden[0]), 'С ' + C.golden[0] + ':00 до ' + C.golden[1] + ':00 доход и тапы ×' + C.goldenMul, isGolden()),
      row('ui/crystal', 'Звездопад', soon(C.stars[0]), 'С ' + C.stars[0] + ':00 до 0' + C.stars[1] + ':00 лови звёзды в окне (сегодня ' + t.stars + ' из ' + C.starsMax + ')', isStars()),
      row('chars/marfa_happy', 'Утренний привоз', soon(C.morning[0]), 'С 0' + C.morning[0] + ':00 до ' + C.morning[1] + ':00 Марфа продаёт один редкий ингредиент', isMorning()),
      row('ui/flask', 'Лунные зелья', soon(22), 'Ночью зелье со звёздным ингредиентом выходит отличным', isNight()),
      row('cards/bell', 'Кукушка', 'каждый час', 'Раз в игровой час выглядывает кукушка. Успей тапнуть по часам - будет подарок', cuckooOut()));
    UI.modal({ title: 'Часы лавки', cls: 'td-modal', body });
  }

  // ---------- звездопад в окне ----------
  let star = null, nextStar = 0;
  function drawSky(ctx, w) {
    if (!isStars() || RenderOpts.lowfx) { star = null; return; }
    const now = performance.now();
    if (!star && now > nextStar) {
      star = { t0: now, x: 0.15 + Math.random() * 0.5, y: 0.1 + Math.random() * 0.3, dx: 0.5 + Math.random() * 0.3, dy: 0.25 + Math.random() * 0.15, dur: 2600 };
      nextStar = now + 9000 + Math.random() * 14000;
    }
    if (!star) return;
    const k = (now - star.t0) / star.dur;
    if (k >= 1) { star = null; return; }
    const R = w.rr, x = w.cx - R + (star.x + star.dx * k) * 2 * R, y = w.cy - R + (star.y + star.dy * k) * 2 * R;
    star.sx = x + w.ox; star.sy = y + w.oy; star.r = R * 0.35;
    const a = Math.sin(Math.min(1, k * 1.4) * Math.PI);
    ctx.save();
    ctx.beginPath(); ctx.arc(w.cx, w.cy, R * 1.02, 0, Math.PI * 2); ctx.clip();
    const tl = R * 0.45, gr = ctx.createLinearGradient(x, y, x - star.dx * tl, y - star.dy * tl);
    gr.addColorStop(0, 'rgba(255,246,200,' + (0.95 * a) + ')'); gr.addColorStop(1, 'rgba(255,246,200,0)');
    ctx.strokeStyle = gr; ctx.lineWidth = Math.max(1.5, R * 0.03); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - star.dx * tl, y - star.dy * tl); ctx.stroke();
    ctx.globalAlpha = a; ctx.fillStyle = '#FFF6C8';
    ctx.shadowColor = '#FFE38A'; ctx.shadowBlur = R * 0.12;
    ctx.beginPath(); ctx.arc(x, y, Math.max(2, R * 0.035), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function hitStar(x, y) {
    if (!star || star.sx === undefined) return false;
    const dx = x - star.sx, dy = y - star.sy;
    if (dx * dx + dy * dy > Math.max(36, star.r) ** 2) return false;
    star = null;
    const t = st();
    Sound.pop();
    if (t.stars >= C.starsMax) { Cauldron.floatText(x, y, 'Загадай желание!', '#FFF6C8', 18); return true; }
    t.stars++;
    let text;
    if (Math.random() < 0.12) { Econ.addCrystals(1); text = '+1 кристалл'; }
    else { const v = Econ.hoursOfIncome(0.12, 60); Econ.earn(v); text = '+' + Fmt.num(v); }
    Cauldron.floatText(x, y, text, '#FFF6C8', 20);
    setTimeout(() => Sound.coin(), 120);
    if (t.stars === 1) UI.say('Поймал звезду! Ночью их тут много падает', 2400);
    save();
    return true;
  }

  // ---------- часы (временная графика кодом) ----------
  let clockR = null, clockCv = null;
  function drawClock(ctx, g) {
    const w = C.clock.w * g.dw, x0 = g.bx(C.clock.x) - w / 2, y0 = g.by(C.clock.y);
    const art = clockArt();
    const H = art ? w * art.caseIm.naturalHeight / art.caseIm.naturalWidth : w * 1.5, pend = w * (art ? 0.9 : 0.75);
    clockR = { x: x0 + g.ox - w * 0.15, y: y0 + g.oy - w * 0.1, w: w * 1.3, h: H + pend + w * 0.2 };
    // рисуем в маленький холст, чтобы наложить свет суток (ночью часы темнее, как вся комната)
    const pad = w * 0.6, cw = Math.ceil((w + pad * 2) * g.dpr), chh = Math.ceil((H + pend + pad * 2) * g.dpr);
    const cv = clockCv || (clockCv = document.createElement('canvas'));
    if (cv.width !== cw || cv.height !== chh) { cv.width = cw; cv.height = chh; }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cw, chh);
    c.setTransform(g.dpr, 0, 0, g.dpr, pad * g.dpr, pad * g.dpr);
    if (art) paintArt(c, art, w, H, pend, g.t); else paintClock(c, w, H, pend, g.t);
    // свет суток поверх
    const wt = DayTime.weights(DayTime.phase());
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    if (wt.night > 0.01) { c.globalAlpha = 0.42 * wt.night; c.fillStyle = '#2A2260'; c.fillRect(0, 0, cw, chh); }
    if (wt.dusk + wt.dawn > 0.01) { c.globalAlpha = 0.18 * (wt.dusk + wt.dawn); c.fillStyle = '#FF9A4A'; c.fillRect(0, 0, cw, chh); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // золотой час - часы светятся
    if (isGolden()) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const cx = x0 + w / 2, cy = y0 + H * 0.55, R = w * (1.1 + 0.08 * Math.sin(g.t * 3));
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      gr.addColorStop(0, 'rgba(255,214,110,.45)'); gr.addColorStop(1, 'rgba(255,214,110,0)');
      ctx.fillStyle = gr; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
    }
    ctx.drawImage(cv, x0 - pad, y0 - pad, w + pad * 2, H + pend + pad * 2);
  }
  // картинки часов (листы 31): корпус с циферблатом, стрелки, маятник, птичка, открытая дверца
  const CLOCK_PARTS = ['case', 'hour', 'minute', 'pendulum', 'bird', 'door'];
  function clockArt() {
    const o = {};
    for (const n of CLOCK_PARTS) { const im = Sprites.get('clock/' + n); if (!im) return null; o[n + 'Im'] = im; }
    return o;
  }
  // точки на картинке корпуса (доли): центр циферблата, дверца кукушки
  const DIAL = { x: 0.5, y: 0.613 }, DOOR = { x: 0.5, y: 0.3, w: 0.21 };
  function paintArt(c, a, w, H, pend, t) {
    const cx = w / 2;
    // маятник за корпусом: качается от точки под циферблатом
    const pw = w * 0.3, ph = pw * a.pendulumIm.naturalHeight / a.pendulumIm.naturalWidth;
    c.save(); c.translate(cx, H * 0.78); c.rotate(Math.sin(t * Math.PI) * 0.22);
    c.drawImage(a.pendulumIm, -pw / 2, -ph * 0.02, pw, ph);
    c.restore();
    c.drawImage(a.caseIm, 0, 0, w, H);
    // стрелки: ось - кольцо внизу картинки стрелки
    const fx = w * DIAL.x, fy = H * DIAL.y, hr = hour();
    const hand = (im, ang, len, pivot) => {
      const hh = len, ww = hh * im.naturalWidth / im.naturalHeight;
      c.save(); c.translate(fx, fy); c.rotate(ang); c.drawImage(im, -ww / 2, -hh * pivot, ww, hh); c.restore();
    };
    hand(a.hourIm, (hr % 12) / 12 * Math.PI * 2, w * 0.27, 0.85);
    hand(a.minuteIm, (hr % 1) * Math.PI * 2, w * 0.36, 0.9);
    c.fillStyle = '#C08A2A'; c.beginPath(); c.arc(fx, fy, w * 0.022, 0, Math.PI * 2); c.fill();
    // кукушка: дверца открыта, птичка выезжает и кивает
    if (cuckooOut()) {
      const k = Math.min(1, (performance.now() - (outUntil - C.cuckooOut * 1000)) / 250);
      const dw = w * DOOR.w * 1.35, dh = dw * a.doorIm.naturalHeight / a.doorIm.naturalWidth;
      const dx = w * DOOR.x - w * DOOR.w / 2 - dw * 0.08, dy = H * DOOR.y - dh / 2;
      c.drawImage(a.doorIm, dx, dy, dw, dh);
      const bw = w * 0.42 * (0.4 + 0.6 * k), bh = bw * a.birdIm.naturalHeight / a.birdIm.naturalWidth;
      c.save(); c.translate(w * DOOR.x + w * 0.04 * k, H * DOOR.y + Math.sin(t * 16) * w * 0.012);
      c.rotate(Math.sin(t * 9) * 0.08);
      c.drawImage(a.birdIm, -bw / 2, -bh * 0.6, bw, bh);
      c.restore();
    }
  }
  function paintClock(c, w, H, pend, t) {
    const ink = '#2A1530', lw = Math.max(1, w * 0.035);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const cx = w / 2;
    // маятник и гирьки (за корпусом)
    const sw = Math.sin(t * Math.PI) * 0.32;
    c.save(); c.translate(cx, H * 0.86); c.rotate(sw);
    c.strokeStyle = '#C08A2A'; c.lineWidth = w * 0.045; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, pend * 0.78); c.stroke();
    c.fillStyle = '#E8B04A'; c.strokeStyle = ink; c.lineWidth = lw;
    c.beginPath(); c.arc(0, pend * 0.82, w * 0.13, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#9A5BE0'; c.beginPath(); c.arc(0, pend * 0.82, w * 0.065, 0, Math.PI * 2); c.fill();
    c.restore();
    [-0.22, 0.22].forEach((dx, i) => {
      const len = pend * (0.55 + 0.15 * i);
      c.strokeStyle = '#6A4A2A'; c.lineWidth = w * 0.02; c.beginPath(); c.moveTo(cx + dx * w, H * 0.9); c.lineTo(cx + dx * w, H * 0.9 + len); c.stroke();
      c.fillStyle = '#B8862A'; c.strokeStyle = ink; c.lineWidth = lw * 0.8;
      c.beginPath(); c.ellipse(cx + dx * w, H * 0.9 + len + w * 0.09, w * 0.06, w * 0.12, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    });
    // корпус
    const bx = w * 0.08, by = H * 0.28, bw = w * 0.84, bh = H * 0.66;
    const wood = c.createLinearGradient(bx, 0, bx + bw, 0);
    wood.addColorStop(0, '#7A3E22'); wood.addColorStop(0.5, '#A55A30'); wood.addColorStop(1, '#6A3420');
    c.fillStyle = wood; c.strokeStyle = ink; c.lineWidth = lw;
    rr(c, bx, by, bw, bh, w * 0.08); c.fill(); c.stroke();
    // крыша
    c.fillStyle = '#5A2C1A';
    c.beginPath(); c.moveTo(-w * 0.04, by + w * 0.06); c.lineTo(cx, H * 0.02); c.lineTo(w * 1.04, by + w * 0.06); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#9A5BE0'; c.beginPath(); c.arc(cx, H * 0.1, w * 0.06, 0, Math.PI * 2); c.fill(); c.stroke();
    // дверца кукушки
    const dw = w * 0.26, dh = w * 0.22, dx = cx - dw / 2, dy = by + w * 0.04;
    const out = cuckooOut(), k = out ? Math.min(1, (performance.now() - (outUntil - C.cuckooOut * 1000)) / 250) : 0;
    c.fillStyle = '#1A0C14'; rr(c, dx, dy, dw, dh, w * 0.05); c.fill(); c.stroke();
    if (out) {
      // птичка выдвигается из дверцы
      const bxk = cx + w * 0.02, byk = dy + dh * 0.55, s = w * 0.15 * k;
      c.save(); c.translate(bxk, byk + Math.sin(t * 18) * w * 0.01);
      c.fillStyle = '#E8A040'; c.strokeStyle = ink; c.lineWidth = lw * 0.8;
      c.beginPath(); c.ellipse(0, 0, s, s * 0.75, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#FFD24A'; c.beginPath(); c.moveTo(s * 0.8, -s * 0.15); c.lineTo(s * 1.45, s * 0.02 + Math.abs(Math.sin(t * 9)) * s * 0.18); c.lineTo(s * 0.8, s * 0.2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = ink; c.beginPath(); c.arc(s * 0.35, -s * 0.2, s * 0.13, 0, Math.PI * 2); c.fill();
      c.restore();
    } else {
      c.fillStyle = '#8A4A2A'; rr(c, dx, dy, dw, dh, w * 0.05); c.fill(); c.stroke();
      c.fillStyle = '#E8B04A'; c.beginPath(); c.arc(dx + dw * 0.8, dy + dh * 0.55, w * 0.018, 0, Math.PI * 2); c.fill();
    }
    // циферблат
    const fx = cx, fy = by + bh * 0.6, fr = w * 0.3;
    c.fillStyle = '#E8B04A'; c.beginPath(); c.arc(fx, fy, fr * 1.12, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#F8EBCF'; c.beginPath(); c.arc(fx, fy, fr, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#6A4A2A';
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, r1 = fr * (i % 3 ? 0.82 : 0.7);
      c.lineWidth = i % 3 ? w * 0.015 : w * 0.03;
      c.beginPath(); c.moveTo(fx + Math.sin(a) * r1, fy - Math.cos(a) * r1); c.lineTo(fx + Math.sin(a) * fr * 0.92, fy - Math.cos(a) * fr * 0.92); c.stroke();
    }
    const hr = hour(), ah = (hr % 12) / 12 * Math.PI * 2, am = (hr % 1) * Math.PI * 2;
    const hand = (a, len, wd, col) => { c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + Math.sin(a) * len, fy - Math.cos(a) * len); c.stroke(); };
    hand(ah, fr * 0.5, w * 0.05, '#3A2010');
    hand(am, fr * 0.78, w * 0.03, '#3A2010');
    c.fillStyle = '#C08A2A'; c.beginPath(); c.arc(fx, fy, w * 0.035, 0, Math.PI * 2); c.fill();
  }
  function rr(c, x, y, w, hh, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + hh, r); c.arcTo(x + w, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  // где часы на странице (для подсветки в обучении)
  function clockRect() {
    const cv = document.getElementById('cauldron');
    if (!clockR || !cv) return null;
    const rc = cv.getBoundingClientRect(), x = rc.left + clockR.x, y = rc.top + clockR.y;
    return { left: x, top: y, width: clockR.w, height: clockR.h, right: x + clockR.w, bottom: y + clockR.h };
  }
  function potsRect() {
    const cv = document.getElementById('cauldron');
    if (!potR.length || !cv) return null;
    const rc = cv.getBoundingClientRect(), a = potR[0], b = potR[potR.length - 1];
    const x = rc.left + a.x, y = rc.top + Math.min(...potR.map((q) => q.y)), w = b.x + b.w - a.x, hh = Math.max(...potR.map((q) => q.y + q.h)) - Math.min(...potR.map((q) => q.y));
    return { left: x, top: y, width: w, height: hh, right: x + w, bottom: y + hh };
  }
  const hitClock = (x, y) => !!clockR && x >= clockR.x && x <= clockR.x + clockR.w && y >= clockR.y && y <= clockR.y + clockR.h;
  // тап по комнате: звезда в окне или часы
  function hit(x, y) {
    if (hitStar(x, y) || hitGuest(x, y) || tapPot(x, y) || tapWeb(x, y)) return true;
    if (hitClock(x, y)) { tapClock(x, y); return true; }
    return false;
  }

  // ---------- камин ----------
  function drawFire(ctx, g) {
    const it = (typeof Scene !== 'undefined' ? Scene.items() : []).find((x) => x.fire);
    const im = it && Sprites.get(it.img), fl = Sprites.get('r2/flame');
    if (!im || !fl) return;
    const w = it.w * g.dw, hh = w * im.naturalHeight / im.naturalWidth, x = g.bx(it.x) - w / 2, top = g.by(it.y) - hh;
    const wt = DayTime.weights(DayTime.phase()), warm = 0.75 + 0.25 * (wt.night + wt.dusk);
    const bx = x + w * it.fire.x, by = top + hh * it.fire.y, t = g.t;
    // свечение очага
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const R = w * (0.55 + 0.04 * Math.sin(t * 5.3));
    const gr = ctx.createRadialGradient(bx, by - w * 0.12, 0, bx, by - w * 0.12, R);
    gr.addColorStop(0, 'rgba(255,150,60,' + (0.35 * warm) + ')'); gr.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = gr; ctx.fillRect(bx - R, by - w * 0.12 - R, R * 2, R * 2);
    ctx.restore();
    // два языка пламени с разной дрожью
    [[0, 1, 0], [-0.09, 0.72, 1.7], [0.1, 0.65, 3.1]].forEach(([ox, s, ph]) => {
      const fw = w * it.fire.w * s * (1 + 0.05 * Math.sin(t * 6.1 + ph)), fh = fw * fl.naturalHeight / fl.naturalWidth * (0.9 + 0.1 * Math.sin(t * 8.3 + ph) + 0.05 * Math.sin(t * 13 + ph));
      ctx.save(); ctx.globalAlpha = 0.95 * warm;
      ctx.translate(bx + ox * w, by); ctx.rotate(0.05 * Math.sin(t * 3.7 + ph));
      ctx.drawImage(fl, -fw / 2, -fh, fw, fh);
      ctx.restore();
    });
  }

  // ---------- огород на окне ----------
  const garden = () => { const t = st(); if (!t.g || typeof t.g !== 'object') t.g = {}; C.pots.forEach((p) => { if (!t.g[p.id]) t.g[p.id] = Date.now(); }); return t.g; };
  const potK = (p) => Math.min(1, (Date.now() - garden()[p.id]) / (p.hours * 3600 * 1000));
  const potStage = (p) => { const k = potK(p); return k >= 1 ? 3 : k >= 0.5 ? 2 : 1; };
  let potR = [];
  function drawPots(ctx, g) {
    potR = [];
    if (!S()) return;
    // полочка-подоконник под горшками
    const sx0 = g.bx(C.pots[0].x - C.potW * 0.9), sx1 = g.bx(C.pots[C.pots.length - 1].x + C.potW * 0.9), sy = g.by(C.potY) - g.dw * 0.004, th = g.dw * 0.012;
    ctx.save();
    ctx.fillStyle = 'rgba(20,8,30,.35)'; ctx.fillRect(sx0 + th * 0.4, sy + th, sx1 - sx0 - th * 0.8, th * 0.7);
    const wg = ctx.createLinearGradient(0, sy, 0, sy + th); wg.addColorStop(0, '#B36A3A'); wg.addColorStop(1, '#6E3A20');
    ctx.fillStyle = wg; ctx.strokeStyle = '#2A1530'; ctx.lineWidth = Math.max(1, th * 0.18);
    ctx.beginPath(); ctx.rect(sx0, sy, sx1 - sx0, th); ctx.fill(); ctx.stroke();
    const wt = DayTime.weights(DayTime.phase());
    if (wt.night > 0.01) { ctx.globalAlpha = 0.4 * wt.night; ctx.fillStyle = '#2A2260'; ctx.fillRect(sx0, sy, sx1 - sx0, th); }
    ctx.restore();
    C.pots.forEach((p) => {
      const stg = potStage(p), im = Sprites.get('plants/' + p.id + stg);
      if (!im) return;
      const w = C.potW * g.dw * (stg === 3 ? 1.12 : 1), hh = w * im.naturalHeight / im.naturalWidth, x = g.bx(p.x) - w / 2, y = g.by(C.potY) - hh;
      if (stg === 3) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.2 * Math.sin(g.t * 3 + p.x * 20);
        const R = w * 0.9, gr = ctx.createRadialGradient(x + w / 2, y + hh * 0.4, 0, x + w / 2, y + hh * 0.4, R);
        gr.addColorStop(0, '#FFE6A0'); gr.addColorStop(1, 'rgba(255,230,160,0)');
        ctx.fillStyle = gr; ctx.fillRect(x + w / 2 - R, y + hh * 0.4 - R, R * 2, R * 2); ctx.restore();
      }
      const sway = stg === 3 ? Math.sin(g.t * 1.6 + p.x * 9) * 0.03 : 0;
      ctx.save(); ctx.translate(x + w / 2, y + hh); ctx.rotate(sway); ctx.drawImage(im, -w / 2, -hh, w, hh); ctx.restore();
      potR.push({ p, x: x + g.ox - w * 0.2, y: y + g.oy - w * 0.2, w: w * 1.4, h: hh + w * 0.3 });
    });
  }
  function tapPot(x, y) {
    const r = potR.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    if (!r) return false;
    const p = r.p;
    if (potStage(p) < 3) {
      Sound.tap();
      const left = Math.max(1, Math.ceil((1 - potK(p)) * p.hours * 60));
      UI.say('Ещё растёт. Созреет через ' + (left >= 60 ? Math.floor(left / 60) + ' ч ' + (left % 60) + ' мин' : left + ' мин'), 2200);
      return true;
    }
    garden()[p.id] = Date.now();
    const got = [];
    p.give.forEach(([id, n]) => {
      const cnt = n >= 1 ? n : (Math.random() < n ? 1 : 0);
      if (!cnt) return;
      S().ing[id] = (S().ing[id] || 0) + cnt;
      const ing = Brew.ing(id); got.push((ing ? ing.name : id) + (cnt > 1 ? ' ×' + cnt : ''));
    });
    Sound.pop(); setTimeout(() => Sound.coin(), 120);
    Cauldron.floatText(x, y - 10, got.join(', '), '#C8F5A0', 18);
    if (!st().gh) { st().gh = 1; UI.say('Урожай! Ингредиенты уже в сумке зельевара', 2400); }
    save();
    return true;
  }

  // ---------- гости в окне ----------
  const GUESTS = [
    { id: 'owl', fly: true, gift: 'ess', say: 'Сова принесла письмо с подарком!' },
    { id: 'witch', fly: true, gift: 'ing', say: 'Ведьма на метле обронила ингредиент!' },
    { id: 'cat', fly: false, gift: 'ess', say: 'Кот заглянул в окно и мурлыкнул' }
  ];
  let guest = null, nextGuest = performance.now() + 20000, forced = null;
  function drawGuest(ctx, w) {
    const now = performance.now();
    if (!guest && now > nextGuest && !isStars() && !RenderOpts.lowfx) {
      const g0 = forced || GUESTS[Math.floor(Math.random() * GUESTS.length)]; forced = null;
      guest = { g: g0, t0: now, dur: g0.fly ? 5200 : 5000, dir: Math.random() < 0.5 ? 1 : -1, y: 0.25 + Math.random() * 0.25 };
      nextGuest = now + 50000 + Math.random() * 70000;
    }
    if (!guest) return;
    const im = Sprites.get('guests/' + guest.g.id);
    // картинка ещё грузится - гость подождёт за краем окна
    if (!im) { guest.t0 = now; return; }
    const k = (now - guest.t0) / guest.dur;
    if (k >= 1) { guest = null; return; }
    const R = w.rr;
    let x, y, s;
    if (guest.g.fly) {
      s = R * (guest.g.id === 'owl' ? 0.62 : 0.7);
      x = w.cx + guest.dir * (-1.45 + 2.9 * k) * R; y = w.cy - R + guest.y * 2 * R + Math.sin(k * 14) * R * 0.04;
    } else {
      // кот поднимается снизу, смотрит и уходит
      s = R * 0.75;
      const up = k < 0.2 ? k / 0.2 : k > 0.8 ? (1 - k) / 0.2 : 1;
      x = w.cx + R * 0.15; y = w.cy + R * 1.05 - up * s * 0.62;
    }
    const hh = s * im.naturalHeight / im.naturalWidth;
    guest.sx = x + w.ox; guest.sy = y + w.oy; guest.r = s * 0.55;
    ctx.save();
    ctx.beginPath(); ctx.arc(w.cx, w.cy, R * 1.02, 0, Math.PI * 2); ctx.clip();
    ctx.translate(x, y);
    if (guest.g.fly && guest.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(im, -s / 2, -hh / 2, s, hh);
    ctx.restore();
  }
  function hitGuest(x, y) {
    if (!guest || guest.sx === undefined) return false;
    const dx = x - guest.sx, dy = y - guest.sy;
    if (dx * dx + dy * dy > Math.max(36, guest.r) ** 2) return false;
    const g0 = guest.g; guest = null;
    const t = st();
    Sound.pop();
    if ((t.gs || 0) >= C.guestsMax) { Cauldron.floatText(x, y, 'Привет!', '#FFF6C8', 18); return true; }
    t.gs = (t.gs || 0) + 1;
    let text;
    if (g0.gift === 'ing') { const got = Brew.give(1, 0.1); text = got[0] ? got[0].name : '+ингредиент'; }
    else { const v = Econ.hoursOfIncome(0.1, 50); Econ.earn(v); text = '+' + Fmt.num(v); }
    Cauldron.floatText(x, y, text, '#FFF6C8', 20);
    setTimeout(() => Sound.coin(), 120);
    UI.say(g0.say, 2200);
    save();
    return true;
  }

  // ---------- паутина после долгого отсутствия ----------
  let web = 0, webR = null;
  function onAway(sec) { if (sec >= 6 * 3600) web = 1; }
  function drawWeb(ctx, g) {
    webR = null;
    if (!web) return;
    const im = Sprites.get('r2/cobweb');
    if (!im) return;
    const w = 0.085 * g.dw, hh = w * im.naturalHeight / im.naturalWidth, x = g.bx(0.285), y = g.by(0.128);
    ctx.save(); ctx.globalAlpha = 0.85 * web; ctx.drawImage(im, x, y, w, hh); ctx.restore();
    if (web < 1) { web = Math.max(0, web - 0.05); return; }
    webR = { x: x + g.ox, y: y + g.oy, w, h: hh };
  }
  function tapWeb(x, y) {
    if (!webR || x < webR.x || x > webR.x + webR.w || y < webR.y || y > webR.y + webR.h) return false;
    web = 0.95; webR = null;
    const v = Math.max(1, Math.round(Econ.hoursOfIncome(0.05, 20)));
    Econ.earn(v);
    Cauldron.floatText(x, y, '+' + Fmt.num(v), '#FFE6A0', 20);
    Sound.pop();
    UI.say('Паутину смахнули. Так-то лучше!', 2000);
    return true;
  }

  function drawWall(ctx, g) {
    drawWeb(ctx, g);
    drawFire(ctx, g);
    drawPots(ctx, g);
    drawClock(ctx, g);
  }
  function drawWindow(ctx, w) {
    drawSky(ctx, w);
    drawGuest(ctx, w);
  }

  // ---------- утренний привоз ----------
  const morningLeft = () => (isMorning() && !st().mr ? 1 : 0);
  function morningItem() {
    const rng = Econ.rngFrom('bulk:morning:' + Econ.today());
    const rares = DATA.ingr.filter((x) => x.rare);
    return rares[Math.floor(rng() * rares.length)];
  }
  function buyMorning() {
    const s = S(), x = morningItem();
    if (!morningLeft() || s.cr < C.morningPrice) return null;
    s.cr -= C.morningPrice; st().mr = 1;
    s.ing[x.id] = (s.ing[x.id] || 0) + 1;
    return x;
  }

  function init(isMain) {
    if (isMain) onMain = isMain;
    if (typeof Cauldron !== 'undefined' && Cauldron.setHooks) Cauldron.setHooks({ wall: drawWall, sky: drawWindow });
    setInterval(update, 1000);
    update();
  }

  return { init, hit, mul, clockRect, potsRect, onAway, potStage, isGolden, isStars, isMorning, isNight, schedule, morningItem, morningLeft, buyMorning, fmtHour,
    _st: st, _out: () => { outUntil = performance.now() + C.cuckooOut * 1000; outIdx = hourIdx(); }, _star: () => { nextStar = 0; }, _clockR: () => clockR, _starPos: () => star, _guest: (i) => { nextGuest = 0; guest = null; forced = GUESTS[i || 0]; }, _guestPos: () => guest, _potR: () => potR, _web: () => { web = 1; } };
})();

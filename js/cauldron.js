// Говорящий котёл: рисование на canvas, эмоции и украшения.
// createCauldron() создаёт отдельный котёл для любого холста:
// главный на экране котла и предпросмотр в гардеробе.

// Картинки грузятся один раз и общие для всех котлов
const Sprites = (() => {
  const cache = {}, pending = {};
  function get(name, cb) {
    if (cache[name]) { if (cb) cb(cache[name]); return cache[name]; }
    const p = pending[name] = pending[name] || { cbs: [] };
    if (cb) p.cbs.push(cb);
    if (!p.im) load(name, p, 0);
    return null;
  }
  // Если картинка не пришла - докачиваем через загрузчик (проверка размера, повтор мимо кэша)
  function load(name, p, attempt) {
    p.im = new Image();
    p.im.onload = () => { cache[name] = p.im; p.failed = false; p.cbs.forEach((f) => { try { f(p.im); } catch (e) { console.warn(e); } }); p.cbs = []; };
    p.im.onerror = () => {
      p.failed = true;
      if (attempt < 3 && typeof Loader !== 'undefined') Loader.load([IMG(name)], 3).then(() => setTimeout(() => load(name, p, attempt + 1), 200));
    };
    p.im.src = IMG(name);
  }
  // после общей загрузки - ещё раз то, что не открылось
  function refresh() { Object.keys(pending).forEach((n) => { const p = pending[n]; if (!cache[n] && p.failed) load(n, p, 0); }); }
  return { get, refresh };
})();

// Общие настройки отрисовки (меньше эффектов - для слабых телефонов)
const RenderOpts = { lowfx: false };

function createCauldron() {
  const TAU = Math.PI * 2;
  const INK = '#1A0E2C';
  // Где зелье на картинке котла (доли ширины и высоты), посчитано при нарезке
  const POT_LIQUID = [0.239, 0.094, 0.753, 0.233];
  const POT_ASPECT = 1.336;
  const POT_WK = 2.8;     // ширина картинки котла в радиусах (с ручками)
  const POT_CY = 0.62;    // где центр «лица» по высоте картинки
  // Тренога: ширина в долях ширины котла, высота/ширина картинки, где сидит дно котла (доля высоты сверху),
  // откуда начинается передний обод (всё ниже рисуется поверх котла)
  // где по высоте «держится» комната: 0 - видно потолок, 1 - пол
  const ROOM_ALIGN = 0.15;
  const STAND = { w: 0.9, aspect: 230 / 420, seat: 0.42, front: 0.3 };

  let cv, ctx, W = 300, H = 300, dpr = 1;
  // потолок плотности холста: полная чёткость; телефон всерьёз не успевает - снижаем сами (см. perfGuard)
  let dprCap = 3;
  const g = { cx: 0, cy: 0, r: 80, rimY: 0, pot: null, liq: null };
  let t = 0;

  const face = {
    mood: 'idle', forced: null, forcedUntil: 0,
    blink: 0, blinkIn: 2.5,
    look: { x: 0, y: 0 }, target: { x: 0, y: 0 }, lookIn: 2
  };
  let lastClick = -1e9;
  let lastInput = performance.now();
  const clickTimes = [];
  let squash = 0, squashV = 0;
  let liquid = '#5BE0B3';
  let potColor = null;
  const wear = { head: null, face: null };

  let parts = [], floats = [], surf = [], rise = [], zs = [];
  const dust = [];
  let golden = null;
  let surfIn = 0, riseIn = 0, zIn = 0;

  const S = {};               // загруженные картинки этого котла
  let liquidLayer = null;     // зелье, перекрашенное в текущий цвет
  let potLayer = null;        // котёл, перекрашенный в выбранный цвет

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function mix(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * k); gg = Math.round(gg + (255 - gg) * k); b = Math.round(b + (255 - b) * k);
    return 'rgb(' + r + ',' + gg + ',' + b + ')';
  }

  function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); }

  function use(key, name, after) {
    Sprites.get(name, (im) => { S[key] = im; if (after) after(); });
  }

  // ---------- перекраска ----------
  function makeLayer(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function tintLiquid() {
    const m = S.liquid;
    if (!m) return;
    liquidLayer = liquidLayer || makeLayer(m.naturalWidth, m.naturalHeight);
    const c = liquidLayer.getContext('2d');
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, liquidLayer.width, liquidLayer.height);
    c.drawImage(m, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = liquid;
    c.fillRect(0, 0, liquidLayer.width, liquidLayer.height);
  }

  // Котёл другого цвета: меняем оттенок, сохраняя объём. Зелье не трогаем.
  function tintPot() {
    if (!S.pot || !potColor) { potLayer = null; return; }
    const w = S.pot.naturalWidth, h = S.pot.naturalHeight;
    potLayer = potLayer || makeLayer(w, h);
    const c = potLayer.getContext('2d');
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, w, h);
    c.drawImage(S.pot, 0, 0);
    c.globalCompositeOperation = 'color';
    c.fillStyle = potColor;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(S.pot, 0, 0);
    if (S.liquid) {
      c.globalCompositeOperation = 'destination-out';
      c.drawImage(S.liquid, 0, 0, w, h);
      const tmp = makeLayer(w, h), tc = tmp.getContext('2d');
      tc.drawImage(S.pot, 0, 0);
      tc.globalCompositeOperation = 'destination-in';
      tc.drawImage(S.liquid, 0, 0, w, h);
      c.globalCompositeOperation = 'source-over';
      c.drawImage(tmp, 0, 0);
    }
    c.globalCompositeOperation = 'source-over';
  }

  // Описание фонов: hearth - где очаг (доля высоты картинки), counter - прилавок на переднем плане
  const bgMeta = () => (DATA.bgMeta && DATA.bgMeta[bgName]) || {};

  // ---------- фон и праздничные мелочи ----------
  let bgName = '';
  function setBackground(name) {
    if (!name || name === bgName) return;
    bgName = name;
    bgDirty = true;
    lights = [];
    Sprites.get(name, (im) => {
      if (bgName !== name) return;
      S.bg = im; bgDirty = true;
      sceneKey = '';
      lights = ((DATA.bgLights || {})[name] || []).map((L) => Object.assign({}, L, { ph: rand(0, TAU), sp: rand(0.7, 1.2), tw: rand(1, 6), star: null }));
      if (W > 1) placeOnFloor();
    });
  }
  let ambName = null;
  const bats = [];
  function setAmbient(name) {
    if (name === ambName) return;
    ambName = name;
    S.amb = null;
    bats.length = 0;
    if (!name) return;
    Sprites.get(name, (im) => { if (ambName === name) S.amb = im; });
    for (let i = 0; i < 3; i++) bats.push({ x: Math.random(), y: rand(0.08, 0.35), sp: rand(0.025, 0.05) * (i % 2 ? -1 : 1), ph: rand(0, TAU), k: rand(0.7, 1.1) });
  }
  function drawAmbient() {
    if (!S.amb || RenderOpts.lowfx) return;
    const im = S.amb;
    bats.forEach((b) => {
      const x = ((b.x + t * b.sp) % 1.3 + 1.3) % 1.3 - 0.15;
      const y = b.y + Math.sin(t * 1.4 + b.ph) * 0.03;
      const w = g.r * 0.42 * b.k, hh = w * im.naturalHeight / im.naturalWidth;
      const flap = 0.75 + 0.25 * Math.abs(Math.sin(t * 9 + b.ph));
      ctx.save();
      ctx.translate(x * W, y * H);
      if (b.sp < 0) ctx.scale(-1, 1);
      ctx.scale(1, flap);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(im, -w / 2, -hh / 2, w, hh);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  // ---------- размеры ----------
  function init(canvas) {
    cv = canvas;
    ctx = cv.getContext('2d');
    setBackground('r2/room');
    use('pot', 'cauldron/pot', () => { layout(); tintPot(); });
    use('liquid', 'cauldron/liquid', () => { tintLiquid(); tintPot(); });
    use('bubble', 'cauldron/bubble');
    for (let i = 0; i < 18; i++) dust.push({ x: Math.random(), y: Math.random(), s: rand(0.6, 1.8), ph: rand(0, TAU), sp: rand(0.008, 0.02) });
    resize();
  }

  function resize() {
    const rc = cv.getBoundingClientRect();
    W = Math.max(1, rc.width); H = Math.max(1, rc.height);
    // чёткость: до 3× на экранах с высокой плотностью, в режиме слабых эффектов - до 2×
    dpr = Math.min(window.devicePixelRatio || 1, RenderOpts.lowfx ? 2 : dprCap);
    bgDirty = true;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    g.r = Math.min(W * 0.26, H * 0.27);
    g.cx = W / 2;
    placeOnFloor();
  }

  // где и в каком размере лежит картинка фона (cover + запас на параллакс)
  function fitBg() {
    const im = S.bg;
    if (!im) return;
    const m = bgMeta();
    // комната заполняет экран от самого верха до прилавка (прилавок закрывает низ картинки)
    const Hr = m.room && showCounter() ? H - W * 1.06 * 0.333 * 0.5 : H;
    const k = Math.max(W / im.naturalWidth, Hr / im.naturalHeight) * (m.hearth || m.room ? 1.03 : 1);
    bgGeom.dw = im.naturalWidth * k; bgGeom.dh = im.naturalHeight * k;
    bgGeom.ox = (W - bgGeom.dw) / 2; bgGeom.oy = (Hr - bgGeom.dh) * (m.room ? ROOM_ALIGN : 0.8);
    // на низком экране (превью в гардеробе) площадка с котлом не должна уехать вниз
    if (m.room) { const py = bgGeom.oy + DATA.room.platform.y * bgGeom.dh; if (py > Hr * 0.86) bgGeom.oy -= py - Hr * 0.86; }
  }
  // Котёл стоит на треноге посреди каменной площадки
  function placeOnFloor() {
    let fy = H * 0.82;
    const meta = bgMeta();
    if (S.bg && meta.room) {
      fitBg();
      g.r = Math.min(bgGeom.dw * 0.125, H * 0.145);
      const potW = g.r * POT_WK, potH = potW / POT_ASPECT;
      const sw = potW * STAND.w, sh = sw * STAND.aspect;
      g.foot = bgY(DATA.room.platform.y);
      const potBottom = g.foot - sh * (1 - STAND.seat);
      g.cy = potBottom - potH * (1 - POT_CY);
      layout();
      return;
    }
    if (S.bg && meta.hearth) {
      // котёл ставится ножками в очаг, нарисованный на фоне
      const im = S.bg, k = Math.max(W / im.naturalWidth, H / im.naturalHeight), dh = im.naturalHeight * k;
      g.r = Math.min(g.r, W * 0.24);
      g.cy = (H - dh) * 0.8 + dh * meta.hearth - g.r * 0.87;
      layout();
      return;
    }
    if (S.bg) {
      const im = S.bg, k = Math.max(W / im.naturalWidth, H / im.naturalHeight), dh = im.naturalHeight * k;
      fy = (H - dh) * 0.8 + dh * 0.83;
    }
    // от центра котла до низа камней ≈ 1.47r; ниже края сцены не опускаем
    g.cy = Math.max(H * 0.46, Math.min(fy - g.r * 1.47, H - g.r * 1.55));
    layout();
  }

  function layout() {
    silDirty = true;
    const { cx, cy, r } = g;
    const w = r * POT_WK, h = w / POT_ASPECT;
    g.pot = { x: cx - w / 2, y: cy - h * POT_CY, w, h };
    const L = POT_LIQUID;
    g.liq = {
      cx: g.pot.x + w * (L[0] + L[2]) / 2,
      cy: g.pot.y + h * (L[1] + L[3]) / 2,
      rx: w * (L[2] - L[0]) / 2,
      ry: h * (L[3] - L[1]) / 2
    };
    g.rimY = g.liq.cy;
  }

  // ---------- обновление ----------
  let sizeCheck = 0;
  function update(dt, eps) {
    t += dt;
    // размер холста мог поменяться (вкладка открылась, повернули экран)
    sizeCheck -= dt;
    if (sizeCheck <= 0 && cv) { sizeCheck = 0.5; if (Math.abs(cv.clientWidth - W) > 1 || Math.abs(cv.clientHeight - H) > 1) resize(); }
    const now = performance.now();
    const low = RenderOpts.lowfx;

    while (clickTimes.length && now - clickTimes[0] > 1000) clickTimes.shift();
    let m;
    if (face.forced && now < face.forcedUntil) m = face.forced;
    else if (clickTimes.length >= 6) m = 'excited';
    else if (now - lastClick < 380) m = 'happy';
    // ночью Бульк засыпает быстрее, днём бодрее
    else if (now - lastInput > (bgMeta().room ? 14000 + 22000 * (1 - nightK) : 25000)) m = 'sleepy';
    else m = 'idle';
    face.mood = m;

    face.blinkIn -= dt;
    if (face.blinkIn <= 0) { face.blink = 1; face.blinkIn = rand(2, 5); }
    face.blink = Math.max(0, face.blink - dt * 7);

    face.lookIn -= dt;
    if (face.lookIn <= 0) { face.target = { x: rand(-1, 1), y: rand(-0.6, 0.8) }; face.lookIn = rand(1.5, 4); }
    face.look.x += (face.target.x - face.look.x) * Math.min(1, dt * 8);
    face.look.y += (face.target.y - face.look.y) * Math.min(1, dt * 8);

    checkRoom();
    frameDt = dt;
    perfGuard(dt);
    updateDay(dt);
    updateFire(dt);
    updateLights(dt);
    updateSpoon(dt);
    updatePar(dt);
    squashV += (-170 * squash - 13 * squashV) * dt;
    squash = clamp(squash + squashV * dt, -0.35, 0.35);

    surfIn -= dt;
    if (surfIn <= 0) {
      surf.push({ ox: rand(-0.75, 0.75), oy: rand(-0.5, 0.5), max: rand(2, 5.5) * g.r / 90, life: 0, dur: rand(0.6, 1.4) });
      surfIn = low ? rand(0.3, 0.6) : rand(0.06, 0.25);
    }
    surf.forEach((b) => { b.life += dt; });
    surf = surf.filter((b) => b.life < b.dur);

    const rate = low ? 0.6 : 0.8 + Math.min(6, Math.log10(eps + 1));
    riseIn -= dt;
    if (riseIn <= 0) {
      rise.push({ x: g.cx + rand(-0.6, 0.6) * g.r, y: g.rimY, vy: -rand(25, 60), r: rand(2, 6) * g.r / 90, ph: rand(0, TAU), life: 0, dur: rand(2, 3.5) });
      riseIn = 1 / rate;
    }
    rise.forEach((b) => { b.life += dt; b.y += b.vy * dt; b.x += Math.sin(t * 3 + b.ph) * dt * 14; });
    rise = rise.filter((b) => b.life < b.dur);

    if (m === 'sleepy') {
      zIn -= dt;
      if (zIn <= 0) { zs.push({ x: g.cx + g.r * 0.75, y: g.rimY, life: 0 }); zIn = 1.2; }
    }
    zs.forEach((z) => { z.life += dt; z.x += 10 * dt; z.y -= 20 * dt; });
    zs = zs.filter((z) => z.life < 2.4);

    parts.forEach((p) => { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
    parts = parts.filter((p) => p.life > 0 && p.y < H + 30);

    floats.forEach((f) => { f.y += f.vy * dt; f.vy *= 1 - Math.min(1, dt * 2); f.life -= dt; });
    floats = floats.filter((f) => f.life > 0);

    if (golden) {
      golden.life += dt;
      golden.y += golden.vy * dt;
      golden.x = golden.x0 + Math.sin(golden.life * 1.6) * W * 0.08;
      if (golden.life > CONFIG.bubbleLifeSec || golden.y < -70) golden = null;
    }
  }

  // ---------- фон ----------
  // Картинка фона, затемнение и виньетка рисуются один раз в отдельный слой
  // в полном разрешении экрана (сглаживание «high»), потом слой просто копируется.
  let bgCv = null, bgDirty = true;
  const bgGeom = { ox: 0, oy: 0, dw: 0, dh: 0 };
  function buildBg() {
    bgDirty = false;
    const im = S.bg;
    if (!im) return;
    fitBg();
    bgCv = bgCv || document.createElement('canvas');
    bgCv.width = Math.round(W * dpr); bgCv.height = Math.round(H * dpr);
    const c = bgCv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.clearRect(0, 0, W, H);
    // 0.29: окно комнаты прозрачное - небо за ним рисуется каждый кадр (сутки, погода)
    c.drawImage(im, bgGeom.ox, bgGeom.oy, bgGeom.dw, bgGeom.dh);
    if (bgMeta().room) buildRoom(c);
    // комната чуть ярче и сочнее - в тон заставке
    if ('filter' in c && bgMeta().room) {
      const tmp = document.createElement('canvas'); tmp.width = bgCv.width; tmp.height = bgCv.height;
      tmp.getContext('2d').drawImage(bgCv, 0, 0);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.filter = 'brightness(1.14) saturate(1.15)';
      c.clearRect(0, 0, bgCv.width, bgCv.height); c.drawImage(tmp, 0, 0); c.restore();
    }
    if (bgMeta().room) { buildSkies(); buildVeil(); roomDirty = true; return; }
    veil(c);
  }
  // общий тон и виньетка: в комнате кладутся поверх мебели каждый кадр (мебель теперь живая)
  function veil(c) {
    c.fillStyle = 'rgba(28,14,48,.06)';
    c.fillRect(0, 0, W, H);
    const vg = c.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.25, W / 2, H * 0.55, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(20,10,36,0)');
    vg.addColorStop(1, 'rgba(20,10,36,.3)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
  }
  let veilCv = null;
  function buildVeil() {
    veilCv = veilCv || document.createElement('canvas');
    veilCv.width = Math.round(W * dpr); veilCv.height = Math.round(H * dpr);
    const c = veilCv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    veil(c);
  }

  // ---------- 0.29: небо за окном по времени суток ----------
  // Есть ночь и рассвет; день и закат, пока нет своих картинок, получаются перекраской рассвета.
  // день: рассвет посветлее, верх неба перекрашен в голубой; закат: рассвет потеплее
  const SKY_ALT = { day: ['dawn', 'saturate(.6) brightness(1.3)', ['#6AAEFF', 'rgba(120,180,255,.5)']], dusk: ['dawn', 'sepia(.3) saturate(1.35) hue-rotate(-14deg) brightness(.95)'] };
  let skies = {};
  function skyRect() { const wn = bgMeta().window, R = wn.r * bgGeom.dw * 1.15; return { x: bgX(wn.x) - R, y: bgY(wn.y) - R, s: R * 2 }; }
  function buildSkies() {
    skies = {};
    const m = bgMeta();
    if (!m.window || !m.skies) return;
    const r = skyRect(), n = Math.max(2, Math.round(r.s * dpr));
    const one = (im, filter, tint) => {
      const cv2 = document.createElement('canvas'); cv2.width = cv2.height = n;
      const c = cv2.getContext('2d'); c.imageSmoothingQuality = 'high';
      if (filter && 'filter' in c) c.filter = filter;
      c.drawImage(im, 0, 0, n, n);
      c.filter = 'none';
      if (tint) {
        const gr = c.createLinearGradient(0, 0, 0, n);
        gr.addColorStop(0, tint[0]); gr.addColorStop(0.55, tint[1]); gr.addColorStop(0.78, 'rgba(120,180,255,0)');
        c.globalCompositeOperation = 'color'; c.fillStyle = gr; c.fillRect(0, 0, n, n);
      }
      return cv2;
    };
    Object.keys(m.skies).forEach((k) => { const im = Sprites.get(m.skies[k], () => { bgDirty = true; }); if (im) skies[k] = one(im); });
    Object.keys(SKY_ALT).forEach((k) => {
      if (skies[k] || m.skies[k]) return;
      const im = Sprites.get(m.skies[SKY_ALT[k][0]]);
      if (im) skies[k] = one(im, SKY_ALT[k][1], SKY_ALT[k][2]);
    });
  }
  function drawSky() {
    const m = bgMeta();
    if (!m.window || !m.skies) return;
    const r = skyRect(), w = DayTime.weights(DayTime.phase());
    let acc = 0;
    ctx.save();
    ['night', 'dawn', 'day', 'dusk'].forEach((k) => {
      const v = w[k], cv2 = skies[k] || skies.night;
      if (v < 0.004 || !cv2) return;
      acc += v;
      ctx.globalAlpha = v / acc;
      ctx.drawImage(cv2, r.x, r.y, r.s, r.s);
    });
    ctx.restore();
    drawWeather(r);
  }

  // ---------- комната: мебель и украшения по рангу ----------
  let sceneKey = '', roomItems = [];
  const isDyn = (it) => it.layer === 'hang' || it.layer === 'top' || it.bob;
  function checkRoom() {
    if (!bgMeta().room || typeof Scene === 'undefined') return;
    const k = Scene.key();
    if (k === sceneKey) return;
    sceneKey = k;
    roomItems = Scene.items();
    bgDirty = true;
    roomItems.forEach((it) => Sprites.get(it.img, () => { bgDirty = true; }));
  }
  // прямоугольник предмета на сцене
  function itemRect(it, im) {
    const w = it.w * bgGeom.dw, hh = w * im.naturalHeight / im.naturalWidth;
    const x = bgX(it.x);
    let top;
    if (it.layer === 'top') top = -hh * 0.06;
    else if (it.layer === 'hang') top = bgY(it.y);
    else top = bgY(it.y) - hh;
    return { x: x - w / 2, y: top, w, h: hh, cx: x };
  }
  // свет от предметов: в долях картинки фона, как старые огоньки
  function roomLights() {
    const out = [];
    const wn = bgMeta().window;
    if (wn) out.push({ k: 'window', x: wn.x, y: wn.y, r: wn.r * 1.35, c: '#8FA8FF' });
    roomItems.forEach((it) => {
      const im = Sprites.get(it.img);
      if (!im || !it.lights) return;
      const R = itemRect(it, im);
      it.lights.forEach((L) => out.push({ k: L.k, c: L.c, it,
        x: (R.x + L.x * R.w - bgGeom.ox) / bgGeom.dw, y: (R.y + L.y * R.h - bgGeom.oy) / bgGeom.dh, r: L.r * it.w }));
    });
    lights = out.map((L) => Object.assign(L, { ph: rand(0, TAU), sp: rand(0.7, 1.2), tw: rand(1, 6), star: null }));
  }
  // «вписать» картинки в комнату: обводка в цвет теней, общий холодный тон
  function gradeCanvas(cv2, tone) {
    const c = cv2.getContext('2d'), w = cv2.width, hh = cv2.height;
    const m = document.createElement('canvas'); m.width = w; m.height = hh;
    m.getContext('2d').drawImage(cv2, 0, 0);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'lighten'; c.fillStyle = '#2E1C44'; c.fillRect(0, 0, w, hh);
    c.globalCompositeOperation = 'multiply'; c.fillStyle = tone; c.fillRect(0, 0, w, hh);
    c.globalCompositeOperation = 'destination-in'; c.drawImage(m, 0, 0);
    c.restore();
  }
  // 0.29: мебель не «впечатана» в фон. Каждый предмет заранее приводится к тону комнаты и рисуется
  // каждый кадр - так он может отозваться на тап. В фон запекаются только коврики и тени.
  let props = [];          // [{ it, cv, R }] в порядке рисования
  let shadowKey = -1;      // сдвинулось время суток - тени пересобираются
  const SHADOW_STEPS = 16;
  const PROP_TAP = 1.6;    // сколько секунд длится отклик на тап
  const spriteCache = new Map();
  function propSprite(it, im, R) {
    const key = it.img + '|' + it.layer + '|' + (it.flip ? 1 : 0) + '|' + Math.round(R.w * dpr) + 'x' + Math.round(R.h * dpr);
    let c = spriteCache.get(key);
    if (!c) { c = makePropSprite(it, im, R); if (spriteCache.size > 60) spriteCache.clear(); spriteCache.set(key, c); }
    return c;
  }
  function makePropSprite(it, im, R) {
    const w = Math.max(1, Math.round(R.w * dpr)), hh = Math.max(1, Math.round(R.h * dpr));
    const a = document.createElement('canvas'); a.width = w; a.height = hh;
    const ac = a.getContext('2d'); ac.imageSmoothingQuality = 'high';
    if (it.flip) { ac.translate(w, 0); ac.scale(-1, 1); }
    ac.drawImage(im, 0, 0, w, hh);
    gradeCanvas(a, it.layer === 'wall' ? '#EAE0F6' : '#F0E8FA');
    // низ предмета в тени пола: так он «садится» на пол, а не висит над ним
    if (it.layer !== 'wall') {
      ac.setTransform(1, 0, 0, 1, 0, 0);
      ac.globalCompositeOperation = 'source-atop';
      const og = ac.createLinearGradient(0, hh * 0.7, 0, hh);
      og.addColorStop(0, 'rgba(26,12,40,0)'); og.addColorStop(1, 'rgba(26,12,40,.42)');
      ac.fillStyle = og; ac.fillRect(0, 0, w, hh);
      ac.globalCompositeOperation = 'source-over';
    }
    if (!('filter' in ac)) return a;
    // комната чуть ярче и сочнее - как фон
    const b = document.createElement('canvas'); b.width = w; b.height = hh;
    const bc = b.getContext('2d'); bc.filter = 'brightness(1.14) saturate(1.15)'; bc.drawImage(a, 0, 0);
    return b;
  }
  // Откуда свет: днём - из окна (тени ложатся вперёд и в стороны от него), ночью - от котла.
  function lightSource() {
    const p = DayTime.phase(), w = DayTime.weights(p), sun = DayTime.sun(p), wn = bgMeta().window;
    return {
      sun, wx: wn ? bgX(wn.x) : W / 2, wy: bgY(DATA.room.wallY) - bgGeom.dh * 0.05,
      px: g.cx, py: footY() - g.r * 0.3,
      len: 0.32 + 0.55 * (w.dawn + w.dusk) + 0.12 * w.day + 0.18 * w.night,
      alpha: 0.26 + 0.18 * sun
    };
  }
  function bakeShadows(c, list) {
    const L = lightSource();
    const sh = document.createElement('canvas'); sh.width = Math.round(W * dpr); sh.height = Math.round(H * dpr);
    const sc = sh.getContext('2d');
    const wl = document.createElement('canvas'); wl.width = sh.width; wl.height = sh.height;
    const wc = wl.getContext('2d');
    list.forEach((p) => {
      const R = p.R;
      if (p.it.layer === 'wall') {
        // на стене: силуэт чуть ниже и в сторону от окна
        const ox = clamp((R.x + R.w / 2 - L.wx) / W * 14, -6, 6) * L.sun + clamp((R.x + R.w / 2 - L.px) / W * 8, -4, 4) * (1 - L.sun);
        wc.setTransform(dpr, 0, 0, dpr, 0, 0);
        wc.drawImage(p.cv, R.x + ox, R.y + 6, R.w, R.h);
        return;
      }
      if (p.it.under) return;
      const bx = R.x + R.w / 2, by = R.y + R.h;
      // направление: смесь «от окна» и «от котла»
      const d1x = bx - L.wx, d1y = by - L.wy, n1 = Math.hypot(d1x, d1y) || 1;
      let d2x = bx - L.px, d2y = by - L.py; const n2 = Math.hypot(d2x, d2y) || 1;
      if (n2 < g.r) { d2x = 0; d2y = 1; }
      const dx = (d1x / n1) * L.sun + (d2x / n2) * (1 - L.sun), dy = (d1y / n1) * L.sun + Math.abs(d2y / n2) * (1 - L.sun);
      const len = R.h * L.len;
      const shx = dx * len / R.h, shy = Math.max(0.12, dy) * len * 0.5 / R.h;
      sc.setTransform(dpr, 0, 0, dpr, 0, 0);
      sc.transform(1, 0, -shx, -shy, bx, by);
      sc.drawImage(p.cv, -R.w / 2, -R.h, R.w, R.h);
    });
    [[sc, sh, L.alpha, 3], [wc, wl, 0.4, 4]].forEach(([x, cv2, al, bl]) => {
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = '#12061F'; x.fillRect(0, 0, cv2.width, cv2.height);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = al;
      if ('filter' in c) c.filter = 'blur(' + Math.round(bl * dpr) + 'px)';
      c.drawImage(cv2, 0, 0); c.restore();
    });
    // тень касания: мягкое пятно по всему основанию (в ракурсе сверху основание глубокое),
    // в центре темнее всего - предмет стоит на полу всем весом
    c.save();
    list.forEach((p) => {
      if (p.it.layer === 'wall' || p.it.under) return;
      const R = p.R, cx = R.x + R.w / 2, cy = R.y + R.h * 0.95, rx = R.w * 0.58, ry = Math.max(5, R.h * 0.14);
      c.save(); c.translate(cx, cy); c.scale(1, ry / rx);
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, 'rgba(18,6,31,.62)'); gr.addColorStop(0.55, 'rgba(18,6,31,.4)'); gr.addColorStop(1, 'rgba(18,6,31,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill();
      c.restore();
    });
    c.restore();
  }
  function buildRoom(c) {
    shadowKey = Math.floor(DayTime.phase() * SHADOW_STEPS);
    const order = { wall: 0, floor: 1, front: 2 };
    const list = roomItems.filter((it) => !isDyn(it) && order[it.layer] !== undefined && Sprites.get(it.img));
    list.sort((a, b) => order[a.layer] - order[b.layer] || (a.flat ? -1 : 0) - (b.flat ? -1 : 0) || a.y - b.y);
    const ready = list.map((it) => { const im = Sprites.get(it.img), R = itemRect(it, im); return { it, R, cv: propSprite(it, im, R) }; });
    // коврики лежат на полу - их в фон, тени ложатся поверх
    ready.filter((p) => p.it.flat).forEach((p) => { c.drawImage(p.cv, p.R.x, p.R.y, p.R.w, p.R.h); });
    props = ready.filter((p) => !p.it.flat);
    bakeShadows(c, props);
    roomLights();
  }
  // 0.29.1: всё неподвижное в комнате - одна готовая картинка (roomCv): фон с тенями, мебель, общий тон
  // и свет суток. Каждый кадр она только копируется. Пересобирается, когда сдвинулись сутки
  // (раз в ~75 с, с плавной сменой за 1,5 с) или когда предмет начал/закончил отзываться на тап.
  const TINT_STEPS = 48;
  let roomCv = null, roomPrev = null, roomDirty = true, tintKey = -1, roomFade = 1;
  let tintMask = null;
  // свет суток поверх готовой картинки (прозрачное окно остаётся прозрачным)
  function dayTint(cv2) {
    if (RenderOpts.lowfx || !bgMeta().room) return;
    const w = DayTime.weights(DayTime.phase());
    const c = cv2.getContext('2d'), cw = cv2.width, chh = cv2.height;
    // маска прозрачности (окно) - один холст на все пересборки
    const m = tintMask || (tintMask = document.createElement('canvas'));
    if (m.width !== cw || m.height !== chh) { m.width = cw; m.height = chh; }
    const mc = m.getContext('2d'); mc.globalCompositeOperation = 'copy'; mc.drawImage(cv2, 0, 0);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    const fill = (op, col, a) => { if (a < 0.01) return; c.globalCompositeOperation = op; c.globalAlpha = a; c.fillStyle = col; c.fillRect(0, 0, cw, chh); };
    fill('multiply', '#6E66B4', 0.38 * w.night);
    const a1 = 0.4 * w.day, a2 = 0.4 * w.dawn, a3 = 0.45 * w.dusk, sa = a1 + a2 + a3;
    if (sa > 0.01) {
      const mixc = (i) => Math.round(([0xFF, 0xD7, 0x9A][i] * a1 + [0xFF, 0x9F, 0x8A][i] * a2 + [0xFF, 0x9A, 0x4A][i] * a3) / sa);
      fill('soft-light', 'rgb(' + mixc(0) + ',' + mixc(1) + ',' + mixc(2) + ')', sa);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'destination-in'; c.drawImage(m, 0, 0);
    c.restore();
  }
  const isLive = (p) => !!p.it._tap;
  const inExtra = (p) => frontToExtra && p.it.layer === 'front' && !p.it.under;
  function buildRoomCv(fade) {
    roomDirty = false;
    tintKey = Math.floor(DayTime.phase() * TINT_STEPS);
    const w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (fade && roomCv && roomCv.width === w && roomCv.height === h) { const x = roomPrev; roomPrev = roomCv; roomCv = x; roomFade = 0; }
    else roomFade = 1;
    roomCv = roomCv || document.createElement('canvas');
    if (roomCv.width !== w || roomCv.height !== h) { roomCv.width = w; roomCv.height = h; }
    const c = roomCv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.clearRect(0, 0, w, h);
    if (bgCv) c.drawImage(bgCv, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    props.forEach((p) => { if (!isLive(p) && !inExtra(p)) c.drawImage(p.cv, p.R.x, p.R.y, p.R.w, p.R.h); });
    if (veilCv) { c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(veilCv, 0, 0); }
    dayTint(roomCv);
  }
  // предмет, который сейчас отзывается на тап, рисуется отдельно - в тоне комнаты (копия под свет суток)
  function liveSprite(p) {
    if (p.tk === tintKey && p.tcv) return p.tcv;
    const x = document.createElement('canvas'); x.width = p.cv.width; x.height = p.cv.height;
    x.getContext('2d').drawImage(p.cv, 0, 0); dayTint(x);
    p.tk = tintKey; p.tcv = x;
    return x;
  }

  // предмет комнаты: обычный или в отклике на тап (пружинит)
  // предмет-кнопка, который ещё ни разу не нажимали, мягко светится
  const propSeen = (k) => typeof Econ !== 'undefined' && Econ.s && Econ.s.room && Econ.s.room.seen && Econ.s.room.seen[k];
  function drawProp(c, p) {
    const R = p.R, a = p.it._tap;
    if (p.it.open && !RenderOpts.lowfx && !propSeen(p.it.open)) {
      c.save(); c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.28 + 0.2 * Math.sin(t * 2.6);
      const gr = Math.max(R.w, R.h) * 0.75;
      c.drawImage(glowSprite('#FFD27A'), R.x + R.w / 2 - gr, R.y + R.h / 2 - gr, gr * 2, gr * 2);
      c.restore();
    }
    const k = a ? t - a.t0 : 99;
    const im = a && !inExtra(p) ? liveSprite(p) : p.cv;
    if (k > PROP_TAP || k < 0) { if (a) { p.it._tap = null; roomDirty = true; } c.drawImage(im, R.x, R.y, R.w, R.h); return; }
    c.save();
    if (p.it.layer === 'wall') {
      // качнулся на гвозде
      c.translate(R.x + R.w / 2, R.y);
      c.rotate(0.075 * a.dir * Math.sin(k * 13) * Math.exp(-3.6 * k));
      c.drawImage(im, -R.w / 2, 0, R.w, R.h);
    } else {
      // подпрыгнул, приземлился и пружинит
      const up = 0.3, hop = k < up ? Math.sin(k / up * Math.PI) * R.h * 0.07 : 0;
      const sq = k < up ? -0.03 * Math.sin(k / up * Math.PI) : 0.08 * Math.sin((k - up) * 17) * Math.exp(-5.5 * (k - up));
      c.translate(R.x + R.w / 2, R.y + R.h - hop);
      c.scale(1 + sq, 1 - sq);
      c.drawImage(im, -R.w / 2, -R.h, R.w, R.h);
    }
    c.restore();
  }
  // сколько мебели рисует сам котёл (передний ряд может забрать слой питомцев - для глубины)
  let frontToExtra = false;
  // каждый кадр - только те, кто сейчас пружинит (остальные уже в готовой картинке)
  function drawRoomProps() {
    props.forEach((p) => { if (isLive(p) && !inExtra(p)) drawProp(ctx, p); });
  }
  // передний ряд мебели для слоя питомцев: низ предмета (для сортировки) и как его нарисовать
  let frontCache = null;
  function frontProps() {
    if (frontCache) return frontCache;
    if (!frontToExtra) return (frontCache = []);
    return (frontCache = buildFront());
  }
  function buildFront() {
    return props.filter((p) => p.it.layer === 'front' && !p.it.under).map((p) => ({
      y: p.R.y + p.R.h - par.y * 3, x0: p.R.x - par.x * 5, x1: p.R.x + p.R.w - par.x * 5,
      draw: (c) => { c.save(); c.translate(-par.x * 5, -par.y * 3); drawProp(c, p); c.restore(); }
    }));
  }
  // подвижные предметы: висят под потолком, качаются, парят
  // передний план (балки с травами) - чуть размыт и темнее; размытие считается один раз
  const blurCache = new Map();
  function blurred(im, w, h) {
    if (RenderOpts.lowfx || !('filter' in ctx)) return null;
    const key = im.src + '|' + Math.round(w * dpr) + 'x' + Math.round(h * dpr);
    let c = blurCache.get(key);
    if (c) return c;
    const pad = 4, cw = Math.round(w * dpr) + pad * 2, chh = Math.round(h * dpr) + pad * 2;
    c = document.createElement('canvas'); c.width = cw; c.height = chh;
    const x = c.getContext('2d'); x.filter = 'blur(' + (0.8 * dpr).toFixed(2) + 'px) brightness(.95)';
    x.drawImage(im, pad, pad, cw - pad * 2, chh - pad * 2);
    c.pad = pad / dpr;
    if (blurCache.size > 12) blurCache.clear();
    blurCache.set(key, c);
    return c;
  }
  function drawRoomDyn(which) {
    if (!bgMeta().room) return;
    roomItems.forEach((it) => {
      if (!isDyn(it)) return;
      if (which === 'top' ? it.layer !== 'top' : it.layer === 'top') return;
      const im = Sprites.get(it.img);
      if (!im) return;
      const R = itemRect(it, im);
      ctx.save();
      if (it.layer === 'top' || it.layer === 'hang') {
        ctx.translate(R.cx, R.y);
        // тапнули - раскачивается сильнее и успокаивается
        const a = it._tap, k = a ? t - a.t0 : 99;
        if (a && k > 3) it._tap = null;
        const kick = k < 3 ? 0.22 * a.dir * Math.sin(k * 4.2) * Math.exp(-1.3 * k) : 0;
        ctx.rotate((it.swing ? Math.sin(t * 1.3 + it.x * 9) * 0.05 : Math.sin(t * 0.8 + it.x * 7) * 0.015) + kick);
        const bl = which === 'top' ? blurred(im, R.w, R.h) : null;
        if (bl) ctx.drawImage(bl, -R.w / 2 - bl.pad, -bl.pad, R.w + bl.pad * 2, R.h + bl.pad * 2);
        else ctx.drawImage(im, -R.w / 2, 0, R.w, R.h);
      } else {
        const a = it._tap, k = a ? t - a.t0 : 99;
        if (a && k > PROP_TAP) it._tap = null;
        const dy = Math.sin(t * 1.5 + it.x * 5) * R.h * 0.04 - (k < PROP_TAP ? Math.abs(Math.sin(k * 7)) * Math.exp(-3 * k) * R.h * 0.12 : 0);
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#12061F';
        ctx.beginPath(); ctx.ellipse(R.cx, R.y + R.h * 1.08, R.w * 0.3 * (1 - dy / R.h), R.h * 0.03, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.drawImage(im, R.x, R.y + dy, R.w, R.h);
      }
      ctx.restore();
    });
  }

  function drawBg() {
    if (S.bg) {
      // сутки сдвинулись - тени и свет пересобираются (раз в 2,5 реальные минуты)
      if (bgMeta().room && Math.floor(DayTime.phase() * SHADOW_STEPS) !== shadowKey) bgDirty = true;
      if (bgDirty || !bgCv) buildBg();
      if (bgMeta().room) {
        ctx.fillStyle = '#1F1336'; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(-par.x * 5, -par.y * 3); drawSky(); ctx.restore();
      }
      const room = bgMeta().room;
      if (room) {
        const tk = Math.floor(DayTime.phase() * TINT_STEPS);
        if (roomDirty || tk !== tintKey) buildRoomCv(tk !== tintKey && tintKey >= 0);
        roomFade = Math.min(1, roomFade + frameDt / 2.5);
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (room && roomCv) {
        const ox = Math.round(-par.x * 5 * dpr), oy = Math.round(-par.y * 3 * dpr);
        ctx.drawImage(roomCv, ox, oy);
        if (roomFade < 1 && roomPrev) { ctx.globalAlpha = 1 - roomFade; ctx.drawImage(roomPrev, ox, oy); ctx.globalAlpha = 1; }
      } else ctx.drawImage(bgCv, Math.round(-par.x * 5 * dpr), Math.round(-par.y * 3 * dpr));
      ctx.restore();
      ctx.save(); ctx.translate(-par.x * 5, -par.y * 3);
      if (room) {
        drawRoomProps();
        drawDayLight();
      }
      drawLights();
      drawBeam();
      ctx.restore();
    } else {
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#30204F');
      gr.addColorStop(1, '#1F1336');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
    if (RenderOpts.lowfx) return;
    dust.forEach((d) => {
      const y = ((d.y - t * d.sp) % 1 + 1) % 1;
      ctx.globalAlpha = 0.25 + 0.35 * Math.sin(t * 2 + d.ph) ** 2;
      ctx.fillStyle = '#FFE6A0';
      ctx.beginPath(); ctx.arc(d.x * W, y * H * 0.85, d.s, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // ---------- 0.29.1: телефон не успевает - снижаем плотность холста ----------
  // Средний кадр дольше 1/40 с несколько секунд подряд - холст 1.5x вместо 2x (заливка дешевле почти вдвое).
  // Только если телефон всерьёз не успевает (меньше 28 кадров в секунду 5 секунд подряд, после разгона
  // игры): 1) холст 2x вместо 3x; 2) без тонового слоя котла и питомцев.
  let frameDt = 1 / 60, perfAcc = 0, perfN = 0, perfLvl = 0, perfWarm = 0;
  function perfGuard(dt) {
    if (perfLvl >= 2 || document.hidden) return;
    // загрузка, сворачивание, пересборка комнаты - не в счёт
    if (dt > 0.2 || perfWarm < 8) { perfWarm += Math.min(dt, 0.2); perfAcc = 0; perfN = 0; return; }
    perfAcc += dt; perfN++;
    if (perfAcc < 5) return;
    const avg = perfAcc / perfN;
    perfAcc = 0; perfN = 0;
    if (avg <= 1 / 28) return;
    perfLvl++;
    perfWarm = 0;
    if (perfLvl === 1 && dpr > 2) { dprCap = 2; resize(); }
    else if (perfLvl === 1) perfLvl = 2;
  }

  // ---------- 0.29: время суток и погода ----------
  let nightK = 1;          // 0 - день, 1 - ночь (плавно)
  let weather = null;      // { kind: 'rain'|'snow', k: 0..1, storm }
  let flashK = 0, flashIn = 8;
  // погода на игровые сутки: у каждого дня своя, одинаковая у всех игроков
  function weatherNow() {
    const day = Math.floor(Date.now() / DayTime.DAY_MS);
    let h = Math.imul(day ^ 0x9e3779b9, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
    const rnd = (h % 1000) / 1000;
    if (rnd > 0.32) return null;
    const start = 0.08 + ((h >>> 10) % 1000) / 1000 * 0.55, len = 0.18 + ((h >>> 20) % 100) / 100 * 0.2;
    const k = DayTime.phase() - start;
    if (k < 0 || k > len) return null;
    const m = new Date().getMonth();
    const snow = m === 11 || m <= 1;
    return { kind: snow ? 'snow' : 'rain', k: Math.min(1, k / 0.025, (len - k) / 0.025), storm: !snow && rnd < 0.12 };
  }
  let dayT = 99;
  function updateDay(dt) {
    dayT += dt;
    if (dayT > 1) { dayT = 0; weather = bgMeta().room ? weatherNow() : null; }
    nightK = bgMeta().room ? 1 - DayTime.sun(DayTime.phase()) : 1;
    flashK = Math.max(0, flashK - dt * 3);
    if (weather && weather.storm && !RenderOpts.lowfx) {
      flashIn -= dt;
      if (flashIn <= 0) { flashK = 1; flashIn = rand(9, 26); }
    }
  }
  // дождь или снег за окном (рисуются поверх неба, под рамой окна)
  const drops = [];
  function drawWeather(r) {
    if (!weather || RenderOpts.lowfx) return;
    const wn = bgMeta().window, cx = bgX(wn.x), cy = bgY(wn.y), rr = wn.r * bgGeom.dw;
    if (!drops.length) for (let i = 0; i < 46; i++) drops.push({ x: Math.random(), y: Math.random(), s: rand(0.6, 1.4), ph: rand(0, TAU) });
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, rr * 1.05, 0, TAU); ctx.clip();
    // небо хмурится
    ctx.globalAlpha = 0.38 * weather.k; ctx.fillStyle = weather.kind === 'snow' ? '#B9C2DE' : '#3A3E5C';
    ctx.fillRect(r.x, r.y, r.s, r.s);
    if (flashK > 0) { ctx.globalAlpha = 0.7 * flashK * weather.k; ctx.fillStyle = '#F2F0FF'; ctx.fillRect(r.x, r.y, r.s, r.s); }
    if (weather.kind === 'rain') {
      ctx.strokeStyle = '#D8E2FF'; ctx.lineWidth = 1; ctx.lineCap = 'round';
      drops.forEach((d) => {
        const y = ((d.y + t * 0.9 * d.s) % 1), x = ((d.x + t * 0.12 * d.s) % 1);
        const px = r.x + x * r.s, py = r.y + y * r.s, L = r.s * 0.05 * d.s;
        ctx.globalAlpha = 0.5 * weather.k;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - L * 0.18, py - L); ctx.stroke();
      });
    } else {
      ctx.fillStyle = '#FFFFFF';
      drops.forEach((d) => {
        const y = ((d.y + t * 0.07 * d.s) % 1), x = d.x + Math.sin(t * 0.8 + d.ph) * 0.03;
        ctx.globalAlpha = 0.85 * weather.k;
        ctx.beginPath(); ctx.arc(r.x + x * r.s, r.y + y * r.s, 1 + d.s, 0, TAU); ctx.fill();
      });
    }
    ctx.restore();
  }
  // общий свет комнаты по времени суток: утро розовое, день тёплый, вечер оранжевый, ночь синяя
  // свет суток уже в готовой картинке комнаты; каждый кадр - только вспышка молнии
  function drawDayLight() {
    if (RenderOpts.lowfx || !(flashK > 0 && weather)) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.22 * flashK * weather.k; ctx.fillStyle = '#EDEBFF';
    ctx.fillRect(0, 0, Math.round(W * dpr), Math.round(H * dpr));
    ctx.restore();
  }

  // где на экране предмет-кнопка (для подсветки в обучении)
  function propRect(open) {
    const p = props.find((q) => q.it.open === open);
    if (!p || !cv) return null;
    const rc = cv.getBoundingClientRect(), x = rc.left + p.R.x - par.x * 5, y = rc.top + p.R.y - par.y * 3;
    return { left: x, top: y, width: p.R.w, height: p.R.h, right: x + p.R.w, bottom: y + p.R.h };
  }

  // ---------- 0.29: тап по мебели ----------
  // Возвращает предмет комнаты под пальцем (по непрозрачным пикселям картинки).
  function propAt(x, y) {
    if (!bgMeta().room) return null;
    const px = x + par.x * 5, py = y + par.y * 3;
    const hitCv = (cv2, R, lx, ly) => {
      if (lx < 0 || ly < 0 || lx >= R.w || ly >= R.h) return false;
      try { return cv2.getContext('2d').getImageData(Math.floor(lx / R.w * cv2.width), Math.floor(ly / R.h * cv2.height), 1, 1).data[3] > 60; } catch (e) { return true; }
    };
    // подвесное и парящее (рисуется поверх мебели)
    for (let i = roomItems.length - 1; i >= 0; i--) {
      const it = roomItems[i];
      if (!isDyn(it) || it.layer === 'top' || it.notap) continue;
      const im = Sprites.get(it.img);
      if (!im) continue;
      const R = itemRect(it, im), qx = x + par.x * 4, qy = y + par.y * 2.4;
      if (qx >= R.x && qx <= R.x + R.w && qy >= R.y && qy <= R.y + R.h) return { it, R };
    }
    for (let i = props.length - 1; i >= 0; i--) {
      const p = props[i];
      if (p.it.notap) continue;
      if (hitCv(p.cv, p.R, px - p.R.x, py - p.R.y)) return p;
    }
    return null;
  }
  // отклик предмета: пружинка, вспышка света, искорки. Возвращает сам предмет (open, snd).
  function tapProp(x, y) {
    const p = propAt(x, y);
    if (!p) return null;
    const it = p.it, R = p.R;
    it._tap = { t0: t, dir: x < R.x + R.w / 2 ? 1 : -1 };
    roomDirty = true;
    lights.forEach((L) => { if (L.it === it) L.flash = 1; });
    if (!RenderOpts.lowfx) burst(x, y, it.snd === 'magic' ? ['#D9B8FF', '#B07BFF', '#FFFFFF'] : ['#FFE6A0', '#FFFFFF'], 6, 90, 120);
    return it;
  }

  // ---------- живой фон: свечение бутылок, свечей, фонарей, гирлянды ----------
  // Точки свечения заданы в DATA.bgLights (config.js) в долях картинки фона.
  let lights = [];
  const glowCache = {};
  function hexRgb(hex) { const n = parseInt(String(hex).slice(1), 16); return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255); }
  function glowSprite(hex) {
    if (glowCache[hex]) return glowCache[hex];
    const n = parseInt(hex.slice(1), 16), rgb = ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(' + rgb + ',1)');
    gr.addColorStop(0.25, 'rgba(' + rgb + ',.55)');
    gr.addColorStop(0.6, 'rgba(' + rgb + ',.16)');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    return (glowCache[hex] = c);
  }

  // Как дышит каждый вид света: base - средняя яркость, остальное - колебания
  function lightAlpha(L) {
    const v = lightBase(L);
    // ночью свечи и фонари главный свет комнаты; днём их почти не видно
    const day = L.k === 'window' ? 1 : bgMeta().room ? 0.62 + 0.6 * nightK : 1;
    return v * day + (L.k !== 'bulb' ? (L.flash || 0) * 0.5 : 0);
  }
  function lightBase(L) {
    const low = RenderOpts.lowfx, p = L.ph, sp = L.sp;
    switch (L.k) {
      case 'candle': case 'lantern':
        return low ? 0.34 : 0.34 + 0.08 * Math.sin(t * 13 * sp + p) + 0.05 * Math.sin(t * 23 + p * 2);
      case 'pumpkin':
        return low ? 0.3 : 0.3 + 0.07 * Math.sin(t * 9 * sp + p) + 0.04 * Math.sin(t * 17 + p);
      case 'bulb':
        return low ? 0.4 : 0.36 + 0.14 * Math.sin(t * 1.8 * sp + p) + (L.flash || 0) * 0.45;
      case 'window':
        return (low ? 0.13 : 0.13 + 0.035 * Math.sin(t * 0.7 + p)) * (0.7 + 0.8 * (1 - nightK));
      default: // bottle, ball
        return low ? 0.26 : 0.24 + 0.12 * Math.sin(t * 1.3 * sp + p);
    }
  }

  function updateLights(dt) {
    if (RenderOpts.lowfx) return;
    lights.forEach((L) => {
      if (L.flash) L.flash = Math.max(0, L.flash - dt * 2.5);
      L.tw -= dt;
      if (L.tw > 0) return;
      if (L.k === 'bottle' || L.k === 'ball') {
        // искорка на стекле: вспыхивает и гаснет
        L.star = { life: 0, dur: rand(0.6, 0.95), ox: rand(-0.35, 0.35), oy: rand(-0.4, 0.25) };
        L.tw = rand(2.5, 7);
      } else if (L.k === 'bulb') {
        L.flash = 1;
        L.tw = rand(4, 11);
      } else L.tw = 99;
    });
    lights.forEach((L) => { if (L.star) { L.star.life += dt; if (L.star.life > L.star.dur) L.star = null; } });
  }

  function drawLights() {
    if (!lights.length) return;
    const { ox, oy, dw, dh } = bgGeom;
    const low = RenderOpts.lowfx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    lights.forEach((L) => {
      const x = ox + L.x * dw, y = oy + L.y * dh;
      let R = L.r * dw;
      if (!low && (L.k === 'candle' || L.k === 'lantern' || L.k === 'pumpkin')) R *= 1 + 0.05 * Math.sin(t * 11 + L.ph);
      ctx.globalAlpha = Math.max(0, Math.min(1, lightAlpha(L)));
      // окно днём светит тёплым, ночью лунным
      const col = L.k === 'window' && bgMeta().room ? (nightK > 0.5 ? L.c : '#FFE2A8') : L.c;
      ctx.drawImage(glowSprite(col), x - R, y - R, R * 2, R * 2);
    });
    ctx.restore();
    if (low) return;
    // искорки поверх свечения
    lights.forEach((L) => {
      if (!L.star) return;
      const st = L.star, k = Math.sin(Math.PI * st.life / st.dur);
      const R = L.r * dw;
      const x = ox + L.x * dw + st.ox * R, y = oy + L.y * dh + st.oy * R;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7 * k;
      const gr = R * 0.45;
      ctx.drawImage(glowSprite('#FFFFFF'), x - gr, y - gr, gr * 2, gr * 2);
      ctx.restore();
      ctx.globalAlpha = 0.95 * k;
      const sz = R * 0.24 * (0.4 + 0.6 * k);
      sparkle(x, y, sz, '#FFFFFF');
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      sparkle(0, 0, sz * 0.5, '#FFFFFF');
      ctx.restore();
      ctx.globalAlpha = 1;
    });
  }

  // ---------- тренога и руны ----------
  // Котёл стоит на треноге посреди каменной площадки. Под ним - магический круг рун:
  // светится цветом зелья, от тапов вспыхивает, из него поднимаются искорки.
  let fireBoost = 0;                 // вспышка от тапов
  let sparks = [], sparkIn = 0;
  let standName = null, standIm = null;
  function setStand(name) {
    if (name === standName) return;
    standName = name; standIm = null;
    if (name) Sprites.get(name, (im) => { if (standName === name) { standIm = im; silDirty = true; } });
  }

  function legY() { return g.pot.y + g.pot.h * 0.99; }
  function footY() { return g.foot || (g.pot.y + g.pot.h + g.r * 0.6); }

  function logsRect() {
    const r = g.r;
    const w = r * 1.9, h = r * 1.22;
    const crossY = legY();
    return { x: g.cx - w / 2, y: crossY - h * 0.55, w, h, crossY };
  }
  function standRect() {
    const sw = g.pot.w * STAND.w, sh = sw * (standIm ? standIm.naturalHeight / standIm.naturalWidth : STAND.aspect);
    const fy = footY();
    return { x: g.cx - sw / 2, y: fy - sh, w: sw, h: sh };
  }

  function fireIntensity() {
    const excited = face.mood === 'excited' ? 0.25 : 0;
    return 0.85 + 0.08 * Math.sin(t * 2.1) + fireBoost * 0.8 + excited;
  }

  function updateFire(dt) {
    const r = g.r;
    fireBoost = Math.max(0, fireBoost - dt * 1.2);
    if (RenderOpts.lowfx) { sparks.length = 0; return; }
    const k = fireIntensity();
    sparkIn -= dt;
    if (sparkIn <= 0) {
      sparkIn = rand(0.18, 0.45) / k;
      const life = rand(1.2, 2.2), a = rand(0, TAU), rx = r * 1.25;
      sparks.push({ x: g.cx + Math.cos(a) * rx * rand(0.55, 1), y: footY() + Math.sin(a) * rx * 0.3 * rand(0.55, 1),
        vx: rand(-0.08, 0.08) * r, vy: -r * rand(0.35, 0.7), life, max: life, ph: rand(0, TAU) });
    }
    sparks.forEach((sp) => { sp.life -= dt; sp.x += (sp.vx + Math.sin(t * 3 + sp.ph) * r * 0.12) * dt; sp.y += sp.vy * dt; });
    sparks = sparks.filter((sp) => sp.life > 0);
  }

  // руны: у каждой свой рисунок из 2-3 черточек
  const RUNES = [];
  for (let i = 0; i < 12; i++) {
    const seg = [], n = 2 + (i % 2);
    let sd = i * 7.31 + 1;
    const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
    for (let j = 0; j < n; j++) seg.push([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
    RUNES.push(seg);
  }
  // круг рун на площадке и тень треноги
  function drawFireLight() {
    const cx = g.cx, fy = footY(), r = g.r;
    const k = fireIntensity();
    // тень под треногой
    ctx.save();
    ctx.translate(cx, fy);
    ctx.scale(1, 0.26);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.15);
    sh.addColorStop(0, 'rgba(10,4,20,.55)'); sh.addColorStop(0.7, 'rgba(10,4,20,.25)'); sh.addColorStop(1, 'rgba(10,4,20,0)');
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, TAU); ctx.fill();
    ctx.restore();
    const rx = r * 1.3, low = RenderOpts.lowfx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // мягкое сияние площадки
    ctx.globalAlpha = Math.min(1, 0.26 * k + 0.6 * fireBoost);
    const gs = glowSprite(liquid);
    ctx.drawImage(gs, cx - rx * 1.5, fy - rx * 0.5, rx * 3, rx);
    // сам круг
    ctx.translate(cx, fy);
    ctx.scale(1, 0.3);
    ctx.rotate(low ? 0 : t * 0.12);
    ctx.strokeStyle = mix(liquid, 0.35);
    ctx.lineCap = 'round';
    const lw = Math.max(1.5, r * 0.022);
    ctx.globalAlpha = Math.min(1, 0.55 * k);
    ctx.lineWidth = lw * 1.4;
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.stroke();
    if (fireBoost > 0.03) {
      // вспышка от тапа: кольцо раздувается широким сиянием
      ctx.save();
      ctx.globalAlpha = Math.min(1, fireBoost * 0.5);
      ctx.lineWidth = lw * (4 + fireBoost * 6);
      ctx.beginPath(); ctx.arc(0, 0, rx * (1 + (1 - fireBoost) * 0.06), 0, TAU); ctx.stroke();
      ctx.restore();
    }
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(0, 0, rx * 0.78, 0, TAU); ctx.stroke();
    ctx.globalAlpha = Math.min(1, 0.22 * k);
    ctx.beginPath(); ctx.arc(0, 0, rx * 0.5, 0, TAU); ctx.stroke();
    // руны между кольцами
    ctx.globalAlpha = Math.min(1, 0.7 * k);
    const rs = rx * 0.07;
    RUNES.forEach((seg, i) => {
      const a = i / RUNES.length * TAU;
      ctx.save();
      ctx.translate(Math.cos(a) * rx * 0.89, Math.sin(a) * rx * 0.89);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      seg.forEach((q) => { ctx.moveTo(q[0] * rs, q[1] * rs); ctx.lineTo(q[2] * rs, q[3] * rs); });
      ctx.stroke();
      ctx.restore();
    });
    // звезда в центре (видна между ножек)
    ctx.globalAlpha = Math.min(1, 0.28 * k);
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) { const a = i * TAU * 2 / 5 - Math.PI / 2; const px = Math.cos(a) * rx * 0.5, py = Math.sin(a) * rx * 0.5; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
    ctx.restore();
  }

  // тренога целиком - за котлом
  function drawFireBack() {
    if (!standIm) return;
    const R = standRect();
    ctx.drawImage(standIm, R.x, R.y, R.w, R.h);
  }

  // передний обод и ножки треноги - поверх дна котла
  function drawFireFront() {
    if (!standIm) return;
    const R = standRect(), cut = R.y + R.h * STAND.front;
    ctx.save();
    ctx.beginPath(); ctx.rect(R.x - 2, cut, R.w + 4, R.h);
    ctx.clip();
    ctx.drawImage(standIm, R.x, R.y, R.w, R.h);
    ctx.restore();
  }
  // искорки из круга рун - поверх всего, светятся
  function drawSparks() {
    if (!sparks.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const col = mix(liquid, 0.45);
    sparks.forEach((sp) => {
      const k = sp.life / sp.max, a = Math.sin(Math.PI * k);
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, Math.max(0.9, g.r * 0.02 * (0.4 + k)), 0, TAU); ctx.fill();
    });
    ctx.restore();
  }

  // ---------- тень котла на стене ----------
  // Свет идёт снизу от огня, поэтому тень большая, падает вверх и чуть дрожит.
  let silCv = null, silDirty = true;
  function buildSilhouette() {
    silDirty = false;
    if (!S.pot || RenderOpts.lowfx) { silCv = null; return; }
    silCv = silCv || document.createElement('canvas');
    silCv.width = Math.ceil(W); silCv.height = Math.ceil(H);
    const sc = silCv.getContext('2d');
    sc.clearRect(0, 0, W, H);
    const saved = ctx;
    ctx = sc;
    ctx.drawImage(S.pot, g.pot.x, g.pot.y, g.pot.w, g.pot.h);
    drawWear();
    ctx = saved;
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = '#12061F';
    sc.fillRect(0, 0, W, H);
    sc.globalCompositeOperation = 'source-over';
  }
  function drawWallShadow() {
    if (RenderOpts.lowfx || bgMeta().room) return;
    if (silDirty || !silCv) buildSilhouette();
    if (!silCv) return;
    const L = logsRect();
    const k = fireIntensity();
    const scale = 1.32 + 0.03 * Math.sin(t * 9) * Math.sin(t * 5.1) - fireBoost * 0.04;
    ctx.save();
    ctx.globalAlpha = 0.22 + 0.05 * (k - 0.85);
    if ('filter' in ctx) ctx.filter = 'blur(' + Math.max(2, g.r * 0.05) + 'px)';
    ctx.translate(g.cx, L.crossY);
    ctx.scale(scale, scale * 1.06);
    ctx.translate(-g.cx, -L.crossY);
    ctx.drawImage(silCv, 0, 0, W, H);
    ctx.restore();
  }

  // тёплый отсвет огня на дне котла
  let warmCv = null;
  function warmPot(src) {
    if (RenderOpts.lowfx) return src;
    const w = src.width || src.naturalWidth, hh = src.height || src.naturalHeight;
    warmCv = warmCv || document.createElement('canvas');
    if (warmCv.width !== w || warmCv.height !== hh) { warmCv.width = w; warmCv.height = hh; }
    const c = warmCv.getContext('2d');
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, w, hh);
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    const k = fireIntensity();
    const gr = c.createRadialGradient(w / 2, hh * 1.05, 0, w / 2, hh * 1.05, hh * 0.6);
    const lc = hexRgb(liquid);
    gr.addColorStop(0, 'rgba(' + lc + ',' + Math.min(0.6, 0.32 * k) + ')');
    gr.addColorStop(0.55, 'rgba(' + lc + ',' + (0.1 * k) + ')');
    gr.addColorStop(1, 'rgba(' + lc + ',0)');
    c.fillStyle = gr;
    c.fillRect(0, 0, w, hh);
    c.globalCompositeOperation = 'source-over';
    return warmCv;
  }

  // ---------- котёл ----------
  function drawPot() {
    const { cx, r } = g;
    const p = g.pot, L = g.liq;
    const lw = Math.max(3, r * 0.045);

    drawFireBack();

    const by = p.y + p.h;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(1 + squash * 0.35, 1 - squash * 0.35);
    ctx.translate(-cx, -by);

    if (S.pot) {
      ctx.drawImage(warmPot(potLayer || S.pot), p.x, p.y, p.w, p.h);
      if (liquidLayer) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(liquidLayer, p.x, p.y, p.w, p.h);
        ctx.globalCompositeOperation = 'source-over';
      }
    } else {
      // запасной котёл, пока картинка не загрузилась
      ellipse(cx, g.cy + r * 0.05, r * 1.08, r * 0.92);
      ctx.fillStyle = potColor || '#3E2F66'; ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
      ellipse(L.cx, L.cy, L.rx, L.ry);
      ctx.fillStyle = liquid; ctx.fill(); ctx.stroke();
    }

    // блик и пузырьки на поверхности зелья
    ctx.save();
    ellipse(L.cx, L.cy, L.rx * 0.98, L.ry * 0.95);
    ctx.clip();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = mix(liquid, 0.6);
    ellipse(L.cx - L.rx * 0.2 + Math.sin(t * 1.3) * L.rx * 0.12, L.cy - L.ry * 0.15, L.rx * 0.45, L.ry * 0.3); ctx.fill();
    surf.forEach((b) => {
      const k = b.life / b.dur;
      ctx.globalAlpha = 1 - k * 0.7;
      ctx.beginPath();
      ctx.arc(L.cx + b.ox * L.rx, L.cy + b.oy * L.ry * 0.8, b.max * (0.4 + k), 0, TAU);
      ctx.fillStyle = mix(liquid, 0.55); ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(26,14,44,.45)'; ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    drawSpoon();
    drawFace(lw);
    drawWear();
    ctx.restore();
    drawFireFront();
  }

  // ---------- ложка в котле ----------
  // Черпак скрыт в зелье, ручка торчит наискосок вправо-вверх.
  // В покое ложка покачивается, от тапа делает круг помешивания.
  let spoonName = null, spoonIm = null, stirA = 0, stirV = 0;
  function setSpoon(name) {
    if (name === spoonName) return;
    spoonName = name; spoonIm = null;
    if (name) Sprites.get(name, (im) => { if (spoonName === name) spoonIm = im; });
  }
  function updateSpoon(dt) {
    stirV *= Math.max(0, 1 - dt * 2.2);
    stirA += dt * (0.6 + stirV);
  }
  function drawSpoon() {
    if (!spoonIm) return;
    const L = g.liq, r = g.r;
    const size = r * 1.3, sh = size * spoonIm.naturalHeight / spoonIm.naturalWidth;
    // точка, где ручка входит в зелье, ходит по кругу при помешивании
    const amp = 0.1 + Math.min(0.2, stirV * 0.025);
    const ex = L.cx + L.rx * 0.3 + Math.cos(stirA) * L.rx * amp;
    const ey = L.cy - L.ry * 0.1 + Math.sin(stirA) * L.ry * amp * 0.9;
    const rot = -0.3 + Math.sin(stirA) * (0.05 + Math.min(0.12, stirV * 0.015));
    // рябь вокруг ручки на поверхности зелья
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = mix(liquid, 0.65);
    ctx.lineWidth = Math.max(1.5, r * 0.022);
    const rip = 1 + 0.12 * Math.sin(t * 5);
    ellipse(ex, ey + L.ry * 0.05, r * 0.11 * rip, L.ry * 0.32 * rip); ctx.stroke();
    ctx.globalAlpha = 0.25;
    ellipse(ex, ey + L.ry * 0.05, r * 0.19 * rip, L.ry * 0.52 * rip); ctx.stroke();
    ctx.restore();
    // сама ложка: видна только часть выше точки входа (вдоль ручки)
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(rot);
    const ax = 0.46 * size, ay = 0.6 * sh;   // шейка ложки на картинке - на уровне поверхности
    const big = size * 3, k = Math.SQRT1_2;
    ctx.beginPath();                          // полуплоскость в сторону ручки (вправо-вверх)
    ctx.moveTo(k * big, k * big);
    ctx.lineTo(k * big + k * big, k * big - k * big);
    ctx.lineTo(-k * big + k * big, -k * big - k * big);
    ctx.lineTo(-k * big, -k * big);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(spoonIm, -ax, -ay, size, sh);
    ctx.restore();
  }

  // ---------- украшения ----------
  function setWear(slot, id) {
    const item = id ? DATA.wardrobe.find((x) => x.id === id) : null;
    if (!item) { wear[slot] = null; silDirty = true; return; }
    wear[slot] = { item, im: null };
    silDirty = true;
    Sprites.get('wardrobe/' + id, (im) => { if (wear[slot] && wear[slot].item.id === id) { wear[slot].im = im; silDirty = true; } });
  }

  function drawWear() {
    const p = g.pot, L = g.liq, r = g.r;
    const head = wear.head;
    if (head && head.im) {
      const it = head.item, im = head.im;
      const w = p.w * (it.w || 0.55), h = w * im.naturalHeight / im.naturalWidth;
      const bx = g.cx + p.w * (it.x || 0);
      const bottom = L.cy + L.ry * (it.dy !== undefined ? it.dy : -0.2);
      ctx.save();
      ctx.translate(bx, bottom);
      ctx.rotate(it.rot !== undefined ? it.rot : -0.1);
      ctx.drawImage(im, -w / 2, -h, w, h);
      ctx.restore();
    }
    const fc = wear.face;
    if (fc && fc.im) {
      const it = fc.item, im = fc.im;
      const w = r * 1.3 * (it.w || 1), h = w * im.naturalHeight / im.naturalWidth;
      ctx.drawImage(im, g.cx - w / 2, g.cy - r * 0.02 - h / 2, w, h);
    }
  }

  // ---------- лицо ----------
  function drawFace(lw) {
    const { cx, cy, r } = g;
    const ey = cy - r * 0.02;
    const m = face.mood;
    ctx.fillStyle = 'rgba(255,143,177,.55)';
    [-1, 1].forEach((sd) => { ellipse(cx + sd * r * 0.56, cy + r * 0.2, r * 0.12, r * 0.065); ctx.fill(); });
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    [-1, 1].forEach((sd) => drawEye(cx + sd * r * 0.36, ey, lw));
    drawMouth(cx, cy + r * 0.33, lw);
    if (m === 'excited') {
      [-1, 1].forEach((sd) => sparkle(cx + sd * r * 0.62, ey - r * 0.22, r * 0.07 * (1 + 0.3 * Math.sin(t * 12)), '#FFE07A'));
    }
  }

  function drawEye(x, y, lw) {
    const { r } = g;
    const rx = r * 0.15, ry = r * 0.19;
    const m = face.mood;
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw * 1.1;
    if (m === 'happy') {
      ctx.beginPath(); ctx.arc(x, y + ry * 0.35, rx * 0.95, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
      return;
    }
    if (m === 'sleepy') {
      ctx.beginPath(); ctx.moveTo(x - rx, y + ry * 0.15); ctx.quadraticCurveTo(x, y + ry * 0.6, x + rx, y + ry * 0.15); ctx.stroke();
      return;
    }
    const k = m === 'wow' || m === 'excited' ? 1.15 : 1;
    const by = ry * k * (1 - face.blink * 0.92);
    if (by < 2.5) {
      ctx.beginPath(); ctx.moveTo(x - rx, y); ctx.lineTo(x + rx, y); ctx.stroke();
      return;
    }
    ellipse(x, y, rx * k, by);
    ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.lineWidth = lw * 0.8; ctx.stroke();
    const pr = r * (m === 'wow' ? 0.05 : 0.085);
    const px = x + face.look.x * rx * 0.45;
    const py = y + face.look.y * by * 0.4;
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(px, py, Math.min(pr, by * 0.8), 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(px - pr * 0.35, py - pr * 0.35, pr * 0.35, 0, TAU); ctx.fill();
  }

  function drawMouth(x, y, lw) {
    const { r } = g;
    const m = face.mood;
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;
    if (m === 'idle') {
      ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 0.14, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
      return;
    }
    if (m === 'sleepy') {
      ellipse(x, y, r * 0.045, r * 0.05); ctx.fillStyle = '#2A0F2E'; ctx.fill(); ctx.stroke();
      return;
    }
    if (m === 'wow') {
      ellipse(x, y, r * 0.075, r * 0.095); ctx.fillStyle = '#2A0F2E'; ctx.fill(); ctx.stroke();
      return;
    }
    const w = m === 'excited' ? r * 0.22 : r * 0.18;
    const d = m === 'excited' ? r * 0.3 : r * 0.22;
    ctx.beginPath();
    ctx.moveTo(x - w, y - r * 0.04);
    ctx.quadraticCurveTo(x, y + d, x + w, y - r * 0.04);
    ctx.closePath();
    ctx.fillStyle = '#2A0F2E'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#FF8FB1';
    ellipse(x, y + d * 0.55, w * 0.55, d * 0.3); ctx.fill();
    ctx.restore();
    ctx.stroke();
  }

  function sparkle(x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fill();
  }

  // ---------- волшебный пузырь ----------
  function drawGolden() {
    const b = golden;
    const fadeIn = Math.min(1, b.life / 0.3);
    const fadeOut = Math.min(1, (CONFIG.bubbleLifeSec - b.life) / 1.5);
    ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
    const R = b.r * (1 + Math.sin(b.life * 6) * 0.05);
    const gl = ctx.createRadialGradient(b.x, b.y, R * 0.5, b.x, b.y, R * 2);
    gl.addColorStop(0, 'rgba(255,220,120,.4)');
    gl.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(b.x, b.y, R * 2, 0, TAU); ctx.fill();
    if (S.bubble) ctx.drawImage(S.bubble, b.x - R * 1.05, b.y - R * 1.05, R * 2.1, R * 2.1);
    else { ctx.fillStyle = 'rgba(255,214,120,.8)'; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 3; i++) {
      const a = b.life * 2 + (i * TAU) / 3;
      sparkle(b.x + Math.cos(a) * R * 1.35, b.y + Math.sin(a) * R * 1.35, R * 0.16, '#FFE6A0');
    }
    ctx.globalAlpha = 1;
  }

  // ---------- кадр ----------
  // Дополнительные слои (питомцы, гнездо): back - за котлом, front - перед ним, ui - подписи поверх всего
  const extra = { back: null, front: null, ui: null };

  // ---------- слой предметов комнаты и его «освещение» ----------
  let fgCv = null, fgMask = null;
  // ---------- глубина: параллакс по наклону телефона ----------
  // par.x/par.y от −1 до 1. Без гироскопа - лёгкое медленное покачивание.
  const par = { x: 0, y: 0, tx: 0, ty: 0, gyro: false };
  if (typeof window !== 'undefined' && !createCauldron._gyro) {
    createCauldron._gyro = true;
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma === null) return;
      createCauldron._tilt = { x: clamp(e.gamma / 25, -1, 1), y: clamp(((e.beta || 45) - 45) / 30, -1, 1) };
    });
  }
  function updatePar(dt) {
    const tl = createCauldron._tilt;
    if (tl) { par.tx = tl.x; par.ty = tl.y; }
    else { par.tx = Math.sin(t * 0.35) * 0.35; par.ty = Math.sin(t * 0.23) * 0.2; }
    if (RenderOpts.lowfx) { par.tx = 0; par.ty = 0; }
    par.x += (par.tx - par.x) * Math.min(1, dt * 3);
    par.y += (par.ty - par.y) * Math.min(1, dt * 3);
  }
  // точка на картинке фона → точка на сцене
  const bgX = (fx) => bgGeom.ox + fx * bgGeom.dw;
  const bgY = (fy) => bgGeom.oy + fy * bgGeom.dh;
  function drawProps(layer) {
    const m = bgMeta();
    if (!m.props || !S.bg) return;
    m.props.forEach((p) => {
      if (p.layer !== layer) return;
      const im = Sprites.get(p.img);
      if (!im) return;
      const w = p.w * bgGeom.dw, hh = w * im.naturalHeight / im.naturalWidth;
      let x = bgX(p.x), y = bgY(p.y);
      if (p.top) {
        // висит сверху: верх картинки у края сцены
        y = Math.max(hh * 0.55, y) ;
        ctx.save();
        ctx.translate(x, y - hh);
        if (p.swing) ctx.rotate(Math.sin(t * 1.3) * 0.05);
        else ctx.rotate(Math.sin(t * 0.8 + x) * 0.02);
        ctx.drawImage(im, -w / 2, 0, w, hh);
        ctx.restore();
        return;
      }
      // тень касания для предметов на полу
      if (p.img !== 'scene/rug') {
        ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#12061F';
        ctx.beginPath(); ctx.ellipse(x, y - hh * 0.04, w * 0.45, hh * 0.08, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
      ctx.drawImage(im, x - w / 2, y - hh, w, hh);
    });
  }
  // лунный луч из окна и пылинки в нём
  function drawBeam() {
    const wn = bgMeta().window;
    if (!wn || !S.bg || RenderOpts.lowfx) return;
    const x = bgX(wn.x), y = bgY(wn.y), r = wn.r * bgGeom.dw;
    const fy = bgY(0.9);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // днём луч тёплый и яркий, ночью лунный и слабый, в непогоду тускнеет
    const sun = 1 - nightK, wk = weather ? weather.k : 0;
    const bc = Math.round(170 + 85 * sun) + ',' + Math.round(190 + 36 * sun) + ',' + Math.round(255 - 85 * sun);
    const ba = (0.13 + 0.13 * sun) * (1 - 0.6 * wk);
    const gr = ctx.createLinearGradient(0, y, 0, fy);
    gr.addColorStop(0, 'rgba(' + bc + ',' + ba + ')'); gr.addColorStop(0.6, 'rgba(' + bc + ',' + ba * 0.4 + ')'); gr.addColorStop(1, 'rgba(' + bc + ',0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.75, y); ctx.lineTo(x + r * 0.75, y);
    ctx.lineTo(x + r * 0.2 + r * 1.2, fy); ctx.lineTo(x - r * 0.2 - r * 0.9, fy); ctx.closePath();
    ctx.fill();
    // пылинки в луче: днём золотые и их больше
    ctx.fillStyle = sun > 0.5 ? '#FFF1C8' : '#E8EEFF';
    for (let i = 0, n = Math.round(14 + 12 * sun); i < n; i++) {
      const k = ((i * 0.618 + t * 0.03 * (1 + (i % 3) * 0.3)) % 1);
      const py = y + (fy - y) * k;
      const half = r * 0.75 + (r * 0.95) * k;
      const px = x + Math.sin(i * 12.9 + t * 0.4) * half * 0.8 + r * 0.15 * k;
      ctx.globalAlpha = (0.4 + 0.3 * sun) * (1 - 0.7 * wk) * Math.sin(k * Math.PI) * (0.5 + 0.5 * Math.sin(t * 2 + i));
      ctx.beginPath(); ctx.arc(px, py, 1 + (i % 3) * 0.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // житель у прилавка: стоит за прилавком слева от котла (рисует модуль Visitors)
  function drawVisitor() {
    if (typeof Visitors === 'undefined' || !Visitors.draw || !bgMeta().counter) return;
    Visitors.draw(ctx, { W, H, t, size: g.r, potLeft: g.cx - g.r * 1.35, counterTop: counterTop() });
  }
  function counterTop() {
    const im = Sprites.get('r2/counter');
    const w = W * 1.06, hh = im ? w * im.naturalHeight / im.naturalWidth : W * 0.33;
    return H - hh * 0.94 + hh * 0.3;
  }
  // на низком холсте (превью в гардеробе) прилавок не рисуем
  const showCounter = () => H > W * 0.9;
  // прилавок: во всю ширину, внизу сцены (ближе к зрителю - сильнее сдвигается)
  function drawCounter() {
    const m = bgMeta();
    if (!m.counter || !showCounter()) return;
    const im = Sprites.get('r2/counter');
    if (!im) return;
    const w = W * 1.06, hh = w * im.naturalHeight / im.naturalWidth;
    ctx.save(); ctx.translate(par.x * 6, par.y * 2);
    drawVisitor();
    ctx.drawImage(im, (W - w) / 2, H - hh * 0.94, w, hh);
    ctx.restore();
  }
  // передний план: висящие травы и фонарь - ближе всех, темнее и чуть размыты
  function drawForeground() {
    const m = bgMeta();
    if (!m.props && !m.room) return;
    ctx.save();
    ctx.translate(par.x * 12, par.y * 5);
    if (m.props && !RenderOpts.lowfx && 'filter' in ctx) ctx.filter = 'blur(0.8px) brightness(.95)';
    drawProps('fg');
    ctx.filter = 'none';
    drawRoomDyn('top');
    ctx.restore();
  }
  function beginLayer() {
    const w = Math.round(W * dpr), hh = Math.round(H * dpr);
    if (!fgCv) { fgCv = document.createElement('canvas'); fgMask = document.createElement('canvas'); }
    if (fgCv.width !== w || fgCv.height !== hh) { fgCv.width = fgMask.width = w; fgCv.height = fgMask.height = hh; }
    const c = fgCv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1; c.filter = 'none';
    c.clearRect(0, 0, w, hh);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
  }
  function gradeLayer() {
    const c = fgCv.getContext('2d'), w = fgCv.width, hh = fgCv.height;
    const m = fgMask.getContext('2d');
    m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'copy'; m.drawImage(fgCv, 0, 0);
    c.setTransform(1, 0, 0, 1, 0, 0);
    // 1) чёрная обводка становится тёмно-сливовой, как тени на фоне
    c.globalCompositeOperation = 'lighten';
    c.fillStyle = '#2E1C44'; c.fillRect(0, 0, w, hh);
    // 2) общий тон комнаты: к краям темнее и холоднее
    c.globalCompositeOperation = 'multiply';
    const k = dpr, fx = g.cx * k, fy = footY() * k;
    const tone = c.createRadialGradient(fx, fy, g.r * 0.6 * k, fx, fy, Math.max(W, H) * 0.8 * k);
    // ночью котёл и питомцы тоже в синей тени, днём чуть теплее - вшито в тот же тон
    const nt = bgMeta().room && !RenderOpts.lowfx ? [255 - 35 * nightK, 255 - 37 * nightK - 6 * (1 - nightK), 255 - 15 * nightK - 22 * (1 - nightK)] : [255, 255, 255];
    const tc = (hex) => { const n = parseInt(hex.slice(1), 16); return 'rgb(' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v * nt[i] / 255)).join(',') + ')'; };
    tone.addColorStop(0, tc('#FFFFFF')); tone.addColorStop(0.5, tc('#EEE6F8')); tone.addColorStop(1, tc('#C4B4DE'));
    c.fillStyle = tone; c.fillRect(0, 0, w, hh);
    // 3) свет круга рун на всём, что рядом
    c.globalCompositeOperation = 'soft-light';
    const fi = fireIntensity(), lc = hexRgb(liquid);
    const warm = c.createRadialGradient(fx, fy, 0, fx, fy, g.r * 2.4 * k);
    warm.addColorStop(0, 'rgba(' + lc + ',' + Math.min(0.8, 0.5 * fi) + ')');
    warm.addColorStop(0.5, 'rgba(' + lc + ',' + (0.2 * fi) + ')');
    warm.addColorStop(1, 'rgba(' + lc + ',0)');
    c.fillStyle = warm; c.fillRect(0, 0, w, hh);
    // вернуть прозрачность исходных картинок
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(fgMask, 0, 0);
    c.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fgCv, 0, 0); ctx.restore();
  }
  function geom() {
    const L = logsRect();
    return { W, H, cx: g.cx, cy: g.cy, r: g.r, liq: g.liq, pot: g.pot, ground: bgMeta().room ? footY() : L.y + L.h * 0.86, front: bgMeta().counter && showCounter() ? counterTop() : null, props: frontProps(), night: nightK, t, squash, potBottom: g.pot.y + g.pot.h, liquid };
  }
  function render() {
    frontCache = null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBg();
    drawAmbient();
    // тень на стене и свет костра лежат прямо на фоне
    drawWallShadow();
    drawFireLight();
    // всё, что стоит в комнате (котёл, костёр, питомцы, лежанка), рисуем отдельным слоем
    // и «вписываем» в комнату: обводка в цвет теней, общий тон, тёплый свет от огня
    const grade = !RenderOpts.lowfx && W > 1 && perfLvl < 2;
    const main = ctx;
    if (grade) ctx = beginLayer();
    ctx.save(); ctx.translate(-par.x * 2, -par.y * 1);
    drawProps('floor');
    ctx.restore();
    ctx.save(); ctx.translate(-par.x * 4, -par.y * 2.4);
    drawRoomDyn('back');
    ctx.restore();
    if (extra.back) extra.back(ctx, geom());
    drawPot();
    if (extra.front) extra.front(ctx, geom());
    drawCounter();
    drawForeground();
    if (grade) { ctx = main; gradeLayer(); }
    drawSparks();
    if (extra.ui) extra.ui(ctx, geom());

    rise.forEach((b) => {
      const k = b.life / b.dur;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fillStyle = mix(liquid, 0.3); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(26,14,44,.6)'; ctx.stroke();
    });
    ctx.globalAlpha = 1;

    ctx.font = '900 ' + Math.round(g.r * 0.2) + 'px Nunito, system-ui, sans-serif';
    ctx.textAlign = 'center';
    zs.forEach((z) => {
      ctx.globalAlpha = Math.max(0, 1 - z.life / 2.4);
      ctx.fillStyle = '#C7B6E6';
      ctx.fillText('z', z.x, z.y);
    });
    ctx.globalAlpha = 1;

    if (golden) drawGolden();

    parts.forEach((p) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    floats.forEach((f) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.6));
      ctx.font = '900 ' + f.size + 'px Nunito, system-ui, sans-serif';
      ctx.lineWidth = 4; ctx.strokeStyle = INK;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  // ---------- взаимодействие ----------
  function hit(x, y) {
    if (golden) {
      const dx = x - golden.x, dy = y - golden.y;
      if (dx * dx + dy * dy <= (golden.r + 16) * (golden.r + 16)) return 'golden';
    }
    const nx = (x - g.cx) / (g.r * 1.18), ny = (y - (g.cy - g.r * 0.15)) / (g.r * 1.2);
    if (nx * nx + ny * ny <= 1) return 'pot';
    return null;
  }

  function burst(x, y, colors, n, speed, grav) {
    if (RenderOpts.lowfx) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(0.3, 1) * speed;
      const life = rand(0.5, 0.9);
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: grav, life, max: life, s: rand(2, 4.5), c: colors[i % colors.length] });
    }
  }

  function onClick(x, y, text) {
    const now = performance.now();
    lastClick = now; lastInput = now;
    clickTimes.push(now);
    squashV += 4.5;
    fireBoost = Math.min(1, fireBoost + 0.18);
    stirV = Math.min(14, stirV + 2.2);
    const n = RenderOpts.lowfx ? 2 : 6;
    for (let i = 0; i < n; i++) {
      const life = rand(0.5, 0.8);
      parts.push({ x: g.cx + rand(-0.5, 0.5) * g.r, y: g.rimY, vx: rand(-120, 120), vy: -rand(220, 380), g: 900, life, max: life, s: rand(2.5, 5), c: i % 2 ? liquid : mix(liquid, 0.5) });
    }
    if (text) floatText(x + rand(-12, 12), y - 14, text, '#FFC94D', 22);
    face.target = { x: clamp((x - g.cx) / g.r, -1, 1), y: clamp((y - g.cy) / g.r, -0.6, 1) };
    face.lookIn = 1.2;
  }

  function floatText(x, y, text, color, size) {
    floats.push({ x, y, text, color: color || '#FFC94D', size: size || 22, life: 1.1, vy: -95 });
    if (floats.length > 40) floats.shift();
  }

  function poke() {
    const now = performance.now();
    const wasSleepy = now - lastInput > 25000;
    lastInput = now;
    return wasSleepy;
  }

  function spawnGolden() {
    const life = CONFIG.bubbleLifeSec;
    const x0 = W * rand(0.18, 0.82);
    golden = { x0, x: x0, y: H + 40, vy: -(H + 110) / (life * 0.9), r: Math.max(22, g.r * 0.26), life: 0 };
  }

  function popGolden() {
    if (!golden) return null;
    const p = { x: golden.x, y: golden.y };
    burst(p.x, p.y, ['#FFC94D', '#FF8FB1', '#FFFFFF', '#8FB8FF'], 26, 260, 120);
    golden = null;
    return p;
  }

  function setMood(m, ms) { face.forced = m; face.forcedUntil = performance.now() + ms; }

  return {
    init, resize, update, render, hit, onClick, floatText, poke,
    spawnGolden, popGolden, hasGolden: () => !!golden,
    setMood, mood: () => face.mood, setWear, setSpoon, setStand, setBackground, setAmbient,
    setExtra(back, front, ui) { extra.back = back; extra.front = front; extra.ui = ui || null; frontToExtra = !!front; }, geom,
    propAt, tapProp, propRect,
    warm(n) { fireBoost = Math.min(1, fireBoost + (n || 0.2)); },
    setLiquid(c) { liquid = c; tintLiquid(); },
    setPotColor(c) { potColor = c || null; tintPot(); },
    anchor: () => ({ x: g.cx, y: g.rimY - g.r * 0.55 }),
    center: () => ({ x: g.cx, y: g.cy })
  };
}

const Cauldron = createCauldron();

// Надёжная загрузка файлов игры.
// Каждый файл скачивается целиком (не больше 3 одновременно), проверяется по размеру из манифеста,
// картинка - ещё и что она открывается. Проверенный файл кладётся в память (blob), и игра
// дальше берёт его оттуда: рамки CSS, картинки на странице, холст и звуки уже не ходят в сеть.
// Не пришёл или пришёл оборванным - повтор мимо кэша (до 6 раз с паузой).
const Loader = (() => {
  const files = typeof MANIFEST !== 'undefined' ? MANIFEST.files : {};
  const bad = new Set();
  let active = 0;
  // сколько файлов качать одновременно: начинаем с 6, при первой же ошибке сервер «устал» - дальше по 2
  let limit = 6, streak = 0;
  const queue = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // 'assets/images/ui/gear.webp?v=1' → 'images/ui/gear.webp'
  const keyOf = (url) => String(url).replace(/^.*?assets\//, '').replace(/[?#].*$/, '');
  const isImg = (k) => /\.(webp|png|jpg)$/.test(k);

  function checkImage(blob) {
    if (typeof createImageBitmap === 'function') return createImageBitmap(blob).then((b) => { if (b.close) b.close(); });
    return new Promise((res, rej) => { const u = URL.createObjectURL(blob), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('img')); }; im.src = u; });
  }
  function fetchOne(k, attempt) {
    if (ASSET_BLOBS[k]) return Promise.resolve(true);
    const url = 'assets/' + k + '?v=' + ASSET_V + (attempt ? '&r=' + attempt + '.' + Date.now() : '');
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const to = setTimeout(() => ctl && ctl.abort(), 20000);
    return fetch(url, { cache: attempt ? 'reload' : 'default', signal: ctl ? ctl.signal : undefined })
      .then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.blob(); })
      .then((b) => {
        const need = files[k];
        if (need !== undefined && b.size !== need) throw new Error('size ' + b.size + '/' + need);
        if (!b.size) throw new Error('empty');
        // размер совпал с манифестом - файл целый; без манифеста проверяем, что картинка открывается
        return (isImg(k) && need === undefined ? checkImage(b) : Promise.resolve()).then(() => {
          ASSET_BLOBS[k] = URL.createObjectURL(isImg(k) && !b.type ? new Blob([b], { type: 'image/webp' }) : b);
          bad.delete(k);
          // сервер снова отвечает ровно - понемногу возвращаем скорость
          if (++streak >= 12 && limit < 6) { limit++; streak = 0; pump(); }
          return true;
        });
      })
      .catch((e) => {
        limit = 2; streak = 0;
        if (attempt < 6) return wait(400 * (attempt + 1) + Math.random() * 300).then(() => fetchOne(k, attempt + 1));
        bad.add(k);
        console.warn('Файл не загрузился', k, e && e.message);
        return false;
      })
      .finally(() => clearTimeout(to));
  }
  function pump() {
    while (active < limit && queue.length) {
      const job = queue.shift();
      if (ASSET_BLOBS[job.k]) { job.resolve(true); continue; }
      active++;
      fetchOne(job.k, 0).then((ok) => { active--; job.resolve(ok); pump(); });
    }
  }
  // загрузить список (адреса или ключи); onStep(сколько готово, всего)
  function load(urls, limit, onStep) {
    const list = [...new Set(urls.map(keyOf))].filter((k) => k && !k.startsWith('blob:'));
    let n = 0;
    const ps = list.map((k) => new Promise((resolve) => {
      queue.push({ k, resolve: (ok) => { n++; if (onStep) onStep(n, list.length); resolve(ok); } });
    }));
    pump();
    return Promise.all(ps);
  }

  // Рамки и кнопки в CSS берутся из переменных --i-<путь>: сначала адрес, после проверки - blob
  const cssVar = (k) => '--i-' + k.replace(/^images\//, '').replace(/\.\w+$/, '').replace(/[^a-z0-9]+/gi, '-');
  function setCssVars() {
    const st = document.documentElement.style;
    Object.keys(files).filter((k) => k.startsWith('images/hud/') || k.startsWith('images/backgrounds/')).forEach((k) => {
      const u = ASSET_BLOBS[k] || new URL('assets/' + k + '?v=' + ASSET_V, location.href).href;
      st.setProperty(cssVar(k), 'url("' + u + '")');
    });
  }
  setCssVars();
  // картинки на странице переводим на проверенные копии из памяти
  function swapImages(root) {
    (root || document).querySelectorAll('img[src*="assets/"]').forEach((im) => {
      const k = keyOf(im.getAttribute('src'));
      if (ASSET_BLOBS[k]) { delete im.dataset.retry; im.src = ASSET_BLOBS[k]; }
    });
  }
  // новые <img> со старым адресом (например, вставленные до конца загрузки) - тоже на blob
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.tagName === 'IMG') { const k = keyOf(n.getAttribute('src') || ''); if (ASSET_BLOBS[k]) n.src = ASSET_BLOBS[k]; }
      else if (n.querySelector && Object.keys(ASSET_BLOBS).length) swapImages(n);
    }))).observe(document.documentElement, { childList: true, subtree: true });
  }

  // <img>, которая не загрузилась, - докачать через загрузчик и подставить blob
  document.addEventListener('error', (e) => {
    const im = e.target;
    if (!im || im.tagName !== 'IMG' || !im.src || im.src.startsWith('data:')) return;
    const k = keyOf(im.getAttribute('src'));
    if (ASSET_BLOBS[k]) { if (im.src !== ASSET_BLOBS[k]) im.src = ASSET_BLOBS[k]; return; }
    const n = +(im.dataset.retry || 0);
    if (n >= 3) return;
    im.dataset.retry = n + 1;
    load([k], 3).then(([ok]) => { if (ok) im.src = ASSET_BLOBS[k]; });
  }, true);

  // кэш через Service Worker (работает на https и на localhost)
  function registerSW() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    // сразу, а не после загрузки страницы: так в кэш попадёт уже первая загрузка
    navigator.serviceWorker.register('sw.js?v=' + ASSET_V).catch(() => {});
  }
  registerSW();

  // ---------- оживлённая заставка: книга рецептов ----------
  // Слои от дальнего к ближнему, при наклоне телефона ближние сдвигаются сильнее:
  // книга со столом → свет, огонёк свечи, дым и пузыри из котла → странички, звёзды, мотыльки, пыль →
  // пучки трав сверху → название «Бульк» → банка с зельем и перо (размыты, ближе всех).
  const splash = (() => {
    const cv = document.getElementById('boot-cv');
    if (!cv) return { stop() {} };
    const ctx = cv.getContext('2d');
    const SP = {};
    const load1 = (n, path) => { const im = new Image(); im.src = IMG(path || 'splash/' + n); SP[n] = im; };
    load1('bg', 'ui/splash_book');
    ['logo', 'lavender', 'herbs', 'flame', 'page1', 'page2', 'page3', 'moth1', 'moth2', 'star1', 'star2', 'star3',
      'bottle', 'quill', 'bubble1', 'bubble2', 'bubble3', 'bubble4', 'bubble5', 'bubble6'].forEach((n) => load1(n));
    // дым берём из игры
    ['smoke1', 'smoke2', 'smoke3'].forEach((n) => load1(n));
    const ok = (n) => SP[n] && SP[n].complete && SP[n].naturalWidth > 0;
    const R = (a, b) => a + Math.random() * (b - a);
    // точки на картинке книги (доли ширины и высоты)
    const POT = { x: 0.5, y: 0.455 }, CHIMNEY = { x: 0.787, y: 0.33 }, CANDLE = { x: 0.1, y: 0.262 };
    const LIGHTS = [
      { x: 0.1, y: 0.235, r: 0.22, c: '255,170,70', k: 'fire' },
      { x: 0.755, y: 0.502, r: 0.07, c: '255,190,90', k: 'fire' },
      { x: 0.687, y: 0.413, r: 0.06, c: '255,200,110', k: 'win' }, { x: 0.85, y: 0.41, r: 0.05, c: '255,200,110', k: 'win' },
      { x: 0.685, y: 0.49, r: 0.07, c: '255,200,110', k: 'win' },
      { x: 0.955, y: 0.3, r: 0.1, c: '140,255,90', k: 'pot' },
      { x: 0.24, y: 0.33, r: 0.06, c: '255,220,120', k: 'star' }, { x: 0.72, y: 0.25, r: 0.06, c: '255,220,120', k: 'star' },
      { x: 0.5, y: 0.46, r: 0.22, c: '140,255,90', k: 'pot' }
    ];
    // парящие странички, звёзды и мотыльки - в долях экрана
    const PAGES = [{ n: 'page1', x: 0.13, y: 0.5, w: 0.2, ph: 0 }, { n: 'page2', x: 0.88, y: 0.56, w: 0.2, ph: 2 }, { n: 'page3', x: 0.2, y: 0.69, w: 0.22, ph: 4 }];
    const STARS = [{ n: 'star1', x: 0.9, y: 0.4, w: 0.08, ph: 1 }, { n: 'star2', x: 0.08, y: 0.4, w: 0.065, ph: 3 }, { n: 'star3', x: 0.62, y: 0.33, w: 0.05, ph: 5 }];
    const MOTHS = [{ n: 'moth1', cx: 0.3, cy: 0.42, ax: 0.16, ay: 0.08, sp: 0.35, ph: 0, w: 0.17 }, { n: 'moth2', cx: 0.72, cy: 0.62, ax: 0.18, ay: 0.06, sp: 0.28, ph: 2.5, w: 0.15 }];
    const bubbles = [], dust = [], smokes = [];
    for (let i = 0; i < 26; i++) dust.push({ x: R(0, 1), y: R(0.15, 0.95), vx: R(-0.01, 0.01), vy: R(-0.015, -0.004), ph: R(0, 6.3), s: R(0.8, 2) });
    let W = 0, H = 0, dpr = 1, t0 = performance.now(), last = t0, raf = 0, bIn = 0, sIn = 0.2, cIn = 0.5;
    const tilt = { x: 0, y: 0, tx: 0, ty: 0, gyro: false };
    const onTilt = (e) => { if (e.gamma !== null) { tilt.gyro = true; tilt.tx = Math.max(-1, Math.min(1, e.gamma / 25)); tilt.ty = Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 30)); } };
    window.addEventListener('deviceorientation', onTilt);
    let blurCache = {};
    function size() {
      const rc = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rc.width; H = rc.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      blurCache = {};
    }
    size();
    window.addEventListener('resize', size);
    // предметы переднего плана слегка размыты - готовим копию один раз
    function blurred(n, w, h) {
      const key = n + Math.round(w);
      if (blurCache[key]) return blurCache[key];
      const c = document.createElement('canvas'); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
      const x = c.getContext('2d');
      if ('filter' in x) x.filter = 'blur(' + (1.4 * dpr) + 'px) brightness(.95)';
      x.drawImage(SP[n], 0, 0, c.width, c.height);
      return (blurCache[key] = c);
    }
    function fit(zoom, px0, py0) {
      const im = SP.bg;
      const k0 = Math.max(W / im.naturalWidth, H / im.naturalHeight) * 1.03;
      const dw0 = im.naturalWidth * k0, dh0 = im.naturalHeight * k0;
      const px = (W - dw0) / 2 + POT.x * dw0, py = (H - dh0) * 0.5 + POT.y * dh0;
      const dw = dw0 * zoom, dh = dh0 * zoom;
      const ox = px - POT.x * dw + px0, oy = py - POT.y * dh + py0;
      return { dw, dh, ox, oy, X: (fx) => ox + fx * dw, Y: (fy) => oy + fy * dh };
    }
    let logoCv = null;
    function logoFrame(w, h, shine) {
      if (!logoCv) logoCv = document.createElement('canvas');
      const cw = Math.ceil(w * dpr), ch = Math.ceil(h * dpr);
      if (logoCv.width !== cw || logoCv.height !== ch) { logoCv.width = cw; logoCv.height = ch; }
      const x = logoCv.getContext('2d');
      x.globalCompositeOperation = 'source-over';
      x.clearRect(0, 0, cw, ch);
      x.drawImage(SP.logo, 0, 0, cw, ch);
      if (shine >= 0 && shine <= 1) {
        x.globalCompositeOperation = 'source-atop';
        const sx = (-0.3 + shine * 1.6) * cw;
        const g = x.createLinearGradient(sx - cw * 0.12, 0, sx + cw * 0.12, ch * 0.4);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,240,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(0, 0, cw, ch);
      }
      return logoCv;
    }
    function sprite(n, x, y, w, ax, ay, rot, alpha, sx, sy) {
      if (!ok(n)) return;
      const im = SP[n], h = w * im.naturalHeight / im.naturalWidth;
      ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : Math.max(0, Math.min(1, alpha));
      ctx.translate(x, y); if (rot) ctx.rotate(rot); if (sx || sy) ctx.scale(sx || 1, sy || 1);
      ctx.drawImage(im, -w * ax, -h * ay, w, h);
      ctx.restore();
    }
    function glow(x, y, r, c, a) {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(' + c + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + c + ',0)');
      ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!tilt.gyro) { tilt.tx = Math.sin(t * 0.5) * 0.45; tilt.ty = Math.sin(t * 0.33) * 0.3; }
      tilt.x += (tilt.tx - tilt.x) * Math.min(1, dt * 3); tilt.y += (tilt.ty - tilt.y) * Math.min(1, dt * 3);
      const par = (k) => [-tilt.x * k, -tilt.y * k * 0.6];
      if (!ok('bg')) { raf = requestAnimationFrame(frame); return; }
      // 1) книга
      const zoom = 1 + 0.035 * (1 - Math.exp(-t / 5));
      const [bx, by] = par(6);
      const g = fit(zoom, bx, by);
      ctx.drawImage(SP.bg, g.ox, g.oy, g.dw, g.dh);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      LIGHTS.forEach((L, i) => {
        const a = L.k === 'fire' ? 0.22 + 0.08 * Math.sin(t * 11 + i * 2) + 0.05 * Math.sin(t * 23 + i)
          : L.k === 'pot' ? 0.18 + 0.1 * Math.sin(t * 2.2 + i) : L.k === 'star' ? 0.15 + 0.15 * Math.max(0, Math.sin(t * 1.8 + i)) : 0.12 + 0.04 * Math.sin(t * 1.3 + i);
        glow(g.X(L.x), g.Y(L.y), L.r * g.dw, L.c, a);
      });
      ctx.restore();
      // огонёк свечи дрожит поверх нарисованного
      {
        const fl = 1 + 0.08 * Math.sin(t * 13) + 0.05 * Math.sin(t * 29), sw = Math.sin(t * 7) * 0.06;
        sprite('flame', g.X(CANDLE.x), g.Y(CANDLE.y), g.dw * 0.07, 0.5, 0.95, sw, 1, 1 - (fl - 1) * 0.5, fl);
      }
      // 2) дым и пузыри из котла, дымок из трубы
      const smokeN = () => 'smoke' + (1 + Math.floor(Math.random() * 3));
      sIn -= dt;
      if (sIn <= 0) { sIn = R(0.9, 1.5); smokes.push({ n: smokeN(), x: POT.x + R(-0.03, 0.03), y0: POT.y, life: 0, dur: R(4, 5.5), flip: Math.random() < 0.5, w: R(0.14, 0.2), rise: 0.3, a: 0.35 }); }
      cIn -= dt;
      if (cIn <= 0) { cIn = R(0.8, 1.4); smokes.push({ n: smokeN(), x: CHIMNEY.x, y0: CHIMNEY.y, life: 0, dur: R(2.5, 3.5), flip: Math.random() < 0.5, w: R(0.06, 0.08), rise: 0.1, a: 0.45 }); }
      for (let i = smokes.length - 1; i >= 0; i--) {
        const sm = smokes[i]; sm.life += dt; if (sm.life > sm.dur) { smokes.splice(i, 1); continue; }
        const k = sm.life / sm.dur;
        const x = g.X(sm.x) + Math.sin(t * 0.8 + i) * W * sm.w * 0.15, y = g.Y(sm.y0) - k * H * sm.rise;
        sprite(sm.n, x, y, W * sm.w * (0.6 + k * 0.8), 0.5, 1, 0, Math.sin(Math.PI * k) * sm.a, sm.flip ? -1 : 1, 1);
      }
      bIn -= dt;
      if (bIn <= 0) { bIn = R(0.15, 0.35); bubbles.push({ n: 'bubble' + (1 + Math.floor(Math.random() * 6)), x: POT.x + R(-0.06, 0.06), y: POT.y - 0.01, vy: R(0.04, 0.08), w: R(0.014, 0.032), ph: R(0, 6.3), life: 0, dur: R(1.8, 2.8) }); }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]; b.life += dt; b.y -= b.vy * dt;
        if (b.life > b.dur) { bubbles.splice(i, 1); continue; }
        const k = b.life / b.dur, pop = k > 0.9 ? 1 + (k - 0.9) * 5 : 1;
        sprite(b.n, g.X(b.x + Math.sin(t * 3 + b.ph) * 0.012), g.Y(b.y), b.w * g.dw * (0.6 + k * 0.5) * pop, 0.5, 0.5, 0, Math.min(1, k * 6) * (k > 0.9 ? 1 - (k - 0.9) * 10 : 1));
      }
      // 3) странички, звёзды, мотыльки, золотая пыль
      {
        const [px, py] = par(12);
        PAGES.forEach((pg) => {
          const x = W * (pg.x + Math.sin(t * 0.5 + pg.ph) * 0.025) + px, y = H * (pg.y + Math.sin(t * 0.8 + pg.ph) * 0.015) + py;
          sprite(pg.n, x, y, W * pg.w, 0.5, 0.5, Math.sin(t * 0.7 + pg.ph) * 0.12, 0.95, 1, 0.85 + 0.15 * Math.cos(t * 1.1 + pg.ph));
        });
        STARS.forEach((st) => {
          const p = 0.5 + 0.5 * Math.sin(t * 2 + st.ph);
          const x = W * st.x + px, y = H * (st.y + Math.sin(t * 1.2 + st.ph) * 0.01) + py;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(x, y, W * st.w * 1.3, '255,210,110', 0.25 + 0.25 * p); ctx.restore();
          sprite(st.n, x, y, W * st.w * (0.85 + 0.25 * p), 0.5, 0.5, Math.sin(t * 0.9 + st.ph) * 0.25);
        });
        MOTHS.forEach((m) => {
          const a = t * m.sp + m.ph;
          const x = W * (m.cx + Math.sin(a) * m.ax) + px, y = H * (m.cy + Math.sin(a * 2) * m.ay) + py + Math.sin(t * 9 + m.ph) * 3;
          const dir = Math.cos(a) >= 0 ? 1 : -1;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(x, y, W * m.w * 0.7, '255,230,140', 0.22 + 0.1 * Math.sin(t * 5 + m.ph)); ctx.restore();
          sprite(m.n, x, y, W * m.w, 0.5, 0.5, Math.cos(a) * 0.2, 1, dir * (0.55 + 0.45 * Math.abs(Math.sin(t * 14 + m.ph))), 1);
        });
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        dust.forEach((d) => {
          d.x += (d.vx + Math.sin(t * 0.7 + d.ph) * 0.005) * dt; d.y += d.vy * dt;
          if (d.y < 0.1) { d.y = 0.95; d.x = R(0, 1); }
          const a = Math.max(0, Math.sin(t * 1.7 + d.ph)) ** 2;
          const x = W * d.x + px, y = H * d.y + py;
          ctx.globalAlpha = a * 0.45; ctx.fillStyle = '#FFD98A'; ctx.beginPath(); ctx.arc(x, y, d.s * 3, 0, 6.283); ctx.fill();
          ctx.globalAlpha = a; ctx.fillStyle = '#FFF6D8'; ctx.beginPath(); ctx.arc(x, y, d.s, 0, 6.283); ctx.fill();
        });
        ctx.restore(); ctx.globalAlpha = 1;
      }
      // 4) пучки трав сверху качаются, как маятник
      {
        const [vx, vy] = par(15);
        sprite('lavender', W * 0.1 + vx, -H * 0.015 + vy, W * 0.27, 0.5, 0.02, Math.sin(t * 1.1) * 0.06);
        sprite('herbs', W * 0.9 + vx, -H * 0.02 + vy, W * 0.25, 0.5, 0.02, Math.sin(t * 0.95 + 1.3) * 0.06);
      }
      const top = ctx.createLinearGradient(0, 0, 0, H * 0.3);
      top.addColorStop(0, 'rgba(20,8,40,.45)'); top.addColorStop(1, 'rgba(20,8,40,0)');
      ctx.fillStyle = top; ctx.fillRect(0, 0, W, H * 0.3);
      // 5) название
      if (ok('logo')) {
        const lw = Math.min(W * 0.86, 500), lh = lw * SP.logo.naturalHeight / SP.logo.naturalWidth;
        const [lx, ly] = par(9);
        const cx = W / 2 + lx, cy = H * 0.06 + lh / 2 + ly + Math.sin(t * 1.6) * 4;
        const shine = ((t - 1) % 3.2) / 1.1;
        // в начале «выпрыгивает» с пружинкой
        const k = Math.min(1, t / 0.6), spring = 1 - Math.exp(-6 * k) * Math.cos(10 * k);
        const sc = (0.6 + 0.4 * spring) * (1 + Math.sin(t * 1.6 + 1) * 0.012);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(t * 0.9) * 0.015); ctx.scale(sc, sc);
        ctx.drawImage(logoFrame(lw, lh, shine), -lw / 2, -lh / 2, lw, lh);
        ctx.restore();
      }
      const bot = ctx.createLinearGradient(0, H * 0.72, 0, H);
      bot.addColorStop(0, 'rgba(20,8,40,0)'); bot.addColorStop(1, 'rgba(20,8,40,.55)');
      ctx.fillStyle = bot; ctx.fillRect(0, H * 0.72, W, H * 0.28);
      // 6) банка и перо - ближе всех
      {
        const [fx, fy] = par(24);
        [['bottle', 0.46, -0.04, 0], ['quill', 0.4, 1.04, 1]].forEach(([n, wk, ax, right]) => {
          if (!ok(n)) return;
          const im = SP[n], bw = W * wk, bh = bw * im.naturalHeight / im.naturalWidth;
          const x = right ? W - bw * 0.72 + fx : -bw * 0.3 + fx, y = H - bh * 0.92 + fy + Math.sin(t * 0.9 + right * 2) * 3;
          ctx.save(); ctx.translate(x, y); ctx.rotate(right ? 0.12 + Math.sin(t * 0.7) * 0.02 : -0.08);
          ctx.drawImage(blurred(n, bw, bh), 0, 0, bw, bh);
          if (!right) { ctx.globalCompositeOperation = 'lighter'; glow(bw * 0.5, bh * 0.68, bw * 0.45, '190,90,255', 0.15 + 0.1 * Math.sin(t * 2)); }
          ctx.restore();
        });
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return { stop() { cancelAnimationFrame(raf); window.removeEventListener('deviceorientation', onTilt); window.removeEventListener('resize', size); } };
  })();

  // ---------- советы и надписи на заставке ----------
  const TIPS = [
    'Тапай по котлу - так варится эссенция.',
    'Лавка варит и без тебя. Загляни через пару часов - эссенция накопится.',
    'Улучшай кладовую в «Лавке», чтобы эссенция копилась дольше.',
    'Каждый день - новые «Рецепт дня» и «Руна дня». За них дают кристаллы.',
    'Лови золотой пузырь - в нём много эссенции.',
    'Жители приходят с заказами. Выполняй их и подружись - друзья дарят подарки.',
    'Смешай ингредиенты во вкладке «Зелья» - новый рецепт попадёт в книгу.',
    'Зелья дают силу: быстрее варка, больше эссенции, чаще пузыри.',
    'Отправь питомца в поход - он принесёт ингредиенты, а иногда и яйцо.',
    'Яйцо вылупится, если держать его в тепле у котла.',
    'Новый ранг лавки - новая мебель и украшения в комнате.',
    'Лунные кристаллы тратятся на наряды для Булька и подсказки к рецептам.'
  ];
  const STATUS = ['Разогреваем котёл…', 'Собираем травы…', 'Будим питомцев…', 'Расставляем бутыльки…', 'Листаем книгу рецептов…', 'Зажигаем свечи…'];
  function startTexts() {
    const tip = document.getElementById('boot-tip-text'), st = document.getElementById('boot-status');
    let ti = Math.floor(Math.random() * TIPS.length), si = 0;
    const showTip = () => {
      if (!tip) return;
      tip.classList.remove('in'); void tip.offsetWidth;
      tip.textContent = TIPS[ti]; ti = (ti + 1) % TIPS.length;
      tip.classList.add('in');
    };
    showTip();
    const a = setInterval(showTip, 3800);
    const b = setInterval(() => { si = (si + 1) % STATUS.length; if (st) st.textContent = STATUS[si]; }, 1400);
    return () => { clearInterval(a); clearInterval(b); };
  }
  const stopTexts = startTexts();

  // ---------- экран загрузки ----------
  // Ждём ВСЕ картинки (со второго запуска они в кэше - это быстро), потом кнопка «Нажми, чтобы начать».
  // Первое касание заставки включает джингл (браузер не даёт звук без касания).
  function boot(critical, rest) {
    const el = document.getElementById('boot');
    const fill = document.getElementById('boot-fill'), pct = document.getElementById('boot-pct');
    const barBox = el && el.querySelector('.boot-bar'), status = document.getElementById('boot-status');
    const startBtn = document.getElementById('boot-start'), hint = document.getElementById('boot-hint');
    const t0 = performance.now();
    let shown = 0, target = 0;
    const tick = setInterval(() => {
      shown += (target - shown) * 0.25 + (shown < target ? 0.4 : 0);
      shown = Math.min(shown, target);
      if (fill) fill.style.width = Math.max(6, shown) + '%';
      if (pct) pct.textContent = Math.round(shown) + '%';
    }, 50);
    // звук с первого касания заставки
    const touch = () => { if (typeof Sound !== 'undefined') Sound.intro(); if (hint) hint.classList.add('off'); };
    if (el) el.addEventListener('pointerdown', touch, { once: true });
    const enter = () => {
      if (!el || el.classList.contains('hide')) return;
      touch();
      el.classList.add('hide');
      setTimeout(() => { clearInterval(tick); stopTexts(); splash.stop(); el.remove(); }, 550);
    };
    const ready = () => {
      target = 100; shown = 100;
      if (fill) fill.style.width = '100%';
      if (pct) pct.textContent = '100%';
      setTimeout(() => {
        if (barBox) barBox.hidden = true;
        if (status) status.hidden = true;
        if (startBtn) { startBtn.hidden = false; startBtn.addEventListener('click', enter); }
        else enter();
      }, 300);
    };
    // сначала то, что видно сразу, потом все остальные файлы игры
    const lazy = (typeof MANIFEST !== 'undefined' && MANIFEST.lazy) || [];
    const all = [...new Set(critical.concat(rest).map(keyOf).concat(Object.keys(files)))].filter((k) => !lazy.some((p) => k.startsWith(p)));
    let doneN = 0;
    const finish = () => {
      setCssVars(); swapImages();
      if (typeof Sprites !== 'undefined' && Sprites.refresh) Sprites.refresh();
      ready();
    };
    // не держим игрока дольше 90 секунд, даже если сеть совсем плохая (недостающее докачается в игре)
    const guard = setTimeout(finish, 90000);
    load(all, 0, () => { doneN++; target = Math.round(100 * doneN / all.length); })
      .then(() => {
        // второй круг для того, что не пришло
        const miss = all.filter((k) => !ASSET_BLOBS[k]);
        return miss.length ? load(miss, 2) : null;
      })
      .then(() => setTimeout(() => { clearTimeout(guard); finish(); }, Math.max(0, 2200 - (performance.now() - t0))));
  }

  return { load, boot, swapImages, loaded: (url) => !!ASSET_BLOBS[keyOf(url)], missing: () => [...bad] };
})();

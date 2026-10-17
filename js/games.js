// =====================================================================
//  Мини-игры (0.12). Первая - «Полка зелий» (три в ряд), ведёт торговка Марфа.
//  Награды: первые CONFIG.games.full игр в день - полная награда (эссенция,
//  ингредиенты, кристаллы за 3 звезды); дальше играть можно сколько угодно,
//  ради рекорда - награда маленькая. Ещё CONFIG.games.adFull полных - за рекламу.
// =====================================================================

CONFIG.games = { full: 5, adFull: 3 };

DATA.games = [
  { id: 'match3', name: 'Полка зелий', host: 'marfa', icon: 'games/match3', ready: true, desc: 'Собирай три одинаковых зелья в ряд. 20 ходов - набери как можно больше очков.' },
  { id: 'rhythm', name: 'Ритм помешивания', host: null, icon: 'games/rhythm' },
  { id: 'catch', name: 'Ловля трав', host: 'savva', icon: 'games/catch' },
  { id: 'fishing', name: 'Рыбалка', host: 'miron', icon: 'games/fishing' },
  { id: 'memory', name: 'Мемори', host: 'varya', icon: 'games/memory' },
  { id: 'mandrake', name: 'Грядка мандрагор', host: 'tikhon', icon: 'games/mandrake' },
  { id: 'find', name: 'Найди предмет', host: 'grisha', icon: 'games/find' },
  { id: 'runes', name: 'Руны', host: 'tishka', icon: 'games/runes' }
];

DATA.quests.push({ id: 'games', type: 'games', img: 'games/games', amounts: [1, 2], hours: 0.75,
  text: (n) => 'Сыграй в мини-игру: ' + n });

const Games = (() => {
  const C = CONFIG, D = DATA, G = CONFIG.games;
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const S = () => Econ.s;
  const st = () => {
    const s = S();
    if (!s.mg || typeof s.mg !== 'object') s.mg = {};
    const m = s.mg;
    if (m.d !== Econ.today()) { m.d = Econ.today(); m.n = 0; m.ad = 0; }
    if (!m.best || typeof m.best !== 'object') m.best = {};
    return m;
  };
  const fullLeft = () => { const m = st(); return Math.max(0, G.full + (m.ad || 0) - (m.n || 0)); };
  const save = () => { if (window.Game) Game.save(); };

  // ---------- меню ----------
  function open() {
    const m = st();
    const list = h('div', { class: 'games-list' }, D.games.map((g) => {
      const best = m.best[g.id];
      const b = h('button', { class: 'game-card' + (g.ready ? '' : ' soon'), type: 'button' },
        pic(g.icon, 'game-ico'),
        h('span', { class: 'game-info' }, h('b', null, g.name),
          h('small', null, g.ready ? (best ? 'Рекорд: ' + Fmt.num(best) : 'Ещё не играл') : 'Скоро')),
        g.ready ? pic('games/play', 'game-play') : null);
      b.addEventListener('click', () => {
        if (!g.ready) { Sound.deny(); UI.toast('«' + g.name + '» появится в следующих версиях'); return; }
        Sound.tap(); UI.closeModal(); setTimeout(() => start(g.id), 50);
      });
      return b;
    }));
    const left = fullLeft();
    const tickets = h('div', { class: 'games-tickets' }, pic('games/ticket', 'ticket-ico'),
      h('span', null, left ? 'Игр с полной наградой сегодня: ' : 'Полные награды на сегодня собраны. Играть можно дальше - ради рекорда.', left ? h('b', null, String(left)) : null));
    const actions = [];
    actions.push({ label: 'Топ «Полки зелий»', alt: true, onClick: () => { setTimeout(() => Tops.open(1), 0); } });
    if (!left && (m.ad || 0) < G.adFull && Platform.adsAvailable()) {
      actions.unshift({ label: 'Ещё игра с наградой (реклама)', onClick: async () => {
        const ok = await Platform.rewardedAd();
        if (ok) { st().ad = (st().ad || 0) + 1; save(); UI.toast('+1 игра с полной наградой'); setTimeout(open, 0); }
        else UI.toast('Реклама сейчас недоступна');
      } });
    }
    UI.modal({ title: 'Игры', body: h('div', null, tickets, list), actions: actions.length ? actions : undefined });
  }

  // ---------- общий экран мини-игры ----------
  let layer = null, cur = null, raf = 0;
  function start(id) {
    if (id === 'match3') runMatch3();
  }
  function close() {
    cancelAnimationFrame(raf); raf = 0;
    if (layer) layer.remove();
    layer = null; cur = null;
    document.body.classList.remove('in-game');
    UI.refresh(true);
  }

  // =====================================================================
  //  «Полка зелий»: поле 7×8, 6 цветов, 20 ходов.
  //  4 в ряд - полосатое зелье (чистит ряд/столбец), уголок или Т - бомба (3×3),
  //  5 в ряд - радужная звезда (меняешь с любым зельем - чистит весь его цвет).
  // =====================================================================
  const COLS = 7, ROWS = 8, MOVES = 20, NC = 6;
  const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'pink'];
  const STARS = [1500, 3500, 6000];

  function runMatch3() {
    document.body.classList.add('in-game');
    const cv = h('canvas', { class: 'game-cv' });
    const movesEl = h('b', null, String(MOVES)), scoreEl = h('b', null, '0');
    const starBar = h('i');
    const head = h('div', { class: 'game-head' },
      h('button', { class: 'x game-x', type: 'button', 'aria-label': 'Выйти', onclick: () => { Sound.tap(); confirmExit(); } }),
      h('div', { class: 'game-stat' }, h('small', null, 'Ходы'), movesEl),
      h('div', { class: 'game-goal' }, h('div', { class: 'game-bar' }, starBar, STARS.map((v, i) => h('span', { class: 'gstar', style: 'left:' + (100 * v / STARS[2]) + '%' }, '★'))), h('small', null, 'Очки'), scoreEl),
      h('div', { class: 'game-host' }, pic('chars/marfa_happy', 'game-host-pic')));
    layer = h('div', { class: 'game-layer m3' }, head, h('div', { class: 'game-board' }, cv));
    document.getElementById('app').append(layer);

    const ctx = cv.getContext('2d');
    let W = 0, H = 0, cell = 40, ox = 0, oy = 0, dpr = 1;
    const IM = {};
    COLORS.concat(['striped', 'bomb', 'rainbow', 'cell']).forEach((n) => { IM[n] = Sprites.get('match3/' + n); if (!IM[n]) Sprites.get('match3/' + n, (im) => { IM[n] = im; }); });
    const SB = Sprites.get('mini/starburst', (im) => { IM.sb = im; }); if (SB) IM.sb = SB;

    function size() {
      const r = cv.parentNode.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      cell = Math.floor(Math.min((W - 16) / COLS, (H - 16) / ROWS));
      ox = (W - cell * COLS) / 2; oy = (H - cell * ROWS) / 2;
    }

    // ---- поле ----
    let uid = 1;
    const mk = (t, sp) => ({ id: uid++, t, sp: sp || null, y: 0, s: 1, dying: 0 });
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      grid.push([]);
      for (let c = 0; c < COLS; c++) {
        let t;
        do { t = Math.floor(Math.random() * NC); }
        while ((c >= 2 && grid[r][c - 1].t === t && grid[r][c - 2].t === t) || (r >= 2 && grid[r - 1][c].t === t && grid[r - 2][c].t === t));
        const p = mk(t); p.y = r - ROWS - 1 - Math.random(); grid[r].push(p);
      }
    }
    const G2 = { moves: MOVES, score: 0, busy: true, combo: 0, sel: null, over: false, parts: [], floats: [], swap: null };

    function findRuns() {
      const runs = [];
      for (let r = 0; r < ROWS; r++) {
        let c = 0;
        while (c < COLS) {
          const t = grid[r][c] && grid[r][c].sp !== 'rainbow' ? grid[r][c].t : -1;
          let e = c + 1;
          while (t >= 0 && e < COLS && grid[r][e] && grid[r][e].sp !== 'rainbow' && grid[r][e].t === t) e++;
          if (t >= 0 && e - c >= 3) runs.push({ dir: 'h', cells: Array.from({ length: e - c }, (_, i) => [r, c + i]), t });
          c = e;
        }
      }
      for (let c = 0; c < COLS; c++) {
        let r = 0;
        while (r < ROWS) {
          const t = grid[r][c] && grid[r][c].sp !== 'rainbow' ? grid[r][c].t : -1;
          let e = r + 1;
          while (t >= 0 && e < ROWS && grid[e][c] && grid[e][c].sp !== 'rainbow' && grid[e][c].t === t) e++;
          if (t >= 0 && e - r >= 3) runs.push({ dir: 'v', cells: Array.from({ length: e - r }, (_, i) => [r + i, c]), t });
          r = e;
        }
      }
      return runs;
    }

    // какие клетки сгорят (с учётом особых зелий) и какие особые родятся
    function plan(runs, focus) {
      const kill = new Set(), born = [];
      const key = (r, c) => r * COLS + c;
      runs.forEach((run) => run.cells.forEach(([r, c]) => kill.add(key(r, c))));
      // перекрёстки - бомба
      const used = new Set();
      runs.forEach((a, i) => runs.forEach((b, j) => {
        if (j <= i || a.dir === b.dir || a.t !== b.t) return;
        const x = a.cells.find(([r, c]) => b.cells.some(([r2, c2]) => r2 === r && c2 === c));
        if (x) { born.push({ r: x[0], c: x[1], t: a.t, sp: 'bomb' }); used.add(i); used.add(j); }
      }));
      runs.forEach((run, i) => {
        if (used.has(i) || run.cells.length < 4) return;
        let at = run.cells.find(([r, c]) => focus && focus.some(([fr, fc]) => fr === r && fc === c)) || run.cells[Math.floor(run.cells.length / 2)];
        born.push({ r: at[0], c: at[1], t: run.t, sp: run.cells.length >= 5 ? 'rainbow' : run.dir === 'h' ? 'v' : 'h' });
      });
      return { kill, born };
    }
    // взрывы особых зелий расширяют список
    function expand(kill) {
      const key = (r, c) => r * COLS + c;
      const queue = [...kill], seen = new Set(kill);
      while (queue.length) {
        const k = queue.shift(), r = Math.floor(k / COLS), c = k % COLS, p = grid[r][c];
        if (!p || !p.sp) continue;
        const add = (rr, cc) => { if (rr < 0 || cc < 0 || rr >= ROWS || cc >= COLS) return; const kk = key(rr, cc); if (!seen.has(kk)) { seen.add(kk); queue.push(kk); } };
        if (p.sp === 'h') { for (let x = 0; x < COLS; x++) add(r, x); burstLine(r, -1); }
        else if (p.sp === 'v') { for (let y = 0; y < ROWS; y++) add(y, c); burstLine(-1, c); }
        else if (p.sp === 'bomb') { for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) add(r + y, c + x); }
        else if (p.sp === 'rainbow') { const t = Math.floor(Math.random() * NC); for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] && grid[y][x].t === t) add(y, x); }
      }
      return seen;
    }
    function burstLine(r, c) { G2.parts.push({ line: true, r, c, life: 0, dur: 0.35 }); }

    function clearSet(kill, born) {
      const n = kill.size;
      G2.combo++;
      const pts = n * 20 * G2.combo + born.length * 60;
      G2.score += pts;
      let sx = 0, sy = 0;
      kill.forEach((k) => {
        const r = Math.floor(k / COLS), c = k % COLS, p = grid[r][c];
        if (!p) return;
        sx += c; sy += r;
        p.dying = 0.001;
        for (let i = 0; i < 3; i++) G2.parts.push({ x: c + 0.5, y: r + 0.5, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3, life: 0, dur: 0.5, col: p.t });
      });
      G2.floats.push({ x: sx / n + 0.5, y: sy / n + 0.5, text: '+' + pts, life: 0 });
      if (G2.combo > 1) Sound.coin(); else Sound.pop();
      setTimeout(() => {
        kill.forEach((k) => { const r = Math.floor(k / COLS), c = k % COLS; grid[r][c] = null; });
        born.forEach((b) => { const p = mk(b.t, b.sp); p.y = b.r; p.s = 0.2; grid[b.r][b.c] = p; });
        gravity();
      }, 200);
    }
    function gravity() {
      for (let c = 0; c < COLS; c++) {
        let w = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) if (grid[r][c]) { const p = grid[r][c]; grid[r][c] = null; grid[w][c] = p; w--; }
        let k = 1;
        for (let r = w; r >= 0; r--) { const p = mk(Math.floor(Math.random() * NC)); p.y = -k - Math.random() * 0.3; k++; grid[r][c] = p; }
      }
      waitSettle(resolve);
    }
    function settled() {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = grid[r][c]; if (p && (Math.abs(p.y - r) > 0.01 || p.s < 0.99)) return false; }
      return true;
    }
    function waitSettle(fn) { const t = () => (settled() ? fn() : setTimeout(t, 30)); setTimeout(t, 30); }
    function resolve(focus) {
      const runs = findRuns();
      if (!runs.length) {
        G2.combo = 0;
        if (!hasMove()) shuffle();
        G2.busy = false;
        updHud();
        if (G2.moves <= 0) finish();
        return;
      }
      const pl = plan(runs, focus);
      // клетки, где рождается особое, не горят
      const bornKeys = new Set(pl.born.map((b) => b.r * COLS + b.c));
      const kill = expand(pl.kill);
      bornKeys.forEach((k) => kill.delete(k));
      clearSet(kill, pl.born);
      updHud();
    }

    function hasMove() {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (grid[r][c].sp === 'rainbow') return true;
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr, c2 = c + dc; if (r2 >= ROWS || c2 >= COLS) continue;
          swapCells(r, c, r2, c2); const ok = findRuns().length > 0; swapCells(r, c, r2, c2);
          if (ok) return true;
        }
      }
      return false;
    }
    function shuffle() {
      const all = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) all.push(grid[r][c]);
      for (let tries = 0; tries < 50; tries++) {
        for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c] = all[r * COLS + c];
        if (!findRuns().length && hasMove()) break;
      }
      UI.toast('Марфа переставила зелья на полке');
    }
    const swapCells = (r, c, r2, c2) => { const t = grid[r][c]; grid[r][c] = grid[r2][c2]; grid[r2][c2] = t; };

    function trySwap(a, b) {
      if (G2.busy || G2.over) return;
      const [r, c] = a, [r2, c2] = b;
      if (Math.abs(r - r2) + Math.abs(c - c2) !== 1) return;
      G2.busy = true; G2.sel = null;
      const pa = grid[r][c], pb = grid[r2][c2];
      G2.swap = { a: [r, c], b: [r2, c2], t: 0 };
      setTimeout(() => {
        G2.swap = null;
        swapCells(r, c, r2, c2);
        // радуга: чистит весь цвет того, с чем её поменяли
        const rb = pa.sp === 'rainbow' ? [r2, c2, pb] : pb.sp === 'rainbow' ? [r, c, pa] : null;
        if (rb) {
          G2.moves--; G2.combo = 0;
          const key = (y, x) => y * COLS + x;
          const kill = new Set();
          const color = rb[2].sp === 'rainbow' ? Math.floor(Math.random() * NC) : rb[2].t;
          for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const p = grid[y][x]; if (p && (p.t === color || p.sp === 'rainbow')) kill.add(key(y, x)); }
          Sound.fanfare();
          clearSet(expand(kill), []);
          updHud();
          return;
        }
        if (!findRuns().length) {
          // не сложилось - меняем обратно
          Sound.deny();
          G2.swap = { a: [r2, c2], b: [r, c], t: 0, back: true };
          swapCells(r, c, r2, c2);
          setTimeout(() => { G2.swap = null; G2.busy = false; }, 160);
          return;
        }
        G2.moves--; G2.combo = 0;
        Sound.tap();
        resolve([[r, c], [r2, c2]]);
      }, 160);
    }

    // ---- ввод ----
    let down = null;
    const cellAt = (x, y) => { const c = Math.floor((x - ox) / cell), r = Math.floor((y - oy) / cell); return r >= 0 && r < ROWS && c >= 0 && c < COLS ? [r, c] : null; };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
      const at = cellAt(x, y); if (!at) return;
      down = { at, x, y, used: false };
    });
    cv.addEventListener('pointermove', (e) => {
      if (!down || down.used) return;
      const rc = cv.getBoundingClientRect(), dx = e.clientX - rc.left - down.x, dy = e.clientY - rc.top - down.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < cell * 0.35) return;
      down.used = true;
      const [r, c] = down.at;
      const to = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
      if (to[0] >= 0 && to[0] < ROWS && to[1] >= 0 && to[1] < COLS) trySwap(down.at, to);
    });
    cv.addEventListener('pointerup', () => {
      if (down && !down.used) {
        const at = down.at;
        if (G2.sel && Math.abs(G2.sel[0] - at[0]) + Math.abs(G2.sel[1] - at[1]) === 1) trySwap(G2.sel, at);
        else { G2.sel = G2.sel && G2.sel[0] === at[0] && G2.sel[1] === at[1] ? null : at; Sound.tap(); }
      }
      down = null;
    });

    function updHud() {
      UI.setText(movesEl, String(Math.max(0, G2.moves)));
      UI.setText(scoreEl, Fmt.num(G2.score));
      starBar.style.width = Math.min(100, 100 * G2.score / STARS[2]) + '%';
      head.querySelectorAll('.gstar').forEach((el, i) => el.classList.toggle('on', G2.score >= STARS[i]));
      movesEl.classList.toggle('low', G2.moves <= 3);
    }

    // ---- рисование ----
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!layer) return;
      if (cv.parentNode && (Math.abs(cv.parentNode.clientWidth - W) > 1 || Math.abs(cv.parentNode.clientHeight - H) > 1)) size();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // ячейки
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (IM.cell) ctx.drawImage(IM.cell, ox + c * cell, oy + r * cell, cell, cell);
        else { ctx.fillStyle = 'rgba(40,20,60,.6)'; ctx.fillRect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2); }
      }
      ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, cell * COLS, cell * ROWS); ctx.clip();
      const sw = G2.swap; if (sw) sw.t = Math.min(1, sw.t + dt / 0.15);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const p = grid[r][c]; if (!p) continue;
        // падение
        if (p.y < r) p.y = Math.min(r, p.y + dt * (6 + (r - p.y) * 8)); else p.y = r;
        if (p.s < 1) p.s = Math.min(1, p.s + dt * 5);
        if (p.dying) p.dying = Math.min(1, p.dying + dt * 6);
        let x = c, y = p.y;
        if (sw) {
          const e = sw.t < 0.5 ? 2 * sw.t * sw.t : 1 - Math.pow(-2 * sw.t + 2, 2) / 2;
          if (sw.a[0] === r && sw.a[1] === c) { x += (sw.b[1] - c) * e; y += (sw.b[0] - r) * e; }
          else if (sw.b[0] === r && sw.b[1] === c) { x += (sw.a[1] - c) * e; y += (sw.a[0] - r) * e; }
        }
        const sel = G2.sel && G2.sel[0] === r && G2.sel[1] === c;
        const sc = p.s * (p.dying ? 1 - p.dying : 1) * (sel ? 1.08 + 0.04 * Math.sin(now / 120) : 1);
        if (sc <= 0.02) continue;
        const im = p.sp === 'rainbow' ? IM.rainbow : p.sp === 'bomb' ? IM.bomb : IM[COLORS[p.t]];
        const px = ox + (x + 0.5) * cell, py = oy + (y + 0.5) * cell, sz = cell * 0.86 * sc;
        if (im) {
          const k = Math.min(sz / im.naturalWidth, sz / im.naturalHeight);
          const w = im.naturalWidth * k, hh = im.naturalHeight * k;
          if (p.sp === 'bomb') { ctx.save(); ctx.filter = 'hue-rotate(' + (p.t * 60) + 'deg)'; ctx.drawImage(im, px - w / 2, py - hh / 2, w, hh); ctx.restore(); }
          else ctx.drawImage(im, px - w / 2, py - hh / 2, w, hh);
          if (p.sp === 'h' || p.sp === 'v') {
            // полосатое: белые полосы поверх
            ctx.save(); ctx.globalAlpha = 0.85 + 0.15 * Math.sin(now / 150); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(2, cell * 0.07); ctx.lineCap = 'round';
            for (let i = -1; i <= 1; i++) { ctx.beginPath();
              if (p.sp === 'h') { ctx.moveTo(px - w * 0.3, py + i * hh * 0.18); ctx.lineTo(px + w * 0.3, py + i * hh * 0.18); }
              else { ctx.moveTo(px + i * w * 0.18, py - hh * 0.3); ctx.lineTo(px + i * w * 0.18, py + hh * 0.3); }
              ctx.stroke(); }
            ctx.restore();
          }
        } else { ctx.fillStyle = ['#E84A5F', '#4A8BFF', '#4CC46A', '#FFC43A', '#9B5BFF', '#FF6FB5'][p.t]; ctx.beginPath(); ctx.arc(px, py, sz * 0.4, 0, 7); ctx.fill(); }
      }
      ctx.restore();
      // частицы и вспышки
      for (let i = G2.parts.length - 1; i >= 0; i--) {
        const q = G2.parts[i]; q.life += dt; if (q.life > q.dur) { G2.parts.splice(i, 1); continue; }
        const k = q.life / q.dur;
        if (q.line) {
          ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#FFF4C0';
          if (q.r >= 0) ctx.fillRect(ox, oy + (q.r + 0.5) * cell - cell * 0.15, cell * COLS, cell * 0.3);
          else ctx.fillRect(ox + (q.c + 0.5) * cell - cell * 0.15, oy, cell * 0.3, cell * ROWS);
          ctx.restore(); continue;
        }
        q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 6 * dt;
        const s = cell * 0.35 * (1 - k);
        ctx.save(); ctx.globalAlpha = 1 - k;
        if (IM.sb) ctx.drawImage(IM.sb, ox + q.x * cell - s / 2, oy + q.y * cell - s / 2, s, s);
        ctx.restore();
      }
      for (let i = G2.floats.length - 1; i >= 0; i--) {
        const f = G2.floats[i]; f.life += dt; if (f.life > 0.9) { G2.floats.splice(i, 1); continue; }
        ctx.save(); ctx.globalAlpha = 1 - f.life / 0.9;
        ctx.font = '900 ' + Math.round(cell * 0.5) + 'px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 5; ctx.strokeStyle = '#3A1050'; ctx.fillStyle = '#FFE48A';
        const fx = ox + f.x * cell, fy = oy + f.y * cell - f.life * cell * 0.8;
        ctx.strokeText(f.text, fx, fy); ctx.fillText(f.text, fx, fy);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }

    function confirmExit() {
      if (G2.over) { close(); return; }
      UI.modal({ title: 'Выйти из игры?', body: h('p', { class: 'center' }, 'Очки этой партии не сохранятся.'),
        actions: [{ label: 'Играть дальше' }, { label: 'Выйти', alt: true, onClick: () => { G2.over = true; setTimeout(close, 0); } }] });
    }

    function finish() {
      if (G2.over) return;
      G2.over = true;
      const m = st();
      const stars = STARS.filter((v) => G2.score >= v).length;
      const best = m.best.match3 || 0;
      const record = G2.score > best;
      if (record) m.best.match3 = G2.score;
      if (window.Tops) Tops.submitGame('match3', G2.score);
      const full = fullLeft() > 0;
      let ess = 0, ingr = [], cr = 0;
      if (full) {
        m.n = (m.n || 0) + 1;
        ess = Econ.hoursOfIncome([0.1, 0.25, 0.5, 1][stars], [200, 500, 1000, 2000][stars]);
        ingr = Brew.give([1, 2, 4, 6][stars], [0, 0.05, 0.1, 0.2][stars]);
        cr = stars >= 3 ? 2 : 0;
        if (cr) Econ.addCrystals(cr);
      } else {
        ess = Econ.hoursOfIncome(0.03, 100);
      }
      Econ.earn(ess);
      Econ.addXp(10 + stars * 10);
      if (Econ.progress) Econ.progress('games', 1);
      save();
      Sound.fanfare();
      const body = h('div', { class: 'game-result' },
        h('div', { class: 'res-stars' }, [0, 1, 2].map((i) => h('span', { class: i < stars ? 'on' : '' }, '★'))),
        h('div', { class: 'res-score' }, h('small', null, record ? 'Новый рекорд!' : 'Очки'), h('b', null, Fmt.num(G2.score))),
        record ? null : h('p', { class: 'small center' }, 'Рекорд: ' + Fmt.num(best)),
        h('div', { class: 'reward-list' },
          h('span', null, UI.money(UI.ess(ess))),
          cr ? h('span', null, UI.money(cr, 'ui/crystal')) : null,
          ingr.map((x) => h('span', null, pic(x.img, 'money-ico'), x.name))),
        h('p', { class: 'small center' }, full ? 'Игр с полной наградой сегодня осталось: ' + fullLeft() : 'Полные награды на сегодня собраны - это игра ради рекорда.'));
      UI.modal({ title: stars ? 'Отличная полка!' : 'Партия окончена', closable: false, body,
        actions: [{ label: 'Ещё раз', onClick: () => { setTimeout(() => { close(); start('match3'); }, 0); } }, { label: 'В лавку', alt: true, onClick: () => { setTimeout(close, 0); } }] });
    }

    size();
    updHud();
    raf = requestAnimationFrame(frame);
    // первое падение зелий на полку
    waitSettle(() => { G2.busy = false; if (!hasMove()) shuffle(); });
    cur = { id: 'match3', grid, G2, trySwap, findRuns, swapCells, COLS, ROWS };
  }

  return { open, start, close, active: () => !!layer, fullLeft, _cur: () => cur };
})();

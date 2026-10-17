// Ежедневные головоломки: рецепт дня и руна дня.
const Daily = (() => {
  const D = DATA, C = CONFIG;
  const h = (...a) => UI.h(...a);

  // ---------- рецепт дня ----------
  // Загадан один неоткрытый рецепт зелья. Нужно угадать 3 ингредиента из 9.
  // После каждой попытки котёл говорит, сколько угадано.
  function openRecipe() {
    let picked = [];
    let gridEl, triesEl, brewBtn, infoEl;
    const r0 = Econ.recipeState();
    const sec = Econ.recipeSecret();

    function renderTries() {
      const r = Econ.recipeState();
      triesEl.innerHTML = '';
      r.tries.forEach((t) => {
        triesEl.append(h('div', { class: 'try' + (t.hits === 3 ? ' win' : '') },
          h('span', { class: 'try-ico' }, t.g.map((id) => UI.pic(Brew.ing(id).img))),
          h('b', null, t.hits + ' из 3')));
      });
      const left = Econ.recipeAttempts() - r.tries.length;
      if (r.solved) {
        UI.setText(infoEl, 'Разгадано! Рецепт «' + sec.potion + '» теперь в книге, а зелье - в сумке. Новый секрет завтра.');
      } else if (left <= 0) {
        UI.setText(infoEl, 'Попытки закончились. Завтра будет новый секрет.');
      } else {
        UI.setText(infoEl, 'Сегодня секрет: рецепт «' + sec.potion + '». Выбери 3 ингредиента. Осталось попыток: ' + left + '.');
      }
      const done = r.solved || left <= 0;
      gridEl.querySelectorAll('button').forEach((b) => { b.disabled = done; });
      brewBtn.disabled = done || picked.length !== 3;
      brewBtn.hidden = done;
    }

    function toggle(id, btn) {
      const k = picked.indexOf(id);
      if (k >= 0) picked.splice(k, 1);
      else if (picked.length < 3) picked.push(id);
      else return;
      Sound.tap();
      btn.classList.toggle('on', picked.includes(id));
      brewBtn.disabled = picked.length !== 3;
    }

    function brew() {
      const res = Econ.guessRecipe(picked);
      if (!res) return;
      picked = [];
      gridEl.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
      if (res.solved) {
        Sound.fanfare();
        Cauldron.setMood('excited', 1500);
        UI.toast('Рецепт разгадан! +' + UI.ess(res.reward) + ' эссенции и «' + sec.potion + '» в сумку');
        Brew.refreshButton();
      } else {
        Sound.blub();
        UI.toast(res.hits ? 'Угадано ' + res.hits + ' из 3. Почти!' : 'Ни одного совпадения. Попробуй другие');
      }
      renderTries();
      UI.refresh();
      if (window.Game) Game.save();
    }

    UI.modal({
      title: 'Рецепт дня',
      body: () => {
        infoEl = h('p', null);
        gridEl = h('div', { class: 'ing-grid daily-grid' }, r0.opts.map((id) => {
          const x = Brew.ing(id);
          const b = h('button', { type: 'button', class: 'ing' + (x.rare ? ' rare' : '') }, UI.pic(x.img), h('span', { class: 'ing-name' }, x.name));
          b.addEventListener('click', () => toggle(id, b));
          return b;
        }));
        brewBtn = h('button', { class: 'btn', type: 'button', disabled: true, onclick: brew }, 'Сварить');
        triesEl = h('div', { class: 'tries' });
        const wrap = h('div', null,
          h('div', { class: 'daily-pot' }, UI.pic(sec.recipe.p.img, 'daily-pot-pic')),
          infoEl, gridEl, brewBtn, triesEl,
          h('p', { class: 'small' }, 'Награда: ' + UI.ess(Econ.recipeReward()) + ' эссенции, кристаллы, рецепт в книгу и само зелье. Ингредиенты не тратятся.'));
        setTimeout(renderTries, 0);
        return wrap;
      }
    });
  }

  // ---------- руна дня ----------
  // Проведи пальцем по точкам по порядку, не отрывая палец.
  function openRune() {
    const rune = Econ.runeOfDay();
    const done = Econ.runeState().done;
    let cv, ctx, size = 280, dpr = 1;
    let stroke = [], next = 0, drawing = false;
    let msgEl;

    const P = (p) => ({ x: p[0] * size, y: p[1] * size });
    const R = () => size * 0.1;

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const pts = rune.pts.map(P);
      // подсказка-пунктир
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(199,182,230,.45)';
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.setLineDash([]);
      // след пальца
      if (stroke.length > 1) {
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = done || next >= pts.length ? '#5BE0B3' : '#FFC94D';
        ctx.beginPath();
        stroke.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
      }
      // точки (последняя совпадает с первой у замкнутых рун - рисуем один раз)
      pts.forEach((p, i) => {
        const dup = pts.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 2);
        if (dup !== i) return;
        const hit = done || i < next;
        ctx.beginPath();
        ctx.arc(p.x, p.y, R() * 0.62, 0, Math.PI * 2);
        ctx.fillStyle = hit ? '#5BE0B3' : '#47317A';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#1A0E2C';
        ctx.stroke();
        ctx.fillStyle = hit ? '#1A0E2C' : '#FFF6E8';
        ctx.font = '800 ' + Math.round(R() * 0.62) + 'px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), p.x, p.y + 1);
      });
    }

    function pos(e) {
      const rc = cv.getBoundingClientRect();
      return { x: (e.clientX - rc.left) * size / rc.width, y: (e.clientY - rc.top) * size / rc.height };
    }

    function advance(p) {
      const pts = rune.pts.map(P);
      while (next < pts.length && Math.hypot(p.x - pts[next].x, p.y - pts[next].y) <= R()) next++;
    }

    function finish() {
      drawing = false;
      if (done) return;
      if (next >= rune.pts.length) {
        const v = Econ.completeRune();
        Sound.fanfare();
        Cauldron.setMood('excited', 1500);
        UI.setText(msgEl, 'Руна «' + rune.name + '» засияла! +' + UI.ess(v) + ' эссенции');
        UI.toast('Руна начерчена! +' + UI.ess(v));
        UI.refresh();
        if (window.Game) Game.save();
        draw();
        cv.style.pointerEvents = 'none';
      } else {
        Sound.deny();
        UI.setText(msgEl, next > 0 ? 'Почти! Веди по точкам по порядку, не отрывая палец.' : 'Начни с точки 1.');
        stroke = []; next = 0;
        draw();
      }
    }

    UI.modal({
      title: 'Руна «' + rune.name + '»',
      body: () => {
        msgEl = h('p', null, done ? 'Сегодняшняя руна уже начерчена. Завтра будет новая.' : 'Проведи пальцем по точкам от 1 до последней, не отрывая палец. Награда: ' + UI.ess(Econ.runeReward()) + ' эссенции.');
        cv = h('canvas', { class: 'rune-canvas', 'aria-label': 'Поле для руны' });
        return h('div', null, msgEl, cv);
      },
      onOpen: () => {
        size = Math.min(300, cv.parentElement.clientWidth);
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.style.width = size + 'px';
        cv.style.height = size + 'px';
        cv.width = Math.round(size * dpr);
        cv.height = Math.round(size * dpr);
        ctx = cv.getContext('2d');
        draw();
        if (done) return;
        cv.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          cv.setPointerCapture(e.pointerId);
          const p = pos(e);
          stroke = [p]; next = 0; drawing = true;
          advance(p);
          draw();
        });
        cv.addEventListener('pointermove', (e) => {
          if (!drawing) return;
          const p = pos(e);
          stroke.push(p);
          const before = next;
          advance(p);
          if (next > before) Sound.tap();
          draw();
        });
        cv.addEventListener('pointerup', finish);
        cv.addEventListener('pointercancel', finish);
      }
    });
  }

  return { openRecipe, openRune };
})();

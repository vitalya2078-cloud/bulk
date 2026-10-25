// Ежедневные головоломки: рецепт дня и руна дня.
const Daily = (() => {
  const D = DATA, C = CONFIG;
  const h = (...a) => UI.h(...a);

  // ---------- рецепт дня ----------
  // Загадан один неоткрытый рецепт зелья. Нужно угадать 3 ингредиента из 9.
  // После каждой попытки котёл говорит, сколько угадано.
  // 0.32.1: подсказки по логике - по всем попыткам считаем, какие тройки ещё возможны:
  // ингредиента нет ни в одной - он точно лишний (зачёркнут), есть во всех - точно нужен (галочка).
  // С третьей неудачной попытки Бульк сам называет один верный ингредиент.
  function deduce(opts, tries) {
    const ok = [];
    for (let a = 0; a < opts.length; a++) for (let b = a + 1; b < opts.length; b++) for (let c = b + 1; c < opts.length; c++) {
      const set = [opts[a], opts[b], opts[c]];
      if (tries.every((t) => t.g.filter((x) => set.includes(x)).length === t.hits)) ok.push(set);
    }
    const st = {};
    opts.forEach((id) => { const n = ok.filter((s) => s.includes(id)).length; st[id] = !ok.length ? '' : n === 0 ? 'no' : n === ok.length ? 'yes' : ''; });
    return { st, left: ok.length };
  }
  function openRecipe() {
    let picked = [];
    let gridEl, triesEl, brewBtn, infoEl, pickEl;
    const r0 = Econ.recipeState();
    const sec = Econ.recipeSecret();
    // подсказка Булька: один верный ингредиент (с 3-й неудачной попытки)
    const hintId = () => { const r = Econ.recipeState(); return !r.solved && r.tries.length >= 3 ? sec.set.find((id) => r0.opts.includes(id)) : null; };

    function renderPick() {
      pickEl.replaceChildren(...[0, 1, 2].map((i) => {
        const id = picked[i];
        return h('span', { class: 'rp-slot' + (id ? ' full' : '') }, id ? UI.pic(Brew.ing(id).img) : h('i', null, String(i + 1)));
      }));
    }
    function renderMarks() {
      const r = Econ.recipeState(), d = deduce(r0.opts, r.tries), hint = hintId();
      gridEl.querySelectorAll('button').forEach((b) => {
        const id = b.dataset.id, mk = hint === id ? 'yes' : d.st[id];
        b.classList.toggle('no', !r.solved && mk === 'no');
        b.classList.toggle('yes', !r.solved && mk === 'yes');
        b.classList.toggle('on', picked.includes(id));
        const n = b.querySelector('.ing-num');
        n.textContent = picked.includes(id) ? String(picked.indexOf(id) + 1) : '';
      });
      return d;
    }

    function renderTries() {
      const r = Econ.recipeState();
      triesEl.innerHTML = '';
      r.tries.forEach((t) => {
        triesEl.append(h('div', { class: 'try' + (t.hits === 3 ? ' win' : '') },
          h('span', { class: 'try-ico' }, t.g.map((id) => UI.pic(Brew.ing(id).img))),
          h('b', null, 'угадано ' + t.hits + ' из 3')));
      });
      const left = Econ.recipeAttempts() - r.tries.length;
      const d = renderMarks(), hint = hintId();
      if (r.solved) {
        UI.setText(infoEl, 'Разгадано! Рецепт «' + sec.potion + '» теперь в книге, а зелье - в сумке. Новый секрет завтра.');
      } else if (left <= 0) {
        UI.setText(infoEl, 'Попытки закончились. Завтра будет новый секрет.');
      } else {
        UI.setText(infoEl, 'Сегодня секрет: рецепт «' + sec.potion + '». Выбери 3 ингредиента и нажми «Сварить». Осталось попыток: ' + left + '.'
          + (r.tries.length ? ' Зачёркнутые точно не подходят' + (Object.values(d.st).includes('yes') || hint ? ', с галочкой - точно нужны.' : '.') : ''));
        if (hint && !r.hintSaid) { r.hintSaid = 1; setTimeout(() => UI.toast('Бульк подсказывает: в рецепте точно есть «' + Brew.ing(hint).name + '»'), 400); }
      }
      const done = r.solved || left <= 0;
      gridEl.querySelectorAll('button').forEach((b) => { b.disabled = done; });
      brewBtn.disabled = done || picked.length !== 3;
      brewBtn.hidden = done;
      pickEl.hidden = done;
      renderPick();
    }

    function toggle(id, btn) {
      const k = picked.indexOf(id);
      if (k >= 0) picked.splice(k, 1);
      else if (picked.length < 3) picked.push(id);
      else { Sound.deny(); UI.toast('Уже выбрано 3. Нажми на выбранный, чтобы убрать'); return; }
      Sound.tap();
      renderMarks(); renderPick();
      brewBtn.disabled = picked.length !== 3;
      UI.setText(brewBtn, picked.length === 3 ? 'Сварить' : 'Выбери ещё ' + (3 - picked.length));
    }

    function brew() {
      const res = Econ.guessRecipe(picked);
      if (!res) return;
      picked = [];
      UI.setText(brewBtn, 'Выбери 3');
      if (res.solved) {
        Sound.fanfare();
        Cauldron.setMood('excited', 1500);
        UI.toast('Рецепт разгадан! +' + UI.ess(res.reward) + ' эссенции и «' + sec.potion + '» в сумку');
        Brew.refreshButton();
      } else {
        Sound.blub();
        UI.toast(res.hits ? 'Угадано ' + res.hits + ' из 3, но не сказано какие. Смотри подсказки на ингредиентах' : 'Ни одного совпадения: все три зачёркнуты. Попробуй другие');
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
          const b = h('button', { type: 'button', class: 'ing rd-ing', 'data-id': id }, UI.pic(x.img), h('span', { class: 'ing-name' }, x.name), h('b', { class: 'ing-num' }), h('i', { class: 'ing-mark' }));
          b.addEventListener('click', () => toggle(id, b));
          return b;
        }));
        brewBtn = h('button', { class: 'btn', type: 'button', disabled: true, onclick: brew }, 'Выбери 3');
        pickEl = h('div', { class: 'rp-pick' });
        triesEl = h('div', { class: 'tries' });
        const wrap = h('div', null,
          h('div', { class: 'daily-pot' }, UI.pic(sec.recipe.p.img, 'daily-pot-pic')),
          infoEl, gridEl, pickEl, brewBtn, triesEl,
          h('p', { class: 'small' }, 'В строках попыток - сколько из трёх угадано. Какие именно - не говорится, но игра сама зачёркивает то, что точно не подходит.'),
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

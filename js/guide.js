// =====================================================================
//  «Путь алхимика» и обучение (0.22).
//  Путь - сквозная цепочка шагов по всем системам игры. Шаг считается выполненным по
//  настоящему состоянию сохранения (а не «с этого момента»), поэтому опытный игрок при первом
//  запуске проскакивает пройденное и ничего не повторяет. У каждого шага кнопка «Перейти».
//  Обучение: новичку - короткая подсветка первых действий; тем, кто уже играл, - один раз
//  показ нового (Профиль, Сообщество, Путь). Можно пропустить и пройти заново из настроек.
// =====================================================================

const Guide = (() => {
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const S = () => Econ.s;
  const R = (i) => DATA.ranks[i].name;
  const online = () => typeof Online !== 'undefined' && Online.on();
  const petsOwned = (s) => (s.pets && s.pets.own ? Object.keys(s.pets.own).length : 0);
  const wardOwned = () => DATA.wardrobe.filter((it) => Econ.itemState(it).owned).length;
  const wardFree = DATA.wardrobe.filter((it) => it.how && it.how.free).length;
  const maxFriend = () => DATA.visitors.reduce((m, v) => Math.max(m, Econ.friendLevel(v.id)), 0);

  // ---------- главы и шаги ----------
  // cur(s) -> число, need -> цель; go - куда ведёт «Перейти»; cr - кристаллы, h - часы дохода в награду
  const CH = ['Первый огонь', 'Соседи', 'Алхимия', 'Друзья лавки', 'Вместе веселее', 'Мастер'];
  const STEPS = [
    { ch: 0, t: 'Помешай котёл', d: 'Каждый тап варит эссенцию. Бульк это обожает.', cur: (s) => s.taps, need: 30, go: 'cauldron', cr: 2, h: 0.2 },
    { ch: 0, t: 'Купи первую карточку', d: 'Карточки лавки варят эссенцию сами - даже когда тебя нет.', cur: () => Econ.levels(), need: 1, go: 'shop', cr: 3, h: 0.3 },
    { ch: 0, t: 'Улучши карточки 5 раз', d: 'Чем выше уровни, тем больше доход в час.', cur: () => Econ.levels(), need: 5, go: 'shop', cr: 3, h: 0.5 },
    { ch: 0, t: 'Забери подарок дня', d: 'Заходи каждый день - подарки растут.', cur: (s) => (s.daily && s.daily.l ? 1 : 0), need: 1, go: 'daily', cr: 2, h: 0.3 },
    { ch: 0, t: 'Выполни задание дня', d: 'Три задания каждый день - за каждое эссенция и кристаллы.', cur: (s) => s.qd, need: 1, go: 'daily', cr: 3, h: 0.5 },
    { ch: 1, t: 'Помоги жителю', d: 'Жители приходят с просьбами. Помогать - выгодно и приятно.', cur: (s) => s.served, need: 1, go: 'visitors', cr: 3, h: 0.5 },
    { ch: 1, t: 'Поймай золотой пузырь', d: 'Иногда над котлом всплывает золотой пузырь - лови!', cur: (s) => s.bb, need: 1, go: 'cauldron', cr: 2, h: 0.3 },
    { ch: 1, t: 'Разгадай рецепт дня', d: 'Угадай три ингредиента - получишь награду.', cur: (s) => s.recipesSolved, need: 1, go: 'recipe', cr: 3, h: 0.5 },
    { ch: 1, t: 'Начерти руну дня', d: 'Проведи пальцем по знаку - магия любит точность.', cur: (s) => s.runesDone, need: 1, go: 'rune', cr: 3, h: 0.5 },
    { ch: 1, t: 'Ранг «' + R(1) + '»', d: 'Вари больше эссенции - лавка растёт и открывает новое.', cur: () => Econ.rank(), need: 1, go: 'shop', cr: 5, h: 1, show: () => Econ.rankProgress().frac },
    { ch: 2, t: 'Свари зелье', d: 'Три ингредиента в котёл - и готово. В книге есть рецепты.', cur: (s) => s.brewed, need: 1, go: 'brew', cr: 3, h: 0.5 },
    { ch: 2, t: 'Выпей зелье', d: 'Зелья из сумки дают силу тапа, доход и другие чудеса.', cur: (s) => s.stat.drunk || 0, need: 1, go: 'bag', cr: 3, h: 0.5 },
    { ch: 2, t: 'Открой новый рецепт', d: 'Пробуй смешивать ингредиенты - книга пополнится.', cur: (s) => s.book.length, need: 3, go: 'brew', cr: 5, h: 0.7 },
    { ch: 2, t: 'Купи ингредиент у торговки', d: 'Марфа каждый день привозит новый товар.', cur: (s) => s.stat.bought || 0, need: 1, go: 'market', cr: 2, h: 0.5 },
    { ch: 2, t: 'Свари 5 зелий', d: 'Опытный алхимик варит не по разу.', cur: (s) => s.brewed, need: 5, go: 'brew', cr: 5, h: 1 },
    { ch: 3, t: 'Заведи питомца', d: 'Питомцы помогают лавке и ходят в походы.', cur: (s) => petsOwned(s), need: 1, go: 'pets', cr: 5, h: 0.7 },
    { ch: 3, t: 'Отправь питомца в поход', d: 'Из похода питомец принесёт ингредиенты.', cur: (s) => (s.pets && s.pets.trips) || 0, need: 1, go: 'pets', cr: 4, h: 0.7 },
    { ch: 3, t: 'Изучи навык', d: 'Каждый уровень алхимика даёт очко навыка.', cur: () => Econ.skillSpent(), need: 1, go: 'skills', cr: 4, h: 0.7 },
    { ch: 3, t: 'Обнови гардероб Булька', d: 'Шляпы, очки и ложки - Бульку нравится наряжаться.', cur: () => Math.max(0, wardOwned() - wardFree), need: 1, go: 'wardrobe', cr: 4, h: 0.7 },
    { ch: 3, t: 'Ранг «' + R(2) + '»', d: 'Лавка становится настоящей аптекой.', cur: () => Econ.rank(), need: 2, go: 'shop', cr: 8, h: 1.5, show: () => Econ.rankProgress().frac },
    { ch: 4, t: 'Вступи в ковен', d: 'Ковен - это компания алхимиков: общие задания, босс и бонус к доходу.', cur: () => (!online() ? 1 : typeof Coven !== 'undefined' && Coven.mine && Coven.mine() ? 1 : 0), need: 1, go: 'coven', cr: 6, h: 1 },
    { ch: 4, t: 'Сыграй в «Полку зелий»', d: 'Мини-игра «три в ряд» - эссенция и опыт.', cur: (s) => s.stat.games || (s.mg && s.mg.best && Object.keys(s.mg.best).length ? 1 : 0), need: 1, go: 'games', cr: 4, h: 0.7 },
    { ch: 4, t: 'Подружись с жителем', d: 'Выполняй просьбы одного жителя - и вы станете приятелями.', cur: () => maxFriend(), need: 2, go: 'people', cr: 5, h: 1 },
    { ch: 4, t: 'Уровень алхимика 10', d: 'Опыт дают задания, просьбы, зелья и мини-игры.', cur: (s) => s.lvl, need: 10, go: 'skills', cr: 6, h: 1.5 },
    { ch: 4, t: 'Ранг «' + R(3) + '»', d: 'Своя мастерская - это уже серьёзно.', cur: () => Econ.rank(), need: 3, go: 'shop', cr: 10, h: 2, show: () => Econ.rankProgress().frac },
    { ch: 5, t: 'Открой 10 рецептов', d: 'Половина книги - и ты настоящий знаток.', cur: (s) => s.book.length, need: 10, go: 'brew', cr: 10, h: 2 },
    { ch: 5, t: 'Уровень алхимика 20', d: 'Дерево навыков ждёт.', cur: (s) => s.lvl, need: 20, go: 'skills', cr: 10, h: 2 },
    { ch: 5, t: 'Ранг «' + R(4) + '»', d: 'Зельеварня - лавка, о которой говорит вся округа.', cur: () => Econ.rank(), need: 4, go: 'shop', cr: 15, h: 3, show: () => Econ.rankProgress().frac }
  ];

  const st = () => S().pth;
  const step = () => (st() ? STEPS[st().i] || null : null);
  const curOf = (x) => Math.max(0, Math.floor(+x.cur(S()) || 0));
  const doneOf = (x) => curOf(x) >= x.need;
  const ready = () => { const x = step(); return !!x && doneOf(x); };
  const reward = (x) => Econ.hoursOfIncome(x.h, 300);

  function claim() {
    const x = step();
    if (!x || !doneOf(x)) return 0;
    const v = reward(x);
    Econ.earn(v);
    Econ.addCrystals(x.cr);
    Econ.addXp(10);
    st().i++;
    Sound.coin();
    UI.toast('Путь алхимика: +' + UI.ess(v) + ' эссенции и +' + x.cr + ' ' + UI.crystalsWord(x.cr));
    if (!step()) setTimeout(() => UI.modal({ title: 'Путь пройден!', body: h('p', { class: 'center' }, 'Ты прошёл весь Путь алхимика. Новые главы появятся в следующих обновлениях - Бульк уже что-то задумал.'), actions: [{ label: 'Ура!' }] }), 400);
    if (window.Game) Game.save();
    UI.refresh(true);
    return v;
  }

  // ---------- «Перейти»: ведёт в нужное место или объясняет, почему пока нельзя ----------
  const GO = {
    cauldron: () => { UI.show('main'); flash('#stage'); },
    shop: () => UI.show('shop'),
    wardrobe: () => UI.show('wardrobe'),
    daily: () => { S().jtab = 'day'; UI.show('tasks'); },
    visitors: () => { S().jtab = 'req'; UI.show('tasks'); },
    people: () => { S().jtab = 'people'; UI.show('tasks'); },
    recipe: () => Daily.openRecipe(),
    rune: () => Daily.openRune(),
    brew: () => Brew.open('brew'),
    bag: () => Brew.open('bag'),
    market: () => Brew.open('shop'),
    pets: () => (Econ.rank() >= CONFIG.petSlots[0] ? Pets.open() : 'Питомцы приходят на ранге «' + R(CONFIG.petSlots[0]) + '». Вари эссенцию - лавка вырастет.'),
    skills: () => SkillsUI.open(),
    games: () => Games.open(),
    coven: () => (online() ? Coven.open() : 'Ковены работают при подключении к сети'),
    tops: () => Tops.open(0),
    profile: () => UI.show('profile')
  };
  function go(target) {
    const f = GO[target];
    if (!f) return;
    if (UI.isModalOpen()) UI.closeModal();
    setTimeout(() => {
      const r = f();
      if (typeof r === 'string') UI.toast(r);
    }, 0);
  }
  // для дневных заданий: тип задания -> куда вести
  const QUEST_GO = { taps: 'cauldron', levels: 'shop', visitors: 'visitors', recipe: 'recipe', rune: 'rune', bubbles: 'cauldron', games: 'games', brew: 'brew' };
  const goFor = (type) => QUEST_GO[type] || null;

  // ---------- карточка «Путь алхимика» во вкладке «Задания» ----------
  function block(box) {
    const x = step();
    const wrap = h('div', { class: 'panel path' });
    if (!x) {
      wrap.append(h('div', { class: 'path-head' }, pic('ui/scroll', 'path-ico'), h('div', null, h('small', null, 'Путь алхимика'), h('b', null, 'Пройден целиком!'))),
        h('p', { class: 'note' }, 'Новые главы - в следующих обновлениях.'));
      box.append(wrap);
      return;
    }
    const i = st().i, inCh = STEPS.filter((y) => y.ch === x.ch), n = inCh.indexOf(x) + 1;
    const cur = curOf(x), done = cur >= x.need;
    // для ранга - сколько пройдено до нужного ранга с учётом прогресса внутри текущего
    const frac = done ? 1 : x.show ? Math.min(0.99, (Econ.rank() + x.show()) / x.need) : Math.min(1, cur / x.need);
    const fill = h('i', { style: 'width:' + Math.round(frac * 100) + '%' });
    const prog = x.show ? (done ? 'Готово' : 'Ранг ' + (Econ.rank() + 1) + ' из ' + (x.need + 1)) : Fmt.num(Math.min(cur, x.need)) + ' / ' + Fmt.num(x.need);
    const btn = done
      ? h('button', { class: 'pill-btn', type: 'button', onclick: () => { claim(); } }, 'Забрать')
      : h('button', { class: 'pill-btn alt go-btn', type: 'button', onclick: () => { Sound.tap(); go(x.go); } }, 'Перейти');
    wrap.append(
      h('div', { class: 'path-head' }, pic('ui/scroll', 'path-ico'),
        h('div', null, h('small', null, 'Путь алхимика · глава ' + (x.ch + 1) + ' «' + CH[x.ch] + '» · ' + n + ' из ' + inCh.length), h('b', null, x.t))),
      h('p', { class: 'path-text' }, x.d),
      h('div', { class: 'path-row' }, h('div', { class: 'path-prog' }, h('div', { class: 'bar' }, fill), h('small', null, prog)), btn),
      h('div', { class: 'path-reward' }, 'Награда: ', UI.money(UI.ess(reward(x))), ' и ', h('b', null, '+' + x.cr + ' ' + UI.crystalsWord(x.cr))),
      h('div', { class: 'path-dots' }, CH.map((c, k) => h('i', { class: k < x.ch ? 'done' : k === x.ch ? 'on' : '' }))),
      h('p', { class: 'note' }, 'Пройдено шагов: ' + i + ' из ' + STEPS.length));
    box.append(wrap);
  }
  const key = () => { const x = step(); return 'g' + (st() ? st().i : -1) + (x && doneOf(x) ? 'r' : ''); };

  // ---------- обучение: подсветка ----------
  const NEWBIE = [
    { sel: ['#stage'], text: 'Привет! Я Бульк, волшебный котёл. Тапай по мне - я варю эссенцию. Набери 40 капель на первую грядку.', wait: () => S().e >= 40 || Econ.levels() > 0 },
    { sel: ['#balance-btn'], text: 'Вот твоя эссенция. На неё в лавке покупают всё самое нужное.', next: 'Дальше' },
    { sel: ['.tab[data-go="shop"]'], text: 'Загляни в Лавку - нажми сюда.', wait: () => UI.screen() === 'shop' || Econ.levels() > 0 },
    { sel: ['#shop-body .tile', '.tab[data-go="shop"]'], text: 'Грядка мяты будет варить эссенцию сама, даже когда тебя нет. Купи её!', wait: () => Econ.levels() > 0 },
    { sel: ['.tab[data-go="tasks"]'], text: 'Дальше подскажет «Путь алхимика» в Заданиях. Кнопка «Перейти» сама приведёт куда нужно. Удачи!', next: 'Понятно' }
  ];
  // 0.28: что нового для тех, кто уже играет (показываем, только если раздел открыт)
  const NEWS = () => (typeof Relics !== 'undefined' && Relics.unlocked() ? [
    { sel: ['#relic-btn'], text: 'Новое: Диковинки! Волшебные вещицы на полке лавки дают постоянные бонусы. Тебя уже ждут сундуки в подарок.', next: 'Дальше' },
    { sel: ['#wheel-btn'], text: 'А это Колесо Булька: крути бесплатно каждый день. Приз будет точно!', next: 'Понятно' }
  ] : []);
  const TUT_V = 2;
  let tour = null, ti = 0, layer = null, ring = null, box = null, txt = null, nextBtn = null, loop = 0;

  function visible(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || getComputedStyle(el).visibility === 'hidden') return null;
    return r;
  }
  function target(sels) {
    for (const q of sels) { for (const el of document.querySelectorAll(q)) { const r = visible(el); if (r) return r; } }
    return null;
  }
  function build() {
    ring = h('div', { class: 'tut-ring' });
    txt = h('p', null);
    nextBtn = h('button', { class: 'pill-btn', type: 'button', onclick: () => { Sound.tap(); advance(); } }, 'Дальше');
    box = h('div', { class: 'tut-box' }, pic('ui/cauldron', 'tut-ico'), h('div', { class: 'tut-main' }, txt,
      h('div', { class: 'tut-btns' }, h('button', { class: 'tut-skip', type: 'button', onclick: () => { Sound.tap(); finish(); } }, 'Пропустить'), nextBtn)));
    layer = h('div', { class: 'tut' }, ring, box);
    document.body.append(layer);
  }
  function draw() {
    if (!tour) return;
    const sc = tour[ti];
    if (sc.wait && sc.wait()) { advance(); return; }
    // поверх окон не показываем: подождём, пока игрок их закроет
    const busy = UI.isModalOpen() || !!document.getElementById('boot') || (typeof Online !== 'undefined' && Online.blocked());
    layer.hidden = busy;
    if (busy) return;
    UI.setText(txt, sc.text);
    nextBtn.hidden = !sc.next;
    if (sc.next) UI.setText(nextBtn, sc.next);
    const r = target(sc.sel);
    if (r) {
      const pad = 6;
      Object.assign(ring.style, { display: 'block', left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
      const below = r.top + r.height / 2 < innerHeight / 2;
      box.style.top = below ? Math.min(innerHeight - 170, r.bottom + 14) + 'px' : '';
      box.style.bottom = below ? '' : Math.min(innerHeight - 170, innerHeight - r.top + 14) + 'px';
    } else {
      ring.style.display = 'none';
      box.style.top = ''; box.style.bottom = '30%';
    }
  }
  function advance() {
    ti++;
    if (!tour || ti >= tour.length) { finish(); return; }
    draw();
  }
  function finish() {
    tour = null;
    clearInterval(loop);
    if (layer) { layer.remove(); layer = null; }
    S().tut = { v: TUT_V, done: true };
    setTimeout(goal, 0);
    if (window.Game) Game.save();
  }
  function run(steps) {
    if (layer) layer.remove();
    tour = steps; ti = 0;
    build();
    draw();
    clearInterval(loop);
    loop = setInterval(draw, 250);
  }
  const replay = () => { S().tut = null; run(NEWBIE); };

  // подсветить место на секунду (после «Перейти» к котлу)
  function flash(sel) {
    const el = document.querySelector(sel);
    if (!el) return;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1600);
  }

  // ---------- запуск ----------
  function start() {
    const s = S();
    const isNew = s.taps < 30 && Econ.levels() === 0 && Econ.rank() === 0;
    if (!s.pth) {
      if (isNew) s.pth = { i: 0 };
      else {
        // уже игравший: проскакиваем пройденное, за него - разовый бонус
        let i = 0;
        while (i < STEPS.length && doneOf(STEPS[i])) i++;
        s.pth = { i };
        const bonus = Math.min(40, i * 2);
        if (bonus) { Econ.addCrystals(bonus); setTimeout(() => UI.toast('Путь алхимика: пройдено шагов ' + i + ', +' + bonus + ' ' + UI.crystalsWord(bonus) + ' за опыт'), 4000); }
      }
      if (window.Game) Game.save();
    }
    if (!s.tut || s.tut.v < TUT_V) {
      const steps = isNew ? NEWBIE : NEWS();
      if (steps.length) setTimeout(() => run(steps), 1200);
      else s.tut = { v: TUT_V, done: true };
    }
  }

  // ---------- табличка текущей цели на главном экране ----------
  let goalKey = '';
  function goal() {
    const el = document.getElementById('goal');
    if (!el) return;
    const x = step();
    if (!x || layer || !st()) { el.hidden = true; goalKey = ''; return; }
    const cur = curOf(x), done = cur >= x.need;
    const prog = done ? 'Забрать награду' : x.show ? 'ранг ' + (Econ.rank() + 1) + ' из ' + (x.need + 1) : Fmt.num(Math.min(cur, x.need)) + ' / ' + Fmt.num(x.need);
    const k = x.t + '|' + prog;
    el.hidden = false;
    el.classList.toggle('ready', done);
    if (k === goalKey) return;
    goalKey = k;
    el.replaceChildren(pic('ui/scroll', 'goal-ico'), h('span', null, h('b', null, x.t), h('small', null, prog)), h('i', null, done ? '✓' : '›'));
  }
  function goalTap() {
    const x = step();
    if (!x) return;
    if (doneOf(x)) { claim(); goal(); return; }
    Sound.tap();
    go(x.go);
  }

  return { start, block, key, ready, claim, go, goFor, replay, goal, goalTap, steps: STEPS };
})();

// Запуск игры и главный цикл.
(async () => {
  'use strict';
  const C = CONFIG, D = DATA;
  const canvas = document.getElementById('cauldron');
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let bubbleIn = rand(60, 100);
  let phraseIn = rand(25, 45);

  // ---------- сохранение ----------
  function saveNow(toCloud) {
    if (typeof Online !== 'undefined' && Online.blocked()) return; // игра открыта в другом месте
    const str = Econ.serialize();
    try { localStorage.setItem(C.saveKey, str); } catch (e) { /* приватный режим */ }
    if (toCloud) Platform.storageSet(C.saveKey, str);
  }
  window.Game = { save: () => saveNow(true) };

  async function loadSave() {
    let local = null, remote = null;
    try { local = JSON.parse(localStorage.getItem(C.saveKey) || 'null'); } catch (e) { /* повреждено */ }
    let server = null;
    const srvP = typeof Online !== 'undefined' ? Online.loadServer() : Promise.resolve(null);
    try { const v = await Platform.storageGet(C.saveKey); if (v) remote = JSON.parse(v); } catch (e) { /* повреждено */ }
    try { server = await srvP; } catch (e) { /* без сети */ }
    // самое свежее из трёх: этот телефон, облако платформы, наша база (общая для ВК и Telegram)
    return [local, remote, server].filter((x) => x && typeof x === 'object').sort((a, b) => (b.ts || 0) - (a.ts || 0))[0] || null;
  }

  // ---------- время вне игры ----------
  function handleGap(sec) {
    const amount = Econ.offlineEarnings(sec);
    if (!(amount > 0)) return;
    if (sec < 60) { Econ.earn(amount); return; }
    const slept = Brew.onReturn();
    UI.offlineModal(amount, sec);
    if (slept) setTimeout(() => UI.toast('Сонное зелье удвоило доход, пока тебя не было'), 600);
  }

  // ---------- тапы по котлу ----------
  function tapAt(e, x, y) {
    const verdict = AntiBot.check(e, x, y);
    if (verdict === 'lock') { UI.showGuard(); return; }
    if (verdict !== 'ok') return;
    const v = Econ.tap();
    const crit = Econ.wasCrit();
    Cauldron.onClick(x, y, crit ? null : '+' + Fmt.num(v));
    if (crit) Cauldron.floatText(x, y - 20, 'Точно! +' + Fmt.num(v), '#FF8FB1', 26);
    Sound.blub();
    if (Econ.s.set.vib) Platform.haptic();
    Visitors.onTap();
    Events.onTap();
    Brew.onTap(x, y);
    Pets.onPotTap();
    if (Math.random() < 0.02 && UI.sinceSay() > 6000 && !Visitors.ordering()) {
      UI.say(pick(Cauldron.mood() === 'excited' ? D.phrases.excited : D.phrases.click), 1500);
    }
  }

  function popBubble() {
    const p = Cauldron.popGolden();
    if (!p) return;
    Econ.bubbleCaught();
    Sound.pop();
    Cauldron.setMood('wow', 1200);
    const r = Math.random();
    let msg, short;
    if (r < 0.4) {
      Econ.addEffect('inspire', 30);
      msg = 'Вдохновение! Доход ×5 на 30 секунд'; short = '×5';
    } else if (r < 0.75) {
      const v = Econ.hoursOfIncome(0.25, 300) * (1 + 0.2 * Econ.skill('s3'));
      Econ.earn(v);
      msg = 'Щедрость: +' + Fmt.num(v) + ' эссенции'; short = '+' + Fmt.num(v);
    } else {
      Econ.addEffect('storm', 20 + 5 * Econ.skill('t4'));
      msg = 'Буря помешиваний! Тап ×5 на 20 секунд'; short = '×5';
    }
    Cauldron.floatText(p.x, p.y, short, '#FFFFFF', 26);
    Brew.onBubble(p.x, p.y);
    UI.toast(msg);
    saveNow(false);
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.unlock();
    const rc = canvas.getBoundingClientRect();
    const x = e.clientX - rc.left, y = e.clientY - rc.top;
    // житель ждёт: тап по нему или облачку открывает разговор
    if (Visitors.hit(x, y)) return;
    Pets.poke();
    const ph = Pets.hit(x, y);
    if (ph === 'pet') { Cauldron.poke(); return; }
    if (ph === 'egg') { Pets.open('eggs'); return; }
    const wasSleepy = Cauldron.poke();
    const hit = Cauldron.hit(x, y);
    if (hit === 'golden') { if (e.isTrusted) popBubble(); return; }
    if (hit === 'pot') {
      tapAt(e, x, y);
      if (wasSleepy) UI.say(pick(D.phrases.wake), 2000);
    }
  });

  // Пробел тоже помешивает (на компьютере). Зажатая клавиша не считается.
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || UI.isModalOpen() || UI.screen() !== 'main') return;
    if (e.target && /BUTTON|INPUT|TEXTAREA/.test(e.target.tagName)) return;
    e.preventDefault();
    Sound.unlock();
    Cauldron.poke();
    const c = Cauldron.center();
    tapAt(e, c.x + rand(-30, 30), c.y - 20 + rand(-10, 10));
  });

  window.addEventListener('resize', () => Cauldron.resize());
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(true); });
  window.addEventListener('pagehide', () => saveNow(true));

  // ---------- старт ----------
  // Заранее загружаем все картинки, чтобы вкладки не «мигали» пустыми иконками
  const preload = new Set(['backgrounds/room', 'stands/iron', 'ui/padlock', 'ui/hooded', 'ui/essence', 'ui/gear', 'ui/gift', 'ui/book', 'ui/rune',
    'ui/cauldron', 'cards/window', 'ui/checklist', 'ui/envelope', 'ui/sparkle', 'ui/wind', 'ui/wardrobe', 'ui/crystal',
    'ui/camera', 'ui/banner', 'ui/ladle']);
  [D.cards, D.visitors, D.ingredients, D.ranks, D.achievements, D.quests, Object.values(D.effects), [D.scoop, D.pantry], D.friendship, D.avatars, D.ingr, D.brews, D.props]
    .forEach((list) => list.forEach((x) => { if (x.img) preload.add(x.img); }));
  D.wardrobe.forEach((w) => preload.add(w.img || 'wardrobe/' + w.id));
  ['ui/potion_bag', 'ui/flask', 'ui/mortar', 'ui/quality', 'ui/recipe_unknown', 'potions/sludge'].forEach((n) => preload.add(n));
  ['candy', 'candy_bucket', 'lantern_pumpkin', 'scroll'].forEach((n) => preload.add('events/halloween/' + n));
  // всё остальное, что может понадобиться: мебель всех рангов, кадры всех питомцев, яйца, локации
  (D.room ? D.room.items : []).forEach((it) => preload.add(it.img));
  (D.pets || []).forEach((pt) => { for (let i = 0; i < 16; i++) preload.add('pets/' + pt.id + '/' + String(i).padStart(2, '0')); });
  Object.values(D.eggs || {}).forEach((e) => e.img && preload.add(e.img));
  (D.locations || []).forEach((l) => l.img && preload.add(l.img));
  ['pets/nest', 'pets/shell', 'pets/bowl', 'cauldron/pot', 'cauldron/liquid', 'cauldron/bubble', 'scene/counter', 'ui/paw_heart', 'ui/steam', 'ui/heat'].forEach((n) => preload.add(n));

  Cauldron.init(canvas);
  UI.init({
    save: () => saveNow(true),
    reset: () => { Econ.reset(); saveNow(true); setTimeout(() => location.reload(), 300); }
  });
  Visitors.build();
  Econ.hooks.questReady = () => { UI.toast('Задание выполнено! Награда ждёт во вкладке «Задания»'); Sound.coin(); };
  // Новый уровень алхимика: первый раз - окно с объяснением, дальше - короткое сообщение
  let lvlShown = false;
  Econ.hooks.levelUp = (lv, ups) => {
    Sound.fanfare();
    Cauldron.setMood('excited', 1500);
    if (lv === 2 && !lvlShown) { lvlShown = true; SkillsUI.levelUpModal(lv, ups); }
    else UI.toast('Уровень алхимика ' + lv + '! +' + ups + ' ' + Fmt.plural(ups, ['очко', 'очка', 'очков']) + ' навыка');
    UI.refresh();
  };

  await Platform.init();
  const saved = await loadSave();
  if (saved) Econ.load(saved);
  UI.applySettings();
  Econ.countDay();
  // имя и фото из ВК / Telegram
  Platform.profile().then((p) => {
    if (p.photo) {
      UI.setPhoto(p.photo);
      if (!saved) Econ.setAvatar('photo');
    }
    if (p.name && !Econ.s.prof.name) Econ.setName(p.name);
    UI.refresh();
  });
  Econ.ensureQuests();
  Brew.init();
  Brew.refreshButton();
  Pets.init();
  const evFinished = Events.init();
  if (evFinished) setTimeout(() => Events.finishedModal(evFinished), 600);
  Econ.checkAchievements();
  Econ.checkRankUp();
  const applyRankLook = () => UI.applyLook(Cauldron);
  applyRankLook();
  UI.show('main');

  if (Platform.referrer() && !Econ.s.welcome) {
    const v = Econ.claimWelcome();
    if (v) UI.welcomeModal(v);
  }
  if (saved && saved.ts) handleGap((Date.now() - saved.ts) / 1000);
  setTimeout(() => UI.say(pick(saved ? D.phrases.welcome : ['Привет! Я ' + Econ.s.wear.name + ', волшебный котёл. Тапай по мне, и я сварю эссенцию']), 3200), 500);

  // ---------- главный цикл ----------
  let last = performance.now();
  let lastWall = Date.now();
  let uiT = 0, achT = 0, dayT = 0, localT = 0, cloudT = 0;

  function frame(now) {
    const wall = Date.now();
    const gap = (wall - lastWall) / 1000;
    lastWall = wall;
    let dt = (now - last) / 1000;
    last = now;
    if (gap > 5) { handleGap(gap); dt = 0; } // вкладка была скрыта или телефон спал
    dt = Math.max(0, Math.min(dt, 0.1));

    Econ.tick(dt);
    Econ.statTick(dt);

    const onMain = UI.screen() === 'main';
    // пока открыта заставка загрузки, гости не приходят и пузыри не летят
    const paused = UI.isModalOpen() || !onMain || !!document.getElementById('boot') || (typeof Games !== 'undefined' && Games.active());
    Visitors.update(dt, paused);
    Pets.tick(dt, onMain);
    Events.update(dt, paused);

    if (!paused && !Cauldron.hasGolden()) {
      bubbleIn -= dt * (Econ.potion('bubbles') ? 3 : 1) * (1 + Pets.bonus('bubble'));
      if (bubbleIn <= 0) {
        Cauldron.spawnGolden();
        bubbleIn = rand(C.bubbleMinSec, C.bubbleMaxSec) / (1 + 0.08 * Econ.skill('s1'));
        if (UI.sinceSay() > 3000) UI.say(pick(D.phrases.bubble), 1800);
      }
    }

    if (!paused) {
      phraseIn -= dt;
      if (phraseIn <= 0) {
        phraseIn = rand(25, 45);
        if (UI.sinceSay() > 8000 && !Visitors.active()) {
          UI.say(Cauldron.mood() === 'sleepy' ? pick(D.phrases.sleepy) : (Events.phrase() || pick(D.phrases.idle)), 3000);
        }
      }
    }

    // котёл рисуется только когда его видно
    if (onMain) {
      Cauldron.update(dt, Econ.perHour() / 3600);
      Cauldron.render();
    }

    UI.previewFrame(dt);

    uiT += dt;
    if (uiT >= 0.2) {
      uiT = 0;
      const r = Econ.checkRankUp();
      if (r >= 0) {
        applyRankLook();
        Sound.fanfare();
        Cauldron.setMood('excited', 2000);
        UI.toast('Новый ранг: ' + D.ranks[r].name + '! Тап +1');
        UI.say(pick(D.phrases.rankUp), 3000);
        saveNow(true);
      }
      UI.refresh();
    }

    achT += dt;
    if (achT >= 1) {
      achT = 0;
      const got = Econ.checkAchievements();
      got.forEach((a, i) => setTimeout(() => { UI.toast('Достижение: ' + a.name + ' · +' + C.crystals.achievement + ' ' + UI.crystalsWord(C.crystals.achievement)); Sound.fanfare(); }, i * 1300));
      if (got.length && UI.sinceSay() > 3000) UI.say(pick(D.phrases.achievement), 2200);
    }

    dayT += dt;
    if (dayT >= 15) { dayT = 0; Econ.ensureQuests(); Econ.countDay(); }

    localT += dt;
    if (localT >= C.localSaveSec) { localT = 0; saveNow(false); }
    cloudT += dt;
    if (cloudT >= C.cloudSaveSec) { cloudT = 0; saveNow(true); }

    requestAnimationFrame(frame);
  }
  // экран загрузки: ждём только то, что видно на главном экране
  const critical = new Set(['backgrounds/room', 'cauldron/pot', 'cauldron/liquid', 'cauldron/bubble', 'scene/counter']);
  const wear = Econ.s.wear;
  const wearImg = (id) => { const w = D.wardrobe.find((x) => x.id === id); return w && (w.img || 'wardrobe/' + w.id); };
  [wearImg(wear.stand || 'stand_iron'), wearImg(wear.spoon), wearImg(wear.face), wearImg(wear.bed)].forEach((n) => n && critical.add(n));
  if (typeof Scene !== 'undefined') Scene.items().forEach((it) => critical.add(it.img));
  if (typeof Pets !== 'undefined' && Pets.inRoom) Pets.inRoom().forEach((id) => { for (let i = 0; i < 16; i++) critical.add('pets/' + id + '/' + String(i).padStart(2, '0')); });
  const critUrls = [...critical].map(IMG).concat([...document.images].map((im) => im.getAttribute('src')).filter((u) => u && u.startsWith('assets/')));
  if (typeof Online !== 'undefined') Online.start();
  if (typeof Coven !== 'undefined') Coven.start();
  Loader.boot(critUrls, [...preload].filter((n) => !critical.has(n)).map(IMG));
  requestAnimationFrame(frame);
})();

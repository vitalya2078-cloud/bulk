// =====================================================================
//  Версия 0.7: сюжетные просьбы жителей
//  Когда дружба с жителем доходит до «Приятеля», он просит о помощи.
//  У каждого - цепочка из трёх просьб со своей историей и наградой в конце.
//
//  Виды шагов:
//    give:  { id: n }      - отдать ингредиенты (тратятся при сдаче)
//    brew:  'зелье', n     - сварить зелье (brew: '*' - любое)
//    trip:  'локация', n   - вернуться из похода в эту локацию
//    feed:  n              - покормить питомцев
//    order: n              - выполнить заказы этого жителя
// =====================================================================

CONFIG.storyFriend = 2;           // с какого уровня дружбы начинаются просьбы («Приятель»)
CONFIG.storyStepCrystals = 3;     // за каждый шаг
CONFIG.storyFinalCrystals = 15;   // за всю цепочку
CONFIG.xp.storyStep = 40;
CONFIG.xp.storyFinal = 150;

DATA.storyChains = {
  agafya: {
    title: 'Любимец бабушки', rare: 'fern',
    steps: [
      { give: { mint: 2, chamomile: 2 }, text: 'Блины без мятного чая - не блины! Поделишься мятой и ромашкой?',
        ok: 'Вот это аромат! Сразу вспомнила, как мы с подружками гадали на ромашке.' },
      { brew: 'sleep', n: 1, text: 'Внучка ночами не спит - всё звёзды считает. Свари сонное зелье, только ласковое.',
        ok: 'Спит, как сурок, и улыбается во сне. Спасибо тебе, золотце.' },
      { give: { honey: 2, berries: 2 }, text: 'Хочу испечь тебе блины с мёдом и ягодами. Принеси начинку, а тесто - моё.',
        ok: 'Держи блины, ещё горячие! И вот, нашла в сундуке цветок папоротника. Говорят, приносит удачу.' }
    ]
  },
  miron: {
    title: 'Гроза сомов', rare: 'pearl',
    steps: [
      { trip: 'swamp', n: 1, text: 'Сом ушёл в болото, чую! Отправь своего зверька, пусть разведает.',
        ok: 'Видели усы? Длиной с весло! Значит, он там.' },
      { give: { seaweed: 2, fishscale: 2 }, text: 'Сому нужна приманка: водоросли да чешуйки. Он у нас гурман.',
        ok: 'Приманка что надо. Сом уже облизывается, я уверен.' },
      { brew: 'luck', n: 1, text: 'Без удачи сома не взять. Свари-ка зелье удачи - сегодня мой день!',
        ok: 'Клюнул! Сорвался, хитрец, но выплюнул жемчужину. Бери, это тебе - на удачу.' }
    ]
  },
  varya: {
    title: 'Друг юной художницы', rare: 'moonflower',
    steps: [
      { brew: '*', n: 3, text: 'Хочу посмотреть, как варятся зелья! Свари три любых, а я нарисую.',
        ok: 'Смотри, это ты, а это Бульк. Похож? Он смешно пыхтит!' },
      { feed: 3, text: 'Можно я покормлю твоего питомца? Ну пожалуйста! Давай вместе, три раза.',
        ok: 'Он ел у меня с ладошки! Это самый лучший день.' },
      { give: { stardust: 2, firefly: 1 }, text: 'Хочу нарисовать ночное небо настоящими звёздами. Принесёшь звёздную пыль и светлячка?',
        ok: 'Картина светится в темноте! Держи лунный цветок - я нашла его на поляне.' }
    ]
  },
  tikhon: {
    title: 'Друг мельника', rare: 'amber',
    steps: [
      { give: { acorn: 3 }, text: 'Жернов скрипит: мыши растащили желудёвое масло. Принеси жёлуди, сделаю новое.',
        ok: 'Не скрипит! Мельница поёт басом, как я.' },
      { trip: 'forest', n: 1, text: 'Для новой лопасти нужна крепкая ветка. Пусть твой питомец поищет в лесу.',
        ok: 'Отличная ветка. Ровная, как стрела.' },
      { brew: 'power', n: 2, text: 'Мешки с мукой тяжёлые. Свари мне два зелья силы - на неделю.',
        ok: 'Таскаю по два мешка разом! Вот, нашёл в муке кусочек янтаря. Пусть у тебя будет.' }
    ]
  },
  lusha: {
    title: 'Душа ярмарки', rare: 'nugget',
    steps: [
      { give: { honey: 2, pumpkin: 2 }, text: 'Тыквенный пирог на ярмарку! Нужны мёд и тыква.',
        ok: 'Тесто поднялось до потолка! Пахнет на всю улицу.' },
      { order: 2, text: 'Заказов на пироги - тьма! Помоги мне ещё два раза, как обычно.',
        ok: 'Успели! Все пироги разобрали за минуту.' },
      { brew: 'guest', n: 1, text: 'Хочу, чтобы на ярмарку пришла вся деревня. Сваришь зелье гостеприимства?',
        ok: 'Пришли все, даже Мирон без удочки! Держи - кто-то расплатился за пирог самородком.' }
    ]
  },
  efim: {
    title: 'Сваха деревни', rare: 'fairy_wing',
    steps: [
      { brew: 'power', n: 1, text: 'Завтра смотр. Надо выглядеть богатырём. Зелье силы, а?',
        ok: 'Капитан сказал: «Молодец!» А Луша видела. Кажется.' },
      { give: { rosehip: 2, lily: 1 }, text: 'Хочу подарить Луше букет… Шиповник и кувшинку. Только тсс!',
        ok: 'Она покраснела! Или это от печки? Но букет взяла.' },
      { brew: 'wisdom', n: 1, text: 'Что ей сказать-то? Свари зелье мудрости - может, слова найду.',
        ok: 'Я позвал её на ярмарку, и она согласилась! Это крылышко феи - талисман смелых. Тебе нужнее.' }
    ]
  },
  savva: {
    title: 'Слушающий лес', rare: 'mermaid_tear',
    steps: [
      { trip: 'forest', n: 1, text: 'Лес шепчет, что захворал старый дуб. Сходи с питомцем, посмотри.',
        ok: 'Кора потрескалась, листья вянут. Беда, но поправимая.' },
      { give: { moss: 3, mandrake: 1 }, text: 'Дубу нужен компресс из мха и корня мандрагоры. Мандрагору бери вежливо.',
        ok: 'Приложил. Дуб вздохнул. Ты слышал? Я слышал.' },
      { brew: 'time', n: 1, text: 'Пусть дуб вспомнит, сколько ему лет и сколько ещё впереди. Сваришь зелье времени?',
        ok: 'Зазеленел! А у корней нашлась слеза русалки - когда-то здесь было озеро. Возьми.' }
    ]
  },
  grisha: {
    title: 'Главный сорванец', rare: 'firebird',
    steps: [
      { brew: 'bubbles', n: 1, text: 'Хочу пускать пузыри размером с телегу! Есть такое зелье?',
        ok: 'Пузырь унёс кошку тётки Луши! Ненадолго. Она не злится. Почти.' },
      { trip: 'meadow', n: 1, text: 'На лугу ночью прыгает огонёк! Пусть твой питомец проверит, что это.',
        ok: 'Это было перо жар-птицы! Ну, почти. Тень от пера. Но я видел!' },
      { brew: 'dragon', n: 1, text: 'Хочу дышать огнём, как дракон! Ну хоть немножко!',
        ok: 'Я чихнул огоньком! Мама в ужасе, а я счастлив. Держи перо - настоящее, честное слово.' }
    ]
  }
};

DATA.titles.push(...Object.keys(DATA.storyChains).map((id) => ({
  id: 'st_' + id, name: DATA.storyChains[id].title, test: (s) => !!(s.story && s.story[id] && s.story[id].done)
})));
DATA.achievements.push(
  { id: 'sn1', img: 'ui/heart3', name: 'Добрый сосед',   desc: 'Выполни все просьбы одного жителя', test: (s) => Object.values(s.story || {}).some((x) => x.done) },
  { id: 'sn2', img: 'ui/heart4', name: 'Душа деревни II', desc: 'Выполни просьбы всех жителей',     test: (s) => Object.keys(DATA.storyChains).every((id) => s.story && s.story[id] && s.story[id].done) }
);

const Story = (() => {
  const C = CONFIG, D = DATA;
  const S = () => Econ.s;
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const st = () => { if (!S().story || typeof S().story !== 'object') S().story = {}; return S().story; };
  const chain = (id) => D.storyChains[id];
  const vis = (id) => Econ.findVisitor(id);

  // открыта ли цепочка (дружба «Приятель» и выше)
  const unlocked = (id) => Econ.friendLevel(id) >= C.storyFriend;
  function cur(id) {
    const c = chain(id); if (!c || !unlocked(id)) return null;
    const x = st()[id] || (st()[id] = { i: 0, p: 0 });
    if (x.done || x.i >= c.steps.length) return null;
    return { x, step: c.steps[x.i], idx: x.i, total: c.steps.length };
  }
  // сколько нужно и сколько сделано
  function progress(id) {
    const c = cur(id); if (!c) return null;
    const s = c.step;
    if (s.give) {
      const parts = Object.keys(s.give).map((k) => ({ id: k, need: s.give[k], have: Math.min(s.give[k], Brew.count(k)) }));
      const need = parts.reduce((a, q) => a + q.need, 0), have = parts.reduce((a, q) => a + q.have, 0);
      return { need, have, parts, ready: have >= need };
    }
    const need = s.n || s.feed || s.order || 1;
    return { need, have: Math.min(need, c.x.p), ready: c.x.p >= need };
  }
  const readyList = () => Object.keys(D.storyChains).filter((id) => { const p = progress(id); return p && p.ready; });
  const activeList = () => Object.keys(D.storyChains).filter((id) => cur(id));

  // события игры
  function event(kind, arg) {
    if (typeof Requests !== 'undefined') Requests.event(kind, arg);
    Object.keys(D.storyChains).forEach((id) => {
      const c = cur(id); if (!c) return;
      const s = c.step;
      let hit = false;
      if (kind === 'brew' && s.brew && (s.brew === '*' || s.brew === arg)) hit = true;
      else if (kind === 'trip' && s.trip === arg) hit = true;
      else if (kind === 'feed' && s.feed) hit = true;
      else if (kind === 'order' && s.order && arg === id) hit = true;
      if (hit) {
        const before = progress(id).ready;
        c.x.p++;
        if (!before && progress(id).ready) setTimeout(() => UI.toast(vis(id).name + ': просьба выполнена! Загляни в «Задания»'), 1800);
      }
    });
  }

  // сдать шаг. Возвращает { last, essence, crystals, rare }
  function claim(id) {
    const c = cur(id), p = progress(id);
    if (!c || !p || !p.ready) return null;
    if (c.step.give) for (const k in c.step.give) S().ing[k] -= c.step.give[k];
    const essence = Econ.hoursOfIncome(1, 2000);
    Econ.earn(essence);
    let crystals = C.storyStepCrystals;
    Econ.addXp(C.xp.storyStep);
    c.x.i++; c.x.p = 0;
    const res = { step: c.step, essence, last: false };
    if (c.x.i >= c.total) {
      c.x.done = true;
      crystals += C.storyFinalCrystals;
      const r = chain(id).rare;
      S().ing[r] = (S().ing[r] || 0) + 1;
      Econ.addXp(C.xp.storyFinal);
      res.last = true; res.rare = r; res.title = chain(id).title;
    }
    Econ.addCrystals(crystals);
    res.crystals = crystals;
    return res;
  }

  // ---------- текст шага ----------
  function goalText(step) {
    if (step.give) return 'Принести: ' + Object.keys(step.give).map((k) => Brew.ing(k).name + ' ×' + step.give[k]).join(', ');
    if (step.brew) return step.brew === '*' ? 'Сварить любые зелья: ' + step.n : 'Сварить: ' + D.brews.find((b) => b.id === step.brew).name + (step.n > 1 ? ' ×' + step.n : '');
    if (step.trip) { const L = D.locations.find((l) => l.id === step.trip); return 'Поход питомца: ' + (L ? L.name : step.trip); }
    if (step.feed) return 'Покормить питомцев: ' + step.feed + ' раза';
    if (step.order) return 'Выполнить заказы ' + '×' + step.order;
    return '';
  }

  // карточка просьбы (для «Заданий» и окна жителя)
  function card(id, after) {
    const v = vis(id), c = cur(id), p = progress(id);
    if (!c) return null;
    const btn = p.ready
      ? h('button', { class: 'pill-btn', type: 'button', onclick: () => doClaim(id, after) }, c.step.give ? 'Отдать' : 'Готово')
      : h('span', { class: 'quest-state' }, p.have + '/' + p.need);
    const parts = c.step.give ? h('div', { class: 'give-row' }, p.parts.map((q) => h('span', { class: 'give-it' + (q.have >= q.need ? ' ok' : '') },
      pic(Brew.ing(q.id).img), q.have + '/' + q.need))) : null;
    return h('div', { class: 'row-card story-card' + (p.ready ? ' ready' : '') },
      h('div', { class: 'ico v-ico' }, pic(v.img)),
      h('div', { class: 'info' },
        h('div', { class: 'name' }, v.name, h('small', { class: 'step-n' }, ' · просьба ' + (c.idx + 1) + ' из ' + c.total)),
        h('div', { class: 'desc story-text' }, '«' + c.step.text + '»'),
        h('div', { class: 'meta' }, goalText(c.step)),
        parts,
        c.step.give ? null : h('div', { class: 'bar' }, h('i', { style: 'width:' + (100 * p.have / p.need) + '%' }))),
      btn);
  }

  function doClaim(id, after) {
    const r = claim(id);
    if (!r) return;
    const v = vis(id);
    Sound.fanfare();
    Cauldron.setMood('happy', 1500);
    if (window.Game) Game.save();
    if (UI.isModalOpen()) UI.closeModal();
    UI.modal({
      title: v.name,
      body: h('div', null,
        h('div', { class: 'dlg-portrait' }, h('span', { class: 'dlg-ava' }, pic(r.last && v.imgHappy ? v.imgHappy : v.img)), pic('hud/avatar_frame', 'dlg-frame')),
        h('p', { class: 'm-sub' }, r.last ? 'История завершена!' : 'Спасибо за помощь!'),
        h('p', { class: 'story' }, '«' + r.step.ok + '»'),
        h('div', { class: 'reward-list' },
          h('span', null, UI.money(UI.ess(r.essence))),
          h('span', null, UI.money(r.crystals, 'ui/crystal')),
          r.rare ? h('span', null, pic(Brew.ing(r.rare).img, 'money-ico'), Brew.ing(r.rare).name) : null),
        r.last ? h('p', { class: 'small center' }, 'Новый титул в профиле: «' + r.title + '»') : null),
      actions: [{ label: 'Спасибо!', onClick: () => { if (after) setTimeout(after, 0); } }]
    });
    UI.refresh(true);
  }

  // блок для вкладки «Задания»
  function tasksBlock(box) {
    const list = activeList();
    box.append(h('h3', { class: 'section-title' }, 'Истории жителей'));
    if (!list.length) {
      const done = Object.keys(D.storyChains).filter((id) => st()[id] && st()[id].done).length;
      box.append(h('p', { class: 'note center' }, done === Object.keys(D.storyChains).length
        ? 'Ты помог всем жителям. Деревня тебя обожает!'
        : 'Подружись с жителями до уровня «Приятель» - и они попросят о помощи.'));
      return;
    }
    list.sort((a, b) => (progress(b).ready ? 1 : 0) - (progress(a).ready ? 1 : 0)).forEach((id) => box.append(card(id)));
  }

  return { event, claim, progress, readyList, activeList, card, tasksBlock, cur, unlocked };
})();

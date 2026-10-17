// =====================================================================
//  Уровень алхимика и дерево навыков.
//  Опыт дают почти все действия. Каждый уровень - 1 очко навыка.
//  4 ветки по 5 навыков, у каждого 3 ступени. Навык открывается,
//  когда изучена хотя бы 1 ступень предыдущего в той же ветке.
//  id навыков хранятся в сохранениях - не меняй их.
// =====================================================================

CONFIG.xp = {
  tap: 1, card: 8, tool: 20, order: 25, recipe: 60, recipeTry: 5, rune: 40,
  quest: 30, daily: 20, bubble: 15, lantern: 5, rankUp: 100
};
CONFIG.maxLevel = 61;            // 60 очков - ровно на все навыки
CONFIG.skillReset = 20;          // сброс навыков за кристаллы
// Сколько опыта нужно, чтобы с уровня L перейти на L+1
CONFIG.xpNeed = (L) => Math.round(60 * Math.pow(L, 1.7));

DATA.skillBranches = [
  { id: 'h', name: 'Травник',        img: 'skills/herbalist', desc: 'Доход в час и кладовая' },
  { id: 't', name: 'Мастер черпака', img: 'skills/ladle',     desc: 'Сила помешивания' },
  { id: 'v', name: 'Друг деревни',   img: 'skills/village',   desc: 'Гости, заказы и дружба' },
  { id: 's', name: 'Знаток',         img: 'skills/scholar',   desc: 'Рецепты, пузыри и опыт' }
];

// per - прибавка за одну ступень; text(v) - что даёт навык при значении v
DATA.skills = [
  { id: 'h1', b: 'h', img: 'cards/mint',     name: 'Плодородная почва', per: 5,   text: (v) => '+' + v + '% к доходу в час' },
  { id: 'h2', b: 'h', img: 'ui/basket',      name: 'Большие закрома',   per: 1,   text: (v) => '+' + v + ' ч к кладовой' },
  { id: 'h3', b: 'h', img: 'cards/tags',     name: 'Выгодные сделки',   per: 3,   text: (v) => 'Карточки дешевле на ' + v + '%' },
  { id: 'h4', b: 'h', img: 'cards/glass',    name: 'Тёплая теплица',    per: 10,  text: (v) => '+' + v + '% к доходу, пока тебя нет' },
  { id: 'h5', b: 'h', img: 'cards/mandrake', name: 'Сердце сада',       per: 10,  text: (v) => '+' + v + '% к доходу в час' },

  { id: 't1', b: 't', img: 'ui/ladle',       name: 'Крепкая рука',      per: 1,   text: (v) => '+' + v + ' к каждому тапу' },
  { id: 't2', b: 't', img: 'ui/bolt',        name: 'Точный удар',       per: 3,   text: (v) => v + '% шанс тапа ×5' },
  { id: 't3', b: 't', img: 'ui/essence',     name: 'Помешивание с секретом', per: 0.01, text: (v) => 'Тап даёт ещё ' + String(Math.round(v * 100) / 100).replace('.', ',') + '% дохода в час' },
  { id: 't4', b: 't', img: 'ui/whirlwind',   name: 'Неутомимость',      per: 5,   text: (v) => 'Буря помешиваний дольше на ' + v + ' с' },
  { id: 't5', b: 't', img: 'ui/trophy',      name: 'Мастер черпака',    per: 25,  text: (v) => 'Сила тапа ×' + String(Math.round(Math.pow(1.25, v / 25) * 100) / 100).replace('.', ',') },

  { id: 'v1', b: 'v', img: 'ui/door',        name: 'Гостеприимство',    per: 8,   text: (v) => 'Гости приходят на ' + v + '% чаще' },
  { id: 'v2', b: 'v', img: 'ui/gift',        name: 'Щедрые заказы',     per: 10,  text: (v) => '+' + v + '% к наградам за заказы' },
  { id: 'v3', b: 'v', img: 'ui/hourglass',   name: 'Терпение',          per: 2,   text: (v) => '+' + v + ' с на заказ' },
  { id: 'v4', b: 'v', img: 'ui/heart3',      name: 'Тёплые слова',      per: 15,  text: (v) => v + '% шанс, что заказ засчитается за два для дружбы' },
  { id: 'v5', b: 'v', img: 'ui/crystal',     name: 'Душа деревни',      per: 10,  text: (v) => v + '% шанс получить кристалл за заказ' },

  { id: 's1', b: 's', img: 'cauldron/bubble', name: 'Острый глаз',      per: 8,   text: (v) => 'Пузыри появляются на ' + v + '% чаще' },
  { id: 's2', b: 's', img: 'ui/book',        name: 'Мудрость',          per: 1,   text: (v) => '+' + v + ' ' + Fmt.plural(v, ['попытка', 'попытки', 'попыток']) + ' в рецепте дня' },
  { id: 's3', b: 's', img: 'ui/crystal_ball', name: 'Щедрый пузырь',    per: 20,  text: (v) => '+' + v + '% к наградам пузырей' },
  { id: 's4', b: 's', img: 'ui/scroll',      name: 'Учёный',            per: 10,  text: (v) => '+' + v + '% опыта' },
  { id: 's5', b: 's', img: 'ui/crystal_pile', name: 'Звёздный дар',     per: 1,   text: (v) => '+' + v + ' ' + Fmt.plural(v, ['кристалл', 'кристалла', 'кристаллов']) + ' за рецепт и руну дня' }
];
DATA.skillMax = 3;

// Достижения и титулы за уровень и навыки
DATA.achievements.push(
  { id: 'lv1', img: 'skills/level', name: 'Подмастерье',      desc: 'Достигни 5 уровня алхимика',  test: (s) => s.lvl >= 5 },
  { id: 'lv2', img: 'skills/level', name: 'Мастер',           desc: 'Достигни 15 уровня алхимика', test: (s) => s.lvl >= 15 },
  { id: 'lv3', img: 'skills/level', name: 'Великий алхимик',  desc: 'Достигни 30 уровня алхимика', test: (s) => s.lvl >= 30 }
);
DATA.titles.push(
  { id: 'herbalist', name: 'Травник',        test: (s) => (s.sk.h5 || 0) >= 1 },
  { id: 'ladler',    name: 'Мастер черпака', test: (s) => (s.sk.t5 || 0) >= 1 },
  { id: 'villager',  name: 'Друг деревни',   test: (s) => (s.sk.v5 || 0) >= 1 },
  { id: 'scholar',   name: 'Знаток',         test: (s) => (s.sk.s5 || 0) >= 1 }
);

// ---------- Окно навыков ----------
const SkillsUI = (() => {
  const h = (...a) => UI.h(...a);
  let branch = 'h';

  function open(b) {
    if (b) branch = b;
    const body = h('div', { class: 'skills' });
    const draw = () => {
      body.innerHTML = '';
      const s = Econ.s;
      const pts = Econ.skillPoints();
      const need = Econ.xpToNext();
      body.append(h('div', { class: 'sk-head' },
        h('div', { class: 'lvl-badge big' }, UI.pic('skills/level'), h('b', null, s.lvl)),
        h('div', { class: 'sk-head-text' },
          h('b', null, 'Уровень алхимика ' + s.lvl),
          need ? h('div', { class: 'bar sk-bar' }, h('i', { style: 'width:' + Math.min(100, s.xp / need * 100) + '%' })) : null,
          h('small', null, need ? UI.ess(s.xp) + ' / ' + UI.ess(need) + ' опыта' : 'Максимальный уровень')),
        h('div', { class: 'sk-points' + (pts ? ' has' : '') }, UI.pic('skills/orb'), h('b', null, pts))));
      body.append(h('div', { class: 'sk-tabs' }, DATA.skillBranches.map((br) => {
        const spent = DATA.skills.filter((k) => k.b === br.id).reduce((a, k) => a + Econ.skill(k.id), 0);
        const t = h('button', { type: 'button', class: 'sk-tab' + (branch === br.id ? ' on' : '') },
          UI.pic(br.img), h('span', null, br.name), h('small', null, spent + '/' + 5 * DATA.skillMax));
        t.addEventListener('click', () => { branch = br.id; Sound.tap(); draw(); });
        return t;
      })));
      const br = DATA.skillBranches.find((x) => x.id === branch);
      body.append(h('p', { class: 'small center' }, br.desc + '. Навыки открываются по порядку.'));
      const list = DATA.skills.filter((k) => k.b === branch);
      list.forEach((k, i) => {
        const lv = Econ.skill(k.id);
        const prev = list[i - 1];
        const locked = prev && Econ.skill(prev.id) < 1;
        const max = lv >= DATA.skillMax;
        const now = lv ? k.text(+(k.per * lv).toFixed(1)) : 'Ещё не изучен';
        const next = max ? null : k.text(+(k.per * (lv + 1)).toFixed(1));
        // при 0 очков кнопка серая и прямо говорит, почему нельзя
        const noPts = !locked && !max && !pts;
        const btn = h('button', { class: 'pill-btn sk-btn' + (noPts ? ' no-pts' : ''), type: 'button', disabled: locked || max || !pts },
          max ? 'Макс.' : noPts ? 'Нет очков' : h('span', { class: 'money' }, UI.pic('skills/orb', 'money-ico'), '1'));
        btn.addEventListener('click', () => {
          if (!Econ.learnSkill(k.id)) { Sound.deny(); return; }
          Sound.buy();
          UI.toast(k.name + ': ступень ' + Econ.skill(k.id));
          if (window.Game) Game.save();
          draw(); UI.refresh(true);
        });
        body.append(h('div', { class: 'sk-row' + (locked ? ' locked' : '') + (max ? ' max' : '') },
          h('div', { class: 'ico' }, UI.pic(locked ? 'ui/padlock' : k.img)),
          h('div', { class: 'info' },
            h('div', { class: 'name' }, k.name),
            h('div', { class: 'pips' }, [0, 1, 2].map((j) => h('i', { class: j < lv ? 'on' : '' }))),
            h('div', { class: 'desc' }, locked ? 'Сначала изучи «' + prev.name + '»' : now),
            next && !locked ? h('div', { class: 'meta' }, 'Дальше: ' + next) : null),
          btn));
      });
      const spentAll = Econ.skillSpent();
      const reset = h('button', { class: 'btn alt', type: 'button', disabled: !spentAll },
        'Сбросить навыки за ', UI.money(CONFIG.skillReset, 'ui/crystal'));
      reset.addEventListener('click', () => {
        if (Econ.s.cr < CONFIG.skillReset) { Sound.deny(); UI.toast('Не хватает кристаллов: нужно ' + CONFIG.skillReset); return; }
        if (Econ.resetSkills()) { Sound.coin(); UI.toast('Очки навыков вернулись: ' + Econ.skillPoints()); if (window.Game) Game.save(); draw(); UI.refresh(true); }
      });
      body.append(h('p', { class: 'note left' }, 'Опыт дают тапы, улучшения, заказы жителей, рецепт и руна дня, задания, подарки и пузыри.'), reset);
    };
    draw();
    UI.modal({ sheet: true, title: '', body });
  }

  function levelUpModal(lv, gained) {
    UI.modal({
      title: 'Новый уровень: ' + lv + '!',
      body: h('div', null,
        h('div', { class: 'lvl-badge huge' }, UI.pic('skills/level'), h('b', null, lv)),
        h('p', { class: 'center' }, '+' + gained + ' ' + Fmt.plural(gained, ['очко', 'очка', 'очков']) + ' навыка. Потрать ' + (gained > 1 ? 'их' : 'его') + ' в дереве навыков.')),
      actions: [{ label: 'К навыкам', onClick: () => { setTimeout(() => open(), 0); } }, { label: 'Позже', alt: true }]
    });
  }

  return { open, levelUpModal };
})();

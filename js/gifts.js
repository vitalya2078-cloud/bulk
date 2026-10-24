// =====================================================================
//  0.31: награды одним описанием - для гримуара (pass.js) и лавки Варфоломея (market.js).
//  Описание награды: { k: вид, ...параметры }
//    ess { h }        - эссенция: доход за h часов (не меньше min)
//    cr { n }         - лунные кристаллы
//    ing { n, rare }  - n случайных ингредиентов, rare - шанс редкого
//    chest { c }      - сундук: w деревянный, s серебряный, g золотой, t звёздный
//    sh { n }         - мерцающие осколки (диковинки)
//    egg { t }        - яйцо питомца (frog, cat, owl, hedgehog, dragon, mystery)
//    fx { id, min }   - эффект: wind ×2 доход, inspire ×5 доход, storm ×5 тап; на min минут
//    scroll {}        - свиток рецепта (подсказка к рецепту)
//    spin {}          - ещё одно вращение колеса сегодня
//    title { id }     - титул (DATA.titles, проверка по s.stat.ttl)
//    ward { id }      - вещь гардероба (DATA.wardrobe, в s.own.acc)
// =====================================================================

const Gifts = (() => {
  const S = () => Econ.s;
  const CH = { w: 'Деревянный сундук', s: 'Серебряный сундук', g: 'Золотой сундук', t: 'Звёздный сундук' };
  const FX = { wind: ['Попутный ветер', 'доход ×2'], inspire: ['Вдохновение', 'доход ×5'], storm: ['Буря помешиваний', 'тап ×5'] };
  const hm = (h) => (h < 1 ? Math.round(h * 60) + ' мин' : (Number.isInteger(h) ? h : String(h).replace('.', ',')) + ' ч');
  const mins = (m) => (m < 1 ? Math.round(m * 60) + ' с' : m + ' мин');

  // картинка награды
  function img(g) {
    switch (g.k) {
      case 'ess': return 'ui/essence';
      case 'cr': return 'ui/crystal';
      case 'ing': return g.n === 1 && g.rare >= 1 ? 'ui/quality' : 'ui/basket';
      case 'chest': return 'relics/chest_' + g.c;
      case 'sh': return 'ui/shards';
      case 'egg': return (DATA.eggs[g.t] || DATA.eggs.mystery).img;
      case 'fx': return 'market/' + g.id;
      case 'ward': { const w = DATA.wardrobe.find((x) => x.id === g.id); return w ? w.img || 'wardrobe/' + w.id : 'ui/sparkle'; }
      case 'scroll': return 'ui/scroll';
      case 'spin': return 'r2/ic_wheel';
      case 'title': return 'ui/banner';
      default: return 'ui/sparkle';
    }
  }
  // короткая подпись
  function label(g) {
    switch (g.k) {
      case 'ess': return 'Эссенция · ' + hm(g.h) + ' дохода';
      case 'cr': return g.n + ' ' + UI.crystalsWord(g.n);
      case 'ing': return g.n === 1 && g.rare >= 1 ? 'Редкий ингредиент' : g.n + ' ' + Fmt.plural(g.n, ['ингредиент', 'ингредиента', 'ингредиентов']) + (g.rare >= 0.3 ? ', часто редкие' : '');
      case 'chest': return CH[g.c];
      case 'sh': return g.n + ' ' + Fmt.plural(g.n, ['осколок', 'осколка', 'осколков']);
      case 'egg': return (DATA.eggs[g.t] || DATA.eggs.mystery).name;
      case 'fx': return FX[g.id][0] + ': ' + FX[g.id][1] + ' на ' + mins(g.min);
      case 'scroll': return 'Свиток рецепта';
      case 'spin': return 'Ещё одно вращение колеса';
      case 'title': { const t = DATA.titles.find((x) => x.id === g.id); return 'Титул «' + (t ? t.name : g.id) + '»'; }
      case 'ward': { const w = DATA.wardrobe.find((x) => x.id === g.id); return (w ? w.name : g.id) + ' (гардероб)'; }
      default: return '';
    }
  }
  // короткое число для плитки награды
  function short(g) {
    switch (g.k) {
      case 'ess': return hm(g.h);
      case 'cr': return '×' + g.n;
      case 'ing': return '×' + g.n;
      case 'sh': return '×' + g.n;
      case 'fx': return mins(g.min);
      default: return '';
    }
  }
  // выдать; возвращает текст «что получено»
  function give(g) {
    const s = S();
    switch (g.k) {
      case 'ess': { const v = Econ.hoursOfIncome(g.h, 200 * g.h); Econ.earn(v); return '+' + UI.ess(v) + ' эссенции'; }
      case 'cr': Econ.addCrystals(g.n); return '+' + g.n + ' ' + UI.crystalsWord(g.n);
      case 'ing': { const l = Brew.give(g.n, g.rare || 0); return l.map((x) => x.name).join(', '); }
      case 'chest': Relics.addChest(g.c); return CH[g.c];
      case 'sh': Relics.addShards(g.n); return '+' + g.n + ' ' + Fmt.plural(g.n, ['осколок', 'осколка', 'осколков']);
      case 'egg': Pets.giveEgg(DATA.eggs[g.t] ? g.t : 'mystery'); Pets.refreshButton(); return label(g);
      case 'fx': Econ.addEffect(g.id, g.min * 60, g.min * 60 * 6); return label(g);
      case 'scroll': { Brew.reward('scroll'); return 'Свиток рецепта'; }
      case 'spin': Relics.extraSpin(); return 'Ещё одно вращение колеса';
      case 'title': { s.stat.ttl = Array.isArray(s.stat.ttl) ? s.stat.ttl : []; if (!s.stat.ttl.includes(g.id)) s.stat.ttl.push(g.id); return label(g); }
      case 'ward': if (!s.own.acc.includes(g.id)) s.own.acc.push(g.id); return label(g);
      default: return '';
    }
  }
  // плитка награды для окон
  function tile(g, cls) {
    return UI.h('span', { class: 'gift' + (cls ? ' ' + cls : ''), title: label(g) }, UI.pic(img(g), 'gift-ico'), short(g) ? UI.h('b', null, short(g)) : null);
  }
  return { img, label, short, give, tile };
})();

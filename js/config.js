// =====================================================================
//  Бульк - настройки и баланс. Почти всё правится здесь.
//  id карточек, достижений, заданий и жителей хранятся в сохранениях:
//  не меняй существующие id, новые добавляй в конец списков.
// =====================================================================

const CONFIG = {
  name: 'Бульк',
  version: '0.23.0',
  saveKey: 'bulk_save_v1',

  // ВКонтакте: ID мини-приложения (для ссылки-приглашения на стене)
  vkAppId: 54828995,
  // Telegram: имя бота и короткое имя мини-приложения из @BotFather.
  // Ссылка-приглашение: https://t.me/<бот>?startapp=ref_<id> (Main App) или /<приложение> если задано
  tgBotUsername: 'bulkgamemagikbot',
  tgAppName: '',
  // Официальные места игры (вкладка «Сообщество»). Пустая ссылка - кнопка не показывается.
  links: {
    vk: 'https://vk.com/club242380504',          // сообщество ВКонтакте
    tg: 'https://t.me/bulkgamemagikbot',          // Telegram: бот игры (канала пока нет)
    tgChannel: ''                                  // Telegram-канал, когда появится
  },
  slogan: 'Тапай, вари, колдуй - котёл всё помнит!',

  // Вне ВК и Telegram реклама и приглашения «срабатывают» понарошку,
  // чтобы можно было проверить награды. Внутри платформ не действует.
  // Включается только при запуске на своём телефоне/компьютере (localhost), на хостинге выключено.
  localTestMode: /^(localhost|127\.0\.0\.1|192\.168\.)/.test(location.hostname),

  localSaveSec: 5,
  cloudSaveSec: 30,

  // Карточки: цена каждого уровня ×1,6, прибавка дохода ×1,16
  // (0.10: игра рассчитана на 1,5 месяца до последнего ранга первой главы)
  cardCostGrowth: 1.6,
  cardIncomeGrowth: 1.16,
  // Тап: доля дохода в час за каждое помешивание (тот, кто тапает, растёт в 2-3 раза быстрее)
  tapIncomeShare: 0.0002,
  cardMaxLevel: 25,

  // Защита от автокликеров
  maxTapsPerSec: 14,        // больше этого в секунду не засчитывается
  botCheckWindow: 30,       // сколько последних интервалов анализировать
  botRegularity: 0.07,      // слишком ровный ритм (разброс < 7%) - подозрительно

  // Посетители
  visitorMinSec: 35,
  visitorMaxSec: 80,
  visitorWaitSec: 40,       // столько ждёт, пока примешь заказ
  orderSec: 15,             // на заказ даётся столько секунд

  // Волшебный пузырь
  bubbleMinSec: 120,
  bubbleMaxSec: 240,
  bubbleLifeSec: 12,

  // Реклама за награду (только ВК): ×2 к доходу
  windMinutes: 30,
  windMaxMinutes: 180,

  recipeAttempts: 6,        // попыток угадать рецепт дня
  welcomeBonus: 5000,       // подарок другу, пришедшему по приглашению
  inviteRewardHours: 1      // награда за приглашение (раз в день): доход за столько часов
};

// Путь к картинке: IMG('cards/mint') → 'assets/images/cards/mint.webp'
// Проверенные файлы лежат в памяти (blob) - их берём оттуда, иначе адрес с номером версии
const ASSET_BLOBS = {};
const ASSET_V = typeof MANIFEST !== 'undefined' ? MANIFEST.v : CONFIG.version;
const ASSET = (path) => ASSET_BLOBS[path] || 'assets/' + path + '?v=' + ASSET_V;
const IMG = (name) => ASSET('images/' + name + '.webp');

const DATA = {};

// ---------- Ранги лавки (по эссенции, сваренной за всё время) ----------
// Каждый ранг даёт +1 к силе тапа и украшает лавку
DATA.ranks = [
  { img: 'ranks/1', name: 'Лоток травницы',     need: 0 },
  { img: 'ranks/2', name: 'Лавочка',            need: 5000 },
  { img: 'ranks/3', name: 'Аптека',             need: 50000 },
  { img: 'ranks/4', name: 'Мастерская',         need: 5e6 },
  { img: 'ranks/5', name: 'Зельеварня',         need: 8e7 },
  { img: 'ranks/6', name: 'Гильдия алхимиков',  need: 4e8 },
  { img: 'ranks/7', name: 'Академия',           need: 2.5e9 },
  { img: 'ranks/8', name: 'Королевский алхимик', need: 1e10 },
  { img: 'ranks/9', name: 'Хранитель Камня',    need: 6e10 }
];

// ---------- Разделы лавки ----------
DATA.categories = [
  { id: 'garden', name: 'Огород' },
  { id: 'lab',    name: 'Лаборатория' },
  { id: 'shop',   name: 'Прилавок' },
  { id: 'guild',  name: 'Гильдия' }
];

// ---------- Карточки дохода ----------
// cost - цена первого уровня, income - доход в час на первом уровне
// req: { card, level } - нужна другая карточка; { rank } - нужен ранг
DATA.cards = [
  // Огород
  { id: 'mint',     cat: 'garden', icon: '🌿', name: 'Грядка мяты',        cost: 40,    income: 25,     desc: 'С неё начинается любое зелье' },
  { id: 'chamom',   cat: 'garden', icon: '🌼', name: 'Ромашковое поле',    cost: 400,   income: 140,    desc: 'Для успокаивающих отваров', req: { card: 'mint', level: 3 } },
  { id: 'pumpkin',  cat: 'garden', icon: '🎃', name: 'Тыквенная бахча',    cost: 5000,  income: 900,    desc: 'Тыквы тут размером с котёл', req: { rank: 1 } },
  { id: 'mushroom', cat: 'garden', icon: '🍄', name: 'Лунные грибы',       cost: 50000, income: 5200,   desc: 'Растут только при полной луне', req: { card: 'chamom', level: 5 } },
  { id: 'mandrake', cat: 'garden', icon: '🌱', name: 'Сад мандрагор',      cost: 6e5, income: 36000,  desc: 'Поют, если их не поливать', req: { rank: 3 } },
  { id: 'glass',    cat: 'garden', icon: '🏡', name: 'Хрустальная оранжерея', cost: 1e7, income: 2.6e5, desc: 'Здесь всегда весна', req: { rank: 5 } },

  // Лаборатория
  { id: 'mortar',   cat: 'lab', icon: '🥣', name: 'Ступка и пестик',     cost: 120,   income: 60,     desc: 'Толчёт травы в волшебную пыль' },
  { id: 'alembic',  cat: 'lab', icon: '⚗️', name: 'Перегонный куб',      cost: 1500,   income: 380,    desc: 'Капля за каплей, чистая магия', req: { card: 'mortar', level: 3 } },
  { id: 'dryer',    cat: 'lab', icon: '🌾', name: 'Сушилка трав',        cost: 8000,  income: 1400,   desc: 'Пахнет летом круглый год', req: { card: 'mint', level: 5 } },
  { id: 'flasks',   cat: 'lab', icon: '🧪', name: 'Полка с колбами',     cost: 1e5, income: 8200,   desc: 'Каждая колба светится по-своему', req: { rank: 2 } },
  { id: 'scope',    cat: 'lab', icon: '🔭', name: 'Звёздный телескоп',   cost: 1.5e6, income: 55000,  desc: 'Ловит звёздную пыль прямо с неба', req: { card: 'alembic', level: 10 } },
  { id: 'forge',    cat: 'lab', icon: '🔥', name: 'Философский горн',    cost: 2e7, income: 4e5,    desc: 'Огонь, который не обжигает', req: { rank: 6 } },

  // Прилавок
  { id: 'tags',     cat: 'shop', icon: '🏷️', name: 'Красивые ценники',    cost: 200,   income: 90,     desc: 'Покупатели любят, когда всё понятно' },
  { id: 'bell',     cat: 'shop', icon: '🔔', name: 'Колокольчик у двери', cost: 2500,  income: 560,    desc: 'Дзинь - и в лавке гость', req: { rank: 1 } },
  { id: 'window',   cat: 'shop', icon: '🍶', name: 'Витрина с флаконами', cost: 20000,  income: 2300,   desc: 'Прохожие не могут пройти мимо', req: { card: 'tags', level: 5 } },
  { id: 'chairs',   cat: 'shop', icon: '🛋️', name: 'Уютные кресла',       cost: 2e5, income: 13000,  desc: 'Гости задерживаются на чай', req: { rank: 2 } },
  { id: 'owlpost',  cat: 'shop', icon: '🦉', name: 'Доставка совами',     cost: 2.5e6, income: 80000,  desc: 'Зелья летят в соседние деревни', req: { rank: 4 } },
  { id: 'fair',     cat: 'shop', icon: '🎪', name: 'Ярмарочный шатёр',    cost: 4e7, income: 6.2e5,  desc: 'Твоя лавка на каждой ярмарке', req: { rank: 6 } },

  // Гильдия
  { id: 'mila',     cat: 'guild', icon: '👧', name: 'Ученица Мила',       cost: 800,   income: 230,    desc: 'Моет колбы и задаёт много вопросов', req: { rank: 1 } },
  { id: 'cat',      cat: 'guild', icon: '🐈', name: 'Кот Уголёк',         cost: 10000,  income: 1500,   desc: 'Мешает зелье хвостом, когда не спит', req: { card: 'mila', level: 3 } },
  { id: 'owl',      cat: 'guild', icon: '📒', name: 'Сова-счетовод Фимка', cost: 80000, income: 7000,  desc: 'Ни одна монетка не потеряется', req: { rank: 2 } },
  { id: 'gnome',    cat: 'guild', icon: '⛏️', name: 'Гном-поставщик',     cost: 1e6, income: 42000,  desc: 'Привозит кристаллы прямо из шахты', req: { rank: 3 } },
  { id: 'fairy',    cat: 'guild', icon: '🧚', name: 'Фея-курьер',         cost: 1.2e7, income: 2.9e5,  desc: 'Доставляет быстрее совы', req: { rank: 5 } },
  { id: 'dragon',   cat: 'guild', icon: '🐉', name: 'Дракон-печник',      cost: 1.5e8, income: 2.2e6,  desc: 'Руны под котлом не гаснут никогда', req: { rank: 7 } }
];

// Картинка карточки: assets/images/cards/<id>.webp
DATA.cards.forEach((c) => { c.img = 'cards/' + c.id; });

// ---------- Инструменты (улучшения тапа и кладовой) ----------
DATA.scoop = { img: 'ui/ladle', name: 'Черпак', desc: '+1 к каждому тапу', baseCost: 500, growth: 2.1, max: 40 };
// Кладовая: сколько часов копится доход, пока тебя нет
DATA.pantry = { img: 'ui/basket', name: 'Кладовая', hours: [3, 4, 6, 8, 12], costs: [0, 2e4, 2.5e5, 2.5e6, 2.5e7] };

// ---------- Временные эффекты ----------
DATA.effects = {
  wind:    { img: 'ui/wind', name: 'Попутный ветер', income: 2 },
  inspire: { img: 'ui/sparkle', name: 'Вдохновение',    income: 5 },
  storm:   { img: 'ui/whirlwind', name: 'Буря помешиваний', tap: 5 }
};

// ---------- Ежедневный подарок (7 дней по кругу) ----------
// hours - сколько часов дохода дарится (но не меньше min)
DATA.daily = [
  { hours: 0.5, min: 500 },
  { hours: 1,   min: 1000 },
  { hours: 1.5, min: 2000 },
  { hours: 2,   min: 3000 },
  { hours: 3,   min: 5000 },
  { hours: 4,   min: 8000 },
  { hours: 6,   min: 15000 }
];

// ---------- Ежедневные задания (каждый день 3 из списка) ----------
DATA.quests = [
  { id: 'taps',     type: 'taps',     img: 'ui/ladle', amounts: [300, 600, 1000], hours: 0.5,
    text: (n) => 'Помешай зелье ' + n + ' ' + Fmt.plural(n, ['раз', 'раза', 'раз']) },
  { id: 'levels',   type: 'levels',   img: 'ui/hammer', amounts: [3, 5, 10], hours: 0.75,
    text: (n) => 'Улучши карточки ' + n + ' ' + Fmt.plural(n, ['раз', 'раза', 'раз']) },
  { id: 'visitors', type: 'visitors', img: 'ui/door', amounts: [1, 2], hours: 1,
    text: (n) => 'Выполни просьбы жителей: ' + n },
  { id: 'recipe',   type: 'recipe',   img: 'ui/book', amounts: [1], hours: 1,
    text: () => 'Разгадай рецепт дня' },
  { id: 'rune',     type: 'rune',     img: 'ui/rune', amounts: [1], hours: 0.75,
    text: () => 'Начерти руну дня' },
  { id: 'bubble',   type: 'bubbles',  img: 'cauldron/bubble', amounts: [1, 2], hours: 0.75,
    text: (n) => 'Поймай ' + n + ' ' + Fmt.plural(n, ['волшебный пузырь', 'волшебных пузыря', 'волшебных пузырей']) }
];

// ---------- Ингредиенты для рецепта дня ----------
DATA.ingredients = [
  { img: 'ingredients/mint', name: 'Мята' },
  { img: 'ingredients/honey', name: 'Мёд' },
  { img: 'ingredients/mushroom', name: 'Лунный гриб' },
  { img: 'ingredients/dew', name: 'Роса' },
  { img: 'ingredients/spark', name: 'Искра' },
  { img: 'ingredients/stardust', name: 'Звёздная пыль' },
  { img: 'ingredients/chamomile', name: 'Ромашка' },
  { img: 'ingredients/crystal', name: 'Кристалл' },
  { img: 'ingredients/pumpkin', name: 'Тыква' }
];

DATA.potionNames = [
  'Зелье тёплых снов', 'Эликсир смелости', 'Настой хорошего настроения', 'Отвар лёгкой походки',
  'Зелье звёздного света', 'Эликсир пышного теста', 'Настой тишины', 'Зелье смешливости'
];

// ---------- Руны (точки в квадрате 0..1, чертятся по порядку) ----------
DATA.runes = [
  { name: 'Молния',     pts: [[0.32, 0.1], [0.62, 0.1], [0.42, 0.48], [0.7, 0.48], [0.34, 0.9]] },
  { name: 'Волна',      pts: [[0.1, 0.5], [0.3, 0.25], [0.5, 0.5], [0.7, 0.75], [0.9, 0.5]] },
  { name: 'Домик',      pts: [[0.2, 0.88], [0.2, 0.42], [0.5, 0.12], [0.8, 0.42], [0.8, 0.88], [0.2, 0.88]] },
  { name: 'Звезда',     pts: [[0.5, 0.08], [0.76, 0.88], [0.1, 0.38], [0.9, 0.38], [0.24, 0.88], [0.5, 0.08]] },
  { name: 'Месяц',      pts: [[0.62, 0.1], [0.3, 0.28], [0.22, 0.58], [0.42, 0.86], [0.76, 0.84]] },
  { name: 'Треугольник', pts: [[0.5, 0.12], [0.88, 0.84], [0.12, 0.84], [0.5, 0.12]] },
  { name: 'Ключ',       pts: [[0.15, 0.5], [0.6, 0.5], [0.6, 0.3], [0.85, 0.3], [0.85, 0.7], [0.6, 0.7]] }
];

// ---------- Достижения ----------
// test(s, x): x = { perHour, levels (сумма уровней), rank, stories (дослушанных историй) }
DATA.achievements = [
  { id: 't1', img: 'ui/ladle', name: 'Первый бульк',       desc: 'Помешай зелье',               test: (s) => s.taps >= 1 },
  { id: 't2', img: 'ui/ladle', name: 'Ловкие руки',        desc: 'Помешай зелье 1000 раз',      test: (s) => s.taps >= 1000 },
  { id: 't3', img: 'ui/whirlwind', name: 'Вихрь в котле',      desc: 'Помешай зелье 10 тыс раз',    test: (s) => s.taps >= 1e4 },
  { id: 't4', img: 'ui/trophy', name: 'Легенда черпака',    desc: 'Помешай зелье 100 тыс раз',   test: (s) => s.taps >= 1e5 },
  { id: 'h1', img: 'ui/essence', name: 'Своё дело',          desc: 'Доход 1 тыс в час',          test: (s, x) => x.perHour >= 1e3 },
  { id: 'h2', img: 'ui/essence', name: 'Дело пошло',         desc: 'Доход 50 тыс в час',         test: (s, x) => x.perHour >= 5e4 },
  { id: 'h3', img: 'ui/crystal_ball', name: 'Золотая лавка',      desc: 'Доход 1 млн в час',          test: (s, x) => x.perHour >= 1e6 },
  { id: 'h4', img: 'ui/crown', name: 'Магнат зелий',       desc: 'Доход 50 млн в час',         test: (s, x) => x.perHour >= 5e7 },
  { id: 'l1', img: 'ui/hammer', name: 'Первые улучшения',   desc: 'Набери 10 уровней карточек',  test: (s, x) => x.levels >= 10 },
  { id: 'l2', img: 'ui/hammer', name: 'Хозяйство растёт',   desc: 'Набери 50 уровней карточек',  test: (s, x) => x.levels >= 50 },
  { id: 'l3', img: 'cards/glass', name: 'Большая стройка',    desc: 'Набери 150 уровней карточек', test: (s, x) => x.levels >= 150 },
  { id: 'r1', img: 'cards/tags', name: 'Своя лавочка',       desc: 'Достигни ранга «Лавочка»',   test: (s, x) => x.rank >= 1 },
  { id: 'r2', img: 'cards/alembic', name: 'Мастер своего дела', desc: 'Достигни ранга «Мастерская»', test: (s, x) => x.rank >= 3 },
  { id: 'r3', img: 'ui/scroll', name: 'В гильдии',          desc: 'Достигни ранга «Гильдия алхимиков»', test: (s, x) => x.rank >= 5 },
  { id: 'r4', img: 'ui/crown', name: 'При дворе',          desc: 'Достигни ранга «Королевский алхимик»', test: (s, x) => x.rank >= 7 },
  { id: 'v1', img: 'ui/door', name: 'Первый гость',       desc: 'Выполни заказ посетителя',    test: (s) => s.served >= 1 },
  { id: 'v2', img: 'cards/window', name: 'Любимая лавка',      desc: 'Выполни 50 заказов',          test: (s) => s.served >= 50 },
  { id: 'v3', img: 'chars/agafya_happy', name: 'Добрый слушатель',   desc: 'Дослушай историю жителя',     test: (s, x) => x.stories >= 1 },
  { id: 'v4', img: 'chars/savva_happy', name: 'Душа деревни',       desc: 'Дослушай все истории',        test: (s, x) => x.stories >= DATA.visitors.length },
  { id: 'd1', img: 'ui/gift', name: 'Неделя вместе',      desc: 'Забирай подарок 7 дней подряд', test: (s) => s.daily.s >= 7 },
  { id: 'd2', img: 'ui/book', name: 'Знаток рецептов',    desc: 'Разгадай 7 рецептов дня',     test: (s) => s.recipesSolved >= 7 },
  { id: 'd3', img: 'ui/rune', name: 'Рунописец',          desc: 'Начерти 7 рун дня',           test: (s) => s.runesDone >= 7 },
  { id: 'b1', img: 'cauldron/bubble', name: 'Пузырь удачи',       desc: 'Поймай волшебный пузырь',     test: (s) => s.bb >= 1 },
  { id: 'b2', img: 'ui/sparkle', name: 'Ловец пузырей',      desc: 'Поймай 25 пузырей',           test: (s) => s.bb >= 25 }
];

// Цвет зелья меняется с рангом
DATA.liquids = ['#5BE0B3', '#7CF08A', '#8FB8FF', '#FFC94D', '#FF8FB1', '#C38BFF', '#5BD8FF', '#FFB86B', '#F2F2FF'];

// =====================================================================
//  Версия 0.2: лунные кристаллы, дружба, гардероб, аватары, титулы
// =====================================================================

// ---------- Лунные кристаллы (вторая валюта) ----------
// Их нельзя натапать: только ежедневные дела, дружба и достижения
CONFIG.crystals = {
  start: 15,           // на старте, чтобы сразу можно было что-то купить
  daily: [1, 1, 2, 2, 3, 3, 5], // за ежедневный подарок по дням серии
  quest: 1,            // за каждое выполненное задание
  recipe: 3,           // за разгаданный рецепт дня
  rune: 2,             // за начерченную руну дня
  friendship: 5,       // за новый уровень дружбы с жителем
  achievement: 2       // за каждое новое достижение
};

// ---------- Дружба с жителями ----------
// need - сколько просьб выполнить; bonus - прибавка к награде за заказы
DATA.friendship = [
  { name: 'Незнакомец',  need: 0,  img: 'ui/heart0' },
  { name: 'Знакомый',    need: 1,  img: 'ui/heart1' },
  { name: 'Приятель',    need: 3,  img: 'ui/heart2' },
  { name: 'Друг',        need: 6,  img: 'ui/heart3' },
  { name: 'Лучший друг', need: 10, img: 'ui/heart4' }
];
CONFIG.friendshipBonus = 0.15;

// ---------- Гардероб Булька ----------
// slot: head - на голову (одно за раз), face - на «лицо»
// how: { free } | { visitor: id } - подарок за финал истории | { rank } | { cr: цена в кристаллах }
// w - ширина относительно котла, dy - посадка по высоте, rot - наклон
DATA.wardrobe = [
  { id: 'sprout',        slot: 'head', name: 'Росток',              how: { free: true },          w: 0.32, rot: 0 },
  { id: 'glasses',       slot: 'face', name: 'Круглые очки',        how: { visitor: 'agafya' },   w: 1.0 },
  { id: 'tricorn',       slot: 'head', name: 'Пиратская треуголка', how: { visitor: 'miron' },    w: 0.62 },
  { id: 'bow',           slot: 'head', name: 'Бантик',              how: { visitor: 'varya' },    w: 0.42, x: 0.22, dy: 0.2, rot: 0.25 },
  { id: 'beanie',        slot: 'head', name: 'Вязаная шапка',       how: { visitor: 'tikhon' },   w: 0.5 },
  { id: 'toque',         slot: 'head', name: 'Поварской колпак',    how: { visitor: 'lusha' },    w: 0.46 },
  { id: 'viking',        slot: 'head', name: 'Шлем викинга',        how: { visitor: 'efim' },     w: 0.66 },
  { id: 'wreath',        slot: 'head', name: 'Венок',               how: { visitor: 'savva' },    w: 0.72, dy: 0.9, rot: 0 },
  { id: 'cat_ears',      slot: 'head', name: 'Кошачьи ушки',        how: { visitor: 'grisha' },   w: 0.78, dy: 0.5, rot: 0 },
  { id: 'hat_wizard',    slot: 'head', name: 'Шляпа волшебника',    how: { rank: 3 },             w: 0.6 },
  { id: 'gradcap',       slot: 'head', name: 'Выпускная шапочка',   how: { rank: 6 },             w: 0.6 },
  { id: 'crown',         slot: 'head', name: 'Корона',              how: { rank: 7 },             w: 0.44 },
  { id: 'mushroom',      slot: 'head', name: 'Мухомор',             how: { cr: 20 },              w: 0.56 },
  { id: 'hat_witch',     slot: 'head', name: 'Шляпа ведьмы',        how: { cr: 25 },              w: 0.66 },
  { id: 'glasses_heart', slot: 'face', name: 'Очки-сердечки',       how: { cr: 25 },              w: 1.05 },
  { id: 'tophat',        slot: 'head', name: 'Цилиндр',             how: { cr: 30 },              w: 0.46 },
  { id: 'pumpkin',       slot: 'head', name: 'Шапка-тыква',         how: { cr: 35 },              w: 0.52 },
  { id: 'santa',         slot: 'head', name: 'Колпак Деда Мороза',  how: { cr: 35 },              w: 0.58 }
];

// ---------- Цвет котла ----------
DATA.potColors = [
  { id: 'base',    name: 'Чугунный',   color: null,      how: { free: true } },
  { id: 'copper',  name: 'Медный',     color: '#D9823B', how: { cr: 20 } },
  { id: 'emerald', name: 'Изумрудный', color: '#36B37E', how: { cr: 30 } },
  { id: 'sky',     name: 'Небесный',   color: '#4F8FE6', how: { cr: 30 } },
  { id: 'rose',    name: 'Розовый',    color: '#EC6FAE', how: { cr: 30 } },
  { id: 'gold',    name: 'Золотой',    color: '#F2B83A', how: { cr: 45 } }
];

// ---------- Цвет зелья: открывается рангами ----------
DATA.liquidNames = ['Мятное', 'Луговое', 'Небесное', 'Медовое', 'Ягодное', 'Лавандовое', 'Морское', 'Янтарное', 'Лунное'];

// ---------- Аватары игрока ----------
// Первые 4 бесплатно, остальные за кристаллы
DATA.avatars = [
  { id: 'a01', cr: 0 },  { id: 'a02', cr: 0 },  { id: 'a03', cr: 0 },  { id: 'a04', cr: 0 },
  { id: 'a05', cr: 10 }, { id: 'a06', cr: 10 }, { id: 'a07', cr: 15 }, { id: 'a08', cr: 10 },
  { id: 'a09', cr: 20 }, { id: 'a10', cr: 15 }, { id: 'a11', cr: 40 }, { id: 'a12', cr: 30 },
  { id: 'a13', cr: 25 }, { id: 'a14', cr: 30 }, { id: 'a15', cr: 25 },
  { id: 'a16', cr: 60 }, { id: 'a17', cr: 50 }, { id: 'a18', cr: 45 }, { id: 'a19', cr: 50 }, { id: 'a20', cr: 55 }
];
DATA.avatars.forEach((a) => { a.img = 'avatars/' + a.id; });

// ---------- Титулы под именем ----------
// test(s, x): x = { rank, bestFriends }
DATA.titles = [
  { id: 'novice',  name: 'Начинающий алхимик', test: () => true },
  { id: 'pupil',   name: 'Ученик Булька',      test: (s, x) => x.rank >= 1 },
  { id: 'friend',  name: 'Друг деревни',       test: (s, x) => x.bestFriends >= 1 },
  { id: 'loyal',   name: 'Верный гость',       test: (s) => s.ac.includes('d1') },
  { id: 'recipes', name: 'Знаток рецептов',    test: (s) => s.ac.includes('d2') },
  { id: 'runes',   name: 'Рунописец',          test: (s) => s.ac.includes('d3') },
  { id: 'bubbles', name: 'Ловец пузырей',      test: (s) => s.ac.includes('b2') },
  { id: 'master',  name: 'Мастер зелий',       test: (s, x) => x.rank >= 3 },
  { id: 'soul',    name: 'Душа деревни',       test: (s) => s.ac.includes('v4') },
  { id: 'ladle',   name: 'Легенда черпака',    test: (s) => s.ac.includes('t4') },
  { id: 'magnate', name: 'Магнат зелий',       test: (s) => s.ac.includes('h4') },
  { id: 'royal',   name: 'Королевский алхимик', test: (s, x) => x.rank >= 7 },
  { id: 'keeper',  name: 'Хранитель Камня',    test: (s, x) => x.rank >= 8 }
];

// ---------- Живой фон ----------
// Точки свечения на картинках фона. x, y - доля ширины и высоты картинки,
// r - радиус свечения в долях ширины, c - цвет. Вид (k) задаёт, как свет «дышит»:
// bottle - медленно пульсирует, на стекле вспыхивают искорки; candle/lantern/pumpkin -
// дрожит как живой огонь; bulb - лампочка гирлянды; window - спокойное сияние; ball - шар.
DATA.bgLights = {
  'backgrounds/shop': [
    { k: 'window',  x: 0.50, y: 0.18,  r: 0.24, c: '#8FA8FF' },
    { k: 'lantern', x: 0.93, y: 0.265, r: 0.12, c: '#FFC266' },
    { k: 'candle',  x: 0.055, y: 0.225, r: 0.075, c: '#FFC266' },
    { k: 'candle',  x: 0.04, y: 0.53,  r: 0.07, c: '#FFC266' },
    { k: 'candle',  x: 0.69, y: 0.535, r: 0.07, c: '#FFC266' },
    { k: 'bulb', x: 0.225, y: 0.27,  r: 0.04, c: '#FFE08A' },
    { k: 'bulb', x: 0.30,  y: 0.30,  r: 0.04, c: '#FFE08A' },
    { k: 'bulb', x: 0.41,  y: 0.322, r: 0.04, c: '#FFE08A' },
    { k: 'bulb', x: 0.575, y: 0.322, r: 0.04, c: '#FFE08A' },
    { k: 'bulb', x: 0.695, y: 0.295, r: 0.04, c: '#FFE08A' },
    { k: 'bulb', x: 0.80,  y: 0.255, r: 0.04, c: '#FFE08A' },
    { k: 'bottle', x: 0.105, y: 0.40, r: 0.075, c: '#FFB43A' },
    { k: 'bottle', x: 0.225, y: 0.395, r: 0.06, c: '#C25BFF' },
    { k: 'bottle', x: 0.13,  y: 0.525, r: 0.08, c: '#4AA8FF' },
    { k: 'bottle', x: 0.25,  y: 0.53,  r: 0.06, c: '#9BE53A' },
    { k: 'bottle', x: 0.82,  y: 0.41,  r: 0.07, c: '#FF4F86' },
    { k: 'bottle', x: 0.94,  y: 0.41,  r: 0.065, c: '#A76BFF' },
    { k: 'bottle', x: 0.82,  y: 0.54,  r: 0.07, c: '#9BE53A' },
    { k: 'bottle', x: 0.94,  y: 0.54,  r: 0.065, c: '#3E8BFF' }
  ],
  'backgrounds/halloween': [
    { k: 'window',  x: 0.50, y: 0.24, r: 0.24, c: '#FF9A3D' },
    { k: 'lantern', x: 0.11, y: 0.165, r: 0.11, c: '#FFC266' },
    { k: 'lantern', x: 0.90, y: 0.165, r: 0.11, c: '#FFC266' },
    { k: 'pumpkin', x: 0.15, y: 0.26, r: 0.12, c: '#FF8A2A' },
    { k: 'pumpkin', x: 0.85, y: 0.26, r: 0.12, c: '#FF8A2A' },
    { k: 'candle', x: 0.28,  y: 0.255, r: 0.065, c: '#FFC266' },
    { k: 'candle', x: 0.73,  y: 0.26,  r: 0.065, c: '#FFC266' },
    { k: 'candle', x: 0.645, y: 0.355, r: 0.06,  c: '#FFC266' },
    { k: 'candle', x: 0.145, y: 0.55,  r: 0.07,  c: '#FFC266' },
    { k: 'candle', x: 0.80,  y: 0.505, r: 0.075, c: '#FFC266' },
    { k: 'candle', x: 0.94,  y: 0.56,  r: 0.07,  c: '#FFC266' },
    { k: 'candle', x: 0.86,  y: 0.585, r: 0.05,  c: '#FFC266' },
    { k: 'ball',   x: 0.57,  y: 0.34,  r: 0.075, c: '#C27BFF' },
    { k: 'bottle', x: 0.04,  y: 0.37,  r: 0.07,  c: '#B45BFF' },
    { k: 'bottle', x: 0.14,  y: 0.375, r: 0.065, c: '#FF8A2A' },
    { k: 'bottle', x: 0.215, y: 0.385, r: 0.05,  c: '#E05BFF' },
    { k: 'bottle', x: 0.38,  y: 0.36,  r: 0.055, c: '#FF7A2A' },
    { k: 'bottle', x: 0.455, y: 0.365, r: 0.05,  c: '#FF9A3D' },
    { k: 'bottle', x: 0.86,  y: 0.385, r: 0.06,  c: '#A76BFF' },
    { k: 'bottle', x: 0.965, y: 0.37,  r: 0.06,  c: '#FF8A2A' },
    { k: 'bottle', x: 0.06,  y: 0.49,  r: 0.075, c: '#B45BFF' },
    { k: 'bottle', x: 0.18,  y: 0.48,  r: 0.07,  c: '#FFA040' },
    { k: 'bottle', x: 0.935, y: 0.49,  r: 0.075, c: '#B45BFF' }
  ]
};

// ---------- Устройство фонов ----------
// hearth - высота центра очага на картинке (доля), counter - есть ли прилавок спереди
DATA.bgMeta = {
  'backgrounds/shop': { hearth: 0.648, counter: true }
};

// Предметы сцены. Координаты - доли картинки фона (x - центр, y - низ, w - ширина).
// layer: 'floor' - на полу за питомцами, 'fg' - передний план (ближе всех, чуть размыт, сильнее сдвигается при наклоне)
DATA.bgMeta['backgrounds/shop'].props = [
  { img: 'scene/rug',      x: 0.50, y: 0.86, w: 0.50, layer: 'floor' },
  { img: 'scene/firewood', x: 0.15, y: 0.72, w: 0.15, layer: 'floor' },
  { img: 'scene/bucket',   x: 0.30, y: 0.70, w: 0.085, layer: 'floor' },
  { img: 'scene/flour',    x: 0.86, y: 0.72, w: 0.14, layer: 'floor' },
  { img: 'scene/scrolls',  x: 0.68, y: 0.85, w: 0.12, layer: 'floor' },
  { img: 'scene/lavender', x: 0.06, y: 0.17, w: 0.13, layer: 'fg', top: true },
  { img: 'scene/mint',     x: 0.94, y: 0.15, w: 0.12, layer: 'fg', top: true },
  { img: 'scene/ivy',      x: 0.99, y: 0.24, w: 0.11, layer: 'fg', top: true },
  { img: 'scene/lantern',  x: 0.76, y: 0.13, w: 0.08, layer: 'fg', top: true, swing: true }
];
// лунный луч из окна (центр и радиус окна в долях картинки)
DATA.bgMeta['backgrounds/shop'].window = { x: 0.52, y: 0.22, r: 0.15 };
// свечение для нового фона
DATA.bgLights['backgrounds/shop'] = [
  { k: 'window',  x: 0.52, y: 0.22, r: 0.24, c: '#8FA8FF' },
  { k: 'lantern', x: 0.82, y: 0.19, r: 0.12, c: '#FFC266' },
  { k: 'candle',  x: 0.209, y: 0.195, r: 0.075, c: '#FFC266' },
  { k: 'candle',  x: 0.94,  y: 0.45,  r: 0.075, c: '#FFC266' },
  { k: 'bulb', x: 0.12,  y: 0.106, r: 0.04, c: '#FFE08A' },
  { k: 'bulb', x: 0.254, y: 0.106, r: 0.04, c: '#FFE08A' },
  { k: 'bulb', x: 0.378, y: 0.081, r: 0.04, c: '#FFE08A' },
  { k: 'bulb', x: 0.538, y: 0.11,  r: 0.04, c: '#FFE08A' },
  { k: 'bulb', x: 0.673, y: 0.087, r: 0.04, c: '#FFE08A' },
  { k: 'bulb', x: 0.762, y: 0.041, r: 0.04, c: '#FFE08A' },
  { k: 'bulb', x: 0.885, y: 0.124, r: 0.04, c: '#FFE08A' },
  { k: 'bottle', x: 0.123, y: 0.193, r: 0.07, c: '#E05BD0' },
  { k: 'bottle', x: 0.141, y: 0.345, r: 0.08, c: '#7CE07A' },
  { k: 'bottle', x: 0.227, y: 0.345, r: 0.065, c: '#A76BFF' },
  { k: 'bottle', x: 0.313, y: 0.355, r: 0.065, c: '#FF4F6A' },
  { k: 'bottle', x: 0.682, y: 0.396, r: 0.05, c: '#7CE07A' },
  { k: 'bottle', x: 0.76,  y: 0.378, r: 0.075, c: '#B45BFF' },
  { k: 'bottle', x: 0.854, y: 0.391, r: 0.06, c: '#4A8BFF' },
  { k: 'bottle', x: 0.817, y: 0.281, r: 0.04, c: '#7CE07A' },
  { k: 'bottle', x: 0.866, y: 0.272, r: 0.045, c: '#C25BFF' },
  { k: 'bottle', x: 0.934, y: 0.262, r: 0.075, c: '#FFB43A' },
  { k: 'ball',   x: 0.952, y: 0.355, r: 0.06, c: '#E070FF' }
];

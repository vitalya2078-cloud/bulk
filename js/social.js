// =====================================================================
//  Возвращаем игроков (0.20):
//  * «Добавь лавку в избранное» (ВК) / «на главный экран» (Telegram) - один раз после
//    10 минут игры, повтор через 3 дня, подарок 20 кристаллов;
//  * «Поделиться в истории»: новый ранг, новый питомец, победа над боссом ковена.
//    ВКонтакте - картинка рисуется прямо в игре; Telegram - готовая картинка с сайта + подпись.
// =====================================================================

const Social = (() => {
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const FAV_GIFT = 20;
  const SITE = 'https://vitalya2078-cloud.github.io/bulk/';

  // ---------- избранное ----------
  function favTick() {
    const s = Econ.s;
    if (!s.fav || s.fav.done || s.fav.n >= 2 || !Platform.canFavorite()) return;
    if (s.fav.n === 0 ? (s.stat.play || 0) < 600 : Date.now() - s.fav.at < 3 * 86400000) return;
    if (UI.isModalOpen() || UI.screen() !== 'main' || (typeof Games !== 'undefined' && Games.active())) return;
    s.fav.n++; s.fav.at = Date.now();
    const vk = Platform.kind() === 'vk';
    UI.modal({
      title: vk ? 'Лавка под рукой' : 'Лавка на главном экране',
      body: h('div', { class: 'center' },
        h('div', { class: 'sheet-ico' }, pic('ui/gift_crystal')),
        h('p', null, vk ? 'Добавь «Бульк» в избранное - лавка будет всегда в один тап.' : 'Добавь «Бульк» на главный экран телефона - лавка будет открываться в один тап.'),
        h('p', { class: 'small' }, 'За это - подарок: ' + FAV_GIFT + ' ' + UI.crystalsWord(FAV_GIFT) + '.')),
      actions: [
        { label: vk ? 'Добавить в избранное' : 'Добавить на экран', onClick: async () => {
          const ok = await Platform.addFavorite();
          if (ok) {
            s.fav.done = true;
            Econ.addCrystals(FAV_GIFT);
            Sound.coin();
            UI.toast('Готово! +' + FAV_GIFT + ' ' + UI.crystalsWord(FAV_GIFT));
          }
          if (window.Game) Game.save();
          UI.refresh();
        } },
        { label: 'Не сейчас', alt: true, onClick: () => { if (window.Game) Game.save(); } }
      ]
    });
  }

  // ---------- напоминания ----------
  async function setNotify(v) {
    const s = Econ.s;
    if (v) {
      const ok = await Platform.allowNotify();
      if (!ok) { UI.toast(Platform.kind() === 'vk' ? 'ВКонтакте не разрешил уведомления' : 'Бот не сможет писать без разрешения'); return false; }
    }
    s.set.notif = !!v;
    if (window.Game) Game.save();
    if (typeof Online !== 'undefined') Online.notifyPush(false);
    UI.toast(v ? 'Буду напоминать, когда лавка полна или питомец вернётся' : 'Напоминания выключены');
    return true;
  }
  function notifyTick() {
    const s = Econ.s;
    if (s.set.notif || (s.set.notifAsked || 0) >= 1 || !Platform.canNotify()) return;
    if ((s.stat.play || 0) < 900 || UI.isModalOpen() || UI.screen() !== 'main' || (typeof Games !== 'undefined' && Games.active())) return;
    s.set.notifAsked = 1;
    UI.modal({
      title: 'Напоминать?',
      body: h('div', { class: 'center' },
        h('div', { class: 'sheet-ico' }, pic('ui/envelope')),
        h('p', null, 'Я напишу, когда кладовая лавки заполнится, питомец вернётся из похода или к ковену придёт босс.'),
        h('p', { class: 'small' }, 'Не чаще двух раз в день и только днём. Выключить можно в настройках.')),
      actions: [{ label: 'Да, напоминай', onClick: () => setNotify(true) }, { label: 'Не надо', alt: true, onClick: () => { if (window.Game) Game.save(); } }]
    });
  }

  // ---------- истории ----------
  const load = (name) => new Promise((res) => { const im = Sprites.get(name, res); if (im) res(im); setTimeout(() => res(null), 6000); });

  // картинка истории 1080x1920: фон лавки, логотип, главная картинка, подписи
  async function draw(o) {
    const W = 1080, H = 1920;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const [bg, logo, main] = await Promise.all([load(o.bg || 'backgrounds/room'), load('splash/logo'), load(o.img)]);
    x.fillStyle = '#24163A'; x.fillRect(0, 0, W, H);
    if (bg) { const k = Math.max(W / bg.naturalWidth, H / bg.naturalHeight); const w = bg.naturalWidth * k, hh = bg.naturalHeight * k; x.drawImage(bg, (W - w) / 2, (H - hh) / 2, w, hh); }
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(20,10,40,.55)'); g.addColorStop(0.45, 'rgba(20,10,40,.25)'); g.addColorStop(1, 'rgba(20,10,40,.85)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // сияние за главной картинкой
    const rg = x.createRadialGradient(W / 2, 900, 40, W / 2, 900, 520);
    rg.addColorStop(0, 'rgba(255,228,138,.55)'); rg.addColorStop(1, 'rgba(255,228,138,0)');
    x.fillStyle = rg; x.fillRect(0, 300, W, 1200);
    if (logo) { const w = 640, hh = w * logo.naturalHeight / logo.naturalWidth; x.drawImage(logo, (W - w) / 2, 150, w, hh); }
    if (main) { const s = 620; const k = Math.min(s / main.naturalWidth, s / main.naturalHeight); const w = main.naturalWidth * k, hh = main.naturalHeight * k; x.drawImage(main, (W - w) / 2, 900 - hh / 2, w, hh); }
    x.textAlign = 'center'; x.lineJoin = 'round';
    const text = (t, y, size, fill) => { x.font = '900 ' + size + 'px Nunito, sans-serif'; x.lineWidth = size * 0.18; x.strokeStyle = '#2A1040'; x.strokeText(t, W / 2, y); x.fillStyle = fill; x.fillText(t, W / 2, y); };
    text(o.title, 1340, 96, '#FFE48A');
    if (o.sub) text(o.sub, 1440, 62, '#FFF6E8');
    text('Заходи в мою лавку!', 1700, 58, '#9BE564');
    return cv.toDataURL('image/jpeg', 0.88);
  }

  // kind: rank | pet | boss; o: { title, sub, img, text }
  async function story(kind, o) {
    if (!Platform.canStory()) return false;
    const blob = Platform.kind() === 'vk' ? await draw(o) : '';
    return Platform.shareStory({ blob, url: SITE + 'assets/story/' + kind + '.jpg', text: o.text || (o.title + (o.sub ? ' - ' + o.sub : '')) });
  }
  // кнопка для окон: «Поделиться в истории»
  const storyAction = (kind, o) => Platform.canStory() ? [{ label: 'Поделиться в истории', alt: true, onClick: () => { story(kind, o); } }] : [];

  function start() {
    setInterval(() => { try { favTick(); notifyTick(); } catch (e) { /* ignore */ } }, 30000);
  }

  return { start, story, storyAction, draw, setNotify };
})();

// =====================================================================
//  Кнопка «Назад» телефона (0.20): идёт по шагам.
//  мини-игра -> предупреждение «Выйти из игры?»; открыто окно -> закрыть;
//  другой экран -> на главный; главный экран -> выход из игры (решает платформа).
//  Telegram: кнопка «Назад» Telegram видна, пока есть куда возвращаться.
//  ВКонтакте и браузер: одна запись в истории браузера, пока есть куда возвращаться.
// =====================================================================

const Back = (() => {
  const tg = (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) ? window.Telegram.WebApp : null;

  // есть ли куда возвращаться
  function depth() {
    if (typeof Games !== 'undefined' && Games.active()) return true;
    if (UI.isModalOpen()) return true;
    return UI.screen() !== 'main';
  }

  // один шаг назад; false - шагать некуда
  function handle() {
    if (typeof Games !== 'undefined' && Games.active()) return Games.back();
    if (UI.closeConfirm()) { Sound.tap(); return true; }
    if (UI.isModalOpen()) { if (UI.modalClosable()) { Sound.tap(); UI.closeModal(); } return true; }
    if (UI.screen() !== 'main') { Sound.tap(); UI.show('main'); return true; }
    return false;
  }

  let pushed = false, ignore = 0, tgShown = false;
  function sync() {
    const d = depth();
    if (tg && tg.BackButton) {
      if (d !== tgShown) { tgShown = d; try { d ? tg.BackButton.show() : tg.BackButton.hide(); } catch (e) { /* старый Telegram */ } }
      return;
    }
    if (d && !pushed) { try { history.pushState({ bulk: 1 }, ''); pushed = true; } catch (e) { /* ignore */ } }
    else if (!d && pushed) { pushed = false; ignore++; try { history.back(); } catch (e) { ignore--; } }
  }

  function start() {
    if (tg && tg.BackButton) {
      try { tg.BackButton.onClick(() => { handle(); setTimeout(sync, 50); }); } catch (e) { /* ignore */ }
    } else {
      window.addEventListener('popstate', () => {
        if (ignore > 0) { ignore--; return; }
        pushed = false;
        handle();
        setTimeout(sync, 50);
      });
    }
    setInterval(sync, 250);
  }

  return { start, handle };
})();

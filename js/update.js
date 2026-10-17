// =====================================================================
//  Проверка обновлений (0.19). Номер свежей версии лежит в version.json.
//  - при запуске: если страница пришла старая (кэш телефона или сервера) - сразу перезагрузка;
//  - при возвращении в игру после сворачивания: сохраняем прогресс и перезапускаемся на новой версии.
//  Защита от петли: на одну и ту же версию перезагружаемся не больше одного раза за сеанс.
// =====================================================================

const Updater = (() => {
  const CUR = CONFIG.version;
  const KEY = 'bulk_upd';
  let hiddenAt = 0, busy = false;

  function ss(v) { try { if (v === undefined) return sessionStorage.getItem(KEY); sessionStorage.setItem(KEY, v); } catch (e) { return null; } return null; }

  async function latest() {
    if (!/^https?:$/.test(location.protocol)) return null;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), 5000) : 0;
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
      if (!r.ok) return null;
      const j = await r.json();
      return j && typeof j.v === 'string' ? j.v : null;
    } catch (e) { return null; } finally { if (tm) clearTimeout(tm); }
  }

  async function check() {
    if (busy) return;
    busy = true;
    const v = await latest();
    busy = false;
    if (!v || v === CUR || ss() === v) return;
    ss(v);
    try { if (window.Game) window.Game.save(); } catch (e) { /* ignore */ }
    // метка в адресе - чтобы и сервер, и телефон отдали свежую страницу
    setTimeout(() => {
      const u = new URL(location.href);
      u.searchParams.set('_v', v);
      location.replace(u.href);
    }, 300);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 20000) check();
  });
  check();

  return { check };
})();

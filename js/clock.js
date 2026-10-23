// =====================================================================
//  Время игры (0.20.2). Раньше доход, таймеры зелий и питомцев и «новый день» шли по часам
//  телефона - их можно было перевести вперёд. Теперь Date.now() в игре:
//  * сверяется с временем базы (при запуске, при возвращении в игру и раз в 5 минут);
//  * пока игра открыта, идёт по внутреннему таймеру - перевод часов во время игры ни на что не влияет.
//  Без сети берётся последняя известная разница с часами телефона.
// =====================================================================

const Clock = (() => {
  const real = Date.now.bind(Date);
  const perf = () => performance.now();
  const KEY = 'bulk_clock';
  let off = 0;            // время базы минус часы телефона, мс
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && isFinite(v.off)) off = v.off; } catch (e) { /* ignore */ }
  // опорная точка: в момент aPerf время игры было aNow
  let aNow = real() + off, aPerf = perf();
  const now = () => aNow + (perf() - aPerf);
  const anchor = (t) => { aNow = t; aPerf = perf(); };

  Date.now = now;

  let pending = null, lastSync = 0;
  // сверка с базой; ready() ждёт текущую сверку не дольше 3 секунд
  function sync() {
    if (pending) return pending;
    const T = typeof CONFIG !== 'undefined' && CONFIG.tops;
    if (!T || typeof Online === 'undefined' || !Online.on()) return Promise.resolve(false);
    pending = (async () => {
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 5000);
      try {
        const t0 = perf();
        const r = await fetch(T.url + 'srv_time', { method: 'POST', signal: ctl.signal, body: '{}',
          headers: { apikey: T.key, Authorization: 'Bearer ' + T.key, 'Content-Type': 'application/json' } });
        if (!r.ok) return false;
        const srv = +(await r.text());
        const rtt = perf() - t0;
        if (!(srv > 1.6e12) || rtt > 4000) return false;
        anchor(srv + rtt / 2);
        off = now() - real();
        lastSync = perf();
        try { localStorage.setItem(KEY, JSON.stringify({ off: Math.round(off) })); } catch (e) { /* ignore */ }
        return true;
      } catch (e) { return false; } finally { clearTimeout(tm); pending = null; }
    })();
    return pending;
  }
  const ready = () => Promise.race([pending || Promise.resolve(false), new Promise((r) => setTimeout(() => r(false), 3000))]);

  // вернулся в игру: телефон мог спать (внутренний таймер стоял) - берём часы телефона с известной поправкой
  // и сразу сверяемся с базой
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    anchor(real() + off);
    sync();
  });
  setInterval(() => { if (!document.hidden && perf() - lastSync > 300000) sync(); }, 60000);

  return { now, sync, ready, real, offset: () => off };
})();

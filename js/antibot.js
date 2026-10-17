// Защита от автокликеров.
// Работает целиком в браузере, поэтому это «замок от честных людей»:
// отсекает программы-кликеры и макросы, но не взлом через консоль.
// Настоящую проверку можно будет добавить на сервере.
const AntiBot = (() => {
  const C = CONFIG;
  const win = [];         // время засчитанных тапов за последнюю секунду
  const intervals = [];   // промежутки между тапами
  let lastT = 0;
  let lastX = -1, lastY = -1, samePos = 0;
  let strikes = 0;        // сколько тапов подряд ритм был «машинным»
  let locked = false;
  const stats = { dropped: 0, locks: 0 };

  function cv(arr) {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length;
    return { mean: m, cv: Math.sqrt(v) / m };
  }

  // 'ok' - засчитать; 'drop' - тихо не засчитать; 'lock' - включить проверку
  function check(e, x, y) {
    if (!e.isTrusted) { stats.dropped++; return 'drop'; }        // события, созданные скриптом
    if (locked) return 'drop';

    const now = performance.now();
    while (win.length && now - win[0] > 1000) win.shift();
    if (win.length >= C.maxTapsPerSec) { stats.dropped++; return 'drop'; } // быстрее человека
    win.push(now);

    if (lastT) {
      intervals.push(now - lastT);
      if (intervals.length > C.botCheckWindow) intervals.shift();
    }
    lastT = now;

    if (Math.abs(x - lastX) < 1 && Math.abs(y - lastY) < 1) samePos++;
    else samePos = 0;
    lastX = x; lastY = y;

    if (intervals.length >= C.botCheckWindow) {
      const r = cv(intervals);
      // Человек не может долго тапать с идеально ровным ритмом
      if (r.mean < 400 && r.cv < C.botRegularity) strikes++;
      else strikes = Math.max(0, strikes - 2);
      // Одна и та же точка + почти ровный ритм - типичный кликер
      const pinned = samePos >= C.botCheckWindow * 2 && r.cv < C.botRegularity * 2.5;
      if (strikes >= 10 || pinned) {
        locked = true;
        strikes = 0; samePos = 0;
        intervals.length = 0;
        stats.locks++;
        return 'lock';
      }
    }
    return 'ok';
  }

  function unlock() { locked = false; intervals.length = 0; win.length = 0; lastT = 0; }

  return { check, unlock, isLocked: () => locked, stats };
})();

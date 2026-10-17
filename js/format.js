// Форматирование чисел и времени.
const Fmt = (() => {
  const SUF = ['', ' тыс', ' млн', ' млрд', ' трлн', ' квдр', ' квнт', ' скст', ' сптл', ' октл', ' нонл', ' дцл'];

  // «1.50» → «1,5», «4.0» → «4»
  const trim = (s) => (s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s).replace('.', ',');

  // 'short' - «1,5 млн», 'full' - «1 500 000» (до квадриллиона)
  let mode = 'short';
  const group = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');

  function num(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + num(-n);
    if (mode === 'full' && n >= 1000 && n < 1e15) return group(n);
    if (n < 1000) {
      if (n < 10) return trim((Math.floor(n * 10) / 10).toFixed(1));
      return String(Math.floor(n));
    }
    const e = Math.floor(Math.log10(n) / 3);
    if (e >= SUF.length) return n.toExponential(2).replace('.', ',').replace('e+', 'e');
    const v = n / Math.pow(1000, e);
    const s = v < 10 ? (Math.floor(v * 100) / 100).toFixed(2)
      : v < 100 ? (Math.floor(v * 10) / 10).toFixed(1)
      : String(Math.floor(v));
    return trim(s) + SUF[e];
  }

  // «1 ч 20 мин», «45 с»
  function time(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return h + ' ч' + (m ? ' ' + m + ' мин' : '');
    if (m) return m + ' мин' + (s && m < 5 ? ' ' + s + ' с' : '');
    return s + ' с';
  }

  // «4:05» или «1:04:05»
  function clock(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const pad = (x) => (x < 10 ? '0' + x : '' + x);
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  // plural(5, ['капля', 'капли', 'капель']) → 'капель'
  function plural(n, forms) {
    n = Math.abs(Math.floor(n)) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return forms[2];
    if (n1 > 1 && n1 < 5) return forms[1];
    if (n1 === 1) return forms[0];
    return forms[2];
  }

  return { num, time, clock, plural, setMode: (m) => { mode = m === 'full' ? 'full' : 'short'; } };
})();

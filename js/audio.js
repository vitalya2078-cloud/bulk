// Звуковой файл: сначала проверенная загрузка (целиком, с повтором), потом байты из памяти
function getSound(name) {
  const path = 'sounds/' + name + '.mp3';
  return (typeof Loader !== 'undefined' ? Loader.load(['assets/' + path], 3) : Promise.resolve())
    .then(() => fetch(ASSET(path)))
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
}

// Звуки и музыка синтезируются через WebAudio - внешние файлы не нужны.
const Sound = (() => {
  let ctx = null, sfxBus = null, musicBus = null;
  let sfxVol = 0.8, musicVol = 0.35;

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { return; }
      sfxBus = ctx.createGain(); sfxBus.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.connect(ctx.destination);
      applyVolumes();
    }
    if (ctx.state === 'suspended') ctx.resume();
    loadSfx();
    if (!introHold) Music.start();
  }

  function applyVolumes() {
    if (!ctx) return;
    sfxBus.gain.value = sfxVol;
    musicBus.gain.value = musicVol * 0.5;
  }

  function tone(f1, f2, dur, type, vol, delay) {
    if (!ctx || sfxVol <= 0) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(sfxBus);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  // ---------- музыка ----------
  // Треки - файлы assets/sounds/music_<имя>.mp3, уже склеенные в бесшовную петлю.
  // Играют через WebAudio (так петля без щелчка). Пока файл грузится или если он
  // не загрузился - звучит прежняя синтезированная мелодия.
  const Music = (() => {
    const FILE_GAIN = 1.5;                  // файлы громче синтеза
    const buffers = {}, loading = {};
    let want = 'shop', cur = null;          // cur = { name, src, gain }
    let playing = false;

    function load(name, cb) {
      if (buffers[name]) return cb(buffers[name]);
      if (loading[name]) { loading[name].push(cb); return; }
      loading[name] = [cb];
      const done = (buf) => { const l = loading[name]; delete loading[name]; if (buf) buffers[name] = buf; l.forEach((f) => f(buf)); };
      if (typeof fetch === 'undefined' || location.protocol === 'file:') return done(null);
      getSound('music_' + name)
        .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
        .then(done, () => done(null));
    }

    // плавно сменить трек
    function play(name) {
      if (!ctx || !playing) return;
      if (cur && cur.name === name) return;
      load(name, (buf) => {
        if (!playing || want !== name || (cur && cur.name === name)) return;
        const t = ctx.currentTime;
        if (cur) fadeOut(cur, t);
        if (!buf) { cur = null; Synth.start(); return; }
        Synth.stop();
        const src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = buf; src.loop = true;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(FILE_GAIN, t + 1.5);
        src.connect(g); g.connect(musicBus);
        src.start(t);
        cur = { name, src, gain: g };
      });
    }
    function fadeOut(c, t) {
      c.gain.gain.cancelScheduledValues(t);
      c.gain.gain.setValueAtTime(Math.max(0.0001, c.gain.gain.value), t);
      c.gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      c.src.stop(t + 1.3);
    }

    function start() {
      if (!ctx || musicVol <= 0) return;
      playing = true;
      if (!cur && !buffers[want]) Synth.start();   // пока грузится файл
      play(want);
    }
    function stop() {
      playing = false;
      Synth.stop();
      if (cur && ctx) { fadeOut(cur, ctx.currentTime); cur = null; }
    }
    function setTrack(name) {
      if (!name || name === want) return;
      want = name;
      if (playing) play(name);
    }
    return { start, stop, setTrack };
  })();

  // ---------- запасная мелодия, собранная из нот ----------
  const Synth = (() => {
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]; // до, ля минор, фа, соль
    const ARP = [0, 1, 2, 1, 3, 2, 1, 2];   // 3 - октава над корнем
    const BEAT = 60 / 72 / 2;               // восьмая при 72 ударах в минуту
    let timer = null, nextT = 0, step = 0;

    function note(m, t, dur, type, vol) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.value = hz(m);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(musicBus);
      o.start(t); o.stop(t + dur + 0.05);
    }

    function schedule() {
      if (!ctx || musicVol <= 0) return;
      while (nextT < ctx.currentTime + 0.4) {
        const bar = Math.floor(step / 8) % CHORDS.length;
        const ch = CHORDS[bar], i = step % 8, a = ARP[i];
        note(a === 3 ? ch[0] + 24 : ch[a] + 12, nextT, BEAT * 1.8, 'triangle', 0.05);
        if (i === 0) {
          ch.forEach((m) => note(m, nextT, BEAT * 8.5, 'sine', 0.025)); // мягкий аккорд
          note(ch[0] - 12, nextT, BEAT * 3.5, 'sine', 0.06);             // бас
        }
        if (i === 4) note(ch[0] - 12, nextT, BEAT * 3.5, 'sine', 0.045);
        if (i === 6 && bar === 3) note(ch[2] + 24, nextT, BEAT * 3, 'sine', 0.02); // колокольчик
        nextT += BEAT;
        step++;
      }
    }

    function start() {
      if (!ctx || timer || musicVol <= 0) return;
      nextT = ctx.currentTime + 0.1;
      timer = setInterval(schedule, 120);
    }
    function stop() { clearInterval(timer); timer = null; }
    return { start, stop };
  })();

  // ---------- звуки из файлов ----------
  // assets/sounds/<имя>.mp3 (звуки Kenney.nl, лицензия CC0, и бульки, собранные кодом).
  // Пока файл не загрузился - играет прежний синтезированный звук.
  const SFX = { blub1: 0, blub2: 0, blub3: 0, blub4: 0, tap: 0, deny: 0, coin: 0, buy: 0, pop: 0, bell: 0, fanfare: 0, brew: 0, hatch: 0 };
  const sfxBuf = {};
  let sfxLoaded = false;
  function loadSfx() {
    if (sfxLoaded || !ctx || typeof fetch === 'undefined' || location.protocol === 'file:') return;
    sfxLoaded = true;
    Object.keys(SFX).forEach((n) => {
      getSound(n)
        .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
        .then((b) => { sfxBuf[n] = b; }, () => {});
    });
  }
  // сыграть файл: vol - громкость, rate - скорость (и высота)
  function file(name, vol, rate) {
    const b = sfxBuf[name];
    if (!b || !ctx || sfxVol <= 0) return false;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b; src.playbackRate.value = rate || 1;
    g.gain.value = vol;
    src.connect(g); g.connect(sfxBus);
    src.start();
    return true;
  }
  let lastBlub = 0;
  const vary = (k) => 1 + (Math.random() * 2 - 1) * k;

  // ---------- джингл заставки ----------
  // Играет один раз; основная музыка вступает за 2 с до его конца, плавно.
  let introDone = false, introHold = false;
  function intro() {
    unlock();
    if (introDone || !ctx) return;
    introDone = true;
    if (location.protocol === 'file:' || musicVol <= 0) return;
    introHold = true; Music.stop();
    getSound('music_intro').then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then((buf) => {
        const src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = buf; g.gain.value = 1.5;
        src.connect(g); g.connect(musicBus); src.start();
        setTimeout(() => { introHold = false; Music.start(); }, Math.max(0, (buf.duration - 2) * 1000));
      }).catch(() => { introHold = false; Music.start(); });
  }

  // Когда вкладка скрыта, звук на паузе
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { Music.stop(); ctx.suspend(); }
    else { ctx.resume(); if (!introHold) Music.start(); }
  });

  return {
    unlock, intro,
    // какой трек играет: 'shop' или 'halloween'
    setMusic(name) { Music.setTrack(name); },
    setVolumes(sfx, music) {
      sfxVol = sfx; musicVol = music;
      applyVolumes();
      if (musicVol <= 0) Music.stop(); else if (ctx && !introHold) Music.start();
    },
    tap()  { if (!file('tap', 0.5, vary(0.04))) tone(520, 480, 0.05, 'sine', 0.05); },
    // бульк котла: 4 записи по очереди вперемешку, высота чуть гуляет
    blub() {
      let i = 1 + Math.floor(Math.random() * 4);
      if (i === lastBlub) i = (i % 4) + 1;
      lastBlub = i;
      if (file('blub' + i, 0.75, vary(0.12))) return;
      const f = 170 + Math.random() * 120;
      tone(f, f * 0.55, 0.11, 'sine', 0.14);
      tone(f * 2.4, f * 1.8, 0.06, 'sine', 0.04, 0.02);
    },
    buy()  { if (!file('buy', 0.8)) { tone(440, 440, 0.08, 'triangle', 0.1); tone(660, 660, 0.12, 'triangle', 0.1, 0.07); } },
    coin() { if (!file('coin', 0.75, vary(0.05))) { tone(988, 988, 0.08, 'square', 0.05); tone(1319, 1319, 0.18, 'square', 0.05, 0.08); } },
    pop()  { if (!file('pop', 0.8)) [784, 988, 1175, 1568].forEach((f, i) => tone(f, f, 0.12, 'sine', 0.09, i * 0.05)); },
    fanfare() { if (!file('fanfare', 0.8)) [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.2, 'triangle', 0.09, i * 0.09)); },
    deny() { if (!file('deny', 0.6)) tone(220, 180, 0.12, 'triangle', 0.07); },
    bell() { if (!file('bell', 0.55)) { tone(1568, 1568, 0.4, 'sine', 0.06); tone(2093, 2093, 0.5, 'sine', 0.04, 0.12); } },
    brew() { if (!file('brew', 0.8)) [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.2, 'triangle', 0.09, i * 0.09)); },
    // 0.29: тап по мебели комнаты - у каждого материала свой звук
    prop(kind) {
      switch (kind) {
        case 'glass': if (!file('bell', 0.28, 1.9 * vary(0.06))) tone(1800, 1700, 0.15, 'sine', 0.04); tone(2600, 2500, 0.08, 'sine', 0.015, 0.06); break;
        case 'metal': if (!file('bell', 0.32, 1.15 * vary(0.05))) tone(1200, 1150, 0.25, 'sine', 0.04); break;
        case 'magic': if (!file('pop', 0.5, 1.3 * vary(0.05))) tone(880, 1320, 0.2, 'sine', 0.05); break;
        case 'paper': tone(900, 500, 0.07, 'sawtooth', 0.018); tone(700, 400, 0.06, 'sawtooth', 0.014, 0.06); break;
        default: if (!file('tap', 0.65, 0.55 * vary(0.08))) tone(190, 120, 0.09, 'triangle', 0.09);
      }
    },
    hatch() { if (!file('hatch', 0.8)) [784, 988, 1175, 1568].forEach((f, i) => tone(f, f, 0.12, 'sine', 0.09, i * 0.05)); }
  };
})();

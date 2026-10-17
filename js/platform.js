// Одна обёртка для ВКонтакте, Telegram и обычного браузера.
// Остальной код вызывает Platform.*, не думая, где запущена игра.
const Platform = (() => {
  // Модуль ВК (vk-bridge) грузится в фоне (index.html); если сайт с модулем не ответил -
  // работаем через свой маленький мост (miniBridge), он умеет то же самое для нужных нам вызовов.
  let vk = window.vkBridge || null;
  const tg = (window.Telegram && window.Telegram.WebApp) || null;
  const qs = new URLSearchParams(location.search);

  let kind = 'web';
  try {
    if (tg && tg.initData) kind = 'tg';
    else if (qs.has('vk_app_id') && qs.has('vk_user_id')) kind = 'vk';
  } catch (e) { /* ignore */ }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const withTimeout = (p, ms) => Promise.race([p, wait(ms).then(() => { throw new Error('timeout'); })]);
  const vkCall = (m, p) => (vk || (vk = miniBridge())).send(m, p || {});

  // Свой мост к ВК: Android - window.AndroidBridge, iOS - webkit.messageHandlers, сайт - postMessage родителю.
  // Ответы приходят событием VKWebAppEvent (приложения) или message (сайт).
  function miniBridge() {
    const A = window.AndroidBridge, I = window.webkit && window.webkit.messageHandlers;
    let id = 0;
    const pending = {}, subs = [];
    const onEvent = (d) => {
      if (!d || !d.type) return;
      subs.forEach((f) => { try { f({ detail: d }); } catch (e) { /* ignore */ } });
      const rid = d.data && d.data.request_id;
      if (rid != null && pending[rid]) {
        const w = pending[rid]; delete pending[rid];
        if (/Failed$/.test(d.type)) w.rej(d.data); else w.res(d.data);
      }
    };
    window.addEventListener('VKWebAppEvent', (e) => onEvent(e.detail));
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.data && d.data.type) onEvent(d.data); else if (typeof d.type === 'string' && d.type.indexOf('VKWebApp') === 0) onEvent(d);
    });
    return {
      isEmbedded: () => true,
      subscribe: (f) => { subs.push(f); },
      send: (m, p) => new Promise((res, rej) => {
        const rid = ++id;
        const params = Object.assign({}, p || {}, { request_id: rid });
        pending[rid] = { res, rej };
        setTimeout(() => { if (pending[rid]) { delete pending[rid]; rej(new Error('timeout ' + m)); } }, 10000);
        try {
          if (A && typeof A[m] === 'function') A[m](JSON.stringify(params));
          else if (I && I[m]) I[m].postMessage(params);
          else if (window.parent !== window) window.parent.postMessage({ handler: m, params, type: 'vk-connect' }, '*');
          else { delete pending[rid]; rej(new Error('no bridge')); }
        } catch (e) { delete pending[rid]; rej(e); }
      })
    };
  }

  // ---------- запуск ----------
  async function init() {
    if (kind === 'vk') {
      // ждём настоящий модуль ВК (грузится в фоне), но не дольше 4 секунд
      if (!vk) vk = window.vkBridge || await Promise.race([window.__vkBridge || Promise.resolve(null), wait(4000).then(() => null)]) || window.vkBridge || miniBridge();
      // вырезы экрана и панели ВК: приходят в событии VKWebAppUpdateConfig (insets)
      const st = document.documentElement.style;
      const applyInsets = (ins) => {
        if (!ins) return;
        if (ins.top) st.setProperty('--safe-top', ins.top + 'px');
        if (ins.bottom) st.setProperty('--safe-bottom', ins.bottom + 'px');
      };
      try {
        vk.subscribe((e) => {
          const d = e && e.detail;
          if (d && d.type === 'VKWebAppUpdateConfig' && d.data) applyInsets(d.data.insets || d.data.safe_area_insets);
        });
      } catch (e) { /* старый bridge */ }
      try {
        if (window.__vkInitPromise) await withTimeout(window.__vkInitPromise, 3000);
        else await withTimeout(vkCall('VKWebAppInit'), 3000);
      } catch (e) { console.warn(e); }
      try { const c = await withTimeout(vkCall('VKWebAppGetConfig'), 2000); if (c) applyInsets(c.insets || c.safe_area_insets); } catch (e) { /* нет в вебе */ }
      // свайп «назад» в iOS не должен закрывать игру во время тапов
      vkCall('VKWebAppSetSwipeSettings', { history: false }).catch(() => {});
      vkCall('VKWebAppSetViewSettings', { status_bar_style: 'light', action_bar_color: '#24163A', navigation_bar_color: '#24163A' }).catch(() => {});
    } else if (kind === 'tg') {
      try {
        tg.ready();
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#24163A');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#24163A');
        if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); // чтобы тапы не сворачивали окно
        // Полноэкранный режим: игра заходит под строку состояния и кнопки «Закрыть» / «⋮».
        // Telegram сообщает, сколько места сверху и снизу занято, - отступаем на столько же.
        const applySafe = () => {
          const s = tg.safeAreaInset || {}, c = tg.contentSafeAreaInset || {};
          const top = (s.top || 0) + (c.top || 0), bottom = (s.bottom || 0) + (c.bottom || 0);
          const st = document.documentElement.style;
          if (top) st.setProperty('--safe-top', top + 'px'); else st.removeProperty('--safe-top');
          if (bottom) st.setProperty('--safe-bottom', bottom + 'px'); else st.removeProperty('--safe-bottom');
        };
        applySafe();
        ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged', 'viewportChanged'].forEach((ev) => { try { tg.onEvent(ev, applySafe); } catch (e) { /* старый Telegram */ } });
        setTimeout(applySafe, 300); setTimeout(applySafe, 1200);
      } catch (e) { console.warn(e); }
    }
  }

  // ---------- кто играет и откуда пришёл ----------
  function userId() {
    if (kind === 'vk') return qs.get('vk_user_id') || '';
    if (kind === 'tg') return String((tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || '');
    return '';
  }

  // Подпись платформы для нашей базы: Telegram - initData, ВК - параметры запуска (с подписью sign)
  function authData() {
    if (kind === 'tg') return (tg && tg.initData) || '';
    if (kind === 'vk') return qs.has('sign') && qs.has('vk_user_id') ? 'vk:' + location.search.slice(1) : '';
    return '';
  }

  // Код пригласившего: ВК - #ref_123 в адресе, Telegram - startapp=ref_123.
  // Код - номер игрока в нашей базе (uid); отрицательный пишется как n123.
  function referrer() {
    let raw = '';
    if (kind === 'tg') raw = (tg.initDataUnsafe && tg.initDataUnsafe.start_param) || '';
    else raw = (location.hash || '').replace('#', '') || qs.get('ref') || '';
    const m = /^ref_(n?\d+)$/.exec(raw);
    if (!m) return '';
    const id = m[1].replace(/^n/, '-');
    return id !== String(myUid || userId()) ? id : '';
  }
  let myUid = 0;
  const setUid = (u) => { myUid = u || 0; };
  const refCode = () => { const u = myUid || +userId() || 0; return u ? 'ref_' + String(u).replace('-', 'n') : ''; };

  // ---------- имя и фото профиля платформы ----------
  // { name, photo } - пустые строки, если платформа их не дала
  async function profile() {
    try {
      if (kind === 'vk') {
        const u = await withTimeout(vkCall('VKWebAppGetUserInfo'), 4000);
        return { name: (u && u.first_name) || '', photo: (u && (u.photo_200 || u.photo_100)) || '' };
      }
      if (kind === 'tg') {
        const u = (tg.initDataUnsafe && tg.initDataUnsafe.user) || {};
        return { name: u.first_name || '', photo: u.photo_url || '' };
      }
    } catch (e) { console.warn(e); }
    return { name: '', photo: '' };
  }

  // ---------- облачное сохранение (лимит у обеих платформ - 4096 символов) ----------
  const tgCloud = () => tg && tg.CloudStorage && (!tg.isVersionAtLeast || tg.isVersionAtLeast('6.9'));

  // Сохранение больше лимита делится на части: key = "~N|" + первая часть, key_1 … key_(N-1) - остальные
  const PART = 3800, MAXP = 8;
  async function rawGet(keys) {
    if (kind === 'vk') {
      const r = await withTimeout(vkCall('VKWebAppStorageGet', { keys }), 5000);
      const m = {}; ((r && r.keys) || []).forEach((x) => { m[x.key] = x.value || ''; });
      return keys.map((k) => m[k] || '');
    }
    if (kind === 'tg' && tgCloud()) {
      return await withTimeout(new Promise((res) => tg.CloudStorage.getItems(keys, (err, v) => res(err || !v ? keys.map(() => '') : keys.map((k) => v[k] || '')))), 5000);
    }
    return keys.map(() => '');
  }
  function rawSet(key, value) {
    if (kind === 'vk') vkCall('VKWebAppStorageSet', { key, value }).catch(() => {});
    else if (kind === 'tg' && tgCloud()) tg.CloudStorage.setItem(key, value, () => {});
  }
  async function storageGet(key) {
    try {
      const [first] = await rawGet([key]);
      if (!first) return null;
      const m = /^~(\d+)\|/.exec(first);
      if (!m) return first;
      const n = +m[1];
      const rest = n > 1 ? await rawGet(Array.from({ length: n - 1 }, (_, i) => key + '_' + (i + 1))) : [];
      if (rest.some((x) => !x)) return null;
      return first.slice(m[0].length) + rest.join('');
    } catch (e) { console.warn(e); }
    return null;
  }

  function storageSet(key, value) {
    try {
      if (value.length <= PART) { rawSet(key, value); return; }
      const parts = [];
      for (let i = 0; i < value.length; i += PART) parts.push(value.slice(i, i + PART));
      if (parts.length > MAXP) { console.warn('Сохранение слишком большое для облака'); return; }
      for (let i = parts.length - 1; i >= 1; i--) rawSet(key + '_' + i, parts[i]);
      rawSet(key, '~' + parts.length + '|' + parts[0]);
    } catch (e) { console.warn(e); }
  }

  // ---------- реклама за награду: пока только ВК ----------
  const adsAvailable = () => kind === 'vk' || (kind === 'web' && CONFIG.localTestMode);

  async function rewardedAd() {
    if (kind === 'vk') {
      try { const r = await vkCall('VKWebAppShowNativeAds', { ad_format: 'reward' }); return !!(r && r.result); }
      catch (e) { return false; }
    }
    if (kind === 'web' && CONFIG.localTestMode) { await wait(700); return true; }
    return false;
  }

  // ---------- вибрация на тап ----------
  let lastHaptic = 0;
  function haptic() {
    const now = Date.now();
    if (now - lastHaptic < 90) return;
    lastHaptic = now;
    try {
      if (kind === 'tg' && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      else if (kind === 'vk') vkCall('VKWebAppTapticImpactOccurred', { style: 'light' }).catch(() => {});
    } catch (e) { /* ignore */ }
  }

  // ---------- приглашения и посты ----------
  function inviteLink() {
    const id = userId();
    if (kind === 'tg' && CONFIG.tgBotUsername) {
      // без имени приложения - ссылка на главное приложение бота (Main App)
      return 'https://t.me/' + CONFIG.tgBotUsername + (CONFIG.tgAppName ? '/' + CONFIG.tgAppName : '') + '?startapp=' + (refCode() || 'play');
    }
    if (kind === 'vk' && CONFIG.vkAppId) return 'https://vk.com/app' + CONFIG.vkAppId + (refCode() ? '#' + refCode() : '');
    return '';
  }

  // true - приглашение отправлено (или показано окно отправки)
  async function invite(text) {
    if (kind === 'vk') {
      try { const r = await vkCall('VKWebAppShowInviteBox'); return !(r && r.success === false); } catch (e) { return false; }
    }
    if (kind === 'tg') {
      const link = inviteLink();
      const url = 'https://t.me/share/url?url=' + encodeURIComponent(link || 'https://t.me') + '&text=' + encodeURIComponent(text);
      try { tg.openTelegramLink(url); return true; } catch (e) { return false; }
    }
    if (navigator.share) { try { await navigator.share({ text }); return true; } catch (e) { return false; } }
    if (CONFIG.localTestMode) { await wait(300); return true; }
    return false;
  }

  // 'ok' | 'copied' | 'cancel' | 'fail'
  async function share(text) {
    const link = inviteLink();
    if (kind === 'vk') {
      const p = { message: text };
      if (link) p.attachments = link;
      try { await vkCall('VKWebAppShowWallPostBox', p); return 'ok'; } catch (e) { return 'cancel'; }
    }
    if (kind === 'tg') return (await invite(text)) ? 'ok' : 'fail';
    if (navigator.share) { try { await navigator.share({ text }); return 'ok'; } catch (e) { return 'cancel'; } }
    try { await navigator.clipboard.writeText(text); return 'copied'; } catch (e) { return 'fail'; }
  }

  // Рейтинг друзей есть только во ВКонтакте (окно самой платформы)
  const hasLeaderboard = () => false; // есть свой «Топ алхимиков»
  async function leaderboard(score) {
    try { await vkCall('VKWebAppShowLeaderBoardBox', { user_result: Math.max(0, Math.floor(score)) }); return true; }
    catch (e) { return false; }
  }

  // ---------- избранное / главный экран ----------
  const tgVer = (v) => { try { return !!(tg && tg.isVersionAtLeast && tg.isVersionAtLeast(v)); } catch (e) { return false; } };
  const canFavorite = () => kind === 'vk' || (kind === 'tg' && tgVer('8.0') && typeof tg.addToHomeScreen === 'function');
  async function addFavorite() {
    if (kind === 'vk') {
      try { const r = await withTimeout(vkCall('VKWebAppAddToFavorites'), 60000); return !!(r && r.result); } catch (e) { return false; }
    }
    if (kind === 'tg' && canFavorite()) {
      return new Promise((res) => {
        let done = false;
        const fin = (v) => { if (done) return; done = true; try { tg.offEvent('homeScreenAdded', ok); } catch (e) { /* ignore */ } res(v); };
        const ok = () => fin(true);
        try { tg.onEvent('homeScreenAdded', ok); tg.addToHomeScreen(); } catch (e) { fin(false); }
        setTimeout(() => fin(false), 60000);
      });
    }
    return false;
  }

  // ---------- разрешение на напоминания ----------
  const canNotify = () => kind === 'vk' || (kind === 'tg' && tgVer('6.9') && typeof tg.requestWriteAccess === 'function');
  async function allowNotify() {
    if (kind === 'vk') { try { const r = await withTimeout(vkCall('VKWebAppAllowNotifications'), 60000); return !!(r && r.result); } catch (e) { return false; } }
    if (kind === 'tg' && canNotify()) return new Promise((res) => { try { tg.requestWriteAccess((ok) => res(!!ok)); } catch (e) { res(false); } setTimeout(() => res(false), 60000); });
    return false;
  }

  // ---------- истории ----------
  const canStory = () => kind === 'vk' || (kind === 'tg' && tgVer('7.8') && typeof tg.shareToStory === 'function');
  // blob - картинка (data:image/jpeg) для ВК; url - картинка на сайте для Telegram; text - подпись
  async function shareStory(o) {
    if (kind === 'vk') {
      try {
        await vkCall('VKWebAppShowStoryBox', { background_type: 'image', blob: o.blob, attachment: { text: 'go_to', type: 'url', url: 'https://vk.com/app' + CONFIG.vkAppId } });
        return true;
      } catch (e) { return false; }
    }
    if (kind === 'tg' && canStory()) {
      try { tg.shareToStory(o.url, { text: (o.text || '').slice(0, 200), widget_link: { url: 'https://t.me/' + CONFIG.tgBotUsername + '?startapp', name: 'Бульк' } }); return true; } catch (e) { return false; }
    }
    return false;
  }

  const label = () => ({ vk: 'ВКонтакте', tg: 'Telegram', web: 'браузер' }[kind]);

  return {
    init, kind: () => kind, label, userId, referrer, profile, authData, setUid,
    storageGet, storageSet, adsAvailable, rewardedAd, haptic, canFavorite, addFavorite, canStory, shareStory, canNotify, allowNotify,
    invite, share, hasLeaderboard, leaderboard
  };
})();

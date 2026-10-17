// Одна обёртка для ВКонтакте, Telegram и обычного браузера.
// Остальной код вызывает Platform.*, не думая, где запущена игра.
const Platform = (() => {
  const vk = window.vkBridge || null;
  const tg = (window.Telegram && window.Telegram.WebApp) || null;
  const qs = new URLSearchParams(location.search);

  let kind = 'web';
  try {
    if (tg && tg.initData) kind = 'tg';
    else if (vk && (typeof vk.isEmbedded === 'function' ? vk.isEmbedded() : qs.has('vk_app_id'))) kind = 'vk';
  } catch (e) { /* ignore */ }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const withTimeout = (p, ms) => Promise.race([p, wait(ms).then(() => { throw new Error('timeout'); })]);
  const vkCall = (m, p) => vk.send(m, p || {});

  // ---------- запуск ----------
  async function init() {
    if (kind === 'vk') {
      try { await withTimeout(vkCall('VKWebAppInit'), 3000); } catch (e) { console.warn(e); }
    } else if (kind === 'tg') {
      try {
        tg.ready();
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#24163A');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#24163A');
        if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); // чтобы тапы не сворачивали окно
      } catch (e) { console.warn(e); }
    }
  }

  // ---------- кто играет и откуда пришёл ----------
  function userId() {
    if (kind === 'vk') return qs.get('vk_user_id') || '';
    if (kind === 'tg') return String((tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || '');
    return '';
  }

  // Код пригласившего: ВК - #ref_123 в адресе, Telegram - startapp=ref_123
  function referrer() {
    let raw = '';
    if (kind === 'tg') raw = (tg.initDataUnsafe && tg.initDataUnsafe.start_param) || '';
    else raw = (location.hash || '').replace('#', '') || qs.get('ref') || '';
    const m = /^ref_(\w+)$/.exec(raw);
    return m && m[1] !== userId() ? m[1] : '';
  }

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
    if (kind === 'tg' && CONFIG.tgBotUsername && CONFIG.tgAppName) {
      return 'https://t.me/' + CONFIG.tgBotUsername + '/' + CONFIG.tgAppName + (id ? '?startapp=ref_' + id : '');
    }
    if (kind === 'vk' && CONFIG.vkAppId) return 'https://vk.com/app' + CONFIG.vkAppId + (id ? '#ref_' + id : '');
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
  const hasLeaderboard = () => kind === 'vk';
  async function leaderboard(score) {
    try { await vkCall('VKWebAppShowLeaderBoardBox', { user_result: Math.max(0, Math.floor(score)) }); return true; }
    catch (e) { return false; }
  }

  const label = () => ({ vk: 'ВКонтакте', tg: 'Telegram', web: 'браузер' }[kind]);

  return {
    init, kind: () => kind, label, userId, referrer, profile,
    storageGet, storageSet, adsAvailable, rewardedAd, haptic,
    invite, share, hasLeaderboard, leaderboard
  };
})();

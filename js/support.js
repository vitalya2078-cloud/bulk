// =====================================================================
//  Поддержка из игры (0.21). Игрок пишет команде и видит ответы здесь же;
//  ответ ещё приходит письмом в «Почту». Обращения хранит база (support_send / support_get),
//  команда отвечает из админки. Повтор отправки не дублирует сообщение (номер сообщения cid).
// =====================================================================

const Support = (() => {
  const h = (...a) => UI.h(...a);
  const pic = (n, c) => UI.pic(n, c);
  const newCid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  const ERR = (e) => {
    const m = String(e && e.message || e);
    if (/too fast/.test(m)) return 'Много сообщений подряд. Подожди немного - мы всё прочитаем';
    if (/empty/.test(m)) return 'Напиши хотя бы пару слов';
    if (/banned/.test(m)) return 'Аккаунт заблокирован. Напиши в сообщество ВКонтакте';
    if (/play first/.test(m)) return 'Сначала поиграй чуть-чуть, чтобы лавка сохранилась';
    return 'Не получилось отправить. Проверь интернет и попробуй ещё раз';
  };

  function bubbles(list, t) {
    list.replaceChildren();
    const msgs = (t && t.msgs) || [];
    if (!msgs.length) {
      list.append(h('div', { class: 'sup-empty' }, pic('ui/support', 'sup-empty-ico'),
        h('b', null, 'Чем помочь?'),
        h('p', null, 'Опиши, что случилось: что делал и что пошло не так. Мы ответим здесь и письмом в почту. Номер твоей лавки команда увидит сама.')));
      return;
    }
    msgs.forEach((m) => list.append(h('div', { class: 'sup-msg' + (m.team ? ' team' : '') },
      h('small', null, (m.team ? (m.who || 'Поддержка') + ' · ' : 'Ты · ') + when(m.at)),
      h('p', null, m.text))));
    if (t.status === 'closed') list.append(h('p', { class: 'note center' }, 'Обращение закрыто. Напиши снова - откроется новое.'));
    else if (t.status === 'open') list.append(h('p', { class: 'note center' }, 'Сообщение у команды. Ответим, как только сможем.'));
  }

  async function open() {
    if (typeof Online === 'undefined' || !Online.on()) { UI.toast('Поддержка работает при подключении к сети'); return; }
    const list = h('div', { class: 'sup-list' }, h('p', { class: 'note center' }, 'Открываю переписку...'));
    const input = h('textarea', { class: 'sup-input', rows: '3', maxlength: '1000', placeholder: 'Напиши сообщение...' });
    let cid = newCid(), busy = false;
    const send = h('button', { class: 'btn', type: 'button' }, 'Отправить');
    send.addEventListener('click', async () => {
      const txt = input.value.trim();
      if (txt.length < 2) { UI.toast('Напиши хотя бы пару слов'); return; }
      if (busy) return;
      busy = true; send.disabled = true;
      // тот же cid при повторе: если ответ не дошёл, база не создаст второе сообщение
      try {
        const t = await Online.call('support_send', { p_text: txt, p_cid: cid }, 12000);
        input.value = ''; cid = newCid();
        Sound.coin();
        bubbles(list, t);
        requestAnimationFrame(() => { const last = list.lastElementChild; if (last) last.scrollIntoView({ block: 'end', behavior: 'smooth' }); });
      } catch (e) { Sound.deny(); UI.toast(ERR(e)); }
      busy = false; send.disabled = false;
    });
    UI.modal({ title: 'Поддержка', sheet: true, cls: 'fixed-h sup-modal',
      body: h('div', { class: 'sup-wrap' }, list, h('div', { class: 'sup-form' }, input, send)) });
    try { bubbles(list, await Online.call('support_get', {}, 10000)); }
    catch (e) { list.replaceChildren(h('p', { class: 'note center' }, 'Переписка сейчас не загрузилась, но написать можно.')); }
    requestAnimationFrame(() => { const last = list.lastElementChild; if (last) last.scrollIntoView({ block: 'end' }); });
  }

  return { open };
})();

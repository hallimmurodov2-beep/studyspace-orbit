'use strict';
/* ───────────── Flashcards: decks, spaced repetition, study mode ───────────── */

function masteryBar(st) {
  if (!st.total) return html`<div class="bar"></div>`;
  const seg = (n, c) => (n ? html`<i style="flex:${n};background:${c}"></i>` : '');
  return html`<div class="bar multi" title="${t('Mature')} ${st.mature} · ${t('Young')} ${st.young} · ${t('Learning')} ${st.learning} · ${t('New')} ${st.fresh}">${seg(st.mature, 'var(--ok)')}${seg(st.young, 'var(--accent)')}${seg(st.learning, 'var(--warn)')}${seg(st.fresh, 'var(--surface-3)')}</div>`;
}
function cardStatus(c) {
  if (c.state === 'new') return html`<span class="chip">${t('New')}</span>`;
  if (c.state === 'learn') return html`<span class="chip warn">${t('Learning')}</span>`;
  const d = Math.round((startOfDay(c.due) - startOfDay()) / DAY);
  return d <= 0 ? html`<span class="chip accent">${t('Due')}</span>` : html`<span class="chip ${c.ivl >= 21 ? 'ok' : ''}">${daysAway(d)}</span>`;
}

function decksHome() {
  const due = dueCount(), reviewedToday = state.reviewLog[todayStr()] || 0;
  return html`
  <div class="page-head">
    <div><h1 class="h1">${t('Flashcards')}</h1><div class="sub">${t('Studyspace shows each card right before you would forget it.')}</div></div>
    <div class="row wrap"><button class="btn" data-act="import-cards">${icon('upload', 16)}${t('Paste a list')}</button><button class="btn primary" data-act="new-deck">${icon('plus', 16)}${t('New deck')}</button></div>
  </div>
  ${state.decks.length ? html`
  <section class="card pad review-hero">
    <div class="row" style="gap:18px;flex-wrap:wrap">
      ${ring(due ? reviewedToday / (reviewedToday + due) : 1, 84, 8, 'url(#orbitGrad)', html`<div><div class="big-num" style="font-size:24px">${due}</div><div class="tiny faint">${t('to review')}</div></div>`)}
      <div class="grow" style="min-width:200px"><div class="h2">${due ? t('{n} waiting for you', { n: nt(due, 'card', 'cards') }) : t('All caught up')}</div>
      <div class="small muted">${due ? t('About {n} min. Reviewed today: {r}.', { n: Math.max(1, Math.round(due * 0.35)), r: reviewedToday }) : t('Reviewed today: {r}. Come back tomorrow — spacing is what makes it stick.', { r: reviewedToday })}</div></div>
      ${due ? html`<button class="btn primary lg" data-act="study" data-deck="">${icon('play', 15)}${t('Study now')}</button>` : ''}
    </div>
  </section>
  <div class="deck-grid">${state.decks.map(d => {
    const cs = deckCards(d.id), st = deckStats(cs), n = dueCount(d.id);
    return html`<a class="card pad click deck" href="#/cards/${d.id}" data-key="deck-${d.id}" style="--c:${subjColor(d.subjectId)}">
      <div class="row" style="gap:12px">${subjGlyph(d.subjectId)}<div class="grow"><div class="h3 trunc">${d.name}</div><div class="tiny faint">${subjName(d.subjectId) || t('General')} · ${nt(st.total, 'card', 'cards')}</div></div>${n ? html`<span class="chip accent">${n} ${t('to review')}</span>` : html`<span class="chip ok">${icon('check', 12)}</span>`}</div>
      ${masteryBar(st)}
      <div class="row tiny faint" style="gap:14px"><span>${t('Mature')} <b class="num" style="color:var(--text-2)">${st.mature}</b></span><span>${t('Learning')} <b class="num" style="color:var(--text-2)">${st.young + st.learning}</b></span><span>${t('New')} <b class="num" style="color:var(--text-2)">${st.fresh}</b></span></div>
    </a>`; })}</div>`
  : html`<div class="card">${emptyState('cards', t('No decks yet'), t('Make a deck for vocabulary, formulas or dates. You can paste a whole list — one “term - definition” per line.'), html`<div class="row"><button class="btn primary" data-act="new-deck">${icon('plus', 16)}${t('New deck')}</button><button class="btn" data-act="import-cards">${t('Paste a list')}</button></div>`)}</div>`}`;
}

function deckPage(deck) {
  const all = deckCards(deck.id), st = deckStats(all), n = dueCount(deck.id);
  const q = ui.cards.q.trim().toLowerCase();
  const list = q ? all.filter(c => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)) : all;
  return html`
  <div class="page-head">
    <div><a class="btn sm ghost" href="#/cards" style="margin-left:-10px">${icon('left', 14)}${t('All decks')}</a>
      <h1 class="h1" style="margin-top:4px">${deck.name}</h1><div class="sub row wrap" style="gap:8px">${subjChip(deck.subjectId)}<span>${nt(st.total, 'card', 'cards')}</span>${n ? html`<span>· ${n} ${t('to review')}</span>` : ''}</div></div>
    <div class="row wrap">
      <button class="btn icon" data-act="deck-menu" data-id="${deck.id}">${icon('more', 16)}</button>
      <button class="btn" data-act="import-cards" data-deck="${deck.id}">${icon('upload', 16)}<span class="hide-m">${t('Paste a list')}</span></button>
      <button class="btn" data-act="new-card" data-deck="${deck.id}">${icon('plus', 16)}${t('Add card')}</button>
      <button class="btn primary" data-act="study" data-deck="${deck.id}" ${n ? '' : raw('disabled')}>${icon('play', 14)}${n ? t('Study {n}', { n }) : t('Nothing due')}</button>
    </div>
  </div>
  <section class="card pad" style="margin-bottom:16px">${masteryBar(st)}
    <div class="statline" style="margin-top:14px"><div><b class="num">${st.mature}</b><span>${t('Mature')}</span></div><div><b class="num">${st.young}</b><span>${t('Young')}</span></div><div><b class="num">${st.learning}</b><span>${t('Learning')}</span></div><div><b class="num">${st.fresh}</b><span>${t('New')}</span></div></div>
    ${st.total && !n && st.fresh ? html`<div class="row small muted" style="margin-top:12px"><span class="grow">${t('Today’s new-card allowance is used up. Want more?')}</span><button class="btn sm soft" data-act="study-ahead" data-deck="${deck.id}">${t('Study 10 more new cards')}</button></div>` : ''}
  </section>
  ${all.length ? html`
  <div class="quick" style="height:42px;margin-bottom:12px">${icon('search', 16)}<input value="${ui.cards.q}" placeholder="${t('Search cards…')}" data-input="cards-q" data-keep></div>
  <div class="card cardtable">${list.map(c => html`<button class="cardrow" data-key="c-${c.id}" data-act="edit-card" data-id="${c.id}"><span class="trunc">${c.front}</span><span class="trunc muted">${c.back}</span>${cardStatus(c)}</button>`)}
    ${list.length ? '' : html`<div class="empty" style="padding:26px"><p>${t('No cards match.')}</p></div>`}</div>`
  : html`<div class="card">${emptyState('cards', t('This deck is empty'), t('Add cards one by one, or paste a list to create many at once.'), html`<div class="row"><button class="btn primary" data-act="new-card" data-deck="${deck.id}">${icon('plus', 16)}${t('Add card')}</button><button class="btn" data-act="import-cards" data-deck="${deck.id}">${t('Paste a list')}</button></div>`)}</div>`}`;
}

function studyOverlay() {
  const st = ui.study;
  const deck = byId(state.decks, st.deckId);
  const card = byId(state.cards, st.queue[0]);
  const total = st.done + st.queue.length;
  if (st.finished || !card) {
    const mins = Math.max(1, Math.round((Date.now() - st.t0) / MIN));
    return html`<div class="study">
      <div class="study-done">
        ${ring(1, 120, 10, 'url(#orbitGrad)', html`<span style="color:var(--accent)">${icon('check', 44)}</span>`)}
        <h2 class="h1">${t('Session complete')}</h2>
        <p class="muted">${t('{n} reviewed in {m} min.', { n: nt(st.done, 'card', 'cards'), m: mins })} ${st.again ? t('{n} needed another look — they will come back sooner.', { n: st.again }) : t('Not a single miss.')}</p>
        <button class="btn primary lg" data-act="study-exit">${t('Done')}</button>
      </div></div>`;
  }
  const sub = subjectOf((byId(state.decks, card.deckId) || {}).subjectId);
  const grades = [[0, 'Again', 'again'], [1, 'Hard', 'hard'], [2, 'Good', 'good'], [3, 'Easy', 'easy']];
  return html`<div class="study">
    <div class="study-top">
      <button class="btn ghost icon" data-act="study-exit" aria-label="${t('Close')}">${icon('x', 18)}</button>
      <div class="bar grow"><i style="width:${total ? Math.round(st.done / total * 100) : 0}%"></i></div>
      <span class="small num muted">${st.done}/${total}</span>
    </div>
    <div class="study-stage">
      <div class="tiny faint" style="text-align:center">${deck ? deck.name : (byId(state.decks, card.deckId) || {}).name || ''}${card.state === 'new' ? html` · <span style="color:var(--accent)">${t('new card')}</span>` : ''}</div>
      <div class="fc ${st.flipped ? 'flipped' : ''}" data-key="fc-${card.id}-${st.n}" data-act="study-flip" style="--c:${sub ? sub.color : 'var(--accent)'}">
        <div class="fc-inner">
          <div class="fc-face fc-front"><div class="fc-text">${card.front}</div><div class="fc-hint">${t('Tap or press Space to reveal')}</div></div>
          <div class="fc-face fc-back"><div class="fc-q">${card.front}</div><div class="fc-text">${card.back}</div></div>
        </div>
      </div>
      ${st.flipped ? html`<div class="grade-row" data-key="grade-row">${grades.map(([g, l, cls]) => html`<button class="gradebtn ${cls}" data-act="study-grade" data-g="${g}"><b>${t(l)}</b><span class="num">${srsLabel(card, g)}</span><kbd class="hide-m">${g + 1}</kbd></button>`)}</div>`
        : html`<div class="grade-row" data-key="show-row"><button class="btn primary lg" style="grid-column:1/-1" data-act="study-flip">${t('Show answer')}</button></div>`}
    </div>
  </div>`;
}

VIEWS.cards = {
  title: 'Flashcards', icon: 'cards',
  render(arg) {
    const deck = arg && byId(state.decks, arg);
    return html`${deck ? deckPage(deck) : decksHome()}${ui.study ? studyOverlay() : ''}`;
  },
};

function startStudy(deckId, extraNew = 0) {
  let q = studyQueue(deckId);
  if (extraNew) {
    const pool = (deckId ? deckCards(deckId) : state.cards).filter(c => c.state === 'new' && !q.includes(c.id)).slice(0, extraNew).map(c => c.id);
    q = [...q, ...pool];
  }
  if (!q.length) { toast(t('Nothing due right now.')); return; }
  ui.study = { deckId, queue: q, flipped: false, done: 0, again: 0, n: 0, t0: Date.now(), finished: false };
  if (route.view !== 'cards') go('cards' + (deckId ? '/' + deckId : '')); else requestRender();
}
function studyAnswer(grade) {
  const st = ui.study; if (!st || !st.flipped) return;
  const id = st.queue[0], card = byId(state.cards, id); if (!card) return;
  const wasNew = card.state === 'new', next = srsOutcome(card, grade), day = todayStr();
  commit(s => {
    Object.assign(byId(s.cards, id), next);
    s.reviewLog[day] = (s.reviewLog[day] || 0) + 1;
    if (wasNew) s.newLog[day] = (s.newLog[day] || 0) + 1;
  }, { noUndo: true });
  st.queue.shift();
  if (next.state === 'learn') { st.queue.splice(Math.min(st.queue.length, grade === 0 ? 3 : 7), 0, id); if (grade === 0) st.again++; }
  else st.done++;
  st.flipped = false; st.n++;
  if (!st.queue.length) { st.finished = true; Sound.chime(); }
  requestRender();
}
function studyKey(e) {
  const st = ui.study; if (!st) return false;
  if (st.finished) { if (e.key === 'Enter' || e.key === ' ') { ACT['study-exit'](); return true; } return false; }
  if (e.key === ' ' || e.key === 'Enter') { if (!st.flipped) setUI(u => { u.study.flipped = true; }); else studyAnswer(2); return true; }
  if (st.flipped && /^[1-4]$/.test(e.key)) { studyAnswer(+e.key - 1); return true; }
  return false;
}
ACT.study = el => startStudy(el.dataset.deck || '');
ACT['study-ahead'] = el => startStudy(el.dataset.deck || '', 10);
ACT['study-flip'] = () => setUI(u => { if (u.study) u.study.flipped = !u.study.flipped; });
ACT['study-grade'] = el => studyAnswer(+el.dataset.g);
ACT['study-exit'] = () => setUI(u => { u.study = null; });
ON.input['cards-q'] = el => setUI(u => { u.cards.q = el.value; });

/* ── decks & cards CRUD ── */
function ensureDeck(s, subjectId = '') {
  if (s.decks.length) return s.decks[0].id;
  const d = { id: uid(), name: t('General'), subjectId };
  s.decks.push(d); return d.id;
}
function openDeckModal(deck) {
  const d = deck || { name: '', subjectId: '' };
  openModal({
    title: deck ? t('Edit deck') : t('New deck'), cls: 'narrow',
    body: html`<label class="field"><span>${t('Name')}</span><input class="input" name="name" value="${d.name}" required placeholder="${t('e.g. English irregular verbs')}" autofocus></label>
      <label class="field"><span>${t('Subject')}</span><select class="select" name="subjectId">${subjectOptions(d.subjectId)}</select></label>`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${deck ? t('Save') : t('Create deck')}</button>`,
    onSubmit: f => {
      if (!f.name.trim()) return false;
      if (deck) commit(s => { Object.assign(byId(s.decks, deck.id), { name: f.name.trim(), subjectId: f.subjectId }); });
      else { const nd = { id: uid(), name: f.name.trim(), subjectId: f.subjectId }; commit(s => { s.decks.push(nd); }); go('cards/' + nd.id); }
    },
  });
}
function openCardModal(card, deckId) {
  const c = card || { front: '', back: '', deckId: deckId || (route.view === 'cards' && route.arg) || (state.decks[0] || {}).id || '' };
  openModal({
    title: card ? t('Edit card') : t('New flashcard'),
    body: html`
      <label class="field"><span>${t('Deck')}</span><select class="select" name="deckId">${state.decks.length ? state.decks.map(d => html`<option value="${d.id}" ${d.id === c.deckId ? raw('selected') : ''}>${d.name}</option>`) : html`<option value="">${t('General')}</option>`}</select></label>
      <label class="field"><span>${t('Front — the question')}</span><textarea class="input" name="front" rows="2" required autofocus>${c.front}</textarea></label>
      <label class="field"><span>${t('Back — the answer')}</span><textarea class="input" name="back" rows="3" required>${c.back}</textarea></label>`,
    foot: html`${card ? html`<button type="button" class="btn danger left" data-del>${icon('trash', 15)}${t('Delete')}</button>` : html`<span class="left hint hide-m">${t('Tip: paste a whole list instead')}</span>`}<button type="button" class="btn ghost" data-close>${t('Cancel')}</button>${card ? '' : html`<button class="btn" name="more" value="1">${t('Save & add another')}</button>`}<button class="btn primary">${t('Save')}</button>`,
    onMount: (scrim, entry) => {
      const del = scrim.querySelector('[data-del]');
      if (del) del.onclick = () => { commit(s => { s.cards = s.cards.filter(x => x.id !== card.id); }); closeModal(entry); toastUndo(t('Card deleted')); };
      scrim.querySelectorAll('textarea').forEach(ta => ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); scrim.querySelector('form').requestSubmit(); } }));
    },
    onSubmit: (f, form, submitter) => {
      if (!f.front.trim() || !f.back.trim()) return false;
      if (card) { commit(s => { Object.assign(byId(s.cards, card.id), { front: f.front.trim(), back: f.back.trim(), deckId: f.deckId || card.deckId }); }); return; }
      commit(s => { s.cards.push(newCard({ deckId: f.deckId || ensureDeck(s), front: f.front.trim(), back: f.back.trim() })); });
      if (submitter && submitter.name === 'more') { form.front.value = ''; form.back.value = ''; form.front.focus(); toast(t('Card added')); return false; }
      toast(t('Card added'));
    },
  });
}
function openImportCards(deckId) {
  openModal({
    title: t('Paste a list of cards'), cls: 'wide',
    body: html`
      <p class="muted small">${t('One card per line. Separate question and answer with a tab, “ - ”, “;”, “=” or “::”. Copying two columns from a spreadsheet works too.')}</p>
      <textarea class="input" name="text" rows="9" style="font-family:var(--mono);font-size:13px" placeholder="photosynthesis - how plants turn light into chemical energy&#10;mitochondria - the powerhouse of the cell&#10;H2O = water" autofocus></textarea>
      <div class="form-grid">
        <label class="field"><span>${t('Add to deck')}</span><select class="select" name="deckId">${state.decks.map(d => html`<option value="${d.id}" ${d.id === deckId ? raw('selected') : ''}>${d.name}</option>`)}<option value="__new">${t('+ New deck…')}</option></select></label>
        <label class="field"><span>${t('New deck name')}</span><input class="input" name="newName" placeholder="${t('Only if creating a new deck')}"></label>
      </div>
      <div class="chip accent" id="imp-count" style="align-self:flex-start">${t('0 cards detected')}</div>`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Import cards')}</button>`,
    onMount: scrim => {
      const ta = scrim.querySelector('textarea'), out = scrim.querySelector('#imp-count');
      ta.addEventListener('input', () => { const n = parseCardLines(ta.value).length; out.textContent = t('{n} detected', { n: nt(n, 'card', 'cards') }); });
    },
    onSubmit: f => {
      const rows = parseCardLines(f.text);
      if (!rows.length) { toast(t('No cards found — check the separator.'), { kind: 'danger' }); return false; }
      let target = f.deckId;
      commit(s => {
        if (!target || target === '__new') { const nd = { id: uid(), name: f.newName.trim() || t('Imported deck'), subjectId: '' }; s.decks.push(nd); target = nd.id; }
        for (const r of rows) s.cards.push(newCard({ deckId: target, front: r.front, back: r.back }));
      });
      toastUndo(t('{n} imported', { n: nt(rows.length, 'card', 'cards') }));
      go('cards/' + target);
    },
  });
}
ACT['new-deck'] = () => openDeckModal();
ACT['new-card'] = el => openCardModal(null, el.dataset.deck);
ACT['edit-card'] = el => { const c = byId(state.cards, el.dataset.id); if (c) openCardModal(c); };
ACT['import-cards'] = el => openImportCards(el.dataset.deck || '');
ACT['deck-menu'] = el => {
  const deck = byId(state.decks, el.dataset.id); if (!deck) return;
  openMenu(el, [
    { icon: 'edit', label: t('Rename / change subject'), fn: () => openDeckModal(deck) },
    { icon: 'reset', label: t('Reset progress'), fn: () => { commit(s => { s.cards.forEach(c => { if (c.deckId === deck.id) Object.assign(c, { state: 'new', step: 0, ivl: 0, ease: 2.5, reps: 0, lapses: 0, due: Date.now() }); }); }); toastUndo(t('Deck progress reset')); } },
    '-',
    { icon: 'trash', label: t('Delete deck'), danger: true, fn: () => { commit(s => { s.decks = s.decks.filter(d => d.id !== deck.id); s.cards = s.cards.filter(c => c.deckId !== deck.id); }); go('cards'); toastUndo(t('Deck deleted')); } },
  ]);
};

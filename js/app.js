'use strict';
/* ───────────── app shell, router, command palette, shortcuts ───────────── */

const NAV = [
  ['today', 'Today', 'sun'], ['tasks', 'Tasks', 'tasks'], ['calendar', 'Calendar', 'calendar'], ['diary', 'Diary', 'diary'], ['focus', 'Focus', 'timer'],
  'Learn',
  ['cards', 'Flashcards', 'cards'], ['exams', 'Exams', 'exam'], ['grades', 'Grades', 'star'], ['subjects', 'Subjects', 'book'], ['notes', 'Notes', 'note'],
  'Reflect',
  ['insights', 'Insights', 'chart'],
];
const NAV_VIEWS = NAV.filter(n => Array.isArray(n));
const MOBILE_TABS = ['today', 'diary', 'tasks', 'grades'];      // what a school day needs within one thumb's reach

const LOGO = raw(`<svg class="logo-mark" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="lg" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse"><stop stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)"/></linearGradient></defs><rect width="32" height="32" rx="10" fill="url(#lg)"/><circle cx="16" cy="16" r="8.2" stroke="#fff" stroke-opacity=".5" stroke-width="2"/><path d="M16 7.8a8.2 8.2 0 0 1 8.2 8.2" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="24.2" cy="16" r="2.6" fill="#fff"/><circle cx="16" cy="16" r="2.4" fill="#fff"/></svg>`);
const DEFS = raw('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="orbitGrad" x1="0" y1="0" x2="1" y2="1"><stop stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)"/></linearGradient></defs></svg>');

function navCount(view) {
  if (view === 'tasks') {
    const today = todayStr();
    const over = openTasks().filter(x => x.due && x.due < today).length;
    const due = openTasks().filter(x => x.due === today || x.planned === today).length;
    return over ? html`<span class="count hot">${over + due}</span>` : due ? html`<span class="count">${due}</span>` : '';
  }
  if (view === 'cards') { const n = dueCount(); return n ? html`<span class="count">${n}</span>` : ''; }
  if (view === 'exams') { const e = upcomingExams()[0]; if (e) { const d = diffDays(e.date, todayStr()); if (d <= 7) return html`<span class="count">${d}${t('d')}</span>`; } }
  return '';
}

function shellHTML(v) {
  const tm = state.timer, p = state.profile;
  const initial = (p.name || 'S').trim().charAt(0).toUpperCase();
  return html`
  ${DEFS}
  <div class="shell" id="shell">
    <aside class="side" id="side">
      <a class="logo" href="#/today">${LOGO}<div class="logo-name">Studyspace<small>Orbit</small></div></a>
      <nav class="nav">
        ${NAV.map(n => typeof n === 'string' ? html`<div class="nav-label">${t(n)}</div>` : html`
          <a class="nav-item ${route.view === n[0] ? 'active' : ''}" href="#/${n[0]}" title="${t(n[1])}">${icon(n[2], 19)}<span>${t(n[1])}</span>${navCount(n[0])}</a>`)}
      </nav>
      <div class="side-foot">
        ${Timer.active() ? html`<button class="side-timer" data-act="go" data-to="focus" id="side-timer">
          <i class="pulse ${tm.status === 'paused' ? 'paused' : ''}"></i>
          <div class="grow"><b data-clock>${Timer.clock()}</b><span>${tm.mode === 'focus' ? ((byId(state.tasks, tm.taskId) || {}).title || t('Focusing')) : t('On a break')}</span></div>
        </button>` : ''}
        <a class="nav-item ${route.view === 'settings' ? 'active' : ''}" href="#/settings" title="${t('Settings')}">${icon('settings', 19)}<span>${t('Settings')}</span></a>
        <button class="me" data-act="go" data-to="settings">
          <span class="avatar">${initial}</span>
          <span class="me-text"><div class="me-name trunc">${p.name || t('Student')}</div><div class="me-sub trunc">${[p.school, p.grade ? t('Grade {g}', { g: p.grade }) : ''].filter(Boolean).join(' · ') || t('Your space')}</div></span>
        </button>
      </div>
    </aside>
    <div class="main">
      <header class="topbar" id="topbar">
        <div class="topbar-title">${t(v.title)}</div>
        <div class="grow"></div>
        ${Timer.active() ? html`<button class="btn sm soft only-m" data-act="go" data-to="focus">${icon('timer', 14)}<span data-clock class="num">${Timer.clock()}</span></button>` : ''}
        <button class="searchbtn" data-act="palette">${icon('search', 16)}<span>${t('Search or jump to…')}</span><kbd>${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</kbd></button>
        <button class="btn icon ghost" data-act="toggle-theme" title="${t('Toggle theme')}">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 17)}</button>
        <button class="btn primary" data-act="new-menu">${icon('plus', 16)}<span class="hide-m">${t('New|button')}</span></button>
      </header>
      <main class="view" data-key="view-${route.view}">${v.render(route.arg)}</main>
    </div>
    ${ui.taskOpen && byId(state.tasks, ui.taskOpen) ? taskDrawer(byId(state.tasks, ui.taskOpen)) : ''}
    ${ui.classSheet && !ui.taskOpen ? classSheet() : ''}
    <nav class="tabbar">
      ${MOBILE_TABS.map(name => { const n = NAV_VIEWS.find(x => x[0] === name); return html`<a class="tab ${route.view === name ? 'active' : ''}" href="#/${name}">${icon(n[2], 22)}<span>${t(n[1])}</span></a>`; })}
      <button class="tab ${MOBILE_TABS.includes(route.view) ? '' : 'active'}" data-act="more-menu">${icon('menu', 22)}<span>${t('More')}</span></button>
    </nav>
  </div>`;
}

/* ── render loop ── */
let _raf = 0, _lastDay = todayStr();
/* Coalesce in a microtask (not requestAnimationFrame): the DOM is always current before the next paint,
   and rendering never stalls when the browser throttles animation frames for a background window. */
function requestRender() { if (!_raf) { _raf = 1; queueMicrotask(render); } }
function render() {
  _raf = 0;
  if (ui.dragging) return;
  if (!state.profile.onboarded) { renderOnboarding(); return; }
  const v = VIEWS[route.view] || VIEWS.today;
  morph($('#app'), shellHTML(v));
  Timer.paint();
  const dt = $('.drawer-title');                              // browsers without field-sizing: grow the title to fit
  if (dt && !(window.CSS && CSS.supports('field-sizing', 'content'))) { dt.style.height = 'auto'; dt.style.height = dt.scrollHeight + 'px'; }
  if (v.after) v.after();
}
_renderHook = requestRender;

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [view, ...rest] = h.split('/');
  const next = { view: VIEWS[view] ? view : 'today', arg: decodeURIComponent(rest.join('/')) };
  const changed = next.view !== route.view;
  route = next;
  closeMenu();
  if (changed) { ui.taskOpen = ''; window.scrollTo(0, 0); }
  requestRender();
}
window.addEventListener('hashchange', parseRoute);
window.addEventListener('scroll', () => { const tb = $('#topbar'); if (tb) tb.classList.toggle('scrolled', scrollY > 6); }, { passive: true });

/* ── delegated events ── */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el, e);
});
for (const type of ['input', 'change', 'submit', 'keydown']) {
  document.addEventListener(type, e => {
    const el = e.target.closest && e.target.closest(`[data-${type}]`);
    if (!el) return;
    const fn = ON[type][el.getAttribute('data-' + type)];
    if (fn) fn(el, e);
  });
}

/* ── global actions ── */
ACT.go = el => go(el.dataset.to);
ACT['toggle-theme'] = () => {
  const cur = document.documentElement.dataset.theme;
  commit(s => { s.settings.theme = cur === 'dark' ? 'light' : 'dark'; }, { noUndo: true });
  applySettings(); requestRender();
};
ACT.palette = () => openPalette();
ACT['new-menu'] = el => openMenu(el, newItems());
ACT['more-menu'] = el => openMenu(el, [
  ...NAV_VIEWS.filter(n => !MOBILE_TABS.includes(n[0])).map(n => ({ icon: n[2], label: t(n[1]), fn: () => go(n[0]) })),
  '-', { icon: 'settings', label: t('Settings'), fn: () => go('settings') },
]);
ACT.undo = () => { if (!undo()) toast(t('Nothing to undo')); };
ACT['quick-add'] = () => openQuickAdd();

function newItems() {
  return [
    { icon: 'tasks', label: t('Task'), fn: () => openQuickAdd() },
    { icon: 'chat', label: t('Homework from a chat'), fn: () => openChatPaste() },
    { icon: 'calendar', label: t('Study block'), fn: () => openEventModal() },
    { icon: 'exam', label: t('Exam'), fn: () => openExamModal() },
    { icon: 'star', label: t('Grade'), fn: () => openGradeModal() },
    { icon: 'cards', label: t('Flashcard'), fn: () => openCardModal() },
    { icon: 'note', label: t('Note'), fn: () => newNote() },
  ];
}

/* ── quick add (natural language) ── */
function openQuickAdd(prefill = '', defaults = {}) {
  openModal({
    title: t('New task'),
    body: html`
      <div class="quick">${icon('plus', 18)}<input name="q" autocomplete="off" value="${prefill}" placeholder="${t('e.g. Physics worksheet tomorrow 45m !!')}" autofocus></div>
      <div class="parsed" id="qa-parsed"></div>
      <div class="hint">${t('Just type it the way you would say it.')} <code>${t('tomorrow')}</code> <code>${t('fri')}</code> <code>15.11</code> <code>45m</code> <code>!!</code> <code>#${t('subject')}</code></div>`,
    foot: html`<span class="left hint"><kbd>Enter</kbd> ${t('to add')}</span><button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Add task')}</button>`,
    onMount: scrim => {
      const inp = scrim.querySelector('input[name=q]');
      const upd = () => { $('#qa-parsed').innerHTML = inp.value.trim() ? parsedChips(parseQuick(inp.value)).map(String).join('') : ''; };
      inp.addEventListener('input', upd); upd();
    },
    onSubmit: d => {
      if (!d.q.trim()) return false;
      addQuickTask(d.q, defaults);
    },
  });
}
function addQuickTask(text, defaults = {}) {
  const p = parseQuick(text);
  if (!p.title) return null;
  const task = newTask({ ...defaults, title: p.title, due: p.due || defaults.due || '', est: p.est || defaults.est || 0, priority: p.priority || defaults.priority || 0, subjectId: p.subjectId || defaults.subjectId || '', repeat: p.repeat });
  commit(s => { s.tasks.push(task); });
  toast(t('Task added'), { action: t('Open'), onAction: () => setUI(u => { u.taskOpen = task.id; }) });
  return task;
}

/* ── command palette ── */
function paletteItems(q) {
  const items = [];
  const push = (group, ic, label, run, hint = '') => items.push({ group, ic, label, run, hint });
  const ql = q.trim().toLowerCase();
  const match = s => !ql || String(s).toLowerCase().includes(ql);
  if (ql) {
    const p = parseQuick(q);
    push(t('Create'), 'plus', t('Add task “{title}”', { title: p.title || q }), () => addQuickTask(q), [p.due && relDay(p.due), p.est && fmtDur(p.est), subjName(p.subjectId)].filter(Boolean).join(' · '));
  }
  for (const n of [...NAV_VIEWS, ['settings', 'Settings', 'settings']]) if (match(t(n[1])) || match(n[1])) push(t('Go to'), n[2], t(n[1]), () => go(n[0]));
  const acts = [
    ['timer', 'Start a focus session', () => { go('focus'); Timer.start({ mode: 'focus' }); }],
    ['sparkles', 'Auto-plan my week', () => { go('calendar'); openAutoPlan(); }],
    ['exam', 'New exam', () => openExamModal()],
    ['star', 'Add a grade', () => openGradeModal()],
    ['list', 'Paste timetable', () => { go('settings/timetable'); openTimetablePaste(); }],
    ['chat', 'Paste homework from a chat', () => openChatPaste()],
    ['chat', 'Share tomorrow’s homework', () => shareHomework(nextSchoolDay() || addDays(todayStr(), 1))],
    ['layers', 'Enter report card marks', () => { go('grades'); openTermMarks(); }],
    ['cards', 'New flashcard', () => openCardModal()],
    ['note', 'New note', () => newNote()],
    ['calendar', 'New study block', () => openEventModal()],
    ['moon', 'Toggle light / dark theme', () => ACT['toggle-theme']()],
    ['download', 'Export backup', () => exportBackup()],
    ['folder', 'Save to a file automatically', () => go('settings/data')],
    ['swap', 'Sync between devices', () => go('settings/data')],
    ['sun', 'Holidays and days off', () => { go('settings/study'); setTimeout(() => { const el = $('#days-off'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 80); }],
    ['undo', 'Undo last change', () => ACT.undo()],
    ['keyboard', 'Keyboard shortcuts', () => openShortcuts()],
  ];
  for (const [ic, label, run] of acts) if (match(t(label)) || match(label)) push(t('Actions'), ic, t(label), run);
  if (ql) {
    openTasks().filter(x => match(x.title)).slice(0, 6).forEach(x => push(t('Tasks'), 'tasks', x.title, () => setUI(u => { u.taskOpen = x.id; }), [subjName(x.subjectId), x.due && relDay(x.due)].filter(Boolean).join(' · ')));
    state.subjects.filter(x => match(x.name)).slice(0, 4).forEach(x => push(t('Subjects'), x.icon || 'book', x.name, () => go('subjects/' + x.id)));
    state.exams.filter(x => match(x.title)).slice(0, 4).forEach(x => push(t('Exams'), 'exam', x.title, () => go('exams'), relDay(x.date)));
    state.notes.filter(x => match(x.title) || match(x.body)).slice(0, 5).forEach(x => push(t('Notes'), 'note', x.title || t('Untitled'), () => { ui.notes.open = x.id; go('notes'); }, subjName(x.subjectId)));
    state.projects.filter(x => match(x.title)).slice(0, 4).forEach(x => push(t('Projects'), 'folder', x.title, () => go('tasks/project/' + x.id)));
    state.cards.filter(x => match(x.front) || match(x.back)).slice(0, 5).forEach(x => push(t('Flashcards'), 'cards', x.front, () => go('cards/' + x.deckId), x.back.slice(0, 40)));
    state.tasks.filter(x => x.status === 'done' && match(x.title)).slice(0, 3).forEach(x => push(t('Completed'), 'check', x.title, () => setUI(u => { u.taskOpen = x.id; })));
  }
  return items;
}
function openPalette() {
  if ($('.palette')) return;
  let items = [], sel = 0;
  const entry = openModal({
    bare: true,
    body: html`<div class="palette" role="dialog" aria-label="${t('Command palette')}">
      <div class="palette-input">${icon('search', 19)}<input autofocus autocomplete="off" spellcheck="false" placeholder="${t('Search, jump, or just type a task…')}"><kbd>Esc</kbd></div>
      <div class="palette-list" id="pal-list"></div>
      <div class="palette-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> ${t('navigate')}</span><span><kbd>Enter</kbd> ${t('select')}</span><span class="hide-m">${t('Tip: type “essay fri 1h !!” to add a task instantly')}</span></div>
    </div>`,
    onMount: scrim => {
      const inp = scrim.querySelector('input'), list = scrim.querySelector('#pal-list');
      const draw = () => {
        let group = '';
        list.innerHTML = items.map((it, i) => {
          const head = it.group !== group ? `<div class="palette-group">${esc(it.group)}</div>` : '';
          group = it.group;
          return head + html`<button type="button" class="palette-item ${i === sel ? 'sel' : ''}" data-i="${i}">${icon(it.ic, 17)}<span class="trunc">${it.label}</span>${it.hint ? html`<small>${it.hint}</small>` : ''}</button>`;
        }).join('') || `<div class="empty" style="padding:28px"><p>${esc(t('No matches'))}</p></div>`;
        const s = list.querySelector('.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
      };
      const refresh = () => { items = paletteItems(inp.value); sel = 0; draw(); };
      const run = i => { const it = items[i]; if (!it) return; closeModal(entry); it.run(); };
      inp.addEventListener('input', refresh);
      inp.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, items.length); draw(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % Math.max(1, items.length); draw(); }
        else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
      });
      list.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) run(+b.dataset.i); });
      list.addEventListener('mousemove', e => { const b = e.target.closest('[data-i]'); if (b && +b.dataset.i !== sel) { sel = +b.dataset.i; $$('.palette-item', list).forEach((x, i) => x.classList.toggle('sel', i === sel)); } });
      refresh();
    },
  });
}

function openShortcuts() {
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  const rows = [[`${mod} K`, 'Search and command palette'], ['N', 'New task'], ['1 – 9', 'Jump between sections'], [`${mod} Z`, 'Undo last change'], ['Space', 'Start / pause the timer (Focus)'], ['Space · 1 2 3 4', 'Flip and grade a flashcard'], ['Esc', 'Close dialogs'], ['?', 'Show this list']];
  openModal({
    title: t('Keyboard shortcuts'), cls: 'narrow',
    body: html`<div class="col" style="gap:4px">${rows.map(([k, l]) => html`<div class="spread" style="padding:7px 0;border-bottom:1px solid var(--line)"><span>${t(l)}</span><kbd>${k}</kbd></div>`)}</div>`,
  });
}

/* ── keyboard ── */
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); if ($('.palette')) closeModal(); else openPalette(); return; }
  if (e.key === 'Escape') {
    if (_menuEl) { closeMenu(); return; }
    if (modalStack.length) { closeModal(); return; }
    if (ui.zen) { setUI(u => { u.zen = false; }); return; }
    if (ui.study) { ACT['study-exit'](); return; }
    if (ui.taskOpen) { setUI(u => { u.taskOpen = ''; }); return; }
    if (ui.classSheet) { setUI(u => { u.classSheet = null; }); return; }
    return;
  }
  if (!state.profile.onboarded) return;
  if (mod && e.key.toLowerCase() === 'z' && !typing && !e.shiftKey) { e.preventDefault(); if (undo()) toast(t('Undone')); return; }
  if (typing || mod || e.altKey || modalStack.length) return;
  if (ui.study) { if (studyKey(e)) e.preventDefault(); return; }
  if (e.key === '/') { e.preventDefault(); openPalette(); return; }
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openQuickAdd(); return; }
  if (e.key === '?') { openShortcuts(); return; }
  if (e.key === ' ' && route.view === 'focus') { e.preventDefault(); Timer.toggle(); return; }
  if (/^[1-9]$/.test(e.key) && NAV_VIEWS[+e.key - 1]) { go(NAV_VIEWS[+e.key - 1][0]); return; }
  if (e.key === '0') go('insights');
});

/* ── the evening reminder: what is still open for the next school day, once a day at the chosen time ── */
function reminderDue(now = new Date()) {
  const at = state.settings.remindAt, today = ymd(now);
  if (!at || !isTime(at) || state.meta.lastRemind === today) return null;
  if (now.getHours() * 60 + now.getMinutes() < toMin(at)) return null;
  const day = nextSchoolDay(today); if (!day) return null;
  return { day, open: sortTasks(state.tasks.filter(x => x.due === day && isOpen(x))) };
}
function checkReminder() {
  const r = reminderDue(); if (!r) return;
  commit(s => { s.meta.lastRemind = todayStr(); }, { noUndo: true });
  if (!r.open.length) return;                                                   // all done: no need to say anything
  const title = t('{n} for {d}', { n: nt(r.open.length, 'homework left', 'homework left'), d: relDay(r.day).toLowerCase() });
  const body = r.open.slice(0, 4).map(x => (subjName(x.subjectId) ? subjName(x.subjectId) + ': ' : '') + x.title).join('\n');
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { const n = new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'studyspace-evening' }); n.onclick = () => { window.focus(); go('today'); n.close(); }; } catch (e) { /* not allowed here */ }
  } else toast(title, { action: t('Show'), onAction: () => go('today'), ms: 9000 });
}

/* ── boot ── */
function boot() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';   // each screen opens at its own start (the Diary jumps to today)
  if (SANDBOX && /[?&]fresh\b/.test(location.search)) { localStorage.removeItem(STORE_KEY); localStorage.removeItem(BACKUP_KEY); }
  loadState();
  /* index.html?demo opens straight into the sample workspace (nothing is saved until you change something) */
  if (!state.profile.onboarded && /[?&]demo\b/.test(location.search)) {
    const th = location.search.match(/[?&]theme=(light|dark)/);
    if (th) state.settings.theme = th[1];
    applySettings();
    state = normalizeState(demoState({ name: 'Sam' }, { theme: state.settings.theme }));
    applySettings();
  }
  parseRoute();
  Timer.recover();
  render();
  FileBackup.init();
  Sync.init();
  /* coming back to the app: the linked backup file may have been changed on another computer meanwhile */
  document.addEventListener('visibilitychange', () => { if (!document.hidden && FileBackup.status === 'on') FileBackup.checkNewer(); });
  /* shared to Studyspace from another app (Android share sheet → manifest share_target): straight into the chat reader */
  const sp = new URLSearchParams(location.search), shared = [sp.get('share-title'), sp.get('share-text'), sp.get('share-url')].filter(Boolean).join('\n');
  if (shared) {
    ['share-title', 'share-text', 'share-url'].forEach(k => sp.delete(k));                 // only the shared text leaves the address
    history.replaceState(null, '', location.pathname + (sp.toString() ? '?' + sp.toString().replace(/=(?=&|$)/g, '') : '') + location.hash);
    if (state.profile.onboarded) setTimeout(() => openChatPaste(shared), 60);
  }
  setInterval(checkReminder, 30000); setTimeout(checkReminder, 3000);
  setInterval(() => {
    if (document.hidden) return;
    const day = todayStr();
    if (day !== _lastDay) { _lastDay = day; requestRender(); return; }
    if (['today', 'calendar'].includes(route.view) && !modalStack.length && !ui.taskOpen) requestRender();
  }, 30000);
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { applySettings(); requestRender(); });
  /* paper is white: print in the light theme whatever is on screen, then put the chosen theme back */
  addEventListener('beforeprint', () => { document.documentElement.dataset.theme = 'light'; });
  addEventListener('afterprint', () => applySettings());
  /* ask the browser not to clear this site's storage when the disk fills up (granted silently for installed / often-used sites) */
  if (!SANDBOX && navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});
  if (!SANDBOX && 'serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  /* index.html?sandbox&selftest runs the in-browser test suite (tests/selftest.js) against the real app */
  if (SANDBOX && /[?&]selftest\b/.test(location.search)) { const sc = document.createElement('script'); sc.src = 'tests/selftest.js'; document.body.appendChild(sc); }
}
boot();

'use strict';
/* ───────────── Calendar: week time-grid, drag to plan, auto-planner ───────────── */

const HOUR_H = 54, SNAP = 15;
const calSpan = () => (innerWidth < 640 ? 1 : innerWidth < 1000 ? 3 : 7);
const calStartHour = () => clamp(state.settings.dayStart, 0, 12);
const calEndHour = () => clamp(state.settings.dayEnd, 16, 24);
const snapMin = m => Math.round(m / SNAP) * SNAP;

function layoutDay(items) {
  const evs = items.map(i => ({ ...i, s: toMin(i.start), e: Math.max(toMin(i.end), toMin(i.start) + 20) })).sort((a, b) => a.s - b.s || b.e - a.e);
  const out = []; let cluster = [], clusterEnd = -1;
  const flush = () => {
    const cols = [];
    for (const ev of cluster) { let c = cols.findIndex(end => end <= ev.s); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = ev.e; ev.col = c; }
    for (const ev of cluster) { ev.cols = cols.length; out.push(ev); }
    cluster = []; clusterEnd = -1;
  };
  for (const ev of evs) { if (cluster.length && ev.s >= clusterEnd) flush(); cluster.push(ev); clusterEnd = Math.max(clusterEnd, ev.e); }
  flush();
  return out;
}

function calColumn(date) {
  const h0 = calStartHour() * 60, h1 = calEndHour() * 60;
  const px = m => ((clamp(m, h0, h1) - h0) / 60 * HOUR_H).toFixed(1);
  const isToday = date === todayStr(), now = nowMin();
  const items = layoutDay(agendaOn(date).filter(a => toMin(a.end) > h0 && toMin(a.start) < h1));
  return html`<div class="cal-col ${isToday ? 'today' : ''}" data-date="${date}" data-act="cal-tap">
    ${items.map(a => {
      const top = px(a.s), height = Math.max(18, px(a.e) - top - 2);
      const past = date < todayStr() || (isToday && a.e <= now);
      return html`<div class="cal-ev ${a.kind} ${a.done ? 'done' : ''} ${past ? 'past' : ''} ${height < 34 ? 'tiny-ev' : ''}" data-key="ev-${a.id}" data-id="${a.id}" data-kind="${a.kind}" data-act="${a.kind === 'event' ? 'edit-event' : 'edit-lesson'}"
        style="top:${top}px;height:${height}px;left:calc(${(a.col / a.cols * 100).toFixed(2)}% + 2px);width:calc(${(100 / a.cols).toFixed(2)}% - 4px);--c:${a.subjectId ? subjColor(a.subjectId) : 'var(--accent)'}">
        <b>${a.title}</b><span class="num">${a.start}–${a.end}${a.room ? ` · ${a.room}` : ''}</span>
        ${a.kind === 'event' ? html`<i class="cal-resize"></i>` : ''}
      </div>`; })}
    ${isToday && now > h0 && now < h1 ? html`<div class="cal-now" style="top:${px(now)}px"></div>` : ''}
  </div>`;
}

function calAllDay(date) {
  const exams = state.exams.filter(e => e.date === date);
  const due = state.tasks.filter(x => x.due === date), off = dayOff(date);
  if (!exams.length && !due.length && !off) return html`<div class="cal-all"></div>`;
  return html`<div class="cal-all">
    ${off ? html`<span class="cal-pill off" title="${off.name || t('No school')}">${icon('sun', 12)}<span class="trunc">${off.name || t('No school')}</span></span>` : ''}
    ${exams.map(e => html`<a class="cal-pill exam" href="#/exams" style="--c:${subjColor(e.subjectId)}">${icon('exam', 12)}<span class="trunc">${e.title}</span></a>`)}
    ${due.slice(0, 3).map(x => html`<button class="cal-pill ${x.status === 'done' ? 'done' : ''}" data-act="open-task" data-id="${x.id}" style="--c:${subjColor(x.subjectId)}"><i class="dot"></i><span class="trunc">${x.title}</span></button>`)}
    ${due.length > 3 ? html`<span class="tiny faint" style="padding-left:4px">+${due.length - 3}</span>` : ''}
  </div>`;
}

VIEWS.calendar = {
  title: 'Calendar', icon: 'calendar',
  render() {
    const span = calSpan(), today = todayStr();
    const anchor = ui.cal.anchor || today;
    const start = span === 7 ? weekStart(anchor) : anchor;
    const days = Array.from({ length: span }, (_, i) => addDays(start, i));
    const h0 = calStartHour(), h1 = calEndHour();
    const hours = Array.from({ length: h1 - h0 }, (_, i) => h0 + i);
    const ws = weekStart(anchor), week = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const planned = sum(week, d => sum(eventsOn(d), e => toMin(e.end) - toMin(e.start)));
    const title = span === 1 ? fmtDate(anchor, 'long') : `${fmtDate(days[0], 'short')} – ${fmtDate(days[span - 1], pd(days[0]).getFullYear() === new Date().getFullYear() ? 'short' : 'full')}`;
    const unscheduled = openTasks().filter(x => x.est && !state.events.some(e => e.taskId === x.id && e.date >= today)).length;
    return html`
    <div class="page-head">
      <div><h1 class="h1">${t('Calendar')}</h1><div class="sub">${t('{n} of study planned this week', { n: fmtDur(planned) })}${unscheduled ? html` · ${nt(unscheduled, 'task not scheduled yet', 'tasks not scheduled yet')}` : ''}</div></div>
      <div class="row wrap">
        <button class="btn icon hide-m" data-act="export-ics" title="${t('Export .ics')}">${icon('download', 16)}</button>
        <button class="btn" data-act="go" data-to="settings/timetable">${icon('book', 16)}<span class="hide-m">${t('Timetable')}</span></button>
        <button class="btn" data-act="new-event">${icon('plus', 16)}${t('Study block')}</button>
        <button class="btn primary" data-act="auto-plan">${icon('sparkles', 16)}${t('Auto-plan')}</button>
      </div>
    </div>
    <div class="row" style="margin-bottom:14px">
      <button class="btn icon" data-act="cal-nav" data-d="-1" aria-label="${t('Previous')}">${icon('left', 16)}</button>
      <button class="btn icon" data-act="cal-nav" data-d="1" aria-label="${t('Next')}">${icon('right', 16)}</button>
      <button class="btn" data-act="cal-nav" data-d="0">${t('Today')}</button>
      <div class="h2 grow trunc" style="margin-left:6px">${title}</div>
    </div>
    ${span < 7 ? html`<div class="weekstrip">${week.map(d => html`<button class="${days.includes(d) ? 'on' : ''} ${d === today ? 'today' : ''}" data-act="cal-day" data-date="${d}"><span>${wdName(dow(d), 'short')}</span><b>${pd(d).getDate()}</b>${agendaOn(d).length ? html`<i></i>` : ''}</button>`)}</div>` : ''}
    <div class="card cal" style="--cols:${span};--hour:${HOUR_H}px">
      <div class="cal-head">
        <div class="cal-gutter"></div>
        ${days.map(d => html`<div class="cal-dayhead ${d === today ? 'today' : ''}"><span>${wdName(dow(d), 'short')}</span><b class="num">${pd(d).getDate()}</b>${focusMinOn(d) ? html`<small class="num" title="${t('Focus logged')}">${fmtDur(focusMinOn(d))}</small>` : ''}</div>`)}
      </div>
      <div class="cal-head allday">
        <div class="cal-gutter tiny faint">${t('due')}</div>
        ${days.map(calAllDay)}
      </div>
      <div class="cal-body" id="cal-body" style="height:${hours.length * HOUR_H}px">
        <div class="cal-gutter">${hours.map(h => html`<div class="cal-hour num"><span>${pad(h)}:00</span></div>`)}</div>
        ${days.map(calColumn)}
      </div>
    </div>
    <div class="hint hide-m" style="margin-top:10px">${t('Drag on empty space to create a block · drag a block to move it · pull its bottom edge to resize')}</div>`;
  },
};

ACT['cal-nav'] = el => {
  const d = +el.dataset.d, span = calSpan();
  setUI(u => { u.cal.anchor = d === 0 ? '' : addDays(u.cal.anchor || todayStr(), d * span); });
};
ACT['cal-day'] = el => setUI(u => { u.cal.anchor = el.dataset.date; });
ACT['new-event'] = () => openEventModal();
ACT['auto-plan'] = () => openAutoPlan();
ACT['edit-event'] = el => { if (_calSuppress) return; const ev = byId(state.events, el.dataset.id); if (ev) openEventModal(ev); };
ACT['edit-lesson'] = el => {
  const l = byId(state.lessons, el.dataset.id); if (!l) return;
  const col = el.closest('[data-date]');
  if (el.closest('.cal-col') && col) { openClassSheet(l.id, col.dataset.date); return; }      // calendar → class sheet
  openLessonModal(l);                                                                         // timetable editor → edit
};

/* ── class sheet: one class on one day — its homework, and a place to write down the next one ── */
function openClassSheet(lessonId, date) {
  closeMenu(); setUI(u => { u.classSheet = { lessonId, date: date || todayStr() }; });
  if (innerWidth > 760) setTimeout(() => { const i = $('.classsheet form.quick input'); if (i) i.focus(); }, 60);
}
function classSheet() {
  const { lessonId, date } = ui.classSheet;
  const l = lessonAt(lessonId, date), s = l && subjectOf(l.subjectId);
  if (!l) return '';
  const changed = (state.changes[date] || {})[l.id] != null;
  const next = nextLessonDate(l.subjectId, date);
  const dueHere = sortTasks(state.tasks.filter(x => x.subjectId === l.subjectId && x.due === date));
  const dueNext = next ? sortTasks(state.tasks.filter(x => x.subjectId === l.subjectId && x.due === next)) : [];
  const grades = state.grades.filter(g => g.subjectId === l.subjectId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const tr = currentTerm(), avg = tr ? subjectAverage(l.subjectId, tr) : null;
  return html`<div class="scrim" data-act="close-class" data-key="class-sheet">
    <div class="modal classsheet" role="dialog" aria-modal="true" style="--c:${s ? s.color : 'var(--accent)'}">
      <div class="modal-head">
        <div class="row" style="gap:12px;min-width:0">${subjGlyph(l.subjectId)}<div style="min-width:0"><h2 class="h2 trunc">${s ? s.name : t('Class')}</h2><div class="small muted">${relDay(date)} · <span class="num">${l.start}–${l.end}</span>${l.room ? ` · ${t('Room {r}', { r: l.room })}` : ''}${s && s.teacher ? ` · ${s.teacher}` : ''}${l.was ? html` · <span class="swap-note">${t('instead of {name}', { name: subjName(l.was) })}</span>` : ''}</div></div></div>
        <button type="button" class="btn ghost icon sm" data-act="close-class-x" aria-label="${t('Close')}">${icon('x', 16)}</button>
      </div>
      <div class="modal-body">
        <div>
          <div class="eyebrow" style="margin-bottom:6px">${t('Homework for this class')}</div>
          ${dueHere.length ? html`<div class="tasklist">${dueHere.map(x => taskRow(x, { noSubject: true }))}</div>` : html`<div class="small muted">${t('Nothing was due for this class.')}</div>`}
        </div>
        <div>
          <div class="eyebrow" style="margin-bottom:6px">${next ? t('For the next class · {day}', { day: relDay(next) }) : t('New homework')}</div>
          ${dueNext.length ? html`<div class="tasklist" style="margin-bottom:8px">${dueNext.map(x => taskRow(x, { noSubject: true }))}</div>` : ''}
          <form class="quick" data-submit="class-hw" data-subject="${l.subjectId}" data-due="${next}">${icon('plus', 17)}<input name="q" autocomplete="off" placeholder="${t('What did the teacher set? e.g. “p. 54 ex. 3–7”')}" autofocus></form>
          ${next ? html`<div class="hint" style="margin-top:6px">${t('It will be due {day}, the next {subject} class. Add a date or “45m” to change it.', { day: fmtDate(next, 'long'), subject: s ? s.name : '' })}</div>` : ''}
        </div>
        ${grades.length ? html`<div><div class="spread" style="margin-bottom:6px"><div class="eyebrow">${t('Recent grades')}</div>${avg != null ? html`<span class="small muted">${t(tr.name)}: <b class="num" style="color:var(--text)">${fmtGrade(avg)}</b></span>` : ''}</div><div class="row wrap" style="gap:6px">${grades.map(g => gradeBadge(g.value, g.max))}</div></div>` : ''}
      </div>
      <div class="modal-foot">
        <button type="button" class="btn ghost left" data-act="class-change" data-id="${l.id}" data-date="${date}">${icon('swap', 15)}<span>${changed ? t('Changed') : t('This day')}</span></button>
        <button type="button" class="btn" data-act="class-grade" data-subject="${l.subjectId}" data-date="${date}">${icon('star', 15)}${t('Add grade')}</button>
        <button type="button" class="btn" data-act="go" data-to="subjects/${l.subjectId}">${icon('book', 15)}<span class="hide-m">${t('Subject')}</span></button>
      </div>
    </div>
  </div>`;
}
ACT['open-class'] = el => openClassSheet(el.dataset.id, el.dataset.date);
ACT['close-class'] = (el, e) => { if (e.target === el) setUI(u => { u.classSheet = null; }); };
ACT['close-class-x'] = () => setUI(u => { u.classSheet = null; });
/* a class that is different on one day only: cancelled, or another subject in its place */
ACT['class-change'] = el => {
  const id = el.dataset.id, date = el.dataset.date, base = byId(state.lessons, id); if (!base) return;
  const cur = (state.changes[date] || {})[id];
  const day = fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
  openMenu(el, [
    { icon: 'x', label: t('Cancelled on {d}', { d: day }), fn: () => { commit(s => setLessonChange(s, date, id, '')); ui.classSheet = null; requestRender(); toastUndo(t('{name} cancelled on {d}', { name: subjName(base.subjectId) || t('Class'), d: day })); } },
    { icon: 'swap', label: t('Another subject instead…'), fn: () => openReplaceClass(id, date) },
    ...(cur != null ? [{ icon: 'undo', label: t('Back to the usual class'), fn: () => { commit(s => setLessonChange(s, date, id, null)); toastUndo(t('Usual class restored')); } }] : []),
    '-',
    { icon: 'edit', label: t('Edit the weekly class…'), fn: () => { ui.classSheet = null; requestRender(); openLessonModal(base); } },
  ]);
};
function openReplaceClass(lessonId, date) {
  const base = byId(state.lessons, lessonId); if (!base) return;
  const others = state.subjects.filter(x => x.id !== base.subjectId);
  if (!others.length) { toast(t('Add another subject first.')); return; }
  openModal({
    title: t('Another subject instead'), cls: 'narrow',
    body: html`<p class="small muted" style="margin-top:-4px">${t('{d}, {a}–{b}: instead of {name}', { d: fmtDate(date, 'long'), a: base.start, b: base.end, name: subjName(base.subjectId) || t('Class') })}</p>
      <label class="field"><span>${t('Subject')}</span><select class="select" name="subjectId" autofocus>${others.map(x => html`<option value="${x.id}">${x.name}</option>`)}</select></label>`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Replace for this day')}</button>`,
    onSubmit: d => { if (!subjectOf(d.subjectId)) return false; commit(s => setLessonChange(s, date, lessonId, d.subjectId)); toastUndo(t('{name} on {d}', { name: subjName(d.subjectId), d: fmtDate(date, 'short') })); },
  });
}
ACT['class-edit'] = el => { const l = byId(state.lessons, el.dataset.id); ui.classSheet = null; requestRender(); if (l) openLessonModal(l); };
ACT['class-grade'] = el => { ui.classSheet = null; requestRender(); openGradeModal(null, { subjectId: el.dataset.subject, date: el.dataset.date <= todayStr() ? el.dataset.date : todayStr() }); };
ON.submit['class-hw'] = (form, e) => {
  e.preventDefault();
  const inp = form.querySelector('input'), p = parseQuick(inp.value);
  if (!p.title) return;
  commit(s => { s.tasks.push(newTask({ title: p.title, subjectId: form.dataset.subject, due: p.due || form.dataset.due || '', est: p.est, priority: p.priority, repeat: p.repeat })); });
  inp.value = '';
  toast(t('Homework added'));
};
let _calSuppress = false;
ACT['cal-tap'] = (el, e) => {
  if (_calSuppress || e.target !== el) return;
  const r = el.getBoundingClientRect();
  const start = clamp(snapMin(calStartHour() * 60 + (e.clientY - r.top) / HOUR_H * 60 - 10), 0, 23 * 60);
  openEventModal({ date: el.dataset.date, start: fromMin(start), end: fromMin(Math.min(1439, start + 45)) });
};

/* ── pointer interactions on the grid (mouse / pen) ── */
let calDrag = null;
function calYToMin(col, y) { const r = col.getBoundingClientRect(); return calStartHour() * 60 + (y - r.top) / HOUR_H * 60; }
document.addEventListener('pointerdown', e => {
  if (route.view !== 'calendar' || e.button !== 0 || e.pointerType === 'touch') return;
  const col = e.target.closest && e.target.closest('.cal-col'); if (!col) return;
  const evEl = e.target.closest('.cal-ev');
  if (evEl && evEl.dataset.kind === 'event') {
    const ev = byId(state.events, evEl.dataset.id); if (!ev) return;
    calDrag = { type: e.target.closest('.cal-resize') ? 'resize' : 'move', el: evEl, id: ev.id, x: e.clientX, y: e.clientY, s: toMin(ev.start), e: toMin(ev.end), date: ev.date, col, grab: calYToMin(col, e.clientY) - toMin(ev.start), moved: false };
  } else if (!evEl) {
    const m = snapMin(calYToMin(col, e.clientY));
    calDrag = { type: 'create', col, date: col.dataset.date, a: m, b: m, x: e.clientX, y: e.clientY, moved: false };
  }
});
document.addEventListener('pointermove', e => {
  const d = calDrag; if (!d) return;
  if (!d.moved) { if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return; d.moved = true; ui.dragging = true; document.body.classList.add('dragging'); }
  const h0 = calStartHour() * 60, h1 = calEndHour() * 60;
  const px = m => ((m - h0) / 60 * HOUR_H);
  if (d.type === 'create') {
    d.b = clamp(snapMin(calYToMin(d.col, e.clientY)), h0, h1);
    if (!d.ghost) { d.ghost = document.createElement('div'); d.ghost.className = 'cal-ev event ghost'; d.ghost.style.left = '2px'; d.ghost.style.width = 'calc(100% - 4px)'; d.col.appendChild(d.ghost); }
    const a = Math.min(d.a, d.b), b = Math.max(d.a, d.b, a + SNAP);
    d.ghost.style.top = px(a) + 'px'; d.ghost.style.height = px(b) - px(a) + 'px';
    d.ghost.innerHTML = `<b>${esc(t('New block'))}</b><span class="num">${fromMin(a)}–${fromMin(b)}</span>`;
  } else if (d.type === 'move') {
    const cols = $$('.cal-col');
    const over = cols.find(c => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right; }) || d.col;
    if (over !== d.el.parentNode) { over.appendChild(d.el); d.el.style.left = '2px'; d.el.style.width = 'calc(100% - 4px)'; }
    d.col = over; d.date = over.dataset.date;
    const len = d.e - d.s;
    const ns = clamp(snapMin(calYToMin(over, e.clientY) - d.grab), h0, h1 - len);
    d.ns = ns; d.ne = ns + len;
    d.el.style.top = px(ns) + 'px'; d.el.classList.add('lifting');
    const sp = d.el.querySelector('span'); if (sp) sp.textContent = `${fromMin(ns)}–${fromMin(ns + len)}`;
  } else {
    const ne = clamp(snapMin(calYToMin(d.col, e.clientY)), d.s + SNAP, h1);
    d.ns = d.s; d.ne = ne;
    d.el.style.height = px(ne) - px(d.s) - 2 + 'px';
    const sp = d.el.querySelector('span'); if (sp) sp.textContent = `${fromMin(d.s)}–${fromMin(ne)}`;
  }
});
document.addEventListener('pointerup', () => {
  const d = calDrag; if (!d) return;
  calDrag = null;
  if (!d.moved) return;
  ui.dragging = false; document.body.classList.remove('dragging');
  _calSuppress = true; setTimeout(() => { _calSuppress = false; }, 60);
  if (d.type === 'create') {
    if (d.ghost) d.ghost.remove();
    const a = Math.min(d.a, d.b), b = Math.max(d.a, d.b, a + SNAP);
    openEventModal({ date: d.date, start: fromMin(a), end: fromMin(Math.min(1439, b)) });
  } else if (d.ns != null) {
    commit(s => { const ev = byId(s.events, d.id); if (ev) { ev.date = d.date; ev.start = fromMin(d.ns); ev.end = fromMin(Math.min(1439, d.ne)); ev.auto = false; } });
  } else requestRender();
});
window.addEventListener('resize', debounce(() => { if (route.view === 'calendar') requestRender(); }, 150));

/* ── free time ── */
function busyOn(date, events = state.events, pad5 = 5) {
  return [...lessonsOn(date).map(l => [toMin(l.start) - pad5, toMin(l.end) + pad5 * 2]), ...events.filter(e => e.date === date).map(e => [toMin(e.start) - pad5, toMin(e.end) + pad5])].sort((a, b) => a[0] - b[0]);
}
function freeOn(date, busy, minLen = 15) {
  const s = state.settings;
  let from = toMin(s.windowStart), to = toMin(s.windowEnd);
  if (to <= from) to = Math.min(1439, from + 240);
  if (date === todayStr()) from = Math.max(from, Math.ceil((nowMin() + 10) / 15) * 15);
  const free = []; let cur = from;
  for (const [a, b] of busy) { if (a > cur) free.push([cur, Math.min(a, to)]); cur = Math.max(cur, b); if (cur >= to) break; }
  if (cur < to) free.push([cur, to]);
  return free.filter(([a, b]) => b - a >= minLen);
}
function findSlot(date, minutes) {
  const free = freeOn(date, busyOn(date), Math.min(minutes, 15));
  const fit = free.find(([a, b]) => b - a >= minutes) || free[0];
  if (fit) return [fit[0], Math.min(fit[1], fit[0] + minutes)];
  const st = Math.max(toMin(state.settings.windowStart), date === todayStr() ? Math.ceil((nowMin() + 10) / 15) * 15 : 0);
  return [Math.min(st, 1380), Math.min(1439, Math.min(st, 1380) + minutes)];
}

/* ── study block editor ── */
function openEventModal(pre = {}) {
  const editing = pre.id && byId(state.events, pre.id);
  const date = pre.date || todayStr();
  let start = pre.start, end = pre.end;
  if (!start) { const [a, b] = findSlot(date, pre.minutes || 45); start = fromMin(a); end = fromMin(b); }
  const tasks = openTasks().slice().sort((a, b) => taskScore(b) - taskScore(a));
  openModal({
    title: editing ? t('Study block') : t('New study block'),
    body: html`
      <label class="field"><span>${t('What will you work on?')}</span>
        <select class="select" name="taskId" id="ev-task"><option value="">${t('— Free study (no task) —')}</option>${tasks.map(x => html`<option value="${x.id}" ${x.id === pre.taskId ? raw('selected') : ''}>${x.title}</option>`)}${pre.taskId && !tasks.some(x => x.id === pre.taskId) && byId(state.tasks, pre.taskId) ? html`<option value="${pre.taskId}" selected>${byId(state.tasks, pre.taskId).title}</option>` : ''}</select></label>
      <div class="form-grid">
        <label class="field"><span>${t('Title')}</span><input class="input" name="title" value="${pre.title || ''}" placeholder="${t('e.g. Revise chapter 4')}" ${editing || pre.taskId ? '' : raw('autofocus')}></label>
        <label class="field"><span>${t('Subject')}</span><select class="select" name="subjectId">${subjectOptions(pre.subjectId)}</select></label>
        <label class="field full"><span>${t('Date')}</span><input type="date" class="input" name="date" value="${date}" required></label>
        <label class="field"><span>${t('Start')}</span><input type="time" class="input" name="start" value="${start}" step="300" required></label>
        <label class="field"><span>${t('End')}</span><input type="time" class="input" name="end" value="${end}" step="300" required></label>
      </div>
      ${editing ? html`<label class="row" style="cursor:pointer"><span class="switch"><input type="checkbox" name="done" ${editing.done ? raw('checked') : ''}><i></i></span><span>${t('Done')}</span></label>` : ''}`,
    foot: html`${editing ? html`<button type="button" class="btn danger left" data-del>${icon('trash', 15)}${t('Delete')}</button>${byId(state.tasks, editing.taskId) && isOpen(byId(state.tasks, editing.taskId)) ? html`<button type="button" class="btn" data-focus>${icon('play', 13)}${t('Focus')}</button>` : ''}` : ''}<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${editing ? t('Save') : t('Add block')}</button>`,
    onMount: (scrim, entry) => {
      const sel = scrim.querySelector('#ev-task'), title = scrim.querySelector('[name=title]'), sub = scrim.querySelector('[name=subjectId]');
      sel.addEventListener('change', () => { const task = byId(state.tasks, sel.value); if (task) { title.value = task.title; if (task.subjectId) sub.value = task.subjectId; } });
      const del = scrim.querySelector('[data-del]');
      if (del) del.onclick = () => { commit(s => { s.events = s.events.filter(x => x.id !== editing.id); }); closeModal(entry); toastUndo(t('Block deleted')); };
      const fc = scrim.querySelector('[data-focus]');
      if (fc) fc.onclick = () => { closeModal(entry); Timer.start({ mode: 'focus', taskId: editing.taskId, minutes: clamp(toMin(editing.end) - toMin(editing.start), 5, 180) }); go('focus'); };
    },
    onSubmit: d => {
      if (!isYmd(d.date) || !isTime(d.start) || !isTime(d.end)) return false;
      if (d.end <= d.start) { toast(t('The end time must be after the start.'), { kind: 'danger' }); return false; }
      const task = byId(state.tasks, d.taskId);
      const data = { title: d.title.trim() || (task ? task.title : ''), subjectId: d.subjectId || (task ? task.subjectId : ''), taskId: d.taskId, date: d.date, start: d.start, end: d.end };
      if (editing) commit(s => { Object.assign(byId(s.events, editing.id), data, { done: !!d.done, auto: false }); });
      else { commit(s => { s.events.push({ id: uid(), ...data, done: false, auto: false }); }); toast(t('Block added to {day}', { day: relDay(d.date).toLowerCase() })); }
    },
  });
}

/* ── timetable lesson editor ── */
function openLessonModal(lesson, preDay) {
  const editing = lesson && lesson.id ? lesson : null;
  const l = lesson || {};
  if (!state.subjects.length) { toast(t('Add a subject first.')); go('subjects'); return; }
  const last = state.lessons.filter(x => x.day === (preDay || 1)).sort((a, b) => b.end.localeCompare(a.end))[0];
  const defStart = l.start || (last ? fromMin(Math.min(1380, toMin(last.end) + 10)) : '08:00');
  const defEnd = l.end || fromMin(Math.min(1439, toMin(defStart) + 45));
  openModal({
    title: editing ? t('Edit class') : t('Add class'),
    body: html`
      <label class="field"><span>${t('Subject')}</span><select class="select" name="subjectId" required>${subjectOptions(l.subjectId || state.subjects[0].id, false)}</select></label>
      <div class="field"><span>${editing ? t('Day') : t('Days — pick every day this class repeats')}</span>
        <div class="daypick">${WD_KEYS.map(n => html`<label><input type="${editing ? 'radio' : 'checkbox'}" name="${editing ? 'day' : 'day' + n}" value="${n}" ${(editing ? l.day === n : n === (preDay || 0)) ? raw('checked') : ''}><span>${wdName(n, 'short')}</span></label>`)}</div>
      </div>
      <div class="form-grid">
        <label class="field"><span>${t('Start')}</span><input type="time" class="input" name="start" value="${defStart}" required></label>
        <label class="field"><span>${t('End')}</span><input type="time" class="input" name="end" value="${defEnd}" required></label>
        <label class="field full"><span>${t('Room (optional)')}</span><input class="input" name="room" value="${l.room || ''}" placeholder="${t('e.g. 204')}"></label>
      </div>`,
    foot: html`${editing ? html`<button type="button" class="btn danger left" data-del>${icon('trash', 15)}${t('Delete')}</button>` : ''}<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${editing ? t('Save') : t('Add class')}</button>`,
    onMount: (scrim, entry) => {
      const del = scrim.querySelector('[data-del]');
      if (del) del.onclick = () => { commit(s => { s.lessons = s.lessons.filter(x => x.id !== editing.id); }); closeModal(entry); toastUndo(t('Class removed')); };
      const st = scrim.querySelector('[name=start]'), en = scrim.querySelector('[name=end]');
      st.addEventListener('change', () => { if (isTime(st.value)) en.value = fromMin(Math.min(1439, toMin(st.value) + 45)); });
    },
    onSubmit: d => {
      if (!isTime(d.start) || !isTime(d.end) || d.end <= d.start) { toast(t('The end time must be after the start.'), { kind: 'danger' }); return false; }
      const days = editing ? [+d.day || l.day] : WD_KEYS.filter(n => d['day' + n]);
      if (!days.length) { toast(t('Pick at least one day.'), { kind: 'danger' }); return false; }
      if (editing) commit(s => { Object.assign(byId(s.lessons, editing.id), { subjectId: d.subjectId, day: days[0], start: d.start, end: d.end, room: d.room.trim() }); });
      else commit(s => { for (const day of days) s.lessons.push({ id: uid(), subjectId: d.subjectId, day, start: d.start, end: d.end, room: d.room.trim() }); });
    },
  });
}

/* ── auto-planner: fits open tasks into free time before their deadlines ── */
function computePlan(days = 7) {
  const s = state.settings, today = todayStr(), now = nowMin();
  const replaced = ev => ev.auto && !ev.done && (ev.date > today || (ev.date === today && toMin(ev.start) > now));
  const keep = state.events.filter(ev => !replaced(ev));
  const items = openTasks().map(task => {
    const scheduled = sum(keep.filter(ev => ev.taskId === task.id && !ev.done && (ev.date > today || (ev.date === today && toMin(ev.end) > now))), ev => toMin(ev.end) - toMin(ev.start));
    return { task, need: Math.min(240, Math.max(0, (task.est || 30) - taskLogged(task.id) - scheduled)) };
  }).filter(x => x.need >= 10).sort((a, b) => taskScore(b.task) - taskScore(a.task));
  const proposals = [], load = {};
  const cap = Math.max(60, Math.round(s.dailyGoal * 1.3));
  const loadOf = date => (load[date] ??= sum(keep.filter(e => e.date === date), e => toMin(e.end) - toMin(e.start)));
  const place = (item, date) => {
    if (loadOf(date) >= cap) return false;
    const busy = [...busyOn(date, keep), ...proposals.filter(p => p.date === date).map(p => [p.start - 5, p.end + 10])].sort((a, b) => a[0] - b[0]);
    /* one sitting of up to 50 min; prefer the first gap that fits it whole, otherwise the longest gap */
    const want = Math.max(15, Math.ceil(Math.min(item.need, 50) / 5) * 5);
    const free = freeOn(date, busy);
    const slot = free.find(([a, b]) => b - a >= want) || free.slice().sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]))[0];
    if (!slot) return false;
    const dur = Math.min(want, Math.floor((slot[1] - slot[0]) / 5) * 5);
    if (dur < 15 || (dur < want && dur < 25 && item.need > dur)) return false;
    proposals.push({ taskId: item.task.id, date, start: slot[0], end: slot[0] + dur });
    item.need -= dur; load[date] = loadOf(date) + dur;
    return true;
  };
  for (const item of items) {
    const dueIn = item.task.due ? diffDays(item.task.due, today) : days - 1;
    const last = clamp(dueIn <= 0 ? 0 : dueIn - (dueIn > 1 ? 1 : 0), 0, days - 1);       // finish the day before it is due when possible
    for (const [from, to] of [[0, last], [last + 1, days - 1]]) {
      let progress = true;
      while (progress && item.need >= 10) {
        progress = false;
        for (let i = from; i <= to && item.need >= 10; i++) if (place(item, addDays(today, i))) progress = true;
      }
    }
  }
  proposals.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  return { proposals, replaced: state.events.filter(replaced).map(e => e.id), unplaced: items.filter(x => x.need >= 10).length, considered: items.length };
}

function openAutoPlan() {
  const plan = computePlan(7);
  const byDay = groupBy(plan.proposals, p => p.date);
  const total = sum(plan.proposals, p => p.end - p.start);
  const body = plan.proposals.length ? html`
    <p class="muted">${t('Here is a realistic week: your open tasks, fitted into free time between {a} and {b}, most urgent first, never more than 50 minutes at a stretch.', { a: state.settings.windowStart, b: state.settings.windowEnd })}</p>
    <div class="plan-stats"><div><b class="num">${plan.proposals.length}</b><span>${tn(plan.proposals.length, 'block', 'blocks')}</span></div><div><b class="num">${fmtDur(total)}</b><span>${t('of focused work')}</span></div><div><b class="num">${byDay.size}</b><span>${tn(byDay.size, 'day', 'days')}</span></div></div>
    <div class="plan-list">${[...byDay.entries()].map(([date, ps]) => html`
      <div class="plan-day"><div class="eyebrow">${relDay(date)} · ${fmtDate(date, 'short')}</div>
      ${ps.map(p => { const task = byId(state.tasks, p.taskId); return html`<div class="plan-row" style="--c:${subjColor(task.subjectId)}"><span class="num muted">${fromMin(p.start)}–${fromMin(p.end)}</span><i class="agenda-bar"></i><span class="grow trunc">${task.title}</span>${task.due ? html`<span class="tiny faint">${t('due')} ${relDay(task.due).toLowerCase()}</span>` : ''}</div>`; })}</div>`)}</div>
    ${plan.unplaced ? html`<div class="chip warn" style="height:auto;padding:8px 12px;white-space:normal;border-radius:10px">${icon('alert', 14)}${t('{n} could not fit completely — consider a longer study window or fewer commitments.', { n: nt(plan.unplaced, 'task', 'tasks') })}</div>` : ''}
    ${plan.replaced.length ? html`<div class="tiny faint">${t('{n} earlier auto-planned blocks will be replaced. Blocks you made yourself are never touched.', { n: plan.replaced.length })}</div>` : ''}`
    : emptyState('sparkles', plan.considered ? t('No free time found') : t('Nothing to plan'), plan.considered ? t('Your study window is full this week. Widen it in Settings or move a few blocks.') : t('Add tasks with time estimates and the planner will lay out your week.'));
  openModal({
    title: t('Auto-plan the next 7 days'), cls: 'wide', body,
    foot: plan.proposals.length ? html`<button type="button" class="btn ghost" data-close>${t('Not now')}</button><button class="btn primary">${icon('check', 15)}${t('Apply plan')}</button>` : html`<button type="button" class="btn" data-close>${t('Close')}</button>`,
    onSubmit: () => {
      if (!plan.proposals.length) return;
      commit(s => {
        s.events = s.events.filter(e => !plan.replaced.includes(e.id));
        for (const p of plan.proposals) { const task = byId(s.tasks, p.taskId); s.events.push({ id: uid(), title: task.title, subjectId: task.subjectId, taskId: task.id, date: p.date, start: fromMin(p.start), end: fromMin(p.end), done: false, auto: true }); }
      });
      toastUndo(t('Week planned — {n} added', { n: nt(plan.proposals.length, 'block', 'blocks') }));
    },
  });
}

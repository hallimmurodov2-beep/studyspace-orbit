'use strict';
/* ───────────── Diary: the school week the way a paper diary shows it — lesson · homework · mark ───────────── */

const diaryWeek = () => weekStart(ui.diary.anchor || todayStr());

/* one day of the diary as data (also used by the tests) */
function diaryDayData(date) {
  const due = sortTasks(state.tasks.filter(x => x.due === date));
  const marks = state.grades.filter(g => g.date === date);
  const seen = new Set(), usedT = new Set(), usedG = new Set();
  const rows = lessonsOn(date).map(l => {
    const first = !seen.has(l.subjectId); seen.add(l.subjectId);            // a double lesson shows its homework once
    const hw = first ? due.filter(x => x.subjectId === l.subjectId) : [];
    const gs = first ? marks.filter(g => g.subjectId === l.subjectId) : [];
    hw.forEach(x => usedT.add(x.id)); gs.forEach(g => usedG.add(g.id));
    return { lesson: l, first, hw, marks: gs };
  });
  return { date, rows, other: due.filter(x => !usedT.has(x.id)), otherMarks: marks.filter(g => !usedG.has(g.id)), exams: state.exams.filter(e => e.date === date), off: dayOff(date), cancelled: cancelledOn(date) };
}

function diaryTask(x) {
  const done = x.status === 'done';
  return html`<div class="dy-task ${done ? 'done' : ''}" data-key="dyt-${x.id}">
    <button class="check sq p${x.priority} ${done ? 'done' : ''}" data-act="toggle-task" data-id="${x.id}" aria-label="${done ? t('Mark as not done') : t('Mark as done')}">${icon('check', 11)}</button>
    <button class="dy-title" data-act="open-task" data-id="${x.id}">${x.title}</button>
  </div>`;
}
const diaryMark = g => html`<button class="dy-g" data-act="edit-grade" data-id="${g.id}" title="${g.title || ''}">${gradeBadge(g.value, g.max)}</button>`;

function diaryDay(date) {
  const d = diaryDayData(date), today = todayStr();
  const tasks = [...d.rows.flatMap(r => r.hw), ...d.other], done = tasks.filter(x => x.status === 'done').length;
  const adding = (subjectId) => ui.diary.add === date + '|' + subjectId;
  const hwCell = (subjectId, list, canAdd) => html`<div class="dy-hw ${list.length ? 'has' : ''}">
    ${list.map(diaryTask)}
    ${adding(subjectId) ? html`<form class="dy-form" data-submit="diary-hw" data-keydown="diary-hw-key" data-subject="${subjectId}" data-due="${date}"><input name="q" autocomplete="off" placeholder="${t('Homework… e.g. “p. 54 ex. 3–7”')}"></form>`
      : canAdd ? html`<button class="dy-add ${list.length ? '' : 'wide'}" data-act="diary-add" data-subject="${subjectId}" data-date="${date}" aria-label="${t('Add homework')}">${icon('plus', 13)}</button>` : ''}
  </div>`;
  return html`<section class="card dy-day ${date === today ? 'today' : ''} ${date < today ? 'past' : ''} ${d.off ? 'off' : ''}" data-key="dy-${date}" data-date="${date}">
    <header class="dy-head">
      <b>${wdName(dow(date), 'long')}</b><span class="muted num">${fmtDate(date, 'short')}</span>
      ${date === today ? html`<span class="chip accent">${t('Today')}</span>` : ''}
      ${d.exams.map(e => html`<a class="chip warn" href="#/exams">${icon('exam', 12)}<span class="trunc">${e.title}</span></a>`)}
      <span class="grow"></span>
      ${tasks.length ? html`<span class="tiny ${done === tasks.length ? 'dy-alldone' : 'faint'} num">${done === tasks.length ? icon('check', 12) : ''}${done}/${tasks.length}</span>` : ''}
      <button class="btn icon sm ghost dy-menu no-print" data-act="diary-day-menu" data-date="${date}" aria-label="${t('Day options')}">${icon('more', 15)}</button>
    </header>
    ${d.rows.length ? d.rows.map((r, i) => { const l = r.lesson, s = subjectOf(l.subjectId); return html`
      <div class="dy-row" style="--c:${s ? s.color : 'var(--accent)'}" data-key="dyr-${date}-${l.id}">
        <span class="dy-n num">${i + 1}</span>
        <button class="dy-subj" data-act="open-class" data-id="${l.id}" data-date="${date}" title="${l.start}–${l.end}${l.room ? ' · ' + l.room : ''}"><span class="trunc">${s ? s.name : t('Class')}</span><small class="num">${l.was ? html`<i class="dy-swap" title="${t('instead of {name}', { name: subjName(l.was) })}">${icon('swap', 10)}</i>` : ''}${l.start}</small></button>
        ${hwCell(l.subjectId, r.hw, r.first)}
        <div class="dy-mark">${r.marks.map(diaryMark)}${r.first && !r.marks.length && date <= today ? html`<button class="dy-add" data-act="diary-grade" data-subject="${l.subjectId}" data-date="${date}" aria-label="${t('Add grade')}">${icon('plus', 13)}</button>` : ''}</div>
      </div>`; }) : d.off ? html`<div class="dy-empty off">${icon('sun', 15)}<span><b>${t('No school')}</b>${d.off.name ? html` · ${d.off.name}` : ''}</span></div>` : html`<div class="dy-empty">${t('No classes')}</div>`}
    ${d.cancelled.length ? html`<div class="dy-cancelled" data-key="dyc-${date}"><span class="trunc">${t('Cancelled: {list}', { list: d.cancelled.map(l => subjName(l.subjectId) || t('Class')).join(', ') })}</span><button class="linkbtn no-print" data-act="diary-restore" data-date="${date}">${t('Restore')}</button></div>` : ''}
    ${d.other.length || d.otherMarks.length || adding('') ? html`
      <div class="dy-row other" data-key="dyo-${date}">
        <span class="dy-n">${icon('inbox', 13)}</span>
        <span class="dy-subj plain"><span class="trunc">${d.other.length ? t('Also due') : t('Other marks')}</span></span>
        ${hwCell('', d.other, false)}
        <div class="dy-mark">${d.otherMarks.map(diaryMark)}</div>
      </div>` : ''}
  </section>`;
}

VIEWS.diary = {
  title: 'Diary', icon: 'diary',
  render() {
    const ws = diaryWeek(), today = todayStr();
    let days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const busy = d => lessonsOn(d).length || state.tasks.some(x => x.due === d) || state.grades.some(g => g.date === d) || state.exams.some(e => e.date === d);
    days = days.filter((d, i) => i < 5 || busy(d));                         // weekend days only when something is on them
    const data = days.map(diaryDayData);
    const tasks = data.flatMap(d => [...d.rows.flatMap(r => r.hw), ...d.other]), done = tasks.filter(x => x.status === 'done').length;
    const marks = state.grades.filter(g => g.date >= ws && g.date <= addDays(ws, 6));
    const avg = marks.length ? sum(marks, normGrade) / marks.length : null;
    const thisWeek = ws === weekStart(today), tr = termOf(ws) || termOf(addDays(ws, 6));
    return html`
    <div class="page-head">
      <div><h1 class="h1">${t('Diary')}</h1><div class="sub">${thisWeek ? t('This week') : `${fmtDate(ws, 'short')} – ${fmtDate(addDays(ws, 6), 'short')}`}${tr ? html` · ${t(tr.name)}` : ''} · ${tasks.length ? t('homework {a} of {b} done', { a: done, b: tasks.length }) : t('no homework written down')}${avg != null ? html` · ${nt(marks.length, 'grade', 'grades')}, ${t('average')} <b class="num">${fmtGrade(avg)}</b>` : ''}</div></div>
      <div class="row wrap no-print">
        <button class="btn icon" data-act="diary-nav" data-d="-1" aria-label="${t('Previous')}">${icon('left', 16)}</button>
        <button class="btn" data-act="diary-nav" data-d="0" ${thisWeek ? raw('disabled') : ''}>${t('This week')}</button>
        <button class="btn icon" data-act="diary-nav" data-d="1" aria-label="${t('Next')}">${icon('right', 16)}</button>
        <button class="btn" data-act="chat-paste">${icon('chat', 16)}<span class="hide-m">${t('Paste from chat')}</span></button>
        <button class="btn hide-m" data-act="diary-print">${icon('download', 16)}${t('Print')}</button>
      </div>
    </div>
    ${!state.lessons.length ? html`<div class="card" style="margin-bottom:16px">${emptyState('diary', t('Add your timetable first'), t('The diary lists each day’s classes with a place for the homework and the mark, like the paper one.'), html`<div class="row wrap" style="justify-content:center"><button class="btn primary" data-act="paste-timetable">${icon('list', 16)}${t('Paste timetable')}</button><a class="btn" href="#/settings/timetable">${t('Set up timetable')}</a></div>`)}</div>` : ''}
    ${state.lessons.length || tasks.length ? html`<div class="diary">${days.map(diaryDay)}</div>
    <div class="hint no-print" style="margin-top:12px">${t('Homework sits on the day it is due. Tap a subject for the class sheet, + to write homework or a mark.')}</div>` : ''}`;
  },
  after() {
    if (ui.diary.seen === route) return;                                    // once per visit: on a phone, start at today
    ui.diary.seen = route;
    const el = $('.dy-day.today');
    if (el && innerWidth <= 760) el.scrollIntoView({ block: 'start' });
  },
};

ACT['diary-nav'] = el => { const d = +el.dataset.d; setUI(u => { u.diary.anchor = d === 0 ? '' : addDays(diaryWeek(), d * 7); u.diary.add = ''; }); };
ACT['diary-print'] = () => window.print();
ACT['diary-day-menu'] = el => {
  const date = el.dataset.date, off = dayOff(date), changed = !!state.changes[date];
  openMenu(el, [
    off ? { icon: 'book', label: t('School day again'), fn: () => { commit(s => setDayOff(s, date, false)); toastUndo(t('{d} is a school day again', { d: fmtDate(date, 'short') })); } }
      : { icon: 'sun', label: t('No school this day'), fn: () => openDayOff(date) },
    ...(changed && !off ? [{ icon: 'undo', label: t('Back to the usual timetable'), fn: () => { commit(s => { delete s.changes[date]; }); toastUndo(t('Usual timetable restored')); } }] : []),
    '-',
    { icon: 'plus', label: t('Add homework due this day'), fn: () => openQuickAdd('', { due: date }) },
    { icon: 'chat', label: t('Share this day’s homework'), fn: () => shareHomework(date) },
    { icon: 'star', label: t('Add a grade'), fn: () => openGradeModal(null, { date: date <= todayStr() ? date : todayStr() }) },
  ]);
};
ACT['diary-restore'] = el => { commit(s => { const ch = s.changes[el.dataset.date]; if (!ch) return; for (const k of Object.keys(ch)) if (ch[k] === '') delete ch[k]; if (!Object.keys(ch).length) delete s.changes[el.dataset.date]; }); toastUndo(t('Classes restored')); };
/* a day (or a run of days) without school: a holiday, a break, a closed school */
function openDayOff(date) {
  const due = state.tasks.filter(x => isOpen(x) && x.due === date && x.subjectId).length;
  openModal({
    title: t('No school'), cls: 'narrow',
    body: html`
      <label class="field"><span>${t('What is it? (optional)')}</span><input class="input" name="name" maxlength="40" placeholder="${t('e.g. Constitution Day, Winter break')}" autofocus></label>
      <div class="form-grid">
        <label class="field"><span>${t('From')}</span><input type="date" class="input" name="start" value="${date}" required></label>
        <label class="field"><span>${t('To')}</span><input type="date" class="input" name="end" value="${date}" required></label>
      </div>
      ${due ? html`<label class="row small" style="cursor:pointer;gap:10px"><span class="switch"><input type="checkbox" name="move" checked><i></i></span>${t('Move the homework due then to each subject’s next class')}</label>` : ''}`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Mark as day off')}</button>`,
    onSubmit: d => {
      if (!isYmd(d.start) || !isYmd(d.end)) return false;
      const start = d.start, end = d.end < d.start ? d.start : d.end;
      commit(s => {
        s.daysOff = s.daysOff.filter(x => x.end < start || x.start > end);         // the new range replaces whatever it overlaps
        s.daysOff.push({ id: uid(), name: d.name.trim().slice(0, 40), start, end });
        if (d.move) for (const x of s.tasks) if (isOpen(x) && x.due >= start && x.due <= end && x.subjectId) { const nx = nextLessonDate(x.subjectId, end); if (nx) x.due = nx; }
      });
      toastUndo(start === end ? t('{d}: no school', { d: fmtDate(start, 'short') }) : t('No school {a} – {b}', { a: fmtDate(start, 'short'), b: fmtDate(end, 'short') }));
    },
  });
}
ACT['diary-add'] = el => {
  setUI(u => { u.diary.add = el.dataset.date + '|' + el.dataset.subject; });
  setTimeout(() => { const i = $('.dy-form input'); if (i) i.focus(); }, 30);
};
ACT['diary-grade'] = el => openGradeModal(null, { subjectId: el.dataset.subject, date: el.dataset.date });
ON.submit['diary-hw'] = (form, e) => {
  e.preventDefault();
  const p = parseQuick(form.querySelector('input').value);
  if (!p.title) { setUI(u => { u.diary.add = ''; }); return; }
  ui.diary.add = '';
  commit(s => { s.tasks.push(newTask({ title: p.title, subjectId: form.dataset.subject || p.subjectId || '', due: p.due || form.dataset.due, est: p.est, priority: p.priority, repeat: p.repeat })); });
  toastUndo(t('Homework added'));
};
ON.keydown['diary-hw-key'] = (form, e) => { if (e.key === 'Escape') { e.stopPropagation(); setUI(u => { u.diary.add = ''; }); } };

/* ───────────── homework from a chat, and back ───────────── */
/* paste the class chat message: every line becomes homework for its subject, due at that subject's next lesson */
function openChatPaste(prefill = '') {
  let items = [];
  const subjOpts = sel => html`<option value="">${t('No subject')}</option>${state.subjects.map(s => html`<option value="${s.id}" ${s.id === sel ? raw('selected') : ''}>${s.name}</option>`)}`;
  const known = x => state.tasks.some(y => y.due === x.due && (y.subjectId || '') === (x.subjectId || '') && y.title.trim().toLowerCase() === x.title.trim().toLowerCase());
  openModal({
    title: t('Homework from a chat'), cls: 'wide',
    body: html`
      <label class="field"><span>${t('Paste the message from your class chat')}</span><textarea class="input cp-text" name="chat" rows="6" spellcheck="false" placeholder="${'Homework for tomorrow:\nAlgebra: p. 54 ex. 3–7\nPhysics – learn §12\nEnglish: words, unit 4 for Friday'}">${prefill}</textarea></label>
      <div class="hint" style="margin-top:-6px">${t('One subject per line, like “Algebra: p. 54 ex. 3–7”. Without a date, each is due at that subject’s next lesson. A line such as “Homework for Thursday:” sets the day for the lines under it.')}</div>
      <div id="cp-preview" class="cp-preview"></div>`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary" id="cp-save" disabled>${t('Add homework')}</button>`,
    onMount: scrim => {
      const ta = scrim.querySelector('[name=chat]'), prev = scrim.querySelector('#cp-preview'), save = scrim.querySelector('#cp-save');
      const count = () => { const n = items.filter(x => x.on && x.title.trim()).length; save.disabled = !n; save.textContent = n ? tn(n, 'Add {n} homework', 'Add {n} homework').replace('{n}', n) : t('Add homework'); };
      const draw = () => {
        items = parseHomeworkText(ta.value).map(x => ({ ...x, dup: known(x) }));
        /* in a message with subject lines, a line without one is usually chatter ("See you tomorrow!"): it starts unticked */
        const anySubject = items.some(x => x.subjectId);
        items = items.map(x => ({ ...x, on: !x.dup && (!!x.subjectId || !anySubject) }));
        prev.innerHTML = !items.length ? (ta.value.trim() ? String(html`<div class="small muted">${t('No homework found yet — put each subject on its own line.')}</div>`) : '')
          : String(html`${items.map((x, i) => html`<div class="cp-row ${x.on ? '' : 'off'}" data-i="${i}" style="--c:${x.subjectId ? subjColor(x.subjectId) : 'var(--text-3)'}">
              <span class="switch sm"><input type="checkbox" data-f="on" ${x.on ? raw('checked') : ''} aria-label="${t('Add this one')}"><i></i></span>
              <select class="select" data-f="subjectId" aria-label="${t('Subject')}">${subjOpts(x.subjectId)}</select>
              <input class="input" data-f="title" value="${x.title}" aria-label="${t('Homework')}">
              <input type="date" class="input" data-f="due" value="${x.due}" aria-label="${t('Due')}">
              ${x.dup ? html`<span class="tiny faint cp-dup">${t('already in')}</span>` : html`<span class="tiny muted cp-when">${relDay(x.due)}</span>`}
            </div>`)}`);
        count();
      };
      prev.addEventListener('input', e => { const row = e.target.closest('[data-i]'); if (!row) return; const x = items[+row.dataset.i], f = e.target.dataset.f;
        x[f] = f === 'on' ? e.target.checked : e.target.value; row.classList.toggle('off', !x.on);
        if (f === 'subjectId') row.style.setProperty('--c', x.subjectId ? subjColor(x.subjectId) : 'var(--text-3)');
        if (f === 'due') { const w = row.querySelector('.cp-when'); if (w && isYmd(x.due)) w.textContent = relDay(x.due); }
        count(); });
      ta.addEventListener('input', draw); draw();
    },
    onSubmit: () => {
      const add = items.filter(x => x.on && x.title.trim() && isYmd(x.due));
      if (!add.length) return false;
      commit(s => { for (const x of add) s.tasks.push(newTask({ title: x.title.trim().slice(0, 200), subjectId: x.subjectId || '', due: x.due, est: x.est || 0, priority: x.priority || 0 })); });
      toastUndo(t('{n} added', { n: nt(add.length, 'homework', 'homework') }));
    },
  });
}
/* one day's homework as text for the class chat: the share sheet on a phone, the clipboard elsewhere */
async function shareHomework(date) {
  const text = homeworkText(date);
  if (!text) { toast(t('No homework on {d} to share.', { d: fmtDate(date, 'short') })); return; }
  if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast(t('Copied — paste it into your class chat')); }
  catch (e) { openModal({ title: t('Share homework'), cls: 'narrow', body: html`<textarea class="input" rows="7" readonly>${text}</textarea><div class="hint">${t('Select it and copy.')}</div>` }); }
}
ACT['chat-paste'] = () => openChatPaste();
ACT['share-day'] = el => shareHomework(el.dataset.date);

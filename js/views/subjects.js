'use strict';
/* ───────────── Subjects: overview grid + a home page for each subject ───────────── */

function subjectStats(id) {
  const today = todayStr();
  return {
    open: openTasks().filter(x => x.subjectId === id).length,
    week: sum(state.sessions.filter(x => x.subjectId === id && x.date >= addDays(today, -6)), x => x.min),
    total: sum(state.sessions.filter(x => x.subjectId === id), x => x.min),
    avg: (currentTerm() ? termResult(id, currentTerm()) : null) ?? subjectAverage(id),
    exam: upcomingExams().find(e => e.subjectId === id),
    cards: state.cards.filter(c => (byId(state.decks, c.deckId) || {}).subjectId === id).length,
    lessons: state.lessons.filter(l => l.subjectId === id).length,
  };
}

function subjectsHome() {
  return html`
  <div class="page-head">
    <div><h1 class="h1">${t('Subjects')}</h1><div class="sub">${t('Everything for each class in one place.')}</div></div>
    <button class="btn primary" data-act="new-subject">${icon('plus', 16)}${t('Add subject')}</button>
  </div>
  ${state.subjects.length ? html`<div class="subject-grid">${state.subjects.map(s => {
    const st = subjectStats(s.id);
    return html`<a class="card pad click subject" href="#/subjects/${s.id}" data-key="sub-${s.id}" style="--c:${s.color}">
      <div class="row" style="gap:12px">${subjGlyph(s.id, 'lg')}<div class="grow"><div class="h2 trunc">${s.name}</div><div class="tiny faint trunc">${[s.teacher, s.room && t('Room {r}', { r: s.room })].filter(Boolean).join(' · ') || nt(st.lessons, 'class a week', 'classes a week')}</div></div>
      ${st.avg != null ? html`<span class="gavg num ${LEVEL_CLS[gradeLevel(st.avg, state.settings.gradeScale)]}">${fmtGrade(st.avg)}</span>` : ''}</div>
      <div class="statline"><div><b class="num">${st.open}</b><span>${t('open tasks')}</span></div><div><b class="num">${fmtDur(st.week)}</b><span>${t('this week')}</span></div><div><b class="num">${st.cards}</b><span>${t('cards')}</span></div></div>
      ${st.exam ? html`<div class="chip warn" style="align-self:flex-start">${icon('exam', 12)}${st.exam.title} · ${daysAway(diffDays(st.exam.date, todayStr()))}</div>` : ''}
    </a>`; })}</div>`
    : html`<div class="card">${emptyState('book', t('No subjects yet'), t('Subjects give your tasks, grades and study time their colour.'), html`<button class="btn primary" data-act="new-subject">${icon('plus', 16)}${t('Add subject')}</button>`)}</div>`}`;
}

function subjectPage(s) {
  const st = subjectStats(s.id), today = todayStr();
  const tasks = sortTasks(openTasks().filter(x => x.subjectId === s.id));
  const exams = upcomingExams().filter(e => e.subjectId === s.id);
  const grades = state.grades.filter(g => g.subjectId === s.id).sort((a, b) => b.date.localeCompare(a.date));
  const notes = state.notes.filter(n => n.subjectId === s.id).sort((a, b) => b.updatedAt - a.updatedAt);
  const decks = state.decks.filter(d => d.subjectId === s.id);
  const lessons = state.lessons.filter(l => l.subjectId === s.id).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  const tr = currentTerm(), gst = tr ? goalStatus(s.id, tr) : null, inTerm = tr && termOf(today) === tr && officialMark(s.id, tr.id) == null;
  const nextCls = nextLessonDate(s.id, addDays(today, -1));
  return html`
  <div class="page-head" style="--c:${s.color}">
    <div><a class="btn sm ghost" href="#/subjects" style="margin-left:-10px">${icon('left', 14)}${t('All subjects')}</a>
      <div class="row" style="gap:14px;margin-top:6px">${subjGlyph(s.id, 'lg')}<div><h1 class="h1">${s.name}</h1><div class="sub">${[s.teacher, s.room && t('Room {r}', { r: s.room })].filter(Boolean).join(' · ') || t('Add a teacher or room in Edit')}</div></div></div></div>
    <div class="row wrap"><button class="btn icon" data-act="subject-menu" data-id="${s.id}">${icon('more', 16)}</button><button class="btn" data-act="edit-subject" data-id="${s.id}">${icon('edit', 15)}${t('Edit')}</button><button class="btn primary" data-act="focus-subject" data-id="${s.id}">${icon('play', 14)}${t('Study this')}</button></div>
  </div>
  <div class="stat-row">
    <div class="card pad stat"><div class="eyebrow">${tr ? t(tr.name) : t('Average')}</div><div class="row" style="gap:10px;margin-top:10px;align-items:baseline"><div class="big-num">${fmtGrade(st.avg)}</div>${tr ? trendChip(termTrend(s.id, tr), prevTerm(tr) ? t(prevTerm(tr).name) : '') : ''}</div><div class="small muted">${gst ? (gst.met ? t('goal {g} · on track', { g: gst.goal }) : gst.final ? t('goal was {g}', { g: gst.goal }) : gst.need === Infinity ? t('goal {g} · one grade is not enough', { g: gst.goal }) : gst.need != null ? t('goal {g} · needs {n} next', { g: gst.goal, n: gst.need }) : t('goal {g}', { g: gst.goal })) : nt(grades.length, 'grade', 'grades')}</div></div>
    <div class="card pad stat"><div class="eyebrow">${t('Focus time')}</div><div class="big-num" style="margin-top:10px">${fmtDur(st.total)}</div><div class="small muted">${t('{n} this week', { n: fmtDur(st.week) })}</div></div>
    <div class="card pad stat"><div class="eyebrow">${t('Open tasks')}</div><div class="big-num" style="margin-top:10px">${st.open}</div><div class="small muted">${fmtDur(sum(tasks, x => x.est))} ${t('estimated')}</div></div>
    <div class="card pad stat"><div class="eyebrow">${t('Next exam')}</div><div class="big-num" style="margin-top:10px">${st.exam ? diffDays(st.exam.date, today) : '—'}<span style="font-size:14px;font-weight:600;color:var(--text-2)"> ${st.exam ? tn(diffDays(st.exam.date, today), 'day', 'days') : ''}</span></div><div class="small muted trunc">${st.exam ? st.exam.title : t('None scheduled')}</div></div>
  </div>
  <section class="card pad year-chart-card" style="--c:${s.color};margin-bottom:18px">
    <div class="card-head"><div><h2 class="h2">${t('The school year')}</h2><div class="small muted">${nextCls ? t('Next class: {d}', { d: relDay(nextCls).toLowerCase() }) : t('Not on the timetable yet')}${grades.length ? html` · ${nt(grades.length, 'grade', 'grades')}` : ''}</div></div>
      <div class="row wrap"><a class="btn sm ghost hide-m" href="#/grades" data-act="goal-open" data-id="${s.id}">${t('Open in Grades')}${icon('right', 14)}</a><button class="btn sm soft" data-act="new-grade" data-subject="${s.id}">${icon('plus', 14)}${t('Add grade')}</button></div></div>
    ${yearChart(s.id)}
    ${inTerm ? html`<div class="yc-need">${needCalc(s.id, { ...tr, name: t(tr.name) })}</div>` : ''}
  </section>
  <div class="two-col">
    <div class="col" style="gap:18px">
      <section class="card pad"><div class="card-head"><h2 class="h2">${t('Tasks')}</h2><a class="btn sm ghost" href="#/tasks/subject/${s.id}">${t('Open in Tasks')}${icon('right', 14)}</a></div>
        ${tasks.length ? html`<div class="tasklist">${tasks.slice(0, 8).map(x => taskRow(x, { noSubject: true }))}</div>` : html`<div class="small muted" style="padding:4px 0 8px">${t('No open tasks for this subject.')}</div>`}
        <form class="quick inline" data-submit="inline-add" data-subject="${s.id}" style="margin-top:12px">${icon('plus', 17)}<input name="q" autocomplete="off" placeholder="${t('Add a task to {name}…', { name: s.name })}"></form>
      </section>
      <section class="card pad"><div class="card-head"><h2 class="h2">${t('Notes')}</h2><button class="btn sm ghost" data-act="new-note" data-subject="${s.id}">${icon('plus', 14)}${t('New note')}</button></div>
        ${notes.length ? html`<div class="col" style="gap:2px">${notes.slice(0, 6).map(n => html`<button class="grade-item" data-act="open-note" data-id="${n.id}">${icon('note', 15, 'faint')}<span class="grow trunc" style="text-align:left">${n.title || t('Untitled')}</span><span class="tiny faint">${fmtDate(ymd(new Date(n.updatedAt)), 'short')}</span></button>`)}</div>` : html`<div class="small muted">${t('Keep formulas, summaries and reading notes here.')}</div>`}
      </section>
    </div>
    <div class="col" style="gap:18px">
      <section class="card pad"><div class="card-head"><h2 class="h2">${t('Latest grades')}</h2><button class="btn sm ghost" data-act="new-grade" data-subject="${s.id}">${icon('plus', 14)}${t('Add')}</button></div>
        ${grades.length ? html`<div class="col" style="gap:2px">${grades.slice(0, 6).map(g => html`<button class="grade-item" data-act="edit-grade" data-id="${g.id}">${gradeBadge(g.value, g.max)}<span class="grow trunc" style="text-align:left">${g.title || t(GRADE_KINDS.find(k => k[0] === g.kind)?.[1] || 'Grade')}</span><span class="tiny faint">${fmtDate(g.date, 'short')}</span></button>`)}</div>` : html`<div class="small muted">${t('No grades recorded yet.')}</div>`}
      </section>
      ${exams.length ? html`<section class="card pad"><div class="card-head"><h2 class="h2">${t('Exams')}</h2><a class="btn sm ghost" href="#/exams">${t('All')}${icon('right', 14)}</a></div>
        <div class="col" style="gap:10px">${exams.map(e => html`<a class="row" href="#/exams" style="gap:12px"><div class="countdown" style="--c:${s.color}"><b class="num">${diffDays(e.date, today)}</b><span>${tn(diffDays(e.date, today), 'day', 'days')}</span></div><div class="grow"><div class="trunc" style="font-weight:600">${e.title}</div><div class="tiny faint">${fmtDate(e.date, 'long')}</div></div></a>`)}</div></section>` : ''}
      <section class="card pad"><div class="card-head"><h2 class="h2">${t('Timetable')}</h2><button class="btn sm ghost" data-act="add-lesson" data-subject="${s.id}">${icon('plus', 14)}${t('Add')}</button></div>
        ${lessons.length ? html`<div class="col" style="gap:2px">${lessons.map(l => html`<button class="grade-item" data-act="edit-lesson" data-id="${l.id}"><span class="chip subj" style="--c:${s.color}">${wdName(l.day, 'short')}</span><span class="grow num" style="text-align:left">${l.start} – ${l.end}</span>${l.room ? html`<span class="tiny faint">${l.room}</span>` : ''}</button>`)}</div>` : html`<div class="small muted">${t('No classes in the timetable yet.')}</div>`}
      </section>
      ${decks.length ? html`<section class="card pad"><div class="card-head"><h2 class="h2">${t('Flashcards')}</h2></div><div class="col" style="gap:2px">${decks.map(d => html`<a class="grade-item" href="#/cards/${d.id}">${icon('cards', 15, 'faint')}<span class="grow trunc">${d.name}</span><span class="tiny faint">${nt(deckCards(d.id).length, 'card', 'cards')}</span></a>`)}</div></section>` : ''}
    </div>
  </div>`;
}

VIEWS.subjects = {
  title: 'Subjects', icon: 'book',
  render(arg) { const s = arg && subjectOf(arg); return s ? subjectPage(s) : subjectsHome(); },
};

function openSubjectModal(subject) {
  const used = new Set(state.subjects.map(x => x.color));
  const s = subject || { name: '', color: PALETTE.find(c => !used.has(c)) || PALETTE[state.subjects.length % PALETTE.length], icon: 'book', teacher: '', room: '' };
  openModal({
    title: subject ? t('Edit subject') : t('New subject'),
    body: html`
      <label class="field"><span>${t('Name')}</span><input class="input" name="name" value="${s.name}" required placeholder="${t('e.g. Physics')}" autofocus></label>
      <div class="field"><span>${t('Colour')}</span><div class="swatches">${PALETTE.map(c => html`<button type="button" class="swatch ${c === s.color ? 'on' : ''}" style="--c:${c}" data-color="${c}" aria-label="${c}"></button>`)}</div><input type="hidden" name="color" value="${s.color}"></div>
      <div class="field"><span>${t('Icon')}</span><div class="iconpick">${SUBJECT_ICONS.map(i => html`<button type="button" class="${i === (s.icon || 'book') ? 'on' : ''}" data-icon="${i}">${icon(i, 17)}</button>`)}</div><input type="hidden" name="icon" value="${s.icon || 'book'}"></div>
      <div class="form-grid">
        <label class="field"><span>${t('Teacher (optional)')}</span><input class="input" name="teacher" value="${s.teacher || ''}"></label>
        <label class="field"><span>${t('Room (optional)')}</span><input class="input" name="room" value="${s.room || ''}"></label>
      </div>`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${subject ? t('Save') : t('Add subject')}</button>`,
    onMount: scrim => {
      scrim.addEventListener('click', e => {
        const c = e.target.closest('[data-color]'), i = e.target.closest('[data-icon]');
        if (c) { scrim.querySelector('[name=color]').value = c.dataset.color; scrim.querySelectorAll('.swatch').forEach(x => x.classList.toggle('on', x === c)); }
        if (i) { scrim.querySelector('[name=icon]').value = i.dataset.icon; scrim.querySelectorAll('[data-icon]').forEach(x => x.classList.toggle('on', x === i)); }
      });
    },
    onSubmit: d => {
      if (!d.name.trim()) return false;
      const data = { name: d.name.trim().slice(0, 60), color: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : PALETTE[0], icon: ICONS[d.icon] ? d.icon : 'book', teacher: d.teacher.trim(), room: d.room.trim() };
      if (subject) commit(s2 => { Object.assign(byId(s2.subjects, subject.id), data); });
      else commit(s2 => { s2.subjects.push({ id: uid(), ...data }); });
    },
  });
}
function deleteSubject(id) {
  commit(s => {
    s.subjects = s.subjects.filter(x => x.id !== id);
    s.lessons = s.lessons.filter(x => x.subjectId !== id);
    s.grades = s.grades.filter(x => x.subjectId !== id);
    delete s.termMarks[id]; delete s.goals[id];
    for (const d of Object.keys(s.changes)) { for (const k of Object.keys(s.changes[d])) if (s.changes[d][k] === id) delete s.changes[d][k]; if (!Object.keys(s.changes[d]).length) delete s.changes[d]; }
    for (const k of ['tasks', 'events', 'exams', 'projects', 'notes', 'decks', 'sessions']) s[k].forEach(x => { if (x.subjectId === id) x.subjectId = ''; });
  });
  toastUndo(t('Subject deleted'));
}
ACT['new-subject'] = () => openSubjectModal();
ACT['edit-subject'] = el => { const s = subjectOf(el.dataset.id); if (s) openSubjectModal(s); };
ACT['subject-menu'] = el => openMenu(el, [
  { icon: 'edit', label: t('Edit'), fn: () => openSubjectModal(subjectOf(el.dataset.id)) },
  { icon: 'exam', label: t('New exam'), fn: () => openExamModal(null, { subjectId: el.dataset.id }) },
  '-',
  { icon: 'trash', label: t('Delete subject'), danger: true, fn: () => { deleteSubject(el.dataset.id); go('subjects'); } },
]);
ACT['focus-subject'] = el => { Timer.start({ mode: 'focus', taskId: '', subjectId: el.dataset.id }); go('focus'); };
ACT['add-lesson'] = el => openLessonModal({ subjectId: el.dataset.subject }, +el.dataset.day || 0);

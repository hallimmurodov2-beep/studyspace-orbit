'use strict';
/* ───────────── Exams: countdowns, topic confidence, revision plans ───────────── */

const CONF = ['Not started', 'Shaky', 'Getting there', 'Solid'];

function examCard(e) {
  const today = todayStr(), d = diffDays(e.date, today), r = examReadiness(e), c = subjColor(e.subjectId);
  const past = d < 0;
  const linked = state.tasks.filter(x => x.examId === e.id);
  const openLinked = linked.filter(isOpen).length;
  return html`<section class="card exam ${past ? 'past' : ''}" data-key="exam-${e.id}" style="--c:${c}">
    <div class="exam-main">
      <div class="countdown big ${!past && d <= 3 ? 'hot' : ''}"><b class="num">${past ? icon('check', 26) : d}</b><span>${past ? t('done') : d === 0 ? t('today') : tn(d, 'day', 'days')}</span></div>
      <div class="grow">
        <div class="row wrap" style="gap:8px"><h2 class="h2">${e.title}</h2>${subjChip(e.subjectId)}</div>
        <div class="small muted" style="margin-top:3px">${fmtDate(e.date, 'long')}${e.time ? ` · ${e.time}` : ''}${e.room ? ` · ${e.room}` : ''}</div>
        ${e.notes ? html`<div class="small faint" style="margin-top:4px;white-space:pre-wrap">${e.notes}</div>` : ''}
        ${r != null ? html`<div class="row" style="margin-top:10px;gap:10px"><div class="bar grow"><i style="width:${r}%"></i></div><span class="small num" style="font-weight:650">${r}%</span><span class="tiny faint hide-m">${t('ready')}</span></div>` : ''}
      </div>
      <button class="btn icon sm ghost" data-act="exam-menu" data-id="${e.id}">${icon('more', 16)}</button>
    </div>
    <div class="exam-topics">
      <div class="eyebrow">${t('Topics')}${e.topics.length ? html` · <span style="letter-spacing:0;text-transform:none;font-weight:500">${t('tap the bars to rate your confidence')}</span>` : ''}</div>
      ${e.topics.map(tp => html`<div class="topic" data-key="tp-${tp.id}">
        <button class="conf c${tp.conf || 0}" data-act="topic-conf" data-id="${e.id}" data-t="${tp.id}" title="${t(CONF[tp.conf || 0])}"><i></i><i></i><i></i></button>
        <input class="input bare" value="${tp.title}" data-change="topic-title" data-id="${e.id}" data-t="${tp.id}">
        <span class="tiny faint hide-m">${t(CONF[tp.conf || 0])}</span>
        <button class="btn icon sm ghost" data-act="del-topic" data-id="${e.id}" data-t="${tp.id}">${icon('x', 13)}</button>
      </div>`)}
      <form class="topic" data-submit="add-topic" data-id="${e.id}">${icon('plus', 15, 'faint')}<input class="input bare" name="title" placeholder="${t('Add a topic to revise…')}" autocomplete="off"></form>
    </div>
    ${past ? html`<div class="exam-foot"><span class="small muted grow">${t('How did it go?')}</span><button class="btn sm soft" data-act="exam-result" data-id="${e.id}">${icon('star', 14)}${t('Record the result')}</button></div>`
      : html`<div class="exam-foot">
        <span class="small muted grow">${linked.length ? t('{a} revision tasks · {b} still open', { a: linked.length, b: openLinked }) : e.topics.length ? t('Turn the topics into a day-by-day revision plan.') : t('Add topics, then let Studyspace spread them out before the exam.')}</span>
        ${e.topics.length ? html`<button class="btn sm ${linked.length ? '' : 'primary'}" data-act="exam-plan" data-id="${e.id}">${icon('sparkles', 14)}${linked.length ? t('Update plan') : t('Build revision plan')}</button>` : ''}
      </div>`}
  </section>`;
}

VIEWS.exams = {
  title: 'Exams', icon: 'exam',
  render() {
    const today = todayStr();
    const up = upcomingExams();
    const past = state.exams.filter(e => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
    return html`
    <div class="page-head">
      <div><h1 class="h1">${t('Exams')}</h1><div class="sub">${up.length ? t('Next: {title} — {when}.', { title: up[0].title, when: daysAway(diffDays(up[0].date, today)) }) : t('No exams on the horizon.')}</div></div>
      <button class="btn primary" data-act="new-exam">${icon('plus', 16)}${t('New exam')}</button>
    </div>
    ${up.length ? html`<div class="col" style="gap:16px">${up.map(examCard)}</div>`
      : html`<div class="card">${emptyState('exam', t('Nothing scheduled'), t('Add an exam with its topics and you get a countdown, a readiness score and a revision plan.'), html`<button class="btn primary" data-act="new-exam">${icon('plus', 16)}${t('New exam')}</button>`)}</div>`}
    ${past.length ? html`<button class="group-head" data-act="toggle-past" style="margin-top:26px;width:100%"><span>${t('Past exams')}</span><small>${past.length} ${icon(ui.exams.past ? 'up' : 'down', 13, 'inl')}</small></button>
      ${ui.exams.past ? html`<div class="col" style="gap:16px">${past.map(examCard)}</div>` : ''}` : ''}`;
  },
};

function openExamModal(exam, pre = {}) {
  const e = exam || { title: '', subjectId: pre.subjectId || '', date: addDays(todayStr(), 7), time: '', room: '', notes: '' };
  openModal({
    title: exam ? t('Edit exam') : t('New exam'),
    body: html`
      <label class="field"><span>${t('Title')}</span><input class="input" name="title" value="${e.title}" required placeholder="${t('e.g. Quadratic equations test')}" autofocus></label>
      <div class="form-grid">
        <label class="field"><span>${t('Subject')}</span><select class="select" name="subjectId">${subjectOptions(e.subjectId)}</select></label>
        <label class="field"><span>${t('Date')}</span><input type="date" class="input" name="date" value="${e.date}" required></label>
        <label class="field"><span>${t('Time (optional)')}</span><input type="time" class="input" name="time" value="${e.time || ''}"></label>
        <label class="field"><span>${t('Room (optional)')}</span><input class="input" name="room" value="${e.room || ''}"></label>
      </div>
      ${exam ? '' : html`<label class="field"><span>${t('Topics — one per line')}</span><textarea class="input" name="topics" rows="4" placeholder="${t('Factoring\nQuadratic formula\nWord problems')}"></textarea></label>`}
      <label class="field"><span>${t('Notes')}</span><textarea class="input" name="notes" rows="2">${e.notes || ''}</textarea></label>`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${exam ? t('Save') : t('Add exam')}</button>`,
    onSubmit: d => {
      if (!d.title.trim() || !isYmd(d.date)) return false;
      const data = { title: d.title.trim(), subjectId: d.subjectId, date: d.date, time: isTime(d.time) ? d.time : '', room: d.room.trim(), notes: d.notes };
      if (exam) commit(s => { Object.assign(byId(s.exams, exam.id), data); });
      else {
        const topics = (d.topics || '').split('\n').map(x => x.trim()).filter(Boolean).map(title => ({ id: uid(), title, conf: 0 }));
        commit(s => { s.exams.push({ id: uid(), ...data, topics }); });
        if (route.view !== 'exams') go('exams');
      }
    },
  });
}

/* spread the weakest topics first, finish with a full review the day before */
function buildRevisionPlan(exam) {
  const today = todayStr(), D = diffDays(exam.date, today);
  const existing = state.tasks.filter(x => x.examId === exam.id && isOpen(x));
  const todo = exam.topics.filter(tp => (tp.conf || 0) < 3 && !existing.some(x => x.topicId === tp.id)).sort((a, b) => (a.conf || 0) - (b.conf || 0));
  const lastDay = Math.max(0, D - 1);
  const tasks = todo.map((tp, i) => newTask({
    title: `${t('Revise')}: ${tp.title}`, subjectId: exam.subjectId, examId: exam.id, topicId: tp.id,
    due: addDays(today, Math.min(lastDay, Math.round((i + 1) * lastDay / (todo.length + 1)))), est: 30, priority: (tp.conf || 0) === 0 ? 2 : 1,
  }));
  if (D >= 2 && !existing.some(x => x.topicId === 'review') && !state.tasks.some(x => x.examId === exam.id && x.topicId === 'review'))
    tasks.push(newTask({ title: `${t('Full review')}: ${exam.title}`, subjectId: exam.subjectId, examId: exam.id, topicId: 'review', due: addDays(exam.date, -1), est: 45, priority: 3 }));
  return tasks;
}
ACT['new-exam'] = () => openExamModal();
ACT['toggle-past'] = () => setUI(u => { u.exams.past = !u.exams.past; });
ACT['exam-plan'] = el => {
  const exam = byId(state.exams, el.dataset.id); if (!exam) return;
  const tasks = buildRevisionPlan(exam);
  if (!tasks.length) { toast(t('The plan is already up to date.')); return; }
  commit(s => { s.tasks.push(...tasks); });
  toast(t('{n} added, spread out before the exam', { n: nt(tasks.length, 'revision task', 'revision tasks') }), { action: t('Auto-plan'), onAction: () => { go('calendar'); openAutoPlan(); } });
};
ACT['exam-menu'] = el => {
  const exam = byId(state.exams, el.dataset.id); if (!exam) return;
  openMenu(el, [
    { icon: 'edit', label: t('Edit'), fn: () => openExamModal(exam) },
    { icon: 'tasks', label: t('Show revision tasks'), fn: () => { ui.tasks.filter = exam.subjectId ? 'subject:' + exam.subjectId : 'all'; go('tasks'); } },
    '-',
    { icon: 'trash', label: t('Delete exam'), danger: true, fn: () => { commit(s => { s.exams = s.exams.filter(x => x.id !== exam.id); s.tasks.forEach(x => { if (x.examId === exam.id) x.examId = ''; }); }); toastUndo(t('Exam deleted')); } },
  ]);
};
ACT['exam-result'] = el => { const exam = byId(state.exams, el.dataset.id); if (exam) openGradeModal(null, { subjectId: exam.subjectId, title: exam.title, kind: 'exam', date: exam.date, weight: 2 }); };
const mutExam = (id, fn) => commit(s => { const e = byId(s.exams, id); if (e) fn(e); });
ACT['topic-conf'] = el => mutExam(el.dataset.id, e => { const tp = byId(e.topics, el.dataset.t); if (tp) tp.conf = ((tp.conf || 0) + 1) % 4; });
ACT['del-topic'] = el => mutExam(el.dataset.id, e => { e.topics = e.topics.filter(x => x.id !== el.dataset.t); });
ON.change['topic-title'] = el => mutExam(el.dataset.id, e => { const tp = byId(e.topics, el.dataset.t); if (tp && el.value.trim()) tp.title = el.value.trim(); });
ON.submit['add-topic'] = (form, ev) => { ev.preventDefault(); const inp = form.querySelector('input'), v = inp.value.trim(); if (!v) return; mutExam(form.dataset.id, e => { e.topics.push({ id: uid(), title: v, conf: 0 }); }); inp.value = ''; };

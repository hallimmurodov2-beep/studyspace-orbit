'use strict';
/* ───────────── Tasks: list, board, projects, detail drawer ───────────── */

function taskRow(task, opts = {}) {
  const done = task.status === 'done';
  const stepsDone = task.steps.filter(s => s.done).length;
  const proj = byId(state.projects, task.projectId);
  return html`<div class="task ${done ? 'done' : ''} ${ui.taskOpen === task.id ? 'sel' : ''}" data-key="t-${task.id}" data-act="open-task" data-id="${task.id}">
    <button class="check p${task.priority} ${done ? 'done' : ''}" data-act="toggle-task" data-id="${task.id}" aria-label="${done ? t('Mark as not done') : t('Mark as done')}">${icon('check', 13)}</button>
    <div class="grow">
      <div class="task-title trunc">${task.title}</div>
      <div class="task-meta">
        ${opts.noSubject ? '' : subjChip(task.subjectId)}
        ${dueChip(task)}
        ${task.status === 'doing' ? html`<span class="chip accent">${t('In progress')}</span>` : ''}
        ${task.est ? html`<span class="meta">${icon('clock', 12)}${fmtDur(task.est)}</span>` : ''}
        ${task.steps.length ? html`<span class="meta">${icon('list', 12)}${stepsDone}/${task.steps.length}</span>` : ''}
        ${task.repeat && task.repeat !== 'none' ? html`<span class="meta">${icon('repeat', 12)}</span>` : ''}
        ${proj && !opts.noProject ? html`<span class="meta">${icon('folder', 12)}<span class="trunc" style="max-width:120px">${proj.title}</span></span>` : ''}
      </div>
    </div>
    ${done ? '' : html`<button class="btn icon sm ghost task-play" data-act="focus-task" data-id="${task.id}" title="${t('Start focus on this')}">${icon('play', 13)}</button>`}
  </div>`;
}

const TASK_FILTERS = [['all', 'All open', 'inbox'], ['today', 'Today', 'sun'], ['week', 'Next 7 days', 'calendar'], ['overdue', 'Overdue', 'alert'], ['done', 'Completed', 'check']];

function filterTasks(f) {
  const today = todayStr(), wk = addDays(today, 7);
  if (f === 'done') return state.tasks.filter(x => x.status === 'done').sort((a, b) => b.doneAt - a.doneAt);
  let list = openTasks();
  if (f === 'today') list = list.filter(x => (x.due && x.due <= today) || x.planned === today);
  else if (f === 'week') list = list.filter(x => (x.due && x.due <= wk) || (x.planned && x.planned <= wk));
  else if (f === 'overdue') list = list.filter(x => x.due && x.due < today);
  else if (f.startsWith('subject:')) list = list.filter(x => x.subjectId === f.slice(8));
  else if (f.startsWith('project:')) list = state.tasks.filter(x => x.projectId === f.slice(8));
  return list;
}
function sortTasks(list) {
  return list.slice().sort((a, b) => (a.status === 'done') - (b.status === 'done') || (b.priority - a.priority) || (a.due || '9999').localeCompare(b.due || '9999') || a.createdAt - b.createdAt);
}
function groupTasks(list, mode) {
  const today = todayStr();
  const groups = [];
  const add = (key, label, items, cls = '') => { if (items.length) groups.push({ key, label, items: sortTasks(items), cls }); };
  if (mode === 'subject') {
    for (const s of state.subjects) add(s.id, s.name, list.filter(x => x.subjectId === s.id));
    add('none', t('No subject'), list.filter(x => !subjectOf(x.subjectId)));
  } else if (mode === 'priority') {
    for (const p of [3, 2, 1]) add('p' + p, t(PRIORITY[p]), list.filter(x => x.priority === p));
    add('p0', t('No priority'), list.filter(x => !x.priority));
  } else {
    const end = addDays(today, 7);
    add('over', t('Overdue'), list.filter(x => x.due && x.due < today), 'danger');
    add('today', t('Today'), list.filter(x => x.due === today));
    add('tom', t('Tomorrow'), list.filter(x => x.due === addDays(today, 1)));
    add('week', t('This week'), list.filter(x => x.due > addDays(today, 1) && x.due <= end));
    add('later', t('Later'), list.filter(x => x.due > end));
    add('none', t('No date'), list.filter(x => !x.due));
  }
  return groups;
}

function projectProgress(p) {
  const ts = state.tasks.filter(x => x.projectId === p.id);
  const total = ts.length + p.milestones.length;
  const done = ts.filter(x => x.status === 'done').length + p.milestones.filter(m => m.done).length;
  return { total, done, pct: total ? done / total : 0 };
}

function tasksRail(f) {
  const today = todayStr();
  const counts = { all: openTasks().length, today: filterTasks('today').length, week: filterTasks('week').length, overdue: filterTasks('overdue').length };
  const activeProjects = state.projects.filter(p => p.status !== 'archived');
  return html`<aside class="rail">
    ${TASK_FILTERS.map(([k, label, ic]) => html`<button class="rail-item ${f === k ? 'on' : ''}" data-act="task-filter" data-f="${k}">${icon(ic, 16)}<span class="grow trunc">${t(label)}</span>${counts[k] ? html`<small class="${k === 'overdue' ? 'hot' : ''}">${counts[k]}</small>` : ''}</button>`)}
    <div class="rail-label">${t('Projects')}<button class="btn icon sm ghost" data-act="new-project" title="${t('New project')}">${icon('plus', 14)}</button></div>
    ${activeProjects.map(p => { const pr = projectProgress(p); return html`<button class="rail-item ${f === 'project:' + p.id ? 'on' : ''}" data-act="task-filter" data-f="project:${p.id}"><i class="dot" style="--c:${p.color || subjColor(p.subjectId)}"></i><span class="grow trunc">${p.title}</span><small>${Math.round(pr.pct * 100)}%</small></button>`; })}
    ${activeProjects.length ? '' : html`<div class="tiny faint" style="padding:2px 10px 8px">${t('Group big assignments into projects.')}</div>`}
    <div class="rail-label">${t('Subjects')}</div>
    ${state.subjects.map(s => { const n = openTasks().filter(x => x.subjectId === s.id).length; return html`<button class="rail-item ${f === 'subject:' + s.id ? 'on' : ''}" data-act="task-filter" data-f="subject:${s.id}"><i class="dot" style="--c:${s.color}"></i><span class="grow trunc">${s.name}</span>${n ? html`<small>${n}</small>` : ''}</button>`; })}
  </aside>`;
}

function projectHeader(p) {
  const pr = projectProgress(p);
  const d = p.due ? diffDays(p.due, todayStr()) : null;
  return html`<section class="card pad project-head" style="--c:${p.color || subjColor(p.subjectId)}">
    <div class="row" style="gap:16px;align-items:flex-start">
      ${ring(pr.pct, 68, 7, 'var(--c)', html`<b class="num small">${Math.round(pr.pct * 100)}%</b>`)}
      <div class="grow">
        <div class="row wrap" style="gap:8px"><h2 class="h2">${p.title}</h2>${p.status === 'done' ? html`<span class="chip ok">${t('Completed')}</span>` : ''}${subjChip(p.subjectId)}${d != null ? html`<span class="chip ${d < 0 ? 'danger' : d <= 3 ? 'warn' : ''}">${icon('calendar', 12)}${relDay(p.due)}</span>` : ''}</div>
        ${p.notes ? html`<p class="small muted" style="margin-top:6px;white-space:pre-wrap">${p.notes}</p>` : ''}
        <div class="small faint" style="margin-top:6px">${t('{a} of {b} done', { a: pr.done, b: pr.total })}</div>
      </div>
      <button class="btn icon sm ghost" data-act="project-menu" data-id="${p.id}">${icon('more', 16)}</button>
    </div>
    <div class="milestones">
      <div class="eyebrow" style="margin:14px 0 6px">${t('Milestones')}</div>
      ${p.milestones.map(m => html`<div class="step" data-key="ms-${m.id}">
        <button class="check sq ${m.done ? 'done' : ''}" data-act="toggle-milestone" data-id="${p.id}" data-m="${m.id}">${icon('check', 12)}</button>
        <input class="input bare ${m.done ? 'struck' : ''}" value="${m.title}" data-change="milestone-title" data-id="${p.id}" data-m="${m.id}">
        <button class="btn icon sm ghost" data-act="del-milestone" data-id="${p.id}" data-m="${m.id}">${icon('x', 13)}</button>
      </div>`)}
      <form class="step" data-submit="add-milestone" data-id="${p.id}">${icon('plus', 15, 'faint')}<input class="input bare" name="title" placeholder="${t('Add a milestone…')}" autocomplete="off"></form>
    </div>
  </section>`;
}

function taskBoard(list) {
  const cols = [['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']];
  return html`<div class="kanban">${cols.map(([st, label]) => {
    const items = st === 'done' ? state.tasks.filter(x => x.status === 'done' && (ui.tasks.filter.startsWith('project:') ? x.projectId === ui.tasks.filter.slice(8) : ui.tasks.filter.startsWith('subject:') ? x.subjectId === ui.tasks.filter.slice(8) : true)).sort((a, b) => b.doneAt - a.doneAt).slice(0, 15)
      : sortTasks(list.filter(x => x.status === st));
    return html`<div class="kan-col" data-status="${st}">
      <div class="kan-head"><span>${t(label)}</span><small>${items.length}</small></div>
      <div class="kan-list">${items.map(x => html`<div class="kan-card ${x.status === 'done' ? 'done' : ''}" draggable="true" data-key="k-${x.id}" data-id="${x.id}" data-act="open-task" style="--c:${subjColor(x.subjectId)}">
        <div class="kan-title">${x.title}</div>
        <div class="task-meta">${subjChip(x.subjectId)}${dueChip(x)}${x.priority ? html`<span class="meta" style="color:${['', '#3d8bff', '#f2a52f', '#ff5d5d'][x.priority]}">${icon('flag', 12)}</span>` : ''}${x.est ? html`<span class="meta">${fmtDur(x.est)}</span>` : ''}</div>
      </div>`)}
      ${items.length ? '' : html`<div class="kan-empty">${t('Drop tasks here')}</div>`}</div>
    </div>`; })}</div>`;
}

VIEWS.tasks = {
  title: 'Tasks', icon: 'tasks',
  render(arg) {
    if (arg && arg !== ui.tasks._arg) { ui.tasks._arg = arg; if (arg.startsWith('project/')) ui.tasks.filter = 'project:' + arg.slice(8); else if (arg.startsWith('subject/')) ui.tasks.filter = 'subject:' + arg.slice(8); }
    let f = ui.tasks.filter;
    if (f.startsWith('project:') && !byId(state.projects, f.slice(8))) f = ui.tasks.filter = 'all';
    if (f.startsWith('subject:') && !subjectOf(f.slice(8))) f = ui.tasks.filter = 'all';
    const list = filterTasks(f);
    const project = f.startsWith('project:') ? byId(state.projects, f.slice(8)) : null;
    const subject = f.startsWith('subject:') ? subjectOf(f.slice(8)) : null;
    const title = project ? project.title : subject ? subject.name : t((TASK_FILTERS.find(x => x[0] === f) || TASK_FILTERS[0])[1]);
    const board = ui.tasks.layout === 'board' && f !== 'done';
    const openList = project ? list.filter(isOpen) : list;
    const groups = f === 'done' ? [{ key: 'done', label: t('Completed'), items: list.slice(0, 100) }] : groupTasks(openList, ui.tasks.group);
    const doneInProject = project ? list.filter(x => x.status === 'done') : [];
    const totalEst = sum(openList.filter(isOpen), x => x.est);
    const defaults = project ? { project: project.id, subject: project.subjectId || '' } : subject ? { subject: subject.id } : f === 'today' ? { due: todayStr() } : {};

    return html`
    <div class="page-head">
      <div><h1 class="h1">${t('Tasks')}</h1><div class="sub">${f === 'done' ? nt(list.length, 'task completed', 'tasks completed') : html`${nt(openList.filter(isOpen).length, 'open task', 'open tasks')}${totalEst ? html` · ${t('about {n} of work', { n: fmtDur(totalEst) })}` : ''}`}</div></div>
      <div class="row wrap">
        ${f === 'done' ? '' : html`<div class="seg">${[['date', 'Date'], ['subject', 'Subject'], ['priority', 'Priority']].map(([k, l]) => html`<button class="${ui.tasks.group === k && !board ? 'on' : ''}" data-act="task-group" data-g="${k}">${t(l)}</button>`)}</div>
        <div class="seg"><button class="${board ? '' : 'on'}" data-act="task-layout" data-l="list" title="${t('List')}">${icon('list', 15)}</button><button class="${board ? 'on' : ''}" data-act="task-layout" data-l="board" title="${t('Board')}">${icon('board', 15)}</button></div>`}
      </div>
    </div>
    <div class="tasks-layout">
      ${tasksRail(f)}
      <div class="col" style="gap:16px;min-width:0">
        <div class="chips-scroll only-m">${TASK_FILTERS.map(([k, label]) => html`<button class="chip ${f === k ? 'on' : ''}" data-act="task-filter" data-f="${k}">${t(label)}</button>`)}${state.projects.filter(p => p.status !== 'archived').map(p => html`<button class="chip ${f === 'project:' + p.id ? 'on' : ''}" data-act="task-filter" data-f="project:${p.id}">${icon('folder', 12)}${p.title}</button>`)}${state.subjects.map(s => html`<button class="chip ${f === 'subject:' + s.id ? 'on' : ''}" data-act="task-filter" data-f="subject:${s.id}">${s.name}</button>`)}</div>
        ${project ? projectHeader(project) : ''}
        ${f === 'done' ? '' : html`<div>
          <form class="quick" data-submit="inline-add" data-input="quick-parse" data-due="${defaults.due || ''}" data-subject="${defaults.subject || ''}" data-project="${defaults.project || ''}">${icon('plus', 18)}<input name="q" autocomplete="off" placeholder="${project || subject ? t('Add a task to {name}…', { name: title }) : t('Add a task — try “Essay draft fri 1h !!”')}"><kbd class="hide-m">Enter</kbd></form>
          <div class="parsed" id="inline-parsed" data-keep></div>
        </div>`}
        ${board ? taskBoard(openList) : groups.length ? groups.map(g => html`
          <section data-key="g-${g.key}">
            <div class="group-head ${g.cls}"><span>${g.label}</span><small>${g.items.length}${sum(g.items, x => x.est) && f !== 'done' ? ` · ${fmtDur(sum(g.items, x => x.est))}` : ''}</small></div>
            <div class="card tasklist framed">${g.items.map(x => taskRow(x, { noProject: !!project, noSubject: !!subject || ui.tasks.group === 'subject' }))}</div>
          </section>`)
          : html`<div class="card">${emptyState(f === 'done' ? 'check' : 'tasks', f === 'overdue' ? t('Nothing overdue') : f === 'done' ? t('Nothing completed yet') : t('No tasks here'), f === 'overdue' ? t('You are on top of everything.') : f === 'done' ? t('Finished tasks will collect here.') : t('Type a task above — dates, durations and priority are understood automatically.'))}</div>`}
        ${doneInProject.length && !board ? html`<section><div class="group-head"><span>${t('Completed')}</span><small>${doneInProject.length}</small></div><div class="card tasklist framed">${doneInProject.map(x => taskRow(x, { noProject: true }))}</div></section>` : ''}
      </div>
    </div>`;
  },
};

/* ── task detail drawer (available from every view) ── */
function taskDrawer(task) {
  const logged = taskLogged(task.id);
  const today = todayStr();
  const seg = (field, opts, cur) => html`<div class="seg">${opts.map(([v, l, c]) => html`<button type="button" class="${String(cur) === String(v) ? 'on' : ''}" data-act="task-set" data-f="${field}" data-v="${v}" ${c ? raw(`style="--pc:${c}"`) : ''}>${c ? html`<i class="dot" style="--c:${c}"></i>` : ''}${t(l)}</button>`)}</div>`;
  return html`<div class="drawer-scrim" data-act="close-task"></div>
  <aside class="drawer" id="drawer" data-key="drawer-${task.id}">
    <div class="drawer-head">
      <button class="check p${task.priority} ${task.status === 'done' ? 'done' : ''}" data-act="toggle-task" data-id="${task.id}">${icon('check', 13)}</button>
      <span class="eyebrow grow">${task.status === 'done' ? t('Completed') : t('Task')}</span>
      <button class="btn icon sm ghost" data-act="task-menu" data-id="${task.id}">${icon('more', 16)}</button>
      <button class="btn icon sm ghost" data-act="close-task" aria-label="${t('Close')}">${icon('x', 16)}</button>
    </div>
    <div class="drawer-body">
      <textarea class="input bare drawer-title" rows="1" data-change="task-field" data-input="autogrow" data-f="title" placeholder="${t('Task title')}">${task.title}</textarea>
      ${seg('status', [['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']], task.status)}
      <div class="form-grid">
        <label class="field"><span>${t('Subject')}</span><select class="select" data-change="task-field" data-f="subjectId">${subjectOptions(task.subjectId)}</select></label>
        <label class="field"><span>${t('Project')}</span><select class="select" data-change="task-field" data-f="projectId"><option value="">${t('None')}</option>${state.projects.filter(p => p.status !== 'archived' || p.id === task.projectId).map(p => html`<option value="${p.id}" ${p.id === task.projectId ? raw('selected') : ''}>${p.title}</option>`)}</select></label>
        <label class="field"><span>${t('Due date')}</span><input type="date" class="input" value="${task.due}" data-change="task-field" data-f="due"></label>
        <label class="field"><span>${t('Do it on')}</span><input type="date" class="input" value="${task.planned}" data-change="task-field" data-f="planned"></label>
      </div>
      <div class="row wrap" style="gap:6px;margin-top:-4px">
        ${[[t('Today'), today], [t('Tomorrow'), addDays(today, 1)], ...(nextLessonDate(task.subjectId) ? [[t('Next class'), nextLessonDate(task.subjectId)]] : []), [t('Next week'), addDays(weekStart(today), 7)], [t('No date'), '']].map(([l, v]) => html`<button class="chip ${task.due === v ? 'on' : ''}" data-act="task-set" data-f="due" data-v="${v}">${l}</button>`)}
      </div>
      <div class="field"><span>${t('Priority')}</span>${seg('priority', [[0, 'None'], [1, 'Low', '#3d8bff'], [2, 'Medium', '#f2a52f'], [3, 'High', '#ff5d5d']], task.priority)}</div>
      <div class="form-grid">
        <label class="field"><span>${t('Estimate (min)')}</span><input type="number" min="0" max="600" step="5" class="input" value="${task.est || ''}" placeholder="—" data-change="task-field" data-f="est"></label>
        <label class="field"><span>${t('Repeat')}</span><select class="select" data-change="task-field" data-f="repeat">${options(Object.entries(REPEAT_LABEL).map(([k, l]) => [k, t(l)]), task.repeat || 'none')}</select></label>
      </div>
      ${task.est || logged ? html`<div><div class="spread small muted"><span>${t('Focus logged')}</span><span class="num">${fmtDur(logged)}${task.est ? ` / ${fmtDur(task.est)}` : ''}</span></div>${task.est ? html`<div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, Math.round(logged / task.est * 100))}%"></i></div>` : ''}</div>` : ''}
      <div class="field"><span>${t('Steps')}${task.steps.length ? ` · ${task.steps.filter(s => s.done).length}/${task.steps.length}` : ''}</span>
        <div>
          ${task.steps.map(st => html`<div class="step" data-key="st-${st.id}">
            <button class="check sq ${st.done ? 'done' : ''}" data-act="toggle-step" data-s="${st.id}">${icon('check', 12)}</button>
            <input class="input bare ${st.done ? 'struck' : ''}" value="${st.title}" data-change="step-title" data-s="${st.id}">
            <button class="btn icon sm ghost" data-act="del-step" data-s="${st.id}">${icon('x', 13)}</button>
          </div>`)}
          <form class="step" data-submit="add-step">${icon('plus', 15, 'faint')}<input class="input bare" name="title" placeholder="${t('Add a step…')}" autocomplete="off"></form>
        </div>
      </div>
      <label class="field"><span>${t('Notes')}</span><textarea class="input" rows="4" data-change="task-field" data-f="notes" placeholder="${t('Details, links, page numbers…')}">${task.notes}</textarea></label>
    </div>
    <div class="drawer-foot">
      ${task.status === 'done' ? '' : html`<button class="btn primary grow" data-act="focus-task" data-id="${task.id}">${icon('play', 14)}${t('Start focus')}</button>
      <button class="btn" data-act="schedule-task" data-id="${task.id}">${icon('calendar', 15)}${t('Schedule|button')}</button>`}
      <button class="btn icon danger ${task.status === 'done' ? '' : ''}" data-act="del-task" data-id="${task.id}" title="${t('Delete')}">${icon('trash', 16)}</button>
    </div>
  </aside>`;
}

const mutTask = (fn, opts) => commit(s => { const task = byId(s.tasks, ui.taskOpen); if (task) fn(task, s); }, opts);

ACT['open-task'] = (el, e) => { if (e.target.closest('input,textarea,select')) return; setUI(u => { u.taskOpen = u.taskOpen === el.dataset.id ? '' : el.dataset.id; }); };
ACT['close-task'] = () => setUI(u => { u.taskOpen = ''; });
ACT['toggle-task'] = el => {
  const task = byId(state.tasks, el.dataset.id); if (!task) return;
  const toDone = task.status !== 'done';
  toggleTask(task.id);
  if (toDone) {
    Sound.tick();
    const today = todayStr();
    const left = openTasks().filter(x => x.due && x.due <= today).length;
    if (!left && task.due && task.due <= today) { confetti(); toast(t('Everything due today is done. Nice.')); }
    else toastUndo(task.repeat !== 'none' ? t('Done — next one scheduled') : t('Task completed'));
  }
};
ACT['task-filter'] = el => { ui.tasks._arg = ''; ui.tasks.filter = el.dataset.f; if (route.arg) go('tasks'); else requestRender(); };
ACT['task-group'] = el => setUI(u => { u.tasks.group = el.dataset.g; u.tasks.layout = 'list'; });
ACT['task-layout'] = el => setUI(u => { u.tasks.layout = el.dataset.l; });
ACT['task-set'] = el => {
  const f = el.dataset.f; let v = el.dataset.v;
  if (f === 'priority') v = +v;
  if (f === 'status') { const task = byId(state.tasks, ui.taskOpen); if (v === 'done' && task.status !== 'done') { toggleTask(task.id, true); Sound.tick(); return; } if (v !== 'done' && task.status === 'done') { commit(s => { const x = byId(s.tasks, task.id); x.status = v; x.doneAt = 0; }); return; } }
  mutTask(task => { task[f] = v; });
};
ON.change['task-field'] = el => {
  const f = el.dataset.f; let v = el.value;
  if (f === 'est') v = clamp(Math.round(+v || 0), 0, 600);
  if (f === 'title') { v = v.replace(/\n/g, ' ').trim(); if (!v) { requestRender(); return; } }
  mutTask(task => { task[f] = v; });
};
ON.input.autogrow = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
ON.keydown = ON.keydown || {};
ACT['toggle-step'] = el => mutTask(task => { const st = byId(task.steps, el.dataset.s); if (st) st.done = !st.done; });
ACT['del-step'] = el => mutTask(task => { task.steps = task.steps.filter(s => s.id !== el.dataset.s); });
ON.change['step-title'] = el => mutTask(task => { const st = byId(task.steps, el.dataset.s); if (st && el.value.trim()) st.title = el.value.trim(); });
ON.submit['add-step'] = (form, e) => { e.preventDefault(); const inp = form.querySelector('input'), v = inp.value.trim(); if (!v) return; mutTask(task => { task.steps.push({ id: uid(), title: v, done: false }); }); inp.value = ''; };
ACT['del-task'] = el => {
  const id = el.dataset.id;
  commit(s => { s.tasks = s.tasks.filter(x => x.id !== id); s.events.forEach(ev => { if (ev.taskId === id) ev.taskId = ''; }); });
  ui.taskOpen = '';
  toastUndo(t('Task deleted'));
};
ACT['task-menu'] = el => {
  const task = byId(state.tasks, el.dataset.id); if (!task) return;
  openMenu(el, [
    { icon: 'layers', label: t('Duplicate'), fn: () => { const copy = newTask({ ...task, id: uid(), title: task.title + ' ' + t('(copy)'), status: 'todo', doneAt: 0, createdAt: Date.now(), steps: task.steps.map(s => ({ ...s, id: uid(), done: false })) }); commit(s => { s.tasks.push(copy); }); ui.taskOpen = copy.id; } },
    { icon: 'calendar', label: t('Move to tomorrow'), fn: () => mutTask(x => { x.due = addDays(todayStr(), 1); }) },
    { icon: 'cards', label: t('Log time manually'), fn: () => openLogModal({ taskId: task.id, subjectId: task.subjectId }) },
    '-',
    { icon: 'trash', label: t('Delete'), danger: true, fn: () => ACT['del-task'](el) },
  ]);
};
ACT['schedule-task'] = el => { const task = byId(state.tasks, el.dataset.id); if (task) openEventModal({ taskId: task.id, title: task.title, subjectId: task.subjectId, date: task.planned || (task.due && task.due >= todayStr() ? task.due : todayStr()), minutes: task.est || 45 }); };
ON.input['quick-parse'] = form => {
  const box = $('#inline-parsed'); if (!box) return;
  const v = form.querySelector('input').value;
  box.innerHTML = v.trim() ? parsedChips(parseQuick(v)).map(String).join('') : '';
};
document.addEventListener('submit', e => { if (e.target.matches && e.target.matches('form.quick')) { const box = $('#inline-parsed'); if (box) setTimeout(() => { box.innerHTML = ''; }, 0); } });

/* ── projects ── */
function openProjectModal(p) {
  const isNew = !p;
  p = p || { title: '', subjectId: '', due: '', notes: '', color: '' };
  openModal({
    title: isNew ? t('New project') : t('Edit project'),
    body: html`
      <label class="field"><span>${t('Name')}</span><input class="input" name="title" value="${p.title}" required placeholder="${t('e.g. History research paper')}" autofocus></label>
      <div class="form-grid">
        <label class="field"><span>${t('Subject')}</span><select class="select" name="subjectId">${subjectOptions(p.subjectId)}</select></label>
        <label class="field"><span>${t('Deadline')}</span><input type="date" class="input" name="due" value="${p.due}"></label>
      </div>
      <label class="field"><span>${t('Description')}</span><textarea class="input" name="notes" rows="3">${p.notes}</textarea></label>`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${isNew ? t('Create project') : t('Save')}</button>`,
    onSubmit: d => {
      if (!d.title.trim()) return false;
      if (isNew) {
        const np = { id: uid(), title: d.title.trim(), subjectId: d.subjectId, due: d.due, notes: d.notes, color: '', status: 'active', milestones: [], createdAt: Date.now() };
        commit(s => { s.projects.push(np); });
        ui.tasks.filter = 'project:' + np.id; go('tasks');
      } else commit(s => { Object.assign(byId(s.projects, p.id), { title: d.title.trim(), subjectId: d.subjectId, due: d.due, notes: d.notes }); });
    },
  });
}
ACT['new-project'] = () => openProjectModal();
ACT['project-menu'] = el => {
  const p = byId(state.projects, el.dataset.id); if (!p) return;
  openMenu(el, [
    { icon: 'edit', label: t('Edit'), fn: () => openProjectModal(p) },
    { icon: 'check', label: p.status === 'done' ? t('Reopen project') : t('Mark as completed'), fn: () => commit(s => { const x = byId(s.projects, p.id); x.status = x.status === 'done' ? 'active' : 'done'; }) },
    { icon: 'inbox', label: t('Archive'), fn: () => { commit(s => { byId(s.projects, p.id).status = 'archived'; }); ui.tasks.filter = 'all'; toastUndo(t('Project archived')); } },
    '-',
    { icon: 'trash', label: t('Delete project'), danger: true, fn: () => { commit(s => { s.projects = s.projects.filter(x => x.id !== p.id); s.tasks.forEach(x => { if (x.projectId === p.id) x.projectId = ''; }); s.notes.forEach(x => { if (x.projectId === p.id) x.projectId = ''; }); }); ui.tasks.filter = 'all'; toastUndo(t('Project deleted — its tasks were kept')); } },
  ]);
};
const mutProject = (id, fn) => commit(s => { const p = byId(s.projects, id); if (p) fn(p); });
ACT['toggle-milestone'] = el => mutProject(el.dataset.id, p => { const m = byId(p.milestones, el.dataset.m); if (m) m.done = !m.done; });
ACT['del-milestone'] = el => mutProject(el.dataset.id, p => { p.milestones = p.milestones.filter(m => m.id !== el.dataset.m); });
ON.change['milestone-title'] = el => mutProject(el.dataset.id, p => { const m = byId(p.milestones, el.dataset.m); if (m && el.value.trim()) m.title = el.value.trim(); });
ON.submit['add-milestone'] = (form, e) => { e.preventDefault(); const inp = form.querySelector('input'), v = inp.value.trim(); if (!v) return; mutProject(form.dataset.id, p => { p.milestones.push({ id: uid(), title: v, done: false }); }); inp.value = ''; };

/* ── board drag & drop ── */
let _dragTask = '';
document.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('.kan-card'); if (!c) return; _dragTask = c.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', _dragTask); c.classList.add('dragging'); });
document.addEventListener('dragend', e => { const c = e.target.closest && e.target.closest('.kan-card'); if (c) c.classList.remove('dragging'); $$('.kan-col.over').forEach(x => x.classList.remove('over')); _dragTask = ''; });
document.addEventListener('dragover', e => { const col = e.target.closest && e.target.closest('.kan-col'); if (!col || !_dragTask) return; e.preventDefault(); $$('.kan-col.over').forEach(x => x !== col && x.classList.remove('over')); col.classList.add('over'); });
document.addEventListener('drop', e => {
  const col = e.target.closest && e.target.closest('.kan-col'); if (!col || !_dragTask) return;
  e.preventDefault();
  const id = _dragTask, st = col.dataset.status, task = byId(state.tasks, id);
  col.classList.remove('over');
  if (!task || task.status === st) return;
  if (st === 'done') { toggleTask(id, true); Sound.tick(); }
  else commit(s => { const x = byId(s.tasks, id); x.status = st; x.doneAt = 0; });
});

/* ── manual time log ── */
function openLogModal(pre = {}) {
  openModal({
    title: t('Log study time'), cls: 'narrow',
    body: html`
      <div class="form-grid">
        <label class="field"><span>${t('Minutes')}</span><input type="number" class="input" name="min" min="1" max="600" value="${pre.min || 30}" required autofocus></label>
        <label class="field"><span>${t('Date')}</span><input type="date" class="input" name="date" value="${pre.date || todayStr()}" max="${todayStr()}" required></label>
        <label class="field full"><span>${t('Subject')}</span><select class="select" name="subjectId">${subjectOptions(pre.subjectId)}</select></label>
      </div>`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Log time')}</button>`,
    onSubmit: d => {
      const min = clamp(Math.round(+d.min || 0), 1, 600); if (!isYmd(d.date)) return false;
      const at = pd(d.date); at.setHours(16, 0, 0, 0);
      commit(s => { s.sessions.push({ id: uid(), date: d.date, at: at.getTime(), min, subjectId: d.subjectId, taskId: pre.taskId || '', kind: 'manual', rating: 0 }); });
      toastUndo(t('{n} logged', { n: fmtDur(min) }));
    },
  });
}
ACT['log-time'] = () => openLogModal();

'use strict';
/* ───────────── Today: the day at a glance ───────────── */

/* The Day Orbit: a 24-hour dial. Midnight sits at the bottom, noon at the top;
   classes and study blocks are arcs, finished focus time glows on the inner ring. */
function dayOrbit(date) {
  const S = 268, cx = S / 2, cy = S / 2, R = 108, W = 18;
  const ang = m => (m / 1440) * 360 + 180;
  const now = nowMin(), isToday = date === todayStr();
  const agenda = agendaOn(date);
  const arcs = agenda.map(a => {
    const a1 = ang(toMin(a.start)) + 0.7, a2 = Math.max(a1 + 0.6, ang(toMin(a.end)) - 0.7);
    const past = isToday && toMin(a.end) <= now;
    return html`<path d="${arcPath(cx, cy, R, a1, a2)}" stroke="${a.subjectId ? subjColor(a.subjectId) : 'var(--accent)'}" stroke-width="${W}" fill="none" opacity="${past ? 0.38 : a.kind === 'lesson' ? 0.92 : 1}" ${a.kind === 'event' ? raw('stroke-dasharray="2.5 2.5"') : ''}><title>${a.start}–${a.end} ${a.title}</title></path>`;
  });
  const sess = sessionsOn(date).map(s => {
    const d = new Date(s.at), m = d.getHours() * 60 + d.getMinutes();
    return html`<path d="${arcPath(cx, cy, R - 17, ang(m), ang(Math.min(1439, m + s.min)))}" stroke="url(#orbitGrad)" stroke-width="5" stroke-linecap="round" fill="none"/>`;
  });
  const ticks = [];
  for (let h = 0; h < 24; h++) {
    const major = h % 6 === 0;
    const [x1, y1] = polar(cx, cy, R + W / 2 + 5, ang(h * 60)), [x2, y2] = polar(cx, cy, R + W / 2 + (major ? 11 : 8), ang(h * 60));
    ticks.push(html`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--text-3)" stroke-width="${major ? 1.6 : 1}" opacity="${major ? 0.9 : 0.4}" stroke-linecap="round"/>`);
  }
  const labels = [[0, '00'], [360, '06'], [720, '12'], [1080, '18']].map(([m, l]) => { const [x, y] = polar(cx, cy, R - 34, ang(m)); return html`<text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="middle" class="orbit-lbl">${l}</text>`; });
  const [nx, ny] = polar(cx, cy, R, ang(now));
  const d = new Date();
  return html`<div class="orbit">
    <svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="${t('Your day as a 24-hour dial')}">
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="${W}"/>
      <path d="${arcPath(cx, cy, R, ang(22 * 60), ang(24 * 60 + 6.5 * 60))}" stroke="var(--bg)" stroke-width="${W}" fill="none" opacity=".55"/>
      ${ticks}${labels}${arcs}${sess}
      ${isToday ? html`<g class="orbit-now"><circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="13" fill="var(--accent)" opacity=".22"/><circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="6.5" fill="#fff" stroke="var(--accent)" stroke-width="3.5"/></g>` : ''}
    </svg>
    <div class="orbit-center">
      <div class="orbit-time num">${pad(d.getHours())}<i>:</i>${pad(d.getMinutes())}</div>
      <div class="tiny faint">${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
    </div>
  </div>`;
}

function greeting() {
  const h = new Date().getHours();
  const g = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const name = (state.profile.name || '').trim().split(' ')[0];
  return name ? `${t(g)}, ${name}` : t(g);
}
function minsLabel(n) { return n < 60 ? `${n} ${t('min')}` : fmtDur(n); }

function nowPanel(agenda) {
  const now = nowMin();
  const cur = agenda.find(a => toMin(a.start) <= now && now < toMin(a.end));
  const next = agenda.find(a => toMin(a.start) > now);
  if (cur) {
    const left = toMin(cur.end) - now, total = toMin(cur.end) - toMin(cur.start);
    return html`<div class="now">
      <div class="eyebrow"><i class="pulse" style="display:inline-block;margin-right:8px"></i>${t('Now')} · ${t('{n} left', { n: minsLabel(left) })}</div>
      <div class="now-title">${cur.title}</div>
      <div class="small muted">${cur.start} – ${cur.end}${cur.room ? ` · ${cur.room}` : ''}${next ? html` · ${t('then')} ${next.title}` : ''}</div>
      <div class="bar" style="--c:${cur.subjectId ? subjColor(cur.subjectId) : 'var(--accent)'};margin-top:10px"><i style="width:${Math.round((1 - left / total) * 100)}%"></i></div>
      ${cur.kind === 'lesson' ? html`<button class="btn sm soft now-hw" data-act="open-class" data-id="${cur.id}" data-date="${todayStr()}">${icon('edit', 14)}${t('Write down the homework')}</button>` : ''}
    </div>`;
  }
  if (next) {
    const inMin = toMin(next.start) - now;
    return html`<div class="now">
      <div class="eyebrow">${t('Free for {n}', { n: minsLabel(inMin) })}</div>
      <div class="now-title">${t('Next')}: ${next.title}</div>
      <div class="small muted">${next.start} – ${next.end}${next.room ? ` · ${next.room}` : ''}</div>
    </div>`;
  }
  return html`<div class="now">
    <div class="eyebrow">${agenda.length ? t('Schedule done for today') : t('Nothing on the calendar')}</div>
    <div class="now-title">${agenda.length ? t('The rest of the day is yours') : t('A wide-open day')}</div>
    <div class="small muted">${t('Pick one thing and give it a focused block.')}</div>
  </div>`;
}

function upNext() {
  const task = suggestedTask();
  const mins = state.settings.focusMin;
  if (Timer.active() && Timer.isFocus()) {
    const tk = byId(state.tasks, state.timer.taskId);
    return html`<div class="upnext live">
      <div class="grow"><div class="eyebrow">${t('In focus')}</div><div class="h3 trunc">${tk ? tk.title : t('Open focus')}</div></div>
      <button class="btn primary" data-act="go" data-to="focus">${icon('timer', 16)}<span data-clock class="num">${Timer.clock()}</span></button>
    </div>`;
  }
  if (!task) return html`<div class="upnext">
    <div class="grow"><div class="eyebrow">${t('Up next')}</div><div class="h3">${t('You are all caught up')}</div></div>
    <button class="btn soft" data-act="quick-add">${icon('plus', 16)}${t('Add a task')}</button>
  </div>`;
  const why = isOverdue(task) ? t('Overdue') : task.due === todayStr() ? t('Due today') : task.due ? t('Due {d}', { d: relDay(task.due).toLowerCase() }) : task.priority === 3 ? t('High priority') : t('Good one to start');
  return html`<div class="upnext stack">
    <div data-act="open-task" data-id="${task.id}" style="cursor:pointer;min-width:0">
      <div class="eyebrow">${t('Up next')} · <span style="color:${isOverdue(task) ? 'var(--danger)' : 'var(--accent)'}">${why}</span></div>
      <div class="h3 upnext-title">${task.title}</div>
    </div>
    <div class="row" style="gap:6px">${subjChip(task.subjectId)}${task.est ? html`<span class="chip">${icon('clock', 12)}${fmtDur(task.est)}</span>` : ''}<span class="grow"></span>
      <button class="btn primary" data-act="focus-task" data-id="${task.id}">${icon('play', 14)}${t('Focus {n} min', { n: mins })}</button></div>
  </div>`;
}

function agendaList(agenda, date) {
  const now = nowMin(), isToday = date === todayStr();
  if (!agenda.length) return html`<div class="empty" style="padding:22px 10px"><p>${t('No classes or study blocks today.')}</p><button class="btn sm soft" data-act="new-event">${icon('plus', 14)}${t('Add a study block')}</button></div>`;
  return html`<div class="agenda">${agenda.map(a => {
    const live = isToday && toMin(a.start) <= now && now < toMin(a.end), past = isToday && toMin(a.end) <= now;
    const hw = a.kind === 'lesson' && a.subjectId ? state.tasks.filter(x => x.subjectId === a.subjectId && x.due === date) : [];
    const hwOpen = hw.filter(isOpen).length;
    return html`<div class="agenda-item ${live ? 'live' : ''} ${past ? 'past' : ''}" style="--c:${a.subjectId ? subjColor(a.subjectId) : 'var(--accent)'}" data-act="${a.kind === 'event' ? 'edit-event' : 'open-class'}" data-id="${a.id}" data-date="${date}">
      <div class="agenda-time num"><b>${a.start}</b><span>${a.end}</span></div>
      <i class="agenda-bar"></i>
      <div class="grow"><div class="trunc" style="font-weight:600">${a.title}</div><div class="tiny faint">${a.kind === 'lesson' ? t('Class') : t('Study block')}${a.room ? ` · ${a.room}` : ''}</div></div>
      ${hw.length ? html`<span class="chip ${hwOpen ? 'warn' : 'ok'}" title="${t('Homework for this class')}">${icon(hwOpen ? 'book' : 'check', 12)}${hwOpen ? hwOpen : hw.length}</span>` : ''}
      ${live ? html`<span class="chip accent">${t('now')}</span>` : ''}
    </div>`;
  })}</div>`;
}

/* the evening check: every class of the next school day and whether its homework is done */
function readyCard() {
  const day = nextSchoolDay(); if (!day) return '';
  const subs = [...new Set(lessonsOn(day).map(l => l.subjectId))];
  const rows = subs.map(sid => ({ sid, hw: sortTasks(state.tasks.filter(x => x.subjectId === sid && x.due === day)) }));
  const other = sortTasks(state.tasks.filter(x => x.due === day && !subs.includes(x.subjectId)));
  const all = [...rows.flatMap(r => r.hw), ...other], left = all.filter(isOpen).length;
  const mins = sum(all.filter(isOpen), x => x.est);                         // tonight's workload, from the estimates written down
  const exams = state.exams.filter(e => e.date === day);
  const adding = sid => ui.diary.add === day + '|' + sid;
  const status = !all.length ? html`<span class="tiny faint">${t('nothing written down')}</span>`
    : left ? html`<span class="chip warn num">${t('{n} left', { n: left })}</span>` : html`<span class="chip ok">${icon('check', 12)}${t('All set')}</span>`;
  return html`<section class="card pad ready" data-key="ready-${day}">
    <div class="card-head"><div style="min-width:0"><h2 class="h2">${t('Next school day')}</h2><div class="small muted">${relDay(day)} · ${fmtDate(day, 'short')} · ${nt(lessonsOn(day).length, 'class', 'classes')}${mins ? html` · <b class="ready-time">${t('about {n} of homework', { n: fmtDur(mins) })}</b>` : ''}</div></div>${status}</div>
    ${exams.map(e => html`<a class="ready-exam" href="#/exams" style="--c:${subjColor(e.subjectId)}">${icon('exam', 15)}<span class="trunc">${e.title}</span></a>`)}
    <div class="ready-list">${rows.map(({ sid, hw }) => html`<div class="ready-row" style="--c:${subjColor(sid)}" data-key="rr-${sid}">
      <span class="ready-subj"><i></i><span class="trunc">${subjName(sid) || t('Class')}</span></span>
      <div class="dy-hw ${hw.length ? 'has' : ''}">${hw.map(diaryTask)}${adding(sid) ? html`<form class="dy-form" data-submit="diary-hw" data-keydown="diary-hw-key" data-subject="${sid}" data-due="${day}"><input name="q" autocomplete="off" placeholder="${t('Homework… e.g. “p. 54 ex. 3–7”')}"></form>`
        : html`<button class="dy-add ${hw.length ? '' : 'wide'}" data-act="diary-add" data-subject="${sid}" data-date="${day}" aria-label="${t('Add homework')}">${icon('plus', 13)}${hw.length ? '' : html`<span class="tiny">${t('no homework')}</span>`}</button>`}</div>
    </div>`)}
    ${other.length ? html`<div class="ready-row"><span class="ready-subj muted">${icon('inbox', 13)}<span class="trunc">${t('Also due')}</span></span><div class="dy-hw">${other.map(diaryTask)}</div></div>` : ''}</div>
    <div class="ready-more row wrap"><a class="small muted" href="#/diary">${t('Open the diary')}${icon('right', 13, 'inl')}</a><span class="grow"></span>
      <button class="linkbtn small" data-act="chat-paste">${icon('chat', 13, 'inl')} ${t('Paste from chat')}</button>${all.length ? html`<button class="linkbtn small" data-act="share-day" data-date="${day}">${t('Share')}</button>` : ''}</div>
  </section>`;
}

/* quarter goals that still need work, and the grade each one needs next */
function goalsCard() {
  const tr = currentTerm(); if (!tr) return '';
  const all = state.subjects.map(s => ({ s, st: goalStatus(s.id, tr) })).filter(x => x.st);
  if (!all.length) return '';
  const risk = all.filter(x => !x.st.met && !x.st.final).sort((a, b) => (a.st.mark ?? 0) - a.st.goal - ((b.st.mark ?? 0) - b.st.goal));
  const line = st => st.need == null ? t('no grades yet') : st.need === Infinity ? (st.run ? t('{n} top marks in a row', { n: st.run }) : t('out of reach this term')) : t('needs {n} next', { n: st.need });
  return html`<section class="card pad goals-card" data-key="goals-${tr.id}">
    <div class="card-head"><div><h2 class="h2">${t('Quarter goals')}</h2><div class="small muted">${t(tr.name)} · ${t('{n} left', { n: nt(Math.max(0, diffDays(tr.end, todayStr())), 'day', 'days') })}</div></div>
      <span class="chip ${risk.length ? 'warn' : 'ok'} num">${risk.length ? t('{a} of {b} on track', { a: all.length - risk.length, b: all.length }) : html`${icon('check', 12)}${t('all on track')}`}</span></div>
    ${risk.length ? html`<div class="goal-list">${risk.slice(0, 4).map(({ s, st }) => html`<button class="goal-row" data-act="goal-open" data-id="${s.id}" style="--c:${s.color}">
      <i></i><span class="trunc grow">${s.name}</span>
      <span class="goal-now num">${st.mark != null ? markBadge(st.avg, 'calc sm') : html`<span class="faint">—</span>`}${icon('right', 12, 'faint')}<span class="gmark sm ${LEVEL_CLS[gradeLevel(st.goal, state.settings.gradeScale)]}">${st.goal}</span></span>
      <span class="tiny ${st.need === Infinity ? 'danger-t' : 'muted'} goal-need">${line(st)}</span>
    </button>`)}</div>${risk.length > 4 ? html`<div class="tiny faint" style="padding-top:6px">${t('+ {n} more', { n: risk.length - 4 })}</div>` : ''}`
      : html`<div class="small muted">${t('Every subject with a goal is at or above it. Keep it there.')}</div>`}
  </section>`;
}
/* where the school year stands: the quarter's progress, school days left, and the next day off */
function yearCard() {
  if (!state.lessons.length) return '';
  const today = todayStr(), tr = termOf(today), nx = nextDayOff(today);
  if (!tr && !nx) return '';
  const over = !lessonsOn(today).some(l => toMin(l.end) > nowMin());                      // today's classes are done: count from tomorrow
  const from = over ? addDays(today, 1) : today;
  const total = tr ? diffDays(tr.end, tr.start) + 1 : 1, pct = tr ? clamp((diffDays(today, tr.start) + (over ? 1 : 0.5)) / total, 0, 1) : 0;
  const left = tr ? schoolDaysBetween(from, tr.end) : 0;
  const before = nx && !nx.on ? schoolDaysBetween(from, addDays(nx.off.start, -1)) : 0;       // counted the same way as "left"
  const offs = tr ? state.daysOff.filter(x => x.end >= tr.start && x.start <= tr.end) : [];
  const pos = d => (clamp(diffDays(d, tr.start), 0, total) / total * 100).toFixed(2);
  const when = o => o.start === o.end ? fmtDate(o.start, { weekday: 'short', day: 'numeric', month: 'short' }) : `${fmtDate(o.start, 'short')} – ${fmtDate(o.end, 'short')}`;
  return html`<section class="card pad year-card" data-key="year-card">
    <div class="card-head"><div style="min-width:0"><h2 class="h2">${tr ? t(tr.name) : t('School year')}</h2><div class="small muted">${tr ? t('ends {d}', { d: fmtDate(tr.end, 'short') }) : t('between terms')}</div></div>
      ${tr ? html`<div class="year-left"><b class="num">${left}</b><span>${tn(left, 'school day left', 'school days left')}</span></div>` : ''}</div>
    ${tr ? html`<div class="year-bar" title="${t('{a} of {b} days', { a: Math.min(total, diffDays(today, tr.start) + 1), b: total })}"><i style="width:${(pct * 100).toFixed(1)}%"></i>${offs.map(o => html`<u style="left:${pos(o.start)}%;width:max(3px, ${(pos(addDays(o.end, 1)) - pos(o.start)).toFixed(2)}%)" title="${o.name || t('No school')} · ${when(o)}"></u>`)}</div>` : ''}
    ${nx ? html`<a class="year-next" href="#/settings/study">${icon('sun', 15)}<span class="grow trunc"><b>${nx.off.name || t('Day off')}</b> · ${when(nx.off)}</span><span class="tiny muted num">${nx.on ? t('now') : before ? t('in {n}', { n: nt(before, 'school day', 'school days') }) : relDay(nx.off.start).toLowerCase()}</span></a>`
      : html`<a class="year-next add" href="#/settings/study">${icon('plus', 14)}<span>${t('Add holidays and breaks')}</span></a>`}
  </section>`;
}
ACT['goal-open'] = el => { ui.grades.term = ''; ui.grades.open = el.dataset.id; go('grades'); };

function backupBanner() {
  if (!backupDue()) return '';
  const last = state.meta.lastExport;
  return html`<div class="banner" data-key="backup-banner">
    <span class="glyph" style="--c:var(--warn)">${icon('download', 17)}</span>
    <div class="grow"><b>${t('Time for a backup')}</b><div class="small muted">${t('Everything you write lives only in this browser.')} ${last ? t('Last copy: {d}.', { d: fmtDate(ymd(new Date(last)), 'short') }) : t('You have not saved a copy yet.')}</div></div>
    <button class="btn sm ghost" data-act="backup-later">${t('Later')}</button>
    <button class="btn sm primary" data-act="export">${icon('download', 14)}${t('Download')}</button>
  </div>`;
}
ACT['backup-later'] = () => commit(s => { s.meta.backupSnooze = Date.now() + 7 * DAY; }, { noUndo: true });

VIEWS.today = {
  title: 'Today', icon: 'sun',
  render() {
    const today = todayStr();
    const agenda = agendaOn(today);
    const tasks = openTasks().filter(x => (x.due && x.due <= today) || x.planned === today || x.status === 'doing')
      .sort((a, b) => taskScore(b) - taskScore(a));
    const doneToday = state.tasks.filter(x => x.status === 'done' && x.doneAt >= startOfDay());
    const focus = focusMinOn(today), goal = state.settings.dailyGoal;
    const due = dueCount();
    const exams = upcomingExams().slice(0, 3);
    const st = streak();
    const ws = weekStart(today);
    const week = [0, 1, 2, 3, 4, 5, 6].map(i => { const d = addDays(ws, i); return { d, min: focusMinOn(d) }; });
    const weekMax = Math.max(goal, ...week.map(w => w.min));
    const nLessons = agenda.filter(a => a.kind === 'lesson').length;
    const evening = !agenda.some(a => a.kind === 'lesson' && toMin(a.end) > nowMin());   // classes over (or none today): tomorrow comes first
    const parts = [nLessons && nt(nLessons, 'class', 'classes'), tasks.length && nt(tasks.length, 'task', 'tasks'), due && nt(due, 'card to review', 'cards to review')].filter(Boolean);
    const off = dayOff(today);

    return html`
    <div class="page-head">
      <div>
        <div class="eyebrow">${fmtDate(today, 'long')}</div>
        <h1 class="h1">${greeting()}</h1>
        <div class="sub">${off ? html`<span class="chip warn off-chip">${icon('sun', 12)}${t('No school today')}${off.name ? ` · ${off.name}` : ''}</span> ` : ''}${parts.length ? t('Today: {list}.', { list: parts.join(' · ') }) : off ? '' : t('Nothing urgent today. A good day to get ahead.')}</div>
      </div>
      <div class="row">
        ${st ? html`<span class="chip streak" title="${t('Days in a row with study activity')}">${icon('flame', 14)}${nt(st, 'day streak', 'day streak')}</span>` : ''}
        <button class="btn" data-act="plan-day">${icon('sparkles', 16)}${t('Plan my week')}</button>
      </div>
    </div>

    ${fileBackupBanner()}${backupBanner()}
    <div class="today-grid">
      <div class="col" style="gap:18px">
        ${evening ? readyCard() : ''}
        <section class="card orbit-card">
          ${dayOrbit(today)}
          <div class="orbit-side">
            ${nowPanel(agenda)}
            ${upNext()}
          </div>
        </section>

        <section class="card pad">
          <div class="card-head">
            <h2 class="h2">${t('On your plate')}</h2>
            <a class="btn sm ghost" href="#/tasks">${t('All tasks')}${icon('right', 14)}</a>
          </div>
          ${tasks.length ? html`<div class="tasklist">${tasks.slice(0, 8).map(x => taskRow(x))}</div>`
            : html`<div class="empty" style="padding:18px 10px"><b>${doneToday.length ? t('All done for today') : t('Nothing due today')}</b><p>${doneToday.length ? t('{n} finished. Enjoy the breathing room.', { n: nt(doneToday.length, 'task', 'tasks') }) : t('Add what is on your mind — it takes two seconds.')}</p></div>`}
          ${tasks.length > 8 ? html`<a class="small muted" href="#/tasks" style="display:block;padding:8px 4px 0">${t('+ {n} more', { n: tasks.length - 8 })}</a>` : ''}
          ${doneToday.length && tasks.length ? html`<div class="tiny faint" style="padding:10px 4px 0">${icon('check', 12, 'inl')} ${t('{n} completed today', { n: doneToday.length })}</div>` : ''}
          <form class="quick inline" data-submit="inline-add" data-due="${today}" style="margin-top:12px">${icon('plus', 17)}<input name="q" autocomplete="off" placeholder="${t('Add a task for today…')}"></form>
        </section>

        ${exams.length ? html`<section class="card pad">
          <div class="card-head"><h2 class="h2">${t('Exams ahead')}</h2><a class="btn sm ghost" href="#/exams">${t('All')}${icon('right', 14)}</a></div>
          <div class="col" style="gap:12px">${exams.map(e => {
            const d = diffDays(e.date, today), r = examReadiness(e);
            return html`<a class="row" href="#/exams" style="gap:12px">
              <div class="countdown ${d <= 3 ? 'hot' : ''}" style="--c:${subjColor(e.subjectId)}"><b class="num">${d}</b><span>${tn(d, 'day', 'days')}</span></div>
              <div class="grow"><div class="trunc" style="font-weight:600">${e.title}</div><div class="tiny faint">${subjName(e.subjectId)} · ${fmtDate(e.date, 'short')}</div>
              ${r != null ? html`<div class="bar" style="margin-top:6px;--c:${subjColor(e.subjectId)}"><i style="width:${r}%"></i></div>` : ''}</div>
              ${r != null ? html`<span class="small num muted">${r}%</span>` : ''}
            </a>`; })}</div>
        </section>` : ''}
      </div>

      <div class="col" style="gap:18px">
        ${evening ? '' : readyCard()}
        ${goalsCard()}
        ${yearCard()}
        <section class="card pad">
          <div class="row" style="gap:18px">
            ${ring(focus / goal, 92, 9, 'url(#orbitGrad)', html`<div><div class="big-num" style="font-size:22px">${focus}</div><div class="tiny faint">/ ${goal} ${t('min')}</div></div>`)}
            <div class="grow">
              <div class="h2">${focus >= goal ? t('Goal reached') : focus ? t('{n} to go', { n: minsLabel(goal - focus) }) : t('Focus goal')}</div>
              <div class="small muted">${t('This week')}: <b class="num" style="color:var(--text)">${fmtDur(sum(week, w => w.min))}</b></div>
              <div class="weekbars">${week.map(w => html`<div class="${w.d === today ? 'on' : ''}" title="${fmtDate(w.d, 'short')}: ${fmtDur(w.min)}"><i style="height:${Math.max(6, Math.round(w.min / weekMax * 100))}%" class="${w.min >= goal ? 'hit' : ''} ${w.min ? '' : 'zero'}"></i><span>${wdName(dow(w.d), 'narrow')}</span></div>`)}</div>
            </div>
          </div>
        </section>

        <section class="card pad">
          <div class="card-head"><h2 class="h2">${t('Schedule')}</h2><a class="btn sm ghost" href="#/calendar">${t('Week')}${icon('right', 14)}</a></div>
          ${agendaList(agenda, today)}
        </section>

        <section class="card pad">
          <div class="card-head"><h2 class="h2">${t('Review')}</h2><a class="btn sm ghost" href="#/cards">${t('Decks')}${icon('right', 14)}</a></div>
          ${state.cards.length ? html`<div class="row" style="gap:14px">
            <span class="glyph lg" style="--c:var(--accent)">${icon('cards', 24)}</span>
            <div class="grow"><div class="h3">${due ? nt(due, 'card due', 'cards due') : t('Nothing due right now')}</div><div class="small muted">${due ? t('About {n} min', { n: Math.max(1, Math.round(due * 0.35)) }) : t('Your memory is up to date.')}</div></div>
            ${due ? html`<button class="btn soft" data-act="study" data-deck="">${t('Review|button')}</button>` : ''}
          </div>` : html`<div class="small muted">${t('Turn notes into flashcards and Studyspace will schedule the reviews for you.')} <a href="#/cards" style="color:var(--accent);font-weight:600">${t('Create a deck')}</a></div>`}
        </section>


      </div>
    </div>`;
  },
};

ACT['focus-task'] = el => { Timer.start({ mode: 'focus', taskId: el.dataset.id }); go('focus'); };
ACT['plan-day'] = () => { go('calendar'); openAutoPlan(); };
ON.submit['inline-add'] = (form, e) => {
  e.preventDefault();
  const inp = form.querySelector('input'); if (!inp.value.trim()) return;
  const d = {};
  if (form.dataset.due) d.due = form.dataset.due;
  if (form.dataset.subject) d.subjectId = form.dataset.subject;
  if (form.dataset.project) d.projectId = form.dataset.project;
  if (form.dataset.exam) d.examId = form.dataset.exam;
  const p = parseQuick(inp.value); if (!p.title) return;
  commit(s => { s.tasks.push(newTask({ ...d, title: p.title, due: p.due || d.due || '', est: p.est, priority: p.priority, subjectId: p.subjectId || d.subjectId || '', repeat: p.repeat })); });
  inp.value = '';
};

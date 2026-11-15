'use strict';
/* ───────────── Settings ───────────── */

const SETTINGS_TABS = [['profile', 'Profile', 'user'], ['look', 'Appearance', 'brush'], ['study', 'Study', 'timer'], ['timetable', 'Timetable', 'calendar'], ['data', 'Your data', 'download']];

function setRow(label, hint, control) {
  return html`<div class="set-row"><div class="grow"><div class="h3">${label}</div>${hint ? html`<div class="small muted">${hint}</div>` : ''}</div><div class="set-ctl">${control}</div></div>`;
}
const numInput = (key, min, max, step = 1, suffix = '') => html`<div class="row" style="gap:8px"><input type="number" class="input num" style="width:86px" min="${min}" max="${max}" step="${step}" value="${state.settings[key]}" data-change="set-num" data-k="${key}">${suffix ? html`<span class="small muted">${suffix}</span>` : ''}</div>`;
const toggle = key => html`<span class="switch"><input type="checkbox" ${state.settings[key] ? raw('checked') : ''} data-change="set-bool" data-k="${key}"><i></i></span>`;
const segSet = (key, opts) => html`<div class="seg">${opts.map(([v, l]) => html`<button class="${String(state.settings[key]) === String(v) ? 'on' : ''}" data-act="set-val" data-k="${key}" data-v="${v}">${l}</button>`)}</div>`;

function settingsProfile() {
  const p = state.profile;
  return html`<section class="card pad set">
    <div class="row" style="gap:16px;margin-bottom:8px"><span class="avatar" style="width:56px;height:56px;font-size:22px">${(p.name || 'S').charAt(0).toUpperCase()}</span><div><div class="h2">${p.name || t('Student')}</div><div class="small muted">${t('Member of your own study space since {d}', { d: fmtDate(ymd(new Date(state.createdAt)), 'full') })}</div></div></div>
    ${setRow(t('Name|person'), '', html`<input class="input" style="width:240px" value="${p.name}" data-change="profile" data-k="name" placeholder="${t('Your name')}">`)}
    ${setRow(t('School'), '', html`<input class="input" style="width:240px" value="${p.school}" data-change="profile" data-k="school">`)}
    ${setRow(t('Grade / year'), '', html`<input class="input" style="width:120px" value="${p.grade}" data-change="profile" data-k="grade">`)}
  </section>`;
}
function settingsLook() {
  return html`<section class="card pad set">
    ${setRow(t('Theme'), t('Auto follows your device.'), segSet('theme', [['auto', t('Auto')], ['light', t('Light')], ['dark', t('Dark')]]))}
    ${setRow(t('Accent colour'), '', html`<div class="swatches">${Object.entries(ACCENTS).map(([k, c]) => html`<button class="swatch ${state.settings.accent === k ? 'on' : ''}" style="--c:${c}" data-act="set-val" data-k="accent" data-v="${k}" aria-label="${k}"></button>`)}</div>`)}
    ${setRow(t('Sounds'), t('A soft chime when a session ends or a task is done.'), toggle('sound'))}
  </section>`;
}
function settingsStudy() {
  const s = state.settings;
  return html`<section class="card pad set">
    <div class="eyebrow">${t('Focus timer')}</div>
    ${setRow(t('Focus length'), '', numInput('focusMin', 5, 180, 5, t('min')))}
    ${setRow(t('Short break'), '', numInput('shortMin', 1, 30, 1, t('min')))}
    ${setRow(t('Long break'), t('After every {n} focus sessions.', { n: s.longEvery }), html`<div class="row" style="gap:8px">${numInput('longMin', 5, 60, 5, t('min'))}</div>`)}
    ${setRow(t('Sessions before a long break'), '', numInput('longEvery', 2, 8))}
    ${setRow(t('Start breaks automatically'), '', toggle('autoBreak'))}
    ${setRow(t('Notify me when the timer ends'), t('Shows a system notification if the app is in the background.'), toggle('notify'))}
  </section>
  <section class="card pad set">
    <div class="eyebrow">${t('Planning')}</div>
    ${setRow(t('Evening homework reminder'), t('At this time, a notification lists the homework still open for the next school day. Works while Studyspace is open, even in a background tab.'),
      html`<select class="select" style="width:120px" data-change="set-remind">${options([['', t('Off')], ...['17:00', '18:00', '19:00', '20:00', '21:00', '22:00'].map(x => [x, x])], state.settings.remindAt)}</select>`)}
    ${setRow(t('Daily focus goal'), t('Drives the rings, the streak and the auto-planner.'), numInput('dailyGoal', 15, 600, 15, t('min')))}
    ${setRow(t('Study window'), t('Auto-plan only uses this part of the day.'), html`<div class="row" style="gap:6px"><input type="time" class="input" style="width:112px" value="${s.windowStart}" data-change="set-time" data-k="windowStart"><span class="faint">–</span><input type="time" class="input" style="width:112px" value="${s.windowEnd}" data-change="set-time" data-k="windowEnd"></div>`)}
    ${setRow(t('Calendar hours'), t('The part of the day shown in the week view.'), html`<div class="row" style="gap:6px"><select class="select" style="width:96px" data-change="set-num" data-k="dayStart">${options(Array.from({ length: 13 }, (_, i) => [i, pad(i) + ':00']), s.dayStart)}</select><span class="faint">–</span><select class="select" style="width:96px" data-change="set-num" data-k="dayEnd">${options(Array.from({ length: 9 }, (_, i) => [16 + i, pad(16 + i) + ':00']), s.dayEnd)}</select></div>`)}
  </section>
  <section class="card pad set">
    <div class="eyebrow">${t('Learning')}</div>
    ${setRow(t('New flashcards per day'), t('Reviews are never limited — only brand-new cards.'), numInput('newPerDay', 0, 200, 5))}
    ${setRow(t('Grading scale'), t('Existing grades keep their own “out of” value.'), segSet('gradeScale', [[10, '1 – 10'], [5, '1 – 5'], [100, '0 – 100']]))}
  </section>
  ${termsEditor()}
  ${daysOffEditor()}`;
}
function termsEditor() {
  const ts = state.terms.slice().sort((a, b) => a.start.localeCompare(b.start)), now = currentTerm();
  return html`<section class="card pad set">
    <div class="spread"><div class="eyebrow">${t('School terms')}</div>
      <div class="row" style="gap:6px"><button class="btn sm ghost" data-act="terms-preset" data-k="quarters">${t('4 quarters')}</button><button class="btn sm ghost" data-act="terms-preset" data-k="semesters">${t('2 semesters')}</button></div></div>
    <div class="small muted" style="margin:4px 0 10px">${t('Grades are averaged per term, like on your report card. Set the dates your school uses.')}</div>
    ${ts.map(x => html`<div class="term-row" data-key="term-${x.id}">
      <input class="input" value="${t(x.name)}" data-change="term-field" data-id="${x.id}" data-f="name" aria-label="${t('Name')}">
      <input type="date" class="input" value="${x.start}" data-change="term-field" data-id="${x.id}" data-f="start" aria-label="${t('Start')}">
      <span class="faint">–</span>
      <input type="date" class="input" value="${x.end}" data-change="term-field" data-id="${x.id}" data-f="end" aria-label="${t('End')}">
      ${now && now.id === x.id ? html`<span class="chip accent">${t('now')}</span>` : html`<span class="chip" style="visibility:hidden">${t('now')}</span>`}
      <button class="btn icon sm ghost" data-act="term-del" data-id="${x.id}" title="${t('Remove')}" ${ts.length < 2 ? raw('disabled') : ''}>${icon('x', 14)}</button>
    </div>`)}
    <button class="btn sm soft" style="margin-top:10px" data-act="term-add">${icon('plus', 14)}${t('Add term')}</button>
  </section>`;
}
/* holidays and breaks: no classes, no homework due, countdowns skip them */
function daysOffEditor() {
  const list = state.daysOff.slice().sort((a, b) => a.start.localeCompare(b.start)), today = todayStr();
  const missing = tjHolidays().filter(h => !state.daysOff.some(x => x.start <= h.start && x.end >= h.end));
  return html`<section class="card pad set" id="days-off">
    <div class="spread"><div class="eyebrow">${t('Holidays and days off')}</div>
      ${missing.length ? html`<button class="btn sm ghost" data-act="off-tj" title="${missing.map(h => h.name).join(', ')}">${icon('plus', 13)}${t('Public holidays of Tajikistan')}</button>` : ''}</div>
    <div class="small muted" style="margin:4px 0 10px">${t('On these days the timetable is empty: no classes on Today or in the Diary, and homework is never set for them. Add your breaks and any day the school is closed.')}</div>
    ${list.map(x => html`<div class="term-row off-row ${x.end < today ? 'past' : ''}" data-key="off-${x.id}">
      <input class="input" value="${x.name}" placeholder="${t('e.g. Winter break')}" data-change="off-field" data-id="${x.id}" data-f="name" aria-label="${t('Name')}">
      <input type="date" class="input" value="${x.start}" data-change="off-field" data-id="${x.id}" data-f="start" aria-label="${t('Start')}">
      <span class="faint">–</span>
      <input type="date" class="input" value="${x.end}" data-change="off-field" data-id="${x.id}" data-f="end" aria-label="${t('End')}">
      <span class="tiny faint num off-len">${nt(diffDays(x.end, x.start) + 1, 'day', 'days')}</span>
      <button class="btn icon sm ghost" data-act="off-del" data-id="${x.id}" title="${t('Remove')}">${icon('x', 14)}</button>
    </div>`)}
    ${list.length ? '' : html`<div class="small faint" style="padding:2px 0 6px">${t('Nothing added yet — every weekday counts as a school day.')}</div>`}
    <button class="btn sm soft" style="margin-top:10px" data-act="off-add">${icon('plus', 14)}${t('Add days off')}</button>
  </section>`;
}
function settingsTimetable() {
  const days = WD_KEYS.filter(n => n <= 5 || state.lessons.some(l => l.day === n) || n === 6);
  return html`
  <div class="spread" style="margin-bottom:14px"><div class="small muted">${t('Your weekly classes. They appear on Today and in the calendar, and the auto-planner works around them.')}</div><div class="row wrap"><button class="btn" data-act="paste-timetable">${icon('list', 16)}${t('Paste timetable')}</button><button class="btn primary" data-act="add-lesson">${icon('plus', 16)}${t('Add class')}</button></div></div>
  ${state.subjects.length ? html`<div class="tt-grid">${days.map(n => {
    const ls = state.lessons.filter(l => l.day === n).sort((a, b) => a.start.localeCompare(b.start));
    return html`<section class="card tt-day ${dow(todayStr()) === n ? 'today' : ''}"><div class="tt-head"><b>${wdName(n, 'long')}</b><span class="tiny faint">${ls.length || ''}</span></div>
      ${ls.map(l => html`<button class="tt-lesson" data-key="l-${l.id}" data-act="edit-lesson" data-id="${l.id}" style="--c:${subjColor(l.subjectId)}"><span class="num tiny">${l.start}<br>${l.end}</span><i class="agenda-bar"></i><span class="grow trunc" style="text-align:left"><b class="trunc" style="display:block">${subjName(l.subjectId) || t('Class')}</b>${l.room ? html`<span class="tiny faint">${l.room}</span>` : ''}</span></button>`)}
      <button class="tt-add" data-act="add-lesson" data-day="${n}">${icon('plus', 14)}${t('Add')}</button>
    </section>`; })}</div>` : html`<div class="card">${emptyState('book', t('Add your subjects first'), t('Classes are linked to subjects.'), html`<a class="btn primary" href="#/subjects">${t('Go to subjects')}</a>`)}</div>`}`;
}
/* the whole week in one go: one line per day, plus the bell times */
function openTimetablePaste() {
  const bellsText = currentBells().map(([a, b]) => `${a}–${b}`).join('\n');
  const example = 'Mon: Algebra, Tajik, Physics, English\nTue: Geometry, Russian, Chemistry (204)\n…';
  let plan = null;
  openModal({
    title: t('Paste your timetable'), cls: 'wide',
    body: html`
      <div class="tp-grid">
        <label class="field"><span>${t('Classes — one line per day')}</span><textarea class="input tp-text" name="tt" rows="7" spellcheck="false" placeholder="${example}"></textarea></label>
        <label class="field"><span>${t('Bell times')}</span><textarea class="input tp-bells num" name="bells" rows="7" spellcheck="false">${bellsText}</textarea></label>
      </div>
      <div class="hint" style="margin-top:-6px">${t('Start a line with the day (Mon, Monday, Душанбе…) or put the day on its own line with one class per line under it. Use “—” for a free period and brackets for the room. Subjects you do not have yet are created.')}</div>
      <div id="tp-preview" class="tp-preview"></div>
      <label class="row small" style="cursor:pointer;gap:10px"><span class="switch"><input type="checkbox" name="replace" checked><i></i></span>${t('Replace the classes already on these days')}</label>`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary" id="tp-save" disabled>${t('Set timetable')}</button>`,
    onMount: scrim => {
      const tt = scrim.querySelector('[name=tt]'), bl = scrim.querySelector('[name=bells]'), prev = scrim.querySelector('#tp-preview'), save = scrim.querySelector('#tp-save');
      const draw = () => {
        const p = parseTimetable(tt.value), bells = parseBells(bl.value), fresh = new Map();
        plan = { days: p.order.map(d => ({ d, items: p.days[d].map((x, i) => x && { ...x, subject: findSubjectByName(x.name), time: periodTime(bells, i) }) })), bells };
        for (const day of plan.days) for (const x of day.items) if (x && !x.subject) fresh.set(normName(x.name), x.name);
        plan.fresh = [...fresh.values()];
        const n = sum(plan.days, day => day.items.filter(Boolean).length);
        save.disabled = !n;
        prev.innerHTML = !plan.days.length ? '' : String(html`
          ${plan.days.map(({ d, items }) => html`<div class="tp-day"><b>${wdName(d, 'short')}</b><div class="tp-items">${items.map((x, i) => !x ? html`<span class="tp-item free"><small class="num">${i + 1}</small>—</span>`
            : html`<span class="tp-item ${x.subject ? '' : 'new'}" style="--c:${x.subject ? x.subject.color : 'var(--text-3)'}" title="${x.time[0]}–${x.time[1]}${x.room ? ' · ' + x.room : ''}"><small class="num">${i + 1}</small>${x.subject ? x.subject.name : x.name}${x.subject ? '' : html` <em>${t('new')}</em>`}</span>`)}</div></div>`)}
          <div class="small muted">${t('{n} on {d}', { n: nt(n, 'class', 'classes'), d: nt(plan.days.length, 'day', 'days') })}${plan.fresh.length ? html` · ${t('new subjects: {list}', { list: plan.fresh.join(', ') })}` : ''}</div>`);
      };
      tt.addEventListener('input', draw); bl.addEventListener('input', draw); draw();
    },
    onSubmit: d => {
      if (!plan || !plan.days.length) return false;
      commit(s => {
        const made = new Map();
        for (const name of plan.fresh) { const sub = subjectFromName(name, s.subjects.length); s.subjects.push(sub); made.set(normName(name), sub); }
        for (const { d: day, items } of plan.days) {
          if (d.replace) s.lessons = s.lessons.filter(l => l.day !== day);
          items.forEach(x => { if (!x) return; const sub = x.subject || made.get(normName(x.name)); s.lessons.push({ id: uid(), subjectId: sub.id, day, start: x.time[0], end: x.time[1], room: x.room }); });
        }
      });
      toastUndo(t('Timetable set — {n}', { n: nt(sum(plan.days, day => day.items.filter(Boolean).length), 'class', 'classes') }));
    },
  });
}
ACT['paste-timetable'] = () => openTimetablePaste();

function settingsData() {
  const size = (() => { try { return (localStorage.getItem(STORE_KEY) || '').length; } catch (e) { return 0; } })();
  const backups = listBackups().slice().reverse();
  const legacy = findLegacyLocal();
  return html`
  <section class="card pad set">
    <div class="row" style="gap:12px;align-items:flex-start;margin-bottom:6px"><span class="glyph" style="--c:var(--ok)">${icon('check', 18)}</span><div><div class="h3">${Sync.on ? t('Stored on this device, synced encrypted') : t('Everything stays on this device')}</div><div class="small muted">${Sync.on ? t('No account and no tracking. Your data lives in this browser ({kb} KB) and works offline; an encrypted copy is kept online so your other devices can fetch it.', { kb: Math.max(1, Math.round(size / 1024)) }) : t('No account, no tracking, no network requests. Your data lives in this browser ({kb} KB) and works offline.', { kb: Math.max(1, Math.round(size / 1024)) })}</div></div></div>
    ${syncRow()}
    ${fileBackupRow()}
    ${setRow(t('Export a backup'), html`${t('One JSON file with everything. Keep a copy somewhere safe, or move it to another device.')} <b>${state.meta.lastExport ? t('Last copy: {d}.', { d: fmtDate(ymd(new Date(state.meta.lastExport)), 'short') }) : FileBackup.covers() ? '' : t('You have not saved a copy yet.')}</b>`, html`<button class="btn" data-act="export">${icon('download', 15)}${t('Export')}</button>`)}
    ${setRow(t('Add to your phone’s calendar'), t('Timetable, study blocks, exams and deadlines as one .ics file — open it on your phone or import it into Google Calendar.'), html`<button class="btn" data-act="export-ics">${icon('calendar', 15)}${t('Export .ics')}</button>`)}
    ${setRow(t('Import'), t('Restore a Studyspace Orbit backup, bring over a backup from the older Studyspace (v1–v8), or add a study plan saved by Studyspace SAT.'), html`<button class="btn" data-act="import">${icon('upload', 15)}${t('Import file')}</button>`)}
    ${legacy ? setRow(t('Older Studyspace found in this browser'), t('{a} tasks and {b} subjects from Studyspace {v} are stored here. Bring them over in one click — the old data is not modified.', { a: (legacy.tasks || []).length, b: (legacy.subjects || []).length, v: legacy.version || '' }), html`<button class="btn primary" data-act="import-legacy">${icon('sparkles', 15)}${t('Bring it over')}</button>`) : ''}
  </section>
  <section class="card pad set">
    <div class="eyebrow">${t('Automatic snapshots')}</div>
    <div class="small muted" style="margin:4px 0 8px">${t('Studyspace quietly keeps one snapshot per day for the last week. If something goes wrong, go back in time.')}</div>
    ${backups.length ? backups.map(b => html`<div class="set-row"><div class="grow"><div class="h3">${relDay(b.day)}</div><div class="small muted">${fmtDate(b.day, 'long')} · ${Math.max(1, Math.round(b.data.length / 1024))} KB</div></div><button class="btn sm" data-act="restore-backup" data-day="${b.day}">${t('Restore')}</button></div>`) : html`<div class="small faint">${t('The first snapshot appears after your first day.')}</div>`}
  </section>
  <section class="card pad set">
    <div class="eyebrow">${t('Start over')}</div>
    ${setRow(t('Load the demo workspace'), t('A realistic sample week to explore every feature. Replaces current data (you can undo).'), html`<button class="btn" data-act="load-demo">${t('Load demo')}</button>`)}
    ${setRow(t('Erase everything'), t('Deletes all data in this browser and starts fresh.'), html`<button class="btn danger" data-act="erase">${icon('trash', 15)}${t('Erase')}</button>`)}
  </section>
  <div class="tiny faint" style="text-align:center;margin-top:18px">Studyspace Orbit ${APP_VERSION} · ${t('made for students who would rather be done by dinner')} · <button data-act="shortcuts" style="text-decoration:underline">${t('Keyboard shortcuts')}</button></div>`;
}

VIEWS.settings = {
  title: 'Settings', icon: 'settings',
  render(arg) {
    if (arg && SETTINGS_TABS.some(x => x[0] === arg)) ui.settings.tab = arg;
    const tab = ui.settings.tab;
    return html`
    <div class="page-head"><div><h1 class="h1">${t('Settings')}</h1></div></div>
    <div class="chips-scroll" style="margin-bottom:18px">${SETTINGS_TABS.map(([k, l, ic]) => html`<a class="chip tabchip ${tab === k ? 'on' : ''}" href="#/settings/${k}">${icon(ic, 14)}${t(l)}</a>`)}</div>
    <div class="col set-wrap ${tab === 'timetable' ? 'wide' : ''}" style="gap:16px">${tab === 'look' ? settingsLook() : tab === 'study' ? settingsStudy() : tab === 'timetable' ? settingsTimetable() : tab === 'data' ? settingsData() : settingsProfile()}</div>`;
  },
};

const setSetting = (k, v) => { commit(s => { s.settings[k] = v; if (k === 'focusMin') s.timer.total = s.timer.status === 'idle' ? 0 : s.timer.total; }, { noUndo: true }); applySettings(); requestRender(); };
ACT['set-val'] = el => { let v = el.dataset.v; if (el.dataset.k === 'gradeScale') v = +v; setSetting(el.dataset.k, v); };
ON.change['set-num'] = el => { const v = clamp(Math.round(+el.value || 0), +el.min || 0, +el.max || 9999); setSetting(el.dataset.k, v); };
ON.change['set-remind'] = el => {
  const v = isTime(el.value) ? el.value : '';
  setSetting('remindAt', v);
  if (v && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(p => { if (p !== 'granted') toast(t('Notifications are blocked — the reminder will show inside the app instead.')); });
};
ON.change['set-time'] = el => { if (isTime(el.value)) setSetting(el.dataset.k, el.value); };
ON.change['set-bool'] = el => {
  setSetting(el.dataset.k, el.checked);
  if (el.dataset.k === 'notify' && el.checked && 'Notification' in window) Notification.requestPermission().then(p => { if (p !== 'granted') { setSetting('notify', false); toast(t('Notifications are blocked in this browser.')); } });
  if (el.dataset.k === 'sound' && el.checked) Sound.tick();
};
ACT['terms-preset'] = el => { commit(s => { s.terms = defaultTerms(el.dataset.k); }); ui.grades.term = ''; toastUndo(t('Terms updated')); };
ACT['term-del'] = el => { if (state.terms.length < 2) return; commit(s => { s.terms = s.terms.filter(x => x.id !== el.dataset.id); }); ui.grades.term = ''; };
ACT['term-add'] = () => {
  const last = state.terms.slice().sort((a, b) => b.end.localeCompare(a.end))[0];
  const start = last ? addDays(last.end, 1) : todayStr();
  commit(s => { s.terms.push({ id: uid(), name: t('Term {n}', { n: s.terms.length + 1 }), start, end: addDays(start, 60) }); });
};
ON.change['term-field'] = el => {
  const f = el.dataset.f, v = el.value.trim();
  if (f === 'name' ? !v : !isYmd(v)) { requestRender(); return; }
  const x = byId(state.terms, el.dataset.id); if (!x) return;
  const next = { ...x, [f]: v.slice(0, 40) };
  if (next.end < next.start) { toast(t('The end date must be after the start.'), { kind: 'danger' }); requestRender(); return; }
  commit(s => { Object.assign(byId(s.terms, x.id), next); });
};
ACT['off-add'] = () => {
  const last = state.daysOff.slice().sort((a, b) => b.end.localeCompare(a.end))[0];
  const start = last && last.end >= todayStr() ? addDays(last.end, 1) : todayStr();
  commit(s => { s.daysOff.push({ id: uid(), name: '', start, end: start }); });
  setTimeout(() => { const el = $$('.off-row input[data-f=name]').find(i => !i.value); if (el) el.focus(); }, 40);
};
ACT['off-del'] = el => { commit(s => { s.daysOff = s.daysOff.filter(x => x.id !== el.dataset.id); }); toastUndo(t('Days off removed')); };
ACT['off-tj'] = () => {
  const add = tjHolidays().filter(h => !state.daysOff.some(x => x.start <= h.start && x.end >= h.end));
  commit(s => { for (const h of add) s.daysOff.push({ id: uid(), ...h }); });
  toastUndo(t('{n} added — check the dates against your school’s', { n: nt(add.length, 'holiday', 'holidays') }));
};
ON.change['off-field'] = el => {
  const f = el.dataset.f, v = el.value.trim(), x = byId(state.daysOff, el.dataset.id); if (!x) return;
  if (f !== 'name' && !isYmd(v)) { requestRender(); return; }
  const next = { ...x, [f]: f === 'name' ? v.slice(0, 40) : v };
  if (f === 'start' && next.end < next.start) next.end = next.start;        // moving the first day past the last drags the last day along
  if (next.end < next.start) { toast(t('The end date must be after the start.'), { kind: 'danger' }); requestRender(); return; }
  commit(s => { Object.assign(byId(s.daysOff, x.id), next); });
};
ON.change.profile = el => commit(s => { s.profile[el.dataset.k] = el.value.trim().slice(0, 80); }, { noUndo: true });
ACT['export-ics'] = () => { exportICS(); toast(t('Calendar file downloaded')); };
ACT.export = () => { exportBackup(); toast(t('Backup downloaded')); };
ACT.import = () => pickFile(text => importAny(text));
ACT['import-legacy'] = () => { const l = findLegacyLocal(); if (l) importLegacy(l); };
ACT['restore-backup'] = el => {
  const b = listBackups().find(x => x.day === el.dataset.day); if (!b) return;
  try { replaceState(JSON.parse(b.data)); toastUndo(t('Restored the snapshot from {d}', { d: relDay(b.day).toLowerCase() })); } catch (e) { toast(t('That snapshot could not be read.'), { kind: 'danger' }); }
};
ACT['load-demo'] = () => { replaceState(demoState(state.profile, state.settings)); toastUndo(t('Demo workspace loaded')); go('today'); };
ACT.erase = () => confirmModal(t('Erase everything?'), t('All tasks, grades, cards and history in this browser will be deleted. Export a backup first if you might want them back.'), t('Erase all data'), () => {
  const keep = { theme: state.settings.theme, accent: state.settings.accent };
  const fresh = freshState(); Object.assign(fresh.settings, keep);
  undoStack.length = 0; state = fresh; applySettings(); saveNow(); location.hash = '#/today'; requestRender();
});
ACT.shortcuts = () => openShortcuts();

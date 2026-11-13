'use strict';
/* ───────────── first run: three calm steps ───────────── */

const onb = { step: 0, name: '', school: '', grade: '', picked: null, custom: [] };

function renderOnboarding() {
  if (!onb.picked) onb.picked = new Set(DEFAULT_SUBJECTS.map(s => s[0]));
  const legacy = findLegacyLocal();
  const dots = html`<div class="onb-dots">${[0, 1, 2].map(i => html`<i class="${i === onb.step ? 'on' : i < onb.step ? 'past' : ''}"></i>`)}</div>`;
  let body;
  if (onb.step === 0) body = html`
    <div class="onb-logo">${LOGO}</div>
    <h1 class="h1" style="font-size:34px">${t('Welcome to Studyspace')}</h1>
    <p class="muted" style="font-size:16px;max-width:420px">${t('Classes, homework, exams, grades and focus time — one calm place for your whole school life.')}</p>
    <form class="onb-form" data-submit="onb-next">
      <label class="field"><span>${t('What should we call you?')}</span><input class="input" name="name" value="${onb.name}" placeholder="${t('Your name')}" autofocus autocomplete="given-name"></label>
      <div class="form-grid">
        <label class="field"><span>${t('School')}</span><input class="input" name="school" value="${onb.school}"></label>
        <label class="field"><span>${t('Grade / year')}</span><input class="input" name="grade" value="${onb.grade}"></label>
      </div>
      <div class="spread" style="margin-top:4px">
        <span></span>
        <div class="seg">${[['light', 'sun'], ['dark', 'moon']].map(([k, ic]) => html`<button type="button" class="${document.documentElement.dataset.theme === k ? 'on' : ''}" data-act="onb-theme" data-v="${k}">${icon(ic, 15)}</button>`)}</div>
      </div>
      <button class="btn primary lg" style="margin-top:8px">${t('Continue')}${icon('arrow', 16)}</button>
    </form>`;
  else if (onb.step === 1) body = html`
    <h1 class="h1">${t('Which subjects do you take?')}</h1>
    <p class="muted">${t('Tap to switch off the ones you do not have. You can change colours and add more later.')}</p>
    <div class="onb-subjects">
      ${[...DEFAULT_SUBJECTS, ...EXTRA_SUBJECTS].map(([k, en, c, ic]) => html`<button class="onb-subj ${onb.picked.has(k) ? 'on' : ''}" style="--c:${c}" data-act="onb-toggle" data-k="${k}">${icon(ic, 17)}${en}</button>`)}
      ${onb.custom.map((name, i) => html`<button class="onb-subj on" style="--c:${PALETTE[(i + 3) % PALETTE.length]}" data-act="onb-remove" data-i="${i}">${icon(guessSubjectIcon(name), 17)}${name}${icon('x', 13)}</button>`)}
    </div>
    <form class="quick" data-submit="onb-add" style="max-width:360px;width:100%">${icon('plus', 17)}<input name="name" placeholder="${t('Add another subject…')}" autocomplete="off"></form>
    <div class="field" style="align-items:center;margin-top:8px"><span>${t('Your school’s grading scale')}</span>
      <div class="seg">${[[10, '1 – 10'], [5, '1 – 5'], [100, '0 – 100']].map(([v, l]) => html`<button type="button" class="${state.settings.gradeScale === v ? 'on' : ''}" data-act="onb-scale" data-v="${v}">${l}</button>`)}</div></div>
    <div class="row" style="margin-top:10px"><button class="btn ghost lg" data-act="onb-back">${t('Back')}</button><button class="btn primary lg" data-act="onb-next2">${t('Continue')}${icon('arrow', 16)}</button></div>`;
  else body = html`
    <h1 class="h1">${onb.name ? t('Almost there, {name}', { name: onb.name.split(' ')[0] }) : t('Almost there')}</h1>
    <p class="muted">${t('How would you like to begin?')}</p>
    <div class="onb-choices">
      ${legacy ? html`<button class="onb-choice featured" data-act="onb-finish" data-how="legacy"><span class="glyph" style="--c:var(--accent)">${icon('sparkles', 20)}</span><div><b>${t('Bring my data from the old Studyspace')}</b><span>${t('Found in this browser: {a} tasks, {b} subjects. Nothing in the old app is changed.', { a: legacy.tasks.length, b: legacy.subjects.length })}</span></div>${icon('right', 18)}</button>` : ''}
      <button class="onb-choice" data-act="onb-finish" data-how="fresh"><span class="glyph" style="--c:var(--ok)">${icon('check', 20)}</span><div><b>${t('Start fresh')}</b><span>${t('A clean workspace with your subjects, ready for your real timetable.')}</span></div>${icon('right', 18)}</button>
      <button class="onb-choice" data-act="onb-finish" data-how="demo"><span class="glyph" style="--c:var(--accent-2)">${icon('eye', 20)}</span><div><b>${t('Look around with a demo week')}</b><span>${t('A realistic sample: timetable, tasks, exams, grades and two months of history. Erase it any time.')}</span></div>${icon('right', 18)}</button>
      <button class="onb-choice" data-act="onb-finish" data-how="file"><span class="glyph" style="--c:var(--warn)">${icon('upload', 20)}</span><div><b>${t('Import a backup file')}</b><span>${t('A Studyspace Orbit backup, or a JSON export from the older Studyspace (v1–v8).')}</span></div>${icon('right', 18)}</button>
    </div>
    <button class="btn ghost" data-act="onb-back">${icon('left', 15)}${t('Back')}</button>`;
  morph($('#app'), html`${DEFS}<div class="onb"><div class="zen-aurora"></div><div class="onb-card" data-key="onb-${onb.step}">${body}${dots}</div></div>`);
}

function onbSubjects() {
  const out = [...DEFAULT_SUBJECTS, ...EXTRA_SUBJECTS].filter(s => onb.picked.has(s[0])).map(([k, en, color, ic]) => ({ id: 's_' + k, name: en, color, icon: ic, teacher: '', room: '' }));
  onb.custom.forEach((name, i) => out.push({ id: uid(), name, color: PALETTE[(i + 3) % PALETTE.length], icon: guessSubjectIcon(name), teacher: '', room: '' }));
  return out;
}
ON.submit['onb-next'] = (form, e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(form).entries()); onb.name = d.name.trim().slice(0, 60); onb.school = d.school.trim().slice(0, 100); onb.grade = d.grade.trim().slice(0, 20); onb.step = 1; requestRender(); };
ACT['onb-theme'] = el => { state.settings.theme = el.dataset.v; applySettings(); scheduleSave(); requestRender(); };
ACT['onb-toggle'] = el => { const k = el.dataset.k; if (onb.picked.has(k)) onb.picked.delete(k); else onb.picked.add(k); requestRender(); };
ACT['onb-remove'] = el => { onb.custom.splice(+el.dataset.i, 1); requestRender(); };
ON.submit['onb-add'] = (form, e) => { e.preventDefault(); const inp = form.elements.name, v = inp.value.trim(); if (v && !onb.custom.includes(v)) onb.custom.push(v.slice(0, 60)); inp.value = ''; requestRender(); };
ACT['onb-scale'] = el => { state.settings.gradeScale = +el.dataset.v; scheduleSave(); requestRender(); };
ACT['onb-back'] = () => { onb.step = Math.max(0, onb.step - 1); requestRender(); };
ACT['onb-next2'] = () => { onb.step = 2; requestRender(); };
ACT['onb-finish'] = el => {
  const how = el.dataset.how;
  const profile = { name: onb.name, school: onb.school, grade: onb.grade, onboarded: true };
  const settings = { theme: state.settings.theme, accent: state.settings.accent, gradeScale: state.settings.gradeScale };
  const done = () => { location.hash = '#/today'; requestRender(); if (how !== 'fresh') return; setTimeout(() => toast(t('Welcome! Paste your timetable to fill in the week.'), { ms: 7000, action: t('Paste timetable'), onAction: () => { go('settings/timetable'); openTimetablePaste(); } }), 600); };
  if (how === 'demo') { state = normalizeState(demoState(profile, settings)); applySettings(); saveNow(); done(); return; }
  if (how === 'legacy') {
    const l = findLegacyLocal(); if (!l) return;
    const next = convertLegacy(l); Object.assign(next.settings, settings);
    if (profile.name) next.profile.name = profile.name;
    state = normalizeState(next); applySettings(); saveNow(); done();
    setTimeout(() => toast(t('Imported {a} tasks, {b} subjects and {c} sessions from Studyspace {v}', { a: next.tasks.length, b: next.subjects.length, c: next.sessions.length, v: l.version }), { ms: 6000 }), 500);
    return;
  }
  if (how === 'file') { pickFile(text => { state.profile.onboarded = false; if (importAny(text)) { undoStack.length = 0; if (profile.name && !state.profile.name) state.profile.name = profile.name; saveNow(); } }); return; }
  commit(s => { s.profile = profile; s.subjects = onbSubjects(); }, { noUndo: true });
  saveNow(); done();
};

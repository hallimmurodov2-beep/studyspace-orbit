'use strict';
/* ───────────── Focus: timer, ambience, zen mode ───────────── */

function timerRing(size, stroke) {
  const r = (size - stroke) / 2 - 6, c = 2 * Math.PI * r, p = Timer.progress();
  const isBreak = state.timer.mode !== 'focus';
  return html`<svg class="timer-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/>
    <circle data-timer-ring data-c="${c.toFixed(1)}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${isBreak ? 'var(--ok)' : 'url(#orbitGrad)'}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" style="stroke-dashoffset:${(c * (1 - p)).toFixed(1)}"/>
    <g data-timer-dot style="transform-origin:50% 50%;transform:rotate(${(p * 360).toFixed(2)}deg)"><circle cx="${size / 2 + r}" cy="${size / 2}" r="${stroke / 2 + 3}" fill="#fff" stroke="${isBreak ? 'var(--ok)' : 'var(--accent)'}" stroke-width="3"/></g>
  </svg>`;
}

function focusControls(big) {
  const tm = state.timer, st = tm.status, isBreak = tm.mode !== 'focus';
  return html`<div class="focus-controls">
    <button class="btn icon ghost ${st === 'idle' ? 'invisible' : ''}" data-act="timer-reset" title="${t('Discard')}">${icon('reset', 18)}</button>
    <button class="playbtn ${st === 'running' ? 'running' : ''}" data-act="timer-toggle" aria-label="${st === 'running' ? t('Pause') : t('Start|button')}">${icon(st === 'running' ? 'pause' : 'play', big ? 30 : 26)}</button>
    <button class="btn icon ghost ${st === 'idle' ? 'invisible' : ''}" data-act="timer-finish" title="${isBreak ? t('Skip break') : t('Finish and log')}">${icon(isBreak ? 'skip' : 'check', 18)}</button>
  </div>`;
}

VIEWS.focus = {
  title: 'Focus', icon: 'timer',
  render() {
    const tm = state.timer, s = state.settings, st = tm.status, today = todayStr();
    const isBreak = tm.mode !== 'focus';
    const task = byId(state.tasks, tm.taskId);
    const sessions = sessionsOn(today).slice().sort((a, b) => b.at - a.at);
    const focus = focusMinOn(today), goal = s.dailyGoal;
    const modeKey = tm.mode === 'focus' ? (tm.flow ? 'flow' : 'focus') : tm.mode;
    const modes = [['focus', 'Focus', 'timer'], ['short', 'Short break', 'coffee'], ['long', 'Long break', 'coffee'], ['flow', 'Flow', 'infinity']];
    const tasks = openTasks().slice().sort((a, b) => taskScore(b) - taskScore(a));
    const label = isBreak ? (st === 'idle' ? t('Take a real break') : t('Step away from the screen')) : task ? task.title : st === 'idle' ? t('Ready when you are') : t('Deep work');
    const cyclePos = (tm.cycle || 0) % s.longEvery;

    return html`
    <div class="page-head">
      <div><h1 class="h1">${t('Focus')}</h1><div class="sub">${t('One thing. Full attention. The rest can wait.')}</div></div>
      <div class="row"><button class="btn" data-act="zen">${icon('expand', 16)}${t('Zen mode')}</button></div>
    </div>
    <div class="focus-layout">
      <section class="card focus-stage ${isBreak ? 'break' : ''} ${st}">
        <div class="seg">${modes.map(([k, l, ic]) => html`<button class="${modeKey === k ? 'on' : ''}" data-act="timer-mode" data-m="${k}" ${st !== 'idle' ? raw('disabled') : ''}>${icon(ic, 14)}<span class="${k === 'focus' || k === 'flow' ? '' : 'hide-m'}">${t(l)}</span></button>`)}</div>
        <div class="timer-wrap">
          ${timerRing(310, 12)}
          <div class="timer-center">
            <div class="eyebrow">${isBreak ? t('Break') : tm.flow ? t('Flow — counting up') : t('Focus')}</div>
            <div class="timer-clock num" data-clock>${Timer.clock()}</div>
            <div class="timer-label trunc">${label}</div>
            <div class="cycle" title="${t('Sessions until a long break')}">${Array.from({ length: s.longEvery }, (_, i) => html`<i class="${i < cyclePos ? 'on' : ''}"></i>`)}</div>
          </div>
        </div>
        ${focusControls(true)}
        <div class="focus-opts">
          <label class="field"><span>${t('Working on')}</span>
            <select class="select" data-change="timer-task"><option value="">${t('Open focus — no task')}</option>${tasks.map(x => html`<option value="${x.id}" ${x.id === tm.taskId ? raw('selected') : ''}>${x.title}${x.subjectId && subjectOf(x.subjectId) ? ` · ${subjName(x.subjectId)}` : ''}</option>`)}</select>
          </label>
          ${!task ? html`<label class="field"><span>${t('Subject')}</span><select class="select" data-change="timer-subject">${subjectOptions(tm.subjectId, t('Not set'))}</select></label>` : ''}
          ${st === 'idle' && !isBreak && !tm.flow ? html`<div class="field"><span>${t('Length')}</span><div class="row wrap" style="gap:6px">${[15, 25, 30, 45, 50, 60, 90].map(n => html`<button class="chip ${s.focusMin === n ? 'on' : ''}" data-act="timer-len" data-n="${n}">${n} ${t('min')}</button>`)}</div></div>` : ''}
          <div class="field"><span>${t('Ambience')}</span>
            <div class="row wrap" style="gap:6px">
              ${Sound.AMBIENCES.map(([k, l]) => html`<button class="chip ${s.ambience === k ? 'on' : ''}" data-act="ambience" data-k="${k}">${k !== 'off' ? icon('volume', 12) : ''}${t(l)}</button>`)}
              ${s.ambience !== 'off' ? html`<input type="range" class="range" min="0.05" max="1" step="0.05" value="${s.volume}" data-input="volume" aria-label="${t('Volume')}">` : ''}
            </div>
            ${s.ambience !== 'off' && st !== 'running' ? html`<div class="tiny faint">${t('Plays while a focus session is running.')}</div>` : ''}
          </div>
        </div>
      </section>

      <div class="col" style="gap:18px">
        <section class="card pad">
          <div class="row" style="gap:18px">
            ${ring(focus / goal, 84, 8, 'url(#orbitGrad)', html`<b class="num">${Math.min(999, Math.round(focus / goal * 100))}%</b>`)}
            <div class="grow"><div class="eyebrow">${t('Today')}</div><div class="big-num" style="font-size:28px">${fmtDur(focus)}</div><div class="small muted">${t('of your {n} goal', { n: fmtDur(goal) })}</div></div>
          </div>
          <div class="statline"><div><b class="num">${sessions.length}</b><span>${tn(sessions.length, 'session', 'sessions')}</span></div><div><b class="num">${streak()}</b><span>${t('day streak')}</span></div><div><b class="num">${fmtDur(focusMinRange(weekStart(today), today))}</b><span>${t('this week')}</span></div></div>
        </section>
        <section class="card pad">
          <div class="card-head"><h2 class="h2">${t('Today’s sessions')}</h2><button class="btn sm ghost" data-act="log-time">${icon('plus', 14)}${t('Log manually')}</button></div>
          ${sessions.length ? html`<div class="col" style="gap:2px">${sessions.map(x => { const tk = byId(state.tasks, x.taskId); const d = new Date(x.at); return html`
            <div class="sess" data-key="s-${x.id}">
              <span class="num faint small">${pad(d.getHours())}:${pad(d.getMinutes())}</span>
              <i class="dot" style="--c:${subjColor(x.subjectId)}"></i>
              <span class="grow trunc">${tk ? tk.title : subjName(x.subjectId) || t('Open focus')}</span>
              ${x.rating ? html`<span class="tiny faint">${t(['', 'Tough', 'Okay', 'Great'][x.rating])}</span>` : ''}
              <b class="num small">${fmtDur(x.min)}</b>
              <button class="btn icon sm ghost" data-act="del-session" data-id="${x.id}" title="${t('Remove')}">${icon('x', 13)}</button>
            </div>`; })}</div>`
            : html`<div class="small muted">${t('No sessions yet today. The first one is the hardest — start with just 15 minutes.')}</div>`}
        </section>
        <section class="card pad tip">
          <div class="row" style="gap:12px;align-items:flex-start">${icon('zap', 18)}<div class="small"><b>${t('How to make it count')}</b><div class="muted" style="margin-top:3px">${t('Phone in another room. One task on screen. When the timer ends, stand up — breaks are part of the method.')}</div></div></div>
        </section>
      </div>
    </div>
    ${ui.zen ? html`<div class="zen ${isBreak ? 'break' : ''}">
      <div class="zen-aurora"></div>
      <button class="btn ghost zen-exit" data-act="zen">${icon('shrink', 16)}${t('Exit')}</button>
      <div class="zen-body">
        <div class="eyebrow">${isBreak ? t('Break') : t('Focus')}</div>
        <div class="zen-clock num" data-clock>${Timer.clock()}</div>
        <div class="zen-label">${label}</div>
        ${focusControls(true)}
      </div>
    </div>` : ''}`;
  },
};

ACT['timer-toggle'] = () => Timer.toggle();
ACT['timer-reset'] = () => { Timer.reset(); };
ACT['timer-finish'] = () => Timer.finish();
ACT['timer-mode'] = el => { const m = el.dataset.m; if (m === 'flow') Timer.setMode('focus', true); else Timer.setMode(m, false); };
ACT['timer-len'] = el => commit(s => { s.settings.focusMin = +el.dataset.n; s.timer.total = 0; }, { noUndo: true });
ACT.zen = () => setUI(u => { u.zen = !u.zen; });
ACT.ambience = el => { commit(s => { s.settings.ambience = el.dataset.k; }, { noUndo: true }); Timer.syncAudio(); if (state.timer.status !== 'running' && el.dataset.k !== 'off') { Sound.play(el.dataset.k, state.settings.volume); clearTimeout(ACT.ambience._t); ACT.ambience._t = setTimeout(() => { if (state.timer.status !== 'running' || state.timer.mode !== 'focus') Sound.stop(); }, 3500); } };
ON.input.volume = el => { state.settings.volume = +el.value; Sound.setVolume(+el.value); scheduleSave(); };
ON.change['timer-task'] = el => commit(s => { const task = byId(s.tasks, el.value); s.timer.taskId = task ? task.id : ''; if (task) s.timer.subjectId = task.subjectId; }, { noUndo: true });
ON.change['timer-subject'] = el => commit(s => { s.timer.subjectId = el.value; }, { noUndo: true });
ACT['del-session'] = el => { commit(s => { s.sessions = s.sessions.filter(x => x.id !== el.dataset.id); }); toastUndo(t('Session removed')); };

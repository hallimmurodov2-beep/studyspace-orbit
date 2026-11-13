'use strict';
/* ───────────── focus timer engine ─────────────
   Timestamps, not counters: it stays correct through reloads, sleep and background tabs. */

const Timer = {
  modeMinutes(mode) { const s = state.settings; return mode === 'short' ? s.shortMin : mode === 'long' ? s.longMin : s.focusMin; },
  elapsed() { const tm = state.timer; return tm.acc + (tm.status === 'running' ? Date.now() - tm.segStart : 0); },
  remaining() { const tm = state.timer; return Math.max(0, (tm.total || this.modeMinutes(tm.mode) * MIN) - this.elapsed()); },
  active() { return state.timer.status !== 'idle'; },
  isFocus() { return state.timer.mode === 'focus'; },

  start(opts = {}) {
    const tm = state.timer;
    const mode = opts.mode || tm.mode || 'focus';
    const flow = opts.flow ?? (mode === 'focus' ? tm.flow : false);
    const task = byId(state.tasks, opts.taskId ?? tm.taskId);
    commit(s => {
      Object.assign(s.timer, {
        mode, flow, status: 'running', acc: 0, segStart: Date.now(), startedAt: Date.now(),
        total: flow ? 0 : (opts.minutes || this.modeMinutes(mode)) * MIN,
        taskId: task ? task.id : '', subjectId: opts.subjectId ?? (task ? task.subjectId : tm.subjectId),
      });
      if (task && task.status === 'todo' && mode === 'focus') task.status = 'doing';
    }, { noUndo: true });
    this.syncAudio();
    if (state.settings.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  },
  pause() {
    if (state.timer.status !== 'running') return;
    commit(s => { s.timer.acc = this.elapsed(); s.timer.status = 'paused'; }, { noUndo: true });
    this.syncAudio();
  },
  resume() {
    if (state.timer.status !== 'paused') return;
    commit(s => { s.timer.segStart = Date.now(); s.timer.status = 'running'; }, { noUndo: true });
    this.syncAudio();
  },
  toggle() { const st = state.timer.status; if (st === 'running') this.pause(); else if (st === 'paused') this.resume(); else this.start(); },
  /* discard without logging */
  reset() {
    commit(s => { Object.assign(s.timer, { status: 'idle', acc: 0, total: 0, segStart: 0 }); }, { noUndo: true });
    this.syncAudio(); this.paint();
  },
  setMode(mode, flow = false) {
    if (this.active()) return;
    commit(s => { s.timer.mode = mode; s.timer.flow = mode === 'focus' && flow; s.timer.total = 0; s.timer.acc = 0; }, { noUndo: true });
  },
  /* user ends the session now: keep the minutes that were actually studied */
  finish() {
    const tm = state.timer;
    if (!this.active()) return;
    if (tm.mode !== 'focus') { this.endBreak(false); return; }
    const mins = Math.round(this.elapsed() / MIN);
    if (mins < 1) { this.reset(); toast(t('Under a minute — nothing logged.')); return; }
    this.completeFocus(mins, false);
  },
  completeFocus(mins, auto, at) {
    const tm = state.timer;
    const sessionId = uid();
    const task = byId(state.tasks, tm.taskId);
    let next = 'short';
    commit(s => {
      s.sessions.push({ id: sessionId, date: ymd(new Date(at || tm.startedAt || Date.now())), at: at || tm.startedAt || Date.now(), min: mins, subjectId: tm.subjectId || (task ? task.subjectId : ''), taskId: tm.taskId || '', kind: 'focus', rating: 0 });
      s.timer.cycle = (s.timer.cycle || 0) + 1;
      next = s.timer.cycle % s.settings.longEvery === 0 ? 'long' : 'short';
      Object.assign(s.timer, { status: 'idle', acc: 0, total: 0, segStart: 0, mode: auto ? next : 'focus', flow: auto ? false : s.timer.flow });
    }, { noUndo: true });
    this.syncAudio(); this.paint();
    if (at) return;                                   // finished while the app was closed: log quietly
    Sound.chime();
    this.notify(t('Focus session complete'), t('{n} min logged. Time for a break.', { n: mins }));
    const goalHit = focusMinOn(todayStr()) >= state.settings.dailyGoal && focusMinOn(todayStr()) - mins < state.settings.dailyGoal;
    if (goalHit) confetti();
    this.sessionModal(sessionId, mins, task, goalHit);
    if (auto && state.settings.autoBreak) this.start({ mode: next });
  },
  endBreak(auto) {
    commit(s => { Object.assign(s.timer, { status: 'idle', acc: 0, total: 0, segStart: 0, mode: 'focus', flow: false }); }, { noUndo: true });
    this.syncAudio(); this.paint();
    if (auto) { Sound.soft(); this.notify(t('Break is over'), t('Ready for the next round?')); toast(t('Break is over — ready for the next round?'), { action: t('Start focus'), onAction: () => this.start({ mode: 'focus' }) }); }
  },
  tick() {
    const tm = state.timer;
    if (tm.status === 'running' && !tm.flow && tm.total && this.elapsed() >= tm.total) {
      if (tm.mode === 'focus') this.completeFocus(Math.round(tm.total / MIN), true);
      else this.endBreak(true);
      return;
    }
    this.paint();
  },
  /* called once at startup: if a session ran out while the app was closed, credit it */
  recover() {
    const tm = state.timer;
    if (tm.status === 'running' && !tm.flow && tm.total && this.elapsed() >= tm.total) {
      if (tm.mode === 'focus') { this.completeFocus(Math.round(tm.total / MIN), false, tm.startedAt); toast(t('Your last focus session finished while you were away — it has been logged.')); }
      else this.endBreak(false);
    } else if (tm.status === 'running' && tm.flow && this.elapsed() > 6 * 60 * MIN) {
      this.reset();
    }
  },
  clock() {
    const tm = state.timer;
    const ms = tm.flow && tm.mode === 'focus' ? this.elapsed() : this.remaining();
    const total = Math.round(ms / 1000), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  },
  progress() {
    const tm = state.timer;
    if (tm.flow && tm.mode === 'focus') return (this.elapsed() % (60 * MIN)) / (60 * MIN);
    const total = tm.total || this.modeMinutes(tm.mode) * MIN;
    return clamp(this.elapsed() / total, 0, 1);
  },
  paint() {
    const text = this.clock();
    for (const el of $$('[data-clock]')) if (el.textContent !== text) el.textContent = text;
    const p = this.progress();
    for (const el of $$('[data-timer-ring]')) {
      const c = +el.dataset.c;
      el.style.strokeDashoffset = (c * (1 - p)).toFixed(1);
    }
    for (const el of $$('[data-timer-dot]')) el.style.transform = `rotate(${(p * 360).toFixed(2)}deg)`;
    const title = this.active() ? `${text} · ${state.timer.mode === 'focus' ? t('Focus') : t('Break')} — Studyspace` : 'Studyspace Orbit';
    if (document.title !== title) document.title = title;
  },
  syncAudio() {
    const tm = state.timer, s = state.settings;
    if (tm.status === 'running' && tm.mode === 'focus' && s.ambience !== 'off') Sound.play(s.ambience, s.volume);
    else Sound.stop();
  },
  notify(title, body) {
    try { if (state.settings.notify && 'Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch (e) {}
  },
  sessionModal(sessionId, mins, task, goalHit) {
    const sub = subjectOf(state.sessions.find(x => x.id === sessionId)?.subjectId);
    openModal({
      title: goalHit ? t('Daily goal reached!') : t('Session complete'), cls: 'narrow',
      body: html`
        <div class="done-hero">
          ${ring(1, 96, 9, 'url(#orbitGrad)', html`<div><div class="big-num" style="font-size:26px">${mins}</div><div class="tiny faint">${t('min')}</div></div>`)}
          <div>
            <div class="h3">${task ? task.title : sub ? sub.name : t('Open focus')}</div>
            <div class="small muted">${t('Today')}: ${fmtDur(focusMinOn(todayStr()))} · ${t('goal')} ${fmtDur(state.settings.dailyGoal)}</div>
          </div>
        </div>
        <div class="field"><span>${t('How did it go?')}</span>
          <div class="rate">${[[1, 'Tough'], [2, 'Okay'], [3, 'Great']].map(([v, l]) => html`<label><input type="radio" name="rating" value="${v}"><span>${t(l)}</span></label>`)}</div>
        </div>
        ${task ? html`<label class="row" style="cursor:pointer"><span class="switch"><input type="checkbox" name="done"><i></i></span><span>${t('Mark “{title}” as done', { title: task.title })}</span></label>` : ''}`,
      foot: html`<button class="btn primary">${t('Save')}</button>`,
      onSubmit: d => {
        if (d.rating) commit(s => { const x = byId(s.sessions, sessionId); if (x) x.rating = +d.rating; }, { noUndo: true });
        if (d.done && task) { toggleTask(task.id, true); Sound.tick(); }
      },
    });
  },
};
setInterval(() => Timer.tick(), 500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) Timer.tick(); });

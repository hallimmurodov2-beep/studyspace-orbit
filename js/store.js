'use strict';
/* ───────────── state, persistence, undo ───────────── */

/* ?sandbox keeps a throw-away copy (used by the automated tests) so real data is never touched */
const SANDBOX = /[?&]sandbox\b/.test(location.search);
const STORE_KEY = SANDBOX ? 'studyspace.orbit.sandbox' : 'studyspace.orbit.v1';
const BACKUP_KEY = SANDBOX ? 'studyspace.orbit.sandbox.backups' : 'studyspace.orbit.backups';
const APP_VERSION = '2.3';

const PALETTE = ['#7b6cff', '#3d8bff', '#16b8c9', '#2fbf71', '#9ccc3c', '#f2b92f', '#ff8a3d', '#ff5d5d', '#ff5c9a', '#c264ff', '#8a94ab', '#b08968'];
const ACCENTS = { violet: '#7b6cff', blue: '#3d8bff', teal: '#14b8a6', green: '#2fbf71', orange: '#ff8a3d', pink: '#ff5c9a' };

function freshState() {
  return {
    v: 2, createdAt: Date.now(), updatedAt: Date.now(),
    profile: { name: '', school: '', grade: '', onboarded: false },
    settings: {
      theme: 'auto', accent: 'violet',
      focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4, autoBreak: true,
      dailyGoal: 90, windowStart: '15:00', windowEnd: '21:00',
      dayStart: 7, dayEnd: 23,
      remindAt: '',                     // evening homework reminder, 'HH:MM' or off
      gradeScale: 10, newPerDay: 15, sound: true, ambience: 'off', volume: 0.5, notify: false,
    },
    subjects: [], tasks: [], projects: [], lessons: [], events: [], exams: [],
    grades: [], decks: [], cards: [], sessions: [], notes: [], terms: defaultTerms(),
    termMarks: {},                       // official report-card marks: { subjectId: { termId: mark } }
    goals: {},                           // the mark aimed for: { subjectId: { termId: mark } }
    daysOff: [],                         // holidays and breaks: [{ id, name, start, end }] (dates inclusive)
    changes: {},                         // one-day timetable changes: { 'YYYY-MM-DD': { lessonId: '' = cancelled | subjectId = replaced by } }
    meta: { lastExport: 0, backupSnooze: 0, lastRemind: '' },   // bookkeeping that undo never rolls back
    reviewLog: {}, newLog: {},
    timer: { mode: 'focus', status: 'idle', flow: false, total: 0, acc: 0, segStart: 0, taskId: '', subjectId: '', cycle: 0, startedAt: 0 },
  };
}

let state = freshState();
let storageOK = true;
const undoStack = [];
let _renderHook = () => {};

function normalizeState(s) {
  const f = freshState();
  const out = { ...f, ...s };
  out.profile = { ...f.profile, ...(s.profile || {}) };
  out.settings = { ...f.settings, ...(s.settings || {}) };
  delete out.settings.lang;                                        // the interface is English only
  out.timer = { ...f.timer, ...(s.timer || {}) };
  out.meta = { ...f.meta, ...(s.meta && typeof s.meta === 'object' && !Array.isArray(s.meta) ? s.meta : {}) };
  for (const k of ['subjects', 'tasks', 'projects', 'lessons', 'events', 'exams', 'grades', 'decks', 'cards', 'sessions', 'notes'])
    if (!Array.isArray(out[k])) out[k] = [];
  if (!Array.isArray(out.terms) || !out.terms.length) out.terms = defaultTerms();
  out.terms = out.terms.filter(x => x && isYmd(x.start) && isYmd(x.end));
  /* v1 → v2: the 1–10 scale became the default; switch over when no grades were recorded yet */
  if ((s.v || 1) < 2) { if (out.settings.gradeScale === 5 && !out.grades.length) out.settings.gradeScale = 10; out.v = 2; }
  for (const k of ['reviewLog', 'newLog', 'termMarks', 'goals', 'changes']) if (!out[k] || typeof out[k] !== 'object' || Array.isArray(out[k])) out[k] = {};
  out.daysOff = (Array.isArray(out.daysOff) ? out.daysOff : []).filter(x => x && isYmd(x.start) && isYmd(x.end) && x.end >= x.start).map(x => ({ id: x.id || uid(), name: String(x.name || ''), start: x.start, end: x.end }));
  for (const d of Object.keys(out.changes)) if (!isYmd(d) || !out.changes[d] || typeof out.changes[d] !== 'object' || !Object.keys(out.changes[d]).length) delete out.changes[d];
  return out;
}

function loadState() {
  try {
    const rawStr = localStorage.getItem(STORE_KEY);
    if (rawStr) state = normalizeState(JSON.parse(rawStr));
  } catch (e) {
    storageOK = false;
    console.error('Could not read saved data', e);
  }
  applySettings();
}

let _saveTimer = 0;
function saveNow() {
  clearTimeout(_saveTimer); _saveTimer = 0;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    storageOK = true;
    dailyBackup();
    if (typeof FileBackup !== 'undefined') FileBackup.schedule();          // the linked backup file follows a moment later
    if (typeof Sync !== 'undefined') Sync.schedule();                      // and so do the other devices, when sync is on
  } catch (e) {
    if (storageOK) { storageOK = false; if (typeof toast === 'function') toast(t('Could not save — browser storage is full or blocked. Export a backup now.'), { kind: 'danger' }); }
  }
}
function scheduleSave() { if (!_saveTimer) _saveTimer = setTimeout(saveNow, 250); }

/* One automatic snapshot per day, last 7 kept: a safety net the user never has to think about. */
function dailyBackup() {
  try {
    const list = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    const day = todayStr();
    if (list.length && list[list.length - 1].day === day) return;
    if (!state.profile.onboarded) return;
    list.push({ day, data: JSON.stringify(state) });
    while (list.length > 7) list.shift();
    localStorage.setItem(BACKUP_KEY, JSON.stringify(list));
  } catch (e) { /* backups are best-effort */ }
}
function listBackups() { try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch (e) { return []; } }

/* Every mutation goes through commit(): snapshot for undo → mutate → save → render. */
function commit(fn, opts = {}) {
  if (!opts.noUndo) {
    const { timer, ...rest } = state;
    undoStack.push(JSON.stringify(rest));
    if (undoStack.length > 30) undoStack.shift();
  }
  fn(state);
  state.updatedAt = Date.now();
  scheduleSave();
  _renderHook();
}
function undo() {
  const snap = undoStack.pop();
  if (!snap) return false;
  const { timer, meta } = state;
  state = normalizeState(JSON.parse(snap));
  state.timer = timer; state.meta = meta;
  applySettings();
  scheduleSave();
  _renderHook();
  return true;
}
function replaceState(next) {
  const { timer, ...rest } = state;
  undoStack.push(JSON.stringify(rest));
  state = normalizeState(next);
  applySettings();
  saveNow();
  _renderHook();
}

function applySettings() {
  const s = state.settings;
  let th = s.theme;
  if (th === 'auto') th = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const root = document.documentElement;
  root.dataset.theme = th;
  root.dataset.accent = s.accent;
  root.lang = 'en';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = th === 'dark' ? '#0b0d13' : '#f4f5f9';
}

/* cross-tab: another tab saved → adopt it */
window.addEventListener('storage', e => {
  if (e.key !== STORE_KEY || !e.newValue) return;
  try { state = normalizeState(JSON.parse(e.newValue)); applySettings(); _renderHook(); } catch (err) { /* ignore */ }
});
window.addEventListener('pagehide', () => { if (_saveTimer) saveNow(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && _saveTimer) saveNow(); });

/* ───────────── selectors ───────────── */
const byId = (list, id) => list.find(x => x.id === id);
const subjectOf = id => byId(state.subjects, id);
const subjColor = id => (subjectOf(id) || {}).color || '#8a94ab';
const subjName = id => (subjectOf(id) || {}).name || '';
const isOpen = task => task.status !== 'done';
const openTasks = () => state.tasks.filter(isOpen);
const isOverdue = task => isOpen(task) && task.due && task.due < todayStr();

/* ── the school calendar: days off, and classes cancelled or replaced on one day ── */
const dayOff = date => state.daysOff.find(x => date >= x.start && date <= x.end) || null;
/* the classes of one calendar day: the weekly timetable, minus days off, with that day's changes applied */
function lessonsOn(date) {
  if (dayOff(date)) return [];
  const ch = state.changes[date], wd = dow(date);
  let list = state.lessons.filter(l => l.day === wd);
  if (ch) list = list.filter(l => ch[l.id] !== '').map(l => (ch[l.id] && ch[l.id] !== l.subjectId && subjectOf(ch[l.id]) ? { ...l, subjectId: ch[l.id], was: l.subjectId } : l));
  return list.sort((a, b) => a.start.localeCompare(b.start));
}
/* one class as it is on a given day (a replaced class carries the replacing subject) */
const lessonAt = (id, date) => lessonsOn(date).find(l => l.id === id) || byId(state.lessons, id) || null;
const cancelledOn = date => { const ch = state.changes[date]; return !ch || dayOff(date) ? [] : state.lessons.filter(l => l.day === dow(date) && ch[l.id] === ''); };
/* '' cancels the class on that day, a subject id replaces it, null puts the usual class back */
function setLessonChange(s, date, lessonId, value) {
  const day = s.changes[date] || {};
  if (value == null) delete day[lessonId]; else day[lessonId] = value;
  if (Object.keys(day).length) s.changes[date] = day; else delete s.changes[date];
}
/* marks one date as a day off, or makes it a school day again (a longer break is cut around it) */
function setDayOff(s, date, on, name = '') {
  const hit = s.daysOff.find(x => date >= x.start && date <= x.end);
  if (on) { if (!hit) s.daysOff.push({ id: uid(), name, start: date, end: date }); return; }
  if (!hit) return;
  s.daysOff = s.daysOff.filter(x => x !== hit);
  if (hit.start < date) s.daysOff.push({ id: uid(), name: hit.name, start: hit.start, end: addDays(date, -1) });
  if (hit.end > date) s.daysOff.push({ id: uid(), name: hit.name, start: addDays(date, 1), end: hit.end });
}
/* days with classes between two dates, both included */
function schoolDaysBetween(from, to) { let n = 0; for (let d = from, i = 0; d <= to && i < 400; d = addDays(d, 1), i++) if (lessonsOn(d).length) n++; return n; }
/* the break or holiday that comes next (or is on now), and how many school days are left before it */
function nextDayOff(from = todayStr()) {
  const off = state.daysOff.filter(x => x.end >= from).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (!off) return null;
  const on = off.start <= from;
  return { off, on, days: on ? 0 : diffDays(off.start, from), schoolDays: on ? 0 : schoolDaysBetween(from, addDays(off.start, -1)) };
}
/* public holidays in Tajikistan that fall inside a school year and always have the same date */
function tjHolidays(y = schoolYearStart()) {
  const n = y + 1;
  return [['Independence Day', y + '-09-09'], ['Constitution Day', y + '-11-06'], ['New Year', n + '-01-01'], ['Mother’s Day', n + '-03-08'], ['Navruz', n + '-03-21', n + '-03-24'], ['Victory Day', n + '-05-09']]
    .map(([name, start, end]) => ({ name, start, end: end || start }));
}
const eventsOn = date => state.events.filter(e => e.date === date).sort((a, b) => a.start.localeCompare(b.start));
const sessionsOn = date => state.sessions.filter(s => s.date === date);
const focusMinOn = date => sum(sessionsOn(date), s => s.min);
function focusMinRange(from, to) { return sum(state.sessions.filter(s => s.date >= from && s.date <= to), s => s.min); }
const taskLogged = id => sum(state.sessions.filter(s => s.taskId === id), s => s.min);

/* day streak: consecutive days with any focus time or reviews, ending today or yesterday */
function activeDays() {
  const set = new Set(state.sessions.map(s => s.date));
  for (const [d, n] of Object.entries(state.reviewLog)) if (n > 0) set.add(d);
  return set;
}
function streak() {
  const days = activeDays();
  let d = todayStr(), n = 0;
  if (!days.has(d)) d = addDays(d, -1);
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
function bestStreak() {
  const days = [...activeDays()].sort();
  let best = 0, run = 0, prev = '';
  for (const d of days) { run = prev && diffDays(d, prev) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

/* the day's agenda: lessons + events, merged and sorted */
function agendaOn(date) {
  const items = [
    ...lessonsOn(date).map(l => ({ kind: 'lesson', id: l.id, start: l.start, end: l.end, title: subjName(l.subjectId) || t('Class'), subjectId: l.subjectId, room: l.room })),
    ...eventsOn(date).map(e => ({ kind: 'event', id: e.id, start: e.start, end: e.end, title: e.title || subjName(e.subjectId) || t('Study block'), subjectId: e.subjectId || (byId(state.tasks, e.taskId) || {}).subjectId || '', taskId: e.taskId, done: e.done })),
  ];
  return items.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

/* ───────────── task rules ───────────── */
const PRIORITY = ['', 'Low', 'Medium', 'High'];
function newTask(props = {}) {
  return { id: uid(), title: '', subjectId: '', projectId: '', examId: '', due: '', planned: '', priority: 0, est: 0, status: 'todo', notes: '', steps: [], repeat: 'none', createdAt: Date.now(), doneAt: 0, ...props };
}
function nextRepeatDate(date, repeat) {
  const base = date && date >= todayStr() ? date : todayStr();
  if (repeat === 'daily') return addDays(base, 1);
  if (repeat === 'weekdays') { let d = addDays(base, 1); while (dow(d) > 5) d = addDays(d, 1); return d; }
  if (repeat === 'weekly') return addDays(date || todayStr(), 7) > todayStr() ? addDays(date || todayStr(), 7) : addDays(todayStr(), 7);
  if (repeat === 'biweekly') return addDays(date || todayStr(), 14);
  if (repeat === 'monthly') { const d = pd(date || todayStr()); d.setMonth(d.getMonth() + 1); return ymd(d); }
  return '';
}
/* toggles done; repeating tasks spawn their next occurrence */
function toggleTask(id, done) {
  commit(s => {
    const task = byId(s.tasks, id); if (!task) return;
    const toDone = done ?? task.status !== 'done';
    if (toDone) {
      task.status = 'done'; task.doneAt = Date.now();
      if (task.repeat && task.repeat !== 'none') {
        s.tasks.push(newTask({
          title: task.title, subjectId: task.subjectId, projectId: task.projectId, priority: task.priority, est: task.est,
          notes: task.notes, repeat: task.repeat, due: nextRepeatDate(task.due, task.repeat),
          steps: task.steps.map(st => ({ id: uid(), title: st.title, done: false })),
        }));
        task.repeat = 'none';
      }
    } else { task.status = 'todo'; task.doneAt = 0; }
  });
}
/* urgency score used by "Up next" and the auto-planner */
function taskScore(task) {
  const today = todayStr();
  let sc = (task.priority || 0) * 12;
  if (task.status === 'doing') sc += 10;
  if (task.due) {
    const d = diffDays(task.due, today);
    sc += d < 0 ? 80 + Math.min(20, -d * 2) : d === 0 ? 70 : d === 1 ? 50 : d <= 3 ? 34 : d <= 7 ? 20 : 6;
  }
  if (task.planned === today) sc += 40;
  return sc;
}
function suggestedTask() {
  const list = openTasks().slice().sort((a, b) => taskScore(b) - taskScore(a));
  return list[0] || null;
}

/* ───────────── exams & grades ───────────── */
function examReadiness(exam) {
  if (!exam.topics || !exam.topics.length) return null;
  return Math.round(sum(exam.topics, tp => tp.conf || 0) / (exam.topics.length * 3) * 100);
}
const upcomingExams = () => state.exams.filter(e => e.date >= todayStr()).sort((a, b) => a.date.localeCompare(b.date));

/* ── school terms (quarters / semesters) ── */
function schoolYearStart(date = todayStr()) { const d = pd(date); return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; }
function defaultTerms(kind = 'quarters', y = schoolYearStart()) {
  const n = y + 1;
  if (kind === 'semesters') return [
    { id: 'h1', name: '1st semester', start: y + '-09-01', end: n + '-01-15' },
    { id: 'h2', name: '2nd semester', start: n + '-01-16', end: n + '-05-31' },
  ];
  return [
    { id: 'q1', name: '1st quarter', start: y + '-09-01', end: y + '-11-02' },
    { id: 'q2', name: '2nd quarter', start: y + '-11-03', end: y + '-12-31' },
    { id: 'q3', name: '3rd quarter', start: n + '-01-01', end: n + '-03-22' },
    { id: 'q4', name: '4th quarter', start: n + '-03-23', end: n + '-05-31' },
  ];
}
const termOf = date => state.terms.find(x => date >= x.start && date <= x.end) || null;
/* the term we are in — or, during a break, the one that just ended */
function currentTerm() {
  const today = todayStr();
  return termOf(today) || state.terms.filter(x => x.end < today).sort((a, b) => b.end.localeCompare(a.end))[0] || state.terms[0] || null;
}
const inRange = (g, range) => !range || (g.date >= range.start && g.date <= range.end);
/* the mark a school writes on the report card: averages are rounded half-up (8.5 → 9) */
const roundMark = v => (v == null ? null : Math.floor(v + 0.5 + 1e-9));

function subjectAverage(subjectId, range) {
  const gs = state.grades.filter(g => g.subjectId === subjectId && inRange(g, range));
  if (!gs.length) return null;
  const scale = state.settings.gradeScale;
  const w = sum(gs, g => g.weight || 1);
  return sum(gs, g => (g.value / (g.max || scale)) * scale * (g.weight || 1)) / w;
}
/* ── official term marks: what the school actually wrote on the report card ── */
function officialMark(subjectId, termId) { const v = (state.termMarks[subjectId] || {})[termId]; return v == null ? null : v; }
/* a subject's result for a term: the official mark when recorded, otherwise the running average */
function termResult(subjectId, term) { const o = officialMark(subjectId, term.id); return o != null ? o : subjectAverage(subjectId, term); }
/* the year: mean of the term results once any official mark exists, otherwise the average of all grades */
function yearResult(subjectId) {
  const ts = state.terms;
  if (ts.some(x => officialMark(subjectId, x.id) != null)) { const vals = ts.map(x => termResult(subjectId, x)).filter(v => v != null); return vals.length ? sum(vals) / vals.length : null; }
  const first = ts.slice().sort((a, b) => a.start.localeCompare(b.start))[0], last = ts.slice().sort((a, b) => b.end.localeCompare(a.end))[0];
  return subjectAverage(subjectId, first ? { start: first.start, end: last.end } : undefined);
}
function overallAverage(range) {
  const avgs = state.subjects.map(s => subjectAverage(s.id, range)).filter(a => a != null);
  return avgs.length ? sum(avgs) / avgs.length : null;
}
function fmtGrade(v) {
  if (v == null) return '—';
  const sc = state.settings.gradeScale;
  if (sc === 100) return String(Math.round(v));
  const dp = sc === 10 ? 1 : 2, r = Math.round(v * 10 ** dp) / 10 ** dp;
  return String(r);
}

/* ── quarter goals ── */
function goalOf(subjectId, termId) { const v = (state.goals[subjectId] || {})[termId]; return v == null ? null : v; }
/* where a subject stands against its goal: the mark now, and what the next grade (or a run of top grades) must be */
function goalStatus(subjectId, term) {
  const goal = goalOf(subjectId, term.id); if (goal == null) return null;
  const scale = state.settings.gradeScale, ints = scale !== 100, lowest = ({ 5: 2, 10: 1 })[scale] ?? 0;
  const official = officialMark(subjectId, term.id);
  if (official != null) return { goal, mark: official, final: true, met: official >= goal };
  const gs = state.grades.filter(g => g.subjectId === subjectId && inRange(g, term));
  const W = sum(gs, g => g.weight || 1), S = sum(gs, g => g.value / (g.max || scale) * scale * (g.weight || 1));
  const avg = W ? S / W : null, mark = avg == null ? null : ints ? roundMark(avg) : Math.round(avg);
  const threshold = ints ? goal - 0.5 : goal;                     // half-up rounding: a 9 needs an average of 8.5
  const raw = threshold * (W + 1) - S;                           // the next grade, counted once
  const out = { goal, avg, mark, final: false, met: mark != null && mark >= goal, graded: gs.length };
  if (!gs.length) return { ...out, need: null };
  if (raw > scale + 1e-9) {
    const n = threshold >= scale ? Infinity : Math.ceil((threshold * W - S) / (scale - threshold) - 1e-9);
    return { ...out, need: Infinity, run: isFinite(n) && n <= 12 ? n : null };
  }
  return { ...out, need: raw <= lowest + 1e-9 ? lowest : ints ? Math.ceil(raw - 1e-9) : Math.ceil(raw) };
}

/* ── timetable helpers ── */
/* the next day that has classes (holidays and cancelled days are skipped) */
function nextSchoolDay(after = todayStr()) {
  if (!state.lessons.length) return '';
  for (let i = 1; i <= 60; i++) { const d = addDays(after, i); if (lessonsOn(d).length) return d; }
  return '';
}
/* change of a subject's result against the term before (null when either is missing) */
function termTrend(subjectId, term) {
  const ts = state.terms.slice().sort((a, b) => a.start.localeCompare(b.start)), i = ts.findIndex(x => x.id === term.id);
  if (i < 1) return null;
  const a = termResult(subjectId, ts[i - 1]), b = termResult(subjectId, term);
  return a == null || b == null ? null : b - a;
}
/* the next school day (after the given day) on which this subject has a class */
function nextLessonDate(subjectId, after = todayStr()) {
  if (!subjectId || !state.lessons.some(l => l.subjectId === subjectId)) return '';
  for (let i = 1; i <= 60; i++) { const d = addDays(after, i); if (lessonsOn(d).some(l => l.subjectId === subjectId)) return d; }
  return '';
}
/* 0 low … 3 excellent */
function gradeLevel(value, max) {
  const p = value / (max || state.settings.gradeScale);
  return p >= 0.9 ? 3 : p >= 0.7 ? 2 : p >= 0.5 ? 1 : 0;
}

/* ───────────── backup export / import ───────────── */
function exportBackup() {
  const stamp = todayStr();
  downloadFile(`studyspace-orbit-${stamp}.json`, JSON.stringify({ app: 'studyspace-orbit', exportedAt: new Date().toISOString(), state }, null, 1));
  commit(s => { s.meta.lastExport = Date.now(); }, { noUndo: true });
}
/* a reminder is worth showing once there is something to lose and no recent copy outside the browser */
function backupDue(now = Date.now()) {
  const m = state.meta, amount = state.tasks.length + state.grades.length + state.notes.length + state.cards.length + Object.keys(state.termMarks).length * 3;
  if (amount < 15 || now - (state.createdAt || now) < 3 * DAY || now < (m.backupSnooze || 0)) return false;
  if (typeof FileBackup !== 'undefined' && FileBackup.covers(now)) return false;      // a linked file is a backup already
  if (typeof Sync !== 'undefined' && Sync.on && now - Sync.syncedAt < 3 * DAY) return false;   // so is a working sync
  return now - (m.lastExport || 0) > 14 * DAY;
}

/* ── calendar export (.ics) — timetable as weekly repeats, plus study blocks, exams and deadlines ── */
function buildICS(now = new Date()) {
  const today = todayStr();
  const esc2 = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const dt = (date, time) => date.replace(/-/g, '') + (time ? 'T' + time.replace(':', '') + '00' : '');
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const fold = line => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); };
  const ev = (uidv, props) => ['BEGIN:VEVENT', 'UID:' + uidv + '@studyspace-orbit', 'DTSTAMP:' + stamp, ...props, 'END:VEVENT'];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Studyspace Orbit//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Studyspace'];
  const ts = state.terms.slice().sort((a, b) => a.start.localeCompare(b.start));
  const yearEnd = ts.length && ts[ts.length - 1].end >= today ? ts[ts.length - 1].end : addDays(today, 180);
  const BYDAY = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  for (const l of state.lessons) {
    let d = today; while (dow(d) !== l.day) d = addDays(d, 1);
    if (d > yearEnd) continue;
    /* days off and one-day changes become exceptions to the weekly repeat; a replacement is its own single event */
    const skip = [];
    for (let x = d; x <= yearEnd; x = addDays(x, 7)) {
      const ch = (state.changes[x] || {})[l.id];
      if (dayOff(x) || ch != null) skip.push(x);
      if (!dayOff(x) && ch && subjectOf(ch)) lines.push(...ev('swap-' + l.id + '-' + x, ['SUMMARY:' + esc2(subjName(ch)), 'DTSTART:' + dt(x, l.start), 'DTEND:' + dt(x, l.end), 'CATEGORIES:' + esc2(t('Class'))]));
    }
    lines.push(...ev('lesson-' + l.id, ['SUMMARY:' + esc2(subjName(l.subjectId) || t('Class')), 'DTSTART:' + dt(d, l.start), 'DTEND:' + dt(d, l.end),
      'RRULE:FREQ=WEEKLY;BYDAY=' + BYDAY[l.day] + ';UNTIL=' + dt(yearEnd) + 'T235959', ...(skip.length ? ['EXDATE:' + skip.map(x => dt(x, l.start)).join(',')] : []), ...(l.room ? ['LOCATION:' + esc2(l.room)] : []), 'CATEGORIES:' + esc2(t('Class'))]));
  }
  for (const x of state.daysOff.filter(x => x.end >= today && x.start <= yearEnd))
    lines.push(...ev('off-' + x.id, ['SUMMARY:' + esc2(x.name || t('No school')), 'DTSTART;VALUE=DATE:' + dt(x.start), 'DTEND;VALUE=DATE:' + dt(addDays(x.end, 1)), 'TRANSP:TRANSPARENT', 'CATEGORIES:' + esc2(t('No school'))]));
  for (const e of state.events.filter(x => x.date >= today && !x.done))
    lines.push(...ev('block-' + e.id, ['SUMMARY:' + esc2(e.title || t('Study block')), 'DTSTART:' + dt(e.date, e.start), 'DTEND:' + dt(e.date, e.end), 'CATEGORIES:' + esc2(t('Study block'))]));
  for (const x of state.exams.filter(x => x.date >= today)) {
    const name = esc2(x.title + (subjName(x.subjectId) ? ' · ' + subjName(x.subjectId) : ''));
    lines.push(...ev('exam-' + x.id, x.time
      ? ['SUMMARY:' + name, 'DTSTART:' + dt(x.date, x.time), 'DTEND:' + dt(x.date, fromMin(Math.min(1439, toMin(x.time) + 45))), ...(x.room ? ['LOCATION:' + esc2(x.room)] : []), 'CATEGORIES:' + esc2(t('Exam')), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + name, 'TRIGGER:-P1D', 'END:VALARM']
      : ['SUMMARY:' + name, 'DTSTART;VALUE=DATE:' + dt(x.date), 'DTEND;VALUE=DATE:' + dt(addDays(x.date, 1)), 'CATEGORIES:' + esc2(t('Exam'))]));
  }
  for (const x of state.tasks.filter(x => x.status !== 'done' && x.due && x.due >= today))
    lines.push(...ev('task-' + x.id, ['SUMMARY:' + esc2(t('Due') + ': ' + x.title), 'DTSTART;VALUE=DATE:' + dt(x.due), 'DTEND;VALUE=DATE:' + dt(addDays(x.due, 1)), 'TRANSP:TRANSPARENT', 'CATEGORIES:' + esc2(t('Task'))]));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
function exportICS() {
  downloadFile('studyspace-' + todayStr() + '.ics', buildICS(), 'text/calendar;charset=utf-8');
}

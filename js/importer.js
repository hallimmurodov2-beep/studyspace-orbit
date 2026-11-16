'use strict';
/* ───────────── import: Orbit backups + older Studyspace planners (v1 – v8) ───────────── */

const LEGACY_KEYS = ['studyspace.v8', 'studyspace.v7', 'studyspace.v6', 'studyspace.v5', 'studyspace.v4', 'studyspace.v3', 'studyspace.v2', 'studyspace.v1'];
const looksLegacy = o => o && typeof o === 'object' && Array.isArray(o.subjects) && Array.isArray(o.tasks) && typeof o.version === 'number';

/* The previous Studyspace keeps its planner in this browser under studyspace.v8 (or older).
   If this app is opened at the same address, we can read it directly — read-only. */
function findLegacyLocal() {
  for (const key of LEGACY_KEYS) {
    try {
      const rawStr = localStorage.getItem(key); if (!rawStr) continue;
      const obj = JSON.parse(rawStr);
      const cand = [obj, obj && obj.state, obj && obj.data].find(looksLegacy);
      if (cand && (cand.tasks.length || cand.subjects.length)) return cand;
    } catch (e) { /* keep looking */ }
  }
  return null;
}

function convertLegacy(L) {
  const s = freshState();
  const str = (v, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
  const date = v => (isYmd(v) ? v : '');
  const ts = v => { const n = typeof v === 'number' ? v : Date.parse(v); return isFinite(n) ? n : 0; };
  const list = k => (Array.isArray(L[k]) ? L[k].filter(x => x && typeof x === 'object') : []);
  /* the old app tags its sample entries; skip them when the user has real data of their own */
  const real = k => { const all = list(k); const own = all.filter(x => !x.example); return own.length || k === 'subjects' ? (k === 'subjects' ? all : own) : (L.demo ? [] : all); };

  const st = L.settings || {};
  s.profile = { name: str(st.studentName, 60), school: str(st.school, 100), grade: str(st.grade, 20), onboarded: true };
  s.settings.theme = state.settings.theme; s.settings.accent = state.settings.accent;
  if (st.focusMinutes > 0) s.settings.focusMin = clamp(Math.round(st.focusMinutes), 5, 180);
  if (st.shortBreak > 0) s.settings.shortMin = clamp(Math.round(st.shortBreak), 1, 30);
  if (st.longBreak > 0) s.settings.longMin = clamp(Math.round(st.longBreak), 5, 60);
  if (st.weeklyGoal > 0) s.settings.dailyGoal = clamp(Math.round(st.weeklyGoal / 5 / 15) * 15, 15, 600);

  const subjIds = new Set();
  s.subjects = list('subjects').map((x, i) => { subjIds.add(x.id); return { id: str(x.id, 100) || uid(), name: str(x.name, 60) || 'Subject', color: /^#[0-9a-f]{6}$/i.test(x.color) ? x.color : PALETTE[i % PALETTE.length], icon: guessSubjectIcon(str(x.name)), teacher: str(x.teacher, 80), room: str(x.room, 40) }; });
  const sub = id => (subjIds.has(id) ? id : '');
  const PR = { high: 3, medium: 2, low: 1 };
  const REP = { daily: 'daily', weekdays: 'weekdays', weekly: 'weekly', biweekly: 'biweekly', monthly: 'monthly' };

  s.projects = real('projects').map(p => ({ id: str(p.id, 100) || uid(), title: str(p.title, 160) || 'Project', subjectId: sub(p.subjectId), due: date(p.dueDate), notes: str(p.description), color: '', status: p.status === 'completed' ? 'done' : p.status === 'archived' ? 'archived' : 'active', createdAt: ts(p.createdAt) || Date.now(), milestones: (Array.isArray(p.milestones) ? p.milestones : []).map(m => ({ id: uid(), title: str(m.title, 200), done: !!m.done })) }));
  const projIds = new Set(s.projects.map(p => p.id));
  s.exams = real('exams').map(e => ({ id: str(e.id, 100) || uid(), title: str(e.title, 150) || 'Exam', subjectId: sub(e.subjectId), date: date(e.date) || todayStr(), time: '', room: '', notes: str(e.notes), topics: (Array.isArray(e.topics) ? e.topics : []).map(tp => ({ id: str(tp.id, 100) || uid(), title: str(tp.title, 200), conf: tp.done ? 3 : 0 })) }));
  const examIds = new Set(s.exams.map(e => e.id));
  s.tasks = real('tasks').map(x => newTask({
    id: str(x.id, 100) || uid(), title: str(x.title, 200) || 'Task', subjectId: sub(x.subjectId), projectId: projIds.has(x.projectId) ? x.projectId : '', examId: examIds.has(x.examId) ? x.examId : '', topicId: str(x.topicId, 100),
    due: date(x.dueDate), planned: date(x.plannedDate), priority: PR[x.priority] || 0, est: clamp(Math.round(+x.estimate || 0), 0, 600), status: x.status === 'done' ? 'done' : x.status === 'doing' ? 'doing' : 'todo',
    notes: str(x.notes), steps: (Array.isArray(x.steps) ? x.steps : []).map(st2 => ({ id: uid(), title: str(st2.title, 200), done: !!st2.done })), repeat: REP[x.repeat] || 'none', createdAt: ts(x.createdAt) || Date.now(), doneAt: x.status === 'done' ? (ts(x.completedAt) || Date.now()) : 0,
  }));
  const taskById = new Map(s.tasks.map(x => [x.id, x]));
  s.lessons = real('lessons').filter(l => isTime(l.start) && isTime(l.end) && l.day >= 1 && l.day <= 7).map(l => ({ id: uid(), day: l.day, subjectId: sub(l.subjectId), start: l.start, end: l.end, room: str(l.room, 40) }));
  s.events = real('blocks').filter(b => isYmd(b.date) && isTime(b.start) && isTime(b.end)).map(b => ({ id: uid(), title: str(b.title, 150), subjectId: (taskById.get(b.taskId) || {}).subjectId || '', taskId: taskById.has(b.taskId) ? b.taskId : '', date: b.date, start: b.start, end: b.end, done: false, auto: b.source === 'planner' }));
  s.sessions = list('sessions').filter(x => isYmd(x.date) && +x.minutes > 0).map(x => {
    let at = ts(x.endedAt) ? ts(x.endedAt) - x.minutes * MIN : 0;
    if (!at) { const d = pd(x.date); d.setHours(16, 0, 0, 0); at = d.getTime(); }
    return { id: uid(), date: x.date, at, min: clamp(Math.round(+x.minutes), 1, 720), subjectId: sub(x.subjectId) || (taskById.get(x.taskId) || {}).subjectId || '', taskId: taskById.has(x.taskId) ? x.taskId : '', kind: 'focus', rating: 0 };
  });
  const cards = real('cards');
  const deckFor = new Map();
  for (const c of cards) {
    const key = sub(c.subjectId);
    if (!deckFor.has(key)) { const d = { id: uid(), name: key ? subjName2(s, key) : t('General'), subjectId: key }; s.decks.push(d); deckFor.set(key, d.id); }
    const reviewed = (+c.repetitions || 0) > 0 && (+c.interval || 0) > 0;
    s.cards.push(newCard({ deckId: deckFor.get(key), front: str(c.front, 1000), back: str(c.back, 3000), state: reviewed ? 'review' : 'new', ivl: reviewed ? Math.round(+c.interval) : 0, reps: +c.repetitions || 0, lapses: +c.lapses || 0, due: reviewed && isYmd(c.dueDate) ? startOfDay(pd(c.dueDate).getTime()) : Date.now() }));
  }
  s.notes = real('notes').map(n => ({ id: uid(), title: str(n.title, 160), body: str(n.body, 20000), subjectId: sub(n.subjectId), projectId: projIds.has(n.projectId) ? n.projectId : '', pinned: false, updatedAt: ts(n.updatedAt) || Date.now() }));
  return s;
}
const subjName2 = (s, id) => (s.subjects.find(x => x.id === id) || {}).name || t('General');

function importLegacy(L) {
  let next;
  try { next = convertLegacy(L); } catch (e) { console.error(e); toast(t('That file could not be converted.'), { kind: 'danger' }); return false; }
  replaceState(next);
  toastUndo(t('Imported {a} tasks, {b} subjects and {c} sessions from Studyspace {v}', { a: next.tasks.length, b: next.subjects.length, c: next.sessions.length, v: L.version }));
  go('today');
  return true;
}

/* ───────────── packs from other Studyspace apps (Studyspace SAT) ─────────────
   A pack is not a backup: it is merged into the workspace. Every record in it carries a fixed id with the app's
   prefix ("sat-…"), so a second pack updates the same records instead of adding copies. What the student changed
   here is respected: a ticked-off task stays done, a renamed or recoloured subject keeps its name and colour,
   topics added by hand stay, and flashcards keep their review progress. One undo takes the whole merge back. */
const PACK_INBOX = 'studyspace.orbit.inbox';
const isPack = o => !!o && typeof o === 'object' && o.kind === 'orbit-pack' && Array.isArray(o.tasks);

function mergePack(pack) {
  if (!isPack(pack)) return null;
  const pre = /^[a-z][a-z0-9]{1,15}-$/.test(pack.prefix || '') ? pack.prefix : 'sat-';
  const str = (v, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
  const own = x => x && typeof x === 'object' && typeof x.id === 'string' && x.id.startsWith(pre) && x.id.length <= 120;
  const list = k => (Array.isArray(pack[k]) ? pack[k].filter(own) : []);
  const color = v => (/^#[0-9a-f]{6}$/i.test(v) ? v : '');
  /* shown in the "… plan updated" message: "SAT" for studyspace-sat, "IELTS" for studyspace-ielts */
  const label = /^studyspace-[a-z0-9]{2,12}$/.test(pack.app || '') ? pack.app.slice(11).toUpperCase() : 'Study';
  const n = { added: 0, updated: 0, removed: 0, tasks: 0, examDate: '', label };
  commit(s => {
    const upsert = (arr, item, keep) => {
      const i = arr.findIndex(x => x.id === item.id);
      if (i < 0) { arr.push(item); n.added++; } else { arr[i] = keep ? keep(arr[i], item) : { ...arr[i], ...item }; n.updated++; }
    };
    for (const x of list('subjects')) upsert(s.subjects, { id: x.id, name: str(x.name, 60) || 'Subject', color: color(x.color) || PALETTE[s.subjects.length % PALETTE.length], icon: str(x.icon, 30) || guessSubjectIcon(str(x.name)), teacher: str(x.teacher, 80), room: str(x.room, 40) },
      (old, nw) => ({ ...nw, name: old.name, color: old.color, icon: old.icon, teacher: old.teacher, room: old.room }));
    const subj = id => (s.subjects.some(x => x.id === id) ? id : '');
    for (const x of list('exams')) {
      if (!isYmd(x.date)) continue;
      const topics = (Array.isArray(x.topics) ? x.topics : []).filter(own).map(tp => ({ id: tp.id, title: str(tp.title, 200), conf: clamp(Math.round(+tp.conf || 0), 0, 3) }));
      upsert(s.exams, { id: x.id, title: str(x.title, 150) || 'Exam', subjectId: subj(x.subjectId), date: x.date, time: isTime(x.time) ? x.time : '', room: str(x.room, 40), notes: str(x.notes), topics },
        (old, nw) => ({ ...old, title: old.title || nw.title, subjectId: nw.subjectId || old.subjectId, date: nw.date, time: old.time || nw.time, notes: nw.notes,
          topics: [...nw.topics, ...(old.topics || []).filter(tp => !String(tp.id).startsWith(pre))] }));
      n.examDate = x.date;
    }
    const exam = id => (s.exams.some(x => x.id === id) ? id : '');
    const keep = new Set();
    for (const x of list('tasks')) {
      if (x.due && !isYmd(x.due)) continue;
      const done = x.status === 'done';
      const task = newTask({ id: x.id, title: str(x.title, 200) || 'Task', subjectId: subj(x.subjectId), examId: exam(x.examId), due: isYmd(x.due) ? x.due : '', planned: isYmd(x.planned) ? x.planned : '',
        priority: clamp(Math.round(+x.priority || 0), 0, 3), est: clamp(Math.round(+x.est || 0), 0, 600), status: done ? 'done' : 'todo', notes: str(x.notes), doneAt: done ? Date.now() : 0 });
      keep.add(task.id); n.tasks++;
      upsert(s.tasks, task, (old, nw) => {
        const isDone = old.status === 'done' || nw.status === 'done';
        return { ...old, title: nw.title, subjectId: nw.subjectId, examId: nw.examId, due: nw.due, planned: nw.planned, priority: nw.priority, est: nw.est, notes: nw.notes,
          status: isDone ? 'done' : old.status, doneAt: isDone ? (old.doneAt || Date.now()) : 0 };
      });
    }
    /* planned days that the other app no longer plans (and that were not done) disappear */
    const rep = pack.replace && typeof pack.replace === 'object' ? pack.replace : null;
    if (rep && typeof rep.prefix === 'string' && rep.prefix.startsWith(pre) && isYmd(rep.from)) {
      const before = s.tasks.length;
      s.tasks = s.tasks.filter(x => !(x.id.startsWith(rep.prefix) && !keep.has(x.id) && x.status !== 'done' && x.due && x.due >= rep.from));
      n.removed += before - s.tasks.length;
    }
    for (const x of list('sessions')) {
      if (!isYmd(x.date) || !(+x.min > 0)) continue;
      upsert(s.sessions, { id: x.id, date: x.date, at: isFinite(+x.at) && +x.at > 0 ? +x.at : pd(x.date).getTime(), min: clamp(Math.round(+x.min), 1, 720), subjectId: subj(x.subjectId), taskId: '', kind: 'focus', rating: 0 });
    }
    for (const x of list('decks')) upsert(s.decks, { id: x.id, name: str(x.name, 80) || 'Deck', subjectId: subj(x.subjectId) }, (old, nw) => ({ ...nw, name: old.name }));
    const deck = id => (s.decks.some(x => x.id === id) ? id : '');
    for (const x of list('cards')) {
      if (!deck(x.deckId)) continue;
      upsert(s.cards, newCard({ id: x.id, deckId: x.deckId, front: str(x.front, 1000), back: str(x.back, 3000) }), (old, nw) => ({ ...old, front: nw.front, back: nw.back }));
    }
  });
  return n;
}
function packSummary(r) {
  return t('{l} plan updated: {a} study days{b}', { l: r.label, a: r.tasks, b: r.examDate ? t(', exam on {d}', { d: fmtDate(r.examDate) }) : '' });
}
/* Studyspace SAT on the same address leaves its pack in localStorage; pick it up when Orbit is open */
function checkPackInbox() {
  if (SANDBOX || !state.profile.onboarded) return;
  let raw = null;
  try { raw = localStorage.getItem(PACK_INBOX); } catch (e) { return; }
  if (!raw) return;
  try { localStorage.removeItem(PACK_INBOX); } catch (e) { /* ignore */ }
  let pack; try { pack = JSON.parse(raw); } catch (e) { return; }
  const r = mergePack(pack);
  if (r) toastUndo(packSummary(r));
}

function importAny(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { toast(t('That is not a valid JSON backup file.'), { kind: 'danger' }); return false; }
  if (isPack(obj)) {
    if (!state.profile.onboarded) { toast(t('Set up Orbit first, then import this plan from Settings.'), { kind: 'danger' }); return false; }
    const r = mergePack(obj); if (!r) return false;
    toastUndo(packSummary(r)); go('exams'); return true;
  }
  if (obj && obj.app === 'studyspace-orbit' && obj.state && Array.isArray(obj.state.tasks)) {
    const next = normalizeState(obj.state); next.profile.onboarded = true;
    replaceState(next); toastUndo(t('Backup restored')); go('today'); return true;
  }
  if (obj && obj.v === 1 && obj.profile && Array.isArray(obj.tasks)) { const next = normalizeState(obj); next.profile.onboarded = true; replaceState(next); toastUndo(t('Backup restored')); go('today'); return true; }
  const legacy = [obj, obj && obj.state, obj && obj.data, obj && obj.planner].find(looksLegacy);
  if (legacy) return importLegacy(legacy);
  toast(t('This file is not a Studyspace backup.'), { kind: 'danger' });
  return false;
}

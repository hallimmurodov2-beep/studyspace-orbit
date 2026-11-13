'use strict';
/* ───────────── demo workspace: a believable school week, generated relative to today ───────────── */

/* the rest of a typical grade-10 curriculum — offered on the welcome screen, switched off until picked */
const EXTRA_SUBJECTS = [
  ['lit', 'Literature', '#ff8a3d', 'pen'], ['tjh', 'History of the Tajik people', '#b08968', 'landmark'],
  ['hrt', 'Human rights', '#3d8bff', 'star'], ['fam', 'Family life culture', '#ff5c9a', 'book'],
  ['ast', 'Astronomy', '#7b6cff', 'compass'], ['geg', 'Geography', '#16b8c9', 'globe'],
  ['pe', 'Physical education', '#2fbf71', 'ball'], ['tec', 'Technology', '#8a94ab', 'brush'],
  ['mil', 'Initial military training', '#9ccc3c', 'star'],
];
const DEFAULT_SUBJECTS = [
  ['alg', 'Algebra', '#7b6cff', 'sigma'], ['geo', 'Geometry', '#3d8bff', 'triangle'],
  ['phy', 'Physics', '#ff8a3d', 'atom'], ['che', 'Chemistry', '#16b8c9', 'flask'],
  ['bio', 'Biology', '#2fbf71', 'leaf'], ['eng', 'English', '#ff5c9a', 'chat'],
  ['rus', 'Russian', '#ff5d5d', 'pen'], ['taj', 'Tajik', '#f2b92f', 'book'],
  ['his', 'History', '#b08968', 'landmark'], ['inf', 'Informatics', '#c264ff', 'code'],
];
/* other names a subject goes by on a class sheet — so a pasted “State language 8” finds a subject called “Tajik” */
const SUBJECT_ALIASES = {
  alg: ['math', 'mathematics', 'maths'], geo: [], phy: [], che: [], bio: [],
  eng: ['english language'],
  rus: ['russian language'],
  taj: ['tajik language', 'state language'],
  his: ['general history', 'world history'],
  inf: ['computer science', 'ict', 'it', 'information technology', 'information technologies'],
  lit: [], tjh: ['tajik history'],
  hrt: [], fam: [], ast: [], geg: [],
  pe: ['pe', 'sport'], tec: [],
  mil: ['military training'],
};
const normName = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/* abbreviations word by word: “Inform. technology” ↔ “Information technology” */
const abbrOf = (a, b) => { const A = a.split(' '), B = b.split(' '); return A.length === B.length && A.every((w, i) => w.length >= 3 && B[i].startsWith(w)); };
function subjectKeyOf(name) {
  const n = normName(name);
  const names = ([k, en]) => [normName(en), ...(SUBJECT_ALIASES[k] || [])];
  const all = [...DEFAULT_SUBJECTS, ...EXTRA_SUBJECTS];
  const hit = all.find(x => names(x).includes(n)) || all.find(x => names(x).some(m => abbrOf(n, m)));
  return hit ? hit[0] : '';
}
function findSubjectByName(name, subjects = state.subjects) {
  const n = normName(name); if (!n) return null;
  const exact = subjects.find(s => normName(s.name) === n); if (exact) return exact;
  const key = subjectKeyOf(n);
  if (key) { const same = subjects.find(s => subjectKeyOf(s.name) === key); if (same) return same; }
  return subjects.find(s => { const m = normName(s.name); return abbrOf(n, m) || abbrOf(m, n); }) || null;
}
/* “Physics 7”, “3. Chemistry — 10”, “Biology: 9” → [{ name, value }] */
function parseMarkLines(text) {
  const out = [];
  for (const line of String(text).split(/[\n;]+|,\s*(?=\p{L})/u)) {
    const m = line.match(/^\s*(?:\d+[.)]\s+)?(\p{L}[^\d]*?)[\s:=–—|-]*(\d+(?:[.,]\d+)?)\s*$/u);
    if (m) out.push({ name: m[1].replace(/[\s:=–—|.-]+$/, '').trim(), value: parseFloat(m[2].replace(',', '.')) });
  }
  return out;
}
/* a subject record for a name the app has not seen: the curriculum name, colour and icon when it is a known one */
function subjectFromName(name, taken = state.subjects.length) {
  const key = subjectKeyOf(name), known = key && [...DEFAULT_SUBJECTS, ...EXTRA_SUBJECTS].find(x => x[0] === key);
  const clean = String(name).trim().replace(/\s+/g, ' ');
  return known ? { id: uid(), name: known[1], color: known[2], icon: known[3], teacher: '', room: '' }
    : { id: uid(), name: clean.charAt(0).toUpperCase() + clean.slice(1), color: PALETTE[taken % PALETTE.length], icon: guessSubjectIcon(clean), teacher: '', room: '' };
}

function guessSubjectIcon(name) {
  const n = name.toLowerCase();
  const map = [[/alg|math/, 'sigma'], [/geom/, 'triangle'], [/phys/, 'atom'], [/chem/, 'flask'], [/bio/, 'leaf'], [/hist/, 'landmark'], [/inform|comput|program|code|ict/, 'code'], [/geogr/, 'globe'], [/liter/, 'pen'], [/engl|russ|taj|lang|french|german|spanish/, 'chat'], [/music/, 'music'], [/sport|pe|physical ed/, 'ball'], [/art|drawing/, 'brush'], [/astro/, 'compass']];
  const hit = map.find(([re]) => re.test(n));
  return hit ? hit[1] : 'book';
}

function demoState(profile = {}, settings = {}) {
  const s = freshState();
  const today = todayStr(), now = Date.now(), rnd = seeded(20261111);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  s.profile = { name: profile.name || '', school: profile.school || 'City Lyceum', grade: profile.grade || '10', onboarded: true };
  Object.assign(s.settings, settings);
  s.createdAt = now - 62 * DAY;
  const sid = k => 's_' + k;
  s.subjects = DEFAULT_SUBJECTS.map(([k, en, color, ic]) => ({ id: sid(k), name: en, color, icon: ic, teacher: '', room: '' }));

  /* timetable */
  const TT = { 1: ['alg', 'taj', 'phy', 'eng', 'his'], 2: ['geo', 'rus', 'che', 'phy', 'inf'], 3: ['taj', 'eng', 'bio', 'che', 'alg'], 4: ['rus', 'phy', 'his', 'bio', 'geo'], 5: ['eng', 'che', 'inf', 'his', 'alg'] };
  const slots = [['08:00', '08:45'], ['08:55', '09:40'], ['09:50', '10:35'], ['10:55', '11:40'], ['11:50', '12:35']];
  const rooms = { alg: '204', geo: '204', phy: '310', che: '312', bio: '108', eng: '215', rus: '117', taj: '119', his: '221', inf: '401' };
  for (const [day, list] of Object.entries(TT)) list.forEach((k, i) => s.lessons.push({ id: uid(), day: +day, subjectId: sid(k), start: slots[i][0], end: slots[i][1], room: rooms[k] }));

  /* projects */
  const pHist = { id: 'p_hist', title: 'History research paper', subjectId: sid('his'), due: addDays(today, 12), notes: '1,500 words on the Samanid state. At least five sources.', color: '', status: 'active', createdAt: now - 9 * DAY,
    milestones: [['Choose a topic', true], ['Collect sources', false], ['First draft', false], ['Final version', false]].map(([title, done]) => ({ id: uid(), title, done })) };
  const pSci = { id: 'p_sci', title: 'Science fair: water filter', subjectId: sid('che'), due: addDays(today, 24), notes: '', color: '', status: 'active', createdAt: now - 5 * DAY,
    milestones: [['Research filter materials', true], ['Build prototype', false], ['Poster', false]].map(([title, done]) => ({ id: uid(), title, done })) };
  s.projects = [pHist, pSci];

  /* tasks */
  const T = (title, sub, due, pr, est, extra = {}) => newTask({ title, subjectId: sid(sub), due: due === null ? '' : addDays(today, due), priority: pr, est, createdAt: now - (3 + Math.floor(rnd() * 6)) * DAY, ...extra });
  const quad = T('Practice quadratic equations', 'alg', 0, 3, 40, { status: 'doing', steps: [['Review one worked example', true], ['Solve exercises 1–8', false], ['Check and correct mistakes', false]].map(([title, done]) => ({ id: uid(), title, done })) });
  const motion = T('Motion worksheet №4', 'phy', 1, 2, 30);
  const lab = T('Lab report: reaction rates', 'che', 3, 3, 60);
  const vocab = T('Learn 15 new vocabulary words', 'eng', 2, 1, 20, { repeat: 'weekly' });
  s.tasks = [
    quad,
    T('Read and annotate the short story, ch. 3', 'eng', 0, 2, 25),
    motion, vocab, lab,
    T('Geometry proofs, set B', 'geo', -1, 2, 30),
    T('Review cell structure', 'bio', 3, 1, 25),
    T('Find five sources', 'his', 2, 2, 45, { projectId: 'p_hist' }),
    T('Write the essay outline', 'his', 5, 2, 40, { projectId: 'p_hist' }),
    T('Test charcoal vs sand filter', 'che', 8, 1, 50, { projectId: 'p_sci' }),
    T('Python: loops exercises', 'inf', 6, 1, 40),
    T('Memorise the poem for recitation', 'taj', 4, 2, 20),
    T('Dictation corrections', 'rus', null, 0, 15),
  ];
  const doneTitles = [['Organise geometry notes', 'geo'], ['Chemistry: balance equations', 'che'], ['Read chapter 2', 'eng'], ['History timeline', 'his'], ['Algebra homework №12', 'alg'], ['Biology diagram: the cell', 'bio'], ['Physics: units quiz prep', 'phy'], ['Informatics: flowcharts', 'inf'], ['Russian essay draft', 'rus'], ['Tajik grammar exercises', 'taj']];
  const doneTasks = doneTitles.map(([title, sub], i) => {
    const dAgo = Math.floor(i * 1.4);
    return newTask({ title, subjectId: sid(sub), status: 'done', due: addDays(today, -dAgo + (rnd() < 0.8 ? 0 : -1)), est: pick([20, 30, 40, 45]), priority: pick([0, 1, 2]), createdAt: now - (dAgo + 4) * DAY, doneAt: startOfDay(now - dAgo * DAY) + (i === 0 ? Math.max(1, nowMin() - 30) : 17 * 60 + Math.floor(rnd() * 180)) * MIN });
  }).filter(x => x.doneAt < now);
  s.tasks.push(...doneTasks);

  /* exams */
  const tp = (title, conf) => ({ id: uid(), title, conf });
  s.exams = [
    { id: 'e_eng', title: 'Vocabulary quiz: unit 4', subjectId: sid('eng'), date: addDays(today, 2), time: '09:50', room: '215', notes: '', topics: [tp('Travel & transport words', 3), tp('Phrasal verbs', 2), tp('Irregular verbs', 2)] },
    { id: 'e_alg', title: 'Quadratic equations test', subjectId: sid('alg'), date: addDays(today, 6), time: '08:00', room: '204', notes: 'Calculator allowed. Bring a ruler.', topics: [tp('Factoring', 3), tp('Quadratic formula', 2), tp('Discriminant', 1), tp('Word problems', 0)] },
    { id: 'e_phy', title: 'Motion and forces', subjectId: sid('phy'), date: addDays(today, 13), time: '', room: '310', notes: '', topics: [tp('Speed and acceleration', 2), tp('Newton’s three laws', 1), tp('Friction', 0), tp('Free-body diagrams', 0)] },
    { id: 'e_bio', title: 'Cell biology test', subjectId: sid('bio'), date: addDays(today, -9), time: '', room: '108', notes: '', topics: [tp('Organelles', 3), tp('Mitosis', 3)] },
  ];

  /* grades */
  const scale = s.settings.gradeScale;
  const base = { alg: 4.3, geo: 3.9, phy: 3.8, che: 4.2, bio: 4.6, eng: 4.8, rus: 4.0, taj: 4.5, his: 4.2, inf: 4.9 };
  const kinds = ['classwork', 'homework', 'quiz', 'test', 'classwork', 'homework'];
  const gTitles = { quiz: 'Quiz', test: 'Unit test', homework: 'Homework', classwork: 'Answer in class', exam: 'Exam' };
  /* marks spread from the first day of school until today, so every term so far has a real average */
  const yearStart = s.terms.slice().sort((a, b) => a.start.localeCompare(b.start))[0].start;
  const span = Math.max(14, diffDays(today, yearStart));
  for (const [k] of DEFAULT_SUBJECTS) {
    const n = Math.round(span / 7) + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const kind = pick(kinds), noise = (rnd() + rnd() - 1) * 1.7, trend = i / n * 0.25;   // roughly bell-shaped, slowly improving
      const p = clamp((base[k] + noise * 0.5 + trend) / 5, 0.3, 1);
      const value = scale === 5 ? clamp(Math.round(p * 5), 2, 5) : scale === 10 ? clamp(Math.round(p * 10), 3, 10) : clamp(Math.round(p * 100 - rnd() * 6), 30, 100);
      let date = addDays(yearStart, Math.round((i + 0.5) * span / n + rnd() * 3 - 1.5));
      if (date > today) date = today;
      while (dow(date) > 5) date = addDays(date, -1);
      if (date < yearStart) date = yearStart;
      s.grades.push({ id: uid(), subjectId: sid(k), title: `${gTitles[kind]} ${i + 1}`, kind, value, max: scale, weight: kind === 'test' ? 2 : 1, date });
    }
  }

  /* quarters that are already over have their official report-card mark */
  for (const tr of s.terms.filter(x => x.end < today)) for (const sub of s.subjects) {
    const gs = s.grades.filter(g => g.subjectId === sub.id && g.date >= tr.start && g.date <= tr.end);
    if (gs.length) (s.termMarks[sub.id] ||= {})[tr.id] = Math.floor(sum(gs, g => g.value * g.weight) / sum(gs, g => g.weight) + 0.5);
  }

  /* goals for the current quarter: most within reach, a few a step above the current mark */
  const cur = s.terms.find(x => x.start <= today && x.end >= today);
  if (cur) s.subjects.forEach((sub, i) => {
    const gs = s.grades.filter(g => g.subjectId === sub.id && g.date >= cur.start && g.date <= cur.end);
    if (!gs.length || i % 5 === 4) return;
    const m = Math.floor(sum(gs, g => g.value * g.weight) / sum(gs, g => g.weight) + 0.5);
    (s.goals[sub.id] ||= {})[cur.id] = Math.min(scale === 100 ? 100 : scale, m + (i % 3 === 0 ? 1 : 0));
  });

  /* holidays and breaks of this school year — except any that would empty the sample week itself */
  {
    const y = schoolYearStart(today), n = y + 1;
    const offs = [...tjHolidays(y).filter(h => h.name !== 'Navruz' && h.name !== 'New Year'), { name: 'Winter break', start: y + '-12-28', end: n + '-01-10' }, { name: 'Spring break', start: n + '-03-21', end: n + '-03-29' }];
    s.daysOff = offs.filter(h => h.end < addDays(today, -8) || h.start > addDays(today, 10)).map((h, i) => ({ id: 'off' + i, ...h }));
  }

  /* flashcards */
  const mk = (deckId, front, back, i) => {
    const r = rnd();
    if (r < 0.22) return newCard({ deckId, front, back });
    if (r < 0.34) return newCard({ deckId, front, back, state: 'learn', step: 1, due: now - 5 * MIN, reps: 1, last: now - 20 * MIN });
    const ivl = pick([1, 2, 3, 5, 8, 13, 24, 30, 45]);
    const dueIn = r < 0.62 ? -Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * Math.min(ivl, 12));
    return newCard({ deckId, front, back, state: 'review', ivl, ease: 2.3 + rnd() * 0.5, reps: 3 + i % 5, lapses: rnd() < 0.2 ? 1 : 0, due: startOfDay(now) + dueIn * DAY, last: now - ivl * DAY });
  };
  const decks = [
    ['d_eng', 'English — irregular verbs', 'eng', [['go', 'went — gone'], ['take', 'took — taken'], ['write', 'wrote — written'], ['bring', 'brought — brought'], ['choose', 'chose — chosen'], ['fly', 'flew — flown'], ['speak', 'spoke — spoken'], ['teach', 'taught — taught'], ['begin', 'began — begun'], ['drive', 'drove — driven'], ['forget', 'forgot — forgotten'], ['catch', 'caught — caught'], ['swim', 'swam — swum'], ['wear', 'wore — worn']]],
    ['d_phy', 'Physics formulas', 'phy', [['Speed', 'v = s / t'], ['Acceleration', 'a = (v − v₀) / t'], ['Newton’s second law', 'F = m · a'], ['Weight', 'F = m · g'], ['Density', 'ρ = m / V'], ['Pressure', 'p = F / S'], ['Work', 'A = F · s'], ['Power', 'N = A / t'], ['Kinetic energy', 'E = m·v² / 2'], ['Potential energy', 'E = m · g · h']]],
    ['d_bio', 'Biology — the cell', 'bio', [['Mitochondria', 'Produce energy (ATP) through cellular respiration'], ['Ribosome', 'Builds proteins from amino acids'], ['Nucleus', 'Stores DNA and controls the cell'], ['Chloroplast', 'Photosynthesis in plant cells'], ['Cell membrane', 'Controls what enters and leaves the cell'], ['Golgi apparatus', 'Packages and ships proteins'], ['Lysosome', 'Digests waste with enzymes'], ['Cell wall', 'Rigid outer layer of plant cells (cellulose)']]],
  ];
  for (const [id, name, sub, cards] of decks) { s.decks.push({ id, name, subjectId: sid(sub) }); cards.forEach(([f, b], i) => s.cards.push(mk(id, f, b, i))); }

  /* focus history: 9 weeks, gently trending upward, never missing the last week */
  const weights = ['alg', 'alg', 'alg', 'phy', 'phy', 'che', 'che', 'eng', 'eng', 'bio', 'his', 'his', 'geo', 'geo', 'inf', 'rus', 'taj'];
  for (let back = 62; back >= 1; back--) {
    const date = addDays(today, -back), wd = dow(date);
    const p = back <= 6 ? 1 : (wd > 5 ? 0.45 : 0.82) * (0.7 + (62 - back) / 62 * 0.3);
    if (rnd() > p) continue;
    const count = 1 + Math.floor(rnd() * (wd > 5 ? 2 : 3.4) * (back <= 30 ? 1 : 0.6));
    let minute = (wd > 5 ? 10 : 15) * 60 + Math.floor(rnd() * 90);
    for (let i = 0; i < count; i++) {
      const min = pick([25, 25, 25, 30, 45, 45, 50]);
      s.sessions.push({ id: uid(), date, at: startOfDay(pd(date).getTime()) + minute * MIN, min, subjectId: sid(pick(weights)), taskId: '', kind: 'focus', rating: rnd() < 0.7 ? pick([3, 3, 2, 2, 2, 1]) : 0 });
      minute += min + 10 + Math.floor(rnd() * 50);
    }
    s.reviewLog[date] = 6 + Math.floor(rnd() * 26);
  }
  if (nowMin() > 9 * 60) {
    const at = now - Math.min(200, nowMin() - 7 * 60) * MIN;
    s.sessions.push({ id: uid(), date: today, at, min: 25, subjectId: sid('alg'), taskId: quad.id, kind: 'focus', rating: 3 });
    s.reviewLog[today] = 9;
  }
  /* some completed tasks carry logged time, so "estimates vs reality" has data */
  doneTasks.slice(0, 6).forEach(tk => { const d = ymd(new Date(tk.doneAt)); const ses = s.sessions.find(x => x.date === d && !x.taskId); if (ses) { ses.taskId = tk.id; ses.subjectId = tk.subjectId; ses.min = Math.round(tk.est * (0.9 + rnd() * 0.6) / 5) * 5; } });

  /* study blocks */
  const ev = (task, dayOff, start, end) => ({ id: uid(), title: task.title, subjectId: task.subjectId, taskId: task.id, date: addDays(today, dayOff), start, end, done: false, auto: false });
  s.events = [ev(quad, 0, '16:00', '16:40'), ev(motion, 0, '17:00', '17:30'), ev(lab, 1, '16:00', '16:50'), ev(vocab, 1, '17:15', '17:35'), ev(lab, 2, '16:30', '17:00')];

  /* notes */
  s.notes = [
    { id: uid(), title: 'Quadratic formula — cheat sheet', subjectId: sid('alg'), projectId: '', pinned: true, updatedAt: now - 2 * 3600e3, body:
      '## The formula\n`x = (−b ± √(b² − 4ac)) / 2a`\n\n## Discriminant\n- **D > 0** — two real roots\n- **D = 0** — one root\n- **D < 0** — no real roots\n\n## Before the test\n- [x] Factoring practice\n- [ ] 10 word problems\n- [ ] Redo the mistakes from homework 12\n\n> Always check by substituting the roots back in.' },
    { id: uid(), title: 'Newton’s laws in my own words', subjectId: sid('phy'), projectId: '', pinned: false, updatedAt: now - 2 * DAY, body:
      '1. Things keep doing what they are doing unless a force acts on them.\n2. More force — more acceleration; more mass — less. **F = m · a**\n3. Every push gets an equal push back.\n\nInertia - the tendency of a body to resist changes in motion\nNet force - the sum of all forces acting on a body' },
    { id: uid(), title: 'Paper ideas: the Samanids', subjectId: sid('his'), projectId: 'p_hist', pinned: false, updatedAt: now - 4 * DAY, body:
      '- Why Bukhara became a centre of learning\n- Ismail Somoni and state-building\n- Rudaki and the Persian literary revival\n\nAsk the librarian about sources on trade routes.' },
  ];
  return s;
}

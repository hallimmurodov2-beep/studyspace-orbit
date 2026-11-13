'use strict';
/* ───────────── natural-language quick add ─────────────
   "Physics worksheet tomorrow 45m !!"  →  title, subject, due date, estimate, priority  */

const NLP_WD = [
  ['mon', 'monday'], ['tue', 'tues', 'tuesday'], ['wed', 'wednesday'], ['thu', 'thur', 'thurs', 'thursday'],
  ['fri', 'friday'], ['sat', 'saturday'], ['sun', 'sunday'],
];
const NLP_MON = [['january'], ['february'], ['march'], ['april'], ['may'], ['june'], ['july'], ['august'], ['september'], ['october'], ['november'], ['december']];

function findSubjectByText(txt) {
  const q = txt.toLowerCase();
  if (q.length < 2) return null;
  return state.subjects.find(s => s.name.toLowerCase() === q) || state.subjects.find(s => s.name.toLowerCase().startsWith(q)) || null;
}
function nlpMonth(word) {
  const w = word.toLowerCase();
  return NLP_MON.findIndex(names => names.some(n => n.startsWith(w)));
}
function nlpFutureDate(day, month, year) {
  const now = new Date();
  let y = year || now.getFullYear();
  let d = new Date(y, month, day, 12);
  if (d.getMonth() !== month) return '';
  if (!year && ymd(d) < todayStr() && diffDays(todayStr(), ymd(d)) > 30) d = new Date(y + 1, month, day, 12);
  return ymd(d);
}

function parseQuick(input) {
  let s = ' ' + input.replace(/\s+/g, ' ') + ' ';
  const out = { title: '', due: '', est: 0, priority: 0, subjectId: '', repeat: 'none' };
  const take = (re, fn) => { s = s.replace(re, (...m) => (fn(...m) === false ? m[0] : ' ')); };
  const today = todayStr();
  const PRE = '(?:(?:by|due|on|until)\\s)?';

  take(/\s(!{1,3})(?=\s)/, (m, p) => { out.priority = p.length; });
  take(/\sp([1-3])(?=\s)/i, (m, p) => { out.priority = 4 - +p; });
  take(/\s#([\p{L}\d_-]+)/u, (m, tag) => { const sub = findSubjectByText(tag); if (!sub) return false; out.subjectId = sub.id; });

  take(/\s(\d+(?:[.,]\d+)?)\s?(?:h|hr|hrs|hours?)(?=\s)/i, (m, n) => { out.est += Math.round(parseFloat(n.replace(',', '.')) * 60); });
  take(/\s(\d+)\s?(?:m|min|mins|minutes?)(?=\s)/i, (m, n) => { out.est += +n; });

  let nextClass = false;
  take(/\s(?:for |by )?(?:the )?next (?:class|lesson)(?=\s)/i, () => { nextClass = true; });
  take(/\s(?:every day|everyday|daily)(?=\s)/i, () => { out.repeat = 'daily'; });
  take(/\s(?:every week|weekly)(?=\s)/i, () => { out.repeat = 'weekly'; });
  take(/\s(?:every month|monthly)(?=\s)/i, () => { out.repeat = 'monthly'; });

  const setDue = d => { if (!d || out.due) return false; out.due = d; };
  take(new RegExp(`\\s${PRE}(?:day after tomorrow)(?=\\s)`, 'i'), () => setDue(addDays(today, 2)));
  take(new RegExp(`\\s${PRE}(?:today|tod|tonight)(?=\\s)`, 'i'), () => setDue(today));
  take(new RegExp(`\\s${PRE}(?:tomorrow|tmrw|tmr|tom)(?=\\s)`, 'i'), () => setDue(addDays(today, 1)));
  take(/\sin\s(\d+)\s(?:days?)(?=\s)/i, (m, n) => setDue(addDays(today, +n)));
  take(/\sin\s(\d+)\s(?:weeks?)(?=\s)/i, (m, n) => setDue(addDays(today, +n * 7)));
  take(/\s(?:next week)(?=\s)/i, () => setDue(addDays(weekStart(today), 7)));
  take(new RegExp(`\\s${PRE}(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?(?=\\s)`), (m, d, mo, y) => setDue(nlpFutureDate(+d, +mo - 1, y ? (+y < 100 ? 2000 + +y : +y) : 0)));
  take(new RegExp(`\\s${PRE}(\\d{1,2})(?:st|nd|rd|th)?\\s([\\p{L}]{3,})(?=\\s)`, 'giu'), (m, d, mon) => { const mi = nlpMonth(mon); return mi < 0 ? false : setDue(nlpFutureDate(+d, mi, 0)); });
  take(new RegExp(`\\s${PRE}([\\p{L}]{3,})\\s(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`, 'giu'), (m, mon, d) => { const mi = nlpMonth(mon); return mi < 0 ? false : setDue(nlpFutureDate(+d, mi, 0)); });
  take(new RegExp(`\\s${PRE}(?:next\\s)?([\\p{L}]{2,})(?=\\s)`, 'giu'), (m, word) => {
    const w = word.toLowerCase();
    const wi = NLP_WD.findIndex(names => names.includes(w));
    if (wi < 0 || out.due) return false;
    let delta = (wi + 1 - dow(today) + 7) % 7; if (delta === 0) delta = 7;
    out.due = addDays(today, delta);
  });

  out.title = s.trim().replace(/\s+/g, ' ');
  if (!out.subjectId && out.title) {
    const lower = ' ' + out.title.toLowerCase() + ' ';
    const hit = state.subjects.slice().sort((a, b) => b.name.length - a.name.length)
      .find(sb => sb.name.length >= 3 && new RegExp(`[\\s(]${sb.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s:,.)-]`, 'u').test(lower));
    if (hit) out.subjectId = hit.id;
  }
  if (nextClass && !out.due && out.subjectId) out.due = nextLessonDate(out.subjectId);
  if (out.title) out.title = out.title.charAt(0).toUpperCase() + out.title.slice(1);
  return out;
}

/* chips that show the user what was understood, live as they type */
function parsedChips(p) {
  const chips = [];
  if (p.subjectId) chips.push(subjChip(p.subjectId));
  if (p.due) chips.push(html`<span class="chip accent">${icon('calendar', 12)}${relDay(p.due)}</span>`);
  if (p.est) chips.push(html`<span class="chip">${icon('clock', 12)}${fmtDur(p.est)}</span>`);
  if (p.priority) chips.push(html`<span class="chip ${p.priority === 3 ? 'danger' : p.priority === 2 ? 'warn' : ''}">${icon('flag', 12)}${t(PRIORITY[p.priority])}</span>`);
  if (p.repeat !== 'none') chips.push(html`<span class="chip">${icon('repeat', 12)}${t(REPEAT_LABEL[p.repeat])}</span>`);
  return chips;
}
const REPEAT_LABEL = { none: 'Does not repeat', daily: 'Every day', weekdays: 'Every weekday', weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month' };

/* ── pasted timetable: "Mon: Algebra, Physics, Chemistry" — or a day name on its own line with one class per line below ── */
const DAY_WORDS = (() => {
  const m = {}, add = (n, ...ws) => ws.forEach(w => { m[w] = n; });
  add(1, 'mon', 'monday', 'душанбе'); add(2, 'tue', 'tues', 'tuesday', 'сешанбе');
  add(3, 'wed', 'wednesday', 'чоршанбе'); add(4, 'thu', 'thur', 'thurs', 'thursday', 'панчшанбе', 'панҷшанбе');
  add(5, 'fri', 'friday', 'чумъа', 'ҷумъа', 'жумъа'); add(6, 'sat', 'saturday', 'шанбе'); add(7, 'sun', 'sunday', 'якшанбе');
  return m;
})();
const FREE_PERIOD = /^(?:[-–—.]+|free|none|empty|x)$/i;
function parseTimetable(text) {
  const days = {}, order = [];
  let cur = 0, header = false;
  const dayOf = w => DAY_WORDS[String(w).toLowerCase().replace(/\.$/, '')] || 0;
  const item = s => {
    let x = s.trim().replace(/^\d+\s*[.)]\s*/, '').replace(/\s*\d{1,2}[:.]\d{2}(?:\s*[-–—]\s*\d{1,2}[:.]\d{2})?\s*$/, '').trim();
    let room = ''; const r = x.match(/\s*\((?:room\s*)?([^)]{1,12})\)\s*$/i); if (r) { room = r[1].trim(); x = x.slice(0, r.index).trim(); }
    return !x || FREE_PERIOD.test(x) ? null : { name: x, room };
  };
  const put = (d, items) => { if (!days[d]) { days[d] = []; order.push(d); } days[d].push(...items); };
  for (const line of String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean)) {
    const m = line.match(/^([\p{L}]+)\.?(?:\s*[:\-–—]\s*|\s+|$)(.*)$/u), d = m ? dayOf(m[1]) : 0;
    if (d && !m[2].trim()) { cur = d; header = true; continue; }                          // a day name on its own line
    if (d) { cur = d; header = false; put(d, m[2].split(/\s*[,;|\t]\s*|\s+\/\s+/).map(item)); continue; }
    if (header && cur) { put(cur, [item(line)]); continue; }
    cur = cur ? cur % 7 + 1 : 1; put(cur, line.split(/\s*[,;|\t]\s*|\s+\/\s+/).map(item));  // no day name: Monday, Tuesday, …
  }
  for (const d of order) while (days[d].length && days[d][days[d].length - 1] == null) days[d].pop();
  return { days, order };
}
/* "08:00–08:45" per line (or several on one line) → [[start, end], …] */
function parseBells(text) {
  const out = [], re = /(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/g; let m;
  while ((m = re.exec(String(text)))) { const a = pad(+m[1]) + ':' + m[2], b = pad(+m[3]) + ':' + m[4]; if (isTime(a) && isTime(b) && b > a) out.push([a, b]); }
  return out.sort((x, y) => x[0].localeCompare(y[0]));
}
/* the bell times this timetable already uses, or a usual school day */
function currentBells(lessons = state.lessons) {
  const byStart = new Map(), count = {};
  for (const l of lessons) { if (!byStart.has(l.start)) byStart.set(l.start, l.end); count[l.start] = (count[l.start] || 0) + 1; }
  let list = [...byStart.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const regular = list.filter(([s]) => count[s] > 1);                // a one-off class is not a bell time
  if (regular.length >= 3) list = regular;
  if (list.length >= 3) return list;
  return [['08:00', '08:45'], ['08:55', '09:40'], ['09:50', '10:35'], ['10:55', '11:40'], ['11:50', '12:35'], ['12:45', '13:30'], ['13:40', '14:25']];
}
/* period n: from the bell list, or 45 minutes after the last known one with a 10-minute break */
function periodTime(bells, i) {
  if (bells[i]) return bells[i];
  const last = bells[bells.length - 1] || ['07:15', '08:00'];
  const s = toMin(last[1]) + 10 + (i - bells.length) * 55;
  return [fromMin(Math.min(1380, s)), fromMin(Math.min(1439, s + 45))];
}

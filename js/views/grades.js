'use strict';
/* ───────────── Grades: gradebook by term, report card, "what do I need?" ───────────── */

const GRADE_KINDS = [['classwork', 'Classwork'], ['homework', 'Homework'], ['quiz', 'Quiz'], ['test', 'Test'], ['exam', 'Exam'], ['project', 'Project']];
const LEVEL_CLS = ['danger', 'warn', 'accent', 'ok'];
const gradeBadge = (value, max, big) => html`<span class="gbadge ${LEVEL_CLS[gradeLevel(value, max)]} ${big ? 'big' : ''} num">${max && max !== state.settings.gradeScale ? `${value}/${max}` : fmtGrade(value)}</span>`;
const normGrade = g => (g.value / (g.max || state.settings.gradeScale)) * state.settings.gradeScale;
const integerScale = () => state.settings.gradeScale !== 100;
const lowestMark = () => ({ 5: 2, 10: 1 })[state.settings.gradeScale] ?? 0;
/* the rounded report-card mark, shown as a solid badge */
function markBadge(avg, cls = '') {
  /* cls "calc" = a running average (soft colours); without it = an official mark (solid) */
  if (avg == null) return html`<span class="gmark empty ${cls}">—</span>`;
  const sc = state.settings.gradeScale, m = sc === 100 ? Math.round(avg) : roundMark(avg);
  return html`<span class="gmark num ${LEVEL_CLS[gradeLevel(m, sc)]} ${cls}">${m}</span>`;
}

/* which part of the year the Grades screen shows: a term, or the whole year */
function gradeRange() {
  const sel = ui.grades.term || (currentTerm() || {}).id || 'year';
  if (sel === 'year' || !byId(state.terms, sel)) {
    const ts = state.terms.slice().sort((a, b) => a.start.localeCompare(b.start));
    return { id: 'year', name: t('Whole year'), start: ts.length ? ts[0].start : '0000-01-01', end: ts.length ? ts[ts.length - 1].end : '9999-12-31' };
  }
  const tr = byId(state.terms, sel);
  return { ...tr, name: t(tr.name) };
}

function sparkline(vals, max, color, w = 96, h = 30) {
  if (vals.length < 2) return html`<svg width="${w}" height="${h}"></svg>`;
  const lo = Math.min(...vals, max * 0.4), hi = max;
  const pts = vals.map((v, i) => [3 + i * (w - 6) / (vals.length - 1), h - 4 - (v - lo) / (hi - lo || 1) * (h - 8)]);
  const last = pts[pts.length - 1];
  return html`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="spark"><polyline points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3" fill="${color}"/></svg>`;
}

/* ── a subject's school year in one picture ──
   every grade is a dot, each term's running average a line, the term results sit on top, the goal is a dashed line */
function yearChartData(subjectId) {
  const ts = state.terms.slice().sort((a, b) => a.start.localeCompare(b.start)); if (!ts.length) return null;
  const scale = state.settings.gradeScale, start = ts[0].start, end = ts[ts.length - 1].end, span = Math.max(1, diffDays(end, start) + 1);
  const gs = state.grades.filter(g => g.subjectId === subjectId && g.date >= start && g.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  const terms = ts.map(x => {
    let W = 0, S = 0;
    const list = gs.filter(g => inRange(g, x));
    const line = list.map(g => { const w = g.weight || 1; W += w; S += normGrade(g) * w; return { date: g.date, avg: S / W }; });
    return { term: x, grades: list, line, result: termResult(subjectId, x), official: officialMark(subjectId, x.id), goal: goalOf(subjectId, x.id) };
  });
  const vals = [...gs.map(normGrade), ...terms.flatMap(x => [x.result, x.goal]).filter(v => v != null)];
  const lo = vals.length ? Math.min(...vals) : scale * 0.6;
  const yMin = scale === 100 ? Math.max(0, Math.min(50, Math.floor((lo - 10) / 10) * 10)) : Math.max(lowestMark(), Math.min(Math.floor(lo) - 1, scale - 4));
  return { start, end, span, scale, yMin, terms, grades: gs };
}
function yearChart(subjectId) {
  const d = yearChartData(subjectId); if (!d) return '';
  const today = todayStr(), now = termOf(today);
  const X = date => clamp(diffDays(date, d.start), 0, d.span) / d.span * 100;                       // percent across the year
  const Y = v => 6 + (1 - (clamp(v, d.yMin, d.scale) - d.yMin) / (d.scale - d.yMin)) * 88;           // percent down the plot (6 % air above and below)
  const f = n => n.toFixed(2);
  const step = d.scale === 100 ? 10 : d.scale - d.yMin > 6 ? 2 : 1, ticks = [];
  for (let v = d.scale; v >= d.yMin; v -= step) ticks.push(v);
  const months = pd(d.start).getDate() <= 7 ? [d.start] : [];
  const shortName = name => { const m = /^(\d+)\D*\s(quarter|semester|term)$/i.exec(name); return m ? m[2][0].toUpperCase() + m[1] : name; };
  for (let m = pd(d.start), i = 0; i < 14; i++) { m = new Date(m.getFullYear(), m.getMonth() + 1, 1, 12); const s = ymd(m); if (s > d.end) break; months.push(s); }
  const seen = new Map();
  const dots = d.grades.map(g => { const v = normGrade(g), k = g.date + '|' + v, n = seen.get(k) || 0; seen.set(k, n + 1); return { g, v, n }; });
  return html`<div class="ychart" data-key="ychart-${subjectId}">
    <div class="yc-terms">${d.terms.map(x => html`<button class="yc-term ${now && now.id === x.term.id ? 'now' : ''}" style="flex:${diffDays(x.term.end, x.term.start) + 1}" data-act="term-marks" data-id="${x.term.id}" data-s="${subjectId}" title="${x.official != null ? t('Official mark') : x.result != null ? t('Running average: {n}', { n: fmtGrade(x.result) }) : t('Enter the mark')}">
      <span class="trunc yc-name">${t(x.term.name)}</span><span class="yc-short">${shortName(x.term.name)}</span>${x.result != null ? markBadge(x.result, x.official != null ? 'sm' : 'calc sm') : ''}</button>`)}</div>
    <div class="yc-plot">
      ${ticks.map(v => html`<span class="yc-y num" style="top:${f(Y(v))}%">${v}</span>`)}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        ${state.daysOff.filter(o => o.end >= d.start && o.start <= d.end).map(o => html`<rect class="yc-off" x="${f(X(o.start))}" y="0" width="${f(Math.max(0.3, X(addDays(o.end, 1)) - X(o.start)))}" height="100"/>`)}
        ${ticks.map(v => html`<line class="yc-grid" x1="0" x2="100" y1="${f(Y(v))}" y2="${f(Y(v))}"/>`)}
        ${d.terms.slice(1).map(x => html`<line class="yc-sep" x1="${f(X(x.term.start))}" x2="${f(X(x.term.start))}" y1="0" y2="100"/>`)}
        ${d.terms.filter(x => x.goal != null).map(x => html`<line class="yc-goal" x1="${f(X(x.term.start))}" x2="${f(X(addDays(x.term.end, 1)))}" y1="${f(Y(x.goal))}" y2="${f(Y(x.goal))}"/>`)}
        ${d.terms.filter(x => x.official != null).map(x => html`<line class="yc-final" x1="${f(X(x.term.start))}" x2="${f(X(addDays(x.term.end, 1)))}" y1="${f(Y(x.official))}" y2="${f(Y(x.official))}"/>`)}
        ${d.terms.filter(x => x.line.length > 1).map(x => html`<polyline class="yc-avg" points="${x.line.map(p => f(X(p.date)) + ',' + f(Y(p.avg))).join(' ')}"/>`)}
        ${today >= d.start && today <= d.end ? html`<line class="yc-today" x1="${f(X(today))}" x2="${f(X(today))}" y1="0" y2="100"/>` : ''}
      </svg>
      ${dots.map(({ g, v, n }) => html`<button class="yc-dot ${LEVEL_CLS[gradeLevel(g.value, g.max)]} ${(g.weight || 1) > 1 ? 'heavy' : ''}" style="left:${f(X(g.date))}%;top:${f(Y(v))}%;--n:${n}" data-act="edit-grade" data-id="${g.id}" title="${fmtGrade(v)} · ${g.title || t(GRADE_KINDS.find(k => k[0] === g.kind)?.[1] || 'Grade')} · ${fmtDate(g.date, 'short')}" aria-label="${fmtGrade(v)}, ${fmtDate(g.date, 'short')}"></button>`)}
      ${d.grades.length ? '' : html`<div class="yc-empty small muted">${t('Grades appear here as dots, with the average of each term as a line.')}</div>`}
    </div>
    <div class="yc-months">${months.map(m => html`<span style="left:${f(X(m))}%">${fmtDate(m, 'mon')}</span>`)}</div>
    <div class="yc-legend tiny muted"><span><i class="yc-k dot"></i>${t('grade')}</span><span><i class="yc-k avg"></i>${t('running average')}</span><span><i class="yc-k final"></i>${t('official mark')}</span><span><i class="yc-k goal"></i>${t('goal')}</span>${state.daysOff.length ? html`<span><i class="yc-k off"></i>${t('no school')}</span>` : ''}</div>
  </div>`;
}

/* what the next grade must be to finish the term (or year) with the mark you want */
function needCalc(subjectId, range) {
  const scale = state.settings.gradeScale, ints = integerScale();
  const gs = state.grades.filter(g => g.subjectId === subjectId && inRange(g, range));
  const W = sum(gs, g => g.weight || 1), S = sum(gs, g => normGrade(g) * (g.weight || 1));
  const avg = W ? S / W : null;
  const cur = avg == null ? null : ints ? roundMark(avg) : Math.round(avg);
  const defWant = cur == null ? (ints ? scale - 1 : 85) : Math.min(scale, ints ? cur + 1 : Math.ceil((avg + 1) / 5) * 5);
  const goal = range.id ? goalOf(subjectId, range.id) : null;
  const want = clamp(+(goal ?? defWant) || defWant, lowestMark() || 1, scale);
  const w = +(ui.grades['w_' + subjectId] || 1);
  /* half-up rounding: a mark of 9 needs an average of at least 8.5 */
  const threshold = ints ? want - 0.5 : want;
  const need = (threshold * (W + w) - S) / w;
  let verdict, tone = '';
  if (!gs.length) verdict = t('Add a grade first.');
  else if (need > scale + 1e-9) {
    const n = threshold >= scale ? Infinity : Math.ceil((threshold * W - S) / (scale - threshold) - 1e-9);
    verdict = isFinite(n) && n <= 12 ? t('One grade is not enough — you need {n} top marks ({s}) in a row.', { n, s: scale }) : t('A {m} is out of reach this term — but every top mark still pulls your average up.', { m: want });
    tone = 'warn';
  } else if (need <= lowestMark() + 1e-9) { verdict = t('You are safe — any grade keeps you at {m} or above.', { m: want }); tone = 'ok'; }
  else verdict = t('You need at least {n} on the next one.', { n: ints ? Math.ceil(need - 1e-9) : Math.ceil(need) });
  return html`<div class="needcalc">
    <div class="spread"><div class="h3">${icon('target', 16, 'inl')} ${t('What do I need?')}</div>${avg != null ? html`<span class="small muted">${t('Now')}: <b class="num" style="color:var(--text)">${fmtGrade(avg)}</b>${ints ? html` → ${markBadge(avg, 'sm')}` : ''}</span>` : ''}</div>
    <div class="row wrap" style="gap:10px">
      <label class="row small" style="gap:8px">${ints ? t('My goal') : t('Target average')}
        ${ints ? html`<select class="select" style="width:74px" data-change="need-target" data-id="${subjectId}" data-term="${range.id}">${options(Array.from({ length: scale - lowestMark() + 1 }, (_, i) => scale - i).map(n => [n, n]), want)}</select>`
          : html`<input type="number" class="input" style="width:84px" min="0" max="${scale}" step="1" value="${want}" data-change="need-target" data-id="${subjectId}" data-term="${range.id}">`}</label>
      <label class="row small" style="gap:8px">${t('Next grade counts')}<select class="select" style="width:74px" data-change="need-weight" data-id="${subjectId}">${options([[1, '×1'], [2, '×2'], [3, '×3']], w)}</select></label>
    </div>
    <div class="need-out ${tone}">${verdict}</div>
    <div class="tiny faint">${goal != null ? html`${icon('target', 11, 'inl')} ${t('Saved as your goal for {term}.', { term: t(range.name) })} <button class="linkbtn" data-act="goal-clear" data-id="${subjectId}" data-term="${range.id}">${t('Remove')}</button>` : t('Pick a mark to save it as your goal for {term}.', { term: t(range.name) })}</div>
  </div>`;
}

function trendChip(d, prevName) {
  if (d == null || Math.abs(d) < 0.05) return '';
  return html`<span class="trend ${d > 0 ? 'up' : 'down'} num" title="${t('Compared with {term}', { term: prevName })}">${icon(d > 0 ? 'up' : 'down', 11)}${fmtGrade(Math.abs(d))}</span>`;
}
function goalPill(st) {
  if (!st) return '';
  const tip = st.final ? t('Goal {g} · final mark {m}', { g: st.goal, m: st.mark }) : st.met ? t('Goal {g} · on track', { g: st.goal }) : st.need === Infinity ? t('Goal {g} · one grade is not enough', { g: st.goal }) : st.need != null ? t('Goal {g} · needs {n} next', { g: st.goal, n: st.need }) : t('Goal {g}', { g: st.goal });
  return html`<span class="goalpill ${st.met ? 'ok' : st.final ? 'miss' : 'warn'} num" title="${tip}">${icon(st.met ? 'check' : 'target', 11)}${st.goal}</span>`;
}
function prevTerm(range) {
  const ts = state.terms.slice().sort((a, b) => a.start.localeCompare(b.start)), i = ts.findIndex(x => x.id === range.id);
  return i > 0 ? ts[i - 1] : null;
}

function termPicker(range) {
  const ts = state.terms.slice().sort((a, b) => a.start.localeCompare(b.start)), now = currentTerm();
  return html`<div class="chips-scroll termpick">${ts.map(x => html`<button class="chip ${range.id === x.id ? 'on' : ''}" data-act="grade-term" data-id="${x.id}">${t(x.name)}${now && now.id === x.id ? html`<i class="dot" style="--c:${range.id === x.id ? '#fff' : 'var(--accent)'}"></i>` : ''}</button>`)}<button class="chip ${range.id === 'year' ? 'on' : ''}" data-act="grade-term" data-id="year">${icon('layers', 12)}${t('Report card')}</button></div>`;
}

function reportCard() {
  const ts = state.terms.slice().sort((a, b) => a.start.localeCompare(b.start));
  const range = gradeRange();
  const rows = state.subjects.map(s => ({ s, marks: ts.map(x => termResult(s.id, x)), year: yearResult(s.id) }));
  const mean = vals => { const v = vals.filter(x => x != null); return v.length ? sum(v) / v.length : null; };
  const overall = ts.map((x, i) => mean(rows.map(r => r.marks[i])));
  const anyOfficial = state.subjects.some(s => ts.some(x => officialMark(s.id, x.id) != null));
  const p = state.profile, y0 = ts.length ? pd(ts[0].start).getFullYear() : schoolYearStart(), y1 = ts.length ? pd(ts[ts.length - 1].end).getFullYear() : y0 + 1;
  return html`<div class="print-only rc-print-head"><h1>${t('Report card')}</h1><div>${[p.name, p.school, p.grade && t('Grade {g}', { g: p.grade }), y0 === y1 ? y0 : `${y0}/${String(y1).slice(2)}`].filter(Boolean).join(' · ')}</div></div>
  <div class="card reportcard">
    <div class="rc-row rc-head" style="--n:${ts.length}"><span>${t('Subject')}</span>${ts.map(x => html`<span title="${fmtDate(x.start, 'short')} – ${fmtDate(x.end, 'short')}">${t(x.name)}</span>`)}<span>${t('Year')}</span></div>
    ${rows.map(({ s, marks, year }) => html`<div class="rc-row" style="--n:${ts.length};--c:${s.color}" data-key="rc-${s.id}">
      <span class="row" style="gap:10px;min-width:0">${subjGlyph(s.id, 'sm')}<b class="trunc">${s.name}</b></span>
      ${marks.map((m, i) => { const off = officialMark(s.id, ts[i].id) != null; return html`<button class="rc-cell" data-act="term-marks" data-id="${ts[i].id}" data-s="${s.id}" title="${m == null ? t('Enter the mark') : off ? t('Official mark') : t('Running average: {n}', { n: fmtGrade(m) })}">${m == null ? html`<span class="gmark empty">${ts[i].start > todayStr() ? '·' : '+'}</span>` : markBadge(m, off ? '' : 'calc')}</button>`; })}
      <span class="rc-cell">${year != null ? html`<span class="small num muted" style="margin-right:6px">${fmtGrade(year)}</span>` : ''}${markBadge(year, anyOfficial ? '' : 'calc')}</span>
    </div>`)}
    <div class="rc-row rc-foot" style="--n:${ts.length}"><span>${t('Average')}</span>${overall.map(v => html`<span class="rc-cell num">${fmtGrade(v)}</span>`)}<span class="rc-cell num"><b>${fmtGrade(mean(rows.map(r => r.year)))}</b></span></div>
  </div>
  <div class="row wrap small muted" style="gap:14px;margin-top:12px"><span class="row" style="gap:6px"><span class="gmark sm ok">9</span>${t('official mark')}</span><span class="row" style="gap:6px"><span class="gmark sm ok calc">9</span>${t('running average')}</span><span class="no-print">${t('Tap any cell to enter the mark from your report card.')}</span><span class="print-only">${t('Printed {d}', { d: fmtDate(todayStr(), 'full') })}</span></div>
  <div class="hint" style="margin-top:10px">${t('Term marks are the weighted average rounded half-up, the way schools usually do it (8.5 → 9). Term dates can be changed in Settings → Study.')}</div>`;
}

VIEWS.grades = {
  title: 'Grades', icon: 'star',
  render() {
    const scale = state.settings.gradeScale, range = gradeRange(), year = range.id === 'year';
    const inTerm = state.grades.filter(g => inRange(g, range));
    const rows = state.subjects.map(s => ({ s, gs: inTerm.filter(g => g.subjectId === s.id).sort((a, b) => a.date.localeCompare(b.date)), avg: year ? yearResult(s.id) : termResult(s.id, range), official: year ? null : officialMark(s.id, range.id) }));
    const withGrades = rows.filter(r => r.avg != null);
    const overall = withGrades.length ? sum(withGrades, r => r.avg) / withGrades.length : null;
    const hasData = state.grades.length || Object.keys(state.termMarks).length;
    const best = withGrades.slice().sort((a, b) => b.avg - a.avg)[0], weak = withGrades.slice().sort((a, b) => a.avg - b.avg)[0];
    const prev = year ? null : prevTerm(range), prevName = prev ? t(prev.name) : '';
    const prevVals = prev ? state.subjects.map(s => [termResult(s.id, prev), termResult(s.id, range)]).filter(([a, b]) => a != null && b != null) : [];
    const overallTrend = prevVals.length ? sum(prevVals, v => v[1] - v[0]) / prevVals.length : null;
    const goalSts = year ? [] : state.subjects.map(s => goalStatus(s.id, range)).filter(Boolean), goalsMet = goalSts.filter(g => g.met).length;
    const daysLeft = !year && range.end >= todayStr() && range.start <= todayStr() ? diffDays(range.end, todayStr()) : null;
    return html`
    <div class="page-head ${year ? 'no-print' : ''}">
      <div><h1 class="h1">${t('Grades')}</h1><div class="sub">${t('{n}-point scale', { n: scale === 100 ? 100 : scale })} · ${year ? t('whole year') : html`${range.name}, ${fmtDate(range.start, 'short')} – ${fmtDate(range.end, 'short')}${daysLeft != null ? html` · <b>${t('{n} left', { n: nt(daysLeft, 'day', 'days') })}</b>` : ''}`}${goalSts.length ? html` · <button class="linkbtn" data-act="goals" data-id="${range.id}">${t('goals {a} of {b} on track', { a: goalsMet, b: goalSts.length })}</button>` : ''} · <a href="#/settings/study" style="color:var(--accent);font-weight:600">${t('change')}</a></div></div>
      <div class="row wrap no-print">${year ? html`<button class="btn hide-m" data-act="diary-print">${icon('download', 16)}${t('Print')}</button>` : html`<button class="btn" data-act="goals" data-id="${range.id}">${icon('target', 16)}${t('Goals')}</button>`}<button class="btn" data-act="term-marks" data-id="${year ? '' : range.id}">${icon('layers', 16)}${t('Term marks')}</button><button class="btn primary" data-act="new-grade">${icon('plus', 16)}${t('Add grade')}</button></div>
    </div>
    ${termPicker(range)}
    ${hasData ? html`
    <div class="stat-row ${year ? 'no-print' : ''}">
      <div class="card pad stat"><div class="eyebrow">${year ? t('Year average') : t('Term average')}</div><div class="row" style="gap:12px;margin-top:8px">${ring((overall || 0) / scale, 62, 7, 'url(#orbitGrad)', '')}<div><div class="big-num">${fmtGrade(overall)}</div>${trendChip(overallTrend, prevName)}</div></div></div>
      <div class="card pad stat"><div class="eyebrow">${t('Grades recorded')}</div><div class="big-num" style="margin-top:14px">${inTerm.length}</div><div class="small muted">${t('across {n}', { n: nt(withGrades.length, 'subject', 'subjects') })}</div></div>
      ${best ? html`<div class="card pad stat"><div class="eyebrow">${t('Strongest')}</div><div class="row" style="gap:10px;margin-top:12px">${subjGlyph(best.s.id)}<div class="grow"><div class="h3 trunc">${best.s.name}</div><div class="small muted num">${fmtGrade(best.avg)}</div></div>${integerScale() ? markBadge(best.avg) : ''}</div></div>` : ''}
      ${weak && weak !== best ? html`<div class="card pad stat"><div class="eyebrow">${t('Needs attention')}</div><div class="row" style="gap:10px;margin-top:12px">${subjGlyph(weak.s.id)}<div class="grow"><div class="h3 trunc">${weak.s.name}</div><div class="small muted num">${fmtGrade(weak.avg)}</div></div>${integerScale() ? markBadge(weak.avg) : ''}</div></div>` : ''}
    </div>` : ''}
    ${!state.subjects.length ? html`<div class="card">${emptyState('star', t('Add your subjects first'), t('Grades are grouped by subject.'), html`<a class="btn primary" href="#/subjects">${t('Go to subjects')}</a>`)}</div>`
      : year ? reportCard()
      : html`<div class="card gradebook">${rows.map(({ s, gs, avg }) => {
      const open = ui.grades.open === s.id;
      const official = officialMark(s.id, range.id);
      return html`<div class="grow-row ${open ? 'open' : ''}" data-key="gr-${s.id}" style="--c:${s.color}">
        <button class="gsubject" data-act="grade-open" data-id="${s.id}">
          ${subjGlyph(s.id)}
          <div class="grow" style="text-align:left"><div class="h3 trunc">${s.name}</div><div class="tiny faint">${gs.length ? nt(gs.length, 'grade', 'grades') : official != null ? t('Official mark') : t('No grades this term')}</div></div>
          <span class="hide-m">${sparkline(gs.map(normGrade), scale, s.color)}</span>
          <div class="gmarks hide-m">${gs.slice(-6).map(g => gradeBadge(g.value, g.max))}</div>
          <span class="gavg-wrap">${goalPill(goalStatus(s.id, range))}${trendChip(prev ? termTrend(s.id, range) : null, prevName)}${official != null ? html`<span class="chip ok hide-m">${icon('check', 12)}${t('final')}</span>` : avg != null ? html`<span class="small num muted">${fmtGrade(avg)}</span>` : ''}${integerScale() ? markBadge(avg, official != null ? '' : 'calc') : avg != null ? html`<span class="gavg num ${LEVEL_CLS[gradeLevel(avg, scale)]}">${fmtGrade(avg)}</span>` : html`<span class="gavg faint">—</span>`}</span>
          ${icon(open ? 'up' : 'down', 16, 'faint')}
        </button>
        ${open ? html`<div class="gdetail">
          <div class="col" style="gap:4px">
            ${gs.slice().reverse().map(g => html`<button class="grade-item" data-act="edit-grade" data-id="${g.id}">${gradeBadge(g.value, g.max)}<span class="grow trunc" style="text-align:left">${g.title || t(GRADE_KINDS.find(k => k[0] === g.kind)?.[1] || 'Grade')}</span>${(g.weight || 1) > 1 ? html`<span class="chip">×${g.weight}</span>` : ''}<span class="chip hide-m">${t(GRADE_KINDS.find(k => k[0] === g.kind)?.[1] || 'Grade')}</span><span class="tiny faint num">${fmtDate(g.date, 'short')}</span></button>`)}
            ${gs.length ? '' : html`<div class="small muted" style="padding:6px 8px">${t('No grades in {term} yet.', { term: range.name })}</div>`}
            <button class="btn sm soft" style="align-self:flex-start;margin-top:6px" data-act="new-grade" data-subject="${s.id}">${icon('plus', 14)}${t('Add grade')}</button>
          </div>
          ${official != null ? html`<div class="needcalc"><div class="h3">${icon('check', 16, 'inl')} ${t('Final mark for {term}: {m}', { term: range.name, m: official })}</div><div class="small muted">${gs.length ? t('Your grades averaged {n}.', { n: fmtGrade(subjectAverage(s.id, range)) }) : t('Entered from your report card.')}</div><button class="btn sm" style="align-self:flex-start" data-act="term-marks" data-id="${range.id}" data-s="${s.id}">${icon('edit', 14)}${t('Change')}</button></div>` : needCalc(s.id, range)}
        </div>` : ''}
      </div>`; })}</div>`}
    ${state.subjects.length && !hasData ? html`<div class="hint" style="margin-top:12px">${t('Record marks as you get them — Studyspace keeps the averages and tells you what you need next.')}</div>` : ''}`;
  },
};

function openGradeModal(grade, pre = {}) {
  if (!state.subjects.length) { toast(t('Add a subject first.')); go('subjects'); return; }
  const scale = state.settings.gradeScale;
  const g = grade || { subjectId: pre.subjectId || ui.grades.open || state.subjects[0].id, title: pre.title || '', kind: pre.kind || 'classwork', value: '', max: scale, weight: pre.weight || 1, date: pre.date || todayStr() };
  const quick = scale === 5 ? [5, 4, 3, 2] : scale === 10 ? [10, 9, 8, 7, 6, 5, 4, 3] : [];
  openModal({
    title: grade ? t('Edit grade') : t('Add grade'),
    body: html`
      ${quick.length ? html`<div class="field"><span>${t('Grade')}</span><div class="gpick">${quick.map(n => html`<button type="button" class="gbadge ${LEVEL_CLS[gradeLevel(n, scale)]} ${String(g.value) === String(n) && (g.max || scale) === scale ? 'on' : ''}" data-q="${n}">${n}</button>`)}</div></div>` : ''}
      <div class="form-grid">
        <label class="field"><span>${quick.length ? t('…or type it') : t('Grade')}</span><input type="number" class="input" name="value" value="${g.value}" min="0" step="any" required ${quick.length ? '' : raw('autofocus')}></label>
        <label class="field"><span>${t('Out of')}</span><input type="number" class="input" name="max" value="${g.max || scale}" min="1" step="any" required></label>
        <label class="field"><span>${t('Subject')}</span><select class="select" name="subjectId">${subjectOptions(g.subjectId, false)}</select></label>
        <label class="field"><span>${t('Type')}</span><select class="select" name="kind">${options(GRADE_KINDS.map(([k, l]) => [k, t(l)]), g.kind)}</select></label>
        <label class="field full"><span>${t('What was it? (optional)')}</span><input class="input" name="title" value="${g.title}" placeholder="${t('e.g. Chapter 3 quiz')}"></label>
        <label class="field"><span>${t('Weight')}</span><select class="select" name="weight">${options([[1, t('Normal ×1')], [2, t('Important ×2')], [3, t('Major ×3')]], g.weight || 1)}</select></label>
        <label class="field"><span>${t('Date')}</span><input type="date" class="input" name="date" value="${g.date}" required></label>
      </div>`,
    foot: html`${grade ? html`<button type="button" class="btn danger left" data-del>${icon('trash', 15)}${t('Delete')}</button>` : ''}<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Save')}</button>`,
    onMount: (scrim, entry) => {
      const val = scrim.querySelector('[name=value]'), max = scrim.querySelector('[name=max]');
      const mark = () => scrim.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('on', b.dataset.q === val.value && +max.value === scale));
      scrim.querySelectorAll('[data-q]').forEach(b => { b.onclick = () => { val.value = b.dataset.q; max.value = scale; mark(); }; });
      val.addEventListener('input', mark);
      const del = scrim.querySelector('[data-del]');
      if (del) del.onclick = () => { commit(s => { s.grades = s.grades.filter(x => x.id !== grade.id); }); closeModal(entry); toastUndo(t('Grade deleted')); };
    },
    onSubmit: d => {
      const value = parseFloat(String(d.value).replace(',', '.')), max = parseFloat(String(d.max).replace(',', '.')) || scale;
      if (!isFinite(value) || value < 0 || value > max || !isYmd(d.date)) { toast(t('Check the grade — it should be between 0 and {max}.', { max }), { kind: 'danger' }); return false; }
      const data = { subjectId: d.subjectId, title: d.title.trim(), kind: d.kind, value, max, weight: +d.weight || 1, date: d.date };
      if (grade) commit(s => { Object.assign(byId(s.grades, grade.id), data); });
      else {
        commit(s => { s.grades.push({ id: uid(), ...data }); });
        ui.grades.open = d.subjectId;
        if (gradeLevel(value, max) === 3) Sound.tick();
        const tr = termOf(d.date), avg = tr ? subjectAverage(d.subjectId, tr) : null;
        toastUndo(tr && avg != null ? t('Saved. {subject}, {term}: {avg}', { subject: subjName(d.subjectId), term: t(tr.name), avg: fmtGrade(avg) }) : t('Grade saved'));
      }
    },
  });
}
ACT['new-grade'] = el => openGradeModal(null, { subjectId: el.dataset.subject });
ACT['edit-grade'] = el => { const g = byId(state.grades, el.dataset.id); if (g) openGradeModal(g); };
ACT['grade-open'] = el => setUI(u => { u.grades.open = u.grades.open === el.dataset.id ? '' : el.dataset.id; });
/* ── report-card entry: every subject's official mark for one term on a single screen ── */
function openTermMarks(termId, focusSubject, carry) {
  if (!state.subjects.length) { toast(t('Add a subject first.')); go('subjects'); return; }
  const ts = state.terms.slice().sort((a, b) => a.start.localeCompare(b.start));
  const today = todayStr(), ended = ts.filter(x => x.end < today);
  const start = byId(ts, termId) || ended[ended.length - 1] || currentTerm() || ts[0];
  const scale = state.settings.gradeScale, lo = lowestMark();
  openModal({
    title: t('Report card marks'), cls: 'wide',
    body: html`
      <div class="form-grid">
        <label class="field"><span>${t('Term')}</span><select class="select" name="term">${ts.map(x => html`<option value="${x.id}" ${x.id === start.id ? raw('selected') : ''}>${t(x.name)}</option>`)}</select></label>
        <label class="field"><span>${t('Paste marks')}</span><textarea class="input tm-paste" id="tm-paste" rows="1" autocomplete="off" spellcheck="false" placeholder="${t('“7 8 8 9 …” or “Physics 7, Chemistry 10”')}"></textarea></label>
      </div>
      <div class="hint" style="margin-top:-6px">${t('Type each mark, or paste them: plain numbers fill the subjects from top to bottom, and lines like “Physics 7” go to the subject with that name. Leave a box empty to keep using your running average.')}</div>
      <div class="tm-missing" id="tm-missing" hidden></div>
      <div class="tm-list">${state.subjects.map(s => html`<label class="tm-row" style="--c:${s.color}">${subjGlyph(s.id, 'sm')}<span class="grow trunc">${s.name}</span><span class="tiny faint num" data-avg="${s.id}"></span><input type="number" class="input num" name="m_${s.id}" min="${lo}" max="${scale}" step="1" inputmode="numeric"></label>`)}</div>
      <div class="spread small muted"><span id="tm-count"></span><b id="tm-avg" class="num" style="color:var(--text)"></b></div>`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Save marks')}</button>`,
    onMount: (scrim, entry) => {
      const sel = scrim.querySelector('[name=term]'), inputs = [...scrim.querySelectorAll('.tm-row input')];
      const summary = () => { const v = inputs.map(i => parseFloat(i.value)).filter(n => isFinite(n)); scrim.querySelector('#tm-count').textContent = t('{a} of {b} filled in', { a: v.length, b: inputs.length }); scrim.querySelector('#tm-avg').textContent = v.length ? t('Average') + ': ' + (Math.round(sum(v) / v.length * 100) / 100).toFixed(2) : ''; };
      const fill = () => {
        const tr = byId(state.terms, sel.value);
        for (const s of state.subjects) {
          const inp = scrim.querySelector(`[name="m_${s.id}"]`), o = officialMark(s.id, tr.id), avg = subjectAverage(s.id, tr);
          inp.value = o != null ? o : ''; inp.placeholder = avg != null ? '≈ ' + (scale === 100 ? Math.round(avg) : roundMark(avg)) : '—';
          scrim.querySelector(`[data-avg="${s.id}"]`).textContent = avg != null ? t('avg {n}', { n: fmtGrade(avg) }) : '';
        }
        summary();
      };
      sel.addEventListener('change', fill);
      scrim.querySelector('.tm-list').addEventListener('input', summary);
      const paste = scrim.querySelector('#tm-paste'), missBox = scrim.querySelector('#tm-missing');
      const applyPaste = () => {
        paste.style.height = 'auto'; paste.style.height = clamp(paste.scrollHeight + 2, 40, 132) + 'px';
        const named = parseMarkLines(paste.value).filter(x => x.value >= lo && x.value <= scale);
        const missing = [];
        if (named.length) {
          for (const x of named) { const s = findSubjectByName(x.name); if (s) scrim.querySelector(`[name="m_${s.id}"]`).value = x.value; else if (!missing.some(m => normName(m.name) === normName(x.name))) missing.push(x); }
        } else {
          const nums = (paste.value.match(/\d+(?:[.,]\d+)?/g) || []).map(n => parseFloat(n.replace(',', '.'))).filter(n => n >= lo && n <= scale);
          if (nums.length >= 2) inputs.forEach((inp, i) => { if (i < nums.length) inp.value = nums[i]; });
        }
        missBox.hidden = !missing.length;
        missBox.innerHTML = missing.length ? String(html`<span>${icon('alert', 14)} ${t('Not in your subjects yet:')} <b>${missing.map(m => m.name).join(', ')}</b></span><button type="button" class="btn sm soft" id="tm-add">${icon('plus', 14)}${tn(missing.length, 'Add this subject', 'Add these subjects')}</button>`) : '';
        const add = missBox.querySelector('#tm-add');
        if (add) add.onclick = () => {
          const keep = {}; inputs.forEach(i => { if (i.value !== '') keep[i.name] = i.value; });
          const text = paste.value, tid = sel.value;
          commit(st => { for (const m of missing) st.subjects.push(subjectFromName(m.name, st.subjects.length)); });
          closeModal(entry);
          openTermMarks(tid, null, { text, keep });
          toastUndo(t('Added: {n}', { n: nt(missing.length, 'subject', 'subjects') }));
        };
        summary();
      };
      paste.addEventListener('input', applyPaste);
      fill();
      if (carry) { for (const [name, v] of Object.entries(carry.keep || {})) { const i = scrim.querySelector(`[name="${name}"]`); if (i) i.value = v; } paste.value = carry.text || ''; applyPaste(); }
      const f = focusSubject && scrim.querySelector(`[name="m_${focusSubject}"]`);
      if (f) setTimeout(() => { f.focus(); f.select(); f.scrollIntoView({ block: 'center' }); }, 60);
    },
    onSubmit: d => {
      const tid = d.term, next = {};
      for (const s of state.subjects) {
        const rawV = String(d['m_' + s.id] || '').trim().replace(',', '.');
        if (!rawV) { next[s.id] = null; continue; }
        const v = parseFloat(rawV);
        if (!isFinite(v) || v < lo || v > scale) { toast(t('{subject}: the mark should be between {a} and {b}.', { subject: s.name, a: lo, b: scale }), { kind: 'danger' }); return false; }
        next[s.id] = v;
      }
      commit(st => { for (const [sid, v] of Object.entries(next)) { if (v == null) { if (st.termMarks[sid]) { delete st.termMarks[sid][tid]; if (!Object.keys(st.termMarks[sid]).length) delete st.termMarks[sid]; } } else (st.termMarks[sid] ||= {})[tid] = v; } });
      const n = Object.values(next).filter(v => v != null).length;
      toastUndo(t('{n} marks saved for {term}', { n, term: t(byId(state.terms, tid).name) }));
    },
  });
}
ACT['term-marks'] = el => openTermMarks(el.dataset.id, el.dataset.s);

/* ── goals for one term, every subject on one screen ── */
function openGoals(termId) {
  if (!state.subjects.length) { toast(t('Add a subject first.')); go('subjects'); return; }
  const ts = state.terms.slice().sort((a, b) => a.start.localeCompare(b.start));
  const tr = byId(ts, termId) || currentTerm() || ts[0];
  const scale = state.settings.gradeScale, lo = lowestMark();
  const marks = scale === 100 ? [100, 95, 90, 85, 80, 75, 70, 65, 60, 50] : Array.from({ length: scale - lo + 1 }, (_, i) => scale - i);
  const opts = v => html`<option value="">—</option>${marks.map(n => html`<option value="${n}" ${v === n ? raw('selected') : ''}>${n}</option>`)}`;
  openModal({
    title: t('Goals for {term}', { term: t(tr.name) }), cls: 'wide',
    body: html`
      <p class="muted" style="margin:0">${t('The mark you are aiming for in each subject. Studyspace shows whether you are on track and what your next grade needs to be.')}</p>
      <div class="row wrap small" style="gap:8px">${t('Same goal for every subject:')}${marks.slice(0, scale === 100 ? 5 : 4).map(n => html`<button type="button" class="chip" data-all="${n}">${n}</button>`)}<button type="button" class="chip" data-all="">${t('Clear')}</button></div>
      <div class="tm-list">${state.subjects.map(s => { const avg = subjectAverage(s.id, tr), off = officialMark(s.id, tr.id); return html`<label class="tm-row" style="--c:${s.color}">${subjGlyph(s.id, 'sm')}<span class="grow trunc">${s.name}</span><span class="tiny faint num">${off != null ? t('final {m}', { m: off }) : avg != null ? t('avg {n}', { n: fmtGrade(avg) }) : ''}</span><select class="select num goal-sel" name="g_${s.id}">${opts(goalOf(s.id, tr.id))}</select></label>`; })}</div>`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Save goals')}</button>`,
    onMount: scrim => scrim.querySelectorAll('[data-all]').forEach(b => { b.onclick = () => scrim.querySelectorAll('.goal-sel').forEach(sel => { sel.value = b.dataset.all; }); }),
    onSubmit: d => {
      commit(s => { for (const su of s.subjects) { const v = d['g_' + su.id]; if (v === '' || v == null) { if (s.goals[su.id]) { delete s.goals[su.id][tr.id]; if (!Object.keys(s.goals[su.id]).length) delete s.goals[su.id]; } } else (s.goals[su.id] ||= {})[tr.id] = +v; } });
      const n = state.subjects.filter(s => goalOf(s.id, tr.id) != null).length;
      toastUndo(t('Goals saved — {n}', { n: nt(n, 'subject', 'subjects') }));
    },
  });
}
ACT.goals = el => openGoals(el.dataset.id);
ACT['grade-term'] = el => setUI(u => { u.grades.term = el.dataset.id; });
ON.change['need-target'] = el => { const v = parseFloat(el.value.replace(',', '.')); if (!isFinite(v) || !el.dataset.term) return; commit(s => { (s.goals[el.dataset.id] ||= {})[el.dataset.term] = clamp(v, 0, s.settings.gradeScale); }); };
ACT['goal-clear'] = el => commit(s => { const g = s.goals[el.dataset.id]; if (g) { delete g[el.dataset.term]; if (!Object.keys(g).length) delete s.goals[el.dataset.id]; } });
ON.change['need-weight'] = el => setUI(u => { u.grades['w_' + el.dataset.id] = +el.value; });

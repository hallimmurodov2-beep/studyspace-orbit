'use strict';
/* ───────────── Insights: where the time went, and what it bought ───────────── */

function focusChart(from, days) {
  const W = 760, H = 330, L = 38, R = 8, T = 12, B = 28;
  const weekly = days > 45;
  const buckets = [];
  if (weekly) { for (let d = weekStart(from); d <= todayStr(); d = addDays(d, 7)) buckets.push({ from: d, to: addDays(d, 6), label: fmtDate(d, 'short') }); }
  else for (let i = 0; i < days; i++) { const d = addDays(from, i); buckets.push({ from: d, to: d, label: days <= 10 ? wdName(dow(d), 'short') : String(pd(d).getDate()), date: d }); }
  for (const b of buckets) {
    const ss = state.sessions.filter(s => s.date >= b.from && s.date <= b.to);
    b.parts = [...groupBy(ss, s => (subjectOf(s.subjectId) ? s.subjectId : '')).entries()].map(([id, list]) => ({ id, min: sum(list, s => s.min) })).sort((a, b2) => b2.min - a.min);
    b.total = sum(b.parts, p => p.min);
  }
  const goal = state.settings.dailyGoal * (weekly ? 7 : 1);
  const max = Math.max(goal * 1.1, ...buckets.map(b => b.total), 30);
  const step = max > 600 ? 120 : max > 240 ? 60 : max > 100 ? 30 : 15;
  const y = v => T + (H - T - B) * (1 - v / max);
  const bw = (W - L - R) / buckets.length, barW = Math.min(34, bw * 0.68);
  const grid = [];
  for (let v = 0; v <= max; v += step) grid.push(html`<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line)"/><text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="ax">${v >= 60 ? round1(v / 60) + t('h') : v}</text>`);
  const labelEvery = Math.ceil(buckets.length / (innerWidth < 700 ? 8 : 16));
  return html`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${t('Focus time per day')}">
    ${grid}
    <line x1="${L}" x2="${W - R}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}" stroke="var(--accent)" stroke-dasharray="4 5" opacity=".7"/>
    <text x="${W - R}" y="${(y(goal) - 5).toFixed(1)}" text-anchor="end" class="ax" fill="var(--accent)" style="fill:var(--accent)">${t('goal')}</text>
    ${buckets.map((b, i) => {
      const x = L + i * bw + (bw - barW) / 2; let acc = 0;
      const rects = b.parts.map((p, pi) => { const y1 = y(acc + p.min), hgt = y(acc) - y1; acc += p.min; return html`<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0.5, hgt - (pi < b.parts.length - 1 ? 1.5 : 0)).toFixed(1)}" rx="3" fill="${p.id ? subjColor(p.id) : 'var(--text-3)'}"/>`; });
      return html`<g class="barcol">${b.total ? rects : html`<rect x="${x.toFixed(1)}" y="${(y(0) - 2).toFixed(1)}" width="${barW.toFixed(1)}" height="2" rx="1" fill="var(--surface-3)"/>`}
        ${i % labelEvery === 0 ? html`<text x="${(x + barW / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="ax ${b.date === todayStr() ? 'now' : ''}">${b.label}</text>` : ''}
        <rect x="${(L + i * bw).toFixed(1)}" y="${T}" width="${bw.toFixed(1)}" height="${H - T - B}" fill="transparent"><title>${weekly ? `${fmtDate(b.from, 'short')} – ${fmtDate(b.to, 'short')}` : fmtDate(b.from, 'long')}: ${fmtDur(b.total)}</title></rect></g>`; })}
  </svg>`;
}

function donut(parts, total) {
  const S = 168, r = 62, c = 2 * Math.PI * r; let off = 0;
  return html`<div class="ring-wrap" style="width:${S}px;height:${S}px"><svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" style="transform:rotate(-90deg)">
    <circle cx="${S / 2}" cy="${S / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="20"/>
    ${parts.map(p => { const len = p.min / total * c; const el = html`<circle cx="${S / 2}" cy="${S / 2}" r="${r}" fill="none" stroke="${p.color}" stroke-width="20" stroke-dasharray="${Math.max(0, len - 2).toFixed(2)} ${(c - Math.max(0, len - 2)).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off += len; return el; })}
  </svg><div class="ring-label"><div><div class="big-num" style="font-size:19px">${fmtDur(total)}</div><div class="tiny faint">${t('total')}</div></div></div></div>`;
}

function heatmap(weeks = 20) {
  const today = todayStr(), start = addDays(weekStart(today), -(weeks - 1) * 7), goal = state.settings.dailyGoal;
  const cell = 15, gap = 4, L = 30, T = 18;
  const cells = [], months = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const ws = addDays(start, w * 7), m = pd(ws).getMonth();
    if (m !== lastMonth) { months.push({ w, label: fmtDate(ws, 'mon') }); lastMonth = m; }
    for (let d = 0; d < 7; d++) {
      const date = addDays(ws, d); if (date > today) continue;
      const min = focusMinOn(date);
      const lvl = !min ? 0 : min < goal * 0.34 ? 1 : min < goal * 0.67 ? 2 : min < goal ? 3 : 4;
      cells.push(html`<rect x="${L + w * (cell + gap)}" y="${T + d * (cell + gap)}" width="${cell}" height="${cell}" rx="4" class="hm l${lvl} ${date === today ? 'today' : ''}"><title>${fmtDate(date, 'long')}: ${min ? fmtDur(min) : t('no study')}</title></rect>`);
    }
  }
  const W = L + weeks * (cell + gap), H = T + 7 * (cell + gap);
  return html`<div class="hm-scroll"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="chart">${months.filter((mo, i) => !months[i + 1] || months[i + 1].w - mo.w >= 3).map(mo => html`<text x="${L + mo.w * (cell + gap)}" y="10" class="ax">${mo.label}</text>`)}
    ${[1, 3, 5].map(d => html`<text x="0" y="${T + (d - 1) * (cell + gap) + 11}" class="ax">${wdName(d, 'short')}</text>`)}${cells}</svg></div>
    <div class="row tiny faint" style="gap:5px;justify-content:flex-end;margin-top:8px">${t('less')}${[0, 1, 2, 3, 4].map(l => html`<svg width="13" height="13"><rect width="13" height="13" rx="3.5" class="hm l${l}"/></svg>`)}${t('more')}</div>`;
}

function hoursChart(sessions) {
  const hrs = new Array(24).fill(0);
  for (const s of sessions) { const d = new Date(s.at); let m = d.getHours() * 60 + d.getMinutes(), left = s.min; while (left > 0) { const h = Math.floor(m / 60) % 24, take = Math.min(left, 60 - (m % 60)); hrs[h] += take; left -= take; m += take; } }
  const max = Math.max(...hrs, 1), W = 480, H = 150, bw = W / 24;
  const peak = hrs.indexOf(Math.max(...hrs));
  return { peak: max > 1 ? peak : -1, svg: html`<svg viewBox="0 0 ${W} ${H}" class="chart">${hrs.map((v, h) => html`<rect x="${(h * bw + 3).toFixed(1)}" y="${(H - 22 - v / max * (H - 30)).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${Math.max(2, v / max * (H - 30)).toFixed(1)}" rx="3" fill="${h === peak && v ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 35%, var(--surface-3))'}"><title>${pad(h)}:00 — ${fmtDur(v)}</title></rect>${h % 3 === 0 ? html`<text x="${(h * bw + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="ax">${pad(h)}</text>` : ''}`)}</svg>` };
}

VIEWS.insights = {
  title: 'Insights', icon: 'chart',
  render() {
    const days = ui.insights.range, today = todayStr();
    const from = addDays(today, -(days - 1)), prevFrom = addDays(from, -days), prevTo = addDays(from, -1);
    const sessions = state.sessions.filter(s => s.date >= from && s.date <= today);
    const total = sum(sessions, s => s.min), prev = focusMinRange(prevFrom, prevTo);
    const delta = prev ? Math.round((total - prev) / prev * 100) : null;
    const fromTs = pd(from).setHours(0, 0, 0, 0);
    const done = state.tasks.filter(x => x.status === 'done' && x.doneAt >= fromTs);
    const reviews = sum(Object.entries(state.reviewLog).filter(([d]) => d >= from && d <= today), ([, n]) => n);
    const activeDaysN = new Set(sessions.map(s => s.date)).size;
    const parts = [...groupBy(sessions, s => (subjectOf(s.subjectId) ? s.subjectId : '')).entries()].map(([id, list]) => ({ id, name: id ? subjName(id) : t('No subject'), color: id ? subjColor(id) : 'var(--text-3)', min: sum(list, s => s.min) })).sort((a, b) => b.min - a.min);
    const hours = hoursChart(sessions);
    const est = state.tasks.filter(x => x.status === 'done' && x.est && taskLogged(x.id) > 0);
    const ratio = est.length >= 2 ? sum(est, x => taskLogged(x.id)) / sum(est, x => x.est) : null;
    const rated = sessions.filter(s => s.rating);
    const onTime = done.filter(x => x.due), onTimeN = onTime.filter(x => ymd(new Date(x.doneAt)) <= x.due).length;
    const tile = (label, value, sub, ic) => html`<div class="card pad stat"><div class="spread"><div class="eyebrow">${label}</div><span class="faint">${icon(ic, 16)}</span></div><div class="big-num" style="margin-top:10px">${value}</div><div class="small muted">${sub}</div></div>`;

    return html`
    <div class="page-head">
      <div><h1 class="h1">${t('Insights')}</h1><div class="sub">${t('Effort you can see. {a} – {b}.', { a: fmtDate(from, 'short'), b: fmtDate(today, 'short') })}</div></div>
      <div class="seg">${[[7, '7 days'], [30, '30 days'], [90, '90 days']].map(([n, l]) => html`<button class="${days === n ? 'on' : ''}" data-act="insight-range" data-n="${n}">${t(l)}</button>`)}</div>
    </div>
    ${state.sessions.length || state.tasks.length ? html`
    <div class="stat-row">
      ${tile(t('Focus time'), fmtDur(total), delta == null ? t('{n} a day on average', { n: fmtDur(total / days) }) : html`<span style="color:${delta >= 0 ? 'var(--ok)' : 'var(--danger)'};font-weight:650">${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}%</span> ${t('vs previous period')}`, 'timer')}
      ${tile(t('Study days'), html`${activeDaysN}<span style="font-size:15px;color:var(--text-3)"> / ${days}</span>`, t('{n} sessions', { n: sessions.length }), 'calendar')}
      ${tile(t('Tasks done'), done.length, onTime.length ? t('{p}% on time', { p: Math.round(onTimeN / onTime.length * 100) }) : t('keep going'), 'tasks')}
      ${tile(t('Streak'), html`${streak()}<span style="font-size:15px;color:var(--text-3)"> ${tn(streak(), 'day', 'days')}</span>`, t('best: {n}', { n: bestStreak() }), 'flame')}
    </div>
    <div class="insight-grid">
      <section class="card pad span2"><div class="card-head"><h2 class="h2">${days > 45 ? t('Focus time per week') : t('Focus time per day')}</h2><div class="legend hide-m">${parts.slice(0, 5).map(p => html`<span><i class="dot" style="--c:${p.color}"></i>${p.name}</span>`)}</div></div>${focusChart(from, days)}</section>
      <section class="card pad"><div class="card-head"><h2 class="h2">${t('By subject')}</h2></div>
        ${total ? html`<div class="donut-wrap">${donut(parts, total)}<div class="col grow" style="gap:8px;min-width:150px">${parts.slice(0, 7).map(p => html`<div><div class="spread small"><span class="row trunc" style="gap:7px"><i class="dot" style="--c:${p.color}"></i><span class="trunc">${p.name}</span></span><span class="num muted">${fmtDur(p.min)} · ${Math.round(p.min / total * 100)}%</span></div></div>`)}</div></div>` : html`<div class="small muted">${t('No focus time in this period yet.')}</div>`}
      </section>
      <section class="card pad"><div class="card-head"><h2 class="h2">${t('Your best hours')}</h2></div>${hours.svg}
        <div class="small muted" style="margin-top:8px">${hours.peak >= 0 ? t('You get the most done around {a}–{b}. Protect that time for your hardest subject.', { a: pad(hours.peak) + ':00', b: pad((hours.peak + 1) % 24) + ':00' }) : t('Log a few sessions to find your most productive hours.')}</div>
      </section>
      <section class="card pad span2"><div class="card-head"><h2 class="h2">${t('Consistency')}</h2><span class="small muted">${t('last 20 weeks')}</span></div>${heatmap(20)}</section>
      <section class="card pad"><div class="card-head"><h2 class="h2">${t('Estimates vs reality')}</h2></div>
        ${ratio != null ? html`<div class="big-num">${ratio.toFixed(1)}×</div><div class="small muted" style="margin-top:6px">${ratio > 1.15 ? t('Tasks take you about {p}% longer than you plan. Pad your estimates a little.', { p: Math.round((ratio - 1) * 100) }) : ratio < 0.85 ? t('You finish faster than planned — your estimates are generous.') : t('Your estimates are impressively accurate.')}</div><div class="tiny faint" style="margin-top:6px">${t('Based on {n} completed tasks with logged time.', { n: est.length })}</div>`
          : html`<div class="small muted">${t('Give tasks a time estimate and start focus sessions on them — Studyspace will learn how accurate your planning is.')}</div>`}
      </section>
      <section class="card pad"><div class="card-head"><h2 class="h2">${t('How sessions felt')}</h2></div>
        ${rated.length ? html`<div class="col" style="gap:10px">${[[3, 'Great', 'var(--ok)'], [2, 'Okay', 'var(--accent)'], [1, 'Tough', 'var(--warn)']].map(([v, l, c]) => { const n = rated.filter(s => s.rating === v).length; return html`<div><div class="spread small"><span>${t(l)}</span><span class="num muted">${n}</span></div><div class="bar" style="--c:${c};margin-top:5px"><i style="width:${Math.round(n / rated.length * 100)}%"></i></div></div>`; })}</div>` : html`<div class="small muted">${t('Rate a session when it ends to see patterns here.')}</div>`}
      </section>
      <section class="card pad"><div class="card-head"><h2 class="h2">${t('Memory')}</h2></div>
        <div class="big-num">${reviews}</div><div class="small muted" style="margin-top:6px">${t('flashcard reviews in this period')}</div>
        ${state.cards.length ? html`<div style="margin-top:12px">${masteryBar(deckStats(state.cards))}</div><div class="tiny faint" style="margin-top:6px">${t('{a} of {b} cards are mature (remembered for 3+ weeks).', { a: deckStats(state.cards).mature, b: state.cards.length })}</div>` : ''}
      </section>
    </div>`
    : html`<div class="card">${emptyState('chart', t('Nothing to chart yet'), t('Finish a focus session or complete a task and your progress shows up here.'), html`<a class="btn primary" href="#/focus">${icon('play', 14)}${t('Start a focus session')}</a>`)}</div>`}`;
  },
};
ACT['insight-range'] = el => setUI(u => { u.insights.range = +el.dataset.n; });

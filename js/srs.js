'use strict';
/* ───────────── spaced repetition (SM-2 family with learning steps) ───────────── */

const MIN = 60000, DAY = 864e5;

function newCard(props = {}) {
  return { id: uid(), deckId: '', front: '', back: '', state: 'new', step: 0, due: Date.now(), ivl: 0, ease: 2.5, reps: 0, lapses: 0, last: 0, ...props };
}

/* what each answer would do — used both to preview intervals on the buttons and to apply */
function srsOutcome(card, grade, now = Date.now()) {
  const c = { ...card, last: now, reps: card.reps + 1 };
  const dayStart = startOfDay(now);
  const graduate = days => { c.state = 'review'; c.step = 0; c.ivl = days; c.due = dayStart + days * DAY; };
  if (card.state !== 'review') {
    if (grade === 0) { c.state = 'learn'; c.step = 0; c.due = now + 1 * MIN; }
    else if (grade === 1) { c.state = 'learn'; c.due = now + 6 * MIN; }
    else if (grade === 2) { if (card.step >= 1) graduate(Math.max(1, card.ivl || 1)); else { c.state = 'learn'; c.step = 1; c.due = now + 10 * MIN; } }
    else graduate(Math.max(4, card.ivl || 4));
    return c;
  }
  if (grade === 0) {
    c.lapses = card.lapses + 1; c.ease = Math.max(1.3, card.ease - 0.2);
    c.ivl = Math.max(1, Math.round(card.ivl * 0.25)); c.state = 'learn'; c.step = 1; c.due = now + 10 * MIN;
  } else if (grade === 1) {
    c.ease = Math.max(1.3, card.ease - 0.15); graduate(Math.max(card.ivl + 1, Math.round(card.ivl * 1.2)));
  } else if (grade === 2) {
    graduate(Math.max(card.ivl + 1, Math.round(card.ivl * card.ease)));
  } else {
    c.ease = card.ease + 0.15; graduate(Math.max(card.ivl + 2, Math.round(card.ivl * card.ease * 1.3)));
  }
  return c;
}
function srsLabel(card, grade, now = Date.now()) {
  const o = srsOutcome(card, grade, now);
  if (o.state === 'learn') return `${Math.max(1, Math.round((o.due - now) / MIN))}${t('m')}`;
  const d = o.ivl;
  if (d < 30) return `${d}${t('d')}`;
  if (d < 365) return `${round1(d / 30)}${t('mo')}`;
  return `${round1(d / 365)}${t('y')}`;
}

const endOfToday = () => startOfDay() + DAY - 1;
const deckCards = deckId => state.cards.filter(c => c.deckId === deckId);
function deckStats(cards) {
  const now = Date.now(), eod = endOfToday();
  const st = { total: cards.length, fresh: 0, learning: 0, due: 0, young: 0, mature: 0 };
  for (const c of cards) {
    if (c.state === 'new') st.fresh++;
    else if (c.state === 'learn') { st.learning++; if (c.due <= eod) st.due++; }
    else { if (c.due <= eod) st.due++; if (c.ivl >= 21) st.mature++; else st.young++; }
  }
  return st;
}
const newLeftToday = () => Math.max(0, state.settings.newPerDay - (state.newLog[todayStr()] || 0));
/* cards to study right now: learning → due reviews → today's allowance of new cards */
function studyQueue(deckId) {
  const eod = endOfToday();
  const pool = deckId ? deckCards(deckId) : state.cards;
  const learn = pool.filter(c => c.state === 'learn' && c.due <= eod).sort((a, b) => a.due - b.due);
  const review = shuffle(pool.filter(c => c.state === 'review' && c.due <= eod));
  const fresh = pool.filter(c => c.state === 'new').slice(0, newLeftToday());
  return [...learn, ...review, ...fresh].map(c => c.id);
}
const dueCount = deckId => studyQueue(deckId).length;

/* Paste-to-import: one card per line, "front<TAB>back", "front ; back", "front - back", "front = back", "front :: back" */
function parseCardLines(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const l = line.trim(); if (!l) continue;
    let m = l.match(/^(.+?)\t+(.+)$/) || l.match(/^(.+?)\s*::\s*(.+)$/) || l.match(/^(.+?)\s*;\s*(.+)$/) || l.match(/^(.+?)\s+[-–—=]\s+(.+)$/) || l.match(/^(.+?)\s*=\s*(.+)$/);
    if (m) out.push({ front: m[1].trim(), back: m[2].trim() });
  }
  return out;
}

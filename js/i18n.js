'use strict';
/* ───────────── text helpers: placeholders, plurals, dates and durations (English) ───────────── */

/* t() fills {placeholders}; a "word|context" key shows just the word */
function t(s, vars) {
  let out = s.indexOf('|') > 0 ? s.replace(/\|[a-z]+$/, '') : s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return out;
}
/* plural noun: tn(3, 'task', 'tasks') → "tasks" */
function tn(n, one, many) { return n === 1 ? one : many; }
const nt = (n, one, many) => `${n} ${tn(n, one, many)}`;

const locale = () => 'en-GB';
const _fmtCache = new Map();
function dfmt(opts) {
  const k = JSON.stringify(opts);
  if (!_fmtCache.has(k)) _fmtCache.set(k, new Intl.DateTimeFormat(locale(), opts));
  return _fmtCache.get(k);
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const DATE_STYLES = {
  short: { day: 'numeric', month: 'short' },
  long: { weekday: 'long', day: 'numeric', month: 'long' },
  full: { day: 'numeric', month: 'long', year: 'numeric' },
  wd: { weekday: 'short' },
  wdlong: { weekday: 'long' },
  month: { month: 'long', year: 'numeric' },
  mon: { month: 'short' },
};
function fmtDate(s, style = 'short') {
  const d = typeof s === 'string' ? pd(s) : s;
  return cap(dfmt(DATE_STYLES[style] || style).format(d).replace(/\.$/, ''));
}
/* "Today", "Tomorrow", "Thu", "12 Nov" */
function relDay(s) {
  const d = diffDays(s, todayStr());
  if (d === 0) return t('Today');
  if (d === 1) return t('Tomorrow');
  if (d === -1) return t('Yesterday');
  if (d > 1 && d < 7) return fmtDate(s, 'wdlong');
  if (pd(s).getFullYear() !== new Date().getFullYear()) return fmtDate(s, 'full');
  return fmtDate(s, 'short');
}
/* minutes → "45m", "1h 20m" */
function fmtDur(min) {
  min = Math.round(min);
  const h = Math.floor(min / 60), m = min % 60;
  const H = t('h'), M = t('m');
  if (!h) return `${m}${M}`;
  return m ? `${h}${H} ${m}${M}` : `${h}${H}`;
}
/* "in 3 days", "2 days ago" */
function daysAway(n) {
  if (n === 0) return t('today');
  if (n === 1) return t('tomorrow');
  if (n === -1) return t('yesterday');
  return n > 0 ? t('in {n} {d}', { n, d: tn(n, 'day', 'days') }) : t('{n} {d} ago', { n: -n, d: tn(-n, 'day', 'days') });
}
const WD_KEYS = [1, 2, 3, 4, 5, 6, 7];
/* weekday name for 1..7 (Mon..Sun) */
function wdName(n, style = 'short') {
  return cap(dfmt({ weekday: style }).format(new Date(2024, 0, n)).replace(/\.$/, '')); // 1 Jan 2024 is a Monday
}

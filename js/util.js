'use strict';
/* ───────────── Studyspace Orbit · utilities ───────────── */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* Safe HTML templating: every interpolation is escaped unless it is itself
   the result of html`` / raw(). User text can never become markup. */
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]);
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
const raw = s => new Raw(String(s ?? ''));
function hv(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(hv).join('');
  return esc(v);
}
function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += hv(vals[i]) + strings[i + 1];
  return new Raw(out);
}

/* ── ids, numbers, collections ── */
const uid = () => Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 8);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const sum = (arr, fn = x => x) => arr.reduce((n, x) => n + (fn(x) || 0), 0);
const round1 = n => Math.round(n * 10) / 10;
function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}
function debounce(fn, ms) {
  let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}
/* deterministic pseudo-random (demo data, shuffles that should be stable) */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ── dates (local calendar days as YYYY-MM-DD strings) ── */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const isYmd = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(pd(s));
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((pd(a) - pd(b)) / 864e5);
const dow = s => pd(s).getDay() || 7;                 // 1 = Monday … 7 = Sunday
const weekStart = s => addDays(s, 1 - dow(s));
const isTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const fromMin = m => `${pad(Math.floor(clamp(m, 0, 1439) / 60))}:${pad(clamp(m, 0, 1439) % 60)}`;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const startOfDay = (ts = Date.now()) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };

/* ── DOM morphing: update the live DOM to match new markup while keeping
   focus, scroll, running CSS animations and typed text intact. ── */
const keyOf = n => (n.nodeType === 1 ? (n.getAttribute('data-key') || n.id || null) : null);
function morph(parent, markup) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(markup);
  morphChildren(parent, tpl.content);
}
function morphChildren(from, to) {
  const old = new Map();
  for (let c = from.firstChild; c; c = c.nextSibling) { const k = keyOf(c); if (k) old.set(k, c); }
  let cur = from.firstChild;
  let n = to.firstChild;
  while (n) {
    const nNext = n.nextSibling;
    const k = keyOf(n);
    let target = null;
    if (k) {
      target = old.get(k) || null;
      if (target) old.delete(k);
      if (target && target.nodeName !== n.nodeName) target = null;
    } else {
      let p = cur;
      while (p && keyOf(p)) p = p.nextSibling;
      if (p && p.nodeType === n.nodeType && p.nodeName === n.nodeName) target = p;
    }
    if (target) {
      if (target === cur) cur = cur.nextSibling;
      else from.insertBefore(target, cur);
      morphNode(target, n);
    } else {
      from.insertBefore(n, cur);
    }
    n = nNext;
  }
  while (cur) { const nx = cur.nextSibling; from.removeChild(cur); cur = nx; }
}
function morphNode(a, b) {
  if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  if (a.hasAttribute('data-keep')) return;
  for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
  for (const at of b.attributes) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  const tag = a.nodeName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    if (a !== document.activeElement) {
      if (tag === 'INPUT' && (a.type === 'checkbox' || a.type === 'radio')) a.checked = b.hasAttribute('checked');
      else if (tag === 'TEXTAREA') { if (a.value !== b.value) a.value = b.value; }
      else if (tag === 'INPUT') { const v = b.getAttribute('value') ?? ''; if (a.value !== v) a.value = v; }
    }
    if (tag !== 'SELECT') return;
  }
  if (a.hasAttribute('data-static')) return;
  morphChildren(a, b);
  if (tag === 'SELECT' && a !== document.activeElement) {
    const sel = [...a.options].find(o => o.hasAttribute('selected'));
    if (sel && a.value !== sel.value) a.value = sel.value;
  }
}

/* ── SVG geometry helpers ── */
function polar(cx, cy, r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arcPath(cx, cy, r, a1, a2) {
  if (a2 - a1 >= 359.99) a2 = a1 + 359.99;
  const [x1, y1] = polar(cx, cy, r, a1), [x2, y2] = polar(cx, cy, r, a2);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/* file helpers */
function downloadFile(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function pickFile(cb) {
  const inp = $('#file-input');
  inp.value = '';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => cb(String(r.result), f.name);
    r.readAsText(f);
  };
  inp.click();
}

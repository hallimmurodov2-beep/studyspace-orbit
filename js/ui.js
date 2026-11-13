'use strict';
/* ───────────── UI primitives: toasts, modals, menus, rings ───────────── */

function toast(msg, opts = {}) {
  const el = document.createElement('div');
  el.className = 'toast' + (opts.kind ? ' ' + opts.kind : '');
  el.innerHTML = html`<span>${msg}</span>${opts.action ? html`<button type="button">${opts.action}</button>` : ''}`;
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  if (opts.action) el.querySelector('button').onclick = () => { opts.onAction && opts.onAction(); kill(); };
  const box = $('#toasts');
  while (box.children.length > 2) box.firstChild.remove();
  box.appendChild(el);
  setTimeout(kill, opts.ms || (opts.action ? 6000 : 3200));
}
/* "Done. [Undo]" — destructive actions never need a confirm dialog */
function toastUndo(msg) {
  toast(msg, { action: t('Undo'), onAction: () => { undo(); } });
}

/* ── modal stack ── */
const modalStack = [];
function openModal({ title, body, foot, cls = '', onSubmit, onClose, onMount, bare }) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = bare ? String(body) : html`
    <form class="modal ${cls}" novalidate role="dialog" aria-modal="true">
      <div class="modal-head"><h2 class="h2">${title}</h2><button type="button" class="btn ghost icon sm" data-close aria-label="${t('Close')}">${icon('x', 16)}</button></div>
      <div class="modal-body">${body}</div>
      ${foot ? html`<div class="modal-foot">${foot}</div>` : ''}
    </form>`;
  const entry = { el: scrim, onClose, prevFocus: document.activeElement };
  scrim.addEventListener('mousedown', e => { if (e.target === scrim) entry.downOnScrim = true; });
  scrim.addEventListener('mouseup', e => { if (e.target === scrim && entry.downOnScrim) closeModal(entry); entry.downOnScrim = false; });
  scrim.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(entry); });
  const form = scrim.querySelector('form');
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    if (!onSubmit) return;
    const data = Object.fromEntries(new FormData(form).entries());
    if (onSubmit(data, form, e.submitter) !== false) closeModal(entry);
  });
  $('#overlays').appendChild(scrim);
  modalStack.push(entry);
  document.body.style.overflow = 'hidden';
  if (onMount) onMount(scrim, entry);
  const auto = scrim.querySelector('[autofocus]') || scrim.querySelector('input:not([type=hidden]),textarea,select,button.primary');
  if (auto) setTimeout(() => { auto.focus(); if (auto.select && auto.type !== 'date' && auto.type !== 'time') try { auto.select(); } catch (e) {} }, 30);
  return entry;
}
function closeModal(entry) {
  entry = entry || modalStack[modalStack.length - 1];
  if (!entry) return;
  const i = modalStack.indexOf(entry);
  if (i < 0) return;
  modalStack.splice(i, 1);
  entry.el.remove();
  if (!modalStack.length) document.body.style.overflow = '';
  if (entry.onClose) entry.onClose();
  if (entry.prevFocus && entry.prevFocus.isConnected) try { entry.prevFocus.focus({ preventScroll: true }); } catch (e) {}
}
function closeAllModals() { while (modalStack.length) closeModal(); }

function confirmModal(title, text, yesLabel, onYes) {
  openModal({
    title, cls: 'narrow',
    body: html`<p class="muted">${text}</p>`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary" style="background:var(--danger);box-shadow:none">${yesLabel}</button>`,
    onSubmit: () => { onYes(); },
  });
}

/* ── popover menu ── */
let _menuEl = null;
function closeMenu() { if (_menuEl) { _menuEl.remove(); _menuEl = null; } }
function openMenu(anchor, items) {
  closeMenu();
  const el = document.createElement('div');
  el.className = 'menu';
  el.innerHTML = items.map((it, i) => it === '-' ? '<div class="menu-sep"></div>'
    : html`<button type="button" class="menu-item ${it.danger ? 'danger' : ''}" data-i="${i}">${it.icon ? icon(it.icon, 16) : ''}<span>${it.label}</span>${it.checked ? html`<span style="margin-left:auto;color:var(--accent)">${icon('check', 15)}</span>` : ''}</button>`.s).join('');
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  let x = Math.min(r.left, innerWidth - w - 10), y = r.bottom + 6;
  if (r.right - w > 10 && r.left + w > innerWidth - 10) x = r.right - w;
  if (y + h > innerHeight - 10) y = Math.max(10, r.top - h - 6);
  el.style.left = Math.max(10, x) + 'px'; el.style.top = y + 'px';
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const it = items[+b.dataset.i];
    closeMenu();
    it.fn && it.fn();
  });
  _menuEl = el;
}
document.addEventListener('mousedown', e => { if (_menuEl && !_menuEl.contains(e.target)) closeMenu(); }, true);
window.addEventListener('scroll', closeMenu, true);
window.addEventListener('resize', closeMenu);

/* ── progress ring ── */
function ring(pct, size = 64, stroke = 7, color = 'var(--accent)', label = '') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - clamp(pct, 0, 1));
  return html`<div class="ring-wrap" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
      <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
      <circle class="ring-val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>
    </svg>
    <div class="ring-label">${label}</div>
  </div>`;
}

/* ── small render helpers ── */
function subjChip(id, cls = '') {
  const s = subjectOf(id); if (!s) return '';
  return html`<span class="chip subj ${cls}" style="--c:${s.color}"><i class="dot"></i><span class="trunc">${s.name}</span></span>`;
}
function subjGlyph(id, cls = '') {
  const s = subjectOf(id);
  return html`<span class="glyph ${cls}" style="--c:${s ? s.color : 'var(--text-3)'}">${icon(s ? (s.icon || 'book') : 'layers', cls === 'lg' ? 24 : cls === 'sm' ? 15 : 19)}</span>`;
}
function subjectOptions(selected, emptyLabel) {
  return html`${emptyLabel !== false ? html`<option value="">${emptyLabel || t('No subject')}</option>` : ''}${state.subjects.map(s => html`<option value="${s.id}" ${s.id === selected ? raw('selected') : ''}>${s.name}</option>`)}`;
}
function options(list, selected) {
  return list.map(([v, label]) => html`<option value="${v}" ${String(v) === String(selected) ? raw('selected') : ''}>${label}</option>`);
}
function emptyState(ic, title, text, action) {
  return html`<div class="empty"><div class="empty-art">${icon(ic, 28)}</div><b>${title}</b><p>${text}</p>${action || ''}</div>`;
}
function dueChip(task) {
  if (!task.due) return '';
  const d = diffDays(task.due, todayStr());
  const done = task.status === 'done';
  const cls = done ? '' : d < 0 ? 'danger' : d === 0 ? 'warn' : d === 1 ? 'accent' : '';
  return html`<span class="chip ${cls}">${icon('calendar', 12)}${relDay(task.due)}</span>`;
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#7b6cff', '#38c6ff', '#2fbf71', '#f2b92f', '#ff5c9a', '#ff8a3d'];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', (Math.random() * 240 - 120) + 'px');
    p.style.setProperty('--rot', (Math.random() * 900 - 450) + 'deg');
    p.style.animationDuration = 1.4 + Math.random() * 1.4 + 's';
    p.style.animationDelay = Math.random() * 0.25 + 's';
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3400);
}

/* minimal, safe Markdown → HTML (notes) */
function md(src) {
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const lines = String(src || '').split('\n');
  let out = '', list = '', inCode = false;
  const closeList = () => { if (list) { out += `</${list}>`; list = ''; } };
  for (const line of lines) {
    if (line.trim().startsWith('```')) { closeList(); out += inCode ? '</pre>' : '<pre>'; inCode = !inCode; continue; }
    if (inCode) { out += esc(line) + '\n'; continue; }
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)/))) { closeList(); out += `<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`; }
    else if ((m = line.match(/^\s*[-*]\s+\[( |x)\]\s+(.*)/i))) { if (list !== 'ul') { closeList(); out += '<ul>'; list = 'ul'; } out += `<li class="todo ${m[1] !== ' ' ? 'done' : ''}">${inline(m[2])}</li>`; }
    else if ((m = line.match(/^\s*[-*]\s+(.*)/))) { if (list !== 'ul') { closeList(); out += '<ul>'; list = 'ul'; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { closeList(); out += '<ol>'; list = 'ol'; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = line.match(/^>\s?(.*)/))) { closeList(); out += `<blockquote>${inline(m[1])}</blockquote>`; }
    else if (/^---+$/.test(line.trim())) { closeList(); out += '<hr>'; }
    else if (!line.trim()) { closeList(); }
    else { closeList(); out += `<p>${inline(line)}</p>`; }
  }
  closeList(); if (inCode) out += '</pre>';
  return raw(out);
}

/* ───────────── registries shared by every view ───────────── */
const VIEWS = {};                                           // name → { title, icon, render(arg), after? }
const ACT = {};                                             // click handlers: data-act="name"
const ON = { input: {}, change: {}, submit: {}, keydown: {} };  // other delegated events: data-input="name" …
const ui = {                                                // transient UI state (never persisted)
  taskOpen: '', tasks: { filter: 'all', group: 'date', layout: 'list' },
  cal: { anchor: '', tray: false }, insights: { range: 30 }, notes: { open: '', q: '', preview: false },
  cards: { q: '' }, grades: { open: '' }, diary: { anchor: '', add: '' }, exams: { past: false }, settings: { tab: 'profile' }, dragging: false,
};
let route = { view: 'today', arg: '' };
function go(path) { if (location.hash === '#/' + path) requestRender(); else location.hash = '#/' + path; }
function setUI(fn) { fn(ui); requestRender(); }

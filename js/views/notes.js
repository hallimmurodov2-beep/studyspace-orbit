'use strict';
/* ───────────── Notes: fast Markdown notebook ───────────── */

function noteSnippet(n) { return n.body.replace(/[#*`>\-\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90); }

VIEWS.notes = {
  title: 'Notes', icon: 'note',
  render() {
    const q = ui.notes.q.trim().toLowerCase();
    let list = state.notes.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);
    if (q) list = list.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
    let open = byId(state.notes, ui.notes.open);
    if (!open && list.length && innerWidth > 760) { open = list[0]; ui.notes.open = open.id; }
    const words = open ? (open.body.trim().match(/\S+/g) || []).length : 0;
    return html`
    <div class="page-head">
      <div><h1 class="h1">${t('Notes')}</h1><div class="sub">${t('Summaries, formulas, ideas. Markdown supported.')}</div></div>
      <button class="btn primary" data-act="new-note">${icon('plus', 16)}${t('New note')}</button>
    </div>
    ${state.notes.length ? html`
    <div class="notes-layout ${open ? 'has-open' : ''}">
      <aside class="notes-list card">
        <div class="quick" style="height:40px;border:0;border-bottom:1px solid var(--line);border-radius:0;box-shadow:none">${icon('search', 16)}<input value="${ui.notes.q}" placeholder="${t('Search notes…')}" data-input="notes-q" data-keep></div>
        <div class="notes-scroll">${list.map(n => html`<button class="note-item ${n.id === ui.notes.open ? 'on' : ''}" data-key="n-${n.id}" data-act="open-note" data-id="${n.id}" style="--c:${subjColor(n.subjectId)}">
          <div class="row" style="gap:6px">${n.pinned ? icon('pin', 12, 'faint') : ''}<b class="trunc grow">${n.title || t('Untitled')}</b><span class="tiny faint">${fmtDate(ymd(new Date(n.updatedAt)), 'short')}</span></div>
          <div class="tiny muted trunc">${noteSnippet(n) || t('Empty note')}</div>
          ${n.subjectId && subjectOf(n.subjectId) ? html`<div class="row tiny faint" style="gap:5px"><i class="dot"></i>${subjName(n.subjectId)}</div>` : ''}
        </button>`)}${list.length ? '' : html`<div class="empty" style="padding:24px"><p>${t('No notes match.')}</p></div>`}</div>
      </aside>
      <section class="note-editor card" ${open ? raw(`data-key="ne-${open.id}"`) : ''}>
        ${open ? html`
        <div class="note-bar">
          <button class="btn icon sm ghost only-m" data-act="close-note">${icon('left', 16)}</button>
          <select class="select" style="width:auto;height:30px;font-size:12.5px" data-change="note-subject">${subjectOptions(open.subjectId)}</select>
          <div class="grow"></div>
          <span class="tiny faint hide-m">${nt(words, 'word', 'words')}</span>
          <div class="seg"><button class="${ui.notes.preview ? '' : 'on'}" data-act="note-mode" data-m="edit">${icon('edit', 14)}<span class="hide-m">${t('Write')}</span></button><button class="${ui.notes.preview ? 'on' : ''}" data-act="note-mode" data-m="preview">${icon('eye', 14)}<span class="hide-m">${t('Read')}</span></button></div>
          <button class="btn icon sm ghost ${open.pinned ? 'pinned' : ''}" data-act="pin-note" title="${t('Pin')}">${icon('pin', 15)}</button>
          <button class="btn icon sm ghost" data-act="note-menu">${icon('more', 16)}</button>
        </div>
        <input class="input bare note-title" value="${open.title}" placeholder="${t('Title')}" data-input="note-title">
        ${ui.notes.preview ? html`<div class="md">${open.body.trim() ? md(open.body) : html`<p class="faint">${t('Nothing here yet.')}</p>`}</div>`
          : html`<textarea class="input bare note-body" placeholder="${t('Start writing…  # heading, **bold**, - list, - [ ] checkbox')}" data-input="note-body">${open.body}</textarea>`}`
        : emptyState('note', t('Pick a note'), t('Choose a note on the left or start a new one.'))}
      </section>
    </div>`
    : html`<div class="card">${emptyState('note', t('Your notebook is empty'), t('Write summaries in your own words — it is one of the most effective ways to learn.'), html`<button class="btn primary" data-act="new-note">${icon('plus', 16)}${t('New note')}</button>`)}</div>`}`;
  },
};

function newNote(pre = {}) {
  const n = { id: uid(), title: '', body: '', subjectId: pre.subjectId || '', projectId: '', pinned: false, updatedAt: Date.now() };
  commit(s => { s.notes.push(n); });
  ui.notes.open = n.id; ui.notes.preview = false; ui.notes.q = '';
  go('notes');
  setTimeout(() => { const el = $('.note-title'); if (el) el.focus(); }, 80);
}
const mutNote = fn => { const n = byId(state.notes, ui.notes.open); if (n) { fn(n); n.updatedAt = Date.now(); state.updatedAt = Date.now(); scheduleSave(); } };
ACT['new-note'] = el => newNote({ subjectId: el.dataset.subject });
ACT['open-note'] = el => { ui.notes.open = el.dataset.id; if (route.view !== 'notes') go('notes'); else requestRender(); };
ACT['close-note'] = () => setUI(u => { u.notes.open = ''; });
ACT['note-mode'] = el => setUI(u => { u.notes.preview = el.dataset.m === 'preview'; });
ACT['pin-note'] = () => { mutNote(n => { n.pinned = !n.pinned; }); requestRender(); };
ACT['note-menu'] = el => {
  const n = byId(state.notes, ui.notes.open); if (!n) return;
  openMenu(el, [
    { icon: 'cards', label: t('Turn lines into flashcards'), fn: () => { const rows = parseCardLines(n.body); if (!rows.length) { toast(t('No “term - definition” lines found in this note.')); return; } openImportCards(''); setTimeout(() => { const ta = $('.modal textarea[name=text]'); if (ta) { ta.value = rows.map(r => `${r.front} - ${r.back}`).join('\n'); ta.dispatchEvent(new Event('input')); } }, 50); } },
    { icon: 'download', label: t('Download as .md'), fn: () => downloadFile((n.title || 'note').replace(/[^\p{L}\d _-]/gu, '') + '.md', `# ${n.title}\n\n${n.body}`, 'text/markdown') },
    '-',
    { icon: 'trash', label: t('Delete note'), danger: true, fn: () => { commit(s => { s.notes = s.notes.filter(x => x.id !== n.id); }); ui.notes.open = ''; toastUndo(t('Note deleted')); } },
  ]);
};
/* typing writes straight to state and saves — no re-render, so the caret never jumps */
ON.input['note-title'] = el => mutNote(n => { n.title = el.value; });
ON.input['note-body'] = el => mutNote(n => { n.body = el.value; });
ON.input['notes-q'] = el => setUI(u => { u.notes.q = el.value; });
ON.change['note-subject'] = el => { mutNote(n => { n.subjectId = el.value; }); requestRender(); };
document.addEventListener('focusout', e => { if (e.target.matches && e.target.matches('.note-title,.note-body')) requestRender(); });

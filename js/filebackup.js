'use strict';
/* ───────────── Backup file: the workspace saves itself into a file you choose ─────────────
   Pick a file once (a folder that iCloud Drive, Google Drive or Dropbox keeps in sync works well) and every change is
   written to it a moment later — so a cleared browser, a lost laptop or a second computer is never a problem.
   Uses the File System Access API (Chrome, Edge and other Chromium browsers on a computer). The file handle is kept
   in IndexedDB; after a browser restart the browser may ask once for permission to keep writing to it. */
const FileBackup = (() => {
  const INFO_KEY = STORE_KEY + '.file', HANDLE_KEY = SANDBOX ? 'backup-file-sandbox' : 'backup-file';
  const supported = typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function' && typeof indexedDB !== 'undefined';
  let handle = null, status = 'off', timer = 0, writing = false, dirty = false, newer = null;   // status: off | on | ask | error

  const info = () => { try { return JSON.parse(localStorage.getItem(INFO_KEY) || 'null'); } catch (e) { return null; } };
  const setInfo = v => { try { if (v) localStorage.setItem(INFO_KEY, JSON.stringify(v)); else localStorage.removeItem(INFO_KEY); } catch (e) { /* best effort */ } };
  const repaint = () => { if (typeof requestRender === 'function') requestRender(); };

  /* one tiny key-value store in IndexedDB: file handles cannot live in localStorage */
  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('studyspace-orbit', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction('kv', mode), rq = fn(tx.objectStore('kv'));
        tx.oncomplete = () => { db.close(); resolve(rq && rq.result); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  }
  const payload = () => JSON.stringify({ app: 'studyspace-orbit', exportedAt: new Date().toISOString(), state }, null, 1);

  async function init() {
    if (!supported || !info()) return;
    try { handle = await idb('readonly', s => s.get(HANDLE_KEY)); } catch (e) { handle = null; }
    if (!handle) { setInfo(null); return; }
    try { status = (await handle.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'on' : 'ask'; } catch (e) { status = 'ask'; }
    if (status === 'on' && !(await checkNewer())) schedule();
    repaint();
  }
  /* start saving into this handle; a file that already holds a workspace is never overwritten without asking */
  async function adopt(h, { askFirst = false } = {}) {
    handle = h; newer = null;
    await idb('readwrite', s => s.put(h, HANDLE_KEY));
    setInfo({ name: h.name, at: 0 });
    status = 'on';
    if (askFirst) {
      let p = 'prompt';
      try { p = await h.queryPermission({ mode: 'readwrite' }); if (p !== 'granted') p = await h.requestPermission({ mode: 'readwrite' }); } catch (e) { /* asked again from the banner */ }
      status = p === 'granted' ? 'on' : 'ask';
      const found = await peek();
      if (found) { newer = found; repaint(); return status; }
    }
    if (status === 'on') await write();
    repaint();
    return status;
  }
  const TYPES = [{ description: 'Studyspace backup', accept: { 'application/json': ['.json'] } }];
  async function choose() {
    try { return await adopt(await window.showSaveFilePicker({ suggestedName: 'studyspace-orbit.json', types: TYPES })); }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; throw e; }
  }
  async function openExisting() {
    try { const [h] = await window.showOpenFilePicker({ types: TYPES }); return await adopt(h, { askFirst: true }); }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; throw e; }
  }
  async function reconnect() {
    if (!handle) return false;
    let p = 'denied';
    try { p = await handle.requestPermission({ mode: 'readwrite' }); } catch (e) { /* stays disconnected */ }
    status = p === 'granted' ? 'on' : 'ask';
    if (status === 'on' && !(await checkNewer())) await write();
    repaint();
    return status === 'on';
  }
  async function stop() {
    clearTimeout(timer); handle = null; status = 'off'; newer = null; setInfo(null);
    try { await idb('readwrite', s => s.delete(HANDLE_KEY)); } catch (e) { /* nothing to remove */ }
    repaint();
  }
  async function write() {
    if (!handle || status !== 'on' || newer) return false;
    if (writing) { dirty = true; return false; }
    writing = true;
    try {
      const w = await handle.createWritable();
      await w.write(payload());
      await w.close();
      setInfo({ name: handle.name, at: Date.now() });
    } catch (e) { status = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'ask' : 'error'; }
    writing = false;
    if (dirty) { dirty = false; schedule(); }
    if (status !== 'on' || (typeof route !== 'undefined' && route.view === 'settings')) repaint();
    return status === 'on';
  }
  function schedule() { if (status !== 'on' || newer) return; clearTimeout(timer); timer = setTimeout(write, 1200); }
  /* what the file holds right now: { data, at } for a Studyspace backup, otherwise null */
  async function peek() {
    try {
      const text = await (await handle.getFile()).text();
      const data = text.trim() ? JSON.parse(text) : null, st = data && data.app === 'studyspace-orbit' && data.state;
      return st && typeof st === 'object' ? { data, at: st.updatedAt || 0 } : null;
    } catch (e) { return null; }
  }
  /* the file was changed somewhere else (another computer, through a synced folder): offer to load it */
  async function checkNewer() {
    const found = handle && status === 'on' ? await peek() : null;
    newer = found && found.at > (state.updatedAt || 0) + 2000 ? found : null;
    if (newer) repaint();
    return !!newer;
  }
  function loadNewer() {
    if (!newer) return;
    const d = newer.data; newer = null;
    replaceState(d.state);
    toastUndo(t('Loaded the workspace from {name}', { name: handle ? handle.name : t('the backup file') }));
  }
  function keepMine() { newer = null; write(); repaint(); }

  return {
    supported, init, choose, openExisting, adopt, reconnect, stop, write, schedule, checkNewer, loadNewer, keepMine, peek,
    get status() { return status; }, get newer() { return newer; },
    get name() { return (info() || {}).name || ''; }, get savedAt() { return (info() || {}).at || 0; },
    /* a linked file that is being written to counts as a backup: no reminders needed */
    covers(now = Date.now()) { const i = info(); return !!i && (status === 'on' || now - (i.at || 0) < 3 * 864e5); },
  };
})();

/* ── the pieces of interface: a row in Settings → Your data, and a banner when the file needs attention ── */
function fileBackupRow() {
  if (!FileBackup.supported) return html`<div class="set-row"><div class="grow"><div class="h3">${t('Save to a file automatically')}</div><div class="small muted">${t('Available in Chrome and Edge on a computer. Here, use Export now and then.')}</div></div></div>`;
  const st = FileBackup.status, name = FileBackup.name, at = FileBackup.savedAt, nw = FileBackup.newer;
  if (nw) return html`<div class="set-row fb-row"><div class="grow"><div class="h3">${t('{name} already holds a workspace', { name })}</div><div class="small muted">${t('Saved {d}. Load it here, or replace it with what is on this device?', { d: fmtStamp(nw.at) })}</div></div>
    <div class="set-ctl row wrap"><button class="btn" data-act="fb-keep">${t('Replace the file')}</button><button class="btn primary" data-act="fb-load">${t('Load it')}</button></div></div>`;
  if (st === 'off') return html`<div class="set-row fb-row"><div class="grow"><div class="h3">${t('Save to a file automatically')}</div><div class="small muted">${t('Pick a file once — a folder kept in sync by iCloud Drive or Google Drive works well — and every change is saved to it a moment later. Nothing to remember.')} <button class="linkbtn" data-act="fb-open">${t('Open a backup file you already have')}</button></div></div>
    <div class="set-ctl"><button class="btn primary" data-act="fb-choose">${icon('folder', 15)}${t('Choose a file')}</button></div></div>`;
  const head = st === 'on' ? html`<span class="fb-dot ok"></span>${t('Saving to {name}', { name })}` : st === 'ask' ? html`<span class="fb-dot warn"></span>${t('{name} is waiting for your OK', { name })}` : html`<span class="fb-dot bad"></span>${t('Could not write to {name}', { name })}`;
  const sub = st === 'on' ? (at ? t('Last saved {d}. Every change is written a moment after you make it.', { d: fmtStamp(at) }) : t('Every change is written a moment after you make it.'))
    : st === 'ask' ? t('After a restart the browser asks before it writes to your file again. Choose “Allow on every visit” to stop it asking.')
    : t('The file may have been moved or the disk is full. Try again, or choose another file.');
  return html`<div class="set-row fb-row"><div class="grow"><div class="h3 fb-head">${head}</div><div class="small muted">${sub}</div></div>
    <div class="set-ctl row wrap">${st === 'on' ? '' : html`<button class="btn primary" data-act="fb-reconnect">${st === 'ask' ? t('Reconnect') : t('Try again')}</button>`}<button class="btn" data-act="fb-stop">${t('Stop')}</button></div></div>`;
}
/* time of a save, in words a person would use */
function fmtStamp(ts) {
  const d = new Date(ts), day = ymd(d), hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
  return day === todayStr() ? t('today at {t}', { t: hm }) : day === addDays(todayStr(), -1) ? t('yesterday at {t}', { t: hm }) : fmtDate(day, 'short');
}
function fileBackupBanner() {
  const st = FileBackup.status, name = FileBackup.name, nw = FileBackup.newer;
  if (nw) return html`<div class="banner info" data-key="fb-banner">
    <span class="glyph" style="--c:var(--accent)">${icon('download', 17)}</span>
    <div class="grow"><b>${t('A newer copy is in {name}', { name })}</b><div class="small muted">${t('Saved {d} — probably on another computer.', { d: fmtStamp(nw.at) })}</div></div>
    <button class="btn sm ghost" data-act="fb-keep">${t('Keep this one')}</button>
    <button class="btn sm primary" data-act="fb-load">${t('Load it')}</button>
  </div>`;
  if (st !== 'ask' && st !== 'error') return '';
  return html`<div class="banner" data-key="fb-banner">
    <span class="glyph" style="--c:var(--warn)">${icon('folder', 17)}</span>
    <div class="grow"><b>${st === 'ask' ? t('Reconnect your backup file') : t('The backup file could not be written')}</b><div class="small muted">${st === 'ask' ? t('One click lets Studyspace keep saving to {name}.', { name }) : t('{name} may have been moved. Changes are still safe in this browser.', { name })}</div></div>
    <a class="btn sm ghost" href="#/settings/data">${t('Settings')}</a>
    <button class="btn sm primary" data-act="fb-reconnect">${st === 'ask' ? t('Reconnect') : t('Try again')}</button>
  </div>`;
}
const fbFail = e => toast(t('That did not work: {m}', { m: String(e && e.message || e).slice(0, 80) }), { kind: 'danger' });
ACT['fb-choose'] = () => FileBackup.choose().then(r => { if (r === 'on') toast(t('Saving to {name} from now on', { name: FileBackup.name })); }).catch(fbFail);
ACT['fb-open'] = () => FileBackup.openExisting().then(r => { if (r === 'on' && !FileBackup.newer) toast(t('Saving to {name} from now on', { name: FileBackup.name })); }).catch(fbFail);
ACT['fb-reconnect'] = () => FileBackup.reconnect().then(ok => { if (ok && !FileBackup.newer) toast(t('Backup file reconnected')); }).catch(fbFail);
ACT['fb-stop'] = () => { FileBackup.stop(); toast(t('The file stays where it is; Studyspace no longer writes to it.')); };
ACT['fb-load'] = () => FileBackup.loadNewer();
ACT['fb-keep'] = () => FileBackup.keepMine();

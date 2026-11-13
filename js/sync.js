'use strict';
/* ───────────── Sync: the same workspace on every device ─────────────
   Off by default. When it is on, the workspace is encrypted on this device (AES-GCM, key derived from the sync code)
   and the unreadable result is stored online; other devices that know the code fetch it, decrypt it and merge.
   The server never sees the code or the key — only a fingerprint of the code and the encrypted text.
   Changes made on two devices are merged record by record against the last version both had (a three-way merge),
   so homework written on the phone and a grade entered on the computer both survive. */
const SYNC_URL = 'https://hdbowgsbjbdcshcqwjzf.supabase.co/rest/v1/rpc/';
const SYNC_KEY = 'sb_publishable_zJBu-eumHrdKm2hGl8VcyQ_IZFG8q1V';       // a public key: it can only call the three sync functions

/* ── what is synced: everything except what belongs to one device (running timer, backup bookkeeping) ── */
function syncDoc(s) { const { timer, meta, updatedAt, ...doc } = s; return doc; }
const SYNC_LISTS = ['subjects', 'tasks', 'projects', 'lessons', 'events', 'exams', 'grades', 'decks', 'cards', 'sessions', 'notes', 'terms', 'daysOff'];
const SYNC_MAPS = ['termMarks', 'goals', 'changes'];                    // { key: { key: value } }
const SYNC_LOGS = ['reviewLog', 'newLog'];                              // { date: count }
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

/* one value, three versions: whoever changed it wins; if both did, the newer side wins */
function pick3(b, m, t, theirsNewer) {
  if (sameJSON(m, t)) return m;
  if (sameJSON(m, b)) return t;
  if (sameJSON(t, b)) return m;
  return theirsNewer ? t : m;
}
function mergeObj(b, m, t, theirsNewer) {
  b = isObj(b) ? b : {}; m = isObj(m) ? m : {}; t = isObj(t) ? t : {};
  const out = {};
  for (const k of new Set([...Object.keys(m), ...Object.keys(t)])) { const v = pick3(b[k], m[k], t[k], theirsNewer); if (v !== undefined) out[k] = v; }
  return out;
}
/* lists of records with ids: additions from both sides are kept, a deletion wins only over an untouched record,
   and a record edited on both sides is merged field by field */
function mergeList(b, m, t, theirsNewer) {
  const idOf = x => (x && x.id != null ? String(x.id) : JSON.stringify(x));
  const B = new Map((b || []).map(x => [idOf(x), x])), M = new Map((m || []).map(x => [idOf(x), x])), T = new Map((t || []).map(x => [idOf(x), x]));
  const out = [];
  for (const [id, mine] of M) {
    const base = B.get(id);
    if (!T.has(id)) { if (base === undefined || !sameJSON(mine, base)) out.push(mine); continue; }     // deleted there: gone unless edited here
    const theirs = T.get(id);
    out.push(isObj(mine) && isObj(theirs) ? mergeObj(base, mine, theirs, theirsNewer) : pick3(base, mine, theirs, theirsNewer));
  }
  for (const [id, theirs] of T) {
    if (M.has(id)) continue;
    const base = B.get(id);
    if (base === undefined || !sameJSON(theirs, base)) out.push(theirs);                               // new there, or deleted here but edited there
  }
  return out;
}
function mergeDocs(base, mine, theirs, theirsNewer) {
  const b = base || {}, out = {};
  for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
    if (SYNC_LISTS.includes(k)) out[k] = mergeList(base ? b[k] : null, mine[k], theirs[k], theirsNewer);
    else if (SYNC_MAPS.includes(k)) {
      const o = {};
      for (const kk of new Set([...Object.keys(mine[k] || {}), ...Object.keys(theirs[k] || {})])) { const v = mergeObj((b[k] || {})[kk], (mine[k] || {})[kk], (theirs[k] || {})[kk], theirsNewer); if (Object.keys(v).length) o[kk] = v; }
      out[k] = o;
    } else if (SYNC_LOGS.includes(k)) {
      const o = {}, bm = b[k] || {}, mm = mine[k] || {}, tm = theirs[k] || {};
      for (const d of new Set([...Object.keys(mm), ...Object.keys(tm)])) {
        const v = sameJSON(mm[d], bm[d]) ? tm[d] : sameJSON(tm[d], bm[d]) ? mm[d] : Math.max(mm[d] || 0, tm[d] || 0);     // both studied that day: keep the larger count
        if (v !== undefined) o[d] = v;
      }
      out[k] = o;
    } else if (k === 'profile' || k === 'settings') out[k] = mergeObj(b[k], mine[k], theirs[k], theirsNewer);
    else if (k === 'createdAt') out[k] = Math.min(mine[k] || Infinity, theirs[k] || Infinity);
    else if (k === 'v') out[k] = Math.max(mine[k] || 1, theirs[k] || 1);
    else { const v = pick3(b[k], mine[k], theirs[k], theirsNewer); if (v !== undefined) out[k] = v; }
  }
  return out;
}

const Sync = (() => {
  const META_KEY = STORE_KEY + '.sync', BASE_KEY = SANDBOX ? 'sync-base-sandbox' : 'sync-base';
  const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  const available = typeof crypto !== 'undefined' && !!crypto.subtle && typeof fetch === 'function';
  let status = 'off', running = false, again = false, timer = 0, baseMem = null, gen = 0;
  const STALE = 'stale';        // status: off | ok | busy | offline | error

  const meta = () => { try { return JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch (e) { return null; } };
  const setMeta = v => { try { if (v) localStorage.setItem(META_KEY, JSON.stringify(v)); else localStorage.removeItem(META_KEY); } catch (e) { /* best effort */ } };
  const repaint = () => { if (typeof requestRender === 'function' && typeof route !== 'undefined' && route.view === 'settings') requestRender(); };
  const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const showCode = c => cleanCode(c).replace(/(.{5})(?=.)/g, '$1-');
  function newCode() {
    let out = ''; const buf = new Uint8Array(64);
    while (out.length < 20) { crypto.getRandomValues(buf); for (const n of buf) if (n < 240 && out.length < 20) out += ALPHABET[n % 30]; }
    return out;
  }

  /* the last version this device and the server agreed on, kept in IndexedDB (too big to double up in localStorage) */
  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('studyspace-orbit', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => { const db = open.result, tx = db.transaction('kv', mode), rq = fn(tx.objectStore('kv')); tx.oncomplete = () => { db.close(); resolve(rq && rq.result); }; tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); }; };
    });
  }
  async function loadBase() { if (baseMem) return baseMem; try { baseMem = (await idb('readonly', s => s.get(BASE_KEY))) || null; } catch (e) { baseMem = null; } return baseMem; }
  const snap = o => (o ? JSON.parse(JSON.stringify(o)) : o);
  async function saveBase(doc) { baseMem = doc; try { if (doc) await idb('readwrite', s => s.put(doc, BASE_KEY)); else await idb('readwrite', s => s.delete(BASE_KEY)); } catch (e) { /* kept in memory for this visit */ } }

  /* ── encryption ── */
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
  async function keysFor(code) {
    const h = async label => new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(label + cleanCode(code))));
    const id = [...await h('orbit-id:')].map(x => x.toString(16).padStart(2, '0')).join('');
    const key = await crypto.subtle.importKey('raw', await h('orbit-key:'), 'AES-GCM', false, ['encrypt', 'decrypt']);
    return { id, key };
  }
  async function seal(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj))));
    return 'v1.' + b64(iv) + '.' + b64(ct);
  }
  async function open(key, text) {
    const [v, iv, ct] = String(text).split('.');
    if (v !== 'v1' || !iv || !ct) throw new Error('unreadable');
    return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct))));
  }

  /* ── the server: three small functions (replaceable, so tests never touch the network) ── */
  async function rpc(fn, body) {
    const r = await fetch(SYNC_URL + fn, { method: 'POST', headers: { apikey: SYNC_KEY, Authorization: 'Bearer ' + SYNC_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('server ' + r.status);
    const t = await r.text(); return t ? JSON.parse(t) : null;
  }
  let transport = {
    pull: async (id, rev) => ((await rpc('orbit_pull', { p_id: id, p_rev: rev })) || [])[0] || null,          // null: nothing stored under this code
    push: async (id, base, data) => (await rpc('orbit_push', { p_id: id, p_base: base, p_data: data }))[0],
    del: async id => { await rpc('orbit_delete', { p_id: id }); },
  };

  /* ── putting a synced version on screen ── */
  const tidy = doc => syncDoc(normalizeState(doc));
  function apply(doc, at) {
    const { timer: tm, meta: mt } = state;
    state = normalizeState({ ...doc, updatedAt: Math.max(state.updatedAt || 0, at || 0) });
    state.timer = tm; state.meta = mt;
    undoStack.length = 0;                                   // an older snapshot would silently undo the other device's work
    applySettings();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage full: the next save reports it */ }
    _renderHook();
  }

  /* one round: fetch what is new, merge, send what is ours */
  async function round() {
    const m = meta(); if (!m) return;
    const g = gen, live = () => { const cur = meta(); if (g !== gen || !cur || cur.code !== m.code) throw new Error(STALE); };
    const { id, key } = await keysFor(m.code);
    let base = await loadBase(), rev = m.rev || 0;
    const takeTheirs = async (text, r) => {
      live();
      const env = await open(key, text), theirs = tidy(env.doc), mine = syncDoc(state);
      live();
      if (base && sameJSON(mine, base)) { if (!sameJSON(mine, theirs)) apply(theirs, env.at); }           // nothing changed here: take it as it is
      else apply(mergeDocs(base, mine, theirs, (env.at || 0) > (state.updatedAt || 0)), env.at);
      base = snap(theirs); rev = r;
    };
    const remote = await transport.pull(id, rev);
    if (!remote) rev = 0; else if (remote.data) await takeTheirs(remote.data, remote.rev); else rev = remote.rev;
    for (let i = 0; i < 4; i++) {
      const mine = syncDoc(state);
      if (remote && base && sameJSON(mine, base)) break;
      const res = await transport.push(id, rev, await seal(key, { doc: mine, at: state.updatedAt || Date.now() }));
      if (res.ok) { rev = res.rev; base = snap(mine); break; }
      await takeTheirs(res.data, res.rev);                                                                  // someone was faster: merge and try again
    }
    live();
    await saveBase(base);
    live();
    setMeta({ ...meta(), rev, at: Date.now(), err: '' });
  }
  async function run() {
    if (!meta() || !available) return false;
    if (running) { again = true; return false; }
    running = true; status = 'busy'; repaint();
    try { await round(); status = 'ok'; }
    catch (e) {
      const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || (e && e.name === 'TypeError');
      status = offline ? 'offline' : 'error';
      if (e && e.message === STALE) { running = false; again = false; repaint(); return false; }       // sync was turned off or changed meanwhile
      const cur = meta(); if (cur) setMeta({ ...cur, err: offline ? '' : String(e && e.message || e).slice(0, 120) });
    }
    running = false; repaint();
    if (again) { again = false; schedule(); }
    return status === 'ok';
  }
  function schedule(ms = 2000) { if (!meta()) return; clearTimeout(timer); timer = setTimeout(run, ms); }

  async function start() {
    gen++; clearTimeout(timer); await settle();
    setMeta({ code: newCode(), rev: 0, at: 0, err: '' }); await saveBase(null);
    const ok = await run();
    return ok;
  }
  /* joining with a code from another device: 'replace' takes that workspace, 'merge' keeps what is here too */
  async function join(code, mode = 'replace') {
    gen++; clearTimeout(timer); await settle();
    code = cleanCode(code);
    if (code.length !== 20) throw new Error(t('A sync code has 20 letters and digits.'));
    const { id, key } = await keysFor(code);
    const remote = await transport.pull(id, 0);
    if (!remote || !remote.data) throw new Error(t('Nothing is stored under this code. Check it on the other device.'));
    const env = await open(key, remote.data), theirs = tidy(env.doc);
    if (mode === 'replace') { await saveBase(snap(theirs)); apply(theirs, env.at); setMeta({ code, rev: remote.rev, at: Date.now(), err: '' }); status = 'ok'; repaint(); return true; }
    await saveBase(null); setMeta({ code, rev: 0, at: 0, err: '' });
    return run();
  }
  /* wait for a round in flight to notice it is stale and finish */
  async function settle() { for (let i = 0; i < 100 && running; i++) await new Promise(r => setTimeout(r, 30)); }
  async function stop(wipe) {
    const m = meta(); clearTimeout(timer); gen++; again = false;
    if (wipe && m) { const { id } = await keysFor(m.code); await transport.del(id); }
    setMeta(null); await settle(); await saveBase(null); status = 'off'; repaint();
  }
  function init() {
    if (!meta() || !available) return;
    status = 'busy'; run();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(300); });
    addEventListener('online', () => schedule(300));
    setInterval(() => { if (!document.hidden && meta()) run(); }, 45000);
  }

  return {
    available, init, run, schedule, start, join, stop, showCode, cleanCode, keysFor, seal, open,
    get status() { return meta() ? status : 'off'; }, get on() { return !!meta(); },
    get code() { return (meta() || {}).code || ''; }, get syncedAt() { return (meta() || {}).at || 0; }, get error() { return (meta() || {}).err || ''; },
    get transport() { return transport; }, set transport(v) { transport = v; },
  };
})();

/* ── interface: a row in Settings → Your data, and a way in from the welcome screen ── */
function syncRow() {
  if (!Sync.available) return '';
  if (!Sync.on) return html`<div class="set-row fb-row"><div class="grow"><div class="h3">${t('Sync between your devices')}</div><div class="small muted">${t('Keeps this workspace the same on your phone and your computer. It is encrypted on your device before it leaves, and only devices that know your sync code can read it.')} <button class="linkbtn" data-act="sync-join">${t('I have a code from another device')}</button></div></div>
    <div class="set-ctl"><button class="btn primary" data-act="sync-start">${icon('swap', 15)}${t('Turn on sync')}</button></div></div>`;
  const st = Sync.status, at = Sync.syncedAt;
  const head = st === 'error' ? html`<span class="fb-dot bad"></span>${t('Sync is not getting through')}` : st === 'offline' ? html`<span class="fb-dot warn"></span>${t('Offline — changes will sync later')}` : html`<span class="fb-dot ok"></span>${st === 'busy' ? t('Syncing…') : t('Sync is on')}`;
  const sub = st === 'error' ? t('Your changes are safe on this device and will be sent when it works again. ({m})', { m: Sync.error || t('no answer') }) : at ? t('Last synced {d}. To add a device, open the app there and enter this code:', { d: fmtStamp(at) }) : t('To add a device, open the app there and enter this code:');
  return html`<div class="set-row fb-row sync-row"><div class="grow"><div class="h3 fb-head">${head}</div><div class="small muted">${sub}</div>
      <div class="sync-code"><code class="num" id="sync-code">${ui.settings.showCode ? Sync.showCode(Sync.code) : '•••••-•••••-•••••-•••••'}</code><button class="btn sm ghost" data-act="sync-show">${ui.settings.showCode ? t('Hide') : t('Show')}</button><button class="btn sm ghost" data-act="sync-copy">${t('Copy')}</button></div>
      <div class="tiny faint">${t('Anyone with this code can read and change your workspace — treat it like a password.')}</div></div>
    <div class="set-ctl row wrap"><button class="btn" data-act="sync-now">${t('Sync now')}</button><button class="btn" data-act="sync-stop">${t('Turn off')}</button></div></div>`;
}
const syncFail = e => toast(t('Sync: {m}', { m: String(e && e.message || e).slice(0, 110) }), { kind: 'danger' });
ACT['sync-start'] = () => Sync.start().then(ok => { ui.settings.showCode = ok; requestRender(); toast(ok ? t('Sync is on. Enter the code on your other device.') : t('Could not reach the sync service — it will keep trying.'), ok ? {} : { kind: 'danger' }); }).catch(syncFail);
ACT['sync-now'] = () => Sync.run().then(ok => toast(ok ? t('Everything is synced') : t('Could not sync right now')));
ACT['sync-show'] = () => setUI(u => { u.settings.showCode = !u.settings.showCode; });
ACT['sync-copy'] = () => { const c = Sync.showCode(Sync.code); (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(() => toast(t('Sync code copied'))).catch(() => { ui.settings.showCode = true; requestRender(); toast(t('Select the code and copy it')); }); };
ACT['sync-stop'] = () => openModal({
  title: t('Turn off sync?'), cls: 'narrow',
  body: html`<p class="muted">${t('This device keeps its data and stops syncing. Other devices carry on.')}</p>
    <label class="row small" style="cursor:pointer;gap:10px"><span class="switch"><input type="checkbox" name="wipe"><i></i></span>${t('Also delete the online copy (stops sync for every device)')}</label>`,
  foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Turn off')}</button>`,
  onSubmit: d => { Sync.stop(!!d.wipe).then(() => { ui.settings.showCode = false; requestRender(); toast(t('Sync is off on this device')); }).catch(syncFail); },
});
ACT['sync-join'] = () => openSyncJoin();
function openSyncJoin() {
  const hasData = state.profile.onboarded && (state.tasks.length + state.grades.length + state.lessons.length + state.subjects.length) > 0;
  openModal({
    title: t('Sync with another device'), cls: 'narrow',
    body: html`<p class="small muted" style="margin-top:-4px">${t('On the device that already has your workspace: Settings → Your data → Sync → Show. Type that code here.')}</p>
      <label class="field"><span>${t('Sync code')}</span><input class="input num" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" autofocus></label>
      ${hasData ? html`<label class="field"><span>${t('This device already has data')}</span><select class="select" name="mode"><option value="merge">${t('Merge it with the synced workspace')}</option><option value="replace">${t('Replace it with the synced workspace')}</option></select></label>` : ''}
      <div class="small danger-t" id="sync-join-err"></div>`,
    foot: html`<button type="button" class="btn ghost" data-close>${t('Cancel')}</button><button class="btn primary">${t('Connect')}</button>`,
    onSubmit: (d, form) => {
      const err = form.querySelector('#sync-join-err'), btn = form.querySelector('.btn.primary');
      err.textContent = ''; btn.disabled = true;
      Sync.join(d.code, d.mode || 'replace').then(ok => {
        if (!ok) throw new Error(t('Could not reach the sync service. Try again.'));
        closeAllModals(); if (location.hash.indexOf('#/settings') !== 0) go('today'); requestRender(); toast(t('Connected — this device now syncs'));
      }).catch(e => { btn.disabled = false; err.textContent = e && e.name === 'OperationError' ? t('That code does not open this workspace.') : String(e && e.message || e); });
      return false;
    },
  });
}

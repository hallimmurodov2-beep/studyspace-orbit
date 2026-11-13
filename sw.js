/* Studyspace Orbit — offline shell.
   Network-first: when you are online you always get the newest files (so an update can never
   leave a half-old, half-new app); when you are offline — or the network is very slow — the
   last saved copy opens instead. Your data never passes through here; it lives in localStorage. */
const CACHE = 'studyspace-orbit-v11';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css', 'css/views.css',
  'js/util.js', 'js/i18n.js', 'js/icons.js', 'js/store.js', 'js/ui.js', 'js/filebackup.js', 'js/sync.js', 'js/nlp.js', 'js/srs.js', 'js/sound.js', 'js/timer.js',
  'js/views/today.js', 'js/views/tasks.js', 'js/views/calendar.js', 'js/views/diary.js', 'js/views/focus.js', 'js/views/cards.js', 'js/views/exams.js',
  'js/views/grades.js', 'js/views/subjects.js', 'js/views/notes.js', 'js/views/insights.js', 'js/views/settings.js',
  'js/demo.js', 'js/importer.js', 'js/onboarding.js', 'js/app.js',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable.png',
];
const SLOW_MS = 3500;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('studyspace-orbit-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = url.origin + url.pathname;                       // ignore ?query so index.html?demo hits the same entry
    const fresh = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
      if (res && res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    });
    const saved = async () => (await cache.match(key)) || (req.mode === 'navigate' ? cache.match(new URL('index.html', self.registration.scope).href) : undefined);
    try {
      const res = await Promise.race([fresh, new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), SLOW_MS))]);
      if (res && (res.ok || res.status === 304)) return res;
      return (await saved()) || res;
    } catch (err) {
      event.waitUntil(fresh.catch(() => {}));
      const hit = await saved();
      if (hit) return hit;
      try { return await fresh; } catch (e) { return Response.error(); }
    }
  })());
});

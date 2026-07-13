const CACHE_NAME = 'driver-workflow-v2';
const JOBS_CACHE = 'thunderbox-jobs-v1';
const STATIC_ASSETS = ['/', '/dashboard', '/login'];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== JOBS_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('thunderbox-offline', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('status-queue', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function idbAdd(db, store, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e.target.error);
  });
}

function idbGetAll(db, store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e.target.error);
  });
}

function idbDelete(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e.target.error);
  });
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache-then-network for job list GET (offline-friendly)
  if (request.method === 'GET' && url.pathname === '/api/jobs') {
    event.respondWith(handleJobsGet(request));
    return;
  }

  // Queue status updates when offline
  if (request.method === 'POST' && /^\/api\/jobs\/[^/]+\/status$/.test(url.pathname)) {
    event.respondWith(handleStatusPost(request));
    return;
  }

  // Skip all other API calls — always network
  if (url.pathname.startsWith('/api/')) return;

  // Pages: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

async function handleJobsGet(request) {
  const cache = await caches.open(JOBS_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      // Add a header so the app knows this is stale cached data
      const body = await cached.json();
      return new Response(JSON.stringify({ ...body, offline: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: true, data: [], offline: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleStatusPost(request) {
  try {
    return await fetch(request.clone());
  } catch {
    // Network unavailable — queue for later
    try {
      const body = await request.clone().json();
      const db = await openDB();
      await idbAdd(db, 'status-queue', {
        url: request.url,
        body,
        timestamp: Date.now(),
      });
      self.registration.sync.register('sync-job-updates').catch(() => {});
    } catch {}

    // Respond with optimistic success so the UI updates immediately
    return new Response(JSON.stringify({ success: true, queued: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Background sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-job-updates') {
    event.waitUntil(syncPendingUpdates());
  }
});

async function syncPendingUpdates() {
  let db;
  try { db = await openDB(); } catch { return; }
  const queue = await idbGetAll(db, 'status-queue');
  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body),
      });
      if (res.ok) await idbDelete(db, 'status-queue', item.id);
    } catch {
      // Still offline; leave in queue for next sync
    }
  }
}

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'Thunderbox', body: 'You have an update' };
  try { data = event.data ? JSON.parse(event.data.text()) : data; } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow('/dashboard');
    })
  );
});

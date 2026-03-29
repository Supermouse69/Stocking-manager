self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('stock-v1').then(cache => {
      return cache.addAll([
        './',
        './index.html',
        './styles.css',
        './app.js',
        './data.json'
      ]);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
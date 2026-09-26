/* もんだいメーカー：オフラインでも開けるようにする
   ・新しい版を出すときは、CACHE の名前を変えてください（古いものは自動で消えます）。 */
var CACHE = 'mondai-v7';
var FILES = [
  './', './index.html', './manifest.json',
  './css/app.css',
  './js/core.js', './js/data.js', './js/ai.js', './js/model.js', './js/sync.js', './js/ui.js',
  './js/files.js', './js/gen.js', './js/make.js', './js/make-view.js',
  './js/drill.js', './js/note.js', './js/lib.js', './js/home.js', './js/set.js', './js/main.js',
  './icon-180.png', './icon-192.png', './icon-512.png'
];
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(FILES); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    /* 消すのは、このアプリの古い版だけ（同じ場所の、くらしの手帳・ぜんぶ入りのしまったものは消さない） */
    return Promise.all(ks.map(function(k){ return (k.indexOf('mondai-') === 0 && k !== CACHE) ? caches.delete(k) : null; }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  var url = new URL(e.request.url);
  if(e.request.method !== 'GET' || url.origin !== location.origin) return;   /* AIへの通信などは、そのまま通す */
  e.respondWith(
    fetch(e.request).then(function(res){
      if(res && res.ok){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
      }
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(hit){
        return hit || caches.match('./index.html');
      });
    })
  );
});

/* くらしの手帳：オフライン用 */
var CACHE = 'kurashi-v4';
var FILES = [
  './', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png',
  './css/app.css',
  './js/data.js', './js/core.js', './js/sync.js', './js/ai.js', './js/common.js', './js/decor.js',
  './js/commute.js', './js/today.js', './js/money.js', './js/risyu.js', './js/calendar.js',
  './js/settings.js', './js/google.js', './js/timetable.js', './js/todo.js', './js/chat.js',
  './js/review.js', './js/whatsnew.js', './js/main.js',
  './gas/Code.gs'
];
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(FILES); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){ return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if(url.origin !== location.origin) return;           /* 天気やFirebase・Googleはそのまま */
  if(url.pathname.indexOf('/tests/') >= 0) return;     /* テストのページはしまわない */
  /* 本体は必ずネットから取り直す（古い版が残らないように）。つながらないときだけしまったものを使う */
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).then(function(res){
      if(res && res.ok){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, copy); }); }
      return res;
    }).catch(function(){
      return caches.match(e.request, { ignoreSearch:true }).then(function(r){ return r || caches.match('./index.html'); });
    })
  );
});

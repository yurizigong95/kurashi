/* くらしの手帳：オフライン用 */
var CACHE = 'kurashi-v6';
var FILES = [
  './', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png',
  './css/app.css', './css/styles.css', './js/chara.js',
  './js/data.js', './js/core.js', './js/sync.js', './js/ai.js', './js/common.js', './js/decor.js',
  './js/commute.js', './js/today.js', './js/money.js', './js/risyu.js', './js/calendar.js',
  './js/settings.js', './js/google.js', './js/timetable.js', './js/todo.js', './js/chat.js',
  './js/review.js', './js/whatsnew.js', './js/main.js',
  './gas/Code.gs'
];
self.addEventListener('install', function(e){
  /* 1つ読めないファイルがあっても、ほかはしまって先に進む（全部失敗扱いにしない） */
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(FILES.map(function(f){
      return fetch(f, { cache:'no-store' }).then(function(res){ if(res.ok) return c.put(f, res); })['catch'](function(){});
    }));
  }).then(function(){ return self.skipWaiting(); }));
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
  var isPage = (e.request.mode === 'navigate');
  var fromCache = function(){
    return caches.match(e.request, { ignoreSearch:true }).then(function(r){
      /* ページのときだけ、しまってある index.html で代わりにする（css や js の代わりに HTML を返さない） */
      return r || (isPage ? caches.match('./index.html') : undefined) || Response.error();
    });
  };
  e.respondWith(
    /* ページの読みこみには、よけいな指定をつけない（Safariで失敗しないように） */
    fetch(e.request, isPage ? undefined : { cache: 'no-store' }).then(function(res){
      if(res && res.ok){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, copy); }); return res; }
      /* 見つからないときは、しまってあるものがあればそれを使う */
      return caches.match(e.request, { ignoreSearch:true }).then(function(r){ return r || res; });
    })['catch'](fromCache)
  );
});

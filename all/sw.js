/* ぜんぶ入り：この入れ物（切りかえバー）だけをしまう。
   中の3つのアプリは、それぞれのアプリ自身がしまう（くらしの手帳・もんだいメーカー）。 */
var CACHE = 'zenbu-v2';
var FILES = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(FILES.map(function(f){
      return fetch(f, { cache:'no-store' }).then(function(res){ if(res.ok) return c.put(f, res); })['catch'](function(){});
    }));
  }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k.indexOf('zenbu-') === 0 && k !== CACHE; })
      .map(function(k){ return caches['delete'](k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if(url.origin !== location.origin) return;
  /* この入れ物のファイル以外（中のアプリ）は、そのまま通す */
  if(url.pathname.indexOf(new URL('./', self.registration.scope).pathname) !== 0) return;
  var isPage = (e.request.mode === 'navigate');
  e.respondWith(
    fetch(e.request, isPage ? undefined : { cache:'no-store' }).then(function(res){
      if(res && res.ok){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, copy); }); }
      return res;
    })['catch'](function(){
      return caches.match(e.request, { ignoreSearch:true }).then(function(r){
        return r || (isPage ? caches.match('./index.html') : undefined) || Response.error();
      });
    })
  );
});

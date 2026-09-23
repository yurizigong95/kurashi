/* くらしの手帳：オフライン用・通知の受け取り・前の版にもどす */
var CACHE = 'kurashi-v16';
var PREV = 'kurashi-prev';      /* ひとつ前の版のファイル（「前の版にもどす」で使う） */
var FLAGS = 'kurashi-flags';    /* 前の版を使っているかの印 */
var FILES = [
  './', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png', './files.json',
  './css/app.css', './css/styles.css',
  './css/m-kokushi.css', './css/m-research.css', './css/m-anki2.css', './css/m-quiz.css', './css/m-campus.css', './css/m-life.css', './css/m-petplus.css', './css/m-chara2.css', './css/m-links2.css', './css/m-core2.css',
  './js/data.js', './js/core.js', './js/hooks.js', './js/aidata.js', './js/sync.js', './js/ai.js', './js/common.js', './js/decor.js',
  './js/chara-data.js', './js/chara-art.js', './js/chara.js', './js/chara-make.js', './js/chara-talk.js', './js/pet.js',
  './js/commute.js', './js/today.js', './js/money.js', './js/kakeibo.js', './js/risyu.js', './js/calendar.js',
  './js/settings.js', './js/google.js', './js/links.js', './js/notify.js', './js/wx-plus.js', './js/timetable.js',
  './js/todo.js', './js/chat.js', './js/ai-plus.js', './js/anki.js', './js/gasplus.js',
  './js/m-kokushi.js', './js/m-research.js', './js/m-anki2.js', './js/m-quiz.js', './js/m-quiz2.js', './js/m-campus.js', './js/m-life.js', './js/m-petplus.js', './js/m-chara2.js', './js/m-links2.js', './js/m-core2.js', './js/review.js', './js/whatsnew.js', './js/ops.js', './js/main.js',
  './gas/Code.gs', './gas/appsscript.json'
];
var usePrev = null;
function readFlag(){
  if(usePrev !== null) return Promise.resolve(usePrev);
  return caches.open(FLAGS).then(function(c){ return c.match('./__use_prev'); }).then(function(r){ usePrev = !!r; return usePrev; })['catch'](function(){ usePrev = false; return false; });
}
/* いま使っている版を「ひとつ前の版」として取っておく */
function keepPrevious(){
  return caches.keys().then(function(keys){
    var olds = keys.filter(function(k){ return /^kurashi-v\d+$/.test(k) && k !== CACHE; })
      .sort(function(a, b){ return Number(a.slice(9)) - Number(b.slice(9)); });
    if(!olds.length) return;
    var from = olds[olds.length - 1];
    return caches.open(from).then(function(src){
      return src.keys().then(function(reqs){
        if(!reqs.length) return;
        return caches['delete'](PREV).then(function(){ return caches.open(PREV); }).then(function(dst){
          return Promise.all(reqs.map(function(q){ return src.match(q).then(function(r){ return r ? dst.put(q, r) : null; }); }))
            .then(function(){ return dst.put('./__prev_version', new Response(from)); });
        });
      });
    });
  })['catch'](function(){});
}
self.addEventListener('install', function(e){
  /* 1つ読めないファイルがあっても、ほかはしまって先に進む（全部失敗扱いにしない） */
  e.waitUntil(keepPrevious().then(function(){ return caches.open(CACHE); }).then(function(c){
    return Promise.all(FILES.map(function(f){
      return fetch(f, { cache:'no-store' }).then(function(res){ if(res.ok) return c.put(f, res); })['catch'](function(){});
    }));
  }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE && k !== PREV && k !== FLAGS; }).map(function(k){ return caches['delete'](k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('message', function(e){
  var d = e.data || {};
  if(d.type === 'rollback'){
    usePrev = !!d.on;
    var p = caches.open(FLAGS).then(function(c){
      return d.on ? c.put('./__use_prev', new Response('1')) : c['delete']('./__use_prev');
    }).then(function(){ if(e.ports && e.ports[0]) e.ports[0].postMessage({ ok:true }); });
    if(e.waitUntil) e.waitUntil(p);
  }
});
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if(url.origin !== location.origin) return;           /* 天気やFirebase・Googleはそのまま */
  if(url.pathname.indexOf('/tests/') >= 0) return;     /* テストのページはしまわない */
  var isPage = (e.request.mode === 'navigate');
  var fromCache = function(){
    return caches.match(e.request, { ignoreSearch:true }).then(function(r){
      /* ページのときだけ、しまってある index.html で代わりにする（css や js の代わりに HTML を返さない） */
      return r || (isPage ? caches.match('./index.html') : undefined) || Response.error();
    });
  };
  var network = function(){
    /* 本体は必ずネットから取り直す（古い版が残らないように）。つながらないときだけしまったものを使う */
    return fetch(e.request, isPage ? undefined : { cache:'no-store' }).then(function(res){
      if(res && res.ok){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, copy); }); return res; }
      return caches.match(e.request, { ignoreSearch:true }).then(function(r){ return r || res; });
    })['catch'](fromCache);
  };
  /* ?latest をつけて開いたら、前の版をやめて最新にもどす */
  if(isPage && url.searchParams.has('latest')){
    usePrev = false;
    e.respondWith(caches.open(FLAGS).then(function(c){ return c['delete']('./__use_prev'); }).then(network, network));
    return;
  }
  e.respondWith(readFlag().then(function(prev){
    if(!prev) return network();
    /* 前の版を使っているあいだは、しまってある前の版を先に出す */
    return caches.open(PREV).then(function(c){
      return c.match(isPage ? './index.html' : e.request, { ignoreSearch:true }).then(function(r){ return r || network(); });
    });
  }));
});

/* ===== 通知 ===== */
self.addEventListener('push', function(e){
  var d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(err){ d = { data:{ body: e.data ? e.data.text() : '' } }; }
  var data = d.data || {}, n = d.notification || {};
  var title = data.title || n.title || 'くらしの手帳';
  var opt = {
    body: data.body || n.body || '',
    tag: data.tag || undefined,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: data.url || './' }
  };
  e.waitUntil(self.registration.showNotification(title, opt));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(list){
    for(var i = 0; i < list.length; i++){
      if(list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) return list[i].focus();
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : null;
  }));
});

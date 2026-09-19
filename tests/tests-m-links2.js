/* くらしの手帳：iPhone・連携・雨雲レーダー のテスト（KT.test で足す） */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;

/* にせの答えは、このテストの間だけ先頭に入れる（ほかの担当のにせものと取りあわないように） */
function front(list, fn){ list.unshift(fn); return function(){ var i = list.indexOf(fn); if(i >= 0) list.splice(i, 1); }; }
function gasOn(w, ver){ w.GAS.url = 'https://script.google.com/macros/s/test/exec'; w.GAS.token = 'tok'; w.GAS.ver = Math.min(ver, 3); w.GAS.api = ver >= 4 ? 4 : 0; w.GAS.pingAt = Date.now(); w.saveGas(); KT.gasState.ver = Math.min(ver, 3); }
function gasOff(w){ w.GAS.url = ''; w.GAS.token = ''; w.GAS.ver = 0; w.GAS.api = 0; w.saveGas(); KT.gasState.ver = 2; }
function pad(n){ return (n < 10 ? '0' : '') + n; }
function utcStamp(ms){ var d = new Date(ms); return '' + d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00'; }

/* 気象庁の時刻の一覧（にせもの）：N1 は5分おき（ばらばらの順）、N2 は予報（basetime が N1 の最新より1つ古い） */
var T0 = Date.UTC(2026, 8, 19, 8, 20);          /* 実況のいちばん新しい時刻＝ 08:20 UTC（日本時間 17:20） */
function fakeN1(){
  var a = [];
  for(var i = 0; i < 15; i++){ var s = utcStamp(T0 - i * 300000); a.push({ basetime:s, validtime:s, elements:['hrpns', 'hrpns_nd'] }); }
  return [a[3], a[0], a[14], a[1], a[2]].concat(a.slice(4, 14));
}
function fakeN2(){
  var b = utcStamp(T0 - 300000), a = [];          /* basetime 08:15 */
  for(var i = 1; i <= 12; i++) a.push({ basetime:b, validtime:utcStamp(T0 - 300000 + i * 300000), elements:['hrpns', 'hrpns_nd'] });
  return a.reverse();                              /* 08:20〜09:15（08:20 は実況とかさなる） */
}
function radarApi(url){
  if(/targetTimes_N1\.json/.test(url)) return fakeN1();
  if(/targetTimes_N2\.json/.test(url)) return fakeN2();
  if(/api\.rainviewer\.com\/public\/weather-maps\.json/.test(url)){
    var t = Math.floor(T0 / 1000);
    return { version:'2.0', generated:t, host:'https://tilecache.rainviewer.com',
      radar:{ past:[{ time:t - 1200, path:'/v2/radar/aaa' }, { time:t, path:'/v2/radar/ccc' }, { time:t - 600, path:'/v2/radar/bbb' }], nowcast:[] }, satellite:{ infrared:[] } };
  }
  return null;
}

KT.test('雨雲：時刻の並び（にせの targetTimes。予報の basetime が古い・並びがばらばら・端末の時計によらず日本時間）', async function(){
  var A = KT.frames().A;
  var fr = A.radarFramesJma(J(A, fakeN1()), J(A, fakeN2()));
  eq(fr.length, 13 + 11, '実況13こま（1時間）＋予報11こま');
  for(var i = 1; i < fr.length; i++) ok(fr[i].t > fr[i - 1].t, '古い順に並ぶ（' + i + '）');
  var past = fr.filter(function(f){ return !f.f; }), fut = fr.filter(function(f){ return f.f; });
  eq(past[past.length - 1].v, utcStamp(T0), '実況のいちばん新しい時刻');
  eq(past[0].v, utcStamp(T0 - 12 * 300000), '実況は1時間前から');
  eq(fut[0].v, utcStamp(T0 + 300000), '予報は実況より先の時刻から（かさなる 08:20 は出さない）');
  eq(fut[0].b, utcStamp(T0 - 300000), '予報のURLは、予報の basetime（1つ古い）を使う');
  ok(past.every(function(f){ return f.b === f.v; }), '実況は basetime＝validtime');
  eq(A.radarJst(T0), '17:20', '日本時間で出す');
  eq(A.radarTimeLabel(utcStamp(Date.UTC(2026, 8, 19, 15, 5))), '00:05', '日づけをまたいでも日本時間');
  var url = A.RADAR_SRC.jma.url(fut[0], 8, 224, 101);
  eq(url, 'https://www.jma.go.jp/bosai/jmatile/data/nowc/' + fut[0].b + '/none/' + fut[0].v + '/surf/hrpns/8/224/101.png', '予報の雨のタイルのURL');
  /* 変な形は使わない・予報がなくても実況は出す */
  eq(A.radarFramesJma(J(A, [{ basetime:'x', validtime:'y' }]), J(A, [])).length, 0, '形のちがう時刻は使わない');
  eq(A.radarFramesJma(J(A, fakeN1()), null).length, 13, '予報がなくても実況');
  /* RainViewer */
  var rv = A.radarFramesRv(J(A, radarApi('https://api.rainviewer.com/public/weather-maps.json')));
  eq(rv.map(function(f){ return f.p.slice(-3); }).join(','), 'aaa,bbb,ccc', 'RainViewer も古い順');
  eq(A.RADAR_SRC.rv.url(rv[2], 7, 112, 50), 'https://tilecache.rainviewer.com/v2/radar/ccc/256/7/112/50/2/1_1.png', 'RainViewer のタイルのURL');
});

KT.test('雨雲：地点の点の中心・地図と雨のタイルの位置（画面で測る）・本物の気象庁は読まない', async function(){
  var A = KT.frames().A, doc = A.document;
  var off = front(KT.api, radarApi);
  var closed = A.S.ui.todayClosed.weather;
  try{
    A.S.ui.todayClosed.weather = 0;
    A.radar.frames = null; A.radar.at = 0; A.radar.tryAt = 0; A.radar.z = 9;
    await A.radarLoad(true);
    eq(A.radar.src, 'jma', '気象庁');
    eq(A.radar.frames.length, 24, 'こまの数');
    eq(A.radar.idx, 12, 'はじめは「現在」（実況のいちばん新しいこま）');
    eq(A.radarText(A.radar.idx), '17:20 現在', '現在の時刻');
    A.appId = 'today'; A.todayTab = 'today'; A.radar.open = true; A.render();
    var box = doc.querySelector('.radar');
    ok(box, 'レーダーが出る');
    var geoCheck = function(z){
      A.radar.z = z; A.render();
      box = doc.querySelector('.radar');
      var br = box.getBoundingClientRect();
      ok(Math.abs(br.width / br.height - 1.2) < 0.01, 'ズーム' + z + '：枠は 6:5（' + (br.width / br.height).toFixed(3) + '）');
      var base = box.querySelector('img.rb'), r = base.getBoundingClientRect();
      ok(Math.abs(r.width - r.height) < 0.6, 'ズーム' + z + '：地図のタイルは正方形');
      var tx = Number(base.getAttribute('data-x')), ty = Number(base.getAttribute('data-y'));
      Array.prototype.forEach.call(box.querySelectorAll('.rmark'), function(m){
        var d = m.querySelector('i').getBoundingClientRect();
        var X = tx + (d.left + d.width / 2 - r.left) / r.width, Y = ty + (d.top + d.height / 2 - r.top) / r.height;
        var dx = (X - A.lonToX(Number(m.getAttribute('data-lng')), z)) * 256, dy = (Y - A.latToY(Number(m.getAttribute('data-lat')), z)) * 256;
        ok(Math.abs(dx) < 0.7 && Math.abs(dy) < 0.7, 'ズーム' + z + '：点の中心が本当の場所にある（ずれ ' + dx.toFixed(2) + ', ' + dy.toFixed(2) + ' 点）');
      });
      /* 雨のタイル：気象庁は偶数のズームだけ中身がある → 奇数は1つ下を2倍で */
      var dz = z - z % 2, rain = box.querySelectorAll('img.rn');
      ok(rain.length > 0, 'ズーム' + z + '：雨のタイル');
      Array.prototype.forEach.call(rain, function(img){
        eq(Number(img.getAttribute('data-z')), dz, 'ズーム' + z + '：雨はズーム' + dz);
        var rr = img.getBoundingClientRect(), k = Math.pow(2, z - dz);
        ok(Math.abs(rr.width - r.width * k) < 1, 'ズーム' + z + '：雨のタイルの大きさ');
        /* 雨のタイルの左上は、同じ場所の地図のタイルの左上とそろう */
        var bx = Number(img.getAttribute('data-x')) * k - tx, by = Number(img.getAttribute('data-y')) * k - ty;
        ok(Math.abs(rr.left - (r.left + bx * r.width)) < 0.8 && Math.abs(rr.top - (r.top + by * r.height)) < 0.8, 'ズーム' + z + '：雨と地図の位置がそろう');
        ok(!img.getAttribute('src'), 'テストでは本物の気象庁を読まない');
        ok(/^https:\/\/www\.jma\.go\.jp\/bosai\/jmatile\/data\/nowc\/\d{14}\/none\/\d{14}\/surf\/hrpns\/\d+\/\d+\/\d+\.png$/.test(img.getAttribute('data-u')), 'URLの形');
      });
      ok(!base.getAttribute('src'), 'テストでは本物の地図を読まない');
    };
    [9, 10, 7, 8].forEach(geoCheck);
    /* 計算だけでも確かめる：印とタイルの位置 */
    var g = A.radarGeom(J(A, [{ lat:34.889, lng:135.225, name:'a' }, { lat:34.7376, lng:135.3416, name:'b' }]), 9, 'jma');
    eq(g.dz, 8, '計算：ズーム9の雨はズーム8');
    var m0 = g.marks[0], cx = A.lonToX(135.225, 9), cy = A.latToY(34.889, 9);
    ok(Math.abs(m0.left - ((cx - g.cx) * 256 + 180)) < 1e-9 && Math.abs(m0.top - ((cy - g.cy) * 256 + 150)) < 1e-9, '計算：印の位置');
    ok(g.base.every(function(t){ return t.size === 256; }) && g.rain.every(function(t){ return t.size === 512; }), '計算：タイルの大きさ');
    ok(g.rain.some(function(t){ return t.left <= 0 && t.left + t.size >= 360; }) || g.rain.length >= 2, '計算：雨が枠をおおう');
    /* こまを動かす：URLの時刻が変わり、予報は予報の basetime */
    A.radar.z = 9; A.render();
    A.radarShow(13);
    var u = doc.querySelector('.radar img.rn').getAttribute('data-u');
    ok(u.indexOf('/nowc/' + utcStamp(T0 - 300000) + '/none/' + utcStamp(T0 + 300000) + '/') > 0, '予報のこまのURL');
    eq(doc.querySelector('.radar .rtime').textContent, '17:25 予報', '予報の時刻');
    doc.querySelector('[data-act="radar-now"]').click();
    eq(A.radar.idx, 12, '「いま」で現在にもどる');
    ok(doc.querySelector('.l2-rnow'), '「いま」の目盛り');
    ok(doc.querySelector('.l2-rlinks a[href^="https://tenki.jp/"]') && doc.querySelector('.l2-rlinks a[href*="weather.yahoo.co.jp"]') && doc.querySelector('.l2-rlinks a[href*="weathernews.jp"]'), 'ほかのサイトで見るリンク');
    /* 通学の時刻（.rtime）が、レーダーの時刻の形（位置が固定）にならない */
    var probe = doc.createElement('span'); probe.className = 'rtime'; doc.body.appendChild(probe);
    ok(A.getComputedStyle(probe).position !== 'absolute', '通学の .rtime はレーダーの見た目にならない');
    probe.remove();
    /* AIが読める */
    var ai = A.aiSectionData('more');
    ok(ai.rain_radar && ai.rain_radar.frames.length === 24 && ai.rain_radar.rain_zoom === 8 && ai.rain_radar.now === '17:20', 'AIがレーダーの状態を読める');
  }finally{
    off();
    A.radar.open = false; A.radarStop(); A.S.ui.todayClosed.weather = closed;
    A.render();
  }
});

KT.test('雨雲：RainViewer に切りかえ（タイルはズーム7まで・相手の端末にも）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  var off = front(KT.api, radarApi);
  var closed = A.S.ui.todayClosed.weather;
  try{
    A.S.ui.todayClosed.weather = 0;
    A.radar.z = 9; A.radar.open = true; A.appId = 'today'; A.todayTab = 'today';
    await A.radarLoad(true); A.render();
    doc.querySelector('[data-act="l2-radar-src"][data-v="rv"]').click();
    await KT.until(function(){ return A.radar.src === 'rv' && !A.radar.busy; }, 4000, 'RainViewer を読む');
    A.render();
    var rain = doc.querySelectorAll('.radar img.rn');
    ok(rain.length > 0, '雨のタイル');
    Array.prototype.forEach.call(rain, function(img){
      eq(img.getAttribute('data-z'), '7', 'RainViewer はズーム7で読む');
      ok(img.getAttribute('data-u').indexOf('https://tilecache.rainviewer.com/v2/radar/ccc/256/7/') === 0, 'いちばん新しいこま');
    });
    eq(doc.querySelector('.radar').getAttribute('data-src'), 'rv', '出どころ');
    ok(/RainViewer/.test(doc.querySelector('.radarbox').textContent), '出典');
    eq(A.radar.frames.filter(function(f){ return f.f; }).length, 0, 'RainViewer に予報はない');
    ok(!doc.querySelector('.l2-rnow') && /（いま）/.test(doc.querySelector('.l2-rt').textContent), '予報がないときは、右はしが「いま」（目盛りを重ねない）');
    /* 画面が前の出どころのまま（入力中で描き直せなかった）でこまを動かす → 気象庁のURLを RainViewer のこまで作らない */
    doc.querySelector('.radar').setAttribute('data-src', 'jma');
    A.radarShow(0);
    eq(doc.querySelector('.radar').getAttribute('data-src'), 'rv', 'こまを動かすと、描き直してそろえる');
    ok(doc.querySelector('.radar img.rn').getAttribute('data-u').indexOf('https://tilecache.rainviewer.com/v2/radar/aaa/') === 0, 'RainViewer のいちばん古いこま');
    await KT.settle([A, B]);
    await KT.until(function(){ return B.l2Prefs().radarSrc === 'rv'; }, 10000, '相手の端末にも');
    doc.querySelector('[data-act="l2-radar-src"][data-v="jma"]').click();
    await KT.until(function(){ return A.radar.src === 'jma' && !A.radar.busy; }, 4000, '気象庁にもどす');
  }finally{
    off();
    A.radar.open = false; A.radarStop(); A.S.ui.todayClosed.weather = closed; A.render();
    await KT.settle([A, B]);
  }
});

/* ============ 橋わたし（Apps Script）そのもの ============ */
async function loadGas(opt){
  var src = await fetch('../gas/Code.gs', { cache:'no-store' }).then(function(r){ return r.text(); });
  var props = {}, fetched = [], triggers = [{ getHandlerFunction:function(){ return 'tick'; } }];
  var P = {
    getProperties:function(){ return Object.assign({}, props); }, getProperty:function(k){ return props[k] == null ? null : props[k]; },
    setProperty:function(k, v){ props[k] = String(v); }, setProperties:function(o){ Object.keys(o).forEach(function(k){ props[k] = String(o[k]); }); },
    deleteProperty:function(k){ delete props[k]; }
  };
  var FIXED = opt.now;
  var FD = function(){
    var a = Array.prototype.slice.call(arguments);
    return a.length ? new (Function.prototype.bind.apply(Date, [null].concat(a)))() : new Date(FIXED);
  };
  FD.now = function(){ return FIXED; }; FD.UTC = Date.UTC; FD.parse = Date.parse; FD.prototype = Date.prototype;
  var env = {
    Date:FD,
    CalendarApp:{ getCalendarsByName:function(){ return [{ getName:function(){ return 'くらしの手帳'; } }]; }, EventColor:{}, Color:{} },
    PropertiesService:{ getScriptProperties:function(){ return P; } },
    LockService:{ getScriptLock:function(){ return { waitLock:function(){}, tryLock:function(){ return true; }, releaseLock:function(){} }; } },
    ContentService:{ MimeType:{ JSON:'json', TEXT:'text', ICAL:'ical' }, createTextOutput:function(s){ return { s:s, setMimeType:function(m){ this.m = m; return this; } }; } },
    Utilities:{ formatDate:function(d){ return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10); } },
    Session:{ getEffectiveUser:function(){ return { getEmail:function(){ return 'me@example.com'; } }; } },
    DriveApp:opt.drive || {},
    ScriptApp:{ getProjectTriggers:function(){ return triggers; }, getOAuthToken:function(){ return 'oauth'; } },
    UrlFetchApp:{ fetch:function(url, o){ fetched.push({ url:url, opt:o || {} }); return opt.fetch(url, o || {}); } },
    CacheService:{ getScriptCache:function(){ return { get:function(){ return null; }, put:function(){} }; } }
  };
  var names = Object.keys(env);
  var run = new Function(names.join(','), src.replace("var TOKEN = 'ここに合言葉';", "var TOKEN = 'tok';") + '\nreturn { doPost:doPost, doGet:doGet, tick:tick };');
  var G = run.apply(null, names.map(function(n){ return env[n]; }));
  G.props = props; G.fetched = fetched;
  G.post = function(req){ req.token = 'tok'; return JSON.parse(G.doPost({ postData:{ contents:JSON.stringify(req) } }).s); };
  G.get = function(p){ var o = G.doGet({ parameter:p }); return o.m === 'text' ? o.s : JSON.parse(o.s); };
  return G;
}
function res(code, body){ return { getResponseCode:function(){ return code; }, getContentText:function(){ return body == null ? '' : JSON.stringify(body); } }; }

KT.test('連携＋：橋わたしv4（Siri・次の予定・リマインダー・Discordボット・来週のまとめ・手書きノート・ウィジェット）', async function(){
  var NOW = Date.UTC(2026, 8, 20, 11, 30);                      /* 2026-09-20（日）20:30 日本時間 */
  eq(new Date(NOW + 9 * 3600000).getUTCDay(), 0, '日曜日で試す');
  var TD = '2026-09-20', TM = '2026-09-21';
  /* Discord（にせもの） */
  var CH = '222222222222222222', inbound = [], posts = [], nextId = 1000000000000000001, hooks = [];
  var GOOD = 'MTIzNDU2Nzg5MDEyMzQ1Njc4' + '.GAbCdE.abcdefghijklmnopqrstuvwxyz0123456789';
  var fetchFn = function(url, o){
    var api = 'https://discord.com/api/v10';
    if(/^https:\/\/discord\.com\/api\/webhooks\//.test(url)){ hooks.push(JSON.parse(o.payload)); return res(204); }
    if(url.indexOf(api) !== 0) return res(404);
    if(!o.headers || o.headers.Authorization !== 'Bot ' + GOOD) return res(401, { message:'401: Unauthorized' });
    var path = url.slice(api.length);
    if(path === '/users/@me') return res(200, { id:'123456789012345678', username:'kurashi-bot' });
    if(path === '/users/@me/guilds') return res(200, [{ id:'900000000000000001', name:'わたしのサーバー' }]);
    if(path === '/guilds/900000000000000001/channels') return res(200, [{ id:CH, type:0, name:'手帳' }, { id:'333333333333333333', type:2, name:'声' }]);
    if(path === '/channels/' + CH && (o.method || 'get') === 'get') return res(200, { id:CH, name:'手帳' });
    if(path === '/channels/' + CH + '/messages?limit=1') return res(200, [{ id:'1000000000000000000' }]);
    if(path === '/channels/' + CH + '/messages' && o.method === 'post'){ var b = JSON.parse(o.payload); b.id = String(nextId++); posts.push(b); return res(200, { id:b.id }); }
    var m = /^\/channels\/(\d+)\/messages\?limit=20(?:&after=(\d+))?$/.exec(path);
    if(m){ var after = m[2] || '0'; return res(200, inbound.filter(function(x){ return x.id.length > after.length || (x.id.length === after.length && x.id > after); }).slice().reverse()); }
    return res(404);
  };
  /* ドライブ（にせもの） */
  var queries = [];
  var iter = function(a){ var i = 0; return { hasNext:function(){ return i < a.length; }, next:function(){ return a[i++]; } }; };
  var mkFolder = function(name, subs){ return { getId:function(){ return 'fo-' + name; }, getUrl:function(){ return 'https://drive.google.com/drive/folders/' + name; }, getFolders:function(){ return iter(subs || []); } }; };
  var gn = mkFolder('GoodNotes', [mkFolder('1年後期')]);
  var drive = {
    getFoldersByName:function(n){ return iter(n === 'GoodNotes' ? [gn] : []); },
    searchFiles:function(q){
      queries.push(q);
      return iter([{ getId:function(){ return 'f1'; }, getName:function(){ return '解剖学ノート.pdf'; }, getUrl:function(){ return 'https://drive.google.com/file/d/f1'; },
        getLastUpdated:function(){ return new Date(NOW - 86400000); }, getMimeType:function(){ return 'application/pdf'; } }]);
    }
  };
  var G = await loadGas({ now:NOW, fetch:fetchFn, drive:drive });
  var ping = G.post({ action:'ping' });
  eq(ping.ver, 3, '版は3のまま（アプリの本体のテストが3を見ている）');
  eq(ping.api, 4, '窓口の版は4');
  eq(ping.dcBot, null, 'ボットはまだ');
  /* アプリのまとめ */
  var l2 = { v:1, day:TD,
    todo:[{ id:'t1', t:'レポート', s:'基礎看護', d:TD, tm:'23:00', n:0, c:'red' }, { id:'t2', t:'課題B', s:'', d:TM, tm:'', n:1, c:'orange' }, { id:'t3', t:'締切なしの課題', s:'', d:'', tm:'', n:null, c:'' }],
    cnt:{ open:3, late:0, today:1, tomorrow:1, soon3:2 },
    cls:{}, items:[{ d:TM, tm:'10:00', t:'解剖 小テスト', k:'exam' }, { d:TM, tm:'13:00', t:'歯医者', k:'event' }],
    work:[{ d:TM, st:'17:00', en:'21:00' }], exams:[{ d:TM, tm:'10:00', t:'解剖 小テスト', r:'A101' }],
    money:{ ym:'2026-09', out:12345, inn:0, free:5000 }, anki:{ due:24, today:3, streak:5 },
    pet:{ name:'ミント', stage:'こども', hun:60, joy:80, cln:70, say:'きょうもたのしいね' } };
  l2.cls[TD] = [];
  l2.cls[TM] = [{ p:1, n:'解剖生理学', r:'A101', st:'09:00', en:'10:30', off:'' }, { p:2, n:'看護学概論', r:'B2', st:'10:40', en:'12:10', off:'cancel' }];
  var ask = function(q){ return G.get({ k:'abcdefghijklmnop1234', a:'ask', q:q }); };
  ok(G.post({ action:'shortKey', key:'abcdefghijklmnop1234' }).ok, '短い合言葉');
  eq(ask('明日の1限は？').indexOf('まだアプリからまとめが届いていません'), 0, 'まとめがないとき');
  ok(G.post({ action:'summaryPut', summary:{ at:NOW, title:'9/20', lines:['予定なし'], l2:l2, pet:{ name:'ミント', emoji:'🐰' } } }).ok, 'まとめを預ける');
  /* Siri */
  eq(ask('tomorrow1'), '明日の1限は解剖生理学（A101）です。09:00から。', 'Siri：明日の1限（合図）');
  eq(ask('明日の1限は？'), '明日の1限は解剖生理学（A101）です。09:00から。', 'Siri：明日の1限（ことば）');
  eq(ask('明日の１限'), '明日の1限は解剖生理学（A101）です。09:00から。', '全角の数字でも');
  ok(/休講/.test(ask('明日の2限は？')), '休講の授業');
  ok(/3限は、授業がありません/.test(ask('明日の3限')), 'ない時限');
  ok(/今日は授業がありません|今日の1限は/.test(ask('今日の1限')) && /授業がありません/.test(ask('今日の1限')), '今日は授業なし');
  ok(/17:00〜21:00/.test(ask('次のバイトは？')), 'バイト');
  var due = ask('課題');
  ok(/レポート（今日）/.test(due) && /課題B（明日）/.test(due) && /締切なし 1件/.test(due), '締切の近い課題：' + due);
  ok(/今日までの課題は1つ/.test(ask('今日の課題は？')), '今日の課題');
  ok(/解剖 小テスト（A101）/.test(ask('今週のテスト')), 'テスト');
  ok(/¥12,345/.test(ask('今月のお金')) && /¥5,000/.test(ask('お金')), 'お金');
  ok(/24枚/.test(ask('暗記')), '暗記');
  ok(/ミント（こども）/.test(ask('ミントは元気？')) && /たのしいね/.test(ask('おせわ')), 'おせわの子');
  ok(/できること/.test(ask('ヘルプ')) && /分かりませんでした/.test(ask('ほげほげ')), 'ヘルプ・分からないとき');
  var tmr = ask('明日の予定は？');
  ok(/09:00 1限 解剖生理学/.test(tmr) && /13:00 歯医者/.test(tmr) && /締切 課題B/.test(tmr) && !/看護学概論/.test(tmr), '明日の予定（休講はのぞく）：' + tmr);
  eq(G.get({ k:'abcdefghijklmnop1234', a:'next' }), '次は 明日 09:00 1限 解剖生理学（A101）\nそのあと 明日 10:00 解剖 小テスト', 'Apple Watch：次の予定');
  var js = G.get({ k:'abcdefghijklmnop1234', a:'ask', q:'tomorrow1', fmt:'json' });
  ok(js.ok && /解剖生理学/.test(js.text), 'JSON でも答える');
  eq(G.get({ k:'wrong-key-wrong-key', a:'ask', q:'tomorrow1' }).ok, false, '合言葉がちがうと答えない');
  /* Siri・Discord から足す */
  ok(/レポート2.*10\/3/.test(ask('課題：統計のレポート2 10/3')), '課題を預かる');
  ok(/預かりました/.test(ask('メモ：白衣をクリーニング')), 'メモを預かる');
  var box = G.post({ action:'inboxTake' }).items;
  ok(box.some(function(x){ return x.kind === 'task' && x.text === '統計のレポート2' && x.due === '2026-10-03'; }), '課題（締切つき）');
  ok(box.some(function(x){ return x.kind === 'memo' && x.text === '白衣をクリーニング'; }), 'メモ');
  /* リマインダー */
  var r1 = G.get({ k:'abcdefghijklmnop1234', a:'reminders', 'new':'1' });
  eq(r1.items.join('|'), 'レポート（9/20（日） 23:00まで）|課題B（9/21（月）まで）|締切なしの課題', 'まだの課題（ショートカットの items）');
  eq(G.get({ k:'abcdefghijklmnop1234', a:'reminders', 'new':'1' }).items.length, 0, '一度わたしたものは、次は出さない');
  eq(G.get({ k:'abcdefghijklmnop1234', a:'reminders' }).items.length, 3, 'new なしなら、ぜんぶ');
  ok(G.post({ action:'remindersReset' }).ok, 'わたした記録を消す');
  eq(G.get({ k:'abcdefghijklmnop1234', a:'reminders', 'new':'1' }).items.length, 3, '消したら、またぜんぶ');
  eq(G.get({ k:'abcdefghijklmnop1234', a:'reminders', fmt:'text' }).split('\n').length, 3, '文字でも');
  /* ウィジェット */
  var wd = G.get({ k:'abcdefghijklmnop1234', a:'widget' });
  ok(wd.l2 && wd.l2.todo[0].c === 'red' && wd.pet && wd.pet.name === 'ミント', 'ウィジェットに締切の色とおせわの子');
  ok(G.post({ action:'askTest', q:'明日の1限' }).text.indexOf('解剖生理学') > 0, 'アプリから答えを試す');
  /* Discordのボット */
  eq(G.post({ action:'dcBotSet', bot:'だめなトークン' }).ok, false, 'トークンの形');
  eq(G.post({ action:'dcBotSet', bot:'MTIzNDU2Nzg5MDEyMzQ1Njc4' + '.GAbCdE.wrongwrongwrongwrongwrongwrong00' }).ok, false, 'つながらないトークンは預からない');
  var set = G.post({ action:'dcBotSet', bot:GOOD });
  ok(set.ok && set.name === 'kurashi-bot' && /client_id=123456789012345678&scope=bot&permissions=68608/.test(set.invite), 'ボットを預かる・招待のリンク');
  ok(!/abcdefghijklmnop/.test(JSON.stringify(G.post({ action:'ping' }))), 'ping にトークンを出さない');
  var chs = G.post({ action:'dcBotChannels' });
  eq(chs.items.length, 1, '文字のチャンネルだけ');
  eq(chs.items[0].name + '|' + chs.items[0].guild, '手帳|わたしのサーバー', 'チャンネルの名前');
  var use = G.post({ action:'dcBotUse', channel:CH });
  ok(use.ok && use.channel === '手帳', 'チャンネルを決める');
  eq(posts.length, 1, 'あいさつを送る');
  eq(JSON.parse(G.props.DC_BOT).after, posts[0].id, '前のメッセージには答えない');
  inbound.push({ id:'1000000000000000005', author:{ id:'u1' }, content:'<@123456789012345678> 明日の1限は？' });
  inbound.push({ id:'1000000000000000003', author:{ id:'u1' }, content:'ヘルプ' });
  inbound.push({ id:'1000000000000000006', author:{ id:'u9', bot:true }, content:'ほかのボット' });
  G.post({ action:'featSet', feat:{ dcWeek:0 } });
  G.tick();
  eq(posts.length, 3, '人の書いたものに答える（ボットには答えない）');
  ok(/できること/.test(posts[1].content) && posts[1].message_reference.message_id === '1000000000000000003', '古い順に、返信で答える');
  ok(/解剖生理学/.test(posts[2].content), 'メンションをのぞいて答える');
  eq(JSON.parse(G.props.DC_BOT).after, '1000000000000000006', 'どこまで読んだか覚える');
  G.tick();
  eq(posts.length, 3, '同じものに2回は答えない');
  eq(G.post({ action:'ping' }).dcBot.channel, '手帳', 'ping でボットの状態');
  /* 来週のまとめ（日曜の20時すぎ・ウェブフックへ・1週に1回） */
  ok(G.post({ action:'discordSet', url:'https://discord.com/api/webhooks/1/abc' }).ok, 'ウェブフック');
  ok(G.post({ action:'featSet', feat:{ dcWeek:1 } }).feat.dcWeek === 1, '来週のまとめをオン');
  G.tick();
  eq(hooks.length, 1, '来週のまとめを送る');
  var wk = hooks[0].content;
  ok(/来週の予定/.test(wk) && /9\/21（月）〜9\/27（日）/.test(wk) && /9\/21（月）：1限 解剖生理学／10:00 解剖 小テスト／13:00 歯医者／締切 課題B/.test(wk) && /暗記の復習 24枚/.test(wk), '中身：' + wk);
  G.tick();
  eq(hooks.length, 1, '同じ日に2回は送らない');
  /* 手書きノート */
  var gs = G.post({ action:'gnSearch', q:"呼吸' or\\ ショック" });
  ok(gs.ok && gs.items.length === 1 && gs.items[0].name === '解剖学ノート.pdf' && gs.items[0].url, 'ノートが見つかる');
  var q = queries[0];
  ok(q.indexOf("fullText contains '呼吸'") >= 0 && q.indexOf("fullText contains 'ショック'") >= 0, 'ことばごとに全文検索：' + q);
  ok(q.indexOf("'fo-GoodNotes' in parents") >= 0 && q.indexOf("'fo-1年後期' in parents") >= 0 && q.indexOf('trashed = false') >= 0, 'Goodnotesのフォルダの中だけ');
  eq((q.match(/'/g) || []).length % 2, 0, 'さがすことばの「\'」で式がこわれない');
  eq(G.post({ action:'gnSearch', q:'   ' }).ok, false, 'ことばがないとき');
  ok(G.post({ action:'featSet', feat:{ gnFolder:'ないフォルダ' } }).ok && /見つかりません/.test(G.post({ action:'gnSearch', q:'呼吸' }).none), 'フォルダがないとき');
  /* ボットをやめる */
  ok(G.post({ action:'dcBotSet', bot:'' }).ok && !G.props.DC_BOT, 'ボットをやめる');
});

/* ============ アプリの側 ============ */
KT.test('連携＋：Googleカレンダーの予定（今日・明日・予定タブ・取りこみ・カレンダーを選ぶ・AI・検索）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  var td = A.today(), tm = A.shiftDate(td, 1), calls = [];
  var off = front(KT.gas, function(req){
    if(req.action !== 'gcalList') return null;
    calls.push(req);
    return { ok:true, items:[
      { id:'g1@google.com', title:'サークル', cal:'マイカレンダー', allDay:0, start:td + 'T18:00', end:td + 'T20:00', where:'体育館' },
      { id:'g2@google.com', title:'家族の予定', cal:'家族', allDay:1, start:td, end:tm, where:'' },
      { id:'g3@google.com', title:'面談', cal:'マイカレンダー', allDay:0, start:tm + 'T15:00', end:tm + 'T15:30', where:'' },
      { id:'g4', title:'こわれた予定', cal:'x', start:'' }
    ] };
  });
  var hide0 = (A.l2Prefs().gcalHide || []).slice();
  try{
    gasOn(A, 3);
    await A.l2GcalLoad(true);
    eq(calls.length, 1, '読む');
    ok(calls[0].from === A.shiftDate(td, -1) && calls[0].to === A.shiftDate(td, 60), '読む日の幅');
    eq(A.l2GcalCache().items.length, 3, 'こわれた予定はのぞく');
    A.appId = 'today'; A.todayTab = 'today'; A.render();
    var txt = doc.getElementById('app').textContent;
    ok(/今日のGoogleの予定/.test(txt) && /サークル/.test(txt) && /家族の予定/.test(txt) && !/面談/.test(txt), '今日タブ');
    A.todayTab = 'tomo'; A.render();
    ok(/面談/.test(doc.getElementById('app').textContent) && !/家族の予定/.test(doc.getElementById('app').textContent), '明日（終日は終わりの日をふくまない）');
    A.todayTab = 'today'; A.render();
    doc.querySelector('[data-act="l2-gc-import"][data-id="g1@google.com"]').click();
    var ev = A.S.events.filter(function(e){ return e.gid === 'g1@google.com'; });
    eq(ev.length, 1, 'アプリの予定に入る');
    ok(ev[0].date === td && ev[0].time === '18:00' && ev[0].title === 'サークル' && /体育館/.test(ev[0].memo), '中身');
    eq(A.l2GcImport('g1@google.com'), false, '二重に入らない');
    ok(/取りこみずみ/.test(doc.getElementById('app').textContent), '取りこみずみと出る');
    var s = A.l2Summary();
    ok(s.items.some(function(x){ return x.k === 'gcal' && x.t === '面談'; }) && !s.items.some(function(x){ return x.k === 'gcal' && x.t === 'サークル'; }), 'まとめ（Siri・ウィジェット）にも。取りこんだものは二重にしない');
    /* 予定タブ */
    A.appId = 'cal'; A.calTab = 'cal'; A.calSel = tm; A.calYm = tm.slice(0, 7); A.render();
    ok(/Googleの予定（/.test(doc.getElementById('app').textContent) && /面談/.test(doc.getElementById('app').textContent), '予定タブ（選んだ日）');
    /* 出すカレンダーを選ぶ */
    A.appId = 'set'; A.S.ui.setOpen = J(A, Object.assign({}, A.S.ui.setOpen, { l2gcal:1 })); A.render();
    doc.querySelector('[data-act="l2-gc-cal"][data-v="家族"]').click();
    eq(A.l2GcOn(td).map(function(x){ return x.title; }).join(','), 'サークル', '「家族」は出さない');
    /* AI・検索 */
    var ai = A.aiSectionData('events').google_calendar;
    ok(ai && ai.items.length === 3 && ai.items.some(function(x){ return x.title === '家族の予定' && x.hidden; }) && ai.items.some(function(x){ return x.title === 'サークル' && x.imported; }), 'AIがGoogleの予定を読める');
    var hits = [];
    A.KM.search.forEach(function(fn){ hits = hits.concat(fn('面談') || []); });
    var h = hits.filter(function(x){ return x.kind === 'Googleの予定'; })[0];
    ok(h && h.act === 'l2-go-day' && String(h.attrs) === ' data-d="' + tm + '"' && h.attrs.d === tm, '全体検索（属性は文字でも表でも使える）');
    ok(hits.some(function(x){ return x.act === 'l2-gn-find'; }), '手書きノートをさがすボタンも出る');
    await KT.settle([A, B]);
    await KT.until(function(){ return B.S.events.some(function(e){ return e.gid === 'g1@google.com'; }); }, 10000, '取りこんだ予定は相手にも');
    await KT.until(function(){ return (B.l2Prefs().gcalHide || []).indexOf('家族') >= 0; }, 10000, '選んだカレンダーも相手に');
  }finally{
    off();
    A.S.events.filter(function(e){ return /^g\d/.test(e.gid || ''); }).forEach(function(e){ A.removeItem('events', e.id); });
    A.l2PrefSet({ gcalHide:hide0 }); A.commit();
    A.L2.gcal = null; A.l2Local('gcal', null);
    gasOff(A); A.appId = 'today'; A.render();
    await KT.settle([A, B]);
  }
});

/* Scriptable のにせもの（ウィジェットのプログラムを動かしてみる） */
async function runWidget(code, fam, data){
  var texts = [], widget = null;
  function Stack(){ this.kids = []; }
  Stack.prototype.addText = function(s){ var t = { text:String(s), centerAlignText:function(){} }; texts.push(t); return t; };
  Stack.prototype.addStack = function(){ return new Stack(); };
  Stack.prototype.addSpacer = function(){};
  Stack.prototype.centerAlignContent = function(){};
  Stack.prototype.setPadding = function(){};
  function ListWidget(){ Stack.call(this); }
  ListWidget.prototype = Object.create(Stack.prototype);
  function Color(hex, a){ this.hex = hex; this.a = a; }
  function LinearGradient(){}
  var Font = { boldSystemFont:function(){ return 'b'; }, systemFont:function(){ return 'r'; }, italicSystemFont:function(){ return 'i'; } };
  function Request(u){ this.url = u; }
  Request.prototype.loadJSON = function(){ return Promise.resolve(JSON.parse(JSON.stringify(data))); };
  var Script = { setWidget:function(w){ widget = w; }, complete:function(){} };
  var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  var fn = new AsyncFunction('ListWidget', 'Color', 'LinearGradient', 'Font', 'Request', 'Script', 'config', code);
  await fn(ListWidget, Color, LinearGradient, Font, Request, Script, { widgetFamily:fam, runsInWidget:true });
  return { texts:texts, widget:widget, all:texts.map(function(t){ return t.text; }).join('\n') };
}

KT.test('連携＋：締切で色が変わるウィジェット・ロック画面・おせわの子・アイコンの数字', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  KT.freshWrites([A, B]);
  var td = A.today(), mk = function(id, title, n){ return J(A, { id:id, title:title, subject:'', due:n == null ? '' : A.shiftDate(td, n), time:'', done:0, memo:'', subs:[], photos:[], pri:1, how:'', url:'', mt:Date.now() }); };
  var mine = [mk('l2t_late', 'きのうまで', -1), mk('l2t_0', 'きょうまで', 0), mk('l2t_1', 'あしたまで', 1), mk('l2t_3', 'しあさってまで', 3), mk('l2t_9', 'まだ先', 9), mk('l2t_n', '締切なし', null)];
  var done = mk('l2t_done', 'おわった', 0); done.done = 1;
  var badge0 = A.l2Prefs().badge;
  try{
    mine.concat([done]).forEach(function(t){ A.S.tasks.push(t); });
    A.commit();
    var s = A.buildSummary();
    ok(s.l2 && Array.isArray(s.l2.todo), 'まとめに l2');
    var col = {}; s.l2.todo.forEach(function(x){ col[x.id] = x.c; });
    eq([col.l2t_late, col.l2t_0, col.l2t_1, col.l2t_3, col.l2t_9, col.l2t_n].join(','), 'red,red,orange,yellow,green,', '締切の色（期限切れ・今日＝赤、明日＝だいだい、3日以内＝黄、それ以外＝緑）');
    ok(!s.l2.todo.some(function(x){ return x.id === 'l2t_done'; }), '終わった課題は入れない');
    ok(s.l2.cnt.late >= 1 && s.l2.cnt.today >= 1 && s.l2.cls[td] && s.l2.money && 'anki' in s.l2, '数・授業・お金・暗記');
    ok(JSON.stringify(s).length < 60000, 'まとめは6万字まで');
    /* Scriptable のプログラムを、それぞれの大きさで動かしてみる */
    var code = A.scriptableCode();
    ok(/accessoryCircular/.test(code) && /accessoryRectangular/.test(code) && /accessoryInline/.test(code), 'ロック画面の形');
    /* ほかのテストの課題が混ざらないよう、このテストの課題だけにして動かす */
    var l2only = Object.assign({}, s.l2, { todo:s.l2.todo.filter(function(x){ return /^l2t_/.test(x.id); }) });
    var data = { ok:true, title:'9/20（日）', lines:['1限 解剖'], money:'自由に使えるお金 ¥1,000', l2:l2only, pet:{ name:'ミント', emoji:'🐰' } };
    var med = await runWidget(code, 'medium', data);
    ok(med.widget, 'ウィジェットを作る');
    ok(/くらしの手帳/.test(med.all) && /🐰 ミント/.test(med.all) && /1限 解剖/.test(med.all), 'ホーム画面（中）：予定とおせわの子');
    var dots = med.texts.filter(function(t){ return t.text === '●'; }).map(function(t){ return t.textColor.hex; });
    eq(dots.join(','), '#E53935,#E53935', 'いちばん近い締切2つの色（赤）');
    var lg = await runWidget(code, 'large', data);
    eq(lg.texts.filter(function(t){ return t.text === '●'; }).map(function(t){ return t.textColor.hex; }).join(','), '#E53935,#E53935,#FB8C00,#FBC02D,#43A047', '大：5つの色');
    ok(/期限切れ きのうまで/.test(lg.all) && /今日 きょうまで/.test(lg.all) && /明日 あしたまで/.test(lg.all), '大：残りの日の言葉');
    var circ = await runWidget(code, 'accessoryCircular', data);
    ok(circ.widget.addAccessoryWidgetBackground && circ.texts[0].text === '4' && circ.texts[1].text === '締切', 'ロック画面（丸）：3日以内の締切の数（期限切れ・今日・明日・3日後）');
    var rect = await runWidget(code, 'accessoryRectangular', data);
    ok(/締切3日以内 \d+件：きのうまで/.test(rect.all), 'ロック画面（四角）：' + rect.all);
    var inl = await runWidget(code, 'accessoryInline', data);
    eq(inl.texts.length, 1, 'ロック画面（1行）');
    var old = await runWidget(code, 'small', { ok:true, title:'9/20', lines:['1限 解剖', '2限 看護'] });
    ok(/1限 解剖/.test(old.all) && !old.texts.some(function(t){ return t.text === '●'; }), '古い橋わたし（l2なし）でも前と同じように出る');
    var bad = await runWidget(code, 'medium', { ok:false, error:'x' });
    ok(/読みこめませんでした/.test(bad.all), '読めないとき');
    /* アイコンの数字 */
    eq(A.l2BadgeCount('due'), A.S.tasks.filter(function(t){ return !t.done && A.isYmd(t.due) && t.due <= td; }).length, '今日しめきり＋期限切れ');
    ok(A.l2BadgeCount('due') >= 2, '期限切れと今日の2つ以上');
    eq(A.l2BadgeCount('open'), A.S.tasks.filter(function(t){ return !t.done; }).length, 'まだの課題ぜんぶ');
    eq(A.l2BadgeCount('off'), 0, '出さない');
    ok(A.l2BadgeCount('today') >= 1, '今日の授業と予定');
    A.appId = 'set'; A.S.ui.setOpen = J(A, Object.assign({}, A.S.ui.setOpen, { l2iphone:1 })); gasOn(A, 4); A.render();
    A.document.querySelector('[data-act="l2-set"][data-k="badge"][data-v="open"]').click();
    eq(A.l2Prefs().badge, 'open', '数えるものを選べる');
    eq(A.L2.badgeN, A.l2BadgeCount('open'), '選んだら数字を出し直す');
    var mark = A.S.tasks.filter(function(t){ return t.id === 'l2t_9'; })[0];
    mark.done = 1; mark.mt = Date.now(); A.commit();
    await KT.until(function(){ return A.L2.badgeN === A.l2BadgeCount('open'); }, 4000, '数が変わったら出し直す');
    /* AI */
    var ai = A.aiSectionData('settings').widget_summary;
    ok(ai && ai.dues.length && ai.badge.mode === 'open', 'AIがまとめとアイコンの数字を読める');
  }finally{
    mine.concat([done]).forEach(function(t){ A.removeItem('tasks', t.id); });
    A.l2PrefSet({ badge:badge0 }); A.commit();
    gasOff(A); A.appId = 'today'; A.render();
    await KT.settle([A, B]);
  }
});

KT.test('連携＋：iPhoneのカレンダーに直接（予定表 .ics・webcal・変えたら置き直す）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  var puts = [];
  var off = front(KT.gas, function(req){ if(req.action !== 'icsPut') return null; puts.push(req.ics); return { ok:true }; });
  var ev = J(A, { id:'l2ev_ics', date:A.shiftDate(A.today(), 2), dateEnd:'', title:'とても長い名前の予定です。ことばが多いと1行が75バイトをこえるので、折り返して書く必要があります（テスト）', subject:'',
    time:'23:30', kind:'imp', memo:'メモ, カンマ; セミコロン', photos:[], mt:Date.now() });
  try{
    gasOn(A, 3);
    if(!A.shortKey()) await A.linksMakeKey();
    A.S.events.push(ev); A.commit();
    await A.l2IcsPush(true);
    eq(puts.length, 1, '予定表を置く');
    var ics = puts[0];
    ok(ics.indexOf('BEGIN:VCALENDAR\r\n') === 0 && /END:VCALENDAR\r\n$/.test(ics), '予定表の形');
    ok(/X-WR-CALNAME:くらしの手帳/.test(ics) && /REFRESH-INTERVAL;VALUE=DURATION:PT1H/.test(ics), '名前と読み直す間隔');
    var lines = ics.split('\r\n');
    ok(lines.every(function(l){ return new TextEncoder().encode(l).length <= 75; }), '1行は75バイトまで');
    var unfolded = ics.replace(/\r\n /g, '');
    ok(unfolded.indexOf('SUMMARY:★ ' + ev.title) >= 0, '折り返しても元にもどる');
    ok(unfolded.indexOf('DESCRIPTION:メモ\\, カンマ\\; セミコロン') >= 0, '記号をエスケープ');
    var d8 = ev.date.replace(/-/g, '');
    ok(unfolded.indexOf('DTSTART;TZID=Asia/Tokyo:' + d8 + 'T233000') >= 0 && unfolded.indexOf('DTEND;TZID=Asia/Tokyo:' + A.shiftDate(ev.date, 1).replace(/-/g, '') + 'T003000') >= 0, '日をまたぐ予定の終わり');
    ok(/^webcal:\/\/script\.google\.com\/macros\/s\/test\/exec\?k=.+&a=ics$/.test(A.l2Webcal()), 'webcal のリンク');
    await A.l2IcsPush(false);
    eq(puts.length, 1, '自動がオフなら置かない');
    A.l2PrefSet({ ics:1 }); A.commit();
    await A.l2IcsPush(false);
    eq(puts.length, 1, '中身が同じなら置き直さない');
    /* 変えたら、少しあとで置き直す */
    A.L2.icsDelay = 150;
    ev = A.S.events.filter(function(e){ return e.id === 'l2ev_ics'; })[0];
    ev.title = '直した予定'; ev.mt = Date.now(); A.commit();
    await KT.until(function(){ return puts.length === 2; }, 5000, '変えたら置き直す');
    ok(puts[1].indexOf('SUMMARY:★ 直した予定') >= 0, '新しい中身');
    A.appId = 'set'; A.S.ui.setOpen = J(A, Object.assign({}, A.S.ui.setOpen, { l2iphone:1 })); A.render();
    ok(doc.querySelector('a[href^="webcal://"]'), '設定に「iPhoneのカレンダーに追加」');
    ok(A.aiSectionData('settings').widget_summary.icloud_calendar.on, 'AIが状態を読める');
    /* 古い橋わたし */
    gasOn(A, 2); A.render();
    ok(/新しい版にすると使えます/.test(doc.getElementById('app').textContent), '古い橋わたしでは「新しい版にすると使えます」');
  }finally{
    off();
    A.L2.icsDelay = 3 * 60000; clearTimeout(A.L2.icsT); A.L2.icsT = null;
    A.removeItem('events', 'l2ev_ics'); A.l2PrefSet({ ics:0 }); A.commit();
    A.l2Local('ics', null);
    gasOff(A); A.appId = 'today'; A.render();
    await KT.settle([A, B]);
  }
});

KT.test('連携＋：予定表の折り返しで絵文字を分けない・変え続けても置き直す・くり返しのGoogleの予定は回ごと', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  /* 折り返し：絵文字（2つで1文字）が、どの位置で行の切れ目に来ても分けない */
  var lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  for(var i = 0; i < 8; i++){
    var line = 'SUMMARY:' + new Array(i + 1).join('a') + new Array(21).join('あ') + '📝🐰メモ📚' + new Array(40).join('い') + '✅';
    var f = A.l2IcsFold(line), parts = f.split('\r\n');
    ok(parts.every(function(p){ return !lone.test(p); }), '絵文字を分けない（' + i + '）');
    ok(parts.every(function(p){ return new TextEncoder().encode(p).length <= 75; }), '1行は75バイトまで（' + i + '）');
    eq(f.replace(/\r\n /g, ''), line, '元にもどる（' + i + '）');
  }
  /* 予定表：アプリを使い続けて（保存が続いて）も、最初に変えてから決まった時間で置く */
  var puts = [], gcalls = 0, pingApi = 4;
  var off = front(KT.gas, function(req){
    if(req.action === 'icsPut'){ puts.push(req.ics); return { ok:true }; }
    if(req.action === 'ping') return { ok:true, user:'test@example.com', ver:3, api:pingApi, trigger:true };
    if(req.action !== 'gcalList') return null;
    gcalls++;
    var td = A.today();
    return { ok:true, items:[
      { id:'rep1@google.com', title:'毎週のゼミ', cal:'マイカレンダー', allDay:0, start:td + 'T10:00', end:td + 'T11:00', where:'' },
      { id:'rep1@google.com', title:'毎週のゼミ', cal:'マイカレンダー', allDay:0, start:A.shiftDate(td, 7) + 'T10:00', end:A.shiftDate(td, 7) + 'T11:00', where:'' },
      { id:'one@google.com', title:'1回だけ', cal:'マイカレンダー', allDay:0, start:td + 'T15:00', end:td + 'T16:00', where:'' }
    ] };
  });
  try{
    gasOn(A, 3);
    A.l2Local('ics', null); A.l2PrefSet({ ics:1 }); A.commit();
    A.L2.icsDelay = 400; clearTimeout(A.L2.icsT); A.L2.icsT = null;
    var t0 = Date.now();
    while(Date.now() - t0 < 2500 && !puts.length){ A.l2Soon(); await new Promise(function(r){ setTimeout(r, 100); }); }
    eq(puts.length, 1, '保存が続いても、待ち時間をのばし続けない');
    /* くり返しの予定：どの回も同じ id で届く → 回ごとに取りこめる */
    await A.l2GcalLoad(true);
    var items = A.l2GcalCache().items;
    eq(items.length, 3, 'Googleの予定');
    var reps = items.filter(function(x){ return x.title === '毎週のゼミ'; });
    ok(reps.length === 2 && reps[0].id !== reps[1].id, 'くり返しの回ごとに id を分ける');
    eq(items.filter(function(x){ return x.title === '1回だけ'; })[0].id, 'one@google.com', '1回だけの予定の id はそのまま');
    ok(A.l2GcImport(reps[1].id), '2回目を取りこむ');
    ok(!A.l2GcImported(reps[0]), '1回目は、まだ取りこんでいない');
    ok(A.l2GcImport(reps[0].id), '1回目も取りこめる');
    var evs = A.S.events.filter(function(e){ return /^rep1@google\.com/.test(e.gid || ''); });
    eq(evs.map(function(e){ return e.date; }).sort().join(','), [A.today(), A.shiftDate(A.today(), 7)].join(','), 'それぞれの日に入る');
    A.commit();
    /* 橋わたしを新しくしたあと、「確かめる」ですぐ使えるようになる */
    gasOn(A, 3);
    A.appId = 'study'; A.studyTool = 'l2-notes'; A.render();
    ok(doc.querySelector('[data-act="l2-ping"]'), '「新しい版にしたので確かめる」ボタン');
    doc.querySelector('[data-act="l2-ping"]').click();
    await KT.until(function(){ return A.l2V4(); }, 3000, '版を確かめる');
    A.render();
    ok(!doc.querySelector('[data-act="l2-ping"]') && doc.getElementById('l2_gnq'), '新しい版の画面になる');
  }finally{
    off();
    A.L2.icsDelay = 3 * 60000; clearTimeout(A.L2.icsT); A.L2.icsT = null;
    A.S.events.filter(function(e){ return /^rep1@google\.com/.test(e.gid || ''); }).forEach(function(e){ A.removeItem('events', e.id); });
    A.l2PrefSet({ ics:0 }); A.commit();
    A.l2Local('ics', null); A.L2.gcal = null; A.l2Local('gcal', null);
    gasOff(A); A.studyTool = ''; A.appId = 'today'; A.render();
    await KT.settle([A, B]);
  }
});

KT.test('連携＋：祝日を holidays-jp で新しくする（読めないときは今のまま・相手にも・AI）', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  KT.freshWrites([A, B]);
  var mode = 'fail';
  var off = front(KT.api, function(url){
    if(!/holidays-jp\.github\.io\/api\/v1\/date\.json/.test(url)) return null;
    if(mode === 'fail') return 'Not Found <html>';
    var o = {};
    [2026, 2027].forEach(function(y){ var h = A.l2HolOrig(y); Object.keys(h).forEach(function(d){ o[d] = h[d]; }); });
    o['2026-12-24'] = 'テストの祝日';
    o['2027-02-24'] = '天皇誕生日 振替休日';
    o['2028-01-01'] = '元日';                      /* 1日しかない年は使わない */
    return o;
  });
  try{
    eq(A.holidayName('2026-12-24'), '', 'はじめは計算');
    eq(await A.l2HolUpdate(true), false, '読めないとき');
    eq(A.holidayName('2026-12-24'), '', '読めないときは今の一覧のまま');
    eq(A.holidayName('2026-09-21'), '敬老の日', '計算の祝日は使える');
    mode = 'ok';
    eq(await A.l2HolUpdate(true), true, '新しくする');
    eq(A.holidayName('2026-12-24'), 'テストの祝日', '新しい一覧の祝日');
    eq(A.holidayName('2027-02-24'), '振替休日', '振替休日の名前をそろえる');
    eq(A.holidayName('2025-01-01'), '元日', '一覧にない年は計算');
    eq(A.holidayName('2028-01-01'), '元日', '日の少ない年は計算のまま');
    eq(A.l2HolData().years.join(','), '2026,2027', '使う年');
    eq(await A.l2HolUpdate(false), false, '1か月は読み直さない');
    A.appId = 'cal'; A.calTab = 'cal'; A.calYm = '2026-12'; A.calSel = '2026-12-24'; A.render();
    A.appId = 'set'; A.S.ui.setOpen = J(A, Object.assign({}, A.S.ui.setOpen, { l2hol:1 })); A.render();
    ok(/新しい一覧を使っています（2026・2027年）/.test(A.document.getElementById('app').textContent) && /2026-12-24 テストの祝日（追加）/.test(A.document.getElementById('app').textContent), '設定に、いつ新しくしたか・ちがう日');
    var ai = A.aiSectionData('timetable').holidays;
    ok(ai.source === 'holidays-jp' && ai.list['2026-12-24'] === 'テストの祝日', 'AIが祝日を読める');
    await KT.settle([A, B]);
    await KT.until(function(){ return B.holidayName('2026-12-24') === 'テストの祝日'; }, 10000, '相手の端末でも');
  }finally{
    off();
    A.S.kmData['links2:holidays'] = J(A, { at:Date.now(), off:1 });
    A.touch('kmData'); A.commit(); A.l2Local('holTry', null);
    A.appId = 'today'; A.calYm = A.thisYm(); A.calSel = A.today(); A.render();
    await KT.settle([A, B]);
    await KT.until(function(){ return B.holidayName('2026-12-24') === ''; }, 10000, 'もとにもどす');
  }
});

KT.test('連携＋：手書きノートをさがす（ドライブの全文検索・メモの写真の文字・全体検索）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  var reqs = [];
  var offG = front(KT.gas, function(req){
    if(req.action !== 'gnSearch') return null;
    reqs.push(req);
    return { ok:true, folder:'https://drive.google.com/drive/folders/gn', items:[{ id:'f1', name:'解剖学ノート.pdf', url:'https://drive.google.com/file/d/f1', updated:Date.now() - 86400000, mime:'application/pdf' }] };
  });
  var offA = front(KT.ai, function(req){ return req.tag === 'l2-ocr' ? JSON.stringify({ text:'ショックの5徴候：蒼白・虚脱・冷汗・脈拍触知不能・呼吸不全' }) : null; });
  var pid = 'l2ph_' + Date.now().toString(36), nid = 'l2nt_ocr';
  try{
    gasOn(A, 3);
    A.appId = 'study'; A.studyTool = 'l2-notes'; A.render();
    ok(/新しい版にすると使えます/.test(doc.getElementById('app').textContent), '古い橋わたしでは「新しい版にすると使えます」');
    gasOn(A, 4); A.render();
    doc.getElementById('l2_gnq').value = '呼吸';
    doc.querySelector('[data-act="l2-gn-search"]').click();
    await KT.until(function(){ return A.L2.gn.items && !A.L2.gn.busy; }, 4000, 'さがす');
    eq(reqs[0].q, '呼吸', 'ことばを送る');
    var t = doc.getElementById('app').textContent;
    ok(/解剖学ノート/.test(t) && doc.querySelector('a[href="https://drive.google.com/file/d/f1"]'), 'ノートの名前と「ドライブで開く」');
    ok(A.aiSectionData('notes').handwritten_search.results[0].name === '解剖学ノート.pdf', 'AIが結果を読める');
    /* メモの写真の文字 */
    await A.photoPut(pid, 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD', { noCloud:true });
    A.S.notes.push(J(A, { id:nid, title:'板書の写真', body:'', pinned:0, checks:[], photos:[pid], link:null, ct:Date.now(), mt:Date.now() }));
    A.commit(); A.render();
    ok(/患者さんの情報が写っている写真はAIに送らないで/.test(doc.getElementById('app').textContent), '注意書き');
    var n = await A.l2OcrRun(50);
    ok(n >= 1, '写真の文字を読む');
    var it = A.S.kmItems.filter(function(x){ return x.mod === 'links2' && x.type === 'ocr' && x.pid === pid; })[0];
    ok(it && /ショック/.test(it.text) && it.note === nid && it.id && it.mt, '汎用の置き場に入る');
    eq(await A.l2OcrRun(50), 0, '同じ写真は2回読まない');
    A.L2.gn.q = 'ショック'; A.render();
    ok(/板書の写真/.test(doc.getElementById('app').textContent) && /写真の文字/.test(doc.getElementById('app').textContent), 'アプリのメモの中でも見つかる');
    var hits = [];
    A.KM.search.forEach(function(fn){ hits = hits.concat(fn('蒼白') || []); });
    var h = hits.filter(function(x){ return x.kind === 'メモの写真の文字'; })[0];
    ok(h && h.act === 'note-open' && h.attrs.id === nid, '全体検索に出る');
    var f = hits.filter(function(x){ return x.act === 'l2-gn-find'; })[0];
    ok(f && f.attrs.q === '蒼白', '「ノートの中をさがす」ボタン');
    reqs.length = 0;
    var btn = doc.createElement('button'); btn.setAttribute('data-act', 'l2-gn-find'); btn.setAttribute('data-q', '蒼白'); doc.getElementById('app').appendChild(btn);
    btn.click(); btn.remove();
    await KT.until(function(){ return reqs.length === 1 && !A.L2.gn.busy; }, 4000, '全体検索からさがす');
    ok(A.appId === 'study' && A.studyTool === 'l2-notes' && reqs[0].q === '蒼白', '手書きノートの画面でさがす');
    await KT.settle([A, B]);
    await KT.until(function(){ return B.S.kmItems.some(function(x){ return x.pid === pid; }); }, 10000, '読んだ文字は相手にも');
  }finally{
    offG(); offA();
    A.S.kmItems.filter(function(x){ return x.mod === 'links2' && x.type === 'ocr'; }).forEach(function(x){ A.removeItem('kmItems', x.id); });
    A.removeItem('notes', nid); A.commit();
    A.L2.gn = { q:'', busy:false, items:null, err:'', folder:'', none:'' };
    gasOff(A); A.studyTool = ''; A.appId = 'today'; A.render();
    await KT.settle([A, B]);
  }
});

KT.test('連携＋：勉強BGM（Spotify の埋めこみ・自分のプレイリスト）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  var mine0 = (A.l2Prefs().bgmMine || []).slice();
  try{
    A.appId = 'study'; A.studyTool = ''; A.render();
    ok(doc.querySelector('[data-act="study-open"][data-v="l2-bgm"]') && doc.querySelector('[data-act="study-open"][data-v="l2-notes"]'), '勉強タブに道具が出る');
    doc.querySelector('[data-act="study-open"][data-v="l2-bgm"]').click();
    var fr = doc.querySelector('iframe.l2-sp');
    ok(fr && fr.getAttribute('data-src').indexOf('https://open.spotify.com/embed/playlist/37i9dQZF1DWWQRwui0ExPn') === 0 && !fr.getAttribute('src'), 'はじめは lo-fi（テストでは読まない）');
    ok(doc.querySelector('a[href="https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn"]'), 'アプリで開く');
    doc.querySelector('[data-act="l2-bgm-pick"][data-v="playlist:37i9dQZF1DWZeKCadgRdKQ"]').click();
    ok(doc.querySelector('iframe.l2-sp').getAttribute('data-src').indexOf('37i9dQZF1DWZeKCadgRdKQ') > 0, '選べる');
    doc.getElementById('l2_bgm_url').value = 'https://example.com/x';
    doc.querySelector('[data-act="l2-bgm-add"]').click();
    eq((A.l2Prefs().bgmMine || []).length, mine0.length, 'SpotifyのURLでなければ足さない');
    doc.getElementById('l2_bgm_url').value = 'https://open.spotify.com/intl-ja/playlist/37i9dQZF1DXbITWG1ZJKYt?si=abc';
    doc.getElementById('l2_bgm_name').value = 'ジャズ';
    doc.querySelector('[data-act="l2-bgm-add"]').click();
    var mine = A.l2Prefs().bgmMine;
    ok(mine.some(function(x){ return x.id === '37i9dQZF1DXbITWG1ZJKYt' && x.name === 'ジャズ'; }), '自分のプレイリストを足す');
    ok(doc.querySelector('iframe.l2-sp').getAttribute('data-src').indexOf('37i9dQZF1DXbITWG1ZJKYt') > 0, '足したものを流す');
    await KT.settle([A, B]);
    await KT.until(function(){ return (B.l2Prefs().bgmMine || []).some(function(x){ return x.id === '37i9dQZF1DXbITWG1ZJKYt'; }); }, 10000, '相手の端末にも');
  }finally{
    A.l2PrefSet({ bgmMine:mine0 }); A.l2Local('bgmSel', null); A.commit();
    A.studyTool = ''; A.appId = 'today'; A.render();
    await KT.settle([A, B]);
  }
});

KT.test('連携＋：リマインダーに送る・Siriの答えを試す・Discordのボット（アプリの画面）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  var got = [];
  var off = front(KT.gas, function(req){
    if(['askTest', 'dcBotSet', 'dcBotChannels', 'dcBotUse', 'remindersReset'].indexOf(req.action) < 0) return null;
    got.push(req);
    if(req.action === 'askTest') return { ok:true, text:'明日の1限は解剖生理学（A101）です。' };
    if(req.action === 'dcBotSet') return req.bot ? { ok:true, bot:true, name:'kurashi-bot', invite:'https://discord.com/oauth2/authorize?client_id=1&scope=bot&permissions=68608' } : { ok:true, bot:false };
    if(req.action === 'dcBotChannels') return { ok:true, items:[{ id:'222222222222222222', name:'手帳', guild:'わたしのサーバー' }] };
    if(req.action === 'dcBotUse') return { ok:true, channel:'手帳' };
    return { ok:true };
  });
  var tk = J(A, { id:'l2t_rem', title:'看護過程のレポート', subject:'', due:A.shiftDate(A.today(), 2), time:'17:00', done:0, memo:'', subs:[], photos:[], pri:1, how:'', url:'', mt:Date.now() });
  var week0 = A.l2Prefs().dcWeek;
  try{
    A.S.tasks.push(tk); A.commit();
    A.appId = 'todo'; A.render();
    var a = Array.prototype.filter.call(doc.querySelectorAll('.l2-fold a.mini'), function(x){ return x.getAttribute('href').indexOf(encodeURIComponent('看護過程のレポート')) > 0; })[0];
    ok(a, 'ToDoタブに「リマインダーに送る」');
    eq(a.getAttribute('href'), 'shortcuts://run-shortcut?name=' + encodeURIComponent('リマインダーに追加') + '&input=text&text=' + encodeURIComponent('看護過程のレポート（' + A.l2Md(tk.due) + ' 17:00まで）'), 'ショートカットを動かすリンク');
    /* 設定：古い橋わたし → 新しい橋わたし */
    gasOn(A, 3);
    if(!A.shortKey()) await A.linksMakeKey();
    A.appId = 'set'; A.S.ui.setOpen = J(A, Object.assign({}, A.S.ui.setOpen, { l2iphone:1, l2discord:1 })); A.render();
    ok(/Siri・Apple Watchの答えは、Google連携を新しい版にすると使えます/.test(doc.getElementById('app').textContent), 'v3 では新しい版に');
    ok(/Discordのボットは、Google連携を新しい版にすると使えます/.test(doc.getElementById('app').textContent), 'ボットも');
    gasOn(A, 4); A.render();
    var copies = Array.prototype.map.call(doc.querySelectorAll('[data-act="link-copy"]'), function(b){ return b.getAttribute('data-text'); });
    ok(copies.some(function(x){ return /&a=reminders&new=1$/.test(x); }), 'まとめて送るURL');
    ok(copies.some(function(x){ return /&a=ask&q=tomorrow1$/.test(x); }) && copies.some(function(x){ return /&a=next$/.test(x); }), 'Siri・Apple WatchのURL');
    doc.getElementById('l2_ask').value = '明日の1限は？';
    doc.querySelector('[data-act="l2-ask-test"]').click();
    await KT.until(function(){ return /解剖生理学/.test(A.L2.askAns); }, 3000, '答えを見る');
    ok(/解剖生理学/.test(doc.querySelector('.l2-ans').textContent), '答えが出る');
    /* Discord */
    doc.getElementById('l2_dc_tok').value = 'MTIzNDU2Nzg5MDEyMzQ1Njc4' + '.GAbCdE.abcdefghijklmnopqrstuvwxyz0123456789';
    doc.querySelector('[data-act="l2-dc-set"]').click();
    await KT.until(function(){ return A.l2DcInfo() && A.l2DcInfo().name === 'kurashi-bot'; }, 3000, 'ボットを預ける');
    ok(!/abcdefghijklmnopqrstuvwxyz0123456789/.test(JSON.stringify(A.S)), 'トークンは手帳（同期）に入れない');
    ok(doc.querySelector('a[href^="https://discord.com/oauth2/authorize"]'), '招待のリンク');
    doc.querySelector('[data-act="l2-dc-ch"]').click();
    await KT.until(function(){ return doc.querySelector('[data-act="l2-dc-use"]'); }, 3000, 'チャンネルの一覧');
    doc.querySelector('[data-act="l2-dc-use"]').click();
    await KT.until(function(){ return A.l2DcInfo().channel === '手帳'; }, 3000, 'チャンネルを決める');
    doc.querySelector('[data-act="l2-dc-week"][data-v="1"]').click();
    await KT.until(function(){ return KT.gasState.feat && KT.gasState.feat.dcWeek === 1; }, 3000, '来週のまとめを橋わたしへ');
    ok(A.aiSectionData('settings').widget_summary.discord_bot.channel === '手帳', 'AIがボットの状態を読める');
    await KT.settle([A, B]);
    await KT.until(function(){ return B.l2Prefs().dcWeek === 1; }, 10000, '来週のまとめの設定は相手にも');
    doc.querySelector('[data-act="l2-dc-off"]').click();
    await KT.until(function(){ return !A.l2DcInfo(); }, 3000, 'ボットをやめる');
  }finally{
    off();
    A.removeItem('tasks', 'l2t_rem'); A.l2PrefSet({ dcWeek:week0 }); A.commit();
    A.l2Local('dc', null); A.L2.askAns = ''; KT.gasState.feat = null;
    gasOff(A); A.appId = 'today'; A.render();
    await KT.settle([A, B]);
  }
});
})();

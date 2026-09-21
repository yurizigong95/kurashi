/* くらしの手帳：自動テスト（ブラウザで tests/index.html を開くと動く） */
(function(){
'use strict';

/* ============ にせの Firestore（本物と同じ決まりを守る） ============ */
function isObj(v){ return v && typeof v === 'object' && !Array.isArray(v); }
function clone(v){ return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function hasNested(v){
  if(Array.isArray(v)) return v.some(function(x){ return Array.isArray(x) || hasNested(x); });
  if(isObj(v)) return Object.keys(v).some(function(k){ return hasNested(v[k]); });
  return false;
}
function bytes(v){ return new TextEncoder().encode(JSON.stringify(v)).length; }
function deepMerge(a, b){
  Object.keys(b).forEach(function(k){
    if(isObj(b[k]) && isObj(a[k])) a[k] = deepMerge(a[k], b[k]);
    else a[k] = clone(b[k]);
  });
  return a;
}
function makeFakeFs(){
  var docs = {}, listeners = {}, stats = { writes:0, reads:0, byId:{} };
  var delay = function(){ return new Promise(function(r){ setTimeout(r, 3 + Math.random() * 12); }); };
  var notify = function(id){
    (listeners[id] || []).forEach(function(cb){
      setTimeout(function(){ cb(docs[id] ? clone(docs[id]) : null); }, 1);
    });
  };
  return {
    docs:docs, stats:stats,
    get: function(id){ return delay().then(function(){ stats.reads++; return docs[id] ? clone(docs[id]) : null; }); },
    set: function(id, data, merge){
      return delay().then(function(){
        if(hasNested(data)) throw new Error('Function setDoc() called with invalid data. Nested arrays are not supported');
        var next = (merge && docs[id]) ? deepMerge(clone(docs[id]), data) : clone(data);
        if(bytes(next) > 1048487) throw new Error('Document exceeds maximum size (1 MiB)');
        docs[id] = next; stats.writes++; stats.byId[id] = (stats.byId[id] || 0) + 1;
        notify(id);
      });
    },
    del: function(id){ return delay().then(function(){ delete docs[id]; stats.writes++; notify(id); }); },
    listen: function(id, ok){
      (listeners[id] = listeners[id] || []).push(ok);
      setTimeout(function(){ ok(docs[id] ? clone(docs[id]) : null); }, 1);
      return function(){ listeners[id] = (listeners[id] || []).filter(function(f){ return f !== ok; }); };
    }
  };
}

/* ============ にせのAI・にせのGoogle ============ */
var aiCalls = [];
function fakeAi(req){
  aiCalls.push(req);
  var tag = req.tag;
  /* 足した機能のテスト（tests/tests-m-*.js）が用意した答え */
  for(var hi = 0; hi < KT.ai.length; hi++){ var hr = KT.ai[hi](req); if(hr != null) return Promise.resolve(hr); }
  if(tag === 'syllabus') return Promise.resolve(JSON.stringify({
    exam:60, report:30, attend:10, other:null, other_detail:'', notes:'出席2/3以上で受験資格',
    tests:[{ title:'中間試験', kind:'exam', date:'11/12', week:'' }, { title:'小テスト', kind:'quiz', date:null, week:'第3回' }]
  }));
  if(tag === 'shift') return Promise.resolve(JSON.stringify({ shifts:[
    { date:'2026-09-20', start:'9:00', end:'17:00', note:'' },
    { date:'9/21', start:'17', end:'22:00', note:'レジ' },
    { date:'', start:'10:00', end:'12:00' }
  ]}));
  if(tag === 'anki') return Promise.resolve(JSON.stringify({ deck:'成人看護学概論', cards:[
    { q:'成人の呼吸数の正常値は？', a:'12〜20回/分' },
    { q:'成人の体温の正常値は？', a:'36〜37℃' },
    { q:'成人の脈拍の正常値は？', a:'60〜100回/分' },
    { q:'SpO2の基準値は？', a:'96〜99%' },
    { q:'成人の呼吸数の正常値は？', a:'（同じ問いは入れない）' },
    { q:'答えのない問い', a:'' },
    { q:'収縮期血圧の基準は？', a:'140mmHg未満' }
  ]}));
  if(tag === 'summary') return Promise.resolve('・テストのまとめ\n・来週までにレポート');
  if(tag === 'stt') return Promise.resolve('明日の予定は？');
  if(tag === 'week') return Promise.resolve('よかったこと：出席をがんばった\n来週の目標：課題を早めに');
  if(tag === 'charatalk'){
    var mk = function(p, n){ var a = []; for(var i = 0; i < n; i++) a.push(p + 'のセリフ' + i); return a; };
    return Promise.resolve(JSON.stringify({ morning:mk('朝', 50), noon:mk('昼', 50), evening:mk('夕', 50), night:mk('夜', 40), any:mk('いつでも', 40) }));
  }
  if(tag === 'chat'){
    var last = (req.contents || [])[req.contents.length - 1] || {};
    var said = (last.parts || []).map(function(p){ return p.text || ''; }).join('');
    var answered = (last.parts || []).some(function(p){ return p.functionResponse; });
    if(answered) return Promise.resolve('登録しました。');
    if((req.tools || []).indexOf('functions') >= 0 && /登録して/.test(said)){
      return Promise.resolve({ parts:[
        { functionCall:{ name:'add_event', args:{ title:'歯医者', date:'2026-10-20', time:'10:00' } } },
        { functionCall:{ name:'add_spend', args:{ amount:580, title:'コンビニ', category:'food' } } }
      ] });
    }
    if((req.tools || []).indexOf('google_search') >= 0){
      return Promise.resolve({ text:'調べました。', grounding:{ groundingChunks:[{ web:{ uri:'https://example.com/a', title:'出典A' } }, { web:{ uri:'javascript:alert(1)', title:'だめ' } }],
        searchEntryPoint:{ renderedContent:'<div class="chip">検索</div>' } } });
    }
  }
  return Promise.resolve('テストの答えです。');
}
var gasCalls = [];
var gasState = { jobs:[], inbox:[], summary:null, taskItems:[], taskChanges:[], taskCreated:[] };
/* にせの Firebase Storage */
var stStore = {};
var fakeSt = {
  put:function(pid, data){ stStore[pid] = data; return new Promise(function(r){ setTimeout(r, 5); }); },
  get:function(pid){ return Promise.resolve(stStore[pid] || null); },
  del:function(pid){ delete stStore[pid]; return Promise.resolve(); }
};
function fakeGas(req){
  gasCalls.push(req);
  for(var hi = 0; hi < KT.gas.length; hi++){ var hr = KT.gas[hi](req); if(hr != null) return Promise.resolve(hr); }
  if(req.token === 'tok' && req.action === 'proxyGet'){
    var px = fakeApi(req.url);
    return Promise.resolve(px == null ? { ok:false, error:'読めませんでした' } : { ok:true, status:200, text:px });
  }
  /* ほかの端末：コードで合言葉を受け取る（合言葉なしで呼べる） */
  if(req.action === 'pairClaim' && !req.token){
    var pr = gasState.pair;
    if(!pr || pr.code !== String(req.code)) return Promise.resolve({ ok:false, error:'コードがちがいます' });
    gasState.pair = null;
    return Promise.resolve({ ok:true, token:'tok' });
  }
  if(req.token !== 'tok') return Promise.resolve({ ok:false, error:'合言葉がちがいます' });
  if(req.action === 'ping') return Promise.resolve({ ok:true, user:'test@example.com', calendar:'くらしの手帳', ver:gasState.ver || 2, trigger:true, ai:!!gasState.aiKey });
  if(req.action === 'pairOffer'){ gasState.pair = { code:String(req.code) }; return Promise.resolve({ ok:true, minutes:10 }); }
  if(req.action === 'featSet'){ gasState.feat = req.feat; return Promise.resolve({ ok:true, feat:req.feat }); }
  if(req.action === 'aiKeySet'){ gasState.aiKey = req.key; return Promise.resolve({ ok:true, ai:!!req.key }); }
  if(req.action === 'sheetSync'){ gasState.sheets = req.sheets; return Promise.resolve({ ok:true, url:'https://docs.google.com/spreadsheets/d/test', sheets:Object.keys(req.sheets).length }); }
  if(req.action === 'scanNow') return Promise.resolve({ ok:true, found:[], done:0, left:0 });
  if(req.action === 'calSync') return Promise.resolve({ ok:true, done:req.items.length, remaining:0, total:req.items.length, errors:[] });
  if(req.action === 'backup') return Promise.resolve({ ok:true, id:'f1', name:req.name, size:req.json.length, url:'' });
  if(req.action === 'photoNames') return Promise.resolve({ ok:true, names:[] });
  if(req.action === 'photoPut') return Promise.resolve({ ok:true });
  if(req.action === 'backupList') return Promise.resolve({ ok:true, items:[] });
  if(req.action === 'ping') return Promise.resolve({ ok:true, user:'test@example.com', ver:2, trigger:true });
  if(req.action === 'setup' || req.action === 'shortKey' || req.action === 'discordSet' || req.action === 'pushRegister' || req.action === 'pushRemove') return Promise.resolve({ ok:true });
  if(req.action === 'jobsPut'){ gasState.jobs = req.jobs; return Promise.resolve({ ok:true, n:req.jobs.length }); }
  if(req.action === 'summaryPut'){ gasState.summary = req.summary; return Promise.resolve({ ok:true }); }
  if(req.action === 'inboxTake'){ var box = gasState.inbox; gasState.inbox = []; return Promise.resolve({ ok:true, items:box }); }
  if(req.action === 'notifyTest') return Promise.resolve({ ok:true, result:{ push:[{ code:200 }], discord:{ code:204 } } });
  if(req.action === 'tasksSync'){
    gasState.taskItems = req.items;
    var out = { ok:true, changes:gasState.taskChanges || [], created:gasState.taskCreated || [], remaining:0 };
    gasState.taskChanges = []; gasState.taskCreated = [];
    return Promise.resolve(out);
  }
  return Promise.resolve({ ok:false, error:'unknown ' + req.action });
}

/* 外のAPI（論文・本・天気など）のにせもの：足した機能のテストが KT.api に答えを入れる */
function fakeApi(url){
  for(var hi = 0; hi < KT.api.length; hi++){ var hr = KT.api[hi](url); if(hr != null) return typeof hr === 'string' ? hr : JSON.stringify(hr); }
  return null;
}
window.__FAKE_API = function(url){ return Promise.resolve(fakeApi(url)); };

/* ============ 道具 ============ */
var FS = null;
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
async function until(fn, ms, what){
  var end = Date.now() + (ms || 8000);
  while(Date.now() < end){
    try{ if(fn()) return true; }catch(e){}
    await sleep(40);
  }
  throw new Error('待ちきれませんでした：' + (what || fn.toString().slice(0, 80)));
}
function ok(cond, msg){ if(!cond) throw new Error(msg || '条件が合いません'); }
function eq(a, b, msg){ if(a !== b) throw new Error((msg || '値がちがいます') + '（' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b) + '）'); }
function clean(dev){
  var prefix = 'shiharai:v1:test:' + dev;
  Object.keys(localStorage).forEach(function(k){ if(k === prefix || k.indexOf(prefix + ':') === 0) localStorage.removeItem(k); });
  try{ indexedDB.deleteDatabase('kurashi-photos-test-' + dev); }catch(e){}
}
var frames = {};
function openFrame(dev){
  return new Promise(function(res, rej){
    var old = document.getElementById('f-' + dev);
    if(old) old.remove();
    var f = document.createElement('iframe');
    f.id = 'f-' + dev;
    f.title = '端末 ' + dev;
    f.src = '../index.html?test=1&dev=' + dev + '&t=' + Date.now();
    f.onload = function(){
      var w = f.contentWindow;
      until(function(){ return w.render && w.syncState && w.document.getElementById('app').innerHTML.length > 100; }, 10000, dev + 'の起動')
        .then(function(){ frames[dev] = w; res(w); }, rej);
    };
    document.getElementById('frames').appendChild(f);
  });
}
function reloadFrame(dev){ return openFrame(dev); }
function busy(w){ return w.syncState.sending || w.syncState.pulling || w.syncState.timer && w.syncState.dirty; }
/* 書きこみが落ちつくまで待つ */
async function settle(ws, quiet){
  quiet = quiet || 1500;
  var last = -1, since = Date.now(), end = Date.now() + 30000;
  while(Date.now() < end){
    var w0 = FS.stats.writes;
    var anyBusy = ws.some(function(w){ return w.syncState.sending || w.syncState.pulling || w.photoCloud.busy; });
    if(w0 !== last || anyBusy){ last = w0; since = Date.now(); }
    else if(Date.now() - since >= quiet) return;
    await sleep(80);
  }
  throw new Error('同期が落ちつきませんでした（書きこみ ' + FS.stats.writes + ' 回）');
}
function J(w, v){ return w.JSON.parse(JSON.stringify(v)); }   /* その端末の中で作ったものとして渡す */
function ids(list){ return (list || []).map(function(x){ return x.id; }).sort().join(','); }
function tinyJpeg(kb){
  /* だいたい kb キロバイトの写真（中身はランダム） */
  var n = Math.floor(kb * 1024 * 3 / 4), a = new Uint8Array(n);
  for(var i = 0; i < n; i += 65536) crypto.getRandomValues(a.subarray(i, Math.min(n, i + 65536)));
  var s = ''; for(var j = 0; j < n; j += 0x8000) s += String.fromCharCode.apply(null, a.subarray(j, j + 0x8000));
  return 'data:image/jpeg;base64,' + btoa(s);
}
function randText(n){
  var s = ''; while(s.length < n) s += Math.random().toString(36).slice(2);
  return s.slice(0, n);
}

/* ============ テスト ============ */
var T = [];
function test(name, fn){ T.push({ name:name, fn:fn }); }

test('2台とも起動して、テストモードで動く', async function(){
  var A = frames.A, B = frames.B;
  ok(A.TEST_MODE && B.TEST_MODE, 'テストモードではありません');
  ok(A.KEY !== B.KEY, '2台の保存場所が同じです');
  ok(A.DEV.id !== B.DEV.id, '端末IDが同じです');
  await until(function(){ return A.syncState.on && B.syncState.on && A.syncState.remote && B.syncState.remote; }, 8000, '同期の接続');
});

test('すべての画面がエラーなく表示できる', async function(){
  var w = frames.A, errs = [];
  var S = w.S;
  w.TAB_DEFS.map(function(t){ return t[0]; }).forEach(function(a){
    (w.SUBTAB_DEFS[a] ? w.SUBTAB_DEFS[a].map(function(x){ return x[0]; }) : [null]).forEach(function(s){
      try{
        w.appId = a;
        if(s){ if(a==='money') w.payTab=s; else if(a==='risyu') w.risyuTab=s; else if(a==='cal') w.calTab=s; else if(a==='todo') w.todoTab=s; else if(a==='today') w.todayTab=s; }
        w.render();
      }catch(e){ errs.push(a + '/' + s + '：' + e.message); }
    });
  });
  try{
    S.ui.setOpen = { s1:1, s2:1, s3:1, s4:1, s5:1, s6:1, storageBox:1, kindSettings:1, weekFilterSettings:1, errlog:1, gas:1, whatsnew:1, chara:1 };
    w.appId = 'set'; w.render();
  }catch(e){ errs.push('設定：' + e.message); }
  w.termCourses().forEach(function(c){ try{ w.appId = 'course'; w.courseView = c.name; w.render(); }catch(e){ errs.push('授業 ' + c.name + '：' + e.message); } });
  w.courseView = ''; w.appId = 'today'; w.todayTab = 'today'; w.render();
  ok(!errs.length, errs.join('\n'));
});

test('同期：Firestoreが受け付けない形（配列の中の配列）を送らない', async function(){
  var A = frames.A, B = frames.B;
  A.pushRemote(true); B.pushRemote(true);
  await settle([A, B]);
  ok(!A.syncState.err, 'Aで送信エラー：' + A.syncState.err);
  ok(!B.syncState.err, 'Bで送信エラー：' + B.syncState.err);
  ok(FS.docs['test-room__v3'], '目次の文書がありません');
  ok(Object.keys(FS.docs['test-room__v3'].parts || {}).length >= 5, 'かたまりが足りません');
});

test('同期：Aで足した予定がBに届く', async function(){
  var A = frames.A, B = frames.B;
  A.S.events.push(J(A, { id:'ev_sync1', date:'2026-09-20', title:'Aの予定', subject:'医学英語', kind:'other', mt:Date.now() }));
  A.commit();
  await until(function(){ return B.S.events.some(function(e){ return e.id === 'ev_sync1'; }); }, 10000, 'Bに届く');
  await settle([A, B]);
});

test('同期：Bで直した中身がAにもどる', async function(){
  var A = frames.A, B = frames.B;
  var e = B.S.events.filter(function(x){ return x.id === 'ev_sync1'; })[0];
  e.title = 'Bで直した'; e.mt = Date.now();
  B.commit();
  await until(function(){ var a = A.S.events.filter(function(x){ return x.id === 'ev_sync1'; })[0]; return a && a.title === 'Bで直した'; }, 10000, 'Aに届く');
  await settle([A, B]);
  var a = A.S.events.filter(function(x){ return x.id === 'ev_sync1'; })[0];
  eq(a.by, B.DEV.id, '直した端末の記録');
});

test('同期：2台で同時に足しても、両方残る', async function(){
  var A = frames.A, B = frames.B;
  A.S.tasks.push(J(A, { id:'tk_a', title:'Aの課題', subject:'', due:'2026-09-22', done:0, subs:[], photos:[], mt:Date.now() }));
  B.S.tasks.push(J(B, { id:'tk_b', title:'Bの課題', subject:'', due:'2026-09-23', done:0, subs:[], photos:[], mt:Date.now() }));
  A.persist(); B.persist();
  A.pushRemote(true); B.pushRemote(true);
  await until(function(){
    var ha = ids(A.S.tasks.filter(function(t){ return /^tk_[ab]$/.test(t.id); }));
    var hb = ids(B.S.tasks.filter(function(t){ return /^tk_[ab]$/.test(t.id); }));
    return ha === 'tk_a,tk_b' && hb === 'tk_a,tk_b';
  }, 15000, '両方に2件');
  await settle([A, B]);
});

test('同期：落ちついたら、何度たしかめても書きこまない（行ったり来たりしない）', async function(){
  var A = frames.A, B = frames.B;
  await settle([A, B]);
  var w0 = FS.stats.writes;
  A.pushRemote(true); B.pushRemote(true);
  await sleep(2500);
  A.pushRemote(true); B.pushRemote(true);
  await sleep(2500);
  eq(FS.stats.writes, w0, '書きこみの回数');
  eq(A.canon(A.buildPart('plan')), B.canon(B.buildPart('plan')), '2台の予定の中身');
  eq(A.canon(A.buildPart('core')), B.canon(B.buildPart('core')), '2台の設定の中身');
});

test('同期：消した予定は相手でも消え、取り消すと相手でも戻る', async function(){
  var A = frames.A, B = frames.B;
  A.removeWithUndo('tasks', 'tk_b', '削除しました');
  A.commit();
  await until(function(){ return !B.S.tasks.some(function(t){ return t.id === 'tk_b'; }); }, 10000, 'Bで消える');
  await settle([A, B]);
  A.document.getElementById('undoBtn').click();
  await until(function(){ return B.S.tasks.some(function(t){ return t.id === 'tk_b'; }); }, 10000, 'Bで戻る');
  await settle([A, B]);
  ok(A.S.tasks.some(function(t){ return t.id === 'tk_b'; }), 'Aでも戻っている');
});

test('同期：設定・見た目・端末の名前が届く', async function(){
  var A = frames.A, B = frames.B;
  A.S.settings.fare = 777; A.S.ui.theme = 'mint';
  A.DEV.name = 'テストのA'; A.saveDevice();
  A.commit(); A.pushRemote(true);
  await until(function(){ return B.S.settings.fare === 777 && B.S.ui.theme === 'mint'; }, 10000, '設定が届く');
  await until(function(){ return (B.syncState.devices[A.DEV.id] || {}).name === 'テストのA'; }, 10000, '端末の名前が届く');
  eq(B.deviceName(A.DEV.id), 'テストのA', '名前の表示');
  await settle([A, B]);
});

test('同期：APIキーは送らない', async function(){
  var A = frames.A, B = frames.B;
  A.S.settings.geminiKey = 'SECRET-KEY-123'; A.commit();
  await settle([A, B]);
  var all = JSON.stringify(FS.docs);
  ok(all.indexOf('SECRET-KEY-123') < 0, '送信データの中にAPIキーがあります（圧縮前も確認）');
  var core = A.canon(A.buildPart('core'));
  ok(core.indexOf('SECRET-KEY-123') < 0, '送る前の中身にAPIキーがあります');
  ok(B.S.settings.geminiKey !== 'SECRET-KEY-123', 'Bにキーが届いています');
  A.S.settings.geminiKey = ''; A.commit();
  await settle([A, B]);
});

test('同期：1MBをこえる会話も、分けて送って届く', async function(){
  var A = frames.A, B = frames.B;
  var msgs = [];
  for(var i = 0; i < 380; i++) msgs.push({ role: i % 2 ? 'ai' : 'user', text: randText(3000), mt: 1700000000000 + i });
  A.S.chatRooms = J(A, { big: msgs }); A.S.chatMeta.big = J(A, { name:'大きい会話', mt:Date.now() });
  A.commit(); A.pushRemote(true);
  await until(function(){ return B.S.chatRooms && B.S.chatRooms.big && B.S.chatRooms.big.length === 380; }, 20000, 'Bに380件');
  await settle([A, B]);
  var m = FS.docs['test-room__v3'].parts.ai;
  ok(m.n >= 2, '分けて送られていません（' + m.n + '個）');
  ok(m.z === 1, '圧縮されていません');
  eq(B.S.chatRooms.big[379].text, msgs[379].text, '最後の発言');
});

test('同期：写真が相手の端末でも見られ、消すと相手でも消える', async function(){
  var A = frames.A, B = frames.B;
  var img = tinyJpeg(1200);
  await A.photoPut('mi_t1', img);
  await until(function(){ return B.photoCloud.index && B.photoCloud.index.mi_t1 && B.photoCloud.index.mi_t1.n; }, 15000, '写真の目次');
  eq(B.photoCloud.index.mi_t1.n, 2, '大きい写真は2つに分けて送る');
  var got = await B.photoGet('mi_t1');
  eq(got && got.length, img.length, '受け取った写真の大きさ');
  ok(got === img, '受け取った写真の中身');
  await A.photoDel('mi_t1');
  await until(function(){ return B.photoCloud.index.mi_t1 && B.photoCloud.index.mi_t1.del; }, 10000, '消した印');
  await sleep(200);
  eq(await B.photoGetLocal('mi_t1'), null, 'Bの端末からも消える');
  await settle([A, B]);
});

test('同期：前のしくみ（16b）の文書を読みこむ。書きこみはしない', async function(){
  var A = frames.A, B = frames.B;
  var w0 = FS.stats.byId['test-room'] || 0;
  await FS.set('test-room', { v:2, updatedAt:Date.now(), build:'2026-09-16b',
    json: JSON.stringify({ events:[{ id:'ev_old', date:'2026-10-01', title:'前のしくみの予定', kind:'other', mt:Date.now() }], meta:{}, deleted:[] }) });
  await until(function(){ return A.S.events.some(function(e){ return e.id === 'ev_old'; }); }, 10000, 'Aに届く');
  await until(function(){ return B.S.events.some(function(e){ return e.id === 'ev_old'; }); }, 10000, 'Bに届く');
  await settle([A, B]);
  eq(FS.stats.byId['test-room'], w0 + 1, '前のしくみの文書に書きこんだ回数（テストの準備の1回だけ）');
  ok(A.syncState.legacy && A.syncState.legacy.build === '2026-09-16b', '古い端末の知らせ');
});

test('同期：送れないときは上に「送れていません」と出る', async function(){
  var A = frames.A;
  var realSet = FS.set;
  FS.set = function(){ return Promise.reject(new Error('テストのための失敗')); };
  try{
    A.S.events.push(J(A, { id:'ev_fail', date:'2026-09-25', title:'送れない', kind:'other', mt:Date.now() }));
    A.commit(); A.pushRemote(true);
    await until(function(){ return A.syncState.err; }, 5000, 'エラー');
    eq(A.document.getElementById('synctag').textContent, '送れていません', '上の表示');
  }finally{ FS.set = realSet; }
  A.syncState.err = ''; A.pushRemote(true);
  await until(function(){ return A.document.getElementById('synctag').textContent === '同期済み'; }, 10000, '同期済みにもどる');
  ok(A.errLogAll().some(function(x){ return /テストのための失敗/.test(x.m); }), 'エラーの記録に残る');
});

test('入力：予定の追加画面で打った字が、描き直し・種類の変更・開き直しで消えない', async function(){
  var A = frames.A, doc = A.document;
  A.appId = 'cal'; A.calTab = 'add'; A.evDraft = null; A.render();
  doc.querySelector('[data-act="ev-kind"][data-k="other"]').click();
  var ti = doc.getElementById('ev_title'); ti.value = '消えない字'; ti.dispatchEvent(new A.Event('input', { bubbles:true }));
  var me = doc.getElementById('ev_memo'); me.value = 'メモの字'; me.dispatchEvent(new A.Event('input', { bubbles:true }));
  var sj = doc.getElementById('ev_subject'); ok(sj, 'その他にも科目の欄がある');
  sj.value = '医学英語'; sj.dispatchEvent(new A.Event('change', { bubbles:true }));
  A.render();
  eq(doc.getElementById('ev_title').value, '消えない字', '描き直したあと');
  doc.querySelector('[data-act="ev-kind"][data-k="imp"]').click();
  eq(doc.getElementById('ev_memo').value, 'メモの字', '種類を変えたあと');
  await sleep(400);                                       /* 書きかけを保存するのを待つ */
  var A2 = await reloadFrame('A');
  A2.appId = 'cal'; A2.calTab = 'add'; A2.render();
  eq(A2.document.getElementById('ev_title').value, '消えない字', '開き直したあと');
  eq(A2.document.getElementById('ev_subject').value, '医学英語', '科目も残る');
  A2.document.querySelector('[data-act="ev-save"]').click();
  ok(A2.S.events.some(function(e){ return e.title === '消えない字' && e.subject === '医学英語'; }), '保存できる');
  eq(A2.localStorage.getItem(A2.DRAFT_KEY), null, '保存したら書きかけは消える');
  await settle([A2, frames.B]);
});

test('時間割：今日は上の日付の欄だけに色がつき、科目の予定（その他をふくむ）が出る', async function(){
  var A = frames.A;
  var td = A.today(), dow = new Date().getDay();
  A.S.events.push(J(A, { id:'ev_tt', date:td, title:'持ち物', subject:'英語コミュニケーションⅡ(7)', kind:'other', mt:Date.now() }));
  A.commit();
  A.appId = 'tt'; A.ttWeek = null; A.render();
  if(dow >= 1 && dow <= 5){
    ok(A.document.querySelector('th.today .todaytag'), '今日の見出し');
  }
  eq(A.document.querySelectorAll('td.todaycol, tr.nowrow').length, 0, '授業のマスは囲まない');
  A.ttWeek = 2; A.render();
  ok(A.document.querySelector('.ttnow [data-act="tt-weekset"]'), '別の週を見ているときは「今週にもどる」');
  A.ttWeek = null; A.render();
  ok(A.itemsForCourseOn('英語コミュニケーションⅡ(7)', td).some(function(x){ return x.id === 'ev_tt'; }), 'その他の予定もマスに出る');
  var box = [].slice.call(A.document.querySelectorAll('#app section')).filter(function(s){ return /科目ごとの予定/.test(s.textContent); })[0];
  ok(box && /持ち物/.test(box.textContent), '科目ごとの予定に出る');
});

test('時間割：予定が多くても軽く表示できる', async function(){
  var A = frames.A, names = A.termCourses().map(function(c){ return c.name; });
  var save = { t:A.S.tasks, e:A.S.events };
  var tasks = [], evs = [];
  for(var i = 0; i < 600; i++){
    tasks.push({ id:'tp' + i, title:'課題' + i, subject:names[i % names.length], due:A.shiftDate(A.today(), (i % 60) - 30), done:0, subs:[], photos:[], mt:1 });
    evs.push({ id:'ep' + i, date:A.shiftDate(A.today(), (i % 60) - 30), title:'予定' + i, subject:names[i % names.length], kind:'other', mt:1 });
  }
  A.S.tasks = J(A, tasks); A.S.events = J(A, evs);
  A.appId = 'tt';
  var t0 = performance.now();
  for(var k = 0; k < 5; k++) A.render();
  var ms = (performance.now() - t0) / 5;
  A.S.tasks = save.t; A.S.events = save.e; A.render();
  ok(ms < 250, '1回の表示に ' + Math.round(ms) + 'ms かかりました');
});

test('今日：欠席があと1回の授業を知らせる', async function(){
  var A = frames.A, name = '医学英語';
  var at = A.attendOf(name);
  var log = [];
  for(var i = 0; i < at.limit - 1; i++) log.push({ date:A.shiftDate(A.today(), -7 * (i + 1)), st:'欠' });
  A.S.attendLog[name] = J(A, log);
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  var al = A.document.querySelector('.absalert');
  ok(al && /あと1回/.test(al.textContent) && al.textContent.indexOf('医学英語') >= 0, '注意が出ない');
  delete A.S.attendLog[name]; A.render();
  ok(!A.document.querySelector('.absalert'), '欠席がないときは出ない');
});

test('通学：遅れたとき・乗りそこねたときの次の便', async function(){
  var A = frames.A;
  var legs = A.routeLegs('home', 'univ');
  ok(legs && legs.length === 2, '行きの道のり');
  var bus = legs[0].table[3];
  var p = A.dlyPlan('go', 0, bus, 15);
  eq(p.steps[0].arr, A.minutesOf(bus.arr) + 15, '遅れたバスの着く時刻');
  var margin = A.toNum(A.S.transit.sannomiyaTransfer) || 10;
  ok(p.steps[1].dep >= p.steps[0].arr + margin, '乗りかえに間に合う電車を選ぶ');
  var p0 = A.dlyPlan('go', 0, bus, 0);
  ok(p.arr >= p0.arr, '遅れると着くのも遅くなる');
  A.dly.what = 'late'; A.dly.leg = 0; A.appId = 'today'; A.todayTab = 'today'; A.render();
  A.dly.what = 'miss'; A.render();
  A.dly.route = 'work'; A.render(); A.dly.route = '';
  var tb = A.tbl('busGo', A.today()).map(function(x){ return A.minutesOf(x[0]); });
  ok(tb.every(function(v, i){ return !i || v >= tb[i - 1]; }), '時刻表は出る時刻の順');
});

test('お金：1か月のお金の流れの図', async function(){
  var A = frames.A;
  A.S.balances = J(A, [{ id:'bl1', name:'楽天銀行', amount:52000, mt:1 }]);
  A.S.income = J(A, [{ id:'in1', name:'バイト代', amount:60000, mt:1 }]);
  A.S.fixed = J(A, [{ id:'fx1', name:'スマホ', amount:3000, kind:'sub', mt:1 }, { id:'fx2', name:'サブスク', amount:1000, kind:'sub', mt:1 }]);
  A.appId = 'money'; A.payTab = 'home'; A.render();
  var bar = A.document.querySelector('.mf-bar');
  ok(bar, '帯がない');
  ok(bar.querySelectorAll('.mf-seg').length >= 2, '帯のうちわけが足りない');
  ok(A.document.querySelectorAll('.mf-leg .mf-li').length >= 2, '凡例がない');
  var more = A.document.querySelector('.mf-more');
  ok(more && /楽天銀行/.test(more.textContent) && /スマホ/.test(more.textContent), '1件ずつの一覧');
  var free = A.budget().free;
  ok(A.document.querySelector('.mf-kpi.hero').textContent.indexOf(A.yen(free)) >= 0, '自由に使えるお金の数字');
  /* 足りないとき */
  A.S.fixed.push(J(A, { id:'fx3', name:'大きな出費', amount:500000, kind:'fix', mt:1 }));
  A.render();
  ok(A.document.querySelector('.mf-kpi.bad') && A.document.querySelector('.mf-mark'), '足りないときの表示');
  A.S.fixed = A.S.fixed.filter(function(x){ return x.id !== 'fx3'; });
  A.render();
});

test('お金：シフト表の写真から読み取って登録', async function(){
  var A = frames.A;
  var c = document.createElement('canvas'); c.width = 40; c.height = 30;
  var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 40, 30);
  var blob = await new Promise(function(r){ c.toBlob(r, 'image/jpeg'); });
  var file = new A.File([blob], 'shift.jpg', { type:'image/jpeg' });
  A.appId = 'money'; A.payTab = 'work'; A.render();
  await A.shiftOcrRun(file);
  eq(A.shiftOcr.list.length, 2, '読み取れたシフトの数（日付のないものは外す）');
  eq(A.shiftOcr.list[1].start, '17:00', '「17」を 17:00 に直す');
  ok(/^\d{4}-09-21$/.test(A.shiftOcr.list[1].date), '年のない日付に年をつける');
  var n0 = A.S.shifts.length;
  A.shiftOcrAdd();
  eq(A.S.shifts.length, n0 + 2, '登録された数');
});

test('授業：シラバスの文章からAIで読み取る', async function(){
  var A = frames.A, name = '臨床病態栄養学';
  A.appId = 'course'; A.courseView = name; A.render();
  A.document.getElementById('sy_text').value = '成績評価：試験60%、レポート30%、平常点10%';
  await A.syllabusRead(name);
  ok(A.sylAi.result, '結果がない');
  eq(A.sylAi.result.tests.length, 2, 'テストの数');
  ok(A.isYmd(A.sylAi.result.tests[0].date), '「11/12」に年をつける');
  var n0 = A.S.exams.length;
  A.syllabusApply(name);
  eq(A.S.syllabus[name].exam, '60', 'テストの割合');
  eq(A.S.syllabus[name].rep, '30', 'レポートの割合');
  ok(/受験資格/.test(A.S.syllabus[name].memo), '条件のメモ');
  eq(A.S.exams.length, n0 + 1, '日付のあるテストだけ予定に入る');
  A.courseView = '';
});

test('そうだん：よく使う相談ボタン・長い会話のまとめ（相手にも反映）', async function(){
  var A = frames.A, B = frames.B;
  A.chatRoom = 'main';
  A.quickAddText('テスト勉強の計画は？');
  ok(A.quickList().indexOf('テスト勉強の計画は？') >= 0, 'ボタンが増える');
  var msgs = [];
  for(var i = 0; i < 45; i++) msgs.push({ role: i % 2 ? 'ai' : 'user', text:'発言' + i, mt: 1710000000000 + i });
  A.S.chat = J(A, msgs); A.commit();
  await settle([A, B]);
  var done = await A.chatMaybeSummarize(false);
  ok(done, 'まとめられなかった');
  var sums = A.S.chat.filter(function(m){ return m.role === 'sum'; });
  eq(sums.length, 1, 'まとめは1つ');
  eq(A.S.chat.length, 17, 'まとめ＋新しい16件');
  await until(function(){ return B.S.chat.length === 17 && B.S.chat[0].role === 'sum'; }, 10000, 'Bにも反映');
  ok(B.quickList().indexOf('テスト勉強の計画は？') >= 0, 'ボタンもBに届く');
  await settle([A, B]);
  eq(A.S.chat.length, 17, 'Aで古い発言がもどってこない');
  A.appId = 'chat'; A.render();
  ok(A.document.querySelector('details.csum'), 'まとめが表示される');
  ok(A.document.querySelector('[data-act="voice-mic"]'), 'マイクのボタン');
});

test('そうだん：会話を消すと、相手の端末でも消えたまま', async function(){
  var A = frames.A, B = frames.B;
  A.chatRoom = 'main'; A.appId = 'chat'; A.render();
  var realConfirm = A.confirm; A.confirm = function(){ return true; };
  try{ A.chatAction('chat-clear', A.document.body); }finally{ A.confirm = realConfirm; }
  await settle([A, B]);
  eq(A.S.chat.filter(function(m){ return m.role !== 'sum'; }).length, 0, 'Aは空');
  eq(B.S.chat.filter(function(m){ return m.role !== 'sum'; }).length, 0, 'Bも空');
});

test('取り消す：完了にした課題を取り消すと、未完了にもどる（相手にも）', async function(){
  var A = frames.A, B = frames.B;
  A.appId = 'todo'; A.render();
  var id = 'tk_a';
  A.undoable('task-done', function(){ A.risyuAction('task-done', { dataset:{ id:id } }, {}); });
  ok(A.S.tasks.filter(function(t){ return t.id === id; })[0].done, '完了になっていない');
  var btn = A.document.getElementById('undoBtn');
  ok(btn, '取り消すボタンが出ない');
  await settle([A, B]);
  btn.click();
  ok(!A.S.tasks.filter(function(t){ return t.id === id; })[0].done, '取り消せていない');
  await until(function(){ var b = B.S.tasks.filter(function(t){ return t.id === id; })[0]; return b && !b.done; }, 10000, 'Bでも未完了');
  await settle([A, B]);
});

test('Google：カレンダーに送る（通知は前日の0時）・ドライブに保存', async function(){
  var A = frames.A;
  A.GAS.url = 'https://script.google.com/macros/s/test/exec'; A.GAS.token = 'tok'; A.saveGas();
  ok(A.gasReady(), 'つながった扱いにならない');
  gasCalls.length = 0;
  await A.gasCalSync(true);
  var cal = gasCalls.filter(function(c){ return c.action === 'calSync'; })[0];
  ok(cal && cal.items.length > 0, 'カレンダーに送っていない');
  ok(cal.items.some(function(it){ return it.k === 'tk-tk_a' && it.title.indexOf('締切') === 0; }), '課題が入っていない');
  ok(cal.items.every(function(it){ return it.h && /^\d{4}-\d{2}-\d{2}$/.test(it.date); }), '予定の形');
  gasCalls.length = 0;
  await A.gasCalSync(false);
  eq(gasCalls.length, 0, '中身が同じなら送らない');
  await A.gasBackup(true);
  var bk = gasCalls.filter(function(c){ return c.action === 'backup'; })[0];
  ok(bk, 'バックアップしていない');
  var data = JSON.parse(bk.json);
  ok(data.app === 'kurashi' && Array.isArray(data.events), 'バックアップの中身');
  ok(bk.json.indexOf('SECRET') < 0, 'キーが入っていない');
  ok(A.S.cloud.backup && A.S.cloud.backup.at, '保存した記録');
  A.GAS.url = ''; A.GAS.token = ''; A.saveGas();
});

test('Google：橋わたし（Apps Script）の通知の時刻が前日の0時', async function(){
  var src = await fetch('../gas/Code.gs', { cache:'no-store' }).then(function(r){ return r.text(); });
  ok(/var TOKEN = 'ここに合言葉';/.test(src), '合言葉の置き場所');
  var created = [], props = {};
  var mkEv = function(title, st, en, allDay){
    var ev = { title:title, st:st, en:en, allDay:allDay, rem:[], id:'e' + created.length,
      removeAllReminders:function(){ ev.rem = []; }, addPopupReminder:function(m){ ev.rem.push(m); },
      setColor:function(){}, getId:function(){ return ev.id; }, deleteEvent:function(){ ev.deleted = true; } };
    created.push(ev); return ev;
  };
  var cal = {
    getName:function(){ return 'くらしの手帳'; },
    createEvent:function(t, s, e){ return mkEv(t, s, e, false); },
    createAllDayEvent:function(t, s, e){ return mkEv(t, s, (e instanceof Date) ? e : null, true); },
    getEventById:function(id){ return created.filter(function(x){ return x.id === id; })[0] || null; }
  };
  var env = {
    CalendarApp:{ getCalendarsByName:function(){ return [cal]; }, createCalendar:function(){ return cal; },
      EventColor:{ PALE_RED:1, YELLOW:2, RED:3, BLUE:4, CYAN:5, MAUVE:6, PALE_GREEN:7, GREEN:8, GRAY:9 }, Color:{ PINK:1 } },
    PropertiesService:{ getScriptProperties:function(){ return {
      getProperties:function(){ return Object.assign({}, props); },
      setProperties:function(o){ Object.assign(props, o); }, deleteProperty:function(k){ delete props[k]; } }; } },
    LockService:{ getScriptLock:function(){ return { waitLock:function(){}, releaseLock:function(){} }; } },
    ContentService:{ MimeType:{ JSON:'json' }, createTextOutput:function(s){ return { s:s, setMimeType:function(){ return this; } }; } },
    Utilities:{
      parseDate:function(s){ var m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/); return new Date(m[1] + 'T' + m[2] + ':00+09:00'); },
      formatDate:function(d){ return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10); }
    },
    Session:{ getEffectiveUser:function(){ return { getEmail:function(){ return 'me@example.com'; } }; } },
    DriveApp:{}
  };
  var names = Object.keys(env);
  var run = new Function(names.join(','), src.replace("var TOKEN = 'ここに合言葉';", "var TOKEN = 'tok';") + '\nreturn doPost;');
  var doPost = run.apply(null, names.map(function(n){ return env[n]; }));
  var call = function(req){ return JSON.parse(doPost({ postData:{ contents:JSON.stringify(req) } }).s); };
  eq(call({ token:'bad', action:'ping' }).ok, false, '合言葉がちがうと断る');
  var r = call({ token:'tok', action:'calSync', items:[
    { k:'a', h:'1', kind:'task', title:'締切 レポート', date:'2026-10-02', time:'09:30', mins:30, end:'', note:'' },
    { k:'b', h:'1', kind:'other', title:'旅行', date:'2026-10-05', time:'', mins:0, end:'2026-10-07', note:'' }
  ]});
  ok(r.ok, r.error);
  eq(created[0].rem[0], 1440 + 9 * 60 + 30, '時刻つきの予定：前日の0時');
  eq(created[1].rem[0], 1440, '終日の予定：前日の0時');
  eq(created[1].en.toISOString(), new Date('2026-10-08T12:00:00+09:00').toISOString(), '何日も続く予定の終わり');
  eq(created[0].st.toISOString(), new Date('2026-10-02T09:30:00+09:00').toISOString(), '日本時間で入る');
  var r2 = call({ token:'tok', action:'calSync', items:[
    { k:'a', h:'1', kind:'task', title:'締切 レポート', date:'2026-10-02', time:'09:30', mins:30, end:'', note:'' }
  ]});
  eq(r2.done, 1, '消えた予定だけ直す');
  ok(created[1].deleted, 'なくなった予定はカレンダーからも消す');
});

test('Google：橋わたしの通知・ショートカット・ToDo（プログラムそのもの）', async function(){
  var src = await fetch('../gas/Code.gs', { cache:'no-store' }).then(function(r){ return r.text(); });
  var manifest = await fetch('../gas/appsscript.json', { cache:'no-store' }).then(function(r){ return r.json(); });
  ok(manifest.oauthScopes.indexOf('https://www.googleapis.com/auth/firebase.messaging') >= 0, '通知の権限');
  ok(manifest.dependencies.enabledAdvancedServices.some(function(s){ return s.serviceId === 'tasks'; }), 'ToDoのサービス');
  var props = {}, triggers = [], fetched = [], gtasks = {}, gid = 0;
  var P = {
    getProperties:function(){ return Object.assign({}, props); }, getProperty:function(k){ return props[k] == null ? null : props[k]; },
    setProperty:function(k, v){ props[k] = String(v); }, setProperties:function(o){ Object.keys(o).forEach(function(k){ props[k] = String(o[k]); }); },
    deleteProperty:function(k){ delete props[k]; }
  };
  var env = {
    CalendarApp:{ getCalendarsByName:function(){ return [{ getName:function(){ return 'くらしの手帳'; } }]; }, EventColor:{}, Color:{} },
    PropertiesService:{ getScriptProperties:function(){ return P; } },
    LockService:{ getScriptLock:function(){ return { waitLock:function(){}, tryLock:function(){ return true; }, releaseLock:function(){} }; } },
    ContentService:{ MimeType:{ JSON:'json' }, createTextOutput:function(s){ return { s:s, setMimeType:function(){ return this; } }; } },
    Utilities:{
      computeDigest:function(alg, s){ var h = 0; for(var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return [h & 255, (h >> 8) & 255, (h >> 16) & 255, (h >> 24) & 255, s.length & 255]; },
      base64EncodeWebSafe:function(x){ return btoa(typeof x === 'string' ? unescape(encodeURIComponent(x)) : String.fromCharCode.apply(null, x.map(function(b){ return b & 255; }))).replace(/\+/g, '-').replace(/\//g, '_'); },
      DigestAlgorithm:{ MD5:'md5' }, Charset:{ UTF_8:'utf8' }
    },
    Session:{ getEffectiveUser:function(){ return { getEmail:function(){ return 'me@example.com'; } }; } },
    DriveApp:{},
    ScriptApp:{
      getProjectTriggers:function(){ return triggers.slice(); },
      deleteTrigger:function(t){ triggers = triggers.filter(function(x){ return x !== t; }); },
      newTrigger:function(fn){ return { timeBased:function(){ return { everyMinutes:function(){ return { create:function(){ triggers.push({ getHandlerFunction:function(){ return fn; } }); } }; } }; } }; },
      getOAuthToken:function(){ return 'oauth-token'; }
    },
    UrlFetchApp:{ fetch:function(url, opt){ fetched.push({ url:url, opt:opt }); return { getResponseCode:function(){ return /discord/.test(url) ? 204 : 200; }, getContentText:function(){ return '{}'; } }; } },
    CacheService:{ getScriptCache:function(){ return { get:function(){ return null; }, put:function(){} }; } },
    Tasks:{
      Tasklists:{ get:function(id){ if(id !== 'L1') throw new Error('no'); return { id:'L1' }; }, list:function(){ return { items:[] }; }, insert:function(){ return { id:'L1' }; } },
      Tasks:{
        list:function(){ return { items:Object.keys(gtasks).map(function(k){ return gtasks[k]; }) }; },
        insert:function(b){ var t = Object.assign({ id:'g' + (++gid), updated:new Date().toISOString() }, b); gtasks[t.id] = t; return t; },
        patch:function(b, l, id){ Object.assign(gtasks[id], b, { updated:new Date().toISOString() }); return gtasks[id]; },
        remove:function(l, id){ gtasks[id].deleted = true; }
      }
    }
  };
  var names = Object.keys(env);
  var run = new Function(names.join(','), src.replace("var TOKEN = 'ここに合言葉';", "var TOKEN = 'tok';") + '\nreturn { doPost:doPost, doGet:doGet, tick:tick };');
  var G = run.apply(null, names.map(function(n){ return env[n]; }));
  var post = function(req){ req.token = 'tok'; return JSON.parse(G.doPost({ postData:{ contents:JSON.stringify(req) } }).s); };
  var get = function(p){ return JSON.parse(G.doGet({ parameter:p }).s); };
  ok(post({ action:'ping' }).ver >= 2, '新しいプログラム');
  var mkT = post({ action:'setup' });
  ok(mkT.ok && triggers.length === 2 && mkT.fast, '5分ごとの確認と、1分ごとのDiscordの見回りを作る');
  post({ action:'setup' });
  eq(triggers.length, 2, '2回押してもふえない');
  /* ショートカット */
  eq(get({ k:'x', a:'widget' }).ok, false, '短い合言葉がないと断る');
  ok(post({ action:'shortKey', key:'abcdefghijklmnop1234' }).ok, '短い合言葉');
  ok(get({ k:'abcdefghijklmnop1234', a:'in', kind:'pay', amount:'¥1,280', shop:'セブン' }).ok, 'Apple Payの記録を預かる');
  eq(get({ k:'abcdefghijklmnop1234', a:'in', kind:'hack' }).ok, false, '知らない記録は断る');
  var box = post({ action:'inboxTake' });
  eq(box.items.length, 1, '預かった記録');
  eq(box.items[0].amount, 1280, '金額の読み取り');
  eq(post({ action:'inboxTake' }).items.length, 0, '取りこんだら空になる');
  post({ action:'summaryPut', summary:{ title:'9/17', lines:['1限 看護'], alarm:{ time:'06:40', hour:6, minute:40 } } });
  eq(get({ k:'abcdefghijklmnop1234', a:'alarm' }).time, '06:40', '目覚ましの時刻');
  eq(get({ k:'abcdefghijklmnop1234', a:'widget' }).lines[0], '1限 看護', 'ウィジェットの中身');
  /* 通知 */
  ok(post({ action:'pushRegister', device:'dA', pushToken:'TOKEN_A', name:'iPhone' }).ok, '端末の登録');
  ok(post({ action:'discordSet', url:'https://discord.com/api/webhooks/123/abc' }).ok, 'Discordの登録');
  eq(post({ action:'discordSet', url:'https://evil.example.com/x' }).ok, false, 'Discord以外のURLは断る');
  var now = Date.now();
  post({ action:'jobsPut', jobs:[
    { id:'j1', at:now - 60000, title:'締切', body:'レポート', push:1, discord:1 },
    { id:'j2', at:now + 3600000, title:'あとで', body:'', push:1, discord:0 }
  ] });
  G.tick();
  var fcm = fetched.filter(function(f){ return /fcm\.googleapis\.com/.test(f.url); });
  eq(fcm.length, 1, '時刻が来たものだけスマホに送る');
  var msg = JSON.parse(fcm[0].opt.payload).message;
  eq(msg.token + '|' + msg.data.title, 'TOKEN_A|締切', '送る中身');
  eq(fcm[0].opt.headers['x-goog-user-project'], 'kurashi-59562', 'Firebaseのプロジェクトで送る');
  eq(fetched.filter(function(f){ return /discord/.test(f.url); }).length, 1, 'Discordにも送る');
  G.tick();
  eq(fetched.filter(function(f){ return /fcm/.test(f.url); }).length, 1, '同じ通知は2回送らない');
  /* Google ToDo */
  var r1 = post({ action:'tasksSync', items:[{ k:'tk-1', title:'レポート', done:0, due:'2026-10-02', notes:'', mt:now }] });
  ok(r1.ok && Object.keys(gtasks).length === 1, 'Googleに課題を作る');
  var g1 = gtasks[Object.keys(gtasks)[0]];
  eq(g1.due, '2026-10-02T00:00:00.000Z', '締切日');
  g1.status = 'completed'; g1.updated = new Date(now + 5000).toISOString();
  gtasks.gX = { id:'gX', title:'Googleで足した', status:'needsAction', updated:new Date().toISOString() };
  var r2 = post({ action:'tasksSync', items:[{ k:'tk-1', title:'レポート', done:0, due:'2026-10-02', notes:'', mt:now }] });
  eq(r2.changes.length, 1, 'Googleで完了にしたものを返す');
  eq(r2.changes[0].done, 1, '完了');
  eq(r2.created.length, 1, 'Googleで足したものを返す');
  var r3 = post({ action:'tasksSync', items:[{ k:'tk-1', title:'レポート', done:1, due:'2026-10-02', notes:'', mt:now }, { k:r2.created[0].k, title:'Googleで足した', done:0, due:'', notes:'', mt:now }] });
  eq(r3.changes.length + r3.created.length + r3.done, 0, '落ちついたら何もしない');
  var r4 = post({ action:'tasksSync', items:[{ k:r2.created[0].k, title:'Googleで足した', done:0, due:'', notes:'', mt:now }] });
  ok(g1.deleted, 'アプリで消したらGoogleからも消す');
  ok(r4.ok, '消す');
});

test('Google：橋わたしv3（コードでつなぐ・写真・メール・朝の天気・AIの読み取り・スプレッドシート）', async function(){
  var src = await fetch('../gas/Code.gs', { cache:'no-store' }).then(function(r){ return r.text(); });
  var manifest = await fetch('../gas/appsscript.json', { cache:'no-store' }).then(function(r){ return r.json(); });
  var sc = manifest.oauthScopes;
  ok(sc.indexOf('https://www.googleapis.com/auth/gmail.readonly') >= 0 && sc.indexOf('https://mail.google.com/') < 0, 'Gmailは読むだけの権限');
  ok(sc.indexOf('https://www.googleapis.com/auth/spreadsheets') >= 0, 'スプレッドシートの権限');
  ok(manifest.dependencies.enabledAdvancedServices.some(function(s){ return s.serviceId === 'gmail'; }), 'Gmailのサービス');
  var pad = function(n){ return (n < 10 ? '0' : '') + n; };
  var b64 = function(s){ return btoa(unescape(encodeURIComponent(s))); };
  var props = {}, fetched = [], aiPrompts = [];
  var P = {
    getProperties:function(){ return Object.assign({}, props); }, getProperty:function(k){ return props[k] == null ? null : props[k]; },
    setProperty:function(k, v){ props[k] = String(v); }, setProperties:function(o){ Object.keys(o).forEach(function(k){ props[k] = String(o[k]); }); },
    deleteProperty:function(k){ delete props[k]; }
  };
  var iter = function(a){ var i = 0; return { hasNext:function(){ return i < a.length; }, next:function(){ return a[i++]; } }; };
  var mkFile = function(name, mime, bytes, parent){
    var f = { name:name, mime:mime, bytes:bytes, parent:parent, upd:Date.now(), id:'fi' + Math.random().toString(36).slice(2, 8) };
    f.getId = function(){ return f.id; }; f.getName = function(){ return f.name; }; f.getMimeType = function(){ return f.mime; };
    f.getSize = function(){ return f.bytes.length; }; f.getLastUpdated = function(){ return new Date(f.upd); };
    f.getBlob = function(){ return { getBytes:function(){ return f.bytes; } }; }; f.getUrl = function(){ return 'https://drive.google.com/file/' + f.id; };
    f.moveTo = function(to){ f.parent.files = f.parent.files.filter(function(x){ return x !== f; }); to.files.push(f); f.parent = to; };
    return f;
  };
  var mkFolder = function(name){
    var fo = { name:name, files:[], folders:[] };
    fo.getId = function(){ return 'fo-' + name; }; fo.getName = function(){ return name; }; fo.getUrl = function(){ return 'https://drive.google.com/drive/' + name; };
    fo.getFiles = function(){ return iter(fo.files.slice()); }; fo.getFolders = function(){ return iter(fo.folders.slice()); };
    fo.getFoldersByName = function(n){ return iter(fo.folders.filter(function(x){ return x.name === n; })); };
    fo.getFilesByName = function(n){ return iter(fo.files.filter(function(x){ return x.name === n; })); };
    fo.createFolder = function(n){ var c = mkFolder(n); fo.folders.push(c); return c; };
    fo.createFile = function(blob){ var f = mkFile(blob.name, blob.mime, blob.bytes, fo); fo.files.push(f); return f; };
    return fo;
  };
  var rootFolders = [];
  var sheetVals = {};
  var mkSheet = function(n){ var sh = { name:n, clearContents:function(){}, setFrozenRows:function(){}, getLastRow:function(){ return 0; },
    getRange:function(){ return { setValues:function(v){ sheetVals[n] = v; } }; } }; return sh; };
  var ssSheets = [mkSheet('シート1')];
  var ss = { getId:function(){ return 'ss1'; }, getUrl:function(){ return 'https://docs.google.com/spreadsheets/d/ss1'; },
    getSheetByName:function(n){ return ssSheets.filter(function(s){ return s.name === n; })[0] || null; },
    insertSheet:function(n){ var s = mkSheet(n); ssSheets.push(s); return s; }, getSheets:function(){ return ssSheets.slice(); },
    deleteSheet:function(s){ ssSheets = ssSheets.filter(function(x){ return x !== s; }); } };
  var mail = function(from, subject, mime, text){
    return { payload:{ headers:[{ name:'From', value:from }, { name:'Subject', value:subject }],
      mimeType:'multipart/alternative', parts:[{ mimeType:mime, headers:[{ name:'Content-Type', value:mime + '; charset=UTF-8' }],
        body:{ data:b64(text).replace(/\+/g, '-').replace(/\//g, '_') } }] } };
  };
  var msgs = {
    m1:mail('楽天カード <info@mail.rakuten-card.co.jp>', 'カード利用のお知らせ(本人ご利用分)', 'text/plain',
      '■利用日: 2026/09/18\n■利用先: セブン－イレブン\n■利用者: 本人\n■支払方法: 1回\n■利用金額: 1,234 円'),
    m2:mail('三井住友カード <statement@vpass.ne.jp>', 'ご利用のお知らせ【三井住友カード】', 'text/html',
      '<p>◇利用日：2026/09/17 12:34</p><p>◇利用先：マクドナルド</p><p>◇利用取引：買物</p><p>◇利用金額：680円</p>'),
    m3:mail('Yahoo!路線情報 <transit@mail.yahoo.co.jp>', '【運行情報】阪神本線 遅延', 'text/plain',
      '阪神本線は、人身事故の影響で遅れています。\n配信の停止はこちら http://example.com'),
    m4:mail('友だち <friend@example.com>', '週末の予定', 'text/plain', '遊びに行こう')
  };
  var aiAnswer = { course:'成人看護学概論', pages:12, summary:'・呼吸数の正常値\n・観察のポイント', tasks:[{ title:'事前課題を出す', due:'2026-10-03' }], cards:[{ q:'成人の呼吸数は？', a:'12〜20回/分' }] };
  var env = {
    CalendarApp:{ getCalendarsByName:function(){ return [{ getName:function(){ return 'くらしの手帳'; } }]; }, EventColor:{}, Color:{} },
    PropertiesService:{ getScriptProperties:function(){ return P; } },
    LockService:{ getScriptLock:function(){ return { waitLock:function(){}, tryLock:function(){ return true; }, releaseLock:function(){} }; } },
    ContentService:{ MimeType:{ JSON:'json' }, createTextOutput:function(s){ return { s:s, setMimeType:function(){ return this; } }; } },
    Utilities:{
      formatDate:function(d, tz, fmt){
        var j = new Date(d.getTime() + 9 * 3600000);
        var Y = j.getUTCFullYear(), M = pad(j.getUTCMonth() + 1), D = pad(j.getUTCDate()), H = j.getUTCHours(), mi = j.getUTCMinutes();
        if(fmt === 'H') return String(H);
        if(fmt === 'm') return String(mi);
        if(fmt === 'yyyyMMdd-HHmmss') return '' + Y + M + D + '-' + pad(H) + pad(mi) + pad(j.getUTCSeconds());
        return Y + '-' + M + '-' + D;
      },
      base64Decode:function(s){ return Array.prototype.map.call(atob(s), function(c){ return c.charCodeAt(0); }); },
      base64DecodeWebSafe:function(s){ return Array.prototype.map.call(atob(s.replace(/-/g, '+').replace(/_/g, '/')), function(c){ return c.charCodeAt(0); }); },
      base64Encode:function(bytes){ return btoa(String.fromCharCode.apply(null, bytes)); },
      newBlob:function(bytes, mime, name){ return { bytes:bytes, mime:mime, name:name, getDataAsString:function(){ return new TextDecoder().decode(new Uint8Array(bytes)); } }; }
    },
    Session:{ getEffectiveUser:function(){ return { getEmail:function(){ return 'me@example.com'; } }; } },
    DriveApp:{
      getFoldersByName:function(n){ return iter(rootFolders.filter(function(x){ return x.name === n; })); },
      createFolder:function(n){ var c = mkFolder(n); rootFolders.push(c); return c; },
      getFileById:function(){ return { moveTo:function(){} }; }
    },
    ScriptApp:{ getProjectTriggers:function(){ return [{ getHandlerFunction:function(){ return 'tick'; } }]; }, getOAuthToken:function(){ return 'oauth'; } },
    UrlFetchApp:{ fetch:function(url, opt){
      fetched.push({ url:url, opt:opt });
      var body = '{}';
      if(/open-meteo/.test(url)) body = JSON.stringify({ daily:{ precipitation_probability_max:[70], temperature_2m_max:[18], temperature_2m_min:[6] } });
      if(/generativelanguage/.test(url)){
        aiPrompts.push(JSON.parse(opt.payload));
        body = JSON.stringify({ candidates:[{ content:{ parts:[{ text:JSON.stringify(aiAnswer) }] } }] });
      }
      return { getResponseCode:function(){ return 200; }, getContentText:function(){ return body; } };
    } },
    CacheService:{ getScriptCache:function(){ return { get:function(){ return null; }, put:function(){} }; } },
    Gmail:{ Users:{ Messages:{
      list:function(){ return { messages:Object.keys(msgs).map(function(id){ return { id:id }; }) }; },
      get:function(me, id){ return msgs[id]; }
    } } },
    SpreadsheetApp:{ create:function(){ return ss; }, openById:function(){ return ss; } }
  };
  var names = Object.keys(env);
  var run = new Function(names.join(','), src.replace("var TOKEN = 'ここに合言葉';", "var TOKEN = 'tok';") + '\nreturn { doPost:doPost, tick:tick };');
  var G = run.apply(null, names.map(function(n){ return env[n]; }));
  var raw = function(req){ return JSON.parse(G.doPost({ postData:{ contents:JSON.stringify(req) } }).s); };
  var post = function(req){ req.token = 'tok'; return raw(req); };
  eq(post({ action:'ping' }).ver, 3, '新しい版');
  /* コードでつなぐ */
  eq(raw({ action:'pairClaim', code:'123456' }).ok, false, 'コードを出す前は断る');
  ok(post({ action:'pairOffer', code:'123456' }).ok, 'コードを出す');
  eq(post({ action:'pairOffer', code:'12a456' }).ok, false, '6けたの数字だけ');
  post({ action:'pairOffer', code:'123456' });
  eq(raw({ action:'pairClaim', code:'111111' }).ok, false, 'ちがうコードは断る');
  eq(raw({ action:'pairClaim', code:'123456' }).token, 'tok', '正しいコードで合言葉を渡す');
  eq(raw({ action:'pairClaim', code:'123456' }).ok, false, '1回つかったら使えない');
  post({ action:'pairOffer', code:'222222' });
  for(var i = 0; i < 5; i++) raw({ action:'pairClaim', code:'999999' });
  eq(raw({ action:'pairClaim', code:'222222' }).ok, false, '5回まちがえたら使えない');
  post({ action:'pairOffer', code:'333333' });
  var pr = JSON.parse(props.PAIR); pr.exp = Date.now() - 1000; props.PAIR = JSON.stringify(pr);
  eq(raw({ action:'pairClaim', code:'333333' }).ok, false, '10分をすぎたら使えない');
  eq(raw({ action:'calClear' }).ok, false, '合言葉なしでは、ほかのことはできない');
  /* ショートカットから：課題・写真 */
  ok(post({ action:'shortKey', key:'abcdefghijklmnop1234' }).ok, '短い合言葉');
  ok(raw({ k:'abcdefghijklmnop1234', action:'in', kind:'task', text:'レポート', due:'2026-10-01' }).ok, '課題を預かる');
  eq(raw({ k:'wrongkeywrongkey1234', action:'in', kind:'task', text:'x' }).ok, false, '短い合言葉がちがうと断る');
  eq(raw({ k:'abcdefghijklmnop1234', action:'calClear' }).ok, false, '短い合言葉では預けることしかできない');
  ok(raw({ k:'abcdefghijklmnop1234', action:'in', kind:'img', name:'ノート', data:'data:image/jpeg;base64,' + btoa('x'.repeat(300)) }).ok, '写真を預かる');
  var back = rootFolders.filter(function(f){ return f.name === 'くらしの手帳バックアップ'; })[0];
  var box = back.folders.filter(function(f){ return f.name === '受け取り'; })[0];
  eq(box.files.length, 1, '「受け取り」フォルダに置く');
  /* 使う機能・AIのカギ */
  ok(post({ action:'featSet', feat:{ mailCard:1, mailUnkou:1, discord:0, lec:0, gnFolder:'GoodNotes', gnOnly:['講義'], courses:['成人看護学概論'] } }).ok, '使う機能');
  eq(post({ action:'aiKeySet', key:'bad key!' }).ok, false, 'カギの形');
  ok(post({ action:'aiKeySet', key:'AIzaSyTESTKEY_abcdefghijklmnopqrstu' }).ok, 'AIのカギを預かる');
  ok(post({ action:'ping' }).ai, 'カギがあることが分かる');
  /* Gmail：カード・運行情報 */
  var found = post({ action:'scanNow', what:'mail' }).found;
  eq(found.length, 3, 'カード2通と運行情報1通（ほかのメールは読まない）');
  var p1 = found.filter(function(x){ return x.mid === 'm1'; })[0], p2 = found.filter(function(x){ return x.mid === 'm2'; })[0];
  ok(p1 && p1.amount === 1234 && p1.date === '2026-09-18' && p1.card === '楽天カード' && /セブン/.test(p1.shop), '楽天カードのメール');
  ok(p2 && p2.amount === 680 && p2.date === '2026-09-17' && p2.card === '三井住友カード' && /マクドナルド/.test(p2.shop), '三井住友カードのメール（HTML）');
  eq(post({ action:'scanNow', what:'mail' }).found.length, 0, '同じメールは2回読まない');
  var items = post({ action:'inboxTake' }).items;
  ok(items.some(function(x){ return x.kind === 'pay' && x.ref === 'gm-m1'; }), '家計簿へ（二重にならない印つき）');
  ok(items.some(function(x){ return x.kind === 'notice' && /阪神本線/.test(x.text) && !/http/.test(x.text); }), '運行情報のお知らせ（配信停止の案内は入れない）');
  ok(items.some(function(x){ return x.kind === 'task' && x.due === '2026-10-01'; }), 'ショートカットの課題');
  /* 朝の天気（送る直前に入れ直す） */
  var fc0 = fetched.filter(function(f){ return /fcm/.test(f.url); }).length;
  post({ action:'pushRegister', device:'dA', pushToken:'TOKEN_A', name:'iPhone' });
  post({ action:'jobsPut', jobs:[
    { id:'am-1', at:Date.now() - 60000, title:'🎒 今日の持ち物', body:'🎒 白衣\n☔ 傘（降水20%）\n📚 暗記の復習 3枚', push:1, wx:1 }
  ] });
  props.AI_AT = String(Date.now()); props.MAIL_AT = String(Date.now());     /* ここでは通知だけ確かめる（AIは下で） */
  G.tick();
  var fcm = fetched.filter(function(f){ return /fcm/.test(f.url); });
  eq(fcm.length, fc0 + 1, '持ち物の通知を送る');
  eq(JSON.parse(fcm[fcm.length - 1].opt.payload).message.data.body, '🎒 白衣\n🌤 6〜18℃・降水70%\n☔ 傘（降水70%）\n🧥 上着（6〜18℃）\n📚 暗記の復習 3枚', 'その日の天気（予報の行つき）に入れ直す');
  /* AIの読み取り（ショートカットの写真） */
  var r1 = post({ action:'scanNow', what:'ai' });
  eq(r1.done, 1, '写真を読む');
  ok(/患者さん/.test(JSON.stringify(aiPrompts[0])) && aiPrompts[0].contents[0].parts[0].inline_data, '個人情報を書かないよう頼み、ファイルを渡す');
  eq(box.files.length, 0, '読んだ写真は「読んだもの」へ');
  var ai = post({ action:'inboxTake' }).items.filter(function(x){ return x.kind === 'ai'; })[0];
  ok(ai && ai.cards.length === 1 && ai.tasks[0].due === '2026-10-03' && ai.course === '成人看護学概論', 'AIの結果を預かる');
  eq(post({ action:'scanNow', what:'ai' }).done, 0, '同じものは2回読まない');
  /* Goodnotes：名前に「講義」が入るノートだけ・書き足したページだけ */
  var gn = env.DriveApp.createFolder('GoodNotes');
  var sub = gn.createFolder('2年後期');
  var lec = sub.createFile({ name:'成人看護 講義ノート.pdf', mime:'application/pdf', bytes:[37, 80, 68, 70] });
  sub.createFile({ name:'実習記録.pdf', mime:'application/pdf', bytes:[37, 80, 68, 70] });
  aiPrompts.length = 0;
  eq(post({ action:'scanNow', what:'ai' }).done, 1, 'Goodnotesのノートを読む');
  eq(post({ action:'scanNow', what:'ai' }).done, 0, '実習記録は読まない');
  ok(/最後の3ページ/.test(aiPrompts[0].contents[0].parts[1].text), 'はじめてのノートは最後の数ページだけ');
  lec.upd = Date.now() + 60000;
  post({ action:'scanNow', what:'ai' });
  ok(/13ページ目から/.test(aiPrompts[1].contents[0].parts[1].text), '書き足したページだけ読む');
  /* スプレッドシート */
  var sh = post({ action:'sheetSync', sheets:{ '家計簿':[['日付', '金額'], ['2026-09-18', 1234]], 'バイト':[['日付'], ['2026-09-20', 'x', 'y']] } });
  ok(sh.ok && /spreadsheets/.test(sh.url), 'スプレッドシートに書き出す');
  eq(sheetVals['家計簿'][1][1], 1234, '中身');
  eq(sheetVals['バイト'][0].length, 3, '列の数をそろえる');
  ok(!ss.getSheetByName('シート1'), '空の最初のシートは消す');
});

/* テストは何時間ぶんの操作を数分で行うので、重いテストの前に「書きこみすぎ防止」の数え方を始めからにする
   （本当にくり返し書きこむこわれ方は、settle の「落ちつかない」で見つかる） */
function freshWrites(ws){ ws.forEach(function(w){ w.syncState.writes = []; }); }

test('Google連携v3：コードでつなぐ・メールとAIの結果・課題の候補・スプレッドシート（アプリ）', async function(){
  var A = frames.A, B = frames.B, doc = A.document;
  freshWrites([A, B]);
  gasState.ver = 3;
  A.GAS.url = 'https://script.google.com/macros/s/test/exec'; A.GAS.token = 'tok'; A.saveGas();
  A.appId = 'set'; A.S.ui.setOpen = J(A, { gas:1, gasplus:1 }); A.render();
  doc.getElementById('gas_url').value = A.GAS.url; doc.getElementById('gas_token').value = 'tok';
  doc.querySelector('[data-act="gas-save"]').click();
  await until(function(){ return A.GAS.ver === 3; }, 5000, '新しい版とつながる');
  await until(function(){ return A.S.cloud.gasUrl === A.GAS.url; }, 3000, 'URLを同期で配る');
  await until(function(){ return gasState.feat && Array.isArray(gasState.feat.courses); }, 3000, '使う機能を送る');
  /* Bは、まだつながっていない */
  B.GAS.url = ''; B.GAS.token = ''; B.saveGas();
  await settle([A, B]);
  eq(B.gasSharedUrl(), A.GAS.url, 'URLが相手に届く');
  A.render();
  doc.querySelector('[data-act="gas-pair-offer"]').click();
  await until(function(){ return A.GASP.pair && doc.querySelector('.paircode'); }, 3000, 'コードが出る');
  var code = A.GASP.pair.code;
  B.appId = 'set'; B.S.ui.setOpen = J(B, { gasplus:1 }); B.render();
  B.document.getElementById('pair_code').value = '000000';
  B.document.querySelector('[data-act="gas-pair-claim"]').click();
  await sleep(200);
  ok(!B.gasReady(), 'ちがうコードではつながらない');
  B.render();
  B.document.getElementById('pair_code').value = code.slice(0, 3) + ' ' + code.slice(3);
  B.document.querySelector('[data-act="gas-pair-claim"]').click();
  await until(function(){ return B.gasReady() && B.GAS.token === 'tok' && B.GAS.ver === 3; }, 5000, 'コードでつながる');
  /* 橋わたしから届いたもの */
  var now = Date.now();
  gasState.inbox = [
    { id:'m1', kind:'pay', amount:1234, shop:'セブン－イレブン', card:'楽天カード', date:'2026-09-15', ref:'gm-abc', at:now },
    { id:'m1b', kind:'pay', amount:1234, shop:'セブン－イレブン', card:'楽天カード', date:'2026-09-15', ref:'gm-abc', at:now },
    { id:'t1', kind:'task', text:'Discordから足した課題', due:'2026-10-01', at:now },
    { id:'n1', kind:'notice', text:'🚃 【運行情報】阪神本線 遅延\n人身事故の影響で遅れています', at:now },
    { id:'a1', kind:'ai', src:'gn', file:'成人看護 講義ノート.pdf', url:'https://drive.google.com/file/x', course:'成人看護学概論',
      summary:'・呼吸数の正常値\n・観察のポイント', tasks:[{ title:'事前課題を出す', due:'2026-10-02' }], cards:[{ q:'成人の呼吸数は？（v3）', a:'12〜20回/分' }], at:now }
  ];
  await A.inboxPull(true);
  var sp = A.S.spends.filter(function(s){ return s.ref === 'gm-abc'; });
  eq(sp.length, 1, 'カードのメールは二重に入らない');
  ok(sp[0].date === '2026-09-15' && sp[0].amount === 1234 && sp[0].src === 'mail' && sp[0].acct === '楽天カード', 'メールの日付・金額・カード');
  ok(A.S.tasks.some(function(t){ return t.title === 'Discordから足した課題' && t.due === '2026-10-01'; }), 'ショートカット・Discordの課題');
  ok(A.S.notices.some(function(n){ return /阪神本線/.test(n.text); }), '運行情報のお知らせ');
  ok(A.S.cards.some(function(c){ return c.q === '成人の呼吸数は？（v3）' && c.src === 'gn'; }), 'AIの暗記カード');
  ok(A.S.notes.some(function(n){ return /成人看護 講義ノート/.test(n.title) && /呼吸数/.test(n.body); }), '講義メモ');
  eq(A.S.suggests.length, 1, '課題は「候補」として出す');
  ok(!A.S.tasks.some(function(t){ return t.title === '事前課題を出す'; }), 'まだ課題には入れない');
  A.appId = 'todo'; A.render();
  ok(doc.querySelector('[data-act="sg-add"]'), 'ToDoの上に候補が出る');
  doc.querySelector('[data-act="sg-add"]').click();
  ok(A.S.tasks.some(function(t){ return t.title === '事前課題を出す' && t.due === '2026-10-02'; }), '見てから課題に追加');
  eq(A.S.suggests.length, 0, '候補は消える');
  /* 使う機能・カギ・スプレッドシート */
  A.appId = 'set'; A.S.ui.setOpen = J(A, { gasplus:1 }); A.render();
  doc.querySelector('[data-act="gf-set"][data-k="mailCard"]').click();
  await until(function(){ return gasState.feat && gasState.feat.mailCard === 1; }, 3000, 'カードのメールをオン');
  A.S.settings.geminiKey = 'AIzaSyTESTKEY_abcdefghijklmnopqrstu';
  A.render();
  doc.querySelector('[data-act="gas-ai-key"]').click();
  await until(function(){ return gasState.aiKey === 'AIzaSyTESTKEY_abcdefghijklmnopqrstu' && A.GAS.ai === 1; }, 3000, 'AIのカギを預ける');
  A.S.settings.geminiKey = '';
  doc.querySelector('[data-act="gas-sheet"]').click();
  await until(function(){ return gasState.sheets && A.S.cloud.sheet; }, 3000, 'スプレッドシートに書き出す');
  eq(gasState.sheets['家計簿'][0][0], '日付', '家計簿の見出し');
  ok(gasState.sheets['暗記カード'].length > 1, '暗記カードも書き出す');
  /* ウィジェット・Discord用のまとめに「明日」と暗記 */
  var s = A.buildSummary();
  ok(s.tomorrow && Array.isArray(s.tomorrow.lines) && s.study && typeof s.study.due === 'number', '明日と暗記のまとめ');
  await settle([A, B]);
  eq(B.S.suggests.length, 0, '候補を消したのも届く');
  /* もとにもどす（あとの暗記のテストのために、作ったカードも片づける） */
  A.S.cards.filter(function(c){ return /（v3）/.test(c.q); }).forEach(function(c){ A.removeItem('cards', c.id); });
  A.commit();
  await settle([A, B]);
  eq(B.S.cards.filter(function(c){ return /（v3）/.test(c.q); }).length, 0, '片づけ');
  gasState.ver = 2; gasState.feat = null; gasState.sheets = null; gasState.aiKey = null;
  A.GAS.url = ''; A.GAS.token = ''; A.saveGas();
  B.GAS.url = ''; B.GAS.token = ''; B.saveGas();
});

test('エラーの記録・新しい版のお知らせ・写真を大きく見る', async function(){
  var A = frames.A;
  A.logErr('テスト', 'わざと記録');
  ok(A.errLogAll().some(function(x){ return x.m === 'わざと記録'; }), '記録されない');
  A.eval("setTimeout(function(){ throw new Error('画面のわざとのエラー'); }, 0)");
  await sleep(100);
  ok(A.errLogAll().some(function(x){ return /画面のわざとのエラー/.test(x.m); }), '画面のエラーが記録されない');
  ok(A.CHANGELOG[0].build === A.APP_BUILD && A.whatsNewHtml(A.APP_BUILD).indexOf('お知らせはありません') < 0, 'この版のお知らせがある');
  A.showWhatsNew();
  ok(A.document.getElementById('whatsnew').classList.contains('on'), 'お知らせが出ない');
  A.closeWhatsNew();
  eq(A.SYNC_LOCAL.seenBuild, A.APP_BUILD, '見た印');
  ok(A.document.getElementById('viewer'), '写真を見る画面がある');
});

test('見た目：画面のスタイルとキャラクターを選べて、相手にも届く', async function(){
  var A = frames.A, B = frames.B, doc = A.document;
  A.S.ui.setOpen = J(A, { s1:1, chara:1 }); A.appId = 'set'; A.render();
  eq(doc.querySelectorAll('.stylegrid:not(.fontgrid) button').length, A.UI_STYLES.length, 'スタイルの見本の数');
  doc.querySelector('[data-act="set-style"][data-v="liquid"]').click();
  eq(doc.body.getAttribute('data-style'), 'liquid', 'スタイルが変わる');
  /* どのスタイルでも、どの画面もこわれない */
  var errs = [];
  A.UI_STYLES.forEach(function(s){
    A.S.ui.style = s.id; A.applyUi();
    ['today', 'money', 'tt', 'set', 'chat'].forEach(function(a){ try{ A.appId = a; A.render(); }catch(e){ errs.push(s.id + '/' + a + '：' + e.message); } });
  });
  ok(!errs.length, errs.join('\n'));
  A.S.ui.style = 'glass'; A.applyUi();
  ok(!doc.body.hasAttribute('data-style'), 'いつものにもどすと印が消える');
  A.S.ui.style = 'liquid'; A.applyUi();

  /* キャラクター */
  var bad = [], P = new A.DOMParser();
  var check = function(opt, tag){
    var h = A.charaSvg(opt);
    var svg = h.slice(h.indexOf('<svg'), h.lastIndexOf('</svg>') + 6).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    if(/NaN|undefined/.test(svg) || P.parseFromString(svg, 'image/svg+xml').getElementsByTagName('parsererror').length) bad.push(tag);
  };
  ok(A.CHARAS.length >= 35, 'キャラの数：' + A.CHARAS.length);
  eq(new Set(A.CHARAS.map(function(k){ return k.id; })).size, A.CHARAS.length, 'キャラのIDが重なっている');
  A.CHARAS.forEach(function(k){
    A.CHARA_EXPRS.forEach(function(ex){ check({ id:k.id, expr:ex[0], hat:'' }, k.id + '/' + ex[0]); });
    A.CHARA_PROPS.forEach(function(pr){ check({ id:k.id, prop:pr, hat:'' }, k.id + '/' + pr); });
    A.CHARA_HATS.forEach(function(ht){ check({ id:k.id, hat:ht.id }, k.id + '/' + ht.id); });
  });
  ok(!bad.length, '絵がこわれている：' + bad.slice(0, 5).join(', '));
  /* 絵のタッチ */
  A.S.ui.chara = J(A, { level:2, touch:'pencil' });
  ok(/filter="url\(#chPencil\)"/.test(A.charaSvg({ id:'kuma' })) && doc.getElementById('chPencil'), '手がき風');
  A.S.ui.chara = J(A, { level:2 });

  /* 自分の画像から作る */
  var cv = doc.createElement('canvas'); cv.width = cv.height = 64;
  var cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, 64, 64);
  cx.fillStyle = '#e04060'; cx.beginPath(); cx.arc(32, 32, 16, 0, 7); cx.fill();
  var cv2 = doc.createElement('canvas'); cv2.width = cv2.height = 64; cv2.getContext('2d').drawImage(cv, 0, 0);
  ok(A.charaCutBg(cv2.getContext('2d'), 64, 64, 60), '背景を消す');
  var px = cv2.getContext('2d').getImageData(0, 0, 64, 64).data;
  eq(px[3], 0, 'すみは透明になる');
  eq(px[(32 * 64 + 32) * 4 + 3], 255, 'まんなかは残る');
  A.chMake = { edit:'', name:'テストの子', tic:'てす', like:'いちご', note:'', src:null, bg:1, zoom:70, cx:.5, cy:.5 };
  A.charaMakeEl(); A.charaMakeSetImage(cv, cv.toDataURL('image/png'));
  ok(doc.getElementById('chmk_prev') && doc.getElementById('chmk_box'), '切りぬきの画面');
  await A.charaMakeSave();
  var mine = A.charaCustomList();
  eq(mine.length, 1, '自分の子が増える');
  eq(A.charaNow().id, mine[0].id, '作った子になる');
  ok(/てす/.test(A.chatSystem()) || A.charaLevel() < 3, '口ぐせ');
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  await until(function(){ var im = doc.querySelector('.hero .chara.chimg img'); return im && /^data:image\/png/.test(im.src || ''); }, 4000, '自分の子の画像が出る');
  A.settingsAction('img-orphan', { dataset:{} });
  await sleep(300);
  ok(await A.photoGetLocal(mine[0].pid), '写真の片づけで消えない');
  await settle([A, B]);
  eq(B.charaCustomList().length, 1, '自分の子が相手に届く');
  ok(await B.photoGet(mine[0].pid), '画像も相手に届く');
  A.charaCatNow = 'all';
  A.appId = 'set'; A.render();
  doc.querySelector('[data-act="chara-level"][data-v="3"]').click();
  eq(A.charaLevel(), 3, '出てくる量');
  ok(doc.getElementById('buddy'), 'たっぷりでは、すみに子がいる');
  doc.querySelector('[data-act="chara-pick"][data-id="koro"]').click();
  eq(A.charaNow().id, 'koro', '選んだ子になる');
  ok(/ハムッ/.test(A.chatSystem()), '相談もその子の口調になる');
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(doc.querySelector('.hero .chhero svg'), '今日の画面にあいさつが出る');
  A.charaCheer('テスト', 'cheer');
  ok(doc.getElementById('chpop').classList.contains('on'), 'お祝いが出る');
  A.appId = 'chat'; A.render();
  ok(!doc.getElementById('buddy'), '相談の画面では、すみの子はかくれる');
  await settle([A, B]);
  eq(B.S.ui.style, 'liquid', 'スタイルが相手に届く');
  eq(B.document.body.getAttribute('data-style'), 'liquid', '相手の画面も変わる');
  eq(B.charaNow().id, 'koro', 'キャラが相手に届く');
  /* めいっぱい */
  A.appId = 'set'; A.render();
  doc.querySelector('[data-act="chara-level"][data-v="5"]').click();
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(doc.querySelector('#apptitle .chmini'), '見出しに小さな子');
  eq(doc.querySelectorAll('.hero .chpals .chara').length, 2, '仲間があいさつに来る');
  A.appId = 'tt'; A.render();
  /* 土日は、時間割に「今日」の列がないことがある */
  var ttDow = new Date().getDay();
  ok(doc.querySelector('th.today .ttch') || A.ttWeek || (!doc.querySelector('th.today') && (ttDow === 0 || ttDow === 6)), '時間割の今日');
  A.charaReact('ev-save');
  ok(doc.getElementById('chpop').classList.contains('short'), '操作に反応する');
  A.charaWalk();
  A.charaAction('chara-hat', { dataset:{ v:'ribbon' } });
  eq(A.charaHatNow(), 'ribbon', '着せかえ');
  A.appId = 'set'; A.S.ui.setOpen = J(A, { chara:1 }); A.render();
  eq(doc.querySelectorAll('.hatgrid button').length, A.CHARA_HATS.length + 2, '着せかえの一覧');
  eq(doc.querySelectorAll('.chexpr .chex').length, A.CHARA_EXPRS.length, '表情の一覧');
  A.confirm = function(){ return true; };
  A.charaMakeDelete(mine[0].id);
  eq(A.charaCustomList().length, 0, '自分の子を消せる');
  A.appId = 'set'; A.render();
  doc.querySelector('[data-act="chara-level"][data-v="0"]').click();
  A.appId = 'today'; A.render();
  ok(!doc.getElementById('buddy') && !doc.querySelector('.chhero'), 'なしにすると出ない');
  /* もとにもどす */
  A.S.ui.style = 'glass'; A.S.ui.chara = J(A, { level:2 }); A.touch('ui'); A.applyUi(); A.commit();
  await settle([A, B]);
});

test('見た目：文字の形（フォント）を選べて、相手にも届く', async function(){
  var A = frames.A, B = frames.B, doc = A.document;
  A.S.ui.setOpen = J(A, { s1:1 }); A.appId = 'set'; A.render();
  eq(doc.querySelectorAll('.fontgrid button').length, A.UI_FONTS.length, 'フォントの見本の数');
  eq(new Set(A.UI_FONTS.map(function(f){ return f.id; })).size, A.UI_FONTS.length, 'フォントのIDが重なっている');
  ok(!doc.querySelector('link[id^="gf-"]'), 'テストではネットから文字を読みこまない');
  doc.querySelector('[data-act="set-font"][data-v="klee"]').click();
  eq(doc.body.getAttribute('data-font'), 'klee', 'フォントが変わる');
  ok(/Klee One/.test(A.getComputedStyle(doc.body).fontFamily), '画面の文字に使われる');
  ok(/Klee One/.test(A.getComputedStyle(doc.querySelector('.pillrow button') || doc.body).fontFamily), 'ボタンの文字にも使われる');
  ok(doc.querySelector('[data-act="set-font"][data-v="klee"]').classList.contains('on'), '選んだものに印');
  await settle([A, B]);
  eq(B.S.ui.font, 'klee', 'フォントが相手に届く');
  eq(B.document.body.getAttribute('data-font'), 'klee', '相手の画面も変わる');
  /* もとにもどす */
  A.appId = 'set'; A.render();
  doc.querySelector('[data-act="set-font"][data-v="std"]').click();
  ok(!doc.body.hasAttribute('data-font') && !doc.body.style.getPropertyValue('--ff'), 'いつものにもどすと印が消える');
  await settle([A, B]);
  ok(!B.document.body.hasAttribute('data-font'), '相手もいつものにもどる');
});

test('家計簿：CSVの読みこみ（二重に入らない）・手入力・相手に届く', async function(){
  var A = frames.A, B = frames.B;
  /* 楽天銀行のような形（入出金が1列） */
  var csv1 = '﻿取引日,入出金(円),取引後残高(円),入出金内容\r\n20260901,-1200,50000,セブンイレブン\r\n20260902,80000,130000,給与 デリフランス\r\n';
  var rows = A.kbParseCsv(csv1);
  var g = A.kbGuessRoles(rows);
  eq(g.head, 0, '見出しの行');
  eq(g.roles.join(','), 'date,signed,,title', '列の役目');
  var items = A.kbRowsToItems(rows, g.roles, g.head, '楽天銀行');
  eq(items.length, 2, '行の数');
  eq(items[0].io + items[0].amount + items[0].cat, 'out1200food', '支出と分類');
  eq(items[1].io, 'in', '入金');
  /* 見出しのないカードのCSV */
  var csv2 = '2026/09/03,"ＪＲ西日本　定期",12,340円,1,,12340\n2026/09/04,Amazon.co.jp,"3,980",,,,\n';
  var rows2 = A.kbParseCsv(csv2), g2 = A.kbGuessRoles(rows2);
  eq(g2.roles[0] + g2.roles[1], 'datetitle', '見出しなしでも日付と内容');
  var before = (A.S.spends || []).length;
  items.forEach(function(o){ A.kbAdd(o); });
  items.forEach(function(o){ A.kbAdd(o); });
  eq(A.S.spends.length, before + 2, '同じ明細は二重に入らない');
  A.appId = 'money'; A.payTab = 'kakeibo'; A.kbYm = '2026-09'; A.render();
  ok(A.document.querySelector('.kbbars .kbbar'), '分類ごとの帯');
  A.document.getElementById('kb_amt').value = '450';
  A.document.getElementById('kb_title').value = 'ローソン';
  A.document.querySelector('[data-act="kb-add"][data-io="out"]').click();
  ok(A.S.spends.some(function(x){ return x.title === 'ローソン' && x.amount === 450; }), '手入力');
  await settle([A, B]);
  eq(B.S.spends.length, A.S.spends.length, '家計簿が相手に届く');
});

test('そうだん：頼むとそのまま手帳に入る（取り消せる）・ネットで調べた出典', async function(){
  var A = frames.A;
  A.appId = 'chat'; A.chatRoom = 'main'; A.render();
  var nEv = A.S.events.length, nSp = (A.S.spends || []).length;
  await A.chatSend('10月20日10時に歯医者を登録して。あとコンビニで580円使ったのも記録して');
  var m = A.roomMsgs()[A.roomMsgs().length - 1];
  eq((m.ops || []).length, 2, '入れたものの記録');
  eq(A.S.events.length, nEv + 1, '予定が入る');
  eq(A.S.spends.length, nSp + 1, '家計簿に入る');
  ok(A.S.events.some(function(e){ return e.title === '歯医者' && e.date === '2026-10-20' && e.time === '10:00'; }), '予定の中身');
  A.render();
  A.document.querySelector('[data-act="chat-undo"]').click();
  eq(A.S.events.length, nEv, '取り消すと予定が消える');
  eq(A.S.spends.length, nSp, '取り消すと家計簿も消える');
  /* 登録を頼んでいないときは道具を渡しても使われない（にせAIは登録しない） */
  A.S.ui.aiDirect = 0;
  await A.chatSend('歯医者を登録して');
  eq(A.S.events.length, nEv, 'オフのときは入れない');
  A.S.ui.aiDirect = 1;
  /* URLつき・調べて → 検索とURLの道具 */
  aiCalls.length = 0;
  await A.chatSend('https://example.com/news を読んで調べて');
  var call = aiCalls.filter(function(c){ return c.tag === 'chat'; }).pop();
  ok(call.tools.indexOf('google_search') >= 0 && call.tools.indexOf('url_context') >= 0, '検索とURLの道具');
  var m2 = A.roomMsgs()[A.roomMsgs().length - 1];
  eq((m2.src || []).length, 1, '出典（http以外は出さない）');
  A.render();
  ok(A.document.querySelector('.aisrc a[href="https://example.com/a"]'), '出典のリンク');
  ok(A.document.querySelector('iframe.aisep[sandbox]'), '検索の候補は安全な枠で出す');
  eq(A.lenRule(), A.lenRuleAuto(), '答えの長さはおまかせ');
});

test('Google連携：通知の予定・ショートカットの記録・ウィジェット・ToDo', async function(){
  var A = frames.A, B = frames.B;
  A.GAS.url = 'https://script.google.com/macros/s/test/exec'; A.GAS.token = 'tok'; A.saveGas();
  /* 通知の予定 */
  var due = A.shiftDate(A.today(), 2);
  A.S.tasks.push(J(A, { id:'tk_nt', title:'看護レポート', subject:'', due:due, time:'', done:0, memo:'', subs:[], photos:[], mt:Date.now() }));
  A.notifySet({ push:1, discord:1, quiet:0 });
  await A.notifyPush(true);
  var ids = gasState.jobs.map(function(j){ return j.id; });
  ok(ids.indexOf('d1-tk_nt-' + due) >= 0 && ids.indexOf('d0-tk_nt-' + due) >= 0, '前日と当日の締切通知');
  ok(gasState.jobs.every(function(j){ return j.push === 1 && j.discord === 1 && j.at > Date.now(); }), 'スマホとDiscordに、これからの時刻で');
  /* ショートカットから届いた記録 */
  await A.linksMakeKey();
  ok(A.shortKey().length >= 16, '短い合言葉');
  var d = new Date(); d.setHours(12, 0, 0, 0);
  gasState.inbox = [
    { id:'in1', kind:'pay', amount:720, shop:'ファミリーマート', card:'Suica', at:d.getTime() },
    { id:'in1', kind:'pay', amount:720, shop:'ファミリーマート', card:'Suica', at:d.getTime() },
    { id:'in2', kind:'memo', text:'薬局で目薬', at:d.getTime() }
  ];
  var sp0 = A.S.spends.length, nt0 = A.S.notes.length;
  await A.inboxPull(true);
  eq(A.S.spends.length, sp0 + 1, 'Apple Payの記録（同じものは1回）');
  ok(A.S.spends.some(function(x){ return x.src === 'wallet' && x.cat === 'food'; }), '分類も自動');
  eq(A.S.notes.length, nt0 + 1, 'メモ');
  /* 学校に着いた → 出席 */
  var ymd = A.today(), cls = A.schoolClassesForDate(ymd);
  if(cls.length){
    cls.forEach(function(c){ A.S.attendLog[c.name] = (A.S.attendLog[c.name] || []).filter(function(x){ return x.date !== ymd; }); });
    var st = A.minutesOf(A.S.commute.periods[cls[0].period - 1]);
    var msg = A.arriveAttend(ymd, st + 20);
    ok(/遅刻/.test(msg), '始まったあとに着いたら遅刻');
  }
  /* ウィジェットと目覚まし */
  await A.summaryPush(true);
  ok(gasState.summary && Array.isArray(gasState.summary.lines) && gasState.summary.alarm, 'まとめを送る');
  var al = A.alarmPlan();
  if(A.schoolClassesForDate(al.date).length) ok(/^\d{2}:\d{2}$/.test(al.time), '目覚ましの時刻');
  ok(/Script\.setWidget/.test(A.scriptableCode()) && A.scriptableCode().indexOf(A.shortKey()) >= 0, 'ウィジェットのプログラム');
  /* Google ToDo */
  A.linkPrefSet({ tasks:1 });
  gasState.taskChanges = [{ k:'tk-tk_nt', title:'看護レポート（直した）', done:1, due:due, notes:'' }];
  gasState.taskCreated = [{ k:'g-abc', title:'Googleで足した', done:0, due:'2026-11-01', notes:'' }];
  await A.tasksSync(true);
  ok(gasState.taskItems.some(function(x){ return x.k === 'tk-tk_nt'; }), '課題を送る');
  var t1 = A.S.tasks.filter(function(t){ return t.id === 'tk_nt'; })[0];
  ok(t1.done === 1 && /直した/.test(t1.title), 'Googleで直したものが入る');
  ok(A.S.tasks.some(function(t){ return t.gk === 'g-abc'; }), 'Googleで足したものが入る');
  await A.tasksSync(true);
  ok(gasState.taskItems.some(function(x){ return x.k === 'g-abc'; }), '次からは同じキーで送る');
  await settle([A, B]);
  eq(B.shortKey(), A.shortKey(), '短い合言葉はほかの端末でも同じ');
  A.linkPrefSet({ tasks:0 });
  A.GAS.url = ''; A.GAS.token = ''; A.saveGas();
  A.commit();
  await settle([A, B]);
});

test('キャラ：どの子も1日200種類以上のセリフ・AIのセリフ', async function(){
  var A = frames.A;
  var few = A.CHARAS.filter(function(k){ return A.charaDayPool(k.id).total < 200; }).map(function(k){ return k.id + ':' + A.charaDayPool(k.id).total; });
  ok(!few.length, '200種類に足りない：' + few.join(', '));
  var p1 = A.charaDayPool('koro', '2026-10-01'), p2 = A.charaDayPool('koro', '2026-10-02');
  ok(p1.any.join('|') !== p2.any.join('|'), '日によって並びが変わる');
  ok(p1.any.some(function(s){ return /ハムッ/.test(s); }), 'その子の口ぐせ');
  var base = A.charaDayPool('mochi').total;
  A.S.ui.chara = J(A, { level:2, aiTalk:1 });
  await A.charaTalkAi('mochi');
  ok(A.S.charaTalk[A.today() + ':mochi'], 'AIのセリフをしまう');
  ok(A.charaDayPool('mochi').total >= base + 200, 'AIのセリフがふえる（' + A.charaDayPool('mochi').total + '）');
  ok(A.charaDayPool('mochi').ai, 'AIのセリフ入りの印');
  ok(A.charaLine('greet').length > 0, 'あいさつ');
});

test('おせわ：たまご→生まれる・ごはん・時間でおなかがすく・ミニゲーム', async function(){
  var A = frames.A, B = frames.B, doc = A.document;
  A.appId = 'pet'; A.render();
  var id = A.petActiveId();
  if(!A.petNow(id)) doc.querySelector('[data-act="pet-adopt"]').click();
  ok(A.petNow(id), 'たまごをもらう');
  A.appId = 'pet'; A.render();
  while(A.petNow(id).stage === 0) doc.querySelector('[data-act="pet-warm"]').click();
  eq(A.petNow(id).stage, 1, '生まれる');
  /* 見るだけでは変わらない */
  var snap = JSON.stringify(A.S.pets);
  A.render(); A.render();
  eq(JSON.stringify(A.S.pets), snap, '見るだけでは書きかえない');
  /* 時間がたつと、おなかがすく */
  A.S.pets[id].at = Date.now() - 10 * 3600000;
  A.S.pets[id].hun = 80;
  ok(A.petNow(id).hun <= 41, '10時間でおなかがすく');
  eq(A.petMood(A.petNow(id)).expr === 'normal' || A.petNow(id).hun < 50, true, 'ようすが変わる');
  /* ごはん（コインが減る） */
  A.S.pets._ = J(A, Object.assign({}, A.petMeta(), { bonus:500 }));
  var c0 = A.petCoins(), h0 = A.petNow(id).hun;
  A.petPanel = 'food'; A.render();
  doc.querySelector('[data-act="pet-feed"][data-v="onigiri"]').click();
  eq(A.petCoins(), c0 - 10, 'コインが減る');
  ok(A.petNow(id).hun > h0, 'おなかがふくれる');
  /* おせわおやすみ：時間を止める */
  doc.querySelector('[data-act="pet-pause"]').click();
  A.S.pets[id].at = Date.now() - 20 * 3600000;
  var frozen = A.S.pets[id].hun;
  eq(A.petNow(id).hun, frozen, 'おやすみ中は下がらない');
  doc.querySelector('[data-act="pet-pause"]').click();
  /* ミニゲーム */
  A.petGameStart('star');
  ok(doc.getElementById('petgame').classList.contains('on'), 'ゲームの画面');
  A.petGame.score = 7;
  var c1 = A.petCoins();
  A.petGameEnd(false);
  eq(A.petCoins(), c1 + 7, 'とった数だけコイン');
  A.petGameStart('memory');
  eq(doc.querySelectorAll('.pgcard').length, 12, 'カード12まい');
  A.petGameEnd(true);
  ok(!doc.getElementById('petgame').classList.contains('on'), 'ゲームを閉じる');
  await settle([A, B]);
  eq(B.petNow(id) && B.petNow(id).stage, A.petNow(id).stage, 'おせわの様子が相手に届く');
});

test('暗記：AIでカードを作る・忘れにくい順に出す・相手に届く・おせわのごほうび', async function(){
  var A = frames.A, B = frames.B, doc = A.document;
  freshWrites([A, B]);
  /* 次に出す日のきまり */
  var fresh = { reps:0, ivl:0, ease:2.5 };
  eq(A.ankiNext(fresh, 2, '2026-10-01').due, '2026-10-02', 'はじめて「おぼえた」は次の日');
  eq(A.ankiNext(fresh, 3, '2026-10-01').ivl, 3, 'はじめて「かんたん」は3日後');
  eq(A.ankiNext({ reps:2, ivl:6, ease:2.5 }, 2, '2026-10-01').ivl, 15, 'くり返すほど間があく');
  var lapse = A.ankiNext({ reps:3, ivl:15, ease:2.5 }, 0, '2026-10-01');
  ok(lapse.ivl === 0 && lapse.reps === 0 && lapse.lapses === 1 && lapse.ease < 2.5, '忘れたら最初から');
  /* AIで作る（見てから追加） */
  A.appId = 'anki'; A.ankiState.mode = ''; A.render();
  ok(doc.querySelector('[data-act="anki-ai-file"]'), '写真・PDFをえらぶボタン');
  await A.ankiMakeFrom([], '講義のまとめ：成人の呼吸数は12〜20回/分。体温は36〜37℃。');
  ok(A.ankiState.preview, 'できたカードを見られる');
  eq(A.ankiState.preview.cards.length, 5, '同じ問い・答えのない問いは入れない');
  var call = aiCalls.filter(function(c){ return c.tag === 'anki'; }).pop();
  ok(call && /患者さん/.test(JSON.stringify(call.contents)), '個人の情報を入れないように頼む');
  doc.querySelector('[data-act="anki-pv-toggle"][data-i="4"]').click();
  doc.querySelector('[data-act="anki-pv-add"]').click();
  eq(A.S.cards.length, 4, 'チェックしたものだけ入る');
  eq(A.S.cards[0].deck, '成人看護学概論', '科目');
  /* 勉強する */
  eq(A.ankiDueList('').length, 4, '新しいカードが出る');
  var coins0 = A.petCoins();
  doc.querySelector('[data-act="anki-start"]').click();
  eq(A.ankiState.mode, 'study', '勉強の画面');
  doc.querySelector('[data-act="anki-show"]').click();
  ok(doc.querySelector('.ankia'), '答えが出る');
  doc.querySelector('[data-act="anki-grade"][data-v="0"]').click();
  ok(A.ankiPushTimer, '1まいごとには同期せず、まとめて送る（書きこみすぎ防止で止まらないように）');
  for(var i = 0; i < 4; i++){
    doc.querySelector('[data-act="anki-show"]').click();
    doc.querySelector('[data-act="anki-grade"][data-v="2"]').click();
  }
  eq(A.ankiState.mode, 'done', '「もう一回」のカードも最後に出て、ぜんぶ終わる');
  eq(A.ankiCountOn(A.today()), 5, '見た枚数');
  eq(A.ankiDueList('').length, 0, '今日の分はおわり');
  ok(A.S.cards.every(function(c){ return c.due === A.shiftDate(A.today(), 1); }), '次は明日');
  eq(A.petCoins(), coins0 + 5, '暗記のごほうびコイン');
  eq(A.ankiStreak(), 1, '連続の日数');
  /* 自分で書く */
  doc.querySelector('[data-act="anki-home"]').click();
  doc.getElementById('anki_newdeck').value = '解剖生理学';
  doc.getElementById('anki_q').value = '心臓の弁の数は？';
  doc.getElementById('anki_a').value = '4つ';
  doc.querySelector('[data-act="anki-add"]').click();
  eq(A.S.cards.length, 5, '自分で書いたカード');
  ok(A.ankiDecks().some(function(d){ return d.name === '解剖生理学'; }), '新しい科目');
  /* 相手に届く・消す */
  await settle([A, B]);
  eq(B.S.cards.length, 5, 'カードが相手に届く');
  eq(B.ankiCountOn(B.today()), 5, '勉強した枚数も届く');
  A.appId = 'anki'; A.ankiState.mode = ''; A.render();
  doc.querySelector('[data-act="anki-list"][data-deck="解剖生理学"]').click();
  doc.querySelector('[data-act="anki-del"]').click();
  eq(A.S.cards.length, 4, '消せる');
  await settle([A, B]);
  eq(B.S.cards.length, 4, '消したのも届く');
});

test('おせわ：育つとすがたが変わる・ミッション・クイズ・2台でもコインが消えない', async function(){
  var A = frames.A, B = frames.B, doc = A.document;
  freshWrites([A, B]);
  var id = A.petActiveId();
  ok(A.petNow(id) && A.petNow(id).stage >= 1, '前のテストで生まれている');
  /* 育つ（こども → ごほうび・ベレー帽） */
  var c0 = A.petCoins();
  A.petUpdate(id, function(o){ o.exp = 85; });
  eq(A.petNow(id).stage, 2, 'こどもになる');
  eq(A.petCoins(), c0 + 50, '育ったごほうび');
  ok(/こどもになったよ/.test(A.petLevelMsg), '育ったことを知らせる');
  A.petSay('テスト');
  eq(A.petLevelMsg, '', 'セリフで知らせたら消える');
  ok(/petstage s2/.test(A.petSvg(id, A.petNow(id), 100)), 'すがたが変わる');
  A.commit();
  /* ミッション */
  A.appId = 'pet'; A.petPanel = ''; A.render();
  ok(doc.querySelector('[data-act="pet-claim"][data-v="visit"]'), '「会いにくる」は受けとれる');
  var c1 = A.petCoins();
  doc.querySelector('[data-act="pet-claim"][data-v="visit"]').click();
  eq(A.petCoins(), c1 + 5, 'ミッションのコイン');
  ok(!doc.querySelector('[data-act="pet-claim"][data-v="visit"]'), '2回はもらえない');
  eq(A.petMissionClaim('visit'), 0, '2回目は0まい');
  eq(A.petMissionClaim('anki'), 0, 'まだできていないミッションはもらえない');
  /* おべんきょうクイズ */
  A.ankiAddMany('テスト', [{ q:'問1', a:'答1' }, { q:'問2', a:'答2' }, { q:'問3', a:'答3' }, { q:'問4', a:'答4' }], 'hand');
  A.petUpdate(id, function(o){ o.eng = 90; o.sleep = 0; });
  A.commit();
  A.petGameStart('quiz');
  eq(doc.querySelectorAll('#petgame .pgch').length, 4, '4択');
  var q = A.petGame.qs[0];
  var right = Array.prototype.filter.call(doc.querySelectorAll('#petgame .pgch'), function(b){ return b.textContent === q.a; })[0];
  var n0 = A.ankiCountOn(A.today());
  right.click();
  eq(A.petGame.score, 1, 'せいかい');
  eq(A.ankiCountOn(A.today()), n0 + 1, 'クイズも暗記の枚数に入る');
  await until(function(){ return A.petGame && A.petGame.i === 1; }, 3000, '次の問題');
  var c2 = A.petCoins();
  A.petGameEnd(true);
  eq(A.petCoins(), c2 + 3, 'クイズのコイン');
  /* 2台で同時にコインを使っても消えない */
  await settle([A, B]);
  var base = A.petCoins();
  eq(B.petCoins(), base, 'コインがそろう');
  A.petDayAdd('spent', 10); A.commit();
  B.petDayAdd('spent', 20); B.commit();
  await settle([A, B]);
  eq(A.petCoins(), base - 30, 'どちらの分も残る（こちら）');
  eq(B.petCoins(), base - 30, 'どちらの分も残る（相手）');
});

test('通知：朝の持ち物（持参・きまり・暗記）・おせわのおなか', async function(){
  var A = frames.A, doc = A.document;
  var d = A.shiftDate(A.today(), 2);
  A.S.events.push(J(A, { id:'ev_am1', date:d, title:'★ 履修便覧、タブレット、パソコン持参', subject:'', kind:'imp', mt:Date.now() }));
  A.S.events.push(J(A, { id:'ev_am2', date:d, title:'病院実習オリエンテーション', kind:'other', mt:Date.now() }));
  A.commit();
  var items = A.morningItems(d);
  ok(['履修便覧', 'タブレット', 'パソコン'].every(function(x){ return items.indexOf(x) >= 0; }), '「持参」から：' + items.join('・'));
  ok(items.indexOf('白衣') >= 0 && items.indexOf('聴診器') >= 0, 'きまりから（実習）');
  ok(A.morningLines(d).some(function(l){ return /暗記の復習/.test(l); }), '暗記の復習の枚数');
  A.notifySet({ am:1, amTime:'06:45', amSet:1, push:1, pet:1, quiet:1 });      /* amSet … 自分で時刻を保存した印 */
  var jobs = A.notifyJobs();
  var j = jobs.filter(function(x){ return x.id === 'am-' + d; })[0];
  ok(j && j.wx === 1 && /白衣/.test(j.body) && j.body.length <= 400, '持ち物の通知（送る前に天気を入れ直す印つき）');
  eq(new Date(j.at).getHours() * 60 + new Date(j.at).getMinutes(), 6 * 60 + 45, '知らせる時刻');
  ok(jobs.some(function(x){ return /^pet-h-/.test(x.id); }), 'おなかがすく前に知らせる');
  ok(jobs.filter(function(x){ return /^pet-/.test(x.id); }).every(function(x){ var m = new Date(x.at).getHours() * 60 + new Date(x.at).getMinutes(); return m >= 360 && m <= 1410; }), 'おせわの通知は夜中に送らない');
  /* 設定画面でのきまりの保存 */
  A.appId = 'set'; A.S.ui.setOpen = J(A, { notify:1 }); A.render();
  if(doc.getElementById('nt_rules')){
    doc.getElementById('nt_rules').value = '病院＝上ばき\nこわれた(＝むし';
    doc.querySelector('[data-act="nt-am-save"]').click();
    eq(A.amRules().length, 1, 'まちがった書き方は入れない');
    ok(A.morningItems(d).indexOf('上ばき') >= 0, '新しいきまり');
    A.notifySet({ amRules:null });
  }
  A.removeItem('events', 'ev_am1'); A.removeItem('events', 'ev_am2'); A.commit();
});

test('週のふりかえり：AIで書く・AIなしでもまとめる・相手に届く', async function(){
  var A = frames.A, B = frames.B;
  var mon = A.shiftDate(A.monOfYmd(A.today()), -7);
  await A.weekReviewMake(mon, false);
  ok(A.S.weekReview[mon] && /よかったこと/.test(A.S.weekReview[mon].text), 'AIのふりかえり');
  var st = A.weekStats(mon);
  ok(/出席/.test(A.weekReviewTemplate(st)), 'AIなしのまとめ');
  A.weekOff = 0; A.appId = 'today'; A.todayTab = 'week'; A.render();
  ok(A.document.querySelector('.wkrev'), '今週の画面に出る');
  await settle([A, B]);
  ok(B.S.weekReview[mon], 'ふりかえりが相手に届く');
});

test('写真：大きい写真は小さくして送る・Firebase Storage でも届く', async function(){
  var A = frames.A, B = frames.B;
  /* 大きい写真を作る */
  var cv = A.document.createElement('canvas'); cv.width = 2400; cv.height = 1800;
  var cx = cv.getContext('2d');
  for(var i = 0; i < 400; i++){ cx.fillStyle = 'hsl(' + (i * 37 % 360) + ',70%,' + (30 + i % 50) + '%)'; cx.fillRect((i * 97) % 2400, (i * 61) % 1800, 120, 90); }
  var big = cv.toDataURL('image/jpeg', 0.98);
  ok(big.length > 350000, 'テスト用の写真が大きい（' + big.length + '）');
  A.SYNC_LOCAL.photoSize = 'small';
  var small = await A.photoShrinkForSync('p_big', big);
  ok(small.length < big.length, '小さくなる（' + big.length + '→' + small.length + '）');
  eq(await A.photoShrinkForSync('chimg_x', big), big, 'キャラの画像はそのまま');
  /* Storage に送る */
  A.SYNC_LOCAL.photoStore = 'storage';
  await A.photoPut('p_st1', big);
  await until(function(){ var m = A.photoCloud.index['p_st1']; return m && m.st; }, 8000, 'Storageに送る');
  ok(stStore['p_st1'] && stStore['p_st1'].length < big.length, 'Storageには小さくした写真');
  await settle([A, B]);
  var got = await B.photoGet('p_st1');
  ok(got && got.length === stStore['p_st1'].length, '相手はStorageから受け取る');
  await A.photoDel('p_st1');
  await until(function(){ return !stStore['p_st1']; }, 5000, 'Storageからも消える');
  A.SYNC_LOCAL.photoStore = 'fs'; A.SYNC_LOCAL.photoSize = 'normal'; A.saveSyncLocal();
});

test('運用：エラー送信の形・場所の計算・アップロードの確認', async function(){
  var A = frames.A;
  var d = A.sentryParse('https://abc123@o12345.ingest.us.sentry.io/678');
  ok(d && /\/api\/678\/envelope\/\?sentry_key=abc123/.test(d.url), 'DSNの読み取り');
  eq(A.sentryParse('https://evil.example.com/1'), null, 'Sentry以外は使わない');
  ok(A.sentryScrub('ID 12345 https://x.y/z tokenABCDEFGHIJKLMNOPQRSTUVWX').indexOf('12345') < 0, '数字やURLを伏せる');
  var dist = A.geoDist({ lat:34.889, lng:135.225 }, { lat:34.7376, lng:135.3416 });
  ok(dist > 18000 && dist < 22000, '三田〜西宮の距離（' + dist + 'm）');
  await A.fileCheckRun();
  ok(A.fileCheck.result && !A.fileCheck.result.missing.length, '見つからないファイル：' + (A.fileCheck.result ? A.fileCheck.result.missing.join(',') : ''));
  ok(A.fileCheck.result.listed, 'files.json を使って確かめる');
  eq(A.fileCheck.result.changed.join(','), '', 'files.json と中身がちがう（tools/チェック を実行してください）');
  A.perfRunAll();
  ok(Object.keys(A.perfStat).length >= 10, '画面ごとの速さ');
});

test('予定：自分で作った種類が保存しても「その他」に変わらない', async function(){
  var A = frames.A;
  A.ensureKinds().push(J(A, { id:'kd_t', name:'提出物', hex:'#A8DCF7', fg:'#3B2030', custom:1 }));
  A.appId = 'cal'; A.calTab = 'add'; A.evDraft = A.newDraft(A.today()); A.evDraft.kind = 'kd_t'; A.evDraft.subject = '医学英語'; A.render();
  A.document.querySelector('[data-act="ev-save"]').click();
  var ev = A.S.events[A.S.events.length - 1];
  eq(ev.kind, 'kd_t', '種類');
  eq(ev.title, '医学英語', '名前が空なら科目名');
  var ni = A.normItems().filter(function(x){ return x.id === ev.id; })[0];
  eq(ni.src, 'kd_t', 'カレンダーでの種類');
});

test('同期：新しい端末は、先に自分の設定を直していても、はじめはみんなの設定に合わせる（予定は合わせて残す）', async function(){
  var A = frames.A, B = frames.B;
  A.S.ui.theme = 'lemon'; A.touch('ui'); A.S.settings.fare = 1234; A.commit();
  await settle([A, B]);
  eq(B.S.ui.theme, 'lemon', 'Bに届く');
  /* まっさらな端末C：つながる前に自分で見た目と予定を変えておく */
  clean('C');
  var C = await openFrame('C');
  await until(function(){ return C.syncState.remote && C.SYNC_LOCAL.firstPullAt; }, 10000, 'Cの最初の受け取り');
  await settle([A, B, C]);
  eq(C.S.ui.theme, 'lemon', 'まっさらな端末はみんなの見た目になる');
  /* 受け取る前に変更した場合をまねる：受け取りの記録を消して、自分で変える */
  C.SYNC_LOCAL.firstPullAt = 0; C.SYNC_LOCAL.applied = {}; C.saveSyncLocal();
  C.S.ui.theme = 'sky'; C.touch('ui'); C.S.settings.fare = 99;
  C.S.events.push(J(C, { id:'ev_c', date:'2026-11-01', title:'Cの予定', kind:'other', mt:Date.now() }));
  C.persist();
  await C.pullParts();
  eq(C.S.ui.theme, 'lemon', 'Cの見た目はみんなに合わせる');
  eq(C.S.settings.fare, 1234, 'Cの設定もみんなに合わせる');
  ok(C.S.events.some(function(e){ return e.id === 'ev_c'; }), 'Cで足した予定は残る');
  await settle([A, B, C]);
  ok(A.S.events.some(function(e){ return e.id === 'ev_c'; }), 'Cの予定はAに届く');
  eq(A.S.ui.theme, 'lemon', 'Aの見た目は変わらない');
  document.getElementById('f-C').remove(); delete frames.C; clean('C');
});

test('表示するだけでは、中身（同期するもの）が変わらない', async function(){
  var A = frames.A;
  await settle([A, frames.B]);
  var pages = [];
  A.TAB_DEFS.forEach(function(t){
    (A.SUBTAB_DEFS[t[0]] ? A.SUBTAB_DEFS[t[0]].map(function(x){ return x[0]; }) : [null]).forEach(function(s){ pages.push([t[0], s]); });
  });
  /* お知らせの履歴（くらしタブに出たものを残す）は、見たときに記録するものなので外す */
  var snap = function(){ var o = A.payloadCore(); delete o.notices; return A.canon(o) + '|' + A.canon(A.S.meta); };
  var before = snap();
  pages.forEach(function(p){
    A.appId = p[0];
    if(p[1]){ if(p[0]==='money') A.payTab=p[1]; else if(p[0]==='risyu') A.risyuTab=p[1]; else if(p[0]==='cal') A.calTab=p[1]; else if(p[0]==='todo') A.todoTab=p[1]; else if(p[0]==='today') A.todayTab=p[1]; }
    A.render();
  });
  A.S.ui.setOpen = A.S.ui.setOpen || {};
  A.appId = 'set'; A.render();
  A.persist();                                  /* 保存しても「直した」にならない */
  var after = snap();
  if(before !== after){
    /* どこが変わったか探す */
    var b = JSON.parse(before.split('|')[0]), a = JSON.parse(after.split('|')[0]);
    var diff = Object.keys(a).filter(function(k){ return A.canon(a[k]) !== A.canon(b[k]); });
    throw new Error('表示しただけで変わった：' + (diff.join(',') || 'meta'));
  }
  A.appId = 'today'; A.todayTab = 'today'; A.render();
});

test('同期：2台でランダムに操作・開き直しを続けても、最後はそろって静かになる', async function(){
  var seed = Date.now() % 100000;
  var rnd = (function(s){ return function(){ s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(seed + 1);
  var pick = function(a){ return a[Math.floor(rnd() * a.length)]; };
  var pages = [['today','today'],['tt',null],['cal','cal'],['cal','add'],['money','home'],['money','work'],['chat',null],['set',null],['notes',null],['course',null]];
  var names = frames.A.termCourses().map(function(c){ return c.name; });
  var log = [];
  var ops = {
    addEvent: function(w){ w.S.events.push(J(w, { id:'rz' + Math.floor(rnd()*1e9), date:w.shiftDate(w.today(), Math.floor(rnd()*20)), title:'ランダム', subject:pick(names), kind:pick(['other','imp']), mt:Date.now() })); w.commit(); },
    editEvent: function(w){ var e = pick(w.S.events); if(!e) return; e.title = '直し' + Math.floor(rnd()*100); w.commit(); },
    delEvent: function(w){ var e = pick(w.S.events); if(!e) return; w.removeWithUndo('events', e.id, '削除'); w.commit(); if(rnd() < .4){ var b = w.document.getElementById('undoBtn'); if(b) b.click(); } },
    doneTask: function(w){ var t = pick(w.S.tasks); if(!t) return; w.undoable('task-done', function(){ w.risyuAction(t.done ? 'task-undone' : 'task-done', { dataset:{ id:t.id } }, {}); }); },
    fare: function(w){ w.S.settings.fare = 1000 + Math.floor(rnd()*500); w.commit(); },
    shiftName: function(w){ w.S.settings.shiftName = rnd() < .5 ? null : '山田'; w.commit(); },
    theme: function(w){ w.S.ui.theme = pick(['pink','mint','sky','lemon']); w.touch('ui'); w.commit(); },
    fold: function(w){ w.S.ui.setOpen[pick(['s1','s2','s4','gas'])] = rnd() < .5 ? 1 : 0; w.touch('ui'); w.commit(); },
    kinds: function(w){ var k = w.ensureKinds(); if(k.length > 1){ var x = k.shift(); k.push(x); } w.touch('ui'); w.commit(); },
    render: function(w){ var p = pick(pages); w.appId = p[0]; if(p[0]==='cal') w.calTab = p[1]; if(p[0]==='money') w.payTab = p[1]; if(p[0]==='today') w.todayTab = p[1]; w.courseView = p[0]==='course' ? pick(names) : ''; w.render(); },
    chat: function(w){ w.chatRoom = 'main'; w.S.chat = (w.S.chat || []).concat([J(w, { role:'user', text:'質問' + Math.floor(rnd()*1000), mt:Date.now() })]); w.commit(); },
    attend: function(w){ var n = pick(names); w.S.attendLog[n] = (w.S.attendLog[n] || []).concat([J(w, { date:w.today(), st:pick(['出','欠','遅']) })]); w.commit(); },
    alias: function(w){ var n = pick(names); w.S.courseMeta[n] = J(w, Object.assign({}, w.S.courseMeta[n] || {}, { alias:'略' + Math.floor(rnd()*10) })); w.commit(); },
    note: function(w){
      var n = pick(w.S.notes);
      if(!n || rnd() < .4){ w.S.notes.push(J(w, { id:'nz' + Math.floor(rnd()*1e9), title:'メモ', body:'本文', pinned:0, checks:[], photos:[], link:null, mt:Date.now() })); }
      else { n.body = '直した' + Math.floor(rnd()*100); n.mt = Date.now(); }
      w.commit();
    },
    paid: function(w){ var p = pick(w.S.plans); if(!p) return; var k = p.id + ':' + w.thisYm(); w.setPaid(k, !w.isPaid(k)); w.commit(); },
    quick: function(w){ w.S.chatQuick = rnd() < .3 ? [] : ['質問' + Math.floor(rnd()*5)]; w.commit(); }
  };
  var opNames = Object.keys(ops);
  var reloads = 0;
  for(var i = 0; i < 70; i++){
    var dev = rnd() < .5 ? 'A' : 'B';
    var w = frames[dev];
    var op = pick(opNames);
    log.push(dev + ':' + op);
    try{ ops[op](w); }catch(e){ throw new Error('操作 ' + op + ' で失敗：' + e.message + '（seed ' + seed + '）'); }
    if(rnd() < .35) await sleep(Math.floor(rnd() * 400));
    if((i === 25 || i === 50) && reloads < 2){ reloads++; await sleep(300); await reloadFrame(pick(['A','B'])); }
  }
  var A = frames.A, B = frames.B;
  await settle([A, B], 2500);
  var w0 = FS.stats.writes;
  A.pushRemote(true); B.pushRemote(true);
  await sleep(4000);
  var extra = FS.stats.writes - w0;
  ok(extra <= 2, '落ちついたあとも書きこみが続く（' + extra + '回・seed ' + seed + '）');
  Object.keys(A.SYNC_PARTS).forEach(function(p){
    var a = A.canon(A.buildPart(p)), b = B.canon(B.buildPart(p));
    if(a !== b){
      var ao = JSON.parse(a), bo = JSON.parse(b);
      var keys = Object.keys(ao).filter(function(k){ return A.canon(ao[k]) !== A.canon(bo[k]); });
      throw new Error('「' + p + '」が2台でちがう：' + keys.join(',') + '（seed ' + seed + '）');
    }
  });
});

/* ============ 足した機能のテスト（tests/tests-m-*.js）から使う道具 ============
   KT.test(名前, fn) でテストを足す。KT.ai / KT.gas / KT.api に、にせの答えを返す関数を足せる（答えないときは null）。 */
var KT = window.KT = {
  test:function(name, fn){ T.push({ name:name, fn:fn }); },
  ok:ok, eq:eq, J:J, sleep:sleep, until:until, settle:settle, clean:clean, openFrame:openFrame,
  frames:function(){ return frames; }, fs:function(){ return FS; },
  gasState:gasState, aiCalls:aiCalls, gasCalls:gasCalls,
  freshWrites:function(ws){ ws.forEach(function(w){ w.syncState.writes = []; }); },
  ai:[], gas:[], api:[]
};

/* ============ 実行 ============
   ?only=ことば|ことば … 名前にふくまれるテストだけ（はじめの準備のテストは、いつも動かす） */
async function runAll(){
  var list = document.getElementById('list'), sum = document.getElementById('sum');
  list.innerHTML = ''; sum.className = ''; sum.textContent = '準備しています…';
  document.getElementById('frames').innerHTML = '';
  aiCalls.length = 0; gasCalls.length = 0;
  window.__FAKE_FS = FS = makeFakeFs();
  window.__FAKE_AI = fakeAi;
  window.__FAKE_GAS = fakeGas;
  window.__FAKE_ST = fakeSt;
  gasState.jobs = []; gasState.inbox = []; gasState.summary = null;
  ['A', 'B'].forEach(clean);
  try{
    await openFrame('A');
    await openFrame('B');
  }catch(e){
    sum.className = 'ng'; sum.textContent = '起動できませんでした：' + e.message; return;
  }
  var pass = 0, fail = 0;
  var only = (new URLSearchParams(location.search).get('only') || '').split('|').filter(Boolean);
  var TT = only.length ? T.filter(function(t, i){ return i < 2 || only.some(function(w){ return t.name.indexOf(w) >= 0; }); }) : T;
  for(var i = 0; i < TT.length; i++){
    var li = document.createElement('li');
    li.className = 'run';
    li.innerHTML = '<span class="mark">…</span> <span class="t"></span><span class="ms"></span>';
    li.querySelector('.t').textContent = TT[i].name;
    list.appendChild(li);
    var t0 = performance.now();
    try{
      await TT[i].fn();
      li.className = 'ok'; li.querySelector('.mark').textContent = '✓'; pass++;
    }catch(e){
      li.className = 'ng'; li.querySelector('.mark').textContent = '✗'; fail++;
      var m = document.createElement('span'); m.className = 'msg'; m.textContent = (e && e.message) || String(e);
      li.appendChild(m);
    }
    li.querySelector('.ms').textContent = Math.round(performance.now() - t0) + 'ms';
    sum.textContent = pass + '件 成功 ／ ' + fail + '件 失敗（' + (i + 1) + '/' + TT.length + '）';
  }
  sum.className = fail ? 'ng' : 'ok';
  sum.textContent = (fail ? '失敗があります：' : 'すべて成功：') + pass + '件 成功 ／ ' + fail + '件 失敗';
  window.__TEST_RESULT = { pass:pass, fail:fail, total:TT.length,
    fails: [].slice.call(document.querySelectorAll('li.ng')).map(function(x){ return x.textContent; }) };
}
document.getElementById('again').addEventListener('click', runAll);
/* 足した機能のテストのファイルを読み終えてから始める */
if(document.readyState === 'complete') runAll(); else window.addEventListener('load', runAll);
})();

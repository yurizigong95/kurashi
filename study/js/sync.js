/* もんだいメーカー：ほかの端末と、自動でそろえる（同期）
   ============================================================================
   しくみ
   ・つなぎ先は、くらしの手帳と同じ Firebase（Firestore）。設定はこの端末の
     「くらしの手帳」から借ります（このファイルにはカギを書きません）。
   ・置き場所の名前は、くらしの手帳の合言葉ではじめます。手帳のきまり（ルール）を
     そのままで読み書きできます。
   ・中身は「まるごと1つ」にまとめて、gzip で小さくしてから、700KBずつに切って置きます。
     目次（idx）に、いまの版と、切れはしごとの印をのせます。
   ・ほかの端末が書きかえたら、目次が変わるので、すぐ気づいて取りに行きます。
   ・同じものを2台で直したときは、「あとから直したほう」を採ります（1つずつ見ます）。
   ・消したものは「消したしるし」を残すので、ほかの端末で生き返りません。
   ・資料の写真も、1枚ずつ置き場所に置いて、足りない端末が取りに行きます。
   ・APIキーと、使った量の記録は、同期しません（端末ごとのものだから）。       */

var SY = {
  on:0,            /* つなげているか */
  msg:'',          /* 画面に出す一言 */
  busy:0,          /* いま送っているか・取りに行っているか */
  again:0,         /* 送っている間に、また変わった */
  at:0,            /* さいごにそろえた時こく */
  applied:'',      /* さいごに合わせた版の印 */
  unsub:null,      /* 見はりをやめる関数 */
  timer:null,
  imgBusy:0,
  off:0,           /* 自分で「同期をやめる」にした */
  renderWait:0     /* 字を打ちおわったら、描き直す */
};
var SY_COL = 'shiharai';
var SY_PART = 700 * 1024;        /* 1つの切れはしの大きさ（Firestore は1MBまで） */
var SY_IMG_PART = 700 * 1024;
var SY_SET_KEYS = ['goal', 'shuffle', 'term', 'allTerms', 'model', 'lim'];   /* 同期する設定（キーと使用量は入れない） */

/* ===== つなぎ先（くらしの手帳から借りる） ===== */
function syApp(){
  try{ var j = JSON.parse(localStorage.getItem('shiharai:v1') || 'null'); return (j && j.settings) || null; }
  catch(e){ return null; }
}
function syCfg(){
  var t = String((syApp() || {}).fbConfig || '').trim();
  if(!t) return null;
  var c = null;
  try{ c = JSON.parse(t); }
  catch(e){
    try{
      var s = t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)
        .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":')
        .replace(/'([^'\\]*)'/g, '"$1"').replace(/,\s*([}\]])/g, '$1');
      c = JSON.parse(s);
    }catch(e2){ c = null; }
  }
  return (c && c.projectId) ? c : null;
}
function syRoom(){ return String((syApp() || {}).room || ''); }
function syReady(){
  if(typeof window !== 'undefined' && window.__FAKE_SYNC) return true;    /* テストのとき */
  return !TEST_MODE && !!syCfg() && !!syRoom();
}
function syDoc(name){ return (syRoom() || 'test') + '__mondai_' + String(name).replace(/[^A-Za-z0-9_-]+/g, '_'); }
function syDev(){
  var k = 'mondai:dev', v = '';
  try{ v = localStorage.getItem(k) || ''; }catch(e){}
  if(!v){ v = Math.random().toString(36).slice(2, 10); try{ localStorage.setItem(k, v); }catch(e){} }
  return v;
}

/* ===== Firestore（くらしの手帳と同じ読みこみ方） ===== */
var syImport = function(u){ try{ return (new Function('u', 'return import(u)'))(u); }catch(e){ return Promise.reject(e); } };
var syFbP = null;
function syFire(){
  if(syFbP) return syFbP;
  syFbP = (async function(){
    var cfg = syCfg();
    if(!cfg) throw new Error('つなぎ先の設定がありません');
    try{
      var fa = await syImport('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      var ff = await syImport('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      var db = ff.getFirestore(fa.initializeApp(cfg, 'mondai'));
      return {
        get:async function(id){ var s = await ff.getDoc(ff.doc(db, SY_COL, id)); return s.exists() ? s.data() : null; },
        set:function(id, d){ return ff.setDoc(ff.doc(db, SY_COL, id), d); },
        sub:function(id, next, err){ return ff.onSnapshot(ff.doc(db, SY_COL, id), function(s){ next(s.exists() ? s.data() : null); }, err); }
      };
    }catch(e){ /* 古い端末では、昔ながらの読みこみ方で */ }
    var add = function(src){
      return new Promise(function(res, rej){
        var s = document.createElement('script');
        s.src = src; s.async = true; s.onload = res; s.onerror = function(){ rej(new Error('SCRIPT_FAIL')); };
        document.head.appendChild(s);
      });
    };
    await add('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
    await add('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js');
    if(!window.firebase) throw new Error('SCRIPT_FAIL');
    var had = (window.firebase.apps || []).filter(function(a){ return a.name === 'mondai'; })[0];
    var col = window.firebase.firestore(had || window.firebase.initializeApp(cfg, 'mondai')).collection(SY_COL);
    return {
      get:async function(id){ var s = await col.doc(id).get(); return s.exists ? s.data() : null; },
      set:function(id, d){ return col.doc(id).set(d); },
      sub:function(id, next, err){ return col.doc(id).onSnapshot(function(s){ next(s.exists ? s.data() : null); }, err); }
    };
  })();
  var mine = syFbP;
  mine.catch(function(){ if(syFbP === mine) syFbP = null; });   /* 読めなかったら（ネットがないときなど）、次にもう一度ためす */
  return syFbP;
}
/* テストのときは、にせのつなぎ先に差しかえられるように */
function syNet(){ return (typeof window !== 'undefined' && window.__FAKE_SYNC) ? Promise.resolve(window.__FAKE_SYNC) : syFire(); }

/* ===== 小さくする・もどす ===== */
function syB64(bytes){
  var bin = '', chunk = 0x8000;
  for(var i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(bytes.length, i + chunk)));
  return btoa(bin);
}
function syUnb64(s){
  var bin = atob(String(s || '')), out = new Uint8Array(bin.length);
  for(var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
/* いつも同じ字になるように書き出す（中の順番をそろえる）。
   順番がちがうだけで「ちがう中身」と思うと、2台がずっと送り合ってしまうため。 */
function syStable(v){
  if(Array.isArray(v)) return '[' + v.map(function(x){ return syStable(x === undefined ? null : x); }).join(',') + ']';
  if(v && typeof v === 'object'){
    return '{' + Object.keys(v).sort().filter(function(k){ return v[k] !== undefined && typeof v[k] !== 'function'; })
      .map(function(k){ return JSON.stringify(k) + ':' + syStable(v[k]); }).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}
/* id の順にならべる（端末によって順番が変わらない、ただの文字の大小でくらべる） */
function syById(list){
  return (list || []).filter(function(x){ return x && x.id; }).slice().sort(function(a, b){
    var x = String(a.id), y = String(b.id);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}
async function syPack(obj){
  var text = syStable(obj);
  if(typeof CompressionStream === 'undefined'){
    return { z:0, s:syB64(new TextEncoder().encode(text)) };
  }
  var st = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  var buf = await new Response(st).arrayBuffer();
  return { z:1, s:syB64(new Uint8Array(buf)) };
}
async function syUnpack(s, z){
  var bytes = syUnb64(s);
  if(!z) return JSON.parse(new TextDecoder().decode(bytes));
  var st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(st).text());
}
function syCut(s, size){
  var out = [];
  for(var i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out.length ? out : [''];
}

/* ===== 消したしるし ===== */
function syDead(id){
  if(!id) return;
  if(!S.del || typeof S.del !== 'object') S.del = {};
  S.del[id] = Date.now();
  syPrune();
}
/* 古いしるしは、そうじする（90日／2000こまで） */
function syPrune(){
  var d = S.del || {}, ks = Object.keys(d), cut = Date.now() - 90 * 86400000;
  if(ks.length <= 2000){
    ks.forEach(function(k){ if(toNum(d[k]) < cut) delete d[k]; });
    return;
  }
  ks.sort(function(a, b){ return toNum(d[a]) - toNum(d[b]); });
  ks.slice(0, ks.length - 2000).forEach(function(k){ delete d[k]; });
}

/* ===== 合わせる（結合） ===== */
function syPayload(){
  var set = {};
  SY_SET_KEYS.forEach(function(k){ if(S.set[k] !== undefined) set[k] = S.set[k]; });
  return {
    v:1, subs:syById(S.subs), mats:syById(S.mats), qs:syById(S.qs), moc:syById(S.moc),
    notes:syById(S.notes).filter(function(n){ return String(n.body || '').trim(); }),   /* 書きはじめる前のからのメモは送らない */
    log:S.log || {}, day:S.day || {}, why:S.why || {}, del:S.del || {},
    set:set, smt:toNum(S.set.smt)
  };
}
/* 1つずつ見て、あとから直したほうを採る */
function syMergeList(mine, theirs, dead){
  var by = {}, out = [];
  (mine || []).forEach(function(x){ if(x && x.id) by[x.id] = x; });
  (theirs || []).forEach(function(x){
    if(!x || !x.id) return;
    var a = by[x.id];
    if(!a || toNum(x.mt) > toNum(a.mt)) by[x.id] = x;
    /* 同じ時こくに直していたら、どの端末でも同じほうを採る（中身の字の大小で決める） */
    else if(toNum(x.mt) === toNum(a.mt) && syStable(x) > syStable(a)) by[x.id] = x;
  });
  Object.keys(by).forEach(function(id){
    var x = by[id];
    if(toNum(dead[id]) > toNum(x.mt)) return;          /* 消したあとに直していなければ、消えたまま */
    out.push(x);
  });
  return out;
}
function syMergeSnap(){
  var set = {};
  SY_SET_KEYS.forEach(function(k){ set[k] = S.set[k]; });
  return syStable([syById(S.subs), syById(S.mats), syById(S.qs), syById(S.moc), syById(S.notes), S.log, S.day, S.why, set]);
}
function syMerge(rem){
  if(!rem || typeof rem !== 'object') return false;
  var before = syMergeSnap();
  var dead = Object.assign({}, S.del || {});
  Object.keys(rem.del || {}).forEach(function(k){
    if(toNum((rem.del || {})[k]) > toNum(dead[k])) dead[k] = toNum(rem.del[k]);
  });
  S.del = dead;
  syPrune();

  S.subs = syMergeList(S.subs, rem.subs, dead);
  S.mats = syMergeList(S.mats, rem.mats, dead);
  S.qs = syMergeList(S.qs, rem.qs, dead);
  S.moc = syMergeList(S.moc, rem.moc, dead);
  S.notes = syMergeList(S.notes, rem.notes, dead);

  /* といた記録：といた回数が多いほう（回数はふえるだけ） */
  var log = S.log || {}, rl = rem.log || {};
  Object.keys(rl).forEach(function(id){
    if(toNum(dead[id])) return;
    var a = log[id], b = rl[id];
    if(!b) return;
    if(!a || toNum(b.n) > toNum(a.n) || (toNum(b.n) === toNum(a.n) && String(b.last || '') > String(a.last || ''))) log[id] = b;
  });
  Object.keys(log).forEach(function(id){ if(toNum(dead[id])) delete log[id]; });
  S.log = log;

  /* その日にといた数：多いほう */
  var day = S.day || {}, rd = rem.day || {};
  Object.keys(rd).forEach(function(k){
    var a = day[k] || { n:0, ok:0 }, b = rd[k] || { n:0, ok:0 };
    day[k] = { n:Math.max(toNum(a.n), toNum(b.n)), ok:Math.max(toNum(a.ok), toNum(b.ok)) };
  });
  S.day = day;

  /* 「なぜまちがい？」：ないものだけもらう */
  var why = S.why || {}, rw = rem.why || {};
  Object.keys(rw).forEach(function(id){ if(!why[id] && !toNum(dead[id])) why[id] = rw[id]; });
  Object.keys(why).forEach(function(id){ if(toNum(dead[id])) delete why[id]; });
  S.why = why;

  /* 設定（キーと使った量ははいらない）：あとから直したほう */
  if(rem.set && toNum(rem.smt) > toNum(S.set.smt)){
    SY_SET_KEYS.forEach(function(k){ if(rem.set[k] !== undefined) S.set[k] = rem.set[k]; });
    S.set.smt = toNum(rem.smt);
  }
  return syMergeSnap() !== before;
}
/* 設定を直したときは、時こくを入れておく（どちらが新しいか分かるように） */
function syTouchSet(){ S.set.smt = Date.now(); syTouch(); }

/* ===== 送る ===== */
function syTouch(){
  if(!SY.on) return;
  clearTimeout(SY.timer);
  SY.timer = setTimeout(function(){ SY.timer = null; syPush(); }, 3000);
}
async function syPush(){
  if(!SY.on) return false;
  if(SY.busy){ SY.again = 1; return false; }
  SY.busy = 1;
  try{
    var net = await syNet();
    /* 先に、あちらの新しいぶんを取りこんでから送る（上書きしないように） */
    var idx = await net.get(syDoc('idx')), broken = false;
    if(idx && idx.h && idx.h !== SY.applied){
      /* 置き場がこわれていたら（書いているとちゅうで止まったなど）、こちらの中身で置きなおす。
         ほかの端末は、自分の中身と合わせてから送りなおすので、なくなりません */
      try{ await syApply(net, idx); }catch(e){ if(!e.broken) throw e; broken = true; }
    }

    var pk = await syPack(syPayload());
    var parts = syCut(pk.s, SY_PART);
    var hs = parts.map(function(p){ return hash(p); });
    var h = hash(hs.join(','));
    if(!broken && idx && idx.h === h){ SY.applied = h; SY.at = Date.now(); return true; }
    var old = (!broken && idx && Array.isArray(idx.hs)) ? idx.hs : [];   /* こわれていたら、ぜんぶ置きなおす */
    for(var i = 0; i < parts.length; i++){
      if(old[i] === hs[i]) continue;                 /* 変わっていない切れはしは、送らない */
      await net.set(syDoc('p' + i), { d:parts[i], i:i, n:parts.length, h:hs[i], at:Date.now() });
    }
    await net.set(syDoc('idx'), { v:1, h:h, hs:hs, n:parts.length, z:pk.z, at:Date.now(), dev:syDev(),
      imgs:await syImgIndex(net, idx) });
    SY.applied = h; SY.at = Date.now(); SY.msg = '';
    return true;
  }catch(e){
    SY.msg = syErrText(e);
    return false;
  }finally{
    SY.busy = 0;
    if(SY.again){ SY.again = 0; syTouch(); }
    if(view.tab === 'set') syRender();
  }
}
/* 写真：まだ置いていないものを置く。置き場所の一覧を返す */
async function syImgIndex(net, idx){
  var have = (idx && idx.imgs && typeof idx.imgs === 'object') ? Object.assign({}, idx.imgs) : {};
  var want = [];
  (S.mats || []).forEach(function(m){ (m.photos || []).forEach(function(p){ if(p) want.push(p); }); });
  for(var i = 0; i < want.length && i < 200; i++){
    var pid = want[i];
    if(have[pid]) continue;
    var url = await photoGet(pid);
    if(!url) continue;
    var parts = syCut(String(url), SY_IMG_PART);
    for(var k = 0; k < parts.length; k++){
      await net.set(syDoc('img_' + pid + '_' + k), { d:parts[k], i:k, n:parts.length, at:Date.now() });
    }
    have[pid] = parts.length;
  }
  /* もう使っていない写真は、一覧から外す（置き場所はそのまま。あとで上書きされます） */
  Object.keys(have).forEach(function(pid){ if(want.indexOf(pid) < 0) delete have[pid]; });
  return have;
}

/* ===== 取りに行く ===== */
async function syApply(net, idx){
  if(!idx || !idx.n) return false;
  var s = '';
  var hs = Array.isArray(idx.hs) ? idx.hs : [];
  for(var i = 0; i < idx.n; i++){
    var p = await net.get(syDoc('p' + i));
    /* 切れはしが足りない・ほかの端末が書いているとちゅう（印がちがう） */
    if(!p || typeof p.d !== 'string' || (hs[i] && p.h && p.h !== hs[i])) throw syBroken();
    s += p.d;
  }
  var rem = null;
  try{ rem = await syUnpack(s, idx.z); }catch(e){ throw syBroken(); }
  var changed = syMerge(rem);
  SY.applied = idx.h; SY.at = Date.now();
  /* 中身が変わったときだけ保存する（変わっていないのに保存すると、また送ってしまう） */
  if(changed){ saveNow(); syRender(); }
  syImgPull(net, idx).catch(function(){});
  return changed;
}
function syBroken(){ var e = new Error('とちゅうまでしか読めませんでした'); e.broken = 1; return e; }
/* 足りない写真を、あとから取りに行く */
async function syImgPull(net, idx){
  if(SY.imgBusy) return;
  var imgs = (idx && idx.imgs) || {};
  var ids = Object.keys(imgs);
  if(!ids.length) return;
  SY.imgBusy = 1;
  try{
    for(var i = 0; i < ids.length; i++){
      var pid = ids[i];
      var mine = await photoGet(pid);
      if(mine) continue;
      var url = '';
      for(var k = 0; k < toNum(imgs[pid]); k++){
        var p = await net.get(syDoc('img_' + pid + '_' + k));
        if(!p || typeof p.d !== 'string'){ url = ''; break; }
        url += p.d;
      }
      if(url) await photoPut(pid, url);
    }
  }finally{ SY.imgBusy = 0; }
}

/* ===== はじめる ===== */
function syErrText(e){
  var m = String((e && e.message) || e || '');
  if(/permission|PERMISSION/i.test(m)) return 'つなぎ先に書けませんでした（くらしの手帳の同期の設定をたしかめてください）';
  if(/quota|exhaust/i.test(m)) return '入れものがいっぱいです。しばらくしてから、もう一度ためします';
  if(/SCRIPT_FAIL|Failed to fetch|NetworkError/i.test(m)) return 'ネットにつながりませんでした（つながったら、ひとりでに合わせます）';
  return m.slice(0, 80);
}
async function syStart(){
  if(SY.on || !syReady()) return false;
  SY.on = 1;
  SY.msg = 'つないでいます…';
  try{
    var net = await syNet();
    SY.unsub = net.sub(syDoc('idx'), function(idx){
      if(!idx || !idx.h || idx.h === SY.applied) return;
      if(SY.busy){ SY.again = 1; return; }
      SY.busy = 1;
      SY.msg = '';
      syApply(net, idx).catch(function(e){
        /* 書いているとちゅうだったかもしれない：少し待ってから、もう一度 */
        if(e && e.broken){ SY.again = 1; return; }
        SY.msg = syErrText(e);
      }).then(function(){
        SY.busy = 0;
        if(SY.again){ SY.again = 0; syTouch(); }
        if(view.tab === 'set') syRender();
      });
    }, function(e){ SY.msg = syErrText(e); });
    SY.msg = '';
    await syPush();
    return true;
  }catch(e){
    SY.on = 0;
    SY.msg = syErrText(e);
    return false;
  }
}
function syStop(){
  if(SY.unsub){ try{ SY.unsub(); }catch(e){} SY.unsub = null; }
  clearTimeout(SY.timer); SY.timer = null;
  SY.on = 0;
}
function syState(){
  if(!syReady()){
    return { on:0, text:'この端末では、まだ同期できません', sub:'この端末でいちど「くらしの手帳」を開くと、そのつなぎ先を借りて、ひとりでに合わせます。' };
  }
  if(SY.msg) return { on:SY.on, text:'合わせられませんでした', sub:SY.msg };
  if(SY.busy) return { on:1, text:'いま合わせています…', sub:'' };
  if(SY.at) return { on:1, text:'そろっています', sub:'さいごに合わせたのは ' + hhmm(SY.at) };
  return { on:SY.on, text:SY.on ? 'つないでいます…' : '同期はまだです', sub:'' };
}
/* 同期のあとの描き直し：字を打っているとちゅうなら、打ちおわる（入力らんから出る）まで待つ。
   とちゅうで描き直すと、キーボードが引っこんでしまうため。 */
function syRender(){
  if(typeof render !== 'function') return;
  if(typeof isTyping === 'function' && isTyping()){ SY.renderWait = 1; return; }
  render();
}
/* 指でおしているあいだは描き直さない（ボタンが入れかわって、おしたのが消えてしまうため） */
var syPtr = 0;
function syRenderAfter(){
  setTimeout(function(){
    if(!SY.renderWait) return;
    if(typeof isTyping === 'function' && isTyping()) return;   /* 次の入力らんに移っただけ */
    if(syPtr){ syRenderAfter(); return; }
    SY.renderWait = 0;
    render();
  }, 250);
}
if(typeof document !== 'undefined'){
  document.addEventListener('pointerdown', function(){ syPtr = 1; }, true);
  document.addEventListener('pointerup', function(){ syPtr = 0; }, true);
  document.addEventListener('pointercancel', function(){ syPtr = 0; }, true);
  document.addEventListener('focusout', function(){ if(SY.renderWait) syRenderAfter(); });
}
/* ネットがもどったら、つなぎなおす・送りなおす（自分で「やめる」にしたときは、つながない） */
if(typeof window !== 'undefined'){
  window.addEventListener('online', function(){
    if(SY.on){ syTouch(); return; }
    if(!SY.off && syReady()) syStart();
  });
}
function hhmm(t){
  var d = new Date(t);
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

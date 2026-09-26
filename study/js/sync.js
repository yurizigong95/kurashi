/* もんだいメーカー：ほかの端末と、自動でそろえる（同期）
   ============================================================================
   しくみ
   ・つなぎ先は、くらしの手帳と同じ Firebase（Firestore）。くらしの手帳と同じく、アプリに
     組みこんであるので、どの端末で開いても、何も入れずにそろいます。
     （Firebase のウェブ用の設定は、ページを開けばだれでも見られる公開の値です。
       まもりは Firestore のルールでしています）
   ・置き場所の名前は、くらしの手帳の合言葉ではじめます。手帳のきまり（ルール）を
     そのままで読み書きできます。
   ・中身は「まるごと1つ」にまとめて、gzip で小さくしてから、700KBずつに切って置きます。
     目次（idx）に、いまの版と、切れはしごとの印をのせます。
   ・ほかの端末が書きかえたら、目次が変わるので、すぐ気づいて取りに行きます。
   ・同じものを2台で直したときは、「あとから直したほう」を採ります（1つずつ見ます）。
   ・消したものは「消したしるし」を残すので、ほかの端末で生き返りません。
   ・資料の写真も、1枚ずつ置き場所に置いて、足りない端末が取りに行きます。
   ・APIキーと、使った量の記録は、同期しません（端末ごとのものだから）。
   ・上の「同期済み」の表示と、設定の「変更の記録」で、いまのようすが分かります。 */

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
  connecting:0,    /* つないでいるとちゅう */
  pushedAt:0,      /* さいごに送った時こく */
  pulledAt:0,      /* さいごに受けとった時こく */
  devs:{},         /* つながっている端末（置き場の目次にのせる） */
  renderWait:0     /* 字を打ちおわったら、描き直す */
};
var SY_COL = 'shiharai';
var SY_PART = 700 * 1024;        /* 1つの切れはしの大きさ（Firestore は1MBまで） */
var SY_IMG_PART = 700 * 1024;
var SY_SET_KEYS = ['goal', 'shuffle', 'term', 'allTerms', 'model', 'lim'];   /* 同期する設定（キーと使用量は入れない） */
/* 組みこみのつなぎ先（くらしの手帳の js/core.js の DEFAULT_ROOM・DEFAULT_FB と同じ） */
var SY_ROOM = '8b7f4e6et9jhxded';
var SY_FB = { apiKey:'AIzaSyAdXfCOY2Fk4wDXr38j4ompBHaBLEPRWww', authDomain:'kurashi-59562.firebaseapp.com',
  projectId:'kurashi-59562', storageBucket:'kurashi-59562.firebasestorage.app',
  messagingSenderId:'203275210981', appId:'1:203275210981:web:327cf32ad4aa6ebc6b040c' };

/* ===== つなぎ先（くらしの手帳で直していれば、それを使う。なければ組みこみのもの） ===== */
function syApp(){
  try{ var j = JSON.parse(localStorage.getItem('shiharai:v1') || 'null'); return (j && j.settings) || null; }
  catch(e){ return null; }
}
function syCfg(){
  var t = String((syApp() || {}).fbConfig || '').trim();
  if(!t) return SY_FB;
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
  return (c && c.projectId) ? c : SY_FB;
}
function syRoom(){ return String((syApp() || {}).room || '') || SY_ROOM; }
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
/* この端末の名前（自分でつけた名前 → くらしの手帳でつけた名前 → 機種から） */
function syDevName(){
  var v = '';
  try{ v = localStorage.getItem('mondai:devname') || ''; }catch(e){}
  if(v) return v;
  try{ var d = JSON.parse(localStorage.getItem('shiharai:v1:device') || 'null'); if(d && d.name) return String(d.name).slice(0, 20); }catch(e){}
  var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if(/iPad/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) return 'iPad';
  if(/iPhone/.test(ua)) return 'iPhone';
  if(/Android/.test(ua)) return /Mobile/.test(ua) ? 'Androidスマホ' : 'Androidタブレット';
  if(/Macintosh/.test(ua)) return 'Mac';
  if(/Windows/.test(ua)) return 'パソコン';
  return '端末';
}
function syDevRename(name){
  name = String(name || '').trim().slice(0, 20);
  if(!name) return false;
  try{ localStorage.setItem('mondai:devname', name); }catch(e){}
  SY.devSent = 0;                                 /* 目次の名前も、すぐ直す */
  syHello();
  return true;
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

/* ===== 変更の記録（何が変わったか・まだ送っていないもの） ===== */
var SY_KINDS = [['subs', '科目'], ['mats', '資料'], ['qs', '問題'], ['notes', 'メモ'], ['moc', '模擬テスト']];
/* 中身の「しるし」：種類ごとに id → 直した時こく。といた記録は id → といた回数 */
function sySigOf(o){
  o = o || {};
  var out = {};
  SY_KINDS.forEach(function(k){
    var m = {};
    (o[k[0]] || []).forEach(function(x){
      if(!x || !x.id) return;
      if(k[0] === 'notes' && !String(x.body || '').trim()) return;      /* 書きはじめる前のメモは数えない */
      m[x.id] = toNum(x.mt);
    });
    out[k[0]] = m;
  });
  var lg = {};
  Object.keys(o.log || {}).forEach(function(id){ lg[id] = toNum((o.log[id] || {}).n); });
  out.log = lg;
  return out;
}
function syDiff(a, b){
  a = a || {}; b = b || {};
  var out = {};
  SY_KINDS.forEach(function(k){
    var x = a[k[0]] || {}, y = b[k[0]] || {}, add = 0, chg = 0, del = 0;
    Object.keys(y).forEach(function(id){ if(!(id in x)) add++; else if(x[id] !== y[id]) chg++; });
    Object.keys(x).forEach(function(id){ if(!(id in y)) del++; });
    if(add || chg || del) out[k[0]] = { add:add, chg:chg, del:del };
  });
  var n = 0, la = a.log || {}, lb = b.log || {};
  Object.keys(lb).forEach(function(id){ var d = toNum(lb[id]) - toNum(la[id]); if(d > 0) n += d; });
  if(n) out.log = { n:n };
  return out;
}
/* 「問題 +3・直し2　メモ +1　といた 5問」 */
function syDiffText(d){
  var t = [];
  SY_KINDS.forEach(function(k){
    var v = (d || {})[k[0]];
    if(!v) return;
    var p = [];
    if(v.add) p.push('+' + v.add);
    if(v.chg) p.push('直し' + v.chg);
    if(v.del) p.push('−' + v.del);
    t.push(k[1] + ' ' + p.join('・'));
  });
  if(d && d.log) t.push('といた ' + d.log.n + '問');
  return t.join('　');
}
/* 置き場にあると分かっている中身のしるし（これとくらべて「まだ送っていない変更」を出す） */
function sySigBase(){
  if(SY.sig) return SY.sig;
  try{ SY.sig = JSON.parse(localStorage.getItem(KEY + ':syncsig') || 'null'); }catch(e){ SY.sig = null; }
  return SY.sig;
}
function sySigSave(sig){
  SY.sig = sig;
  try{ localStorage.setItem(KEY + ':syncsig', JSON.stringify(sig)); }catch(e){}
}
function syPending(){ var b = sySigBase(); return b ? syDiff(b, sySigOf(S)) : null; }
/* 送った・受けとったの記録（この端末の中だけ。30こまで） */
function syLogAll(){
  try{ var a = JSON.parse(localStorage.getItem(KEY + ':synclog') || '[]'); return Array.isArray(a) ? a : []; }catch(e){ return []; }
}
function syLogAdd(dir, who, text){
  if(!text) return;
  var a = syLogAll();
  a.unshift({ t:Date.now(), d:dir, v:String(who || ''), m:String(text) });
  try{ localStorage.setItem(KEY + ':synclog', JSON.stringify(a.slice(0, 30))); }catch(e){}
}
function syCountText(o){
  o = o || S;
  var t = SY_KINDS.map(function(k){
    var n = (o[k[0]] || []).filter(function(x){ return x && x.id && !(k[0] === 'notes' && !String(x.body || '').trim()); }).length;
    return n ? k[1] + n : '';
  }).filter(Boolean);
  return t.length ? t.join('・') : 'まだ何もありません';
}
function syDevNameOf(id){
  if(!id) return 'ほかの端末';
  if(id === syDev()) return syDevName();
  var d = (SY.devs || {})[id];
  return (d && d.name) ? String(d.name) : 'ほかの端末';
}

/* ===== つながっている端末（名前・さいごに使った時こく・版） ===== */
async function syHello(force){
  if(!SY.on) return;
  try{
    var net = await syNet();
    var cur = await net.get(syDoc('devs')) || {};
    var list = (cur && cur.list && typeof cur.list === 'object') ? cur.list : {};
    var me = list[syDev()] || {}, name = syDevName(), now = Date.now();
    /* 古い端末は、そうじ（半年） */
    Object.keys(list).forEach(function(id){ if(now - toNum((list[id] || {}).at) > 180 * 86400000) delete list[id]; });
    SY.devs = list;
    if(!force && me.name === name && me.build === APP_BUILD && now - toNum(me.at) < 6 * 3600000){ syTag(); return; }
    list[syDev()] = { name:name, at:now, build:APP_BUILD };
    await net.set(syDoc('devs'), { list:list, at:now });
    SY.devs = list;
  }catch(e){ /* 端末の一覧は、なくても同期はできる */ }
  syTag();
}

/* ===== 送る ===== */
function syTouch(){
  if(!SY.on) return;
  clearTimeout(SY.timer);
  SY.timer = setTimeout(function(){ SY.timer = null; syPush(); }, 3000);
  syTag();
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

    var pay = syPayload(), sigNow = sySigOf(pay), base = sySigBase();
    var pk = await syPack(pay);
    var parts = syCut(pk.s, SY_PART);
    var hs = parts.map(function(p){ return hash(p); });
    var h = hash(hs.join(','));
    if(!broken && idx && idx.h === h){
      SY.applied = h; SY.at = Date.now(); SY.msg = '';      /* 置き場と同じだった（送りも受けとりもしていない） */
      sySigSave(sigNow);
      return true;
    }
    var old = (!broken && idx && Array.isArray(idx.hs)) ? idx.hs : [];   /* こわれていたら、ぜんぶ置きなおす */
    for(var i = 0; i < parts.length; i++){
      if(old[i] === hs[i]) continue;                 /* 変わっていない切れはしは、送らない */
      await net.set(syDoc('p' + i), { d:parts[i], i:i, n:parts.length, h:hs[i], at:Date.now() });
    }
    await net.set(syDoc('idx'), { v:1, h:h, hs:hs, n:parts.length, z:pk.z, at:Date.now(), dev:syDev(), nm:syDevName(),
      imgs:await syImgIndex(net, idx) });
    SY.applied = h; SY.at = SY.pushedAt = Date.now(); SY.msg = '';
    /* 何を送ったか、記録しておく */
    if(!idx) syLogAdd('out', syDevName(), 'はじめて置き場を作りました' + (syDiffText(syDiff(null, sigNow)) ? '（' + syCountText(pay) + '）' : ''));
    else syLogAdd('out', syDevName(), syDiffText(syDiff(base || sySigOf(null), sigNow)));
    sySigSave(sigNow);
    return true;
  }catch(e){
    SY.msg = syErrText(e);
    return false;
  }finally{
    SY.busy = 0;
    if(SY.again){ SY.again = 0; syTouch(); }
    syTag();
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
  var before = sySigOf(S);
  var changed = syMerge(rem);
  SY.applied = idx.h; SY.at = SY.pulledAt = Date.now();
  if(changed) syLogAdd('in', (idx.nm && idx.dev !== syDev()) ? String(idx.nm).slice(0, 20) : syDevNameOf(idx.dev), syDiffText(syDiff(before, sySigOf(S))));
  sySigSave(sySigOf(rem));                           /* 置き場にあるのは、いま受けとった中身 */
  syTag();
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
  SY.msg = '';
  SY.connecting = 1; syTag();
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
        syTag();
        if(view.tab === 'set') syRender();
      });
    }, function(e){ SY.msg = syErrText(e); syTag(); });
    SY.msg = '';
    try{ var dv = await net.get(syDoc('devs')); SY.devs = (dv && dv.list && typeof dv.list === 'object') ? dv.list : {}; }catch(e){}
    await syPush();
    SY.connecting = 0;
    syHello();
    return true;
  }catch(e){
    SY.on = 0;
    SY.msg = syErrText(e);
    return false;
  }finally{
    SY.connecting = 0;
    syTag();
  }
}
function syStop(){
  if(SY.unsub){ try{ SY.unsub(); }catch(e){} SY.unsub = null; }
  clearTimeout(SY.timer); SY.timer = null;
  SY.on = 0;
  syTag();
}
/* いまのようす（上の表示と、設定で使う）：[しるし, ひとこと, くわしく] */
function syPhase(){
  if(!syReady()) return ['test', 'テストモード', '本物のデータにはふれません'];
  if(!SY.on && SY.off) return ['off', '同期をやめています', '設定から、また始められます'];
  if(typeof navigator !== 'undefined' && navigator.onLine === false) return ['off', 'オフライン', 'ネットにつながると、ひとりでに送ります'];
  if(!SY.on){
    if(SY.connecting) return ['wait', 'つないでいます…', ''];
    return ['ng', 'つながっていません', SY.msg || 'しばらくすると、ひとりでにつなぎなおします'];
  }
  if(SY.msg) return ['ng', '送れていません', SY.msg];
  if(SY.connecting || SY.busy || SY.timer) return ['busy', '同期中…', ''];
  if(!SY.at) return ['wait', 'つないでいます…', ''];
  return ['ok', '同期済み', '最後にたしかめた：' + hhmm(SY.at)];
}
/* 前からの呼び方（{on, text, sub}） */
function syState(){
  var p = syPhase();
  return { on:SY.on, text:p[1], sub:p[2], k:p[0] };
}
/* 上の「同期済み」の表示 */
function syTag(){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('synctag');
  if(!el) return;
  var p = syPhase();
  el.className = 'st st-' + p[0];
  el.setAttribute('data-act', 'sy-go');
  el.title = p[2] || p[1];
  el.textContent = p[1];
}
/* 「◯分前」 */
function syAgo(t){
  t = toNum(t);
  if(!t) return '—';
  var d = Math.max(0, Date.now() - t), m = Math.floor(d / 60000);
  if(m < 1) return 'たった今';
  if(m < 60) return m + '分前';
  var h = Math.floor(m / 60);
  if(h < 24) return h + '時間前';
  var dd = Math.floor(h / 24);
  if(dd < 30) return dd + '日前';
  var x = new Date(t);
  return (x.getMonth() + 1) + '/' + x.getDate();
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
    syTag();
    if(SY.on){ SY.msg = ''; syTouch(); return; }
    if(!SY.off && syReady()) syStart();
  });
  window.addEventListener('offline', syTag);
  /* つながっていないときは、1分ごとにつなぎなおしてみる */
  setInterval(function(){
    if(!SY.on && !SY.off && !SY.connecting && syReady() && !(typeof navigator !== 'undefined' && navigator.onLine === false)) syStart();
  }, 60000);
}
function hhmm(t){
  var d = new Date(t);
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

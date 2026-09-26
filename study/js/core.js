/* もんだいメーカー：土台（小道具・保存・写真・画面の描き直し）
   ============================================================
   このアプリは「くらしの手帳」とは別のアプリです。
   保存場所（localStorage・IndexedDB）も別なので、どちらかを消しても、もう一方は消えません。
   読みこむ順番：core → data → ai → files → subj → make → drill → lib → main */

var APP_NAME = 'もんだいメーカー';
var APP_BUILD = '2026-09-26b';

/* テストモード：?test=1 か、パソコンの中（localhost）で開いたとき。
   本物の保存にはさわらない（?real=1 で本番あつかい）。 */
var TEST_MODE = (function(){
  try{
    var q = location.search || '';
    if(/[?&]test=1\b/.test(q)) return true;
    if(/[?&]real=1\b/.test(q)) return false;
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  }catch(e){ return false; }
})();
var KEY = TEST_MODE ? 'mondai:v1:test' : 'mondai:v1';
var PDB_NAME = TEST_MODE ? 'mondai-photo-test' : 'mondai-photo';
var PDB_STORE = 'img';

/* ============================== 小さな道具 ============================== */
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function pad(n){ return (n < 10 ? '0' : '') + n; }
function toNum(v){ var n = Number(v); return isFinite(n) ? n : 0; }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function uid(p){ return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function ymdOf(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function today(){ return ymdOf(new Date()); }
function isYmd(s){ return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function shiftDate(ymd, days){
  if(!isYmd(ymd)) return '';
  var a = ymd.split('-');
  var d = new Date(Number(a[0]), Number(a[1]) - 1, Number(a[2]));
  d.setDate(d.getDate() + Number(days || 0));
  return ymdOf(d);
}
function dayDiff(a, b){
  if(!isYmd(a) || !isYmd(b)) return 0;
  var pa = a.split('-'), pb = b.split('-');
  var da = new Date(Number(pa[0]), Number(pa[1]) - 1, Number(pa[2]));
  var db = new Date(Number(pb[0]), Number(pb[1]) - 1, Number(pb[2]));
  return Math.round((db - da) / 86400000);
}
function mdText(ymd){
  if(!isYmd(ymd)) return '';
  var a = ymd.split('-');
  return (+a[1]) + '/' + (+a[2]);
}
function shuffle(a){
  for(var i = a.length - 1; i > 0; i--){
    var j = Math.floor(Math.random() * (i + 1)), x = a[i];
    a[i] = a[j]; a[j] = x;
  }
  return a;
}
/* さがすための形（全角→半角・カタカナ→ひらがな・記号をとる） */
function norm(s){
  s = String(s == null ? '' : s);
  try{ s = s.normalize('NFKC'); }catch(e){}
  s = s.toLowerCase().replace(/[ァ-ヶ]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  return s.replace(/[\s・･\-‐－―—_\/／\.．,，、。\(\)（）「」『』【】\[\]]/g, '');
}
function hash(s){
  var h = 5381;
  s = String(s || '');
  for(var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return String(h);
}
/* 「1,200」「約42滴」などから数だけ取り出す */
function numOf(v){
  var t = String(v == null ? '' : v);
  try{ t = t.normalize('NFKC'); }catch(e){}
  t = t.replace(/,/g, '');
  var m = t.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}
function round(v, keta){
  var p = Math.pow(10, keta || 0);
  return Math.round(Number(v) * p) / p;
}

/* ============================== 色 ============================== */
var COLORS = [
  { id:'c1', name:'サンゴ',     v:'#E2664B' }, { id:'c2', name:'オレンジ',   v:'#E08A2E' },
  { id:'c3', name:'イエロー',   v:'#C79A18' }, { id:'c4', name:'グリーン',   v:'#4E9A5B' },
  { id:'c5', name:'ミント',     v:'#3FA89A' }, { id:'c6', name:'スカイ',     v:'#3D8FC4' },
  { id:'c7', name:'ブルー',     v:'#4C68C0' }, { id:'c8', name:'パープル',   v:'#8163B8' },
  { id:'c9', name:'ピンク',     v:'#D25F94' }, { id:'c10', name:'グレー',    v:'#7A8290' }
];
function colorOf(id){
  for(var i = 0; i < COLORS.length; i++) if(COLORS[i].id === id) return COLORS[i].v;
  return COLORS[9].v;
}

/* ============================== 保存 ============================== */
var DEFAULT_SET = {
  key:'',          /* Gemini の APIキー（この端末の中だけに保存） */
  model:'',        /* 使うモデル（からのときはおまかせ） */
  goal:10,         /* 1日にとく問題の目標 */
  shuffle:1,       /* 4択の選択肢を毎回いれかえる */
  term:'',         /* いまの学期（例：2026前期） */
  allTerms:0,      /* ほかの学期の科目も出す */
  aiCount:0,       /* AIを呼んだ回数（へらせているか見るため） */
  aiSaved:0,       /* AIを使わずに作った問題の数 */
  /* 使ったぶんの記録（きょう・今月）。トークンの数は、Googleが返したそのままの数 */
  use:{ d:'', req:0, tin:0, tout:0, up:0, m:'', mreq:0, mtin:0, mtout:0, mup:0 },
  /* 無料のめやすと、お金のめやす（モデルや時期で変わるので、ここで直せる） */
  lim:{ rpd:20, ctx:1000000, yenIn:45, yenOut:375 }
};
var S = null;
function blankState(){
  return { ver:1, subs:[], mats:[], qs:[], notes:[], log:{}, day:{}, moc:[], why:{},
           del:{}, set:Object.assign({}, DEFAULT_SET), ui:{}, mt:0 };
}
function load(){
  var raw = null;
  try{ raw = localStorage.getItem(KEY); }catch(e){}
  var d = null;
  if(raw){ try{ d = JSON.parse(raw); }catch(e){ d = null; } }
  S = blankState();
  if(d && typeof d === 'object'){
    ['subs', 'mats', 'qs', 'moc', 'notes'].forEach(function(k){ if(Array.isArray(d[k])) S[k] = d[k]; });
    ['log', 'day', 'why', 'ui', 'del'].forEach(function(k){ if(d[k] && typeof d[k] === 'object') S[k] = d[k]; });
    S.set = Object.assign({}, DEFAULT_SET, (d.set && typeof d.set === 'object') ? d.set : {});
    S.mt = toNum(d.mt);
  }
  return S;
}
var saveTimer = null;
function save(){
  S.mt = Date.now();
  try{
    localStorage.setItem(KEY, JSON.stringify(S));
    if(typeof syTouch === 'function') syTouch();     /* ほかの端末にも、少ししてから送る */
    return true;
  }catch(e){
    toast('保存できませんでした（端末の空きが足りないかもしれません）', true);
    return false;
  }
}
/* 少し待ってからまとめて保存する（続けて書きかえるとき用） */
function saveSoon(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function(){ saveTimer = null; save(); }, 400);
}
function saveNow(){
  clearTimeout(saveTimer); saveTimer = null;
  return save();
}
/* 保存して、画面も描き直す */
function commit(){ saveNow(); render(); }

/* ============================== 写真（IndexedDB） ============================== */
var photoCache = {};
var photoDBP = null;
function photoDB(){
  if(photoDBP) return photoDBP;
  photoDBP = new Promise(function(res, rej){
    if(!window.indexedDB){ rej(new Error('この端末では写真をしまえません')); return; }
    var q = indexedDB.open(PDB_NAME, 1);
    q.onupgradeneeded = function(){ q.result.createObjectStore(PDB_STORE); };
    q.onsuccess = function(){ res(q.result); };
    q.onerror = function(){ rej(q.error || new Error('open')); };
  });
  return photoDBP;
}
function photoPut(id, dataUrl){
  return photoDB().then(function(db){
    return new Promise(function(res, rej){
      var tx = db.transaction(PDB_STORE, 'readwrite');
      tx.objectStore(PDB_STORE).put(dataUrl, id);
      tx.oncomplete = function(){ photoCache[id] = dataUrl; res(true); };
      tx.onerror = function(){ rej(tx.error || new Error('put')); };
    });
  });
}
function photoGet(id){
  if(photoCache[id] != null) return Promise.resolve(photoCache[id]);
  return photoDB().then(function(db){
    return new Promise(function(res){
      var tx = db.transaction(PDB_STORE, 'readonly');
      var q = tx.objectStore(PDB_STORE).get(id);
      q.onsuccess = function(){ if(q.result) photoCache[id] = q.result; res(q.result || null); };
      q.onerror = function(){ res(null); };
    });
  }).catch(function(){ return null; });
}
function photoDel(id){
  delete photoCache[id];
  return photoDB().then(function(db){
    return new Promise(function(res){
      var tx = db.transaction(PDB_STORE, 'readwrite');
      tx.objectStore(PDB_STORE)['delete'](id);
      tx.oncomplete = function(){ res(true); };
      tx.onerror = function(){ res(false); };
    });
  }).catch(function(){ return false; });
}
function photoKeys(){
  return photoDB().then(function(db){
    return new Promise(function(res){
      var tx = db.transaction(PDB_STORE, 'readonly');
      var q = tx.objectStore(PDB_STORE).getAllKeys();
      q.onsuccess = function(){ res(q.result || []); };
      q.onerror = function(){ res([]); };
    });
  }).catch(function(){ return []; });
}
/* <img data-pid="写真id"> に、しまってある写真を入れる（描き直すたびに呼ぶ） */
function photoFill(){
  var els = document.querySelectorAll('img[data-pid]');
  Array.prototype.forEach.call(els, function(el){
    if(el.dataset.done || el.dataset.wait) return;
    el.dataset.wait = '1';
    photoGet(el.dataset.pid).then(function(src){
      delete el.dataset.wait;
      if(src){ el.src = src; el.dataset.done = '1'; }
    });
  });
}
/* 使われていない写真を消す（ごみそうじ） */
async function photoSweep(){
  var used = {};
  S.mats.forEach(function(m){ (m.photos || []).forEach(function(p){ used[p] = 1; }); });
  S.qs.forEach(function(q){ if(q.pid) used[q.pid] = 1; });
  var keys = await photoKeys(), n = 0;
  for(var i = 0; i < keys.length; i++){
    if(!used[keys[i]]){ await photoDel(keys[i]); n++; }
  }
  return n;
}

/* ============================== 画像 ============================== */
function imgLoad(src){
  return new Promise(function(res, rej){
    var i = new Image();
    i.onload = function(){ res(i); };
    i.onerror = function(){ rej(new Error('写真を開けませんでした')); };
    i.src = src;
  });
}
function canvasOf(w, h){
  var cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
  return cv;
}
function readAs(f, how){
  return new Promise(function(res, rej){
    var r = new FileReader();
    r.onload = function(){ res(r.result); };
    r.onerror = function(){ rej(new Error('「' + f.name + '」を読めませんでした')); };
    if(how === 'buf') r.readAsArrayBuffer(f);
    else if(how === 'text') r.readAsText(f);
    else r.readAsDataURL(f);
  });
}
/* 写真を小さくして、data: の形にする */
async function resizeImage(file, maxSide, quality){
  var dataUrl = await readAs(file, 'url');
  var img = await imgLoad(dataUrl);
  var sc = Math.min(1, maxSide / Math.max(img.width, img.height));
  var cv = canvasOf(img.width * sc, img.height * sc);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', quality == null ? 0.82 : quality);
}

/* ============================== 画面の道具 ============================== */
var toastTimer = null;
function toast(msg, bad){
  var el = document.getElementById('toast');
  if(!el){ return; }
  el.textContent = String(msg == null ? '' : msg);
  el.className = 'on' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.className = ''; }, bad ? 4200 : 2600);
}
/* 文字を入れているところ（描き直すと消えてしまうので、あとまわしにする） */
function isTyping(){
  var a = document.activeElement;
  if(!a) return false;
  var t = (a.tagName || '').toLowerCase();
  return t === 'input' || t === 'textarea' || t === 'select';
}
var renderTimer = null;
function renderLater(){
  clearTimeout(renderTimer);
  renderTimer = setTimeout(function(){ renderTimer = null; render(); }, 600);
}
function renderSoft(){ if(isTyping()) renderLater(); else render(); }

/* 入力中の字を、描き直しても残しておく置き場 */
var INP = {};
function inVal(id, def){ var v = INP[id]; return v == null ? (def == null ? '' : def) : v; }
function elVal(id){
  var e = document.getElementById(id);
  if(e) return e.type === 'checkbox' ? e.checked : e.value;
  return inVal(id);
}
function inClear(prefix){
  Object.keys(INP).forEach(function(k){ if(k.indexOf(prefix) === 0) delete INP[k]; });
}
function inSet(id, v){
  INP[id] = v;
  var e = document.getElementById(id);
  if(e && e.value !== v) e.value = v;
}

/* 押したときの受け口（各ファイルが act を登録する） */
var ACTS = {};
function onAct(name, fn){ ACTS[name] = fn; }
function fireAct(name, el, ev){
  var fn = ACTS[name];
  if(!fn) return false;
  fn(el.dataset, el, ev);
  return true;
}

/* ============================== 画面の状態 ============================== */
var TABS = [
  ['home', '🏠', 'ホーム'],
  ['drill', '✍️', 'とく'],
  ['make', '📸', 'つくる'],
  ['note', '📝', 'メモ'],
  ['lib', '🗂', '科目'],
  ['set', '⚙️', '設定']
];
var view = { tab:'home' };
var VIEWS = {};                     /* タブid → 画面を作る関数 */
function onView(tab, fn){ VIEWS[tab] = fn; }
function go(tab, opt){
  /* 一度きりの画面（といたあとのまとめ・模擬テストの結果）は、タブを動いたら閉じる */
  view.after = null;
  view.mocEnd = '';
  view.tab = tab;
  if(opt) Object.keys(opt).forEach(function(k){ view[k] = opt[k]; });
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function render(){
  var app = document.getElementById('app');
  if(!app) return;
  var fn = VIEWS[view.tab] || VIEWS.home;
  var html = '';
  try{
    html = fn ? fn() : '';
  }catch(e){
    html = '<div class="card bad"><b>画面を出せませんでした</b><div class="s">' + esc(e.message) + '</div></div>';
    if(window.console) console.error(e);
  }
  app.innerHTML = html;
  var nav = document.getElementById('nav');
  if(nav){
    nav.innerHTML = TABS.map(function(t){
      return '<button type="button" class="navb' + (view.tab === t[0] ? ' on' : '') + '" data-act="tab" data-tab="' + t[0] + '" data-v="' + t[0] + '">' +
        '<span class="ic">' + t[1] + '</span><span class="tx">' + t[2] + '</span></button>';
    }).join('');
  }
  var ttl = document.getElementById('apptitle');
  if(ttl){
    var cur = TABS.filter(function(t){ return t[0] === view.tab; })[0];
    ttl.textContent = cur ? cur[2] : APP_NAME;
  }
  photoFill();
  if(typeof syTag === 'function') syTag();     /* 上の「同期済み」の表示 */
  /* 入力中だった字をもどす */
  Object.keys(INP).forEach(function(id){
    var e = document.getElementById(id);
    if(!e) return;
    if(e.type === 'checkbox'){ e.checked = !!INP[id]; }
    else if(e.value !== INP[id] && INP[id] != null){ e.value = INP[id]; }
  });
}

/* ============================== 押した・書いたを受ける ============================== */
function bindEvents(){
  document.addEventListener('click', function(ev){
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
    if(!el) return;
    var act = el.dataset.act;
    if(act === 'tab'){ go(el.dataset.tab || el.dataset.v); return; }
    if(fireAct(act, el, ev)) ev.preventDefault();
  });
  document.addEventListener('input', function(ev){
    var el = ev.target;
    if(!el || !el.id) return;
    if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'){
      INP[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    }
  });
  document.addEventListener('change', function(ev){
    var el = ev.target;
    if(!el || !el.tagName) return;
    if(el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return;
    if(el.id) INP[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    if(el.dataset && el.dataset.act) fireAct(el.dataset.act, el, ev);
  });
  window.addEventListener('beforeunload', function(){ if(saveTimer) saveNow(); });
  /* スマホでは閉じるときに beforeunload が来ないことがあるので、見えなくなったときにも保存する */
  window.addEventListener('pagehide', function(){ if(saveTimer) saveNow(); });
  document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'hidden' && saveTimer) saveNow(); });
}

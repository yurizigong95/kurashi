/* かんご実習メーカー：土台（小道具・保存・画面の描き直し）
   ============================================================
   このアプリは「くらしの手帳」「もんだいメーカー」とは別のアプリです。
   保存場所（localStorage）も別なので、どれかを消しても、ほかのアプリは消えません。
   あつかうのは、学習用の「架空の事例（ペーパーペイシェント）」だけです。
   読みこむ順番：core → data → ai → model → sync → ui → cases → work → chat → set → main */

var APP_NAME = 'かんご実習メーカー';
var APP_BUILD = '2026-10-24a';

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
var KEY = TEST_MODE ? 'care:v1:test' : 'care:v1';

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
function mdText(ymd){
  if(!isYmd(ymd)) return '';
  var a = ymd.split('-');
  return (+a[1]) + '/' + (+a[2]);
}
function hash(s){
  var h = 5381;
  s = String(s || '');
  for(var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return String(h);
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

/* ============================== 保存 ============================== */
var DEFAULT_SET = {
  key:'',          /* Gemini の APIキー（この端末の中だけに保存） */
  model:'',        /* 使うモデル（からのときはおまかせ） */
  aiCount:0,       /* AIを呼んだ回数 */
  /* 使ったぶんの記録（きょう・今月）。トークンの数は、Googleが返したそのままの数 */
  use:{ d:'', req:0, tin:0, tout:0, m:'', mreq:0, mtin:0, mtout:0 }
};
var S = null;
function blankState(){
  /* cases … 事例（看護過程の中身もいっしょに入る）・chats … AI壁打ちの記録（事例ごと） */
  return { ver:1, cases:[], chats:[], del:{}, set:Object.assign({}, DEFAULT_SET), ui:{}, seeded:0, mt:0 };
}
function load(){
  var raw = null;
  try{ raw = localStorage.getItem(KEY); }catch(e){}
  var d = null;
  if(raw){ try{ d = JSON.parse(raw); }catch(e){ d = null; } }
  S = blankState();
  if(d && typeof d === 'object'){
    ['cases', 'chats'].forEach(function(k){ if(Array.isArray(d[k])) S[k] = d[k]; });
    ['ui', 'del'].forEach(function(k){ if(d[k] && typeof d[k] === 'object') S[k] = d[k]; });
    S.set = Object.assign({}, DEFAULT_SET, (d.set && typeof d.set === 'object') ? d.set : {});
    S.seeded = toNum(d.seeded);
    S.mt = toNum(d.mt);
  }
  S.cases = S.cases.map(caseFix).filter(Boolean);
  /* はじめて開いたときだけ、学習用の事例を3つ入れておく */
  if(!S.seeded){
    seedCases(false);
    S.seeded = 1;
    try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){}
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
/* 少し待ってからまとめて保存する（字を打っているあいだ用） */
function saveSoon(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function(){ saveTimer = null; save(); }, 600);
}
function saveNow(){
  clearTimeout(saveTimer); saveTimer = null;
  return save();
}
/* 保存して、画面も描き直す */
function commit(){ saveNow(); render(); }

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

/* 入力中の字を、描き直しても残しておく置き場（id のある入力らんだけ） */
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
  ['cases', '📚', '事例'],
  ['work', '🩺', '看護過程'],
  ['chat', '💬', 'AI壁打ち'],
  ['set', '⚙️', '設定']
];
var view = { tab:'cases' };
var VIEWS = {};                     /* タブid → 画面を作る関数 */
function onView(tab, fn){ VIEWS[tab] = fn; }
function go(tab, opt){
  view.tab = tab;
  if(opt) Object.keys(opt).forEach(function(k){ view[k] = opt[k]; });
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function render(){
  var app = document.getElementById('app');
  if(!app) return;
  var fn = VIEWS[view.tab] || VIEWS.cases;
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
      return '<button type="button" class="navb' + (view.tab === t[0] ? ' on' : '') + '" data-act="tab" data-tab="' + t[0] + '">' +
        '<span class="ic">' + t[1] + '</span><span class="tx">' + t[2] + '</span></button>';
    }).join('');
  }
  var ttl = document.getElementById('apptitle');
  if(ttl){
    var cur = TABS.filter(function(t){ return t[0] === view.tab; })[0];
    ttl.textContent = cur ? cur[2] : APP_NAME;
  }
  if(typeof syTag === 'function') syTag();     /* 上の「同期済み」の表示 */
  /* 入力中だった字をもどす */
  Object.keys(INP).forEach(function(id){
    var e = document.getElementById(id);
    if(!e) return;
    if(e.type === 'checkbox'){ e.checked = !!INP[id]; }
    else if(e.value !== INP[id] && INP[id] != null){ e.value = INP[id]; }
  });
  if(typeof afterRender === 'function') afterRender();
}

/* ============================== 押した・書いたを受ける ============================== */
function bindEvents(){
  document.addEventListener('click', function(ev){
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
    if(!el) return;
    /* 入力らん・えらぶ箱の act は、書いた・えらんだときだけ */
    var tg = String(el.tagName || '').toUpperCase();
    if(tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
    var act = el.dataset.act;
    if(act === 'tab'){ go(el.dataset.tab || el.dataset.v); return; }
    if(fireAct(act, el, ev)) ev.preventDefault();
  });
  document.addEventListener('input', function(ev){
    var el = ev.target;
    if(!el || !el.tagName) return;
    if(el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return;
    if(el.id) INP[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    /* data-live のついた欄は、打つたびに中身へ入れる（保存は少し待ってまとめて） */
    if(el.dataset && el.dataset.live && el.dataset.act) fireAct(el.dataset.act, el, ev);
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

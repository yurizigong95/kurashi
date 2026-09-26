/* もんだいメーカー：テストの土台
   アプリを iframe で開いて、本物と同じように押したり書いたりして確かめます。
   ?test=1 で開くので、ふだんの保存（localStorage・IndexedDB）にはさわりません。 */

var T = [];
var W = null;                    /* アプリの window */
var aiCalls = [];
var upCalls = [];                /* 大きな資料を預けた回数（にせのアップロード） */

function test(name, fn){ T.push({ name:name, fn:fn }); }
function ok(cond, msg){ if(!cond) throw new Error(msg || 'ちがいます'); }
function eq(got, want, msg){
  var a = JSON.stringify(got), b = JSON.stringify(want);
  if(a !== b) throw new Error((msg || '') + '：' + a + ' ≠ ' + b);
}
function J(v){ return JSON.parse(JSON.stringify(v)); }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
async function until(fn, ms, what){
  var end = Date.now() + (ms || 4000);
  while(Date.now() < end){
    var v = false;
    try{ v = fn(); }catch(e){ v = false; }
    if(v) return v;
    await sleep(30);
  }
  throw new Error('時間ぎれ：' + (what || '待ちました'));
}
function frames(n){
  return new Promise(function(res){
    var i = 0;
    (function step(){
      if(++i >= (n || 2)) return res();
      W.requestAnimationFrame ? W.requestAnimationFrame(step) : setTimeout(step, 16);
    })();
  });
}
/* アプリを立ち上げる */
function boot(){
  return new Promise(function(res, rej){
    var f = document.createElement('iframe');
    f.id = 'app';
    f.src = '../index.html?test=1';
    f.onload = function(){
      W = f.contentWindow;
      until(function(){ return W.__MK_OK && W.document.getElementById('app'); }, 8000, 'アプリの起動').then(function(){ res(W); }, rej);
    };
    document.getElementById('frame').appendChild(f);
  });
}
/* まっさらにする */
async function fresh(){
  W.S = W.blankState();
  W.INP = {};
  W.run = null;
  W.mk.files = []; W.mk.pv = null; W.mk.mode = 'file'; W.mk.opt.noai = 0; W.mk.opt.types = ['mc', 'tf', 'cloze'];
  W.mk.mat = { no:'', memo:'', at:'', title:'' };
  W.drill.why = {};
  W.lib.tab = 'sub'; W.lib.edit = ''; W.lib.qEdit = ''; W.lib.del = ''; W.lib.matFilter = ''; W.lib.qtype = ''; W.lib.star = 0; W.lib.q = '';
  if(W.nt){ W.nt = { edit:'', q:'', sub:'', star:0, del:'' }; }
  W.view = { tab:'home', sub:'', unit:'' };
  try{ W.localStorage.removeItem(W.KEY + ':run'); }catch(e){}
  W.saveNow();
  aiCalls = [];
  upCalls = [];
  W.__FAKE_AI = null;
  W.__FAKE_UPLOAD = null;
  W.__FAKE_FETCH = null;
  W.__FAKE_GAS = null;
  if(W.gn){ W.gn = { open:0, busy:'', msg:'', items:null, err:'', why:'', folder:'', q:'', pick:{}, from:'' }; }
  W.mk.linkMsg = ''; W.mk.linkFails = [];
  if(W.syStop) W.syStop();
  W.__FAKE_SYNC = null;
  if(W.SY){
    W.SY.applied = ''; W.SY.at = 0; W.SY.msg = ''; W.SY.busy = 0; W.SY.again = 0; W.SY.renderWait = 0;
    W.SY.pushedAt = 0; W.SY.pulledAt = 0; W.SY.sig = null; W.SY.devs = {}; W.SY.devAt = 0; W.SY.off = 0; W.SY.connecting = 0;
  }
  try{ W.localStorage.removeItem(W.KEY + ':syncsig'); W.localStorage.removeItem(W.KEY + ':synclog'); W.localStorage.removeItem('mondai:devname'); }catch(e){}
  W.mk.busy = ''; W.mk.warp = null;
  W.render();
  await frames();
}
/* 画面の道具 */
function $(sel){ return W.document.querySelector(sel); }
function $$(sel){ return Array.prototype.slice.call(W.document.querySelectorAll(sel)); }
function actEl(act, v){
  var sel = '[data-act="' + act + '"]' + (v == null ? '' : '[data-v="' + v + '"]');
  return $(sel);
}
async function click(act, v){
  var el = actEl(act, v);
  if(!el) throw new Error('ボタンが見つかりません：' + act + (v == null ? '' : '／' + v));
  el.click();
  await frames();
  return el;
}
async function clickEl(el){
  if(!el) throw new Error('ボタンが見つかりません');
  el.click();
  await frames();
}
async function type(id, value){
  var el = W.document.getElementById(id);
  if(!el) throw new Error('入力らんが見つかりません：' + id);
  el.value = value;
  el.dispatchEvent(new W.Event('input', { bubbles:true }));
  await frames();
}
function text(){ return W.document.getElementById('app').textContent; }
function has(s){ return text().indexOf(s) >= 0; }
/* にせのAI（本物は呼ばない） */
function fakeAI(fn){
  W.__FAKE_AI = async function(req){
    aiCalls.push(req);
    var v = await fn(req, aiCalls.length);
    return (typeof v === 'string') ? { text:v } : v;
  };
}
function aiJsonReply(obj){ return { text:JSON.stringify(obj) }; }
/* にせの「大きな資料を預ける」（本物のアップロードはしない） */
function fakeUpload(fn){
  W.__FAKE_UPLOAD = async function(info){
    upCalls.push(info);
    var v = fn ? await fn(info, upCalls.length) : null;
    return v || { uri:'https://example.test/files/' + upCalls.length, mime:info.type || 'application/octet-stream', name:info.name };
  };
}

/* ===== 走らせる ===== */
async function runAll(){
  var list = document.getElementById('list'), sum = document.getElementById('sum');
  list.innerHTML = '';
  var okN = 0, ngN = 0;
  sum.textContent = 'アプリを立ち上げています…';
  try{ await boot(); }
  catch(e){ sum.className = 'ng'; sum.textContent = '立ち上げに失敗：' + e.message; return; }
  var only = (String(location.search).match(/[?&]only=([^&]*)/) || [])[1];
  if(only) only = decodeURIComponent(only);
  for(var i = 0; i < T.length; i++){
    var t = T[i];
    if(only && t.name.indexOf(only) < 0) continue;
    var li = document.createElement('li');
    li.className = 'run';
    li.innerHTML = '<span class="mark">…</span> <span class="t"></span>';
    li.querySelector('.t').textContent = t.name;
    list.appendChild(li);
    var st = Date.now();
    try{
      await fresh();
      await t.fn();
      li.className = 'ok';
      li.querySelector('.mark').textContent = '✓';
      okN++;
    }catch(e){
      li.className = 'ng';
      li.querySelector('.mark').textContent = '✗';
      var m = document.createElement('span');
      m.className = 'msg';
      m.textContent = (e && e.message) || String(e);
      li.appendChild(m);
      ngN++;
      if(window.console) console.error(t.name, e);
    }
    var ms = document.createElement('span');
    ms.className = 'ms';
    ms.textContent = (Date.now() - st) + 'ms';
    li.appendChild(ms);
    sum.textContent = '成功 ' + okN + '件 ／ 失敗 ' + ngN + '件';
  }
  sum.className = ngN ? 'ng' : 'ok';
  sum.textContent = '成功 ' + okN + '件 ／ 失敗 ' + ngN + '件 ／ 全部 ' + (okN + ngN) + '件';
  window.__KT_DONE = { ok:okN, ng:ngN };
  /* GitHub の自動テスト（tools/ci-run.mjs）が読む形 */
  window.__TEST_RESULT = {
    pass:okN, fail:ngN, total:okN + ngN,
    fails:Array.prototype.map.call(document.querySelectorAll('li.ng'), function(li){ return li.textContent.trim(); })
  };
}
window.addEventListener('load', function(){
  document.getElementById('again').onclick = function(){ location.reload(); };
  setTimeout(runAll, 60);
});

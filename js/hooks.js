/* くらしの手帳：機能を足すための差しこみ口（新しい機能は、ここに登録してつなぐ） */
/* ============================== 差しこみ口 ==============================
   新しい機能のファイル（js/m-*.js）は、アプリの本体を直さずに、ここの関数で自分を登録する。
   ・kmView(appId, fn)                … タブの画面（fn() → HTML）
   ・kmAction(fn)                     … ボタンの操作（fn(act, t, e) → 自分の操作なら true）
   ・kmSettings({ id, title, note, html, after }) … 設定画面のたためる枠（after … その枠の後ろに出す）
   ・kmPart(page, id, title, fn)      … ページの枠（page … today / tomo / life / course / todo / work / cal）
                                          fn(ctx) → HTML。today・tomo の ctx は { ymd, isToday }
   ・kmStudy({ id, icon, title, desc, view, order }) … 「勉強」タブの道具（view() → HTML）
   ・kmJobs(fn)                       … 通知の予定（fn(add, prefs, now)。add(id, at, title, body, extra)）
   ・kmJobText(fn)                    … 通知の文を変える（fn(job) → job）
   ・kmInbox(kind, fn)                … 橋わたし・ショートカットから届いたもの（fn(item, ymd, min) → 知らせる文）
   ・kmSummary(fn)                    … ウィジェット・Discord用のまとめに足す（fn(summary)）
   ・kmSearch(fn)                     … アプリ全体の検索（fn(q) → [{ kind, title, sub, act, attrs }]）
   ・kmCheck(fn)                      … データの自動チェック（fn() → [{ level:'warn'|'ng', msg, fix:function }]）
   ・kmAiData(name, desc, fn)         … AIが読めるデータ（fn(opt) → JSON にできるもの）
   ・kmChatTool(decl, run)            … AIそうだんの道具（decl … Geminiの関数の説明、run(args) → { result, op }）  */
var KM = { views:{}, actions:[], settings:[], parts:{}, study:[], jobs:[], jobText:[], inbox:{}, summary:[], search:[], checks:[], aiData:{}, chatTools:[] };
function kmView(appId, fn){ KM.views[appId] = fn; }
function kmAction(fn){ KM.actions.push(fn); }
function kmSettings(o){ KM.settings.push(o); }
function kmPart(page, id, title, fn){
  KM.parts[page] = KM.parts[page] || {};
  KM.parts[page][id] = fn;
  if(typeof PAGE_SECTIONS !== 'undefined'){
    PAGE_SECTIONS[page] = PAGE_SECTIONS[page] || [];
    if(!PAGE_SECTIONS[page].some(function(x){ return x[0] === id; })) PAGE_SECTIONS[page].push([id, title]);
  }
}
function kmStudy(o){ KM.study.push(o); KM.study.sort(function(a, b){ return (a.order || 50) - (b.order || 50); }); }
function kmJobs(fn){ KM.jobs.push(fn); }
function kmJobText(fn){ KM.jobText.push(fn); }
function kmInbox(kind, fn){ KM.inbox[kind] = fn; }
function kmSummary(fn){ KM.summary.push(fn); }
function kmSearch(fn){ KM.search.push(fn); }
function kmCheck(fn){ KM.checks.push(fn); }
function kmAiData(name, desc, fn){ KM.aiData[name] = { desc:desc, fn:fn }; }
function kmChatTool(decl, run){ KM.chatTools.push({ decl:decl, run:run }); }

/* ===== 本体から呼ぶ ===== */
/* ページの枠に、登録された枠を足す（エラーが出ても、ほかの枠は出す） */
function kmParts(page, parts, ctx){
  var add = KM.parts[page] || {};
  Object.keys(add).forEach(function(id){
    if(parts[id]) return;
    parts[id] = function(){
      try{ return add[id](ctx || {}) || ''; }
      catch(e){ kmErr(page + '/' + id, e); return ''; }
    };
  });
  return parts;
}
function kmRunAction(act, t, e){
  for(var i = 0; i < KM.actions.length; i++){
    try{ if(KM.actions[i](act, t, e)) return true; }
    catch(err){ kmErr('操作 ' + act, err); toast('うまくいきませんでした：' + (err && err.message || err), true); return true; }
  }
  return false;
}
function kmSettingsHtml(after){
  return KM.settings.filter(function(o){ return (o.after || '') === (after || ''); }).map(function(o){
    var note = '', inner = '';
    try{ note = typeof o.note === 'function' ? o.note() : (o.note || null); }catch(e){ note = null; }
    try{ inner = o.html(); }catch(e){ kmErr('設定 ' + o.id, e); inner = '<div class="msg ng">表示できませんでした：' + esc(e.message || e) + '</div>'; }
    return foldSection(o.id, o.title, note, inner);
  }).join('');
}
function kmJobsAdd(add, prefs, now){
  KM.jobs.forEach(function(fn){ try{ fn(add, prefs, now); }catch(e){ kmErr('通知の予定', e); } });
}
function kmJobsText(jobs){
  if(!KM.jobText.length) return jobs;
  return jobs.map(function(j){
    var o = j;
    KM.jobText.forEach(function(fn){ try{ o = fn(o) || o; }catch(e){ kmErr('通知の文', e); } });
    return o;
  });
}
function kmInboxApply(it, ymd, min){
  var fn = KM.inbox[it && it.kind];
  if(!fn) return null;
  try{ return fn(it, ymd, min) || ''; }catch(e){ kmErr('受け取り ' + it.kind, e); return ''; }
}
function kmSummaryAdd(s){
  KM.summary.forEach(function(fn){ try{ fn(s); }catch(e){ kmErr('まとめ', e); } });
  return s;
}
function kmErr(where, e){
  if(typeof logErr === 'function') logErr(where, String(e && e.message || e));
}

/* ============================== 「勉強」タブ ============================== */
var studyTool = '';
function viewStudy(){
  var tool = KM.study.filter(function(x){ return x.id === studyTool; })[0];
  if(tool){
    var inner = '';
    try{ inner = tool.view(); }catch(e){ kmErr('勉強 ' + tool.id, e); inner = '<div class="msg ng">表示できませんでした：' + esc(e.message || e) + '</div>'; }
    return '<div class="pillrow studyback"><button data-act="study-open" data-v="">‹ 勉強の道具</button><b class="studyttl">' + esc(tool.icon + ' ' + tool.title) + '</b></div>' + inner;
  }
  if(!KM.study.length) return section('勉強', null, '<div class="empty">道具がまだありません。</div>');
  return section('勉強の道具', KM.study.length + 'こ',
    '<div class="studygrid">' + KM.study.map(function(x){
      var badge = '';
      try{ badge = typeof x.badge === 'function' ? (x.badge() || '') : ''; }catch(e){}
      return '<button class="studycard" data-act="study-open" data-v="' + esc(x.id) + '">' +
        '<span class="si" aria-hidden="true">' + esc(x.icon || '📘') + '</span>' +
        '<span class="st">' + esc(x.title) + (badge ? '<i class="sb">' + esc(badge) + '</i>' : '') + '</span>' +
        '<span class="sd">' + esc(x.desc || '') + '</span></button>';
    }).join('') + '</div>');
}
kmView('study', viewStudy);
kmAction(function(act, t){
  if(act !== 'study-open') return false;
  studyTool = t.dataset.v || '';
  render(); window.scrollTo(0, 0);
  return true;
});

/* ============================== 外のAPIを読む ==============================
   ブラウザから直接読めるところは直接。だめなとき（CORS など）は、橋わたし（v3）に代わりに読んでもらう。
   読んでよい場所は、橋わたしの側でも決めてある（PROXY_HOSTS）。 */
function kmFake(name){
  try{ if(window[name]) return window[name]; }catch(e){}
  try{ if(window.parent && window.parent !== window && window.parent[name]) return window.parent[name]; }catch(e){}
  return null;
}
async function apiGet(url, opt){
  opt = opt || {};
  if(TEST_MODE){
    var fa = kmFake('__FAKE_API');
    var fk = fa ? await fa(url) : null;
    if(fk == null) throw new Error('読めませんでした');
    return fk;
  }
  if(!opt.proxyOnly){
    try{
      var res = await withTimeout(fetch(url, { cache:'no-store' }), 15000, '外のサービス');
      if(res.ok) return await res.text();
    }catch(e){ /* 直接は読めなかった */ }
  }
  if(typeof gasReady === 'function' && gasReady() && toNum(GAS.ver) >= 3){
    var r = await gasCall('proxyGet', { url:url });
    return r.text;
  }
  throw new Error('読めませんでした（Google連携を新しい版にすると読めることがあります）');
}
async function apiJson(url, opt){ return JSON.parse(await apiGet(url, opt)); }

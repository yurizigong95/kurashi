/* くらしの手帳：ぜんぶを合わせた点検（足した機能どうし・AIが読めるか・検索・表示・通知・橋わたし） */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq;

/* t0 のあとに増えたエラーの記録（同期のわざとの失敗・テストのわざとの記録はのぞく） */
function errsSince(w, t0){
  return (w.errLogAll() || []).filter(function(x){ return x.t >= t0 && !/^(同期|テスト)$/.test(x.w); })
    .map(function(x){ return '[' + x.w + '] ' + x.m; });
}
function closeAll(w){
  var doc = w.document;
  try{ if(doc.getElementById('detail').classList.contains('on')) w.closeDetail(); }catch(e){}
  ['sheet', 'veil', 'viewer', 'fabmenu'].forEach(function(id){ var el = doc.getElementById(id); if(el) el.classList.remove('on'); });
}

KT.test('総点検：AIが、足した機能のデータもぜんぶ読める（分野・計算した数字・道具の名前）', async function(){
  var A = KT.frames().A;
  var secIds = A.AI_SECTIONS.map(function(s){ return s.id; });
  /* S のキーは、どれかの分野に入っているか、外す理由がある */
  var covered = {};
  A.AI_SECTIONS.forEach(function(s){ s.keys.forEach(function(k){ covered[k] = s.id; }); });
  eq(Object.keys(A.S).filter(function(k){ return !covered[k] && !A.AI_EXCLUDE[k]; }).join(','), '', 'AIが読めないデータ');
  /* 足した機能の数字（kmAiData）：分野が正しく、エラーなく、大きすぎない */
  var names = Object.keys(A.KM.aiData), bad = [];
  ok(names.length >= 20, '足した機能の数字が少ない：' + names.length);
  names.forEach(function(nm){
    var ad = A.KM.aiData[nm];
    var sec = ad.section || (ad.fn && ad.fn.section);
    if(!sec || secIds.indexOf(sec) < 0) bad.push(nm + '（分野 ' + sec + '）');
    try{
      var s = JSON.stringify(A.aiSan(ad.fn({})));
      if(s && s.length > 30000) bad.push(nm + '（' + s.length + '文字）');
    }catch(e){ bad.push(nm + '（' + (e && e.message || e) + '）'); }
  });
  eq(bad.join('、'), '', '足した機能の数字');
  /* 分野ごとに読むと、その分野の数字がエラーなしで入っている */
  var miss = [];
  A.AI_SECTIONS.forEach(function(s){
    var r = A.aiSectionData(s.id, { limit:5 });
    if(!r || r.error){ miss.push(s.id + '：' + (r && r.error)); return; }
    names.forEach(function(nm){
      if(A.c9AiSectionOf(A.KM.aiData[nm]) !== s.id) return;
      if(!(nm in r)) miss.push(s.id + ' に ' + nm + ' がない');
      else if(r[nm] && r[nm].error) miss.push(nm + '：' + r[nm].error);
    });
    var t = A.aiDataRun({ name:'get_app_data', args:{ section:s.id, limit:5 } });
    if(!t || typeof t.result !== 'string' || t.result.length > 40200) miss.push(s.id + ' の道具の答え');
  });
  eq(miss.join('、'), '', '分野ごとに読む');
  /* 目次に、足した機能の数字の名前がぜんぶ出る */
  eq(A.aiOverview().extras.length, names.length, '目次の数字の名前');
  /* 足した機能の汎用の置き場（kmItems）も、ことばでさがせる */
  A.S.kmItems.push({ id:'km_final_probe', mt:Date.now(), mod:'final', type:'probe', text:'そうてんけんのしるし' });
  try{
    var h = A.aiSearchAll('そうてんけんのしるし');
    ok(h.count >= 1 && h.hits.some(function(x){ return x.section === 'more'; }), '足した機能の記録がさがせない');
  }finally{ A.S.kmItems = A.S.kmItems.filter(function(x){ return x.id !== 'km_final_probe'; }); }
  /* AIの道具：名前がぶつからない・形が正しい・読む道具はいつも渡す */
  var seen = {}, dup = [];
  A.CHAT_FUNCS.concat(A.AI_DATA_FUNCS, A.KM.chatTools.map(function(x){ return x.decl; })).forEach(function(d){
    if(!d || !d.name){ dup.push('名前なし'); return; }
    if(seen[d.name]) dup.push(d.name + '（2つある）');
    seen[d.name] = 1;
    if(!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(d.name)) dup.push(d.name + '（名前の形）');
    if(!d.description) dup.push(d.name + '（説明なし）');
    if(d.parameters && d.parameters.type !== 'OBJECT') dup.push(d.name + '（parameters）');
  });
  eq(dup.join('、'), '', 'AIの道具');
  var keepDirect = A.aiDirectOn;
  A.aiDirectOn = function(){ return false; };
  try{
    var sent = A.chatFuncDecls().map(function(d){ return d.name; });
    var need = A.AI_DATA_FUNCS.map(function(d){ return d.name; }).concat(A.KM.chatTools.filter(function(x){ return !x.write; }).map(function(x){ return x.decl.name; }));
    eq(need.filter(function(n){ return sent.indexOf(n) < 0; }).join(','), '', '読む道具は「直接登録」がオフでも渡す');
    eq(A.KM.chatTools.filter(function(x){ return x.write && sent.indexOf(x.decl.name) >= 0; }).length, 0, '書く道具は「直接登録」がオフのとき渡さない');
  }finally{ A.aiDirectOn = keepDirect; }
});

KT.test('総点検：全体検索で、足した機能の結果を押しても、エラーにならない', async function(){
  var fr = KT.frames(), A = fr.A, B = fr.B, doc = A.document;
  var qs = ['BP', '血圧', '心臓', '手洗い', 'インスリン', 'ワクチン', '睡眠', '暑さ', '作戦', '1週間', 'シフト', '通学', '授業',
            'ぼうし', 'リボン', 'おさんぽ', 'キャラ', 'ねこ', 'テスト', 'ノート', 'レポート', '論文', '法', '看護', 'bgm'];
  var list = [], per = {};
  qs.forEach(function(q){
    A.c9Search(q).forEach(function(g){
      g.items.forEach(function(x){
        if(!x.act || x.act === 'c9-open') return;            /* 本体の結果は「全体＋」のテストで確かめている */
        var key = x.act + '|' + g.kind;
        per[key] = (per[key] || 0) + 1;
        if(per[key] <= 2) list.push({ q:q, kind:g.kind, x:x });
      });
    });
  });
  ok(list.length >= 15, '足した機能の検索の結果が少ない：' + list.length + '（' + Object.keys(per).join(',') + '）');
  var fails = [];
  for(var i = 0; i < list.length; i++){
    var it = list[i], t0 = Date.now();
    A.appId = 'today'; A.render();
    doc.getElementById('c9sbtn').click();
    A.c9Q = it.q;
    var box = doc.getElementById('c9_res');
    box.innerHTML = A.c9HitRow(it.x);
    var row = box.querySelector('[data-act]');
    try{ row.click(); }catch(e){ fails.push(it.kind + '「' + it.x.title + '」：' + e.message); }
    await KT.sleep(40);
    var es = errsSince(A, t0);
    if(es.length) fails.push(it.kind + '「' + String(it.x.title).slice(0, 20) + '」（' + it.x.act + '）：' + es.join(' / '));
    if(/表示できませんでした/.test(doc.getElementById('app').textContent)) fails.push(it.kind + '「' + it.x.title + '」：表示できない画面');
    closeAll(A);
    A.studyTool = '';
  }
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  eq(fails.join('\n'), '', '押したときのエラー');
  await KT.settle([A, B]);
});

KT.test('総点検：勉強の道具・設定の枠・ページの枠をぜんぶ描いても、エラーが出ず、中身も変わらない', async function(){
  var fr = KT.frames(), A = fr.A, B = fr.B, doc = A.document;
  await KT.settle([A, B]);
  var snap = function(){ var o = A.payloadCore(); delete o.notices; return A.canon(o) + '|' + A.canon(A.S.meta); };
  var before = snap(), t0 = Date.now(), bad = [];
  /* 勉強の道具 */
  A.KM.study.forEach(function(x){
    A.appId = 'study'; A.studyTool = x.id; A.render();
    if(/表示できませんでした/.test(doc.getElementById('app').textContent)) bad.push('勉強の道具 ' + x.id);
  });
  A.studyTool = '';
  /* 足した機能の設定の枠（ぜんぶ開いて描く。開いた印はもとにもどす） */
  var keepOpen = A.S.ui.setOpen;
  A.appId = 'set'; A.render();
  var open = {};
  Object.keys(keepOpen || {}).forEach(function(k){ open[k] = keepOpen[k]; });
  [].forEach.call(doc.querySelectorAll('[data-act="fold"][data-id]'), function(b){ open[b.dataset.id] = 1; });
  A.KM.settings.forEach(function(o){ open[o.id] = 1; });
  A.S.ui.setOpen = open;
  try{
    A.render();
    if(/表示できませんでした/.test(doc.getElementById('app').textContent)) bad.push('設定の画面');
    var afters = {};
    A.KM.settings.forEach(function(o){ afters[o.after || ''] = 1; });
    Object.keys(afters).forEach(function(af){ if(/表示できませんでした/.test(A.kmSettingsHtml(af))) bad.push('設定の枠（' + (af || '最後') + '）'); });
  }finally{ A.S.ui.setOpen = keepOpen; }
  /* ページの枠（足した機能） */
  Object.keys(A.KM.parts).forEach(function(pg){
    Object.keys(A.KM.parts[pg]).forEach(function(id){
      var ctx = pg === 'today' ? { ymd:A.today(), isToday:true } : pg === 'tomo' ? { ymd:A.shiftDate(A.today(), 1), isToday:false } : {};
      try{ A.KM.parts[pg][id](ctx); }catch(e){ bad.push(pg + '/' + id + '：' + (e && e.message || e)); }
    });
  });
  /* 今日タブのサブページ・ぜんぶのタブ */
  ['today', 'tomo', 'week', 'life'].forEach(function(t){ A.appId = 'today'; A.todayTab = t; A.render(); });
  A.TAB_DEFS.forEach(function(t){ A.appId = t[0]; A.render(); });
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  bad = bad.concat(errsSince(A, t0));
  eq(bad.join('\n'), '', '描いたときのエラー');
  A.persist();
  var after = snap();
  if(before !== after){
    var b = JSON.parse(before.split('|')[0]), a = JSON.parse(after.split('|')[0]);
    throw new Error('表示しただけで変わった：' + (Object.keys(a).filter(function(k){ return A.canon(a[k]) !== A.canon(b[k]); }).join(',') || 'meta'));
  }
});

KT.test('総点検：通知の予定・ウィジェットのまとめ・データの点検が、足した機能があっても動く', async function(){
  var A = KT.frames().A;
  var keep = A.S.ui.notify;
  A.S.ui.notify = Object.assign({}, keep || {}, { push:1, discord:1 });
  var jobs, jobs2;
  try{ jobs = A.notifyJobs(); jobs2 = A.notifyJobs(); }finally{ A.S.ui.notify = keep; }
  ok(Array.isArray(jobs), '通知の予定');
  var ids = {}, bad = [];
  jobs.forEach(function(j){
    if(!j.id || typeof j.title !== 'string' || !j.title) bad.push('題がない ' + j.id);
    if(ids[j.id]) bad.push('同じid ' + j.id);
    ids[j.id] = 1;
    if(String(j.body || '').length > 400) bad.push('本文が長い ' + j.id);
    if(!(j.at > Date.now() - 60000)) bad.push('時刻 ' + j.id);
  });
  eq(bad.join(','), '', '通知の予定の形');
  eq(A.canon(jobs), A.canon(jobs2), '2回作っても同じ（送り直しを続けない）');
  var s = JSON.stringify(A.buildSummary());
  ok(s.length < 60000, 'まとめが大きすぎる：' + s.length);
  var cl = A.c9Checks();
  ok(Array.isArray(cl), 'データの点検');
});

KT.test('総点検：橋わたし（gas/Code.gs）が読めて、アプリが使う窓口がぜんぶある', async function(){
  var src = await fetch('../gas/Code.gs', { cache:'no-store' }).then(function(r){ return r.text(); });
  try{ new Function(src + '\n;return typeof doPost;'); }catch(e){ throw new Error('Code.gs の書き方がおかしい：' + e.message); }
  var html = await fetch('../index.html', { cache:'no-store' }).then(function(r){ return r.text(); });
  var files = (html.match(/src="js\/[^"]+\.js"/g) || []).map(function(m){ return '../' + m.slice(5, -1); });
  var actions = {}, gets = {};
  for(var i = 0; i < files.length; i++){
    var js = await fetch(files[i], { cache:'no-store' }).then(function(r){ return r.text(); });
    (js.match(/gasCall\(\s*'[A-Za-z0-9_]+'/g) || []).forEach(function(m){ actions[m.replace(/^gasCall\(\s*'|'$/g, '')] = files[i]; });
    (js.match(/shortUrl\(\s*'[A-Za-z0-9_]+'/g) || []).forEach(function(m){ gets[m.replace(/^shortUrl\(\s*'|'$/g, '')] = files[i]; });
  }
  ok(Object.keys(actions).length >= 10, 'アプリが使う窓口：' + Object.keys(actions).join(','));
  var noAct = Object.keys(actions).filter(function(a){ return src.indexOf("case '" + a + "'") < 0; });
  eq(noAct.map(function(a){ return a + '（' + actions[a] + '）'; }).join(','), '', '橋わたしに無い窓口');
  var noGet = Object.keys(gets).filter(function(a){ return src.indexOf("'" + a + "'") < 0; });
  eq(noGet.map(function(a){ return a + '（' + gets[a] + '）'; }).join(','), '', '橋わたしに無いURLの窓口');
});
})();

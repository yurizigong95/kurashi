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
  /* ちがうときは、どの通知がちがうかを出す */
  var byId2 = {}; jobs2.forEach(function(j){ byId2[j.id] = j; });
  var diff = jobs.filter(function(j){ return A.canon(j) !== A.canon(byId2[j.id]); })
    .map(function(j){ return j.id + '：' + A.canon(j).slice(0, 160) + ' ≠ ' + A.canon(byId2[j.id] || null).slice(0, 160); });
  if(jobs.length !== jobs2.length) diff.push('数 ' + jobs.length + '≠' + jobs2.length);
  eq(diff.join('\n'), '', '2回作っても同じ（送り直しを続けない）');
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

(function(){
'use strict';
var ok = KT.ok;
KT.test('総点検：看護過程の記録は、AIの道具で読むときも患者さんの名前を伏せる', async function(){
  var A = KT.frames().A;
  var probe = { id:'km_final_np', mt:Date.now(), mod:'research', type:'nproc', title:'山田花子様の看護過程',
    data:{ s:'山田花子様（78歳）は「痛い」と話す。電話番号 090-1234-5678' } };
  A.S.kmItems.push(probe);
  try{
    var sec = JSON.stringify(A.aiSectionData('more', { limit:200 }));
    ok(sec.indexOf('km_final_np') >= 0, '記録そのものは読める');
    ok(sec.indexOf('山田花子') < 0 && sec.indexOf('090-1234-5678') < 0, '名前・電話番号が見える：' + sec.slice(sec.indexOf('km_final_np') - 20, sec.indexOf('km_final_np') + 200));
    var hit = JSON.stringify(A.aiSearchAll('看護過程'));
    ok(hit.indexOf('山田花子') < 0, 'ことばでさがしたときも伏せる');
  }finally{ A.S.kmItems = A.S.kmItems.filter(function(x){ return x.id !== 'km_final_np'; }); }
});
})();

(function(){
'use strict';
var ok = KT.ok, eq = KT.eq;
/* にせAI：「ながい答えのテスト」には、上限で2回切れる答えを返す */
KT.ai.push(function(req){
  var cs = req.contents || [], last = cs[cs.length - 1] || {};
  var said = (last.parts || []).map(function(p){ return p.text || ''; }).join('');
  if(/ながい答えのテスト/.test(said)) return { text:'前半の答え。', finishReason:'MAX_TOKENS' };
  if(/続きだけを書いて/.test(said)){
    var sofar = ((cs[cs.length - 2] || {}).parts || []).map(function(p){ return p.text || ''; }).join('');
    if(sofar === '前半の答え。') return { text:'まんなか。', finishReason:'MAX_TOKENS' };
    if(sofar === '前半の答え。まんなか。') return '後半でおわり。';
  }
  return null;
});
KT.test('総点検：AIそうだんの答えが長くても、途中で切らずに1回で全部出す', async function(){
  var A = KT.frames().A;
  A.appId = 'chat'; A.chatRoom = 'main'; A.render();
  var n0 = KT.aiCalls.length;
  await A.chatSend('ながい答えのテスト');
  var m = A.roomMsgs()[A.roomMsgs().length - 1];
  eq(m.text, '前半の答え。まんなか。後半でおわり。', '切れた答えを、続きとつないで1つにする');
  ok(!/途中まで|続きを教えて/.test(m.text), '「途中までです」のお知らせを出さない');
  eq(KT.aiCalls.length - n0, 3, 'AIに聞いた回数（はじめ＋続き2回）');
  var cont = KT.aiCalls[KT.aiCalls.length - 1];
  eq(cont.tools.length, 0, '手帳を調べていないときは、続きに道具を渡さない');
  ok(/後半でおわり/.test(A.document.getElementById('app').textContent), '画面にも全部出る');
  A.appId = 'today'; A.render();
});
})();

(function(){
'use strict';
var ok = KT.ok, eq = KT.eq;
function txt(c){ return ((c || {}).parts || []).map(function(p){ return p.text || ''; }).join(''); }
/* にせAI：続きをもらうときに通信が切れる／手帳を調べたあとで答えが切れる */
KT.ai.push(function(req){
  var cs = req.contents || [], last = cs[cs.length - 1] || {}, said = txt(last);
  var asked = cs.filter(function(c){ return c.role === 'user'; }).map(txt).join('|');
  if(/つうしんが切れるテスト/.test(said)) return { text:'ここまでは届いた答え。', finishReason:'MAX_TOKENS' };
  if(/続きだけを書いて/.test(said) && txt(cs[cs.length - 2]) === 'ここまでは届いた答え。') return Promise.reject(new Error('通信が切れました'));
  if(/しらべてながく答えるテスト/.test(said)) return { parts:[{ functionCall:{ name:'search_app', args:{ query:'ながく答える' } } }] };
  var fr = (last.parts || []).filter(function(p){ return p.functionResponse; })[0];
  if(fr && /しらべてながく答えるテスト/.test(asked)) return { text:'調べた前半。', finishReason:'MAX_TOKENS' };
  if(/続きだけを書いて/.test(said) && txt(cs[cs.length - 2]) === '調べた前半。'){
    return req.tools.indexOf('functions') >= 0 ? '調べた後半。' : '（道具の説明がなかった）';
  }
  return null;
});
KT.test('総点検：AIそうだんの続きがもらえなくても、届いたところまでは出す・手帳を調べたあとの続き', async function(){
  var A = KT.frames().A;
  A.appId = 'chat'; A.chatRoom = 'main'; A.render();
  await A.chatSend('つうしんが切れるテスト');
  var m = A.roomMsgs()[A.roomMsgs().length - 1];
  eq(m.text, 'ここまでは届いた答え。', '続きで失敗しても、届いた答えは消さない');
  await A.chatSend('しらべてながく答えるテスト');
  m = A.roomMsgs()[A.roomMsgs().length - 1];
  eq(m.text, '調べた前半。調べた後半。', '手帳を調べたあとの答えも、続きとつなぐ（道具の説明もいっしょに送る）');
  ok(!/途中まで/.test(m.text), 'お知らせを出さない');
  A.appId = 'today'; A.render();
});
})();

(function(){
'use strict';
var ok = KT.ok, eq = KT.eq;
KT.test('総点検：パソコンでGoogle連携を貼り直したら、スマホも同期で気づいて新しい版を使う（URLが変わっても）', async function(){
  var fr = KT.frames(), A = fr.A, B = fr.B;
  var OLD = 'https://script.google.com/macros/s/old-deploy/exec', NEW = 'https://script.google.com/macros/s/new-deploy/exec';
  var keep = { a:JSON.stringify(A.GAS), b:JSON.stringify(B.GAS), ver:KT.gasState.ver };
  var on = true, badNew = false;
  /* にせの橋わたし：新しいURLは新しい版（api 4）、古いURLは古い版のまま（ここで呼ぶのはスマホ＝B だけ） */
  var fake = function(req){
    if(!on || req.action !== 'ping') return null;
    if(B.GAS.url === NEW && badNew) return { ok:false, error:'合言葉がちがいます' };
    return { ok:true, user:'test@example.com', ver:3, api:B.GAS.url === NEW ? 4 : 0, trigger:true };
  };
  KT.gas.push(fake);
  try{
    /* 前のテストで配られた版は、いったん空にする */
    A.S.cloud.gasVer = { gasUrl:'', ver:0, api:0, mt:Date.now() }; A.touch('cloud'); A.commit();
    await KT.settle([A, B]);
    /* パソコン（A）：新しくデプロイし直して、つながるか試した */
    A.GAS.url = NEW; A.GAS.token = 'tok'; A.GAS.ver = 3; A.GAS.api = 4; A.saveGas();
    ok(A.gasVerShare(), '新しい版を同期で配る');
    A.commit();
    ok(!A.gasVerShare(), '同じ版なら、もう書かない（2台で書き合わない）');
    /* スマホ（B）：古いURL・古い版のまま */
    B.GAS.url = OLD; B.GAS.token = 'tok'; B.GAS.ver = 3; B.GAS.api = 0; B.GAS.catchAt = 0; B.saveGas();
    await KT.until(function(){ return B.gasBehind(); }, 15000, 'スマホに「新しい版がある」が同期で届く');
    B.gasUrlShare();
    eq(B.S.cloud.gasUrl, NEW, 'スマホが古いURLで上書きしない');
    /* 新しいURLが合言葉で使えないときは、もとのURLのまま */
    badNew = true;
    eq(await B.gasCatchUp(), false, '新しいURLにつながらないとき');
    eq(B.GAS.url, OLD, 'もとのURLのまま');
    /* つながるときは、新しいURLに移って、新しい版として使う */
    badNew = false; B.GAS.catchAt = 0; B.saveGas();
    eq(await B.gasCatchUp(), true, '追いつく');
    eq(B.GAS.url, NEW, '新しいURLに移る');
    eq(B.GAS.api, 4, '新しい版になる');
    ok(!B.gasBehind() && B.l2V4(), '新しい機能が使える');
    ok(!B.gasVerShare(), 'スマホは書かない（同じ版）');
  }finally{
    on = false;
    KT.gas.splice(KT.gas.indexOf(fake), 1);
    A.S.cloud.gasVer = { gasUrl:'', ver:0, api:0, mt:Date.now() }; A.touch('cloud'); A.commit();
    ['url', 'token', 'ver', 'api', 'catchAt', 'pingAt', 'user'].forEach(function(k){
      var a = JSON.parse(keep.a), b = JSON.parse(keep.b);
      A.GAS[k] = a[k]; B.GAS[k] = b[k];
    });
    A.saveGas(); B.saveGas(); KT.gasState.ver = keep.ver;
  }
  await KT.settle([A, B]);
});
})();

(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;
KT.test('総点検：手帳の中身を橋わたしに預ける（カギは入らない・変わったときだけ送る）', async function(){
  var A = KT.frames().A, sent = [];
  var keep = JSON.stringify(A.GAS), keepKey = A.S.settings.geminiKey;
  var fake = function(req){ if(req.action !== 'aiDataPut') return null; sent.push(req.data); return { ok:true, size:JSON.stringify(req.data).length }; };
  KT.gas.push(fake);
  try{
    /* 中身：分野がぜんぶ入って、大きすぎない */
    A.S.settings.geminiKey = 'SECRET_GEMINI_SNAPSHOT_1234'; A.commit();
    var snap = A.aiSnapshot(250000);
    ok(snap && snap.sections && snap.overview, 'まとめを作れる');
    eq(Object.keys(snap.sections).length, A.AI_SECTIONS.length, '分野がぜんぶ入る');
    var str = JSON.stringify(snap);
    ok(str.length <= 250000, '決めた大きさにおさまる：' + str.length);
    ok(str.indexOf('SECRET_GEMINI_SNAPSHOT') < 0, 'カギが入ってしまう');
    ok(str.indexOf(String(A.S.settings.room || 'x-no-room-x')) < 0 || !A.S.settings.room, '同期の部屋の名前が入ってしまう');
    eq(snap.build, A.APP_BUILD, 'アプリの版も入る');
    /* 橋わたし（新しい版）につながっているときだけ送る */
    A.GAS.url = 'https://script.google.com/macros/s/test/exec'; A.GAS.token = 'tok'; A.GAS.ver = 3; A.GAS.api = 4; A.saveGas();
    A.l2Local('aiData', null);
    eq(await A.l2AiPush(true), false, '古い橋わたしには送らない');
    A.GAS.api = 5; A.saveGas();
    eq(await A.l2AiPush(true), true, '新しい橋わたしには送る');
    eq(sent.length, 1, '1回だけ送る');
    ok(sent[0].sections && sent[0].sections.money && sent[0].today === A.today(), '中身が入っている');
    /* 変わっていなければ送らない・変わったら送る */
    var st = A.l2Local('aiData');
    A.l2Local('aiData', Object.assign({}, st, { at:Date.now() - 20 * 60000 }));
    eq(await A.l2AiPush(false), false, '変わっていなければ送らない');
    A.S.events.push(J(A, { id:'ev_snap_test', date:A.today(), title:'まとめのテストの予定', kind:'other', mt:Date.now() }));
    A.commit();
    A.l2Local('aiData', Object.assign({}, A.l2AiSt(), { at:Date.now() - 20 * 60000 }));
    eq(await A.l2AiPush(false), true, '変わったら送る');
    ok(JSON.stringify(sent[1]).indexOf('まとめのテストの予定') >= 0, '新しい予定も入る');
    /* 設定でオフにできる */
    A.l2PrefSet({ aiData:0 }); A.commit();
    A.l2Local('aiData', Object.assign({}, A.l2AiSt(), { at:Date.now() - 20 * 60000 }));
    eq(await A.l2AiPush(false), false, '「預けない」にすると送らない');
  }finally{
    KT.gas.splice(KT.gas.indexOf(fake), 1);
    A.l2PrefSet({ aiData:1 });
    A.removeItem('events', 'ev_snap_test');
    A.S.settings.geminiKey = keepKey;
    var g = JSON.parse(keep);
    ['url', 'token', 'ver', 'api'].forEach(function(k){ A.GAS[k] = g[k]; });
    A.saveGas(); A.l2Local('aiData', null); A.commit();
  }
  await KT.settle([A, KT.frames().B]);
});
})();

(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;
KT.test('総点検：通知の中身（今日のまとめ・明日の準備・テスト・バイト）と、種類の印', async function(){
  var A = KT.frames().A;
  var keep = A.S.ui.notify, td = A.today(), d2 = A.shiftDate(td, 2), d3 = A.shiftDate(td, 3);
  A.S.ui.notify = Object.assign({}, keep || {}, { push:1, discord:1, am:1, night:1, exam:1, exam3:1, work1:1, quiet:0 });
  A.S.tasks.push(J(A, { id:'tk_nt1', title:'通知のテストの課題', subject:'', due:d2, time:'', done:0, subs:[], photos:[], memo:'', mt:Date.now() }));
  A.S.exams.push(J(A, { id:'ex_nt1', subject:'解剖生理学', title:'小テスト', date:d3, time:'09:00', kind:'quiz', room:'A101', memo:'', photos:[], mt:Date.now() }));
  A.S.shifts.push(J(A, { id:'wk_nt1', title:'バイト', date:d2, start:'17:00', end:'21:00', realEnd:'', ot:0, rate:0, memo:'', photos:[], mt:Date.now() }));
  A.commit();
  var jobs;
  try{ jobs = A.notifyJobs(); }finally{ A.S.ui.notify = keep; }
  var by = function(pre){ return jobs.filter(function(j){ return j.id.indexOf(pre) === 0; }); };
  eq(jobs.filter(function(j){ return !j.cat; }).length, 0, 'どの通知にも種類の印がある');
  /* 朝の「今日のまとめ」 */
  var am = by('am-')[0];
  ok(am && am.cat === 'today' && am.wx === 1 && /今日のまとめ/.test(am.title), '朝のまとめ');
  ok(/📚/.test(am.body), '1限のこと');
  /* 夜の「明日の準備」 */
  var nt = by('nt-')[0];
  ok(nt && nt.cat === 'today' && nt.wx === 2, '夜の明日の準備（明日の天気を入れ直す印）');
  eq(new Date(nt.at).getHours(), 22, '22時に知らせる');
  /* テスト（3日前・前日・当日） */
  ok(by('e3-').length === 1 && by('e3-')[0].cat === 'exam', 'テストの3日前');
  ok(/解剖/.test(by('e3-')[0].body), 'テストの中身');
  ok(by('e1-').length >= 1 && by('e0-').length >= 1, 'テストの前日と当日');
  /* バイトの前日の夜 */
  var w1 = by('w1-')[0];
  ok(w1 && w1.cat === 'work' && /17:00/.test(w1.body), 'バイトの前日の夜：' + (w1 && w1.body));
  eq(new Date(w1.at).getHours(), 20, '夜20時');
  /* 締切は「しめきり」の種類 */
  ok(by('d0-').concat(by('d1-')).every(function(j){ return j.cat === 'due'; }), '締切の種類');
  /* 今日のまとめに、その日の課題・テスト・バイトが入る */
  var am2 = by('am-').filter(function(j){ return j.id === 'am-' + d2; })[0];
  ok(am2 && /通知のテストの課題/.test(am2.body) && /バイト/.test(am2.body), 'その日の課題とバイト：' + (am2 && am2.body));
  A.removeItem('tasks', 'tk_nt1'); A.removeItem('exams', 'ex_nt1'); A.removeItem('shifts', 'wk_nt1');
  A.commit();
  await KT.settle([A, KT.frames().B]);
});
})();

(function(){
'use strict';
var ok = KT.ok, eq = KT.eq;
KT.test('総点検：何もしていないのに手帳を送り直さない・朝の時刻は7:30にそろう', async function(){
  var A = KT.frames().A, sent = 0;
  var keepGas = JSON.stringify(A.GAS), keepN = A.S.ui.notify;
  var fake = function(req){ if(req.action !== 'aiDataPut') return null; sent++; return { ok:true, size:100 }; };
  KT.gas.push(fake);
  try{
    A.GAS.url = 'https://script.google.com/macros/s/test/exec'; A.GAS.token = 'tok'; A.GAS.ver = 3; A.GAS.api = 5; A.saveGas();
    A.l2PrefSet({ aiData:1 }); A.l2Local('aiData', null);
    eq(await A.l2AiPush(true), true, 'はじめの1回');
    /* 10分たっても、中身が同じなら送らない（時刻・おせわの子の数字が変わっても） */
    A.l2Local('aiData', Object.assign({}, A.l2AiSt(), { at:Date.now() - 20 * 60000 }));
    var realNow = A.aiOverview;
    A.aiOverview = function(){ var o = realNow(); o.now = '23:59'; return o; };
    try{ eq(await A.l2AiPush(false), false, '時刻が変わっただけでは送らない'); }finally{ A.aiOverview = realNow; }
    eq(sent, 1, '送ったのは1回だけ');
    /* 朝の時刻：前のはじめの時刻（6:45）のままの人は 7:30 に。自分で保存した人は、そのまま */
    A.S.ui.notify = { amTime:'06:45' };
    eq(A.notifyPrefs().amTime, '07:30', '前のはじめの時刻は 7:30 にそろえる');
    A.S.ui.notify = { amTime:'06:45', amSet:1 };
    eq(A.notifyPrefs().amTime, '06:45', '自分で保存した時刻は、そのまま');
    A.S.ui.notify = { amTime:'06:10' };
    eq(A.notifyPrefs().amTime, '06:10', 'ほかの時刻も、そのまま');
  }finally{
    KT.gas.splice(KT.gas.indexOf(fake), 1);
    A.S.ui.notify = keepN;
    var g = JSON.parse(keepGas);
    ['url', 'token', 'ver', 'api'].forEach(function(k){ A.GAS[k] = g[k]; });
    A.saveGas(); A.l2Local('aiData', null);
  }
});
})();

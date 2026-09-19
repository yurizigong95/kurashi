/* くらしの手帳：検索・文字の大きさ・ホーム画面・データの点検・今日の自動評価・AIが全部を読める のテスト（KT.test で足す） */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;

/* AIのにせもの：「家計簿の明細」と聞かれたら、手帳を調べる道具を使う */
KT.ai.push(function(req){
  if(req.tag !== 'chat') return null;
  var last = (req.contents || [])[req.contents.length - 1] || {};
  var said = (last.parts || []).map(function(p){ return p.text || ''; }).join('');
  var fr = (last.parts || []).filter(function(p){ return p.functionResponse; })[0];
  if(fr && fr.functionResponse.name === 'get_app_data') return '調べました：' + String(fr.functionResponse.response.result).slice(0, 4000);
  if(/家計簿の明細を調べて/.test(said)) return { parts:[{ functionCall:{ name:'get_app_data', args:{ section:'money', query:'テスト用のパン屋' } } }] };
  return null;
});

KT.test('AI：アプリのすべての情報を読める（分野にもれがない・カギは見せない・道具で調べる）', async function(){
  var A = KT.frames().A;
  /* どのキーも、どこかの分野に入っているか、外す理由が書いてある */
  var covered = {};
  A.AI_SECTIONS.forEach(function(s){ s.keys.forEach(function(k){ covered[k] = s.id; }); });
  var missing = Object.keys(A.S).filter(function(k){ return !covered[k] && !A.AI_EXCLUDE[k]; });
  eq(missing.join(','), '', 'AIが読めないデータ');
  /* 同期するものもぜんぶ入っている */
  var partKeys = [];
  Object.keys(A.SYNC_PARTS).forEach(function(p){ A.SYNC_PARTS[p].keys.forEach(function(k){ partKeys.push(k); }); });
  var missing2 = partKeys.filter(function(k){ return !covered[k] && !A.AI_EXCLUDE[k]; });
  eq(missing2.join(','), '', 'AIが読めない同期データ');
  /* どの分野も読める */
  A.AI_SECTIONS.forEach(function(s){
    var r = A.aiSectionData(s.id, { limit:5 });
    ok(r && !r.error && r.section === s.id, s.id + ' が読めない：' + (r && r.error));
    ok(JSON.stringify(r).length > 10, s.id);
  });
  /* カギ・合言葉・同期の部屋は出さない */
  var keep = { g:A.S.settings.geminiKey, a:A.S.settings.apiKey };
  A.S.settings.geminiKey = 'SECRET_GEMINI_12345'; A.S.settings.apiKey = 'SECRET_CLAUDE_67890';
  A.S.cloud = A.S.cloud || {}; var keepLinks = A.S.cloud.links;
  A.S.cloud.links = J(A, { shortKey:'SECRETSHORTKEY1234567', mt:1 });
  var all = A.AI_SECTIONS.map(function(s){ return JSON.stringify(A.aiSectionData(s.id, { limit:200 })); }).join('\n') + JSON.stringify(A.aiSearchAll('SECRET'));
  ok(all.indexOf('SECRET_GEMINI') < 0 && all.indexOf('SECRET_CLAUDE') < 0 && all.indexOf('SECRETSHORTKEY') < 0, 'カギが見えてしまう');
  ok(all.indexOf(String(A.S.settings.room || 'x-no-room-x')) < 0 || !A.S.settings.room, '同期の部屋の名前が見えてしまう');
  A.S.settings.geminiKey = keep.g; A.S.settings.apiKey = keep.a; A.S.cloud.links = keepLinks;
  /* 授業の教室（room）は見せる */
  var cm = A.aiSectionData('timetable', {});
  ok(cm.courses && cm.nextDays && cm.nextDays.length === 14, '時間割と14日ぶん');
  /* 家計簿の明細を、AIが道具で調べて答える */
  A.kbAdd({ amount:432, title:'テスト用のパン屋', date:A.today(), src:'hand', ref:'test-bakery' });
  A.commit();
  var r2 = await A.chatAsk({ system:A.chatSystem(), contents:[{ role:'user', parts:[{ text:'家計簿の明細を調べて' }] }], text:'家計簿の明細を調べて' });
  ok(/テスト用のパン屋/.test(r2.text) && /432/.test(r2.text), 'AIが家計簿の明細を読める：' + String(r2.text).slice(0, 120));
  eq((r2.ops || []).length, 0, '読むだけなので、何も登録しない');
  var chatReq = KT.aiCalls.filter(function(c){ return c.tag === 'chat'; }).pop();
  ok(/手帳を調べる/.test(chatReq.system) && /money/.test(chatReq.system), '道具で調べるように、分野の一覧をわたす');
  /* ことばで、ぜんぶをさがす */
  var s = A.aiSearchAll('テスト用のパン屋');
  ok(s.count >= 1 && s.hits.some(function(h){ return h.section === 'money'; }), 'ことばでさがせる');
  var ov = A.aiOverview();
  ok(ov.sections.length === A.AI_SECTIONS.length && ov.today === A.today(), '目次');
  A.S.spends = A.S.spends.filter(function(x){ return x.ref !== 'test-bakery'; }); A.commit();
});

/* ============================== 全体＋（検索・文字の大きさ・ホーム画面・データの点検・今日の自動評価） ============================== */
function sectionsOf(doc, re){
  return [].filter.call(doc.querySelectorAll('#app section'), function(s){ var h = s.querySelector('.head h2'); return h && re.test(h.textContent); });
}
function typeIn(w, el, text){
  el.value = text;
  el.dispatchEvent(new w.Event('input', { bubbles:true }));
}

KT.test('全体＋：文字の大きさを5段階と「システムに合わせる」から見本を見て選べて、375px でもはみ出さず、相手にも届く', async function(){
  var fr = KT.frames(), A = fr.A, B = fr.B, doc = A.document;
  KT.freshWrites([A, B]);
  A.S.ui.setOpen = A.S.ui.setOpen || {}; A.S.ui.setOpen.s1 = 1;
  A.appId = 'set'; A.render();
  eq(doc.querySelectorAll('.c9fsgrid [data-act="set-fs"]').length, 6, '5段階＋システムに合わせる');
  ok(doc.querySelector('.c9fsdemo'), '見本の文');
  var size = function(){ return parseFloat(A.getComputedStyle(doc.body).fontSize); };
  var sizes = {};
  ['xs', 's', 'm', 'l', 'xl'].forEach(function(id){
    doc.querySelector('.c9fsgrid [data-v="' + id + '"]').click();
    eq(doc.body.getAttribute('data-fs'), id, 'body の印');
    ok(doc.querySelector('.c9fsgrid [data-v="' + id + '"]').classList.contains('on'), '選んだものに印');
    sizes[id] = size();
  });
  ok(sizes.xs < sizes.s && sizes.s < sizes.m && sizes.m < sizes.l && sizes.l < sizes.xl, '大きさの順：' + JSON.stringify(sizes));
  eq(sizes.m, 15, 'ふつうは今までと同じ15px');
  /* とても大きいでも、375px の画面からはみ出さない */
  var fA = document.getElementById('f-A'), w0 = fA.style.width;
  fA.style.width = '375px';
  await KT.sleep(120);
  var over = [];
  [['today', 'today'], ['today', 'life'], ['set', null], ['c9search', null], ['study', null], ['todo', null], ['cal', 'cal'], ['money', 'home'], ['anki', null]].forEach(function(p){
    A.appId = p[0];
    if(p[0] === 'c9search'){ A.c9TempApp = 'c9search'; A.c9Q = 'かんご'; }
    if(p[0] === 'today') A.todayTab = p[1];
    if(p[0] === 'cal') A.calTab = p[1];
    if(p[0] === 'money') A.payTab = p[1];
    A.render();
    var de = doc.documentElement;
    if(de.scrollWidth > de.clientWidth + 1) over.push(p.join('/') + '：' + de.scrollWidth + '>' + de.clientWidth);
    var h1 = doc.getElementById('apptitle');
    if(h1.scrollWidth > h1.clientWidth + 1) over.push(p[0] + ' の見出し：' + h1.scrollWidth + '>' + h1.clientWidth);
  });
  A.S.ui.setOpen.c9home = 1; A.appId = 'set'; A.render();
  if(doc.documentElement.scrollWidth > doc.documentElement.clientWidth + 1) over.push('ホーム画面の設定');
  A.S.ui.setOpen.c9home = 0;
  fA.style.width = w0;
  ok(!over.length, 'はみ出した：' + over.join('／'));
  /* システムに合わせる */
  A.appId = 'set'; A.render();
  doc.querySelector('.c9fsgrid [data-v="sys"]').click();
  eq(doc.body.getAttribute('data-fs'), 'sys', 'システムに合わせる');
  eq(doc.documentElement.getAttribute('data-fs'), 'sys', 'html にも印');
  ok(size() >= 11 && size() <= 24, 'システムの大きさ：' + size());
  await KT.until(function(){ return B.S.ui.fs === 'sys' && B.document.body.getAttribute('data-fs') === 'sys'; }, 10000, '相手の端末にも届く');
  await KT.settle([A, B]);
  A.appId = 'set'; A.render();
  doc.querySelector('.c9fsgrid [data-v="m"]').click();
  A.S.ui.setOpen.s1 = 0; A.touch('ui'); A.commit();
  await KT.settle([A, B]);
  await KT.until(function(){ return B.S.ui.fs === 'm'; }, 15000, 'ふつうにもどす');
  A.appId = 'today'; A.todayTab = 'today'; A.render();
});

KT.test('全体＋：ホーム画面に出すもの・並び・タブを1つの画面で変えられて（ドラッグ・見本つき）、はじめの並びにもどせる', async function(){
  var fr = KT.frames(), A = fr.A, B = fr.B, doc = A.document;
  KT.freshWrites([A, B]);
  A.S.ui.setOpen = A.S.ui.setOpen || {}; A.S.ui.setOpen.c9home = 1;
  A.c9HomePg = 'today'; A.appId = 'set'; A.render();
  var list = function(kind){ return doc.querySelector('.c9hlist[data-kind="' + kind + '"]'); };
  var ids0 = [].map.call(list('page').querySelectorAll('.c9hrow'), function(r){ return r.dataset.id; });
  eq(ids0[0], 'c9yday', '「きのうの評価」がいちばん上');
  ok(ids0.indexOf('weather') >= 0 && ids0.indexOf('memo') >= 0 && ids0.indexOf('classes') >= 0, '今日の枠がならぶ：' + ids0.join(','));
  ok(doc.querySelector('.c9phone') && /天気/.test(doc.querySelector('.c9phone').textContent), '見本');
  ok(list('tab') && list('sub'), '上のタブ・今日タブの中のタブも同じ画面');
  ok(!doc.querySelector('[data-id="tabSettings"]'), '前の「タブの表示と順番」はまとめた');
  /* ↓ で動かす */
  list('page').querySelector('[data-act="c9-home-mv"][data-id="' + ids0[0] + '"][data-d="1"]').click();
  eq(A.pageOrder('today')[1], ids0[0], '下へ動いた');
  eq(A.pageOrder('today')[0], ids0[1], '入れかわった');
  /* 出さない */
  list('page').querySelector('[data-act="c9-home-tg"][data-id="weather"]').click();
  ok(A.pageHidden('today', 'weather'), '天気を出さない');
  ok(!/天気/.test(doc.querySelector('.c9phone').textContent), '見本からも消える');
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(!doc.querySelector('[data-act="today-toggle"][data-id="weather"]'), '今日タブに天気が出ない');
  ok(doc.querySelector('[data-act="c9-go-home"]'), '今日タブから、この画面へ行ける');
  doc.querySelector('[data-act="c9-go-home"]').click();
  eq(A.appId, 'set', '設定へ');
  /* ドラッグ：メモをいちばん上へ */
  var rowMemo = list('page').querySelector('.c9hrow[data-id="memo"]'), top = list('page').querySelector('.c9hrow');
  var y0 = top.getBoundingClientRect().top + 2, y1 = rowMemo.getBoundingClientRect().top + 5;
  var P = A.PointerEvent || A.MouseEvent;
  rowMemo.querySelector('.c9grip').dispatchEvent(new P('pointerdown', { bubbles:true, cancelable:true, pointerId:7, clientX:10, clientY:y1 }));
  doc.dispatchEvent(new P('pointermove', { bubbles:true, cancelable:true, pointerId:7, clientX:10, clientY:y0 }));
  doc.dispatchEvent(new P('pointerup', { bubbles:true, cancelable:true, pointerId:7, clientX:10, clientY:y0 }));
  eq(A.pageOrder('today')[0], 'memo', 'ドラッグで一番上へ');
  /* 上のタブ：お知らせを出す・並べかえ */
  list('tab').querySelector('[data-act="c9-home-tg"][data-id="news"]').click();
  ok(A.S.ui.tabs.filter(function(t){ return t[0] === 'news'; })[0][1], 'お知らせのタブを出す');
  ok(doc.querySelector('#apps [data-app="news"]'), '上のタブに出る');
  ok(!list('tab').querySelector('[data-act="c9-home-tg"][data-id="set"]'), '設定のタブはいつも出す');
  list('tab').querySelector('[data-act="c9-home-mv"][data-id="tt"][data-d="-1"]').click();
  eq(A.S.ui.tabs[0][0], 'tt', 'タブの並べかえ');
  /* 今日タブの中のタブ */
  list('sub').querySelector('[data-act="c9-home-tg"][data-id="week"]').click();
  ok(!A.subVisible('today').some(function(t){ return t[0] === 'week'; }), '今週をかくす');
  await KT.settle([A, B]);
  await KT.until(function(){ return B.pageOrder('today')[0] === 'memo'; }, 15000, '相手にも届く（並び）');
  await KT.until(function(){ return B.pageHidden('today', 'weather'); }, 15000, '相手にも届く（出さない）');
  await KT.until(function(){ return B.S.ui.tabs[0][0] === 'tt'; }, 15000, '相手にも届く（タブ）');
  /* はじめの並びにもどす → 取り消す → もう一度もどす */
  doc.querySelector('[data-act="c9-home-reset"]').click();
  ok(!A.pageHidden('today', 'weather') && A.pageOrder('today')[0] === 'c9yday', '今日の枠がもどった');
  ok(!A.S.ui.tabs.filter(function(t){ return t[0] === 'news'; })[0][1] && A.S.ui.tabs[0][0] === 'today', 'タブももどった');
  ok(A.subVisible('today').some(function(t){ return t[0] === 'week'; }), '中のタブももどった');
  var ub = doc.getElementById('undoBtn');
  ok(ub, '「取り消す」が出る');
  ub.click();
  eq(A.pageOrder('today')[0], 'memo', '取り消すと、まえの並びにもどる');
  A.appId = 'set'; A.render();
  doc.querySelector('[data-act="c9-home-reset"]').click();
  A.S.ui.setOpen.c9home = 0; A.touch('ui'); A.commit();
  await KT.settle([A, B]);
  await KT.until(function(){ return !B.pageHidden('today', 'weather') && B.S.ui.tabs[0][0] === 'today'; }, 15000, '相手でももどる');
  A.appId = 'today'; A.todayTab = 'today'; A.render();
});

KT.test('全体＋：アプリ全体の検索（ひらがな・カタカナ・全角半角・種類ごと・押すとその場所・最近さがしたことば・足した機能）', async function(){
  var fr = KT.frames(), A = fr.A, B = fr.B, doc = A.document;
  KT.freshWrites([A, B]);
  var td = A.today(), d5 = A.shiftDate(td, 5), now = Date.now();
  A.S.events.push(J(A, { id:'ev_c9s', date:d5, title:'カンゴ実習オリエンテーション', kind:'other', time:'10:00', memo:'', photos:[], mt:now }));
  A.S.tasks.push(J(A, { id:'tk_c9s', title:'レポート（看護）', subject:'', due:d5, done:0, subs:[], photos:[], memo:'かんごの本を読む', mt:now }));
  A.S.notes.push(J(A, { id:'nt_c9s', title:'しらべもの', body:'ﾊﾞｲﾀﾙｻｲﾝの正常値をまとめる', pinned:0, checks:[], photos:[], link:null, ct:now, mt:now }));
  A.kbAdd({ amount:777, title:'ブックオフで参考書', date:td, src:'hand', ref:'c9-test-sp' });
  A.S.cards.push(J(A, { id:'cd_c9s', deck:'成人看護学概論', q:'ばいたるの基準は？', a:'けつあつ など', mt:now }));
  A.commit();
  var km = function(q, norm){ return norm(q).indexOf('ためし') >= 0 ? [{ kind:'ためしの機能', title:'ためしの結果', sub:'足した機能から', act:'c9-open', attrs:{ k:'set', id:'s1' } }] : []; };
  A.KM.search.push(km);
  try{
    ok(doc.getElementById('c9sbtn'), '上に検索のボタン');
    doc.getElementById('c9sbtn').click();
    eq(A.appId, 'c9search', '検索の画面がひらく');
    var q = doc.getElementById('c9_q');
    ok(q, '入力欄');
    var res = function(){ return doc.getElementById('c9_res'); };
    var heads = function(){ return [].map.call(res().querySelectorAll('section .head h2'), function(h){ return h.textContent; }); };
    /* ひらがなで、カタカナも見つかる */
    typeIn(A, q, 'かんご');
    await KT.until(function(){ return /カンゴ実習/.test(res().textContent) && /かんごの本/.test(res().textContent); }, 3000, 'ひらがなでカタカナの予定が見つかる');
    ok(heads().indexOf('予定') >= 0 && heads().indexOf('課題') >= 0, '種類ごとにまとめる：' + heads().join(','));
    /* 全角カタカナで、半角カタカナ・ひらがなも */
    typeIn(A, q, 'バイタル');
    await KT.until(function(){ return /ﾊﾞｲﾀﾙ/.test(res().textContent) && /ばいたるの基準/.test(res().textContent); }, 3000, 'カタカナで半角・ひらがなも見つかる');
    ok(heads().indexOf('メモ') >= 0 && heads().indexOf('暗記カード') >= 0, 'メモ（本文）と暗記カード：' + heads().join(','));
    typeIn(A, q, 'ﾌﾞｯｸｵﾌ');
    await KT.until(function(){ return heads().indexOf('家計簿') >= 0; }, 3000, '半角で家計簿');
    typeIn(A, q, 'Ｎ－１０１');
    await KT.until(function(){ return heads().indexOf('授業') >= 0; }, 3000, '全角で授業の教室');
    typeIn(A, q, '文字の大きさ');
    await KT.until(function(){ return heads().indexOf('設定') >= 0; }, 3000, '設定の項目');
    typeIn(A, q, 'ためし');
    await KT.until(function(){ return heads().indexOf('ためしの機能') >= 0; }, 3000, '足した機能（kmSearch）の結果');
    /* Enter で「最近さがしたことば」に入る */
    typeIn(A, q, 'かんご');
    q.dispatchEvent(new A.KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
    eq(A.c9Recent()[0], 'かんご', '最近さがしたことば');
    /* 押すと、その場所へ（予定はカレンダーのその日と詳細） */
    await KT.until(function(){ return res().querySelector('[data-k="ev"][data-id="ev_c9s"]'); }, 3000, '予定の結果');
    res().querySelector('[data-k="ev"][data-id="ev_c9s"]').click();
    eq(A.appId, 'cal', 'カレンダーへ');
    eq(A.calSel, d5, 'その日');
    ok(doc.getElementById('detail').classList.contains('on'), '予定の詳細がひらく');
    A.closeDetail();
    /* 最近さがしたことばから、もう一度 */
    doc.getElementById('c9sbtn').click();
    ok(doc.querySelector('[data-act="c9-search-q"][data-q="かんご"]'), '最近さがしたことばが出る');
    doc.querySelector('[data-act="c9-search-q"][data-q="かんご"]').click();
    ok(res().querySelector('[data-k="task"][data-id="tk_c9s"]'), 'ことばを押すと、もう一度さがす');
    /* メモ → メモの画面 */
    typeIn(A, doc.getElementById('c9_q'), 'ばいたる');
    await KT.until(function(){ return res().querySelector('[data-k="note"]'); }, 3000, 'メモの結果');
    res().querySelector('[data-k="note"][data-id="nt_c9s"]').click();
    eq(A.appId, 'notes', 'メモの画面'); eq(A.noteView, 'nt_c9s', 'そのメモ');
    A.noteView = '';
    /* 授業 → 授業の画面 */
    doc.getElementById('c9sbtn').click();
    typeIn(A, doc.getElementById('c9_q'), 'N-101');
    await KT.until(function(){ return res().querySelector('[data-k="course"]'); }, 3000, '授業の結果');
    var cname = res().querySelector('[data-k="course"]').dataset.name;
    res().querySelector('[data-k="course"]').click();
    eq(A.appId, 'course', '授業の画面'); eq(A.courseView, cname, 'その授業');
    A.courseView = '';
    /* 設定の項目 → その枠がひらく */
    doc.getElementById('c9sbtn').click();
    typeIn(A, doc.getElementById('c9_q'), 'もじのおおきさ');
    await KT.until(function(){ return res().querySelector('[data-k="set"][data-id="s1"]'); }, 3000, '設定の結果');
    res().querySelector('[data-k="set"][data-id="s1"]').click();
    eq(A.appId, 'set', '設定へ'); ok(A.S.ui.setOpen.s1, '見た目の枠がひらく');
    /* もどる */
    doc.getElementById('c9sbtn').click();
    doc.querySelector('[data-act="c9-search-back"]').click();
    eq(A.appId, 'set', 'もとの画面にもどる');
    await KT.until(function(){ return B.c9Recent().indexOf('かんご') >= 0; }, 10000, '最近さがしたことばが相手にも届く');
  }finally{
    A.KM.search.splice(A.KM.search.indexOf(km), 1);
    A.S.ui.setOpen.s1 = 0; A.touch('ui');
    A.removeItem('events', 'ev_c9s'); A.removeItem('tasks', 'tk_c9s'); A.removeItem('notes', 'nt_c9s'); A.removeItem('cards', 'cd_c9s');
    A.S.spends.filter(function(x){ return x.ref === 'c9-test-sp'; }).forEach(function(x){ A.removeItem('spends', x.id); });
    A.appId = 'today'; A.todayTab = 'today'; A.commit();
  }
  await KT.settle([A, B]);
});

KT.test('全体＋：データの点検（同じもの・おかしい日付・バイトの重なり・消えた授業のメモ・古い課題・家計簿の二重・大きい写真・足した点検）と「直す」', async function(){
  var fr = KT.frames(), A = fr.A, B = fr.B, doc = A.document;
  KT.freshWrites([A, B]);
  var td = A.today(), d3 = A.shiftDate(td, 3), now = Date.now();
  A.S.events.push(J(A, { id:'ev_c9d1', date:d3, title:'健診', time:'09:00', kind:'other', memo:'', photos:[], mt:now }));
  A.S.events.push(J(A, { id:'ev_c9d2', date:d3, title:'健診', time:'09:00', kind:'other', memo:'持ち物：保険証', photos:[], mt:now }));
  A.S.events.push(J(A, { id:'ev_c9bad', date:'2026-02-30', title:'ありえない日の予定', kind:'other', photos:[], mt:now }));
  A.S.events.push(J(A, { id:'ev_c9end', date:d3, dateEnd:A.shiftDate(d3, -2), title:'さかさまの予定', kind:'other', photos:[], mt:now }));
  A.S.shifts.push(J(A, { id:'wk_c9a', title:'バイト', date:d3, start:'10:00', end:'15:00', realEnd:'', ot:0, rate:0, memo:'', photos:[], mt:now }));
  A.S.shifts.push(J(A, { id:'wk_c9b', title:'バイト', date:d3, start:'14:00', end:'18:00', realEnd:'', ot:0, rate:0, memo:'', photos:[], mt:now }));
  A.S.notes.push(J(A, { id:'nt_c9o', title:'消えた授業のメモ', body:'', pinned:0, checks:[], photos:[], link:{ type:'course', id:'もうない授業' }, ct:now, mt:now }));
  A.S.tasks.push(J(A, { id:'tk_c9old', title:'ずっと前の課題', subject:'', due:A.shiftDate(td, -30), done:0, subs:[], photos:[], mt:now }));
  A.S.spends.push(J(A, { id:'sp_c9a', date:td, amount:540, io:'out', title:'コンビニ', cat:'food', src:'hand', ref:'c9ra', mt:now }));
  A.S.spends.push(J(A, { id:'sp_c9b', date:td, amount:540, io:'out', title:'コンビニ', cat:'food', src:'csv', ref:'c9rb', mt:now }));
  var kc = function(){ return [{ level:'warn', msg:'ためしの点検のお知らせ' }]; };
  A.KM.checks.push(kc);
  A.commit();
  try{
    var r = A.c9CheckRun();
    var has = function(re){ return r.list.some(function(x){ return re.test(x.kind + '：' + x.msg); }); };
    ok(has(/同じ予定.*健診/), '同じ予定');
    ok(has(/日付がおかしい.*ありえない日/), 'ありえない日');
    ok(has(/終わりの日/), '終わりが始まりより前');
    ok(has(/バイトの時間が重なって/), 'バイトの重なり');
    ok(has(/消えた授業/), '消えた授業のメモ');
    ok(has(/2週間以上.*ずっと前の課題/), '締切から長い課題');
    ok(has(/家計簿の同じ明細.*コンビニ/), '家計簿の二重');
    ok(has(/ためしの点検/), '足した機能の点検（kmCheck）');
    ok(r.ng >= 1, 'あぶないもの');
    /* 設定の「データの点検」で直す */
    A.S.ui.setOpen = A.S.ui.setOpen || {}; A.S.ui.setOpen.c9check = 1;
    A.appId = 'set'; A.render();
    ok(doc.querySelector('[data-act="fold"][data-id="c9check"]'), '設定に「データの点検」');
    var fix = function(pre){ var b = doc.querySelector('[data-act="c9-fix"][data-key^="' + pre + '"]'); ok(b, '「直す」：' + pre); b.click(); };
    fix('dup-ev:ev_c9d1,ev_c9d2');
    eq(A.S.events.filter(function(e){ return e.title === '健診' && e.date === d3; }).length, 1, '同じ予定が1つになった');
    ok(A.S.events.some(function(e){ return e.id === 'ev_c9d2'; }), '中身の多いほうを残す');
    ok(A.S.trash.some(function(t){ return t.obj && t.obj.id === 'ev_c9d1'; }), '消したほうはゴミ箱へ');
    fix('orphan-note:nt_c9o');
    eq(A.S.notes.filter(function(n){ return n.id === 'nt_c9o'; })[0].link, null, 'つながりを外した');
    fix('old-task:');
    ok(A.S.tasks.filter(function(t){ return t.id === 'tk_c9old'; })[0].done, '古い課題を完了に');
    fix('dup-sp:sp_c9a,sp_c9b');
    eq(A.S.spends.filter(function(x){ return x.ref === 'c9ra' || x.ref === 'c9rb'; }).length, 1, '家計簿が1つに');
    fix('bad-end:ev_c9end');
    eq(A.S.events.filter(function(e){ return e.id === 'ev_c9end'; })[0].dateEnd, '', '終わりの日を消した');
    ok(!doc.querySelector('[data-act="c9-fix"][data-key="dup-ev:ev_c9d1,ev_c9d2"]'), '直したものは消える');
    ok(doc.querySelector('[data-act="c9-open"][data-id="ev_c9bad"]'), '直せないものは「ひらく」');
    await KT.settle([A, B]);
    await KT.until(function(){ return B.S.events.filter(function(e){ return e.title === '健診' && e.date === d3; }).length === 1; }, 15000, '相手でも1つ');
    /* 大きすぎる写真（ためしに、しきいを小さくする） */
    var c = A.document.createElement('canvas'); c.width = 320; c.height = 320;
    var g = c.getContext('2d'), im = g.createImageData(320, 320);
    for(var i = 0; i < im.data.length; i++) im.data[i] = (i % 4 === 3) ? 255 : Math.floor(Math.random() * 256);
    g.putImageData(im, 0, 0);
    await A.photoPut('mi_c9big', c.toDataURL('image/jpeg', 1));
    var big0 = A.C9_BIG_PHOTO; A.C9_BIG_PHOTO = 20 * 1024;
    var bp = await A.c9ScanPhotos();
    ok(bp.some(function(x){ return x.id === 'mi_c9big'; }), '大きい写真を見つける');
    ok(A.c9Checks().some(function(x){ return /大きすぎる写真/.test(x.kind); }), '点検に出る');
    var before = bp.filter(function(x){ return x.id === 'mi_c9big'; })[0].bytes;
    var n = await A.c9ShrinkPhotos();
    ok(n >= 1, '小さくした');
    var after = (A.c9BigPhotos.filter(function(x){ return x.id === 'mi_c9big'; })[0] || { bytes:0 }).bytes;
    ok(after < before, '写真が小さくなった（' + before + '→' + after + '）');
    A.C9_BIG_PHOTO = big0;
    await A.photoDel('mi_c9big');
    await A.c9ScanPhotos();
    /* 1日1回の自動の点検と、今日タブの小さなお知らせ */
    var r2 = await A.c9DailyCheck(true);
    ok(r2 && r2.ng >= 1, '自動で調べて、あぶないものがある');
    eq(A.c9Local().checkDay, td, 'この端末で今日調べた印');
    A.appId = 'today'; A.todayTab = 'today'; A.render();
    ok(doc.querySelector('.c9chkbn'), '今日タブに小さく知らせる');
    doc.querySelector('.c9chkbn [data-act="c9-go-check"]').click();
    eq(A.appId, 'set', '点検の画面へ');
    /* AIが点検の結果を読める */
    var sec = A.aiSectionData('settings', {});
    ok(sec.c9_checks && sec.c9_checks.items.some(function(x){ return /ありえない日/.test(x.msg); }), 'AIが点検の結果を読める');
  }finally{
    A.KM.checks.splice(A.KM.checks.indexOf(kc), 1);
    ['ev_c9d1', 'ev_c9d2', 'ev_c9bad', 'ev_c9end'].forEach(function(id){ if(A.S.events.some(function(e){ return e.id === id; })) A.removeItem('events', id); });
    ['wk_c9a', 'wk_c9b'].forEach(function(id){ A.removeItem('shifts', id); });
    A.removeItem('notes', 'nt_c9o'); A.removeItem('tasks', 'tk_c9old');
    A.S.spends.filter(function(x){ return x.ref === 'c9ra' || x.ref === 'c9rb'; }).forEach(function(x){ A.removeItem('spends', x.id); });
    A.S.ui.setOpen.c9check = 0; A.touch('ui'); A.c9CheckNote = null;
    A.appId = 'today'; A.todayTab = 'today'; A.commit();
  }
  await KT.settle([A, B]);
});

KT.test('全体＋：前の日を自動で評価する（最大7日・自分の評価は上書きしない・2台で同じ・書きこみが止まる・きのうのカード・ふりかえりの一覧）', async function(){
  var fr = KT.frames(), A = fr.A, B = fr.B, doc = A.document;
  var td = A.today(), yd = A.shiftDate(td, -1), d2 = A.shiftDate(td, -2), d3 = A.shiftDate(td, -3);
  await KT.settle([A, B]);
  /* 準備：10日前からの評価を消す（2台とも。相手から戻ってこないように同時に） */
  [A, B].forEach(function(w){
    for(var i = 1; i <= 10; i++) delete w.S.dayReview[w.shiftDate(td, -i)];
    w.touch('dayReview'); w.persist();
  });
  A.pushRemote(true);
  await KT.settle([A, B]);
  /* 3日前は、自分で評価していた */
  A.S.dayReview[d3] = J(A, { grade:'S', point:95, memo:'自分でつけた', ai:'', mt:A.c9AutoMt(d3) + 20 * 3600 * 1000 });
  A.touch('dayReview');
  /* 2日前：締切の課題2つ（1つ済）・暗記12枚・よく寝た */
  A.S.tasks.push(J(A, { id:'tk_c9e1', title:'評価の課題1', subject:'', due:d2, done:1, subs:[], photos:[], mt:Date.now() }));
  A.S.tasks.push(J(A, { id:'tk_c9e2', title:'評価の課題2', subject:'', due:d2, done:0, subs:[], photos:[], mt:Date.now() }));
  A.S.studyLog[d2 + '|' + A.DEV.id] = J(A, { n:12, ok:10, mt:Date.now() }); A.touch('studyLog');
  A.S.healthLog[d2] = J(A, { date:d2, sleep:430, steps:9000, mt:Date.now() }); A.touch('healthLog');
  A.commit();
  await KT.settle([A, B]);
  await KT.until(function(){ return B.S.dayReview[d3] && B.S.dayReview[d3].grade === 'S'; }, 15000, '自分の評価は相手にある');
  /* 開かなかった日が続いた（評価をはじめたのは10日前）ことにして、2台で同時に開く */
  A.c9LocalSet('evalFrom', A.shiftDate(td, -10)); B.c9LocalSet('evalFrom', B.shiftDate(td, -10));
  KT.freshWrites([A, B]);
  var ma = A.c9AutoReview({ quiet:true }), mb = B.c9AutoReview({ quiet:true });
  eq(ma.length, 6, '7日前〜きのうのうち、自分で評価した日をのぞく6日：' + ma.join(','));
  eq(ma[0], A.shiftDate(td, -7), 'さかのぼるのは7日前まで');
  eq(ma[ma.length - 1], yd, 'きのうまで');
  eq(mb.join(','), ma.join(','), '相手の端末も同じ日');
  eq(A.S.dayReview[d3].grade, 'S', '自分でつけた評価は上書きしない');
  var r2 = A.S.dayReview[d2];
  ok(r2 && r2.auto === 1 && r2.grade && typeof r2.point === 'number', '自動の印・点数');
  ok(r2.items.some(function(x){ return x.k === 'task' && /1\/2/.test(x.t); }), '課題（1/2件）：' + JSON.stringify(r2.items));
  ok(r2.items.some(function(x){ return x.k === 'anki' && /12枚/.test(x.t); }), '暗記の枚数');
  ok(r2.items.some(function(x){ return x.k === 'health' && /7時間/.test(x.t); }), '睡眠・歩数');
  ok(r2.items.some(function(x){ return x.k === 'late'; }), '期限切れ');
  ok(Array.isArray(r2.good) && r2.next, 'よかったこと・ひとこと');
  eq(r2.mt, A.c9AutoMt(d2), '時刻はその日の0時（自分の評価に負ける）');
  eq(A.canon(A.S.dayReview[d2]), B.canon(B.S.dayReview[d2]), '2台で同じ結果');
  await KT.settle([A, B]);
  eq(A.canon(A.S.dayReview), B.canon(B.S.dayReview), '同期のあとも2台で同じ');
  var w0 = KT.fs().stats.writes;
  A.pushRemote(true); B.pushRemote(true);
  await KT.sleep(2500);
  eq(KT.fs().stats.writes, w0, '書きこみが止まる（行ったり来たりしない）');
  eq(A.c9AutoReview({ quiet:true }).length, 0, 'もう一度開いても、つけなおさない');
  /* 自分でつけた評価のほうが、自動より新しい（同期で勝つ） */
  ok(A.S.dayReview[d3].mt > A.c9AutoMt(d3), '自分の評価の時刻のほうが新しい');
  /* きのうの評価のカード */
  A.S.ui.core2 = J(A, {}); A.touch('ui');
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  var card = sectionsOf(doc, /きのうの評価/)[0];
  ok(card, '今日タブに「きのうの評価」');
  ok(card.querySelector('.c9items') && /つぎの日へ/.test(card.textContent) && /自動/.test(card.textContent), '点数・内わけ・ひとこと');
  var wx = doc.querySelector('[data-act="today-toggle"][data-id="weather"]');
  ok(!wx || (card.compareDocumentPosition(wx) & 4), '今日タブの上のほう（天気より上）に出る');
  /* ふりかえりの一覧にも並ぶ */
  card.querySelector('[data-act="rev-hist"]').click();
  if(yd.slice(0, 7) === td.slice(0, 7)){
    ok(doc.querySelector('.revcal .rc.c9auto'), 'ふりかえりのカレンダーに自動の印');
    ok(/自動/.test((doc.querySelector('.c9revlist') || {}).textContent || ''), 'ふりかえりの一覧に自動の評価');
    ok(/自分で/.test((doc.querySelector('.c9revlist') || {}).textContent || '') || d3.slice(0, 7) !== td.slice(0, 7), '自分の評価も並ぶ');
  }
  A.reviewHistOpen = false; A.render();
  /* とじる（相手の端末でもとじる） */
  sectionsOf(doc, /きのうの評価/)[0].querySelector('[data-act="c9-yday-close"]').click();
  ok(!sectionsOf(doc, /きのうの評価/).length, 'とじた');
  await KT.until(function(){ return B.S.ui.core2 && B.S.ui.core2.ydayClosed === yd; }, 10000, '相手でもとじる');
  /* AIが読める */
  var rv = A.aiSectionData('reviews', {});
  ok(JSON.stringify(rv).indexOf('"auto":1') >= 0, 'AIが自動の評価を読める');
  ok(rv.c9_day_eval && rv.c9_day_eval.today && rv.c9_day_eval.today.items, 'AIが今日の見こみを読める');
  A.removeItem('tasks', 'tk_c9e1'); A.removeItem('tasks', 'tk_c9e2'); A.commit();
  await KT.settle([A, B]);
});

KT.test('全体＋：AIが足した機能の数字を正しい分野で読める（fn.section・KM.aiData・4つめ）・目次に名前・検索の履歴・キャラの口調', async function(){
  var A = KT.frames().A;
  var f1 = function(){ return { x:1 }; }; f1.section = 'money';
  A.kmAiData('c9t_fnsec', 'fn.section のためし', f1);
  A.kmAiData('c9t_arg4', '4つめのためし', function(){ return { y:2 }; }, 'health');
  A.kmAiData('c9t_kmsec', 'KM.aiData のためし', function(){ return { z:3 }; });
  A.KM.aiData.c9t_kmsec.section = 'work';
  A.kmAiData('c9t_none', '分野なしのためし', function(){ return { w:4 }; });
  try{
    ok(A.aiSectionData('money', {}).c9t_fnsec, 'fn.section の分野に出る');
    ok(!A.aiSectionData('study', {}).c9t_fnsec, 'ほかの分野には出ない');
    ok(A.aiSectionData('health', {}).c9t_arg4, 'kmAiData の4つめの分野に出る');
    ok(A.aiSectionData('work', {}).c9t_kmsec, 'KM.aiData[名前].section の分野に出る');
    ok(A.aiSectionData('study', {}).c9t_none, '分野がないときは暗記・勉強');
    var ov = A.aiOverview();
    var ex = ov.extras.filter(function(x){ return /^c9t_/.test(x.name); });
    eq(ex.length, 4, '目次に足した機能の数字の名前');
    ok(ex.some(function(x){ return x.name === 'c9t_fnsec' && x.section === 'money'; }) && ex.some(function(x){ return x.name === 'c9t_kmsec' && x.section === 'work'; }), '目次に分野も');
    ok(ov.extras.some(function(x){ return x.name === 'c9_checks' && x.section === 'settings'; }), '点検の結果の名前');
    var r = A.aiDataRun({ name:'app_overview', args:{} });
    ok(/c9t_arg4/.test(r.result), 'AIの道具（app_overview）にも出る');
    /* 検索の履歴は S にあるので読める・AIのさがす道具も、ひらがな・カタカナ・半角をそろえる */
    A.c9SaveRecent('ためしのことば'); A.commit();
    ok(JSON.stringify(A.aiSectionData('more', {})).indexOf('ためしのことば') >= 0, '検索の履歴を読める');
    ok(A.aiSearchAll('ﾀﾒｼﾉｺﾄﾊﾞ').count >= 1, 'search_app もカタカナ・半角でさがせる');
    /* キャラの口調（別の担当の charaChatPersona があれば、AIそうだんの約束の最後に足す） */
    var orig = A.charaChatPersona;
    A.charaChatPersona = function(){ return '\n【口調】ためしの口調で話す。'; };
    var sys = A.chatSystem();
    ok(/ためしの口調/.test(sys) && /ためしの口調で話す。$/.test(sys), 'キャラの口調を最後に足す');
    A.charaChatPersona = function(){ throw new Error('こわれた'); };
    ok(A.chatSystem().length > 100, 'キャラの口調がこわれていても、そうだんはできる');
    if(orig) A.charaChatPersona = orig; else delete A.charaChatPersona;
    if(!orig) ok(!/ためしの口調/.test(A.chatSystem()), 'なければ何も足さない');
  }finally{
    ['c9t_fnsec', 'c9t_arg4', 'c9t_kmsec', 'c9t_none'].forEach(function(k){ delete A.KM.aiData[k]; });
  }
});

KT.test('全体＋：検索・点検・ホーム画面・きのうの評価は、表示するだけでは中身が変わらない', async function(){
  var fr = KT.frames(), A = fr.A;
  A.S.ui.setOpen = A.S.ui.setOpen || {};
  A.S.ui.setOpen.c9home = 1; A.S.ui.setOpen.c9check = 1; A.S.ui.setOpen.s1 = 1;
  A.S.ui.core2 = J(A, {});
  A.touch('ui'); A.commit();
  await KT.settle([A, fr.B]);
  var snap = function(){ var o = A.payloadCore(); delete o.notices; return A.canon(o) + '|' + A.canon(A.S.meta); };
  var before = snap();
  A.c9Q = 'かんご'; A.c9TempApp = 'c9search'; A.appId = 'c9search'; A.render();
  A.c9Q = 'せってい'; A.render();
  A.appId = 'set';
  A.C9_HOME_PAGES.forEach(function(p){ A.c9HomePg = p[0]; A.render(); });
  ['today', 'tomo', 'week', 'life'].forEach(function(t){ A.appId = 'today'; A.todayTab = t; A.render(); });
  A.aiSectionData('settings', {}); A.aiSectionData('reviews', {}); A.aiSectionData('more', {}); A.aiOverview();
  A.c9CheckRun();
  A.persist();
  var after = snap();
  if(before !== after){
    var b = JSON.parse(before.split('|')[0]), a = JSON.parse(after.split('|')[0]);
    var diff = Object.keys(a).filter(function(k){ return A.canon(a[k]) !== A.canon(b[k]); });
    throw new Error('表示しただけで変わった：' + (diff.join(',') || 'meta'));
  }
  A.S.ui.setOpen.c9home = 0; A.S.ui.setOpen.c9check = 0; A.S.ui.setOpen.s1 = 0; A.touch('ui');
  A.c9HomePg = 'today'; A.appId = 'today'; A.todayTab = 'today'; A.commit();
  await KT.settle([A, fr.B]);
});
})();

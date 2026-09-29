/* 不具合を直したところ（また起きないように） */

function tfQ(subId, q, mid){ return W.qAdd({ qt:'tf', q:q, c:['○（正しい）', '×（まちがい）'], a:[0] }, subId || '', mid || ''); }

test('とく：「やっぱり正解」で直すと、次に出す日も前のつづきにもどる', async function(){
  var s = W.subAdd('薬理学');
  var q = W.qAdd({ qt:'cloze', q:'（　）はナトリウムを体の外に出す薬', at:'利尿薬' }, s.id, '');
  for(var i = 0; i < 4; i++) W.logAnswer(q.id, true);
  eq(W.logOf(q.id).box, 4, '4回つづけて正解');
  W.saveNow();
  await click('tab', 'drill');
  await click('dr-sub', s.id);
  await click('dr-mode', 'all');
  await click('dr-start');
  await type('dr_in', 'りにょう');
  await click('dr-check');
  ok(has('ざんねん'), '機械の答え合わせでは、まちがい');
  eq(W.logOf(q.id).box, 0, 'いったん、はじめからに');
  await click('dr-flip');
  var l = W.logOf(q.id);
  eq(l.box, 5, '前のつづき（5回目の正解）にもどる');
  eq(l.due, W.shiftDate(W.today(), 30), '次は30日あと（はじめからの1日あとではない）');
  eq(l.n, 5, 'といた回数は5回');
  eq(l.miss, 0, 'まちがいの数は0');
});

test('とく：やめたあと新しく始めても、前に書きかけた答えは入っていない', async function(){
  var s = W.subAdd('生理学');
  W.qAdd({ qt:'cloze', q:'血液の液体の部分を（　）という', at:'血漿' }, s.id, '');
  W.qAdd({ qt:'cloze', q:'赤血球は（　）を運ぶ', at:'酸素' }, s.id, '');
  W.saveNow();
  await click('tab', 'drill');
  await click('dr-sub', s.id);
  await click('dr-mode', 'all');
  await click('dr-start');
  await type('dr_in', 'ナトリウム');
  await click('dr-quit');
  W.runDrop();
  W.render(); await frames();
  await click('dr-start');
  eq($('#dr_in').value, '', '書きかけの答えは消えている');
});

test('とく：組み合わせで「えらぶ」にもどすと、えらんでいないことになる', async function(){
  var s = W.subAdd('略語');
  W.qAdd({ qt:'match', q:'むすんでください', pairs:[['BP', '血圧'], ['HR', '心拍数'], ['RR', '呼吸数']] }, s.id, '');
  W.saveNow();
  await click('tab', 'drill');
  await click('dr-sub', s.id);
  await click('dr-mode', 'all');
  await click('dr-start');
  var sel = $('select[data-act="dr-match"][data-i="0"]');
  sel.click(); await frames();
  ok(!('0' in W.run.picks), 'おしただけでは、えらんだことにならない');
  sel.value = '0'; sel.dispatchEvent(new W.Event('change', { bubbles:true })); await frames();
  eq(W.run.picks[0], 0, 'えらぶと入る');
  sel = $('select[data-act="dr-match"][data-i="0"]');
  sel.value = ''; sel.dispatchEvent(new W.Event('change', { bubbles:true })); await frames();
  ok(!('0' in W.run.picks), '「えらぶ」にもどすと、えらんでいないことになる');
});

test('入力らん：おしただけでは描き直さない（キーボードが引っこまない）', async function(){
  var s = W.subAdd('さがす');
  tfQ(s.id, 'さがす問題である。');
  W.saveNow();
  await click('tab', 'lib');
  await click('lb-tab', 'q');
  var el = $('#lb_q');
  el.focus(); el.click();
  await sleep(800);
  ok($('#lb_q') === el, '同じ入力らんのまま');
});

test('にが手ノート：科目なしの問題も出る', async function(){
  var q = tfQ('', '科目なしの問題である。');
  W.logAnswer(q.id, false);
  W.saveNow();
  eq(W.weakList('none').length, 1, '科目なしのにが手');
  eq(W.weakList('all').length, 1, 'すべての科目');
});

test('とく：とちゅうで問題を消しても、画面がからにならない', async function(){
  var s = W.subAdd('消す');
  var q1 = tfQ(s.id, '1つめである。'), q2 = tfQ(s.id, '2つめである。');
  W.saveNow();
  await click('tab', 'drill');
  await click('dr-sub', s.id);
  await click('dr-moc');
  await click('moc-sub', s.id);
  W.moc.n = 20;
  for(var i = 0; i < 4; i++) tfQ(s.id, 'たし' + i + 'である。');
  W.saveNow();
  await click('moc-start');
  ok(W.run && W.run.moc, '模擬テストがはじまった');
  W.run.list.slice().forEach(function(id){ W.qDel(id); });
  W.render(); await frames();
  ok(text().trim().length > 0, '画面がからにならない');
  ok(has('模擬テストの結果'), '結果の画面になる');
  ok(!W.run, 'おわっている');
});

test('つくる：作っているあいだに科目を消しても、見えないところに入らない', async function(){
  var a = W.subAdd('消す科目'), b = W.subAdd('のこる科目');
  W.S.ui.lastSub = b.id;
  W.saveNow();
  W.mk.pv = { sub:a.id, title:'資料', summary:'', items:[{ qt:'tf', q:'問題である。', c:['○（正しい）', '×（まちがい）'], a:[0] }], files:[], nomat:1 };
  W.subDel(a.id, true);
  W.view.sub = '';
  await click('tab', 'make');
  await click('mk-add');
  var q = W.qsAll()[0];
  ok(q && W.sub(q.sub), '見える科目に入った（' + (q ? W.subName(q.sub) : '') + '）');
});

test('メモ → つくる：メモの科目に入る（ほかの科目をひらいていても）', async function(){
  var a = W.subAdd('成人看護学'), b = W.subAdd('ほかの科目');
  W.view.sub = b.id;
  W.S.notes.push({ id:'n1', mt:Date.now(), sub:a.id, no:'', at:W.today(), body:'心不全の看護\n安静度を守る。水分は1日1000mLまで。' });
  W.saveNow();
  await click('tab', 'note');
  await click('nt-open', 'n1');
  await click('nt-make');
  eq(W.mkSubId(), a.id, 'メモの科目');
  eq(W.subName(''), 'そのほか', 'アプリ全体の科目名はそのまま（メモの画面が上書きしない）');
});

/* ===== 同期 ===== */
function remoteLike(){ return JSON.parse(JSON.stringify(W.syPayload())); }

test('同期：フォルダは科目とは別にそろう（2台で同時に直しても消えない）', async function(){
  var s = W.subAdd('成人看護学');
  var rem = remoteLike();                                 /* もう1台は、フォルダを知らない */
  rem.subs.forEach(function(x){ if(x.id === s.id){ x.name = '成人看護学Ⅰ'; x.mt = Date.now() + 5000; } });   /* もう1台で、あとから名前を直した */
  var f = W.fdAdd(s.id, '中間テストまで');
  W.S.mats.push({ id:'mx', mt:Date.now(), sub:s.id, fd:f.id, title:'資料', kind:'text', photos:[], text:'' });
  W.syMerge(rem);
  eq(W.subName(s.id), '成人看護学Ⅰ', '科目の名前は、あとから直したほう');
  ok(W.fdGet(s.id, f.id), 'フォルダは消えない');
  eq(W.matFd(W.mat('mx')), f.id, '資料はフォルダに入ったまま');
  /* フォルダを消したら、ほかの端末からもどってこない */
  var rem2 = remoteLike();
  W.fdDel(s.id, f.id);
  W.syMerge(rem2);
  ok(!W.fdGet(s.id, f.id), '消したフォルダはもどってこない');
});

test('同期：「ぜんぶ消す」「記録だけ消す」のあと、ほかの端末から古いものがもどってこない', async function(){
  var s = W.subAdd('消す');
  var q = tfQ(s.id, '問題である。');
  W.logAnswer(q.id, true);
  W.saveNow();
  var rem = remoteLike();                                 /* もう1台は、まだ消していない */
  var orig = W.confirm; W.confirm = function(){ return true; };
  try{
    await click('tab', 'set');
    await click('st-logreset');
    W.syMerge(rem);
    ok(!W.logOf(q.id), '記録はもどってこない');
    eq(W.qsAll().length, 1, '問題はのこる');
    await click('tab', 'set');
    await click('st-reset');
    W.syMerge(rem);
    eq(W.qsAll().length + W.subsAll().length, 0, '問題も科目も、もどってこない');
  }finally{ W.confirm = orig; }
  /* 消した端末のしるしを受けとった端末は、自分の古い記録も消す */
  W.S = W.blankState(); W.saveNow();
  var q2 = tfQ('', 'べつの端末の問題である。');
  W.logAnswer(q2.id, true);
  W.S.log[q2.id].mt = Date.now() - 60000;
  W.syMerge({ subs:[], mats:[], qs:[], moc:[], notes:[], log:{}, day:{}, why:{}, del:{}, set:{ logReset:Date.now() }, smt:Date.now() });
  ok(!W.logOf(q2.id), 'ほかの端末で消した記録は、こちらでも消える');
});

test('同期：バックアップを読みこんだら、ほかの端末の古いものがもどってこない', async function(){
  var s = W.subAdd('いまの科目');
  var q = tfQ(s.id, 'いまの問題である。');
  W.saveNow();
  var backup = JSON.parse(JSON.stringify(W.S));
  var rem = remoteLike();
  var extra = tfQ(s.id, 'バックアップのあとに足した問題である。');   /* バックアップにはない */
  rem.qs.push(JSON.parse(JSON.stringify(extra)));
  W.setImportData(backup);
  W.syMerge(rem);
  ok(W.qGet(q.id), 'バックアップの問題はある');
  ok(!W.qGet(extra.id), 'バックアップにない問題は、ほかの端末からもどってこない');
});

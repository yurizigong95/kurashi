/* とく：出題・採点・くり返し・模擬テスト・にが手ノート */

function addQ(subId, o){ var q = W.qAdd(o, subId || '', ''); W.saveNow(); return q; }

test('4択：えらんで答えあわせ→記録とつぎの復習日が入る', async function(){
  var s = W.subAdd('解剖生理学');
  var q = addQ(s.id, { qt:'mc', q:'心臓の部屋はいくつか。', c:['2つ', '3つ', '4つ', '5つ'], a:[2], exp:'心房2・心室2で4つ。' });
  await click('tab', 'drill');
  await click('dr-mode', 'new');
  await click('dr-start');
  ok(W.run, 'はじまった');
  var right = $$('.choice').filter(function(el){ return el.textContent.indexOf('4つ') >= 0; })[0];
  await clickEl(right);
  await click('dr-check');
  ok(has('せいかい'), '正解と出る');
  ok(has('心房2・心室2'), '解説が出る');
  var l = W.logOf(q.id);
  eq(l.ok, 1, '正解の回数');
  eq(l.box, 1, '箱が1つすすむ');
  eq(l.due, W.shiftDate(W.today(), 1), '次は1日あと');
  eq(W.dayCount(W.today()).n, 1, '今日といた数');
  await click('dr-next');
  ok(!W.run, 'おわった');
});

test('4択：まちがえると、次の日にまた出る', async function(){
  var s = W.subAdd('薬理学');
  var q = addQ(s.id, { qt:'mc', q:'テスト', c:['あ', 'い', 'う', 'え'], a:[0] });
  W.logAnswer(q.id, true);
  W.logAnswer(q.id, true);
  eq(W.logOf(q.id).box, 2, '2つすすんだ');
  W.logAnswer(q.id, false);
  eq(W.logOf(q.id).box, 0, 'まちがえたら、もどる');
  eq(W.logOf(q.id).due, W.shiftDate(W.today(), 1), '次の日にまた出る');
  eq(W.pool(s.id, 'wrong').length, 1, 'まちがい直しに入る');
});

test('○×・穴うめ・記述の採点', async function(){
  var s = W.subAdd('基礎看護学');
  addQ(s.id, { qt:'tf', q:'標準予防策は、すべての患者に行う。', c:['○（正しい）', '×（まちがい）'], a:[0] });
  await click('tab', 'drill');
  await click('dr-mode', 'new');
  await click('dr-start');
  await clickEl($$('.choice')[0]);
  await click('dr-check');
  ok(has('せいかい'), '○×があっている');
  await click('dr-next');
  ok(has('おつかれさまでした'), 'まとめが出る');
  await click('dr-afterclose');

  W.S.qs = []; W.S.log = {};
  var q2 = addQ(s.id, { qt:'cloze', q:'成人の脈拍は（　）回/分である。', at:'60〜100', alt:['60-100'] });
  W.render(); await frames();
  await click('dr-mode', 'new');
  await click('dr-start');
  await type('dr_in', '60-100');
  await click('dr-check');
  ok(has('せいかい'), '別の書き方でも正解');
  eq(W.logOf(q2.id).ok, 1, '記録に入る');
});

test('計算：ゆるした幅の中なら正解・式が出る', async function(){
  var s = W.subAdd('看護の計算');
  var q = addQ(s.id, { qt:'calc', q:'600mLを7時間で落とすとき、1分間の滴下数は？', at:'29', un:'滴/分', tol:5,
                        how:'600×20÷420＝28.6' });
  await click('tab', 'drill');
  await click('dr-mode', 'new');
  await click('dr-start');
  await type('dr_in', '28');
  await click('dr-check');
  ok(has('せいかい'), '29に近いので正解');
  ok(has('600×20÷420'), '式が出る');
  await click('dr-next');
  await click('dr-afterclose');
  /* 遠い数はまちがい */
  W.S.log = {};
  W.render(); await frames();
  await click('dr-mode', 'new');
  await click('dr-start');
  await type('dr_in', '50');
  await click('dr-check');
  ok(has('ざんねん'), '遠い数はまちがい');
  eq(W.logOf(q.id).miss, 1, 'まちがいの記録');
});

test('並べかえ：↑↓でならべて答えあわせ', async function(){
  var s = W.subAdd('基礎看護技術');
  var q = addQ(s.id, { qt:'order', q:'正しい順にならべてください。', c:['手をぬらす', '石けんをとる', '泡立てる', '流す'] });
  await click('tab', 'drill');
  await click('dr-mode', 'new');
  await click('dr-start');
  /* いまのならびを、正しい順に直す（えらび直しは↑↓だけでできる） */
  var guard = 0;
  while(guard++ < 30){
    var rows = $$('.orow .t').map(function(e){ return e.textContent; });
    var want = q.c;
    var bad = -1;
    for(var i = 0; i < want.length; i++){ if(rows[i] !== want[i]){ bad = i; break; } }
    if(bad < 0) break;
    var from = rows.indexOf(want[bad]);
    while(from > bad){
      await clickEl($('[data-act="dr-up"][data-n="' + from + '"]'));
      from--;
    }
  }
  await click('dr-check');
  ok(has('せいかい'), '正しい順にできた');
});

test('組み合わせ：左と右をむすぶ', async function(){
  var s = W.subAdd('略語');
  var q = addQ(s.id, { qt:'match', q:'左と右で、合うものをむすんでください。',
    pairs:[['ADL', '日常生活動作'], ['SpO2', '経皮的動脈血酸素飽和度'], ['BP', '血圧']] });
  await click('tab', 'drill');
  await click('dr-mode', 'new');
  await click('dr-start');
  var sels = $$('.mrow select');
  eq(sels.length, 3, '3つのならび');
  sels.forEach(function(sel, i){
    sel.value = String(i);
    sel.dispatchEvent(new W.Event('change', { bubbles:true }));
  });
  await frames();
  await click('dr-check');
  ok(has('せいかい'), 'ぜんぶ合っている');
});

test('4択のならびは、毎回いれかわる（設定で止められる）', async function(){
  var s = W.subAdd('シャッフル');
  var q = addQ(s.id, { qt:'mc', q:'テスト', c:['1番', '2番', '3番', '4番'], a:[0] });
  var seen = {};
  for(var i = 0; i < 20; i++){
    var run = { cur:'', shuf:null };
    seen[W.viewOrder(q, run).join('')] = 1;
  }
  ok(Object.keys(seen).length > 1, 'ならびが変わる');
  W.S.set.shuffle = 0;
  var run2 = { cur:'', shuf:null };
  eq(W.viewOrder(q, run2), [0, 1, 2, 3], '止めたら、そのまま');
});

test('中断して、あとで続きからとける', async function(){
  var s = W.subAdd('中断テスト');
  for(var i = 0; i < 5; i++) addQ(s.id, { qt:'tf', q:'問題' + i + 'である。', c:['○（正しい）', '×（まちがい）'], a:[0] });
  await click('tab', 'drill');
  await click('dr-mode', 'new');
  await click('dr-n', '5');
  await click('dr-start');
  await clickEl($$('.choice')[0]);
  await click('dr-check');
  await click('dr-next');
  eq(W.run.i, 1, '2問目');
  await click('dr-quit');
  ok(!W.run, 'やめた');
  ok(has('つづきから'), 'つづきがあると出る');
  await click('dr-resume');
  ok(W.run, 'つづきがはじまった');
  eq(W.run.i, 1, '2問目からつづく');
});

test('にが手ノート：まちがえた問題だけ集める・「なぜ？」は手もとの表でしらべる', async function(){
  var s = W.subAdd('基礎看護学');
  var q1 = addQ(s.id, { qt:'mc', q:'白血球数（WBC）の基準値はどれか。', c:['3,300〜8,600 /μL', '1万〜2万 /μL', '100〜200 /μL', '30〜50 /μL'], a:[0] });
  var q2 = addQ(s.id, { qt:'mc', q:'あっている問題', c:['あ', 'い', 'う', 'え'], a:[0] });
  W.logAnswer(q1.id, false);
  W.logAnswer(q2.id, true);
  W.saveNow();
  await click('tab', 'drill');
  await click('dr-weak');
  ok(has('にが手ノート'), 'にが手ノートがひらく');
  ok(has('白血球数'), 'まちがえた問題が出る');
  ok(!has('あっている問題'), 'あっている問題は出ない');
  await click('dr-why');
  await until(function(){ return W.drill.why[q1.id]; }, 4000, 'しらべる');
  ok(W.drill.why[q1.id].indexOf('3,300') >= 0, '基準値の表から説明できた');
  eq(aiCalls.length, 0, 'AIを呼んでいない');
  /* 2回目は、おぼえているものを使う */
  W.drill.why = {};
  W.render(); await frames();
  await click('dr-why');
  await until(function(){ return W.drill.why[q1.id]; }, 4000, '2回目');
  eq(aiCalls.length, 0, '2回目もAIなし');
});

test('にが手ノート：その場でとき直せる', async function(){
  var s = W.subAdd('とき直し');
  var q = addQ(s.id, { qt:'tf', q:'にが手な問題である。', c:['○（正しい）', '×（まちがい）'], a:[0] });
  W.logAnswer(q.id, false);
  W.saveNow();
  await click('tab', 'drill');
  await click('dr-weak');
  await click('dr-weakrun');
  ok(W.run, 'とき直しがはじまった');
  eq(W.run.list.length, 1, '1問');
  await clickEl($$('.choice')[0]);
  await click('dr-check');
  ok(has('せいかい'), 'とき直せた');
  eq(W.logOf(q.id).res, 1, '記録が直った');
});

test('模擬テスト：まとめて解いて、点数と前の回との差が出る', async function(){
  var s = W.subAdd('模擬');
  for(var i = 0; i < 6; i++) addQ(s.id, { qt:'tf', q:'模擬の問題' + i + 'である。', c:['○（正しい）', '×（まちがい）'], a:[0] });
  await click('tab', 'drill');
  await click('dr-moc');
  ok(has('模擬テスト'), '模擬テストの画面');
  await click('moc-n', '20');
  await click('moc-start');
  ok(W.run && W.run.moc, 'はじまった');
  eq(W.run.list.length, 6, 'ある分だけ出る');
  /* 4問正解・2問まちがい */
  for(var k = 0; k < 6; k++){
    await clickEl($$('.choice')[k < 4 ? 0 : 1]);
    await click('dr-check');
  }
  await until(function(){ return W.view.mocEnd; }, 4000, '結果');
  eq(W.S.moc.length, 1, '結果が残る');
  eq(W.S.moc[0].ok, 4, '4問せいかい');
  eq(W.S.moc[0].n, 6, '6問');
  ok(has('4'), '点数が出る');
  ok(has('まちがえた問題'), 'まちがえた問題が出る');
  ok(!W.run, 'おわっている');
  eq(W.logOf(W.qsAll()[0].id).n, 1, '記録にも入る');
});

test('しぼりこみ：章（単元）と★', async function(){
  var s = W.subAdd('しぼりこみ');
  addQ(s.id, { qt:'tf', q:'循環器の問題である。', c:['○（正しい）', '×（まちがい）'], a:[0], ch:'循環器' });
  var q2 = addQ(s.id, { qt:'tf', q:'呼吸器の問題である。', c:['○（正しい）', '×（まちがい）'], a:[0], ch:'呼吸器' });
  q2.star = 1;
  W.saveNow();
  eq(W.unitsOf(s.id), ['呼吸器', '循環器'], '章の一覧');
  W.view.sub = s.id;
  W.view.unit = '循環器';
  eq(W.pool(s.id, 'all').length, 1, '循環器だけ');
  W.view.unit = '';
  eq(W.pool(s.id, 'star').length, 1, '★だけ');
});

test('問題の直し・けす（科目タブ）', async function(){
  var s = W.subAdd('直す');
  var q = addQ(s.id, { qt:'cloze', q:'まちがった問題文', at:'こたえ' });
  await click('tab', 'lib');
  await click('lb-tab', 'q');
  ok(has('まちがった問題文'), '問題が出る');
  await click('lb-qedit');
  await type('lb_qq_' + q.id, '直した問題文');
  await type('lb_qa_' + q.id, 'あたらしいこたえ');
  await type('lb_qc_' + q.id, '第3回');
  await click('lb-qsave');
  eq(W.qGet(q.id).q, '直した問題文', '問題文');
  eq(W.qGet(q.id).at, 'あたらしいこたえ', '答え');
  eq(W.qGet(q.id).ch, '第3回', '章');
  var origConfirm = W.confirm;
  W.confirm = function(){ return true; };
  await click('lb-qdel');
  W.confirm = origConfirm;
  eq(W.qsAll().length, 0, 'けせた');
});

test('といたあと：まちがえた問題を、その場でもう一回とける', async function(){
  var s = W.subAdd('もう一回');
  W.qAdd({ qt:'tf', q:'あたる問題である。', c:['○（正しい）', '×（まちがい）'], a:[0] }, s.id, '');
  W.qAdd({ qt:'tf', q:'はずす問題である。', c:['○（正しい）', '×（まちがい）'], a:[0] }, s.id, '');
  W.saveNow();
  await click('tab', 'drill');
  await click('dr-mode', 'new');
  await click('dr-n', '5');
  await click('dr-start');
  /* 1問目は正解、2問目はわざとまちがえる */
  await clickEl($$('.choice')[0]);
  await click('dr-check');
  await click('dr-next');
  await clickEl($$('.choice')[1]);
  await click('dr-check');
  await click('dr-next');
  ok(!W.run, 'おわった');
  ok(has('おつかれさまでした'), 'まとめが出る');
  ok(has('まちがえた 1問'), 'まちがえた数が出る');
  await click('dr-again');
  ok(W.run, 'もう一回はじまった');
  eq(W.run.list.length, 1, 'まちがえた1問だけ');
});

test('書いて答える問題は、自分で○×を直せる', async function(){
  var s = W.subAdd('手なおし');
  var q = W.qAdd({ qt:'short', q:'標準予防策とは何か。', at:'すべての患者の血液・体液を感染の可能性があるものとして扱うこと' }, s.id, '');
  W.saveNow();
  await click('tab', 'drill');
  await click('dr-mode', 'new');
  await click('dr-start');
  await type('dr_in', 'ぜんぶの患者さんの血や体液を、うつるものとしてあつかう');
  await click('dr-check');
  var firstRes = W.run.res;
  ok(has(firstRes ? 'せいかい' : 'ざんねん'), 'いったん答えあわせ');
  await click('dr-flip');
  eq(W.run.res, !firstRes, '○×がひっくりかえる');
  eq(W.toNum(W.logOf(q.id).n), 1, '記録は1回のまま（二重にかぞえない）');
  eq(W.toNum(W.logOf(q.id).ok) + W.toNum(W.logOf(q.id).miss), 1, '正解とまちがいの合計も1回');
  eq(W.dayCount(W.today()).n, 1, '今日の数も1回');
});

test('設定：CSVに書き出せる・記録だけ消せる', async function(){
  var s = W.subAdd('書き出し');
  var q = W.qAdd({ qt:'mc', q:'CSVの問題', c:['あ', 'い', 'う', 'え'], a:[1], exp:'せつめい' }, s.id, '');
  W.logAnswer(q.id, true);
  W.saveNow();
  var rows = W.csvText();
  eq(rows.length, 2, '見出し＋1問');
  ok(rows[1].indexOf('CSVの問題') >= 0, '問題文が入る');
  ok(rows[1].indexOf('書き出し') >= 0, '科目も入る');
  ok(rows[0].indexOf('"科目"') === 0, '見出しがある');
  /* 記録だけ消す */
  var origConfirm = W.confirm;
  W.confirm = function(){ return true; };
  await click('tab', 'set');
  await click('st-logreset');
  W.confirm = origConfirm;
  ok(!W.logOf(q.id), '記録は消えた');
  eq(W.qsAll().length, 1, '問題はのこる');
});

test('4択の選択肢と正解も、自分で直せる', async function(){
  var s = W.subAdd('選択肢なおし');
  var q = W.qAdd({ qt:'mc', q:'まちがった選択肢の問題', c:['あ', 'い', 'う', 'え'], a:[0] }, s.id, '');
  W.saveNow();
  await click('tab', 'lib');
  await click('lb-tab', 'q');
  await click('lb-qedit');
  await type('lb_qc2_' + q.id, '正しい答え\nちがう1\nちがう2\nちがう3');
  await type('lb_qn_' + q.id, '1');
  await click('lb-qsave');
  eq(W.qGet(q.id).c, ['正しい答え', 'ちがう1', 'ちがう2', 'ちがう3'], '選択肢を直せた');
  eq(W.qGet(q.id).a, [0], '正解の番号');
  /* 「2つ選べ」にもできる */
  await click('lb-qedit');
  await type('lb_qn_' + q.id, '1,3');
  await click('lb-qsave');
  eq(W.qGet(q.id).a, [0, 2], '2つ選べにできる');
});

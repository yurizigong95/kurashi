/* つくる：AIなしの問題づくり・AIでの問題づくり・APIをへらす工夫 */

test('AIなし：組みこみの表から小テストを作る（AIは1回も呼ばない）', async function(){
  W.subAdd('基礎看護学');
  await click('tab', 'make');
  await click('mk-mode', 'kit');
  await click('mk-kit', 'lab');
  await click('mk-kitn', '20');
  await click('mk-kitrun');
  ok(W.mk.pv, '下書きができた');
  eq(W.mk.pv.items.length, 20, '20問');
  eq(aiCalls.length, 0, 'AIを呼んでいない');
  ok(W.mk.pv.items.every(function(x){ return x.qt === 'mc' && x.c.length >= 3; }), 'ぜんぶ4択');
  ok(has('できた問題'), '下書きの画面');
  await click('mk-add');
  eq(W.qsAll().length, 20, '本番に入った');
  eq(W.toNum(W.S.set.aiSaved), 20, 'AIなしで作った数をかぞえている');
  eq(aiCalls.length, 0, '入れるときもAIを呼ばない');
});

test('AIなし：ほかの工房（略語・英語・薬・手順・根拠・組み合わせ・国試）も作れる', async function(){
  await click('tab', 'make');
  await click('mk-mode', 'kit');
  var kinds = ['dict', 'en', 'drug', 'skill', 'why', 'match', 'kokushi', 'labc', 'anat'];
  for(var i = 0; i < kinds.length; i++){
    await click('mk-kit', kinds[i]);
    await click('mk-kitn', '20');
    await click('mk-kitrun');
    ok(W.mk.pv && W.mk.pv.items.length >= 3, kinds[i] + ' が作れる（' + (W.mk.pv ? W.mk.pv.items.length : 0) + '問）');
    ok(W.mk.pv.items.every(function(x){ return W.qOk(Object.assign({ id:'x' }, x)); }), kinds[i] + ' の中身が正しい');
    W.mk.pv = null;
    W.render();
    await frames();
  }
  eq(aiCalls.length, 0, 'ぜんぶAIなし');
});

test('AIなし：解剖の図の穴うめ（図つきの問題）', async function(){
  W.subAdd('解剖生理学');
  await click('tab', 'make');
  await click('mk-mode', 'kit');
  await click('mk-kit', 'anat');
  await click('mk-kitn', '20');
  await click('mk-kitrun');
  ok(W.mk.pv && W.mk.pv.items.length >= 3, '作れた：' + (W.mk.pv ? W.mk.pv.items.length : 0));
  ok(W.mk.pv.items.every(function(x){ return x.fig && W.anatOf(x).indexOf('<svg') === 0; }), '図がついている');
  ok(W.mk.pv.items.every(function(x){ return W.anatOf(x).indexOf('？') >= 0; }), '1か所かくれている');
  ok($('.qpic svg'), '下書きの画面に図が出る');
  eq(aiCalls.length, 0, 'AIなし');
  await click('mk-add');
  var q = W.qsAll()[0];
  ok(q.fig && W.anatOf(q), '図ごと入った（図のidだけ持つので、保存も軽い）');
  /* とく画面にも図が出る */
  await click('tab', 'drill');
  await click('dr-mode', 'new');
  await click('dr-start');
  ok($('.qpic svg'), 'とく画面に図が出る');
});

test('AIなし：計算問題の式と答えが合っている', async function(){
  await click('tab', 'make');
  await click('mk-mode', 'kit');
  await click('mk-kit', 'calc');
  await click('mk-calc', 'drip20');
  await click('mk-kitn', '20');
  await click('mk-kitrun');
  var items = W.mk.pv.items;
  ok(items.length >= 3, '作れた');
  items.forEach(function(it){
    var m = it.q.match(/(\d+)mLの輸液を(\d+)時間/);
    ok(m, '問題文から数を読める：' + it.q);
    var want = Math.round(Number(m[1]) * 20 / (Number(m[2]) * 60));
    eq(Number(it.at), want, '滴下数（' + it.q + '）');
    ok(it.how.indexOf('20') >= 0, '式が書いてある');
  });
  eq(aiCalls.length, 0, 'AIなし');
});

test('AIなし：資料の字から、その場で穴うめ・○×を作る', async function(){
  W.subAdd('成人看護学');
  await click('tab', 'make');
  await type('mk_paste', '成人の脈拍は60〜100回/分である。体温は36.0〜37.0℃が目安である。' +
    '成人の呼吸数は12〜20回/分である。収縮期血圧は120mmHg未満がのぞましい。SpO2は96%以上を保つ。');
  await click('mk-noai');
  ok(W.mk.opt.noai, 'AIなしモード');
  await click('mk-run');
  ok(W.mk.pv, '作れた');
  ok(W.mk.pv.items.length >= 3, '3問いじょう：' + W.mk.pv.items.length);
  ok(W.mk.pv.items.some(function(x){ return x.qt === 'cloze'; }), '穴うめがある');
  eq(aiCalls.length, 0, 'AIを呼んでいない');
  await click('mk-add');
  ok(W.qsAll().length >= 3, '本番に入った');
  eq(W.S.mats.length, 1, '資料も1つできた');
});

test('AI：資料から問題を作って、たしかめてから入れる', async function(){
  var s = W.subAdd('解剖生理学');
  W.S.set.key = 'dummy';
  fakeAI(function(req){
    return aiJsonReply({ title:'循環器のまとめ', summary:'心臓の仕組み', questions:[
      { type:'mc', q:'心臓の弁で、左心房と左心室の間にあるのはどれか。', choices:['三尖弁', '僧帽弁', '大動脈弁', '肺動脈弁'], ans:[2], exp:'僧帽弁（二尖弁）である。', ch:'循環器', page:'スライド3', lv:2 },
      { type:'tf', q:'肺静脈には動脈血が流れる。', answer:'○', exp:'肺で酸素を受けとった血が流れる。', ch:'循環器' },
      { type:'cloze', q:'成人の心拍数は（　）回/分が目安である。', answer:'60〜100', ch:'循環器' }
    ] });
  });
  await click('tab', 'make');
  await type('mk_paste', '心臓は4つの部屋と4つの弁からできている。');
  await click('mk-run');
  await until(function(){ return W.mk.pv; }, 4000, '作られる');
  eq(aiCalls.length, 1, 'AIは1回だけ');
  eq(W.mk.pv.items.length, 3, '3問');
  eq(W.mk.pv.items[0].a, [1], '正解の番号を0からに直している');
  eq(W.mk.pv.items[1].c, ['○（正しい）', '×（まちがい）'], '○×の選択肢');
  eq(W.mk.pv.items[1].a, [0], '○が正解');
  eq(W.mk.pv.items[2].at, '60〜100', '穴うめの答え');
  eq(W.mk.pv.items[0].pg, 'スライド3', 'どこから作ったか');
  await click('mk-add');
  eq(W.qsAll().length, 3, '本番に入った');
  eq(W.qsAll()[0].sub, s.id, '科目に入った');
  eq(W.S.mats.length, 1, '資料ができた');
  eq(W.S.mats[0].title, '循環器のまとめ', '資料の名前');
});

test('AI：送る量をへらす（字があるときは写真を送らない・かぶり防止）', async function(){
  var s = W.subAdd('母性看護学');
  W.qAdd({ qt:'mc', q:'すでにある問題：分娩の3要素はどれか。', c:['あ', 'い', 'う', 'え'], a:[0] }, s.id, '');
  W.S.set.key = 'dummy';
  W.saveNow();
  var seen = null;
  fakeAI(function(req){
    seen = req;
    return aiJsonReply({ title:'t', questions:[{ type:'tf', q:'これは問題である。', answer:'○' }] });
  });
  await click('tab', 'make');
  await type('mk_paste', '分娩の3要素は、娩出力・産道・娩出物である。初乳には免疫グロブリンAが多く含まれる。');
  await click('mk-run');
  await until(function(){ return W.mk.pv; }, 4000, '作られる');
  var parts = seen.contents[0].parts;
  ok(!parts.some(function(p){ return p.inline_data; }), '写真は送っていない');
  var prompt = parts[parts.length - 1].text;
  ok(prompt.indexOf('かぶらないように') >= 0, 'かぶり防止を伝えている');
  ok(prompt.indexOf('すでにある問題') >= 0, '前の問題文（みじかく）を送っている');
  ok(prompt.indexOf('章や単元') < 0, '章（単元）はもう聞かない');
  ok(prompt.indexOf('初乳') >= 0, '資料の字を送っている');
});

test('AI：種類・むずかしさ・事例・国試ふうが、たのみに入る', async function(){
  W.subAdd('基礎看護学');
  W.S.set.key = 'dummy';
  var prompt = '';
  fakeAI(function(req){
    prompt = req.contents[0].parts.slice(-1)[0].text;
    return aiJsonReply({ questions:[{ type:'order', q:'正しい順にならべてください。', steps:['1つめ', '2つめ', '3つめ'] }] });
  });
  await click('tab', 'make');
  await type('mk_paste', '手洗いの手順を確認する。');
  eq(W.mk.opt.types.length, 7, 'はじめは7種類ぜんぶ');
  for(var k of ['tf', 'mc', 'cloze', 'short', 'match', 'two']) await click('mk-type', k);
  eq(W.mk.opt.types, ['order'], '並べかえだけ');
  await click('mk-type', 'order');
  eq(W.mk.opt.types, ['order'], '最後の1つは外せない');
  await click('mk-form', 'kokushi');
  await click('mk-more');
  await click('mk-case');
  await click('mk-both');
  await click('mk-run');
  await until(function(){ return W.mk.pv; }, 4000, '作られる');
  ok(prompt.indexOf('order（並べかえ）') >= 0, '種類を伝えている');
  ok(prompt.indexOf('mc（4択）') < 0, 'えらんでいない種類は伝えない');
  ok(prompt.indexOf('事例') >= 0, '事例');
  ok(prompt.indexOf('看護師国家試験') >= 0, '国試ふう');
  ok(prompt.indexOf('2つ選べ') < 0, '2つ選べはえらんでいない');
  ok(prompt.indexOf('半分を「基本」') >= 0, '2通りのむずかしさ');
  eq(W.mk.pv.items[0].qt, 'order', '並べかえができた');
  eq(W.mk.pv.items[0].c.length, 3, '手順3つ');
});

test('つくる：20・30・40・50問・7種類（2つ選べ）・小テスト／定期テストふう', async function(){
  W.subAdd('成人看護学');
  W.S.set.key = 'dummy';
  var req = null;
  fakeAI(function(r){
    req = r;
    return aiJsonReply({ title:'AIの見出し', questions:[
      { type:'mc', q:'答えが1つの4択', choices:['あ', 'い', 'う', 'え'], ans:[1] },
      { type:'mc', q:'2つ選べ。', choices:['あ', 'い', 'う', 'え', 'お'], ans:[1, 3] },
      { type:'tf', q:'これは○×である。', answer:'○' }
    ] });
  });
  await click('tab', 'make');
  eq($$('[data-act="mk-n"]').map(function(e){ return e.dataset.v; }).join(','), '20,30,40,50', '数は20・30・40・50');
  eq(W.mk.opt.n, 20, 'はじめは20問');
  eq(W.mk.opt.form, 'exam', 'はじめは定期テストふう');
  ok(!actEl('mk-auto'), 'おまかせはない');
  eq($$('[data-act="mk-type"].on').length, 7, '種類は7つ（ぜんぶオン）');
  ok(actEl('mk-type', 'two'), '「2つ選べ」も種類にある');
  await type('mk_paste', '心不全の看護。水分と塩分を守る。体重を毎日はかる。');
  await click('mk-n', '50');
  await click('mk-run');
  await until(function(){ return W.mk.pv; }, 4000, '作られる');
  var p = req.contents[0].parts.slice(-1)[0].text;
  ok(p.indexOf('問題を50問') >= 0, '50問をたのむ');
  ok(req.maxTokens >= 30000, '50問ぶん長く答えられる（' + req.maxTokens + '）');
  ok(p.indexOf('定期テスト') >= 0, '定期テストふう');
  ok(p.indexOf('3割ほどは「2つ選べ。」') >= 0, '4択の一部を2つ選べに');
  ok(p.indexOf('説明しなさい') >= 0, '定期テストの記述は説明の形');
  eq(W.mk.pv.items.length, 3, '3問とも入る');
  eq(W.mk.pv.title, 'AIの見出し', '名前をつけていなければ、AIの見出し');
  W.mk.pv = null; W.render(); await frames();
  /* 「2つ選べ」だけ → 答えが1つの4択はすてる。小テストふう */
  for(var k of ['tf', 'mc', 'cloze', 'short', 'order', 'match']) await click('mk-type', k);
  eq(W.mk.opt.types, ['two'], '2つ選べだけ');
  await click('mk-form', 'quiz');
  await click('mk-run');
  await until(function(){ return W.mk.pv; }, 4000, '作られる');
  p = req.contents[0].parts.slice(-1)[0].text;
  ok(p.indexOf('mc はすべて「2つ選べ。」') >= 0, 'ぜんぶ2つ選べ');
  ok(p.indexOf('小テスト') >= 0, '小テストふう');
  eq(W.mk.pv.items.map(function(x){ return x.q; }).join('／'), '2つ選べ。', '2つ選べの問題だけのこる');
  W.mk.pv = null; W.render(); await frames();
  await click('mk-typeall');
  eq(W.mk.opt.types.length, 7, '「ぜんぶえらぶ」でもどせる');
});

test('つくる：資料は名前だけ（第◯回・日付の欄はない）。名前とフォルダをえらんで入れる', async function(){
  var s = W.subAdd('解剖生理学');
  var f = W.fdAdd(s.id, '中間テストまで');
  W.S.ui.lastSub = s.id;
  W.S.set.key = 'dummy';
  W.saveNow();
  fakeAI(function(){ return aiJsonReply({ title:'AIの見出し', questions:[{ type:'tf', q:'心臓は4つの部屋がある。', answer:'○' }] }); });
  await click('tab', 'make');
  ok(!$('#mk_no') && !$('#mk_at') && !$('#mk_memo'), '第◯回・日付・強調の欄はない');
  ok($('#mk_title'), '名前の欄がある');
  await click('mk-fd', f.id);
  await type('mk_title', '第3回 心臓のしくみ');
  await type('mk_paste', '心臓は右心房・右心室・左心房・左心室の4つの部屋がある。');
  await click('mk-run');
  await until(function(){ return W.mk.pv; }, 4000, '作られる');
  eq(W.mk.pv.title, '第3回 心臓のしくみ', 'つけた名前を使う');
  eq($('#mk_title').value, '第3回 心臓のしくみ', 'できた問題の画面でも直せる');
  await type('mk_title', '心臓のしくみ（なおした）');
  await click('mk-add');
  var m = W.S.mats[0];
  eq(m.title, '心臓のしくみ（なおした）', '直した名前で入る');
  eq(m.fd, f.id, 'えらんだフォルダに入る');
  ok(m.at === undefined && m.no === undefined && m.memo === undefined, '日付・第◯回はもたない');
});

test('AI：答えがとちゅうで切れても、できている問題だけ使う', async function(){
  W.subAdd('成人看護学');
  W.S.set.key = 'dummy';
  fakeAI(function(){
    var full = JSON.stringify({ title:'見出し', questions:[
      { type:'tf', q:'1つめの問題である。', answer:'○' },
      { type:'tf', q:'2つめの問題である。', answer:'×' },
      { type:'tf', q:'3つめの問題（とちゅう）', answer:'○' }] });
    return { text:full.slice(0, full.indexOf('3つめ') + 5) };
  });
  await click('tab', 'make');
  await type('mk_paste', 'なにかの資料の文章です。');
  await click('mk-run');
  await until(function(){ return W.mk.pv; }, 4000, '作られる');
  eq(W.mk.pv.items.length, 2, 'できあがっていた2問');
  eq(W.mk.pv.title, '見出し', '見出しも読める');
});

test('AI：えらんでいない種類の問題は、すてる', async function(){
  W.S.set.key = 'dummy';
  fakeAI(function(){
    return aiJsonReply({ questions:[
      { type:'mc', q:'4択の問題', choices:['あ', 'い', 'う', 'え'], ans:[1] },
      { type:'short', q:'記述の問題', answer:'こたえ' }
    ] });
  });
  await click('tab', 'make');
  await type('mk_paste', 'なにかの資料。');
  await click('mk-type', 'short');
  eq(W.mk.opt.types.indexOf('short'), -1, '記述をはずした');
  await click('mk-run');
  await until(function(){ return W.mk.pv; }, 4000, '作られる');
  eq(W.mk.pv.items.length, 1, '記述はすてる');
  eq(W.mk.pv.items[0].qt, 'mc', 'のこったのは4択');
});

test('AI：うまくいかなかったら「もう一度ためす」が出る', async function(){
  W.S.set.key = 'dummy';
  var n = 0;
  fakeAI(function(){
    n++;
    if(n === 1) throw new Error('つながりませんでした');
    return aiJsonReply({ questions:[{ type:'tf', q:'2回目はうまくいく。', answer:'○' }] });
  });
  await click('tab', 'make');
  await type('mk_paste', '資料の字。');
  await click('mk-run');
  await until(function(){ return W.mk.pend; }, 4000, '失敗を覚える');
  ok(has('もう一度ためす'), 'もう一度ためすボタンが出る');
  await clickEl($$('[data-act="mk-run"]').slice(-1)[0]);
  await until(function(){ return W.mk.pv; }, 4000, '2回目で作れる');
  eq(W.mk.pv.items.length, 1, '作れた');
  ok(!W.mk.pend, '失敗の記録は消える');
});

test('AI：1問だけ作り直す・いらない問題をけす', async function(){
  W.S.set.key = 'dummy';
  fakeAI(function(req){
    var p = req.contents[0].parts.slice(-1)[0].text;
    if(p.indexOf('作り直して') >= 0){
      return aiJsonReply({ questions:[{ type:'tf', q:'作り直した問題である。', answer:'×' }] });
    }
    return aiJsonReply({ questions:[
      { type:'tf', q:'はじめの問題1である。', answer:'○' },
      { type:'tf', q:'はじめの問題2である。', answer:'○' }
    ] });
  });
  await click('tab', 'make');
  await type('mk_paste', '資料。');
  await click('mk-run');
  await until(function(){ return W.mk.pv; }, 4000, '作られる');
  eq(W.mk.pv.items.length, 2, '2問');
  await clickEl(actEl('mk-remake', null) || $('[data-act="mk-remake"][data-i="0"]'));
  await until(function(){ return W.mk.pv.items[0].q.indexOf('作り直した') >= 0; }, 4000, '作り直し');
  eq(W.mk.pv.items[0].a, [1], '答えも変わった（×）');
  await clickEl($('[data-act="mk-dropone"][data-i="1"]'));
  eq(W.mk.pv.items.length, 1, '1問けした');
});

test('つくる：資料がないときは、作らずに教えてくれる', async function(){
  await click('tab', 'make');
  await click('mk-run');
  ok(!W.mk.pv, '作られない');
  eq(aiCalls.length, 0, 'AIも呼ばない');
});

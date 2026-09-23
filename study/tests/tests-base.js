/* 土台：画面・科目・保存・設定 */

test('アプリがひらいて、下のタブが5つ出る', async function(){
  var navs = $$('#nav .navb');
  eq(navs.length, 5, 'タブの数');
  ok(has('きょうの勉強') || has('はじめかた'), 'ホームが出ている');
  await click('tab', 'make');
  ok(has('資料をえらぶ'), 'つくるタブ');
  await click('tab', 'lib');
  ok(has('科目をふやす'), '科目タブ');
  await click('tab', 'set');
  ok(has('AI（Gemini）のキー'), '設定タブ');
});

test('科目：足す・名前を変える・アイコン・色・並べかえ', async function(){
  await click('tab', 'lib');
  await type('lb_new', '解剖生理学');
  await click('lb-add');
  ok(W.subsAll().length === 1, '1つできた');
  eq(W.subsAll()[0].name, '解剖生理学', '名前');
  eq(W.subsAll()[0].field, 'jintai', '国試の分野が自動で入る');
  await type('lb_new', '基礎看護学');
  await click('lb-add');
  eq(W.subsAll().map(function(s){ return s.name; }), ['解剖生理学', '基礎看護学'], 'ならび');
  /* 名前を直す */
  var id = W.subsAll()[0].id;
  await click('lb-edit');
  await type('lb_nm_' + id, '解剖生理学Ⅰ');
  await clickEl(actEl('lb-rename'));
  eq(W.sub(id).name, '解剖生理学Ⅰ', '名前を直した');
  /* アイコンと色 */
  await clickEl($$('[data-act="lb-icon"]')[2]);
  ok(W.sub(id).icon === W.ICONS[2], 'アイコン');
  await clickEl($$('[data-act="lb-color"]')[4]);
  eq(W.sub(id).color, W.COLORS[4].id, '色');
  /* 下へ動かす */
  await clickEl(actEl('lb-down'));
  eq(W.subsAll().map(function(s){ return s.name; }), ['基礎看護学', '解剖生理学Ⅰ'], '並べかえ');
  /* 上へもどす */
  await clickEl($$('[data-act="lb-up"]')[1]);
  eq(W.subsAll().map(function(s){ return s.name; }), ['解剖生理学Ⅰ', '基礎看護学'], '上へもどす');
});

test('科目：同じ名前は足せない／よくある科目からも足せる', async function(){
  await click('tab', 'lib');
  await type('lb_new', '薬理学');
  await click('lb-add');
  await type('lb_new', '薬理学');
  await click('lb-add');
  eq(W.subsAll().length, 1, '同じ名前はふえない');
  await click('lb-addp', '母性看護学');
  eq(W.subsAll().length, 2, 'よくある科目から足せた');
  eq(W.sub(W.subsAll()[1].id).field, 'bosei', '母性の分野');
});

test('科目を消す：問題をのこす／ぜんぶ消す', async function(){
  var s = W.subAdd('成人看護学');
  W.qAdd({ qt:'tf', q:'テスト問題である。', c:['○（正しい）', '×（まちがい）'], a:[0] }, s.id, '');
  W.saveNow();
  await click('tab', 'lib');
  await click('lb-edit');
  await click('lb-del');
  ok(has('どうしますか'), 'どうするか聞かれる');
  await click('lb-del-keep');
  eq(W.subsAll().length, 0, '科目は消えた');
  eq(W.qsAll().length, 1, '問題はのこる');
  eq(W.qsAll()[0].sub, '', '科目なしになる');
  /* こんどは、ぜんぶ消す */
  var s2 = W.subAdd('老年看護学');
  W.qAdd({ qt:'tf', q:'もうひとつの問題である。', c:['○（正しい）', '×（まちがい）'], a:[0] }, s2.id, '');
  W.saveNow();
  W.render();
  await frames();
  await click('lb-edit');
  await click('lb-del');
  await click('lb-del-all');
  eq(W.subsAll().length, 0, '科目が消えた');
  eq(W.qsAll().length, 1, '中の問題も消えた（のこりは科目なしの1問）');
});

test('学期でしぼる（ほかの学期の科目は出さない）', async function(){
  W.S.set.term = '2026前期';
  var a = W.subAdd('前期の科目');
  var b = W.subAdd('後期の科目');
  b.term = '2026後期';
  W.saveNow();
  eq(W.subs().map(function(s){ return s.name; }), ['前期の科目'], 'いまの学期だけ');
  W.S.set.allTerms = 1;
  eq(W.subs().length, 2, 'ぜんぶ出す設定にすると、両方出る');
});

test('保存：開き直しても、科目と問題がのこる', async function(){
  var s = W.subAdd('保存テスト');
  W.qAdd({ qt:'mc', q:'のこる問題', c:['あ', 'い', 'う', 'え'], a:[1] }, s.id, '');
  W.saveNow();
  var raw = W.localStorage.getItem(W.KEY);
  ok(raw && raw.length > 50, '保存されている');
  W.load();
  eq(W.subsAll().length, 1, '科目がのこる');
  eq(W.qsAll().length, 1, '問題がのこる');
  eq(W.qsAll()[0].q, 'のこる問題', '中身もそのまま');
});

test('設定：APIキーの出し入れ・1日の目標・シャッフル', async function(){
  await click('tab', 'set');
  ok(!W.aiReady() || W.__FAKE_AI, 'はじめはキーなし');
  await type('st_key', 'AIzaTESTKEY');
  await click('st-key');
  eq(W.aiKey(), 'AIzaTESTKEY', 'キーが入った');
  ok(W.aiReady(), 'AIが使える状態');
  await click('st-goal', '20');
  eq(W.toNum(W.S.set.goal), 20, '目標');
  await click('st-shuffle', '0');
  eq(W.toNum(W.S.set.shuffle), 0, 'シャッフルを止めた');
  /* 消すときは confirm を「はい」にする */
  var origConfirm = W.confirm;
  W.confirm = function(){ return true; };
  await click('st-keydel');
  W.confirm = origConfirm;
  eq(W.aiKey(), '', 'キーを消した');
});

test('バックアップ：書き出した中身を、読みこみなおせる', async function(){
  var s = W.subAdd('バックアップ科目');
  W.qAdd({ qt:'cloze', q:'成人の脈拍は（　）回/分である。', at:'60〜100' }, s.id, '');
  W.logAnswer(W.qsAll()[0].id, true);
  W.saveNow();
  var dump = JSON.parse(JSON.stringify({ app:'mondai', ver:1, data:W.S }));
  /* まっさらにしてから、読みこみと同じことをする */
  W.S = W.blankState();
  W.saveNow();
  eq(W.qsAll().length, 0, 'いったん空になった');
  ['subs', 'mats', 'qs', 'moc'].forEach(function(k){ W.S[k] = dump.data[k]; });
  ['log', 'day', 'why'].forEach(function(k){ W.S[k] = dump.data[k]; });
  W.saveNow();
  eq(W.qsAll().length, 1, '問題がもどった');
  eq(W.subsAll()[0].name, 'バックアップ科目', '科目ももどった');
  ok(W.logOf(W.qsAll()[0].id), '記録ももどった');
});

test('ホーム：今日の数・つづけた日数・科目カード', async function(){
  var s = W.subAdd('ホーム科目');
  var q = W.qAdd({ qt:'mc', q:'ホームの問題', c:['あ', 'い', 'う', 'え'], a:[0] }, s.id, '');
  W.logAnswer(q.id, true);
  W.saveNow();
  await click('tab', 'home');
  ok(has('ホーム科目'), '科目カードが出る');
  ok(has('1日つづいています') || has('つづいています'), 'つづけた日数');
  eq(W.dayCount(W.today()).n, 1, '今日といた数');
});

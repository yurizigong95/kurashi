/* メモのタブ：書く・さがす・★・消す・メモから問題をつくる・ほかの端末とそろう */

async function newNote(body, opt){
  opt = opt || {};
  await click('tab', 'note');
  await click('nt-new');
  await type('nt_body', body);
  if(opt.no != null) await type('nt_no', String(opt.no));
  if(opt.sub) await click('nt-esub', opt.sub);
  await click('nt-save');
  return W.notesAll()[0];
}

test('メモ：書いて保存すると、一覧に出る', async function(){
  await click('tab', 'note');
  ok(has('メモ'), 'メモのタブがある');
  ok(has('新しいメモ'), 'はじめは、書きはじめる案内');
  var n = await newNote('心不全の看護\n安静度を守る。水分は1日1000mLまで。');
  eq(W.S.notes.length, 1, '1つ保存された');
  eq(W.noteTitle(n), '心不全の看護', '1行目が見出しになる');
  ok(has('心不全の看護'), '一覧に出る');
  ok(has('安静度を守る'), '続きも少し見える');
});

test('メモ：科目と第◯回を入れて、あとからさがせる', async function(){
  var s = W.subAdd('成人看護学'), s2 = W.subAdd('母性看護学');
  await newNote('心電図のみかた\nP波は心房の興奮。', { no:5, sub:s.id });
  await newNote('母性の授業\n初乳には免疫がある。', { sub:s2.id });
  await click('tab', 'note');
  eq(W.noteList().length, 2, '2つある');
  await type('nt_q', '心電図');
  await frames();
  eq(W.noteList().length, 1, 'ことばでさがせる');
  eq(W.noteTitle(W.noteList()[0]), '心電図のみかた', '見つかったメモ');
  await type('nt_q', '');
  await click('nt-sub', s.id);
  eq(W.noteList().length, 1, '科目でしぼれる');
  await click('nt-sub', '');
  eq(W.noteList().length, 2, 'ぜんぶにもどる');
});

test('メモ：★をつけると、上に出る', async function(){
  await newNote('ふつうのメモ1');
  var star = await newNote('だいじなメモ');
  await click('tab', 'note');
  await click('nt-open', star.id);
  await click('nt-estar');
  eq(W.noteGet(star.id).star, 1, '★がついた');
  await click('nt-close');
  eq(W.noteTitle(W.noteList()[0]), 'だいじなメモ', '★が上に来る');
  await click('nt-star');
  eq(W.noteList().length, 1, '★だけにしぼれる');
});

test('メモ：消すときは、一度たしかめる', async function(){
  var n = await newNote('まちがえて作ったメモ');
  await click('tab', 'note');
  await click('nt-open', n.id);
  await click('nt-del');
  ok(has('もどせません'), 'たしかめる');
  await click('nt-delno');
  eq(W.S.notes.length, 1, 'やめれば、のこる');
  await click('nt-del');
  await click('nt-del2');
  eq(W.S.notes.length, 0, '消えた');
  ok(W.S.del[n.id] > 0, '消したしるしがのこる（ほかの端末でも消える）');
});

test('メモ：この文から、そのまま問題をつくれる', async function(){
  var s = W.subAdd('成人看護学');
  var n = await newNote('心不全の看護\n安静度を守る。水分は1日1000mLまで。むくみを毎日みる。', { no:7, sub:s.id });
  await click('tab', 'note');
  await click('nt-open', n.id);
  await click('nt-make');
  eq(W.view.tab, 'make', '「つくる」に移る');
  eq(W.INP.mk_paste.indexOf('安静度を守る') >= 0, true, 'メモの文が入っている');
  eq(W.mk.mat.no, '7', '第◯回も持っていく');
  eq(W.S.ui.lastSub, s.id, '科目も持っていく');
  /* そのままAIなしで問題にできる */
  await click('mk-noai');
  await click('mk-run');
  ok(W.mk.pv && W.mk.pv.items.length >= 1, 'メモから問題ができた');
});

test('メモ：ほかの端末とも、そろう', async function(){
  var net = fakeNet();
  await newNote('こちらで書いたメモ');
  ok(await W.syStart(), 'つながった');
  await until(function(){ return net.docs[W.syDoc('idx')]; }, 4000, '置かれるのを待つ');
  var idx = net.docs[W.syDoc('idx')];
  var got = await W.syUnpack(net.docs[W.syDoc('p0')].d, idx.z);
  eq((got.notes || []).length, 1, 'メモも置き場に入る');
  /* ほかの端末が書いたメモが、こちらに入ってくる */
  var p = emptyPayload();
  p.notes = [{ id:'nt_ipad', mt:Date.now(), at:'2026-09-25', sub:'', no:'', body:'iPadで書いたメモ', star:0 }];
  await putRemote(net, p);
  await until(function(){ return W.noteGet('nt_ipad'); }, 4000, 'メモが届くのを待つ');
  ok(true, 'ほかの端末のメモが入った');
  W.syStop();
});

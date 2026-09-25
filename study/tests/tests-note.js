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

function toastText(){ var t = W.document.getElementById('toast'); return t ? t.textContent : ''; }

test('メモ：保存をおさなくても、書いたものはひとりでにのこる', async function(){
  await click('tab', 'note');
  await click('nt-new');
  var id = W.nt.edit;
  await type('nt_body', '授業中のメモ\n先生が「ここは出す」と言った');
  await until(function(){ return (W.noteGet(id) || {}).body === '授業中のメモ\n先生が「ここは出す」と言った'; }, 3000, 'ひとりでに入るのを待つ');
  await until(function(){ return (W.localStorage.getItem(W.KEY) || '').indexOf('ここは出す') >= 0; }, 3000, '端末に保存されるのを待つ');
  /* ほかのタブに行って、もどっても、書いたものがある */
  await click('tab', 'home');
  await click('tab', 'note');
  eq(W.document.getElementById('nt_body').value, '授業中のメモ\n先生が「ここは出す」と言った', '書いたものが、そのまま');
});

test('メモ：何も書かずに閉じたメモは、のこらない', async function(){
  await click('tab', 'note');
  await click('nt-new');
  await click('nt-close');
  eq(W.S.notes.length, 0, 'からのメモは、のこらない');
  ok(!has('からのメモ'), '一覧にも出ない');
  /* 書かずにアプリを閉じた（開きなおすと、一覧から始まる） */
  await click('nt-new');
  W.nt.edit = '';
  await click('tab', 'note');
  ok(!has('からのメモ'), '書きかけのからのメモは、一覧に出さない');
  await click('nt-new');
  eq(W.S.notes.length, 1, 'からのメモは、たまらない');
  /* からのメモは、ほかの端末にも送らない */
  eq(W.syPayload().notes.length, 0, '送る中身には入らない');
});

test('メモ：開いて閉じただけでは、直したことにならない', async function(){
  var n = await newNote('読むだけのメモ\nここは変えない');
  var mt = n.mt;
  await sleep(5);
  await click('tab', 'note');
  await click('nt-open', n.id);
  await click('nt-close');
  eq(W.noteGet(n.id).mt, mt, '時こくは、そのまま（ほかの端末の新しい中身を上書きしない）');
  await click('nt-open', n.id);
  await type('nt_body', '読むだけのメモ\nここを直した');
  await click('nt-save');
  ok(W.noteGet(n.id).mt > mt, '直したら、時こくが進む');
});

test('メモ：書いているメモがほかの端末で消されたら、知らせる', async function(){
  var n = await newNote('iPadで消すメモ');
  await click('tab', 'note');
  await click('nt-open', n.id);
  /* ほかの端末で消された（同期で入ってきた） */
  W.S.notes = [];
  W.render();
  await frames(); await sleep(10);
  eq(W.nt.edit, '', '一覧にもどる');
  ok(toastText().indexOf('ほかの端末で消されました') >= 0, '知らせが出る：' + toastText());
});

test('メモ：「つくる」に入れてある資料や問題を、だまって消さない', async function(){
  var n = await newNote('心不全の看護\n安静度を守る。水分は1日1000mLまで。');
  var origConfirm = W.confirm;
  try{
    /* 作っているとちゅうは、入れかえない */
    W.mk.busy = 'make';
    await click('tab', 'note');
    await click('nt-open', n.id);
    await click('nt-make');
    eq(W.view.tab, 'note', '作っているとちゅうは、動かない');
    W.mk.busy = '';
    /* 資料が入っているときは、たしかめる */
    W.mk.files = [{ id:'f1', name:'第3回.pdf', kind:'pdf', size:1000 }];
    var asked = '';
    W.confirm = function(m){ asked = m; return false; };
    await click('nt-make');
    ok(asked.indexOf('資料（1つ）') >= 0, 'たしかめる：' + asked);
    eq(W.view.tab, 'note', '「いいえ」なら、そのまま');
    eq(W.mk.files.length, 1, '資料はのこる');
    /* まだ科目に入れていない問題があるときも、たしかめる */
    W.mk.files = [];
    W.mk.pv = { sub:'', title:'前の資料', items:[{ qt:'tf', q:'前の問題' }], files:[] };
    asked = '';
    await click('nt-make');
    ok(asked.indexOf('まだ科目に入れていない問題') >= 0, 'たしかめる：' + asked);
    ok(W.mk.pv, '「いいえ」なら、下書きはのこる');
    W.confirm = function(){ return true; };
    await click('nt-make');
    eq(W.view.tab, 'make', '「はい」なら、つくるに移る');
    eq(W.mk.pv, null, '前の下書きは閉じて、メモの文が見える');
    ok(W.document.getElementById('mk_paste') && W.document.getElementById('mk_paste').value.indexOf('安静度') >= 0, 'メモの文が入っている');
  }finally{
    W.confirm = origConfirm;
    W.mk.busy = '';
  }
});

test('メモ：科目を消しても、メモはのこる（科目なしになる）', async function(){
  var s = W.subAdd('小児看護学');
  var n = await newNote('小児のバイタル\n脈拍は大人より多い', { sub:s.id });
  W.subDel(s.id, true);
  ok(W.noteGet(n.id), 'メモはのこる');
  eq(W.noteGet(n.id).sub, '', '科目なしになる');
});

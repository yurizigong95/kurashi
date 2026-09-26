/* リンクから問題を作る・まとめてえらぶ・同期のようすの表示 */

function pageUrl(){ return W.location.origin + '/study/tests/link-page.html'; }

test('リンク：読めるページは、AIを使わずにそのまま読む', async function(){
  fakeAI(function(){ throw new Error('AIは使わないはず'); });
  await click('tab', 'make');
  await type('mk_links', pageUrl());
  await click('mk-links');
  await until(function(){ return W.mk.files.length === 1 && !W.mk.busy; }, 8000, '読みおわるのを待つ');
  var f = W.mk.files[0];
  eq(f.kind, 'link', 'ウェブのページとして入った');
  eq(f.name, '心不全の看護のポイント', 'ページの題が名前になる');
  ok(f.text.indexOf('体重を毎日同じ時間にはかる') >= 0, '本文を読んだ');
  ok(f.text.indexOf('広告') < 0 && f.text.indexOf('お問い合わせ') < 0 && f.text.indexOf('コピーライト') < 0, 'メニュー・広告・下の字は入れない');
  eq(aiCalls.length, 0, 'AIは使っていない');
  eq(W.document.getElementById('mk_links').value, '', '読めたリンクは欄から消える');
  ok(has('ウェブのページ'), '画面にも出る');
});

test('リンク：読めないページは、AIが開いて読む（いくつでもまとめて）', async function(){
  W.__FAKE_FETCH = async function(){ throw new Error('CORS'); };
  var urls = ['https://example.com/heart', 'https://example.org/lung', 'https://example.net/ng'];
  fakeAI(function(req){
    return { text:'### 1\nタイトル：心不全\n心不全では息切れやむくみが出る。体重を毎日はかる。水分制限を守る。\n' +
                  '### 2\nタイトル：肺炎\n肺炎では発熱とせきが出る。SpO2を見る。痰の色と量を記録する。\n' +
                  '### 3\n（読めませんでした）',
             meta:{ urlMetadata:[{ retrievedUrl:urls[0], urlRetrievalStatus:'URL_RETRIEVAL_STATUS_SUCCESS' },
                                 { retrievedUrl:urls[1], urlRetrievalStatus:'URL_RETRIEVAL_STATUS_SUCCESS' },
                                 { retrievedUrl:urls[2], urlRetrievalStatus:'URL_RETRIEVAL_STATUS_ERROR' }] } };
  });
  try{
    await click('tab', 'make');
    await type('mk_links', urls.join('\n') + '\nhttps://youtu.be/abcDEF12345');
    await click('mk-links');
    await until(function(){ return W.mk.files.length >= 3 && !W.mk.busy; }, 8000, '読みおわるのを待つ');
    eq(aiCalls.length, 1, 'AIへは1回でまとめてたのむ');
    ok(aiCalls[0].tools && aiCalls[0].tools[0] && 'url_context' in aiCalls[0].tools[0], 'リンクを読む道具を使う');
    eq(W.mk.files.map(function(f){ return f.name; }).join('／'), '心不全／肺炎／YouTube（abcDEF12345）', '読めたものが、入れた順に入る');
    ok(W.mk.files[0].text.indexOf('水分制限') >= 0, 'AIが読んだ本文');
    eq(W.document.getElementById('mk_links').value, urls[2], '読めなかったリンクだけ欄にのこる');
  }finally{ W.__FAKE_FETCH = null; }
});

test('リンク：YouTube はそのままAIに渡して、問題を作る', async function(){
  W.subAdd('成人看護学');
  fakeAI(function(){ return aiJsonReply({ title:'講義動画', summary:'', questions:[{ type:'tf', q:'心不全では息切れが出る。', answer:'○', why:'' }] }); });
  await click('tab', 'make');
  await type('mk_links', 'https://www.youtube.com/watch?v=abcDEF12345&t=30s');
  await click('mk-links');
  await until(function(){ return W.mk.files.length === 1 && !W.mk.busy; }, 4000, '入るのを待つ');
  await click('mk-run');
  await until(function(){ return W.mk.pv; }, 8000, '問題ができるのを待つ');
  var fd = partsOf(aiCalls[0]).filter(function(p){ return p.file_data; })[0];
  ok(fd, '動画を渡した');
  eq(fd.file_data.file_uri, 'https://www.youtube.com/watch?v=abcDEF12345', 'YouTube のアドレス');
  ok(!('mime_type' in fd.file_data), '種類は書かない（YouTube のきまり）');
});

test('リンク：はりつける欄にリンクだけ入れても、ページを読んで作る。資料にリンクがのこる', async function(){
  var s = W.subAdd('成人看護学');
  await click('tab', 'make');
  await click('mk-noai');
  await type('mk_paste', pageUrl());
  await click('mk-run');
  await until(function(){ return W.mk.pv && W.mk.pv.items.length; }, 8000, '問題ができるのを待つ');
  ok(W.mk.files.some(function(f){ return f.link === pageUrl(); }), 'リンクとして読んだ');
  await W.mkAdd();
  await frames();
  var m = W.S.mats[W.S.mats.length - 1];
  ok(m && (m.links || [])[0] === pageUrl(), '資料にリンクがのこる');
  ok(m.text.indexOf('起座呼吸') >= 0, 'ページの字も資料にのこる');
  ok(W.qsAll().length > 0 && W.qsAll()[0].sub === s.id, '問題が入った');
});

test('まとめてえらぶ：写真・ファイルは20こまで。こえたら知らせる', async function(){
  await click('tab', 'make');
  ok(actEl('mk-photos'), '写真をまとめてえらぶボタンがある');
  var list = [];
  for(var i = 0; i < 22; i++) list.push(new W.File(['第' + (i + 1) + '回の資料です。心不全の看護について学ぶ。'], 'memo' + (i + 1) + '.txt', { type:'text/plain' }));
  await W.mkTake(list);
  await frames();
  eq(W.mk.files.length, 20, '20こ入った');
  ok(toastText().indexOf('20こまで') >= 0, '知らせる：' + toastText());
});

test('同期のようす：上に「同期済み」と出て、おすと設定の同期のところへ行く', async function(){
  var net = fakeNet();
  W.subAdd('成人看護学');
  W.saveNow();
  ok(await W.syStart(), 'つながった');
  await until(function(){ return W.document.getElementById('synctag').textContent === '同期済み'; }, 6000, '「同期済み」になるのを待つ');
  ok(/st-ok/.test(W.document.getElementById('synctag').className), '緑の印');
  await clickEl(W.document.getElementById('synctag'));
  eq(W.view.tab, 'set', '設定に移る');
  ok(W.document.getElementById('sy-sec'), '同期のところがある');
  W.syStop();
});

test('同期のようす：つながっている端末・まだ送っていない変更・変更の記録を出す', async function(){
  var net = fakeNet();
  var s = W.subAdd('成人看護学');
  addQ(s.id, { qt:'tf', q:'はじめの問題', c:['○（正しい）', '×（まちがい）'], a:[0] });
  ok(await W.syStart(), 'つながった');
  await until(function(){ return W.SY.pushedAt; }, 6000, '送るのを待つ');
  await until(function(){ return net.docs[W.syDoc('devs')]; }, 4000, '端末の一覧が置かれるのを待つ');
  eq(W.syDiffText(W.syPending()), '', 'まだ送っていない変更は、なし');
  /* こちらで1問足す（まだ送っていない） */
  W.syStop();
  addQ(s.id, { qt:'tf', q:'足した問題', c:['○（正しい）', '×（まちがい）'], a:[0] });
  eq(W.syDiffText(W.syPending()), '問題 +1', 'まだ送っていない変更が分かる');
  /* ほかの端末（iPad）から受けとる */
  var devs = net.docs[W.syDoc('devs')];
  devs.list.ipad = { name:'iPad', at:Date.now(), build:W.APP_BUILD };
  await net.set(W.syDoc('devs'), devs);
  ok(await W.syStart(), 'つなぎなおした');
  await until(function(){ return W.SY.devs && W.SY.devs.ipad; }, 4000, '端末の一覧を読むのを待つ');
  var p = W.syPayload();
  p.notes = [{ id:'nt_ipad', mt:Date.now(), at:'2026-09-26', sub:'', no:'', body:'iPadのメモ', star:0 }];
  var pk = await W.syPack(p);
  await net.set(W.syDoc('p0'), { d:pk.s, i:0, n:1, h:W.hash(pk.s), at:Date.now() });
  await net.set(W.syDoc('idx'), { v:1, h:'from-ipad-' + Date.now(), hs:[W.hash(pk.s)], n:1, z:pk.z, at:Date.now(), dev:'ipad', imgs:{} });
  await until(function(){ return W.noteGet('nt_ipad'); }, 6000, 'iPadのメモが届くのを待つ');
  await until(function(){ return W.syLogAll().some(function(x){ return x.d === 'in'; }); }, 4000, '受けとった記録');
  W.SY.devAt = Date.now();
  await click('tab', 'set');
  ok(has('iPad から受けとった'), '変更の記録：受けとった（' + W.syLogAll().map(function(x){ return x.v + ':' + x.m; }).join(' / ') + '）');
  ok(has('メモ +1'), '何を受けとったか');
  ok(has('この端末から送った'), '変更の記録：送った');
  ok(has('この端末'), '端末の一覧に、この端末');
  ok(has('iPad'), '端末の一覧に、iPad');
  W.syStop();
});

test('APIキー：くらしの手帳に入れたキーを、自動で使う', async function(){
  var saved = W.localStorage.getItem('shiharai:v1'), oc = W.confirm;
  try{
    W.localStorage.setItem('shiharai:v1', JSON.stringify({ settings:{ geminiKey:'AQ.kurashi-test-key' } }));
    W.S.set.key = '';
    eq(W.aiKey(), 'AQ.kurashi-test-key', 'くらしの手帳のキーを使う');
    eq(W.aiKeyFrom(), 'kurashi', 'どこのキーか分かる');
    ok(W.aiReady(), 'AIが使える');
    await click('tab', 'set');
    ok(has('くらしの手帳のキーを、自動で使っています'), '設定にも出る');
    /* ここで別のキーを入れたら、そちらを使う */
    await type('st_key', 'AIza-own-key');
    await click('st-key');
    eq(W.aiKey(), 'AIza-own-key', 'ここで入れたキーを使う');
    ok(has('くらしの手帳にも、別のキーが入っています'), '別のキーがあることを知らせる');
    W.confirm = function(){ return true; };
    await click('st-keydel');
    eq(W.aiKey(), 'AQ.kurashi-test-key', '消すと、くらしの手帳のキーにもどる');
    /* キーは同期にも、バックアップにも入れない */
    ok(JSON.stringify(W.syPayload()).indexOf('kurashi-test-key') < 0, '同期に入らない');
  }finally{
    W.confirm = oc;
    if(saved == null) W.localStorage.removeItem('shiharai:v1'); else W.localStorage.setItem('shiharai:v1', saved);
    W.S.set.key = '';
  }
});

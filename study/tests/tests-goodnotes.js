/* Goodnotesのノート（共有リンク → ドライブの自動バックアップからえらぶ） */

/* にせの橋わたし（くらしの手帳の Apps Script のかわり） */
function fakeGas(opt){
  opt = opt || {};
  var pdf = '%PDF-1.4\n' + new Array(40).join('1 0 obj << /Type /Page >> endobj\n') + '%%EOF';
  var bytes = new W.TextEncoder().encode(pdf), calls = [];
  var b64 = function(u8){ var s = ''; for(var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return W.btoa(s); };
  W.__FAKE_GAS = async function(req){
    calls.push(req);
    if(opt.old) return { ok:false, error:'知らないお願いです：' + req.action };
    if(req.action === 'gnList'){
      if(opt.nofolder) return { ok:true, items:[], none:'「GoodNotes」フォルダが見つかりません', folderName:'GoodNotes' };
      if(opt.notpdf) return { ok:true, items:[], folderName:'GoodNotes', other:3 };
      var items = [
        { id:'g1', name:'成人看護学 第5回.pdf', size:bytes.length, updated:Date.now() - 3600000 },
        { id:'g2', name:'解剖生理 まとめ.pdf', size:bytes.length, updated:Date.now() - 86400000 }
      ];
      if(opt.many) items = opt.many;
      if(req.q) items = items.filter(function(x){ return x.name.indexOf(req.q) >= 0; });
      return { ok:true, items:items, folderName:'GoodNotes', other:0 };
    }
    if(req.action === 'gnGet'){
      var at = req.at || 0, n = Math.min(100, bytes.length - at);          /* 少しずつ（100バイトずつ）返す */
      return { ok:true, name:'成人看護学 第5回.pdf', size:bytes.length, at:at, n:n, mime:'application/pdf', data:b64(bytes.slice(at, at + n)) };
    }
    return { ok:false, error:'知らないお願いです：' + req.action };
  };
  return { calls:calls, bytes:bytes };
}

test('Goodnotes：共有リンクを入れると、ドライブのバックアップのノートからえらんで読める', async function(){
  var g = fakeGas();
  await click('tab', 'make');
  await type('mk_links', 'https://share.goodnotes.com/s/YkH7jGssqScG6SoV7HINEf');
  await click('mk-links');
  await until(function(){ return W.gn.open && W.gn.items && !W.gn.busy; }, 4000, 'ノートの一覧が出るのを待つ');
  ok(has('Goodnotesのノート'), 'Goodnotesのノートの一覧が出る');
  ok(has('リンクから読めません'), 'リンクからは読めないわけを出す');
  ok(has('成人看護学 第5回') && has('解剖生理 まとめ'), 'ノートの名前が出る');
  eq(aiCalls.length, 0, 'AIはむだに使わない');
  await click('gn-pick', 'g1');
  ok(has('えらんだノートを読む（1）'), 'えらんだ数');
  await click('gn-take');
  await until(function(){ return W.mk.files.length === 1 && !W.mk.busy && !W.gn.busy; }, 6000, '受けとるのを待つ');
  var f = W.mk.files[0];
  eq(f.kind, 'pdf', 'PDFとして入る');
  eq(f.name, '成人看護学 第5回.pdf', 'ノートの名前');
  var gets = g.calls.filter(function(c){ return c.action === 'gnGet'; });
  ok(gets.length >= 3, '大きいノートは、少しずつ受けとる（' + gets.length + '回）');
  var got = W.atob(String(f.url).split(',')[1]);
  eq(got.length, g.bytes.length, 'PDFがそのまま受けとれた');
  ok(/^%PDF/.test(got) && /%%EOF$/.test(got), '中身がこわれていない');
  eq(W.document.getElementById('mk_links').value, '', '共有リンクは欄から外れる');
  ok(!W.gn.open, '一覧はとじる');
});

test('Goodnotes：ボタンからも開ける・名前でさがせる', async function(){
  fakeGas();
  await click('tab', 'make');
  await click('gn-open');
  await until(function(){ return W.gn.items && !W.gn.busy; }, 4000, '一覧');
  eq(W.gn.items.length, 2, '2冊');
  await type('gn_q', '解剖');
  await click('gn-search');
  await until(function(){ return W.gn.items && !W.gn.busy; }, 4000, 'さがす');
  eq(W.gn.items.length, 1, 'さがせる');
  eq(W.gn.items[0].id, 'g2', '解剖生理のノート');
});

test('Goodnotes：つながっていない・古い版・フォルダがない・PDFでない ときは、やり方を出す', async function(){
  await click('tab', 'make');
  W.__FAKE_GAS = null;
  await click('gn-open');
  await until(function(){ return !W.gn.busy && W.gn.why; }, 4000, 'つながっていない');
  eq(W.gn.why, 'nogas', 'つながっていない');
  ok(has('Google連携」をつなぐと使えます'), 'つなぎ方を出す');
  fakeGas({ old:1 });
  await click('gn-reload');
  await until(function(){ return !W.gn.busy && W.gn.why === 'old'; }, 4000, '古い版');
  ok(has('新しい版にしてください') && has('新バージョン'), '貼り直し方を出す');
  fakeGas({ nofolder:1 });
  await click('gn-reload');
  await until(function(){ return !W.gn.busy && W.gn.why === 'nofolder'; }, 4000, 'フォルダがない');
  ok(has('自動バックアップ') && has('PDF'), 'Goodnotesの自動バックアップの手順を出す');
  fakeGas({ notpdf:1 });
  await click('gn-reload');
  await until(function(){ return !W.gn.busy && W.gn.why === 'notpdf'; }, 4000, 'PDFでない');
  ok(has('PDF ではないようです'), '形式をPDFにするよう出す');
});

test('Goodnotes：「問題をつくる」をおしても、ノートをえらぶまでは作らない', async function(){
  W.subAdd('成人看護学');
  fakeGas();
  fakeAI(function(){ throw new Error('まだAIは使わないはず'); });
  await click('tab', 'make');
  await type('mk_links', 'https://share.goodnotes.com/s/abcDEF123');
  await click('mk-run');
  await until(function(){ return W.gn.open && W.gn.items && !W.gn.busy; }, 4000, '一覧が出る');
  ok(!W.mk.pv, 'まだ作らない');
  eq(aiCalls.length, 0, 'AIは使っていない');
});

test('Goodnotes：フォルダごと・名前順（第2回→第10回）・新しい順／えらんでも一覧の場所が動かない／前の橋わたしなら貼り直しを案内', async function(){
  var now = Date.now(), many = [];
  for(var i = 1; i <= 24; i++) many.push({ id:'a' + i, name:'解剖生理学 第' + i + '回.pdf', size:1000, updated:now - i * 60000, path:'1年後期 / 解剖生理学' });
  many.push({ id:'b1', name:'成人看護学 第2回.pdf', size:1000, updated:now - 10, path:'1年後期 / 成人看護学' });
  many.push({ id:'b2', name:'成人看護学 第10回.pdf', size:1000, updated:now - 5, path:'1年後期 / 成人看護学' });
  many.push({ id:'c1', name:'メモ帳.pdf', size:1000, updated:now - 1, path:'' });
  fakeGas({ many:many });
  await click('tab', 'make');
  await click('gn-open');
  await until(function(){ return W.gn.items && !W.gn.busy; }, 4000, '一覧');
  var folders = function(){ return $$('.gnfold .fn').map(function(e){ return e.textContent.replace('📁 ', ''); }); };
  var names = function(){ return $$('.gnrow b').map(function(e){ return e.textContent; }); };
  ok(actEl('gn-sort', 'folder') && actEl('gn-sort', 'folder').classList.contains('on'), 'はじめはフォルダごと');
  eq(folders().join('|'), '1年後期 / 解剖生理学|1年後期 / 成人看護学|GoodNotes（いちばん上）', 'フォルダは名前順・いちばん上は最後');
  var nm = names();
  eq(nm.slice(0, 3).join(','), '解剖生理学 第1回,解剖生理学 第2回,解剖生理学 第3回', 'フォルダの中は名前順（数字の大きさで）');
  ok(nm.indexOf('成人看護学 第2回') < nm.indexOf('成人看護学 第10回'), '第2回 → 第10回');
  /* たたむ */
  await click('gn-fold', '1年後期 / 解剖生理学');
  ok(names().indexOf('解剖生理学 第1回') < 0 && /24冊/.test($('.gnfold').textContent), 'たたむと冊数だけ');
  await click('gn-fold', '1年後期 / 解剖生理学');
  /* 下のほうをえらんでも、一覧の見ていた場所から動かない */
  var list = $('.gnlist');
  ok(list.scrollHeight > list.clientHeight + 100, '一覧はスクロールできる');
  list.scrollTop = list.scrollHeight;
  var top0 = list.scrollTop;
  ok(top0 > 100, '下までスクロール：' + top0);
  var row = $('.gnrow[data-v="b2"]');
  row.click(); await frames();
  ok(W.gn.pick.b2, 'えらべた');
  eq($('.gnlist').scrollTop, top0, 'えらんでも一覧の場所はそのまま');
  ok(/1えらんだ/.test($$('.gnfold')[1].textContent), 'フォルダの見出しに、えらんだ数');
  /* 名前順・新しい順 */
  await click('gn-sort', 'name');
  ok(!$('.gnfold'), '名前順はフォルダでまとめない');
  eq(names()[0], 'メモ帳', '名前順');
  await click('gn-sort', 'new');
  eq(names().slice(0, 3).join(','), 'メモ帳,成人看護学 第10回,成人看護学 第2回', '新しい順');
  ok(W.gn.pick.b2, '並べかえても、えらんだものはそのまま');
  ok(!has('貼り直して'), '新しい橋わたしなら、貼り直しの案内は出さない');
});

test('Goodnotes：前の橋わたし（フォルダがわからない）なら名前順で出して、貼り直しを案内', async function(){
  fakeGas();
  await click('tab', 'make');
  await click('gn-open');
  await until(function(){ return W.gn.items && !W.gn.busy; }, 4000, '一覧');
  ok(!actEl('gn-sort', 'folder'), 'フォルダごとは出さない');
  ok(actEl('gn-sort', 'name').classList.contains('on'), 'はじめは名前順');
  eq($$('.gnrow b').map(function(e){ return e.textContent; }).join(','), '解剖生理 まとめ,成人看護学 第5回', '名前順');
  ok(has('フォルダごとにまとめるには') && has('貼り直して'), '貼り直しを案内');
});

test('Goodnotes：ノートを受けとれなかったときは、わけを一覧の上にのこす', async function(){
  fakeGas();
  var base = W.__FAKE_GAS;
  W.__FAKE_GAS = async function(req){
    if(req.action === 'gnGet') return { ok:false, error:'ドライブから読めませんでした（403）' };
    return base(req);
  };
  await click('tab', 'make');
  await click('gn-open');
  await until(function(){ return W.gn.items && !W.gn.busy; }, 4000, '一覧が出る');
  await clickEl($('[data-act="gn-pick"][data-v="g1"]'));
  await click('gn-take');
  await until(function(){ return !W.gn.busy; }, 4000, 'おわる');
  ok(has('受けとれなかったノート') && has('403'), 'わけが画面にのこる');
  eq(W.mk.files.length, 0, '資料には入らない');
  ok(W.gn.open, '一覧はひらいたまま（えらびなおせる）');
});

test('Goodnotes：橋わたしに届かないときは、わけ（消えた・許可切れ）・作ったアカウント・たしかめ方・ファイルから入れる道を出す', async function(){
  var calls = 0;
  W.__FAKE_GAS = async function(){ calls++; var e = new Error(W.GAS_PROBE_TEXT.broken); e.why = 'broken'; throw e; };
  W.__FAKE_GAS_ACCT = 'kango@example.com';
  await click('tab', 'make');
  await click('gn-open');
  await until(function(){ return W.gn.why === 'broken' && !W.gn.busy; }, 4000, '一覧を読みおわるのを待つ');
  ok(has('橋わたし（Apps Script）から返事が来ません'), 'ネットではなく、橋わたしが答えないと出す');
  ok(!has('ネットにつながりませんでした'), '「ネットにつながらない」とは出さない');
  ok(has('kango@example.com'), '橋わたしを作ったアカウントを出す');
  ok(has('右上の丸いアイコン'), 'アカウントの切りかえ方');
  var a = W.document.querySelector('#gn-sec a[href="https://script.google.com/fake"]');
  ok(a && a.target === '_blank', '橋わたしのページをひらくボタン');
  ok(has('橋わたしなしでも入れられます') && W.document.querySelector('#gn-sec [data-act="mk-pick"]'), 'ファイルからえらぶ道も出す');
  ok(!has('大きいノートが読めないときは'), '新しい版にする話は出さない（まぎらわしいので）');
  eq(calls, 1, '橋わたしには1回だけ');
});

test('Goodnotes：届かないわけの見分け方（動いている・公開が全員でない・消えた／許可切れ・ネットがない）', async function(){
  var orig = W.fetch, mode = '';
  W.fetch = async function(url, opt){
    if(!/script\.google\.com\/macros\/s\/probe/.test(String(url))) return orig.apply(W, arguments);
    opt = opt || {};
    if(mode === 'alive') return new W.Response(JSON.stringify({ ok:true, msg:'くらしの手帳の橋わたしは動いています' }));
    if(mode === 'login') return new W.Response('<html><a href="https://accounts.google.com/ServiceLogin">login</a></html>');
    if(mode === 'broken'){ if(opt.mode === 'no-cors') return new W.Response(''); throw new TypeError('Load failed'); }
    throw new TypeError('Load failed');
  };
  try{
    var ms = ['alive', 'login', 'broken', 'offline'];
    for(var i = 0; i < ms.length; i++){
      mode = ms[i];
      eq(await W.gasProbe('https://script.google.com/macros/s/probe' + i + '/exec'), ms[i], ms[i]);
    }
    mode = 'alive';
    eq(await W.gasProbe('https://script.google.com/macros/s/probe3/exec'), 'offline', '1分のあいだは、同じ答えを使う（何度もたしかめない）');
  }finally{ W.fetch = orig; }
});

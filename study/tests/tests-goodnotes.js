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

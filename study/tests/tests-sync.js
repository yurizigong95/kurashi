/* ほかの端末とそろえる（同期）
   本物のつなぎ先は使わず、「にせの置き場」を作って、2台ぶんのやりとりを再現します。 */

/* にせの置き場（Firestore のかわり） */
function fakeNet(){
  var docs = {}, subs = {};
  var net = {
    docs:docs,
    get:async function(id){ return docs[id] ? JSON.parse(JSON.stringify(docs[id])) : null; },
    set:async function(id, d){
      docs[id] = JSON.parse(JSON.stringify(d));
      (subs[id] || []).forEach(function(f){ f(JSON.parse(JSON.stringify(d))); });
      return true;
    },
    sub:function(id, next, err){
      (subs[id] = subs[id] || []).push(next);
      if(docs[id]) setTimeout(function(){ next(JSON.parse(JSON.stringify(docs[id]))); }, 0);
      return function(){ subs[id] = (subs[id] || []).filter(function(f){ return f !== next; }); };
    }
  };
  W.__FAKE_SYNC = net;
  return net;
}
/* もう1台の端末が置いたことにする（中身を、置き場に書く） */
async function putRemote(net, payload){
  var pk = await W.syPack(payload);
  await net.set(W.syDoc('p0'), { d:pk.s, i:0, n:1, h:W.hash(pk.s), at:Date.now() });
  await net.set(W.syDoc('idx'), { v:1, h:'remote-' + Date.now(), hs:[W.hash(pk.s)], n:1, z:pk.z,
    at:Date.now(), dev:'ipad', imgs:{} });
}
function emptyPayload(){
  return { v:1, subs:[], mats:[], qs:[], moc:[], log:{}, day:{}, why:{}, del:{}, set:{}, smt:0 };
}

test('同期：この端末で作ったものが、置き場に出る', async function(){
  var net = fakeNet();
  var s = W.subAdd('成人看護学');
  addQ(s.id, { qt:'tf', q:'心不全では息切れが出る。', c:['○（正しい）', '×（まちがい）'], a:[0] });
  ok(await W.syStart(), 'つながった');
  await until(function(){ return net.docs[W.syDoc('idx')]; }, 4000, '目次が置かれるのを待つ');
  var idx = net.docs[W.syDoc('idx')];
  eq(idx.n, 1, '1つの切れはしにおさまった');
  var got = await W.syUnpack(net.docs[W.syDoc('p0')].d, idx.z);
  eq(got.subs.length, 1, '科目が入っている');
  eq(got.qs.length, 1, '問題が入っている');
  ok(!('key' in (got.set || {})), 'APIキーは入れない');
  ok(!('use' in (got.set || {})), '使った量も入れない');
  W.syStop();
});

test('同期：ほかの端末で足したものが、こちらに入ってくる', async function(){
  var net = fakeNet();
  ok(await W.syStart(), 'つながった');
  var p = emptyPayload();
  p.subs.push({ id:'sub_ipad', mt:Date.now(), name:'母性看護学', icon:'🤱', ord:10, arch:0 });
  p.qs.push({ id:'q_ipad', mt:Date.now(), sub:'sub_ipad', qt:'tf', q:'母乳は初乳から出る。', c:['○（正しい）', '×（まちがい）'], a:[0], lv:2 });
  await putRemote(net, p);
  await until(function(){ return W.qGet('q_ipad'); }, 4000, '問題が届くのを待つ');
  ok(W.sub('sub_ipad'), '科目も届いた');
  eq(W.qsAll().length, 1, '問題が1つ入った');
  W.syStop();
});

test('同期：消したものは、生き返らない', async function(){
  var net = fakeNet();
  var s = W.subAdd('基礎看護学');
  var q = addQ(s.id, { qt:'tf', q:'手洗いは30秒以上。', c:['○（正しい）', '×（まちがい）'], a:[0] });
  ok(await W.syStart(), 'つながった');
  await until(function(){ return net.docs[W.syDoc('idx')]; }, 4000, '一度置かれるのを待つ');
  /* この端末で消す */
  W.qDel(q.id);
  W.saveNow();
  ok(W.S.del[q.id] > 0, '消したしるしがのこる');
  /* ほかの端末は、まだ古い中身を持っている */
  var p = emptyPayload();
  p.qs.push({ id:q.id, mt:q.mt, sub:s.id, qt:'tf', q:'手洗いは30秒以上。', c:['○（正しい）', '×（まちがい）'], a:[0], lv:2 });
  await putRemote(net, p);
  await W.syPush();
  eq(W.qsAll().length, 0, '消えたまま');
  W.syStop();
});

test('同期：同じものを2台で直したら、あとから直したほうがのこる', async function(){
  var net = fakeNet();
  var s = W.subAdd('成人看護学');
  var q = addQ(s.id, { qt:'tf', q:'こちらで直した文', c:['○（正しい）', '×（まちがい）'], a:[0] });
  ok(await W.syStart(), 'つながった');
  var p = emptyPayload();
  p.qs.push({ id:q.id, mt:q.mt + 60000, sub:s.id, qt:'tf', q:'あとから直した文', c:['○（正しい）', '×（まちがい）'], a:[0], lv:2 });
  p.subs.push({ id:s.id, mt:s.mt, name:'成人看護学', icon:'🩺', ord:10, arch:0 });
  await putRemote(net, p);
  await until(function(){ return (W.qGet(q.id) || {}).q === 'あとから直した文'; }, 4000, '新しいほうに変わるのを待つ');
  ok(true, 'あとから直したほうになった');
  W.syStop();
});

test('同期：といた記録は、回数が多いほうを採る', async function(){
  var net = fakeNet();
  var s = W.subAdd('成人看護学');
  var q = addQ(s.id, { qt:'tf', q:'脈拍は60〜100回/分である。', c:['○（正しい）', '×（まちがい）'], a:[0] });
  W.S.log[q.id] = { n:1, ok:1, miss:0, box:1, due:'2026-09-26', last:'2026-09-25' };
  W.saveNow();
  ok(await W.syStart(), 'つながった');
  var p = emptyPayload();
  p.qs.push({ id:q.id, mt:q.mt, sub:s.id, qt:'tf', q:'脈拍は60〜100回/分である。', c:['○（正しい）', '×（まちがい）'], a:[0], lv:2 });
  p.log[q.id] = { n:5, ok:4, miss:1, box:3, due:'2026-10-02', last:'2026-09-25' };
  p.day['2026-09-25'] = { n:9, ok:7 };
  await putRemote(net, p);
  await until(function(){ return W.toNum((W.S.log[q.id] || {}).n) === 5; }, 4000, '記録が合わさるのを待つ');
  eq(W.S.log[q.id].box, 3, 'すすんだ箱のほう');
  eq(W.S.day['2026-09-25'].n, 9, 'その日の数は多いほう');
  W.syStop();
});

test('同期：資料の写真も、受けわたしできる', async function(){
  var net = fakeNet();
  var png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await W.photoPut('ph_test1', png);
  W.S.mats.push({ id:'mat1', mt:Date.now(), sub:'', title:'第1回', kind:'photo', at:'2026-09-25',
                  photos:['ph_test1'], text:'', summary:'', n:0 });
  W.saveNow();
  ok(await W.syStart(), 'つながった');
  await until(function(){ var i = net.docs[W.syDoc('idx')]; return i && i.imgs && i.imgs.ph_test1; }, 6000, '写真が置かれるのを待つ');
  ok(net.docs[W.syDoc('img_ph_test1_0')], '写真の中身も置かれた');
  /* こちらの写真を消して、取りに行けるか見る */
  await W.photoDel('ph_test1');
  await W.syImgPull(net, net.docs[W.syDoc('idx')]);
  var back = await W.photoGet('ph_test1');
  eq(back, png, '写真が返ってきた');
  W.syStop();
});

test('同期：つなぎ先がないときは、静かに止まる', async function(){
  W.__FAKE_SYNC = null;
  eq(W.syReady(), false, 'テストのときは、本物にはつながない');
  var st = W.syState();
  ok(st.text.indexOf('できません') >= 0, '画面にも、そう出る：' + st.text);
  ok(!(await W.syStart()), 'はじまらない');
});

/* ほんとうの端末と同じやり方で置く（目次の印も、ほんものと同じ計算） */
async function putRemoteReal(net, payload){
  var pk = await W.syPack(payload);
  var parts = W.syCut(pk.s, W.SY_PART);
  var hs = parts.map(function(p){ return W.hash(p); });
  for(var i = 0; i < parts.length; i++) await net.set(W.syDoc('p' + i), { d:parts[i], i:i, n:parts.length, h:hs[i], at:Date.now() });
  var h = W.hash(hs.join(','));
  await net.set(W.syDoc('idx'), { v:1, h:h, hs:hs, n:parts.length, z:pk.z, at:Date.now(), dev:'ipad', imgs:{} });
  return h;
}

test('同期：同じ中身なら、ならび順がちがっても同じ印になる（2台で送り合いにならない）', async function(){
  var s1 = W.subAdd('成人看護学'), s2 = W.subAdd('母性看護学');
  addQ(s1.id, { qt:'tf', q:'問題1', c:['○（正しい）', '×（まちがい）'], a:[0] });
  addQ(s2.id, { qt:'tf', q:'問題2', c:['○（正しい）', '×（まちがい）'], a:[0] });
  var a = await W.syPack(W.syPayload());
  W.S.subs.reverse(); W.S.qs.reverse();
  /* 中のならびも変える（別の端末で読みこむと、ならびが変わることがある） */
  W.S.qs = W.S.qs.map(function(q){ var o = {}; Object.keys(q).reverse().forEach(function(k){ o[k] = q[k]; }); return o; });
  var b = await W.syPack(W.syPayload());
  eq(b.s, a.s, 'ならびがちがっても、同じ字になる');
});

test('同期：もらった中身がこちらと同じなら、保存も送りなおしもしない', async function(){
  var net = fakeNet();
  var s = W.subAdd('成人看護学');
  addQ(s.id, { qt:'tf', q:'同じ中身', c:['○（正しい）', '×（まちがい）'], a:[0] });
  W.saveNow();
  ok(await W.syStart(), 'つながった');
  await until(function(){ return net.docs[W.syDoc('idx')]; }, 4000, '置かれるのを待つ');
  /* ほかの端末が、同じ中身をちがうならびで置いた */
  var p = W.syPayload();
  p.qs = p.qs.slice().reverse(); p.subs = p.subs.slice().reverse();
  await putRemoteReal(net, p);
  await sleep(300);
  var sets = 0, orig = net.set;
  net.set = function(id, d){ sets++; return orig(id, d); };
  var mt = W.S.mt;
  await W.syPush();
  eq(sets, 0, '送りなおさない');
  eq(W.S.mt, mt, '保存もしない');
  net.set = orig;
  W.syStop();
});

test('同期：同じ時こくに直したものは、どちらの端末でも同じほうになる', async function(){
  var a = { id:'q1', mt:1000, q:'こちらの文' }, b = { id:'q1', mt:1000, q:'あちらの文' };
  var x = W.syMergeList([a], [b], {})[0], y = W.syMergeList([b], [a], {})[0];
  eq(x.q, y.q, 'どちらから見ても同じ');
});

test('同期：置き場がとちゅうでこわれていても、こちらの中身で置きなおす', async function(){
  var net = fakeNet();
  var s = W.subAdd('基礎看護学');
  addQ(s.id, { qt:'tf', q:'こわれても消えない', c:['○（正しい）', '×（まちがい）'], a:[0] });
  W.saveNow();
  /* 目次はあるのに、切れはしの印が合わない（書いているとちゅうで止まった） */
  await net.set(W.syDoc('p0'), { d:'xxxx', i:0, n:1, h:'bad', at:Date.now() });
  await net.set(W.syDoc('idx'), { v:1, h:'h-broken', hs:['good'], n:1, z:1, at:Date.now(), dev:'ipad', imgs:{} });
  W.SY.on = 1;
  ok(await W.syPush(), '送れた');
  var idx = net.docs[W.syDoc('idx')];
  ok(idx.h !== 'h-broken', '目次が新しくなった');
  var got = await W.syUnpack(net.docs[W.syDoc('p0')].d, idx.z);
  eq(got.qs.length, 1, 'こちらの中身で置きなおした');
  W.syStop();
});

test('同期：ほかの端末で直した設定も、端末にのこる', async function(){
  var net = fakeNet();
  ok(await W.syStart(), 'つながった');
  var p = emptyPayload();
  p.set = { goal:25 }; p.smt = Date.now() + 1000;
  await putRemote(net, p);
  await until(function(){ return W.toNum(W.S.set.goal) === 25; }, 4000, '設定が届くのを待つ');
  var saved = JSON.parse(W.localStorage.getItem(W.KEY));
  eq(W.toNum(saved.set.goal), 25, '端末にも保存された（開きなおしても、そのまま）');
  W.syStop();
});

test('バックアップ：書き出したファイルに、APIキーは入れない', async function(){
  W.S.set.key = 'AIza-SECRET-KEY-123';
  var got = null, orig = W.URL.createObjectURL, oclick = W.HTMLAnchorElement.prototype.click;
  W.URL.createObjectURL = function(b){ got = b; return 'blob:x'; };
  W.HTMLAnchorElement.prototype.click = function(){};      /* ほんとうには、ダウンロードしない */
  try{ W.setExport(); }finally{ W.URL.createObjectURL = orig; W.HTMLAnchorElement.prototype.click = oclick; }
  ok(got, '書き出した');
  var t = await got.text();
  ok(t.indexOf('AIza-SECRET-KEY-123') < 0, 'キーは入っていない');
  ok(t.indexOf('"qs"') >= 0, '中身は入っている');
  W.S.set.key = '';
});

test('同期：字を打っているあいだは、描き直さない（キーボードが引っこまない）', async function(){
  var net = fakeNet();
  var n = W.noteAdd({ body:'書いているメモ' });
  W.saveNow();
  await click('tab', 'note');
  await click('nt-open', n.id);
  ok(await W.syStart(), 'つながった');
  var el = W.document.getElementById('nt_body');
  el.focus();
  ok(W.isTyping(), '打っているところ');
  var p = emptyPayload();
  p.qs.push({ id:'q_typing', mt:Date.now(), sub:'', qt:'tf', q:'ほかの端末の問題', c:['○（正しい）', '×（まちがい）'], a:[0], lv:2 });
  await putRemote(net, p);
  await until(function(){ return W.qGet('q_typing'); }, 4000, '届くのを待つ');
  await frames();
  ok(W.document.getElementById('nt_body') === el, '入力らんは、そのまま（描き直していない）');
  ok(W.SY.renderWait, '打ちおわったら描き直す');
  el.blur();
  await until(function(){ return !W.SY.renderWait; }, 3000, '打ちおわったあと描き直すのを待つ');
  W.syStop();
});

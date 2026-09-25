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

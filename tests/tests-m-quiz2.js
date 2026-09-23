/* くらしの手帳：授業の問題の追加（AIなしの問題づくり・新しい種類・模擬テスト・にが手ノート）のテスト */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;

/* ===== にせAI（1問だけ作り直す・なぜまちがい） ===== */
KT.ai.push(function(req){
  if(req.tag === 'qz-remake'){
    return JSON.stringify({ type:'mc', q:'作り直した問題：成人の脈拍の基準値は？',
      choices:['40〜50回/分', '60〜100回/分', '110〜130回/分', '140〜160回/分'], ans:[2], exp:'60〜100回/分。' });
  }
  if(req.tag === 'qz-why') return 'AIの説明：似たことばと取りちがえやすいところです。';
  return null;
});

function appText(w){ return w.document.getElementById('app').textContent; }
function qzItemsOf(w, type){ return (w.S.kmItems || []).filter(function(x){ return x.mod === 'quiz' && x.type === type; }); }
function click(w, sel){
  var el = w.document.querySelector(sel);
  ok(el, '押すところがある：' + sel);
  el.click();
  return el;
}
/* テスト用の小さな zip（圧縮しない） */
function zipOf(entries){
  var enc = new TextEncoder(), out = [], central = [], off = 0;
  var u16 = function(v){ return [v & 255, (v >> 8) & 255]; };
  var u32 = function(v){ return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255]; };
  entries.forEach(function(e){
    var name = [].slice.call(enc.encode(e.name)), data = [].slice.call(enc.encode(e.text));
    var head = [0x50, 0x4b, 0x03, 0x04].concat(u16(20), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(data.length), u32(data.length), u16(name.length), u16(0), name);
    central.push([0x50, 0x4b, 0x01, 0x02].concat(u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), name));
    out = out.concat(head, data);
    off += head.length + data.length;
  });
  var cd = [];
  central.forEach(function(c){ cd = cd.concat(c); });
  return out.concat(cd, [0x50, 0x4b, 0x05, 0x06].concat(u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(cd.length), u32(off), u16(0)));
}
function slideXml(lines, bold){
  return '<?xml version="1.0"?><p:sld xmlns:a="x"><p:cSld><p:spTree>' +
    lines.map(function(t, i){
      var pr = (bold && i === 0) ? '<a:rPr b="1"/>' : '<a:rPr/>';
      return '<a:p><a:r>' + pr + '<a:t>' + t + '</a:t></a:r></a:p>';
    }).join('') + '</p:spTree></p:cSld></p:sld>';
}
/* 撮影日（EXIF）の入った、小さなJPEG */
function jpegWithDate(ymdhms){
  var enc = new TextEncoder();
  var tiff = [0x49, 0x49, 0x2A, 0x00, 8, 0, 0, 0,        /* II・42・IFD0は8から */
    1, 0,                                                 /* IFD0は1つ */
    0x69, 0x87, 4, 0, 1, 0, 0, 0, 26, 0, 0, 0,            /* 0x8769 ExifIFD → 26 */
    0, 0, 0, 0,                                           /* 次のIFDなし */
    1, 0,                                                 /* ExifIFDは1つ */
    0x03, 0x90, 2, 0, 20, 0, 0, 0, 44, 0, 0, 0,           /* 0x9003 撮影日時 → 44 */
    0, 0, 0, 0];
  var str = [].slice.call(enc.encode(ymdhms)).concat([0]);
  while(tiff.length < 44) tiff.push(0);
  var payload = [].slice.call(enc.encode('Exif')).concat([0, 0], tiff, str);
  var len = payload.length + 2;
  return [0xFF, 0xD8, 0xFF, 0xE1, (len >> 8) & 255, len & 255].concat(payload, [0xFF, 0xD9]);
}

KT.test('授業の問題＋：組みこみの表から、AIを使わずに問題を作る（基準値・略語・薬・手順・計算）', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  KT.freshWrites([A, B]);
  var before = KT.aiCalls.length;
  var kinds = {};
  A.QZ2_KITS.forEach(function(k){
    var items = k.make(5, { cat:'', calcIds:[] });
    ok(items.length >= 3, k.id + ' が作れる（' + items.length + '問）');
    items.forEach(function(x){
      ok(A.qzQOk(Object.assign({}, x)), k.id + ' の問題がこわれていない：' + x.q);
      ok(x.src, k.id + ' に出典がある');
      kinds[x.qt] = 1;
    });
  });
  ok(kinds.mc && kinds.cloze && kinds.order && kinds.match && kinds.calc, '5つの答え方が作れる：' + Object.keys(kinds).join(','));
  eq(KT.aiCalls.length, before, 'AI（API）を1回も使わない');
  /* 計算の答えが、式と合っている */
  var calc = A.qz2MakeCalc(30, []);
  calc.forEach(function(x){
    var v = Number(x.at);
    ok(isFinite(v) && v > 0, '計算の答えが数になっている：' + x.q + ' → ' + x.at);
    ok(x.how && x.how.length > 10, '計算のしかたが書いてある');
  });
  /* 点滴の滴下数は、総量×20÷分 */
  var drip = A.QZ2_CALC.filter(function(t){ return t.id === 'drip20'; })[0].make();
  var m = drip.q.match(/(\d+)mLの輸液を(\d+)時間/);
  eq(Number(drip.at), Math.round(Number(m[1]) * 20 / (Number(m[2]) * 60)), '滴下数の式が合っている');
  /* 科目に入れる（資料は作らない） */
  var sub = A.qzSubAdd('基礎看護学');
  A.qzState.sub = sub.id;
  A.appId = 'study'; A.studyTool = 'qz-kit'; A.qz2State.kit = 'lab'; A.qz2State.n = 5; A.render();
  click(A, '[data-act="qz2-make"]');
  ok(A.qzState.pv && A.qzState.pv.nomat, '見てから入れる画面が出る（資料は作らない）');
  var n0 = A.qzQs(sub.id).length, mat0 = qzItemsOf(A, 'mat').length;
  click(A, '[data-act="qz-pv-add"]');
  await KT.until(function(){ return !A.qzState.pv; }, 5000, '入れおわる');
  ok(A.qzQs(sub.id).length > n0, '科目に入る');
  eq(qzItemsOf(A, 'mat').length, mat0, '資料はふえない（表から作ったので）');
  await KT.settle([A, B]);
  eq(B.qzQs(sub.id).length, A.qzQs(sub.id).length, 'もう1台にも届く');
});

KT.test('授業の問題＋：並べかえ・組み合わせ・計算を解く（正解とまちがいの両方）', async function(){
  var A = KT.frames().A;
  var sub = A.qzSubs().filter(function(s){ return s.name === '基礎看護学'; })[0];
  A.qzAddQs(A.qz2MakeSkillOrder(1, {}).concat(A.qz2MakeMatch(1, {}), A.qz2MakeCalc(1, ['drip20'])), sub.id, '', 'test');
  A.commit();
  var ids = A.qzQs(sub.id).filter(function(x){ return x.qt === 'order' || x.qt === 'match' || x.qt === 'calc'; })
    .sort(function(a, b){ return ['order', 'match', 'calc'].indexOf(a.qt) - ['order', 'match', 'calc'].indexOf(b.qt); })
    .map(function(x){ return x.id; });
  eq(ids.length, 3, '3つの種類が入っている');
  A.appId = 'study'; A.studyTool = 'qz-drill';
  A.qzRunSet(ids, sub.id, 'all');
  /* 並べかえ：正しい順に押す */
  var q1 = A.qzCurQ();
  eq(q1.qt, 'order', '1問目は並べかえ');
  for(var i = 0; i < q1.c.length; i++) click(A, '[data-act="qz-ord-pick"][data-i="' + i + '"]');
  click(A, '[data-act="qz-check"]');
  eq(A.qzState.run.res, 1, '正しい順なら正かい');
  ok(/正かい/.test(appText(A)), '画面にも出る');
  click(A, '[data-act="qz-next"]');
  /* 組み合わせ：1つだけわざとまちがえる */
  var q2 = A.qzCurQ();
  eq(q2.qt, 'match', '2問目は組み合わせ');
  for(var li = 0; li < q2.pairs.length; li++){
    var r = (li === 0) ? (li + 1) % q2.pairs.length : li;
    click(A, '[data-act="qz-mat-pick"][data-l="' + li + '"][data-r="' + r + '"]');
  }
  click(A, '[data-act="qz-check"]');
  eq(A.qzState.run.res, 0, '1つちがえばまちがい');
  ok(/正しくは/.test(appText(A)), 'どれが正しいかを出す');
  click(A, '[data-act="qz-next"]');
  /* 計算：少しの誤差は正かい、大きくちがえばまちがい */
  var q3 = A.qzCurQ();
  eq(q3.qt, 'calc', '3問目は計算');
  ok(A.qzCalcOk(q3, q3.at), 'ぴったりなら正かい');
  ok(A.qzCalcOk(q3, String(Number(q3.at) + 0.4)), '少しの誤差は正かい');
  ok(!A.qzCalcOk(q3, String(Number(q3.at) * 2 + 10)), '大きくちがえばまちがい');
  A.document.getElementById('qz_ans').value = q3.at;
  click(A, '[data-act="qz-check"]');
  eq(A.qzState.run.res, 1, '計算も答え合わせできる');
  ok(/計算のしかた/.test(appText(A)), '式が出る');
  click(A, '[data-act="qz-next"]');
  ok(A.qzState.run.end, '3問でおわる');
  click(A, '[data-act="qz-quit"]');
});

KT.test('授業の問題＋：選択肢のシャッフル・とちゅうで中断して続きから', async function(){
  var A = KT.frames().A;
  var sub = A.qzSubs().filter(function(s){ return s.name === '基礎看護学'; })[0];
  var mc = A.qzQs(sub.id).filter(function(x){ return x.qt === 'mc'; })[0];
  ok(mc, '4択の問題がある');
  /* 出す順番は、ぜんぶの選択肢を1回ずつ使う（#60） */
  A.qzState.run = null;
  var seen = {};
  for(var i = 0; i < 12; i++){
    A.qzRunSet([mc.id], sub.id, 'all');
    var view = A.qzViewOrder(A.qzCurQ());
    eq(view.slice().sort().join(','), mc.c.map(function(c, k){ return k; }).join(','), '選択肢はぜんぶ1回ずつ出る');
    seen[view.join(',')] = 1;
  }
  ok(Object.keys(seen).length > 1, '毎回おなじ並びではない（' + Object.keys(seen).length + '通り）');
  /* 中断 → 続きから（#63） */
  var ids = A.qzQs(sub.id).slice(0, 4).map(function(x){ return x.id; });
  A.qzRunSet(ids, sub.id, 'all');
  var q = A.qzCurQ();
  if(A.qzKind(q) === 'choice') click(A, '[data-act="qz-pick-ch"][data-i="' + q.a[0] + '"]');
  else { A.qzState.run.typed = ''; A.qzMocAnswer ? 0 : 0; A.qzGrade(true); }
  click(A, '[data-act="qz-next"]');
  click(A, '[data-act="qz-quit"]');
  ok(!A.qzState.run, '中断した');
  ok(A.qzRunSaved(), '続きが残っている');
  A.studyTool = 'qz-drill'; A.render();
  ok(/続きから解く/.test(appText(A)), '「続きから解く」が出る');
  click(A, '[data-act="qz-resume"]');
  ok(A.qzState.run && A.qzState.run.i === 1, '2問目から続く');
  click(A, '[data-act="qz-quit"]');
  A.qzRunDrop();
  ok(!A.qzRunSaved(), 'やめると続きは消える');
});

KT.test('授業の問題＋：模擬テスト（点数・時間・前の回とくらべる）', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  KT.freshWrites([A, B]);
  var sub = A.qzSubs().filter(function(s){ return s.name === '基礎看護学'; })[0];
  A.qzAddQs(A.qz2MakeLabs(8, {}), sub.id, '', 'test');
  A.commit();
  A.appId = 'study'; A.studyTool = 'qz-moc';
  A.qz2State.mocSub = sub.id; A.qz2State.mocN = 20; A.qz2State.mocMin = 30;
  A.render();
  click(A, '[data-act="qz2-mocgo"]');
  ok(A.qzState.run && A.qzState.run.moc, '模擬テストが始まる');
  var total = A.qzState.run.ids.length;
  ok(total >= 5, '問題が出る（' + total + '問）');
  ok(/⏱/.test(appText(A)), 'のこり時間が出る');
  /* 1問目はわざとまちがえて、あとは正かい */
  var wrong = 0, guard = 0;
  while(A.qzState.run && !A.qzState.run.end && guard++ < 60){
    var q = A.qzCurQ(), kind = A.qzKind(q);
    if(kind === 'choice'){
      var k = (guard === 1) ? (q.a[0] === 0 ? 1 : 0) : q.a[0];
      if(guard === 1) wrong++;
      click(A, '[data-act="qz-pick-ch"][data-i="' + k + '"]');
      ok(!A.qzState.run.shown, '模擬テストでは、その場で答え合わせをしない');
    }else if(kind === 'calc'){
      A.document.getElementById('qz_ans').value = q.at;
      click(A, '[data-act="qz-check"]');
    }else if(kind === 'order'){
      for(var oi = 0; oi < q.c.length; oi++) click(A, '[data-act="qz-ord-pick"][data-i="' + oi + '"]');
      click(A, '[data-act="qz-check"]');
    }else if(kind === 'match'){
      for(var mi = 0; mi < q.pairs.length; mi++) click(A, '[data-act="qz-mat-pick"][data-l="' + mi + '"][data-r="' + mi + '"]');
      click(A, '[data-act="qz-check"]');
    }else{
      A.document.getElementById('qz_ans').value = q.at || '';
      click(A, '[data-act="qz-show"]');
    }
  }
  ok(A.qzState.run.end, 'おわりまで進む');
  A.render();
  ok(/模擬テストの結果/.test(appText(A)), '結果の画面が出る');
  var recs = qzItemsOf(A, 'moc');
  eq(recs.length, 1, '結果が1件だけ残る');
  eq(recs[0].n, total, 'といた数');
  eq(recs[0].ok, total - wrong, '正かいの数');
  ok(recs[0].sec >= 0 && recs[0].by, 'かかった時間と、科目ごとの内わけがある');
  click(A, '[data-act="qz-quit"]');
  /* 2回目 → 前の回とくらべる */
  A.studyTool = 'qz-moc'; A.render();
  ok(/これまでの結果/.test(appText(A)), 'これまでの結果が出る');
  click(A, '[data-act="qz2-mocgo"]');
  var guard2 = 0;
  while(A.qzState.run && !A.qzState.run.end && guard2++ < 60){
    var q2 = A.qzCurQ(), kind2 = A.qzKind(q2);
    if(kind2 === 'choice') click(A, '[data-act="qz-pick-ch"][data-i="' + q2.a[0] + '"]');
    else if(kind2 === 'calc'){ A.document.getElementById('qz_ans').value = q2.at; click(A, '[data-act="qz-check"]'); }
    else if(kind2 === 'order'){
      for(var oj = 0; oj < q2.c.length; oj++) click(A, '[data-act="qz-ord-pick"][data-i="' + oj + '"]');
      click(A, '[data-act="qz-check"]');
    }else if(kind2 === 'match'){
      for(var mj = 0; mj < q2.pairs.length; mj++) click(A, '[data-act="qz-mat-pick"][data-l="' + mj + '"][data-r="' + mj + '"]');
      click(A, '[data-act="qz-check"]');
    }else { A.document.getElementById('qz_ans').value = q2.at || ''; click(A, '[data-act="qz-show"]'); }
  }
  A.render();
  ok(/前の回（/.test(appText(A)), '前の回とくらべて出す');
  eq(qzItemsOf(A, 'moc').length, 2, '結果が2件');
  click(A, '[data-act="qz-quit"]');
  await KT.settle([A, B]);
  eq(qzItemsOf(B, 'moc').length, 2, '結果はもう1台にも届く');
});

KT.test('授業の問題＋：にが手ノートと「なぜまちがい？」（まず手帳の中でさがす）', async function(){
  var A = KT.frames().A;
  A.appId = 'study'; A.studyTool = 'qz-weak'; A.qz2State.weakSub = 'all'; A.render();
  var list = A.qz2WeakList('all');
  ok(list.length >= 1, 'まちがえた問題が集まる（' + list.length + '問）');
  ok(/にが手ノート/.test(appText(A)), 'にが手ノートが出る');
  ok(/まちがえ \d+回/.test(appText(A)), 'まちがえた回数が出る');
  /* 手帳の中の表で説明できるものは、AIを使わない（基準値の問題でためす） */
  var q = list.map(function(o){ return o.q; }).filter(function(x){ return /基準値/.test(x.q) || /基準値/.test(x.src || ''); })[0] || list[0].q;
  var before = KT.aiCalls.length;
  var why = A.qz2Why(q);
  ok(why, '手帳の中のことばで説明できる：' + String(why).slice(0, 40));
  eq(KT.aiCalls.length, before, 'AIは使わない');
  click(A, '[data-act="qz-why"][data-id="' + q.id + '"]');
  await KT.until(function(){ return A.qzWhyOf(q.id); }, 5000, '説明が入る');
  eq(A.qzWhyOf(q.id).from, 'local', '手帳の中で答えた印がつく');
  A.render();
  ok(/なぜ？/.test(appText(A)), 'にが手ノートに説明が出る');
  /* 手帳の中にないものは、AIに聞く */
  var mine = A.qzAddQs([{ qt:'cloze', q:'この授業だけのことばは（　）である。', at:'ぜんぜん出てこないことば', alt:[], exp:'', lv:1 }],
    A.qzSubs()[0].id, '', 'test');
  eq(mine, 1, '自分の問題を足す');
  var q2 = A.qzQs('').filter(function(x){ return /この授業だけのことば/.test(x.q); })[0];
  eq(A.qz2Why(q2), '', '手帳の中では見つからない');
  var n0 = KT.aiCalls.length;
  await A.qzWhy(q2.id);
  ok(KT.aiCalls.length > n0, '見つからないときだけAIに聞く');
  eq(A.qzWhyOf(q2.id).from, 'ai', 'AIが答えた印');
  await A.qzWhy(q2.id);
  eq(KT.aiCalls.length, n0 + 1, '2回目は、覚えてある答えを使う（APIを使わない）');
});

KT.test('授業の問題＋：写真の手入れ・撮影日・ZIP・二重取りこみ', async function(){
  var A = KT.frames().A;
  /* 写真をととのえる */
  var cv = A.document.createElement('canvas');
  cv.width = 300; cv.height = 150;
  var c = cv.getContext('2d');
  c.fillStyle = '#888'; c.fillRect(0, 0, 300, 150);
  c.fillStyle = '#666'; c.font = '18px sans-serif';
  for(var y = 24; y < 150; y += 24) c.fillText('看護 12〜20回/分', 8, y);
  var url = cv.toDataURL('image/jpeg', 0.9);
  var auto = await A.qz2ImgAuto(url);
  ok(auto.indexOf('data:image/jpeg') === 0 && auto.length > 100, '明るさ・コントラストをととのえられる');
  var two = await A.qz2ImgSplit(url);
  eq(two.length, 2, '見開きを2つに分けられる');
  var warped = await A.qz2ImgWarp(url, [[0.05, 0.05], [0.95, 0.02], [0.98, 0.98], [0.02, 0.95]]);
  ok(warped.indexOf('data:image/jpeg') === 0, '四すみを指してまっすぐにできる');
  var sharp = await A.qz2ImgSharp(url);
  var cv2 = A.document.createElement('canvas');
  cv2.width = 300; cv2.height = 150;
  var c2 = cv2.getContext('2d'); c2.filter = 'blur(4px)'; c2.drawImage(cv, 0, 0);
  var blur = await A.qz2ImgSharp(cv2.toDataURL('image/jpeg', 0.9));
  ok(blur < sharp, 'ぼけた写真は、くっきり度が小さい（' + blur + ' < ' + sharp + '）');
  /* 撮影日（EXIF） */
  var jpg = new A.File([new A.Uint8Array(jpegWithDate('2026:09:20 10:11:12'))], 'IMG_1234.jpg', { type:'image/jpeg' });
  eq(await A.qz2ExifDate(jpg), '2026-09-20', '写真から撮影日を読む');
  /* ZIP をまとめて取りこむ */
  var zip = new A.File([new A.Uint8Array(zipOf([
    { name:'第5回/資料.pptx', text:'dummy' },
    { name:'第5回/メモ.txt', text:'成人の呼吸数は12〜20回/分である。肺胞でガス交換をする。' },
    { name:'第5回/__MACOSX/._x', text:'x' }
  ]))], 'shiryou.zip', { type:'application/zip' });
  var got = await A.qzLoadFiles([zip]);
  ok(got.length >= 1, 'ZIPの中のファイルを取り出す（' + got.length + '）');
  ok(got.some(function(f){ return /メモ\.txt/.test(f.name) && /肺胞/.test(f.text); }), '中のテキストが読める');
  /* スライドの太字を取り出す（#36） */
  var pptx = new A.File([new A.Uint8Array(zipOf([
    { name:'ppt/slides/slide1.xml', text:slideXml(['ガス交換', '肺胞で酸素と二酸化炭素が入れかわる'], true) }
  ]))], '第7回.pptx');
  var doc = await A.qzDocText(pptx);
  ok(/ガス交換/.test(doc.text), 'スライドの字を読む');
  ok(doc.emph.indexOf('ガス交換') >= 0, '太字のことばを取り出す');
  /* 同じ資料を2回 */
  A.qzState.files = [];
  var f1 = { name:'同じ資料.txt', kind:'text', url:'', text:'まったく同じ中身の資料です。二重に取りこんだかどうかを見ます。' };
  A.qzPush(J(A, { id:A.uid('qzm'), mt:Date.now(), mod:'quiz', type:'mat', sub:'', title:'同じ資料', kind:'text',
    at:A.today(), sig:A.qzFileSig(f1), photos:[], text:f1.text, n:0 }));
  A.commit();
  var marked = A.qzDupMark([J(A, f1)]);
  ok(marked[0].dup && /もう取りこんでいます/.test(marked[0].dup), '2回目は知らせる');
});

KT.test('授業の問題＋：科目の色・学期・国試の分野・章（単元）・第◯回のまとまり', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  KT.freshWrites([A, B]);
  var s = A.qzSubAdd('母性看護学概論');
  eq(A.qz2FieldOf('母性看護学概論'), 'bosei', '科目名から国試の分野を決める');
  eq(s.field, 'bosei', '足したときに分野が入る');
  ok(s.color, '色が入る');
  eq(s.term, A.S.termId, 'いまの学期が入る');
  /* 章（単元）の見本 */
  var units = A.qz2UnitsFor('母性看護学概論').units;
  ok(units.indexOf('妊娠') >= 0, '章の見本が出る：' + units.slice(0, 3).join('／'));
  /* 章で問題をしぼる */
  A.qzAddQs([{ qt:'tf', q:'妊娠の週数は最終月経の初日から数える。', c:['○（正しい）', '×（まちがい）'], a:[0], at:'', alt:[], exp:'', lv:1, ch:'妊娠' },
             { qt:'tf', q:'分娩の第1期は子宮口が全開大するまでである。', c:['○（正しい）', '×（まちがい）'], a:[0], at:'', alt:[], exp:'', lv:1, ch:'分娩' }],
    s.id, '', 'test');
  A.commit();
  eq(A.qzUnitsOf(s.id).join(','), '分娩,妊娠', '章の一覧が出る');
  A.appId = 'study'; A.studyTool = 'qz-lib'; A.qzState.libTab = 'q'; A.qzState.sub = s.id; A.qzState.unit = '';
  A.render();
  click(A, '[data-act="qz-unit"][data-v="妊娠"]');
  eq(A.qzQFilter(s.id).length, 1, '章でしぼれる');
  click(A, '[data-act="qz-unit-drill"]');
  ok(A.qzState.run && A.qzState.run.ids.length === 1, 'その章だけ解ける');
  click(A, '[data-act="qz-quit"]');
  A.qzState.unit = '';
  /* 学期でしぼる */
  var other = A.qzSubAdd('去年の科目');
  other.term = 'no-such-term'; A.qzTouch(other); A.commit();
  ok(A.qzSubs().every(function(x){ return x.id !== other.id; }), 'ほかの学期の科目は出ない');
  A.qzCfgSet({ allTerms:1 }); A.commit();
  ok(A.qzSubs().some(function(x){ return x.id === other.id; }), '「ほかの学期も出す」で出る');
  A.qzCfgSet({ allTerms:0 }); A.commit();
  /* 資料を第◯回でまとめる */
  [1, 2].forEach(function(no){
    A.qzPush(J(A, { id:A.uid('qzm'), mt:Date.now() + no, mod:'quiz', type:'mat', sub:s.id, title:'資料' + no, kind:'text',
      at:A.today(), no:String(no), memo:no === 1 ? 'ここ出ると言っていた' : '', sig:'sig' + no, photos:[], text:'本文', n:0 }));
  });
  A.commit();
  A.appId = 'study'; A.studyTool = 'qz-lib'; A.qzState.libTab = 'mat'; A.qzState.sub = s.id; A.render();
  ok(/第1回/.test(appText(A)) && /第2回/.test(appText(A)), '回ごとにまとまって出る：' + appText(A).slice(0, 120));
  await KT.settle([A, B]);
  eq(B.qzSub(s.id).field, 'bosei', '分野・色・学期は、もう1台にも届く');
});

KT.test('授業の問題＋：AIの使用量をへらす（かぶり防止・おまかせの数・やめる・続き・1問だけ作り直す）', async function(){
  var A = KT.frames().A;
  var sub = A.qzSubs().filter(function(x){ return x.name === '基礎看護学'; })[0];
  A.appId = 'study'; A.studyTool = 'qz-make'; A.qzState.sub = sub.id; A.qzState.pv = null;
  A.qzState.files = [J(A, { name:'第9回.txt', kind:'text', url:'',
    text:'成人の呼吸数は12〜20回/分である。脈拍は60〜100回/分。体温は36〜37℃が目安。血圧は120/80mmHg未満が正常の目安。' })];
  A.qzState.mk = J(A, { n:10, auto:1, types:['mc', 'tf', 'cloze'], lv:2, style:'case', kokushi:1, en:1, two:1, both:1, anki:0, noai:0 });
  A.qzState.mat = J(A, { no:'9', memo:'血圧のところは必ず出ると言っていた', at:A.today() });
  A.render();
  /* 資料の量から、数を決める */
  ok(A.qzAutoN() >= 5, 'おまかせの数が出る：' + A.qzAutoN());
  /* AIに送る中身に、設定が入っている */
  var before = KT.aiCalls.length;
  click(A, '[data-act="qz-make"]');
  await KT.until(function(){ return A.qzState.pv; }, 5000, 'AIが作る');
  var req = KT.aiCalls[KT.aiCalls.length - 1];
  var sent = JSON.stringify(req.contents);
  ok(/事例問題/.test(sent), '事例問題の指示が入る（#33）');
  ok(/国家試験の言い回し/.test(sent), '国試ふうの指示（#35）');
  ok(/英語の用語/.test(sent), '英語の指示（#43）');
  ok(/2つ選べ/.test(sent), '「2つ選べ」の指示（#34）');
  ok(/半分を「基本」/.test(sent), 'やさしい＋むずかしい（#47）');
  ok(/血圧のところは必ず出る/.test(sent), '先生のメモを大事にする（#37）');
  ok(/かぶらないように/.test(sent), '前の問題とかぶらない（#38）');
  eq(KT.aiCalls.length, before + 1, 'AIを呼ぶのは1回だけ');
  /* 1問だけ作り直す（#44） */
  var q0 = A.qzState.pv.items[0].q;
  A.render();
  click(A, '[data-act="qz-pv-remake"][data-i="0"]');
  await KT.until(function(){ return A.qzState.pv.items[0].q !== q0; }, 5000, '1問だけ作り直す');
  ok(/作り直した問題/.test(A.qzState.pv.items[0].q), '新しい問題に入れかわる');
  /* 暗記カードも同時に作る（#48。AIは呼ばない） */
  var cards0 = (A.S.cards || []).length, ai0 = KT.aiCalls.length;
  A.qzState.mk.anki = 1;
  click(A, '[data-act="qz-pv-add"]');
  await KT.until(function(){ return !A.qzState.pv; }, 5000, '入れおわる');
  ok((A.S.cards || []).length > cards0, '暗記カードもできる');
  eq(KT.aiCalls.length, ai0, '暗記カードではAIを呼ばない');
  var mat = qzItemsOf(A, 'mat').sort(function(a, b){ return b.mt - a.mt; })[0];
  eq(mat.no, '9', '資料に「第9回」が入る');
  ok(/血圧のところ/.test(mat.memo), '資料にメモが入る');
  /* 通信が切れたとき（#46）… 続きを覚えておく */
  A.qzPendSet({ text:'あとでやり直す資料の中身', title:'第10回', sub:sub.id, opt:{ n:5, types:['mc'], lv:2 } });
  ok(A.qzPendOf(), '作れなかった分を覚えている');
  A.studyTool = 'qz-make'; A.qzState.files = []; A.render();
  ok(/もう一度ためす/.test(appText(A)), '「もう一度ためす」が出る');
  A.qzPendDrop();
  ok(!A.qzPendOf(), 'できたら消える');
});

KT.test('授業の問題＋：ショートカットから資料を受け取る・Discordに出す問題', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  KT.freshWrites([A, B]);
  var n0 = qzItemsOf(A, 'mat').length;
  var msg = A.kmInboxApply(J(A, { kind:'quiz', title:'第11回 呼吸のしくみ', text:'肺胞でガス交換をする。成人の呼吸数は12〜20回/分。' }), A.today(), 600);
  ok(/受け取りました/.test(msg), 'ショートカットから受け取る：' + msg);
  eq(qzItemsOf(A, 'mat').length, n0 + 1, '資料が1つふえる');
  var mat = qzItemsOf(A, 'mat').filter(function(m){ return /第11回/.test(m.title); })[0];
  ok(mat && /肺胞/.test(mat.text), '中身が入る');
  A.commit();
  /* Discordのボットに出す問題（まとめに入れる） */
  var sum = A.kmSummaryAdd({});
  ok(sum.quizAsk && sum.quizAsk.length >= 1, 'まとめに問題が入る（' + (sum.quizAsk || []).length + '問）');
  var one = sum.quizAsk[0];
  ok(one.q && one.choices.length >= 2 && one.answer.length >= 1, '問題・選択肢・答えがそろっている');
  ok(JSON.stringify(sum.quizAsk).length < 6000, '大きくなりすぎない');
  await KT.settle([A, B]);
  ok(qzItemsOf(B, 'mat').some(function(m){ return /第11回/.test(m.title); }), 'もう1台にも届く');
});
})();

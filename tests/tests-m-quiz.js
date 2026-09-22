/* くらしの手帳：授業の資料から問題を作って解く（科目・資料・出題）のテスト（KT.test で足す） */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;

/* ===== にせAI（資料から問題を作る） ===== */
KT.ai.push(function(req){
  if(req.tag !== 'qz-make') return null;
  return JSON.stringify({
    title:'第3回 呼吸のしくみ',
    summary:'肺のはたらきと、呼吸数の見かたのまとめ。',
    questions:[
      { type:'mc', q:'成人の呼吸数の正常値は？', choices:['6〜10回/分', '12〜20回/分', '24〜30回/分', '32〜40回/分'],
        ans:[2], exp:'12〜20回/分が目安。', tag:'バイタルサイン', lv:1 },
      { type:'tf', q:'安静にしている成人の呼吸は、ふつう1分間に30回である。', answer:'×', exp:'30回は多すぎる（頻呼吸）。', lv:2 },
      { type:'cloze', q:'肺でガス交換をする小さなふくろを（　）という。', answer:'肺胞', exp:'肺胞で酸素と二酸化炭素が入れかわる。', lv:1 },
      { type:'short', q:'SpO2は何を見ている検査？', answer:'動脈血の酸素飽和度', alt:['血液の中の酸素のわりあい'], exp:'指にはさんで測る。', lv:2 },
      { type:'mc', q:'選択肢が足りない問題', choices:['ひとつだけ'], ans:[1] },
      { type:'mc', q:'成人の呼吸数の正常値は？', choices:['あ', 'い', 'う', 'え'], ans:[1] }
    ]
  });
});

function appText(w){ return w.document.getElementById('app').textContent; }
function qzItemsOf(w, type){ return (w.S.kmItems || []).filter(function(x){ return x.mod === 'quiz' && x.type === type; }); }
function subByName(w, name){ return qzItemsOf(w, 'subject').filter(function(x){ return x.name === name; })[0]; }
function qByText(w, text){ return qzItemsOf(w, 'q').filter(function(x){ return x.q.indexOf(text) >= 0; })[0]; }
function openLib(w, tab){
  w.appId = 'study'; w.studyTool = 'qz-lib'; w.qzState.libTab = tab || 'sub';
  w.qzState.subEdit = ''; w.qzState.delAsk = ''; w.qzState.qEdit = '';
  w.render();
}
function click(w, sel){
  var el = w.document.querySelector(sel);
  ok(el, '押すところがある：' + sel);
  el.click();
  return el;
}
function setVal(w, id, v){
  var el = w.document.getElementById(id);
  ok(el, '入力するところがある：' + id);
  el.value = v;
  return el;
}
/* テスト用の小さな zip（中身はそのまま入れる＝圧縮しない） */
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
  var eocd = [0x50, 0x4b, 0x05, 0x06].concat(u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(cd.length), u32(off), u16(0));
  return out.concat(cd, eocd);
}
function slideXml(lines){
  return '<?xml version="1.0"?><p:sld xmlns:a="x"><p:cSld><p:spTree>' +
    lines.map(function(t){ return '<a:p><a:r><a:t>' + t + '</a:t></a:r></a:p>'; }).join('') +
    '</p:spTree></p:cSld></p:sld>';
}

KT.test('授業の問題：科目を足す・名前を変える・並べ替える・消す（2台で同じになる）', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  KT.freshWrites([A, B]);
  openLib(A, 'sub');
  ['解剖生理学', '基礎看護学', '心理学'].forEach(function(name){
    setVal(A, 'qz_newsub', name);
    click(A, '[data-act="qz-sub-add"]');
  });
  eq(qzItemsOf(A, 'subject').length, 3, '科目が3つできる');
  eq(A.qzSubs().map(function(s){ return s.name; }).join(','), '解剖生理学,基礎看護学,心理学', '足した順にならぶ');
  /* 同じ名前は増えない */
  setVal(A, 'qz_newsub', '心理学');
  click(A, '[data-act="qz-sub-add"]');
  eq(qzItemsOf(A, 'subject').length, 3, '同じ名前の科目は増えない');
  /* 並べ替え（心理学を上へ2回） */
  var sin = subByName(A, '心理学');
  click(A, '[data-act="qz-sub-mv"][data-id="' + sin.id + '"][data-d="-1"]');
  click(A, '[data-act="qz-sub-mv"][data-id="' + sin.id + '"][data-d="-1"]');
  eq(A.qzSubs().map(function(s){ return s.name; }).join(','), '心理学,解剖生理学,基礎看護学', '上へ動かせる');
  click(A, '[data-act="qz-sub-mv"][data-id="' + sin.id + '"][data-d="1"]');
  eq(A.qzSubs()[1].name, '心理学', '下へも動かせる');
  ok(!A.document.querySelector('[data-act="qz-sub-mv"][data-id="' + A.qzSubs()[0].id + '"][data-d="-1"]:not([disabled])'),
     'いちばん上は「↑」を押せない');
  /* 名前を変える */
  var kiso = subByName(A, '基礎看護学');
  click(A, '[data-act="qz-sub-edit"][data-id="' + kiso.id + '"]');
  setVal(A, 'qz_rn_' + kiso.id, '基礎看護技術');
  click(A, '[data-act="qz-sub-save"][data-id="' + kiso.id + '"]');
  eq(A.qzSubName(kiso.id), '基礎看護技術', '名前を変えられる');
  /* 同じ名前にはできない（直す枠は開いたまま） */
  setVal(A, 'qz_rn_' + kiso.id, '心理学');
  click(A, '[data-act="qz-sub-save"][data-id="' + kiso.id + '"]');
  eq(A.qzSubName(kiso.id), '基礎看護技術', 'ほかと同じ名前にはならない');
  /* しるしを変える */
  click(A, '[data-act="qz-sub-icon"][data-id="' + kiso.id + '"][data-v="🩺"]');
  eq(A.qzSub(kiso.id).icon, '🩺', 'しるしを変えられる');
  /* しまう → えらぶところに出ない（直す枠は開いたまま） */
  click(A, '[data-act="qz-sub-arch"][data-id="' + kiso.id + '"]');
  ok(A.qzSubs().every(function(s){ return s.id !== kiso.id; }), 'しまうと出てこない');
  click(A, '[data-act="qz-sub-arch"][data-id="' + kiso.id + '"]');
  ok(A.qzSubs().some(function(s){ return s.id === kiso.id; }), 'もどせる');
  await KT.settle([A, B]);
  eq(B.qzSubs().map(function(s){ return s.name; }).join(','), A.qzSubs().map(function(s){ return s.name; }).join(','),
     'もう1台でも、同じ名前と順番');
  /* 時間割から足す */
  var before = qzItemsOf(A, 'subject').length;
  openLib(A, 'sub');
  var imp = A.document.querySelector('[data-act="qz-sub-import"]');
  if(imp){
    imp.click();
    ok(qzItemsOf(A, 'subject').length >= before, '時間割の科目から足せる');
  }
  await KT.settle([A, B]);
  eq(qzItemsOf(B, 'subject').length, qzItemsOf(A, 'subject').length, '足した科目も、もう1台に届く');
});

KT.test('授業の問題：資料から問題を作って、えらんで入れる（科目に入る）', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  KT.freshWrites([A, B]);
  var sub = subByName(A, '解剖生理学');
  ok(sub, '前のテストで作った科目がある');
  A.appId = 'study'; A.studyTool = 'qz-make';
  A.qzState.sub = sub.id; A.qzState.pv = null; A.qzState.files = [];
  A.qzState.files.push(J(A, { name:'第3回 呼吸.txt', kind:'text', url:'', text:'肺は左右に1つずつある。肺胞でガス交換をする。成人の呼吸数は12〜20回/分。' }));
  A.qzState.mk = J(A, { n:10, types:['mc', 'tf', 'cloze', 'short'], lv:2 });
  A.render();
  ok(/第3回 呼吸\.txt/.test(appText(A)), 'えらんだ資料が画面に出る');
  click(A, '[data-act="qz-make"]');
  await KT.until(function(){ return A.qzState.pv; }, 5000, 'AIが問題を作る');
  var pv = A.qzState.pv;
  eq(pv.items.length, 4, 'だめな問題（選択肢が足りない・同じ問題文）は入らない');
  eq(pv.items.map(function(x){ return x.qt; }).join(','), 'mc,tf,cloze,short', '4つの種類がそろう');
  eq(pv.items[0].c[pv.items[0].a[0]], '12〜20回/分', '正解の番号を読みとる');
  eq(pv.items[1].a[0], 1, '○×の「×」を読みとる');
  eq(pv.items[2].at, '肺胞', '穴うめの答え');
  eq(pv.items[3].alt.length, 1, '記述の「別の言い方」');
  var sent = JSON.stringify(KT.aiCalls[KT.aiCalls.length - 1].contents);
  ok(/肺胞でガス交換/.test(sent), '資料の字をAIに送っている');
  /* 1つはずして入れる */
  A.render();
  click(A, '[data-act="qz-pv-toggle"][data-i="3"]');
  eq(A.qzState.pv.items[3].on, 0, 'チェックをはずせる');
  setVal(A, 'qz_pv_title', '第3回 呼吸のしくみ');
  click(A, '[data-act="qz-pv-add"]');
  await KT.until(function(){ return !A.qzState.pv; }, 5000, '問題を入れおわる');
  var qs = A.qzQs(sub.id);
  eq(qs.length, 3, 'チェックした3問だけ入る');
  ok(qs.every(function(x){ return x.sub === sub.id; }), 'えらんだ科目に入る');
  var mats = qzItemsOf(A, 'mat');
  eq(mats.length, 1, '資料が1つ残る');
  eq(mats[0].title, '第3回 呼吸のしくみ', '資料の名前');
  eq(mats[0].n, 3, '資料から作った問題の数');
  ok(/肺胞でガス交換/.test(mats[0].text), '資料の字も残る（もう一度作れる）');
  ok(/AIが資料から作成/.test(qs[0].src) || /資料：/.test(qs[0].src), '出典が入る');
  eq(A.qzState.files.length, 0, '入れたら、えらんだ資料はからになる');
  await KT.settle([A, B]);
  eq(B.qzQs(sub.id).length, 3, 'もう1台にも問題が届く');
  /* 同じ資料からもう一度作る */
  openLib(A, 'mat');
  A.qzState.sub = '';
  A.render();
  click(A, '[data-act="qz-mat-open"][data-id="' + mats[0].id + '"]');
  click(A, '[data-act="qz-mat-more"][data-id="' + mats[0].id + '"]');
  eq(A.studyTool, 'qz-make', '作る画面にうつる');
  eq(A.qzState.files.length, 1, '資料の字を、また使える');
  A.qzState.files = [];
});

KT.test('授業の問題：4択と○×をとく（正解で次の日がのび、まちがえると次の日に出る）', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  KT.freshWrites([A, B]);
  var sub = subByName(A, '解剖生理学'), td = A.today();
  A.appId = 'study'; A.studyTool = 'qz-drill';
  A.qzState.sub = sub.id; A.qzState.drillMode = 'new'; A.qzState.drillN = 10; A.qzState.run = null;
  A.render();
  ok(/はじめて/.test(appText(A)), '「はじめて」の問題がえらべる');
  click(A, '[data-act="qz-start"]');
  ok(A.qzState.run && A.qzState.run.ids.length === 3, '3問はじまる');
  /* 出る順はばらばらなので、テストでは 4択 → ○× → 穴うめ の順にそろえる */
  var byType = {};
  A.qzState.run.ids.forEach(function(qid){ byType[A.qzItem(qid).qt] = qid; });
  ok(byType.mc && byType.tf && byType.cloze, '3つの種類が出る');
  A.qzState.run.ids = [byType.mc, byType.tf, byType.cloze];
  A.qzState.run.i = 0;
  A.render();
  /* 1問目：正解 */
  var q1 = A.qzCurQ();
  click(A, '[data-act="qz-pick-ch"][data-i="' + q1.a[0] + '"]');
  eq(A.qzState.run.res, 1, '正かい');
  ok(/正かい/.test(appText(A)), '正かいと出る');
  var l1 = A.qzLogOf(q1.id);
  eq(l1.ok, 1, '正かいの記録');
  eq(l1.due, A.shiftDate(td, 1), 'はじめての正かいは、次の日にまた出る');
  click(A, '[data-act="qz-next"]');
  /* 2問目：わざとまちがえる */
  var q2 = A.qzCurQ();
  var bad = 0;
  q2.c.forEach(function(c, i){ if(q2.a.indexOf(i) < 0) bad = i; });
  click(A, '[data-act="qz-pick-ch"][data-i="' + bad + '"]');
  eq(A.qzState.run.res, 0, 'まちがい');
  var l2 = A.qzLogOf(q2.id);
  eq(l2.box, 0, 'まちがえたら、はじめにもどる');
  eq(l2.due, A.shiftDate(td, 1), 'まちがえたら次の日に出る');
  ok(A.qzState.run.wrong.indexOf(q2.id) >= 0, 'まちがえた問題を覚えている');
  click(A, '[data-act="qz-next"]');
  /* 3問目：穴うめ（自分で○×をつける） */
  var q3 = A.qzCurQ();
  eq(q3.qt, 'cloze', '穴うめの問題');
  setVal(A, 'qz_ans', '肺胞');
  click(A, '[data-act="qz-show"]');
  ok(/肺胞/.test(appText(A)), '正しい答えが出る');
  ok(A.qzTextMatch('はいほう', { at:'肺胞', alt:[] }) === false, 'ちがう字は、合っていると言わない');
  ok(A.qzTextMatch('肺胞', q3), '同じ字なら、合っていそうと出す');
  click(A, '[data-act="qz-grade"][data-v="1"]');
  ok(A.qzState.run.end, '3問でおわる');
  eq(A.qzState.run.n, 3, '3問といた');
  eq(A.qzState.run.ok, 2, '2問できた');
  ok(/おつかれさま/.test(appText(A)), 'おわりの画面');
  eq(A.qzDayCount(td).n, 3, '今日といた数');
  /* まちがえた問題だけ、もう一回 */
  click(A, '[data-act="qz-again-wrong"]');
  eq(A.qzState.run.ids.length, 1, 'まちがえた1問だけ出る');
  eq(A.qzState.run.ids[0], q2.id, 'まちがえた問題');
  var q2b = A.qzCurQ();
  click(A, '[data-act="qz-pick-ch"][data-i="' + q2b.a[0] + '"]');
  eq(A.qzLogOf(q2.id).res, 1, '今度は正かい');
  click(A, '[data-act="qz-next"]');
  click(A, '[data-act="qz-quit"]');
  ok(!A.qzState.run, 'やめると一覧にもどる');
  /* 星をつける → 星だけ出せる */
  openLib(A, 'q');
  A.qzState.sub = sub.id; A.render();
  click(A, '[data-act="qz-star"][data-id="' + q1.id + '"]');
  eq(A.qzItem(q1.id).star, 1, '星をつけられる');
  eq(A.qzPool(sub.id, 'star').length, 1, '星の問題だけえらべる');
  await KT.settle([A, B]);
  eq(B.qzLogOf(q1.id).due, A.qzLogOf(q1.id).due, '答えた記録も、もう1台に届く');
  eq(B.qzItem(q1.id).star, 1, '星も届く');
  eq(B.qzDayCount(td).n, A.qzDayCount(td).n, '今日といた数も届く');
});

KT.test('授業の問題：スライド（.pptx）の中の字を読む', async function(){
  var A = KT.frames().A;
  var bytes = zipOf([
    { name:'ppt/slides/slide2.xml', text:slideXml(['呼吸数の見かた', '成人は12〜20回/分']) },
    { name:'ppt/slides/slide1.xml', text:slideXml(['第3回 呼吸のしくみ', '肺胞でガス交換をする']) },
    { name:'ppt/notesSlides/notesSlide1.xml', text:slideXml(['テストに出ます']) },
    { name:'docProps/app.xml', text:'<Properties><Slides>2</Slides></Properties>' }
  ]);
  var file = new A.File([new A.Uint8Array(bytes)], '第3回.pptx');
  var text = await A.qzDocText(file);
  ok(/【スライド 1】/.test(text) && /【スライド 2】/.test(text), 'スライドごとに分ける');
  ok(text.indexOf('第3回 呼吸のしくみ') < text.indexOf('呼吸数の見かた'), 'スライドの順にならべる');
  ok(/【ノート 1】[\s\S]*テストに出ます/.test(text), '発表者ノートも読む');
  ok(!/Properties/.test(text), 'スライドでないファイルは読まない');
  /* えらんだ資料として読みこめる */
  var loaded = await A.qzLoadFiles([file]);
  eq(loaded.length, 1, '1つ読みこむ');
  eq(loaded[0].kind, 'slide', 'スライドとして読む');
  ok(/肺胞/.test(loaded[0].text), '中の字が入る');
  /* 読めないファイル */
  var ng = new A.File([new A.Uint8Array([1, 2, 3])], 'なぞ.xyz');
  var err = '';
  try{ await A.qzLoadFiles([ng]); }catch(e){ err = e.message; }
  ok(/読めません/.test(err), '読めないファイルは、わけを出す');
});

KT.test('授業の問題：自分で作る・直す・消す・点検・今日タブ・AIが読める', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  KT.freshWrites([A, B]);
  var sub = subByName(A, '心理学');
  /* 自分で4択を作る */
  openLib(A, 'hand');
  A.qzState.sub = sub.id; A.qzState.inp.qz_ht = 'mc'; A.render();
  setVal(A, 'qz_hq', '記憶のうち、数十秒でなくなるのは？');
  ['感覚記憶', '短期記憶', '長期記憶', '手続き記憶'].forEach(function(s, i){ setVal(A, 'qz_hc' + i, s); });
  A.document.getElementById('qz_hk1').checked = true;
  click(A, '[data-act="qz-h-add"]');
  var mine = qByText(A, '数十秒でなくなる');
  ok(mine, '自分の問題が入る');
  eq(mine.c[mine.a[0]], '短期記憶', '正解のチェックが入る');
  eq(mine.sub, sub.id, 'えらんだ科目に入る');
  /* 直す */
  openLib(A, 'q');
  A.qzState.sub = sub.id; A.render();
  click(A, '[data-act="qz-q-edit"][data-id="' + mine.id + '"]');
  setVal(A, 'qz_eq_' + mine.id, '記憶のうち、20秒ほどでなくなるのは？');
  setVal(A, 'qz_ee_' + mine.id, '短期記憶は15〜30秒ほど。');
  click(A, '[data-act="qz-q-save"][data-id="' + mine.id + '"]');
  eq(A.qzItem(mine.id).q, '記憶のうち、20秒ほどでなくなるのは？', '問題文を直せる');
  eq(A.qzItem(mine.id).exp, '短期記憶は15〜30秒ほど。', '解説も直せる');
  ok(/自分で直した/.test(A.qzItem(mine.id).src), '出典に「直した」が残る');
  /* 科目を変える（保存すると枠は閉じるので、もう一度開く） */
  var kai = subByName(A, '解剖生理学');
  click(A, '[data-act="qz-q-edit"][data-id="' + mine.id + '"]');
  click(A, '[data-act="qz-q-sub"][data-id="' + mine.id + '"][data-v="' + kai.id + '"]');
  eq(A.qzItem(mine.id).sub, kai.id, '問題の科目を変えられる');
  ok(A.qzQFilter(sub.id).every(function(x){ return x.id !== mine.id; }), '前の科目の一覧からは消える');
  A.qzState.sub = kai.id; A.render();
  click(A, '[data-act="qz-q-sub"][data-id="' + mine.id + '"][data-v="' + sub.id + '"]');
  eq(A.qzItem(mine.id).sub, sub.id, '科目をもどせる');
  A.qzState.sub = sub.id; A.render();
  /* こわれた問題は点検で見つける */
  A.S.kmItems.push(J(A, { id:'qzq_broken', mt:Date.now(), mod:'quiz', type:'q', sub:sub.id, mat:'', qt:'mc',
    q:'こわれた問題', c:['ひとつ'], a:[], at:'', alt:[], exp:'', src:'test', lv:2, tag:'', star:0 }));
  A.S.kmItems.push(J(A, { id:'qzq_lost', mt:Date.now(), mod:'quiz', type:'q', sub:'qzs_nai', mat:'', qt:'tf',
    q:'ない科目に入ったまま', c:['○', '×'], a:[0], at:'', alt:[], exp:'', src:'test', lv:2, tag:'', star:0 }));
  A.commit();
  var checks = [];
  A.KM.checks.forEach(function(fn){ checks = checks.concat(fn() || []); });
  var brk = checks.filter(function(c){ return /答えや選択肢が足りない/.test(c.msg); })[0];
  var lost = checks.filter(function(c){ return /もうない科目/.test(c.msg); })[0];
  ok(brk && lost, '点検で2つ見つかる');
  brk.fix(); lost.fix();
  ok(!A.qzItem('qzq_broken'), 'こわれた問題を消せる');
  eq(A.qzItem('qzq_lost').sub, '', 'ない科目からは外れる');
  /* 全体の検索 */
  var found = [];
  A.KM.search.forEach(function(fn){ found = found.concat(fn('肺胞') || []); });
  ok(found.some(function(r){ return r.kind === '授業の問題'; }), '問題が検索に出る');
  ok(found.some(function(r){ return r.kind === '授業の資料'; }), '資料も検索に出る');
  /* まとめ（ウィジェット・Discord） */
  var sum = A.kmSummaryAdd({});
  ok(sum.quiz && sum.quiz.total >= 4, 'まとめに問題の数が入る');
  /* AIが読める */
  var ai = A.KM.aiData.quiz_status.fn();
  ok(ai.questions >= 4 && typeof ai.correctRate === 'string', 'AIが数をよめる');
  var aiSubs = A.KM.aiData.quiz_subjects.fn();
  eq(aiSubs[0].subject, A.qzSubs()[0].name, 'AIが読む科目も、並べ替えた順');
  /* 今日タブ */
  A.S.ui.quiz = J(A, { today:1 });
  A.touch('ui'); A.commit();
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(/授業の問題/.test(appText(A)), '今日タブに出る');
  A.S.ui.pageHide = A.S.ui.pageHide || {};
  var todayBtn = A.document.querySelector('[data-act="qz-today-go"]');
  if(todayBtn){
    todayBtn.click();
    eq(A.studyTool, 'qz-drill', '今日タブから、すぐ解ける');
    A.qzState.run = null;
  }
  /* 問題を消す */
  openLib(A, 'q');
  A.qzState.sub = sub.id; A.render();
  click(A, '[data-act="qz-q-del"][data-id="' + mine.id + '"]');
  ok(!A.qzItem(mine.id), '問題を消せる');
  await KT.settle([A, B]);
  ok(!B.qzItem(mine.id), '消したことも、もう1台に届く');
});

KT.test('授業の問題：科目を消すとき、中の問題をのこす／いっしょに消すをえらべる', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  KT.freshWrites([A, B]);
  /* のこす */
  var keep = A.qzSubAdd('のこす科目');
  A.qzAddQs([{ qt:'tf', q:'のこす問題です。', c:['○（正しい）', '×（まちがい）'], a:[0], at:'', alt:[], exp:'', lv:1 }], keep.id, '', 'test');
  A.commit();
  openLib(A, 'sub');
  click(A, '[data-act="qz-sub-edit"][data-id="' + keep.id + '"]');
  click(A, '[data-act="qz-sub-delask"][data-id="' + keep.id + '"]');
  click(A, '[data-act="qz-sub-del"][data-id="' + keep.id + '"][data-w="0"]');
  ok(!A.qzSub(keep.id), '科目が消える');
  var left = qByText(A, 'のこす問題');
  ok(left && left.sub === '', '問題はのこり、科目なしになる');
  /* いっしょに消す */
  var all = A.qzSubAdd('まとめて消す科目');
  A.qzAddQs([{ qt:'tf', q:'いっしょに消える問題です。', c:['○（正しい）', '×（まちがい）'], a:[0], at:'', alt:[], exp:'', lv:1 }], all.id, '', 'test');
  A.commit();
  openLib(A, 'sub');
  click(A, '[data-act="qz-sub-edit"][data-id="' + all.id + '"]');
  click(A, '[data-act="qz-sub-delask"][data-id="' + all.id + '"]');
  click(A, '[data-act="qz-sub-del"][data-id="' + all.id + '"][data-w="1"]');
  ok(!A.qzSub(all.id), '科目が消える');
  ok(!qByText(A, 'いっしょに消える問題'), '中の問題もいっしょに消える');
  /* 消した問題は、同期でもどってこない */
  await KT.settle([A, B]);
  ok(!qByText(B, 'いっしょに消える問題'), 'もう1台でも消えている');
  ok(qByText(B, 'のこす問題'), 'のこした問題は、もう1台にもある');
  A.qzQs('').filter(function(x){ return /のこす問題/.test(x.q); }).forEach(function(x){ A.qzRemove(x); });
  A.commit();
  await KT.settle([A, B]);
});
})();

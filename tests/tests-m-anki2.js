/* くらしの手帳：暗記の追加（耳で暗記・ひっかけ・解説・Anki書き出し・テスト範囲） のテスト（KT.test で足す） */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;

/* ===== にせAI ===== */
KT.ai.push(function(req){
  if(req.tag === 'ak2-explain'){
    var txt = JSON.stringify(req.contents);
    return JSON.stringify({ explain:'テストの解説：呼吸は、からだに酸素を入れるはたらき。', tip:'「いちに の にじゅう」', goro:'',
      related:['25回/分以上は頻呼吸'], memo:/バイタルのまとめ/.test(txt) ? 1 : 0 });
  }
  if(req.tag === 'ak2-trap'){
    return JSON.stringify({ questions:[
      { type:'tf', q:'成人の呼吸数の正常値は20〜30回/分である。', answer:false, trap:'数値が入れかわっている', explain:'正しくは12〜20回/分。',
        card:{ q:'成人の呼吸数の正常値は？（ひっかけ注意）', a:'12〜20回/分（20〜30ではない）' } },
      { type:'mc', q:'副交感神経がはたらくと、どうなる？', choices:['心拍数がふえる', '瞳孔がひらく', '消化がすすむ', '血圧が上がる'], answer:2,
        trap:'交感神経と取りちがえやすい', explain:'副交感神経は「休む・食べる」のとき。', card:{ q:'副交感神経がはたらくと消化は？', a:'すすむ' } },
      { type:'mc', q:'だめな問題', choices:['a', 'b'], answer:7 }
    ] });
  }
  return null;
});

/* ===== にせの読み上げ（speechSynthesis のかわり） ===== */
function fakeTts(){
  var q = [], cur = null;
  var o = { log:[], cancels:0, speaking:false, pending:false };
  var pump = function(){
    if(cur || !q.length) return;
    cur = q.shift();
    setTimeout(function(){
      var u = cur; cur = null;
      if(!u.__dead && u.onend) u.onend({});
      pump();
    }, 3);
  };
  o.speak = function(u){ o.log.push({ text:u.text, lang:u.lang, voice:u.voice ? u.voice.name : '', rate:u.rate }); q.push(u); pump(); };
  o.cancel = function(){ o.cancels++; if(cur) cur.__dead = 1; q.forEach(function(u){ u.__dead = 1; }); q.length = 0; };
  o.getVoices = function(){ return [{ name:'Kyoko', lang:'ja-JP' }, { name:'Samantha', lang:'en-US' }, { name:'Daniel', lang:'en-GB' }]; };
  o.pause = function(){}; o.resume = function(){};
  return o;
}
function appText(w){ return w.document.getElementById('app').textContent; }

KT.test('暗記＋：テスト範囲から1日の量を出す・予備日・チェック・今日タブ・遅れたら引き直す・相手に届く', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  var td = A.today(), exDate = A.shiftDate(td, 8);
  A.S.exams.push(J(A, { id:'ex_ak2', subject:'解剖生理学', title:'中間', date:exDate, time:'', kind:'exam', room:'', memo:'', photos:[], mt:Date.now() }));
  A.commit();
  /* 勉強タブのテストの一覧 → 計画の画面 */
  A.appId = 'study'; A.studyTool = 'ak2-plan'; A.ak2State.plan = ''; A.render();
  var open = doc.querySelector('[data-act="ak2-plan-open"][data-id="ex_ak2"]');
  ok(open, 'テストの一覧に出る');
  open.click();
  eq(A.ak2State.plan, 'ex_ak2', '計画の画面を開く');
  doc.getElementById('ak2_it_name').value = '教科書 p.21〜80';
  doc.querySelector('[data-act="ak2-item-add"]').click();
  ok(A.S.examPlan.ex_ak2 && A.S.examPlan.ex_ak2.items.length === 1, '範囲が入る');
  eq(A.S.examPlan.ex_ak2.items[0].amount, 60, '「p.21〜80」から60ページ');
  eq(A.S.examPlan.ex_ak2.start, td, 'はじめる日は今日');
  doc.getElementById('ak2_it_name').value = 'プリント';
  doc.getElementById('ak2_it_amt').value = '6';
  doc.getElementById('ak2_it_unit').value = '枚';
  doc.querySelector('[data-act="ak2-item-add"]').click();
  eq(A.S.examPlan.ex_ak2.items.length, 2, '2つめの範囲');
  eq(A.S.examPlan.ex_ak2.items[1].unit, '枚', '単位');
  /* 予備日 */
  var restDay = A.shiftDate(td, 2);
  doc.querySelector('[data-act="ak2-rest"][data-d="' + restDay + '"]').click();
  ok(A.S.examPlan.ex_ak2.rest.indexOf(restDay) >= 0, '予備日を決められる');
  /* 計算：ぜんぶ割りふられる・予備日と前の日は0 */
  var ex = A.ak2Exam('ex_ak2');
  var c = A.ak2PlanCalc(ex, A.S.examPlan.ex_ak2), sch = A.ak2PlanSchedule(c);
  eq(sch.length, 8, 'テストの前の日まで8日');
  eq(sch.reduce(function(a, s){ return a + s.parts[0]; }, 0), 60, '60ページぜんぶ割りふる');
  eq(sch.reduce(function(a, s){ return a + s.parts[1]; }, 0), 6, 'プリントもぜんぶ');
  var rd = sch.filter(function(s){ return s.d === restDay; })[0];
  ok(rd && rd.rest && rd.parts[0] === 0 && rd.parts[1] === 0, '予備日には入れない');
  ok(sch[7].review && sch[7].parts[0] === 0, 'テストの前の日は見直しの日');
  ok(c.items[0].q > 0 && c.items[1].q > 0, '今日やる分がある');
  eq(sch[0].parts[0], c.items[0].q, '今日の分と1日ずつの予定が同じ');
  /* バイトの日は少なめ */
  var wd = A.shiftDate(td, 3);
  var w0 = A.ak2DayInfo(wd, A.S.examPlan.ex_ak2, ex).w;
  A.S.shifts.push(J(A, { id:'wk_ak2', title:'バイト', date:wd, start:'10:00', end:'18:00', realEnd:'', ot:0, rate:0, memo:'', photos:[], mt:Date.now() }));
  var w1 = A.ak2DayInfo(wd, A.S.examPlan.ex_ak2, ex);
  ok(w1.w < w0 && w1.why.indexOf('バイト') >= 0, 'バイトの日は少なめ');
  A.S.shifts = A.S.shifts.filter(function(s){ return s.id !== 'wk_ak2'; });
  /* 今日タブでチェック */
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  var it0 = A.S.examPlan.ex_ak2.items[0].id, q0 = c.items[0].q;
  var chk = doc.querySelector('[data-act="ak2-chk"][data-it="' + it0 + '"]');
  ok(chk, '今日タブに「今日やる分」とチェックが出る');
  chk.click();
  eq(A.S.examPlan.ex_ak2.items[0].done, q0, 'チェックで今日の分が終わる');
  eq(A.S.examPlan.ex_ak2.log[td], q0, 'その日の記録');
  eq(A.ak2PlanCalc(ex, A.S.examPlan.ex_ak2).items[0].q, q0, 'チェックしても今日の分は変わらない');
  doc.querySelector('[data-act="ak2-chk"][data-it="' + it0 + '"]').click();
  eq(A.S.examPlan.ex_ak2.items[0].done, 0, 'もう一度押すと取り消し');
  doc.querySelector('[data-act="ak2-chk"][data-it="' + it0 + '"]').click();
  eq(A.S.examPlan.ex_ak2.items[0].done, q0, 'また押すとできた');
  /* 遅れ → 引き直し */
  var pl = A.S.examPlan.ex_ak2;
  pl.start = A.shiftDate(td, -4); pl.mt = Date.now(); A.touch('examPlan'); A.commit();
  var c2 = A.ak2PlanCalc(ex, pl);
  eq(c2.status, 'late', '遅れを見つける');
  ok(c2.items[1].behind > 0, 'プリントが遅れている');
  A.appId = 'today'; A.render();
  ok(/遅れています/.test(appText(A)), '今日タブに遅れが出る');
  A.appId = 'study'; A.studyTool = 'ak2-plan'; A.ak2State.plan = 'ex_ak2'; A.render();
  doc.querySelector('[data-act="ak2-rest-use"]').click();
  eq(A.S.examPlan.ex_ak2.rest.indexOf(restDay), -1, '予備日を使う');
  doc.querySelector('[data-act="ak2-replan"]').click();
  eq(A.S.examPlan.ex_ak2.start, td, '今日から立て直す');
  ok(A.ak2PlanCalc(ex, A.S.examPlan.ex_ak2).status !== 'late', '遅れが消える');
  /* 今日やった量を記録 */
  var it1 = A.S.examPlan.ex_ak2.items[1].id;
  doc.getElementById('ak2_amt_' + it1).value = '1';
  doc.querySelector('[data-act="ak2-amt"][data-it="' + it1 + '"]').click();
  eq(A.S.examPlan.ex_ak2.items[1].done, 1, '一部だけの記録');
  /* 暗記カードの科目を範囲にする */
  A.ankiAddMany('ak2範囲デッキ', [{ q:'範囲の問1', a:'答1' }, { q:'範囲の問2', a:'答2' }, { q:'範囲の問3', a:'答3' }], 'hand');
  A.commit();
  A.appId = 'study'; A.studyTool = 'ak2-plan'; A.ak2State.plan = 'ex_ak2'; A.render();
  doc.getElementById('ak2_it_deck').value = 'ak2範囲デッキ';
  doc.querySelector('[data-act="ak2-item-add"]').click();
  var items = A.ak2PlanCalc(ex, A.S.examPlan.ex_ak2).items;
  eq(items.length, 3, 'カードの範囲');
  eq(items[2].deck, 'ak2範囲デッキ', '科目');
  eq(items[2].amount, 3, 'カードの枚数で数える');
  A.render();
  ok(doc.querySelector('[data-act="ak2-deck-go"][data-deck="ak2範囲デッキ"]'), '「暗記する」ボタン');
  /* AIが読める・全体の検索 */
  var sec = A.aiSectionData('exams', {});
  var qNow = A.ak2PlanCalc(ex, A.S.examPlan.ex_ak2).items[0].q;
  ok(Array.isArray(sec.ak2ExamToday) && sec.ak2ExamToday.some(function(x){ return x.examId === 'ex_ak2' && x.items.length === 3 && x.items[0].todayQuota === qNow; }), 'AIが「今日やる分」を読める');
  ok(sec.data.examPlan && sec.data.examPlan.items.ex_ak2, 'AIが計画そのものも読める');
  var hits = [];
  A.KM.search.forEach(function(fn){ hits = hits.concat(fn('プリント') || []); });
  ok(hits.some(function(h){ return h.kind === 'テスト範囲' && h.act === 'ak2-plan-open' && h.attrs['data-id'] === 'ex_ak2'; }), '全体の検索に出る');
  var sum = A.kmSummaryAdd({});
  ok(sum.ak2Exam && sum.ak2Exam.length, 'ウィジェット用のまとめ');
  /* 相手に届く */
  await KT.settle([A, B]);
  var bp = B.S.examPlan.ex_ak2;
  ok(bp && bp.items.length === 3, '計画が相手に届く');
  eq(bp.items[0].done, q0, '進みぐあいも届く');
  eq(B.ak2PlanCalc(B.ak2Exam('ex_ak2'), bp).items[0].q, qNow, '相手でも同じ「今日やる分」');
  /* 消す（2回押す） */
  A.appId = 'study'; A.studyTool = 'ak2-plan'; A.ak2State.plan = 'ex_ak2'; A.render();
  doc.querySelector('[data-act="ak2-plan-delask"]').click();
  doc.querySelector('[data-act="ak2-plan-del"]').click();
  eq(A.ak2Plan('ex_ak2'), null, '計画を消せる');
  await KT.settle([A, B]);
  eq(B.ak2Plan('ex_ak2'), null, '消したのも届く');
  A.removeItem('exams', 'ex_ak2');
  A.ak2State.plan = ''; A.studyTool = ''; A.appId = 'today';
  A.commit();
  await KT.settle([A, B]);
});

KT.test('暗記＋：まちがえたカードに解説（にせAI）・メモの出典・回数順の一覧・裏に出す・相手に届く', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  var now = Date.now();
  A.S.notes.push(J(A, { id:'nt_ak2', title:'バイタルのまとめ', body:'成人の呼吸数の正常値は12〜20回/分。25回/分以上は頻呼吸。', pinned:0, checks:[], photos:[], link:null, ct:now, mt:now }));
  A.S.notes.push(J(A, { id:'nt_ak2x', title:'実習記録', body:'受け持ちの患者さん。成人の呼吸数の正常値は12〜20回/分。', pinned:0, checks:[], photos:[], link:null, ct:now, mt:now }));
  A.ankiAddMany('ak2解説', [{ q:'成人の呼吸数の正常値は？', a:'12〜20回/分' }, { q:'心臓の弁の数は？', a:'4つ' }], 'hand');
  A.commit();
  var cardOf = function(w, q){ return w.S.cards.filter(function(c){ return c.deck === 'ak2解説' && c.q === q; })[0]; };
  var c1 = cardOf(A, '成人の呼吸数の正常値は？'), c2 = cardOf(A, '心臓の弁の数は？');
  /* 暗記する：1枚目を「もう一回」 */
  A.appId = 'anki'; A.ankiStart('ak2解説');
  eq(A.ankiState.cur, c1.id, '1枚目');
  doc.querySelector('[data-act="anki-show"]').click();
  ok(!doc.querySelector('[data-act="ak2-explain"]'), 'まちがえる前は解説ボタンを出さない');
  doc.querySelector('[data-act="anki-grade"][data-v="0"]').click();
  eq(cardOf(A, c1.q).miss, 1, 'まちがえた回数を数える');
  eq(cardOf(A, c1.q).missAt, A.today(), 'まちがえた日');
  doc.querySelector('[data-act="anki-show"]').click();
  ok(!doc.querySelector('[data-act="ak2-explain"]'), 'まちがえていないカードには出さない');
  doc.querySelector('[data-act="anki-grade"][data-v="2"]').click();
  eq(A.ankiState.cur, c1.id, 'まちがえたカードがもう一回');
  doc.querySelector('[data-act="anki-show"]').click();
  var why = doc.querySelector('[data-act="ak2-explain"]');
  ok(why, '「なぜ？解説」ボタン');
  why.click();
  await KT.until(function(){ var c = cardOf(A, c1.q); return c && c.explain; }, 5000, '解説ができる');
  var e1 = cardOf(A, c1.q);
  ok(/テストの解説/.test(e1.explain) && /覚え方：/.test(e1.explain) && /関係すること：/.test(e1.explain), '解説・覚え方・関係すること');
  eq(e1.explainSrc, 'メモ「バイタルのまとめ」', '手帳のメモを出典にする');
  eq(e1.explainNote, 'nt_ak2', '使ったメモ');
  var call = KT.aiCalls.filter(function(x){ return x.tag === 'ak2-explain'; }).pop();
  var sent = JSON.stringify(call.contents);
  ok(/12〜20回\/分/.test(sent) && /バイタルのまとめ/.test(sent), 'カードと関係するメモを渡す');
  ok(!/実習記録/.test(sent), '患者さんのことが書いてあるメモは送らない');
  ok(doc.querySelector('.ak2-exp') && /出典：メモ「バイタルのまとめ」/.test(appText(A)), 'カードの裏に解説と出典が出る');
  ok(/教科書・先生の資料で確かめて/.test(appText(A)), '確かめての注意書き');
  doc.querySelector('[data-act="anki-grade"][data-v="2"]').click();
  eq(A.ankiState.mode, 'done', 'おわり');
  ok(doc.querySelector('.ak2-done') && /わからなかったカード/.test(appText(A)), 'おわりの画面に、わからなかったカード');
  /* まちがえたカードの一覧（回数順） */
  var x2 = cardOf(A, c2.q);
  x2.miss = 3; x2.missAt = A.today(); x2.mt = Date.now(); A.commit();
  A.appId = 'study'; A.studyTool = 'ak2-wrong'; A.ak2State.wrongDeck = 'ak2解説'; A.render();
  var rows = doc.querySelectorAll('.ak2-wrow');
  ok(rows.length === 2 && rows[0].id === 'ak2w_' + c2.id, 'まちがえた回数の多い順');
  ok(/×3/.test(rows[0].textContent), '回数を出す');
  /* メモにないことは「一般的な知識」 */
  rows[0].querySelector('[data-act="ak2-explain"]').click();
  await KT.until(function(){ var c = cardOf(A, c2.q); return c && c.explain; }, 5000, '2枚目の解説');
  eq(cardOf(A, c2.q).explainSrc, '一般的な知識・教科書で確かめて', 'メモがないときの出典');
  /* 裏に出す・出さない */
  eq(A.ak2Ui().showExp, 1, 'はじめは裏に出す');
  doc.querySelector('[data-act="ak2-showexp"]').click();
  eq(A.S.ui.anki2.showExp, 0, '裏に出さない設定');
  ok(/ak2-expshow/.test(A.ak2StudyExtra(cardOf(A, c1.q))), '出さないときは「解説を見る」ボタン');
  doc.querySelector('[data-act="ak2-showexp"]').click();
  eq(A.S.ui.anki2.showExp, 1, 'もどす');
  /* AI・検索 */
  var sec = A.aiSectionData('study', {});
  ok(sec.ak2WrongCards && sec.ak2WrongCards[0] && sec.ak2WrongCards.some(function(x){ return x.id === c1.id && /テストの解説/.test(x.explain); }), 'AIが、まちがえたカードと解説を読める');
  var hits = [];
  A.KM.search.forEach(function(fn){ hits = hits.concat(fn('テストの解説') || []); });
  ok(hits.some(function(h){ return h.kind === '暗記の解説' && h.attrs['data-id'] === c1.id; }), '全体の検索で解説の中身が見つかる');
  /* 相手に届く */
  await KT.settle([A, B]);
  eq((cardOf(B, c1.q) || {}).explainSrc, 'メモ「バイタルのまとめ」', '解説が相手に届く');
  eq((cardOf(B, c1.q) || {}).miss, 1, 'まちがえた回数も届く');
  /* まちがえたカードだけで暗記する */
  A.appId = 'study'; A.studyTool = 'ak2-wrong'; A.render();
  doc.querySelector('[data-act="ak2-wrong-study"]').click();
  ok(A.appId === 'anki' && A.ankiState.mode === 'study', '暗記の画面になる');
  ok(/まちがえたカード/.test(appText(A)), '見出し');
  doc.querySelector('[data-act="anki-quit"]').click();
  /* 解説を消す */
  A.appId = 'study'; A.studyTool = 'ak2-wrong'; A.ak2State.wrongDeck = 'ak2解説'; A.render();
  doc.querySelector('[data-act="ak2-expdel"][data-id="' + c1.id + '"]').click();
  ok(!cardOf(A, c1.q).explain, '解説を消せる');
  await KT.settle([A, B]);
  ok(!(cardOf(B, c1.q) || {}).explain, '消したのも届く');
  A.ak2State.wrongDeck = ''; A.studyTool = ''; A.appId = 'today'; A.render();
});

KT.test('暗記＋：耳で暗記（にせの読み上げ）・英語は英語の声・一時停止・次へ・くり返し・おわる', async function(){
  var A = KT.frames().A, doc = A.document;
  var tts = window.__FAKE_TTS = fakeTts();
  try{
    A.ankiAddMany('ak2耳', [{ q:'Blood pressure の日本語は？', a:'血圧' }, { q:'SpO2の基準値は？', a:'96〜99%' }], 'hand');
    A.commit();
    eq(A.ak2Segs('Blood pressure の日本語は？', 1).map(function(s){ return (s.en ? 'E:' : 'J:') + s.t; }).join('|'), 'E:Blood pressure|J:の日本語は？', '英語と日本語に分ける');
    eq(A.ak2Segs('SpO2の基準値は？', 1).length, 1, '略語は日本語のまま');
    A.appId = 'study'; A.studyTool = 'ak2-ear'; A.render();
    ok(doc.getElementById('ak2_ear_vja') && doc.getElementById('ak2_ear_ven'), '日本語と英語の声を選べる');
    doc.getElementById('ak2_ear_src').value = 'deck:ak2耳';
    doc.getElementById('ak2_ear_wait').value = '1';
    doc.getElementById('ak2_ear_rate').value = '0.85';
    doc.getElementById('ak2_ear_loop').checked = true;
    doc.getElementById('ak2_ear_mix').checked = false;
    doc.getElementById('ak2_ear_en').checked = true;
    doc.getElementById('ak2_ear_ans').checked = true;
    doc.querySelector('[data-act="ak2-ear-start"]').click();
    ok(tts.log.length > 0, '押したその場で読みはじめる（iPhoneで動くように）');
    ok(tts.log.some(function(l){ return l.lang === 'en-US' && /Blood pressure/.test(l.text) && l.voice === 'Samantha'; }), '英語は英語の声');
    ok(tts.log.some(function(l){ return l.lang === 'ja-JP' && l.voice === 'Kyoko'; }), '日本語は日本語の声');
    eq(tts.log[0].rate, 0.85, '速さ');
    ok(doc.getElementById('ak2-ear-live') && doc.querySelector('.ak2-bigbtns [data-act="ak2-ear-pause"]'), '大きなボタンの画面');
    eq(A.S.ui.anki2.wait, 1, '待つ秒数をおぼえる');
    await KT.until(function(){ return tts.log.some(function(l){ return /血圧/.test(l.text); }); }, 5000, 'こたえを読む');
    ok(tts.log.some(function(l){ return /こたえ/.test(l.text); }), '「こたえ」と言う');
    await KT.until(function(){ return tts.log.some(function(l){ return /SpO2/.test(l.text); }); }, 5000, '2枚目');
    ok(tts.log.filter(function(l){ return /SpO2/.test(l.text); }).every(function(l){ return l.lang === 'ja-JP'; }), '略語は日本語の声');
    await KT.until(function(){ return A.ak2Ear.round >= 2; }, 5000, 'はじめからくり返す');
    /* 一時停止・つづける・次へ */
    doc.querySelector('[data-act="ak2-ear-pause"]').click();
    ok(A.ak2Ear.paused, '一時停止');
    var n0 = tts.log.length;
    await KT.sleep(200);
    eq(tts.log.length, n0, '止めているあいだは読まない');
    ok(doc.querySelector('[data-act="ak2-ear-resume"]'), '「つづける」ボタン');
    doc.querySelector('[data-act="ak2-ear-resume"]').click();
    ok(tts.log.length > n0, 'つづけると、すぐ読む');
    var i0 = A.ak2Ear.i;
    doc.querySelector('[data-act="ak2-ear-next"]').click();
    eq(A.ak2Ear.i, (i0 + 1) % 2, '次へ');
    doc.querySelector('[data-act="ak2-ear-stop"]').click();
    eq(A.ak2Ear.on, 0, 'おわる');
    var n1 = tts.log.length;
    await KT.sleep(150);
    eq(tts.log.length, n1, 'おわったら読まない');
    /* くり返しなし：最後まで行くとおわる */
    A.render();
    doc.getElementById('ak2_ear_src').value = 'deck:ak2耳';
    doc.getElementById('ak2_ear_loop').checked = false;
    doc.querySelector('[data-act="ak2-ear-start"]').click();
    await KT.until(function(){ return !A.ak2Ear.on; }, 5000, '最後まで行くとおわる');
    ok(/おわりです/.test(tts.log[tts.log.length - 1].text), '「おわりです」と言う');
    eq(A.S.ui.anki2.loop, 0, 'くり返しの設定');
    ok(doc.querySelector('[data-act="ak2-ear-start"]'), '設定の画面にもどる');
    /* まちがえたカードから聞く */
    A.render();
    ok(doc.querySelector('#ak2_ear_src option[value="wrong"]'), 'まちがえたカードから選べる');
  }finally{
    A.ak2EarClear(); A.ak2Ear.on = 0;
    delete window.__FAKE_TTS;
    A.studyTool = ''; A.appId = 'today'; A.render();
  }
});

KT.test('暗記＋：ひっかけ問題（にせAI）を解いて、なぜひっかけかを見て、選んだものだけカードに', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  A.ankiAddMany('ak2ひっかけ', [{ q:'成人の呼吸数の正常値は？', a:'12〜20回/分' }, { q:'副交感神経がはたらくと？', a:'消化がすすむ・心拍数がへる' }], 'hand');
  A.commit();
  A.appId = 'study'; A.studyTool = 'ak2-trap'; A.ak2State.trap = null; A.render();
  ok(/患者さんの情報が書いてあるメモは選ばないで/.test(appText(A)), 'AIに送る注意書き');
  doc.getElementById('ak2_trap_src').value = 'deck:ak2ひっかけ';
  var log0 = A.ankiCountOn(A.today());
  doc.querySelector('[data-act="ak2-trap-make"]').click();
  await KT.until(function(){ return A.ak2State.trap && !A.ak2State.trapBusy; }, 5000, '問題ができる');
  eq(A.ak2State.trap.qs.length, 2, 'だめな問題は入れない');
  var call = KT.aiCalls.filter(function(x){ return x.tag === 'ak2-trap'; }).pop();
  var sent = JSON.stringify(call.contents);
  ok(/12〜20回\/分/.test(sent), 'カードの中身を渡す');
  ok(/数値の入れかえ/.test(sent) && /似た言葉/.test(sent), 'まちがえやすいところをつくように頼む');
  ok(/患者さん/.test(sent), '個人の情報を入れないように頼む');
  /* 1問目：まちがえる */
  ok(doc.querySelector('.ak2-choices.tf'), '○×のボタン');
  doc.querySelector('[data-act="ak2-trap-pick"][data-v="1"]').click();
  ok(/ひっかかりました/.test(appText(A)) && /ひっかけポイント/.test(appText(A)) && /数値が入れかわっている/.test(appText(A)), 'なぜひっかけなのかが出る');
  ok(doc.querySelector('.ak2-choices .wrong') && doc.querySelector('.ak2-choices .right'), '正しいこたえに色');
  doc.querySelector('[data-act="ak2-trap-next"]').click();
  /* 2問目：正解 */
  eq(doc.querySelectorAll('[data-act="ak2-trap-pick"]').length, 4, '4つから選ぶ');
  doc.querySelector('[data-act="ak2-trap-pick"][data-v="2"]').click();
  ok(/正解/.test(appText(A)), '正解');
  eq(A.ankiCountOn(A.today()), log0 + 2, '解いた数も勉強した枚数に入る');
  doc.querySelector('[data-act="ak2-trap-next"]').click();
  /* 結果：選んだものだけカードに */
  ok(/2問中 1問 正解/.test(appText(A)), '結果');
  var boxes = doc.querySelectorAll('[data-act="ak2-trap-tog"]');
  ok(boxes.length === 2 && boxes[0].checked && !boxes[1].checked, 'まちがえた問題にはじめから印');
  var n0 = A.S.cards.length;
  doc.getElementById('ak2_trap_deck').value = 'ak2ひっかけ';
  doc.querySelector('[data-act="ak2-trap-add"]').click();
  eq(A.S.cards.length, n0 + 1, '選んだものだけカードになる');
  ok(A.S.cards.some(function(c){ return c.deck === 'ak2ひっかけ' && c.q === '成人の呼吸数の正常値は？（ひっかけ注意）'; }), 'AIが作ったカードの形');
  doc.querySelector('[data-act="ak2-trap-add"]').click();
  eq(A.S.cards.length, n0 + 1, '2回は足さない');
  await KT.settle([A, B]);
  ok(B.S.cards.some(function(c){ return c.q === '成人の呼吸数の正常値は？（ひっかけ注意）'; }), '相手に届く');
  doc.querySelector('[data-act="ak2-trap-reset"]').click();
  eq(A.ak2State.trap, null, '別の問題を作る画面へ');
  A.studyTool = ''; A.appId = 'today'; A.render();
});

KT.test('暗記＋：ひっかけ問題のAIの答えが少しおかしくても、正解の番号がずれない', async function(){
  var A = KT.frames().A;
  var r = A.ak2TrapClean({ questions:[
    { type:'mc', q:'空の選択肢がある', choices:['あ', '', 'う', 'え'], answer:2 },
    { type:'mc', q:'答えが文字', choices:['あ', 'い', 'う', 'え'], answer:'う' },
    { type:'mc', q:'答えが小数', choices:['あ', 'い', 'う', 'え'], answer:1.5 },
    { type:'mc', q:'答えが空の選択肢', choices:['あ', '', 'う', 'え'], answer:1 },
    { type:'tf', q:'○×', answer:'×' }
  ] }, 10);
  eq(r.length, 3, 'おかしい問題は入れない');
  eq(r[0].choices.join('/'), 'あ/う/え', '空の選択肢は使わない');
  eq(A.ak2TrapAnswerText(r[0]), 'う', '空の選択肢を捨てても正解がずれない');
  eq(A.ak2TrapAnswerText(r[1]), 'う', '答えを文字で返しても使える');
  eq(r[2].type + ':' + r[2].answer, 'tf:false', '○×');
});

KT.test('暗記＋：Ankiに書き出し（タブ区切り・ヘッダつき）・Ankiから取りこみ（見てから追加）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  A.ankiAddMany('ak2書き出し', [{ q:'タブ\tと"かこみ"', a:'1行目\n2行目' }, { q:'#ではじまる問い', a:'ふつう' }], 'hand');
  A.commit();
  A.appId = 'study'; A.studyTool = 'ak2-anki'; A.ak2State.imp = null; A.ak2LastFile = null; A.render();
  doc.getElementById('ak2_out_deck').value = 'ak2書き出し';
  doc.querySelector('[data-act="ak2-out-save"]').click();
  await KT.until(function(){ return A.ak2LastFile && /書き出しました/.test(appText(A)); }, 3000, 'ファイルを作る');
  var f = A.ak2LastFile;
  ok(/^#separator:tab\n/.test(f.text), '#separator:tab');
  ok(/\n#html:false\n/.test(f.text), '#html:false');
  ok(/\n#tags column:3\n/.test(f.text) && /\n#deck column:4\n/.test(f.text), 'タグとデッキの列');
  ok(/^kurashi-anki-ak2書き出し-\d{4}-\d{2}-\d{2}\.txt$/.test(f.name), 'ファイルの名前');
  ok(/\tくらしの手帳 ak2書き出し\t/.test(f.text), 'タグ（科目名）');
  eq(f.text.split('\n').filter(function(l){ return /^#/.test(l); }).length, 5, '#ではじまる問いは、かこむ（コメントにならない）');
  var back = A.ak2AnkiParse(f.text, f.name);
  eq(back.cards.length, 2, '書き出したものを読みもどせる');
  eq(back.cards[0].q, 'タブ と"かこみ"', 'タブとかぎかっこ');
  eq(back.cards[0].a, '1行目\n2行目', '改行');
  eq(back.cards[0].deck, 'ak2書き出し', 'デッキ');
  ok(/書き出しました/.test(appText(A)), '書き出したことを知らせる');
  /* Anki の書き出し（html・guid・ノートタイプ・デッキの列つき）を取りこむ */
  var src = '#separator:tab\n#html:true\n#guid column:1\n#notetype column:2\n#deck column:3\n#tags column:6\n' +
    'g1\tBasic\t看護::ak2取りこみ\t心臓の弁は<b>いくつ</b>？\t4つ<br>（三尖弁・肺動脈弁・僧帽弁・大動脈弁）\tanatomy\n' +
    'g2\tBasic\t看護::ak2取りこみ\t"呼吸数&amp;脈拍"\t"12〜20回/分\n60〜100回/分"\t\n' +
    'g3\tBasic\t看護::ak2取りこみ\t答えのない行\t\t\n';
  doc.getElementById('ak2_in_text').value = src;
  doc.querySelector('[data-act="ak2-in-text"]').click();
  var imp = A.ak2State.imp;
  ok(imp && imp.cards.length === 2, '答えのない行は入れない');
  eq(imp.cards[0].q, '心臓の弁はいくつ？', 'HTMLをはずす');
  eq(imp.cards[0].a, '4つ\n（三尖弁・肺動脈弁・僧帽弁・大動脈弁）', '<br> は改行に');
  eq(imp.cards[1].q, '呼吸数&脈拍', '&amp; をもどす');
  eq(imp.cards[1].a, '12〜20回/分\n60〜100回/分', 'かこみの中の改行');
  eq(imp.cards[0].deck, 'ak2取りこみ', 'デッキ名');
  ok(/取りこむカード（見てから追加）/.test(appText(A)), 'プレビュー');
  eq(A.S.cards.filter(function(c){ return c.deck === 'ak2取りこみ'; }).length, 0, '見るだけでは入らない');
  doc.querySelector('[data-act="ak2-in-tog"][data-i="1"]').click();
  eq(A.ak2State.imp.cards[1].on, 0, 'チェックをはずせる');
  doc.getElementById('ak2_in_deck').value = '__file__';
  doc.querySelector('[data-act="ak2-in-add"]').click();
  eq(A.S.cards.filter(function(c){ return c.deck === 'ak2取りこみ'; }).length, 1, 'チェックしたものだけ入る');
  eq(A.ak2State.imp, null, 'プレビューを閉じる');
  /* 同じものは足さない */
  doc.getElementById('ak2_in_text').value = src;
  doc.querySelector('[data-act="ak2-in-text"]').click();
  doc.getElementById('ak2_in_deck').value = '__file__';
  doc.querySelector('[data-act="ak2-in-add"]').click();
  eq(A.S.cards.filter(function(c){ return c.deck === 'ak2取りこみ'; }).length, 2, '同じカードは足さない');
  /* ヘッダのないカンマ区切り・セミコロン区切り */
  eq(A.ak2AnkiParse('りんご,apple\nみかん,orange\n').cards.length, 2, 'カンマ区切り');
  eq(A.ak2AnkiParse('#separator:Semicolon\na;b\n').cards[0].a, 'b', 'セミコロン区切り');
  await KT.settle([A, B]);
  eq(B.S.cards.filter(function(c){ return c.deck === 'ak2取りこみ'; }).length, 2, '取りこんだカードが相手に届く');
  A.studyTool = ''; A.appId = 'today'; A.render();
});

KT.test('暗記＋：暗記タブ・勉強タブから開ける・表示するだけでは中身が変わらない・データの点検', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  var td = A.today();
  A.S.exams.push(J(A, { id:'ex_ak2b', subject:'生化学', title:'', date:A.shiftDate(td, 3), time:'', kind:'quiz', room:'', memo:'', photos:[], mt:Date.now() }));
  A.S.examPlan.ex_ak2b = J(A, { items:[{ id:'ak2i_x', name:'第1章〜第3章', amount:3, unit:'章', done:0 }], start:td, rest:[], review:1, log:{}, mt:Date.now() });
  A.touch('examPlan');
  A.commit();
  await KT.settle([A, B]);
  var snap = function(){ var o = A.payloadCore(); delete o.notices; return A.canon(o) + '|' + A.canon(A.S.meta); };
  var before = snap();
  A.appId = 'anki'; A.ankiState.mode = ''; A.render();
  ok(doc.querySelector('[data-act="ak2-plan-open"][data-id="ex_ak2b"]'), '暗記タブにテストの計画');
  ['ak2-ear', 'ak2-trap', 'ak2-wrong', 'ak2-anki'].forEach(function(id){ ok(doc.querySelector('[data-act="ak2-go"][data-v="' + id + '"]'), '暗記タブから ' + id); });
  doc.querySelector('[data-act="ak2-go"][data-v="ak2-wrong"]').click();
  ok(A.appId === 'study' && A.studyTool === 'ak2-wrong', 'まちがえたカードを開ける');
  ['ak2-plan', 'ak2-ear', 'ak2-trap', 'ak2-wrong', 'ak2-anki'].forEach(function(id){
    A.studyTool = ''; A.render();
    ok(doc.querySelector('[data-act="study-open"][data-v="' + id + '"]'), '勉強タブに ' + id);
    A.studyTool = id; A.render();
    ok(!/表示できませんでした/.test(appText(A)), id + ' を表示できる');
  });
  A.studyTool = 'ak2-plan'; A.ak2State.plan = 'ex_ak2b'; A.render();
  ok(doc.querySelector('.ak2-sched'), '1日ずつの予定');
  ok(/見直しの日/.test(appText(A)), '見直しの日');
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(doc.querySelector('[data-act="ak2-chk"][data-it="ak2i_x"]'), '今日タブに出る');
  A.todayTab = 'tomo'; A.render();
  A.persist();
  eq(snap(), before, '表示しただけで中身が変わらない');
  /* テストを消したら、点検で知らせる */
  var checks = function(){ var o = []; A.KM.checks.forEach(function(fn){ o = o.concat(fn() || []); }); return o; };
  ok(!checks().some(function(c){ return /テスト範囲の計画/.test(c.msg); }), 'ふだんは知らせない');
  A.removeItem('exams', 'ex_ak2b');
  var hit = checks().filter(function(c){ return /テスト範囲の計画/.test(c.msg); });
  eq(hit.length, 1, 'テストが消えた計画を知らせる');
  hit[0].fix();
  eq(A.ak2Plan('ex_ak2b'), null, '直せる');
  A.commit();
  await KT.settle([A, B]);
  A.ak2State.plan = ''; A.studyTool = ''; A.appId = 'today'; A.todayTab = 'today'; A.render();
});
})();

/* くらしの手帳：授業・バイト・通学 のテスト（KT.test で足す） */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;

/* ===== にせAI ===== */
var sylReqs = [];
KT.ai.push(function(req){
  if(req.tag !== 'cp-syl') return null;
  sylReqs.push(req);
  return JSON.stringify({
    exam:null, report:null, attend:null, other:null, other_detail:'', notes:'',
    items:[{ name:'期末試験', pct:50, kind:'exam' }, { name:'小テスト', pct:20, kind:'quiz' }, { name:'レポート', pct:20, kind:'report' }, { name:'出席', pct:10, kind:'attend' }],
    teacher:'山田 花子',
    plan:[{ no:1, title:'オリエンテーション' }, { no:2, title:'データのまとめ方' }],
    books:[{ title:'看護のための統計テキスト', author:'佐藤', isbn:'978-4-00-000000-1', need:'必須' }, { title:'統計の参考書', author:'', isbn:'', need:'参考' }],
    tests:[{ title:'期末試験', kind:'exam', date:'2027-01-20', week:'' }]
  });
});
KT.ai.push(function(req){
  if(req.tag !== 'cp-uni') return null;
  var txt = JSON.stringify(req.contents);
  if(/アンケートのお願い/.test(txt)) return JSON.stringify({ items:[], forms:[{ url:'https://forms.gle/zzz999', title:'アンケート', due:'2026-10-10' }] });
  return JSON.stringify({
    items:[
      { type:'cancel', course:'臨床病態栄養学', date:'2026-10-06', period:1, title:'休講' },
      { type:'makeup', course:'臨床病態栄養学の', date:'2026-10-14', period:3, room:'N-301', title:'補講' },
      { type:'task', course:'医学英語', title:'レポート提出', due:'10/20', time:'17:00', note:'A4で2枚' },
      { type:'room', course:'看護応用統計学', date:'2026-10-09', room:'S-11', title:'教室変更' }
    ],
    forms:[{ url:'https://forms.gle/abcDEF123', title:'授業アンケート', due:'2026-10-20' }]
  });
});
KT.ai.push(function(req){
  if(req.tag !== 'cp-cal') return null;
  return JSON.stringify({ items:[
    { kind:'start', title:'後期授業開始', from:'2026-09-24', to:'2026-09-24' },
    { kind:'break', title:'冬季休業（テスト）', from:'2026-12-24', to:'2027-01-06' },
    { kind:'holclass', title:'祝日授業日', from:'2026-10-12', to:'2026-10-12' },
    { kind:'noclass', title:'大学祭の準備（休講）', from:'2026-10-30', to:'2026-10-30' },
    { kind:'exam', title:'後期定期試験（テスト）', from:'2027-01-25', to:'2027-02-05' },
    { kind:'event', title:'', from:'2026-11-01' }
  ] });
});
var shiftYm = '';
KT.ai.push(function(req){
  if(req.tag !== 'cp-shiftm') return null;
  var other = shiftYm.slice(0, 5) + (shiftYm.slice(5, 7) === '12' ? '11' : '12');
  return JSON.stringify({ shifts:[
    { date:shiftYm + '-05', start:'10:00', end:'15:00', note:'' },
    { date:shiftYm + '-06', start:'17', end:'22', note:'' },
    { date:shiftYm + '-07', start:'9:00', end:'13:00', note:'' },
    { date:other + '-01', start:'9:00', end:'13:00', note:'ほかの月' }
  ] });
});
/* ===== にせ橋わたし・にせAPI ===== */
var routeReqs = [];
KT.gas.push(function(req){
  if(req.action !== 'route') return null;
  if(req.token !== 'tok') return { ok:false, error:'合言葉がちがいます' };
  routeReqs.push(req);
  return { ok:true, dur:95, dep:'07:20', arr:'08:55', transfers:1, summary:'',
    legs:[{ mode:'walk', min:8 }, { mode:'transit', min:45, line:'特急', vehicle:'バス', from:'弥生が丘', to:'三宮', dep:'07:28', arr:'08:13' }] };
});
var overUrls = [];
KT.api.push(function(url){
  if(!/overpass-api\.de/.test(url)) return null;
  overUrls.push(url);
  return { elements:[
    { type:'node', lat:34.7200, lon:135.3612, tags:{ amenity:'pharmacy', name:'さくら薬局', opening_hours:'Mo-Fr 09:00-19:00', dispensing:'yes' } },
    { type:'way', center:{ lat:34.7190, lon:135.3607 }, tags:{ shop:'convenience', name:'ローソン' } },
    { type:'node', lat:34.7300, lon:135.3700, tags:{ amenity:'hospital', name:'テスト病院' } },
    { type:'node', lat:34.7195, lon:135.3609, tags:{ shop:'chemist', name:'ドラッグストアA' } },
    { type:'node', lat:34.7201, lon:135.3601, tags:{ shop:'bakery', name:'パン屋' } }
  ] };
});
KT.api.push(function(url){
  if(!/syllabus\.example\.ac\.jp/.test(url)) return null;
  return '<html><head><script>var x = 1;</script></head><body><h1>テスト用シラバス本文</h1><p>成績：期末50%</p></body></html>';
});

/* 書きこみすぎ防止の数えを、テストごとにはじめからにする */
function cpTest(name, fn){
  KT.test(name, async function(){
    var f = KT.frames();
    KT.freshWrites([f.A, f.B]);
    return fn();
  });
}
function gasOn(A){ A.GAS.url = 'https://script.google.com/macros/s/test/exec'; A.GAS.token = 'tok'; A.GAS.ver = 3; A.saveGas(); KT.gasState.ver = 3; }
function gasOff(A){ A.GAS.url = ''; A.GAS.token = ''; A.GAS.ver = 0; A.saveGas(); KT.gasState.ver = 2; }
function schoolDay(A){
  for(var i = 0; i < 21; i++){ var d = A.shiftDate(A.today(), i); if(A.schoolClassesForDate(d).length) return d; }
  return '';
}
async function shiftFile(A){
  var c = document.createElement('canvas'); c.width = 40; c.height = 30;
  var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 40, 30);
  var blob = await new Promise(function(r){ c.toBlob(r, 'image/jpeg'); });
  return new A.File([blob], 'shift.jpg', { type:'image/jpeg' });
}

/* ===================================================================== */
cpTest('授業＋：出席率のグラフ（授業タブ・授業の詳細・上限が近いと色で注意）', async function(){
  var A = KT.frames().A, doc = A.document, name = '医学英語';
  var save = A.S.attendLog[name];
  var at = A.attendOf(name), log = [];
  for(var i = 0; i < at.limit - 1; i++) log.push({ date:A.shiftDate(A.today(), -7 * (i + 1)), st:'欠' });
  log.push({ date:A.shiftDate(A.today(), -70), st:'出' }, { date:A.shiftDate(A.today(), -77), st:'遅' });
  A.S.attendLog[name] = J(A, log);
  A.courseView = ''; A.appId = 'course'; A.render();
  eq(doc.querySelectorAll('.cp-att').length, A.termCourses().length, '授業ごとに1本ずつ');
  var row = doc.querySelector('.cp-attnm[data-name="' + name + '"]').closest('.cp-att');
  ok(row.classList.contains('cp-ng'), 'あと1回で赤にする');
  eq(row.querySelectorAll('.cp-gauge i.on').length, at.limit - 1, '欠席の数だけ印');
  eq(row.querySelectorAll('.cp-gauge i').length, at.limit, '上限の数のます');
  ok(/あと1回/.test(row.textContent), 'あと1回の文');
  ok(parseFloat(row.querySelector('.cp-a').style.width) > 0 && parseFloat(row.querySelector('.cp-p').style.width) > 0, '出席と欠席の棒');
  var rows = [].slice.call(doc.querySelectorAll('.cp-att'));
  ok(rows.indexOf(row) <= rows.filter(function(r){ return r.classList.contains('cp-over') || r.classList.contains('cp-ng'); }).length - 1, '危ない順にならぶ');
  row.querySelector('.cp-attnm').click();
  eq(A.courseView, name, '名前を押すと授業の詳細');
  ok(doc.querySelector('.cp-att.big.cp-ng'), '授業の詳細にもグラフ');
  A.S.attendLog[name] = save || J(A, []); A.touch('attendLog');
  A.courseView = ''; A.appId = 'today'; A.commit();
});

cpTest('授業＋：GPAと単位（大学ごとのGPの付け方・卒業までの単位・相手に届く）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  var saveG = J(A, A.S.grades), saveUi = A.S.ui.campus ? J(A, A.S.ui.campus) : null;
  var cs = A.termCourses(), c0 = cs[0], c1 = cs[1], c2 = cs[2], c3 = cs[3];
  A.S.grades = J(A, {});
  A.S.grades[c0.name] = J(A, { grade:'秀', score:'' });
  A.S.grades[c1.name] = J(A, { grade:'A', score:'' });
  A.S.grades[c2.name] = J(A, { grade:'不可', score:'' });
  A.S.grades[c3.name] = J(A, { grade:'合格', score:'' });
  A.S.grades[cs[4].name] = J(A, { grade:'', score:'85' });
  A.touch('grades');
  var o = A.cpGpa();
  var sum = 4 * c0.cr + 3 * c1.cr + 0 * c2.cr + 3 * cs[4].cr, cr = c0.cr + c1.cr + c2.cr + cs[4].cr;
  eq(o.gpa, Math.round(sum / cr * 100) / 100, '通算GPA（秀4・A=優3・不可0・85点=優3、合格は入れない）');
  eq(o.earned.all, c0.cr + c1.cr + c3.cr + cs[4].cr, 'とった単位（不可はのぞく・合格は入れる）');
  eq(o.fail.length, 1, '単位にならなかった授業');
  ok(o.doing.all > 0, 'いま受けている単位');
  eq(A.cpGpOf('S').gp, 4, 'S は秀');
  eq(A.cpGpOf('だめ').key, null, '読めない書き方');
  A.courseView = ''; A.appId = 'course'; A.render();
  var box = [].slice.call(doc.querySelectorAll('#app section')).filter(function(s){ return /GPAと単位/.test(s.textContent); })[0];
  ok(box && box.textContent.indexOf(o.gpa.toFixed(2)) >= 0, 'GPAが出る');
  doc.getElementById('cp_gp').value = '秀=4.5, 優=3.5, 良=2.5, 可=1.5, 不可=0';
  doc.getElementById('cp_cut').value = '90,80,70,60';
  doc.getElementById('cp_g_total').value = '127';
  doc.getElementById('cp_g_req').value = '80';
  doc.querySelector('[data-act="cp-gpa-save"]').click();
  eq(A.S.ui.campus.gp['秀'], 4.5, 'GPの付け方を保存');
  o = A.cpGpa();
  eq(o.gpa, Math.round((4.5 * c0.cr + 3.5 * c1.cr + 3.5 * cs[4].cr) / cr * 100) / 100, '新しい付け方で計算');
  eq(o.need.total, 127, '卒業に必要な単位');
  eq(o.rest.total, 127 - o.earned.all, 'あと何単位');
  ok(/GPAの計算：秀=4.5/.test((A.courseView = c0.name, A.render(), doc.getElementById('app').textContent)), '授業の詳細の説明も変わる');
  await KT.settle([A, B]);
  eq(B.S.ui.campus && B.S.ui.campus.gp['秀'], 4.5, '相手に届く');
  eq(B.cpGpa().gpa, o.gpa, '相手でも同じGPA');
  /* 表（map）は消しても相手から戻るので、空の成績にしてもどす */
  A.S.grades = saveG;
  cs.slice(0, 5).forEach(function(c){ if(!A.S.grades[c.name]) A.S.grades[c.name] = J(A, { grade:'', score:'' }); });
  A.touch('grades');
  if(saveUi) A.S.ui.campus = saveUi; else delete A.S.ui.campus;
  A.touch('ui'); A.courseView = ''; A.commit();
  await KT.settle([A, B]);
});

cpTest('授業＋：成績の見込み（シラバスの割合＋自分の点 → 期末で何点とれば）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document, name = '臨床病態栄養学';
  var saveSy = A.S.syllabus[name], saveLog = A.S.attendLog[name];
  A.S.syllabus[name] = J(A, { url:'', exam:'60', rep:'30', att:'10', other:'', memo:'', mt:Date.now() });
  var log = [];
  for(var i = 0; i < 9; i++) log.push({ date:A.shiftDate(A.today(), -7 * (i + 1)), st:'出' });
  log.push({ date:A.shiftDate(A.today(), -70), st:'欠' });
  A.S.attendLog[name] = J(A, log);
  A.appId = 'course'; A.courseView = name; A.render();
  ok(doc.getElementById('cpsc_0') && doc.getElementById('cpsc_2'), '項目ごとの入力欄');
  eq(doc.getElementById('cpsc_2').placeholder, '90', '出席は記録から自動');
  doc.getElementById('cpsc_1').value = '80';
  doc.querySelector('[data-act="cp-score-save"]').click();
  eq(A.S.kmData['campus:score:' + name].v.rep, 80, '点を保存');
  var f = A.cpForecast(name);
  eq(f.cur, 82.5, 'いまの見込みの点（レポート80・出席90）');
  eq(f.grade, '優', 'いまの見込み');
  eq(f.target.name, 'テスト', '期末（テスト）で何点');
  eq(f.need.map(function(n){ return n.score; }).join(','), '95,79,62,45', '秀・優・良・可に必要な点');
  var sec = [].slice.call(doc.querySelectorAll('#app section')).filter(function(s){ return /成績の見込み/.test(s.textContent); })[0];
  ok(sec && /95点/.test(sec.textContent) && /優（82.5点）/.test(sec.textContent), '画面に出る');
  doc.getElementById('cpsc_0').value = '150';
  doc.querySelector('[data-act="cp-score-save"]').click();
  eq(A.S.kmData['campus:score:' + name].v.exam, undefined, '100をこえる点は入れない');
  doc.getElementById('cpsc_0').value = '70';
  doc.querySelector('[data-act="cp-score-save"]').click();
  f = A.cpForecast(name);
  ok(f.fixed && f.cur === 75 && f.grade === '良', 'ぜんぶの点がそろうと決まった点（70×60%＋80×30%＋90×10%＝75）');
  await KT.settle([A, B]);
  eq(B.S.kmData['campus:score:' + name].v.rep, 80, '相手に届く');
  if(saveSy) A.S.syllabus[name] = saveSy; else A.S.syllabus[name] = J(A, { url:'', exam:'', rep:'', att:'', other:'', memo:'', mt:Date.now() });
  A.touch('syllabus');
  A.S.attendLog[name] = saveLog || J(A, []);
  A.touch('attendLog'); A.courseView = ''; A.commit();
});

cpTest('授業＋：シラバスを写真・PDF・URLから読んで登録（授業計画・先生・教科書）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document, name = '看護応用統計学';
  A.appId = 'course'; A.courseView = name; A.render();
  ok(doc.querySelector('[data-act="cp-syl-files"]') && doc.querySelector('[data-act="cp-syl-url"]'), '写真・URLのボタン');
  await A.syllabusRead(name, { files:['data:image/jpeg;base64,/9j/AAAA'] });
  var r = A.sylAi.result;
  ok(r, '結果がない：' + A.sylAi.err);
  ok(sylReqs[sylReqs.length - 1].contents[0].parts.some(function(p){ return p.inline_data && p.inline_data.mime_type === 'image/jpeg'; }), '写真をAIに渡す');
  eq(r.plan.length, 2, '授業計画');
  eq(r.teacher, '山田 花子', '担当の先生');
  eq(r.exam + '/' + r.report + '/' + r.attend + '/' + r.other, '50/20/10/20', 'うちわけから割合を出す（小テストはそのほか）');
  eq(r.books[0].isbn, '9784000000001', 'ISBNは数字だけ');
  A.render();
  eq(doc.querySelectorAll('.syl-book').length, 2, '教科書を選べる');
  ok(doc.querySelector('.syl-book[data-i="0"]').checked && !doc.querySelector('.syl-book[data-i="1"]').checked, '参考書ははじめ外す');
  var nb0 = (A.S.books || []).length, ne0 = A.S.exams.length;
  A.syllabusApply(name);
  var sy = A.S.syllabus[name];
  eq(sy.teacher, '山田 花子', '先生を保存');
  eq(sy.plan.length, 2, '授業計画を保存');
  eq(sy.items.length, 4, '成績の付け方のうちわけを保存');
  eq(sy.exam, '50', 'テストの割合');
  eq(A.S.books.length, nb0 + 1, '教科書を1冊足す');
  var bk = A.S.books[A.S.books.length - 1];
  ok(bk.status === '買う予定' && bk.course === name && bk.id && bk.mt, '教科書の形');
  eq(A.S.exams.length, ne0 + 1, 'テストを予定に入れる');
  eq(A.cpEvalItems(name).length, 4, '成績の見込みにうちわけを使う');
  A.render();
  ok(/授業計画（2回）/.test(doc.getElementById('app').textContent), '授業計画が出る');
  /* URL から */
  doc.getElementById('sy_url').value = 'https://syllabus.example.ac.jp/s/1';
  doc.querySelector('[data-act="cp-syl-url"]').click();
  await KT.until(function(){ return A.sylAi.result && !A.sylAi.busy; }, 8000, 'URLから読む');
  var txt = JSON.stringify(sylReqs[sylReqs.length - 1].contents);
  ok(/テスト用シラバス本文/.test(txt) && !/var x = 1/.test(txt), 'ページの文字だけをAIに渡す');
  A.render();
  A.syllabusApply(name);
  eq(A.S.books.length, nb0 + 1, '同じ教科書は2回入れない');
  /* 手で保存しても、授業計画などは消えない */
  A.render();
  doc.querySelector('[data-act="syl-save"]').click();
  ok(A.S.syllabus[name].plan && A.S.syllabus[name].items, '割合が同じなら、うちわけも残る');
  A.render();
  doc.getElementById('sy_exam').value = '55';
  doc.querySelector('[data-act="syl-save"]').click();
  ok(A.S.syllabus[name].plan && !A.S.syllabus[name].items, '割合を手で変えたら、うちわけは使わない');
  await KT.settle([A, B]);
  eq((B.S.syllabus[name].plan || []).length, 2, '相手に届く');
  ok((B.S.books || []).some(function(b){ return b.id === bk.id; }), '教科書も相手に届く');
  A.courseView = ''; A.render();
});

cpTest('授業＋：大学のメールから休講・補講・課題・フォームを取りこむ', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  var n0 = A.S.holidays.length, t0 = A.S.tasks.length, e0 = A.S.events.length;
  var mail = { kind:'uni', id:'in_cp1', at:Date.now(), ref:'gm-cp-test1', title:'【休講・補講のお知らせ】臨床病態栄養学',
    text:'臨床病態栄養学は10/6の1限を休講にします。補講は10/14の3限、N-301です。\nアンケート https://forms.gle/abcDEF123', forms:['https://forms.gle/abcDEF123'] };
  var msg = A.inboxApply(J(A, mail));
  ok(/大学のメール/.test(msg), '知らせる文：' + msg);
  var it = A.cpItems('uni').filter(function(x){ return x.ref === 'gm-cp-test1'; })[0];
  ok(it && it.mod === 'campus' && it.id && it.mt, '候補の置き場に入る');
  await KT.until(function(){ var x = A.cpItem(it.id); return x && x.parsed === 1; }, 8000, 'AIが読む');
  it = A.cpItem(it.id);
  eq(it.cands.length, 5, '候補の数（フォーム1＋休講・補講・課題・教室変更）');
  var form = it.cands.filter(function(c){ return c.type === 'form'; })[0];
  ok(form.title === '授業アンケート' && form.due === '2026-10-20', 'フォームの締切をメールから');
  var mk = it.cands.filter(function(c){ return c.type === 'makeup'; })[0];
  eq(mk.course, '臨床病態栄養学', '授業名を時間割の名前に合わせる');
  ok(/^\d{4}-10-20$/.test(it.cands.filter(function(c){ return c.type === 'task'; })[0].due), '年のない締切に年をつける');
  eq(A.S.holidays.length, n0, '「入れる」を押すまで入らない');
  A.courseView = ''; A.appId = 'course'; A.render();
  ok(doc.querySelectorAll('.cp-cand').length >= 5, '候補が授業タブに出る');
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(/手帳に入れる候補/.test(doc.getElementById('app').textContent), '今日タブに知らせる');
  A.appId = 'course'; A.render();
  var cx = it.cands.filter(function(c){ return c.type === 'cancel'; })[0];
  doc.querySelector('[data-act="cp-uni-add"][data-id="' + it.id + '"][data-k="' + cx.k + '"]').click();
  eq(A.S.holidays.length, n0 + 1, '休講を入れる');
  ok(A.isCancelled('臨床病態栄養学', '2026-10-06'), '時間割でも休講');
  doc.querySelector('[data-act="cp-uni-all"][data-id="' + it.id + '"]').click();
  eq(A.S.holidays.length, n0 + 2, '補講も入る');
  var hx = A.S.holidays[A.S.holidays.length - 1];
  ok(hx.type === 'makeup' && hx.period === 3 && hx.room === 'N-301', '補講の時限と教室');
  eq(A.S.tasks.length, t0 + 2, '課題とフォームが入る');
  var ft = A.S.tasks.filter(function(t){ return t.url === 'https://forms.gle/abcDEF123'; })[0];
  ok(ft && ft.how === 'form' && ft.due === '2026-10-20' && /授業アンケート/.test(ft.title), 'フォームは url つきの「出すもの」');
  var tk = A.S.tasks.filter(function(t){ return /レポート提出/.test(t.title); })[0];
  ok(tk && tk.subject === '医学英語' && tk.time === '17:00', '課題の科目と時刻');
  eq(A.S.events.length, e0 + 1, '教室変更は予定に');
  eq(A.cpItem(it.id).st, 'done', 'ぜんぶ入れたら、しまう');
  ok(/もう受け取りずみ/.test(A.inboxApply(J(A, mail))), '同じメールは2回入れない');
  /* 本文を貼って読む */
  A.render();
  doc.getElementById('cp_uni_text').value = '件名：アンケートのお願い\n10/10までに https://forms.gle/zzz999 に答えてください';
  await A.cpUniPaste();
  var it2 = A.cpItems('uni').filter(function(x){ return /アンケートのお願い/.test(x.title); })[0];
  ok(it2 && it2.cands.length === 1 && it2.cands[0].url === 'https://forms.gle/zzz999' && it2.cands[0].due === '2026-10-10', '貼った本文からフォームと締切');
  /* フォームのURLを直接 */
  A.render();
  doc.getElementById('cp_form_url').value = 'https://docs.google.com/forms/d/e/cptest/viewform';
  doc.getElementById('cp_form_title').value = '実習の希望調査';
  doc.getElementById('cp_form_due').value = '2026-11-01';
  doc.querySelector('[data-act="cp-form-add"]').click();
  var ft2 = A.S.tasks.filter(function(t){ return /cptest/.test(t.url || ''); })[0];
  ok(ft2 && ft2.how === 'form' && ft2.due === '2026-11-01' && /実習の希望調査/.test(ft2.title), 'フォームを出すものに');
  /* 設定：大学のメールのドメイン → 橋わたしへ */
  gasOn(A);
  A.S.ui.setOpen = A.S.ui.setOpen || {}; A.S.ui.setOpen['cp-uni'] = 1;
  A.appId = 'set'; A.render();
  doc.getElementById('cp_uni_dom').value = 'someone@Example.ac.jp';
  doc.querySelector('[data-act="cp-uni-domain"]').click();
  eq(A.gfeat().uniDomain, 'example.ac.jp', 'ドメインを保存');
  await KT.until(function(){ return KT.gasState.feat && KT.gasState.feat.uniDomain === 'example.ac.jp'; }, 5000, '橋わたしに送る');
  gasOff(A);
  await KT.until(function(){ return B.S.tasks.some(function(t){ return t.id === ft.id; }); }, 15000, 'フォームが相手に届く');
  await KT.settle([A, B]);
  ok(B.S.holidays.some(function(h){ return h.id === hx.id; }), '補講が相手に届く');
  ok((B.S.kmItems || []).some(function(x){ return x.id === it.id && x.st === 'done'; }), 'メールの候補も相手に届く');
  eq(B.gfeat().uniDomain, 'example.ac.jp', 'ドメインも相手に届く');
  A.appId = 'today'; A.render();
});

cpTest('授業＋：学年暦を読んで、休み・予定・祝日の授業日に入れる', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  var b0 = (A.S.breaks || []).length, h0 = A.S.holidays.length, e0 = A.S.events.length;
  A.appId = 'tt'; A.render();
  ok(doc.querySelector('[data-act="cp-cal-files"]'), '時間割タブに学年暦の枠');
  await A.cpCalRead(['data:application/pdf;base64,JVBERi0x'], '');
  eq(A.cpCal.list.length, 5, '名前のないものは外す');
  eq(A.cpCal.list.map(function(x){ return x.to2; }).join(','), 'imp,holclass,off,break,imp', '入れる先を決める（日付の順）');
  A.render();
  eq(doc.querySelectorAll('.cp-cal-pick').length, 5, '選べる');
  doc.querySelector('.cp-cal-pick[data-i="0"]').checked = false;
  doc.querySelector('[data-act="cp-cal-apply"]').click();
  eq(A.S.breaks.length, b0 + 1, '休みに入る');
  eq(A.S.holidays.length, h0 + 2, '祝日の授業日・授業なしの日');
  eq(A.S.events.length, e0 + 1, '試験期間は予定に（授業開始はチェックを外した）');
  var ex = A.S.events.filter(function(e){ return e.title === '後期定期試験（テスト）'; })[0];
  ok(ex && ex.dateEnd === '2027-02-05' && ex.kind === 'imp', '何日も続く予定');
  ok(A.classesForDate('2026-12-25').every(function(c){ return c.off === 'holiday'; }), '休みの間は授業なし');
  ok(A.classesForDate('2026-10-30').every(function(c){ return c.off === 'cancel'; }), '授業なしの日');
  ok(A.classesForDate('2026-10-12').some(function(c){ return !c.off; }), '祝日でも授業');
  ok(!A.cpCal.list, 'しまう');
  await KT.settle([A, B]);
  ok(B.S.breaks.some(function(b){ return b.name === '冬季休業（テスト）'; }), '相手に届く');
  /* 後片付け */
  A.S.breaks.filter(function(b){ return b.name === '冬季休業（テスト）'; }).forEach(function(b){ A.removeItem('breaks', b.id); });
  A.S.holidays.filter(function(h){ return h.course === '*' && (h.date === '2026-10-12' || h.date === '2026-10-30'); }).forEach(function(h){ A.removeItem('holidays', h.id); });
  A.removeItem('events', ex.id);
  A.commit();
  await KT.settle([A, B]);
});

cpTest('通学＋：いまから間に合う？（時刻表で、着く時刻・何分前・おそくとも出る時刻）', async function(){
  var A = KT.frames().A, doc = A.document;
  var d = schoolDay(A);
  ok(d, '授業のある日');
  var cls = A.schoolClassesForDate(d), st = A.minutesOf(A.S.commute.periods[cls[0].period - 1]);
  var tg = A.cpNowTarget(d, st - 180);
  ok(tg && tg.dest === 'univ' && tg.start === st && tg.kind === 'class', '次の行き先は最初の授業');
  eq(A.cpNowTarget(d, 200), null, '夜中は出さない');
  var p = A.cpNowPlan(tg, 'home', st - 180, d);
  ok(p && p.src === 'timetable', '時刻表で計算');
  ok(p.diff >= 0 && p.arrive <= st, '3時間前に出れば間に合う');
  ok(p.legs.length === 2 && p.legs[0].kind === 'バス', 'バス→電車');
  ok(p.leaveBy != null && p.leaveBy >= st - 180, 'おそくとも出る時刻');
  var p2 = A.cpNowPlan(tg, 'home', p.leaveBy, d);
  ok(p2.diff >= 0, 'その時刻に出ても間に合う');
  var p3 = A.cpNowPlan(tg, 'home', st - 20, d);
  ok(p3 && p3.diff < 0, '20分前では間に合わない');
  var html = A.cpNowHtml(d, st - 20);
  ok(/間に合いません/.test(html) && /おくれ/.test(html) && /次の電車/.test(html), '間に合わないときの文');
  html = A.cpNowHtml(d, st - 180);
  ok(/いま出ると/.test(html) && /分前に着きます/.test(html) && /おそくとも/.test(html), '間に合うときの文');
  ok(/google\.com\/maps\/dir\/\?api=1&amp;destination=/.test(html) && /maps\.apple\.com/.test(html), '地図で行き方');
  ok(/いま出ると .* 着・/.test(A.cpNowText(A.cpNowInfo(d, st - 180))), 'まとめの短い文');
  A.cpNow.from = 'sannomiya';
  var info = A.cpNowInfo(d, st - 120);
  ok(info.from === 'sannomiya' && info.plan && info.plan.legs.length === 1, '三ノ宮から');
  A.cpNow.from = '';
  /* バイトの前 */
  var sid = 'wk_cp_now';
  A.S.shifts.push(J(A, { id:sid, title:'バイト', date:d, start:'19:00', end:'22:00', realEnd:'', ot:0, rate:0, memo:'', photos:[], mt:Date.now() }));
  var tw = A.cpNowTarget(d, 17 * 60);
  ok(tw && tw.kind === 'work' && tw.from === 'univ' && tw.dest === 'work', '授業のあとはバイトへ（学校から）');
  var pw = A.cpNowPlan(tw, 'univ', 17 * 60, d);
  ok(pw && pw.src === 'timetable' && pw.legs.length === 2, '学校→バイト先の時刻表');
  A.S.shifts = A.S.shifts.filter(function(x){ return x.id !== sid; });
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  var order = A.pageOrder('today');
  ok(order.indexOf('cp-now') >= 0 && order.indexOf('cp-now') < order.indexOf('transit'), '行き方の前に出す');
});

cpTest('通学＋：地図で行き方・Googleマップの経路（橋わたし）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  var u = A.cpMapUrl('武庫川女子大学 中央キャンパス', 'google');
  ok(u.indexOf('https://www.google.com/maps/dir/?api=1&destination=') === 0 && /travelmode=transit/.test(u) && u.indexOf(encodeURIComponent('武庫川')) > 0, 'Googleマップの行き方');
  ok(/^https:\/\/maps\.apple\.com\/\?daddr=.+&dirflg=r$/.test(A.cpMapUrl('三宮', 'apple')), 'Appleマップの行き方');
  /* 予定の詳細・バイト */
  var sid = 'wk_cp_map', eid = 'ev_cp_map', td2 = A.shiftDate(A.today(), 2);
  A.S.shifts.push(J(A, { id:sid, title:'バイト', date:td2, start:'17:00', end:'21:00', realEnd:'', ot:0, rate:0, memo:'', photos:[], mt:Date.now() }));
  A.S.events.push(J(A, { id:eid, date:td2, dateEnd:'', title:'健康診断', subject:'', time:'10:00', kind:'imp', memo:'場所：保健センター 2階', photos:[], mt:Date.now() }));
  A.render();
  A.openDetail('work', sid);
  var row = doc.querySelector('#detail .cp-maprow');
  ok(row && /イオンモール神戸北/.test(row.textContent) && row.querySelector('a[href*="google.com/maps/dir"]'), 'バイトの詳細に地図');
  A.closeDetail();
  A.openDetail('imp', eid);
  row = doc.querySelector('#detail .cp-maprow');
  ok(row && /保健センター 2階/.test(row.textContent), '予定に書いた場所へ');
  A.closeDetail();
  A.appId = 'money'; A.payTab = 'work'; A.render();
  ok([].slice.call(doc.querySelectorAll('#app section')).some(function(s){ return /バイト先への行き方/.test(s.textContent) && s.querySelector('.cp-maps a'); }), 'バイトのページにも');
  /* 橋わたしがないとき：地図のリンクだけ */
  A.S.ui.setOpen = A.S.ui.setOpen || {}; A.S.ui.setOpen['cp-place'] = 1;
  A.appId = 'set'; A.render();
  ok(!doc.querySelector('[data-act="cp-route-get"]'), '調べるボタンは出さない');
  ok(doc.querySelector('.cp-route .cp-maps a'), '地図を開くリンク');
  /* 行き先の名前 */
  doc.getElementById('cp_pl_school').value = '武庫川女子大学 中央キャンパス（テスト）';
  doc.querySelector('[data-act="cp-place-save"]').click();
  eq(A.cpPlaceQ('school'), '武庫川女子大学 中央キャンパス（テスト）', '行き先を保存');
  /* 橋わたしで経路を調べる */
  gasOn(A); A.render();
  doc.querySelector('[data-act="cp-route-get"][data-k="go"]').click();
  await KT.until(function(){ return A.cpData('route:go'); }, 5000, '経路を保存');
  var rq = routeReqs[routeReqs.length - 1];
  ok(rq.arriveAt > Date.now() && !rq.departAt && rq.mode === 'transit' && /（テスト）/.test(rq.to), '1限に着く時刻で調べる');
  var rr = A.cpData('route:go');
  ok(rr.dur === 95 && rr.transfers === 1 && rr.legs.length === 2, '通学の目安を保存');
  eq(A.cpRouteDur('home', 'univ').src, 'route', 'Googleマップの目安を使う');
  var rl = A.routeLegs;
  A.routeLegs = function(){ return null; };
  var p = A.cpNowPlan({ dest:'univ', start:540 }, 'home', 400, A.today());
  A.routeLegs = rl;
  ok(p && p.src === 'route' && p.arrive === 495 && p.diff === 45, '時刻表がないときは通学の目安で計算');
  gasOff(A);
  await KT.settle([A, B]);
  eq(B.S.kmData['campus:route:go'].dur, 95, '相手に届く');
  A.S.shifts = A.S.shifts.filter(function(x){ return x.id !== sid; });
  A.removeItem('events', eid);
  var pl = A.cpCfg().places; pl.school = ''; A.cpCfgSet({ places:pl });
  A.appId = 'today'; A.commit();
});

cpTest('通学＋：橋わたしの経路（Apps Script の Maps サービス）', async function(){
  var src = await fetch('../gas/Code.gs', { cache:'no-store' }).then(function(r){ return r.text(); });
  var calls = [], status = 'OK';
  var T0 = Date.UTC(2026, 8, 24, 0, 0) / 1000 - 5700;
  var finder = {
    o:{}, setOrigin:function(v){ this.o.from = v; return this; }, setDestination:function(v){ this.o.to = v; return this; },
    setMode:function(v){ this.o.mode = v; return this; }, setLanguage:function(v){ this.o.lang = v; return this; }, setRegion:function(v){ this.o.region = v; return this; },
    setArrive:function(d){ this.o.arrive = d; return this; }, setDepart:function(d){ this.o.depart = d; return this; },
    getDirections:function(){
      calls.push(this.o);
      if(status !== 'OK') return { status:status, routes:[] };
      return { status:'OK', routes:[{ summary:'', legs:[{ duration:{ value:5700 }, distance:{ value:48000 }, start_address:'兵庫県三田市', end_address:'武庫川女子大学',
        departure_time:{ value:T0 }, arrival_time:{ value:T0 + 5700 },
        steps:[
          { travel_mode:'WALKING', duration:{ value:480 } },
          { travel_mode:'TRANSIT', duration:{ value:2700 }, transit_details:{ line:{ short_name:'特急', vehicle:{ name:'バス' } }, departure_stop:{ name:'弥生が丘' }, arrival_stop:{ name:'三宮' },
            departure_time:{ value:T0 + 480 }, arrival_time:{ value:T0 + 3180 }, num_stops:10, headsign:'三宮' } },
          { travel_mode:'TRANSIT', duration:{ value:1800 }, transit_details:{ line:{ name:'阪神本線', vehicle:{ name:'電車' } }, departure_stop:{ name:'神戸三宮' }, arrival_stop:{ name:'鳴尾・武庫川女子大前' },
            departure_time:{ value:T0 + 3600 }, arrival_time:{ value:T0 + 5400 }, num_stops:12 } },
          { travel_mode:'WALKING', duration:{ value:300 } }
        ] }] }] };
    }
  };
  var env = {
    CalendarApp:{ EventColor:{}, Color:{} },
    Maps:{ DirectionFinder:{ Mode:{ TRANSIT:'transit', WALKING:'walking', DRIVING:'driving', BICYCLING:'bicycling' } }, newDirectionFinder:function(){ finder.o = {}; return finder; } },
    PropertiesService:{ getScriptProperties:function(){ return { getProperty:function(){ return null; } }; } },
    LockService:{ getScriptLock:function(){ return { waitLock:function(){}, releaseLock:function(){} }; } },
    ContentService:{ MimeType:{ JSON:'json' }, createTextOutput:function(s){ return { s:s, setMimeType:function(){ return this; } }; } },
    Utilities:{ formatDate:function(d){ var j = new Date(d.getTime() + 9 * 3600000); return ('0' + j.getUTCHours()).slice(-2) + ':' + ('0' + j.getUTCMinutes()).slice(-2); } }
  };
  var names = Object.keys(env);
  var run = new Function(names.join(','), src.replace("var TOKEN = 'ここに合言葉';", "var TOKEN = 'tok';") + '\nreturn { doPost:doPost };');
  var G = run.apply(null, names.map(function(n){ return env[n]; }));
  var post = function(req){ req.token = 'tok'; return JSON.parse(G.doPost({ postData:{ contents:JSON.stringify(req) } }).s); };
  var at = Date.UTC(2026, 8, 24, 0, 0);
  var r = post({ action:'route', from:'三田市弥生が丘', to:'武庫川女子大学', arriveAt:at, mode:'transit' });
  ok(r.ok, r.error);
  eq(r.dur, 95, 'かかる時間（分）');
  eq(r.transfers, 1, '乗りかえ');
  eq(r.dep + '→' + r.arr, '07:25→09:00', '出る時刻・着く時刻（日本時間）');
  eq(r.legs[1].line + '|' + r.legs[1].from + '|' + r.legs[1].dep, '特急|弥生が丘|07:33', '乗りものごと');
  eq(r.legs[0].mode, 'walk', '歩き');
  eq(calls[0].arrive.getTime(), at, '着く時刻で調べる');
  eq(calls[0].mode + calls[0].lang, 'transitja', '電車・バスで・日本語');
  post({ action:'route', from:'a', to:'b', departAt:String(at) });
  ok(calls[1].depart && calls[1].depart.getTime() === at && !calls[1].arrive, '出る時刻で調べる');
  eq(post({ action:'route', from:'', to:'x' }).ok, false, '出発地がないと断る');
  status = 'ZERO_RESULTS';
  var r2 = post({ action:'route', from:'a', to:'b' });
  ok(!r2.ok && /ZERO_RESULTS/.test(r2.error), '見つからないとき');
  eq(post({ action:'nothing' }).ok, false, 'ほかのお願いはそのまま');
});

cpTest('通学＋：近くの薬局・コンビニ（OpenStreetMap・近い順）', async function(){
  var A = KT.frames().A, doc = A.document;
  var list = await A.cpNearFind('school');
  ok(list, 'さがせない：' + A.cpNear.err);
  eq(list.length, 4, 'パン屋はのぞく');
  ok(list.every(function(x, i){ return !i || x.dist >= list[i - 1].dist; }), '近い順');
  var ph = list.filter(function(x){ return x.kind === 'pharmacy'; })[0];
  ok(ph.name === 'さくら薬局' && ph.rx && /09:00-19:00/.test(ph.hours), '薬局の名前・処方せん・開いている時間');
  ok(list.some(function(x){ return x.kind === 'convenience' && x.name === 'ローソン'; }), '建物（way）の真ん中の位置も使う');
  var q = decodeURIComponent(overUrls[overUrls.length - 1]);
  ok(/"amenity"="pharmacy"/.test(q) && /"shop"="convenience"/.test(q) && /around:\d+,34\.\d+,135\.\d+/.test(q), 'Overpassにたずねる形');
  A.appId = 'today'; A.todayTab = 'life'; A.render();
  eq(doc.querySelectorAll('.cp-near').length, 4, 'くらしタブに出る');
  doc.querySelector('[data-act="cp-near-cat"][data-v="convenience"]').click();
  eq(doc.querySelectorAll('.cp-near').length, 1, 'コンビニだけ');
  ok(/travelmode=walking/.test(doc.querySelector('.cp-near a.mini').getAttribute('href')), '歩いて行く地図');
  A.cpNear.cat = 'all'; A.todayTab = 'today'; A.render();
});

cpTest('バイト＋：シフト表を1か月ぶん読み、ちがうところを見せて入れる', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  shiftYm = A.addMonths(A.thisYm(), 1);
  var saveName = A.S.settings.shiftName;
  var mk = function(id, day, st, en){ return J(A, { id:id, title:'バイト', date:shiftYm + '-' + day, start:st, end:en, realEnd:'', ot:0, rate:0, memo:'', photos:[], mt:Date.now() }); };
  A.S.shifts = A.S.shifts.filter(function(w){ return String(w.date).slice(0, 7) !== shiftYm; });
  A.S.shifts.push(mk('wk_cpm6', '06', '17:00', '21:00'), mk('wk_cpm7', '07', '09:00', '13:00'), mk('wk_cpm20', '20', '10:00', '14:00'));
  A.appId = 'money'; A.payTab = 'work'; A.render();
  doc.querySelector('[data-act="cp-shift-month"][data-v="' + shiftYm + '"]').click();
  eq(A.shiftOcr.month, shiftYm, '1か月の表をえらぶ');
  var file = await shiftFile(A);
  A.S.settings.shiftName = '';
  await A.shiftOcrRun(file);
  ok(!A.shiftOcr.list && !A.shiftOcr.busy, '名前がないと読まない');
  A.S.settings.shiftName = '山田';
  await A.shiftOcrRun(file);
  eq(A.shiftOcr.list.length, 3, 'その月のシフトだけ');
  eq(A.shiftOcr.list[1].start + '-' + A.shiftOcr.list[1].end, '17:00-22:00', '「17」「22」を直す');
  A.render();
  eq(doc.querySelectorAll('.cp-so-new').length + '/' + doc.querySelectorAll('.cp-so-diff').length + '/' + doc.querySelectorAll('.cp-so-same').length, '1/1/1', '新しい・ちがう・同じ');
  ok(/いまの登録は 17:00〜21:00/.test(doc.querySelector('.cp-so-diff').textContent), 'ちがうところを見せる');
  ok(!doc.querySelector('.cp-so-same input').checked, '同じものはチェックしない');
  ok(/写真にはない/.test(doc.getElementById('app').textContent) && doc.getElementById('app').textContent.indexOf(A.ymdLabel(shiftYm + '-20')) >= 0, '写真にない登録ずみの日');
  A.shiftOcrAdd();
  var mine = A.S.shifts.filter(function(w){ return String(w.date).slice(0, 7) === shiftYm; });
  eq(mine.length, 4, '新しいものだけ足す（重ねない）');
  var w6 = A.S.shifts.filter(function(w){ return w.id === 'wk_cpm6'; })[0];
  eq(w6.end, '22:00', 'ちがう時間を直す');
  await KT.settle([A, B]);
  eq(B.S.shifts.filter(function(w){ return w.id === 'wk_cpm6'; })[0].end, '22:00', '相手に届く');
  A.S.shifts.filter(function(w){ return String(w.date).slice(0, 7) === shiftYm; }).forEach(function(w){ A.removeItem('shifts', w.id); });
  A.S.settings.shiftName = saveName; A.shiftOcr.month = '';
  A.commit();
  await KT.settle([A, B]);
});

cpTest('バイト＋：シフト希望の提出日（知らせ・下書き・提出の印）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  var saveUi = A.S.ui.campus ? J(A, A.S.ui.campus) : null, saveN = A.S.ui.notify;
  A.S.ui.notify = J(A, Object.assign({}, A.notifyPrefs(), { push:1 }));
  var dd = A.shiftDate(A.today(), 2), day = +dd.slice(8, 10);
  A.appId = 'money'; A.payTab = 'work'; A.render();
  doc.getElementById('cp_wish_day').value = String(day);
  doc.getElementById('cp_wish_lead').value = '3';
  doc.querySelector('[data-act="cp-wish-save"]').click();
  var nx = A.cpWishNext();
  ok(nx && nx.due === dd && nx.left === 2 && !nx.done, '次の締切（' + JSON.stringify(nx) + '）');
  var ym = nx.ym;
  eq(ym, A.addMonths(dd.slice(0, 7), 1), '翌月ぶん');
  A.S.exams.push(J(A, { id:'ex_cp_w', subject:'医学英語', title:'中間', date:ym + '-10', time:'', kind:'exam', room:'', photos:[], mt:Date.now() }));
  var dr = A.cpWishDraft(ym);
  var d10 = dr.days.filter(function(x){ return x.ymd === ym + '-10'; })[0];
  ok(d10.st === 'ng' && /テスト/.test(d10.text), 'テストの日は×');
  var cl = dr.days.filter(function(x){ return A.classesForDate(x.ymd).some(function(c){ return !c.off; }) && x.ymd !== ym + '-10'; })[0];
  ok(!cl || (cl.st === 'part' && /^\d\d:\d\d〜/.test(cl.text)) || cl.st === 'ng', '授業の日は「何時から」');
  ok(dr.days.some(function(x){ return x.st === 'ok'; }), '授業のない日は○');
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(/シフト希望の提出/.test(doc.getElementById('app').textContent), '今日タブで知らせる');
  var jobs = A.notifyJobs();
  ok(jobs.some(function(j){ return /^cp-wish-/.test(j.id) && /シフト希望/.test(j.title); }), '通知を送る');
  A.appId = 'money'; A.payTab = 'work'; A.render();
  doc.querySelector('[data-act="cp-wish-day"][data-d="' + ym + '-10"]').click();
  d10 = A.cpWishDraft(ym).days.filter(function(x){ return x.ymd === ym + '-10'; })[0];
  ok(d10.st === 'ok' && d10.edited, 'タップで変えられる');
  var wt = doc.getElementById('cp_wish_text');
  ok(wt && /【\d+月のシフト希望】/.test(wt.value) && /○/.test(wt.value), '下書きの文：' + (wt ? wt.value.slice(0, 80) : 'なし'));
  doc.querySelector('[data-act="cp-wish-done"]').click();
  var rec = A.S.kmData['campus:shiftWish:' + ym];
  ok(rec && rec.done === 1 && rec.days[ym + '-10'] === 'ok' && /シフト希望/.test(rec.text), '提出の印（変えた日も残す）');
  ok(A.cpWishNext().done, '出しました');
  ok(!A.notifyJobs().some(function(j){ return /^cp-wish-/.test(j.id); }), '出したら通知しない');
  A.appId = 'today'; A.render();
  ok(!/シフト希望の提出/.test(doc.getElementById('app').textContent), '今日タブの知らせも消える');
  await KT.settle([A, B]);
  eq(B.S.kmData['campus:shiftWish:' + ym].done, 1, '相手に届く');
  ok(B.cpWishNext().done, '相手でも「出した」');
  A.S.exams = A.S.exams.filter(function(x){ return x.id !== 'ex_cp_w'; });
  A.removeItem('exams', 'ex_cp_w');
  if(saveUi) A.S.ui.campus = saveUi; else delete A.S.ui.campus;
  if(saveN) A.S.ui.notify = saveN; else delete A.S.ui.notify;
  A.touch('ui'); A.commit();
  await KT.settle([A, B]);
});

cpTest('授業＋：AIの道具で読める・全体検索に出る・AIそうだんで休講を登録', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  var name = '母性看護学概論', saveSy = A.S.syllabus[name];
  A.S.syllabus[name] = J(A, { url:'', exam:'50', rep:'30', att:'', other:'', memo:'', teacher:'検索用 先生', plan:[{ no:1, title:'妊娠の経過' }], mt:Date.now() });
  var c = A.aiSectionData('courses', {});
  ok(Array.isArray(c.campus_attendance) && c.campus_attendance.length === A.termCourses().length, '出席率');
  ok(c.campus_gpa && 'gpa' in c.campus_gpa && c.campus_gpa.gpTable, 'GPAと単位');
  ok(Array.isArray(c.campus_forecast) && c.campus_forecast.some(function(f){ return f.name === name; }), '成績の見込み');
  var t = A.aiSectionData('timetable', {});
  ok(t.campus_next && t.campus_next.now, '間に合うか');
  var tr = A.aiSectionData('transit', {});
  ok(tr.campus_routes && tr.campus_routes.places.school && tr.campus_routes.commuteMinutes > 0, '通学の目安');
  var w = A.aiSectionData('work', {});
  ok(w.campus_shift, 'シフト希望');
  ok(!('campus_gpa' in A.aiSectionData('study', {})), 'ちがう分野には出さない');
  var hits = [].concat.apply([], A.KM.search.map(function(f){ return f('妊娠の経過') || []; }));
  ok(hits.some(function(h){ return h.kind === '授業' && h.title === name && h.act === 'course-open'; }), '授業計画のことばで検索');
  hits = [].concat.apply([], A.KM.search.map(function(f){ return f('検索用') || []; }));
  ok(hits.some(function(h){ return h.title === name; }), '先生の名前で検索');
  var chk = [].concat.apply([], A.KM.checks.map(function(f){ return f() || []; }));
  ok(chk.some(function(x){ return /割合の合計が80%/.test(x.msg); }), '割合の合計の点検');
  var tool = A.KM.chatTools.filter(function(x){ return x.decl.name === 'campus_class_change'; })[0];
  ok(tool && tool.write, '書きこむ道具');
  var h0 = A.S.holidays.length;
  var r = tool.run({ date:'2026-11-02', course:'医学英語', type:'cancel' });
  ok(/登録しました/.test(r.result) && r.op && r.op.list === 'holidays', '休講を登録');
  eq(A.S.holidays.length, h0 + 1, '休講が入る');
  ok(A.isCancelled('医学英語', '2026-11-02'), '時間割でも休講');
  ok(/見つかりません/.test(tool.run({ date:'2026-11-02', course:'ないない学', type:'cancel' }).result), '知らない授業は入れない');
  A.removeItem('holidays', r.op.id);
  if(saveSy) A.S.syllabus[name] = saveSy; else A.S.syllabus[name] = J(A, { url:'', exam:'', rep:'', att:'', other:'', memo:'', mt:Date.now() });
  A.touch('syllabus'); A.commit();
  await KT.settle([A, B]);
});
})();

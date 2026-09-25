/* くらしの手帳：キャラクターのセリフ・性格（キャラ＋）のテスト（KT.test で足す） */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;

/* ===== にせAI ===== */
/* 今週のセリフ：プロンプトに出てきた子ごとに30こ＋はじくべきもの */
KT.ai.push(function(req){
  if(req.tag !== 'c2-week') return null;
  var text = ((((req.contents || [])[0] || {}).parts || [])[0] || {}).text || '';
  var ids = [];
  text.replace(/・([a-z0-9_]+)：「/g, function(m, id){ ids.push(id); return m; });
  var lines = {};
  ids.forEach(function(id){
    var a = [];
    for(var i = 0; i < 30; i++) a.push('今週のセリフ' + id + i + 'だよ');
    a.push('https://example.com を見てね', 'ばかだね', 'とても長いセリフとても長いセリフとても長いセリフとても長いセリフとても長いセリフとても長いセリフ',
           '今週のセリフ' + id + '0だよ', 'Hello this is English text', '');
    lines[id] = a;
  });
  return JSON.stringify({ lines:lines });
});
KT.ai.push(function(req){
  if(req.tag !== 'c2-voice') return null;
  return 'むりしないでね。きょうは早めに休もう ハムッ！';
});
KT.ai.push(function(req){
  if(req.tag !== 'c2-dialog') return null;
  return JSON.stringify({ lines:[{ who:'a', text:'明日はテストだね' }, { who:'b', text:'早めに寝ようね' }, { who:'a', text:'https://bad.example を見て' },
    { who:'a', text:'うん、がんばろう' }, { who:'b', text:'おうえんしてる！' }] });
});

function snapAll(A){ return A.canon(A.S.charaTalk || {}) + '|' + A.canon(A.S.kmData || {}) + '|' + A.canon(A.S.ui.chara || {}) + '|' + A.canon(A.S.meta); }
function setChara(A, patch){ A.charaSet(patch); }
/* 相手の端末に届くのを待つ（同期がこんでいるときもあるので、少し長めに） */
function reach(fn, what){ return KT.until(fn, 20000, what); }

KT.test('キャラ＋：場面×性格×口ぐせでセリフが数百とおり・今日の場面が入る・同じセリフが続かない', async function(){
  var A = KT.frames().A, doc = A.document;
  var few = A.CHARAS.filter(function(k){ return A.c2ComboCount(k.id) < 300; }).map(function(k){ return k.id + ':' + A.c2ComboCount(k.id); });
  eq(few.join(','), '', '数百とおりに足りない子');
  ok(A.CHARAS.every(function(k){ return A.c2Personas[k.id] && A.c2Types[A.c2Personas[k.id].t]; }), 'どの子にも性格がある');
  setChara(A, { level:2, main:'mochi', mode:'one' }); A.commit();
  /* 今日の場面：テスト前日・締切が今日・バイトの日 */
  var td = A.today();
  A.S.exams.push(J(A, { id:'ex_c2', subject:'解剖生理学', title:'中間', date:A.shiftDate(td, 1), kind:'exam', room:'', memo:'', photos:[], mt:Date.now() }));
  A.S.tasks.push(J(A, { id:'tk_c2', title:'看護過程レポート', subject:'', due:td, time:'', done:0, memo:'', subs:[], photos:[], mt:Date.now() }));
  A.S.shifts.push(J(A, { id:'wk_c2', title:'バイト', date:td, start:'17:00', end:'21:00', realEnd:'', ot:0, rate:0, memo:'', photos:[], mt:Date.now() }));
  var ctx = A.c2Ctx(td);
  ok(ctx.on.indexOf('k-today') >= 0 && ctx.on.indexOf('p-work') >= 0, '今日の場面：' + ctx.on.join(','));
  ok(ctx.on.some(function(x){ return /^x-/.test(x); }), 'テストの場面：' + ctx.on.join(','));
  ok(ctx.on.indexOf('c-work-exam') >= 0, '場面の組み合わせ（バイト×テスト前）');
  ok(ctx.on.some(function(x){ return /^s-/.test(x); }), '季節の場面');
  var p = A.charaDayPool('koro');
  ok(p.scene.some(function(s){ return /しめきり/.test(s) && /ハムッ/.test(s); }), '締切の場面と口ぐせ');
  ok(A.c2Ctx(td).v['k-today'].n >= 1, '締切の数');
  ok(p.scene.some(function(s){ return /バイト/.test(s); }), 'バイトの日のセリフ');
  ok(p.total >= 300, 'きょうのセリフ：' + p.total);
  ok(p.late.length > 0 && p.morning.length > 30, '時間帯ごとのセリフ');
  /* 性格で文がちがう */
  var gen = A.c2SceneLines(A.charaById('komugi'), td, ctx, 1).morning.join('|');
  var non = A.c2SceneLines(A.charaById('puku'), td, ctx, 1).morning.join('|');
  ok(/元気/.test(gen) && /ねむ/.test(non) && gen !== non, '性格で朝のセリフがちがう');
  ok(A.c2SceneLines(A.charaById('hoho'), td, ctx, 1).scene.some(function(s){ return /ましょう|ですね|ですよ/.test(s); }), 'ものしりの子はていねい');
  /* 同じセリフが続かない */
  var got = [];
  for(var i = 0; i < 30; i++) got.push(A.charaPoolLine('mochi', 'any'));
  for(var j = 1; j < got.length; j++) ok(got[j] && got[j] !== got[j - 1], '同じセリフが続いた：' + got[j]);
  var uniq = {};
  got.forEach(function(s){ uniq[s] = 1; });
  ok(Object.keys(uniq).length >= 26, 'いろいろなセリフが出る（' + Object.keys(uniq).length + '）');
  ok(A.charaLine('greet').length > 0 && A.charaLine('any').length > 0, 'あいさつ');
  /* 見るだけでは保存しない */
  A.S.ui.setOpen = J(A, { chara:1 });
  var before = snapAll(A);
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(doc.querySelector('.c2-dlg'), '今日タブのキャラのおしゃべり');
  A.appId = 'set'; A.render();
  ok(doc.querySelector('.c2-set'), 'キャラの設定');
  A.charaPoolLine('mochi', 'greet');
  eq(snapAll(A), before, '見るだけ・セリフを選ぶだけでは保存しない');
  /* もとにもどす */
  A.removeItem('exams', 'ex_c2'); A.removeItem('tasks', 'tk_c2'); A.removeItem('shifts', 'wk_c2');
  A.commit();
  await KT.settle([A, KT.frames().B]);
});

KT.test('キャラ＋：AIが週に1回セリフを足す（2台で二重に作らない・変なセリフははじく・消せる）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  setChara(A, { level:2, main:'koro', mode:'one', weekAi:1 }); A.commit();
  await KT.settle([A, B]);
  var mon = A.c2Mon(A.today()), key = 'w:' + mon + ':koro', lk = 'w:' + mon + ':lock';
  if(A.S.charaTalk[key]){ delete A.S.charaTalk[key]; delete B.S.charaTalk[key]; }
  var calls = function(){ return KT.aiCalls.filter(function(c){ return c.tag === 'c2-week'; }).length; };
  var n0 = calls();
  var r = await A.c2WeekAi({ wait:0 });
  ok(r && r.ok, '作れる：' + JSON.stringify(r));
  var e = A.S.charaTalk[key];
  ok(e && e.lines.length === 30, '30こ入る（変なもの・長いもの・同じもの・英語ははじく）：' + (e && e.lines.length));
  ok(!e.lines.some(function(s){ return /http|ばか|English|とても長い/.test(s); }), '変なセリフははじく');
  eq(calls(), n0 + 1, 'AIは1回');
  var req = KT.aiCalls.filter(function(c){ return c.tag === 'c2-week'; }).pop();
  ok(/今週/.test(req.contents[0].parts[0].text) && /ころハム/.test(req.contents[0].parts[0].text), 'その週の予定とキャラの口調を渡す');
  eq((await A.c2WeekAi({ wait:0 })).skip, 'done', 'もうあれば作らない');
  var pool = A.charaDayPool('koro');
  ok(pool.week === 30 && pool.any.some(function(s){ return /今週のセリフkoro1/.test(s); }), 'セリフのしくみに入る');
  ok(!pool.any.some(function(s){ return /ハムッ.*ハムッ/.test(s); }), '口ぐせが二重にならない');
  await KT.settle([A, B]);
  await reach(function(){ return B.S.charaTalk[key] && B.S.charaTalk[key].lines.length === 30; }, '相手に届く');
  eq((await B.c2WeekAi({ wait:0 })).skip, 'done', '相手の端末では作らない');
  eq(calls(), n0 + 1, '2台でもAIは1回');
  /* ほかの端末が作っているところなら、待つ */
  A.S.charaTalk[lk] = J(A, { by:'other-device', wk:mon, mt:Date.now() });
  eq((await A.c2WeekAi({ wait:0, ids:['mochi'] })).skip, 'lock', 'ほかの端末が作っているときは作らない');
  eq(calls(), n0 + 1, 'AIは呼ばない');
  A.S.charaTalk[lk] = J(A, { by:A.DEV.id, wk:mon, mt:Date.now() });
  /* 一覧で見て、消せる */
  A.S.ui.setOpen = J(A, { chara:1 }); A.appId = 'set'; A.render();
  eq(doc.querySelectorAll('.c2-wline').length, 30, '今週足したセリフの一覧');
  var first = e.lines[0];
  var btn = [].slice.call(doc.querySelectorAll('[data-act="c2-wdel"]')).filter(function(b){ return b.dataset.t === first; })[0];
  ok(btn, '消すボタン');
  btn.click();
  eq(A.S.charaTalk[key].lines.length, 29, '消せる');
  ok(A.S.charaTalk[key].lines.indexOf(first) < 0, '消したセリフ');
  ok(!A.charaDayPool('koro').any.some(function(s){ return s.indexOf(first) >= 0; }), '消したものは出ない');
  await KT.settle([A, B]);
  await reach(function(){ return B.S.charaTalk[key].lines.length === 29; }, '消したことが相手に届く');
  /* オフにすると作らない */
  A.appId = 'set'; A.render();
  doc.querySelector('[data-act="c2-weekai"]').click();
  eq(A.c2WeekAiOn(), false, 'オフにできる');
  eq((await A.c2WeekAi({ wait:0, ids:['mochi'] })).skip, 'off', 'オフなら作らない');
  setChara(A, { weekAi:1 }); A.commit();
  await KT.settle([A, B]);
});

KT.test('キャラ＋：キャラごとの性格・口調（直せる・AIそうだんでキャラと話す）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  setChara(A, { level:2, main:'koro', mode:'one', chatChara:1 }); A.commit();
  var p = A.c2Persona('koro');
  ok(p.type === 'あまえんぼ' && p.me === 'ぼく' && p.tic === 'ハムッ' && p.like === 'ひまわりのたね', '決まった性格：' + JSON.stringify(p));
  var s = A.charaChatPersona();
  ok(/ころハム/.test(s) && /一人称は「ぼく」/.test(s) && /ハムッ/.test(s) && /ひまわりのたね/.test(s) && /正確/.test(s), 'AIに渡す口調の説明：' + s);
  eq(A.chatSystem().split('【キャラと話す】').length - 1, 1, 'AIそうだんに1回だけ入る');
  /* 設定で直す */
  A.S.ui.setOpen = J(A, { chara:1 }); A.appId = 'set'; A.render();
  doc.getElementById('c2_me').value = 'おいら';
  doc.getElementById('c2_tic').value = 'ハムハム';
  doc.getElementById('c2_like').value = 'くるみ';
  doc.getElementById('c2_style').value = 'ゆっくり、ていねいに話す';
  doc.getElementById('c2_pitch').value = '1.6';
  doc.querySelector('[data-act="c2-psave"]').click();
  p = A.c2Persona('koro');
  ok(p.me === 'おいら' && p.tic === 'ハムハム' && p.like === 'くるみ' && p.pitch === 1.6 && p.edited, '直せる：' + JSON.stringify(p));
  eq(A.charaById('koro').tic, 'ハムハム', 'キャラの口ぐせも変わる');
  ok(A.charaDayPool('koro').scene.some(function(x){ return /ハムハム/.test(x); }), 'セリフに新しい口ぐせ');
  ok(/おいら/.test(A.charaChatPersona()) && /ゆっくり、ていねいに/.test(A.chatSystem()), 'AIそうだんにも伝わる');
  A.render();
  doc.querySelector('[data-act="c2-ptype"][data-v="kimagure"]').click();
  eq(A.c2Persona('koro').t, 'kimagure', '性格の型も選べる');
  eq(A.c2Persona('koro').me, 'おいら', '直したところは残る');
  await KT.settle([A, B]);
  await reach(function(){ return B.c2Persona('koro').me === 'おいら'; }, '性格が相手に届く');
  eq(B.charaById('koro').tic, 'ハムハム', '相手でも口ぐせが変わる');
  /* オフにできる */
  A.render();
  doc.querySelector('[data-act="chara-talkai"]').click();
  eq(A.charaChatPersona(), '', 'オフなら空');
  ok(!/【キャラと話す】/.test(A.chatSystem()), 'オフならAIそうだんに入らない');
  /* もとにもどす */
  A.render();
  doc.querySelector('[data-act="c2-preset"]').click();
  eq(A.c2Persona('koro').me, 'ぼく', 'もとにもどす');
  eq(A.charaById('koro').tic, 'ハムッ', '口ぐせももどる');
  setChara(A, { chatChara:1 }); A.commit();
  await KT.settle([A, B]);
  await reach(function(){ return B.charaById('koro').tic === 'ハムッ'; }, '相手ももどる');
});

KT.test('キャラ＋：季節のイベントのセリフと飾り', async function(){
  var A = KT.frames().A;
  setChara(A, { level:2, main:'mochi', mode:'one' });
  var cases = { '2027-01-01':'newyear', '2027-02-03':'setsubun', '2027-02-14':'valentine', '2027-03-03':'hinamatsuri', '2027-03-14':'whiteday',
    '2027-04-02':'sakura', '2027-04-12':'shingakki', '2027-05-05':'kodomo', '2027-06-10':'tsuyu', '2027-07-07':'tanabata', '2027-08-10':'natsu',
    '2027-08-28':'natsuyasumi', '2026-09-15':'tsukimi', '2026-10-31':'halloween', '2026-11-15':'kouyou', '2026-12-24':'xmas', '2026-12-31':'omisoka' };
  var P = new A.DOMParser();
  Object.keys(cases).forEach(function(d){
    var key = cases[d];
    ok(A.c2FesOn(d).indexOf(key) >= 0, d + ' は ' + key + '：' + A.c2FesOn(d).join(','));
    eq(A.c2FesMain(d), key, d + ' のかざり');
    ok(A.DECOR[key] && /^<svg/.test(A.DECOR[key].art), key + ' のかざりの絵');
    var svg = A.DECOR[key].art.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    ok(!P.parseFromString(svg, 'image/svg+xml').getElementsByTagName('parsererror').length, key + ' の絵がこわれている');
    ok(A.DECOR_TOP[key] && A.DECOR_TOP[key].length, key + ' の小さな絵');
    ok(A.c2Scenes['f-' + key] && A.c2Scenes['f-' + key].base.length >= 2, key + ' のセリフ');
    ok(A.c2FesName(key) && A.c2FesName(key) !== key, key + ' の名前');
    var pool = A.charaDayPool('mochi', d);
    ok(pool.ctx.indexOf('f-' + key) >= 0, d + ' の場面に行事が入る');
    ok(pool.scene.some(function(s){ return A.c2Scenes['f-' + key].base.some(function(b){ return s.indexOf(b.replace(/[！。]$/, '')) >= 0; }); }), d + ' の特別なセリフ');
  });
  ok(A.c2FesOn('2027-04-02').indexOf('shingakki') >= 0, '桜と新学期が重なる日');
  eq(A.c2FesOn('2026-12-31').join(','), 'omisoka,newyear', '大みそかはお正月のかざりより先');
  /* 今日のかざりは、行事があればその行事 */
  var fes = A.c2FesMain();
  var cur = A.decorNow();
  if(fes && A.S.ui.fesMode !== 0) eq(cur && cur.key, fes, '今日のかざり');
  /* 行事の会話 */
  var dl = A.c2DialogList('2026-12-24');
  ok(dl.some(function(d){ return d.topic === 'fes' && d.lines.some(function(l){ return /クリスマス/.test(l.t); }); }), 'クリスマスの会話');
});

KT.test('キャラ＋：スマホ・Discordの通知がキャラの口調になる（意味は変えない・オフにできる）', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  setChara(A, { level:2, main:'koro', mode:'one', notifyTalk:1 });
  var due = A.shiftDate(A.today(), 2);
  A.S.tasks.push(J(A, { id:'tk_c2n', title:'看護レポート', subject:'', due:due, time:'', done:0, memo:'', subs:[], photos:[], mt:Date.now() }));
  A.notifySet({ push:1, quiet:0, dl1:1, dl3:1, dl0:1 });
  var jobs = A.notifyJobs();
  var j1 = jobs.filter(function(j){ return j.id === 'd1-tk_c2n-' + due; })[0];
  ok(j1, '前日の通知がある');
  eq(j1.title, '明日が締切だよ ハムッ！', 'キャラの口調の題');
  eq(j1.body.indexOf('看護レポート'), 0, '本文の中身はそのまま');
  ok(/ころハム「.+ハムッ.?」/.test(j1.body) && j1.body.length <= 200, 'ひとことを足す：' + j1.body);
  eq(JSON.stringify(A.notifyJobs().filter(function(j){ return j.id === j1.id; })[0]), JSON.stringify(j1), '何度作っても同じ文（送り直しが増えない）');
  jobs.filter(function(j){ return j.wx; }).forEach(function(j){ ok(!/ころハム「/.test(j.body), '天気を入れ直す通知の本文は変えない'); });
  ok(jobs.every(function(j){ return String(j.title).length <= 80 && String(j.body).length <= 200; }), '長さ');
  eq(A.c2JobText({ id:'e0-x', title:'今日は小テスト', body:'解剖' }, true).title, '今日は小テストだね ハムッ！', 'テストの日');
  eq(A.c2JobText({ id:'c-x', title:'10分後に2限', body:'基礎看護' }, true).title, '10分後に2限だよ ハムッ！', '授業の前');
  var other = A.c2JobText({ id:'zz-x', title:'ほかの機能の通知です', body:'本文' }, true);
  ok(other.body === '本文' && other.title === 'ほかの機能の通知です ハムッ！', 'ほかの機能の通知は、題に口ぐせだけ');
  /* オフ */
  setChara(A, { notifyTalk:0 });
  var j2 = A.notifyJobs().filter(function(j){ return j.id === j1.id; })[0];
  ok(j2.title === '明日が締切です' && j2.body === '看護レポート', 'オフにすると元の文');
  /* 設定の見本 */
  setChara(A, { notifyTalk:1 });
  A.S.ui.setOpen = J(A, { chara:1 }); A.appId = 'set'; A.render();
  ok(/明日が締切だよ/.test(A.document.querySelector('.c2-set').textContent), '設定に見本');
  A.removeItem('tasks', 'tk_c2n'); A.commit();
  await KT.settle([A, B]);
});

KT.test('キャラ＋：なかよし度でセリフが増える・つぎのレベルまでのメーター', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  setChara(A, { level:2, main:'mochi', mode:'one', callName:'ゆりちゃん' }); A.commit();
  var b0 = A.c2Bond('mochi');
  A.c2BondAdd('mochi', 'pats'); A.c2BondAdd('mochi', 'talks');
  var b1 = A.c2Bond('mochi');
  eq(b1.pts, b0.pts + 3, 'なでた・話しかけたぶん上がる');
  eq(b1.first, A.today(), '出会った日を覚える');
  var counts = [0, 1, 2, 3, 4, 5].map(function(lv){ return A.c2BondLines('mochi', lv).length; });
  for(var i = 1; i < counts.length; i++) ok(counts[i] > counts[i - 1], 'Lv' + i + 'でセリフが増える：' + counts.join(','));
  ok(A.c2BondLines('mochi', 1).some(function(s){ return /ゆりちゃん/.test(s); }), 'Lv1：名前で呼ぶ');
  ok(A.c2BondLines('mochi', 2).some(function(s){ return /じつは|ないしょ|ひみつ/.test(s); }), 'Lv2：ひみつの話');
  ok(A.c2BondLines('mochi', 3).some(function(s){ return /はじめて話しかけて|出会ってから/.test(s); }), 'Lv3：思い出の話');
  ok(A.c2BondLines('mochi', 4).some(function(s){ return /いつか|ゆめ/.test(s); }), 'Lv4：ないしょの夢');
  /* レベルが上がると、今日のセリフにも出る */
  A.S.kmData['chara2:bond'] = J(A, { c:{ mochi:{ pats:400, talks:0, voice:0, first:'2026-04-01' } }, mt:Date.now() });
  A.touch('kmData');
  eq(A.c2Bond('mochi').lv, 5, 'なかよしLv5');
  eq(A.c2Bond('mochi').next, 0, 'さいこう');
  var pool = A.charaDayPool('mochi');
  ok(pool.bond >= counts[5], 'なかよし度のセリフが入る（' + pool.bond + '）');
  ok(pool.scene.some(function(s){ return /ゆりちゃん/.test(s) && /だいすき|たからもの|いっしょに/.test(s); }), 'Lv5：名前を呼んで、だいすきの言葉');
  ok(pool.scene.some(function(s){ return /出会ってから/.test(s); }), '思い出の話（出会ってからの日数）');
  /* メーター */
  A.S.kmData['chara2:bond'] = J(A, { c:{ mochi:{ pats:2, talks:1, voice:0, first:A.today() } }, mt:Date.now() });
  A.S.kmData['chara2:bond:' + A.DEV.id] = J(A, { c:{}, mt:Date.now() });
  A.touch('kmData'); A.commit();
  A.S.ui.setOpen = J(A, { chara:1 }); A.appId = 'set'; A.render();
  var m = doc.querySelector('.c2-set .c2-bar[role="meter"]');
  var now = m ? +m.getAttribute('aria-valuenow') : -1;
  ok(now >= 0 && now <= 100, 'メーター（' + now + '）');
  ok(/なかよしLv\d/.test(doc.querySelector('.c2-set .c2-meter').textContent), 'レベルの表示');
  var bb = A.c2Bond('mochi');
  ok(bb.lv === 5 || /つぎのLvまで \d+pt/.test(doc.querySelector('.c2-set .c2-meter').textContent), 'つぎのレベルまで');
  eq(doc.querySelectorAll('.c2-unlock .c2-ul').length, 5, 'レベルごとに増えるもの');
  eq(doc.querySelectorAll('.c2-unlock .c2-ul.on').length, bb.lv, 'いまのレベルまで印');
  /* 呼び名を設定から */
  doc.getElementById('c2_call').value = 'ゆりさん';
  doc.querySelector('[data-act="c2-call"]').click();
  eq(A.S.ui.chara.callName, 'ゆりさん', '呼び名を保存');
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(doc.querySelector('.c2-meter.sm .c2-bar[role="meter"]'), '今日タブにもメーター');
  await KT.settle([A, B]);
  await reach(function(){ return B.c2Bond('mochi').parts.pats === 2; }, 'なかよし度が相手に届く');
  await reach(function(){ return B.S.ui.chara.callName === 'ゆりさん'; }, '呼び名が相手に届く');
  /* 2台で同時に話しかけても、どちらの回数も消えない */
  var t0 = B.c2Bond('mochi').parts;
  A.c2BondAdd('mochi', 'talks'); A.persist();
  B.c2BondAdd('mochi', 'talks'); B.c2BondAdd('mochi', 'pats'); B.persist();
  A.commit(); B.commit();
  await KT.settle([A, B]);
  await reach(function(){ var p = A.c2Bond('mochi').parts; return p.talks === t0.talks + 2 && p.pats === t0.pats + 1; }, '2台で話しかけた回数がどちらも残る（こちら）');
  await reach(function(){ var p = B.c2Bond('mochi').parts; return p.talks === t0.talks + 2 && p.pats === t0.pats + 1; }, '2台で話しかけた回数がどちらも残る（相手）');
  setChara(A, { callName:'' }); A.commit();
  await KT.settle([A, B]);
});

KT.test('キャラ＋：声で話しかける（文字でも・セリフで返事→AIで返事・キャラごとの声）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  setChara(A, { level:2, main:'koro', mode:'one', voiceOn:1, voiceAi:0 }); A.commit();
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(doc.querySelector('.c2-talk') && doc.querySelector('[data-act="c2-mic"]') && doc.getElementById('c2_say'), '今日タブにマイクと文字の入力');
  /* 声の入力がない端末は、文字で */
  var keepSR = A.c2SR;
  A.c2SR = function(){ return null; };
  eq(A.c2VoiceStart(), false, '声の入力がない端末');
  ok(/文字で/.test(doc.getElementById('toast').textContent), '文字で話しかけてね、と出る');
  /* 声の入力があるとき（にせもの） */
  var fakeRec = null;
  A.c2SR = function(){ return function(){ fakeRec = this; this.start = function(){}; this.stop = function(){}; }; };
  eq(A.c2VoiceStart(), true, '聞きはじめる');
  ok(fakeRec && fakeRec.lang === 'ja-JP' && A.c2Talk.listening, '日本語で聞く');
  fakeRec.onresult({ results:[[{ transcript:'おはよう' }]] });
  await KT.until(function(){ return !A.c2Talk.listening && A.c2Talk.q === 'おはよう' && A.c2Talk.a; }, 3000, '声で話しかけた返事');
  A.c2SR = keepSR;
  /* 文字で話しかける（AIなし → セリフのしくみで返事） */
  var v0 = A.c2Bond('koro').parts.voice;
  A.appId = 'today'; A.render();
  doc.getElementById('c2_say').value = 'つかれた…';
  doc.querySelector('[data-act="c2-say"]').click();
  await KT.until(function(){ return A.c2Talk.q === 'つかれた…' && A.c2Talk.a && !A.c2Talk.busy; }, 3000, '返事');
  ok(/ハムッ/.test(A.c2Talk.a), 'その子の口ぐせで返事：' + A.c2Talk.a);
  eq(A.c2Talk.ai, 0, 'AIを使わない返事');
  ok(doc.querySelector('.c2-talk .c2-a'), '返事が出る');
  var p = A.c2Persona('koro');
  ok(A.c2LastUtter && A.c2LastUtter.pitch === p.pitch && A.c2LastUtter.rate === p.rate && /ハムッ/.test(A.c2LastUtter.text), '声の高さ・速さはその子のもの');
  eq(A.c2Bond('koro').parts.voice, v0 + 1, 'なかよし度に入る');
  ok(A.c2Persona('koro').pitch !== A.c2Persona('puku').pitch, 'キャラごとに声の高さがちがう');
  ok(A.c2ReplyLocal('テストがこわい', 'koro').length > 0 && A.c2ReplyLocal('すきなものは？', 'hoho').length > 0, 'いろいろな話しかけに返事');
  /* AIで返事 */
  setChara(A, { voiceAi:1 });
  var r = await A.c2VoiceReply('テストがこわい');
  eq(r, 'むりしないでね。きょうは早めに休もう ハムッ！', 'AIの返事');
  eq(A.c2Talk.ai, 1, 'AIの印');
  var req = KT.aiCalls.filter(function(c){ return c.tag === 'c2-voice'; }).pop();
  ok(/ころハム/.test(req.system) && /一人称/.test(req.system) && /読み上げ/.test(req.system), 'AIにその子の口調を伝える');
  /* 読み上げをオフ */
  setChara(A, { voiceOn:0 });
  A.c2LastUtter = null;
  await A.c2VoiceReply('おやすみ');
  eq(A.c2LastUtter, null, '読み上げオフなら話さない');
  setChara(A, { voiceOn:1, voiceAi:1 }); A.commit();
  await KT.settle([A, B]);
  await reach(function(){ return B.c2Bond('koro').parts.voice === A.c2Bond('koro').parts.voice; }, '話した回数が相手に届く');
});

KT.test('キャラ＋：キャラどうしの会話（今日の予定から・今日タブ・AIの今日の会話は週3回まで）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  setChara(A, { level:2, main:'mochi', mode:'one' }); A.commit();
  var td = A.today();
  A.S.exams.push(J(A, { id:'ex_c2d', subject:'基礎看護学', title:'', date:A.shiftDate(td, 1), kind:'exam', room:'', memo:'', photos:[], mt:Date.now() }));
  if(A.S.charaTalk['c:' + td]) delete A.S.charaTalk['c:' + td];
  var list = A.c2DialogList(td);
  ok(list.length >= 5, '会話がいくつもある（' + list.length + '）');
  list.forEach(function(d){
    ok(d.lines.length >= 3 && d.lines.length <= 6, '3〜6行：' + d.topic);
    ok(d.lines.some(function(l){ return l.who === 0; }) && d.lines.some(function(l){ return l.who === 1; }), '2ひきで話す：' + d.topic);
    ok(d.pair[0] !== d.pair[1], 'ちがう子どうし');
    ok(d.lines.every(function(l){ return l.t && !/[{}]/.test(l.t); }), 'うめこみ忘れがない：' + d.topic);
  });
  /* テストの話が出る（どの言い回しになるかは日によって変わるので、話題で見る） */
  var xs = list.filter(function(d){ return /^x-/.test(d.topic); });
  ok(xs.length >= 1, 'テストの話：' + list.map(function(d){ return d.topic; }).join(','));
  ok(xs.every(function(d){ return d.lines.every(function(l){ return l.t && l.t.length >= 2; }); }), 'テストの話の中身がある');
  ok(/^(x-|k-)/.test(list[0].topic), 'いちばん今日らしい話が先：' + list[0].topic);
  /* 今日タブ */
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  var box = doc.querySelector('.c2-dlg');
  ok(box && box.querySelectorAll('.c2-dl').length >= 3, '今日タブに会話');
  ok(box.querySelectorAll('.c2-dl.l').length && box.querySelectorAll('.c2-dl.r').length, '左右に2ひき');
  var t0 = box.textContent;
  doc.querySelector('[data-act="c2-dlg-next"]').click();
  ok(doc.querySelector('.c2-dlg').textContent !== t0, 'ほかの話');
  /* AIで今日の会話 */
  if(A.S.charaTalk['c:' + td]) delete A.S.charaTalk['c:' + td];
  ok(await A.c2DialogAi(), 'AIの会話を作る');
  var e = A.S.charaTalk['c:' + td];
  ok(e && e.lines.length === 4, 'へんな行ははじく：' + (e && e.lines.length));
  var l0 = A.c2DialogList(td)[0];
  ok(l0.ai === 1 && l0.lines.length === 4, 'AIの会話が先に出る');
  ok(!(await A.c2DialogAi()), '1日1本まで');
  await KT.settle([A, B]);
  await reach(function(){ return !!B.S.charaTalk['c:' + td]; }, 'AIの会話が相手に届く');
  /* 週3回まで */
  var mon = A.c2Mon(td), extra = [];
  for(var i = 0; i < 7 && extra.length < 2; i++){ var d = A.shiftDate(mon, i); if(d !== td) extra.push(d); }
  extra.forEach(function(d){ A.S.charaTalk['c:' + d] = J(A, { pair:['mochi', 'koro'], lines:[{ w:'a', t:'あ' }, { w:'b', t:'い' }, { w:'a', t:'う' }], mt:Date.now() }); });
  eq(A.c2DialogAiLeft(td), 0, '週3回まで');
  extra.forEach(function(d){ delete A.S.charaTalk['c:' + d]; });
  eq(A.c2DialogAiLeft(td), 2, 'あと2回');
  /* キャラの画面にも */
  A.S.ui.setOpen = J(A, { chara:1 }); A.appId = 'set'; A.render();
  ok(doc.querySelector('.c2-set .c2-dlg .c2-dl'), 'キャラの画面にも会話');
  A.removeItem('exams', 'ex_c2d'); A.commit();
  await KT.settle([A, B]);
});

KT.test('キャラ＋：AIの道具で性格・なかよし度・今週のセリフが読める・全体検索', async function(){
  var A = KT.frames().A;
  setChara(A, { level:2, main:'koro', mode:'one' });
  var key = A.c2WeekKey('koro');
  if(!A.S.charaTalk[key]) A.S.charaTalk[key] = J(A, { wk:A.c2Mon(A.today()), id:'koro', lines:['今週のセリフkoro5だよ'], mt:Date.now() });
  A.touch('charaTalk'); A.commit();
  var r = A.aiSectionData('chara', {});
  ok(r.c2chara && r.c2chara.persona && r.c2chara.persona[0].me === 'ぼく' && r.c2chara.persona[0].type, 'AIが性格を読める');
  ok(r.c2chara.bond[0].level >= 0 && /%$/.test(r.c2chara.bond[0].meter), 'なかよし度とメーター');
  ok(r.c2chara.weekLines.koro && r.c2chara.weekLines.koro.length, '今週のセリフ');
  ok(r.c2chara.today && r.c2chara.today.dialog.length >= 3 && r.c2chara.today.combos > 300, '今日の場面と会話');
  ok(r.data && r.data.charaTalk, 'S.charaTalk もそのまま読める');
  ok(!A.aiSectionData('study', {}).c2chara, 'ほかの分野には出さない');
  /* 全体検索 */
  var find = function(q){ var out = []; A.KM.search.forEach(function(fn){ out = out.concat(fn(q) || []); }); return out; };
  ok(find('今週のセリフkoro').some(function(h){ return h.kind === 'キャラのセリフ' && h.act === 'c2-open'; }), '検索でAIのセリフが見つかる');
  ok(find('あまえんぼ').some(function(h){ return h.kind === 'キャラ' && /ころハム|ぶーこ|ちゅーた/.test(h.title); }), '性格でさがせる');
  eq(find('').length, 0, '空のことばでは出さない');
  A.appId = 'today'; A.render();
  A.kmRunAction('c2-open', { dataset:{} });
  eq(A.appId, 'set', 'キャラの設定を開く');
  setChara(A, { main:'mochi' }); A.S.ui.setOpen = J(A, { s1:1 }); A.touch('ui'); A.commit();
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  await KT.settle([A, KT.frames().B]);
});

KT.test('キャラ＋：通知の口調は、「ランダム」で開くたびに子が変わっても同じ文', async function(){
  var A = KT.frames().A;
  var keep = J(A, A.S.ui.chara || {});
  try{
    setChara(A, { level:2, mode:'random', notifyTalk:1 });
    var job = { id:'d1-tk_rand-2026-01-01', title:'明日が締切です', body:'レポート' };
    var outs = {};
    for(var i = 0; i < 8; i++){ A.__charaRandom = null; outs[JSON.stringify(A.c2JobText(job))] = 1; }
    eq(Object.keys(outs).length, 1, '開きなおしても同じ文：' + Object.keys(outs).join(' ／ '));
  }finally{ A.S.ui.chara = keep; A.__charaRandom = null; A.touch('ui'); A.commit(); }
  await KT.settle([A, KT.frames().B]);
});

KT.test('キャラ＋：記念日の場面は、おせわの記念日と同じ読み方（「〇〇の誕生日」・まだ来ていない年は出さない）', async function(){
  var A = KT.frames().A, td = A.today();
  var keep = A.S.annivs;
  try{
    A.S.annivs = [J(A, { id:'an_c2a', mt:Date.now(), name:'おかあさん', date:td.slice(5), kind:'birthday', who:'family', memo:'' })];
    var ctx = A.c2Ctx(td);
    ok(ctx.on.indexOf('n-anniv') >= 0, '記念日の場面');
    eq(ctx.v['n-anniv'].anniv, 'おかあさんの誕生日', '「〇〇の誕生日」と言う');
    A.S.annivs = [J(A, { id:'an_c2b', mt:Date.now(), name:'みらいの日', date:(+td.slice(0, 4) + 1) + td.slice(4), kind:'anniv', who:'other', memo:'' })];
    ok(A.c2Ctx(td).on.indexOf('n-anniv') < 0, 'まだ来ていない年の記念日は出さない');
  }finally{ A.S.annivs = keep; }
});
})();

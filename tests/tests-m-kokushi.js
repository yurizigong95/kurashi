/* くらしの手帳：勉強①（国試・略語・基準値・薬・解剖・手技） のテスト（KT.test で足す） */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;

/* ===== にせAI ===== */
KT.ai.push(function(req){
  if(req.tag === 'kq-photo') return JSON.stringify({ questions:[
    { field:'kiso', q:'写真の問題1：手指衛生のタイミングはどれか。', choices:['1. 患者に触れる前', '2. 食事のあと', '3. 帰宅したとき', '4. 休憩のあと'], ans:[1], ansFrom:'photo', exp:'写真の解説1' },
    { field:'基礎看護学', q:'写真の問題2：2つ選べ。', choices:['あ', 'い', 'う', 'え', 'お'], ans:['1', 3], ansFrom:'ai', exp:'写真の解説2' },
    { field:'なぞの分野', q:'写真の問題3', choices:['あ', 'い', 'う', 'え'], ans:[3], ansFrom:'photo', exp:'' },
    { q:'選択肢が足りない問題', choices:['あ'], ans:[1] },
    { q:'正解がない問題', choices:['あ', 'い'], ans:[] }
  ] });
  if(req.tag === 'kq-make') return JSON.stringify({ questions:[
    { q:'AIの問題1：産褥期の悪露の変化で正しいのはどれか。', choices:['赤色→褐色→黄色→白色', '白色→赤色', '黄色→赤色', '褐色→白色→赤色'], ans:[1], exp:'AIの解説1' },
    { q:'AIの問題2', choices:['あ', 'い', 'う', 'え'], ans:[4], exp:'AIの解説2' }
  ] });
  if(req.tag === 'kq-exp'){
    var txt = (req.contents[0].parts || []).map(function(p){ return p.text || ''; }).join('');
    var m = txt.match(/■(メモ「[^」]+」)/);
    return JSON.stringify({ exp:'くわしい解説です。', points:['ポイント1'], sources:[m ? m[1] : '', 'メモ「ないメモ」'] });
  }
  if(req.tag === 'kq-anat') return JSON.stringify({ labels:[
    { name:'左心室', box_2d:[500, 600, 560, 760] }, { name:'大動脈', box_2d:[100, 300, 150, 420] }, { name:'', box_2d:[1, 2, 3, 4] }, { name:'こわれた', box_2d:[1, 2] }
  ] });
  if(req.tag === 'kq-skill') return JSON.stringify({ name:'輸液ポンプの準備', steps:[
    { step:'手指衛生をする', why:'感染を防ぐため', whyFrom:'photo' },
    { step:'指示書と薬剤を確認する', why:'誤薬を防ぐため', whyFrom:'ai' },
    { step:'流量を設定する', why:'', whyFrom:'photo' }
  ] });
  return null;
});
/* ===== にせのWikipedia ===== */
KT.api.push(function(url){
  if(!/ja\.wikipedia\.org\/api\/rest_v1\/page\/summary\//.test(url)) return null;
  var t = decodeURIComponent(url.split('/summary/')[1]);
  if(t === 'ないことば') return null;
  return { type:'standard', title:t, description:'テストの説明', extract:t + 'は、テストの要約です。',
           content_urls:{ desktop:{ page:'https://ja.wikipedia.org/wiki/' + encodeURIComponent(t) } } };
});

function img(w, h){
  var c = KT.frames().A.document.createElement('canvas');
  c.width = w; c.height = h;
  var g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#000000'; g.font = '20px sans-serif'; g.fillText('右心房', 30, 60); g.fillText('左心室', 240, 180);
  return c.toDataURL('image/jpeg', 0.8);
}
function open(w, tool){ w.appId = 'study'; w.studyTool = tool; w.render(); }
function text(w){ return w.document.getElementById('app').textContent; }
function typeIn(w, id, v){
  var el = w.document.getElementById(id);
  if(!el) throw new Error('入力欄がありません：' + id);
  if(el.type === 'checkbox') el.checked = !!v; else el.value = v;
  el.dispatchEvent(new w.Event(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', { bubbles:true }));
}
function click(w, sel){
  var el = w.document.querySelector(sel);
  if(!el) throw new Error('ボタンがありません：' + sel);
  el.click();
  return el;
}
function cleanCards(w){
  (w.S.cards || []).filter(function(c){ return c.src === 'kokushi'; }).forEach(function(c){ w.removeItem('cards', c.id); });
}
function resetState(w){
  var s = w.kqState;
  s.drill = null; s.add = ''; s.preview = null; s.busy = ''; s.field = ''; s.n = 10; s.inp = {};
  s.dictQ = ''; s.dictOpen = ''; s.dictAdd = false; s.wiki = null;
  s.labCat = ''; s.labQ = ''; s.labQuiz = null; s.drugCat = ''; s.drugQ = ''; s.drugHi = false; s.drugOpen = -1; s.drugFlip = null;
  s.anat = null; s.anatEdit = null; s.skill = ''; s.skillChk = {}; s.skillWhy = {}; s.skillRun = null; s.skillPv = null; s.skillAdd = false;
}

KT.test('国試：はじめから入っているデータの数と形（問題・辞書・基準値・薬・手順・図）', async function(){
  var A = KT.frames().A;
  var qs = A.kqBuiltinQs();
  ok(qs.length >= 60, '練習問題が60問以上：' + qs.length);
  A.KQ_FIELDS.forEach(function(f){ ok(qs.filter(function(q){ return q.f === f[0]; }).length >= 4, f[1] + 'の問題が少ない'); });
  var seen = {};
  qs.forEach(function(q){
    ok(!seen[q.id], '問題のidが重なる：' + q.id); seen[q.id] = 1;
    ok(q.c.length >= 4 && q.c.length <= 5, '四択〜五択：' + q.q);
    if(q.f === 'hisshu') eq(q.c.length, 4, '必修は四択：' + q.q);
    ok(q.a.length >= 1 && q.a.every(function(i){ return i >= 0 && i < q.c.length; }), '正解の番号：' + q.q);
    ok(q.e && q.e.length > 20, '解説：' + q.q);
    eq(q.src, 'くらしの手帳の練習問題（教科書で確かめて）', '問題の出典');
  });
  ok(A.KQ_DICT.length >= 200, '辞書が200語以上：' + A.KQ_DICT.length);
  A.KQ_DICT.forEach(function(s){ eq(s.split('|').length, 5, '辞書の形：' + s.slice(0, 20)); });
  ok(A.kqDictBuiltin().every(function(o){ return o.abbr && o.ja && o.desc; }), '辞書の中身');
  ['BP','HR','RR','SpO2','ADL','QOL','IADL','BMI','NPO','PRN','DNR','COPD','DM','HT','CVA','MI','ICU','NICU','IVH','CV','PICC','NG','Foley','I/O','Vital','JCS','GCS','MMT','ROM','SOAP','POS','既往歴'].forEach(function(ab){
    ok(A.kqDictBuiltin().some(function(o){ return o.abbr === ab; }), '辞書に ' + ab + ' がない');
  });
  ok(A.KQ_LABS.length >= 60, '基準値が60以上：' + A.KQ_LABS.length);
  A.KQ_LABS.forEach(function(s){ eq(s.split('|').length, 6, '基準値の形：' + s.slice(0, 20)); });
  ok(A.kqLabs().every(function(o){ return o.cat && o.name && o.v; }), '基準値の中身');
  ok(A.KQ_DRUGS.length >= 50, '薬が50枚以上：' + A.KQ_DRUGS.length);
  A.KQ_DRUGS.forEach(function(s){ eq(s.split('|').length, 7, '薬の形：' + s.slice(0, 20)); });
  ok(A.kqDrugs().every(function(o){ return o.group && o.names && o.act && o.side && o.care; }), '薬の中身');
  ok(A.kqDrugs().some(function(o){ return o.hi; }) && A.kqDrugs().some(function(o){ return !o.hi; }), 'ハイリスク薬の印');
  ok(A.KQ_SKILLS.length >= 15, '手順が15技術以上：' + A.KQ_SKILLS.length);
  var sid = {};
  A.kqSkillsBuiltin().forEach(function(s){
    ok(!sid[s.id], '手順のidが重なる'); sid[s.id] = 1;
    ok(s.steps.length >= 5 && s.steps.every(function(st){ return st.s && st.w; }), '手順と根拠：' + s.name);
  });
  var an = A.kqAnatBuiltin();
  ok(an.length >= 2, '解剖図が2つ以上');
  an.forEach(function(a){
    ok(a.holes.length >= 4, a.title + 'の穴');
    a.holes.forEach(function(h){ ok(h.x >= 0 && h.y >= 0 && h.x + h.w <= 1.001 && h.y + h.h <= 1.001, a.title + 'の穴が図の外：' + h.ans); });
  });
  ok(new TextEncoder().encode(Array.prototype.join.call([A.KQ_QS, A.KQ_DICT, A.KQ_LABS, A.KQ_DRUGS].map(function(x){ return JSON.stringify(x); }), '')).length < 400000, '大きすぎない');
});

KT.test('国試：辞書の検索（部分一致・ひらがな・カタカナ・英字）と、自分で足す・暗記カードにする', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  resetState(A);
  var has = function(q, abbr){ return A.kqDictSearch(q, 60).some(function(o){ return o.abbr === abbr; }); };
  ok(has('adl', 'ADL'), '小文字の英字');
  ok(has('ＡＤＬ', 'ADL'), '全角の英字');
  ok(has('えーでぃーえる', 'ADL'), 'ひらがなの読み');
  ok(has('エーディーエル', 'ADL'), 'カタカナの読み');
  ok(has('日常生活', 'ADL'), '日本語の意味（部分一致）');
  ok(has('spo2', 'SpO2'), 'SpO2');
  ok(has('きおうれき', '既往歴'), '日本語の用語の読み');
  eq(A.kqDictSearch('adl')[0].abbr, 'ADL', 'ぴったり同じものが先');
  eq(A.kqDictSearch('zzzzqqqq').length, 0, 'ないことば');
  open(A, 'kq-dict');
  typeIn(A, 'kq_dq', 'じょくそう');
  ok(/褥瘡/.test(doc.getElementById('kq_dres').textContent), '打つと結果が出る');
  ok(doc.getElementById('kq_dq'), '検索欄は描き直さない');
  click(A, '#kq_dres [data-act="kq-dict-open"]');
  ok(/出典：くらしの手帳の用語集（教科書で確かめて）/.test(text(A)), '出典が出る');
  var n0 = A.S.cards.length;
  click(A, '[data-act="kq-dict-card"]');
  eq(A.S.cards.length, n0 + 1, '暗記カードになる');
  ok(/出典/.test(A.S.cards[A.S.cards.length - 1].a), 'カードにも出典');
  click(A, '[data-act="kq-dict-card"]');
  eq(A.S.cards.length, n0 + 1, '同じカードは2回入れない');
  /* 自分で足す */
  click(A, '[data-act="kq-abbr-open"]');
  typeIn(A, 'kq_na', 'CGA'); typeIn(A, 'kq_nj', '高齢者総合機能評価'); typeIn(A, 'kq_nf', 'comprehensive geriatric assessment');
  typeIn(A, 'kq_ny', 'シージーエー'); typeIn(A, 'kq_nd', '高齢者の心身と生活をまとめて評価する方法'); typeIn(A, 'kq_ns', '老年看護学の授業');
  click(A, '[data-act="kq-abbr-add"]');
  var mine = A.S.abbrs.filter(function(x){ return x.abbr === 'CGA'; });
  eq(mine.length, 1, '自分の略語が S.abbrs に入る');
  eq(mine[0].src, '自分で入力：老年看護学の授業', '自分の略語の出典');
  ok(mine[0].id && mine[0].mt, 'id と mt');
  ok(has('しーじーえー', 'CGA') && has('総合機能', 'CGA'), '自分の略語もさがせる');
  ok(/CGA/.test(text(A)) && /老年看護学の授業/.test(text(A)), '足したものが出る');
  click(A, '[data-act="kq-abbr-add"]'.replace('add', 'open'));
  typeIn(A, 'kq_na', 'CGA'); typeIn(A, 'kq_nj', '高齢者総合機能評価');
  click(A, '[data-act="kq-abbr-add"]');
  eq(A.S.abbrs.filter(function(x){ return x.abbr === 'CGA'; }).length, 1, '同じものは2つ入れない');
  await KT.settle([A, B]);
  eq(B.S.abbrs.filter(function(x){ return x.abbr === 'CGA'; }).length, 1, '相手の端末に届く');
  ok(B.kqDictSearch('cga').some(function(o){ return o.own; }), '相手の端末でもさがせる');
  mine.forEach(function(x){ A.removeItem('abbrs', x.id); });
  cleanCards(A); A.commit();
  await KT.settle([A, B]);
  resetState(A);
});

KT.test('国試：ドリルで答えると kqLog に残り、相手の端末に届く（まちがえた問題はまた出る）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  resetState(A);
  A.kqState.field = 'hisshu'; A.kqState.n = 5;
  open(A, 'kq-drill');
  ok(/国試ドリル/.test(text(A)) && /分野ごとの正答率/.test(text(A)), 'ドリルの画面');
  ok(doc.querySelector('a.kq-link[href^="https://www.mhlw.go.jp/"]'), '厚生労働省の過去問へのリンク');
  var before = A.kqDayCount(A.today()).n;
  click(A, '[data-act="kq-start"][data-v="rand"]');
  var d = A.kqState.drill;
  ok(d && d.queue.length === 5, '5問ずつ');
  var q1 = A.kqQ(d.queue[0]);
  eq(q1.f, 'hisshu', '分野でしぼる');
  ok(/出典：くらしの手帳の練習問題（教科書で確かめて）/.test(text(A)), '答える前にも出典');
  click(A, '[data-act="kq-pick"][data-i="' + q1.a[0] + '"]');
  var l1 = A.S.kqLog[q1.id];
  ok(l1 && l1.res === 1 && l1.n >= 1, '正解が記録される');
  eq(l1.last, A.today(), '答えた日');
  eq(l1.due, A.shiftDate(A.today(), 3), '正解したら3日後にまた出す');
  ok(/正解！/.test(text(A)) && /解説/.test(text(A)), '正解と解説が出る');
  click(A, '[data-act="kq-next"]');
  var q2 = A.kqQ(A.kqState.drill.queue[1]);
  var wrong = [0, 1, 2, 3].filter(function(i){ return q2.a.indexOf(i) < 0; })[0];
  click(A, '[data-act="kq-pick"][data-i="' + wrong + '"]');
  var l2 = A.S.kqLog[q2.id];
  eq(l2.res, 0, 'まちがいが記録される');
  eq(l2.due, A.shiftDate(A.today(), 1), 'まちがえたら次の日にまた出す');
  ok(/ざんねん/.test(text(A)), '不正解の表示');
  ok(A.kqPool('hisshu', 'miss').some(function(q){ return q.id === q2.id; }), '「まちがえた問題」に入る');
  ok(!A.kqPool('hisshu', 'new').some(function(q){ return q.id === q1.id || q.id === q2.id; }), '「まだの問題」からは外れる');
  eq(A.kqDayCount(A.today()).n, before + 2, '今日といた数');
  /* 暗記カードにする */
  var n0 = A.S.cards.length;
  click(A, '[data-act="kq-card"]');
  eq(A.S.cards.length, n0 + 1, '暗記カードにする');
  var card = A.S.cards[A.S.cards.length - 1];
  ok(/^国試・必修$/.test(card.deck) && /正解/.test(card.a) && /出典/.test(card.a), 'カードの中身');
  click(A, '[data-act="kq-quit"]');
  ok(!A.kqState.drill, 'やめる');
  await KT.settle([A, B]);
  ok(B.S.kqLog[q1.id] && B.S.kqLog[q1.id].res === 1, '正解の記録が相手に届く');
  ok(B.S.kqLog[q2.id] && B.S.kqLog[q2.id].res === 0, 'まちがいの記録が相手に届く');
  eq(B.kqDayCount(B.today()).n, before + 2, '相手の端末でも、今日といた数');
  open(B, 'kq-drill');
  ok(/必修/.test(text(B)) && /回正解/.test(text(B)), '相手の端末でも正答率が出る');
  /* 最後まで解くと結果の画面 */
  A.kqStart('rand', [q2.id]);
  click(A, '[data-act="kq-pick"][data-i="' + q2.a[0] + '"]');
  click(A, '[data-act="kq-next"]');
  ok(A.kqState.drill.end && /おつかれさま/.test(text(A)), '結果の画面');
  eq(A.S.kqLog[q2.id].res, 1, 'もう一度といて正解');
  click(A, '[data-act="kq-quit"]');
  cleanCards(A); A.commit();
  await KT.settle([A, B]);
  resetState(A);
});

KT.test('国試：写真→AI→選んで追加・AIに作らせる・手で入力（にせAI）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  resetState(A);
  var n0 = A.S.kqs.length;
  A.kqState.add = 'photo';
  open(A, 'kq-drill');
  ok(/患者さんの情報が写っているものは読みこまないで/.test(text(A)), 'AIに送る前の注意書き');
  var pv = await A.kqPhotoRead([img(300, 200)], '問題集p.10');
  ok(pv && pv.items.length === 3, '正しい形の問題だけ：' + (pv && pv.items.length));
  var req = KT.aiCalls.filter(function(c){ return c.tag === 'kq-photo'; }).pop();
  ok(req.contents[0].parts.some(function(p){ return p.inline_data && /image/.test(p.inline_data.mime_type); }), '写真をAIに送る');
  eq(pv.items[0].c[0], '患者に触れる前', '選択肢の番号はとる');
  eq(pv.items[1].f, 'kiso', '分野の名前から分野を決める');
  eq(pv.items[1].a.join(','), '0,2', '2つ選ぶ問題');
  eq(A.S.kqs.length, n0, '見て選ぶまで追加しない');
  A.render();
  eq(doc.querySelectorAll('.kq-pv').length, 3, '読みとった問題が出る');
  ok(/写真：問題集p\.10/.test(text(A)), '写真の出典');
  ok(/正解はAIが考えたもの/.test(text(A)), '正解をAIが考えたときの注意');
  click(A, '[data-act="kq-pv-toggle"][data-i="2"]');
  eq(A.kqState.preview.items[2].on, 0, 'チェックを外す');
  click(A, '[data-act="kq-pv-add"]');
  eq(A.S.kqs.length, n0 + 2, 'チェックしたものだけ追加');
  var added = A.S.kqs.slice(-2);
  eq(added[0].src, '写真：問題集p.10', '写真の出典が残る');
  ok(/AIが推定/.test(added[1].src), 'AIが考えた正解は出典にも書く');
  ok(added.every(function(x){ return x.id && x.mt && x.kind === 'photo'; }), 'id・mt・種類');
  /* AIに作らせる */
  var pv2 = await A.kqMakeAi('bosei', 3, '産褥');
  ok(pv2 && pv2.items.length === 2, 'AIの問題');
  var req2 = KT.aiCalls.filter(function(c){ return c.tag === 'kq-make'; }).pop();
  ok(/母性看護学/.test(req2.contents[0].parts[0].text) && /産褥/.test(req2.contents[0].parts[0].text), '分野とテーマをAIに伝える');
  A.render();
  ok(/AIが作成（教科書で確かめて）/.test(text(A)), 'AIの問題の出典');
  eq(A.kqPreviewAdd(), 2, 'AIの問題を追加');
  var ai = A.S.kqs.slice(-2);
  ok(ai.every(function(x){ return x.field === 'bosei' && x.src === 'AIが作成（教科書で確かめて）' && x.kind === 'ai'; }), 'AIの問題の分野と出典');
  /* 手で入力 */
  A.kqState.add = 'hand'; A.render();
  typeIn(A, 'kq_af', 'seishin');
  typeIn(A, 'kq_aq', '手で入れた問題：防衛機制のうち昇華はどれか。');
  typeIn(A, 'kq_ac0', '不満を別の形で満たす'); typeIn(A, 'kq_ac1', 'スポーツで攻撃性を発散する'); typeIn(A, 'kq_ac2', '幼いころにもどる');
  typeIn(A, 'kq_ak1', true);
  typeIn(A, 'kq_as', '精神看護学の小テスト');
  A.render();
  eq(doc.getElementById('kq_aq').value, '手で入れた問題：防衛機制のうち昇華はどれか。', '描き直しても打った字が消えない');
  ok(doc.getElementById('kq_ak1').checked, '描き直してもチェックが消えない');
  click(A, '[data-act="kq-add-save"]');
  var hand = A.S.kqs[A.S.kqs.length - 1];
  ok(/手で入れた問題/.test(hand.q), '手で入れた問題');
  eq(hand.field, 'seishin', '分野');
  eq(hand.choices.length, 3, '空の選択肢は使わない');
  eq(hand.ans.join(','), '1', '正解');
  eq(hand.src, '自分で入力：精神看護学の小テスト', '手で入れた出典');
  /* 自分の問題も解ける */
  A.kqStart('rand', [hand.id]);
  click(A, '[data-act="kq-pick"][data-i="1"]');
  eq(A.S.kqLog[hand.id].res, 1, '自分の問題も記録される');
  ok(/自分で入力：精神看護学の小テスト/.test(text(A)), '自分の問題の出典');
  click(A, '[data-act="kq-quit"]');
  await KT.settle([A, B]);
  eq(B.S.kqs.length, A.S.kqs.length, '自分の問題が相手に届く');
  ok(B.kqAllQs().some(function(q){ return q.id === hand.id; }), '相手の端末でも解ける');
  A.S.kqs.slice(n0).forEach(function(x){ A.removeItem('kqs', x.id); });
  A.commit();
  await KT.settle([A, B]);
  eq(B.S.kqs.length, n0, '消すと相手でも消える');
  resetState(A);
});

KT.test('国試：AIの問題の選択肢（数字の選択肢はけずらない・空の選択肢で正解がずれない）', async function(){
  var A = KT.frames().A;
  var r = A.kqCleanQs([
    { q:'数字の選択肢', choices:['20.0', '22.5', '25.0', '27.5'], ans:[3] },
    { q:'回数の選択肢', choices:['12〜20回/分', '120回/分', '1.5L', '60歳以上'], ans:'2' },
    { q:'番号つき', choices:['①あ', '(2) い', '3）う', '4. え', '5．お'], ans:['⑤'] },
    { q:'空の選択肢がある', choices:['あ', '', 'う', 'え'], ans:[3] },
    { q:'全角の番号', choices:['あ', 'い', 'う', 'え'], ans:['１と３'] }
  ], 'kiso');
  eq(r.length, 5, '5問とも使える');
  eq(r[0].c.join('/'), '20.0/22.5/25.0/27.5', '数字だけの選択肢をけずらない');
  eq(r[0].a.join(','), '2', '数字の選択肢の正解');
  eq(r[1].c.join('/'), '12〜20回/分/120回/分/1.5L/60歳以上', '数字ではじまる選択肢をけずらない');
  eq(r[2].c.join('/'), 'あ/い/う/え/お', '選択肢の頭の番号だけとる');
  eq(r[2].a.join(','), '4', '①〜⑤の正解');
  eq(r[3].c.join('/'), 'あ/う/え', '空の選択肢は使わない');
  eq(r[3].c[r[3].a[0]], 'う', '空の選択肢を捨てても正解がずれない');
  eq(r[4].a.join(','), '0,2', '全角の数字・「1と3」');
});

KT.test('国試：AIの解説に、患者さんのことが書いてあるメモは送らない', async function(){
  var A = KT.frames().A;
  var now = Date.now();
  A.S.notes.push(J(A, { id:'nt_kqsec1', title:'バイタルのまとめ', body:'成人の脈拍数の基準は60〜100回/分。頻脈と徐脈。', pinned:0, checks:[], photos:[], link:null, ct:now, mt:now }));
  A.S.notes.push(J(A, { id:'nt_kqsec2', title:'実習記録', body:'受け持ちの患者さんの脈拍数は110回/分で頻脈。成人の脈拍数の基準は60〜100回/分。', pinned:0, checks:[], photos:[], link:null, ct:now, mt:now }));
  var rel = A.kqRelated('成人の安静時の脈拍数の基準範囲 頻脈 徐脈');
  ok(rel.some(function(r){ return r.title === 'メモ「バイタルのまとめ」'; }), 'ふつうのメモは使う');
  ok(!rel.some(function(r){ return r.title === 'メモ「実習記録」'; }), '患者さんのメモは使わない');
  A.S.notes = A.S.notes.filter(function(n){ return n.id !== 'nt_kqsec1' && n.id !== 'nt_kqsec2'; });
  A.persist();
});

KT.test('国試：AIの解説は、手帳のメモを出典として示す', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  KT.freshWrites([A, B]);
  resetState(A);
  A.S.notes.push(J(A, { id:'nt_kqtest', title:'バイタルの講義メモ', body:'成人の脈拍数の基準は60〜100回/分。頻脈と徐脈の定義も覚える。', pinned:0, checks:[], photos:[], link:null, ct:Date.now(), mt:Date.now() }));
  var q = A.kqBuiltinQs().filter(function(x){ return /脈拍数/.test(x.q); })[0];
  ok(q, '脈拍の問題');
  var rel = A.kqRelated(q.q + ' ' + q.c.join(' ') + ' ' + q.e);
  ok(rel.some(function(r){ return r.title === 'メモ「バイタルの講義メモ」'; }), '関係するメモを見つける');
  var it = await A.kqAiExplain(q.id);
  ok(it && it.text === 'くわしい解説です。', 'AIの解説');
  eq(it.sources.join(','), 'メモ「バイタルの講義メモ」', '手帳にないメモは出典にしない');
  eq(it.mod + '/' + it.type, 'kokushi/exp', 'kmItems に置く');
  var req = KT.aiCalls.filter(function(c){ return c.tag === 'kq-exp'; }).pop();
  var ptxt = req.contents[0].parts.map(function(p){ return p.text || ''; }).join('');
  ok(/バイタルの講義メモ/.test(ptxt) && /sources/.test(ptxt), 'メモの題名を出典として示すように頼む');
  A.kqState.drill = { mode:'rand', queue:[q.id], pos:0, picked:[q.a[0]], judged:true, last:true, ok:1, done:1, wrong:[] };
  open(A, 'kq-drill');
  ok(/手帳の中の出典：メモ「バイタルの講義メモ」/.test(text(A)), '画面に手帳の中の出典');
  ok(/出典：AIが作成（教科書で確かめて）/.test(text(A)), 'AIの出典');
  var it2 = await A.kqAiExplain(q.id);
  eq(A.S.kmItems.filter(function(x){ return x.type === 'exp' && x.qid === q.id; }).length, 1, 'もう一度頼むと入れかえる');
  await KT.settle([A, B]);
  ok(B.S.kmItems.some(function(x){ return x.id === it2.id; }), 'AIの解説も相手に届く');
  A.removeItem('kmItems', it2.id);
  A.S.notes = A.S.notes.filter(function(n){ return n.id !== 'nt_kqtest'; }); A.removeItem('notes', 'nt_kqtest');
  A.commit();
  await KT.settle([A, B]);
  resetState(A);
});

KT.test('国試：解剖の穴うめを作って解く（タップ・ドラッグで穴・AIで穴・クイズ・相手に届く）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  resetState(A);
  open(A, 'kq-anat');
  ok(/心臓の血液の流れ/.test(text(A)) && /肺循環と体循環/.test(text(A)), 'はじめからある図');
  await A.kqAnatCreate(img(400, 300), '心臓の図（テスト）');
  ok(A.kqState.anatEdit, '作る画面');
  await KT.until(function(){ var im = doc.querySelector('.kq-anatedit img'); return im && im.complete && im.naturalWidth > 0; }, 6000, '写真が出る');
  var pt = function(type, x, y){
    var box = doc.querySelector('.kq-anatedit'), r = box.getBoundingClientRect();
    box.dispatchEvent(new A.PointerEvent(type, { bubbles:true, cancelable:true, clientX:r.left + r.width * x, clientY:r.top + r.height * y, pointerId:7, isPrimary:true }));
  };
  pt('pointerdown', 0.3, 0.3); pt('pointerup', 0.3, 0.3);
  var hs = A.kqState.anatEdit.holes;
  eq(hs.length, 1, 'タップで穴ができる');
  ok(Math.abs(hs[0].x - 0.2) < 0.01 && Math.abs(hs[0].w - 0.2) < 0.01, 'タップした所に穴：' + JSON.stringify(hs[0]));
  pt('pointerdown', 0.5, 0.5); pt('pointermove', 0.8, 0.7); pt('pointerup', 0.8, 0.7);
  hs = A.kqState.anatEdit.holes;
  eq(hs.length, 2, 'ドラッグで穴ができる');
  ok(Math.abs(hs[1].x - 0.5) < 0.01 && Math.abs(hs[1].w - 0.3) < 0.01 && Math.abs(hs[1].h - 0.2) < 0.01, 'ドラッグした大きさ：' + JSON.stringify(hs[1]));
  /* 穴を動かす */
  var hole = doc.querySelector('[data-kqhole="0"]'), hr = hole.getBoundingClientRect(), br = doc.querySelector('.kq-anatedit').getBoundingClientRect();
  var cx = (hr.left + hr.width / 2 - br.left) / br.width, cy = (hr.top + hr.height / 2 - br.top) / br.height;
  var mv = function(type, x, y){ hole = doc.querySelector('[data-kqhole="0"]'); hole.dispatchEvent(new A.PointerEvent(type, { bubbles:true, cancelable:true, clientX:br.left + br.width * x, clientY:br.top + br.height * y, pointerId:8, isPrimary:true })); };
  mv('pointerdown', cx, cy); mv('pointermove', cx + 0.1, cy); mv('pointerup', cx + 0.1, cy);
  ok(Math.abs(A.kqState.anatEdit.holes[0].x - 0.3) < 0.02, '穴をドラッグで動かせる：' + A.kqState.anatEdit.holes[0].x);
  eq(A.kqState.anatEdit.holes.length, 2, '動かしても穴はふえない');
  typeIn(A, 'kq_anh0', '右心房'); typeIn(A, 'kq_anh1', '右心室');
  await A.kqAnatAi();
  hs = A.kqState.anatEdit.holes;
  eq(hs.length, 4, 'AIで穴を足す（名前のないもの・形のおかしいものは入れない）');
  eq(hs[2].ans, '左心室', 'AIのラベルの名前');
  ok(Math.abs(hs[2].x - 0.592) < 0.01 && Math.abs(hs[2].y - 0.494) < 0.01, 'AIの場所を割合に直す：' + JSON.stringify(hs[2]));
  eq(hs[0].ans, '右心房', 'AIを使っても打った答えは消えない');
  var req = KT.aiCalls.filter(function(c){ return c.tag === 'kq-anat'; }).pop();
  ok(req.contents[0].parts.some(function(p){ return p.inline_data; }) && /box_2d/.test(req.contents[0].parts[1].text), '写真と、場所をJSONで返す頼み方');
  click(A, '[data-act="kq-anat-save"]');
  eq(A.S.anatomy.length, 1, '図が保存される');
  var it = A.S.anatomy[0];
  eq(it.holes.length, 4, '穴が4つ');
  eq(it.src, '写真：心臓の図（テスト）', '写真の出典');
  ok(typeof it.img === 'string' && !/^data:/.test(it.img), '写真そのものは S に入れない（写真の入れものに置く）');
  ok(it.id && it.mt, 'id と mt');
  ok(!A.kqState.anatEdit, '保存したら閉じる');
  /* めくる */
  click(A, '[data-act="kq-anat-open"][data-id="' + it.id + '"]');
  ok(doc.querySelectorAll('.kq-anatbox .kq-hole').length === 4, '穴がかくれている');
  click(A, '[data-act="kq-anat-flip"][data-i="0"]');
  ok(doc.querySelector('.kq-hole.open') && /右心房/.test(text(A)), 'タップでめくれる');
  /* 名前を当てる */
  click(A, '[data-act="kq-anat-mode"][data-v="guess"]');
  for(var k = 0; k < 4; k++){
    var z = A.kqState.anat, ans = it.holes[z.order[z.pos]].ans;
    click(A, '[data-act="kq-anat-ans"][data-k="' + z.opts.indexOf(ans) + '"]');
    click(A, '[data-act="kq-anat-next"]');
  }
  ok(A.kqState.anat.end && /4こ中 4こ 正解/.test(text(A)), '結果');
  eq(A.S.kmData['kokushi:anat'][it.id].ok, 4, '結果を覚える');
  ok(A.S.kmData['kokushi:anat'].mt > 0, '結果に時刻（同期で新しい方が残る）');
  await KT.settle([A, B]);
  ok(B.S.anatomy.some(function(x){ return x.id === it.id && x.holes.length === 4; }), '図が相手に届く');
  ok(B.S.kmData['kokushi:anat'] && B.S.kmData['kokushi:anat'][it.id], '結果が相手に届く');
  /* はじめからある図のクイズ */
  A.kqAnatStart('kqa-heart', 'guess'); A.render();
  eq(doc.querySelectorAll('.kq-anatbox .kq-hole').length, 13, '心臓の図の穴');
  ok(doc.querySelector('.kq-anatbox svg') && doc.querySelector('.kq-hole.cur'), '図と、当てる穴');
  ok(/出典：くらしの手帳の図/.test(text(A)), '図の出典');
  /* 直す */
  A.kqState.anat = null;
  A.kqAction('kq-anat-edit', { dataset:{ id:it.id } });
  ok(A.kqState.anatEdit && A.kqState.anatEdit.holes.length === 4, '直す画面');
  click(A, '[data-act="kq-anat-hdel"][data-i="3"]');
  click(A, '[data-act="kq-anat-save"]');
  eq(A.S.anatomy[0].holes.length, 3, '穴を消して保存');
  A.removeItem('anatomy', it.id); A.commit();
  await KT.settle([A, B]);
  resetState(A);
});

KT.test('国試：看護技術の手順チェックと練習の記録・写真から自分の手順（相手に届く）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  resetState(A);
  open(A, 'kq-skill');
  ok(doc.querySelectorAll('.kq-srow').length >= 15, '15技術以上');
  ok(/学校で習った手順を優先/.test(text(A)), '学校の手順を優先するよう書く');
  click(A, '[data-act="kq-skill-open"][data-id="handwash"]');
  var sk = A.kqSkillGet('handwash');
  ok(sk && doc.querySelectorAll('.kq-step').length === sk.steps.length, '手順が出る');
  ok(/出典：くらしの手帳の手順の例/.test(text(A)), '手順の出典');
  click(A, '[data-act="kq-skill-why"][data-i="0"]');
  ok(doc.querySelector('.kq-step.why'), '根拠を開ける');
  click(A, '[data-act="kq-skill-run"]');
  ok(doc.getElementById('kq_timer'), '時間を計る');
  var boxes = doc.querySelectorAll('[data-act="kq-skill-chk"]');
  for(var i = 0; i < boxes.length - 2; i++) boxes[i].click();
  eq(doc.querySelectorAll('.kq-step.on').length, sk.steps.length - 2, 'チェックした手順');
  A.kqState.skillRun.start -= 65000;
  var m0 = A.S.kmItems.length;
  click(A, '[data-act="kq-skill-done"]');
  eq(A.S.kmItems.length, m0 + 1, '練習が記録される');
  var rec = A.S.kmItems[A.S.kmItems.length - 1];
  eq(rec.mod + '/' + rec.type + '/' + rec.skill, 'kokushi/skill/handwash', '記録の種類');
  eq(rec.done, sk.steps.length - 2, 'できた手順の数');
  eq(rec.miss.length, 2, 'できなかった手順');
  ok(rec.sec >= 65 && rec.sec < 90, 'かかった時間：' + rec.sec);
  ok(/練習の記録/.test(text(A)) && /よく抜ける手順/.test(text(A)), '記録が出る');
  ok(!A.kqState.skillRun, '練習がおわる');
  var ad = A.aiSectionData('study', {});
  ok(ad.kokushi_skills && ad.kokushi_skills.practice.some(function(p){ return p.times >= 1 && p.oftenMissed.length; }), 'AIが練習の記録を読める');
  /* 写真から自分の手順 */
  A.kqState.skill = '';
  var pv = await A.kqSkillPhotoRead([img(300, 400)], '手順書p.5');
  ok(pv && pv.steps.length === 3, '写真から手順を読む');
  open(A, 'kq-skill');
  ok(/写真から読みとった手順/.test(text(A)) && /AIが補足/.test(text(A)), '見て選ぶ画面');
  click(A, '[data-act="kq-spv-toggle"][data-i="2"]');
  click(A, '[data-act="kq-spv-add"]');
  var my = A.S.kmItems.filter(function(x){ return x.mod === 'kokushi' && x.type === 'myskill'; }).pop();
  ok(my && my.steps.length === 2, 'チェックした手順だけ');
  eq(my.src, '写真：手順書p.5', '写真の出典');
  eq(my.name, '輸液ポンプの準備', '技術の名前');
  eq(A.kqState.skill, my.id, '足した手順を開く');
  ok(/輸液ポンプの準備/.test(text(A)), '自分の手順が出る');
  /* 手で書く */
  A.kqState.skill = ''; A.kqState.skillAdd = true; A.render();
  typeIn(A, 'kq_smn', '自分の手順（テスト）');
  typeIn(A, 'kq_sms', '手指衛生をする｜感染を防ぐため\n説明して同意を得る');
  click(A, '[data-act="kq-skill-hand"]');
  var my2 = A.S.kmItems.filter(function(x){ return x.type === 'myskill'; }).pop();
  eq(my2.steps.length, 2, '1行に1つ');
  eq(my2.steps[0].w, '感染を防ぐため', '「｜」のあとが根拠');
  await KT.settle([A, B]);
  ok(B.S.kmItems.some(function(x){ return x.id === rec.id; }), '練習の記録が相手に届く');
  ok(B.kqSkillsOwn().some(function(s){ return s.id === my.id; }), '自分の手順が相手に届く');
  [rec.id, my.id, my2.id].forEach(function(id){ A.removeItem('kmItems', id); });
  A.commit();
  await KT.settle([A, B]);
  resetState(A);
});

KT.test('国試：Wikipediaで用語をしらべる（にせAPI・出典と注意書き）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  resetState(A);
  A.kqState.dictQ = 'せん妄';
  open(A, 'kq-dict');
  click(A, '.kq-wikibtn');
  await KT.until(function(){ return A.kqState.wiki && A.kqState.wiki.state !== 'loading'; }, 5000, 'Wikipediaの読みこみ');
  eq(A.kqState.wiki.state, 'ok', '読みこめた');
  A.render();
  ok(/せん妄は、テストの要約です/.test(text(A)), '要約が出る');
  var a = doc.querySelector('.kq-wiki .kq-src a');
  ok(a && /^https:\/\/ja\.wikipedia\.org\/wiki\//.test(a.getAttribute('href')) && /Wikipedia「せん妄」/.test(a.textContent), '出典のリンク');
  ok(/医学的な正確さは教科書で確かめて/.test(text(A)), '注意書き');
  click(A, '[data-act="kq-wiki-add"]');
  var ab = A.S.abbrs.filter(function(x){ return /^Wikipedia/.test(x.src); })[0];
  ok(ab && ab.abbr === 'せん妄' && /^https:\/\/ja\.wikipedia\.org\//.test(ab.url), '辞書に足すと出典も残る');
  var n0 = A.S.cards.length;
  click(A, '[data-act="kq-wiki-card"]');
  eq(A.S.cards.length, n0 + 1, '暗記カードにする');
  ok(/Wikipedia/.test(A.S.cards[A.S.cards.length - 1].a), 'カードにも出典');
  await A.kqWikiLoad('ないことば');
  eq(A.kqState.wiki.state, 'ng', '見つからないとき');
  A.render();
  ok(/見つかりませんでした/.test(text(A)), '見つからないと伝える');
  await KT.settle([A, B]);
  ok(B.S.abbrs.some(function(x){ return x.id === ab.id; }), '相手に届く');
  A.removeItem('abbrs', ab.id); cleanCards(A); A.commit();
  await KT.settle([A, B]);
  resetState(A);
});

KT.test('国試：基準値の早見表とクイズ・薬のカード（めくる・ハイリスク）・暗記カードにする', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  resetState(A);
  open(A, 'kq-lab');
  ok(/目安/.test(text(A)) && /少しちがいます/.test(text(A)), '目安の注意書き');
  ok(/出典：くらしの手帳の基準値表/.test(text(A)), '基準値の出典');
  var all = doc.querySelectorAll('#kq_lres .kq-lrow').length;
  typeIn(A, 'kq_lq', 'カリウム');
  var n = doc.querySelectorAll('#kq_lres .kq-lrow').length;
  ok(n >= 1 && n < all && /カリウム/.test(doc.getElementById('kq_lres').textContent), 'ことばでさがす');
  typeIn(A, 'kq_lq', '');
  click(A, '[data-act="kq-lab-cat"][data-v="' + A.kqLabCats()[0] + '"]');
  ok(A.kqLabFilter().every(function(o){ return o.cat === A.kqLabCats()[0]; }), '分類でしぼる');
  click(A, '[data-act="kq-lab-cat"][data-v=""]');
  click(A, '[data-act="kq-lab-quiz"]');
  var z = A.kqState.labQuiz;
  ok(z && z.opts.length === 4 && z.opts.indexOf(z.i) >= 0, 'クイズの選択肢');
  var vals = z.opts.map(function(i){ return A.kqLabValue(A.kqLabs()[i]); });
  eq(vals.filter(function(v, i){ return vals.indexOf(v) === i; }).length, 4, '選択肢の値が重ならない');
  click(A, '[data-act="kq-lab-ans"][data-i="' + z.i + '"]');
  eq(A.kqState.labQuiz.ok, 1, '正解を数える');
  ok(/正解！/.test(text(A)), '正解の表示');
  var c0 = A.S.cards.length;
  click(A, '[data-act="kq-lab-card"]');
  eq(A.S.cards.length, c0 + 1, '基準値を暗記カードに');
  eq(A.S.cards[A.S.cards.length - 1].deck, '基準値', '基準値のまとまり');
  /* 薬 */
  open(A, 'kq-drug');
  ok(/添付文書・教科書・薬剤部の資料で確かめて/.test(text(A)), '薬の注意書き');
  typeIn(A, 'kq_gq', 'ワルファリン');
  ok(/ワルファリン/.test(doc.getElementById('kq_gres').textContent), '薬をさがす');
  typeIn(A, 'kq_gq', '');
  click(A, '[data-act="kq-drug-hi"]');
  ok(A.kqDrugFilter().length && A.kqDrugFilter().every(function(o){ return o.hi; }), 'ハイリスク薬だけ');
  click(A, '[data-act="kq-drug-hi"]');
  click(A, '[data-act="kq-drug-open"]');
  ok(/はたらき/.test(text(A)) && /主な副作用/.test(text(A)) && /看護で気をつけること/.test(text(A)) && /出典：くらしの手帳の薬のカード/.test(text(A)), '薬のくわしい中身と出典');
  click(A, '[data-act="kq-drug-flip"]');
  ok(A.kqState.drugFlip && !A.kqState.drugFlip.show, 'めくって覚える');
  click(A, '[data-act="kq-drug-show"]');
  ok(A.kqState.drugFlip.show && /主な副作用/.test(text(A)), 'めくる');
  click(A, '[data-act="kq-drug-move"][data-v="1"]');
  eq(A.kqState.drugFlip.pos, 1, 'つぎへ');
  click(A, '[data-act="kq-drug-move"][data-v="-1"]');
  eq(A.kqState.drugFlip.pos, 0, 'まえへ');
  var c1 = A.S.cards.length;
  click(A, '[data-act="kq-drug-card"]');
  eq(A.S.cards.length, c1 + 2, '薬は2枚のカードに');
  click(A, '[data-act="kq-drug-flip-end"]');
  await KT.settle([A, B]);
  eq(B.S.cards.filter(function(c){ return c.src === 'kokushi'; }).length, A.S.cards.filter(function(c){ return c.src === 'kokushi'; }).length, 'カードが相手に届く');
  cleanCards(A); A.commit();
  await KT.settle([A, B]);
  resetState(A);
});

KT.test('国試：AIが読める（分野ごとの正答率・苦手）・AIの道具・全体検索・今日の1問', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  KT.freshWrites([A, B]);
  resetState(A);
  var r = A.aiSectionData('kokushi', {});
  ok(r.kokushi_stats && r.kokushi_stats.fields.length === 12, 'AIが分野ごとの正答率を読める');
  ok(r.kokushi_stats.questions.builtin >= 60 && 'weakFields' in r.kokushi_stats && 'todayAnswered' in r.kokushi_stats, '苦手分野・今日といた数');
  var s = A.aiSectionData('study', {});
  ok(s.kokushi_tools && s.kokushi_tools.builtin.dictionary >= 200, 'AIが道具の中身の数を読める');
  ok(!r.kokushi_tools, '分野ごとに分ける');
  var tool = function(nm){ return A.KM.chatTools.filter(function(x){ return x.decl.name === nm; })[0]; };
  var look = JSON.parse(tool('kokushi_lookup').run({ query:'ADL' }).result);
  ok(look.results.some(function(x){ return x.abbr === 'ADL' && /用語集/.test(x.source); }), '略語をしらべる道具（出典つき）');
  var look2 = JSON.parse(tool('kokushi_lookup').run({ query:'ワルファリン', kind:'drug' }).result);
  ok(look2.results.length && look2.results.every(function(x){ return x.kind === '薬'; }), '薬をしらべる道具');
  var look3 = JSON.parse(tool('kokushi_lookup').run({ query:'血圧測定', kind:'skill' }).result);
  ok(look3.results.length && look3.results[0].steps.length >= 5, '手順をしらべる道具');
  var qz = JSON.parse(tool('kokushi_quiz').run({ field:'必修' }).result);
  ok(qz.field === '必修' && qz.choices.length === 4 && qz.answer.length && qz.source, '問題を出す道具');
  ok(!tool('kokushi_quiz').write && !tool('kokushi_lookup').write, '読むだけの道具');
  /* 全体検索 */
  var hits = A.kqSearch('ADL');
  var h = hits.filter(function(x){ return x.kind === '略語・用語'; })[0];
  ok(h && h.act === 'kq-go' && h.attrs['data-tool'] === 'kq-dict', '全体検索に辞書が出る');
  ok(A.KM.search.indexOf(A.kqSearch) >= 0, '全体検索に登録');
  ok(A.kqSearch('カリウム').some(function(x){ return x.kind === '基準値'; }), '全体検索に基準値');
  ok(A.kqSearch('ワルファリン').some(function(x){ return x.kind === '薬'; }), '全体検索に薬');
  ok(A.kqSearch('手洗い').some(function(x){ return x.kind === '看護技術の手順'; }), '全体検索に手順');
  ok(A.kqSearch('脈拍数').some(function(x){ return x.kind === '国試の問題'; }), '全体検索に問題');
  var b = doc.createElement('button');
  b.setAttribute('data-act', h.act);
  Object.keys(h.attrs).forEach(function(k){ b.setAttribute(k, h.attrs[k]); });
  A.appId = 'today'; A.render();
  doc.getElementById('app').appendChild(b);
  b.click();
  ok(A.appId === 'study' && A.studyTool === 'kq-dict' && A.kqState.dictQ === 'ADL', '検索の結果から開ける');
  ok(/日常生活動作/.test(text(A)), '開くと中身が出る');
  /* 今日の1問 */
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  var q = A.kqDailyQ(A.today());
  ok(doc.querySelector('[data-act="kq-today"]'), '今日タブに今日の1問');
  eq(A.kqDailyQ(A.today()).id, q.id, '同じ日は同じ問題');
  var l = A.S.kqLog[q.id];
  if(!(l && l.last === A.today())){
    click(A, '[data-act="kq-today"][data-i="' + q.a[0] + '"]');
    eq(A.S.kqLog[q.id].res, 1, '今日の1問の答えも記録');
    ok(/正解！/.test(text(A)), '今日の1問の答え合わせ');
  }
  ok(/解説/.test(doc.querySelector('.tsec .kq-exp') ? doc.querySelector('.tsec .kq-exp').textContent : ''), '今日の1問の解説');
  A.kqAction('kq-set-today', { dataset:{} });
  eq(A.S.ui.kokushi.today, 0, '設定で消せる');
  A.render();
  ok(!doc.querySelector('[data-act="kq-today"]'), '消したら出ない');
  A.kqAction('kq-set-today', { dataset:{} });
  eq(A.S.ui.kokushi.today, 1, '設定で出せる');
  A.S.ui.setOpen = A.S.ui.setOpen || {}; A.S.ui.setOpen.kqset = 1;
  A.appId = 'set'; A.render();
  ok(doc.getElementById('kq_set_tf'), '設定の枠');
  typeIn(A, 'kq_set_tf', 'bosei');
  eq(A.S.ui.kokushi.todayField, 'bosei', '今日の1問の分野');
  eq(A.kqDailyQ(A.today()).f, 'bosei', '分野で選ぶ');
  typeIn(A, 'kq_set_tf', '');
  var sm = A.kmSummaryAdd({});
  ok(sm.kokushi && typeof sm.kokushi.today === 'number', 'まとめに入る');
  A.appId = 'today'; A.render();
  await KT.settle([A, B]);
  resetState(A);
});

KT.test('国試：表示するだけでは、中身（同期するもの）が変わらない（勉強①のすべての画面）', async function(){
  var A = KT.frames().A, B = KT.frames().B;
  await KT.settle([A, B]);
  resetState(A);
  A.S.ui.setOpen = A.S.ui.setOpen || {};
  var snap = function(){ var o = A.payloadCore(); delete o.notices; return A.canon(o) + '|' + A.canon(A.S.meta); };
  var before = snap();
  var st = A.kqState, errs = [];
  var q = A.kqBuiltinQs()[3], sk = A.kqSkillsBuiltin()[0];
  var pages = [
    function(){ A.appId = 'study'; A.studyTool = ''; },
    function(){ A.studyTool = 'kq-drill'; },
    function(){ st.add = 'hand'; }, function(){ st.add = 'photo'; }, function(){ st.add = 'make'; },
    function(){ st.preview = { kind:'photo', src:'写真：テスト', items:[{ f:'kiso', q:'問題', c:['あ', 'い'], a:[0], e:'解説', aiAns:1, on:1 }] }; },
    function(){ st.preview = null; st.add = ''; st.drill = { mode:'rand', queue:[q.id], pos:0, picked:[], judged:false, last:null, ok:0, done:0, wrong:[] }; },
    function(){ st.drill.picked = [0]; st.drill.judged = true; st.drill.last = false; },
    function(){ st.drill.end = true; st.drill.wrong = [q.id]; st.drill.done = 1; },
    function(){ st.drill = null; A.studyTool = 'kq-dict'; },
    function(){ st.dictQ = 'adl'; }, function(){ st.dictOpen = 'b0'; st.dictAdd = true; },
    function(){ st.wiki = { q:'x', state:'loading' }; }, function(){ st.wiki = { q:'x', state:'ng', msg:'だめ' }; },
    function(){ st.wiki = { q:'x', state:'ok', title:'x', desc:'', extract:'e', url:'https://ja.wikipedia.org/wiki/x', dis:true }; },
    function(){ A.studyTool = 'kq-lab'; }, function(){ st.labQ = 'k'; st.labCat = A.kqLabCats()[1]; },
    function(){ A.kqLabQuizNext(); }, function(){ st.labQuiz.picked = st.labQuiz.opts[0]; },
    function(){ A.studyTool = 'kq-drug'; }, function(){ st.drugOpen = 0; st.drugHi = true; st.drugQ = 'a'; },
    function(){ st.drugFlip = { order:[0, 1, 2], pos:1, show:false }; }, function(){ st.drugFlip.show = true; },
    function(){ A.studyTool = 'kq-anat'; },
    function(){ A.kqAnatStart('kqa-circ', 'flip'); st.anat.open = { 0:true }; },
    function(){ A.kqAnatStart('kqa-urine', 'guess'); }, function(){ st.anat.picked = st.anat.opts[0]; }, function(){ st.anat.end = true; },
    function(){ st.anat = null; st.anatEdit = { id:'an_x', isNew:1, title:'t', img:'an_none', holes:[{ x:0.1, y:0.1, w:0.2, h:0.1, ans:'a' }], sel:0 }; },
    function(){ st.anatEdit = null; A.studyTool = 'kq-skill'; },
    function(){ st.skillPv = { name:'n', src:'写真：s', steps:[{ s:'a', w:'b', ai:1, on:1 }] }; st.skillAdd = true; },
    function(){ st.skillPv = null; st.skill = sk.id; }, function(){ st.skillRun = { id:sk.id, start:Date.now() }; st.skillChk = { 0:true }; st.skillWhy = { 1:true }; },
    function(){ st.skillRun = null; st.skill = ''; A.appId = 'today'; A.todayTab = 'today'; },
    function(){ A.appId = 'set'; }
  ];
  pages.forEach(function(fn, i){
    try{ fn(); A.render(); }catch(e){ errs.push(i + '：' + e.message); }
  });
  ok(!errs.length, '表示できない画面：' + errs.join(' / '));
  A.persist();
  var after = snap();
  if(before !== after){
    var b0 = JSON.parse(before.split('|')[0]), a0 = JSON.parse(after.split('|')[0]);
    var diff = Object.keys(a0).filter(function(k){ return A.canon(a0[k]) !== A.canon(b0[k]); });
    throw new Error('表示しただけで変わった：' + (diff.join(',') || 'meta'));
  }
  resetState(A);
  A.appId = 'today'; A.todayTab = 'today'; A.render();
});
})();

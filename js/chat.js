/* くらしの手帳：そうだん（AI） */
/* ============================== そうだん（AIチャット） ============================== */
var chatBusy = false;
var chatRoom = 'main';
var chatAbort = null;
var chatFiles = [];   /* これから送る写真・ファイル */
/* いつも最新の発言が見えるように、下までスクロールする */
function chatScrollBottom(){
  setTimeout(function(){
    var b = document.getElementById('chatwrap');
    if(b) b.scrollTop = b.scrollHeight;
  }, 40);
  setTimeout(function(){
    var b2 = document.getElementById('chatwrap');
    if(b2) b2.scrollTop = b2.scrollHeight;
  }, 260);
}

/* 使った回数（無料枠の目安） */
var AI_FREE_LIMIT = 200;
function aiCountToday(){ return toNum((S.aiUse||{})[today()]); }
function aiCountAdd(){
  S.aiUse = S.aiUse || {};
  S.aiUse[today()] = aiCountToday() + 1;
  var keep = {};
  for(var i=0;i<30;i++) keep[shiftDate(today(), -i)] = 1;
  Object.keys(S.aiUse).forEach(function(k){ if(!keep[k]) delete S.aiUse[k]; });
  touch('aiUse');
}
/* 使えるモデル */
/* ===== 口調・長さ・書き方 ===== */
var AI_TONES = [
  { id:'friendly', name:'やさしい' },
  { id:'casual',   name:'ためぐち' },
  { id:'coach',    name:'はっぱをかける' },
  { id:'calm',     name:'たんたんと' }
];
function toneRule(){
  var t = S.ui.aiTone || 'friendly';
  if(t === 'casual') return '友だちのようなためぐち。「〜だよ」「〜しよ」。馴れ馴れしすぎない。';
  if(t === 'coach')  return '甘やかさない。先延ばしや言い訳には、はっきり指摘してから背中を押す。'+
    '「まだ手をつけてないでしょ」「今日やらないと詰むよ」のように事実をつきつけたうえで、'+
    '「ここまでやれば間に合う」と具体的な道を示す。けなすのではなく、本気で応援している人の言い方。'+
    '最後は必ず、今日できる小さな一歩で締める。';
  if(t === 'calm')   return 'たんたんと事実だけ。はげましや感想は書かない。';
  return 'ていねいでやわらかい。共感してから具体的な提案をする。';
}
function lenRule(){
  var l = S.ui.aiLen || 'auto';
  if(l === 'short') return '3行以内。要点だけ。';
  if(l === 'long')  return 'くわしく。理由や代わりの案も書く。';
  if(l === 'auto' && typeof lenRuleAuto === 'function') return lenRuleAuto();
  return 'ふつう。長くても10行くらい。';
}
function styleRule(){
  return (S.ui.aiStyle === 'text') ? '文章で書く。箇条書きは使わない。' : '箇条書きを活かす。';
}

var AI_MODELS = [
  ['',                      'おまかせ',  '使えるものを自動で選びます'],
  ['gemini-3.6-flash',      '3.6 Flash', '速さとかしこさのバランスがよい最新。ふだんはこれ'],
  ['gemini-3.5-flash',      '3.5 Flash', 'いちばんかしこい。こみ入った相談に'],
  ['gemini-3.5-flash-lite', '3.5 Lite',  'いちばん速くて軽い'],
  ['gemini-3.1-flash-lite', '3.1 Lite',  '軽いのに実力あり'],
  ['gemini-3.1-pro',        '3.1 Pro',   'とてもかしこい（お試し中）'],
  ['gemini-3-flash',        '3 Flash',   '軽くて実力あり（お試し中）']
];
function modelNote(id){
  var m = AI_MODELS.filter(function(x){ return x[0] === (id||''); })[0];
  return m ? m[2] : '';
}
/* 会話の部屋（科目ごとに分ける） */
function roomList(){
  S.chatMeta = S.chatMeta || {};
  var rooms = [['main','ぜんぶ']];
  /* 自分で作った会話 */
  Object.keys(S.chatMeta).sort(function(a,b){
    return toNum((S.chatMeta[b]||{}).mt) - toNum((S.chatMeta[a]||{}).mt);
  }).forEach(function(k){
    if(k === 'main') return;
    rooms.push([k, (S.chatMeta[k]||{}).name || '会話']);
  });
  return rooms;
}
/* 新しい会話をはじめる */
function roomNew(){
  var id = 'r' + Date.now().toString(36);
  S.chatMeta = S.chatMeta || {};
  var n = Object.keys(S.chatMeta).length + 1;
  S.chatMeta[id] = { name: '会話' + n, mt: Date.now() };
  S.chatRooms = S.chatRooms || {};
  S.chatRooms[id] = [];
  chatRoom = id;
  return id;
}
function roomMsgs(){
  if(chatRoom === 'main') return S.chat || [];
  S.chatRooms = S.chatRooms || {};
  return S.chatRooms[chatRoom] || [];
}
function roomSet(list){
  if(chatRoom === 'main') S.chat = list;
  else { S.chatRooms = S.chatRooms || {}; S.chatRooms[chatRoom] = list; }
}

/* アプリの中身を、AIが読める形にまとめる */
function chatContext(){
  var td = today();
  var lim = shiftDate(td, 45);
  var L = [];
  L.push('【今日】' + td + '（' + WDAY[new Date().getDay()] + '）　いまは' + pad(new Date().getHours()) + '時ごろ');
  L.push('【学期】' + curTerm().label);

  /* 時間割 */
  var tt = [];
  DAYS.forEach(function(d){
    var row = [];
    termCourses().forEach(function(c){
      c.slots.forEach(function(sl){
        if(sl.d === d) row.push(sl.p + '限 ' + c.name + (c.web ? '(遠隔)' : '') + (c.bi ? '(隔週)' : ''));
      });
    });
    row.sort();
    if(row.length) tt.push(d + '：' + row.join('、'));
  });
  L.push('【時間割】\n' + tt.join('\n'));
  L.push('【授業の時間】' + PERIODS.map(function(p){
    return p + '限 ' + S.commute.periods[p-1] + '〜' + S.commute.ends[p-1];
  }).join('、'));

  /* これからの予定 */
  var items = normItems().filter(function(x){
    return isYmd(x.date) && x.date >= td && x.date <= lim;
  }).sort(function(a,b){ return a.date.localeCompare(b.date); });
  var lines = items.map(function(x){
    var k = ({task:'課題', quiz:'小テスト', exam:'大テスト', kousa:'考査', work:'バイト', imp:'重要', other:'予定'})[x.src] || kindOf(x.src).name;
    var done = (x.src==='task' && x.done) ? '【済】' : '';
    var t = x.time ? ' ' + x.time : '';
    return '・' + x.date + t + ' [' + k + ']' + done + ' ' + x.title + (x.sub ? '（' + x.sub + '）' : '');
  });
  L.push('【これからの予定（45日ぶん）】\n' + (lines.length ? lines.join('\n') : 'なし'));

  /* 日ごとの状況（14日ぶん）：通学の有無・帰宅時刻・バイトに入れる時間を先に計算しておく */
  var days = [];
  for(var i = 0; i < 14; i++){
    var d = shiftDate(td, i);
    var a = d.split('-'), dow = WDAY[new Date(+a[0], +a[1]-1, +a[2]).getDay()];
    var cls = schoolClassesForDate(d);
    var allCls = classesForDate(d).filter(function(c){ return !c.off; });
    var web = allCls.filter(function(c){ return c.web; });
    var line = '・' + d + '（' + dow + '）';
    var dayItems = items.filter(function(x){ return x.date === d; });
    var shiftsHere = S.shifts.filter(function(w){ return w.date === d; });
    var tests = dayItems.filter(function(x){ return x.src==='quiz' || x.src==='exam' || x.src==='kousa'; });
    var dues = dayItems.filter(function(x){ return x.src==='task' && !x.done; });
    if(holidayName(d)) line += ' 祝日「' + holidayName(d) + '」';
    if(cls.length){
      var first = cls[0], last = cls[cls.length-1];
      var st = S.commute.periods[first.period-1], en = S.commute.ends[last.period-1];
      var enMin = minutesOf(en);
      var homeMin = enMin != null ? enMin + 20 + 80 : null;      /* 授業後20分＋通学80分 */
      var workFrom = enMin != null ? enMin + 20 + 75 : null;     /* 大学→イオンモール神戸北はおよそ75分 */
      line += ' 通学あり：' + first.period + '限〜' + last.period + '限（' + st + '〜' + en + '、' +
        cls.map(function(c){ return c.period + '限' + c.name; }).join('・') + '）。' +
        '帰宅はおよそ' + hhmmOf(homeMin) + '。バイトに入れるのは' + hhmmOf(workFrom) + '以降のみ。';
      if(web.length) line += ' このほか遠隔' + web.map(function(c){ return c.period + '限' + c.name; }).join('・') + '（家で受講）。';
    }else if(web.length){
      line += ' 通学なし（遠隔' + web.map(function(c){ return c.period + '限' + c.name; }).join('・') + 'のみ）。バイトは終日入れる。';
    }else{
      line += ' 通学なし。バイトは終日入れる。';
    }
    if(shiftsHere.length) line += ' すでにバイトあり：' + shiftsHere.map(function(w){ return (w.start||'') + '〜' + (w.end||''); }).join('、') + '。';
    if(tests.length) line += ' テスト：' + tests.map(function(x){ return x.title; }).join('、') + '。';
    if(dues.length) line += ' 課題の締切：' + dues.map(function(x){ return x.title + (x.time ? ' ' + x.time : ''); }).join('、') + '。';
    /* 翌日1限の有無（前夜の遅いバイトを避ける判断に） */
    var nx = shiftDate(d, 1), nxCls = schoolClassesForDate(nx);
    if(nxCls.length && nxCls[0].period === 1) line += ' 翌日は1限あり（朝が早い）。';
    days.push(line);
  }
  L.push('【日ごとの状況（今日から14日）】\n' + days.join('\n'));

  /* 休講・遠隔・補講 */
  var chg = S.holidays.filter(function(h){ return h.date >= td; }).map(function(h){
    return '・' + h.date + ' ' + (h.course==='*'?'全休':h.course) + ' ' +
      ({cancel:'休講', online:'遠隔', makeup:'補講', holclass:'祝日でも授業あり'})[changeType(h)];
  });
  if(chg.length) L.push('【授業の変更】\n' + chg.join('\n'));

  /* バイトとお金 */
  var ym = openYm(), pp = payPeriod(ym);
  var inPeriod = shiftsInPeriod(ym);
  L.push('【バイト】分給 平日' + S.settings.minWeekday + '円／土日' + S.settings.minWeekend + '円、交通費' + S.settings.fare + '円/回、' +
    '15日締め25日払い。いまの締め期間（' + pp.from + '〜' + pp.to + '）は' + inPeriod.length + '回、見込み' + periodPay(ym) + '円。');
  var y = new Date().getFullYear();
  var limF = toNum(S.settings.fuyouLimit)||1030000, totF = yearPayTotal(y);
  L.push('【扶養】' + y + '年の給与見込み合計 約' + totF + '円（上限 ' + limF + '円、残り 約' + Math.max(0, limF-totF) + '円）');
  var bal = S.balances.reduce(function(a,b){ return a + toNum(b.amount); }, 0);
  if(bal) L.push('【口座の残高】合計 約' + bal + '円');

  /* 出欠 */
  var att = termCourses().map(function(c){
    var a = attendOf(c.name);
    return (a.ab || a.late) ? ('・' + c.name + '：欠' + a.ab + '・遅' + a.late + '（あと' + Math.max(0, a.limit - a.ab) + '回で単位不可）') : '';
  }).filter(Boolean);
  if(att.length) L.push('【出欠】\n' + att.join('\n'));

  /* 通学 */
  if((S.aiMemo||[]).length) L.push('【覚えておくこと】\n' + S.aiMemo.map(function(m){ return '・' + m.text; }).join('\n'));
  if(chatRoom !== 'main') L.push('【いまの話題】' + chatRoom.slice(2) + ' のこと');

  /* ===== ここから、アプリの中にあるものを全部わたす ===== */

  /* 課題の中身（メモ・小分け・出し方） */
  var tkDetail = S.tasks.filter(function(t){ return !t.done && isYmd(t.due); })
    .sort(function(a,b){ return a.due.localeCompare(b.due); }).slice(0, 30)
    .map(function(t){
      var how = ({form:'Googleフォーム', classroom:'クラスルーム', other:(t.how2||'そのほか')})[t.how] || '';
      var subs = (t.subs||[]).map(function(x){ return (x.done?'済:':'')+x.text; }).join('／');
      return '・' + t.due + (t.time?' '+t.time:'') + ' ' + t.title +
        (t.subject?'（'+t.subject+'）':'') +
        (t.pri===2?' 【大事】':t.pri===0?' 【あとでOK】':'') +
        (how?' 出し方:'+how:'') + (t.url?' 提出先あり':'') +
        (subs?' 小分け:'+subs:'') + (t.memo?' メモ:'+t.memo.slice(0,60):'');
    });
  if(tkDetail.length) L.push('【課題のくわしい中身】\n' + tkDetail.join('\n'));

  /* テストの中身 */
  var exDetail = S.exams.filter(function(e){ return isYmd(e.date) && e.date >= td; })
    .sort(function(a,b){ return a.date.localeCompare(b.date); }).slice(0, 20)
    .map(function(e){
      var pr = toNum(S.progress[e.id]);
      return '・' + e.date + (e.time?' '+e.time:'') + ' ' + e.subject +
        '（' + (kindOf(e.kind).name) + '）' + (e.room?' 教室:'+e.room:'') +
        ' 準備の進み:' + pr + '/' + (toNum(S.ui.progScale)===3?3:4) +
        (e.memo?' メモ:'+e.memo.slice(0,60):'');
    });
  if(exDetail.length) L.push('【テストのくわしい中身】\n' + exDetail.join('\n'));

  /* 科目ごとの評価方法・シラバス */
  var syl = termCourses().map(function(c){
    var y2 = S.syllabus[c.name];
    if(!y2) return '';
    var parts = [];
    if(toNum(y2.exam)) parts.push('試験'+y2.exam+'%');
    if(toNum(y2.rep)) parts.push('レポート'+y2.rep+'%');
    if(toNum(y2.att)) parts.push('出席'+y2.att+'%');
    if(toNum(y2.other)) parts.push('その他'+y2.other+'%');
    return parts.length ? ('・' + c.name + '：' + parts.join('、')) : '';
  }).filter(Boolean);
  if(syl.length) L.push('【成績の付き方】\n' + syl.join('\n'));

  /* かかった時間の記録 */
  var logs = Object.keys(S.taskLog||{}).map(function(id){
    var t3 = S.tasks.filter(function(x){ return x.id === id; })[0];
    var mn = toNum((S.taskLog[id]||{}).min);
    return (t3 && mn) ? ('・' + t3.title + '：' + mn + '分') : '';
  }).filter(Boolean).slice(0, 15);
  if(logs.length) L.push('【課題にかかった時間】\n' + logs.join('\n'));

  /* メモ */
  var nt = (S.notes||[]).slice(0, 12).map(function(n){
    var ck = (n.checks||[]).map(function(c){ return (c.done?'済:':'')+c.text; }).join('／');
    return '・' + (n.pinned?'【ピン】':'') + (n.title||'（無題）') +
      (n.body?'：'+n.body.slice(0,80):'') + (ck?' やること:'+ck:'') +
      ((n.photos||[]).length?' 写真'+n.photos.length+'枚':'');
  });
  if(nt.length) L.push('【メモ】\n' + nt.join('\n'));

  /* 健康の記録 */
  var hl = (S.health||[]).filter(function(h){ return isYmd(h.date); })
    .sort(function(a,b){ return b.date.localeCompare(a.date); }).slice(0, 8)
    .map(function(h){ return '・' + h.date + ' ' + (h.title||h.kind||'') + (h.memo?'：'+h.memo.slice(0,40):''); });
  if(hl.length) L.push('【健康の記録】\n' + hl.join('\n'));

  /* お金のこまかいところ */
  var inc = (S.income||[]).map(function(i2){ return '・' + (i2.name||'収入') + ' ' + toNum(i2.amount) + '円'; });
  if(inc.length) L.push('【毎月の収入】\n' + inc.join('\n'));
  var fx = (S.fixed||[]).map(function(f2){ return '・' + (f2.name||'固定費') + ' ' + toNum(f2.amount) + '円' + (f2.day?'（'+f2.day+'日）':''); });
  if(fx.length) L.push('【毎月の固定費】\n' + fx.join('\n'));
  var bl = (S.balances||[]).map(function(b2){ return '・' + (b2.name||'口座') + ' ' + toNum(b2.amount) + '円'; });
  if(bl.length) L.push('【口座ごとの残高】\n' + bl.join('\n'));

  /* 分割払い */
  var pl = (S.plans||[]).filter(function(x){ return !x.done; }).slice(0, 12)
    .map(function(x){ return '・' + (x.name||'支払い') + ' 毎月' + toNum(x.monthly) + '円・残り' + toNum(x.rest) + '回'; });
  if(pl.length) L.push('【分割払い】\n' + pl.join('\n'));

  /* 最近の出発の記録 */
  var tl = (S.transitLog||[]).slice(-6).map(function(x){
    return '・' + x.date + ' ' + x.at + 'に家を出た' + (x.min?'（目安より'+x.min+'分）':'');
  });
  if(tl.length) L.push('【最近いつ家を出たか】\n' + tl.join('\n'));

  /* 長いお休み */
  var bk = (S.breaks||[]).map(function(x){ return '・' + (x.name||'お休み') + '：' + x.from + '〜' + x.to; });
  if(bk.length) L.push('【長いお休み】\n' + bk.join('\n'));

  /* ふりかえりの記録 */
  var rv = Object.keys(S.dayReview||{}).filter(function(k){ return (S.dayReview[k]||{}).grade; })
    .sort().reverse().slice(0, 10)
    .map(function(k){ var r2 = S.dayReview[k];
      return '・' + k + ' ' + r2.grade + '（' + toNum(r2.point) + '点）' + (r2.memo?'：'+r2.memo:''); });
  if(rv.length) L.push('【最近のふりかえり】\n' + rv.join('\n'));

  /* 予定の種類 */
  L.push('【予定の種類】' + kindsAll().map(function(k){ return k.name; }).join('、'));

  L.push('【通学】家（三田・弥生ヶ丘五丁目）→ 神姫バス → 三ノ宮 → 阪神電車 → 鳴尾・武庫川女子大前。片道およそ1時間20分。' +
    'バイト先はイオンモール神戸北（三ノ宮からバス約50分）。');

  return L.join('\n\n');
}

function chatSystem(){
  return 'あなたは看護学部1年生の学習と生活をささえる相談相手です。' +
    '下の「アプリの中身」と、道具で手帳を調べた結果だけを根拠にして、日本語で答えてください。\n' +
    '【話し方】' + toneRule() + '\n' +
    '【長さ】' + lenRule() + '\n' +
    '【書き方】' + styleRule() + '\n' +
    '【まもること】\n' +
    '・具体的な日付と時間を必ず示す。\n' +
    '・バイトを提案するときは、必ず「日ごとの状況」の「バイトに入れるのは○○以降」「終日入れる」を守る。授業中に勧めない。\n' +
    '・すでにバイトが入っている日、テストや締切の当日は避ける。テストの3日前は勉強の時間を空ける。\n' +
    '・1限がある日の前夜に遅いバイトを入れない（通学に1時間20分かかる）。\n' +
    '・扶養の残りが少ないときは必ず注意をそえる。\n' +
    '・「日ごとの状況」に無い日付や時間を作り出さない。\n' +
    '・わからないことは「アプリに登録がありません」と正直に言う。推測したところは「たぶん」と書く。\n' +
    '・自信がないときは「はっきりとは言えません」と正直に書く。\n' +
    '・答えは最後まで書き切る。\n' +
    '・病気の診断や薬の判断はしない。つらそうなときは人に相談するようすすめる。\n' +
    '・患者さんの個人情報は扱わない。\n' +
    '【答えの終わりに】根拠にした予定があれば、最後の行に「根拠：9/17の課題、9/20のテスト」のように短く書く。\n' +
    '【勉強の質問の出典】看護・医療の知識を答えるときは、手帳のメモ・講義メモ・暗記カード・保存した論文にあればそれを「出典：講義メモ「〇〇」」のように示す。' +
    '手帳に無い一般的な知識なら「出典：一般的な知識（教科書・先生の資料で確かめてください）」と書く。数値や薬の量は、必ず確かめるようにそえる。\n' +
    '【予定の提案】新しく予定を入れるとよさそうなときは、いちばん最後に次の形式だけの行を足す（複数可・説明は書かない）：\n' +
    '[[ADD|種類|タイトル|YYYY-MM-DD|HH:MM|終了HH:MM]]\n' +
    '  種類は task/quiz/exam/kousa/work/imp/other のどれか。時刻がいらないときは空でよい。\n' +
    ((typeof charaTalkRule === 'function') ? charaTalkRule() : '') +
    /* キャラの口調（キャラのセリフの担当が charaChatPersona を作る。無ければ何もしない） */
    (function(){ try{ return typeof charaChatPersona === 'function' ? String(charaChatPersona() || '') : ''; }catch(e){ return ''; } })();
}

function chatSuggest(){
  var now = new Date().getHours(), out = [];
  var soonTest = normItems().filter(function(x){
    return (x.src==='exam'||x.src==='quiz'||x.src==='kousa') && isYmd(x.date) && daysFromToday(x.date) >= 0 && daysFromToday(x.date) <= 14;
  });
  var soonTask = S.tasks.filter(function(t){ return !t.done && isYmd(t.due) && daysFromToday(t.due) >= 0 && daysFromToday(t.due) <= 3; });
  var y = new Date().getFullYear();
  var restF = (toNum(S.settings.fuyouLimit)||1030000) - yearPayTotal(y);
  if(soonTask.length) out.push('今いちばん先にやるべき課題は？');
  if(soonTest.length) out.push('テスト勉強はいつやればいい？');
  if(now >= 21) out.push('今から寝ると何時間眠れる？');
  if(now <= 9) out.push('今日は何時に家を出ればいい？');
  if(restF < 200000) out.push('扶養の上限まであと何回働ける？');
  out.push('来週バイトを入れるならいつがいい？');
  out.push('今週いちばん気をつけることは？');
  out.push('今月あと何回バイトできる？');
  out.push('来週の予定をまとめて教えて');
  var seen = {}, uniq = [];
  out.forEach(function(q){ if(!seen[q]){ seen[q]=1; uniq.push(q); } });
  return uniq.slice(0, 5);
}

function viewChat(){
  var msgs = roomMsgs();
  var hasKey = !!(S.settings.geminiKey || '').trim();
  var h = '';
  if(!hasKey){
    h += '<div class="bn amber"><span class="ic">!</span><span>' +
      'まず設定タブで <b>Gemini APIキー</b> を登録してください。' +
      'Google AI Studio（aistudio.google.com）で無料でもらえます。いまは <b>AQ.</b> で始まるキーが発行されます。</span></div>';
  }
  var n = aiCountToday();
  h += '<div class="pillrow" style="margin-bottom:8px">' + AI_TONES.map(function(t){
    return '<button data-act="ai-tone" data-v="' + t.id + '" class="' + ((S.ui.aiTone||'friendly')===t.id?'on':'') + '">' + t.name + '</button>';
  }).join('') + '</div>';
  h += '<div class="pillrow" style="margin-bottom:8px">' + AI_MODELS.map(function(m){
    return '<button class="mini" data-act="ai-model" data-v="' + esc(m[0]) + '"' +
      ((S.settings.geminiModel||'')===m[0] ? ' style="background:linear-gradient(180deg,var(--accent2),var(--accent));color:#fff;border-color:rgba(255,255,255,.6)"' : '') +
      '>' + esc(m[1]) + '</button>';
  }).join('') + '</div>';
  h += '<div class="pillrow" style="margin-bottom:10px">' +
    [['auto','長さおまかせ'],['short','短く'],['normal','ふつう'],['long','くわしく']].map(function(o){
      return '<button class="mini" data-act="ai-len" data-v="' + o[0] + '"' +
        ((S.ui.aiLen||'auto')===o[0] ? ' style="background:linear-gradient(180deg,var(--accent2),var(--accent));color:#fff;border-color:rgba(255,255,255,.6)"' : '') +
        '>' + o[1] + '</button>';
    }).join('') +
    '<span class="s2" style="margin-left:auto">今日 ' + n + '回' + (n >= AI_FREE_LIMIT*0.8 ? '（使いすぎかも）' : '') + '</span></div>';
  h += '<div class="chips" style="margin-bottom:8px">' +
    '<button data-act="room-new" style="font-weight:700">＋ 新しい会話</button>' +
    (chatRoom !== 'main' ? '<button data-act="room-rename">名前を変える</button><button data-act="room-del">この会話を消す</button>' : '') +
    roomList().map(function(r){
    return '<button data-act="chat-room" data-v="' + esc(r[0]) + '" class="' + (chatRoom===r[0]?'on':'') + '">' + esc(r[1]) + '</button>';
  }).join('') + '</div>';

  h += '<div class="chatwrap" id="chatwrap">';
  if(!msgs.length){
    h += '<div class="empty" style="padding:18px 0">' + ART.empty +
      '<div style="margin-top:8px">予定を見ながら相談できます。</div></div>';
  }
  msgs.forEach(function(m, i){
    /* 古い会話のまとめ */
    if(m.role === 'sum'){
      if(!m.text) return;
      h += '<details class="csum"><summary>これまでの会話のまとめ（' + (m.n || 0) + '件ぶん）</summary>' +
        '<div class="csumbody">' + esc(m.text).replace(/\n/g, '<br>') + '</div></details>';
      return;
    }
    h += '<div class="cmsg ' + (m.role === 'user' ? 'me' : 'ai') + '">' +
      ((m.role !== 'user' && typeof charaLevel === 'function' && charaLevel() >= 2) ? '<span class="cav">' + charaFace('normal', 30) + '</span>' : '') +
      '<div class="cbub">' +
        ((m.atts||[]).length
          ? '<div class="atts in">' + m.atts.map(function(a){
              return (a.kind === 'image' && a.data)
                ? '<img src="' + a.data + '" alt="' + esc(a.name) + '">'
                : '<span class="att small">📎 ' + esc(a.name) + '</span>';
            }).join('') + '</div>'
          : '') +
        esc(m.text).replace(/\n/g, '<br>') +
      (m.role === 'ai' ? '<div class="cact">' +
        '<button class="mini" data-act="chat-good" data-i="' + i + '"' + (m.good===1?' style="background:linear-gradient(180deg,var(--accent2),var(--accent));color:#fff;border-color:rgba(255,255,255,.6)"':'') + '>役立った</button>' +
        '<button class="mini" data-act="chat-bad" data-i="' + i + '"' + (m.good===0?' style="background:var(--rakutenbg);color:var(--rakuten)"':'') + '>ちがう</button>' +
        '<button class="mini" data-act="chat-why" data-i="' + i + '">なぜ？</button>' +
        '<button class="mini" data-act="chat-short" data-i="' + i + '">短く</button>' +
        '<button class="mini" data-act="chat-more" data-i="' + i + '">詳しく</button>' +
        '<button class="mini" data-act="chat-save" data-i="' + i + '">メモ</button>' +
        ((voiceCanSpeak() || ttsEngine() === 'gemini') ? '<button class="mini" data-act="chat-speak" data-i="' + i + '">' + (voice.speakingI === i ? '■ 止める' : '🔊 読む') + '</button>' : '') +
        '<button class="mini" data-act="quick-from" data-i="' + i + '" title="ひとつ前の質問をボタンにする">★ ボタンに</button>' +
        '<button class="mini" data-act="share-chat" data-i="' + i + '">共有</button>' +
        '</div>' : '') +
      (m.role === 'ai' && typeof chatExtrasHtml === 'function' ? chatExtrasHtml(m, i) : '') + '</div></div>';
    (m.adds || []).forEach(function(ad, j){
      h += '<div class="cmsg ai"><div class="addcard">' +
        '<span class="kdot" style="background:' + kindHex(ad.kind) + ';width:14px;height:14px"></span>' +
        '<span class="grow"><span class="t">' + esc(ad.title) + '</span>' +
        '<span class="s">' + esc(kindOf(ad.kind).name) + '・' + ymdLabel(ad.date) +
          (ad.time ? ' ' + ad.time : '') + (ad.end ? '〜' + ad.end : '') + '</span></span>' +
        (ad.added ? '<span class="b cat">入れました</span>'
                  : '<button class="mini" data-act="chat-add" data-i="' + i + '" data-j="' + j + '">予定に入れる</button>') +
        '</div></div>';
    });
  });
  if(chatBusy) h += '<div class="cmsg ai"><div class="cbub">考えています…　<button class="mini" data-act="chat-stop">やめる</button></div></div>';
  h += '</div>';

  h += quickBar();

  if(chatFiles.length){
    h += '<div class="atts">' + chatFiles.map(function(f, i){
      return '<div class="att">' +
        (f.kind === 'image'
          ? '<img src="' + f.data + '" alt="">'
          : '<span class="ic">' + (/pdf/i.test(f.mime) ? '📄' : '📎') + '</span>') +
        '<span class="nm">' + esc(f.name) + '</span>' +
        '<button class="mini" data-act="att-del" data-i="' + i + '">×</button></div>';
    }).join('') + '</div>';
  }
  if(typeof chatAttChips === 'function') h += chatAttChips();
  h += '<div class="pillrow" style="margin-bottom:6px">' +
    '<button class="mini' + (chatWeb ? ' on' : '') + '" data-act="chat-web" aria-pressed="' + (chatWeb ? 'true' : 'false') + '">🔎 ネットで調べる' + (chatWeb ? '（オン）' : '') + '</button>' +
    '<button class="mini" data-act="talk-start">🗣 声だけで会話</button>' +
    '<button class="mini' + (aiDirectOn() ? ' on' : '') + '" data-act="ai-direct">' + (aiDirectOn() ? '✓ 頼んだら手帳に入れる' : '頼んでも手帳に入れない') + '</button></div>';
  h += '<div class="pair">' +
    '<button class="btn ghost" style="flex:0 0 auto;padding:13px 14px" data-act="chat-att" title="写真やファイルをつける">📎</button>' +
    '<input id="chat_in" placeholder="' + (voice.listening ? '聞いています…話してください' : 'きいてみる（例：来週のバイトいつがいい？）') + '"' +
      (voice.interim ? ' value="' + esc(voice.interim) + '"' : '') + '>' +
    '<button class="btn ' + (voice.listening ? '' : 'ghost') + ' micbtn' + (voice.listening ? ' rec' : '') + '" style="flex:0 0 auto;padding:13px 14px" data-act="voice-mic" ' +
      'aria-label="' + (voice.listening ? '聞くのをやめる' : '声で相談する') + '">' + (voice.listening ? '■' : '🎤') + '</button>' +
    '<button class="btn" style="flex:0 0 auto;padding:13px 20px" data-act="chat-send">送る</button></div>' +
    '<div class="pillrow" style="margin-top:8px">' +
      '<button class="mini" data-act="voice-read" style="' + (S.ui.voiceRead ? 'background:linear-gradient(180deg,var(--accent2),var(--accent));color:#fff;border-color:rgba(255,255,255,.6)' : '') + '">' +
        '🔊 声で聞いたら声で答える' + (S.ui.voiceRead ? '（オン）' : '（オフ）') + '</button>' +
      (roomMsgs().filter(function(m){ return m.role !== 'sum'; }).length >= 12
        ? '<button class="mini" data-act="chat-sum" ' + (chatSumBusy ? 'disabled' : '') + '>' + (chatSumBusy ? 'まとめています…' : '古い会話をまとめて軽くする') + '</button>' : '') +
    '</div>' +
    (voice.err ? '<p class="note" style="color:var(--rakuten)">' + esc(voice.err) + '</p>' : '');

  var n = aiCountToday();
  h += '<div class="s2" style="margin-top:8px">今日つかった回数：' + n + ' 回' +
    (n >= AI_FREE_LIMIT ? '　<b style="color:var(--rakuten)">（無料の目安をこえています）</b>'
     : n >= AI_FREE_LIMIT*0.8 ? '　<span style="color:var(--warn)">（そろそろ無料の目安）</span>' : '') + '</div>';
  if(msgs.length) h += '<button class="btn ghost" style="margin-top:10px" data-act="chat-clear">この話を消す</button>';
  h += '<p class="note">アプリに登録した予定・課題・テスト・バイト・お金の情報をもとに答えます。' +
    '送った内容はGoogleのAIに送信されます。患者さんの個人情報は書かないでください。</p>';
  return '<section>' + h + '</section>';
}

async function chatSend(text, opt){
  opt = opt || {};
  if(!aiReady()){ toast('先に設定タブでGemini APIキーを登録してください', true); return; }
  /* 患者さんや実習先の個人情報は外に出さない */
  if(/患者|受け持ち|カルテ|バイタル.*さん|入院|病棟の.*さん|既往歴|主訴/.test(text)){
    roomSet(roomMsgs().concat([
      { role:'user', text:text, mt:Date.now() },
      { role:'ai', text:'患者さんに関わることは、外には送れません。実習の記録はアプリのメモ（この端末の中）に書いてください。\n\n書き方や考え方の相談なら、個人が分からない形でお答えできます。', mt:Date.now() }
    ]));
    persist(); render();
    var bx = document.getElementById('chatwrap'); if(bx) bx.scrollTop = bx.scrollHeight;
    return;
  }
  if(!text) return;
  if(!opt.silent && /患者(さん)?(の)?(氏名|名前|カルテ|ID)|受け持ち.*(氏名|本名)/.test(text)){
    if(!confirm('患者さんの個人情報は送らないでください。このまま送りますか？')) return;
  }
  var sendFiles = chatFiles.slice();
  chatFiles = [];
  var list = roomMsgs().concat([{ role:'user', text:text, voice: opt.voice ? 1 : 0,
    atts: sendFiles.map(function(f){ return { name:f.name, kind:f.kind, data:(f.kind==='image'?f.data:'') }; }),
    mt:Date.now() }]);
  roomSet(list);
  chatBusy = true; persist(); render();
  var box = document.getElementById('chatwrap'); if(box) box.scrollTop = box.scrollHeight;

  try{
    var history = roomMsgs().filter(function(m){ return m.role !== 'sum'; }).slice(-14)
      .filter(function(m){ return !(m.role === 'ai' && /^つながりませんでした|^とちゅうでやめました/.test(m.text)); })
      .map(function(m){ return { role: m.role === 'user' ? 'user' : 'model', parts:[{ text:m.text }] }; });
    /* いちばん新しい発言に、写真やファイルをつける */
    if(sendFiles.length && history.length){
      var last = history[history.length - 1];
      sendFiles.forEach(function(f){
        var b64 = String(f.data).split(',')[1] || '';
        if(!b64) return;
        if(f.kind === 'image') last.parts.unshift({ inline_data:{ mime_type:f.mime, data:b64 } });
        else last.parts.unshift({ inline_data:{ mime_type:f.mime, data:b64 } });
      });
    }
    while(history.length && history[0].role !== 'user') history.shift();

    var sys = chatSystem() + '\n\n===== アプリの中身 =====\n' + chatContext();
    var sumText = roomMsgs().filter(function(m){ return m.role === 'sum' && m.text; }).map(function(m){ return m.text; }).join('\n');
    if(sumText) sys += '\n\n===== これまでの会話のまとめ（前の話の続きとして使う） =====\n' + sumText;

    chatAbort = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var asked = await chatAsk({ system:sys, contents:history, text:text, voice:!!opt.voice, talk:!!opt.talk,
      signal: chatAbort ? chatAbort.signal : undefined });
    var out = asked.text;
    if(!out) out = 'うまく答えられませんでした。もう一度きいてみてください。';
    /* AIが「予定に入れるとよい」と書いた行を取り出す */
    var adds = [];
    out = out.replace(/\[\[ADD\|([^\]]*)\]\]/g, function(_, body2){
      var q = body2.split('|');
      var kind = (q[0]||'').trim(), title = (q[1]||'').trim(), date = (q[2]||'').trim();
      var tm = (q[3]||'').trim(), en = (q[4]||'').trim();
      if(!isYmd(date) || !title) return '';
      if(!kindsAll().some(function(k){ return k.id === kind; })) kind = 'other';
      adds.push({ kind:kind, title:title, date:date,
        time:/^\d{1,2}:\d{2}$/.test(tm)?tm:'', end:/^\d{1,2}:\d{2}$/.test(en)?en:'' });
      return '';
    }).replace(/\n{3,}/g, '\n\n').trim();
    var aiMsg = { role:'ai', text:out, adds:adds, mt:Date.now() };
    if(asked.ops && asked.ops.length) aiMsg.ops = asked.ops;
    if(asked.src && asked.src.length) aiMsg.src = asked.src;
    if(asked.sep) aiMsg.sep = asked.sep;
    roomSet(roomMsgs().concat([aiMsg]));
    /* 声で聞いたときは、声で答える（会話モードのときは会話モードが読む） */
    if(opt.voice && !opt.talk && S.ui.voiceRead) setTimeout(function(){ speakMsg(roomMsgs().length - 1); }, 60);
    /* 長くなってきたら、古い会話をまとめて軽くする */
    setTimeout(function(){ chatMaybeSummarize(false); }, 400);
    if(window.__revCatch){
      window.__revCatch = false;
      S.dayReview = S.dayReview || {};
      var tdr = today();
      var jj = dayGrade(tdr);
      var pr = S.dayReview[tdr] || {};
      S.dayReview[tdr] = { grade: pr.grade || jj.grade, point: pr.point || jj.point,
        memo: pr.memo || '', ai: out, mt: Date.now() };
      touch('dayReview'); persist();
    }
  }catch(e){
    var msg = String(e.message || '');
    if(/abort/i.test(msg)){
      roomSet(roomMsgs().concat([{ role:'ai', text:'とちゅうでやめました。', mt:Date.now() }]));
    }else{
      roomSet(roomMsgs().concat([{ role:'ai', text:'つながりませんでした。\n' +
        (/API key not valid|API_KEY_INVALID|401|invalid_api_key/i.test(msg) ? 'APIキーが正しくないようです。設定タブで入れ直してください。'
         : /quota|RESOURCE_EXHAUSTED|429/i.test(msg) ? '今日の無料ぶんを使い切ったかもしれません。'
         : msg.slice(0, 140)), mt:Date.now() }]));
    }
  }finally{
    chatBusy = false; chatAbort = null;
    capRoom();
    persist(); pushRemote(); render();
    var b2 = document.getElementById('chatwrap'); if(b2) b2.scrollTop = b2.scrollHeight;
  }
}

/* ===== よく使う相談（ボタン） ===== */
var quickEdit = false;
function quickList(){
  return (Array.isArray(S.chatQuick) && S.chatQuick.length) ? S.chatQuick : chatSuggest();
}
function quickBar(){
  var list = quickList();
  var mine = Array.isArray(S.chatQuick) && S.chatQuick.length > 0;
  return '<div class="chips quickbar" style="margin:10px 0">' +
    list.map(function(q, i){
      return quickEdit && mine
        ? '<button data-act="quick-del" data-i="' + i + '" class="qdel">× ' + esc(q) + '</button>'
        : '<button data-act="chat-q" data-q="' + esc(q) + '">' + esc(q) + '</button>';
    }).join('') +
    '<button data-act="quick-add" title="入力中の文をボタンにする">＋ ボタンを足す</button>' +
    (mine ? '<button data-act="quick-edit">' + (quickEdit ? '直し終わる' : '並び・消す') + '</button>' : '') +
    '</div>' +
    (quickEdit && mine ? '<p class="note" style="margin-top:-4px">押すと消えます。「はじめの見本にもどす」は <button class="mini" data-act="quick-reset">こちら</button></p>' : '');
}
function quickAddText(q){
  q = String(q || '').trim().slice(0, 60);
  if(!q){ toast('入力欄に文を書いてから押してください', true); return; }
  var list = Array.isArray(S.chatQuick) ? S.chatQuick.slice() : [];
  if(list.indexOf(q) >= 0){ toast('もうボタンになっています'); return; }
  if(list.length >= 12){ toast('ボタンは12個までです', true); return; }
  list.push(q);
  S.chatQuick = list; touch('chatQuick');
  toast('「' + q + '」をボタンにしました'); commit();
}

/* ===== 声で相談する ===== */
var voice = { listening:false, rec:null, interim:'', err:'', speakingI:-1, media:null, chunks:[] };
function voiceCanListen(){
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition) ||
         !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
function voiceCanSpeak(){ return typeof window.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; }
function voiceStart(){
  voice.err = '';
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(SR){
    try{
      var rec = new SR();
      rec.lang = 'ja-JP'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      var finalText = '';
      rec.onresult = function(e){
        var interim = '';
        for(var i = e.resultIndex; i < e.results.length; i++){
          if(e.results[i].isFinal) finalText += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        voice.interim = finalText + interim;
        var el = document.getElementById('chat_in'); if(el) el.value = voice.interim;
      };
      rec.onerror = function(e){
        voice.err = (e.error === 'not-allowed' || e.error === 'service-not-allowed')
          ? 'マイクが使えません。端末の設定でマイクを許可してください。'
          : e.error === 'no-speech' ? '声が聞こえませんでした。もう一度どうぞ。' : '聞き取れませんでした（' + e.error + '）';
      };
      rec.onend = function(){
        voice.listening = false; voice.rec = null;
        var text = (finalText || voice.interim || '').trim();
        voice.interim = '';
        render();
        if(text) chatSend(text, { voice:true });
      };
      voice.rec = rec; voice.listening = true;
      rec.start();
      render();
      return;
    }catch(e){ voice.err = '声の聞き取りを始められませんでした：' + e.message; }
  }
  /* 聞き取りがない端末：録音して、AIに文字にしてもらう */
  if(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
    navigator.mediaDevices.getUserMedia({ audio:true }).then(function(stream){
      var mr = new MediaRecorder(stream);
      voice.chunks = [];
      mr.ondataavailable = function(ev){ if(ev.data && ev.data.size) voice.chunks.push(ev.data); };
      mr.onstop = function(){
        stream.getTracks().forEach(function(tr){ tr.stop(); });
        voice.listening = false; render();
        var blob = new Blob(voice.chunks, { type: mr.mimeType || 'audio/webm' });
        voiceTranscribe(blob);
      };
      voice.media = mr; voice.listening = true;
      mr.start();
      setTimeout(function(){ if(voice.media === mr && mr.state === 'recording') mr.stop(); }, 30000);   /* 30秒まで */
      render();
    })['catch'](function(){
      voice.err = 'マイクが使えません。端末の設定でマイクを許可してください。'; render();
    });
    return;
  }
  voice.err = 'この端末では声の入力が使えません。'; render();
}
function voiceStop(){
  if(voice.rec){ try{ voice.rec.stop(); }catch(e){} }
  if(voice.media && voice.media.state === 'recording'){ try{ voice.media.stop(); }catch(e){} }
}
async function voiceTranscribe(blob){
  try{
    toast('声を文字にしています…');
    var dataUrl = await new Promise(function(res, rej){
      var r = new FileReader(); r.onload = function(){ res(r.result); }; r.onerror = rej; r.readAsDataURL(blob);
    });
    var m = String(dataUrl).match(/^data:([^;]+)(?:;[^,]*)?;base64,(.*)$/);
    if(!m) throw new Error('録音を読めませんでした');
    var text = await aiGenerate({ tag:'stt', temperature:0, maxTokens:500, contents:[{ role:'user', parts:[
      { inline_data:{ mime_type:m[1].split(';')[0], data:m[2] } },
      { text:'この音声を日本語の文字に起こしてください。話した内容だけを返し、説明はつけないでください。' }
    ]}]});
    text = String(text || '').trim();
    if(!text){ toast('聞き取れませんでした', true); return; }
    chatSend(text, { voice:true });
  }catch(e){
    voice.err = '声を文字にできませんでした：' + e.message; render();
  }
}
/* 答えを読み上げる */
function speakMsg(i){
  var m = roomMsgs()[i];
  if(!m || m.role !== 'ai') return;
  if(voice.speakingI === i){ voice.speakingI = -1; ttsStop(); render(); return; }
  ttsUnlock();
  voice.speakingI = i;
  ttsSpeak(m.text).then(function(){
    if(voice.speakingI === i){ voice.speakingI = -1; if(appId === 'chat' && !isTyping()) render(); }
  });
  if(appId === 'chat' && !isTyping()) render();
}

/* ===== 長くなった会話を、AIがまとめて軽くする ===== */
var SUM_AT = 40, SUM_KEEP = 16, ROOM_CAP = 120;
var chatSumBusy = false;
async function chatMaybeSummarize(force){
  if(chatSumBusy || chatBusy) return false;
  var room = chatRoom;
  var msgs = roomMsgs();
  var real = msgs.filter(function(m){ return m.role !== 'sum'; });
  if(!force && real.length < SUM_AT) return false;
  if(!aiReady()){ if(force) toast('先に設定タブでGemini APIキーを登録してください', true); return false; }
  var keep = real.slice(-SUM_KEEP), old = real.slice(0, real.length - SUM_KEEP);
  if(old.length < 4){ if(force) toast('まとめるほどの量がありません'); return false; }
  var prevSum = msgs.filter(function(m){ return m.role === 'sum' && m.text; }).map(function(m){ return m.text; }).join('\n');
  var prevN = msgs.filter(function(m){ return m.role === 'sum'; }).reduce(function(a, m){ return a + (Number(m.n)||0); }, 0);
  var transcript = old.map(function(m){ return (m.role === 'user' ? 'わたし：' : 'AI：') + String(m.text || '').slice(0, 1200); }).join('\n');
  chatSumBusy = true;
  if(appId === 'chat' && !isTyping()) render();
  try{
    var text = await aiGenerate({ tag:'summary', temperature:0.2, maxTokens:900, contents:[{ role:'user', parts:[{ text:
      'つぎの相談の会話を、あとで続きを話すための「まとめ」にしてください。\n' +
      '・決まったこと、やると決めたこと、わたしの事情や好み、まだ答えが出ていない質問を残す\n' +
      '・箇条書きで12行以内。日付はそのまま残す。前置きはいらない\n' +
      (prevSum ? '【前のまとめ】\n' + prevSum + '\n' : '') + '【会話】\n' + transcript }] }] });
    text = String(text || '').trim();
    if(!text) throw new Error('まとめが空でした');
    if(chatRoom !== room){ var cur = chatRoom; chatRoom = room; applySummary(text, old, keep, prevN); chatRoom = cur; }
    else applySummary(text, old, keep, prevN);
    persist(); pushRemote();
    if(force) toast('古い会話' + old.length + '件をまとめました');
    return true;
  }catch(e){
    logErr('会話のまとめ', e.message);
    if(force) toast('まとめられませんでした：' + e.message, true);
    return false;
  }finally{
    chatSumBusy = false;
    if(appId === 'chat' && !isTyping()) render();
  }
}
function applySummary(text, old, keep, prevN){
  var upto = Number(old[old.length - 1].mt) || Date.now();
  /* まとめている間に増えた発言も残す */
  var newer = roomMsgs().filter(function(m){ return m.role !== 'sum' && (Number(m.mt)||0) > upto; });
  roomSet([{ role:'sum', text:text, n:prevN + old.length, upto:upto, mt:upto }].concat(newer));
}
/* AIが使えないときでも、増えすぎないように古いものから外す */
function capRoom(){
  var msgs = roomMsgs();
  var real = msgs.filter(function(m){ return m.role !== 'sum'; });
  if(real.length <= ROOM_CAP) return;
  var cut = real[real.length - ROOM_CAP - 1];
  var prev = msgs.filter(function(m){ return m.role === 'sum'; })[0];
  var upto = Number(cut.mt) || Date.now();
  roomSet([{ role:'sum', text:(prev && prev.text) || '', n:((prev && prev.n) || 0) + (real.length - ROOM_CAP), upto:upto, mt:upto }]
    .concat(real.slice(-ROOM_CAP)));
}

function chatAction(act, t){
  if(act === 'voice-mic'){
    if(voice.listening) voiceStop();
    else if(!voiceCanListen()){ toast('この端末では声の入力が使えません', true); }
    else if(!aiReady()){ toast('先に設定タブでGemini APIキーを登録してください', true); }
    else voiceStart();
    return true;
  }
  if(act === 'voice-read'){ S.ui.voiceRead = S.ui.voiceRead ? 0 : 1; touch('ui'); commit(); return true; }
  if(act === 'chat-speak'){ speakMsg(toNum(t.dataset.i)); return true; }
  if(act === 'quick-add'){
    var qi = document.getElementById('chat_in');
    quickAddText(qi ? qi.value : ''); return true;
  }
  if(act === 'quick-from'){
    var all = roomMsgs(), ii = toNum(t.dataset.i);
    for(var k = ii - 1; k >= 0; k--){ if(all[k] && all[k].role === 'user'){ quickAddText(all[k].text); break; } }
    return true;
  }
  if(act === 'quick-edit'){ quickEdit = !quickEdit; render(); return true; }
  if(act === 'quick-del'){
    var ql = (S.chatQuick || []).slice(); ql.splice(toNum(t.dataset.i), 1);
    S.chatQuick = ql; touch('chatQuick'); commit(); return true;
  }
  if(act === 'quick-reset'){
    if(!confirm('ボタンを、はじめの見本にもどしますか？')) return true;
    S.chatQuick = []; touch('chatQuick'); quickEdit = false; commit(); return true;
  }
  if(act === 'chat-sum'){ chatMaybeSummarize(true); return true; }
  if(act === 'chat-add'){
    var mm = roomMsgs()[toNum(t.dataset.i)];
    if(!mm || !mm.adds) return true;
    var ad = mm.adds[toNum(t.dataset.j)];
    if(!ad || ad.added) return true;
    var now = Date.now();
    if(ad.kind === 'task'){
      S.tasks.push({ id:uid('tk'), title:ad.title, subject:'', due:ad.date, time:ad.time||'',
        done:0, memo:'', subs:[], photos:[], pri:1, how:'', url:'', mt:now });
    }else if(ad.kind === 'work'){
      S.shifts.push({ id:uid('wk'), title:'バイト', date:ad.date, start:ad.time||'', end:ad.end||'',
        realEnd:'', ot:0, rate:0, memo:'', photos:[], mt:now });
    }else if(['quiz','exam','kousa'].indexOf(ad.kind) >= 0){
      S.exams.push({ id:uid('ex'), subject:ad.title, date:ad.date, time:ad.time||'', kind:ad.kind,
        room:'', memo:'', photos:[], mt:now });
    }else{
      S.events.push({ id:uid('ev'), date:ad.date, title:ad.title, time:ad.time||'', kind:ad.kind,
        memo:'', photos:[], mt:now });
    }
    ad.added = 1; mm.et = now;
    toast('予定に入れました'); commit(); return true;
  }
  if(act === 'ai-tone'){ S.ui.aiTone = t.dataset.v; touch('ui'); commit(); return true; }
  if(act === 'ai-len'){ S.ui.aiLen = t.dataset.v; touch('ui'); commit(); return true; }
  if(act === 'ai-style'){ S.ui.aiStyle = t.dataset.v; touch('ui'); commit(); return true; }
  if(act === 'ai-model'){ S.settings.geminiModel = t.dataset.v; persist(); toast('かしこさを変えました'); render(); return true; }
  if(act === 'chat-att'){
    var inp = document.getElementById('chatfile');
    if(inp) inp.click();
    return true;
  }
  if(act === 'att-del'){
    chatFiles.splice(toNum(t.dataset.i), 1); render(); return true;
  }
  if(act === 'chat-send'){
    var el = document.getElementById('chat_in');
    var v = el ? el.value.trim() : '';
    if(!v && chatFiles.length && typeof ATT_PROMPTS !== 'undefined') v = ATT_PROMPTS.sum;
    if(!v){ toast('きくことを入れてください', true); return true; }
    if(el) el.value = '';
    chatSend(v); return true;
  }
  if(act === 'chat-q'){ chatSend(t.dataset.q); return true; }
  if(act === 'chat-room'){ chatRoom = t.dataset.v; render(); chatScrollBottom(); return true; }
  if(act === 'room-new'){
    roomNew(); appId='chat'; touch('chatMeta'); commit(); chatScrollBottom(); return true;
  }
  if(act === 'room-rename'){
    if(chatRoom === 'main') return true;
    var nm = prompt('この会話の名前', (S.chatMeta[chatRoom]||{}).name || '会話');
    if(nm == null) return true;
    S.chatMeta[chatRoom] = Object.assign({}, S.chatMeta[chatRoom], { name: nm.trim() || '会話', mt: Date.now() });
    touch('chatMeta'); commit(); return true;
  }
  if(act === 'room-del'){
    if(chatRoom === 'main') return true;
    if(!confirm('この会話を消しますか？')) return true;
    delete S.chatMeta[chatRoom];
    if(S.chatRooms) delete S.chatRooms[chatRoom];
    /* ほかの端末でもどってこないように、消した印をつける */
    markDeleted('room:'+chatRoom);
    chatRoom = 'main'; touch('chatMeta'); toast('消しました'); commit(); return true;
  }
  if(act === 'chat-stop'){ if(chatAbort) chatAbort.abort(); return true; }
  if(act === 'chat-clear'){
    if(!confirm('この話を消しますか？')) return true;
    /* ほかの端末でもどってこないよう、「ここまで消した」印を置く */
    roomSet([{ role:'sum', text:'', n:0, upto:Date.now(), mt:Date.now() }]); persist(); pushRemote(); render(); return true;
  }
  if(act === 'chat-good' || act === 'chat-bad'){
    var i = toNum(t.dataset.i), list = roomMsgs().slice();
    if(!list[i]) return true;
    list[i].good = (act === 'chat-good') ? 1 : 0;
    list[i].et = Date.now();
    roomSet(list);
    S.aiFeedback = (S.aiFeedback||[]).concat([{ good:list[i].good, text:String(list[i].text).slice(0,120), mt:Date.now() }]).slice(-60);
    touch('aiFeedback');
    if(act === 'chat-bad'){
      toast('どこがちがうか送ると、次から気をつけます');
      var el2 = document.getElementById('chat_in');
      if(el2){ el2.value = 'さっきの答え、ここがちがいます：'; el2.focus(); }
    }else toast('ありがとう');
    commit(); return true;
  }
  if(act === 'chat-save'){
    var m2 = roomMsgs()[toNum(t.dataset.i)];
    if(!m2) return true;
    S.notes.push({ id:uid('nt'), title:'AIからの答え', body:m2.text, pinned:0, checks:[], photos:[], link:null, ct:Date.now(), mt:Date.now() });
    toast('メモに保存しました'); commit(); return true;
  }
  if(act === 'chat-why'){ chatSend('いまの答えについて、なぜそう考えたのか理由をおしえて。根拠にした予定も挙げて。'); return true; }
  if(act === 'chat-short'){ chatSend('いまの答えを3行くらいに短くして。'); return true; }
  if(act === 'chat-more'){ chatSend('いまの答えをもっと詳しく、理由もつけて説明して。'); return true; }
  if(act === 'ai-memo-add'){
    var v3 = val('ai_memo').trim();
    if(!v3){ toast('覚えてほしいことを入れてください', true); return true; }
    S.aiMemo = (S.aiMemo||[]).concat([{ id:uid('am'), text:v3, mt:Date.now() }]).slice(-20);
    touch('aiMemo'); toast('覚えました'); commit(); return true;
  }
  if(act === 'ai-memo-del'){
    S.aiMemo = (S.aiMemo||[]).filter(function(m){ return m.id !== t.dataset.id; });
    touch('aiMemo'); commit(); return true;
  }
  return false;
}


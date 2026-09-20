/* くらしの手帳：暗記の追加（耳で暗記・ひっかけ・解説・Anki書き出し・テスト範囲） */
/* ============================== データ ==============================
   #17  テスト範囲の逆算 … S.examPlan[テストid] = { items:[{ id, name, amount, unit, done, deck, dd:{ d, n } }],
                            start, rest:[日付], review, log:{ 日付:量 }, mt }
          ・done … これまでに終わった量（ぜんぶで）。dd … その日にチェックした量（今日の分を計算しなおさないため）
          ・deck … 暗記カードの科目。これがあると「はじめて見たカードの枚数」で自動で進む
          ・review … 0 でないとき、テストの前の日は「見直しの日」（新しい範囲を入れない）
          ・消したときは { del:1, mt }（同期で、消したものがもどらないように）
   #18  耳で暗記 … 読み上げ（speechSynthesis）。速さ・待つ秒数などは S.ui.anki2、声はこの端末だけ（localStorage）
   #120 ひっかけ問題 … AI（tag:'ak2-trap'）で作る。解いたら、選んだものだけカードに追加
   #121 まちがえたカードの解説 … card.miss（「もう一回」を押した回数。anki.js が数える）・card.missAt、
          card.explain / explainSrc（出典）/ explainNote（使ったメモのid）/ explainAt。AI（tag:'ak2-explain'）
   #182 Anki … タブ区切りのテキストで書き出す・取りこむ（取りこむときは見てから追加） */
var AK2_UNITS = ['ページ', '枚', '章', '問', '回', 'こ'];
var AK2_GENERAL = '一般的な知識・教科書で確かめて';
var AK2_CHECK = 'AIが作った目安です。教科書・先生の資料で確かめてください。';
var AK2_SECRET_NOTE = /患者|実習記録|カルテ|受け持ち|受持ち/;          /* 解説のためにAIへ送らないメモ */
var ak2State = { plan:'', delAsk:'', busy:'', trap:null, trapBusy:0, imp:null, outMsg:'', wrongDeck:'', focus:'', expOpen:{} };

/* ============================== 共通 ============================== */
function ak2Ui(){
  var u = (S.ui && S.ui.anki2 && typeof S.ui.anki2 === 'object') ? S.ui.anki2 : {};
  return {
    wait: u.wait != null ? Math.max(0, toNum(u.wait)) : 3,
    rate: parseFloat(u.rate) > 0 ? parseFloat(u.rate) : 1,
    rep: Math.max(1, toNum(u.rep) || 1),
    loop: u.loop ? 1 : 0, mix: u.mix ? 1 : 0,
    en: u.en === 0 ? 0 : 1, ans: u.ans === 0 ? 0 : 1, exp: u.exp ? 1 : 0,
    showExp: u.showExp === 0 ? 0 : 1
  };
}
function ak2UiSet(o){ S.ui.anki2 = Object.assign({}, (S.ui.anki2 && typeof S.ui.anki2 === 'object') ? S.ui.anki2 : {}, o); touch('ui'); }
/* この端末だけの設定（読み上げの声など。端末ごとに声の種類がちがう） */
function ak2Local(){ try{ return JSON.parse(localStorage.getItem(KEY + ':anki2') || '{}') || {}; }catch(e){ return {}; } }
function ak2LocalSet(o){ try{ localStorage.setItem(KEY + ':anki2', JSON.stringify(Object.assign(ak2Local(), o))); }catch(e){} }
function ak2Card(id){ return ankiCards().filter(function(c){ return c.id === id; })[0] || null; }
function ak2Short(n){ return typeof shortName === 'function' ? shortName(n) : n; }
function ak2Go(tool){ appId = 'study'; studyTool = tool; render(); window.scrollTo(0, 0); }
function ak2Md(ymd){
  var a = String(ymd).split('-'), d = new Date(+a[0], +a[1] - 1, +a[2]);
  return (+a[1]) + '/' + (+a[2]) + '（' + WDAY[d.getDay()] + '）';
}
function ak2IsIos(){
  try{ return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }catch(e){ return false; }
}
function ak2Shuffle(a){
  for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
  return a;
}
/* テストのときは時間を100分の1にする */
function ak2Ms(sec){ return Math.round(sec * 1000 * (TEST_MODE ? 0.01 : 1)); }
function ak2FormChk(id, def){ var e = document.getElementById(id); return e ? (e.checked ? 1 : 0) : def; }
function ak2FormVal(id, def){ var e = document.getElementById(id); return (e && e.value !== '') ? e.value : def; }

/* ============================== #17 テスト範囲の逆算 ============================== */
function ak2Exam(id){ return (S.exams || []).filter(function(x){ return x && x.id === id; })[0] || null; }
function ak2ExamName(x){ return (x.subject || 'テスト') + (x.title ? ' ' + x.title : ''); }
function ak2KindName(x){ return x.kind === 'quiz' ? '小テスト' : x.kind === 'kousa' ? '考査' : 'テスト'; }
function ak2Plan(id){
  var m = S.examPlan;
  var p = (m && typeof m === 'object') ? m[id] : null;
  return (p && typeof p === 'object' && !p.del) ? p : null;
}
function ak2PlanItems(p){ return (p && Array.isArray(p.items)) ? p.items : []; }
function ak2Unit(i){ return i.deck ? '枚' : (i.unit || ''); }
/* 書きかえるときだけ使う（表示では使わない） */
function ak2PlanEnsure(id){
  if(!S.examPlan || typeof S.examPlan !== 'object' || Array.isArray(S.examPlan)) S.examPlan = {};
  var p = ak2Plan(id);
  if(!p){ p = { items:[], start:today(), rest:[], review:1, log:{}, mt:Date.now() }; S.examPlan[id] = p; }
  if(!Array.isArray(p.items)) p.items = [];
  if(!Array.isArray(p.rest)) p.rest = [];
  if(!p.log || typeof p.log !== 'object' || Array.isArray(p.log)) p.log = {};
  if(!isYmd(p.start)) p.start = today();
  return p;
}
function ak2PlanSave(p){
  /* 記録は新しい120日分だけ残す */
  var ks = Object.keys(p.log || {}).sort();
  if(ks.length > 120) ks.slice(0, ks.length - 120).forEach(function(k){ delete p.log[k]; });
  p.mt = Date.now();
  touch('examPlan');
}
/* 「教科書 p.20〜80」のような名前から、ページ数を出す */
function ak2GuessAmt(name){
  var s = String(name || '').replace(/[０-９]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  var m = s.match(/p\.?\s*(\d+)\s*[〜~\-－ー–—]\s*p?\.?\s*(\d+)/i) || s.match(/(\d+)\s*[〜~\-－ー–—]\s*(\d+)\s*(ページ|頁|p)/i);
  if(!m) return 0;
  var a = toNum(m[1]), b = toNum(m[2]);
  return b >= a ? b - a + 1 : 0;
}
/* その日にどれくらいできるか（1＝ふつう。0＝新しい範囲を入れない日） */
function ak2DayInfo(ymd, p, ex){
  if(isYmd(p.start) && ymd < p.start) return { w:0, why:['まだはじめない日'], pre:1 };
  if((p.rest || []).indexOf(ymd) >= 0) return { w:0, why:['予備日'], rest:1 };
  if(p.review !== 0 && ymd === shiftDate(ex.date, -1)) return { w:0, why:['見直しの日'], review:1 };
  var w = 1, why = [];
  if((S.exams || []).some(function(x){ return x && x.id !== ex.id && x.date === ymd; })){ w *= 0.5; why.push('ほかのテスト'); }
  var hrs = 0;
  (S.shifts || []).forEach(function(s){
    if(!s || s.date !== ymd) return;
    var h = 0;
    try{ h = typeof shiftHours === 'function' ? shiftHours(s) : 0; }catch(e){}
    hrs += h > 0 ? h : 4;
  });
  if(hrs >= 6){ w *= 0.4; why.push('バイト'); }
  else if(hrs > 0){ w *= 0.65; why.push('バイト'); }
  var cls = 0;
  try{ cls = classesForDate(ymd).filter(function(c){ return !c.off; }).length; }catch(e){}
  if(cls >= 4){ w *= 0.7; why.push('授業' + cls + 'コマ'); }
  else if(cls === 0 && !hrs){ w *= 1.3; why.push('授業なし'); }
  return { w:Math.round(w * 100) / 100, why:why };
}
/* 暗記カードの科目：はじめて見た日で進みぐあいを数える */
function ak2DeckCount(deck, ymd){
  var all = 0, before = 0, on = 0;
  ankiCards().forEach(function(c){
    if(c.deck !== deck) return;
    all++;
    if(c.first && c.first < ymd) before++;
    else if(c.first === ymd) on++;
  });
  return { all:all, before:before, on:on };
}
function ak2ItemState(it, ymd){
  if(it.deck){ var dc = ak2DeckCount(it.deck, ymd); return { amount:dc.all, before:dc.before, on:dc.on }; }
  var amount = Math.max(0, toNum(it.amount)), done = Math.max(0, toNum(it.done));
  var on = (it.dd && it.dd.d === ymd) ? Math.min(done, Math.max(0, toNum(it.dd.n))) : 0;
  return { amount:amount, before:done - on, on:on };
}
/* 今日やる分・遅れ・のこりの日を計算する（S は変えない） */
function ak2PlanCalc(ex, p, ymd){
  ymd = ymd || today();
  var out = { ymd:ymd, days:[], items:[], left:isYmd(ex.date) ? daysBetween(ymd, ex.date) : null, wToday:0, status:'' };
  var start = isYmd(p.start) ? p.start : ymd;
  var Wall = 0, Wpast = 0, Wrest = 0;
  if(isYmd(ex.date)){
    var d = start < ymd ? start : ymd, guard = 0;
    while(d < ex.date && guard++ < 400){
      var info = ak2DayInfo(d, p, ex);
      info.d = d;
      if(d >= start){ Wall += info.w; if(d < ymd) Wpast += info.w; }
      if(d >= ymd){ Wrest += info.w; out.days.push(info); }
      d = shiftDate(d, 1);
    }
  }
  out.wToday = (out.days.length && out.days[0].d === ymd) ? out.days[0].w : 0;
  out.onlyRest = out.days.length > 0 && Wrest <= 0;
  ak2PlanItems(p).forEach(function(it){
    var st = ak2ItemState(it, ymd);
    var rem = Math.max(0, st.amount - st.before), q = 0;
    if(rem > 0 && out.days.length){
      if(Wrest > 0) q = out.wToday > 0 ? Math.min(rem, Math.ceil(rem * out.wToday / Wrest - 1e-9)) : 0;
      else q = rem;                                   /* 予備日しか残っていないときは、今日にまとめる */
    }
    var ideal = Wall > 0 ? st.amount * Wpast / Wall : 0;
    out.items.push({ id:it.id, name:String(it.name || ''), unit:it.unit || '', deck:it.deck || '',
      amount:st.amount, before:st.before, on:st.on, rem:rem, q:q, left:Math.max(0, rem - st.on),
      behind:Math.max(0, Math.floor(ideal - st.before - st.on + 1e-9)) });
  });
  out.status = ak2Status(out);
  return out;
}
function ak2Status(c){
  if(!c.items.length) return 'empty';
  if(c.left === null) return 'nodate';
  if(c.left < 0) return 'past';
  if(c.left === 0) return 'today';
  if(c.items.every(function(i){ return i.left <= 0; })) return 'done';
  if(c.items.some(function(i){ return i.behind > 0; })) return 'late';
  if(c.wToday <= 0 && !c.onlyRest) return (c.days.length && c.days[0].review) ? 'review' : 'rest';
  return 'ok';
}
var AK2_STATUS = { ok:['順調', 'r0'], late:['遅れぎみ', 'warn'], done:['おわり', 'r1'], rest:['予備日', 'cr'], review:['見直しの日', 'cr'],
  today:['今日がテスト', 'warn'], past:['おわったテスト', 'cr'], empty:['範囲なし', 'cr'], nodate:['日付なし', 'cr'] };
function ak2StatusText(c){ return (AK2_STATUS[c.status] || AK2_STATUS.ok)[0]; }
function ak2StatusBadge(c){ var s = AK2_STATUS[c.status] || AK2_STATUS.ok; return '<span class="b ' + s[1] + '">' + esc(s[0]) + '</span>'; }
/* 1日ずつの予定（前の日の分をちょうど終えたとして） */
function ak2PlanSchedule(calc){
  var rems = calc.items.map(function(x){ return x.rem; });
  var W = calc.days.reduce(function(a, x){ return a + x.w; }, 0);
  return calc.days.map(function(day, k){
    var parts = calc.items.map(function(x, i){
      var q = 0;
      if(rems[i] > 0){
        if(W > 1e-9) q = day.w > 0 ? Math.min(rems[i], Math.ceil(rems[i] * day.w / W - 1e-9)) : 0;
        else q = k === 0 ? rems[i] : 0;
      }
      rems[i] -= q;
      return q;
    });
    W = Math.max(0, W - day.w);
    return { d:day.d, w:day.w, why:day.why, rest:day.rest, review:day.review, pre:day.pre, parts:parts };
  });
}
/* これからのテスト（計画があれば計算つき） */
function ak2Upcoming(ymd){
  ymd = ymd || today();
  return (S.exams || []).filter(function(x){ return x && isYmd(x.date) && x.date >= ymd; })
    .sort(function(a, b){ return a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || '')); })
    .map(function(ex){
      var p = ak2Plan(ex.id);
      return { ex:ex, p:p, calc:(p && ak2PlanItems(p).length) ? ak2PlanCalc(ex, p, ymd) : null, left:daysBetween(ymd, ex.date) };
    });
}
/* 今日タブに出すもの */
function ak2TodayList(){
  return ak2Upcoming().filter(function(x){
    if(!x.calc || x.left < 1) return false;
    return x.calc.items.some(function(i){ return i.q > 0 || i.on > 0; }) || x.calc.status === 'late' || x.left === 1;
  });
}
function ak2TodayLine(c){
  if(c.status === 'done') return '範囲はぜんぶ終わり 🎉';
  if(c.status === 'rest') return '今日は予備日';
  if(c.status === 'review') return '今日は見直しの日';
  if(c.status === 'today') return '今日がテスト！';
  if(c.status === 'past') return 'おわったテスト';
  var t = c.items.filter(function(i){ return i.q > 0; }).map(function(i){ return i.name + ' ' + i.q + ak2Unit(i) + (i.on >= i.q ? '✓' : ''); });
  return t.length ? '今日：' + t.join('・') : '今日の分はありません';
}
/* 今日やる分（チェックできる） */
function ak2TodayRows(x, inDetail){
  var c = x.calc, ex = x.ex;
  return c.items.filter(function(i){ return i.q > 0 || i.on > 0; }).map(function(i){
    var u = ak2Unit(i), on = i.on >= i.q && i.on > 0;
    if(i.deck){
      return '<div class="row ak2-do"><span class="chk' + (on ? ' on' : '') + '" aria-hidden="true">' + (on ? '✓' : '') + '</span>' +
        '<div class="grow"><div class="t">🃏 ' + esc(i.name) + '</div><div class="s">今日 はじめてのカード ' + i.q + '枚（いま ' + i.on + '枚）</div></div>' +
        '<button class="mini" data-act="ak2-deck-go" data-deck="' + esc(i.deck) + '">暗記する</button></div>';
    }
    return '<div class="row ak2-do"><button class="chk' + (on ? ' on' : '') + '" data-act="ak2-chk" data-ex="' + esc(ex.id) + '" data-it="' + esc(i.id) + '" aria-label="' + (on ? 'できたを取り消す' : 'できた') + '">' + (on ? '✓' : '') + '</button>' +
      '<div class="grow"><div class="t">' + esc(i.name) + '</div><div class="s">今日 <b>' + i.q + esc(u) + '</b>' + (i.on && !on ? '（' + i.on + esc(u) + 'できた）' : '') + '・のこり ' + i.left + esc(u) + '</div>' +
      (inDetail ? '<div class="ak2-set"><input type="number" inputmode="numeric" min="0" id="ak2_amt_' + esc(i.id) + '" placeholder="やった量" aria-label="今日やった量">' +
        '<button class="mini" data-act="ak2-amt" data-ex="' + esc(ex.id) + '" data-it="' + esc(i.id) + '">今日やった量を記録</button></div>' : '') +
      '</div></div>';
  }).join('');
}
function ak2StatusMsg(x, inDetail){
  var c = x.calc, h = '';
  if(c.status === 'late'){
    var bh = c.items.filter(function(i){ return i.behind > 0; }).map(function(i){ return i.name + ' ' + i.behind + ak2Unit(i); });
    var futRest = (x.p.rest || []).filter(function(d){ return d >= c.ymd && d < x.ex.date; });
    h += '<div class="ak2-late">⚠️ 予定より遅れています（' + esc(bh.join('・')) + '）。のこりの日で、1日の量を引き直しました。' +
      (futRest.length ? '予備日を使うこともできます。' : '') + '</div>';
    if(inDetail){
      h += '<div class="pillrow" style="margin:8px 0 0">' +
        (futRest.length ? '<button data-act="ak2-rest-use" data-ex="' + esc(x.ex.id) + '">予備日を1日つかう</button>' : '') +
        '<button data-act="ak2-replan" data-ex="' + esc(x.ex.id) + '">今日から計画を立て直す</button></div>';
    }
  }else if(c.status === 'done'){
    h += '<div class="ak2-good">🎉 範囲はぜんぶ終わりました。のこりの日は見直しに使いましょう。</div>';
  }else if(c.status === 'rest'){
    h += '<div class="ak2-info">今日は予備日です。遅れている分があれば、ここで取りもどしましょう。</div>';
  }else if(c.status === 'review' || (x.left === 1 && !c.items.some(function(i){ return i.q > 0; }))){
    h += '<div class="ak2-info">明日がテスト！ 今日は見直しの日です。まちがえたカードや、ひっかけ問題で仕上げましょう。</div>';
  }
  if(c.onlyRest && c.items.some(function(i){ return i.rem > 0; })){
    h += '<div class="ak2-late">のこりの日が予備日だけなので、今日にまとめています。予備日を減らすと分けられます。</div>';
  }
  return h;
}
function ak2ExamBlock(x){
  var c = x.calc;
  return '<div class="ak2-ex"><div class="ak2-exhd" data-act="ak2-plan-open" data-id="' + esc(x.ex.id) + '" role="button" tabindex="0">' +
      '<div class="grow"><div class="t">' + esc(ak2ExamName(x.ex)) + '</div><div class="s">' + esc(ak2KindName(x.ex)) + '・' + esc(ymdLabel(x.ex.date)) + '・あと' + x.left + '日</div></div>' +
      ak2StatusBadge(c) + '<span class="chev">›</span></div>' +
    ak2TodayRows(x, false) + ak2StatusMsg(x, false) + '</div>';
}
/* 今日タブの枠 */
function ak2TodayCard(ctx){
  if(ctx && ctx.isToday === false) return '';
  var list = ak2TodayList();
  if(!list.length) return '';
  var inner = list.map(ak2ExamBlock).join('');
  return typeof secWrap === 'function' ? secWrap('ak2plan', 'テスト勉強（今日の分）', list.length + '件', inner) : section('テスト勉強（今日の分）', list.length + '件', inner);
}
/* 暗記タブ：テストのところと、道具のボタン（anki.js から呼ぶ） */
function ak2ToolBtn(id, ic, title, badge){
  return '<button data-act="ak2-go" data-v="' + id + '"><span class="ic" aria-hidden="true">' + ic + '</span><span>' + esc(title) + '</span>' + (badge ? '<i>' + esc(badge) + '</i>' : '') + '</button>';
}
function ak2PlanRow(x){
  return '<div class="row"><div class="grow"><div class="t">' + esc(ak2ExamName(x.ex)) + ' <span class="s2">' + esc(ak2KindName(x.ex)) + '</span></div>' +
    '<div class="s">' + esc(ymdLabel(x.ex.date)) + (x.ex.time ? ' ' + esc(x.ex.time) : '') + '・' + (x.left === 0 ? '今日' : 'あと' + x.left + '日') + '</div>' +
    '<div class="s2">' + esc(x.calc ? ak2TodayLine(x.calc) : '範囲を入れると、1日にやる量を出します') + '</div></div>' +
    (x.calc ? ak2StatusBadge(x.calc) : '') +
    '<button class="mini" data-act="ak2-plan-open" data-id="' + esc(x.ex.id) + '">' + (x.calc ? 'ひらく' : '計画を作る') + '</button></div>';
}
function ak2AnkiTop(){
  var up = ak2Upcoming().filter(function(x){ return x.left <= 60; });
  var nW = ak2WrongList().length;
  return section('テストまでの計画', up.length ? up.length + '件' : null,
      (up.length ? up.slice(0, 5).map(ak2PlanRow).join('') : '<div class="empty">60日以内のテストはありません。</div>') +
      '<div class="pillrow" style="margin:10px 0 0"><button data-act="ak2-go" data-v="ak2-plan">テストの計画をぜんぶ見る</button></div>') +
    section('暗記の道具', null, '<div class="ak2-tools">' +
      ak2ToolBtn('ak2-ear', '🎧', '耳で暗記', '') + ak2ToolBtn('ak2-trap', '🪤', 'ひっかけ問題', '') +
      ak2ToolBtn('ak2-wrong', '❌', 'まちがえたカード', nW ? nW + '枚' : '') + ak2ToolBtn('ak2-anki', '📤', 'Ankiと交換', '') + '</div>');
}

/* ----- テスト範囲の画面（「勉強」タブ） ----- */
function ak2PlanView(){
  if(ak2State.plan){
    var ex0 = ak2Exam(ak2State.plan);
    if(ex0 && isYmd(ex0.date)) return ak2PlanDetail(ex0);   /* 日付のないテストは、逆算できないので一覧にもどす */
  }
  var up = ak2Upcoming();
  return section('テストまでの計画', up.length ? up.length + '件' : null,
    (up.length ? up.map(ak2PlanRow).join('') : '<div class="empty">これからのテストがありません。予定タブで「テスト」「小テスト」を追加すると、ここに出ます。</div>') +
    '<p class="note">テストごとに「範囲」（教科書のページ・章・プリント・暗記カードの科目など）を入れると、テストの日から逆算して「1日にやる量」を出します。バイトの日や授業が多い日は少なめ、授業のない日は多めにします。予備日も決められます。</p>');
}
function ak2PlanDetail(ex){
  var p = ak2Plan(ex.id), td = today();
  var calc = p ? ak2PlanCalc(ex, p) : null, x = { ex:ex, p:p, calc:calc, left:daysBetween(td, ex.date) };
  var h = '<div class="pillrow"><button data-act="ak2-plan-back">‹ テストの一覧</button></div>';
  var note = ak2KindName(ex) + '・' + ymdLabel(ex.date) + '・' + (x.left < 0 ? 'おわりました' : x.left === 0 ? '今日' : 'あと' + x.left + '日');
  var todayInner = '';
  if(!calc) todayInner = '<p class="note" style="margin-top:0">下の「範囲を足す」から、テストの範囲を入れてください。</p>';
  else if(x.left <= 0) todayInner = '<div class="ak2-info">' + (x.left === 0 ? '今日がテストです。がんばって！' : 'このテストはおわりました。') + '</div>';
  else{
    var rows = ak2TodayRows(x, true);
    todayInner = '<div class="ak2-sthd">今日やる分 ' + ak2StatusBadge(calc) + '</div>' + (rows || '<div class="empty">今日やる分はありません。</div>') + ak2StatusMsg(x, true);
  }
  h += section(ak2ExamName(ex), note, todayInner);
  /* 範囲 */
  var items = calc ? calc.items : [];
  var decks = ankiDecks();
  h += section('範囲', items.length ? items.length + 'こ' : null,
    items.map(function(i){
      var u = ak2Unit(i), got = i.before + i.on, pct = i.amount ? Math.round(Math.min(1, got / i.amount) * 100) : 0;
      return '<div class="row ak2-item"><div class="grow"><div class="t">' + (i.deck ? '🃏 ' : '') + esc(i.name) + '</div>' +
        '<div class="s">' + got + ' / ' + i.amount + esc(u) + '（のこり ' + Math.max(0, i.amount - got) + esc(u) + '）</div>' +
        '<div class="ak2-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
        (i.deck ? '<div class="s2">暗記カードを「はじめて見た」枚数で、自動で進みます。</div>'
          : '<div class="ak2-set"><input type="number" inputmode="numeric" min="0" id="ak2_done_' + esc(i.id) + '" value="' + got + '" aria-label="終わった量（ぜんぶで）">' +
            '<button class="mini" data-act="ak2-item-set" data-ex="' + esc(ex.id) + '" data-it="' + esc(i.id) + '">終わった量を直す</button></div>') +
        '</div><button class="mini" data-act="ak2-item-del" data-ex="' + esc(ex.id) + '" data-it="' + esc(i.id) + '">消す</button></div>';
    }).join('') +
    '<label class="f" style="margin-top:12px">範囲を足す</label>' +
    '<div class="field"><input id="ak2_it_name" placeholder="例：教科書 p.20〜80／第3章／配布プリント" aria-label="範囲の名前"></div>' +
    '<div class="grid2"><input id="ak2_it_amt" type="number" inputmode="numeric" min="1" placeholder="量（例：60）" aria-label="量">' +
      '<select id="ak2_it_unit" aria-label="単位">' + AK2_UNITS.map(function(u){ return '<option>' + u + '</option>'; }).join('') + '</select></div>' +
    (decks.length ? '<div class="field" style="margin-top:8px"><label class="f" for="ak2_it_deck">または、暗記カードの科目を範囲にする</label><select id="ak2_it_deck"><option value="">（使わない）</option>' +
      decks.map(function(d){ return '<option value="' + esc(d.name) + '">' + esc(d.name) + '（' + d.n + '枚）</option>'; }).join('') + '</select></div>' : '') +
    '<button class="btn ghost" style="margin-top:8px" data-act="ak2-item-add" data-ex="' + esc(ex.id) + '">範囲を足す</button>' +
    '<p class="note">「p.20〜80」と書くと、量を入れなくてもページ数を数えます。</p>');
  if(!p) return h;
  /* 日の決め方 */
  var days = [], d = td, g = 0;
  while(d < ex.date && g++ < 60){ days.push(d); d = shiftDate(d, 1); }
  h += section('日の決め方', null,
    '<div class="field"><label class="f" for="ak2_start">はじめる日</label><div class="pair"><input type="date" id="ak2_start" value="' + esc(p.start || td) + '">' +
      '<button class="btn ghost" style="flex:0 0 auto" data-act="ak2-start" data-ex="' + esc(ex.id) + '">変える</button></div></div>' +
    '<label class="tg"><input type="checkbox" data-act="ak2-review" data-ex="' + esc(ex.id) + '"' + (p.review !== 0 ? ' checked' : '') + '>テストの前の日は「見直しの日」にする（新しい範囲を入れない）</label>' +
    '<label class="f" style="margin-top:12px">予備日（押すと切りかわります。予備日には新しい範囲を入れず、遅れたときに使います）</label>' +
    (days.length ? '<div class="ak2-days">' + days.map(function(dd){
      var on = (p.rest || []).indexOf(dd) >= 0;
      return '<button data-act="ak2-rest" data-ex="' + esc(ex.id) + '" data-d="' + dd + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(ak2Md(dd)) + (on ? ' 予備' : '') + '</button>';
    }).join('') + '</div>' : '<div class="empty">のこりの日がありません。</div>') +
    '<div class="pillrow" style="margin:10px 0 0"><button data-act="ak2-replan" data-ex="' + esc(ex.id) + '">今日から計画を立て直す</button></div>' +
    '<p class="note">毎日、のこりの量とのこりの日から「今日やる分」を計算しなおすので、遅れても自動で引き直されます。「立て直す」を押すと、今日を新しいスタートにして「遅れ」を数えなおします。</p>');
  /* 1日ずつ */
  if(calc && calc.days.length){
    var sch = ak2PlanSchedule(calc);
    h += section('1日ずつの予定', sch.length + '日', '<div class="ak2-sched">' + sch.map(function(s){
      var txt = s.parts.map(function(q, i){ return q > 0 ? calc.items[i].name + ' ' + q + ak2Unit(calc.items[i]) : ''; }).filter(Boolean).join('・');
      var tag = s.rest ? '予備日' : s.review ? '見直しの日' : s.pre ? 'まだはじめない日' : '';
      return '<div class="row' + (s.w <= 0 ? ' ak2-off' : '') + '"><div class="ak2-sd num">' + esc(s.d === td ? '今日' : ak2Md(s.d)) + '</div>' +
        '<div class="grow"><div class="s">' + esc(txt || tag || '—') + '</div>' +
        (!tag && s.why.length ? '<div class="s2">' + esc(s.why.join('・')) + (s.w < 1 ? 'なので少なめ' : s.w > 1 ? 'なので多め' : '') + '</div>' : '') + '</div></div>';
    }).join('') + '</div>');
  }
  h += '<div class="pillrow" style="margin-top:4px">' + (ak2State.delAsk === ex.id
    ? '<button data-act="ak2-plan-del" data-ex="' + esc(ex.id) + '" class="on">本当に計画を消す</button><button data-act="ak2-plan-delno">やめる</button>'
    : '<button data-act="ak2-plan-delask" data-ex="' + esc(ex.id) + '">この計画を消す</button>') + '</div>';
  return h;
}
/* ----- 計画の操作 ----- */
function ak2FindItem(p, itId){ return ak2PlanItems(p).filter(function(i){ return i.id === itId; })[0] || null; }
function ak2LogToday(p){
  var td = today(), n = 0;
  ak2PlanItems(p).forEach(function(it){ if(!it.deck && it.dd && it.dd.d === td) n += toNum(it.dd.n); });
  if(n) p.log[td] = n; else delete p.log[td];
}
function ak2ItemAdd(exId){
  var ex = ak2Exam(exId);
  if(!ex){ toast('テストが見つかりません', true); return; }
  var deck = val('ak2_it_deck'), name = val('ak2_it_name').trim(), amt = toNum(val('ak2_it_amt')), unit = val('ak2_it_unit') || 'ページ', it;
  if(deck){
    var n = ankiCards().filter(function(c){ return c.deck === deck; }).length;
    if(!n){ toast('その科目にはカードがありません', true); return; }
    it = { id:uid('ak2i'), name:(name || deck + 'の暗記カード').slice(0, 80), amount:n, unit:'枚', done:0, deck:deck };
  }else{
    if(!name){ toast('範囲の名前を入れてください（例：教科書 p.20〜80）', true); return; }
    if(amt <= 0){ amt = ak2GuessAmt(name); if(amt) unit = 'ページ'; }
    if(amt <= 0){ toast('量を数字で入れてください（例：60）', true); return; }
    it = { id:uid('ak2i'), name:name.slice(0, 80), amount:Math.min(amt, 100000), unit:AK2_UNITS.indexOf(unit) >= 0 ? unit : 'ページ', done:0 };
  }
  var p = ak2PlanEnsure(exId);
  p.items.push(it);
  ak2PlanSave(p);
  commit(); toast('範囲を足しました');
}
function ak2Check(exId, itId){
  var ex = ak2Exam(exId), p = ak2Plan(exId), it = p && ak2FindItem(p, itId);
  if(!ex || !it || it.deck) return;
  p = ak2PlanEnsure(exId);
  var x = ak2PlanCalc(ex, p).items.filter(function(i){ return i.id === itId; })[0];
  if(!x) return;
  var td = today();
  if(x.on > 0 && x.on >= x.q){
    it.done = Math.max(0, toNum(it.done) - x.on); it.dd = { d:td, n:0 };
    toast('チェックをはずしました');
  }else{
    var add = Math.max(0, x.q - x.on);
    if(!add){ toast('今日やる分はありません'); return; }
    it.done = toNum(it.done) + add; it.dd = { d:td, n:x.on + add };
    toast(it.name + '：今日の分ができました');
  }
  ak2LogToday(p); ak2PlanSave(p);
  commit();
}
/* 今日やった量（一部だけ・多めにできたとき） */
function ak2Amount(exId, itId){
  var p = ak2Plan(exId), it = p && ak2FindItem(p, itId);
  if(!ak2Exam(exId) || !it || it.deck) return;
  var raw = val('ak2_amt_' + itId).trim();
  if(raw === ''){ toast('やった量を数字で入れてください', true); return; }
  var st = ak2ItemState(it, today());
  var n = Math.min(Math.max(0, toNum(raw)), Math.max(0, st.amount - st.before));
  p = ak2PlanEnsure(exId);
  it.done = st.before + n; it.dd = { d:today(), n:n };
  ak2LogToday(p); ak2PlanSave(p);
  commit(); toast('今日 ' + n + ak2Unit(it) + ' を記録しました');
}
function ak2ItemSet(exId, itId){
  var p = ak2Plan(exId), it = p && ak2FindItem(p, itId);
  if(!it || it.deck) return;
  var n = Math.max(0, Math.min(toNum(val('ak2_done_' + itId)), toNum(it.amount)));
  p = ak2PlanEnsure(exId);
  it.done = n; it.dd = { d:today(), n:0 };
  ak2LogToday(p); ak2PlanSave(p);
  commit(); toast('終わった量を ' + n + ak2Unit(it) + ' にしました');
}
function ak2PlanChange(exId, fn){
  if(!ak2Plan(exId)) return;
  var p = ak2PlanEnsure(exId);
  if(fn(p) === false) return;
  ak2PlanSave(p);
  commit();
}

/* ============================== #121 まちがえたカード・解説 ============================== */
function ak2Miss(c){ return Math.max(toNum(c && c.miss), toNum(c && c.lapses)); }
function ak2WrongList(){
  return ankiCards().filter(function(c){ return ak2Miss(c) > 0 || c.explain; })
    .sort(function(a, b){ return ak2Miss(b) - ak2Miss(a) || String(b.missAt || '').localeCompare(String(a.missAt || '')) || (toNum(a.mt) - toNum(b.mt)); });
}
/* 関係しそうなメモをさがす（2文字ずつの重なりで数える。ひらがなだけの組は数えない） */
function ak2Grams(s){
  var t = norm(String(s || '')).replace(/[\s、。・，．,.!?！？「」『』（）()\[\]【】:：;；\/／〜~→]+/g, ' '), g = {};
  for(var i = 0; i < t.length - 1; i++){
    var b = t.substr(i, 2);
    if(/\s/.test(b) || /^[぀-ゟ]{2}$/.test(b)) continue;
    g[b] = 1;
  }
  return Object.keys(g);
}
function ak2NotesFor(text, deck, max){
  var keys = ak2Grams(text);
  if(!keys.length) return [];
  var need = Math.max(3, Math.ceil(keys.length * 0.3));
  return (S.notes || []).map(function(n){
    if(!n) return null;
    var body = String(n.title || '') + '\n' + String(n.body || '');
    if(AK2_SECRET_NOTE.test(body)) return null;
    var nb = norm(body), sc = 0;
    keys.forEach(function(k){ if(nb.indexOf(k) >= 0) sc++; });
    if(deck && n.link && n.link.type === 'course' && typeof sameSubject === 'function' && sameSubject(n.link.id, deck)) sc += 2;
    return sc >= need ? { n:n, sc:sc, body:body } : null;
  }).filter(Boolean).sort(function(a, b){ return b.sc - a.sc; }).slice(0, max || 2).map(function(x){
    /* 長いメモは、重なったところのまわりだけ */
    var nb = norm(x.body), at = -1;
    for(var i = 0; i < keys.length && at < 0; i++) at = nb.indexOf(keys[i]);
    var from = Math.max(0, (at < 0 ? 0 : at) - 250);
    return { id:x.n.id, title:String(x.n.title || '無題のメモ'), text:x.body.slice(from, from + 700) };
  });
}
function ak2ExplainPrompt(c, notes){
  return 'あなたは看護学生の勉強を手伝う先生です。暗記カードでまちがえた問題に、短い解説をつけてください。\n' +
    '・なぜその答えになるのか（根拠・しくみ）を2〜3文で。やさしい日本語で。\n' +
    '・覚え方のコツ（tip）と、ごろあわせ（goro。よいものがなければ空。むりに作らない）。\n' +
    '・いっしょに覚えるとよい関係する知識（related）を1〜2こ。\n' +
    '・ぜんぶで300字くらいまで。\n' +
    '・下の「手帳のメモ」に関係することが書いてあれば、それを優先して使い、使ったメモの番号を memo に入れる。使わなければ memo は 0。\n' +
    '・数値や薬のことは、教科書とちがうことがあるので、言い切りすぎない。患者さんの名前など、個人の情報は書かない。\n' +
    'JSONだけで答える：{"explain":"解説","tip":"覚え方のコツ","goro":"ごろあわせ（なければ空）","related":["関係する知識"],"memo":0}\n\n' +
    'カード：\n科目：' + (c.deck || '') + '\n問い：' + c.q + '\n答え：' + c.a + '\n\n' +
    '手帳のメモ：' + (notes.length ? '\n' + notes.map(function(n, i){ return '[' + (i + 1) + '] 題名：' + n.title + '\n' + n.text; }).join('\n\n') : 'なし');
}
function ak2ExplainText(j){
  var lines = [], s = function(v){ return String(v == null ? '' : v).trim(); };
  if(s(j.explain)) lines.push(s(j.explain));
  if(s(j.tip)) lines.push('覚え方：' + s(j.tip));
  if(s(j.goro)) lines.push('ごろあわせ：' + s(j.goro));
  var rel = (Array.isArray(j.related) ? j.related : j.related ? [j.related] : []).map(s).filter(Boolean).slice(0, 3);
  if(rel.length) lines.push('関係すること：' + rel.join('／'));
  return lines.join('\n').slice(0, 900);
}
async function ak2Explain(id){
  var c = ak2Card(id);
  if(!c) return;
  if(!aiReady()){ toast('先に設定タブでAI（Gemini）のキーを登録してください', true); return; }
  if(ak2State.busy) return;
  ak2State.busy = 'exp:' + id; render();
  var ok = false;
  try{
    var notes = ak2NotesFor(c.q + ' ' + c.a, c.deck, 2);
    var out = await aiGenerate({ contents:[{ role:'user', parts:[{ text:ak2ExplainPrompt(c, notes) }] }], json:true, temperature:0.3, maxTokens:2048, tag:'ak2-explain' });
    var j = parseJsonLoose(out) || {};
    var text = ak2ExplainText(j);
    if(!text) throw new Error('解説が空でした');
    var mi = toNum(j.memo), note = (mi >= 1 && mi <= notes.length) ? notes[mi - 1] : null;
    c = ak2Card(id);                              /* 待っているあいだに同期で入れかわっていても大丈夫なように */
    if(!c) throw new Error('カードが消されました');
    c.explain = text;
    c.explainSrc = note ? 'メモ「' + note.title + '」' : AK2_GENERAL;
    c.explainNote = note ? note.id : '';
    c.explainAt = Date.now(); c.mt = Date.now();
    ok = true;
  }catch(e){
    toast('解説を作れませんでした：' + (e && e.message || e), true);
  }finally{
    ak2State.busy = '';
    if(ok){ persist(); pushRemote(); toast('解説をつけました'); }
    if(isTyping()) renderLater(); else render();
  }
}
function ak2ExplainHtml(c){
  if(ak2State.busy === 'exp:' + c.id) return '<div class="ak2-exp"><p class="note" style="margin:0">💡 AIが解説を作っています…</p></div>';
  if(!c.explain) return '<button class="btn ghost ak2-whybtn" data-act="ak2-explain" data-id="' + esc(c.id) + '"' + (ak2State.busy ? ' disabled' : '') + '>💡 なぜ？解説をつくる</button>';
  return '<div class="ak2-exp"><div class="ak2-exphd">💡 解説</div><div class="ak2-expbody">' + esc(c.explain) + '</div>' +
    '<div class="s2 ak2-src">出典：' + esc(c.explainSrc || AK2_GENERAL) + '<br>' + AK2_CHECK + '</div>' +
    '<div class="pillrow" style="margin:8px 0 0"><button data-act="ak2-explain" data-id="' + esc(c.id) + '"' + (ak2State.busy ? ' disabled' : '') + '>作り直す</button>' +
    '<button data-act="ak2-expdel" data-id="' + esc(c.id) + '">解説を消す</button></div></div>';
}
/* 暗記の最中（答えを見たとき）に出す：anki.js から呼ぶ */
function ak2StudyExtra(c){
  if(!c) return '';
  if(c.explain){
    if(ak2Ui().showExp || ak2State.expOpen[c.id]) return ak2ExplainHtml(c);
    return '<button class="mini ak2-whybtn" data-act="ak2-expshow" data-id="' + esc(c.id) + '">💡 解説を見る</button>';
  }
  var missed = ak2Miss(c) > 0 || (ankiState.missed || []).indexOf(c.id) >= 0;
  if(!missed && ak2State.busy !== 'exp:' + c.id) return '';
  return ak2ExplainHtml(c) + '<p class="s2 ak2-aino">カードと、関係しそうなメモの一部をAIに送ります。</p>';
}
/* 暗記がおわった画面：今回わからなかったカード（anki.js から呼ぶ） */
function ak2DoneExtra(){
  var list = (ankiState.missed || []).map(ak2Card).filter(Boolean);
  if(!list.length) return '';
  return '<div class="ak2-done"><div class="t">わからなかったカード（' + list.length + '枚）</div>' +
    list.map(function(c){ return '<div class="ak2-dc"><div class="t">' + esc(c.q) + '</div><div class="s">' + esc(c.a) + '</div>' + ak2ExplainHtml(c) + '</div>'; }).join('') +
    '<div class="pillrow" style="margin-top:8px"><button data-act="ak2-go" data-v="ak2-wrong">まちがえたカードの一覧</button></div></div>';
}
function ak2WrongView(){
  var all = ak2WrongList(), dk = ak2State.wrongDeck || '', decks = [];
  all.forEach(function(c){ if(decks.indexOf(c.deck) < 0) decks.push(c.deck); });
  if(dk && decks.indexOf(dk) < 0) dk = '';
  var list = all.filter(function(c){ return !dk || c.deck === dk; });
  return section('❌ まちがえたカード', list.length + '枚・まちがえた回数の多い順',
    (all.length
      ? (decks.length > 1 ? '<div class="pillrow"><button data-act="ak2-wrong-deck" data-v="" class="' + (!dk ? 'on' : '') + '">ぜんぶ</button>' +
          decks.map(function(d){ return '<button data-act="ak2-wrong-deck" data-v="' + esc(d) + '" class="' + (dk === d ? 'on' : '') + '">' + esc(ak2Short(d || 'そのほか')) + '</button>'; }).join('') + '</div>' : '') +
        '<button class="btn" data-act="ak2-wrong-study" data-v="' + esc(dk) + '">この中から暗記する（' + Math.min(list.length, 30) + '枚）</button>' +
        '<button class="btn ghost" style="margin-top:8px" data-act="ak2-go" data-v="ak2-ear" data-src="wrong">🎧 耳で聞く</button>' +
        '<label class="tg"><input type="checkbox" data-act="ak2-showexp"' + (ak2Ui().showExp ? ' checked' : '') + '>暗記のとき、カードの裏に解説も出す</label>' +
        list.slice(0, 200).map(function(c){
          return '<div class="ak2-wrow' + (ak2State.focus === c.id ? ' ak2-focus' : '') + '" id="ak2w_' + esc(c.id) + '">' +
            '<div class="row ak2-wtop"><span class="ak2-cnt">×' + ak2Miss(c) + '</span>' +
            '<div class="grow"><div class="t">' + esc(c.q) + '</div><div class="s">' + esc(c.a) + '</div>' +
            '<div class="s2">' + esc(c.deck || '') + (c.missAt ? '・最後にまちがえた日 ' + esc(ymdLabel(c.missAt)) : '') + '</div></div></div>' +
            ak2ExplainHtml(c) + '</div>';
        }).join('')
      : '<div class="empty">まだありません。暗記で「もう一回」を押したカードが、ここに集まります。</div>') +
    '<p class="note">「なぜ？解説」を押すと、AIが覚え方のコツ・ごろあわせ・関係する知識を短くまとめて、そのカードに保存します（ほかの端末にも届きます）。手帳のメモに関係することが書いてあれば、それを使って、出典にメモの題名を書きます。</p>' +
    '<p class="note">⚠️ カードと、関係しそうなメモの一部がAI（Gemini）に送られます（「患者」「実習記録」「カルテ」などの言葉があるメモは送りません）。</p>');
}
function ak2WrongStudy(dk){
  var ids = ak2WrongList().filter(function(c){ return !dk || c.deck === dk; }).slice(0, 30).map(function(c){ return c.id; });
  if(!ids.length){ toast('カードがありません', true); return; }
  ankiState.mode = 'study'; ankiState.deck = dk || ''; ankiState.title = 'まちがえたカード';
  ankiState.queue = ids.slice(); ankiState.cur = ankiState.queue.shift();
  ankiState.show = false; ankiState.done = 0; ankiState.ok = 0; ankiState.missed = [];
  appId = 'anki'; render(); window.scrollTo(0, 0);
}

/* ============================== #18 耳で暗記 ============================== */
var ak2Ear = { on:0, paused:0, ids:[], i:0, rep:0, round:1, phase:'', gen:0, timer:null, dog:null, utts:[], prefs:null, src:'', label:'', lock:null };
function ak2Tts(){
  if(TEST_MODE){ var f = kmFake('__FAKE_TTS'); if(f) return f; }
  try{ return window.speechSynthesis || null; }catch(e){ return null; }
}
function ak2Utter(text){
  if(TEST_MODE && kmFake('__FAKE_TTS')) return { text:text };
  return new SpeechSynthesisUtterance(text);
}
function ak2Voices(){ var t = ak2Tts(); try{ return (t && t.getVoices) ? (t.getVoices() || []) : []; }catch(e){ return []; } }
function ak2VoiceList(en){ return ak2Voices().filter(function(v){ return en ? /^en/i.test(v.lang) : /^ja/i.test(v.lang); }); }
function ak2VoicePick(en){
  var want = ak2Local()[en ? 'ven' : 'vja'], vs = ak2VoiceList(en);
  return vs.filter(function(v){ return v.name === want; })[0] ||
    (en ? vs.filter(function(v){ return /en[-_]US/i.test(v.lang); })[0] : null) || vs[0] || null;
}
/* 日本語と英語に分ける（英語の単語が3文字以上つづくところだけ英語の声。SpO2 などの略語は日本語の声で読む） */
function ak2Segs(text, en){
  text = String(text || '').replace(/\s+/g, ' ').trim();
  if(!text) return [];
  if(!en) return [{ t:text, en:false }];
  var out = [], last = 0, m, re = /[A-Za-z][A-Za-z0-9'’\-]*(?:[ ,.\/]+[A-Za-z][A-Za-z0-9'’\-]*)*/g;
  while((m = re.exec(text))){
    if(!/[a-z]{3,}/.test(m[0])) continue;
    if(m.index > last) out.push({ t:text.slice(last, m.index), en:false });
    out.push({ t:m[0], en:true });
    last = m.index + m[0].length;
  }
  if(last < text.length) out.push({ t:text.slice(last), en:false });
  return out.map(function(s){ return { t:s.t.trim(), en:s.en }; })
    .filter(function(s){ return /[^\s、。,.・:：;；()（）]/.test(s.t); });
}
function ak2EarCards(src){
  src = String(src || 'due');
  if(src === 'due') return ankiDueList('');
  if(src === 'wrong') return ak2WrongList();
  if(src.indexOf('deck:') === 0){ var d = src.slice(5); return ankiCards().filter(function(c){ return c.deck === d; }); }
  return [];
}
function ak2EarSrcLabel(src){
  if(src === 'due') return '今日の復習分';
  if(src === 'wrong') return 'まちがえたカード';
  if(String(src).indexOf('deck:') === 0) return ak2Short(src.slice(5));
  return '';
}
function ak2EarCur(){ return ak2Card(ak2Ear.ids[ak2Ear.i]); }
/* 読みかけ・待ちをぜんぶ止める（古い合図は gen で見分けて無視する） */
function ak2EarClear(){
  ak2Ear.gen++;
  clearTimeout(ak2Ear.timer); clearTimeout(ak2Ear.dog);
  var t = ak2Tts();
  try{ if(t && t.cancel && (TEST_MODE || t.speaking || t.pending)) t.cancel(); }catch(e){}
}
/* 文を読む（英語のところは英語の声）。読みおわったら done */
function ak2Say(text, done){
  var E = ak2Ear, gen = E.gen, pr = E.prefs || ak2Ui(), tts = ak2Tts(), fired = false;
  var fin = function(){
    if(fired || gen !== E.gen) return;
    fired = true; clearTimeout(E.dog); done();
  };
  var segs = ak2Segs(text, pr.en);
  if(!tts || !segs.length){ E.timer = setTimeout(fin, ak2Ms(0.3)); return; }
  segs.forEach(function(s, k){
    var u = ak2Utter(s.t);
    u.lang = s.en ? 'en-US' : 'ja-JP';
    var v = ak2VoicePick(s.en);
    if(v) u.voice = v;
    u.rate = pr.rate; u.pitch = 1; u.volume = 1;
    if(k === segs.length - 1){ u.onend = fin; u.onerror = fin; }
    E.utts.push(u);                                  /* 読みおわるまで持っておく（途中で消えると、おわりの合図が来ない） */
    if(E.utts.length > 40) E.utts.splice(0, E.utts.length - 40);
    try{ tts.speak(u); }catch(e){}
  });
  /* おわりの合図が来ないときの見はり */
  clearTimeout(E.dog);
  E.dog = setTimeout(fin, ak2Ms(Math.max(5, String(text).length * 0.35 / pr.rate + 4)));
}
function ak2EarRun(){
  var E = ak2Ear, c = ak2EarCur(), gen;
  if(!E.on) return;
  if(!c){
    if(E.i + 1 < E.ids.length){ E.i++; ak2EarRun(); } else ak2EarEnd();
    return;
  }
  ak2EarClear(); gen = E.gen;
  E.phase = 'q'; ak2EarPaint();
  ak2Say(c.q, function(){
    E.phase = 'wait'; ak2EarPaint();
    E.timer = setTimeout(function(){
      if(gen !== E.gen) return;
      E.phase = 'a'; ak2EarPaint();
      var txt = (E.prefs.ans ? 'こたえ。' : '') + c.a + (E.prefs.exp && c.explain ? '。解説。' + c.explain : '');
      ak2Say(txt, function(){
        E.phase = 'gap'; ak2EarPaint();
        E.timer = setTimeout(function(){ if(gen === E.gen) ak2EarAdvance(); }, ak2Ms(1.2));
      });
    }, ak2Ms(E.prefs.wait));
  });
}
function ak2EarAdvance(){
  var E = ak2Ear;
  E.rep++;
  if(E.rep < E.prefs.rep){ ak2EarRun(); return; }
  E.rep = 0;
  if(E.i + 1 < E.ids.length){ E.i++; ak2EarRun(); return; }
  if(E.prefs.loop){ E.i = 0; E.round++; ak2EarRun(); return; }
  ak2EarEnd();
}
function ak2EarEnd(){
  var E = ak2Ear;
  ak2EarClear();
  E.phase = 'end'; ak2EarPaint();
  ak2Say('おわりです。おつかれさまでした。', function(){
    E.on = 0; E.phase = ''; ak2WakeLock(false);
    if(appId === 'study' && studyTool === 'ak2-ear' && !isTyping()) render();
    toast('耳で暗記：' + E.ids.length + '枚を聞きました');
  });
}
function ak2EarStart(){
  var tts = ak2Tts();
  if(!tts){ toast('この端末では読み上げが使えません', true); return; }
  var old = ak2Ui();
  var pr = { wait:Math.max(0, toNum(ak2FormVal('ak2_ear_wait', old.wait))), rate:parseFloat(ak2FormVal('ak2_ear_rate', old.rate)) || 1,
    rep:Math.max(1, toNum(ak2FormVal('ak2_ear_rep', old.rep)) || 1), loop:ak2FormChk('ak2_ear_loop', old.loop), mix:ak2FormChk('ak2_ear_mix', old.mix),
    en:ak2FormChk('ak2_ear_en', old.en), ans:ak2FormChk('ak2_ear_ans', old.ans), exp:ak2FormChk('ak2_ear_exp', old.exp) };
  var src = ak2FormVal('ak2_ear_src', ak2Local().src || 'due');
  var list = ak2EarCards(src);
  if(!list.length){ toast('聞くカードがありません', true); return; }
  var changed = ['wait', 'rate', 'rep', 'loop', 'mix', 'en', 'ans', 'exp'].some(function(k){ return pr[k] !== old[k]; });
  if(changed) ak2UiSet({ wait:pr.wait, rate:pr.rate, rep:pr.rep, loop:pr.loop, mix:pr.mix, en:pr.en, ans:pr.ans, exp:pr.exp });
  var loc = { src:src }, vj = document.getElementById('ak2_ear_vja'), ve = document.getElementById('ak2_ear_ven');
  if(vj) loc.vja = vj.value;
  if(ve) loc.ven = ve.value;
  ak2LocalSet(loc);
  var ids = list.map(function(c){ return c.id; });
  if(pr.mix) ak2Shuffle(ids);
  ak2EarClear();
  Object.assign(ak2Ear, { on:1, paused:0, ids:ids, i:0, rep:0, round:1, prefs:pr, src:src, label:ak2EarSrcLabel(src) + '・' + ids.length + '枚', phase:'' });
  ak2WakeLock(true);
  if(changed) commit(); else render();
  window.scrollTo(0, 0);
  ak2EarRun();                                      /* iPhoneでは、押したその場で読みはじめる必要がある */
}
function ak2EarPause(){
  var E = ak2Ear;
  if(!E.on) return;
  ak2EarClear();
  E.paused = 1; E.phase = 'pause';
  ak2WakeLock(false);
  ak2EarPaint();
}
function ak2EarResume(){
  var E = ak2Ear;
  if(!E.on) return;
  E.paused = 0; E.rep = 0;
  ak2WakeLock(true);
  ak2EarRun();
}
function ak2EarMove(step){
  var E = ak2Ear;
  if(!E.on) return;
  ak2EarClear();
  E.paused = 0; E.rep = 0;
  var n = E.i + step;
  if(n >= E.ids.length){
    if(!E.prefs.loop){ ak2EarEnd(); return; }
    n = 0; E.round++;
  }
  E.i = Math.max(0, n);
  ak2EarRun();
}
function ak2EarStop(){
  ak2EarClear();
  ak2Ear.on = 0; ak2Ear.paused = 0; ak2Ear.phase = '';
  ak2WakeLock(false);
  render();
}
function ak2EarTry(){
  var tts = ak2Tts();
  if(!tts){ toast('この端末では読み上げが使えません', true); return; }
  if(ak2Ear.on) return;
  var old = ak2Ui(), loc = {};
  var vj = document.getElementById('ak2_ear_vja'), ve = document.getElementById('ak2_ear_ven');
  if(vj) loc.vja = vj.value;
  if(ve) loc.ven = ve.value;
  ak2LocalSet(loc);
  ak2EarClear();
  ak2Ear.prefs = { wait:old.wait, rate:parseFloat(ak2FormVal('ak2_ear_rate', old.rate)) || 1, rep:1, loop:0, mix:0, en:ak2FormChk('ak2_ear_en', old.en), ans:1, exp:0 };
  ak2Say('こんにちは。耳で暗記のためしです。英語は、blood pressure のように読みます。', function(){});
}
/* 画面が消えないようにする（できる端末だけ） */
function ak2WakeLock(on){
  if(TEST_MODE) return;
  try{
    if(on){
      if(!ak2Ear.lock && navigator.wakeLock && navigator.wakeLock.request){
        navigator.wakeLock.request('screen').then(function(l){ ak2Ear.lock = l; }).catch(function(){});
      }
    }else if(ak2Ear.lock){
      var l = ak2Ear.lock; ak2Ear.lock = null;
      l.release().catch(function(){});
    }
  }catch(e){}
}
function ak2EarLive(){
  var E = ak2Ear, c = ak2EarCur();
  if(!E.on) return '';
  var showA = E.phase === 'a' || E.phase === 'gap' || E.paused || E.phase === 'end';
  var ph = E.paused ? '⏸ 止めています（「つづける」で、このカードから読みなおします）'
    : E.phase === 'q' ? '🔊 問題を読んでいます'
    : E.phase === 'wait' ? '🤔 考えてね（' + E.prefs.wait + '秒）'
    : E.phase === 'a' ? '🔊 こたえ'
    : E.phase === 'end' ? 'おわりです' : '…';
  return '<div class="s ak2-earpos">' + (E.i + 1) + ' / ' + E.ids.length + '枚' + (E.prefs.rep > 1 ? '（' + (E.rep + 1) + '回目）' : '') + (E.round > 1 ? '・' + E.round + '周目' : '') + '</div>' +
    (c ? '<div class="ankideck s2">' + esc(c.deck || '') + '</div><div class="ak2-earq">' + esc(c.q) + '</div>' +
      '<div class="ak2-eara">' + (showA ? esc(c.a) : '<span class="s2">（このあと、こたえ）</span>') + '</div>' : '') +
    '<div class="ak2-earph" aria-live="polite">' + ph + '</div>' +
    '<div class="ak2-bigbtns">' +
      '<button data-act="ak2-ear-prev"><span class="ic" aria-hidden="true">⏮</span>前へ</button>' +
      (E.paused ? '<button class="main" data-act="ak2-ear-resume"><span class="ic" aria-hidden="true">▶</span>つづける</button>'
                : '<button class="main" data-act="ak2-ear-pause"><span class="ic" aria-hidden="true">⏸</span>一時停止</button>') +
      '<button data-act="ak2-ear-next"><span class="ic" aria-hidden="true">⏭</span>次へ</button>' +
    '</div>' +
    '<button class="btn ghost ak2-stop" data-act="ak2-ear-stop">⏹ おわる</button>';
}
function ak2EarPaint(){
  var el = document.getElementById('ak2-ear-live');
  if(el) el.innerHTML = ak2EarLive();
}
var AK2_EAR_NOTE = '📱 iPhoneでは、画面をロックしたり、ほかのアプリに切りかえると、読み上げが止まります（iPhoneの決まりです）。' +
  '聞いているあいだは画面をつけたままにしてください（設定 › 画面表示と明るさ › 自動ロック を長めに）。' +
  '止まったら「つづける」を押すと、そのカードから読みなおします。音が出ないときは、消音スイッチと音量を確かめてください。';
function ak2EarView(){
  if(ak2Ear.on){
    return section('🎧 耳で暗記', ak2Ear.label, '<div class="ak2-ear" id="ak2-ear-live">' + ak2EarLive() + '</div>') +
      '<p class="note">' + esc(AK2_EAR_NOTE) + '</p>';
  }
  var tts = ak2Tts(), u = ak2Ui(), loc = ak2Local(), src = loc.src || 'due';
  if(!tts) return section('🎧 耳で暗記', null, '<div class="msg ng">この端末（ブラウザ）では、読み上げが使えません。</div>');
  var decks = ankiDecks(), nDue = ankiDueList('').length, nWrong = ak2WrongList().length;
  var opt = function(v, label){ return '<option value="' + esc(v) + '"' + (v === src ? ' selected' : '') + '>' + esc(label) + '</option>'; };
  var sel = function(id, list, cur, label){
    return '<div class="field"><label class="f" for="' + id + '">' + label + '</label><select id="' + id + '">' + list.map(function(x){
      return '<option value="' + x[0] + '"' + (String(x[0]) === String(cur) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select></div>';
  };
  var vja = ak2VoiceList(false), ven = ak2VoiceList(true), pj = ak2VoicePick(false), pe = ak2VoicePick(true);
  var voiceSel = function(id, vs, pick, label){
    if(!vs.length) return '';
    return '<div class="field"><label class="f" for="' + id + '">' + label + '</label><select id="' + id + '">' + vs.map(function(v){
      return '<option value="' + esc(v.name) + '"' + (pick && pick.name === v.name ? ' selected' : '') + '>' + esc(v.name) + '（' + esc(v.lang) + '）</option>'; }).join('') + '</select></div>';
  };
  var chk = function(id, on, label){ return '<label class="tg"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '>' + label + '</label>'; };
  return section('🎧 耳で暗記', null,
      '<p class="note" style="margin-top:0">カードの「問い」を読む → 少し待つ → 「こたえ」を読む、をつづけて流します。画面を見なくても聞けます。</p>' +
      '<div class="field"><label class="f" for="ak2_ear_src">どのカードを聞く？</label><select id="ak2_ear_src">' +
        opt('due', '今日の復習分（' + nDue + '枚）') + opt('wrong', 'まちがえたカード（' + nWrong + '枚）') +
        decks.map(function(d){ return opt('deck:' + d.name, d.name + '（' + d.n + '枚）'); }).join('') + '</select></div>' +
      '<div class="grid2">' +
        sel('ak2_ear_wait', [[1, '1秒'], [2, '2秒'], [3, '3秒'], [5, '5秒'], [8, '8秒'], [12, '12秒']], u.wait, 'こたえまで待つ') +
        sel('ak2_ear_rate', [['0.7', 'ゆっくり'], ['0.85', 'ややゆっくり'], ['1', 'ふつう'], ['1.2', 'ややはやい'], ['1.5', 'はやい']], String(u.rate), '読む速さ') + '</div>' +
      sel('ak2_ear_rep', [[1, '1回ずつ'], [2, '2回ずつ'], [3, '3回ずつ']], u.rep, '1枚を何回読む？') +
      chk('ak2_ear_loop', u.loop, '最後まで行ったら、はじめからくり返す') +
      chk('ak2_ear_mix', u.mix, '順番をまぜる') +
      chk('ak2_ear_ans', u.ans, 'こたえの前に「こたえ」と言う') +
      chk('ak2_ear_exp', u.exp, 'AIの解説があれば、それも読む') +
      chk('ak2_ear_en', u.en, '英語のところは英語の声で読む') +
      '<div style="margin-top:10px">' + voiceSel('ak2_ear_vja', vja, pj, '日本語の声') + voiceSel('ak2_ear_ven', ven, pe, '英語の声') + '</div>' +
      (!vja.length ? '<p class="note">声の一覧を読みこめませんでした（そのままでも、ふつうの声で読みます）。</p>' : '') +
      '<button class="btn ak2-startbtn" data-act="ak2-ear-start">▶ 聞きはじめる</button>' +
      '<div class="pillrow" style="margin:10px 0 0"><button data-act="ak2-ear-try">🔈 声をためす</button></div>') +
    '<p class="note">' + esc(AK2_EAR_NOTE) + '</p>';
}

/* ============================== #120 ひっかけ問題 ============================== */
function ak2TrapPrompt(n){
  return 'あなたは看護学生の定期試験・看護師国家試験の対策を手伝う先生です。\n' +
    '下の資料（暗記カードやメモ）から、「まちがえやすいところ」をつく、ひっかけ問題を' + n + '問作ってください。\n' +
    '・ひっかけの作り方の例：数値の入れかえ（正常値・基準値の上と下、単位）、似た言葉の取りちがえ（例：交感神経と副交感神経、動脈と静脈）、' +
    '「必ず」「すべて」「決して」などの言い切り、原因と結果の逆、左右・増える減るの逆。\n' +
    '・○×問題（type:"tf"）と、4つから1つ選ぶ問題（type:"mc"）をまぜる。\n' +
    '・資料に書いてあることだけを根拠にする。資料にないことは作らない。\n' +
    '・answer：○×問題は true（○）か false（×）。選ぶ問題は、正しい選択肢の番号（0からはじまる）。\n' +
    '・trap：どこがひっかけなのか（1文）。explain：正しくはどうか、なぜまちがえやすいか（2〜3文、やさしい日本語）。\n' +
    '・card：あとで暗記カードにするときの一問一答 {"q":"問い","a":"答え"}。\n' +
    '・患者さんの名前など、個人を特定できる情報は入れない。\n' +
    'JSONだけで答える：{"questions":[{"type":"tf","q":"問題文","answer":false,"trap":"…","explain":"…","card":{"q":"…","a":"…"}},' +
    '{"type":"mc","q":"問題文","choices":["…","…","…","…"],"answer":2,"trap":"…","explain":"…","card":{"q":"…","a":"…"}}]}';
}
function ak2TrapMaterial(src, text){
  src = String(src || '');
  if(src.indexOf('deck:') === 0){
    var d = src.slice(5);
    var cs = ak2Shuffle(ankiCards().filter(function(c){ return c.deck === d; }).slice()).slice(0, 150);
    return { label:ak2Short(d), deck:d, text:cs.map(function(c){ return '・' + c.q + ' → ' + c.a; }).join('\n').slice(0, 12000) };
  }
  if(src.indexOf('note:') === 0){
    var n = (S.notes || []).filter(function(x){ return x && x.id === src.slice(5); })[0];
    if(!n) return { label:'', deck:'', text:'' };
    var checks = (Array.isArray(n.checks) ? n.checks : []).map(function(c){ return typeof c === 'string' ? c : (c && (c.text || c.t)) || ''; }).filter(Boolean).join('\n');
    return { label:'メモ「' + (n.title || '無題') + '」', deck:(n.link && n.link.type === 'course') ? String(n.link.id || '') : '',
      text:(String(n.title || '') + '\n' + String(n.body || '') + (checks ? '\n' + checks : '')).slice(0, 12000) };
  }
  return { label:'貼りつけた文章', deck:'', text:String(text || '').slice(0, 12000) };
}
function ak2TrapClean(j, n){
  var list = Array.isArray(j) ? j : (j && Array.isArray(j.questions)) ? j.questions : [];
  var s = function(v, max){ return String(v == null ? '' : v).trim().slice(0, max); };
  return list.map(function(x){
    if(!x || typeof x !== 'object') return null;
    var q = s(x.q, 400);
    if(!q) return null;
    var type = (x.type === 'mc' || (x.type !== 'tf' && Array.isArray(x.choices) && x.choices.length > 2)) ? 'mc' : 'tf';
    var o = { type:type, q:q, trap:s(x.trap, 300), explain:s(x.explain, 600), pick:null, add:0, added:0 };
    if(type === 'mc'){
      var raw = (Array.isArray(x.choices) ? x.choices : []).map(function(c){ return s(c, 200); });
      var a = (typeof x.answer === 'number') ? x.answer : (/^\d+$/.test(String(x.answer).trim()) ? toNum(x.answer) : raw.indexOf(s(x.answer, 200)));
      if(!(a >= 0 && a < raw.length && a === Math.floor(a)) || !raw[a]) return null;
      /* 空の選択肢を捨てても、正解の番号がずれないように */
      var ch = [], at = -1;
      raw.forEach(function(c, k){ if(c && ch.length < 5){ if(k === a) at = ch.length; ch.push(c); } });
      if(ch.length < 2 || at < 0) return null;
      o.choices = ch; o.answer = at;
    }else{
      var v = String(x.answer).trim();
      var t = x.answer === true || /^(true|○|〇|o|正しい|まる)$/i.test(v);
      var f = x.answer === false || /^(false|×|x|✕|まちがい|誤り|ばつ)$/i.test(v);
      if(t === f) return null;
      o.answer = t;
    }
    var cd = (x.card && typeof x.card === 'object') ? x.card : {}, cq = s(cd.q, 300), ca = s(cd.a, 500);
    if(!cq || !ca){
      cq = (type === 'tf' ? '〇か×か：' : '') + q;
      ca = (type === 'tf' ? (o.answer ? '〇' : '×') : o.choices[o.answer]) + (o.explain ? '\n' + o.explain : '');
    }
    o.card = { q:cq.slice(0, 300), a:ca.slice(0, 500) };
    return o;
  }).filter(Boolean).slice(0, n || 10);
}
function ak2TrapRight(q, pick){
  if(pick === null || pick === undefined) return false;
  return q.type === 'tf' ? ((pick === 1) === q.answer) : pick === q.answer;
}
function ak2TrapAnswerText(q){ return q.type === 'tf' ? (q.answer ? '○（正しい）' : '×（まちがい）') : q.choices[q.answer]; }
async function ak2TrapMake(){
  if(!aiReady()){ toast('先に設定タブでAI（Gemini）のキーを登録してください', true); return; }
  if(ak2State.trapBusy) return;
  var src = val('ak2_trap_src') || 'text', n = Math.min(10, Math.max(3, toNum(val('ak2_trap_n')) || 5));
  var mat = ak2TrapMaterial(src, val('ak2_trap_text'));
  if(!mat.text || mat.text.replace(/\s/g, '').length < 20){ toast(src === 'text' ? 'もう少し長い文章を貼りつけてください' : '資料が少なすぎます（カードやメモをふやしてください）', true); return; }
  ak2LocalSet({ trapSrc:src, trapN:n });
  ak2State.trapBusy = 1; render();
  try{
    var out = await aiGenerate({ contents:[{ role:'user', parts:[{ text:ak2TrapPrompt(n) + '\n\n資料（' + mat.label + '）：\n' + mat.text }] }],
      json:true, temperature:0.5, maxTokens:8192, tag:'ak2-trap' });
    var qs = ak2TrapClean(parseJsonLoose(out), n);
    if(!qs.length) throw new Error('問題にできることが見つかりませんでした');
    ak2State.trap = { src:src, label:mat.label, deck:mat.deck, qs:qs, i:0 };
    toast(qs.length + '問できました');
  }catch(e){
    toast('作れませんでした：' + (e && e.message || e), true);
  }finally{
    ak2State.trapBusy = 0;
    if(isTyping()) renderLater(); else render();
  }
}
function ak2TrapPick(v){
  var T = ak2State.trap, q = T && T.qs[T.i];
  if(!q || (q.pick !== null && q.pick !== undefined)) return;
  q.pick = toNum(v);
  var right = ak2TrapRight(q, q.pick);
  q.add = right ? 0 : 1;                       /* まちがえた問題は、はじめから「カードにする」に印 */
  if(typeof ankiLog === 'function') ankiLog(right);
  persist();
  if(typeof ankiPushSoon === 'function') ankiPushSoon();
  render();
}
function ak2TrapNext(){
  var T = ak2State.trap;
  if(!T) return;
  T.i++;
  if(T.i >= T.qs.length && typeof ankiPushNow === 'function') ankiPushNow(); else render();
  window.scrollTo(0, 0);
}
function ak2TrapAdd(){
  var T = ak2State.trap;
  if(!T) return;
  var deck = val('ak2_trap_newdeck').trim() || val('ak2_trap_deck') || T.deck || 'ひっかけ問題';
  var list = T.qs.filter(function(q){ return q.add && !q.added; });
  if(!list.length){ toast('カードにする問題にチェックを入れてください', true); return; }
  var n = ankiAddMany(deck, list.map(function(q){ return { q:q.card.q, a:q.card.a }; }), 'ai');
  list.forEach(function(q){ q.added = 1; q.add = 0; });
  commit(); toast(n ? n + '枚をカードに追加しました' : '同じカードがもうあります', !n);
}
function ak2TrapView(){
  var T = ak2State.trap;
  if(T && T.qs && T.qs.length) return T.i >= T.qs.length ? ak2TrapResult(T) : ak2TrapQuiz(T);
  var decks = ankiDecks(), notes = (S.notes || []).filter(function(n){ return n && (n.title || n.body); }).slice(0, 80);
  var loc = ak2Local(), cur = loc.trapSrc || (decks[0] ? 'deck:' + decks[0].name : 'text');
  var opt = function(v, label){ return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; };
  var busy = ak2State.trapBusy;
  return section('🪤 ひっかけ問題', null,
    '<div class="field"><label class="f" for="ak2_trap_src">何から作る？</label><select id="ak2_trap_src">' +
      decks.map(function(d){ return opt('deck:' + d.name, '🃏 ' + d.name + '（' + d.n + '枚）'); }).join('') +
      notes.map(function(n){ return opt('note:' + n.id, '📝 ' + (n.title || String(n.body || '').slice(0, 20) || '無題')); }).join('') +
      opt('text', '✏️ 文章を貼りつける') + '</select></div>' +
    '<div class="field"><label class="f" for="ak2_trap_text">文章（「文章を貼りつける」を選んだとき）</label><textarea id="ak2_trap_text" rows="3" placeholder="講義のまとめ・教科書の文章など"></textarea></div>' +
    '<div class="field"><label class="f" for="ak2_trap_n">問題の数</label><select id="ak2_trap_n">' + [5, 8, 10].map(function(k){
      return '<option value="' + k + '"' + (toNum(loc.trapN) === k ? ' selected' : '') + '>' + k + '問</option>'; }).join('') + '</select></div>' +
    '<button class="btn" data-act="ak2-trap-make"' + (busy ? ' disabled' : '') + '>' + (busy ? 'AIが問題を作っています…' : '🪤 AIでひっかけ問題を作る') + '</button>' +
    '<p class="note">数値の入れかえ（正常値の上と下など）や、似た言葉の取りちがえをねらった ○×問題・選ぶ問題を作ります。答えると「なぜひっかけなのか」の解説が出ます。気に入った問題は、暗記カードに追加できます。</p>' +
    '<p class="note">⚠️ 選んだカードやメモの中身がAI（Gemini）に送られます。<b>患者さんの情報が書いてあるメモは選ばないでください</b>。問題と解説は' + AK2_CHECK + '</p>');
}
function ak2TrapQuiz(T){
  var q = T.qs[T.i], answered = q.pick !== null && q.pick !== undefined, right = ak2TrapRight(q, q.pick);
  var btn = function(v, label, isAns){
    var cls = answered ? (isAns ? 'right' : (q.pick === v ? 'wrong' : '')) : '';
    return '<button class="' + cls + '" data-act="ak2-trap-pick" data-v="' + v + '"' + (answered ? ' disabled' : '') + '>' + label + '</button>';
  };
  var btns = q.type === 'tf'
    ? '<div class="ak2-choices tf">' + btn(1, '○', q.answer === true) + btn(0, '×', q.answer === false) + '</div>'
    : '<div class="ak2-choices">' + q.choices.map(function(c, i){ return btn(i, '<b>' + 'アイウエオ'.charAt(i) + '</b> ' + esc(c), q.answer === i); }).join('') + '</div>';
  var res = !answered ? '' :
    '<div class="ak2-why"><div class="ak2-res ' + (right ? 'ok' : 'ng') + '">' + (right ? '⭕ 正解！' : '❌ ひっかかりました') + '</div>' +
      '<div><b>正しいこたえ</b>' + esc(ak2TrapAnswerText(q)) + '</div>' +
      (q.trap ? '<div><b>🪤 ひっかけポイント</b>' + esc(q.trap) + '</div>' : '') +
      (q.explain ? '<div><b>解説</b>' + esc(q.explain) + '</div>' : '') +
      '<div class="s2">' + AK2_CHECK + '</div></div>' +
    '<button class="btn" style="margin-top:12px" data-act="ak2-trap-next">' + (T.i + 1 < T.qs.length ? '次の問題へ' : '結果を見る') + '</button>';
  return section('🪤 ひっかけ問題', (T.i + 1) + ' / ' + T.qs.length + '問',
      '<div class="s2">' + esc(T.label) + '・' + (q.type === 'tf' ? '○か×か' : 'ひとつ選ぶ') + '</div>' +
      '<div class="ak2-q">' + esc(q.q) + '</div>' + btns + res) +
    '<div class="pillrow"><button data-act="ak2-trap-reset">やめる</button></div>';
}
function ak2TrapResult(T){
  var ok = T.qs.filter(function(q){ return ak2TrapRight(q, q.pick); }).length;
  var names = [];
  if(T.deck) names.push(T.deck);
  ankiDecks().forEach(function(d){ if(names.indexOf(d.name) < 0) names.push(d.name); });
  termCourses().forEach(function(c){ if(names.indexOf(c.name) < 0) names.push(c.name); });
  if(names.indexOf('ひっかけ問題') < 0) names.push('ひっかけ問題');
  return section('🪤 結果', T.qs.length + '問中 ' + ok + '問 正解',
    '<p class="note" style="margin-top:0">カードにしたい問題にチェックを入れて、下のボタンを押してください（まちがえた問題には、はじめから印がついています）。</p>' +
    T.qs.map(function(q, i){
      var r = ak2TrapRight(q, q.pick);
      return '<label class="row ankirow"><input type="checkbox" data-act="ak2-trap-tog" data-i="' + i + '"' + (q.add ? ' checked' : '') + (q.added ? ' disabled' : '') + '>' +
        '<div class="grow"><div class="t">' + (r ? '⭕ ' : '❌ ') + esc(q.card.q) + '</div><div class="s">' + esc(q.card.a) + '</div>' +
        (q.added ? '<div class="s2">カードに追加しました</div>' : '') + '</div></label>';
    }).join('') +
    '<div class="field" style="margin-top:10px"><label class="f" for="ak2_trap_deck">入れる科目</label><select id="ak2_trap_deck">' +
      names.map(function(n){ return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><input id="ak2_trap_newdeck" placeholder="新しい科目名（上にないとき）" aria-label="新しい科目名"></div>' +
    '<button class="btn" data-act="ak2-trap-add">チェックしたものをカードに追加</button>' +
    '<button class="btn ghost" style="margin-top:8px" data-act="ak2-trap-reset">別の問題を作る</button>');
}

/* ============================== #182 Anki に書き出す・取りこむ ============================== */
function ak2AnkiField(s){
  s = String(s == null ? '' : s).replace(/\t/g, ' ').replace(/\r\n?/g, '\n');
  if(/[\n"]/.test(s) || /^#/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function ak2AnkiTag(s){ return String(s || '').replace(/\s+/g, '_').replace(/"/g, ''); }
function ak2AnkiText(deck, withExp){
  var list = ankiCards().filter(function(c){ return !deck || (c.deck || 'そのほか') === deck; });
  var lines = ['#separator:tab', '#html:false', '#notetype:Basic', '#deck column:4', '#tags column:3'];
  list.forEach(function(c){
    var back = String(c.a || '') + (withExp && c.explain ? '\n\n' + c.explain + '\n（出典：' + (c.explainSrc || AK2_GENERAL) + '）' : '');
    var dk = 'くらしの手帳::' + String(c.deck || 'そのほか').replace(/::/g, '：');
    lines.push([ak2AnkiField(c.q), ak2AnkiField(back), 'くらしの手帳 ' + ak2AnkiTag(c.deck || 'そのほか'), ak2AnkiField(dk)].join('\t'));
  });
  return { text:lines.join('\n') + '\n', n:list.length };
}
/* 区切り文字と "…" のかこみに対応して、行と列に分ける */
function ak2CsvRows(text, sep){
  var rows = [], row = [], f = '', q = false, start = true, n = text.length;
  for(var i = 0; i < n; i++){
    var ch = text.charAt(i);
    if(q){
      if(ch === '"'){ if(text.charAt(i + 1) === '"'){ f += '"'; i++; } else q = false; }
      else f += ch;
      continue;
    }
    if(ch === '"' && start){ q = true; start = false; continue; }
    if(ch === sep){ row.push(f); f = ''; start = true; continue; }
    if(ch === '\n'){ row.push(f); rows.push(row); row = []; f = ''; start = true; continue; }
    if(ch === '\r') continue;
    f += ch; start = false;
  }
  if(f !== '' || row.length){ row.push(f); rows.push(row); }
  return rows;
}
function ak2DeckTail(d){
  var parts = String(d || '').split('::').map(function(x){ return x.trim(); }).filter(Boolean);
  var last = parts.pop() || '';
  return /^(default|デフォルト)$/i.test(last) ? '' : last.slice(0, 60);
}
function ak2AnkiClean(s, html){
  s = String(s == null ? '' : s).replace(/\[sound:[^\]]*\]/g, '').replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1');
  if(html){
    s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li)>/gi, '\n').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/&#(\d+);/g, function(m, k){ return String.fromCharCode(+k); }).replace(/&amp;/g, '&');
  }
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function ak2AnkiParse(text, fileName){
  text = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  var lines = text.split('\n'), hd = {}, k = 0, m;
  while(k < lines.length && (m = lines[k].match(/^#([^:]+):(.*)$/))){ hd[m[1].trim().toLowerCase()] = m[2].trim(); k++; }
  var body = lines.slice(k).join('\n');
  var SEP = { tab:'\t', comma:',', semicolon:';', space:' ', pipe:'|', colon:':' };
  var sep = hd.separator ? (SEP[hd.separator.toLowerCase()] || (hd.separator.length === 1 ? hd.separator : '\t')) : '';
  if(!sep){
    var fl = body.split('\n').filter(function(s){ return s.trim(); })[0] || '';
    sep = fl.indexOf('\t') >= 0 ? '\t' : fl.indexOf(';') >= 0 ? ';' : ',';
  }
  var html = hd.html ? /^true$/i.test(hd.html) : /<(br|div|b|i|u|span|p|img)\b[^>]*>/i.test(body);
  var col = function(name){ var v = toNum(hd[name + ' column']); return v > 0 ? v - 1 : -1; };
  var sp = { tags:col('tags'), deck:col('deck'), notetype:col('notetype'), guid:col('guid') }, skip = {};
  Object.keys(sp).forEach(function(x){ if(sp[x] >= 0) skip[sp[x]] = 1; });
  var deck0 = hd.deck ? ak2DeckTail(hd.deck) : '';
  var out = [], seen = {};
  ak2CsvRows(body, sep).forEach(function(r){
    if(!r.length || r.every(function(s){ return !String(s).trim(); })) return;
    var fields = r.filter(function(v, i){ return !skip[i]; });
    var q = ak2AnkiClean(fields[0], html), a = ak2AnkiClean(fields[1], html);
    if(!q || !a) return;
    var dk = sp.deck >= 0 ? ak2DeckTail(r[sp.deck]) : deck0;
    var key = dk + '\n' + q;
    if(seen[key]) return;
    seen[key] = 1;
    out.push({ q:q.slice(0, 300), a:a.slice(0, 500), deck:dk, on:1 });
  });
  return { cards:out.slice(0, 3000), html:html, sep:sep, name:String(fileName || '') };
}
async function ak2SaveText(name, text){
  if(TEST_MODE){ window.ak2LastFile = { name:name, text:text }; return 'test'; }
  var blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  /* iPhone・iPad：共有の画面（「ファイルに保存」やAnkiMobileを選べる） */
  try{
    if(ak2IsIos() && navigator.canShare && typeof File !== 'undefined'){
      var f = new File([blob], name, { type:'text/plain' });
      if(navigator.canShare({ files:[f] })){ await navigator.share({ files:[f], title:name }); return 'share'; }
    }
  }catch(e){ if(e && e.name === 'AbortError') return 'cancel'; }
  download(blob, name);
  return 'download';
}
async function ak2OutSave(){
  var deck = val('ak2_out_deck'), withExp = ak2FormChk('ak2_out_exp', 0);
  var r = ak2AnkiText(deck, withExp);
  if(!r.n){ toast('書き出すカードがありません', true); return; }
  var name = 'kurashi-anki-' + String(deck || 'all').replace(/[\\\/:*?"<>|\s]+/g, '_').slice(0, 40) + '-' + today() + '.txt';
  var how = await ak2SaveText(name, r.text);
  if(how === 'cancel') return;
  ak2State.outMsg = r.n + '枚を「' + name + '」に書き出しました。';
  toast(r.n + '枚を書き出しました');
  if(isTyping()) renderLater(); else render();
}
function ak2InLoad(text, name){
  if(/\.(apkg|colpkg)$/i.test(name || '')){ toast('.apkg のファイルは読めません。Ankiで「プレーンテキスト（.txt）」の形で書き出してください', true); return false; }
  var r = ak2AnkiParse(text, name);
  if(!r.cards.length){ toast('カードにできる行が見つかりませんでした（1列目が表、2列目が裏の形にしてください）', true); return false; }
  ak2State.imp = r;
  render(); window.scrollTo(0, 0);
  toast(r.cards.length + '枚見つかりました。見てから追加してください');
  return true;
}
function ak2InFile(){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.txt,.csv,.tsv,text/plain,text/csv,text/tab-separated-values';
  inp.onchange = function(){
    var f = (inp.files || [])[0];
    if(!f) return;
    if(/\.(apkg|colpkg)$/i.test(f.name)){ ak2InLoad('', f.name); return; }
    if(f.size > 5 * 1024 * 1024){ toast('ファイルが大きすぎます（5MBまで）', true); return; }
    var rd = new FileReader();
    rd.onload = function(){ ak2InLoad(String(rd.result || ''), f.name); };
    rd.onerror = function(){ toast('読めませんでした', true); };
    rd.readAsText(f, 'utf-8');
  };
  inp.click();
}
function ak2InAdd(){
  var r = ak2State.imp;
  if(!r) return;
  var tgt = val('ak2_in_new').trim() || val('ak2_in_deck');
  var groups = {}, order = [], n = 0;
  r.cards.forEach(function(c){
    if(!c.on) return;
    var dk = (tgt && tgt !== '__file__') ? tgt : (c.deck || 'Ankiから');
    if(!groups[dk]){ groups[dk] = []; order.push(dk); }
    groups[dk].push(c);
  });
  if(!order.length){ toast('追加するカードにチェックを入れてください', true); return; }
  order.forEach(function(dk){ n += ankiAddMany(dk, groups[dk], 'anki'); });
  ak2State.imp = null;
  commit(); toast(n ? n + '枚追加しました' : '同じカードがもうあります', !n);
}
function ak2InPreview(){
  var r = ak2State.imp, fileDecks = [], names = [];
  r.cards.forEach(function(c){ if(c.deck && fileDecks.indexOf(c.deck) < 0) fileDecks.push(c.deck); });
  ankiDecks().forEach(function(d){ names.push(d.name); });
  termCourses().forEach(function(c){ if(names.indexOf(c.name) < 0) names.push(c.name); });
  var on = r.cards.filter(function(c){ return c.on; }).length;
  return section('取りこむカード（見てから追加）', on + ' / ' + r.cards.length + '枚',
    (r.name ? '<div class="s2">' + esc(r.name) + '</div>' : '') +
    '<div class="field"><label class="f" for="ak2_in_deck">入れる科目</label><select id="ak2_in_deck">' +
      (fileDecks.length ? '<option value="__file__">ファイルのデッキ名のまま（' + esc(fileDecks.slice(0, 3).join('・') + (fileDecks.length > 3 ? ' ほか' : '')) + '）</option>'
                        : '<option value="">「Ankiから」という科目</option>') +
      names.map(function(n){ return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('') + '</select></div>' +
    '<div class="field"><input id="ak2_in_new" placeholder="新しい科目名（上にないとき）" aria-label="新しい科目名"></div>' +
    r.cards.slice(0, 300).map(function(c, i){
      return '<label class="row ankirow"><input type="checkbox" data-act="ak2-in-tog" data-i="' + i + '"' + (c.on ? ' checked' : '') + '>' +
        '<div class="grow"><div class="t">' + esc(c.q) + '</div><div class="s">' + esc(c.a) + '</div>' + (c.deck ? '<div class="s2">' + esc(c.deck) + '</div>' : '') + '</div></label>';
    }).join('') +
    (r.cards.length > 300 ? '<p class="note">ほかに ' + (r.cards.length - 300) + '枚あります（いっしょに追加します）。</p>' : '') +
    '<div class="pair" style="margin-top:8px"><button class="btn" data-act="ak2-in-add">チェックしたものを追加</button>' +
    '<button class="btn ghost" data-act="ak2-in-cancel" style="flex:0 0 auto">やめる</button></div>' +
    '<p class="note">同じ科目に同じ問いのカードがあるときは、足しません。</p>');
}
function ak2AnkiView(){
  var h = ak2State.imp ? ak2InPreview() : '', decks = ankiDecks(), all = ankiCards().length;
  h += section('📤 Ankiに書き出す', all + '枚',
    (all
      ? '<div class="field"><label class="f" for="ak2_out_deck">書き出す科目</label><select id="ak2_out_deck"><option value="">ぜんぶ（' + all + '枚）</option>' +
          decks.map(function(d){ return '<option value="' + esc(d.name) + '">' + esc(d.name) + '（' + d.n + '枚）</option>'; }).join('') + '</select></div>' +
        '<label class="tg"><input type="checkbox" id="ak2_out_exp">AIの解説も、裏に入れる</label>' +
        '<button class="btn" style="margin-top:10px" data-act="ak2-out-save">📤 Anki用のファイルを保存</button>' +
        (ak2State.outMsg ? '<div class="msg ok" style="margin:10px 0 0">' + esc(ak2State.outMsg) + '</div>' : '') +
        '<p class="note">タブ区切りのテキスト（.txt）で保存します。パソコンのAnkiで「ファイル」→「読み込む」からこのファイルを選ぶと、表・裏・タグ（科目名）がそのまま入ります。デッキは「くらしの手帳::科目名」になります。iPhoneでは共有の画面が出るので、「“ファイル”に保存」などを選んでください。</p>'
      : '<div class="empty">まだカードがありません。</div>'));
  h += section('📥 Ankiから取りこむ', null,
    '<button class="btn ghost" data-act="ak2-in-file">📥 Ankiのテキストファイルをえらぶ（.txt）</button>' +
    '<div class="field" style="margin-top:10px"><label class="f" for="ak2_in_text">または、中身を貼りつける</label>' +
      '<textarea id="ak2_in_text" rows="4" placeholder="1行に1枚。表と裏をタブ（またはカンマ）で区切る"></textarea></div>' +
    '<button class="btn ghost" data-act="ak2-in-text">貼りつけたものを読む</button>' +
    '<p class="note">Ankiで「ファイル」→「書き出す」→「プレーンテキスト（.txt）」の形で書き出したファイルを読みこめます。1列目が表、2列目が裏になります。追加する前に、中身を見て選べます。（.apkg のファイルは読めません）</p>');
  return h;
}

/* ============================== 登録 ============================== */
kmStudy({ id:'ak2-plan', icon:'📅', title:'テスト範囲の計画', desc:'テストの日から逆算して、1日にやる量を出す', view:ak2PlanView, order:20,
  badge:function(){ var n = ak2TodayList().filter(function(x){ return x.calc.items.some(function(i){ return i.q > i.on; }); }).length; return n ? '今日' + n : ''; } });
kmStudy({ id:'ak2-ear', icon:'🎧', title:'耳で暗記', desc:'カードを読み上げて、聞きながら覚える', view:ak2EarView, order:22 });
kmStudy({ id:'ak2-trap', icon:'🪤', title:'ひっかけ問題', desc:'まちがえやすいところをつく問題をAIが作る', view:ak2TrapView, order:24 });
kmStudy({ id:'ak2-wrong', icon:'❌', title:'まちがえたカード', desc:'まちがえた回数の多い順。AIの解説つき', view:ak2WrongView, order:26,
  badge:function(){ var n = ak2WrongList().length; return n ? n + '枚' : ''; } });
kmStudy({ id:'ak2-anki', icon:'📤', title:'Ankiと交換', desc:'Anki用に書き出す・Ankiから取りこむ', view:ak2AnkiView, order:28 });
kmPart('today', 'ak2plan', 'テスト勉強（今日の分）', ak2TodayCard);
/* 今日タブでは「今日の予定」のすぐ下に出す（並べかえていない人の、はじめの場所） */
(function(){
  var L = (typeof PAGE_SECTIONS !== 'undefined') ? PAGE_SECTIONS.today : null;
  if(!Array.isArray(L)) return;
  var i = -1, j = -1;
  L.forEach(function(x, k){ if(x[0] === 'ak2plan') i = k; if(x[0] === 'events') j = k; });
  if(i < 0 || j < 0 || i === j + 1) return;
  var it = L.splice(i, 1)[0];
  L.splice(L.map(function(x){ return x[0]; }).indexOf('events') + 1, 0, it);
})();

kmAction(function(act, t){
  if(act.indexOf('ak2-') !== 0) return false;
  var d = t.dataset || {};
  switch(act){
    case 'ak2-go':
      if(d.src) ak2LocalSet({ src:d.src });
      ak2Go(d.v || ''); break;
    case 'ak2-plan-open':
      ak2State.plan = d.id || ''; ak2State.delAsk = ''; ak2Go('ak2-plan'); break;
    case 'ak2-plan-back':
      ak2State.plan = ''; ak2State.delAsk = ''; render(); window.scrollTo(0, 0); break;
    case 'ak2-item-add': ak2ItemAdd(d.ex); break;
    case 'ak2-item-del':
      ak2PlanChange(d.ex, function(p){ p.items = p.items.filter(function(i){ return i.id !== d.it; }); ak2LogToday(p); toast('範囲を消しました'); }); break;
    case 'ak2-item-set': ak2ItemSet(d.ex, d.it); break;
    case 'ak2-chk': ak2Check(d.ex, d.it); break;
    case 'ak2-amt': ak2Amount(d.ex, d.it); break;
    case 'ak2-rest':
      ak2PlanChange(d.ex, function(p){
        if(!isYmd(d.d)) return false;
        var i = p.rest.indexOf(d.d);
        if(i >= 0) p.rest.splice(i, 1); else { p.rest.push(d.d); p.rest.sort(); }
      }); break;
    case 'ak2-review':
      ak2PlanChange(d.ex, function(p){ p.review = t.checked ? 1 : 0; }); break;
    case 'ak2-start':
      ak2PlanChange(d.ex, function(p){
        var v = val('ak2_start');
        if(!isYmd(v)){ toast('日付を選んでください', true); return false; }
        p.start = v; toast('はじめる日を変えました');
      }); break;
    case 'ak2-replan':
      ak2PlanChange(d.ex, function(p){ p.start = today(); toast('今日から計画を立て直しました'); }); break;
    case 'ak2-rest-use':
      ak2PlanChange(d.ex, function(p){
        var td = today(), f = p.rest.filter(function(x){ return x >= td; })[0];
        if(!f) return false;
        p.rest = p.rest.filter(function(x){ return x !== f; });
        toast(ymdLabel(f) + 'の予備日を使って、計画に入れました');
      }); break;
    case 'ak2-plan-delask': ak2State.delAsk = d.ex || ''; render(); break;
    case 'ak2-plan-delno': ak2State.delAsk = ''; render(); break;
    case 'ak2-plan-del':
      if(ak2Plan(d.ex)){
        S.examPlan[d.ex] = { del:1, items:[], mt:Date.now() }; touch('examPlan');
        ak2State.delAsk = '';
        commit(); toast('計画を消しました');
      }
      break;
    case 'ak2-deck-go':
      appId = 'anki'; ankiState.mode = ''; ankiStart(d.deck || ''); render(); break;
    case 'ak2-explain': if(!ak2State.busy) ak2Explain(d.id); break;
    case 'ak2-expdel':
      var c0 = ak2Card(d.id);
      if(c0){ delete c0.explain; delete c0.explainSrc; delete c0.explainNote; delete c0.explainAt; c0.mt = Date.now(); commit(); toast('解説を消しました'); }
      break;
    case 'ak2-expshow': ak2State.expOpen[d.id] = 1; render(); break;
    case 'ak2-showexp': ak2UiSet({ showExp:t.checked ? 1 : 0 }); commit(); break;
    case 'ak2-wrong-deck': ak2State.wrongDeck = d.v || ''; render(); break;
    case 'ak2-wrong-study': ak2WrongStudy(d.v || ''); break;
    case 'ak2-card':
      ak2State.focus = d.id || ''; ak2State.wrongDeck = '';
      ak2Go('ak2-wrong');
      setTimeout(function(){ var el = document.getElementById('ak2w_' + ak2State.focus); if(el && el.scrollIntoView) el.scrollIntoView({ block:'center' }); }, 50);
      break;
    case 'ak2-ear-start': ak2EarStart(); break;
    case 'ak2-ear-pause': ak2EarPause(); break;
    case 'ak2-ear-resume': ak2EarResume(); break;
    case 'ak2-ear-next': ak2EarMove(1); break;
    case 'ak2-ear-prev': ak2EarMove(-1); break;
    case 'ak2-ear-stop': ak2EarStop(); break;
    case 'ak2-ear-try': ak2EarTry(); break;
    case 'ak2-trap-make': ak2TrapMake(); break;
    case 'ak2-trap-pick': ak2TrapPick(d.v); break;
    case 'ak2-trap-next': ak2TrapNext(); break;
    case 'ak2-trap-tog':
      var T = ak2State.trap, q = T && T.qs[toNum(d.i)];
      if(q) q.add = t.checked ? 1 : 0;
      break;
    case 'ak2-trap-add': ak2TrapAdd(); break;
    case 'ak2-trap-reset': ak2State.trap = null; render(); window.scrollTo(0, 0); break;
    case 'ak2-out-save': ak2OutSave(); break;
    case 'ak2-in-file': ak2InFile(); break;
    case 'ak2-in-text':
      var tx = val('ak2_in_text');
      if(!tx.trim()){ toast('中身を貼りつけてください', true); break; }
      ak2InLoad(tx, ''); break;
    case 'ak2-in-tog':
      var r = ak2State.imp, cc = r && r.cards[toNum(d.i)];
      if(cc) cc.on = t.checked ? 1 : 0;
      break;
    case 'ak2-in-add': ak2InAdd(); break;
    case 'ak2-in-cancel': ak2State.imp = null; render(); break;
  }
  return true;
});

/* テストの通知に足す「今日やる分」（js/notify.js から使う） */
function ak2NoteLine(examId){
  try{
    var x = ak2Upcoming().filter(function(y){ return y.ex && y.ex.id === examId && y.calc; })[0];
    return x ? ak2TodayLine(x.calc) : '';
  }catch(e){ return ''; }
}

/* ----- AIが読めるように（計算した「今日やる分」「遅れ」・まちがえたカードの順位） ----- */
kmAiData('ak2ExamToday', 'テスト範囲の計画から計算した「今日やる分」「遅れ」「のこり」「これからの1日ずつの予定」（テストごと）', function(){
  return ak2Upcoming().filter(function(x){ return x.calc; }).map(function(x){
    var c = x.calc;
    return { examId:x.ex.id, exam:ak2ExamName(x.ex), kind:ak2KindName(x.ex), date:x.ex.date, daysLeft:x.left, status:ak2StatusText(c), today:ak2TodayLine(c),
      restDays:(x.p.rest || []).slice(), start:x.p.start || '', reviewDayBefore:x.p.review !== 0,
      items:c.items.map(function(i){ return { name:i.name, unit:ak2Unit(i), deck:i.deck || '', total:i.amount, doneBeforeToday:i.before, doneToday:i.on,
        todayQuota:i.q, remaining:Math.max(0, i.rem - i.on), behind:i.behind }; }),
      next7:ak2PlanSchedule(c).slice(0, 7).map(function(s){ return { date:s.d,
        plan:s.parts.map(function(q, k){ return q > 0 ? c.items[k].name + ' ' + q + ak2Unit(c.items[k]) : ''; }).filter(Boolean).join('・'),
        note:(s.rest ? '予備日' : s.review ? '見直しの日' : s.why.join('・')) }; }) };
  });
});
KM.aiData.ak2ExamToday.section = 'exams';
kmAiData('ak2WrongCards', 'まちがえた暗記カード（まちがえた回数の多い順。AIの解説と出典つき）', function(){
  return ak2WrongList().slice(0, 40).map(function(c){
    return { id:c.id, deck:c.deck || '', q:c.q, a:c.a, miss:ak2Miss(c), lastMiss:c.missAt || '', explain:c.explain || '', explainSrc:c.explainSrc || '' };
  });
});
KM.aiData.ak2WrongCards.section = 'study';

/* ----- 全体の検索 ----- */
kmSearch(function(q){
  var s = norm(String(q || '')).trim(), out = [];
  if(!s) return out;
  ankiCards().forEach(function(c){
    if(out.length >= 30 || !c.explain) return;
    if(norm(c.explain + ' ' + (c.explainSrc || '')).indexOf(s) < 0) return;
    out.push({ kind:'暗記の解説', title:c.q, sub:(c.deck ? c.deck + '・' : '') + String(c.explain).replace(/\s+/g, ' ').slice(0, 80), act:'ak2-card', attrs:{ 'data-id':c.id } });
  });
  Object.keys(S.examPlan || {}).forEach(function(id){
    var p = ak2Plan(id), ex = ak2Exam(id);
    if(!p || !ex) return;
    var names = ak2PlanItems(p).map(function(i){ return i.name; });
    if(norm(ak2ExamName(ex) + ' ' + names.join(' ')).indexOf(s) < 0) return;
    out.push({ kind:'テスト範囲', title:ak2ExamName(ex) + '（' + ymdLabel(ex.date) + '）', sub:names.join('・').slice(0, 80), act:'ak2-plan-open', attrs:{ 'data-id':id } });
  });
  return out;
});
/* ----- ウィジェット・Discord用のまとめ ----- */
kmSummary(function(s){
  var list = ak2TodayList().slice(0, 3).map(function(x){ return { t:ak2ExamName(x.ex).slice(0, 30), left:x.left, st:ak2StatusText(x.calc), d:ak2TodayLine(x.calc).slice(0, 100) }; });
  if(list.length) s.ak2Exam = list;
});
/* ----- データの点検 ----- */
kmCheck(function(){
  var out = [];
  Object.keys(S.examPlan || {}).forEach(function(id){
    if(!ak2Plan(id) || ak2Exam(id)) return;
    out.push({ level:'warn', msg:'テストが消えたあとの「テスト範囲の計画」が残っています', fix:function(){ S.examPlan[id] = { del:1, items:[], mt:Date.now() }; touch('examPlan'); } });
  });
  return out;
});

/* ----- 読み上げの声の一覧があとから届いたとき・画面が消えたとき ----- */
(function(){
  try{
    var t = window.speechSynthesis;
    if(t && t.addEventListener) t.addEventListener('voiceschanged', function(){
      if(appId === 'study' && studyTool === 'ak2-ear' && !ak2Ear.on && !isTyping()) render();
    });
  }catch(e){}
  document.addEventListener('visibilitychange', function(){
    if(!ak2Ear.on) return;
    if(document.visibilityState === 'hidden'){
      /* iPhoneは画面が消えると読み上げが止まるので、止めた場所をおぼえておく */
      if(ak2IsIos() && !ak2Ear.paused) ak2EarPause();
    }else if(!ak2Ear.paused){
      ak2Ear.lock = null; ak2WakeLock(true);
    }
  });
})();

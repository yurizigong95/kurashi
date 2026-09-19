/* くらしの手帳：朝のまとめ・夜のふりかえり */
/* ============================== 朝のまとめ・夜の振り返り ============================== */
/* 予定から自分で作る（AIを使わないので、キーがなくても動く）
   手帳にあるものだけで、その日を数える（画面を描くときにも使うので、S は変えない） */
function c9YmdOfTime(t){ t = Number(t) || 0; return t ? toYmd(new Date(t)) : ''; }
function dayScore(ymd){
  var tasks = S.tasks.filter(function(t){ return isYmd(t.due) && t.due === ymd; });
  var done = tasks.filter(function(t){ return t.done; }).length;
  var late = S.tasks.filter(function(t){ return !t.done && isYmd(t.due) && t.due < ymd; }).length;
  /* その日に終わらせた課題（完了にした時刻がその日のもの。締切の日はとわない） */
  var doneOn = S.tasks.filter(function(t){ return t.done && c9YmdOfTime(t.mt) === ymd; }).length;
  var cls = schoolClassesForDate(ymd);
  var att = 0, ab = 0;
  Object.keys(S.attendLog||{}).forEach(function(nm){
    (S.attendLog[nm]||[]).forEach(function(r){ if(r.date === ymd){ if(r.st === '欠') ab++; else att++; } });
  });
  var work = S.shifts.filter(function(w){ return w.date === ymd; }).length;
  var studied = 0;
  Object.keys(S.taskLog||{}).forEach(function(id){ studied += toNum((S.taskLog[id]||{}).min); });
  /* 暗記（その日にやった枚数と、その日までの連続の日数） */
  var anki = 0, streak = 0;
  if(typeof ankiCountOn === 'function'){
    anki = ankiCountOn(ymd);
    for(var d = ymd; streak < 400 && ankiCountOn(d) > 0; d = shiftDate(d, -1)) streak++;
  }
  var hasCards = (S.cards || []).length > 0;
  /* 家計簿（その日の支出。30日以内に記録があれば「つけている」とみなす） */
  var spends = Array.isArray(S.spends) ? S.spends : [];
  var from30 = shiftDate(ymd, -30);
  var kbUse = spends.some(function(x){ return x && x.date >= from30 && x.date <= ymd; });
  var outs = spends.filter(function(x){ return x && x.date === ymd && x.io !== 'in'; });
  var spent = outs.reduce(function(a, x){ return a + Math.abs(Number(x.amount) || 0); }, 0);
  /* 睡眠・歩数（S.healthLog があるとき。睡眠は分。小さい数なら時間とみなす） */
  var hl = (S.healthLog && S.healthLog[ymd]) || {};
  var sleep = Number(hl.sleep) || 0; if(sleep > 0 && sleep < 24) sleep = Math.round(sleep * 60);
  sleep = Math.round(sleep);
  var steps = toNum(hl.steps);
  /* おせわ（その日のミッションとコイン） */
  var petUse = false, petMis = 0, petCoin = 0;
  var pd = (S.petDays && typeof S.petDays === 'object') ? S.petDays : {};
  if(Object.keys(pd).length){
    petUse = true;
    var ms = pd['m:' + ymd];
    petMis = (ms && ms.got) ? Object.keys(ms.got).filter(function(k){ return ms.got[k]; }).length : 0;
    Object.keys(pd).forEach(function(k){ if(k.slice(0, 10) === ymd && k.indexOf('m:') !== 0) petCoin += toNum(pd[k] && pd[k].coins); });
  }
  return { tasks:tasks.length, done:done, doneOn:doneOn, late:late, cls:cls.length, att:att, ab:ab, work:work, studied:studied,
           anki:anki, streak:streak, hasCards:hasCards, kbUse:kbUse, spendN:outs.length, spent:spent,
           sleep:sleep, steps:steps, petUse:petUse, petMis:petMis, petCoin:petCoin };
}
/* 1日に使ってよいお金の目安（自由に使えるお金を、その月の日数でわる。わからないときは、前の4週間の平均の1.2倍） */
function c9DayAllowance(ymd){
  try{
    var b = budget();
    if(b.level !== 'none' && b.free > 0){
      var a = ymd.split('-'), dim = new Date(+a[0], +a[1], 0).getDate();
      return Math.round(b.free / dim);
    }
  }catch(e){}
  var sum = 0, from = shiftDate(ymd, -28);
  (Array.isArray(S.spends) ? S.spends : []).forEach(function(x){
    if(x && x.io !== 'in' && x.date >= from && x.date < ymd) sum += Math.abs(Number(x.amount) || 0);
  });
  return sum > 0 ? Math.round(sum / 28 * 1.2) : null;
}
/* 内わけ（その日に関係があるものだけ数える）。{ k:種類, l:名前, p:点, m:満点, t:説明 } */
function c9DayBreakdown(ymd, sc){
  sc = sc || dayScore(ymd);
  var it = [];
  if(sc.tasks) it.push({ k:'task', l:'課題', m:30, p:Math.round(30 * sc.done / sc.tasks),
    t:'締切 ' + sc.done + '/' + sc.tasks + '件' + (sc.doneOn ? '・終わらせた ' + sc.doneOn + '件' : '') });
  else it.push({ k:'task', l:'課題', m:30, p:Math.min(30, 18 + sc.doneOn * 4),
    t:sc.doneOn ? '終わらせた ' + sc.doneOn + '件' : '締切の課題なし' });
  it.push({ k:'late', l:'期限切れ', m:10, p:Math.max(0, 10 - sc.late * 3), t:sc.late ? sc.late + '件たまっている' : 'ためていない' });
  if(sc.cls) it.push({ k:'att', l:'出席', m:25, p:sc.ab ? Math.max(0, 25 - sc.ab * 15) : sc.att ? 25 : 18,
    t:sc.cls + 'コマ' + (sc.ab ? '・欠席 ' + sc.ab : sc.att ? '・出席を記録' : '・出欠の記録なし') });
  if(sc.hasCards || sc.anki) it.push({ k:'anki', l:'暗記', m:15, p:sc.anki >= 30 ? 15 : sc.anki >= 10 ? 11 : sc.anki >= 1 ? 7 : 0,
    t:sc.anki ? sc.anki + '枚' + (sc.streak > 1 ? '・' + sc.streak + '日連続' : '') : 'やっていない' });
  if(sc.kbUse){
    var al = c9DayAllowance(ymd);
    var pk = (sc.spendN ? 4 : 2) + (al == null ? (sc.spendN ? 4 : 3) : sc.spent <= al ? 6 : sc.spent <= al * 1.5 ? 3 : 0);
    it.push({ k:'kb', l:'家計簿', m:10, p:pk,
      t:(sc.spendN ? yen(sc.spent) + ' 使った' : '支出の記録なし') + (al != null ? '（目安 ' + yen(al) + '）' : '') });
  }
  if(sc.sleep || sc.steps){
    var ph = 0, mh = 0, th = [];
    if(sc.sleep){ mh += 5; ph += sc.sleep >= 420 ? 5 : sc.sleep >= 360 ? 3 : 1; th.push('睡眠 ' + Math.floor(sc.sleep / 60) + '時間' + (sc.sleep % 60 ? (sc.sleep % 60) + '分' : '')); }
    if(sc.steps){ mh += 5; ph += sc.steps >= 8000 ? 5 : sc.steps >= 5000 ? 3 : 1; th.push(sc.steps + '歩'); }
    it.push({ k:'health', l:'睡眠・歩数', m:mh, p:ph, t:th.join('・') });
  }
  if(sc.petUse) it.push({ k:'pet', l:'おせわ', m:5, p:sc.petMis ? 5 : sc.petCoin > 0 ? 3 : 0,
    t:sc.petMis ? 'ミッション ' + sc.petMis + 'こ' : sc.petCoin > 0 ? 'コイン ' + sc.petCoin + 'まい' : 'この日は会えなかった' });
  if(sc.work) it.push({ k:'work', l:'バイト', m:5, p:5, t:sc.work + '回・おつかれさま' });
  return it;
}
/* よかったこと（満点の8わり以上のもの） */
function c9DayGoods(items, sc){
  var out = [];
  items.forEach(function(x){
    if(!x.m || x.p < x.m * 0.8) return;
    var w = ({ task: sc.tasks ? '締切の課題をぜんぶ出せた' : sc.doneOn ? '課題を' + sc.doneOn + '件終わらせた' : '',
               late: (sc.tasks || sc.doneOn) ? '期限切れをためていない' : '',
               att: '授業に出た（' + sc.cls + 'コマ）',
               anki: '暗記を' + sc.anki + '枚' + (sc.streak > 1 ? '（' + sc.streak + '日連続）' : ''),
               kb: sc.spendN ? '家計簿をつけて、使いすぎなかった' : '使いすぎなかった',
               health: 'よく眠れた・よく歩けた',
               pet: 'おせわのミッションをこなした',
               work: 'バイトをがんばった' })[x.k];
    if(w) out.push(w);
  });
  return out;
}
/* 次の日へのひとこと（いちばん点がとれなかったところから） */
function c9DayNext(items, sc){
  var hard = (S.ui.aiTone === 'coach' || S.ui.aiTone === 'spartan');
  var weak = items.filter(function(x){ return x.k !== 'work' && x.m && x.p < x.m * 0.8; })
    .sort(function(a, b){ return (a.p / a.m) - (b.p / b.m) || String(a.k).localeCompare(String(b.k)); })[0];
  if(!weak) return hard ? 'この調子を明日も続けること。' : 'この調子で、明日もいきましょう。';
  var w = ({
    task: sc.tasks > sc.done ? 'のこった課題を、まず10分だけ進めよう。' : '明日の課題を1つ、先に手をつけておこう。',
    late: '期限が過ぎた課題を、いちばん古いものから1つ片づけよう。',
    att: sc.ab ? '明日の授業の持ち物を、夜のうちにそろえておこう。' : '授業のあとに、出欠をつけておこう。',
    anki: '暗記カードを10枚だけでもやってみよう。',
    kb: sc.spendN ? '明日は使うお金をすこしおさえてみよう。' : '使ったお金を、家計簿にメモしておこう。',
    health: (sc.sleep && sc.sleep < 360) ? '今夜は早めに寝よう。' : 'すこし歩く時間をつくろう。',
    pet: 'おせわの子に会いに行こう。'
  })[weak.k] || '明日はひとつだけ、できることをやろう。';
  return hard ? w.replace(/よう。$/, 'ること。') : w;
}
/* SABCDE で評価する */
var GRADE_COLOR = { S:'#C9A227', A:'#E0876A', B:'#6FA8DC', C:'#84C7AC', D:'#B0A0C0', E:'#9AA0A6' };
function c9GradeOf(p){ return p >= 90 ? 'S' : p >= 78 ? 'A' : p >= 64 ? 'B' : p >= 50 ? 'C' : p >= 35 ? 'D' : 'E'; }
function dayGrade(ymd){
  var sc = dayScore(ymd);
  var items = c9DayBreakdown(ymd, sc);
  var M = 0, P = 0;
  items.forEach(function(x){ M += x.m; P += x.p; });
  var p = M ? Math.round(P / M * 100) : 0;
  p = Math.max(0, Math.min(100, p));
  return { grade:c9GradeOf(p), point:p, sc:sc, items:items, good:c9DayGoods(items, sc), next:c9DayNext(items, sc) };
}
/* 内わけを棒で見せる（きのうの評価・今日のふりかえり） */
function c9ItemsHtml(items){
  if(!Array.isArray(items) || !items.length) return '';
  return '<div class="c9items">' + items.map(function(x){
    var pct = x.m ? Math.round(x.p / x.m * 100) : 0;
    return '<div class="c9item"><span class="c9il">' + esc(x.l) + '</span>' +
      '<span class="bar"><i class="' + (pct >= 80 ? 'done' : pct >= 50 ? '' : 'over') + '" style="width:' + Math.max(4, pct) + '%"></i></span>' +
      '<span class="c9ip num">' + toNum(x.p) + '/' + toNum(x.m) + '</span>' +
      '<span class="c9it">' + esc(x.t || '') + '</span></div>';
  }).join('') + '</div>';
}
function gradeNote(g){
  return ({ S:'文句なし', A:'よくできた', B:'ふつうにできた', C:'もう少し', D:'手をつけられていない', E:'今日はお休みみたいな日' })[g] || '';
}
function reviewWords(sc){
  var tone = S.ui.aiTone || 'friendly';
  var hard = (tone === 'coach' || tone === 'spartan');
  var allDone = sc.tasks > 0 && sc.done === sc.tasks;
  var noneDone = sc.tasks > 0 && sc.done === 0;
  if(allDone){
    return hard ? '今日のぶんは全部終わった。えらい。この調子を明日も続けること。'
                : '今日のぶんは全部終わりました。よくがんばりましたね。';
  }
  if(noneDone && sc.tasks > 0){
    return hard ? '今日の課題、ひとつも終わってない。明日にまわすほど重くなるよ。今から10分でもやろう。'
                : '今日の課題がまだ残っています。10分だけでも手をつけてみませんか。';
  }
  if(sc.late >= 3){
    return hard ? '期限切れが' + sc.late + '件たまってる。まずいちばん古いのから片づけよう。'
                : '期限が過ぎたものが' + sc.late + '件あります。ひとつずつ片づけましょう。';
  }
  if(sc.done > 0){
    return hard ? sc.tasks + '件中' + sc.done + '件。残りもやってから寝よう。'
                : sc.tasks + '件のうち' + sc.done + '件おわりました。いいペースです。';
  }
  if(sc.cls > 0){
    return hard ? '今日は' + sc.cls + 'コマ。おつかれ。明日の準備だけはしておくこと。'
                : '今日は' + sc.cls + 'コマおつかれさまでした。ゆっくり休んでください。';
  }
  return hard ? '今日は予定なし。こういう日にこそ進めておこう。'
              : '今日はゆっくりできましたか。明日にそなえて休んでください。';
}
var reviewOpen = false;
function nightReviewCard(){
  if(S.ui.nightReview === 0) return '';
  var td = today();
  var rec = (S.dayReview||{})[td] || {};
  if(!reviewOpen){
    return section('今日のふりかえり', rec.grade ? rec.grade+' '+gradeNote(rec.grade) : null,
      (rec.grade
        ? '<div class="gradebox"><span class="gradeb" style="--gc:'+(GRADE_COLOR[rec.grade]||'#999')+'">'+rec.grade+'</span>'+
          '<span class="grow"><span class="t">'+esc(gradeNote(rec.grade))+'</span>'+
          (rec.memo?'<span class="s">'+esc(rec.memo)+'</span>':'')+'</span></div>'
        : '<div class="s2" style="margin-bottom:10px">ボタンを押すと、今日を S〜E で評価します。</div>')+
      '<div class="pair" style="margin-top:10px">'+
        '<button class="btn" data-act="rev-judge">'+(rec.grade?'もう一度評価する':'今日を評価する')+'</button>'+
        '<button class="btn ghost" style="flex:0 0 auto;padding:13px 16px" data-act="rev-hist">これまで</button></div>');
  }
  var jd = dayGrade(td);
  var sc = jd.sc;
  return section('今日のふりかえり', jd.grade+'（'+jd.point+'点）',
    '<div class="gradebox"><span class="gradeb" style="--gc:'+(GRADE_COLOR[jd.grade]||'#999')+'">'+jd.grade+'</span>'+
      '<span class="grow"><span class="t">'+esc(gradeNote(jd.grade))+'</span>'+
      '<span class="s">'+jd.point+'点</span></span></div>'+
    '<div class="bar" style="margin:10px 0"><i class="'+(jd.point>=64?'done':jd.point>=50?'':'over')+'" style="width:'+jd.point+'%"></i></div>'+
    c9ItemsHtml(jd.items)+
    (sc.late ? '<div class="s2" style="margin-bottom:10px"><b style="color:var(--rakuten)">期限切れ '+sc.late+'件</b></div>' : '')+
    '<div class="field"><label class="f">ひとこと（任意）</label><input id="rev_memo" value="'+esc(rec.memo||'')+'" placeholder="例：レポート終わった"></div>'+
    (rec.ai ? '<div class="msg '+(jd.point>=64?'ok':'ng')+'" style="margin-bottom:10px">'+esc(rec.ai).replace(/\n/g,'<br>')+'</div>' : '')+
    '<div class="pillrow" style="margin-bottom:10px">'+
      '<button class="mini" data-act="rev-ai" data-len="short">AIにひとこと</button>'+
      '<button class="mini" data-act="rev-ai" data-len="normal">ふつうに講評</button>'+
      '<button class="mini" data-act="rev-ai" data-len="long">くわしく講評</button>'+
    '</div>'+
    '<div class="pair">'+
      '<button class="btn" data-act="rev-save" data-d="'+td+'" data-g="'+jd.grade+'" data-p="'+jd.point+'">この評価で記録する</button>'+
      '<button class="btn ghost" style="flex:0 0 auto;padding:13px 16px" data-act="rev-close">とじる</button></div>');
}
/* これまでの振り返り */
var revHistOff = 0;
function reviewHistory(){
  var base = new Date();
  base.setDate(1);                 /* 31日に「前の月」を見ても、月がずれないように（9月31日→10月1日 にならない） */
  base.setMonth(base.getMonth() + revHistOff);
  var y = base.getFullYear(), mo = base.getMonth() + 1;
  var ym = y + '-' + pad(mo);
  var first = new Date(y, mo-1, 1);
  var days = new Date(y, mo, 0).getDate();
  var keys = Object.keys(S.dayReview||{}).filter(function(k){ return (S.dayReview[k]||{}).grade && k.slice(0,7)===ym; });
  var order = ['S','A','B','C','D','E'];
  var cnt = { S:0,A:0,B:0,C:0,D:0,E:0 };
  keys.forEach(function(k){ cnt[S.dayReview[k].grade]++; });
  var avgP = keys.length ? Math.round(keys.reduce(function(a,k){ return a + toNum(S.dayReview[k].point); }, 0) / keys.length) : 0;
  var avgG = !keys.length ? '—' : avgP >= 90 ? 'S' : avgP >= 78 ? 'A' : avgP >= 64 ? 'B' : avgP >= 50 ? 'C' : avgP >= 35 ? 'D' : 'E';

  var cells = '';
  ['日','月','火','水','木','金','土'].forEach(function(w){ cells += '<div class="rcw">'+w+'</div>'; });
  for(var i = 0; i < first.getDay(); i++) cells += '<div></div>';
  for(var d = 1; d <= days; d++){
    var k2 = ym + '-' + pad(d);
    var r = (S.dayReview||{})[k2];
    cells += '<div class="rc'+(r&&r.grade?' has':'')+(r&&r.grade&&r.auto?' c9auto':'')+'"'+(r&&r.grade?' style="--gc:'+(GRADE_COLOR[r.grade]||'#999')+'"':'')+
      (r&&r.grade&&r.auto?' title="自動でつけた評価"':'')+'>'+
      (r&&r.grade ? '<span class="rg">'+esc(r.grade)+'</span>' : '')+
      '<span class="rd">'+d+'</span></div>';
  }
  /* この月の記録（自動でつけたものも、自分でつけたものも） */
  var rows = keys.slice().sort().reverse().map(function(k){
    var r2 = S.dayReview[k] || {};
    var sub = r2.memo || r2.next || '';
    return '<div class="row c9revrow"><span class="gradeb" style="--gc:'+(GRADE_COLOR[r2.grade]||'#999')+'">'+esc(r2.grade)+'</span>'+
      '<div class="grow"><div class="t">'+esc(ymdLabel(k))+'　'+toNum(r2.point)+'点'+
        (r2.auto ? '<span class="b cr" style="margin-left:6px">自動</span>' : '<span class="b cat" style="margin-left:6px">自分で</span>')+'</div>'+
        (sub ? '<div class="s">'+esc(sub)+'</div>' : '')+
        (Array.isArray(r2.good) && r2.good.length ? '<div class="s">よかった：'+esc(r2.good.join('・'))+'</div>' : '')+
      '</div></div>';
  }).join('');
  return section('これまでのふりかえり', keys.length ? keys.length+'日　平均 '+avgG : null,
    '<div class="rhnav">'+
      '<button class="mini" data-act="rh-off" data-v="-1">‹</button>'+
      '<span class="rhym">'+y+'年'+mo+'月</span>'+
      '<button class="mini" data-act="rh-off" data-v="1">›</button>'+
      (revHistOff!==0 ? '<button class="mini" data-act="rh-set" data-v="0">今月へ</button>' : '')+
    '</div>'+
    '<div class="revcal">'+cells+'</div>'+
    (keys.length
      ? '<div class="pillrow" style="gap:6px">'+order.map(function(g){
          return '<span class="b" style="background:'+GRADE_COLOR[g]+'22;color:'+GRADE_COLOR[g]+';border:1px solid '+GRADE_COLOR[g]+'55">'+g+' '+cnt[g]+'</span>';
        }).join('')+'</div>'+
        '<p class="note" style="margin:0 0 6px">点のついた日は、アプリが次の日に自動で評価します（自分でつけた評価は、そのまま残ります）。</p>'+
        '<div class="c9revlist">'+rows+'</div>'
      : '<div class="empty">この月の記録はありません。</div>')+
    '<button class="btn ghost" style="margin-top:12px" data-act="rev-hist-close">とじる</button>');
}
function reviewTitle(sc){
  if(sc.tasks && sc.done === sc.tasks) return 'ぜんぶ終わった日';
  if(sc.late >= 3) return 'たまってきた';
  if(sc.cls >= 4) return 'よくがんばった';
  return null;
}
function morningBriefCard(){
  if(S.ui.morningBrief === 0) return '';
  var h = new Date().getHours();
  if(h >= 12) return '';
  var td = today();
  var cls = schoolClassesForDate(td);
  var items = focusItemsFor(td);
  var lines = [];
  if(cls.length){
    var st = S.commute.periods[cls[0].period-1];
    var leave = minutesOf(st) != null ? hhmmOf(minutesOf(st) - 30 - 80) : null;
    lines.push('きょうは' + cls.length + 'コマ。' + cls[0].period + '限 ' + st + '開始。' +
      (leave ? '<b>' + leave + 'ごろ家を出る</b>と間に合います。' : ''));
  }else{
    lines.push('きょうは通学なしです。');
  }
  var tests = items.filter(function(x){ return x.src==='exam'||x.src==='quiz'||x.src==='kousa'; });
  var dues = items.filter(function(x){ return x.src==='task' && !x.done; });
  if(tests.length) lines.push('テスト：' + tests.map(function(x){ return x.title; }).join('、'));
  if(dues.length) lines.push('締切：' + dues.map(function(x){ return x.title + (x.time?' '+x.time:''); }).join('、'));
  var u = umbrellaInfo();
  if(u && u.need) lines.push('雨の予報です。傘を持ってください。');
  var wk = S.shifts.filter(function(w){ return w.date === td; });
  if(wk.length) lines.push('バイト：' + wk.map(function(w){ return (w.start||'')+'〜'+(w.end||''); }).join('、'));
  return section('きょうの要点', ymdLabel(td),
    '<div class="msg" style="margin-bottom:0">' + lines.join('<br>') + '</div>');
}
var reviewHistOpen = false;
function reviewAction(act, t){
  if(act === 'rev-open'){ reviewOpen = true; render(); return true; }
  if(act === 'rev-close'){ reviewOpen = false; render(); return true; }
  if(act === 'rev-hist'){ reviewHistOpen = true; revHistOff = 0; render(); return true; }
  if(act === 'rh-off'){ revHistOff += toNum(t.dataset.v); render(); return true; }
  if(act === 'rh-set'){ revHistOff = toNum(t.dataset.v); render(); return true; }
  if(act === 'rev-hist-close'){ reviewHistOpen = false; render(); return true; }
  if(act === 'rev-star'){
    Array.prototype.forEach.call(t.parentNode.querySelectorAll('button'), function(b){ b.classList.remove('on'); });
    t.classList.add('on'); return true;
  }
  if(act === 'rev-judge'){ reviewOpen = true; render(); return true; }
  if(act === 'go-review'){
    appId = 'today'; todayTab = 'today'; reviewOpen = true; reviewHistOpen = false;
    render();
    setTimeout(function(){
      var el = [].slice.call(document.querySelectorAll('section')).filter(function(s){ return /ふりかえり/.test(s.textContent); })[0];
      if(el) el.scrollIntoView({ block:'center', behavior:'smooth' });
    }, 60);
    return true;
  }
  if(act === 'rev-save'){
    /* 夜のうちに開いて、0時をすぎてから押したときも、見ていた日（きのう）の記録にする */
    var dd = t.dataset.d, td2 = today();
    if(isYmd(dd) && dd < td2 && dd >= shiftDate(td2, -1)) td2 = dd;
    var prev = (S.dayReview||{})[td2] || {};
    S.dayReview = S.dayReview || {};
    var jd3 = dayGrade(td2);
    S.dayReview[td2] = { grade: t.dataset.g, point: toNum(t.dataset.p),
      memo: val('rev_memo'), ai: prev.ai || '', items: jd3.items, good: jd3.good, next: jd3.next, mt: Date.now() };
    touch('dayReview'); reviewOpen = false; toast(t.dataset.g + ' で記録しました'); commit(); return true;
  }
  if(act === 'rev-ai'){
    var len = t.dataset.len || 'normal';
    var jd2 = dayGrade(today());
    var sc2 = jd2.sc;
    var ask = '今日の評価は '+jd2.grade+'（'+jd2.point+'点）でした。' +
      '内わけ：' + jd2.items.map(function(x){ return x.l + ' ' + x.p + '/' + x.m + '点（' + x.t + '）'; }).join('、') + '。' +
      '期限切れ '+sc2.late+'件、バイト' + (sc2.work?'あり':'なし') + '。' +
      (len === 'short' ? 'ひとことで（1行）。'
       : len === 'long' ? 'くわしく（できたこと・できなかったこと・明日の一歩を、それぞれ2〜3行で）。'
       : '3〜4行で、よかった点と明日の一歩を。') +
      (S.ui.aiTone === 'coach' ? '甘やかさずに。' : '');
    /* 返事を振り返りにも残す */
    window.__revCatch = true;
    /* 相談タブに移って、そこで答えを見せる */
    appId = 'chat';
    if(chatRoom === 'main'){
      /* 振り返り用の会話をつくる（なければ） */
      S.chatMeta = S.chatMeta || {};
      var rid = 'review';
      if(!S.chatMeta[rid]){ S.chatMeta[rid] = { name:'ふりかえり', mt:Date.now() }; }
      S.chatRooms = S.chatRooms || {};
      if(!S.chatRooms[rid]) S.chatRooms[rid] = [];
      chatRoom = rid;
    }
    reviewOpen = false;
    render();
    chatSend(ask, { silent:false });
    return true;
  }
  return false;
}

/* くらしの手帳：朝のまとめ・夜のふりかえり */
/* ============================== 朝のまとめ・夜の振り返り ============================== */
/* 予定から自分で作る（AIを使わないので、キーがなくても動く） */
function dayScore(ymd){
  var tasks = S.tasks.filter(function(t){ return isYmd(t.due) && t.due === ymd; });
  var done = tasks.filter(function(t){ return t.done; }).length;
  var late = S.tasks.filter(function(t){ return !t.done && isYmd(t.due) && t.due < ymd; }).length;
  var cls = schoolClassesForDate(ymd);
  var att = 0, ab = 0;
  Object.keys(S.attendLog||{}).forEach(function(nm){
    (S.attendLog[nm]||[]).forEach(function(r){ if(r.date === ymd){ if(r.st === '欠') ab++; else att++; } });
  });
  var work = S.shifts.filter(function(w){ return w.date === ymd; }).length;
  var studied = 0;
  Object.keys(S.taskLog||{}).forEach(function(id){ studied += toNum((S.taskLog[id]||{}).min); });
  return { tasks:tasks.length, done:done, late:late, cls:cls.length, att:att, ab:ab, work:work, studied:studied };
}
/* SABCDE で評価する */
var GRADE_COLOR = { S:'#C9A227', A:'#E0876A', B:'#6FA8DC', C:'#84C7AC', D:'#B0A0C0', E:'#9AA0A6' };
function dayGrade(ymd){
  var sc = dayScore(ymd);
  var p = 0;
  /* 課題をどれだけ片付けたか（最大40点） */
  if(sc.tasks) p += Math.round(sc.done / sc.tasks * 40);
  else p += 24;                                   /* 締切がない日は標準点 */
  /* 出席（最大30点） */
  if(sc.cls){
    if(sc.ab) p += Math.max(0, 30 - sc.ab * 20);
    else if(sc.att) p += 30;
    else p += 20;                                 /* 記録していないだけかも */
  }else p += 20;
  /* 期限切れをためていないか（最大15点） */
  p += Math.max(0, 15 - sc.late * 5);
  /* 勉強した時間（最大10点） */
  p += Math.min(10, Math.round(sc.studied / 30) * 2);
  /* バイト（最大5点） */
  if(sc.work) p += 5;
  p = Math.max(0, Math.min(100, p));
  var g = p >= 90 ? 'S' : p >= 78 ? 'A' : p >= 64 ? 'B' : p >= 50 ? 'C' : p >= 35 ? 'D' : 'E';
  return { grade:g, point:p, sc:sc };
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
    '<div class="s2" style="margin-bottom:10px">'+
      (sc.tasks ? '課題 '+sc.done+'/'+sc.tasks+'件　' : '')+
      (sc.cls ? '授業 '+sc.cls+'コマ'+(sc.ab?'（欠席'+sc.ab+'）':'')+'　' : '') +
      (sc.work ? 'バイトあり　' : '')+
      (sc.studied ? '勉強 '+sc.studied+'分　' : '')+
      (sc.late ? '<b style="color:var(--rakuten)">期限切れ '+sc.late+'件</b>' : '')+
    '</div>'+
    '<div class="field"><label class="f">ひとこと（任意）</label><input id="rev_memo" value="'+esc(rec.memo||'')+'" placeholder="例：レポート終わった"></div>'+
    (rec.ai ? '<div class="msg '+(jd.point>=64?'ok':'ng')+'" style="margin-bottom:10px">'+esc(rec.ai).replace(/\n/g,'<br>')+'</div>' : '')+
    '<div class="pillrow" style="margin-bottom:10px">'+
      '<button class="mini" data-act="rev-ai" data-len="short">AIにひとこと</button>'+
      '<button class="mini" data-act="rev-ai" data-len="normal">ふつうに講評</button>'+
      '<button class="mini" data-act="rev-ai" data-len="long">くわしく講評</button>'+
    '</div>'+
    '<div class="pair">'+
      '<button class="btn" data-act="rev-save" data-g="'+jd.grade+'" data-p="'+jd.point+'">この評価で記録する</button>'+
      '<button class="btn ghost" style="flex:0 0 auto;padding:13px 16px" data-act="rev-close">とじる</button></div>');
}
/* これまでの振り返り */
var revHistOff = 0;
function reviewHistory(){
  var base = new Date();
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
    cells += '<div class="rc'+(r&&r.grade?' has':'')+'"'+(r&&r.grade?' style="--gc:'+(GRADE_COLOR[r.grade]||'#999')+'"':'')+'>'+
      (r&&r.grade ? '<span class="rg">'+esc(r.grade)+'</span>' : '')+
      '<span class="rd">'+d+'</span></div>';
  }
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
        }).join('')+'</div>'
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
    var td2 = today();
    var prev = (S.dayReview||{})[td2] || {};
    S.dayReview = S.dayReview || {};
    S.dayReview[td2] = { grade: t.dataset.g, point: toNum(t.dataset.p),
      memo: val('rev_memo'), ai: prev.ai || '', mt: Date.now() };
    touch('dayReview'); reviewOpen = false; toast(t.dataset.g + ' で記録しました'); commit(); return true;
  }
  if(act === 'rev-ai'){
    var len = t.dataset.len || 'normal';
    var jd2 = dayGrade(today());
    var sc2 = jd2.sc;
    var ask = '今日の評価は '+jd2.grade+'（'+jd2.point+'点）でした。' +
      '課題 '+sc2.done+'/'+sc2.tasks+'件、授業 '+sc2.cls+'コマ' + (sc2.ab?'（欠席'+sc2.ab+'）':'') +
      '、期限切れ '+sc2.late+'件、勉強 '+sc2.studied+'分、バイト' + (sc2.work?'あり':'なし') + '。' +
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

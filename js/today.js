/* くらしの手帳：バナー・今日ページ */
/* ============================== バナー ============================== */
function banners(){
  var out = [], d = derive(), cur = thisYm(), td = today();

  /* 天気・バス遅延 */
  if(weather.alert) out.push({c:'amber', ic:'⚠', t:weather.alert});

  /* 支払い前日・当日 */
  [['smbc',S.settings.smbcDay],['olive',S.settings.oliveDay],['rakuten',S.settings.rakutenDay]].forEach(function(p){
    var g = d.byMonth[cur] ? d.byMonth[cur][p[0]] : null;
    if(!g) return;
    var amt = g.plan + g.stmt; if(amt <= 0) return;
    var n = daysUntil(p[1]);
    if(n === 0) out.push({c:'red', ic:'●', t:'<b>今日は'+ACCOUNTS[p[0]].bank+'の引き落とし日</b>です。'+yen(amt)+' を用意してください。'});
    else if(n === 1) out.push({c:'red', ic:'●', t:'<b>明日は'+ACCOUNTS[p[0]].bank+'の引き落とし日</b>です。'+yen(amt)+' の入金を今日のうちに。'});
    else if(n <= 3) out.push({c:'amber', ic:'●', t:ACCOUNTS[p[0]].bank+'の引き落としまであと'+n+'日（'+yen(amt)+'）。'});
  });

  /* 課題の締切 */
  var near = S.tasks.filter(function(t){ return !t.done && isYmd(t.due); })
    .map(function(t){ return Object.assign({}, t, {left: daysFromToday(t.due)}); })
    .filter(function(t){ return t.left !== null && t.left <= 3; })
    .sort(function(a,b){ return a.left - b.left; });
  near.forEach(function(t){
    var w = t.left < 0 ? '<b>期限を過ぎています</b>' : t.left === 0 ? '<b>今日が締切</b>' : t.left === 1 ? '<b>明日が締切</b>' : 'あと'+t.left+'日';
    out.push({c: t.left <= 1 ? 'red' : 'amber', ic:'✎', t:'課題「'+esc(t.title)+'」'+(t.subject?'（'+esc(t.subject)+'）':'')+'は'+w+'です。'});
  });

  /* テスト */
  S.exams.filter(function(x){ return isYmd(x.date); }).forEach(function(x){
    var n = daysFromToday(x.date);
    if(n === null || n < 0 || n > 7) return;
    out.push({c: n <= 1 ? 'red' : 'blue', ic:'📖', t:(x.subject?esc(x.subject):'テスト')+'のテストは'+(n===0?'<b>今日</b>':n===1?'<b>明日</b>':'あと'+n+'日')+'です。'+(x.room?'（'+esc(x.room)+'）':'')});
  });

  /* 履修登録の締切 */
  if(isYmd(S.settings.regDeadline)){
    var r = daysFromToday(S.settings.regDeadline);
    if(r !== null && r >= 0 && r <= 7)
      out.push({c: r <= 2 ? 'red' : 'amber', ic:'🗓', t:'<b>履修登録の締切まであと'+r+'日</b>です（'+ymdLabel(S.settings.regDeadline)+'）。'});
  }

  /* 出席の残り */
  Object.keys(S.attend).forEach(function(k){
    var a = S.attend[k]; if(!a) return;
    var lim = toNum(a.limit)||5, ab = toNum(a.ab);
    if(ab >= lim) out.push({c:'red', ic:'△', t:'<b>'+esc(k)+'</b> の欠席が'+ab+'回で上限（'+lim+'回）に達しています。'});
    else if(lim - ab <= 1) out.push({c:'amber', ic:'△', t:esc(k)+' の欠席はあと'+(lim-ab)+'回で上限です。'});
  });

  /* 健康の期限 */
  S.health.filter(function(h){ return isYmd(h.next); }).forEach(function(h){
    var n = daysFromToday(h.next);
    if(n === null || n > 30) return;
    out.push({c: n < 0 ? 'red' : n <= 7 ? 'amber' : 'green', ic:'＋',
      t: esc(h.name)+'の期限は'+ymdLabel(h.next)+(n<0?'（<b>過ぎています</b>）':'（あと'+n+'日）')+'です。'});
  });

  /* 引き落とし前日：口座に足りるか */
  [['smbc',S.settings.smbcDay],['olive',S.settings.oliveDay],['rakuten',S.settings.rakutenDay]].forEach(function(p){
    var n = daysUntil(p[1]); if(n !== 1) return;
    var g = d.byMonth[cur] ? d.byMonth[cur][p[0]] : null; if(!g) return;
    var amt = g.plan + g.stmt; if(amt <= 0) return;
    var bank = S.balances.filter(function(x){ return norm(x.name).indexOf(norm(ACCOUNTS[p[0]].bank.slice(0,2)))>=0; })[0];
    if(bank && toNum(bank.amount) < amt)
      out.push({c:'red', ic:'¥', t:'<b>'+esc(bank.name)+'の残高が'+yen(amt-toNum(bank.amount))+'足りません。</b>明日の引き落としまでに入金してください。'});
  });
  /* バックアップの促し */
  if(needBackup()) out.push({c:'amber', ic:'💾', t:'<b>そろそろバックアップを。</b>設定タブの「Google連携」をつなぐと、毎週自動で保存されます（「ファイルでのバックアップ」でも保存できます）。'});
  /* 写真の容量 */
  try{
    var si = storageInfo();
    if(si.pct >= 85) out.push({c:'red', ic:'!', t:'<b>文字のデータの保存がいっぱいに近づいています（'+si.pct+'%）。</b>設定 › 容量から整理してください。'});
    else if(si.pct >= 70) out.push({c:'amber', ic:'!', t:'文字のデータの保存が'+si.pct+'%になりました。'});
  }catch(e){}
  /* 締切が近い課題（50）*/
  var lead = toNum(S.ui.dueLead);
  if(lead > 0){
    var soon = S.tasks.filter(function(t){
      if(t.done || !isYmd(t.due)) return false;
      var n = daysFromToday(t.due);
      return n >= 0 && n <= lead;
    });
    if(soon.length) out.push({c:'amber', ic:'✎', t:'あと'+lead+'日以内の課題が<b>'+soon.length+'件</b>あります。'});
  }
  /* お金の状態 */
  var b = budget();
  if(b.level === 'bad') out.push({c:'red', ic:'¥', t:'<b>今月は'+yen(-b.free)+'足りません。</b>収入と支払いの登録を見直してください。'});
  else if(b.level === 'warn') out.push({c:'amber', ic:'¥', t:'口座と収入を合わせても、今月自由に使えるのは'+yen(b.free)+'。かなりギリギリです。'});

  return out;
}

/* ============================== 今日ページ ============================== */
/* その日にやること・注意・重要を1つにまとめる（カレンダー・時間割から拾う） */
function focusItemsFor(ymd){
  var out = [];
  var show = function(src){
    var h = S.ui.weekHide || {};
    return !h[src];
  };
  /* カレンダーに入れた予定を全部（種類でしぼれる） */
  normItems().forEach(function(x){
    if(!isYmd(x.date)) return;
    if(x.plain) return;                                   /* ToDoで足したものは出さない */
    if(!show(x.src)) return;
    if(x.date === ymd || (x.span && coversDay(x, ymd))) out.push(x);
  });
  /* 休講・遠隔・補講 */
  if(show('chg')){
    changesOn(ymd).forEach(function(h){
      var ty = changeType(h), nm = ({cancel:'休講',online:'遠隔',makeup:'補講',holclass:'祝日でも授業あり'})[ty];
      out.push({ src:'chg', id:h.id, date:ymd, title:(h.course==='*'?'全休':h.course)+'　'+nm,
        sub:(ty==='makeup'&&h.period?h.period+'限':'')+(h.room?' '+h.room:''), time:'',
        colorRaw: ty==='cancel'?'var(--rakuten)':ty==='online'?'var(--e6)':ty==='holclass'?'var(--holi)':'var(--ok)', mt:h.mt||0 });
    });
    classesForDate(ymd).forEach(function(c){
      if(c.off==='biweek') out.push({ src:'chg', id:'bw'+c.name, date:ymd, title:c.name+'　今週なし（隔週）', sub:'', time:'', colorRaw:'var(--sub)', mt:0 });
    });
  }
  /* 引き落とし */
  if(show('pay')) payItemsOn(ymd).forEach(function(x){ out.push(x); });
  /* 健康の期限 */
  if(show('health')) S.health.forEach(function(h){ if(h.next===ymd) out.push({ src:'health', id:h.id, date:ymd, title:h.name+'（期限）', sub:h.memo||'', time:'', colorRaw:colorOf('c5'), mt:h.mt||0 }); });
  return out.sort(function(a,b){
    var ta = a.time || '99:99', tb = b.time || '99:99';
    if(ta !== tb) return ta.localeCompare(tb);
    return (Number(a.mt)||0) - (Number(b.mt)||0);
  });
}
function focusRow(x){
  var label = ({imp:'重要',exam:'大テスト',kousa:'考査',quiz:'小テスト',task:'課題',chg:'授業の変更',work:'バイト',pay:'引落',health:'期限'})[x.src] || '';
  var isTask = (x.src === 'task');
  var isTest = (x.src==='quiz' || x.src==='exam' || x.src==='kousa');
  var showProg = isTest && S.ui.showProg !== 0;
  var clickable = x.edit || ['task','quiz','exam','kousa','imp'].indexOf(x.src)>=0;
  var sb = String(x.sub||''); if(sb && sb.indexOf(label)===0) sb = sb.slice(label.length).replace(/^・/,'');
  /* 時刻の言い方を予定の種類に合わせる */
  var tl = isTask ? (x.time ? x.time+' まで' : '締切')
         : isTest ? (x.time ? x.time+' 開始' : '')
         : (x.src==='work' ? '' : (x.time ? x.time+' 〜' : '終日'));
  if(x.src==='work'){
    var w0 = S.shifts.filter(function(z){ return z.id===x.id; })[0];
    if(w0){ var hh0 = shiftHours(w0), ot0 = toNum(w0.ot);
      tl = (w0.start||'')+'〜'+(w0.end||'')+(hh0?'（'+hh0+'時間'+(ot0?'・残業'+ot0+'分':'')+'）':''); sb = ''; }
  }
  var meta = [label, tl, sb].filter(Boolean).join('・');
  return '<div class="frow'+(isTask&&x.done?' isdone':'')+'">'+
    '<span class="fdot'+(isTask&&x.done?' done':'')+'" style="'+((isTask&&x.done)?'border-color:'+itemColor(x):'background:'+itemColor(x))+'"></span>'+
    (isTask ? '<button class="chk sm'+(x.done?' on':'')+'" data-act="'+(x.done?'task-undone':'task-done')+'" data-id="'+x.id+'" aria-label="終わった">'+(x.done?'✓':'')+'</button>' : '')+
    (showProg ? '<button class="progb sm" data-act="prog-step" data-id="'+x.id+'" title="'+esc(progLabel(x.id))+'">'+progIcon(x.id)+'</button>' : '')+
    '<span class="grow" '+(clickable?'data-act="ev-open" data-src="'+x.src+'" data-id="'+x.id+'" role="button"':'')+'>'+
      '<span class="ft">'+esc(x.title)+'</span>'+
      '<span class="fs">'+esc(meta)+(showProg?'・'+esc(progLabel(x.id)):'')+'</span></span>'+
    (clickable?'<span class="s2">›</span>':'')+'</div>';
}
/* 今日の「やること・注意」カード（一番上に置く） */
function focusCard(ymd, title){
  var items = focusItemsFor(ymd);
  var late = S.tasks.filter(function(t){ return !t.done && isYmd(t.due) && t.due < today(); });
  var head = '';
  if(ymd === today() && late.length) head += '<div class="bn red"><span class="ic">!</span><span><b>期限切れの課題が'+late.length+'件</b>あります。ToDoから確認してください。</span></div>';
  if(!items.length && !head) return section(title, '', '<div class="empty" style="padding:10px 0">特に注意することはありません。</div>');
  return section(title, items.length?items.length+'件':'', head + items.map(focusRow).join(''));
}
/* 今週（月〜金＋土日）のやること・注意 */
function weekFocus(mon){
  var h = '';
  for(var i=0;i<7;i++){
    var d = new Date(mon); d.setDate(mon.getDate()+i);
    var ymd = toYmd(d), items = focusItemsFor(ymd);
    var cls = schoolClassesForDate(ymd);
    var isToday = ymd===today();
    var hol = holidayName(ymd);
    var past = ymd < today();
    var manual = S.ui.weekClosed && (ymd in S.ui.weekClosed);
    var closed = manual ? !!S.ui.weekClosed[ymd] : past;   /* 過ぎた日は自動でたたむ */
    h += '<div class="wday'+(isToday?' now':'')+(closed?' closed':'')+'">'+
      '<div class="wdh" data-act="wday-toggle" data-d="'+ymd+'" role="button">'+
      '<span class="wdn" style="'+(d.getDay()===0||hol?'color:var(--holi)':d.getDay()===6?'color:var(--e6)':'')+'">'+
        (closed?'▸ ':'▾ ')+(d.getMonth()+1)+'/'+d.getDate()+'（'+WDAY[d.getDay()]+'）</span>'+
      '<span class="s2">'+(hol?esc(hol)+'　':'')+(items.length?items.length+'件・':'')+(cls.length?cls[0].period+'限〜'+cls[cls.length-1].period+'限':'通学なし')+'</span></div>'+
      (closed ? '' : (items.length ? items.map(focusRow).join('') : '<div class="s2" style="padding:2px 0 4px">予定なし</div>'))+
      '</div>';
  }
  return h;
}

function secWrap(id, title, note, inner, forceOpen){
  var closed = !!S.ui.todayClosed[id] && !forceOpen;
  return '<section class="tsec'+(closed?' closed':'')+'"><div class="head" data-act="today-toggle" data-id="'+id+'" role="button">'+
    '<h2>'+(closed?'▸ ':'▾ ')+esc(title)+'</h2>'+(note?'<span>'+esc(note)+'</span>':'')+'</div>'+
    (closed ? '' : '<div class="box">'+inner+'</div>')+'</section>';
}
function viewTodayLife(){
  var html = '';
  var parts = {};
  parts.money = function(){
    var b = budget();
    var lv = (b.level==='bad'||b.level==='warn') ? 'ng' : 'ok';
    return secWrap('money','今月のお金', ymLabel(b.month),
      '<div class="msg '+lv+'" style="margin-bottom:12px">'+esc(b.word)+'</div>'+
      '<div class="grid2">'+
        '<div class="stat"><div class="k">自由に使えるお金</div><div class="v num">'+yen(b.free)+'</div></div>'+
        '<div class="stat"><div class="k">うち口座の残高</div><div class="v num">'+yen(b.balance)+'</div></div></div>'+
      '<button class="btn ghost" style="margin-top:12px" data-act="go" data-app="money" data-tab="home">お金の画面をひらく</button>');
  };
  parts.banners = function(){
    var bs = banners();
    if(!bs.length) return '';
    bs.forEach(function(b){ notice_(String(b.t).replace(/<[^>]+>/g,''), b.c); });
    return '<section>' + bs.map(function(b){ return '<div class="bn '+b.c+'"><span class="ic">'+b.ic+'</span><span>'+b.t+'</span></div>'; }).join('') + '</section>';
  };
  parts.next10 = function(){ return next10Card(); };
  if(typeof kmParts === 'function') kmParts('life', parts, {});
  pageOrder('life').forEach(function(id){ if(parts[id] && !pageHidden('life', id)) html += parts[id](); });
  if(typeof c9HomeLink === 'function') html += c9HomeLink('life');
  return html;
}

/* 今日タブ：3つの見方 */
function viewToday(){
  if(todayTab === 'week') return viewWeekTab();
  if(todayTab === 'life') return viewTodayLife();
  if(todayTab === 'tomo') return viewTomoTab();
  return viewTodayTab();
}
/* 「今日」：やること・注意を一番上に、その下に授業と行き方 */
/* 今日／明日の1日ぶん（同じ作りで日付だけ変える） */
/* ===== 欠席の上限が近い授業 ===== */
function absenceRisks(){
  return termCourses().map(function(c){
    var at = attendOf(c.name);
    return { name:c.name, at:at, rest:at.limit - at.ab };
  }).filter(function(x){ return x.at.limit > 0 && x.rest <= 1; })
    .sort(function(a,b){ return a.rest - b.rest; });
}
function absenceAlert(ymd){
  var risks = absenceRisks();
  if(!risks.length) return '';
  var clsToday = {};
  classesForDate(ymd).forEach(function(c){ if(!c.off) clsToday[c.name] = c.period; });
  var isToday = (ymd === today());
  var over = risks.some(function(x){ return x.rest <= 0; });
  return '<div class="bn '+(over?'red':'amber')+' absalert"><span class="ic">!</span><span class="grow">'+
    '<b>欠席に気をつけて</b>'+
    risks.map(function(x){
      var p = clsToday[x.name];
      return '<span class="absrow" role="button" data-act="course-open" data-name="'+esc(x.name)+'">'+
        esc(shortName(x.name))+'：'+
        (x.rest <= 0 ? '<b>上限に達しています</b>（欠席'+x.at.ab+'／'+x.at.limit+'回）'
                     : '<b>あと1回</b>休むと単位がとれません（欠席'+x.at.ab+'／'+x.at.limit+'回）')+
        (p ? '<span class="b warn" style="margin-left:6px">'+(isToday?'今日':'明日')+' '+p+'限にあります</span>' : '')+
        '</span>';
    }).join('')+
    '</span></div>';
}
function viewDay(ymd, pageKey){
  var a = ymd.split('-'), d = new Date(+a[0], +a[1]-1, +a[2]);
  var dch = WDAY[d.getDay()], isToday = (ymd === today());
  if(isToday && typeof ensureExamStudyTasks === 'function') ensureExamStudyTasks();
  var hh = new Date().getHours();
  var greet = isToday ? (hh < 5 ? 'おそくまでおつかれさま' : hh < 11 ? 'おはようございます' : hh < 18 ? 'こんにちは' : 'おつかれさま') : '明日の予定';
  var chHero = (isToday && typeof charaHero === 'function') ? charaHero() : '';
  var html = '<div class="hero slim'+(chHero ? ' withch' : '')+'"><div class="date">'+(+a[0])+'年'+(+a[1])+'月'+(+a[2])+'日（'+dch+'）'+
    (holidayName(ymd) ? '　'+esc(holidayName(ymd)) : '')+'</div><div class="greet">'+greet+'</div>'+chHero+'</div>';

  /* 欠席があと1回で上限の授業（いちばん上に出す） */
  html += absenceAlert(ymd);
  if(isToday) html += examStrip();          /* 次の試験が7日以内なら、小さな帯（並べ替えの外・いつも同じ場所） */
  if(isToday && typeof jhStrip === 'function') html += jhStrip();   /* 実習期間の日は、実習の帯（js/m-jisshu.js） */
  if(isToday && typeof placeCard === 'function') html += placeCard();

  var parts = {};
  parts.weather = function(){
    if(!isToday){
      var t = tomorrowRain();
      if(!t) return '';
      return '<div class="bn '+(t.need?'red':'green')+'"><span class="ic">'+(t.need?'☔':'☀')+'</span><span>'+
        (t.need?'明日は雨の予報です（降水'+t.pop+'%）。傘を用意してください。':'明日の降水は'+t.pop+'%。傘は要らなさそうです。')+'</span></div>';
    }
    return secWrap('weather','天気','三田と西宮', (typeof warnCard === 'function' ? warnCard() : '') +
      (weatherCard() || '<div class="empty">天気は設定でオンにできます。</div>') + (typeof radarCard === 'function' ? radarCard() : ''));
  };
  parts.events = function(){
    var its = itemsOn(ymd).filter(function(x){ return x.src!=='cls'; });
    return secWrap('events', (isToday?'今日':'明日')+'の予定', its.length?its.length+'件':null,
      (its.length ? its.map(function(x){ return itemRow(x, true); }).join('')
                 : '<div class="empty">予定はありません。</div>')+
      '<button class="mini" style="margin-top:8px" data-act="share-day" data-d="'+ymd+'">この日の予定を共有</button>');
  };
  parts.classes = function(){
    var cls = classesForDate(ymd);
    return secWrap('classes', (isToday?'今日':'明日')+'の授業', dch+'曜日',
      !cls.length ? '<div class="empty">授業はありません。</div>'
      : cls.map(function(c){
          var st = S.commute.periods[c.period-1]||'', en = S.commute.ends[c.period-1]||'';
          var its = itemsForCourseOn(c.name, ymd);
          return '<div class="tline tap'+(c.off?' offline':'')+'" data-act="course-open" data-name="'+esc(c.name)+'" role="button" tabindex="0">'+
            '<span class="pd-badge" style="background:'+courseColor(c.name)+';color:#fff">'+c.period+'</span>'+
            '<span class="grow"><span class="t"'+(c.off?' style="text-decoration:line-through;color:var(--sub)"':'')+'>'+esc(c.name)+
              (its.length?' '+its.map(function(x){ return '<span class="cevd" style="background:'+itemColor(x)+';display:inline-block;width:9px;height:9px;border-radius:50%;margin-left:3px;vertical-align:middle"></span>'; }).join(''):'')+'</span>'+
            '<span class="s">'+esc(c.room||'')+(c.web?'（家で受講）':'')+(c.online?'・遠隔':'')+(c.makeup?'・補講':'')+
              (c.off==='cancel'?'　休講':c.off==='biweek'?'　今週なし':c.off==='holiday'?'　祝日（授業なし）':'')+'</span></span>'+
            '<span class="s2 num">'+esc(st)+'<br>'+esc(en)+'</span>'+
            '<span class="chev">›</span></div>';
        }).join(''));
  };
  parts.items = function(){
    if(typeof morningLines !== 'function') return '';
    var lines = morningLines(ymd);
    if(!lines.length) return '';
    return secWrap('items', (isToday?'今日':'明日')+'の持ち物', null,
      lines.map(function(l){ return '<div class="row"><div class="grow">'+esc(l)+'</div></div>'; }).join(''));
  };
  parts.transit = function(){ var tr = transitFor(ymd); return tr ? '<div class="tsec">'+tr+'</div>' : ''; };
  parts.brief = function(){ return isToday ? morningBriefCard() : ''; };
  parts.review = function(){ return isToday ? (nightReviewCard() + (reviewHistOpen ? reviewHistory() : '')) : ''; };
  parts.unkou = function(){
    return isToday ? secWrap('delay', '遅れた・乗りそこねたとき', '次の便で何時に着く？', delayCard()) + unkouCard() : '';
  };
  parts.find = function(){ return isToday ? findCard() : ''; };
  parts.leave = function(){ return isToday ? leaveCard() : ''; };
  parts.memo = function(){
    var pinned = S.notes.filter(function(n){ return n.pinned; });   /* 上限なし */
    return secWrap('memo','メモ', pinned.length?'ピン留め '+pinned.length+'件':null,
      (pinned.length ? pinned.map(noteRow).join('') : '<div class="empty">ピン留めしたメモがここに出ます。</div>')+
      '<button class="btn ghost" style="margin-top:8px" data-act="note-new">メモを作る</button>');
  };
  if(typeof kmParts === 'function') kmParts(pageKey, parts, { ymd:ymd, isToday:isToday });
  pageOrder(pageKey).forEach(function(id){ if(parts[id] && !pageHidden(pageKey, id)) html += parts[id](); });
  /* いちばん下に「ホーム画面をととのえる」（出すもの・並びを変える画面へ） */
  if(typeof c9HomeLink === 'function') html += c9HomeLink(pageKey);
  return html;
}
function viewTodayTab(){ return viewDay(today(), 'today'); }
function viewTomoTab(){ return viewDay(shiftDate(today(),1), 'tomo'); }
/* 「今週」：月〜日のやること・注意を1画面で */
var weekOff = null;   /* null なら自動（土日は翌週） */
function viewWeekTab(){
  var now = new Date(), dow = now.getDay();
  if(weekOff === null) weekOff = (dow===0 || dow===6) ? 1 : 0;
  var mon = new Date(now); mon.setDate(now.getDate() - ((dow+6)%7) + weekOff*7);
  var sun = new Date(mon); sun.setDate(mon.getDate()+6);
  var all = []; for(var i=0;i<7;i++){ all = all.concat(focusItemsFor(toYmd(new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+i)))); }
  var n = function(src){ return all.filter(function(x){ return x.src===src; }).length; };
  var label = weekOff===0?'今週':weekOff===1?'来週':weekOff===-1?'先週':(weekOff>0?weekOff+'週あと':(-weekOff)+'週前');
  var html = '<button class="btn ghost" style="margin-bottom:12px" data-act="go-weekahead">📋 来週のまとめ</button>';
  html += '<div class="head"><h2>'+label+'</h2><span>'+(mon.getMonth()+1)+'/'+mon.getDate()+'〜'+(sun.getMonth()+1)+'/'+sun.getDate()+'</span></div>';
  html += '<div class="pillrow"><button class="mini" data-act="wk-off" data-v="-1">‹ 前週</button>'+
    '<button data-act="wk-set" data-v="0" class="'+(weekOff===0?'on':'')+'">今週</button>'+
    '<button data-act="wk-set" data-v="1" class="'+(weekOff===1?'on':'')+'">来週</button>'+
    '<button class="mini" data-act="wk-off" data-v="1">次週 ›</button></div>';
  var parts = {};
  parts.days = function(){ return '<div class="box">'+weekFocus(mon)+'</div>'; };
  parts.review = function(){ return (weekOff >= 0 && weekOff <= 1 && typeof weekReviewCard === 'function') ? weekReviewCard(monOfYmd(today())) : ''; };
  parts.notes = function(){
    var dates = {}; DAYS.forEach(function(d,i){ var x=new Date(mon); x.setDate(mon.getDate()+i); dates[d]=toYmd(x); });
    return weekNotes(dates);
  };
  pageOrder('week').forEach(function(id){ if(parts[id] && !pageHidden('week', id)) html += parts[id](); });
  if(typeof c9HomeLink === 'function') html += c9HomeLink('week');
  return html;
}


/* やることリスト（今日の枠の中） */
function todoCard(){
  var open = S.tasks.filter(function(t){ return !t.done; })
    .map(function(t){ return Object.assign({}, t, {left: isYmd(t.due) ? daysFromToday(t.due) : null}); })
    .sort(function(a,b){ if(a.left===null) return 1; if(b.left===null) return -1; return a.left-b.left; });
  return secWrap('todo','やること', open.length ? open.length+'件' : '片付いています',
    (open.length ? open.slice(0,8).map(taskRow).join('') + (open.length>8 ? '<p class="note">ほか'+(open.length-8)+'件。ToDoタブで全部見られます。</p>' : '')
      : '<div class="empty">やることはありません。</div>'));
}

/* これから10日間 */
function next10Card(){
  var td = today(), limit = shiftDate(td, 10);
  var list = normItems().filter(function(x){
    if(!isYmd(x.date)) return false;
    if(x.src === 'task' && x.done) return false;
    if(x.src === 'work') return false;              /* バイトは別枠で見る */
    return x.date > td && x.date <= limit;
  }).sort(function(a,b){ return a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time)); });

  return section('これから10日間', list.length ? list.length+'件' : null,
    list.length ? list.map(function(x){
      var n = daysFromToday(x.date);
      return '<div class="evrow"><span class="cbar" style="background:'+itemColor(x)+'"></span>'+
        '<span class="grow"><span class="t">'+esc(x.title)+'</span>'+
        '<span class="s">'+ymdLabel(x.date)+(x.time?' '+x.time:'')+(x.sub?'・'+esc(x.sub):'')+'</span></span>'+
        '<span class="due '+dueClass(n)+'">'+dueText(n)+'</span></div>';
    }).join('') : '<div class="empty">10日以内の課題やテストはありません。</div>');
}

/* ============================== 試験タブ ============================== */
/* 試験系の予定（小テスト・大テスト・考査）。S.exams も、種類を試験系にした予定も、normItems の src で見分ける */
var EXAM_SRCS = ['quiz','exam','kousa'];
function examUpcoming(from){
  from = from || today();
  return normItems().filter(function(x){ return EXAM_SRCS.indexOf(x.src) >= 0 && isYmd(x.date) && x.date >= from; })
    .sort(function(a,b){ return a.date.localeCompare(b.date) || String(a.time||'').localeCompare(String(b.time||'')); });
}
function examLeftText(n){ return n===0 ? '今日' : n===1 ? '明日' : 'あと'+n+'日'; }
function examHm(min){
  min = Math.round(toNum(min));
  if(min <= 0) return '0分';
  var h = Math.floor(min/60), m = min%60;
  return (h ? h+'時間' : '') + (m || !h ? m+'分' : '');
}
/* その試験の進みぐあい（どれも今あるデータを数えるだけ） */
function examProgress(x){
  var pre = 'examstudy_' + x.id + '_', subj = x.subj || '';
  var plan = S.tasks.filter(function(t){ return String(t.id||'').indexOf(pre) === 0; });
  var min = 0;
  if(subj) S.tasks.forEach(function(t){ if(sameSubject(t.subject, subj)) min += taskMinutes(t.id); });
  var cards = (subj && typeof ankiCards === 'function') ? ankiCards().filter(function(c){ return sameSubject(c.deck, subj); }) : [];
  return { planAll:plan.length, planDone:plan.filter(function(t){ return t.done; }).length, min:min,
    cardsAll:cards.length, cardsLeft:cards.filter(function(c){ return ankiIsNew(c) || ankiIsDue(c); }).length };
}
function examName(x){
  var raw = (S.exams||[]).filter(function(e){ return e.id === x.id; })[0];
  return x.title + (raw && raw.title && raw.title !== x.title ? '「'+raw.title+'」' : '');
}
/* 勉強の画面へ（タブに出していない画面でも、一時的に開く） */
function examGo(app, tool){
  if(!app) return;
  var setup = function(){ if(app === 'study') studyTool = tool || ''; };
  if(typeof c9Go === 'function'){ c9Go(app, setup); return; }
  appId = app; setup(); render(); window.scrollTo(0,0);
}
function examRow(x){
  var n = daysFromToday(x.date), p = examProgress(x);
  var bits = [];
  if(p.planAll) bits.push('試験勉強の予定 '+p.planDone+'/'+p.planAll+' 済み');
  if(x.subj) bits.push('勉強時間 '+examHm(p.min));
  if(p.cardsAll) bits.push('暗記カード 残り'+p.cardsLeft+'枚（ぜんぶで'+p.cardsAll+'枚）');
  var isCourse = x.subj && termCourses().some(function(c){ return c.name === x.subj; });
  return '<div class="exrow" style="padding:4px 0 10px;border-bottom:1px solid var(--rule)">'+
    '<div class="evrow" style="border-bottom:0" data-act="ev-open" data-src="'+x.src+'" data-id="'+esc(x.id)+'" role="button">'+
      '<span class="cbar" style="background:'+itemColor(x)+'"></span>'+
      '<span class="grow"><span class="t">'+esc(examName(x))+'</span>'+
      '<span class="s">'+esc(kindOf(x.src).name)+'・'+ymdLabel(x.date)+(x.time?' '+esc(x.time):'')+'</span></span>'+
      '<span class="due '+dueClass(n)+'">'+examLeftText(n)+'</span></div>'+
    (bits.length ? '<div class="s2" style="margin:0 0 6px 14px">'+esc(bits.join('・'))+'</div>' : '')+
    '<div class="pillrow" style="margin-left:14px">'+
      '<button class="mini" data-act="go-exam" data-app="study" data-tool="ak2-plan">📅 勉強する</button>'+
      (p.cardsAll ? '<button class="mini" data-act="go-exam" data-app="anki">🃏 暗記カード</button>' : '')+
      (isCourse ? '<button class="mini" data-act="course-open" data-name="'+esc(x.subj)+'">授業の画面</button>' : '')+
    '</div></div>';
}
function viewExam(){
  var list = examUpcoming();
  if(!list.length){
    return section('試験', null, '<div class="empty">'+ART.empty+'<div style="margin-top:8px">試験の予定はありません。</div></div>'+
      '<p class="note">予定の種類を「小テスト」「大テスト」「考査」にして登録すると、ここにまとまります。</p>');
  }
  var nx = list[0], n = daysFromToday(nx.date);
  var html = section('次の試験まで', ymdLabel(nx.date)+(nx.time?' '+nx.time:''),
    '<div class="big num" style="color:'+(n<=3?'var(--rakuten)':'var(--ink)')+'">'+(n===0 ? '今日' : 'あと'+n+'日')+'</div>'+
    '<div class="s" style="margin-top:4px">'+esc(examName(nx))+'（'+esc(kindOf(nx.src).name)+'）</div>');
  html += section('これからの試験', list.length+'件', list.map(examRow).join(''));
  return html;
}
/* 今日タブの帯：次の試験が7日以内のときだけ */
function examStrip(){
  var nx = examUpcoming()[0];
  if(!nx) return '';
  var n = daysFromToday(nx.date);
  if(n == null || n > 7) return '';
  return '<div class="bn '+(n<=2?'red':'amber')+'" data-act="go-exam" data-app="exam" role="button" style="cursor:pointer">'+
    '<span class="ic">📝</span><span class="grow">'+
    (n===0 ? '今日は<b>'+esc(nx.title)+'</b>の試験です' : '<b>'+esc(nx.title)+'</b>の試験まで あと'+n+'日')+'</span>'+
    '<span class="s2">›</span></div>';
}

/* ============================== 来週のまとめ（今週タブから） ============================== */
/* 端末のデータだけで作る（Discordへ送る週まとめは、橋わたし側のまま） */
function weekAheadData(){
  var td = today(), a = td.split('-'), d0 = new Date(+a[0], +a[1]-1, +a[2]);
  var mon = shiftDate(td, 7 - ((d0.getDay()+6)%7)), days = [];
  for(var i=0;i<7;i++) days.push(shiftDate(mon, i));
  var sun = days[6];
  var inWeek = function(ymd){ return isYmd(ymd) && ymd >= mon && ymd <= sun; };
  var clsDays = days.filter(function(ymd){ return classesForDate(ymd).some(function(c){ return !c.off; }); });
  var items = normItems().filter(function(x){
    return inWeek(x.date) && (EXAM_SRCS.indexOf(x.src) >= 0 || (x.src === 'task' && !x.done));
  }).sort(function(p,q){ return p.date.localeCompare(q.date) || String(p.time||'').localeCompare(String(q.time||'')); });
  var shifts = S.shifts.filter(function(s){ return inWeek(s.date); });
  var risks = absenceRisks().map(function(r){
    var on = days.filter(function(ymd){ return classesForDate(ymd).some(function(c){ return c.name === r.name && !c.off; }); });
    return on.length ? { r:r, on:on } : null;
  }).filter(Boolean);
  var wx = [], dl = weather && weather.sanda && weather.sanda.daily;
  if(dl && Array.isArray(dl.time)){
    dl.time.forEach(function(t, j){
      if(!inWeek(t)) return;
      wx.push({ date:t, code:(dl.weather_code||[])[j], max:(dl.temperature_2m_max||[])[j], min:(dl.temperature_2m_min||[])[j], pop:(dl.precipitation_probability_max||[])[j] });
    });
  }
  return { mon:mon, sun:sun, clsDays:clsDays, items:items, shifts:shifts, pay:sumBy(shifts, shiftPay), risks:risks, wx:wx };
}
function weekAheadHtml(w){
  var md = function(ymd){ var b = ymd.split('-'); return (+b[1])+'/'+(+b[2])+'（'+WDAY[new Date(+b[0], +b[1]-1, +b[2]).getDay()]+'）'; };
  var html = section('授業', w.clsDays.length ? w.clsDays.length+'日' : 'なし',
    w.clsDays.length ? '<div class="s">'+w.clsDays.map(md).join('・')+'</div>' : '<div class="empty" style="padding:6px 0">来週は授業がありません。</div>');
  html += section('試験・締切', w.items.length ? w.items.length+'件' : null,
    w.items.length ? w.items.map(function(x){
      return '<div class="evrow"><span class="cbar" style="background:'+itemColor(x)+'"></span>'+
        '<span class="grow"><span class="t">'+esc(x.src === 'task' ? x.title : examName(x))+'</span>'+
        '<span class="s">'+esc(x.src === 'task' ? '締切' : kindOf(x.src).name)+'・'+md(x.date)+(x.time?' '+esc(x.time):'')+(x.src === 'task' && x.sub ? '・'+esc(x.sub) : '')+'</span></span></div>';
    }).join('') : '<div class="empty" style="padding:6px 0">試験や締切はありません。</div>');
  html += section('バイト', w.shifts.length ? w.shifts.length+'回' : 'なし',
    w.shifts.length ? '<div class="row"><div class="grow s">見込みのバイト代（交通費こみ）</div><div class="amt num">'+yen(w.pay)+'</div></div>'+
      '<div class="s">'+w.shifts.slice().sort(function(p,q){ return String(p.date).localeCompare(String(q.date)); })
        .map(function(s){ return md(s.date)+' '+esc(s.start||'')+'〜'+esc(s.end||''); }).join('<br>')+'</div>'
      : '<div class="empty" style="padding:6px 0">来週のシフトはありません。</div>');
  if(w.risks.length){
    html += section('欠席に注意', w.risks.length+'科目', w.risks.map(function(x){
      return '<div class="bn '+(x.r.rest <= 0 ? 'red' : 'amber')+'"><span class="ic">!</span><span class="grow"><b>'+esc(shortName(x.r.name))+'</b>　'+
        (x.r.rest <= 0 ? '上限に達しています' : 'あと1回で上限')+'（欠席'+x.r.at.ab+'／'+x.r.at.limit+'回）<br>来週は '+x.on.map(md).join('・')+' にあります</span></div>';
    }).join(''));
  }
  if(w.wx.length){
    html += section('天気', '三田', w.wx.map(function(x){
      return '<div class="row"><div class="grow s">'+md(x.date)+'</div><div class="t">'+esc(typeof weatherWord === 'function' ? weatherWord(x.code) : '')+
        (x.max != null ? '　'+Math.round(x.max)+'℃／'+Math.round(x.min)+'℃' : '')+(x.pop != null ? '　降水'+x.pop+'%' : '')+'</div></div>';
    }).join('') + '<p class="note">予報が出ている日だけです。</p>');
  }
  return html;
}
function openWeekAhead(){
  var w = weekAheadData();
  var sh = document.getElementById('detail');
  if(!sh) return;
  var md = function(ymd){ var b = ymd.split('-'); return (+b[1])+'/'+(+b[2]); };
  sh.querySelector('.sheet-hd h3').textContent = '来週のまとめ（'+md(w.mon)+'〜'+md(w.sun)+'）';
  sh.querySelector('.sheet-bd').innerHTML = weekAheadHtml(w);
  document.getElementById('veil').classList.add('on');
  sh.classList.add('on');
}

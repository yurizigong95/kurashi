/* くらしの手帳：予定・カレンダー */
/* ============================== 予定の正規化 ============================== */
function shiftHours(s){
  return Math.round((shiftMinutes(s) - shiftBreak(s) + (toNum(s.ot)||0)) / 6) / 10;
}
function shiftMinutes(s){
  var a = minutesOf(s.start), b = minutesOf(s.end);
  if(a == null || b == null) return 0;
  var m = b - a; if(m < 0) m += 1440;
  return m;
}
/* 実際に終わった時間から、残業（マイナスなら早上がり）を出す */
function otFromReal(d){
  var st = minutesOf(d.time), en = minutesOf(d.end), re = minutesOf(d.realEnd);
  if(st == null || en == null || re == null) return toNum(d.ot);
  var base = en - st; if(base < 0) base += 1440;
  var real = re - st; if(real < 0) real += 1440;
  return real - base;
}
function shiftBreak(s){ return (shiftMinutes(s) >= 420) ? 60 : 0; }   /* 7時間以上は休憩1時間を引く */
function shiftPay(s){
  var mins = shiftMinutes(s) - shiftBreak(s) + (toNum(s.ot) || 0);
  var rate = (Number(s.rate) > 0) ? Number(s.rate) : minRate(s.date);
  var fare = mins > 0 ? (toNum(S.settings.fare) || 0) : 0;
  return Math.round(mins * rate) + fare;
}
/* 描いている間は、同じ一覧を何度も作らない（時間割などが軽くなる） */
function normItems(){ return rcache('norm', normItemsRaw); }
function normItemsRaw(){
  var out = [];
  S.tasks.forEach(function(t){
    out.push({ src:'task', id:t.id, date:t.due, title:t.title, sub:t.subject||'',
      time:t.time||'', colorRaw:taskColor(t), done:t.done, rid:t.rid, edit:1, photos:t.photos||[], plain:t.plain?1:0, mt:t.mt||0, subj:t.subject||'' });
  });
  S.exams.forEach(function(x){
    var k = (x.kind==='quiz'||x.kind==='kousa'||x.kind==='exam') ? x.kind : 'exam';
    out.push({ src:k, id:x.id, date:x.date, title:(x.subject||kindOf(k).name),
      sub:kindOf(k).name+(x.room?'・'+x.room:''), time:x.time||'',
      colorRaw:kindHex(k), rid:x.rid, edit:1, photos:x.photos||[], mt:x.mt||0, subj:x.subject||'' });
  });
  S.shifts.forEach(function(s){
    var h = shiftHours(s), ot = toNum(s.ot);
    out.push({ src:'work', id:s.id, date:s.date, title:'バイト',
      sub:(h?h+'時間'+(ot?'（残業'+ot+'分込み）':'')+(shiftPay(s)?'・'+yen(shiftPay(s)):''):'')+(s.memo?'　'+s.memo:''),
      time:s.start||'', colorRaw:kindHex('work'), rid:s.rid, edit:1, photos:s.photos||[], mt:s.mt||0 });
  });
  S.events.forEach(function(e){
    var end = (isYmd(e.dateEnd) && e.dateEnd > e.date) ? e.dateEnd : e.date;
    var k = eventKind(e.kind);
    out.push({ src:k, id:e.id, date:e.date, end:end, span:(end>e.date)?1:0,
      title:e.title, sub:(e.subject?e.subject+(e.memo?'・':''):'')+(e.memo||''), time:e.time||'',
      colorRaw:kindHex(k), rid:e.rid, edit:1, photos:e.photos||[], mt:e.mt||0, subj:e.subject||'' });
  });
  S.health.forEach(function(h){
    if(!isYmd(h.next)) return;
    out.push({ src:'health', id:h.id, date:h.next, title:h.name+'（期限）', sub:h.memo||'', time:'', colorRaw:colorOf('c5') });
  });
  return out;
}
function payItemsOn(ymd){
  var out = [], d = derive(), ym = ymd.slice(0,7), day = Number(ymd.slice(8,10));
  [['smbc',S.settings.smbcDay],['rakuten',S.settings.rakutenDay]].forEach(function(p){
    if(day !== Number(p[1])) return;
    var g = d.byMonth[ym] ? d.byMonth[ym][p[0]] : null;
    if(!g) return;
    var amt = g.plan + g.stmt;
    if(amt > 0) out.push({ src:'pay', id:p[0]+ym, date:ymd, title:ACCOUNTS[p[0]].bank+' 引き落とし',
      sub:yen(amt), time:'', colorRaw:DEEPGREEN });
  });
  return out;
}
function classItemsOn(ymd){
  if(!isYmd(ymd)) return [];
  var a = ymd.split('-'), dch = WDAY[new Date(+a[0], +a[1]-1, +a[2]).getDay()];
  return classesOn(dch).map(function(c){
    return { src:'cls', id:'cls'+ymd+c.period, date:ymd, title:c.name,
      sub:c.period+'限', time:S.commute.periods[c.period-1]||'', colorRaw:'var(--risyu)' };
  });
}
function matchQ(x){ return true; }
function coversDay(x, ymd){
  var e = x.end || x.date;
  return x.date <= ymd && ymd <= e;
}
function itemsOn(ymd, noPlain){
  var out = normItems().filter(function(x){
    if(noPlain && x.plain) return false;                 /* ToDoで足したものはカレンダーに出さない */
    /* 自分で作った種類は、はじめから見えるようにしておく */
    var on = (calFilter[x.src] === undefined) ? 1 : calFilter[x.src];
    return coversDay(x, ymd) && on && matchQ(x);
  });
  if(calFilter.pay) out = out.concat(payItemsOn(ymd).filter(matchQ));
  if(calFilter.cls) out = out.concat(classItemsOn(ymd).filter(matchQ));
  return out.sort(function(a,b){
    /* 期間の予定を先に並べると、帯が横につながって見える */
    if((b.span?1:0) !== (a.span?1:0)) return (b.span?1:0) - (a.span?1:0);
    /* 同じ時刻なら、追加した順（古いものが上） */
    if(a.span && b.span) return String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id));
    var ta = a.time || '99:99', tb = b.time || '99:99';
    if(ta !== tb) return ta.localeCompare(tb);
    return (Number(a.mt)||0) - (Number(b.mt)||0);   /* 同じ時刻なら追加した順 */
  });
}
/* その予定がどの科目のものか（課題・テスト・重要・その他・自分で作った種類） */
function subjectOfItem(x){
  if(!x || x.src === 'work' || x.src === 'pay' || x.src === 'cls' || x.src === 'health') return '';
  if(x.subj !== undefined) return x.subj || '';
  var f = findOne(x.src, x.id);
  return (f && f.obj) ? (f.obj.subject || '') : '';
}
function itemColor(x){ return x.colorRaw || kindHex(x.src); }
function itemFg(x){ var k=kindOf(x.src); return (x.src==='task'||x.src==='pay'||x.src==='cls'||x.src==='health') ? '#fff' : k.fg; }

/* ============================== 入力フォーム ============================== */
function newDraft(date){
  return { kind:'task', title:'', date:date||calSel, dateEnd:'', time:'', end:'', wage:'', ot:'',
           memo:'', rep:0, subject:'', photos:[], pri:1, how:'', how2:'', url:'', realEnd:'' };
}
function readEvForm(){
  if(!evDraft) return;
  var g = function(id){ var e=document.getElementById(id); return e ? e.value : null; };
  var v;
  if((v=g('ev_title'))!==null) evDraft.title = v;
  if(document.getElementById('ev_date_m')){
    var dd = readMd('ev_date');
    if(dd) evDraft.date = dd;
  }
  if(document.getElementById('ev_dateend_m')) evDraft.dateEnd = readMd('ev_dateend');
  var uv = g('ev_url'); if(uv !== null) evDraft.url = uv;
  var h2 = g('ev_how2'); if(h2 !== null) evDraft.how2 = h2;
  var tv = readTime('ev_time'); if(tv !== null) evDraft.time = tv;
  var ev_ = readTime('ev_end');  if(ev_ !== null) evDraft.end = ev_;
  var rv = readTime('ev_real');  if(rv !== null) evDraft.realEnd = rv;
  if((v=g('ev_wage'))!==null) evDraft.wage = v;
  if((v=g('ev_ot'))!==null) evDraft.ot = v;
  if((v=g('ev_memo'))!==null) evDraft.memo = v;
  if((v=g('ev_rep'))!==null) evDraft.rep = toNum(v);
  if((v=g('ev_subject'))!==null) evDraft.subject = v;
  saveDraft();
}
/* ===== 書きかけの予定を、この端末に取っておく =====
   画面が描き直されても、アプリを閉じても、打った字が消えないように。 */
var DRAFT_KEY = KEY + ':evdraft';
var __draftTimer = null;
function saveDraft(){
  clearTimeout(__draftTimer);
  __draftTimer = setTimeout(function(){
    try{
      if(calEdit || !evDraft) { localStorage.removeItem(DRAFT_KEY); return; }
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ d:evDraft, at:Date.now() }));
    }catch(e){}
  }, 250);
}
function clearDraft(){
  clearTimeout(__draftTimer);
  try{ localStorage.removeItem(DRAFT_KEY); }catch(e){}
}
function loadDraft(){
  try{
    var raw = localStorage.getItem(DRAFT_KEY);
    if(!raw) return null;
    var o = JSON.parse(raw);
    if(!o || !o.d) return null;
    /* 3日たった書きかけは捨てる */
    if(Date.now() - (Number(o.at)||0) > 3*24*3600*1000){ clearDraft(); return null; }
    /* 何も書いていないものは戻さない */
    var d = o.d;
    var hasText = String(d.title||'').trim() || String(d.memo||'').trim() ||
                  String(d.url||'').trim() || String(d.how2||'').trim() ||
                  String(d.subject||'').trim() || (d.photos||[]).length;
    return hasText ? d : null;
  }catch(e){ return null; }
}
function evForm(){ return '<div id="evform">'+evFormBody()+'</div>'; }
/* 入力欄だけ描き直す（画面が飛ばない） */
function redrawForm(){
  var fm = document.getElementById('evform');
  if(fm){ var y=window.scrollY; fm.innerHTML = evFormBody(); window.scrollTo(0,y); if(typeof twInit==='function') twInit(); }
  else render();
}
/* 時刻は数字で入力（時・分を直接打つ） */
function timeSelect(id, val_, label, allowEmpty){
  var has = /^\d{1,2}:\d{2}$/.test(val_||'');
  var hv = has ? String(+val_.split(':')[0]) : '';
  var mv = has ? val_.split(':')[1] : '';
  return '<label class="f">'+esc(label)+'</label>'+
    '<div class="timerow" id="'+id+'_row">'+
      '<input id="'+id+'_h" class="tnum" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="--" value="'+esc(hv)+'" data-tp="'+id+'">'+
      '<span class="tsep">：</span>'+
      '<input id="'+id+'_m" class="tnum" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="--" value="'+esc(mv)+'" data-tp="'+id+'">'+
      (allowEmpty ? '<button type="button" class="mini" data-act="tw-clear" data-id="'+id+'">消す</button>' : '')+
    '</div>';
}
function readTime(id){
  var h = document.getElementById(id+'_h'), m = document.getElementById(id+'_m');
  if(!h || !m) return null;
  var hs = String(h.value).replace(/[^0-9]/g,''), ms = String(m.value).replace(/[^0-9]/g,'');
  if(hs === '' && ms === '') return '';
  var hh = Math.max(0, Math.min(23, toNum(hs)));
  var mm = Math.max(0, Math.min(59, toNum(ms)));
  return pad(hh) + ':' + pad(mm);
}
function twInit(){}
function evFormBody(){
  if(!evDraft) evDraft = newDraft(calSel);
  var k = kindOf(evDraft.kind);
  var kd = evDraft.kind;
  var isWork = kd==='work', isTask = kd==='task', isTest = (kd==='quiz'||kd==='exam'||kd==='kousa'), isImp = kd==='imp';
  var editing = !!calEdit;

  var h = '';
  h += '<label class="f">種類</label><div class="kindrow">'+
    kindsAll().map(function(x){
      var on = kd===x.id;
      return '<button data-act="ev-kind" data-k="'+x.id+'" class="kbtn'+(on?' on':'')+'" style="--kc:'+x.hex+';--kf:'+x.fg+'">'+
        '<span class="kdot2"></span>'+x.name+'</button>';
    }).join('')+'</div>';

  /* 科目はバイト以外ぜんぶで選べる（その他・自分で作った種類もふくむ） */
  if(!isWork){
    h += '<div class="field"><label class="f">科目'+(isTest?'':'（任意）')+'</label><select id="ev_subject">'+subjectOptions(evDraft.subject)+'</select>'+
         (isTest ? '' : '<p class="note" style="margin:6px 0 0">科目を選ぶと、時間割タブのその科目のところにも出ます。</p>')+'</div>';
  }
  if(isWork){
    /* バイトは名前を聞かない。予定には「バイト」と出す */
  }else if(!isTest){
    h += '<div class="field"><label class="f">予定の名前（科目を選ぶだけでもOK）</label>'+
         '<input id="ev_title" value="'+esc(evDraft.title)+'" placeholder="'+(isTask?'例：看護過程レポート':isImp?'例：提出物の締切':'例：友達とごはん')+'"></div>';
  }else{
    h += '<div class="field"><label class="f">補足（任意）</label><input id="ev_title" value="'+esc(evDraft.title)+'" placeholder="例：第3回"></div>';
  }

  h += mdPicker('ev_date', evDraft.date, (isTask?'締切日':'日付'), false);

  if(isWork){
    /* 開始・終了・残業を1行ずつに分けて、重ならないようにする */
    h += timeSelect('ev_time', evDraft.time, '開始の時間', true);
    h += timeSelect('ev_end', evDraft.end, '終わりの時間', true);
    h += timeSelect('ev_real', evDraft.realEnd||'', '実際に終わった時間（ちがうときだけ）', true);
    (function(){
      var st = minutesOf(evDraft.time), en = minutesOf(evDraft.end), re = minutesOf(evDraft.realEnd);
      if(st == null || en == null) return;
      var base = en - st; if(base < 0) base += 1440;
      var real = (re != null) ? (re - st < 0 ? re - st + 1440 : re - st) : base;
      var diff = real - base;
      h += '<p class="note" style="margin:-4px 0 10px">予定は'+(Math.round(base/6)/10)+'時間。'+
        (re != null
          ? (diff === 0 ? '予定どおりです。'
             : diff > 0 ? '<b>'+diff+'分の残業</b>として計算します。'
             : '<b>'+(-diff)+'分早く上がった</b>として計算します。')
          : '空のままなら予定どおりで計算します。')+'</p>';
    })();
    h += '<p class="note" style="margin:-4px 0 10px">'+(isWeekend(evDraft.date)?'土日なので分給 ':'平日なので分給 ')+minRate(evDraft.date)+'円。7時間以上は休憩1時間を引き、交通費'+yen(toNum(S.settings.fare))+'を足します。</p>';
  }else{
    h += '<div class="field">'+timeSelect('ev_time', evDraft.time, (isTask?'締切の時刻（任意）':isTest?'開始時刻（任意）':'時刻（任意）'), true)+'</div>';
  }

  if(listNameOf(kd) === 'events'){
    h += mdPicker('ev_dateend', evDraft.dateEnd||'', '終了日（何日も続く予定のときだけ）', true);
  }

  if(isTask){
    h += '<label class="f">大事さ</label><div class="pillrow">'+
      [['2','高'],['1','ふつう'],['0','低']].map(function(o){
        return '<button data-act="ev-pri" data-v="'+o[0]+'" class="'+(String(toNum(evDraft.pri))===o[0]?'on':'')+'">'+o[1]+'</button>';
      }).join('')+'</div>';
    h += '<label class="f">出し方</label><div class="pillrow">'+
      [['form','Googleフォーム'],['classroom','クラスルーム'],['other','そのほか']].map(function(o){
        return '<button data-act="ev-how" data-v="'+o[0]+'" class="'+(evDraft.how===o[0]?'on':'')+'">'+o[1]+'</button>';
      }).join('')+'</div>'+
      (evDraft.how==='other'
        ? '<div class="field"><label class="f">出し方（自由に書く）</label><input id="ev_how2" value="'+esc(evDraft.how2||'')+'" placeholder="例：紙で提出、メール"></div>'
        : '');
    h += '<div class="field"><label class="f">提出先のURL（任意）</label><input id="ev_url" value="'+esc(evDraft.url||'')+'" placeholder="https://..."></div>';
  }
  h += '<div class="field"><label class="f">'+(isTest?'教室・メモ（任意）':'メモ（任意）')+'</label>'+
       '<textarea id="ev_memo" style="min-height:60px" placeholder="'+(isWork?'例：レジ担当':isTest?'例：A館301、持ち物：電卓':'例：持ち物メモ')+'">'+esc(evDraft.memo)+'</textarea></div>';

  var ph = (evDraft.photos||[]).map(function(id){
    return '<div class="mphoto"><img data-pid="'+id+'" alt="写真" data-act="memo-photo-view" data-id="'+id+'">'+
      '<button class="mini" data-act="ev-photo-del" data-pid="'+id+'">×</button></div>';
  }).join('');
  h += (ph ? '<div class="mphotos" style="margin-bottom:10px">'+ph+'</div>' : '')+
       '<button class="btn ghost" style="margin-bottom:11px" data-act="ev-photo">写真を足す</button>';

  if(!editing){
    h += '<div class="field"><label class="f">繰り返し</label><select id="ev_rep">'+
      [[0,'なし'],[4,'毎週 4回'],[8,'毎週 8回'],[12,'毎週 12回'],[15,'毎週 15回']].map(function(o){
        return '<option value="'+o[0]+'"'+(toNum(evDraft.rep)===o[0]?' selected':'')+'>'+o[1]+'</option>';
      }).join('')+'</select></div>';
  }
  var written = String(evDraft.title||'').trim() || String(evDraft.memo||'').trim() ||
                String(evDraft.url||'').trim() || String(evDraft.how2||'').trim() ||
                String(evDraft.subject||'').trim() || (evDraft.photos||[]).length;
  h += editing
    ? '<div class="pair"><button class="btn" data-act="ev-save">更新する</button><button class="btn ghost" style="flex:0 0 auto;padding:11px 16px" data-act="ev-cancel">やめる</button></div>'
    : '<button class="btn" data-act="ev-save">追加する</button>'+
      (written ? '<button class="btn ghost" style="margin-top:8px" data-act="ev-reset">ぜんぶ消してはじめから</button>'+
                 '<p class="note">打ったことは自動でとってあります。追加するまで消えません。</p>' : '');
  return h;
}
function shiftDate(ymd, days){
  var a = ymd.split('-');
  return toYmd(new Date(+a[0], +a[1]-1, +a[2] + days));
}
function createOne(kind, d, rid){
  var now = Date.now(), ph = (d.photos||[]).slice();
  if(kind==='task'){
    S.tasks.push({ id:uid('tk'), title:d.title, subject:d.subject||'', due:d.date, time:d.time||'',
      done:0, memo:d.memo||'', subs:[], photos:ph, rid:rid,
      pri:toNum(d.pri), how:d.how||'', how2:d.how2||'', url:d.url||'', mt:now });
  }else if(kind==='quiz'||kind==='exam'||kind==='kousa'){
    S.exams.push({ id:uid('ex'), subject:d.subject||'', title:d.title||'', date:d.date, time:d.time||'', room:d.memo||'',
      kind:kind, photos:ph, rid:rid, mt:now });
  }else if(kind==='work'){
    S.shifts.push({ id:uid('wk'), title:'バイト', date:d.date,
      start:d.time||'', end:d.end||'', realEnd:d.realEnd||'', ot:otFromReal(d), rate:0,
      memo:d.memo||'', photos:ph, rid:rid, mt:now });
  }else{
    S.events.push({ id:uid('ev'), date:d.date, dateEnd:(isYmd(d.dateEnd)&&d.dateEnd>d.date)?d.dateEnd:'',
      title:d.title, subject:d.subject||'', time:d.time||'',
      memo:d.memo||'', photos:ph, kind:eventKind(kind), rid:rid, mt:now });
  }
}
/* 自分で作った種類も、そのまま覚えておく（前のものは「その他」） */
function eventKind(k){
  if(k === 'imp') return 'imp';
  return kindsAll().some(function(x){ return x.id === k; }) ? k : 'other';
}
function listNameOf(src){
  return src==='task' ? 'tasks' : (src==='quiz'||src==='exam'||src==='kousa') ? 'exams' : src==='work' ? 'shifts' : 'events';
}
function findOne(src, id){
  var name = listNameOf(src), list = S[name];
  for(var i=0;i<list.length;i++) if(list[i].id===id) return { name:name, list:list, obj:list[i] };
  return null;
}
function srcOfKind(k){ return k; }
function updateOne(src, id, d){
  var newSrc = srcOfKind(d.kind);
  if(listNameOf(src) !== listNameOf(newSrc)){
    removeItem(listNameOf(src), id);
    createOne(d.kind, d, '');
    return;
  }
  var f = findOne(src, id); if(!f) return;
  var o = f.obj, ph = (d.photos||[]).slice();
  if(src==='task'){ o.title=d.title; o.subject=d.subject||''; o.due=d.date; o.time=d.time||''; o.memo=d.memo||''; o.photos=ph;
    o.pri=toNum(d.pri); o.how=d.how||''; o.how2=d.how2||''; o.url=d.url||''; }
  else if(listNameOf(src)==='exams'){ o.subject=d.subject||''; o.title=d.title||''; o.date=d.date; o.time=d.time||''; o.room=d.memo||''; o.kind=d.kind; o.photos=ph; }
  else if(src==='work'){ o.title='バイト'; o.date=d.date;
    o.start=d.time||''; o.end=d.end||''; o.realEnd=d.realEnd||''; o.ot=otFromReal(d); o.memo=d.memo||''; o.photos=ph; }
  else { o.date=d.date; o.dateEnd=(isYmd(d.dateEnd)&&d.dateEnd>d.date)?d.dateEnd:'';
         o.title=d.title; o.subject=d.subject||''; o.time=d.time||''; o.memo=d.memo||''; o.photos=ph; o.kind=eventKind(d.kind); }
  o.mt = Date.now();
}
function saveEvent(){
  readEvForm();
  var d = evDraft;
  var title = String(d.title||'').trim();
  var isTest = (d.kind==='quiz'||d.kind==='exam'||d.kind==='kousa');
  if(d.kind === 'work') title = 'バイト';
  if(isTest && !d.subject){ toast('科目を選んでください', true); return; }
  /* 名前が空でも、科目を選んでいればそれを名前にする */
  if(!title && d.subject) title = d.subject;
  if(!title && !isTest){ toast('予定の名前を入れるか、科目を選んでください', true); return; }
  if(!isYmd(d.date)){ toast('日付を選んでください', true); return; }
  d.title = title;

  if(calEdit){
    updateOne(calEdit.src, calEdit.id, d);
    toast('更新しました');
    calEdit = null; evDraft = newDraft(d.date);
  }else{
    var rep = Math.max(0, toNum(d.rep));
    var rid = rep > 1 ? uid('rp') : '';
    var n = rep > 1 ? rep : 1;
    for(var i=0;i<n;i++){
      createOne(d.kind, Object.assign({}, d, { date:shiftDate(d.date, i*7) }), rid);
    }
    toast(n>1 ? n+'件を追加しました' : '追加しました');
    evDraft = newDraft(d.date);
  }
  clearDraft();
  calSel = d.date; calYm = d.date.slice(0,7);
  if(appId==='cal' && calTab==='add'){ calTab='cal'; window.scrollTo(0,0); }
  commit();
}
function loadForEdit(src, id){
  var f = findOne(src, id); if(!f) return;
  var o = f.obj, base = { wage:'', ot:'', end:'', dateEnd:'', rep:0, subject:'', photos:(o.photos||[]).slice() };
  if(src==='task') evDraft = Object.assign(base, { kind:'task', title:o.title, subject:o.subject||'', date:o.due, time:o.time||'', memo:o.memo||'',
    pri:toNum(o.pri), how:o.how||'', how2:o.how2||'', url:o.url||'' });
  else if(listNameOf(src)==='exams') evDraft = Object.assign(base, { kind:(o.kind||'exam'), title:o.title||'', subject:o.subject||'', date:o.date, time:o.time||'', memo:o.room||'' });
  else if(src==='work') evDraft = Object.assign(base, { kind:'work', title:o.title||'', date:o.date, time:o.start||'', end:o.end||'',
    realEnd:o.realEnd||'', ot:(toNum(o.ot)?String(toNum(o.ot)):''), memo:o.memo||'' });
  else evDraft = Object.assign(base, { kind:eventKind(o.kind), title:o.title, subject:o.subject||'', date:o.date, dateEnd:o.dateEnd||'', time:o.time||'', memo:o.memo||'' });
  calEdit = { src:src, id:id };
  if(isYmd(evDraft.date)){ calSel = evDraft.date; calYm = evDraft.date.slice(0,7); }
}

/* ============================== カレンダー画面 ============================== */
function filterChips(){
  /* 自分で作った種類もならべる */
  var defs = kindsAll().map(function(k){ return [k.id, k.name]; })
    .concat([['health','健康'],['pay','引落'],['cls','授業']]);
  return '<div class="pillrow">'+defs.map(function(f){
    var on = (calFilter[f[0]] === undefined) ? 1 : calFilter[f[0]];
    var c = f[0]==='pay' ? DEEPGREEN : f[0]==='cls' ? 'var(--risyu)' : f[0]==='health' ? colorOf('c5') : kindHex(f[0]);
    var fg = (f[0]==='pay'||f[0]==='cls'||f[0]==='health') ? '#fff' : kindFg(f[0]);
    return '<button data-act="cal-filter" data-f="'+f[0]+'" class="'+(on?'on':'')+'"'+
      (on?' style="background:'+c+';border-color:'+c+';color:'+fg+'"':'')+'>'+esc(f[1])+'</button>';
  }).join('')+'</div>';
}
function timeLabelOf(x){
  if(x.src === 'work'){
    var w = S.shifts.filter(function(z){ return z.id === x.id; })[0];
    if(w && w.start && w.end) return w.start+'〜'+w.end+(toNum(w.ot)?'＋残業'+toNum(w.ot)+'分':'');
    if(w && w.start) return w.start+'〜';
    return '時間未設定';
  }
  if(x.src === 'task') return x.time ? x.time+' まで' : '締切（時間未設定）';
  if(x.src === 'quiz' || x.src === 'exam' || x.src === 'kousa') return x.time ? x.time+' 開始' : '時間未設定';
  if(x.span) return '終日（'+ymdLabel(x.date)+'〜'+ymdLabel(x.end)+'）';
  return x.time ? x.time+' 〜' : '終日';
}
function itemRow(x, withButtons, withDate){
  var isTask = (x.src === 'task');
  var isTest = (x.src==='quiz' || x.src==='exam' || x.src==='kousa');
  var showProg = isTest && S.ui.showProg !== 0;
  var dateTxt = '';
  if(withDate && isYmd(x.date)){
    var dl = daysFromToday(x.date);
    dateTxt = ymdLabel(x.date) + (dl===0 ? '（今日）' : dl===1 ? '（明日）' : dl>1 && dl<=14 ? '（あと'+dl+'日）' : '') + '・';
  }
  return '<div class="evrow'+(isTask&&x.done?' isdone':'')+'">'+
    '<span class="cbar" style="background:'+itemColor(x)+'"></span>'+
    (isTask ? '<button class="chk'+(x.done?' on':'')+'" data-act="'+(x.done?'task-undone':'task-done')+'" data-id="'+x.id+'" aria-label="終わった">'+(x.done?'✓':'')+'</button>' : '')+
    (showProg ? '<button class="progb" data-act="prog-step" data-id="'+x.id+'" title="'+esc(progLabel(x.id))+'">'+progIcon(x.id)+'</button>' : '')+
    '<span class="grow" '+(x.edit?'data-act="ev-open" data-src="'+x.src+'" data-id="'+x.id+'" role="button"':'')+'>'+
      '<span class="t">'+esc(x.title)+'</span>'+
      '<span class="s">'+esc(dateTxt)+esc(timeLabelOf(x))+
        (withDate ? '・'+esc(isTest ? (x.sub||kindOf(x.src).name) : kindOf(x.src).name)
                  : (x.sub?'・'+esc(x.sub):''))+
        (showProg?'・'+esc(progLabel(x.id)):'')+((x.photos||[]).length?'　📷'+x.photos.length:'')+'</span></span>'+
    (x.edit ? '<span class="s2">›</span>' : '')+'</div>';
}
function monthGrid(){
  var a = calYm.split('-'), y = +a[0], mo = +a[1];
  var first = new Date(y, mo-1, 1);
  var startDow = first.getDay();
  var td = today();

  /* 前後の月の日も薄く出して、マスを埋める */
  var cells = [];
  for(var i=startDow-1;i>=0;i--){
    var d0 = new Date(y, mo-1, -i);
    cells.push({ ymd:toYmd(d0), out:1 });
  }
  var lastDay = new Date(y, mo, 0).getDate();
  for(var dn=1;dn<=lastDay;dn++) cells.push({ ymd:y+'-'+pad(mo)+'-'+pad(dn), out:0 });
  var extra = 1;
  while(cells.length % 7 !== 0 || cells.length < 35){
    cells.push({ ymd:toYmd(new Date(y, mo, extra++)), out:1 });
  }

  var h = '<table class="cal" id="calgrid"><thead><tr>'+
    WDAY.map(function(w,i){ return '<th class="'+(i===0?'sun':i===6?'sat':'')+'">'+w+'</th>'; }).join('')+
    '</tr></thead><tbody>';

  for(var r=0;r<cells.length/7;r++){
    h += '<tr>';
    for(var c=0;c<7;c++){
      var cell = cells[r*7+c], ymd = cell.ymd;
      var its = itemsOn(ymd, 1);
      var hol = holidayName(ymd);
      var rev = (S.dayReview||{})[ymd];
      var dow = new Date(+ymd.slice(0,4), +ymd.slice(5,7)-1, +ymd.slice(8,10)).getDay();
      var cls = [];
      if(cell.out) cls.push('out');
      if(ymd === td) cls.push('today');
      if(ymd === calSel) cls.push('sel');
      if(hol) cls.push('holi');
      else if(dow === 0) cls.push('sunday');
      else if(dow === 6) cls.push('saturday');

      h += '<td class="'+cls.join(' ')+'"><div class="day" role="button" tabindex="0" data-act="cal-day" data-d="'+ymd+'">'+
        '<span class="dhead"><span class="dn">'+Number(ymd.slice(8,10))+'</span>'+
        (ymd === td && typeof charaLevel === 'function' && charaLevel() >= 5 ? '<span class="calch">'+charaSvg({ size:16, expr:'happy', hat:'', still:true })+'</span>' : '')+
        (rev && rev.grade ? '<span class="dgrade" style="--gc:'+(GRADE_COLOR[rev.grade]||'#999')+'">'+esc(rev.grade)+'</span>' : '')+
        (hol ? '<span class="holname">'+esc(hol)+'</span>' : '')+'</span>';

      if(its.length){
        h += '<span class="evs">';
        its.forEach(function(x){
          var col = itemColor(x), fg = itemFg(x);
          if(x.span){
            var isStart = x.date === ymd, isEnd = (x.end||x.date) === ymd;
            var label = (isStart || dow === 0) ? esc(x.title) : '&nbsp;';
            h += '<span class="ev band'+(isStart?' s':'')+(isEnd?' e':'')+'" style="--c:'+col+';color:'+fg+'" data-act="ev-open" data-src="'+x.src+'" data-id="'+x.id+'">'+label+'</span>';
          }else{
            h += '<span class="ev chip'+(x.done?' done':'')+'" style="background:'+col+';color:'+fg+'" data-act="ev-open" data-src="'+x.src+'" data-id="'+x.id+'">'+esc(x.title)+'</span>';
          }
        });
        h += '</span>';
      }
      h += '</div></td>';
    }
    h += '</tr>';
  }
  return h + '</tbody></table>';
}
var weekStyle = 'list';   /* list or time */
function weekList(){
  var start = weekMonday();
  var h = '';
  for(var i=0;i<7;i++){
    var d = new Date(start); d.setDate(start.getDate()+i);
    var ymd = toYmd(d), its = itemsOn(ymd, 1);
    var isToday = ymd === today();
    var hol = holidayName(ymd);
    var past2 = ymd < today();
    var manual2 = S.ui.weekClosed && (ymd in S.ui.weekClosed);
    var closed = manual2 ? !!S.ui.weekClosed[ymd] : past2;
    h += '<div class="box wbox'+(closed?' closed':'')+'" style="margin-bottom:8px'+(isToday?';outline:2px solid var(--accent);outline-offset:-2px':'')+'">'+
      '<div class="wdh" data-act="wday-toggle" data-d="'+ymd+'" role="button" style="margin-bottom:'+((its.length&&!closed)?'8px':'0')+'">'+
        '<span class="wdn" style="'+(d.getDay()===0||hol?'color:var(--holi)':d.getDay()===6?'color:var(--e6)':'')+'">'+
          (closed?'▸ ':'▾ ')+(d.getMonth()+1)+'/'+d.getDate()+'（'+WDAY[d.getDay()]+'）'+(isToday?' 今日':'')+'</span>'+
        '<span class="s2">'+(hol?esc(hol)+'　':'')+(its.length?its.length+'件':'予定なし')+'</span></div>'+
      (closed ? '' : (its.length ? its.map(function(x){ return itemRow(x, true); }).join('') : ''))+
      '</div>';
  }
  return h;
}
/* 同じ日で時間が重なっていないか調べる */
function clashOn(ymd){
  var list = itemsOn(ymd, 1).filter(function(x){ return minutesOf(x.time) != null; });
  /* 授業とも見比べる */
  schoolClassesForDate(ymd).forEach(function(c){
    var st = S.commute.periods[c.period-1], en = S.commute.ends[c.period-1];
    if(minutesOf(st)!=null) list.push({ src:'cls', id:'c'+c.period, title:c.name, time:st, endMin:minutesOf(en) });
  });
  var out = [];
  for(var i=0;i<list.length;i++){
    for(var j=i+1;j<list.length;j++){
      var a=list[i], b=list[j];
      var as=minutesOf(a.time), ae=(a.endMin!=null?a.endMin:as+60), bs=minutesOf(b.time), be=(b.endMin!=null?b.endMin:bs+60);
      if(a.src==='work'){ var w=S.shifts.filter(function(z){return z.id===a.id;})[0]; if(w) ae=as+shiftHours(w)*60; }
      if(b.src==='work'){ var w2=S.shifts.filter(function(z){return z.id===b.id;})[0]; if(w2) be=bs+shiftHours(w2)*60; }
      if(as < be && bs < ae) out.push(a.title+' と '+b.title);
    }
  }
  return out;
}
/* ToDo：やること・テスト・大事な予定を締切順に */
function todoList(){
  var td = today();
  var all = normItems().filter(function(x){
    if(!isYmd(x.date) || !calFilter[x.src] || !matchQ(x)) return false;
    if(x.src === 'task') return !x.done;
    return ['quiz','imp','health'].indexOf(x.src) >= 0 && (x.end||x.date) >= td;
  }).sort(function(a,b){ return a.date.localeCompare(b.date); });

  var late = all.filter(function(x){ return x.date < td; });
  var soon = all.filter(function(x){ return x.date >= td; });
  var rowOf = function(x){
    var n = daysFromToday(x.date);
    return '<div class="evrow"><span class="cbar" style="background:'+itemColor(x)+'"></span>'+
      (x.src==='task' ? '<button class="chk" data-act="task-done" data-id="'+x.id+'" aria-label="完了"></button>' : '')+
      '<span class="grow"><span class="t">'+esc(x.title)+'</span>'+
      '<span class="s">'+ymdLabel(x.date)+(x.sub?'・'+esc(x.sub):'')+'</span></span>'+
      '<span class="due '+dueClass(n)+'">'+dueText(n)+'</span>'+
      (x.edit?'<button class="mini" data-act="ev-edit" data-src="'+x.src+'" data-id="'+x.id+'">直す</button>':'')+'</div>';
  };
  var h = '';
  if(late.length) h += section('期限が過ぎているもの', late.length+'件', late.map(rowOf).join(''));
  h += section('やること・大事な予定', soon.length?soon.length+'件':null,
    soon.length ? soon.map(rowOf).join('')
      : '<div class="empty">'+ART.empty+'<div style="margin-top:8px">やることは片付いています。</div></div>');
  var doneTasks = S.tasks.filter(function(t){ return t.done; });
  if(doneTasks.length) h += section('終わったもの', doneTasks.length+'件',
    doneTasks.slice(-12).reverse().map(function(t){
      return '<div class="evrow"><span class="cbar" style="background:'+colorOf(t.color||'c2')+'"></span>'+
        '<button class="chk" style="background:var(--smbc);border-color:var(--smbc)" data-act="task-undone" data-id="'+t.id+'">✓</button>'+
        '<span class="grow"><span class="t" style="text-decoration:line-through;color:var(--sub)">'+esc(t.title)+'</span></span></div>';
    }).join(''));
  return h;
}
function monthSummary(){
  var ym = calYm;
  var items = normItems().filter(function(x){ return String(x.date).slice(0,7)===ym; });
  var n = function(src){ return items.filter(function(x){ return x.src===src; }).length; };
  var cell = function(kind, label){
    var k = kindOf(kind);
    return '<div class="stat"><div class="k"><span class="kdot" style="background:'+k.hex+'"></span>'+label+'</div>'+
      '<div class="v">'+n(kind)+'</div></div>';
  };
  return '<div class="grid3 keep3" style="margin-bottom:12px">'+
    cell('task','課題') + cell('quiz','小テスト') + cell('exam','大テスト') + '</div>';
}
var calWeekOff = 0;
function calMonthOff(){
  var a = thisYm().split('-'), b = calYm.split('-');
  return (+b[0]*12 + +b[1]) - (+a[0]*12 + +a[1]);
}
function viewCalendar(){
  var a = calYm.split('-');
  var isWeek = (calTab === 'week');
  var h = '<div class="calbar"><div class="pillrow" style="margin:0">'+
    (isWeek
      ? '<button class="mini" data-act="cw-off" data-v="-1">‹ 先週</button>'+
        '<button data-act="cw-set" data-v="-1" class="'+(calWeekOff===-1?'on':'')+'">先週</button>'+
        '<button data-act="cw-set" data-v="0" class="'+(calWeekOff===0?'on':'')+'">今週</button>'+
        '<button data-act="cw-set" data-v="1" class="'+(calWeekOff===1?'on':'')+'">翌週</button>'+
        '<button class="mini" data-act="cw-off" data-v="1">次週 ›</button>'
      : '<button class="mini" data-act="cal-prev">‹</button>'+
        '<button data-act="cal-mset" data-v="-1" class="'+(calMonthOff()===-1?'on':'')+'">先月</button>'+
        '<button data-act="cal-mset" data-v="0" class="'+(calMonthOff()===0?'on':'')+'">今月</button>'+
        '<button data-act="cal-mset" data-v="1" class="'+(calMonthOff()===1?'on':'')+'">翌月</button>'+
        '<button class="mini" data-act="cal-next">›</button>')+
    '<span class="s2" style="margin-left:auto">'+(isWeek ? weekRangeLabel() : (+a[0])+'年'+(+a[1])+'月')+'</span>'+
    '</div></div>';

  var parts = {};
  parts.summary = function(){ return isWeek ? '' : monthSummary(); };
  parts.grid = function(){
    if(!isWeek){
      return monthGrid() +
        '<button class="calfab" data-act="cal-add" title="この日に予定を足す">'+
          '<span class="pl">＋</span><span class="dd">'+Number(calSel.slice(8,10))+'日</span></button>';
    }
    return weekList();
  };
  parts.selday = function(){
    var sel = itemsOn(calSel, 1);
    return '<div style="margin-top:16px">' + section(ymdLabel(calSel)+' の予定', sel.length?sel.length+'件':null,
      (clashOn(calSel).length ? '<div class="msg ng">時間が重なっています：'+esc(clashOn(calSel).join('／'))+'</div>' : '')+
      (sel.length ? sel.map(function(x){ return itemRow(x, true); }).join('')
                  : '<div class="empty">この日の予定はありません。</div>')+
      '<button class="btn" style="margin-top:12px" data-act="cal-addopen" data-d="'+calSel+'">この日に予定を追加</button>') + '</div>';
  };
  parts.ics = function(){
    if(!gasReady()){
      return '<button class="btn ghost" style="margin-top:14px" data-act="go-gas">Googleカレンダーとつなぐ</button>'+
        '<p class="note" style="margin-top:6px">つなぐと、予定・課題・テスト・バイト・引き落としが Googleカレンダーに自動で入ります（通知は前日の0時）。</p>';
    }
    var c = S.cloud.cal || {};
    return '<button class="btn ghost" style="margin-top:14px" data-act="gas-cal-now">Googleカレンダーに今すぐ送る</button>'+
      '<p class="note" style="margin-top:6px">'+(GAS.cal ? '自動で送っています。' : '自動送信はオフです。')+
      (c.at ? '最後に送ったのは'+agoText(c.at)+'。' : '')+'通知は前日の0時です。</p>';
  };
  pageOrder('cal').forEach(function(id){ if(parts[id] && !pageHidden('cal', id)) h += parts[id](); });
  return '<section>'+h+'</section>';
}
function weekMonday(){
  var now = new Date(), dow = now.getDay();
  var mon = new Date(now); mon.setDate(now.getDate() - ((dow+6)%7) + calWeekOff*7);
  return mon;
}
function weekRangeLabel(){
  var mon = weekMonday(), sun = new Date(mon); sun.setDate(mon.getDate()+6);
  var lbl = calWeekOff===0?'今週':calWeekOff===1?'次週':calWeekOff===-1?'先週':(calWeekOff>0?calWeekOff+'週あと':(-calWeekOff)+'週前');
  return lbl+'　'+(mon.getMonth()+1)+'/'+mon.getDate()+'〜'+(sun.getMonth()+1)+'/'+sun.getDate();
}
/* 種類別：今月/来月の、選んだ種類の予定だけ */
var kindPick = 'task', kindMonthOff = 0, kindMode = 'kind', subjPick = '';
function viewKindTab(){
  var ym = addMonths(thisYm(), kindMonthOff);
  var a = ym.split('-');
  var h = '<div class="calbar"><div class="pillrow" style="margin:0">'+
    '<button class="mini" data-act="km-off" data-v="-1">‹ 前</button>'+
    '<button data-act="km-set" data-v="0" class="'+(kindMonthOff===0?'on':'')+'">今月</button>'+
    '<button data-act="km-set" data-v="1" class="'+(kindMonthOff===1?'on':'')+'">来月</button>'+
    '<button class="mini" data-act="km-off" data-v="1">次 ›</button>'+
    '<span class="s2" style="margin-left:auto">'+(+a[0])+'年'+(+a[1])+'月</span></div></div>';
  var parts = {};
  parts.picker = function(){
    var head = '<div class="pillrow" style="margin-top:12px">'+
      '<button data-act="kind-mode" data-v="kind" class="'+(kindMode==='kind'?'on':'')+'">種類で見る</button>'+
      '<button data-act="kind-mode" data-v="subj" class="'+(kindMode==='subj'?'on':'')+'">科目で見る</button>'+
    '</div>';
    if(kindMode === 'subj'){
      /* 曜日・時限の順に並べる */
      var subs = termCourses().slice().sort(function(a,b){
        var sa = (a.slots||[])[0] || {}, sb = (b.slots||[])[0] || {};
        var da = DAYS.indexOf(sa.d), db = DAYS.indexOf(sb.d);
        if(da !== db) return (da<0?9:da) - (db<0?9:db);
        return toNum(sa.p) - toNum(sb.p);
      });
      return head + '<div class="kindrow" style="margin-top:10px">'+
        '<button data-act="subj-pick" data-s="" class="kbtn'+(!subjPick?' on':'')+'" style="--kc:var(--sub);--kf:#fff"><span class="kdot2"></span>ぜんぶ</button>'+
        subs.map(function(c){
          var on = subjPick===c.name;
          var sl = (c.slots||[])[0] || {};
          var tag = sl.d ? sl.d+sl.p : '';
          return '<button data-act="subj-pick" data-s="'+esc(c.name)+'" class="kbtn'+(on?' on':'')+'" style="--kc:'+courseColor(c.name)+';--kf:#fff">'+
            '<span class="kdot2"></span>'+(tag?'<span class="ksl">'+esc(tag)+'</span>':'')+esc(shortName(c.name))+'</button>';
        }).join('')+'</div>';
    }
    return head + '<div class="kindrow" style="margin-top:10px">'+kindsAll().map(function(k){
      var on = kindPick===k.id;
      return '<button data-act="kind-pick" data-k="'+k.id+'" class="kbtn'+(on?' on':'')+'" style="--kc:'+k.hex+';--kf:'+k.fg+'">'+
        '<span class="kdot2"></span>'+k.name+'</button>';
    }).join('')+'</div>';
  };
  parts.list = function(){
    var list, ttl;
    if(kindMode === 'subj'){
      list = normItems().filter(function(x){
        if(!isYmd(x.date) || x.date.slice(0,7)!==ym) return false;
        if(x.plain) return false;
        var sub = subjectOfItem(x);
        return subjPick ? sameSubject(sub, subjPick) : !!sub;
      });
      ttl = (subjPick ? shortName(subjPick) : 'ぜんぶの科目')+'の予定';
    }else{
      list = normItems().filter(function(x){
        return x.src===kindPick && isYmd(x.date) && x.date.slice(0,7)===ym;
      });
      ttl = kindOf(kindPick).name+'の予定';
    }
    list = list.sort(function(x,y){ return x.date.localeCompare(y.date) || String(x.time).localeCompare(String(y.time)); });
    /* 曜日ごとにまとめる */
    if(list.length){
      var byDow = [[],[],[],[],[],[],[]];
      list.forEach(function(x){
        var a3 = x.date.split('-');
        byDow[new Date(+a3[0], +a3[1]-1, +a3[2]).getDay()].push(x);
      });
      var order = [1,2,3,4,5,6,0];   /* 月から順に */
      return section(ttl, list.length+'件',
        order.map(function(d){
          if(!byDow[d].length) return '';
          return '<div class="dowgrp"><div class="dowhd">'+WDAY[d]+'曜日　'+byDow[d].length+'件</div>'+
            byDow[d].map(function(x){ return itemRow(x, true); }).join('')+'</div>';
        }).join(''));
    }
    return section(ttl, null,
      list.length ? list.map(function(x){ return itemRow(x, true); }).join('')
        : '<div class="empty">'+ART.empty+'<div style="margin-top:8px">この月に予定はありません。</div></div>');
  };
  pageOrder('kind').forEach(function(id){ if(parts[id] && !pageHidden('kind', id)) h += parts[id](); });
  return '<section>'+h+'</section>';
}
/* 予定を追加する画面（今日の予定とは分けた） */
function viewCalAdd(){
  if(!evDraft) evDraft = newDraft(calSel);
  var title = calEdit ? '予定を直す' : '予定を追加';
  return '<section>'+
    '<div class="head"><h2>'+title+'</h2><span>'+ymdLabel(evDraft.date||calSel)+'</span></div>'+
    '<div class="box" id="evform">'+ evFormBody() +'</div>'+
    '</section>';
}

/* ============================== 予定の詳細 ============================== */
function openDetail(src, id){
  var x = normItems().filter(function(z){ return z.src===src && z.id===id; })[0];
  if(!x) return;
  var f = findOne(src, id); var o = f ? f.obj : {};
  var k = kindOf(src);
  var photos = (x.photos||[]).map(function(pid){
    var src2=null;
    return '<img data-pid="'+pid+'" alt="写真" data-act="memo-photo-view" data-id="'+pid+'" style="width:100%;border-radius:12px;margin-top:8px">';
  }).join('');
  var body = '<div class="dt-head" style="background:'+itemColor(x)+';color:'+itemFg(x)+'">'+
      '<div class="s2" style="color:inherit;opacity:.85">'+esc(k.name)+(x.sub&&src!=='task'?'':'')+'</div>'+
      '<div class="dt-title">'+esc(x.title)+'</div>'+
      '<div class="s2" style="color:inherit;opacity:.9">'+esc(timeLabelOf(x))+'　'+ymdLabel(x.date)+(x.span?' 〜 '+ymdLabel(x.end):'')+'</div></div>'+
    '<div class="box" style="margin-top:12px">'+
      (o.subject ? '<div class="row"><div class="grow s">科目</div><div class="t">'+esc(o.subject)+'</div></div>' : '')+
      (src==='work' ? '<div class="row"><div class="grow s">お給料</div><div class="amt num">'+yen(shiftPay(o))+'</div></div>'+
                      '<div class="row"><div class="grow s">勤務</div><div class="t">'+esc(o.start||'')+'〜'+esc(o.end||'')+(shiftBreak(o)?'（休憩1時間引き）':'')+(toNum(o.ot)?'・残業'+toNum(o.ot)+'分':'')+'</div></div>' : '')+
      (src==='task' && o.url ? '<div class="row"><div class="grow s">提出先</div><a class="mini" href="'+esc(o.url)+'" target="_blank" rel="noopener">開く</a></div>' : '')+
      (src==='task' && (o.how||toNum(o.pri)!==1) ? '<div class="row"><div class="grow s">出し方・大事さ</div><div class="t">'+
        esc(({form:'Googleフォーム',classroom:'クラスルーム',other:(o.how2||'そのほか')})[o.how]||'—')+'・'+esc(['低','ふつう','高'][toNum(o.pri)]||'ふつう')+'</div></div>' : '')+
      (src==='task' ? '<div class="row"><div class="grow s">かかった時間</div><div class="t">'+(taskMinutes(o.id)||0)+'分</div>'+
        '<button class="mini" data-act="task-timer" data-id="'+o.id+'" style="'+(taskRunning(o.id)?'background:linear-gradient(180deg,var(--accent2),var(--accent));color:#fff;border-color:rgba(255,255,255,.6)':'')+'">'+(taskRunning(o.id)?'とめる':'はかる')+'</button></div>' : '')+
      (src==='task' ? '<div class="row"><div class="grow s">状態</div><div class="t">'+(o.done?'完了':'未完')+'</div>'+
                      '<button class="mini" data-act="'+(o.done?'task-undone':'task-done')+'" data-id="'+o.id+'">'+(o.done?'未完に戻す':'完了にする')+'</button></div>' : '')+
      ((o.memo||o.room) ? '<div class="row"><div class="grow"><div class="s">メモ</div><div class="t" style="white-space:pre-wrap">'+esc(o.memo||o.room)+'</div></div></div>' : '')+
      ((o.subs||[]).length ? '<div class="row"><div class="grow"><div class="s">小項目</div>'+(o.subs||[]).map(function(sb,i){
          return '<label class="sub"><input type="checkbox" data-act="sub-toggle" data-id="'+o.id+'" data-i="'+i+'"'+(sb.done?' checked':'')+'><span>'+esc(sb.text)+'</span></label>'; }).join('')+'</div></div>' : '')+
      photos+
      '<div class="pair" style="margin-top:12px">'+
        '<button class="btn" data-act="ev-edit-from-detail" data-src="'+src+'" data-id="'+id+'">直す</button>'+
        '<button class="btn ghost" data-act="ev-del-from-detail" data-src="'+src+'" data-id="'+id+'" style="color:var(--rakuten)">削除</button></div>'+
    '</div>';
  var sh = document.getElementById('detail');
  sh.querySelector('.sheet-bd').innerHTML = body;
  document.getElementById('veil').classList.add('on');
  sh.classList.add('on');
}
function closeDetail(){
  var sh = document.getElementById('detail');
  if(sh) sh.classList.remove('on');
  if(!sheetOpen()) document.getElementById('veil').classList.remove('on');
}

/* ============================== 重要 ============================== */
function viewImportant(){
  var td = today();
  var list = S.events.filter(function(e){ return e.kind==='imp'; })
    .sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
  var future = list.filter(function(e){ return String(e.date) >= td; });
  var past = list.filter(function(e){ return String(e.date) < td; });
  var rowOf = function(e){
    var n = isYmd(e.date) ? daysFromToday(e.date) : null;
    return '<div class="evrow" data-act="ev-open" data-src="imp" data-id="'+e.id+'" role="button"><span class="cbar" style="background:'+kindHex('imp')+'"></span>'+
      '<span class="grow"><span class="t">'+esc(e.title)+'</span>'+
      '<span class="s">'+ymdLabel(e.date)+(e.time?' '+esc(e.time):'')+(e.subject?'・'+esc(e.subject):'')+(e.memo?'・'+esc(e.memo):'')+'</span></span>'+
      (n!==null?'<span class="due '+dueClass(n)+'">'+(n<0?'済':dueText(n))+'</span>':'')+'<span class="s2">›</span></div>';
  };
  return section('大事な予定', future.length?future.length+'件':null,
      future.length ? future.map(rowOf).join('')
        : '<div class="empty">'+ART.empty+'<div style="margin-top:8px">カレンダーで種類を「重要」にすると、ここに集まります。</div></div>')
    + (past.length ? section('過ぎたもの', past.length+'件', past.slice(-15).reverse().map(rowOf).join('')) : '')
    + '<button class="btn ghost" data-act="go" data-app="cal" data-tab="cal">カレンダーで追加する</button>';
}

/* ============================== 健康 ============================== */
function viewHealth(){
  var list = S.health.slice().sort(function(a,b){ return String(a.next||'9999').localeCompare(String(b.next||'9999')); });
  return section('予防接種・健康診断の記録', list.length?list.length+'件':null,
    (list.length ? list.map(function(h){
      var n = isYmd(h.next) ? daysFromToday(h.next) : null;
      return '<div class="row"><div class="tick" style="background:'+colorOf('c5')+'"></div>'+
        '<div class="grow"><div class="t">'+esc(h.name)+'</div>'+
        '<div class="s">'+(isYmd(h.date)?'受けた日 '+ymdLabel(h.date):'日付未登録')+
        (isYmd(h.next)?'　次回 '+ymdLabel(h.next):'')+(h.memo?'　'+esc(h.memo):'')+'</div></div>'+
        (n!==null ? '<span class="due '+dueClass(n)+'">'+(n<0?'期限切れ':dueText(n))+'</span>' : '')+
        '<button class="mini" data-act="del-health" data-id="'+h.id+'">削除</button></div>';
    }).join('') : '<div class="empty">'+ART.empty+'<div style="margin-top:8px">まだ登録がありません。</div></div>')+
    '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--rule)">'+
    '<div class="field"><label class="f">項目名</label><input id="hl_name" placeholder="例：健康診断"></div>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">受けた日</label><input type="date" id="hl_date"></div>'+
      '<div><label class="f">次回の期限</label><input type="date" id="hl_next"></div></div>'+
    '<div class="field"><label class="f">メモ（任意）</label><input id="hl_memo" placeholder="例：実習前に提出"></div>'+
    '<button class="btn" data-act="add-health">追加する</button></div>')
  + '<p class="note">次回の期限を入れておくと、30日前から「今日」の画面に出てきます。カレンダーにも表示されます。</p>';
}

/* ============================== 操作 ============================== */
function calAction(act, t){
  if(act==='cal-prev'){ readEvForm(); calYm = addMonths(calYm, -1); render(); return true; }
  if(act==='cal-next'){ readEvForm(); calYm = addMonths(calYm, 1); render(); return true; }
  if(act==='cal-today'){
    readEvForm(); calYm = thisYm(); calSel = today();
    if(evDraft && !calEdit) evDraft.date = calSel;
    render(); return true;
  }
  if(act==='cal-day'){
    readEvForm();
    calSel = t.dataset.d; calYm = calSel.slice(0,7);
    if(evDraft && !calEdit) evDraft.date = calSel;
    render(); return true;
  }
  if(act==='cal-mode'){ readEvForm(); calTab = t.dataset.v; calView = (t.dataset.v==='week')?'week':'month'; render(); window.scrollTo(0,0); return true; }
  if(act==='wstyle'){ weekStyle = t.dataset.v; render(); return true; }
  if(act==='cw-off'){ calWeekOff += toNum(t.dataset.v); render(); return true; }
  if(act==='cal-mset'){ calYm = addMonths(thisYm(), toNum(t.dataset.v)); render(); return true; }
  if(act==='cw-set'){ calWeekOff = toNum(t.dataset.v); render(); return true; }
  if(act==='km-off'){ kindMonthOff += toNum(t.dataset.v); render(); return true; }
  if(act==='km-set'){ kindMonthOff = toNum(t.dataset.v); render(); return true; }
  if(act==='kind-pick'){
    kindPick = t.dataset.k;
    render();
    setTimeout(function(){
      var secs2 = [].slice.call(document.querySelectorAll('#app section'));
      var el2 = secs2.filter(function(x){ return /の予定/.test((x.querySelector('h2')||{}).textContent || ''); })[0];
      if(el2) el2.scrollIntoView({ block:'start', behavior:'smooth' });
    }, 60);
    return true;
  }
  if(act==='kind-mode'){ kindMode = t.dataset.v; render(); return true; }
  if(act==='subj-pick'){
    subjPick = t.dataset.s || '';
    render();
    /* 選んだら、予定の一覧まで自動でおりる */
    setTimeout(function(){
      var secs = [].slice.call(document.querySelectorAll('#app section'));
      var el = secs.filter(function(x){ return /の予定|ぜんぶの科目/.test((x.querySelector('h2')||{}).textContent || ''); })[0];
      if(el) el.scrollIntoView({ block:'start', behavior:'smooth' });
    }, 60);
    return true;
  }
  if(act==='cal-view'){ readEvForm(); calView = t.dataset.v; render(); return true; }
  if(act==='cal-filter'){
    readEvForm();
    var f = t.dataset.f;
    var cur = (calFilter[f] === undefined) ? 1 : calFilter[f];
    calFilter[f] = cur ? 0 : 1; render(); return true;
  }
  if(act==='ev-kind'){
    readEvForm();
    evDraft.kind = t.dataset.k;
    redrawForm();
    return true;
  }

  if(act==='ev-move'){
    var f3 = findOne(t.dataset.src, t.dataset.id);
    if(!f3) return true;
    var o3 = f3.obj, n3 = toNum(t.dataset.n);
    var key = (t.dataset.src==='task') ? 'due' : 'date';
    if(!isYmd(o3[key])) { toast('日付が入っていません', true); return true; }
    o3[key] = shiftDate(o3[key], n3);
    if(o3.dateEnd && isYmd(o3.dateEnd)) o3.dateEnd = shiftDate(o3.dateEnd, n3);
    o3.mt = Date.now();
    calSel = o3[key]; calYm = calSel.slice(0,7);   /* 動かした先を表示する */
    toast(ymdLabel(o3[key])+'にずらしました'); commit(); return true;
  }
  if(act==='ev-photo'){ readEvForm(); memoTarget = 'draft'; var inp=document.getElementById('memoimg'); if(inp) inp.click(); return true; }
  if(act==='ev-photo-del'){
    readEvForm();
    evDraft.photos = (evDraft.photos||[]).filter(function(x){ return x!==t.dataset.pid; });
    var fm2 = document.getElementById('evform');
    if(fm2){ var y2=window.scrollY; fm2.innerHTML = evFormBody(); window.scrollTo(0,y2); } else render();
    return true;
  }
  if(act==='ev-open'){ openDetail(t.dataset.src, t.dataset.id); return true; }
  if(act==='ev-close'){ closeDetail(); return true; }
  if(act==='ev-edit-from-detail'){
    closeDetail(); readEvForm(); loadForEdit(t.dataset.src, t.dataset.id);
    appId='cal'; calTab='add'; render(); window.scrollTo(0,0); return true;
  }
  if(act==='ev-del-from-detail'){
    closeDetail();
    removeWithUndo(listNameOf(t.dataset.src), t.dataset.id, '削除しました'); commit(); return true;
  }
  if(act==='cal-addopen'){
    calEdit = null; evDraft = newDraft(t.dataset.d || calSel);
    appId='cal'; calTab='add'; render(); window.scrollTo(0,0); return true;
  }
  if(act==='ot-step'){
    readEvForm();
    evDraft.ot = String(toNum(evDraft.ot) + toNum(t.dataset.n));
    var inp = document.getElementById('ev_ot');
    if(inp) inp.value = evDraft.ot; else render();
    return true;
  }
  if(act==='prog-step'){
    var max = progScale().length - 1;
    setProg(t.dataset.id, (progOf(t.dataset.id) + 1) > max ? 0 : progOf(t.dataset.id) + 1);
    commit(); return true;
  }
  if(act==='ev-pri'){ readEvForm(); evDraft.pri = toNum(t.dataset.v); redrawForm(); return true; }
  if(act==='ev-how'){ readEvForm(); evDraft.how = (evDraft.how===t.dataset.v ? '' : t.dataset.v); redrawForm(); return true; }
  if(act==='tw-clear'){
    var wid = t.dataset.id;
    ['h','m'].forEach(function(w){ var i=document.getElementById(wid+'_'+w); if(i) i.value=''; });
    return true;
  }
  if(act==='ev-reset'){
    if(!confirm('書いたことをぜんぶ消しますか？')) return true;
    var kd0 = evDraft ? evDraft.kind : defaultKind();
    calEdit = null; evDraft = newDraft(calSel); evDraft.kind = kd0;
    clearDraft(); redrawForm(); toast('消しました'); return true;
  }
  if(act==='ev-save'){ saveEvent(); return true; }
  if(act==='ev-cancel'){ calEdit = null; evDraft = newDraft(calSel); clearDraft(); if(calTab==='add') calTab='cal'; render(); window.scrollTo(0,0); return true; }
  if(act==='ev-edit'){
    readEvForm();
    loadForEdit(t.dataset.src, t.dataset.id);
    appId='cal'; calTab='add';
    render(); window.scrollTo(0,0);
    return true;
  }
  if(act==='ev-del'){
    var src = t.dataset.src, id = t.dataset.id;
    var f2 = findOne(src, id);
    if(f2 && f2.obj.rid){
      var group = f2.list.filter(function(x){ return x.rid === f2.obj.rid; });
      if(group.length > 1 && confirm('この繰り返しは'+group.length+'件あります。まとめて削除しますか？\n「キャンセル」ならこの1件だけ消します。')){
        group.slice().forEach(function(x){ removeItem(listNameOf(src), x.id); });
        if(calEdit && calEdit.src===src){ calEdit=null; evDraft=newDraft(calSel); }
        toast(group.length+'件を削除しました'); commit(); return true;
      }
    }
    removeWithUndo(listNameOf(src), id, '削除しました');
    if(calEdit && calEdit.id===id){ calEdit=null; evDraft=newDraft(calSel); }
    commit(); return true;
  }
  if(act==='memo-save'){
    var k = t.dataset.k;
    var cur = memoOf(k);
    S.memos[k] = { text: val('memo_'+k), mt: Date.now(), photos: cur.photos || [] };
    touch('memos'); toast('メモを保存しました'); commit(); return true;
  }
  if(act==='memo-photo'){
    memoTarget = t.dataset.k;
    var inp = document.getElementById('memoimg');
    if(inp) inp.click();
    return true;
  }
  if(act==='memo-photo-del'){
    var k2 = t.dataset.k, id2 = t.dataset.id;
    var m2 = memoOf(k2);
    m2.photos = (m2.photos||[]).filter(function(x){ return x !== id2; });
    m2.mt = Date.now(); S.memos[k2] = m2;
    photoDel(id2);
    touch('memos'); toast('写真を外しました'); commit(); return true;
  }
  if(act==='memo-photo-view'){
    var src = null;
    photoGet(t.dataset.id).then(function(s2){
      if(!s2) return;
      var v = document.getElementById('viewer');
      if(v){ v.querySelector('img').src = s2; v.classList.add('on'); }
    });
    return true;
    /* 以下は使わない */
    try{ src = null; }catch(e){}
    if(!src){ toast('この端末に写真がありません'); return true; }
    var box = el('<div id="lightbox"><img src="'+src+'" alt="メモの写真"></div>');
    box.addEventListener('click', function(){ box.remove(); });
    document.body.appendChild(box);
    return true;
  }
  if(act==='add-health'){
    var n = val('hl_name').trim();
    if(!n){ toast('項目名を入れてください', true); return true; }
    S.health.push({ id:uid('hl'), name:n, date:val('hl_date'), next:val('hl_next'), memo:val('hl_memo'), mt:Date.now() });
    toast('追加しました'); commit(); return true;
  }
  if(act==='del-health'){ removeWithUndo('health', t.dataset.id, '削除しました'); commit(); return true; }
  return false;
}


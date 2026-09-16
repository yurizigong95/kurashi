/* くらしの手帳：時間割・授業 */
/* ============================== 時間割 ============================== */
var ttShowAll = false;
var ttWeek = null;
var courseTemp = false;   /* 授業タブを一時的に開いているか */
var courseFrom = '';      /* 授業の詳細を、どのタブから開いたか */   /* null=自動（土日は来週）、0=今週、1=来週、-1=先週 */     /* 他の学期を表示するか */
var courseView = '';       /* 授業タブで開いている科目名 */

function shortName(name){
  var a = courseAlias(name);
  return a || name;
}
function openTasksOf(name){
  return S.tasks.filter(function(t){ return !t.done && sameSubject(t.subject, name); });
}
/* 科目を選んで足した予定は、種類がなんであれ「その科目の予定」として扱う
   （課題・小テスト・大テスト・考査・重要・その他・自分で作った種類ぜんぶ）  */
function isSubjectSrc(src){
  return src !== 'work' && src !== 'pay' && src !== 'cls' && src !== 'health';
}
/* 科目ごとに予定を分けておく（時間割のマスごとに全部を見直さない） */
function subjectIndex(){
  return rcache('subjIdx', function(){
    var idx = {};
    normItems().forEach(function(x){
      if(!isSubjectSrc(x.src)) return;
      var s = subjectOfItem(x);
      if(!s) return;
      var k = subjKey(s) || s;
      (idx[k] = idx[k] || []).push(x);
    });
    return idx;
  });
}
function itemsOfSubject(name){
  if(!name) return [];
  return subjectIndex()[subjKey(name) || name] || [];
}
/* その科目の予定を、ぜんぶ集める（日付は問わない） */
function itemsForCourse(name){
  return itemsOfSubject(name).slice().sort(function(a,b){
    return String(a.date).localeCompare(String(b.date)) || String(a.time||'').localeCompare(String(b.time||''));
  });
}
/* その科目・その日に登録された予定 */
function itemsForCourseOn(name, ymd){
  /* 何日も続く予定も、その日にかかっていれば出す */
  return itemsOfSubject(name).filter(function(x){ return coversDay(x, ymd); });
}
function viewTT(){
  var t = curTerm();
  var td = today();
  var map = {};
  termCourses().forEach(function(c){ c.slots.forEach(function(sl){ map[sl.d+sl.p] = c; }); });

  /* 今週の月曜〜金曜の日付（休講・隔週の判定用）。いつでも「今週」から始める */
  var now = new Date(), dow = now.getDay();
  var mon = new Date(now); mon.setDate(now.getDate() - ((dow+6)%7));
  var wk = (ttWeek === null) ? 0 : ttWeek;
  mon.setDate(mon.getDate() + wk*7);
  var weekLabel = wk===0 ? '今週' : wk===1 ? '来週' : wk===-1 ? '先週' : (wk>0? wk+'週あと' : (-wk)+'週前');
  var dates = {};
  DAYS.forEach(function(d,i){ var x=new Date(mon); x.setDate(mon.getDate()+i); dates[d]=toYmd(x); });
  var todayCol = DAYS.filter(function(d){ return dates[d] === td; })[0] || '';

  var h = '<div class="head"><h2>'+esc(t.label)+'</h2>'+
    '<span><button class="mini" data-act="tt-terms">学期切替</button></span></div>';
  h += '<div class="pillrow" style="align-items:center">'+
    '<button class="mini" data-act="tt-week" data-v="-1">‹ 先週</button>'+
    [[-1,'先週'],[0,'今週'],[1,'来週']].map(function(o){
      return '<button data-act="tt-weekset" data-v="'+o[0]+'" class="'+(wk===o[0]?'on':'')+'">'+o[1]+'</button>';
    }).join('')+
    '<button class="mini" data-act="tt-week" data-v="1">次週 ›</button>'+
    '<span class="s2" style="margin-left:auto">'+esc(weekLabel)+'　'+(mon.getMonth()+1)+'/'+mon.getDate()+'〜</span>'+
    '</div>';
  /* 今日の印は上の日付の欄だけ。今日が入っていない週を見ているときだけ、もどるボタンを出す */
  if(!todayCol && wk !== 0){
    h += '<div class="ttnow"><span class="ttnowdot"></span><b>今日は '+ymdLabel(td)+'</b>'+
         '<button class="mini" data-act="tt-weekset" data-v="0" style="margin-left:8px">今週にもどる</button></div>';
  }

  if(ttShowAll){
    h += '<div class="box" style="margin-bottom:12px">'+
      termsAll().map(function(x){
        return '<div class="row"><div class="grow"><div class="t">'+esc(x.label)+'</div>'+
          '<div class="s">'+(x.courses||[]).length+'科目・'+(x.courses||[]).reduce(function(a,c){return a+(Number(c.cr)||0);},0)+'単位'+
          (S.termsDone[x.id] ? '・修了' : '')+'</div></div>'+
          (x.id===S.termId ? '<span class="b cat">表示中</span>' : '<button class="mini" data-act="tt-use" data-id="'+x.id+'">表示</button>')+
          '</div>';
      }).join('')+
      '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--rule)">'+
      '<div class="pair" style="margin-bottom:8px">'+
        '<div><label class="f">年次</label><select id="tm_year">'+[1,2,3,4].map(function(y){ return '<option value="'+y+'"'+(y===t.year?' selected':'')+'>'+y+'年</option>'; }).join('')+'</select></div>'+
        '<div><label class="f">学期</label><select id="tm_half"><option value="1">前期</option><option value="2" selected>後期</option></select></div>'+
        '<div><label class="f">年度</label><input id="tm_y" inputmode="numeric" value="'+new Date().getFullYear()+'"></div></div>'+
      '<button class="btn ghost" data-act="tt-add-term">新しい学期を作る（今の科目をコピー）</button>'+
      '<p class="note">科目の追加・削除は「授業」タブからできます。</p></div></div>';
  }

  h += '<div class="scroll" style="overflow-x:hidden"><table class="tt tt2"><thead><tr><th class="pd"></th>'+
    DAYS.map(function(d){
      var hn = holidayName(dates[d]), isTd = (dates[d] === td);
      return '<th'+(isTd?' class="today"':'')+(hn&&!isTd?' style="color:var(--holi)"':'')+'>'+
        (isTd ? '<span class="todaytag">今日</span>' : '')+d+
        '<span class="dsub">'+Number(dates[d].slice(8,10))+(hn?'<br><span style="font-size:.85em">'+esc(hn.slice(0,4))+'</span>':'')+'</span></th>';
    }).join('')+
    '</tr></thead><tbody>';
  PERIODS.forEach(function(p){
    h += '<tr><th class="pd"><span class="pdn">'+p+'</span><span class="pdt">'+esc(S.commute.periods[p-1]||'')+'<br>'+esc(S.commute.ends[p-1]||'')+'</span></th>';
    DAYS.forEach(function(d){
      var c = map[d+p];
      var ymd0 = dates[d];
      var tdCls = '';                    /* 今日の印は、上の日付の欄だけにつける */
      var mk = makeupsOn(ymd0).filter(function(x){ return toNum(x.period)===p; })[0];
      if(!c && mk){
        h += '<td class="'+(courseReq(mk.course)?'reqd':'elec')+' mkup'+tdCls+'"><div class="cell2" role="button" tabindex="0" data-act="course-open" data-name="'+esc(mk.course)+'">'+
          '<span class="nm2">'+esc(shortName(mk.course))+'</span><span class="tag2 mk">補講</span>'+
          '<span class="room2">'+esc(mk.room||courseRoom(mk.course)||'')+'</span></div></td>';
        return;
      }
      if(!c){ h += '<td class="empty-cell'+tdCls+'"></td>'; return; }
      var ymd = dates[d];
      var holOn = changesOn(ymd).some(function(h){ return changeType(h)==='holclass'; });
      var inBk = (S.breaks||[]).some(function(bk){ return ymd >= bk.from && ymd <= bk.to; });
      var off = ((holidayName(ymd)||inBk) && !S.settings.classOnHoliday && !holOn) ? 'holiday' : isCancelled(c.name, ymd) ? 'cancel' : (c.bi && !biweekOn(c.name, ymd) ? 'skip' : '');
      var online = isOnlineOn(c.name, ymd);
      var isWeb = c.web || online;
      var cls = (courseReq(c.name) ? 'reqd' : 'elec') + (off ? ' off' : '') + (isWeb ? ' web' : '') + tdCls;
      h += '<td class="'+cls+'"><div class="cell2" role="button" tabindex="0" data-act="course-open" data-name="'+esc(c.name)+'">'+
        '<span class="nm2">'+esc(shortName(c.name))+'</span>'+
        (c.bi ? '<span class="tag2">'+(off==='skip' ? '今週なし' : '隔週')+'</span>' : '')+
        (off==='cancel' ? '<span class="tag2 cx">休講</span>' : '')+
        (off==='holiday' ? '<span class="tag2 cx">'+(inBk?'休み':'祝日')+'</span>' : '')+
        (online ? '<span class="tag2 ol">遠隔</span>' : '')+
        (function(){
          var its = itemsForCourseOn(c.name, ymd);
          var open = its.filter(function(x){ return !(x.src==='task' && x.done); });
          if(!its.length) return '';
          /* 予定がある日は、丸と件数をはっきり出す */
          return '<span class="cev">'+its.slice(0,4).map(function(x){
            var done = (x.src==='task' && x.done);
            return '<span class="cevd'+(done?' done':'')+'" style="'+(done?'border-color:'+itemColor(x):'background:'+itemColor(x))+'" title="'+esc(x.title)+(done?'（終わった）':'')+'"></span>';
          }).join('')+(its.length>4?'<span class="cevn">+'+(its.length-4)+'</span>':'')+
          (open.length?'<span class="cevn">'+open.length+'件</span>':'')+'</span>';
        })()+
        '<span class="room2">'+esc(courseRoom(c.name)||(isWeb?'WEB':''))+'</span>'+
        '</div></td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  h += '<p class="note">赤は必修、青は選択。科目をタップすると詳しい情報が開きます。隔週の科目は基準日を設定すると「今週なし」が自動で出ます（授業タブから）。</p>';
  var out = '';
  var parts = { grid: function(){ return '<section>'+h+'</section>'; }, notes: function(){ return weekNotes(dates); },
                subj: subjectPlanBox, cancel: cancelBox };
  pageOrder('tt').forEach(function(id){ if(parts[id] && !pageHidden('tt', id)) out += parts[id](); });
  return out;
}

/* ===== 科目ごとの予定（ぜんぶ）=====
   科目を選んで足した予定は、いつのものでもここに全部出る。
   時間割のマスは1週ぶんしか出せないので、取りこぼしがないように。 */
var ttSubjPast = false, ttSubjOpen = {};
var SUBJ_SHOW = 5;          /* 1科目で最初に出す数（多いときは「もっと見る」） */
function subjectPlanBox(){
  var td = today();
  var all = normItems().filter(function(x){
    return isSubjectSrc(x.src) && isYmd(x.date) && subjectOfItem(x);
  });
  var shown = ttSubjPast ? all : all.filter(function(x){
    return (x.end || x.date) >= td || (x.src === 'task' && !x.done);   /* 終わっていない課題は過去でも出す */
  });
  var courses = termCourses().map(function(c){ return c.name; });
  /* 科目ごとに1回で分ける */
  var groups = {}, firstName = {};
  shown.forEach(function(x){
    var s = subjectOfItem(x), k = subjKey(s) || s;
    (groups[k] = groups[k] || []).push(x);
    if(!firstName[k]) firstName[k] = s;
  });
  /* 今の時間割にない科目の予定も、下にまとめて出す */
  var known = {};
  courses.forEach(function(n){ known[subjKey(n) || n] = 1; });
  var extra = Object.keys(groups).filter(function(k){ return !known[k]; }).map(function(k){ return firstName[k]; });
  var order = courses.concat(extra);
  var total = shown.length;
  var body = order.map(function(name){
    var its = (groups[subjKey(name) || name] || []).slice()
      .sort(function(a,b){ return String(a.date).localeCompare(String(b.date)) || String(a.time||'').localeCompare(String(b.time||'')); });
    if(!its.length) return '';
    var c = courseByName(name);
    var open = !!ttSubjOpen[name], more = its.length - SUBJ_SHOW;
    return '<div class="dowgrp"><div class="dowhd" style="border-left:4px solid '+courseColor(name)+';padding-left:8px">'+
      esc(shortName(name))+(c && c.slotText ? '　<span class="s2">'+esc(c.slotText)+'</span>' : '')+'　'+its.length+'件</div>'+
      (open ? its : its.slice(0, SUBJ_SHOW)).map(function(x){ return itemRow(x, true, true); }).join('')+
      (more > 0 ? '<button class="mini" style="margin:4px 0 2px" data-act="tt-subj-more" data-name="'+esc(name)+'">'+(open ? 'たたむ' : 'あと'+more+'件を見る')+'</button>' : '')+
      '</div>';
  }).join('');
  return section('科目ごとの予定', total ? total+'件' : null,
    '<div class="pillrow" style="margin-top:0">'+
      '<button data-act="tt-subj-past" data-v="0" class="'+(!ttSubjPast?'on':'')+'">これから</button>'+
      '<button data-act="tt-subj-past" data-v="1" class="'+(ttSubjPast?'on':'')+'">ぜんぶ（前のぶんも）</button>'+
      '<button class="mini" data-act="go" data-app="cal" data-tab="add" style="margin-left:auto">＋ 予定を足す</button>'+
    '</div>'+
    (body || '<div class="empty">'+ART.empty+'<div style="margin-top:8px">科目を選んで足した予定はまだありません。<br>予定タブの「追加」で科目を選ぶと、ここに出ます。</div></div>')+
    '<p class="note">課題・テスト・重要・その他など、科目を選んで足した予定をぜんぶ出しています。</p>');
}

/* その週の連絡事項（課題・テスト・重要・その他など） */
function weekNotes(dates){
  var days = DAYS.map(function(d){ return dates[d]; });
  var from = days[0], to = days[days.length-1];
  var items = normItems().filter(function(x){
    if(!isYmd(x.date)) return false;
    var end = x.end || x.date;
    if(end < from || x.date > to) return false;      /* 何日も続く予定も入れる */
    if(x.src === 'task' && x.done) return false;
    return isSubjectSrc(x.src);
  }).sort(function(a,b){ return a.date.localeCompare(b.date); });
  var chg = S.holidays.filter(function(h){ return h.date >= from && h.date <= to; })
    .sort(function(a,b){ return a.date.localeCompare(b.date); });
  var typeName = { cancel:'休講', online:'遠隔', makeup:'補講', holclass:'祝日でも授業あり' };
  if(!items.length && !chg.length) return '';
  return section('この週の連絡事項', (items.length+chg.length)+'件',
    chg.map(function(x){
      var ty = changeType(x);
      return '<div class="evrow"><span class="cbar" style="background:'+(ty==='cancel'?'var(--rakuten)':ty==='online'?'var(--e6)':ty==='holclass'?'var(--holi)':'var(--ok)')+'"></span>'+
        '<span class="grow"><span class="t">'+(x.course==='*'?(ty==='holclass'?'':'全休'):esc(x.course))+(x.course==='*'&&ty==='holclass'?'':'　')+typeName[ty]+'</span>'+
        '<span class="s">'+ymdLabel(x.date)+(ty==='makeup'&&x.period?'　'+x.period+'限':'')+'</span></span></div>';
    }).join('')+
    items.map(function(x){
      return '<div class="evrow" data-act="ev-open" data-src="'+x.src+'" data-id="'+x.id+'" role="button">'+
        '<span class="cbar" style="background:'+itemColor(x)+'"></span>'+
        '<span class="grow"><span class="t">'+esc(x.title)+'</span>'+
        '<span class="s">'+ymdLabel(x.date)+(x.time?' '+x.time:'')+(x.sub?'・'+esc(x.sub):'')+'</span></span>'+
        '<span class="s2">›</span></div>';
    }).join(''));
}

/* 休講・遠隔・補講の登録 */
function cancelBox(){
  var future = S.holidays.filter(function(x){ return x.date >= today(); })
    .sort(function(a,b){ return a.date.localeCompare(b.date); });
  var typeName = { cancel:'休講', online:'遠隔', makeup:'補講', holclass:'祝日でも授業あり' };
  var typeColor = { cancel:'var(--rakuten)', online:'var(--e6)', makeup:'var(--ok)', holclass:'var(--holi)' };
  return section('休講・遠隔・補講の登録', future.length ? future.length+'件' : null,
    (future.length ? future.map(function(x){
      var ty = changeType(x);
      return '<div class="row"><div class="tick" style="background:'+typeColor[ty]+'"></div>'+
        '<div class="grow"><div class="t">'+(x.course==='*'?'全休':esc(x.course))+
          '<span class="b cat" style="margin-left:6px">'+typeName[ty]+'</span></div>'+
        '<div class="s">'+ymdLabel(x.date)+(ty==='makeup'&&x.period?'　'+x.period+'限':'')+(x.room?'　'+esc(x.room):'')+'</div></div>'+
        '<button class="mini" data-act="cancel-del" data-id="'+x.id+'">削除</button></div>';
    }).join('') : '<div class="empty">登録はありません。</div>')+
    '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--rule)">'+
    '<label class="f">種類</label>'+
    '<div class="pillrow" id="cxtype">'+
      [['cancel','休講'],['online','遠隔'],['makeup','補講'],['holclass','祝日でも授業あり']].map(function(o,i){
        return '<button data-act="cx-type" data-v="'+o[0]+'" class="'+(i===0?'on':'')+'">'+o[1]+'</button>';
      }).join('')+'</div>'+
    '<div class="field"><label class="f">科目</label><select id="cx_course"><option value="*">その日ぜんぶ（全休・全部遠隔）</option>'+
      termCourses().map(function(c){ return '<option value="'+esc(c.name)+'">'+esc(c.name)+'</option>'; }).join('')+'</select></div>'+
    mdPicker('cx_date', today(), '日付', false)+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">何限（補講のとき）</label><select id="cx_period">'+
        PERIODS.map(function(p){ return '<option value="'+p+'">'+p+'限</option>'; }).join('')+'</select></div>'+
      '<div><label class="f">教室（任意）</label><input id="cx_room" placeholder="N-204"></div></div>'+
    '<button class="btn ghost" data-act="cancel-add">登録する</button>'+
    '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--rule)">'+
      '<label class="f">長いお休み（夏休み・冬休みなど）</label>'+
      ((S.breaks||[]).length
        ? (S.breaks||[]).map(function(bk,i){
            return '<div class="row"><div class="tick" style="background:var(--sub)"></div>'+
              '<div class="grow"><div class="t">'+esc(bk.name||'お休み')+'</div>'+
              '<div class="s">'+ymdLabel(bk.from)+' 〜 '+ymdLabel(bk.to)+'</div></div>'+
              '<button class="mini" data-act="break-del" data-i="'+i+'">削除</button></div>';
          }).join('')
        : '<div class="empty" style="padding:8px 0">登録はありません。</div>')+
      '<div class="field" style="margin-top:10px"><label class="f">名前</label><input id="bk_name" placeholder="例：冬休み"></div>'+
      mdPicker('bk_from', today(), 'はじまり', false)+
      mdPicker('bk_to', today(), 'おわり', false)+
      '<button class="btn ghost" data-act="break-add">お休みを登録する</button>'+
      '<p class="note">この期間は授業なしになり、通学の計算からも外れます。</p>'+
    '</div>'+
    '<p class="note">休講はその日の授業から消え、行き方の計算も変わります。遠隔にすると通学の計算から外れます。補講は空いているコマに入ります。「祝日でも授業あり」は、その祝日を普通の授業日として扱います（科目は「その日ぜんぶ」でOK）。</p></div>');
}

/* ============================== 授業タブ ============================== */
function viewCourse(){
  if(courseView && courseByName(courseView)) return courseDetail(courseView);
  var list = termCourses();
  var totalCr = list.reduce(function(a,c){ return a+c.cr; }, 0);
  var listHtml = '<section><div class="head"><h2>科目一覧</h2><span>'+list.length+'科目・'+totalCr+'単位</span></div>'+
    list.map(function(c){
      var at = attendOf(c.name), nT = openTasksOf(c.name).length;
      var cm = S.courseMeta[c.name] || {};
      return '<div class="ccard" style="border-left:5px solid '+courseColor(c.name)+'" data-act="course-open" data-name="'+esc(c.name)+'" role="button" tabindex="0">'+
        '<div class="ct">'+esc(c.name)+(cm.alias?'<span class="s2" style="margin-left:6px">'+esc(cm.alias)+'</span>':'')+'</div>'+
        '<div class="cm">'+esc(c.slotText)+'　'+esc(courseRoom(c.name)||(c.web?'WEB':''))+'　'+c.cr+'単位　'+(courseReq(c.name)?'必修':'選択')+(c.bi?'・隔週':'')+'</div>'+
        '<div class="badges">'+
          '<span class="b '+(at.ab>=at.limit?'warn':at.limit-at.ab<=1?'r2':'cr')+'">'+
            (at.ab>=at.limit ? '単位が危ない（欠席'+at.ab+'）'
             : 'あと'+(at.limit-at.ab)+'回休むと単位不可')+'</span>'+
          (nT?'<span class="b" style="background:'+kindHex('task')+';color:'+kindFg('task')+'">課題 '+nT+'</span>':'')+
          (S.grades[c.name]&&S.grades[c.name].grade?'<span class="b cat">'+esc(S.grades[c.name].grade)+'</span>':'')+
        '</div></div>';
    }).join('')+
    '</section>';
  var partsC = { list: function(){ return listHtml; }, add: courseAddBox };
  var outC = '';
  pageOrder('course').forEach(function(id){ if(partsC[id] && !pageHidden('course', id)) outC += partsC[id](); });
  return outC;
}
function courseAddBox(){
  return section('科目を追加', '今の学期に', 
    '<div class="field"><label class="f">科目名</label><input id="ca_name" placeholder="例：解剖生理学"></div>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">曜日・時限（例：月1,水3）</label><input id="ca_slots" placeholder="月1"></div>'+
      '<div style="flex:0 0 90px"><label class="f">単位</label><input id="ca_cr" inputmode="numeric" value="2"></div></div>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">教室</label><input id="ca_room" placeholder="N-204"></div>'+
      '<div><label class="f">種類</label><select id="ca_req"><option value="1">必修</option><option value="0">選択</option></select></div></div>'+
    '<label class="tg"><input type="checkbox" id="ca_web">WEB（遠隔）の授業</label>'+
    '<label class="tg"><input type="checkbox" id="ca_bi">隔週</label>'+
    '<button class="btn" style="margin-top:10px" data-act="course-add-new">追加する</button>');
}

function courseDetail(name){
  var c = courseByName(name);
  var cm = S.courseMeta[name] || {};
  var at = attendOf(name);
  var td = today();
  var tasks = S.tasks.filter(function(t){ return sameSubject(t.subject, name); }).sort(function(a,b){ return String(a.due).localeCompare(String(b.due)); });
  var exams = S.exams.filter(function(x){ return sameSubject(x.subject, name); }).sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
  /* 重要だけでなく、その他や自分で作った種類も出す */
  var imps = S.events.filter(function(e){ return sameSubject(e.subject, name); })
    .sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
  var notes = S.notes.filter(function(n){ return n.link && n.link.type==='course' && n.link.id===name; });
  var gr = S.grades[name] || {};
  var todayCls = classesForDate(td).some(function(x){ return x.name===name && !x.off; });

  var backLabel = courseTemp ? '‹ 時間割にもどる'
                : courseFrom === 'today' ? '‹ 今日にもどる'
                : courseFrom === 'tt' ? '‹ 時間割にもどる'
                : '‹ 科目一覧';
  var h = '<button class="mini" data-act="course-back" style="margin-bottom:10px">'+backLabel+'</button>';
  h += '<div class="box" style="border-left:6px solid '+courseColor(name)+';margin-bottom:14px">'+
    '<div class="ct" style="font-size:1.15em">'+esc(name)+'</div>'+
    '<div class="cm">'+esc(c.slotText)+'　'+esc(courseRoom(name)||(c.web?'WEB':''))+'　'+c.cr+'単位'+(c.code?'　コード'+esc(c.code):'')+'</div>'+
    '<div class="pillrow" style="margin-top:10px">'+
      '<button data-act="course-req" data-name="'+esc(name)+'" class="'+(courseReq(name)?'on':'')+'" style="'+(courseReq(name)?'background:#B0311A;border-color:#B0311A;color:#fff':'')+'">必修</button>'+
      '<button data-act="course-req" data-name="'+esc(name)+'" class="'+(!courseReq(name)?'on':'')+'" style="'+(!courseReq(name)?'background:#0D2B7A;border-color:#0D2B7A;color:#fff':'')+'">選択</button>'+
      '<button data-act="course-room" data-name="'+esc(name)+'">教室を直す</button>'+
      '<button data-act="course-alias" data-name="'+esc(name)+'">略称</button>'+
    '</div>'+
    (c.bi ? '<div class="pair" style="margin-top:10px"><div>'+mdPicker('bw_'+name, S.biweek[name]||'', '隔週の基準日（授業がある日を1回選ぶ）', true)+'</div>'+
      '<button class="btn ghost" style="flex:0 0 auto;align-self:flex-end" data-act="biweek-save" data-name="'+esc(name)+'">保存</button></div>'+
      (isYmd(S.biweek[name]) ? '<p class="note">今週は'+(biweekOn(name, td)?'あります':'ありません')+'。</p>' : '') : '')+
    '</div>';

  /* 出欠 */
  var restAb = at.limit - at.ab;
  var baseNote = at.fromBase ? '（学務システムの基準）' : '';
  h += section('出欠', '出'+at.pres+'・欠'+at.abRaw+'・遅'+at.late+'／全'+at.total+'回',
    '<div class="'+(restAb<=0?'msg ng':restAb<=1?'bn red':restAb<=2?'bn amber':'msg ok')+'" style="margin-bottom:12px">'+
      (restAb<=0 ? '<b>欠席が上限に達しています。</b>先生に相談してください。'
       : (restAb<=2?'<span class="ic">!</span><span>':'')+
         '<b>あと'+restAb+'回休むと単位不可</b>です。'+
         '（判定基準 '+at.limit+'回'+esc(baseNote)+'）'+
         (at.late ? '　遅刻'+at.late+'回＝欠席'+Math.floor(at.late/3)+'回ぶん' : '')+
         (restAb<=2?'</span>':''))+'</div>'+
    '<div class="grid3 keep3" style="margin-bottom:10px">'+
      '<div class="stat"><div class="k">欠席</div><div class="v" style="color:'+(at.ab>=at.limit?'var(--rakuten)':'inherit')+'">'+at.ab+'</div></div>'+
      '<div class="stat"><div class="k">評価不可まで</div><div class="v">あと'+Math.max(0, at.limit-at.ab)+'</div></div>'+
      '<div class="stat"><div class="k">出席率</div><div class="v">'+(at.pres+at.ab+at.late ? Math.round((at.pres+at.late)/(at.pres+at.ab+at.late)*100) : '—')+'%</div></div></div>'+
    '<div class="bar" style="margin-bottom:12px"><i class="'+(at.ab>=at.limit?'over':'done')+'" style="width:'+Math.min(100,Math.round(at.ab/at.limit*100))+'%"></i></div>'+
    '<div class="pillrow"><span class="s2" style="align-self:center">今日（'+ymdLabel(td)+'）：</span>'+
      ['出','欠','遅'].map(function(st){
        var cur = (S.attendLog[name]||[]).filter(function(x){ return x.date===td; })[0];
        var on = cur && cur.st===st;
        return '<button data-act="att-set" data-name="'+esc(name)+'" data-date="'+td+'" data-st="'+st+'" class="'+(on?'on':'')+'">'+({出:'出席',欠:'欠席',遅:'遅刻'})[st]+'</button>';
      }).join('')+
      '<button data-act="att-set" data-name="'+esc(name)+'" data-date="'+td+'" data-st="">取消</button></div>'+
    (!todayCls ? '<p class="note">今日はこの授業の日ではありません。別の日を記録するには下の欄で日付を選んでください。</p>' : '')+
    '<div class="pair" style="margin-top:8px"><div>'+mdPicker('at_'+name, td, '別の日を記録', false)+'</div>'+
      '<select id="atst_'+esc(name)+'" style="flex:0 0 90px;align-self:flex-end;margin-bottom:11px"><option value="出">出席</option><option value="欠">欠席</option><option value="遅">遅刻</option></select>'+
      '<button class="btn ghost" style="flex:0 0 auto;align-self:flex-end;margin-bottom:11px" data-act="att-set-date" data-name="'+esc(name)+'">記録</button></div>'+
    (at.log.length ? '<div style="margin-top:6px">'+at.log.slice().reverse().slice(0,15).map(function(x){
      return '<div class="tline"><span class="pd-badge" style="'+(x.st==='欠'?'background:var(--rakutenbg);color:var(--rakuten)':x.st==='遅'?'background:var(--warnbg);color:var(--warn)':'')+'">'+x.st+'</span>'+
        '<span class="grow"><span class="t">'+ymdLabel(x.date)+'</span></span>'+
        '<button class="mini" data-act="att-set" data-name="'+esc(name)+'" data-date="'+x.date+'" data-st="">消す</button></div>';
    }).join('')+'</div>' : '')+
    '<div class="pair" style="margin-top:12px">'+
      '<div><label class="f">総授業回数</label><input id="cm_total" inputmode="numeric" value="'+at.total+'"></div>'+
      '<div><label class="f">評価不可になる欠席回数</label><input id="cm_limit" inputmode="numeric" value="'+at.limit+'"></div>'+
      '<button class="btn ghost" style="flex:0 0 auto;align-self:flex-end" data-act="course-meta-save" data-name="'+esc(name)+'">保存</button></div>');

  /* 課題・テスト・重要 */
  var rowT = function(t){
    var n = isYmd(t.due) ? daysFromToday(t.due) : null;
    return '<div class="evrow"><span class="cbar" style="background:'+kindHex('task')+'"></span>'+
      (t.done ? '' : '<button class="chk" data-act="task-done" data-id="'+t.id+'" aria-label="完了"></button>')+
      '<span class="grow"><span class="t"'+(t.done?' style="text-decoration:line-through;color:var(--sub)"':'')+'>'+esc(t.title)+'</span>'+
      '<span class="s">'+(isYmd(t.due)?ymdLabel(t.due):'期限なし')+(t.time?' '+esc(t.time)+'まで':'')+(t.memo?'・'+esc(t.memo):'')+'</span></span>'+
      (!t.done && n!==null ? '<span class="due '+dueClass(n)+'">'+dueText(n)+'</span>' : '')+
      '<button class="mini" data-act="ev-open" data-src="task" data-id="'+t.id+'">詳細</button></div>';
  };
  h += section('課題', tasks.filter(function(t){return !t.done;}).length+'件',
    (tasks.length ? tasks.map(rowT).join('') : '<div class="empty">この科目の課題はありません。</div>')+
    '<button class="btn ghost" style="margin-top:10px" data-act="course-add" data-name="'+esc(name)+'">この科目の課題を追加</button>');

  h += section('テスト', exams.length ? exams.length+'件' : null,
    (exams.length ? exams.map(function(x){
      var n = isYmd(x.date) ? daysFromToday(x.date) : null;
      var k = kindOf(x.kind==='quiz'?'quiz':x.kind==='kousa'?'kousa':'exam');
      return '<div class="evrow"><span class="cbar" style="background:'+k.hex+'"></span>'+
        '<span class="grow"><span class="t">'+esc(k.name)+(x.room?'・'+esc(x.room):'')+'</span>'+
        '<span class="s">'+(isYmd(x.date)?ymdLabel(x.date):'')+(x.time?' '+esc(x.time):'')+'</span></span>'+
        (n!==null?'<span class="due '+dueClass(n)+'">'+(n<0?'終了':dueText(n))+'</span>':'')+
        '<button class="mini" data-act="ev-open" data-src="quiz" data-id="'+x.id+'">詳細</button></div>';
    }).join('') : '<div class="empty">テストの予定はありません。</div>')+
    '<div class="field" style="margin-top:12px"><label class="f">テスト範囲・メモ</label><textarea id="cm_range" placeholder="例：第1〜5章、配布プリント">'+esc(cm.range||'')+'</textarea></div>'+
    '<button class="btn ghost" data-act="course-range-save" data-name="'+esc(name)+'">テスト範囲を保存</button>');

  if(imps.length) h += section('重要・その他の予定', imps.length+'件', imps.map(function(e){
    var ek = eventKind(e.kind);
    return '<div class="evrow"><span class="cbar" style="background:'+kindHex(ek)+'"></span>'+
      '<span class="grow"><span class="t">'+esc(e.title)+'</span><span class="s">'+kindOf(ek).name+'・'+ymdLabel(e.date)+(e.memo?'・'+esc(e.memo):'')+'</span></span>'+
      '<button class="mini" data-act="ev-open" data-src="'+esc(ek)+'" data-id="'+e.id+'">詳細</button></div>';
  }).join(''));

  /* シラバスと評価方法 */
  var sy = S.syllabus[name] || {};
  h += section('シラバス・評価', sy.url ? 'リンクあり' : null,
    '<div class="field"><label class="f">シラバスのURL</label><input id="sy_url" value="'+esc(sy.url||'')+'" placeholder="https://..."></div>'+
    (sy.url ? '<a class="btn ghost" style="margin-bottom:11px;display:block;text-align:center;text-decoration:none" href="'+esc(sy.url)+'" target="_blank" rel="noopener">シラバスを開く</a>' : '')+
    '<label class="f">評価のわりあい（%）</label>'+
    '<div class="grid2" style="margin-bottom:11px">'+
      '<div><label class="f">テスト</label><input id="sy_exam" inputmode="numeric" value="'+esc(sy.exam||'')+'"></div>'+
      '<div><label class="f">レポート</label><input id="sy_rep" inputmode="numeric" value="'+esc(sy.rep||'')+'"></div>'+
      '<div><label class="f">出席・平常点</label><input id="sy_att" inputmode="numeric" value="'+esc(sy.att||'')+'"></div>'+
      '<div><label class="f">そのほか</label><input id="sy_other" inputmode="numeric" value="'+esc(sy.other||'')+'"></div>'+
    '</div>'+
    (function(){
      var tot = toNum(sy.exam)+toNum(sy.rep)+toNum(sy.att)+toNum(sy.other);
      if(!tot) return '';
      var segs = [['テスト',toNum(sy.exam),'var(--rakuten)'],['レポート',toNum(sy.rep),kindHex('task')],
                  ['出席',toNum(sy.att),'var(--ok)'],['ほか',toNum(sy.other),'var(--sub)']].filter(function(x){ return x[1]>0; });
      return '<div class="bar" style="margin-bottom:6px;display:flex;gap:2px;background:none;box-shadow:none">'+
        segs.map(function(x){ return '<i style="width:'+Math.round(x[1]/tot*100)+'%;background:'+x[2]+'"></i>'; }).join('')+'</div>'+
        '<div class="s2" style="margin-bottom:10px">'+segs.map(function(x){ return x[0]+' '+x[1]+'%'; }).join('　')+(tot!==100?'（合計'+tot+'%）':'')+'</div>';
    })()+
    '<div class="field"><label class="f">評価のメモ</label><textarea id="sy_memo" placeholder="例：出席2/3以上で受験資格">'+esc(sy.memo||'')+'</textarea></div>'+
    '<button class="btn ghost" data-act="syl-save" data-name="'+esc(name)+'">保存</button>'+
    syllabusAiBox(name));

  /* 成績 */
  h += section('成績', gr.grade ? esc(gr.grade) : null,
    '<div class="pair"><div><label class="f">評価（S/A/B/C/D など）</label><input id="gr_grade" value="'+esc(gr.grade||'')+'" placeholder="A"></div>'+
      '<div><label class="f">点数（任意）</label><input id="gr_score" inputmode="numeric" value="'+esc(gr.score||'')+'"></div>'+
      '<button class="btn ghost" style="flex:0 0 auto;align-self:flex-end" data-act="grade-save" data-name="'+esc(name)+'">保存</button></div>'+
    '<p class="note">GPAの計算：S=4、A=3、B=2、C=1、D=0 として単位で重みづけします。</p>');

  /* メモ */
  h += section('この科目のメモ', notes.length ? notes.length+'件' : null,
    (notes.length ? notes.map(noteRow).join('') : '<div class="empty">メモはまだありません。</div>')+
    '<button class="btn ghost" style="margin-top:10px" data-act="note-new" data-link-type="course" data-link-id="'+esc(name)+'">この科目のメモを作る</button>');

  h += '<button class="btn ghost" style="margin-top:6px;color:var(--rakuten)" data-act="course-remove" data-name="'+esc(name)+'">この科目を学期から外す</button>';
  return h;
}

/* ===== シラバスの文章から、評価の割合とテストの日をAIが読み取る ===== */
var sylAi = { name:'', busy:false, result:null, err:'' };
function syllabusAiBox(name){
  var r = (sylAi.name === name) ? sylAi.result : null;
  var h = '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--rule)">'+
    '<label class="f">シラバスの文章を貼って、AIに読み取ってもらう</label>'+
    '<textarea id="sy_text" style="min-height:90px" placeholder="シラバスの「成績評価の方法」「授業計画」などを、そのままコピーして貼り付け"></textarea>'+
    '<button class="btn" style="margin-top:8px" data-act="syl-ai" data-name="'+esc(name)+'"'+(sylAi.busy?' disabled':'')+'>'+
      (sylAi.busy && sylAi.name === name ? '読み取っています…' : 'AIで読み取る')+'</button>'+
    (sylAi.err && sylAi.name === name ? '<p class="note" style="color:var(--rakuten)">'+esc(sylAi.err)+'</p>' : '');
  if(r){
    var pct = [['テスト', r.exam], ['レポート', r.report], ['出席・平常点', r.attend], ['そのほか', r.other]]
      .filter(function(x){ return x[1] != null && x[1] !== ''; });
    h += '<div class="box" style="margin-top:10px;background:rgba(255,255,255,.4)">'+
      '<div class="t" style="font-weight:700;margin-bottom:6px">読み取った内容（まだ保存していません）</div>'+
      (pct.length ? '<div class="s2" style="margin-bottom:6px">'+pct.map(function(x){ return esc(x[0])+' '+toNum(x[1])+'%'; }).join('　')+'</div>' : '<div class="s2">評価の割合は見つかりませんでした。</div>')+
      (r.other_detail ? '<div class="s2">そのほかの中身：'+esc(r.other_detail)+'</div>' : '')+
      (r.notes ? '<div class="s2" style="margin-bottom:6px">条件：'+esc(r.notes)+'</div>' : '')+
      ((r.tests||[]).length
        ? '<label class="f" style="margin-top:6px">テスト・小テスト</label>'+r.tests.map(function(x, i){
            return '<label class="row" style="gap:8px"><input type="checkbox" class="syl-pick" data-i="'+i+'"'+(isYmd(x.date)?' checked':'')+' style="width:auto">'+
              '<div class="grow"><div class="t">'+esc(x.title || 'テスト')+'<span class="b cat" style="margin-left:6px">'+(x.kind==='quiz'?'小テスト':'大テスト')+'</span></div>'+
              '<div class="s">'+(isYmd(x.date) ? ymdLabel(x.date) : '日付なし'+(x.week ? '（'+esc(x.week)+'）' : '')+'　→ 追加したあと「直す」で日付を入れてください')+'</div></div></label>';
          }).join('')
        : '<div class="s2">テストの日は見つかりませんでした。</div>')+
      '<div class="pair" style="margin-top:10px"><button class="btn" data-act="syl-apply" data-name="'+esc(name)+'">保存して、選んだテストを予定に入れる</button>'+
      '<button class="btn ghost" style="flex:0 0 auto;padding:11px 14px" data-act="syl-cancel">やめる</button></div>'+
      '</div>';
  }
  h += '<p class="note">貼った文章はGoogleのAIに送られます。割合は上の欄に入り、テストは「大テスト／小テスト」として予定に入ります。</p></div>';
  return h;
}
async function syllabusRead(name){
  var text = val('sy_text').trim();
  if(!text){ toast('シラバスの文章を貼ってください', true); return; }
  if(!aiReady()){ toast('先に設定タブでGemini APIキーを登録してください', true); return; }
  sylAi = { name:name, busy:true, result:null, err:'' };
  render();
  try{
    var t = curTerm();
    var r = await aiJson(
      'つぎは大学の授業「' + name + '」のシラバスの文章です。JSONだけを返してください。\n' +
      '{"exam":期末・中間テストの割合(数字。%は付けない。なければnull),"report":レポート・課題の割合,"attend":出席・平常点・授業態度の割合,' +
      '"other":そのほか(小テスト・発表など)の割合,"other_detail":"そのほかの中身を短く",' +
      '"notes":"単位をとる条件（例：出席2/3以上で受験資格）を短く。なければ空",' +
      '"tests":[{"title":"中間試験 など","kind":"exam(中間・期末) または quiz(小テスト)","date":"YYYY-MM-DD。書いていなければnull","week":"第何回か（日付がないとき。なければ空）"}]}\n' +
      '・割合が書いていないものは null。合計が100にならなくてもよい。\n' +
      '・今は' + today() + '、学期は「' + t.label + '」。年が書いていない日付は、この学期の中の日にする。\n' +
      '【シラバス】\n' + text.slice(0, 20000), [], 'syllabus');
    r = r || {};
    r.tests = (Array.isArray(r.tests) ? r.tests : []).map(function(x){
      x = x || {};
      var d = String(x.date || '');
      var m = d.match(/(\d{1,2})[-\/月](\d{1,2})/);
      if(!isYmd(d) && m) d = guessYear(+m[1], +m[2]) + '-' + pad(+m[1]) + '-' + pad(+m[2]);
      if(!isYmd(d)) d = syllabusWeekDate(name, x.week) || '';
      return { title:String(x.title || 'テスト').slice(0, 40), kind:(x.kind === 'quiz' ? 'quiz' : 'exam'), date:d, week:String(x.week || '') };
    });
    sylAi.result = r;
  }catch(e){
    sylAi.err = '読み取れませんでした：' + e.message;
    logErr('シラバス', e.message);
  }finally{
    sylAi.busy = false;
    render();
  }
}
/* 「第8回」→ 初回の日から数えた日付（初回の日が分かるときだけ） */
function syllabusWeekDate(name, week){
  var s = String(week || '');
  try{ s = s.normalize('NFKC'); }catch(e){}
  var n = toNum(s);
  if(!n || n > 30) return '';
  var c = courseByName(name);
  if(!c || !c.slots.length) return '';
  var first = (S.terms && S.terms.first) ? (S.terms.first[c.slots[0].d + c.slots[0].p] || S.terms.first[name]) : '';
  if(!isYmd(first)) return '';
  return shiftDate(first, (n - 1) * (c.bi ? 14 : 7));
}
function syllabusApply(name){
  var r = sylAi.result;
  if(!r) return;
  var cur = S.syllabus[name] || {};
  var num = function(v, old){ return (v == null || v === '') ? (old || '') : String(toNum(v)); };
  var notes = [cur.memo || '', r.notes || '', r.other_detail ? 'そのほか：' + r.other_detail : '']
    .filter(function(x, i, a){ return x && a.indexOf(x) === i; }).join('\n');
  S.syllabus[name] = Object.assign({}, cur, {
    exam:num(r.exam, cur.exam), rep:num(r.report, cur.rep), att:num(r.attend, cur.att), other:num(r.other, cur.other),
    memo:notes, mt:Date.now()
  });
  var picks = Array.prototype.map.call(document.querySelectorAll('.syl-pick'), function(el){ return el.checked ? toNum(el.dataset.i) : -1; })
    .filter(function(i){ return i >= 0; });
  var added = 0;
  picks.forEach(function(i){
    var x = r.tests[i]; if(!x) return;
    var date = isYmd(x.date) ? x.date : today();
    var dup = S.exams.some(function(e){ return sameSubject(e.subject, name) && e.date === date && (e.title||'') === x.title; });
    if(dup) return;
    S.exams.push({ id:uid('ex'), subject:name, title:x.title + (isYmd(x.date) ? '' : '（日付を入れてください）'), date:date, time:'',
      room:'', kind:x.kind, photos:[], rid:'', mt:Date.now() });
    added++;
  });
  sylAi = { name:'', busy:false, result:null, err:'' };
  touch('syllabus');
  toast('保存しました' + (added ? '（テスト' + added + '件を予定に入れました）' : ''));
  commit();
}

/* GPA（学期ごと・累積） */
function gpaOf(termIds){
  var pts = { S:4, A:3, B:2, C:1, D:0 };
  var sum = 0, cr = 0, earned = 0;
  termIds.forEach(function(id){
    var t = termOf(id);
    (t.courses||[]).forEach(function(c){
      var g = S.grades[c.name];
      if(!g || !g.grade) return;
      var p = pts[String(g.grade).toUpperCase().charAt(0)];
      if(p == null) return;
      sum += p * (Number(c.cr)||0); cr += (Number(c.cr)||0);
      if(p > 0) earned += (Number(c.cr)||0);
    });
  });
  return { gpa: cr ? Math.round(sum/cr*100)/100 : null, credits: cr, earned: earned };
}

/* ============================== 操作 ============================== */
function ttAction(act, t, ev){
  if(act==='tt-terms'){ ttShowAll = !ttShowAll; render(); return true; }
  if(act==='tt-week'){ ttWeek = (ttWeek===null?0:ttWeek) + toNum(t.dataset.v); render(); return true; }
  if(act==='tt-weekset'){ ttWeek = toNum(t.dataset.v); render(); return true; }
  if(act==='tt-subj-past'){ ttSubjPast = !!toNum(t.dataset.v); render(); return true; }
  if(act==='tt-subj-more'){ ttSubjOpen[t.dataset.name] = !ttSubjOpen[t.dataset.name]; render(); return true; }
  if(act==='tt-use'){ S.termId = t.dataset.id; touch('termsList'); ttShowAll=false; commit(); return true; }
  if(act==='tt-add-term'){
    var y = toNum(val('tm_year')), half = val('tm_half'), yy = toNum(val('tm_y'));
    var id = yy+'-'+half;
    if(termsAll().some(function(x){ return x.id===id; })){ toast('その学期はもうあります', true); return true; }
    var cur = curTerm();
    termsAll().push({ id:id, year:y, label:y+'年 '+(half==='1'?'前期':'後期')+'（'+yy+'年 '+half+'学期）', courses:(cur.courses||[]).map(function(c){ return Object.assign({}, c); }) });
    S.termId = id; touch('termsList'); ttShowAll=false; toast('学期を作りました'); commit(); return true;
  }
  if(act==='course-open'){
    courseView = t.dataset.name;
    courseFrom = appId;                 /* どこから来たか覚えておく */
    /* 授業タブを非表示にしていても開けるよう、一時的に見えるようにする */
    var tb = (S.ui.tabs||[]).filter(function(x){ return x[0]==='course'; })[0];
    if(tb && !tb[1]) courseTemp = true;
    appId='course'; render(); window.scrollTo(0,0); return true;
  }
  if(act==='course-back'){
    courseView='';
    if(courseTemp){ courseTemp=false; appId='tt'; }
    else if(courseFrom === 'today' || courseFrom === 'tt'){ appId = courseFrom; }
    courseFrom='';
    render(); window.scrollTo(0,0); return true;
  }
  if(act==='course-req'){
    var nm = t.dataset.name, cm = S.courseMeta[nm] || {};
    cm.req = courseReq(nm) ? 0 : 1; S.courseMeta[nm] = cm; touch('courseMeta'); commit(); return true;
  }
  if(act==='course-room'){
    var nm2 = t.dataset.name, cm2 = S.courseMeta[nm2] || {};
    var v = prompt(nm2+' の教室', courseRoom(nm2)); if(v===null) return true;
    cm2.room = v.trim(); S.courseMeta[nm2] = cm2; touch('courseMeta'); commit(); return true;
  }
  if(act==='course-alias'){
    var nm3 = t.dataset.name, cm3 = S.courseMeta[nm3] || {};
    var v3 = prompt('時間割に出す短い名前（空にすると元の名前）', cm3.alias||''); if(v3===null) return true;
    cm3.alias = v3.trim(); S.courseMeta[nm3] = cm3; touch('courseMeta'); commit(); return true;
  }
  if(act==='biweek-save'){
    var nm4 = t.dataset.name, d4 = readMd('bw_'+nm4);
    if(d4) S.biweek[nm4] = d4; else delete S.biweek[nm4];
    touch('biweek'); toast(d4?'基準日を保存しました':'基準日を消しました'); commit(); return true;
  }
  if(act==='att-set'){ setAttend(t.dataset.name, t.dataset.date, t.dataset.st); commit(); return true; }
  if(act==='att-set-date'){
    var nm5 = t.dataset.name, d5 = readMd('at_'+nm5), st5 = val('atst_'+nm5);
    if(!d5){ toast('日付を選んでください', true); return true; }
    setAttend(nm5, d5, st5); toast(ymdLabel(d5)+' を'+st5+'で記録'); commit(); return true;
  }
  if(act==='course-meta-save'){
    var nm6 = t.dataset.name, cm6 = S.courseMeta[nm6] || {};
    cm6.total = Math.max(1, toNum(val('cm_total'))); cm6.evalAbsent = Math.max(1, toNum(val('cm_limit')));
    S.courseMeta[nm6] = cm6; touch('courseMeta'); toast('保存しました'); commit(); return true;
  }
  if(act==='course-range-save'){
    var nm7 = t.dataset.name, cm7 = S.courseMeta[nm7] || {};
    cm7.range = val('cm_range'); S.courseMeta[nm7] = cm7; touch('courseMeta'); toast('保存しました'); commit(); return true;
  }
  if(act==='syl-ai'){ syllabusRead(t.dataset.name); return true; }
  if(act==='syl-apply'){ syllabusApply(t.dataset.name); return true; }
  if(act==='syl-cancel'){ sylAi = { name:'', busy:false, result:null, err:'' }; render(); return true; }
  if(act==='syl-save'){
    var nm0 = t.dataset.name;
    S.syllabus[nm0] = { url:val('sy_url').trim(), exam:val('sy_exam'), rep:val('sy_rep'),
      att:val('sy_att'), other:val('sy_other'), memo:val('sy_memo'), mt:Date.now() };
    touch('syllabus'); toast('保存しました'); commit(); return true;
  }
  if(act==='grade-save'){
    var nm8 = t.dataset.name;
    S.grades[nm8] = { grade: val('gr_grade').trim().toUpperCase(), score: val('gr_score').trim() };
    touch('grades'); toast('成績を保存しました'); commit(); return true;
  }
  if(act==='course-add-new'){
    var nm9 = val('ca_name').trim(), sl9 = val('ca_slots').trim().replace(/、/g,',');
    if(!nm9){ toast('科目名を入れてください', true); return true; }
    if(!parseSlots(sl9).length){ toast('曜日・時限は「月1」や「月3,水3」の形で', true); return true; }
    var cur9 = curTerm();
    if((cur9.courses||[]).some(function(c){ return c.name===nm9; })){ toast('同じ名前の科目があります', true); return true; }
    cur9.courses = cur9.courses || [];
    cur9.courses.push({ code:'', slots:sl9, name:nm9, cr:toNum(val('ca_cr'))||0, room:val('ca_room').trim(),
      cat:'', req: val('ca_req')==='1'?1:0, web: document.getElementById('ca_web').checked?1:0, bi: document.getElementById('ca_bi').checked?1:0 });
    touch('termsList'); toast('科目を追加しました'); commit(); return true;
  }
  if(act==='course-remove'){
    var nm10 = t.dataset.name;
    if(!confirm(nm10+' をこの学期から外しますか？（出欠や成績の記録は残ります）')) return true;
    var cur10 = curTerm(); cur10.courses = (cur10.courses||[]).filter(function(c){ return c.name!==nm10; });
    touch('termsList'); courseView=''; toast('外しました'); commit(); return true;
  }
  if(act==='break-add'){
    var f = readMd('bk_from'), to = readMd('bk_to');
    if(!f || !to){ toast('日付を選んでください', true); return true; }
    if(to < f){ var tmp = f; f = to; to = tmp; }
    S.breaks = S.breaks || [];
    S.breaks.push({ id:uid('bk'), name:val('bk_name').trim() || 'お休み', from:f, to:to, mt:Date.now() });
    S.breaks.sort(function(a,b){ return a.from.localeCompare(b.from); });
    toast('お休みを登録しました'); commit(); return true;
  }
  if(act==='break-del'){
    var bkDel = (S.breaks||[])[toNum(t.dataset.i)];
    if(bkDel && bkDel.id) removeWithUndo('breaks', bkDel.id, '消しました');
    else { S.breaks.splice(toNum(t.dataset.i), 1); toast('消しました'); }
    commit(); return true;
  }
  if(act==='cx-type'){
    Array.prototype.forEach.call(t.parentNode.querySelectorAll('button'), function(b){ b.classList.remove('on'); });
    t.classList.add('on'); return true;
  }
  if(act==='cancel-add'){
    var cd = readMd('cx_date'), cc = val('cx_course');
    var tb = document.querySelector('#cxtype button.on');
    var ty = tb ? tb.dataset.v : 'cancel';
    if(!cd){ toast('日付を選んでください', true); return true; }
    if(ty === 'makeup' && cc === '*'){ toast('補講は科目を選んでください', true); return true; }
    if(ty === 'holclass'){
      if(!holidayName(cd)){ toast(ymdLabel(cd)+' は祝日ではありません', true); return true; }
      cc = '*';
    }
    S.holidays.push({ id:uid('hx'), date:cd, course:cc, type:ty,
      period: ty==='makeup' ? toNum(val('cx_period')) : 0, room: val('cx_room').trim(), mt:Date.now() });
    toast(({cancel:'休講',online:'遠隔',makeup:'補講',holclass:'祝日の授業'})[ty]+'を登録しました'); commit(); return true;
  }
  if(act==='cancel-del'){ removeWithUndo('holidays', t.dataset.id, '休講を消しました'); commit(); return true; }
  return false;
}

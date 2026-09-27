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
/* 期限が過ぎた課題か（日付が今日より前、または今日で時刻が過ぎた） */
function taskPastDue(t, now){
  if(!t || !isYmd(t.due)) return false;
  var td = today();
  if(t.due < td) return true;
  if(t.due > td) return false;
  var m = /^(\d{1,2}):(\d{2})/.exec(String(t.time || ''));
  if(!m) return false;
  var d = now ? new Date(now) : new Date();
  return d.getHours() * 60 + d.getMinutes() > (+m[1]) * 60 + (+m[2]);
}
/* 終わったテストか（前の日のもの。当日は1日出しておく） */
function examPast(x){ return !!(x && isYmd(x.date) && x.date < today()); }
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
        (isTd ? (typeof charaLevel === 'function' && charaLevel() >= 4 ? '<span class="ttch">'+charaSvg({ size:18, expr:'happy', hat:'', still:true })+'</span>' : '')+'<span class="todaytag">今日</span>' : '')+d+
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
  if(typeof kmParts === 'function') kmParts('tt', parts, {});
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
      var at = attendOf(c.name), nT = openTasksOf(c.name).filter(function(t){ return !taskPastDue(t); }).length;
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
  if(typeof kmParts === 'function') kmParts('course', partsC, {});
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
  /* 期限が過ぎた課題・終わったテストは、この画面には出さない（ToDo・カレンダーの記録はそのまま） */
  var tasks = S.tasks.filter(function(t){ return sameSubject(t.subject, name) && !taskPastDue(t); }).sort(function(a,b){ return String(a.due).localeCompare(String(b.due)); });
  var exams = S.exams.filter(function(x){ return sameSubject(x.subject, name) && !examPast(x); }).sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
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
      (syllabusSaved(S.syllabus[name]) ? '<button data-act="syl-view" data-name="'+esc(name)+'">📄 シラバス</button>' : '')+
      '<button data-act="course-sort" class="'+(courseSortOpen?'on':'')+'" aria-expanded="'+(courseSortOpen?'true':'false')+'">⇅ 並べ替え</button>'+
    '</div>'+
    (c.bi ? '<div class="pair" style="margin-top:10px"><div>'+mdPicker('bw_'+name, S.biweek[name]||'', '隔週の基準日（授業がある日を1回選ぶ）', true)+'</div>'+
      '<button class="btn ghost" style="flex:0 0 auto;align-self:flex-end" data-act="biweek-save" data-name="'+esc(name)+'">保存</button></div>'+
      (isYmd(S.biweek[name]) ? '<p class="note">今週は'+(biweekOn(name, td)?'あります':'ありません')+'。</p>' : '') : '')+
    '</div>';

  /* 並べ替え（すべての授業で同じ並び。設定の「タブと画面の並び・表示」でも変えられる） */
  if(courseSortOpen) h += courseSortBox();
  var sy = S.syllabus[name] || {};
  var rowT = function(t){
    var n = isYmd(t.due) ? daysFromToday(t.due) : null;
    return '<div class="evrow"><span class="cbar" style="background:'+kindHex('task')+'"></span>'+
      (t.done ? '' : '<button class="chk" data-act="task-done" data-id="'+t.id+'" aria-label="完了"></button>')+
      '<span class="grow"><span class="t"'+(t.done?' style="text-decoration:line-through;color:var(--sub)"':'')+'>'+esc(t.title)+'</span>'+
      '<span class="s">'+(isYmd(t.due)?ymdLabel(t.due):'期限なし')+(t.time?' '+esc(t.time)+'まで':'')+(t.memo?'・'+esc(t.memo):'')+'</span>'+
      evThumbs(t.photos)+'</span>'+
      (!t.done && n!==null ? '<span class="due '+dueClass(n)+'">'+dueText(n)+'</span>' : '')+
      '<button class="mini" data-act="ev-open" data-src="task" data-id="'+t.id+'">詳細</button></div>';
  };
  var parts = {
    /* 出欠（スマホで場所をとらないように、まとめる。くわしい記録と設定は、たたんでおく） */
    attend: function(){ return attendSection(name, at, td, todayCls); },
    tasks: function(){
      return section('課題', tasks.filter(function(t){return !t.done;}).length+'件',
        (tasks.length ? tasks.map(rowT).join('') : '<div class="empty">この科目の課題はありません。</div>')+
        '<button class="btn ghost" style="margin-top:10px" data-act="course-add" data-name="'+esc(name)+'">この科目の課題を追加</button>');
    },
    exams: function(){
      return section('テスト', exams.length ? exams.length+'件' : null,
        (exams.length ? exams.map(function(x){
          var n = isYmd(x.date) ? daysFromToday(x.date) : null;
          var k = kindOf(x.kind==='quiz'?'quiz':x.kind==='kousa'?'kousa':'exam');
          return '<div class="evrow"><span class="cbar" style="background:'+k.hex+'"></span>'+
            '<span class="grow"><span class="t">'+esc(k.name)+(x.room?'・'+esc(x.room):'')+'</span>'+
            '<span class="s">'+(isYmd(x.date)?ymdLabel(x.date):'')+(x.time?' '+esc(x.time):'')+'</span>'+evThumbs(x.photos)+'</span>'+
            (n!==null?'<span class="due '+dueClass(n)+'">'+(n<0?'終了':dueText(n))+'</span>':'')+
            '<button class="mini" data-act="ev-open" data-src="quiz" data-id="'+x.id+'">詳細</button></div>';
        }).join('') : '<div class="empty">テストの予定はありません。</div>')+
        '<div class="field" style="margin-top:12px"><label class="f">テスト範囲・メモ</label><textarea id="cm_range" placeholder="例：第1〜5章、配布プリント">'+esc(cm.range||'')+'</textarea></div>'+
        '<button class="btn ghost" data-act="course-range-save" data-name="'+esc(name)+'">テスト範囲を保存</button>');
    },
    events: function(){
      if(!imps.length) return '';
      return section('重要・その他の予定', imps.length+'件', imps.map(function(e){
        var ek = eventKind(e.kind);
        return '<div class="evrow"><span class="cbar" style="background:'+kindHex(ek)+'"></span>'+
          '<span class="grow"><span class="t">'+esc(e.title)+'</span><span class="s">'+kindOf(ek).name+'・'+ymdLabel(e.date)+(e.memo?'・'+esc(e.memo):'')+'</span>'+evThumbs(e.photos)+'</span>'+
          '<button class="mini" data-act="ev-open" data-src="'+esc(ek)+'" data-id="'+e.id+'">詳細</button></div>';
      }).join(''));
    },
    /* シラバス（保存しておく） */
    syllabus: function(){ return syllabusSection(name, sy); },
    /* 評価の割合（項目の名前も自分で登録） */
    eval: function(){ return evalSection(name, sy); },
    /* 成績の見込み（評価の割合＋自分の点） */
    forecast: function(){ return (typeof cpForecastSection === 'function') ? cpForecastSection(name) : ''; },
    grade: function(){
      return section('成績', gr.grade ? esc(gr.grade) : null,
        '<div class="pair"><div><label class="f">評価（秀・優・良・可・不可／S・A・B・C・D など）</label><input id="gr_grade" value="'+esc(gr.grade||'')+'" placeholder="優"></div>'+
          '<div><label class="f">点数（任意）</label><input id="gr_score" inputmode="numeric" value="'+esc(gr.score||'')+'"></div>'+
          '<button class="btn ghost" style="flex:0 0 auto;align-self:flex-end" data-act="grade-save" data-name="'+esc(name)+'">保存</button></div>'+
        '<p class="note">GPAの計算：'+esc(typeof cpGpText === 'function' ? cpGpText() : 'S=4、A=3、B=2、C=1、D=0')+' として単位で重みづけします（授業タブの「GPAと単位」で変えられます）。</p>');
    },
    notes: function(){
      return section('この科目のメモ', notes.length ? notes.length+'件' : null,
        (notes.length ? notes.map(noteRow).join('') : '<div class="empty">メモはまだありません。</div>')+
        '<button class="btn ghost" style="margin-top:10px" data-act="note-new" data-link-type="course" data-link-id="'+esc(name)+'">この科目のメモを作る</button>');
    }
  };
  var shown = 0;
  pageOrder('coursedt').forEach(function(id){
    if(pageHidden('coursedt', id) || !parts[id]) return;
    var part = parts[id]();
    if(part){ h += part; shown++; }
  });
  if(!shown) h += '<div class="empty" style="margin-bottom:12px">出す項目をぜんぶかくしています。上の「⇅ 並べ替え」から出せます。</div>';

  h += '<button class="btn ghost" style="margin-top:6px;color:var(--rakuten)" data-act="course-remove" data-name="'+esc(name)+'">この科目を学期から外す</button>';
  return h;
}

/* ============================== 授業の詳細の並べ替え ============================== */
var courseSortOpen = false;
function courseSortBox(){
  var labels = {}; (PAGE_SECTIONS.coursedt || []).forEach(function(x){ labels[x[0]] = x[1]; });
  var ids = pageOrder('coursedt');
  return '<div class="box coursesort" style="margin-bottom:14px">'+
    '<div class="t" style="font-weight:700;margin-bottom:4px">授業の画面の並び</div>'+
    '<p class="note" style="margin:0 0 8px"><b>≡</b> をおしたまま上下に動かすか、↑↓ で動かします。「出さない」にした項目は、この画面に出ません。すべての授業で同じ並びになります。</p>'+
    '<div class="c9hlist" data-kind="page" data-pg="coursedt">'+ids.map(function(id, i){
      return c9HomeRow('page', 'coursedt', id, labels[id] || id, i, ids.length, !pageHidden('coursedt', id), false);
    }).join('')+'</div>'+
    '<div class="pair" style="margin-top:8px"><button class="btn ghost" data-act="course-sort-reset">はじめの並びにもどす</button>'+
    '<button class="btn" data-act="course-sort">できた</button></div>'+
  '</div>';
}

/* ============================== 出欠（まとめた形） ============================== */
var attMore = {};                                  /* くわしい記録をひらいている科目 */
function attendSection(name, at, td, todayCls){
  var restAb = at.limit - at.ab;
  var lv = restAb <= 0 ? 'ng' : restAb <= 1 ? 'r' : restAb <= 2 ? 'a' : 'ok';
  var seen = at.pres + at.ab + at.late;
  var rate = seen ? Math.round((at.pres + at.late) / seen * 100) : null;
  var cur = (S.attendLog[name] || []).filter(function(x){ return x.date === td; })[0];
  var open = !!attMore[name];
  var h = '<div class="attc attc-' + lv + '">' +
    '<div class="attc-top"><b>' + (restAb <= 0 ? '欠席が上限です（先生に相談を）' : 'あと' + restAb + '回休める') + '</b>' +
      '<span class="attc-sub">欠席' + at.ab + '/' + at.limit + '・出席率' + (rate == null ? '—' : rate + '%') + (at.late ? '・遅刻' + at.late + (at.late >= 3 ? '（欠席' + Math.floor(at.late / 3) + '回ぶん）' : '') : '') + '</span></div>' +
    '<div class="attc-bar" role="img" aria-label="欠席' + at.ab + '回（上限' + at.limit + '回）"><i style="width:' + Math.min(100, Math.round(at.ab / Math.max(1, at.limit) * 100)) + '%"></i></div>' +
  '</div>';
  if(todayCls){
    h += '<div class="attc-today"><span class="attc-lb">今日</span>' +
      ['出', '欠', '遅'].map(function(st){
        var on = cur && cur.st === st;
        return '<button data-act="att-set" data-name="' + esc(name) + '" data-date="' + td + '" data-st="' + (on ? '' : st) + '" class="attc-b attc-' + ({出:'p',欠:'a',遅:'l'})[st] + (on ? ' on' : '') + '"' +
          ' aria-pressed="' + (on ? 'true' : 'false') + '">' + ({出:'出席', 欠:'欠席', 遅:'遅刻'})[st] + '</button>';
      }).join('') + '</div>';
  }
  h += '<button class="attc-more" data-act="att-more" data-name="' + esc(name) + '" aria-expanded="' + open + '">' +
    (open ? '▴ とじる' : '▾ ' + (todayCls ? '' : '記録する・') + '記録を見る・回数の設定') + '</button>';
  if(open){
    h += '<div class="attc-box">' +
      '<div class="attc-row"><div class="grow">' + mdPicker('at_' + name, td, 'ほかの日を記録', false) + '</div>' +
        '<select id="atst_' + esc(name) + '" aria-label="出欠"><option value="出">出席</option><option value="欠">欠席</option><option value="遅">遅刻</option></select>' +
        '<button class="btn ghost" data-act="att-set-date" data-name="' + esc(name) + '">記録</button></div>' +
      (at.log.length ? '<div class="attc-log">' + at.log.slice().reverse().slice(0, 40).map(function(x){
        return '<button class="attc-chip attc-' + ({出:'p',欠:'a',遅:'l'})[x.st] + '" data-act="att-log-del" data-name="' + esc(name) + '" data-date="' + x.date + '" title="消す">' +
          esc(x.date.slice(5).replace('-', '/')) + ' ' + esc(x.st) + ' <span aria-hidden="true">×</span></button>';
      }).join('') + '</div>' : '<div class="s2">まだ記録がありません。</div>') +
      '<div class="attc-row" style="margin-top:8px">' +
        '<div><label class="f">授業の回数</label><input id="cm_total" inputmode="numeric" value="' + at.total + '"></div>' +
        '<div><label class="f">単位不可になる欠席</label><input id="cm_limit" inputmode="numeric" value="' + at.limit + '"></div>' +
        '<button class="btn ghost" data-act="course-meta-save" data-name="' + esc(name) + '">保存</button></div>' +
      (at.fromBase ? '<p class="note">欠席の上限は、学務システムの基準です。</p>' : '') +
    '</div>';
  }
  return section('出欠', '出' + at.pres + '・欠' + at.abRaw + '・遅' + at.late + '／全' + at.total + '回', h);
}

/* ============================== シラバス（保存しておく） ============================== */
var SYL_PDF_MAX = 10 * 1024 * 1024;
function syllabusFiles(sy){ return (Array.isArray(sy && sy.files) ? sy.files : []).filter(function(f){ return f && f.pid; }); }
/* シラバスとして見せるものがあるか（文章・写真・PDF・前に入れたリンク・前に読み取った中身） */
function syllabusSaved(sy){
  sy = sy || {};
  return !!(String(sy.text || '').trim() || syllabusFiles(sy).length || sy.url || sy.teacher ||
    (Array.isArray(sy.plan) && sy.plan.length) || (Array.isArray(sy.books) && sy.books.length));
}
function syllabusSection(name, sy){
  var files = syllabusFiles(sy), text = String(courseDraftOf(name, 'text', sy.text || ''));
  var saved = syllabusSaved(sy);
  var imgs = files.filter(function(f){ return f.kind !== 'pdf'; }), pdfs = files.filter(function(f){ return f.kind === 'pdf'; });
  var h = (saved ? '<button class="btn syl-open" data-act="syl-view" data-name="' + esc(name) + '">📄 シラバスを見る</button>' : '') +
    (imgs.length ? '<div class="mphotos syl-imgs">' + imgs.map(function(f){
      return '<div class="mphoto"><img data-pid="' + esc(f.pid) + '" alt="' + esc(f.name || 'シラバスの写真') + '" data-act="syl-view" data-name="' + esc(name) + '" data-pid="' + esc(f.pid) + '">' +
        '<button class="mini" data-act="syl-file-del" data-name="' + esc(name) + '" data-pid="' + esc(f.pid) + '" aria-label="消す">×</button></div>';
    }).join('') + '</div>' : '') +
    (pdfs.length ? pdfs.map(function(f){
      return '<div class="syl-pdf"><button type="button" class="syl-pdfopen" data-act="syl-view" data-name="' + esc(name) + '" data-pid="' + esc(f.pid) + '">' +
        '<span class="syl-ic" aria-hidden="true">📄</span><span class="grow"><span class="t">' + esc(f.name || 'シラバス.pdf') + '</span>' +
        '<span class="s2">' + (f.size ? Math.max(1, Math.round(f.size / 1024)) + 'KB・' : '') + '押すと見られます</span></span></button>' +
        '<button class="mini" data-act="syl-file-del" data-name="' + esc(name) + '" data-pid="' + esc(f.pid) + '" aria-label="消す">×</button></div>';
    }).join('') : '') +
    '<div class="field" style="margin-top:10px"><label class="f" for="sy_text">シラバスの文章（大学のページからコピーして貼りつけ）</label>' +
      '<textarea id="sy_text" style="min-height:' + (text ? 120 : 80) + 'px" placeholder="「授業の目的」「授業計画」「成績評価の方法」「教科書」などを、そのまま貼りつけて保存できます">' + esc(text) + '</textarea></div>' +
    '<div class="pair" style="margin-top:8px">' +
      '<button class="btn ghost" data-act="syl-text-save" data-name="' + esc(name) + '">文章を保存</button>' +
      '<button class="btn ghost" data-act="syl-file-add" data-name="' + esc(name) + '">＋ 写真・PDF</button></div>' +
    (sy.url ? '<p class="note">前に入れたリンク：<a href="' + esc(sy.url) + '" target="_blank" rel="noopener">シラバスのページをひらく</a></p>' : '') +
    syllabusMore(sy);
  return section('シラバス', saved ? '保存してあります' + (files.length ? '（' + files.length + 'ファイル）' : '') : null, h);
}

/* ===== シラバスを見る画面（文章・写真・PDF を、1回おすだけでアプリの中に出す） ===== */
var sylView = { el:null, name:'' };
function sylViewClose(){
  if(sylView.el){ sylView.el.remove(); sylView.el = null; }
  sylView.name = '';
  document.documentElement.classList.remove('sylview-on');
}
function sylViewOpen(name, focusPid){
  var sy = S.syllabus[name] || {};
  var more = syllabusMore(sy);
  docViewOpen({ label:'シラバス', title:name, text:String(sy.text || '').trim(), textCap:'文章', files:syllabusFiles(sy), focus:focusPid,
    extra:(sy.url ? '<div class="sv-blk"><div class="sv-cap">前に入れたリンク</div><a class="mini" href="' + esc(sy.url) + '" target="_blank" rel="noopener">シラバスのページをひらく</a></div>' : '') + more,
    empty:!sy.url && !more });
  sylView.name = name;
}
/* 文章・写真・PDF・そのほかのファイルを、1つの画面でアプリの中に出す（シラバス・メモの添付で使う）
   opt … { label, title, text, textCap, files:[{ pid, name, kind:'photo'|'pdf'|'file', size }], extra, empty, focus } */
function docViewOpen(opt){
  sylViewClose();
  opt = opt || {};
  var files = (opt.files || []).filter(function(f){ return f && f.pid; }), text = String(opt.text || '').trim();
  var el = document.createElement('div');
  el.id = 'sylview';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', String(opt.title || '') + (opt.label ? 'の' + opt.label : ''));
  el.innerHTML = '<div class="sv-hd"><div class="grow"><div class="s2">' + esc(opt.label || '') + '</div><div class="sv-ttl">' + esc(opt.title || '') + '</div></div>' +
      '<button type="button" class="mini sv-close" data-sv="close">とじる</button></div>' +
    '<div class="sv-bd">' +
      (text ? '<div class="sv-blk"><div class="sv-cap">' + esc(opt.textCap || '文章') + '</div><div class="sv-text">' + esc(text) + '</div></div>' : '') +
      files.map(function(f){
        if(f.kind === 'pdf'){
          return '<div class="sv-blk" data-pid="' + esc(f.pid) + '"><div class="sv-cap">📄 ' + esc(f.name || 'PDF') + '</div>' +
            '<div class="sv-pdf" data-pdf="' + esc(f.pid) + '"><div class="s2">ひらいています…</div></div></div>';
        }
        if(f.kind === 'file'){
          return '<div class="sv-blk" data-pid="' + esc(f.pid) + '"><div class="sv-cap">📎 ' + esc(f.name || 'ファイル') + '</div>' +
            '<div class="sv-file"><span class="s2">' + esc(fileKindText(f)) + '</span>' +
            '<a class="mini" data-pidlink="' + esc(f.pid) + '" download="' + esc(f.name || 'file') + '" target="_blank" rel="noopener">ひらく</a></div></div>';
        }
        return '<div class="sv-blk" data-pid="' + esc(f.pid) + '"><div class="sv-cap">📷 ' + esc(f.name || '写真') + '</div>' +
          '<img class="sv-img" data-pid="' + esc(f.pid) + '" data-miss="1" alt="' + esc(f.name || '写真') + '" data-sv="zoom"></div>';
      }).join('') +
      (opt.extra || '') +
      (!text && !files.length && opt.empty !== false ? '<div class="empty">まだ何も保存していません。</div>' : '') +
    '</div>';
  el.addEventListener('click', function(e){
    var b = e.target.closest('[data-sv]');
    if(!b) return;
    if(b.dataset.sv === 'close'){ sylViewClose(); return; }
    if(b.dataset.sv === 'zoom' && b.getAttribute('src')){
      var v = document.getElementById('viewer');
      if(v){ v.querySelector('img').src = b.getAttribute('src'); v.classList.add('on'); }
    }
  });
  document.body.appendChild(el);
  document.documentElement.classList.add('sylview-on');
  sylView.el = el; sylView.name = '';
  if(typeof photoFill === 'function') photoFill();
  /* PDF はページを絵にして出す */
  Array.prototype.forEach.call(el.querySelectorAll('.sv-pdf'), function(box){ pdfShowInto(box, box.dataset.pdf); });
  var focusPid = String(opt.focus || '');
  if(focusPid){
    var at = el.querySelector('.sv-blk[data-pid="' + focusPid.replace(/"/g, '') + '"]');
    if(at) setTimeout(function(){ try{ at.scrollIntoView({ block:'start' }); }catch(err){} }, 60);
  }
}
/* ファイルの種類と大きさ（Word・Excel など） */
function fileKindText(f){
  var nm = String((f && f.name) || ''), ext = (/\.([A-Za-z0-9]{1,5})$/.exec(nm) || [])[1] || '';
  var kinds = { doc:'Word', docx:'Word', xls:'Excel', xlsx:'Excel', ppt:'PowerPoint', pptx:'PowerPoint', txt:'テキスト', csv:'CSV', key:'Keynote', pages:'Pages', numbers:'Numbers', zip:'ZIP' };
  var k = kinds[ext.toLowerCase()] || (ext ? ext.toUpperCase() : 'ファイル');
  return k + (f && f.size ? '・' + Math.max(1, Math.round(f.size / 1024)) + 'KB' : '');
}
/* PDF を1ページずつ絵にする（道具は lib/pdfjs にある。読めないときは、そのまま埋めこむ） */
var pdfjsLoading = null;
function loadPdfJs(){
  if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if(pdfjsLoading) return pdfjsLoading;
  pdfjsLoading = new Promise(function(res, rej){
    var sc = document.createElement('script');
    sc.src = 'lib/pdfjs/pdf.min.js';
    sc.onload = function(){
      if(!window.pdfjsLib){ rej(new Error('PDFを見る道具が読めませんでした')); return; }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdfjs/pdf.worker.min.js';
      res(window.pdfjsLib);
    };
    sc.onerror = function(){ rej(new Error('PDFを見る道具が読めませんでした（ネットにつながっているか確かめてください）')); };
    document.head.appendChild(sc);
  });
  pdfjsLoading['catch'](function(){ pdfjsLoading = null; });
  return pdfjsLoading;
}
function dataUrlToBytes(u){
  var m = /^data:[^,]*;base64,(.*)$/.exec(String(u || ''));
  if(!m) return null;
  var bin = atob(m[1]), out = new Uint8Array(bin.length);
  for(var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
var PDF_PAGES_MAX = 40;
async function pdfShowInto(box, pid){
  var src = await photoGet(pid);
  if(!box.isConnected) return;
  if(!src){ box.innerHTML = '<div class="pmiss">📄 このPDFは、まだこの端末に届いていません（PDFを入れた端末で、くらしの手帳を開くと送られます）</div>'; return; }
  try{
    var lib = await loadPdfJs();
    var doc = await lib.getDocument({ data:dataUrlToBytes(src) }).promise;
    if(!box.isConnected) return;
    box.innerHTML = '';
    var n = Math.min(doc.numPages, PDF_PAGES_MAX);
    var w = Math.max(280, Math.min(box.clientWidth || 360, 1100));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    for(var i = 1; i <= n; i++){
      var page = await doc.getPage(i);
      if(!box.isConnected) return;
      var vp1 = page.getViewport({ scale:1 });
      var vp = page.getViewport({ scale:(w / vp1.width) * dpr });
      var cv = document.createElement('canvas');
      cv.className = 'sv-page'; cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      cv.setAttribute('aria-label', (i) + 'ページめ');
      box.appendChild(cv);
      await page.render({ canvasContext:cv.getContext('2d'), viewport:vp }).promise;
    }
    if(doc.numPages > n) box.insertAdjacentHTML('beforeend', '<div class="s2">（' + doc.numPages + 'ページのうち、はじめの' + n + 'ページを出しています）</div>');
  }catch(e){
    /* 道具が読めないときは、ブラウザのPDF表示にまかせる */
    if(!box.isConnected) return;
    var url = src;
    try{ var bl = dataUrlToBlob(src); if(bl) url = URL.createObjectURL(bl); }catch(err){}
    box.innerHTML = '<iframe class="sv-frame" title="シラバスのPDF" src="' + esc(url) + '"></iframe>' +
      '<p class="note">うまく出ないときは <a href="' + esc(url) + '" target="_blank" rel="noopener">別の画面でひらく</a>（' + esc(e.message) + '）</p>';
  }
}

/* ============================== 評価の割合（項目の名前も自分で決める） ============================== */
var EVAL_PRESETS = ['期末試験', '中間試験', '小テスト', 'レポート', '課題', '出席', '平常点', '発表', '実技'];
var EVAL_COLORS = ['#C44A63', '#E0892B', '#3FA36B', '#2F8FD9', '#6B4FA0', '#C2549A', '#C9A227', '#8A8A96'];
var evalDraft = null;                              /* 保存する前の項目（{ name, items }） */
/* 書きかけのシラバスの文章・評価のメモ（ほかのボタンをおして描き直しても、消えないように） */
var courseDraft = { name:'', text:null, memo:null };
function courseDraftKeep(name){
  var a = document.getElementById('sy_text'), b = document.getElementById('sy_memo');
  if(!a && !b) return;
  if(courseDraft.name !== name) courseDraft = { name:name, text:null, memo:null };
  if(a) courseDraft.text = a.value;
  if(b) courseDraft.memo = b.value;
}
function courseDraftOf(name, k, def){ return (courseDraft.name === name && courseDraft[k] != null) ? courseDraft[k] : def; }
/* 評価の割合の入力らんを、変えていたときだけ覚えておく */
function evalKeepIfChanged(name){
  if(!document.getElementById('ev_n_0') && !(evalDraft && evalDraft.name === name)) return;
  var before = JSON.stringify(evalItemsNow(name).map(function(x){ return [x.name, String(x.pct)]; }));
  var now = evalItemsNow(name).map(function(x, i){
    var n = document.getElementById('ev_n_' + i), p = document.getElementById('ev_p_' + i);
    var nm = n ? n.value.trim().slice(0, 20) : x.name;
    return { name:nm, pct:p ? p.value.trim() : x.pct, kind:evalKindOf(nm) };
  });
  if(JSON.stringify(now.map(function(x){ return [x.name, String(x.pct)]; })) !== before || (evalDraft && evalDraft.name === name)) evalDraft = { name:name, items:now };
}
/* 授業の画面で、描き直す前に書きかけを覚えておく */
function courseKeepAll(name){ if(!name) return; courseDraftKeep(name); evalKeepIfChanged(name); }
/* 名前から、種類をあてる（成績の見込みで、出席は出席率・小テストは点の平均を使うため） */
function evalKindOf(name){
  var n = String(name || '');
  if(/小テスト|確認テスト|ミニテスト|クイズ|quiz/i.test(n)) return 'quiz';
  if(/試験|テスト|考査|exam/i.test(n)) return 'exam';
  if(/レポート|課題|提出物|report/i.test(n)) return 'report';
  if(/出席|出欠|平常|授業態度|参加|attend/i.test(n)) return 'attend';
  return 'other';
}
/* いまの評価の項目（前の形＝4つの欄だけのときは、そこから作る） */
function syllabusItems(sy){
  sy = sy || {};
  if(Array.isArray(sy.items) && sy.items.length){
    return sy.items.map(function(x){ x = x || {}; return { name:String(x.name || '').slice(0, 30), pct:evalPct(x.pct), kind:x.kind || evalKindOf(x.name) }; })
      .filter(function(x){ return x.name; });
  }
  return [['テスト', sy.exam, 'exam'], ['レポート', sy.rep, 'report'], ['出席・平常点', sy.att, 'attend'], ['そのほか', sy.other, 'other']]
    .filter(function(a){ return evalPct(a[1]) > 0; }).map(function(a){ return { name:a[0], pct:evalPct(a[1]), kind:a[2] }; });
}
/* 項目から、前の形の4つの欄も作っておく（前の版の端末でも読めるように） */
function syllabusLegacy(items){
  var sum = function(ks){ var s = 0, hit = false; items.forEach(function(x){ if(ks.indexOf(x.kind) >= 0){ s += evalPct(x.pct); hit = true; } }); return hit ? String(Math.round(s * 10) / 10) : ''; };
  return { exam:sum(['exam']), rep:sum(['report']), att:sum(['attend']), other:sum(['quiz', 'other']) };
}
/* 割合の数字を読む（全角の数字・「%」も読めるように。0〜100） */
function evalPct(v){
  var s = String(v == null ? '' : v); try{ s = s.normalize('NFKC'); }catch(e){}
  var n = parseFloat(s.replace(/[%％\s,]/g, ''));
  return isNaN(n) ? 0 : Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}
function evalItemsNow(name){
  return (evalDraft && evalDraft.name === name) ? evalDraft.items : syllabusItems(S.syllabus[name]);
}
/* 画面の入力らんから、書きかけの項目を読む */
function evalFromForm(name){
  var items = evalItemsNow(name).map(function(x, i){
    var n = document.getElementById('ev_n_' + i), p = document.getElementById('ev_p_' + i);
    var nm = n ? n.value.trim().slice(0, 20) : x.name;
    return { name:nm, pct:p ? p.value.trim() : x.pct, kind:evalKindOf(nm) };
  });
  evalDraft = { name:name, items:items };
  return items;
}
function evalSection(name, sy){
  var items = evalItemsNow(name), dirty = !!(evalDraft && evalDraft.name === name);
  var tot = Math.round(items.reduce(function(a, x){ return a + evalPct(x.pct); }, 0) * 10) / 10;
  var used = {}; items.forEach(function(x){ used[x.name] = 1; });
  var rows = items.map(function(x, i){
    return '<div class="evline"><span class="evdot" style="background:' + EVAL_COLORS[i % EVAL_COLORS.length] + '"></span>' +
      '<input id="ev_n_' + i + '" value="' + esc(x.name) + '" maxlength="20" placeholder="項目の名前" aria-label="項目の名前">' +
      '<input id="ev_p_' + i + '" class="evpct" value="' + esc(x.pct === '' ? '' : String(x.pct)) + '" inputmode="decimal" placeholder="0" aria-label="' + esc(x.name || '項目') + 'の割合">' +
      '<span class="evunit">%</span>' +
      '<button class="mini" data-act="eval-del" data-name="' + esc(name) + '" data-i="' + i + '" aria-label="この項目を消す">×</button></div>';
  }).join('');
  var segs = items.map(function(x, i){ return [x.name, evalPct(x.pct), EVAL_COLORS[i % EVAL_COLORS.length]]; }).filter(function(x){ return x[1] > 0; });
  var pres = EVAL_PRESETS.filter(function(p){ return !used[p]; });
  var h = (rows ? '<p class="note evhelp">名前と％は、そのまま書きかえられます（欄をはなれると自動で保存します）。× で消せます。</p>' +
          '<div class="evhead" aria-hidden="true"><span>項目の名前</span><span>割合</span></div><div class="evlist">' + rows + '</div>'
        : '<div class="s2" style="margin-bottom:8px">テスト・レポートなど、成績の付け方（項目）を足して、割合（%）を入れてください。項目の名前は自由に決められます。</div>') +
    '<button class="btn ghost evaddbtn" data-act="eval-add" data-name="' + esc(name) + '" data-v="">＋ 項目を追加（名前を自分で入れる）</button>' +
    (pres.length ? '<div class="s2" style="margin:8px 0 4px">よく使う名前から足す</div><div class="pillrow evpre">' +
      pres.map(function(p){
        return '<button data-act="eval-add" data-name="' + esc(name) + '" data-v="' + esc(p) + '">＋ ' + esc(p) + '</button>';
      }).join('') + '</div>' : '') +
    (segs.length ? '<div class="evbar" role="img" aria-label="' + esc(segs.map(function(x){ return x[0] + ' ' + x[1] + '%'; }).join('、')) + '">' +
        segs.map(function(x){ return '<i style="flex:' + x[1] + ';background:' + x[2] + '"></i>'; }).join('') + '</div>' : '') +
    (items.length ? '<div class="evtot ' + (tot === 100 ? 'evok' : 'evng') + '">合計 ' + tot + '%' +
      (tot === 100 ? ' ✓' : tot < 100 ? '（あと' + Math.round((100 - tot) * 10) / 10 + '%）' : '（' + Math.round((tot - 100) * 10) / 10 + '%多い）') + '</div>' : '') +
    '<div class="field" style="margin-top:8px"><label class="f" for="sy_memo">評価のメモ</label><textarea id="sy_memo" placeholder="例：出席2/3以上で受験資格">' + esc(courseDraftOf(name, 'memo', sy.memo || '')) + '</textarea></div>' +
    '<button class="btn' + (dirty ? '' : ' ghost') + '" data-act="eval-save" data-name="' + esc(name) + '">' + (dirty ? '保存する（まだ保存していません）' : '保存する') + '</button>';
  return section('評価の割合', items.length ? '合計' + tot + '%' : null, h);
}

/* 評価の割合を保存する（ボタンでも、書きかえて欄をはなれたときでも） */
function evalSaveNow(name){
  var its = evalFromForm(name).map(function(x){
    var nm = String(x.name || '').trim();
    return { name:nm, pct:evalPct(x.pct), kind:evalKindOf(nm) };
  }).filter(function(x){ return x.name; });
  var names = {}, dup = its.filter(function(x){ if(names[x.name]) return true; names[x.name] = 1; return false; });
  if(dup.length) return { ok:false, msg:'「' + dup[0].name + '」が2つあります。名前を変えてください' };
  var sy0 = S.syllabus[name] || {};
  var memoEl = document.getElementById('sy_memo');
  var nx = Object.assign({}, sy0, syllabusLegacy(its), { items:its, memo:memoEl ? memoEl.value : (sy0.memo || ''), mt:Date.now() });
  if(!its.length) delete nx.items;
  S.syllabus[name] = nx;
  evalDraft = null;
  courseDraftKeep(name); courseDraft.memo = null;
  touch('syllabus');
  var tot = Math.round(its.reduce(function(a, x){ return a + x.pct; }, 0) * 10) / 10;
  return { ok:true, msg:'評価の割合を保存しました' + (its.length && tot !== 100 ? '（合計' + tot + '%）' : ''), tot:tot, n:its.length };
}
/* 書きかえて欄をはなれたら、描き直さずにそのまま保存する（打っている途中の欄は動かさない） */
function courseAutoSave(el){
  if(!courseView || appId !== 'course' || !el || !el.id) return;
  var name = courseView;
  if(/^ev_[np]_\d+$/.test(el.id) || el.id === 'sy_memo'){
    /* 名前がまだ空の行があるときは、書きおわるまで待つ（空の行が消えないように） */
    if(evalFromForm(name).some(function(x){ return !String(x.name || '').trim(); })) return;
    var r = evalSaveNow(name);
    var tot = document.querySelector('.evtot'), sv = document.querySelector('[data-act="eval-save"]');
    if(!r.ok){ if(tot){ tot.className = 'evtot evng'; tot.textContent = r.msg; } evalKeepIfChanged(name); return; }
    persist(); pushRemote();
    if(tot){
      tot.className = 'evtot ' + (r.tot === 100 ? 'evok' : 'evng');
      tot.textContent = '合計 ' + r.tot + '%' + (r.tot === 100 ? ' ✓' : r.tot < 100 ? '（あと' + Math.round((100 - r.tot) * 10) / 10 + '%）' : '（' + Math.round((r.tot - 100) * 10) / 10 + '%多い）');
    }
    if(sv){ sv.className = 'btn ghost'; sv.textContent = '保存しました ✓'; }
    return;
  }
  if(el.id === 'sy_text'){
    var sy1 = S.syllabus[name] || {};
    if(String(sy1.text || '') === el.value) return;
    S.syllabus[name] = Object.assign({}, sy1, { text:el.value.slice(0, 60000), mt:Date.now() });
    if(courseDraft.name === name) courseDraft.text = null;
    touch('syllabus'); persist(); pushRemote();
    toast('シラバスの文章を保存しました');
  }
}
document.addEventListener('change', function(e){ try{ courseAutoSave(e.target); }catch(err){} });

/* 保存してあるシラバスのくわしい中身（担当の先生・評価のうちわけ・授業計画・教科書） */
function syllabusMore(sy){
  sy = sy || {};
  /* 成績の付け方は「評価の割合」に出すので、ここには出さない */
  var plan = Array.isArray(sy.plan) ? sy.plan : [], books = Array.isArray(sy.books) ? sy.books : [];
  if(!sy.teacher && !plan.length && !books.length) return '';
  return '<div class="sylmore" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--rule)">'+
    (sy.teacher ? '<div class="row"><div class="grow s">担当の先生</div><div class="t">'+esc(sy.teacher)+'</div></div>' : '')+
    (plan.length ? '<details style="margin-top:6px"><summary class="s">授業計画（'+plan.length+'回）</summary>'+
      plan.map(function(p){ return '<div class="row"><span class="b cr">'+esc(p.no ? '第'+p.no+'回' : '・')+'</span><div class="grow t">'+esc(p.title)+'</div></div>'; }).join('')+'</details>' : '')+
    (books.length ? '<div class="row"><div class="grow"><div class="s">教科書・参考書</div>'+books.map(function(b){
      return '<div class="t">'+esc(b.title)+(b.author ? '<span class="s2">（'+esc(b.author)+'）</span>' : '')+(b.need ? '<span class="b cat" style="margin-left:6px">'+esc(b.need)+'</span>' : '')+'</div>';
    }).join('')+'</div></div>' : '')+
  '</div>';
}
function gpaOf(termIds){
  var pts = { S:4, A:3, B:2, C:1, D:0 };
  var sum = 0, cr = 0, earned = 0;
  termIds.forEach(function(id){
    var t = termOf(id);
    (t.courses||[]).forEach(function(c){
      var g = S.grades[c.name];
      if(!g || !(g.grade || g.score)) return;
      var p;
      if(typeof cpGpOf === 'function'){ var o = cpGpOf(g.grade || g.score); p = o.key ? o.gp : null; if(o.pass && o.gp == null){ earned += (Number(c.cr)||0); return; } }
      else p = pts[String(g.grade).toUpperCase().charAt(0)];
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
  if(act==='att-set'){ if(courseView) courseKeepAll(t.dataset.name); setAttend(t.dataset.name, t.dataset.date, t.dataset.st); commit(); return true; }
  if(act==='att-set-date'){
    courseKeepAll(t.dataset.name);
    var nm5 = t.dataset.name, d5 = readMd('at_'+nm5), st5 = val('atst_'+nm5);
    if(!d5){ toast('日付を選んでください', true); return true; }
    setAttend(nm5, d5, st5); toast(ymdLabel(d5)+' を'+st5+'で記録'); commit(); return true;
  }
  if(act==='course-meta-save'){
    courseKeepAll(t.dataset.name);
    var nm6 = t.dataset.name, cm6 = S.courseMeta[nm6] || {};
    cm6.total = Math.max(1, toNum(val('cm_total'))); cm6.evalAbsent = Math.max(1, toNum(val('cm_limit')));
    S.courseMeta[nm6] = cm6; touch('courseMeta'); toast('保存しました'); commit(); return true;
  }
  if(act==='course-range-save'){
    courseKeepAll(t.dataset.name);
    var nm7 = t.dataset.name, cm7 = S.courseMeta[nm7] || {};
    cm7.range = val('cm_range'); S.courseMeta[nm7] = cm7; touch('courseMeta'); toast('保存しました'); commit(); return true;
  }
  /* シラバスを見る（文章・写真・PDF をまとめて、アプリの中で） */
  if(act==='syl-view'){ courseKeepAll(t.dataset.name); sylViewOpen(t.dataset.name, t.dataset.pid || ''); return true; }
  /* 授業の画面の並べ替え */
  if(act==='course-sort'){ courseKeepAll(courseView); courseSortOpen = !courseSortOpen; render(); return true; }
  if(act==='course-sort-reset'){
    courseKeepAll(courseView);
    S.ui.pageOrder = S.ui.pageOrder || {}; S.ui.pageHide = S.ui.pageHide || {};
    delete S.ui.pageOrder.coursedt; delete S.ui.pageHide.coursedt;
    touch('ui'); toast('はじめの並びにもどしました'); commit(); return true;
  }
  /* シラバス：文章を保存 */
  if(act==='syl-text-save'){
    var nmS = t.dataset.name, syS = S.syllabus[nmS] || {};
    courseKeepAll(nmS); courseDraft.text = null;
    S.syllabus[nmS] = Object.assign({}, syS, { text:val('sy_text').slice(0, 60000), mt:Date.now() });
    touch('syllabus'); toast('シラバスを保存しました'); commit(); return true;
  }
  /* シラバス：写真・PDFを足す（写真は読める大きさに小さく。PDFは10MBまで） */
  if(act==='syl-file-add'){
    var nmF = t.dataset.name;
    courseKeepAll(nmF);
    var el0 = document.getElementById('sy_text'), keepText = el0 ? el0.value : null;
    var inpF = document.createElement('input');
    inpF.type = 'file'; inpF.accept = 'image/*,.pdf,application/pdf'; inpF.multiple = true;
    inpF.onchange = async function(){
      var fl = Array.prototype.slice.call(inpF.files || [], 0, 12), okF = 0, ngF = [];
      for(var i = 0; i < fl.length; i++){
        var f = fl[i], isPdf = /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);
        try{
          var du;
          if(isPdf){
            if(f.size > SYL_PDF_MAX) throw new Error('PDFは10MBまでです');
            du = await new Promise(function(res, rej){ var r = new FileReader(); r.onload = function(){ res(r.result); }; r.onerror = function(){ rej(new Error('読めませんでした')); }; r.readAsDataURL(f); });
            du = du.replace(/^data:[^;,]*/, 'data:application/pdf');
          }else{
            du = await resizeImage(f, 2000, 0.85);
          }
          var pidF = uid('syl');
          await photoPut(pidF, du);
          var syF = S.syllabus[nmF] || {};
          var files = syllabusFiles(syF).concat([{ pid:pidF, name:String(f.name || (isPdf ? 'シラバス.pdf' : 'シラバスの写真')).slice(0, 80), kind:isPdf ? 'pdf' : 'photo', size:isPdf ? f.size : du.length }]);
          S.syllabus[nmF] = Object.assign({}, syF, { files:files, mt:Date.now() });
          okF++;
        }catch(e){ ngF.push(f.name + '：' + e.message); }
      }
      /* 書いていた文章も、いっしょに保存する */
      var syK = S.syllabus[nmF] || {};
      if(keepText != null && String(syK.text || '') !== keepText) S.syllabus[nmF] = Object.assign({}, syK, { text:keepText.slice(0, 60000) });
      if(courseDraft.name === nmF) courseDraft.text = null;
      touch('syllabus');
      toast(okF ? okF + 'つ保存しました' + (ngF.length ? '（' + ngF.join('／') + '）' : '') : '保存できませんでした：' + ngF.join('／'), !okF);
      commit();
    };
    inpF.click();
    return true;
  }
  if(act==='syl-file-del'){
    var nmD = t.dataset.name, pidD = t.dataset.pid, syD = S.syllabus[nmD] || {};
    if(!confirm('このファイルを消しますか？')) return true;
    courseKeepAll(nmD);
    S.syllabus[nmD] = Object.assign({}, syD, { files:syllabusFiles(syD).filter(function(f){ return f.pid !== pidD; }), mt:Date.now() });
    photoDel(pidD);
    touch('syllabus'); toast('消しました'); commit(); return true;
  }
  /* 評価の割合：項目を足す・消す・保存 */
  if(act==='eval-add'){
    var nmA = t.dataset.name, itsA = evalFromForm(nmA), vA = t.dataset.v || '';
    courseDraftKeep(nmA);
    itsA.push({ name:vA, pct:'', kind:evalKindOf(vA) });
    render();
    var focusA = document.getElementById((vA ? 'ev_p_' : 'ev_n_') + (itsA.length - 1));
    if(focusA) try{ focusA.focus(); }catch(e){}
    return true;
  }
  if(act==='eval-del'){
    var nmR = t.dataset.name, itsR = evalFromForm(nmR);
    courseDraftKeep(nmR);
    itsR.splice(toNum(t.dataset.i), 1);
    render(); return true;
  }
  if(act==='eval-save'){
    var rV = evalSaveNow(t.dataset.name);
    if(!rV.ok){ toast(rV.msg, true); return true; }
    toast(rV.msg); commit(); return true;
  }
  /* 出欠：くわしい記録をひらく・記録を消す */
  if(act==='att-more'){ courseKeepAll(t.dataset.name); attMore[t.dataset.name] = !attMore[t.dataset.name]; render(); return true; }
  if(act==='att-log-del'){
    if(!confirm(ymdLabel(t.dataset.date) + ' の記録を消しますか？')) return true;
    courseKeepAll(t.dataset.name);
    setAttend(t.dataset.name, t.dataset.date, ''); commit(); return true;
  }
  if(act==='grade-save'){
    courseKeepAll(t.dataset.name);
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

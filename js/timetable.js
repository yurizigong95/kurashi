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
    '</div>'+
    (c.bi ? '<div class="pair" style="margin-top:10px"><div>'+mdPicker('bw_'+name, S.biweek[name]||'', '隔週の基準日（授業がある日を1回選ぶ）', true)+'</div>'+
      '<button class="btn ghost" style="flex:0 0 auto;align-self:flex-end" data-act="biweek-save" data-name="'+esc(name)+'">保存</button></div>'+
      (isYmd(S.biweek[name]) ? '<p class="note">今週は'+(biweekOn(name, td)?'あります':'ありません')+'。</p>' : '') : '')+
    '</div>';

  /* 出欠（スマホで場所をとらないように、まとめる。くわしい記録と設定は、たたんでおく） */
  h += attendSection(name, at, td, todayCls);

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

  /* シラバス（保存しておく）と、評価の割合（自分で登録） */
  var sy = S.syllabus[name] || {};
  h += syllabusSection(name, sy);
  h += evalSection(name, sy);

  /* 成績の見込み（シラバスの割合＋自分の点） */
  if(typeof cpForecastSection === 'function') h += cpForecastSection(name);

  /* 成績 */
  h += section('成績', gr.grade ? esc(gr.grade) : null,
    '<div class="pair"><div><label class="f">評価（秀・優・良・可・不可／S・A・B・C・D など）</label><input id="gr_grade" value="'+esc(gr.grade||'')+'" placeholder="優"></div>'+
      '<div><label class="f">点数（任意）</label><input id="gr_score" inputmode="numeric" value="'+esc(gr.score||'')+'"></div>'+
      '<button class="btn ghost" style="flex:0 0 auto;align-self:flex-end" data-act="grade-save" data-name="'+esc(name)+'">保存</button></div>'+
    '<p class="note">GPAの計算：'+esc(typeof cpGpText === 'function' ? cpGpText() : 'S=4、A=3、B=2、C=1、D=0')+' として単位で重みづけします（授業タブの「GPAと単位」で変えられます）。</p>');

  /* メモ */
  h += section('この科目のメモ', notes.length ? notes.length+'件' : null,
    (notes.length ? notes.map(noteRow).join('') : '<div class="empty">メモはまだありません。</div>')+
    '<button class="btn ghost" style="margin-top:10px" data-act="note-new" data-link-type="course" data-link-id="'+esc(name)+'">この科目のメモを作る</button>');

  h += '<button class="btn ghost" style="margin-top:6px;color:var(--rakuten)" data-act="course-remove" data-name="'+esc(name)+'">この科目を学期から外す</button>';
  return h;
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
function syllabusSection(name, sy){
  var files = syllabusFiles(sy), text = String(courseDraftOf(name, 'text', sy.text || ''));
  var saved = text.trim() || files.length;
  var imgs = files.filter(function(f){ return f.kind !== 'pdf'; }), pdfs = files.filter(function(f){ return f.kind === 'pdf'; });
  var h = '<div class="field"><label class="f" for="sy_text">シラバスの文章（大学のページからコピーして貼りつけ）</label>' +
      '<textarea id="sy_text" style="min-height:' + (text ? 140 : 80) + 'px" placeholder="「授業の目的」「授業計画」「成績評価の方法」「教科書」などを、そのまま貼りつけて保存できます">' + esc(text) + '</textarea></div>' +
    (imgs.length ? '<div class="mphotos syl-imgs">' + imgs.map(function(f){
      return '<div class="mphoto"><img data-pid="' + esc(f.pid) + '" alt="' + esc(f.name || 'シラバスの写真') + '" data-act="memo-photo-view" data-id="' + esc(f.pid) + '">' +
        '<button class="mini" data-act="syl-file-del" data-name="' + esc(name) + '" data-pid="' + esc(f.pid) + '" aria-label="消す">×</button></div>';
    }).join('') + '</div>' : '') +
    (pdfs.length ? pdfs.map(function(f){
      return '<div class="syl-pdf"><span class="syl-ic" aria-hidden="true">📄</span><span class="grow"><span class="t">' + esc(f.name || 'シラバス.pdf') + '</span>' +
        '<span class="s2">' + (f.size ? Math.max(1, Math.round(f.size / 1024)) + 'KB' : '') + '</span></span>' +
        '<a class="mini" data-pidlink="' + esc(f.pid) + '" download="' + esc(f.name || 'syllabus.pdf') + '" target="_blank" rel="noopener">ひらく</a>' +
        '<button class="mini" data-act="syl-file-del" data-name="' + esc(name) + '" data-pid="' + esc(f.pid) + '" aria-label="消す">×</button></div>';
    }).join('') : '') +
    '<div class="pair" style="margin-top:8px">' +
      '<button class="btn" data-act="syl-text-save" data-name="' + esc(name) + '">保存</button>' +
      '<button class="btn ghost" data-act="syl-file-add" data-name="' + esc(name) + '">📷 写真・PDF</button></div>' +
    (sy.url ? '<p class="note">前に入れたリンク：<a href="' + esc(sy.url) + '" target="_blank" rel="noopener">シラバスのページをひらく</a></p>' : '') +
    syllabusMore(sy) +
    syllabusAiBox(name, saved);
  return section('シラバス', saved ? '保存してあります' + (files.length ? '（' + files.length + 'ファイル）' : '') : null, h);
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
  var h = (rows ? '<div class="evlist">' + rows + '</div>' : '<div class="s2" style="margin-bottom:8px">テスト・レポートなど、成績の付け方を下から足して、割合（%）を入れてください。</div>') +
    '<div class="pillrow evpre">' +
      EVAL_PRESETS.filter(function(p){ return !used[p]; }).map(function(p){
        return '<button data-act="eval-add" data-name="' + esc(name) + '" data-v="' + esc(p) + '">＋ ' + esc(p) + '</button>';
      }).join('') +
      '<button data-act="eval-add" data-name="' + esc(name) + '" data-v="">＋ 自分で入れる</button></div>' +
    (segs.length ? '<div class="evbar" role="img" aria-label="' + esc(segs.map(function(x){ return x[0] + ' ' + x[1] + '%'; }).join('、')) + '">' +
        segs.map(function(x){ return '<i style="flex:' + x[1] + ';background:' + x[2] + '"></i>'; }).join('') + '</div>' : '') +
    (items.length ? '<div class="evtot ' + (tot === 100 ? 'evok' : 'evng') + '">合計 ' + tot + '%' +
      (tot === 100 ? ' ✓' : tot < 100 ? '（あと' + Math.round((100 - tot) * 10) / 10 + '%）' : '（' + Math.round((tot - 100) * 10) / 10 + '%多い）') + '</div>' : '') +
    '<div class="field" style="margin-top:8px"><label class="f" for="sy_memo">評価のメモ</label><textarea id="sy_memo" placeholder="例：出席2/3以上で受験資格">' + esc(courseDraftOf(name, 'memo', sy.memo || '')) + '</textarea></div>' +
    '<button class="btn' + (dirty ? '' : ' ghost') + '" data-act="eval-save" data-name="' + esc(name) + '">' + (dirty ? '保存する（まだ保存していません）' : '保存') + '</button>';
  return section('評価の割合', items.length ? '合計' + tot + '%' : null, h);
}

/* ===== シラバス（文章・写真・PDF・URL）から、評価の割合・授業計画・教科書・担当の先生・テストの日をAIが読み取る ===== */
var sylAi = { name:'', busy:false, result:null, err:'', files:[], fileNames:[] };
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
function syllabusAiBox(name, saved){
  var r = (sylAi.name === name) ? sylAi.result : null;
  var h = '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--rule)">'+
    '<button class="btn ghost" data-act="syl-ai" data-name="'+esc(name)+'"'+(sylAi.busy?' disabled':'')+'>'+
      (sylAi.busy && sylAi.name === name ? '読み取っています…' : '✨ 保存したシラバスから、AIで評価の割合・授業計画・テストの日を読み取る')+'</button>'+
    (sylAi.err && sylAi.name === name ? '<p class="note" style="color:var(--rakuten)">'+esc(sylAi.err)+'</p>' : '');
  if(r){
    var pct = [['テスト', r.exam], ['レポート', r.report], ['出席・平常点', r.attend], ['そのほか', r.other]]
      .filter(function(x){ return x[1] != null && x[1] !== ''; });
    h += '<div class="box" style="margin-top:10px;background:rgba(255,255,255,.4)">'+
      '<div class="t" style="font-weight:700;margin-bottom:6px">読み取った内容（まだ保存していません）</div>'+
      (r.teacher ? '<div class="s2" style="margin-bottom:4px">担当の先生：'+esc(r.teacher)+'</div>' : '')+
      ((r.items||[]).length ? '<div class="s2" style="margin-bottom:6px">成績の付け方：'+r.items.map(function(x){ return esc(x.name)+' '+x.pct+'%'; }).join('・')+'</div>'
        : (pct.length ? '<div class="s2" style="margin-bottom:6px">'+pct.map(function(x){ return esc(x[0])+' '+toNum(x[1])+'%'; }).join('　')+'</div>' : '<div class="s2">評価の割合は見つかりませんでした。</div>'))+
      (r.other_detail ? '<div class="s2">そのほかの中身：'+esc(r.other_detail)+'</div>' : '')+
      (r.notes ? '<div class="s2" style="margin-bottom:6px">条件：'+esc(r.notes)+'</div>' : '')+
      ((r.plan||[]).length ? '<details style="margin:6px 0"><summary class="s2">授業計画 '+r.plan.length+'回ぶん</summary>'+
        r.plan.map(function(p){ return '<div class="s2">'+esc(p.no ? '第'+p.no+'回　' : '')+esc(p.title)+'</div>'; }).join('')+'</details>' : '')+
      ((r.tests||[]).length
        ? '<label class="f" style="margin-top:6px">テスト・小テスト</label>'+r.tests.map(function(x, i){
            return '<label class="row" style="gap:8px"><input type="checkbox" class="syl-pick" data-i="'+i+'"'+(isYmd(x.date)?' checked':'')+' style="width:auto">'+
              '<div class="grow"><div class="t">'+esc(x.title || 'テスト')+'<span class="b cat" style="margin-left:6px">'+(x.kind==='quiz'?'小テスト':'大テスト')+'</span></div>'+
              '<div class="s">'+(isYmd(x.date) ? ymdLabel(x.date) : '日付なし'+(x.week ? '（'+esc(x.week)+'）' : '')+'　→ 追加したあと「直す」で日付を入れてください')+'</div></div></label>';
          }).join('')
        : '<div class="s2">テストの日は見つかりませんでした。</div>')+
      ((r.books||[]).length
        ? '<label class="f" style="margin-top:6px">教科書（チェックしたものを「教科書」の買う予定に足す）</label>'+r.books.map(function(b, i){
            return '<label class="row" style="gap:8px"><input type="checkbox" class="syl-book" data-i="'+i+'"'+(b.need !== '参考' ? ' checked' : '')+' style="width:auto">'+
              '<div class="grow"><div class="t">'+esc(b.title)+'</div><div class="s">'+esc([b.author, b.isbn ? 'ISBN '+b.isbn : '', b.need].filter(Boolean).join('・'))+'</div></div></label>';
          }).join('') : '')+
      '<div class="pair" style="margin-top:10px"><button class="btn" data-act="syl-apply" data-name="'+esc(name)+'">保存して、選んだものを入れる</button>'+
      '<button class="btn ghost" style="flex:0 0 auto;padding:11px 14px" data-act="syl-cancel">やめる</button></div>'+
      '</div>';
  }
  h += '<p class="note">AIで読み取るときは、保存した文章・写真・PDFがGoogleのAIに送られます（シラバス以外のもの・個人の情報は入れないでください）。割合は「評価の割合」に入り、テストは「大テスト／小テスト」として予定に入ります。AIはまちがえることがあるので、保存する前にたしかめてください。</p></div>';
  return h;
}
/* ページの文字だけを取り出す（HTMLのタグ・スクリプトを外す） */
function syllabusPageText(html){
  var s = String(html || '');
  s = s.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return s.replace(/[ \t　]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
/* opt … { files:[dataUrl], url } */
async function syllabusRead(name, opt){
  opt = opt || {};
  var el = document.getElementById('sy_text');
  var text = (el ? el.value : String((S.syllabus[name] || {}).text || '')).trim();
  /* 書いた文章は、先に保存しておく */
  if(el){ var sy1 = S.syllabus[name] || {}; if(String(sy1.text || '') !== el.value){ S.syllabus[name] = Object.assign({}, sy1, { text:el.value.slice(0, 60000), mt:Date.now() }); touch('syllabus'); persist(); } }
  var files = opt.files || [];
  if(!opt.files){
    var saved = syllabusFiles(S.syllabus[name]);
    for(var fi = 0; fi < saved.length; fi++){ var du = await photoGet(saved[fi].pid); if(du) files.push(du); }
  }
  var url = String(opt.url || '').trim();
  if(!text && !files.length && !url){ toast('先にシラバスの文章を貼るか、写真・PDFを足して保存してください', true); return; }
  if(!aiReady()){ toast('先に設定タブでGemini APIキーを登録してください', true); return; }
  sylAi = { name:name, busy:true, result:null, err:'', files:files, fileNames:sylAi.fileNames || [] };
  render();
  try{
    if(url){
      if(!/^https?:\/\//i.test(url)) throw new Error('URLは https:// からはじまるものを入れてください');
      /* 大学のページは、アプリから直接読めない（橋わたしでも読めない場所）ことが多いので、わかる言葉で知らせる */
      var raw;
      try{ raw = await apiGet(url); }
      catch(e0){ throw new Error('このページは読めませんでした（' + e0.message + '）。大学のシラバスのページは、アプリから読めないことが多いので、ページの文章をコピーして貼るか、写真・PDFで読んでください'); }
      var page = syllabusPageText(raw);
      if(page.length < 20) throw new Error('ページの中身を読めませんでした（ログインが必要なページかもしれません。文章をコピーして貼ってください）');
      text = (text ? text + '\n' : '') + page;
    }
    var t = curTerm();
    var r = await aiJson(
      'つぎは大学の授業「' + name + '」のシラバス' + (files.length ? '（写真・PDF）' : 'の文章') + 'です。JSONだけを返してください。\n' +
      '{"exam":期末・中間テストの割合(数字。%は付けない。なければnull),"report":レポート・課題の割合,"attend":出席・平常点・授業態度の割合,' +
      '"other":そのほか(小テスト・発表など)の割合,"other_detail":"そのほかの中身を短く",' +
      '"items":[{"name":"評価の項目（期末試験・小テスト・レポート・出席 など）","pct":割合(数字),"kind":"exam|quiz|report|attend|other"}],' +
      '"teacher":"担当の先生の名前（何人もいれば「、」で区切る。なければ空）",' +
      '"plan":[{"no":回の番号,"title":"その回の内容を短く"}],' +
      '"books":[{"title":"教科書の名前","author":"著者","isbn":"ISBN（数字だけ。なければ空）","need":"必須 または 参考"}],' +
      '"notes":"単位をとる条件（例：出席2/3以上で受験資格）を短く。なければ空",' +
      '"tests":[{"title":"中間試験 など","kind":"exam(中間・期末) または quiz(小テスト)","date":"YYYY-MM-DD。書いていなければnull","week":"第何回か（日付がないとき。なければ空）"}]}\n' +
      '・割合が書いていないものは null。合計が100にならなくてもよい。書いていないものは空の配列にする。\n' +
      '・今は' + today() + '、学期は「' + t.label + '」。年が書いていない日付は、この学期の中の日にする。\n' +
      (text ? '【シラバス】\n' + text.slice(0, 20000) : ''), files, (files.length || url) ? 'cp-syl' : 'syllabus');
    r = r || {};
    r.tests = (Array.isArray(r.tests) ? r.tests : []).map(function(x){
      x = x || {};
      var d = String(x.date || '');
      var m = d.match(/(\d{1,2})[-\/月](\d{1,2})/);
      if(!isYmd(d) && m) d = guessYear(+m[1], +m[2]) + '-' + pad(+m[1]) + '-' + pad(+m[2]);
      if(!isYmd(d)) d = syllabusWeekDate(name, x.week) || '';
      return { title:String(x.title || 'テスト').slice(0, 40), kind:(x.kind === 'quiz' ? 'quiz' : 'exam'), date:d, week:String(x.week || '') };
    });
    var kinds = { exam:1, quiz:1, report:1, attend:1, other:1 };
    r.items = (Array.isArray(r.items) ? r.items : []).map(function(x){
      x = x || {};
      return { name:String(x.name || '').slice(0, 30), pct:toNum(x.pct), kind:kinds[x.kind] ? x.kind : 'other' };
    }).filter(function(x){ return x.name && x.pct > 0; }).slice(0, 12);
    /* うちわけがあって、大まかな割合がないときは、うちわけから足して出す */
    if(r.items.length && [r.exam, r.report, r.attend, r.other].every(function(v){ return v == null || v === ''; })){
      var sum = function(k){ var s = 0, hit = false; r.items.forEach(function(x){ if(k.indexOf(x.kind) >= 0){ s += x.pct; hit = true; } }); return hit ? s : null; };
      r.exam = sum(['exam']); r.report = sum(['report']); r.attend = sum(['attend']); r.other = sum(['quiz', 'other']);
    }
    r.teacher = String(r.teacher || '').slice(0, 60);
    r.plan = (Array.isArray(r.plan) ? r.plan : []).map(function(p, i){
      p = p || {};
      return { no:toNum(p.no) || (i + 1), title:String(p.title || '').slice(0, 80) };
    }).filter(function(p){ return p.title; }).slice(0, 40);
    r.books = (Array.isArray(r.books) ? r.books : []).map(function(b){
      b = b || {};
      return { title:String(b.title || '').slice(0, 100), author:String(b.author || '').slice(0, 60),
               isbn:String(b.isbn || '').replace(/[^0-9Xx]/g, '').slice(0, 13), need:/参考/.test(String(b.need || '')) ? '参考' : '必須' };
    }).filter(function(b){ return b.title; }).slice(0, 10);
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
  var sy = S.syllabus[name];
  if(r.teacher) sy.teacher = r.teacher;
  /* 評価の割合は、項目（名前＋％）の形で入れる。うちわけがなければ、大まかな割合から作る */
  var its = (r.items || []).length ? r.items
    : [['テスト', r.exam, 'exam'], ['レポート', r.report, 'report'], ['出席・平常点', r.attend, 'attend'], ['そのほか', r.other, 'other']]
      .filter(function(a){ return toNum(a[1]) > 0; }).map(function(a){ return { name:a[0], pct:toNum(a[1]), kind:a[2] }; });
  if(its.length){ sy.items = its; Object.assign(sy, syllabusLegacy(its)); }
  evalDraft = null;
  if((r.plan || []).length) sy.plan = r.plan;
  if((r.books || []).length) sy.books = r.books;
  var picks = Array.prototype.map.call(document.querySelectorAll('.syl-pick'), function(el){ return el.checked ? toNum(el.dataset.i) : -1; })
    .filter(function(i){ return i >= 0; });
  var added = 0, nb = 0;
  picks.forEach(function(i){
    var x = r.tests[i]; if(!x) return;
    var date = isYmd(x.date) ? x.date : today();
    var dup = S.exams.some(function(e){ return sameSubject(e.subject, name) && e.date === date && (e.title||'') === x.title; });
    if(dup) return;
    S.exams.push({ id:uid('ex'), subject:name, title:x.title + (isYmd(x.date) ? '' : '（日付を入れてください）'), date:date, time:'',
      room:'', kind:x.kind, photos:[], rid:'', mt:Date.now() });
    added++;
  });
  /* 教科書は「教科書」の一覧（S.books）に、買う予定として足す */
  Array.prototype.forEach.call(document.querySelectorAll('.syl-book'), function(el){
    if(!el.checked) return;
    var b = (r.books || [])[toNum(el.dataset.i)]; if(!b) return;
    S.books = Array.isArray(S.books) ? S.books : [];
    if(S.books.some(function(x){ return (b.isbn && x.isbn === b.isbn) || (x.title === b.title && sameSubject(x.course, name)); })) return;
    S.books.push({ id:uid('bk'), mt:Date.now(), title:b.title, author:b.author, isbn:b.isbn, course:name, status:'買う予定' });
    nb++;
  });
  sylAi = { name:'', busy:false, result:null, err:'', files:[], fileNames:[] };
  touch('syllabus');
  toast('保存しました' + (added || nb ? '（' + [added ? 'テスト' + added + '件を予定に' : '', nb ? '教科書' + nb + '冊を買う予定に' : ''].filter(Boolean).join('・') + '入れました）' : ''));
  commit();
}

/* GPA（学期ごと・累積）。GPの付け方は授業タブの「GPAと単位」（cpGpOf）に合わせる */
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
  if(act==='syl-ai'){ syllabusRead(t.dataset.name); return true; }
  if(act==='syl-apply'){ syllabusApply(t.dataset.name); return true; }
  if(act==='syl-cancel'){ sylAi = { name:'', busy:false, result:null, err:'', files:[], fileNames:[] }; render(); return true; }
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
    var nmV = t.dataset.name, itsV = evalFromForm(nmV).map(function(x){
      var nm = String(x.name || '').trim();
      return { name:nm, pct:evalPct(x.pct), kind:evalKindOf(nm) };
    }).filter(function(x){ return x.name; });
    var names = {}, dup = itsV.filter(function(x){ if(names[x.name]) return true; names[x.name] = 1; return false; });
    if(dup.length){ toast('「' + dup[0].name + '」が2つあります。名前を変えてください', true); return true; }
    var syV = S.syllabus[nmV] || {};
    var nxV = Object.assign({}, syV, syllabusLegacy(itsV), { items:itsV, memo:val('sy_memo'), mt:Date.now() });
    if(!itsV.length) delete nxV.items;
    S.syllabus[nmV] = nxV;
    evalDraft = null;
    courseDraftKeep(nmV); courseDraft.memo = null;
    var totV = Math.round(itsV.reduce(function(a, x){ return a + x.pct; }, 0) * 10) / 10;
    touch('syllabus'); toast('評価の割合を保存しました' + (itsV.length && totV !== 100 ? '（合計' + totV + '%）' : '')); commit(); return true;
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

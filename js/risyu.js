/* くらしの手帳：履修 */
/* ============================== 履修：索引 ============================== */
var byCode = {};
COURSES.forEach(function(c){
  byCode[c.code] = c;
  c.key = norm(c.name + ' ' + c.teacher + ' ' + c.code);
});
var fixedMap = {};
FIXED.forEach(function(f){ f.slots.forEach(function(s){ fixedMap[s.d + s.p] = f; }); });
var slotHas = {};
COURSES.forEach(function(c){ c.slots.forEach(function(s){ var k=s.d+s.p; slotHas[k]=(slotHas[k]||0)+1; }); });

function rSelected(){ return S.risyu.selected.map(function(code){ return byCode[code]; }).filter(Boolean); }
function rIsSelected(code){ return S.risyu.selected.indexOf(code) >= 0; }
function selectedSlotMap(exceptCode){
  var m = {};
  rSelected().forEach(function(c){
    if(c.code === exceptCode) return;
    c.slots.forEach(function(s){ m[s.d + s.p] = c; });
  });
  return m;
}
function hardBlockers(c){
  var out = [];
  c.slots.forEach(function(s){
    var k = s.d + s.p;
    if(fixedMap[k] && !rIncludeOcc) out.push(k + '「' + fixedMap[k].name + '」と重複');
  });
  return out;
}
function swapTargets(c){
  var m = selectedSlotMap(c.code), out = [];
  c.slots.forEach(function(s){
    var o = m[s.d + s.p];
    if(o && out.indexOf(o) < 0) out.push(o);
  });
  return out;
}
function conflicts(c){
  return hardBlockers(c).concat(swapTargets(c).map(function(o){ return '「' + o.name + '」と重複'; }));
}
function ratioClass(r){ return r < 0.5 ? 'r0' : r < 1 ? 'r1' : r < 2 ? 'r2' : 'r3'; }
function ratioText(r){
  var t = r < 0.5 ? '◎ 余裕' : r < 1 ? '○ 定員内' : r < 2 ? '△ 半々' : '▲ 激戦';
  return t + ' ' + r.toFixed(2) + '倍';
}

/* ============================== 履修：単位集計 ============================== */
function tally(){
  var t = { kyoyo:0, topic:0, lang:0, langEn:0, info:0, health:0, pe:0, term:0 };
  FIXED.forEach(function(f){
    if(!f.cat) return;
    var g = CAT_INFO[f.cat] ? CAT_INFO[f.cat].group : null;
    if(g) t[g] += f.cr;
  });
  rSelected().forEach(function(c){
    t[CAT_INFO[c.cat].group] += c.cr;
    if(c.en) t.langEn += c.cr;
    t.term += c.cr;
  });
  return t;
}
var REQS = [
  {key:'total',  name:'共通教育科目 合計',  sub:'3区分あわせて127単位のうち', need:21},
  {key:'kyoyo',  name:'基礎教養科目群',     sub:'人文・社会・自然・国際理解', need:4},
  {key:'topic',  name:'トピック等4群',      sub:'現代トピック／ジェンダー／キャリア', need:6},
  {key:'lang',   name:'言語リテラシー',     sub:'外国語8単位の中心', need:5},
  {key:'langEn', name:'　うち英語',         sub:'言語5単位のうち3単位は英語', need:3},
  {key:'info',   name:'情報リテラシー',     sub:'データリテラシー・ＡＩの基礎を含む', need:2},
  {key:'health', name:'健康・スポーツ科学', sub:'実技ではなく講義のほう', need:1}
];
function metersHtml(){
  var t = tally(), e = S.risyu.earned, html = '';
  var got = {
    kyoyo:t.kyoyo+e.kyoyo, topic:t.topic+e.topic, lang:t.lang+e.lang, langEn:t.langEn+e.langEn,
    info:t.info+e.info, health:t.health+e.health, pe:t.pe+e.pe
  };
  got.total = got.kyoyo+got.topic+got.lang+got.info+got.health+got.pe;
  REQS.forEach(function(r){
    var g = got[r.key], pct = Math.min(100, Math.round(g / r.need * 100));
    html += '<div class="met"><div class="met-n">'+esc(r.name)+'<small>'+esc(r.sub)+'</small></div>'+
      '<div class="bar"><i class="'+(g>=r.need?'done':'')+'" style="width:'+pct+'%"></i></div>'+
      '<div class="met-v"><b>'+g+'</b> / '+r.need+'</div></div>';
  });
  var term = t.term + (Number(S.risyu.otherCr)||0) + 2;
  html += '<div class="met"><div class="met-n">今学期の登録単位<small>キャップ制は25単位以下</small></div>'+
    '<div class="bar"><i class="'+(term>25?'over':'done')+'" style="width:'+Math.min(100,Math.round(term/25*100))+'%"></i></div>'+
    '<div class="met-v"><b>'+term+'</b> / 25</div></div>';
  return html;
}
function warnsHtml(){
  var cs = rSelected(), out = '';
  var term = tally().term + (Number(S.risyu.otherCr)||0) + 2;
  if(term > 25) out += '<div class="msg ng">今学期の登録が'+term+'単位になります。キャップ制の上限は25単位なので、'+(term-25)+'単位ぶん減らしてください。</div>';
  var dup = cs.filter(function(c){ return conflicts(c).length; }).map(function(c){ return c.name; });
  if(dup.length) out += '<div class="msg ng">時間割が重なっています：'+esc(dup.join('、'))+'</div>';
  var hi = cs.filter(function(c){ return c.ratio >= 2; });
  if(hi.length) out += '<div class="msg ng">倍率2倍以上が'+hi.length+'件あります（'+esc(hi.map(function(c){return c.name;}).join('、'))+'）。落ちたときの代わりも決めておくと安心です。</div>';
  return out;
}

/* ============================== 履修：時間割 ============================== */
function courseRow(c){
  var hard = hardBlockers(c), swap = swapTargets(c), sel = rIsSelected(c.code);
  var b = '<span class="b cat">'+esc(CAT_INFO[c.cat].label)+'</span>'+
          '<span class="b cr">'+c.cr+'単位</span>'+
          '<span class="b '+ratioClass(c.ratio)+'">'+ratioText(c.ratio)+'</span>'+
          (c.en ? '<span class="b en">英語</span>' : '');
  if(sel && conflicts(c).length) b += '<span class="b warn">重複あり</span>';
  else if(!sel && hard.length) b += '<span class="b warn">'+esc(hard[0])+'</span>';
  else if(!sel && swap.length) b += '<span class="b r2">'+esc(swap.map(function(o){return o.name;}).join('・'))+'と差し替え</span>';

  return '<div class="crs'+(!sel && hard.length ? ' dis' : '')+'">'+
    '<div class="body"><div class="ct">'+esc(c.name)+'</div>'+
    '<div class="cm">'+esc(c.slotText)+'\u3000'+esc(c.teacher)+'<br>コード '+c.code+'\u3000定員'+c.cap+'／申込'+c.apps+'</div>'+
    '<div class="badges">'+b+'</div></div>'+
    '<button type="button" class="add'+(sel?' rm':'')+'" data-act="r-toggle" data-code="'+c.code+'"'+
      (!sel && hard.length ? ' disabled' : '')+'>'+(sel?'外す':(swap.length?'差し替え':'入れる'))+'</button></div>';
}
function gridHtml(){
  var selMap = selectedSlotMap(null);
  var h = '<thead><tr><th class="pd"></th>';
  DAYS.forEach(function(d){ h += '<th>'+d+'</th>'; });
  h += '</tr></thead><tbody>';
  PERIODS.forEach(function(p){
    var st = S.commute.periods[p-1] || '', en = S.commute.ends[p-1] || '';
    h += '<tr><th class="pd"><span class="pdn">'+p+'</span>'+
         '<span class="pdt">'+esc(st)+'<br>|<br>'+esc(en)+'</span></th>';
    DAYS.forEach(function(d){
      var k = d + p, f = fixedMap[k], s = selMap[k];
      if(f){
        var cm = S.courseMeta[f.name] || {};
        var req = (cm.req != null) ? cm.req : f.req;
        var room = cm.room || f.room || '';
        h += '<td class="'+(req?'reqd':'elec')+'"><button type="button" class="cell" data-act="course-tap" data-name="'+esc(f.name)+'">'+
             '<span class="nm">'+esc(f.name)+'</span>'+
             (f.bi?'<span class="tag">隔週</span>':'')+
             (room?'<span class="room">'+esc(room)+'</span>':'')+'</button></td>';
      }else if(s){
        h += '<td class="sel"><button type="button" class="cell" data-act="r-slot" data-slot="'+k+'">'+
             '<span class="x" data-x="1">外す</span><span class="nm">'+esc(s.name)+'</span>'+
             '<span class="tag">'+esc(s.code)+'・'+s.cr+'単位</span></button></td>';
      }else if(slotHas[k]){
        h += '<td><button type="button" class="cell free" data-act="r-slot" data-slot="'+k+'">＋</button></td>';
      }else{
        h += '<td><span class="cell none free">—</span></td>';
      }
    });
    h += '</tr>';
  });
  return h + '</tbody>';
}
/* 科目ごとの設定（必修／選択・教室） */
function courseSettings(){
  var list = FIXED.map(function(f){ return f; });
  return section('科目の設定', '必修は赤・選択は青',
    list.map(function(f){
      var cm = S.courseMeta[f.name] || {};
      var req = (cm.req != null) ? cm.req : f.req;
      return '<div class="row"><div class="tick" style="background:'+(req?'var(--rakuten)':'var(--e6)')+'"></div>'+
        '<div class="grow"><div class="t">'+esc(f.name)+'</div>'+
        '<div class="s">'+esc(f.slotText)+'・'+f.cr+'単位・'+esc(cm.room || f.room || '教室未設定')+'</div></div>'+
        '<button class="mini" data-act="course-req" data-name="'+esc(f.name)+'">'+(req?'必修':'選択')+'</button>'+
        '<button class="mini" data-act="course-room" data-name="'+esc(f.name)+'">教室</button></div>';
    }).join('')+
    '<p class="note">合計 '+FIXED.reduce(function(a,f){return a+f.cr;},0)+'単位（必修 '+
    FIXED.filter(function(f){ var cm=S.courseMeta[f.name]||{}; return (cm.req!=null?cm.req:f.req); }).reduce(function(a,f){return a+f.cr;},0)+
    '単位）。ボタンを押すと必修と選択を切り替えられます。</p>');
}
function selListHtml(){
  var cs = rSelected();
  if(!cs.length) return '<div class="empty">'+ART.empty+'<div style="margin-top:8px">まだ何も選んでいません。時間割のマスをタップするか「履修案」から読み込んでください。</div></div>';
  var order = {'月':0,'火':1,'水':2,'木':3,'金':4,'土':5};
  cs = cs.slice().sort(function(a,b){
    var A=a.slots[0], B=b.slots[0];
    return (order[A.d]-order[B.d]) || (A.p-B.p);
  });
  return cs.map(courseRow).join('');
}
function codeText(){
  return rSelected().map(function(c){ return c.code + '  ' + c.slotText + '  ' + c.name; }).join('\n');
}
function earnInput(label, key, v){
  return '<label>'+esc(label)+'<input type="number" min="0" step="1" data-earn="'+key+'" value="'+(Number(v)||0)+'"></label>';
}
function viewRisyuTt(){
  var cs = rSelected(), e = S.risyu.earned;
  return section('卒業要件の埋まりぐあい', '選択中の科目を足した状態',
      '<div id="meters">'+metersHtml()+'</div>'+
      '<details style="margin-top:10px;border-top:1px solid var(--rule);padding-top:10px">'+
      '<summary style="font-size:.85em;color:var(--risyu);font-weight:600">すでに修得した単位を入力する</summary>'+
      '<div class="earn-grid">'+
        earnInput('基礎教養科目群','kyoyo',e.kyoyo)+earnInput('トピック等4群','topic',e.topic)+
        earnInput('言語リテラシー','lang',e.lang)+earnInput('うち英語','langEn',e.langEn)+
        earnInput('情報リテラシー','info',e.info)+earnInput('健康・スポーツ科学','health',e.health)+
        earnInput('スポーツ実技ほか','pe',e.pe)+earnInput('今学期の専門・基礎教育','otherCr',S.risyu.otherCr)+
      '</div><p class="note">「今学期の専門・基礎教育」はキャップ制（25単位以下）の計算に使います。</p></details>')
    + '<section><div class="head"><h2>時間割</h2><span>2026年 2学期</span></div>'+
      '<div class="scroll"><table class="tt" id="tt">'+gridHtml()+'</table></div>'+
      '<p class="note">赤は必修、青は選択です。科目をタップすると、その科目の課題をすぐ登録できます。</p>'+
      '</section>' + courseSettings()
    + section('科目から追加する', '課題や小テストをすぐ登録できます',
      '<div class="chips">'+courseList().map(function(c){
        return '<button data-act="course-add" data-name="'+esc(c.name)+'">'+esc(c.name)+'</button>';
      }).join('')+'</div>'+
      '<p class="note">科目をタップすると、その科目の課題としてカレンダーの入力欄が開きます。種類を「小テスト」に変えればテストとして登録できます。</p>')
    + section('選択中の科目', cs.length ? cs.length+'科目 / 計'+cs.reduce(function(a,c){return a+c.cr;},0)+'単位' : null,
      '<div id="warns">'+warnsHtml()+'</div><div id="selList">'+selListHtml()+'</div>'+
      '<div class="pair" style="margin-top:12px"><button class="btn ghost" data-act="r-clear">すべて外す</button>'+
      '<button class="btn ghost" data-act="r-copy">コードをコピー</button></div>'+
      '<textarea class="codebox" id="codebox" readonly>'+esc(codeText())+'</textarea>'+
      '<p class="note">MUSESの抽選登録は「時間割コード」で申し込みます。</p>');
}

/* ============================== 履修：履修案 ============================== */
function viewRisyuPlans(){
  return '<section><div class="head"><h2>履修案</h2><span>タップで時間割に読み込み</span></div>'+
    RISYU_PLANS.map(function(p){
      var cs = p.codes.map(function(c){ return byCode[c]; }).filter(Boolean);
      var cr = cs.reduce(function(a,c){ return a+c.cr; },0);
      var worst = cs.reduce(function(a,c){ return Math.max(a,c.ratio); },0);
      return '<div class="plancard"><h3><em>案'+p.id+'</em>'+esc(p.name)+'</h3>'+
        '<p>'+esc(p.note)+'</p>'+
        '<div class="codes">'+cs.map(function(c){
          return c.slotText+'　'+esc(c.name)+'（'+c.code+'・'+c.ratio.toFixed(2)+'倍）'; }).join('<br>')+'</div>'+
        '<div class="badges" style="margin-top:7px"><span class="b cr">'+cs.length+'科目・'+cr+'単位</span>'+
        '<span class="b '+ratioClass(worst)+'">いちばん高い倍率 '+worst.toFixed(2)+'倍</span></div>'+
        '<button class="btn ghost" style="margin-top:10px" data-act="r-plan" data-plan="'+p.id+'">この案を読み込む</button></div>';
    }).join('')+'</section>';
}

/* ============================== 履修：課題 ============================== */
function dueClass(n){ return n===null?'d3': n<0?'d0': n<=1?'d0': n<=3?'d1': n<=7?'d2':'d3'; }
function dueText(n){
  if(n===null) return '期限なし';
  if(n<0) return (-n)+'日超過';
  if(n===0) return '今日まで';
  if(n===1) return '明日まで';
  return 'あと'+n+'日';
}
/* 予定で選べる科目：いま表示している時間割の科目＋履修シミュの科目 */
function subjectAll(){
  var out = [], seen = {};
  termCourses().forEach(function(c){ if(c.name && !seen[c.name]){ seen[c.name]=1; out.push(c.name); } });
  courseList().forEach(function(c){ if(c.name && !seen[c.name]){ seen[c.name]=1; out.push(c.name); } });
  return out;
}
function subjectOptions(sel){
  var list = subjectAll();
  /* 前に選んだ科目が今の学期にないときも、消えないように残す */
  if(sel && list.indexOf(sel) < 0) list = list.concat([sel]);
  return '<option value="">科目を選ばない</option>' + list.map(function(name){
    return '<option value="'+esc(name)+'"'+(sel===name?' selected':'')+'>'+esc(name)+'</option>';
  }).join('');
}
function viewTasks(){
  var open = S.tasks.filter(function(t){ return !t.done; })
    .map(function(t){ return Object.assign({}, t, {left:isYmd(t.due)?daysFromToday(t.due):null}); })
    .sort(function(a,b){
      if(a.left===null) return 1; if(b.left===null) return -1; return a.left-b.left;
    });
  var done = S.tasks.filter(function(t){ return t.done; });

  return section('やることリスト', open.length?open.length+'件':'すべて片付いています',
    (open.length ? open.map(function(t){
      return '<div class="row"><div class="tick" style="background:'+colorOf(t.color||'c2')+'"></div>'+
        '<button class="chk" data-act="task-done" data-id="'+t.id+'" aria-label="完了"></button>'+
        '<span class="grow"><span class="t">'+esc(t.title)+'</span>'+
        '<span class="s">'+(t.subject?esc(t.subject)+'・':'')+(isYmd(t.due)?ymdLabel(t.due):'期限なし')+(t.time?' '+esc(t.time)+'まで':'')+'</span></span>'+
        '<span class="due '+dueClass(t.left)+'">'+dueText(t.left)+'</span>'+
        '<button class="mini" data-act="ev-edit" data-src="task" data-id="'+t.id+'">直す</button>'+
        '<button class="mini" data-act="del-task" data-id="'+t.id+'">削除</button></div>';
    }).join('') : '<div class="empty">'+ART.empty+'<div style="margin-top:8px">締切の登録はありません。</div></div>')+
    '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--rule)">'+
    '<div class="field"><label class="f">やること・課題名</label><input id="tk_title" placeholder="例：レポート提出"></div>'+
    '<div class="pair" style="margin-bottom:11px">'+
      '<div><label class="f">科目</label><select id="tk_subject">'+subjectOptions('')+'</select></div>'+
      '<div style="flex:0 0 152px">'+mdPicker('tk_due', today(), '締切', false)+'</div></div>'+
    '<div class="field"><label class="f">締切の時刻（任意）</label><input type="time" id="tk_time"></div>'+
    '<button class="btn" data-act="add-task">追加する</button>'+
    '<button class="btn ghost" style="margin-top:8px" data-act="go" data-app="cal" data-tab="cal">カレンダーで色を選んで追加</button></div>')
  + (done.length ? section('終わったもの', done.length+'件',
      done.slice(0,20).map(function(t){
        return '<div class="row done"><button class="chk" style="background:var(--smbc);border-color:var(--smbc)" data-act="task-undone" data-id="'+t.id+'">✓</button>'+
          '<span class="grow"><span class="t">'+esc(t.title)+'</span></span>'+
          '<button class="mini" data-act="del-task" data-id="'+t.id+'">削除</button></div>';
      }).join('')) : '');
}

/* ============================== 履修：テスト ============================== */
function viewExams(){
  var all = S.exams.slice().sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
  var quiz = all.filter(function(x){ return x.kind === 'quiz'; });
  var regular = all.filter(function(x){ return x.kind !== 'quiz'; });
  var next = all.filter(function(x){ return isYmd(x.date) && daysFromToday(x.date) >= 0; })[0];

  var rows = function(list, empty){
    if(!list.length) return '<div class="empty">'+ART.empty+'<div style="margin-top:8px">'+empty+'</div></div>';
    return list.map(function(x){
      var n = isYmd(x.date) ? daysFromToday(x.date) : null;
      return '<div class="row"><div class="tick" style="background:'+colorOf(x.color||'c8')+'"></div>'+
        '<div class="grow"><div class="t">'+esc(x.subject||'テスト')+
          '<span class="b cat" style="margin-left:6px">'+(x.kind==='quiz'?'小テスト':'定期テスト')+'</span></div>'+
        '<div class="s">'+(isYmd(x.date)?ymdLabel(x.date):'日付未設定')+(x.time?' '+esc(x.time):'')+(x.room?'・'+esc(x.room):'')+'</div></div>'+
        '<span class="due '+dueClass(n)+'">'+(n===null?'—':n<0?'終了':dueText(n))+'</span>'+
        '<button class="mini" data-act="ev-edit" data-src="quiz" data-id="'+x.id+'">直す</button>'+
        '<button class="mini" data-act="del-exam" data-id="'+x.id+'">削除</button></div>';
    }).join('');
  };

  return (next ? section('次のテストまで', esc(next.subject||''),
      '<div class="big num">あと '+daysFromToday(next.date)+' 日</div>'+
      '<div class="s" style="margin-top:4px">'+(next.kind==='quiz'?'小テスト・':'定期テスト・')+ymdLabel(next.date)+
      (next.time?' '+esc(next.time):'')+(next.room?'・'+esc(next.room):'')+'</div>') : '')
  + section('小テスト', quiz.length?quiz.length+'件':null,
      rows(quiz, 'カレンダーで種類を「小テスト」にすると、ここに出ます。')+
      '<button class="btn ghost" style="margin-top:12px" data-act="go" data-app="cal" data-tab="cal">カレンダーで小テストを追加</button>')
  + section('定期テスト', regular.length?regular.length+'件':null,
      rows(regular, 'まだありません。下から追加できます。')+
      '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--rule)">'+
      '<div class="field"><label class="f">科目</label><select id="ex_subject">'+subjectOptions('')+'</select></div>'+
      '<div class="pair" style="margin-bottom:11px">'+
        '<div>'+mdPicker('ex_date', today(), '日付', false)+'</div>'+
        '<div style="flex:0 0 110px"><label class="f">時刻</label><input type="time" id="ex_time"></div></div>'+
      '<div class="field"><label class="f">教室・メモ</label><input id="ex_room" placeholder="例：中央図書館ホール"></div>'+
      '<button class="btn" data-act="add-exam">定期テストを追加</button></div>');
}

/* ============================== 履修：出席 ============================== */
function viewAttend(){
  var list = courseList();
  if(!list.length) return section('出席の記録', null, '<div class="empty">科目が登録されていません。</div>');
  return section('出席の記録', '欠席が上限に近づくと知らせます',
    list.map(function(c){
      var a = S.attend[c.key] || { ab:0, late:0, limit:5 };
      var lim = toNum(a.limit)||5, ab = toNum(a.ab), late = toNum(a.late);
      var pct = Math.min(100, Math.round(ab/lim*100));
      var cls = ab>=lim ? 'over' : (lim-ab<=1 ? '' : 'done');
      return '<div style="padding:11px 0;border-bottom:1px solid var(--rule)">'+
        '<div style="display:flex;align-items:center;gap:10px">'+
          '<div class="grow"><div class="t">'+esc(c.name)+'</div>'+
          '<div class="s">欠席 '+ab+' / 上限 '+lim+'　遅刻 '+late+'</div></div>'+
          '<button class="mini" data-act="ab-minus" data-key="'+esc(c.key)+'">−</button>'+
          '<button class="mini" data-act="ab-plus" data-key="'+esc(c.key)+'">欠席+1</button>'+
          '<button class="mini" data-act="late-plus" data-key="'+esc(c.key)+'">遅刻+1</button>'+
        '</div>'+
        '<div class="bar" style="margin-top:7px"><i class="'+cls+'" style="width:'+pct+'%"></i></div></div>';
    }).join('')+
    '<p class="note">上限は「全15回のうち3分の1」を目安に5回で設定しています。科目ごとの規定に合わせて数字は変えられます（下の欄）。</p>'+
    '<div class="pair" style="margin-top:8px">'+
      '<div><label class="f">上限をまとめて変更</label><input id="at_limit" inputmode="numeric" placeholder="5"></div>'+
      '<button class="btn ghost" data-act="set-limit" style="flex:0 0 auto;padding:11px 14px;align-self:flex-end">反映</button></div>');
}

/* ============================== 履修：通年 ============================== */
function viewYear(){
  var later = laterTermMap();
  var first = S.terms.first || {};
  var table = function(title, get, editable){
    var h = '<div class="head" style="margin-bottom:6px"><h2>'+title+'</h2>'+(editable?'<span>マスをタップして入力</span>':'')+'</div>'+
      '<div class="scroll" style="margin-bottom:16px"><table class="tt"><thead><tr><th class="pd"></th>';
    DAYS.forEach(function(d){ h += '<th>'+d+'</th>'; });
    h += '</tr></thead><tbody>';
    PERIODS.forEach(function(p){
      h += '<tr><th class="pd">'+p+'</th>';
      DAYS.forEach(function(d){
        var k = d+p, v = get(k);
        if(editable){
          h += '<td'+(v?' class="sel"':'')+'><button type="button" class="cell" data-act="year-edit" data-slot="'+k+'">'+
               (v ? '<span class="nm">'+esc(v)+'</span>' : '<span class="cell free" style="padding:0">＋</span>')+'</button></td>';
        }else{
          h += '<td'+(v?' class="fx"':'')+'><span class="cell'+(v?'':' none free')+'">'+(v?'<span class="nm">'+esc(v)+'</span>':'—')+'</span></td>';
        }
      });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  };
  return '<section>'+
    table('前期の時間割', function(k){ return first[k]||''; }, true)+
    table('後期の時間割', function(k){ return later[k] ? later[k].name : ''; }, false)+
    '<p class="note">前期は自分で入力します。後期は登録済み科目と、抽選で選んだ科目が自動で入ります。</p>'+
    '</section>';
}

/* ============================== 履修：選択シート ============================== */
function openPicker(k){
  var m = k.match(/^([月火水木金土])([1-7])$/);
  if(!m) return;
  pick.d = m[1]; pick.p = parseInt(m[2],10); pick.cat = 'all'; pick.q = '';
  document.getElementById('shSearch').value = '';
  document.getElementById('veil').classList.add('on');
  document.getElementById('sheet').classList.add('on');
  renderPicker();
}
function closePicker(){
  document.getElementById('veil').classList.remove('on');
  document.getElementById('sheet').classList.remove('on');
}
function sheetOpen(){ return document.getElementById('sheet').classList.contains('on'); }
function renderPicker(){
  document.getElementById('shTitle').textContent = pick.d + '曜 ' + pick.p + '限';
  document.getElementById('shDays').innerHTML = DAYS.map(function(d){
    return '<button type="button" class="'+(d===pick.d?'on':'')+'" data-day="'+d+'">'+d+'</button>'; }).join('');
  document.getElementById('shPeriods').innerHTML = PERIODS.map(function(p){
    return '<button type="button" class="'+(p===pick.p?'on':'')+'" data-period="'+p+'">'+p+'限</button>'; }).join('');

  var all = COURSES.filter(function(c){
    return c.slots.some(function(s){ return s.d===pick.d && s.p===pick.p; });
  });
  var cats = [];
  all.forEach(function(c){ if(cats.indexOf(c.cat)<0) cats.push(c.cat); });
  var ch = '<button type="button" class="'+(pick.cat==='all'?'on':'')+'" data-cat="all">すべて '+all.length+'</button>';
  cats.forEach(function(ct){
    var n = all.filter(function(c){ return c.cat===ct; }).length;
    ch += '<button type="button" class="'+(pick.cat===ct?'on':'')+'" data-cat="'+ct+'">'+esc(CAT_INFO[ct].label)+' '+n+'</button>';
  });
  document.getElementById('shCats').innerHTML = ch;

  var q = norm(pick.q.trim());
  var list = all.filter(function(c){
    if(pick.cat !== 'all' && c.cat !== pick.cat) return false;
    if(!q) return true;
    return c.key.indexOf(q) >= 0;
  });
  list.sort(function(a,b){
    var ba = hardBlockers(a).length?1:0, bb = hardBlockers(b).length?1:0;
    if(rIsSelected(a.code)) ba = -1;
    if(rIsSelected(b.code)) bb = -1;
    return (ba-bb) || (a.ratio-b.ratio);
  });

  var body = '';
  var cur = selectedSlotMap(null)[pick.d + pick.p];
  if(cur) body += '<div class="msg ok">この枠には「'+esc(cur.name)+'」が入っています。別の講座の「差し替え」を押すと入れ替わります。</div>';
  var fk = fixedMap[pick.d + pick.p];
  if(fk) body += '<div class="msg ng">この枠は「'+esc(fk.name)+'」で埋まっています。'+
    (rIncludeOcc ? '重複を許可する設定なので選べますが、実際に登録できるか必ず確認してください。' : '下の科目は週2コマ科目の片方としてこの枠を使うものです。')+'</div>';
  if(!list.length) body += '<div class="empty">この条件に合う講座はありません。</div>';
  body += list.map(courseRow).join('');
  var bd = document.getElementById('shBody');
  bd.innerHTML = body;
  bd.scrollTop = 0;
}

/* ============================== 履修：操作 ============================== */
function touchRisyu(){ S.risyu.updatedAt = Date.now(); }
function rToggle(code){
  var c = byCode[code];
  if(!c) return;
  var i = S.risyu.selected.indexOf(code);
  if(i >= 0){
    S.risyu.selected.splice(i,1);
  }else{
    if(hardBlockers(c).length) return;
    swapTargets(c).forEach(function(o){
      var j = S.risyu.selected.indexOf(o.code);
      if(j >= 0) S.risyu.selected.splice(j,1);
    });
    S.risyu.selected.push(code);
  }
  touchRisyu();
  commit();
  if(sheetOpen()) renderPicker();
}
function risyuAction(act, t, ev){
  if(act==='r-slot'){
    var k = t.dataset.slot;
    var selMap = selectedSlotMap(null);
    if(selMap[k] && ev.target.closest('[data-x]')){ rToggle(selMap[k].code); return true; }
    openPicker(k); return true;
  }
  if(act==='r-toggle'){ if(!t.disabled) rToggle(t.dataset.code); return true; }
  if(act==='r-clear'){ S.risyu.selected = []; touchRisyu(); toast('すべて外しました'); commit(); return true; }
  if(act==='r-plan'){
    var p = RISYU_PLANS.filter(function(x){ return x.id === t.dataset.plan; })[0];
    if(!p) return true;
    S.risyu.selected = p.codes.filter(function(c){ return byCode[c]; });
    touchRisyu(); closePicker(); risyuTab = 'tt'; toast('案'+p.id+'を読み込みました'); commit(); window.scrollTo(0,0);
    return true;
  }
  if(act==='r-copy'){
    var box = document.getElementById('codebox');
    if(box){ box.focus(); box.select(); }
    var manual = function(){ toast('下の欄が選択されています。長押しか右クリックでコピーしてください'); };
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(codeText()).then(function(){ toast('時間割コードをコピーしました'); })['catch'](manual);
      }else{ manual(); }
    }catch(e){ manual(); }
    return true;
  }
  if(act==='course-req'){
    var nm = t.dataset.name;
    var f0 = FIXED.filter(function(x){ return x.name===nm; })[0];
    var cm = S.courseMeta[nm] || {};
    var cur = (cm.req != null) ? cm.req : (f0 ? f0.req : 0);
    cm.req = cur ? 0 : 1; S.courseMeta[nm] = cm;
    touch('courseMeta'); toast(nm+' を'+(cm.req?'必修':'選択')+'にしました'); commit(); return true;
  }
  if(act==='course-room'){
    var nm2 = t.dataset.name;
    var f1 = FIXED.filter(function(x){ return x.name===nm2; })[0];
    var cm2 = S.courseMeta[nm2] || {};
    var v2 = prompt(nm2+' の教室', cm2.room || (f1 ? f1.room : '') || '');
    if(v2 === null) return true;
    cm2.room = v2.trim(); S.courseMeta[nm2] = cm2;
    touch('courseMeta'); commit(); return true;
  }
  if(act==='course-tap'){ return risyuAction('course-add', t, ev); }
  if(act==='course-add'){
    evDraft = newDraft(today());
    evDraft.kind = 'task';
    evDraft.color = kindOf('task').color;
    evDraft.subject = t.dataset.name;
    evDraft.title = '';
    calEdit = null;
    appId = 'cal'; calTab = 'cal'; if(calView === 'todo') calView = 'month';
    render();
    var f = document.getElementById('evform');
    if(f) f.scrollIntoView({block:'center'});
    var ti = document.getElementById('ev_title');
    if(ti) ti.focus();
    toast(t.dataset.name+' の課題を追加します');
    return true;
  }
  if(act==='add-task'){
    var ti = val('tk_title').trim();
    if(!ti){ toast('やることの名前を入れてください', true); return true; }
    S.tasks.push({ id:uid('tk'), title:ti, subject:val('tk_subject'), due:readMd('tk_due'), time:val('tk_time'), done:0, memo:'', color:kindOf('task').color, mt:Date.now() });
    toast('追加しました'); commit(); return true;
  }
  if(act==='task-done' || act==='task-undone'){
    var tk = S.tasks.filter(function(x){ return x.id===t.dataset.id; })[0];
    if(tk){
      tk.done = act==='task-done'?1:0; tk.mt=Date.now();
      if(tk.done){
        toast('おつかれさま！');
        /* キャラクターのお祝い（ぜんぶ終わったら、とくべつに） */
        if(typeof charaCheer === 'function'){
          var left = S.tasks.filter(function(x){ return !x.done; }).length;
          charaCheer(left ? 'おつかれさま！あと' + left + 'こだよ' : 'ぜんぶ終わった！すごい！', 'cheer');
        }
      }
      commit();
    }
    return true;
  }
  if(act==='del-task'){ removeItem('tasks', t.dataset.id); toast('削除しました'); commit(); return true; }
  if(act==='add-exam'){
    var sb = val('ex_subject'), dt = readMd('ex_date');
    if(!sb && !val('ex_room')){ toast('科目か教室を入れてください', true); return true; }
    if(!isYmd(dt)){ toast('日付を選んでください', true); return true; }
    S.exams.push({ id:uid('ex'), subject:sb, date:dt, time:val('ex_time'), room:val('ex_room'), memo:'', quiz:0, color:'c8', mt:Date.now() });
    toast('テストを登録しました'); commit(); return true;
  }
  if(act==='del-exam'){ removeItem('exams', t.dataset.id); toast('削除しました'); commit(); return true; }
  if(act==='ab-plus' || act==='ab-minus' || act==='late-plus'){
    var key = t.dataset.key;
    var a = S.attend[key] || { ab:0, late:0, limit:5 };
    if(act==='ab-plus') a.ab = toNum(a.ab)+1;
    if(act==='ab-minus') a.ab = Math.max(0, toNum(a.ab)-1);
    if(act==='late-plus') a.late = toNum(a.late)+1;
    S.attend[key] = a; touch('attend'); commit(); return true;
  }
  if(act==='set-limit'){
    var lim = toNum(val('at_limit'));
    if(lim < 1){ toast('1以上の数字を入れてください', true); return true; }
    courseList().forEach(function(c){
      var a = S.attend[c.key] || { ab:0, late:0, limit:5 };
      a.limit = lim; S.attend[c.key] = a;
    });
    touch('attend'); toast('上限を'+lim+'回にしました'); commit(); return true;
  }
  if(act==='year-edit'){
    var slot = t.dataset.slot;
    var cur = S.terms.first[slot] || '';
    var v = prompt(slot + ' の科目名（空にすると削除）', cur);
    if(v === null) return true;
    v = v.trim();
    if(v) S.terms.first[slot] = v; else delete S.terms.first[slot];
    touch('terms'); commit(); return true;
  }
  return false;
}

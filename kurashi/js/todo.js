/* くらしの手帳：ToDo・メモ */
/* ============================== ToDo ============================== */
var todoTab = 'open';
function taskMinutes(id){
  var l = (S.taskLog||{})[id];
  return l ? toNum(l.min) : 0;
}
function taskRunning(id){
  var l = (S.taskLog||{})[id];
  return (l && l.start) ? l.start : 0;
}
function taskColor(t){ return t && t.plain ? '#FFFFFF' : kindHex('task'); }   /* ToDoで作ったものは白、課題はピンク */
function taskRow(t){
  var n = isYmd(t.due) ? daysFromToday(t.due) : null;
  var subs = t.subs || [];
  var doneSubs = subs.filter(function(x){ return x.done; }).length;
  return '<div class="task'+(t.done?' done':'')+'">'+
    '<div class="task-main">'+
      '<span class="cbar" style="background:'+taskColor(t)+'"></span>'+
      '<button class="chk'+(t.done?' on':'')+'" data-act="'+(t.done?'task-undone':'task-done')+'" data-id="'+t.id+'" aria-label="完了">'+(t.done?'✓':'')+'</button>'+
      '<span class="grow" data-act="ev-open" data-src="task" data-id="'+t.id+'" role="button">'+
        '<span class="t">'+esc(t.title)+'</span>'+
        '<span class="s">'+(toNum(t.pri)===2?'❗ ':'')+(t.subject?esc(t.subject)+'・':'')+(isYmd(t.due)?ymdLabel(t.due):'期限なし')+(t.time?' '+esc(t.time)+'まで':'')+
          (subs.length?'・小項目 '+doneSubs+'/'+subs.length:'')+
          (taskMinutes(t.id)?'・'+taskMinutes(t.id)+'分やった':'')+
          (t.how?'・'+({form:'Googleフォーム',classroom:'クラスルーム',other:(t.how2||'ほか')})[t.how]:'')+'</span></span>'+
      (!t.done && n!==null ? '<span class="due '+dueClass(n)+'">'+dueText(n)+'</span>' : '')+
    '</div>'+
    (subs.length && !t.done ? '<div class="subs">'+subs.map(function(x,i){
      return '<label class="sub"><input type="checkbox" data-act="sub-toggle" data-id="'+t.id+'" data-i="'+i+'"'+(x.done?' checked':'')+'><span'+(x.done?' style="text-decoration:line-through;color:var(--sub)"':'')+'>'+esc(x.text)+'</span></label>';
    }).join('')+'</div>' : '')+
    '</div>';
}
function viewTodo(){
  var all = S.tasks.slice()
    .map(function(t){ return Object.assign({}, t, {left: isYmd(t.due) ? daysFromToday(t.due) : null}); })
    .sort(function(a,b){
      if((a.done?1:0) !== (b.done?1:0)) return (a.done?1:0) - (b.done?1:0);   /* 未完が上 */
      if(S.ui.todoByPri){
        var pa = toNum(a.pri==null?1:a.pri), pb = toNum(b.pri==null?1:b.pri);
        if(pa !== pb) return pb - pa;                                          /* 大事さが高い順 */
      }
      if(a.left===null) return 1; if(b.left===null) return -1; return a.left-b.left;
    });
  var late = all.filter(function(t){ return !t.done && t.left!==null && t.left<0; });
  var rest = all.filter(function(t){ return late.indexOf(t) < 0; });
  var openN = all.filter(function(t){ return !t.done; }).length;

  var parts = {
    late: function(){ return late.length ? section('期限が過ぎているもの', late.length+'件', late.map(taskRow).join('')) : ''; },
    open: function(){ return section('やること', openN ? '残り'+openN+'件' : '片付いています',
        rest.length ? rest.map(taskRow).join('') : '<div class="empty">'+ART.empty+'<div style="margin-top:8px">やることはありません。</div></div>'); },
    add: function(){ return section('追加', null,
        '<div class="field"><label class="f">やること</label><input id="td_title" placeholder="例：看護過程レポート"></div>'+
        '<div class="pair" style="margin-bottom:11px">'+
          '<div><label class="f">科目（任意）</label><select id="td_subject">'+subjectOptions('')+'</select></div>'+
          '<div style="flex:0 0 150px">'+mdPicker('td_due', today(), '締切', false)+'</div></div>'+
        '<div class="field">'+timeSelect('td_time','','締切の時刻（任意）',true)+'</div>'+
        '<label class="f">大事さ</label><div class="pillrow" id="td_prirow">'+
          [['2','高'],['1','ふつう'],['0','低']].map(function(o,i){
            return '<button data-act="td-pri" data-v="'+o[0]+'" class="'+(i===1?'on':'')+'">'+o[1]+'</button>';
          }).join('')+'</div>'+
        '<div class="field"><label class="f">小項目（1行に1つ・任意）</label><textarea id="td_subs" placeholder="資料を集める&#10;下書き&#10;清書"></textarea></div>'+
        '<button class="btn" data-act="td-add">追加する</button>'+
        '<p class="note">ここで足したものは白色で、今日・明日・ToDoにだけ出ます。カレンダーには出ません。</p>'); }
  };
  var out = '';
  pageOrder('todo').forEach(function(id){ if(parts[id] && !pageHidden('todo', id)) out += parts[id](); });
  return out;
}

/* ============================== メモ ============================== */
var noteQ = '', noteView = '';
function noteRow(n){
  var checks = n.checks || [], dn = checks.filter(function(c){ return c.done; }).length;
  return '<div class="ncard'+(n.pinned?' pin':'')+(n.conflict?' conflict':'')+'" data-act="note-open" data-id="'+n.id+'" role="button" tabindex="0">'+
    '<div class="ct">'+(n.pinned?'📌 ':'')+(n.conflict?'⚠ ':'')+esc(n.title||'（無題）')+'</div>'+
    (n.body ? '<div class="cm nbody">'+esc(n.body).slice(0,120)+(n.body.length>120?'…':'')+'</div>' : '')+
    '<div class="s2" style="margin-top:4px">'+
      (n.link ? '<span class="b cat">'+esc(n.link.type==='course'?n.link.id:'予定')+'</span> ' : '')+
      (checks.length ? '<span class="b cr">☑ '+dn+'/'+checks.length+'</span> ' : '')+
      ((n.photos||[]).length ? '<span class="b cr">📷 '+(n.photos||[]).length+'</span> ' : '')+
      '更新 '+new Date(n.mt||0).toLocaleDateString('ja-JP')+'</div></div>';
}
function viewNotes(){
  if(noteView){ var cur = S.notes.filter(function(n){ return n.id===noteView; })[0]; if(cur) return noteDetail(cur); noteView=''; }
  var q = norm(noteQ.trim());
  var list = S.notes.filter(function(n){
    if(!q) return true;
    return norm((n.title||'')+' '+(n.body||'')+' '+(n.checks||[]).map(function(c){return c.text;}).join(' ')).indexOf(q)>=0;
  }).sort(function(a,b){ return (b.pinned?1:0)-(a.pinned?1:0) || (b.mt||0)-(a.mt||0); });
  return '<section><div class="head"><h2>メモ</h2><span>'+S.notes.length+'件</span></div>'+
    '<input type="search" id="note_q" placeholder="メモを探す" value="'+esc(noteQ)+'" style="margin-bottom:10px">'+
    '<button class="btn" data-act="note-new" style="margin-bottom:12px">新しいメモ</button>'+
    (list.length ? list.map(noteRow).join('') : '<div class="box"><div class="empty">'+ART.empty+'<div style="margin-top:8px">メモはまだありません。</div></div></div>')+
    '</section>';
}
function noteDetail(n){
  var checks = n.checks || [];
  var photos = (n.photos||[]).map(function(id){

    if(!src) return '';
    return '<div class="mphoto"><img data-pid="'+id+'" alt="写真" data-act="memo-photo-view" data-id="'+id+'">'+
      '<button class="mini" data-act="note-photo-del" data-id="'+n.id+'" data-pid="'+id+'">×</button></div>';
  }).join('');
  var courses = termCourses();
  return '<button class="mini" data-act="note-back" style="margin-bottom:10px">‹ メモ一覧</button>'+
    '<div class="box">'+
    '<div class="field"><input id="nt_title" value="'+esc(n.title||'')+'" placeholder="タイトル" style="font-weight:700;font-size:1.05em"></div>'+
    '<div class="field"><textarea id="nt_body" style="min-height:140px;font-size:.92em" placeholder="ここに書く">'+esc(n.body||'')+'</textarea></div>'+
    '<label class="f">チェックリスト</label>'+
    (checks.length ? '<div class="subs" style="margin-bottom:8px">'+checks.map(function(c,i){
      return '<label class="sub"><input type="checkbox" data-act="note-check" data-id="'+n.id+'" data-i="'+i+'"'+(c.done?' checked':'')+'>'+
        '<span'+(c.done?' style="text-decoration:line-through;color:var(--sub)"':'')+'>'+esc(c.text)+'</span>'+
        '<button class="mini" data-act="note-check-del" data-id="'+n.id+'" data-i="'+i+'" style="margin-left:auto">×</button></label>';
    }).join('')+'</div>' : '')+
    '<div class="pair" style="margin-bottom:11px"><input id="nt_check" placeholder="項目を追加">'+
      '<button class="btn ghost" style="flex:0 0 auto" data-act="note-check-add" data-id="'+n.id+'">追加</button></div>'+
    '<label class="f">紐づけ</label>'+
    '<select id="nt_link" style="margin-bottom:11px"><option value="">なし</option>'+
      courses.map(function(c){ return '<option value="course:'+esc(c.name)+'"'+(n.link&&n.link.type==='course'&&n.link.id===c.name?' selected':'')+'>'+esc(c.name)+'</option>'; }).join('')+
    '</select>'+
    (photos ? '<div class="mphotos" style="margin-bottom:10px">'+photos+'</div>' : '')+
    '<div class="pair">'+
      '<button class="btn" data-act="note-save" data-id="'+n.id+'">保存</button>'+
      '<button class="btn ghost" data-act="note-photo" data-id="'+n.id+'">写真</button>'+
      '<button class="btn ghost" data-act="note-pin" data-id="'+n.id+'" style="flex:0 0 auto">'+(n.pinned?'📌 解除':'📌')+'</button></div>'+
    '<button class="btn ghost" style="margin-top:8px;color:var(--rakuten)" data-act="note-del" data-id="'+n.id+'">このメモを削除</button>'+
    '<p class="note">作成 '+new Date(n.ct||n.mt||0).toLocaleString('ja-JP')+'　更新 '+new Date(n.mt||0).toLocaleString('ja-JP')+'</p>'+
    '</div>';
}
function noteOf(id){ return S.notes.filter(function(n){ return n.id===id; })[0]; }
function readNoteForm(n){
  var t=document.getElementById('nt_title'), b=document.getElementById('nt_body'), l=document.getElementById('nt_link');
  if(t) n.title = t.value; if(b) n.body = b.value;
  if(l){ var v=l.value; n.link = v ? { type:v.split(':')[0], id:v.slice(v.indexOf(':')+1) } : null; }
}

function todoAction(act, t){
  if(act==='td-add'){
    var ti = val('td_title').trim(); if(!ti){ toast('やることを入れてください', true); return true; }
    var subs = val('td_subs').split(/\n/).map(function(x){ return x.trim(); }).filter(Boolean).map(function(x){ return { text:x, done:0 }; });
    var pb = document.querySelector('#td_prirow button.on');
    S.tasks.push({ id:uid('tk'), plain:1, pri:pb?toNum(pb.dataset.v):1, title:ti, subject:val('td_subject'), due:readMd('td_due'), time:(readTime('td_time')||''), done:0, memo:'', subs:subs, photos:[], mt:Date.now() });
    toast('追加しました'); commit(); return true;
  }
  if(act==='sub-toggle'){
    var tk = S.tasks.filter(function(x){ return x.id===t.dataset.id; })[0]; if(!tk) return true;
    var i = toNum(t.dataset.i); if(tk.subs && tk.subs[i]){ tk.subs[i].done = tk.subs[i].done?0:1; tk.mt=Date.now(); commit(); }
    return true;
  }
  if(act==='td-pri'){
    Array.prototype.forEach.call(t.parentNode.querySelectorAll('button'), function(b){ b.classList.remove('on'); });
    t.classList.add('on'); return true;
  }
  if(act==='task-timer'){
    var id = t.dataset.id;
    S.taskLog = S.taskLog || {};
    var l = S.taskLog[id] || { min:0, start:0 };
    if(l.start){ l.min = toNum(l.min) + Math.max(1, Math.round((Date.now()-l.start)/60000)); l.start = 0; toast(l.min+'分になりました'); }
    else { l.start = Date.now(); toast('はかり始めました'); }
    S.taskLog[id] = l; touch('taskLog'); commit(); return true;
  }
  if(act==='todo-tab'){ todoTab = t.dataset.v; render(); return true; }
  if(act==='note-new'){
    var n = { id:uid('nt'), title:'', body:'', pinned:0, checks:[], photos:[], link:null, ct:Date.now(), mt:Date.now() };
    if(t.dataset.linkType) n.link = { type:t.dataset.linkType, id:t.dataset.linkId };
    S.notes.push(n); noteView = n.id; appId='notes'; commit(); window.scrollTo(0,0); return true;
  }
  if(act==='note-open'){ noteView = t.dataset.id; appId='notes'; render(); window.scrollTo(0,0); return true; }
  if(act==='note-back'){ var cur=noteOf(noteView); if(cur){ readNoteForm(cur); cur.mt=Date.now(); persist(); pushRemote(); } noteView=''; render(); return true; }
  if(act==='note-save'){ var n1=noteOf(t.dataset.id); if(!n1) return true; readNoteForm(n1); n1.mt=Date.now(); toast('保存しました'); commit(); return true; }
  if(act==='note-pin'){ var n2=noteOf(t.dataset.id); if(!n2) return true; readNoteForm(n2); n2.pinned=n2.pinned?0:1; n2.mt=Date.now(); commit(); return true; }
  if(act==='note-del'){ removeWithUndo('notes', t.dataset.id, 'メモを削除しました'); noteView=''; commit(); return true; }
  if(act==='note-check-add'){
    var n3=noteOf(t.dataset.id), txt=val('nt_check').trim(); if(!n3||!txt) return true;
    readNoteForm(n3); n3.checks=(n3.checks||[]).concat([{text:txt,done:0}]); n3.mt=Date.now(); commit(); return true;
  }
  if(act==='note-check'){ var n4=noteOf(t.dataset.id); if(!n4) return true; readNoteForm(n4); var i4=toNum(t.dataset.i); if(n4.checks[i4]){ n4.checks[i4].done=n4.checks[i4].done?0:1; n4.mt=Date.now(); commit(); } return true; }
  if(act==='note-check-del'){ var n5=noteOf(t.dataset.id); if(!n5) return true; readNoteForm(n5); n5.checks.splice(toNum(t.dataset.i),1); n5.mt=Date.now(); commit(); return true; }
  if(act==='note-photo'){ var n6=noteOf(t.dataset.id); if(n6) readNoteForm(n6); memoTarget = 'note:'+t.dataset.id; var inp=document.getElementById('memoimg'); if(inp) inp.click(); return true; }
  if(act==='note-photo-del'){
    var n7=noteOf(t.dataset.id); if(!n7) return true; readNoteForm(n7);
    n7.photos=(n7.photos||[]).filter(function(x){ return x!==t.dataset.pid; });
    photoDel(t.dataset.pid);
    n7.mt=Date.now(); commit(); return true;
  }
  return false;
}

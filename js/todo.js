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
  var out = (typeof suggestsCard === 'function') ? suggestsCard() : '';     /* AIが見つけた課題の候補（あるときだけ） */
  if(typeof kmParts === 'function') kmParts('todo', parts, {});
  pageOrder('todo').forEach(function(id){ if(parts[id] && !pageHidden('todo', id)) out += parts[id](); });
  return out;
}

/* ============================== メモ ============================== */
var noteQ = '', noteView = '', noteKindF = '', noteKindEdit = 0;
/* 前の版や、ほかの機能から入ったメモでも開けるように、形をそろえる */
function noteArr(v){ return Array.isArray(v) ? v : []; }
function noteStr(v){ return v == null ? '' : String(v); }

/* ===== メモの種類（はじめは「最重要」「重要」。追加・名前・色・ならび・削除ができる） =====
   種類の一覧は S.ui.noteKinds（ほかの端末ともそろう）。メモには n.kind に種類の id を入れる。 */
var NOTE_KINDS_DEF = [{ id:'top', name:'最重要', color:'#D93A2F' }, { id:'imp', name:'重要', color:'#E0892B' }];
var NOTE_KIND_COLORS = ['#D93A2F', '#E0892B', '#C9A227', '#3FA36B', '#2F8FD9', '#6B4FA0', '#C2549A', '#8A8A96'];
function noteKinds(){
  var k = (S.ui && Array.isArray(S.ui.noteKinds)) ? S.ui.noteKinds : NOTE_KINDS_DEF;
  return k.filter(function(x){ return x && x.id && noteStr(x.name).trim(); });
}
function noteKindsSet(list){ S.ui = S.ui || {}; S.ui.noteKinds = list; touch('ui'); }
function noteKindOf(n){
  var id = n && n.kind;
  return id ? (noteKinds().filter(function(k){ return k.id === id; })[0] || null) : null;
}
/* 上に出す順（最重要 → 重要 → そのほか） */
function noteRank(n){ var k = noteKindOf(n); return !k ? 0 : k.id === 'top' ? 2 : k.id === 'imp' ? 1 : 0; }
function noteKindTag(k){
  return k ? '<span class="nkind" style="--kc:' + esc(k.color || '#8A8A96') + '">' + esc(k.name) + '</span>' : '';
}

function noteRow(n){
  var checks = noteArr(n.checks), dn = checks.filter(function(c){ return c && c.done; }).length;
  var body = noteStr(n.body), k = noteKindOf(n), photos = noteArr(n.photos);
  return '<div class="ncard' + (n.pinned ? ' pin' : '') + (n.conflict ? ' conflict' : '') + (k ? ' haskind' : '') + '"' +
      (k ? ' style="--kc:' + esc(k.color || '#8A8A96') + '"' : '') + ' data-act="note-open" data-id="' + esc(n.id) + '" role="button" tabindex="0">' +
    '<div class="ct">' + noteKindTag(k) + (n.pinned ? '📌 ' : '') + (n.conflict ? '⚠ ' : '') + esc(noteStr(n.title) || '（無題）') + '</div>' +
    (body ? '<div class="cm nbody">' + esc(body.slice(0, 120)) + (body.length > 120 ? '…' : '') + '</div>' : '') +
    '<div class="s2" style="margin-top:4px">' +
      (n.link ? '<span class="b cat">' + esc(n.link.type === 'course' ? n.link.id : '予定') + '</span> ' : '') +
      (checks.length ? '<span class="b cr">☑ ' + dn + '/' + checks.length + '</span> ' : '') +
      (photos.length ? '<span class="b cr">📷 ' + photos.length + '</span> ' : '') +
      '更新 ' + new Date(n.mt || 0).toLocaleDateString('ja-JP') + '</div></div>';
}
function viewNotes(){
  if(noteKindEdit) return noteKindView();
  if(noteView){ var cur = S.notes.filter(function(n){ return n.id === noteView; })[0]; if(cur) return noteDetail(cur); noteView = ''; }
  var q = norm(noteQ.trim()), kinds = noteKinds();
  if(noteKindF && noteKindF !== '-' && !kinds.some(function(k){ return k.id === noteKindF; })) noteKindF = '';
  var list = S.notes.filter(function(n){
    if(noteKindF === '-' && noteKindOf(n)) return false;
    if(noteKindF && noteKindF !== '-' && (noteKindOf(n) || {}).id !== noteKindF) return false;
    if(!q) return true;
    var k = noteKindOf(n);
    return norm(noteStr(n.title) + ' ' + noteStr(n.body) + ' ' + (k ? k.name : '') + ' ' + noteArr(n.checks).map(function(c){ return c && c.text; }).join(' ')).indexOf(q) >= 0;
  }).sort(function(a, b){ return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || noteRank(b) - noteRank(a) || (b.mt || 0) - (a.mt || 0); });
  var cnt = function(id){ return S.notes.filter(function(n){ return id === '-' ? !noteKindOf(n) : (noteKindOf(n) || {}).id === id; }).length; };
  var chips = '<div class="pillrow nkrow">' +
    '<button data-act="note-kind-f" data-v="" class="' + (!noteKindF ? 'on' : '') + '">ぜんぶ</button>' +
    kinds.map(function(k){
      return '<button data-act="note-kind-f" data-v="' + esc(k.id) + '" class="' + (noteKindF === k.id ? 'on' : '') + '">' +
        '<span class="kdot" style="background:' + esc(k.color || '#8A8A96') + '"></span>' + esc(k.name) + ' ' + cnt(k.id) + '</button>';
    }).join('') +
    '<button data-act="note-kind-f" data-v="-" class="' + (noteKindF === '-' ? 'on' : '') + '">種類なし</button>' +
    '<button data-act="note-kind-edit" class="ghostpill">✎ 種類を編集</button></div>';
  return '<section><div class="head"><h2>メモ</h2><span>' + S.notes.length + '件</span></div>' +
    '<input type="search" id="note_q" placeholder="メモを探す" value="' + esc(noteQ) + '" style="margin-bottom:10px">' +
    chips +
    '<button class="btn" data-act="note-new" style="margin-bottom:12px">新しいメモ' +
      (noteKindF && noteKindF !== '-' && noteKindOf({ kind:noteKindF }) ? '（' + esc(noteKindOf({ kind:noteKindF }).name) + '）' : '') + '</button>' +
    (list.length ? list.map(noteRow).join('') : '<div class="box"><div class="empty">' + ART.empty + '<div style="margin-top:8px">' +
      (S.notes.length ? 'この種類のメモはありません。' : 'メモはまだありません。') + '</div></div></div>') +
    '</section>';
}
function noteDetail(n){
  var checks = noteArr(n.checks), kinds = noteKinds(), kid = (noteKindOf(n) || {}).id || '';
  /* 写真は、しまってある場所（IndexedDB）から、あとで入れる（photoFill） */
  var photos = noteArr(n.photos).filter(Boolean).map(function(id){
    return '<div class="mphoto"><img data-pid="' + esc(id) + '" alt="写真" data-act="memo-photo-view" data-id="' + esc(id) + '">' +
      '<button class="mini" data-act="note-photo-del" data-id="' + esc(n.id) + '" data-pid="' + esc(id) + '">×</button></div>';
  }).join('');
  var courses = termCourses();
  return '<button class="mini" data-act="note-back" style="margin-bottom:10px">‹ メモ一覧</button>' +
    '<div class="box">' +
    '<div class="field"><input id="nt_title" value="' + esc(noteStr(n.title)) + '" placeholder="タイトル" style="font-weight:700;font-size:1.05em"></div>' +
    '<label class="f">種類</label>' +
    '<div class="pillrow nkrow">' +
      '<button data-act="note-kind" data-id="' + esc(n.id) + '" data-v="" class="' + (!kid ? 'on' : '') + '">なし</button>' +
      kinds.map(function(k){
        return '<button data-act="note-kind" data-id="' + esc(n.id) + '" data-v="' + esc(k.id) + '" class="' + (kid === k.id ? 'on' : '') + '">' +
          '<span class="kdot" style="background:' + esc(k.color || '#8A8A96') + '"></span>' + esc(k.name) + '</button>';
      }).join('') +
      '<button data-act="note-kind-edit" class="ghostpill">✎ 編集</button>' +
    '</div>' +
    '<div class="field"><textarea id="nt_body" style="min-height:140px;font-size:.92em" placeholder="ここに書く">' + esc(noteStr(n.body)) + '</textarea></div>' +
    '<label class="f">チェックリスト</label>' +
    (checks.length ? '<div class="subs" style="margin-bottom:8px">' + checks.map(function(c, i){
      c = c || {};
      return '<label class="sub"><input type="checkbox" data-act="note-check" data-id="' + esc(n.id) + '" data-i="' + i + '"' + (c.done ? ' checked' : '') + '>' +
        '<span' + (c.done ? ' style="text-decoration:line-through;color:var(--sub)"' : '') + '>' + esc(noteStr(c.text)) + '</span>' +
        '<button class="mini" data-act="note-check-del" data-id="' + esc(n.id) + '" data-i="' + i + '" style="margin-left:auto">×</button></label>';
    }).join('') + '</div>' : '') +
    '<div class="pair" style="margin-bottom:11px"><input id="nt_check" placeholder="項目を追加">' +
      '<button class="btn ghost" style="flex:0 0 auto" data-act="note-check-add" data-id="' + esc(n.id) + '">追加</button></div>' +
    '<label class="f">紐づけ</label>' +
    '<select id="nt_link" style="margin-bottom:11px"><option value="">なし</option>' +
      courses.map(function(c){ return '<option value="course:' + esc(c.name) + '"' + (n.link && n.link.type === 'course' && n.link.id === c.name ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') +
      /* 授業以外（予定など）に紐づいたメモも、紐づけを消さないように */
      (n.link && !(n.link.type === 'course' && courses.some(function(c){ return c.name === n.link.id; }))
        ? '<option value="' + esc(n.link.type + ':' + n.link.id) + '" selected>' + esc(n.link.type === 'course' ? n.link.id : '予定') + '</option>' : '') +
    '</select>' +
    (photos ? '<div class="mphotos" style="margin-bottom:10px">' + photos + '</div>' : '') +
    '<div class="pair">' +
      '<button class="btn" data-act="note-save" data-id="' + esc(n.id) + '">保存</button>' +
      '<button class="btn ghost" data-act="note-photo" data-id="' + esc(n.id) + '">写真</button>' +
      '<button class="btn ghost" data-act="note-pin" data-id="' + esc(n.id) + '" style="flex:0 0 auto">' + (n.pinned ? '📌 解除' : '📌') + '</button>' +
      '<button class="btn ghost" data-act="share-note" data-id="' + esc(n.id) + '" style="flex:0 0 auto">共有</button></div>' +
    '<button class="btn ghost" style="margin-top:8px;color:var(--rakuten)" data-act="note-del" data-id="' + esc(n.id) + '">このメモを削除</button>' +
    '<p class="note">作成 ' + new Date(n.ct || n.mt || 0).toLocaleString('ja-JP') + '　更新 ' + new Date(n.mt || 0).toLocaleString('ja-JP') + '</p>' +
    '</div>';
}
/* 種類の編集 */
function noteKindView(){
  var kinds = noteKinds();
  var rows = kinds.map(function(k, i){
    var used = S.notes.filter(function(n){ return n.kind === k.id; }).length;
    return '<div class="nkedit">' +
      '<div class="nkline">' +
        '<span class="kdot big" style="background:' + esc(k.color || '#8A8A96') + '"></span>' +
        '<input id="nk_name_' + i + '" value="' + esc(k.name) + '" maxlength="12" aria-label="種類の名前">' +
        '<button class="mini" data-act="note-kind-move" data-i="' + i + '" data-d="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="上へ">↑</button>' +
        '<button class="mini" data-act="note-kind-move" data-i="' + i + '" data-d="1"' + (i === kinds.length - 1 ? ' disabled' : '') + ' aria-label="下へ">↓</button>' +
        '<button class="mini" data-act="note-kind-del" data-i="' + i + '" aria-label="消す">🗑</button>' +
      '</div>' +
      '<div class="kcolors">' + NOTE_KIND_COLORS.map(function(c){
        return '<button class="kc' + (c === k.color ? ' on' : '') + '" style="background:' + c + '" data-act="note-kind-color" data-i="' + i + '" data-c="' + c + '" aria-label="この色"></button>';
      }).join('') + '<span class="s" style="margin-left:6px">' + used + '件</span></div>' +
    '</div>';
  }).join('');
  return '<button class="mini" data-act="note-kind-done" style="margin-bottom:10px">‹ もどる</button>' +
    '<section><div class="head"><h2>メモの種類</h2><span>' + kinds.length + 'つ</span></div>' +
    '<div class="box">' + (rows || '<div class="empty">種類はまだありません。</div>') +
      '<label class="f" style="margin-top:12px">種類を追加</label>' +
      '<div class="pair"><input id="nk_new" maxlength="12" placeholder="例：テスト・実習・バイト">' +
        '<button class="btn ghost" style="flex:0 0 auto" data-act="note-kind-add">追加</button></div>' +
      '<button class="btn" data-act="note-kind-save" style="margin-top:12px">名前を保存</button>' +
      '<p class="note">「最重要」と「重要」のメモは、一覧の上に出ます。種類を消しても、メモは消えません（種類なしになります）。種類はほかの端末ともそろいます。</p>' +
    '</div></section>';
}
/* 編集中の名前を読みとって、種類の一覧を返す（書きかけを消さないように） */
function noteKindsFromForm(){
  return noteKinds().map(function(k, i){
    var el = document.getElementById('nk_name_' + i), nm = el ? el.value.trim().slice(0, 12) : k.name;
    return { id:k.id, name:nm || k.name, color:k.color || '#8A8A96' };
  });
}
function noteOf(id){ return S.notes.filter(function(n){ return n.id === id; })[0]; }
function readNoteForm(n){
  var t = document.getElementById('nt_title'), b = document.getElementById('nt_body'), l = document.getElementById('nt_link');
  if(t) n.title = t.value; if(b) n.body = b.value;
  if(l){ var v = l.value; n.link = v ? { type:v.split(':')[0], id:v.slice(v.indexOf(':') + 1) } : null; }
}
/* 何も書いていないメモか（一覧にもどったとき、そうじする） */
function noteEmpty(n){
  return !noteStr(n.title).trim() && !noteStr(n.body).trim() && !noteArr(n.checks).length && !noteArr(n.photos).length;
}
/* 書いているあいだも、この端末には少しずつ保存する（タブを変えたり、アプリを閉じても消えない）。
   ほかの端末へは、打つたびには送らない（書きこみの回数の上限に当たらないように）。
   一覧にもどったとき・アプリから出たとき・1分ごとの見まわりで送る。 */
var noteKeepT = null;
function noteKeep(send){
  var cur = noteView ? noteOf(noteView) : null;
  if(!cur || !document.getElementById('nt_body')) return;
  var bt = cur.title, bb = cur.body;
  readNoteForm(cur);
  if(cur.title !== bt || cur.body !== bb){ cur.mt = Date.now(); persist(); if(send) pushRemote(true); }
}
if(typeof document !== 'undefined'){
  document.addEventListener('input', function(e){
    var id = e.target && e.target.id;
    if(id !== 'nt_title' && id !== 'nt_body') return;
    clearTimeout(noteKeepT);
    noteKeepT = setTimeout(function(){ noteKeep(false); }, 800);
  });
  document.addEventListener('visibilitychange', function(){ if(document.hidden){ clearTimeout(noteKeepT); noteKeep(true); } });
  window.addEventListener('pagehide', function(){ clearTimeout(noteKeepT); noteKeep(true); });
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
    if(noteKindF && noteKindF !== '-' && noteKindOf({ kind:noteKindF })) n.kind = noteKindF;   /* しぼっている種類で作る */
    S.notes.push(n); noteView = n.id; noteKindEdit = 0; appId='notes'; commit(); window.scrollTo(0,0); return true;
  }
  if(act==='note-open'){ noteView = t.dataset.id; noteKindEdit = 0; appId='notes'; render(); window.scrollTo(0,0); return true; }
  if(act==='note-back'){
    clearTimeout(noteKeepT);
    var cur=noteOf(noteView);
    if(cur){
      var bt=cur.title, bb=cur.body, bl=JSON.stringify(cur.link||null);
      readNoteForm(cur);
      if(noteEmpty(cur)){ removeItem('notes', cur.id); persist(); pushRemote(); }                 /* 何も書かずにもどったメモは、のこさない */
      else if(cur.title!==bt || cur.body!==bb || JSON.stringify(cur.link||null)!==bl){ cur.mt=Date.now(); persist(); pushRemote(); }   /* 見ただけなら、直した時刻は変えない */
    }
    noteView=''; render(); return true;
  }
  if(act==='note-kind'){
    var nk=noteOf(t.dataset.id); if(!nk) return true;
    readNoteForm(nk); nk.kind = t.dataset.v || ''; nk.mt=Date.now(); commit(); return true;
  }
  if(act==='note-kind-f'){ noteKindF = t.dataset.v || ''; render(); return true; }
  if(act==='note-kind-edit'){ clearTimeout(noteKeepT); if(noteView) noteKeep(true); noteKindEdit = 1; render(); window.scrollTo(0,0); return true; }
  if(act==='note-kind-done'){ noteKindEdit = 0; render(); return true; }
  if(act==='note-kind-save'){ noteKindsSet(noteKindsFromForm()); toast('種類を保存しました'); commit(); return true; }
  if(act==='note-kind-add'){
    var nm = val('nk_new').trim().slice(0, 12);
    if(!nm){ toast('種類の名前を入れてください', true); return true; }
    var ks = noteKindsFromForm();
    if(ks.some(function(k){ return k.name === nm; })){ toast('「'+nm+'」は、もうあります', true); return true; }
    ks.push({ id:uid('nk'), name:nm, color:NOTE_KIND_COLORS[(ks.length + 3) % NOTE_KIND_COLORS.length] });
    noteKindsSet(ks); toast('「'+nm+'」を追加しました'); commit(); return true;
  }
  if(act==='note-kind-color'){
    var kc = noteKindsFromForm(), ic = toNum(t.dataset.i);
    if(kc[ic]){ kc[ic].color = t.dataset.c; noteKindsSet(kc); commit(); }
    return true;
  }
  if(act==='note-kind-move'){
    var km = noteKindsFromForm(), im = toNum(t.dataset.i), jm = im + toNum(t.dataset.d);
    if(km[im] && km[jm]){ var tmp = km[im]; km[im] = km[jm]; km[jm] = tmp; noteKindsSet(km); commit(); }
    return true;
  }
  if(act==='note-kind-del'){
    var kd = noteKindsFromForm(), idl = toNum(t.dataset.i), gone = kd[idl];
    if(!gone) return true;
    var usedN = S.notes.filter(function(x){ return x.kind === gone.id; }).length;
    if(!confirm('種類「'+gone.name+'」を消しますか？' + (usedN ? '\n（この種類の'+usedN+'件のメモは、消えずに「種類なし」になります）' : ''))) return true;
    S.notes.forEach(function(x){ if(x.kind === gone.id){ x.kind = ''; x.mt = Date.now(); } });
    kd.splice(idl, 1); noteKindsSet(kd);
    if(noteKindF === gone.id) noteKindF = '';
    toast('消しました'); commit(); return true;
  }
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

/* もんだいメーカー：「メモ」タブ
   授業中にさっと書いて、あとから読み返す・さがす・そのまま問題にする。
   ・ほかの端末ともそろいます（同期）
   ・メモの文から、そのまま問題を作れます（「この文から問題をつくる」） */

var nt = { edit:'', q:'', sub:'', star:0, del:'' };   /* 画面の状態（note は ui.js の関数名なので nt） */

/* ===== データ ===== */
function notesAll(){
  return (S.notes || []).slice().sort(function(a, b){
    return (toNum(b.star) - toNum(a.star)) || (toNum(b.mt) - toNum(a.mt));
  });
}
function noteGet(id){ return (S.notes || []).filter(function(x){ return x.id === id; })[0] || null; }
function noteAdd(o){
  o = o || {};
  var n = {
    id:uid('nt'), mt:Date.now(), at:o.at || today(),
    sub:o.sub || mkSubId() || '', no:String(o.no || ''),
    body:String(o.body || ''), star:0
  };
  if(!Array.isArray(S.notes)) S.notes = [];
  S.notes.push(n);
  saveSoon();
  return n;
}
function noteSet(id, patch){
  var n = noteGet(id);
  if(!n) return null;
  Object.keys(patch || {}).forEach(function(k){ n[k] = patch[k]; });
  n.mt = Date.now();
  saveSoon();
  return n;
}
function noteDel(id){
  if(!noteGet(id)) return false;
  S.notes = (S.notes || []).filter(function(x){ return x.id !== id; });
  if(typeof syDead === 'function') syDead(id);
  saveSoon();
  return true;
}
/* 1行目を、見出しにする */
function noteTitle(n){
  var t = String((n && n.body) || '').split('\n')[0].trim();
  return t ? t.slice(0, 40) : '（からのメモ）';
}
function noteBodyRest(n){
  var lines = String((n && n.body) || '').split('\n').slice(1).join(' ').trim();
  return lines.slice(0, 60);
}
/* さがす・しぼる */
function noteList(){
  var q = String(inVal('nt_q', nt.q) || '').trim().toLowerCase();
  return notesAll().filter(function(n){
    if(nt.sub && n.sub !== nt.sub) return false;
    if(nt.star && !n.star) return false;
    if(!q) return true;
    var s = (n.body || '') + ' ' + (subName(n.sub) || '') + ' ' + (n.no ? '第' + n.no + '回' : '');
    return s.toLowerCase().indexOf(q) >= 0;
  });
}
function subName(id){ var s = sub(id); return s ? s.name : ''; }

/* ===== 画面 ===== */
function noteView(){
  return nt.edit ? noteEditView() : noteListView();
}
function noteListView(){
  var list = noteList(), all = (S.notes || []).length;
  var h = section('メモ', all ? all + 'こ' : null,
    btn('＋ 新しいメモ', 'nt-new', { cls:'main' }) +
    '<label class="f" for="nt_q">さがす</label>' +
    '<input id="nt_q" type="search" placeholder="ことばで さがす（本文・科目・第◯回）" value="' + esc(inVal('nt_q', nt.q)) + '" data-act="nt-search">' +
    '<div class="chips" style="margin-top:8px">' +
      '<button type="button" data-act="nt-sub" data-v="" class="' + (nt.sub ? '' : 'on') + '">ぜんぶ</button>' +
      subsAll().map(function(s){
        return '<button type="button" data-act="nt-sub" data-v="' + esc(s.id) + '" class="' + (nt.sub === s.id ? 'on' : '') + '">' +
          esc(s.icon || '📘') + ' ' + esc(s.name) + '</button>';
      }).join('') +
      '<button type="button" data-act="nt-star" class="' + (nt.star ? 'on' : '') + '">★ だけ</button>' +
    '</div>');

  if(!list.length){
    h += '<div class="empty">' + (all ? 'そのことばのメモは見つかりません。' :
      '授業中に気づいたこと、先生が「ここ出す」と言ったこと。<br>なんでも書いておくと、あとで問題にできます。') + '</div>';
    return h;
  }
  h += list.map(function(n){
    return '<section class="card note" data-act="nt-open" data-v="' + esc(n.id) + '" role="button" tabindex="0">' +
      '<div class="nt-top">' +
        '<b>' + esc(noteTitle(n)) + '</b>' +
        (n.star ? '<span class="nt-star">★</span>' : '') +
      '</div>' +
      (noteBodyRest(n) ? '<div class="s">' + esc(noteBodyRest(n)) + '</div>' : '') +
      '<div class="s sub">' + [subName(n.sub) ? esc(subName(n.sub)) : '', n.no ? '第' + esc(n.no) + '回' : '', mdText(n.at)]
        .filter(Boolean).join('　') + '</div>' +
    '</section>';
  }).join('');
  return h;
}
function noteEditView(){
  var n = noteGet(nt.edit);
  if(!n){ nt.edit = ''; return noteListView(); }
  var h = section('メモ', mdText(n.at) || '',
    '<textarea id="nt_body" rows="10" placeholder="ここに書きます。1行目が見出しになります。">' + esc(inVal('nt_body', n.body)) + '</textarea>' +
    '<div class="pair">' +
      '<div><label class="f" for="nt_no">第◯回</label>' +
        '<input id="nt_no" type="number" min="1" max="30" inputmode="numeric" value="' + esc(inVal('nt_no', n.no)) + '" placeholder="3"></div>' +
      '<div><label class="f" for="nt_at">日付</label>' +
        '<input id="nt_at" type="date" value="' + esc(inVal('nt_at', n.at || today())) + '"></div>' +
    '</div>' +
    '<label class="f">科目</label>' +
    '<div class="chips">' +
      '<button type="button" data-act="nt-esub" data-v="" class="' + (n.sub ? '' : 'on') + '">科目なし</button>' +
      subsAll().map(function(s){
        return '<button type="button" data-act="nt-esub" data-v="' + esc(s.id) + '" class="' + (n.sub === s.id ? 'on' : '') + '">' +
          esc(s.icon || '📘') + ' ' + esc(s.name) + '</button>';
      }).join('') +
    '</div>' +
    '<div class="pair" style="margin-top:12px">' +
      btn('保存する', 'nt-save', { cls:'main' }) +
      btn(n.star ? '★ をはずす' : '★ をつける', 'nt-estar', { cls:'ghost' }) +
    '</div>' +
    '<div class="pair" style="margin-top:8px">' +
      btn('✨ この文から問題をつくる', 'nt-make', { cls:'ghost' }) +
      btn('一覧にもどる', 'nt-close', { cls:'ghost' }) +
    '</div>' +
    (nt.del === n.id
      ? '<div class="warn" style="margin-top:10px">このメモを消します。もどせません。</div>' +
        '<div class="pair">' + btn('消す', 'nt-del2', { cls:'bad' }) + btn('やめる', 'nt-delno', { cls:'ghost' }) + '</div>'
      : '<button type="button" class="link" data-act="nt-del" style="margin-top:10px">このメモを消す</button>'));
  return h;
}

/* ===== 操作 ===== */
onView('note', noteView);

onAct('nt-new', function(){
  var n = noteAdd({});
  nt.edit = n.id; nt.del = '';
  inClear('nt_body'); inClear('nt_no'); inClear('nt_at');
  saveNow(); render();
  var el = document.getElementById('nt_body');
  if(el) try{ el.focus(); }catch(e){}
});
onAct('nt-open', function(d){
  nt.edit = d.v; nt.del = '';
  inClear('nt_body'); inClear('nt_no'); inClear('nt_at');
  render();
});
onAct('nt-close', function(){ noteSaveNow(); nt.edit = ''; nt.del = ''; render(); });
onAct('nt-save', function(){
  if(!noteSaveNow()) return;
  toast('保存しました');
  nt.edit = ''; nt.del = '';
  render();
});
onAct('nt-estar', function(){
  var n = noteGet(nt.edit);
  if(!n) return;
  noteSet(n.id, { star:n.star ? 0 : 1 });
  saveNow(); render();
});
onAct('nt-esub', function(d){
  if(!nt.edit) return;
  noteSet(nt.edit, { sub:d.v || '' });
  if(d.v) S.ui.lastSub = d.v;
  saveNow(); render();
});
onAct('nt-del', function(){ nt.del = nt.edit; render(); });
onAct('nt-delno', function(){ nt.del = ''; render(); });
onAct('nt-del2', function(){
  noteDel(nt.edit);
  nt.edit = ''; nt.del = '';
  inClear('nt_body'); inClear('nt_no'); inClear('nt_at');
  saveNow(); toast('消しました'); render();
});
onAct('nt-search', function(d, el){ nt.q = el.value; renderLater(); });
onAct('nt-sub', function(d){ nt.sub = d.v || ''; render(); });
onAct('nt-star', function(){ nt.star = nt.star ? 0 : 1; render(); });
/* メモの文を、そのまま「つくる」に持っていく */
onAct('nt-make', function(){
  var n = noteSaveNow(1);
  if(!n) return;
  var body = String(n.body || '').trim();
  if(body.length < 10){ toast('もう少し書いてから、問題にしてみてください', true); return; }
  if(n.sub) S.ui.lastSub = n.sub;
  mk.files = [];
  mk.mat = { no:String(n.no || ''), memo:'', at:n.at || today(), title:noteTitle(n) };
  INP.mk_paste = body;
  inClear('mk_no'); inClear('mk_at'); inClear('mk_memo');
  nt.edit = ''; nt.del = '';
  saveNow();
  go('make');
  toast('メモの文を「つくる」に入れました');
});
/* 書いたものを、その場で入れておく */
function noteSaveNow(quiet){
  var n = noteGet(nt.edit);
  if(!n) return null;
  var body = String(elVal('nt_body') != null ? elVal('nt_body') : n.body);
  var no = String(elVal('nt_no') != null ? elVal('nt_no') : n.no).slice(0, 4);
  var at = String(elVal('nt_at') != null ? elVal('nt_at') : n.at);
  noteSet(n.id, { body:body.slice(0, 20000), no:no, at:at || today() });
  inClear('nt_body'); inClear('nt_no'); inClear('nt_at');
  saveNow();
  if(!quiet) return n;
  return n;
}

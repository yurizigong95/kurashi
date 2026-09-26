/* くらしの手帳：メモ（開けないメモの不具合・種類分け） */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;

function act(w, sel){
  var el = w.document.querySelector(sel);
  if(!el) throw new Error('ボタンが見つかりません：' + sel);
  el.click();
  return el;
}
function app(w){ return w.document.getElementById('app').textContent; }
function openNotes(w){ w.noteKindEdit = 0; w.noteView = ''; w.noteKindF = ''; w.appId = 'notes'; w.render(); }

KT.test('メモ：写真つきのメモも開ける（前は「src is not defined」で開けなかった）', async function(){
  var A = KT.frames().A, now = Date.now();
  A.S.notes.push(J(A, { id:'nt_ph1', title:'板書の写真メモ', body:'呼吸の単元', pinned:0, checks:[], photos:['ph_none'], link:null, ct:now, mt:now }));
  A.commit();
  openNotes(A);
  act(A, '[data-act="note-open"][data-id="nt_ph1"]');
  ok(A.document.getElementById('nt_title'), '詳細が開く');
  eq(A.document.getElementById('nt_title').value, '板書の写真メモ', '中身が見える');
  act(A, '[data-act="note-back"]');
  ok(A.S.notes.some(function(n){ return n.id === 'nt_ph1'; }), 'メモはのこる');
  A.removeItem('notes', 'nt_ph1'); A.commit();
});

KT.test('メモ：形がこわれたメモ（ほかの機能や前の版から来たもの）でも開ける', async function(){
  var A = KT.frames().A, now = Date.now();
  A.S.notes.push(J(A, { id:'nt_odd', title:null, body:12345, pinned:0, checks:null, photos:'x', link:{ type:'event', id:'ev_1' }, ct:now, mt:now }));
  A.commit();
  openNotes(A);
  ok(/（無題）/.test(app(A)), '一覧に出る');
  act(A, '[data-act="note-open"][data-id="nt_odd"]');
  ok(A.document.getElementById('nt_body'), '詳細が開く');
  eq(A.document.getElementById('nt_body').value, '12345', '本文が見える');
  act(A, '[data-act="note-save"][data-id="nt_odd"]');
  var n = A.S.notes.filter(function(x){ return x.id === 'nt_odd'; })[0];
  ok(n.link && n.link.type === 'event' && n.link.id === 'ev_1', '予定との紐づけが、保存しても消えない');
  A.removeItem('notes', 'nt_odd'); A.commit();
});

KT.test('メモ：「最重要」「重要」をつけると、上に出て、しぼれる', async function(){
  var A = KT.frames().A, now = Date.now();
  A.S.notes.push(J(A, { id:'nk_a', title:'ふつうのメモ', body:'a', pinned:0, checks:[], photos:[], link:null, ct:now, mt:now + 30 }));
  A.S.notes.push(J(A, { id:'nk_b', title:'レポートの締切', body:'b', pinned:0, checks:[], photos:[], link:null, ct:now, mt:now + 10 }));
  A.S.notes.push(J(A, { id:'nk_c', title:'実習の持ち物', body:'c', pinned:0, checks:[], photos:[], link:null, ct:now, mt:now + 20 }));
  A.commit();
  openNotes(A);
  act(A, '[data-act="note-open"][data-id="nk_b"]');
  ok(/最重要/.test(app(A)) && /重要/.test(app(A)), 'メモを書く画面で種類をえらべる');
  act(A, '[data-act="note-kind"][data-id="nk_b"][data-v="top"]');
  eq(A.noteOf('nk_b').kind, 'top', '最重要になった');
  act(A, '[data-act="note-back"]');
  act(A, '[data-act="note-open"][data-id="nk_c"]');
  act(A, '[data-act="note-kind"][data-id="nk_c"][data-v="imp"]');
  act(A, '[data-act="note-back"]');
  var order = Array.prototype.map.call(A.document.querySelectorAll('.ncard'), function(e){ return e.dataset.id; })
    .filter(function(id){ return /^nk_/.test(id); });
  eq(order.join(','), 'nk_b,nk_c,nk_a', '最重要 → 重要 → ふつう の順');
  ok(A.document.querySelector('.ncard[data-id="nk_b"] .nkind'), '一覧に種類のしるし');
  act(A, '[data-act="note-kind-f"][data-v="imp"]');
  ok(A.document.querySelector('.ncard[data-id="nk_c"]') && !A.document.querySelector('.ncard[data-id="nk_b"]'), '重要だけにしぼれる');
  act(A, '[data-act="note-new"]');
  eq(A.noteOf(A.noteView).kind, 'imp', 'しぼっているときに作ると、その種類になる');
  act(A, '[data-act="note-back"]');
  ['nk_a', 'nk_b', 'nk_c'].forEach(function(id){ A.removeItem('notes', id); });
  A.commit();
});

KT.test('メモ：種類を追加・名前を変える・色・ならび・消す。ほかの端末ともそろう', async function(){
  var fr = KT.frames(), A = fr.A, B = fr.B, now = Date.now();
  A.S.notes.push(J(A, { id:'nk_d', title:'テスト範囲', body:'1〜5章', pinned:0, checks:[], photos:[], link:null, ct:now, mt:now }));
  A.commit();
  openNotes(A);
  act(A, '[data-act="note-kind-edit"]');
  ok(/メモの種類/.test(app(A)), '種類の編集画面');
  A.document.getElementById('nk_new').value = 'テスト';
  act(A, '[data-act="note-kind-add"]');
  var ks = A.noteKinds();
  eq(ks.map(function(k){ return k.name; }).join(','), '最重要,重要,テスト', '種類が足された');
  var tid = ks[2].id;
  A.document.getElementById('nk_name_2').value = '定期テスト';
  act(A, '[data-act="note-kind-save"]');
  eq(A.noteKinds()[2].name, '定期テスト', '名前を変えられる');
  act(A, '[data-act="note-kind-color"][data-i="2"][data-c="#2F8FD9"]');
  eq(A.noteKinds()[2].color, '#2F8FD9', '色を変えられる');
  act(A, '[data-act="note-kind-move"][data-i="2"][data-d="-1"]');
  eq(A.noteKinds()[1].id, tid, 'ならびを変えられる');
  act(A, '[data-act="note-kind-done"]');
  act(A, '[data-act="note-open"][data-id="nk_d"]');
  act(A, '[data-act="note-kind"][data-id="nk_d"][data-v="' + tid + '"]');
  act(A, '[data-act="note-back"]');
  /* ほかの端末 */
  await KT.settle([A, B]);
  await KT.until(function(){ return B.noteKinds().some(function(k){ return k.id === tid && k.name === '定期テスト'; }); }, 8000, 'ほかの端末に種類がとどく');
  await KT.until(function(){ var n = B.noteOf('nk_d'); return n && n.kind === tid; }, 8000, 'ほかの端末のメモにも種類');
  ok(true, 'ほかの端末ともそろった');
  /* 消しても、メモは消えない */
  var oc = A.confirm; A.confirm = function(){ return true; };
  try{
    openNotes(A);
    act(A, '[data-act="note-kind-edit"]');
    act(A, '[data-act="note-kind-del"][data-i="1"]');
  }finally{ A.confirm = oc; }
  ok(!A.noteKinds().some(function(k){ return k.id === tid; }), '種類が消えた');
  ok(A.noteOf('nk_d') && !A.noteOf('nk_d').kind, 'メモはのこって、種類なしになる');
  A.noteKindEdit = 0;
  A.removeItem('notes', 'nk_d'); A.commit();
  await KT.settle([A, B]);
});

KT.test('メモ：見ただけでは更新時刻が変わらない・何も書かずにもどったメモはのこらない・書きかけも保存', async function(){
  var A = KT.frames().A, now = Date.now() - 60000;
  A.S.notes.push(J(A, { id:'nk_e', title:'見るだけのメモ', body:'x', pinned:0, checks:[], photos:[], link:null, ct:now, mt:now }));
  A.commit();
  openNotes(A);
  act(A, '[data-act="note-open"][data-id="nk_e"]');
  act(A, '[data-act="note-back"]');
  eq(A.noteOf('nk_e').mt, now, '見ただけなら、更新時刻はそのまま');
  var n0 = A.S.notes.length;
  act(A, '[data-act="note-new"]');
  act(A, '[data-act="note-back"]');
  eq(A.S.notes.length, n0, '空のメモはのこらない');
  act(A, '[data-act="note-new"]');
  var id = A.noteView, ta = A.document.getElementById('nt_body');
  ta.value = '書きかけのメモ';
  ta.dispatchEvent(new A.Event('input', { bubbles:true }));
  await KT.until(function(){ return (A.noteOf(id) || {}).body === '書きかけのメモ'; }, 3000, 'ひとりでに保存');
  ok(true, '保存をおさなくても、書きかけがのこる');
  openNotes(A);
  A.removeItem('notes', 'nk_e'); A.removeItem('notes', id); A.commit();
});

})();

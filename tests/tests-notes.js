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


KT.test('メモ：授業の画面から作ったり開いたりしたメモは、もどると授業の画面にもどる（メモの一覧からなら一覧へ）', async function(){
  var A = KT.frames().A, doc = A.document, name = A.termCourses()[0].name;
  A.appId = 'course'; A.courseView = name; A.courseFrom = ''; A.render();
  act(A, '[data-act="note-new"][data-link-type="course"]');
  eq(A.appId, 'notes', 'メモの画面');
  var back = doc.querySelector('[data-act="note-back"]');
  ok(back && back.textContent.indexOf(name) >= 0 && /にもどる/.test(back.textContent), 'もどるボタンに授業の名前：' + back.textContent);
  doc.getElementById('nt_title').value = '授業から作ったメモ';
  act(A, '[data-act="note-back"]');
  eq(A.appId, 'course', '授業の画面にもどる');
  eq(A.courseView, name, '同じ授業');
  var made = A.S.notes.filter(function(n){ return n.title === '授業から作ったメモ'; })[0];
  ok(made && made.link && made.link.id === name, 'メモは授業に紐づいて保存');
  /* 授業の画面の一覧から開いたときも */
  act(A, '#app [data-act="note-open"][data-id="' + made.id + '"]');
  eq(A.noteView, made.id, 'メモを開く');
  act(A, '[data-act="note-back"]');
  ok(A.appId === 'course' && A.courseView === name, 'もう一度もどっても授業の画面');
  /* 何も書かずにもどったメモは、のこさずに授業の画面へ */
  var n0 = A.S.notes.length;
  act(A, '[data-act="note-new"][data-link-type="course"]');
  act(A, '[data-act="note-back"]');
  ok(A.appId === 'course' && A.S.notes.length === n0, '空のメモはのこさない');
  /* 削除しても授業の画面へ */
  act(A, '#app [data-act="note-open"][data-id="' + made.id + '"]');
  act(A, '[data-act="note-del"]');
  ok(A.appId === 'course' && A.courseView === name, '削除したあとも授業の画面');
  /* メモの一覧から開いたときは一覧へ */
  var now = Date.now();
  A.S.notes.push(J(A, { id:'nt_lst', title:'一覧のメモ', body:'', pinned:0, checks:[], photos:[], link:null, ct:now, mt:now }));
  openNotes(A);
  act(A, '[data-act="note-open"][data-id="nt_lst"]');
  ok(/メモ一覧/.test(doc.querySelector('[data-act="note-back"]').textContent), '一覧から来たら「メモ一覧」');
  act(A, '[data-act="note-back"]');
  ok(A.appId === 'notes' && !A.noteView, 'メモの一覧にもどる');
  A.removeItem('notes', 'nt_lst'); A.appId = 'today'; A.courseView = ''; A.commit();
});

KT.test('メモ：「ファイル」に保存したPDF・Word なども、写真といっしょにつけられて、アプリの中で見られる', async function(){
  var A = KT.frames().A, doc = A.document, now = Date.now();
  KT.freshWrites([A, KT.frames().B]);
  A.S.notes.push(J(A, { id:'nt_att', title:'資料つきメモ', body:'', pinned:0, checks:[], photos:[], link:null, ct:now, mt:now }));
  openNotes(A);
  act(A, '[data-act="note-open"][data-id="nt_att"]');
  var picked = null, realClick = A.HTMLInputElement.prototype.click;
  A.HTMLInputElement.prototype.click = function(){ if(this.type === 'file'){ picked = this; return; } return realClick.call(this); };
  try{ act(A, '[data-act="note-attach"]'); }finally{ A.HTMLInputElement.prototype.click = realClick; }
  ok(picked && !picked.accept && picked.multiple, '種類をしぼらない（PDFもえらべる）・いくつでも');
  var c = doc.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(0, 0, 40, 30);
  var jpg = await new Promise(function(r){ c.toBlob(r, 'image/jpeg'); });
  var pdf = '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n' +
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n' +
    '4 0 obj << /Length 40 >> stream\nBT /F1 18 Tf 20 40 Td (Orientation) Tj ET\nendstream endobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n';
  var dt = new A.DataTransfer();
  dt.items.add(new A.File([jpg], '板書.jpg', { type:'image/jpeg' }));
  dt.items.add(new A.File([pdf], '授業オリエンテーション.pdf', { type:'application/pdf' }));
  dt.items.add(new A.File(['レポートの下書き'], 'レポート.docx', { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  picked.files = dt.files;
  await picked.onchange();
  await KT.until(function(){ var n = A.S.notes.filter(function(x){ return x.id === 'nt_att'; })[0]; return n && (n.files || []).length === 2 && (n.photos || []).length === 1; }, 5000, '写真1枚・ファイル2つ');
  var n = A.S.notes.filter(function(x){ return x.id === 'nt_att'; })[0];
  eq(n.files.map(function(f){ return f.kind + ':' + f.name; }).join(','), 'pdf:授業オリエンテーション.pdf,file:レポート.docx', 'ファイルの種類と名前');
  ok(/^data:application\/pdf;base64,/.test(await A.photoGet(n.files[0].pid)), 'PDFの中身をしまう');
  A.render();
  eq(doc.querySelectorAll('.nfile').length, 2, 'ファイルが出る');
  ok(/Word/.test(doc.querySelectorAll('.nfile')[1].textContent), 'Word とわかる');
  /* PDF を押すと、アプリの中でページが出る */
  act(A, '.nfile-open[data-pid="' + n.files[0].pid + '"]');
  var sv = doc.getElementById('sylview');
  ok(sv && /資料つきメモ/.test(sv.textContent), '見る画面');
  await KT.until(function(){ return sv.querySelectorAll('canvas.sv-page').length === 1; }, 15000, 'PDFのページ');
  await KT.until(function(){ var a = sv.querySelector('.sv-file a[data-pidlink="' + n.files[1].pid + '"]'); return a && /^blob:/.test(a.getAttribute('href') || ''); }, 4000, 'Word はひらくボタン');
  ok(sv.querySelector('.sv-img[data-pid="' + n.photos[0] + '"]'), '写真もいっしょに');
  sv.querySelector('[data-sv="close"]').click();
  /* 迷子の写真のそうじで消されない・写真の一覧には出さない */
  var fp = A.attachFilePids();
  ok(fp[n.files[0].pid] && fp[n.files[1].pid], 'ファイルは写真あつかいしない');
  eq(A.noteRow(n).indexOf('📎 2') >= 0, true, '一覧に📎の数');
  /* 外す */
  var realConfirm = A.confirm; A.confirm = function(){ return true; };
  try{ act(A, '[data-act="note-file-del"][data-pid="' + n.files[1].pid + '"]'); }finally{ A.confirm = realConfirm; }
  eq(A.S.notes.filter(function(x){ return x.id === 'nt_att'; })[0].files.length, 1, '外す');
  await KT.settle([A, KT.frames().B]);
  var nb = KT.frames().B.S.notes.filter(function(x){ return x.id === 'nt_att'; })[0];
  ok(nb && (nb.files || []).length === 1 && nb.files[0].kind === 'pdf', 'ほかの端末にも届く');
  openNotes(A);
  A.removeItem('notes', 'nt_att'); A.appId = 'today'; A.commit();
});

})();

/* もんだいメーカー：「科目」タブ（科目・資料・問題の整理） */

var lib = { tab:'sub', edit:'', matOpen:'', qEdit:'', del:'', q:'', qtype:'', star:0, qscope:'', fdEdit:'' };
/* qscope … 問題の一覧をしぼる資料・フォルダ（'mat:資料id'・'fd:フォルダid'・'mat:' は資料なし） */
var SUB_PRESETS = ['解剖生理学', '基礎看護学', '基礎看護技術', '看護学概論', '成人看護学', '老年看護学',
                   '小児看護学', '母性看護学', '精神看護学', '地域・在宅看護論', '病理学', '薬理学',
                   '微生物学', '栄養学', '心理学', '社会保障制度', '医療倫理', '公衆衛生学'];

function libView(){
  var h = '<div class="segrow">' +
    [['sub', '科目'], ['mat', '資料'], ['q', '問題']].map(function(t){
      return '<button type="button" data-act="lb-tab" data-v="' + t[0] + '" class="' + (lib.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
    }).join('') + '</div>';
  if(lib.tab === 'sub') return h + libSubView();
  if(lib.tab === 'mat') return h + libMatView();
  return h + libQView();
}
/* ===== 科目 ===== */
function libSubView(){
  var list = subsAll();
  var h = section('科目をふやす', null,
    '<div class="pair">' +
      '<input id="lb_new" type="text" maxlength="40" placeholder="科目の名前（例：解剖生理学）" value="' + esc(inVal('lb_new')) + '">' +
      btn('足す', 'lb-add', { cls:'main' }) +
    '</div>' +
    '<label class="f">よくある科目（押すと足せます）</label>' +
    '<div class="chips">' + SUB_PRESETS.filter(function(n){
      return !list.some(function(s){ return s.name === n; });
    }).map(function(n){
      return '<button type="button" data-act="lb-addp" data-v="' + esc(n) + '">＋ ' + esc(n) + '</button>';
    }).join('') + '</div>');
  if(!list.length) return h + empty('まだ科目がありません。上から足してください。');
  h += '<div class="subs">';
  list.forEach(function(s, i){
    var st = stats(s.id);
    var open = lib.edit === s.id;
    h += '<section class="card sub' + (s.arch ? ' arch' : '') + '" style="--c:' + (s.color ? colorOf(s.color) : '#999') + '">' +
      '<div class="subhd">' +
        '<button type="button" class="nm" data-act="lb-edit" data-id="' + s.id + '">' +
          '<span class="ic">' + esc(s.icon || '📘') + '</span>' +
          '<span class="t"><b>' + esc(s.name) + '</b>' +
          '<span class="s">' + st.total + '問' + (st.due ? '・復習' + st.due : '') + (s.arch ? '・しまってある' : '') +
          (s.field ? '・' + esc(dFieldName(s.field)) : '') + '</span></span>' +
        '</button>' +
        '<span class="mv">' +
          '<button type="button" data-act="lb-up" data-id="' + s.id + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" data-act="lb-down" data-id="' + s.id + '"' + (i === list.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '</span>' +
      '</div>' +
      (open ? libSubEdit(s) : '') +
      '</section>';
  });
  h += '</div>';
  return h;
}
function libSubEdit(s){
  var h = '<div class="subedit">' +
    '<label class="f" for="lb_nm_' + s.id + '">名前</label>' +
    '<div class="pair"><input id="lb_nm_' + s.id + '" type="text" maxlength="40" value="' + esc(inVal('lb_nm_' + s.id, s.name)) + '">' +
      btn('直す', 'lb-rename', { data:{ id:s.id }, cls:'main' }) + '</div>' +
    '<label class="f">アイコン</label>' +
    '<div class="chips icons">' + ICONS.map(function(ic){
      return '<button type="button" data-act="lb-icon" data-id="' + s.id + '" data-v="' + ic + '" class="' + (s.icon === ic ? 'on' : '') + '">' + ic + '</button>';
    }).join('') + '</div>' +
    '<label class="f">色</label>' +
    '<div class="chips colors">' + COLORS.map(function(c){
      return '<button type="button" data-act="lb-color" data-id="' + s.id + '" data-v="' + c.id + '" class="' + (s.color === c.id ? 'on' : '') + '" style="--c:' + c.v + '" aria-label="' + esc(c.name) + '"></button>';
    }).join('') + '</div>' +
    '<label class="f">国試の分野</label>' +
    chips([['', 'なし']].concat(D_FIELDS.map(function(f){ return [f[0], f[1]]; })), s.field || '', 'lb-field', { id:s.id }) +
    '<label class="f" for="lb_tm_' + s.id + '">学期（からでもかまいません）</label>' +
    '<div class="pair"><input id="lb_tm_' + s.id + '" type="text" maxlength="12" placeholder="2026前期" value="' + esc(inVal('lb_tm_' + s.id, s.term || '')) + '">' +
      btn('入れる', 'lb-term', { data:{ id:s.id }, cls:'ghost' }) + '</div>' +
    '<div class="minirow">' +
      '<button type="button" data-act="lb-arch" data-id="' + s.id + '">' + (s.arch ? 'もどす' : 'しまう') + '</button>' +
      '<button type="button" data-act="lb-del" data-id="' + s.id + '">けす</button>' +
    '</div>';
  if(lib.del === s.id){
    var st = stats(s.id);
    h += '<div class="warn">「' + esc(s.name) + '」には、資料' + matsOf(s.id).length + 'つ・問題' + st.total + '問があります。どうしますか？</div>' +
      '<div class="pair">' +
        btn('科目だけ消す（問題はのこす）', 'lb-del-keep', { data:{ id:s.id }, cls:'ghost' }) +
        btn('ぜんぶ消す', 'lb-del-all', { data:{ id:s.id }, cls:'bad' }) +
      '</div>' + btn('やめる', 'lb-del-no', { cls:'ghost' });
  }
  return h + '</div>';
}
/* ===== 資料（科目の中で、フォルダに分けられる） ===== */
function libMatCard(m){
  var open = lib.matOpen === m.id;
  return '<section class="card mat">' +
    '<button type="button" class="mathd" data-act="lb-mat" data-id="' + m.id + '">' +
      '<b>' + esc(m.title) + '</b>' +
      '<span class="s">' + esc(fKindName(m.kind)) + '・' + qsOfMat(m.id).length + '問' +
      (m.sub && !curSub() ? '・' + esc(subName(m.sub)) : '') + '</span>' +
    '</button>' +
    (open ? libMatDetail(m) : '') +
    '</section>';
}
function libMatView(){
  var subId = curSub();
  var list = subId === 'none' ? matsByName('').filter(function(m){ return !m.sub; }) : matsByName(subId);
  var h = section('資料', list.length + 'つ', subChips('lb-sub', subId, true) +
    (subId && subId !== 'none' ? '' : '<div class="s">科目をえらぶと、資料をフォルダに分けられます。</div>'));
  /* 科目をえらんでいるとき：フォルダ */
  if(subId && subId !== 'none'){
    var fds = fdsOf(subId);
    h += section('フォルダ', fds.length ? fds.length + 'こ' : null,
      '<div class="pair">' +
        '<input id="lb_fdnew" type="text" maxlength="40" placeholder="フォルダの名前" value="' + esc(inVal('lb_fdnew')) + '">' +
        btn('作る', 'lb-fdadd', { cls:'main' }) +
      '</div>' +
      note('資料をひらいて「フォルダ」をえらぶと、そのフォルダに入ります。「とく」タブで、フォルダごとに出題できます。'));
    if(!list.length) return h + empty('資料はまだありません。「つくる」タブから読みこめます。');
    fds.forEach(function(fd){
      var inF = list.filter(function(m){ return matFd(m) === fd.id; });
      var editing = lib.fdEdit === fd.id;
      h += '<h3 class="grp fdhd">📁 ' + esc(fd.name) + ' <small>' + inF.length + 'つ</small>' +
        '<span class="fdbtns">' +
          '<button type="button" data-act="lb-fdgo" data-id="' + fd.id + '"' + (scopeFilter(qsOf(subId), subId, ['fd:' + fd.id]).length ? '' : ' disabled') + '>▶ とく</button>' +
          '<button type="button" data-act="lb-fdedit" data-id="' + fd.id + '">' + (editing ? 'とじる' : '直す') + '</button>' +
        '</span></h3>';
      if(editing){
        h += '<div class="card fdedit"><div class="pair">' +
          '<input id="lb_fdnm_' + fd.id + '" type="text" maxlength="40" value="' + esc(inVal('lb_fdnm_' + fd.id, fd.name)) + '">' +
          btn('名前を直す', 'lb-fdrename', { data:{ id:fd.id }, cls:'main' }) + '</div>' +
          '<div class="minirow"><button type="button" data-act="lb-fddel" data-id="' + fd.id + '">このフォルダを消す（中の資料はのこす）</button></div></div>';
      }
      h += inF.length ? inF.map(libMatCard).join('') : '<div class="s">まだ資料が入っていません。</div>';
    });
    var loose = list.filter(function(m){ return !matFd(m); });
    if(loose.length){
      if(fds.length) h += '<h3 class="grp">フォルダに入れていない資料 <small>' + loose.length + 'つ</small></h3>';
      h += loose.map(libMatCard).join('');
    }
    return h;
  }
  if(!list.length) return h + empty('資料はまだありません。「つくる」タブから読みこめます。');
  return h + list.map(libMatCard).join('');
}
function libMatDetail(m){
  var h = '<div class="matbd">';
  h += '<label class="f" for="lb_mtt_' + m.id + '">名前</label>' +
    '<div class="pair"><input id="lb_mtt_' + m.id + '" type="text" maxlength="60" value="' + esc(inVal('lb_mtt_' + m.id, m.title)) + '">' +
    btn('直す', 'lb-matname', { data:{ id:m.id }, cls:'main' }) + '</div>';
  if(m.sub && fdsOf(m.sub).length){
    h += '<label class="f">フォルダ</label>' +
      chips([['', 'なし']].concat(fdsOf(m.sub).map(function(f){ return [f.id, '📁 ' + f.name]; })), matFd(m), 'lb-matfd', { id:m.id });
  }
  var links = (m.links || []).filter(function(u){ return /^https?:\/\//i.test(String(u)); });
  if(links.length) h += '<div class="s">リンク：' + links.map(function(u){
    return '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(linkName(u)) + '</a>';
  }).join('　') + '</div>';
  if(m.summary) h += '<div class="s">' + esc(m.summary) + '</div>';
  if((m.photos || []).length){
    h += '<div class="thumbs">' + m.photos.map(function(pid){
      return '<img data-pid="' + esc(pid) + '" alt="資料の写真">';
    }).join('') + '</div>';
  }
  if(m.text) h += '<details><summary>取り出した字（' + m.text.length + '文字' + (m.cut ? '・とちゅうまで' : '') + '）</summary><pre>' + esc(m.text.slice(0, 3000)) + '</pre></details>';
  var nq = qsOfMat(m.id).length;
  h += '<div class="minirow">' +
    '<button type="button" data-act="lb-matgo" data-id="' + m.id + '"' + (nq ? '' : ' disabled') + '>▶ この資料からとく</button>' +
    '<button type="button" data-act="lb-matq" data-id="' + m.id + '">この資料の問題を見る</button>' +
    '<button type="button" data-act="lb-matdel" data-id="' + m.id + '">けす</button>' +
    '</div></div>';
  return h;
}
/* ===== 問題 ===== */
function libQList(){
  var subId = curSub();
  var list = subId === 'none' ? qsAll().filter(function(x){ return !x.sub; }) : qsOf(subId);
  if(lib.qtype) list = list.filter(function(q){ return q.qt === lib.qtype; });
  if(lib.star) list = list.filter(function(q){ return q.star; });
  if(lib.qscope) list = scopeFilter(list, subId, [lib.qscope]);
  var nq = norm(lib.q);
  if(nq) list = list.filter(function(q){ return norm(q.q + ' ' + answerText(q) + ' ' + (q.tag || '')).indexOf(nq) >= 0; });
  return list.sort(function(a, b){ return toNum(b.mt) - toNum(a.mt); });
}
function libQView(){
  var subId = curSub();
  var list = libQList();
  var h = section('問題', list.length + '問',
    subChips('lb-sub', subId, true) +
    libQScopeChips(subId) +
    '<div class="chips">' +
      '<button type="button" data-act="lb-qtype" data-v="" class="' + (!lib.qtype ? 'on' : '') + '">すべての種類</button>' +
      Q_TYPES.map(function(t){
        return '<button type="button" data-act="lb-qtype" data-v="' + t[0] + '" class="' + (lib.qtype === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
      }).join('') +
      '<button type="button" data-act="lb-star" class="' + (lib.star ? 'on' : '') + '">★だけ</button>' +
    '</div>' +
    '<input id="lb_q" type="search" placeholder="ことばでさがす" value="' + esc(inVal('lb_q', lib.q)) + '" data-act="lb-search">');
  if(!list.length) return h + empty('問題が見つかりません。');
  list.slice(0, 100).forEach(function(q){
    var l = logOf(q.id) || {};
    var open = lib.qEdit === q.id;
    var qm = q.mat ? mat(q.mat) : null;
    h += '<section class="card q">' + qHead(q) +
      (qm ? '<div class="s qmat">📄 ' + esc(qm.title) + (matFd(qm) ? '（📁 ' + esc(fdName(qm.sub, matFd(qm))) + '）' : '') + '</div>' : '') +
      '<div class="qq">' + nl2br(q.q) + '</div>' +
      '<div class="ans">答え：' + nl2br(answerText(q)) + '</div>' +
      (q.exp ? '<div class="exp">' + nl2br(q.exp) + '</div>' : '') +
      '<div class="s">といた' + toNum(l.n) + '回・まちがい' + toNum(l.miss) + '回' +
        (l.due ? '・次は' + mdText(l.due) : '') + (q.pg ? '・' + esc(q.pg) : '') + '</div>' +
      '<div class="minirow">' +
        '<button type="button" data-act="lb-qedit" data-id="' + q.id + '">' + (open ? 'とじる' : '直す') + '</button>' +
        '<button type="button" data-act="dr-starq" data-id="' + q.id + '">' + (q.star ? '★' : '☆') + '</button>' +
        '<button type="button" data-act="lb-qdel" data-id="' + q.id + '">けす</button>' +
      '</div>' +
      (open ? libQEdit(q) : '') +
      srcLine(q.src) +
      '</section>';
  });
  if(list.length > 100) h += note('はじめの100問だけ出しています。');
  return h;
}
/* 問題の一覧を、資料（ファイル）・フォルダごとに分けて見る */
function libQScopeChips(subId){
  if(!subId || subId === 'none') return '';
  var mats = matsByName(subId), fds = fdsOf(subId), all = qsOf(subId);
  if(!mats.length) return '';
  var cur = scopeKeys(subId, lib.qscope ? [lib.qscope] : [])[0] || '';
  var list = [['', 'すべての資料']];
  fds.forEach(function(fd){
    list.push(['fd:' + fd.id, '📁 ' + fd.name]);
    mats.filter(function(m){ return matFd(m) === fd.id; }).forEach(function(m){ list.push(['mat:' + m.id, '📄 ' + m.title]); });
  });
  mats.filter(function(m){ return !matFd(m); }).forEach(function(m){ list.push(['mat:' + m.id, '📄 ' + m.title]); });
  if(scopeFilter(all, subId, ['mat:']).length) list.push(['mat:', '資料なし']);
  return '<label class="f">資料（ファイル）ごとに見る</label>' +
    '<div class="chips">' + list.map(function(c){
      var n = c[0] ? scopeFilter(all, subId, [c[0]]).length : all.length;
      return '<button type="button" data-act="lb-qscope" data-v="' + esc(c[0]) + '" class="' + (cur === c[0] ? 'on' : '') + '">' +
        esc(c[1]) + ' <small>' + n + '問</small></button>';
    }).join('') + '</div>';
}
function libQEdit(q){
  return '<div class="qedit">' +
    '<label class="f" for="lb_qq_' + q.id + '">問題文</label>' +
    '<textarea id="lb_qq_' + q.id + '" rows="2">' + esc(inVal('lb_qq_' + q.id, q.q)) + '</textarea>' +
    ((q.qt === 'cloze' || q.qt === 'short' || q.qt === 'calc')
      ? '<label class="f" for="lb_qa_' + q.id + '">答え</label><input id="lb_qa_' + q.id + '" type="text" value="' + esc(inVal('lb_qa_' + q.id, q.at)) + '">'
      : '') +
    ((q.qt === 'mc' || q.qt === 'tf')
      ? '<label class="f" for="lb_qc2_' + q.id + '">選択肢（1行に1つ）</label>' +
        '<textarea id="lb_qc2_' + q.id + '" rows="4">' + esc(inVal('lb_qc2_' + q.id, (q.c || []).join('\n'))) + '</textarea>' +
        '<label class="f" for="lb_qn_' + q.id + '">正解の番号（上から1・2・3…。2つ選ぶときは 1,3 のように）</label>' +
        '<input id="lb_qn_' + q.id + '" type="text" inputmode="numeric" value="' +
          esc(inVal('lb_qn_' + q.id, (q.a || []).map(function(i){ return i + 1; }).join(','))) + '">'
      : '') +
    '<label class="f" for="lb_qe_' + q.id + '">解説</label>' +
    '<textarea id="lb_qe_' + q.id + '" rows="2">' + esc(inVal('lb_qe_' + q.id, q.exp || '')) + '</textarea>' +
    (q.sub && matsOf(q.sub).length
      ? '<label class="f">どの資料（ファイル）の問題？</label>' +
        chips([['', '資料なし']].concat(matsByName(q.sub).map(function(m){ return [m.id, '📄 ' + m.title]; })),
          (q.mat && mat(q.mat) && mat(q.mat).sub === q.sub) ? q.mat : '', 'lb-qmat', { id:q.id })
      : '') +
    '<label class="f">科目をうつす</label>' +
    subChips('lb-qsub', q.sub || '', false, { id:q.id }) +
    '<div class="pair">' + btn('直す', 'lb-qsave', { data:{ id:q.id }, cls:'main' }) + '</div>' +
    '</div>';
}

/* ============================== 操作 ============================== */
onView('lib', libView);
onAct('lb-tab', function(d){ lib.tab = d.v; render(); });
onAct('lb-sub', function(d){ if(view.sub !== d.v){ lib.qscope = ''; lib.fdEdit = ''; } view.sub = d.v; render(); });
onAct('lb-qscope', function(d){ lib.qscope = String(d.v || ''); render(); });
onAct('lb-add', function(){
  var name = String(elVal('lb_new') || '').trim();
  if(!name){ toast('名前を入れてください', true); return; }
  var s = subAdd(name);
  if(!s){ toast('足せませんでした', true); return; }
  inClear('lb_new');
  saveNow();
  toast('「' + s.name + '」を足しました');
  render();
});
onAct('lb-addp', function(d){
  var s = subAdd(d.v);
  if(s){ saveNow(); toast('「' + s.name + '」を足しました'); render(); }
});
onAct('lb-edit', function(d){ lib.edit = (lib.edit === d.id) ? '' : d.id; lib.del = ''; render(); });
onAct('lb-up', function(d){ if(subMove(d.id, -1)){ saveNow(); render(); } });
onAct('lb-down', function(d){ if(subMove(d.id, 1)){ saveNow(); render(); } });
onAct('lb-rename', function(d){
  var name = String(elVal('lb_nm_' + d.id) || '').trim();
  if(!subRename(d.id, name)){ toast('その名前は使えません（同じ名前があるかもしれません）', true); return; }
  inClear('lb_nm_');
  saveNow();
  toast('名前を直しました');
  render();
});
onAct('lb-icon', function(d){ subSet(d.id, 'icon', d.v); saveNow(); render(); });
onAct('lb-color', function(d){ subSet(d.id, 'color', d.v); saveNow(); render(); });
onAct('lb-field', function(d){ subSet(d.id, 'field', d.v); saveNow(); render(); });
onAct('lb-term', function(d){ subSet(d.id, 'term', String(elVal('lb_tm_' + d.id) || '').trim()); saveNow(); toast('学期を入れました'); render(); });
onAct('lb-arch', function(d){
  var s = sub(d.id);
  if(!s) return;
  subSet(d.id, 'arch', s.arch ? 0 : 1);
  saveNow();
  render();
});
onAct('lb-del', function(d){ lib.del = d.id; render(); });
onAct('lb-del-no', function(){ lib.del = ''; render(); });
onAct('lb-del-keep', function(d){
  var name = subName(d.id);
  subDel(d.id, false);
  lib.del = ''; lib.edit = '';
  saveNow();
  toast('「' + name + '」を消しました（問題はのこしています）');
  render();
});
onAct('lb-del-all', function(d){
  var name = subName(d.id);
  var n = subDel(d.id, true);
  lib.del = ''; lib.edit = '';
  saveNow();
  toast('「' + name + '」と、中の' + n + '件を消しました');
  render();
});
onAct('lb-mat', function(d){ lib.matOpen = (lib.matOpen === d.id) ? '' : d.id; render(); });
onAct('lb-matdel', function(d){
  if(!ask('この資料を消しますか？（作った問題はのこります）')) return;
  matDel(d.id);
  lib.matOpen = '';
  saveNow();
  render();
});
onAct('lb-matq', function(d){
  var m = mat(d.id);
  if(!m) return;
  lib.tab = 'q';
  lib.q = ''; inClear('lb_q');
  view.sub = m.sub || 'none';
  lib.qscope = m.sub ? 'mat:' + m.id : '';
  render();
});
/* 資料・フォルダから、そのまま「とく」へ（出題範囲をそれだけにする） */
function libGoDrill(subId, key){
  view.sub = subId; drill.scope = [key]; view.weak = 0; view.moc = 0;
  drill.mode = pool(subId, 'due', drill.scope).length ? 'due' : pool(subId, 'new', drill.scope).length ? 'new' : 'all';
  go('drill');
}
onAct('lb-matgo', function(d){ var m = mat(d.id); if(m && m.sub) libGoDrill(m.sub, 'mat:' + m.id); });
onAct('lb-fdgo', function(d){ var subId = curSub(); if(fdGet(subId, d.id)) libGoDrill(subId, 'fd:' + d.id); });
onAct('lb-matname', function(d){
  if(!matRename(d.id, elVal('lb_mtt_' + d.id))){ toast('名前を入れてください', true); return; }
  inClear('lb_mtt_' + d.id);
  saveNow();
  toast('名前を直しました');
  render();
});
onAct('lb-matfd', function(d, el){
  var id = d.id || el.dataset.id;
  if(!matSetFd(id, String(d.v || ''))) return;
  saveNow();
  var m = mat(id);
  toast(matFd(m) ? '「' + fdName(m.sub, matFd(m)) + '」に入れました' : 'フォルダから出しました');
  render();
});
onAct('lb-fdadd', function(){
  var subId = curSub(), name = String(elVal('lb_fdnew') || '').trim();
  if(!subId || subId === 'none'){ toast('先に科目をえらんでください', true); return; }
  if(!name){ toast('フォルダの名前を入れてください', true); return; }
  var f = fdAdd(subId, name);
  if(!f){ toast('作れませんでした', true); return; }
  inClear('lb_fdnew');
  saveNow();
  toast('フォルダ「' + f.name + '」を作りました');
  render();
});
onAct('lb-fdedit', function(d){ lib.fdEdit = lib.fdEdit === d.id ? '' : d.id; render(); });
onAct('lb-fdrename', function(d){
  if(!fdRename(curSub(), d.id, elVal('lb_fdnm_' + d.id))){ toast('その名前は使えません（からか、同じ名前のフォルダがあります）', true); return; }
  inClear('lb_fdnm_' + d.id);
  lib.fdEdit = '';
  saveNow();
  toast('フォルダの名前を直しました');
  render();
});
onAct('lb-fddel', function(d){
  var subId = curSub(), name = fdName(subId, d.id);
  if(!name || !ask('フォルダ「' + name + '」を消しますか？（中の資料と問題はのこります）')) return;
  fdDel(subId, d.id);
  lib.fdEdit = '';
  if(lib.qscope === 'fd:' + d.id) lib.qscope = '';
  saveNow();
  toast('フォルダを消しました');
  render();
});
onAct('lb-qmat', function(d, el){
  var q = qGet(d.id || el.dataset.id);
  if(!q) return;
  var m = d.v ? mat(d.v) : null;
  q.mat = (m && m.sub === q.sub) ? m.id : '';
  q.mt = Date.now();
  saveNow();
  render();
});
onAct('lb-qtype', function(d){ lib.qtype = d.v; render(); });
onAct('lb-star', function(){ lib.star = lib.star ? 0 : 1; render(); });
onAct('lb-search', function(d, el){ lib.q = el.value; renderLater(); });
onAct('lb-qedit', function(d){ lib.qEdit = (lib.qEdit === d.id) ? '' : d.id; render(); });
onAct('lb-qsub', function(d, el){
  var q = qGet(d.id || el.dataset.id);
  if(!q) return;
  q.sub = el.dataset.v;
  /* ほかの科目にうつしたら、前の科目の資料とのつながりは外す */
  var qm = q.mat ? mat(q.mat) : null;
  if(qm && qm.sub !== q.sub) q.mat = '';
  q.mt = Date.now();
  saveNow();
  render();
});
onAct('lb-qsave', function(d){
  var q = qGet(d.id);
  if(!q) return;
  var text = String(elVal('lb_qq_' + q.id) || '').trim();
  if(text) q.q = text.slice(0, 500);
  if(q.qt === 'cloze' || q.qt === 'short' || q.qt === 'calc'){
    var a = String(elVal('lb_qa_' + q.id) || '').trim();
    if(a) q.at = a.slice(0, 200);
  }
  if(q.qt === 'mc' || q.qt === 'tf'){
    var cs = String(elVal('lb_qc2_' + q.id) || '').split('\n')
      .map(function(t){ return t.trim().slice(0, 200); }).filter(Boolean);
    var ans = String(elVal('lb_qn_' + q.id) || '').split(/[,、\s]+/)
      .map(function(t){ return toNum(t) - 1; })
      .filter(function(i){ return i >= 0 && i < cs.length; });
    if(cs.length >= 2 && ans.length){
      q.c = cs;
      q.a = ans.filter(function(v, i, ar){ return ar.indexOf(v) === i; });
    }else if(cs.length >= 2 || ans.length){
      toast('選択肢は2つ以上、正解の番号はその中から入れてください', true);
      return;
    }
  }
  q.exp = String(elVal('lb_qe_' + q.id) || '').slice(0, 600);
  q.mt = Date.now();
  lib.qEdit = '';
  /* 直した問題の入力だけ消す（「ことばでさがす」の字はのこす） */
  ['lb_qq_', 'lb_qa_', 'lb_qc2_', 'lb_qn_', 'lb_qe_'].forEach(function(p){ inClear(p + q.id); });
  saveNow();
  toast('直しました');
  render();
});
onAct('lb-qdel', function(d){
  if(!ask('この問題を消しますか？')) return;
  qDel(d.id);
  saveNow();
  render();
});

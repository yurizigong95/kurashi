/* もんだいメーカー：「科目」タブ（科目・資料・問題の整理） */

var lib = { tab:'sub', edit:'', matOpen:'', qEdit:'', del:'', q:'', qtype:'', star:0, matFilter:'' };
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
  h += '<label class="f">章（単元）の見本</label>' +
    '<div class="s">' + esc(dUnitsFor(s.name).units.join('、')) + '</div>';
  return h + '</div>';
}
/* ===== 資料 ===== */
function libMatView(){
  var subId = curSub();
  var list = matsOf(subId === 'none' ? '' : subId).filter(function(m){ return subId !== 'none' || !m.sub; });
  var h = section('資料', list.length + 'つ', subChips('lb-sub', subId, true));
  if(!list.length) return h + empty('資料はまだありません。「つくる」タブから読みこめます。');
  /* 第◯回でまとめる */
  var groups = {}, order = [];
  list.forEach(function(m){
    var k = m.no ? '第' + m.no + '回' : 'そのほか';
    if(!groups[k]){ groups[k] = []; order.push(k); }
    groups[k].push(m);
  });
  order.sort(function(a, b){
    var na = numOf(a), nb = numOf(b);
    if(isFinite(na) && isFinite(nb)) return na - nb;
    return isFinite(na) ? -1 : isFinite(nb) ? 1 : 0;
  });
  order.forEach(function(k){
    h += '<h3 class="grp">' + esc(k) + '</h3>';
    groups[k].forEach(function(m){
      var open = lib.matOpen === m.id;
      h += '<section class="card mat">' +
        '<button type="button" class="mathd" data-act="lb-mat" data-id="' + m.id + '">' +
          '<b>' + esc(m.title) + '</b>' +
          '<span class="s">' + mdText(m.at) + '・' + esc(fKindName(m.kind)) + '・' + qsOfMat(m.id).length + '問' +
          (m.sub ? '・' + esc(subName(m.sub)) : '') + '</span>' +
        '</button>' +
        (open ? libMatDetail(m) : '') +
        '</section>';
    });
  });
  return h;
}
function libMatDetail(m){
  var h = '<div class="matbd">';
  if(m.memo) h += '<div class="s">メモ：' + esc(m.memo) + '</div>';
  if(m.summary) h += '<div class="s">' + esc(m.summary) + '</div>';
  if((m.photos || []).length){
    h += '<div class="thumbs">' + m.photos.map(function(pid){
      return '<img data-pid="' + esc(pid) + '" alt="資料の写真">';
    }).join('') + '</div>';
  }
  if(m.text) h += '<details><summary>取り出した字（' + m.text.length + '文字' + (m.cut ? '・とちゅうまで' : '') + '）</summary><pre>' + esc(m.text.slice(0, 3000)) + '</pre></details>';
  h += '<div class="minirow">' +
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
  if(lib.matFilter) list = list.filter(function(q){ return q.mat === lib.matFilter; });
  if(view.unit) list = list.filter(function(q){ return q.ch === view.unit; });
  var nq = norm(lib.q);
  if(nq) list = list.filter(function(q){ return norm(q.q + ' ' + answerText(q) + ' ' + (q.tag || '')).indexOf(nq) >= 0; });
  return list.sort(function(a, b){ return toNum(b.mt) - toNum(a.mt); });
}
function libQView(){
  var subId = curSub();
  var list = libQList();
  var h = section('問題', list.length + '問',
    subChips('lb-sub', subId, true) +
    (unitsOf(subId).length ? chips([['', 'ぜんぶの章']].concat(unitsOf(subId).map(function(u){ return [u, u]; })), view.unit || '', 'lb-unit') : '') +
    '<div class="chips">' +
      '<button type="button" data-act="lb-qtype" data-v="" class="' + (!lib.qtype ? 'on' : '') + '">すべての種類</button>' +
      Q_TYPES.map(function(t){
        return '<button type="button" data-act="lb-qtype" data-v="' + t[0] + '" class="' + (lib.qtype === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
      }).join('') +
      '<button type="button" data-act="lb-star" class="' + (lib.star ? 'on' : '') + '">★だけ</button>' +
    '</div>' +
    '<input id="lb_q" type="search" placeholder="ことばでさがす" value="' + esc(inVal('lb_q', lib.q)) + '" data-act="lb-search">' +
    (lib.matFilter && mat(lib.matFilter)
      ? '<div class="s">「' + esc(mat(lib.matFilter).title) + '」の問題だけ出しています　' +
        '<button type="button" class="link" data-act="lb-matclear">ぜんぶ出す</button></div>'
      : ''));
  if(!list.length) return h + empty('問題が見つかりません。');
  list.slice(0, 100).forEach(function(q){
    var l = logOf(q.id) || {};
    var open = lib.qEdit === q.id;
    h += '<section class="card q">' + qHead(q) +
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
    '<label class="f" for="lb_qc_' + q.id + '">章（単元）</label>' +
    '<input id="lb_qc_' + q.id + '" type="text" maxlength="40" value="' + esc(inVal('lb_qc_' + q.id, q.ch || '')) + '" list="lb_units">' +
    '<datalist id="lb_units">' + unitsOf(q.sub).concat(dUnitsFor(subName(q.sub)).units).map(function(u){
      return '<option value="' + esc(u) + '">';
    }).join('') + '</datalist>' +
    '<label class="f">科目をうつす</label>' +
    subChips('lb-qsub', q.sub || '', false, { id:q.id }) +
    '<div class="pair">' + btn('直す', 'lb-qsave', { data:{ id:q.id }, cls:'main' }) + '</div>' +
    '</div>';
}

/* ============================== 操作 ============================== */
onView('lib', libView);
onAct('lb-tab', function(d){ lib.tab = d.v; if(d.v !== 'q') lib.matFilter = ''; render(); });
onAct('lb-sub', function(d){ view.sub = d.v; view.unit = ''; render(); });
onAct('lb-unit', function(d){ view.unit = d.v; render(); });
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
  lib.tab = 'q';
  lib.q = '';
  var m = mat(d.id);
  if(m){ view.sub = m.sub || ''; }
  lib.matFilter = d.id;
  render();
});
onAct('lb-matclear', function(){ lib.matFilter = ''; render(); });
onAct('lb-qtype', function(d){ lib.qtype = d.v; render(); });
onAct('lb-star', function(){ lib.star = lib.star ? 0 : 1; render(); });
onAct('lb-search', function(d, el){ lib.q = el.value; renderLater(); });
onAct('lb-qedit', function(d){ lib.qEdit = (lib.qEdit === d.id) ? '' : d.id; render(); });
onAct('lb-qsub', function(d, el){
  var q = qGet(d.id || el.dataset.id);
  if(!q) return;
  q.sub = el.dataset.v;
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
  q.ch = String(elVal('lb_qc_' + q.id) || '').slice(0, 40);
  q.mt = Date.now();
  lib.qEdit = '';
  inClear('lb_q');
  inClear('lb_qn_');
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

/* もんだいメーカー：中身（科目・資料・問題・記録）
   ============================================================
   ・科目 subject … { id, name, icon, ord, color, term, field, arch, fds:[{ id, name }]（資料のフォルダ） }
   ・資料 mat     … { id, sub, fd:'フォルダid', title, kind, sig, photos:[写真id], text, cut, n }
                    （前の版の資料には at・no・memo が入っていることがある。今は使わない）
   ・問題 q       … { id, sub, mat, qt, q, c:[選択肢], a:[正解の番号], at:'答え', alt:[別の言い方],
                      pairs:[[左,右]], un:'単位', tol:許容％, how:'式', exp:'解説', src:'出典',
                      lv:1〜3, tag:'小見出し', ch:'章', pg:'どこから', star:0/1, pid:写真id }
   ・記録 S.log[問題id] … { n, ok, miss, res, box:0〜6, due:'次に出す日', last:'最後の日' }
   ・S.day['YYYY-MM-DD'] … { n, ok }（その日にといた数） */

var Q_TYPES = [
  ['mc', '4択', '選択肢からえらぶ'],
  ['tf', '○×', '正しいかどうか'],
  ['cloze', '穴うめ', '（　）に入ることば'],
  ['short', '記述', '1〜2文で答える'],
  ['order', '並べかえ', '手順を正しい順に'],
  ['match', '組み合わせ', '左と右をむすぶ'],
  ['calc', '計算', '数で答える']
];
var AI_TYPES = ['mc', 'tf', 'cloze', 'short', 'order', 'match'];
var IVL = [1, 3, 7, 14, 30, 60];      /* 正解がつづくと、次に出すまでの日をのばす（まちがえたら次の日） */
var NUMS = ['①', '②', '③', '④', '⑤', '⑥'];
var ICONS = ['📘', '🫀', '🧠', '💊', '🩺', '🦴', '🧪', '🧬', '👶', '🤰', '🧓', '🏥', '🌏', '⚖️', '🍚', '💬', '📗', '📙', '📕', '📓'];
var SRC_AI = 'AIが資料から作成（教科書・先生の資料で確かめて）';
var WARN_PRIVACY = '⚠️ 実習記録など、<b>患者さんの情報が書いてある資料は読みこまないでください</b>。AI（Gemini）に送られます。';

function typeName(qt){
  for(var i = 0; i < Q_TYPES.length; i++) if(Q_TYPES[i][0] === qt) return Q_TYPES[i][1];
  return '問題';
}
/* 答え方のグループ（画面の作り方が変わる） */
function qKind(q){
  if(q.qt === 'order' || q.qt === 'match' || q.qt === 'calc') return q.qt;
  if(q.qt === 'cloze' || q.qt === 'short') return 'text';
  return 'choice';
}

/* ============================== 科目 ============================== */
function subSort(a, b){ return (toNum(a.ord) - toNum(b.ord)) || String(a.id).localeCompare(String(b.id)); }
function subsAll(){ return (S.subs || []).slice().sort(subSort); }
function subs(){ return subsAll().filter(function(x){ return !x.arch && termOk(x); }); }
function sub(id){ return subsAll().filter(function(x){ return x.id === id; })[0] || null; }
function subName(id){ var s = sub(id); return s ? s.name : 'そのほか'; }
function subIcon(id){ var s = sub(id); return (s && s.icon) || '📘'; }
function subLabel(id){ return subIcon(id) + ' ' + subName(id); }
function subColor(id){ var s = sub(id); return (s && s.color) ? colorOf(s.color) : ''; }
/* いまの学期の科目だけ出す（学期を決めていない科目は、いつも出す） */
function termOk(x){
  if(!x || !x.term) return true;
  if(S.set.allTerms) return true;
  if(!S.set.term) return true;
  return x.term === S.set.term;
}
function curSub(){
  var id = view.sub || '';
  if(id && id !== 'none' && (!sub(id) || sub(id).arch)){ view.sub = ''; return ''; }
  return id;
}
/* 問題を入れる先の科目（えらんでいなければ、前に使った科目・なければ いちばん上） */
function mkSubId(){
  var id = curSub();
  if(id && id !== 'none') return id;
  var last = String((S.ui && S.ui.lastSub) || '');
  if(last && sub(last) && !sub(last).arch) return last;
  var first = subs()[0];
  return first ? first.id : '';
}
function subAdd(name, icon, color){
  name = String(name == null ? '' : name).trim().slice(0, 40);
  if(!name) return null;
  var dup = subsAll().filter(function(x){ return x.name === name; })[0];
  if(dup){
    if(dup.arch){ dup.arch = 0; dup.mt = Date.now(); saveSoon(); }
    return dup;
  }
  var max = 0, n = subsAll().length;
  subsAll().forEach(function(x){ max = Math.max(max, toNum(x.ord)); });
  var o = { id:uid('sub'), mt:Date.now(), name:name, icon:icon || ICONS[n % ICONS.length], ord:max + 10,
            color:color || COLORS[n % COLORS.length].id, term:String(S.set.term || ''), field:dFieldOf(name), arch:0 };
  S.subs.push(o);
  saveSoon();
  return o;
}
function subRename(id, name){
  var s = sub(id);
  name = String(name == null ? '' : name).trim().slice(0, 40);
  if(!s || !name) return false;
  if(subsAll().some(function(x){ return x.id !== id && x.name === name; })) return false;
  s.name = name;
  if(!s.field) s.field = dFieldOf(name);
  s.mt = Date.now();
  saveSoon();
  return true;
}
function subSet(id, key, v){
  var s = sub(id);
  if(!s) return false;
  s[key] = v;
  s.mt = Date.now();
  saveSoon();
  return true;
}
/* 並びの番号を10きざみで付け直す */
function subReorder(){
  subsAll().forEach(function(x, i){
    var v = (i + 1) * 10;
    if(toNum(x.ord) !== v){ x.ord = v; x.mt = Date.now(); }
  });
  saveSoon();
}
/* 上（d=-1）・下（d=1）に動かす */
function subMove(id, d){
  var list = subsAll(), i = -1;
  list.forEach(function(x, k){ if(x.id === id) i = k; });
  var j = i + d;
  if(i < 0 || j < 0 || j >= list.length) return false;
  if(list.some(function(x, k){ return k > 0 && toNum(x.ord) === toNum(list[k - 1].ord); })){
    subReorder();
    list = subsAll();
  }
  var a = list[i], b = list[j], ao = toNum(a.ord);
  a.ord = toNum(b.ord); b.ord = ao;
  a.mt = b.mt = Date.now();
  saveSoon();
  return true;
}
/* 科目を消す（withItems … 中の資料と問題もいっしょに消す） */
function subDel(id, withItems){
  var s = sub(id);
  if(!s) return 0;
  var n = 0;
  if(withItems){
    matsOf(id).forEach(function(m){ matDel(m.id); n++; });
    qsAll().filter(function(q){ return q.sub === id; }).forEach(function(q){ qDel(q.id); n++; });
  }else{
    (S.mats || []).forEach(function(m){ if(m.sub === id){ m.sub = ''; m.mt = Date.now(); } });
    (S.qs || []).forEach(function(q){ if(q.sub === id){ q.sub = ''; q.mt = Date.now(); } });
  }
  /* メモは消さずに、科目なしにする */
  (S.notes || []).forEach(function(x){ if(x.sub === id){ x.sub = ''; x.mt = Date.now(); } });
  S.subs = (S.subs || []).filter(function(x){ return x.id !== id; });
  if(typeof syDead === 'function') syDead(id);
  if(view.sub === id) view.sub = '';
  saveSoon();
  return n;
}

/* ============================== フォルダ（科目の中で、資料を分ける） ==============================
   フォルダは科目の中に持つ（s.fds）。資料は m.fd でフォルダをさす。
   科目といっしょに同期されるので、ほかの端末でも同じフォルダになる。 */
function fdsOf(subId){
  var s = sub(subId);
  return (s && Array.isArray(s.fds)) ? s.fds.filter(function(f){ return f && f.id && String(f.name || '').trim(); }) : [];
}
function fdGet(subId, id){ return id ? fdsOf(subId).filter(function(f){ return f.id === id; })[0] || null : null; }
function fdName(subId, id){ var f = fdGet(subId, id); return f ? f.name : ''; }
function fdAdd(subId, name){
  var s = sub(subId);
  name = String(name == null ? '' : name).trim().slice(0, 40);
  if(!s || !name) return null;
  var dup = fdsOf(subId).filter(function(f){ return f.name === name; })[0];
  if(dup) return dup;
  var f = { id:uid('fd'), name:name };
  s.fds = fdsOf(subId).concat([f]);
  s.mt = Date.now();
  saveSoon();
  return f;
}
function fdRename(subId, id, name){
  var s = sub(subId), f = fdGet(subId, id);
  name = String(name == null ? '' : name).trim().slice(0, 40);
  if(!s || !f || !name) return false;
  if(fdsOf(subId).some(function(x){ return x.id !== id && x.name === name; })) return false;
  s.fds = fdsOf(subId).map(function(x){ return x.id === id ? { id:x.id, name:name } : x; });
  s.mt = Date.now();
  saveSoon();
  return true;
}
/* フォルダを消す（中の資料と問題はのこして、フォルダに入れていない資料にする） */
function fdDel(subId, id){
  var s = sub(subId);
  if(!s || !fdGet(subId, id)) return false;
  s.fds = fdsOf(subId).filter(function(x){ return x.id !== id; });
  s.mt = Date.now();
  (S.mats || []).forEach(function(m){ if(m.sub === subId && m.fd === id){ m.fd = ''; m.mt = Date.now(); } });
  saveSoon();
  return true;
}
/* 資料が入っているフォルダ（ない・消えたフォルダなら ''） */
function matFd(m){ return (m && m.fd && fdGet(m.sub, m.fd)) ? m.fd : ''; }
function matSetFd(id, fd){
  var m = mat(id);
  if(!m) return false;
  m.fd = fdGet(m.sub, fd) ? fd : '';
  m.mt = Date.now();
  saveSoon();
  return true;
}
function matRename(id, title){
  var m = mat(id);
  title = String(title == null ? '' : title).trim().slice(0, 60);
  if(!m || !title) return false;
  m.title = title;
  m.mt = Date.now();
  saveSoon();
  return true;
}

/* ============================== 資料 ============================== */
function matsOf(subId){
  return (S.mats || []).filter(function(x){ return !subId || x.sub === subId; })
    .sort(function(a, b){ return toNum(b.mt) - toNum(a.mt); });
}
function mat(id){ return (S.mats || []).filter(function(x){ return x.id === id; })[0] || null; }
/* 名前の順（「第2回」→「第10回」のように、数字は大きさでならべる） */
function nameCmp(a, b){
  try{ return String(a).localeCompare(String(b), 'ja', { numeric:true, sensitivity:'base' }); }
  catch(e){ return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0; }
}
function matsByName(subId){
  return matsOf(subId).sort(function(a, b){ return nameCmp(a.title, b.title) || (toNum(b.mt) - toNum(a.mt)); });
}
function matDel(id){
  var m = mat(id);
  if(!m) return false;
  (m.photos || []).forEach(function(pid){ photoDel(pid); });
  S.mats = (S.mats || []).filter(function(x){ return x.id !== id; });
  if(typeof syDead === 'function') syDead(id);
  /* 資料につながっていた問題は、資料なしにする（問題は残す） */
  (S.qs || []).forEach(function(q){ if(q.mat === id){ q.mat = ''; q.mt = Date.now(); } });
  saveSoon();
  return true;
}

/* ============================== 問題 ============================== */
function qsAll(){ return (S.qs || []).filter(qOk); }
function qGet(id){ return (S.qs || []).filter(function(x){ return x.id === id; })[0] || null; }
function qsOf(subId){ return qsAll().filter(function(x){ return !subId || x.sub === subId; }); }
function qsOfMat(matId){ return qsAll().filter(function(x){ return x.mat === matId; }); }
function qDel(id){
  S.qs = (S.qs || []).filter(function(x){ return x.id !== id; });
  if(typeof syDead === 'function') syDead(id);
  if(S.log[id]){ delete S.log[id]; }
  if(S.why[id]){ delete S.why[id]; }
  saveSoon();
  return true;
}
/* 使える問題かどうか（こわれた問題は出さない） */
function qOk(x){
  if(!x || !x.q) return false;
  if(x.qt === 'order') return Array.isArray(x.c) && x.c.length >= 3 && x.c.every(function(t){ return !!String(t || '').trim(); });
  if(x.qt === 'match') return Array.isArray(x.pairs) && x.pairs.length >= 2 &&
    x.pairs.every(function(p){ return Array.isArray(p) && String(p[0] || '').trim() && String(p[1] || '').trim(); });
  if(x.qt === 'calc') return String(x.at || '').trim() !== '' && isFinite(numOf(x.at));
  if(x.qt === 'cloze' || x.qt === 'short') return !!String(x.at || '').trim();
  return Array.isArray(x.c) && x.c.length >= 2 && Array.isArray(x.a) && x.a.length > 0 &&
         x.a.every(function(i){ return i >= 0 && i < x.c.length; });
}
function answerText(x){
  if(x.qt === 'order') return (x.c || []).join(' → ');
  if(x.qt === 'match') return (x.pairs || []).map(function(p){ return p[0] + '＝' + p[1]; }).join('／');
  if(x.qt === 'calc') return String(x.at || '') + (x.un ? ' ' + x.un : '');
  if(x.qt === 'cloze' || x.qt === 'short') return String(x.at || '');
  return (Array.isArray(x.a) ? x.a : []).map(function(i){ return (x.c || [])[i]; }).filter(Boolean).join('・');
}
/* 選択肢のならび（毎回いれかえる）・並べかえ／組み合わせの出し方を決める */
function viewOrder(q, run){
  if(run && run.cur === q.id && run.shuf) return run.shuf;
  var n = q.qt === 'match' ? (q.pairs || []).length : (q.c || []).length;
  var idx = [];
  for(var i = 0; i < n; i++) idx.push(i);
  var mix = (q.qt === 'order' || q.qt === 'match') || (q.qt === 'mc' && S.set.shuffle !== 0 && S.set.shuffle !== false);
  if(mix) shuffle(idx);
  if(run){ run.cur = q.id; run.shuf = idx; }
  return idx;
}
/* 答え合わせ */
function gradeChoice(q, picked){
  var right = (q.a || []).slice().sort().join(',');
  var got = (picked || []).slice().sort().join(',');
  return right === got;
}
function gradeText(q, typed){
  var t = norm(typed);
  if(!t) return false;
  var list = [String(q.at || '')].concat(Array.isArray(q.alt) ? q.alt : []);
  return list.some(function(a){
    var n = norm(a);
    return n && (n === t || (n.length >= 3 && (t.indexOf(n) >= 0 || n.indexOf(t) >= 0)));
  });
}
function gradeOrder(q, order){
  if(!Array.isArray(order) || order.length !== (q.c || []).length) return false;
  return order.every(function(v, i){ return v === i; });
}
function gradeMatch(q, picks){
  var pairs = q.pairs || [];
  if(!picks || Object.keys(picks).length < pairs.length) return false;
  return pairs.every(function(p, i){ return toNum(picks[i]) === i; });
}
/* 計算は、ゆるした幅（tol％）の中なら正解。小さい数は、少し多めにゆるす。 */
function gradeCalc(q, typed){
  var got = numOf(typed), want = numOf(q.at);
  if(!isFinite(got) || !isFinite(want)) return false;
  var tol = Math.max(0, toNum(q.tol)) / 100;
  var margin = Math.max(Math.abs(want) * tol, Math.abs(want) < 10 ? 0.05 : 0.5);
  return Math.abs(got - want) <= margin;
}

/* ============================== 記録 ============================== */
function logOf(id){
  var v = (S.log || {})[id];
  return (v && typeof v === 'object') ? v : null;
}
function logAnswer(id, ok){
  var td = today();
  var o = Object.assign({ n:0, ok:0, miss:0, box:0 }, logOf(id) || {});
  o.n = toNum(o.n) + 1;
  if(ok) o.ok = toNum(o.ok) + 1; else o.miss = toNum(o.miss) + 1;
  o.box = ok ? Math.min(IVL.length, toNum(o.box) + 1) : 0;
  o.res = ok ? 1 : 0;
  o.last = td;
  o.due = shiftDate(td, ok ? IVL[Math.max(0, o.box - 1)] : 1);
  o.mt = Date.now();
  S.log[id] = o;
  var d = Object.assign({ n:0, ok:0 }, (S.day || {})[td] || {});
  d.n = toNum(d.n) + 1;
  if(ok) d.ok = toNum(d.ok) + 1;
  S.day[td] = d;
  saveSoon();
  return o;
}
function dayCount(ymd){
  var d = (S.day || {})[ymd];
  return { n:toNum(d && d.n), ok:toNum(d && d.ok) };
}
function streak(){
  var d = today(), n = 0;
  if(!dayCount(d).n) d = shiftDate(d, -1);      /* 今日まだでも、きのうまで続いていれば数える */
  while(dayCount(d).n > 0 && n < 400){ n++; d = shiftDate(d, -1); }
  return n;
}
/* 出題範囲 … [] は科目のぜんぶ。'fd:フォルダid'・'mat:資料id'・'mat:'（資料なし）をいくつでも */
function scopeKeys(subId, scope){
  if(!Array.isArray(scope) || !scope.length || !subId || subId === 'none') return [];
  var mats = {}, fds = {};
  matsOf(subId).forEach(function(m){ mats[m.id] = 1; });
  fdsOf(subId).forEach(function(f){ fds[f.id] = 1; });
  return scope.filter(function(k, i, a){
    k = String(k || '');
    if(a.indexOf(k) !== i) return false;
    if(k === 'mat:') return true;
    if(k.indexOf('mat:') === 0) return !!mats[k.slice(4)];
    if(k.indexOf('fd:') === 0) return !!fds[k.slice(3)];
    return false;
  });
}
function scopeFilter(list, subId, scope){
  var keys = scopeKeys(subId, scope);
  if(!keys.length) return list;
  var fdOf = {};
  matsOf(subId).forEach(function(m){ fdOf[m.id] = matFd(m); });
  return list.filter(function(q){
    var mid = q.mat && fdOf[q.mat] != null ? q.mat : '';     /* 消した資料・ほかの科目の資料は「資料なし」 */
    return keys.some(function(k){
      if(k.indexOf('mat:') === 0) return mid === k.slice(4);
      return !!mid && fdOf[mid] === k.slice(3);
    });
  });
}
/* 出す問題をえらぶ（due 復習の日／new はじめて／wrong まちがえた／star 星／all ぜんぶ）。scope は出題範囲 */
function pool(subId, mode, scope){
  var td = today();
  var list = subId === 'none' ? qsAll().filter(function(x){ return !x.sub; }) : qsOf(subId);
  if(scope) list = scopeFilter(list, subId, scope);
  if(mode === 'due') return list.filter(function(x){ var l = logOf(x.id); return l && l.due && String(l.due) <= td; });
  if(mode === 'new') return list.filter(function(x){ return !logOf(x.id); });
  if(mode === 'wrong') return list.filter(function(x){ var l = logOf(x.id); return l && l.res === 0; });
  if(mode === 'star') return list.filter(function(x){ return !!x.star; });
  return list;
}
function todoCount(subId){ return pool(subId, 'due').length + pool(subId, 'new').length; }
function subTitle(subId){ return subId === 'none' ? '科目なし' : subId ? subName(subId) : 'すべての科目'; }
function stats(subId, scope){
  var list = subId === 'none' ? qsAll().filter(function(x){ return !x.sub; }) : qsOf(subId);
  if(scope) list = scopeFilter(list, subId, scope);
  var n = 0, ok = 0, answered = 0;
  list.forEach(function(x){
    var l = logOf(x.id);
    if(!l) return;
    answered++; n += toNum(l.n); ok += toNum(l.ok);
  });
  return { total:list.length, answered:answered, fresh:list.length - answered, tries:n, ok:ok,
           rate:n ? Math.round(ok * 100 / n) : null,
           due:pool(subId, 'due', scope).length, wrong:pool(subId, 'wrong', scope).length };
}
/* 問題を足す（下書きから本番へ） */
function qAdd(o, subId, matId){
  var q = Object.assign({ qt:'mc', q:'', c:[], a:[], at:'', alt:[], pairs:[], exp:'', src:'', lv:2, tag:'', ch:'', pg:'', star:0 }, o);
  if(q.fig) q.hole = toNum(q.hole);                     /* 解剖の図は「図のid＋かくす番号」だけ持つ（保存が軽い） */
  q.id = uid('q');
  q.mt = Date.now();
  q.sub = subId || '';
  q.mat = matId || '';
  if(!qOk(q)) return null;
  S.qs.push(q);
  return q;
}

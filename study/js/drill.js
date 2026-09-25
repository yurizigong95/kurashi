/* もんだいメーカー：「とく」タブ（出題・答え合わせ・くり返し・模擬テスト・にが手ノート） */

var run = null;
var drill = { mode:'due', n:10, panel:'', why:{} };
var RUN_KEY = KEY + ':run';

function modeName(m){
  return { due:'復習', new:'はじめて', wrong:'まちがい直し', star:'★', all:'ぜんぶ' }[m] || m;
}
/* ===== とちゅうまでの記録（中断して、あとで続きから） ===== */
function runSave(){
  if(!run) return;
  try{
    localStorage.setItem(RUN_KEY, JSON.stringify({
      mode:run.mode, sub:run.sub, unit:run.unit, list:run.list, i:run.i, done:run.done, ok:run.ok,
      moc:run.moc, at:Date.now()
    }));
  }catch(e){}
}
function runSaved(){
  try{
    var o = JSON.parse(localStorage.getItem(RUN_KEY) || 'null');
    if(!o || !Array.isArray(o.list) || o.i >= o.list.length) return null;
    if(Date.now() - toNum(o.at) > 7 * 86400000) return null;
    return o;
  }catch(e){ return null; }
}
function runDrop(){
  run = null;
  try{ localStorage.removeItem(RUN_KEY); }catch(e){}
}
function runResume(){
  var o = runSaved();
  if(!o) return false;
  run = { mode:o.mode, sub:o.sub, unit:o.unit || '', list:o.list.filter(function(id){ return qGet(id); }),
          i:toNum(o.i), done:toNum(o.done), ok:toNum(o.ok), moc:o.moc || null,
          picked:[], typed:'', order:[], picks:{}, showing:0, res:null, cur:'', shuf:null };
  if(run.i >= run.list.length){ runDrop(); return false; }
  return true;
}
/* ===== はじめる ===== */
function drillStart(mode, n, moc){
  view.after = null;
  var subId = curSub();
  var list = pool(subId, mode || 'due');
  if(!list.length){
    toast(modeName(mode) + 'の問題がありません', true);
    return false;
  }
  shuffle(list);
  run = {
    mode:mode, sub:subId, unit:view.unit || '',
    list:list.slice(0, n || drill.n).map(function(q){ return q.id; }),
    i:0, done:0, ok:0, picked:[], typed:'', order:[], picks:{}, showing:0, res:null, cur:'', shuf:null,
    missed:[], moc:moc || null, start:Date.now()
  };
  runSave();
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
  return true;
}
function runQ(){ return run ? qGet(run.list[run.i]) : null; }
/* 答え合わせ */
function drillCheck(){
  var q = runQ();
  if(!q || !run || run.showing) return;
  var ok = false;
  var kind = qKind(q);
  if(kind === 'choice') ok = gradeChoice(q, run.picked);
  else if(kind === 'text') ok = gradeText(q, String(elVal('dr_in') || ''));
  else if(kind === 'calc') ok = gradeCalc(q, String(elVal('dr_in') || ''));
  /* 並べかえは、はじめから正しい順に出ることもある。そのときは、さわっていなくても正かい */
  else if(kind === 'order') ok = gradeOrder(q, run.order.length ? run.order : viewOrder(q, run));
  else if(kind === 'match') ok = gradeMatch(q, run.picks);
  run.typed = String(elVal('dr_in') || '');
  run.res = ok;
  run.showing = 1;
  run.done++;
  if(ok) run.ok++;
  if(run.moc){
    run.moc.answers = run.moc.answers || {};
    run.moc.answers[q.id] = ok ? 1 : 0;
    /* 模擬テストは、あとでまとめて答え合わせ（記録は最後に） */
    run.showing = 0;
    drillNext();
    return;
  }
  logAnswer(q.id, ok);
  if(!ok){
    run.missed = run.missed || [];
    if(run.missed.indexOf(q.id) < 0) run.missed.push(q.id);
  }
  runSave();
  render();
}
function drillNext(){
  if(!run) return;
  run.i++;
  run.showing = 0;
  run.picked = []; run.typed = ''; run.order = []; run.picks = {}; run.res = null; run.cur = ''; run.shuf = null;
  delete INP.dr_in;
  if(run.i >= run.list.length){
    if(run.moc){ mocEnd(); return; }
    var done = run.done, okN = run.ok, miss = (run.missed || []).slice();
    runDrop();
    view.after = { done:done, ok:okN, miss:miss };
    toast(done + '問おわりました（' + okN + '問せいかい）');
    render();
    return;
  }
  runSave();
  render();
}
/* ===== 画面 ===== */
function drillView(){
  if(run) return run.moc ? mocRunView() : drillRunView();
  if(view.after) return afterView();
  if(view.weak) return weakView();
  if(view.mocEnd) return mocEndView();
  if(view.moc) return mocSetupView();
  var subId = curSub();
  var st = stats(subId);
  var saved = runSaved();
  var h = '';
  if(!qsAll().length){
    return section('まだ問題がありません', null,
      '<div class="empty">「つくる」タブで、授業の資料から問題を作ってください。<br>資料がなくても、「表から作る（AIなし）」ならすぐ作れます。</div>' +
      btn('📸 問題をつくる', 'tab', { data:{ tab:'make' }, cls:'main' }));
  }
  h += section('どの科目？', subTitle(subId), subChips('dr-sub', subId, true) +
    (unitsOf(subId).length ? '<label class="f">章（単元）でしぼる</label>' +
      chips([['', 'ぜんぶ']].concat(unitsOf(subId).map(function(u){ return [u, u]; })), view.unit || '', 'dr-unit') : ''));
  if(saved){
    h += section('つづきから', null,
      '<div class="s">' + modeName(saved.mode) + '・' + (saved.list.length - saved.i) + '問のこっています</div>' +
      '<div class="pair">' + btn('つづきをとく', 'dr-resume', { cls:'main' }) + btn('すてる', 'dr-dropsave', { cls:'ghost' }) + '</div>');
  }
  h += section('どれをとく？', st.total + '問', 
    '<div class="modes">' +
      [['due', '復習', st.due], ['new', 'はじめて', pool(subId, 'new').length],
       ['wrong', 'まちがい直し', st.wrong], ['star', '★', pool(subId, 'star').length],
       ['all', 'ぜんぶ', st.total]].map(function(m){
        return '<button type="button" data-act="dr-mode" data-v="' + m[0] + '" class="' + (drill.mode === m[0] ? 'on' : '') + '"' +
          (m[2] ? '' : ' disabled') + '><b>' + m[1] + '</b><span>' + m[2] + '問</span></button>';
      }).join('') +
    '</div>' +
    '<label class="f">何問とく？</label>' +
    '<div class="pillrow">' + [5, 10, 20, 50].map(function(n){
      return '<button type="button" data-act="dr-n" data-v="' + n + '" class="' + (drill.n === n ? 'on' : '') + '">' + n + '問</button>';
    }).join('') + '</div>' +
    btn('▶ はじめる', 'dr-start', { cls:'main' }));
  h += section('そのほか', null,
    '<div class="pair">' +
      btn('📝 模擬テスト', 'dr-moc', { cls:'ghost' }) +
      btn('❌ にが手ノート', 'dr-weak', { cls:'ghost' }) +
    '</div>' +
    '<div class="stats">' +
      statBox('のこり（今日）', todoCount(subId)) +
      statBox('正答率', st.rate == null ? '—' : st.rate + '%') +
      statBox('といた問題', st.answered + '／' + st.total) +
    '</div>');
  return h;
}
/* といたあとのまとめ（まちがえた問題は、その場でもう一回） */
function afterView(){
  var a = view.after, rate = a.done ? Math.round(a.ok * 100 / a.done) : 0;
  var h = section('おつかれさまでした', null,
    '<div class="score"><b>' + a.ok + '</b> / ' + a.done + '問　<span class="pct">' + rate + '%</span></div>' +
    bar(rate, rate >= 80 ? 'good' : rate >= 60 ? '' : 'bad') +
    (a.miss.length
      ? '<div class="s">まちがえた ' + a.miss.length + '問を、いますぐもう一回といておくと、よく覚えられます。</div>' +
        '<div class="pair" style="margin-top:10px">' +
          btn('まちがえた' + a.miss.length + '問をもう一回', 'dr-again', { cls:'main' }) +
          btn('おわる', 'dr-afterclose', { cls:'ghost' }) +
        '</div>'
      : '<div class="s">ぜんぶ せいかいでした！</div>' + btn('おわる', 'dr-afterclose', { cls:'main' })));
  return h;
}
function drillRunView(){
  var q = runQ();
  if(!q){ runDrop(); return drillView(); }
  var h = '';
  h += '<div class="runbar">' + bar(run.i * 100 / run.list.length) +
    '<div class="s">' + (run.i + 1) + ' / ' + run.list.length + '　' + modeName(run.mode) +
    '　<button type="button" class="link" data-act="dr-quit">やめる</button></div></div>';
  h += '<section class="card q">' + qHead(q) + '<div class="qq">' + nl2br(q.q) + '</div>' + qPic(q) + qBody(q) + '</section>';
  if(run.showing) h += drillResultView(q);
  else h += '<div class="pair">' + btn('答えあわせ', 'dr-check', { cls:'main' }) +
    btn(q.star ? '★ 星をはずす' : '☆ 星をつける', 'dr-star', { cls:'ghost' }) + '</div>';
  return h;
}
function qHead(q){
  return '<div class="qhd"><span class="tag">' + esc(typeName(q.qt)) + '</span>' +
    (q.sub ? '<span class="tag sub"' + (subColor(q.sub) ? ' style="--c:' + subColor(q.sub) + '"' : '') + '>' + esc(subName(q.sub)) + '</span>' : '') +
    (q.ch && q.ch !== typeName(q.qt) && q.ch !== subName(q.sub) ? '<span class="tag sub">' + esc(q.ch) + '</span>' : '') +
    (q.star ? '<span class="star">★</span>' : '') + '</div>';
}
/* 図や写真がついている問題 */
function qPic(q){
  if(q.fig) return '<div class="qpic">' + anatOf(q) + '</div>';
  if(q.svg) return '<div class="qpic">' + q.svg + '</div>';
  if(q.pid) return '<div class="qpic"><img data-pid="' + esc(q.pid) + '" alt="問題の図"></div>';
  return '';
}
function qBody(q){
  var kind = qKind(q), idx = viewOrder(q, run);
  if(kind === 'choice'){
    var multi = (q.a || []).length > 1;
    return (multi ? '<div class="s">' + (q.a.length) + 'つえらんでください</div>' : '') +
      '<div class="choices">' + idx.map(function(k, n){
        var on = run.picked.indexOf(k) >= 0;
        var cls = on ? ' on' : '';
        if(run.showing){
          if((q.a || []).indexOf(k) >= 0) cls += ' right';
          else if(on) cls += ' wrong';
        }
        return '<button type="button" class="choice' + cls + '" data-act="dr-pick" data-k="' + k + '"' + (run.showing ? ' disabled' : '') + '>' +
          '<span class="n">' + (NUMS[n] || '') + '</span><span class="t">' + esc((q.c || [])[k]) + '</span></button>';
      }).join('') + '</div>';
  }
  if(kind === 'text'){
    return '<input id="dr_in" type="text" class="big" placeholder="答えを書く" value="' + esc(inVal('dr_in')) + '"' + (run.showing ? ' disabled' : '') + '>';
  }
  if(kind === 'calc'){
    return '<div class="calcrow"><input id="dr_in" type="text" inputmode="decimal" class="big" placeholder="数で答える" value="' + esc(inVal('dr_in')) + '"' +
      (run.showing ? ' disabled' : '') + '>' + (q.un ? '<span class="un">' + esc(q.un) + '</span>' : '') + '</div>' +
      (q.tol ? '<div class="s">' + toNum(q.tol) + '%くらいのちがいは、正解にします</div>' : '');
  }
  if(kind === 'order'){
    var cur = run.order.length ? run.order : idx;
    return '<div class="orders">' + cur.map(function(k, n){
      return '<div class="orow"><span class="n">' + (n + 1) + '</span><span class="t">' + esc((q.c || [])[k]) + '</span>' +
        '<span class="mv"><button type="button" data-act="dr-up" data-n="' + n + '"' + (n === 0 || run.showing ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" data-act="dr-down" data-n="' + n + '"' + (n === cur.length - 1 || run.showing ? ' disabled' : '') + '>↓</button></span></div>';
    }).join('') + '</div>';
  }
  if(kind === 'match'){
    var rights = idx.map(function(k){ return [k, (q.pairs || [])[k][1]]; });
    return '<div class="matches">' + (q.pairs || []).map(function(p, i){
      return '<div class="mrow"><span class="l">' + esc(p[0]) + '</span>' +
        '<select data-act="dr-match" data-i="' + i + '"' + (run.showing ? ' disabled' : '') + '>' +
        '<option value="">えらぶ</option>' +
        rights.map(function(r){
          return '<option value="' + r[0] + '"' + (toNum(run.picks[i]) === r[0] && run.picks[i] !== undefined ? ' selected' : '') + '>' + esc(r[1]) + '</option>';
        }).join('') + '</select></div>';
    }).join('') + '</div>';
  }
  return '';
}
function drillResultView(q){
  var ok = run.res;
  var h = '<section class="card res ' + (ok ? 'ok' : 'ng') + '">' +
    '<div class="big">' + (ok ? '⭕ せいかい' : '❌ ざんねん') + '</div>' +
    '<div class="ans">答え：' + nl2br(answerText(q)) + '</div>' +
    (q.how ? '<div class="how">' + nl2br(q.how) + '</div>' : '') +
    (q.exp ? '<div class="exp">' + nl2br(q.exp) + '</div>' : '') +
    (drill.why[q.id] ? '<div class="why">' + nl2br(drill.why[q.id]) + '</div>' : '') +
    '<div class="minirow">' +
      (drill.why[q.id] ? '' : '<button type="button" data-act="dr-why" data-id="' + q.id + '">なぜ？をしらべる</button>') +
      '<button type="button" data-act="dr-star" >' + (q.star ? '★ 星をはずす' : '☆ 星をつける') + '</button>' +
      /* 書いて答える問題は、機械の○×がずれることがあるので、自分で直せる */
      (qKind(q) === 'text' || qKind(q) === 'calc'
        ? '<button type="button" data-act="dr-flip">' + (ok ? 'やっぱり まちがい' : 'やっぱり 正解') + '</button>'
        : '') +
    '</div>' +
    srcLine(q.src) +
    '</section>';
  h += btn('つぎへ', 'dr-next', { cls:'main' });
  return h;
}
/* ===== 「なぜ？」（まず手もとの表でしらべ、見つからないときだけAI） ===== */
async function drillWhy(id){
  var q = qGet(id);
  if(!q) return;
  if(S.why[id]){ drill.why[id] = S.why[id]; render(); return; }
  var local = localWhy(q);
  if(local){
    drill.why[id] = local + '\n（手もとの表からしらべました。AIは使っていません）';
    S.why[id] = drill.why[id];
    saveSoon();
    render();
    return;
  }
  if(!aiReady()){ toast('手もとの表では見つかりませんでした。AIを使うには、設定でAPIキーを入れてください', true); return; }
  drill.why[id] = 'しらべています…';
  render();
  try{
    var p = '看護学生に、次の問題の考え方を3行以内で説明してください。むずかしいことばは使わないでください。\n' +
      '問題：' + q.q + '\n答え：' + answerText(q) + '\n' + (q.exp ? '解説：' + q.exp + '\n' : '') +
      'JSONだけで答える：{"why":"説明"}';
    var j = await aiJson(p, [], { tag:'why', maxTokens:1024 });
    drill.why[id] = String((j && j.why) || '').slice(0, 400) || '説明を作れませんでした';
    S.why[id] = drill.why[id];
    saveSoon();
  }catch(e){
    drill.why[id] = 'しらべられませんでした：' + e.message;
  }
  render();
}

/* ============================== 模擬テスト ============================== */
var moc = { sub:'', n:50, min:50, field:'' };
function mocStart(){
  var subId = moc.sub === 'all' ? '' : moc.sub;
  var list = pool(subId, 'all');
  if(moc.field) list = list.filter(function(q){ var s = sub(q.sub); return s && s.field === moc.field; });
  if(list.length < 5){ toast('問題が足りません（5問いじょう必要です）', true); return; }
  shuffle(list);
  var n = Math.min(moc.n, list.length);
  view.sub = subId;
  drillStart('all', n, { n:n, min:moc.min, start:Date.now(), answers:{} });
  if(run) run.list = list.slice(0, n).map(function(q){ return q.id; });
  runSave();
  render();
}
function mocLeft(){
  if(!run || !run.moc) return 0;
  return Math.max(0, run.moc.min * 60000 - (Date.now() - run.moc.start));
}
function mocRunView(){
  var q = runQ();
  if(!q){ mocEnd(); return ''; }
  var left = mocLeft();
  var h = '<div class="runbar">' + bar(run.i * 100 / run.list.length) +
    '<div class="s">' + (run.i + 1) + ' / ' + run.list.length + '　のこり ' +
    Math.floor(left / 60000) + ':' + pad(Math.floor(left % 60000 / 1000)) +
    '　<button type="button" class="link" data-act="dr-mocend">おわる</button></div></div>';
  h += '<section class="card q">' + qHead(q) + '<div class="qq">' + nl2br(q.q) + '</div>' + qPic(q) + qBody(q) + '</section>';
  h += '<div class="pair">' + btn('つぎへ', 'dr-check', { cls:'main' }) +
    btn('とばす', 'dr-skip', { cls:'ghost' }) + '</div>';
  return h;
}
function mocEnd(){
  if(!run || !run.moc) return;
  var ans = run.moc.answers || {};
  var ids = run.list.slice();
  var n = ids.length, ok = 0;
  ids.forEach(function(id){
    var v = toNum(ans[id]);
    if(v) ok++;
    if(ans[id] !== undefined) logAnswer(id, !!v);
  });
  var rec = {
    id:uid('moc'), mt:Date.now(), at:today(), sub:run.sub || '', n:n, ok:ok,
    min:Math.round((Date.now() - run.moc.start) / 60000), ids:ids, ans:ans
  };
  S.moc.unshift(rec);
  S.moc = S.moc.slice(0, 30);
  runDrop();
  saveNow();
  view.mocEnd = rec.id;
  render();
  try{ window.scrollTo(0, 0); }catch(e){}
}
function mocEndView(){
  var rec = (S.moc || []).filter(function(x){ return x.id === view.mocEnd; })[0];
  if(!rec){ view.mocEnd = ''; return drillView(); }
  var rate = rec.n ? Math.round(rec.ok * 100 / rec.n) : 0;
  var prev = (S.moc || []).filter(function(x){ return x.id !== rec.id && x.sub === rec.sub; })[0];
  var h = section('模擬テストの結果', mdText(rec.at),
    '<div class="score"><b>' + rec.ok + '</b> / ' + rec.n + '問　<span class="pct">' + rate + '%</span></div>' +
    bar(rate, rate >= 80 ? 'good' : rate >= 60 ? '' : 'bad') +
    '<div class="s">かかった時間：' + rec.min + '分　／　' + (rec.sub ? subName(rec.sub) : 'すべての科目') + '</div>' +
    (prev ? '<div class="s">前の回（' + mdText(prev.at) + '）：' + Math.round(prev.ok * 100 / Math.max(1, prev.n)) + '% → ' +
      (rate - Math.round(prev.ok * 100 / Math.max(1, prev.n)) >= 0 ? '＋' : '') +
      (rate - Math.round(prev.ok * 100 / Math.max(1, prev.n))) + 'ポイント</div>' : '') +
    '<div class="pair" style="margin-top:10px">' +
      btn('まちがえた問題を見る', 'dr-weak', { cls:'main' }) +
      btn('とじる', 'dr-mocclose', { cls:'ghost' }) +
    '</div>');
  var wrong = (rec.ids || []).filter(function(id){ return !toNum((rec.ans || {})[id]); });
  if(wrong.length){
    h += section('まちがえた問題', wrong.length + '問', '<ul class="plain">' + wrong.slice(0, 20).map(function(id){
      var q = qGet(id);
      return q ? '<li>' + esc(String(q.q).slice(0, 60)) + '<div class="s">答え：' + esc(answerText(q)) + '</div></li>' : '';
    }).join('') + '</ul>');
  }
  return h;
}
function mocSetupView(){
  return section('模擬テスト', null,
    '<label class="f">どの科目から？</label>' +
    subChips('moc-sub', moc.sub === 'all' ? '' : moc.sub, true) +
    '<label class="f">分野でしぼる（科目に分野を決めているとき）</label>' +
    chips([['', 'ぜんぶ']].concat(D_FIELDS.map(function(f){ return [f[0], f[1]]; })), moc.field, 'moc-field') +
    '<label class="f">問題の数</label>' +
    '<div class="pillrow">' + [20, 30, 50, 100].map(function(n){
      return '<button type="button" data-act="moc-n" data-v="' + n + '" class="' + (moc.n === n ? 'on' : '') + '">' + n + '問</button>';
    }).join('') + '</div>' +
    '<label class="f">時間</label>' +
    '<div class="pillrow">' + [20, 30, 50, 80].map(function(n){
      return '<button type="button" data-act="moc-min" data-v="' + n + '" class="' + (moc.min === n ? 'on' : '') + '">' + n + '分</button>';
    }).join('') + '</div>' +
    '<div class="pair">' + btn('▶ はじめる', 'moc-start', { cls:'main' }) + btn('もどる', 'dr-mocclose', { cls:'ghost' }) + '</div>' +
    ((S.moc || []).length ? '<label class="f">これまでの結果</label><ul class="plain">' + S.moc.slice(0, 6).map(function(r){
      return '<li>' + mdText(r.at) + '　' + r.ok + '/' + r.n + '（' + Math.round(r.ok * 100 / Math.max(1, r.n)) + '%）' +
        '　' + (r.sub ? esc(subName(r.sub)) : 'すべて') + '</li>';
    }).join('') + '</ul>' : '') +
    note('まとめて解いて、最後に点数を出します。とちゅうの答え合わせはしません。'));
}
/* ============================== にが手ノート ============================== */
function weakList(subId){
  return qsOf(subId === 'all' ? '' : subId).filter(function(q){
    var l = logOf(q.id);
    return l && (l.res === 0 || toNum(l.miss) >= 2);
  }).sort(function(a, b){
    return toNum((logOf(b.id) || {}).miss) - toNum((logOf(a.id) || {}).miss);
  });
}
function weakView(){
  var subId = curSub();
  var list = weakList(subId);
  var h = section('にが手ノート', list.length + '問',
    subChips('dr-sub', subId, true) +
    '<div class="pair" style="margin-top:8px">' +
      btn('この' + Math.min(list.length, 20) + '問をとく', 'dr-weakrun', { cls:'main', dis:!list.length }) +
      btn('書き出す', 'dr-weakout', { cls:'ghost', dis:!list.length }) +
    '</div>' +
    btn('もどる', 'dr-weakclose', { cls:'ghost' }));
  if(!list.length) return h + empty('まちがえた問題は、まだありません。');
  list.slice(0, 50).forEach(function(q){
    var l = logOf(q.id) || {};
    h += '<section class="card q">' + qHead(q) +
      '<div class="qq">' + nl2br(q.q) + '</div>' +
      '<div class="ans">答え：' + nl2br(answerText(q)) + '</div>' +
      (q.exp ? '<div class="exp">' + nl2br(q.exp) + '</div>' : '') +
      (drill.why[q.id] ? '<div class="why">' + nl2br(drill.why[q.id]) + '</div>' : '') +
      '<div class="s">まちがえた回数：' + toNum(l.miss) + '　／　といた回数：' + toNum(l.n) + '</div>' +
      '<div class="minirow">' +
        (drill.why[q.id] ? '' : '<button type="button" data-act="dr-why" data-id="' + q.id + '">なぜ？</button>') +
        '<button type="button" data-act="dr-starq" data-id="' + q.id + '">' + (q.star ? '★' : '☆') + '</button>' +
      '</div>' + srcLine(q.src) + '</section>';
  });
  return h;
}
function weakOut(){
  var list = weakList(curSub());
  var text = list.map(function(q){
    return '■ ' + q.q + '\n答え：' + answerText(q) + (q.exp ? '\n' + q.exp : '');
  }).join('\n\n');
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text);
      toast('にが手ノートをコピーしました');
      return;
    }
  }catch(e){}
  var w = window.open('', '_blank');
  if(w){ w.document.write('<pre>' + esc(text) + '</pre>'); }
  else toast('書き出せませんでした', true);
}

/* ============================== 操作 ============================== */
onView('drill', drillView);
onAct('dr-sub', function(d){ view.sub = d.v; view.unit = ''; render(); });
onAct('dr-unit', function(d){ view.unit = d.v; render(); });
onAct('dr-mode', function(d){ drill.mode = d.v; render(); });
onAct('dr-n', function(d){ drill.n = toNum(d.v); render(); });
onAct('dr-start', function(){ drillStart(drill.mode, drill.n); });
onAct('dr-resume', function(){ if(runResume()) render(); else toast('つづきが見つかりませんでした', true); });
onAct('dr-dropsave', function(){ runDrop(); render(); });
onAct('dr-quit', function(){ runSave(); run = null; render(); });
onAct('dr-pick', function(d){
  var q = runQ();
  if(!q || run.showing) return;
  var k = toNum(d.k), multi = (q.a || []).length > 1;
  var i = run.picked.indexOf(k);
  if(multi){
    if(i >= 0) run.picked.splice(i, 1);
    else if(run.picked.length < q.a.length) run.picked.push(k);
  }else{
    run.picked = (i >= 0) ? [] : [k];
  }
  render();
});
onAct('dr-up', function(d){
  var n = toNum(d.n), q = runQ();
  if(!run.order.length) run.order = viewOrder(q, run).slice();
  if(n <= 0) return;
  var t = run.order[n]; run.order[n] = run.order[n - 1]; run.order[n - 1] = t;
  render();
});
onAct('dr-down', function(d){
  var n = toNum(d.n), q = runQ();
  if(!run.order.length) run.order = viewOrder(q, run).slice();
  if(n >= run.order.length - 1) return;
  var t = run.order[n]; run.order[n] = run.order[n + 1]; run.order[n + 1] = t;
  render();
});
onAct('dr-match', function(d, el){ run.picks[toNum(d.i)] = toNum(el.value); });
onAct('dr-check', function(){ drillCheck(); });
onAct('dr-skip', function(){ drillNext(); });
onAct('dr-next', function(){ drillNext(); });
onAct('dr-star', function(){
  var q = runQ();
  if(!q) return;
  q.star = q.star ? 0 : 1; q.mt = Date.now(); saveSoon(); render();
});
onAct('dr-starq', function(d){
  var q = qGet(d.id);
  if(!q) return;
  q.star = q.star ? 0 : 1; q.mt = Date.now(); saveSoon(); render();
});
onAct('dr-why', function(d){ drillWhy(d.id); });
onAct('dr-flip', function(){
  var q = runQ();
  if(!q || !run || !run.showing) return;
  var was = run.res;
  run.res = !was;
  run.ok += run.res ? 1 : -1;
  /* 記録を、いまの答えで入れ直す */
  var l = logOf(q.id) || {};
  l.n = Math.max(0, toNum(l.n) - 1);
  if(was) l.ok = Math.max(0, toNum(l.ok) - 1); else l.miss = Math.max(0, toNum(l.miss) - 1);
  var d = dayCount(today());
  S.day[today()] = { n:Math.max(0, d.n - 1), ok:Math.max(0, d.ok - (was ? 1 : 0)) };
  S.log[q.id] = l;
  logAnswer(q.id, run.res);
  if(!run.res){
    run.missed = run.missed || [];
    if(run.missed.indexOf(q.id) < 0) run.missed.push(q.id);
  }else{
    run.missed = (run.missed || []).filter(function(id){ return id !== q.id; });
  }
  render();
});
onAct('dr-again', function(){
  var ids = (view.after && view.after.miss) || [];
  view.after = null;
  if(!ids.length){ render(); return; }
  run = { mode:'wrong', sub:curSub(), unit:view.unit || '', list:ids.slice(), i:0, done:0, ok:0,
          picked:[], typed:'', order:[], picks:{}, showing:0, res:null, cur:'', shuf:null, moc:null,
          missed:[], start:Date.now() };
  runSave();
  render();
});
onAct('dr-afterclose', function(){ view.after = null; render(); });
onAct('dr-weak', function(){ view.weak = 1; view.mocEnd = ''; go('drill'); });
onAct('dr-weakclose', function(){ view.weak = 0; render(); });
onAct('dr-weakrun', function(){
  var list = weakList(curSub()).slice(0, 20);
  if(!list.length) return;
  view.weak = 0;
  run = { mode:'wrong', sub:curSub(), unit:'', list:list.map(function(q){ return q.id; }), i:0, done:0, ok:0,
          picked:[], typed:'', order:[], picks:{}, showing:0, res:null, cur:'', shuf:null, moc:null, start:Date.now() };
  runSave();
  render();
});
onAct('dr-weakout', function(){ weakOut(); });
onAct('dr-moc', function(){ view.moc = 1; render(); });
onAct('dr-mocclose', function(){ view.moc = 0; view.mocEnd = ''; render(); });
onAct('dr-mocend', function(){ mocEnd(); });
onAct('moc-sub', function(d){ moc.sub = d.v || 'all'; render(); });
onAct('moc-field', function(d){ moc.field = d.v; render(); });
onAct('moc-n', function(d){ moc.n = toNum(d.v); render(); });
onAct('moc-min', function(d){ moc.min = toNum(d.v); render(); });
onAct('moc-start', function(){ view.moc = 0; mocStart(); });

/* かんご実習メーカー：「看護過程」タブ（事例ごとのワークスペース）
   情報整理 → アセスメント → 看護問題 → 看護計画（O-P/T-P/E-P）→ 実施・評価 */

var WSEC = [
  ['info', '情報'],
  ['asm', 'アセス'],
  ['probs', '問題'],
  ['plan', '計画'],
  ['evals', '評価']
];
var wv = { sec:'info', npr:'mid' };

function workView(){
  var c = curCase();
  if(!c) return section(null, null, empty('事例がありません。「事例」タブで作ってください。') + btn('📚 事例へ', 'tab', { data:{ tab:'cases' }, cls:'ghost' }));
  var h = '';
  /* どの事例か */
  h += '<div class="casepick"><select data-act="w-pick" aria-label="事例をえらぶ">' + cases().map(function(x){
    return '<option value="' + esc(x.id) + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(x.name || '（名前なし）') + '</option>';
  }).join('') + '</select></div>';
  h += '<section class="card sum"><details id="w_sum"' + (S.ui.sumOpen ? ' open' : '') + '>' +
    '<summary><b>' + esc(c.name || '（名前なし）') + '</b><span class="s">' + esc([caseWho(c), c.dx].filter(Boolean).join('／')) + '</span></summary>' +
    (c.memo ? '<div class="memo">' + nl2br(c.memo) + '</div>' : '<div class="s">状況メモはまだありません。</div>') +
    '<div class="minirow"><button type="button" data-act="cs-edit2" data-id="' + esc(c.id) + '">✏️ 事例を直す</button>' +
    '<button type="button" data-act="cs-chat" data-id="' + esc(c.id) + '">💬 この事例をAIと考える</button></div>' +
    '</details></section>';
  /* 中の見出し */
  h += '<div class="segrow">' + WSEC.map(function(s){
    return '<button type="button" data-act="w-sec" data-v="' + s[0] + '" class="' + (wv.sec === s[0] ? 'on' : '') + '">' + s[1] + '</button>';
  }).join('') + '</div>';
  var fn = { info:wInfo, asm:wAsm, probs:wProbs, plan:wPlan, evals:wEvals }[wv.sec] || wInfo;
  h += fn(c);
  return h;
}
function wData(c, l, i, k){ return { id:c.id, l:l, i:i, k:k }; }
function wMoveBtns(c, l, it, i, n){
  return '<span class="mv">' +
    '<button type="button" data-act="w-mv" data-id="' + esc(c.id) + '" data-l="' + l + '" data-i="' + esc(it.id) + '" data-d="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="上へ">↑</button>' +
    '<button type="button" data-act="w-mv" data-id="' + esc(c.id) + '" data-l="' + l + '" data-i="' + esc(it.id) + '" data-d="1"' + (i === n - 1 ? ' disabled' : '') + ' aria-label="下へ">↓</button>' +
    '<button type="button" data-act="w-rm" data-id="' + esc(c.id) + '" data-l="' + l + '" data-i="' + esc(it.id) + '" aria-label="消す">✕</button>' +
  '</span>';
}

/* ===== 情報整理 ===== */
function wInfo(c){
  var list = c.info || [];
  var h = list.map(function(it, i){
    return '<section class="card blk">' +
      '<div class="blkhd">' + liveInput('w-f', wData(c, 'info', it.id, 'h'), it.h, '見出し（例：身体面）') + wMoveBtns(c, 'info', it, i, list.length) + '</div>' +
      liveArea('w-f', wData(c, 'info', it.id, 't'), it.t, 'わかっていること・観察したこと（S情報・O情報）', 4) +
    '</section>';
  }).join('');
  if(!list.length) h += section(null, null, empty('見出しがありません。'));
  var missing = D_INFO_HEADS.filter(function(x){ return !list.some(function(it){ return it.h === x; }); });
  h += '<div class="pair">' + btn('＋ 見出しを足す', 'w-add', { cls:'ghost', data:{ id:c.id, l:'info' } }) +
    (missing.length ? btn('ひな形の見出しを足す', 'w-tpl', { cls:'ghost', data:{ id:c.id } }) : '') + '</div>';
  h += note('見出しは自由に直せます（例：呼吸・循環／栄養・代謝／活動・休息／家族・社会 など）。字は打つそばから保存されます。');
  return h;
}
/* ===== アセスメント ===== */
function wAsm(c){
  var list = c.asm || [];
  var h = list.map(function(it, i){
    return '<section class="card blk">' +
      '<div class="blkhd">' + liveInput('w-f', wData(c, 'asm', it.id, 'h'), it.h, '見出し（なくてもよい）') + wMoveBtns(c, 'asm', it, i, list.length) + '</div>' +
      liveArea('w-f', wData(c, 'asm', it.id, 't'), it.t, '情報から何が言えるか・なぜそう考えたか・このままだとどうなりそうか', 6) +
    '</section>';
  }).join('');
  if(!list.length) h += section(null, null, empty('まだアセスメントがありません。'));
  h += btn('＋ アセスメントのブロックを足す', 'w-add', { cls:'ghost', data:{ id:c.id, l:'asm' } });
  h += note('ブロックは、いくつでも足せます（領域ごと・情報のまとまりごと など）。');
  return h;
}
/* ===== 看護問題リスト ===== */
function wProbs(c){
  var ps = probsSorted(c);
  var h = section('看護問題を足す', null,
    '<textarea id="w_np" rows="2" placeholder="例：嚥下機能の低下に関連した誤嚥のリスク">' + esc(inVal('w_np', '')) + '</textarea>' +
    '<label class="f">優先度</label>' + chips(D_PRIO, wv.npr, 'w-npr') +
    btn('＋ 足す', 'w-padd', { cls:'main', data:{ id:c.id } }));
  if(!ps.length) h += section(null, null, empty('まだ看護問題がありません。'));
  h += ps.map(function(p, i){
    return '<section class="card blk prob pr-' + esc(p.pr) + '">' +
      '<div class="blkhd"><span class="no">#' + (i + 1) + '</span>' +
        '<span class="prtag">優先度 ' + esc(prioName(p.pr)) + '</span>' +
        '<span class="mv"><button type="button" data-act="w-rm" data-id="' + esc(c.id) + '" data-l="probs" data-i="' + esc(p.id) + '" aria-label="消す">✕</button></span></div>' +
      liveArea('w-f', wData(c, 'probs', p.id, 't'), p.t, '問題文', 2) +
      chips(D_PRIO, p.pr, 'w-pr', { id:c.id, i:p.id }) +
    '</section>';
  }).join('');
  if(ps.length) h += note('優先度の高い順にならびます。看護計画は「計画」で、問題ごとに書けます。');
  return h;
}
/* ===== 看護計画 ===== */
function wPlan(c){
  var ps = probsSorted(c);
  if(!ps.length) return section(null, null, empty('先に「問題」で、看護問題を足してください。') +
    btn('看護問題を足す', 'w-sec', { cls:'ghost', data:{ v:'probs' } }));
  return ps.map(function(p, i){
    return '<section class="card blk prob pr-' + esc(p.pr) + '">' +
      '<div class="planhd"><span class="no">#' + (i + 1) + '</span><b>' + esc(p.t || '（問題文なし）') + '</b><span class="prtag">' + esc(prioName(p.pr)) + '</span></div>' +
      D_PLAN.map(function(k){
        return '<label class="f">' + esc(k[1]) + '</label>' + liveArea('w-f', wData(c, 'probs', p.id, k[0]), p[k[0]], k[2], 3);
      }).join('') +
    '</section>';
  }).join('') + note('O-P＝観察計画、T-P＝援助計画（ケア）、E-P＝教育計画（指導）。いつ・どのように・どのくらい、まで書くと具体的になります。');
}
/* ===== 実施・評価 ===== */
function wEvals(c){
  var list = (c.evals || []).slice().sort(function(a, b){ return String(b.d || '') < String(a.d || '') ? -1 : String(b.d || '') > String(a.d || '') ? 1 : 0; });
  var h = section('実施・評価メモを足す', null,
    '<label class="f" for="w_ed">日付</label><input id="w_ed" type="date" value="' + esc(inVal('w_ed', today())) + '">' +
    '<label class="f" for="w_et">メモ</label><textarea id="w_et" rows="3" placeholder="行ったこと・患者さんの反応・目標とくらべてどうだったか・次にどうするか">' + esc(inVal('w_et', '')) + '</textarea>' +
    btn('＋ 足す', 'w-eadd', { cls:'main', data:{ id:c.id } }));
  if(!list.length) h += section(null, null, empty('まだ実施・評価メモがありません。'));
  h += list.map(function(it){
    return '<section class="card blk">' +
      '<div class="blkhd">' + liveInput('w-f', wData(c, 'evals', it.id, 'd'), it.d, '', 'date') +
        '<span class="mv"><button type="button" data-act="w-rm" data-id="' + esc(c.id) + '" data-l="evals" data-i="' + esc(it.id) + '" aria-label="消す">✕</button></span></div>' +
      liveArea('w-f', wData(c, 'evals', it.id, 't'), it.t, '', 3) +
    '</section>';
  }).join('');
  return h;
}

onView('work', workView);

/* 打つたびに中身へ入れる */
onAct('w-f', function(d, el){
  var c = cs(d.id), it = itemOf(c, d.l, d.i);
  if(!it || ['h', 't', 'd', 'op', 'tp', 'ep'].indexOf(d.k) < 0) return;
  if(it[d.k] === el.value) return;
  it[d.k] = el.value;
  caseTouch(c);
});
onAct('w-pick', function(d, el){ setCur(el.value); saveSoon(); render(); });
/* 事例のまとめを開いた・閉じたを覚えておく */
if(typeof document !== 'undefined'){
  document.addEventListener('toggle', function(ev){
    if(ev.target && ev.target.id === 'w_sum') S.ui.sumOpen = ev.target.open ? 1 : 0;
  }, true);
}
onAct('w-sec', function(d){ wv.sec = d.v; render(); try{ window.scrollTo(0, 0); }catch(e){} });
onAct('cs-edit2', function(d){ csv.edit = d.id; inClear('cs_'); go('cases'); });
onAct('w-add', function(d){
  var c = cs(d.id);
  if(!c) return;
  c[d.l] = c[d.l] || [];
  c[d.l].push({ id:uid(d.l === 'info' ? 'in' : 'as'), h:'', t:'' });
  caseTouch(c, true);
  render();
  /* 足したところへ */
  var tas = document.querySelectorAll('.blkhd input');
  if(tas.length) try{ tas[tas.length - 1].focus(); }catch(e){}
});
onAct('w-tpl', function(d){
  var c = cs(d.id);
  if(!c) return;
  D_INFO_HEADS.forEach(function(h){ if(!c.info.some(function(it){ return it.h === h; })) c.info.push({ id:uid('in'), h:h, t:'' }); });
  caseTouch(c, true);
  render();
});
onAct('w-mv', function(d){
  var c = cs(d.id), a = c && c[d.l];
  if(!a) return;
  var i = a.findIndex(function(x){ return x.id === d.i; }), j = i + toNum(d.d);
  if(i < 0 || j < 0 || j >= a.length) return;
  var t = a[i]; a[i] = a[j]; a[j] = t;
  caseTouch(c, true);
  render();
});
onAct('w-rm', function(d){
  var c = cs(d.id), it = itemOf(c, d.l, d.i);
  if(!it) return;
  var has = ['h', 't', 'op', 'tp', 'ep'].some(function(k){ return String(it[k] || '').trim(); });
  if(has && !ask(d.l === 'probs' ? 'この看護問題を消します（看護計画も消えます）。よろしいですか？' : 'このブロックを消します。よろしいですか？')) return;
  c[d.l] = c[d.l].filter(function(x){ return x.id !== d.i; });
  caseTouch(c, true);
  render();
});
onAct('w-npr', function(d){ wv.npr = d.v; render(); });
onAct('w-padd', function(d){
  var c = cs(d.id), t = String(elVal('w_np') || '').trim();
  if(!c) return;
  if(!t){ toast('問題文を入れてください', true); return; }
  c.probs.push({ id:uid('pb'), t:t, pr:wv.npr || 'mid', op:'', tp:'', ep:'' });
  inClear('w_np');
  caseTouch(c, true);
  toast('看護問題を足しました');
  render();
});
onAct('w-pr', function(d){
  var c = cs(d.id), p = itemOf(c, 'probs', d.i);
  if(!p) return;
  p.pr = d.v;
  caseTouch(c, true);
  render();
});
onAct('w-eadd', function(d){
  var c = cs(d.id), t = String(elVal('w_et') || '').trim(), dt = String(elVal('w_ed') || '') || today();
  if(!c) return;
  if(!t){ toast('メモを入れてください', true); return; }
  c.evals.push({ id:uid('ev'), d:dt, t:t });
  inClear('w_et'); inClear('w_ed');
  caseTouch(c, true);
  toast('足しました');
  render();
});

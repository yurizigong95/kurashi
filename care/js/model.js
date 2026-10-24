/* かんご実習メーカー：事例と看護過程の形
   事例（case）1つに、看護過程の中身がまとめて入っています。
   { id, mt, name, age, sex, dx, memo,
     info:[{ id, h, t }],                      … 情報整理（見出しつきのメモ）
     asm:[{ id, h, t }],                       … アセスメント（自由記述のブロック）
     probs:[{ id, t, pr:'hi'|'mid'|'lo', op, tp, ep }],   … 看護問題と、その看護計画
     evals:[{ id, d:'YYYY-MM-DD', t }] }       … 実施・評価メモ
   AI壁打ちの記録：chats:[{ id:'ch_'+事例id, cid, mt, msgs:[{ r:'u'|'m', t, at }] }] */

function infoBlank(){
  return D_INFO_HEADS.map(function(h){ return { id:uid('in'), h:h, t:'' }; });
}
/* 形のおかしなところを直す（古いデータ・ほかの端末からのデータ） */
function caseFix(c){
  if(!c || typeof c !== 'object' || !c.id) return null;
  ['name', 'age', 'sex', 'dx', 'memo'].forEach(function(k){ c[k] = String(c[k] == null ? '' : c[k]); });
  c.mt = toNum(c.mt);
  c.info = Array.isArray(c.info) ? c.info.filter(function(x){ return x && x.id; }) : infoBlank();
  c.asm = Array.isArray(c.asm) ? c.asm.filter(function(x){ return x && x.id; }) : [];
  c.probs = Array.isArray(c.probs) ? c.probs.filter(function(x){ return x && x.id; }) : [];
  c.evals = Array.isArray(c.evals) ? c.evals.filter(function(x){ return x && x.id; }) : [];
  c.probs.forEach(function(p){
    if(!D_PRIO.some(function(x){ return x[0] === p.pr; })) p.pr = 'mid';
    ['t', 'op', 'tp', 'ep'].forEach(function(k){ p[k] = String(p[k] == null ? '' : p[k]); });
  });
  return c;
}
/* 学習用の事例を入れる。again のときは、消したものももどす（時こくを新しくする） */
function seedCases(again){
  var n = 0;
  D_SEED.forEach(function(d){
    if(cs(d.id)) return;
    var c = {
      id:d.id, mt:again ? Date.now() : 1, seed:1,
      name:d.name, age:d.age, sex:d.sex, dx:d.dx, memo:d.memo,
      info:D_INFO_HEADS.map(function(h, i){ return { id:d.id + '_in' + i, h:h, t:(d.info && d.info[h]) || '' }; }),
      asm:[], probs:[], evals:[]
    };
    if(again && S.del) delete S.del[d.id];
    S.cases.push(c);
    n++;
  });
  return n;
}

/* ===== 事例 ===== */
function cases(){
  return S.cases.slice().sort(function(a, b){ return toNum(b.mt) - toNum(a.mt); });
}
function cs(id){
  for(var i = 0; i < S.cases.length; i++) if(S.cases[i].id === id) return S.cases[i];
  return null;
}
/* いま開いている事例（なければ、いちばん新しく直したもの） */
function curCase(){
  var c = cs(S.ui.cur);
  if(c) return c;
  var l = cases();
  return l[0] || null;
}
function setCur(id){ S.ui.cur = id; }
function caseNew(o){
  var c = caseFix(Object.assign({ id:uid('cs'), mt:Date.now(), info:infoBlank() }, o || {}));
  S.cases.push(c);
  return c;
}
/* 直した：時こくを入れて、少ししてから保存 */
function caseTouch(c, now){
  if(!c) return;
  c.mt = Date.now();
  if(now) saveNow(); else saveSoon();
}
function caseDel(id){
  S.cases = S.cases.filter(function(c){ return c.id !== id; });
  if(typeof syDead === 'function') syDead(id);
  var ch = chatOf(id, false);
  if(ch){
    S.chats = S.chats.filter(function(x){ return x !== ch; });
    if(typeof syDead === 'function') syDead(ch.id);
  }
  if(S.ui.cur === id) S.ui.cur = '';
}
/* 「80代・男性」 */
function caseWho(c){ return [c.age, c.sex].filter(Boolean).join('・'); }
function prioName(pr){ var x = D_PRIO.filter(function(p){ return p[0] === pr; })[0]; return x ? x[1] : '中'; }
function prioRank(pr){ return pr === 'hi' ? 0 : pr === 'lo' ? 2 : 1; }
/* 看護問題を、優先度の順に（同じなら入れた順） */
function probsSorted(c){
  return (c.probs || []).map(function(p, i){ return [p, i]; }).sort(function(a, b){
    return (prioRank(a[0].pr) - prioRank(b[0].pr)) || (a[1] - b[1]);
  }).map(function(x){ return x[0]; });
}
/* リストの中から id で取る */
function itemOf(c, list, id){
  var a = (c && c[list]) || [];
  for(var i = 0; i < a.length; i++) if(a[i].id === id) return a[i];
  return null;
}
/* どこまで書いたか（一覧に出す） */
function caseProgress(c){
  var info = (c.info || []).filter(function(x){ return String(x.t || '').trim(); }).length;
  var plan = (c.probs || []).filter(function(p){ return String(p.op || p.tp || p.ep || '').trim(); }).length;
  return { info:info, asm:(c.asm || []).filter(function(x){ return String(x.t || '').trim(); }).length,
           probs:(c.probs || []).length, plan:plan, evals:(c.evals || []).length };
}

/* ===== AI壁打ちの記録 ===== */
function chatOf(cid, make){
  var id = 'ch_' + cid;
  for(var i = 0; i < S.chats.length; i++) if(S.chats[i].id === id) return S.chats[i];
  if(!make) return null;
  var ch = { id:id, cid:cid, mt:Date.now(), msgs:[] };
  S.chats.push(ch);
  return ch;
}

/* AIにわたす、事例のまとめ（字だけ） */
function caseText(c){
  var L = [];
  L.push('【事例名】' + (c.name || '（名前なし）'));
  if(caseWho(c)) L.push('【年齢層・性別】' + caseWho(c));
  if(c.dx) L.push('【疾患名】' + c.dx);
  if(String(c.memo || '').trim()) L.push('【状況メモ】\n' + c.memo.trim());
  var info = (c.info || []).filter(function(x){ return String(x.t || '').trim(); });
  if(info.length) L.push('【情報整理】\n' + info.map(function(x){ return '■' + (x.h || '（見出しなし）') + '\n' + x.t.trim(); }).join('\n'));
  var asm = (c.asm || []).filter(function(x){ return String(x.t || '').trim(); });
  if(asm.length) L.push('【アセスメント】\n' + asm.map(function(x, i){ return '■' + (x.h || ('アセスメント' + (i + 1))) + '\n' + x.t.trim(); }).join('\n'));
  var ps = probsSorted(c);
  if(ps.length){
    L.push('【看護問題と看護計画】\n' + ps.map(function(p, i){
      var s = '#' + (i + 1) + ' ' + (p.t || '（問題文なし）') + '（優先度：' + prioName(p.pr) + '）';
      D_PLAN.forEach(function(k){ if(String(p[k[0]] || '').trim()) s += '\n  ' + k[1] + '：' + p[k[0]].trim().replace(/\n/g, '\n    '); });
      return s;
    }).join('\n'));
  }
  var ev = (c.evals || []).filter(function(x){ return String(x.t || '').trim(); });
  if(ev.length) L.push('【実施・評価メモ】\n' + ev.map(function(x){ return (x.d || '日付なし') + '：' + x.t.trim(); }).join('\n'));
  return L.join('\n\n');
}

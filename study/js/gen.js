/* もんだいメーカー：AIを使わない問題づくり
   ============================================================
   先に入れてある表（基準値149・略語334・薬95・手順21）と、資料から取り出した字だけで作る。
   通信もAIもしないので、APIをまったく使わない（＝おかねも、1日の上限もかからない）。 */

function gPick(list, n){ return shuffle(list.slice()).slice(0, Math.max(0, n)); }
/* 正解＋まちがいの選択肢をまぜて、正解の番号を返す */
function gChoices(right, wrongs, max){
  var c = [right], seen = {};
  seen[right] = 1;
  shuffle(wrongs.slice()).forEach(function(w){
    w = String(w == null ? '' : w).trim();
    if(!w || seen[w] || c.length >= (max || 4)) return;
    seen[w] = 1; c.push(w);
  });
  if(c.length < 2) return null;
  shuffle(c);
  return { c:c, a:[c.indexOf(right)] };
}
function gItem(o){
  return Object.assign({ qt:'mc', q:'', c:[], a:[], at:'', alt:[], pairs:[], exp:'', tag:'', ch:'', lv:2, src:'' }, o);
}

/* ===== 基準値 ===== */
function genLabs(n, opt){
  opt = opt || {};
  var all = dLabs().filter(function(o){ return o.v && o.name; });
  if(opt.cat) all = all.filter(function(o){ return o.cat === opt.cat; });
  if(!all.length) return [];
  var out = [];
  gPick(all, n * 2).forEach(function(o){
    if(out.length >= n) return;
    var right = dLabValue(o);
    /* まちがいの選択肢は、同じ単位のほかの項目の値（本当にある値なので、はっきりまちがい） */
    var poolW = dLabs().filter(function(x){ return x !== o && x.unit === o.unit && x.v !== o.v; }).map(dLabValue);
    if(poolW.length < 3){
      poolW = poolW.concat(dLabs().filter(function(x){ return x !== o && x.v !== o.v; }).slice(0, 12).map(dLabValue));
    }
    var ch = gChoices(right, poolW, 4);
    if(!ch || ch.c.length < 3) return;
    out.push(gItem({ qt:'mc', q:'「' + dLabLabel(o) + '」の基準値（目安）はどれか。', c:ch.c, a:ch.a,
      exp:(o.note || '') + '（' + o.cat + '）', tag:o.cat, ch:o.cat, lv:1,
      src:'組みこみの基準値表（目安。施設・教科書で少しちがいます）' }));
  });
  return out;
}
function genLabsCloze(n, opt){
  opt = opt || {};
  var all = dLabs().filter(function(o){ return o.v && o.name; });
  if(opt.cat) all = all.filter(function(o){ return o.cat === opt.cat; });
  return gPick(all, n).map(function(o){
    return gItem({ qt:'cloze', q:'「' + dLabLabel(o) + '」の基準値は（　）' + (o.unit || '') + '。',
      at:o.v, alt:[o.v.replace(/,/g, '')], exp:(o.note || '') + '（' + o.cat + '）', tag:o.cat, ch:o.cat, lv:2,
      src:'組みこみの基準値表（目安。施設・教科書で少しちがいます）' });
  });
}
/* ===== 略語・用語 ===== */
function genDict(n){
  var all = dDicts().filter(function(x){ return x.ja || x.desc; });
  if(!all.length) return [];
  var out = [];
  gPick(all, n * 2).forEach(function(o){
    if(out.length >= n) return;
    var right = o.ja || String(o.desc).split('。')[0];
    var poolW = gPick(all.filter(function(x){ return x !== o && (x.ja || x.desc); }), 12)
      .map(function(x){ return x.ja || String(x.desc).split('。')[0]; });
    /* 取りちがえやすいことばがあれば、それをまちがいの選択肢に入れる */
    var mate = dConfusePartner(o.ja);
    if(mate) poolW.unshift(mate);
    var ch = gChoices(right, poolW, 4);
    if(!ch || ch.c.length < 3) return;
    out.push(gItem({ qt:'mc', q:'「' + o.abbr + '」の意味はどれか。', c:ch.c, a:ch.a,
      exp:(o.full ? o.full + '。' : '') + String(o.desc || '').slice(0, 160), tag:'略語', ch:'略語・用語', lv:1,
      src:'組みこみの用語集（教科書で確かめて）' }));
  });
  return out;
}
function genDictEn(n){
  var all = dDicts().filter(function(x){ return x.full && /[A-Za-z]/.test(x.full) && x.ja; });
  if(!all.length) return [];
  var out = [];
  gPick(all, n * 2).forEach(function(o){
    if(out.length >= n) return;
    var poolW = gPick(all.filter(function(x){ return x !== o; }), 10).map(function(x){ return x.full; });
    var ch = gChoices(o.full, poolW, 4);
    if(!ch || ch.c.length < 3) return;
    out.push(gItem({ qt:'mc', q:'「' + o.ja + '（' + o.abbr + '）」の英語の正式名はどれか。', c:ch.c, a:ch.a,
      exp:o.abbr + '＝' + o.full + '（' + o.ja + '）', tag:'医学英語', ch:'英語', lv:2,
      src:'組みこみの用語集（教科書で確かめて）' }));
  });
  return out;
}
/* ===== 薬 ===== */
function genDrugs(n){
  var all = dDrugs();
  if(!all.length) return [];
  var out = [];
  gPick(all, n * 2).forEach(function(o){
    if(out.length >= n) return;
    var kind = Math.random() < 0.5 ? 'act' : 'side';
    var right = kind === 'act' ? o.act : String(o.side).split('、')[0];
    if(!right) return;
    var poolW = gPick(all.filter(function(x){ return x !== o && x.cat !== o.cat; }), 10)
      .map(function(x){ return kind === 'act' ? x.act : String(x.side).split('、')[0]; });
    var ch = gChoices(right, poolW, 4);
    if(!ch || ch.c.length < 3) return;
    out.push(gItem({ qt:'mc',
      q:'「' + o.group + '」（' + String(o.names).split('、')[0] + 'など）について、' + (kind === 'act' ? 'はたらき' : '主な副作用') + 'はどれか。',
      c:ch.c, a:ch.a, exp:'はたらき：' + o.act + '\n看護で気をつけること：' + o.care, tag:o.cat, ch:'薬', lv:2,
      src:'組みこみの薬のカード（目安。添付文書・教科書で確かめて）' }));
  });
  return out;
}
/* ===== 看護技術の手順 ===== */
function gStep(x){ return Array.isArray(x) ? String(x[0] || '') : String((x && x.s) || ''); }
function gWhy(x){ return Array.isArray(x) ? String(x[1] || '') : String((x && x.w) || ''); }
function genSkillOrder(n, opt){
  opt = opt || {};
  var all = dSkills().filter(function(s){ return s && (s.steps || []).length >= 4; });
  if(opt.skill) all = all.filter(function(s){ return s.id === opt.skill; });
  if(!all.length) return [];
  var out = [];
  gPick(all, Math.max(n, 1)).forEach(function(s){
    if(out.length >= n) return;
    var steps = s.steps.map(gStep);
    var len = Math.min(5, steps.length);
    var from = Math.floor(Math.random() * (steps.length - len + 1));
    var part = steps.slice(from, from + len);
    out.push(gItem({ qt:'order',
      q:'「' + s.name + '」の手順です。正しい順にならべてください。' +
        (from > 0 ? '（' + (from + 1) + '番目からの' + len + 'つ）' : '（はじめの' + len + 'つ）'),
      c:part, exp:'学校で習った手順を優先してください。' + (s.goal ? '目安の時間：' + s.goal : ''),
      tag:s.cat, ch:'看護技術', lv:2, src:'組みこみの手順の例（学校で習った手順を優先して）' }));
  });
  return out;
}
function genSkillWhy(n){
  var all = dSkills().filter(function(s){ return (s.steps || []).some(gWhy); });
  if(!all.length) return [];
  var pairs = [];
  all.forEach(function(s){
    (s.steps || []).forEach(function(x){ if(gStep(x) && gWhy(x)) pairs.push({ s:s, step:gStep(x), why:gWhy(x) }); });
  });
  var out = [];
  gPick(pairs, n * 2).forEach(function(p){
    if(out.length >= n) return;
    var poolW = gPick(pairs.filter(function(x){ return x.s !== p.s; }), 10).map(function(x){ return x.why; });
    var ch = gChoices(p.why, poolW, 4);
    if(!ch || ch.c.length < 3) return;
    out.push(gItem({ qt:'mc', q:'「' + p.s.name + '」で、「' + p.step + '」のはなぜか。', c:ch.c, a:ch.a,
      exp:p.step + '\n→ ' + p.why, tag:p.s.cat, ch:'看護技術', lv:3,
      src:'組みこみの手順の例（学校で習った手順を優先して）' }));
  });
  return out;
}
/* ===== 計算 ===== */
function genCalc(n, ids){
  var types = D_CALC.filter(function(t){ return !ids || !ids.length || ids.indexOf(t.id) >= 0; });
  if(!types.length) return [];
  var out = [], seen = {};
  for(var i = 0; i < n * 4 && out.length < n; i++){
    var t = types[i % types.length];
    var o = t.make();
    if(seen[o.q]) continue;
    seen[o.q] = 1;
    out.push(gItem({ qt:'calc', q:o.q, at:o.at, un:o.un, tol:o.tol, how:o.how, exp:o.exp,
      tag:t.name, ch:'計算', lv:2, src:'組みこみの計算問題（式は教科書で確かめて）' }));
  }
  return out;
}
/* ===== 組み合わせ ===== */
function genMatch(n, opt){
  opt = opt || {};
  var src = opt.from === 'lab' ? dLabs().filter(function(o){ return o.v; }).map(function(o){ return [o.name, dLabValue(o)]; })
    : opt.from === 'drug' ? dDrugs().map(function(o){ return [o.group, String(o.act).slice(0, 40)]; })
    : dDicts().filter(function(x){ return x.ja && x.ja.indexOf('②') < 0; }).map(function(x){ return [x.abbr, x.ja]; });
  src = src.filter(function(p){ return p[0] && p[1]; });
  if(src.length < 4) return [];
  var out = [];
  for(var i = 0; i < n; i++){
    var pick = gPick(src, 4), seen = {}, pairs = [];
    pick.forEach(function(p){ if(!seen[p[1]]){ seen[p[1]] = 1; pairs.push([p[0], p[1]]); } });
    if(pairs.length < 3) continue;
    out.push(gItem({ qt:'match', q:'左と右で、合うものをむすんでください。', pairs:pairs,
      tag:opt.from === 'lab' ? '基準値' : opt.from === 'drug' ? '薬' : '略語', ch:'組み合わせ', lv:2,
      src:'組みこみの表（教科書で確かめて）' }));
  }
  return out;
}
/* ===== 国試れんしゅう（組みこみの問題から） ===== */
function genBuiltin(n, field){
  var all = dBuiltinQs().filter(function(q){ return !field || q.field === field; });
  return gPick(all, n).map(function(q){
    return gItem({ qt:'mc', q:q.q, c:q.c.slice(), a:q.a.slice(), exp:q.exp, tag:q.tag, ch:q.ch, lv:q.lv, src:q.src });
  });
}

/* ===== 資料の字から、その場で作る ===== */
var UNIT_RE = /(\d[\d,\.]*\s*(?:〜|～|-|から)?\s*[\d,\.]*\s*(?:mmHg|mL|ml|L|mg|g|kg|μg|mEq\/L|mg\/dL|g\/dL|%|℃|回\/分|回|時間|分|日|週|歳|mm|cm|kcal|単位))/;
function gSentences(text){
  return String(text || '')
    .replace(/【[^】]*】/g, ' ')
    .split(/[。\n！？!?]/)
    .map(function(s){ return s.replace(/^[\s・●○◆■\-–—*]+/, '').trim(); })
    .filter(function(s){ return s.length >= 12 && s.length <= 120; });
}
function gTermsIn(s){
  var out = [];
  dDicts().forEach(function(d){
    if(out.length >= 3) return;
    var w = d.ja || '';
    if(w && w.length >= 3 && s.indexOf(w) >= 0) out.push(w);
    else if(d.abbr && d.abbr.length >= 3 && s.indexOf(d.abbr) >= 0) out.push(d.abbr);
  });
  return out;
}
/* 数字と単位のあるところ・組みこみの用語を（　）にする */
function genFromText(text, n, opt){
  opt = opt || {};
  var ss = gSentences(text), out = [], seen = {};
  var withNum = ss.filter(function(s){ return UNIT_RE.test(s); });
  var rest = ss.filter(function(s){ return withNum.indexOf(s) < 0; });
  withNum.concat(rest).forEach(function(s){
    if(out.length >= n) return;
    var m = s.match(UNIT_RE), hide = '';
    if(m) hide = m[1].trim();
    else {
      var t = gTermsIn(s);
      if(t.length) hide = t[0];
    }
    if(!hide || hide.length > 24) return;
    var q = s.split(hide).join('（　）');
    if(q === s || seen[q]) return;
    seen[q] = 1;
    out.push(gItem({ qt:'cloze', q:q + '。', at:hide, exp:'もとの文：' + s + '。', tag:opt.tag || '', ch:opt.ch || '', lv:1,
      src:'自分の資料から、その場で作りました（AIは使っていません）' }));
  });
  return out;
}
/* ○×も作る（数字をわざと変えた文を「×」にする） */
function genFromTextTf(text, n, opt){
  opt = opt || {};
  var ss = gSentences(text).filter(function(s){ return UNIT_RE.test(s); });
  var out = [];
  gPick(ss, n).forEach(function(s){
    var m = s.match(UNIT_RE);
    if(!m || out.length >= n) return;
    var num = m[1], wrong = Math.random() < 0.5;
    var shown = wrong ? gTwist(num) : num;
    if(wrong && shown === num) wrong = false;
    out.push(gItem({ qt:'tf', q:s.split(num).join(shown) + '。', c:['○（正しい）', '×（まちがい）'], a:[wrong ? 1 : 0],
      exp:'資料には「' + s + '」と書いてあります。', tag:opt.tag || '', ch:opt.ch || '', lv:2,
      src:'自分の資料から、その場で作りました（AIは使っていません）' }));
  });
  return out;
}
/* 「36.0〜37.0℃」のような幅は、両方とも同じ倍率で変える（かたほうだけ変えると、へんな文になる） */
function gTwist(s){
  var k = [0.5, 2, 1.5, 10][Math.floor(Math.random() * 4)];
  return String(s).replace(/\d+(\.\d+)?/g, function(d){
    var v = Number(d);
    if(!isFinite(v) || v === 0) return d;
    var r = v * k;
    return String(d.indexOf('.') >= 0 ? Math.round(r * 10) / 10 : Math.round(r));
  });
}

/* ===== まちがいの「なぜ？」を、組みこみの表でさがす（見つかればAIを呼ばない） ===== */
function localWhy(q){
  if(!q) return '';
  if(q.qt === 'calc' && q.how) return q.how + (q.exp ? '\n' + q.exp : '');
  var text = String(q.q || '') + ' ' + answerText(q);
  var out = [];
  dLabs().forEach(function(o){
    if(out.length >= 2 || !o.name || o.name.length < 3) return;
    if(text.indexOf(o.name) >= 0 || (o.abbr && o.abbr.length >= 2 && text.indexOf(o.abbr) >= 0)){
      out.push('【' + dLabLabel(o) + '】基準値の目安は ' + dLabValue(o) + '。' + (o.note || ''));
    }
  });
  dDicts().forEach(function(d){
    if(out.length >= 3) return;
    var hit = (d.abbr && d.abbr.length >= 2 && text.indexOf(d.abbr) >= 0) || (d.ja && d.ja.length >= 3 && text.indexOf(d.ja) >= 0);
    if(!hit) return;
    out.push('【' + d.abbr + '】' + (d.full ? d.full + '＝' : '') + (d.ja || '') + '。' + String(d.desc || '').slice(0, 120));
  });
  var conf = dConfuseIn(text);
  if(conf.length) out.push('まちがえやすい組み合わせ：' + conf.slice(0, 3).join('、') + '。どちらの話かを、先にたしかめる。');
  if(out.length < 3){
    dDrugs().forEach(function(o){
      if(out.length >= 3 || !o.group) return;
      if(text.indexOf(o.group) >= 0) out.push('【' + o.group + '】' + o.act + ' 看護：' + o.care);
    });
  }
  return out.slice(0, 3).join('\n');
}

/* ===== 解剖の図の穴うめ（組みこみの図から・AIなし） ===== */
var SVG_DEFS = '<defs><marker id="mkArw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" ' +
  'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="mk-sv-arw"/></marker></defs>';
/* hide … かくす名前の番号（その場所を「？」にする） */
function anatSvg(d, hide){
  var s = '<svg class="mk-svg" viewBox="0 0 ' + d.W + ' ' + d.H + '" xmlns="http://www.w3.org/2000/svg" ' +
    'role="img" aria-label="' + esc(d.title) + '">' + SVG_DEFS + d.draw;
  (d.texts || []).forEach(function(t){
    s += '<text x="' + t[0] + '" y="' + t[1] + '" font-size="' + (t[3] || 11) + '" text-anchor="' + (t[4] || 'middle') +
      '" dominant-baseline="central" class="mk-sv-note">' + esc(t[2]) + '</text>';
  });
  (d.labels || []).forEach(function(l, i){
    var hit = (i === hide);
    s += '<text x="' + l[0] + '" y="' + l[1] + '" font-size="' + (l[3] || 13) + '" text-anchor="middle" ' +
      'dominant-baseline="central" class="mk-sv-lbl' + (hit ? ' mk-sv-hole' : '') + '">' + esc(hit ? '？' : l[2]) + '</text>';
  });
  return s + '</svg>';
}
function anatGet(id){ return dAnat().filter(function(d){ return d.id === id; })[0] || null; }
/* 問題に入っている「図のid＋かくす番号」から、絵をつくる */
function anatOf(q){
  var d = q && q.fig ? anatGet(q.fig) : null;
  return d ? anatSvg(d, toNum(q.hole)) : '';
}
function genAnat(n, opt){
  opt = opt || {};
  var figs = dAnat().filter(function(d){ return (d.labels || []).length >= 4; });
  if(opt.fig) figs = figs.filter(function(d){ return d.id === opt.fig; });
  if(!figs.length) return [];
  var out = [], used = {};
  for(var i = 0; i < n * 4 && out.length < n; i++){
    var d = figs[i % figs.length];
    var k = Math.floor(Math.random() * d.labels.length);
    var key = d.id + '|' + k;
    if(used[key]) continue;
    used[key] = 1;
    var right = String(d.labels[k][2]);
    var wrongs = d.labels.filter(function(l, j){ return j !== k && String(l[2]) !== right; })
      .map(function(l){ return String(l[2]); });
    var ch = gChoices(right, wrongs, 4);
    if(!ch || ch.c.length < 3) continue;
    out.push(gItem({ qt:'mc', q:'「' + d.title + '」の図で、「？」のところはどれか。', c:ch.c, a:ch.a,
      fig:d.id, hole:k, exp:d.desc || '', tag:d.title, ch:'解剖の図', lv:2,
      src:'組みこみの図（教科書で確かめて）' }));
  }
  return out;
}

/* ===== 小テスト工房（どれもAIなし） ===== */
var KITS = [
  { id:'lab',   name:'基準値（4択）',   desc:'血液・尿・バイタルの基準値', make:function(n, o){ return genLabs(n, o); } },
  { id:'labc',  name:'基準値（穴うめ）', desc:'数を書いて覚える',           make:function(n, o){ return genLabsCloze(n, o); } },
  { id:'dict',  name:'略語・用語',       desc:'ADL・SpO2 などの意味',       make:function(n){ return genDict(n); } },
  { id:'en',    name:'医学英語',         desc:'日本語→英語の正式名',        make:function(n){ return genDictEn(n); } },
  { id:'drug',  name:'薬',               desc:'はたらき・副作用',           make:function(n){ return genDrugs(n); } },
  { id:'skill', name:'手順（並べかえ）', desc:'正しい順にならべる',         make:function(n, o){ return genSkillOrder(n, o); } },
  { id:'why',   name:'手順の根拠',       desc:'なぜそうするのか',           make:function(n){ return genSkillWhy(n); } },
  { id:'match', name:'組み合わせ',       desc:'略語と意味をむすぶ',         make:function(n, o){ return genMatch(n, o); } },
  { id:'calc',  name:'計算',             desc:'点滴・薬の量・BMI など',     make:function(n, o){ return genCalc(n, o && o.calcIds); } },
  { id:'kokushi', name:'国試れんしゅう', desc:'組みこみの練習問題72問から', make:function(n, o){ return genBuiltin(n, o && o.field); } },
  { id:'anat',  name:'解剖の図',       desc:'図の「？」をあてる',         make:function(n, o){ return genAnat(n, o); } }
];
function kitOf(id){ return KITS.filter(function(k){ return k.id === id; })[0] || KITS[0]; }

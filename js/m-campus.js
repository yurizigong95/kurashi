/* くらしの手帳：授業・バイト・通学（campus）
   ・出席率のグラフ（21）・大学のメールの取りこみ（22）・シラバスの自動登録（24 … timetable.js の syllabusRead を広げた）
   ・成績の見込み（25）・GPAと単位（26）・学年暦（33）・いまから間に合う？（59）・地図で行き方（69）
   ・Googleマップの経路（171）・近くの薬局・コンビニ（172）・シフト表を月ごとに（89 … money.js の shiftOcr を広げた）
   ・シフト希望の提出日（93）・Googleフォームの締切（175）
   データ：設定は S.ui.campus、記録は S.kmItems（mod:'campus'）・S.kmData（'campus:…'）。 */

/* ============================== 設定・小道具 ============================== */
var CP_GRADES = ['秀', '優', '良', '可', '不可'];
var CP_GP0 = { '秀':4, '優':3, '良':2, '可':1, '不可':0 };
var CP_LETTER = { S:'秀', AA:'秀', A:'優', B:'良', C:'可', D:'不可', E:'不可', F:'不可' };
var CP_KANJI = { '秀':['S', 'AA'], '優':['A'], '良':['B'], '可':['C'], '不可':['D', 'F', 'E'] };
function cpNum(v){
  var s = String(v == null ? '' : v);
  try{ s = s.normalize('NFKC'); }catch(e){}
  var n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function cpCfg(){
  var c = (S.ui && S.ui.campus) || {};
  return {
    gp: (c.gp && typeof c.gp === 'object' && Object.keys(c.gp).length) ? c.gp : CP_GP0,
    cut: (Array.isArray(c.cut) && c.cut.length === 4) ? c.cut.map(cpNum) : [90, 80, 70, 60],
    grad: Object.assign({ total:0, req:0, elec:0, beforeReq:0, beforeElec:0, beforeGpa:'', beforeCr:0 }, c.grad || {}),
    wish: Object.assign({ day:0, lead:3 }, c.wish || {}),
    places: Object.assign({ home:'', school:'', work:'' }, c.places || {})
  };
}
function cpCfgSet(patch){ S.ui.campus = Object.assign({}, S.ui.campus || {}, patch); touch('ui'); }
function cpData(k){ var v = (S.kmData || {})['campus:' + k]; return (v && typeof v === 'object') ? v : null; }
function cpDataSet(k, v){
  S.kmData = S.kmData || {};
  S.kmData['campus:' + k] = Object.assign({}, v, { mt:Date.now() });
  touch('kmData');
}
function cpItems(type){ return (S.kmItems || []).filter(function(x){ return x && x.mod === 'campus' && (!type || x.type === type); }); }
function cpItem(id){ return (S.kmItems || []).filter(function(x){ return x && x.id === id && x.mod === 'campus'; })[0] || null; }
function cpRender(){ if(typeof isTyping === 'function' && isTyping()) renderLater(); else render(); }
/* 「10/3」「2026年10月3日」「10月3日」「2026-10-03」→ YYYY-MM-DD */
function cpYmd(s){
  s = String(s == null ? '' : s);
  try{ s = s.normalize('NFKC'); }catch(e){}
  s = s.trim();
  if(isYmd(s)) return s;
  var m = s.match(/(\d{4})\s*[-\/年.]\s*(\d{1,2})\s*[-\/月.]\s*(\d{1,2})/);
  if(m){ var d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getMonth() === +m[2] - 1 ? toYmd(d) : ''; }
  m = s.match(/(\d{1,2})\s*[-\/月.]\s*(\d{1,2})/);
  return m ? mdToYmd(+m[1], +m[2]) : '';
}
function cpHm(s){
  var m = (typeof looseMinutes === 'function') ? looseMinutes(s) : minutesOf(s);
  return m == null ? '' : hhmmOf(m);
}
/* 授業の名前（メールやAIの書き方）→ 今の学期の科目名（見つからなければ空） */
function cpCourse(name){
  var n = norm(String(name || '')).replace(/[\s　]+/g, '');
  if(!n) return '';
  var list = termCourses();
  var key = function(c){ return norm(subjKey(c.name)); };
  var hit = list.filter(function(c){ return norm(c.name) === n || key(c) === n; })[0] ||
    list.filter(function(c){ return key(c).length >= 2 && (n.indexOf(key(c)) >= 0 || key(c).indexOf(n) >= 0); })[0] ||
    list.filter(function(c){ var a = norm(courseAlias(c.name)); return a.length >= 2 && n.indexOf(a) >= 0; })[0];
  return hit ? hit.name : '';
}
function cpCopy(text){
  try{
    navigator.clipboard.writeText(text).then(function(){ toast('コピーしました（貼り付けて送れます）'); },
      function(){ toast('コピーできませんでした。下の欄を長押ししてコピーしてください', true); });
  }catch(e){ toast('コピーできませんでした。下の欄を長押ししてコピーしてください', true); }
}
/* 写真・PDFをえらぶ（写真は小さくする。PDFは15MBまで）→ cb([dataUrl], [名前]) */
function cpPickFiles(cb, multi){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*,.pdf,application/pdf'; inp.multiple = multi !== false;
  inp.onchange = async function(){
    var files = Array.prototype.slice.call(inp.files || [], 0, 4);
    if(!files.length) return;
    try{
      var urls = [], names = [];
      for(var i = 0; i < files.length; i++){
        var f = files[i];
        if(/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)){
          if(f.size > 15 * 1024 * 1024) throw new Error('PDFは15MBまでです（' + f.name + '）');
          urls.push(await new Promise(function(res, rej){ var r = new FileReader(); r.onload = function(){ res(r.result); }; r.onerror = function(){ rej(new Error('読めませんでした')); }; r.readAsDataURL(f); }));
        }else{
          urls.push(await resizeImage(f, 1800, 0.82));
        }
        names.push(f.name);
      }
      cb(urls, names);
    }catch(e){ toast(e.message, true); }
  };
  inp.click();
}
/* aiJson と同じ。ただし答えの長さの上限を変えられる（1年ぶんの学年暦は、ふつうの上限では途中で切れて読めなくなる） */
async function cpAiJson(prompt, files, tag, maxTokens){
  var parts = [];
  (files || []).forEach(function(u){
    var m = String(u).match(/^data:([^;]+);base64,(.*)$/);
    if(m) parts.push({ inline_data:{ mime_type:m[1], data:m[2] } });
  });
  parts.push({ text:prompt });
  return parseJsonLoose(await aiGenerate({ contents:[{ role:'user', parts:parts }], json:true, temperature:0.1, maxTokens:maxTokens || 4096, tag:tag }));
}
var CP_AI_NOTE = '<p class="note">⚠️ 写真・PDF・文章はGoogleのAI（Gemini）に送られます。患者さんの情報や、ほかの人の個人の情報は入れないでください。AIはまちがえることがあるので、入れる前にたしかめてください。</p>';

/* ============================== 21 出席率のグラフ ============================== */
function cpAttendInfo(name){
  var at = attendOf(name);
  var n = at.pres + at.late + at.abRaw;
  var rest = at.limit - at.ab;
  var lv = rest <= 0 ? 'over' : rest <= 1 ? 'ng' : (rest <= 2 || at.ab / Math.max(1, at.limit) >= 0.5) ? 'warn' : 'ok';
  return { name:name, pres:at.pres, late:at.late, ab:at.ab, abRaw:at.abRaw, total:at.total, limit:at.limit, rest:rest,
           rate:n ? Math.round((at.pres + at.late) / n * 100) : null, n:n, lv:lv };
}
function cpAttendRow(name, big){
  var a = cpAttendInfo(name);
  var tot = Math.max(a.total, a.n, 1);
  var w = function(v){ return (Math.round(v / tot * 1000) / 10) + '%'; };
  var cells = Math.max(a.limit, a.ab), gauge = '';
  if(cells <= 14){
    for(var i = 0; i < cells; i++) gauge += '<i class="' + (i < a.ab ? 'on' : '') + (i >= a.limit ? ' x' : '') + '"></i>';
    gauge = '<span class="cp-gauge" aria-hidden="true">' + gauge + '</span>';
  }else{
    gauge = '<span class="cp-gbar" aria-hidden="true"><i style="width:' + Math.min(100, Math.round(a.ab / Math.max(1, a.limit) * 100)) + '%"></i></span>';
  }
  var msg = a.lv === 'over' ? '<b>欠席が上限（' + a.limit + '回）に達しています</b>'
          : a.lv === 'ng' ? '<b>あと1回休むと単位がとれません</b>'
          : 'あと' + a.rest + '回まで休める';
  var label = '出席' + a.pres + '・遅刻' + a.late + '・欠席' + a.abRaw + '（全' + a.total + '回）';
  return '<div class="cp-att cp-' + a.lv + (big ? ' big' : '') + '">' +
    (big ? '' : '<div class="cp-atthd"><button class="cp-attnm" data-act="course-open" data-name="' + esc(name) + '">' + esc(shortName(name)) + '</button>' +
      '<span class="cp-attnum">' + (a.rate != null ? '出席率 ' + a.rate + '%' : 'まだ記録なし') + '</span></div>') +
    '<div class="cp-bar" role="img" aria-label="' + esc(label) + '">' +
      '<i class="cp-p" style="width:' + w(a.pres) + '"></i><i class="cp-l" style="width:' + w(a.late) + '"></i><i class="cp-a" style="width:' + w(a.abRaw) + '"></i></div>' +
    '<div class="cp-attft">' + gauge + '<span class="cp-attmsg">欠席' + a.ab + '／' + a.limit + '回・' + msg + '</span></div>' +
    '<div class="cp-attsub">' + esc(label) + (a.late >= 3 ? '・遅刻3回で欠席1回' : '') + '</div>' +
  '</div>';
}
function cpAttendBox(){
  var list = termCourses();
  if(!list.length) return '';
  var rows = list.map(function(c){ return cpAttendInfo(c.name); });
  var order = { over:0, ng:1, warn:2, ok:3 };
  rows.sort(function(a, b){ return order[a.lv] - order[b.lv] || a.rest - b.rest; });
  var bad = rows.filter(function(r){ return r.lv !== 'ok'; }).length;
  return section('出席率のグラフ', bad ? '気をつけたい授業 ' + bad : list.length + '科目',
    '<div class="cp-legend"><span><i class="cp-p"></i>出席</span><span><i class="cp-l"></i>遅刻</span><span><i class="cp-a"></i>欠席</span><span><i class="cp-g"></i>休める回数</span></div>' +
    rows.map(function(r){ return cpAttendRow(r.name, false); }).join('') +
    '<p class="note">危ない順にならべています。欠席の上限は、授業の詳細の「評価不可になる欠席回数」で授業ごとに変えられます（ふつうは授業回数の3分の1）。遅刻3回で欠席1回として数えます。</p>');
}

/* ============================== 26 GPAと単位 ============================== */
function cpGpText(){ var gp = cpCfg().gp; return Object.keys(gp).map(function(k){ return k + '=' + gp[k]; }).join('、'); }
function cpScoreLabel(n){
  var cut = cpCfg().cut;
  for(var i = 0; i < 4; i++) if(n >= cut[i]) return CP_GRADES[i];
  return '不可';
}
/* 評価の書き方（秀・S・A・85 など）→ GPの表のキー。合格・認定は '合' */
function cpGradeKey(g){
  var s = String(g == null ? '' : g);
  try{ s = s.normalize('NFKC'); }catch(e){}
  s = s.trim();
  if(!s) return null;
  var gp = cpCfg().gp, keys = Object.keys(gp), up = s.toUpperCase();
  for(var i = 0; i < keys.length; i++) if(String(keys[i]).toUpperCase() === up) return keys[i];
  if(CP_LETTER[up] && gp[CP_LETTER[up]] != null) return CP_LETTER[up];
  var al = CP_KANJI[s] || [];
  for(var j = 0; j < al.length; j++){ if(gp[al[j]] != null) return al[j]; }
  if(/^(合|合格|認|認定|P|PASS|G|修得|履修)$/i.test(s)) return '合';
  if(/^\d+(\.\d+)?$/.test(s)){ var n = parseFloat(s); if(n >= 0 && n <= 100){ var lb = cpScoreLabel(n); return gp[lb] != null ? lb : cpGradeKey(lb); } }
  return null;
}
function cpGpOf(g){
  var k = cpGradeKey(g);
  if(k == null) return { key:null, gp:null, pass:false };
  if(k === '合') return { key:'合', gp:null, pass:true };
  var v = cpNum(cpCfg().gp[k]);
  return { key:k, gp:v, pass:v > 0 };
}
function cpReq(c){ var cm = S.courseMeta[c.name] || {}; return (cm.req != null) ? !!cm.req : !!c.req; }
function cpGpa(){
  var cfg = cpCfg(), seen = {};
  var r2 = function(x){ return Math.round(x * 100) / 100; };
  var out = { terms:[], sum:0, cr:0, gpa:null, earned:{ req:0, elec:0, all:0 }, doing:{ req:0, elec:0, all:0 }, fail:[], unknown:[] };
  termsAll().slice().sort(function(a, b){ return String(a.id).localeCompare(String(b.id)); }).forEach(function(t){
    var tt = { id:t.id, label:t.label, sum:0, cr:0, gpa:null, earned:0, n:0 };
    (t.courses || []).forEach(function(c){
      if(!c || !c.name || seen[c.name]) return;
      seen[c.name] = 1;
      var cr = cpNum(c.cr), kind = cpReq(c) ? 'req' : 'elec';
      var g = S.grades[c.name] || {}, gv = g.grade || g.score;
      var r = gv ? cpGpOf(gv) : null;
      if(!r || !r.key){
        if(gv) out.unknown.push(c.name);
        else if(!(S.termsDone || {})[t.id]){ out.doing[kind] += cr; out.doing.all += cr; }
        return;
      }
      tt.n++;
      if(r.gp != null){ tt.sum += r.gp * cr; tt.cr += cr; }
      if(r.pass){ out.earned[kind] += cr; out.earned.all += cr; tt.earned += cr; }
      else out.fail.push(c.name);
    });
    tt.gpa = tt.cr ? r2(tt.sum / tt.cr) : null;
    out.sum += tt.sum; out.cr += tt.cr;
    out.terms.push(tt);
  });
  var g = cfg.grad, bg = parseFloat(g.beforeGpa), bc = cpNum(g.beforeCr);
  if(!isNaN(bg) && bg >= 0 && bc > 0){ out.sum += bg * bc; out.cr += bc; }
  out.earned.req += cpNum(g.beforeReq); out.earned.elec += cpNum(g.beforeElec);
  out.earned.all = out.earned.req + out.earned.elec;
  out.gpa = out.cr ? r2(out.sum / out.cr) : null;
  out.need = { total:cpNum(g.total), req:cpNum(g.req), elec:cpNum(g.elec) };
  out.rest = {
    total:Math.max(0, out.need.total - out.earned.all),
    req:Math.max(0, out.need.req - out.earned.req),
    elec:Math.max(0, out.need.elec - out.earned.elec)
  };
  return out;
}
function cpGpaBox(){
  var o = cpGpa(), cfg = cpCfg(), g = cfg.grad;
  var meter = function(label, got, doing, need){
    var pct = need ? Math.min(100, Math.round(got / need * 100)) : 0;
    var pct2 = need ? Math.min(100 - pct, Math.round(doing / need * 100)) : 0;
    return '<div class="cp-cr"><div class="cp-crhd"><b>' + esc(label) + '</b><span>' + got + (need ? ' ／ ' + need : '') + '単位' +
      (need ? (got >= need ? '<span class="b cr" style="margin-left:6px">足りています</span>' : '　あと<b>' + (need - got) + '</b>') : '') + '</span></div>' +
      (need ? '<div class="cp-bar"><i class="cp-p" style="width:' + pct + '%"></i><i class="cp-d" style="width:' + pct2 + '%"></i></div>' : '') +
      (doing ? '<div class="cp-attsub">いま受けている ' + doing + '単位（成績が出ると、とった単位に入ります）</div>' : '') + '</div>';
  };
  var hasNeed = o.need.total || o.need.req || o.need.elec;
  return section('GPAと単位', o.gpa != null ? '通算GPA ' + o.gpa.toFixed(2) : null,
    '<div class="grid3 keep3" style="margin-bottom:10px">' +
      '<div class="stat"><div class="k">通算GPA</div><div class="v num">' + (o.gpa != null ? o.gpa.toFixed(2) : '—') + '</div></div>' +
      '<div class="stat"><div class="k">とった単位</div><div class="v num">' + o.earned.all + '</div></div>' +
      '<div class="stat"><div class="k">卒業まで</div><div class="v num">' + (o.need.total ? 'あと' + o.rest.total : '—') + '</div></div></div>' +
    o.terms.filter(function(t){ return t.n; }).map(function(t){
      return '<div class="row"><div class="grow"><div class="t">' + esc(t.label) + '</div><div class="s">' + t.n + '科目・とった単位 ' + t.earned + '</div></div>' +
        '<div class="t num">GPA ' + (t.gpa != null ? t.gpa.toFixed(2) : '—') + '</div></div>';
    }).join('') +
    meter('必修', o.earned.req, o.doing.req, o.need.req) +
    meter('選択', o.earned.elec, o.doing.elec, o.need.elec) +
    meter('合計', o.earned.all, o.doing.all, o.need.total) +
    (!hasNeed ? '<div class="bn amber"><span class="ic">!</span><span>下の「卒業に必要な単位」を入れると、あと何単位かが出ます（学生便覧・履修の手引きに書いてあります）。</span></div>' : '') +
    (o.fail.length ? '<div class="s2" style="margin-top:6px">単位にならなかった授業：' + esc(o.fail.join('、')) + '</div>' : '') +
    (o.unknown.length ? '<div class="bn amber"><span class="ic">!</span><span>評価の書き方が読めない授業があります：' + esc(o.unknown.join('、')) + '（下のGPの表に足してください）</span></div>' : '') +
    '<details class="cp-det"><summary>計算のきまり・卒業に必要な単位を変える</summary>' +
      '<div class="field"><label class="f" for="cp_gp">GPの付け方（大学のきまりに合わせる）</label><input id="cp_gp" value="' + esc(cpGpText()) + '" placeholder="秀=4、優=3、良=2、可=1、不可=0"></div>' +
      '<div class="field"><label class="f" for="cp_cut">点数からの評価（秀・優・良・可の、いちばん下の点）</label><input id="cp_cut" value="' + esc(cfg.cut.join(',')) + '" placeholder="90,80,70,60"></div>' +
      '<label class="f">卒業に必要な単位</label><div class="grid3 keep3">' +
        '<div><label class="f" for="cp_g_total">合計</label><input id="cp_g_total" inputmode="numeric" value="' + esc(g.total || '') + '" placeholder="例：127"></div>' +
        '<div><label class="f" for="cp_g_req">必修</label><input id="cp_g_req" inputmode="numeric" value="' + esc(g.req || '') + '"></div>' +
        '<div><label class="f" for="cp_g_elec">選択</label><input id="cp_g_elec" inputmode="numeric" value="' + esc(g.elec || '') + '"></div></div>' +
      '<label class="f" style="margin-top:8px">アプリに入っていない、前にとった単位</label><div class="grid2">' +
        '<div><label class="f" for="cp_g_breq">必修</label><input id="cp_g_breq" inputmode="numeric" value="' + esc(g.beforeReq || '') + '"></div>' +
        '<div><label class="f" for="cp_g_belec">選択</label><input id="cp_g_belec" inputmode="numeric" value="' + esc(g.beforeElec || '') + '"></div>' +
        '<div><label class="f" for="cp_g_bgpa">そのぶんのGPA（あれば）</label><input id="cp_g_bgpa" inputmode="decimal" value="' + esc(g.beforeGpa || '') + '" placeholder="例：3.1"></div>' +
        '<div><label class="f" for="cp_g_bcr">GPAの計算に入る単位</label><input id="cp_g_bcr" inputmode="numeric" value="' + esc(g.beforeCr || '') + '"></div></div>' +
      '<button class="btn ghost" style="margin-top:8px" data-act="cp-gpa-save">保存する</button>' +
    '</details>' +
    '<p class="note">成績は授業の詳細の「成績」で入れます（秀・優・良・可・不可、S・A・B・C・D、点数のどれでも）。「合格」「認定」は単位だけ数えて、GPAには入れません。</p>');
}
function cpGpaSave(){
  var pairs = {}, n = 0, re = /([^=:：＝\s,、，]+)\s*[=:：＝]\s*(-?[0-9.]+)/g, m;
  var txt = val('cp_gp');
  try{ txt = txt.normalize('NFKC'); }catch(e){}
  while((m = re.exec(txt))){ pairs[m[1]] = parseFloat(m[2]); n++; }
  if(!n){ toast('GPの付け方は「秀=4、優=3」のように書いてください', true); return; }
  var cut = val('cp_cut').split(/[,、\s]+/).map(cpNum).filter(function(x){ return x > 0; });
  if(cut.length !== 4){ toast('点数からの評価は「90,80,70,60」のように4つ書いてください', true); return; }
  cut.sort(function(a, b){ return b - a; });
  var num = function(id){ return cpNum(val(id)) || 0; };
  cpCfgSet({ gp:pairs, cut:cut, grad:{ total:num('cp_g_total'), req:num('cp_g_req'), elec:num('cp_g_elec'),
    beforeReq:num('cp_g_breq'), beforeElec:num('cp_g_belec'), beforeGpa:val('cp_g_bgpa').trim(), beforeCr:num('cp_g_bcr') } });
  toast('GPAの計算のきまりを保存しました'); commit();
}

/* ============================== 25 成績の見込み ============================== */
function cpEvalItems(name){
  var sy = S.syllabus[name] || {};
  if(Array.isArray(sy.items) && sy.items.length){
    return sy.items.map(function(x){ return { key:(x.kind || 'other') + ':' + x.name, name:x.name, pct:cpNum(x.pct), kind:x.kind || 'other' }; })
      .filter(function(x){ return x.pct > 0; });
  }
  return [['exam', 'テスト', 'exam'], ['rep', 'レポート', 'report'], ['att', '出席・平常点', 'attend'], ['other', 'そのほか', 'other']]
    .map(function(a){ return { key:a[0], name:a[1], pct:cpNum(sy[a[0]]), kind:a[2] }; })
    .filter(function(x){ return x.pct > 0; });
}
function cpScoreRec(name){ var r = cpData('score:' + name); return { v:(r && r.v) || {}, q:(r && r.q) || {} }; }
function cpQuizzes(name){ return S.exams.filter(function(x){ return x.kind === 'quiz' && sameSubject(x.subject, name); }).sort(function(a, b){ return String(a.date).localeCompare(String(b.date)); }); }
function cpForecast(name){
  var items = cpEvalItems(name), rec = cpScoreRec(name);
  var at = cpAttendInfo(name);
  var has = function(v){ return v !== undefined && v !== null && v !== '' && !isNaN(Number(v)); };
  var qs = cpQuizzes(name).map(function(x){ return rec.q[x.id]; }).filter(has).map(Number);
  var quizAvg = qs.length ? Math.round(qs.reduce(function(a, b){ return a + b; }, 0) / qs.length) : null;
  var clamp = function(n){ return Math.max(0, Math.min(100, Number(n))); };
  items = items.map(function(it){
    var auto = null;
    if(it.kind === 'attend' && at.rate != null) auto = at.rate;
    if(it.kind === 'quiz' && quizAvg != null) auto = quizAvg;
    var man = rec.v[it.key];
    var s = has(man) ? clamp(man) : auto;
    return Object.assign({}, it, { score:s, auto:auto, src:has(man) ? 'manual' : (auto != null ? 'auto' : '') });
  });
  var P = items.reduce(function(a, x){ return a + x.pct; }, 0);
  var known = items.filter(function(x){ return x.score != null; }), unknown = items.filter(function(x){ return x.score == null; });
  var kp = known.reduce(function(a, x){ return a + x.pct; }, 0), ks = known.reduce(function(a, x){ return a + x.pct * x.score; }, 0);
  var cur = kp ? ks / kp : null;
  var exams = unknown.filter(function(x){ return x.kind === 'exam'; });
  var target = exams.filter(function(x){ return /期末/.test(x.name); })[0] || exams[exams.length - 1] || null;
  var others = unknown.filter(function(x){ return x !== target; });
  var fin = (!unknown.length && P) ? Math.round(ks / P * 10) / 10 : null;
  var need = null;
  if(target && P && (cur != null || !others.length)){
    var base = ks + others.reduce(function(a, x){ return a + x.pct * (cur || 0); }, 0);
    /* 小数の計算の誤差（60.0000001 → 61点）で1点多くならないように */
    need = cpCfg().cut.map(function(c, i){ return { grade:CP_GRADES[i], cut:c, score:Math.ceil((c * P - base) / target.pct - 1e-9) }; });
  }
  var nowPct = fin != null ? fin : (cur != null ? Math.round(cur * 10) / 10 : null);
  return { name:name, items:items, P:P, cur:nowPct, fixed:fin != null, grade:nowPct != null ? cpScoreLabel(nowPct) : null,
           target:target ? { name:target.name, pct:target.pct } : null, need:need, assume:others.length > 0 && cur != null, quizAvg:quizAvg };
}
function cpForecastSection(name){
  var f = cpForecast(name);
  if(!f.items.length){
    return section('成績の見込み', null, '<div class="empty" style="padding:6px 0">上の「シラバス・評価」に成績の付け方（テスト◯%・レポート◯%…）を入れると、見込みが出せます。シラバスの写真から読むこともできます。</div>');
  }
  var rec = cpScoreRec(name), qz = cpQuizzes(name);
  var h = '<div class="cp-fc">' + f.items.map(function(it, i){
    var man = rec.v[it.key];
    return '<div class="row"><div class="grow"><div class="t">' + esc(it.name) + '<span class="b cr" style="margin-left:6px">' + it.pct + '%</span></div>' +
      '<div class="s">' + (it.src === 'auto' ? (it.kind === 'attend' ? '出席の記録から ' + it.auto + '点' : '小テストの平均 ' + it.auto + '点') + '（自分で入れると、そちらを使います）'
        : it.kind === 'exam' ? 'まだなら空のまま' : '100点満点で') + '</div></div>' +
      '<input id="cpsc_' + i + '" class="cp-sc" inputmode="numeric" value="' + esc(man != null ? man : '') + '" placeholder="' + (it.auto != null ? it.auto : '点') + '" aria-label="' + esc(it.name) + 'の点"></div>';
  }).join('') + '</div>';
  if(qz.length){
    h += '<details class="cp-det"><summary>小テストの点を入れる（' + qz.length + '回）</summary>' + qz.map(function(x){
      return '<div class="row"><div class="grow t">' + esc(x.title || '小テスト') + '<span class="s2">　' + (isYmd(x.date) ? ymdLabel(x.date) : '') + '</span></div>' +
        '<input id="cpq_' + esc(x.id) + '" class="cp-sc" inputmode="numeric" value="' + esc(rec.q[x.id] != null ? rec.q[x.id] : '') + '" placeholder="点"></div>';
    }).join('') + '</details>';
  }
  h += '<button class="btn ghost" style="margin-top:8px" data-act="cp-score-save" data-name="' + esc(name) + '">点を保存して計算する</button>';
  if(f.cur != null){
    h += '<div class="bn ' + (f.grade === '不可' ? 'red' : f.grade === '可' ? 'amber' : 'green') + '" style="margin-top:10px"><span class="ic">📊</span><span>' +
      (f.fixed ? 'ぜんぶの点から計算すると <b>' + f.grade + '（' + f.cur + '点）</b>です。' : 'いまの見込みは <b>' + f.grade + '（' + f.cur + '点）</b>です。') + '</span></div>';
  }
  if(f.need){
    h += '<label class="f" style="margin-top:8px">' + esc(f.target.name) + '（' + f.target.pct + '%）で何点とれば…</label>' +
      '<div class="cp-need">' + f.need.map(function(n){
        var txt = n.score <= 0 ? '0点でも届きます' : n.score > 100 ? '満点でも届きません' : '<b>' + n.score + '点</b>以上';
        return '<div class="cp-needrow' + (n.score > 100 ? ' no' : '') + '"><span class="cp-gr">' + n.grade + '</span><span>' + txt + '</span></div>';
      }).join('') + '</div>' +
      (f.assume ? '<p class="note">まだ点のないほかの項目は、いまの平均と同じ点として計算しています。</p>' : '');
  }
  h += '<p class="note">シラバスの割合と、入れた点からの目安です。本当の付け方は先生によってちがうので、シラバス・先生の説明でたしかめてください。</p>';
  return section('成績の見込み', f.grade ? '見込み ' + f.grade : null, h);
}
function cpScoreSave(name){
  var f = cpForecast(name), rec = cpScoreRec(name), v = {}, q = {};
  var bad = false;
  var read = function(id){
    var e = document.getElementById(id); if(!e) return undefined;
    var s = String(e.value || '').trim(); try{ s = s.normalize('NFKC'); }catch(err){}
    if(s === '') return '';
    var n = parseFloat(s); if(isNaN(n) || n < 0 || n > 100){ bad = true; return undefined; }
    return n;
  };
  f.items.forEach(function(it, i){ var x = read('cpsc_' + i); if(x === undefined) x = rec.v[it.key]; if(x !== '' && x != null) v[it.key] = x; });
  cpQuizzes(name).forEach(function(x){ var s = read('cpq_' + x.id); if(s === undefined) s = rec.q[x.id]; if(s !== '' && s != null) q[x.id] = s; });
  if(bad){ toast('点は0〜100の数字で入れてください', true); return; }
  cpDataSet('score:' + name, { v:v, q:q });
  toast('点を保存しました'); commit();
}

/* ============================== 22・175 大学のメール・Googleフォーム ============================== */
var cpUni = { busy:{}, pending:{}, err:{} };
var CP_UNI_TYPE = { cancel:['休講', 'red'], makeup:['補講', 'green'], room:['教室変更', 'amber'], task:['課題', 'blue'], info:['連絡', 'blue'], form:['フォーム', 'blue'] };
function cpFormUrls(text){
  return (String(text || '').match(/https:\/\/(?:forms\.gle\/[A-Za-z0-9_-]+|docs\.google\.com\/forms\/[^\s"<>)）」]+)/g) || [])
    .filter(function(u, i, a){ return a.indexOf(u) === i; }).slice(0, 5);
}
/* メールを1通、候補の置き場（kmItems）に入れる。フォームのURLは、AIがなくても候補にする */
function cpUniMake(title, text, forms, ref, ymd){
  if(ref && cpItems('uni').some(function(x){ return x.ref === ref; })) return null;
  forms = (Array.isArray(forms) ? forms : []).concat(cpFormUrls(text)).filter(function(u, i, a){ return /^https:\/\//.test(u) && a.indexOf(u) === i; }).slice(0, 5);
  var it = { id:uid('km'), mt:Date.now(), mod:'campus', type:'uni', title:String(title || '大学からのメール').slice(0, 120),
    text:String(text || '').slice(0, 3000), forms:forms, ref:String(ref || ''), ymd:ymd || today(), st:'new', parsed:0,
    cands:forms.map(function(u, i){ return { k:'f' + i, type:'form', course:'', date:'', period:0, room:'', title:'Googleフォーム', due:'', time:'', url:u, note:'', st:'' }; }) };
  S.kmItems = Array.isArray(S.kmItems) ? S.kmItems : [];
  S.kmItems.push(it);
  /* 古い、しまったメールは片付ける（30通まで） */
  var mine = cpItems('uni');
  if(mine.length > 30){
    mine.filter(function(x){ return x.st === 'done'; }).sort(function(a, b){ return (a.mt || 0) - (b.mt || 0); })
      .slice(0, mine.length - 30).forEach(function(x){ removeItem('kmItems', x.id); });
  }
  return it;
}
function cpUniPrompt(it){
  var courses = termCourses().map(function(c){ return c.name; }).join('、');
  return 'つぎは大学から届いたメールです。看護学部1年生の手帳に入れるため、JSONだけを返してください。\n' +
    '{"items":[{"type":"cancel(休講)|makeup(補講)|room(教室変更)|task(課題・提出物)|info(そのほかの連絡)","course":"授業名（下の一覧の名前で。わからなければ空）",' +
    '"date":"休講・補講・教室変更の日 YYYY-MM-DD（なければ空）","period":何限か(数字。なければ0),"room":"教室（なければ空）","all":その日の授業ぜんぶが休講なら true,' +
    '"title":"短い名前","due":"締切 YYYY-MM-DD（課題・提出物のとき。なければ空）","time":"締切の時刻 HH:MM（なければ空）","note":"大事なことを短く"}],' +
    '"forms":[{"url":"フォームのURL","title":"何のフォームか短く","due":"締切 YYYY-MM-DD（なければ空）","time":"締切の時刻（なければ空）"}]}\n' +
    '・今日は' + today() + '（メールが届いた日は' + it.ymd + '）。年が書いていない日付は、その日に近い日にする。\n' +
    '・手帳に入れることがなければ items は空にする。\n' +
    '・授業の一覧：' + courses + '\n' +
    (it.forms.length ? '・メールの中のフォーム：' + it.forms.join(' ') + '\n' : '') +
    '【件名】' + it.title + '\n【本文】\n' + it.text.slice(0, 6000);
}
function cpUniParse(id){
  if(cpUni.pending[id]) return cpUni.pending[id];
  var it = cpItem(id);
  if(!it) return Promise.resolve(null);
  if(!aiReady()){ return Promise.resolve(null); }
  cpUni.busy[id] = 1; cpUni.err[id] = '';
  var p = (async function(){
    try{
      var r = await aiJson(cpUniPrompt(it), [], 'cp-uni');
      it = cpItem(id); if(!it) return null;
      var cands = (it.cands || []).filter(function(c){ return c.type === 'form'; });
      var n = 0;
      (Array.isArray(r && r.items) ? r.items : []).forEach(function(x){
        x = x || {};
        var type = CP_UNI_TYPE[x.type] ? x.type : 'info';
        if(type === 'form') type = 'info';
        cands.push({ k:'a' + (n++), type:type, course:x.all ? '*' : cpCourse(x.course), courseRaw:String(x.course || '').slice(0, 40),
          date:cpYmd(x.date), period:Math.max(0, Math.min(PERIODS[PERIODS.length - 1], toNum(x.period))), room:String(x.room || '').slice(0, 30),
          title:String(x.title || '').slice(0, 80), due:cpYmd(x.due), time:cpHm(x.time), url:'', note:String(x.note || '').slice(0, 200), st:'' });
      });
      (Array.isArray(r && r.forms) ? r.forms : []).forEach(function(f){
        f = f || {};
        var c = cands.filter(function(z){ return z.type === 'form' && z.url === f.url; })[0];
        if(!c && /^https:\/\//.test(String(f.url || ''))){ c = { k:'f' + cands.length, type:'form', course:'', date:'', period:0, room:'', url:String(f.url).slice(0, 300), note:'', st:'' }; cands.push(c); }
        if(!c) return;
        c.title = String(f.title || c.title || 'Googleフォーム').slice(0, 80);
        if(!c.due) c.due = cpYmd(f.due);
        if(!c.time) c.time = cpHm(f.time);
      });
      /* もう入っているフォームは印をつけておく */
      cands.forEach(function(c){ if(c.type === 'form' && S.tasks.some(function(t){ return t.url === c.url; })) c.st = 'dup'; });
      it.cands = cands; it.parsed = 1; it.mt = Date.now();
      if(!cands.some(function(c){ return !c.st; })) it.st = 'done';
      commit();
      return it;
    }catch(e){
      cpUni.err[id] = 'AIで読めませんでした：' + e.message;
      logErr('大学のメール', e.message);
      cpRender();
      return null;
    }finally{
      delete cpUni.busy[id]; delete cpUni.pending[id];
    }
  })();
  cpUni.pending[id] = p;
  return p;
}
/* 橋わたしが受け取った大学のメール（kind:'uni'） */
kmInbox('uni', function(item, ymd){
  /* ref も id もないときは、ほかのメールと取りちがえないように、くらべない */
  var it = cpUniMake(item.title, item.text, item.forms, item.ref || (item.id ? 'in-' + item.id : ''), ymd);
  if(!it) return '大学のメール（もう受け取りずみ）';
  if(aiReady()) cpUniParse(it.id);
  return '大学のメール「' + String(it.title).slice(0, 24) + '」を受け取りました';
});
function cpCandVal(it, c, f){
  var el = document.getElementById('cpu_' + f + '_' + it.id + '_' + c.k);
  return el ? el.value : null;
}
function cpUniAdd(id, k, quiet){
  var it = cpItem(id); if(!it) return false;
  var c = (it.cands || []).filter(function(z){ return z.k === k; })[0];
  if(!c || c.st) return false;
  var course = cpCandVal(it, c, 'c'); if(course == null) course = c.course || '';
  var date = cpCandVal(it, c, 'd'); date = date == null ? (c.type === 'task' || c.type === 'form' ? c.due : c.date) : date;
  var period = cpCandVal(it, c, 'p'); period = toNum(period == null ? c.period : period);
  var title = cpCandVal(it, c, 't'); if(title == null) title = c.title;
  var now = Date.now(), msg = '';
  var need = function(t){ if(!quiet) toast(t, true); return false; };
  if(c.type === 'cancel' || c.type === 'makeup'){
    if(!isYmd(date)) return need('日付を入れてください');
    if(!course || (c.type === 'makeup' && course === '*')) return need('どの授業か選んでください');
    if(c.type === 'makeup' && !period) return need('補講は何限かを選んでください');
    var dupH = S.holidays.some(function(h){ return h.date === date && h.course === course && changeType(h) === c.type && (c.type !== 'makeup' || toNum(h.period) === period); });
    if(!dupH) S.holidays.push({ id:uid('hx'), date:date, course:course, type:c.type, period:c.type === 'makeup' ? period : 0, room:c.room || '', mt:now });
    msg = (course === '*' ? 'ぜんぶの授業' : shortName(course)) + 'の' + CP_UNI_TYPE[c.type][0] + '（' + ymdLabel(date) + '）';
  }else if(c.type === 'room'){
    if(!course) return need('どの授業か選んでください');
    if(isYmd(date)){
      S.events.push({ id:uid('ev'), date:date, dateEnd:'', title:'教室変更：' + (c.room || '（教室を確認）'), subject:course, time:'', kind:'imp',
        memo:c.note || '', photos:[], mt:now });
      msg = shortName(course) + 'の教室変更（' + ymdLabel(date) + '）';
    }else{
      if(!c.room) return need('新しい教室がわかりません');
      var cm = S.courseMeta[course] || {}; cm.room = c.room; S.courseMeta[course] = cm; touch('courseMeta');
      msg = shortName(course) + 'の教室を ' + c.room + ' に';
    }
  }else if(c.type === 'task' || c.type === 'form'){
    if(c.type === 'form' && S.tasks.some(function(t){ return t.url === c.url; })){ c.st = 'dup'; it.mt = now; if(!quiet) toast('このフォームはもう入っています'); return true; }
    S.tasks.push({ id:uid('tk'), title:(c.type === 'form' ? 'フォーム：' : '') + (title || (c.type === 'form' ? 'Googleフォームを出す' : '課題')),
      subject:course && course !== '*' ? course : '', due:isYmd(date) ? date : '', time:c.time || '', done:0,
      memo:'大学のメール「' + it.title.slice(0, 40) + '」から' + (c.note ? '\n' + c.note : ''), subs:[], photos:[], pri:1,
      how:c.type === 'form' ? 'form' : '', url:c.url || '', mt:now });
    msg = (c.type === 'form' ? 'フォーム' : '課題') + '「' + (title || '').slice(0, 20) + '」' + (isYmd(date) ? '（締切 ' + ymdLabel(date) + '）' : '');
  }else{
    if(isYmd(date)){
      S.events.push({ id:uid('ev'), date:date, dateEnd:'', title:title || it.title.slice(0, 40), subject:course && course !== '*' ? course : '', time:'', kind:'other',
        memo:c.note || '', photos:[], mt:now });
    }else{
      S.notes.push({ id:uid('nt'), title:'📩 ' + (title || it.title).slice(0, 60), body:(c.note ? c.note + '\n\n' : '') + it.text.slice(0, 1500), pinned:0, checks:[], photos:[],
        link:course && course !== '*' ? { type:'course', id:course } : null, ct:now, mt:now });
    }
    msg = '連絡「' + (title || it.title).slice(0, 20) + '」';
  }
  c.st = 'added'; it.mt = now;
  if(!(it.cands || []).some(function(z){ return !z.st; })) it.st = 'done';
  if(!quiet) toast(msg + 'を入れました');
  return true;
}
function cpUniCandHtml(it, c){
  var ty = CP_UNI_TYPE[c.type] || CP_UNI_TYPE.info;
  var done = !!c.st;
  var courseSel = function(){
    return '<select id="cpu_c_' + it.id + '_' + c.k + '" aria-label="授業">' +
      '<option value="">授業をえらぶ</option>' + (c.type === 'cancel' ? '<option value="*"' + (c.course === '*' ? ' selected' : '') + '>その日ぜんぶ</option>' : '') +
      termCourses().map(function(x){ return '<option value="' + esc(x.name) + '"' + (x.name === c.course ? ' selected' : '') + '>' + esc(shortName(x.name)) + '</option>'; }).join('') + '</select>';
  };
  var isDue = c.type === 'task' || c.type === 'form';
  var d = isDue ? c.due : c.date;
  var fields = done ? '' : '<div class="cp-candf">' +
    (c.type === 'form' || c.type === 'task' ? '<input id="cpu_t_' + it.id + '_' + c.k + '" value="' + esc(c.title || '') + '" placeholder="名前" aria-label="名前">' : '') +
    (c.type !== 'form' ? courseSel() : '') +
    '<label class="cp-dl">' + (isDue ? '締切' : '日') + '<input type="date" id="cpu_d_' + it.id + '_' + c.k + '" value="' + esc(d || '') + '"></label>' +
    /* 時限がわからないときは「何限？」のままにして、えらぶまで入れない（だまって1限にしない） */
    (c.type === 'makeup' ? '<select id="cpu_p_' + it.id + '_' + c.k + '" aria-label="何限">' + '<option value="">何限？</option>' + PERIODS.map(function(p){ return '<option value="' + p + '"' + (toNum(c.period) === p ? ' selected' : '') + '>' + p + '限</option>'; }).join('') + '</select>' : '') +
    '</div>';
  return '<div class="cp-cand' + (done ? ' done' : '') + '">' +
    '<div class="cp-candhd"><span class="b ' + (ty[1] === 'red' ? 'warn' : ty[1] === 'amber' ? 'r2' : 'cat') + '">' + ty[0] + '</span>' +
      '<span class="grow t">' + esc(c.title || (c.course && c.course !== '*' ? shortName(c.course) : c.courseRaw || '')) +
      '<span class="s2">　' + esc([c.course && c.course !== '*' && c.title ? shortName(c.course) : '', isYmd(d) ? ymdLabel(d) : '', c.period ? c.period + '限' : '', c.room || '', c.time ? c.time + 'まで' : ''].filter(Boolean).join('・')) + '</span></span>' +
      (done ? '<span class="s2">' + (c.st === 'added' ? '入れました' : c.st === 'dup' ? 'もう入っています' : 'いらない') + '</span>' : '') + '</div>' +
    (c.note ? '<div class="s2">' + esc(c.note) + '</div>' : '') +
    (c.url ? '<div class="s2"><a href="' + esc(c.url) + '" target="_blank" rel="noopener">フォームを開く</a></div>' : '') +
    fields +
    (done ? '' : '<div class="pillrow"><button class="mini on" data-act="cp-uni-add" data-id="' + it.id + '" data-k="' + esc(c.k) + '">入れる</button>' +
      '<button class="mini" data-act="cp-uni-skip" data-id="' + it.id + '" data-k="' + esc(c.k) + '">いらない</button></div>') +
  '</div>';
}
function cpUniBox(){
  var list = cpItems('uni').filter(function(x){ return x.st !== 'done'; }).sort(function(a, b){ return (b.mt || 0) - (a.mt || 0); });
  var dom = gfeat().uniDomain;
  var h = list.map(function(it){
    var open = (it.cands || []).filter(function(c){ return !c.st; }).length;
    return '<div class="cp-mail"><div class="cp-mailhd"><span class="ic">📩</span><span class="grow"><b>' + esc(it.title) + '</b><span class="s2">　' + esc(ymdLabel(it.ymd)) + '</span></span></div>' +
      (it.parsed ? '' : (cpUni.busy[it.id] ? '<div class="s2">AIが読んでいます…</div>'
        : '<button class="mini" data-act="cp-uni-parse" data-id="' + it.id + '">AIで読んで、休講・課題などを見つける</button>')) +
      (cpUni.err[it.id] ? '<div class="s2" style="color:var(--rakuten)">' + esc(cpUni.err[it.id]) + '</div>' : '') +
      (it.parsed && !(it.cands || []).length ? '<div class="s2">手帳に入れることは見つかりませんでした。</div>' : '') +
      (it.cands || []).map(function(c){ return cpUniCandHtml(it, c); }).join('') +
      '<details class="cp-det"><summary>メールの本文</summary><div class="cp-mailtx">' + esc(it.text) + '</div></details>' +
      '<div class="pillrow">' + (open > 1 ? '<button class="mini" data-act="cp-uni-all" data-id="' + it.id + '">ぜんぶ入れる</button>' : '') +
        '<button class="mini" data-act="cp-uni-done" data-id="' + it.id + '">このメールをしまう</button></div>' +
    '</div>';
  }).join('');
  return section('大学のメール・フォーム', list.length ? '見てほしいもの ' + list.length + '通' : null,
    (h || '<div class="s2" style="margin-bottom:6px">いまは、見てほしい大学のメールはありません。</div>') +
    '<details class="cp-det"' + (list.length ? '' : ' open') + '><summary>メールの本文を貼って読む</summary>' +
      '<textarea id="cp_uni_text" style="min-height:90px" placeholder="休講・補講・教室変更・課題のメールを、件名ごとコピーして貼り付け"></textarea>' +
      '<button class="btn" style="margin-top:6px" data-act="cp-uni-paste">AIで読みとる</button></details>' +
    '<details class="cp-det"><summary>Googleフォームを「出すもの」に入れる</summary>' +
      '<div class="field"><label class="f" for="cp_form_url">フォームのURL</label><input id="cp_form_url" placeholder="https://forms.gle/…"></div>' +
      '<div class="field"><label class="f" for="cp_form_title">何のフォーム？（任意）</label><input id="cp_form_title" placeholder="例：授業アンケート"></div>' +
      '<div class="field"><label class="f" for="cp_form_due">締切（任意）</label><input type="date" id="cp_form_due"></div>' +
      '<button class="btn ghost" data-act="cp-form-add">出すものに入れる</button></details>' +
    '<p class="note">' + (dom ? '橋わたしが「' + esc(dom) + '」からのメールを見つけると、ここに届きます。' : '設定の「大学のメール」で大学のメールのドメインを入れると、Gmailに届いたメールが自動でここに届きます。') +
      '「入れる」を押すまで、手帳には入りません。フォームは課題（ToDo）に入り、出したら完了にします。</p>' + CP_AI_NOTE);
}
function cpUniPaste(){
  var tx = val('cp_uni_text').trim();
  if(!tx){ toast('メールの本文を貼ってください', true); return null; }
  if(!aiReady() && !cpFormUrls(tx).length){ toast('先に設定タブでGemini APIキーを登録してください', true); return null; }
  var first = tx.split('\n')[0].replace(/^(件名|subject)\s*[:：]\s*/i, '').slice(0, 80);
  var it = cpUniMake(first || '貼ったメール', tx, [], 'paste-' + hash53(tx), today());
  if(!it){ toast('同じメールはもう読んであります'); return null; }
  persist(); pushRemote(); render();
  var p = cpUniParse(it.id);
  p.then(function(){ var el = document.getElementById('cp_uni_text'); if(el) el.value = ''; });
  return p;
}
function cpFormAdd(url, title, due){
  url = String(url || '').trim();
  if(!/^https:\/\/\S+$/.test(url)){ toast('フォームのURL（https://…）を入れてください', true); return false; }
  if(S.tasks.some(function(t){ return t.url === url && !t.done; })){ toast('このフォームはもう入っています'); return false; }
  S.tasks.push({ id:uid('tk'), title:'フォーム：' + (String(title || '').trim() || 'Googleフォームを出す'), subject:'', due:isYmd(due) ? due : '', time:'', done:0,
    memo:'', subs:[], photos:[], pri:1, how:'form', url:url, mt:Date.now() });
  toast('フォームを「出すもの」に入れました' + (isYmd(due) ? '（締切 ' + ymdLabel(due) + '）' : '（締切はToDoで入れられます）'));
  return true;
}
function cpUniSettings(){
  var dom = gfeat().uniDomain, ok = gasReady() && toNum(GAS.ver) >= 3;
  return '<div class="field"><label class="f" for="cp_uni_dom">大学のメールのドメイン（@ のうしろ）</label>' +
    '<input id="cp_uni_dom" value="' + esc(dom) + '" placeholder="例：mukogawa-u.ac.jp" autocapitalize="off"></div>' +
    '<button class="btn ghost" data-act="cp-uni-domain">保存する</button>' +
    (ok ? '' : '<div class="bn amber" style="margin-top:8px"><span class="ic">!</span><span>Google連携（橋わたし）を新しい版にすると、Gmailに届いた大学のメールを自動で受け取れます。いまは、授業タブでメールの本文を貼って読むことができます。</span></div>') +
    '<p class="note">このドメインから届いた「休講・補講・教室・課題・提出・フォーム」などのメールを、橋わたしが見つけてアプリに届けます（Gmailは読むだけ）。授業タブの「大学のメール・フォーム」で、入れるかどうかを選べます。</p>';
}

/* ============================== 33 学年暦 ============================== */
var cpCal = { busy:false, list:null, err:'', files:[] };
var CP_CAL_TO = { event:'予定', imp:'大事な予定', break:'休み（授業なし・何日も）', off:'授業なし（1日）', holclass:'祝日でも授業', none:'入れない' };
function cpCalDefault(x){
  if(x.kind === 'break') return 'break';
  if(x.kind === 'noclass') return x.to && x.to !== x.from ? 'break' : 'off';
  if(x.kind === 'holclass') return holidayName(x.from) ? 'holclass' : 'imp';
  if(x.kind === 'exam' || x.kind === 'start' || x.kind === 'end') return 'imp';
  return 'event';
}
async function cpCalRead(files, text){
  files = files || []; text = String(text || '').trim();
  if(!files.length && !text){ toast('学年暦の写真・PDFをえらぶか、文章を貼ってください', true); return; }
  if(!aiReady()){ toast('先に設定タブでGemini APIキーを登録してください', true); return; }
  cpCal = { busy:true, list:null, err:'', files:[] }; cpRender();
  try{
    var r = await cpAiJson(
      'これは大学の学年暦（1年間の予定表）です。手帳に入れるため、JSONだけを返してください。\n' +
      '{"items":[{"kind":"start(授業開始)|end(授業終了)|exam(試験期間)|break(休業・休み)|noclass(休講日・授業のない日)|holclass(祝日だけど授業がある日)|event(行事：入学式・大学祭・健康診断・補講日など)",' +
      '"title":"名前","from":"YYYY-MM-DD","to":"YYYY-MM-DD（1日だけなら from と同じ）","note":"短いメモ（なければ空）"}]}\n' +
      '・今は' + today() + '。「2026年度」のように年度で書いてあるときは、1〜3月は次の年にする。\n' +
      '・前期・後期のどちらも読む。読めないところは入れない。' + (text ? '\n【学年暦】\n' + text.slice(0, 15000) : ''), files, 'cp-cal', 8192);
    var kinds = { start:1, end:1, exam:1, 'break':1, noclass:1, holclass:1, event:1 };
    cpCal.list = (Array.isArray(r && r.items) ? r.items : []).map(function(x){
      x = x || {};
      var f = cpYmd(x.from), t = cpYmd(x.to) || f;
      if(t && f && t < f){ var z = f; f = t; t = z; }
      var o = { kind:kinds[x.kind] ? x.kind : 'event', title:String(x.title || '').slice(0, 60), from:f, to:t, note:String(x.note || '').slice(0, 100) };
      o.to2 = cpCalDefault(o);
      return o;
    }).filter(function(x){ return x.title && isYmd(x.from); })
      .sort(function(a, b){ return a.from.localeCompare(b.from); }).slice(0, 80);
  }catch(e){
    cpCal.err = '読み取れませんでした：' + e.message;
    logErr('学年暦', e.message);
  }finally{
    cpCal.busy = false; cpRender();
  }
}
function cpCalBox(){
  var h = '<div class="pillrow"><button class="btn" data-act="cp-cal-files"' + (cpCal.busy ? ' disabled' : '') + '>' + (cpCal.busy ? '読み取っています…' : '📷 学年暦の写真・PDFをえらぶ') + '</button></div>' +
    '<details class="cp-det"><summary>文章を貼って読む</summary><textarea id="cp_cal_text" style="min-height:80px" placeholder="大学のホームページの学年暦を、コピーして貼り付け"></textarea>' +
    '<button class="btn ghost" style="margin-top:6px" data-act="cp-cal-text">AIで読みとる</button></details>' +
    (cpCal.err ? '<p class="note" style="color:var(--rakuten)">' + esc(cpCal.err) + '</p>' : '');
  if(cpCal.list){
    h += cpCal.list.length ? '<label class="f" style="margin-top:10px">読み取った予定（入れるものにチェック。入れる先も変えられます）</label>' +
      cpCal.list.map(function(x, i){
        return '<div class="row cp-calrow"><input type="checkbox" class="cp-cal-pick" data-i="' + i + '"' + (x.to2 !== 'none' ? ' checked' : '') + ' style="width:auto" aria-label="入れる">' +
          '<div class="grow"><div class="t">' + esc(x.title) + '</div><div class="s">' + ymdLabel(x.from) + (x.to !== x.from ? ' 〜 ' + ymdLabel(x.to) : '') + (x.note ? '・' + esc(x.note) : '') + '</div></div>' +
          '<select id="cp_cal_to_' + i + '" aria-label="入れる先">' + Object.keys(CP_CAL_TO).map(function(k){ return '<option value="' + k + '"' + (x.to2 === k ? ' selected' : '') + '>' + CP_CAL_TO[k] + '</option>'; }).join('') + '</select></div>';
      }).join('') +
      '<div class="pair" style="margin-top:10px"><button class="btn" data-act="cp-cal-apply">チェックしたものを入れる</button>' +
      '<button class="btn ghost" style="flex:0 0 auto;padding:11px 14px" data-act="cp-cal-cancel">やめる</button></div>'
      : '<div class="empty">予定を見つけられませんでした。写真の明るさ・向きをたしかめてください。</div>';
  }
  return section('学年暦から登録', null, h +
    '<p class="note">「休み」は長いお休み（授業なし・通学の計算からも外れる）、「授業なし（1日）」はその日の授業ぜんぶが休講、「祝日でも授業」はその祝日をふつうの授業日にします。試験期間・授業開始などは予定に入ります。</p>' + CP_AI_NOTE);
}
function cpCalApply(){
  var L = cpCal.list || [], now = Date.now(), n = 0;
  Array.prototype.forEach.call(document.querySelectorAll('.cp-cal-pick'), function(el){
    if(!el.checked) return;
    var i = toNum(el.dataset.i), x = L[i]; if(!x) return;
    var sel = document.getElementById('cp_cal_to_' + i), to = sel ? sel.value : x.to2;
    if(to === 'none') return;
    if(to === 'break'){
      S.breaks = S.breaks || [];
      if(S.breaks.some(function(b){ return b.from === x.from && b.to === x.to; })) return;
      S.breaks.push({ id:uid('bk'), name:x.title, from:x.from, to:x.to, mt:now });
    }else if(to === 'off' || to === 'holclass'){
      var ty = to === 'off' ? 'cancel' : 'holclass';
      for(var d = x.from, g = 0; d <= x.to && g < 31; d = shiftDate(d, 1), g++){
        if(ty === 'holclass' && !holidayName(d)) continue;
        if(S.holidays.some(function(h){ return h.date === d && h.course === '*' && changeType(h) === ty; })) continue;
        S.holidays.push({ id:uid('hx'), date:d, course:'*', type:ty, period:0, room:'', mt:now });
      }
    }else{
      if(S.events.some(function(e){ return e.date === x.from && e.title === x.title; })) return;
      S.events.push({ id:uid('ev'), date:x.from, dateEnd:x.to !== x.from ? x.to : '', title:x.title, subject:'', time:'',
        kind:to === 'imp' ? 'imp' : 'other', memo:(x.note ? x.note + '\n' : '') + '学年暦から', photos:[], mt:now });
    }
    n++;
  });
  if(!n){ toast('入れるものにチェックを入れてください', true); return; }
  if(Array.isArray(S.breaks)) S.breaks.sort(function(a, b){ return String(a.from).localeCompare(String(b.from)); });
  cpCal = { busy:false, list:null, err:'', files:[] };
  toast('学年暦から' + n + '件を入れました'); commit();
}

/* ============================== 69 地図で行き方 ============================== */
var CP_PLACE_LABEL = { home:'家', school:'学校', work:'バイト先' };
function cpPlaceQ(k){
  var p = cpCfg().places;
  if(k === 'home') return p.home || '兵庫県三田市弥生が丘5丁目';
  if(k === 'school') return p.school || '武庫川女子大学 中央キャンパス';
  if(k === 'work') return p.work || ((S.settings.shop ? S.settings.shop + ' ' : '') + 'イオンモール神戸北');
  return '';
}
function cpMapUrl(q, app, mode){
  var e = encodeURIComponent(String(q || ''));
  if(app === 'apple') return 'https://maps.apple.com/?daddr=' + e + '&dirflg=' + (mode === 'walking' ? 'w' : mode === 'driving' ? 'd' : 'r');
  return 'https://www.google.com/maps/dir/?api=1&destination=' + e + '&travelmode=' + (mode || 'transit');
}
function cpMapLinks(q, label, mode){
  if(!q) return '';
  return '<div class="cp-maps">' + (label ? '<span class="s2">' + esc(label) + '</span>' : '') +
    '<a class="mini" href="' + esc(cpMapUrl(q, 'google', mode)) + '" target="_blank" rel="noopener">Googleマップ</a>' +
    '<a class="mini" href="' + esc(cpMapUrl(q, 'apple', mode)) + '" target="_blank" rel="noopener">Appleマップ</a></div>';
}
/* 予定の行き先（学校・バイト先・予定に書いた場所） */
function cpDestOf(src, o){
  o = o || {};
  if(src === 'work') return cpPlaceQ('work');
  var where = o.where || o.place || o.loc || '';
  if(!where){
    /* 「@ 保健センター」は場所。メールアドレス（abc@example.jp）の @ は場所にしない */
    var memo = String(o.memo || '');
    var m = memo.match(/(?:場所|会場|集合)\s*[:：]\s*([^\n、。]+)/) || memo.match(/(?:^|[\s　(（])[@＠]\s*([^\n、。\s@＠]+)/);
    if(m) where = m[1].trim();
  }
  if(where) return where;
  /* 課題は出かける先がないので、科目があっても学校の地図は出さない */
  if(src === 'quiz' || src === 'exam' || src === 'kousa' || (src !== 'task' && o.subject && courseByName(o.subject))) return cpPlaceQ('school');
  return '';
}
/* 予定の詳細に「地図で行き方」を足す（calendar.js の openDetail のあとに） */
function cpDetailMaps(src, id){
  var f = (typeof findOne === 'function') ? findOne(src, id) : null;
  var q = cpDestOf(src, f ? f.obj : {});
  var box = document.querySelector('#detail .sheet-bd .box');
  if(!q || !box || box.querySelector('.cp-maprow')) return;
  var d = document.createElement('div');
  d.className = 'row cp-maprow';
  d.innerHTML = '<div class="grow"><div class="s">行き方（' + esc(q) + '）</div>' + cpMapLinks(q, '', 'transit') + '</div>';
  var pair = box.querySelector('.pair');
  if(pair) box.insertBefore(d, pair); else box.appendChild(d);
}
if(typeof openDetail === 'function'){
  var cpOpenDetail0 = openDetail;
  openDetail = function(src, id){
    var r = cpOpenDetail0.apply(this, arguments);
    try{ cpDetailMaps(src, id); }catch(e){ kmErr('地図で行き方', e); }
    return r;
  };
}

/* ============================== 171 Googleマップの経路で通学時間 ============================== */
var cpRoute = { busy:'', err:'' };
var CP_ROUTES = {
  go:{ from:'home', to:'school', label:'家 → 学校', when:'arrive', target:'class' },
  back:{ from:'school', to:'home', label:'学校 → 家', when:'depart', target:'classEnd' },
  work:{ from:'school', to:'work', label:'学校 → バイト先', when:'arrive', target:'shift' },
  homework:{ from:'home', to:'work', label:'家 → バイト先', when:'arrive', target:'shift' }
};
/* いつの時刻で調べるか（次の授業の日の1限・次のバイトなど） */
function cpRouteWhen(target){
  var td = today(), ymd = '', min = null;
  if(target === 'class' || target === 'classEnd'){
    for(var i = 1; i <= 21 && !ymd; i++){
      var d = shiftDate(td, i), cls = schoolClassesForDate(d);
      if(!cls.length) continue;
      ymd = d;
      min = target === 'class' ? minutesOf(S.commute.periods[cls[0].period - 1]) : (minutesOf(S.commute.ends[cls[cls.length - 1].period - 1]) || 0) + 20;
    }
  }else{
    var w = S.shifts.filter(function(x){ return isYmd(x.date) && x.date > td && minutesOf(x.start) != null; })
      .sort(function(a, b){ return String(a.date).localeCompare(String(b.date)); })[0];
    if(w){ ymd = w.date; min = minutesOf(w.start); }
  }
  if(!ymd || min == null){
    ymd = shiftDate(td, 1);
    while(isWeekend(ymd) || holidayName(ymd)) ymd = shiftDate(ymd, 1);
    min = target === 'shift' ? 17 * 60 : target === 'classEnd' ? 18 * 60 : 9 * 60;
  }
  var a = ymd.split('-');
  return { ymd:ymd, min:min, ms:new Date(+a[0], +a[1] - 1, +a[2], Math.floor(min / 60), min % 60).getTime() };
}
function cpRouteOk(){ return gasReady() && toNum(GAS.ver) >= 3; }
async function cpRouteFetch(k){
  var def = CP_ROUTES[k]; if(!def) return null;
  if(!cpRouteOk()){ toast('Google連携（橋わたし）を新しい版にすると使えます', true); return null; }
  var w = cpRouteWhen(def.target);
  var body = { from:cpPlaceQ(def.from), to:cpPlaceQ(def.to), mode:'transit' };
  body[def.when === 'arrive' ? 'arriveAt' : 'departAt'] = w.ms;
  cpRoute.busy = k; cpRoute.err = ''; cpRender();
  try{
    var r = await gasCall('route', body);
    cpDataSet('route:' + k, { k:k, from:body.from, to:body.to, dur:toNum(r.dur), dep:r.dep || '', arr:r.arr || '', transfers:toNum(r.transfers),
      legs:(r.legs || []).slice(0, 12).map(function(s){ return { mode:String(s.mode || ''), min:toNum(s.min), line:String(s.line || ''), vehicle:String(s.vehicle || ''),
        from:String(s.from || ''), to:String(s.to || ''), dep:String(s.dep || ''), arr:String(s.arr || '') }; }),
      summary:String(r.summary || ''), when:w.ymd + ' ' + hhmmOf(w.min), whenKind:def.when, at:Date.now() });
    toast(def.label + '：' + toNum(r.dur) + '分（' + (r.dep || '') + '→' + (r.arr || '') + '）');
    commit();
    return cpData('route:' + k);
  }catch(e){
    cpRoute.err = /知らないお願い/.test(e.message) ? 'Apps Script に、新しいプログラムを入れ直すと使えます（設定 › Google連携 の「プログラムをコピー」）' : '調べられませんでした：' + e.message;
    toast(cpRoute.err, true);
    return null;
  }finally{
    cpRoute.busy = ''; cpRender();
  }
}
/* 通学の目安（分）… Googleマップで調べたもの → なければ設定の通学時間 */
function cpRouteDur(from, dest){
  var key = { 'home>univ':'go', 'univ>home':'back', 'univ>work':'work', 'home>work':'homework' }[from + '>' + dest];
  var r = key ? cpData('route:' + key) : null;
  if(r && toNum(r.dur) > 0) return { dur:toNum(r.dur), src:'route' };
  if(from === 'home' && dest === 'univ'){
    var c = S.commute;
    var d = toNum(c.walk) + toNum(c.bus) + toNum(c.change) + toNum(c.train) + toNum(c.toSchool);
    if(d > 0) return { dur:d, src:'estimate' };
  }
  return null;
}
function cpRouteRow(k){
  var def = CP_ROUTES[k], r = cpData('route:' + k);
  var legs = r && r.legs ? r.legs.filter(function(s){ return s.mode === 'transit'; }) : [];
  return '<div class="cp-route"><div class="row"><div class="grow"><div class="t">' + esc(def.label) + '</div>' +
    (r ? '<div class="s">' + r.dur + '分・乗りかえ' + r.transfers + '回' + (r.dep ? '・' + esc(r.dep) + ' 発 → ' + esc(r.arr) + ' 着' : '') +
      '（' + esc(r.when || '') + (r.whenKind === 'arrive' ? 'に着く' : 'に出る') + 'で調べた）</div>' +
      (legs.length ? '<div class="s2">' + legs.map(function(s){ return esc((s.line || s.vehicle || '') + ' ' + s.from + '→' + s.to); }).join('／') + '</div>' : '')
      : '<div class="s">まだ調べていません</div>') + '</div>' +
    (cpRouteOk() ? '<button class="mini" data-act="cp-route-get" data-k="' + k + '"' + (cpRoute.busy ? ' disabled' : '') + '>' + (cpRoute.busy === k ? '調べています…' : (r ? '調べ直す' : 'Googleマップで調べる')) + '</button>' : '') +
    '</div>' + (cpRouteOk() ? '' : cpMapLinks(cpPlaceQ(def.to), 'Googleマップで開く', 'transit')) + '</div>';
}
function cpPlaceSettings(){
  var p = cpCfg().places;
  return '<label class="f">行き先の名前（地図・経路をさがすときに使います）</label>' +
    ['home', 'school', 'work'].map(function(k){
      return '<div class="field"><label class="f" for="cp_pl_' + k + '">' + CP_PLACE_LABEL[k] + '</label><input id="cp_pl_' + k + '" value="' + esc(p[k] || '') + '" placeholder="' + esc(cpPlaceQ(k)) + '"></div>';
    }).join('') +
    '<button class="btn ghost" data-act="cp-place-save">保存する</button>' +
    '<p class="note">空のときは、うすい字の名前でさがします。住所まで入れると正確になります（入れた名前は、あなたの端末どうしで同期されます）。</p>' +
    '<label class="f" style="margin-top:12px">通学の目安（Googleマップの経路）</label>' +
    (cpRouteOk() ? '' : '<div class="bn amber"><span class="ic">!</span><span>Google連携（橋わたし）を新しい版にすると、Googleマップの経路で「何分かかるか」を調べて保存できます。いまは地図を開くボタンだけ使えます。</span></div>') +
    Object.keys(CP_ROUTES).map(cpRouteRow).join('') +
    (cpRoute.err ? '<p class="note" style="color:var(--rakuten)">' + esc(cpRoute.err) + '</p>' : '') +
    '<p class="note">家→学校は、次に授業がある日の1限の始まりに着くように調べます。調べた時間は「いまから間に合う？」の計算に使います（時刻表がない道のりのとき）。</p>';
}

/* ============================== 59 いまから間に合う？ ============================== */
var cpNow = { from:'' };
var CP_FROM = { home:'家', univ:'学校', sannomiya:'三ノ宮' };
function cpWalk0(from){ return from === 'home' ? (toNum(S.commute.walk) || 8) : from === 'univ' ? (toNum(S.commute.toSchool) || 10) : 0; }
/* 次の行き先（今日の最初の授業、またはバイト） */
function cpNowTarget(ymd, nowMin){
  if(nowMin < 300) return null;                 /* 夜中は出さない */
  var cls = schoolClassesForDate(ymd);
  var st0 = cls.length ? minutesOf(S.commute.periods[cls[0].period - 1]) : null;
  if(st0 != null && nowMin < st0){
    return { kind:'class', dest:'univ', start:st0, label:cls[0].period + '限 ' + shortName(cls[0].name), room:cls[0].room || '', from:'home', q:cpPlaceQ('school') };
  }
  var w = S.shifts.filter(function(x){ var m = minutesOf(x.start); return x.date === ymd && m != null && m > nowMin; })
    .sort(function(a, b){ return minutesOf(a.start) - minutesOf(b.start); })[0];
  if(w && minutesOf(w.start) - nowMin <= 300){
    var from = 'home';
    if(cls.length && st0 != null && nowMin >= st0) from = 'univ';
    return { kind:'work', dest:'work', start:minutesOf(w.start), label:'バイト ' + w.start + '〜', room:'', from:from, q:cpPlaceQ('work') };
  }
  return null;
}
function cpChain(legs, idx, margin){
  var first = legs[0].table[idx]; if(!first) return null;
  var found = [first], t = minutesOf(first.arr);
  for(var i = 1; i < legs.length; i++){
    var nx = firstAfter(legs[i].table, t + margin);
    if(!nx) return null;
    found.push(nx); t = minutesOf(nx.arr);
  }
  return { dep:minutesOf(first.dep), arr:t, found:found };
}
/* いま from を出たら、何時に着くか（時刻表 → 通学の目安 の順に使う） */
function cpNowPlan(tg, from, nowMin, ymd){
  var dest = tg.dest, walk0 = cpWalk0(from), walkEnd = dest === 'univ' ? (toNum(S.commute.toSchool) || 10) : 0;
  var margin = toNum(S.transit.sannomiyaTransfer) || 10;
  var res = { from:from, dest:dest, goal:tg.start, walk0:walk0, walkEnd:walkEnd, src:'', legs:null, leaveBy:null };
  var legs = from === dest ? null : routeLegs(from, dest, ymd);
  if(legs && legs.length && legs[0].table.length){
    var t0 = nowMin + walk0, best = null, latest = null;
    for(var k = 0; k < legs[0].table.length; k++){
      var d0 = minutesOf(legs[0].table[k].dep);
      if(d0 == null || d0 < t0) continue;
      if(d0 - t0 > 180) break;
      var c = cpChain(legs, k, margin);
      if(!c) continue;
      if(!best || c.arr < best.arr) best = c;
      if(c.arr + walkEnd <= tg.start && (!latest || c.dep > latest.dep)) latest = c;
    }
    if(best){
      res.src = 'timetable';
      res.dep = best.dep; res.arrive = best.arr + walkEnd;
      res.legs = legs.map(function(L, i){ return { kind:L.kind, name:L.name, dep:best.found[i].dep, arr:best.found[i].arr }; });
      res.diff = tg.start - res.arrive;
      if(latest) res.leaveBy = latest.dep - walk0;
      return res;
    }
  }
  var est = cpRouteDur(from, dest);
  if(!est) return null;
  res.src = est.src; res.dur = est.dur;
  res.arrive = nowMin + est.dur; res.diff = tg.start - res.arrive; res.leaveBy = tg.start - est.dur;
  return res;
}
function cpNowInfo(ymd, nowMin){
  var tg = cpNowTarget(ymd, nowMin);
  if(!tg) return null;
  var from = cpNow.from || tg.from;
  if(from === tg.dest) from = tg.from;
  return { target:tg, from:from, plan:cpNowPlan(tg, from, nowMin, ymd) };
}
function cpNowText(info, nowMin){
  var p = info && info.plan;
  if(!p) return '';
  var last = p.legs && p.legs.length ? p.legs[p.legs.length - 1] : null;
  if(p.diff >= 0) return 'いま出ると ' + hhmmOf(p.arrive) + ' 着・' + (p.diff ? p.diff + '分前に着く' : 'ちょうど');
  return '間に合わない：' + (last ? '次の' + last.kind + '（' + last.dep + '発）で ' : 'いま出ても ') + hhmmOf(p.arrive) + ' 着（' + (-p.diff) + '分おくれ）';
}
function cpNowHtml(ymd, nowMin){
  var info = cpNowInfo(ymd, nowMin);
  if(!info) return '';
  var tg = info.target, p = info.plan, from = info.from;
  var h = '<div class="cp-nowhd"><b>' + esc(tg.label) + '</b>　' + hhmmOf(tg.start) + ' ' + (tg.kind === 'class' ? '開始' : 'から') + (tg.room ? '（' + esc(tg.room) + '）' : '') + '</div>';
  if(!p){
    h += '<div class="s2">この道のりの時刻表も通学の目安もないので、計算できませんでした。設定の「行き先と通学の目安」で調べておくと出せます。</div>';
  }else{
    var cls = p.diff < 0 ? 'red' : p.diff < 5 ? 'amber' : 'green';
    var last = p.legs && p.legs.length ? p.legs[p.legs.length - 1] : null;
    var msg = p.diff >= 0
      ? '<b>いま出ると ' + hhmmOf(p.arrive) + ' 着</b>・' + (p.diff ? p.diff + '分前に着きます' : 'ちょうどに着きます')
      : '<b>間に合いません</b>：' + (last ? '次の' + esc(last.kind) + '（' + esc(last.dep) + ' 発）で ' : 'いま出ても ') + '<b>' + hhmmOf(p.arrive) + ' 着</b>（' + (-p.diff) + '分おくれ）';
    if(p.diff >= 0 && p.leaveBy != null && p.leaveBy >= nowMin) msg += '<br>おそくとも <b>' + hhmmOf(p.leaveBy) + '</b> に' + CP_FROM[from] + 'を出れば間に合います（あと' + (p.leaveBy - nowMin) + '分）';
    if(p.diff < 0 && tg.kind === 'class') msg += '<br>遅れそうなら、先生への連絡や遅延証明書のことも考えておきましょう。';
    if(p.diff < 0 && tg.kind === 'work') msg += '<br>早めにバイト先へ連絡しましょう。';
    h += '<div class="bn ' + cls + ' cp-nowmsg"><span class="ic">' + (p.diff < 0 ? '!' : '🚃') + '</span><span>' + msg + '</span></div>';
    if(p.legs){
      h += '<div class="cp-nowlegs">' + (p.walk0 ? '<div class="trline"><span class="trk">歩き</span><span>' + CP_FROM[from] + 'から ' + p.walk0 + '分</span></div>' : '') +
        p.legs.map(function(L){ return '<div class="trline"><span class="trk">' + esc(L.kind) + '</span><span>' + esc(L.name) + '　' + esc(L.dep) + ' → ' + esc(L.arr) + '</span></div>'; }).join('') +
        (p.walkEnd ? '<div class="trline"><span class="trk">歩き</span><span>駅から教室まで ' + p.walkEnd + '分</span></div>' : '') + '</div>';
    }else{
      h += '<p class="note" style="margin-top:4px">' + (p.src === 'route' ? 'Googleマップで調べた通学の目安（' + p.dur + '分）' : '設定の通学時間（' + p.dur + '分）') + 'から出した目安です。</p>';
    }
  }
  h += '<div class="pillrow cp-from">' + Object.keys(CP_FROM).filter(function(k){ return k !== tg.dest; }).map(function(k){
    return '<button data-act="cp-now-from" data-v="' + k + '" class="' + (from === k ? 'on' : '') + '">' + CP_FROM[k] + 'から</button>';
  }).join('') + '</div>' + cpMapLinks(tg.q, '地図で行き方', 'transit');
  return h;
}

/* ============================== 172 近くの薬局・コンビニ ============================== */
var cpNear = { busy:false, list:null, err:'', note:'', where:'', cat:'all', center:null };
var CP_NEAR_KIND = { pharmacy:['薬局', '💊'], chemist:['ドラッグストア', '🧴'], convenience:['コンビニ', '🏪'], hospital:['病院', '🏥'], clinic:['クリニック', '🩺'] };
var CP_NEAR_CAT = { all:'ぜんぶ', drug:'薬局・ドラッグストア', convenience:'コンビニ', medical:'病院・クリニック' };
function cpNearQuery(c){
  var a = function(r){ return '(around:' + r + ',' + c.lat + ',' + c.lng + ')'; };
  /* 種類ごとに出す。数で切ると、近い順ではなく番号の順で切られて、近くの薬局が落ちることがあるので切らない
     （timeout は、アプリが待つ15秒より短く） */
  return '[out:json][timeout:14];' +
    '(nwr["amenity"="pharmacy"]' + a(1200) + ';nwr["shop"="chemist"]' + a(1200) + ';);out tags center;' +
    'nwr["shop"="convenience"]' + a(800) + ';out tags center;' +
    'nwr["amenity"~"^(hospital|clinic|doctors)$"]' + a(1500) + ';out tags center;';
}
function cpNearParse(js, c){
  var out = [], seen = {};
  ((js && js.elements) || []).forEach(function(el){
    var t = el.tags || {};
    var lat = el.lat != null ? el.lat : (el.center || {}).lat, lng = el.lon != null ? el.lon : (el.center || {}).lon;
    if(lat == null || lng == null) return;
    var kind = t.amenity === 'pharmacy' ? 'pharmacy' : t.shop === 'chemist' ? 'chemist' : t.shop === 'convenience' ? 'convenience'
      : t.amenity === 'hospital' ? 'hospital' : (t.amenity === 'clinic' || t.amenity === 'doctors') ? 'clinic' : '';
    if(!kind) return;
    var name = String(t['name:ja'] || t.name || t.brand || CP_NEAR_KIND[kind][0]).slice(0, 60);
    var key = name + '|' + Math.round(lat * 2000) + '|' + Math.round(lng * 2000);
    if(seen[key]) return; seen[key] = 1;
    out.push({ kind:kind, name:name, branch:String(t.branch || '').slice(0, 30), lat:+lat, lng:+lng, dist:geoDist(c, { lat:+lat, lng:+lng }),
      hours:String(t.opening_hours || '').slice(0, 80), rx:t.dispensing === 'yes', phone:String(t.phone || t['contact:phone'] || '').slice(0, 20) });
  });
  return out.sort(function(a, b){ return a.dist - b.dist; }).slice(0, 60);
}
async function cpNearCenter(where){
  var school = function(){ var pl = linkPrefs().place; return pl ? { lat:pl.lat, lng:pl.lng, name:'学校' } : { lat:SCHOOL.lat, lng:SCHOOL.lon, name:'学校のあたり' }; };
  if(where === 'school') return school();
  if(where === 'home') return { lat:SANDA.lat, lng:SANDA.lon, name:'家のあたり（三田）' };
  try{ var h = await geoNow(); return { lat:h.lat, lng:h.lng, name:'いまの場所' }; }
  catch(e){ cpNear.note = '場所がわからなかったので（' + e.message + '）、学校のまわりをさがしました。'; return school(); }
}
async function cpNearFind(where){
  if(cpNear.busy) return null;
  cpNear.busy = true; cpNear.err = ''; cpNear.note = ''; cpNear.where = where || 'here'; cpRender();
  try{
    var c = await cpNearCenter(cpNear.where);
    var js = await apiJson('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(cpNearQuery(c)));
    cpNear.list = cpNearParse(js, c); cpNear.center = c; cpNear.at = Date.now();
    return cpNear.list;
  }catch(e){
    cpNear.err = 'さがせませんでした：' + e.message; cpNear.list = null;
    return null;
  }finally{
    cpNear.busy = false; cpRender();
  }
}
function cpNearBox(){
  var h = '<div class="pillrow">' +
    [['here', '📍 いまの場所のまわり'], ['school', '学校のまわり'], ['home', '家のまわり']].map(function(o){
      return '<button class="mini' + (cpNear.where === o[0] && cpNear.list ? ' on' : '') + '" data-act="cp-near" data-v="' + o[0] + '"' + (cpNear.busy ? ' disabled' : '') + '>' + o[1] + '</button>';
    }).join('') + '</div>';
  if(cpNear.busy) h += '<div class="s2">さがしています…</div>';
  if(cpNear.err) h += '<p class="note" style="color:var(--rakuten)">' + esc(cpNear.err) + '</p>';
  if(cpNear.note) h += '<p class="note">' + esc(cpNear.note) + '</p>';
  if(cpNear.list){
    var cat = cpNear.cat, list = cpNear.list.filter(function(x){
      return cat === 'all' || (cat === 'drug' && (x.kind === 'pharmacy' || x.kind === 'chemist')) || (cat === 'convenience' && x.kind === 'convenience') ||
        (cat === 'medical' && (x.kind === 'hospital' || x.kind === 'clinic'));
    });
    h += '<div class="pillrow">' + Object.keys(CP_NEAR_CAT).map(function(k){
      return '<button data-act="cp-near-cat" data-v="' + k + '" class="' + (cat === k ? 'on' : '') + '">' + CP_NEAR_CAT[k] + '</button>';
    }).join('') + '</div>' +
      '<div class="s2" style="margin-bottom:4px">' + esc((cpNear.center && cpNear.center.name) || '') + 'から近い順</div>' +
      (list.length ? list.slice(0, 25).map(function(x){
        var k = CP_NEAR_KIND[x.kind], ll = x.lat + ',' + x.lng;
        return '<div class="row cp-near"><span class="cp-nic" aria-hidden="true">' + k[1] + '</span><div class="grow"><div class="t">' + esc(x.name) + (x.branch ? ' ' + esc(x.branch) : '') + '</div>' +
          '<div class="s">' + k[0] + '・' + (x.dist >= 1000 ? (Math.round(x.dist / 100) / 10) + 'km' : x.dist + 'm') + '（歩いて約' + Math.max(1, Math.round(x.dist / 80)) + '分）' +
            (x.rx ? '・処方せんOK' : '') + (x.hours ? '・' + esc(x.hours) : '') + '</div></div>' +
          '<a class="mini" href="' + esc(cpMapUrl(ll, 'google', 'walking')) + '" target="_blank" rel="noopener">地図</a>' +
          (x.phone ? '<a class="mini" href="tel:' + esc(x.phone.replace(/[^0-9+]/g, '')) + '">電話</a>' : '') + '</div>';
      }).join('') : '<div class="empty">この近くには見つかりませんでした。</div>');
  }
  return secWrap('cp-near', '近くの薬局・コンビニ', null, h +
    '<p class="note">OpenStreetMap（みんなで作る地図）のデータです。開いている時間は変わることがあるので、行く前にたしかめてください。いまの場所は、さがすときにその場で使うだけで保存しません。具合がとても悪いときは、迷わず119へ。</p>');
}

/* ============================== 93 シフト希望の提出日 ============================== */
var cpWish = { edit:{} };
function cpWishNext(td){
  var w = cpCfg().wish, day = toNum(w.day);
  if(!day) return null;
  td = td || today();
  var mk = function(y, m){ var last = new Date(y, m, 0).getDate(); return y + '-' + pad(m) + '-' + pad(Math.min(day, last)); };
  var y = +td.slice(0, 4), m = +td.slice(5, 7), due = mk(y, m);
  if(due < td){ m++; if(m > 12){ m = 1; y++; } due = mk(y, m); }
  var ty = +due.slice(0, 4), tm = +due.slice(5, 7) + 1;
  if(tm > 12){ tm = 1; ty++; }
  var ym = ty + '-' + pad(tm), rec = cpData('shiftWish:' + ym);
  return { due:due, ym:ym, left:daysBetween(td, due), done:!!(rec && rec.done), rec:rec, lead:toNum(w.lead) };
}
/* 学校からバイト先までの時間（通学の目安 → 時刻表 → 70分） */
function cpWorkTravel(){
  var r = cpData('route:work');
  if(r && toNum(r.dur)) return toNum(r.dur) + 10;
  return 80;
}
function cpWishAuto(ymd, travel){
  var ex = S.exams.filter(function(x){ return x.date === ymd; });
  if(ex.length) return { st:'ng', why:(ex[0].kind === 'quiz' ? '小テスト' : 'テスト') };
  var evs = S.events.filter(function(e){ return e.date === ymd || (isYmd(e.dateEnd) && e.date <= ymd && ymd <= e.dateEnd); });
  var busy = evs.filter(function(e){ return e.kind === 'imp' && !e.time; })[0];
  if(busy) return { st:'ng', why:String(busy.title || '予定').slice(0, 12) };
  var cls = classesForDate(ymd).filter(function(c){ return !c.off; });
  if(cls.length){
    var end = minutesOf(S.commute.ends[cls[cls.length - 1].period - 1]) || 0;
    var fromMin = end + (cls.every(function(c){ return c.web; }) ? 60 : travel);
    fromMin = Math.ceil(fromMin / 30) * 30;
    if(fromMin > 20 * 60) return { st:'ng', why:'授業のあと間に合わない' };
    return { st:'part', why:'授業のあと', from:hhmmOf(fromMin) };
  }
  var nextExam = S.exams.some(function(x){ return x.date === shiftDate(ymd, 1) && x.kind !== 'quiz'; });
  if(nextExam) return { st:'part', why:'次の日テスト' };
  if(evs.length) return { st:'part', why:String(evs[0].title || '予定').slice(0, 12) + (evs[0].time ? ' ' + evs[0].time : '') };
  return { st:'ok', why:holidayName(ymd) || '' };
}
function cpWishDraft(ym){
  var a = ym.split('-'), y = +a[0], m = +a[1], last = new Date(y, m, 0).getDate();
  var rec = cpData('shiftWish:' + ym) || {};
  var edits = Object.assign({}, rec.days || {}, cpWish.edit[ym] || {});
  var travel = cpWorkTravel(), days = [];
  for(var d = 1; d <= last; d++){
    var ymd = ym + '-' + pad(d), au = cpWishAuto(ymd, travel), st = edits[ymd] || au.st;
    var txt = st === 'ok' ? '○ 終日OK' : st === 'ng' ? '×' + (au.st === 'ng' && !edits[ymd] ? '（' + au.why + '）' : '') :
      (au.from && au.st === 'part' ? au.from + '〜' : '△') + (au.why && au.st === 'part' && !au.from ? '（' + au.why + '）' : '');
    days.push({ ymd:ymd, st:st, auto:au.st, why:au.why, from:au.from || '', text:txt, edited:!!edits[ymd] });
  }
  var name = String(S.settings.shiftName || '').trim();
  var text = '【' + m + '月のシフト希望】' + (name ? name : '') + '\n' + days.map(function(x){
    var dd = new Date(y, m - 1, +x.ymd.slice(8, 10));
    return m + '/' + (+x.ymd.slice(8, 10)) + '（' + WDAY[dd.getDay()] + '） ' + x.text;
  }).join('\n');
  return { ym:ym, days:days, text:text, ok:days.filter(function(x){ return x.st !== 'ng'; }).length };
}
function cpWishBox(){
  var cfg = cpCfg().wish, nx = cpWishNext();
  var rule = '<div class="grid2">' +
    '<div><label class="f" for="cp_wish_day">毎月 何日までに出す？</label><input id="cp_wish_day" inputmode="numeric" value="' + esc(cfg.day || '') + '" placeholder="例：20"></div>' +
    '<div><label class="f" for="cp_wish_lead">何日前から知らせる？</label><input id="cp_wish_lead" inputmode="numeric" value="' + esc(cfg.lead != null ? cfg.lead : 3) + '"></div></div>' +
    '<button class="btn ghost" style="margin-top:6px" data-act="cp-wish-save">保存する</button>' +
    '<p class="note">「毎月20日までに、翌月のシフト希望を出す」なら 20 と入れます。0にすると知らせません。</p>';
  if(!nx) return section('シフト希望の提出', null, '<p class="note" style="margin-top:0">バイト先に出す「シフト希望」の締切を入れておくと、近づいたら今日タブと通知で知らせます。授業・テスト・予定から、希望の下書きも作ります。</p>' + rule);
  var dr = cpWishDraft(nx.ym);
  var mo = +nx.ym.slice(5, 7);
  var h = '<div class="bn ' + (nx.done ? 'green' : nx.left <= 1 ? 'red' : nx.left <= nx.lead ? 'amber' : 'blue') + '"><span class="ic">' + (nx.done ? '✓' : '🗓') + '</span><span>' +
    (nx.done ? '<b>' + mo + '月ぶんの希望は出しました</b>（' + (nx.rec && nx.rec.at ? new Date(nx.rec.at).toLocaleDateString('ja-JP') : '') + '）'
             : '<b>' + mo + '月ぶんの希望は ' + ymdLabel(nx.due) + ' まで</b>（' + (nx.left === 0 ? '今日まで' : 'あと' + nx.left + '日') + '）') + '</span></div>' +
    '<label class="f" style="margin-top:8px">' + mo + '月の下書き（タップで ○→△→× と変えられます）</label>' +
    '<div class="cp-wgrid">' + ['月', '火', '水', '木', '金', '土', '日'].map(function(w){ return '<span class="cp-wh">' + w + '</span>'; }).join('') +
      (function(){
        var a = nx.ym.split('-'), first = new Date(+a[0], +a[1] - 1, 1).getDay(), pre = (first + 6) % 7, s = '';
        for(var i = 0; i < pre; i++) s += '<span></span>';
        return s;
      })() +
      dr.days.map(function(x){
        return '<button class="cp-wd cp-w' + x.st + (x.edited ? ' ed' : '') + '" data-act="cp-wish-day" data-d="' + x.ymd + '" title="' + esc(x.why || '') + '">' +
          '<b>' + (+x.ymd.slice(8, 10)) + '</b><span>' + (x.st === 'ok' ? '○' : x.st === 'ng' ? '×' : (x.from || '△')) + '</span></button>';
      }).join('') + '</div>' +
    '<textarea id="cp_wish_text" readonly style="min-height:120px;margin-top:8px">' + esc(dr.text) + '</textarea>' +
    '<div class="pillrow"><button class="mini" data-act="cp-wish-copy">下書きをコピー</button>' +
      (nx.done ? '<button class="mini" data-act="cp-wish-undo">「出した」を取り消す</button>' : '<button class="mini on" data-act="cp-wish-done">出した</button>') +
      (cpWish.edit[nx.ym] ? '<button class="mini" data-act="cp-wish-reset">自動にもどす</button>' : '') + '</div>' +
    '<p class="note">○は終日OK、時刻は「その時刻から」、×は出られない日です。授業・テスト・大事な予定から自動で作っています（学校からバイト先まで約' + cpWorkTravel() + '分で計算）。</p>' +
    '<details class="cp-det"><summary>提出のきまりを変える</summary>' + rule + '</details>';
  return section('シフト希望の提出', nx.done ? '出しました' : 'あと' + nx.left + '日', h);
}
function cpWishNotice(){
  var nx = cpWishNext();
  if(!nx || nx.done || nx.left > nx.lead) return '';
  return '<div class="bn ' + (nx.left <= 1 ? 'red' : 'amber') + '"><span class="ic">🗓</span><span class="grow"><b>シフト希望の提出</b>：' + (+nx.ym.slice(5, 7)) + '月ぶんは ' +
    ymdLabel(nx.due) + ' まで（' + (nx.left === 0 ? '今日まで' : 'あと' + nx.left + '日') + '）</span>' +
    '<button class="mini" data-act="go" data-app="money" data-tab="work">下書きを見る</button></div>';
}

/* ============================== バイト先への行き方（work タブ） ============================== */
function cpWorkGoBox(){
  var td = today();
  var w = S.shifts.filter(function(x){ return isYmd(x.date) && x.date >= td && minutesOf(x.start) != null; })
    .sort(function(a, b){ return String(a.date).localeCompare(String(b.date)) || String(a.start).localeCompare(String(b.start)); })[0];
  var r = cpData('route:work') || cpData('route:homework');
  return section('バイト先への行き方', w ? '次は ' + ymdLabel(w.date) + ' ' + w.start : null,
    '<div class="row"><div class="grow"><div class="t">' + esc(cpPlaceQ('work')) + '</div>' +
      (r ? '<div class="s">' + esc(CP_ROUTES[r.k] ? CP_ROUTES[r.k].label : '') + '　約' + r.dur + '分（乗りかえ' + r.transfers + '回）</div>' : '<div class="s">設定の「行き先と通学の目安」で、かかる時間を調べられます</div>') +
    '</div></div>' + cpMapLinks(cpPlaceQ('work'), '地図で行き方', 'transit'));
}

/* ============================== 登録 ============================== */
kmPart('course', 'cp-uni', '大学のメール・フォーム', function(){ return cpUniBox(); });
kmPart('course', 'cp-att', '出席率のグラフ', function(){ return cpAttendBox(); });
kmPart('course', 'cp-gpa', 'GPAと単位', function(){ return cpGpaBox(); });
kmPart('tt', 'cp-cal', '学年暦から登録', function(){ return cpCalBox(); });
kmPart('today', 'cp-now', 'いまから間に合う？', function(ctx){
  if(!ctx.isToday) return '';
  var n = new Date(), inner = cpNowHtml(ctx.ymd, n.getHours() * 60 + n.getMinutes());
  return inner ? secWrap('cp-now', 'いまから間に合う？', pad(n.getHours()) + ':' + pad(n.getMinutes()) + ' 現在', inner) : '';
});
kmPart('today', 'cp-note', '授業・バイトのお知らせ', function(ctx){
  if(!ctx.isToday) return '';
  var h = cpWishNotice();
  var n = cpItems('uni').filter(function(x){ return x.st !== 'done' && (x.cands || []).some(function(c){ return !c.st; }); }).length;
  if(n) h += '<div class="bn blue"><span class="ic">📩</span><span class="grow">大学のメールから、手帳に入れる候補が<b>' + n + '通</b>あります。</span>' +
    '<button class="mini" data-act="go" data-app="course">見る</button></div>';
  return h ? '<section>' + h + '</section>' : '';
});
kmPart('life', 'cp-near', '近くの薬局・コンビニ', function(){ return cpNearBox(); });
kmPart('work', 'cp-wish', 'シフト希望の提出', function(){ return cpWishBox(); });
kmPart('work', 'cp-go', 'バイト先への行き方', function(){ return cpWorkGoBox(); });
/* 「いまから間に合う？」は、行き方の前に出す */
(function(){
  var L = (typeof PAGE_SECTIONS !== 'undefined') && PAGE_SECTIONS.today;
  if(!L) return;
  var i = -1, j = -1;
  L.forEach(function(x, k){ if(x[0] === 'cp-now') i = k; if(x[0] === 'transit') j = k; });
  if(i > j && j >= 0){ var it = L.splice(i, 1)[0]; L.splice(j, 0, it); }
})();

kmSettings({ id:'cp-uni', title:'大学のメール（休講・補講・フォーム）', after:'gas',
  note:function(){ return gfeat().uniDomain || null; }, html:cpUniSettings });
kmSettings({ id:'cp-place', title:'行き先と通学の目安（地図・Googleマップ）', after:'', note:null, html:cpPlaceSettings });

kmAction(function(act, t){
  if(act.indexOf('cp-') !== 0) return false;
  var d = t.dataset || {};
  switch(act){
    case 'cp-syl-files':
      if(!aiReady()){ toast('先に設定タブでGemini APIキーを登録してください', true); return true; }
      cpPickFiles(function(urls, names){
        sylAi = { name:d.name, busy:false, result:null, err:'', files:urls, fileNames:names };
        syllabusRead(d.name, { files:urls });
      });
      return true;
    case 'cp-syl-url':
      var u = val('sy_url').trim();
      if(!u){ toast('上の「シラバスのURL」にページのURLを入れてください', true); return true; }
      syllabusRead(d.name, { url:u });
      return true;
    case 'cp-syl-clear': sylAi.files = []; sylAi.fileNames = []; render(); return true;
    case 'cp-shift-month': shiftOcr.month = d.v || ''; shiftOcr.list = null; shiftOcr.err = ''; render(); return true;
    case 'cp-gpa-save': cpGpaSave(); return true;
    case 'cp-score-save': cpScoreSave(d.name); return true;
    case 'cp-uni-domain':
      var dom = val('cp_uni_dom').trim().toLowerCase().replace(/^.*@/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if(dom && !/^[a-z0-9.\-]{3,60}$/.test(dom)){ toast('ドメインは「xxx.ac.jp」の形で入れてください', true); return true; }
      gfeatSet({ uniDomain:dom }); commit();
      if(cpRouteOk()) gfeatPush().then(function(){ toast(dom ? '保存しました（橋わたしが「' + dom + '」のメールを見ます）' : '大学のメールの受け取りをやめました'); },
        function(e){ toast('橋わたしに送れませんでした：' + e.message, true); });
      else toast('保存しました（Google連携を新しい版にすると、メールを自動で受け取れます）');
      return true;
    case 'cp-uni-paste': cpUniPaste(); return true;
    case 'cp-uni-parse':
      if(!aiReady()){ toast('先に設定タブでGemini APIキーを登録してください', true); return true; }
      cpUniParse(d.id); render(); return true;
    case 'cp-uni-add': if(cpUniAdd(d.id, d.k)) commit(); return true;
    case 'cp-uni-skip':
      var it1 = cpItem(d.id), c1 = it1 && (it1.cands || []).filter(function(z){ return z.k === d.k; })[0];
      if(c1){ c1.st = 'skip'; it1.mt = Date.now(); if(!it1.cands.some(function(z){ return !z.st; })) it1.st = 'done'; commit(); }
      return true;
    case 'cp-uni-all':
      var it2 = cpItem(d.id); if(!it2) return true;
      var n2 = 0, left = 0;
      (it2.cands || []).forEach(function(c){ if(c.st) return; if(cpUniAdd(it2.id, c.k, true)) n2++; else left++; });
      toast(n2 + '件を入れました' + (left ? '（' + left + '件は、授業や日付を選んでから「入れる」を押してください）' : ''), !n2);
      commit(); return true;
    case 'cp-uni-done':
      var it3 = cpItem(d.id); if(it3){ it3.st = 'done'; it3.mt = Date.now(); toast('しまいました'); commit(); }
      return true;
    case 'cp-form-add':
      if(cpFormAdd(val('cp_form_url'), val('cp_form_title'), val('cp_form_due'))) commit();
      return true;
    case 'cp-cal-files':
      if(!aiReady()){ toast('先に設定タブでGemini APIキーを登録してください', true); return true; }
      cpPickFiles(function(urls){ cpCalRead(urls, ''); });
      return true;
    case 'cp-cal-text': cpCalRead([], val('cp_cal_text')); return true;
    case 'cp-cal-apply': cpCalApply(); return true;
    case 'cp-cal-cancel': cpCal = { busy:false, list:null, err:'', files:[] }; render(); return true;
    case 'cp-now-from': cpNow.from = d.v || ''; render(); return true;
    case 'cp-place-save':
      cpCfgSet({ places:{ home:val('cp_pl_home').trim().slice(0, 120), school:val('cp_pl_school').trim().slice(0, 120), work:val('cp_pl_work').trim().slice(0, 120) } });
      toast('行き先を保存しました'); commit(); return true;
    case 'cp-route-get': cpRouteFetch(d.k); return true;
    case 'cp-near': cpNearFind(d.v); return true;
    case 'cp-near-cat': cpNear.cat = d.v || 'all'; render(); return true;
    case 'cp-wish-save':
      var day = toNum(val('cp_wish_day')), lead = toNum(val('cp_wish_lead'));
      if(day < 0 || day > 31){ toast('日にちは1〜31で入れてください', true); return true; }
      cpCfgSet({ wish:{ day:day, lead:Math.max(0, Math.min(14, lead)) } });
      toast(day ? '毎月' + day + '日までに出す、にしました' : 'シフト希望の知らせをやめました'); commit(); return true;
    case 'cp-wish-day':
      var nx = cpWishNext(); if(!nx) return true;
      var dr = cpWishDraft(nx.ym), x = dr.days.filter(function(z){ return z.ymd === d.d; })[0]; if(!x) return true;
      var nxt = { ok:'part', part:'ng', ng:'ok' }[x.st];
      cpWish.edit[nx.ym] = cpWish.edit[nx.ym] || {};
      if(nxt === x.auto && !(nx.rec && nx.rec.days && nx.rec.days[d.d])) delete cpWish.edit[nx.ym][d.d]; else cpWish.edit[nx.ym][d.d] = nxt;
      render(); return true;
    case 'cp-wish-reset': var nr = cpWishNext(); if(nr) delete cpWish.edit[nr.ym]; render(); return true;
    case 'cp-wish-copy':
      var nc = cpWishNext(); if(nc) cpCopy(cpWishDraft(nc.ym).text);
      return true;
    case 'cp-wish-done': case 'cp-wish-undo':
      var nd = cpWishNext(); if(!nd) return true;
      var drd = cpWishDraft(nd.ym), days = {};
      drd.days.forEach(function(z){ if(z.edited) days[z.ymd] = z.st; });
      cpDataSet('shiftWish:' + nd.ym, { done:act === 'cp-wish-done' ? 1 : 0, at:Date.now(), due:nd.due, text:drd.text.slice(0, 2500), days:days });
      delete cpWish.edit[nd.ym];
      toast(act === 'cp-wish-done' ? (+nd.ym.slice(5, 7)) + '月ぶんのシフト希望を「出した」にしました' : '取り消しました'); commit(); return true;
  }
  return false;
});

/* 通知：シフト希望の締切が近づいたら（朝に） */
kmJobs(function(add, prefs){
  var nx = cpWishNext();
  if(!nx || nx.done) return;
  for(var i = Math.min(nx.lead, 7); i >= 0; i--){
    var d = shiftDate(nx.due, -i);
    if(d < today()) continue;
    add('cp-wish-' + nx.ym + '-' + i, notifyAt(d, prefs.dlMorning || '07:30'), '🗓 シフト希望の提出',
(+nx.ym.slice(5, 7)) + '月ぶんのシフト希望は ' + ymdLabel(nx.due) + ' まで' + (i ? '（あと' + i + '日）' : '（今日まで）') + '。下書きはバイトのページにあります。', { cat:'work' });
  }
});
/* ウィジェット・Discord用のまとめ */
kmSummary(function(s){
  var o = {};
  try{
    var n = new Date(), info = cpNowInfo(today(), n.getHours() * 60 + n.getMinutes());
    if(info && info.plan) o.now = info.target.label + '：' + cpNowText(info);
  }catch(e){}
  var nx = cpWishNext();
  if(nx && !nx.done && nx.left <= nx.lead) o.wish = (+nx.ym.slice(5, 7)) + '月のシフト希望は' + ymdLabel(nx.due) + 'まで';
  var risk = termCourses().map(function(c){ return cpAttendInfo(c.name); }).filter(function(a){ return a.lv === 'over' || a.lv === 'ng'; });
  if(risk.length) o.attend = risk.map(function(a){ return shortName(a.name) + '（欠席' + a.ab + '/' + a.limit + '）'; }).join('、').slice(0, 120);
  if(Object.keys(o).length) s.campus = o;
});
/* アプリ全体の検索 */
kmSearch(function(q){
  q = norm(String(q || '')).trim();
  if(!q) return [];
  var out = [];
  termCourses().forEach(function(c){
    var sy = S.syllabus[c.name] || {};
    var hay = norm([c.name, courseAlias(c.name), courseRoom(c.name), sy.teacher || '', (sy.plan || []).map(function(p){ return p.title; }).join(' '),
      (sy.books || []).map(function(b){ return b.title + ' ' + (b.author || ''); }).join(' ')].join(' '));
    if(hay.indexOf(q) >= 0) out.push({ kind:'授業', title:c.name, sub:[c.slotText, sy.teacher].filter(Boolean).join('・'), act:'course-open', attrs:{ 'data-name':c.name } });
  });
  cpItems('uni').forEach(function(it){
    if(norm(it.title + ' ' + it.text).indexOf(q) >= 0) out.push({ kind:'大学のメール', title:it.title, sub:ymdLabel(it.ymd) + (it.st === 'done' ? '・しまった' : ''), act:'go', attrs:{ 'data-app':'course' } });
  });
  Object.keys(S.kmData || {}).forEach(function(k){
    if(k.indexOf('campus:shiftWish:') !== 0) return;
    var r = S.kmData[k] || {};
    if(norm((r.text || '') + ' シフト希望').indexOf(q) >= 0) out.push({ kind:'シフト希望', title:(+k.slice(-2)) + '月のシフト希望', sub:r.done ? '出しました' : '下書き', act:'go', attrs:{ 'data-app':'money', 'data-tab':'work' } });
  });
  Object.keys(CP_ROUTES).forEach(function(k){
    var r = cpData('route:' + k);
    if(r && norm(CP_ROUTES[k].label + ' 通学 経路 ' + r.from + ' ' + r.to).indexOf(q) >= 0) out.push({ kind:'通学の目安', title:CP_ROUTES[k].label, sub:r.dur + '分', act:'go', attrs:{ 'data-app':'set' } });
  });
  return out.slice(0, 30);
});
/* データの点検 */
kmCheck(function(){
  var out = [];
  termCourses().forEach(function(c){
    var sy = S.syllabus[c.name] || {};
    var tot = toNum(sy.exam) + toNum(sy.rep) + toNum(sy.att) + toNum(sy.other);
    if(tot && tot !== 100) out.push({ level:'warn', msg:c.name + 'の成績の割合の合計が' + tot + '%です（シラバスをたしかめてください）' });
  });
  var u = cpGpa().unknown;
  if(u.length) out.push({ level:'warn', msg:'評価の書き方が読めない授業：' + u.join('、') + '（授業タブの「GPAと単位」でGPの表に足してください）' });
  return out;
});
/* AIが読める計算結果（8.） */
function cpAiData(name, desc, section, fn){
  fn.section = section;
  kmAiData(name, desc, fn);
  KM.aiData[name].section = section;
}
cpAiData('campus_attendance', '授業ごとの出席・遅刻・欠席の数、出席率（%）、欠席の上限と、あと何回休めるか（rest）。lv は over=上限・ng=あと1回・warn=注意・ok', 'courses', function(){
  return termCourses().map(function(c){ var a = cpAttendInfo(c.name); return { name:a.name, pres:a.pres, late:a.late, absent:a.abRaw, absentCounted:a.ab, total:a.total, limit:a.limit, rest:a.rest, rate:a.rate, lv:a.lv }; });
});
cpAiData('campus_gpa', 'GPA（学期ごと・通算）、とった単位（必修・選択）、いま受けている単位、卒業に必要な単位とのちがい、GPの付け方', 'courses', function(){
  var o = cpGpa();
  return { gpa:o.gpa, terms:o.terms.map(function(t){ return { term:t.label, gpa:t.gpa, courses:t.n, earned:t.earned }; }), earned:o.earned, doing:o.doing,
           need:o.need, rest:o.rest, failed:o.fail, unreadable:o.unknown, gpTable:cpCfg().gp, scoreCut:cpCfg().cut };
});
cpAiData('campus_forecast', '授業ごとの成績の見込み（シラバスの割合と入れた点から）。need は期末で何点とれば秀・優・良・可になるか', 'courses', function(){
  return termCourses().map(function(c){ return cpForecast(c.name); }).filter(function(f){ return f.items.length; }).map(function(f){
    return { name:f.name, now:f.cur, grade:f.grade, fixed:f.fixed, items:f.items.map(function(x){ return { name:x.name, pct:x.pct, score:x.score, from:x.src }; }),
             target:f.target, need:f.need };
  });
});
cpAiData('campus_next', 'いまから次の授業（またはバイト）に間に合うか。時刻表で計算した着く時刻・何分前か・おそくとも出る時刻', 'timetable', function(){
  var n = new Date(), nm = n.getHours() * 60 + n.getMinutes(), info = cpNowInfo(today(), nm);
  if(!info) return { now:hhmmOf(nm), note:'いまは、これから行く授業・バイトがありません（朝〜授業前・バイトの前だけ計算します）' };
  var p = info.plan;
  return { now:hhmmOf(nm), target:info.target.label, start:hhmmOf(info.target.start), from:CP_FROM[info.from], text:cpNowText(info, nm),
           arrive:p ? hhmmOf(p.arrive) : null, minutesEarly:p ? p.diff : null, leaveBy:p && p.leaveBy != null ? hhmmOf(p.leaveBy) : null, legs:p ? p.legs : null, source:p ? p.src : null };
});
cpAiData('campus_routes', '通学の目安（Googleマップの経路で調べた所要時間・乗りかえ）と、地図に使う行き先の名前、設定の通学時間', 'transit', function(){
  var out = { places:{ home:cpPlaceQ('home'), school:cpPlaceQ('school'), work:cpPlaceQ('work') }, routes:{}, commuteMinutes:commuteTotal() };
  Object.keys(CP_ROUTES).forEach(function(k){ var r = cpData('route:' + k); out.routes[k] = r ? { label:CP_ROUTES[k].label, dur:r.dur, dep:r.dep, arr:r.arr, transfers:r.transfers, when:r.when } : null; });
  var n = new Date(), info = cpNowInfo(today(), n.getHours() * 60 + n.getMinutes());
  if(info) out.now = cpNowText(info);
  return out;
});
cpAiData('campus_shift', 'シフト希望の提出のきまり（毎月何日まで）・次の締切・出したか・希望の下書き', 'work', function(){
  var nx = cpWishNext();
  if(!nx) return { rule:'まだ決めていません' };
  var dr = cpWishDraft(nx.ym);
  return { rule:'毎月' + cpCfg().wish.day + '日までに翌月ぶんを出す', due:nx.due, month:nx.ym, daysLeft:nx.left, submitted:nx.done, draft:dr.text };
});
/* AIそうだんの道具：休講・補講・遠隔を登録する（書きこむ道具） */
kmChatTool({ name:'campus_class_change', description:'授業の休講・補講・遠隔（オンライン）を手帳に登録する。「明日の1限は休講」「10/3に医学英語の補講が3限」など。',
  parameters:{ type:'OBJECT', properties:{
    date:{ type:'STRING', description:'日付 YYYY-MM-DD' }, course:{ type:'STRING', description:'授業名（その日ぜんぶなら *）' },
    type:{ type:'STRING', enum:['cancel', 'makeup', 'online'], description:'cancel=休講、makeup=補講、online=遠隔' },
    period:{ type:'NUMBER', description:'補講の時限（補講のときだけ）' }, room:{ type:'STRING', description:'教室（なければ空）' } }, required:['date', 'type'] } },
  function(a){
    a = a || {};
    var date = cpYmd(a.date), course = a.course === '*' ? '*' : cpCourse(a.course), type = { cancel:1, makeup:1, online:1 }[a.type] ? a.type : '';
    if(!isYmd(date) || !type) return { result:'日付か種類がわかりません' };
    if(!course) return { result:'授業「' + (a.course || '') + '」が時間割に見つかりません。授業名をたしかめてください' };
    if(type === 'makeup' && (course === '*' || PERIODS.indexOf(toNum(a.period)) < 0)) return { result:'補講は授業名と時限（' + PERIODS[0] + '〜' + PERIODS[PERIODS.length - 1] + '限）が必要です' };
    var id = uid('hx');
    S.holidays.push({ id:id, date:date, course:course, type:type, period:type === 'makeup' ? toNum(a.period) : 0, room:String(a.room || '').slice(0, 30), mt:Date.now() });
    var label = (course === '*' ? 'ぜんぶの授業' : course) + 'の' + ({ cancel:'休講', makeup:'補講', online:'遠隔' })[type] + '（' + ymdLabel(date) + '）';
    return { result:'登録しました：' + label, op:{ t:'add', list:'holidays', id:id, label:label } };
  });
KM.chatTools[KM.chatTools.length - 1].write = true;

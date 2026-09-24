/* もんだいメーカー：「つくる」タブの画面 */

function mkView(){
  if(mk.pv) return mkPvView();
  if(mk.warp) return mkWarpView();
  var h = '';
  if(mk.busy === 'make' && mk.prog){
    h += section('作っています…', null,
      '<div class="prog">' + bar(40, 'anim') + '<div class="s">' + esc(mk.prog.msg) + '</div></div>' +
      btn('とちゅうでやめる', 'mk-stop', { cls:'ghost' }));
    return h;
  }
  h += '<div class="segrow">' +
    '<button type="button" data-act="mk-mode" data-v="file" class="' + (mk.mode === 'file' ? 'on' : '') + '">📸 資料から</button>' +
    '<button type="button" data-act="mk-mode" data-v="kit" class="' + (mk.mode === 'kit' ? 'on' : '') + '">🧪 表から（AIなし）</button>' +
    '</div>';
  h += mkSubPart();
  h += (mk.mode === 'kit') ? mkKitPart() : mkFilePart();
  return h;
}
function mkSubPart(){
  var list = subs();
  if(!list.length) return section('どの科目に入れる？', null, noSubHtml());
  return section('どの科目に入れる？', subName(mkSubId()), subChips('mk-sub', mkSubId(), false));
}
/* ===== 資料から作る ===== */
function mkFilePart(){
  var h = '';
  h += section('資料をえらぶ', mk.files.length ? mk.files.length + 'つ' : null,
    warnBox(WARN_PRIVACY) +
    '<div class="pair3">' +
      btn('📷 写真をとる', 'mk-shot', { cls:'ghost' }) +
      btn('🔁 つづけてとる', 'mk-loop', { cls:'ghost' }) +
      btn('📁 ファイル', 'mk-pick', { cls:'ghost' }) +
    '</div>' +
    (mk.busy === 'read' ? '<div class="s wait">読みこんでいます…</div>' : '') +
    mkFileList() +
    '<label class="f" for="mk_paste">文章をはりつける（メモ・先生の配布テキストなど）</label>' +
    '<textarea id="mk_paste" rows="3" placeholder="ここにはりつけると、その字から問題を作ります">' + esc(inVal('mk_paste')) + '</textarea>');

  h += section('資料の情報', null,
    '<div class="pair">' +
      '<div><label class="f" for="mk_no">第◯回</label><input id="mk_no" type="number" min="1" max="30" inputmode="numeric" value="' + esc(inVal('mk_no', mk.mat.no)) + '" placeholder="3"></div>' +
      '<div><label class="f" for="mk_at">日付</label><input id="mk_at" type="date" value="' + esc(inVal('mk_at', mk.mat.at)) + '"></div>' +
    '</div>' +
    '<label class="f" for="mk_memo">先生が強調したところ（あれば）</label>' +
    '<input id="mk_memo" type="text" maxlength="200" value="' + esc(inVal('mk_memo', mk.mat.memo)) + '" placeholder="「ここテストに出す」と言われたところ">');

  h += section('どんな問題にする？', mk.opt.noai ? 'AIなし' : (mk.opt.auto ? 'おまかせ' : mk.opt.n + '問'),
    '<label class="f">問題の数</label>' +
    '<div class="pillrow">' +
      '<button type="button" data-act="mk-auto" class="' + (mk.opt.auto ? 'on' : '') + '">おまかせ</button>' +
      [5, 10, 15, 20].map(function(n){
        return '<button type="button" data-act="mk-n" data-v="' + n + '" class="' + (!mk.opt.auto && mk.opt.n === n ? 'on' : '') + '">' + n + '問</button>';
      }).join('') +
    '</div>' +
    '<label class="f">種類（いくつでも）</label>' +
    '<div class="chips">' + AI_TYPES.map(function(t){
      return '<button type="button" data-act="mk-type" data-v="' + t + '" class="' + (mk.opt.types.indexOf(t) >= 0 ? 'on' : '') + '">' + esc(typeName(t)) + '</button>';
    }).join('') + '</div>' +
    '<label class="f">むずかしさ</label>' +
    '<div class="pillrow">' +
      [[1, '基本'], [2, 'ふつう'], [3, '応用']].map(function(v){
        return '<button type="button" data-act="mk-lv" data-v="' + v[0] + '" class="' + (!mk.opt.both && mk.opt.lv === v[0] ? 'on' : '') + '">' + v[1] + '</button>';
      }).join('') +
      '<button type="button" data-act="mk-both" class="' + (mk.opt.both ? 'on' : '') + '">2通り作る</button>' +
    '</div>' +
    (mk.more ? mkMorePart() : '<button type="button" class="link" data-act="mk-more">くわしい設定をひらく</button>') +
    '<div class="pair" style="margin-top:12px">' +
      btn((mk.opt.noai ? '✏️ AIを使わずに作る' : '✨ 問題をつくる'), 'mk-run', { cls:'main' }) +
      btn(mk.opt.noai ? 'AIを使う' : 'AIなし', 'mk-noai', { cls:'ghost' }) +
    '</div>' +
    (mk.pend ? '<div class="s bad" style="margin-top:8px">できませんでした：' + esc(mk.pend.msg) + '</div>' +
      btn('もう一度ためす', 'mk-run', { cls:'ghost' }) : '') +
    note(mk.opt.noai
      ? '資料の字から、その場で穴うめ・○×を作ります。<b>通信もAIも使いません</b>（APIの使用量ゼロ）。'
      : '字が取り出せる資料（スライド・Word・文章）は、<b>写真を送らずに字だけ</b>送ります。前に作った問題ともかぶらないようにします。'));
  return h;
}
function mkMorePart(){
  return '<label class="f">出しかた</label>' +
    '<div class="chips">' +
      '<button type="button" data-act="mk-style" data-v="case" class="' + (mk.opt.style === 'case' ? 'on' : '') + '">事例（患者さんの場面）</button>' +
      '<button type="button" data-act="mk-style" data-v="exam" class="' + (mk.opt.style === 'exam' ? 'on' : '') + '">定期テストふう</button>' +
      '<button type="button" data-act="mk-kokushi" class="' + (mk.opt.kokushi ? 'on' : '') + '">国試ふうの言い回し</button>' +
      '<button type="button" data-act="mk-en" class="' + (mk.opt.en ? 'on' : '') + '">英語・略語を入れる</button>' +
      '<button type="button" data-act="mk-two" class="' + (mk.opt.two ? 'on' : '') + '">「2つ選べ」を入れる</button>' +
    '</div>' +
    '<button type="button" class="link" data-act="mk-more">とじる</button>';
}
function mkFileList(){
  if(!mk.files.length) return '';
  return '<div class="files">' + mk.files.map(function(f, i){
    var h = '<div class="file">' +
      (f.url && f.kind === 'photo' ? '<img src="' + esc(f.url) + '" alt="">' : '<div class="ic">' + (f.kind === 'pdf' ? '📕' : f.kind === 'slide' ? '📊' : '📄') + '</div>') +
      '<div class="bd"><b>' + esc(f.name) + '</b>' +
      '<div class="s">' + esc(fKindName(f.kind)) + (f.text ? '・字' + f.text.length + '文字' : '') + (f.done ? '・手入れずみ' : '') + '</div>' +
      (f.warn ? '<div class="s bad">' + f.warn + '</div>' : '') +
      (f.dup ? '<div class="s amber">' + esc(f.dup) + '</div>' : '') +
      (f.kind === 'photo' ? '<div class="minirow">' +
        '<button type="button" data-act="mk-fix" data-i="' + i + '" data-how="auto">明るく・くっきり</button>' +
        '<button type="button" data-act="mk-warp" data-i="' + i + '">まっすぐ</button>' +
        '<button type="button" data-act="mk-fix" data-i="' + i + '" data-how="split">見開きを2つに</button>' +
      '</div>' : '') +
      '</div>' +
      '<button type="button" class="x" data-act="mk-del" data-i="' + i + '" aria-label="けす">×</button>' +
      '</div>';
    return h;
  }).join('') + '</div>';
}
/* ===== 写真をまっすぐにする ===== */
function mkWarpView(){
  var w = mk.warp, f = mk.files[w.i];
  if(!f) { mk.warp = null; return mkView(); }
  var pts = w.quad.map(function(p, i){
    return '<button type="button" class="handle" data-act="mk-warp-pt" data-i="' + i + '" style="left:' + (p[0] * 100) + '%;top:' + (p[1] * 100) + '%"' +
      (w.sel === i ? ' data-on="1"' : '') + '>' + (i + 1) + '</button>';
  }).join('');
  return section('四すみを合わせる', '① 左上 → ② 右上 → ③ 右下 → ④ 左下',
    '<div class="warp"><img src="' + esc(f.url) + '" alt="">' + pts + '</div>' +
    '<div class="s">点をえらんで、下のボタンで動かします。</div>' +
    '<div class="padrow">' +
      '<button type="button" data-act="mk-warp-mv" data-d="u">↑</button>' +
      '<button type="button" data-act="mk-warp-mv" data-d="l">←</button>' +
      '<button type="button" data-act="mk-warp-mv" data-d="r">→</button>' +
      '<button type="button" data-act="mk-warp-mv" data-d="d">↓</button>' +
    '</div>' +
    '<div class="pair">' + btn('まっすぐにする', 'mk-warp-ok', { cls:'main' }) + btn('やめる', 'mk-warp-no', { cls:'ghost' }) + '</div>');
}
/* ===== 表から作る（AIなし） ===== */
function mkKitPart(){
  var kit = kitOf(mk.kit.id);
  var h = section('何から作る？', kit.name,
    '<div class="kits">' + KITS.map(function(k){
      return '<button type="button" data-act="mk-kit" data-v="' + k.id + '" class="' + (mk.kit.id === k.id ? 'on' : '') + '">' +
        '<b>' + esc(k.name) + '</b><span>' + esc(k.desc) + '</span></button>';
    }).join('') + '</div>' +
    (kit.id === 'lab' || kit.id === 'labc'
      ? '<label class="f">分類でしぼる</label>' +
        chips([['', 'すべて']].concat(dLabCats().map(function(c){ return [c, c]; })), mk.kit.cat, 'mk-kitcat')
      : '') +
    (kit.id === 'calc'
      ? '<label class="f">計算の種類（えらばないと、ぜんぶから出ます）</label>' +
        '<div class="chips">' + D_CALC.map(function(t){
          return '<button type="button" data-act="mk-calc" data-v="' + t.id + '" class="' + (mk.kit.calcIds.indexOf(t.id) >= 0 ? 'on' : '') + '">' + esc(t.name) + '</button>';
        }).join('') + '</div>'
      : '') +
    (kit.id === 'match'
      ? '<label class="f">どの表からむすぶ？</label>' +
        chips([['', '略語'], ['lab', '基準値'], ['drug', '薬']], mk.kit.from, 'mk-kitfrom')
      : '') +
    (kit.id === 'kokushi'
      ? '<label class="f">分野でしぼる</label>' +
        chips([['', 'すべて']].concat(D_FIELDS.map(function(f){ return [f[0], f[1]]; })), mk.kit.field, 'mk-kitfield')
      : '') +
    '<label class="f">問題の数</label>' +
    '<div class="pillrow">' + [5, 10, 20, 30].map(function(n){
      return '<button type="button" data-act="mk-kitn" data-v="' + n + '" class="' + (mk.kit.n === n ? 'on' : '') + '">' + n + '問</button>';
    }).join('') + '</div>' +
    btn('この中から' + mk.kit.n + '問つくる', 'mk-kitrun', { cls:'main' }) +
    note('先に入れてある表（基準値' + dLabs().length + '・略語' + dDicts().length + '・薬' + dDrugs().length +
      '・手順' + dSkills().length + '・練習問題' + D_QS.length + '）から作ります。' +
      '<b>AI（Gemini）は使いません</b>ので、通信も、APIの使用量もかかりません。数字は教科書で確かめてください。'));
  return h;
}
/* ===== できた問題の下書き ===== */
function mkPvView(){
  var pv = mk.pv;
  var h = section('できた問題', pv.items.length + '問',
    '<div class="s">' + esc(pv.title) + (pv.summary ? '<br>' + esc(pv.summary) : '') + '</div>' +
    '<div class="pair" style="margin-top:10px">' +
      btn('この' + pv.items.length + '問を入れる', 'mk-add', { cls:'main' }) +
      btn('すてる', 'mk-drop-all', { cls:'ghost' }) +
    '</div>');
  pv.items.forEach(function(it, i){
    h += '<section class="card q">' +
      '<div class="qhd"><span class="tag">' + esc(typeName(it.qt)) + '</span>' +
        (it.ch ? '<span class="tag sub">' + esc(it.ch) + '</span>' : '') +
        '<span class="lv">むずかしさ' + toNum(it.lv) + '</span></div>' +
      '<div class="qq">' + nl2br(it.q) + '</div>' +
      (it.fig ? '<div class="qpic">' + anatOf(it) + '</div>' : it.svg ? '<div class="qpic">' + it.svg + '</div>' : '') +
      mkPvBody(it) +
      (it.exp ? '<div class="exp">' + nl2br(it.exp) + '</div>' : '') +
      '<div class="minirow">' +
        '<button type="button" data-act="mk-remake" data-i="' + i + '">🔁 作り直す</button>' +
        '<button type="button" data-act="mk-dropone" data-i="' + i + '">けす</button>' +
      '</div>' +
      srcLine(it.src) +
      '</section>';
  });
  return h;
}
function mkPvBody(it){
  if(it.qt === 'match'){
    return '<ul class="plain">' + (it.pairs || []).map(function(p){
      return '<li>' + esc(p[0]) + ' ＝ ' + esc(p[1]) + '</li>';
    }).join('') + '</ul>';
  }
  if(it.qt === 'order'){
    return '<ol class="plain">' + (it.c || []).map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ol>';
  }
  if(it.qt === 'mc' || it.qt === 'tf'){
    return '<ul class="plain">' + (it.c || []).map(function(c, k){
      return '<li' + ((it.a || []).indexOf(k) >= 0 ? ' class="ok"' : '') + '>' + (NUMS[k] || '') + ' ' + esc(c) + '</li>';
    }).join('') + '</ul>';
  }
  return '<div class="ans">答え：' + esc(answerText(it)) + '</div>';
}

/* ============================== 操作 ============================== */
onView('make', mkView);
onAct('mk-mode', function(d){ mk.mode = d.v; render(); });
onAct('mk-sub', function(d){ view.sub = d.v; render(); });
onAct('mk-pick', function(){ mkPickFiles(); });
onAct('mk-shot', function(){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  try{ inp.capture = 'environment'; }catch(e){}
  inp.onchange = function(){ if((inp.files || []).length) mkTake(Array.prototype.slice.call(inp.files)); };
  inp.click();
});
onAct('mk-loop', function(){ mkShotLoop(); });
onAct('mk-del', function(d){ mk.files.splice(toNum(d.i), 1); render(); });
onAct('mk-fix', function(d){ mkFix(toNum(d.i), d.how); });
onAct('mk-warp', function(d){
  mk.warp = { i:toNum(d.i), sel:0, quad:[[0.06, 0.06], [0.94, 0.06], [0.94, 0.94], [0.06, 0.94]] };
  render();
});
onAct('mk-warp-pt', function(d){ mk.warp.sel = toNum(d.i); render(); });
onAct('mk-warp-mv', function(d){
  var w = mk.warp, p = w.quad[w.sel], s = 0.02;
  if(d.d === 'u') p[1] = clamp(p[1] - s, 0, 1);
  if(d.d === 'd') p[1] = clamp(p[1] + s, 0, 1);
  if(d.d === 'l') p[0] = clamp(p[0] - s, 0, 1);
  if(d.d === 'r') p[0] = clamp(p[0] + s, 0, 1);
  render();
});
onAct('mk-warp-ok', function(){ mkWarpApply(); });
onAct('mk-warp-no', function(){ mk.warp = null; render(); });
onAct('mk-auto', function(){ mk.opt.auto = 1; render(); });
onAct('mk-n', function(d){ mk.opt.auto = 0; mk.opt.n = toNum(d.v); render(); });
onAct('mk-type', function(d){
  var i = mk.opt.types.indexOf(d.v);
  if(i >= 0){ if(mk.opt.types.length > 1) mk.opt.types.splice(i, 1); }
  else mk.opt.types.push(d.v);
  render();
});
onAct('mk-lv', function(d){ mk.opt.both = 0; mk.opt.lv = toNum(d.v); render(); });
onAct('mk-both', function(){ mk.opt.both = mk.opt.both ? 0 : 1; render(); });
onAct('mk-more', function(){ mk.more = mk.more ? 0 : 1; render(); });
onAct('mk-style', function(d){ mk.opt.style = (mk.opt.style === d.v) ? '' : d.v; render(); });
onAct('mk-kokushi', function(){ mk.opt.kokushi = mk.opt.kokushi ? 0 : 1; render(); });
onAct('mk-en', function(){ mk.opt.en = mk.opt.en ? 0 : 1; render(); });
onAct('mk-two', function(){ mk.opt.two = mk.opt.two ? 0 : 1; render(); });
onAct('mk-noai', function(){ mk.opt.noai = mk.opt.noai ? 0 : 1; render(); });
onAct('mk-run', function(){ mk.mat.no = String(elVal('mk_no') || ''); mk.mat.at = String(elVal('mk_at') || ''); mk.mat.memo = String(elVal('mk_memo') || ''); mkRun(); });
onAct('mk-stop', function(){ mkStop(); });
onAct('mk-kit', function(d){ mk.kit.id = d.v; mk.kit.cat = ''; render(); });
onAct('mk-kitcat', function(d){ mk.kit.cat = d.v; render(); });
onAct('mk-kitfrom', function(d){ mk.kit.from = d.v; render(); });
onAct('mk-kitfield', function(d){ mk.kit.field = d.v; render(); });
onAct('mk-kitn', function(d){ mk.kit.n = toNum(d.v); render(); });
onAct('mk-calc', function(d){
  var i = mk.kit.calcIds.indexOf(d.v);
  if(i >= 0) mk.kit.calcIds.splice(i, 1); else mk.kit.calcIds.push(d.v);
  render();
});
onAct('mk-kitrun', function(){ mkRunKit(); });
onAct('mk-add', function(){ mkAdd(); });
onAct('mk-drop-all', function(){ if(ask('作った問題をすてますか？')){ mk.pv = null; render(); } });
onAct('mk-dropone', function(d){ mkDrop(toNum(d.i)); });
onAct('mk-remake', function(d){ mkRemake(toNum(d.i)); });

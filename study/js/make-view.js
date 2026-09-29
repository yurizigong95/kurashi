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
    '<div class="grid2">' +
      btn('📷 写真をとる', 'mk-shot', { cls:'ghost' }) +
      btn('🔁 つづけてとる', 'mk-loop', { cls:'ghost' }) +
      btn('🖼 アルバムから', 'mk-photos', { cls:'ghost' }) +
      btn('📁 ファイルから', 'mk-pick', { cls:'ghost' }) +
      btn('📓 Goodnotesのノートから', 'gn-open', { cls:'ghost wide' }) +
    '</div>' +
    '<div class="s" style="margin-top:6px">アルバム・ファイル・リンクは、<b>いくつでもまとめて</b>えらべます（あわせて' + MAX_FILES + 'こまで）。</div>' +
    '<label class="f" for="mk_links">🔗 リンクから（ウェブのページ・PDF・YouTube）</label>' +
    '<textarea id="mk_links" rows="2" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" ' +
      'placeholder="https://… を1行に1つ。いくつでもまとめて入れられます">' + esc(inVal('mk_links')) + '</textarea>' +
    btn('🔗 リンクを読む', 'mk-links', { cls:'ghost', dis:!!mk.busy }) +
    ((mk.linkFails || []).length ? '<div class="warnbox" style="margin-top:8px"><div class="s"><b>読めなかったリンク</b></div>' +
      mk.linkFails.map(function(f){ return '<div class="s">・' + esc(linkName(f.u)) + '：' + esc(f.why) + '</div>'; }).join('') +
      '<div class="s">ページを開いて文章をコピーし、下の「文章をはりつける」に入れても作れます。PDFなら保存して「ファイルから」でも入れられます。</div>' +
      (mk.linkFails.some(function(f){ return linkExportUrl(f.u); }) ? '<div class="s">Googleドライブのファイルは、「📁 ファイルから」→「ブラウズ」→「Google ドライブ」からもえらべます（iPhoneに Google ドライブのアプリが入っているとき）。</div>' : '') +
      '</div>' : '') +
    (mk.busy === 'read' ? '<div class="s wait">' + esc(mk.linkMsg || '読みこんでいます…') + '</div>' : '') +
    mkFileList() +
    mkCostPart() +
    note('えらべるもの：写真・PDF・スライド(.pptx)・Word(.docx)・文章・ZIP・<b>講義の録音・動画</b>・<b>リンク</b>。' +
      '大きいファイル（' + fSizeText(INLINE_MAX) + 'より上）でも大丈夫です。AIにいったん預けてから読んでもらいます（2GBまで）。' +
      '<br>リンクは、読めるページはそのまま読みます。読めないページは、AIが開いて読みます（APIキーが必要）。') +
    '<label class="f" for="mk_paste">文章をはりつける（メモ・先生の配布テキストなど）</label>' +
    '<textarea id="mk_paste" rows="3" autocapitalize="off" placeholder="ここにはりつけると、その字から問題を作ります（リンクだけでもOK）">' + esc(inVal('mk_paste')) + '</textarea>');

  h += (typeof gnPart === 'function') ? gnPart() : '';

  h += mkNamePart();

  h += section('どんな問題にする？', mk.opt.noai ? 'AIなし' : mk.opt.n + '問',
    '<label class="f">問題の数</label>' +
    '<div class="pillrow">' + MK_NS.map(function(n){
        return '<button type="button" data-act="mk-n" data-v="' + n + '" class="' + (mk.opt.n === n ? 'on' : '') + '">' + n + '問</button>';
      }).join('') +
    '</div>' +
    '<label class="f">種類（いくつでも。はじめは、ぜんぶ）</label>' +
    '<div class="chips">' + MK_TYPES.map(function(t){
      return '<button type="button" data-act="mk-type" data-v="' + t[0] + '" class="' + (mk.opt.types.indexOf(t[0]) >= 0 ? 'on' : '') + '">' + esc(t[1]) + '</button>';
    }).join('') +
    (mk.opt.types.length < MK_TYPES.length ? '<button type="button" data-act="mk-typeall">ぜんぶえらぶ</button>' : '') + '</div>' +
    '<label class="f">どんなテストふう？</label>' +
    '<div class="pillrow">' + MK_FORMS.map(function(f){
      return '<button type="button" data-act="mk-form" data-v="' + f[0] + '" class="' + (mk.opt.form === f[0] ? 'on' : '') + '">' + esc(f[1]) + '</button>';
    }).join('') + '</div>' +
    '<div class="s">' + esc((MK_FORMS.filter(function(f){ return f[0] === mk.opt.form; })[0] || MK_FORMS[0])[2]) + '</div>' +
    '<label class="f">むずかしさ</label>' +
    '<div class="pillrow">' +
      [[1, '基本'], [2, 'ふつう'], [3, '応用']].map(function(v){
        return '<button type="button" data-act="mk-lv" data-v="' + v[0] + '" class="' + (!mk.opt.both && mk.opt.lv === v[0] ? 'on' : '') + '">' + v[1] + '</button>';
      }).join('') +
      '<button type="button" data-act="mk-both" class="' + (mk.opt.both ? 'on' : '') + '">2通り作る</button>' +
    '</div>' +
    '<div class="s">' + esc(mkLvHelp()) + '</div>' +
    (mk.more ? mkMorePart() : '<button type="button" class="link" data-act="mk-more">くわしい設定をひらく</button>') +
    '<div class="pair" style="margin-top:12px">' +
      btn((mk.opt.noai ? '✏️ AIを使わずに作る'
        : (mk.okBig && mk.okBig === mkEstKey(estAll(mk.files)) ? '⚠️ それでも作る' : '✨ 問題をつくる')), 'mk-run', { cls:'main' }) +
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
  return '<label class="f">くわしい設定</label>' +
    '<div class="chips">' +
      '<button type="button" data-act="mk-case" class="' + (mk.opt.cas ? 'on' : '') + '">事例（患者さんの場面）をふやす</button>' +
      '<button type="button" data-act="mk-en" class="' + (mk.opt.en ? 'on' : '') + '">英語・略語を入れる</button>' +
    '</div>' +
    '<button type="button" class="link" data-act="mk-more">とじる</button>';
}
/* むずかしさの説明（えらんでいるもの） */
function mkLvHelp(){
  if(mk.opt.both) return '半分を「基本」、半分を「応用」で作ります（1回のAIで2つのむずかしさ）。';
  return { 1:'基本：授業に出たことばの意味・正常値・名前など、覚えているかを聞きます。',
           2:'ふつう：テストによく出るところを、ことばと理由の両方から聞きます。',
           3:'応用：なぜそうするか・場面でどう考えるか・まちがえやすいところを聞きます。' }[mk.opt.lv] || '';
}
/* 資料の名前（と、入れるフォルダ） */
function mkNamePart(){
  var subId = mkSubId(), fds = subId ? fdsOf(subId) : [];
  if(mk.fd && !fdGet(subId, mk.fd)) mk.fd = '';
  return section('資料の名前', null,
    '<input id="mk_title" type="text" maxlength="60" value="' + esc(inVal('mk_title', mk.mat.title)) + '" placeholder="例：第3回 循環器">' +
    '<div class="s">からのときは、AIがつけた見出し（なければファイルの名前）にします。</div>' +
    (fds.length
      ? '<label class="f">入れるフォルダ</label>' +
        chips([['', 'なし']].concat(fds.map(function(f){ return [f.id, '📁 ' + f.name]; })), mk.fd || '', 'mk-fd')
      : ''));
}
/* どれくらい使いそうか（大きさ・トークン・お金・無料のめやす） */
function mkCostPart(){
  if(!mk.files.length) return '';
  var e = estAll(mk.files), u = aiUse(), l = aiLim();
  var yen = aiYen(e.tok, 1500);                       /* 答えのぶんも、ざっくり足す */
  var left = Math.max(0, toNum(l.rpd) - toNum(u.req));
  var over = [];
  if(e.tok > toNum(l.ctx)) over.push('この資料は大きすぎて、<b>1回では読みきれない</b>かもしれません（' + aiTokText(l.ctx) + 'トークンまで）。短く切るか、動画なら音声だけにしてみてください。');
  else if(e.tok > toNum(l.ctx) * 0.6) over.push('かなり大きいので、<b>1回ぶんの上限に近い</b>です（' + aiTokText(l.ctx) + 'トークンまで）。');
  if(left <= 0) over.push('きょうは、もう<b>無料のめやす（' + toNum(l.rpd) + '回）を使いきって</b>います。明日になるか、有料にしていれば、そのまま使えます。');
  else if(left <= 3) over.push('きょう作れるのは、<b>のこり' + left + '回くらい</b>です（無料のめやす ' + toNum(l.rpd) + '回）。');
  var h = '<div class="' + (over.length ? 'warnbox' : 'costbox') + '">' +
    '<div class="s"><b>ぜんぶで ' + fSizeText(e.size) + '</b>' +
      (e.up ? '（うち ' + fSizeText(e.up) + ' をAIに送ります）' : '') +
      '　／　AIが読む量のめやす <b>' + aiTokText(e.tok) + 'トークン</b>' +
      '　／　お金のめやす <b>' + aiYenText(yen) + '</b></div>' +
    (over.length ? '<div class="s">⚠️ ' + over.join('<br>⚠️ ') + '</div>' : '') +
    '<div class="s">きょう ' + toNum(u.req) + '回・' + aiTokText(toNum(u.tin) + toNum(u.tout)) + 'トークン使いました（' + aiYenText(aiYen(u.tin, u.tout)) + '）。' +
      'めやすの数は「設定」で直せます。</div>' +
    '</div>';
  return h;
}
function mkFileList(){
  if(!mk.files.length) return '';
  return '<div class="files">' + mk.files.map(function(f, i){
    var h = '<div class="file">' +
      (f.url && f.kind === 'photo' ? '<img src="' + esc(f.url) + '" alt="">' : '<div class="ic">' +
        (f.yt ? '▶️' : f.kind === 'link' ? '🔗' : f.kind === 'pdf' ? '📕' : f.kind === 'slide' ? '📊' : f.kind === 'audio' ? '🎧' : f.kind === 'video' ? '🎬' : '📄') + '</div>') +
      '<div class="bd"><b>' + esc(f.name) + '</b>' +
      (f.link ? '<div class="s link">' + esc(linkName(f.link)) + '</div>' : '') +
      (f.yt ? '<div class="s">YouTube は、AIが動画を見て作ります（長さが分からないので、10分として数えています）</div>' : '') +
      (f.ai ? '<div class="s">' + (f.unsure ? '⚠️ AIが読みました（ページを開けたか確かめられなかったので、中身をたしかめてください）' : 'AIがページを開いて読みました') + '</div>' : '') +
      '<div class="s">' + esc(f.yt ? 'YouTube' : fKindName(f.kind)) +
        (f.size ? '・' + fSizeText(f.size) : '') +
        (f.text ? '・字' + f.text.length + '文字' : '') + (f.done ? '・手入れずみ' : '') + '</div>' +
      (f.big ? '<div class="s">📡 大きいので、AIに送ってから読んでもらいます（送るあいだ、少し時間がかかります）</div>' : '') +
      (f.cut ? '<div class="s amber">長い文章なので、はじめの' + fSizeText(TXT_HEAD) + 'ぶんだけ読みました。</div>' : '') +
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
    '<div class="pillrow">' + MK_NS.map(function(n){
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
    (pv.nomat ? '<div class="s">' + esc(pv.title) + '</div>'
      : '<label class="f" for="mk_title">資料の名前</label>' +
        '<input id="mk_title" type="text" maxlength="60" value="' + esc(inVal('mk_title', pv.title)) + '">') +
    (pv.summary ? '<div class="s">' + esc(pv.summary) + '</div>' : '') +
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
/* 写真を、アルバムからまとめてえらぶ */
onAct('mk-photos', function(){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.onchange = function(){ if((inp.files || []).length) mkTake(Array.prototype.slice.call(inp.files)); };
  inp.click();
});
onAct('mk-links', async function(){
  if(!linkList(String(elVal('mk_links') || '')).length && !linkMostly(String(elVal('mk_paste') || ''))){
    toast('https:// ではじまるリンクを入れてください', true); return;
  }
  await mkReadPending();
});
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
onAct('mk-n', function(d){ mk.opt.n = toNum(d.v); render(); });
onAct('mk-type', function(d){
  var i = mk.opt.types.indexOf(d.v);
  if(i >= 0){
    if(mk.opt.types.length > 1) mk.opt.types.splice(i, 1);
    else toast('1つはえらんでください', true);
  }
  else mk.opt.types.push(d.v);
  render();
});
onAct('mk-typeall', function(){ mk.opt.types = MK_TYPES.map(function(t){ return t[0]; }); render(); });
onAct('mk-form', function(d){ mk.opt.form = d.v; render(); });
onAct('mk-fd', function(d){ mk.fd = String(d.v || ''); render(); });
onAct('mk-lv', function(d){ mk.opt.both = 0; mk.opt.lv = toNum(d.v); render(); });
onAct('mk-both', function(){ mk.opt.both = mk.opt.both ? 0 : 1; render(); });
onAct('mk-more', function(){ mk.more = mk.more ? 0 : 1; render(); });
onAct('mk-case', function(){ mk.opt.cas = mk.opt.cas ? 0 : 1; render(); });
onAct('mk-en', function(){ mk.opt.en = mk.opt.en ? 0 : 1; render(); });
onAct('mk-noai', function(){ mk.opt.noai = mk.opt.noai ? 0 : 1; render(); });
onAct('mk-run', function(){ mk.mat.title = String(elVal('mk_title') || '').trim(); mkRun(); });
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
onAct('mk-drop-all', function(){
  if(!ask('作った問題をすてますか？')) return;
  mk.pv = null;
  if(!mk.mat.title) delete INP.mk_title;          /* 自分でつけた名前でなければ、AIの見出しはのこさない */
  render();
});
onAct('mk-dropone', function(d){ mkDrop(toNum(d.i)); });
onAct('mk-remake', function(d){ mkRemake(toNum(d.i)); });

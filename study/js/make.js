/* もんだいメーカー：「つくる」タブ
   ・資料（写真・PDF・スライド・Word・文章・ZIP）から、AIに問題を作ってもらう
   ・AIを使わずに作る（資料の字から／組みこみの表から）
   ・できた問題は、いったん下書きで見せて、よければ科目に入れる */

var mk = {
  mode:'file',                 /* file … 資料から／kit … 表から（AIなし） */
  files:[], busy:'', pv:null, prog:null, abort:null, warp:null, more:0,
  mat:{ no:'', memo:'', at:'', title:'' },
  opt:{ n:10, auto:1, types:['mc', 'tf', 'cloze'], lv:2, style:'', kokushi:0, en:0, two:0, both:0, noai:0 },
  kit:{ id:'lab', n:10, cat:'', calcIds:[], field:'', from:'' },
  pend:null                     /* 通信が切れたときの「もう一度ためす」 */
};

/* ============================== ファイルをえらぶ ============================== */
function mkPickFiles(){
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = ['image/*', '.pdf', 'application/pdf',
    '.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt', '.md', '.csv', 'text/plain', 'text/csv', '.zip', 'application/zip',
    'audio/*', '.mp3', '.m4a', '.wav', 'video/*', '.mp4', '.mov'].join(',');
  inp.multiple = true;
  inp.onchange = function(){
    var files = Array.prototype.slice.call(inp.files || [], 0, MAX_FILES);
    if(files.length) mkTake(files);
  };
  inp.click();
}
/* つづけて写真をとる（スライドを何枚も） */
function mkShotLoop(){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  try{ inp.capture = 'environment'; }catch(e){}
  inp.onchange = async function(){
    var f = (inp.files || [])[0];
    if(!f) return;
    await mkTake([f], true);
    if(mk.files.length < MAX_FILES){
      toast(mk.files.length + '枚目まで読みました。次の1枚をどうぞ');
      setTimeout(function(){ inp.value = ''; inp.click(); }, 400);
    }else{
      toast(MAX_FILES + '枚まで読みました');
    }
  };
  inp.click();
}
async function mkTake(files, quiet){
  if(mk.busy) return;
  mk.busy = 'read'; render();
  try{
    var loaded = await loadFiles(files);
    mk.files = dupMark(mk.files.concat(loaded)).slice(0, MAX_FILES);
    /* 写真をとった日を、資料の日付にする */
    if(!mk.mat.at){
      var withAt = mk.files.filter(function(x){ return x.at; })[0];
      if(withAt){ mk.mat.at = withAt.at; INP.mk_at = withAt.at; }
    }
    /* 名前から「第◯回」を見つける */
    if(!mk.mat.no){
      var m = String((loaded[0] && loaded[0].name) || '').match(/第?\s*(\d{1,2})\s*回/);
      if(m){ mk.mat.no = m[1]; INP.mk_no = m[1]; }
    }
    if(!mk.mat.title && mk.files[0]) mk.mat.title = String(mk.files[0].name).replace(/\.[a-z0-9]+$/i, '').slice(0, 60);
    if(!quiet) toast(loaded.length + 'つ読みこみました');
  }catch(e){
    toast(e.message, true);
  }finally{
    mk.busy = ''; render();
  }
}
/* 写真を1枚ととのえる */
async function mkFix(i, how){
  var f = mk.files[i];
  if(!f || f.kind !== 'photo' || !f.url || mk.busy) return;
  mk.busy = 'fix'; render();
  try{
    if(how === 'auto'){
      f.url = await imgAuto(f.url);
      f.done = 1; f.warn = '';
      toast('明るさとコントラストをととのえました');
    }else if(how === 'split'){
      var two = await imgSplit(f.url);
      var base = f.name.replace(/(\.[a-z]+)?$/i, '');
      mk.files.splice(i, 1,
        { name:base + '（左）', kind:'photo', url:two[0], text:'', at:f.at, done:1 },
        { name:base + '（右）', kind:'photo', url:two[1], text:'', at:f.at, done:1 });
      mk.files = mk.files.slice(0, MAX_FILES);
      toast('2つに分けました');
    }
  }catch(e){
    toast('できませんでした：' + e.message, true);
  }finally{
    mk.busy = ''; render();
  }
}
async function mkWarpApply(){
  var w = mk.warp, f = w && mk.files[w.i];
  if(!f || mk.busy) return;
  mk.busy = 'fix'; render();
  try{
    f.url = await imgWarp(f.url, w.quad);
    f.done = 1;
    mk.warp = null;
    toast('まっすぐにしました');
  }catch(e){
    toast('できませんでした：' + e.message, true);
  }finally{
    mk.busy = ''; render();
  }
}
function mkFilesText(){
  return mk.files.filter(function(f){ return f.text; })
    .map(function(f){ return '［' + f.name + '］\n' + f.text; }).join('\n\n');
}
function mkEmph(){
  var out = [];
  mk.files.forEach(function(f){ (f.emph || []).forEach(function(w){ if(out.indexOf(w) < 0) out.push(w); }); });
  return out;
}

/* ============================== AIへのたのみかた ============================== */
function mkPrompt(o){
  var names = { mc:'mc（4択）', tf:'tf（○×）', cloze:'cloze（穴うめ）', short:'short（記述）',
                order:'order（並べかえ）', match:'match（組み合わせ）' };
  var types = o.types.map(function(t){ return names[t] || t; }).join('、');
  var lvName = { 1:'基本（授業に出たことばの意味・正常値など）', 2:'ふつう（テストによく出るところ）',
                 3:'応用（理由を考えるもの・まちがえやすいところ）' }[o.lv] || 'ふつう';
  var p = 'あなたは看護学部1年生の授業の資料から、テスト対策の問題を作る先生です。\n' +
    '渡した資料（授業の写真・スライド・配布資料' + (o.av ? '・講義の録音や動画' : '') + '）を読んで、問題を' + o.n + '問作ってください。\n' +
    (o.av ? '・録音や動画は、先生が話した中身から作る。長いときは、大事なところ（定義・数値・手順・「ここ出す」と言ったところ）を選ぶ。\n' : '') +
    '・問題は次の種類から作る：' + types + '。指定された種類だけを使う。\n' +
    (o.both ? '・むずかしさは、半分を「基本」（lv=1）、半分を「応用」（lv=3）にする。\n' : '・むずかしさ：' + lvName + '\n') +
    '・資料に書いてあることだけから作る。書いていないことは作らない。読めない字は、むりに読まない。\n' +
    '・1問に1つのことだけ。問題文は短く、はっきり書く。\n' +
    (o.types.indexOf('mc') >= 0 ? '・mc（4択）は choices を4つ。正解は1つ。ほかの3つも、ありそうなまちがいにする。ans は正解の番号（1からかぞえる）。\n' : '') +
    (o.types.indexOf('tf') >= 0 ? '・tf（○×）は「〜である。」の形の文にして、answer に "○" か "×" を書く。choices は書かない。\n' : '') +
    (o.types.indexOf('cloze') >= 0 ? '・cloze（穴うめ）は、文の中の大事なことばを1つだけ（　）にして、answer にその答えを書く。\n' : '') +
    (o.types.indexOf('short') >= 0 ? '・short（記述）は、1〜2文で答えられる問い。answer に模範の答えを書く。alt に、同じ意味の別の言い方を2つまで。\n' : '') +
    (o.types.indexOf('order') >= 0 ? '・order（並べかえ）は、資料にある手順を steps に「正しい順」で3〜6つ書く。問題文は「正しい順にならべてください。」でよい。\n' : '') +
    (o.types.indexOf('match') >= 0 ? '・match（組み合わせ）は、pairs に [左, 右] の組を3〜4つ書く（用語と意味、検査と基準値 など）。\n' : '') +
    (o.two ? '・4択のうち2〜3割は「2つ選べ。」の問題にして、ans に正解を2つ入れる。\n' : '') +
    (o.style === 'case' ? '・できるだけ、患者さんの短い場面（年齢・症状・数値）から考えさせる事例問題にする。個人が特定できることは書かない。\n' : '') +
    (o.style === 'exam' ? '・定期テストに出そうな、用語・数値・理由をまっすぐ聞く形にする。\n' : '') +
    (o.kokushi ? '・看護師国家試験の言い回しに寄せる（「〜はどれか。」「〜で正しいのはどれか。」）。本物の過去問の文をそのまま写さない。\n' : '') +
    (o.en ? '・3割ほどは、英語の用語や略語（正式名）も問題に入れる。\n' : '') +
    '・exp（解説）は、正解の理由とまちがえやすい点を1〜2文で。\n' +
    '・tag は小見出し、ch はこの問題が入る章や単元の名前（分かるときだけ）。\n' +
    '・page は、その問題を作ったところ（「スライド3」「p.12」など。分かるときだけ）。\n' +
    '・患者さんや先生の名前など、個人がわかることは入れない。\n' +
    '・title は資料ぜんたいの見出し、summary は資料の要点を2〜3行で。\n';
  if(o.emph && o.emph.length) p += '・資料で太字・下線・色がついていたことば（大事なところ）：' + o.emph.slice(0, 20).join('、') + '\n';
  if(o.memo) p += '・先生が強調したところ（ここを重点的に）：' + String(o.memo).slice(0, 200) + '\n';
  if(o.confuse && o.confuse.length) p += '・まちがえやすい組み合わせ（ひっかけの選択肢のもとに使う）：' + o.confuse.join('、') + '\n';
  if(o.units && o.units.length) p += '・この科目の章の例（ch に使えるもの）：' + o.units.slice(0, 10).join('、') + '\n';
  if(o.have && o.have.length) p += '・次の問題とかぶらないように、別のところから作る：\n' + o.have.map(function(q){ return '　' + q; }).join('\n') + '\n';
  if(o.text) p += '\n［資料の字］\n' + String(o.text).slice(0, TEXT_SEND) + '\n';
  return p + '\nJSONだけで答える：{"title":"資料の見出し","summary":"要点","questions":[' +
    '{"type":"mc","q":"問題文","choices":["選択肢1","選択肢2","選択肢3","選択肢4"],"ans":[1],"answer":"","alt":[],"steps":[],"pairs":[],"exp":"解説","tag":"小見出し","ch":"単元","page":"スライド3","lv":2}]}';
}
/* AIの答えを、使える形にそろえる */
function mkCleanType(t){
  t = String(t || '').toLowerCase();
  if(/mc|choice|4|選/.test(t)) return 'mc';
  if(/tf|true|maru|○|×/.test(t)) return 'tf';
  if(/cloze|blank|穴/.test(t)) return 'cloze';
  if(/order|sort|並/.test(t)) return 'order';
  if(/match|pair|組/.test(t)) return 'match';
  if(/short|記述|free/.test(t)) return 'short';
  return 'mc';
}
function mkAnsNums(v){
  var arr = Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);
  var out = [];
  arr.forEach(function(x){
    var n = numOf(x);
    if(isFinite(n) && n >= 1 && n <= 10 && out.indexOf(n - 1) < 0) out.push(n - 1);
  });
  return out;
}
function mkCleanQs(arr, want, max){
  var seen = {}, out = [];
  (Array.isArray(arr) ? arr : []).forEach(function(x){
    if(!x || typeof x !== 'object') return;
    var qt = mkCleanType(x.type);
    if(want && want.length && want.indexOf(qt) < 0) return;
    var q = String(x.q || x.question || '').trim().slice(0, 500);
    if(!q) return;
    var o = { qt:qt, q:q, c:[], a:[], at:'', alt:[], pairs:[],
              exp:String(x.exp || x.explanation || '').trim().slice(0, 600),
              tag:String(x.tag || '').trim().slice(0, 40),
              ch:String(x.ch || x.unit || '').trim().slice(0, 40),
              pg:String(x.page || x.pg || '').trim().slice(0, 20),
              lv:clamp(toNum(x.lv) || 2, 1, 3) };
    var ansText = String(x.answer == null ? '' : x.answer).trim();
    if(qt === 'order'){
      var steps = (Array.isArray(x.steps) ? x.steps : Array.isArray(x.choices) ? x.choices : [])
        .map(function(t){ return String(t == null ? '' : t).trim().replace(/^\d+[\.\)．、]\s*/, '').slice(0, 120); })
        .filter(function(t, k, ar){ return t && ar.indexOf(t) === k; });
      if(steps.length < 3) return;
      o.c = steps.slice(0, 6);
    }else if(qt === 'match'){
      var pairs = (Array.isArray(x.pairs) ? x.pairs : []).map(function(pp){
        if(Array.isArray(pp)) return [String(pp[0] || '').trim().slice(0, 60), String(pp[1] || '').trim().slice(0, 80)];
        if(pp && typeof pp === 'object') return [String(pp.left || pp.l || '').trim().slice(0, 60), String(pp.right || pp.r || '').trim().slice(0, 80)];
        return ['', ''];
      }).filter(function(pp){ return pp[0] && pp[1]; });
      if(pairs.length < 2) return;
      o.pairs = pairs.slice(0, 5);
    }else if(qt === 'tf'){
      var yes = /^(○|◯|まる|正しい|true|はい|1)$/i.test(ansText);
      var no = /^(×|✕|ばつ|まちがい|誤|false|いいえ|2|0)$/i.test(ansText);
      if(!yes && !no){
        var nums = mkAnsNums(x.ans);
        if(nums.length !== 1) return;
        yes = nums[0] === 0;
      }
      o.c = ['○（正しい）', '×（まちがい）'];
      o.a = [yes ? 0 : 1];
    }else if(qt === 'mc'){
      var c = [];
      (Array.isArray(x.choices) ? x.choices : []).forEach(function(s){
        /* 「1.」「①」のような番号だけを外す（「12〜20回/分」の 1 は外さない） */
        var v = String(s == null ? '' : s).trim()
          .replace(/^[①-⑩]\s*/, '')
          .replace(/^[1-9１-９][\.\)．）、,:：]\s*/, '')
          .slice(0, 200);
        if(v && c.length < 6 && c.indexOf(v) < 0) c.push(v);
      });
      var a = mkAnsNums(x.ans).filter(function(i){ return i >= 0 && i < c.length; });
      if(!a.length && ansText){
        var hit = c.indexOf(ansText);
        if(hit >= 0) a = [hit];
      }
      if(c.length < 3 || !a.length) return;
      o.c = c; o.a = a;
    }else{
      if(!ansText) return;
      o.at = ansText.slice(0, 200);
      o.alt = (Array.isArray(x.alt) ? x.alt : []).map(function(s){ return String(s || '').trim().slice(0, 120); })
        .filter(Boolean).slice(0, 3);
    }
    var key = norm(o.q).slice(0, 40);
    if(seen[key]) return;
    seen[key] = 1;
    o.src = SRC_AI;
    out.push(o);
    });
  return out.slice(0, max || 30);
}
/* いま持っている問題の、はじめの28字（かぶり防止。長く送らないぶん、APIも軽い） */
function mkHave(subId, n){
  return qsOf(subId).slice(-40).map(function(q){ return String(q.q).slice(0, 28); }).slice(-(n || 12));
}
/* 資料の字の量から、ちょうどよい問題数を決める */
function mkAutoN(){
  var len = mkFilesText().length;
  var photos = mk.files.filter(function(f){
    return f.kind === 'photo' || f.kind === 'pdf' || f.kind === 'audio' || f.kind === 'video';
  }).length;
  var n = len ? clamp(Math.round(len / 350), 5, 20) : clamp(photos * 5, 5, 15);
  return n;
}

/* ============================== 作る ============================== */
async function mkRun(){
  if(mk.busy) return;
  var subId = mkSubId();
  if(!mk.files.length && !String(elVal('mk_paste') || '').trim()){
    toast('先に資料をえらぶか、文章をはりつけてください', true);
    return;
  }
  /* はりつけた文章も、1つの資料としてあつかう */
  var paste = String(elVal('mk_paste') || '').trim();
  if(paste && !mk.files.some(function(f){ return f.name === 'はりつけた文章'; })){
    mk.files.push({ name:'はりつけた文章', kind:'text', url:'', text:paste, sig:hash(paste.slice(0, 800)) });
  }
  var n = mk.opt.auto ? mkAutoN() : mk.opt.n;
  if(mk.opt.noai){ mkRunNoAi(n); return; }
  if(!aiReady()){
    toast('先に「設定」で、GeminiのAPIキーを入れてください（「AIを使わずに作る」なら、キーなしでも作れます）', true);
    return;
  }
  var text = mkFilesText();
  /* 字が取り出せた資料は、写真を送らない（送る量がへる＝APIが軽い） */
  var images = text ? [] : mk.files.filter(function(f){ return f.url; }).map(function(f){ return f.url; });
  var bigs = mk.files.filter(function(f){ return f.file && !f.ref; });
  var s = sub(subId);
  var o = {
    n:n, types:mk.opt.types.slice(), lv:mk.opt.lv, both:mk.opt.both, two:mk.opt.two,
    style:mk.opt.style, kokushi:mk.opt.kokushi, en:mk.opt.en,
    emph:mkEmph(), memo:mk.mat.memo || String(elVal('mk_memo') || ''),
    confuse:dConfuseIn(text).slice(0, 6), have:mkHave(subId, 12),
    units:s ? dUnitsFor(s.name).units : [], text:text,
    av:mk.files.some(function(f){ return f.kind === 'audio' || f.kind === 'video'; }) ? 1 : 0
  };
  mk.abort = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  mk.busy = 'make';
  mk.prog = { now:0, all:n, msg:'資料を読んでいます…' };
  render();
  try{
    /* 大きな資料（PDF・録音・動画）は、先にAIに預ける。少しずつ送るので、進みぐあいを出す */
    var refs = mk.files.filter(function(f){ return f.ref; }).map(function(f){ return f.ref; });
    for(var bi = 0; bi < bigs.length; bi++){
      var bf = bigs[bi], no = bigs.length > 1 ? '（' + (bi + 1) + '/' + bigs.length + '）' : '';
      mk.prog = { now:0, all:n, msg:'大きな資料を送っています' + no + '… 0%' };
      render();
      var ref = await aiUpload(bf.file, {
        signal:mk.abort ? mk.abort.signal : null,
        onProgress:function(pct){
          if(!mk.prog) return;
          mk.prog.msg = pct == null
            ? '大きな資料を送っています' + no + '…（大きいので、少し時間がかかります）'
            : '大きな資料を送っています' + no + '… ' + pct + '%' + (pct >= 100 ? '（AIが読んでいます）' : '');
          render();
        }
      });
      bf.ref = ref;
      refs.push(ref);
    }
    if(bigs.length){ mk.prog = { now:0, all:n, msg:'資料を読んでいます…' }; render(); }
    var j = await aiJson(mkPrompt(o), images, { tag:'mk', signal:mk.abort ? mk.abort.signal : null, maxTokens:8192, files:refs });
    var items = mkCleanQs(j && j.questions, mk.opt.types, n);
    if(!items.length) throw new Error('問題を作れませんでした。写真が読みにくいか、資料が短いのかもしれません');
    mk.pv = {
      sub:subId, title:String((j && j.title) || mk.mat.title || '授業の資料').slice(0, 60),
      summary:String((j && j.summary) || '').slice(0, 400),
      items:items, files:mk.files.slice(), nomat:0
    };
    mk.pend = null;
    toast(items.length + '問できました');
  }catch(e){
    if(mk.abort && mk.abort.signal && mk.abort.signal.aborted){
      toast('とちゅうでやめました');
    }else{
      mk.pend = { at:Date.now(), msg:e.message };
      toast(e.message, true);
    }
  }finally{
    mk.busy = ''; mk.prog = null; mk.abort = null;
    render(); try{ window.scrollTo(0, 0); }catch(e2){}
  }
}
function mkStop(){
  if(mk.abort) try{ mk.abort.abort(); }catch(e){}
  mk.busy = ''; mk.prog = null;
  render();
}
/* AIを使わずに、資料の字から作る */
function mkRunNoAi(n){
  var text = mkFilesText();
  if(!text){
    toast('字を取り出せる資料（スライド・Word・文章・はりつけ）が必要です。写真・録音・動画だけのときは、AIを使ってください', true);
    return;
  }
  var cloze = genFromText(text, Math.ceil(n * 0.6), { ch:mk.mat.no ? '第' + mk.mat.no + '回' : '' });
  var tf = genFromTextTf(text, n - cloze.length, { ch:mk.mat.no ? '第' + mk.mat.no + '回' : '' });
  var items = cloze.concat(tf);
  if(!items.length){
    toast('その場では作れませんでした（数字や用語のある文が見つかりません）', true);
    return;
  }
  aiSavedAdd(items.length);
  mk.pv = { sub:mkSubId(), title:mk.mat.title || '授業の資料', summary:'', items:items, files:mk.files.slice(), nomat:0 };
  toast(items.length + '問できました（AIは使っていません）');
  render(); try{ window.scrollTo(0, 0); }catch(e){}
}
/* 表から作る（AIなし・資料もいらない） */
function mkRunKit(){
  var kit = kitOf(mk.kit.id);
  var items = [];
  try{
    items = kit.make(mk.kit.n, { cat:mk.kit.cat, calcIds:mk.kit.calcIds, field:mk.kit.field, from:mk.kit.from }) || [];
  }catch(e){
    toast('作れませんでした：' + e.message, true);
    return 0;
  }
  if(!items.length){ toast('作れませんでした（もとになる表が見つかりません）', true); return 0; }
  aiSavedAdd(items.length);
  mk.pv = { sub:mkSubId(), title:kit.name, summary:'', items:items, nomat:1, files:[] };
  toast(items.length + '問できました（AIは使っていません）');
  render(); try{ window.scrollTo(0, 0); }catch(e){}
  return items.length;
}
/* 1問だけ作り直す */
async function mkRemake(i){
  var pv = mk.pv, it = pv && pv.items[i];
  if(!it || mk.busy) return;
  if(!aiReady()){ toast('作り直しにはAIを使います。設定でAPIキーを入れてください', true); return; }
  mk.busy = 'remake'; render();
  try{
    var p = '次の問題を、同じ資料の範囲で、別の聞き方に作り直してください。答えが変わってもかまいません。\n' +
      '［いまの問題］' + it.q + '\n［種類］' + it.qt + '\n' +
      (pv.summary ? '［資料の要点］' + pv.summary + '\n' : '') +
      'JSONだけで答える：{"questions":[{"type":"' + it.qt + '","q":"","choices":[],"ans":[1],"answer":"","steps":[],"pairs":[],"exp":"","lv":2}]}';
    var j = await aiJson(p, [], { tag:'remake', maxTokens:2048 });
    var got = mkCleanQs(j && j.questions, [it.qt], 1);
    if(!got.length) throw new Error('作り直せませんでした');
    got[0].ch = it.ch; got[0].tag = it.tag;
    pv.items[i] = got[0];
    toast('作り直しました');
  }catch(e){
    toast(e.message, true);
  }finally{
    mk.busy = ''; render();
  }
}
/* 下書きを、本番に入れる */
async function mkAdd(){
  var pv = mk.pv;
  if(!pv) return;
  var subId = pv.sub || '';
  var matId = '';
  if(!pv.nomat){
    var photos = [];
    var files = pv.files || [];
    for(var i = 0; i < files.length; i++){
      if(files[i].kind === 'photo' && files[i].url){
        var pid = uid('ph');
        try{ await photoPut(pid, files[i].url); photos.push(pid); }catch(e){}
      }
    }
    var text = (files.filter(function(f){ return f.text; }).map(function(f){ return f.text; }).join('\n\n'));
    var m = {
      id:uid('mat'), mt:Date.now(), sub:subId,
      title:String(pv.title || '授業の資料').slice(0, 60),
      kind:(files[0] && files[0].kind) || 'text',
      at:mk.mat.at || String(elVal('mk_at') || '') || today(),
      no:String(mk.mat.no || elVal('mk_no') || '').slice(0, 4),
      memo:String(mk.mat.memo || elVal('mk_memo') || '').slice(0, 200),
      sig:(files[0] && files[0].sig) || '',
      photos:photos, text:text.slice(0, TEXT_KEEP), cut:text.length > TEXT_KEEP ? 1 : 0,
      summary:pv.summary || '', n:0
    };
    S.mats.push(m);
    matId = m.id;
  }
  var n = 0;
  pv.items.forEach(function(it){
    var q = qAdd(it, subId, matId);
    if(q) n++;
  });
  if(matId){ var mm = mat(matId); if(mm) mm.n = n; }
  if(subId){ S.ui.lastSub = subId; }
  mk.pv = null;
  mk.files = [];
  mk.mat = { no:'', memo:'', at:'', title:'' };
  inClear('mk_');
  saveNow();
  toast(n + '問を「' + (subId ? subName(subId) : '科目なし') + '」に入れました');
  go('drill');
}
function mkDrop(i){
  if(!mk.pv) return;
  mk.pv.items.splice(i, 1);
  if(!mk.pv.items.length) mk.pv = null;
  render();
}

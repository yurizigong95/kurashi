/* もんだいメーカー：「つくる」タブ
   ・資料（写真・PDF・スライド・Word・文章・ZIP）から、AIに問題を作ってもらう
   ・AIを使わずに作る（資料の字から／組みこみの表から）
   ・できた問題は、いったん下書きで見せて、よければ科目に入れる */

/* 作る問題の数・種類（two は「2つ選べ」。答えの形は4択と同じ）・テストのふう */
var MK_NS = [20, 30, 40, 50];
var MK_TYPES = [['tf', '○×'], ['mc', '4択'], ['cloze', '穴うめ'], ['short', '記述'],
                ['order', '並べかえ'], ['match', '組み合わせ'], ['two', '2つ選べ']];
var MK_FORMS = [
  ['kokushi', '国試ふう', '看護師国家試験の形（「〜はどれか。」・4択は4つ、「2つ選べ」は5つから）。状況設定（患者さんの場面）も入ります。'],
  ['quiz', '小テストふう', '授業のあとの小テストの形。大事なことば・定義・数値を、短くまっすぐ聞きます。'],
  ['exam', '定期テストふう', '学期末の筆記試験の形。資料全体からかたよらずに、ことば・数値・理由・手順を聞きます。']
];
/* はじめの作り方：20問・種類はぜんぶ・ふつう・定期テストふう */
function mkOptDefault(){
  return { n:MK_NS[0], types:MK_TYPES.map(function(t){ return t[0]; }), lv:2, form:'exam', cas:0, en:0, both:0, noai:0 };
}
var mk = {
  mode:'file',                 /* file … 資料から／kit … 表から（AIなし） */
  files:[], busy:'', pv:null, prog:null, abort:null, warp:null, more:0,
  mat:{ title:'', auto:'' },    /* title … 自分でつけた名前／auto … ファイル・リンクの名前（からのときに使う） */
  fd:'',                        /* 資料を入れるフォルダ */
  opt:mkOptDefault(),
  kit:{ id:'lab', n:20, cat:'', calcIds:[], field:'', from:'' },
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
    var files = Array.prototype.slice.call(inp.files || []);   /* 多すぎるときは、mkTake が知らせる */
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
    /* 入りきらないぶんは、読む前に外す（たくさんえらんでも、重くならないように） */
    var room = Math.max(0, MAX_FILES - mk.files.length), over = Math.max(0, files.length - room);
    var loaded = await loadFiles(files.slice(0, room));
    var all = dupMark(mk.files.concat(loaded));
    over += Math.max(0, all.length - MAX_FILES);                 /* ZIP の中身で、こえたとき */
    mk.files = all.slice(0, MAX_FILES);
    if(!mk.mat.auto && mk.files[0]) mk.mat.auto = String(mk.files[0].name).replace(/\.[a-z0-9]+$/i, '').slice(0, 60);
    if(over) toast(Math.max(0, loaded.length - Math.max(0, all.length - MAX_FILES)) + 'つ読みこみました。1回に使える資料は' + MAX_FILES + 'こまでなので、' + over + 'つは入れませんでした', true);
    else if(!quiet) toast(loaded.length + 'つ読みこみました');
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
  var two = o.types.indexOf('two') >= 0, mc = o.types.indexOf('mc') >= 0;
  var ai = o.types.filter(function(t){ return t !== 'two'; });
  if(two && !mc) ai.push('mc');
  var types = ai.map(function(t){ return (t === 'mc' && !mc) ? 'mc（「2つ選べ」だけ）' : (names[t] || t); }).join('、');
  var has = function(t){ return ai.indexOf(t) >= 0; };
  var lvName = { 1:'基本（授業に出たことばの意味・正常値・名前など、覚えているかを聞く）',
                 2:'ふつう（テストによく出るところを、ことばと理由の両方から聞く）',
                 3:'応用（なぜそうするか・患者さんの場面でどう考えるか・まちがえやすいところを聞く）' }[o.lv] || 'ふつう';
  var form = {
    kokushi:'・看護師国家試験（国試）ふうにする。問題文は「〜はどれか。」「〜で正しいのはどれか。」「〜で適切なのはどれか。」の形。' +
      '2〜3割は、患者さんの短い場面（年齢・症状・検査の数値）から考える状況設定問題にする。本物の過去問の文をそのまま写さない。\n',
    quiz:'・授業のあとの小テストふうにする。その資料の大事なことば・定義・数値を、まっすぐ短く聞く。1問を30秒くらいで答えられる長さにする。\n',
    exam:'・大学の定期テスト（学期末の筆記試験）ふうにする。資料全体からかたよらずに出し、ことば・数値だけでなく、理由・くらべる・手順も聞く。\n'
  }[o.form] || '';
  var p = 'あなたは看護学部1年生の授業の資料から、テスト対策の問題を作る先生です。\n' +
    '渡した資料（授業の写真・スライド・配布資料' + (o.av ? '・講義の録音や動画' : '') + '）を読んで、問題を' + o.n + '問作ってください。\n' +
    '・できるだけ' + o.n + '問そろえる。同じことを、別の種類や別の角度から聞くのはよい。ただし、資料に書いていないことは作らない。\n' +
    (o.av ? '・録音や動画は、先生が話した中身から作る。長いときは、大事なところ（定義・数値・手順・「ここ出す」と言ったところ）を選ぶ。\n' : '') +
    '・問題は次の種類から作る：' + types + '。指定された種類だけを使い、なるべくまんべんなく使う。\n' +
    (has('order') || has('match') ? '・資料に手順がなければ並べかえは、組にできることばがなければ組み合わせは、むりに作らずにほかの種類にする。\n' : '') +
    form +
    (o.both ? '・むずかしさは、半分を「基本」（lv=1）、半分を「応用」（lv=3）にする。\n' : '・むずかしさ：' + lvName + '\n') +
    '・資料に書いてあることだけから作る。書いていないことは作らない。読めない字は、むりに読まない。\n' +
    '・1問に1つのことだけ。問題文は短く、はっきり書く。\n' +
    (mc ? '・mc（4択）は choices を4つ。正解は1つ。ほかの3つも、ありそうなまちがいにする。ans は正解の番号（1からかぞえる）。\n' : '') +
    (two ? (mc ? '・mc のうち3割ほどは「2つ選べ。」の問題にする。' : '・mc はすべて「2つ選べ。」の問題にする。') +
      '問題文の終わりに「2つ選べ。」と書き、choices を5つ、ans に正解を2つ入れる。\n' : '') +
    (has('tf') ? '・tf（○×）は「〜である。」の形の文にして、answer に "○" か "×" を書く。choices は書かない。○と×がかたよらないようにする。\n' : '') +
    (has('cloze') ? '・cloze（穴うめ）は、文の中の大事なことばを1つだけ（　）にして、answer にその答えを書く。\n' : '') +
    (has('short') ? '・short（記述）は、' + (o.form === 'exam' ? '「〜について説明しなさい。」の形で、2〜3文で' : '1〜2文で') +
      '答えられる問い。answer に模範の答えを書く。alt に、同じ意味の別の言い方を2つまで。\n' : '') +
    (has('order') ? '・order（並べかえ）は、資料にある手順を steps に「正しい順」で3〜6つ書く。問題文は「正しい順にならべてください。」でよい。\n' : '') +
    (has('match') ? '・match（組み合わせ）は、pairs に [左, 右] の組を3〜4つ書く（用語と意味、検査と基準値 など）。\n' : '') +
    (o.cas ? '・事例をふやす：できるだけ、患者さんの短い場面（年齢・症状・数値）から考えさせる事例問題にする。個人が特定できることは書かない。\n' : '') +
    (o.en ? '・3割ほどは、英語の用語や略語（正式名）も問題に入れる。\n' : '') +
    '・exp（解説）は、正解の理由とまちがえやすい点を1〜2文で。\n' +
    '・tag は小見出し（分かるときだけ）。\n' +
    '・page は、その問題を作ったところ（「スライド3」「p.12」など。分かるときだけ）。\n' +
    '・患者さんや先生の名前など、個人がわかることは入れない。\n' +
    '・title は資料ぜんたいの見出し、summary は資料の要点を2〜3行で。\n';
  if(o.emph && o.emph.length) p += '・資料で太字・下線・色がついていたことば（大事なところ）：' + o.emph.slice(0, 20).join('、') + '\n';
  if(o.confuse && o.confuse.length) p += '・まちがえやすい組み合わせ（ひっかけの選択肢のもとに使う）：' + o.confuse.join('、') + '\n';
  if(o.have && o.have.length) p += '・次の問題とかぶらないように、別のところから作る（すでにある問題）：\n' + o.have.map(function(q){ return '　' + q; }).join('\n') + '\n';
  if(o.text) p += '\n［資料の字］\n' + String(o.text).slice(0, TEXT_SEND) + '\n';
  return p + '\nJSONだけで答える：{"title":"資料の見出し","summary":"要点","questions":[' +
    '{"type":"mc","q":"問題文","choices":["選択肢1","選択肢2","選択肢3","選択肢4"],"ans":[1],"answer":"","alt":[],"steps":[],"pairs":[],"exp":"解説","tag":"小見出し","page":"スライド3","lv":2}]}';
}
/* 答えの長さ：問題の数に合わせてふやす（考える分も数えられるので、多めに） */
function mkMaxTokens(n){ return Math.min(65536, 4000 + toNum(n) * 700); }
/* えらんだ種類にそろえる（「2つ選べ」だけのときは、答えが1つの4択は入れない） */
function mkKeepTypes(items, types){
  var mc = types.indexOf('mc') >= 0, two = types.indexOf('two') >= 0;
  return items.filter(function(it){
    if(it.qt !== 'mc') return true;
    var multi = (it.a || []).length > 1;
    return multi ? (two || mc) : mc;
  });
}
/* AIの種類の名前（two は mc として受けとる） */
function mkAiTypes(types){
  var out = types.filter(function(t){ return t !== 'two'; });
  if(types.indexOf('two') >= 0 && out.indexOf('mc') < 0) out.push('mc');
  return out;
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

/* ============================== リンクから ============================== */
/* リンク（いくつでも）を読んで、資料に入れる。読めなかったリンクを返す */
async function mkReadLinks(urls){
  if(mk.busy) return urls;
  /* Goodnotesの共有リンクは、中身をリンクから読めないので、ドライブの自動バックアップからえらんでもらう */
  var gns = (urls || []).filter(function(u){ return typeof gnIsLink === 'function' && gnIsLink(u); });
  if(gns.length){
    urls = urls.filter(function(u){ return gns.indexOf(u) < 0; });
    gnOpen(gns[0]);
    if(!urls.length){ toast('Goodnotesのノートは、下の一覧からえらんでください'); return []; }
  }
  urls = (urls || []).filter(function(u){
    var yt = linkYouTube(u);
    return !mk.files.some(function(f){ return f.link === u || (yt && f.yt && linkYouTube(f.link) === yt); });
  });
  var room = MAX_FILES - mk.files.length;
  mk.linkFails = [];
  if(!urls.length){ toast('新しいリンクがありません'); return []; }
  if(room <= 0){ toast('1回に使える資料は' + MAX_FILES + 'こまでです', true); return urls; }
  var skip = urls.slice(room);
  if(skip.length) toast('1回に使える資料は' + MAX_FILES + 'こまでなので、' + skip.length + 'つは入れませんでした', true);
  urls = urls.slice(0, room);
  mk.busy = 'read'; mk.linkMsg = 'リンクを読んでいます…（0/' + urls.length + '）'; render();
  var got = [], left = [], fails = [];
  try{
    /* ① この端末から、そのまま読む */
    for(var i = 0; i < urls.length; i++){
      mk.linkMsg = 'リンクを読んでいます…（' + (i + 1) + '/' + urls.length + '）'; render();
      var o = null;
      try{ o = await loadLinkDirect(urls[i]); }catch(e){ o = null; }      /* 1つ読めなくても、ほかは続ける */
      if(o) got.push(o); else left.push(urls[i]);
    }
    /* ② 読めなかったものは、くらしの手帳の橋わたし（Googleのサーバー）から読む。ドライブのファイルも読める */
    if(left.length && gnGas() && linkBridgeReady()){
      var left2 = [], down = false;
      for(var bi = 0; bi < left.length; bi++){
        if(down && !linkExportUrl(left[bi])){ left2.push(left[bi]); continue; }   /* 橋わたしに届かない：AIにまかせる */
        if(down){ fails.push({ u:left[bi], why:down }); continue; }
        mk.linkMsg = 'Google連携（橋わたし）から読んでいます…（' + (bi + 1) + '/' + left.length + '）'; render();
        var b = null;
        try{ b = await loadLinkBridge(left[bi], function(p){ mk.linkMsg = 'Google連携（橋わたし）から読んでいます…（' + (bi + 1) + '/' + left.length + '） ' + p + '%'; render(); }); }
        catch(e){ b = { fail:1, why:String((e && e.message) || e).slice(0, 120) }; }
        if(b && b.down) down = b.why;
        if(b && !b.fail) got.push(b);
        else if(b && b.fail && b.drive) fails.push({ u:left[bi], why:b.why });     /* 自分のドライブのファイル：AIには見られないので、ここでわけを出す */
        else left2.push(left[bi]);
      }
      left = left2;
    }
    /* ③ まだ読めないものは、AIがページを開いて読む */
    if(left.length){
      if(aiReady()){
        var res = await loadLinksAi(left, { onStep:function(k, n){ mk.linkMsg = 'AIがページを開いて読んでいます…（' + (k + 1) + '/' + n + '）'; render(); } });
        res.forEach(function(o){
          if(!o.fail){ got.push(o); return; }
          var why = (!o.err && linkNeedsLogin(o.link)) ? 'ログインが必要なページは読めません' : o.why;
          /* ドライブのファイル：Google連携（橋わたし）がないと、自分のファイルは読めない */
          if(linkExportUrl(o.link)){
            why += !gnGas() ? '（自分のドライブのファイルは、くらしの手帳の「Google連携」をつなぐと読めます）'
              : gasOld() ? '（自分のドライブのファイルは、橋わたしを新しい版にすると読めます。' + GAS_UPDATE_HOW + '）' : '';
          }
          fails.push({ u:o.link, why:why });
        });
      }else{
        left.forEach(function(u){ fails.push({ u:u, why:'このページはAIでないと読めません（設定か、くらしの手帳でAPIキーを入れてください）' }); });
      }
    }
    var order = {};
    urls.forEach(function(u, k){ order[u] = k; });
    got.sort(function(a, b){ return order[a.link] - order[b.link]; });
    mk.files = dupMark(mk.files.concat(got)).slice(0, MAX_FILES);
    if(!mk.mat.auto && got[0] && got[0].kind === 'link') mk.mat.auto = got[0].name;
    mk.linkFails = fails;
    if(fails.length){
      toast((got.length ? got.length + 'つ読めました。' : '') + fails.length + 'つのリンクを読めませんでした：' + fails[0].why, true);
    }else if(got.length){
      toast(got.length + 'つのリンクを読みました');
    }
  }finally{
    mk.busy = ''; mk.linkMsg = '';
    render();
  }
  return fails.map(function(f){ return f.u; }).concat(skip);
}
/* 入れてあるリンク（リンクの欄・はりつけの欄）を読む。「問題をつくる」をおしたときにも使う */
async function mkReadPending(){
  var box = String(elVal('mk_links') || ''), paste = String(elVal('mk_paste') || '').trim();
  var urls = linkList(box), fromPaste = linkMostly(paste);
  if(fromPaste){ urls = urls.concat(linkList(paste).filter(function(u){ return urls.indexOf(u) < 0; })); }
  urls = urls.filter(function(u){ return !mk.files.some(function(f){ return f.link === u; }); });
  if(!urls.length) return { read:0 };
  if(fromPaste){ inSet('mk_paste', ''); INP.mk_paste = ''; }
  var gnN = urls.filter(function(u){ return typeof gnIsLink === 'function' && gnIsLink(u); }).length;
  var left = await mkReadLinks(urls);
  inSet('mk_links', left.join('\n')); INP.mk_links = left.join('\n');   /* 読めなかったものだけ、リンクの欄にのこす */
  render();
  return { read:urls.length, left:left.length, fromPaste:fromPaste, gn:gnN };
}

/* ============================== 作る ============================== */
var mkRunSeq = 0;
async function mkRun(){
  if(mk.busy) return;
  var subId = mkSubId();
  /* リンクの欄に入れたまま（「リンクを読む」をおさずに）作るときも、先に読む。
     はりつけの欄が、リンクだけ・「題＋リンク」（スマホの共有）のときも、リンクとして読む */
  var pend = await mkReadPending();
  var fromLinks = pend.read > 0;
  if(mk.busy) return;
  if(pend.gn && !mk.files.length) return;                   /* Goodnotesのノートを、えらんでもらってから作る */
  var paste = String(elVal('mk_paste') || '').trim();
  /* はりつけた文章も、1つの資料としてあつかう（毎回いまの文に入れかえる。直した文が使われるように） */
  mk.files = mk.files.filter(function(f){ return !f.paste; });
  if(paste) mk.files.push({ name:'はりつけた文章', kind:'text', url:'', text:paste, sig:hash(paste.slice(0, 800)), paste:1 });
  if(!mk.files.length){
    if(!fromLinks) toast('先に資料をえらぶか、文章やリンクをはりつけてください', true);
    return;
  }
  var n = MK_NS.indexOf(toNum(mk.opt.n)) >= 0 ? toNum(mk.opt.n) : MK_NS[0];
  if(mk.opt.noai){ mkRunNoAi(n); return; }
  /* 大きすぎる・きょうの無料のめやすを使いきった ときは、一度だけ聞く */
  var est = estAll(mk.files), lim = aiLim(), used = aiUse();
  var tooBig = est.tok > toNum(lim.ctx), noLeft = toNum(used.req) >= toNum(lim.rpd);
  if((tooBig || noLeft) && mk.okBig !== mkEstKey(est)){
    mk.okBig = mkEstKey(est);
    toast(tooBig
      ? '資料が大きいかもしれません（AIが読む量のめやす 約' + aiTokText(est.tok) + 'トークン）。それでも作るなら、もう一度おしてください'
      : 'きょうは無料のめやす（' + toNum(lim.rpd) + '回）を使いきっています。それでも作るなら、もう一度おしてください', true);
    render();
    return;
  }
  if(!aiReady()){
    toast('先に「設定」か、くらしの手帳の設定で、GeminiのAPIキーを入れてください（「AIを使わずに作る」なら、キーなしでも作れます）', true);
    return;
  }
  var text = mkFilesText();
  /* 写真・PDF は、ほかに字の資料があっても送る（字を取り出した資料は、字だけ送る＝APIが軽い）。
     1回にくっつけて送れる量をこえるぶんは、大きいものから「預ける」ほうに回す */
  var inl = mk.files.filter(function(f){ return f.url && !f.text && !f.ref; });
  var over = mkOverInline(inl);
  var images = inl.filter(function(f){ return over.indexOf(f) < 0; }).map(function(f){ return f.url; });
  var bigs = mk.files.filter(function(f){ return f.file && !f.ref; })
    .concat(over.map(function(f){ return { name:f.name, src:f, file:dataUrlBlob(f.url, f.name) }; }));
  var o = {
    n:n, types:mk.opt.types.slice(), lv:mk.opt.lv, both:mk.opt.both,
    form:mk.opt.form, cas:mk.opt.cas, en:mk.opt.en,
    emph:mkEmph(), confuse:dConfuseIn(text).slice(0, 6), have:mkHave(subId, 12), text:text,
    av:mk.files.some(function(f){ return f.kind === 'audio' || f.kind === 'video'; }) ? 1 : 0
  };
  var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null, run = ++mkRunSeq;
  var mine = function(){ return run === mkRunSeq && !(ctl && ctl.signal.aborted); };   /* 「やめる」のあと、別の作るが始まっていない */
  mk.abort = ctl;
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
        signal:ctl ? ctl.signal : null,
        onProgress:function(pct){
          if(!mk.prog || !mine()) return;
          mk.prog.msg = pct == null
            ? '大きな資料を送っています' + no + '…（大きいので、少し時間がかかります）'
            : '大きな資料を送っています' + no + '… ' + pct + '%' + (pct >= 100 ? '（AIが読んでいます）' : '');
          render();
        }
      });
      if(!mine()) return;
      (bf.src || bf).ref = ref;
      refs.push(ref);
    }
    if(bigs.length){ mk.prog = { now:0, all:n, msg:'資料を読んでいます…' }; render(); }
    var j = await aiJson(mkPrompt(o), images, { tag:'mk', signal:ctl ? ctl.signal : null, maxTokens:mkMaxTokens(n), files:refs });
    if(!mine()) return;
    var items = mkKeepTypes(mkCleanQs(j && j.questions, mkAiTypes(o.types), n), o.types);
    if(!items.length) throw new Error('問題を作れませんでした。写真が読みにくいか、資料が短いのかもしれません');
    mk.pv = {
      sub:subId, title:String(mk.mat.title || (j && j.title) || mk.mat.auto || '授業の資料').slice(0, 60),
      summary:String((j && j.summary) || '').slice(0, 400),
      items:items, files:mk.files.slice(), nomat:0
    };
    INP.mk_title = mk.pv.title;
    mk.pend = null;
    mk.okBig = '';
    toast(items.length + '問できました' + (items.length < n ? '（' + n + '問にとどきませんでした。資料が短いのかもしれません）' : ''), items.length < n);
  }catch(e){
    if(ctl && ctl.signal.aborted){
      /* 「やめる」で止めた（知らせは mkStop が出す） */
    }else if(run === mkRunSeq){
      mk.pend = { at:Date.now(), msg:e.message };
      toast(e.message, true);
    }
  }finally{
    /* 「やめる」のあとに新しく始めたぶんの、じゃまをしない */
    if(run === mkRunSeq){
      mk.busy = ''; mk.prog = null; mk.abort = null;
      render(); try{ window.scrollTo(0, 0); }catch(e2){}
    }
  }
}
/* くっつけて送る量が多すぎるとき、預けるほうに回すもの（大きいものから） */
var INLINE_TOTAL = 18 * 1024 * 1024;     /* data: の字の数で数える（1回の送信は20MBまで） */
function mkOverInline(list){
  var total = 0, out = [];
  list.forEach(function(f){ total += String(f.url).length; });
  if(total <= INLINE_TOTAL) return out;
  list.slice().sort(function(a, b){ return String(b.url).length - String(a.url).length; }).forEach(function(f){
    if(total <= INLINE_TOTAL) return;
    total -= String(f.url).length;
    out.push(f);
  });
  return out;
}
/* 「それでも作る」を1回だけにするための、いまの資料のしるし */
function mkEstKey(e){ return mk.files.length + ':' + (e ? e.tok : 0); }
function mkStop(){
  if(mk.abort) try{ mk.abort.abort(); }catch(e){}
  var was = mk.busy === 'make';
  mkRunSeq++;                              /* とちゅうの作るは、もう画面をさわらない */
  mk.busy = ''; mk.prog = null; mk.abort = null;
  if(was) toast('とちゅうでやめました');
  render();
}
/* AIを使わずに、資料の字から作る */
function mkRunNoAi(n){
  var text = mkFilesText();
  if(!text){
    toast('字を取り出せる資料（スライド・Word・文章・はりつけ）が必要です。写真・録音・動画だけのときは、AIを使ってください', true);
    return;
  }
  var cloze = genFromText(text, Math.ceil(n * 0.6), { ch:'' });
  var tf = genFromTextTf(text, n - cloze.length, { ch:'' });
  var items = cloze.concat(tf);
  if(!items.length){
    toast('その場では作れませんでした（数字や用語のある文が見つかりません）', true);
    return;
  }
  aiSavedAdd(items.length);
  mk.pv = { sub:mkSubId(), title:String(mk.mat.title || mk.mat.auto || '授業の資料').slice(0, 60), summary:'', items:items, files:mk.files.slice(), nomat:0 };
  INP.mk_title = mk.pv.title;
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
  if(subId && (!sub(subId) || sub(subId).arch)) subId = mkSubId();     /* 作っているあいだに、その科目を消した・しまった */
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
      fd:(subId && fdGet(subId, mk.fd)) ? mk.fd : '',
      title:String(String(elVal('mk_title') || '').trim() || pv.title || '授業の資料').slice(0, 60),
      kind:(files[0] && files[0].kind) || 'text',
      sig:(files[0] && files[0].sig) || '',
      links:files.filter(function(f){ return f.link; }).map(function(f){ return String(f.link).slice(0, 500); }).slice(0, MAX_FILES),
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
  mk.linkFails = [];
  mk.mat = { title:'', auto:'' };
  mk.fd = '';
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

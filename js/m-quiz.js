/* くらしの手帳：授業の資料から問題を作って解く（科目ごと） */
/* ============================== このファイルの中身 ==============================
   授業の写真・スライド（.pptx）・講義ファイル（PDF・Word・テキスト）から、AIが問題を作る。
   作った問題は「科目」ごとにしまわれ、忘れにくい順にくり返し解ける。
   「勉強」タブに道具を3つ足す。
   ・qz-make  … 資料から問題を作る（写真・PDF・スライド・文章）
   ・qz-drill … 作った問題を解く（科目ごと・まちがい直し・星をつけたもの）
   ・qz-lib   … 科目と資料の整理（科目の追加・名前を変える・並べ替え・資料と問題の一覧）

   データの形（どれも S.kmItems に入れて、ほかの端末と同期する。mod は 'quiz'）
   ・type:'subject' … { id, mt, mod, type, name, icon, ord, link:'時間割の科目名', arch:0/1 }
                      ord … 並べ替えの順番（小さいほど上）
   ・type:'mat'     … { id, mt, mod, type, sub:科目id, title, kind:'photo'|'pdf'|'slide'|'text',
                        at:'YYYY-MM-DD', photos:[写真id], text:'資料から取り出した字', cut:1（字が長くて切ったとき）, n:作った問題数 }
   ・type:'q'       … { id, mt, mod, type, sub:科目id, mat:資料id, qt:'mc'|'tf'|'cloze'|'short',
                        q:'問題文', c:[選択肢], a:[正解の番号（0から）], at:'答えの文', alt:[別の言い方],
                        exp:'解説', src:'出典', lv:1〜3, tag:'小見出し', star:0/1 }
   ・答えた記録は S.kmData（キーごとに同期される）
     'quiz:log:<問題id>' → { n, ok, miss, res, box:0〜6（正解がつづいた回数）, due:'次に出す日', last:'最後に解いた日', mt }
     'quiz:day:YYYY-MM-DD|端末id' → { n, ok, mt }（その日に解いた数。2台で解いても消えないよう端末ごと）
   ・S.ui.quiz … { today:0/1（今日タブに出す。はじめは出す）, notify:0/1（夜に復習を知らせる） } */

var QZ_MOD = 'quiz';
var QZ_TYPES = [['mc', '4択', '選択肢からえらぶ'], ['tf', '○×', '正しいかどうか'],
                ['cloze', '穴うめ', '（　）に入ることば'], ['short', '記述', '1〜2文で答える'],
                ['order', '並べかえ', '手順を正しい順に'], ['match', '組み合わせ', '左と右をむすぶ'],
                ['calc', '計算', '数で答える']];
/* 選んだところをえらべる種類（AIに作ってもらえるもの） */
var QZ_AI_TYPES = ['mc', 'tf', 'cloze', 'short', 'order', 'match'];
var QZ_IVL = [1, 3, 7, 14, 30, 60];          /* 正解がつづくと、次に出すまでの日をのばす（まちがえたら次の日） */
var QZ_NUM = ['①', '②', '③', '④', '⑤', '⑥'];
var QZ_ICONS = ['📘', '🫀', '🧠', '💊', '🩺', '🦴', '🧪', '🧬', '👶', '🤰', '🧓', '🏥', '🌏', '⚖️', '🍚', '💬', '📗', '📙', '📕', '📓'];
var QZ_MAX_FILES = 6;                        /* 1回に読みこむ資料の数 */
var QZ_MAX_Q = 20;                           /* 1回に作る問題の数の上限 */
var QZ_TEXT_KEEP = 6000;                     /* 資料に残しておく字の数 */
var QZ_TEXT_SEND = 24000;                    /* AIに送る字の数 */
var QZ_PDF_MAX = 15 * 1024 * 1024;
var QZ_DOC_MAX = 25 * 1024 * 1024;           /* スライド・Wordの大きさの上限 */
var QZ_TXT_MAX = 5 * 1024 * 1024;            /* 文章のファイルの大きさの上限 */
var QZ_SRC_AI = 'AIが資料から作成（教科書・先生の資料で確かめて）';
var QZ_WARN = '⚠️ 実習記録など、<b>患者さんの情報が書いてある資料は読みこまないでください</b>。AI（Gemini）に送られます。';

var qzState = {
  sub:'',                    /* えらんでいる科目 */
  inp:{},                    /* 入力中の字（画面を描き直しても消えないように） */
  files:[],                  /* えらんだ資料（追加するまでは、この画面の中だけ） */
  busy:'', pv:null,          /* AIが作っているところ・できた問題の下書き */
  run:null,                  /* 解いているとき */
  libTab:'sub', matOpen:'', subEdit:'', delAsk:'', qEdit:'', drillMode:'due', drillN:10, modePicked:0,
  mk:{ n:10, auto:1, types:['mc', 'tf', 'cloze'], lv:2, style:'', kokushi:0, en:0, two:0, both:0, anki:0, noai:0 },
  /* 作るときの決めごと（数・自動で決める・種類・むずかしさ・事例/国試ふう/英語/2つ選べ/2通り/暗記カード/AIなし） */
  mat:{ no:'', memo:'', at:'' },   /* 資料につける「第◯回」「メモ」「日付」 */
  warp:null,                       /* 写真をまっすぐにするとき { i, quad } */
  more:0, prog:null, abort:null, picks:null   /* くわしい設定・進みぐあい・止める・ノートえらび */
};

/* ============================== 共通の道具 ============================== */
function qzCfg(){ var c = S.ui && S.ui.quiz; return (c && typeof c === 'object') ? c : {}; }
function qzCfgSet(o){ S.ui.quiz = Object.assign({}, qzCfg(), o); touch('ui'); }
function qzRender(){ if(typeof isTyping === 'function' && isTyping()) renderLater(); else render(); }
function qzIn(id, def){ var v = qzState.inp[id]; return v == null ? (def == null ? '' : def) : v; }
function qzV(id){
  var e = document.getElementById(id);
  if(e) return e.type === 'checkbox' ? e.checked : e.value;
  return qzIn(id);
}
function qzClearIn(prefix){ Object.keys(qzState.inp).forEach(function(k){ if(k.indexOf(prefix) === 0) delete qzState.inp[k]; }); }
function qzClearForm(ids){
  ids.forEach(function(id){
    delete qzState.inp[id];
    var e = document.getElementById(id);
    if(e){ if(e.type === 'checkbox') e.checked = false; else e.value = ''; }
  });
}
function qzGo(tool){ appId = 'study'; studyTool = tool; render(); window.scrollTo(0, 0); }
/* さがすための形（全角→半角・カタカナ→ひらがな・記号をとる） */
function qzNorm(s){
  s = String(s == null ? '' : s);
  try{ s = s.normalize('NFKC'); }catch(e){}
  s = s.toLowerCase().replace(/[ァ-ヶ]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  return s.replace(/[\s・･\-‐－―—_\/／\.．,，、。\(\)（）「」『』【】\[\]]/g, '');
}
function qzShuffle(a){
  for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
  return a;
}
function qzMd(ymd){
  if(!isYmd(ymd)) return '';
  var a = ymd.split('-');
  return (+a[1]) + '/' + (+a[2]);
}
function qzTypeName(qt){
  for(var i = 0; i < QZ_TYPES.length; i++) if(QZ_TYPES[i][0] === qt) return QZ_TYPES[i][1];
  return '問題';
}
function qzStat(label, v){ return '<div class="stat"><div class="s">' + esc(label) + '</div><div class="v num">' + esc(v) + '</div></div>'; }

/* ============================== データ（科目・資料・問題） ============================== */
function qzAll(){
  return (Array.isArray(S.kmItems) ? S.kmItems : []).filter(function(x){ return x && x.id && x.mod === QZ_MOD; });
}
function qzOf(type){ return qzAll().filter(function(x){ return x.type === type; }); }
function qzItem(id){ return qzAll().filter(function(x){ return x.id === id; })[0] || null; }
function qzPush(o){
  if(!Array.isArray(S.kmItems)) S.kmItems = [];
  S.kmItems.push(o);
  touch('kmItems');
  return o;
}
function qzTouch(o){ o.mt = Date.now(); touch('kmItems'); }
function qzRemove(x){
  if(!x) return;
  if(x.type === 'mat') (Array.isArray(x.photos) ? x.photos : []).forEach(function(pid){ try{ photoDel(pid); }catch(e){} });
  if(x.type === 'q') qzLogDel(x.id);
  removeItem('kmItems', x.id);
}

/* ===== 科目 ===== */
function qzSubSort(a, b){ return (toNum(a.ord) - toNum(b.ord)) || String(a.id).localeCompare(String(b.id)); }
function qzSubsAll(){ return qzOf('subject').sort(qzSubSort); }
function qzSubs(){ return qzSubsAll().filter(function(x){ return !x.arch; }); }
function qzSub(id){ var s = qzItem(id); return (s && s.type === 'subject') ? s : null; }
function qzSubName(id){ var s = qzSub(id); return s ? s.name : 'そのほか'; }
function qzSubIcon(id){ var s = qzSub(id); return (s && s.icon) || '📘'; }
function qzSubLabel(id){ return qzSubIcon(id) + ' ' + qzSubName(id); }
/* いまえらんでいる科目（消された科目をえらんだままにしない） */
function qzCurSub(){
  if(qzState.sub && qzSub(qzState.sub) && !qzSub(qzState.sub).arch) return qzState.sub;
  qzState.sub = '';
  return '';
}
function qzSubAdd(name, icon, link){
  name = String(name == null ? '' : name).trim().slice(0, 40);
  if(!name) return null;
  var dup = qzSubsAll().filter(function(x){ return x.name === name; })[0];
  if(dup){
    if(dup.arch){ dup.arch = 0; qzTouch(dup); }
    return dup;
  }
  var max = 0, n = qzSubsAll().length;
  qzSubsAll().forEach(function(x){ max = Math.max(max, toNum(x.ord)); });
  return qzPush({ id:uid('qzs'), mt:Date.now(), mod:QZ_MOD, type:'subject', name:name,
                  icon:icon || QZ_ICONS[n % QZ_ICONS.length], ord:max + 10, link:String(link || ''), arch:0 });
}
function qzSubRename(id, name){
  var s = qzSub(id);
  name = String(name == null ? '' : name).trim().slice(0, 40);
  if(!s || !name) return false;
  if(qzSubsAll().some(function(x){ return x.id !== id && x.name === name; })) return false;
  s.name = name; qzTouch(s);
  return true;
}
function qzSubIconSet(id, icon){
  var s = qzSub(id);
  if(!s) return false;
  s.icon = String(icon || '').slice(0, 4) || '📘'; qzTouch(s);
  return true;
}
/* 並びの番号を1から付け直す（同じ番号が重なったときに使う） */
function qzSubReorder(){
  qzSubsAll().forEach(function(x, i){
    var v = (i + 1) * 10;
    if(toNum(x.ord) !== v){ x.ord = v; qzTouch(x); }
  });
}
/* 上（d=-1）・下（d=1）に動かす（しまってある科目も、整理の画面と同じ並びで動かす） */
function qzSubMove(id, d){
  var list = qzSubsAll(), i = -1;
  list.forEach(function(x, k){ if(x.id === id) i = k; });
  var j = i + d;
  if(i < 0 || j < 0 || j >= list.length) return false;
  /* 同じ番号が重なっているときは、先に番号を付け直す */
  if(list.some(function(x, k){ return k > 0 && toNum(x.ord) === toNum(list[k - 1].ord); })){
    qzSubReorder();
    list = qzSubsAll();
  }
  var a = list[i], b = list[j], ao = toNum(a.ord);
  a.ord = toNum(b.ord); b.ord = ao;
  qzTouch(a); qzTouch(b);
  return true;
}
/* 科目を消す（withItems … 中の資料と問題もいっしょに消す。そうでなければ「科目なし」にする） */
function qzSubDel(id, withItems){
  var s = qzSub(id);
  if(!s) return 0;
  var n = 0;
  qzAll().forEach(function(x){
    if(x.type === 'subject' || x.sub !== id) return;
    if(withItems){ qzRemove(x); n++; }
    else { x.sub = ''; qzTouch(x); }
  });
  qzRemove(s);
  if(qzState.sub === id) qzState.sub = '';
  return n;
}
/* 時間割の科目から、足りないものをまとめて作る */
function qzSubImport(){
  var have = {}, n = 0;
  qzSubsAll().forEach(function(x){ have[x.name] = 1; });
  (typeof termCourses === 'function' ? termCourses() : []).forEach(function(c){
    if(!c || !c.name || have[c.name]) return;
    have[c.name] = 1;
    if(qzSubAdd(c.name, '', c.name)) n++;
  });
  return n;
}

/* ===== 資料と問題 ===== */
function qzMats(sub){ return qzOf('mat').filter(function(x){ return !sub || x.sub === sub; }).sort(function(a, b){ return toNum(b.mt) - toNum(a.mt); }); }
function qzMat(id){ var m = qzItem(id); return (m && m.type === 'mat') ? m : null; }
function qzQs(sub){ return qzOf('q').filter(function(x){ return qzQOk(x) && (!sub || x.sub === sub); }); }
function qzQsOfMat(mat){ return qzOf('q').filter(function(x){ return qzQOk(x) && x.mat === mat; }); }
/* 使える問題かどうか（こわれた問題は出さない） */
function qzQOk(x){
  if(!x || !x.q) return false;
  if(x.qt === 'order') return Array.isArray(x.c) && x.c.length >= 3 && x.c.every(function(t){ return !!String(t || '').trim(); });
  if(x.qt === 'match') return Array.isArray(x.pairs) && x.pairs.length >= 2 &&
    x.pairs.every(function(p){ return Array.isArray(p) && String(p[0] || '').trim() && String(p[1] || '').trim(); });
  if(x.qt === 'calc') return String(x.at || '').trim() !== '' && isFinite(qzNum(x.at));
  if(x.qt === 'cloze' || x.qt === 'short') return !!String(x.at || '').trim();
  return Array.isArray(x.c) && x.c.length >= 2 && Array.isArray(x.a) && x.a.length > 0 &&
         x.a.every(function(i){ return i >= 0 && i < x.c.length; });
}
/* 「1,200」「約42滴」などから数だけ取り出す */
function qzNum(v){
  var t = String(v == null ? '' : v);
  try{ t = t.normalize('NFKC'); }catch(e){}
  t = t.replace(/,/g, '');
  var m = t.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}
function qzAnswerText(x){
  if(x.qt === 'order') return (x.c || []).join(' → ');
  if(x.qt === 'match') return (x.pairs || []).map(function(p){ return p[0] + '＝' + p[1]; }).join('／');
  if(x.qt === 'calc') return String(x.at || '') + (x.un ? ' ' + x.un : '');
  if(x.qt === 'cloze' || x.qt === 'short') return String(x.at || '');
  return (Array.isArray(x.a) ? x.a : []).map(function(i){ return (x.c || [])[i]; }).filter(Boolean).join('・');
}
/* 選択肢のならび（#60 毎回シャッフル）・並べかえ／組み合わせの出し方を決める */
function qzViewOrder(q){
  var r = qzState.run;
  if(r && r.cur === q.id && r.shuf) return r.shuf;
  var n = q.qt === 'match' ? (q.pairs || []).length : (q.c || []).length;
  var idx = [];
  for(var i = 0; i < n; i++) idx.push(i);
  var mix = (q.qt === 'order' || q.qt === 'match') || (q.qt === 'mc' && qzCfg().shuffle !== 0);
  if(mix) qzShuffle(idx);
  if(r){ r.cur = q.id; r.shuf = idx; }
  return idx;
}

/* ===== 答えた記録 ===== */
function qzLogKey(id){ return 'quiz:log:' + id; }
function qzLogOf(id){
  var v = (S.kmData || {})[qzLogKey(id)];
  return (v && typeof v === 'object') ? v : null;
}
function qzLogDel(id){
  if(S.kmData && S.kmData[qzLogKey(id)]){ delete S.kmData[qzLogKey(id)]; touch('kmData'); }
}
function qzLogAnswer(id, ok){
  S.kmData = (S.kmData && typeof S.kmData === 'object' && !Array.isArray(S.kmData)) ? S.kmData : {};
  var td = today();
  var o = Object.assign({ n:0, ok:0, miss:0, box:0 }, qzLogOf(id) || {});
  o.n = toNum(o.n) + 1;
  if(ok) o.ok = toNum(o.ok) + 1; else o.miss = toNum(o.miss) + 1;
  o.box = ok ? Math.min(QZ_IVL.length, toNum(o.box) + 1) : 0;
  o.res = ok ? 1 : 0;
  o.last = td;
  o.due = shiftDate(td, ok ? QZ_IVL[Math.max(0, o.box - 1)] : 1);
  o.mt = Date.now();
  S.kmData[qzLogKey(id)] = o;
  var dk = 'quiz:day:' + td + '|' + DEV.id;
  var d = Object.assign({ n:0, ok:0 }, S.kmData[dk] || {});
  d.n = toNum(d.n) + 1; if(ok) d.ok = toNum(d.ok) + 1;
  d.mt = Date.now();
  S.kmData[dk] = d;
  touch('kmData');
}
function qzDayCount(ymd){
  var m = S.kmData || {}, p = 'quiz:day:' + ymd + '|', n = 0, ok = 0;
  Object.keys(m).forEach(function(k){
    if(k.indexOf(p) !== 0) return;
    n += toNum(m[k] && m[k].n); ok += toNum(m[k] && m[k].ok);
  });
  return { n:n, ok:ok };
}
function qzStreak(){
  var d = today(), n = 0;
  if(!qzDayCount(d).n) d = shiftDate(d, -1);      /* 今日まだでも、きのうまで続いていれば数える */
  while(qzDayCount(d).n > 0 && n < 400){ n++; d = shiftDate(d, -1); }
  return n;
}
/* 出す問題をえらぶ（due 復習の日がきた／new まだ解いていない／wrong 最後にまちがえた／star 星／all ぜんぶ） */
function qzPool(sub, mode){
  var td = today(), list = qzQs(sub);
  if(mode === 'due') return list.filter(function(x){ var l = qzLogOf(x.id); return l && l.due && String(l.due) <= td; });
  if(mode === 'new') return list.filter(function(x){ return !qzLogOf(x.id); });
  if(mode === 'wrong') return list.filter(function(x){ var l = qzLogOf(x.id); return l && l.res === 0; });
  if(mode === 'star') return list.filter(function(x){ return !!x.star; });
  return list;
}
/* きょう出す数（復習＋まだ解いていない分） */
function qzTodoCount(sub){ return qzPool(sub, 'due').length + qzPool(sub, 'new').length; }
/* 画面でえらんだ科目（'none' は「科目なし」）で数える */
function qzPoolFor(sub, mode){
  if(sub !== 'none') return qzPool(sub, mode);
  return qzPool('', mode).filter(function(x){ return !x.sub; });
}
/* 画面に出す科目の名前（'' はすべて、'none' は科目なし） */
function qzSubTitle(sub){ return sub === 'none' ? '科目なし' : sub ? qzSubName(sub) : 'すべての科目'; }
function qzStats(sub){
  var list = sub === 'none' ? qzQs('').filter(function(x){ return !x.sub; }) : qzQs(sub);
  var n = 0, ok = 0, answered = 0;
  list.forEach(function(x){
    var l = qzLogOf(x.id);
    if(!l) return;
    answered++; n += toNum(l.n); ok += toNum(l.ok);
  });
  return { total:list.length, answered:answered, fresh:list.length - answered, tries:n, ok:ok,
           rate:n ? Math.round(ok * 100 / n) : null, due:qzPoolFor(sub, 'due').length, wrong:qzPoolFor(sub, 'wrong').length };
}

/* ============================== 資料を読む（写真・PDF・スライド・テキスト） ==============================
   スライド（.pptx）とWord（.docx）は、中身がzipなので、ブラウザでほどいて字だけ取り出す。
   写真とPDFは、そのままAIに見てもらう。                                                     */
function qzKindOf(f){
  var name = String(f && f.name || '');
  if(/\.zip$/i.test(name) || /zip/i.test(f.type || '')) return 'zip';
  if(/\.(pptx|docx)$/i.test(name)) return 'slide';
  if(/pdf/i.test(f.type || '') || /\.pdf$/i.test(name)) return 'pdf';
  if(/^image\//.test(f.type || '') || /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(name)) return 'photo';
  if(/^text\//.test(f.type || '') || /\.(txt|md|csv|tsv|json|rtf|html?|vtt|srt)$/i.test(name)) return 'text';
  return '';
}
function qzKindName(kind){
  return { photo:'写真', pdf:'PDF', slide:'スライド', text:'文章' }[kind] || '資料';
}
function qzReadAs(f, how){
  return new Promise(function(res, rej){
    var r = new FileReader();
    r.onload = function(){ res(r.result); };
    r.onerror = function(){ rej(new Error('「' + f.name + '」を読めませんでした')); };
    if(how === 'buf') r.readAsArrayBuffer(f);
    else if(how === 'text') r.readAsText(f);
    else r.readAsDataURL(f);
  });
}
/* &amp; などを、もとの字にもどす */
function qzUnent(s){
  return String(s == null ? '' : s)
    .replace(/&#x([0-9a-fA-F]+);/g, function(m, h){ return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function(m, d){ return String.fromCharCode(Number(d)); })
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
/* <a:t>…</a:t> のような札の中の字をぜんぶ集める */
function qzTagText(xml, tag){
  var out = [], re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'g'), m;
  while((m = re.exec(xml))) out.push(qzUnent(m[1].replace(/<[^>]+>/g, '')));
  return out;
}
/* 段落の札で区切って、1行ずつにする */
function qzOoxText(xml, pTag, tTag){
  var lines = [];
  String(xml).split('</' + pTag + '>').forEach(function(part){
    var t = qzTagText(part, tTag).join('').replace(/\s+$/, '');
    if(t.trim()) lines.push(t);
  });
  return lines.join('\n');
}
/* zip をほどく（中の1つ分） */
async function qzInflate(bytes, method){
  if(method === 0) return bytes;
  if(method !== 8) throw new Error('この形のファイルは、中の字を読めません');
  if(typeof DecompressionStream === 'undefined'){
    throw new Error('この端末では、スライドの中の字を読めません。スライドを画面に出して写真にとるか、PDFにして読みこんでください');
  }
  var st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
/* zip の中の、ほしいファイルだけを取り出す */
function qzZipEntries(buf, want){
  var b = new Uint8Array(buf);
  var dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  var eo = -1, stop = Math.max(0, b.length - 66000);
  for(var i = b.length - 22; i >= stop; i--){ if(dv.getUint32(i, true) === 0x06054b50){ eo = i; break; } }
  if(eo < 0) throw new Error('ファイルを開けませんでした（.pptx / .docx を選んでください）');
  var count = dv.getUint16(eo + 10, true), p = dv.getUint32(eo + 16, true);
  var dec = new TextDecoder('utf-8'), out = [];
  for(var k = 0; k < count && p + 46 <= b.length; k++){
    if(dv.getUint32(p, true) !== 0x02014b50) break;
    var method = dv.getUint16(p + 10, true);
    var csize = dv.getUint32(p + 20, true);
    var nameLen = dv.getUint16(p + 28, true), extLen = dv.getUint16(p + 30, true), cmtLen = dv.getUint16(p + 32, true);
    var lho = dv.getUint32(p + 42, true);
    var name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extLen + cmtLen;
    if(!want(name) || !csize || lho + 30 > b.length) continue;
    if(dv.getUint32(lho, true) !== 0x04034b50) continue;
    var start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    if(start + csize > b.length) continue;
    out.push({ name:name, method:method, data:b.subarray(start, start + csize) });
  }
  return out;
}
function qzSlideNo(name){ var m = String(name).match(/(\d+)\.xml$/); return m ? Number(m[1]) : 0; }
/* 太字・下線・色つきの字を取り出す（#36） */
function qzEmphFrom(xml, isDoc){
  var out = [], re = isDoc ? /<w:r\b[\s\S]*?<\/w:r>/g : /<a:r\b[\s\S]*?<\/a:r>/g, m;
  while((m = re.exec(xml)) && out.length < 40){
    var run = m[0];
    var pr = run.match(isDoc ? /<w:rPr>[\s\S]*?<\/w:rPr>/ : /<a:rPr[\s\S]*?(?:\/>|<\/a:rPr>)/);
    if(!pr) continue;
    var p = pr[0];
    var hot = isDoc
      ? (/<w:b\b/.test(p) || /<w:u\b/.test(p) || /<w:color[^>]*w:val="(?!auto|000000)/.test(p) || /<w:highlight/.test(p))
      : (/\bb="1"/.test(p) || /\bu="(?!none)/.test(p) || /srgbClr val="(?!000000)/.test(p));
    if(!hot) continue;
    var t = qzTagText(run, isDoc ? 'w:t' : 'a:t').join('').trim();
    if(t && t.length >= 2 && t.length <= 60 && out.indexOf(t) < 0) out.push(t);
  }
  return out;
}
/* スライド（.pptx）・Word（.docx）から字を取り出す */
async function qzDocText(f){
  var buf = await qzReadAs(f, 'buf');
  return qzDocTextBuf(buf, /\.docx$/i.test(f.name), f.name);
}
async function qzDocTextBuf(buf, isDoc, name){
  var f = { name:name || (isDoc ? 'document.docx' : 'slides.pptx') };
  var want = isDoc
    ? function(n){ return n === 'word/document.xml'; }
    : function(n){ return /^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(n); };
  var files = qzZipEntries(buf, want);
  if(!files.length) throw new Error('「' + f.name + '」の中に字が見つかりませんでした');
  var emph = [];
  files.sort(function(a, b){
    var na = /notesSlide/.test(a.name) ? 1 : 0, nb = /notesSlide/.test(b.name) ? 1 : 0;
    return (na - nb) || (qzSlideNo(a.name) - qzSlideNo(b.name)) || a.name.localeCompare(b.name);
  });
  var dec = new TextDecoder('utf-8'), out = [];
  for(var i = 0; i < files.length; i++){
    var xml = dec.decode(await qzInflate(files[i].data, files[i].method));
    var t = isDoc ? qzOoxText(xml, 'w:p', 'w:t') : qzOoxText(xml, 'a:p', 'a:t');
    qzEmphFrom(xml, isDoc).forEach(function(w){ if(emph.indexOf(w) < 0 && emph.length < 30) emph.push(w); });
    if(!t.trim()) continue;
    if(isDoc) out.push(t);
    else out.push((/notesSlide/.test(files[i].name) ? '【ノート ' : '【スライド ') + qzSlideNo(files[i].name) + '】\n' + t);
  }
  if(!out.length) throw new Error('「' + f.name + '」の中に字が見つかりませんでした');
  return { text:out.join('\n\n'), emph:emph };
}
/* えらんだファイルを、AIに渡せる形にする
   写真は撮った日（EXIF）とくっきり具合を見て、スライドは強調のことばも取り出す。
   ZIP（大学のポータルからまとめて落としたもの）は、中のファイルをほどいて読む（#15）。 */
async function qzLoadFiles(files){
  var out = [];
  for(var i = 0; i < files.length; i++){
    var f = files[i], kind = qzKindOf(f);
    if(!kind) throw new Error('「' + f.name + '」は読めません（写真・PDF・.pptx・.docx・文章・ZIP）');
    if(kind === 'zip'){
      var inner = await qzLoadZip(f);
      inner.forEach(function(x){ if(out.length < QZ_MAX_FILES) out.push(x); });
      continue;
    }
    out.push(await qzLoadOne(f, kind));
  }
  return out;
}
async function qzLoadOne(f, kind){
  if(kind === 'photo'){
    var url = await resizeImage(f, 1800, 0.82);
    var o = { name:f.name, kind:'photo', url:url, text:'' };
    try{ o.at = await qz2ExifDate(f); }catch(e){}
    try{
      var sharp = await qz2ImgSharp(url);
      if(sharp < 60) o.warn = '⚠️ ぼけている・手ぶれしているかもしれません（読みやすさ ' + sharp + '）。撮り直すか、「明るく・くっきり」を押してみてください。';
    }catch(e){}
    return o;
  }
  if(kind === 'pdf'){
    if(f.size > QZ_PDF_MAX) throw new Error('PDFは15MBまでです（' + f.name + '）');
    return { name:f.name, kind:'pdf', url:await qzReadAs(f, 'url'), text:'' };
  }
  if(kind === 'slide'){
    if(f.size > QZ_DOC_MAX) throw new Error('スライド・Wordは25MBまでです（' + f.name + '）');
    var d = await qzDocText(f);
    return { name:f.name, kind:'slide', url:'', text:d.text, emph:d.emph || [] };
  }
  if(f.size > QZ_TXT_MAX) throw new Error('文章のファイルは5MBまでです（' + f.name + '）');
  return { name:f.name, kind:'text', url:'', text:String(await qzReadAs(f, 'text') || '') };
}
/* ZIP の中の、読めるものだけを取り出す（#15） */
async function qzLoadZip(f){
  if(f.size > QZ_DOC_MAX) throw new Error('ZIPは25MBまでです（' + f.name + '）');
  var buf = await qzReadAs(f, 'buf');
  var want = function(n){ return !/\/$/.test(n) && !/^__MACOSX/.test(n) && /\.(pptx|docx|txt|md|csv|pdf|jpe?g|png)$/i.test(n); };
  var entries = qzZipEntries(buf, want);
  if(!entries.length) throw new Error('「' + f.name + '」の中に、読めるファイルがありませんでした');
  entries.sort(function(a, b){ return a.name.localeCompare(b.name); });
  var out = [], dec = new TextDecoder('utf-8');
  for(var i = 0; i < entries.length && out.length < QZ_MAX_FILES; i++){
    var e = entries[i], base = String(e.name).split('/').pop();
    var bytes;
    try{ bytes = await qzInflate(e.data, e.method); }catch(err){ continue; }
    if(/\.(pptx|docx)$/i.test(base)){
      try{
        var d = await qzDocTextBuf(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), /\.docx$/i.test(base), base);
        out.push({ name:base, kind:'slide', url:'', text:d.text, emph:d.emph || [] });
      }catch(err2){}
    }else if(/\.(txt|md|csv)$/i.test(base)){
      out.push({ name:base, kind:'text', url:'', text:dec.decode(bytes) });
    }else if(/\.pdf$/i.test(base)){
      if(bytes.length <= QZ_PDF_MAX) out.push({ name:base, kind:'pdf', url:qzDataUrl(bytes, 'application/pdf'), text:'' });
    }else{
      out.push({ name:base, kind:'photo', url:qzDataUrl(bytes, /\.png$/i.test(base) ? 'image/png' : 'image/jpeg'), text:'' });
    }
  }
  if(!out.length) throw new Error('「' + f.name + '」の中身を読めませんでした');
  return out;
}
/* バイトの列を data: の形にする */
function qzDataUrl(bytes, mime){
  var bin = '', chunk = 0x8000;
  for(var i = 0; i < bytes.length; i += chunk){
    bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(bytes.length, i + chunk)));
  }
  return 'data:' + mime + ';base64,' + btoa(bin);
}
/* 同じ資料を2回取りこんでいないか（#19） */
function qzHash(s){
  var h = 5381;
  s = String(s || '');
  for(var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return String(h);
}
function qzFileSig(f){ return qzHash((f.text || '').slice(0, 800) || (f.name + '|' + (f.url || '').length)); }
function qzDupMark(list){
  var mats = qzMats('');
  list.forEach(function(f){
    var sig = qzFileSig(f);
    f.sig = sig;
    var hit = mats.filter(function(m){ return m.sig === sig; })[0];
    if(hit) f.dup = '📌 この資料は「' + hit.title + '」（' + qzMd(hit.at) + '）で、もう取りこんでいます。';
  });
  return list;
}
function qzPickFiles(){
  var inp = document.createElement('input');
  inp.type = 'file';
  /* iPhoneでも選べるように、拡張子とMIMEの両方を書く */
  inp.accept = ['image/*', '.pdf', 'application/pdf',
    '.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt', '.md', '.csv', 'text/plain', 'text/csv', '.zip', 'application/zip'].join(',');
  inp.multiple = true;
  inp.onchange = function(){
    var files = Array.prototype.slice.call(inp.files || [], 0, QZ_MAX_FILES);
    if(files.length) qzTakeFiles(files);
  };
  inp.click();
}
/* つづけて写真をとる（スライドを何枚も：#10） */
function qzShotLoop(){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  try{ inp.capture = 'environment'; }catch(e){}
  inp.onchange = async function(){
    var f = (inp.files || [])[0];
    if(!f) return;
    await qzTakeFiles([f], true);
    if(qzState.files.length < QZ_MAX_FILES){
      toast(qzState.files.length + '枚目まで読みました。次の1枚をどうぞ（とらないときは、そのまま閉じてください）');
      setTimeout(function(){ inp.value = ''; inp.click(); }, 400);
    }else{
      toast(QZ_MAX_FILES + '枚まで読みました');
    }
  };
  inp.click();
}
/* えらんだファイルを、読みこんで一覧に足す */
async function qzTakeFiles(files, quiet){
  if(qzState.busy) return;
  qzState.busy = 'read'; qzRender();
  try{
    var loaded = await qzLoadFiles(files);
    qzState.files = qzDupMark(qzState.files.concat(loaded)).slice(0, QZ_MAX_FILES);
    /* 写真をとった日を、資料の日付にする（#17） */
    if(!qzState.mat.at){
      var withAt = qzState.files.filter(function(x){ return x.at; })[0];
      if(withAt){ qzState.mat.at = withAt.at; qzState.inp.qz_mat = withAt.at; }
    }
    /* 名前から「第◯回」を見つける（#20） */
    if(!qzState.mat.no){
      var m = String((loaded[0] && loaded[0].name) || '').match(/第?\s*(\d{1,2})\s*回/);
      if(m){ qzState.mat.no = m[1]; qzState.inp.qz_mno = m[1]; }
    }
    if(!quiet) toast(loaded.length + 'つ読みこみました');
  }catch(e){
    toast(e.message, true);
  }finally{
    qzState.busy = ''; qzRender();
  }
}
/* 写真を1枚ととのえる（明るく・分ける・まっすぐ） */
async function qzFileFix(i, how){
  var f = qzState.files[i];
  if(!f || f.kind !== 'photo' || !f.url || qzState.busy) return;
  qzState.busy = 'fix'; qzRender();
  try{
    if(how === 'auto'){
      f.url = await qz2ImgAuto(f.url);
      f.done = 1; f.warn = '';
      toast('明るさとコントラストをととのえました');
    }else if(how === 'split'){
      var two = await qz2ImgSplit(f.url);
      var a = { name:f.name.replace(/(\.[a-z]+)?$/i, '') + '（左）', kind:'photo', url:two[0], text:'', at:f.at, done:1 };
      var b = { name:f.name.replace(/(\.[a-z]+)?$/i, '') + '（右）', kind:'photo', url:two[1], text:'', at:f.at, done:1 };
      qzState.files.splice(i, 1, a, b);
      qzState.files = qzState.files.slice(0, QZ_MAX_FILES);
      toast('2つに分けました');
    }
  }catch(e){
    toast('できませんでした：' + e.message, true);
  }finally{
    qzState.busy = ''; qzRender();
  }
}
async function qzWarpApply(){
  var w = qzState.warp, f = w && qzState.files[w.i];
  if(!f || qzState.busy) return;
  qzState.busy = 'fix'; qzRender();
  try{
    f.url = await qz2ImgWarp(f.url, w.quad);
    f.done = 1;
    qzState.warp = null;
    toast('まっすぐにしました');
  }catch(e){
    toast('できませんでした：' + e.message, true);
  }finally{
    qzState.busy = ''; qzRender();
  }
}
/* 資料から取り出した字（ぜんぶ合わせたもの） */
function qzFilesText(){
  return qzState.files.filter(function(f){ return f.text; })
    .map(function(f){ return '［' + f.name + '］\n' + f.text; }).join('\n\n');
}
function qzFilesTitle(){
  var f = qzState.files[0];
  if(!f) return '';
  return String(f.name).replace(/\.[a-z0-9]+$/i, '').slice(0, 60);
}

/* ============================== AIで問題を作る ============================== */
function qzMakePrompt(o){
  var names = { mc:'mc（4択）', tf:'tf（○×）', cloze:'cloze（穴うめ）', short:'short（記述）',
                order:'order（並べかえ）', match:'match（組み合わせ）' };
  var types = o.types.map(function(t){ return names[t] || t; }).join('、');
  var lvName = { 1:'基本（授業に出たことばの意味・正常値など）', 2:'ふつう（テストによく出るところ）', 3:'応用（理由を考えるもの・まちがえやすいところ）' }[o.lv] || 'ふつう';
  var p = 'あなたは看護学部1年生の授業の資料から、テスト対策の問題を作る先生です。\n' +
    '渡した資料（授業の写真・スライド・配布資料）を読んで、問題を' + o.n + '問作ってください。\n' +
    '・問題は次の種類から作る：' + types + '。指定された種類だけを使う。\n' +
    (o.both ? '・むずかしさは、半分を「基本」（lv=1）、半分を「応用」（lv=3）にする。\n' : '・むずかしさ：' + lvName + '\n') +
    '・資料に書いてあることだけから作る。書いていないことは作らない。読めない字は、むりに読まない。\n' +
    '・1問に1つのことだけ。問題文は短く、はっきり書く。\n' +
    '・mc（4択）は choices を4つ。正解は1つ。ほかの3つも、ありそうなまちがいにする。ans は正解の番号（1からかぞえる）。\n' +
    '・tf（○×）は「〜である。」の形の文にして、answer に "○" か "×" を書く。choices は書かない。\n' +
    '・cloze（穴うめ）は、文の中の大事なことばを1つだけ（　）にして、answer にその答えを書く。\n' +
    '・short（記述）は、1〜2文で答えられる問い。answer に模範の答えを書く。alt に、同じ意味の別の言い方を2つまで。\n' +
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
  if(o.have && o.have.length) p += '・次の問題とかぶらないように、別のところから作る：\n' + o.have.map(function(q){ return '　' + q; }).join('\n') + '\n';
  return p + 'JSONだけで答える：{"title":"資料の見出し","summary":"要点","questions":[' +
    '{"type":"mc","q":"問題文","choices":["選択肢1","選択肢2","選択肢3","選択肢4"],"ans":[1],"answer":"","alt":[],"steps":[],"pairs":[],"exp":"解説","tag":"小見出し","ch":"単元","page":"スライド3","lv":2}]}';
}
/* AIの答えを、使える形にそろえる */
function qzCleanQs(arr, want, max){
  var seen = {}, out = [];
  (Array.isArray(arr) ? arr : []).forEach(function(x){
    if(!x || typeof x !== 'object') return;
    var qt = qzCleanType(x.type);
    if(want && want.length && want.indexOf(qt) < 0) return;
    var q = String(x.q || x.question || '').trim().slice(0, 500);
    if(!q) return;
    var o = { qt:qt, q:q, c:[], a:[], at:'', alt:[], on:1,
              exp:String(x.exp || x.explanation || '').trim().slice(0, 600),
              tag:String(x.tag || '').trim().slice(0, 40),
              ch:String(x.ch || x.unit || '').trim().slice(0, 40),
              pg:String(x.page || x.pg || '').trim().slice(0, 20),
              lv:Math.max(1, Math.min(3, toNum(x.lv) || 2)) };
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
        var nums = qzAnsNums(x.ans);
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
      var a = qzAnsNums(x.ans).filter(function(i){ return i >= 0 && i < c.length; });
      if(!a.length && ansText){
        var hit = c.indexOf(ansText);
        if(hit >= 0) a = [hit];
      }
      if(c.length < 2 || !a.length) return;
      o.c = c; o.a = a;
    }else{
      if(!ansText) return;
      o.at = ansText.slice(0, 200);
      o.alt = (Array.isArray(x.alt) ? x.alt : []).map(function(s){ return String(s || '').trim().slice(0, 200); })
        .filter(function(s, i, ar){ return s && ar.indexOf(s) === i; }).slice(0, 3);
      if(qt === 'cloze' && !/[（(].{0,12}[）)]|＿|__/.test(o.q)) o.q = o.q + '（　）';
    }
    var key = qzNorm(o.q);
    if(!key || seen[key]) return;
    seen[key] = 1;
    out.push(o);
  });
  return out.slice(0, max || QZ_MAX_Q);
}
function qzCleanType(v){
  var s = String(v || '').toLowerCase();
  if(/order|sort|ならべ|並べ|手順/.test(s)) return 'order';
  if(/match|pair|組み合わせ|むすぶ/.test(s)) return 'match';
  if(/calc|計算/.test(s)) return 'calc';
  if(/tf|ox|true|○×|まるばつ/.test(s)) return 'tf';
  if(/cloze|blank|穴/.test(s)) return 'cloze';
  if(/short|desc|記述|自由/.test(s)) return 'short';
  return 'mc';
}
/* 「1」「①」「2つめ」などを、0からの番号にする */
function qzAnsNums(v){
  var out = [];
  (Array.isArray(v) ? v : [v]).forEach(function(x){
    if(x == null) return;
    var t = String(x);
    try{ t = t.normalize('NFKC'); }catch(e){}
    t = t.replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, function(c){ return String('①②③④⑤⑥⑦⑧⑨⑩'.indexOf(c) + 1); });
    (t.match(/\d+/g) || []).forEach(function(d){
      var i = Number(d) - 1;
      if(i >= 0 && out.indexOf(i) < 0) out.push(i);
    });
  });
  return out;
}
/* ===== 作れなかったときの「続き」（#46） ===== */
function qzPendKey(){ return KEY + ':quizpend'; }
function qzPendOf(){
  try{
    var o = JSON.parse(localStorage.getItem(qzPendKey()) || 'null');
    if(!o || !o.text || Date.now() - toNum(o.at) > 3 * 86400000) return null;
    return o;
  }catch(e){ return null; }
}
function qzPendSet(o){ try{ localStorage.setItem(qzPendKey(), JSON.stringify(Object.assign({ at:Date.now() }, o))); }catch(e){} }
function qzPendDrop(){ try{ localStorage.removeItem(qzPendKey()); }catch(e){} }
function qzMakeAgain(){
  var p = qzPendOf();
  if(!p){ toast('やり直す分はありません', true); return; }
  qzMake(Object.assign({}, p.opt || {}, { sub:p.sub || qzCurSub(), text:p.text, title:p.title, again:1 }));
}
/* 資料をAIに渡して、問題を作ってもらう（AIを使わない作り方もここから） */
async function qzMake(o){
  if(qzState.busy) return null;
  var text = o.again ? '' : qzFilesText();
  var hasFile = !o.again && qzState.files.some(function(f){ return f.url; });
  var extra = String(o.text || '').trim();
  if(!hasFile && !text.trim() && !extra){ toast('資料をえらぶか、文章を貼りつけてください', true); return null; }
  var body = [text, extra].filter(Boolean).join('\n\n');
  var title = String(o.title || '').trim() || qzFilesTitle() || (today() + ' の資料');
  /* ===== AIを使わない（APIをまったく使わない） ===== */
  if(o.noai){
    if(!body.trim()){ toast('AIを使わないときは、字のある資料（スライド・文章）か、貼りつけた文章が必要です', true); return null; }
    var mine = [];
    if(typeof qz2MakeText === 'function') mine = qz2MakeText(body, Math.ceil(o.n * 0.7), { src:title, ch:o.ch });
    if(typeof qz2MakeTextTf === 'function') mine = mine.concat(qz2MakeTextTf(body, o.n - mine.length, { src:title, ch:o.ch }));
    if(!mine.length){ toast('その場で作れるところが見つかりませんでした（数字や用語のある文があると作れます）', true); return null; }
    qzState.pv = { sub:o.sub, title:title, summary:'', items:mine.slice(0, o.n), local:1 };
    render(); window.scrollTo(0, 0);
    toast(qzState.pv.items.length + '問できました（AIは使っていません）');
    return qzState.pv;
  }
  if(!aiReady()){ toast('先に設定タブでAI（Gemini）のキーを登録してください', true); return null; }
  qzState.busy = 'make'; qzState.pv = null;
  qzState.prog = { step:'資料をまとめています…', at:Date.now() };
  qzState.abort = (typeof AbortController === 'function') ? new AbortController() : null;
  var timer = setInterval(function(){ if(qzState.busy === 'make') qzRender(); }, 1000);
  qzRender();
  try{
    var parts = [];
    /* 字が取り出せている資料は、写真を送らない（送る量をへらす） */
    var sendImages = !body.trim() || qzState.files.some(function(f){ return f.url && !f.text; });
    if(sendImages){
      qzState.files.forEach(function(f){
        var m = String(f.url || '').match(/^data:([^;]+);base64,(.*)$/);
        if(m) parts.push({ inline_data:{ mime_type:m[1], data:m[2] } });
      });
    }
    var emph = [];
    qzState.files.forEach(function(f){ (f.emph || []).forEach(function(w){ if(emph.indexOf(w) < 0) emph.push(w); }); });
    var opt = {
      n:o.n, types:o.types, lv:o.lv, both:o.both, style:o.style, kokushi:o.kokushi, en:o.en, two:o.two,
      emph:emph, memo:o.memo || '',
      confuse:(typeof qz2ConfuseIn === 'function') ? qz2ConfuseIn(body) : [],
      have:qzHaveStems(o.sub)
    };
    qzState.prog.step = 'AIが問題を作っています…';
    qzRender();
    parts.push({ text:qzMakePrompt(opt) + (body ? '\n\n資料の中身：\n' + body.slice(0, QZ_TEXT_SEND) : '') });
    var out = await aiGenerate({ contents:[{ role:'user', parts:parts }], json:true, temperature:0.25, maxTokens:8192,
      tag:'qz-make', signal:qzState.abort ? qzState.abort.signal : null });
    qzState.prog.step = '答えをととのえています…';
    var j = parseJsonLoose(out) || {};
    var items = qzCleanQs(j.questions, o.types, o.n);
    if(!items.length) throw new Error('問題を作れませんでした。資料の字がはっきりうつっているか見てください');
    qzPendDrop();
    qzState.pv = {
      sub:o.sub,
      title:String(j.title || '').trim().slice(0, 60) || title,
      summary:String(j.summary || '').trim().slice(0, 400),
      items:items
    };
    toast(items.length + '問できました。見てから追加してください');
  }catch(e){
    var stopped = qzState.abort && qzState.abort.signal && qzState.abort.signal.aborted;
    if(stopped){
      toast('やめました');
    }else{
      /* あとで「もう一度ためす」ができるように、送る中身を覚えておく（#46） */
      if(body.trim()) qzPendSet({ text:body.slice(0, QZ_TEXT_SEND), title:title, sub:o.sub,
        opt:{ n:o.n, types:o.types, lv:o.lv, both:o.both, style:o.style, kokushi:o.kokushi, en:o.en, two:o.two, memo:o.memo || '' } });
      toast('作れませんでした：' + e.message, true);
    }
  }finally{
    clearInterval(timer);
    qzState.busy = ''; qzState.prog = null; qzState.abort = null;
    qzRender();
  }
  return qzState.pv;
}
/* すでにある問題の問題文（かぶり防止に、短くしてAIへ：#38） */
function qzHaveStems(sub){
  return qzQs(sub).slice(-40).map(function(x){ return String(x.q).slice(0, 28); });
}
/* 1問だけ作り直す（#44） */
async function qzRemake(i){
  var pv = qzState.pv;
  if(!pv || !pv.items[i] || qzState.busy) return;
  var old = pv.items[i];
  if(pv.local){
    /* AIを使わずに作ったものは、その場で別の1問に入れかえる */
    var body = qzFilesText() + '\n' + String(qzV('qz_text') || '');
    var fresh = (typeof qz2MakeText === 'function') ? qz2MakeText(body, 8, { src:pv.title }) : [];
    var used = {};
    pv.items.forEach(function(x){ used[x.q] = 1; });
    var pick = fresh.filter(function(x){ return !used[x.q]; })[0];
    if(!pick){ toast('ほかに作れるところが見つかりませんでした', true); return; }
    pv.items[i] = pick;
    render(); toast('作り直しました');
    return;
  }
  if(!aiReady()){ toast('AIのキーがないので、作り直せません', true); return; }
  qzState.busy = 'remake'; qzRender();
  try{
    var text = await aiGenerate({ contents:[{ role:'user', parts:[{ text:
      '次の問題は、うまくありませんでした。同じ資料の同じところから、もっとよい問題を1問だけ作り直してください。\n' +
      '・種類は ' + old.qt + ' のまま。・答えがはっきり決まるようにする。・もとの問題とは別の聞き方にする。\n' +
      'もとの問題：' + old.q + '\n答え：' + (old.at || (old.c || []).filter(function(c, k){ return (old.a || []).indexOf(k) >= 0; }).join('・')) + '\n' +
      (pv.summary ? '資料の要点：' + pv.summary + '\n' : '') +
      'JSONだけで答える：{"type":"' + old.qt + '","q":"問題文","choices":[],"ans":[1],"answer":"","exp":"解説"}' }] }],
      json:true, temperature:0.4, maxTokens:1024, tag:'qz-remake' });
    var one = qzCleanQs([parseJsonLoose(text)], [old.qt], 1)[0];
    if(!one) throw new Error('作り直せませんでした');
    pv.items[i] = one;
    toast('作り直しました');
  }catch(e){
    toast('作り直せませんでした：' + e.message, true);
  }finally{
    qzState.busy = ''; qzRender();
  }
}
/* できた問題を、科目と資料に入れる */
async function qzPvAdd(){
  var pv = qzState.pv;
  if(!pv || qzState.busy) return 0;
  var picked = pv.items.filter(function(x){ return x.on; });
  if(!picked.length){ toast('追加する問題がありません', true); return 0; }
  qzState.busy = 'add';
  var n = 0;
  try{
    var sub = pv.sub && qzSub(pv.sub) ? pv.sub : '';
    var title = String(qzV('qz_pv_title') || pv.title || '資料').trim().slice(0, 60) || '資料';
    /* 組みこみの表から作った問題は、資料を作らずに入れる（#130 など） */
    if(pv.nomat){
      n = qzAddQs(picked, sub, '', pv.src || '');
      qzState.pv = null;
      qzClearForm(['qz_pv_title']);
      commit();
      toast(n + '問を「' + (sub ? qzSubName(sub) : '科目なし') + '」に入れました');
      return n;
    }
    var photos = [], kinds = {};
    qzState.files.forEach(function(f){ kinds[f.kind] = 1; });
    var kind = kinds.photo ? 'photo' : kinds.slide ? 'slide' : kinds.pdf ? 'pdf' : 'text';
    /* 写真だけ、あとで見られるようにしまっておく（PDF・スライドは大きいので、取り出した字だけ残す） */
    for(var i = 0; i < qzState.files.length; i++){
      var f = qzState.files[i];
      if(f.kind !== 'photo' || !f.url) continue;
      var pid = uid('qzp');
      try{ await photoPut(pid, f.url); photos.push(pid); }catch(e){ kmErr('quiz/写真', e); }
    }
    var text = qzFilesText();
    var body = [pv.summary, text].filter(Boolean).join('\n\n');
    var at = isYmd(String(qzV('qz_mat') || qzState.mat.at || '')) ? String(qzV('qz_mat') || qzState.mat.at) : today();
    var no = String(qzV('qz_mno') || qzState.mat.no || '').replace(/[^0-9]/g, '').slice(0, 2);
    var memo = String(qzV('qz_mmemo') || qzState.mat.memo || '').slice(0, 300);
    var sig = qzState.files.length ? qzFileSig(qzState.files[0]) : qzHash(body.slice(0, 800));
    var mat = qzPush({ id:uid('qzm'), mt:Date.now(), mod:QZ_MOD, type:'mat', sub:sub, title:title, kind:kind,
                       at:at, no:no, memo:memo, sig:sig, photos:photos,
                       text:body.slice(0, QZ_TEXT_KEEP), cut:body.length > QZ_TEXT_KEEP ? 1 : 0, n:0 });
    n = qzAddQs(picked, sub, mat.id, '資料：' + title);
    mat.n = n;
    /* 暗記カードも同時に作る（AIは呼ばない：#48） */
    if(qzState.mk.anki && typeof ankiAddMany === 'function'){
      var cards = picked.map(function(x){ return { q:qzCardQ(x), a:qzAnswerText(x) }; })
        .filter(function(c){ return c.q && c.a; });
      var added = ankiAddMany(sub ? qzSubName(sub) : 'そのほか', cards, 'ai');
      if(added) toast(added + '枚の暗記カードも作りました');
    }
    qzState.pv = null; qzState.files = [];
    qzClearForm(['qz_pv_title']);
    commit();
    toast(n + '問を「' + (sub ? qzSubName(sub) : '科目なし') + '」に追加しました');
  }catch(e){
    kmErr('quiz/追加', e);
    toast('追加できませんでした：' + (e && e.message || e), true);
  }finally{
    qzState.busy = '';
    qzRender();
  }
  return n;
}
/* 暗記カードにするときの問い（穴うめは（　）を「何？」にする） */
function qzCardQ(x){
  var q = String(x.q || '');
  if(x.qt === 'cloze') return q.replace(/（\s*）/, '（ ？ ）');
  if(x.qt === 'order') return q + '（正しい順は？）';
  if(x.qt === 'match') return q + '（' + (x.pairs || []).map(function(p){ return p[0]; }).join('・') + '）';
  return q;
}
/* 問題を入れる（同じ問題文はとばす） */
function qzAddQs(list, sub, mat, src){
  var now = Date.now(), n = 0;
  var have = {};
  qzQs('').forEach(function(x){ have[qzNorm(x.q)] = 1; });
  (list || []).forEach(function(x, i){
    var key = qzNorm(x.q);
    if(!key || have[key]) return;
    have[key] = 1;
    var o = { id:uid('qzq'), mt:now + i, mod:QZ_MOD, type:'q', sub:sub || '', mat:mat || '', qt:x.qt, q:x.q,
              c:(x.c || []).slice(), a:(x.a || []).slice(), at:x.at || '', alt:(x.alt || []).slice(),
              exp:x.exp || '', src:x.src || src || QZ_SRC_AI, lv:x.lv || 2, tag:x.tag || '', star:0 };
    if(x.qt === 'match') o.pairs = (x.pairs || []).map(function(p){ return [String(p[0]), String(p[1])]; });
    if(x.qt === 'calc'){ o.un = x.un || ''; o.tol = toNum(x.tol); o.how = x.how || ''; }
    if(x.ch) o.ch = String(x.ch).slice(0, 40);        /* 章・単元（#110） */
    if(x.pg) o.pg = String(x.pg).slice(0, 20);        /* 資料のページ・スライド（#41） */
    if(!qzQOk(o)) return;
    qzPush(o);
    n++;
  });
  return n;
}

/* ============================== 画面：資料から問題を作る ============================== */
/* 科目をえらぶボタンのならび */
function qzSubChips(act, cur, withAll, extra){
  var subs = qzSubs(), at = ' data-act="' + act + '"' + (extra || '');
  return '<div class="chips qz-chips">' +
    (withAll ? '<button' + at + ' data-v="" class="' + (cur ? '' : 'on') + '">すべて</button>' : '') +
    subs.map(function(s){
      return '<button' + at + ' data-v="' + esc(s.id) + '" class="' + (cur === s.id ? 'on' : '') + '">' +
        esc(s.icon + ' ' + s.name) + '</button>';
    }).join('') +
    (withAll && qzQs('').some(function(x){ return !x.sub; })
      ? '<button' + at + ' data-v="none" class="' + (cur === 'none' ? 'on' : '') + '">科目なし</button>' : '') +
    '</div>';
}
/* 科目がまだないときの案内 */
function qzNoSubHtml(){
  var n = (typeof termCourses === 'function' ? termCourses() : []).length;
  return '<div class="empty">科目がまだありません。</div>' +
    '<div class="field"><input id="qz_newsub" placeholder="科目の名前（例：解剖生理学）" value="' + esc(qzIn('qz_newsub')) + '"></div>' +
    '<div class="pair"><button class="btn" data-act="qz-sub-add">この科目を作る</button>' +
    (n ? '<button class="btn ghost" data-act="qz-sub-import">時間割の' + n + '科目から作る</button>' : '') + '</div>';
}
function qzFileRow(f, i){
  var h = '<div class="row qz-file">' +
    '<span class="qz-fic" aria-hidden="true">' + (f.kind === 'photo' ? '🖼' : f.kind === 'pdf' ? '📄' : f.kind === 'slide' ? '📊' : '📝') + '</span>' +
    '<div class="grow"><div class="t">' + esc(f.name) + '</div>' +
    '<div class="s">' + esc(qzKindName(f.kind)) + (f.text ? '・字' + f.text.length + '文字' : '') +
      (f.at ? '・' + esc(qzMd(f.at)) + 'にとった写真' : '') + (f.done ? '・ととのえました' : '') + '</div></div>' +
    '<button class="mini" data-act="qz-file-del" data-i="' + i + '">はずす</button></div>';
  if(f.kind === 'photo'){
    h += '<div class="pillrow qz-fbtn">' +
      '<button data-act="qz-file-auto" data-i="' + i + '">明るく・くっきり</button>' +
      '<button data-act="qz-file-warp" data-i="' + i + '">まっすぐにする</button>' +
      '<button data-act="qz-file-split" data-i="' + i + '">見開きを2つに</button></div>';
    if(f.warn) h += '<div class="qz-ask" style="margin-top:6px">' + esc(f.warn) + '</div>';
  }
  if(f.dup) h += '<div class="qz-ask" style="margin-top:6px">' + esc(f.dup) + '</div>';
  return h;
}
/* ===== 写真をまっすぐにする画面（#8） ===== */
function qzWarpView(){
  var w = qzState.warp, f = qzState.files[w.i];
  if(!f){ qzState.warp = null; return qzMakeView(); }
  var pts = w.quad.map(function(p, k){
    return '<button class="qz-wpt" data-act="qz-warp-sel" data-k="' + k + '" style="left:' + (p[0] * 100) + '%;top:' + (p[1] * 100) + '%"' +
      (w.sel === k ? ' data-on="1"' : '') + '>' + (k + 1) + '</button>';
  }).join('');
  return section('写真をまっすぐにする', f.name,
    '<p class="note" style="margin-top:0">① 動かしたい角（①〜④）を押してから、② 写真の中の、その角にしたいところを押してください。' +
      '角の順番は、左上→右上→右下→左下です。</p>' +
    '<div class="qz-wrap" data-act="qz-warp-put"><img src="' + esc(f.url) + '" alt="資料の写真">' + pts + '</div>' +
    '<div class="pair" style="margin-top:10px"><button class="btn" data-act="qz-warp-ok">この四すみでまっすぐにする</button>' +
      '<button class="btn ghost" data-act="qz-warp-cancel" style="flex:0 0 auto">やめる</button></div>');
}
function qzMakeView(){
  var sub = qzCurSub(), subs = qzSubs(), mk = qzState.mk;
  if(qzState.pv) return qzPvView();
  if(qzState.warp) return qzWarpView();
  var h = '';
  /* ===== 科目（#18 時間割から、いまの授業をおすすめ） ===== */
  var guess = qzGuessSub();
  h += section('どの科目の資料？', subs.length ? qzSubName(sub || (subs[0] && subs[0].id)) : null,
    subs.length ? qzSubChips('qz-sub', sub || (subs[0] && subs[0].id), false) +
      (guess && guess !== sub ? '<div class="pair" style="margin-top:8px"><button class="btn ghost" data-act="qz-sub" data-v="' + esc(guess) + '">' +
        'いまの授業（' + esc(qzSubName(guess)) + '）にする</button></div>' : '') +
      '<div class="pair" style="margin-top:8px"><button class="btn ghost" data-act="qz-go" data-tool="qz-lib">科目を足す・名前を変える・並べ替える</button></div>'
      : qzNoSubHtml());
  /* ===== 資料 ===== */
  h += section('授業の資料', qzState.files.length ? qzState.files.length + 'つ' : null,
    '<div class="pair"><button class="btn" data-act="qz-pick"' + (qzState.busy ? ' disabled' : '') + '>' +
      (qzState.busy === 'read' ? '読みこんでいます…' : '📎 資料をえらぶ') + '</button>' +
      '<button class="btn ghost" data-act="qz-shot"' + (qzState.busy ? ' disabled' : '') + ' style="flex:0 0 auto">📷 つづけて撮る</button></div>' +
    '<p class="note">授業の写真・黒板・ノート・スライド（.pptx）・配布資料（PDF・Word・テキスト・ZIP）。' + QZ_MAX_FILES + 'つまで。</p>' +
    (qzState.files.length ? '<div class="qz-files">' + qzState.files.map(qzFileRow).join('') + '</div>' : '') +
    qzOtherSrcHtml() +
    '<div class="field" style="margin-top:10px"><label class="f" for="qz_text">文章を貼りつける（写真のかわり・足したいことも）</label>' +
      '<textarea id="qz_text" rows="3" placeholder="授業のまとめ、教科書の文章、先生が言っていたことなど">' + esc(qzIn('qz_text')) + '</textarea></div>' +
    '<p class="note">' + QZ_WARN + '</p>');
  h += qzPicksHtml();
  /* ===== 資料につける名前・回・メモ（#20・#21・#37） ===== */
  h += section('資料のこと', qzState.mat.no ? '第' + qzState.mat.no + '回' : null,
    '<div class="qz-2col">' +
      '<div class="field"><label class="f" for="qz_mno">第何回？（なくてもよい）</label>' +
        '<input id="qz_mno" inputmode="numeric" placeholder="例：3" value="' + esc(qzIn('qz_mno', qzState.mat.no)) + '"></div>' +
      '<div class="field"><label class="f" for="qz_mat">日付</label>' +
        '<input id="qz_mat" type="date" value="' + esc(qzIn('qz_mat', qzState.mat.at || today())) + '"></div>' +
    '</div>' +
    '<div class="field"><label class="f" for="qz_mmemo">メモ（先生が「ここ出る」と言ったところなど）</label>' +
      '<textarea id="qz_mmemo" rows="2" placeholder="例：血液ガスの見かたは必ず出す、と言っていた">' + esc(qzIn('qz_mmemo', qzState.mat.memo)) + '</textarea></div>' +
    '<p class="note">メモに書いたところは、問題を作るときに大事にします。</p>');
  /* ===== どんな問題にする？ ===== */
  var n = mk.auto ? qzAutoN() : mk.n;
  h += section('どんな問題にする？', (mk.noai ? 'AIなし・' : '') + n + '問',
    '<label class="f">問題の数</label>' +
    '<div class="pillrow"><button data-act="qz-mk-auto" class="' + (mk.auto ? 'on' : '') + '">おまかせ（' + qzAutoN() + '問）</button>' +
      [5, 10, 15, 20].map(function(v){
        return '<button data-act="qz-mk-n" data-v="' + v + '" class="' + (!mk.auto && mk.n === v ? 'on' : '') + '">' + v + '問</button>';
      }).join('') + '</div>' +
    '<label class="f" style="margin-top:10px">問題の種類（えらんだ中から作ります）</label>' +
    '<div class="chips qz-chips">' + QZ_TYPES.filter(function(t){ return QZ_AI_TYPES.indexOf(t[0]) >= 0; }).map(function(t){
      return '<button data-act="qz-mk-type" data-v="' + t[0] + '" class="' + (mk.types.indexOf(t[0]) >= 0 ? 'on' : '') + '">' +
        esc(t[1]) + '</button>';
    }).join('') + '</div>' +
    '<label class="f" style="margin-top:10px">むずかしさ</label>' +
    '<div class="pillrow">' + [[1, '基本'], [2, 'ふつう'], [3, '応用']].map(function(x){
      return '<button data-act="qz-mk-lv" data-v="' + x[0] + '" class="' + (!mk.both && mk.lv === x[0] ? 'on' : '') + '">' + x[1] + '</button>';
    }).join('') +
      '<button data-act="qz-mk-tg" data-v="both" class="' + (mk.both ? 'on' : '') + '">やさしい＋むずかしい</button></div>' +
    '<button class="mini" style="margin-top:10px" data-act="qz-mk-more">' + (qzState.more ? '▾ くわしい設定' : '▸ くわしい設定') + '</button>' +
    (qzState.more ? qzMoreHtml(mk) : '') +
    qzMakeBtnHtml(n) +
    (mk.noai || aiReady() ? '' : '<p class="note">設定タブでAI（Gemini）のキーを登録すると使えます。「AIを使わずに作る」なら、いまのままでも作れます。</p>'));
  return h;
}
/* くわしい設定（#33・#34・#35・#42・#43・#47・#48・AIなし） */
function qzMoreHtml(mk){
  var tg = function(k, label, note){
    return '<div class="row"><div class="grow"><div class="t">' + esc(label) + '</div>' +
      (note ? '<div class="s">' + esc(note) + '</div>' : '') + '</div>' +
      '<button class="mini' + (mk[k] ? ' on' : '') + '" data-act="qz-mk-tg" data-v="' + k + '" aria-pressed="' + (mk[k] ? 'true' : 'false') + '">' +
      (mk[k] ? 'する' : 'しない') + '</button></div>';
  };
  return '<div class="qz-more">' +
    '<label class="f">言い方</label>' +
    '<div class="pillrow">' + [['', 'ふつう'], ['case', '事例（患者さんの様子から考える）'], ['exam', 'テストに出る形']].map(function(x){
      return '<button data-act="qz-mk-style" data-v="' + x[0] + '" class="' + (mk.style === x[0] ? 'on' : '') + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>' +
    tg('kokushi', '国試ふうの言い回しにする', '「〜はどれか。」の形に寄せます') +
    tg('two', '「2つ選べ」の問題もまぜる', '国試によく出る形です') +
    tg('en', '英語の用語も入れる', '医学英語の授業むけ') +
    tg('anki', '暗記カードも同時に作る', 'AIは追加で呼びません（「暗記」タブに入ります）') +
    tg('noai', 'AIを使わずに作る', '資料の字から、その場で穴うめ・○×を作ります（APIを使いません）') +
    '</div>';
}
/* 作るボタン（進みぐあい・止める・続き：#40・#45・#46） */
function qzMakeBtnHtml(n){
  var mk = qzState.mk;
  if(qzState.busy === 'make'){
    var p = qzState.prog || {};
    return '<div class="qz-prog"><div class="t">' + esc(p.step || '作っています…') + '</div>' +
      '<div class="s">' + Math.max(0, Math.round((Date.now() - (p.at || Date.now())) / 1000)) + '秒</div>' +
      '<div class="qz-bar"><i style="width:' + Math.min(95, 8 + Math.round((Date.now() - (p.at || Date.now())) / 300)) + '%"></i></div></div>' +
      '<button class="btn ghost" data-act="qz-make-stop">やめる</button>';
  }
  var again = qzPendOf();
  return '<button class="btn" style="margin-top:12px" data-act="qz-make"' + (qzState.busy ? ' disabled' : '') + '>' +
    (mk.noai ? '⚡ AIを使わずに' + n + '問つくる' : '✨ この資料から' + n + '問つくる') + '</button>' +
    (again ? '<button class="btn ghost" style="margin-top:8px" data-act="qz-make-again">前に作れなかった分（' + esc(again.title || '資料') + '）を、もう一度ためす</button>' : '');
}
/* ほかの画面からもらう（#12 録音・#13 手書きノート・#14 ドライブ） */
function qzOtherSrcHtml(){
  var btns = [];
  if(typeof rsLecText === 'function'){
    var lec = '';
    try{ lec = rsLecText(); }catch(e){}
    if(lec && lec.length > 40) btns.push('<button class="btn ghost" data-act="qz-src-lec">🎙️ 講義の録音の文字（' + lec.length + '字）を使う</button>');
  }
  if(typeof l2GnSearch === 'function' && typeof gasReady === 'function' && gasReady()){
    btns.push('<button class="btn ghost" data-act="qz-go" data-tool="l2-notes">✍️ 手書きノートをさがす</button>');
  }
  if(typeof gasReady === 'function' && gasReady()){
    btns.push('<button class="btn ghost" data-act="qz-src-drive">📂 ドライブの「講義資料」から取りこむ</button>');
  }
  return btns.length ? '<div class="pair" style="margin-top:8px">' + btns.join('') + '</div>' : '';
}
/* ===== AIが読んだノート（ドライブの講義資料・Goodnotes）からもらう（#13・#14） =====
   橋わたし（Google連携）が読んで「メモ」にしてくれたものを、そのまま資料として使う。
   もう一度AIに読ませないので、APIは増えない。 */
function qzNoteSrcs(){
  return (S.notes || []).filter(function(n){
    return n && !n.del && String(n.body || '').length >= 120;
  }).sort(function(a, b){ return toNum(b.mt) - toNum(a.mt); }).slice(0, 12);
}
function qzDrivePull(){
  var list = qzNoteSrcs();
  if(!list.length){
    toast('取りこめるメモがありません。設定 › Google連携で「講義資料」フォルダを使うと、AIが読んでメモにします', true);
    return;
  }
  qzState.picks = list.map(function(n){ return { id:n.id, title:n.title || '（無題）', len:String(n.body || '').length, mt:n.mt }; });
  render(); window.scrollTo(0, 0);
}
function qzPicksHtml(){
  if(!qzState.picks) return '';
  return section('ノートから取りこむ', qzState.picks.length + 'こ',
    qzState.picks.map(function(p){
      return '<div class="row"><div class="grow"><div class="t">' + esc(p.title) + '</div>' +
        '<div class="s">' + p.len + '字</div></div>' +
        '<button class="mini" data-act="qz-src-note" data-id="' + esc(p.id) + '">これを使う</button></div>';
    }).join('') +
    '<button class="mini" style="margin-top:8px" data-act="qz-src-close">とじる</button>' +
    '<p class="note">Googleドライブの「くらしの手帳 講義資料」フォルダやGoodnotesのノートを、橋わたしのAIが読んでメモにしたものです。</p>');
}
/* 資料の量から、ちょうどよい問題数を決める（#39） */
function qzAutoN(){
  var len = 0;
  qzState.files.forEach(function(f){ len += (f.text || '').length + (f.url ? 600 : 0); });
  len += String(qzV('qz_text') || qzIn('qz_text') || '').length;
  if(!len) return 10;
  var n = Math.round(len / 350);
  return Math.max(5, Math.min(QZ_MAX_Q, n));
}
/* いまの時間の授業から、科目をおすすめする（#18） */
function qzGuessSub(){
  if(typeof classesForDate !== 'function') return '';
  var list = [];
  try{ list = classesForDate(today()).filter(function(c){ return !c.off; }); }catch(e){ return ''; }
  if(!list.length) return '';
  var now = (new Date()).getHours() * 60 + (new Date()).getMinutes(), best = null, bestD = 1e9;
  list.forEach(function(c){
    var st = 0;
    try{ st = minutesOf(S.commute.periods[c.period - 1]); }catch(e){}
    if(st == null) return;
    var d = Math.abs(now - st);
    if(d < bestD){ bestD = d; best = c; }
  });
  if(!best) return '';
  var hit = qzSubs().filter(function(x){ return x.name === best.name || (x.link && x.link === best.name); })[0];
  return hit ? hit.id : '';
}
/* できた問題を見て、えらんで入れる */
function qzPvItemHtml(x, i){
  var body = '';
  if(x.qt === 'mc' || x.qt === 'tf'){
    body = '<div class="qz-pvc">' + x.c.map(function(c, k){
      var on = x.a.indexOf(k) >= 0;
      return '<div class="' + (on ? 'ok' : '') + '">' + (on ? '✓ ' : QZ_NUM[k] + ' ') + esc(c) + '</div>';
    }).join('') + '</div>';
  }else if(x.qt === 'order'){
    body = '<div class="qz-pvc">' + (x.c || []).map(function(c, k){
      return '<div>' + (k + 1) + '. ' + esc(c) + '</div>';
    }).join('') + '</div>';
  }else if(x.qt === 'match'){
    body = '<div class="qz-pvc">' + (x.pairs || []).map(function(p){
      return '<div>' + esc(p[0]) + ' ＝ ' + esc(p[1]) + '</div>';
    }).join('') + '</div>';
  }else if(x.qt === 'calc'){
    body = '<div class="qz-pvc"><div class="ok">✓ ' + esc(x.at) + (x.un ? ' ' + esc(x.un) : '') + '</div>' +
      (x.how ? '<div class="s">' + esc(x.how) + '</div>' : '') + '</div>';
  }else{
    body = '<div class="qz-pvc"><div class="ok">✓ ' + esc(x.at) + '</div>' +
      ((x.alt || []).length ? '<div class="s">ほかの言い方：' + esc(x.alt.join('／')) + '</div>' : '') + '</div>';
  }
  return '<label class="row qz-pv">' +
    '<input type="checkbox" data-act="qz-pv-toggle" data-i="' + i + '"' + (x.on ? ' checked' : '') + '>' +
    '<div class="grow">' +
      '<div class="qz-badges"><span class="qz-b">' + esc(qzTypeName(x.qt)) + '</span>' +
        (x.ch ? '<span class="qz-b sub">' + esc(x.ch) + '</span>' : '') +
        (x.tag ? '<span class="qz-b sub">' + esc(x.tag) + '</span>' : '') +
        (x.pg ? '<span class="qz-b sub">' + esc(x.pg) + '</span>' : '') +
        '<span class="qz-b sub">' + ['', '基本', 'ふつう', '応用'][x.lv] + '</span></div>' +
      '<div class="t">' + esc(x.q) + '</div>' + body +
      (x.exp ? '<div class="s qz-exp">' + esc(x.exp) + '</div>' : '') +
      '<button class="mini" data-act="qz-pv-remake" data-i="' + i + '"' + (qzState.busy ? ' disabled' : '') + '>' +
        (qzState.busy === 'remake' ? '作り直しています…' : '🔁 この問題は変（作り直す）') + '</button>' +
    '</div></label>';
}
function qzPvView(){
  var pv = qzState.pv, on = pv.items.filter(function(x){ return x.on; }).length;
  return section('できた問題', on + '／' + pv.items.length + '問をえらんでいます',
    '<div class="field"><label class="f" for="qz_pv_title">資料の名前</label>' +
      '<input id="qz_pv_title" value="' + esc(qzIn('qz_pv_title', pv.title)) + '" placeholder="例：第3回 呼吸器のしくみ"></div>' +
    (pv.summary ? '<div class="qz-sum"><b>資料の要点</b><div>' + esc(pv.summary) + '</div></div>' : '') +
    '<div class="pillrow"><button data-act="qz-pv-all" data-v="1">ぜんぶえらぶ</button>' +
      '<button data-act="qz-pv-all" data-v="0">ぜんぶはずす</button></div>' +
    pv.items.map(qzPvItemHtml).join('') +
    '<div class="pair" style="margin-top:10px"><button class="btn" data-act="qz-pv-add">' +
      'チェックした' + on + '問を「' + esc(pv.sub ? qzSubName(pv.sub) : '科目なし') + '」に入れる</button>' +
      '<button class="btn ghost" data-act="qz-pv-cancel" style="flex:0 0 auto">やめる</button></div>' +
    '<p class="note">' + esc(QZ_SRC_AI) + '</p>');
}

/* ============================== 画面：解く ============================== */
var QZ_MODES = [['due', '復習', '日がきた問題'], ['new', 'はじめて', 'まだ解いていない問題'],
                ['wrong', 'まちがい直し', '最後にまちがえた問題'], ['star', '星', '星をつけた問題'], ['all', 'ぜんぶ', '科目のぜんぶ']];
function qzDrillView(){
  var r = qzState.run;
  if(r) return r.end ? qzEndView(r) : qzQView(r);
  var sub = qzCurSub(), st = qzStats(sub), dc = qzDayCount(today());
  var h = '';
  if(!qzQs('').length){
    return section('解く', null, '<div class="empty">問題がまだありません。</div>' +
      '<button class="btn" data-act="qz-go" data-tool="qz-make">資料から問題を作る</button>');
  }
  var saved = qzRunSaved();
  if(saved){
    h += section('とちゅうまで解いた分があります', (saved.i + 1) + ' / ' + saved.ids.length + '問目',
      '<div class="pair"><button class="btn" data-act="qz-resume">続きから解く</button>' +
      '<button class="btn ghost" data-act="qz-resume-drop" style="flex:0 0 auto">やめる</button></div>');
  }
  h += section('今日のようす', null,
    '<div class="stats">' + qzStat('今日といた', dc.n + '問') + qzStat('正かい', dc.n ? Math.round(dc.ok * 100 / dc.n) + '%' : '—') +
      qzStat('つづけて', qzStreak() + '日') + qzStat('ぜんぶで', qzQs('').length + '問') + '</div>');
  h += section('どの科目？', null, qzSubChips('qz-sub', sub, true));
  var counts = {};
  QZ_MODES.forEach(function(m){ counts[m[0]] = qzPoolFor(sub, m[0]).length; });
  /* まだ自分でえらんでいないときは、問題のあるところをはじめに出す */
  if(!qzState.modePicked && !counts[qzState.drillMode]){
    var first = QZ_MODES.filter(function(m){ return counts[m[0]]; })[0];
    if(first) qzState.drillMode = first[0];
  }
  h += section('どれを解く？', null,
    '<div class="qz-modes">' + QZ_MODES.map(function(m){
      return '<button data-act="qz-mode" data-v="' + m[0] + '" class="' + (qzState.drillMode === m[0] ? 'on' : '') + '">' +
        '<b>' + esc(m[1]) + '</b><i>' + counts[m[0]] + '問</i><span>' + esc(m[2]) + '</span></button>';
    }).join('') + '</div>' +
    '<label class="f" style="margin-top:10px">1回に出す数</label>' +
    '<div class="pillrow">' + [5, 10, 20, 50].map(function(n){
      return '<button data-act="qz-n" data-v="' + n + '" class="' + (qzState.drillN === n ? 'on' : '') + '">' + n + '問</button>';
    }).join('') + '</div>' +
    '<button class="btn" style="margin-top:12px" data-act="qz-start">' + (counts[qzState.drillMode] ? 'はじめる' : '（この中には問題がありません）') + '</button>');
  h += section('この科目のようす', qzSubTitle(sub),
    '<div class="stats">' + qzStat('問題', st.total + '問') + qzStat('復習', st.due + '問') +
      qzStat('正かい率', st.rate == null ? '—' : st.rate + '%') + qzStat('まちがい', st.wrong + '問') + '</div>');
  return h;
}
function qzCurQ(){
  var r = qzState.run;
  return r ? qzItem(r.ids[r.i]) : null;
}
/* その問題の答え方（choice 選ぶ／text 書いて自分で○×／order 並べかえ／match 組み合わせ／calc 計算） */
function qzKind(q){
  if(q.qt === 'order' || q.qt === 'match' || q.qt === 'calc') return q.qt;
  if(q.qt === 'cloze' || q.qt === 'short') return 'text';
  return 'choice';
}
function qzQView(r){
  var q = qzCurQ();
  if(!q){ return section('解く', null, '<div class="empty">問題が見つかりませんでした。</div><button class="btn" data-act="qz-quit">おわる</button>'); }
  var shown = !!r.shown, kind = qzKind(q);
  var h = '<div class="pillrow studyback"><button data-act="qz-quit">‹ やめる</button>' +
    '<b class="studyttl">' + esc((r.i + 1) + ' / ' + r.ids.length) + '</b></div>';
  var head = '<div class="qz-badges"><span class="qz-b">' + esc(qzTypeName(q.qt)) + '</span>' +
    '<span class="qz-b sub">' + esc(qzSubLabel(q.sub)) + '</span>' +
    (q.ch ? '<span class="qz-b sub">' + esc(q.ch) + '</span>' : '') +
    (q.tag ? '<span class="qz-b sub">' + esc(q.tag) + '</span>' : '') +
    '<button class="qz-star' + (q.star ? ' on' : '') + '" data-act="qz-star" data-id="' + esc(q.id) + '" aria-label="星をつける">' + (q.star ? '★' : '☆') + '</button></div>';
  var body = head + '<div class="qz-q">' + esc(q.q) + '</div>';
  if(kind === 'choice') body += qzChoiceHtml(q, r, shown);
  else if(kind === 'order') body += qzOrderHtml(q, r, shown);
  else if(kind === 'match') body += qzMatchHtml(q, r, shown);
  else if(kind === 'calc') body += qzCalcHtml(q, r, shown);
  else{
    body += '<div class="field"><input id="qz_ans" placeholder="答えを書く（書かなくても見られます）" value="' + esc(qzIn('qz_ans')) + '"' + (shown ? ' disabled' : '') + '></div>';
    if(!shown) body += '<button class="btn" data-act="qz-show">答えを見る</button>';
  }
  if(shown){
    var okNow = r.res === 1;
    if(kind === 'text'){
      var typed = String(r.typed || '').trim();
      var auto = qzTextMatch(typed, q);
      body += '<div class="qz-res ' + (auto ? 'ok' : '') + '">正しい答え：<b>' + esc(qzAnswerText(q)) + '</b>' +
        ((q.alt || []).length ? '<div class="s">ほかの言い方：' + esc(q.alt.join('／')) + '</div>' : '') +
        (typed ? '<div class="s">書いた答え：' + esc(typed) + (auto ? '（合っていそうです）' : '') + '</div>' : '') + '</div>';
    }else{
      body += '<div class="qz-res ' + (okNow ? 'ok' : 'ng') + '">' + (okNow ? '⭕️ 正かい' : '❌ ざんねん') +
        (kind === 'choice' ? '' : '<div class="s">正しい答え：' + esc(qzAnswerText(q)) + '</div>') + '</div>';
    }
    if(q.qt === 'calc' && q.how) body += '<div class="qz-exp2"><b>計算のしかた</b><div>' + esc(q.how) + '</div></div>';
    if(q.exp) body += '<div class="qz-exp2"><b>解説</b><div>' + esc(q.exp) + '</div></div>';
    body += qzWhyHtml(q);
    body += '<div class="qz-src">出典：' + esc(q.src || QZ_SRC_AI) + '</div>';
    if(kind === 'text'){
      body += '<div class="pair"><button class="btn" data-act="qz-grade" data-v="1">できた</button>' +
        '<button class="btn ghost" data-act="qz-grade" data-v="0">できなかった</button></div>';
    }else{
      body += '<button class="btn" data-act="qz-next">' + (r.i + 1 >= r.ids.length ? 'おわる' : 'つぎへ') + '</button>';
    }
  }
  return h + section(qzSubName(q.sub), 'のこり ' + (r.ids.length - r.i - 1) + '問', body);
}
/* ===== 4択・○× ===== */
function qzChoiceHtml(q, r, shown){
  var view = qzViewOrder(q);
  var h = '<div class="qz-choices">' + view.map(function(k, pos){
    var cls = '';
    if(shown){
      if(q.a.indexOf(k) >= 0) cls = ' ok';
      else if(r.sel.indexOf(k) >= 0) cls = ' ng';
    }else if(r.sel.indexOf(k) >= 0) cls = ' sel';
    return '<button class="qz-ch' + cls + '"' + (shown ? ' disabled' : '') + ' data-act="qz-pick-ch" data-i="' + k + '">' +
      '<span class="n">' + QZ_NUM[pos] + '</span><span class="t">' + esc(q.c[k]) + '</span></button>';
  }).join('') + '</div>';
  if(!shown && q.a.length > 1) h += '<button class="btn" data-act="qz-check">答え合わせ（' + q.a.length + 'つえらぶ）</button>';
  return h;
}
/* ===== 並べかえ（#29・#129） ===== */
function qzOrderHtml(q, r, shown){
  var view = qzViewOrder(q), picked = r.ord || [];
  if(shown){
    return '<div class="qz-ordres">' + q.c.map(function(t, k){
      var mine = picked[k];
      var ok = mine === k;
      return '<div class="qz-ordrow' + (ok ? ' ok' : ' ng') + '"><span class="n">' + (k + 1) + '</span>' +
        '<span class="t">' + esc(t) + '</span>' +
        (ok ? '<span class="mk">✓</span>' : '<span class="mk">' + (mine == null ? '—' : esc(String(q.c[mine]).slice(0, 12) + '…')) + '</span>') + '</div>';
    }).join('') + '</div>';
  }
  var h = '<p class="note" style="margin-top:0">正しいと思う順に、上から押してください。</p>';
  h += '<div class="qz-ordpick">' + picked.map(function(k, pos){
    return '<div class="qz-ordrow sel"><span class="n">' + (pos + 1) + '</span><span class="t">' + esc(q.c[k]) + '</span></div>';
  }).join('') + '</div>';
  h += '<div class="qz-choices">' + view.filter(function(k){ return picked.indexOf(k) < 0; }).map(function(k){
    return '<button class="qz-ch" data-act="qz-ord-pick" data-i="' + k + '"><span class="t">' + esc(q.c[k]) + '</span></button>';
  }).join('') + '</div>';
  if(picked.length) h += '<button class="mini" data-act="qz-ord-undo">ひとつ戻す</button>';
  if(picked.length === q.c.length) h += '<button class="btn" data-act="qz-check">答え合わせ</button>';
  return h;
}
/* ===== 組み合わせ（#30） ===== */
function qzMatchHtml(q, r, shown){
  var view = qzViewOrder(q), sel = r.mat || {};
  return '<div class="qz-match">' + (q.pairs || []).map(function(p, li){
    var mine = sel[li];
    var right = '';
    if(shown){
      var ok = mine === li;
      right = '<div class="qz-mres ' + (ok ? 'ok' : 'ng') + '">' + (ok ? '✓ ' : '✗ ') +
        esc(mine == null ? '（えらんでいません）' : q.pairs[mine][1]) +
        (ok ? '' : '<span class="s"> → 正しくは ' + esc(p[1]) + '</span>') + '</div>';
    }else{
      right = '<div class="chips qz-chips">' + view.map(function(ri){
        return '<button data-act="qz-mat-pick" data-l="' + li + '" data-r="' + ri + '" class="' + (mine === ri ? 'on' : '') + '">' +
          esc(q.pairs[ri][1]) + '</button>';
      }).join('') + '</div>';
    }
    return '<div class="qz-mrow"><div class="t">' + esc(p[0]) + '</div>' + right + '</div>';
  }).join('') + '</div>' +
  (!shown && Object.keys(sel).length === (q.pairs || []).length ? '<button class="btn" data-act="qz-check">答え合わせ</button>' : '');
}
/* ===== 計算（#32） ===== */
function qzCalcHtml(q, r, shown){
  var h = '<div class="qz-calc"><input id="qz_ans" inputmode="decimal" placeholder="数で答える" value="' + esc(qzIn('qz_ans')) + '"' +
    (shown ? ' disabled' : '') + '>' + (q.un ? '<span class="u">' + esc(q.un) + '</span>' : '') + '</div>';
  if(!shown) h += '<button class="btn" data-act="qz-check">答え合わせ</button>';
  else if(r.typed) h += '<div class="qz-res">書いた答え：' + esc(r.typed) + '</div>';
  return h;
}
/* ===== まちがえた問題の「なぜ？」（#72） =====
   まず組みこみの表（基準値・略語・薬）でわかることを出し、足りないときだけAIに聞く。 */
function qzWhyKey(id){ return 'quiz:why:' + id; }
function qzWhyOf(id){
  var v = (S.kmData || {})[qzWhyKey(id)];
  return (v && typeof v === 'object' && v.text) ? v : null;
}
function qzWhySet(id, text, from){
  S.kmData = (S.kmData && typeof S.kmData === 'object' && !Array.isArray(S.kmData)) ? S.kmData : {};
  S.kmData[qzWhyKey(id)] = { text:String(text).slice(0, 1200), from:from || '', mt:Date.now() };
  touch('kmData');
}
function qzWhyHtml(q){
  var r = qzState.run;
  if(r && r.res === 1) return '';                     /* 正かいのときは出さない */
  var w = qzWhyOf(q.id);
  if(w){
    return '<div class="qz-exp2 qz-why"><b>なぜ？（' + esc(w.from === 'ai' ? 'AI' : '手帳の中のことば') + '）</b>' +
      '<div>' + esc(w.text) + '</div></div>';
  }
  var busy = qzState.busy === 'why';
  return '<button class="mini" data-act="qz-why" data-id="' + esc(q.id) + '"' + (busy ? ' disabled' : '') + '>' +
    (busy ? 'しらべています…' : '❓ なぜまちがい？をしらべる') + '</button>';
}
/* 組みこみの表でわかるか → だめならAI（1問ずつ・答えは保存して2回目は呼ばない） */
async function qzWhy(id){
  var q = qzItem(id);
  if(!q || qzState.busy) return;
  if(qzWhyOf(id)){ qzRender(); return; }
  var local = (typeof qz2Why === 'function') ? qz2Why(q) : '';
  if(local){
    qzWhySet(id, local, 'local');
    commit();
    return;
  }
  if(!aiReady()){ toast('手帳の中では見つかりませんでした。設定タブでAIのキーを登録すると、AIが説明します', true); return; }
  qzState.busy = 'why'; qzRender();
  try{
    var text = await aiGenerate({
      contents:[{ role:'user', parts:[{ text:'看護学生に、次の問題のまちがえやすいところを説明してください。\n' +
        '・正しい答えと、なぜそうなるかを2〜3文で。\n・まちがえやすい似たことばがあれば、そのちがいも1文で。\n・あいさつや前置きは書かない。\n\n' +
        '問題：' + q.q + '\n答え：' + qzAnswerText(q) + (q.exp ? '\n解説：' + q.exp : '') }] }],
      temperature:0.2, maxTokens:512, tag:'qz-why' });
    var t = String(text || '').trim();
    if(!t) throw new Error('答えが空でした');
    qzWhySet(id, t, 'ai');
    commit();
  }catch(e){
    toast('しらべられませんでした：' + e.message, true);
  }finally{
    qzState.busy = ''; qzRender();
  }
}
/* 書いた答えが、正しい答えとだいたい同じか */
function qzTextMatch(typed, q){
  var t = qzNorm(typed);
  if(!t) return false;
  var list = [q.at].concat(Array.isArray(q.alt) ? q.alt : []);
  return list.some(function(s){
    var n = qzNorm(s);
    return n && (n === t || (n.length >= 3 && (n.indexOf(t) >= 0 || t.indexOf(n) >= 0)));
  });
}
function qzEndView(r){
  var rate = r.n ? Math.round(r.ok * 100 / r.n) : 0;
  var wrong = r.wrong.map(function(id){ return qzItem(id); }).filter(Boolean);
  return section('おつかれさま', r.n + '問',
    '<div class="stats">' + qzStat('といた', r.n + '問') + qzStat('正かい', r.ok + '問') + qzStat('正かい率', rate + '%') + '</div>' +
    (wrong.length
      ? '<label class="f" style="margin-top:10px">まちがえた問題（明日また出ます）</label>' +
        wrong.map(function(q){
          return '<div class="row qz-wrow"><div class="grow"><div class="t">' + esc(q.q) + '</div>' +
            '<div class="s">答え：' + esc(qzAnswerText(q)) + '</div></div>' +
            '<button class="mini' + (q.star ? ' on' : '') + '" data-act="qz-star" data-id="' + esc(q.id) + '">' + (q.star ? '★' : '☆') + '</button></div>';
        }).join('')
      : '<div class="qz-res ok" style="margin-top:10px">ぜんぶ正かいです！</div>') +
    '<div class="pair" style="margin-top:12px">' +
      (wrong.length ? '<button class="btn" data-act="qz-again-wrong">まちがえた' + wrong.length + '問をもう一回</button>' : '') +
      '<button class="btn ghost" data-act="qz-quit">おわる</button></div>');
}
/* 出題をはじめる */
function qzStart(sub, mode, n){
  var list = qzPoolFor(sub, mode);
  if(!list.length){ toast('この中には問題がありません', true); return false; }
  /* 復習は、日がきた順に。ほかはばらばらに */
  if(mode === 'due'){
    list.sort(function(a, b){ return String((qzLogOf(a.id) || {}).due).localeCompare(String((qzLogOf(b.id) || {}).due)); });
  }else{
    qzShuffle(list);
  }
  qzRunSet(list.slice(0, Math.max(1, n || 10)).map(function(x){ return x.id; }), sub, mode);
  return true;
}
function qzRunSet(ids, sub, mode, extra){
  qzState.run = Object.assign({ sub:sub || '', mode:mode || 'all', ids:ids, i:0, sel:[], ord:[], mat:{}, shuf:null, cur:'',
    shown:0, res:0, typed:'', ok:0, n:0, wrong:[], end:0, at:Date.now() }, extra || {});
  qzClearForm(['qz_ans']);
  qzRunSave();
  render(); window.scrollTo(0, 0);
}
/* ===== 中断して、あとから続きから（#63） =====
   解いている途中の状態を、この端末だけに覚えておく（ほかの端末には送らない）。 */
function qzRunKey(){ return KEY + ':quizrun'; }
function qzRunSave(){
  var r = qzState.run;
  try{
    if(!r || r.end || !r.ids || r.i >= r.ids.length) localStorage.removeItem(qzRunKey());
    else localStorage.setItem(qzRunKey(), JSON.stringify({ run:r, at:Date.now() }));
  }catch(e){}
}
function qzRunSaved(){
  try{
    var o = JSON.parse(localStorage.getItem(qzRunKey()) || 'null');
    if(!o || !o.run || !Array.isArray(o.run.ids) || !o.run.ids.length) return null;
    if(Date.now() - toNum(o.at) > 7 * 86400000) return null;          /* 1週間より前のものは出さない */
    var left = o.run.ids.filter(function(id){ return qzItem(id); });
    if(!left.length || o.run.i >= o.run.ids.length) return null;
    return o.run;
  }catch(e){ return null; }
}
function qzRunResume(){
  var r = qzRunSaved();
  if(!r){ toast('続きはありません', true); return false; }
  r.ids = r.ids.filter(function(id){ return qzItem(id); });
  if(r.i >= r.ids.length) r.i = Math.max(0, r.ids.length - 1);
  r.shuf = null; r.cur = '';
  qzState.run = r;
  render(); window.scrollTo(0, 0);
  return true;
}
function qzRunDrop(){ try{ localStorage.removeItem(qzRunKey()); }catch(e){} }
function qzGrade(ok){
  var r = qzState.run, q = qzCurQ();
  if(!r || !q) return;
  if(!r.shown){ r.shown = 1; }
  r.res = ok ? 1 : 0;
  r.n++;
  if(ok) r.ok++;
  else if(r.wrong.indexOf(q.id) < 0) r.wrong.push(q.id);
  qzLogAnswer(q.id, ok);
  persist();
  qzRunSave();
  qzPushSoon();
}
function qzNext(){
  var r = qzState.run;
  if(!r) return;
  r.i++; r.sel = []; r.ord = []; r.mat = {}; r.shuf = null; r.cur = ''; r.shown = 0; r.res = 0; r.typed = '';
  qzClearForm(['qz_ans']);
  if(r.i >= r.ids.length){
    r.end = 1;
    qzPushNow();
    if(r.n && typeof petStudyReward === 'function'){ try{ petStudyReward(r.n); }catch(e){} }
  }
  qzRunSave();
  render(); window.scrollTo(0, 0);
}
/* 1問ごとには同期しない（テンポよく解いても止まらないよう、20秒ごと・おわったときにまとめて送る） */
var qzPushTimer = null;
function qzPushSoon(){
  clearTimeout(qzPushTimer);
  qzPushTimer = setTimeout(function(){ qzPushTimer = null; pushRemote(); }, 20000);
}
function qzPushNow(){ clearTimeout(qzPushTimer); qzPushTimer = null; commit(); }

/* ============================== 画面：科目と資料の整理 ============================== */
var QZ_LIB_TABS = [['sub', '科目'], ['mat', '資料'], ['q', '問題'], ['hand', '自分で作る']];
function qzLibView(){
  var sub = qzCurSub();
  var h = '<div class="pillrow">' + QZ_LIB_TABS.map(function(t){
    return '<button data-act="qz-lib-tab" data-v="' + t[0] + '" class="' + (qzState.libTab === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
  }).join('') + '</div>';
  if(qzState.libTab === 'sub') return h + qzSubManageView();
  if(qzState.libTab === 'q') return h + qzQListView(sub);
  if(qzState.libTab === 'hand') return h + qzHandView(sub);
  return h + qzMatListView(sub);
}
/* ===== 科目の管理（追加・名前を変える・並べ替え・しまう・消す） ===== */
function qzSubRowHtml(s, i, n){
  var qn = qzQs(s.id).length, mn = qzMats(s.id).length;
  var a = ' data-id="' + esc(s.id) + '"';
  var open = qzState.subEdit === s.id;
  var h = '<div class="row qz-srow' + (s.arch ? ' off' : '') + '">' +
    '<span class="qz-sic" aria-hidden="true">' + esc(s.icon || '📘') + '</span>' +
    '<div class="grow"><div class="t">' + esc(s.name) + (s.arch ? '（しまってあります）' : '') + '</div>' +
      '<div class="s">問題 ' + qn + '問・資料 ' + mn + 'こ' + (qzTodoCount(s.id) ? '・今日 ' + qzTodoCount(s.id) + '問' : '') + '</div></div>' +
    '<button class="mini" data-act="qz-sub-mv"' + a + ' data-d="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="上へ">↑</button>' +
    '<button class="mini" data-act="qz-sub-mv"' + a + ' data-d="1"' + (i === n - 1 ? ' disabled' : '') + ' aria-label="下へ">↓</button>' +
    '<button class="mini' + (open ? ' on' : '') + '" data-act="qz-sub-edit"' + a + '>直す</button></div>';
  if(!open) return h;
  h += '<div class="qz-sedit">' +
    '<div class="field"><label class="f" for="qz_rn_' + esc(s.id) + '">名前</label>' +
      '<input id="qz_rn_' + esc(s.id) + '" value="' + esc(qzIn('qz_rn_' + s.id, s.name)) + '" maxlength="40"></div>' +
    '<label class="f">しるし</label>' +
    '<div class="chips qz-icons">' + QZ_ICONS.map(function(ic){
      return '<button data-act="qz-sub-icon"' + a + ' data-v="' + esc(ic) + '" class="' + ((s.icon || '📘') === ic ? 'on' : '') + '">' + ic + '</button>';
    }).join('') + '</div>' +
    '<div class="pair" style="margin-top:8px"><button class="btn" data-act="qz-sub-save"' + a + '>名前を保存</button>' +
      '<button class="btn ghost" data-act="qz-sub-arch"' + a + ' style="flex:0 0 auto">' + (s.arch ? 'もどす' : 'しまう') + '</button></div>';
  if(qzState.delAsk === s.id){
    h += '<div class="qz-ask"><div class="t">「' + esc(s.name) + '」を消します。中の問題' + qzQs(s.id).length + '問と資料' + qzMats(s.id).length + 'こは？</div>' +
      '<div class="pair"><button class="btn ghost" data-act="qz-sub-del"' + a + ' data-w="0">のこす（科目なしにする）</button>' +
      '<button class="btn ghost" data-act="qz-sub-del"' + a + ' data-w="1">いっしょに消す</button></div>' +
      '<button class="mini" data-act="qz-del-cancel">やめる</button></div>';
  }else{
    h += '<button class="mini" style="margin-top:8px" data-act="qz-sub-delask"' + a + '>この科目を消す</button>';
  }
  return h + '</div>';
}
function qzSubManageView(){
  var subs = qzSubsAll();
  var n = (typeof termCourses === 'function' ? termCourses() : []).length;
  return section('科目', subs.length + '科目',
    (subs.length ? subs.map(function(s, i){ return qzSubRowHtml(s, i, subs.length); }).join('')
                 : '<div class="empty">科目がまだありません。</div>') +
    '<p class="note">↑↓ で並べ替えると、ほかの画面でもこの順に出ます。「しまう」と、えらぶところに出なくなります（問題は消えません）。</p>') +
  section('科目を足す', null,
    '<div class="field"><input id="qz_newsub" placeholder="科目の名前（例：基礎看護学）" value="' + esc(qzIn('qz_newsub')) + '" maxlength="40"></div>' +
    '<div class="pair"><button class="btn" data-act="qz-sub-add">足す</button>' +
    (n ? '<button class="btn ghost" data-act="qz-sub-import">時間割の' + n + '科目から足す</button>' : '') + '</div>');
}
/* ===== 資料の一覧 ===== */
function qzMatListView(sub){
  var list = qzMats(sub === 'none' ? '' : sub).filter(function(m){ return sub !== 'none' || !m.sub; });
  return section('どの科目？', qzSubTitle(sub), qzSubChips('qz-sub', sub, true)) +
    section('資料', list.length + 'こ',
      list.length ? list.map(qzMatRowHtml).join('')
        : '<div class="empty">資料がまだありません。</div><button class="btn" data-act="qz-go" data-tool="qz-make">資料から問題を作る</button>');
}
function qzMatRowHtml(m){
  var a = ' data-id="' + esc(m.id) + '"';
  var open = qzState.matOpen === m.id;
  var qn = qzQsOfMat(m.id).length;
  var h = '<div class="row qz-mrow" data-act="qz-mat-open"' + a + ' role="button">' +
    '<span class="qz-fic" aria-hidden="true">' + (m.kind === 'photo' ? '🖼' : m.kind === 'pdf' ? '📄' : m.kind === 'slide' ? '📊' : '📝') + '</span>' +
    '<div class="grow"><div class="t">' + esc(m.title || '資料') + '</div>' +
      '<div class="s">' + esc(qzMd(m.at)) + '・' + esc(qzSubName(m.sub)) + '・問題 ' + qn + '問</div></div>' +
    '<span class="mini">' + (open ? '▾' : '▸') + '</span></div>';
  if(!open) return h;
  h += '<div class="qz-mbody">';
  if((m.photos || []).length){
    h += '<div class="qz-thumbs">' + m.photos.map(function(pid){
      return '<img data-pid="' + esc(pid) + '" alt="資料の写真" data-act="memo-photo-view" data-id="' + esc(pid) + '">';
    }).join('') + '</div>';
  }
  if(m.text) h += '<div class="qz-mtext">' + esc(m.text.slice(0, 1200)) + (m.text.length > 1200 || m.cut ? '…' : '') + '</div>';
  h += '<label class="f" style="margin-top:8px">科目を変える</label>' + qzSubChips('qz-mat-sub', m.sub, false, a);
  h += '<div class="pair" style="margin-top:8px">' +
    (m.text ? '<button class="btn ghost" data-act="qz-mat-more"' + a + '>この資料からもっと作る</button>' : '') +
    '<button class="mini" data-act="qz-mat-delask"' + a + ' style="flex:0 0 auto">消す</button></div>';
  if(qzState.delAsk === m.id){
    h += '<div class="qz-ask"><div class="t">「' + esc(m.title) + '」を消します。この資料から作った' + qn + '問は？</div>' +
      '<div class="pair"><button class="btn ghost" data-act="qz-mat-del"' + a + ' data-w="0">のこす</button>' +
      '<button class="btn ghost" data-act="qz-mat-del"' + a + ' data-w="1">いっしょに消す</button></div>' +
      '<button class="mini" data-act="qz-del-cancel">やめる</button></div>';
  }
  return h + '</div>';
}
/* ===== 問題の一覧 ===== */
function qzQFilter(sub){
  var nq = qzNorm(String(qzIn('qz_qfind') || '').trim());
  var list = qzQs(sub === 'none' ? '' : sub).filter(function(x){ return sub !== 'none' || !x.sub; });
  if(nq) list = list.filter(function(x){ return qzNorm(x.q + (x.c || []).join('') + x.at + x.exp + x.tag).indexOf(nq) >= 0; });
  return list.sort(function(a, b){ return toNum(b.mt) - toNum(a.mt); });
}
function qzQResults(sub){
  var list = qzQFilter(sub);
  if(!list.length) return '<div class="empty">問題がありません。</div>';
  return list.slice(0, 200).map(qzQRowHtml).join('') +
    (list.length > 200 ? '<p class="note">多いので、新しい200問だけ出しています。</p>' : '');
}
function qzQListView(sub){
  return section('どの科目？', qzSubTitle(sub), qzSubChips('qz-sub', sub, true)) +
    section('問題', qzQFilter(sub).length + '問',
      '<div class="field"><input type="search" id="qz_qfind" placeholder="問題文・答えでさがす" value="' + esc(qzIn('qz_qfind')) + '"></div>' +
      '<div id="qz_qres">' + qzQResults(sub) + '</div>');
}
function qzQRowHtml(x){
  var a = ' data-id="' + esc(x.id) + '"';
  var l = qzLogOf(x.id), open = qzState.qEdit === x.id;
  var h = '<div class="row qz-qrow">' +
    '<div class="grow" data-act="qz-q-edit"' + a + ' role="button">' +
      '<div class="qz-badges"><span class="qz-b">' + esc(qzTypeName(x.qt)) + '</span>' +
        '<span class="qz-b sub">' + esc(qzSubName(x.sub)) + '</span>' +
        (l ? '<span class="qz-b sub">' + toNum(l.ok) + '/' + toNum(l.n) + '・つぎ ' + esc(qzMd(l.due)) + '</span>' : '<span class="qz-b sub">まだ</span>') + '</div>' +
      '<div class="t">' + esc(x.q) + '</div>' +
      '<div class="s">答え：' + esc(qzAnswerText(x)) + '</div></div>' +
    '<button class="mini qz-star' + (x.star ? ' on' : '') + '" data-act="qz-star"' + a + ' aria-label="星">' + (x.star ? '★' : '☆') + '</button>' +
    '<button class="mini" data-act="qz-q-del"' + a + ' aria-label="消す">✕</button></div>';
  if(!open) return h;
  var id = x.id;
  h += '<div class="qz-qedit">' +
    '<div class="field"><label class="f" for="qz_eq_' + esc(id) + '">問題文</label>' +
      '<textarea id="qz_eq_' + esc(id) + '" rows="2">' + esc(qzIn('qz_eq_' + id, x.q)) + '</textarea></div>';
  if(x.qt === 'mc' || x.qt === 'tf'){
    h += '<label class="f">選択肢（正しいものにチェック）</label>' +
      x.c.map(function(c, k){
        var cid = 'qz_ec_' + id + '_' + k;
        return '<div class="qz-erow"><input type="checkbox" id="' + esc(cid) + '_k"' + (x.a.indexOf(k) >= 0 ? ' checked' : '') + '>' +
          '<input id="' + esc(cid) + '" value="' + esc(qzIn(cid, c)) + '"></div>';
      }).join('');
  }else{
    h += '<div class="field"><label class="f" for="qz_ea_' + esc(id) + '">答え</label>' +
      '<input id="qz_ea_' + esc(id) + '" value="' + esc(qzIn('qz_ea_' + id, x.at)) + '"></div>';
  }
  h += '<div class="field"><label class="f" for="qz_ee_' + esc(id) + '">解説</label>' +
      '<textarea id="qz_ee_' + esc(id) + '" rows="2">' + esc(qzIn('qz_ee_' + id, x.exp || '')) + '</textarea></div>' +
    '<label class="f">科目</label>' + qzSubChips('qz-q-sub', x.sub, false, a) +
    '<div class="pair" style="margin-top:8px"><button class="btn" data-act="qz-q-save"' + a + '>直したことを保存</button>' +
      '<button class="btn ghost" data-act="qz-q-reset"' + a + ' style="flex:0 0 auto">記録をけす</button></div>' +
    '<div class="qz-src">出典：' + esc(x.src || QZ_SRC_AI) + '</div></div>';
  return h;
}
/* ===== 自分で問題を作る ===== */
function qzHandView(sub){
  var qt = qzIn('qz_ht', 'mc');
  var body = '';
  if(qt === 'mc'){
    body = [0, 1, 2, 3].map(function(k){
      return '<div class="qz-erow"><input type="checkbox" id="qz_hk' + k + '"' + (qzIn('qz_hk' + k) ? ' checked' : '') + '>' +
        '<input id="qz_hc' + k + '" placeholder="選択肢' + (k + 1) + '" value="' + esc(qzIn('qz_hc' + k)) + '"></div>';
    }).join('');
  }else if(qt === 'tf'){
    body = '<div class="pillrow"><button data-act="qz-h-tf" data-v="1" class="' + (qzIn('qz_htf', '1') === '1' ? 'on' : '') + '">○（正しい）</button>' +
      '<button data-act="qz-h-tf" data-v="0" class="' + (qzIn('qz_htf', '1') === '0' ? 'on' : '') + '">×（まちがい）</button></div>';
  }else{
    body = '<div class="field"><label class="f" for="qz_ha">答え</label>' +
      '<input id="qz_ha" placeholder="答え（みじかく）" value="' + esc(qzIn('qz_ha')) + '"></div>';
  }
  return section('どの科目？', null, qzSubs().length ? qzSubChips('qz-sub', sub, false) : qzNoSubHtml()) +
    section('自分で問題を作る', null,
      '<label class="f">種類</label>' +
      '<div class="pillrow">' + QZ_TYPES.map(function(t){
        return '<button data-act="qz-h-type" data-v="' + t[0] + '" class="' + (qt === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="field" style="margin-top:8px"><label class="f" for="qz_hq">問題文</label>' +
        '<textarea id="qz_hq" rows="2" placeholder="' + (qt === 'cloze' ? '例：成人の脈拍の正常値は（　）回/分である' : '例：成人の呼吸数の正常値は？') + '">' + esc(qzIn('qz_hq')) + '</textarea></div>' +
      body +
      '<div class="field" style="margin-top:8px"><label class="f" for="qz_he">解説（なくてもよい）</label>' +
        '<textarea id="qz_he" rows="2">' + esc(qzIn('qz_he')) + '</textarea></div>' +
      '<button class="btn" data-act="qz-h-add">この問題を足す</button>');
}
function qzHandAdd(sub){
  var qt = qzIn('qz_ht', 'mc');
  var q = String(qzV('qz_hq') || '').trim();
  if(!q){ toast('問題文を入れてください', true); return false; }
  var item = { qt:qt, q:q.slice(0, 500), c:[], a:[], at:'', alt:[], exp:String(qzV('qz_he') || '').trim().slice(0, 600), lv:2, tag:'' };
  if(qt === 'mc'){
    var c = [], a = [];
    [0, 1, 2, 3].forEach(function(k){
      var s = String(qzV('qz_hc' + k) || '').trim();
      if(!s) return;
      if(qzV('qz_hk' + k) === true || qzV('qz_hk' + k) === 'on') a.push(c.length);
      c.push(s.slice(0, 200));
    });
    if(c.length < 2){ toast('選択肢を2つ以上入れてください', true); return false; }
    if(!a.length){ toast('正しい選択肢にチェックを入れてください', true); return false; }
    item.c = c; item.a = a;
  }else if(qt === 'tf'){
    item.c = ['○（正しい）', '×（まちがい）'];
    item.a = [qzIn('qz_htf', '1') === '0' ? 1 : 0];
  }else{
    var at = String(qzV('qz_ha') || '').trim();
    if(!at){ toast('答えを入れてください', true); return false; }
    item.at = at.slice(0, 200);
  }
  var n = qzAddQs([item], sub === 'none' ? '' : sub, '', '自分で入力');
  if(!n){ toast('同じ問題がもうあります', true); return false; }
  qzClearForm(['qz_hq', 'qz_he', 'qz_ha', 'qz_hc0', 'qz_hc1', 'qz_hc2', 'qz_hc3', 'qz_hk0', 'qz_hk1', 'qz_hk2', 'qz_hk3']);
  commit();
  toast('問題を足しました');
  return true;
}

/* ============================== 操作 ============================== */
function qzCheck(){
  var r = qzState.run, q = qzCurQ();
  if(!r || !q || r.shown) return;
  var kind = qzKind(q), ok = false;
  if(kind === 'choice'){
    if(!r.sel.length){ toast('えらんでください', true); return; }
    ok = q.a.length === r.sel.length && q.a.every(function(i){ return r.sel.indexOf(i) >= 0; });
  }else if(kind === 'order'){
    var picked = r.ord || [];
    if(picked.length !== q.c.length){ toast('ぜんぶならべてください', true); return; }
    ok = picked.every(function(k, pos){ return k === pos; });
  }else if(kind === 'match'){
    var sel = r.mat || {};
    if(Object.keys(sel).length !== (q.pairs || []).length){ toast('ぜんぶえらんでください', true); return; }
    ok = (q.pairs || []).every(function(p, li){ return sel[li] === li; });
  }else if(kind === 'calc'){
    r.typed = String(qzV('qz_ans') || '').trim();
    if(!r.typed){ toast('数を書いてください', true); return; }
    ok = qzCalcOk(q, r.typed);
  }else{
    return;
  }
  qzGrade(ok);
  render();
}
/* 計算の答え合わせ（少しの誤差はOK。tol は％） */
function qzCalcOk(q, typed){
  var got = qzNum(typed), want = qzNum(q.at);
  if(!isFinite(got) || !isFinite(want)) return false;
  var tol = Math.max(0, toNum(q.tol)) / 100;
  var margin = Math.max(Math.abs(want) * tol, Math.abs(want) < 10 ? 0.05 : 0.5);
  return Math.abs(got - want) <= margin;
}
function qzStarToggle(id){
  var x = qzItem(id);
  if(!x) return;
  x.star = x.star ? 0 : 1;
  qzTouch(x);
  persist(); qzPushSoon();
  qzRender();
}
function qzQSave(id){
  var x = qzItem(id);
  if(!x || x.type !== 'q') return false;
  var q = String(qzV('qz_eq_' + id) || '').trim();
  if(!q){ toast('問題文を入れてください', true); return false; }
  var next = Object.assign({}, x, { q:q.slice(0, 500), exp:String(qzV('qz_ee_' + id) || '').trim().slice(0, 600) });
  if(x.qt === 'mc' || x.qt === 'tf'){
    var c = [], a = [];
    x.c.forEach(function(old, k){
      var s = String(qzV('qz_ec_' + id + '_' + k) || '').trim();
      if(!s) return;
      var on = qzV('qz_ec_' + id + '_' + k + '_k');
      if(on === true || on === 'on') a.push(c.length);
      c.push(s.slice(0, 200));
    });
    next.c = c; next.a = a;
  }else{
    next.at = String(qzV('qz_ea_' + id) || '').trim().slice(0, 200);
  }
  if(!qzQOk(next)){ toast('選択肢と正解をたしかめてください', true); return false; }
  Object.assign(x, next);
  if(!/直した/.test(String(x.src || ''))) x.src = (x.src || QZ_SRC_AI) + '（自分で直した）';
  qzTouch(x);
  qzClearIn('qz_eq_' + id); qzClearIn('qz_ee_' + id); qzClearIn('qz_ea_' + id); qzClearIn('qz_ec_' + id);
  qzState.qEdit = '';
  commit(); toast('直しました');
  return true;
}
function qzAction(act, t, e){
  if(act.indexOf('qz-') !== 0) return false;
  var id = t.dataset.id || '', v = t.dataset.v || '';
  /* ===== 行き先 ===== */
  if(act === 'qz-go'){ qzGo(t.dataset.tool || 'qz-make'); return true; }
  if(act === 'qz-sub'){ qzState.sub = v; qzState.matOpen = ''; qzState.qEdit = ''; render(); return true; }
  if(act === 'qz-lib-tab'){ qzState.libTab = v; qzState.matOpen = ''; qzState.qEdit = ''; qzState.subEdit = ''; render(); return true; }
  if(act === 'qz-del-cancel'){ qzState.delAsk = ''; render(); return true; }
  /* ===== 科目 ===== */
  if(act === 'qz-sub-add'){
    var nm = String(qzV('qz_newsub') || '').trim();
    if(!nm){ toast('科目の名前を入れてください', true); return true; }
    var s = qzSubAdd(nm);
    qzClearForm(['qz_newsub']);
    if(s) qzState.sub = s.id;
    commit(); toast('「' + nm + '」を足しました');
    return true;
  }
  if(act === 'qz-sub-import'){
    var n = qzSubImport();
    commit();
    toast(n ? n + '科目を足しました' : '足す科目がありませんでした', !n);
    return true;
  }
  if(act === 'qz-sub-mv'){ if(qzSubMove(id, toNum(t.dataset.d))) commit(); return true; }
  if(act === 'qz-sub-edit'){ qzState.subEdit = (qzState.subEdit === id) ? '' : id; qzState.delAsk = ''; render(); return true; }
  if(act === 'qz-sub-save'){
    var nm2 = String(qzV('qz_rn_' + id) || '').trim();
    if(!nm2){ toast('名前を入れてください', true); return true; }
    if(!qzSubRename(id, nm2)){ toast('同じ名前の科目があります', true); return true; }
    qzClearIn('qz_rn_' + id);
    commit(); toast('名前を変えました');
    return true;
  }
  if(act === 'qz-sub-icon'){ if(qzSubIconSet(id, v)) commit(); return true; }
  if(act === 'qz-sub-arch'){
    var s2 = qzSub(id);
    if(s2){ s2.arch = s2.arch ? 0 : 1; qzTouch(s2); if(s2.arch && qzState.sub === id) qzState.sub = ''; commit(); toast(s2.arch ? 'しまいました' : 'もどしました'); }
    return true;
  }
  if(act === 'qz-sub-delask'){ qzState.delAsk = id; render(); return true; }
  if(act === 'qz-sub-del'){
    var nm3 = qzSubName(id), w = t.dataset.w === '1';
    var gone = qzSubDel(id, w);
    qzState.delAsk = ''; qzState.subEdit = '';
    commit();
    toast('「' + nm3 + '」を消しました' + (w ? '（' + gone + 'こもいっしょに）' : '（中身はのこしました）'));
    return true;
  }
  /* ===== 資料をえらぶ・作る ===== */
  if(act === 'qz-pick'){ qzPickFiles(); return true; }
  if(act === 'qz-shot'){ qzShotLoop(); return true; }
  if(act === 'qz-file-del'){ qzState.files.splice(toNum(t.dataset.i), 1); render(); return true; }
  if(act === 'qz-file-auto'){ qzFileFix(toNum(t.dataset.i), 'auto'); return true; }
  if(act === 'qz-file-split'){ qzFileFix(toNum(t.dataset.i), 'split'); return true; }
  if(act === 'qz-file-warp'){
    qzState.warp = { i:toNum(t.dataset.i), sel:0, quad:[[0.04, 0.04], [0.96, 0.04], [0.96, 0.96], [0.04, 0.96]] };
    render(); window.scrollTo(0, 0);
    return true;
  }
  if(act === 'qz-warp-sel'){ if(qzState.warp){ qzState.warp.sel = toNum(t.dataset.k); render(); } return true; }
  if(act === 'qz-warp-put'){
    var w = qzState.warp;
    if(w && e && t.getBoundingClientRect){
      var box = t.getBoundingClientRect();
      var x = Math.max(0, Math.min(1, ((e.clientX == null ? 0 : e.clientX) - box.left) / (box.width || 1)));
      var y = Math.max(0, Math.min(1, ((e.clientY == null ? 0 : e.clientY) - box.top) / (box.height || 1)));
      w.quad[w.sel] = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
      w.sel = (w.sel + 1) % 4;                       /* 次の角へ、じゅんばんに */
      render();
    }
    return true;
  }
  if(act === 'qz-warp-ok'){ qzWarpApply(); return true; }
  if(act === 'qz-warp-cancel'){ qzState.warp = null; render(); return true; }
  if(act === 'qz-mk-more'){ qzState.more = qzState.more ? 0 : 1; render(); return true; }
  if(act === 'qz-mk-auto'){ qzState.mk.auto = qzState.mk.auto ? 0 : 1; render(); return true; }
  if(act === 'qz-mk-style'){ qzState.mk.style = v; render(); return true; }
  if(act === 'qz-mk-tg'){
    if(v === 'both'){ qzState.mk.both = qzState.mk.both ? 0 : 1; }
    else qzState.mk[v] = qzState.mk[v] ? 0 : 1;
    render();
    return true;
  }
  if(act === 'qz-make-stop'){
    if(qzState.abort){ try{ qzState.abort.abort(); }catch(e2){} }
    return true;
  }
  if(act === 'qz-make-again'){ qzMakeAgain(); return true; }
  if(act === 'qz-src-lec'){
    var lec = '';
    try{ lec = (typeof rsLecText === 'function') ? rsLecText() : ''; }catch(e3){}
    if(!lec || lec.length < 40){ toast('録音の文字がまだありません（勉強 › 講義の録音）', true); return true; }
    qzState.files = qzDupMark(qzState.files.concat([{ name:'講義の録音（' + today() + '）', kind:'text', url:'', text:lec }])).slice(0, QZ_MAX_FILES);
    render(); toast('録音の文字を取りこみました');
    return true;
  }
  if(act === 'qz-src-drive'){ qzDrivePull(); return true; }
  if(act === 'qz-src-close'){ qzState.picks = null; render(); return true; }
  if(act === 'qz-src-note'){
    var note = (S.notes || []).filter(function(x){ return x.id === id; })[0];
    if(!note){ toast('メモが見つかりませんでした', true); return true; }
    qzState.files = qzDupMark(qzState.files.concat([{ name:(note.title || 'メモ').slice(0, 40), kind:'text', url:'', text:String(note.body || '') }])).slice(0, QZ_MAX_FILES);
    qzState.picks = null;
    render(); toast('メモを資料にしました');
    return true;
  }
  if(act === 'qz-mk-n'){ qzState.mk.n = Math.max(1, Math.min(QZ_MAX_Q, toNum(v))); render(); return true; }
  if(act === 'qz-mk-lv'){ qzState.mk.lv = Math.max(1, Math.min(3, toNum(v))); render(); return true; }
  if(act === 'qz-mk-type'){
    var ts = qzState.mk.types.slice(), k = ts.indexOf(v);
    if(k >= 0){ if(ts.length > 1) ts.splice(k, 1); else { toast('1つはえらんでください', true); return true; } }
    else ts.push(v);
    qzState.mk.types = ts; render();
    return true;
  }
  if(act === 'qz-make'){
    var subs = qzSubs(), mk = qzState.mk;
    var sub = qzCurSub() || (subs[0] && subs[0].id) || '';
    qzState.mat.no = String(qzV('qz_mno') || '').replace(/[^0-9]/g, '').slice(0, 2);
    qzState.mat.memo = String(qzV('qz_mmemo') || '').slice(0, 300);
    qzState.mat.at = isYmd(String(qzV('qz_mat') || '')) ? String(qzV('qz_mat')) : today();
    qzMake({ sub:sub, n:mk.auto ? qzAutoN() : mk.n, types:mk.types.slice(), lv:mk.lv, both:mk.both,
             style:mk.style, kokushi:mk.kokushi, en:mk.en, two:mk.two, noai:mk.noai,
             memo:qzState.mat.memo, text:qzV('qz_text') });
    return true;
  }
  if(act === 'qz-pv-remake'){ qzRemake(toNum(t.dataset.i)); return true; }
  if(act === 'qz-pv-toggle'){
    var pv = qzState.pv, i = toNum(t.dataset.i);
    if(pv && pv.items[i]) pv.items[i].on = t.checked ? 1 : 0;
    render();
    return true;
  }
  if(act === 'qz-pv-all'){
    if(qzState.pv) qzState.pv.items.forEach(function(x){ x.on = v === '1' ? 1 : 0; });
    render();
    return true;
  }
  if(act === 'qz-pv-add'){ qzPvAdd(); return true; }
  if(act === 'qz-pv-cancel'){ qzState.pv = null; render(); return true; }
  /* ===== 解く ===== */
  if(act === 'qz-mode'){ qzState.drillMode = v; qzState.modePicked = 1; render(); return true; }
  if(act === 'qz-n'){ qzState.drillN = toNum(v) || 10; render(); return true; }
  if(act === 'qz-start'){ qzStart(qzCurSub(), qzState.drillMode, qzState.drillN); return true; }
  if(act === 'qz-today-go'){
    var mode = qzPool('', 'due').length ? 'due' : 'new';
    qzState.sub = ''; qzState.drillMode = mode;
    appId = 'study'; studyTool = 'qz-drill';
    qzStart('', mode, qzState.drillN);
    return true;
  }
  if(act === 'qz-pick-ch'){
    var r = qzState.run, q = qzCurQ(), k = toNum(t.dataset.i);
    if(!r || !q || r.shown) return true;
    if(q.a.length > 1){
      var at = r.sel.indexOf(k);
      if(at >= 0) r.sel.splice(at, 1); else r.sel.push(k);
      render();
    }else{
      r.sel = [k];
      qzCheck();
    }
    return true;
  }
  if(act === 'qz-check'){ qzCheck(); return true; }
  if(act === 'qz-ord-pick'){
    var ro = qzState.run, qo = qzCurQ(), ki = toNum(t.dataset.i);
    if(ro && qo && !ro.shown){
      ro.ord = ro.ord || [];
      if(ro.ord.indexOf(ki) < 0) ro.ord.push(ki);
      render();
    }
    return true;
  }
  if(act === 'qz-ord-undo'){
    var ru = qzState.run;
    if(ru && !ru.shown && (ru.ord || []).length){ ru.ord.pop(); render(); }
    return true;
  }
  if(act === 'qz-mat-pick'){
    var rm = qzState.run;
    if(rm && !rm.shown){
      rm.mat = rm.mat || {};
      rm.mat[toNum(t.dataset.l)] = toNum(t.dataset.r);
      render();
    }
    return true;
  }
  if(act === 'qz-why'){ qzWhy(id); return true; }
  if(act === 'qz-resume'){ qzRunResume(); return true; }
  if(act === 'qz-resume-drop'){ qzRunDrop(); render(); return true; }
  if(act === 'qz-show'){
    var r2 = qzState.run;
    if(r2){ r2.typed = String(qzV('qz_ans') || ''); r2.shown = 1; render(); }
    return true;
  }
  if(act === 'qz-grade'){ qzGrade(v === '1'); qzNext(); return true; }
  if(act === 'qz-next'){ qzNext(); return true; }
  if(act === 'qz-quit'){
    var r3 = qzState.run;
    if(r3 && r3.n){
      qzPushNow();
      if(typeof petStudyReward === 'function'){ try{ petStudyReward(r3.n); }catch(e){} }
    }
    if(r3 && !r3.end && r3.i < r3.ids.length) qzRunSave();       /* 途中なら、続きから解けるように残す */
    else qzRunDrop();
    qzState.run = null;
    render(); window.scrollTo(0, 0);
    return true;
  }
  if(act === 'qz-again-wrong'){
    var r4 = qzState.run;
    if(r4 && r4.wrong.length) qzRunSet(r4.wrong.slice(), r4.sub, 'wrong');
    return true;
  }
  if(act === 'qz-star'){ qzStarToggle(id); return true; }
  /* ===== 資料の整理 ===== */
  if(act === 'qz-mat-open'){ qzState.matOpen = (qzState.matOpen === id) ? '' : id; qzState.delAsk = ''; render(); return true; }
  if(act === 'qz-mat-sub'){
    var m = qzMat(id);
    if(m){ m.sub = v; qzTouch(m); commit(); }
    return true;
  }
  if(act === 'qz-mat-more'){
    var m2 = qzMat(id);
    if(!m2 || !m2.text){ toast('この資料には、取り出した字がありません', true); return true; }
    qzState.files = [{ name:(m2.title || '資料') + '（保存した字）', kind:'text', url:'', text:m2.text }];
    qzState.sub = m2.sub || qzState.sub;
    qzState.pv = null;
    qzGo('qz-make');
    toast('この資料から、また問題を作れます');
    return true;
  }
  if(act === 'qz-mat-delask'){ qzState.delAsk = id; render(); return true; }
  if(act === 'qz-mat-del'){
    var m3 = qzMat(id), w3 = t.dataset.w === '1', gone3 = 0;
    if(m3){
      qzQsOfMat(id).forEach(function(x){
        if(w3){ qzRemove(x); gone3++; }
        else { x.mat = ''; qzTouch(x); }
      });
      qzRemove(m3);
    }
    qzState.delAsk = ''; qzState.matOpen = '';
    commit();
    toast('資料を消しました' + (w3 ? '（問題' + gone3 + '問も）' : ''));
    return true;
  }
  /* ===== 問題の整理 ===== */
  if(act === 'qz-q-edit'){ qzState.qEdit = (qzState.qEdit === id) ? '' : id; render(); return true; }
  if(act === 'qz-q-save'){ qzQSave(id); return true; }
  if(act === 'qz-q-sub'){
    var x2 = qzItem(id);
    if(x2){ x2.sub = v; qzTouch(x2); commit(); }
    return true;
  }
  if(act === 'qz-q-del'){
    var x3 = qzItem(id);
    if(x3){
      qzLogDel(id);
      removeWithUndo('kmItems', id, '問題を消しました');     /* 「取り消す」で、もどせる */
      if(qzState.qEdit === id) qzState.qEdit = '';
      commit();
    }
    return true;
  }
  if(act === 'qz-q-reset'){ qzLogDel(id); commit(); toast('この問題の記録をけしました'); return true; }
  /* ===== 自分で作る ===== */
  if(act === 'qz-h-type'){ qzState.inp.qz_ht = v; render(); return true; }
  if(act === 'qz-h-tf'){ qzState.inp.qz_htf = v; render(); return true; }
  if(act === 'qz-h-add'){ qzHandAdd(qzCurSub()); return true; }
  if(act === 'qz-export'){ qzExportCsv(); return true; }
  if(act === 'qz-set-today'){ qzCfgSet({ today:qzCfg().today === 0 ? 1 : 0 }); commit(); return true; }
  if(act === 'qz-set-notify'){ qzCfgSet({ notify:qzCfg().notify ? 0 : 1 }); commit(); return true; }
  return true;
}
kmAction(qzAction);
/* 入力中の字を覚えておく（同期や天気で画面を描き直しても消えないように） */
function qzOnInput(ev){
  var el = ev.target;
  if(!el || !el.id || el.id.indexOf('qz_') !== 0) return;
  qzState.inp[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  if(el.id === 'qz_qfind'){
    var box = document.getElementById('qz_qres');
    if(box) box.innerHTML = qzQResults(qzCurSub());
  }
}
document.addEventListener('input', qzOnInput);
document.addEventListener('change', qzOnInput);

/* 問題をCSVで書き出す（Excel・ほかのアプリで使えるように） */
function qzExportCsv(){
  var rows = [['科目', '種類', '問題', '選択肢', '答え', '解説', '出典', '次に出す日']];
  qzQs('').forEach(function(x){
    var l = qzLogOf(x.id) || {};
    rows.push([qzSubName(x.sub), qzTypeName(x.qt), x.q, (x.c || []).join(' / '), qzAnswerText(x), x.exp || '', x.src || '', l.due || '']);
  });
  if(rows.length < 2){ toast('書き出す問題がありません', true); return; }
  var csv = '﻿' + rows.map(function(r){
    return r.map(function(v){ return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\r\n');
  download(new Blob([csv], { type:'text/csv;charset=utf-8' }), 'kurashi-quiz-' + today() + '.csv');
  toast((rows.length - 1) + '問を書き出しました');
}

/* ============================== 今日タブのカード ============================== */
function qzTodayCard(ctx){
  if(!ctx || !ctx.isToday) return '';
  if(qzCfg().today === 0) return '';
  if(!qzQs('').length) return '';
  var due = qzPool('', 'due').length, fresh = qzPool('', 'new').length, dc = qzDayCount(today());
  if(!due && !fresh && !dc.n) return '';
  var by = qzSubs().map(function(s){
    return { name:s.icon + ' ' + s.name, n:qzTodoCount(s.id) };
  }).filter(function(x){ return x.n; }).sort(function(a, b){ return b.n - a.n; }).slice(0, 4);
  var inner = '<div class="stats">' + qzStat('復習', due + '問') + qzStat('はじめて', fresh + '問') +
    qzStat('といた', dc.n + '問') + '</div>' +
    (by.length ? '<div class="qz-todaysubs">' + by.map(function(x){
      return '<span class="qz-b">' + esc(x.name) + ' ' + x.n + '</span>';
    }).join('') + '</div>' : '') +
    '<div class="pair" style="margin-top:8px">' +
    (due + fresh ? '<button class="btn" data-act="qz-today-go">' + Math.min(qzState.drillN, due + fresh) + '問といてみる</button>' : '') +
    '<button class="btn ghost" data-act="qz-go" data-tool="qz-make" style="flex:0 0 auto">資料から作る</button></div>';
  return secWrap('qztoday', '授業の問題', due + fresh ? '今日 ' + (due + fresh) + '問' : 'おわりました', inner);
}

/* ============================== 登録 ============================== */
kmStudy({ id:'qz-make', icon:'📸', title:'授業の資料から問題', desc:'写真・スライド・PDFから、AIが問題を作ります', order:5,
  view:qzMakeView });
kmStudy({ id:'qz-drill', icon:'✏️', title:'授業の問題をとく', desc:'科目ごとに出題。まちがえた問題はまた出ます', order:6,
  view:qzDrillView, badge:function(){ var n = qzTodoCount(''); return n ? '今日' + n : ''; } });
kmStudy({ id:'qz-lib', icon:'🗂', title:'科目と資料の整理', desc:'科目を足す・名前を変える・並べ替える', order:7,
  view:qzLibView, badge:function(){ var n = qzSubs().length; return n ? n + '科目' : ''; } });
kmPart('today', 'qztoday', '授業の問題', qzTodayCard);

kmSettings({ id:'qzset', title:'授業の資料から問題', after:'',
  note:function(){ return qzQs('').length + '問・' + qzSubs().length + '科目'; },
  html:function(){
    var c = qzCfg();
    return '<div class="row"><div class="grow"><div class="t">今日タブに「授業の問題」を出す</div>' +
        '<div class="s">その日に復習する問題の数が出ます。</div></div>' +
        '<button class="mini" data-act="qz-set-today">' + (c.today === 0 ? '出さない → 出す' : '出す → 出さない') + '</button></div>' +
      '<div class="row"><div class="grow"><div class="t">夜に「復習が待っています」と知らせる</div>' +
        '<div class="s">その日に復習する問題があるときだけ、通知します。</div></div>' +
        '<button class="mini" data-act="qz-set-notify">' + (c.notify ? '知らせる → 知らせない' : '知らせない → 知らせる') + '</button></div>' +
      '<div class="pair" style="margin-top:8px"><button class="btn ghost" data-act="qz-export">問題をCSVで書き出す</button>' +
        '<button class="btn ghost" data-act="qz-go" data-tool="qz-lib" style="flex:0 0 auto">科目の整理</button></div>' +
      '<p class="note">作った問題・科目・記録は、ほかの端末にも同期されます。資料の写真も同期されます（PDF・スライドは、取り出した字だけ残します）。</p>';
  } });

/* 通知：夜に、その日の復習を知らせる（今日から7日ぶん。0問の日は出さない） */
kmJobs(function(add, prefs){
  if(!qzCfg().notify) return;
  var t = (prefs && prefs.dlTime) ? prefs.dlTime : '20:00';
  var list = qzQs('');
  if(!list.length) return;
  for(var i = 0; i < 7; i++){
    var d = shiftDate(today(), i);
    var n = list.filter(function(x){ var l = qzLogOf(x.id); return l && l.due && String(l.due) <= d; }).length;
    if(i === 0) n += qzPool('', 'new').length;       /* 今日は、まだ解いていない分もふくめる */
    if(!n) continue;
    add('qz-rev-' + d, notifyAt(d, t), '📘 授業の問題',
        (i === 0 ? '今日' : ymdLabel(d)) + 'の復習は' + n + '問です。5分だけでも。', { cat:'info' });
  }
});

/* ウィジェット・Discord のまとめ */
kmSummary(function(s){
  if(!qzQs('').length) return;
  s.quiz = { today:qzTodoCount(''), total:qzQs('').length, subjects:qzSubs().length, answeredToday:qzDayCount(today()).n };
});

/* アプリ全体の検索 */
kmSearch(function(q){
  var nq = qzNorm(q), out = [];
  if(!nq) return out;
  qzSubs().filter(function(s){ return qzNorm(s.name).indexOf(nq) >= 0; }).slice(0, 4).forEach(function(s){
    out.push({ kind:'科目（授業の問題）', title:s.icon + ' ' + s.name, sub:qzQs(s.id).length + '問・資料' + qzMats(s.id).length + 'こ',
               act:'qz-search-go', attrs:{ 'data-tool':'qz-drill', 'data-sub':s.id } });
  });
  qzQs('').filter(function(x){ return qzNorm(x.q + (x.c || []).join('') + x.at + x.tag).indexOf(nq) >= 0; }).slice(0, 6).forEach(function(x){
    out.push({ kind:'授業の問題', title:x.q.slice(0, 50), sub:qzSubName(x.sub) + '・答え：' + qzAnswerText(x).slice(0, 30),
               act:'qz-search-go', attrs:{ 'data-tool':'qz-lib', 'data-sub':x.sub || '' } });
  });
  qzMats('').filter(function(m){ return qzNorm(m.title + (m.text || '')).indexOf(nq) >= 0; }).slice(0, 4).forEach(function(m){
    out.push({ kind:'授業の資料', title:m.title, sub:qzSubName(m.sub) + '・' + qzMd(m.at),
               act:'qz-search-go', attrs:{ 'data-tool':'qz-lib', 'data-sub':m.sub || '', 'data-mat':m.id } });
  });
  return out;
});
kmAction(function(act, t){
  if(act !== 'qz-search-go') return false;
  qzState.sub = t.dataset.sub || '';
  if(t.dataset.mat){ qzState.libTab = 'mat'; qzState.matOpen = t.dataset.mat; }
  qzGo(t.dataset.tool || 'qz-drill');
  return true;
});

/* データの点検 */
kmCheck(function(){
  var out = [], bad = [], lost = [];
  qzOf('q').forEach(function(x){
    if(!qzQOk(x)) bad.push(x);
    else if(x.sub && !qzSub(x.sub)) lost.push(x);
  });
  qzOf('mat').forEach(function(m){ if(m.sub && !qzSub(m.sub)) lost.push(m); });
  if(bad.length){
    out.push({ level:'warn', msg:'授業の問題：答えや選択肢が足りない問題が ' + bad.length + '問あります',
      fix:function(){ bad.forEach(qzRemove); commit(); } });
  }
  if(lost.length){
    out.push({ level:'warn', msg:'授業の問題：もうない科目に入ったままのものが ' + lost.length + 'こあります',
      fix:function(){ lost.forEach(function(x){ x.sub = ''; qzTouch(x); }); commit(); } });
  }
  return out;
});

/* AIそうだんが読めるように */
kmAiData('quiz_subjects', '「授業の資料から問題」の科目ごとの問題数・正答率・今日の復習数（並べ替えた順）', function(){
  return qzSubs().map(function(s){
    var st = qzStats(s.id);
    return { subject:s.name, order:toNum(s.ord), questions:st.total, materials:qzMats(s.id).length,
             answered:st.answered, correctRate:st.rate == null ? null : st.rate + '%', reviewToday:qzTodoCount(s.id) };
  });
}, 'study');
kmAiData('quiz_status', '「授業の資料から問題」ぜんたい：今日といた数・つづけた日数・苦手な科目・最近まちがえた問題・資料の一覧', function(){
  var dc = qzDayCount(today()), st = qzStats('');
  var weak = qzSubs().map(function(s){ return { name:s.name, st:qzStats(s.id) }; })
    .filter(function(x){ return x.st.tries >= 3 && x.st.rate != null && x.st.rate < 60; })
    .map(function(x){ return x.name + '（' + x.st.rate + '%）'; });
  var wrong = qzPool('', 'wrong').slice(0, 10).map(function(x){
    return { subject:qzSubName(x.sub), type:qzTypeName(x.qt), question:x.q.slice(0, 120), answer:qzAnswerText(x), source:x.src || QZ_SRC_AI };
  });
  return {
    today:today(), answeredToday:dc.n, correctToday:dc.ok, streakDays:qzStreak(),
    questions:st.total, notYet:st.fresh, reviewToday:qzTodoCount(''), correctRate:st.rate == null ? 'まだ記録なし' : st.rate + '%',
    weakSubjects:weak, recentWrong:wrong,
    materials:qzMats('').slice(0, 20).map(function(m){
      return { title:m.title, subject:qzSubName(m.sub), kind:qzKindName(m.kind), date:m.at, questions:qzQsOfMat(m.id).length };
    }),
    note:'問題は、授業の写真・スライド・配布資料からAIが作ったもの。教科書で確かめる必要がある。'
  };
}, 'study');

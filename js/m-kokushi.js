/* くらしの手帳：勉強①（国試・略語・基準値・薬・解剖・手技） */
/* ============================== このファイルの中身 ==============================
   「勉強」タブの道具（kmStudy）を6つ足す。どれにも「出典」を出す（#124）。
   ・国試ドリル（kq-drill）      … 組みこみの練習問題（KQ_QS）＋自分の問題（S.kqs）。答えた記録は S.kqLog
   ・略語・用語の辞書（kq-dict） … 組みこみ（KQ_DICT）＋自分で足した略語（S.abbrs）。Wikipediaの要約も読める（#178）
   ・基準値の早見表（kq-lab）    … KQ_LABS。覚えるクイズつき
   ・薬のカード（kq-drug）       … KQ_DRUGS。めくって覚える
   ・解剖図の穴うめ（kq-anat）   … 組みこみの図（KQ_ANAT）＋自分の図（S.anatomy。写真は写真の入れもの photoPut に置き、id だけ持つ）
   ・看護技術の手順（kq-skill）  … KQ_SKILLS＋自分の手順（S.kmItems type:'myskill'）。練習の記録は S.kmItems type:'skill'
   データの形
   ・S.kqs      … { id, mt, ct, field, q, choices:[文字], ans:[0からの番号], exp, src:'出典', kind:'hand'|'photo'|'ai' }
   ・S.kqLog    … 問題のid → { n, ok, miss, res(最後の答え 1/0), box(0〜5), due:'次に出す日', last:'最後に答えた日', mt }
                   'day|YYYY-MM-DD|端末ID' → { n, ok, mt }（その日に答えた数。2台で同時に解いても消えないよう端末ごと）
   ・S.abbrs    … { id, mt, abbr, full, yomi, ja, desc, src, url }
   ・S.anatomy  … { id, mt, title, img:写真のid, holes:[{ x, y, w, h（0〜1の割合）, ans }], src }
   ・S.kmItems  … mod:'kokushi' ／ type:'exp'（AIの解説）・'skill'（手順の練習の記録）・'myskill'（自分の手順）
   ・S.kmData   … 'kokushi:anat' → { 図のid:{ n, ok, at } }（穴うめクイズの最後の結果）
   ・S.ui.kokushi … { today:0/1（今日タブの今日の1問）, todayField:'分野id' } */

var KQ_FIELDS = [
  ['hisshu','必修'], ['jintai','人体の構造と機能'], ['shippei','疾病の成り立ちと回復の促進'], ['kiso','基礎看護学'],
  ['seijin','成人看護学'], ['rounen','老年看護学'], ['shoni','小児看護学'], ['bosei','母性看護学'],
  ['seishin','精神看護学'], ['zaitaku','地域・在宅看護論'], ['tougou','看護の統合と実践'], ['shakai','健康支援と社会保障制度']
];
/* 出典のことば */
var KQ_SRC = {
  q:'くらしの手帳の練習問題（教科書で確かめて）',
  dict:'くらしの手帳の用語集（教科書で確かめて）',
  lab:'くらしの手帳の基準値表（目安。施設・教科書で少しちがう）',
  drug:'くらしの手帳の薬のカード（目安。添付文書・教科書で確かめて）',
  skill:'くらしの手帳の手順の例（学校で習った手順を優先して）',
  anat:'くらしの手帳の図（教科書で確かめて）',
  ai:'AIが作成（教科書で確かめて）',
  hand:'自分で入力'
};
var KQ_IVL = [1, 3, 7, 14, 30, 60];          /* 正解がつづくと、次に出すまでの日数をのばす（まちがえたら次の日） */
var KQ_NUM = ['①','②','③','④','⑤','⑥','⑦','⑧'];
var KQ_MHLW = 'https://www.mhlw.go.jp/kouseiroudoushou/shikaku_shiken/kangoshi/';
var KQ_TOOLS = [
  { id:'kq-drill', icon:'📝', title:'国試ドリル', desc:'分野ごとに1問ずつ。まちがえた問題はまた出る', order:11 },
  { id:'kq-dict',  icon:'📖', title:'略語・用語の辞書', desc:'ADL・SpO2 など。Wikipediaでも調べられる', order:12 },
  { id:'kq-lab',   icon:'🧪', title:'基準値の早見表', desc:'血液・尿・バイタル。覚えるクイズつき', order:13 },
  { id:'kq-drug',  icon:'💊', title:'薬のカード', desc:'はたらき・副作用・看護の注意をめくって覚える', order:14 },
  { id:'kq-anat',  icon:'🫀', title:'解剖図の穴うめ', desc:'図の名前をかくしてクイズ。写真からも作れる', order:15 },
  { id:'kq-skill', icon:'🩺', title:'看護技術の手順', desc:'手順をチェック・根拠を確認・時間を計って練習', order:16 }
];
var kqState = {
  inp:{},                                          /* 入力中の文字（描き直しても消えないように） */
  field:'', n:10, drill:null, add:'', preview:null, busy:'',
  dictQ:'', dictOpen:'', dictAdd:false, wiki:null,
  labCat:'', labQ:'', labQuiz:null,
  drugCat:'', drugQ:'', drugHi:false, drugOpen:-1, drugFlip:null,
  anat:null, anatEdit:null,
  skill:'', skillChk:{}, skillWhy:{}, skillRun:null, skillLast:'', skillPv:null, skillAdd:false
};

/* ============================== 共通の道具 ============================== */
function kqCfg(){ var c = S.ui && S.ui.kokushi; return (c && typeof c === 'object') ? c : {}; }
function kqFieldName(id){
  for(var i = 0; i < KQ_FIELDS.length; i++) if(KQ_FIELDS[i][0] === id) return KQ_FIELDS[i][1];
  return 'そのほか';
}
function kqFieldOk(id){ return KQ_FIELDS.some(function(f){ return f[0] === id; }); }
/* 分野の名前（ゆれ）から id を決める */
function kqFieldOf(v, def){
  v = String(v || '').trim();
  if(kqFieldOk(v)) return v;
  for(var i = 0; i < KQ_FIELDS.length; i++){
    var nm = KQ_FIELDS[i][1];
    if(v && (v === nm || nm.indexOf(v) >= 0 || v.indexOf(nm) >= 0)) return KQ_FIELDS[i][0];
  }
  if(/在宅|地域/.test(v)) return 'zaitaku';
  if(/社会保障|健康支援|法/.test(v)) return 'shakai';
  if(/統合|管理|災害|国際/.test(v)) return 'tougou';
  if(/解剖|生理|人体/.test(v)) return 'jintai';
  if(/疾病|病態|薬理|微生物/.test(v)) return 'shippei';
  return def == null ? 'hisshu' : def;
}
function kqFieldOptions(sel, withAll){
  return (withAll ? '<option value="">すべての分野</option>' : '') + KQ_FIELDS.map(function(f){
    return '<option value="' + f[0] + '"' + (f[0] === sel ? ' selected' : '') + '>' + esc(f[1]) + '</option>';
  }).join('');
}
function kqShuffle(a){
  a = a.slice();
  for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function kqHash(s){ var h = 7; s = String(s); for(var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
/* さがすための形：全角→半角・大文字→小文字・カタカナ→ひらがな・区切りの記号をとる */
function kqNorm(s){
  s = String(s == null ? '' : s);
  try{ s = s.normalize('NFKC'); }catch(e){}
  s = s.toLowerCase().replace(/[ァ-ヶ]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  return s.replace(/[\s・･\-‐－―—_\/／\.．,，、。\(\)（）「」『』【】\[\]]/g, '');
}
function kqSrcHtml(src, url){
  var ok = url && /^https:\/\//.test(url);
  return '<div class="kq-src">出典：' + (ok ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(src) + '</a>' : esc(src)) + '</div>';
}
function kqWarn(text){ return '<div class="bn amber kq-bn"><span class="ic">!</span><span>' + text + '</span></div>'; }
function kqStat(label, v){ return '<div class="stat"><div class="s">' + esc(label) + '</div><div class="v num">' + esc(v) + '</div></div>'; }
function kqIn(id, def){ var v = kqState.inp[id]; return v == null ? (def == null ? '' : def) : v; }
/* 入力欄の値（画面にあれば画面から、なければ覚えている値） */
function kqV(id){
  var e = document.getElementById(id);
  if(e) return e.type === 'checkbox' ? e.checked : e.value;
  return kqIn(id);
}
function kqClearIn(prefix){ Object.keys(kqState.inp).forEach(function(k){ if(k.indexOf(prefix) === 0) delete kqState.inp[k]; }); }
function kqMmss(sec){ sec = Math.max(0, Math.round(Number(sec) || 0)); return Math.floor(sec / 60) + ':' + pad(sec % 60); }
function kqRender(){ if(typeof isTyping === 'function' && isTyping()) renderLater(); else render(); }
function kqGoTop(){ try{ window.scrollTo(0, 0); }catch(e){} }
/* ファイルをえらぶ（写真） */
function kqPickFiles(multiple, cb){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = !!multiple;
  inp.onchange = function(){
    var files = Array.prototype.slice.call(inp.files || [], 0, multiple ? 4 : 1);
    if(files.length) cb(files);
  };
  inp.click();
}
async function kqReadPhotos(files, side, q){
  var urls = [];
  for(var i = 0; i < files.length; i++) urls.push(await resizeImage(files[i], side || 1800, q || 0.82));
  return urls;
}
function kqImgParts(urls){
  var parts = [];
  (urls || []).forEach(function(u){
    var m = String(u).match(/^data:([^;]+);base64,(.*)$/);
    if(m) parts.push({ inline_data:{ mime_type:m[1], data:m[2] } });
  });
  return parts;
}
async function kqAi(tag, urls, prompt, maxTokens){
  if(!aiReady()) throw new Error('先に設定タブでAI（Gemini）のキーを登録してください');
  var parts = kqImgParts(urls);
  parts.push({ text:prompt });
  var out = await aiGenerate({ contents:[{ role:'user', parts:parts }], json:true, temperature:0.2, maxTokens:maxTokens || 8192, tag:tag });
  return parseJsonLoose(out) || {};
}
var KQ_PRIVACY = '⚠️ 実習記録など、<b>患者さんの情報が写っているものは読みこまないでください</b>。AI（Gemini）に送られます。';
/* 暗記カードにする（同じものは入れない） */
function kqToAnki(deck, list){
  if(typeof ankiAddMany !== 'function'){ toast('暗記カードが使えません', true); return 0; }
  var n = ankiAddMany(deck, list, 'kokushi');
  commit();
  toast(n ? '暗記カードに' + n + '枚足しました（暗記タブ・「' + deck + '」）' : 'もう暗記カードにあります', !n);
  return n;
}
/* 同期は、答えるたびではなく、少しまとめて送る（「書きこみすぎ防止」で止まらないように） */
var kqPushTimer = null;
function kqPushSoon(){
  clearTimeout(kqPushTimer);
  kqPushTimer = setTimeout(function(){ kqPushTimer = null; pushRemote(); }, 15000);
}
function kqPushNow(){ clearTimeout(kqPushTimer); kqPushTimer = null; commit(); }

/* ============================== 国試の問題 ============================== */
var kqBuiltinCache = null;
function kqBuiltinQs(){
  if(kqBuiltinCache) return kqBuiltinCache;
  var n = {};
  kqBuiltinCache = (typeof KQ_QS !== 'undefined' ? KQ_QS : []).map(function(r){
    n[r[0]] = (n[r[0]] || 0) + 1;
    var a = Array.isArray(r[3]) ? r[3] : [r[3]];
    return { id:'kqb-' + r[0] + '-' + n[r[0]], f:r[0], q:r[1], c:r[2], a:a.map(function(x){ return x - 1; }), e:r[4] || '', src:KQ_SRC.q, kind:'builtin' };
  });
  return kqBuiltinCache;
}
function kqOwnList(){ return (Array.isArray(S.kqs) ? S.kqs : []).filter(function(x){ return x && x.id && x.q && Array.isArray(x.choices) && x.choices.length >= 2; }); }
function kqUserQ(x){
  var c = x.choices.map(function(s){ return String(s); });
  var a = (Array.isArray(x.ans) ? x.ans : [x.ans]).map(Number).filter(function(i){ return i >= 0 && i < c.length; });
  return { id:x.id, f:kqFieldOk(x.field) ? x.field : 'tougou', q:x.q, c:c, a:a.length ? a : [0], e:x.exp || '', src:x.src || KQ_SRC.hand, kind:x.kind || 'hand', own:1 };
}
function kqAllQs(){ return kqBuiltinQs().concat(kqOwnList().map(kqUserQ)); }
function kqQ(id){
  var b = kqBuiltinQs();
  for(var i = 0; i < b.length; i++) if(b[i].id === id) return b[i];
  var o = kqOwnList().filter(function(x){ return x.id === id; })[0];
  return o ? kqUserQ(o) : null;
}
function kqSame(a, b){
  if(a.length !== b.length) return false;
  return a.slice().sort().join(',') === b.slice().sort().join(',');
}
function kqLogOf(id){ var l = (S.kqLog || {})[id]; return (l && typeof l === 'object') ? l : null; }
/* 答えを記録する（間隔反復：まちがえたら次の日、正解なら 3日→7日→14日… あとに） */
function kqLogAnswer(id, ok){
  S.kqLog = (S.kqLog && typeof S.kqLog === 'object') ? S.kqLog : {};
  var td = today(), now = Date.now();
  var o = Object.assign({ n:0, ok:0, miss:0, box:0 }, kqLogOf(id) || {});
  o.n++;
  if(ok){ o.ok++; o.box = Math.min(toNum(o.box) + 1, KQ_IVL.length - 1); }
  else { o.miss++; o.box = 0; }
  o.res = ok ? 1 : 0; o.last = td;
  o.due = shiftDate(td, ok ? KQ_IVL[o.box] : 1);
  o.mt = now;
  S.kqLog[id] = o;
  var dk = 'day|' + td + '|' + DEV.id;
  var d = Object.assign({ n:0, ok:0 }, S.kqLog[dk] || {});
  d.n++; if(ok) d.ok++; d.mt = now;
  S.kqLog[dk] = d;
  touch('kqLog');
}
function kqDayCount(ymd){
  var n = 0, ok = 0, log = S.kqLog || {}, p = 'day|' + ymd + '|';
  Object.keys(log).forEach(function(k){ if(k.indexOf(p) === 0 && log[k]){ n += toNum(log[k].n); ok += toNum(log[k].ok); } });
  return { n:n, ok:ok };
}
function kqStreak(){
  var d = today(), n = 0;
  if(!kqDayCount(d).n) d = shiftDate(d, -1);
  while(kqDayCount(d).n > 0 && n < 400){ n++; d = shiftDate(d, -1); }
  return n;
}
/* 分野ごとの数と正答率 */
function kqStats(){
  var td = today(), by = {}, all = { total:0, answered:0, n:0, ok:0, due:0, miss:0, fresh:0 };
  KQ_FIELDS.forEach(function(f){ by[f[0]] = { id:f[0], name:f[1], total:0, answered:0, n:0, ok:0, due:0, miss:0, fresh:0 }; });
  kqAllQs().forEach(function(q){
    var b = by[q.f], l = kqLogOf(q.id);
    [b, all].forEach(function(x){
      if(!x) return;
      x.total++;
      if(l && toNum(l.n)){
        x.answered++; x.n += toNum(l.n); x.ok += toNum(l.ok);
        if(l.res === 0) x.miss++;
        if(isYmd(l.due) && l.due <= td) x.due++;
      }else x.fresh++;
    });
  });
  var list = KQ_FIELDS.map(function(f){ var b = by[f[0]]; b.rate = b.n ? Math.round(b.ok * 100 / b.n) : null; return b; });
  all.rate = all.n ? Math.round(all.ok * 100 / all.n) : null;
  var weak = list.filter(function(b){ return b.n >= 3 && b.rate < 60; }).sort(function(a, b){ return a.rate - b.rate; });
  return { all:all, fields:list, weak:weak };
}
/* 出し方ごとの問題 */
function kqPool(field, mode){
  var td = today();
  return kqAllQs().filter(function(q){
    if(field && q.f !== field) return false;
    var l = kqLogOf(q.id), done = l && toNum(l.n);
    if(mode === 'new') return !done;
    if(mode === 'miss') return !!done && l.res === 0;
    if(mode === 'due') return !!done && isYmd(l.due) && l.due <= td;
    return true;
  });
}
var KQ_MODES = [['rand','🎲 ランダム'], ['new','🆕 まだの問題'], ['miss','❌ まちがえた問題'], ['due','🔁 今日の復習']];
function kqStart(mode, ids){
  var list;
  if(ids) list = ids.map(kqQ).filter(Boolean);
  else{
    list = kqPool(kqState.field, mode);
    if(mode === 'due') list.sort(function(a, b){ return String(kqLogOf(a.id).due).localeCompare(String(kqLogOf(b.id).due)); });
    else list = kqShuffle(list);
    list = list.slice(0, kqState.n || 10);
  }
  if(!list.length){ toast(mode === 'due' ? '今日の復習はありません' : mode === 'miss' ? 'まちがえた問題はありません' : mode === 'new' ? 'まだの問題はありません' : '問題がありません'); return; }
  kqState.drill = { mode:mode || 'rand', queue:list.map(function(q){ return q.id; }), pos:0, picked:[], judged:false, last:null, ok:0, done:0, wrong:[] };
  render(); kqGoTop();
}
function kqJudge(){
  var d = kqState.drill; if(!d || d.judged) return;
  var q = kqQ(d.queue[d.pos]); if(!q) return;
  var ok = kqSame(d.picked, q.a);
  d.judged = true; d.last = ok; d.done++;
  if(ok) d.ok++; else d.wrong.push(q.id);
  kqLogAnswer(q.id, ok);
  persist(); kqPushSoon(); render();
}
function kqNext(){
  var d = kqState.drill; if(!d) return;
  d.pos++; d.picked = []; d.judged = false; d.last = null;
  if(d.pos >= d.queue.length){
    d.end = true;
    if(d.done && typeof petStudyReward === 'function'){ try{ petStudyReward(d.done); }catch(e){} }
    kqPushNow(); kqGoTop(); return;
  }
  render(); kqGoTop();
}
/* 問題 → 暗記カード */
function kqQToCard(q){
  var qs = q.q + '\n' + q.c.map(function(c, i){ return KQ_NUM[i] + c; }).join('　');
  var as = '正解：' + q.a.map(function(i){ return KQ_NUM[i] + q.c[i]; }).join('・') + (q.e ? '\n' + q.e : '') + '\n（出典：' + q.src + '）';
  return { q:qs.slice(0, 300), a:as.slice(0, 500) };
}
function kqExpItem(qid){
  return (S.kmItems || []).filter(function(x){ return x && x.mod === 'kokushi' && x.type === 'exp' && x.qid === qid; })
    .sort(function(a, b){ return toNum(b.mt) - toNum(a.mt); })[0] || null;
}

/* ===== 手帳の中から、関係するメモ・暗記カードをさがす（AIの解説の出典にする） ===== */
var KQ_STOP = /^(どれか|正しい|適切|もっとも|次の|看護|患者|場合|とき|ため|こと|もの|これ|それ|以下|以上|について|として|する|した|される|ある|いる|なる|選べ)$/;
function kqWords(text){
  var m = String(text || '').match(/[一-鿿゠-ヿー]{2,}|[A-Za-z][A-Za-z0-9\-]{1,}/g) || [];
  var seen = {}, out = [];
  m.forEach(function(w){ if(!KQ_STOP.test(w) && !seen[w]){ seen[w] = 1; out.push(w); } });
  return out.slice(0, 40);
}
function kqRelated(text, max){
  var words = kqWords(text), out = [];
  if(!words.length) return out;
  var score = function(s){ var n = 0; words.forEach(function(w){ if(s.indexOf(w) >= 0) n += w.length >= 3 ? 2 : 1; }); return n; };
  (S.notes || []).forEach(function(n){
    if(!n) return;
    var sc = score(String(n.title || '') + '\n' + String(n.body || ''));
    if(sc >= 2) out.push({ kind:'メモ', title:'メモ「' + (n.title || '（題名なし）') + '」', text:String(n.body || '').slice(0, 500), sc:sc });
  });
  (S.cards || []).forEach(function(c){
    if(!c) return;
    var s = String(c.q || '') + '\n' + String(c.a || '');
    var sc = score(s);
    if(sc >= 2) out.push({ kind:'暗記カード', title:'暗記カード「' + String(c.q || '').slice(0, 30) + '」', text:s.slice(0, 300), sc:sc });
  });
  var memos = S.memos || {};
  Object.keys(memos).forEach(function(k){
    var m = memos[k]; if(!m || !m.text) return;
    var sc = score(String(m.text));
    if(sc >= 2) out.push({ kind:'授業のメモ', title:'授業のメモ「' + k + '」', text:String(m.text).slice(0, 500), sc:sc });
  });
  return out.sort(function(a, b){ return b.sc - a.sc; }).slice(0, max || 6);
}
async function kqAiExplain(qid){
  var q = kqQ(qid); if(!q) return null;
  if(kqState.busy) return null;
  kqState.busy = 'exp:' + qid; kqRender();
  try{
    var rel = kqRelated(q.q + ' ' + q.c.join(' ') + ' ' + q.e);
    var prompt = 'あなたは看護師国家試験の対策を手伝う先生です。次の問題について、看護学生にわかるように解説してください。\n' +
      '・正解の理由と、ほかの選択肢がちがう理由を、ひとつずつ短く。\n' +
      '・覚えるポイントを1〜3こ。\n' +
      '・下の「手帳の中の資料」に関係することがあれば使い、使った資料の題名（「」までふくめて、そのまま）を sources に入れる。使わなかったら空の配列。資料にない題名は書かない。\n' +
      '・資料にないことは、日本の看護の教科書で一般的な知識だけで書く。あやふやなことは書かない。\n' +
      'JSONだけで答える：{"exp":"解説","points":["ポイント"],"sources":["使った資料の題名"]}\n\n' +
      '問題：' + q.q + '\n' + q.c.map(function(c, i){ return (i + 1) + '. ' + c; }).join('\n') + '\n正解：' + q.a.map(function(i){ return i + 1; }).join('・') +
      (q.e ? '\nもとの解説：' + q.e : '') + '\n\n手帳の中の資料：' +
      (rel.length ? '\n' + rel.map(function(r){ return '■' + r.title + '\n' + r.text; }).join('\n') : 'なし');
    var j = await kqAi('kq-exp', [], prompt, 4096);
    var text = String(j.exp || j.explanation || '').trim();
    if(!text) throw new Error('解説をもらえませんでした');
    var titles = rel.map(function(r){ return r.title; });
    var srcs = (Array.isArray(j.sources) ? j.sources : []).map(function(s){ return String(s || '').trim(); })
      .filter(function(s, k, arr){ return titles.indexOf(s) >= 0 && arr.indexOf(s) === k; });
    var pts = (Array.isArray(j.points) ? j.points : []).map(function(s){ return String(s || '').trim().slice(0, 200); }).filter(Boolean).slice(0, 5);
    S.kmItems = Array.isArray(S.kmItems) ? S.kmItems : [];
    var old = kqExpItem(qid);
    if(old) removeItem('kmItems', old.id);
    var it = { id:uid('km'), mt:Date.now(), mod:'kokushi', type:'exp', qid:qid, q:q.q.slice(0, 120), text:text.slice(0, 2500), points:pts, sources:srcs, src:KQ_SRC.ai };
    S.kmItems.push(it);
    kqState.busy = '';
    commit();
    return it;
  }catch(e){
    kqState.busy = '';
    toast('解説をもらえませんでした：' + e.message, true);
    kqRender();
    return null;
  }
}

/* ===== 写真から・AIに作らせる（見て選んでから追加） ===== */
function kqCleanQs(list, def){
  var seen = {};
  return (Array.isArray(list) ? list : []).map(function(x){
    x = x || {};
    var c = (Array.isArray(x.choices) ? x.choices : []).map(function(s){ return String(s == null ? '' : s).replace(/^\s*[0-9０-９①-⑨]+[\.．、)）]?\s*/, '').trim().slice(0, 200); }).filter(Boolean).slice(0, 8);
    var a = (Array.isArray(x.ans) ? x.ans : [x.ans]).map(function(v){ return Number(String(v).replace(/[^0-9]/g, '')) - 1; })
      .filter(function(i, k, arr){ return i >= 0 && i < c.length && arr.indexOf(i) === k; });
    return { f:kqFieldOf(x.field, def), q:String(x.q || x.question || '').trim().slice(0, 600), c:c, a:a,
             e:String(x.exp || x.explanation || '').trim().slice(0, 800), aiAns:x.ansFrom === 'ai' ? 1 : 0, on:1 };
  }).filter(function(x){
    if(!x.q || x.c.length < 2 || !x.a.length || seen[x.q]) return false;
    seen[x.q] = 1; return true;
  }).slice(0, 20);
}
var KQ_FIELD_LIST_TEXT = KQ_FIELDS.map(function(f){ return f[0] + '=' + f[1]; }).join('、');
async function kqPhotoRead(urls, name){
  if(kqState.busy) return null;
  name = String(name || '').trim() || '問題集・過去問の写真';
  var def = kqV('kq_pf') || kqState.field || 'hisshu';
  kqState.busy = 'photo'; kqState.preview = null; kqRender();
  try{
    var prompt = 'あなたは看護師国家試験の問題集・過去問の写真を読みとる係です。写真にうつっている問題を、1問ずつ取り出してください。\n' +
      '・問題文と選択肢は、写真のとおりに書く。読めないところは推測しないで、その問題は入れない。選択肢の番号は書かない。\n' +
      '・正解が写真にあれば、その番号（1からかぞえる）を ans に入れ、ansFrom を "photo" にする。写真に正解がなければ、あなたが正しいと考える番号を入れて ansFrom を "ai" にする。「2つ選べ」なら2つ入れる。\n' +
      '・解説が写真にあれば短くまとめて exp に。なければ、正解の理由を1〜2文で書く。\n' +
      '・分野（field）は次のどれか：' + KQ_FIELD_LIST_TEXT + '\n' +
      '・患者さんの名前など、個人がわかる情報は入れない。多くても15問まで。\n' +
      'JSONだけで答える：{"questions":[{"field":"kiso","q":"問題文","choices":["選択肢","選択肢"],"ans":[2],"ansFrom":"photo","exp":"解説"}]}';
    var j = await kqAi('kq-photo', urls, prompt, 8192);
    var items = kqCleanQs(j.questions, def);
    if(!items.length) throw new Error('問題が見つかりませんでした');
    kqState.preview = { kind:'photo', src:'写真：' + name, items:items };
    toast(items.length + '問読みとりました。見てから追加してください');
  }catch(e){
    toast('読みとれませんでした：' + e.message, true);
  }finally{
    kqState.busy = ''; kqRender();
  }
  return kqState.preview;
}
async function kqMakeAi(field, n, theme){
  if(kqState.busy) return null;
  field = kqFieldOk(field) ? field : 'hisshu'; n = Math.max(1, Math.min(10, toNum(n) || 5));
  kqState.busy = 'make'; kqState.preview = null; kqRender();
  try{
    var have = kqAllQs().filter(function(q){ return q.f === field; }).map(function(q){ return '・' + q.q.slice(0, 60); }).slice(0, 30);
    var prompt = 'あなたは看護師国家試験の問題を作る先生です。看護学部の学生の練習用に、「' + kqFieldName(field) + '」の分野の練習問題を' + n + '問作ってください。' +
      (theme ? 'テーマ：' + String(theme).slice(0, 100) : '') + '\n' +
      '・看護師国家試験の出題基準に合う、日本の看護の教科書にのっている確かな内容だけ。本物の過去問の文章をそのまま写さない。\n' +
      '・選択肢は' + (field === 'hisshu' ? '4つ' : '4つか5つ') + '。正解は1つ（「2つ選べ」の問題なら2つ）。ほかの選択肢は、はっきりまちがいにする。\n' +
      '・ans は正解の番号（1からかぞえる）。解説は、正解の理由とまちがいやすい点を1〜3文で。\n' +
      (have.length ? '・次の問題と同じものは作らない：\n' + have.join('\n') + '\n' : '') +
      'JSONだけで答える：{"questions":[{"q":"問題文","choices":["選択肢","選択肢"],"ans":[1],"exp":"解説"}]}';
    var j = await kqAi('kq-make', [], prompt, 8192);
    var items = kqCleanQs(j.questions, field).map(function(x){ x.f = field; x.aiAns = 0; return x; });
    if(!items.length) throw new Error('問題を作れませんでした');
    kqState.preview = { kind:'ai', src:KQ_SRC.ai, items:items };
    toast(items.length + '問できました。見てから追加してください');
  }catch(e){
    toast('作れませんでした：' + e.message, true);
  }finally{
    kqState.busy = ''; kqRender();
  }
  return kqState.preview;
}
function kqPreviewAdd(){
  var pv = kqState.preview; if(!pv) return 0;
  S.kqs = Array.isArray(S.kqs) ? S.kqs : [];
  var now = Date.now(), n = 0;
  pv.items.forEach(function(x, i){
    if(!x.on) return;
    if(S.kqs.some(function(y){ return y.q === x.q; })) return;
    var src = pv.src + (x.aiAns ? '（正解はAIが推定・教科書で確かめて）' : '');
    S.kqs.push({ id:uid('kq'), mt:now + i, ct:now, field:x.f, q:x.q, choices:x.c, ans:x.a, exp:x.e, src:src, kind:pv.kind });
    n++;
  });
  kqState.preview = null;
  commit();
  toast(n ? n + '問を追加しました' : '追加する問題がありませんでした', !n);
  return n;
}
function kqHandAdd(){
  var q = String(kqV('kq_aq') || '').trim();
  var c = [], a = [];
  for(var i = 0; i < 5; i++){
    var s = String(kqV('kq_ac' + i) || '').trim();
    if(!s) continue;
    if(kqV('kq_ak' + i) === true) a.push(c.length);
    c.push(s.slice(0, 200));
  }
  if(!q){ toast('問題文を入れてください', true); return false; }
  if(c.length < 2){ toast('選択肢を2つ以上入れてください', true); return false; }
  if(!a.length){ toast('正解の選択肢にチェックを入れてください', true); return false; }
  var srcText = String(kqV('kq_as') || '').trim();
  S.kqs = Array.isArray(S.kqs) ? S.kqs : [];
  var now = Date.now();
  S.kqs.push({ id:uid('kq'), mt:now, ct:now, field:kqFieldOf(kqV('kq_af')), q:q.slice(0, 600), choices:c, ans:a,
               exp:String(kqV('kq_ae') || '').trim().slice(0, 800), src:srcText ? KQ_SRC.hand + '：' + srcText.slice(0, 80) : KQ_SRC.hand, kind:'hand' });
  kqClearIn('kq_a');
  ['kq_aq', 'kq_ae', 'kq_as'].concat([0, 1, 2, 3, 4].map(function(k){ return 'kq_ac' + k; })).forEach(function(id){ var e = document.getElementById(id); if(e) e.value = ''; });
  [0, 1, 2, 3, 4].forEach(function(k){ var e = document.getElementById('kq_ak' + k); if(e) e.checked = false; });
  commit(); toast('問題を追加しました');
  return true;
}

/* ============================== 国試ドリルの画面 ============================== */
function kqDrillView(){
  var d = kqState.drill;
  if(d) return d.end ? kqDrillEndView(d) : kqDrillQView(d);
  var st = kqStats(), dc = kqDayCount(today());
  var h = '';
  var fChips = '<div class="chips kq-chips">' + [['', 'すべて']].concat(KQ_FIELDS).map(function(f){
    return '<button data-act="kq-field" data-v="' + f[0] + '" class="' + (kqState.field === f[0] ? 'on' : '') + '">' + esc(f[1]) + '</button>';
  }).join('') + '</div>';
  var nRow = '<div class="pillrow">' + [5, 10, 20].map(function(n){
    return '<button data-act="kq-n" data-v="' + n + '" class="' + (kqState.n === n ? 'on' : '') + '">' + n + '問ずつ</button>';
  }).join('') + '</div>';
  var modes = '<div class="kq-modes">' + KQ_MODES.map(function(m){
    var n = kqPool(kqState.field, m[0]).length;
    return '<button class="kq-mode" data-act="kq-start" data-v="' + m[0] + '"' + (n ? '' : ' disabled') + '><b>' + m[1] + '</b><span class="s">' + n + '問</span></button>';
  }).join('') + '</div>';
  h += section('国試ドリル', st.all.total + '問',
    '<div class="grid3 keep3">' + kqStat('今日といた', dc.n + '問') + kqStat('正答率', st.all.rate == null ? '−' : st.all.rate + '%') + kqStat('今日の復習', st.all.due + '問') + '</div>' +
    '<div class="row"><div class="grow s">続けて解いた日</div><div class="t num">' + kqStreak() + '日</div></div>' +
    '<label class="f">分野</label>' + fChips +
    '<label class="f">1回の数</label>' + nRow + modes +
    '<p class="note">まちがえた問題は次の日の「今日の復習」にまた出ます。正解すると 3日後・1週間後・2週間後…と、間をあけて出ます。</p>');
  h += section('分野ごとの正答率', st.weak.length ? '苦手：' + st.weak.map(function(b){ return b.name; }).slice(0, 2).join('・') : null,
    st.fields.map(function(b){
      var r = b.rate;
      return '<div class="row kq-frow" data-act="kq-field" data-v="' + b.id + '" role="button"><div class="grow"><div class="t">' + esc(b.name) +
        (b.n >= 3 && r < 60 ? ' <span class="b warn">苦手</span>' : '') + '</div>' +
        '<div class="kq-bar"><i style="width:' + (r == null ? 0 : r) + '%"></i></div>' +
        '<div class="s">' + b.total + '問中 ' + b.answered + '問といた' + (b.n ? '・' + b.ok + '/' + b.n + '回正解' : '') + (b.due ? '・復習 ' + b.due : '') + '</div></div>' +
        '<div class="t num kq-rate">' + (r == null ? '−' : r + '%') + '</div></div>';
    }).join(''));
  h += kqAddView();
  h += kqOwnView();
  h += section('本物の過去問（厚生労働省）', null,
    '<a class="kq-link" href="' + KQ_MHLW + '" target="_blank" rel="noopener">🏛 厚生労働省「看護師国家試験」のページ（過去の問題と正答）</a>' +
    '<a class="kq-link" href="https://www.google.com/search?q=' + encodeURIComponent('看護師国家試験 問題および正答 site:mhlw.go.jp') + '" target="_blank" rel="noopener">🔎 厚生労働省のサイトで「問題および正答」をさがす</a>' +
    '<p class="note">本物の過去問と正答は、毎年、厚生労働省のサイトにのります（PDF）。このドリルのはじめからある問題は「くらしの手帳の練習問題」で、本物の過去問ではありません。過去問は写真から読みこんで、自分の問題にできます。</p>');
  return h;
}
function kqChoicesHtml(q, picked, judged, act, extra){
  return '<div class="kq-choices">' + q.c.map(function(c, i){
    var cls = '';
    if(judged){ if(q.a.indexOf(i) >= 0) cls = ' ok'; else if(picked.indexOf(i) >= 0) cls = ' ng'; }
    else if(picked.indexOf(i) >= 0) cls = ' on';
    return '<button class="kq-ch' + cls + '" data-act="' + act + '" data-i="' + i + '"' + (extra || '') + (judged ? ' disabled' : '') + '>' +
      '<b>' + KQ_NUM[i] + '</b><span>' + esc(c) + '</span>' + (judged && q.a.indexOf(i) >= 0 ? '<i>正解</i>' : '') + '</button>';
  }).join('') + '</div>';
}
function kqAnswerHtml(q, ok, small){
  var h = '<div class="msg ' + (ok ? 'ok' : 'ng') + ' kq-res">' + (ok ? '⭕ 正解！' : '❌ ざんねん') + '　正解は ' +
    q.a.map(function(i){ return KQ_NUM[i]; }).join('・') + '</div>' +
    '<div class="kq-exp"><b>解説</b><p>' + esc(q.e || '（解説はありません）') + '</p>' + kqSrcHtml(q.src) + '</div>';
  if(small) return h;
  var busy = kqState.busy === 'exp:' + q.id;
  h += kqAiExpHtml(q);
  h += '<div class="pillrow kq-acts"><button data-act="kq-card" data-id="' + esc(q.id) + '">🃏 暗記カードにする</button>' +
    '<button data-act="kq-aiexp" data-id="' + esc(q.id) + '"' + (kqState.busy ? ' disabled' : '') + '>' + (busy ? 'AIが考えています…' : '🤖 AIにくわしく解説してもらう') + '</button></div>' +
    '<p class="note">AIの解説には、手帳のメモ・授業のメモ・暗記カードで関係するものもいっしょに送り、使ったものを出典として出します。</p>';
  return h;
}
function kqAiExpHtml(q){
  var it = kqExpItem(q.id);
  if(!it) return '';
  return '<div class="kq-aiexp"><b>🤖 AIの解説</b><p>' + esc(it.text) + '</p>' +
    (it.points && it.points.length ? '<ul>' + it.points.map(function(p){ return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') +
    kqSrcHtml(KQ_SRC.ai) +
    '<div class="kq-src">手帳の中の出典：' + (it.sources && it.sources.length ? it.sources.map(esc).join('、') : 'なし（関係するメモは使われませんでした）') + '</div>' +
    '</div>';
}
function kqDrillQView(d){
  var q = kqQ(d.queue[d.pos]);
  if(!q) return section('国試ドリル', null, '<div class="empty">この問題は消されました。</div><button class="btn" data-act="kq-next">次の問題 ›</button>');
  var multi = q.a.length > 1, last = d.pos + 1 >= d.queue.length;
  var h = '<section><div class="head"><h2>' + esc(kqFieldName(q.f)) + '</h2><span>' + (d.pos + 1) + ' / ' + d.queue.length + '　正解 ' + d.ok + '</span></div>' +
    '<div class="box kq-qbox"><div class="kq-q">' + esc(q.q) + (multi && !/選べ/.test(q.q) ? '（' + q.a.length + 'つ選ぶ）' : '') + '</div>' +
    kqChoicesHtml(q, d.picked, d.judged, 'kq-pick');
  if(multi && !d.judged) h += '<button class="btn" data-act="kq-judge"' + (d.picked.length ? '' : ' disabled') + '>こたえあわせ</button>';
  if(!d.judged) h += kqSrcHtml(q.src);
  if(d.judged) h += kqAnswerHtml(q, d.last) + '<button class="btn" data-act="kq-next">' + (last ? '結果を見る' : '次の問題 ›') + '</button>';
  h += '</div></section><div class="pillrow"><button data-act="kq-quit">やめる</button></div>';
  return h;
}
function kqDrillEndView(d){
  var wrong = d.wrong.map(kqQ).filter(Boolean);
  return section('おつかれさま！', d.done + '問', '<div class="kq-end"><div class="kq-big">' + (d.done && d.ok === d.done ? '🎉' : '📝') + '</div>' +
    '<p><b>' + d.done + '問中 ' + d.ok + '問 正解</b>（' + (d.done ? Math.round(d.ok * 100 / d.done) : 0) + '%）</p>' +
    '<p class="note">今日といた数：' + kqDayCount(today()).n + '問・続けて ' + kqStreak() + '日</p></div>' +
    (wrong.length ? '<label class="f">まちがえた問題（次の日にまた出ます）</label>' + wrong.map(function(q){
      return '<div class="row"><div class="grow"><div class="t kq-clamp">' + esc(q.q) + '</div><div class="s">正解：' + q.a.map(function(i){ return KQ_NUM[i] + q.c[i]; }).join('・') + '</div></div></div>';
    }).join('') : '') +
    '<div class="pair" style="margin-top:10px">' + (wrong.length ? '<button class="btn" data-act="kq-retry">まちがえた問題をもう一度</button>' : '') +
    '<button class="btn ghost" data-act="kq-quit">もどる</button></div>');
}
function kqAddView(){
  var h = '', pv = kqState.preview, a = kqState.add, busy = kqState.busy;
  if(pv) h += kqPreviewView(pv);
  var btn = function(v, label){ return '<button data-act="kq-add-open" data-v="' + v + '" class="' + (a === v ? 'on' : '') + '">' + label + '</button>'; };
  var inner = '<div class="pillrow">' + btn('hand', '✏️ 自分で入力') + btn('photo', '📷 写真から（AI）') + btn('make', '🤖 AIに作ってもらう') + '</div>';
  if(a === 'hand'){
    inner += '<div class="field"><label class="f" for="kq_af">分野</label><select id="kq_af">' + kqFieldOptions(kqIn('kq_af', kqState.field || 'hisshu')) + '</select></div>' +
      '<div class="field"><label class="f" for="kq_aq">問題文</label><textarea id="kq_aq" rows="3" placeholder="例：成人の安静時の脈拍数の目安はどれか。">' + esc(kqIn('kq_aq')) + '</textarea></div>' +
      '<label class="f">選択肢（正解にチェック。空の欄は使いません）</label>' +
      [0, 1, 2, 3, 4].map(function(i){
        return '<div class="kq-chrow"><input type="checkbox" id="kq_ak' + i + '" aria-label="' + (i + 1) + 'が正解"' + (kqIn('kq_ak' + i) === true ? ' checked' : '') + '>' +
          '<span>' + KQ_NUM[i] + '</span><input id="kq_ac' + i + '" placeholder="選択肢' + (i + 1) + '" value="' + esc(kqIn('kq_ac' + i)) + '"></div>';
      }).join('') +
      '<div class="field"><label class="f" for="kq_ae">解説（なくてもよい）</label><textarea id="kq_ae" rows="2">' + esc(kqIn('kq_ae')) + '</textarea></div>' +
      '<div class="field"><label class="f" for="kq_as">出典（本の名前・ページなど）</label><input id="kq_as" placeholder="例：〇〇問題集 p.12" value="' + esc(kqIn('kq_as')) + '"></div>' +
      '<button class="btn" data-act="kq-add-save">この問題を追加</button>';
  }
  if(a === 'photo'){
    inner += '<p class="note">問題集・過去問の写真をAIが読みとって、問題にします。追加する前に、見て選べます。</p>' +
      '<div class="field"><label class="f" for="kq_pn">写真の名前（出典になります）</label><input id="kq_pn" placeholder="例：クエスチョン・バンク p.120／第114回 午前" value="' + esc(kqIn('kq_pn')) + '"></div>' +
      '<div class="field"><label class="f" for="kq_pf">分野がわからないときの分野</label><select id="kq_pf">' + kqFieldOptions(kqIn('kq_pf', kqState.field || 'hisshu')) + '</select></div>' +
      '<button class="btn ghost" data-act="kq-photo"' + (busy ? ' disabled' : '') + '>' + (busy === 'photo' ? 'AIが読んでいます…' : '📷 写真をえらぶ（4枚まで）') + '</button>' +
      '<p class="note">' + KQ_PRIVACY + '</p>';
  }
  if(a === 'make'){
    inner += '<p class="note">AIに練習問題を作ってもらいます。AIはまちがえることがあるので、追加する前に見て選べます。</p>' +
      '<div class="grid2"><div class="field"><label class="f" for="kq_mf">分野</label><select id="kq_mf">' + kqFieldOptions(kqIn('kq_mf', kqState.field || 'hisshu')) + '</select></div>' +
      '<div class="field"><label class="f" for="kq_mn">数</label><select id="kq_mn">' + [3, 5, 10].map(function(n){ return '<option value="' + n + '"' + (String(kqIn('kq_mn', '5')) === String(n) ? ' selected' : '') + '>' + n + '問</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label class="f" for="kq_mt">しぼりたいテーマ（なくてよい）</label><input id="kq_mt" placeholder="例：心不全の看護・小児の発達" value="' + esc(kqIn('kq_mt')) + '"></div>' +
      '<button class="btn ghost" data-act="kq-make"' + (busy ? ' disabled' : '') + '>' + (busy === 'make' ? 'AIが作っています…' : '🤖 問題を作ってもらう') + '</button>';
  }
  h += section('問題をふやす', null, inner);
  return h;
}
function kqPreviewView(pv){
  var on = pv.items.filter(function(x){ return x.on; }).length;
  return section(pv.kind === 'photo' ? '写真から読みとった問題（見てから追加）' : 'AIが作った問題（見てから追加）', on + '問を追加',
    kqWarn('AIはまちがえることがあります。問題・正解・解説を、教科書や問題集で確かめてから追加してください。') +
    pv.items.map(function(x, i){
      return '<div class="kq-pv' + (x.on ? '' : ' off') + '">' +
        '<div class="kq-pvhd"><label><input type="checkbox" data-act="kq-pv-toggle" data-i="' + i + '"' + (x.on ? ' checked' : '') + '> <b>' + (i + 1) + '問め</b></label>' +
        '<select data-kqpv="' + i + '" aria-label="分野">' + kqFieldOptions(x.f) + '</select></div>' +
        '<div class="kq-q">' + esc(x.q) + '</div>' +
        '<ol class="kq-pvc">' + x.c.map(function(c, j){ return '<li class="' + (x.a.indexOf(j) >= 0 ? 'kq-okc' : '') + '">' + esc(c) + (x.a.indexOf(j) >= 0 ? '　✅正解' : '') + '</li>'; }).join('') + '</ol>' +
        (x.aiAns ? kqWarn('写真に正解がなかったので、正解はAIが考えたものです。') : '') +
        (x.e ? '<div class="s">' + esc(x.e) + '</div>' : '') + kqSrcHtml(pv.src + (x.aiAns ? '（正解はAIが推定）' : '')) + '</div>';
    }).join('') +
    '<div class="pair" style="margin-top:8px"><button class="btn" data-act="kq-pv-add">チェックしたものを追加</button>' +
    '<button class="btn ghost" data-act="kq-pv-cancel" style="flex:0 0 auto">やめる</button></div>');
}
function kqOwnView(){
  var own = kqOwnList().slice().sort(function(a, b){ return toNum(b.mt) - toNum(a.mt); });
  if(!own.length) return '';
  var shown = own.slice(0, 30);
  return section('自分で足した問題', own.length + '問',
    shown.map(function(x){
      var q = kqUserQ(x), l = kqLogOf(x.id);
      return '<div class="row"><div class="grow"><div class="t kq-clamp">' + esc(q.q) + '</div>' +
        '<div class="s">' + esc(kqFieldName(q.f)) + '・正解 ' + q.a.map(function(i){ return KQ_NUM[i]; }).join('・') + (l && l.n ? '・' + l.ok + '/' + l.n + '回正解' : '') + '</div>' +
        '<div class="s2">出典：' + esc(q.src) + '</div></div>' +
        '<button class="mini" data-act="kq-one" data-id="' + esc(x.id) + '">解く</button>' +
        '<button class="mini" data-act="kq-del" data-id="' + esc(x.id) + '">消す</button></div>';
    }).join('') + (own.length > shown.length ? '<p class="note">ほかに ' + (own.length - shown.length) + '問あります。</p>' : ''));
}

/* ===== 今日タブの「今日の1問」 ===== */
function kqDailyQ(ymd){
  var cfg = kqCfg();
  var pool = kqAllQs().filter(function(q){ return q.a.length === 1 && (!cfg.todayField || q.f === cfg.todayField); });
  if(!pool.length) pool = kqAllQs().filter(function(q){ return q.a.length === 1; });
  if(!pool.length) return null;
  pool.sort(function(a, b){ return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
  return pool[kqHash('kq' + (ymd || today())) % pool.length];
}
function kqTodayCard(ctx){
  if(!ctx || !ctx.isToday) return '';
  if(kqCfg().today === 0) return '';
  var q = kqDailyQ(ctx.ymd || today());
  if(!q) return '';
  var l = kqLogOf(q.id), done = l && l.last === today();
  var inner = '<div class="kq-q kq-q-s">' + esc(q.q) + '</div>';
  if(done) inner += kqChoicesHtml(q, [], true, 'kq-today', '') + kqAnswerHtml(q, l.res === 1, true);
  else inner += kqChoicesHtml(q, [], false, 'kq-today', ' data-id="' + esc(q.id) + '"') + kqSrcHtml(q.src);
  inner += '<div class="pillrow" style="margin-top:6px"><button class="mini" data-act="kq-go" data-tool="kq-drill">国試ドリルをひらく</button></div>';
  return secWrap('kqtoday', '今日の1問（国試）', kqFieldName(q.f), inner);
}

/* ============================== 略語・用語の辞書 ============================== */
function kqDictPrep(o){
  o.nAbbr = kqNorm(o.abbr); o.nHead = kqNorm(o.abbr + ' ' + o.full + ' ' + o.yomi + ' ' + o.ja); o.nAll = o.nHead + kqNorm(o.desc);
  return o;
}
var kqDictCache = null;
function kqDictBuiltin(){
  if(kqDictCache) return kqDictCache;
  kqDictCache = (typeof KQ_DICT !== 'undefined' ? KQ_DICT : []).map(function(s, i){
    var p = String(s).split('|');
    return kqDictPrep({ k:'b' + i, abbr:p[0] || '', full:p[1] || '', yomi:p[2] || '', ja:p[3] || '', desc:p[4] || '', src:KQ_SRC.dict });
  });
  return kqDictCache;
}
function kqDictOwn(){
  return (Array.isArray(S.abbrs) ? S.abbrs : []).filter(function(x){ return x && x.id && x.abbr; }).map(function(x){
    return kqDictPrep({ k:'u' + x.id, id:x.id, abbr:String(x.abbr), full:String(x.full || ''), yomi:String(x.yomi || ''), ja:String(x.ja || ''), desc:String(x.desc || ''), src:x.src || KQ_SRC.hand, url:x.url || '', own:1 });
  });
}
function kqDictAll(){ return kqDictOwn().concat(kqDictBuiltin()); }
function kqDictSearch(q, max){
  var nq = kqNorm(q), all = kqDictAll();
  if(!nq) return all.slice(0, max || 40);
  var hits = [];
  all.forEach(function(o, i){
    var r = -1;
    if(o.nAbbr === nq) r = 0;
    else if(o.nAbbr.indexOf(nq) === 0) r = 1;
    else if(o.nHead.indexOf(nq) >= 0) r = 2;
    else if(o.nAll.indexOf(nq) >= 0) r = 3;
    if(r >= 0) hits.push({ o:o, r:r, i:i });
  });
  hits.sort(function(a, b){ return (a.r - b.r) || (a.i - b.i); });
  return hits.slice(0, max || 60).map(function(h){ return h.o; });
}
function kqDictFind(k){ return kqDictAll().filter(function(o){ return o.k === k; })[0] || null; }
function kqDictCard(o){
  return { q:o.abbr + (o.full && o.full !== o.abbr ? '（' + o.full + '）' : '') + ' とは？', a:(o.ja ? o.ja + '。' : '') + o.desc + '\n（出典：' + o.src + '）' };
}
function kqDictRow(o){
  var open = kqState.dictOpen === o.k;
  var wq = o.ja && !/[A-Za-z①②]/.test(o.ja) && o.ja.length < 20 ? o.ja.replace(/（.*$/, '') : o.abbr;
  return '<div class="kq-drow' + (open ? ' on' : '') + '" data-act="kq-dict-open" data-k="' + esc(o.k) + '" role="button" tabindex="0">' +
    '<div class="kq-dhd"><b class="kq-abbr">' + esc(o.abbr) + '</b><span class="kq-ja">' + esc(o.ja) + '</span>' + (o.own ? '<span class="b cr">自分</span>' : '') + '</div>' +
    '<div class="s">' + esc(o.full) + (o.yomi ? '（' + esc(o.yomi) + '）' : '') + '</div>' +
    (open ? '<div class="kq-dbody"><p>' + esc(o.desc || '（説明はありません）') + '</p>' + kqSrcHtml(o.src, o.url) +
      '<div class="pillrow"><button class="mini" data-act="kq-dict-card" data-k="' + esc(o.k) + '">🃏 暗記カードにする</button>' +
      '<button class="mini" data-act="kq-wiki" data-q="' + esc(wq) + '">📚 Wikipediaでもっと</button>' +
      (o.own ? '<button class="mini" data-act="kq-abbr-del" data-id="' + esc(o.id) + '">消す</button>' : '') + '</div></div>' : '') +
    '</div>';
}
function kqDictResults(){
  var q = kqState.dictQ.trim(), list = kqDictSearch(q, 60), all = kqDictAll().length;
  var h = '';
  if(!q) h += '<p class="note">ことばを入れると、略語・英語・読み（ひらがな・カタカナ）・日本語のどれでもさがせます。</p>';
  h += list.length ? list.map(kqDictRow).join('') : '<div class="empty">辞書には「' + esc(q) + '」がありません。</div>';
  if(!q && all > list.length) h += '<p class="note">ほかに ' + (all - list.length) + '語あります。</p>';
  if(q) h += '<button class="btn ghost kq-wikibtn" data-act="kq-wiki" data-q="' + esc(q) + '">📚 Wikipediaで「' + esc(q) + '」をしらべる</button>';
  return h;
}
function kqDictView(){
  var own = kqDictOwn().length, h = '';
  h += '<section><div class="head"><h2>略語・用語の辞書</h2><span>' + kqDictAll().length + '語' + (own ? '（自分 ' + own + '）' : '') + '</span></div><div class="box">' +
    '<input id="kq_dq" type="search" placeholder="例：ADL・えーでぃーえる・日常生活" value="' + esc(kqState.dictQ) + '" autocomplete="off" enterkeyhint="search">' +
    '<div id="kq_dres" class="kq-dres">' + kqDictResults() + '</div></div></section>';
  h += kqWikiView();
  var add = kqState.dictAdd;
  h += section('自分で足す', null, add ?
    '<div class="grid2"><div class="field"><label class="f" for="kq_na">略語・用語</label><input id="kq_na" placeholder="例：CGA" value="' + esc(kqIn('kq_na')) + '"></div>' +
    '<div class="field"><label class="f" for="kq_nj">日本語の意味</label><input id="kq_nj" placeholder="例：高齢者総合機能評価" value="' + esc(kqIn('kq_nj')) + '"></div></div>' +
    '<div class="grid2"><div class="field"><label class="f" for="kq_nf">英語の正式名</label><input id="kq_nf" placeholder="例：comprehensive geriatric assessment" value="' + esc(kqIn('kq_nf')) + '"></div>' +
    '<div class="field"><label class="f" for="kq_ny">読み</label><input id="kq_ny" placeholder="例：シージーエー" value="' + esc(kqIn('kq_ny')) + '"></div></div>' +
    '<div class="field"><label class="f" for="kq_nd">ひとこと説明</label><textarea id="kq_nd" rows="2">' + esc(kqIn('kq_nd')) + '</textarea></div>' +
    '<div class="field"><label class="f" for="kq_ns">出典（教科書・授業など）</label><input id="kq_ns" placeholder="例：老年看護学の授業" value="' + esc(kqIn('kq_ns')) + '"></div>' +
    '<div class="pair"><button class="btn" data-act="kq-abbr-add">辞書に足す</button><button class="btn ghost" data-act="kq-abbr-open" style="flex:0 0 auto">閉じる</button></div>'
    : '<button class="btn ghost" data-act="kq-abbr-open">✏️ 辞書にないことばを足す</button>');
  return h;
}
function kqWikiView(){
  var w = kqState.wiki;
  if(!w) return '';
  var inner;
  if(w.state === 'loading') inner = '<div class="empty">Wikipediaで「' + esc(w.q) + '」をしらべています…</div>';
  else if(w.state === 'ng') inner = '<div class="empty">Wikipediaに「' + esc(w.q) + '」のページが見つかりませんでした（または、つながりませんでした）。<br>' + esc(w.msg || '') + '</div>';
  else inner = '<div class="kq-wiki"><div class="t">' + esc(w.title) + '</div>' + (w.desc ? '<div class="s">' + esc(w.desc) + '</div>' : '') +
    (w.dis ? kqWarn('いくつかの意味がある言葉です。リンク先で選んでください。') : '') +
    '<p>' + esc(w.extract) + '</p>' + kqSrcHtml('Wikipedia「' + w.title + '」', w.url) +
    kqWarn('Wikipediaはだれでも書ける百科事典です。<b>医学的な正確さは教科書で確かめて</b>ください。') +
    '<div class="pillrow"><button class="mini" data-act="kq-wiki-add">辞書に足す</button><button class="mini" data-act="kq-wiki-card">🃏 暗記カードにする</button></div></div>';
  return section('Wikipediaでしらべた', null, inner + '<div class="pillrow" style="margin-top:6px"><button class="mini" data-act="kq-wiki-close">閉じる</button></div>');
}
function kqWikiUrl(q){ return 'https://ja.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(String(q).trim().replace(/ /g, '_')); }
async function kqWikiLoad(q){
  q = String(q || '').trim().slice(0, 80);
  if(!q) return null;
  kqState.wiki = { q:q, state:'loading' }; kqRender();
  try{
    var j = await apiJson(kqWikiUrl(q));
    if(!j || (!j.extract && j.type !== 'disambiguation')) throw new Error('見つかりませんでした');
    var url = (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) || '';
    var title = String(j.title || q);
    if(!/^https:\/\/ja\.(m\.)?wikipedia\.org\//.test(url)) url = 'https://ja.wikipedia.org/wiki/' + encodeURIComponent(title);
    kqState.wiki = { q:q, state:'ok', title:title, desc:String(j.description || '').slice(0, 120), extract:String(j.extract || '').slice(0, 1500), url:url, dis:j.type === 'disambiguation' };
  }catch(e){
    kqState.wiki = { q:q, state:'ng', msg:String(e && e.message || e).slice(0, 120) };
  }
  kqRender();
  return kqState.wiki;
}
function kqAbbrAdd(o){
  S.abbrs = Array.isArray(S.abbrs) ? S.abbrs : [];
  var nk = kqNorm(o.abbr);
  if(S.abbrs.some(function(x){ return x && kqNorm(x.abbr) === nk && String(x.ja || '') === String(o.ja || ''); })) return null;
  var it = { id:uid('ab'), mt:Date.now(), abbr:String(o.abbr).slice(0, 60), full:String(o.full || '').slice(0, 120), yomi:String(o.yomi || '').slice(0, 60),
             ja:String(o.ja || '').slice(0, 120), desc:String(o.desc || '').slice(0, 600), src:String(o.src || KQ_SRC.hand).slice(0, 120), url:String(o.url || '') };
  S.abbrs.push(it);
  return it;
}

/* ============================== 基準値の早見表 ============================== */
var kqLabCache = null;
function kqLabs(){
  if(kqLabCache) return kqLabCache;
  kqLabCache = (typeof KQ_LABS !== 'undefined' ? KQ_LABS : []).map(function(s, i){
    var p = String(s).split('|');
    var o = { i:i, cat:p[0] || '', name:p[1] || '', abbr:p[2] || '', v:p[3] || '', unit:p[4] || '', note:p[5] || '' };
    o.hay = kqNorm(o.cat + o.name + o.abbr + o.note);
    return o;
  });
  return kqLabCache;
}
function kqLabCats(){ var seen = {}, out = []; kqLabs().forEach(function(o){ if(!seen[o.cat]){ seen[o.cat] = 1; out.push(o.cat); } }); return out; }
function kqLabFilter(){
  var nq = kqNorm(kqState.labQ);
  return kqLabs().filter(function(o){ return (!kqState.labCat || o.cat === kqState.labCat) && (!nq || o.hay.indexOf(nq) >= 0); });
}
function kqLabLabel(o){ return o.name + (o.abbr ? '（' + o.abbr + '）' : ''); }
function kqLabValue(o){ return o.v + (o.unit ? ' ' + o.unit : ''); }
function kqLabCard(o){ return { q:'「' + kqLabLabel(o) + '」の基準値（目安）は？', a:kqLabValue(o) + (o.note ? '\n' + o.note : '') + '\n（出典：' + KQ_SRC.lab + '）' }; }
function kqLabResults(){
  var list = kqLabFilter();
  if(!list.length) return '<div class="empty">見つかりませんでした。</div>';
  var h = '', cur = '';
  list.forEach(function(o){
    if(o.cat !== cur){
      cur = o.cat;
      h += '<div class="kq-lcat"><b>' + esc(cur) + '</b><button class="mini" data-act="kq-lab-cards" data-cat="' + esc(cur) + '">この分類を暗記カードに</button></div>';
    }
    h += '<div class="row kq-lrow"><div class="grow"><div class="t">' + esc(o.name) + (o.abbr ? ' <span class="s2">' + esc(o.abbr) + '</span>' : '') + '</div>' +
      (o.note ? '<div class="s">' + esc(o.note) + '</div>' : '') + '</div>' +
      '<div class="kq-lv num">' + esc(o.v) + (o.unit ? '<small>' + esc(o.unit) + '</small>' : '') + '</div>' +
      '<button class="mini" data-act="kq-lab-card" data-i="' + o.i + '" aria-label="暗記カードにする">＋カード</button></div>';
  });
  return h + kqSrcHtml(KQ_SRC.lab);
}
function kqLabView(){
  var cats = kqLabCats(), h = '';
  h += kqWarn('基準値は<b>目安</b>です。施設・検査の方法・教科書で少しちがいます。実習では、その施設の基準値と先生の資料を優先してください。');
  if(kqState.labQuiz) h += kqLabQuizView();
  h += '<section><div class="head"><h2>基準値の早見表</h2><span>' + kqLabs().length + '項目</span></div><div class="box">' +
    '<input id="kq_lq" type="search" placeholder="例：カリウム・Hb・呼吸数" value="' + esc(kqState.labQ) + '" autocomplete="off">' +
    '<div class="chips kq-chips">' + [''].concat(cats).map(function(c){
      return '<button data-act="kq-lab-cat" data-v="' + esc(c) + '" class="' + (kqState.labCat === c ? 'on' : '') + '">' + esc(c || 'すべて') + '</button>';
    }).join('') + '</div>' +
    '<button class="btn ghost" data-act="kq-lab-quiz">🎯 覚えるクイズ' + (kqState.labCat ? '（' + esc(kqState.labCat) + '）' : '') + '</button>' +
    '<div id="kq_lres" class="kq-lres">' + kqLabResults() + '</div></div></section>';
  return h;
}
/* クイズは数字の基準値だけ（「陰性」などは当てるまでもないので出さない） */
function kqLabNum(o){ return /[0-9]/.test(o.v); }
function kqLabQuizNext(){
  var pool = kqLabFilter().filter(kqLabNum);
  if(pool.length < 2) pool = kqLabs().filter(kqLabNum);
  if(!pool.length) return;
  var prev = kqState.labQuiz || { n:0, ok:0 };
  var x = pool[Math.floor(Math.random() * pool.length)];
  var used = {}; used[kqLabValue(x)] = 1;
  var nums = kqLabs().filter(kqLabNum);
  var others = kqShuffle(nums.filter(function(o){ return o.unit === x.unit && o.i !== x.i; }))
    .concat(kqShuffle(nums.filter(function(o){ return o.cat === x.cat && o.i !== x.i; })))
    .concat(kqShuffle(nums));
  var opts = [x.i];
  others.forEach(function(o){ if(opts.length < 4 && !used[kqLabValue(o)]){ used[kqLabValue(o)] = 1; opts.push(o.i); } });
  kqState.labQuiz = { i:x.i, opts:kqShuffle(opts), picked:-1, n:prev.n, ok:prev.ok };
}
function kqLabQuizView(){
  var z = kqState.labQuiz, L = kqLabs(), x = L[z.i];
  if(!x) return '';
  var done = z.picked >= 0;
  return section('覚えるクイズ', z.n + '問中 ' + z.ok + '問 正解',
    '<div class="kq-q">「' + esc(kqLabLabel(x)) + '」の値（目安）は？</div><div class="s2">' + esc(x.cat) + '</div>' +
    '<div class="kq-choices">' + z.opts.map(function(i, k){
      var o = L[i], cls = done ? (i === z.i ? ' ok' : (i === z.picked ? ' ng' : '')) : '';
      return '<button class="kq-ch' + cls + '" data-act="kq-lab-ans" data-i="' + i + '"' + (done ? ' disabled' : '') + '><b>' + KQ_NUM[k] + '</b><span>' + esc(kqLabValue(o)) + '</span></button>';
    }).join('') + '</div>' +
    (done ? '<div class="msg ' + (z.picked === z.i ? 'ok' : 'ng') + '">' + (z.picked === z.i ? '⭕ 正解！' : '❌ 正解は ' + esc(kqLabValue(x))) + '</div>' +
      (x.note ? '<p class="s">' + esc(x.note) + '</p>' : '') + kqSrcHtml(KQ_SRC.lab) : '') +
    '<div class="pair" style="margin-top:8px">' + (done ? '<button class="btn" data-act="kq-lab-quiz">つぎの問題 ›</button>' : '') +
    '<button class="btn ghost" data-act="kq-lab-card" data-i="' + x.i + '" style="flex:0 0 auto">🃏 カード</button>' +
    '<button class="btn ghost" data-act="kq-lab-quiz-end" style="flex:0 0 auto">おわる</button></div>');
}

/* ============================== 薬のカード ============================== */
var kqDrugCache = null;
function kqDrugs(){
  if(kqDrugCache) return kqDrugCache;
  kqDrugCache = (typeof KQ_DRUGS !== 'undefined' ? KQ_DRUGS : []).map(function(s, i){
    var p = String(s).split('|');
    var o = { i:i, cat:p[0] || '', group:p[1] || '', names:p[2] || '', act:p[3] || '', side:p[4] || '', care:p[5] || '', hi:String(p[6] || '').trim() === '1' };
    o.hay = kqNorm(o.cat + o.group + o.names + o.act + o.side + o.care);
    return o;
  });
  return kqDrugCache;
}
function kqDrugCats(){ var seen = {}, out = []; kqDrugs().forEach(function(o){ if(!seen[o.cat]){ seen[o.cat] = 1; out.push(o.cat); } }); return out; }
function kqDrugFilter(){
  var nq = kqNorm(kqState.drugQ);
  return kqDrugs().filter(function(o){
    return (!kqState.drugCat || o.cat === kqState.drugCat) && (!kqState.drugHi || o.hi) && (!nq || o.hay.indexOf(nq) >= 0);
  });
}
function kqDrugCards(o){
  var head = o.group + '（' + o.names + '）';
  return [
    { q:head + '：はたらきと主な副作用は？', a:'はたらき：' + o.act + '\n副作用：' + o.side + '\n（出典：' + KQ_SRC.drug + '）' },
    { q:head + '：看護で気をつけることは？' + (o.hi ? '（ハイリスク薬）' : ''), a:o.care + '\n（出典：' + KQ_SRC.drug + '）' }
  ];
}
function kqDrugBody(o){
  return '<dl class="kq-dl"><dt>はたらき</dt><dd>' + esc(o.act) + '</dd><dt>主な副作用</dt><dd>' + esc(o.side) + '</dd>' +
    '<dt>看護で気をつけること</dt><dd>' + esc(o.care) + '</dd>' +
    '<dt>ハイリスク薬</dt><dd>' + (o.hi ? '<b class="kq-hi">はい</b>（まちがえると重い害が出やすい薬。ダブルチェックを）' : 'いいえ') + '</dd></dl>' +
    kqSrcHtml(KQ_SRC.drug);
}
function kqDrugResults(){
  var list = kqDrugFilter();
  if(!list.length) return '<div class="empty">見つかりませんでした。</div>';
  return list.map(function(o){
    var open = kqState.drugOpen === o.i;
    return '<div class="kq-drow' + (open ? ' on' : '') + '" data-act="kq-drug-open" data-i="' + o.i + '" role="button" tabindex="0">' +
      '<div class="kq-dhd"><b>' + esc(o.group) + '</b>' + (o.hi ? '<span class="b warn">ハイリスク</span>' : '') + '<span class="s2">' + esc(o.cat) + '</span></div>' +
      '<div class="s">' + esc(o.names) + '</div>' +
      (open ? '<div class="kq-dbody">' + kqDrugBody(o) + '<div class="pillrow"><button class="mini" data-act="kq-drug-card" data-i="' + o.i + '">🃏 暗記カードにする</button></div></div>' : '') +
      '</div>';
  }).join('');
}
function kqDrugView(){
  var h = kqWarn('薬の情報は<b>目安</b>です。くわしくは添付文書・教科書・薬剤部の資料で確かめてください。');
  var f = kqState.drugFlip;
  if(f) return h + kqDrugFlipView(f);
  var cats = kqDrugCats(), list = kqDrugFilter();
  h += '<section><div class="head"><h2>薬のカード</h2><span>' + kqDrugs().length + '枚</span></div><div class="box">' +
    '<input id="kq_gq" type="search" placeholder="例：ワルファリン・低カリウム・利尿" value="' + esc(kqState.drugQ) + '" autocomplete="off">' +
    '<div class="chips kq-chips">' + [''].concat(cats).map(function(c){
      return '<button data-act="kq-drug-cat" data-v="' + esc(c) + '" class="' + (kqState.drugCat === c ? 'on' : '') + '">' + esc(c || 'すべて') + '</button>';
    }).join('') + '<button data-act="kq-drug-hi" class="' + (kqState.drugHi ? 'on' : '') + '">⚠ ハイリスク薬だけ</button></div>' +
    '<button class="btn" data-act="kq-drug-flip"' + (list.length ? '' : ' disabled') + '>🔄 めくって覚える（<span id="kq_gn">' + list.length + '</span>枚）</button>' +
    '<div id="kq_gres" class="kq-dres">' + kqDrugResults() + '</div></div></section>';
  return h;
}
function kqDrugFlipView(f){
  var o = kqDrugs()[f.order[f.pos]];
  if(!o) return '<div class="empty">カードがありません。</div>';
  return '<section><div class="head"><h2>めくって覚える</h2><span>' + (f.pos + 1) + ' / ' + f.order.length + '</span></div>' +
    '<div class="box kq-fcard' + (f.show ? ' open' : '') + '">' +
      '<div class="s2">' + esc(o.cat) + (o.hi ? '　<span class="b warn">ハイリスク</span>' : '') + '</div>' +
      '<div class="kq-fg">' + esc(o.group) + '</div><div class="kq-fn">' + esc(o.names) + '</div>' +
      (f.show ? '<div class="kq-fback">' + kqDrugBody(o) + '</div>' : '<p class="note">はたらき・副作用・看護の注意を思いうかべてから、めくってね。</p><button class="btn" data-act="kq-drug-show">めくる</button>') +
    '</div></section>' +
    '<div class="pillrow"><button data-act="kq-drug-move" data-v="-1"' + (f.pos ? '' : ' disabled') + '>‹ まえ</button>' +
    '<button data-act="kq-drug-move" data-v="1"' + (f.pos + 1 < f.order.length ? '' : ' disabled') + '>つぎ ›</button>' +
    '<button data-act="kq-drug-shuf">まぜる</button><button data-act="kq-drug-card" data-i="' + o.i + '">🃏 暗記カードに</button>' +
    '<button data-act="kq-drug-flip-end">やめる</button></div>';
}

/* ============================== 解剖図の穴うめ ============================== */
function kqTextW(s, fs){ var w = 0; String(s).split('').forEach(function(ch){ w += ch.charCodeAt(0) < 0x2000 ? fs * 0.62 : fs; }); return w; }
var kqAnatCache = null;
function kqAnatBuiltin(){
  if(kqAnatCache) return kqAnatCache;
  kqAnatCache = (typeof KQ_ANAT !== 'undefined' ? KQ_ANAT : []).map(function(d){
    return { id:d.id, title:d.title, desc:d.desc || '', builtin:1, d:d, src:KQ_SRC.anat,
      holes:d.labels.map(function(l){
        var fs = l[3] || 13, w = kqTextW(l[2], fs) + 10, h = fs + 9;
        return { x:(l[0] - w / 2) / d.W, y:(l[1] - h / 2) / d.H, w:w / d.W, h:h / d.H, ans:l[2] };
      }) };
  });
  return kqAnatCache;
}
function kqAnatOwn(){
  return (Array.isArray(S.anatomy) ? S.anatomy : []).filter(function(x){ return x && x.id; }).map(function(x){
    return { id:x.id, title:x.title || '（名前なし）', img:x.img || '', holes:Array.isArray(x.holes) ? x.holes : [], src:x.src || ('写真：' + (x.title || '')), own:1 };
  });
}
function kqAnatAll(){ return kqAnatBuiltin().concat(kqAnatOwn()); }
function kqAnatGet(id){ return kqAnatAll().filter(function(a){ return a.id === id; })[0] || null; }
var KQ_SVG_DEFS = '<defs><marker id="kqArw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="kq-sv-arw"/></marker></defs>';
function kqAnatSvg(d){
  var s = '<svg class="kq-svg" viewBox="0 0 ' + d.W + ' ' + d.H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(d.title) + '">' + KQ_SVG_DEFS + d.draw;
  (d.texts || []).forEach(function(t){
    s += '<text x="' + t[0] + '" y="' + t[1] + '" font-size="' + (t[3] || 11) + '" text-anchor="' + (t[4] || 'middle') + '" dominant-baseline="central" class="kq-sv-note">' + esc(t[2]) + '</text>';
  });
  d.labels.forEach(function(l){
    s += '<text x="' + l[0] + '" y="' + l[1] + '" font-size="' + (l[3] || 13) + '" text-anchor="middle" dominant-baseline="central" class="kq-sv-lbl">' + esc(l[2]) + '</text>';
  });
  return s + '</svg>';
}
function kqAnatPic(a){
  if(a.builtin) return kqAnatSvg(a.d);
  return '<img data-pid="' + esc(a.img) + '" alt="' + esc(a.title) + '" draggable="false">';
}
function kqHoleStyle(h){
  var p = function(v){ return (Math.round(Number(v) * 10000) / 100) + '%'; };
  return 'left:' + p(h.x) + ';top:' + p(h.y) + ';width:' + p(h.w) + ';height:' + p(h.h);
}
function kqAnatScore(){ var v = (S.kmData || {})['kokushi:anat']; return (v && typeof v === 'object') ? v : {}; }
function kqAnatView(){
  if(kqState.anatEdit) return kqAnatEditView(kqState.anatEdit);
  if(kqState.anat){ var cur = kqAnatGet(kqState.anat.id); if(cur) return kqAnatQuizView(cur, kqState.anat); }
  var sc = kqAnatScore(), own = kqAnatOwn();
  var row = function(a){
    var r = sc[a.id];
    return '<div class="row"><div class="grow"><div class="t">' + esc(a.title) + '</div>' +
      '<div class="s">穴 ' + a.holes.length + 'こ' + (r ? '・前回 ' + toNum(r.ok) + '/' + toNum(r.n) + ' 正解' : '') + (a.desc ? '・' + esc(a.desc) : '') + '</div>' +
      '<div class="s2">出典：' + esc(a.src) + '</div></div>' +
      '<button class="mini" data-act="kq-anat-open" data-id="' + esc(a.id) + '"' + (a.holes.length ? '' : ' disabled') + '>クイズ</button>' +
      (a.own ? '<button class="mini" data-act="kq-anat-edit" data-id="' + esc(a.id) + '">直す</button><button class="mini" data-act="kq-anat-del" data-id="' + esc(a.id) + '">消す</button>' : '') + '</div>';
  };
  return section('はじめから入っている図', null, kqAnatBuiltin().map(row).join('')) +
    section('自分の図', own.length + '枚',
      (own.length ? own.map(row).join('') : '<div class="empty">教科書やプリントの解剖図の写真から、自分の穴うめクイズを作れます。</div>') +
      '<button class="btn" data-act="kq-anat-new">📷 写真から新しく作る</button>' +
      '<p class="note">写真をえらぶ → 名前をかくしたい所を指でタップ（またはななめにドラッグ）→ 答えを入れる、で作れます。AIにラベルの場所をさがしてもらうこともできます。</p>');
}
function kqAnatQuizView(a, z){
  var h = '<div class="pillrow"><button data-act="kq-anat-close">‹ 図の一覧</button>' +
    '<button data-act="kq-anat-mode" data-v="flip" class="' + (z.mode === 'flip' ? 'on' : '') + '">👆 めくる</button>' +
    '<button data-act="kq-anat-mode" data-v="guess" class="' + (z.mode === 'guess' ? 'on' : '') + '"' + (kqAnatAnswers(a).length >= 2 ? '' : ' disabled') + '>🎯 名前を当てる</button></div>';
  var cur = z.mode === 'guess' && !z.end ? z.order[z.pos] : -1;
  var box = '<div class="kq-anatbox">' + kqAnatPic(a) + a.holes.map(function(hl, i){
    var open = !!z.open[i];
    var cls = 'kq-hole' + (open ? ' open' : '') + (i === cur ? ' cur' : '');
    var act = z.mode === 'flip' ? ' data-act="kq-anat-flip" data-i="' + i + '" role="button"' : '';
    return '<div class="' + cls + '" style="' + kqHoleStyle(hl) + '"' + act + '>' + (open ? (a.builtin ? '' : '<span class="kq-htag">' + esc(hl.ans) + '</span>') : '<span>' + (i === cur ? '？' : (i + 1)) + '</span>') + '</div>';
  }).join('') + '</div>';
  h += '<section><div class="head"><h2>' + esc(a.title) + '</h2><span>' + (z.mode === 'guess' ? (z.end ? 'おわり' : (z.pos + 1) + ' / ' + z.order.length) + '　正解 ' + z.ok : '穴 ' + a.holes.length + 'こ') + '</span></div><div class="box">' + box;
  if(z.mode === 'flip'){
    h += '<p class="note">穴をタップするとめくれます。</p><div class="pillrow"><button class="mini" data-act="kq-anat-all" data-v="1">ぜんぶめくる</button><button class="mini" data-act="kq-anat-all" data-v="0">ぜんぶかくす</button></div>' +
      '<ol class="kq-anslist">' + a.holes.map(function(hl, i){ return '<li>' + (z.open[i] ? esc(hl.ans) : '<span class="s2">（かくれています）</span>') + '</li>'; }).join('') + '</ol>';
  }else if(z.end){
    h += '<div class="kq-end"><div class="kq-big">' + (z.ok === z.order.length ? '🎉' : '🫀') + '</div><p><b>' + z.order.length + 'こ中 ' + z.ok + 'こ 正解</b></p></div>' +
      '<div class="pair"><button class="btn" data-act="kq-anat-mode" data-v="guess">もう一度</button><button class="btn ghost" data-act="kq-anat-close">図の一覧</button></div>';
  }else{
    var hl = a.holes[cur];
    h += '<div class="kq-q">「？」の場所の名前は？</div><div class="kq-choices">' + z.opts.map(function(ans, k){
      var cls = z.picked != null ? (ans === hl.ans ? ' ok' : (ans === z.picked ? ' ng' : '')) : '';
      return '<button class="kq-ch' + cls + '" data-act="kq-anat-ans" data-k="' + k + '"' + (z.picked != null ? ' disabled' : '') + '><b>' + KQ_NUM[k] + '</b><span>' + esc(ans) + '</span></button>';
    }).join('') + '</div>' +
      (z.picked != null ? '<div class="msg ' + (z.picked === hl.ans ? 'ok' : 'ng') + '">' + (z.picked === hl.ans ? '⭕ 正解！' : '❌ 正解は「' + esc(hl.ans) + '」') + '</div>' +
        '<button class="btn" data-act="kq-anat-next">' + (z.pos + 1 >= z.order.length ? '結果を見る' : 'つぎ ›') + '</button>' : '');
  }
  h += kqSrcHtml(a.src) + '</div></section>';
  return h;
}
function kqAnatAnswers(a){ var seen = {}, out = []; a.holes.forEach(function(h){ var s = String(h.ans || '').trim(); if(s && !seen[s]){ seen[s] = 1; out.push(s); } }); return out; }
function kqAnatStart(id, mode){
  var a = kqAnatGet(id); if(!a) return;
  var z = { id:id, mode:mode || 'flip', open:{}, order:[], pos:0, ok:0, picked:null, opts:[], end:false };
  if(z.mode === 'guess'){
    z.order = kqShuffle(a.holes.map(function(h, i){ return i; }).filter(function(i){ return String(a.holes[i].ans || '').trim(); }));
    kqAnatOpts(a, z);
  }
  kqState.anat = z;
}
function kqAnatOpts(a, z){
  var hl = a.holes[z.order[z.pos]]; if(!hl) return;
  var others = kqShuffle(kqAnatAnswers(a).filter(function(s){ return s !== hl.ans; })).slice(0, 3);
  z.opts = kqShuffle([hl.ans].concat(others)); z.picked = null;
}
function kqAnatSaveScore(id, n, ok){
  S.kmData = (S.kmData && typeof S.kmData === 'object') ? S.kmData : {};
  var v = Object.assign({}, kqAnatScore());
  v[id] = { n:n, ok:ok, at:today() };
  var keys = Object.keys(v);
  if(keys.length > 60) keys.sort(function(a, b){ return String(v[a].at).localeCompare(String(v[b].at)); }).slice(0, keys.length - 60).forEach(function(k){ delete v[k]; });
  S.kmData['kokushi:anat'] = v;
  touch('kmData');
}
/* ----- 自分の図を作る・直す ----- */
async function kqAnatCreate(dataUrl, title){
  var pid = uid('an');
  await photoPut(pid, dataUrl);
  kqState.anat = null; kqClearIn('kq_an');
  kqState.anatEdit = { id:uid('an'), isNew:1, title:String(title || '解剖図').slice(0, 60), img:pid, holes:[], sel:-1 };
  kqRender(); kqGoTop();
  return kqState.anatEdit;
}
function kqAnatEditView(e){
  return '<section><div class="head"><h2>' + (e.isNew ? '新しい図' : '図を直す') + '</h2><span>穴 ' + e.holes.length + 'こ</span></div><div class="box">' +
    '<div class="field"><label class="f" for="kq_antitle">図の名前（出典になります）</label><input id="kq_antitle" value="' + esc(e.title) + '" placeholder="例：心臓の構造（解剖生理学の教科書 p.80）"></div>' +
    '<p class="note">名前をかくしたい所を<b>指でタップ</b>（または<b>ななめにドラッグ</b>）すると穴ができます。穴はドラッグで動かせて、右下の角で大きさを変えられます。</p>' +
    '<div class="kq-anatbox kq-anatedit"><img data-pid="' + esc(e.img) + '" alt="' + esc(e.title) + '" draggable="false">' +
    e.holes.map(function(hl, i){
      return '<div class="kq-hole edit' + (e.sel === i ? ' sel' : '') + '" data-kqhole="' + i + '" style="' + kqHoleStyle(hl) + '"><span>' + (i + 1) + '</span><i class="kq-hrs" data-kqrs="' + i + '"></i></div>';
    }).join('') + '<div class="kq-draw" hidden></div></div>' +
    '<div class="pillrow" style="margin-top:8px"><button data-act="kq-anat-ai"' + (kqState.busy ? ' disabled' : '') + '>' + (kqState.busy === 'anat' ? 'AIがさがしています…' : '🤖 AIでラベルの場所をさがして穴を作る') + '</button></div>' +
    '<p class="note">' + KQ_PRIVACY + '</p>' +
    (e.holes.length ? '<label class="f">穴の答え</label>' + e.holes.map(function(hl, i){
      return '<div class="kq-chrow' + (e.sel === i ? ' sel' : '') + '"><span>' + (i + 1) + '</span><input id="kq_anh' + i + '" data-kqh="' + i + '" value="' + esc(hl.ans || '') + '" placeholder="名前（例：右心房）">' +
        '<button class="mini" data-act="kq-anat-hdel" data-i="' + i + '">消す</button></div>';
    }).join('') : '<div class="empty">まだ穴がありません。</div>') +
    '<div class="pair" style="margin-top:10px"><button class="btn" data-act="kq-anat-save">保存する</button><button class="btn ghost" data-act="kq-anat-cancel" style="flex:0 0 auto">やめる</button></div>' +
    '</div></section>';
}
function kqClamp01(v){ v = Number(v); return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; }
function kqHoleFix(h){
  var w = Math.max(0.02, Math.min(1, Number(h.w) || 0.15)), hh = Math.max(0.015, Math.min(1, Number(h.h) || 0.05));
  var x = Math.min(kqClamp01(h.x), 1 - w), y = Math.min(kqClamp01(h.y), 1 - hh);
  var r = function(v){ return Math.round(v * 10000) / 10000; };
  return { x:r(x), y:r(y), w:r(w), h:r(hh), ans:String(h.ans || '').trim().slice(0, 60) };
}
function kqAnatReadInputs(){
  var e = kqState.anatEdit; if(!e) return;
  e.holes.forEach(function(hl, i){ var el = document.getElementById('kq_anh' + i); if(el) hl.ans = el.value; });
  var t = document.getElementById('kq_antitle'); if(t) e.title = t.value;
}
async function kqAnatAi(){
  var e = kqState.anatEdit; if(!e || kqState.busy) return null;
  kqAnatReadInputs();
  kqState.busy = 'anat'; kqRender();
  try{
    var data = await photoGet(e.img);
    if(!data) throw new Error('写真が見つかりません');
    var prompt = 'これは解剖図（教科書やプリントの図）の写真です。図の中の「部位の名前のラベル（文字）」をすべて見つけて、その文字がある場所を教えてください。\n' +
      '・box_2d は [ymin, xmin, ymax, xmax] で、画像の縦横をそれぞれ 0〜1000 としたときの値。線や絵ではなく、ラベルの文字だけをかこむ。\n' +
      '・name はラベルの文字（読みとれたとおり）。\n・多くても30こ。\n' +
      'JSONだけで答える：{"labels":[{"name":"右心房","box_2d":[100,200,130,300]}]}';
    var j = await kqAi('kq-anat', [data], prompt, 4096);
    var list = Array.isArray(j.labels) ? j.labels : (Array.isArray(j) ? j : []);
    var add = [];
    list.slice(0, 40).forEach(function(l){
      if(!l) return;
      var b = l.box_2d || l.box, name = String(l.name || l.label || '').trim();
      if(!name || !Array.isArray(b) || b.length < 4) return;
      var v = b.map(Number);
      if(v.some(function(n){ return !isFinite(n); })) return;
      var y0 = Math.min(v[0], v[2]) / 1000, x0 = Math.min(v[1], v[3]) / 1000, y1 = Math.max(v[0], v[2]) / 1000, x1 = Math.max(v[1], v[3]) / 1000;
      if(x1 - x0 <= 0 || y1 - y0 <= 0) return;
      /* 少し大きめにかこむ（文字のはしが見えないように） */
      var px = 0.008, py = 0.006;
      add.push(kqHoleFix({ x:x0 - px, y:y0 - py, w:x1 - x0 + px * 2, h:y1 - y0 + py * 2, ans:name }));
    });
    if(!add.length) throw new Error('ラベルが見つかりませんでした');
    e.holes = e.holes.concat(add);
    toast(add.length + 'この穴を作りました。場所と答えを確かめてください');
  }catch(err){
    toast('穴を作れませんでした：' + err.message, true);
  }finally{
    kqState.busy = ''; kqRender();
  }
  return kqState.anatEdit;
}
function kqAnatSave(){
  var e = kqState.anatEdit; if(!e) return false;
  kqAnatReadInputs();
  var holes = e.holes.map(kqHoleFix);
  if(!holes.length){ toast('穴を1つ以上作ってください', true); return false; }
  var blank = holes.filter(function(h){ return !h.ans; }).length;
  if(blank){ toast('答えが入っていない穴があります（' + blank + 'こ）', true); return false; }
  S.anatomy = Array.isArray(S.anatomy) ? S.anatomy : [];
  var title = String(e.title || '').trim() || '解剖図';
  var cur = S.anatomy.filter(function(x){ return x.id === e.id; })[0];
  if(cur){ cur.title = title; cur.holes = holes; cur.src = '写真：' + title; cur.mt = Date.now(); }
  else S.anatomy.push({ id:e.id, mt:Date.now(), title:title, img:e.img, holes:holes, src:'写真：' + title });
  kqState.anatEdit = null; kqClearIn('kq_an');
  commit(); toast('図を保存しました');
  return true;
}
/* 指・マウスで穴を作る・動かす・大きさを変える */
var kqDrag = null;
function kqBoxPoint(box, ev){
  var r = box.getBoundingClientRect();
  return { x:(ev.clientX - r.left) / (r.width || 1), y:(ev.clientY - r.top) / (r.height || 1) };
}
document.addEventListener('pointerdown', function(ev){
  var box = ev.target && ev.target.closest ? ev.target.closest('.kq-anatedit') : null;
  if(!box || !kqState.anatEdit) return;
  kqAnatReadInputs();
  var p = kqBoxPoint(box, ev), rs = ev.target.closest('[data-kqrs]'), hole = ev.target.closest('[data-kqhole]');
  kqDrag = { box:box, x0:p.x, y0:p.y, px0:ev.clientX, py0:ev.clientY, moved:false, id:ev.pointerId };
  if(rs){ kqDrag.mode = 'size'; kqDrag.i = toNum(rs.dataset.kqrs); }
  else if(hole){ kqDrag.mode = 'move'; kqDrag.i = toNum(hole.dataset.kqhole); }
  else kqDrag.mode = 'new';
  if(kqDrag.i != null) kqDrag.h0 = Object.assign({}, kqState.anatEdit.holes[kqDrag.i]);
  try{ ev.preventDefault(); }catch(e){}
});
document.addEventListener('pointermove', function(ev){
  if(!kqDrag || !kqState.anatEdit || ev.pointerId !== kqDrag.id) return;
  if(Math.abs(ev.clientX - kqDrag.px0) + Math.abs(ev.clientY - kqDrag.py0) > 6) kqDrag.moved = true;
  if(!kqDrag.moved) return;
  var p = kqBoxPoint(kqDrag.box, ev), dx = p.x - kqDrag.x0, dy = p.y - kqDrag.y0;
  if(kqDrag.mode === 'new'){
    var dr = kqDrag.box.querySelector('.kq-draw');
    if(dr){
      dr.hidden = false;
      dr.setAttribute('style', kqHoleStyle({ x:Math.min(p.x, kqDrag.x0), y:Math.min(p.y, kqDrag.y0), w:Math.abs(dx), h:Math.abs(dy) }));
    }
  }else if(kqDrag.h0){
    var h0 = kqDrag.h0, nh = kqDrag.mode === 'move' ? { x:h0.x + dx, y:h0.y + dy, w:h0.w, h:h0.h } : { x:h0.x, y:h0.y, w:h0.w + dx, h:h0.h + dy };
    var el = kqDrag.box.querySelector('[data-kqhole="' + kqDrag.i + '"]');
    if(el) el.setAttribute('style', kqHoleStyle(kqHoleFix(nh)));
  }
});
document.addEventListener('pointerup', function(ev){
  if(!kqDrag || ev.pointerId !== kqDrag.id) return;
  var g = kqDrag; kqDrag = null;
  var e = kqState.anatEdit; if(!e) return;
  var p = kqBoxPoint(g.box, ev), dx = p.x - g.x0, dy = p.y - g.y0;
  if(g.mode === 'new'){
    var nh;
    if(g.moved && Math.abs(dx) > 0.02 && Math.abs(dy) > 0.012) nh = { x:Math.min(p.x, g.x0), y:Math.min(p.y, g.y0), w:Math.abs(dx), h:Math.abs(dy), ans:'' };
    else nh = { x:g.x0 - 0.1, y:g.y0 - 0.03, w:0.2, h:0.06, ans:'' };
    e.holes.push(kqHoleFix(nh)); e.sel = e.holes.length - 1;
  }else if(g.moved && g.h0){
    var h0 = g.h0;
    var moved = g.mode === 'move' ? { x:h0.x + dx, y:h0.y + dy, w:h0.w, h:h0.h, ans:h0.ans } : { x:h0.x, y:h0.y, w:h0.w + dx, h:h0.h + dy, ans:h0.ans };
    e.holes[g.i] = kqHoleFix(moved); e.sel = g.i;
  }else e.sel = g.i;
  render();
  var inp = document.getElementById('kq_anh' + e.sel);
  if(inp && g.mode !== 'size'){ try{ inp.focus({ preventScroll:true }); }catch(err){ try{ inp.focus(); }catch(e2){} } }
});
document.addEventListener('pointercancel', function(){ kqDrag = null; });

/* ============================== 看護技術の手順 ============================== */
var kqSkillCache = null;
function kqSkillsBuiltin(){
  if(kqSkillCache) return kqSkillCache;
  kqSkillCache = (typeof KQ_SKILLS !== 'undefined' ? KQ_SKILLS : []).map(function(s){
    return { id:s.id, name:s.name, cat:s.cat || '', goal:s.goal || '', src:KQ_SRC.skill,
      steps:(s.steps || []).map(function(st){ return { s:st[0], w:st[1] || '' }; }) };
  });
  return kqSkillCache;
}
function kqSkillsOwn(){
  return (S.kmItems || []).filter(function(x){ return x && x.mod === 'kokushi' && x.type === 'myskill' && Array.isArray(x.steps); }).map(function(x){
    return { id:x.id, name:x.name || '自分の手順', cat:'自分の手順', goal:'', src:x.src || KQ_SRC.hand, own:1,
      steps:x.steps.map(function(st){ return { s:String(st && st.s || ''), w:String(st && st.w || '') }; }).filter(function(st){ return st.s; }) };
  });
}
function kqSkillsAll(){ return kqSkillsOwn().concat(kqSkillsBuiltin()); }
function kqSkillGet(id){ return kqSkillsAll().filter(function(s){ return s.id === id; })[0] || null; }
function kqSkillLogs(id){
  return (S.kmItems || []).filter(function(x){ return x && x.mod === 'kokushi' && x.type === 'skill' && (!id || x.skill === id); })
    .sort(function(a, b){ return toNum(b.mt) - toNum(a.mt); });
}
function kqSkillView(){
  var sk = kqState.skill ? kqSkillGet(kqState.skill) : null;
  if(sk) return kqSkillDetailView(sk);
  var h = kqWarn('<b>学校で習った手順を優先してください。</b>ここの手順は、教科書でよく見る一般的な例です。');
  if(kqState.skillPv) h += kqSkillPvView(kqState.skillPv);
  var all = kqSkillsAll(), cats = [], seen = {};
  all.forEach(function(s){ if(!seen[s.cat]){ seen[s.cat] = 1; cats.push(s.cat); } });
  var logs = kqSkillLogs('');
  h += section('看護技術の手順', all.length + '技術', cats.map(function(c){
    return '<div class="kq-lcat"><b>' + esc(c) + '</b></div>' + all.filter(function(s){ return s.cat === c; }).map(function(s){
      var last = logs.filter(function(x){ return x.skill === s.id; })[0];
      return '<div class="row kq-srow" data-act="kq-skill-open" data-id="' + esc(s.id) + '" role="button" tabindex="0"><div class="grow"><div class="t">' + esc(s.name) + '</div>' +
        '<div class="s">' + s.steps.length + '手順' + (s.goal ? '・目安 ' + esc(s.goal) : '') + (last ? '・前回 ' + esc(ymdLabel(last.date)) + ' ' + kqMmss(last.sec) + '（' + last.done + '/' + last.total + '）' : '') + '</div></div>' +
        (s.own ? '<button class="mini" data-act="kq-skill-del" data-id="' + esc(s.id) + '">消す</button>' : '') + '<span class="chev">›</span></div>';
    }).join('');
  }).join(''));
  var add = kqState.skillAdd;
  h += section('自分の手順を作る', null,
    '<p class="note">学校のプリント・手順書の写真から、AIが手順を取り出します（見て選んでから追加）。</p>' +
    '<div class="field"><label class="f" for="kq_spn">写真の名前（出典になります）</label><input id="kq_spn" placeholder="例：基礎看護技術Ⅰ 手順書 p.5" value="' + esc(kqIn('kq_spn')) + '"></div>' +
    '<button class="btn ghost" data-act="kq-skill-photo"' + (kqState.busy ? ' disabled' : '') + '>' + (kqState.busy === 'skill' ? 'AIが読んでいます…' : '📷 手順書の写真をえらぶ') + '</button>' +
    '<p class="note">' + KQ_PRIVACY + '</p>' +
    (add ? '<div class="field"><label class="f" for="kq_smn">技術の名前</label><input id="kq_smn" placeholder="例：輸液ポンプの準備" value="' + esc(kqIn('kq_smn')) + '"></div>' +
      '<div class="field"><label class="f" for="kq_sms">手順（1行に1つ。根拠は「｜」のあとに）</label><textarea id="kq_sms" rows="5" placeholder="手指衛生をする｜感染を防ぐため&#10;患者さんに説明して同意を得る｜安心して協力してもらうため">' + esc(kqIn('kq_sms')) + '</textarea></div>' +
      '<div class="pair"><button class="btn" data-act="kq-skill-hand">この手順を追加</button><button class="btn ghost" data-act="kq-skill-handopen" style="flex:0 0 auto">閉じる</button></div>'
      : '<button class="btn ghost" data-act="kq-skill-handopen">✏️ 自分で書く</button>'));
  return h;
}
function kqSkillDetailView(s){
  var run = kqState.skillRun && kqState.skillRun.id === s.id ? kqState.skillRun : null;
  var chk = kqState.skillChk, why = kqState.skillWhy;
  var h = '<div class="pillrow"><button data-act="kq-skill-back">‹ 技術の一覧</button></div>';
  h += kqWarn('<b>学校で習った手順を優先してください。</b>' + (s.own ? '' : 'ここの手順は一般的な例です。'));
  var nChk = s.steps.filter(function(st, i){ return chk[i]; }).length;
  h += '<section><div class="head"><h2>' + esc(s.name) + '</h2><span>' + esc(s.cat) + '・' + s.steps.length + '手順' + (s.goal ? '・目安 ' + esc(s.goal) : '') + '</span></div><div class="box">' +
    (run ? '<div class="kq-timer"><span class="kq-tnum num" id="kq_timer">' + kqMmss((Date.now() - run.start) / 1000) + '</span><span class="s">練習中・できた手順にチェック</span></div>'
         : '<button class="btn" data-act="kq-skill-run">⏱ 練習をはじめる（時間を計る）</button>') +
    '<ol class="kq-steps">' + s.steps.map(function(st, i){
      return '<li class="kq-step' + (chk[i] ? ' on' : '') + (why[i] ? ' why' : '') + '"><div class="kq-stepm">' +
        '<label><input type="checkbox" data-act="kq-skill-chk" data-i="' + i + '"' + (chk[i] ? ' checked' : '') + '><span>' + esc(st.s) + '</span></label>' +
        (st.w ? '<button class="mini" data-act="kq-skill-why" data-i="' + i + '">なぜ？</button>' : '') + '</div>' +
        (st.w ? '<div class="kq-why">根拠：' + esc(st.w) + '</div>' : '') + '</li>';
    }).join('') + '</ol>' +
    '<div class="pillrow"><button class="mini" data-act="kq-skill-whyall">根拠をぜんぶ開く／とじる</button><button class="mini" data-act="kq-skill-clear">チェックを外す</button></div>' +
    (run ? '<div class="pair" style="margin-top:8px"><button class="btn" data-act="kq-skill-done">おわり（記録する・<span id="kq_skn">' + nChk + '</span>/' + s.steps.length + '）</button>' +
      '<button class="btn ghost" data-act="kq-skill-stop" style="flex:0 0 auto">やめる</button></div>' : '') +
    kqSrcHtml(s.src) + '</div></section>';
  var logs = kqSkillLogs(s.id);
  if(logs.length){
    var missN = {};
    logs.forEach(function(x){ (x.missText || []).forEach(function(t){ missN[t] = (missN[t] || 0) + 1; }); });
    var tops = Object.keys(missN).sort(function(a, b){ return missN[b] - missN[a]; }).slice(0, 3);
    var best = logs.filter(function(x){ return x.done === x.total; }).map(function(x){ return toNum(x.sec); }).sort(function(a, b){ return a - b; })[0];
    h += section('練習の記録', logs.length + '回' + (best ? '・ぜんぶできた最速 ' + kqMmss(best) : ''),
      (tops.length ? '<div class="kq-miss"><b>よく抜ける手順</b>' + tops.map(function(t){ return '<div>・' + esc(t) + '（' + missN[t] + '回）</div>'; }).join('') + '</div>' : '') +
      logs.slice(0, 6).map(function(x){
        return '<div class="row' + (x.id === kqState.skillLast ? ' kq-new' : '') + '"><div class="grow"><div class="t">' + esc(ymdLabel(x.date)) + '　' + kqMmss(x.sec) + '</div>' +
          '<div class="s">できた ' + x.done + '/' + x.total + (x.missText && x.missText.length ? '・できなかった：' + esc(x.missText.join('／')) : '・ぜんぶできた！') + '</div></div></div>';
      }).join(''));
  }
  return h;
}
function kqSkillPvView(pv){
  var on = pv.steps.filter(function(x){ return x.on; }).length;
  return section('写真から読みとった手順（見てから追加）', on + '手順',
    kqWarn('AIの読みとりはまちがえることがあります。手順書と見くらべてから追加してください。') +
    '<div class="field"><label class="f" for="kq_spt">技術の名前</label><input id="kq_spt" value="' + esc(kqIn('kq_spt', pv.name)) + '"></div>' +
    pv.steps.map(function(st, i){
      return '<label class="row kq-pvs' + (st.on ? '' : ' off') + '"><input type="checkbox" data-act="kq-spv-toggle" data-i="' + i + '"' + (st.on ? ' checked' : '') + '>' +
        '<div class="grow"><div class="t">' + (i + 1) + '. ' + esc(st.s) + '</div>' + (st.w ? '<div class="s">根拠：' + esc(st.w) + (st.ai ? '（AIが補足）' : '') + '</div>' : '') + '</div></label>';
    }).join('') + kqSrcHtml(pv.src) +
    '<div class="pair" style="margin-top:8px"><button class="btn" data-act="kq-spv-add">チェックしたものを追加</button>' +
    '<button class="btn ghost" data-act="kq-spv-cancel" style="flex:0 0 auto">やめる</button></div>');
}
var kqTimer = null;
function kqTimerStart(){
  clearInterval(kqTimer);
  kqTimer = setInterval(function(){
    if(!kqState.skillRun){ clearInterval(kqTimer); kqTimer = null; return; }
    var el = document.getElementById('kq_timer');
    if(el) el.textContent = kqMmss((Date.now() - kqState.skillRun.start) / 1000);
  }, 1000);
}
function kqSkillRecord(){
  var run = kqState.skillRun, s = run ? kqSkillGet(run.id) : null;
  if(!s) return null;
  var miss = [], missText = [];
  s.steps.forEach(function(st, i){ if(!kqState.skillChk[i]){ miss.push(i); missText.push(st.s.slice(0, 40)); } });
  var it = { id:uid('km'), mt:Date.now(), mod:'kokushi', type:'skill', skill:s.id, name:s.name, date:today(),
             sec:Math.round((Date.now() - run.start) / 1000), done:s.steps.length - miss.length, total:s.steps.length, miss:miss, missText:missText.slice(0, 12) };
  S.kmItems = Array.isArray(S.kmItems) ? S.kmItems : [];
  S.kmItems.push(it);
  kqState.skillRun = null; kqState.skillChk = {}; kqState.skillLast = it.id;
  clearInterval(kqTimer); kqTimer = null;
  commit();
  toast('練習を記録しました（' + kqMmss(it.sec) + '・' + it.done + '/' + it.total + '）');
  return it;
}
async function kqSkillPhotoRead(urls, name){
  if(kqState.busy) return null;
  name = String(name || '').trim() || '手順書の写真';
  kqState.busy = 'skill'; kqState.skillPv = null; kqRender();
  try{
    var prompt = 'これは看護技術の手順書（学校のプリントや教科書）の写真です。手順を順番に取り出してください。\n' +
      '・写真に書いてある手順を、書いてある順に。1つの手順は短く1文で。\n' +
      '・根拠（なぜそうするか）が写真にあれば why に入れ、whyFrom を "photo" にする。なければ一般的な根拠を短く書き、whyFrom を "ai" にする。\n' +
      '・技術の名前を name に。患者さんの名前など、個人がわかる情報は入れない。多くても30手順。\n' +
      'JSONだけで答える：{"name":"技術の名前","steps":[{"step":"手順","why":"根拠","whyFrom":"photo"}]}';
    var j = await kqAi('kq-skill', urls, prompt, 6144);
    var steps = (Array.isArray(j.steps) ? j.steps : []).map(function(x){
      x = x || {};
      return { s:String(x.step || x.s || '').trim().slice(0, 120), w:String(x.why || x.w || '').trim().slice(0, 200), ai:x.whyFrom === 'ai' ? 1 : 0, on:1 };
    }).filter(function(x){ return x.s; }).slice(0, 40);
    if(!steps.length) throw new Error('手順が見つかりませんでした');
    kqState.skillPv = { name:String(j.name || '').trim().slice(0, 60) || name, src:'写真：' + name, steps:steps };
    delete kqState.inp.kq_spt;
    toast(steps.length + 'この手順を読みとりました。見てから追加してください');
  }catch(e){
    toast('読みとれませんでした：' + e.message, true);
  }finally{
    kqState.busy = ''; kqRender();
  }
  return kqState.skillPv;
}
function kqMySkillAdd(name, steps, src){
  steps = (steps || []).filter(function(st){ return st && st.s; }).map(function(st){
    return { s:String(st.s).slice(0, 120), w:String(st.w || '').slice(0, 200) + (st.ai && st.w ? '（AIが補足）' : '') };
  });
  if(!steps.length) return null;
  S.kmItems = Array.isArray(S.kmItems) ? S.kmItems : [];
  var it = { id:uid('km'), mt:Date.now(), mod:'kokushi', type:'myskill', name:String(name || '自分の手順').slice(0, 60), steps:steps, src:String(src || KQ_SRC.hand).slice(0, 120) };
  S.kmItems.push(it);
  return it;
}

/* ============================== 操作 ============================== */
function kqAction(act, t){
  if(act.indexOf('kq-') !== 0) return false;
  var d = kqState.drill, id = t.dataset.id, i = toNum(t.dataset.i);
  switch(act){
    /* ----- どこからでも（今日タブ・全体検索から） ----- */
    case 'kq-go':
      appId = 'study'; studyTool = t.dataset.tool || 'kq-drill';
      if(t.dataset.q != null){
        if(studyTool === 'kq-dict'){ kqState.dictQ = t.dataset.q; kqState.dictOpen = t.dataset.k || ''; }
        if(studyTool === 'kq-lab'){ kqState.labQ = t.dataset.q; kqState.labCat = ''; }
        if(studyTool === 'kq-drug'){ kqState.drugQ = t.dataset.q; kqState.drugCat = ''; kqState.drugHi = false; kqState.drugFlip = null; }
      }
      if(studyTool === 'kq-skill') kqState.skill = t.dataset.id || '';
      if(studyTool === 'kq-anat' && t.dataset.id){ kqState.anatEdit = null; kqAnatStart(t.dataset.id, 'flip'); }
      if(studyTool === 'kq-drill' && t.dataset.id){ kqStart('rand', [t.dataset.id]); return true; }
      render(); kqGoTop(); return true;
    /* ----- 国試ドリル ----- */
    case 'kq-field': kqState.field = t.dataset.v || ''; render(); return true;
    case 'kq-n': kqState.n = toNum(t.dataset.v) || 10; render(); return true;
    case 'kq-start': kqStart(t.dataset.v || 'rand'); return true;
    case 'kq-one': kqStart('rand', [id]); return true;
    case 'kq-retry': kqStart('miss', d ? d.wrong.slice() : []); return true;
    case 'kq-pick':
      if(!d || d.judged) return true;
      var q = kqQ(d.queue[d.pos]); if(!q) return true;
      if(q.a.length > 1){
        var at = d.picked.indexOf(i);
        if(at >= 0) d.picked.splice(at, 1); else d.picked.push(i);
        render();
      }else{ d.picked = [i]; kqJudge(); }
      return true;
    case 'kq-judge': kqJudge(); return true;
    case 'kq-next': kqNext(); return true;
    case 'kq-quit': kqState.drill = null; kqPushNow(); kqGoTop(); return true;
    case 'kq-card':
      var cq = kqQ(id); if(cq) kqToAnki('国試・' + kqFieldName(cq.f), [kqQToCard(cq)]);
      return true;
    case 'kq-aiexp': kqAiExplain(id); return true;
    case 'kq-today':
      var tq = kqQ(t.dataset.id); if(!tq) return true;
      var tl = kqLogOf(tq.id);
      if(tl && tl.last === today()) return true;
      kqLogAnswer(tq.id, kqSame([i], tq.a));
      commit(); return true;
    case 'kq-add-open': kqState.add = kqState.add === t.dataset.v ? '' : (t.dataset.v || ''); render(); return true;
    case 'kq-add-save': kqHandAdd(); return true;
    case 'kq-photo':
      var pname = String(kqV('kq_pn') || '').trim();
      kqPickFiles(true, async function(files){
        try{ var urls = await kqReadPhotos(files, 1800, 0.82); await kqPhotoRead(urls, pname || files[0].name.replace(/\.[a-z0-9]+$/i, '')); }
        catch(e){ toast('写真を読めませんでした：' + e.message, true); }
      });
      return true;
    case 'kq-make': kqMakeAi(kqV('kq_mf'), kqV('kq_mn'), kqV('kq_mt')); return true;
    case 'kq-pv-toggle':
      if(kqState.preview && kqState.preview.items[i]) kqState.preview.items[i].on = t.checked ? 1 : 0;
      render(); return true;
    case 'kq-pv-cancel': kqState.preview = null; render(); return true;
    case 'kq-pv-add': kqPreviewAdd(); return true;
    case 'kq-del': removeWithUndo('kqs', id, '問題を消しました'); commit(); return true;
    /* ----- 辞書 ----- */
    case 'kq-dict-open': kqState.dictOpen = kqState.dictOpen === t.dataset.k ? '' : t.dataset.k; render(); return true;
    case 'kq-dict-card':
      var dob = kqDictFind(t.dataset.k); if(dob) kqToAnki('略語・用語', [kqDictCard(dob)]);
      return true;
    case 'kq-abbr-open': kqState.dictAdd = !kqState.dictAdd; render(); return true;
    case 'kq-abbr-add':
      var ab = String(kqV('kq_na') || '').trim();
      if(!ab){ toast('略語・用語を入れてください', true); return true; }
      var srcT = String(kqV('kq_ns') || '').trim();
      var added = kqAbbrAdd({ abbr:ab, full:kqV('kq_nf'), yomi:kqV('kq_ny'), ja:kqV('kq_nj'), desc:kqV('kq_nd'), src:srcT ? KQ_SRC.hand + '：' + srcT : KQ_SRC.hand });
      if(!added){ toast('同じことばがもうあります', true); return true; }
      kqClearIn('kq_n'); kqState.dictQ = ab; kqState.dictOpen = 'u' + added.id; kqState.dictAdd = false;
      commit(); toast('辞書に足しました'); return true;
    case 'kq-abbr-del': removeWithUndo('abbrs', id, 'ことばを消しました'); commit(); return true;
    case 'kq-wiki': kqWikiLoad(t.dataset.q || kqState.dictQ); return true;
    case 'kq-wiki-close': kqState.wiki = null; render(); return true;
    case 'kq-wiki-add':
      var w = kqState.wiki; if(!w || w.state !== 'ok') return true;
      var wa = kqAbbrAdd({ abbr:w.title, ja:w.desc || w.title, desc:w.extract.slice(0, 400), src:'Wikipedia「' + w.title + '」', url:w.url });
      if(!wa){ toast('もう辞書にあります', true); return true; }
      kqState.dictOpen = 'u' + wa.id;
      commit(); toast('辞書に足しました（出典：Wikipedia）'); return true;
    case 'kq-wiki-card':
      var w2 = kqState.wiki; if(!w2 || w2.state !== 'ok') return true;
      kqToAnki('略語・用語', [{ q:w2.title + ' とは？', a:w2.extract.slice(0, 380) + '\n（出典：Wikipedia「' + w2.title + '」・教科書で確かめて）' }]);
      return true;
    /* ----- 基準値 ----- */
    case 'kq-lab-cat': kqState.labCat = t.dataset.v || ''; render(); return true;
    case 'kq-lab-card': var lo = kqLabs()[i]; if(lo) kqToAnki('基準値', [kqLabCard(lo)]); return true;
    case 'kq-lab-cards':
      kqToAnki('基準値', kqLabs().filter(function(o){ return o.cat === t.dataset.cat; }).map(kqLabCard)); return true;
    case 'kq-lab-quiz': kqLabQuizNext(); render(); kqGoTop(); return true;
    case 'kq-lab-quiz-end': kqState.labQuiz = null; render(); return true;
    case 'kq-lab-ans':
      var z = kqState.labQuiz; if(!z || z.picked >= 0) return true;
      z.picked = i; z.n++; if(i === z.i) z.ok++;
      render(); return true;
    /* ----- 薬 ----- */
    case 'kq-drug-cat': kqState.drugCat = t.dataset.v || ''; kqState.drugOpen = -1; render(); return true;
    case 'kq-drug-hi': kqState.drugHi = !kqState.drugHi; render(); return true;
    case 'kq-drug-open': kqState.drugOpen = kqState.drugOpen === i ? -1 : i; render(); return true;
    case 'kq-drug-card': var go = kqDrugs()[i]; if(go) kqToAnki('薬', kqDrugCards(go)); return true;
    case 'kq-drug-flip':
      var fl = kqDrugFilter().map(function(o){ return o.i; });
      if(!fl.length) return true;
      kqState.drugFlip = { order:fl, pos:0, show:false }; render(); kqGoTop(); return true;
    case 'kq-drug-show': if(kqState.drugFlip){ kqState.drugFlip.show = true; render(); } return true;
    case 'kq-drug-move':
      var f = kqState.drugFlip; if(!f) return true;
      f.pos = Math.max(0, Math.min(f.order.length - 1, f.pos + (Number(t.dataset.v) || 0)));
      f.show = false; render(); return true;
    case 'kq-drug-shuf': if(kqState.drugFlip){ kqState.drugFlip.order = kqShuffle(kqState.drugFlip.order); kqState.drugFlip.pos = 0; kqState.drugFlip.show = false; render(); } return true;
    case 'kq-drug-flip-end': kqState.drugFlip = null; render(); return true;
    /* ----- 解剖 ----- */
    case 'kq-anat-open': kqState.anatEdit = null; kqAnatStart(id, 'flip'); render(); kqGoTop(); return true;
    case 'kq-anat-close': kqState.anat = null; render(); return true;
    case 'kq-anat-mode': if(kqState.anat){ kqAnatStart(kqState.anat.id, t.dataset.v); render(); } return true;
    case 'kq-anat-flip': if(kqState.anat){ kqState.anat.open[i] = !kqState.anat.open[i]; render(); } return true;
    case 'kq-anat-all':
      if(kqState.anat){
        var aa = kqAnatGet(kqState.anat.id), on = t.dataset.v === '1';
        kqState.anat.open = {};
        if(on && aa) aa.holes.forEach(function(h, k){ kqState.anat.open[k] = true; });
        render();
      }
      return true;
    case 'kq-anat-ans':
      var za = kqState.anat; if(!za || za.picked != null) return true;
      var an = kqAnatGet(za.id); if(!an) return true;
      za.picked = za.opts[toNum(t.dataset.k)];
      if(za.picked === an.holes[za.order[za.pos]].ans) za.ok++;
      za.open[za.order[za.pos]] = true;
      render(); return true;
    case 'kq-anat-next':
      var zn = kqState.anat; if(!zn) return true;
      var anx = kqAnatGet(zn.id); if(!anx) return true;
      zn.pos++;
      if(zn.pos >= zn.order.length){ zn.end = true; kqAnatSaveScore(zn.id, zn.order.length, zn.ok); commit(); return true; }
      kqAnatOpts(anx, zn); render(); return true;
    case 'kq-anat-new':
      kqPickFiles(false, async function(files){
        try{
          var url = await resizeImage(files[0], 1400, 0.72);
          await kqAnatCreate(url, files[0].name.replace(/\.[a-z0-9]+$/i, ''));
        }catch(e){ toast('写真を読めませんでした：' + e.message, true); }
      });
      return true;
    case 'kq-anat-edit':
      var ae = (S.anatomy || []).filter(function(x){ return x.id === id; })[0]; if(!ae) return true;
      kqState.anat = null; kqClearIn('kq_an');
      kqState.anatEdit = { id:ae.id, isNew:0, title:ae.title || '', img:ae.img, holes:(ae.holes || []).map(function(h){ return Object.assign({}, h); }), sel:-1 };
      render(); kqGoTop(); return true;
    case 'kq-anat-del': removeWithUndo('anatomy', id, '図を消しました'); commit(); return true;
    case 'kq-anat-hdel':
      if(kqState.anatEdit){ kqAnatReadInputs(); kqState.anatEdit.holes.splice(i, 1); kqState.anatEdit.sel = -1; render(); }
      return true;
    case 'kq-anat-ai': kqAnatAi(); return true;
    case 'kq-anat-save': kqAnatSave(); return true;
    case 'kq-anat-cancel': kqState.anatEdit = null; kqClearIn('kq_an'); render(); return true;
    /* ----- 手順 ----- */
    case 'kq-skill-open':
      if(kqState.skill !== id){ kqState.skillChk = {}; kqState.skillWhy = {}; }
      kqState.skill = id; render(); kqGoTop(); return true;
    case 'kq-skill-back': kqState.skill = ''; render(); return true;
    case 'kq-skill-chk':
      kqState.skillChk[i] = !!t.checked;
      var li = t.closest('.kq-step'); if(li) li.classList.toggle('on', !!t.checked);
      var sn = document.getElementById('kq_skn'); if(sn) sn.textContent = Object.keys(kqState.skillChk).filter(function(k){ return kqState.skillChk[k]; }).length;
      return true;
    case 'kq-skill-why':
      kqState.skillWhy[i] = !kqState.skillWhy[i];
      var li2 = t.closest('.kq-step'); if(li2) li2.classList.toggle('why', !!kqState.skillWhy[i]);
      return true;
    case 'kq-skill-whyall':
      var sk = kqSkillGet(kqState.skill); if(!sk) return true;
      var allOpen = sk.steps.every(function(st, k){ return kqState.skillWhy[k]; });
      kqState.skillWhy = {}; if(!allOpen) sk.steps.forEach(function(st, k){ kqState.skillWhy[k] = true; });
      render(); return true;
    case 'kq-skill-clear': kqState.skillChk = {}; render(); return true;
    case 'kq-skill-run':
      kqState.skillRun = { id:kqState.skill, start:Date.now() }; kqState.skillChk = {};
      kqTimerStart(); render(); return true;
    case 'kq-skill-stop': kqState.skillRun = null; clearInterval(kqTimer); kqTimer = null; render(); return true;
    case 'kq-skill-done': kqSkillRecord(); return true;
    case 'kq-skill-del': removeWithUndo('kmItems', id, '手順を消しました'); if(kqState.skill === id) kqState.skill = ''; commit(); return true;
    case 'kq-skill-photo':
      var sname = String(kqV('kq_spn') || '').trim();
      kqPickFiles(true, async function(files){
        try{ var urls = await kqReadPhotos(files, 1800, 0.82); await kqSkillPhotoRead(urls, sname || files[0].name.replace(/\.[a-z0-9]+$/i, '')); }
        catch(e){ toast('写真を読めませんでした：' + e.message, true); }
      });
      return true;
    case 'kq-spv-toggle': if(kqState.skillPv && kqState.skillPv.steps[i]) kqState.skillPv.steps[i].on = t.checked ? 1 : 0; render(); return true;
    case 'kq-spv-cancel': kqState.skillPv = null; render(); return true;
    case 'kq-spv-add':
      var pv = kqState.skillPv; if(!pv) return true;
      var nm = String(kqV('kq_spt') || pv.name).trim() || pv.name;
      var ms = kqMySkillAdd(nm, pv.steps.filter(function(x){ return x.on; }), pv.src);
      if(!ms){ toast('追加する手順がありません', true); return true; }
      kqState.skillPv = null; delete kqState.inp.kq_spt; kqState.skill = ms.id; kqState.skillChk = {};
      commit(); toast('「' + ms.name + '」を追加しました'); return true;
    case 'kq-skill-handopen': kqState.skillAdd = !kqState.skillAdd; render(); return true;
    case 'kq-skill-hand':
      var hn = String(kqV('kq_smn') || '').trim();
      var lines = String(kqV('kq_sms') || '').split(/\r?\n/).map(function(s){ return s.trim(); }).filter(Boolean);
      if(!hn || !lines.length){ toast('名前と手順を入れてください', true); return true; }
      var ms2 = kqMySkillAdd(hn, lines.map(function(s){ var p = s.split(/[｜|]/); return { s:p[0].trim(), w:(p.slice(1).join(' ') || '').trim() }; }), KQ_SRC.hand);
      kqClearIn('kq_sm'); kqState.skillAdd = false; kqState.skill = ms2 ? ms2.id : '';
      commit(); toast('手順を追加しました'); return true;
    /* ----- 設定 ----- */
    case 'kq-set-today':
      S.ui.kokushi = Object.assign({}, kqCfg(), { today:kqCfg().today === 0 ? 1 : 0 });
      touch('ui'); commit(); return true;
  }
  return true;
}
kmAction(kqAction);

/* 入力：打った字を覚える・さがす欄は、その場で結果だけ描き直す */
function kqOnInput(ev){
  var el = ev.target;
  if(!el || !el.dataset) return;
  if(el.dataset.kqpv != null){
    var pv = kqState.preview, k = toNum(el.dataset.kqpv);
    if(pv && pv.items[k]) pv.items[k].f = kqFieldOf(el.value);
    return;
  }
  if(el.dataset.kqh != null){
    var e = kqState.anatEdit, n = toNum(el.dataset.kqh);
    if(e && e.holes[n]) e.holes[n].ans = el.value;
    return;
  }
  if(!el.id || el.id.indexOf('kq_') !== 0) return;
  if(el.id === 'kq_set_tf'){
    if(ev.type !== 'change') return;
    S.ui.kokushi = Object.assign({}, kqCfg(), { todayField:kqFieldOk(el.value) ? el.value : '' });
    touch('ui'); commit(); return;
  }
  kqState.inp[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  if(el.id === 'kq_antitle' && kqState.anatEdit) kqState.anatEdit.title = el.value;
  if(el.id === 'kq_dq'){
    kqState.dictQ = el.value; kqState.dictOpen = '';
    var r = document.getElementById('kq_dres'); if(r) r.innerHTML = kqDictResults();
  }
  if(el.id === 'kq_lq'){
    kqState.labQ = el.value;
    var r2 = document.getElementById('kq_lres'); if(r2) r2.innerHTML = kqLabResults();
  }
  if(el.id === 'kq_gq'){
    kqState.drugQ = el.value; kqState.drugOpen = -1;
    var r3 = document.getElementById('kq_gres'); if(r3) r3.innerHTML = kqDrugResults();
    var gn = document.getElementById('kq_gn'); if(gn) gn.textContent = kqDrugFilter().length;
  }
}
document.addEventListener('input', kqOnInput);
document.addEventListener('change', kqOnInput);

/* ============================== 登録 ============================== */
KQ_TOOLS.forEach(function(tl){
  var view = { 'kq-drill':kqDrillView, 'kq-dict':kqDictView, 'kq-lab':kqLabView, 'kq-drug':kqDrugView, 'kq-anat':kqAnatView, 'kq-skill':kqSkillView }[tl.id];
  var badge = null;
  if(tl.id === 'kq-drill') badge = function(){ var n = kqPool('', 'due').length; return n ? '復習' + n : ''; };
  kmStudy({ id:tl.id, icon:tl.icon, title:tl.title, desc:tl.desc, order:tl.order, view:view, badge:badge });
});
kmPart('today', 'kqtoday', '今日の1問（国試）', kqTodayCard);
kmSettings({ id:'kqset', title:'国試・勉強の道具', after:'',
  note:function(){ return '今日の1問：' + (kqCfg().today === 0 ? '出さない' : '出す'); },
  html:function(){
    var c = kqCfg();
    return '<div class="row"><div class="grow"><div class="t">今日タブに「今日の1問（国試）」を出す</div><div class="s">毎日1問、国試ふうの問題が出ます。</div></div>' +
      '<button class="mini" data-act="kq-set-today">' + (c.today === 0 ? '出さない → 出す' : '出す → 出さない') + '</button></div>' +
      '<div class="field"><label class="f" for="kq_set_tf">今日の1問の分野</label><select id="kq_set_tf">' + kqFieldOptions(c.todayField || '', true) + '</select></div>' +
      '<p class="note">国試ドリル・辞書・基準値・薬・解剖・手順は、「勉強」タブから開けます。答えた記録は、ほかの端末にも同期されます。</p>';
  } });

/* 全体検索 */
function kqSearch(q){
  var nq = kqNorm(q), out = [];
  if(!nq) return out;
  kqDictSearch(q, 8).forEach(function(o){
    out.push({ kind:'略語・用語', title:o.abbr + (o.ja ? '：' + o.ja : ''), sub:o.full || o.desc.slice(0, 40), act:'kq-go', attrs:{ 'data-tool':'kq-dict', 'data-q':o.abbr, 'data-k':o.k } });
  });
  kqLabs().filter(function(o){ return o.hay.indexOf(nq) >= 0; }).slice(0, 6).forEach(function(o){
    out.push({ kind:'基準値', title:kqLabLabel(o), sub:kqLabValue(o) + '（目安）', act:'kq-go', attrs:{ 'data-tool':'kq-lab', 'data-q':o.name } });
  });
  kqDrugs().filter(function(o){ return o.hay.indexOf(nq) >= 0; }).slice(0, 6).forEach(function(o){
    out.push({ kind:'薬', title:o.group, sub:o.names, act:'kq-go', attrs:{ 'data-tool':'kq-drug', 'data-q':o.group } });
  });
  kqSkillsAll().filter(function(s){ return kqNorm(s.name + s.cat + s.steps.map(function(x){ return x.s; }).join('')).indexOf(nq) >= 0; }).slice(0, 5).forEach(function(s){
    out.push({ kind:'看護技術の手順', title:s.name, sub:s.steps.length + '手順', act:'kq-go', attrs:{ 'data-tool':'kq-skill', 'data-id':s.id } });
  });
  kqAllQs().filter(function(x){ return kqNorm(x.q + x.c.join('') + x.e).indexOf(nq) >= 0; }).slice(0, 6).forEach(function(x){
    out.push({ kind:'国試の問題', title:x.q.slice(0, 50), sub:kqFieldName(x.f) + '・' + x.src, act:'kq-go', attrs:{ 'data-tool':'kq-drill', 'data-id':x.id } });
  });
  kqAnatAll().filter(function(a){ return kqNorm(a.title + a.holes.map(function(h){ return h.ans; }).join('')).indexOf(nq) >= 0; }).slice(0, 4).forEach(function(a){
    out.push({ kind:'解剖図', title:a.title, sub:'穴 ' + a.holes.length + 'こ', act:'kq-go', attrs:{ 'data-tool':'kq-anat', 'data-id':a.id } });
  });
  return out;
}
kmSearch(kqSearch);

/* ウィジェット・Discord のまとめ（小さく） */
kmSummary(function(s){
  s.kokushi = { today:kqDayCount(today()).n, review:kqPool('', 'due').length, streak:kqStreak() };
});

/* データの点検 */
kmCheck(function(){
  var bad = (Array.isArray(S.kqs) ? S.kqs : []).filter(function(x){
    return !x || !x.q || !Array.isArray(x.choices) || x.choices.length < 2 || !Array.isArray(x.ans) || !x.ans.length ||
      x.ans.some(function(i){ return !(i >= 0 && i < x.choices.length); });
  });
  var holes = (Array.isArray(S.anatomy) ? S.anatomy : []).filter(function(x){ return !x || !x.img || !Array.isArray(x.holes) || !x.holes.length; });
  var out = [];
  if(bad.length) out.push({ level:'warn', msg:'国試：選択肢や正解が足りない自分の問題が ' + bad.length + '問あります（勉強 › 国試ドリルで消せます）' });
  if(holes.length) out.push({ level:'warn', msg:'解剖図：写真か穴がない図が ' + holes.length + 'つあります（勉強 › 解剖図の穴うめで直せます）' });
  return out;
});

/* ===== AIが読めるように ===== */
function kqAiStats(){
  var st = kqStats(), td = today(), dc = kqDayCount(td);
  var recentMiss = kqAllQs().filter(function(q){ var l = kqLogOf(q.id); return l && l.res === 0; })
    .sort(function(a, b){ return String(kqLogOf(b.id).last).localeCompare(String(kqLogOf(a.id).last)); })
    .slice(0, 10).map(function(q){ return { id:q.id, field:kqFieldName(q.f), question:q.q.slice(0, 120), answer:q.a.map(function(i){ return q.c[i]; }).join('・'), last:kqLogOf(q.id).last, source:q.src }; });
  return {
    today:td, todayAnswered:dc.n, todayCorrect:dc.ok, streakDays:kqStreak(),
    questions:{ total:st.all.total, builtin:kqBuiltinQs().length, own:kqOwnList().length, answered:st.all.answered, notYet:st.all.fresh, reviewDueToday:st.all.due, lastWrong:st.all.miss },
    correctRate:st.all.rate == null ? 'まだ記録なし' : st.all.rate + '%',
    fields:st.fields.map(function(b){ return { field:b.name, total:b.total, answered:b.answered, tries:b.n, correct:b.ok, rate:b.rate == null ? null : b.rate + '%', reviewDue:b.due }; }),
    weakFields:st.weak.map(function(b){ return b.name + '（' + b.rate + '%）'; }),
    recentWrong:recentMiss,
    note:'正答率は、答えた回数のうち正解した回数の割合。苦手＝3回以上答えて60%未満の分野。問題の出典：はじめからある問題＝' + KQ_SRC.q + '、自分の問題＝写真・手入力・AI（source に書いてある）'
  };
}
function kqAiSkills(){
  var by = {};
  kqSkillLogs('').forEach(function(x){
    var b = by[x.skill] = by[x.skill] || { skill:x.name, times:0, last:'', lastResult:'', best:'', bestSec:0, missed:{} };
    b.times++;
    if(!b.last){ b.last = x.date; b.lastResult = kqMmss(x.sec) + '（' + x.done + '/' + x.total + '）'; }
    if(x.done === x.total && (!b.bestSec || x.sec < b.bestSec)){ b.bestSec = x.sec; b.best = kqMmss(x.sec); }
    (x.missText || []).forEach(function(t){ b.missed[t] = (b.missed[t] || 0) + 1; });
  });
  return {
    practice:Object.keys(by).map(function(k){
      var b = by[k];
      return { skill:b.skill, times:b.times, last:b.last, lastResult:b.lastResult, bestAllDone:b.best,
               oftenMissed:Object.keys(b.missed).sort(function(x, y){ return b.missed[y] - b.missed[x]; }).slice(0, 5).map(function(t){ return t + '（' + b.missed[t] + '回）'; }) };
    }),
    mySkills:kqSkillsOwn().map(function(s){ return { name:s.name, steps:s.steps.length, source:s.src }; }),
    builtinSkills:kqSkillsBuiltin().map(function(s){ return s.name; }),
    note:'看護技術の手順の出典は「' + KQ_SRC.skill + '」。練習の記録は kmItems（mod:kokushi, type:skill）'
  };
}
function kqAiTools(){
  var sc = kqAnatScore();
  return {
    tools:KQ_TOOLS.map(function(t){ return t.title; }),
    builtin:{ dictionary:kqDictBuiltin().length, labValues:kqLabs().length, drugs:kqDrugs().length, skills:kqSkillsBuiltin().length, anatomyDiagrams:kqAnatBuiltin().length },
    own:{ abbrs:kqDictOwn().length, anatomy:kqAnatOwn().length },
    anatomyQuiz:kqAnatAll().map(function(a){ var r = sc[a.id]; return { title:a.title, holes:a.holes.length, last:r ? r.ok + '/' + r.n + '（' + r.at + '）' : 'まだ', source:a.src }; }),
    howToLookUp:'略語・基準値・薬・手順の中身は、道具 kokushi_lookup でしらべられる。国試の練習問題は kokushi_quiz で出せる。'
  };
}
kmAiData('kokushi_stats', '国試ドリルの分野ごとの正答率・苦手分野・今日といた数・最近まちがえた問題', function(){ return kqAiStats(); });
KM.aiData.kokushi_stats.section = 'kokushi';
kmAiData('kokushi_skills', '看護技術の手順の練習の記録（時間・よく抜ける手順）', function(){ return kqAiSkills(); });
KM.aiData.kokushi_skills.section = 'study';
kmAiData('kokushi_tools', '勉強①の道具（辞書・基準値・薬・解剖図・手順）の数と、解剖図クイズの結果', function(){ return kqAiTools(); });
KM.aiData.kokushi_tools.section = 'study';

/* AIそうだんの道具（読むだけ） */
function kqLookup(query, kind, max){
  var nq = kqNorm(query), out = { query:query, results:[] };
  if(!nq) return { error:'さがすことばがありません' };
  max = Math.max(1, Math.min(20, toNum(max) || 8));
  kind = kind || 'all';
  if(kind === 'all' || kind === 'abbr') kqDictSearch(query, max).forEach(function(o){
    out.results.push({ kind:'略語・用語', abbr:o.abbr, english:o.full, reading:o.yomi, meaning:o.ja, explanation:o.desc, source:o.src + (o.url ? ' ' + o.url : '') });
  });
  if(kind === 'all' || kind === 'lab') kqLabs().filter(function(o){ return o.hay.indexOf(nq) >= 0; }).slice(0, max).forEach(function(o){
    out.results.push({ kind:'基準値', category:o.cat, item:kqLabLabel(o), value:kqLabValue(o), note:o.note, source:KQ_SRC.lab });
  });
  if(kind === 'all' || kind === 'drug') kqDrugs().filter(function(o){ return o.hay.indexOf(nq) >= 0; }).slice(0, max).forEach(function(o){
    out.results.push({ kind:'薬', category:o.cat, group:o.group, drugs:o.names, action:o.act, sideEffects:o.side, nursing:o.care, highRisk:o.hi, source:KQ_SRC.drug });
  });
  if(kind === 'all' || kind === 'skill') kqSkillsAll().filter(function(s){ return kqNorm(s.name + s.cat).indexOf(nq) >= 0; }).slice(0, 3).forEach(function(s){
    out.results.push({ kind:'看護技術の手順', name:s.name, steps:s.steps.map(function(st, k){ return (k + 1) + '. ' + st.s + (st.w ? '（根拠：' + st.w + '）' : ''); }), source:s.src });
  });
  out.count = out.results.length;
  out.note = '出典（source）を答えにそえること。数値・薬は目安なので「教科書で確かめて」とそえること。';
  return out;
}
kmChatTool({ name:'kokushi_lookup',
  description:'看護・医療の略語や専門用語、検査の基準値、薬（はたらき・副作用・看護の注意）、看護技術の手順と根拠を、手帳の組みこみの辞書でしらべる。答えには出典をそえる。',
  parameters:{ type:'OBJECT', properties:{
    query:{ type:'STRING', description:'しらべることば（例：ADL、カリウム、ワルファリン、血圧測定）' },
    kind:{ type:'STRING', enum:['all','abbr','lab','drug','skill'], description:'しぼるとき：abbr=略語・用語、lab=基準値、drug=薬、skill=手順。ふつうは all' } },
    required:['query'] } },
  function(a){ return { result:JSON.stringify(kqLookup(a.query, a.kind, a.limit)) }; });
kmChatTool({ name:'kokushi_quiz',
  description:'手帳の国試ドリルから、看護師国家試験ふうの練習問題を1問とりだす。問題と選択肢だけを先に見せ、ユーザーが答えてから正解・解説・出典を伝える。',
  parameters:{ type:'OBJECT', properties:{
    field:{ type:'STRING', description:'分野（' + KQ_FIELDS.map(function(f){ return f[1]; }).join('・') + '）。なければ空' },
    mode:{ type:'STRING', enum:['rand','new','miss','due'], description:'rand=ランダム、new=まだの問題、miss=まちがえた問題、due=今日の復習' } } } },
  function(a){
    var f = a.field ? kqFieldOf(a.field, '') : '';
    var pool = kqPool(f, a.mode || 'rand');
    if(!pool.length) pool = kqPool(f, 'rand');
    if(!pool.length) return { result:'問題がありません' };
    var q = pool[Math.floor(Math.random() * pool.length)];
    return { result:JSON.stringify({ id:q.id, field:kqFieldName(q.f), question:q.q, choices:q.c.map(function(c, k){ return (k + 1) + '. ' + c; }),
      answer:q.a.map(function(k){ return k + 1; }), explanation:q.e, source:q.src,
      howTo:'まず問題と選択肢だけを見せる。ユーザーが答えたら、正解・解説・出典（source）を伝える。' }) };
  });

/* ============================== 組みこみデータ ==============================
   ・KQ_ANAT   … 解剖図（SVGで描いた図式）。labels が穴になる [x, y, 名前, 文字の大きさ]。texts はかくさない文字
   ・KQ_QS     … 国試ふうの練習問題（くらしの手帳の練習問題。本物の過去問ではない）
   ・KQ_DICT   … 略語・用語 '略語|英語|読み|意味|説明'
   ・KQ_LABS   … 基準値 '分類|項目|略号|基準値|単位|ひとこと'
   ・KQ_DRUGS  … 薬 '分類|グループ|代表的な薬（一般名）|はたらき|主な副作用|看護の注意|ハイリスク'
   ・KQ_SKILLS … 看護技術の手順 { id, name, cat, goal, steps:[[手順, 根拠]] } */


var KQ_ANAT = [
{ id:'kqa-heart', title:'心臓の血液の流れ', desc:'4つの部屋と4つの弁', W:360, H:320,
  draw:
    '<rect x="10" y="22" width="80" height="30" rx="8" class="kq-sv-v"/><rect x="96" y="22" width="80" height="30" rx="8" class="kq-sv-v"/>' +
    '<rect x="205" y="22" width="140" height="30" rx="8" class="kq-sv-a"/>' +
    '<rect x="25" y="82" width="135" height="40" rx="10" class="kq-sv-v"/><rect x="205" y="82" width="140" height="40" rx="10" class="kq-sv-a"/>' +
    '<rect x="25" y="162" width="135" height="40" rx="10" class="kq-sv-v"/><rect x="205" y="162" width="140" height="40" rx="10" class="kq-sv-a"/>' +
    '<rect x="25" y="242" width="135" height="36" rx="10" class="kq-sv-v"/><rect x="205" y="242" width="140" height="36" rx="10" class="kq-sv-a"/>' +
    '<line x1="182" y1="78" x2="182" y2="206" class="kq-sv-line kq-sv-dash"/>' +
    '<line x1="50" y1="52" x2="70" y2="79" class="kq-sv-line" marker-end="url(#kqArw)"/><line x1="136" y1="52" x2="115" y2="79" class="kq-sv-line" marker-end="url(#kqArw)"/>' +
    '<line x1="275" y1="52" x2="275" y2="79" class="kq-sv-line" marker-end="url(#kqArw)"/>' +
    '<line x1="92" y1="122" x2="92" y2="159" class="kq-sv-line" marker-end="url(#kqArw)"/><line x1="275" y1="122" x2="275" y2="159" class="kq-sv-line" marker-end="url(#kqArw)"/>' +
    '<line x1="92" y1="202" x2="92" y2="239" class="kq-sv-line" marker-end="url(#kqArw)"/><line x1="275" y1="202" x2="275" y2="239" class="kq-sv-line" marker-end="url(#kqArw)"/>',
  texts:[[93, 10, '全身から', 10], [275, 10, '肺から', 10], [92, 298, '↓ 肺へ（静脈血）', 11], [275, 298, '↓ 全身へ（動脈血）', 11], [182, 314, '青＝静脈血　赤＝動脈血', 10]],
  labels:[[50, 37, '上大静脈', 12], [136, 37, '下大静脈', 12], [92, 102, '右心房'], [128, 141, '三尖弁', 12], [92, 182, '右心室'], [136, 221, '肺動脈弁', 12], [92, 260, '肺動脈'],
          [275, 37, '肺静脈'], [275, 102, '左心房'], [311, 141, '僧帽弁', 12], [275, 182, '左心室'], [319, 221, '大動脈弁', 12], [275, 260, '大動脈']] },
{ id:'kqa-circ', title:'肺循環と体循環', desc:'どの血管に静脈血・動脈血が流れるか', W:380, H:370,
  draw:
    '<rect x="130" y="15" width="120" height="40" rx="12" class="kq-sv-n"/>' +
    '<rect x="95" y="140" width="80" height="40" rx="6" class="kq-sv-v"/><rect x="95" y="180" width="80" height="40" rx="6" class="kq-sv-v"/>' +
    '<rect x="205" y="140" width="80" height="40" rx="6" class="kq-sv-a"/><rect x="205" y="180" width="80" height="40" rx="6" class="kq-sv-a"/>' +
    '<rect x="130" y="315" width="120" height="40" rx="12" class="kq-sv-n"/>' +
    '<path d="M175,205 H190 V58" class="kq-sv-line kq-sv-lv" marker-end="url(#kqArw)"/>' +
    '<path d="M250,35 H320 V160 H288" class="kq-sv-line kq-sv-la" marker-end="url(#kqArw)"/>' +
    '<path d="M285,205 H350 V335 H253" class="kq-sv-line kq-sv-la" marker-end="url(#kqArw)"/>' +
    '<path d="M128,335 H40 V160 H92" class="kq-sv-line kq-sv-lv" marker-end="url(#kqArw)"/>',
  texts:[[190, 35, '肺（ガス交換）', 12], [240, 128, '心臓', 11], [190, 335, '全身の組織', 12]],
  labels:[[255, 100, '肺循環'], [150, 95, '肺動脈'], [150, 117, '静脈血', 11], [350, 95, '肺静脈'], [350, 117, '動脈血', 11],
          [135, 160, '右心房'], [245, 160, '左心房'], [135, 200, '右心室'], [245, 200, '左心室'],
          [190, 268, '体循環'], [318, 265, '大動脈'], [318, 287, '動脈血', 11], [80, 265, '大静脈'], [80, 287, '静脈血', 11]] },
{ id:'kqa-urine', title:'尿ができて出るまで', desc:'腎臓（ネフロン）から尿道まで', W:380, H:452,
  draw:(function(){
    var s = '', cls = ['a', 'n', 'n', 'n', 'n', 'n', 'n', 'y', 'y', 'y', 'y'];
    for(var i = 0; i < 11; i++){
      var y = 12 + 40 * i;
      s += '<rect x="20" y="' + y + '" width="150" height="28" rx="8" class="kq-sv-' + cls[i] + '"/>';
      if(i < 10) s += '<line x1="95" y1="' + (y + 28) + '" x2="95" y2="' + (y + 39) + '" class="kq-sv-line" marker-end="url(#kqArw)"/>';
    }
    return s;
  })(),
  texts:[[180, 26, '腎臓へ血液が入る', 10, 'start'], [180, 66, '血液をろ過→原尿（1日約150L）', 10, 'start'], [180, 106, '原尿を受けとる', 10, 'start'],
         [180, 146, '水・Na・ブドウ糖などを再吸収', 10, 'start'], [180, 186, '尿をこくするしくみ', 10, 'start'], [180, 226, 'アルドステロンでNaを再吸収', 10, 'start'],
         [180, 266, 'ADH（バソプレシン）で水を再吸収', 10, 'start'], [180, 306, '腎臓の中で尿が集まる', 10, 'start'], [180, 346, '腎臓から膀胱へ運ぶ', 10, 'start'],
         [180, 386, '尿をためる', 10, 'start'], [180, 426, '体の外へ出す', 10, 'start']],
  labels:[[95, 26, '腎動脈'], [95, 66, '糸球体'], [95, 106, 'ボウマン嚢'], [95, 146, '近位尿細管'], [95, 186, 'ヘンレループ'], [95, 226, '遠位尿細管'],
          [95, 266, '集合管'], [95, 306, '腎盂'], [95, 346, '尿管'], [95, 386, '膀胱'], [95, 426, '尿道']] },
{ id:'kqa-gi', title:'食べ物の通り道（消化管）', desc:'口から肛門までの順番', W:360, H:320,
  draw:(function(){
    var s = '', L = ['n', 'n', 'n', 'n', 'p', 'p', 'p'], R = ['y', 'y', 'y', 'y', 'y', 'y', 'n'];
    for(var i = 0; i < 7; i++){
      var y = 12 + 44 * i;
      s += '<rect x="20" y="' + y + '" width="140" height="30" rx="8" class="kq-sv-' + L[i] + '"/><rect x="200" y="' + y + '" width="140" height="30" rx="8" class="kq-sv-' + R[i] + '"/>';
      if(i < 6) s += '<line x1="90" y1="' + (y + 30) + '" x2="90" y2="' + (y + 43) + '" class="kq-sv-line" marker-end="url(#kqArw)"/>' +
                     '<line x1="270" y1="' + (y + 30) + '" x2="270" y2="' + (y + 43) + '" class="kq-sv-line" marker-end="url(#kqArw)"/>';
    }
    return s + '<path d="M160,291 H180 V27 H197" class="kq-sv-line" marker-end="url(#kqArw)"/>';
  })(),
  texts:[[180, 314, '白＝上部消化管　ピンク＝小腸　黄＝大腸', 10]],
  labels:[[90, 27, '口腔'], [90, 71, '咽頭'], [90, 115, '食道'], [90, 159, '胃'], [90, 203, '十二指腸'], [90, 247, '空腸'], [90, 291, '回腸'],
          [270, 27, '盲腸'], [270, 71, '上行結腸'], [270, 115, '横行結腸'], [270, 159, '下行結腸'], [270, 203, 'S状結腸'], [270, 247, '直腸'], [270, 291, '肛門']] }
];

var KQ_QS = [
/* [分野id, 問題文, [選択肢...], 正解の番号（1からかぞえる。2つ選ぶ問題は [1,3] のように配列）, 解説] */

/* ---- hisshu（必修） ---- */
['hisshu', '成人の安静時の脈拍数の基準範囲として適切なのはどれか。', ['40〜50回/分', '60〜100回/分', '110〜130回/分', '140〜160回/分'], 2, '成人の安静時の脈拍数は60〜100回/分が目安。100回/分以上を頻脈、60回/分未満を徐脈という。橈骨動脈で測定し、リズムの乱れ（不整脈）がないかも観察する。'],
['hisshu', '標準予防策（スタンダードプリコーション）の考え方として正しいのはどれか。', ['感染症と診断された患者にだけ行う', '手袋をつけていれば手指衛生は必要ない', '汗も血液と同じく感染性があるものとして扱う', 'すべての患者の血液・体液・排泄物を感染の可能性があるものとして扱う'], 4, '標準予防策は、感染症の有無にかかわらず、すべての患者の血液・体液（汗を除く）・分泌物・排泄物・傷のある皮膚・粘膜を感染の可能性があるものとして扱う。手袋をはずした後も手指衛生が必要である。'],
['hisshu', '看護師の免許を与えるのはどれか。', ['厚生労働大臣', '都道府県知事', '市町村長', '文部科学大臣'], 1, '保健師助産師看護師法により、看護師国家試験に合格した者に厚生労働大臣が免許を与え、看護師籍に登録する。准看護師の免許は都道府県知事が与える点と区別しておく。'],
['hisshu', '日本高血圧学会の基準で、診察室で測定した血圧が高血圧と判定されるのはどれか。', ['120/80 mmHg以上', '130/80 mmHg以上', '140/90 mmHg以上', '160/100 mmHg以上'], 3, '診察室血圧では、収縮期140 mmHg以上または拡張期90 mmHg以上を高血圧とする。家庭血圧では135/85 mmHg以上が基準で、診察室血圧より低い値になる。'],
['hisshu', 'ジャパン・コーマ・スケール（JCS）でⅢ桁に分類される状態はどれか。', ['見当識障害がある', '自分の名前や生年月日が言えない', '呼びかけると容易に開眼する', '痛み刺激を加えても開眼しない'], 4, 'JCSのⅠ桁は刺激しなくても覚醒している状態、Ⅱ桁は刺激すると覚醒する状態、Ⅲ桁は刺激しても覚醒しない状態を表す。見当識障害や名前が言えないのはⅠ桁、呼びかけで開眼するのはⅡ桁である。'],
['hisshu', '身長160cm、体重64kgの成人のBMIはどれか。', ['20.0', '22.5', '25.0', '27.5'], 3, 'BMIは体重(kg)÷身長(m)の2乗で求め、64÷(1.6×1.6)＝25.0となる。日本肥満学会の基準では、BMI18.5未満を低体重、25以上を肥満とする。'],

/* ---- jintai（人体の構造と機能） ---- */
['jintai', '動脈血が流れている血管はどれか。', ['肺動脈', '肺静脈', '上大静脈', '下大静脈', '門脈'], 2, '肺でガス交換を終えた酸素の多い血液は、肺静脈を通って左心房にもどる。肺動脈は右心室から肺へ静脈血を運ぶため、血管の名前と流れる血液の種類が逆になる点に注意する。'],
['jintai', '心臓の刺激伝導系で、最初に興奮して心拍のリズムをつくる部位はどれか。', ['洞房結節', '房室結節', 'ヒス束', 'プルキンエ線維'], 1, '洞房結節は右心房にあり、ペースメーカーとして一定のリズムで興奮をおこす。興奮は房室結節→ヒス束→左右の脚→プルキンエ線維の順に伝わり、心室全体が収縮する。'],
['jintai', '血糖値を下げる作用をもつホルモンはどれか。', ['グルカゴン', 'アドレナリン', 'コルチゾール', '成長ホルモン', 'インスリン'], 5, 'インスリンは膵臓のランゲルハンス島β細胞から分泌され、細胞へのブドウ糖の取りこみを促して血糖値を下げる。血糖値を下げるホルモンはインスリンだけで、ほかの選択肢はいずれも血糖値を上げる。'],
['jintai', '副交感神経が優位になったときにおこる反応はどれか。2つ選べ。', ['瞳孔の散大', '心拍数の減少', '気管支の拡張', '消化管運動の亢進', '血糖値の上昇'], [2, 4], '副交感神経は休息やエネルギーをたくわえる場面ではたらき、心拍数を減らし、消化管の運動や消化液の分泌を高める。瞳孔の散大・気管支の拡張・血糖値の上昇は交感神経のはたらきである。'],
['jintai', '胆汁をつくる臓器はどれか。', ['胆嚢', '膵臓', '脾臓', '肝臓'], 4, '胆汁は肝臓でつくられ、胆嚢でたくわえられて濃縮される。食事をとると十二指腸に分泌され、胆汁酸が脂肪を乳化して消化・吸収を助ける。胆嚢は胆汁をつくる臓器ではない。'],
['jintai', '赤血球の寿命の目安はどれか。', ['約1週間', '約1か月', '約120日', '約1年', '約5年'], 3, '赤血球の寿命は約120日で、古くなった赤血球はおもに脾臓でこわされる。ヘモグロビンから生じたビリルビンは肝臓で処理され、胆汁の成分として排出される。'],

/* ---- shippei（疾病の成り立ちと回復の促進） ---- */
['shippei', '炎症の徴候に含まれないのはどれか。', ['発赤', '蒼白', '腫脹', '熱感', '疼痛'], 2, '炎症の4徴候は発赤・腫脹・熱感・疼痛で、機能障害を加えて5徴候という。炎症の部位では血管が広がって血流が増えるため赤く熱をもち、蒼白にはならない。'],
['shippei', 'Ⅳ型（遅延型）アレルギーによる反応はどれか。', ['花粉症', 'アナフィラキシーショック', '自己免疫性溶血性貧血', '血清病', 'ツベルクリン反応'], 5, 'Ⅳ型アレルギーは抗体ではなくT細胞がかかわる遅延型の反応で、ツベルクリン反応や接触皮膚炎がある。花粉症とアナフィラキシーはⅠ型、自己免疫性溶血性貧血はⅡ型、血清病はⅢ型である。'],
['shippei', '肝臓での初回通過効果を最も受けやすい与薬方法はどれか。', ['経口与薬', '舌下与薬', '静脈内注射', '経皮与薬（貼付剤）'], 1, '経口与薬では、腸で吸収された薬が門脈を通って肝臓に入り、全身に届く前に一部が代謝される（初回通過効果）。舌下・静脈内・経皮与薬は肝臓を通らずに全身の循環に入る。'],
['shippei', 'ワルファリンを服用している患者に、控えるよう指導する食品はどれか。', ['りんご', '白米', '牛乳', '納豆', 'こんにゃく'], 4, '納豆はビタミンKを多く含み、納豆菌が腸内でもビタミンKをつくるため、ワルファリンの抗凝固作用を弱めてしまう。クロレラや青汁もビタミンKが多く、同じように注意が必要である。'],
['shippei', 'HbA1cが反映するのは、過去およそどのくらいの期間の血糖の状態か。', ['1〜2日', '1〜2週', '1〜2か月', '6か月〜1年'], 3, 'HbA1cは、赤血球のヘモグロビンにブドウ糖が結びついた割合である。赤血球の寿命が約120日であることから過去1〜2か月の平均的な血糖の状態を反映し、血糖コントロールの評価に用いる。'],
['shippei', '良性腫瘍と比べた悪性腫瘍の特徴はどれか。2つ選べ。', ['周囲の組織に浸潤しながら増殖する', '被膜に包まれていることが多い', '発育がゆっくりである', '遠くの臓器に転移しやすい', '細胞の異型が軽い'], [1, 4], '悪性腫瘍は周囲の組織に入りこむ浸潤性の増殖をし、血管やリンパ管を通って転移しやすい。発育が速く、細胞の異型も強い。被膜に包まれてゆっくり増えるのは良性腫瘍の特徴である。'],

/* ---- kiso（基礎看護学） ---- */
['kiso', 'ボディメカニクスの原理にもとづく動作として適切なのはどれか。', ['足を閉じてまっすぐ立つ', '重心を高くしたまま持ち上げる', '患者の身体から離れて作業する', '腰だけをひねって向きを変える', '足を開いて支持基底面を広くする'], 5, '足を開いて支持基底面を広くし、膝を曲げて重心を低くすると姿勢が安定する。患者に近づいて重心どうしを近づけ、腰をひねらず足先を動かす方向に向けると、看護師の腰への負担が少なくなる。'],
['kiso', '擦式アルコール製剤ではなく、流水と石けんによる手洗いを行うべき場面はどれか。', ['手に目に見える汚れがあるとき', '患者に触れる前', '清潔・無菌操作の前', '患者の周囲の物品に触れた後'], 1, '手に目に見える汚れや血液・体液がついたとき、アルコールが効きにくいノロウイルスや芽胞をつくる菌に触れたおそれがあるときは、流水と石けんで洗う。それ以外は擦式アルコール製剤による手指消毒が基本となる。'],
['kiso', '滅菌物の取り扱いとして正しいのはどれか。', ['腰より下に下がった滅菌物もそのまま使う', '滅菌鑷子は先端を上に向けて持つ', '有効期限は開封した後に確認する', '滅菌パックは使用する直前に開封する', '滅菌野の上で腕を交差させて操作する'], 4, '滅菌物は使う直前に開封し、有効期限や包装の破れは開封前に確認する。腰より下や視野の外に出た物は不潔とみなす。滅菌鑷子は、薬液が持ち手から先端へ流れもどらないよう先端を下に向けて持つ。'],
['kiso', 'セミファウラー位での上半身の挙上角度として適切なのはどれか。', ['0度（水平）', '15〜30度', '45〜60度', '約90度'], 2, 'セミファウラー位は上半身を15〜30度起こした体位で、ファウラー位は45〜60度である。上半身を起こすと腹部の臓器が下がって横隔膜が動きやすくなり、呼吸が楽になる。'],
['kiso', '仰臥位で褥瘡が最もできやすい部位はどれか。', ['後頭部', '肩甲骨部', '仙骨部', '肘頭部', '踵部'], 3, '仰臥位では、体重が多くかかり骨が突出している仙骨部に最も褥瘡ができやすい。側臥位では大転子部、座位では坐骨結節部など、体位によって圧迫を受けやすい部位が変わる。'],
['kiso', '与薬の際に確認する「6つのR」に含まれるのはどれか。2つ選べ。', ['正しい価格', '正しい患者', '正しい製造会社', '正しい保管場所', '正しい時間'], [2, 5], '6つのRは、正しい患者・正しい薬・正しい目的・正しい用量・正しい用法（経路）・正しい時間である。誤薬を防ぐため、与薬の準備から実施までの各段階でくり返し確認する。'],

/* ---- seijin（成人看護学） ---- */
['seijin', '術後の早期離床によって期待される効果はどれか。', ['深部静脈血栓症を予防する', '創部の安静を保つ', '腸蠕動を抑える', '基礎代謝を下げる', '肺活量を減らす'], 1, '早く体を動かすと下肢の血流がよくなり、深部静脈血栓症を防げる。また肺が広がって無気肺や肺炎を防ぎ、腸蠕動の回復も早まる。筋力の低下などの廃用症候群の予防にもつながる。'],
['seijin', 'インスリン療法を受けている患者にみられる低血糖の症状はどれか。', ['口渇', '多尿', 'クスマウル呼吸', '皮膚の乾燥', '冷汗'], 5, '低血糖では交感神経が刺激されて冷汗・動悸・手指のふるえがおこり、進むと意識障害になる。口渇・多尿・皮膚の乾燥は高血糖の症状で、クスマウル呼吸は糖尿病ケトアシドーシスでみられる。'],
['seijin', '慢性閉塞性肺疾患（COPD）の患者に指導する呼吸法として適切なのはどれか。', ['浅く速い呼吸', '口すぼめ呼吸', '息を止める呼吸', '口を大きく開けて一気に吐く呼吸'], 2, '口すぼめ呼吸は、口をすぼめてゆっくり息を吐くことで気道の中の圧を保ち、細い気道がつぶれるのを防いで息を吐き出しやすくする。浅く速い呼吸では息が十分に吐けず、息苦しさが強まる。'],
['seijin', '急性心筋梗塞の胸痛の特徴として正しいのはどれか。', ['数秒で消える', 'ニトログリセリンの舌下投与ですぐに消える', '深呼吸をすると強くなる', '30分以上続くことが多い', '胸を押すと痛みが強くなる'], 4, '心筋梗塞の胸痛は締めつけられるような強い痛みで、30分以上続き、ニトログリセリンが効きにくい。狭心症の発作は数分から15分程度でおさまり、ニトログリセリンが効く点と区別する。'],
['seijin', '抗がん薬の副作用で好中球が減少している患者への指導として適切なのはどれか。2つ選べ。', ['外出後は手洗いとうがいをする', '生花や鉢植えを病室に飾る', '人混みを避ける', '毛の硬い歯ブラシを使う', '生の肉や魚を積極的に食べる'], [1, 3], '好中球が減ると細菌や真菌に感染しやすくなるため、手洗い・うがい・マスクを行い、人混みを避ける。生花や鉢植えの土、生ものは感染源となるので避け、歯ぐきを傷つけない柔らかい歯ブラシを使う。'],
['seijin', 'エリクソンの発達理論で、壮年期（中年期）の発達課題はどれか。', ['基本的信頼 対 不信', '勤勉性 対 劣等感', '生殖性（世代性） 対 停滞', '同一性 対 同一性拡散', '統合 対 絶望'], 3, 'エリクソンは壮年期の課題を生殖性（世代性）対 停滞とし、次の世代を育て支えることを重視した。基本的信頼は乳児期、勤勉性は学童期、同一性は青年期、統合は老年期の課題である。'],

/* ---- rounen（老年看護学） ---- */
['rounen', '加齢にともなう身体の変化として正しいのはどれか。', ['高音域から聞こえにくくなる', '口渇を感じやすくなる', '体内の水分量が増加する', '肺活量が増加する', '味覚が敏感になる'], 1, '加齢による難聴（老人性難聴）は、高音域から聞こえにくくなる感音性難聴である。高齢者は口渇を感じにくく体内の水分量も少ないため脱水になりやすい。肺活量は減り、味覚は鈍くなる。'],
['rounen', '嚥下機能が低下した高齢者の食事介助として適切なのはどれか。', ['顎を上げた姿勢で飲みこんでもらう', 'さらさらした水分をそのまま提供する', '一口の量を多くする', '食後すぐに仰臥位にする', '顎を軽く引いた姿勢をとる'], 5, '顎を軽く引くと食べ物が気管に入りにくくなり、誤嚥を防げる。さらさらした水分はむせやすいのでとろみをつける。一口の量は少なめにし、食後はしばらく座位を保って逆流を防ぐ。'],
['rounen', 'アルツハイマー型認知症の初期にみられやすい症状はどれか。', ['パーキンソン症状', '最近の出来事を覚えていない', '具体的で生々しい幻視', '急に出現した片麻痺'], 2, 'アルツハイマー型認知症は、新しいことを覚えられない近時記憶の障害から始まることが多い。幻視やパーキンソン症状はレビー小体型認知症の特徴で、急な片麻痺は脳血管障害を疑う。'],
['rounen', '骨粗鬆症のある高齢者が転倒しておこしやすく、寝たきりの原因になりやすい骨折はどれか。', ['鎖骨骨折', '膝蓋骨骨折', '肋骨骨折', '大腿骨頸部骨折', '頭蓋骨骨折'], 4, '骨粗鬆症の高齢者は転倒で大腿骨頸部（近位部）骨折をおこしやすく、手術や長い安静から寝たきりにつながりやすい。ほかに橈骨遠位端骨折、脊椎の圧迫骨折、上腕骨近位部骨折も多い。'],
['rounen', '長期間の臥床によっておこる廃用症候群はどれか。2つ選べ。', ['関節拘縮', '骨密度の増加', '多血症', '起立性低血圧', '筋力の増強'], [1, 4], '長く寝たままでいると、筋萎縮・関節拘縮・骨萎縮（骨密度の低下）がおこり、血圧の調節がうまくいかず起立性低血圧もおこる。ほかに褥瘡、深部静脈血栓症、心肺機能や意欲の低下などがある。'],
['rounen', '高齢者に薬の副作用があらわれやすい理由として正しいのはどれか。', ['肝臓での薬の代謝が速くなる', '体内の水分量が増える', '腎臓からの薬の排泄が遅くなる', '体脂肪の割合が減る'], 3, '加齢で腎機能や肝機能が低下すると、薬の排泄や代謝が遅れて血中濃度が高くなりやすい。また高齢者は体内の水分量が減り体脂肪の割合が増えるため、薬の分布も変わる。多剤併用にも注意する。'],

/* ---- shoni（小児看護学） ---- */
['shoni', '大泉門が閉じる時期の目安はどれか。', ['生後1〜2か月', '生後6か月ごろ', '1歳6か月ごろ', '3歳ごろ', '6歳ごろ'], 3, '大泉門は1歳6か月ごろまでに閉じ、小泉門はそれより早く生後数か月以内に閉じる。大泉門のふくらみ（膨隆）は頭蓋内圧の上昇、へこみ（陥没）は脱水の目安として観察する。'],
['shoni', '乳児の首がすわる（定頸）時期の目安はどれか。', ['生後1か月', '生後3〜4か月', '生後7〜8か月', '生後12か月'], 2, '首がすわるのは生後3〜4か月、寝返りは5〜6か月、ひとり座りは7〜8か月、ひとり歩きは1歳〜1歳3か月ごろが目安である。運動の発達は頭部から下肢へ、体の中心から末梢へと進む。'],
['shoni', '体重が出生時のおよそ3倍になる時期の目安はどれか。', ['生後1か月', '生後3か月', '生後6か月', '1歳'], 4, '体重は生後3〜4か月で出生時の約2倍、1歳で約3倍になる。身長は1歳で出生時の約1.5倍、4〜5歳で約2倍になる。乳児期は一生のうちで最も成長が速い時期である。'],
['shoni', '成人と比べた乳児のバイタルサインの特徴として正しいのはどれか。', ['呼吸数が多い', '脈拍数が少ない', '血圧が高い', '胸式呼吸が中心である'], 1, '乳児は代謝が活発で体が小さいため、呼吸数・脈拍数は成人より多く、血圧は低い。肋骨が水平に近く呼吸筋も未熟なため、横隔膜を使う腹式呼吸が中心になる。'],
['shoni', '0歳児の不慮の事故による死亡の原因として最も多いのはどれか。', ['交通事故', '溺死・溺水', '転落', '火災', '窒息'], 5, '0歳児の不慮の事故による死亡は窒息が最も多い。やわらかい寝具を使わずあお向けに寝かせる、ベッドに物を置かない、口に入る小さな物を手の届く所に置かないなどの予防が大切である。'],
['shoni', 'ピアジェの認知発達理論で、幼児期（前操作期）の思考の特徴はどれか。2つ選べ。', ['自己中心性', '抽象的な仮説を立てて考える', 'アニミズム（物にも命や心があると考える）', '保存の概念が確立している', '論理的に逆の操作ができる'], [1, 3], '前操作期（2〜7歳ごろ）は、自分の視点からしか物事をとらえられない自己中心性や、物にも心があると考えるアニミズムが特徴である。保存の概念は具体的操作期、抽象的な思考は形式的操作期で身につく。'],

/* ---- bosei（母性看護学） ---- */
['bosei', '正期産にあたる時期はどれか。', ['妊娠22週0日〜36週6日', '妊娠37週0日〜41週6日', '妊娠38週0日〜42週6日', '妊娠42週0日以降'], 2, '正期産は妊娠37週0日から41週6日までの分娩である。22週0日〜36週6日の分娩は早産、42週0日以降は過期産という。妊娠22週未満で妊娠が終わることは流産という。'],
['bosei', '分娩予定日の考え方として正しいのはどれか。', ['最終月経の初日から数えて40週0日', '最終月経の最終日から数えて40週0日', '最終月経の初日から数えて36週0日', '最終月経の初日から数えて42週0日'], 1, '妊娠週数は最終月経の初日を0週0日として数え、分娩予定日は40週0日（280日目）となる。月経周期が不規則な場合などは、妊娠初期の超音波検査で胎児の大きさから修正する。'],
['bosei', '分娩後、子宮底が腹壁の上から触れなくなる時期の目安はどれか。', ['分娩後1〜2日', '分娩後4〜5日', '分娩後10〜14日', '分娩後6か月'], 3, '子宮底は分娩直後に臍下2〜3横指、12時間後にいったん臍の高さまで上がり、その後は1日に約1横指ずつ下がって、分娩後10〜14日ごろ腹壁の上から触れなくなる。'],
['bosei', '正常な産褥経過での悪露の色の変化の順序として正しいのはどれか。', ['白色→黄色→褐色→赤色', '褐色→赤色→白色→黄色', '黄色→赤色→褐色→白色', '赤色→褐色→黄色→白色'], 4, '悪露は、はじめは血液を多く含む赤色で、日がたつにつれて血液の成分が減り、褐色、黄色、白色へと変わって量も減っていく。赤色の悪露が長く続くときは子宮復古不全を疑う。'],
['bosei', '乳頭への吸啜刺激によって下垂体後葉から分泌され、乳汁を押し出すはたらきをもつホルモンはどれか。', ['プロラクチン', 'エストロゲン', 'プロゲステロン', 'ヒト絨毛性ゴナドトロピン（hCG）', 'オキシトシン'], 5, 'オキシトシンは乳腺の周りの筋上皮細胞を収縮させて乳汁を押し出す（射乳）ほか、子宮を収縮させて子宮復古を助ける。プロラクチンは下垂体前葉から分泌され、乳汁をつくるはたらきをもつ。'],
['bosei', '妊娠中の母体におこる生理的な変化として正しいのはどれか。2つ選べ。', ['心拍数が減少する', '循環血液量が増加する', '妊娠初期は基礎体温の低温相が続く', '頻尿がおこりにくくなる', '便秘になりやすい'], [2, 5], '妊娠中は循環血液量が約40〜50%増え、心拍数も増える。プロゲステロンの作用で腸の動きが弱まり便秘になりやすい。妊娠初期は基礎体温の高温相が続き、大きくなる子宮が膀胱を圧迫して頻尿になりやすい。'],

/* ---- seishin（精神看護学） ---- */
['seishin', '受け入れがたい気持ちや欲求とは正反対の態度をとる防衛機制はどれか。', ['昇華', '投影', '合理化', '反動形成', '退行'], 4, '反動形成は、嫌いな相手に必要以上に親切にするなど、抑えている気持ちと反対の態度をとることである。投影は自分の気持ちを相手のものとみなす、合理化はもっともらしい理由をつける、退行は幼い段階にもどる防衛機制である。'],
['seishin', '統合失調症の陽性症状はどれか。', ['感情の平板化', '意欲の低下', '会話の貧困', '社会的ひきこもり', '幻聴'], 5, '陽性症状は本来ないものがあらわれる症状で、幻聴などの幻覚や妄想、まとまりのない会話や行動がある。感情の平板化・意欲の低下・会話の貧困・ひきこもりは、本来あるものが失われる陰性症状である。'],
['seishin', '精神保健福祉法で、本人の同意にもとづいて行う入院形態はどれか。', ['措置入院', '任意入院', '医療保護入院', '緊急措置入院', '応急入院'], 2, '任意入院は本人の同意による入院で、精神科病院の管理者は本人の同意にもとづく入院となるよう努めることとされている。医療保護入院は家族等の同意、措置入院は2名以上の精神保健指定医の診察結果にもとづき都道府県知事が決める。'],
['seishin', 'うつ病の急性期の患者への対応として適切なのはどれか。', ['「がんばって」と励ます', '気分転換に旅行をすすめる', '退職など大きな決定は回復するまで延ばすよう伝える', '自殺については話題にしない'], 3, '急性期は判断力が低下しているため、退職などの大きな決定は回復後に延ばすよう伝え、十分に休めるようにする。励ましや無理な気分転換は負担になる。自殺の危険が高いので、自殺の考えについては避けずにたずねる。'],
['seishin', 'アルコール依存症の人が飲酒をやめた後にみられる離脱症状はどれか。2つ選べ。', ['手指のふるえ', '縮瞳', '徐脈', '振戦せん妄', '体温の低下'], [1, 4], '飲酒をやめて数時間から数日のうちに、手指のふるえ・発汗・頻脈・不眠などがあらわれ、2〜3日後ごろに幻視や意識障害をともなう振戦せん妄がおこることがある。徐脈や体温の低下ではなく、頻脈や発熱がみられる。'],
['seishin', 'ペプロウが示した看護師と患者の関係の発展段階で、最初の段階はどれか。', ['方向づけ', '問題解決', '同一化', '開拓（利用）'], 1, 'ペプロウは、看護師と患者の関係が方向づけ→同一化→開拓（利用）→問題解決の段階をへて発展するとした。方向づけの段階では、患者が自分の問題に気づき、助けを求められるよう関わる。'],

/* ---- zaitaku（地域・在宅看護論） ---- */
['zaitaku', '訪問看護ステーションの管理者に原則としてなることができる職種はどれか。', ['医師', '介護福祉士', '理学療法士', '看護師', '薬剤師'], 4, '訪問看護ステーションの管理者は、原則として常勤の保健師や看護師がつとめる。医師は常駐せず、訪問看護は主治医の訪問看護指示書にもとづいて行う。理学療法士などはスタッフとして訪問できる。'],
['zaitaku', '在宅酸素療法を受けている療養者への指導として適切なのはどれか。', ['酸素吸入中もガスこんろで調理してよい', '火気から2m以上離れる', '息苦しいときは酸素の流量を自分の判断で増やす', '外出するときは酸素吸入を中止する'], 2, '酸素は物が燃えるのを助けるため、火気から2m以上離し、吸入中は喫煙しない。流量は医師の指示を守り、自分の判断で増やさない（CO2ナルコーシスの危険がある）。外出時は携帯用の酸素ボンベを使う。'],
['zaitaku', '地域包括ケアシステムで、必要なサービスがおおむね30分以内に提供される「日常生活圏域」として想定されている単位はどれか。', ['都道府県', '二次医療圏', '中学校区', '町内会（自治会）'], 3, '地域包括ケアシステムは、住まい・医療・介護・予防・生活支援が一体的に提供されるしくみである。おおむね30分以内に必要なサービスが届く中学校区を、日常生活圏域の単位として想定している。'],
['zaitaku', '地域包括支援センターに配置することが定められている職種はどれか。2つ選べ。', ['薬剤師', '保健師', '理学療法士', '社会福祉士', '管理栄養士'], [2, 4], '地域包括支援センターは市町村（または委託を受けた法人）が設置し、保健師・社会福祉士・主任介護支援専門員を置く。総合相談支援、権利擁護、介護予防ケアマネジメントなどを行う地域の相談窓口である。'],
['zaitaku', 'レスパイトケアの主な目的はどれか。', ['介護する家族が休息をとれるようにすること', '療養者の病気を治療すること', '療養者の住宅を改修すること', '医療費の負担を減らすこと'], 1, 'レスパイトケアは、ショートステイなどで療養者を一時的にあずかり、介護する家族が休んで心身の疲れを回復できるようにする支援である。家族の介護負担を軽くすることは、在宅療養を続けるために大切である。'],
['zaitaku', '疾病の予防の段階のうち、二次予防にあたるのはどれか。', ['予防接種', '禁煙の健康教育', 'リハビリテーション', '職場復帰の支援', 'がん検診'], 5, '二次予防は病気の早期発見・早期治療で、健康診断やがん検診が含まれる。予防接種や健康教育は病気にならないための一次予防、リハビリテーションや社会復帰の支援は機能の回復や再発予防をめざす三次予防である。'],

/* ---- tougou（看護の統合と実践） ---- */
['tougou', '災害時のトリアージで、赤色のタッグをつける対象はどれか。', ['すでに死亡している、または救命の見込みがない人', '軽いけがで自分で歩ける人', '治療が多少遅れても生命に危険がない人', 'ただちに処置をしないと生命にかかわる人'], 4, 'トリアージタッグは、赤が最優先で治療する人（Ⅰ）、黄が治療を待てる人（Ⅱ）、緑が軽症で歩ける人（Ⅲ）、黒が死亡または救命が困難な人（0）を示す。限られた医療資源で多くの命を救うために行う。'],
['tougou', 'ハインリッヒの法則で、1件の重大な事故の背景にあるとされる軽微な事故の件数はどれか。', ['3件', '29件', '100件', '300件'], 2, 'ハインリッヒの法則では、1件の重大事故の背景に29件の軽微な事故と300件のヒヤリ・ハットがあるとされる。小さなインシデントを報告・分析して対策をとることが、重大な事故の予防につながる。'],
['tougou', '失語症や嚥下障害のある人への訓練をおもに担当する職種はどれか。', ['理学療法士', '作業療法士', '言語聴覚士', '臨床工学技士', '診療放射線技師'], 3, '言語聴覚士は、失語症などの言語・聴覚の障害や、嚥下障害の訓練を行う。理学療法士は起き上がりや歩行などの基本動作、作業療法士は食事・更衣などの応用動作や作業活動を通した訓練を担当する。'],
['tougou', '患者に誤った薬を与薬したことに気づいたとき、看護師が最初に行うことはどれか。', ['患者の状態を確認する', 'インシデントレポートを書く', '家族に連絡する', '使った薬を薬剤部に返す'], 1, '誤薬に気づいたら、まず患者のバイタルサインや症状を確認して安全を確保し、ただちに医師やリーダーに報告する。インシデントレポートの作成や原因の分析は、患者への対応が済んでから行う。'],
['tougou', '避難所や車中泊で生活する人の深部静脈血栓症（いわゆるエコノミークラス症候群）の予防として適切なのはどれか。2つ選べ。', ['こまめに水分をとる', '水分を控えてトイレの回数を減らす', '長時間同じ姿勢で過ごす', 'ベルトなどで足をきつくしめつける', 'ときどき足首を回したり歩いたりする'], [1, 5], '狭い場所で長時間同じ姿勢でいると、下肢の静脈に血栓ができやすい。こまめな水分補給と、足首の運動や歩行で血流を保つことが予防になる。水分を控えると血液が濃くなり、かえって危険が高まる。'],
['tougou', '看護学生が臨地実習で知った患者の情報の扱いとして適切なのはどれか。', ['患者の様子をSNSに書きこむ', '実習記録を電車の中で広げて読み返す', '友人に患者の氏名を伝えて相談する', '実習記録は個人が特定されないように書く'], 4, '看護学生にも守秘義務と個人情報の保護が求められる。記録は個人が特定されないように書き、公共の場で広げたりSNSに書いたりしない。困ったときは実習指導者や教員に、決められた場で相談する。'],

/* ---- shakai（健康支援と社会保障制度） ---- */
['shakai', '介護保険の第1号被保険者はどれか。', ['20歳以上の者', '40歳以上65歳未満の医療保険加入者', '65歳以上の者', '75歳以上の者'], 3, '介護保険の第1号被保険者は65歳以上の者、第2号被保険者は40歳以上65歳未満の医療保険加入者である。第2号被保険者は、加齢にともなう特定疾病が原因で介護が必要になった場合にサービスを利用できる。'],
['shakai', '後期高齢者医療制度の対象となるのは、原則として何歳以上か。', ['60歳', '65歳', '70歳', '75歳'], 4, '後期高齢者医療制度は原則75歳以上の人が加入する医療制度で、65〜74歳で一定の障害があると認定された人も加入できる。都道府県ごとの後期高齢者医療広域連合が運営する。'],
['shakai', '「すべて国民は、健康で文化的な最低限度の生活を営む権利を有する」と定めている日本国憲法の条文はどれか。', ['第9条', '第13条', '第14条', '第21条', '第25条'], 5, '日本国憲法第25条は生存権を定め、国は社会福祉・社会保障・公衆衛生の向上と増進に努めなければならないとしている。生活保護法をはじめとする社会保障制度の基本となる条文である。'],
['shakai', '感染症法で結核が分類されているのはどれか。', ['一類感染症', '二類感染症', '三類感染症', '四類感染症', '五類感染症'], 2, '結核は感染症法の二類感染症に分類され、診断した医師はただちに最寄りの保健所長を経由して都道府県知事に届け出る。一類はエボラ出血熱など、三類は腸管出血性大腸菌感染症などである。'],
['shakai', '生活保護の扶助のうち、原則として現物給付で行われるのはどれか。2つ選べ。', ['生活扶助', '医療扶助', '住宅扶助', '介護扶助', '教育扶助'], [2, 4], '生活保護には8種類の扶助があり、医療扶助と介護扶助は、医療機関や介護事業者からサービスそのものを受ける現物給付が原則である。生活扶助・住宅扶助・教育扶助などは金銭給付が原則となる。'],
['shakai', '妊娠の届出を受けて母子健康手帳を交付するのはどれか。', ['市町村', '都道府県', '厚生労働省', '出産予定の医療機関', '勤務先の事業所'], 1, '母子保健法にもとづき、妊娠した人は市町村に妊娠の届出をし、市町村が母子健康手帳を交付する。手帳には妊娠中の経過や出産の状態、子どもの成長・発達や予防接種の記録を書きこむ。']
];

var KQ_DICT = [
/* '略語・用語|英語の正式名|読み|日本語の意味|ひとこと説明' */

/* ---- バイタルサイン・測定 ---- */
'Vital|vital signs|バイタル|バイタルサイン（生命徴候）|生きていることを示すしるし。体温・脈拍・呼吸・血圧が基本で、意識レベルやSpO2を加えることも多い。',
'BP|blood pressure|ビーピー|血圧|血液が血管の壁をおす力。収縮期（上）と拡張期（下）で表し、成人はおよそ120/80mmHg未満が正常の目安。',
'HR|heart rate|エイチアール|心拍数|心臓が1分間に拍動する回数。成人の安静時はおよそ60〜100回/分が目安。',
'PR|①pulse rate ②PR interval|ピーアール|①脈拍数 ②心電図のPR間隔|①動脈でふれる1分間の拍動の数。成人はおよそ60〜100回/分で、記録ではPと書くことも多い。',
'RR|①respiratory rate ②R-R interval|アールアール|①呼吸数 ②心電図のR-R間隔|①1分間の呼吸の回数。成人はおよそ12〜20回/分が目安で、記録ではRと書くことも多い。',
'BT|body temperature|ビーティー|体温|からだの温度。わきの下で測ることが多く、成人はおよそ36〜37℃が目安。',
'KT|Körpertemperatur|ケーティー|体温（ドイツ語由来）|ドイツ語由来の体温の略。BTと同じ意味で、記録や申し送りで使われる。',
'SpO2|saturation of percutaneous oxygen|エスピーオーツー|経皮的動脈血酸素飽和度|パルスオキシメーターで指先などから測る酸素飽和度。一般に96〜99%が目安で、90%未満は要注意。',
'SaO2|arterial oxygen saturation|エスエーオーツー|動脈血酸素飽和度|動脈血を採って測る酸素飽和度。SpO2はこの値を皮膚の上から推定したもの。',
'PaO2|partial pressure of arterial oxygen|ピーエーオーツー|動脈血酸素分圧|動脈血中の酸素の量を示す値。一般に80〜100Torrが目安で、60Torr以下は呼吸不全。',
'PaCO2|partial pressure of arterial carbon dioxide|ピーエーシーオーツー|動脈血二酸化炭素分圧|動脈血中の二酸化炭素の量を示す値。一般に35〜45Torrが目安で、換気が不十分だと上がる。',
'FiO2|fraction of inspired oxygen|エフアイオーツー|吸入酸素濃度|吸っている気体に含まれる酸素の割合。室内の空気は約21%（0.21）。',
'ABG|arterial blood gas analysis|エービージー|動脈血ガス分析|動脈血を採ってPaO2・PaCO2・pHなどを測る検査。呼吸の状態や酸と塩基のバランスを調べる。',
'BW|body weight|ビーダブリュー|体重|からだの重さ。薬の量や栄養・水分の計算、むくみや心不全の悪化の目安に使う。',
'BH|body height|ビーエイチ|身長|からだの高さ。BMIや体表面積の計算に使う。',
'BMI|body mass index|ビーエムアイ|体格指数|体重(kg)を身長(m)の2乗で割った値。日本では18.5未満がやせ、25以上が肥満。',
'I/O|intake and output|インアウト|水分出納（イン・アウト）|からだに入る水分と出る水分の量のこと。点滴・食事・飲水と尿・排液などを比べて水分バランスをみる。',
'頻脈|tachycardia|ひんみゃく|脈が速いこと|成人で脈拍が100回/分を超える状態。発熱・脱水・痛み・不整脈などで起こる。',
'徐脈|bradycardia|じょみゃく|脈が遅いこと|成人で脈拍が60回/分未満の状態。めまいや失神の原因になることがある。',

/* ---- 意識・痛み・機能の評価 ---- */
'JCS|Japan Coma Scale|ジェーシーエス|ジャパン・コーマ・スケール|日本で広く使う意識レベルの評価法。0（清明）とI・II・III群の3-3-9度方式で、数字が大きいほど重い。',
'GCS|Glasgow Coma Scale|ジーシーエス|グラスゴー・コーマ・スケール|開眼（E）・言語（V）・運動（M）の3項目で意識を評価する方法。合計3〜15点で、点が低いほど重い。',
'見当識|orientation|けんとうしき|時・場所・人がわかる力|今がいつか、ここがどこか、相手が誰かがわかる力。せん妄や認知症で障害される。',
'NRS|Numerical Rating Scale|エヌアールエス|数値評価スケール|痛みを0（痛みなし）から10（考えられる最悪の痛み）の数字で答えてもらう評価法。',
'VAS|Visual Analogue Scale|バス|視覚的アナログスケール|10cmの線の上で、今の痛みの強さの位置を患者に示してもらう評価法。',
'FRS|Face Rating Scale|エフアールエス|フェイススケール|笑顔から泣き顔までの顔の絵から、今の痛みに近いものを選んでもらう評価法。子どもや高齢者に使いやすい。',
'MMT|Manual Muscle Testing|エムエムティー|徒手筋力テスト|手で抵抗をかけて筋力を0〜5の6段階で評価する方法。5が正常。',
'ROM|range of motion|ロム|関節可動域|関節が動く範囲のこと。ROM訓練は拘縮を防ぐために関節を動かす運動。',
'ADL|activities of daily living|エーディーエル|日常生活動作|食事・排泄・入浴・更衣・移動など、毎日の生活に必要な基本的な動作。',
'IADL|instrumental activities of daily living|アイエーディーエル|手段的日常生活動作|買い物・料理・掃除・服薬管理・金銭管理など、ADLより複雑で社会生活に必要な動作。',
'QOL|quality of life|キューオーエル|生活の質|その人らしく満足して生きているかという生活の質。看護の目標としても大切にされる。',
'BI|Barthel Index|ビーアイ|バーセルインデックス|食事・移乗・トイレ動作など10項目でADLを評価する方法。100点満点で「できるADL」をみる。',
'FIM|Functional Independence Measure|フィム|機能的自立度評価法|運動13項目と認知5項目でADLを評価する方法。18〜126点で「しているADL」をみる。',
'HDS-R|Hasegawa Dementia Scale-Revised|エイチディーエスアール|改訂長谷川式簡易知能評価スケール|日本でよく使う認知機能の検査。30点満点で、20点以下は認知症の疑い。',
'MMSE|Mini-Mental State Examination|エムエムエスイー|ミニメンタルステート検査|世界的に使われる認知機能の検査。30点満点で、23点以下は認知症の疑い。',
'PS|performance status|ピーエス|全身状態（パフォーマンスステータス）|日常生活の制限の程度を0〜4の5段階で表す指標。がん治療の方針を決めるときによく使う。',
'DESIGN-R|DESIGN-R pressure ulcer assessment|デザインアール|褥瘡状態評価スケール|日本褥瘡学会の褥瘡の評価法。深さ・滲出液・大きさ・炎症/感染・肉芽・壊死組織・ポケットをみる。',
'ブレーデンスケール|Braden Scale|ブレーデンスケール|褥瘡発生リスクの評価表|知覚・湿潤・活動性・可動性・栄養状態・摩擦とずれの6項目で評価する。点が低いほど褥瘡ができやすい。',
'アプガースコア|Apgar score|アプガースコア|新生児の状態の評価|生まれて1分後と5分後に、心拍・呼吸・筋緊張・反射・皮膚の色を各0〜2点で評価する。10点満点。',
'NYHA|New York Heart Association classification|ニーハ|NYHA心機能分類|心不全の重さを、日常生活でどのくらい症状が出るかでI〜IV度に分ける方法。',
'ICF|International Classification of Functioning, Disability and Health|アイシーエフ|国際生活機能分類|WHOによる分類。人の生活機能を心身機能・活動・参加と、環境などの背景からとらえる。',

/* ---- 記録・看護過程・情報収集 ---- */
'POS|problem oriented system|ピーオーエス|問題志向型システム|患者の問題ごとに情報を整理し、計画・記録・評価を行う方法。経過記録はSOAPで書くことが多い。',
'SOAP|subjective, objective, assessment, plan|ソープ|SOAP形式の記録|経過記録をS（主観的データ）・O（客観的データ）・A（アセスメント）・P（計画）の順に書く方法。',
'S|subjective data|エス|主観的データ|患者や家族が話した言葉など、本人が感じていること。例「おなかが痛い」。SOAPのS。',
'O|objective data|オー|客観的データ|観察・測定・検査でわかる事実。例：体温37.8℃、顔をしかめている。SOAPのO。',
'A|assessment|エー|アセスメント（分析・判断）|SとOの情報をもとに、何が起きているか・なぜかを看護の視点で解釈し判断すること。SOAPのA。',
'P|plan|ピー|計画|アセスメントをもとに立てる今後の計画。観察計画（OP）・援助計画（TP）・教育計画（EP）に分けることが多い。',
'OP|①observation plan ②operation|オーピー|①観察計画 ②手術|①看護計画のうち、何を観察するかの計画。バイタルサインや症状など。②OPEと同じく手術の意味で使うこともある。',
'TP|①total protein ②treatment plan|ティーピー|①総たんぱく ②援助計画（ケア計画）|①血液中のたんぱく質の総量で、栄養状態の目安（およそ6.5〜8.0g/dL）。②看護計画のうち、実際に行うケアの計画。',
'EP|education plan|イーピー|教育計画（指導計画）|看護計画のうち、患者や家族への説明・指導の計画。',
'看護過程|nursing process|かんごかてい|看護の問題解決の手順|アセスメント・看護診断・計画・実施・評価の順に進める、看護を考えて行うための手順。',
'NANDA|NANDA International|ナンダ|NANDAインターナショナル（NANDA-I）|看護診断の名前と定義を開発している国際団体。旧名は北米看護診断協会で、その看護診断分類は日本でも使われる。',
'EBN|evidence-based nursing|イービーエヌ|根拠に基づく看護|研究などの確かな根拠と患者の希望、看護師の経験をあわせて看護を行う考え方。',
'EBM|evidence-based medicine|イービーエム|根拠に基づく医療|研究による根拠と医師の経験、患者の価値観を合わせて最善の医療を選ぶ考え方。',
'既往歴|past history|きおうれき|これまでにかかった病気・けが・手術|今の病気より前にかかった病気や手術のこと。今の治療や看護に影響するのでアセスメントで大事。',
'現病歴|history of present illness|げんびょうれき|今の病気の経過|今の病気がいつ・どのように始まり、どう変化して受診や入院に至ったかの経過。',
'主訴|chief complaint|しゅそ|患者のいちばんのうったえ|患者が受診した理由になった、いちばんつらい症状。できるだけ本人の言葉で記録する。',
'家族歴|family history|かぞくれき|血縁者がかかった病気|親やきょうだいなど血縁者の病気。遺伝しやすい病気や生活習慣病のリスクを知る手がかりになる。',
'アナムネ|Anamnese|アナムネ|入院時の情報収集（病歴の聞き取り）|ドイツ語Anamneseの略。入院時に既往歴や生活のようすを聞きとること。現場の略し方なので正式な場では使わない。',
'カルテ|Karte|カルテ|診療録|ドイツ語で「カード」。医師が診療の内容を記録したもの。電子カルテでは看護記録もいっしょに見られる。',
'申し送り|handover|もうしおくり|引きつぎ|勤務の交代時に、患者の状態やケアの内容を次の担当者へ伝えること。',
'カンファレンス|conference|カンファレンス|話し合い（検討会）|患者のケアについて、看護師や多職種で情報を共有し方針を話し合う会議。',
'SBAR|situation, background, assessment, recommendation|エスバー|報告のための型|状況・背景・評価・提案の順で報告する方法。医師への急ぎの報告などを短く正確に伝えるのに役立つ。',
'ラポール|rapport|ラポール|信頼関係|患者と看護師の間にある、安心して話し合える信頼関係のこと。よいケアの土台になる。',

/* ---- 意思決定・指示 ---- */
'インフォームド・コンセント|informed consent|インフォームドコンセント|説明を受けたうえでの同意|患者が病状や治療について十分な説明を受け、理解・納得したうえで自分の意思で同意すること。',
'IC|informed consent|アイシー|インフォームド・コンセント|説明を受けたうえでの同意のこと。看護師は同席して、患者の理解や気持ちを確かめて記録する。',
'ムンテラ|Mundtherapie|ムンテラ|病状説明|ドイツ語風の造語で「口で行う治療」の意味。医師の病状説明を指す古い俗語で、今はICや病状説明という。',
'ACP|advance care planning|エーシーピー|アドバンス・ケア・プランニング|これからの医療やケアについて、本人が家族や医療者とくり返し話し合い考えを共有すること。愛称は人生会議。',
'DNR|do not resuscitate|ディーエヌアール|蘇生処置をしない指示|心停止のときに心肺蘇生を行わないという指示。本人や家族の意思をもとに医師が出す。',
'DNAR|do not attempt resuscitation|ディーエヌエーアール|蘇生を試みない指示|心停止時に心肺蘇生を試みないという指示。DNRとほぼ同じ意味で、ほかの治療をしないという意味ではない。',
'NPO|nil per os|エヌピーオー|絶飲食|口から何も食べたり飲んだりしないこと。手術や検査の前などに指示される。',
'PRN|pro re nata|ピーアールエヌ|必要時（頓用）|ラテン語で「必要に応じて」。痛いときなど、必要なときに使う指示や薬のこと。',
'Rp|recipe|アールピー|処方|ラテン語で「取れ」の意味。処方せんや指示で、処方の内容を示す記号として使う。',
'安静度|activity level|あんせいど|どこまで動いてよいかの指示|ベッド上安静・トイレ歩行可など、患者がどこまで動いてよいかを医師が決めたもの。',
'6R|six rights of medication|ロクアール|与薬の6つの確認|正しい患者・薬・目的・用量・用法・時間の6つを確認すること。誤薬を防ぐ基本。',

/* ---- 職種・チーム ---- */
'Dr|doctor|ドクター|医師|医師のこと。記録や申し送りでよく使う略語で、Dr.と書くこともある。',
'Ns|nurse|ナース|看護師|看護師のこと。記録や申し送りでよく使う略語。',
'PT|①physical therapist ②prothrombin time|ピーティー|①理学療法士 ②プロトロンビン時間|①起きる・立つ・歩くなど基本的な動作の回復を支える専門職。②血液が固まるまでの時間をみる検査。',
'OT|occupational therapist|オーティー|作業療法士|食事・着替え・家事など生活に必要な動作や、手先の動きの回復を支える専門職。',
'ST|①speech-language-hearing therapist ②ST segment|エスティー|①言語聴覚士 ②心電図のST部分|①話す・聞く・飲みこむ機能の回復を支える専門職。②心筋梗塞などで上がったり下がったりする心電図の部分。',
'MSW|medical social worker|エムエスダブリュー|医療ソーシャルワーカー|退院後の生活・お金・福祉制度などの相談にのる専門職。退院支援でよく連携する。',
'PSW|psychiatric social worker|ピーエスダブリュー|精神保健福祉士|精神障害のある人の社会復帰や生活を支える福祉の専門職（国家資格）。',
'CM|care manager|シーエム|介護支援専門員（ケアマネジャー）|介護保険でケアプランを作り、サービスを調整する人。「ケアマネ」とも呼ぶ。',
'CE|clinical engineer|シーイー|臨床工学技士|人工呼吸器や透析装置など医療機器の操作や保守点検を担当する専門職。MEと呼ぶこともある。',
'CN|certified nurse|シーエヌ|認定看護師|感染管理や緩和ケアなど特定の分野で、熟練した看護技術と知識を持つと日本看護協会に認められた看護師。',
'CNS|①central nervous system ②certified nurse specialist|シーエヌエス|①中枢神経系 ②専門看護師|①脳と脊髄のこと。②特定の分野で高い実践力を持つと日本看護協会に認められた看護師（大学院修了が条件）。',
'NST|①nutrition support team ②non-stress test|エヌエスティー|①栄養サポートチーム ②ノンストレステスト|①多職種で栄養管理を支えるチーム。②陣痛のないときに胎児の心拍を記録して元気さをみる検査。',
'ICT|infection control team|アイシーティー|感染対策チーム|院内感染を防ぐため、医師・看護師・薬剤師・検査技師などで活動するチーム。',

/* ---- 病棟・部門 ---- */
'ICU|intensive care unit|アイシーユー|集中治療室|命にかかわる重い状態の患者を、24時間体制で集中的に治療・看護する部門。',
'CCU|coronary care unit|シーシーユー|冠疾患集中治療室|心筋梗塞など心臓の病気の重症患者を集中的に治療する部門。',
'HCU|high care unit|エイチシーユー|高度治療室|ICUと一般病棟の中間くらいの重さの患者を治療・看護する部門。',
'NICU|neonatal intensive care unit|エヌアイシーユー|新生児集中治療室|早産児や低出生体重児、病気のある新生児を集中的に治療する部門。',
'GCU|growing care unit|ジーシーユー|新生児回復室（継続保育室）|NICUで状態が落ち着いた赤ちゃんが、退院に向けて育つのを支える部門。',
'PICU|pediatric intensive care unit|ピーアイシーユー|小児集中治療室|重い病気やけがの子どもを集中的に治療する部門。',
'SCU|stroke care unit|エスシーユー|脳卒中集中治療室|脳卒中の急性期の患者を、専門のチームで集中的に治療する部門。',
'MFICU|maternal-fetal intensive care unit|エムエフアイシーユー|母体・胎児集中治療室|妊娠高血圧症候群や切迫早産など、リスクの高い妊婦と胎児を集中的にみる部門。',
'ER|emergency room|イーアール|救急外来（救急救命室）|救急車や急病の患者を受け入れて、最初の診療を行う部門。',
'OPE|operation|オペ|手術|手術のこと。「オペ室」は手術室、「オペ出し」は手術室へ送り出すこと。',

/* ---- 注射・点滴・栄養・管 ---- */
'IV|intravenous injection|アイブイ|静脈内注射|静脈に直接薬を入れる注射（静注）。効き目が早いので、投与中・投与後の観察が大切。',
'IM|intramuscular injection|アイエム|筋肉内注射|三角筋や中殿筋などの筋肉に薬を入れる注射（筋注）。皮下注射より吸収が早い。',
'SC|subcutaneous injection|エスシー|皮下注射|皮膚と筋肉の間の皮下組織に薬を入れる注射（皮下注）。インスリンなどで使う。',
'ID|intradermal injection|アイディー|皮内注射|皮膚のごく浅い層（真皮）に少量の薬を入れる注射。ツベルクリン反応などで使う。',
'DIV|drip infusion in vein|ディーアイブイ|点滴静脈内注射|点滴で時間をかけて静脈に薬や輸液を入れること。滴下の速さや刺入部の観察が大切。',
'PO|per os|ピーオー|経口（内服）|ラテン語で「口から」。薬などを口から飲むこと。',
'SL|sublingual|エスエル|舌下投与|薬を舌の下で溶かして粘膜から吸収させる方法。狭心症発作のニトログリセリンなどで使う。',
'ルート|intravenous line|ルート|点滴の管（輸液ライン）|点滴ボトルから血管までをつなぐ管のこと。「ルート確保」は点滴の針を入れて通り道をつくること。',
'IVH|①intravenous hyperalimentation ②intraventricular hemorrhage|アイブイエイチ|①中心静脈栄養 ②脳室内出血|①太い静脈から高カロリー輸液を入れること（TPNとほぼ同じ）。②早産児などでみられる脳室内の出血。',
'CV|central venous|シーブイ|中心静脈|心臓に近い太い静脈（上大静脈など）のこと。現場では中心静脈カテーテルそのものを「CV」と呼ぶことも多い。',
'CVC|central venous catheter|シーブイシー|中心静脈カテーテル|首・鎖骨の下・足の付け根などから入れ、先を中心静脈に置くカテーテル。高カロリー輸液などに使う。',
'CVP|central venous pressure|シーブイピー|中心静脈圧|心臓近くの太い静脈の圧。からだの水分量や右心の働きの目安になる。',
'PICC|peripherally inserted central catheter|ピック|末梢挿入型中心静脈カテーテル|腕の静脈から入れて先を中心静脈に置くカテーテル。首や胸から入れるより気胸などの危険が少ない。',
'Aライン|arterial line|エーライン|動脈ライン|橈骨動脈などに入れたカテーテル。血圧を連続して測ったり、動脈血を採ったりするのに使う。',
'TPN|total parenteral nutrition|ティーピーエヌ|完全静脈栄養（中心静脈栄養）|必要な栄養のすべてを中心静脈からの点滴で補う方法。口や腸から栄養をとれないときに行う。',
'PPN|peripheral parenteral nutrition|ピーピーエヌ|末梢静脈栄養|腕などの細い静脈から点滴で栄養を補う方法。濃い輸液は使えないので短期間向き。',
'EN|enteral nutrition|イーエヌ|経腸栄養|胃や腸に栄養を入れる方法。口から飲む方法とチューブを使う方法があり、腸を使うので静脈栄養より生理的。',
'PEG|percutaneous endoscopic gastrostomy|ペグ|経皮内視鏡的胃ろう造設術|内視鏡を使っておなかの皮膚から胃に通じる穴（胃ろう）をつくること。できた胃ろう自体をPEGと呼ぶことも多い。',
'NG|nasogastric tube|エヌジー|経鼻胃管（NGチューブ）|鼻から胃まで入れるチューブ。栄養剤を入れたり胃の内容物を出したりする。先が胃に入っているかの確認が大切。',
'Foley|Foley catheter|フォーリー|フォーリーカテーテル（膀胱留置カテーテル）|尿道から膀胱に入れて留置する管。先のバルーンをふくらませて抜けないようにする。尿路感染に注意。',
'ゾンデ|Sonde|ゾンデ|管・チューブ（特に胃管）|ドイツ語で「探り針・管」。現場では胃管など、からだに入れる細い管をゾンデと呼ぶことがある。',
'ドレーン|drain|ドレーン|体内の液体を外に出す管|手術後などに、血液・膿・リンパ液などを体の外に出すための管。排液の量・色・においを観察する。',
'サクション|suction|サクション|吸引|口・鼻・気管などにたまった痰や分泌物を、吸引器で吸いとること。',
'アンビュー|Ambu bag|アンビュー|用手人工呼吸器（バッグバルブマスク）|手でバッグをもんで肺に空気を送る道具。アンビューは会社名に由来し、正式にはバッグバルブマスクという。',

/* ---- 呼吸・救急 ---- */
'NPPV|non-invasive positive pressure ventilation|エヌピーピーブイ|非侵襲的陽圧換気|気管挿管をせず、マスクを使って空気を送りこむ人工呼吸。COPDの悪化時などに使う。',
'CPAP|continuous positive airway pressure|シーパップ|持続陽圧呼吸療法|マスクから一定の圧をかけて、気道が閉じるのを防ぐ方法。睡眠時無呼吸症候群の治療によく使う。',
'PEEP|positive end-expiratory pressure|ピープ|呼気終末陽圧|人工呼吸で、息を吐き終わったときにも少し圧を残す設定。肺胞がつぶれるのを防ぐ。',
'HFNC|high-flow nasal cannula|エイチエフエヌシー|高流量鼻カニュラ（ネーザルハイフロー）|温めて加湿した酸素を、高い流量で鼻から送る方法。吸入酸素濃度を安定して保ちやすい。',
'HOT|home oxygen therapy|ホット|在宅酸素療法|自宅で酸素を吸入する治療。COPDなど慢性呼吸不全の人が使う。火気に近づかないよう指導する。',
'CO2ナルコーシス|CO2 narcosis|シーオーツーナルコーシス|二酸化炭素がたまって起こる意識障害|COPDの人などに高い濃度の酸素を与えると、呼吸が弱まりCO2がたまって意識が悪くなることがある。',
'CPR|cardiopulmonary resuscitation|シーピーアール|心肺蘇生法|胸骨圧迫と人工呼吸で、止まった心臓と呼吸の代わりをすること。胸骨圧迫は1分間に100〜120回。',
'AED|automated external defibrillator|エーイーディー|自動体外式除細動器|心室細動などの不整脈を電気ショックで止める機器。音声の指示に従えば一般の人も使える。',
'BLS|basic life support|ビーエルエス|一次救命処置|心肺蘇生とAEDの使用など、特別な器具や薬がなくても行える救命処置。',
'ACLS|advanced cardiovascular life support|エーシーエルエス|二次救命処置|気管挿管や薬の投与など、医療者が器具や薬を使って行う高度な救命処置。',
'CPA|cardiopulmonary arrest|シーピーエー|心肺停止|心臓と呼吸が止まった状態。すぐにCPRとAEDの使用を始める。',
'ROSC|return of spontaneous circulation|ロスク|自己心拍再開|心肺蘇生によって、心臓が自分の力で再び動き始めること。',
'VF|ventricular fibrillation|ブイエフ|心室細動|心室が細かくふるえて血液を送り出せない、命にかかわる不整脈。すぐにCPRと電気ショックが必要。',
'VT|ventricular tachycardia|ブイティー|心室頻拍|心室から速いリズムの興奮が続く不整脈。脈がふれない場合は心室細動と同じく電気ショックの対象。',
'PVC|premature ventricular contraction|ピーブイシー|心室期外収縮|心室から予定より早く出る脈。健康な人にもみられるが、数が多い・連続する場合は注意。',
'PEA|pulseless electrical activity|ピーイーエー|無脈性電気活動|心電図に波形はあるのに脈がふれない心停止。電気ショックは効かず、CPRと原因の治療を行う。',
'ショック|shock|ショック|急性循環不全|全身の血流が急に悪くなり、臓器に酸素が届かなくなる危険な状態。血圧低下・冷汗・顔面蒼白などがみられる。',
'アナフィラキシー|anaphylaxis|アナフィラキシー|急激で重いアレルギー反応|薬や食べ物などで、短時間に全身に強いアレルギー症状が出ること。血圧低下を伴うとアナフィラキシーショック。',

/* ---- 治療・手術・処置 ---- */
'PCI|percutaneous coronary intervention|ピーシーアイ|経皮的冠動脈インターベンション|手首や足の付け根からカテーテルを入れ、狭くなった冠動脈をバルーンやステントで広げる治療。',
'CABG|coronary artery bypass grafting|キャベジ|冠動脈バイパス術|自分の血管を使い、狭くなった冠動脈の先へ血液が流れる新しい道をつくる手術。',
'TAVI|transcatheter aortic valve implantation|タビ|経カテーテル大動脈弁留置術|胸を大きく開かずにカテーテルで人工弁を入れる、大動脈弁狭窄症の治療。',
'ECMO|extracorporeal membrane oxygenation|エクモ|体外式膜型人工肺|血液をからだの外に出し、人工肺で酸素を加えて戻す装置。重い呼吸不全や心不全のときに使う。',
'ESD|endoscopic submucosal dissection|イーエスディー|内視鏡的粘膜下層剥離術|内視鏡で早期がんなどの病変を、粘膜の下の層からはがしとる治療。',
'EMR|endoscopic mucosal resection|イーエムアール|内視鏡的粘膜切除術|内視鏡で病変を持ち上げ、ワイヤーの輪をかけて切りとる治療。',
'ERCP|endoscopic retrograde cholangiopancreatography|イーアールシーピー|内視鏡的逆行性胆管膵管造影|内視鏡から胆管や膵管に造影剤を入れて調べる検査。治療にも使い、検査後は膵炎に注意する。',
'TACE|transcatheter arterial chemoembolization|タセ|肝動脈化学塞栓療法|カテーテルで肝臓の動脈に抗がん剤と塞栓物質を入れ、肝細胞がんへの血流を止める治療。',
'HD|hemodialysis|エイチディー|血液透析|機械で血液をからだの外に出し、老廃物や余分な水分を取り除いて戻す治療。多くは週3回行う。',
'CAPD|continuous ambulatory peritoneal dialysis|キャプド|持続携行式腹膜透析|自分の腹膜を使う透析。おなかに入れた透析液を1日数回交換し、自宅で行える。',
'CHDF|continuous hemodiafiltration|シーエイチディーエフ|持続的血液濾過透析|ICUなどで24時間かけてゆっくり行う血液浄化。血圧が不安定な重症患者に使う。',
'GA|①general anesthesia ②gestational age|ジーエー|①全身麻酔 ②在胎週数|①意識をなくし痛みを感じなくする麻酔。②妊娠何週か（何週で生まれたか）を表す。',
'エピ|①epidural anesthesia ②epinephrine|エピ|①硬膜外麻酔 ②エピネフリン（アドレナリン）|①背中から硬膜の外に細い管を入れて麻酔薬を入れる方法。②救急などで使う薬。現場の略し方なので文脈で確認する。',
'PCA|patient-controlled analgesia|ピーシーエー|自己調節鎮痛法|痛いときに患者が自分でボタンを押し、鎮痛薬を追加できる方法。術後の痛みの管理に使う。',
'ルンバール|Lumbalpunktion|ルンバール|腰椎穿刺|ドイツ語由来。腰の骨の間に針を刺して脳脊髄液をとる検査。検査後はしばらく安静にし、頭痛に注意する。',
'THA|total hip arthroplasty|ティーエイチエー|人工股関節全置換術|傷んだ股関節を人工関節に置きかえる手術。術後は脱臼しやすい姿勢をさけるよう指導する。',
'TKA|total knee arthroplasty|ティーケーエー|人工膝関節全置換術|傷んだひざの関節を人工関節に置きかえる手術。変形性膝関節症などで行う。',
'CS|cesarean section|シーエス|帝王切開|おなかと子宮を切って赤ちゃんを取り出す手術。',
'ECT|electroconvulsive therapy|イーシーティー|電気けいれん療法|頭に電気を流して治療する方法。重いうつ病などに使い、現在は麻酔をかけて行う（修正型）。',
'SST|social skills training|エスエスティー|社会生活スキルトレーニング|人づきあいや生活に必要な技能を、ロールプレイなどで練習する方法。精神科のリハビリで使う。',
'ケモ|chemotherapy|ケモ|化学療法（抗がん剤治療）|英語chemotherapyの略。抗がん剤などの薬でがんを治療すること。',

/* ---- 薬 ---- */
'NSAIDs|non-steroidal anti-inflammatory drugs|エヌセイズ|非ステロイド性抗炎症薬|ロキソプロフェンなど、痛み・熱・炎症をおさえる薬。副作用に胃潰瘍や腎障害がある。',
'ACE阻害薬|angiotensin-converting enzyme inhibitor|エースそがいやく|アンジオテンシン変換酵素阻害薬|血圧を上げる物質ができるのをおさえる降圧薬。副作用に空せきがある。',
'ARB|angiotensin II receptor blocker|エーアールビー|アンジオテンシンII受容体拮抗薬|血圧を上げる物質の働きをブロックする降圧薬。ACE阻害薬のような空せきは少ない。',
'Ca拮抗薬|calcium channel blocker|カルシウムきっこうやく|カルシウム拮抗薬|血管を広げて血圧を下げる薬。一部はグレープフルーツジュースで作用が強まるので注意する。',
'β遮断薬|beta blocker|ベータしゃだんやく|ベータ遮断薬|心拍数を下げて心臓の負担を減らす薬。高血圧・狭心症・不整脈などに使い、徐脈に注意する。',
'PPI|proton pump inhibitor|ピーピーアイ|プロトンポンプ阻害薬|胃酸が出るのを強くおさえる薬。胃潰瘍や逆流性食道炎に使う。',
'H2ブロッカー|histamine H2 receptor antagonist|エイチツーブロッカー|H2受容体拮抗薬|ヒスタミンの働きをおさえて胃酸を減らす薬。ファモチジンなど。',
'ステロイド|corticosteroid|ステロイド|副腎皮質ステロイド薬|炎症や免疫をおさえる薬。感染しやすい・血糖が上がるなどの副作用があり、自己判断で急にやめてはいけない。',
'DOAC|direct oral anticoagulant|ドアック|直接経口抗凝固薬|血液を固まりにくくする飲み薬。ワルファリンより食事の制限が少ないが、出血に注意する。',
'ワルファリン|warfarin|ワルファリン|ワルファリン（抗凝固薬）|血栓を防ぐ飲み薬。ビタミンKで効果が弱まるので納豆などをひかえる。PT-INRで量を調整する。',

/* ---- 検査：血液 ---- */
'CBC|complete blood count|シービーシー|全血球計算|赤血球・白血球・血小板の数やヘモグロビンなどを調べる、基本的な血液検査。',
'WBC|white blood cell|ダブリュービーシー|白血球（数）|からだを感染から守る血球。成人はおよそ3500〜9000/μLが目安で、感染や炎症で増える。',
'RBC|red blood cell|アールビーシー|赤血球（数）|全身に酸素を運ぶ血球。少なくなると貧血になる。',
'Hb|hemoglobin|ヘモグロビン|ヘモグロビン（血色素）|赤血球の中で酸素を運ぶたんぱく質。成人男性13g/dL未満、女性12g/dL未満が貧血の目安。',
'Ht|hematocrit|ヘマトクリット|ヘマトクリット|血液の中で赤血球が占める割合（%）。貧血で下がり、脱水で上がる。',
'Plt|platelet|プレートレット|血小板（数）|出血を止める働きをもつ血球。成人はおよそ15万〜35万/μLで、少ないと出血しやすい。',
'CRP|C-reactive protein|シーアールピー|C反応性たんぱく|炎症があると血液中で増えるたんぱく質。基準はおよそ0.3mg/dL以下で、炎症の強さの目安になる。',
'ESR|erythrocyte sedimentation rate|イーエスアール|赤血球沈降速度（赤沈）|赤血球が沈む速さをみる検査。炎症や貧血などで速くなる。',
'Alb|albumin|アルブミン|アルブミン|血液中の主なたんぱく質で栄養状態の目安。3.5g/dL未満は低栄養を疑い、減るとむくみの原因になる。',
'AST|aspartate aminotransferase|エーエスティー|アスパラギン酸アミノトランスフェラーゼ|肝臓・心臓・筋肉などが傷つくと血液中に増える酵素。以前はGOTと呼ばれた。',
'ALT|alanine aminotransferase|エーエルティー|アラニンアミノトランスフェラーゼ|主に肝臓が傷つくと血液中に増える酵素。以前はGPTと呼ばれた。',
'γ-GTP|gamma-glutamyl transpeptidase|ガンマジーティーピー|ガンマグルタミルトランスペプチダーゼ|肝臓や胆道の病気、お酒の飲みすぎで上がる酵素。',
'ALP|alkaline phosphatase|エーエルピー|アルカリホスファターゼ|胆道がつまったときや骨の病気で上がる酵素。成長期の子どもは高めになる。',
'LDH|lactate dehydrogenase|エルディーエイチ|乳酸脱水素酵素|ほぼ全身の細胞にある酵素で、どこかの組織が傷つくと増える。溶血などでも上がる。',
'T-Bil|total bilirubin|ティービル|総ビリルビン|古い赤血球が壊れてできる黄色い色素。増えると黄疸になる。',
'AMY|amylase|アミラーゼ|アミラーゼ|でんぷんを分解する消化酵素。急性膵炎などで血液中の値が上がる。',
'BUN|blood urea nitrogen|ビーユーエヌ|血中尿素窒素|たんぱく質が分解されてできる老廃物。腎機能の低下や脱水で上がる。およそ8〜20mg/dLが目安。',
'Cr|creatinine|クレアチニン|クレアチニン|筋肉でできる老廃物で、腎臓から尿に出される。腎機能が落ちると血液中の値が上がる。',
'eGFR|estimated glomerular filtration rate|イージーエフアール|推算糸球体濾過量|クレアチニン・年齢・性別から計算する腎機能の指標。60未満が3か月以上続くとCKD。',
'Na|sodium|ナトリウム|ナトリウム|からだの水分量の調節にかかわる電解質。基準はおよそ135〜145mEq/L。',
'K|①potassium ②Krebs|ケー|①カリウム ②がん（隠語）|①心臓や筋肉の働きにかかわる電解質で、およそ3.5〜5.0mEq/L。高すぎても低すぎても不整脈の危険。②ドイツ語Krebsから、がんの意味。',
'Cl|chloride|クロール|クロール（塩素）|ナトリウムと一緒に、水分や酸と塩基のバランスにかかわる電解質。およそ98〜108mEq/L。',
'Ca|①calcium ②carcinoma|カルシウム|①カルシウム ②がん（癌腫）|①骨や筋肉・神経の働きにかかわる電解質。②がんのこと。「胃Ca」は胃がんを表す。',
'BS|blood sugar|ビーエス|血糖（値）|血液中のブドウ糖の量。低血糖はおよそ70mg/dL未満で、冷汗・ふるえ・意識障害などが出る。',
'FBS|fasting blood sugar|エフビーエス|空腹時血糖|食事をとらない状態で測った血糖値。110mg/dL未満が正常型、126mg/dL以上は糖尿病型。',
'HbA1c|hemoglobin A1c|ヘモグロビンエーワンシー|ヘモグロビンA1c|過去1〜2か月の平均的な血糖の状態を表す値。6.5%以上は糖尿病型。',
'PT-INR|prothrombin time-international normalized ratio|ピーティーアイエヌアール|プロトロンビン時間国際標準比|血液の固まりやすさの指標。ワルファリンの効き目の確認に使い、値が大きいほど固まりにくい。',
'APTT|activated partial thromboplastin time|エーピーティーティー|活性化部分トロンボプラスチン時間|血液が固まるまでの時間をみる検査。ヘパリンの効き目の確認に使う。',
'D-dimer|D-dimer|ディーダイマー|Dダイマー|血栓がとけるときにできる物質。高いとDVTや肺塞栓症、DICなど血栓の病気を疑う。',
'LDL|low-density lipoprotein cholesterol|エルディーエル|LDLコレステロール（悪玉）|多すぎると動脈硬化を進めるコレステロール。空腹時140mg/dL以上は高LDLコレステロール血症。',
'HDL|high-density lipoprotein cholesterol|エイチディーエル|HDLコレステロール（善玉）|余分なコレステロールを回収する働きがある。40mg/dL未満は低HDLコレステロール血症。',
'TG|triglyceride|ティージー|中性脂肪（トリグリセリド）|エネルギーのたくわえとなる脂肪。空腹時150mg/dL以上は高トリグリセライド血症。',
'UA|①uric acid ②urinalysis ③unstable angina|ユーエー|①尿酸 ②尿検査 ③不安定狭心症|①高いと痛風の原因になる（7.0mg/dL超で高尿酸血症）。②尿の成分を調べる検査。③心筋梗塞に進みやすい狭心症。',
'CK|creatine kinase|シーケー|クレアチンキナーゼ|筋肉に多い酵素。心筋梗塞や筋肉の損傷、激しい運動のあとなどで上がる。',
'BNP|brain natriuretic peptide|ビーエヌピー|脳性ナトリウム利尿ペプチド|心臓に負担がかかると主に心室から出るホルモン。心不全の診断や重さの目安になる。',

/* ---- 検査：生理・画像・内視鏡 ---- */
'ECG|electrocardiogram|イーシージー|心電図|心臓の電気の流れを波形で記録する検査。不整脈や心筋梗塞などがわかる。ドイツ語からEKGとも書く。',
'CTG|cardiotocogram|シーティージー|胎児心拍陣痛図|胎児の心拍と子宮の収縮（陣痛）を同時に記録したもの。分娩監視装置でとる。',
'EEG|electroencephalogram|イーイージー|脳波|脳の電気的な活動を記録する検査。てんかんや意識障害の診断に使う。',
'CT|computed tomography|シーティー|コンピュータ断層撮影|X線を使ってからだの断面の画像を撮る検査。短時間で撮れるので救急でもよく使う。',
'MRI|magnetic resonance imaging|エムアールアイ|磁気共鳴画像|強い磁石と電波で断面の画像を撮る検査。放射線は使わないが、金属やペースメーカーなどの確認が必須。',
'X-P|X-ray photograph|エックスピー|X線撮影（レントゲン）|X線を使った撮影。胸部X-Pは肺の状態や心臓の大きさをみる基本的な検査。',
'US|ultrasonography|ユーエス|超音波検査（エコー）|超音波を当ててからだの中をみる検査。放射線を使わず痛みもないので、妊婦にも使える。',
'UCG|ultrasound cardiography|ユーシージー|心臓超音波検査（心エコー）|心臓の動きや弁の状態を超音波でみる検査。',
'EF|ejection fraction|イーエフ|駆出率|心臓が1回の収縮で送り出す血液の割合。心エコーで測り、左室駆出率が低いほど心臓のポンプの力が弱い。',
'PET|positron emission tomography|ペット|陽電子放出断層撮影|放射性の薬を注射して、がんなど活発に活動する細胞の場所を画像にする検査。',
'GIF|gastrointestinal fiberscopy|ジーアイエフ|上部消化管内視鏡検査（胃カメラ）|口や鼻から内視鏡を入れて、食道・胃・十二指腸をみる検査。検査の前は絶食にする。',
'CF|colonofiberscopy|シーエフ|下部消化管内視鏡検査（大腸カメラ）|肛門から内視鏡を入れて大腸をみる検査。前もって下剤で腸の中をきれいにする。',

/* ---- 病名：循環器・脳神経 ---- */
'HT|hypertension|エイチティー|高血圧（症）|血圧が高い状態が続くこと。診察室で140/90mmHg以上が目安で、脳卒中や心臓病の原因になる。',
'MI|myocardial infarction|エムアイ|心筋梗塞|冠動脈がつまって心筋が壊死する病気。強い胸の痛みが30分以上続くことが多い。',
'AMI|acute myocardial infarction|エーエムアイ|急性心筋梗塞|発症して間もない心筋梗塞。命にかかわるので、できるだけ早くPCIなどで血流を再開させる。',
'AP|angina pectoris|エーピー|狭心症|冠動脈が狭くなり、心筋に一時的に血液が足りなくなる病気。胸の痛みは数分でおさまることが多い。',
'ACS|acute coronary syndrome|エーシーエス|急性冠症候群|不安定狭心症と急性心筋梗塞などをまとめた呼び方。冠動脈の血栓が原因で、緊急の治療が必要。',
'HF|heart failure|エイチエフ|心不全|心臓のポンプの働きが落ち、全身に十分な血液を送れない状態。息切れ・むくみ・体重増加がみられる。',
'CHF|congestive heart failure|シーエイチエフ|うっ血性心不全|心不全で、肺や全身に血液や水分がたまった（うっ血した）状態。起座呼吸やむくみがみられる。',
'Af|atrial fibrillation|エーエフ|心房細動|心房が細かくふるえ、脈が不規則になる不整脈。心房内に血栓ができやすく、脳梗塞の原因になる。',
'AF|①atrial flutter ②atrial fibrillation|エーエフ|①心房粗動 ②心房細動|日本では大文字AFを心房粗動、Afを心房細動と書き分けることが多い。英語の文献ではAFが心房細動なので注意。',
'DVT|deep vein thrombosis|ディーブイティー|深部静脈血栓症|足などの深い静脈に血栓ができる病気。はがれて肺に飛ぶと肺塞栓症になる。術後や長く寝ているときに起こりやすい。',
'PE|①pulmonary embolism ②pleural effusion|ピーイー|①肺塞栓症 ②胸水|①血栓などが肺の動脈につまる病気で、急な息苦しさや胸痛が出る。②胸膜腔にたまった液体。',
'ASO|arteriosclerosis obliterans|エーエスオー|閉塞性動脈硬化症|足の動脈が動脈硬化で狭くなる病気。歩くと足が痛み休むとよくなる（間欠性跛行）。現在はPADと呼ぶことも多い。',
'AAA|abdominal aortic aneurysm|トリプルエー|腹部大動脈瘤|おなかの大動脈がこぶのようにふくらむ病気。破れると命にかかわる。',
'ASD|①autism spectrum disorder ②atrial septal defect|エーエスディー|①自閉スペクトラム症 ②心房中隔欠損症|①対人関係の難しさや強いこだわりなどがみられる発達障害。②左右の心房の間の壁に穴がある先天性心疾患。',
'VSD|ventricular septal defect|ブイエスディー|心室中隔欠損症|左右の心室の間の壁に穴がある先天性心疾患。先天性心疾患のなかで最も多い。',
'CVA|cerebrovascular accident|シーブイエー|脳血管障害（脳卒中）|脳の血管がつまる・破れることで起こる病気の総称。脳梗塞・脳出血・くも膜下出血がある。',
'アポ|Apoplexie|アポ|脳卒中|ドイツ語Apoplexieの略。脳卒中を指す現場の俗語なので、正式な記録や患者の前では使わない。',
'CI|cerebral infarction|シーアイ|脳梗塞|脳の血管がつまり、その先の脳の組織が壊死する病気。発症から早く治療するほど後遺症を減らせる。',
'ICH|intracerebral hemorrhage|アイシーエイチ|脳出血（脳内出血）|脳の中の細い血管が破れて出血する病気。主な原因は高血圧。',
'SAH|subarachnoid hemorrhage|エスエーエイチ|くも膜下出血|多くは脳動脈瘤が破れて起こる出血。「今までにない激しい頭痛」が突然起こるのが特徴。',
'TIA|transient ischemic attack|ティーアイエー|一過性脳虚血発作|脳の血流が一時的に悪くなり、まひなどの症状が出て24時間以内（多くは数分）に消える発作。脳梗塞の前ぶれ。',
'ALS|①amyotrophic lateral sclerosis ②advanced life support|エーエルエス|①筋萎縮性側索硬化症 ②二次救命処置|①運動神経が障害され、全身の筋力が低下していく難病。感覚の障害は起こりにくい。②ACLSと同じ意味。',
'PD|①Parkinson disease ②peritoneal dialysis|ピーディー|①パーキンソン病 ②腹膜透析|①ドパミン不足で、ふるえ・筋のこわばり・動作の遅さ・転びやすさがみられる病気。②自分の腹膜を使う透析。',
'MS|①multiple sclerosis ②mitral stenosis|エムエス|①多発性硬化症 ②僧帽弁狭窄症|①脳や脊髄の神経の覆いが傷つき、症状が良くなったり悪くなったりする病気。②僧帽弁が狭くなる心臓弁膜症。',
'MG|myasthenia gravis|エムジー|重症筋無力症|神経から筋肉への伝わりが悪くなり、疲れやすさやまぶたが下がるなどの症状が出る自己免疫疾患。',
'CP|cerebral palsy|シーピー|脳性まひ|生まれる前後の脳の障害によって起こる、運動や姿勢の障害。',

/* ---- 病名：呼吸・代謝・腎・消化器ほか ---- */
'COPD|chronic obstructive pulmonary disease|シーオーピーディー|慢性閉塞性肺疾患|主に喫煙が原因で、息を吐きにくくなる肺の病気。高い濃度の酸素でCO2がたまることがあるので注意。',
'ARDS|acute respiratory distress syndrome|アーズ|急性呼吸窮迫症候群|肺炎や敗血症などをきっかけに、肺に急に強い炎症が起こる重い呼吸不全。人工呼吸が必要なことが多い。',
'SAS|sleep apnea syndrome|サス|睡眠時無呼吸症候群|眠っている間に呼吸が何度も止まる病気。いびきや昼間の強い眠気がみられ、CPAPで治療する。',
'TB|tuberculosis|ティービー|結核|結核菌による感染症。空気感染するので、陰圧の個室とN95マスクで対応する。ドイツ語読みでテーベーともいう。',
'DM|diabetes mellitus|ディーエム|糖尿病|インスリンの不足や働きの低下で血糖値が高くなる病気。網膜症・腎症・神経障害などの合併症がある。',
'DKA|diabetic ketoacidosis|ディーケーエー|糖尿病ケトアシドーシス|インスリンが極端に足りず、ケトン体がたまって血液が酸性にかたむく状態。1型糖尿病に多い。',
'HHS|hyperosmolar hyperglycemic state|エイチエイチエス|高浸透圧高血糖状態|著しい高血糖と脱水で意識障害などが起こる状態。高齢の2型糖尿病患者に多い。',
'DI|①diabetes insipidus ②drug information|ディーアイ|①尿崩症 ②医薬品情報|①抗利尿ホルモンの不足などで、薄い尿が大量に出る病気。②薬の情報のこと。薬剤部のDI室で調べられる。',
'SIADH|syndrome of inappropriate secretion of antidiuretic hormone|エスアイエーディーエイチ|抗利尿ホルモン不適合分泌症候群|抗利尿ホルモンが出すぎて水分がたまり、血液中のナトリウムが薄くなる（低ナトリウム血症）病気。',
'CKD|chronic kidney disease|シーケーディー|慢性腎臓病|腎臓の障害や腎機能の低下（eGFR60未満）が3か月以上続く状態。進むと透析が必要になる。',
'AKI|acute kidney injury|エーケーアイ|急性腎障害|数時間〜数日で急に腎機能が落ちる状態。尿量の減少やクレアチニンの上昇でわかる。',
'UTI|urinary tract infection|ユーティーアイ|尿路感染症|膀胱炎や腎盂腎炎など、尿の通り道の感染症。尿道カテーテルを入れている人は起こりやすい。',
'BPH|benign prostatic hyperplasia|ビーピーエイチ|前立腺肥大症|高齢男性に多く、前立腺が大きくなって尿が出にくくなる病気。',
'GERD|gastroesophageal reflux disease|ガード|胃食道逆流症|胃酸が食道に逆流して胸やけなどを起こす病気。食後すぐに横にならないよう指導する。',
'IBD|inflammatory bowel disease|アイビーディー|炎症性腸疾患|腸に慢性の炎症が続く病気の総称。主に潰瘍性大腸炎とクローン病。',
'UC|ulcerative colitis|ユーシー|潰瘍性大腸炎|大腸の粘膜に炎症や潰瘍ができる病気。血の混じった下痢やおなかの痛みが続く。',
'CD|①Crohn disease ②Clostridioides difficile|シーディー|①クローン病 ②クロストリディオイデス・ディフィシル|①口から肛門まで消化管のどこにでも炎症が起こる病気。②抗菌薬の使用後などに下痢を起こす菌で、アルコール消毒が効きにくい。',
'イレウス|ileus|イレウス|腸の内容物が先に進まない状態|腹痛・嘔吐・おなかの張り・排便や排ガスの停止がみられる。現在は腸がつまるものを腸閉塞、腸の動きが止まるものをイレウスと分けることが多い。',
'HCC|hepatocellular carcinoma|エイチシーシー|肝細胞がん|肝臓の細胞からできるがん。B型・C型肝炎や肝硬変などが主な原因。',
'DIC|disseminated intravascular coagulation|ディーアイシー|播種性血管内凝固症候群|重い病気をきっかけに全身の血管で小さな血栓ができ、同時に出血しやすくなる危険な状態。',
'RA|①rheumatoid arthritis ②room air ③right atrium|アールエー|①関節リウマチ ②室内気（酸素投与なし） ③右心房|①関節の炎症が続き変形していく自己免疫疾患。②「SpO2 97%（RA）」は酸素なしで測ったという意味。',
'SLE|systemic lupus erythematosus|エスエルイー|全身性エリテマトーデス|若い女性に多い自己免疫疾患。顔の蝶形紅斑、関節痛、腎障害など全身に症状が出る。',
'OA|osteoarthritis|オーエー|変形性関節症|関節の軟骨がすり減り、痛みや変形が起こる病気。ひざ（変形性膝関節症）に多い。',
'AD|①Alzheimer disease ②atopic dermatitis|エーディー|①アルツハイマー病 ②アトピー性皮膚炎|①もの忘れから始まってゆっくり進む、認知症の最も多い原因の病気。②かゆみのある湿疹をくり返す皮膚の病気。',

/* ---- 病名：感染症 ---- */
'AIDS|acquired immunodeficiency syndrome|エイズ|後天性免疫不全症候群|HIV感染で免疫がひどく低下し、ふつうはかからない感染症などを発症した状態。',
'HIV|human immunodeficiency virus|エイチアイブイ|ヒト免疫不全ウイルス|免疫の細胞に感染するウイルス。血液・性行為・母子感染でうつり、治療で発症をおさえられる。',
'HBV|hepatitis B virus|エイチビーブイ|B型肝炎ウイルス|血液や体液でうつる肝炎ウイルス。針刺し事故に注意し、医療者はワクチンを接種する。',
'HCV|hepatitis C virus|エイチシーブイ|C型肝炎ウイルス|主に血液でうつる肝炎ウイルス。慢性肝炎から肝硬変・肝がんに進むことがある。',
'MRSA|methicillin-resistant Staphylococcus aureus|マーサ|メチシリン耐性黄色ブドウ球菌|多くの抗菌薬が効かない黄色ブドウ球菌。院内感染の代表で、接触予防策で広がりを防ぐ。',
'VRE|vancomycin-resistant enterococci|ブイアールイー|バンコマイシン耐性腸球菌|バンコマイシンが効かない腸球菌。接触で広がるので接触予防策をとる。',
'VAP|ventilator-associated pneumonia|バップ|人工呼吸器関連肺炎|気管挿管して48時間以降に起こる肺炎。頭側を30度ほど上げる、口腔ケアなどで予防する。',
'CRBSI|catheter-related bloodstream infection|シーアールビーエスアイ|カテーテル関連血流感染|血管に入れたカテーテルから菌が入って起こる血流感染。刺入部の観察と清潔な管理で防ぐ。',
'SSI|surgical site infection|エスエスアイ|手術部位感染|手術で切った部位や、手術した臓器などに起こる感染。多くは術後30日以内に起こる。',

/* ---- 病名：精神・発達・小児・母性 ---- */
'ADHD|attention-deficit hyperactivity disorder|エーディーエイチディー|注意欠如・多動症|不注意・多動性・衝動性がみられる発達障害。',
'PTSD|post-traumatic stress disorder|ピーティーエスディー|心的外傷後ストレス障害|命にかかわるようなつらい体験のあと、フラッシュバックや悪夢、強い緊張などが続く状態。',
'OCD|obsessive-compulsive disorder|オーシーディー|強迫症（強迫性障害）|やめたくても同じ考えが浮かび、手洗いや確認などをくり返してしまう病気。',
'BPSD|behavioral and psychological symptoms of dementia|ビーピーエスディー|認知症の行動・心理症状|認知症にともなう徘徊・興奮・妄想・抑うつなど。環境やかかわり方で軽くなることがある。',
'MCI|mild cognitive impairment|エムシーアイ|軽度認知障害|もの忘れなどはあるが、日常生活はほぼ自立している状態。認知症の前段階ともいわれる。',
'SIDS|sudden infant death syndrome|シッズ|乳幼児突然死症候群|元気だった乳児が眠っている間に突然亡くなる病気。あおむけに寝かせることが予防につながる。',
'RDS|respiratory distress syndrome|アールディーエス|呼吸窮迫症候群|早産児で肺サーファクタントが足りず、肺がふくらみにくくなる病気。',
'HDP|hypertensive disorders of pregnancy|エイチディーピー|妊娠高血圧症候群|妊娠中に血圧が140/90mmHg以上になる病気。母体と胎児の両方に危険があり、以前はPIHと呼んだ。',
'PIH|pregnancy-induced hypertension|ピーアイエイチ|妊娠高血圧症候群（旧名称）|妊娠中に高血圧になる病気の以前の呼び名。現在はHDPという。',
'GDM|gestational diabetes mellitus|ジーディーエム|妊娠糖尿病|妊娠中に初めて見つかった、糖尿病にいたらない糖代謝の異常。巨大児などの原因になる。',
'PROM|premature rupture of the membranes|プロム|前期破水|陣痛が始まる前に卵膜が破れて羊水が流れ出ること。感染に注意する。',
'PPROM|preterm premature rupture of the membranes|ピープロム|早産期の前期破水|妊娠37週未満に起こる前期破水。早産や感染の危険が高い。',

/* ---- 感染対策・医療制度 ---- */
'スタンダードプリコーション|standard precautions|スタンダードプリコーション|標準予防策|すべての患者の血液・体液・排泄物・粘膜・傷のある皮膚を、感染の可能性があるものとして扱う考え方。',
'手指衛生|hand hygiene|しゅしえいせい|手洗いと手指消毒|感染対策の最も基本の行動。WHOは患者にふれる前後など5つのタイミングで行うよう示している。',
'PPE|personal protective equipment|ピーピーイー|個人防護具|手袋・マスク・ガウン・ゴーグルなど、感染から身を守る道具。外すときに自分を汚染しない順番が大切。',
'N95|N95 respirator|エヌきゅうじゅうご|N95マスク|細かい粒子を95%以上とめる医療用マスク。結核・麻しん・水痘など空気感染する病気で使い、着けるたびに密着を確認する。',
'CDC|Centers for Disease Control and Prevention|シーディーシー|米国疾病予防管理センター|アメリカの感染症対策の機関。感染対策のガイドラインが日本でも広く参考にされている。',
'WHO|World Health Organization|ダブリューエイチオー|世界保健機関|世界の人々の健康を守るための国連の専門機関。健康の定義や感染症対策などを示している。',
'DPC|Diagnosis Procedure Combination|ディーピーシー|診断群分類（包括評価）|病名と治療の組み合わせで入院1日あたりの医療費を決める、日本の急性期病院の支払い方式。',

/* ---- 看護でよく使う言葉 ---- */
'起座呼吸|orthopnea|きざこきゅう|座ると楽になる呼吸困難|横になると息苦しく、上半身を起こすと楽になる状態。心不全でよくみられる。',
'喘鳴|wheeze|ぜんめい|ゼーゼー・ヒューヒューという呼吸音|気道が狭くなったときに聞こえる音。喘息やCOPDなどでみられる。',
'チアノーゼ|cyanosis|チアノーゼ|皮膚や粘膜が青紫色になること|血液中の酸素が足りないときなどに、唇や爪などが青紫色になる状態。',
'黄疸|jaundice|おうだん|皮膚や白目が黄色くなること|血液中のビリルビンが増えて、皮膚や眼球結膜が黄色くなる状態。肝臓や胆道の病気でみられる。',
'浮腫|edema|ふしゅ|むくみ|からだの組織に水分がたまった状態。すねなどを指でおして、くぼみが残るかで確かめる。',
'脱水|dehydration|だっすい|からだの水分が足りないこと|からだの水分が不足した状態。口の渇き・尿量の減少・皮膚の張りの低下などがみられ、高齢者や子どもは起こりやすい。',
'褥瘡|pressure ulcer|じょくそう|床ずれ|同じ場所が長く圧迫されて血流が悪くなり、皮膚や組織が傷つくこと。仙骨部やかかとなど骨の出た所にできやすい。',
'デクビ|Dekubitus|デクビ|褥瘡（床ずれ）|ドイツ語Dekubitusの略で、褥瘡のこと。現場の俗語なので、正式な記録では「褥瘡」と書く。',
'せん妄|delirium|せんもう|急に起こる意識の混乱|急に起こる一時的な意識障害。時や場所がわからない、興奮する、幻覚などがみられ、夜に悪くなりやすい。',
'誤嚥|aspiration|ごえん|食べ物などが気管に入ること|食べ物・唾液・胃の内容物が誤って気管に入ること。誤嚥性肺炎の原因になる。',
'嚥下|swallowing|えんげ|飲みこむこと|食べ物や水分を口からのど・食道を通して胃へ送ること。高齢者や脳卒中のあとは障害されやすい。',
'失禁|incontinence|しっきん|尿や便をもらすこと|自分の意思と関係なく尿や便が出てしまうこと。皮膚トラブルの予防と、自尊心への配慮が大切。',
'拘縮|contracture|こうしゅく|関節が固まって動きにくくなること|関節を動かさないでいると周りの組織がかたくなり、動く範囲がせまくなる状態。ROM訓練で予防する。',
'廃用症候群|disuse syndrome|はいようしょうこうぐん|動かないことで起こる心身の衰え|長く安静にしていることで起こる筋力低下・関節拘縮・褥瘡・意欲の低下など。生活不活発病ともいう。',
'離床|getting out of bed|りしょう|ベッドから離れること|ベッドから起き上がって座ったり歩いたりすること。早めの離床は合併症の予防につながる。',
'清拭|bed bath|せいしき|からだをふくこと|入浴できない患者のからだを、お湯でしぼったタオルなどでふいて清潔にする援助。皮膚を観察する機会にもなる。',
'口腔ケア|oral care|こうくうケア|口の中を清潔にするケア|歯みがきなどで口の中を清潔に保つこと。誤嚥性肺炎の予防にもつながる。',
'体位変換|position change|たいいへんかん|からだの向きを変えること|自分で動けない患者の体位を変えること。褥瘡や肺炎の予防のため、一般に2時間ごとが目安（マットレスにより変わる）。',
'ギャッチアップ|head-of-bed elevation|ギャッチアップ|ベッドの頭側を上げること|ベッドの背を上げて上半身を起こすこと。和製英語で、ギャッチはベッドを考案した医師の名前から。',
'仰臥位|supine position|ぎょうがい|あおむけ|顔を上に向けて寝た体位。背臥位ともいい、最も安定した体位。',
'側臥位|lateral position|そくがい|横向き|からだを横に向けて寝た体位。右側が下なら右側臥位という。',
'腹臥位|prone position|ふくがい|うつぶせ|おなかを下にして寝た体位。重い呼吸不全の治療で使うこともある。',
'ファウラー位|Fowler position|ファウラーい|半座位|あおむけで上半身を45度くらい起こした体位。呼吸が楽になり、食事の姿勢にも使う。',
'セミファウラー位|semi-Fowler position|セミファウラーい|上半身を少し起こした体位|上半身を15〜30度くらい起こした体位。腹部の緊張がゆるみ、呼吸も楽になる。',
'端座位|sitting on the edge of the bed|たんざい|ベッドのはしに腰かけた姿勢|ベッドのはしに座り、足を床におろした姿勢。起き上がりや離床の練習で使う。',
'シムス位|Sims position|シムスい|半腹臥位|横向きから少しうつぶせにした体位。浣腸（左シムス位）や肛門の診察などで使う。',
'トレンデレンブルグ位|Trendelenburg position|トレンデレンブルグい|骨盤高位|あおむけで頭を低く、骨盤を高くした体位。下腹部や骨盤内の手術などで使う。',
'インシデント|incident|インシデント|患者への影響がないか小さかった出来事|まちがいや思わぬ出来事が起きたが、患者に被害がなかった、または軽かったもの。報告して再発防止に役立てる。',
'アクシデント|accident|アクシデント|医療事故|医療の中で患者に被害が出てしまった出来事。インシデントより患者への影響が大きいもの。',
'ヒヤリハット|near miss|ヒヤリハット|ヒヤッとしたりハッとした出来事|まちがいに気づいて防げた、または患者に害がなかった出来事。インシデントとほぼ同じ意味で使われる。',

/* ---- 現場の俗語（正式な場では使わない） ---- */
'ステルベン|Sterben|ステルベン|死亡|ドイツ語で「死ぬこと」。患者が亡くなったことを指す現場の言葉で、正式な記録では「死亡」と書く。',
'ステる|sterben|ステル|死亡する|ステルベンを動詞にした俗語。患者や家族に聞こえるところや正式な場では使わない。',
'エント|Entlassung|エント|退院|ドイツ語Entlassungの略。「明日エント」のように使う俗語なので、正式な場では「退院」という。',
'エッセン|Essen|エッセン|食事|ドイツ語で「食事」。「エッセン介助」のように使う現場の言葉で、正式な記録では「食事」と書く。',
'ネーベン|Nebenwirkung|ネーベン|副作用|ドイツ語Nebenwirkungの略。薬の副作用を指す俗語で、正式な場では「副作用」という。',
'クランケ|Kranke|クランケ|患者|ドイツ語で「病人」。患者を指す古い現場の言葉で、今はあまり使わない。',
'ハルン|Harn|ハルン|尿|ドイツ語で「尿」。現場の言葉なので、正式な記録では「尿」と書く。',
'マーゲン|Magen|マーゲン|胃|ドイツ語で「胃」。「マーゲンチューブ」は胃管のこと。現場の言葉なので正式な記録では使わない。',
'ゼク|Sektion|ゼク|病理解剖（剖検）|ドイツ語Sektionの略。亡くなった患者の死因などを調べるために行う解剖。'
];

var KQ_LABS = [
/* '分類|項目名|略号|基準値|単位|ひとこと' */
'血算|白血球数|WBC|3,300〜8,600|/μL|ふえると感染・炎症、へると感染しやすい。',
'血算|赤血球数（男性）|RBC|435〜555|万/μL|へると貧血、ふえると多血症や脱水を考える。',
'血算|赤血球数（女性）|RBC|386〜492|万/μL|へると貧血、ふえると多血症や脱水を考える。',
'血算|ヘモグロビン（男性）|Hb|13.7〜16.8|g/dL|へると貧血。',
'血算|ヘモグロビン（女性）|Hb|11.6〜14.8|g/dL|へると貧血。めまい・息切れ・転倒に注意する。',
'血算|ヘマトクリット（男性）|Ht|40.7〜50.1|%|血液中の赤血球の割合。脱水で高くなる。',
'血算|ヘマトクリット（女性）|Ht|35.1〜44.4|%|血液中の赤血球の割合。脱水で高くなる。',
'血算|平均赤血球容積|MCV|83.6〜98.2|fL|低いと小球性（鉄欠乏性）、高いと大球性（ビタミンB12・葉酸欠乏）貧血。',
'血算|平均赤血球ヘモグロビン量|MCH|27.5〜33.2|pg|低いと低色素性貧血（鉄欠乏性貧血など）を考える。',
'血算|平均赤血球ヘモグロビン濃度|MCHC|31.7〜35.3|g/dL|低いと低色素性貧血を考える。',
'血算|血小板数|Plt|15.8〜34.8|万/μL|5万未満で出血しやすく、2万未満では自然出血に注意。',
'血算|網赤血球|Ret|0.5〜2.0|%|骨髄が赤血球をつくる力の目安。資料で少しちがう。',
'血算|好中球（白血球分画）|Neut|40〜75|%|細菌感染でふえる。好中球数500/μL未満は感染の危険が高い。',
'血算|リンパ球（白血球分画）|Lymph|20〜45|%|ウイルス感染でふえることがある。資料で少しちがう。',
'血算|好酸球（白血球分画）|Eosino|1〜5|%|アレルギーや寄生虫感染でふえる。資料で少しちがう。',
'たんぱく・栄養|総たんぱく|TP|6.6〜8.1|g/dL|低いと低栄養・肝障害・ネフローゼ症候群を考える。',
'たんぱく・栄養|アルブミン|Alb|4.1〜5.1|g/dL|3.5未満は低栄養の目安。低いとむくみやすい。',
'たんぱく・栄養|A/G比|A/G|1.32〜2.23||低いと肝硬変や慢性炎症、ネフローゼ症候群を考える。',
'たんぱく・栄養|コリンエステラーゼ（男性）|ChE|240〜486|U/L|肝臓でつくられる。低いと肝機能低下・低栄養・有機リン中毒。',
'たんぱく・栄養|コリンエステラーゼ（女性）|ChE|201〜421|U/L|低いと肝機能低下や低栄養、高いと脂肪肝・ネフローゼを考える。',
'たんぱく・栄養|プレアルブミン（トランスサイレチン）|TTR|22〜40|mg/dL|半減期が約2日と短く、最近の栄養状態をみるのに使う。',
'たんぱく・栄養|血清鉄|Fe|40〜188|μg/dL|低いと鉄欠乏性貧血を考える。朝に高く夕方に低い。',
'電解質|ナトリウム|Na|138〜145|mEq/L|低いと意識障害・けいれん、高いと脱水を考える。資料で少しちがう。',
'電解質|カリウム|K|3.6〜4.8|mEq/L|高くても低くても不整脈が起きる。溶血で見かけ上高くなる。',
'電解質|クロール|Cl|101〜108|mEq/L|ふつうNaと同じ向きに動く。嘔吐が続くと低くなる。',
'電解質|カルシウム|Ca|8.8〜10.1|mg/dL|低いとテタニー・しびれ、高いと意識障害・多尿。低Albでは補正する。',
'電解質|無機リン|IP|2.7〜4.6|mg/dL|腎不全で高く、リフィーディング症候群で低くなる。',
'電解質|マグネシウム|Mg|1.8〜2.4|mg/dL|低いと不整脈、高いと脱力・徐脈。資料で少しちがう。',
'腎機能|尿素窒素|BUN|8〜20|mg/dL|腎機能低下、脱水、消化管出血、高たんぱく食で高くなる。',
'腎機能|クレアチニン（男性）|Cr|0.65〜1.07|mg/dL|腎機能が落ちると高くなる。筋肉量が多いと高め。',
'腎機能|クレアチニン（女性）|Cr|0.46〜0.79|mg/dL|腎機能が落ちると高くなる。筋肉の少ない高齢者は低めに出る。',
'腎機能|推算糸球体ろ過量|eGFR|60以上|mL/分/1.73m2|60未満が3か月以上続くと慢性腎臓病（CKD）。90以上が正常。',
'腎機能|尿酸（男性）|UA|3.7〜7.8|mg/dL|7.0を超えると高尿酸血症。痛風・尿路結石の原因になる。',
'腎機能|尿酸（女性）|UA|2.6〜5.5|mg/dL|男女とも7.0を超えると高尿酸血症とする。',
'肝・胆・膵|AST（GOT）|AST|13〜30|U/L|肝臓のほか、心筋や骨格筋がこわれても上がる。',
'肝・胆・膵|ALT（GPT）（男性）|ALT|10〜42|U/L|主に肝臓にあり、肝細胞の障害で上がる。',
'肝・胆・膵|ALT（GPT）（女性）|ALT|7〜23|U/L|主に肝臓にあり、肝細胞の障害で上がる。',
'肝・胆・膵|γ-グルタミルトランスフェラーゼ（男性）|γ-GTP|13〜64|U/L|飲酒や胆汁うっ滞、脂肪肝で上がる。',
'肝・胆・膵|γ-グルタミルトランスフェラーゼ（女性）|γ-GTP|9〜32|U/L|飲酒や胆汁うっ滞、脂肪肝で上がる。',
'肝・胆・膵|アルカリホスファターゼ|ALP|38〜113|U/L|胆汁うっ滞や骨の病気で上がる。2020年から測定法が変わり値も変わった。',
'肝・胆・膵|乳酸脱水素酵素|LD（LDH）|124〜222|U/L|肝臓・心筋・赤血球など多くの組織の障害や、がんで上がる。',
'肝・胆・膵|総ビリルビン|T-Bil|0.4〜1.5|mg/dL|2〜3を超えると皮膚や白目が黄色くなる（黄疸）。',
'肝・胆・膵|直接ビリルビン|D-Bil|0.0〜0.3|mg/dL|高いと胆道の閉塞や肝障害を考える。資料で少しちがう。',
'肝・胆・膵|アミラーゼ|AMY|44〜132|U/L|急性膵炎や耳下腺炎で上がる。',
'肝・胆・膵|クレアチンキナーゼ（男性）|CK|59〜248|U/L|心筋梗塞、横紋筋融解症、悪性症候群、激しい運動で上がる。',
'肝・胆・膵|クレアチンキナーゼ（女性）|CK|41〜153|U/L|心筋梗塞、筋肉の障害、筋肉注射のあとでも上がる。',
'脂質|総コレステロール|TC|142〜248|mg/dL|脂質異常症の診断にはLDL-Cなどを使う。資料で少しちがう。',
'脂質|LDLコレステロール|LDL-C|140未満|mg/dL|140以上は高LDLコレステロール血症、120〜139は境界域。',
'脂質|HDLコレステロール|HDL-C|40以上|mg/dL|40未満は低HDLコレステロール血症。いわゆる善玉コレステロール。',
'脂質|中性脂肪（空腹時）|TG|150未満|mg/dL|空腹時150以上は高トリグリセライド血症。随時採血では175以上。',
'脂質|non-HDLコレステロール|non-HDL-C|170未満|mg/dL|総コレステロールからHDL-Cを引いた値。150〜169は境界域。',
'糖代謝|空腹時血糖|FPG|73〜109|mg/dL|126以上は糖尿病型。110未満が正常型。',
'糖代謝|HbA1c|HbA1c|4.9〜6.0|%|過去1〜2か月の血糖の平均を反映する。6.5以上は糖尿病型。',
'糖代謝|HbA1c（合併症予防のための目標）|HbA1c|7.0未満|%|日本糖尿病学会の血糖コントロール目標。高齢者は個別に決める。',
'糖代謝|75gOGTT 2時間値（正常型）||140未満|mg/dL|200以上は糖尿病型。正常型でも糖尿病型でもなければ境界型。',
'糖代謝|グリコアルブミン|GA|11〜16|%|過去約2週間の血糖の平均を反映する。',
'糖代謝|低血糖の目安||70未満|mg/dL|冷汗・動悸・手のふるえ・意識障害。すぐにブドウ糖をとる。',
'凝固|プロトロンビン時間|PT|10〜12|秒|肝障害やワルファリンで延びる。資料で少しちがう。',
'凝固|プロトロンビン時間（活性）|PT%|70〜130|%|低いと凝固因子が足りず出血しやすい。資料で少しちがう。',
'凝固|PT-INR|PT-INR|0.9〜1.1||ワルファリンの効き目をみる指標。高いほど出血しやすい。',
'凝固|PT-INR（ワルファリン治療の目標）|PT-INR|2.0〜3.0||70歳以上の非弁膜症性心房細動では1.6〜2.6が目安。',
'凝固|活性化部分トロンボプラスチン時間|APTT|25〜40|秒|ヘパリンの効き目をみる。血友病で延びる。資料で少しちがう。',
'凝固|フィブリノゲン|Fib|200〜400|mg/dL|低いとDICや重い肝障害、高いと炎症や妊娠を考える。',
'凝固|フィブリン・フィブリノゲン分解産物|FDP|5.0未満|μg/mL|血栓がとけるとふえる。DICで高くなる。',
'凝固|D-ダイマー|D-dimer|1.0未満|μg/mL|高いと深部静脈血栓症・肺塞栓症・DICを考える。資料で少しちがう。',
'炎症・免疫|C反応性たんぱく|CRP|0.14以下|mg/dL|炎症や細菌感染で上がる。0.3以下とする資料もある。',
'炎症・免疫|赤血球沈降速度（男性）|ESR|2〜10|mm/1時間|炎症・貧血・高グロブリン血症で速くなる。',
'炎症・免疫|赤血球沈降速度（女性）|ESR|3〜15|mm/1時間|炎症・貧血・妊娠で速くなる。',
'炎症・免疫|免疫グロブリンG|IgG|861〜1,747|mg/dL|血中に最も多い抗体で、胎盤を通る。',
'炎症・免疫|免疫グロブリンA|IgA|93〜393|mg/dL|粘膜を守る抗体。初乳に多くふくまれる。',
'炎症・免疫|免疫グロブリンM（男性）|IgM|33〜183|mg/dL|感染のはじめに最初にふえる抗体。',
'炎症・免疫|免疫グロブリンM（女性）|IgM|50〜269|mg/dL|感染のはじめに最初にふえる抗体。',
'炎症・免疫|補体C3|C3|73〜138|mg/dL|全身性エリテマトーデス（SLE）の活動期に低くなる。',
'炎症・免疫|補体C4|C4|11〜31|mg/dL|SLEなどで補体が使われると低くなる。',
'血液ガス|pH（動脈血）|pH|7.35〜7.45||7.35未満はアシデミア、7.45を超えるとアルカレミア。',
'血液ガス|動脈血酸素分圧|PaO2|80〜100|Torr|60以下は呼吸不全。高齢者は低めになる。',
'血液ガス|動脈血二酸化炭素分圧|PaCO2|35〜45|Torr|45を超えると換気不足（呼吸性アシドーシス）を考える。',
'血液ガス|重炭酸イオン|HCO3−|22〜26|mEq/L|低いと代謝性アシドーシス、高いと代謝性アルカローシス。',
'血液ガス|塩基過剰|BE|-2〜+2|mEq/L|マイナスは代謝性アシドーシス、プラスは代謝性アルカローシス。',
'血液ガス|動脈血酸素飽和度|SaO2|95〜98|%|動脈血のヘモグロビンが酸素と結びついている割合。資料で少しちがう。',
'血液ガス|経皮的動脈血酸素飽和度|SpO2|96〜99|%|90未満はPaO2 60Torr未満にあたり、呼吸不全の目安。',
'血液ガス|アニオンギャップ|AG|10〜14|mEq/L|Na−（Cl＋HCO3−）。高いとケトアシドーシスなどを考える。',
'血液ガス|乳酸|Lac|2.0未満|mmol/L|高いとショックや組織の酸素不足を考える。',
'尿|1日尿量（成人）||1,000〜1,500|mL/日|へると脱水や腎障害、ふえると糖尿病や尿崩症を考える。',
'尿|乏尿||400以下|mL/日|脱水・ショックなどの腎前性や、腎障害を考えて報告する。',
'尿|無尿||100以下|mL/日|腎不全を考える。膀胱にたまって出ない尿閉とは区別する。',
'尿|多尿||2,500以上|mL/日|糖尿病・尿崩症・利尿薬で起こる。3,000以上とする資料もある。',
'尿|1回尿量||200〜300|mL|膀胱に150〜200mLたまると尿意を感じる。資料で少しちがう。',
'尿|排尿回数||5〜7|回/日|1日8回以上は頻尿の目安。資料で少しちがう。',
'尿|残尿量||50以下|mL|多いと尿路感染の原因になる。資料で少しちがう。',
'尿|尿比重||1.005〜1.030||ふだんは1.015〜1.025。高いと脱水、低いと尿崩症などを考える。',
'尿|尿pH||4.5〜7.5||ふだんは6.0前後の弱酸性。資料で少しちがう。',
'尿|尿たんぱく（定性）||陰性（−）||陽性なら腎炎・ネフローゼ症候群を考える。運動後に一時的に出ることもある。',
'尿|尿糖（定性）||陰性（−）||血糖が約160〜180mg/dLを超えると出る。SGLT2阻害薬でも陽性。',
'尿|尿潜血（定性）||陰性（−）||陽性なら腎・尿路の出血を考える。月経血の混入に注意。',
'尿|尿ケトン体（定性）||陰性（−）||糖尿病のコントロール不良、飢餓、嘔吐が続くと陽性になる。',
'尿|尿ウロビリノーゲン（定性）||弱陽性（±）||陰性なら胆道の閉塞、強陽性なら肝障害や溶血を考える。',
'尿|尿ビリルビン（定性）||陰性（−）||陽性なら肝障害や胆道の閉塞を考える。',
'尿|尿沈渣（赤血球）||4以下|個/HPF|多いと腎・尿路の出血を考える。',
'尿|尿沈渣（白血球）||4以下|個/HPF|多いと尿路感染症を考える。',
'バイタル（成人）|体温（腋窩）||36.0〜37.0|℃|37.0〜37.9は微熱、38.0〜38.9は中等度熱、39.0以上は高熱。',
'バイタル（成人）|脈拍||60〜100|回/分|100以上は頻脈、60未満は徐脈。60〜80とする資料もある。',
'バイタル（成人）|呼吸数||12〜20|回/分|25回/分以上は頻呼吸。',
'バイタル（成人）|正常血圧（診察室）||120未満/80未満|mmHg|収縮期120未満かつ拡張期80未満（日本高血圧学会）。',
'バイタル（成人）|正常高値血圧（診察室）||120〜129/80未満|mmHg|正常より少し高い。生活習慣の見直しをすすめる。',
'バイタル（成人）|高値血圧（診察室）||130〜139/80〜89|mmHg|収縮期・拡張期のどちらかが当てはまれば高値血圧。',
'バイタル（成人）|高血圧（診察室）||140以上/90以上|mmHg|収縮期140以上または拡張期90以上で高血圧。',
'バイタル（成人）|高血圧（家庭血圧）||135以上/85以上|mmHg|家庭血圧は診察室より5mmHg低い基準で判断する。',
'バイタル（成人）|平均血圧|MAP|70〜100|mmHg|拡張期血圧＋脈圧÷3。65未満は臓器の血流不足に注意。',
'バイタル（高齢者）|体温||36.0前後|℃|成人よりやや低め。感染しても熱が出にくいので、ふだんの値と比べる。',
'バイタル（高齢者）|脈拍||60〜80|回/分|成人よりやや少なめで、不整脈がふえる。資料で少しちがう。',
'バイタル（高齢者）|呼吸数||12〜20|回/分|成人とほぼ同じ。肺炎でも症状が目立たないことがある。',
'バイタル（高齢者）|血圧（特徴）||収縮期が上がりやすい|mmHg|動脈硬化で収縮期が上がり拡張期は下がりやすく、脈圧が大きくなる。',
'バイタル（高齢者）|起立性低血圧||収縮期20以上または拡張期10以上の低下|mmHg|立って3分以内に下がる。めまい・転倒に注意する。',
'バイタル（高齢者）|動脈血酸素分圧の目安|PaO2|100-0.4×年齢|Torr|年をとるとPaO2は少しずつ下がる。資料で少しちがう。',
'バイタル（小児）|体温（乳幼児）||36.5〜37.5|℃|成人より高め。まわりの温度の影響を受けやすい。',
'バイタル（小児）|脈拍（乳児）||110〜130|回/分|泣いたり動いたりすると速くなる。安静時に測る。資料で少しちがう。',
'バイタル（小児）|脈拍（幼児）||90〜110|回/分|年齢が上がるほど少なくなる。資料で少しちがう。',
'バイタル（小児）|脈拍（学童）||80〜90|回/分|年齢が上がるほど成人に近づく。資料で少しちがう。',
'バイタル（小児）|呼吸数（乳児）||30〜40|回/分|乳児は腹式呼吸。眠っているときに測る。',
'バイタル（小児）|呼吸数（幼児）||20〜30|回/分|幼児は胸腹式呼吸。資料で少しちがう。',
'バイタル（小児）|呼吸数（学童）||18〜20|回/分|7歳ごろから胸式呼吸になる。資料で少しちがう。',
'バイタル（小児）|血圧（乳児）||80〜90/60|mmHg|体格に合ったマンシェット（腕の2/3をおおう幅）で測る。',
'バイタル（小児）|血圧（幼児）||90〜100/60〜65|mmHg|年齢が上がるほど高くなる。資料で少しちがう。',
'バイタル（小児）|血圧（学童）||100〜110/60〜70|mmHg|年齢が上がるほど成人に近づく。資料で少しちがう。',
'バイタル（新生児）|体温（腋窩）||36.5〜37.5|℃|体温調節が未熟。低体温にならないよう保温する。',
'バイタル（新生児）|心拍数||120〜140|回/分|泣くと速くなる。120〜160とする資料もある。',
'バイタル（新生児）|呼吸数||40〜50|回/分|腹式呼吸で不規則。60回/分以上は多呼吸。',
'バイタル（新生児）|血圧（収縮期）||60〜80|mmHg|資料で少しちがう。',
'バイタル（新生児）|出生体重||2,500以上4,000未満|g|2,500未満は低出生体重児、4,000以上は高出生体重児。',
'バイタル（新生児）|生理的体重減少||出生体重の5〜10|%|生後3〜5日ごろ最も減り、7〜10日ごろ出生体重に戻る。',
'バイタル（新生児）|血糖||40以上|mg/dL|40未満は新生児低血糖。50未満とする資料もある。',
'バイタル（新生児）|アプガースコア（1分・5分）||7〜10|点|4〜6点は軽症仮死、0〜3点は重症仮死。',
'バイタル（新生児）|生理的黄疸のピーク||生後4〜5日||生後2〜3日に出る。生後24時間以内に出る黄疸は病的。',
'バイタル（新生児）|初回の排尿・胎便||生後24時間以内||胎便は黒緑色で粘り気がある。出ないときは報告する。',
'そのほか|BMI（普通体重）|BMI|18.5以上25未満|kg/m2|体重(kg)÷身長(m)÷身長(m)。25以上は肥満、18.5未満は低体重。',
'そのほか|意識レベル（JCS）|JCS|0||0は意識清明。I桁は刺激なしで覚醒、III桁は刺激しても覚醒しない。',
'そのほか|意識レベル（GCS）|GCS|15|点|開眼・言語・運動の合計。最低は3点で、8点以下は重症。',
'そのほか|中心静脈圧|CVP|5〜10|cmH2O|高いと心不全・輸液過剰、低いと循環血液量の不足を考える。',
'そのほか|頭蓋内圧|ICP|5〜15|mmHg|20mmHg以上が続くと頭蓋内圧亢進。資料で少しちがう。',
'そのほか|髄液圧（側臥位）||70〜180|mmH2O|腰椎穿刺で測る。高いと頭蓋内圧亢進を考える。資料で少しちがう。',
'そのほか|腹囲（メタボリックシンドロームの基準）||男性85以上・女性90以上|cm|へその高さで測る。内臓脂肪型肥満の目安。',
'そのほか|眼圧|IOP|10〜21|mmHg|高いと緑内障を考える。眼圧が正常の緑内障もある。',
'そのほか|心胸郭比|CTR|50以下|%|胸部X線で心臓の幅÷胸郭の幅。50を超えると心拡大。',
'そのほか|心電図のPQ（PR）時間||0.12〜0.20|秒|0.20秒を超えると1度房室ブロックを考える。',
'そのほか|心電図のQRS幅||0.10以下|秒|0.12秒以上は脚ブロックなど心室内の伝導障害を考える。',
'そのほか|血漿浸透圧|Posm|275〜290|mOsm/kg|高いと脱水・高血糖、低いと低ナトリウム血症を考える。',
'そのほか|不感蒸泄（成人）||約900|mL/日|皮膚と呼吸から失われる水分。体温が1℃上がると約15%ふえる。',
'そのほか|大泉門の閉鎖||1歳6か月ごろ||ふくらむと頭蓋内圧亢進、へこむと脱水を考える。'
];

var KQ_DRUGS = [
/* '分類|グループ名|代表的な薬（一般名）|はたらき|主な副作用|看護で気をつけること|ハイリスク(1か0)' */
'降圧薬|カルシウム拮抗薬|アムロジピン、ニフェジピン|血管の平滑筋をゆるめて血管を広げ、血圧を下げる。|頭痛、顔のほてり、動悸、下肢のむくみ、歯肉増殖|グレープフルーツジュースで作用が強まることがある。立ちくらみ・転倒に注意。|0',
'降圧薬|ACE阻害薬|エナラプリル、イミダプリル、カプトプリル|アンジオテンシンIIができるのをおさえて血管を広げ、血圧を下げる。|空咳、高カリウム血症、血管浮腫|空咳はブラジキニンがふえるために起こる。妊婦には使わない。顔や舌のはれはすぐ報告する。|0',
'降圧薬|ARB（アンジオテンシンII受容体拮抗薬）|カンデサルタン、オルメサルタン、テルミサルタン、バルサルタン|アンジオテンシンIIが受容体に結合するのをじゃまして血管を広げ、血圧を下げる。|高カリウム血症、めまい、腎機能の悪化|空咳は少ない。妊婦には使わない。血清Kと腎機能の値を確認する。|0',
'降圧薬|β遮断薬|ビソプロロール、カルベジロール、メトプロロール、プロプラノロール|心臓のβ1受容体をふさいで心拍数と収縮力を下げ、血圧を下げる。|徐脈、心不全の悪化、気管支けいれん、低血糖の症状が隠れる|気管支喘息の人には原則使わない。脈拍を測り、急にやめない（狭心症や頻脈が起きやすい）。|0',
'降圧薬|α1遮断薬|ドキサゾシン、プラゾシン|血管のα1受容体をふさいで血管を広げ、血圧を下げる。|起立性低血圧、めまい、動悸|飲みはじめに起立性低血圧が起きやすい。ゆっくり起き上がるよう伝える。|0',
'利尿薬|ループ利尿薬|フロセミド、アゾセミド、トラセミド|ヘンレ係蹄の上行脚でNaとClの再吸収をおさえ、強い利尿作用を示す。|低カリウム血症、脱水、低血圧、高尿酸血症、難聴（大量静注時）|体重・尿量・血清Kを確認する。夜間のトイレを避けるため朝に飲む。低K血症はジギタリス中毒を起こしやすくする。|0',
'利尿薬|サイアザイド系利尿薬|ヒドロクロロチアジド、トリクロルメチアジド、インダパミド（類似薬）|遠位尿細管でNaの再吸収をおさえて尿をふやし、血圧を下げる。|低カリウム血症、低ナトリウム血症、高血糖、高尿酸血症、光線過敏症|高血圧の治療によく使う。血清K・Na、血糖、尿酸を確認する。|0',
'利尿薬|カリウム保持性利尿薬|スピロノラクトン、エプレレノン|アルドステロンのはたらきをじゃまして、Kを保ちながら尿をふやす。|高カリウム血症、女性化乳房（スピロノラクトン）|K製剤やACE阻害薬・ARBとの併用で高K血症に注意。テント状T波などの心電図変化をみる。|0',
'利尿薬|浸透圧利尿薬|D-マンニトール、濃グリセリン|血液の浸透圧を上げて組織の水を血管に引きこみ、尿をふやす。頭蓋内圧や眼圧を下げる。|脱水、電解質異常、心不全の悪化|頭蓋内圧亢進に点滴で使う。マンニトールは冷えると結晶が出るので確認する。水分出納をみる。|0',
'利尿薬|バソプレシンV2受容体拮抗薬|トルバプタン|腎臓の集合管でバソプレシンのはたらきをじゃまし、水だけを尿に出す。|高ナトリウム血症、口渇、肝機能障害|入院して始める。血清Naを頻回に確認し、のどが渇いたら水を飲めるようにする。|0',
'抗凝固薬・抗血小板薬|ワルファリン|ワルファリンカリウム|ビタミンKのはたらきをじゃまして凝固因子（II・VII・IX・X）をつくらせず、血栓を防ぐ。|出血（歯肉出血、皮下出血、血尿、黒色便）|納豆・クロレラ・青汁は効果を弱めるので避ける。PT-INRで量を調節する。手術前は休薬を確認。拮抗薬はビタミンK。|1',
'抗凝固薬・抗血小板薬|DOAC（直接経口抗凝固薬）|アピキサバン、リバーロキサバン、エドキサバン、ダビガトラン|凝固因子Xaやトロンビンを直接おさえて血栓を防ぐ。|出血、消化管出血|食事の制限はない。効果の切れが早いので飲み忘れに注意し、決まった時間に飲む。腎機能が落ちると効きすぎる。|1',
'抗凝固薬・抗血小板薬|ヘパリン|ヘパリンナトリウム|アンチトロンビンのはたらきを強めてトロンビンやXaをおさえ、血液を固まりにくくする。|出血、ヘパリン起因性血小板減少症（HIT）|APTTで効き目をみる。拮抗薬はプロタミン硫酸塩。血小板数の低下に注意する。|1',
'抗凝固薬・抗血小板薬|アスピリン（抗血小板）|アスピリン（低用量）|シクロオキシゲナーゼをおさえてトロンボキサンA2をへらし、血小板が固まるのを防ぐ。|消化管潰瘍・出血、アスピリン喘息|81〜100mgの少量で使う。胃薬と一緒に使うことが多い。手術・抜歯前の休薬の指示を確認する。|1',
'抗凝固薬・抗血小板薬|P2Y12受容体拮抗薬|クロピドグレル、プラスグレル、チクロピジン|血小板のADP受容体をふさいで、血小板が固まるのを防ぐ。|出血、肝機能障害、血栓性血小板減少性紫斑病（TTP）|ステント留置後にアスピリンと併用することが多い。出血症状と手術前の休薬を確認する。|1',
'糖尿病の薬|インスリン（超速効型）|インスリン アスパルト、インスリン リスプロ、インスリン グルリジン|すぐに効きはじめ、食後の血糖の上昇をおさえる。|低血糖（冷汗、動悸、手のふるえ、意識障害）、注射部位のしこり|食直前に注射する。注射後に食べられないと低血糖になる。低血糖時はブドウ糖10gなどをとる。注射部位は毎回ずらす。|1',
'糖尿病の薬|インスリン（速効型）|インスリン ヒト（レギュラー）|食後の血糖の上昇をおさえる。静脈内にも投与できる。|低血糖、低カリウム血症（静注時）|皮下注射は食事の約30分前に行う。点滴やシリンジポンプで使うのは速効型。|1',
'糖尿病の薬|インスリン（持効型溶解）|インスリン グラルギン、インスリン デテミル、インスリン デグルデク|約24時間ほぼ一定に効き、基礎分泌を補う。|低血糖、注射部位の反応|毎日決まった時刻に注射する。ほかのインスリンと混ぜない。未使用のものは冷蔵、使用中は室温で保管する。|1',
'糖尿病の薬|SU薬（スルホニル尿素薬）|グリメピリド、グリクラジド、グリベンクラミド|膵臓のβ細胞からインスリンを出させて血糖を下げる。|低血糖（長引きやすい）、体重増加|高齢者や腎機能が低い人は低血糖が長引きやすい。低血糖の症状と対処（ブドウ糖）を指導する。|1',
'糖尿病の薬|速効型インスリン分泌促進薬（グリニド薬）|ナテグリニド、ミチグリニド、レパグリニド|短時間だけインスリンを出させ、食後の高血糖をおさえる。|低血糖|食直前に飲む。食事をとらないときは飲まない。|1',
'糖尿病の薬|DPP-4阻害薬|シタグリプチン、ビルダグリプチン、リナグリプチン、アログリプチン|インクレチンの分解をおさえ、血糖が高いときにインスリンを出させる。|低血糖（SU薬と併用時）、類天疱瘡、急性膵炎|単独では低血糖が少ない。SU薬との併用で低血糖に注意。水ぶくれや強い腹痛は報告する。|1',
'糖尿病の薬|SGLT2阻害薬|ダパグリフロジン、エンパグリフロジン、カナグリフロジン、イプラグリフロジン|腎臓でブドウ糖の再吸収をおさえ、尿に糖を出して血糖を下げる。|脱水、尿路・性器感染症、ケトアシドーシス（血糖が高くなくても起こる）|水分補給を指導する。尿糖陽性は薬の作用。体調不良時（シックデイ）や手術前は休薬を確認する。|1',
'糖尿病の薬|ビグアナイド薬|メトホルミン|肝臓で糖がつくられるのをおさえ、インスリンの効きをよくする。|乳酸アシドーシス、下痢・吐き気|ヨード造影剤を使う検査の前後は休薬する。脱水・腎機能低下・大量飲酒で乳酸アシドーシスに注意。|1',
'糖尿病の薬|α-グルコシダーゼ阻害薬|アカルボース、ボグリボース、ミグリトール|小腸で糖の分解・吸収を遅らせ、食後の高血糖をおさえる。|腹部膨満、放屁、下痢|食直前に飲む。低血糖のときは砂糖ではなくブドウ糖をとる。|1',
'糖尿病の薬|GLP-1受容体作動薬|リラグルチド、デュラグルチド、セマグルチド|GLP-1受容体を刺激し、血糖が高いときにインスリンを出させ、食欲もおさえる。|吐き気・嘔吐・下痢、急性膵炎、低血糖（SU薬・インスリン併用時）|多くは皮下注射（セマグルチドには内服薬もある）。続く強い腹痛は膵炎を疑い報告する。|1',
'ステロイド|副腎皮質ステロイド（内服・注射）|プレドニゾロン、メチルプレドニゾロン、デキサメタゾン、ヒドロコルチゾン|炎症や免疫反応を強くおさえる。|感染症、高血糖、骨粗鬆症、消化性潰瘍、満月様顔貌、不眠・精神症状、白内障・緑内障|自己判断で急にやめない（副腎不全が起こる）。やめるときは少しずつへらす。感染予防と血糖の確認を行う。|0',
'鎮痛薬|NSAIDs（非ステロイド性抗炎症薬）|ロキソプロフェン、イブプロフェン、ジクロフェナク、セレコキシブ|シクロオキシゲナーゼ（COX）をおさえてプロスタグランジンをへらし、痛み・熱・炎症をおさえる。|胃潰瘍・消化管出血、腎障害、アスピリン喘息（NSAIDs過敏喘息）|空腹時を避けて飲む。喘息の既往を確認する。高齢者や脱水のときは腎障害に注意。|0',
'鎮痛薬|アセトアミノフェン|アセトアミノフェン|脳に作用して熱を下げ、痛みをおさえる。抗炎症作用は弱い。|肝障害（大量・長期のとき）|胃腸障害が少なく、小児や妊婦にも使いやすい。1日の総量を守り、市販のかぜ薬との重なりに注意。|0',
'鎮痛薬|オピオイド（モルヒネ）|モルヒネ塩酸塩、モルヒネ硫酸塩|脳や脊髄のμオピオイド受容体を刺激し、強い痛みをおさえる。|便秘、吐き気・嘔吐、眠気、呼吸抑制、せん妄|便秘はほぼ必ず起こるので下剤を併用する。呼吸数と意識を観察する。腎機能が低いと効きすぎる。麻薬として鍵のかかる場所で管理。|1',
'鎮痛薬|オピオイド（オキシコドン）|オキシコドン塩酸塩|μオピオイド受容体を刺激し、がんなどの強い痛みをおさえる。|便秘、吐き気、眠気、呼吸抑制|徐放錠は割ったり砕いたりしない。痛みが強いときはレスキュー薬（速放製剤）を使う。|1',
'鎮痛薬|オピオイド（フェンタニル）|フェンタニル、フェンタニルクエン酸塩|μオピオイド受容体を刺激し、強い痛みをおさえる。貼付剤は1日用と3日用がある。|呼吸抑制、眠気、便秘（モルヒネより少ない）|貼付部位を温めない（入浴・電気毛布・発熱で吸収がふえ過量になる）。はがした貼付剤は内側を折りたたんで返却する。|1',
'抗菌薬・抗ウイルス薬|ペニシリン系|アモキシシリン、アンピシリン、ベンジルペニシリン、ピペラシリン|細菌の細胞壁がつくられるのをじゃまして殺菌する。|アナフィラキシーショック、発疹、下痢|投与前にアレルギー歴を確認する。投与開始直後はそばで観察し、呼吸困難・血圧低下に備える。|0',
'抗菌薬・抗ウイルス薬|セフェム系|セファゾリン、セフトリアキソン、セフメタゾール、セフカペン ピボキシル|細菌の細胞壁がつくられるのをじゃまして殺菌する。|アナフィラキシー、発疹、下痢、偽膜性腸炎|ペニシリンアレルギーの人は注意。セフトリアキソンはカルシウムを含む輸液と混ぜない。飲酒で悪酔いする薬もある。|0',
'抗菌薬・抗ウイルス薬|カルバペネム系|メロペネム、イミペネム・シラスタチン、ドリペネム|細胞壁の合成をじゃまして、はば広い細菌を殺菌する。|アナフィラキシー、下痢、けいれん、肝機能障害|バルプロ酸と併用しない（バルプロ酸の濃度が下がり発作が起こる）。耐性菌をふやさないよう適正に使う。|0',
'抗菌薬・抗ウイルス薬|アミノグリコシド系|ゲンタマイシン、アミカシン、トブラマイシン、ストレプトマイシン|細菌のたんぱく質合成をじゃまして殺菌する。|腎障害、第8脳神経障害（難聴・耳鳴り・めまい）|血中濃度を測って量を決める。尿量・腎機能と、聞こえにくさ・耳鳴りを観察する。|0',
'抗菌薬・抗ウイルス薬|バンコマイシン（グリコペプチド系）|バンコマイシン|細胞壁の合成をじゃまし、MRSAなどを殺菌する。|腎障害、聴覚障害、急速投与による顔や上半身の発赤（レッドマン症候群）|60分以上かけて点滴する。トラフ値を測る。内服はクロストリディオイデス・ディフィシル腸炎に使う。|0',
'抗菌薬・抗ウイルス薬|キノロン系|レボフロキサシン、シプロフロキサシン、モキシフロキサシン|細菌のDNAの複製をじゃまして殺菌する。|けいれん（NSAIDs併用で起きやすい）、アキレス腱障害、光線過敏症、低血糖・高血糖、QT延長|Mg・Al・Caを含む薬や鉄剤と同時に飲むと吸収が落ちるので時間をずらす。妊婦や小児には原則使わない。|0',
'抗菌薬・抗ウイルス薬|マクロライド系|クラリスロマイシン、アジスロマイシン、エリスロマイシン|細菌のたんぱく質合成をじゃまして増殖をおさえる。マイコプラズマなどに効く。|下痢・腹痛、QT延長、肝機能障害|クラリスロマイシンはほかの薬の代謝をおさえて血中濃度を上げるので、飲み合わせに注意する。|0',
'抗菌薬・抗ウイルス薬|抗結核薬|イソニアジド、リファンピシン、エタンブトール、ピラジナミド|数種類を組み合わせて結核菌を殺菌し、耐性菌を防ぐ。|肝障害、末梢神経障害（イソニアジド）、視力障害（エタンブトール）、尿や涙が赤橙色になる（リファンピシン）|6か月以上、毎日きちんと飲む（服薬支援：DOTS）。見え方の変化や黄疸は報告する。|0',
'抗菌薬・抗ウイルス薬|抗インフルエンザ薬|オセルタミビル、ザナミビル、ラニナミビル、ペラミビル、バロキサビル マルボキシル|ウイルスが細胞から出ていくのをおさえたり（ノイラミニダーゼ阻害薬）、増殖をおさえたりする。|吐き気・下痢、異常行動（インフルエンザそのものでも起こる）|発症後48時間以内に始める。発熱から少なくとも2日間は子どもを1人にしないなど、異常行動に注意する。|0',
'抗菌薬・抗ウイルス薬|抗ヘルペスウイルス薬|アシクロビル、バラシクロビル、ファムシクロビル|ウイルスのDNA合成をおさえて増殖を止める。|腎障害、意識障害・せん妄などの精神神経症状|腎機能が低い人や高齢者は量をへらす。水分を十分にとる。早く始めるほど効く。|0',
'抗菌薬・抗ウイルス薬|抗HIV薬|テノホビル、エムトリシタビン、ドルテグラビル、ビクテグラビル|HIVの逆転写酵素やインテグラーゼなどをおさえて増殖を止める。数種類を組み合わせて使う。|吐き気、腎機能障害、骨密度低下、免疫再構築症候群、薬の飲み合わせ|飲み忘れると耐性ウイルスができやすいので、毎日決まった時間に飲み続ける（アドヒアランス）。|1',
'抗てんかん薬|バルプロ酸|バルプロ酸ナトリウム|脳のGABAをふやすなどして神経の興奮をおさえ、発作を防ぐ。気分安定薬としても使う。|肝障害、高アンモニア血症、膵炎、眠気、催奇形性（神経管閉鎖障害）|血中濃度を測る。カルバペネム系と併用しない。妊娠の可能性がある女性では慎重に使う。|1',
'抗てんかん薬|カルバマゼピン|カルバマゼピン|Naチャネルをおさえて神経の興奮をしずめる。焦点発作や三叉神経痛に効く。|スティーブンス・ジョンソン症候群などの重い皮膚障害、めまい・ふらつき、血液障害、低ナトリウム血症|発疹・発熱・口の中のただれは早く報告する。ほかの薬の効果を弱めることがある。グレープフルーツで血中濃度が上がる。|1',
'抗てんかん薬|フェニトイン|フェニトイン、ホスフェニトイン|Naチャネルをおさえて神経の興奮をしずめる。|歯肉増殖、眼振・ふらつき（中毒症状）、多毛、皮膚障害|有効な範囲が狭く血中濃度を測る。静注はブドウ糖液と混ぜず、ゆっくり行う。血管外漏出に注意。口腔ケアで歯肉を清潔に保つ。|1',
'抗てんかん薬|レベチラセタム|レベチラセタム|シナプス小胞たんぱく（SV2A）に結合し、神経の興奮をおさえる。|眠気、ふらつき、いらいら・攻撃性などの精神症状|ほかの薬との飲み合わせが少ない。気分の変化に注意する。自己判断で急にやめない（発作が起こる）。|1',
'抗てんかん薬|ラモトリギン|ラモトリギン|Naチャネルをおさえて神経の興奮をしずめる。双極性障害にも使う。|スティーブンス・ジョンソン症候群などの重い皮膚障害、めまい、眠気|決められた少ない量から始め、少しずつふやす。バルプロ酸と併用すると皮膚障害が起きやすい。発疹はすぐ報告する。|1',
'向精神薬|抗精神病薬（定型）|ハロペリドール、クロルプロマジン|脳のドパミンD2受容体をふさぎ、幻覚・妄想などをおさえる。|錐体外路症状（パーキンソン症状、アカシジア、ジストニア、遅発性ジスキネジア）、悪性症候群、高プロラクチン血症、起立性低血圧|高熱・筋肉のこわばり・意識障害・CK上昇は悪性症候群を疑いすぐ報告する。口渇・便秘にも注意。|1',
'向精神薬|抗精神病薬（非定型）|リスペリドン、オランザピン、クエチアピン、アリピプラゾール|ドパミンやセロトニンの受容体に作用し、陽性症状と陰性症状をおさえる。|体重増加、高血糖、眠気、錐体外路症状（定型より少ない）|オランザピンとクエチアピンは糖尿病の人には使わない。体重と血糖を定期的にみる。|1',
'向精神薬|抗うつ薬（SSRI・SNRI）|パロキセチン、セルトラリン、エスシタロプラム、フルボキサミン、デュロキセチン|セロトニン（SNRIはノルアドレナリンも）の再取り込みをおさえ、うつ状態を改善する。|吐き気、セロトニン症候群、賦活症候群（不安・焦燥・衝動性）、中止後症状|効果が出るまで2〜4週かかる。飲みはじめや量を変えたときは自殺念慮に注意（とくに若い人）。自己判断で急にやめない。|1',
'向精神薬|三環系抗うつ薬|アミトリプチリン、イミプラミン、クロミプラミン|ノルアドレナリンとセロトニンの再取り込みをおさえ、うつ状態を改善する。|口渇・便秘・尿閉（抗コリン作用）、起立性低血圧、眠気、不整脈|緑内障や前立腺肥大の人は注意する。過量服薬で命にかかわる不整脈が起こるので、薬の管理に配慮する。|1',
'向精神薬|炭酸リチウム|炭酸リチウム|気分の波をおさえ、躁状態を改善する（気分安定薬）。|リチウム中毒（手のふるえ、下痢・嘔吐、意識障害、けいれん）、甲状腺機能低下症、多尿|効く濃度と中毒の濃度が近いので血中濃度を定期的に測る。脱水・減塩・NSAIDs・利尿薬で濃度が上がる。|1',
'強心薬・抗不整脈薬|ジギタリス製剤|ジゴキシン、メチルジゴキシン|心臓の収縮力を強め、心拍数を下げる。心不全や心房細動に使う。|ジギタリス中毒（食欲不振・吐き気、黄視などの視覚異常、徐脈、不整脈）|有効な範囲が狭く血中濃度を測る。低カリウム血症で中毒が起きやすい。飲む前に脈拍を測り、60回/分未満なら報告する。|1',
'強心薬・抗不整脈薬|アミオダロン|アミオダロン塩酸塩|カリウムチャネルなどをおさえて、重い心室性不整脈を防ぐ。|間質性肺炎、甲状腺機能異常、肝障害、QT延長、角膜の色素沈着|せき・息切れ・発熱は間質性肺炎を疑い報告する。半減期がとても長く、やめても作用が長く残る。|1',
'強心薬・抗不整脈薬|Naチャネル遮断薬（抗不整脈薬）|リドカイン（静注用）、ピルシカイニド、フレカイニド、シベンゾリン|Naチャネルをおさえて心筋の興奮をしずめ、不整脈を止める。|新たな不整脈、心不全の悪化、めまい、低血糖（シベンゾリン）|心電図モニターで観察する。静注用リドカインは局所麻酔用と取り違えないよう確認する。|1',
'強心薬・抗不整脈薬|硝酸薬|ニトログリセリン、硝酸イソソルビド|血管（とくに静脈）を広げて心臓の負担をへらし、冠動脈も広げて狭心症の発作をしずめる。|頭痛、血圧低下、顔のほてり、めまい|発作時は舌下で使い、飲みこまない。座って使い、立ちくらみに注意。シルデナフィルなどのPDE5阻害薬とは併用しない。|0',
'強心薬・抗不整脈薬|カテコラミン|ドパミン、ドブタミン、ノルアドレナリン|心臓のβ1受容体を刺激して収縮力を強めたり、血管のα1受容体を刺激して血圧を上げたりする。|頻脈、不整脈、末梢の虚血、血管外漏出による皮膚の壊死|シリンジポンプで持続投与し、流量は慎重に変える。専用のルートを使い、側管から急に流れないようにする。血圧・心拍を続けてみる。|0',
'呼吸器の薬|β2刺激薬|サルブタモール、プロカテロール（短時間作用型）、サルメテロール、ホルモテロール（長時間作用型）|気管支のβ2受容体を刺激して気管支を広げる。|動悸・頻脈、手のふるえ、低カリウム血症|発作時は短時間作用型を吸入する。使う回数がふえたら悪化のサインなので報告するよう伝える。|0',
'呼吸器の薬|吸入ステロイド|ベクロメタゾン、フルチカゾン、ブデソニド、シクレソニド|気道の炎症をおさえて喘息の発作を予防する。|口腔カンジダ症、声がれ|発作を止める薬ではなく毎日続ける薬。吸入後はうがいをする。|0',
'呼吸器の薬|テオフィリン製剤|テオフィリン、アミノフィリン（注射）|気管支を広げる。|テオフィリン中毒（吐き気・嘔吐、頭痛、頻脈・不整脈、けいれん）|有効な範囲が狭く血中濃度を測る。喫煙・発熱・飲み合わせ（マクロライド系、キノロン系など）で濃度が変わる。小児はけいれんに注意。|1',
'呼吸器の薬|抗コリン薬（吸入）|チオトロピウム、グリコピロニウム、ウメクリジニウム|気管支のムスカリン受容体をふさいで気管支を広げる。COPDによく使う。|口渇、排尿障害、眼圧上昇|閉塞隅角緑内障の人や、前立腺肥大で尿が出にくい人には使わない。|0',
'呼吸器の薬|去痰薬|カルボシステイン、アンブロキソール、ブロムヘキシン|痰の性質を変えたり気道の分泌をふやしたりして、痰を出しやすくする。|胃腸症状、発疹|水分を十分にとる。体位ドレナージや効果的な咳の仕方の指導と組み合わせる。|0',
'消化器の薬|PPI（プロトンポンプ阻害薬）|オメプラゾール、ランソプラゾール、エソメプラゾール、ラベプラゾール|胃の壁細胞のプロトンポンプをおさえ、胃酸を強くへらす。|下痢、肝機能障害、長く使うと骨折・低マグネシウム血症・腸の感染症|ヘリコバクター・ピロリの除菌では抗菌薬と一緒に使う。NSAIDsや低用量アスピリンによる潰瘍の予防にも使う。|0',
'消化器の薬|H2ブロッカー（H2受容体拮抗薬）|ファモチジン、ラフチジン、ニザチジン|胃の壁細胞のヒスタミンH2受容体をふさいで胃酸をへらす。|せん妄・意識障害（高齢者・腎機能低下時）、血液障害、肝機能障害|腎臓から出る薬なので、腎機能が低い人は量をへらす。高齢者の混乱に注意する。|0',
'消化器の薬|制吐薬（ドパミン受容体拮抗薬）|メトクロプラミド、ドンペリドン|ドパミンD2受容体をふさいで吐き気をおさえ、胃腸の動きをよくする。|錐体外路症状（とくに小児・高齢者）、高プロラクチン血症|消化管の出血・穿孔・閉塞があるときは使わない。ドンペリドンは妊婦には使わない。|0',
'消化器の薬|制吐薬（5-HT3・NK1受容体拮抗薬）|グラニセトロン、オンダンセトロン、パロノセトロン、アプレピタント|セロトニン5-HT3受容体（アプレピタントはNK1受容体）をふさぎ、抗がん剤による吐き気をおさえる。|便秘、頭痛|抗がん剤の前に予防として使う。デキサメタゾンと組み合わせることが多い。|0',
'消化器の薬|抗コリン薬（鎮痙薬）|ブチルスコポラミン臭化物、アトロピン硫酸塩|副交感神経のはたらきをおさえ、胃腸のけいれんや痛みをしずめる。|口渇、尿閉、頻脈、眼圧上昇、目のかすみ|緑内障、前立腺肥大で尿が出にくい人、重い心疾患、麻痺性イレウスには使わない。内視鏡の前処置にも使う。|0',
'下剤・止痢薬|酸化マグネシウム（塩類下剤）|酸化マグネシウム|腸の中に水分を引きこみ、便をやわらかくする。|高マグネシウム血症（腎機能低下・高齢者）、下痢|吐き気・脱力・徐脈・血圧低下は高Mg血症を疑う。キノロン系などの吸収を下げるので飲む時間をずらす。|0',
'下剤・止痢薬|刺激性下剤|センノシド、ピコスルファートナトリウム、ビサコジル（坐剤）|大腸を刺激してぜん動を強め、排便をうながす。|腹痛、下痢、長く使うと効きにくくなる|寝る前に飲むと翌朝に効く。センノシドで尿が赤っぽくなることがある。腸閉塞が疑われるときは使わない。|0',
'下剤・止痢薬|グリセリン浣腸|グリセリン|直腸を刺激し、便をやわらかくして排便をうながす。|腹痛、血圧低下、直腸の損傷、溶血|左側臥位で行い、立ったままでは行わない（直腸穿孔の危険）。液は40℃前後に温め、カテーテルは約5cm挿入する。|0',
'下剤・止痢薬|ラクツロース|ラクツロース|腸内で分解されて便をやわらかくし、腸内を酸性にしてアンモニアの吸収をへらす。|下痢、腹部膨満|肝性脳症の治療にも使う。排便の回数・性状と意識状態をみる。|0',
'下剤・止痢薬|止痢薬（ロペラミド）|ロペラミド塩酸塩|腸のオピオイド受容体に作用して腸の動きをおさえ、下痢を止める。|便秘、腹部膨満、イレウス|細菌性の下痢（O157など）や偽膜性腸炎には原則使わない（菌や毒素が出ていかない）。脱水の補正を優先する。|0',
'睡眠薬・抗不安薬|抗不安薬（ベンゾジアゼピン系）|ジアゼパム、アルプラゾラム、ロラゼパム|GABAのはたらきを強め、不安や緊張をやわらげる。|眠気、ふらつき・転倒、依存、呼吸抑制（注射・過量時）|高齢者は転倒やせん妄に注意。長く飲んで急にやめると離脱症状が出る。お酒と一緒に飲まない。拮抗薬はフルマゼニル。|0',
'睡眠薬・抗不安薬|睡眠薬（ベンゾジアゼピン系）|トリアゾラム、ブロチゾラム、フルニトラゼパム|GABAのはたらきを強めて眠りに導く。|翌朝への持ち越し（眠気・ふらつき）、転倒、健忘、依存|寝る直前に飲み、飲んだあとは歩き回らない。高齢者の夜間のトイレでの転倒に注意する。|0',
'睡眠薬・抗不安薬|睡眠薬（非ベンゾジアゼピン系）|ゾルピデム、ゾピクロン、エスゾピクロン|GABA受容体に作用し、短い時間で眠りに導く。|ふらつき、健忘、寝ぼけたような異常行動、苦味（ゾピクロン・エスゾピクロン）|寝る直前に飲む。お酒と一緒に飲まない。筋弛緩作用は弱めだが転倒に注意する。|0',
'睡眠薬・抗不安薬|睡眠薬（オレキシン受容体拮抗薬）|スボレキサント、レンボレキサント、ダリドレキサント|目覚めを保つオレキシンのはたらきをおさえて眠りに導く。|翌朝の眠気、悪夢、頭痛|依存や筋弛緩作用が少なく、高齢者にも使いやすい。飲み合わせ（クラリスロマイシンなど）に注意する。|0',
'睡眠薬・抗不安薬|睡眠薬（メラトニン受容体作動薬）|ラメルテオン|メラトニン受容体を刺激して体内時計を整え、自然な眠りをうながす。|眠気、めまい|フルボキサミンとは併用しない。食事と一緒や食後すぐに飲むと効きにくいので避ける。|0',
'抗がん剤・免疫抑制薬|プラチナ製剤|シスプラチン、カルボプラチン、オキサリプラチン|DNAに結合して、がん細胞の増殖を止める。|腎障害、強い吐き気・嘔吐、骨髄抑制、聴覚障害（シスプラチン）、冷たいもので強まるしびれ（オキサリプラチン）|シスプラチンは腎障害を防ぐため大量の輸液を行い、尿量を確認する。オキサリプラチンの投与後は冷たいものに触れない・飲まない。|1',
'抗がん剤・免疫抑制薬|代謝拮抗薬|フルオロウラシル、メトトレキサート、シタラビン、ゲムシタビン、カペシタビン|DNAの材料に似た物質で、がん細胞のDNA合成をじゃまする。|骨髄抑制、口内炎、下痢、手足症候群（カペシタビン）|手洗い・うがいで感染を予防し、口腔ケアを行う。関節リウマチに使うメトトレキサートは週に1〜2日だけ飲む薬で、毎日飲むと重い副作用が出る。|1',
'抗がん剤・免疫抑制薬|アルキル化薬|シクロホスファミド|DNAに結合して、がん細胞の増殖を止める。|骨髄抑制、出血性膀胱炎、脱毛、吐き気|出血性膀胱炎を防ぐため水分を多くとり排尿をうながす。血尿を観察する。|1',
'抗がん剤・免疫抑制薬|微小管阻害薬|パクリタキセル、ドセタキセル、ビンクリスチン|細胞分裂に必要な微小管のはたらきをじゃまする。|末梢神経障害（しびれ）、骨髄抑制、過敏症（パクリタキセル）、脱毛、便秘（ビンクリスチン）|パクリタキセルは過敏症を防ぐ前投薬をし、アルコールを含むことを確認する。ビンクリスチンは髄腔内に投与しない。|1',
'抗がん剤・免疫抑制薬|アントラサイクリン系|ドキソルビシン、エピルビシン、ダウノルビシン|DNAの間に入りこみ、がん細胞の増殖を止める。|心筋障害（総投与量に注意）、骨髄抑制、脱毛、血管外漏出による壊死、尿が赤くなる|使える総量が決まっている。点滴中は刺入部の痛み・はれを観察し、漏れたらすぐ止めて報告する。|1',
'抗がん剤・免疫抑制薬|分子標的薬|トラスツズマブ、リツキシマブ、ベバシズマブ、ゲフィチニブ、イマチニブ|がん細胞に特有の分子（受容体や酵素など）をねらって増殖をおさえる。|インフュージョンリアクション（発熱・悪寒・血圧低下）、間質性肺炎、心機能低下（トラスツズマブ）、皮膚障害|抗体薬は初回の点滴中から後のインフュージョンリアクションを観察する。せき・息切れは間質性肺炎を疑う。|1',
'抗がん剤・免疫抑制薬|免疫チェックポイント阻害薬|ニボルマブ、ペムブロリズマブ、イピリムマブ|T細胞のブレーキ（PD-1やCTLA-4など）をはずし、自分の免疫でがんを攻撃させる。|免疫関連有害事象（間質性肺炎、大腸炎・下痢、甲状腺機能異常、1型糖尿病、肝障害、皮膚障害）|投与が終わってしばらくしてから出ることもある。下痢・息切れ・だるさ・のどの渇きなどを早めに伝えるよう指導する。|1',
'抗がん剤・免疫抑制薬|免疫抑制薬（カルシニューリン阻害薬）|タクロリムス、シクロスポリン|T細胞のはたらきをおさえ、臓器移植後の拒絶反応や自己免疫疾患をおさえる。|腎障害、感染症、高血糖、高血圧、手のふるえ、高カリウム血症|血中濃度（トラフ値）を測る。グレープフルーツジュースで濃度が上がる。手洗い・マスクで感染を予防する。|1',
'そのほか|カリウム製剤（注射）|塩化カリウム、L-アスパラギン酸カリウム|低カリウム血症を補正する。|高カリウム血症（不整脈・心停止）、血管痛、静脈炎|急速静注・ワンショット静注は禁止（心停止の危険）。必ず輸液で薄め、濃度40mEq/L以下・速度20mEq/時以下でゆっくり点滴する。尿量を確認する。|1',
'そのほか|甲状腺ホルモン薬|レボチロキシンナトリウム|不足した甲状腺ホルモンを補う（甲状腺機能低下症）。|動悸・頻脈、不眠、体重減少（効きすぎ）、狭心症の悪化|少ない量から始めて少しずつふやす（高齢者・心疾患の人はとくに）。鉄剤・カルシウム剤と同時に飲むと吸収が落ちる。|0',
'そのほか|抗甲状腺薬|チアマゾール、プロピルチオウラシル|甲状腺ホルモンがつくられるのをおさえる（バセドウ病）。|無顆粒球症、発疹・かゆみ、肝障害|発熱・のどの痛みが出たらすぐ受診・報告する（無顆粒球症）。飲みはじめの2か月は白血球数を定期的に測る。|0',
'そのほか|アドレナリン（アナフィラキシー）|アドレナリン|α・β受容体を刺激して血圧を上げ、気管支を広げ、アナフィラキシーの症状をおさえる。|動悸・頻脈、不整脈、血圧上昇、頭痛|アナフィラキシーでは大腿の前外側に筋肉注射する（0.01mg/kg、最大で成人0.5mg・小児0.3mg）。自己注射薬の使い方を指導する。|0',
'そのほか|ビスホスホネート（骨粗鬆症の薬）|アレンドロン酸、リセドロン酸、ミノドロン酸、ゾレドロン酸（注射）|骨をこわす破骨細胞のはたらきをおさえ、骨密度を上げる。|顎骨壊死、食道炎・食道潰瘍、低カルシウム血症、非定型大腿骨骨折|起床時すぐにコップ1杯（約180mL）の水で飲み、その後30分は横にならず飲食もしない。歯科治療の前は伝えるよう指導する。|0',
'そのほか|ナロキソン（オピオイド拮抗薬）|ナロキソン塩酸塩|オピオイド受容体をふさいで、オピオイドによる呼吸抑制などを打ち消す。|痛みの急な再燃、離脱症状（興奮・血圧上昇）|オピオイドより作用時間が短いことがあるので、呼吸抑制が再び起きないか観察を続ける。|0',
'そのほか|抗ヒスタミン薬|d-クロルフェニラミン、ジフェンヒドラミン、フェキソフェナジン、ビラスチン|ヒスタミンH1受容体をふさいで、かゆみ・くしゃみ・鼻水・じんましんをおさえる。|眠気、口渇、排尿障害（第一世代）|第一世代は眠気が強く、緑内障や前立腺肥大の人は注意。車の運転を避けるよう伝える。|0',
'そのほか|抗パーキンソン病薬|レボドパ・カルビドパ、プラミペキソール|脳のドパミンを補ったり受容体を刺激したりして、ふるえや動作の遅さを改善する。|吐き気、幻覚、ジスキネジア（不随意運動）、起立性低血圧、突然の眠気|急にやめると悪性症候群が起こることがある。薬が切れる時間（ウェアリング・オフ）を観察し、転倒に注意する。|0',
'そのほか|認知症の薬|ドネペジル、ガランタミン、リバスチグミン（貼付剤）、メマンチン|アセチルコリンの分解をおさえたり（メマンチンはNMDA受容体をおさえる）して、認知症の進行をゆるやかにする。|吐き気・食欲不振・下痢、徐脈、めまい（メマンチン）|病気を治す薬ではなく進行を遅らせる薬。脈拍や食欲の変化をみる。貼付剤は毎日場所を変えて貼る。|0',
'そのほか|鉄剤|クエン酸第一鉄ナトリウム、含糖酸化鉄（注射）|鉄を補い、鉄欠乏性貧血を改善する。|吐き気・胃の不快感、便秘、黒色便|便が黒くなるのは薬のためと説明する。胃の症状が強いときは食後に飲む。|0'
];

var KQ_SKILLS = [
{ id:'handwash', name:'衛生的手洗い（流水と石けん）', cat:'感染予防', goal:'約1分', steps:[
  ['時計・指輪をはずし、そでをひじまでまくる', '時計や指輪の下は洗い残しが多く、菌が残りやすいため'],
  ['爪が短く切られているか確認する', '爪の間は汚れがたまりやすく、長い爪は洗い残しや手袋の破れの原因になるため'],
  ['流水で手をぬらし、石けんを手のひらにとる', '先に手をぬらすと石けんが泡立ちやすく、皮膚への刺激も減るため'],
  ['手のひらどうしをこすり合わせてよく泡立てる', '泡で汚れを浮かせ、石けんを手全体に行きわたらせるため'],
  ['手の甲を反対の手のひらで包むように洗う（左右）', '手の甲は意識しないと洗い残しやすい部位のため'],
  ['指を組んで指の間をこすり洗う', '指の間は洗い残しが多い部位のため'],
  ['指先と爪の間を反対の手のひらでこすり洗う', '指先は患者や物品に最もよくふれ、汚れが残りやすいため'],
  ['親指を反対の手でにぎり、ねじるように洗う', '親指は洗い残しが最も多い部位の一つであるため'],
  ['両手首をにぎるようにして洗う', '手首も汚染されていることがあり、洗い残しやすいため'],
  ['流水で石けんと汚れを十分に洗い流す', '石けんが残ると手荒れの原因になり、汚れも落としきれないため'],
  ['ペーパータオルで押さえるように水分をふきとる', 'ぬれた手は菌がつきやすく、こすると皮膚を傷めるため'],
  ['手動の蛇口はペーパータオルを使ってしめる', '洗った手で直接蛇口にふれると再び汚染されるため']
]},
{ id:'handrub', name:'擦式アルコール製剤による手指消毒', cat:'感染予防', goal:'約20〜30秒', steps:[
  ['手に目に見える汚れがないことを確認する', '目に見える汚れや血液があるとアルコールが効きにくいため、その時は流水と石けんで洗う'],
  ['製剤を規定量（ポンプを最後まで押した量）手のひらにとる', '量が少ないと手全体に行きわたらず、すぐ乾いて消毒が不十分になるため'],
  ['両手の指先を反対の手のひらの製剤にひたしてすりこむ', '指先は最も汚染されやすいため、製剤が多いうちに最初にすりこむ'],
  ['手のひらどうしをすり合わせる', '手のひら全体に製剤を広げるため'],
  ['手の甲に反対の手のひらですりこむ（左右）', '手の甲はすりこみ忘れやすい部位のため'],
  ['指を組んで指の間にすりこむ', '指の間は消毒のもれが多い部位のため'],
  ['親指を反対の手でにぎり、ねじるようにすりこむ', '親指はすりこみ残しが多い部位のため'],
  ['両手首にもしっかりすりこむ', '手首までが手指消毒の範囲であるため'],
  ['乾くまですりこみ、タオルなどでふきとらない', 'アルコールは乾くまでの間に殺菌効果を発揮するため'],
  ['嘔吐・下痢の患者のケア後は流水と石けんで洗う', 'ノロウイルスや芽胞をつくる菌にはアルコールが効きにくく、洗い流す必要があるため'],
  ['患者にふれる前後など5つの場面で必ず行う', '手を介して患者から患者、環境へ病原体が広がるのを防ぐため']
]},
{ id:'gloves', name:'手袋の着脱（未滅菌手袋）', cat:'感染予防', goal:'約1分', steps:[
  ['着ける前に手指衛生を行う', '手袋は手指衛生の代わりにはならず、手袋の外側の汚染も防ぐため'],
  ['手に合ったサイズの手袋を選ぶ', '大きすぎると操作しにくく、小さすぎると破れやすいため'],
  ['破れや穴がないか確かめ、箱から1枚ずつとり出す', '破損した手袋は防護にならず、箱に残った手袋も汚さないため'],
  ['手首までしっかり覆うように着ける', '手首の皮膚が露出していると、そこが汚染されるため'],
  ['ガウン着用時は、手袋でそで口を覆う', 'そで口と手袋のすき間から皮膚が汚染されるのを防ぐため'],
  ['着けたまま顔や周りの物にさわらない', '手袋についた病原体を自分や環境に広げないため'],
  ['患者ごと・汚れた部位から清潔な部位に移る時は交換する', '同じ手袋のままでは病原体を別の患者や部位に運ぶため'],
  ['片方の手袋の手首の外側を、手袋をした手でつまむ', '外側は汚染面なので、手袋どうしでふれれば素手が汚れないため'],
  ['裏返しながら外し、手袋をした手で丸めてにぎる', '汚染面を内側に包みこみ、周囲への飛散を防ぐため'],
  ['素手の指を、残った手袋の手首の内側に差しこむ', '手袋の内側は汚染されていない面なので、素手でふれても安全なため'],
  ['裏返しながら外し、2枚をまとめて包みこむ', '汚染面をすべて内側にして、安全に捨てられるようにするため'],
  ['決められた感染性廃棄物の容器に捨てる', '使用済み手袋からの感染の広がりを防ぐため'],
  ['外した直後に手指衛生を行う', '外す時の汚染や、目に見えない小さな穴から手が汚れている可能性があるため']
]},
{ id:'ppe', name:'個人防護具（ガウン・マスク・ゴーグル）の着脱', cat:'感染予防', goal:'約3分', steps:[
  ['手指衛生を行い、必要な防護具をそろえる', '清潔な手で扱い、防護具の内側を汚さないため'],
  ['ガウンを着て、首と腰のひもを後ろで結ぶ', '体の前面と腕を覆い、衣服への血液・体液の付着を防ぐため'],
  ['マスクを鼻の形に合わせ、あごの下まで覆う', 'すき間をなくし、飛沫を吸いこまないようにするため'],
  ['ゴーグル（またはフェイスシールド）を着ける', '目の粘膜に血液や体液が飛び散るのを防ぐため'],
  ['最後に手袋を着け、ガウンのそで口を覆う', '手首の露出をなくし、手袋を汚さないよう最後に着けるため'],
  ['処置中は手袋で顔やマスクにふれない', '手袋の汚染を顔の粘膜に運ばないため'],
  ['外す時は、最も汚れている手袋から外す', '汚染の強い物から外すことで、ほかの防護具や体への汚染を減らすため'],
  ['手指衛生後、ゴーグルは耳にかかる部分を持って外す', 'ゴーグルの前面は汚染されているため、ふれずに外すため'],
  ['ガウンのひもをほどき、外側を内側に丸めて脱ぐ', '汚染した外側にふれず、病原体を周囲に広げないため'],
  ['マスクはひもだけを持って最後に外す', 'マスクの前面は汚染されており、顔の近くで扱うため最後にする'],
  ['N95マスクは病室を出てから外す', '空気感染では室内の空気に病原体が漂っているため'],
  ['外した防護具は感染性廃棄物として捨てる', '使用済みの防護具から感染が広がるのを防ぐため'],
  ['すべて外した後に手指衛生を行う', '外す時に手が汚染された可能性があるため']
]},
{ id:'vitals', name:'バイタルサイン測定（全体の流れ）', cat:'観察・測定', goal:'約10分', steps:[
  ['患者の氏名を確認し、目的を説明して同意を得る', '患者の取り違えを防ぎ、不安をやわらげて協力を得るため'],
  ['手指衛生を行い、測定用具をそろえて点検する', '感染を防ぎ、故障による誤った値や測定の中断を防ぐため'],
  ['聴診器・体温計をアルコール綿でふく', '器具を介して患者の間で病原体が広がるのを防ぐため'],
  ['食事・入浴・運動・排泄の直後でないか確かめる', 'これらの直後は体温・脈拍・血圧が変動し、正しい値にならないため'],
  ['5分ほど安静にしてもらい、室温とプライバシーを整える', '体動や寒さ・緊張は測定値に影響するため'],
  ['体温計を腋窩にはさみ、その間に脈拍を測る', '待ち時間を有効に使い、患者の負担と拘束時間を減らすため'],
  ['脈拍を測るふりを続けながら呼吸を数える', '呼吸は意識すると変わりやすいため、気づかれないように測る'],
  ['体温・脈拍・呼吸の後に血圧を測る', 'マンシェットの圧迫による不快や緊張が、ほかの測定値に影響しないようにするため'],
  ['意識・顔色・皮膚の状態なども合わせて観察する', '数値だけでなく全身の状態と合わせて判断するため'],
  ['いつもの値と比べ、異常があれば再測定して報告する', '測定の誤りをのぞき、急な変化に早く対応するため'],
  ['寝衣を整え、測定結果を患者に伝える', '安楽を保ち、患者が自分の状態を知ることができるため'],
  ['物品を片付けて手指衛生を行う', '使用後の器具や手を介した感染を防ぐため'],
  ['測定値・時刻・観察したことを記録する', '経過を比べられるようにし、チームで情報を共有するため']
]},
{ id:'bp', name:'血圧測定（聴診法・上腕）', cat:'観察・測定', goal:'約5分', steps:[
  ['患者確認を行い、説明して同意を得る', '取り違えを防ぎ、緊張による血圧の上昇をやわらげるため'],
  ['手指衛生を行い、血圧計の0点と空気もれを点検する', '器具に不良があると正しい値が得られないため'],
  ['座位か臥位で5分ほど安静にしてもらう', '活動や緊張の直後は血圧が高く出るため'],
  ['上腕を圧迫しないよう衣服をゆるめ、腕を出す', 'まくったそでで上腕が締めつけられると、正しく測れないため'],
  ['測定部位（上腕）を心臓と同じ高さにする', '心臓より低いと高く、高いと低く測定されるため'],
  ['上腕周囲の約40%の幅のマンシェットを選ぶ', '幅が狭いと高く、広すぎると低く測定されるため'],
  ['ゴム嚢の中央を上腕動脈に合わせ、下縁を肘窩の2〜3cm上にする', '動脈を均等に圧迫し、聴診器を当てる場所を確保するため'],
  ['指が1〜2本入る程度のきつさで巻く', 'ゆるいと高く、きついと低く測定されるため'],
  ['橈骨動脈をふれながら加圧し、脈が消える値を知る', '触診法で収縮期血圧のめやすを知り、聴診間隙による読み誤りを防ぐため'],
  ['一度減圧し、上腕動脈の上に聴診器の膜面を当てる', '動脈の真上で聴くことで、コロトコフ音をはっきり聴きとるため'],
  ['触診法の値より20〜30mmHg高く加圧する', '確実に動脈を閉じ、音の聞こえ始めを聞きのがさないため'],
  ['1拍につき2〜3mmHgの速さで減圧する', '速すぎると音の聞こえ始めと消える点を正確に読めないため'],
  ['音が聞こえ始めた値を収縮期、消えた値を拡張期とする', 'コロトコフ音の第1点が収縮期、第5点が拡張期血圧にあたるため'],
  ['完全に排気して外し、衣服を整え手指衛生後に記録する', '部位や体位で値が変わるため、それも記録して比べられるようにする']
]},
{ id:'temp-axilla', name:'体温測定（腋窩）', cat:'観察・測定', goal:'約5分', steps:[
  ['患者確認を行い、説明して同意を得る', '取り違えを防ぎ、測定中に腕を動かさないよう協力を得るため'],
  ['手指衛生を行い、体温計を消毒して作動を確かめる', '感染を防ぎ、故障による誤った値を防ぐため'],
  ['食事・入浴・運動の直後でないか確かめる', 'これらの直後は体温が上がり、本来の値にならないため'],
  ['まひがある時は健側で測る', 'まひのある側は血流が少なく、体温が低く出ることがあるため'],
  ['腋窩の汗を乾いたタオルでふきとる', '汗があると気化熱で皮膚の温度が下がり、低く測定されるため'],
  ['体温計の先端を腋窩の最もくぼんだ所に当てる', '腋窩の中心は腋窩動脈に近く、体の内部の温度に近いため'],
  ['前下方から後上方へ、約30〜45度の角度で差しこむ', '先端が腋窩のくぼみの奥にしっかり密着するため'],
  ['腕をわきにつけ、反対の手でひじを軽く押さえてもらう', '腋窩を閉じて外気の影響をなくし、体温計がずれないようにするため'],
  ['実測式では10分以上はさんでおく', '腋窩の温度が安定して平衡温に達するまで約10分かかるため'],
  ['予測式は電子音が鳴ったら取り出して値を読む', '予測式は温度の上がり方から短時間で平衡温を予測するため'],
  ['寝衣を整え、体温計を消毒して片付ける', '安楽を保ち、次に使う時の感染を防ぐため'],
  ['手指衛生後、値と測定部位を記録する', '測定部位で値が異なるため、比べられるように記録する']
]},
{ id:'pulse-resp', name:'脈拍・呼吸の観察', cat:'観察・測定', goal:'約3分', steps:[
  ['患者確認を行い、説明して同意を得る', '取り違えを防ぎ、安心して安静にしてもらうため'],
  ['手指衛生を行い、秒針つきの時計を用意する', '感染を防ぎ、正確に時間を計るため'],
  ['安静にしている状態であることを確かめる', '活動や食事・入浴の後は脈拍や呼吸が増えるため'],
  ['示指・中指・環指の3本を橈骨動脈に当てる', '指先は感覚が鋭く、母指は自分の脈を感じてしまうため使わない'],
  ['1分間数え、リズム・強さ・緊張も観察する', '不整脈は短い時間では見落としやすく、回数だけでなく性状も大切なため'],
  ['必要時、左右の脈を比べて差をみる', '左右差は血管の狭窄などの異常のサインになるため'],
  ['脈が不整の時は心尖部で心拍も聴いて比べる', '心拍が末梢まで届かない脈拍欠損を見のがさないため'],
  ['脈をとる姿勢のまま、胸の動きで呼吸を数える', '呼吸は意識すると変わりやすいため、気づかれないように測る'],
  ['呼吸を1分間数え、深さ・リズムも観察する', '呼吸は回数が少なく、短時間では誤差が大きいうえに型の異常も大切なため'],
  ['顔色・口唇の色、息苦しさやSpO2も合わせてみる', 'チアノーゼや努力呼吸は酸素不足のサインとなるため'],
  ['衣服を整え、手指衛生を行う', '安楽を保ち、手を介した感染を防ぐため'],
  ['数値と性状を記録し、異常があれば報告する', '経過を比べられるようにし、異常に早く対応するため']
]},
{ id:'position-side', name:'体位変換（仰臥位から側臥位へ）', cat:'安楽・活動', goal:'約5分', steps:[
  ['患者確認を行い、目的と方法を説明して同意を得る', '不安をやわらげ、患者自身ができる動きの協力を得るため'],
  ['手指衛生を行い、枕やクッションを準備する', '感染を防ぎ、側臥位を安定させる物をそろえておくため'],
  ['ベッドを看護師の腰の高さにし、ストッパーをかける', '腰への負担を減らし、ベッドが動く事故を防ぐため'],
  ['足を前後に開き、腰を落として重心を低くする', '支持基底面を広げ重心を下げることで、看護師の腰痛を防ぐため'],
  ['向く側と反対の方へ、体を水平に寄せておく', '回転した後に体がベッドの中央にくるようにし、転落を防ぐため'],
  ['顔を向く側に向け、両腕を胸の上で組む', '体をコンパクトにまとめて、回転しやすくするため'],
  ['両膝をできるだけ高く立ててもらう', '膝を立てると支持面が小さくなり、てこの原理で少ない力で回せるため'],
  ['向く側に立ち、膝、肩の順に手前へ倒す', '膝を先に倒すと骨盤が回り、続いて上半身も楽に回るため'],
  ['腰を後ろへ引き、体をくの字にする', '支持基底面が広がり、体位が安定するため'],
  ['下側の肩を少し前へ引き出す', '下になった肩の圧迫と痛みを防ぐため'],
  ['背中に枕を当てて体を支える', '後ろに倒れるのを防ぎ、筋肉の緊張をやわらげるため'],
  ['上側の脚を曲げて前に出し、両膝の間に枕を入れる', '骨の出た部分どうしの圧迫を防ぎ、股関節の負担を減らすため'],
  ['寝衣とシーツのしわを伸ばし、柵を上げる', 'しわは褥瘡の原因になり、柵は転落を防ぐため'],
  ['安楽か・皮膚の発赤がないか確かめ、手指衛生後に記録する', '圧迫による異常を早く見つけ、次の体位変換の計画に生かすため']
]},
{ id:'transfer-wheelchair', name:'車いすへの移乗（ベッドから）', cat:'安楽・活動', goal:'約10分', steps:[
  ['説明と同意を得て、体調やめまいの有無を確かめる', '体調不良や起立性低血圧による転倒を防ぎ、協力を得るため'],
  ['手指衛生を行い、車いすのブレーキとタイヤを点検する', '故障があると移乗中に車いすが動き、転倒につながるため'],
  ['車いすを健側に置き、ベッドに20〜30度の角度をつける', '健側の足を軸に回ると移動距離が短く、力の入る側で体を支えられるため'],
  ['ブレーキをかけ、フットサポートを上げる', '車いすが動くのを防ぎ、足がひっかかって転ぶのを防ぐため'],
  ['ベッドを足底が床につく高さにし、端座位にする', '足底が床につくと座位が安定し、立ち上がりやすいため'],
  ['端座位でめまいや気分不良がないか確かめる', '起き上がった直後は起立性低血圧を起こしやすいため'],
  ['滑りにくい靴をはき、両足を床にしっかりつける', '足元を安定させ、滑って転倒するのを防ぐため'],
  ['浅く座り直し、足を少し後ろに引く', '重心を足の上に移しやすくし、立ち上がりやすくするため'],
  ['患側の膝折れを防ぎながら、前かがみで立ってもらう', '前かがみになると重心が足の上にのり、少ない力で立てるため'],
  ['健側の足を軸に回り、車いすに背を向ける', '力の入る健側で体重を支えることで、安全に向きを変えられるため'],
  ['ゆっくり腰を下ろし、深く座り直してもらう', '浅く座るとずり落ちて転落するおそれがあるため'],
  ['フットサポートを下ろし、足をのせる', '足が床にふれたまま進むと、巻きこまれてけがをするため'],
  ['姿勢・気分を確かめ、手指衛生後に記録する', '移乗後の体調の変化や姿勢のくずれを早く見つけるため']
]},
{ id:'bed-making', name:'ベッドメイキング（空床）', cat:'安楽・活動', goal:'約10分', steps:[
  ['手指衛生を行い、リネンを使う順に重ねて準備する', '使う順に重ねるとむだな動きが減り、手早く作業できるため'],
  ['周りの物をよけ、ベッドを腰の高さにしてストッパーをかける', '作業場所を確保し、腰への負担と事故を防ぐため'],
  ['足を前後に開き、腰を落として作業する', '支持基底面を広げ重心を低くすることで、腰痛を防ぐため'],
  ['使用済みリネンは汚れを内側に丸めて外し、床に置かない', 'ほこりや病原体を周りにまき散らさないため'],
  ['マットレスのずれや汚れを確かめる', 'ずれや汚れは寝心地を悪くし、感染や褥瘡の原因になるため'],
  ['シーツの中心線をマットレスの中心に合わせて広げる', '左右に均等にかかり、しわやたるみなく仕上げるため'],
  ['シーツは大きく振らずに静かに広げる', 'ほこりや微生物が舞い上がるのを防ぐため'],
  ['頭側からマットレスの下にしっかり入れこむ', '頭側は上半身の重みでずれやすいため、先に固定する'],
  ['角を三角に折って入れこむ', '角がくずれにくく、シーツのずれやしわを防ぐため'],
  ['側面を引っぱりながら、しわなく入れこむ', 'しわは皮膚を圧迫し、褥瘡の原因になるため'],
  ['反対側も同じようにしっかり引いて入れこむ', '両側を引くことで、たるみのない平らな面になるため'],
  ['掛け物を整え、足元にゆとりをつくる', '足先への圧迫を防ぎ、尖足を予防するため'],
  ['枕カバーをかけ、口を入口と反対に向けて置く', '入口から見て整って見え、ほこりも入りにくいため'],
  ['ベッドの高さと周りの物を元に戻し、手指衛生を行う', '転落を防ぐ安全な環境にもどし、リネンを扱った手の汚れを落とすため']
]},
{ id:'bed-bath', name:'全身清拭', cat:'清潔', goal:'約30分', steps:[
  ['説明と同意を得て、体調を確かめ排泄をすませてもらう', '疲労や急変を防ぎ、途中で中断しないようにするため'],
  ['室温を22〜26℃にし、カーテンを閉める', '露出による体温低下を防ぎ、プライバシーを守るため'],
  ['手指衛生を行い、50〜55℃の湯を準備する', 'タオルをしぼって皮膚にふれるまでに温度が下がるため、高めに用意する'],
  ['バスタオルをかけ、ふく部分だけを露出する', '不必要な露出を避け、羞恥心と寒さを減らすため'],
  ['顔は目頭から目尻へふき、面を変えて反対の目をふく', '目やにを外側へ出し、片方の目の汚れをもう片方に移さないため'],
  ['上肢は末梢から中枢へ向かってふく', '静脈の流れにそってふき、血液やリンパの還流を促すため'],
  ['石けんを使った時は石けん分を十分にふきとる', '石けん分が残ると、皮膚のかゆみや炎症の原因になるため'],
  ['ふいた所はすぐ乾いたタオルで水分をふきとる', '残った水分が蒸発する時に熱をうばい、体が冷えるため'],
  ['胸部をふき、腹部は腸の走行にそって「の」の字にふく', '腸を刺激して蠕動運動を促すため'],
  ['側臥位にして、背部・腰部の皮膚を観察しながらふく', '背部は汗がたまりやすく、褥瘡もできやすい部位であるため'],
  ['下肢は末梢から中枢へ向かってふく', '静脈の還流を促し、むくみを減らすため'],
  ['陰部は最後に別のタオルで前から後ろへふく', '肛門部の菌を尿道口へ広げないため'],
  ['寝衣は脱健着患で着せ、寝具を整える', 'まひや痛みのある側の関節に無理な力をかけないため'],
  ['疲労・皮膚の状態を観察し、手指衛生後に記録する', '清拭による体への負担や皮膚の異常を把握するため']
]},
{ id:'hair-wash', name:'洗髪（ベッド上）', cat:'清潔', goal:'約20分', steps:[
  ['説明と同意を得て、体調を確かめる（食直後は避ける）', '食後すぐは気分不良を起こしやすく、体調に合わせて負担を減らすため'],
  ['手指衛生を行い、室温を整えて物品を準備する', '頭がぬれると体が冷えやすいため、寒くない環境を整える'],
  ['湯を40℃前後に準備し、かける前に温度を確かめる', '熱すぎるとやけど、ぬるいと寒気の原因になるため'],
  ['頭をベッドの端に寄せ、膝の下に枕を入れる', '頭を洗髪器にのせやすくし、腹部の緊張と腰の負担を減らすため'],
  ['首にタオルを巻き、防水シーツと洗髪器を置く', '首まわりや寝具がぬれるのを防ぐため'],
  ['耳に綿花をつめ、目をガーゼやタオルで覆う', '耳や目に湯や泡が入るのを防ぐため'],
  ['髪を十分にぬらしてからシャンプーをつける', '汚れを浮かせ、シャンプーを泡立ちやすくするため'],
  ['指の腹で、生え際から頭頂へこするように洗う', '爪で頭皮を傷つけず、マッサージ効果で血行もよくするため'],
  ['後頭部は片手で頭を支えて持ち上げて洗う', '洗い残しやすい部位で、首に負担をかけないようにするため'],
  ['すすぐ前に泡をタオルでとり、湯で十分すすぐ', '湯の量を減らし、シャンプーが残って頭皮のかゆみになるのを防ぐため'],
  ['タオルで水分をふきとり、ドライヤーで乾かす', 'ぬれたままだと気化熱で体が冷え、頭皮に菌もふえやすいため'],
  ['ドライヤーは頭皮から20cm以上離して使う', '熱風による頭皮のやけどを防ぐため'],
  ['綿花を外し、髪と体位を整える', '安楽な姿勢に戻し、身だしなみを整えるため'],
  ['疲労や気分を観察し、手指衛生後に記録する', '洗髪中の姿勢や時間で疲労や気分不良を起こすことがあるため']
]},
{ id:'footbath', name:'足浴', cat:'清潔', goal:'約20分', steps:[
  ['説明と同意を得て、体調と足の傷の有無を確かめる', '感覚がにぶい人は、やけどや傷に気づきにくいため'],
  ['手指衛生を行い、38〜40℃の湯とさし湯を準備する', '熱すぎるとやけど、ぬるいと体が冷える原因になるため'],
  ['仰臥位では膝を立て、膝の下に枕を入れる', '下肢の緊張をとり、楽な姿勢で足をつけられるため'],
  ['防水シーツとバスタオルを敷き、ベースンを置く', '寝具や寝衣がぬれて体が冷えるのを防ぐため'],
  ['看護師が湯温を確かめ、患者にも確かめてもらう', 'やけどを防ぎ、患者の好みの温度にして安心してもらうため'],
  ['足を片方ずつゆっくりつけ、足底を底につける', '急な温度刺激を避け、足が安定して筋の緊張がとれるため'],
  ['5〜10分ほど湯につけて温める', '血行をよくし、皮膚の汚れを浮かせるため'],
  ['石けんで足指の間や爪のまわりまで洗う', '足指の間は汚れや白癬菌がたまりやすいため'],
  ['さし湯は足から離れた所に入れて湯温を保つ', '湯温を保ちながら、熱い湯が直接足にかかるのを防ぐため'],
  ['かけ湯ですすぎ、バスタオルで水分をふきとる', '石けん分を残さず、湯冷めを防ぐため'],
  ['足指の間の水分を特にていねいにふく', '湿ったままだと白癬などの感染や皮膚のふやけが起こりやすいため'],
  ['爪・皮膚の状態を観察し、靴下などで保温する', '傷や感染を早く見つけ、温まった足が冷えるのを防ぐため'],
  ['片付けと手指衛生を行い、記録する', '足浴の効果や皮膚の状態を次のケアに生かすため']
]},
{ id:'oral-care', name:'口腔ケア（ベッド上・自分でできない人）', cat:'清潔', goal:'約10分', steps:[
  ['説明と同意を得て、意識や飲みこみの状態を確かめる', 'むせやすさを知り、誤嚥の危険を予測するため'],
  ['手指衛生後、手袋・マスク・エプロンを着ける', '唾液や飛沫から自分と患者を守り、感染を広げないため'],
  ['すぐ使えるよう吸引の準備をしておく', 'むせた時にすぐ水分や分泌物をとり除き、誤嚥を防ぐため'],
  ['上半身を30度以上起こし、顔を横に向けあごを引く', '水分がのどに流れこみにくくなり、誤嚥を予防できるため'],
  ['口唇を湿らせてから口を開けてもらう', '乾いた口唇は口を開けた時に切れやすく、痛みを防ぐため'],
  ['義歯を外し、口の中の傷・汚れ・出血を観察する', '義歯の下の粘膜も清潔にし、口の中の異常を見つけるため'],
  ['歯ブラシの毛先を歯と歯肉の境目に45度で当てる', '歯垢がたまりやすい歯と歯肉の境目の汚れを落とすため'],
  ['軽い力で小刻みに動かし、1〜2本ずつみがく', '強くこすると歯肉を傷つけ、小刻みのほうが汚れがよく落ちるため'],
  ['舌や粘膜はスポンジブラシで奥から手前へふく', '汚れをのどの奥へ送りこまず、誤嚥を防ぐため'],
  ['汚れた水分はそのつど吸引するか、ふきとる', '汚れた唾液を飲みこむと誤嚥性肺炎の原因になるため'],
  ['義歯は流水でみがき、夜は水につけて保管する', '義歯は乾くと変形し、汚れが細菌のすみかになるため'],
  ['口唇に保湿剤をぬり、しばらく上半身を起こしておく', '口唇の乾燥を防ぎ、口に残った水分の誤嚥を防ぐため'],
  ['手指衛生後、口の中の状態を記録する', '口腔の変化を続けて観察し、ケアに生かすため']
]},
{ id:'feeding', name:'食事介助', cat:'食事・栄養', goal:'約30分', steps:[
  ['説明と同意を得て、排泄と手洗いをすませてもらう', '食事を中断せずにすみ、手から口への菌の侵入を防ぐため'],
  ['手指衛生後、食札で氏名と食事の種類を確かめる', '誤配膳や、アレルギー食・治療食の取り違えを防ぐため'],
  ['座位か上半身を起こした姿勢にし、あごを軽く引く', '頸部を前に曲げると気管に入りにくく、飲みこみやすいため'],
  ['看護師は患者の横に座り、目線を合わせる', '上からスプーンを運ぶとあごが上がり、誤嚥しやすくなるため'],
  ['献立を伝え、食べる順番の希望をきく', '食欲を高め、患者の好みを尊重するため'],
  ['はじめにお茶や汁物で口の中を湿らせる', '口の中やのどが湿ると、食べ物を飲みこみやすくなるため'],
  ['一口量はティースプーン1杯程度にする', '一口が多すぎると、むせや窒息の原因になるため'],
  ['スプーンを下唇にのせ、口が閉じたらまっすぐ引き抜く', '唇で食べ物をとりこむ動きを生かし、こぼれや誤嚥を防ぐため'],
  ['飲みこんだのを確かめてから次の一口を運ぶ', '口に残ったまま次を入れると、誤嚥や窒息の原因になるため'],
  ['片まひがある時は健側の口角から入れる', 'まひ側は感覚や動きが弱く、食べ物が残りやすいため'],
  ['むせ・顔色・疲労を観察し、ペースを合わせる', '疲れやむせは誤嚥のサインであり、早く気づいて対応するため'],
  ['食後は口腔ケアを行い、30分ほど上半身を起こしておく', '胃からの逆流や口の中の食べ残しによる誤嚥を防ぐため'],
  ['手指衛生後、摂取量と食事の様子を記録する', '栄養状態を評価し、次の介助方法に生かすため']
]},
{ id:'tube-feeding', name:'経管栄養（経鼻胃管からの注入）', cat:'食事・栄養', goal:'', steps:[
  ['指示書で患者・栄養剤の種類・量・速度・時間を確かめる', '指示どおりの内容を正しい患者に注入し、誤りを防ぐため'],
  ['説明と同意を得て、腹部の張りや吐き気がないか確かめる', '腹部症状がある時は注入で嘔吐や誤嚥を起こしやすいため'],
  ['手指衛生を行い、栄養剤を常温にして準備する', '冷たい栄養剤は腸を刺激し、下痢や腹痛の原因になるため'],
  ['上半身を30〜45度以上起こした体位にする', '胃の内容物の逆流と誤嚥を防ぐため'],
  ['鼻の固定位置の目盛りと、口の中のたわみを確かめる', 'チューブが抜けかけて、先端が胃から外れていないか確かめるため'],
  ['シリンジで胃内容物を吸引し、性状とpHを確かめる', '胃液が引けて酸性（pH5.5以下）なら、先端が胃にある根拠になるため'],
  ['気泡音だけに頼らず、疑わしい時は注入せず医師に報告する', '気泡音は先端が気管にあっても聞こえることがあり、確実な確認にはX線が必要なため'],
  ['栄養剤をボトルに入れ、チューブの先まで満たす', 'チューブ内の空気が胃に入ると、腹部の張りや不快の原因になるため'],
  ['ボトルを胃より約50cm高くつるし、接続する', '適切な高さの落差で、安定した速度で滴下できるため'],
  ['指示の速度でゆっくり滴下する', '速すぎると下痢・嘔吐・腹部の張りの原因になるため'],
  ['注入中はむせ・嘔吐・腹部の張り・顔色を観察する', '誤嚥や消化器症状を早く見つけ、すぐに中止するため'],
  ['終了後、白湯20〜30mLを流してチューブ内を洗う', 'チューブ内に残った栄養剤は、つまりや細菌の繁殖の原因になるため'],
  ['注入後30分〜1時間は上半身を起こしたままにする', '胃からの逆流による誤嚥を防ぐため'],
  ['手指衛生後、注入量・時間・患者の様子を記録する', '栄養や消化の状態を評価し、次の注入に生かすため']
]},
{ id:'oral-med', name:'与薬（経口）・6Rの確認', cat:'与薬', goal:'約10分', steps:[
  ['指示書と薬を照らし合わせ、6Rを確認する', '正しい患者・薬・目的・用量・用法・時間を確かめ、誤薬を防ぐため'],
  ['薬を取り出す時・準備する時・与える前の3回確認する', 'くり返し確認することで、見落としによる誤薬を防ぐため'],
  ['薬の作用・副作用と、患者のアレルギーを確かめる', '与えてよい状態かを判断し、副作用に早く気づくため'],
  ['手指衛生を行い、薬に直接ふれずに準備する', '手や器具から薬が汚染されるのを防ぐため'],
  ['患者にフルネームを名乗ってもらい、リストバンドと照合する', '同姓同名などによる患者の取り違えを防ぐため'],
  ['薬の目的と飲み方を説明し、同意を得る', '患者が納得して服薬し、自分でも確認できるようにするため'],
  ['座位かファウラー位にして上半身を起こす', '薬が食道にとどまらず、誤嚥しにくい姿勢にするため'],
  ['先に水を一口飲んで口の中を湿らせてもらう', '口の中が乾いていると、薬が張りついて飲みにくいため'],
  ['コップ1杯程度の水かぬるま湯で飲んでもらう', '薬が食道に残ると粘膜を傷つけ、溶け方や吸収にも影響するため'],
  ['飲みこんだことを確認する', '飲み忘れや、口の中にためて捨てることを防ぐため'],
  ['服用後しばらく上半身を起こしておく', '薬が食道にとどまり、潰瘍などを起こすのを防ぐため'],
  ['手指衛生後、与薬したことをすぐ記録する', '重複して与えたり、与え忘れたりするのを防ぐため'],
  ['薬の効果や副作用が出ていないか観察する', '効き目を評価し、副作用に早く気づいて対応するため']
]},
{ id:'sterile', name:'無菌操作（滅菌手袋の装着・滅菌物の扱い）', cat:'感染予防', goal:'約5分', steps:[
  ['手指衛生を行い、作業台を清潔にして乾かす', '湿った面では菌が包装や布をしみ通り、滅菌物を汚染するため'],
  ['滅菌物の有効期限・包装の破れ・インジケータを確かめる', '期限切れや破損、滅菌不十分の物は無菌が保証されないため'],
  ['滅菌包は向こう側、左右、手前の順に開く', '開いた滅菌面の上を腕が通らず、内側を汚さないため'],
  ['滅菌布の縁から約2〜3cmは不潔とみなす', '縁は手がふれやすく、清潔と不潔の境目があいまいなため'],
  ['滅菌物は腰より上、視野の中で扱う', '見えない所や腰より下では、気づかないうちに汚染されやすいため'],
  ['滅菌鑷子は先端を下に向けて持つ', '先端を上に向けると、手元側の水分が先端へ流れて汚染するため'],
  ['滅菌物の上で話したり、腕を通したりしない', '飛沫やほこりが落ちて滅菌物を汚染するため'],
  ['滅菌手袋の外袋を開け、内包を清潔な台の上で開く', '手袋の滅菌面を汚さずに取り出せるようにするため'],
  ['素手で折り返しの内側をつまみ、片方の手に着ける', '素手でふれてよいのは、皮膚側になる手袋の内側だけのため'],
  ['手袋をした指を、もう片方の折り返しの中に入れて着ける', '滅菌面どうしだけがふれ、素手が外側にふれないため'],
  ['折り返しを伸ばし、指先を整える', '手首まで覆い、滅菌面どうしで整えることで無菌を保つため'],
  ['装着後は手を腰より上、胸の前に保つ', '視野から外れたり下がったりすると、汚染に気づけないため'],
  ['汚染した、または疑わしい時はすぐ交換する', '疑わしい物は不潔とみなすのが無菌操作の原則であるため'],
  ['使用後は物品を片付け、手袋を外して手指衛生を行う', '使用後の物品や手を介して感染が広がるのを防ぐため']
]},
{ id:'suction', name:'口腔内・鼻腔内吸引', cat:'呼吸・排泄', goal:'約5分', steps:[
  ['呼吸音・SpO2・分泌物の位置から必要性を判断する', '不必要な吸引は苦痛と粘膜の損傷を招くため、必要な時だけ行う'],
  ['説明と同意を得る（苦しさがあることも伝える）', '苦痛をともなう処置のため、不安をやわらげ協力を得る'],
  ['手指衛生後、マスク・ゴーグル・エプロン・手袋を着ける', '分泌物の飛散から身を守り、感染を広げないため'],
  ['上半身を少し起こし、顔を横に向ける', '分泌物を出しやすくし、嘔吐した時の誤嚥を防ぐため'],
  ['吸引圧を成人で20〜26kPa（150〜200mmHg）に設定する', '圧が高すぎると粘膜を傷つけ、低酸素や出血の原因になるため'],
  ['カテーテルを先端にふれずに接続し、水を吸って作動を確かめる', '先端の汚染を防ぎ、吸引圧と通りを確かめるため'],
  ['カテーテルを折って陰圧をかけずに挿入する', '陰圧のまま入れると粘膜に吸いつき、傷つけるため'],
  ['口腔は頬の内側や舌の下にたまった分泌物を吸う', 'のどの奥を強く刺激すると嘔吐反射を起こすため'],
  ['鼻腔は顔に垂直に、鼻の底にそって約15〜20cm入れる', '鼻腔は顔の奥へ水平に続いており、上向きに入れると粘膜を傷つけるため'],
  ['陰圧をかけ、回しながらゆっくり引き抜く', '一か所に吸いつかず、分泌物をまんべんなく吸引できるため'],
  ['1回の吸引は10〜15秒以内にする', '吸引中は空気も吸われるので、長いと低酸素を起こすため'],
  ['カテーテルの外側をふき、水を吸って内側を洗う', 'カテーテル内の分泌物をとり、つまりや細菌の繁殖を防ぐため'],
  ['くり返す時は呼吸とSpO2が回復してから行う', '続けて吸引すると低酸素が進むため'],
  ['手指衛生後、分泌物の量・性状とSpO2を記録する', '吸引の効果や感染・出血などの異常を評価し、次のケアに生かすため']
]},
{ id:'catheter-female', name:'一時的導尿（女性）', cat:'呼吸・排泄', goal:'約15分', steps:[
  ['説明と同意を得て、カーテンを閉める', '羞恥心の強い処置のため、プライバシーを守り協力を得る'],
  ['手指衛生を行い、導尿セットの期限と破損を確かめる', '滅菌が保たれた物品を使い、尿路感染を防ぐため'],
  ['仰臥位で膝を立てて開き、バスタオルで覆う', '尿道口が見やすく操作しやすい姿勢にし、不必要な露出を避けるため'],
  ['導尿セットを無菌的に開き、滅菌手袋を着ける', '膀胱に入るカテーテルの無菌を保ち、尿路感染を防ぐため'],
  ['カテーテルの先端に潤滑剤をつける', '挿入時の摩擦を減らし、尿道粘膜の損傷と痛みを防ぐため'],
  ['利き手でない手で小陰唇を開き、最後まで離さない', '手を離すと小陰唇が閉じ、消毒した尿道口が汚染されるため'],
  ['綿球1個で1回、上から下へ尿道口と周りを消毒する', '肛門側の菌を尿道口に運ばず、使った綿球で汚染しないため'],
  ['口で息をはいてもらいながら、約4〜6cm挿入する', '腹圧がぬけて尿道括約筋がゆるみ、挿入しやすく痛みも減るため'],
  ['尿が出たら、さらに1〜2cm進める', 'カテーテルの先端の穴を膀胱内に確実に入れるため'],
  ['腟に入った時は新しいカテーテルにかえる', '腟の菌で汚染されたカテーテルを尿道に入れると感染するため'],
  ['尿の流出を見守り、一度に大量に出しすぎない', '膀胱内圧が急に下がると、血圧低下や膀胱の出血を起こすため'],
  ['尿が止まったらゆっくり抜き、陰部をふいて寝衣を整える', '尿道粘膜を傷つけず、清潔とプライバシーを保つため'],
  ['手指衛生後、尿量・性状・患者の反応を記録する', '腎臓や膀胱の状態を評価し、次の排尿ケアに生かすため']
]}
];

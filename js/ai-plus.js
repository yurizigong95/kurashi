/* くらしの手帳：AIの強化（直接登録・ネット検索・URL・PDF・手書き・会話モード・自然な声・週のふりかえり） */
/* ============================== AIに頼むと、そのまま登録 ==============================
   Geminiの「関数呼び出し」で、予定・課題・テスト・バイト・メモ・家計簿を直接入れる。
   入れたものは、その答えの下の「取り消す」で元に戻せる。                            */
var CHAT_FUNCS = [
  { name:'add_event', description:'予定（ふつうの予定・大事な予定）を手帳に登録する。登録を頼まれたときだけ使う。',
    parameters:{ type:'OBJECT', properties:{
      title:{ type:'STRING', description:'予定の名前' }, date:{ type:'STRING', description:'日付 YYYY-MM-DD' },
      time:{ type:'STRING', description:'開始時刻 HH:MM。なければ空' }, end:{ type:'STRING', description:'終了時刻 HH:MM。なければ空' },
      important:{ type:'BOOLEAN', description:'大事な予定なら true' }, memo:{ type:'STRING', description:'メモ' } }, required:['title', 'date'] } },
  { name:'add_task', description:'課題（締切のあるやること）を登録する。',
    parameters:{ type:'OBJECT', properties:{
      title:{ type:'STRING' }, due:{ type:'STRING', description:'締切日 YYYY-MM-DD' }, time:{ type:'STRING', description:'締切時刻 HH:MM。なければ空' },
      subject:{ type:'STRING', description:'科目名（時間割にある名前）。なければ空' }, memo:{ type:'STRING' } }, required:['title', 'due'] } },
  { name:'add_exam', description:'小テスト・テスト・考査を登録する。',
    parameters:{ type:'OBJECT', properties:{
      subject:{ type:'STRING', description:'科目名' }, date:{ type:'STRING', description:'YYYY-MM-DD' }, time:{ type:'STRING' },
      kind:{ type:'STRING', enum:['quiz', 'exam', 'kousa'], description:'quiz=小テスト exam=テスト kousa=考査' }, title:{ type:'STRING' }, room:{ type:'STRING' } },
      required:['subject', 'date', 'kind'] } },
  { name:'add_shift', description:'バイトのシフトを登録する。',
    parameters:{ type:'OBJECT', properties:{ date:{ type:'STRING' }, start:{ type:'STRING', description:'HH:MM' }, end:{ type:'STRING', description:'HH:MM' }, memo:{ type:'STRING' } },
      required:['date', 'start', 'end'] } },
  { name:'complete_task', description:'課題を完了にする。',
    parameters:{ type:'OBJECT', properties:{ title:{ type:'STRING', description:'課題の名前（一部でよい）' } }, required:['title'] } },
  { name:'add_memo', description:'メモを作る。',
    parameters:{ type:'OBJECT', properties:{ title:{ type:'STRING' }, body:{ type:'STRING' } }, required:['body'] } },
  { name:'add_spend', description:'使ったお金を家計簿に記録する。',
    parameters:{ type:'OBJECT', properties:{ amount:{ type:'NUMBER', description:'円' }, title:{ type:'STRING', description:'お店や内容' },
      date:{ type:'STRING', description:'YYYY-MM-DD。今日なら空' },
      category:{ type:'STRING', enum:['food', 'daily', 'move', 'study', 'wear', 'fun', 'friend', 'health', 'phone', 'other'] } }, required:['amount'] } }
];
function aiDirectOn(){ return S.ui.aiDirect !== 0; }
function hhmmOk(v){ return /^\d{1,2}:\d{2}$/.test(String(v || '')) ? hhmmOf(minutesOf(v)) : ''; }
function subjectMatch(name){
  var n = String(name || '').trim();
  if(!n) return '';
  var hit = termCourses().filter(function(c){ return sameSubject(c.name, n) || c.name.indexOf(n) >= 0; })[0];
  return hit ? hit.name : n;
}
/* 関数を実行して、結果（AIに返す文）と、取り消し用の記録を返す */
function aiRunFunc(call){
  var a = call.args || {}, now = Date.now(), id;
  switch(call.name){
    case 'add_event':
      if(!isYmd(a.date) || !a.title) return { result:'日付か名前がありません' };
      id = uid('ev');
      S.events.push({ id:id, date:a.date, dateEnd:'', title:String(a.title).slice(0, 80), subject:'', time:hhmmOk(a.time),
        kind:a.important ? 'imp' : 'other', memo:(hhmmOk(a.end) ? '〜' + hhmmOk(a.end) + (a.memo ? '　' : '') : '') + String(a.memo || ''), photos:[], mt:now });
      return { result:'登録しました', op:{ t:'add', list:'events', id:id, label:'予定「' + a.title + '」（' + ymdLabel(a.date) + (hhmmOk(a.time) ? ' ' + hhmmOk(a.time) : '') + '）' } };
    case 'add_task':
      if(!isYmd(a.due) || !a.title) return { result:'締切日か名前がありません' };
      id = uid('tk');
      S.tasks.push({ id:id, title:String(a.title).slice(0, 80), subject:subjectMatch(a.subject), due:a.due, time:hhmmOk(a.time),
        done:0, memo:String(a.memo || ''), subs:[], photos:[], pri:1, how:'', url:'', mt:now });
      return { result:'登録しました', op:{ t:'add', list:'tasks', id:id, label:'課題「' + a.title + '」（締切 ' + ymdLabel(a.due) + '）' } };
    case 'add_exam':
      if(!isYmd(a.date)) return { result:'日付がありません' };
      id = uid('ex');
      var kind = ['quiz', 'exam', 'kousa'].indexOf(a.kind) >= 0 ? a.kind : 'exam';
      S.exams.push({ id:id, subject:subjectMatch(a.subject), title:String(a.title || ''), date:a.date, time:hhmmOk(a.time), kind:kind,
        room:String(a.room || ''), memo:'', photos:[], mt:now });
      return { result:'登録しました', op:{ t:'add', list:'exams', id:id, label:kindOf(kind).name + '「' + (a.subject || '') + '」（' + ymdLabel(a.date) + '）' } };
    case 'add_shift':
      if(!isYmd(a.date) || !hhmmOk(a.start) || !hhmmOk(a.end)) return { result:'日付か時刻がありません' };
      id = uid('wk');
      S.shifts.push({ id:id, title:'バイト', date:a.date, start:hhmmOk(a.start), end:hhmmOk(a.end), realEnd:'', ot:0, rate:0,
        memo:String(a.memo || ''), photos:[], mt:now });
      return { result:'登録しました', op:{ t:'add', list:'shifts', id:id, label:'バイト（' + ymdLabel(a.date) + ' ' + hhmmOk(a.start) + '〜' + hhmmOk(a.end) + '）' } };
    case 'complete_task':
      var q = norm(a.title || '');
      var hit = S.tasks.filter(function(t){ return !t.done && q && norm(t.title).indexOf(q) >= 0; })
        .sort(function(x, y){ return String(x.due || '9').localeCompare(String(y.due || '9')); })[0];
      if(!hit) return { result:'その名前の、終わっていない課題は見つかりませんでした' };
      hit.done = 1; hit.mt = now;
      S.taskLog = S.taskLog || {};
      return { result:'「' + hit.title + '」を完了にしました', op:{ t:'done', id:hit.id, label:'課題「' + hit.title + '」を完了' } };
    case 'add_memo':
      id = uid('nt');
      S.notes.push({ id:id, title:String(a.title || 'AIのメモ').slice(0, 60), body:String(a.body || ''), pinned:0, checks:[], photos:[], link:null, ct:now, mt:now });
      return { result:'メモを作りました', op:{ t:'add', list:'notes', id:id, label:'メモ「' + (a.title || 'AIのメモ') + '」' } };
    case 'add_spend':
      if(typeof kbAdd !== 'function') return { result:'家計簿が使えません' };
      var it = kbAdd({ amount:a.amount, title:a.title || '', date:isYmd(a.date) ? a.date : today(), cat:a.category, src:'hand', ref:uid('ref') });
      if(!it) return { result:'金額がありません' };
      return { result:'家計簿に記録しました', op:{ t:'add', list:'spends', id:it.id, label:'家計簿 ' + yen(it.amount) + (it.title ? '（' + it.title + '）' : '') } };
    default:
      /* 手帳を読む道具（aidata.js）・足した機能の道具（kmChatTool） */
      if(typeof aiDataRun === 'function'){ var rd = aiDataRun(call); if(rd) return rd; }
      if(typeof KM !== 'undefined'){
        var kt = KM.chatTools.filter(function(x){ return x.decl.name === call.name; })[0];
        if(kt){ try{ return kt.run(a) || { result:'できました' }; }catch(e){ return { result:'できませんでした：' + (e && e.message || e) }; } }
      }
      return { result:'この道具は使えません' };
  }
}
function chatIsWrite(name){
  if(CHAT_FUNCS.some(function(f){ return f.name === name; })) return true;
  return typeof KM !== 'undefined' && KM.chatTools.some(function(x){ return x.write && x.decl.name === name; });
}
/* そうだんで使う道具：読む道具はいつも、書く道具は「直接登録」がオンのときだけ */
function chatFuncDecls(){
  var list = [];
  if(aiDirectOn()) list = list.concat(CHAT_FUNCS);
  if(typeof AI_DATA_FUNCS !== 'undefined') list = list.concat(AI_DATA_FUNCS);
  if(typeof KM !== 'undefined') KM.chatTools.forEach(function(x){ if(!x.write || aiDirectOn()) list.push(x.decl); });
  return list;
}
function aiUndoOps(ops){
  (ops || []).slice().reverse().forEach(function(op){
    if(op.t === 'add') removeItem(op.list, op.id);
    if(op.t === 'done'){
      var t = S.tasks.filter(function(x){ return x.id === op.id; })[0];
      if(t){ t.done = 0; t.mt = Date.now(); }
    }
  });
}

/* ============================== ネットで調べる・URLを読む ============================== */
var chatWeb = false;
/* 手帳の中のことを「調べて」と言われたときは、ネットではなく手帳を調べる */
var CHAT_APP_WORDS = /手帳|アプリ|家計簿|予定|課題|メモ|カード|暗記|国試|過去問|時間割|授業|出席|成績|バイト|シフト|お金|残高|おせわ|健康|睡眠|歩数|記録|ノート|テスト|ToDo|やること|明細/;
function chatWantsWeb(text){
  if(chatWeb || /https?:\/\//.test(text)) return true;
  if(/検索して|ネットで|ウェブで|最新の|ニュース|今の(値段|価格)|公式サイト/.test(text)) return true;
  return /調べて/.test(text) && !CHAT_APP_WORDS.test(text);
}
function groundSources(g){
  var out = [], seen = {};
  ((g && g.groundingChunks) || []).forEach(function(c){
    var w = c.web || c.retrievedContext;
    if(!w || !/^https?:\/\//.test(String(w.uri || '')) || seen[w.uri]) return;
    seen[w.uri] = 1;
    out.push({ t:String(w.title || w.uri).slice(0, 80), u:String(w.uri) });
  });
  return out.slice(0, 6);
}

/* ============================== そうだん：まとめて頼む ============================== */
/* opt: { system, contents, signal, text, voice, talk } → { text, ops, src, sep } */
async function chatAsk(opt){
  var web = chatWantsWeb(opt.text || '');
  var tools = [];
  if(web){
    tools.push({ google_search:{} });
    if(/https?:\/\//.test(opt.text || '')) tools.push({ url_context:{} });
  }else{
    var decls = chatFuncDecls();
    if(decls.length) tools.push({ functionDeclarations:decls });
  }
  var system = opt.system + (web ? '\n【ネット】必要ならGoogle検索や、送られたURLの中身を使って答える。出典のない思いこみは書かない。' : '') +
    (!web && typeof AI_DATA_FUNCS !== 'undefined' ? '\n【手帳を調べる】最初にわたした「アプリの中身」は要約です。家計簿の明細・暗記カード・国試の記録・メモの全文・おせわ・健康・設定など、' +
      '要約にないことや、くわしいことを聞かれたら、道具 app_overview / get_app_data / search_app で手帳を調べてから答える。調べても無いときだけ「アプリに登録がありません」と言う。' +
      '\n【分野と件数】' + aiIndexText() : '') +
    (!web && aiDirectOn() ? '\n【登録】「入れて」「登録して」「追加して」「完了にして」「記録して」とはっきり頼まれたときだけ、道具（関数）を使って手帳に直接登録する。登録したら、何をいつ入れたかを短く伝える。頼まれていないときは道具を使わない。' : '') +
    (opt.talk ? '\n【声の会話】いまは声だけで話している。2文以内で、記号や箇条書きを使わずに話し言葉で答える。' : '');
  var contents = opt.contents.slice();
  var ops = [], res = null;
  var maxTok = (S.ui.aiLen === 'long') ? 3000 : 2048;
  for(var round = 0; round < 4; round++){
    res = await aiCall({ system:system, contents:contents, tools:tools, temperature:0.3, maxTokens:maxTok, signal:opt.signal, tag:'chat' });
    if(!res.calls.length) break;
    var replies = [];
    for(var ci = 0; ci < res.calls.length; ci++){
      var call = res.calls[ci], r;
      /* 「直接登録」がオフのときは、書きこむ道具は動かさない（読む道具だけ） */
      try{
        r = (!aiDirectOn() && chatIsWrite(call.name)) ? { result:'直接登録はオフです。手帳には入れずに、入れ方だけを伝えてください。' } : aiRunFunc(call);
        /* 足した機能の道具が、あとで答えるもの（Promise）を返したときは待つ */
        if(r && typeof r.then === 'function') r = await r;
      }catch(e){ r = { result:'できませんでした：' + (e && e.message || e) }; }
      if(!r || typeof r !== 'object') r = { result:r == null ? 'できました' : String(r) };
      if(r.op) ops.push(r.op);
      replies.push({ functionResponse:{ name:call.name, response:{ result:r.result == null ? '' : r.result } } });
    }
    contents.push(res.content);
    contents.push({ role:'user', parts:replies });
  }
  var text = res ? res.text : '';
  if(!text && ops.length) text = '手帳に入れました：\n' + ops.map(function(o){ return '・' + o.label; }).join('\n');
  var out = { text:text, ops:ops };
  if(res && res.grounding){
    out.src = groundSources(res.grounding);
    var sep = res.grounding.searchEntryPoint && res.grounding.searchEntryPoint.renderedContent;
    if(sep && sep.length < 12000) out.sep = sep;
  }
  return out;
}
/* 答えの下に出す：登録したもの・出典・Googleの検索候補 */
function chatExtrasHtml(m, i){
  var h = '';
  if((m.ops || []).length){
    h += '<div class="aiops"><div class="s2">手帳に入れました</div>' + m.ops.map(function(o){ return '<div class="aiop">✓ ' + esc(o.label) + '</div>'; }).join('') +
      (m.undone ? '<div class="s2">取り消しました</div>' : '<button class="mini" data-act="chat-undo" data-i="' + i + '">取り消す</button>') + '</div>';
  }
  if((m.src || []).length){
    h += '<div class="aisrc"><div class="s2">出典</div>' + m.src.map(function(s){
      return '<a href="' + esc(s.u) + '" target="_blank" rel="noopener noreferrer">' + esc(s.t) + '</a>';
    }).join('') + '</div>';
  }
  if(m.sep){
    h += '<iframe class="aisep" title="Googleで検索" sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc="' +
      esc('<base target="_blank">' + m.sep) + '"></iframe>';
  }
  return h;
}
/* 添付があるときの、すぐ頼めるボタン */
function chatAttChips(){
  if(!chatFiles.length) return '';
  var hasImg = chatFiles.some(function(f){ return f.kind === 'image'; });
  var hasPdf = chatFiles.some(function(f){ return /pdf/i.test(f.mime); });
  var chips = [];
  if(hasPdf || hasImg) chips.push(['sum', hasPdf ? 'PDFを要約' : '写真の内容をまとめる']);
  if(hasImg) chips.push(['hand', '手書きを文字に']);
  chips.push(['quiz', '確認問題を作る']);
  chips.push(['date', '日付・締切を探して登録']);
  return '<div class="chips" style="margin:6px 0">' + chips.map(function(c){
    return '<button data-act="att-ask" data-v="' + c[0] + '">' + c[1] + '</button>';
  }).join('') + '</div>';
}
var ATT_PROMPTS = {
  sum:'添付した資料の内容を要約して。大事なポイントを箇条書きで、日付・締切・持ち物があれば最後にまとめて。',
  hand:'添付した画像の手書きの文字を、そのまま正確に文字に起こして。読めないところは［？］にして、説明は書かないで。',
  quiz:'添付した資料から、理解を確かめる問題を5問作って。答えと短い解説は最後にまとめて。',
  date:'添付した資料から、日付・締切・テストの予定を探して、手帳に登録して。何を登録したか教えて。'
};
/* ============================== 自然な声（Gemini の読み上げ） ============================== */
var TTS_MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'];
var TTS_VOICES = [
  ['', 'おまかせ（キャラに合わせる）'], ['Leda', 'わかわかしい'], ['Aoede', 'さわやか'], ['Kore', 'しっかり'],
  ['Puck', '明るい'], ['Achernar', 'やわらかい'], ['Vindemiatrix', 'おだやか'], ['Sulafat', 'あたたかい'],
  ['Laomedeia', 'はずむ'], ['Callirrhoe', 'のんびり'], ['Zephyr', 'かがやく'], ['Charon', '落ちついた']
];
var tts = { ctx:null, src:null, cache:{}, playing:false };
function ttsEngine(){ return S.ui.voiceEngine === 'gemini' ? 'gemini' : 'browser'; }
function ttsVoice(){
  if(S.ui.ttsVoice) return S.ui.ttsVoice;
  var pool = ['Leda', 'Aoede', 'Puck', 'Achernar', 'Sulafat', 'Laomedeia', 'Callirrhoe', 'Zephyr'];
  var id = (typeof charaNow === 'function') ? charaNow().id : 'mochi';
  return pool[parseInt(hash53(id).slice(0, 6), 36) % pool.length];
}
/* iPhoneでは、ボタンを押したときに音を出す準備をしておく */
function ttsUnlock(){
  try{
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    if(!tts.ctx) tts.ctx = new AC();
    if(tts.ctx.state === 'suspended') tts.ctx.resume();
  }catch(e){}
}
function ttsStop(){
  try{ if(tts.src) tts.src.stop(); }catch(e){}
  tts.src = null; tts.playing = false;
  try{ if(window.speechSynthesis) window.speechSynthesis.cancel(); }catch(e){}
}
function ttsClean(text){
  return String(text || '').replace(/根拠：.*$/m, '').replace(/https?:\/\/\S+/g, '').replace(/[＊*#・•|｜]/g, ' ').replace(/\n{2,}/g, '\n').trim().slice(0, 1200);
}
function ttsBrowser(text){
  return new Promise(function(res){
    if(!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined'){ res(); return; }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; u.rate = 1.05;
    var ja = (window.speechSynthesis.getVoices() || []).filter(function(v){ return /^ja/i.test(v.lang); })[0];
    if(ja) u.voice = ja;
    u.onend = u.onerror = function(){ res(); };
    window.speechSynthesis.speak(u);
  });
}
async function ttsGeminiAudio(text){
  var voice = ttsVoice(), k = hash53(voice + '|' + text);
  if(tts.cache[k]) return tts.cache[k];
  var key = aiKey();
  if(!key) throw new Error('APIキーがありません');
  var lastErr = '';
  for(var i = 0; i < TTS_MODELS.length; i++){
    var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + TTS_MODELS[i] + ':generateContent', {
      method:'POST', headers:{ 'Content-Type':'application/json', 'x-goog-api-key':key },
      body: JSON.stringify({
        contents:[{ parts:[{ text:'やさしく、明るく、聞き取りやすく読んでください：\n' + text }] }],
        generationConfig:{ responseModalities:['AUDIO'], speechConfig:{ voiceConfig:{ prebuiltVoiceConfig:{ voiceName:voice } } } }
      })
    });
    var j = null;
    try{ j = await res.json(); }catch(e){}
    var part = j && j.candidates && j.candidates[0] && j.candidates[0].content && (j.candidates[0].content.parts || [])[0];
    var inl = part && (part.inlineData || part.inline_data);
    if(res.ok && inl && inl.data){
      aiCountAdd();
      var rate = Number((String(inl.mimeType || inl.mime_type || '').match(/rate=(\d+)/) || [])[1]) || 24000;
      var out = { data:inl.data, rate:rate };
      tts.cache[k] = out;
      return out;
    }
    lastErr = (j && j.error && j.error.message) || ('エラー ' + res.status);
    if(!/not found|NOT_FOUND|not available|unsupported/i.test(lastErr)) break;
  }
  throw new Error(aiErrText(lastErr));
}
function ttsPlayPcm(a){
  return new Promise(function(res, rej){
    try{
      ttsUnlock();
      var bin = atob(a.data), n = Math.floor(bin.length / 2);
      var buf = tts.ctx.createBuffer(1, n, a.rate), ch = buf.getChannelData(0);
      for(var i = 0; i < n; i++){
        var v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
        if(v >= 32768) v -= 65536;
        ch[i] = v / 32768;
      }
      var src = tts.ctx.createBufferSource();
      src.buffer = buf; src.connect(tts.ctx.destination);
      src.onended = function(){ if(tts.src === src){ tts.src = null; tts.playing = false; } res(); };
      tts.src = src; tts.playing = true;
      src.start();
    }catch(e){ rej(e); }
  });
}
/* 読み上げる（終わったら resolve）。AIの声が使えないときは、ブラウザの声にする */
async function ttsSpeak(text){
  ttsStop();
  text = ttsClean(text);
  if(!text) return;
  if(ttsEngine() === 'gemini' && aiReady() && !TEST_MODE){
    try{ return await ttsPlayPcm(await ttsGeminiAudio(text)); }
    catch(e){ logErr('読み上げ', 'AIの声が使えなかったので、ふつうの声にしました：' + e.message); }
  }
  return ttsBrowser(text);
}

/* ============================== 声だけで会話する ============================== */
var talk = { on:false, phase:'', text:'', err:'' };
function talkUi(){
  var el = document.getElementById('talkui');
  if(!talk.on){ if(el) el.remove(); return; }
  if(!el){
    el = document.createElement('div');
    el.id = 'talkui';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '声で会話');
    el.addEventListener('click', function(e){
      var b = e.target.closest('[data-talk]');
      if(!b) return;
      if(b.dataset.talk === 'stop') talkStop();
      if(b.dataset.talk === 'skip'){ ttsStop(); }
    });
    document.body.appendChild(el);
  }
  var face = (typeof charaSvg === 'function' && charaLevel() > 0)
    ? charaSvg({ size:120, expr:talk.phase === 'listen' ? 'think' : talk.phase === 'speak' ? 'happy' : 'normal', anim:talk.phase === 'speak' ? 'bounce' : 'float', still:true }) : '🎙';
  el.innerHTML = '<div class="talkcard"><div class="talkface ph-' + talk.phase + '">' + face + '</div>' +
    '<div class="talkst">' + ({ listen:'聞いています… 話してください', think:'考えています…', speak:'話しています' }[talk.phase] || '') + '</div>' +
    (talk.text ? '<div class="talktx">' + esc(talk.text) + '</div>' : '') +
    (talk.err ? '<div class="talkerr">' + esc(talk.err) + '</div>' : '') +
    '<div class="pillrow" style="justify-content:center">' + (talk.phase === 'speak' ? '<button data-talk="skip">話をとばす</button>' : '') +
    '<button data-talk="stop" class="on">会話をおわる</button></div></div>';
  if(typeof photoFill === 'function') photoFill();
}
function listenOnce(){
  return new Promise(function(res, rej){
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(SR){
      var rec = new SR(), got = '', settled = false;
      rec.lang = 'ja-JP'; rec.interimResults = true; rec.continuous = false;
      rec.onresult = function(e){
        var s = '';
        for(var i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
        got = s; talk.text = s; talkUi();
      };
      rec.onerror = function(e){ if(!settled){ settled = true; e.error === 'no-speech' ? res('') : rej(new Error(e.error === 'not-allowed' ? 'マイクが許可されていません' : '聞き取れませんでした')); } };
      rec.onend = function(){ if(!settled){ settled = true; res(got.trim()); } };
      talk.stopListen = function(){ try{ rec.abort(); }catch(err){} };
      rec.start();
      return;
    }
    /* 聞き取りがない端末：録音して、静かになったら止めてAIに文字にしてもらう */
    if(!(window.MediaRecorder && navigator.mediaDevices)){ rej(new Error('この端末では声の入力が使えません')); return; }
    navigator.mediaDevices.getUserMedia({ audio:true }).then(function(stream){
      var mr = new MediaRecorder(stream), chunks = [], AC = window.AudioContext || window.webkitAudioContext;
      var ac = AC ? new AC() : null, an = null, quietSince = 0, heard = false, t0 = Date.now();
      if(ac){ an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an); }
      var data = an ? new Uint8Array(an.fftSize) : null;
      var timer = setInterval(function(){
        if(!an) return;
        an.getByteTimeDomainData(data);
        var peak = 0;
        for(var i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
        if(peak > 14){ heard = true; quietSince = 0; }
        else if(heard){ quietSince = quietSince || Date.now(); if(Date.now() - quietSince > 1300) stop(); }
        if(Date.now() - t0 > (heard ? 30000 : 8000)) stop();
      }, 120);
      var stop = function(){ if(mr.state === 'recording') mr.stop(); };
      talk.stopListen = stop;
      mr.ondataavailable = function(ev){ if(ev.data && ev.data.size) chunks.push(ev.data); };
      mr.onstop = async function(){
        clearInterval(timer);
        stream.getTracks().forEach(function(tr){ tr.stop(); });
        try{ if(ac) ac.close(); }catch(e){}
        if(!heard){ res(''); return; }
        try{
          var blob = new Blob(chunks, { type:mr.mimeType || 'audio/webm' });
          var dataUrl = await new Promise(function(r2, j2){ var fr = new FileReader(); fr.onload = function(){ r2(fr.result); }; fr.onerror = j2; fr.readAsDataURL(blob); });
          var m = String(dataUrl).match(/^data:([^;]+)(?:;[^,]*)?;base64,(.*)$/);
          talk.phase = 'think'; talkUi();
          var text = await aiGenerate({ tag:'stt', temperature:0, maxTokens:500, contents:[{ role:'user', parts:[
            { inline_data:{ mime_type:m[1].split(';')[0], data:m[2] } },
            { text:'この音声を日本語の文字に起こしてください。話した内容だけを返してください。' } ] }] });
          res(String(text || '').trim());
        }catch(e){ rej(e); }
      };
      mr.start();
    }, function(){ rej(new Error('マイクが許可されていません')); });
  });
}
async function talkStart(){
  if(!aiReady()){ toast('先に設定タブでGemini APIキーを登録してください', true); return; }
  ttsUnlock();
  talk.on = true; talk.err = ''; talk.text = '';
  appId = 'chat'; render();
  var empty = 0;
  while(talk.on){
    talk.phase = 'listen'; talk.text = ''; talkUi();
    var said = '';
    try{ said = await listenOnce(); }
    catch(e){ talk.err = e.message; talkUi(); break; }
    if(!talk.on) break;
    if(!said){
      empty++;
      if(empty >= 2){ talk.err = '声が聞こえなかったので、会話をおわります'; talkUi(); break; }
      continue;
    }
    empty = 0;
    if(/^(おわり|終わり|ストップ|やめて|ばいばい|バイバイ)[。！!]?$/.test(said)) break;
    talk.phase = 'think'; talk.text = said; talkUi();
    await chatSend(said, { voice:true, talk:true, silent:true });
    if(!talk.on) break;
    var last = roomMsgs().filter(function(m){ return m.role === 'ai'; }).slice(-1)[0];
    talk.phase = 'speak'; talk.text = last ? last.text : ''; talkUi();
    if(last) await ttsSpeak(last.text);
  }
  if(talk.err) setTimeout(function(){ talkStop(); }, 2500); else talkStop();
}
function talkStop(){
  talk.on = false;
  try{ if(talk.stopListen) talk.stopListen(); }catch(e){}
  ttsStop();
  talkUi();
}

/* ============================== 答えの長さ（おまかせ） ============================== */
function lenRuleAuto(){
  return '答えの長さは内容に合わせて決める：あいさつ・はい／いいえ・確認だけなら1〜2文。予定や手順の質問は5〜8行。' +
    '計画づくりや説明を頼まれたときは、理由もつけてくわしく（15行まで）。';
}

/* ============================== 週のふりかえり ============================== */
function monOfYmd(ymd){
  var a = ymd.split('-'), d = new Date(+a[0], +a[1] - 1, +a[2]);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toYmd(d);
}
function weekStats(mon){
  var days = [], i;
  for(i = 0; i < 7; i++) days.push(shiftDate(mon, i));
  var inWeek = function(d){ return isYmd(d) && d >= days[0] && d <= days[6]; };
  var att = { pres:0, late:0, ab:0 };
  Object.keys(S.attendLog || {}).forEach(function(n){
    (S.attendLog[n] || []).forEach(function(x){ if(inWeek(x.date)){ if(x.st === '出') att.pres++; else if(x.st === '遅') att.late++; else if(x.st === '欠') att.ab++; } });
  });
  var due = S.tasks.filter(function(t){ return inWeek(t.due); });
  var shifts = S.shifts.filter(function(w){ return inWeek(w.date); });
  var pay = (typeof shiftPay === 'function') ? sumBy(shifts, shiftPay) : 0;
  var spends = (S.spends || []).filter(function(x){ return inWeek(x.date) && x.io !== 'in'; });
  var grades = days.map(function(d){ var r = (S.dayReview || {})[d]; return r && r.grade ? r.grade : ''; }).filter(Boolean);
  var exams = S.exams.filter(function(x){ return inWeek(x.date); });
  return { mon:mon, sun:days[6], att:att, dueN:due.length, doneN:due.filter(function(t){ return t.done; }).length,
    lateTasks:due.filter(function(t){ return !t.done && t.due < today(); }).map(function(t){ return t.title; }),
    shiftN:shifts.length, pay:pay, spend:sumBy(spends, function(x){ return x.amount; }), grades:grades,
    exams:exams.map(function(x){ return (x.subject ? shortName(x.subject) : '') + ' ' + kindOf(x.kind || 'exam').name; }) };
}
function weekReviewTemplate(st){
  var L = [];
  L.push('出席 ' + st.att.pres + '回' + (st.att.late ? '・遅刻 ' + st.att.late + '回' : '') + (st.att.ab ? '・欠席 ' + st.att.ab + '回' : '') + '。');
  if(st.dueN) L.push('締切のあった課題 ' + st.dueN + '件のうち ' + st.doneN + '件を終えました。' + (st.lateTasks.length ? 'まだのもの：' + st.lateTasks.slice(0, 3).join('、') + '。' : ''));
  if(st.exams.length) L.push('テスト：' + st.exams.join('、') + '。');
  if(st.shiftN) L.push('バイト ' + st.shiftN + '回（見こみ ' + yen(st.pay) + '）。');
  if(st.spend) L.push('記録した支出 ' + yen(st.spend) + '。');
  if(st.grades.length) L.push('毎日の評価：' + st.grades.join(' '));
  L.push(st.lateTasks.length ? '来週は、残っている課題から片づけましょう。' : 'よくがんばりました。来週もこの調子で。');
  return L.join('\n');
}
var weekRevBusy = false;
async function weekReviewMake(mon, manual){
  if(weekRevBusy) return;
  weekRevBusy = true;
  var st = weekStats(mon), text = '', by = 'auto';
  try{
    if(aiReady()){
      text = await aiGenerate({ tag:'week', temperature:0.5, maxTokens:900,
        system:'あなたは看護学部1年生を見守る、やさしいコーチです。' + toneRule(),
        contents:[{ role:'user', parts:[{ text:'先週（' + ymdLabel(st.mon) + '〜' + ymdLabel(st.sun) + '）の記録です。\n' + JSON.stringify(st) +
          '\n\nこれをもとに、先週のふりかえりを書いてください。「よかったこと」「気をつけたいこと」「来週の小さな目標3つ」を、全部で10行以内で。数字は記録どおりに。' }] }] });
      by = 'ai';
    }
  }catch(e){
    logErr('週のふりかえり', e.message);
    if(manual) toast('AIで書けなかったので、記録からまとめました', true);
  }finally{
    weekRevBusy = false;
  }
  if(!String(text || '').trim()) text = weekReviewTemplate(st);
  S.weekReview = S.weekReview || {};
  S.weekReview[mon] = { text:String(text).trim().slice(0, 2000), by:by, at:Date.now(), mt:Date.now() };
  var keys = Object.keys(S.weekReview).sort();
  keys.slice(0, Math.max(0, keys.length - 26)).forEach(function(k){ delete S.weekReview[k]; });
  touch('weekReview');
  commit();
  if(manual) toast('ふりかえりを書きました');
}
/* 月曜日以降に開いたら、先週のぶんを1回だけ自動で書く */
function weekReviewAuto(){
  var last = shiftDate(monOfYmd(today()), -7);
  if((S.weekReview || {})[last]) return;
  var flag = KEY + ':weekrev:' + last;
  try{ if(localStorage.getItem(flag)) return; localStorage.setItem(flag, '1'); }catch(e){ return; }
  var hasData = S.tasks.length || Object.keys(S.attendLog || {}).length || S.shifts.length;
  if(hasData) weekReviewMake(last, false);
}
setTimeout(function(){ if(!TEST_MODE) weekReviewAuto(); }, 15000);
var weekRevHist = false;
function weekReviewCard(mon){
  var target = shiftDate(mon, -7);
  var r = (S.weekReview || {})[target];
  var h = r ? '<div class="wkrev">' + esc(r.text).replace(/\n/g, '<br>') + '</div>' +
      '<p class="note">' + (r.by === 'ai' ? 'AIが記録をもとに書きました' : '記録からまとめました') + '・' + agoText(r.at) + '</p>'
    : '<div class="empty">' + ymdLabel(target) + 'の週のふりかえりはまだありません。</div>';
  h += '<div class="pillrow"><button class="mini" data-act="wkrev-make" data-v="' + target + '"' + (weekRevBusy ? ' disabled' : '') + '>' +
    (weekRevBusy ? '書いています…' : r ? '書き直す' : 'いま書く') + '</button>' +
    '<button class="mini" data-act="wkrev-hist">' + (weekRevHist ? 'たたむ' : 'これまでのふりかえり') + '</button></div>';
  if(weekRevHist){
    Object.keys(S.weekReview || {}).sort().reverse().filter(function(k){ return k !== target; }).slice(0, 12).forEach(function(k){
      h += '<details class="wkold"><summary>' + ymdLabel(k) + 'の週</summary><div>' + esc(S.weekReview[k].text).replace(/\n/g, '<br>') + '</div></details>';
    });
  }
  return section('先週のふりかえり', ymdLabel(target) + '〜', h);
}
function aiPlusAction(act, t){
  if(act === 'chat-undo'){
    var list = roomMsgs().slice(), i = toNum(t.dataset.i), m = list[i];
    if(!m || !m.ops || m.undone) return true;
    aiUndoOps(m.ops);
    m.undone = 1; m.et = Date.now();
    roomSet(list);
    toast('取り消しました'); commit(); return true;
  }
  if(act === 'chat-web'){ chatWeb = !chatWeb; render(); return true; }
  if(act === 'ai-direct'){ S.ui.aiDirect = aiDirectOn() ? 0 : 1; touch('ui'); commit(); return true; }
  if(act === 'att-ask'){
    var el = document.getElementById('chat_in');
    var extra = el && el.value.trim() ? '\n' + el.value.trim() : '';
    if(el) el.value = '';
    chatSend((ATT_PROMPTS[t.dataset.v] || ATT_PROMPTS.sum) + extra);
    return true;
  }
  if(act === 'talk-start'){ talkStart(); return true; }
  if(act === 'voice-engine'){ S.ui.voiceEngine = t.dataset.v; touch('ui'); commit(); return true; }
  if(act === 'tts-voice'){ S.ui.ttsVoice = t.dataset.v; touch('ui'); commit(); ttsUnlock(); ttsSpeak('こんにちは。この声で読みますね。'); return true; }
  if(act === 'wkrev-make'){ weekReviewMake(t.dataset.v, true); render(); return true; }
  if(act === 'wkrev-hist'){ weekRevHist = !weekRevHist; render(); return true; }
  return false;
}
function voiceSettings(){
  var eng = ttsEngine();
  return '<label class="f">読み上げの声</label><div class="pillrow">' +
    '<button data-act="voice-engine" data-v="browser" class="' + (eng === 'browser' ? 'on' : '') + '">端末の声（無料・すぐ）</button>' +
    '<button data-act="voice-engine" data-v="gemini" class="' + (eng === 'gemini' ? 'on' : '') + '">AIの自然な声（Gemini）</button></div>' +
    (eng === 'gemini' ? '<label class="f">声の種類（押すと試せます）</label><div class="chips">' + TTS_VOICES.map(function(v){
      return '<button data-act="tts-voice" data-v="' + v[0] + '" class="' + ((S.ui.ttsVoice || '') === v[0] ? 'on' : '') + '">' + esc(v[1]) + '</button>';
    }).join('') + '</div><p class="note">AIの声は、読み上げ1回ごとにAIの使用回数を1回使います。つながらないときは端末の声になります。</p>' : '') +
    '<label class="f">AIに頼んだら、そのまま手帳に入れる</label><div class="pillrow">' +
    '<button data-act="ai-direct" class="' + (aiDirectOn() ? 'on' : '') + '">' + (aiDirectOn() ? '入れる（取り消しもできる）' : '入れない（提案だけ）') + '</button></div>';
}

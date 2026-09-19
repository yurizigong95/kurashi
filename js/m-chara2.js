/* くらしの手帳：キャラクターのセリフ・性格（キャラ＋） */
/* ============================== キャラ＋ ==============================
   ・セリフのしくみ（場面×性格×口ぐせ）は js/chara-talk.js、性格の型は js/chara-data.js、季節の行事とかざりは js/decor.js
   ・ここでは、設定の画面・今日タブの「キャラのおしゃべり」・声で話しかける・通知の口調・AIの道具への登録 をする
   データ：S.ui.chara（callName 呼び名／chatChara AIそうだんでキャラと話す／weekAi AIが毎週セリフを足す／notifyTalk 通知の口調／voiceOn 読み上げ／voiceAi AIで返事）
           S.kmData 'chara2:persona:<id>'（性格・口調を直したもの）・'chara2:bond:<端末>'（話しかけ・なでた・声の回数と出会った日。端末ごと。前からの 'chara2:bond' も読む）
           S.charaTalk 'w:<月曜>:<id>'（AIが今週足したセリフ）・'c:<日付>'（AIが作った今日の会話） */
var c2Ui = { dlg:0 };
var c2Talk = { q:'', a:'', ai:0, busy:false, listening:false };
var c2SceneNames = {
  'd-mon':'月曜日', 'd-wed':'水曜日', 'd-fri':'金曜日', 'd-sat':'土曜日', 'd-sun':'日曜日',
  'w-sunny':'晴れ', 'w-rain':'雨', 'w-snow':'雪', 'w-hot':'暑い', 'w-cold':'寒い',
  'p-first':'1限がある', 'p-noclass':'授業なし', 'p-work':'バイトの日', 'p-off':'休日', 'p-long':'長い一日', 'p-holiday':'祝日',
  'x-7':'テスト1週間前', 'x-3':'テスト3日前', 'x-1':'テスト前日', 'x-today':'テスト当日', 'x-done':'テストが終わった',
  'k-today':'締切が今日', 'k-tomo':'締切が明日', 'k-late':'期限切れの課題', 'k-clear':'課題がぜんぶ終わった',
  'a-pile':'復習がたまっている', 'a-streak':'暗記が続いている',
  'e-hungry':'おせわの子がおなかすいた', 'e-happy':'おせわの子がごきげん', 'e-dirty':'おせわの子がよごれている', 'e-sleepy':'おせわの子がねむい',
  'm-payday':'給料日', 'm-over':'お金がピンチ', 's-spring':'春', 's-summer':'夏', 's-autumn':'秋', 's-winter':'冬',
  'n-anniv':'記念日', 'n-petbirth':'おせわの子の記念日'
};
function c2CtxNames(on){
  return (on || []).map(function(x){
    if(/^f-/.test(x)) return c2FesName(x.slice(2));
    return c2SceneNames[x] || '';
  }).filter(Boolean).join('・') || 'ふつうの日';
}
function c2NotifyOn(){ return ((S.ui.chara || {}).notifyTalk !== 0) && charaLevel() >= 1; }
function c2VoiceOn(){ return ((S.ui.chara || {}).voiceOn !== 0); }
function c2VoiceAiOn(){ return ((S.ui.chara || {}).voiceAi !== 0); }
function c2Redraw(){ if(typeof isTyping === 'function' && isTyping()) renderLater(); else render(); }

/* ============================== 性格・口調を直す ============================== */
function c2PersonaSave(id, patch){
  S.kmData = (S.kmData && typeof S.kmData === 'object') ? S.kmData : {};
  var o = Object.assign({}, c2Ov(id) || {});
  delete o.reset;
  Object.keys(patch || {}).forEach(function(k){
    var v = patch[k];
    if(v === undefined || v === null || (typeof v === 'number' && !isFinite(v))) return;
    o[k] = v;
  });
  var clean = function(s, n){ return String(s).replace(/[<>{}\r\n]/g, '').trim().slice(0, n); };
  if(o.t && !c2Types[o.t]) delete o.t;
  if(o.me != null) o.me = clean(o.me, 8);
  if(o.tic != null) o.tic = clean(o.tic, 6).replace(/\s+/g, '');
  if(o.like != null) o.like = clean(o.like, 16);
  if(o.style != null) o.style = clean(o.style, 80);
  if(o.pitch != null) o.pitch = c2Clamp(o.pitch, 0.5, 2, 1);
  if(o.rate != null) o.rate = c2Clamp(o.rate, 0.5, 1.6, 1);
  o.mt = Date.now();
  S.kmData['chara2:persona:' + id] = o;
  touch('kmData');
  ctCache = {};
}
function c2Sample(id){
  var p = c2Persona(id), T = c2Types[p.t];
  return ctTic(charaById(id), (T.open[0] || '') + p.me + 'は' + p.name + '。' + (T.tail.cheer[0] || 'よろしくね'));
}

/* ============================== 今週AIが足したセリフ ============================== */
function c2WeekDel(id, text){
  var key = c2WeekKey(id), e = (S.charaTalk || {})[key];
  if(!e || !Array.isArray(e.lines)) return false;
  S.charaTalk[key] = Object.assign({}, e, { lines:e.lines.filter(function(s){ return s !== text; }), mt:Date.now() });
  touch('charaTalk');
  ctCache = {};
  return true;
}

/* ============================== 通知の文をキャラの口調に ==============================
   意味は変えない：本体の通知（締切・テスト・授業・持ち物）は決まった形だけ話しことばにし、口ぐせをつける。
   ほかの機能の通知は、題に口ぐせをつけるだけ。本文は、本体の締切・テスト・授業のときだけ、ひとことを足す（200文字以内）。
   毎回同じ文になるように、ひとことは通知のIDで決める（通知の予定を何度も送り直さないように）。 */
var c2NotePhrase = {
  d:['いっしょにがんばろ', 'できるところからね', '出したらチェックしてね'],
  e1:['早めに寝てね', '持ちものを準備しよ'],
  e0:['ファイト！', '深呼吸してからね'],
  c:['いってらっしゃい', '教室、まちがえないでね']
};
function c2CasualTitle(title){
  var s = String(title || '');
  var rules = [[/^締切まであと(\d+)日$/, '締切まであと$1日だよ'], [/^明日が締切です$/, '明日が締切だよ'], [/^今日が締切です$/, '今日が締切だよ'],
    [/^(\d+)分後に(\d+)限$/, '$1分後に$2限だよ'], [/^(🎒 今日の持ち物)$/, '$1だよ'], [/^明日は(.+)$/, '明日は$1だよ'], [/^今日は(.+)$/, '今日は$1だね']];
  for(var i = 0; i < rules.length; i++){ if(rules[i][0].test(s)) return s.replace(rules[i][0], rules[i][1]); }
  return null;
}
function c2JobText(job, force){
  if(!job || (!force && !c2NotifyOn())) return job;
  var o = Object.assign({}, job), id = String(job.id || '');
  /* 「ランダム」のときは、開くたびに子が変わるので、通知ごとに決まった子にする（開くたびに通知の予定を送り直さない） */
  var cfg = charaCfg();
  var k = (cfg.mode === 'random' && cfg.friends.length) ? charaById(cfg.friends[ctSeed(id) % cfg.friends.length]) : charaNow();
  var kind = /^d[013]-/.test(id) ? 'd' : /^e1-/.test(id) ? 'e1' : /^e0-/.test(id) ? 'e0' : /^c-/.test(id) ? 'c' : /^am-/.test(id) ? 'am' : '';
  var cas = kind ? c2CasualTitle(job.title) : null;
  o.title = ctTic(k, cas || String(job.title || '')).slice(0, 80);
  var list = c2NotePhrase[kind];
  if(list && !job.wx){
    var add = '\n' + k.name + '「' + ctTic(k, list[ctSeed(id) % list.length]) + '」';
    if(String(job.body || '').length + add.length <= 200) o.body = String(job.body || '') + add;
  }
  return o;
}
kmJobText(function(job){ return c2JobText(job); });

/* ============================== 声で話しかける ============================== */
function c2SR(){
  try{ return window.SpeechRecognition || window.webkitSpeechRecognition || null; }catch(e){ return null; }
}
var c2Rec = null;
function c2VoiceStart(){
  var SR = c2SR();
  var inp = document.getElementById('c2_say');
  if(!SR){ toast('この端末は声の入力が使えないので、文字で話しかけてね'); if(inp) inp.focus(); return false; }
  if(c2Talk.listening && c2Rec){ try{ c2Rec.stop(); }catch(e){} return true; }
  try{
    var rec = new SR();
    c2Rec = rec;
    rec.lang = 'ja-JP'; rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
    rec.onresult = function(ev){
      var tx = '';
      try{ tx = ev.results[0][0].transcript; }catch(er){}
      c2Talk.listening = false;
      if(tx) c2VoiceReply(tx);
    };
    rec.onerror = function(ev){
      c2Talk.listening = false; c2Redraw();
      toast((ev && ev.error === 'not-allowed') ? 'マイクが許可されていません。文字でも話しかけられます' : '聞きとれませんでした。文字でも話しかけられます', true);
    };
    rec.onend = function(){ if(c2Talk.listening){ c2Talk.listening = false; c2Redraw(); } };
    c2Talk.listening = true; c2Redraw();
    rec.start();
    return true;
  }catch(e){
    c2Talk.listening = false;
    toast('声の入力を始められませんでした。文字で話しかけてね', true);
    return false;
  }
}
/* その子の場面の文を集める（返事に使う） */
function c2LinesFor(id, sids, ctx){
  var p = c2Persona(id), k = charaById(id), out = [];
  var common = { me:p.me, you:p.you, name:k.name, like:k.like || 'おいしいもの', desc:k.desc || '' };
  sids.forEach(function(sid){
    var sc = c2Scenes[sid];
    if(!sc) return;
    var vars = Object.assign({}, common, (ctx && ctx.v[sid]) || {});
    sc.base.concat(((sc.type || {})[p.t]) || []).forEach(function(s){ var f = c2Fill(s, vars); if(f) out.push({ s:f, mood:sc.mood }); });
  });
  return out;
}
var c2ReplyRules = [
  [/おはよ/, ['t-morning']], [/おやすみ|寝る|ねる$|ねむ/, ['t-night']], [/ただいま|かえった|帰った|帰宅/, ['t-evening']],
  [/テスト|試験/, ['x-today', 'x-1', 'x-3', 'x-7', 'x-done'], ['テスト勉強、ちょっとずつね', 'テストの予定を入れておくと、{me}がおうえんするよ']],
  [/課題|レポート|しめきり|締切/, ['k-late', 'k-today', 'k-tomo', 'k-clear'], ['いまは、しめきりがせまった課題はないみたい', '課題は、早めに少しずつがいちばんだよ']],
  [/天気|雨|傘|晴れ|雪|暑い|寒い/, ['w-rain', 'w-snow', 'w-hot', 'w-cold', 'w-sunny'], ['天気は、今日タブで見られるよ', '出かける前に、空を見てみよう']],
  [/バイト/, ['p-work'], ['バイトのシフト、入れておくと{me}がおうえんするよ', 'バイト、むりしないでね']],
  [/お金|金欠|ピンチ|給料|節約/, ['m-payday', 'm-over'], ['使ったお金は、家計簿につけておこう', 'ほしいものは、ひと晩考えてからにしよう']],
  [/暗記|カード|単語|覚え/, ['a-pile', 'a-streak'], ['暗記カード、5分だけやってみよう', '声に出して覚えると、残りやすいよ']],
  [/つかれ|疲れ|しんど|つらい|だる|ねむい|眠い/, [], ['むりしないでね。{me}がそばにいるよ', 'きょうは、早めに休もう', 'あったかい飲みもので、ひと休みしよう'], 'care'],
  [/だいすき|大好き|すき|好き/, [], ['えへへ、うれしいな', '{me}も{you}のこと、好きだよ', 'ありがとう、てれちゃうな'], 'happy'],
  [/ありがと/, [], ['どういたしまして', 'こちらこそ、ありがとう', '{you}の役に立ててうれしいな'], 'happy'],
  [/名前|だれ|誰|自己紹介/, [], ['{me}は{name}。{desc}だよ', '{name}だよ。好きなものは{like}！'], 'happy'],
  [/おなか|ごはん|ご飯|食べ/, [], ['{like}が食べたいな', 'ごはん、ちゃんと食べてね', 'おなかすいたね'], 'care'],
  [/さみし|寂し|ひとり/, [], ['{me}がそばにいるよ', 'さみしいときは、いつでも話しかけてね'], 'care'],
  [/がんば|頑張/, [], ['{you}なら、きっとできるよ', 'いっしょにがんばろう'], 'cheer']
];
/* まずはセリフのしくみで返事する（AIがなくても動く） */
function c2ReplyLocal(q, id){
  id = id || charaNow().id;
  var k = charaById(id), p = c2Persona(id), T = c2Types[p.t], ctx = c2Ctx(today());
  var r = ctRand(ctSeed(q + Date.now()));
  var vars = { me:p.me, you:p.you, name:k.name, like:k.like || 'おいしいもの', desc:k.desc || '' };
  var bondLv = c2Bond(id).lv;
  for(var i = 0; i < c2ReplyRules.length; i++){
    var rule = c2ReplyRules[i];
    if(!rule[0].test(q)) continue;
    var sids = rule[1].filter(function(s){ return /^t-/.test(s) || ctx.on.indexOf(s) >= 0; });
    var cand = c2LinesFor(id, sids.slice(0, 1), ctx);
    if(!cand.length){
      var mood = rule[3] || 'happy';
      var extra = (rule[2] || []).map(function(s){ return { s:c2Fill(s, vars), mood:mood }; }).filter(function(x){ return x.s; });
      if(mood === 'happy' && /すき|好き/.test(q) && bondLv >= 5) extra = extra.concat(c2BondTalk[5].map(function(s){ return { s:c2Fill(s, vars), mood:'happy' }; }));
      if(rule[3] === 'care') extra = extra.concat(T.tail.care.map(function(s){ return { s:s, mood:'' }; }));
      cand = extra;
    }
    if(cand.length){
      var c = cand[Math.floor(r() * cand.length)];
      return c2Deco(k, T, T.polite ? c2Polite(c.s) : c.s, c.mood || 'happy', r, bondLv, bondLv >= 1 ? p.callName : '');
    }
  }
  var pool = charaDayPool(id);
  var list = pool.scene.length ? pool.scene : pool.any;
  return list[Math.floor(Math.random() * list.length)] || ctTic(k, 'うん、うん');
}
function c2CleanReply(s){
  var a = String(s || '').replace(/[\r\n]+/g, ' ').replace(/[*#`<>_]/g, '').replace(/\s{2,}/g, ' ').trim();
  if(a.length > 90){ var cut = a.slice(0, 90); var e = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('！'), cut.lastIndexOf('？')); a = e > 20 ? cut.slice(0, e + 1) : cut + '…'; }
  if(!a || /https?:|www\./.test(a)) return '';
  return a;
}
/* 読み上げ（キャラごとの声の高さ・速さ。テストのときは読み上げずに、何を言うかだけ覚える） */
var c2LastUtter = null;
function c2Speak(text, id, opt){
  opt = opt || {};
  var p = c2Persona(id);
  var u = { text:String(text || '').replace(/[〜♪]/g, '').slice(0, 140), pitch:opt.pitch || p.pitch, rate:opt.rate || p.rate, lang:'ja-JP' };
  if(!c2VoiceOn() && !opt.force) return null;
  c2LastUtter = u;
  if(TEST_MODE) return u;
  try{
    if(typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return u;
    var ut = new SpeechSynthesisUtterance(u.text);
    ut.lang = 'ja-JP'; ut.pitch = u.pitch; ut.rate = u.rate;
    var vs = window.speechSynthesis.getVoices().filter(function(v){ return /^ja/i.test(v.lang || ''); });
    if(vs.length) ut.voice = vs[0];
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(ut);
  }catch(e){}
  return u;
}
/* 話しかけられたら返事する（まずセリフのしくみで。AIが使えれば、その子の口調で短く） */
async function c2VoiceReply(q){
  q = String(q || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80);
  if(!q) return '';
  var k = charaNow();
  c2Talk.q = q; c2Talk.a = c2ReplyLocal(q, k.id); c2Talk.ai = 0; c2Talk.listening = false;
  c2BondAdd(k.id, 'voice'); persist(); pushRemote();
  var inp = document.getElementById('c2_say');
  if(inp){ inp.value = ''; try{ inp.blur(); }catch(e){} }
  var useAi = c2VoiceAiOn() && aiReady();
  c2Talk.busy = useAi;
  c2Redraw();
  if(useAi){
    try{
      var ctx = c2Ctx(today());
      var r = await aiGenerate({ tag:'c2-voice', temperature:0.8, maxTokens:300,
        system:c2PersonaText(k.id) + '\n【返事のしかた】声で読み上げるので、1〜2文・40文字くらいまで。絵文字・記号・箇条書きは使わない。' +
          '今日の様子：' + c2CtxNames(ctx.on) + '。病気の診断や薬の量は言わない。つらそうなときは、休むことや人に相談することをすすめる。',
        contents:[{ role:'user', parts:[{ text:q }] }] });
      var a = c2CleanReply(r);
      if(a && c2Talk.q === q){ c2Talk.a = a; c2Talk.ai = 1; }
    }catch(e){ logErr('キャラと話す', e.message || String(e)); }
    c2Talk.busy = false;
  }
  c2Speak(c2Talk.a, k.id);
  c2Redraw();
  return c2Talk.a;
}
if(typeof document !== 'undefined') document.addEventListener('keydown', function(e){
  if(e.key !== 'Enter' || e.isComposing || !e.target || e.target.id !== 'c2_say') return;
  e.preventDefault();
  var q = String(e.target.value || '').trim();
  if(q) c2VoiceReply(q);
});

/* ============================== AIで今日の会話（1週間に3回まで） ============================== */
function c2DialogAiLeft(ymd){
  var mon = c2Mon(ymd || today()), end = shiftDate(mon, 6), n = 0;
  Object.keys(S.charaTalk || {}).forEach(function(x){
    var m = x.match(/^c:(\d{4}-\d{2}-\d{2})$/);
    if(m && m[1] >= mon && m[1] <= end) n++;
  });
  return Math.max(0, 3 - n);
}
var c2DlgBusy = false;
async function c2DialogAi(){
  if(c2DlgBusy) return false;
  if(!aiReady()){ toast('AIを使うには、設定でGemini APIキーを登録してください', true); return false; }
  var ymd = today();
  S.charaTalk = (S.charaTalk && typeof S.charaTalk === 'object') ? S.charaTalk : {};
  if(S.charaTalk['c:' + ymd]){ toast('今日の会話は、もうできています'); return false; }
  if(!c2DialogAiLeft(ymd)){ toast('AIの会話は、1週間に3回までです', true); return false; }
  c2DlgBusy = true;
  toast('会話を考えています…');
  try{
    var pair = c2DialogPair(), A = c2Persona(pair[0]), B = c2Persona(pair[1]);
    var who = function(p){ return '「' + p.name + '」（' + p.desc + '・性格：' + p.type + '・一人称「' + p.me + '」' + (p.tic ? '・口ぐせ「' + p.tic + '」' : '') + (p.like ? '・好きなもの：' + p.like : '') + '）'; };
    var prompt = '手帳アプリのオリジナルキャラクター2ひきの、短い会話を作ってください。使う人は看護学部1年生です。\n' +
      'a：' + who(A) + '\nb：' + who(B) + '\n' +
      '今日（' + ymdLabel(ymd) + '）の様子：' + c2CtxNames(c2Ctx(ymd).on) + '\n今週の予定：\n' + c2WeekFacts(c2Mon(ymd)) + '\n' +
      'ルール：4〜6行。1行30文字以内。今日の予定・天気・季節の話題で、使う人（' + A.you + '）をやさしくはげます。病気の診断・薬の量は書かない。実在の作品・人物の名前・個人名は出さない。\n' +
      '次のJSONだけを返す：{"lines":[{"who":"a","text":"…"},{"who":"b","text":"…"}]}';
    var j = parseJsonLoose(await aiGenerate({ tag:'c2-dialog', json:true, temperature:0.9, maxTokens:1500,
      contents:[{ role:'user', parts:[{ text:prompt }] }] }));
    var lines = (j && Array.isArray(j.lines) ? j.lines : []).map(function(l){
      var tx = c2CleanLine(String((l && (l.text || l.t)) || ''));
      return tx ? { w:(l.who === 'b' || l.who === 1) ? 'b' : 'a', t:tx } : null;
    }).filter(Boolean).slice(0, 6);
    if(lines.length < 3) throw new Error('会話がうまく作れませんでした');
    S.charaTalk['c:' + ymd] = { pair:pair, lines:lines, mt:Date.now(), by:DEV.id };
    c2TalkPrune();
    touch('charaTalk');
    c2Ui.dlg = 0;
    commit();
    toast('今日の会話ができました');
    return true;
  }catch(e){
    logErr('キャラの会話', e.message || String(e));
    toast('できませんでした：' + (e.message || e), true);
    return false;
  }finally{
    c2DlgBusy = false;
  }
}

/* ============================== 画面のかけら ============================== */
function c2BondMeter(b, small){
  return '<div class="c2-meter' + (small ? ' sm' : '') + '"><div class="c2-mt"><b>なかよしLv' + b.lv + '</b>' +
    (b.next ? '<span>つぎのLvまで ' + b.next + 'pt</span>' : '<span>さいこう！</span>') + '</div>' +
    '<div class="c2-bar" role="meter" aria-label="なかよし度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + b.pct + '"><i style="width:' + b.pct + '%"></i></div>' +
    (small ? '' : '<div class="s2">' + b.pts + 'pt（記録' + b.parts.note + '・おせわ' + b.parts.pet + '・そうだん' + b.parts.chat +
      '・話しかけ' + b.parts.talks + '・なでた' + b.parts.pats + '・声' + b.parts.voice + '）</div>') + '</div>';
}
function c2DialogBox(){
  var list = c2DialogList(today());
  if(!list.length) return '';
  var i = c2Ui.dlg % list.length, d = list[i];
  var h = '<div class="c2-dlg">' + d.lines.map(function(l){
    return '<div class="c2-dl ' + (l.who ? 'r' : 'l') + '"><span class="c2-av">' + charaSvg({ id:l.id, size:30, still:true, hat:'', expr:l.who ? 'wink' : 'happy' }) + '</span>' +
      '<span class="chbubble">' + esc(l.t) + '</span></div>';
  }).join('') + '</div>';
  var left = c2DialogAiLeft();
  h += '<div class="pillrow"><button class="mini" data-act="c2-dlg-next">ほかの話（' + (i + 1) + '/' + list.length + '）</button>' +
    ((aiReady() && !(S.charaTalk || {})['c:' + today()]) ? '<button class="mini" data-act="c2-dlg-ai"' + (left ? '' : ' disabled') + '>AIで今日の会話を作る（今週あと' + left + '回）</button>' : '') + '</div>' +
    (d.ai ? '<p class="note" style="margin:0">AIが作った今日の会話です。</p>' : '');
  return h;
}
function c2TalkBox(){
  var t = c2Talk, k = charaNow(), sr = !!c2SR();
  return '<div class="c2-talk">' +
    (t.a ? '<div class="c2-said">' + (t.q ? '<div class="c2-q"><span class="chbubble">' + esc(t.q) + '</span></div>' : '') +
      '<div class="c2-dl l"><span class="c2-av">' + charaSvg({ id:k.id, size:34, still:true, hat:'', expr:t.busy ? 'think' : 'happy' }) + '</span>' +
      '<span class="chbubble c2-a">' + esc(t.a) + (t.busy ? '…' : '') + (t.ai ? '<small class="c2-ai">AI</small>' : '') + '</span></div></div>' : '') +
    '<div class="c2-say"><button type="button" class="c2-mic' + (t.listening ? ' on' : '') + '" data-act="c2-mic" aria-label="' + (sr ? '声で話しかける' : '声の入力が使えないので、文字で話しかけてね') + '">🎤</button>' +
    '<input id="c2_say" maxlength="80" placeholder="' + esc(k.name) + 'に話しかける（文字でもOK）" autocomplete="off" enterkeyhint="send">' +
    '<button class="mini" data-act="c2-say">話す</button></div>' +
    (t.listening ? '<div class="s2">きいています…話しおわったら、少し待ってね</div>' : '') +
    (!sr ? '<div class="s2">この端末では声の入力が使えないので、文字で話しかけてね。</div>' : '') + '</div>';
}
/* 設定の「キャラクター」の中に出す */
function c2Settings(){
  var k = charaNow(), p = c2Persona(k.id), b = c2Bond(k.id), T = c2Types[p.t], cfg = S.ui.chara || {};
  var pool = charaDayPool(k.id);
  var h = '<div class="c2-set">';
  /* なかよし度 */
  h += '<h3 class="c2-h">💗 ' + esc(k.name) + 'となかよし度</h3>' + c2BondMeter(b) +
    '<div class="c2-unlock">' + c2BondUnlock.map(function(u, i){
      return i ? '<span class="c2-ul' + (b.lv >= i ? ' on' : '') + '">Lv' + i + '：' + esc(u) + '</span>' : '';
    }).join('') + '</div>' +
    '<p class="note" style="margin:2px 0 6px">おせわ・AIそうだん・話しかける・なでる・声で話す・課題や予定の記録で上がります。レベルが上がると、セリフの種類が増えます。</p>' +
    '<div class="field"><label class="f" for="c2_call">キャラがあなたを呼ぶ名前（なかよしLv1から呼んでくれます）</label>' +
    '<input id="c2_call" maxlength="10" value="' + esc(cfg.callName || '') + '" placeholder="例：ゆりちゃん" autocomplete="off"></div>' +
    '<div class="pillrow"><button class="mini" data-act="c2-call">呼び名を保存</button></div>';
  /* 性格・口調 */
  h += '<h3 class="c2-h">🎭 ' + esc(k.name) + 'の性格・口調</h3>' +
    '<div class="pillrow">' + Object.keys(c2Types).map(function(t){
      return '<button data-act="c2-ptype" data-v="' + t + '" class="' + (p.t === t ? 'on' : '') + '">' + esc(c2Types[t].name) + '</button>';
    }).join('') + '</div>' +
    '<p class="note" style="margin:-2px 0 8px">' + esc(T.desc) + '</p>' +
    '<div class="grid2"><div class="field"><label class="f" for="c2_me">一人称</label><input id="c2_me" maxlength="8" value="' + esc(p.me) + '" autocomplete="off"></div>' +
    '<div class="field"><label class="f" for="c2_tic">口ぐせ（語尾）</label><input id="c2_tic" maxlength="6" value="' + esc(p.tic) + '" placeholder="なし" autocomplete="off"></div></div>' +
    '<div class="field"><label class="f" for="c2_like">好きなもの</label><input id="c2_like" maxlength="16" value="' + esc(p.like) + '" autocomplete="off"></div>' +
    '<div class="field"><label class="f" for="c2_style">話し方</label><input id="c2_style" maxlength="80" value="' + esc(p.style) + '" autocomplete="off"></div>' +
    '<div class="grid2"><div class="field"><label class="f" for="c2_pitch">声の高さ（いま ' + p.pitch + '）</label><input type="range" id="c2_pitch" min="0.5" max="2" step="0.05" value="' + p.pitch + '"></div>' +
    '<div class="field"><label class="f" for="c2_rate">声の速さ（いま ' + p.rate + '）</label><input type="range" id="c2_rate" min="0.5" max="1.6" step="0.05" value="' + p.rate + '"></div></div>' +
    '<div class="pillrow"><button data-act="c2-psave">性格・口調を保存</button><button data-act="c2-ptest">声をためす</button>' +
      (p.edited ? '<button data-act="c2-preset">もとにもどす</button>' : '') + '</div>' +
    '<p class="note" style="margin:0 0 6px">上の「AIそうだんでキャラと話す」がオンのとき、AIそうだんもこの性格・口調で答えます（大事な中身はそのまま正確に）。</p>';
  /* セリフ */
  var wl = c2WeekLines(k.id);
  h += '<h3 class="c2-h">💬 セリフ</h3>' +
    '<p class="note" style="margin:0 0 6px">場面の文 × 性格の話しかけ方 × 口ぐせ で、' + esc(k.name) + 'のセリフは <b>' + c2ComboCount(k.id).toLocaleString('ja-JP') + 'とおり</b>。' +
    'きょうは <b>' + pool.total + '種類</b>（今日の場面：' + esc(c2CtxNames(pool.ctx)) + '）。同じセリフは続けて出ません。</p>' +
    '<div class="pillrow"><button data-act="c2-weekai" class="' + (c2WeekAiOn() ? 'on' : '') + '">AIが毎週セリフを足す：' + (c2WeekAiOn() ? 'オン' : 'オフ') + '</button>' +
      ((aiReady() && !(S.charaTalk || {})[c2WeekKey(k.id)]) ? '<button data-act="c2-weeknow">今週のぶんを今すぐ作る</button>' : '') + '</div>' +
    (wl.length ? '<div class="s2" style="margin:2px 0">今週AIが足したセリフ（' + wl.length + 'こ）</div><div class="c2-wlist">' + wl.map(function(s){
        return '<div class="row c2-wline"><div class="grow s">' + esc(s) + '</div><button class="mini" data-act="c2-wdel" data-id="' + esc(k.id) + '" data-t="' + esc(s) + '" aria-label="このセリフを消す">消す</button></div>';
      }).join('') + '</div>'
      : '<div class="empty" style="padding:6px 0">今週AIが足したセリフは、まだありません。' +
        (aiReady() ? (c2WeekAiOn() ? '週のはじめに開いたとき、今週の予定に合わせて30こほど足します。' : '') : '（Gemini APIキーを登録すると使えます）') + '</div>');
  /* 通知 */
  var sample = c2JobText({ id:'d1-sample', title:'明日が締切です', body:'看護レポート' }, true);
  h += '<h3 class="c2-h">🔔 通知</h3><div class="pillrow"><button data-act="c2-notify" class="' + (c2NotifyOn() ? 'on' : '') + '">スマホ・Discordの通知も' + esc(k.name) + 'の口調：' + (c2NotifyOn() ? 'オン' : 'オフ') + '</button></div>' +
    '<div class="s2">見本：' + esc(sample.title) + '／' + esc(String(sample.body).replace(/\n/g, ' ')) + '</div>';
  /* 声 */
  h += '<h3 class="c2-h">🎤 声で話しかける</h3>' + c2TalkBox() +
    '<div class="pillrow"><button data-act="c2-voiceon" class="' + (c2VoiceOn() ? 'on' : '') + '">返事を声で読み上げる：' + (c2VoiceOn() ? 'オン' : 'オフ') + '</button>' +
    '<button data-act="c2-voiceai" class="' + (c2VoiceAiOn() ? 'on' : '') + '">AIで返事する：' + (c2VoiceAiOn() ? 'オン' : 'オフ') + '</button></div>' +
    '<p class="note" style="margin:0 0 6px">マイクのボタンで話しかけると、' + esc(k.name) + 'が返事をします（声の入力が使えない端末は文字で）。AIのカギがあれば、AIがその子の口調で短く答えます。</p>';
  /* キャラどうしの会話 */
  h += '<h3 class="c2-h">🗨 キャラどうしの会話</h3>' + c2DialogBox();
  return h + '</div>';
}

/* ============================== 今日タブ ============================== */
kmPart('today', 'c2chat', 'キャラのおしゃべり', function(ctx){
  if(!ctx || !ctx.isToday || typeof charaLevel !== 'function' || charaLevel() < 1) return '';
  var k = charaNow(), b = c2Bond(k.id);
  return secWrap('c2chat', 'キャラのおしゃべり', k.name + 'となかよしLv' + b.lv, c2DialogBox() + c2TalkBox() + c2BondMeter(b, true));
});

/* ============================== 操作 ============================== */
kmAction(function(act, t){
  if(act.indexOf('c2-') !== 0) return false;
  var k = charaNow();
  if(act === 'c2-call'){
    var nm = val('c2_call').replace(/[<>{}\r\n]/g, '').trim().slice(0, 10);
    charaSet({ callName:nm }); ctCache = {}; commit();
    toast(nm ? '「' + nm + '」と呼ぶようにしました' : '呼び名を消しました');
    return true;
  }
  if(act === 'c2-ptype'){ c2PersonaSave(k.id, { t:t.dataset.v }); commit(); toast(c2Types[t.dataset.v] ? c2Types[t.dataset.v].name + 'にしました' : '変えました'); return true; }
  if(act === 'c2-psave'){
    c2PersonaSave(k.id, { me:val('c2_me'), tic:val('c2_tic'), like:val('c2_like'), style:val('c2_style'),
      pitch:Number(val('c2_pitch')) || undefined, rate:Number(val('c2_rate')) || undefined });
    commit(); toast('性格・口調を保存しました');
    return true;
  }
  if(act === 'c2-preset'){
    S.kmData = S.kmData || {};
    S.kmData['chara2:persona:' + k.id] = { reset:1, mt:Date.now() };
    touch('kmData'); ctCache = {}; commit(); toast('もとにもどしました');
    return true;
  }
  if(act === 'c2-ptest'){
    var el1 = document.getElementById('c2_pitch'), el2 = document.getElementById('c2_rate');
    c2Speak(c2Sample(k.id), k.id, { force:1, pitch:el1 ? Number(el1.value) : 0, rate:el2 ? Number(el2.value) : 0 });
    toast(c2Sample(k.id));
    return true;
  }
  if(act === 'c2-weekai'){ charaSet({ weekAi:c2WeekAiOn() ? 0 : 1 }); commit(); return true; }
  if(act === 'c2-weeknow'){
    toast('今週のセリフを作っています…');
    c2WeekAi({ force:1, wait:1500 }).then(function(r){
      if(r && r.ok) toast('今週のセリフを' + r.n + 'こ足しました');
      else if(r && r.skip === 'done') toast('今週のぶんは、もうできています');
      else if(r && r.skip === 'lock') toast('ほかの端末が作っています。少し待ってね');
      else toast('できませんでした' + (r && r.error ? '：' + r.error : ''), true);
    });
    return true;
  }
  if(act === 'c2-wdel'){ if(c2WeekDel(t.dataset.id, t.dataset.t)){ commit(); toast('消しました'); } return true; }
  if(act === 'c2-notify'){ charaSet({ notifyTalk:c2NotifyOn() ? 0 : 1 }); commit(); if(typeof notifyPush === 'function') notifyPush(true); return true; }
  if(act === 'c2-voiceon'){ charaSet({ voiceOn:c2VoiceOn() ? 0 : 1 }); commit(); return true; }
  if(act === 'c2-voiceai'){ charaSet({ voiceAi:c2VoiceAiOn() ? 0 : 1 }); commit(); return true; }
  if(act === 'c2-mic'){ c2VoiceStart(); return true; }
  if(act === 'c2-say'){
    var q = val('c2_say').trim();
    if(!q){ toast('話しかけることばを入れてね', true); return true; }
    c2VoiceReply(q);
    return true;
  }
  if(act === 'c2-dlg-next'){ c2Ui.dlg++; render(); return true; }
  if(act === 'c2-dlg-ai'){ c2DialogAi(); return true; }
  if(act === 'c2-open'){
    appId = 'set'; S.ui.setOpen = S.ui.setOpen || {}; S.ui.setOpen.chara = 1; render();
    setTimeout(function(){ var el = document.querySelector('.c2-set'); if(el) el.scrollIntoView({ block:'start', behavior:'smooth' }); }, 50);
    return true;
  }
  return false;
});

/* ============================== AIが読めるように・検索 ============================== */
kmAiData('c2chara', 'キャラクターの性格・口調・なかよし度・今週AIが足したセリフ・今日の場面とキャラどうしの会話', function(){
  var k = charaNow();
  var ids = [k.id].concat(typeof charaPals === 'function' ? charaPals(2) : []);
  var d0 = (c2DialogList(today())[0] || { lines:[] });
  var week = {};
  ids.forEach(function(id){ week[id] = c2WeekLines(id); });
  return {
    now:{ id:k.id, name:k.name, level:charaLevel() },
    persona:ids.map(function(id){ var p = c2Persona(id); return { id:id, name:p.name, type:p.type, me:p.me, you:p.you, tic:p.tic, like:p.like, style:p.style, pitch:p.pitch, rate:p.rate, edited:p.edited }; }),
    bond:ids.map(function(id){ var b = c2Bond(id); return { id:id, level:b.lv, points:b.pts, toNext:b.next, meter:b.pct + '%', unlocked:c2BondUnlock.slice(1, b.lv + 1), parts:b.parts, first:b.first }; }),
    settings:{ chatChara:c2ChatOn(), weekAi:c2WeekAiOn(), notifyTalk:c2NotifyOn(), voiceOn:c2VoiceOn(), voiceAi:c2VoiceAiOn(), callName:(S.ui.chara || {}).callName || '' },
    weekLines:week,
    today:{ scenes:c2CtxNames(c2Ctx(today()).on), events:c2FesOn(today()).map(c2FesName), combos:c2ComboCount(k.id), linesToday:charaDayPool(k.id).total,
      dialog:d0.lines.map(function(l){ return charaById(l.id).name + '：' + l.t; }) }
  };
});
KM.aiData.c2chara.section = 'chara';
kmSearch(function(q){
  q = String(q || '').trim().toLowerCase();
  if(!q) return [];
  var out = [];
  var ct = S.charaTalk || {};
  Object.keys(ct).forEach(function(key){
    var e = ct[key];
    if(!e || !Array.isArray(e.lines) || out.length >= 20) return;
    var m = key.match(/^w:[\d-]+:(.+)$/);
    if(m && m[1] !== 'lock'){
      e.lines.forEach(function(s){ if(typeof s === 'string' && s.toLowerCase().indexOf(q) >= 0 && out.length < 20) out.push({ kind:'キャラのセリフ', title:s, sub:charaById(m[1]).name + '（AIが今週足したセリフ）', act:'c2-open', attrs:'' }); });
    }else if(/^c:/.test(key)){
      e.lines.forEach(function(l){ var s = String((l && l.t) || ''); if(s.toLowerCase().indexOf(q) >= 0 && out.length < 20) out.push({ kind:'キャラの会話', title:s, sub:key.slice(2) + 'のキャラどうしの会話', act:'c2-open', attrs:'' }); });
    }
  });
  charaAllIds().forEach(function(id){
    if(out.length >= 30) return;
    var p = c2Persona(id);
    if((p.name + ' ' + p.type + ' ' + p.me + ' ' + p.like + ' ' + p.style + ' ' + p.tic).toLowerCase().indexOf(q) >= 0)
      out.push({ kind:'キャラ', title:p.name, sub:'性格：' + p.type + '・一人称「' + p.me + '」' + (p.tic ? '・口ぐせ「' + p.tic + '」' : ''), act:'c2-open', attrs:'' });
  });
  return out;
});

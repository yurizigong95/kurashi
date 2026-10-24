/* かんご実習メーカー：AI（Gemini）とのやりとり
   ・APIキーは、この端末の中（localStorage）だけに保存する。Google 以外には送らない。
   ・ここでキーを入れていなければ、くらしの手帳に入れたキーを、そのまま自動で使う
     （もんだいメーカーと同じやり方。同じ端末の中で読むだけ。キーはどこにも写さない・同期しない）。
   ・使うモデルは、くらしの手帳・もんだいメーカーと同じ順でためす。
   ・テストのときは window.__FAKE_AI に差しかえる（本物は呼ばない）。 */

var AI_MODELS = [
  ['', 'おまかせ', '使えるものを自動でえらぶ'],
  ['gemini-3.6-flash', 'はやい', '安くてはやい。ふだんはこれで十分'],
  ['gemini-2.5-flash', 'ふつう', 'ひとつ前の、はやいモデル'],
  ['gemini-2.5-pro', 'かしこい', 'じっくり考えてほしいときに']
];
var AI_FALLBACK = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];

/* くらしの手帳（設定 › AIそうだん）に入れた Gemini のキー */
function aiKeyKurashi(){
  try{
    var j = JSON.parse(localStorage.getItem('shiharai:v1') || 'null');
    return String((j && j.settings && j.settings.geminiKey) || '').trim();
  }catch(e){ return ''; }
}
function aiKeyOwn(){ return String((S.set && S.set.key) || '').trim(); }
/* 使うキー：ここで入れたキー → なければ、くらしの手帳のキー */
function aiKey(){ return aiKeyOwn() || aiKeyKurashi(); }
/* どこのキーを使っているか（'own'・'kurashi'・''） */
function aiKeyFrom(){ return aiKeyOwn() ? 'own' : aiKeyKurashi() ? 'kurashi' : ''; }
function aiFake(){
  try{ if(window.__FAKE_AI) return window.__FAKE_AI; }catch(e){}
  try{ if(window.parent && window.parent !== window && window.parent.__FAKE_AI) return window.parent.__FAKE_AI; }catch(e){}
  return null;
}
function aiReady(){ return aiFake() ? true : !!aiKey(); }

/* ============================== 使ったぶんの記録 ============================== */
function aiUse(){
  var u = Object.assign({ d:'', req:0, tin:0, tout:0, m:'', mreq:0, mtin:0, mtout:0 }, (S.set && S.set.use) || {});
  var td = today(), mo = td.slice(0, 7);
  if(u.d !== td){ u.d = td; u.req = 0; u.tin = 0; u.tout = 0; }
  if(u.m !== mo){ u.m = mo; u.mreq = 0; u.mtin = 0; u.mtout = 0; }
  S.set.use = u;
  return u;
}
function aiUseAdd(meta){
  var u = aiUse();
  var tin = toNum(meta && (meta.promptTokenCount || meta.prompt_token_count));
  var tout = toNum(meta && (meta.candidatesTokenCount || meta.candidates_token_count)) +
             toNum(meta && (meta.thoughtsTokenCount || meta.thoughts_token_count));
  u.req++; u.mreq++;
  u.tin += tin; u.mtin += tin;
  u.tout += tout; u.mtout += tout;
  S.set.aiCount = toNum(S.set.aiCount) + 1;
  saveSoon();
  return u;
}
function aiTokText(n){
  n = Math.round(Number(n) || 0);
  if(n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1) + '万';
  return String(n);
}

/* ============================== 呼ぶ ==============================
   opt = { contents:[{ role:'user'|'model', parts:[{ text }] }], system:'', temperature, maxTokens, signal }
   → { text } */
async function aiCall(opt){
  opt = opt || {};
  var fake = aiFake();
  if(fake){
    var t = await fake(JSON.parse(JSON.stringify({ tag:opt.tag || 'care', system:opt.system || '', contents:opt.contents || [], maxTokens:opt.maxTokens || 0 })));
    if(t && typeof t === 'object' && t.usage) aiUseAdd(t.usage);
    return { text:(t && typeof t === 'object') ? String(t.text || '') : String(t == null ? '' : t) };
  }
  var key = aiKey();
  if(!key) throw new Error('先に「設定」で、GeminiのAPIキーを入れてください');
  var body = {
    contents: opt.contents || [],
    generationConfig: { temperature: opt.temperature == null ? 0.5 : opt.temperature, maxOutputTokens: opt.maxTokens || 4096 }
  };
  if(opt.system) body.systemInstruction = { parts:[{ text:String(opt.system) }] };
  var seen = {}, models = [];
  [String(S.set.model || '')].filter(Boolean).concat(AI_FALLBACK).forEach(function(m){ if(!seen[m]){ seen[m] = 1; models.push(m); } });
  var lastErr = '';
  for(var i = 0; i < models.length; i++){
    var res = null;
    try{
      res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + models[i] + ':generateContent', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-goog-api-key':key },
        body:JSON.stringify(body),
        signal:opt.signal
      });
    }catch(e){
      if((opt.signal && opt.signal.aborted) || /abort/i.test(String(e && (e.name || e.message)))) throw e;
      lastErr = 'ネットにつながりませんでした（' + String((e && e.message) || e).slice(0, 60) + '）';
      continue;                                        /* とちゅうで切れた：次のモデルでもう一度 */
    }
    var j = null;
    try{ j = await res.json(); }catch(e){}
    if(res.ok && j){
      aiUseAdd(j.usageMetadata || j.usage_metadata || null);
      var c = (j.candidates || [])[0] || {};
      var parts = (c.content || {}).parts || [];
      var text = parts.filter(function(p){ return typeof p.text === 'string' && !p.thought; }).map(function(p){ return p.text; }).join('');
      if(!text && c.finishReason === 'SAFETY') throw new Error('この内容には、AIが答えられませんでした。聞き方を変えてみてください。');
      return { text:text };
    }
    lastErr = (j && j.error && j.error.message) ? j.error.message : ('エラー ' + res.status);
    /* このモデルの枠がいっぱい（429）・混んでいる（500・503）ときは、次のモデルで */
    if(res.status === 429 || res.status >= 500) continue;
    /* そのモデルが無いときは、次のモデルを試す */
    if(!/not available|not found|NOT_FOUND|unsupported|deprecated|update your code/i.test(lastErr)) break;
    if(S.set.model === models[i]){ S.set.model = ''; saveSoon(); }
  }
  throw new Error(aiErrText(lastErr || 'つながりませんでした'));
}
function aiErrText(msg){
  msg = String(msg || '');
  if(/API key not valid|API_KEY_INVALID|401|invalid_api_key|PERMISSION_DENIED/i.test(msg)){
    return aiKeyFrom() === 'kurashi'
      ? 'くらしの手帳のAPIキーが使えないようです。くらしの手帳の設定で入れ直すか、この「設定」で別のキーを入れてください。'
      : 'APIキーが正しくないようです。設定で入れ直してください。';
  }
  if(/quota|RESOURCE_EXHAUSTED|429/i.test(msg)) return '今日の無料ぶんを使い切ったかもしれません。時間をおいて、もう一度ためしてください。';
  if(/overloaded|UNAVAILABLE|503|500|INTERNAL|high demand/i.test(msg)) return 'AI（Gemini）が混んでいるようです。少し時間をおいて、もう一度ためしてください。';
  if(/abort/i.test(msg)) return 'とちゅうでやめました';
  return msg.slice(0, 160);
}

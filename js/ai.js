/* くらしの手帳：AI（Gemini）を呼ぶ共通の道具 */
/* ============================== AI ==============================
   そうだん・シラバスの読み取り・シフト表の読み取り・会話のまとめ で使う。
   テストのときは、本物のAIのかわりに tests/ の「にせAI」を使う。          */
var AI_FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
function aiFake(){
  try{ if(window.__FAKE_AI) return window.__FAKE_AI; }catch(e){}
  try{ if(window.parent && window.parent !== window && window.parent.__FAKE_AI) return window.parent.__FAKE_AI; }catch(e){}
  return null;
}
function aiKey(){ return String(S.settings.geminiKey || '').trim(); }
function aiReady(){ return TEST_MODE ? !!aiFake() : !!aiKey(); }
/* opt: { system, contents:[{role,parts}], json, temperature, maxTokens, signal, tag } → 文字 */
async function aiGenerate(opt){
  opt = opt || {};
  if(TEST_MODE){
    var f = aiFake();
    if(!f) throw new Error('テストモードではAIを使えません');
    var t = await f(JSON.parse(JSON.stringify({ tag:opt.tag || '', system:opt.system || '', contents:opt.contents || [], json:!!opt.json })));
    return String(t == null ? '' : t);
  }
  var key = aiKey();
  if(!key) throw new Error('先に設定タブでGemini APIキーを登録してください');
  var body = {
    contents: opt.contents || [],
    generationConfig: { temperature: opt.temperature == null ? 0.3 : opt.temperature, maxOutputTokens: opt.maxTokens || 2048 }
  };
  if(opt.system) body.systemInstruction = { parts:[{ text:opt.system }] };
  if(opt.json) body.generationConfig.responseMimeType = 'application/json';
  var picked = S.ui.aiModel || S.settings.geminiModel;
  var seen = {}, models = [];
  [picked].filter(Boolean).concat(AI_FALLBACK_MODELS).forEach(function(m){ if(!seen[m]){ seen[m] = 1; models.push(m); } });
  var lastErr = '';
  for(var i = 0; i < models.length; i++){
    var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + models[i] + ':generateContent', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-goog-api-key':key },
      body: JSON.stringify(body),
      signal: opt.signal
    });
    var j = null;
    try{ j = await res.json(); }catch(e){}
    if(res.ok && j){
      if(S.settings.aiLastModel !== models[i]){ S.settings.aiLastModel = models[i]; persist(); }
      aiCountAdd();
      var c = (j.candidates || [])[0] || {};
      var text = ((c.content || {}).parts || []).map(function(p){ return p.text || ''; }).join('');
      if(c.finishReason === 'MAX_TOKENS') text += '\n\n（長くなったので途中までです。「続きを教えて」と送ると続きが読めます）';
      return text;
    }
    lastErr = (j && j.error && j.error.message) ? j.error.message : ('エラー ' + res.status);
    if(!/not available|not found|NOT_FOUND|unsupported|deprecated|update your code/i.test(lastErr)) break;
    if(S.ui.aiModel === models[i]){ S.ui.aiModel = ''; touch('ui'); }
  }
  throw new Error(aiErrText(lastErr || 'つながりませんでした'));
}
function aiErrText(msg){
  msg = String(msg || '');
  if(/API key not valid|API_KEY_INVALID|401|invalid_api_key/i.test(msg)) return 'APIキーが正しくないようです。設定タブで入れ直してください。';
  if(/quota|RESOURCE_EXHAUSTED|429/i.test(msg)) return '今日の無料ぶんを使い切ったかもしれません。';
  return msg.slice(0, 160);
}
/* 文章（と写真）を渡して、JSONで答えてもらう */
async function aiJson(prompt, images, tag){
  var parts = [];
  (images || []).forEach(function(dataUrl){
    var m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
    if(m) parts.push({ inline_data:{ mime_type:m[1], data:m[2] } });
  });
  parts.push({ text:prompt });
  var text = await aiGenerate({ contents:[{ role:'user', parts:parts }], json:true, temperature:0.1, maxTokens:4096, tag:tag });
  return parseJsonLoose(text);
}
function parseJsonLoose(text){
  var t = String(text || '').replace(/```json|```/g, '').trim();
  try{ return JSON.parse(t); }catch(e){}
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  var a2 = t.indexOf('['), b2 = t.lastIndexOf(']');
  if(a2 >= 0 && (a < 0 || a2 < a) && b2 > a2){ try{ return JSON.parse(t.slice(a2, b2 + 1)); }catch(e){} }
  if(a >= 0 && b > a){ try{ return JSON.parse(t.slice(a, b + 1)); }catch(e){} }
  throw new Error('AIの答えを読みとれませんでした');
}

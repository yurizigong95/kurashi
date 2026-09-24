/* もんだいメーカー：AI（Gemini）とのやりとり
   ・APIキーは、この端末の中（localStorage）だけに保存する。どこにも送らない。
   ・テストのときは window.__FAKE_AI に差しかえる（本物は呼ばない）。
   ・使った回数を数えて、設定タブに出す（へらせているかが分かるように）。 */

var AI_MODELS = [
  ['', 'おまかせ', '使えるものを自動でえらぶ'],
  ['gemini-3.6-flash', 'はやい', '安くてはやい。ふだんはこれで十分'],
  ['gemini-2.5-flash', 'ふつう', 'ひとつ前の、はやいモデル'],
  ['gemini-2.5-pro', 'かしこい', '長い資料や、むずかしい問題に']
];
var AI_FALLBACK = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];

function aiKey(){ return String((S.set && S.set.key) || '').trim(); }
function aiFake(){ return (typeof window !== 'undefined' && window.__FAKE_AI) ? window.__FAKE_AI : null; }
function aiReady(){ return aiFake() ? true : !!aiKey(); }
function aiCountAdd(n){
  S.set.aiCount = toNum(S.set.aiCount) + (n || 1);
  saveSoon();
}
function aiSavedAdd(n){
  S.set.aiSaved = toNum(S.set.aiSaved) + toNum(n);
  saveSoon();
}
/* 文章（と写真）を渡して、JSONで答えてもらう */
async function aiJson(prompt, images, opt){
  opt = opt || {};
  var parts = [];
  (images || []).forEach(function(dataUrl){
    var m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
    if(m) parts.push({ inline_data:{ mime_type:m[1], data:m[2] } });
  });
  parts.push({ text:prompt });
  var text = await aiGenerate({ contents:[{ role:'user', parts:parts }], json:true,
    temperature:opt.temperature == null ? 0.2 : opt.temperature,
    maxTokens:opt.maxTokens || 8192, tag:opt.tag || '', signal:opt.signal });
  return parseJsonLoose(text);
}
async function aiGenerate(opt){
  opt = opt || {};
  var fake = aiFake();
  if(fake){
    var t = await fake(JSON.parse(JSON.stringify({ tag:opt.tag || '', contents:opt.contents || [], json:!!opt.json })));
    return (t && typeof t === 'object') ? String(t.text || '') : String(t == null ? '' : t);
  }
  var key = aiKey();
  if(!key) throw new Error('先に「設定」で、GeminiのAPIキーを入れてください');
  var body = {
    contents: opt.contents || [],
    generationConfig: { temperature: opt.temperature == null ? 0.2 : opt.temperature, maxOutputTokens: opt.maxTokens || 4096 }
  };
  if(opt.json) body.generationConfig.responseMimeType = 'application/json';
  var seen = {}, models = [];
  [String(S.set.model || '')].filter(Boolean).concat(AI_FALLBACK).forEach(function(m){ if(!seen[m]){ seen[m] = 1; models.push(m); } });
  var lastErr = '';
  for(var i = 0; i < models.length; i++){
    var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + models[i] + ':generateContent', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-goog-api-key':key },
      body:JSON.stringify(body),
      signal:opt.signal
    });
    var j = null;
    try{ j = await res.json(); }catch(e){}
    if(res.ok && j){
      aiCountAdd();
      var c = (j.candidates || [])[0] || {};
      var parts = (c.content || {}).parts || [];
      return parts.filter(function(p){ return typeof p.text === 'string' && !p.thought; })
                  .map(function(p){ return p.text; }).join('');
    }
    lastErr = (j && j.error && j.error.message) ? j.error.message : ('エラー ' + res.status);
    /* そのモデルが無いときだけ、次のモデルを試す */
    if(!/not available|not found|NOT_FOUND|unsupported|deprecated|update your code/i.test(lastErr)) break;
    if(S.set.model === models[i]){ S.set.model = ''; saveSoon(); }
  }
  throw new Error(aiErrText(lastErr || 'つながりませんでした'));
}
function aiErrText(msg){
  msg = String(msg || '');
  if(/API key not valid|API_KEY_INVALID|401|invalid_api_key|PERMISSION_DENIED/i.test(msg)) return 'APIキーが正しくないようです。設定で入れ直してください。';
  if(/quota|RESOURCE_EXHAUSTED|429/i.test(msg)) return '今日の無料ぶんを使い切ったかもしれません。時間をおくか、「AIを使わずに作る」を試してください。';
  if(/abort/i.test(msg)) return 'とちゅうでやめました';
  return msg.slice(0, 160);
}
/* ```json …``` がついていても読めるようにする */
function parseJsonLoose(text){
  var t = String(text || '').replace(/```json|```/g, '').trim();
  try{ return JSON.parse(t); }catch(e){}
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  var a2 = t.indexOf('['), b2 = t.lastIndexOf(']');
  if(a2 >= 0 && (a < 0 || a2 < a) && b2 > a2){ try{ return JSON.parse(t.slice(a2, b2 + 1)); }catch(e){} }
  if(a >= 0 && b > a){ try{ return JSON.parse(t.slice(a, b + 1)); }catch(e){} }
  throw new Error('AIの答えを読みとれませんでした');
}

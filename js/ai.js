/* くらしの手帳：AI（Gemini）を呼ぶ共通の道具 */
/* ============================== AI ==============================
   そうだん・シラバスの読み取り・シフト表の読み取り・会話のまとめ などで使う。
   テストのときは、本物のAIのかわりに tests/ の「にせAI」を使う。          */
var AI_FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
function aiFake(){
  try{ if(window.__FAKE_AI) return window.__FAKE_AI; }catch(e){}
  try{ if(window.parent && window.parent !== window && window.parent.__FAKE_AI) return window.parent.__FAKE_AI; }catch(e){}
  return null;
}
function aiKey(){ return String(S.settings.geminiKey || '').trim(); }
/* サーバー側の鍵（Vercel の /api/gemini）があるときは、端末に鍵を入れなくてもAIが使える。
   置き場所にAPIが無いとき（GitHub Pages など）は、今までどおり端末の鍵だけになる */
var aiServerKey = null;   /* null=まだ分からない */
var aiServerBusy = null;
function aiServerCheck(){
  if(TEST_MODE){ aiServerKey = false; return Promise.resolve(false); }
  if(aiServerKey !== null) return Promise.resolve(aiServerKey);
  if(!aiServerBusy){
    aiServerBusy = fetch('/api/gemini').then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
      aiServerBusy = null;
      aiServerKey = !!(j && j.serverKey);
      /* 「鍵を登録してください」の帯が出ている相談の画面だけ、新しい状態で描き直す */
      if(aiServerKey && !aiKey() && typeof render === 'function' && typeof appId !== 'undefined' && appId === 'chat'){ try{ render(); }catch(e){} }
      return aiServerKey;
    }).catch(function(){ aiServerBusy = null; aiServerKey = false; return false; });
  }
  return aiServerBusy;
}
function aiReady(){ return TEST_MODE ? !!aiFake() : (!!aiKey() || aiServerKey === true); }
aiServerCheck();
/* ---------- 使うモデルを、Gemini のモデル一覧から自動で決める ----------
   新しいモデルが出たら、アプリを更新しなくてもそちらを使う。一覧は1日1回だけ取りに行く。
   一覧が取れないとき（キーなし・オフラインなど）は AI_FALLBACK_MODELS を使う。 */
var AI_MODELS_KEY = 'kurashi:aimodels:v1';
var AI_MODELS_TTL = 24 * 60 * 60 * 1000;
var aiModelsBusy = null;
/* 'gemini-3.6-flash' → [3,6]、'gemini-3-flash' → [3,0]。読めないものは [0,0] */
function aiModelVer(id){
  var m = String(id).match(/^gemini-(\d+)(?:\.(\d+))?(?=-|$)/);
  return m ? [Number(m[1]), Number(m[2] || 0)] : [0, 0];
}
/* flash=0・lite=1・pro=2・そのほか=3 */
function aiModelKind(id){
  return /lite/.test(id) ? 1 : /-pro(?=-|$)/.test(id) ? 2 : /flash/.test(id) ? 0 : 3;
}
function aiModelSort(a, b){
  var va = aiModelVer(a), vb = aiModelVer(b);
  return (vb[0] - va[0]) || (vb[1] - va[1]) || (aiModelKind(a) - aiModelKind(b)) || (a < b ? -1 : a > b ? 1 : 0);
}
/* 一覧（models.list の答え）から、ふだんの相談に使える候補を、選ぶ順に並べる（'models/' はとる）
   ① いちばん新しい flash → ② いちばん新しい lite → ③ いちばん新しい pro → ④ のこりを新しい順 */
function aiRankModelIds(modelsJson){
  var list = Array.isArray(modelsJson) ? modelsJson : ((modelsJson && modelsJson.models) || []);
  var ids = list.filter(function(m){
    return m && /^models\/gemini-/.test(m.name || '') && (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0;
  }).map(function(m){ return m.name.slice(7); }).filter(function(id){
    return !/preview|exp|latest|tts|image|embedding|robotics|computer-use/i.test(id);
  });
  ids = ids.filter(function(id, i){ return ids.indexOf(id) === i; }).sort(aiModelSort);
  var head = [0, 1, 2].map(function(k){ return ids.filter(function(id){ return aiModelKind(id) === k; })[0]; }).filter(Boolean);
  return head.concat(ids.filter(function(id){ return head.indexOf(id) < 0; }));
}
/* 読み上げ用（名前に tts をふくむもの）：flash を先に、新しい順 */
function aiRankTtsIds(names){
  return (names || []).filter(function(id, i, a){ return /tts/i.test(id) && a.indexOf(id) === i; }).sort(function(a, b){
    return ((/flash/.test(a) ? 0 : 1) - (/flash/.test(b) ? 0 : 1)) || aiModelSort(a, b);
  });
}
/* Gemini のモデル一覧を取りに行く → { ids, tts }。取れなければ null（エラーは外に出さない） */
async function aiModelIdsLive(){
  var key = aiKey();
  if(TEST_MODE || !key) return null;
  try{
    var all = [], token = '';
    for(var p = 0; p < 3; p++){
      var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), {
        headers:{ 'x-goog-api-key':key }
      });
      if(!res.ok) return null;
      var j = await res.json();
      all = all.concat((j && j.models) || []);
      token = (j && j.nextPageToken) || '';
      if(!token) break;
    }
    var ids = aiRankModelIds(all);
    if(!ids.length) return null;
    var names = all.filter(function(m){
      return m && /^models\/gemini-/.test(m.name || '') && (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0;
    }).map(function(m){ return m.name.slice(7); });
    return { ids:ids, tts:aiRankTtsIds(names) };
  }catch(e){ return null; }
}
/* しまってある一覧。anyAge のときは古くても返す（設定の表示用） */
function aiModelsCached(anyAge){
  try{
    var o = JSON.parse(localStorage.getItem(AI_MODELS_KEY) || 'null');
    if(o && Array.isArray(o.ids) && o.ids.length && (anyAge || Date.now() - (o.at || 0) < AI_MODELS_TTL)) return o;
  }catch(e){}
  return null;
}
function aiModelsForget(){ try{ localStorage.removeItem(AI_MODELS_KEY); }catch(e){} }
async function aiModelsLoad(){
  var o = aiModelsCached();
  if(o) return o;
  if(!aiModelsBusy){
    aiModelsBusy = aiModelIdsLive().then(function(r){
      aiModelsBusy = null;
      if(!r) return null;
      r.at = Date.now();
      try{ localStorage.setItem(AI_MODELS_KEY, JSON.stringify(r)); }catch(e){}
      return r;
    });
  }
  return aiModelsBusy;
}
/* ふだんの相談に使う候補（選ぶ順）。取れなければ null */
async function aiModelCandidates(){
  var o = await aiModelsLoad();
  return o ? o.ids.slice() : null;
}
/* 読み上げに使うモデル（選ぶ順）。取れなければ null */
async function aiTtsModelIds(){
  var o = await aiModelsLoad();
  return (o && o.tts && o.tts.length) ? o.tts.slice() : null;
}
function aiModelOrder(picked, cands){
  var seen = {}, models = [];
  [picked].filter(Boolean).concat(cands || AI_FALLBACK_MODELS).forEach(function(m){ if(!seen[m]){ seen[m] = 1; models.push(m); } });
  return models;
}
/* opt: { system, contents:[{role,parts}], json, temperature, maxTokens, signal, tag } → 文字 */
async function aiGenerate(opt){
  var r = await aiCall(opt);
  return r.text;
}
function aiTextOf(parts){
  return (parts || []).filter(function(p){ return typeof p.text === 'string' && !p.thought; }).map(function(p){ return p.text; }).join('');
}
/* くわしい答え：{ text, parts, calls:[{name,args}], grounding, urlMeta, content, cut }
   opt.tools … Geminiの道具（関数・Google検索・URLの読み取り）。道具が使えないモデルでは、道具なしでやり直す
   長い答えが途中で切れたら（cut）、続きを自動でもらって1つの答えにつなぐ（JSON・道具を呼ぶ答えはのぞく） */
var AI_MORE_MAX = 4;
var AI_MORE_ASK = 'いまの答えは、長さの上限で途中で切れました。切れたところの直後から、続きだけを書いてください。' +
  '前に書いた文はくり返さず、あいさつや前置きも書かないでください。';
async function aiCall(opt){
  opt = opt || {};
  var r = await aiCallOnce(opt);
  var n = 0;
  /* 道具を使ったあとの会話は、道具の説明もいっしょに送らないと受けつけてもらえないことがある */
  var usedTools = (opt.contents || []).some(function(c){ return (c.parts || []).some(function(p){ return p.functionCall || p.functionResponse; }); });
  while(r.cut && !opt.json && !r.calls.length && r.text.trim() && n < AI_MORE_MAX){
    n++;
    var more;
    try{
      more = await aiCallOnce(Object.assign({}, opt, { tools:usedTools ? opt.tools : null, contents:(opt.contents || []).concat([
        { role:'model', parts:[{ text:r.text }] },
        { role:'user', parts:[{ text:AI_MORE_ASK }] }
      ]) }));
    }catch(e){
      if(opt.signal && opt.signal.aborted) throw e;
      break;                                   /* 続きがもらえなかったときは、そこまでの答えを出す */
    }
    if(more.calls.length || !more.text.trim()) break;
    r.text += more.text;
    r.cut = more.cut;
    r.parts = [{ text:r.text }];
    r.content = { role:'model', parts:r.parts };
  }
  return r;
}
/* サーバー中継（/api/gemini）で生成する。応答の形は直接のときと同じで、モデルは中継側が自動で選ぶ。
   中継が使えない（501＝中継側にも鍵が無い）ときは null を返し、直接の呼び出しにまかせる */
async function aiCallViaServer(opt, body, picked){
  var res;
  try{
    res = await fetch('/api/gemini', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-kurashi-model': picked || '' },
      body: JSON.stringify(body),
      signal: opt.signal
    });
  }catch(e){
    if(opt.signal && opt.signal.aborted) throw e;
    return null;
  }
  if(res.status === 501) return null;
  var j = null;
  try{ j = await res.json(); }catch(e){}
  if(res.ok && j){
    var served = j.servedModel || picked || '';
    if(served && S.settings.aiLastModel !== served){ S.settings.aiLastModel = served; persist(); }
    aiCountAdd();
    var c = (j.candidates || [])[0] || {};
    var parts = (c.content || {}).parts || [];
    return { text:aiTextOf(parts), parts:parts, content:c.content || { role:'model', parts:parts },
             calls:parts.filter(function(p){ return p.functionCall; }).map(function(p){ return p.functionCall; }),
             grounding:c.groundingMetadata || null, urlMeta:c.urlContextMetadata || c.url_context_metadata || null,
             cut:c.finishReason === 'MAX_TOKENS' };
  }
  var msg = (j && j.error) ? (j.error.message || String(j.error)) : ('エラー ' + res.status);
  /* 道具が使えないと言われたら、道具なしでもう一度（直接のときと同じ扱い） */
  if(body.tools && opt.toolFallback !== false && /tool|function|google_search|url_context|grounding|not supported|unsupported/i.test(msg)){
    var b2 = Object.assign({}, body);
    delete b2.tools;
    return aiCallViaServer(opt, b2, picked);
  }
  throw new Error(aiErrText(msg));
}
async function aiCallOnce(opt){
  if(TEST_MODE){
    var f = aiFake();
    if(!f) throw new Error('テストモードではAIを使えません');
    var toolNames = (opt.tools || []).map(function(t){
      return t.functionDeclarations ? 'functions' : Object.keys(t)[0];
    });
    var t = await f(JSON.parse(JSON.stringify({ tag:opt.tag || '', system:opt.system || '', contents:opt.contents || [], json:!!opt.json, tools:toolNames })));
    if(t && typeof t === 'object'){
      var parts0 = t.parts || [{ text:String(t.text || '') }];
      return { text:aiTextOf(parts0), parts:parts0, calls:parts0.filter(function(p){ return p.functionCall; }).map(function(p){ return p.functionCall; }),
               grounding:t.grounding || null, urlMeta:null, content:{ role:'model', parts:parts0 }, cut:t.finishReason === 'MAX_TOKENS' };
    }
    var s = String(t == null ? '' : t);
    return { text:s, parts:[{ text:s }], calls:[], grounding:null, urlMeta:null, content:{ role:'model', parts:[{ text:s }] }, cut:false };
  }
  var body = {
    contents: opt.contents || [],
    generationConfig: { temperature: opt.temperature == null ? 0.3 : opt.temperature, maxOutputTokens: opt.maxTokens || 2048 }
  };
  if(opt.system) body.systemInstruction = { parts:[{ text:opt.system }] };
  if(opt.json) body.generationConfig.responseMimeType = 'application/json';
  if(opt.tools && opt.tools.length) body.tools = opt.tools;
  var picked = S.ui.aiModel || S.settings.geminiModel;
  /* サーバー側の鍵があれば中継で呼ぶ（中継が無い・鍵が無いときは、下の直接の呼び出しに落ちる） */
  if(aiServerKey === null) await aiServerCheck();
  if(aiServerKey){
    var via = await aiCallViaServer(opt, body, picked);
    if(via) return via;
  }
  var key = aiKey();
  if(!key) throw new Error('先に設定タブでGemini APIキーを登録してください');
  var models = aiModelOrder(picked, await aiModelCandidates());
  var lastErr = '', tried = [], relisted = false;
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
      var parts = (c.content || {}).parts || [];
      var text = aiTextOf(parts);
      return { text:text, parts:parts, content:c.content || { role:'model', parts:parts },
               calls:parts.filter(function(p){ return p.functionCall; }).map(function(p){ return p.functionCall; }),
               grounding:c.groundingMetadata || null, urlMeta:c.urlContextMetadata || c.url_context_metadata || null,
               cut:c.finishReason === 'MAX_TOKENS' };
    }
    lastErr = (j && j.error && j.error.message) ? j.error.message : ('エラー ' + res.status);
    /* 道具が使えないと言われたら、道具なしでもう一度 */
    if(body.tools && /tool|function|google_search|url_context|grounding|not supported|unsupported/i.test(lastErr) && opt.toolFallback !== false){
      delete body.tools;
      i--;
      continue;
    }
    if(!/not available|not found|NOT_FOUND|unsupported|deprecated|update your code/i.test(lastErr)) break;
    if(S.ui.aiModel === models[i]){ S.ui.aiModel = ''; touch('ui'); }
    tried.push(models[i]);
    /* ぜんぶ使えなかったら、一覧を1回だけ取り直して、まだ試していないモデルで続ける */
    if(i === models.length - 1 && !relisted){
      relisted = true;
      aiModelsForget();
      var fresh = await aiModelCandidates();
      if(fresh){
        models = aiModelOrder('', fresh).filter(function(m){ return tried.indexOf(m) < 0; });
        i = -1;
      }
    }
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

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
/* ============================== 大きな資料を預ける ==============================
   何百MBもあるPDF・録音・動画は、そのままくっつけては送れない。
   いったん Gemini に預けて（少しずつ送る）、その置き場所を見てもらう。
   ・キーはこの端末の中だけ。ファイルは Google 以外には送らない
   ・預けたものは、Google側で48時間ほどで消える                                  */
var UP_CHUNK = 8 * 1024 * 1024;   /* 1回に送る大きさ */
var AI_BASE = 'https://generativelanguage.googleapis.com';
function aiFakeUp(){ return (typeof window !== 'undefined' && window.__FAKE_UPLOAD) ? window.__FAKE_UPLOAD : null; }
function aiWait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
async function aiResErr(res){
  var j = null;
  try{ j = await res.json(); }catch(e){}
  return (j && j.error && j.error.message) ? j.error.message : ('エラー ' + res.status);
}
async function aiUpload(file, opt){
  opt = opt || {};
  var fake = aiFakeUp();
  if(fake) return await fake({ name:file.name, size:file.size, type:file.type || '' });
  var key = aiKey();
  if(!key) throw new Error('先に「設定」で、GeminiのAPIキーを入れてください');
  var mime = String(file.type || '') || 'application/octet-stream';
  /* ① 置き場所をもらう（少しずつ送るやり方） */
  var url = '', st = null;
  try{
    st = await fetch(AI_BASE + '/upload/v1beta/files', {
      method:'POST',
      headers:{
        'x-goog-api-key':key,
        'X-Goog-Upload-Protocol':'resumable',
        'X-Goog-Upload-Command':'start',
        'X-Goog-Upload-Header-Content-Length':String(file.size),
        'X-Goog-Upload-Header-Content-Type':mime,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({ file:{ display_name:String(file.name || '資料').slice(0, 120) } }),
      signal:opt.signal
    });
  }catch(e){
    if(e && /abort/i.test(String(e.name || e.message))) throw e;
    st = null;                                   /* つながらないときは、下の「ひと息で送る」に回す */
  }
  if(st && !st.ok) throw new Error(aiErrText(await aiResErr(st)));
  if(st) url = st.headers.get('x-goog-upload-url') || st.headers.get('X-Goog-Upload-URL') || '';
  var info = null;
  if(url){
    /* ② 少しずつ送る（進みぐあいを出せる） */
    var sent = 0;
    while(sent < file.size){
      var end = Math.min(file.size, sent + UP_CHUNK), last = end >= file.size;
      var res = await fetch(url, {
        method:'POST',
        headers:{ 'X-Goog-Upload-Offset':String(sent), 'X-Goog-Upload-Command':'upload' + (last ? ', finalize' : '') },
        body:file.slice(sent, end),
        signal:opt.signal
      });
      if(!res.ok) throw new Error(aiErrText(await aiResErr(res)));
      sent = end;
      if(opt.onProgress) try{ opt.onProgress(Math.round(sent / Math.max(1, file.size) * 100)); }catch(e){}
      if(last){ try{ info = await res.json(); }catch(e){} }
    }
  }else{
    /* ②' 送り先を教えてもらえないブラウザでは、ひと息で送る（進みぐあいは出せない） */
    if(opt.onProgress) try{ opt.onProgress(null); }catch(e){}
    var r2 = await fetch(AI_BASE + '/upload/v1beta/files', {
      method:'POST',
      headers:{ 'x-goog-api-key':key, 'X-Goog-Upload-Protocol':'raw', 'Content-Type':mime },
      body:file,
      signal:opt.signal
    });
    if(!r2.ok) throw new Error(aiErrText(await aiResErr(r2)));
    try{ info = await r2.json(); }catch(e){}
    if(opt.onProgress) try{ opt.onProgress(100); }catch(e){}
  }
  var fi = (info && info.file) || {};
  if(!fi.uri) throw new Error('大きな資料を送れませんでした。もう一度ためしてください。');
  /* ③ 録音や動画は、あちらの読みこみが終わるまで少し待つ */
  for(var i = 0; i < 90 && String(fi.state || '') === 'PROCESSING'; i++){
    await aiWait(2000);
    var g = await fetch(AI_BASE + '/v1beta/' + fi.name, { headers:{ 'x-goog-api-key':key }, signal:opt.signal });
    if(!g.ok) break;
    try{ fi = await g.json(); }catch(e){ break; }
  }
  if(String(fi.state || '') === 'FAILED') throw new Error('AIがこの資料を読めませんでした（形がちがうかもしれません）');
  aiCountAdd();
  return { uri:fi.uri, mime:fi.mimeType || mime, name:file.name };
}

/* 文章（と写真・預けた資料）を渡して、JSONで答えてもらう */
async function aiJson(prompt, images, opt){
  opt = opt || {};
  var parts = [];
  (images || []).forEach(function(dataUrl){
    var m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
    if(m) parts.push({ inline_data:{ mime_type:m[1], data:m[2] } });
  });
  (opt.files || []).forEach(function(r){
    if(r && r.uri) parts.push({ file_data:{ mime_type:r.mime || '', file_uri:r.uri } });
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

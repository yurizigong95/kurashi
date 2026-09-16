/* くらしの手帳：端末どうしの同期 */
/* ============================== 同期 ==============================
   しくみ（v3）
   ・データを「かたまり（part）」ごとに分けて、圧縮して送る。
     1つの入れもの（1MB）に入りきらないときは、いくつかに切って送る。
   ・目次（どのかたまりが、どの版か）を1つの文書に書いておき、
     それが変わったら、変わったかたまりだけを取りに行く。
   ・写真も小さく切って送る（端末になければ取りに行く）。
   ・どの端末が、いつ、どの版で使ったかも目次に残す。
   ・前の版（16b まで）の文書は読むだけ。書きこまない。            */
var syncState = { on:false, msg:'', unsub:[], timer:null, connecting:false, remote:null,
                  sending:false, again:false, pulling:false, pullAgain:false, dirty:false,
                  writes:[], pauseUntil:0, fails:{}, devices:{} };

function parseFbConfig(txt){
  var s = String(txt == null ? '' : txt).trim();
  if(!s) throw new Error('EMPTY');
  s = s.replace(/^\s*\/\/.*$/gm, '');
  var a = s.indexOf('{'), b = s.lastIndexOf('}');
  s = (a >= 0 && b > a) ? s.slice(a, b + 1) : '{' + s + '}';
  s = s.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":');
  s = s.replace(/'([^'\\]*)'/g, '"$1"');
  s = s.replace(/,\s*([}\]])/g, '$1');
  var cfg = JSON.parse(s);
  if(!cfg || !cfg.apiKey || !cfg.projectId) throw new Error('MISSING');
  return cfg;
}
/* Firebase を読み込む。まず新しい方式、だめなら昔ながらの方式で */
var fbLoad = null;
function loadFirebase(){
  if(fbLoad) return fbLoad;
  fbLoad = (async function(){
    /* 1) module 方式 */
    try{
      var fa = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      var ff = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      return { mode:'mod', fa:fa, ff:ff };
    }catch(e){ /* 次を試す */ }
    /* 2) script タグ方式（古いSafari向け） */
    var add = function(src){
      return new Promise(function(res, rej){
        var sc = document.createElement('script');
        sc.src = src; sc.async = true;
        sc.onload = res; sc.onerror = function(){ rej(new Error('SCRIPT_FAIL')); };
        document.head.appendChild(sc);
      });
    };
    await add('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
    await add('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js');
    if(!window.firebase) throw new Error('SCRIPT_FAIL');
    return { mode:'compat', fb:window.firebase };
  })();
  return fbLoad;
}

/* ===== Firestore とのやりとりを、同じ形にそろえる =====
   get(id) → 中身 or null ／ set(id, 中身, 足し合わせるか) ／ del(id) ／ listen(id, 受け取り, 失敗) */
var fsa = null;
var FS_COL = 'shiharai';
function withTimeout(p, ms, label){
  return new Promise(function(res, rej){
    var done = false;
    var t = setTimeout(function(){ if(!done){ done = true; rej(new Error((label||'通信') + 'が時間切れです（オフラインかもしれません）')); } }, ms);
    p.then(function(v){ if(!done){ done = true; clearTimeout(t); res(v); } },
           function(e){ if(!done){ done = true; clearTimeout(t); rej(e); } });
  });
}
function makeRealAdapter(lib, cfg){
  if(lib.mode === 'mod'){
    var ff = lib.ff;
    var app = lib.fa.initializeApp(cfg, 'kurashi-' + Date.now());
    var db = ff.getFirestore(app);
    var ref = function(id){ return ff.doc(db, FS_COL, id); };
    return {
      get: function(id){ return ff.getDoc(ref(id)).then(function(s){ return s.exists() ? s.data() : null; }); },
      set: function(id, data, merge){ return merge ? ff.setDoc(ref(id), data, { merge:true }) : ff.setDoc(ref(id), data); },
      del: function(id){ return ff.deleteDoc(ref(id)); },
      listen: function(id, ok, ng){ return ff.onSnapshot(ref(id), function(s){ ok(s.exists() ? s.data() : null); }, ng); }
    };
  }
  var fb = lib.fb;
  var app2 = fb.apps && fb.apps.length ? fb.app() : fb.initializeApp(cfg);
  var col = fb.firestore(app2).collection(FS_COL);
  return {
    get: function(id){ return col.doc(id).get().then(function(s){ return s.exists ? s.data() : null; }); },
    set: function(id, data, merge){ return merge ? col.doc(id).set(data, { merge:true }) : col.doc(id).set(data); },
    del: function(id){ return col.doc(id)['delete'](); },
    listen: function(id, ok, ng){ return col.doc(id).onSnapshot(function(s){ ok(s.exists ? s.data() : null); }, ng); }
  };
}
/* テスト用の入れもの（tests/ から渡される） */
function fakeAdapter(){
  try{ if(window.__FAKE_FS) return window.__FAKE_FS; }catch(e){}
  try{ if(window.parent && window.parent !== window && window.parent.__FAKE_FS) return window.parent.__FAKE_FS; }catch(e){}
  return null;
}

/* 文書の名前 */
function docMain(){ return DEFAULT_ROOM + '__v3'; }
function docLegacy(){ return DEFAULT_ROOM; }
function docChunk(part, h, i){ return DEFAULT_ROOM + '__v3_' + part + '_' + h + '_' + i; }
function docPhotoIdx(){ return DEFAULT_ROOM + '__v3_photos'; }
function docPhoto(pid, i){ return DEFAULT_ROOM + '__v3_img_' + String(pid).replace(/[^A-Za-z0-9_-]/g, '') + '_' + i; }

async function initSync(){
  var room = DEFAULT_ROOM, fbConfig = DEFAULT_FB;
  if(!room || !fbConfig) return;
  if(syncState.connecting || syncState.on) return;
  var fake = TEST_MODE ? fakeAdapter() : null;
  if(TEST_MODE && !fake){ updateSyncTag(); return; }   /* テストでは本物のFirebaseにつながない */
  if(!fake && location.protocol === 'file:'){
    syncState.on = false;
    syncState.msg = 'ファイルを直接開いています。同期を使うには、GitHubのページ（https:// で始まるURL）から開いてください。';
    updateSyncTag(); render(); return;
  }
  syncState.connecting = true; updateSyncTag();
  try{
    if(fake) fsa = fake;
    else {
      var cfg = parseFbConfig(fbConfig);
      var lib = await loadFirebase();
      fsa = makeRealAdapter(lib, cfg);
    }
    stopListeners();
    syncState.on = true; syncState.msg = ''; syncState.retry = 0; syncState.err = '';
    /* 目次 */
    syncState.unsub.push(fsa.listen(docMain(), onMainDoc, onListenErr));
    /* 前の版の文書（読むだけ） */
    syncState.unsub.push(fsa.listen(docLegacy(), onLegacyDoc, function(){}));
    /* 写真の目次 */
    syncState.unsub.push(fsa.listen(docPhotoIdx(), onPhotoIdx, function(){}));
    updateSyncTag(); render();
  }catch(e){
    syncState.on = false;
    var m = String(e && e.message || '');
    var netErr = /Failed to fetch|dynamically imported|NetworkError|load failed|Importing a module script failed|module script|SCRIPT_FAIL|Load failed|ERR_|timeout/i.test(m);
    syncState.msg = (m === 'EMPTY')   ? 'Firebaseの設定が空です。'
                  : (m === 'MISSING') ? 'Firebaseの設定に apiKey と projectId がありません。'
                  : netErr ? 'つなぎ直しています…（ネットの調子が悪いかもしれません）'
                  : '同期の準備ができませんでした（'+m.slice(0,60)+'）';
    logErr('同期', syncState.msg);
    if(netErr){
      fbLoad = null;
      syncState.retry = (syncState.retry||0) + 1;
      if(syncState.retry <= 5){
        clearTimeout(syncState.retryTimer);
        syncState.retryTimer = setTimeout(function(){ syncState.connecting=false; initSync(); }, 3000 * syncState.retry);
      }else{
        syncState.msg = 'ネットにつながりません。時間をおいて開き直してください。';
      }
    }
    render();
  }finally{
    syncState.connecting = false;
    updateSyncTag();
  }
}
function stopListeners(){
  (syncState.unsub||[]).forEach(function(u){ try{ if(typeof u === 'function') u(); }catch(e){} });
  syncState.unsub = [];
}
function onListenErr(err){
  syncState.on = false;
  syncState.msg = 'つながりませんでした：' + (err && err.message || err);
  logErr('同期', syncState.msg);
  stopListeners();
  updateSyncTag(); render();
}
/* 目次が届いた */
function onMainDoc(data){
  syncState.pulledAt = Date.now();
  syncState.remote = data || { parts:{} };
  syncState.devices = (data && data.devices) || {};
  try{ localStorage.setItem(KEY + ':devices', JSON.stringify(syncState.devices)); }catch(e){}
  var rp = syncState.remote.parts || {};
  /* まだだれも送っていなければ、この端末が最初（合わせる相手がいない） */
  if(!rp.core && !SYNC_LOCAL.firstPullAt){ SYNC_LOCAL.firstPullAt = Date.now(); saveSyncLocal(); }
  var need = Object.keys(SYNC_PARTS).some(function(p){ return rp[p] && rp[p].h !== SYNC_LOCAL.applied[p]; });
  if(need) pullParts();
  else pushRemote();          /* こちらにしかないものがあれば送る */
  updateSyncTag();
  if(appId === 'set' && !isTyping()) render();
}
/* 前の版（16b まで）の文書：新しく書かれていたら取りこむ */
function onLegacyDoc(data){
  if(!data) return;
  var at = Number(data.updatedAt) || 0;
  syncState.legacy = { at:at, build:data.build || '（とても古い版）' };
  if(at && at <= (SYNC_LOCAL.legacyAt || 0)) return;
  var got = unpackRemote(data);
  if(got){
    mergeRemote(got);
    SYNC_LOCAL.legacyAt = at || Date.now();
    saveSyncLocal();
  }
}

/* ===== 同期するもの（ぜんぶ入れる）=====
   LISTS    … id と mt を持つ一覧（1件ずつ新しい方を採る）
   WHOLE    … 設定のかたまり（新しい方で丸ごと入れ替える）
   MAPS     … 名前をキーにした表（両方の端末で足したぶんを残す）
   LOGS     … 記録の配列（重複を消してつなげる）                       */
var LISTS = ['income','fixed','balances','events','tasks','exams','health','shifts','holidays','notes','notices','breaks'];
var WHOLE_KEYS = ['terms','commute','ui','transit','termsList','chatQuick'];
var MAP_KEYS = ['attend','courseMeta','memos','payApplied','attendLog','grades','biweek','termsDone',
                'progress','taskLog','syllabus','dayReview','aiUse','chatMeta','aiLog','cloud'];
var LOG_KEYS = ['transitLog','aiFeedback','aiMemo','trash'];
/* APIキー・Googleの合言葉は送らない（大事な鍵なので、端末ごとに入れる） */
var SET_KEYS = ['smbcDay','rakutenDay','geminiModel','aiTone','aiLen','aiStyle',
                'regDeadline','minWeekday','minWeekend','fare','shop','payBankId','wage','classOnHoliday','shiftName','fuyouLimit'];
/* 同期のために時刻を見るキーぜんぶ */
var META_KEYS = WHOLE_KEYS.concat(MAP_KEYS, LOG_KEYS, ['settings','chat','chatRooms']);

/* かたまりの分け方（変わったかたまりだけ送る） */
var SYNC_PARTS = {
  core:  { keys:['plans','statements','paid','risyu','settings','termId','backupAt','delAt','revAt','deleted',
                 'terms','commute','ui','transit','termsList'],
           meta:['terms','commute','ui','transit','termsList','settings'] },
  plan:  { keys:['events','tasks','exams','health','holidays','breaks'], meta:[] },
  money: { keys:['income','fixed','balances','shifts'], meta:[] },
  notes: { keys:['notes','notices'], meta:[] },
  maps:  { keys:['attend','courseMeta','memos','payApplied','attendLog','grades','biweek','termsDone','progress','taskLog','syllabus','dayReview','cloud'],
           meta:['attend','courseMeta','memos','payApplied','attendLog','grades','biweek','termsDone','progress','taskLog','syllabus','dayReview','cloud'] },
  ai:    { keys:['chat','chatRooms','chatMeta','chatQuick','aiUse','aiLog','aiFeedback','aiMemo'],
           meta:['chatMeta','chatQuick','aiUse','aiLog','aiFeedback','aiMemo'] },
  logs:  { keys:['transitLog','trash'], meta:['transitLog','trash'] }
};
function syncSettingsOf(){
  /* どの端末でも同じキーがそろうように、ないものは null にする（合わせたときに古い値が残らない） */
  var set = {};
  SET_KEYS.forEach(function(k){ set[k] = (S.settings[k] === undefined) ? null : S.settings[k]; });
  return set;
}
function statementsForSync(){
  return (S.statements||[]).map(function(s){
    return { id:s.id, accountId:s.accountId, billingMonth:s.billingMonth, amount:s.amount, memo:s.memo||'', createdAt:s.createdAt||0, mt:s.mt||0 };
  });
}
function buildPart(name){
  var def = SYNC_PARTS[name], o = {};
  def.keys.forEach(function(k){
    if(k === 'settings') o.settings = syncSettingsOf();
    else if(k === 'statements') o.statements = statementsForSync();
    else if(k === 'deleted') o.deleted = (S.deleted||[]).slice().sort();
    else o[k] = (S[k] === undefined) ? null : S[k];
  });
  o.meta = {};
  def.meta.forEach(function(k){ o.meta[k] = Number(S.meta[k]) || 0; });
  return o;
}
/* 書き出し・バックアップ用に、ぜんぶを1つにまとめたもの */
function payload(){
  var o = {};
  Object.keys(SYNC_PARTS).forEach(function(p){
    var part = buildPart(p);
    Object.keys(part).forEach(function(k){
      if(k === 'meta') o.meta = Object.assign(o.meta || {}, part.meta);
      else o[k] = part[k];
    });
  });
  o.meta = Object.assign({}, S.meta);
  o.ver = DATA_VER; o.build = APP_BUILD; o.updatedAt = Date.now();
  return o;
}

/* ===== 比べるための「決まった書き方」と、短い指紋 ===== */
function canon(v){
  if(v === null || v === undefined || typeof v !== 'object'){
    if(typeof v === 'number' && !isFinite(v)) return 'null';
    return JSON.stringify(v === undefined ? null : v);
  }
  if(Array.isArray(v)){
    var arr = v;
    if(arr.length && arr.every(function(x){ return x && typeof x === 'object' && !Array.isArray(x) && x.id != null; })){
      arr = arr.slice().sort(function(a,b){ var A = String(a.id), B = String(b.id); return A < B ? -1 : A > B ? 1 : 0; });
    }
    return '[' + arr.map(canon).join(',') + ']';
  }
  var ks = Object.keys(v).filter(function(k){ return v[k] !== undefined && typeof v[k] !== 'function'; }).sort();
  return '{' + ks.map(function(k){ return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
}
function hash53(str){
  var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for(var i = 0; i < str.length; i++){
    var ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + 'x' + str.length.toString(36);
}
/* どちらを残すか決まらないときは、決まった順で選ぶ（両方の端末で同じ答えになる） */
function pickCanon(a, b){ return canon(a) >= canon(b) ? a : b; }

/* ===== 圧縮 ===== */
var CAN_GZIP = (typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined' &&
                typeof Blob !== 'undefined' && typeof Response !== 'undefined');
function bytesToB64(u8){
  var s = '', CH = 0x8000;
  for(var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}
function b64ToBytes(b){
  var s = atob(b), u = new Uint8Array(s.length);
  for(var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
async function gzipText(text){
  var stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return bytesToB64(new Uint8Array(await new Response(stream).arrayBuffer()));
}
async function gunzipText(b64){
  if(!CAN_GZIP) throw new Error('この端末は古いので、圧縮したデータを読めません');
  var stream = new Blob([b64ToBytes(b64)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}
function utf8Len(s){
  s = String(s);
  try{ if(typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length; }catch(e){}
  try{ return unescape(encodeURIComponent(s)).length; }catch(e){ return s.length * 3; }
}
/* 前の版の文書をひらく */
function unpackRemote(data){
  if(!data || typeof data !== 'object') return null;
  if(typeof data.json === 'string'){
    try{
      var o = JSON.parse(data.json);
      if(o && typeof o === 'object'){ o.__packed = 1; return o; }
    }catch(e){ return null; }
    return null;
  }
  if(data.v === 3) return null;
  return data;
}

/* ===== 書きこみすぎ防止（こわれて同じことをくり返しても、止まるように） ===== */
var WRITE_LIMIT = 120, WRITE_WINDOW = 5*60*1000;
/* 写真は別の数え方にする（たくさん送っても、予定などの同期は止めない） */
var photoWrites = { list:[], pauseUntil:0 }, PHOTO_WRITE_LIMIT = 150;
function guardWrite(kind){
  var now = Date.now();
  if(kind === 'photo'){
    if(now < photoWrites.pauseUntil) throw new Error('写真を送りすぎたので、少し休んでいます');
    photoWrites.list = photoWrites.list.filter(function(t){ return now - t < WRITE_WINDOW; });
    if(photoWrites.list.length >= PHOTO_WRITE_LIMIT){
      photoWrites.pauseUntil = now + 5*60*1000;
      throw new Error('写真を送りすぎたので、少し休んでいます');
    }
    photoWrites.list.push(now);
    return;
  }
  if(now < syncState.pauseUntil) throw new Error('書きこみが多すぎたので、少し休んでいます');
  syncState.writes = syncState.writes.filter(function(t){ return now - t < WRITE_WINDOW; });
  if(syncState.writes.length >= WRITE_LIMIT){
    syncState.pauseUntil = now + 10*60*1000;
    logErr('同期', '5分で'+WRITE_LIMIT+'回以上書きこもうとしたので、10分止めました');
    throw new Error('書きこみが多すぎたので、少し休んでいます');
  }
  syncState.writes.push(now);
}
async function fsSet(id, data, merge, kind){ guardWrite(kind); return withTimeout(fsa.set(id, data, merge), 30000, '保存'); }
async function fsGet(id){ return withTimeout(fsa.get(id), 30000, '読みこみ'); }
async function fsDel(id, kind){ guardWrite(kind); return withTimeout(fsa.del(id), 30000, '削除'); }
function isOffline(){ return typeof navigator !== 'undefined' && navigator.onLine === false; }

/* ===== 受け取る ===== */
var CHUNK = 900000;
async function fetchPart(name, m){
  var ids = [];
  for(var i = 0; i < (m.n||1); i++) ids.push(docChunk(name, m.h, i));
  var docs = await Promise.all(ids.map(fsGet));
  var pieces = docs.map(function(d){
    if(!d || d.h !== m.h) throw new Error('まだ届いていない部分があります');
    return d.d || '';
  });
  var joined = pieces.join('');
  var text = m.z ? await gunzipText(joined) : joined;
  if(hash53(text) !== m.h) throw new Error('中身がこわれています');
  return JSON.parse(text);
}
async function pullParts(){
  if(!syncState.on || !fsa) return;
  if(syncState.pulling){ syncState.pullAgain = true; return; }
  syncState.pulling = true; updateSyncTag();
  try{
    var rp = (syncState.remote || {}).parts || {};
    var want = Object.keys(SYNC_PARTS).filter(function(p){ return rp[p] && rp[p].h !== SYNC_LOCAL.applied[p]; });
    if(!want.length) return;
    /* この端末がはじめて受け取るときは、設定のかたまりを相手に合わせる（まっさらな端末の設定で上書きしない） */
    var first = !SYNC_LOCAL.firstPullAt && want.indexOf('core') >= 0;
    var d = { meta:{}, __v3:1, __first: first ? 1 : 0 }, got = [];
    await Promise.all(want.map(async function(p){
      var m = rp[p];
      try{
        var obj = await fetchPart(p, m);
        Object.keys(obj).forEach(function(k){
          if(k === 'meta') Object.assign(d.meta, obj.meta || {});
          else d[k] = obj[k];
        });
        got.push([p, m.h]);
      }catch(e){
        /* 3回つづけて読めない版は、あきらめて先に進む（こちらの内容で上書きされる） */
        var fk = p + ':' + m.h;
        syncState.fails[fk] = (syncState.fails[fk] || 0) + 1;
        if(syncState.fails[fk] >= 3){
          logErr('同期', '「'+p+'」を3回読めなかったので、この端末の内容で送り直します（'+e.message+'）');
          got.push([p, m.h]);
        }else if(syncState.fails[fk] === 1){
          logErr('同期', '「'+p+'」を受け取れませんでした：'+e.message);
        }
      }
    }));
    if(got.length){
      if(Object.keys(d).length > 2) mergeRemote(d);
      got.forEach(function(g){ SYNC_LOCAL.applied[g[0]] = g[1]; if(g[0] === 'core' && !SYNC_LOCAL.firstPullAt) SYNC_LOCAL.firstPullAt = Date.now(); });
      saveSyncLocal();
      syncState.pulledAt = Date.now();
      pushRemote();
    }
  }catch(e){
    logErr('同期', '受け取りでエラー：' + (e && e.message || e));
  }finally{
    syncState.pulling = false;
    updateSyncTag();
    if(syncState.pullAgain){ syncState.pullAgain = false; setTimeout(pullParts, 200); }
  }
}

/* ===== 送る ===== */
/* 何か直したら呼ぶ（少し待ってからまとめて送る） */
function pushRemote(now){
  syncState.dirty = true;
  if(!syncState.on || !fsa){ updateSyncTag(); return; }
  clearTimeout(syncState.timer);
  if(now) pushChanged();
  else syncState.timer = setTimeout(pushChanged, 800);
  updateSyncTag();
}
async function pushPart(name, text, h){
  var z = CAN_GZIP ? 1 : 0;
  var body = z ? await gzipText(text) : text;
  var size = z ? CHUNK : 280000;        /* 圧縮しないときは、日本語が3バイトになるので小さめに切る */
  var pieces = [];
  for(var i = 0; i < body.length; i += size) pieces.push(body.slice(i, i + size));
  if(!pieces.length) pieces.push('');
  for(var j = 0; j < pieces.length; j++){
    await fsSet(docChunk(name, h, j), { d:pieces[j], i:j, n:pieces.length, h:h, z:z, at:Date.now() }, false);
  }
  return { h:h, n:pieces.length, z:z, s:body.length, raw:utf8Len(text), t:Date.now(), by:DEV.id };
}
function devInfo(){
  return { name: DEV.name || '端末', build: APP_BUILD, at: Date.now(),
           ua: String(navigator.userAgent || '').slice(0, 120) };
}
var partCache = {};
async function pushChanged(){
  if(!syncState.on || !fsa) return;
  if(Date.now() < syncState.pauseUntil) return;
  if(isOffline()){ updateSyncTag(); return; }        /* つながったら online のときに送る */
  if(syncState.sending){ syncState.again = true; return; }
  if(!syncState.remote) return;                           /* まだ目次を受け取っていない */
  var rp = syncState.remote.parts || {};
  /* 相手の新しい版を取りこむ前に、上書きしない */
  var pending = Object.keys(SYNC_PARTS).some(function(p){ return rp[p] && rp[p].h !== SYNC_LOCAL.applied[p]; });
  if(pending){ pullParts(); return; }
  syncState.sending = true; updateSyncTag();
  var changed = {}, old = [];
  try{
    var names = Object.keys(SYNC_PARTS);
    for(var i = 0; i < names.length; i++){
      var p = names[i];
      /* 中身が前と同じなら、指紋の計算をはぶく */
      var built = buildPart(p), js = JSON.stringify(built), pc = partCache[p], text, h;
      if(pc && pc.js === js){ text = pc.text; h = pc.h; }
      else { text = canon(built); h = hash53(text); partCache[p] = { js:js, text:text, h:h }; }
      if(rp[p] && rp[p].h === h){ SYNC_LOCAL.applied[p] = h; continue; }
      changed[p] = await pushPart(p, text, h);
      if(rp[p] && rp[p].h) old.push([p, rp[p]]);
    }
    var me = (syncState.remote.devices || {})[DEV.id];
    var needBeat = !me || me.build !== APP_BUILD || me.name !== DEV.name || (Date.now() - (Number(me.at)||0)) > 30*60*1000;
    if(Object.keys(changed).length || needBeat){
      var body = { v:3, updatedAt:Date.now(), build:APP_BUILD, devices:{} };
      body.devices[DEV.id] = devInfo();
      if(Object.keys(changed).length){ body.parts = changed; body.by = DEV.id; }
      await fsSet(docMain(), body, true);
      /* こちらの手元の目次も、すぐに新しくしておく */
      syncState.remote.parts = Object.assign({}, rp, changed);
      syncState.remote.devices = Object.assign({}, syncState.remote.devices || {}, body.devices);
      syncState.devices = syncState.remote.devices;
      Object.keys(changed).forEach(function(k){ SYNC_LOCAL.applied[k] = changed[k].h; });
      saveSyncLocal();
      if(Object.keys(changed).length) syncState.pushedAt = Date.now();
      /* 前の版のかけらを片付ける（失敗してもかまわない） */
      old.forEach(function(o){
        if(changed[o[0]] && changed[o[0]].h === o[1].h) return;
        for(var j = 0; j < (o[1].n||1); j++) fsDel(docChunk(o[0], o[1].h, j))['catch'](function(){});
      });
    }
    syncState.size = Object.keys(syncState.remote.parts || {}).reduce(function(a, k){ return a + (Number(syncState.remote.parts[k].s)||0); }, 0);
    syncState.dirty = false; syncState.err = '';
    if(/送れませんでした/.test(syncState.msg||'')) syncState.msg = '';
  }catch(e){
    syncState.err = String(e && e.message || e);
    syncState.msg = '送れませんでした：' + syncState.err.slice(0, 80);
    logErr('同期', syncState.msg);
  }finally{
    syncState.sending = false;
    updateSyncTag();
    if(appId === 'set'){ if(isTyping()) renderLater(); else render(); }
    if(syncState.again){ syncState.again = false; setTimeout(pushChanged, 400); }
  }
}

/* ===== 合わせ方（どの端末でも同じ答えになるようにする） ===== */
/* 表（名前→中身）を合わせる。両方の端末で足したものを、どちらも残す */
function mergeMap(local, remote, lt, rt){
  var out = {};
  local  = (local  && typeof local  === 'object' && !Array.isArray(local))  ? local  : {};
  remote = (remote && typeof remote === 'object' && !Array.isArray(remote)) ? remote : {};
  lt = Number(lt)||0; rt = Number(rt)||0;
  Object.keys(local).forEach(function(k){ out[k] = local[k]; });
  Object.keys(remote).forEach(function(k){
    var l = local[k], r = remote[k];
    if(l === undefined){ out[k] = r; return; }
    var lm = (l && typeof l === 'object' && !Array.isArray(l)) ? (Number(l.mt)||0) : 0;
    var rm = (r && typeof r === 'object' && !Array.isArray(r)) ? (Number(r.mt)||0) : 0;
    if(lm || rm){ out[k] = (rm > lm) ? r : (rm < lm) ? l : pickCanon(l, r); return; }   /* 中身に時刻があれば、新しい方 */
    out[k] = (rt > lt) ? r : (rt < lt) ? l : pickCanon(l, r);
  });
  return out;
}
/* 記録の配列を合わせる（同じものは1つに、古いものから捨てる） */
function logKey(x){
  try{ return (x && typeof x === 'object' && x.id != null) ? 'i' + x.id : canon(x); }catch(e){ return String(x); }
}
function mergeLog(local, remote, max){
  var seen = {}, out = [];
  (Array.isArray(local)?local:[]).concat(Array.isArray(remote)?remote:[]).forEach(function(x){
    if(x == null) return;
    var k = logKey(x);
    if(seen[k]) return;
    seen[k] = 1; out.push({ k:k, x:x });
  });
  out.sort(function(a,b){
    var ta = Number(a.x.mt || a.x.at) || 0, tb = Number(b.x.mt || b.x.at) || 0;
    if(ta !== tb) return ta - tb;
    return a.k < b.k ? -1 : a.k > b.k ? 1 : 0;
  });
  return out.slice(-(max || 200)).map(function(o){ return o.x; });
}
/* 会話を合わせる（同じ発言は1つに、時間の順にならべる） */
function mergeMsgs(local, remote, max){
  var seen = {}, out = [];
  var pickMsg = function(a, b){
    var ea = Number(a.et)||0, eb = Number(b.et)||0;     /* あとから印（よい・予定に入れた等）をつけた方 */
    return eb > ea ? b : eb < ea ? a : pickCanon(a, b);
  };
  (Array.isArray(local)?local:[]).concat(Array.isArray(remote)?remote:[]).forEach(function(m){
    if(!m) return;
    var k = (Number(m.mt)||0)+'|'+(m.role||'')+'|'+String(m.text||'').slice(0,60)+'|'+(Number(m.upto)||0);
    if(seen[k]){
      var i = seen[k] - 1;
      out[i].m = pickMsg(out[i].m, m);
      return;
    }
    out.push({ k:k, m:m });
    seen[k] = out.length;
  });
  /* 「ここまでまとめた（消した）」印があれば、それより前の発言は入れない */
  var upto = 0;
  out.forEach(function(o){ if(o.m.role === 'sum') upto = Math.max(upto, Number(o.m.upto)||0); });
  if(upto){
    out = out.filter(function(o){
      return o.m.role === 'sum' ? (Number(o.m.upto)||0) === upto : (Number(o.m.mt)||0) > upto;
    });
  }
  out.sort(function(a,b){
    var sa = a.m.role === 'sum' ? 0 : 1, sb = b.m.role === 'sum' ? 0 : 1;   /* まとめはいちばん上 */
    if(sa !== sb) return sa - sb;
    var d = (Number(a.m.mt)||0) - (Number(b.m.mt)||0);
    if(d) return d;
    return a.k < b.k ? -1 : a.k > b.k ? 1 : 0;
  });
  max = max || 400;
  if(out.length > max){
    var sums = out.filter(function(o){ return o.m.role === 'sum'; });
    var rest = out.filter(function(o){ return o.m.role !== 'sum'; });
    out = sums.concat(rest.slice(-(max - sums.length)));
  }
  return out.map(function(o){ return o.m; });
}
function mergeList(local, remote, dead, name){
  var m = {}, order = [];
  (local||[]).forEach(function(x){ if(x && x.id && !m[x.id]){ m[x.id] = x; order.push(x.id); } });
  (remote||[]).forEach(function(x){
    if(!x || !x.id) return;
    var cur = m[x.id];
    if(!cur){ m[x.id] = x; order.push(x.id); return; }
    var lt = Number(cur.mt)||0, rt = Number(x.mt)||0;
    /* メモは中身が違って、どちらも新しいときは両方残す */
    if(name === 'notes' && lt !== rt){
      var lb = (cur.body||'')+'|'+(cur.title||''), rb = (x.body||'')+'|'+(x.title||'');
      if(lb !== rb && Math.abs(lt - rt) < 1000*60*60*24 && !cur.conflict && !x.conflict){
        var keepNew = rt > lt ? x : cur, keepOld = rt > lt ? cur : x;
        m[x.id] = keepNew;
        var copy = JSON.parse(JSON.stringify(keepOld));
        copy.id = keepOld.id + '_dup' + (rt > lt ? lt : rt);
        copy.title = (copy.title||'（無題）') + '（別の端末の分）';
        copy.conflict = 1;
        if(!m[copy.id] && !dead[copy.id]){ m[copy.id] = copy; order.push(copy.id); }
        return;
      }
    }
    if(rt > lt) m[x.id] = x;
    else if(rt === lt && canon(x) > canon(cur)) m[x.id] = x;
  });
  return order.map(function(k){ return m[k]; }).filter(function(x){ return !dead[x.id]; });
}
function mergeRemote(d){
  if(!d || typeof d !== 'object') return;
  var before = canon(payloadCore());
  var dead = deadSet(d);
  var rm = d.meta || {};

  /* 支払いプラン・明細：同じidなら新しい方 */
  var newer = function(a, b){
    var ta = Number(a.mt)||0, tb = Number(b.mt)||0;
    return tb > ta ? b : tb < ta ? a : pickCanon(a, b);
  };
  if(Array.isArray(d.plans)){
    var pm = {}, po = [];
    (S.plans||[]).forEach(function(p){ if(p && p.id){ pm[p.id] = p; po.push(p.id); } });
    d.plans.forEach(function(p){ if(!p || !p.id) return; if(pm[p.id]) pm[p.id] = newer(pm[p.id], p); else { pm[p.id] = p; po.push(p.id); } });
    S.plans = po.map(function(k){ return pm[k]; });
  }
  S.plans = (S.plans||[]).filter(function(p){ return !dead[p.id]; });
  if(Array.isArray(d.statements)){
    var sm = {};
    (S.statements||[]).forEach(function(s){ if(s && s.id) sm[s.id] = s; });
    d.statements.forEach(function(s){
      if(!s || !s.id) return;
      if(!sm[s.id]){ sm[s.id] = Object.assign({}, s, { hasImage:false }); return; }
      var win = newer(statementsOne(sm[s.id]), s);
      if(win === s) sm[s.id] = Object.assign({}, sm[s.id], s, { hasImage:sm[s.id].hasImage });
    });
    S.statements = Object.keys(sm).map(function(k){ return sm[k]; });
  }
  S.statements = (S.statements||[]).filter(function(s){ return !dead[s.id]; })
    .sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0) || String(a.id).localeCompare(String(b.id)); });

  LISTS.forEach(function(k){ S[k] = mergeList(S[k], d[k], dead, k); });

  var rp = (d.paid && typeof d.paid === 'object') ? d.paid : {};
  var planIdOf = function(k){ var i = k.indexOf(':'); return i < 0 ? k : k.slice(0, i); };
  Object.keys(rp).forEach(function(k){
    if(dead[planIdOf(k)]) return;
    var r = normPaid(rp[k]), l = normPaid(S.paid[k]);
    if(!r) return;
    if(!l || r.t > l.t || (r.t === l.t && r.v > l.v)) S.paid[k] = r;
  });
  Object.keys(S.paid).forEach(function(k){ if(dead[planIdOf(k)]) delete S.paid[k]; });

  if(d.risyu && typeof d.risyu === 'object'){
    var ru = Number(d.risyu.updatedAt)||0, lu = Number(S.risyu.updatedAt)||0;
    var mine = { selected:S.risyu.selected, earned:S.risyu.earned, otherCr:S.risyu.otherCr, updatedAt:lu };
    var theirs = { selected:d.risyu.selected, earned:d.risyu.earned, otherCr:d.risyu.otherCr, updatedAt:ru };
    if(d.__first || ru > lu || (ru === lu && canon(theirs) > canon(mine))){
      S.risyu.selected = Array.isArray(d.risyu.selected) ? d.risyu.selected.slice() : [];
      S.risyu.earned = Object.assign({ kyoyo:0, topic:0, lang:0, langEn:0, info:0, health:0, pe:0 }, d.risyu.earned||{});
      S.risyu.otherCr = Number(d.risyu.otherCr)||0;
      S.risyu.updatedAt = ru;
    }
  }

  var uiChanged = false, taken = {};
  var first = !!d.__first;
  /* 設定のかたまり：新しい方で丸ごと入れ替える */
  WHOLE_KEYS.forEach(function(k){
    if(d[k] === undefined || d[k] === null) return;
    var rt = Number(rm[k])||0, lt = Number(S.meta[k])||0;
    if(first){
      if(canon(d[k]) === canon(S[k])){ S.meta[k] = rt; return; }
    }else{
      if(rt < lt) return;
      if(rt === lt && canon(d[k]) <= canon(S[k])) return;
    }
    S[k] = d[k]; S.meta[k] = rt; taken[k] = 1;
    if(k === 'ui') uiChanged = true;
  });
  /* 表：両方の端末で足したぶんをどちらも残す */
  MAP_KEYS.forEach(function(k){
    if(d[k] === undefined || d[k] === null) return;
    var lt = Number(S.meta[k])||0, rt = Number(rm[k])||0;
    S[k] = mergeMap(S[k], d[k], lt, rt);
    S.meta[k] = Math.max(lt, rt);
  });
  /* 消した会話は、もどってこないようにする */
  Object.keys(S.chatMeta||{}).forEach(function(k){ if(dead['room:'+k]) delete S.chatMeta[k]; });
  /* 記録の配列 */
  LOG_KEYS.forEach(function(k){
    if(d[k] === undefined || d[k] === null) return;
    var lt2 = Number(S.meta[k])||0, rt2 = Number(rm[k])||0;
    S[k] = mergeLog(S[k], d[k], k==='trash' ? 200 : k==='transitLog' ? 120 : 60);
    S.meta[k] = Math.max(lt2, rt2);
  });
  /* 30日より古いゴミ箱は持ち越さない（日の区切りで決めるので、端末でずれない） */
  S.trash = (S.trash||[]).filter(function(x){ return toNum(x.at) > trashLimit(); });

  if(uiChanged){ S.ui = Object.assign(JSON.parse(JSON.stringify(UI_DEFAULT)), S.ui||{}); applyUi(); }
  if(!S.commute || typeof S.commute !== 'object') S.commute = JSON.parse(JSON.stringify(COMMUTE_DEFAULT));
  if(!Array.isArray(S.commute.periods) || S.commute.periods.length!==6) S.commute.periods = COMMUTE_DEFAULT.periods.slice();
  if(!Array.isArray(S.commute.ends) || S.commute.ends.length!==6) S.commute.ends = COMMUTE_DEFAULT.ends.slice();
  if(!S.terms || typeof S.terms !== 'object') S.terms = { first:{} };
  /* 受け取ったあと形を整えて中身が変わったら、整えた方を新しい版にする（2台で直し合いを続けないように） */
  Object.keys(taken).forEach(function(k){
    if(canon(S[k]) !== canon(d[k])) S.meta[k] = Math.max(Date.now(), (Number(S.meta[k])||0) + 1);
  });

  /* 設定（時給・口座の引き落とし日など）*/
  if(d.settings && typeof d.settings === 'object'){
    var rs = Number(rm.settings)||0, ls = Number(S.meta.settings)||0;
    if(first || rs > ls || (rs === ls && canon(d.settings) > canon(syncSettingsOf()))){
      SET_KEYS.forEach(function(k){ if(d.settings[k] !== undefined) S.settings[k] = d.settings[k]; });
      S.meta.settings = rs;
    }
  }else if(!d.__v3){
    /* 古い版の端末から来たときは、前からの書き方で受け取る */
    if(d.days){
      S.settings.smbcDay = d.days.smbc || S.settings.smbcDay;
      S.settings.rakutenDay = d.days.rakuten || S.settings.rakutenDay;
    }
    if(typeof d.regDeadline === 'string') S.settings.regDeadline = d.regDeadline;
    if(d.minWeekday != null) S.settings.minWeekday = Number(d.minWeekday)||0;
    if(d.minWeekend != null) S.settings.minWeekend = Number(d.minWeekend)||0;
    if(d.fare != null) S.settings.fare = toNum(d.fare);
    if(typeof d.shop === 'string') S.settings.shop = d.shop;
    if(typeof d.payBankId === 'string') S.settings.payBankId = d.payBankId;
    if(typeof d.wage === 'number') S.settings.wage = d.wage;
  }
  /* 同期の設定は、いつもアプリに組み込んだものを使う */
  S.settings.room = DEFAULT_ROOM; S.settings.fbConfig = DEFAULT_FB;

  if(typeof d.termId === 'string'){
    var rtl = Number(rm.termsList)||0, ltl = Number(S.meta.termsList)||0;
    if(first || rtl > ltl || (rtl === ltl && d.termId > String(S.termId||''))) S.termId = d.termId;
  }
  if(toNum(d.backupAt) > toNum(S.backupAt)) S.backupAt = toNum(d.backupAt);

  /* そうだんの会話（ぜんぶ・部屋ごと） */
  if(Array.isArray(d.chat)) S.chat = mergeMsgs(S.chat, d.chat);
  if(d.chatRooms && typeof d.chatRooms === 'object'){
    S.chatRooms = S.chatRooms || {};
    Object.keys(d.chatRooms).forEach(function(k){
      if(dead['room:'+k]){ delete S.chatRooms[k]; return; }
      S.chatRooms[k] = mergeMsgs(S.chatRooms[k], d.chatRooms[k]);
    });
  }
  Object.keys(S.chatRooms||{}).forEach(function(k){ if(dead['room:'+k]) delete S.chatRooms[k]; });

  syncSigRefresh();          /* 受け取っただけの変化を「自分が直した」と数えない */
  itemSigRefresh();
  persist();
  /* 何か変わっていれば画面を描き直す */
  if(before !== canon(payloadCore())){
    if(isTyping()) renderLater(); else render();
  }
  pushRemote();
}
function statementsOne(s){
  return { id:s.id, accountId:s.accountId, billingMonth:s.billingMonth, amount:s.amount, memo:s.memo||'', createdAt:s.createdAt||0, mt:s.mt||0 };
}
/* 画面を描き直すかどうか判断するための、中身のまとめ */
function payloadCore(){
  var o = {};
  Object.keys(SYNC_PARTS).forEach(function(p){
    SYNC_PARTS[p].keys.forEach(function(k){
      o[k] = (k === 'settings') ? syncSettingsOf() : (k === 'statements') ? statementsForSync() : S[k];
    });
  });
  return o;
}
function trashLimit(){
  var d = new Date(); d.setHours(0,0,0,0);
  return d.getTime() - 30*24*3600*1000;
}
/* 今すぐ送って、今すぐ受け取り直す */
async function syncNow(){
  if(!syncState.on){ syncState.retry=0; syncState.connecting=false; fbLoad=null; initSync(); return; }
  syncState.pauseUntil = 0;
  try{
    var m = await fsGet(docMain());
    onMainDoc(m);
    await pullParts();
    await pushChanged();
    toast(syncState.err ? '送れませんでした：' + syncState.err.slice(0, 40) : '同期しました', !!syncState.err);
  }catch(e){
    logErr('同期', '今すぐ同期：' + e.message);
    toast('同期できませんでした：' + e.message.slice(0, 40), true);
  }
}
/* ===== 消した・戻した の記録（時刻つき）=====
   消したあとに「元に戻す」をしても、ほかの端末で消え直さないように。 */
function markDeleted(id){
  if(!id) return;
  S.delAt = S.delAt || {};
  S.delAt[id] = Date.now();
  if((S.deleted||[]).indexOf(id) < 0) S.deleted = (S.deleted||[]).concat([id]);
}
function markRevived(id){
  if(!id) return;
  S.revAt = S.revAt || {};
  S.revAt[id] = Date.now();
  S.deleted = (S.deleted||[]).filter(function(x){ return x !== id; });
}
/* 両方の端末の記録を合わせて、いま消えているidを決める */
function deadSet(d){
  var pick = function(a, b){
    var o = {};
    [a||{}, b||{}].forEach(function(m){
      Object.keys(m).forEach(function(k){ var v = Number(m[k])||0; if(v > (o[k]||0)) o[k] = v; });
    });
    return o;
  };
  var delAt = pick(S.delAt, d.delAt), revAt = pick(S.revAt, d.revAt);
  /* 時刻のない昔の記録は「ずっと前に消した」とみなす */
  (S.deleted||[]).concat(Array.isArray(d.deleted) ? d.deleted : []).forEach(function(id){ if(id && !delAt[id]) delAt[id] = 1; });
  /* 増えすぎないように、新しい3000件だけ残す */
  var keys = Object.keys(delAt);
  if(keys.length > 3000){
    keys.sort(function(a,b){ return (delAt[a] - delAt[b]) || (a < b ? -1 : 1); }).slice(0, keys.length - 3000)
      .forEach(function(k){ delete delAt[k]; delete revAt[k]; });
  }
  Object.keys(revAt).forEach(function(k){ if(!delAt[k]) delete revAt[k]; });
  var dead = {};
  Object.keys(delAt).forEach(function(id){ if(delAt[id] > (revAt[id]||0)) dead[id] = 1; });
  S.delAt = delAt; S.revAt = revAt;
  S.deleted = Object.keys(dead).sort();
  return dead;
}
function removeItem(list, id){
  markDeleted(id);
  S[list] = (S[list]||[]).filter(function(x){ return x.id !== id; });
}

/* ============================== 写真の同期 ==============================
   写真は大きいので、1枚ずつ小さく切って送る。
   この端末にない写真は、見るときに取りに行く。                          */
var photoCloud = { index:null, busy:false, queue:[], failed:{} };
function onPhotoIdx(data){
  photoCloud.index = (data && data.items) || {};
  /* ほかの端末で消した写真は、こちらでも消す */
  Object.keys(photoCloud.index).forEach(function(pid){
    var m = photoCloud.index[pid];
    if(m && m.del) photoDel(pid, { noCloud:true });
  });
  photoUploadScan();
  if(typeof photoFill === 'function') photoFill();      /* 待っていた写真をもう一度さがす */
  if(appId === 'set' && !isTyping()) render();
}
function photoSyncOn(){ return SYNC_LOCAL.photoSync !== 0; }
/* まだ送っていない写真をさがして、順番に送る */
async function photoUploadScan(){
  if(!syncState.on || !fsa || !photoCloud.index || !photoSyncOn()) return;
  var keys = await photoKeys();
  keys.forEach(function(k){
    var m = photoCloud.index[k];
    if((!m || (!m.del && !m.n)) && photoCloud.queue.indexOf(k) < 0 && !photoCloud.failed[k]) photoCloud.queue.push(k);
  });
  photoUploadRun();
}
function photoCloudQueue(pid){
  if(!pid || !photoSyncOn()) return;
  if(photoCloud.queue.indexOf(pid) < 0) photoCloud.queue.push(pid);
  photoUploadRun();
}
async function photoUploadRun(){
  if(photoCloud.busy || !syncState.on || !fsa || !photoCloud.index) return;
  photoCloud.busy = true; updateSyncTag();
  try{
    while(photoCloud.queue.length && syncState.on){
      var pid = photoCloud.queue.shift();
      var m = photoCloud.index[pid];
      if(m && (m.n || m.del)) continue;
      try{
        var data = await photoGetLocal(pid);
        if(!data) continue;
        var n = Math.max(1, Math.ceil(data.length / CHUNK));
        for(var i = 0; i < n; i++){
          await fsSet(docPhoto(pid, i), { d:data.slice(i*CHUNK, (i+1)*CHUNK), i:i, n:n, at:Date.now() }, false, 'photo');
        }
        var item = { n:n, s:data.length, t:Date.now(), by:DEV.id };
        var upd = { items:{} }; upd.items[pid] = item;
        await fsSet(docPhotoIdx(), upd, true, 'photo');
        photoCloud.index[pid] = item;
      }catch(e){
        if(/送りすぎ/.test(e.message) || isOffline()){
          photoCloud.queue.unshift(pid);          /* あとでもう一度 */
          break;
        }
        photoCloud.failed[pid] = 1;
        logErr('写真の同期', pid + ' を送れませんでした：' + e.message);
      }
    }
  }finally{
    photoCloud.busy = false; updateSyncTag();
  }
}
/* この端末にない写真を取りに行く */
var photoFetching = {};
function photoFetchCloud(pid){
  if(photoFetching[pid]) return photoFetching[pid];
  var m = photoCloud.index && photoCloud.index[pid];
  if(!syncState.on || !fsa || !m || m.del || !m.n) return Promise.resolve(null);
  photoFetching[pid] = (async function(){
    try{
      var ids = []; for(var i = 0; i < m.n; i++) ids.push(docPhoto(pid, i));
      var docs = await Promise.all(ids.map(fsGet));
      if(docs.some(function(d){ return !d; })) return null;
      var data = docs.map(function(d){ return d.d || ''; }).join('');
      if(!/^data:/.test(data)) return null;
      await photoPut(pid, data, { noCloud:true });
      return data;
    }catch(e){
      logErr('写真の同期', pid + ' を受け取れませんでした：' + e.message);
      return null;
    }finally{
      delete photoFetching[pid];
    }
  })();
  return photoFetching[pid];
}
async function photoCloudDelete(pid){
  if(!syncState.on || !fsa) return;
  var m = photoCloud.index && photoCloud.index[pid];
  try{
    var upd = { items:{} }; upd.items[pid] = { del:1, t:Date.now(), by:DEV.id };
    await fsSet(docPhotoIdx(), upd, true, 'photo');
    if(photoCloud.index) photoCloud.index[pid] = upd.items[pid];
    if(m && m.n) for(var i = 0; i < m.n; i++) fsDel(docPhoto(pid, i), 'photo')['catch'](function(){});
  }catch(e){ logErr('写真の同期', pid + ' を消せませんでした：' + e.message); }
}
function photoCloudStats(){
  var idx = photoCloud.index || {}, n = 0, s = 0;
  Object.keys(idx).forEach(function(k){ var m = idx[k]; if(m && m.n && !m.del){ n++; s += Number(m.s)||0; } });
  return { count:n, bytes:s, queued:photoCloud.queue.length, busy:photoCloud.busy, ready:!!photoCloud.index };
}

/* ============================== 上の「同期」表示 ============================== */
function syncPhase(){
  if(TEST_MODE && !syncState.on) return ['test', 'テストモード', '本物のデータには触れません'];
  if(typeof navigator !== 'undefined' && navigator.onLine === false) return ['off', 'オフライン', 'ネットにつながると、自動で送ります'];
  if(Date.now() < syncState.pauseUntil) return ['ng', '同期を休止中', '書きこみが多すぎたので少し休んでいます'];
  if(!syncState.on) return syncState.connecting ? ['wait', 'つないでいます…', ''] : ['ng', 'つながっていません', syncState.msg || ''];
  if(syncState.err) return ['ng', '送れていません', syncState.err];
  if(syncState.sending || syncState.pulling || photoCloud.busy) return ['busy', '同期中…', ''];
  if(syncState.dirty || !syncState.remote) return ['busy', '同期中…', ''];
  return ['ok', '同期済み', syncState.pushedAt ? '最後に送った：' + new Date(syncState.pushedAt).toLocaleTimeString('ja-JP') : ''];
}
function updateSyncTag(){
  var el = document.getElementById('synctag');
  if(!el) return;
  var p = syncPhase();
  el.className = 'st st-' + p[0];
  el.setAttribute('data-act', 'go-sync');
  el.setAttribute('role', 'button');
  el.title = p[2] || p[1];
  el.textContent = p[1];
}

/* ネットが戻ったら、また同期をつなぐ */
if(typeof window !== 'undefined'){
  window.addEventListener('online', function(){
    syncState.retry = 0; syncState.connecting = false;
    if(!syncState.on) initSync(); else { syncState.err = ''; pushRemote(true); photoUploadRun(); }
    updateSyncTag();
  });
  window.addEventListener('offline', updateSyncTag);
  document.addEventListener('visibilitychange', function(){
    if(document.hidden) return;
    if(!syncState.on){ syncState.retry = 0; syncState.connecting = false; initSync(); }
    else pushRemote(true);          /* 変わったところがあるときだけ送る */
  });
  setInterval(function(){
    if(syncState.on){ pushRemote(true); photoUploadRun(); }
    else if(!syncState.connecting){ syncState.retry = 0; initSync(); }
  }, 60000);                        /* 1分ごとに確かめる（変わっていなければ何も送らない） */
}

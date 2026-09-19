/**
 * くらしの手帳 ⇔ Google の橋わたし（Apps Script）
 *
 * これは「あなたのGoogleアカウント」で動く小さなプログラムです。
 *  ・予定を Googleカレンダーに入れる／データを Googleドライブに保存する
 *  ・スマホに通知を送る（Firebase Cloud Messaging）・Discordに通知を送る
 *  ・iPhoneのショートカットから届いた記録（学校に着いた・Apple Payで払った）を預かる
 *  ・ウィジェット・目覚ましのための「今日のまとめ」を返す
 *  ・Google ToDoリストと課題を同期する
 *  ・ほかの端末を6けたのコードでつなぐ
 *  ・カードの利用メール → 家計簿、運行情報メール → 通知（Gmailは読むだけ）
 *  ・Goodnotesのノート・講義資料・ショートカットで送った写真を、AI（Gemini）で読んで、暗記カード・メモ・課題の候補にする
 *  ・家計簿・バイト・成績をスプレッドシートに書き出す
 * 下の TOKEN（合言葉）を知っている人だけが使えます。
 */
var TOKEN = 'ここに合言葉';
var FIREBASE_PROJECT = 'kurashi-59562';
var CAL_NAME = 'くらしの手帳';
var TASKLIST_NAME = 'くらしの手帳';
var FOLDER_NAME = 'くらしの手帳バックアップ';
var PHOTO_FOLDER_NAME = '写真';
var KEEP_BACKUPS = 12;          // バックアップは新しい12個だけ残す
var BATCH = 40;                 // 1回に直す予定の数（時間切れを防ぐ）
var TZ = 'Asia/Tokyo';
var VER = 3;
var INBOX_FOLDER_NAME = '受け取り';            // ショートカットで送った写真（バックアップのフォルダの中）
var LECTURE_FOLDER_NAME = 'くらしの手帳 講義資料'; // ここに入れたPDF・写真から暗記カードを作る
var SHEET_NAME = 'くらしの手帳 記録';
var WX_POINTS = [{ name:'三田', lat:34.8883, lon:135.2264 }, { name:'西宮', lat:34.7188, lon:135.3606 }];
var AI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
var AI_MAX_BYTES = 15 * 1024 * 1024;           // AIに送るファイルの大きさの上限

function doPost(e){
  var req;
  try{ req = JSON.parse(e.postData.contents); }
  catch(err){ return out_({ ok:false, error:'読めないお願いです' }); }
  if(!req) return out_({ ok:false, error:'読めないお願いです' });
  /* ほかの端末：6けたのコードで合言葉を受け取る（合言葉なしで呼べるのはこれだけ） */
  if(req.action === 'pairClaim') return out_(pairClaim_(req.code));
  /* ショートカットから（短い合言葉 k）：写真や課題を預ける */
  if(req.k && !req.token){
    var key = props_().getProperty('SHORT_KEY');
    if(!key || req.k !== key) return out_({ ok:false, error:'合言葉がちがいます' });
    if(req.action !== 'in') return out_({ ok:false, error:'知らないお願いです' });
    var lk = LockService.getScriptLock();
    try{ lk.waitLock(20000); return out_(inboxAdd_(req)); }
    finally{ try{ lk.releaseLock(); }catch(e3){} }
  }
  if(req.token !== TOKEN) return out_({ ok:false, error:'合言葉がちがいます' });
  var lock = LockService.getScriptLock();
  try{
    lock.waitLock(25000);
    switch(req.action){
      case 'ping':          return out_(ping_());
      case 'calSync':       return out_(calSync_(req.items || [], !!req.full));
      case 'calClear':      return out_(calClear_());
      case 'backup':        return out_(backup_(req.name, req.json));
      case 'backupList':    return out_(backupList_());
      case 'backupGet':     return out_(backupGet_(req.id));
      case 'photoNames':    return out_(photoNames_());
      case 'photoPut':      return out_(photoPut_(req.pid, req.data));
      case 'setup':         return out_(setup_());
      case 'shortKey':      return out_(shortKeySet_(req.key));
      case 'discordSet':    return out_(discordSet_(req.url));
      case 'pushRegister':  return out_(pushRegister_(req.device, req.pushToken, req.name));
      case 'pushRemove':    return out_(pushRemove_(req.device));
      case 'notifyTest':    return out_(notifyTest_(req.channel));
      case 'jobsPut':       return out_(jobsPut_(req.jobs || []));
      case 'summaryPut':    return out_(summaryPut_(req.summary || {}));
      case 'inboxTake':     return out_(inboxTake_());
      case 'tasksSync':     return out_(tasksSync_(req.items || []));
      case 'pairOffer':     return out_(pairOffer_(req.code));
      case 'featSet':       return out_(featSet_(req.feat || {}));
      case 'aiKeySet':      return out_(aiKeySet_(req.key, req.model));
      case 'sheetSync':     return out_(sheetSync_(req.sheets || {}));
      case 'scanNow':       return out_(scanNow_(req.what));
      default:              return out_({ ok:false, error:'知らないお願いです：' + req.action });
    }
  }catch(err){
    return out_({ ok:false, error:String(err && err.message || err) });
  }finally{
    try{ lock.releaseLock(); }catch(e2){}
  }
}
/* ショートカット・ウィジェットから（短い合言葉 k で使える。読むことと記録を預けることだけ） */
function doGet(e){
  var p = (e && e.parameter) || {};
  if(!p.k) return out_({ ok:true, msg:'くらしの手帳の橋わたしは動いています' });
  var key = PropertiesService.getScriptProperties().getProperty('SHORT_KEY');
  if(!key || p.k !== key) return out_({ ok:false, error:'合言葉がちがいます' });
  if(p.a === 'widget') return out_(widget_());
  if(p.a === 'alarm') return out_(alarm_());
  if(p.a === 'in'){
    var lock = LockService.getScriptLock();
    try{ lock.waitLock(20000); return out_(inboxAdd_(p)); }
    finally{ try{ lock.releaseLock(); }catch(e2){} }
  }
  return out_({ ok:false, error:'知らないお願いです' });
}
function out_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function props_(){ return PropertiesService.getScriptProperties(); }
function ping_(){
  var cal = calendar_();
  var p = props_();
  var err = null; try{ err = JSON.parse(p.getProperty('EXTRA_ERR') || 'null'); }catch(e){}
  return { ok:true, user: Session.getEffectiveUser().getEmail(), calendar: cal.getName(), tz: TZ,
           ver: VER, trigger: hasTrigger_(), shortKey: !!p.getProperty('SHORT_KEY'),
           discord: !!p.getProperty('DISCORD_URL'), devices: pushDevices_().length,
           ai: !!p.getProperty('GEMINI_KEY'), sheet: p.getProperty('SHEET_ID') ? 1 : 0, feat: feat_(), err: err };
}

/* ===================== ほかの端末をつなぐ（6けたのコード・10分・5回まで） ===================== */
function pairOffer_(code){
  code = String(code || '');
  if(!/^\d{6}$/.test(code)) return { ok:false, error:'コードの形がちがいます' };
  props_().setProperty('PAIR', JSON.stringify({ code:code, exp:Date.now() + 10 * 60000, tries:0 }));
  return { ok:true, minutes:10 };
}
function pairClaim_(code){
  var lock = LockService.getScriptLock();
  try{
    lock.waitLock(20000);
    var p = props_(), raw = p.getProperty('PAIR');
    if(!raw) return { ok:false, error:'コードがありません。つないである端末で、もう一度コードを出してください' };
    var o = JSON.parse(raw);
    if(Date.now() > o.exp){ p.deleteProperty('PAIR'); return { ok:false, error:'コードの期限（10分）が切れました。もう一度出してください' }; }
    if(String(code || '') !== o.code){
      o.tries = (o.tries || 0) + 1;
      if(o.tries >= 5) p.deleteProperty('PAIR'); else p.setProperty('PAIR', JSON.stringify(o));
      return { ok:false, error:'コードがちがいます' + (o.tries >= 5 ? '（5回まちがえたので、コードを出し直してください）' : '') };
    }
    p.deleteProperty('PAIR');
    return { ok:true, token:TOKEN };
  }finally{ try{ lock.releaseLock(); }catch(e){} }
}

/* ===================== 使う機能の設定（アプリから届く） ===================== */
function feat_(){
  try{ return JSON.parse(props_().getProperty('FEAT') || '{}') || {}; }catch(e){ return {}; }
}
function featSet_(f){
  var clean = function(a, n, len){ return (Array.isArray(a) ? a : []).map(function(x){ return clip_(x, len).trim(); }).filter(Boolean).slice(0, n); };
  var o = { mailCard:f.mailCard ? 1 : 0, mailUnkou:f.mailUnkou ? 1 : 0, discord:f.discord ? 1 : 0, push:f.push === 0 ? 0 : 1,
            lec:f.lec ? 1 : 0, gnFolder:clip_(f.gnFolder, 60).trim(), gnOnly:clean(f.gnOnly, 10, 30),
            courses:clean(f.courses, 60, 60), quiet:f.quiet === 0 ? 0 : 1 };
  props_().setProperty('FEAT', JSON.stringify(o));
  if(!hasTrigger_()) setup_();
  return { ok:true, feat:o };
}
function aiKeySet_(key, model){
  key = String(key || '').trim();
  if(!key){ props_().deleteProperty('GEMINI_KEY'); return { ok:true, ai:false }; }
  if(!/^[A-Za-z0-9_\-]{20,80}$/.test(key)) return { ok:false, error:'AIのカギの形がちがいます' };
  props_().setProperty('GEMINI_KEY', key);
  if(model && /^[a-z0-9.\-]{3,40}$/.test(model)) props_().setProperty('GEMINI_MODEL', model);
  return { ok:true, ai:true };
}
function extraErr_(where, e){
  props_().setProperty('EXTRA_ERR', JSON.stringify({ where:where, msg:clip_(e && e.message || e, 200), at:Date.now() }));
}

/* ===================== 準備（5分ごとに通知を確かめる） ===================== */
function hasTrigger_(){
  return ScriptApp.getProjectTriggers().some(function(t){ return t.getHandlerFunction() === 'tick'; });
}
function setup_(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction() === 'tick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(5).create();
  return { ok:true, trigger:true };
}
function shortKeySet_(key){
  key = String(key || '');
  if(!/^[A-Za-z0-9]{16,64}$/.test(key)) return { ok:false, error:'短い合言葉の形がちがいます' };
  props_().setProperty('SHORT_KEY', key);
  return { ok:true };
}

/* ===================== カレンダー ===================== */
function calendar_(){
  var list = CalendarApp.getCalendarsByName(CAL_NAME);
  if(list.length) return list[0];
  var cal = CalendarApp.createCalendar(CAL_NAME, { timeZone: TZ, color: CalendarApp.Color.PINK });
  return cal;
}
var COLORS_ = {
  task:  CalendarApp.EventColor.PALE_RED,
  quiz:  CalendarApp.EventColor.YELLOW,
  exam:  CalendarApp.EventColor.RED,
  kousa: CalendarApp.EventColor.BLUE,
  work:  CalendarApp.EventColor.CYAN,
  imp:   CalendarApp.EventColor.MAUVE,
  other: CalendarApp.EventColor.PALE_GREEN,
  pay:   CalendarApp.EventColor.GREEN,
  health:CalendarApp.EventColor.GRAY
};
function parse_(ymd, hhmm){
  return Utilities.parseDate(ymd + ' ' + (hhmm || '12:00'), TZ, 'yyyy-MM-dd HH:mm');
}
function addDays_(ymd, n){
  var d = parse_(ymd, '12:00');
  d = new Date(d.getTime() + n * 86400000);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}
/**
 * items: [{ k:キー, h:指紋, title, date:'YYYY-MM-DD', time:'HH:MM'|'' , mins:長さ(分), end:'YYYY-MM-DD'|'' , note, kind }]
 * 通知は「前日の0時」ひとつだけ。
 */
function calSync_(items, full){
  var cal = calendar_();
  var props = props_();
  var all = props.getProperties();
  var map = {};
  Object.keys(all).forEach(function(p){
    if(p.indexOf('k:') !== 0) return;
    var v = String(all[p]).split('|');
    map[p.slice(2)] = { id:v[0], h:v[1] };
  });
  var want = {};
  items.forEach(function(it){ if(it && it.k) want[it.k] = it; });

  var todo = [];
  Object.keys(want).forEach(function(k){
    var cur = map[k];
    if(!cur || cur.h !== want[k].h || full) todo.push(['put', k]);
  });
  Object.keys(map).forEach(function(k){ if(!want[k]) todo.push(['del', k]); });

  var done = 0, errors = [], setP = {}, delP = [];
  for(var i = 0; i < todo.length && done < BATCH; i++){
    var op = todo[i][0], k = todo[i][1];
    try{
      var cur2 = map[k];
      if(cur2 && cur2.id){
        try{ var old = cal.getEventById(cur2.id); if(old) old.deleteEvent(); }catch(e1){}
      }
      if(op === 'del'){ delP.push('k:' + k); done++; continue; }
      var it = want[k];
      var ev, remind;
      if(it.time){
        var st = parse_(it.date, it.time);
        var en = new Date(st.getTime() + Math.max(15, Number(it.mins) || 60) * 60000);
        ev = cal.createEvent(it.title, st, en, { description: it.note || '' });
        var hm = it.time.split(':');
        remind = 1440 + Number(hm[0]) * 60 + Number(hm[1]);      // 前日の0時
      }else{
        var last = (it.end && it.end > it.date) ? it.end : it.date;
        if(last > it.date) ev = cal.createAllDayEvent(it.title, parse_(it.date), parse_(addDays_(last, 1)), { description: it.note || '' });
        else ev = cal.createAllDayEvent(it.title, parse_(it.date), { description: it.note || '' });
        remind = 1440;                                            // 前日の0時
      }
      ev.removeAllReminders();
      if(remind <= 40320) ev.addPopupReminder(remind);
      if(COLORS_[it.kind]) ev.setColor(COLORS_[it.kind]);
      setP['k:' + k] = ev.getId() + '|' + it.h;
      done++;
    }catch(err){
      errors.push(k + '：' + (err && err.message || err));
      done++;
    }
  }
  if(Object.keys(setP).length) props.setProperties(setP, false);
  delP.forEach(function(p){ props.deleteProperty(p); });
  return { ok:true, done:done, remaining:Math.max(0, todo.length - done), total:Object.keys(want).length, errors:errors.slice(0, 5) };
}
function calClear_(){
  var props = props_();
  var all = props.getProperties(), cal = calendar_(), n = 0;
  Object.keys(all).forEach(function(p){
    if(p.indexOf('k:') !== 0) return;
    if(n >= 150) return;
    try{ var ev = cal.getEventById(String(all[p]).split('|')[0]); if(ev) ev.deleteEvent(); }catch(e){}
    props.deleteProperty(p); n++;
  });
  var left = Object.keys(props.getProperties()).filter(function(p){ return p.indexOf('k:') === 0; }).length;
  return { ok:true, removed:n, remaining:left };
}

/* ===================== ドライブ ===================== */
function folder_(){
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}
function photoFolder_(){
  var root = folder_();
  var it = root.getFoldersByName(PHOTO_FOLDER_NAME);
  return it.hasNext() ? it.next() : root.createFolder(PHOTO_FOLDER_NAME);
}
function backup_(name, json){
  if(!name || typeof json !== 'string') return { ok:false, error:'中身がありません' };
  var f = folder_();
  var file = f.createFile(String(name).replace(/[\\\/:*?"<>|]/g, '_'), json, 'application/json');
  var files = [], it = f.getFiles();
  while(it.hasNext()){
    var x = it.next();
    if(/^kurashi-.*\.json$/.test(x.getName())) files.push(x);
  }
  files.sort(function(a, b){ return b.getDateCreated() - a.getDateCreated(); });
  files.slice(KEEP_BACKUPS).forEach(function(x){ x.setTrashed(true); });   // 古いものはゴミ箱へ（30日は戻せる）
  return { ok:true, id:file.getId(), name:file.getName(), size:file.getSize(), url:f.getUrl() };
}
function backupList_(){
  var f = folder_(), out = [], it = f.getFiles();
  while(it.hasNext()){
    var x = it.next();
    if(!/^kurashi-.*\.json$/.test(x.getName())) continue;
    out.push({ id:x.getId(), name:x.getName(), size:x.getSize(), at:x.getDateCreated().getTime() });
  }
  out.sort(function(a, b){ return b.at - a.at; });
  return { ok:true, items:out, url:f.getUrl() };
}
function backupGet_(id){
  var file = DriveApp.getFileById(id);
  if(file.getParents().next().getId() !== folder_().getId()) return { ok:false, error:'バックアップのファイルではありません' };
  return { ok:true, json:file.getBlob().getDataAsString('UTF-8') };
}
function photoNames_(){
  var f = photoFolder_(), out = [], it = f.getFiles();
  while(it.hasNext()) out.push(it.next().getName().replace(/\.jpg$/, ''));
  return { ok:true, names:out };
}
function photoPut_(pid, data){
  pid = String(pid || '').replace(/[^A-Za-z0-9_-]/g, '');
  if(!pid || !/^data:image\//.test(String(data || ''))) return { ok:false, error:'写真ではありません' };
  var f = photoFolder_();
  if(f.getFilesByName(pid + '.jpg').hasNext()) return { ok:true, skipped:true };
  var m = String(data).match(/^data:([^;]+);base64,(.*)$/);
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], pid + '.jpg');
  f.createFile(blob);
  return { ok:true };
}
/* ===================== 大きな値を、いくつかに分けてしまう ===================== */
function bigSet_(name, obj){
  var p = props_(), s = JSON.stringify(obj), size = 8000, n = Math.ceil(s.length / size) || 1, set = {};
  for(var i = 0; i < n; i++) set[name + '#' + i] = s.slice(i * size, (i + 1) * size);
  set[name + '#n'] = String(n);
  var old = Number(p.getProperty(name + '#n')) || 0;
  p.setProperties(set, false);
  for(var j = n; j < old; j++) p.deleteProperty(name + '#' + j);
}
function bigGet_(name, dflt){
  var p = props_(), n = Number(p.getProperty(name + '#n')) || 0, s = '';
  if(!n) return dflt;
  for(var i = 0; i < n; i++) s += p.getProperty(name + '#' + i) || '';
  try{ return JSON.parse(s); }catch(e){ return dflt; }
}
function clip_(v, n){ return String(v == null ? '' : v).slice(0, n); }

/* ===================== 通知（スマホ・Discord） ===================== */
function pushDevices_(){
  var all = props_().getProperties(), out = [];
  Object.keys(all).forEach(function(k){
    if(k.indexOf('push:') !== 0) return;
    try{ var v = JSON.parse(all[k]); v.device = k.slice(5); out.push(v); }catch(e){}
  });
  return out;
}
function pushRegister_(device, pushToken, name){
  device = clip_(device, 40).replace(/[^A-Za-z0-9_-]/g, '');
  if(!device || !pushToken) return { ok:false, error:'端末の情報がありません' };
  props_().setProperty('push:' + device, JSON.stringify({ token:clip_(pushToken, 400), name:clip_(name, 30), at:Date.now() }));
  return { ok:true, devices:pushDevices_().length };
}
function pushRemove_(device){
  props_().deleteProperty('push:' + clip_(device, 40).replace(/[^A-Za-z0-9_-]/g, ''));
  return { ok:true };
}
function discordSet_(url){
  url = String(url || '').trim();
  if(!url){ props_().deleteProperty('DISCORD_URL'); return { ok:true, discord:false }; }
  if(!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url)) return { ok:false, error:'DiscordのWebhookのURLではありません' };
  props_().setProperty('DISCORD_URL', url);
  return { ok:true, discord:true };
}
/* 通知を送るための鍵（ふつうはこのプログラムの持ち主の権限。サービスアカウントを入れたらそちら） */
function fcmAuth_(){
  var sa = props_().getProperty('SA_JSON');
  if(!sa) return ScriptApp.getOAuthToken();
  var cache = CacheService.getScriptCache(), hit = cache.get('sa_token');
  if(hit) return hit;
  var j = JSON.parse(sa), now = Math.floor(Date.now() / 1000);
  var b64 = function(o){ return Utilities.base64EncodeWebSafe(typeof o === 'string' ? o : JSON.stringify(o)).replace(/=+$/, ''); };
  var input = b64({ alg:'RS256', typ:'JWT' }) + '.' + b64({ iss:j.client_email, scope:'https://www.googleapis.com/auth/firebase.messaging',
    aud:'https://oauth2.googleapis.com/token', iat:now, exp:now + 3600 });
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(input, j.private_key)).replace(/=+$/, '');
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method:'post', muteHttpExceptions:true,
    payload:{ grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion:input + '.' + sig } });
  var tok = JSON.parse(res.getContentText()).access_token;
  if(!tok) throw new Error('サービスアカウントで鍵をもらえませんでした');
  cache.put('sa_token', tok, 3000);
  return tok;
}
function fcmSend_(dev, data){
  var url = 'https://fcm.googleapis.com/v1/projects/' + FIREBASE_PROJECT + '/messages:send';
  var d = {};
  Object.keys(data).forEach(function(k){ d[k] = String(data[k] == null ? '' : data[k]); });
  var body = { message:{ token:dev.token, data:d, webpush:{ headers:{ Urgency:'high', TTL:'7200' } } } };
  var res = UrlFetchApp.fetch(url, { method:'post', contentType:'application/json', payload:JSON.stringify(body), muteHttpExceptions:true,
    headers:{ Authorization:'Bearer ' + fcmAuth_(), 'x-goog-user-project':FIREBASE_PROJECT } });
  var code = res.getResponseCode(), text = res.getContentText();
  if(code === 404 || /UNREGISTERED|registration-token-not-registered/.test(text)) pushRemove_(dev.device);
  return { code:code, text:text.slice(0, 200) };
}
function discordSend_(title, body){
  var url = props_().getProperty('DISCORD_URL');
  if(!url) return null;
  var res = UrlFetchApp.fetch(url, { method:'post', contentType:'application/json', muteHttpExceptions:true,
    payload:JSON.stringify({ username:'くらしの手帳', content:('**' + clip_(title, 150) + '**\n' + clip_(body, 1500)).slice(0, 1900) }) });
  return { code:res.getResponseCode() };
}
function deliver_(job){
  var res = { push:[], discord:null };
  /* 朝の持ち物：送る直前に、その日の天気を入れ直す（何も言うことがなくなったら送らない） */
  if(job.wx){ job = wxRefresh_(job); if(!job) return res; }
  if(job.push !== 0){
    pushDevices_().forEach(function(dev){
      try{ res.push.push(fcmSend_(dev, { title:job.title, body:job.body || '', tag:job.id || '', url:job.url || '' })); }
      catch(e){ res.push.push({ code:0, text:String(e.message || e) }); }
    });
  }
  if(job.discord){ try{ res.discord = discordSend_(job.title, job.body); }catch(e){ res.discord = { code:0, text:String(e.message || e) }; } }
  return res;
}
function notifyTest_(channel){
  var job = { id:'test-' + Date.now(), title:'くらしの手帳のテスト通知', body:'通知が届きました。', push: channel === 'discord' ? 0 : 1, discord: channel === 'push' ? 0 : 1 };
  return { ok:true, result:deliver_(job) };
}
/* jobs: [{ id, at（ミリ秒）, title, body, url, push:0|1, discord:0|1 }] … これから先の通知をまるごと置きかえる */
function jobsPut_(jobs){
  var now = Date.now(), list = [];
  jobs.forEach(function(j){
    var at = Number(j.at) || 0;
    if(!j.id || at < now - 10 * 60000 || at > now + 8 * 86400000) return;
    list.push({ id:clip_(j.id, 60), at:at, title:clip_(j.title, 80), body:clip_(j.body, 200), url:clip_(j.url, 80),
                push:j.push ? 1 : 0, discord:j.discord ? 1 : 0, wx:j.wx ? 1 : 0 });
  });
  list.sort(function(a, b){ return a.at - b.at; });
  bigSet_('jobs', list.slice(0, 300));
  if(!hasTrigger_()) setup_();
  return { ok:true, n:list.length };
}
/* 5分ごとに呼ばれる */
function tick(){
  var lock = LockService.getScriptLock();
  if(!lock.tryLock(20000)) return;
  try{
    var now = Date.now(), jobs = bigGet_('jobs', []), sent = bigGet_('sent', {}), changed = false;
    jobs.forEach(function(j){
      if(sent[j.id] || j.at > now + 60000) return;
      sent[j.id] = now; changed = true;
      if(j.at < now - 40 * 60000) return;          // 40分以上おくれたものは送らない（止まっていたとき）
      deliver_(j);
    });
    Object.keys(sent).forEach(function(k){ if(sent[k] < now - 3 * 86400000){ delete sent[k]; changed = true; } });
    if(changed) bigSet_('sent', sent);
  }finally{
    lock.releaseLock();
  }
  /* メール・AIの読み取りは、アプリからのお願いを待たせないよう、鍵を返してから */
  extras_();
}
function extras_(){
  var p = props_(), now = Date.now(), f = feat_();
  var running = Number(p.getProperty('EXTRA_RUN')) || 0;
  if(running && now - running < 6 * 60000) return;            // 前の回がまだ動いている
  p.setProperty('EXTRA_RUN', String(now));
  try{
    if((f.mailCard || f.mailUnkou) && now - (Number(p.getProperty('MAIL_AT')) || 0) >= 10 * 60000){
      p.setProperty('MAIL_AT', String(now));
      try{ mailScan_(f, false); }catch(e){ extraErr_('Gmail', e); }
    }
    if(p.getProperty('GEMINI_KEY') && now - (Number(p.getProperty('AI_AT')) || 0) >= 10 * 60000){
      p.setProperty('AI_AT', String(now));
      try{ aiScan_(f, 2); }catch(e){ extraErr_('AIの読み取り', e); }
    }
  }finally{
    p.deleteProperty('EXTRA_RUN');
  }
}
/* 手動で「今すぐ調べる」 */
function scanNow_(what){
  var f = feat_();
  if(what === 'mail') return { ok:true, found:mailScan_(f, false) };
  if(what === 'ai') return aiScan_(f, 1);
  return { ok:false, error:'知らないお願いです' };
}

/* ===================== 朝の天気（Open-Meteo） ===================== */
function wxToday_(){
  var cache = CacheService.getScriptCache(), hit = cache.get('wx');
  if(hit) return JSON.parse(hit);
  var out = { pop:0, tmax:null, tmin:null };
  WX_POINTS.forEach(function(pt){
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + pt.lat + '&longitude=' + pt.lon +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=1';
    var j = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions:true }).getContentText() || '{}');
    var d = j.daily || {};
    out.pop = Math.max(out.pop, Number((d.precipitation_probability_max || [0])[0]) || 0);
    var mx = Number((d.temperature_2m_max || [])[0]), mn = Number((d.temperature_2m_min || [])[0]);
    if(isFinite(mx)) out.tmax = out.tmax == null ? mx : Math.max(out.tmax, mx);
    if(isFinite(mn)) out.tmin = out.tmin == null ? mn : Math.min(out.tmin, mn);
  });
  cache.put('wx', JSON.stringify(out), 1800);
  return out;
}
function wxLines_(w){
  var out = [];
  if(w.pop >= 50) out.push('☔ 傘（降水' + w.pop + '%）');
  else if(w.pop >= 30) out.push('🌂 折りたたみ傘（降水' + w.pop + '%）');
  if(w.tmax != null && w.tmin != null && (w.tmax - w.tmin >= 10 || w.tmin <= 8)) out.push('🧥 上着（' + Math.round(w.tmin) + '〜' + Math.round(w.tmax) + '℃）');
  return out;
}
function wxRefresh_(job){
  try{
    var body = String(job.body || '').split('\n').filter(function(l){ return l && !/^(☔|🌂|🧥)/.test(l); });
    var add = wxLines_(wxToday_());
    var at = (body.length && /^🎒/.test(body[0])) ? 1 : 0;
    body.splice.apply(body, [at, 0].concat(add));
    if(!body.length) return null;
    var o = {};
    Object.keys(job).forEach(function(k){ o[k] = job[k]; });
    o.body = body.join('\n');
    return o;
  }catch(e){ return job; }
}

/* ===================== Gmail（読むだけ）：カードの利用メール → 家計簿、運行情報メール → 通知 ===================== */
function mailHeader_(msg, name){
  var h = ((msg.payload || {}).headers || []).filter(function(x){ return String(x.name).toLowerCase() === name; })[0];
  return h ? String(h.value || '') : '';
}
function mailDecode_(part){
  var cs = 'UTF-8';
  (part.headers || []).forEach(function(h){
    if(/^content-type$/i.test(h.name)){ var m = /charset="?([^";\s]+)"?/i.exec(h.value); if(m) cs = m[1]; }
  });
  var bytes = Utilities.base64DecodeWebSafe(part.body.data);
  try{ return Utilities.newBlob(bytes).getDataAsString(cs); }catch(e){ return Utilities.newBlob(bytes).getDataAsString('UTF-8'); }
}
function mailText_(part){
  if(!part) return '';
  if(part.mimeType === 'text/plain' && part.body && part.body.data) return mailDecode_(part);
  var parts = part.parts || [];
  for(var i = 0; i < parts.length; i++){ var t = mailText_(parts[i]); if(t) return t; }
  if(part.mimeType === 'text/html' && part.body && part.body.data){
    return mailDecode_(part).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li)>/gi, '\n').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }
  return '';
}
function pad2_(n){ n = String(n); return n.length < 2 ? '0' + n : n; }
/* 1通を読みとる（カードの利用・運行情報のどちらでもなければ null） */
function mailParse_(from, subject, body, f){
  var t = String(body || '').replace(/\r/g, '').replace(/[：]/g, ':');
  var who = String(from || '') + ' ' + String(subject || '');
  if(f.mailCard){
    var am = /(?:ご?利用金額|お支払い?金額|金額)[^\d\n]{0,12}([\d,，]+)\s*円/.exec(t);
    var isCard = /vpass|smbc|rakuten-card|三井住友カード|楽天カード|カード/i.test(who);
    if(am && isCard){
      var amount = Number(am[1].replace(/[,，]/g, ''));
      if(amount){
        var shop = (/(?:ご?利用先|ご?利用店名?|加盟店名?)[\s:]*([^\n]+)/.exec(t) || [])[1] || '';
        var dm = /(?:ご?利用日(?:時)?)[\s:]*(\d{4})[\/年\-.](\d{1,2})[\/月\-.](\d{1,2})/.exec(t);
        var date = dm ? dm[1] + '-' + pad2_(dm[2]) + '-' + pad2_(dm[3]) : Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
        var card = /rakuten|楽天/i.test(who) ? '楽天カード' : /vpass|smbc|三井住友/i.test(who) ? '三井住友カード' : 'カード';
        return { kind:'pay', amount:amount, shop:clip_(shop.replace(/\s+/g, ' ').trim(), 60), card:card, date:date };
      }
    }
  }
  if(f.mailUnkou && /運行|遅延|遅れ|見合わせ|運転再開|運休/.test(String(subject || ''))){
    var lines = t.split('\n').map(function(l){ return l.trim(); })
      .filter(function(l){ return l && !/^[-=＿_─━*＊]+$/.test(l) && !/配信|登録|解除|http/i.test(l); }).slice(0, 4);
    return { kind:'unkou', title:clip_(subject, 80), text:clip_(lines.join('\n'), 300) };
  }
  return null;
}
function mailScan_(f, dry){
  var q = [];
  if(f.mailCard) q.push('from:(vpass.ne.jp OR smbc-card.com OR rakuten-card.co.jp) OR subject:(ご利用のお知らせ OR カード利用のお知らせ)');
  if(f.mailUnkou) q.push('subject:(運行情報 OR 遅延 OR 運転見合わせ OR 運転再開 OR 運休)');
  if(!q.length) return [];
  var seen = bigGet_('mailSeen', []), seenMap = {};
  seen.forEach(function(id){ seenMap[id] = 1; });
  var list = Gmail.Users.Messages.list('me', { q:'newer_than:3d {' + q.join(' ') + '}', maxResults:30 }).messages || [];
  var found = [];
  list.forEach(function(m){
    if(seenMap[m.id]) return;
    var msg = Gmail.Users.Messages.get('me', m.id, { format:'full' });
    var it = mailParse_(mailHeader_(msg, 'from'), mailHeader_(msg, 'subject'), mailText_(msg.payload), f);
    seen.push(m.id); seenMap[m.id] = 1;
    if(it){ it.mid = m.id; found.push(it); }
  });
  if(dry) return found;
  found.forEach(function(it){
    if(it.kind === 'pay'){
      inboxPush_({ kind:'pay', amount:it.amount, shop:it.shop, card:it.card, date:it.date, ref:'gm-' + it.mid });
    }else if(it.kind === 'unkou'){
      inboxPush_({ kind:'notice', text:'🚃 ' + it.title + (it.text ? '\n' + it.text : '') });
      var h = Number(Utilities.formatDate(new Date(), TZ, 'H')) * 60 + Number(Utilities.formatDate(new Date(), TZ, 'm'));
      if(!f.quiet || (h >= 360 && h <= 1410)){
        deliver_({ id:'unkou-' + it.mid, title:'🚃 ' + it.title, body:it.text || '', push:f.push === 0 ? 0 : 1, discord:f.discord ? 1 : 0 });
      }
    }
  });
  bigSet_('mailSeen', seen.slice(-300));
  return found;
}

/* ===================== AIの読み取り（Goodnotes・講義資料・ショートカットの写真） ===================== */
function inboxFolder_(){
  var root = folder_(), it = root.getFoldersByName(INBOX_FOLDER_NAME);
  return it.hasNext() ? it.next() : root.createFolder(INBOX_FOLDER_NAME);
}
function doneFolder_(){
  var box = inboxFolder_(), it = box.getFoldersByName('読んだもの');
  return it.hasNext() ? it.next() : box.createFolder('読んだもの');
}
function lectureFolder_(){
  var it = DriveApp.getFoldersByName(LECTURE_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(LECTURE_FOLDER_NAME);
}
function aiState_(id){ try{ return JSON.parse(props_().getProperty('w:' + id) || 'null'); }catch(e){ return null; } }
/* まだ読んでいない・書き足されたファイルを集める */
function aiCandidates_(f){
  var out = [], count = 0;
  var consider = function(file, src){
    if(count++ > 400) return;
    var mt = String(file.getMimeType() || '');
    if(!/pdf|^image\//.test(mt)) return;
    var st = aiState_(file.getId()), upd = file.getLastUpdated().getTime();
    if(st && st.m >= upd) return;
    if(file.getSize() > AI_MAX_BYTES){ props_().setProperty('w:' + file.getId(), JSON.stringify({ m:upd, pages:st ? st.pages : 0, err:'big' })); return; }
    out.push({ file:file, src:src, name:file.getName(), pages:st ? (Number(st.pages) || 0) : -1, upd:upd, mime:mt });
  };
  var it = inboxFolder_().getFiles();
  while(it.hasNext()) consider(it.next(), 'shot');
  if(f.lec){ var li = lectureFolder_().getFiles(); while(li.hasNext()) consider(li.next(), 'lec'); }
  if(f.gnFolder && (f.gnOnly || []).length){
    var fo = DriveApp.getFoldersByName(f.gnFolder);
    if(fo.hasNext()){
      var walk = function(folder, depth){
        var fi = folder.getFiles();
        while(fi.hasNext()){
          var file = fi.next(), nm = file.getName();
          if(f.gnOnly.some(function(w){ return nm.indexOf(w) >= 0; })) consider(file, 'gn');
        }
        if(depth >= 3) return;
        var sub = folder.getFolders();
        while(sub.hasNext()) walk(sub.next(), depth + 1);
      };
      walk(fo.next(), 0);
    }
  }
  out.sort(function(a, b){ return a.upd - b.upd; });
  return out;
}
function aiPrompt_(c, f, today){
  var what = c.src === 'gn' ? 'Goodnotesの手書きノート' : c.src === 'lec' ? '講義資料' : 'ノートや資料の写真';
  var range = /pdf/.test(c.mime)
    ? (c.pages > 0 ? (c.pages + 1) + 'ページ目から最後までだけを読んでください（それより前は読んだことがあります）。'
                   : c.pages === 0 ? 'ぜんぶのページを読んでください。' : 'はじめて読むノートなので、最後の3ページだけを読んでください。')
    : '';
  return 'あなたは看護学生の勉強を手伝う先生です。渡した' + what + '（ファイル名：' + c.name + '）を読んで、JSONだけで答えてください。\n' + range + '\n' +
    '・course：次の科目名から、いちばん近いもの。なければ空文字：' + ((f.courses || []).join('／') || 'なし') + '\n' +
    '・pages：PDFなら全部のページ数。写真なら1。\n' +
    '・summary：読んだところの大事なことを、3〜6行の箇条書きで（講義メモにします）。\n' +
    '・tasks：「課題」「提出」「締切」「持ってくる」など、やることが書いてあれば [{"title":"","due":"YYYY-MM-DD か 空"}]。なければ []。\n' +
    '・cards：テストや国家試験に出そうなことを一問一答で、多くても15枚 [{"q":"","a":""}]。資料にないことは作らない。\n' +
    '・患者さんの名前・病室・生年月日など、個人が分かることは書かない。そういうページは読みとばす。\n' +
    '・今日は' + today + '。日付に年がなければ、今日に近い方の年にする。\n' +
    '{"course":"","pages":0,"summary":"","tasks":[],"cards":[]}';
}
function aiCall_(key, parts){
  var model = props_().getProperty('GEMINI_MODEL');
  var models = (model ? [model] : []).concat(AI_MODELS);
  var body = JSON.stringify({ contents:[{ role:'user', parts:parts }], generationConfig:{ temperature:0.2, maxOutputTokens:8192, responseMimeType:'application/json' } });
  var last = '';
  for(var i = 0; i < models.length; i++){
    var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + models[i] + ':generateContent', {
      method:'post', contentType:'application/json', payload:body, muteHttpExceptions:true, headers:{ 'x-goog-api-key':key } });
    var j = null; try{ j = JSON.parse(res.getContentText()); }catch(e){}
    if(res.getResponseCode() === 200 && j){
      var c = (j.candidates || [])[0] || {};
      return ((c.content || {}).parts || []).map(function(p){ return p.text || ''; }).join('');
    }
    last = (j && j.error && j.error.message) || ('エラー ' + res.getResponseCode());
    if(!/not found|not available|unsupported|deprecated/i.test(last)) break;
  }
  throw new Error(last);
}
function aiJson_(text){
  var t = String(text || '').replace(/```json|```/g, '').trim();
  try{ return JSON.parse(t); }catch(e){}
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  if(a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('AIの答えを読みとれませんでした');
}
function aiScan_(f, max){
  var key = props_().getProperty('GEMINI_KEY');
  if(!key) return { ok:false, error:'AIのカギがまだ預けられていません' };
  var cands = aiCandidates_(f), done = 0, today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), made = [];
  for(var i = 0; i < cands.length && done < (max || 1); i++){
    var c = cands[i];
    var blob = c.file.getBlob();
    var r = aiJson_(aiCall_(key, [{ inline_data:{ mime_type:c.mime, data:Utilities.base64Encode(blob.getBytes()) } }, { text:aiPrompt_(c, f, today) }]));
    var pages = Math.max(Number(r.pages) || 0, c.pages > 0 ? c.pages : 0);
    props_().setProperty('w:' + c.file.getId(), JSON.stringify({ m:c.upd, pages:pages }));
    var cards = (Array.isArray(r.cards) ? r.cards : []).filter(function(x){ return x && x.q && x.a; }).slice(0, 15)
      .map(function(x){ return { q:clip_(x.q, 200), a:clip_(x.a, 300) }; });
    var tasks = (Array.isArray(r.tasks) ? r.tasks : []).filter(function(x){ return x && x.title; }).slice(0, 5)
      .map(function(x){ return { title:clip_(x.title, 80), due:/^\d{4}-\d{2}-\d{2}$/.test(String(x.due || '')) ? x.due : '' }; });
    var item = { kind:'ai', src:c.src, file:clip_(c.name, 80), url:c.file.getUrl(), course:clip_(r.course, 60),
                 summary:clip_(r.summary, 900), tasks:tasks, cards:cards };
    if(c.src === 'shot'){ try{ c.file.moveTo(doneFolder_()); }catch(e){} }
    if(item.summary || cards.length || tasks.length){ inboxPush_(item); made.push({ file:item.file, cards:cards.length, tasks:tasks.length }); }
    done++;
  }
  return { ok:true, done:done, left:Math.max(0, cands.length - done), made:made };
}

/* ===================== スプレッドシートに書き出す ===================== */
function sheetSync_(sheets){
  var p = props_(), id = p.getProperty('SHEET_ID'), ss = null;
  if(id){ try{ ss = SpreadsheetApp.openById(id); }catch(e){ ss = null; } }
  if(!ss){
    ss = SpreadsheetApp.create(SHEET_NAME);
    try{ DriveApp.getFileById(ss.getId()).moveTo(folder_()); }catch(e){}
    p.setProperty('SHEET_ID', ss.getId());
  }
  var n = 0;
  Object.keys(sheets).forEach(function(name){
    var rows = sheets[name];
    if(!Array.isArray(rows) || !rows.length) return;
    var w = 1;
    rows.forEach(function(r){ if(Array.isArray(r)) w = Math.max(w, r.length); });
    var data = rows.slice(0, 20000).map(function(r){
      var x = (Array.isArray(r) ? r : [r]).slice(0, w).map(function(v){ return v == null ? '' : v; });
      while(x.length < w) x.push('');
      return x;
    });
    var sh = ss.getSheetByName(clip_(name, 60)) || ss.insertSheet(clip_(name, 60));
    sh.clearContents();
    sh.getRange(1, 1, data.length, w).setValues(data);
    sh.setFrozenRows(1);
    n++;
  });
  var first = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if(first && ss.getSheets().length > 1 && first.getLastRow() === 0) ss.deleteSheet(first);
  return { ok:true, url:ss.getUrl(), sheets:n };
}

/* ===================== ショートカットから届く記録 ===================== */
function inboxAdd_(p){
  var kind = String(p.kind || '');
  if(['arrive', 'leave', 'pay', 'memo', 'task', 'img'].indexOf(kind) < 0) return { ok:false, error:'kind がちがいます' };
  /* 写真（Goodnotesのページなど）：ドライブの「受け取り」に置いて、あとでAIが読む */
  if(kind === 'img'){
    var raw = String(p.data || ''), mm = raw.match(/^data:([^;]+);base64,(.*)$/);
    var b64 = mm ? mm[2] : raw.replace(/\s+/g, ''), mime = mm ? mm[1] : 'image/jpeg';
    if(!/^image\/|pdf/.test(mime) || b64.length < 100) return { ok:false, error:'写真がありません' };
    if(b64.length > 12 * 1024 * 1024) return { ok:false, error:'写真が大きすぎます（ショートカットで小さくしてください）' };
    var nm = clip_(p.name, 60).replace(/[\\\/:*?"<>|]/g, '_') || 'ノート';
    var stamp = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmmss');
    inboxFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime, nm + '-' + stamp + (/pdf/.test(mime) ? '.pdf' : '.jpg')));
    return { ok:true, got:'img' };
  }
  var item = { kind:kind };
  if(kind === 'pay'){
    var amt = Number(String(p.amount || '').replace(/[^0-9.]/g, ''));
    if(!amt) return { ok:false, error:'金額がありません' };
    item.amount = Math.round(amt);
    item.shop = clip_(p.shop, 60);
    item.card = clip_(p.card, 40);
  }
  if(kind === 'memo') item.text = clip_(p.text, 500);
  if(kind === 'task'){
    item.text = clip_(p.text, 200);
    if(!item.text) return { ok:false, error:'課題の名前がありません' };
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(p.due || ''))) item.due = p.due;
  }
  if(p.place) item.place = clip_(p.place, 40);
  inboxPush_(item, true);
  return { ok:true, got:kind };
}
/* 受け取り箱に入れる（locked … もう鍵を持っているとき） */
function inboxPush_(item, locked){
  var lock = null;
  if(!locked){ lock = LockService.getScriptLock(); lock.waitLock(20000); }
  try{
    item.id = item.id || ('in' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36));
    item.at = item.at || Date.now();
    var box = bigGet_('inbox', []);
    box.push(item);
    box = box.slice(-80);
    while(box.length > 1 && JSON.stringify(box).length > 150000) box.shift();     // AIの結果が大きいときは古いものから
    bigSet_('inbox', box);
  }finally{ if(lock) try{ lock.releaseLock(); }catch(e){} }
}
function inboxTake_(){
  var box = bigGet_('inbox', []);
  bigSet_('inbox', []);
  return { ok:true, items:box };
}

/* ===================== ウィジェット・目覚まし ===================== */
function summaryPut_(s){
  var str = JSON.stringify(s);
  if(str.length > 60000) return { ok:false, error:'まとめが大きすぎます' };
  bigSet_('summary', s);
  return { ok:true };
}
function widget_(){
  var s = bigGet_('summary', null);
  if(!s) return { ok:false, error:'まだアプリからまとめが届いていません' };
  return { ok:true, at:s.at, title:s.title || '', lines:s.lines || [], next:s.next || null, money:s.money || '', chara:s.chara || '',
           tomorrow:s.tomorrow || null, study:s.study || null };
}
function alarm_(){
  var s = bigGet_('summary', null);
  var a = s && s.alarm;
  if(!a) return { ok:true, time:'', label:'', date:'' };
  return { ok:true, time:a.time || '', label:a.label || '', date:a.date || '', hour:a.hour, minute:a.minute };
}

/* ===================== Google ToDoリスト ===================== */
function tasklist_(){
  var p = props_(), id = p.getProperty('TASKLIST_ID');
  if(id){ try{ Tasks.Tasklists.get(id); return id; }catch(e){} }
  var lists = (Tasks.Tasklists.list({ maxResults:100 }).items || []);
  var hit = lists.filter(function(l){ return l.title === TASKLIST_NAME; })[0];
  var made = hit || Tasks.Tasklists.insert({ title:TASKLIST_NAME });
  p.setProperty('TASKLIST_ID', made.id);
  return made.id;
}
function hashOf_(title, done, due, notes){
  var s = [title || '', done ? 1 : 0, due || '', notes || ''].join('');
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)).slice(0, 16);
}
function hashG_(g){ return hashOf_(g.title, g.status === 'completed', g.due ? String(g.due).slice(0, 10) : '', g.notes); }
function hashA_(it){ return hashOf_(it.title, it.done, it.due, it.notes); }
/* items: [{ k, title, done, due:'YYYY-MM-DD'|'', notes, mt }] … アプリの課題ぜんぶ */
function tasksSync_(items){
  var tl = tasklist_(), p = props_(), all = p.getProperties();
  var map = {};
  Object.keys(all).forEach(function(key){
    if(key.indexOf('gt:') !== 0) return;
    try{ map[key.slice(3)] = JSON.parse(all[key]); }catch(e){}
  });
  var gmap = {}, token = null;
  do{
    var r = Tasks.Tasks.list(tl, { showCompleted:true, showHidden:true, showDeleted:true, maxResults:100, pageToken:token });
    (r.items || []).forEach(function(t){ gmap[t.id] = t; });
    token = r.nextPageToken;
  }while(token);
  var want = {}, skip = {}, changes = [], created = [], ops = 0, remaining = 0, setP = {}, delP = [];
  items.forEach(function(it){ if(it && it.k) want[it.k] = it; });

  /* 1) Googleで直されたもの → アプリへ */
  Object.keys(map).forEach(function(k){
    var m = map[k], g = gmap[m.gid];
    if(!g || g.deleted){
      if(want[k]) changes.push({ k:k, deleted:1 });
      delP.push('gt:' + k); skip[k] = 1;
      return;
    }
    var gh = hashG_(g);
    if(gh === m.h) return;
    var it = want[k];
    var appChanged = it && hashA_(it) !== m.h;
    if(appChanged && Number(it.mt) > Date.parse(g.updated)) return;     // アプリの方が新しい → 下で送る
    changes.push({ k:k, title:g.title || '', done:g.status === 'completed' ? 1 : 0,
                   due:g.due ? String(g.due).slice(0, 10) : '', notes:g.notes || '' });
    m.h = gh; setP['gt:' + k] = JSON.stringify(m); skip[k] = 1;
  });
  /* 2) アプリで直したもの → Googleへ */
  items.forEach(function(it){
    if(!it || !it.k || skip[it.k]) return;
    var m = map[it.k], h = hashA_(it), g = m && gmap[m.gid];
    if(m && g && !g.deleted && m.h === h) return;
    if(ops >= 40){ remaining++; return; }
    var body = { title:clip_(it.title, 250) || '（無題）', notes:clip_(it.notes, 2000), status:it.done ? 'completed' : 'needsAction' };
    if(it.due) body.due = it.due + 'T00:00:00.000Z';
    try{
      if(g && !g.deleted){
        if(!it.due) body.due = null;
        if(!it.done) body.completed = null;
        Tasks.Tasks.patch(body, tl, m.gid);
      }else{
        var t = Tasks.Tasks.insert(body, tl);
        m = { gid:t.id };
      }
      m.h = h; setP['gt:' + it.k] = JSON.stringify(m); ops++;
    }catch(e){ remaining++; }
  });
  /* 3) アプリで消したもの → Googleからも消す */
  Object.keys(map).forEach(function(k){
    if(want[k] || skip[k]) return;
    if(ops >= 40){ remaining++; return; }
    try{ Tasks.Tasks.remove(tl, map[k].gid); }catch(e){}
    delP.push('gt:' + k); ops++;
  });
  /* 4) Googleで新しく作ったもの → アプリへ */
  var known = {};
  Object.keys(map).forEach(function(k){ known[map[k].gid] = 1; });
  Object.keys(setP).forEach(function(k){ try{ known[JSON.parse(setP[k]).gid] = 1; }catch(e){} });
  Object.keys(gmap).forEach(function(gid){
    var g = gmap[gid];
    if(known[gid] || g.deleted || !g.title) return;
    if(g.status === 'completed' && Date.now() - Date.parse(g.updated) > 30 * 86400000) return;
    var k = 'g-' + gid;
    created.push({ k:k, title:g.title, done:g.status === 'completed' ? 1 : 0, due:g.due ? String(g.due).slice(0, 10) : '', notes:g.notes || '' });
    setP['gt:' + k] = JSON.stringify({ gid:gid, h:hashG_(g) });
  });
  if(Object.keys(setP).length) p.setProperties(setP, false);
  delP.forEach(function(k){ p.deleteProperty(k); });
  return { ok:true, changes:changes, created:created, remaining:remaining, done:ops };
}

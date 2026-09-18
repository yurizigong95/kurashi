/**
 * くらしの手帳 ⇔ Google の橋わたし（Apps Script）
 *
 * これは「あなたのGoogleアカウント」で動く小さなプログラムです。
 *  ・予定を Googleカレンダーに入れる／データを Googleドライブに保存する
 *  ・スマホに通知を送る（Firebase Cloud Messaging）・Discordに通知を送る
 *  ・iPhoneのショートカットから届いた記録（学校に着いた・Apple Payで払った）を預かる
 *  ・ウィジェット・目覚ましのための「今日のまとめ」を返す
 *  ・Google ToDoリストと課題を同期する
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

function doPost(e){
  var req;
  try{ req = JSON.parse(e.postData.contents); }
  catch(err){ return out_({ ok:false, error:'読めないお願いです' }); }
  if(!req || req.token !== TOKEN) return out_({ ok:false, error:'合言葉がちがいます' });
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
  return { ok:true, user: Session.getEffectiveUser().getEmail(), calendar: cal.getName(), tz: TZ,
           ver: 2, trigger: hasTrigger_(), shortKey: !!p.getProperty('SHORT_KEY'),
           discord: !!p.getProperty('DISCORD_URL'), devices: pushDevices_().length };
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
                push:j.push ? 1 : 0, discord:j.discord ? 1 : 0 });
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
}

/* ===================== ショートカットから届く記録 ===================== */
function inboxAdd_(p){
  var kind = String(p.kind || '');
  if(['arrive', 'leave', 'pay', 'memo'].indexOf(kind) < 0) return { ok:false, error:'kind がちがいます' };
  var item = { id:'in' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), kind:kind, at:Date.now() };
  if(kind === 'pay'){
    var amt = Number(String(p.amount || '').replace(/[^0-9.]/g, ''));
    if(!amt) return { ok:false, error:'金額がありません' };
    item.amount = Math.round(amt);
    item.shop = clip_(p.shop, 60);
    item.card = clip_(p.card, 40);
  }
  if(kind === 'memo') item.text = clip_(p.text, 500);
  if(p.place) item.place = clip_(p.place, 40);
  var box = bigGet_('inbox', []);
  box.push(item);
  bigSet_('inbox', box.slice(-80));
  return { ok:true, got:kind };
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
  return { ok:true, at:s.at, title:s.title || '', lines:s.lines || [], next:s.next || null, money:s.money || '', chara:s.chara || '' };
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

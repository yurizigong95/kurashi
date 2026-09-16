/**
 * くらしの手帳 ⇔ Google（カレンダー・ドライブ）の橋わたし
 *
 * これは「あなたのGoogleアカウント」で動く小さなプログラムです。
 * アプリから届いた予定を Googleカレンダーに入れ、データを Googleドライブに保存します。
 * 下の TOKEN（合言葉）を知っている人だけが使えます。アプリの設定画面で作った合言葉が入っています。
 */
var TOKEN = 'ここに合言葉';
var CAL_NAME = 'くらしの手帳';
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
      case 'ping':       return out_(ping_());
      case 'calSync':    return out_(calSync_(req.items || [], !!req.full));
      case 'calClear':   return out_(calClear_());
      case 'backup':     return out_(backup_(req.name, req.json));
      case 'backupList': return out_(backupList_());
      case 'backupGet':  return out_(backupGet_(req.id));
      case 'photoNames': return out_(photoNames_());
      case 'photoPut':   return out_(photoPut_(req.pid, req.data));
      default:           return out_({ ok:false, error:'知らないお願いです：' + req.action });
    }
  }catch(err){
    return out_({ ok:false, error:String(err && err.message || err) });
  }finally{
    try{ lock.releaseLock(); }catch(e2){}
  }
}
function doGet(){
  return out_({ ok:true, msg:'くらしの手帳の橋わたしは動いています' });
}
function out_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function ping_(){
  var cal = calendar_();
  return { ok:true, user: Session.getEffectiveUser().getEmail(), calendar: cal.getName(), tz: TZ };
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
  var props = PropertiesService.getScriptProperties();
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
  var props = PropertiesService.getScriptProperties();
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

/* くらしの手帳：共通の見た目・写真の保存 */
/* ============================== 共通の見た目 ============================== */
function section(title, note, inner){
  return '<section><div class="head"><h2>'+esc(title)+'</h2>'+(note?'<span>'+esc(note)+'</span>':'')+'</div><div class="box">'+inner+'</div></section>';
}
/* 設定用：たたんでおけるセクション（押すと開く） */
function foldSection(id, title, note, inner){
  S.ui.setOpen = S.ui.setOpen || {};
  var open = !!S.ui.setOpen[id];
  return '<section class="fold'+(open?' on':'')+'">'+
    '<div class="head foldhd" data-act="fold" data-id="'+id+'" role="button">'+
      '<h2>'+(open?'▾ ':'▸ ')+esc(title)+'</h2>'+(note?'<span>'+esc(note)+'</span>':'')+'</div>'+
    (open ? '<div class="box">'+inner+'</div>' : '')+
    '</section>';
}
function download(blob, name){
  var url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function icsStamp(ymd, hhmm){
  var a = ymd.split('-');
  return a[0]+a[1]+a[2]+'T'+hhmm.replace(':','')+'00';
}
function icsEsc(t){
  return String(t==null?'':t).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/[\r\n]+/g,' ');
}
function makeIcs(){
  var lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//kurashi//JP','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'X-WR-CALNAME:くらしの手帳',
    'BEGIN:VTIMEZONE','TZID:Asia/Tokyo','BEGIN:STANDARD','DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900','TZOFFSETTO:+0900','TZNAME:JST','END:STANDARD','END:VTIMEZONE'];

  /* 時刻つきなら時間の予定、なければ終日の予定として書き出す */
  /* 通知（アラーム）を付ける。時刻つきは何分前、終日は前日の何時に鳴らすか */
  var alarm = function(title, timed, ymd, hhmm){
    var out = [];
    /* どの予定も「前日の0時」に知らせる（絶対時刻で指定） */
    var prev = shiftDate(ymd, -1);
    if(isYmd(prev)){
      /* 日本時間の0時＝前々日の15時（世界標準時） */
      var utc = shiftDate(prev, -1).split('-');
      out.push('BEGIN:VALARM','ACTION:DISPLAY',
        'TRIGGER;VALUE=DATE-TIME:'+utc[0]+utc[1]+utc[2]+'T150000Z',
        'DESCRIPTION:'+icsEsc('明日：'+title),'END:VALARM');
    }
    if(S.ui.icsAlarm === 0) return out;
    var a = [];
    if(timed){
      var m1 = (S.ui.icsAlarm1 == null) ? 30 : toNum(S.ui.icsAlarm1);
      var m2 = toNum(S.ui.icsAlarm2);
      if(m1 > 0) a.push(['-PT'+m1+'M', m1+'分前：'+title]);
      if(m2 > 0) a.push(['-PT'+m2+'M', m2+'分前：'+title]);
    }else{
      a.push(['PT9H', '今日：'+title]);      /* 当日の朝9時 */
    }
    a.forEach(function(x){
      out.push('BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:'+x[0],'DESCRIPTION:'+icsEsc(x[1]),'END:VALARM');
    });
    return out;
  };
  var ev = function(uid, title, ymd, hhmm, minutes, endYmd, note){
    if(!isYmd(ymd)) return;
    lines.push('BEGIN:VEVENT', 'UID:'+uid+'@kurashi', 'SUMMARY:'+icsEsc(title));
    var timed = !!(hhmm && minutesOf(hhmm) != null);
    if(timed){
      var endMin = minutesOf(hhmm) + (minutes || 60);
      var endDay = ymd;
      if(endMin >= 1440){ endMin -= 1440; endDay = shiftDate(ymd, 1); }
      lines.push('DTSTART;TZID=Asia/Tokyo:'+icsStamp(ymd, hhmm),
                 'DTEND;TZID=Asia/Tokyo:'+icsStamp(endDay, hhmmOf(endMin)));
    }else{
      var last = (isYmd(endYmd) && endYmd > ymd) ? endYmd : ymd;
      var a2 = ymd.split('-'), b2 = shiftDate(last, 1).split('-');   /* 終日は翌日が終わり */
      lines.push('DTSTART;VALUE=DATE:'+a2[0]+a2[1]+a2[2], 'DTEND;VALUE=DATE:'+b2[0]+b2[1]+b2[2]);
    }
    if(note) lines.push('DESCRIPTION:'+icsEsc(note));
    Array.prototype.push.apply(lines, alarm(title, timed, ymd, hhmm));
    lines.push('END:VEVENT');
  };

  S.events.forEach(function(e){
    ev('ev-'+e.id, (e.kind==='imp'?'★ ':'')+(e.title||'予定'), e.date, e.time, 60, e.dateEnd, e.memo);
  });
  S.tasks.forEach(function(t){
    if(!t.done) ev('tk-'+t.id, '締切 '+(t.title||''), t.due, t.time, 60, '', t.subject);
  });
  S.exams.forEach(function(x){
    ev('ex-'+x.id, (x.kind==='quiz'?'小テスト ':'テスト ')+(x.subject||''), x.date, x.time, 60, '', x.room);
  });
  S.shifts.forEach(function(w){
    var mins = Math.round(shiftHours(w)*60) || 60;
    ev('wk-'+w.id, 'バイト '+(w.title||''), w.date, w.start, mins, '', w.memo);
  });
  S.health.forEach(function(h){
    ev('hl-'+h.id, (h.name||'')+' の期限', h.next, '', 0, '', h.memo);
  });
  var d = derive(), cur = thisYm();
  d.months.filter(function(m){ return m>=cur; }).forEach(function(m){
    [['smbc',S.settings.smbcDay],['rakuten',S.settings.rakutenDay]].forEach(function(pair){
      var g=d.byMonth[m][pair[0]], amt=g.plan+g.stmt; if(amt<=0) return;
      ev(pair[0]+'-'+m, ACCOUNTS[pair[0]].bank+' 引落 '+yen(amt), m+'-'+pad(pair[1]), '', 0, '', '前日までに入金');
    });
  });

  lines.push('END:VCALENDAR');
  download(new Blob([lines.join('\r\n')],{type:'text/calendar;charset=utf-8'}), 'kurashi.ics');
}
/* ============================== 写真の保存（大きい入れもの） ============================== */
/* localStorage は5MBまでなので、写真は IndexedDB に置く（数百MB〜1GBまで入る） */
var PDB = null, PDB_NAME = TEST_MODE ? 'kurashi-photos-test' + (TEST_DEV ? '-' + TEST_DEV : '') : 'kurashi-photos', PDB_STORE = 'img';
var photoCache = {};          /* 画面に出すための一時置き場 */

function photoDB(){
  if(PDB) return PDB;
  PDB = new Promise(function(res, rej){
    if(typeof indexedDB === 'undefined'){ rej(new Error('no-idb')); return; }
    var q = indexedDB.open(PDB_NAME, 1);
    q.onupgradeneeded = function(){
      var db = q.result;
      if(!db.objectStoreNames.contains(PDB_STORE)) db.createObjectStore(PDB_STORE);
    };
    q.onsuccess = function(){ res(q.result); };
    q.onerror = function(){ rej(q.error || new Error('idb')); };
  });
  return PDB;
}
var OLD_IMG = 'shiharai:memoimg:';     /* 前のしくみ（localStorage）の写真 */
/* opt.noCloud … 同期には送らない（ほかの端末から受け取ったとき） */
function photoPut(id, dataUrl, opt){
  return photoDB().then(function(db){
    return new Promise(function(res, rej){
      var tx = db.transaction(PDB_STORE, 'readwrite');
      tx.objectStore(PDB_STORE).put(dataUrl, id);
      tx.oncomplete = function(){ photoCache[id] = dataUrl; res(true); };
      tx.onerror = function(){ rej(tx.error || new Error('put')); };
    });
  }).then(function(v){
    if(!(opt && opt.noCloud) && typeof photoCloudQueue === 'function') photoCloudQueue(id);
    return v;
  });
}
/* この端末の中だけを見る */
function photoGetLocal(id){
  if(photoCache[id] != null) return Promise.resolve(photoCache[id]);
  var old = null;
  if(!TEST_MODE){ try{ old = localStorage.getItem(OLD_IMG + id); }catch(e){} }
  if(old){ photoCache[id] = old; return Promise.resolve(old); }
  return photoDB().then(function(db){
    return new Promise(function(res){
      var tx = db.transaction(PDB_STORE, 'readonly');
      var q = tx.objectStore(PDB_STORE).get(id);
      q.onsuccess = function(){ if(q.result) photoCache[id] = q.result; res(q.result || null); };
      q.onerror = function(){ res(null); };
    });
  }).catch(function(){ return null; });
}
/* この端末になければ、同期から取ってくる */
function photoGet(id){
  return photoGetLocal(id).then(function(v){
    if(v) return v;
    return (typeof photoFetchCloud === 'function') ? photoFetchCloud(id) : null;
  });
}
function photoDel(id, opt){
  delete photoCache[id];
  if(!TEST_MODE){ try{ localStorage.removeItem(OLD_IMG + id); }catch(e){} }
  if(!(opt && opt.noCloud) && typeof photoCloudDelete === 'function') photoCloudDelete(id);
  return photoDB().then(function(db){
    return new Promise(function(res){
      var tx = db.transaction(PDB_STORE, 'readwrite');
      tx.objectStore(PDB_STORE)['delete'](id);
      tx.oncomplete = function(){ res(true); };
      tx.onerror = function(){ res(false); };
    });
  }).catch(function(){ return false; });
}
function photoKeys(){
  return photoDB().then(function(db){
    return new Promise(function(res){
      var tx = db.transaction(PDB_STORE, 'readonly');
      var q = tx.objectStore(PDB_STORE).getAllKeys();
      q.onsuccess = function(){ res(q.result || []); };
      q.onerror = function(){ res([]); };
    });
  }).catch(function(){ return []; });
}
/* 前のしくみに入っている写真を、大きい入れものへ移す */
async function photoMigrate(){
  var moved = 0, keys = [];
  if(TEST_MODE) return 0;          /* テストでは本物の写真を動かさない */
  try{
    for(var i = 0; i < localStorage.length; i++){
      var k = localStorage.key(i);
      if(k && k.indexOf('shiharai:memoimg:') === 0) keys.push(k);
    }
  }catch(e){ return 0; }
  for(var j = 0; j < keys.length; j++){
    try{
      var v = localStorage.getItem(keys[j]);
      if(!v) continue;
      await photoPut(keys[j].slice('shiharai:memoimg:'.length), v);
      localStorage.removeItem(keys[j]);
      moved++;
    }catch(e){}
  }
  return moved;
}
/* 画面に貼りつけたあと、あとから写真をはめこむ */
function photoFill(){
  var els = document.querySelectorAll('img[data-pid]');
  Array.prototype.forEach.call(els, function(el){
    var id = el.dataset.pid;
    if(el.dataset.done) return;
    if(el.dataset.wait) return;
    el.dataset.wait = '1';
    photoGet(id).then(function(src){
      delete el.dataset.wait;
      if(src){ el.src = src; el.dataset.done = '1'; return; }
      /* 同期の準備がまだなら、あとでもう一度さがす */
      var later = (typeof syncState !== 'undefined') && (syncState.connecting || (syncState.on && !photoCloud.index));
      if(later){ el.classList.add('pwait'); return; }
      el.closest('.mphoto') && el.closest('.mphoto').remove();
    });
  });
}
/* 写真そのものの大きさを、1枚ずつ数えて合わせる（本当の数） */
function photoBytes(){
  return photoDB().then(function(db){
    return new Promise(function(res){
      var total = 0, n = 0, biggest = 0;
      var tx = db.transaction(PDB_STORE, 'readonly');
      var q = tx.objectStore(PDB_STORE).openCursor();
      q.onsuccess = function(){
        var cur = q.result;
        if(!cur){ res({ bytes:total, count:n, biggest:biggest }); return; }
        var v = cur.value;
        var b = 0;
        if(typeof v === 'string'){
          /* data:image/jpeg;base64,xxxx → 写真そのものの大きさに直す */
          var i = v.indexOf(',');
          b = (i >= 0 && /;base64/i.test(v.slice(0, i)))
              ? Math.round((v.length - i - 1) * 3 / 4)
              : v.length;
        }else if(v && v.size){ b = v.size; }
        total += b; n++; if(b > biggest) biggest = b;
        cur['continue']();
      };
      q.onerror = function(){ res({ bytes:total, count:n, biggest:biggest }); };
    });
  }).catch(function(){ return { bytes:0, count:0, biggest:0 }; });
}
/* どれくらい使っているか（写真の実寸＋ブラウザが言う使用量）*/
async function photoUsage(){
  var used = 0, quota = 0, ok = false;
  try{
    if(navigator.storage && navigator.storage.estimate){
      var e = await navigator.storage.estimate();
      used = Number(e.usage) || 0; quota = Number(e.quota) || 0;
      ok = true;
    }
  }catch(e){}
  var p = await photoBytes();
  return { used: used, quota: quota, estimateOk: ok, count: p.count, bytes: p.bytes, biggest: p.biggest, at: Date.now() };
}

/* くらしの手帳：iPhone・連携・雨雲レーダー（links2）
   ・Googleカレンダーの予定を読んで、今日・予定タブに出す（アプリに取りこめる）            … #53
   ・iPhoneのカレンダーで「照会」できる予定表（.ics）を橋わたしに置く                       … #173
   ・iPhoneのリマインダーへ（まとめて・1件ずつ）／Siri・Apple Watch・ロック画面の答え         … #54 #155 #156 #159
   ・ウィジェット用のまとめ（締切の色・次の予定・おせわの子）                                 … #58
   ・アイコンの数字（今日しめきり＋期限切れ など）                                           … #158
   ・勉強BGM（Spotify）・手書きノートの全文検索                                               … #169 #19
   ・Discordのボット・来週のまとめ                                                           … #183
   ・祝日の一覧を holidays-jp で新しくする                                                   … #187
   ・雨雲レーダーの出どころの切りかえ（気象庁／RainViewer。本体は js/wx-plus.js）             … #181 */
var L2 = { gcal:null, gcalBusy:false, gcalErr:'', gcalTry:0, icsBusy:false, icsErr:'', icsT:null, icsDelay:3 * 60000, soonT:null,
  badgeN:-1, gn:{ q:'', busy:false, items:null, err:'', folder:'', none:'' }, ocrBusy:false, ocrMsg:'',
  dc:{ busy:false, channels:null, invite:'', msg:'', answer:'' }, holBusy:false, holErr:'', askAns:'' };
var L2_VER = 4;          /* 橋わたしの窓口の版（GAS.api）。新しい窓口（手書きノート・Discordボット・Siri・リマインダー・ウィジェットの色）に要る橋わたしの版 */
var L2_COLORS = { red:'#E53935', orange:'#FB8C00', yellow:'#FBC02D', green:'#43A047' };
var L2_COLOR_NAME = { red:'今日まで', orange:'明日まで', yellow:'3日以内', green:'まだ先' };

/* ============================== 設定・道具 ============================== */
function l2Prefs(){
  return Object.assign({ gcal:1, gcalHide:[], badge:'due', ics:0, dcWeek:0, radarSrc:'jma', bgmMine:[], remName:'リマインダーに追加', remBtn:1, aiData:1 }, S.ui.links2 || {});
}
function l2PrefSet(patch){ S.ui.links2 = Object.assign({}, l2Prefs(), patch); touch('ui'); }
/* 端末だけに置くもの（読みこんだGoogleの予定・予定表を置いた時刻など） */
function l2Local(name, v){
  var k = KEY + ':links2:' + name;
  if(arguments.length < 2){ try{ return JSON.parse(localStorage.getItem(k) || 'null'); }catch(e){ return null; } }
  try{ if(v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){}
  return v;
}
function l2Ver(){ return gasReady() ? toNum(GAS.ver) : 0; }
function l2V4(){ return gasReady() && toNum(GAS.api) >= L2_VER; }     /* 窓口の版（ping の api）。ver は 3 のまま */
function l2V5(){ return gasReady() && toNum(GAS.api) >= 5; }   /* 5 … 手帳の中身をAIが読んで答える（aiDataPut） */
function l2NeedNew(what){
  /* 版は12時間ごとにしか確かめないので、貼り直したあとすぐ使えるように「確かめる」ボタンをつける */
  return '<div class="bn amber"><span class="ic">!</span><span>' + esc(what) + 'は、Google連携を新しい版にすると使えます（設定 › Google連携 の「プログラムをコピー」で貼り直して、「デプロイを管理」→ ✏️ →「新バージョン」）。</span></div>' +
    (gasReady() ? '<div class="pillrow"><button class="mini" data-act="l2-ping">新しい版にしたので確かめる</button></div>' : '');
}
function l2NeedGas(){
  return '<div class="bn amber"><span class="ic">!</span><span>先に「Google連携」をつないでください。</span></div>';
}
function l2Copy(label, text){ return '<button class="mini" data-act="link-copy" data-text="' + esc(text) + '">' + esc(label) + '</button>'; }
/* 検索の結果につける data-* 属性（文字としても、表としても使えるように） */
function l2Attrs(o){
  var s = Object.keys(o).map(function(k){ return ' data-' + k + '="' + esc(o[k]) + '"'; }).join('');
  try{ Object.defineProperty(o, 'toString', { value:function(){ return s; }, enumerable:false }); }catch(e){}
  return o;
}
function l2Md(ymd){ return isYmd(ymd) ? Number(ymd.slice(5, 7)) + '/' + Number(ymd.slice(8, 10)) : ''; }

/* ============================== 締切の色（ウィジェット・一覧） ============================== */
function l2DueColor(n){
  if(n == null || n === '') return '';
  n = Number(n);
  return n <= 0 ? 'red' : n === 1 ? 'orange' : n <= 3 ? 'yellow' : 'green';
}

/* ============================== ウィジェット・Siri・Discord用のまとめ（s.l2） ============================== */
function l2Summary(){
  var td = today(), end = shiftDate(td, 13), out = { v:1, day:td };
  var open = (S.tasks || []).filter(function(t){ return !t.done; });
  open.sort(function(a, b){
    var da = isYmd(a.due) ? a.due : '9999-99-99', db = isYmd(b.due) ? b.due : '9999-99-99';
    return da.localeCompare(db) || String(a.time || '99:99').localeCompare(String(b.time || '99:99'));
  });
  var cnt = { open:open.length, late:0, today:0, tomorrow:0, soon3:0 };
  out.todo = open.map(function(t){
    var n = isYmd(t.due) ? daysFromToday(t.due) : null;
    if(n != null){ if(n < 0) cnt.late++; if(n === 0) cnt.today++; if(n === 1) cnt.tomorrow++; if(n >= 0 && n <= 3) cnt.soon3++; }
    return { id:t.id, t:String(t.title || '課題').slice(0, 60), s:t.subject ? String(shortName(t.subject)).slice(0, 20) : '',
      d:isYmd(t.due) ? t.due : '', tm:t.time || '', n:n, c:l2DueColor(n) };
  }).slice(0, 40);
  out.cnt = cnt;
  /* 授業（今日から2週間。休みの授業も off をつけて入れる） */
  out.cls = {};
  for(var i = 0; i < 14; i++){
    var d = shiftDate(td, i);
    out.cls[d] = classesForDate(d).map(function(c){
      return { p:c.period, n:String(c.name).slice(0, 30), r:String(c.room || '').slice(0, 20),
        st:S.commute.periods[c.period - 1] || '', en:S.commute.ends[c.period - 1] || '', off:c.off || '' };
    });
  }
  /* 予定・テスト・バイト・Googleの予定（授業と課題はのぞく） */
  var items = [];
  (S.events || []).forEach(function(e){
    if(!isYmd(e.date)) return;
    var last = (isYmd(e.dateEnd) && e.dateEnd > e.date) ? e.dateEnd : e.date;
    if(last < td || e.date > end) return;
    items.push({ d:e.date < td ? td : e.date, tm:e.time || '', t:String(e.title || '予定').slice(0, 50), k:'event' });
  });
  (S.exams || []).forEach(function(x){
    if(!isYmd(x.date) || x.date < td || x.date > end) return;
    items.push({ d:x.date, tm:x.time || '', t:String((x.subject ? shortName(x.subject) + ' ' : '') + (x.title || kindOf(x.kind === 'quiz' || x.kind === 'kousa' ? x.kind : 'exam').name)).slice(0, 50), k:'exam' });
  });
  (S.shifts || []).forEach(function(w){
    if(!isYmd(w.date) || w.date < td || w.date > end) return;
    items.push({ d:w.date, tm:w.start || '', t:'バイト' + (w.end ? '（〜' + w.end + '）' : ''), k:'work' });
  });
  l2GcVisible().forEach(function(x){
    var d0 = l2GcDay(x);
    if(d0 < td || d0 > end || l2GcImported(x)) return;
    items.push({ d:d0, tm:l2GcTime(x), t:String(x.title).slice(0, 50), k:'gcal' });
  });
  items.sort(function(a, b){ return a.d.localeCompare(b.d) || String(a.tm || '99:99').localeCompare(String(b.tm || '99:99')); });
  out.items = items.slice(0, 60);
  /* 次のバイト・テスト */
  var nowHm = pad(new Date().getHours()) + ':' + pad(new Date().getMinutes());
  out.work = (S.shifts || []).filter(function(w){ return isYmd(w.date) && (w.date > td || (w.date === td && String(w.end || '99:99') >= nowHm)); })
    .sort(function(a, b){ return a.date.localeCompare(b.date) || String(a.start || '').localeCompare(String(b.start || '')); })
    .slice(0, 5).map(function(w){ return { d:w.date, st:w.start || '', en:w.end || '' }; });
  out.exams = (S.exams || []).filter(function(x){ return isYmd(x.date) && x.date >= td && x.date <= shiftDate(td, 30); })
    .sort(function(a, b){ return a.date.localeCompare(b.date); }).slice(0, 10).map(function(x){
      var k = (x.kind === 'quiz' || x.kind === 'kousa') ? x.kind : 'exam';
      return { d:x.date, tm:x.time || '', t:String((x.subject ? shortName(x.subject) + ' ' : '') + (x.title || kindOf(k).name)).slice(0, 50), r:String(x.room || '').slice(0, 20) };
    });
  /* お金・暗記・おせわ */
  try{
    var ym = thisYm(), kt = (typeof kbTotals === 'function') ? kbTotals(ym) : null, b = (typeof budget === 'function') ? budget() : null;
    out.money = { ym:ym, out:kt ? kt.out : 0, inn:kt ? kt.inn : 0, free:b ? b.free : null };
  }catch(e){ out.money = null; }
  try{ out.anki = (typeof ankiDueList === 'function') ? { due:ankiDueList('').length, today:ankiCountOn(td), streak:ankiStreak() } : null; }catch(e){ out.anki = null; }
  out.pet = l2PetNow();
  out.badge = l2BadgeCount();
  return out;
}
/* おせわの子のようす（数字は10きざみ。まとめが何度も変わらないように） */
function l2PetNow(){
  try{
    if(typeof petNow !== 'function' || typeof petActiveId !== 'function') return null;
    var id = petActiveId(), o = petNow(id);
    if(!o) return null;
    var r10 = function(v){ return Math.round((Number(v) || 0) / 10) * 10; };
    var st = (typeof PET_STAGES !== 'undefined' && PET_STAGES[o.stage]) ? PET_STAGES[o.stage][1] : '';
    return { name:String(o.name || (typeof charaById === 'function' ? charaById(id).name : '')).slice(0, 20), stage:st,
      hun:r10(o.hun), joy:r10(o.joy), cln:r10(o.cln), say:(typeof petMood === 'function') ? petMood(o).say : '' };
  }catch(e){ return null; }
}
kmSummary(function(s){ s.l2 = l2Summary(); });

/* ============================== Googleカレンダー → アプリ（#53） ============================== */
function l2GcalCache(){
  if(L2.gcal) return L2.gcal;
  var o = l2Local('gcal');
  L2.gcal = (o && Array.isArray(o.items)) ? o : { at:0, items:[], from:'', to:'' };
  return L2.gcal;
}
function l2GcDay(x){ return String(x.start || '').slice(0, 10); }
function l2GcTime(x){ return x.allDay ? '' : String(x.start || '').slice(11, 16); }
function l2GcCovers(x, ymd){
  var s = l2GcDay(x), e = String(x.end || x.start || '').slice(0, 10);
  if(x.allDay) return s === ymd || (s <= ymd && ymd < e);        /* 終日は、終わりの日をふくまない */
  return s <= ymd && ymd <= (e || s);
}
function l2GcVisible(){
  var hide = l2Prefs().gcalHide || [];
  return l2GcalCache().items.filter(function(x){ return hide.indexOf(x.cal) < 0; });
}
function l2GcOn(ymd){
  return l2GcVisible().filter(function(x){ return l2GcCovers(x, ymd); })
    .sort(function(a, b){ return (a.allDay ? '' : String(a.start)).localeCompare(b.allDay ? '' : String(b.start)); });
}
function l2GcImported(x){
  return (S.events || []).some(function(e){
    return e.gid === x.id || (e.date === l2GcDay(x) && String(e.title || '') === String(x.title) && String(e.time || '') === l2GcTime(x));
  });
}
function l2GcCals(){
  var seen = {}, out = [];
  l2GcalCache().items.forEach(function(x){ if(x.cal && !seen[x.cal]){ seen[x.cal] = 1; out.push(x.cal); } });
  (l2Prefs().gcalHide || []).forEach(function(c){ if(!seen[c]){ seen[c] = 1; out.push(c); } });
  return out;
}
async function l2GcalLoad(manual){
  if(L2.gcalBusy) return;
  if(!gasReady() || l2Ver() < 3){ if(manual) toast('Google連携を新しい版にすると使えます', true); return; }
  if(!manual && !l2Prefs().gcal) return;
  L2.gcalBusy = true; L2.gcalTry = Date.now();
  try{
    var from = shiftDate(today(), -1), to = shiftDate(today(), 60);
    var r = await gasCall('gcalList', { from:from, to:to });
    var items = (r.items || []).filter(function(x){ return x && x.id && /^\d{4}-\d{2}-\d{2}/.test(String(x.start || '')); }).slice(0, 300).map(function(x){
      return { id:String(x.id).slice(0, 160), title:String(x.title || '（無題）').slice(0, 120), cal:String(x.cal || '').slice(0, 60), allDay:x.allDay ? 1 : 0,
        start:String(x.start).slice(0, 16), end:String(x.end || x.start).slice(0, 16), where:String(x.where || '').slice(0, 120) };
    });
    /* くり返しの予定は、どの回も同じ id（iCalUID）で届く → 回ごとに分ける（取りこみ・「取りこみずみ」が1回ずつになるように） */
    var cnt = {};
    items.forEach(function(x){ cnt[x.id] = (cnt[x.id] || 0) + 1; });
    items.forEach(function(x){ if(cnt[x.id] > 1) x.id = x.id + '@' + x.start; });
    L2.gcal = { at:Date.now(), items:items, from:from, to:to };
    l2Local('gcal', L2.gcal);
    L2.gcalErr = '';
    if(manual) toast('Googleカレンダーから' + items.length + '件読みました');
  }catch(e){
    L2.gcalErr = e.message;
    logErr('Googleの予定', e.message);
    if(manual) toast('読めませんでした：' + e.message, true);
  }finally{
    L2.gcalBusy = false;
    if(!isTyping() && (appId === 'today' || appId === 'cal' || appId === 'set')) render();
  }
}
function l2GcRow(x, withDate){
  var tm = x.allDay ? '終日' : l2GcTime(x) + (String(x.end).slice(0, 10) === l2GcDay(x) && String(x.end).length > 10 ? '〜' + String(x.end).slice(11, 16) : '');
  return '<div class="row l2-gc"><span class="l2-gcdot" aria-hidden="true"></span><div class="grow"><div class="t">' + esc(x.title) + '</div>' +
    '<div class="s">' + (withDate ? esc(ymdLabel(l2GcDay(x))) + ' ' : '') + esc(tm) + (x.cal ? '・' + esc(x.cal) : '') + (x.where ? '・' + esc(x.where) : '') + '</div></div>' +
    (l2GcImported(x) ? '<span class="s2">取りこみずみ</span>' : '<button class="mini" data-act="l2-gc-import" data-id="' + esc(x.id) + '">アプリに入れる</button>') + '</div>';
}
/* 読みこんで30分たったら、画面を出したときに裏で読み直す（テストでは自動では読まない） */
function l2GcAuto(){
  if(TEST_MODE || !gasReady() || l2Ver() < 3 || !l2Prefs().gcal || L2.gcalBusy) return;
  if(Date.now() - (l2GcalCache().at || 0) < 30 * 60000 || Date.now() - L2.gcalTry < 10 * 60000) return;
  setTimeout(function(){ l2GcalLoad(false); }, 0);
}
function l2GcPart(ymd, isToday){
  if(!gasReady() || !l2Prefs().gcal) return '';
  l2GcAuto();
  var list = l2GcOn(ymd);
  if(!list.length) return '';
  var inner = list.map(function(x){ return l2GcRow(x, false); }).join('') +
    '<p class="note" style="margin:6px 0 0">Googleカレンダー（くらしの手帳のカレンダー以外）の予定です。' + (l2GcalCache().at ? agoText(l2GcalCache().at) + 'に読みこみ。' : '') + '</p>';
  return (typeof secWrap === 'function') ? secWrap('l2gcal', (isToday ? '今日' : '明日') + 'のGoogleの予定', list.length + '件', inner)
    : section('Googleの予定', list.length + '件', inner);
}
kmPart('today', 'l2gcal', 'Googleの予定', function(ctx){ return l2GcPart(ctx.ymd || today(), ctx.isToday !== false); });
kmPart('tomo', 'l2gcal', 'Googleの予定', function(ctx){ return l2GcPart(ctx.ymd || shiftDate(today(), 1), false); });
kmPart('cal', 'l2gcal', 'Googleの予定', function(){
  if(!gasReady() || !l2Prefs().gcal) return '';
  l2GcAuto();
  var sel = (typeof calSel !== 'undefined' && isYmd(calSel)) ? calSel : today();
  var list = l2GcOn(sel), c = l2GcalCache();
  var month = l2GcVisible().filter(function(x){ return l2GcDay(x).slice(0, 7) === sel.slice(0, 7); }).length;
  return '<div style="margin-top:14px">' + section('Googleの予定（' + ymdLabel(sel) + '）', list.length ? list.length + '件' : null,
    (list.length ? list.map(function(x){ return l2GcRow(x, false); }).join('') : '<div class="empty">この日のGoogleの予定はありません。</div>') +
    '<div class="pillrow" style="margin-top:8px"><button class="mini" data-act="l2-gc-load">' + (L2.gcalBusy ? '読みこみ中…' : 'Googleから読みこむ') + '</button></div>' +
    '<p class="note" style="margin:4px 0 0">この月は ' + month + '件。' + (c.at ? agoText(c.at) + 'に読みこみ。' : 'まだ読みこんでいません。') +
      (L2.gcalErr ? '（' + esc(L2.gcalErr) + '）' : '') + '</p>') + '</div>';
});
function l2GcImport(id){
  var x = l2GcalCache().items.filter(function(i){ return i.id === id; })[0];
  if(!x){ toast('その予定が見つかりません（読みこみ直してください）', true); return false; }
  if(l2GcImported(x)){ toast('もうアプリに入っています'); return false; }
  var d0 = l2GcDay(x), endEx = String(x.end || '').slice(0, 10);
  var dateEnd = (x.allDay && isYmd(endEx) && shiftDate(endEx, -1) > d0) ? shiftDate(endEx, -1) : '';
  S.events.push({ id:uid('ev'), date:d0, dateEnd:dateEnd, title:x.title, subject:'', time:l2GcTime(x), kind:'other',
    memo:'Googleカレンダー「' + (x.cal || '') + '」から' + (x.where ? '\n場所：' + x.where : ''), photos:[], gid:x.id, mt:Date.now() });
  return true;
}
function l2GcalSettings(){
  if(!gasReady()) return l2NeedGas();
  if(l2Ver() < 3) return l2NeedNew('Googleカレンダーの予定を読むの');
  var p = l2Prefs(), c = l2GcalCache(), cals = l2GcCals(), hide = p.gcalHide || [];
  return '<div class="pillrow"><button data-act="l2-set" data-k="gcal" data-v="1" class="' + (p.gcal ? 'on' : '') + '">今日・予定タブに出す</button>' +
      '<button data-act="l2-set" data-k="gcal" data-v="0" class="' + (!p.gcal ? 'on' : '') + '">出さない</button></div>' +
    '<div class="row"><div class="grow s">読みこんだ予定</div><div class="t num">' + (c.at ? c.items.length + '件（' + agoText(c.at) + '）' : 'まだ') + '</div>' +
      '<button class="mini" data-act="l2-gc-load">' + (L2.gcalBusy ? '読みこみ中…' : '今すぐ読む') + '</button></div>' +
    (L2.gcalErr ? '<div class="msg ng">' + esc(L2.gcalErr) + '</div>' : '') +
    (cals.length ? '<label class="f">出すカレンダー（押すと切りかえ）</label><div class="pillrow">' + cals.map(function(cal){
      return '<button data-act="l2-gc-cal" data-v="' + esc(cal) + '" class="' + (hide.indexOf(cal) < 0 ? 'on' : '') + '">' + esc(cal) + '</button>';
    }).join('') + '</div>' : '') +
    '<p class="note">Googleカレンダーの予定（「くらしの手帳」のカレンダーと祝日はのぞく）を、今日から60日ぶん読みます。30分ごとに読み直します。' +
      '「アプリに入れる」を押すと、アプリの予定にも入ります（同じ予定は二重に入りません）。読んだ予定はこの端末だけに置きます。</p>';
}

/* ============================== iPhoneのカレンダーに直接（照会カレンダー .ics）（#173） ============================== */
function l2IcsFold(line){
  /* 1行は75バイトまで（日本語は1文字3バイト・絵文字は4バイト）。長い行は、次の行の頭に空白を入れてつなぐ
     （絵文字などの「2つで1文字」を、行の切れ目で分けない） */
  var out = [], cur = '', bytes = 0, lim = 73;
  (String(line).match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g) || []).forEach(function(ch){
    var c = ch.charCodeAt(0), b = ch.length > 1 ? 4 : c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
    if(bytes + b > lim){ out.push(cur); cur = ' '; bytes = 1; lim = 74; }
    cur += ch; bytes += b;
  });
  out.push(cur);
  return out.join('\r\n');
}
function l2IcsText(items){
  items = items || calItemsForGoogle();
  var now = new Date(), st = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + 'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds()) + 'Z';
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//kurashi//links2//JA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:くらしの手帳', 'X-WR-TIMEZONE:Asia/Tokyo', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Tokyo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:JST', 'END:STANDARD', 'END:VTIMEZONE'];
  var ymd8 = function(d){ return d.replace(/-/g, ''); };
  items.forEach(function(it){
    if(!isYmd(it.date)) return;
    L.push('BEGIN:VEVENT', 'UID:' + String(it.k).replace(/[^\w\-.]/g, '_') + '@kurashi', 'DTSTAMP:' + st, 'SUMMARY:' + icsEsc(it.title));
    if(it.time && minutesOf(it.time) != null){
      var endMin = minutesOf(it.time) + (Number(it.mins) || 60), endDay = it.date;
      while(endMin >= 1440){ endMin -= 1440; endDay = shiftDate(endDay, 1); }
      L.push('DTSTART;TZID=Asia/Tokyo:' + ymd8(it.date) + 'T' + it.time.replace(':', '') + '00', 'DTEND;TZID=Asia/Tokyo:' + ymd8(endDay) + 'T' + hhmmOf(endMin).replace(':', '') + '00');
    }else{
      var last = (isYmd(it.end) && it.end > it.date) ? it.end : it.date;
      L.push('DTSTART;VALUE=DATE:' + ymd8(it.date), 'DTEND;VALUE=DATE:' + ymd8(shiftDate(last, 1)));
    }
    if(it.note) L.push('DESCRIPTION:' + icsEsc(it.note));
    if(it.kind) L.push('CATEGORIES:' + icsEsc(({ task:'課題', quiz:'小テスト', exam:'テスト', kousa:'口頭試問', work:'バイト', imp:'大事な予定', other:'予定', pay:'引き落とし', health:'健康' })[it.kind] || it.kind));
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(l2IcsFold).join('\r\n') + '\r\n';
}
function l2IcsUrl(){ return shortUrl('ics'); }
function l2Webcal(){ return l2IcsUrl().replace(/^https?:/, 'webcal:'); }
async function l2IcsPush(manual){
  if(L2.icsBusy){ if(!manual) setTimeout(function(){ l2IcsPush(false); }, 30000); return; }     /* 置いている最中に変わった分も、あとで置く */
  if(!gasReady() || l2Ver() < 3){ if(manual) toast('Google連携を新しい版にすると使えます', true); return; }
  if(!manual && !l2Prefs().ics) return;
  var items = calItemsForGoogle(), sig = hash53(canon(items)), st = l2Local('ics') || {};
  if(!manual && st.sig === sig && Date.now() - (st.at || 0) < 24 * 3600000) return;      /* 中身が同じなら置き直さない */
  L2.icsBusy = true;
  try{
    await gasCall('icsPut', { ics:l2IcsText(items) });
    l2Local('ics', { at:Date.now(), sig:sig, n:items.length });
    L2.icsErr = '';
    if(manual) toast('iPhoneのカレンダー用の予定表を置きました（' + items.length + '件）');
  }catch(e){
    L2.icsErr = e.message;
    logErr('iPhoneのカレンダー', e.message);
    if(manual) toast('置けませんでした：' + e.message, true);
  }finally{
    L2.icsBusy = false;
  }
}
/* 予定が変わったら：アイコンの数字をすぐ、予定表は数分まとめて置き直す
   （persist のたびに呼ばれるので、待ち時間を毎回のばさない。最初に変わってから数分後に1回置く） */
function l2Soon(){
  clearTimeout(L2.soonT);
  L2.soonT = setTimeout(l2BadgeUpdate, 1500);
  if(!l2Prefs().ics || !gasReady()) return;
  var now = Date.now(), due = now + L2.icsDelay;
  if(L2.icsT && L2.icsDue > now && L2.icsDue <= due) return;       /* もう待っている */
  clearTimeout(L2.icsT);
  L2.icsDue = due;
  L2.icsT = setTimeout(function(){ L2.icsT = null; l2IcsPush(false); }, L2.icsDelay);
}
(function(){
  if(typeof gasCalSoon !== 'function') return;
  var orig = gasCalSoon;
  gasCalSoon = function(){ orig(); try{ l2Soon(); }catch(e){} };
})();

/* ============================== アイコンの数字（#158） ============================== */
var L2_BADGE = [['due', '今日しめきり＋期限切れの課題'], ['today', '今日の授業と予定の数'], ['open', 'まだの課題ぜんぶ'], ['off', '出さない']];
function l2BadgeCount(mode){
  mode = mode || l2Prefs().badge;
  if(mode === 'off') return 0;
  var td = today();
  var open = (S.tasks || []).filter(function(t){ return !t.done; });
  if(mode === 'open') return open.length;
  if(mode === 'today'){
    var n = classesForDate(td).filter(function(c){ return !c.off; }).length;
    normItems().forEach(function(x){
      if(x.src === 'cls' || (x.src === 'task' && x.done)) return;
      if(isYmd(x.date) && x.date <= td && td <= (x.end || x.date)) n++;
    });
    return n;
  }
  return open.filter(function(t){ return isYmd(t.due) && t.due <= td; }).length;
}
function l2BadgeOk(){ try{ return typeof navigator !== 'undefined' && 'setAppBadge' in navigator; }catch(e){ return false; } }
function l2BadgeUpdate(){
  var n = 0;
  try{ n = l2BadgeCount(); }catch(e){ return; }
  if(n === L2.badgeN) return;
  L2.badgeN = n;
  if(!l2BadgeOk()) return;
  try{
    var p = n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge();
    if(p && p['catch']) p['catch'](function(){});
  }catch(e){}
}
setTimeout(l2BadgeUpdate, 3000);
setInterval(function(){ if(!document.hidden) l2BadgeUpdate(); }, 60000);
document.addEventListener('visibilitychange', function(){ if(!document.hidden) setTimeout(l2BadgeUpdate, 800); });

/* ============================== iPhone：リマインダー・Siri・Apple Watch（#54 #156 #159） ============================== */
function l2RemText(t){ return String(t.title || '課題') + (isYmd(t.due) ? '（' + l2Md(t.due) + (t.time ? ' ' + t.time : '') + 'まで）' : ''); }
function l2RemLink(t){
  return 'shortcuts://run-shortcut?name=' + encodeURIComponent(l2Prefs().remName || 'リマインダーに追加') + '&input=text&text=' + encodeURIComponent(l2RemText(t));
}
kmPart('todo', 'l2rem', 'iPhoneのリマインダーに送る', function(){
  if(!l2Prefs().remBtn) return '';
  var open = (S.tasks || []).filter(function(t){ return !t.done; }).sort(function(a, b){ return String(a.due || '9999').localeCompare(String(b.due || '9999')); });
  if(!open.length) return '';
  return '<details class="l2-fold"><summary>📲 iPhoneのリマインダーに送る（まだの課題 ' + open.length + '件）</summary>' +
    open.slice(0, 30).map(function(t){
      var n = isYmd(t.due) ? daysFromToday(t.due) : null, c = l2DueColor(n);
      return '<div class="row"><span class="l2-dot" style="background:' + (L2_COLORS[c] || 'var(--sub)') + '"></span><div class="grow"><div class="t">' + esc(t.title || '課題') + '</div>' +
        '<div class="s">' + (isYmd(t.due) ? esc(ymdLabel(t.due)) + (t.time ? ' ' + esc(t.time) : '') + 'まで' : '締切なし') + '</div></div>' +
        '<a class="mini" href="' + esc(l2RemLink(t)) + '">送る</a></div>';
    }).join('') +
    '<p class="note">iPhone・iPadで、ショートカット「' + esc(l2Prefs().remName) + '」を1回だけ作っておくと使えます（作り方：設定 › iPhone：Siri・リマインダー）。</p></details>';
});
function l2Step(list){ return '<ol class="steps">' + list.map(function(s){ return '<li>' + s + '</li>'; }).join('') + '</ol>'; }
function l2IphoneSettings(){
  if(!gasReady()) return l2NeedGas();
  var p = l2Prefs(), h = '';
  var key = !!shortKey();
  if(!key) h += '<div class="bn amber"><span class="ic">!</span><span>先に「iPhone・ショートカット・ウィジェット」で<b>短い合言葉</b>を作ってください。</span></div>' +
    '<button class="btn ghost" data-act="link-key">短い合言葉を作る</button>';
  var v4 = l2V4();
  /* リマインダー */
  h += '<h3 class="lk">✅ 課題をiPhoneのリマインダーへ</h3>' +
    '<p class="note" style="margin-top:0"><b>1件ずつ送る</b>（ToDoタブの「📲 iPhoneのリマインダーに送る」）：ショートカットを1つ作るだけです。</p>' +
    l2Step(['ショートカットアプリ →「＋」→ 名前を <b>' + esc(p.remName) + '</b> にする', 'アクション「リマインダーを追加」を足して、題名のところを <b>ショートカットの入力</b> にする。これでおしまい']) +
    '<div class="pillrow"><button data-act="l2-set" data-k="remBtn" data-v="1" class="' + (p.remBtn ? 'on' : '') + '">ToDoタブに送るボタンを出す</button>' +
      '<button data-act="l2-set" data-k="remBtn" data-v="0" class="' + (!p.remBtn ? 'on' : '') + '">出さない</button></div>' +
    '<p class="note"><b>まとめて送る</b>（まだ送っていない課題だけ）：</p>' +
    (v4 ? l2Step(['ショートカットアプリ →「＋」→ 名前を「課題をリマインダーへ」', '「URLの内容を取得」にこのURL ' + (key ? l2Copy('URLをコピー', shortUrl('reminders', '&new=1')) : ''),
          '「辞書の値を取得」（キー <b>items</b>）', '「各項目を繰り返す」の中に「リマインダーを追加」（題名は <b>繰り返し項目</b>）',
          'オートメーションで毎朝動かすと、新しい課題が自動で入ります']) +
      '<div class="pillrow"><button class="mini" data-act="l2-rem-reset">もう一度ぜんぶ送れるようにする</button></div>'
      : l2NeedNew('まとめて送る'));
  /* Siri */
  var asks = [['明日の1限', 'tomorrow1', '「明日の1限は？」'], ['次の予定', 'next', '「次の予定は？」（Apple Watchでも）'], ['今日の予定', 'today', '「今日の予定」'],
    ['課題の締切', 'due', '「課題の締切」'], ['次のバイト', 'work', '「次のバイト」']];
  h += '<h3 class="lk">🗣 Siriで「明日の1限は？」・⌚ Apple Watchに次の予定</h3>' +
    (v4 ? l2Step(['ショートカットアプリ →「＋」→ 名前を、Siriに話しかけることばにする（例：<b>明日の1限</b>）',
        'アクション「URLの内容を取得」に、下のURLを入れる', 'アクション「テキストを読み上げる」（Watchなら「結果を表示」でも）を足す。これで「Hey Siri、明日の1限」で答えます',
        'Apple Watchで使うときは、ショートカットの ⓘ →「Apple Watchに表示」をオン。文字盤のコンプリケーションにも置けます']) +
      '<div class="l2-asks">' + asks.map(function(a){
        return '<div class="row"><div class="grow"><div class="t">' + esc(a[0]) + '</div><div class="s">' + esc(a[2]) + '</div></div>' +
          (key ? l2Copy('URLをコピー', a[1] === 'next' ? shortUrl('next') : shortUrl('ask', '&q=' + a[1])) : '') + '</div>';
      }).join('') + '</div>' +
      '<p class="note">なんでも聞く：「テキストを音声入力」→「URLエンコード」→ URL「' + esc(shortUrl('ask', '&q=')) + '」の最後に、エンコードしたテキストをつなげて「URLの内容を取得」→「読み上げる」。</p>' +
      '<div class="field"><label class="f" for="l2_ask">ここで試す（聞くことば）</label><input id="l2_ask" placeholder="明日の1限は？"></div>' +
      '<button class="mini" data-act="l2-ask-test">答えを見る</button>' + (L2.askAns ? '<div class="l2-ans">' + esc(L2.askAns) + '</div>' : '')
      : l2NeedNew('Siri・Apple Watchの答え'));
  /* ロック画面 */
  h += '<h3 class="lk">🔒 ロック画面ウィジェット（次の予定・締切の数）</h3>' +
    l2Step(['「iPhone・ショートカット・ウィジェット」の「プログラムをコピー」で、Scriptable のプログラムを新しくする（同じプログラムでホーム画面にもロック画面にも出せます）',
      'ロック画面を長押し →「カスタマイズ」→ ロック画面 → 時計の下の枠をタップ → <b>Scriptable</b> → 丸・四角・1行のどれかを選ぶ',
      '置いたウィジェットをタップ →「Script」に今のプログラムを選ぶ']) +
    '<p class="note">丸：3日以内の締切の数／四角：次の予定と締切／1行：次の予定。ホーム画面では、締切の近さで色が変わります（今日＝赤・明日＝だいだい・3日以内＝黄・それ以外＝緑）。' + (v4 ? '' : '色とロック画面は、Google連携を新しい版にすると出ます。') + '</p>';
  /* iCloudカレンダー */
  var st = l2Local('ics') || {};
  h += '<h3 class="lk">📅 iPhoneのカレンダーに直接（Googleカレンダーなしで）</h3>' +
    (l2Ver() < 3 ? l2NeedNew('iPhoneのカレンダーへの予定表') :
      '<div class="pillrow"><button data-act="l2-set" data-k="ics" data-v="1" class="' + (p.ics ? 'on' : '') + '">自動で置き直す</button>' +
        '<button data-act="l2-set" data-k="ics" data-v="0" class="' + (!p.ics ? 'on' : '') + '">しない</button>' +
        '<button class="mini" data-act="l2-ics-push">' + (L2.icsBusy ? '置いています…' : '今すぐ置く') + '</button></div>' +
      '<div class="row"><div class="grow s">最後に置いた（この端末から）</div><div class="t num">' + (st.at ? agoText(st.at) + '（' + (st.n || 0) + '件）' : 'まだ') + '</div></div>' +
      (L2.icsErr ? '<div class="msg ng">' + esc(L2.icsErr) + '</div>' : '') +
      (key ? l2Step(['上の「今すぐ置く」を押す', 'iPhoneで、このボタンをタップ → <a class="mini" href="' + esc(l2Webcal()) + '">iPhoneのカレンダーに追加</a> →「照会」→「追加」',
        'うまくいかないときは：設定アプリ › カレンダー › アカウント › アカウントを追加 › その他 › 照会するカレンダーを追加 に、このURLを貼る ' + l2Copy('URLをコピー', l2IcsUrl())]) : '') +
      '<p class="note">予定・課題の締切・テスト・バイト・健康の期限・引き落としが入ります。変えたら数分後に自動で置き直し、iPhoneは1時間ほどで読み直します（読むだけのカレンダーです）。</p>');
  /* アイコンの数字 */
  var perm = (typeof Notification !== 'undefined') ? Notification.permission : '';
  h += '<h3 class="lk">🔴 アイコンに残りの数</h3><div class="pillrow">' + L2_BADGE.map(function(b){
      return '<button data-act="l2-set" data-k="badge" data-v="' + b[0] + '" class="' + (p.badge === b[0] ? 'on' : '') + '">' + esc(b[1]) + '</button>';
    }).join('') + '</div>' +
    '<p class="note">いまの数：<b>' + l2BadgeCount() + '</b>。' + (l2BadgeOk()
      ? (perm === 'granted' ? '' : 'iPhoneでは、<b>ホーム画面に追加したアプリ</b>で通知を許可すると出ます（設定 › 通知 の「この端末で通知を受け取る」）。')
      : 'この端末・ブラウザでは、アイコンに数字を出せません（iPhoneはホーム画面に追加したアプリで出せます）。') + '</p>';
  return h;
}

/* ============================== 勉強BGM（Spotify）（#169） ============================== */
var L2_BGM = [
  { type:'playlist', id:'37i9dQZF1DWWQRwui0ExPn', name:'lofi beats（ローファイ）' },
  { type:'playlist', id:'37i9dQZF1DX8Uebhn9wzrS', name:'chill lofi study beats（勉強）' },
  { type:'playlist', id:'37i9dQZF1DWZeKCadgRdKQ', name:'Deep Focus（集中）' },
  { type:'playlist', id:'37i9dQZF1DX4sWSpwq3LiO', name:'Peaceful Piano（ピアノ）' },
  { type:'playlist', id:'37i9dQZF1DWVqfgj8NZEp1', name:'Coffee Table Jazz（カフェ）' }
];
function l2BgmParse(url){
  var m = /(playlist|album)[\/:]([A-Za-z0-9]{10,40})/.exec(String(url || ''));
  return m ? { type:m[1], id:m[2] } : null;
}
function l2BgmList(){ return L2_BGM.concat((l2Prefs().bgmMine || []).filter(function(x){ return x && x.id; })); }
function l2BgmCur(){
  var list = l2BgmList(), sel = l2Local('bgmSel');
  return list.filter(function(x){ return x.type + ':' + x.id === sel; })[0] || list[0];
}
function l2BgmView(){
  var cur = l2BgmCur(), list = l2BgmList(), mine = l2Prefs().bgmMine || [];
  var src = 'https://open.spotify.com/embed/' + cur.type + '/' + cur.id + '?utm_source=generator';
  return section('勉強BGM', 'Spotify',
    '<div class="pillrow l2-bgmpick">' + list.map(function(x){
      return '<button data-act="l2-bgm-pick" data-v="' + esc(x.type + ':' + x.id) + '" class="' + (x === cur ? 'on' : '') + '">' + esc(x.name) + '</button>';
    }).join('') + '</div>' +
    '<iframe class="l2-sp" title="Spotify ' + esc(cur.name) + '" ' + (TEST_MODE ? 'data-src' : 'src') + '="' + esc(src) + '" height="352" frameborder="0" ' +
      'allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>' +
    '<div class="pillrow"><a class="btn ghost" href="' + esc('https://open.spotify.com/' + cur.type + '/' + cur.id) + '" target="_blank" rel="noopener">Spotifyのアプリで開く</a></div>' +
    '<p class="note">ここでは30秒ずつのことがあります。ぜんぶ聞くときは「Spotifyのアプリで開く」を押してください。</p>') +
    section('自分のプレイリスト', mine.length ? mine.length + 'こ' : null,
      mine.map(function(x){
        return '<div class="row"><div class="grow t">' + esc(x.name) + '</div><button class="mini" data-act="l2-bgm-del" data-v="' + esc(x.type + ':' + x.id) + '">消す</button></div>';
      }).join('') +
      '<div class="field"><label class="f" for="l2_bgm_url">SpotifyのURL（共有 →「リンクをコピー」）</label><input id="l2_bgm_url" inputmode="url" placeholder="https://open.spotify.com/playlist/…"></div>' +
      '<div class="field"><label class="f" for="l2_bgm_name">名前（なくてもよい）</label><input id="l2_bgm_name" placeholder="いつもの集中BGM"></div>' +
      '<button class="btn ghost" data-act="l2-bgm-add">足す</button>');
}
kmStudy({ id:'l2-bgm', icon:'🎧', title:'勉強BGM', desc:'Spotifyで、集中・lo-fi・カフェの音楽', view:l2BgmView, order:80 });

/* ============================== 手書きノートをさがす（#19） ============================== */
function l2OcrItems(){ return (S.kmItems || []).filter(function(x){ return x && x.mod === 'links2' && x.type === 'ocr'; }); }
function l2LocalHits(q){
  q = String(q || '').trim().toLowerCase();
  if(!q) return [];
  var out = [];
  (S.notes || []).forEach(function(n){
    var txt = (n.title || '') + '\n' + (n.body || '');
    var at = txt.toLowerCase().indexOf(q);
    if(at >= 0) out.push({ note:n, kind:/^📝/.test(n.title || '') ? 'AIのまとめ' : 'メモ', snip:txt.slice(Math.max(0, at - 30), at + 60).replace(/\s+/g, ' ') });
  });
  l2OcrItems().forEach(function(o){
    var at = String(o.text || '').toLowerCase().indexOf(q);
    if(at < 0) return;
    var n = (S.notes || []).filter(function(x){ return x.id === o.note; })[0];
    if(n && !out.some(function(h){ return h.note === n && h.kind === '写真の文字'; })) out.push({ note:n, kind:'写真の文字', snip:String(o.text).slice(Math.max(0, at - 30), at + 60).replace(/\s+/g, ' ') });
  });
  return out.slice(0, 20);
}
async function l2GnSearch(q){
  q = String(q || '').trim();
  L2.gn.q = q;
  if(!q){ toast('さがすことばを入れてください', true); return; }
  if(!l2V4()){ L2.gn.items = null; L2.gn.err = ''; render(); return; }
  L2.gn.busy = true; L2.gn.err = ''; render();
  try{
    var r = await gasCall('gnSearch', { q:q });
    L2.gn.items = (r.items || []).slice(0, 30);
    L2.gn.folder = r.folder || ''; L2.gn.none = r.none || '';
  }catch(e){
    L2.gn.err = e.message; L2.gn.items = null;
  }finally{
    L2.gn.busy = false;
    if(!isTyping()) render();
  }
}
function l2NotesView(){
  var g = L2.gn, h = '';
  h += section('手書きノートをさがす', 'Goodnotes',
    '<div class="field"><label class="f" for="l2_gnq">さがすことば</label><input id="l2_gnq" value="' + esc(g.q) + '" placeholder="例：呼吸数　ショック"></div>' +
    '<button class="btn" data-act="l2-gn-search">' + (g.busy ? 'さがしています…' : 'ノートの中をさがす') + '</button>' +
    (!gasReady() ? l2NeedGas() : !l2V4() ? l2NeedNew('手書きノートの中の検索') : '') +
    '<p class="note">Goodnotesの自動バックアップ（Googleドライブの「' + esc((typeof gfeat === 'function' ? gfeat().gnFolder : '') || 'GoodNotes') + '」フォルダ）のPDFを、' +
      'Googleドライブの全文検索でさがします。手書きの字は、読みとれないこともあります。フォルダの名前は 設定 › ほかの端末・Gmail・AIの読み取り で変えられます。</p>');
  if(g.err) h += '<div class="msg ng">さがせませんでした：' + esc(g.err) + '</div>';
  if(g.items){
    h += section('ドライブのノート', g.items.length + '件',
      (g.none ? '<div class="msg ng">' + esc(g.none) + '</div>' : '') +
      (g.items.length ? g.items.map(function(x){
        var base = String(x.name).replace(/\.(pdf|png|jpe?g)$/i, '');
        var ai = (S.notes || []).filter(function(n){ return /^📝/.test(n.title || '') && String(n.title).indexOf(base) >= 0; })[0];
        return '<div class="row"><div class="grow"><div class="t">' + esc(base) + '</div>' +
          '<div class="s">' + (x.updated ? esc(ymdLabel(toYmd(new Date(x.updated)))) + 'に更新' : '') + '・ページは、ドライブで開いて 🔍 で同じことばをさがすと分かります</div>' +
          (ai ? '<div class="s">AIのまとめ：<button class="mini" data-act="note-open" data-id="' + esc(ai.id) + '">' + esc(ai.title) + '</button></div>' : '') + '</div>' +
          '<a class="mini" href="' + esc(x.url) + '" target="_blank" rel="noopener">ドライブで開く</a></div>';
      }).join('') : '<div class="empty">「' + esc(g.q) + '」がふくまれるノートは見つかりませんでした。</div>') +
      (g.folder ? '<a class="mini" href="' + esc(g.folder) + '" target="_blank" rel="noopener">フォルダを開く</a>' : ''));
  }
  var hits = l2LocalHits(g.q);
  if(g.q) h += section('アプリのメモ（写真の文字・AIのまとめもふくむ）', hits.length + '件',
    hits.length ? hits.map(function(x){
      return '<div class="row"><div class="grow"><div class="t">' + esc(x.note.title || 'メモ') + '</div><div class="s">' + esc(x.kind) + '：…' + esc(x.snip) + '…</div></div>' +
        '<button class="mini" data-act="note-open" data-id="' + esc(x.note.id) + '">開く</button></div>';
    }).join('') : '<div class="empty">アプリのメモには見つかりませんでした。</div>');
  /* メモの写真の文字 */
  var done = {};
  l2OcrItems().forEach(function(o){ done[o.pid] = 1; });
  var left = 0;
  (S.notes || []).forEach(function(n){ (n.photos || []).forEach(function(pid){ if(!done[pid]) left++; }); });
  h += section('メモの写真の文字を読む（AI）', l2OcrItems().length + '枚 読んだ',
    '<p class="note" style="margin-top:0">メモに付けた写真（ノート・プリント）の文字をAIで書き出して、ここでさがせるようにします。まだ読んでいない写真：<b>' + left + '枚</b>。</p>' +
    '<div class="bn amber"><span class="ic">!</span><span>実習記録など、<b>患者さんの情報が写っている写真はAIに送らないでください</b>（そういうメモからは写真を外してから）。</span></div>' +
    '<button class="btn ghost" data-act="l2-ocr-run"' + (left ? '' : ' disabled') + '>' + (L2.ocrBusy ? '読んでいます…' : '5枚まで読む') + '</button>' +
    (L2.ocrMsg ? '<p class="note">' + esc(L2.ocrMsg) + '</p>' : '') +
    (aiReady() ? '' : '<p class="note">AIのカギ（設定 › AI）を入れると使えます。</p>'));
  return h;
}
async function l2OcrRun(max){
  if(L2.ocrBusy) return 0;
  if(!aiReady()){ toast('先にAIのカギを入れてください', true); return 0; }
  var done = {}, todo = [];
  l2OcrItems().forEach(function(o){ done[o.pid] = 1; });
  (S.notes || []).forEach(function(n){ (n.photos || []).forEach(function(pid){ if(!done[pid] && todo.length < (max || 5)) todo.push({ note:n, pid:pid }); }); });
  if(!todo.length){ toast('読んでいない写真はありません'); return 0; }
  L2.ocrBusy = true; L2.ocrMsg = ''; render();
  var n = 0;
  try{
    for(var i = 0; i < todo.length; i++){
      var data = await photoGet(todo[i].pid);
      if(!data) continue;
      var r = await aiJson('この写真（ノート・プリント・板書）に書いてある文字を、読めるところだけ、そのまま書き出してください。手書きもできるだけ読んでください。' +
        '患者さんの名前・病室・生年月日など、個人が分かることは書かないでください。JSONだけで答えてください：{"text":"書き出した文字"}', [data], 'l2-ocr');
      var text = String((r && r.text) || '').trim().slice(0, 3000);
      S.kmItems = Array.isArray(S.kmItems) ? S.kmItems : [];
      S.kmItems.push({ id:uid('km'), mt:Date.now(), mod:'links2', type:'ocr', note:todo[i].note.id, pid:todo[i].pid, text:text, at:Date.now() });
      n++;
    }
    L2.ocrMsg = n + '枚の写真の文字を読みました。';
  }catch(e){
    L2.ocrMsg = 'とちゅうで止まりました：' + e.message;
  }finally{
    L2.ocrBusy = false;
    if(n) commit(); else render();
  }
  return n;
}
kmStudy({ id:'l2-notes', icon:'✍️', title:'手書きノートをさがす', desc:'Goodnotesのノートやメモの写真の中の字を、ことばでさがします', view:l2NotesView, order:60 });

/* ============================== 手帳の中身を橋わたしに預ける（Discord・SiriのAIが読む） ==============================
   アプリを閉じていてもAIが答えられるように、そうだんのAIが読むのと同じ中身（カギ・合言葉は入らない）を、
   自分のGoogleドライブ（Apps Scriptのフォルダ）に置く。中身が変わったとき・版が上がったとき・1日たったときに送り直す。 */
var L2_AI_MIN = 10 * 60000;          /* 送りすぎない（10分に1回まで） */
var L2_AI_MAX_AGE = 6 * 3600000;     /* 変わっていなくても、6時間たったら送り直す */
var l2AiBusy = false;
function l2AiSt(){ return l2Local('aiData') || {}; }
function l2AiOn(){ return l2Prefs().aiData !== 0; }
async function l2AiPush(force){
  if(l2AiBusy || !gasReady() || !l2V5() || typeof aiSnapshot !== 'function') return false;
  if(!force && !l2AiOn()) return false;
  var st = l2AiSt();
  if(!force && st.at && Date.now() - st.at < L2_AI_MIN) return false;
  var snap = aiSnapshot(250000);            /* AIは、この中から必要な分野だけを道具で読む */
  if(!snap) return false;
  var sig = hash53(canon(Object.assign({}, snap, { at:0, now:'', size:0 })));
  if(!force && sig === st.sig && st.build === APP_BUILD && Date.now() - (st.at || 0) < L2_AI_MAX_AGE) return false;
  l2AiBusy = true;
  try{
    var r = await gasCall('aiDataPut', { data:snap });
    l2Local('aiData', { at:Date.now(), sig:sig, build:APP_BUILD, size:toNum(r && r.size) || snap.size || 0, err:'' });
    return true;
  }catch(e){
    l2Local('aiData', Object.assign({}, st, { tryAt:Date.now(), err:String(e && e.message || e) }));
    logErr('AIに預ける', e.message);
    return false;
  }finally{ l2AiBusy = false; }
}
function l2AiSettings(){
  var st = l2AiSt(), on = l2AiOn();
  if(!l2V5()) return '<label class="f" style="margin-top:10px">Discord・Siriの質問に、AIが手帳を読んで答える</label>' +
    l2NeedNew('AIが手帳を読んで答えること');
  return '<label class="f" style="margin-top:10px">Discord・Siriの質問に、AIが手帳を読んで答える</label>' +
    '<div class="pillrow"><button data-act="l2-ai-data" data-v="1" class="' + (on ? 'on' : '') + '">預ける</button>' +
    '<button data-act="l2-ai-data" data-v="0" class="' + (!on ? 'on' : '') + '">預けない</button>' +
    (on ? '<button class="mini" data-act="l2-ai-now">いま送る</button>' : '') + '</div>' +
    '<p class="note">' + (on
      ? '予定・課題・テスト・お金・暗記・メモ・健康・おせわなど、手帳の中身を<b>自分のGoogleドライブ</b>（橋わたしのフォルダ）に置きます。カギ・合言葉・同期の部屋の名前は入りません。' +
        'Google側にAIのカギを預けてあると（設定 › ほかの端末・Gmail・AIの読み取り）、Discordでどんな聞き方をしても、AIがこの中身を読んで答えます。'
      : '預けないと、Discord・Siriは「明日」「課題」「お金」などの決まった聞き方にだけ答えます。') + '</p>' +
    (on ? '<p class="note">' + (st.at ? '最後に送ったのは ' + ymdLabel(toYmd(new Date(st.at))) + ' ' + pad(new Date(st.at).getHours()) + ':' + pad(new Date(st.at).getMinutes()) +
        '（' + Math.round((toNum(st.size) || 0) / 1024) + ' KB・版 ' + esc(st.build || '') + '）' : 'まだ送っていません') +
      (st.err ? '<br>うまくいきませんでした：' + esc(st.err) : '') + '</p>' : '');
}

/* ============================== Discordのボット（#183） ============================== */
function l2DcInfo(){ return l2Local('dc') || null; }
/* 通知の種類ごとに、送るチャンネルを分ける（決めていない種類は「しつもん」のチャンネル、またはウェブフックへ） */
var L2_CATS = [
  { k:'today', name:'きょう', desc:'朝のまとめ・明日の準備・授業の前' },
  { k:'due',   name:'しめきり', desc:'課題・レポート・フォームの締切' },
  { k:'exam',  name:'テスト', desc:'テストの3日前・前日・当日' },
  { k:'work',  name:'バイト', desc:'次のシフト・シフト希望の提出日' },
  { k:'money', name:'おかね', desc:'給料日・使いすぎ・引き落とし' },
  { k:'pet',   name:'おせわ', desc:'おなか・おふろ・キャラのひとこと' },
  { k:'info',  name:'おしらせ', desc:'大学のメール・警報・来週のまとめ' }
];
function l2ChanSettings(){
  var info = l2DcInfo(), d = L2.dc;
  if(!info || !info.channel) return '';            /* 先に「しつもん」のチャンネルを決めてから */
  var chans = info.chans || {}, names = info.cnames || {};
  var list = (d.channels || []).filter(function(c){ return c.id !== (d.askId || info.askId || ''); });
  return '<label class="f" style="margin-top:14px">通知の種類ごとのチャンネル</label>' +
    '<p class="note" style="margin-top:0">決めた種類は、そのチャンネルに届きます。決めていない種類は、今までどおり（ウェブフック、または「' + esc(info.channel || 'しつもん') + '」）に届きます。</p>' +
    (d.channels ? '' : '<div class="pillrow"><button class="mini" data-act="l2-dc-ch">チャンネルをさがす</button></div>') +
    L2_CATS.map(function(c){
      var now = chans[c.k] ? ('#' + (names[c.k] || 'チャンネル')) : '決めていない';
      return '<div class="row"><div class="grow"><div class="t">' + esc(c.name) + '<span class="s2" style="margin-left:6px">' + esc(now) + '</span></div>' +
        '<div class="s">' + esc(c.desc) + '</div>' +
        (d.channels ? '<div class="chips" style="margin-top:6px">' + list.map(function(x){
          return '<button data-act="l2-dc-cat" data-k="' + esc(c.k) + '" data-id="' + esc(x.id) + '"' + (chans[c.k] === x.id ? ' class="on"' : '') + '>#' + esc(x.name) + '</button>';
        }).join('') + (chans[c.k] ? '<button data-act="l2-dc-cat" data-k="' + esc(c.k) + '" data-id="">やめる</button>' : '') + '</div>' : '') +
        '</div></div>';
    }).join('');
}
function l2DiscordSettings(){
  if(!gasReady()) return l2NeedGas();
  var p = l2Prefs(), info = l2DcInfo(), d = L2.dc, h = '';
  h += '<p class="note" style="margin-top:0">いまは「通知」（設定 › 通知）でDiscordに<b>送るだけ</b>です。ボットを入れると、Discordの「しつもん」のチャンネルに、ふつうのことばで聞くだけで、AIが手帳の中身を読んで答えます（' + (GAS.fast ? '1分ほど' : '5分以内') + '）。「課題：レポート 10/3」で課題も足せます。通知は、種類ごとのチャンネルに分けられます。</p>';
  if(!l2V4()) return h + l2NeedNew('Discordのボット');
  h += '<div class="row"><div class="grow"><div class="t">' + (info && info.channel ? '「#' + esc(info.channel) + '」で答えています' : info && info.name ? 'ボット「' + esc(info.name) + '」を預けました（チャンネルはまだ）' : 'まだ使っていません') + '</div></div></div>';
  h += l2Step(['<a href="https://discord.com/developers/applications" target="_blank" rel="noopener">Discordの開発者ページ</a> →「New Application」→ 名前「くらしの手帳」→ 作る',
    '左の「Bot」→「Reset Token」→ 出てきたトークンをコピーして、下に貼って「ボットを預ける」',
    '同じ「Bot」の画面で <b>MESSAGE CONTENT INTENT</b> をオン →「Save Changes」',
    '下に出る「サーバーに招待」を押して、自分だけのサーバーを選ぶ →「認証」',
    '「チャンネルをさがす」を押して、答えてほしいチャンネルを選ぶ']);
  h += '<div class="field"><label class="f" for="l2_dc_tok">ボットのトークン（橋わたしにだけ置きます）</label><input id="l2_dc_tok" type="password" autocomplete="off" placeholder="MTA…"></div>' +
    '<div class="pillrow"><button class="mini" data-act="l2-dc-set">ボットを預ける</button>' +
      (info ? '<button class="mini" data-act="l2-dc-ch">' + (d.busy ? 'さがしています…' : 'チャンネルをさがす') + '</button><button class="mini" data-act="l2-dc-off">ボットをやめる</button>' : '') + '</div>' +
    (d.invite ? '<p><a class="btn ghost" href="' + esc(d.invite) + '" target="_blank" rel="noopener">サーバーに招待</a></p>' : '') +
    (d.channels ? (d.channels.length ? '<label class="f">答えるチャンネル</label>' + d.channels.map(function(c){
      return '<div class="row"><div class="grow"><div class="t">#' + esc(c.name) + '</div><div class="s">' + esc(c.guild) + '</div></div><button class="mini" data-act="l2-dc-use" data-id="' + esc(c.id) + '">ここにする</button></div>';
    }).join('') : '<div class="msg ng">チャンネルが見つかりません。先に「サーバーに招待」をしてください。</div>') : '') +
    (d.msg ? '<p class="note">' + esc(d.msg) + '</p>' : '');
  h += l2ChanSettings();
  h += '<label class="f" style="margin-top:10px">来週のまとめ</label><div class="pillrow">' +
    '<button data-act="l2-dc-week" data-v="1" class="' + (p.dcWeek ? 'on' : '') + '">日曜の夜8時に送る</button>' +
    '<button data-act="l2-dc-week" data-v="0" class="' + (!p.dcWeek ? 'on' : '') + '">送らない</button></div>' +
    '<p class="note">通知のDiscord（ウェブフック）があればそこへ、なければボットのチャンネルへ送ります。</p>';
  h += l2AiSettings();
  return h;
}

/* ============================== 祝日を自動で最新に（#187） ============================== */
var L2_HOL_URL = 'https://holidays-jp.github.io/api/v1/date.json';
function l2HolData(){
  var o = S.kmData && S.kmData['links2:holidays'];
  return (o && o.days && typeof o.days === 'object' && Array.isArray(o.years)) ? o : null;
}
var l2HolOrig = holidaysOf, l2HolCache = {}, l2HolCacheAt = 0;
/* アプリの祝日（js/core.js の holidaysOf）：新しい一覧がある年は、その一覧を使う。ない年は、今までどおり計算する */
holidaysOf = function(y){
  var o = l2HolData();
  if(!o || o.years.indexOf(Number(y)) < 0) return l2HolOrig(y);
  if(l2HolCacheAt !== o.at){ l2HolCache = {}; l2HolCacheAt = o.at; }
  if(l2HolCache[y]) return l2HolCache[y];
  var h = {};
  Object.keys(o.days).forEach(function(d){ if(d.slice(0, 4) === String(y)) h[d] = String(o.days[d]).replace(/^.+ 振替休日$/, '振替休日'); });
  l2HolCache[y] = h;
  return h;
};
async function l2HolUpdate(manual){
  if(L2.holBusy) return false;
  var o = l2HolData();
  if(!manual && o && Date.now() - (Number(o.at) || 0) < 30 * 86400000) return false;       /* 月に1回 */
  if(!manual && Date.now() - (Number(l2Local('holTry')) || 0) < 24 * 3600000) return false;   /* 読めなかったら、1日あける */
  l2Local('holTry', Date.now());
  L2.holBusy = true;
  try{
    var j = await apiJson(L2_HOL_URL), days = {}, cnt = {};
    Object.keys(j || {}).forEach(function(d){
      if(!isYmd(d) || typeof j[d] !== 'string') return;
      days[d] = String(j[d]).slice(0, 30);
      cnt[d.slice(0, 4)] = (cnt[d.slice(0, 4)] || 0) + 1;
    });
    var years = Object.keys(cnt).filter(function(y){ return cnt[y] >= 10; }).map(Number).sort();
    if(!years.length) throw new Error('祝日の一覧が空でした');
    Object.keys(days).forEach(function(d){ if(years.indexOf(Number(d.slice(0, 4))) < 0) delete days[d]; });
    S.kmData = (S.kmData && typeof S.kmData === 'object') ? S.kmData : {};
    S.kmData['links2:holidays'] = { at:Date.now(), src:'holidays-jp', years:years, days:days };
    touch('kmData');
    L2.holErr = '';
    commit();
    if(manual) toast('祝日の一覧を新しくしました（' + years.join('・') + '年）');
    return true;
  }catch(e){
    L2.holErr = e.message;
    logErr('祝日', e.message);
    if(manual) toast('読めませんでした（今の一覧のまま使います）：' + e.message, true);
    return false;
  }finally{
    L2.holBusy = false;
  }
}
/* 計算の一覧と、新しい一覧でちがう日（設定に出す） */
function l2HolDiff(y){
  var o = l2HolData();
  if(!o || o.years.indexOf(y) < 0) return [];
  var a = l2HolOrig(y), b = holidaysOf(y), out = [];
  Object.keys(b).forEach(function(d){ if(!a[d]) out.push(d + ' ' + b[d] + '（追加）'); });
  Object.keys(a).forEach(function(d){ if(!b[d]) out.push(d + ' ' + a[d] + '（なし）'); });
  return out.sort();
}
function l2HolSettings(){
  var o = l2HolData(), y = new Date().getFullYear(), diff = l2HolDiff(y).concat(l2HolDiff(y + 1));
  return '<div class="row"><div class="grow"><div class="t">' + (o ? '新しい一覧を使っています（' + esc(o.years.join('・')) + '年）' : '計算で出しています') + '</div>' +
      '<div class="s">' + (o ? '最後に新しくした：' + esc(new Date(o.at).toLocaleDateString('ja-JP')) + '（' + agoText(o.at) + '）' : 'まだ新しくしていません') + '</div></div>' +
      '<button class="mini" data-act="l2-hol-update">' + (L2.holBusy ? '読んでいます…' : 'いま新しくする') + '</button></div>' +
    (L2.holErr ? '<div class="msg ng">読めませんでした（今の一覧のまま）：' + esc(L2.holErr) + '</div>' : '') +
    (diff.length ? '<p class="note">計算とちがう日：' + esc(diff.slice(0, 8).join('、')) + '</p>' : '') +
    '<p class="note">月に1回、holidays-jp（内閣府の祝日の一覧をもとにした公開データ）を読んで、カレンダー・時間割の祝日を新しくします。読めないときは、今までの一覧のまま使います。</p>';
}
if(!TEST_MODE){
  setTimeout(function(){ l2HolUpdate(false); }, 20000);
  setInterval(function(){ if(!document.hidden) l2HolUpdate(false); }, 6 * 3600000);
  setTimeout(function(){ l2IcsPush(false); }, 25000);
  setInterval(function(){ if(!document.hidden){ l2GcAuto(); } }, 10 * 60000);
}

/* ============================== 設定の枠 ============================== */
kmSettings({ id:'l2gcal', title:'Googleカレンダーの予定をアプリに出す', after:'gas',
  note:function(){ return !gasReady() ? '未設定' : l2Prefs().gcal ? 'オン' : 'オフ'; }, html:l2GcalSettings });
kmSettings({ id:'l2iphone', title:'iPhone：Siri・Apple Watch・リマインダー・カレンダー・アイコンの数字', after:'gas',
  note:function(){ return !gasReady() ? '未設定' : l2V4() ? '準備OK' : '新しい版で全部使えます'; }, html:l2IphoneSettings });
kmSettings({ id:'l2discord', title:'Discordのボット（聞くと答える・来週のまとめ）', after:'gas',
  note:function(){ var i = l2DcInfo(); return i && i.channel ? '#' + i.channel : 'オフ'; }, html:l2DiscordSettings });
kmSettings({ id:'l2hol', title:'祝日の一覧', after:'',
  note:function(){ var o = l2HolData(); return o ? agoText(o.at) + 'に更新' : '計算'; }, html:l2HolSettings });

/* ============================== 操作 ============================== */
kmAction(function(act, t){
  if(act.indexOf('l2-') !== 0) return false;
  var v = t.dataset.v;
  if(act === 'l2-set'){
    var patch = {}, k = t.dataset.k;
    patch[k] = (k === 'badge') ? v : toNum(v);
    l2PrefSet(patch); commit();
    if(k === 'badge'){ L2.badgeN = -1; l2BadgeUpdate(); }
    if(k === 'ics' && patch.ics) l2IcsPush(true);
    if(k === 'gcal' && patch.gcal) l2GcalLoad(false);
    return true;
  }
  if(act === 'l2-radar-src'){
    if(!RADAR_SRC[v]) return true;
    l2PrefSet({ radarSrc:v }); commit();
    if(typeof radarLoad === 'function'){ radarStop(); radarLoad(true); }
    return true;
  }
  if(act === 'l2-ping'){
    gasCall('ping').then(function(r){
      GAS.ver = r.ver || 0; GAS.api = r.api || 0; GAS.trigger = r.trigger ? 1 : 0; GAS.fast = r.fast ? 1 : 0; GAS.ai = r.ai ? 1 : 0; GAS.pingAt = Date.now(); saveGas();
      if(typeof gasVerShare === 'function' && gasVerShare()){ persist(); pushRemote(); }
      toast(l2V4() ? '新しい版になっています' : 'まだ前の版のようです（「新バージョン」でデプロイしたか確かめてください）', !l2V4());
      render();
    }, function(e){ toast('つながりませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'l2-gc-load'){ l2GcalLoad(true); render(); return true; }
  if(act === 'l2-gc-import'){ if(l2GcImport(t.dataset.id)){ toast('アプリの予定に入れました'); commit(); } return true; }
  if(act === 'l2-gc-cal'){
    var hide = (l2Prefs().gcalHide || []).slice(), i = hide.indexOf(v);
    if(i >= 0) hide.splice(i, 1); else hide.push(v);
    l2PrefSet({ gcalHide:hide.slice(0, 30) }); commit(); return true;
  }
  if(act === 'l2-go-day'){
    var d = t.dataset.d;
    if(isYmd(d)){ appId = 'cal'; calTab = 'cal'; calSel = d; calYm = d.slice(0, 7); render(); window.scrollTo(0, 0); }
    return true;
  }
  if(act === 'l2-ics-push'){ l2IcsPush(true).then(function(){ render(); }); render(); return true; }
  if(act === 'l2-rem-reset'){
    gasCall('remindersReset').then(function(){ toast('次は、まだの課題をぜんぶ送ります'); }, function(e){ toast('できませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'l2-ask-test'){
    var q = val('l2_ask').trim() || '明日の1限は？';
    gasCall('askTest', { q:q }).then(function(r){ L2.askAns = r.text || ''; render(); }, function(e){ L2.askAns = 'できませんでした：' + e.message; render(); });
    return true;
  }
  if(act === 'l2-bgm-pick'){ l2Local('bgmSel', v); render(); return true; }
  if(act === 'l2-bgm-add'){
    var b = l2BgmParse(val('l2_bgm_url'));
    if(!b){ toast('SpotifyのプレイリストかアルバムのURLを貼ってください', true); return true; }
    var mine = (l2Prefs().bgmMine || []).filter(function(x){ return !(x.type === b.type && x.id === b.id); });
    b.name = val('l2_bgm_name').trim().slice(0, 40) || '自分のBGM ' + (mine.length + 1);
    mine.push(b);
    l2PrefSet({ bgmMine:mine.slice(-8) }); l2Local('bgmSel', b.type + ':' + b.id);
    commit(); toast('足しました'); return true;
  }
  if(act === 'l2-bgm-del'){
    l2PrefSet({ bgmMine:(l2Prefs().bgmMine || []).filter(function(x){ return x.type + ':' + x.id !== v; }) });
    commit(); return true;
  }
  if(act === 'l2-gn-search'){ l2GnSearch(val('l2_gnq')); return true; }
  if(act === 'l2-gn-find'){
    appId = 'study'; studyTool = 'l2-notes'; render(); window.scrollTo(0, 0);
    l2GnSearch(t.dataset.q || '');
    return true;
  }
  if(act === 'l2-ocr-run'){ l2OcrRun(5); return true; }
  if(act === 'l2-dc-set' || act === 'l2-dc-off'){
    var tok = act === 'l2-dc-off' ? '' : val('l2_dc_tok').trim();
    if(act === 'l2-dc-set' && !tok){ toast('トークンを貼ってください', true); return true; }
    gasCall('dcBotSet', { bot:tok }).then(function(r){
      if(!tok){ l2Local('dc', null); L2.dc = { busy:false, channels:null, invite:'', msg:'ボットをやめました' }; toast('ボットをやめました'); }
      else{ l2Local('dc', { name:r.name || '', channel:'' }); L2.dc.invite = r.invite || ''; L2.dc.msg = '預けました。次に「サーバーに招待」→「チャンネルをさがす」'; toast('ボットを預けました'); }
      render();
    }, function(e){ toast('できませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'l2-dc-ch'){
    L2.dc.busy = true; render();
    gasCall('dcBotChannels').then(function(r){ L2.dc.channels = r.items || []; L2.dc.invite = r.invite || L2.dc.invite; },
      function(e){ L2.dc.msg = 'さがせませんでした：' + e.message; })
      .then(function(){ L2.dc.busy = false; render(); });
    return true;
  }
  if(act === 'l2-dc-use'){
    gasCall('dcBotUse', { channel:t.dataset.id }).then(function(r){
      var info = l2DcInfo() || {};
      info.channel = r.channel || ''; info.askId = t.dataset.id; l2Local('dc', info);
      L2.dc.askId = t.dataset.id;
      L2.dc.msg = '「#' + info.channel + '」に、あいさつを送りました。「明日」と書いてみてください。下で、通知の種類ごとのチャンネルも決められます';
      toast('チャンネルを決めました'); render();
    }, function(e){ toast('できませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'l2-dc-cat'){
    var kind = t.dataset.k, cid = t.dataset.id || '';
    gasCall('dcBotChan', { kind:kind, channel:cid }).then(function(r){
      var info2 = l2DcInfo() || {};
      info2.chans = r.chans || {}; info2.cnames = r.names || {};
      l2Local('dc', info2);
      toast(cid ? 'このチャンネルに送ります' : '決めていない状態にもどしました');
      render();
    }, function(e){ toast('できませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'l2-ai-data'){
    l2PrefSet({ aiData:toNum(v) }); commit();
    if(toNum(v)) l2AiPush(true).then(function(okd){ toast(okd ? '手帳の中身を預けました（AIが答えられます）' : '預けられませんでした', !okd); render(); });
    else toast('預けないようにしました（決まった聞き方にだけ答えます）');
    return true;
  }
  if(act === 'l2-ai-now'){
    toast('送っています…');
    l2AiPush(true).then(function(okd){ toast(okd ? '手帳の中身を送りました' : '送れませんでした：' + (l2AiSt().err || ''), !okd); render(); });
    return true;
  }
  if(act === 'l2-dc-week'){
    l2PrefSet({ dcWeek:toNum(v) }); commit();
    if(typeof gfeatPush === 'function') gfeatPush().then(function(){ toast(toNum(v) ? '日曜の夜に来週のまとめを送ります' : '送らないようにしました'); },
      function(e){ toast('橋わたしに送れませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'l2-hol-update'){ l2HolUpdate(true).then(function(){ render(); }); render(); return true; }
  return false;
});

/* ============================== 全体検索・点検・AI ============================== */
kmSearch(function(q){
  q = String(q || '').trim();
  var ql = q.toLowerCase(), out = [];
  if(!q) return out;
  l2GcVisible().forEach(function(x){
    if(out.length >= 10) return;
    if((x.title + ' ' + (x.where || '')).toLowerCase().indexOf(ql) < 0) return;
    out.push({ kind:'Googleの予定', title:x.title, sub:ymdLabel(l2GcDay(x)) + (l2GcTime(x) ? ' ' + l2GcTime(x) : '') + (x.cal ? '・' + x.cal : ''),
      act:'l2-go-day', attrs:l2Attrs({ d:l2GcDay(x) }) });
  });
  l2OcrItems().forEach(function(o){
    if(out.length >= 20) return;
    var at = String(o.text || '').toLowerCase().indexOf(ql);
    if(at < 0) return;
    var n = (S.notes || []).filter(function(x){ return x.id === o.note; })[0];
    if(n) out.push({ kind:'メモの写真の文字', title:n.title || 'メモ', sub:'…' + String(o.text).slice(Math.max(0, at - 20), at + 40).replace(/\s+/g, ' ') + '…', act:'note-open', attrs:l2Attrs({ id:n.id }) });
  });
  if(gasReady()) out.push({ kind:'手書きノート', title:'「' + q + '」を手書きノートの中でさがす', sub:'Googleドライブの全文検索（ネットが要ります）', act:'l2-gn-find', attrs:l2Attrs({ q:q }) });
  return out;
});
kmCheck(function(){
  var out = [], p = l2Prefs();
  if(p.ics && gasReady() && l2Ver() < 3) out.push({ level:'warn', msg:'iPhoneのカレンダーへの予定表は、Google連携を新しい版にすると使えます' });
  var st = l2Local('ics');
  if(p.ics && gasReady() && st && Date.now() - st.at > 3 * 86400000) out.push({ level:'warn', msg:'iPhoneのカレンダー用の予定表を、3日以上置き直せていません', fix:function(){ l2IcsPush(true); } });
  var o = l2HolData();
  if(o && Date.now() - o.at > 90 * 86400000) out.push({ level:'warn', msg:'祝日の一覧が3か月以上古いままです', fix:function(){ l2HolUpdate(true); } });
  return out;
});
function l2AiSection(name, sec){ if(KM.aiData[name]) KM.aiData[name].section = sec; }
kmAiData('google_calendar', 'Googleカレンダー（くらしの手帳のカレンダー以外）から読んだ予定。imported=アプリの予定に取りこみずみ。hidden_calendars は出さないことにしたカレンダー', function(opt){
  opt = opt || {};
  var c = l2GcalCache(), hide = l2Prefs().gcalHide || [];
  var list = c.items.filter(function(x){
    var d = l2GcDay(x);
    if(isYmd(opt.from) && d < opt.from) return false;
    if(isYmd(opt.to) && d > opt.to) return false;
    return true;
  });
  return { loaded_at:c.at ? new Date(c.at).toISOString() : '', range:[c.from, c.to], calendars:l2GcCals(), hidden_calendars:hide, on:!!l2Prefs().gcal,
    items:list.slice(0, 120).map(function(x){ return { date:l2GcDay(x), time:l2GcTime(x) || '終日', title:x.title, calendar:x.cal, where:x.where, hidden:hide.indexOf(x.cal) >= 0, imported:l2GcImported(x) }; }) };
});
l2AiSection('google_calendar', 'events');
kmAiData('widget_summary', 'ウィジェット・Siri・Apple Watch・Discordボットが読むまとめ（締切の色：red=今日まで・orange=明日・yellow=3日以内・green=それ以外）、アイコンの数字、iPhoneのカレンダー・Discordボットの状態', function(){
  var s = l2Summary(), st = l2Local('ics') || {}, dc = l2DcInfo();
  return { dues:s.todo.slice(0, 15), counts:s.cnt, next_items:s.items.slice(0, 10), badge:{ mode:l2Prefs().badge, count:s.badge },
    icloud_calendar:{ on:!!l2Prefs().ics, last_put:st.at ? new Date(st.at).toISOString() : '', events:st.n || 0 },
    discord_bot:dc ? { name:dc.name, channel:dc.channel } : null, weekly_summary:!!l2Prefs().dcWeek, bridge_version:l2Ver(), bridge_api:gasReady() ? toNum(GAS.api) : 0 };
});
l2AiSection('widget_summary', 'settings');
kmAiData('rain_radar', '雨雲レーダーの状態（出どころ・表示のズーム・雨のタイルのズーム・時刻の一覧は日本時間）', function(){
  if(typeof radar === 'undefined') return null;
  var frs = radar.frames || [];
  return { open:radar.open, source:(RADAR_SRC[radar.src || radarSrcId()] || {}).name, zoom:radar.z,
    rain_zoom:radarGeom(radarPoints(), radar.z, radar.src || radarSrcId()).dz, showing:radarText(radar.idx),
    frames:frs.map(function(f){ return radarJst(f.t) + (f.f ? '（予報）' : ''); }), now:frs.length ? radarJst(frs[radarNowIdx()].t) : '',
    loaded_at:radar.at ? new Date(radar.at).toISOString() : '', error:radar.err || '', points:radarPoints() };
});
l2AiSection('rain_radar', 'more');
kmAiData('holidays', '日本の祝日（holidays-jp で新しくした一覧、なければ計算）。今年と来年', function(){
  var o = l2HolData(), y = new Date().getFullYear(), list = {};
  [y, y + 1].forEach(function(yy){ var h = holidaysOf(yy); Object.keys(h).sort().forEach(function(d){ list[d] = h[d]; }); });
  return { source:o ? 'holidays-jp' : '計算', updated_at:o ? new Date(o.at).toISOString() : '', years:o ? o.years : [], list:list };
});
l2AiSection('holidays', 'timetable');
kmAiData('handwritten_search', '手書きノート（Goodnotes）を最後にさがしたことばと結果、メモの写真から読んだ文字の数', function(){
  return { last_query:L2.gn.q, results:(L2.gn.items || []).map(function(x){ return { name:x.name, updated:x.updated ? toYmd(new Date(x.updated)) : '', url:x.url }; }),
    photo_text_count:l2OcrItems().length };
});
l2AiSection('handwritten_search', 'notes');
kmChatTool({ name:'import_google_event', description:'読みこんであるGoogleカレンダーの予定を、アプリの予定に取りこむ（ことばで予定の名前、日付でしぼる）。',
  parameters:{ type:'OBJECT', properties:{ title:{ type:'STRING', description:'予定の名前（ふくまれることば）' }, date:{ type:'STRING', description:'日付 YYYY-MM-DD（なければ空）' } }, required:['title'] } },
  function(a){
    var q = String(a.title || '').trim();
    var x = l2GcalCache().items.filter(function(i){ return i.title.indexOf(q) >= 0 && (!isYmd(a.date) || l2GcDay(i) === a.date); })[0];
    if(!q || !x) return { result:'その予定が、読みこんだGoogleの予定に見つかりません' };
    if(l2GcImported(x)) return { result:'もうアプリに入っています' };
    l2GcImport(x.id);
    var ev = S.events[S.events.length - 1];
    return { result:'取りこみました', op:{ t:'add', list:'events', id:ev.id, label:'予定「' + ev.title + '」（' + ymdLabel(ev.date) + '）' } };
  });
KM.chatTools[KM.chatTools.length - 1].write = true;

/* 手帳の中身を橋わたしへ（起動のあと・10分ごと・画面にもどったとき。中身が変わっていなければ送らない） */
if(!TEST_MODE){
  setTimeout(function(){ l2AiPush(false); }, 20000);
  setInterval(function(){ if(!document.hidden) l2AiPush(false); }, 10 * 60000);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) setTimeout(function(){ l2AiPush(false); }, 3000); });
}

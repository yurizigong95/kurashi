/* くらしの手帳：iPhone連携（ショートカット・ウィジェット・目覚まし）・Google ToDo・場所・共有 */
/* ============================== 短い合言葉 ==============================
   ショートカットやウィジェットは、橋わたしの「短い合言葉」を使う（読むことと、記録を預けることだけできる）。
   合言葉は S.cloud.links に置き、ほかの端末でも同じものを表示できるようにする。            */
var LINKS = { busy:false, sumSig:'', sumAt:0, tasksBusy:false, placeMsg:'' };
function linksCfg(){ return (S.cloud && S.cloud.links) || {}; }
function shortKey(){ return String(linksCfg().shortKey || ''); }
function shortUrl(a, extra){
  return String(GAS.url || '') + '?k=' + encodeURIComponent(shortKey()) + '&a=' + a + (extra || '');
}
async function linksMakeKey(){
  var k = gasNewToken();
  await gasCall('shortKey', { key:k });
  S.cloud = S.cloud || {};
  S.cloud.links = Object.assign({}, linksCfg(), { shortKey:k, mt:Date.now() });
  touch('cloud'); commit();
  return k;
}
function linkPrefs(){
  return Object.assign({ arrive:1, prep:60, alarmFree:'', tasks:0, place:null, placeAuto:0 }, S.ui.links || {});
}
function linkPrefSet(patch){
  S.ui.links = Object.assign({}, linkPrefs(), patch);
  touch('ui');
}

/* ============================== ショートカットから届いた記録 ============================== */
async function inboxPull(manual){
  if(!gasReady() || LINKS.busy) return;
  LINKS.busy = true;
  try{
    var r = await gasCall('inboxTake');
    var items = r.items || [], msgs = [];
    items.forEach(function(it){ var m = inboxApply(it); if(m) msgs.push(m); });
    if(items.length){
      commit();
      toast(msgs.length ? msgs.slice(0, 3).join('／') : 'ショートカットからの記録を取りこみました');
    }else if(manual) toast('届いている記録はありません');
  }catch(e){
    logErr('ショートカット', e.message);
    if(manual) toast('取りこめませんでした：' + e.message, true);
  }finally{
    LINKS.busy = false;
  }
}
function inboxApply(it){
  if(!it || !it.kind) return '';
  var d = new Date(Number(it.at) || Date.now()), ymd = toYmd(d), min = d.getHours() * 60 + d.getMinutes();
  /* 足した機能が受け取るもの（健康の記録・大学のメールなど） */
  if(typeof kmInboxApply === 'function'){ var km = kmInboxApply(it, ymd, min); if(km !== null) return km; }
  if(it.kind === 'pay'){
    var mail = /^gm-/.test(String(it.ref || ''));      /* カードの利用メールから（橋わたしがGmailを読んだもの） */
    var x = (typeof kbAdd === 'function') ? kbAdd({ amount:it.amount, title:it.shop || it.card || 'Apple Pay', date:isYmd(it.date) ? it.date : ymd,
      src:mail ? 'mail' : 'wallet', acct:it.card || '', ref:it.ref || ('w-' + it.id) }) : null;
    return x ? (mail ? (it.card || 'カード') + 'のメールから ' : 'Apple Pay ') + yen(x.amount) + 'を家計簿に記録' : '';
  }
  if(it.kind === 'task' && it.text){
    S.tasks.push({ id:uid('tk'), title:String(it.text).slice(0, 80), subject:'', due:isYmd(it.due) ? it.due : '', time:'', done:0,
      memo:'Discord・ショートカットから', subs:[], photos:[], pri:1, how:'', url:'', mt:Date.now() });
    return '課題を1件追加';
  }
  if(it.kind === 'notice' && it.text){
    if(typeof notice_ === 'function') notice_(String(it.text).slice(0, 300), 'warn');
    return String(it.text).split('\n')[0].slice(0, 40);
  }
  if(it.kind === 'ai' && typeof gasAiApply === 'function') return gasAiApply(it);
  if(it.kind === 'arrive') return arriveAttend(ymd, min);
  if(it.kind === 'leave'){
    S.transitLog = (S.transitLog || []).filter(function(r){ return r.date !== ymd; });
    var cls = schoolClassesForDate(ymd);
    S.transitLog.push({ date:ymd, at:pad(d.getHours()) + ':' + pad(d.getMinutes()), min:null,
      target:cls.length ? minutesOf(S.commute.periods[cls[0].period - 1]) : null, nowMin:min });
    if(S.transitLog.length > 120) S.transitLog = S.transitLog.slice(-120);
    touch('transitLog');
    return '出発を' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + 'で記録';
  }
  if(it.kind === 'memo' && it.text){
    S.notes.push({ id:uid('nt'), title:'ショートカットのメモ', body:String(it.text), pinned:0, checks:[], photos:[], link:null, ct:Number(it.at) || Date.now(), mt:Date.now() });
    return 'メモを1件追加';
  }
  return '';
}
/* 学校に着いた：まだ記録していない今日の授業に、出席（始まったあとなら遅刻）をつける */
function arriveAttend(ymd, min){
  if(!linkPrefs().arrive) return '';
  var cls = schoolClassesForDate(ymd), marked = [];
  cls.forEach(function(c){
    var st = minutesOf(S.commute.periods[c.period - 1]), en = minutesOf(S.commute.ends[c.period - 1]);
    if((S.attendLog[c.name] || []).some(function(x){ return x.date === ymd; })) return;
    if(en != null && min > en) return;                    /* 着いたときには終わっていた授業はつけない */
    var st2 = (st != null && min > st + 5) ? '遅' : '出';
    setAttend(c.name, ymd, st2);
    marked.push(c.period + '限' + (st2 === '遅' ? '（遅刻）' : ''));
  });
  return marked.length ? '出席を記録：' + marked.join('・') : '';
}

/* ============================== ウィジェット・目覚ましのまとめ ============================== */
function alarmPlan(){
  var p = linkPrefs();
  var d = shiftDate(today(), new Date().getHours() < 3 ? 0 : 1);
  var cls = schoolClassesForDate(d);
  if(!cls.length){
    var free = /^\d{1,2}:\d{2}$/.test(p.alarmFree || '') ? p.alarmFree : '';
    return { date:d, time:free, label:free ? '授業のない日' : '', hour:free ? toNum(free.split(':')[0]) : null, minute:free ? toNum(free.split(':')[1]) : null };
  }
  var dep = departureFor(cls[0].period);
  var leave = dep ? minutesOf(dep.leave) : null;
  if(leave == null) return { date:d, time:'', label:'' };
  var wake = Math.max(0, leave - (toNum(p.prep) || 60));
  return { date:d, time:hhmmOf(wake), hour:Math.floor(wake / 60), minute:wake % 60,
           label:cls[0].period + '限 ' + shortName(cls[0].name) + '（' + dep.leave + 'に出発）' };
}
function buildSummary(){
  var td = today(), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  var lines = [];
  classesForDate(td).filter(function(c){ return !c.off; }).forEach(function(c){
    var en = minutesOf(S.commute.ends[c.period - 1]);
    if(en != null && en < nowMin) return;
    lines.push(c.period + '限 ' + shortName(c.name) + (c.room ? '（' + c.room + '）' : ''));
  });
  var items = normItems().filter(function(x){ return x.date === td && x.src !== 'cls' && !(x.src === 'task' && x.done); });
  items.slice(0, 4).forEach(function(x){ lines.push((x.time ? x.time + ' ' : '') + x.title); });
  var due = S.tasks.filter(function(t){ return !t.done && isYmd(t.due) && t.due >= td && daysFromToday(t.due) <= 3; })
    .sort(function(a, b){ return a.due.localeCompare(b.due); });
  if(due.length) lines.push('締切：' + due.slice(0, 2).map(function(t){ return t.title + '（' + ymdLabel(t.due) + '）'; }).join('、'));
  var b = (typeof budget === 'function') ? budget() : null;
  var nextItem = normItems().filter(function(x){ return isYmd(x.date) && x.date > td && !(x.src === 'task' && x.done) && x.src !== 'cls'; })
    .sort(function(a, b2){ return a.date.localeCompare(b2.date); })[0];
  /* 明日（Discordで「明日の予定は？」と聞かれたとき用） */
  var tm = shiftDate(td, 1), tlines = [];
  classesForDate(tm).filter(function(c){ return !c.off; }).forEach(function(c){ tlines.push(c.period + '限 ' + shortName(c.name) + (c.room ? '（' + c.room + '）' : '')); });
  normItems().filter(function(x){ return x.date === tm && x.src !== 'cls' && !(x.src === 'task' && x.done); }).slice(0, 5)
    .forEach(function(x){ tlines.push((x.time ? x.time + ' ' : '') + x.title); });
  if(typeof morningItems === 'function'){ var mi = morningItems(tm); if(mi.length) tlines.push('持ち物：' + mi.join('・')); }
  var s0 = {
    at: Date.now(),
    title: (now.getMonth() + 1) + '/' + now.getDate() + '（' + WDAY[now.getDay()] + '）',
    lines: lines.slice(0, 8),
    next: nextItem ? { date:nextItem.date, title:nextItem.title } : null,
    money: b ? '自由に使えるお金 ' + yen(b.free) : '',
    chara: (typeof charaLevel === 'function' && charaLevel() > 0) ? charaNow().name + '「' + charaLine('greet') + '」' : '',
    alarm: alarmPlan(),
    tomorrow: { title:ymdLabel(tm), lines:tlines.slice(0, 10) },
    study: (typeof ankiDueList === 'function') ? { due:ankiDueList('').length, today:ankiCountOn(td), streak:ankiStreak() } : null
  };
  return (typeof kmSummaryAdd === 'function') ? kmSummaryAdd(s0) : s0;
}
async function summaryPush(force){
  if(!gasReady() || !shortKey()) return;
  var s = buildSummary();
  var sig = hash53(canon(Object.assign({}, s, { at:0, chara:'' })));
  if(!force && sig === LINKS.sumSig && Date.now() - LINKS.sumAt < 3 * 3600000) return;
  try{
    await gasCall('summaryPut', { summary:s });
    LINKS.sumSig = sig; LINKS.sumAt = Date.now();
  }catch(e){ logErr('ウィジェット', e.message); }
}
/* Scriptable（無料アプリ）に貼るウィジェットのプログラム */
function scriptableCode(){
  return [
    '// くらしの手帳ウィジェット（Scriptable用）',
    'const URL = ' + JSON.stringify(shortUrl('widget')) + ';',
    'const w = new ListWidget();',
    'w.backgroundGradient = (() => { const g = new LinearGradient(); g.colors = [new Color("#FCE4EC"), new Color("#EDE7F6")]; g.locations = [0, 1]; return g; })();',
    'w.setPadding(12, 14, 12, 14);',
    'try {',
    '  const d = await new Request(URL).loadJSON();',
    '  const t = w.addText("くらしの手帳 " + (d.title || "")); t.font = Font.boldSystemFont(13); t.textColor = new Color("#4A2B38");',
    '  w.addSpacer(4);',
    '  const max = config.widgetFamily === "large" ? 8 : config.widgetFamily === "medium" ? 4 : 3;',
    '  (d.lines || ["予定はありません"]).slice(0, max).forEach(s => { const x = w.addText(s); x.font = Font.systemFont(12); x.textColor = new Color("#4A2B38"); x.lineLimit = 1; });',
    '  if (d.money && config.widgetFamily !== "small") { w.addSpacer(4); const m = w.addText(d.money); m.font = Font.systemFont(11); m.textColor = new Color("#9B7B87"); }',
    '  if (d.chara && config.widgetFamily === "large") { w.addSpacer(6); const c = w.addText(d.chara); c.font = Font.italicSystemFont(11); c.textColor = new Color("#9B7B87"); }',
    '} catch (e) {',
    '  const x = w.addText("読みこめませんでした"); x.font = Font.systemFont(12);',
    '}',
    'w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);',
    'if (config.runsInWidget) Script.setWidget(w); else w.presentMedium();',
    'Script.complete();'
  ].join('\n');
}

/* ============================== Google ToDoリスト ============================== */
function tasksPayload(){
  return S.tasks.map(function(t){
    return { k:t.gk || ('tk-' + t.id), title:t.title || '', done:t.done ? 1 : 0, due:isYmd(t.due) ? t.due : '',
             notes:[t.subject ? '科目：' + t.subject : '', t.memo || ''].filter(Boolean).join('\n').slice(0, 1500), mt:Number(t.mt) || 0 };
  });
}
async function tasksSync(manual){
  if(!gasReady() || LINKS.tasksBusy) return;
  if(!linkPrefs().tasks && !manual) return;
  LINKS.tasksBusy = true;
  try{
    var loops = 0, r, got = 0;
    do{
      r = await gasCall('tasksSync', { items:tasksPayload() });
      got += tasksApply(r);
      loops++;
    }while(r.remaining > 0 && loops < 8);
    GAS.tasksAt = Date.now(); saveGas();
    if(got){
      S.cloud = S.cloud || {};
      S.cloud.gtasks = { at:Date.now(), by:DEV.id, n:S.tasks.length, mt:Date.now() };
      touch('cloud');
      commit();
    }
    if(manual) toast('Google ToDoリストと同期しました' + (got ? '（' + got + '件を反映）' : ''));
  }catch(e){
    logErr('Google ToDo', e.message);
    if(manual) toast('同期できませんでした：' + e.message, true);
  }finally{
    LINKS.tasksBusy = false;
  }
}
function tasksApply(r){
  var n = 0, now = Date.now();
  var byKey = {};
  S.tasks.forEach(function(t){ byKey[t.gk || ('tk-' + t.id)] = t; });
  (r.changes || []).forEach(function(c){
    var t = byKey[c.k];
    if(!t) return;
    if(c.deleted){ removeItem('tasks', t.id); n++; return; }
    t.title = c.title || t.title;
    t.done = c.done ? 1 : 0;
    t.due = c.due || '';
    var memo = String(c.notes || '').replace(/^科目：.*(\n|$)/, '');
    if(memo !== (t.memo || '')) t.memo = memo;
    t.mt = now; n++;
  });
  (r.created || []).forEach(function(c){
    if(byKey[c.k]) return;
    S.tasks.push({ id:uid('tk'), gk:c.k, title:c.title, subject:'', due:c.due || '', time:'', done:c.done ? 1 : 0,
      memo:c.notes || '', subs:[], photos:[], pri:1, how:'', url:'', mt:now });
    n++;
  });
  return n;
}

/* ============================== 場所（学校にいるか） ============================== */
function geoNow(){
  return new Promise(function(res, rej){
    if(!navigator.geolocation){ rej(new Error('この端末では位置情報が使えません')); return; }
    navigator.geolocation.getCurrentPosition(function(p){ res({ lat:p.coords.latitude, lng:p.coords.longitude, acc:p.coords.accuracy }); },
      function(e){ rej(new Error(e.code === 1 ? '位置情報が許可されていません（設定で許可してください）' : '場所がわかりませんでした')); },
      { enableHighAccuracy:true, timeout:15000, maximumAge:60000 });
  });
}
function geoDist(a, b){
  var R = 6371000, r = Math.PI / 180;
  var dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
async function placeCheck(silent){
  var pl = linkPrefs().place;
  if(!pl){ if(!silent) toast('先に設定で学校の場所を登録してください', true); return null; }
  try{
    var here = await geoNow();
    var dist = geoDist(here, pl), at = dist <= (toNum(pl.r) || 300) + Math.min(200, here.acc || 0);
    LINKS.placeMsg = at ? '学校にいます（約' + dist + 'm）' : '学校から約' + (dist >= 1000 ? (Math.round(dist / 100) / 10) + 'km' : dist + 'm') + 'はなれています';
    if(at && linkPrefs().placeAuto){
      var d = new Date(), m = arriveAttend(today(), d.getHours() * 60 + d.getMinutes());
      if(m){ LINKS.placeMsg += '。' + m; commit(); }
    }
    if(!silent) toast(LINKS.placeMsg);
    if(!isTyping()) render();
    return at;
  }catch(e){
    LINKS.placeMsg = e.message;
    if(!silent) toast(e.message, true);
    return null;
  }
}
function placeCard(){
  var pl = linkPrefs().place;
  if(!pl) return '';
  return '<div class="bn blue"><span class="ic">📍</span><span class="grow">'+(LINKS.placeMsg ? esc(LINKS.placeMsg) : '学校にいるか調べられます（位置はこの場で使うだけで、記録しません）')+'</span>'+
    '<button class="mini" data-act="place-check">調べる</button></div>';
}

/* ============================== 共有 ============================== */
async function shareText(title, text){
  var body = String(text || '').slice(0, 4000);
  try{
    if(navigator.share){ await navigator.share({ title:title || 'くらしの手帳', text:body }); return; }
  }catch(e){ if(e && e.name === 'AbortError') return; }
  try{ await navigator.clipboard.writeText((title ? title + '\n' : '') + body); toast('コピーしました（貼り付けて送れます）'); }
  catch(e2){ toast('共有できませんでした', true); }
}
function shareItemText(src, id){
  var x = normItems().filter(function(z){ return z.src === src && z.id === id; })[0];
  if(!x) return '';
  var f = findOne(src, id), o = f ? f.obj : {};
  return [kindOf(src).name + '：' + x.title, ymdLabel(x.date) + (x.time ? ' ' + x.time : ''), o.subject ? '科目：' + o.subject : '',
          o.room ? '場所：' + o.room : '', o.memo ? o.memo : ''].filter(Boolean).join('\n');
}
function shareDayText(ymd){
  var lines = [ymdLabel(ymd) + 'の予定'];
  classesForDate(ymd).filter(function(c){ return !c.off; }).forEach(function(c){
    lines.push('・' + c.period + '限 ' + c.name + (c.room ? '（' + c.room + '）' : ''));
  });
  normItems().filter(function(x){ return x.date === ymd && x.src !== 'cls'; }).forEach(function(x){
    lines.push('・' + (x.time ? x.time + ' ' : '') + x.title);
  });
  if(lines.length === 1) lines.push('予定はありません');
  return lines.join('\n');
}

/* ============================== 設定画面 ============================== */
function copyBtn(label, text){
  return '<button class="mini" data-act="link-copy" data-text="'+esc(text)+'">'+esc(label)+'</button>';
}
function linksSettings(){
  var p = linkPrefs();
  if(!gasReady()){
    return '<div class="bn amber"><span class="ic">!</span><span>先に「Google連携」をつないでください。ショートカットやウィジェットは、Google連携の橋わたしを通して動きます。</span></div>';
  }
  var h = '';
  if(!shortKey()){
    return h + '<p class="note" style="margin-top:0">ショートカット用の<b>短い合言葉</b>を作ると、下の連携が使えるようになります（この合言葉では、今日のまとめを読むことと、記録を届けることしかできません）。</p>'+
      '<button class="btn" data-act="link-key">短い合言葉を作る</button>';
  }
  var ex = function(t){ return '<code class="urlbox">'+esc(t)+'</code>'; };
  h += '<div class="row"><div class="grow s">短い合言葉</div><div class="t num">'+esc(shortKey().slice(0, 6))+'…</div>'+
    '<button class="mini" data-act="link-key">作り直す</button></div>'+
    '<div class="pillrow"><button class="mini" data-act="inbox-pull">届いた記録を今すぐ取りこむ</button><button class="mini" data-act="summary-push">まとめを今すぐ送る</button></div>';

  /* 目覚まし */
  var al = alarmPlan();
  h += '<h3 class="lk">⏰ 明日の1限に合わせて目覚まし</h3>'+
    '<p class="note" style="margin-top:0">いまの計算：<b>'+(al.time ? ymdLabel(al.date)+' '+al.time+'に起きる' : ymdLabel(al.date)+'は目覚ましなし')+'</b>'+(al.label ? '（'+esc(al.label)+'）' : '')+'</p>'+
    '<div class="pair" style="margin-bottom:8px"><div><label class="f" for="lk_prep">出発の何分前に起きる</label><input id="lk_prep" inputmode="numeric" value="'+toNum(p.prep)+'"></div>'+
    '<div><label class="f" for="lk_free">授業のない日（空ならなし）</label><input id="lk_free" placeholder="8:30" value="'+esc(p.alarmFree || '')+'"></div></div>'+
    '<button class="btn ghost" data-act="link-alarm-save">保存</button>'+
    '<ol class="steps"><li>ショートカットアプリ →「オートメーション」→「＋」→「時刻」（毎日 21:00）→「すぐに実行」</li>'+
    '<li>アクション「URLの内容を取得」に下のURLを入れる '+copyBtn('URLをコピー', shortUrl('alarm'))+'</li>'+
    '<li>「辞書の値を取得」で <b>time</b> を取り出す</li>'+
    '<li>「もし」<b>time</b> に値がある →「アラームを作成」（時刻に <b>time</b>、ラベル「くらしの手帳」）</li></ol>';

  /* 着いたら出席 */
  h += '<h3 class="lk">🏫 学校に着いたら出席を記録</h3>'+
    '<div class="pillrow"><button data-act="link-pref" data-k="arrive" data-v="1" class="'+(p.arrive?'on':'')+'">記録する</button>'+
    '<button data-act="link-pref" data-k="arrive" data-v="0" class="'+(!p.arrive?'on':'')+'">記録しない</button></div>'+
    '<ol class="steps"><li>オートメーション →「＋」→「到着」→ 場所に大学を選ぶ →「すぐに実行」</li>'+
    '<li>アクション「URLの内容を取得」に '+copyBtn('URLをコピー', shortUrl('in', '&kind=arrive'))+'</li>'+
    '<li>家を出るときも同じように「出発」で '+copyBtn('出発のURL', shortUrl('in', '&kind=leave'))+'</li></ol>'+
    '<p class="note">着いた時刻より前に始まった授業は「遅刻」、もう終わった授業はつけません。まちがっていたら授業タブで直せます。</p>';

  /* Apple Pay */
  h += '<h3 class="lk">💳 Apple Pay・Suicaで払ったら家計簿に記録（iOS 17以降）</h3>'+
    '<ol class="steps"><li>オートメーション →「＋」→「ウォレット」→ カードを選ぶ →「すぐに実行」</li>'+
    '<li>アクション「テキスト」に次のURLを貼り、<b>金額</b>・<b>加盟店</b>のところを「ショートカットの入力」の <b>金額</b>・<b>加盟店</b> に置きかえる '+copyBtn('URLをコピー', shortUrl('in', '&kind=pay&amount=金額&shop=加盟店&card=ApplePay'))+'</li>'+
    '<li>「URLの内容を取得」でそのテキストを開く</li></ol>'+
    '<p class="note">アプリを開いたときに家計簿へ取りこまれます（同じ記録は二重に入りません）。</p>';

  /* ウィジェット */
  h += '<h3 class="lk">📱 ホーム画面ウィジェット（Scriptable）</h3>'+
    '<ol class="steps"><li>App Storeで無料アプリ「Scriptable」を入れる</li>'+
    '<li>Scriptableで「＋」→ 下のプログラムを貼り付けて保存 '+copyBtn('プログラムをコピー', scriptableCode())+'</li>'+
    '<li>ホーム画面を長押し →「＋」→ Scriptable → 大きさを選ぶ → ウィジェットを長押しして「Script」に今のプログラムを選ぶ</li></ol>'+
    '<p class="note">中身はアプリを開いたとき・予定を直したときに新しくなります（ウィジェットは30分ごとに読みこみ直します）。</p>';

  /* メモ */
  h += '<h3 class="lk">📝 Siri・ショートカットからメモ</h3>'+
    '<p class="note" style="margin-top:0">「テキストを入力」→ そのテキストをURLの <b>メモ</b> に置きかえて「URLの内容を取得」。 '+copyBtn('URLをコピー', shortUrl('in', '&kind=memo&text=メモ'))+'</p>';

  /* Goodnotes のページを送る（共有ボタンから） */
  h += '<h3 class="lk">📓 Goodnotesのページを送る（AIが読んで、暗記カード・メモ・課題の候補に）</h3>'+
    (toNum(GAS.ver) >= 3 ? '' : '<div class="bn amber"><span class="ic">!</span><span>橋わたしを新しい版（v3）にすると使えます。</span></div>')+
    '<ol class="steps"><li>ショートカットアプリ →「＋」→ 名前を「くらしの手帳に送る」にする → 右上の ⓘ →「共有シートに表示」をオン（受け取る種類は「イメージ」と「PDF」）</li>'+
    '<li>アクション「イメージのサイズを変更」（幅 1600）→「イメージを変換」（JPEG）→「Base64エンコード」</li>'+
    '<li>アクション「URLの内容を取得」：URLは '+copyBtn('URLをコピー', String(GAS.url || ''))+'、方法は <b>POST</b>、本文は <b>JSON</b> にして、次の4つを足す：'+
      '<br><b>k</b>＝'+copyBtn('短い合言葉をコピー', shortKey())+'　<b>action</b>＝in　<b>kind</b>＝img　<b>data</b>＝（「Base64エンコード」の結果）</li>'+
    '<li>Goodnotesで送りたいページを開いて、共有 →「画像として書き出す」→「くらしの手帳に送る」</li></ol>'+
    '<p class="note">⚠️ 実習記録など、患者さんの情報があるページは送らないでください。AIは10分ごとに読みます。「AIのカギ」を預けていないと読めません（設定 › ほかの端末・Gmail・AIの読み取り）。</p>';
  return h;
}
function tasksSettings(){
  var p = linkPrefs(), st = { at:GAS.tasksAt, by:DEV.id };
  if(!gasReady()) return '<p class="note" style="margin-top:0">先に「Google連携」をつないでください。</p>';
  return '<div class="pillrow"><button data-act="link-pref" data-k="tasks" data-v="1" class="'+(p.tasks?'on':'')+'">自動で同期する</button>'+
    '<button data-act="link-pref" data-k="tasks" data-v="0" class="'+(!p.tasks?'on':'')+'">同期しない</button></div>'+
    '<div class="row"><div class="grow s">最後の同期</div><div class="t num">'+(st.at ? agoText(st.at)+'（'+esc(deviceName(st.by))+'）' : 'まだ')+'</div>'+
    '<button class="mini" data-act="tasks-sync">今すぐ</button></div>'+
    '<p class="note">Google ToDoリストに「くらしの手帳」リストを作り、課題を入れます。<b>どちらで完了にしても・直しても・消しても</b>、もう一方にそろいます。Google側で足した課題も、こちらに入ります。</p>'+
    '<p class="note">はじめて使うときは、Google連携の「プログラムをコピー」で新しいプログラムと <b>appsscript.json</b> を貼り直してください（手順は Google連携の欄）。</p>';
}
function placeSettings(){
  var p = linkPrefs(), pl = p.place;
  return (pl ? '<div class="row"><div class="grow"><div class="t">学校の場所を登録ずみ</div><div class="s">半径 '+(toNum(pl.r) || 300)+'m</div></div>'+
      '<button class="mini" data-act="place-clear">消す</button></div>' : '<p class="note" style="margin-top:0">学校にいるときに下のボタンを押すと、その場所を「学校」として覚えます。</p>')+
    '<div class="pillrow"><button class="mini" data-act="place-set">いる場所を学校にする</button>'+(pl ? '<button class="mini" data-act="place-check">いま学校にいるか調べる</button>' : '')+'</div>'+
    (pl ? '<div class="pillrow"><button data-act="link-pref" data-k="placeAuto" data-v="1" class="'+(p.placeAuto?'on':'')+'">学校にいたら出席を記録</button>'+
      '<button data-act="link-pref" data-k="placeAuto" data-v="0" class="'+(!p.placeAuto?'on':'')+'">記録しない</button></div>' : '')+
    (LINKS.placeMsg ? '<p class="note">'+esc(LINKS.placeMsg)+'</p>' : '')+
    '<p class="note">いまの位置は、調べるときにその場で使うだけで、保存も送信もしません（保存するのは学校の場所だけです）。</p>';
}
function linksAction(act, t){
  if(act === 'link-copy'){
    var tx = t.dataset.text || '';
    navigator.clipboard.writeText(tx).then(function(){ toast('コピーしました'); }, function(){ toast('コピーできませんでした', true); });
    return true;
  }
  if(act === 'link-key'){
    if(shortKey() && !confirm('作り直すと、今までのショートカットやウィジェットのURLが使えなくなります。作り直しますか？')) return true;
    linksMakeKey().then(function(){ toast('短い合言葉を作りました'); summaryPush(true); }, function(e){ toast('作れませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'link-pref'){
    var patch = {}; patch[t.dataset.k] = toNum(t.dataset.v);
    linkPrefSet(patch); commit();
    if(t.dataset.k === 'tasks' && patch.tasks) tasksSync(true);
    return true;
  }
  if(act === 'link-alarm-save'){
    var free = val('lk_free').trim();
    if(free && !/^\d{1,2}:\d{2}$/.test(free)){ toast('時刻は 8:30 の形で入れてください', true); return true; }
    linkPrefSet({ prep:Math.max(10, Math.min(240, toNum(val('lk_prep')) || 60)), alarmFree:free });
    commit(); summaryPush(true); toast('保存しました'); return true;
  }
  if(act === 'inbox-pull'){ inboxPull(true); return true; }
  if(act === 'summary-push'){ summaryPush(true).then(function(){ toast('送りました'); }); return true; }
  if(act === 'tasks-sync'){ tasksSync(true); return true; }
  if(act === 'place-set'){
    geoNow().then(function(here){
      linkPrefSet({ place:{ lat:Math.round(here.lat * 1e5) / 1e5, lng:Math.round(here.lng * 1e5) / 1e5, r:300 } });
      commit(); toast('ここを学校の場所にしました');
    }, function(e){ toast(e.message, true); });
    return true;
  }
  if(act === 'place-clear'){ linkPrefSet({ place:null, placeAuto:0 }); LINKS.placeMsg = ''; commit(); return true; }
  if(act === 'place-check'){ placeCheck(false); return true; }
  if(act === 'share-day'){ shareText('予定', shareDayText(t.dataset.d || today())); return true; }
  if(act === 'share-item'){ shareText('予定', shareItemText(t.dataset.src, t.dataset.id)); return true; }
  if(act === 'share-note'){
    var n = S.notes.filter(function(x){ return x.id === t.dataset.id; })[0];
    if(n) shareText(n.title || 'メモ', [n.body || ''].concat((n.checks || []).map(function(c){ return (c.done ? '☑ ' : '☐ ') + c.text; })).join('\n'));
    return true;
  }
  if(act === 'share-chat'){
    var m = roomMsgs()[toNum(t.dataset.i)];
    if(m) shareText('AIの答え', m.text);
    return true;
  }
  return false;
}

/* 起動したとき・画面にもどったとき・ときどき */
function linksTick(){
  if(!gasReady() || document.hidden) return;
  /* 半日に1回、橋わたしの様子（新しいプログラムか・5分ごとの確認が動いているか）を確かめる */
  if(Date.now() - (Number(GAS.pingAt) || 0) > 12 * 3600000){
    GAS.pingAt = Date.now(); saveGas();
    gasCall('ping').then(function(r){
      GAS.ver = r.ver || 0; GAS.trigger = r.trigger ? 1 : 0; GAS.ai = r.ai ? 1 : 0; GAS.err = r.err || null; saveGas();
      if(typeof gasUrlShare === 'function'){ gasUrlShare(); persist(); }
      if(r.ver && !r.trigger) return gasCall('setup').then(function(){ GAS.trigger = 1; saveGas(); });
    })['catch'](function(e){ logErr('Google連携', e.message); });
  }
  inboxPull(false);
  summaryPush(false);
  tasksSync(false);
}
setTimeout(linksTick, 6000);
setInterval(linksTick, 5 * 60 * 1000);
document.addEventListener('visibilitychange', function(){ if(!document.hidden) setTimeout(linksTick, 1500); });

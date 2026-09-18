/* くらしの手帳：通知（スマホのプッシュ通知・Discord） */
/* ============================== 通知 ==============================
   ・アプリが「これから7日ぶんの通知の予定」を作り、橋わたし（Apps Script）に預ける。
   ・橋わたしが5分ごとに時刻を確かめて、Firebase Cloud Messaging でスマホに、または Discord に送る。
   ・アプリを閉じていても届く。iPhoneは「ホーム画面に追加」したアプリで受け取れる（iOS 16.4以降）。 */
var NOTIFY = { sig:'', at:0, busy:false, timer:null, msg:'' };
var PUSH_KEY = KEY + ':push';
var PUSH = (function(){
  var o = null;
  try{ o = JSON.parse(localStorage.getItem(PUSH_KEY) || 'null'); }catch(e){}
  return Object.assign({ token:'', at:0, err:'' }, o || {});
})();
function savePush(){ try{ localStorage.setItem(PUSH_KEY, JSON.stringify(PUSH)); }catch(e){} }
function notifyPrefs(){
  return Object.assign({ push:1, discord:0, dl3:1, dl1:1, dl0:1, dlTime:'20:00', dlMorning:'07:30',
    exam:1, cls:1, clsLead:10, quiet:1, vapid:'' }, S.ui.notify || {});
}
function notifySet(patch){ S.ui.notify = Object.assign({}, notifyPrefs(), patch); touch('ui'); }
function pushSupported(){
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
}
function isStandalone(){
  try{ return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }catch(e){ return false; }
}

/* ===== 通知の予定を作る ===== */
function notifyAt(ymd, hhmm){
  var a = ymd.split('-'), m = minutesOf(hhmm);
  if(m == null) return 0;
  return new Date(+a[0], +a[1] - 1, +a[2], Math.floor(m / 60), m % 60).getTime();
}
function notifyJobs(){
  var p = notifyPrefs(), now = Date.now(), end = now + 7 * 86400000, out = [];
  if(!p.push && !p.discord) return out;
  var add = function(id, at, title, body){
    if(!at || at <= now || at > end) return;
    out.push({ id:id, at:at, title:title, body:body || '', url:'./', push:p.push ? 1 : 0, discord:p.discord ? 1 : 0 });
  };
  /* 締切の段階通知 */
  S.tasks.forEach(function(t){
    if(t.done || !isYmd(t.due)) return;
    var name = (t.title || '課題') + (t.subject ? '（' + shortName(t.subject) + '）' : '');
    var tm = t.time ? '（' + t.time + 'まで）' : '';
    if(p.dl3) add('d3-' + t.id + '-' + t.due, notifyAt(shiftDate(t.due, -3), p.dlTime), '締切まであと3日', name + '：' + ymdLabel(t.due) + tm);
    if(p.dl1) add('d1-' + t.id + '-' + t.due, notifyAt(shiftDate(t.due, -1), p.dlTime), '明日が締切です', name + tm);
    if(p.dl0) add('d0-' + t.id + '-' + t.due, notifyAt(t.due, p.dlMorning), '今日が締切です', name + tm);
  });
  /* テスト */
  if(p.exam) S.exams.forEach(function(x){
    if(!isYmd(x.date)) return;
    var kn = kindOf(x.kind === 'quiz' || x.kind === 'kousa' ? x.kind : 'exam').name;
    var nm = (x.subject ? shortName(x.subject) : '') + (x.title ? ' ' + x.title : '');
    add('e1-' + x.id + '-' + x.date, notifyAt(shiftDate(x.date, -1), p.dlTime), '明日は' + kn, nm + (x.time ? '（' + x.time + '〜）' : ''));
    add('e0-' + x.id + '-' + x.date, notifyAt(x.date, p.dlMorning), '今日は' + kn, nm + (x.time ? '（' + x.time + '〜）' : '') + (x.room ? '・' + x.room : ''));
  });
  /* 授業の前 */
  if(p.cls){
    for(var i = 0; i < 7; i++){
      var ymd = shiftDate(today(), i);
      classesForDate(ymd).filter(function(c){ return !c.off; }).forEach(function(c){
        var st = S.commute.periods[c.period - 1];
        var at = notifyAt(ymd, st) - (toNum(p.clsLead) || 10) * 60000;
        add('c-' + ymd + '-' + c.period + '-' + hash53(c.name).slice(0, 6), at, (toNum(p.clsLead) || 10) + '分後に' + c.period + '限',
            c.name + (c.room ? '（' + c.room + '）' : '') + (c.web || c.online ? '・家で受講' : '') + '　' + st + '〜');
      });
    }
  }
  /* 夜中は送らない（6:00〜23:30だけ） */
  if(p.quiet){
    out = out.filter(function(j){ var d = new Date(j.at), m = d.getHours() * 60 + d.getMinutes(); return m >= 360 && m <= 1410; });
  }
  out.sort(function(a, b){ return a.at - b.at || (a.id < b.id ? -1 : 1); });
  return out.slice(0, 300);
}
async function notifyPush(force){
  if(!gasReady() || NOTIFY.busy) return;
  var p = notifyPrefs();
  if(!p.push && !p.discord && !force) return;
  var jobs = notifyJobs();
  var sig = hash53(canon(jobs));
  if(!force && sig === NOTIFY.sig && Date.now() - NOTIFY.at < 6 * 3600000) return;
  NOTIFY.busy = true;
  try{
    await gasCall('jobsPut', { jobs:jobs });
    NOTIFY.sig = sig; NOTIFY.at = Date.now(); NOTIFY.msg = ''; NOTIFY.n = jobs.length;
    try{ localStorage.setItem(KEY + ':notifyAt', JSON.stringify({ at:NOTIFY.at, n:jobs.length })); }catch(e){}
  }catch(e){
    NOTIFY.msg = e.message;
    logErr('通知', '予定を送れませんでした：' + e.message);
  }finally{
    NOTIFY.busy = false;
  }
}
/* 予定が変わったら、少しあとで通知の予定・ウィジェットのまとめも送り直す */
function linksSoon(){
  clearTimeout(NOTIFY.timer);
  NOTIFY.timer = setTimeout(function(){
    notifyPush(false);
    if(typeof summaryPush === 'function') summaryPush(false);
  }, 20000);
}
(function(){
  if(typeof gasCalSoon !== 'function') return;
  var orig = gasCalSoon;
  gasCalSoon = function(){ orig(); linksSoon(); };
})();
setTimeout(function(){ notifyPush(false); }, 9000);
setInterval(function(){ if(!document.hidden) notifyPush(false); }, 60 * 60 * 1000);

/* ===== この端末で受け取る ===== */
var fcmLoad = null;
function loadMessaging(){
  if(fcmLoad) return fcmLoad;
  fcmLoad = (async function(){
    var fa = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    var fm = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');
    var cfg = parseFbConfig(DEFAULT_FB);
    var app = (fa.getApps().filter(function(a){ return a.name === 'kurashi-msg'; })[0]) || fa.initializeApp(cfg, 'kurashi-msg');
    if(fm.isSupported && !(await fm.isSupported())) throw new Error('この端末・ブラウザでは通知を受け取れません');
    return { fm:fm, messaging:fm.getMessaging(app) };
  })();
  fcmLoad['catch'](function(){ fcmLoad = null; });
  return fcmLoad;
}
async function pushEnable(){
  if(TEST_MODE){ toast('テストモードでは通知を登録しません', true); return; }
  if(!pushSupported()){
    toast(/iPhone|iPad/.test(navigator.userAgent) && !isStandalone()
      ? 'iPhoneでは、ホーム画面に追加したアプリから開くと通知を受け取れます' : 'この端末では通知を受け取れません', true);
    return;
  }
  var p = notifyPrefs();
  if(!p.vapid){ toast('先に「ウェブプッシュ証明書の鍵」を貼ってください', true); return; }
  if(!gasReady()){ toast('先にGoogle連携をつないでください', true); return; }
  try{
    var perm = await Notification.requestPermission();
    if(perm !== 'granted') throw new Error('通知が許可されませんでした（端末の設定で許可してください）');
    var reg = await navigator.serviceWorker.ready;
    var m = await loadMessaging();
    var token = await m.fm.getToken(m.messaging, { vapidKey:p.vapid, serviceWorkerRegistration:reg });
    if(!token) throw new Error('通知の鍵をもらえませんでした');
    await gasCall('pushRegister', { device:DEV.id, pushToken:token, name:DEV.name || '' });
    PUSH.token = token; PUSH.at = Date.now(); PUSH.err = ''; savePush();
    await notifyPush(true);
    toast('この端末で通知を受け取れるようにしました');
  }catch(e){
    PUSH.err = e.message; savePush();
    logErr('通知', e.message);
    toast('できませんでした：' + e.message, true);
  }
  render();
}
async function pushDisable(){
  try{
    if(gasReady()) await gasCall('pushRemove', { device:DEV.id });
    if(PUSH.token && !TEST_MODE){
      try{ var m = await loadMessaging(); await m.fm.deleteToken(m.messaging); }catch(e){}
    }
  }catch(e){ logErr('通知', e.message); }
  PUSH.token = ''; savePush();
  toast('この端末では受け取らないようにしました');
  render();
}

/* ===== 設定画面 ===== */
function notifySettings(){
  var p = notifyPrefs(), st = {};
  try{ st = JSON.parse(localStorage.getItem(KEY + ':notifyAt') || '{}') || {}; }catch(e){}
  var perm = (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported';
  var h = '';
  if(!gasReady()){
    return '<div class="bn amber"><span class="ic">!</span><span>通知は「Google連携」の橋わたしから送ります。先にGoogle連携をつないでください。</span></div>';
  }
  h += '<label class="f">送り先</label><div class="pillrow">'+
    '<button data-act="nt-set" data-k="push" data-v="'+(p.push ? 0 : 1)+'" class="'+(p.push?'on':'')+'">スマホに通知</button>'+
    '<button data-act="nt-set" data-k="discord" data-v="'+(p.discord ? 0 : 1)+'" class="'+(p.discord?'on':'')+'">Discordに通知</button></div>';
  h += '<label class="f">締切の知らせ</label><div class="pillrow">'+
    [['dl3','3日前'],['dl1','前日'],['dl0','当日の朝']].map(function(o){
      return '<button data-act="nt-set" data-k="'+o[0]+'" data-v="'+(p[o[0]] ? 0 : 1)+'" class="'+(p[o[0]]?'on':'')+'">'+o[1]+'</button>';
    }).join('')+
    '<button data-act="nt-set" data-k="exam" data-v="'+(p.exam ? 0 : 1)+'" class="'+(p.exam?'on':'')+'">テストも</button></div>'+
    '<div class="pair" style="margin-bottom:10px"><div><label class="f" for="nt_dl">3日前・前日の時刻</label><input id="nt_dl" value="'+esc(p.dlTime)+'"></div>'+
    '<div><label class="f" for="nt_mo">当日の朝の時刻</label><input id="nt_mo" value="'+esc(p.dlMorning)+'"></div></div>';
  h += '<label class="f">授業の前</label><div class="pillrow">'+
    '<button data-act="nt-set" data-k="cls" data-v="'+(p.cls ? 0 : 1)+'" class="'+(p.cls?'on':'')+'">'+(p.cls ? '知らせる' : '知らせない')+'</button>'+
    [5, 10, 15, 30].map(function(n){ return '<button data-act="nt-set" data-k="clsLead" data-v="'+n+'" class="'+(toNum(p.clsLead)===n?'on':'')+'">'+n+'分前</button>'; }).join('')+'</div>'+
    '<div class="pillrow"><button data-act="nt-set" data-k="quiet" data-v="'+(p.quiet ? 0 : 1)+'" class="'+(p.quiet?'on':'')+'">夜中（23:30〜6:00）は送らない</button></div>'+
    '<button class="btn ghost" data-act="nt-save">時刻を保存</button>';
  h += '<div class="row" style="margin-top:10px"><div class="grow s">通知の予定を送った</div><div class="t num">'+
    (st.at ? agoText(st.at)+'（'+(st.n||0)+'件）' : 'まだ')+'</div><button class="mini" data-act="nt-push">今すぐ送る</button></div>'+
    (NOTIFY.msg ? '<div class="msg ng">送れませんでした：'+esc(NOTIFY.msg)+'</div>' : '');

  /* スマホ */
  h += '<h3 class="lk">📲 この端末で受け取る</h3>';
  if(!pushSupported()){
    h += '<div class="bn amber"><span class="ic">!</span><span>'+
      (/iPhone|iPad/.test(navigator.userAgent) && !isStandalone()
        ? 'iPhone・iPadは、Safariの共有ボタン →「ホーム画面に追加」をして、<b>ホーム画面のアイコンから開く</b>と受け取れます（iOS 16.4以降）。'
        : 'このブラウザでは通知を受け取れません。')+'</span></div>';
  }else{
    h += '<div class="row"><div class="grow"><div class="t">'+(PUSH.token && perm === 'granted' ? '受け取っています' : '受け取っていません')+'</div>'+
      '<div class="s">通知の許可：'+({granted:'許可済み',denied:'許可されていません（端末の設定で許可）','default':'まだ'}[perm] || perm)+'</div></div>'+
      (PUSH.token ? '<button class="mini" data-act="nt-off">やめる</button>' : '')+'</div>'+
      (PUSH.err ? '<div class="msg ng">'+esc(PUSH.err)+'</div>' : '')+
      '<button class="btn" data-act="nt-on">'+(PUSH.token ? '登録し直す' : 'この端末で通知を受け取る')+'</button>';
  }
  h += '<div class="field" style="margin-top:10px"><label class="f" for="nt_vapid">ウェブプッシュ証明書の鍵（Firebase）</label>'+
    '<input id="nt_vapid" value="'+esc(p.vapid)+'" placeholder="B で始まる長い文字" autocomplete="off"></div>'+
    '<button class="btn ghost" data-act="nt-vapid">鍵を保存</button>'+
    '<ol class="steps"><li><a href="https://console.firebase.google.com/project/kurashi-59562/settings/cloudmessaging" target="_blank" rel="noopener">Firebaseの設定 › Cloud Messaging</a> を開く</li>'+
    '<li>いちばん下の「ウェブの構成」→「ウェブプッシュ証明書」→「鍵ペアを生成」</li>'+
    '<li>出てきた鍵をコピーして、上に貼って保存</li>'+
    '<li>Google連携の「プログラムをコピー」で、新しいプログラムと <b>appsscript.json</b> を貼り直し、デプロイを更新する</li>'+
    '<li>この端末で「通知を受け取る」→ 下の「テスト」で届くか確かめる</li></ol>';

  /* Discord */
  h += '<h3 class="lk">💬 Discord</h3>'+
    '<div class="field"><label class="f" for="nt_dc">DiscordのWebhook URL（この端末と橋わたしにだけ保存）</label>'+
    '<input id="nt_dc" type="password" placeholder="https://discord.com/api/webhooks/…" autocomplete="off"></div>'+
    '<div class="pillrow"><button class="mini" data-act="nt-dc-save">URLを保存</button><button class="mini" data-act="nt-dc-clear">Discordをやめる</button></div>'+
    '<p class="note">Discordのサーバー設定 › 連携サービス › ウェブフック で「新しいウェブフック」を作り、URLをコピーしてください。</p>';
  h += '<div class="pillrow" style="margin-top:8px"><button class="mini" data-act="nt-test" data-v="push">スマホにテスト</button>'+
    '<button class="mini" data-act="nt-test" data-v="discord">Discordにテスト</button></div>'+
    '<p class="note">届かないときは：iPhoneの設定 › 通知 › くらしの手帳 がオンか、Google連携の「つながるか試す」で「5分ごとの確認：動いている」になっているかを見てください。</p>';
  return h;
}
function notifyAction(act, t){
  if(act === 'nt-set'){
    var patch = {}; patch[t.dataset.k] = toNum(t.dataset.v);
    notifySet(patch); commit(); notifyPush(true); return true;
  }
  if(act === 'nt-save'){
    var a = val('nt_dl').trim(), b = val('nt_mo').trim();
    if(!/^\d{1,2}:\d{2}$/.test(a) || !/^\d{1,2}:\d{2}$/.test(b)){ toast('時刻は 20:00 の形で入れてください', true); return true; }
    notifySet({ dlTime:hhmmOf(minutesOf(a)), dlMorning:hhmmOf(minutesOf(b)) }); commit(); notifyPush(true); toast('保存しました'); return true;
  }
  if(act === 'nt-push'){ notifyPush(true).then(function(){ toast(NOTIFY.msg ? '送れませんでした' : '通知の予定を送りました', !!NOTIFY.msg); render(); }); return true; }
  if(act === 'nt-vapid'){
    var v = val('nt_vapid').trim();
    if(v && !/^[A-Za-z0-9_-]{60,120}$/.test(v)){ toast('鍵の形がちがうようです', true); return true; }
    notifySet({ vapid:v }); commit(); toast('保存しました'); return true;
  }
  if(act === 'nt-on'){ pushEnable(); return true; }
  if(act === 'nt-off'){ pushDisable(); return true; }
  if(act === 'nt-dc-save' || act === 'nt-dc-clear'){
    var url = act === 'nt-dc-clear' ? '' : val('nt_dc').trim();
    if(act === 'nt-dc-save' && !url){ toast('URLを入れてください', true); return true; }
    gasCall('discordSet', { url:url }).then(function(){
      notifySet({ discord:url ? 1 : 0 }); commit(); notifyPush(true);
      toast(url ? 'Discordに送るようにしました' : 'Discordをやめました');
    }, function(e){ toast('できませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'nt-test'){
    gasCall('notifyTest', { channel:t.dataset.v }).then(function(r){
      var res = r.result || {};
      if(t.dataset.v === 'discord'){
        toast(res.discord && res.discord.code < 300 ? 'Discordに送りました' : 'Discordに送れませんでした（URLを確かめてください）', !(res.discord && res.discord.code < 300));
      }else{
        var okN = (res.push || []).filter(function(x){ return x.code === 200; }).length;
        var bad = (res.push || []).filter(function(x){ return x.code !== 200; })[0];
        toast(okN ? okN + '台に送りました' : (bad ? '送れませんでした：' + bad.code + ' ' + String(bad.text || '').slice(0, 60) : '受け取る端末が登録されていません'), !okN);
        if(bad) logErr('通知', 'テスト：' + bad.code + ' ' + bad.text);
      }
    }, function(e){ toast('できませんでした：' + e.message, true); });
    return true;
  }
  return false;
}

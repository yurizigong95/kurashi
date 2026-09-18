/* くらしの手帳：運用（エラーの自動送信・表示の速さ・アップロードの確認・前の版にもどす・更新） */
var OPS_KEY = KEY + ':ops';
var OPS = (function(){
  var o = null;
  try{ o = JSON.parse(localStorage.getItem(OPS_KEY) || 'null'); }catch(e){}
  return Object.assign({ sentry:'', sentryOn:0 }, o || {});
})();
function saveOps(){ try{ localStorage.setItem(OPS_KEY, JSON.stringify(OPS)); }catch(e){} }

/* ============================== エラーを自動で集める（Sentry） ==============================
   Sentryの小さなプログラムは読みこまず、決まった形で直接送る。
   送るのは「どこで・どんなエラーか」と版・端末の種類だけ（予定やお金の中身は送らない）。 */
function sentryParse(dsn){
  var m = String(dsn || '').trim().match(/^https:\/\/([0-9a-f]+)@([a-z0-9.-]+\.sentry\.io)\/(\d+)$/i);
  if(!m) return null;
  return { key:m[1], host:m[2], project:m[3],
           url:'https://' + m[2] + '/api/' + m[3] + '/envelope/?sentry_key=' + m[1] + '&sentry_version=7' };
}
var sentryState = { sent:[], last:{} };
function sentryScrub(s){
  return String(s || '')
    .replace(/https?:\/\/\S+/g, '[URL]')
    .replace(/[A-Za-z0-9_-]{24,}/g, '[ID]')
    .replace(/\d{3,}/g, '#')
    .slice(0, 300);
}
function sentrySend(where, msg, level){
  if(!OPS.sentryOn || TEST_MODE) return;
  var d = sentryParse(OPS.sentry);
  if(!d) return;
  var now = Date.now();
  var text = sentryScrub(msg), key = where + '|' + text;
  if(sentryState.last[key] && now - sentryState.last[key] < 10 * 60000) return;
  sentryState.sent = sentryState.sent.filter(function(t){ return now - t < 3600000; });
  if(sentryState.sent.length >= 20) return;
  sentryState.sent.push(now); sentryState.last[key] = now;
  var id = '';
  for(var i = 0; i < 32; i++) id += Math.floor(Math.random() * 16).toString(16);
  var ev = {
    event_id:id, timestamp:now / 1000, platform:'javascript', level:level || 'error', logger:String(where || ''),
    message:{ formatted:'[' + where + '] ' + text }, release:'kurashi@' + APP_BUILD, environment:'production',
    tags:{ where:String(where || '').slice(0, 30), device:guessDeviceName(), standalone:(typeof isStandalone === 'function' && isStandalone()) ? '1' : '0' },
    user:{ id:DEV.id }
  };
  var body = JSON.stringify({ event_id:id, sent_at:new Date(now).toISOString() }) + '\n' +
             JSON.stringify({ type:'event' }) + '\n' + JSON.stringify(ev);
  try{ fetch(d.url, { method:'POST', body:body, keepalive:true })['catch'](function(){}); }catch(e){}
}
(function(){
  var orig = logErr;
  logErr = function(where, msg){
    orig(where, msg);
    try{ sentrySend(where, msg); }catch(e){}
  };
})();

/* ============================== 表示の速さ ============================== */
var perfStat = {};
var perfBoot = { ok:0 };
function perfKey(){
  var sub = appId === 'money' ? payTab : appId === 'cal' ? calTab : appId === 'today' ? todayTab : appId === 'risyu' ? risyuTab : '';
  return appId + (sub ? '/' + sub : '');
}
(function(){
  if(typeof render !== 'function' || !window.performance) return;
  var orig = render;
  render = function(){
    var t0 = performance.now();
    try{ return orig.apply(this, arguments); }
    finally{
      var ms = performance.now() - t0, k = perfKey();
      var s = perfStat[k] || (perfStat[k] = { n:0, sum:0, max:0, last:0 });
      s.n++; s.sum += ms; s.last = ms; if(ms > s.max) s.max = ms;
    }
  };
})();
var perfLong = { n:0, max:0 };
try{
  if(window.PerformanceObserver && PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.indexOf('longtask') >= 0){
    new PerformanceObserver(function(list){
      list.getEntries().forEach(function(e){ perfLong.n++; if(e.duration > perfLong.max) perfLong.max = e.duration; });
    }).observe({ type:'longtask', buffered:true });
  }
}catch(e){}
function perfStartup(){
  var o = {};
  try{
    var nav = performance.getEntriesByType('navigation')[0];
    if(nav){ o.dom = Math.round(nav.domContentLoadedEventEnd); o.load = Math.round(nav.loadEventEnd); o.size = nav.transferSize || 0; }
  }catch(e){}
  if(window.__kurashiReadyAt) o.ready = Math.round(window.__kurashiReadyAt);
  return o;
}
function perfWord(ms){ return ms < 50 ? '速い' : ms < 150 ? 'ふつう' : '重い'; }
function perfSettings(){
  var st = perfStartup();
  var rows = Object.keys(perfStat).map(function(k){ var s = perfStat[k]; return { k:k, n:s.n, avg:s.sum / s.n, max:s.max }; })
    .sort(function(a, b){ return b.avg - a.avg; });
  var name = function(k){
    var a = k.split('/');
    return (TITLES[a[0]] || a[0]) + (a[1] ? '・' + a[1] : '');
  };
  return '<div class="row"><div class="grow s">起動（画面が出るまで）</div><div class="t num">' + (st.ready ? st.ready + 'ms' : st.dom ? st.dom + 'ms' : '—') + '</div></div>' +
    (st.load ? '<div class="row"><div class="grow s">読みこみ完了</div><div class="t num">' + st.load + 'ms</div></div>' : '') +
    (perfLong.n ? '<div class="row"><div class="grow s">止まって見えた回数（50ms以上）</div><div class="t num">' + perfLong.n + '回（最長' + Math.round(perfLong.max) + 'ms）</div></div>' : '') +
    (rows.length ? '<table class="perft"><thead><tr><th>画面</th><th>回数</th><th>平均</th><th>最大</th><th>判定</th></tr></thead><tbody>' +
      rows.slice(0, 16).map(function(r){
        return '<tr><td>' + esc(name(r.k)) + '</td><td class="num">' + r.n + '</td><td class="num">' + Math.round(r.avg) + 'ms</td><td class="num">' + Math.round(r.max) + 'ms</td>' +
          '<td class="pw ' + (r.avg < 50 ? 'pw-fast' : r.avg >= 150 ? 'pw-slow' : '') + '">' + perfWord(r.avg) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="note">まだ記録がありません。</p>') +
    '<div class="pillrow" style="margin-top:8px"><button class="mini" data-act="perf-run">ぜんぶの画面を測る</button></div>' +
    '<p class="note">50ms未満は「速い」、150ms以上は「重い」です。重い画面があれば教えてください。GitHubにアップロードしたときも、自動で表示の速さ（Lighthouse）を測ります。</p>';
}
function perfRunAll(){
  var keep = { a:appId, p:payTab, c:calTab, t:todayTab };
  TAB_DEFS.forEach(function(t){
    var subs = SUBTAB_DEFS[t[0]] ? SUBTAB_DEFS[t[0]].map(function(x){ return x[0]; }) : [null];
    subs.forEach(function(s){
      appId = t[0];
      if(s){ if(t[0] === 'money') payTab = s; else if(t[0] === 'cal') calTab = s; else if(t[0] === 'today') todayTab = s; else if(t[0] === 'risyu') risyuTab = s === 'plans' ? 'plans' : 'tt'; }
      try{ render(); }catch(e){}
    });
  });
  appId = keep.a; payTab = keep.p; calTab = keep.c; todayTab = keep.t;
  render();
  toast('測りました');
}

/* ============================== アップロードの確認 ============================== */
var fileCheck = { busy:false, result:null };
async function sha256Hex(buf){
  var h = await crypto.subtle.digest('SHA-256', buf);
  return Array.prototype.map.call(new Uint8Array(h), function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
}
async function fileCheckRun(){
  if(fileCheck.busy) return;
  fileCheck.busy = true; fileCheck.result = null; render();
  var out = { missing:[], changed:[], ok:0, listed:false, at:Date.now() };
  try{
    var list = null;
    try{
      var r = await fetch('files.json', { cache:'no-store' });
      if(r.ok){ list = (await r.json()).files; out.listed = true; }
    }catch(e){}
    if(!list){
      /* 一覧がないときは、index.html に書いてあるファイルだけ確かめる */
      var html = await (await fetch('index.html', { cache:'no-store' })).text();
      list = [];
      html.replace(/(?:src|href)="((?:js|css)\/[^"?]+)"/g, function(_, p){ list.push({ path:p }); return _; });
      list.push({ path:'sw.js' }, { path:'manifest.json' }, { path:'gas/Code.gs' }, { path:'gas/appsscript.json' });
    }
    await Promise.all(list.map(async function(f){
      try{
        var res = await fetch(f.path + '?check=' + Date.now(), { cache:'no-store' });
        if(!res.ok){ out.missing.push(f.path); return; }
        if(f.sha256){
          /* 改行の書き方（CRLF/LF）のちがいは気にしない */
          var txt = (await res.text()).replace(/\r/g, '');
          var hex = await sha256Hex(new TextEncoder().encode(txt));
          if(hex.slice(0, f.sha256.length) !== f.sha256) out.changed.push(f.path); else out.ok++;
        }else out.ok++;
      }catch(e){ out.missing.push(f.path); }
    }));
  }catch(e){
    out.error = e.message;
  }finally{
    fileCheck.busy = false; fileCheck.result = out;
    render();
  }
}
function fileCheckHtml(){
  var r = fileCheck.result;
  var h = '<button class="btn ghost" data-act="files-check"' + (fileCheck.busy ? ' disabled' : '') + '>' + (fileCheck.busy ? '確かめています…' : 'アップロードしたファイルがそろっているか確かめる') + '</button>';
  if(!r) return h + '<p class="note">GitHubのファイルが足りない・古いままのものがないかを調べます。</p>';
  if(r.error) return h + '<div class="msg ng">調べられませんでした：' + esc(r.error) + '</div>';
  if(!r.missing.length && !r.changed.length){
    return h + '<div class="msg ok">' + r.ok + '個のファイルがそろっています。' + (r.listed ? '（中身も最新です）' : '') + '</div>';
  }
  return h + '<div class="msg ng">' +
    (r.missing.length ? '<b>見つからないファイル：</b><br>' + r.missing.map(esc).join('<br>') + '<br>' : '') +
    (r.changed.length ? '<b>古いまま（または別の中身）のファイル：</b><br>' + r.changed.map(esc).join('<br>') : '') +
    '</div><p class="note">パソコンの kurashi フォルダの中身を、もう一度まるごとアップロードしてください。</p>';
}

/* ============================== 前の版にもどす・新しい版 ============================== */
var verState = { prev:'', usingPrev:false, checked:false, latest:'' };
async function verCheck(){
  try{
    if(!window.caches) return;
    var has = await caches.has('kurashi-prev');
    if(has){
      var c = await caches.open('kurashi-prev');
      var r = await c.match('./__prev_version');
      verState.prev = r ? await r.text() : 'ひとつ前の版';
    }
    var f = await caches.open('kurashi-flags');
    verState.usingPrev = !!(await f.match('./__use_prev'));
  }catch(e){}
  verState.checked = true;
}
function swMessage(msg){
  return new Promise(function(res, rej){
    if(!navigator.serviceWorker || !navigator.serviceWorker.controller){ rej(new Error('オフライン用のしくみが動いていません（一度読みこみ直してください）')); return; }
    var ch = new MessageChannel();
    ch.port1.onmessage = function(e){ res(e.data); };
    navigator.serviceWorker.controller.postMessage(msg, [ch.port2]);
    setTimeout(function(){ rej(new Error('返事がありません')); }, 5000);
  });
}
async function verRollback(on){
  try{
    await swMessage({ type:'rollback', on:!!on });
    toast(on ? '前の版で開き直します' : '最新の版で開き直します');
    setTimeout(function(){ location.replace(location.pathname + (on ? '' : '?latest')); }, 600);
  }catch(e){ toast('できませんでした：' + e.message, true); }
}
async function verLatest(){
  try{
    var src = await (await fetch('js/core.js?v=' + Date.now(), { cache:'no-store' })).text();
    var m = src.match(/APP_BUILD = '([^']+)'/);
    verState.latest = m ? m[1] : '';
    if(verState.latest && verState.latest !== APP_BUILD){
      if(navigator.serviceWorker){ var reg = await navigator.serviceWorker.getRegistration(); if(reg) await reg.update(); }
      if(confirm('新しい版（' + verState.latest + '）があります。いま読みこみ直しますか？')) location.reload();
    }else toast('いまの版（' + APP_BUILD + '）が最新です');
  }catch(e){ toast('確かめられませんでした：' + e.message, true); }
  render();
}
function verSettings(){
  if(!verState.checked) verCheck().then(function(){ if(appId === 'set' && !isTyping()) render(); });
  return '<div class="row"><div class="grow s">いまの版</div><div class="t num">' + esc(APP_BUILD) + (verState.usingPrev ? '（前の版を使用中）' : '') + '</div></div>' +
    '<div class="pillrow"><button class="mini" data-act="ver-latest">新しい版があるか確かめる</button>' +
    (verState.prev && !verState.usingPrev ? '<button class="mini" data-act="ver-prev">ひとつ前の版にもどす</button>' : '') +
    (verState.usingPrev ? '<button class="mini" data-act="ver-now">最新の版にもどす</button>' : '') + '</div>' +
    '<p class="note">新しい版で困ったことがあったら「ひとつ前の版にもどす」で、この端末だけ前の版にできます（データはそのまま）。' +
    '前の版の画面から戻すときは、アドレスの最後に <code>?latest</code> をつけて開いてください。</p>' +
    fileCheckHtml() +
    '<h3 class="lk">🖥 GitHubへのアップロードをかんたんに（GitHub Desktop）</h3>' +
    '<ol class="steps"><li><a href="https://desktop.github.com/" target="_blank" rel="noopener">GitHub Desktop</a> を入れて、GitHubのアカウントでログイン</li>' +
    '<li>「File › Clone repository」で <b>kurashi</b> を選び、保存場所を決めて Clone</li>' +
    '<li>できたフォルダに、パソコンの kurashi フォルダの中身をまるごとコピー（上書き）</li>' +
    '<li>GitHub Desktop の左下に変更の一覧が出るので、Summary に「更新」と書いて <b>Commit to main</b> → 右上の <b>Push origin</b></li>' +
    '<li>次からは、そのフォルダを直接直せば、Commit と Push だけでアップロードできます</li></ol>' +
    '<p class="note">もどしたいときは、GitHub Desktop の History でその変更を右クリック →「Revert changes in commit」→ Push。</p>' +
    '<h3 class="lk">✅ アップロードのたびの自動テスト</h3>' +
    '<p class="note" style="margin-top:0">GitHubにアップロードすると、自動テスト・ファイルの抜けチェック・表示の速さの測定が動きます（GitHubの「Actions」タブで見られます）。失敗するとGitHubからメールが届きます。</p>';
}
function opsSettings(){
  var d = sentryParse(OPS.sentry);
  return '<div class="pillrow"><button data-act="sentry-on" data-v="1" class="' + (OPS.sentryOn ? 'on' : '') + '">エラーを自動で送る</button>' +
    '<button data-act="sentry-on" data-v="0" class="' + (!OPS.sentryOn ? 'on' : '') + '">送らない</button></div>' +
    '<div class="field"><label class="f" for="ops_dsn">SentryのDSN（この端末にだけ保存）</label>' +
    '<input id="ops_dsn" value="' + esc(OPS.sentry) + '" placeholder="https://…@o000.ingest.sentry.io/000" autocomplete="off"></div>' +
    '<div class="pillrow"><button class="mini" data-act="sentry-save">保存</button>' + (d ? '<button class="mini" data-act="sentry-test">テストを送る</button>' : '') + '</div>' +
    '<ol class="steps"><li><a href="https://sentry.io/signup/" target="_blank" rel="noopener">Sentry</a> に無料で登録し、プロジェクトを「Browser JavaScript」で作る</li>' +
    '<li>「Client Keys (DSN)」をコピーして、上に貼って保存</li></ol>' +
    '<p class="note">送るのは、エラーの場所と短い説明・アプリの版・端末の種類だけです。数字の並びやURLは伏せて送ります。予定・お金・メモの中身は送りません。</p>';
}
function opsAction(act, t){
  if(act === 'sentry-on'){
    OPS.sentryOn = toNum(t.dataset.v); saveOps();
    if(OPS.sentryOn && !sentryParse(OPS.sentry)) toast('DSNを入れてください', true);
    render(); return true;
  }
  if(act === 'sentry-save'){
    var v = val('ops_dsn').trim();
    if(v && !sentryParse(v)){ toast('DSNの形がちがうようです', true); return true; }
    OPS.sentry = v; if(v) OPS.sentryOn = 1; saveOps(); toast('保存しました'); render(); return true;
  }
  if(act === 'sentry-test'){
    var was = OPS.sentryOn; OPS.sentryOn = 1;
    sentrySend('テスト', 'くらしの手帳からのテストです（' + new Date().toLocaleString('ja-JP') + '）', 'info');
    OPS.sentryOn = was;
    toast('送りました。Sentryの画面で届いたか確かめてください'); return true;
  }
  if(act === 'perf-run'){ perfRunAll(); return true; }
  if(act === 'files-check'){ fileCheckRun(); return true; }
  if(act === 'ver-latest'){ verLatest(); return true; }
  if(act === 'ver-prev'){
    if(!confirm((verState.prev || 'ひとつ前の版') + ' にもどしますか？（この端末だけ。データはそのままです）')) return true;
    verRollback(true); return true;
  }
  if(act === 'ver-now'){ verRollback(false); return true; }
  return false;
}

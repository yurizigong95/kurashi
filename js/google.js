/* くらしの手帳：Google（カレンダー・ドライブ）との連携 */
/* ============================== Google連携 ==============================
   あなたのGoogleアカウントで動く「橋わたし」（Apps Script）を通して、
   ・予定を Googleカレンダー「くらしの手帳」に入れる（通知は前日の0時）
   ・週に1回、データを Googleドライブに保存する（写真もいっしょに）
   橋わたしのURLと合言葉は、この端末だけに保存する（同期しない）。         */
var GAS_KEY = KEY + ':gas';
var GAS = (function(){
  var o = null;
  try{ o = JSON.parse(localStorage.getItem(GAS_KEY) || 'null'); }catch(e){}
  return Object.assign({ url:'', token:'', cal:1, backup:1, lastCal:0, lastCalHash:'', calErr:'', backupErr:'', photoDone:{} }, o || {});
})();
function saveGas(){ try{ localStorage.setItem(GAS_KEY, JSON.stringify(GAS)); }catch(e){} }
function gasFake(){
  try{ if(window.__FAKE_GAS) return window.__FAKE_GAS; }catch(e){}
  try{ if(window.parent && window.parent !== window && window.parent.__FAKE_GAS) return window.parent.__FAKE_GAS; }catch(e){}
  return null;
}
function gasReady(){
  if(TEST_MODE) return !!(gasFake() && GAS.url && GAS.token);
  return !!(GAS.url && GAS.token && /^https:\/\/script\.google\.com\//.test(GAS.url));
}
async function gasCall(action, body){
  var req = Object.assign({ token:GAS.token, action:action }, body || {});
  if(TEST_MODE){
    var f = gasFake();
    if(!f) throw new Error('テストモードでは使えません');
    var r0 = await f(JSON.parse(JSON.stringify(req)));
    if(!r0 || !r0.ok) throw new Error((r0 && r0.error) || '失敗しました');
    return r0;
  }
  var res = await withTimeout(fetch(GAS.url, {
    method:'POST', redirect:'follow',
    headers:{ 'Content-Type':'text/plain;charset=utf-8' },   /* これだと事前確認なしで送れる */
    body: JSON.stringify(req)
  }), 90000, 'Google');
  var text = await res.text();
  var js;
  try{ js = JSON.parse(text); }
  catch(e){
    if(/accounts\.google\.com|ServiceLogin/i.test(text)) throw new Error('橋わたしの公開設定が「全員」になっていません');
    throw new Error('橋わたしから読めない返事が来ました（URLをたしかめてください）');
  }
  if(!js.ok) throw new Error(js.error || '失敗しました');
  return js;
}
/* 合言葉を作る（英数字32文字） */
function gasNewToken(){
  var a = new Uint8Array(24);
  (window.crypto || window.msCrypto).getRandomValues(a);
  return Array.prototype.map.call(a, function(b){ return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 32);
}

/* ===== カレンダー ===== */
var gasCalState = { busy:false, timer:null, again:false };
/* カレンダーに入れる予定の一覧（前の .ics と同じ中身） */
function calItemsForGoogle(){
  var from = shiftDate(today(), -31), to = shiftDate(today(), 400);
  var items = [];
  var add = function(k, kind, title, ymd, hhmm, mins, endYmd, note){
    if(!isYmd(ymd) || ymd < from || ymd > to) return;
    var timed = !!(hhmm && minutesOf(hhmm) != null);
    var it = { k:k, kind:kind, title:String(title||'予定').slice(0, 120), date:ymd,
               time: timed ? hhmmOf(minutesOf(hhmm)) : '', mins: timed ? (Number(mins)||60) : 0,
               end: (!timed && isYmd(endYmd) && endYmd > ymd) ? endYmd : '', note:String(note||'').slice(0, 500) };
    it.h = hash53(canon(it));
    items.push(it);
  };
  S.events.forEach(function(e){
    var k = eventKind(e.kind);
    add('ev-'+e.id, k === 'imp' ? 'imp' : 'other',
        (k==='imp'?'★ ':'')+(e.title||'予定')+(e.subject && e.subject!==e.title ? '（'+shortName(e.subject)+'）' : ''),
        e.date, e.time, 60, e.dateEnd, e.memo);
  });
  S.tasks.forEach(function(t){
    if(t.done) return;
    add('tk-'+t.id, 'task', '締切 '+(t.title||'')+(t.subject ? '（'+shortName(t.subject)+'）' : ''), t.due, t.time, 30, '', t.url || t.memo || '');
  });
  S.exams.forEach(function(x){
    var k = (x.kind==='quiz'||x.kind==='kousa') ? x.kind : 'exam';
    add('ex-'+x.id, k, kindOf(k).name+' '+(x.subject ? shortName(x.subject) : '')+(x.title ? ' '+x.title : ''), x.date, x.time, 60, '', x.room);
  });
  S.shifts.forEach(function(w){
    var mins = shiftMinutes(w) || 60;
    add('wk-'+w.id, 'work', 'バイト'+(S.settings.shop ? '（'+S.settings.shop+'）' : ''), w.date, w.start, mins, '', w.memo);
  });
  S.health.forEach(function(h){
    add('hl-'+h.id, 'health', (h.name||'')+' の期限', h.next, '', 0, '', h.memo);
  });
  var d = derive(), cur = thisYm();
  d.months.filter(function(m){ return m >= cur; }).forEach(function(m){
    [['smbc',S.settings.smbcDay],['rakuten',S.settings.rakutenDay]].forEach(function(pair){
      var g = d.byMonth[m] && d.byMonth[m][pair[0]]; if(!g) return;
      var amt = g.plan + g.stmt; if(amt <= 0) return;
      add('pay-'+pair[0]+'-'+m, 'pay', ACCOUNTS[pair[0]].bank+' 引落 '+yen(amt), m+'-'+pad(toNum(pair[1])), '', 0, '', '前日までに入金');
    });
  });
  return items;
}
/* 予定が変わったら、少し待ってからカレンダーへ（何度も送らないように） */
function gasCalSoon(){
  if(!gasReady() || !GAS.cal) return;
  clearTimeout(gasCalState.timer);
  gasCalState.timer = setTimeout(function(){ gasCalSync(false); }, 15000);
}
async function gasCalSync(manual, full){
  if(!gasReady() || (!GAS.cal && !manual)) return;
  if(gasCalState.busy){ gasCalState.again = true; return; }
  var items = calItemsForGoogle();
  var sig = hash53(canon(items));
  if(!manual && !full && sig === GAS.lastCalHash) return;      /* 前に送った中身と同じ */
  gasCalState.busy = true;
  try{
    var total = 0, loops = 0, res;
    do{
      res = await gasCall('calSync', { items:items, full:!!full && loops === 0 });
      total += res.done || 0;
      loops++;
      if(res.errors && res.errors.length) logErr('Googleカレンダー', res.errors.join(' / '));
    }while(res.remaining > 0 && loops < 30);
    GAS.lastCal = Date.now(); GAS.lastCalHash = sig; GAS.calErr = '';
    saveGas();
    S.cloud.cal = { at:Date.now(), by:DEV.id, n:items.length, mt:Date.now() };
    persist(); pushRemote();
    if(manual) toast('Googleカレンダーに送りました（'+items.length+'件'+(total ? '・'+total+'件を更新' : '')+'）');
  }catch(e){
    GAS.calErr = e.message; saveGas();
    logErr('Googleカレンダー', e.message);
    if(manual) toast('送れませんでした：' + e.message, true);
  }finally{
    gasCalState.busy = false;
    if(appId === 'set' && !isTyping()) render();
    if(gasCalState.again){ gasCalState.again = false; gasCalSoon(); }
  }
}

/* ===== ドライブへのバックアップ ===== */
var gasBackupState = { busy:false, list:null };
function backupDue(){
  var last = Number((S.cloud.backup || {}).at) || 0;
  return Date.now() - last > 7*24*3600*1000;
}
async function gasBackup(manual){
  if(!gasReady() || gasBackupState.busy) return;
  if(!manual && (!GAS.backup || !backupDue())) return;
  gasBackupState.busy = true;
  if(manual) toast('Googleドライブに保存しています…');
  try{
    var d = new Date();
    var name = 'kurashi-' + toYmd(d) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
    var body = JSON.stringify(Object.assign({ app:'kurashi', version:5, device:DEV.name }, payload()));
    var r = await gasCall('backup', { name:name, json:body });
    S.cloud.backup = { at:Date.now(), by:DEV.id, name:r.name, size:r.size, url:r.url || '', mt:Date.now() };
    S.backupAt = Date.now();
    GAS.backupErr = ''; saveGas();
    persist(); pushRemote();
    /* 写真も、まだ送っていないものを少しずつ */
    var sent = await gasBackupPhotos(manual ? 60 : 20);
    /* 新しい橋わたしなら、スプレッドシートにも書き出す */
    if(typeof sheetExport === 'function' && toNum(GAS.ver) >= 3){
      try{ await sheetExport(false); persist(); pushRemote(); }catch(e2){ logErr('スプレッドシート', e2.message); }
    }
    if(manual) toast('Googleドライブに保存しました' + (sent ? '（写真'+sent+'枚も）' : ''));
    gasBackupState.list = null;
  }catch(e){
    GAS.backupErr = e.message; saveGas();
    logErr('Googleドライブ', e.message);
    if(manual) toast('保存できませんでした：' + e.message, true);
  }finally{
    gasBackupState.busy = false;
    if(appId === 'set' && !isTyping()) render();
  }
}
async function gasBackupPhotos(max){
  var keys = await photoKeys();
  var left = keys.filter(function(k){ return !GAS.photoDone[k]; });
  if(!left.length) return 0;
  var have = {};
  try{ ((await gasCall('photoNames')).names || []).forEach(function(n){ have[n] = 1; }); }catch(e){ return 0; }
  var n = 0;
  for(var i = 0; i < left.length && n < max; i++){
    var pid = left[i];
    if(have[String(pid).replace(/[^A-Za-z0-9_-]/g, '')]){ GAS.photoDone[pid] = 1; continue; }
    var data = await photoGetLocal(pid);
    if(!data){ continue; }
    try{ await gasCall('photoPut', { pid:pid, data:data }); GAS.photoDone[pid] = 1; n++; }
    catch(e){ logErr('Googleドライブ', '写真 '+pid+'：'+e.message); break; }
  }
  saveGas();
  return n;
}
async function gasBackupList(){
  try{
    var r = await gasCall('backupList');
    gasBackupState.list = r.items || [];
    gasBackupState.folder = r.url || '';
  }catch(e){
    gasBackupState.list = [];
    toast('一覧を読めませんでした：' + e.message, true);
  }
  render();
}
async function gasRestore(id){
  try{
    toast('読みこんでいます…');
    var r = await gasCall('backupGet', { id:id });
    var d = JSON.parse(r.json);
    if(d.app !== 'kurashi' && d.app !== 'shiharai') throw new Error('くらしの手帳のファイルではありません');
    importData(d);
    toast('バックアップから取りこみました（今の内容に足し合わせました）');
  }catch(e){
    toast('取りこめませんでした：' + e.message, true);
  }
}
/* 書き出したファイル・バックアップを取りこむ（今の内容に足し合わせる） */
function importData(d){
  if(d.risyu) d.risyu.updatedAt = Date.now();
  var now = Date.now();
  d.meta = Object.assign({}, d.meta || {});
  ['attend','terms','commute','ui'].forEach(function(k){ if(d[k]) d.meta[k] = now; });
  mergeRemote(d);
  applyUi(); render();
}

/* ===== 設定画面 ===== */
function gasSettings(){
  var ready = gasReady();
  var cal = S.cloud.cal || {}, bk = S.cloud.backup || {};
  var h = '';
  if(!ready){
    h += '<div class="bn amber" style="margin-bottom:12px"><span class="ic">!</span><span>'+
      '<b>まだつながっていません。</b>下の手順で「橋わたし」を作ると、Googleカレンダーへの予定の送信と、Googleドライブへの毎週のバックアップが自動で動きます。</span></div>'+
      '<ol class="steps">'+
        '<li>下の「合言葉を作って、プログラムをコピー」を押す</li>'+
        '<li><a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a> で新しいプロジェクトを作り、Code.gs の中身を全部消して<b>貼り付け</b>、保存</li>'+
        '<li>左の「⚙ プロジェクトの設定」→「appsscript.json マニフェスト ファイルをエディタで表示する」にチェック → エディタの <b>appsscript.json</b> を下の「設定ファイルをコピー」の中身に置きかえて保存</li>'+
        '<li>右上の「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」<br>・次のユーザーとして実行：<b>自分</b><br>・アクセスできるユーザー：<b>全員</b></li>'+
        '<li>「デプロイ」→ Googleの確認画面で許可（「このアプリは確認されていません」と出たら「詳細」→「移動」）</li>'+
        '<li>出てきた<b>ウェブアプリのURL</b>を下に貼って「つながるか試す」</li>'+
      '</ol>';
  }
  h += '<div class="pair"><button class="btn ghost" data-act="gas-copy">合言葉を作って、プログラムをコピー</button>'+
    '<button class="btn ghost" data-act="gas-manifest" style="flex:0 0 auto">設定ファイルをコピー</button></div>'+
    (ready ? '<p class="note">新しい版にしたときは、プログラムと設定ファイルを貼り直して、「デプロイ」→「デプロイを管理」→ ✏️ →「新バージョン」で更新してください（URLは変わりません）。</p>' : '')+
    '<div class="field" style="margin-top:10px"><label class="f">橋わたしのURL</label>'+
    '<input id="gas_url" value="'+esc(GAS.url)+'" placeholder="https://script.google.com/macros/s/…/exec" inputmode="url"></div>'+
    '<div class="field"><label class="f">合言葉</label>'+
    '<input id="gas_token" type="password" value="'+esc(GAS.token)+'" placeholder="プログラムに入っている合言葉"></div>'+
    '<div class="pair"><button class="btn" data-act="gas-save">保存して、つながるか試す</button></div>'+
    (GAS.user ? '<p class="note">つながっています：'+esc(GAS.user)+(GAS.ver ? '（5分ごとの確認：'+(GAS.trigger ? '動いている' : '止まっている')+'）' : '（古いプログラムです。貼り直してください）')+'</p>' : '')+
    (GAS.user && GAS.ver && !GAS.trigger ? '<button class="mini" data-act="gas-setup">5分ごとの確認を動かす</button>' : '');
  if(ready){
    h += '<label class="f" style="margin-top:14px">Googleカレンダー</label>'+
      '<div class="pillrow">'+
        '<button data-act="gas-cal" data-v="1" class="'+(GAS.cal?'on':'')+'">自動で送る</button>'+
        '<button data-act="gas-cal" data-v="0" class="'+(!GAS.cal?'on':'')+'">送らない</button>'+
      '</div>'+
      '<div class="row"><div class="grow s">最後に送った</div><div class="t num">'+
        (cal.at ? agoText(cal.at)+'（'+esc(deviceName(cal.by))+'・'+(cal.n||0)+'件）' : 'まだ')+'</div></div>'+
      (GAS.calErr ? '<div class="msg ng">送れませんでした：'+esc(GAS.calErr)+'</div>' : '')+
      '<div class="pillrow"><button class="mini" data-act="gas-cal-now">今すぐ送る</button>'+
        '<button class="mini" data-act="gas-cal-full">ぜんぶ入れ直す</button>'+
        '<button class="mini" data-act="gas-cal-clear">カレンダーから消す</button></div>'+
      '<p class="note">カレンダー「くらしの手帳」に、予定・課題・テスト・バイト・健康の期限・引き落としが入ります。'+
        '<b>通知はどれも前日の0時</b>です（Googleカレンダーの通知をオンにしておいてください）。前の「iPhoneのカレンダーに送る（.ics）」は、これに変わりました。</p>'+

      '<label class="f" style="margin-top:14px">Googleドライブへのバックアップ</label>'+
      '<div class="pillrow">'+
        '<button data-act="gas-bk" data-v="1" class="'+(GAS.backup?'on':'')+'">毎週自動で保存</button>'+
        '<button data-act="gas-bk" data-v="0" class="'+(!GAS.backup?'on':'')+'">自動では保存しない</button>'+
      '</div>'+
      '<div class="row"><div class="grow s">最後の保存</div><div class="t num">'+
        (bk.at ? agoText(bk.at)+'（'+esc(deviceName(bk.by))+(bk.size ? '・'+sizeText(bk.size) : '')+'）' : 'まだ')+'</div></div>'+
      (GAS.backupErr ? '<div class="msg ng">保存できませんでした：'+esc(GAS.backupErr)+'</div>' : '')+
      '<div class="pillrow"><button class="mini" data-act="gas-bk-now">今すぐ保存</button>'+
        '<button class="mini" data-act="gas-bk-list">保存したものを見る</button></div>'+
      (gasBackupState.list ? backupListHtml() : '')+
      '<p class="note">「くらしの手帳バックアップ」フォルダに、1週間に1回、新しい12回分を残します（写真も「写真」フォルダに入ります）。どれか1台が保存すれば、ほかの端末は保存しません。</p>';
  }
  return h;
}
function backupListHtml(){
  var list = gasBackupState.list || [];
  if(!list.length) return '<div class="empty" style="padding:8px 0">まだありません。</div>';
  return '<div style="margin:6px 0 10px">'+list.map(function(x){
    return '<div class="row"><div class="grow"><div class="t">'+esc(new Date(x.at).toLocaleString('ja-JP'))+'</div>'+
      '<div class="s">'+sizeText(x.size)+'</div></div>'+
      '<button class="mini" data-act="gas-restore" data-id="'+esc(x.id)+'">取りこむ</button></div>';
  }).join('')+
  (gasBackupState.folder ? '<a class="mini" href="'+esc(gasBackupState.folder)+'" target="_blank" rel="noopener">ドライブで開く</a>' : '')+'</div>';
}
function gasAction(act, t){
  if(act === 'gas-copy'){
    if(!GAS.token){ GAS.token = gasNewToken(); saveGas(); }
    fetch('gas/Code.gs', { cache:'no-store' }).then(function(r){
      if(!r.ok) throw new Error('プログラムのファイルが見つかりません');
      return r.text();
    }).then(function(src){
      src = src.replace("var TOKEN = 'ここに合言葉';", "var TOKEN = '" + GAS.token + "';");
      return navigator.clipboard.writeText(src);
    }).then(function(){
      toast('プログラムをコピーしました（合言葉入り）。script.google.com に貼り付けてください');
      render();
    })['catch'](function(e){
      toast('コピーできませんでした：' + e.message, true);
      render();
    });
    return true;
  }
  if(act === 'gas-save'){
    var u = val('gas_url').trim(), tk = val('gas_token').trim();
    if(u && !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/.test(u)){
      toast('URLは https://script.google.com/macros/s/…/exec の形です', true); return true;
    }
    GAS.url = u; GAS.token = tk; GAS.user = ''; saveGas();
    if(!u || !tk){ toast('URLと合言葉の両方を入れてください', true); render(); return true; }
    toast('つながるか試しています…');
    gasCall('ping').then(function(r){
      GAS.user = r.user || 'OK'; GAS.ver = r.ver || 0; GAS.api = r.api || 0; GAS.trigger = r.trigger ? 1 : 0; GAS.ai = r.ai ? 1 : 0; GAS.err = r.err || null; saveGas();
      if(typeof gasUrlShare === 'function'){ gasUrlShare(); persist(); pushRemote(); }
      if(typeof gfeatPush === 'function') gfeatPush()['catch'](function(e){ logErr('Google連携', e.message); });
      if(r.ver && !r.trigger) gasCall('setup').then(function(){ GAS.trigger = 1; saveGas(); render(); })['catch'](function(e){ logErr('Google連携', '5分ごとの確認を動かせませんでした：' + e.message); });
      toast('つながりました：' + (r.calendar || 'くらしの手帳'));
      gasCalSync(true); gasBackup(false);
      render();
    })['catch'](function(e){
      toast('つながりませんでした：' + e.message, true);
      logErr('Google連携', e.message);
      render();
    });
    return true;
  }
  if(act === 'gas-manifest'){
    fetch('gas/appsscript.json', { cache:'no-store' }).then(function(r){ if(!r.ok) throw new Error('設定ファイルが見つかりません'); return r.text(); })
      .then(function(txt){ return navigator.clipboard.writeText(txt); })
      .then(function(){ toast('設定ファイル（appsscript.json）をコピーしました'); }, function(e){ toast('コピーできませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'gas-setup'){
    gasCall('setup').then(function(){ GAS.trigger = 1; saveGas(); toast('5分ごとの確認を動かしました'); render(); }, function(e){ toast('できませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'gas-cal'){ GAS.cal = toNum(t.dataset.v); saveGas(); if(GAS.cal) gasCalSync(true); render(); return true; }
  if(act === 'gas-cal-now'){
    if(!gasReady()){
      appId = 'set'; S.ui.setOpen = S.ui.setOpen || {}; S.ui.setOpen.gas = 1; render();
      toast('先にGoogle連携をつないでください');
      return true;
    }
    gasCalSync(true); return true;
  }
  if(act === 'gas-cal-full'){
    if(!confirm('Googleカレンダーの「くらしの手帳」の予定を、ぜんぶ入れ直しますか？')) return true;
    toast('入れ直しています…（少し時間がかかります）');
    gasCalSync(true, true); return true;
  }
  if(act === 'gas-cal-clear'){
    if(!confirm('Googleカレンダーから、このアプリが入れた予定をぜんぶ消しますか？（自動で送るもオフになります）')) return true;
    GAS.cal = 0; GAS.lastCalHash = ''; saveGas();
    (async function(){
      try{
        var r, n = 0;
        do{ r = await gasCall('calClear'); n += r.removed || 0; }while(r.remaining > 0 && n < 5000);
        toast('Googleカレンダーから'+n+'件消しました');
      }catch(e){ toast('消せませんでした：' + e.message, true); }
      render();
    })();
    return true;
  }
  if(act === 'gas-bk'){ GAS.backup = toNum(t.dataset.v); saveGas(); render(); return true; }
  if(act === 'gas-bk-now'){ gasBackup(true); return true; }
  if(act === 'gas-bk-list'){ gasBackupList(); return true; }
  if(act === 'gas-restore'){
    if(!confirm('このバックアップを取りこみますか？（今の内容は消えず、足し合わされます）')) return true;
    gasRestore(t.dataset.id); return true;
  }
  return false;
}
/* 起動したあと・1時間ごとに、必要なら動かす */
setTimeout(function(){ gasBackup(false); gasCalSync(false); }, 8000);
setInterval(function(){ gasBackup(false); gasCalSync(false); }, 60*60*1000);

/* もんだいメーカー：Goodnotesのノートから作る
   ============================================================================
   Goodnotesの共有リンク（share.goodnotes.com）は、ノートを Goodnotes for Web の画面で
   見せるためのもので、中身（手書き）をリンクから取り出すことはできません。
   そこで、Goodnotesの自動バックアップ（Googleドライブ・PDF）から、ノートのPDFを受けとります。
   ・受けとり口は、くらしの手帳の「Google連携（橋わたし・Apps Script）」。
     橋わたしのURLと合言葉は、この端末のくらしの手帳のものを読むだけ（写さない・同期しない）。
   ・橋わたしは、Goodnotesのフォルダの中のPDFだけを渡します（ほかのファイルは渡さない）。 */

var gn = { open:0, busy:'', msg:'', items:null, err:'', why:'', folder:'', q:'', pick:{}, from:'', sort:'', closed:{} };
var GN_PART = 4 * 1024 * 1024;              /* 1回に受けとる大きさ（橋わたしの返事が大きくなりすぎないように） */

function gnIsLink(u){ return /^https?:\/\/(?:share|web)\.goodnotes\.com\//i.test(String(u || '')); }
/* くらしの手帳の橋わたし（この端末のもの） */
function gnGas(){
  if(typeof window !== 'undefined' && window.__FAKE_GAS) return { url:'https://script.google.com/fake', token:'test', fake:window.__FAKE_GAS, acct:window.__FAKE_GAS_ACCT || '' };
  if(TEST_MODE) return null;                                    /* テストでは本物につながない */
  try{
    var o = JSON.parse(localStorage.getItem('shiharai:v1:gas') || 'null');
    if(o && o.url && o.token && /^https:\/\/script\.google\.com\//.test(o.url)) return o;
  }catch(e){}
  return null;
}
function gnErr(why, msg){ var e = new Error(msg || why); e.why = why; return e; }
/* 橋わたしの窓口の版（くらしの手帳が、つないだときにたしかめた数。わからないときは 0）。
   7 から、リンク（ウェブのページ・Googleドライブ）を読めて、大きいノートも少しずつ読める */
var GAS_API_LINK = 7;
function gasApiOf(){ var g = gnGas(); return !g ? -1 : g.fake ? 99 : toNum(g.api); }
function gasOld(){ var a = gasApiOf(); return a > 0 && a < GAS_API_LINK; }
var GAS_UPDATE_HOW = 'くらしの手帳 › 設定 › Google連携 の「プログラムをコピー」で Apps Script に貼り直して、' +
  '「デプロイを管理」→ ✏️ →「新バージョン」→「デプロイ」。1回だけで大丈夫です。';
/* 橋わたしに届かなかったとき、わけを見分ける（1分のあいだは、同じ答えを使う）。
   ・'alive'   … 橋わたしは動いている（そのお願いだけが止まった）
   ・'login'   … 公開が「全員」になっていない（Googleのログイン画面が返ってくる）
   ・'broken'  … Googleは返事をするが、橋わたしの返事が来ない（橋わたしが消えた・Googleの許可が切れた）
   ・'offline' … Googleにもつながらない（ネットがない） */
var gasProbeMemo = { url:'', at:0, res:'' };
function fetchWait(url, opt, ms){
  var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var tm = setTimeout(function(){ if(ctl) ctl.abort(); }, ms);
  return fetch(url, Object.assign({ signal:ctl ? ctl.signal : undefined }, opt || {}))
    .then(function(r){ clearTimeout(tm); return r; }, function(e){ clearTimeout(tm); throw e; });
}
async function gasProbe(url){
  if(gasProbeMemo.url === url && Date.now() - gasProbeMemo.at < 60000) return gasProbeMemo.res;
  var res = 'offline';
  try{
    var r = await fetchWait(url, { method:'GET', redirect:'follow' }, 20000);
    var t = await r.text();
    var js = null;
    try{ js = JSON.parse(t); }catch(e){}
    res = (js && js.ok) ? 'alive' : /accounts\.google\.com|ServiceLogin/i.test(t) ? 'login' : 'broken';
  }catch(e){
    /* 中身は読めなくても、Googleから返事が来れば（no-cors）、ネットはつながっている */
    try{ await fetchWait(url, { method:'GET', mode:'no-cors', redirect:'follow' }, 15000); res = 'broken'; }
    catch(e2){ res = 'offline'; }
  }
  gasProbeMemo = { url:url, at:Date.now(), res:res };
  return res;
}
var GAS_PROBE_TEXT = {
  alive:'橋わたしは動いていますが、このお願いの途中で止まりました。少し待って、もう一度ためしてください',
  login:'橋わたしの公開設定が「全員」になっていません（くらしの手帳 › 設定 › Google連携）',
  broken:'橋わたし（Apps Script）から返事が来ません。橋わたしが消えているか、Googleの許可が切れています',
  offline:'ネットにつながりませんでした'
};
async function gnCall(action, body){
  var g = gnGas();
  if(!g) throw gnErr('nogas', 'くらしの手帳のGoogle連携が、この端末でつながっていません');
  var req = Object.assign({ token:g.token, action:action }, body || {});
  var js = null;
  if(g.fake){
    js = await g.fake(JSON.parse(JSON.stringify(req)));
  }else{
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var tm = setTimeout(function(){ if(ctl) ctl.abort(); }, 90000);
    try{
      var res = await fetch(g.url, { method:'POST', redirect:'follow', headers:{ 'Content-Type':'text/plain;charset=utf-8' },
        body:JSON.stringify(req), signal:ctl ? ctl.signal : undefined });
      var text = await res.text();
      try{ js = JSON.parse(text); }
      catch(e){
        if(/accounts\.google\.com|ServiceLogin/i.test(text)) throw gnErr('gaserr', '橋わたしの公開設定が「全員」になっていません（くらしの手帳 › 設定 › Google連携）');
        throw gnErr('gaserr', '橋わたしから読めない返事が来ました');
      }
    }catch(e){
      if(e && e.why) throw e;
      if(/abort/i.test(String(e && (e.name || e.message)))) throw gnErr('net', '橋わたしから返事がありませんでした');
      /* 「ネットにつながらない」のか「橋わたしが動いていない」のかを、たしかめてから知らせる */
      var pr = await gasProbe(g.url);
      throw gnErr(pr === 'offline' ? 'net' : pr === 'alive' ? 'gaserr' : pr, GAS_PROBE_TEXT[pr]);
    }finally{ clearTimeout(tm); }
  }
  if(!js || !js.ok){
    var m = String((js && js.error) || '失敗しました');
    if(/知らないお願い/.test(m)) throw gnErr('old', m);
    if(/合言葉/.test(m)) throw gnErr('gaserr', 'くらしの手帳のGoogle連携の合言葉が合っていません');
    throw gnErr('gaserr', m);
  }
  return js;
}

/* ===== ノートの一覧 ===== */
function gnOpen(from){
  gn.open = 1; gn.from = from || ''; gn.err = ''; gn.why = '';
  if(!gn.items && !gn.busy) gnLoad();
  render();
  /* 一覧が見えるところまで動かす（下のほうに出るので） */
  setTimeout(function(){
    var el = document.getElementById('gn-sec');
    if(el && el.scrollIntoView) try{ el.scrollIntoView({ block:'start', behavior:'smooth' }); }catch(e){ el.scrollIntoView(); }
  }, 60);
}
async function gnLoad(){
  if(gn.busy) return;
  gn.busy = 'list'; gn.err = ''; gn.why = ''; render();
  try{
    var r = await gnCall('gnList', { q:String(gn.q || '').trim() });
    gn.items = Array.isArray(r.items) ? r.items : [];
    gn.folder = r.folderName || '';
    if(r.none) gn.why = 'nofolder';
    else if(!gn.items.length) gn.why = gn.q ? 'nohit' : (r.other ? 'notpdf' : 'empty');
  }catch(e){
    gn.items = null;
    gn.why = e.why || 'gaserr';
    gn.err = e.message;
  }finally{
    gn.busy = ''; render();
  }
}
/* base64 を、バイトの列にもどす */
function gnBytes(b64){
  var bin = atob(String(b64 || '')), out = new Uint8Array(bin.length);
  for(var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
/* 1冊ぶんのPDFを、少しずつ受けとって、1つのファイルにする */
async function gnFetch(it, no, all){
  var parts = [], at = 0, size = toNum(it.size) || 0, name = String(it.name || 'Goodnotes');
  for(var k = 0; k < 400; k++){
    gn.msg = 'ノートを受けとっています' + (all > 1 ? '（' + no + '/' + all + '）' : '') + '… ' + (size ? Math.min(99, Math.round(at / size * 100)) : 0) + '%';
    render();
    var r = await gnCall('gnGet', { id:it.id, at:at, len:GN_PART });
    size = toNum(r.size) || size;
    if(!toNum(r.n)) break;
    parts.push(gnBytes(r.data));
    at += toNum(r.n);
    if(at >= size) break;
  }
  if(!parts.length) throw new Error('「' + name + '」を受けとれませんでした');
  var fname = /\.pdf$/i.test(name) ? name : name + '.pdf';
  try{ return new File(parts, fname, { type:'application/pdf' }); }
  catch(e){ var b = new Blob(parts, { type:'application/pdf' }); b.name = fname; return b; }
}
/* えらんだノートを、資料に入れる */
async function gnTake(){
  var ids = Object.keys(gn.pick).filter(function(id){ return gn.pick[id]; });
  var list = (gn.items || []).filter(function(it){ return ids.indexOf(it.id) >= 0; });
  if(!list.length){ toast('ノートをえらんでください', true); return; }
  if(gn.busy || mk.busy) return;
  gn.busy = 'get'; render();
  var files = [], bad = [];
  try{
    for(var i = 0; i < list.length; i++){
      try{ files.push(await gnFetch(list[i], i + 1, list.length)); }
      catch(e){ bad.push(list[i].name + '：' + (e.message || e)); }
    }
  }finally{
    gn.busy = ''; gn.msg = '';
  }
  if(!files.length && bad.length){
    /* ぜんぶ受けとれなかったときは、わけを一覧の上にのこす（すぐ消える知らせだけだと、見のがすので） */
    gn.err = '受けとれなかったノート：' + bad.join('／') +
      (gasOld() ? '（大きいノートは、橋わたしを新しい版にすると読めます。' + GAS_UPDATE_HOW + '）' : '');
    gn.why = '';
  }
  if(files.length){
    gn.pick = {}; gn.open = 0;
    /* 共有リンクから来たときは、リンクの欄から外す */
    if(gn.from){
      var box = linkList(String(elVal('mk_links') || '')).filter(function(u){ return !gnIsLink(u); }).join('\n');
      inSet('mk_links', box); INP.mk_links = box;
      mk.linkFails = (mk.linkFails || []).filter(function(f){ return !gnIsLink(f.u); });
    }
    gn.from = '';
    await mkTake(files);
  }else{
    render();
  }
  if(bad.length) toast('受けとれなかったノート：' + bad.join('／'), true);
}

/* ===== 一覧の並べ方（フォルダごと・名前順・新しい順） ===== */
var gnColl = (typeof Intl !== 'undefined' && Intl.Collator) ? new Intl.Collator('ja', { numeric:true, sensitivity:'base' }) : null;
function gnCmp(a, b){ a = String(a || ''); b = String(b || ''); return gnColl ? gnColl.compare(a, b) : (a < b ? -1 : a > b ? 1 : 0); }
function gnNoteName(it){ return String((it && it.name) || '').replace(/\.pdf$/i, ''); }
/* 橋わたしが新しい版なら、どのフォルダのノートかがわかる */
function gnHasPaths(){ return (gn.items || []).some(function(it){ return typeof it.path === 'string'; }); }
function gnSortMode(){
  var m = gn.sort || (gnHasPaths() ? 'folder' : 'name');
  if(m === 'folder' && !gnHasPaths()) m = 'name';
  return m;
}
function gnSorted(list, mode){
  return list.slice().sort(function(a, b){
    if(mode === 'new') return (toNum(b.updated) - toNum(a.updated)) || gnCmp(gnNoteName(a), gnNoteName(b));
    return gnCmp(gnNoteName(a), gnNoteName(b));
  });
}
function gnRow(it){
  var on = !!gn.pick[it.id];
  return '<button type="button" class="gnrow' + (on ? ' on' : '') + '" data-act="gn-pick" data-v="' + esc(it.id) + '" aria-pressed="' + on + '">' +
    '<span class="ck">' + (on ? '✓' : '') + '</span><span class="bd"><b>' + esc(gnNoteName(it)) + '</b>' +
    '<span class="s">' + esc(syAgo(it.updated)) + 'に更新・' + esc(fSizeText(it.size)) + '</span></span></button>';
}
function gnListHtml(){
  var mode = gnSortMode(), items = gnSorted(gn.items || [], mode === 'folder' ? 'name' : mode);
  if(mode !== 'folder') return items.map(gnRow).join('');
  /* フォルダごとにまとめる（フォルダは名前順・いちばん上のノートは最後） */
  var groups = {}, keys = [];
  items.forEach(function(it){
    var k = String(it.path || '');
    if(!groups[k]){ groups[k] = []; keys.push(k); }
    groups[k].push(it);
  });
  keys.sort(function(a, b){ if(!a) return 1; if(!b) return -1; return gnCmp(a, b); });
  var closed = gn.closed || {};
  return keys.map(function(k){
    var list = groups[k], shut = !!closed[k];
    var picked = list.filter(function(it){ return gn.pick[it.id]; }).length;
    return '<div class="gngrp">' +
      '<button type="button" class="gnfold' + (shut ? '' : ' open') + '" data-act="gn-fold" data-v="' + esc(k) + '" aria-expanded="' + !shut + '">' +
        '<span class="tw" aria-hidden="true">' + (shut ? '▸' : '▾') + '</span><span class="fn">📁 ' + esc(k || (gn.folder || 'GoodNotes') + '（いちばん上）') + '</span>' +
        '<span class="fc">' + list.length + '冊' + (picked ? '・' + picked + 'えらんだ' : '') + '</span></button>' +
      (shut ? '' : list.map(gnRow).join('')) +
    '</div>';
  }).join('');
}
function gnSortBar(){
  var mode = gnSortMode(), has = gnHasPaths();
  var opts = (has ? [['folder', '📁 フォルダごと']] : []).concat([['name', '名前順'], ['new', '新しい順']]);
  return '<div class="pillrow gnsort">' + opts.map(function(o){
      return '<button type="button" data-act="gn-sort" data-v="' + o[0] + '" class="' + (mode === o[0] ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div>' +
    (has ? '' : '<div class="s gnhint">フォルダごとにまとめるには、くらしの手帳 › 設定 › Google連携 の「プログラムをコピー」で橋わたしを貼り直して、「デプロイを管理」→ ✏️ →「新バージョン」→「デプロイ」してください。</div>');
}
/* えらんでも、一覧の見ていた場所から動かさない（描き直すと、一覧のスクロールがいちばん上にもどるため） */
function gnRender(){
  var el = document.querySelector('.gnlist'), top = el ? el.scrollTop : 0, y = window.scrollY || 0;
  render();
  var el2 = document.querySelector('.gnlist');
  if(el2) el2.scrollTop = top;
  if(Math.abs((window.scrollY || 0) - y) > 1) try{ window.scrollTo(0, y); }catch(e){}
}

/* ===== 画面 ===== */
/* 橋わたしを作ったGoogleアカウント（くらしの手帳が、つないだときに覚えたもの） */
function gnAccount(){
  var g = gnGas() || {};
  return [g.acct, g.user].filter(function(u){ return /@/.test(String(u || '')); })[0] || '';
}
/* 橋わたしに届かないときの、たしかめ方と直し方 */
function gnFixHtml(why){
  var g = gnGas(), acc = gnAccount();
  var h = '<div class="warnbox"><div class="s"><b>' + esc(GAS_PROBE_TEXT[why] || gn.err) + '</b></div>';
  if(why === 'login'){
    h += '<div class="s">Apps Script で、右上の「デプロイ」→「デプロイを管理」→ ✏️ →「アクセスできるユーザー」を<b>全員</b>にして「デプロイ」をおしてください。</div>';
  }else if(why === 'broken'){
    h += (acc ? '<div class="s">橋わたしを作ったGoogleアカウント：<b>' + esc(acc) + '</b></div>' : '') +
      '<div class="s">下のボタンで、橋わたしのページを開いてみてください。</div>' +
      '<div class="s">・「くらしの手帳の橋わたしは動いています」→ 橋わたしは大丈夫です。「一覧を読みなおす」をもう一度。</div>' +
      '<div class="s">・「ファイルを開くことができません」など → 橋わたしが消えています。作り直してください（くらしの手帳 › 設定 › Google連携 に手順があります）。</div>' +
      '<div class="s">・「承認が必要です」など → Apps Script でそのプロジェクトを開き、上の「▷ 実行」を1回おして、許可してください。</div>' +
      '<div class="s">script.google.com にプロジェクトが1つも出ないときは、右上の丸いアイコンをおして' +
        (acc ? '、<b>' + esc(acc) + '</b> に切りかえてください' : '、橋わたしを作ったアカウントに切りかえてください') + '（ちがうアカウントで開いていることが多いです）。</div>' +
      (g && g.url ? '<a class="btn ghost" style="margin-top:8px" href="' + esc(g.url) + '" target="_blank" rel="noopener">橋わたしのページをひらく</a>' : '');
  }
  return h + '</div>';
}
/* 橋わたしを使わずに、Goodnotesのノートを入れる道（iPhoneの「ファイル」から） */
function gnNoBridgeHtml(){
  return '<div class="costbox"><div class="s"><b>橋わたしなしでも入れられます</b></div>' +
    '<div class="s">・iPhoneに「Google ドライブ」のアプリが入っていれば：下の「📁 ファイルからえらぶ」→「ブラウズ」→「Google ドライブ」→「' +
      esc(gn.folder || 'GoodNotes') + '」フォルダ → ノートのPDFをえらぶ</div>' +
    '<div class="s">・Goodnotesから：ノートを開いて、共有（□↑）→「書き出す」→「PDF」→「"ファイル"に保存」。そのあと「📁 ファイルからえらぶ」で、そのPDFをえらぶ</div>' +
    '<div style="margin-top:8px">' + btn('📁 ファイルからえらぶ', 'mk-pick', { cls:'ghost' }) + '</div></div>';
}
function gnSteps(){
  return '<div class="s">Goodnotesで：<b>設定 → 自動バックアップ → Google ドライブ</b>をオンにして、<b>ファイル形式を PDF</b> にします。' +
    'しばらくすると、Googleドライブの「' + esc(gn.folder || 'GoodNotes') + '」フォルダにノートが入ります。</div>';
}
function gnPart(){
  if(!gn.open) return '';
  var h = '';
  if(gn.from) h += '<div class="s">Goodnotesの共有リンクは、中身（手書き）をリンクから読めません。' +
    '<b>Googleドライブの自動バックアップ</b>から、同じノートをえらんでください。</div>';
  if(gn.busy === 'list') h += '<div class="s wait">ノートの一覧を読んでいます…</div>';
  else if(gn.busy === 'get') h += '<div class="s wait">' + esc(gn.msg || 'ノートを受けとっています…') + '</div>';
  else if(gn.why === 'nogas'){
    h += '<div class="warnbox"><div class="s"><b>くらしの手帳の「Google連携」をつなぐと使えます</b></div>' +
      '<div class="s">この端末で、くらしの手帳 › 設定 › <b>Google連携</b> をつないでください（ほかの端末とは、6けたのコードでもつなげます）。</div>' + gnSteps() + '</div>';
  }else if(gn.why === 'old'){
    h += '<div class="warnbox"><div class="s"><b>くらしの手帳のGoogle連携（橋わたし）を、新しい版にしてください</b></div>' +
      '<div class="s">' + GAS_UPDATE_HOW + '</div></div>';
  }else if(gn.why === 'nofolder' || gn.why === 'notpdf' || gn.why === 'empty'){
    h += '<div class="warnbox"><div class="s"><b>' + (gn.why === 'nofolder' ? 'Googleドライブに「' + esc(gn.folder || 'GoodNotes') + '」フォルダが見つかりません'
        : gn.why === 'notpdf' ? 'バックアップの形式が PDF ではないようです' : 'バックアップのノートが、まだありません') + '</b></div>' + gnSteps() +
      (gn.why === 'nofolder' ? '<div class="s">フォルダの名前を変えているときは、くらしの手帳 › 設定 › Google連携 の「手書きノートのフォルダ」を同じ名前にしてください。</div>' : '') +
      '</div>';
  }else if(gn.why === 'broken' || gn.why === 'login'){
    h += gnFixHtml(gn.why);
  }else if(gn.err){
    h += '<div class="warnbox"><div class="s">' + (gn.items ? '' : 'ノートの一覧を読めませんでした：') + esc(gn.err) + '</div></div>';
  }
  /* 一覧が読めないときは、橋わたしを使わない道も見せる */
  if(!gn.busy && !gn.items && gn.why && gn.why !== 'nofolder' && gn.why !== 'notpdf' && gn.why !== 'empty') h += gnNoBridgeHtml();
  if(!gn.busy && gasOld() && gn.why !== 'broken' && gn.why !== 'login' && gn.why !== 'net'){
    h += '<div class="s gnhint">💡 大きいノートが読めないときは、橋わたしを新しい版にしてください（ノートを少しずつ読めるようになります）。' + esc(GAS_UPDATE_HOW) + '</div>';
  }
  if(gn.items && gn.why !== 'nofolder' && gn.why !== 'notpdf' && !(gn.why === 'empty' && !gn.q)){
    var n = Object.keys(gn.pick).filter(function(id){ return gn.pick[id]; }).length;
    h += '<div class="pair" style="margin-top:8px"><input id="gn_q" type="search" placeholder="ノートの名前でさがす" value="' + esc(inVal('gn_q', gn.q)) + '">' +
      btn('さがす', 'gn-search', { cls:'ghost' }) + '</div>' +
      (gn.items.length ? gnSortBar() + '<div class="gnlist">' + gnListHtml() + '</div>' : '<div class="s">そのことばのノートは見つかりません。</div>') +
      btn(n ? '📓 えらんだノートを読む（' + n + '）' : 'ノートをえらんでください', 'gn-take', { cls:'main', dis:!n || !!gn.busy });
  }
  return '<div id="gn-sec">' + section('📓 Goodnotesのノート', 'Googleドライブの自動バックアップ',
    h + '<div class="pair" style="margin-top:8px">' + btn('一覧を読みなおす', 'gn-reload', { cls:'ghost', dis:!!gn.busy }) +
      btn('とじる', 'gn-close', { cls:'ghost' }) + '</div>') + '</div>';
}

onAct('gn-open', function(){ gnOpen(''); });
onAct('gn-close', function(){ gn.open = 0; gn.from = ''; render(); });
onAct('gn-reload', function(){ gn.items = null; gnLoad(); });
onAct('gn-search', function(){ gn.q = String(elVal('gn_q') || '').trim(); gn.items = null; gn.pick = {}; gnLoad(); });
onAct('gn-pick', function(d){ gn.pick[d.v] = !gn.pick[d.v]; gnRender(); });
onAct('gn-fold', function(d){ gn.closed = gn.closed || {}; gn.closed[d.v] = !gn.closed[d.v]; gnRender(); });
onAct('gn-sort', function(d){ gn.sort = d.v || ''; render(); var el = document.querySelector('.gnlist'); if(el) el.scrollTop = 0; });
onAct('gn-take', function(){ gnTake(); });

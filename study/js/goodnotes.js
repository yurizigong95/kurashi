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
  if(typeof window !== 'undefined' && window.__FAKE_GAS) return { url:'https://script.google.com/fake', token:'test', fake:window.__FAKE_GAS };
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
      throw gnErr('net', /abort/i.test(String(e && (e.name || e.message))) ? '橋わたしから返事がありませんでした' : 'ネットにつながりませんでした');
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
  }else if(gn.err){
    h += '<div class="warnbox"><div class="s">' + (gn.items ? '' : 'ノートの一覧を読めませんでした：') + esc(gn.err) + '</div></div>';
  }
  if(!gn.busy && gasOld()){
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

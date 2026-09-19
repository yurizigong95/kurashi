/* くらしの手帳：検索・文字の大きさ・ホーム画面・データの点検・今日の自動評価 */
/* ============================== 共通 ============================== */
var C9_LKEY = KEY + ':core2';     /* この端末だけに置くもの（点検した日・自動の評価をはじめた日） */
function c9Local(){
  try{ var o = JSON.parse(localStorage.getItem(C9_LKEY) || 'null'); return (o && typeof o === 'object') ? o : {}; }catch(e){ return {}; }
}
function c9LocalSet(k, v){
  try{ var o = c9Local(); o[k] = v; localStorage.setItem(C9_LKEY, JSON.stringify(o)); }catch(e){}
}
/* くらべるための形：全角・半角をそろえ（NFKC）、小文字にし、カタカナをひらがなにする */
function c9Norm(s){
  s = String(s == null ? '' : s);
  try{ s = s.normalize('NFKC'); }catch(e){}
  s = s.toLowerCase().replace(/[ァ-ヶ]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  return s.replace(/\s+/g, ' ');
}
function c9Words(q){ return c9Norm(q).trim().split(' ').filter(Boolean); }
function c9Hit(text, words){
  var n = c9Norm(text);
  for(var i = 0; i < words.length; i++){ if(n.indexOf(words[i]) < 0) return false; }
  return words.length > 0;
}
/* 長い文から、見つかったところのまわりだけ */
function c9Snip(text, words, max){
  text = String(text || '').replace(/\s+/g, ' ').trim(); max = max || 60;
  if(text.length <= max) return text;
  var at = words && words.length ? c9Norm(text).indexOf(words[0]) : 0;
  if(at < 0) at = 0;
  var st = Math.max(0, at - 18);
  return (st > 0 ? '…' : '') + text.slice(st, st + max) + (st + max < text.length ? '…' : '');
}
/* data-* の属性（足した機能の検索の結果から。オブジェクトでも文字でもよい） */
function c9Attrs(a){
  if(!a) return '';
  if(typeof a === 'string') return /^(\s*data-[a-z0-9-]+="[^"<>]*")*\s*$/i.test(a) ? ' ' + a.trim() : '';
  if(typeof a !== 'object') return '';
  return Object.keys(a).map(function(k){
    var nm = String(k).toLowerCase().replace(/[^a-z0-9-]/g, '');
    if(!nm) return '';
    if(nm.indexOf('data-') !== 0) nm = 'data-' + nm;
    return ' ' + nm + '="' + esc(a[k] == null ? '' : a[k]) + '"';
  }).join('');
}
function c9Md(ymd){ if(!isYmd(ymd)) return ''; var a = ymd.split('-'); return (+a[1]) + '/' + (+a[2]); }
function c9DateLabel(s){ return isYmd(s) ? ymdLabel(s) : (s ? String(s) : '日付なし'); }
/* 別の画面へ（タブに出していない画面でも、一時的に開く） */
function c9Go(app, setup){
  appId = app;
  if(setup) setup();
  var vis = APPS_VISIBLE().some(function(a){ return a[0] === app; });
  c9TempApp = vis ? '' : app;
  if(isTyping()) try{ document.activeElement.blur(); }catch(e){}
  render(); window.scrollTo(0, 0);
}
function c9ScrollTo(sel){
  setTimeout(function(){ var el = document.querySelector(sel); if(el) el.scrollIntoView({ block:'start', behavior:'smooth' }); }, 60);
}

/* ============================== 文字の大きさ（#189） ============================== */
/* 「システムに合わせる」のいまの大きさ（見本に出す）。iPhone は -apple-system-body、ほかはブラウザの基本の大きさ */
var c9SysCache = 0;
function c9SysPx(){
  if(c9SysCache) return c9SysCache;
  var px = 15;
  try{
    var p = document.createElement('span');
    p.style.position = 'absolute'; p.style.visibility = 'hidden';
    p.style.font = '-apple-system-body';
    var apple = !!p.style.font;
    if(!apple) p.style.fontSize = 'medium';
    document.body.appendChild(p);
    var v = parseFloat(getComputedStyle(p).fontSize) || 16;
    p.parentNode.removeChild(p);
    px = apple ? v * 15 / 17 : v * 15 / 16;
  }catch(e){}
  c9SysCache = Math.round(px * 10) / 10;
  return c9SysCache;
}
function c9FsSettings(){
  var cur = c9FsNow().id, sys = c9SysPx();
  return '<label class="f">文字の大きさ</label>' +
    '<div class="c9fsgrid">' + FONTS.map(function(f){
      var on = (f.id === cur), px = f.px || sys;
      return '<button data-act="set-fs" data-v="' + f.id + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="c9fsa" aria-hidden="true" style="font-size:' + px + 'px">あ</span>' +
        '<span class="c9fsn">' + esc(f.name) + '</span>' +
        (f.id === 'sys' ? '<span class="c9fss">いまは約' + Math.round(sys) + '</span>' : '') + '</button>';
    }).join('') + '</div>' +
    '<div class="c9fsdemo" aria-label="見本">' +
      '<div class="s2" style="margin-bottom:4px">見本（いまの大きさ）</div>' +
      '<div class="t"><b>明日は1限から「看護学概論」</b></div>' +
      '<div class="s2">9:00 開始・N-204／課題「レポート」の締切は 9月25日（木）</div>' +
      '<div class="pillrow" style="margin:8px 0 0"><button type="button" class="on" tabindex="-1">ボタン</button><button type="button" tabindex="-1">もうひとつ</button></div>' +
    '</div>' +
    '<p class="note" style="margin:-2px 0 12px">押すとすぐに、アプリ全体の文字の大きさが変わります。「システムに合わせる」は、iPhone・iPad なら 設定 › 画面表示と明るさ › テキストサイズ で決めた大きさになります。</p>';
}

/* ============================== ホーム画面とタブ（#191） ============================== */
var C9_HOME_PAGES = [['today','今日'],['tomo','明日'],['week','今週'],['life','くらし']];
var C9_ICON = { brief:'☀️', weather:'⛅', items:'🎒', events:'📅', classes:'🏫', transit:'🚃', unkou:'🚌', find:'🔎', review:'⭐', leave:'🚪',
  memo:'📝', money:'💴', banners:'📣', next10:'🗓', days:'📆', notes:'🗒', c9yday:'🏅', c9check:'🩺' };
var c9HomePg = 'today';
var c9Drag = null;
function c9TabNames(){ var n = {}; TAB_DEFS.forEach(function(t){ n[t[0]] = t[1] === '⚙' ? '設定' : t[1]; }); return n; }
function c9PageLabels(pg){ var l = {}; (PAGE_SECTIONS[pg] || []).forEach(function(x){ l[x[0]] = x[1]; }); return l; }
function c9HomeIds(kind, pg){
  if(kind === 'tab') return (S.ui.tabs || []).map(function(t){ return t[0]; });
  if(kind === 'sub') return subTabs('today').map(function(t){ return t[0]; });
  return pageOrder(pg);
}
function c9HomeRow(kind, pg, id, name, i, n, on, fixed){
  var a = ' data-kind="' + kind + '" data-pg="' + esc(pg) + '" data-id="' + esc(id) + '"';
  return '<div class="c9hrow' + (on ? '' : ' off') + '" data-id="' + esc(id) + '">' +
    '<button type="button" class="c9grip" aria-label="' + esc(name) + ' をおしたまま上下に動かす" title="おしたまま上下に動かす">≡</button>' +
    '<span class="grow c9hname">' + esc(name) + '</span>' +
    '<button class="mini" data-act="c9-home-mv"' + a + ' data-d="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="上へ">↑</button>' +
    '<button class="mini" data-act="c9-home-mv"' + a + ' data-d="1"' + (i === n - 1 ? ' disabled' : '') + ' aria-label="下へ">↓</button>' +
    (fixed ? '<span class="b cr c9fixed">いつも出す</span>'
           : '<button class="mini c9tg' + (on ? ' on' : '') + '" data-act="c9-home-tg"' + a + ' aria-pressed="' + (on ? 'true' : 'false') + '">' + (on ? '出す' : '出さない') + '</button>') +
    '</div>';
}
function c9HomePreview(pg){
  var names = c9TabNames(), labels = c9PageLabels(pg);
  var tabs = (S.ui.tabs || []).filter(function(t){ return t[1] || t[0] === 'set'; });
  var subs = subVisible('today');
  var ids = pageOrder(pg).filter(function(id){ return !pageHidden(pg, id); });
  var hero = (pg === 'today' || pg === 'tomo') ? '<div class="c9ph-hero">' + (pg === 'today' ? '日付・あいさつ' : '明日の日付') + '</div>' : '';
  return '<div class="c9phone" aria-label="見本">' +
    '<div class="c9ph-cap">見本</div>' +
    '<div class="c9ph-tabs">' + tabs.map(function(t){ return '<span class="' + (t[0] === 'today' ? 'on' : '') + '">' + esc(names[t[0]] || t[0]) + '</span>'; }).join('') + '</div>' +
    '<div class="c9ph-sub">' + subs.map(function(s){ return '<span class="' + (s[0] === pg ? 'on' : '') + '">' + esc(s[1]) + '</span>'; }).join('') + '</div>' +
    '<div class="c9ph-body">' + hero +
      (ids.length ? ids.map(function(id){ return '<div class="c9ph-blk"><i aria-hidden="true">' + (C9_ICON[id] || '▫️') + '</i>' + esc(labels[id] || id) + '</div>'; }).join('')
                  : '<div class="c9ph-empty">なにも出しません</div>') +
    '</div></div>';
}
function c9HomeInner(){
  var pg = C9_HOME_PAGES.some(function(p){ return p[0] === c9HomePg; }) ? c9HomePg : 'today';
  var labels = c9PageLabels(pg), ids = pageOrder(pg);
  var names = c9TabNames();
  var subs = subTabs('today'), subHide = (S.ui.subHide || {}).today || {};
  var tabs = S.ui.tabs || [];
  return '<p class="note" style="margin-top:0">今日タブ（ホーム画面）に出すものと、その並びを決めます。<b>≡</b> をおしたまま上下に動かすか、↑↓ で動かします。「見本」で、どう見えるかをたしかめられます。</p>' +
    '<label class="f">どの画面をととのえる？</label>' +
    '<div class="pillrow">' + C9_HOME_PAGES.map(function(p){
      return '<button data-act="c9-home-pg" data-v="' + p[0] + '" class="' + (pg === p[0] ? 'on' : '') + '">' + p[1] + '</button>';
    }).join('') + '</div>' +
    '<div class="c9homegrid">' +
      '<div class="c9hlist" data-kind="page" data-pg="' + pg + '">' + ids.map(function(id, i){
        return c9HomeRow('page', pg, id, labels[id] || id, i, ids.length, !pageHidden(pg, id), false);
      }).join('') + '</div>' +
      c9HomePreview(pg) +
    '</div>' +
    '<label class="f">今日タブの中のタブ</label>' +
    '<div class="c9hlist" data-kind="sub" data-pg="today">' + subs.map(function(s, i){
      return c9HomeRow('sub', 'today', s[0], s[1], i, subs.length, !subHide[s[0]], false);
    }).join('') + '</div>' +
    '<label class="f">アプリのタブ（いちばん上の切りかえ）</label>' +
    '<div class="c9hlist" data-kind="tab" data-pg="">' + tabs.map(function(t, i){
      return c9HomeRow('tab', '', t[0], names[t[0]] || t[0], i, tabs.length, !!t[1] || t[0] === 'set', t[0] === 'set');
    }).join('') + '</div>' +
    '<button class="btn ghost" data-act="c9-home-reset">はじめの並びにもどす</button>' +
    '<p class="note">もどしたあとでも、下に出る「取り消す」で、いまの並びにもどせます。「履修」は抽選のシミュレーターです。</p>';
}
function c9HomeSettings(){
  var open = !!(S.ui.setOpen && S.ui.setOpen.c9home);
  var hid = 0;
  C9_HOME_PAGES.forEach(function(p){ var h = (S.ui.pageHide || {})[p[0]] || {}; Object.keys(h).forEach(function(k){ if(h[k]) hid++; }); });
  return foldSection('c9home', 'ホーム画面とタブ', '出すもの・並び' + (hid ? '（' + hid + 'こ かくしています）' : ''), open ? c9HomeInner() : '');
}
function c9HomeLink(pg){
  return '<div class="c9homelink"><button class="mini" data-act="c9-go-home" data-pg="' + esc(pg || 'today') + '">🏠 この画面に出すもの・並びを変える</button></div>';
}
function c9HomeSetOrder(kind, pg, ids){
  var cur = c9HomeIds(kind, pg);
  ids = ids.filter(function(id, i){ return cur.indexOf(id) >= 0 && ids.indexOf(id) === i; });
  cur.forEach(function(id){ if(ids.indexOf(id) < 0) ids.push(id); });
  if(ids.join(',') === cur.join(',')) return false;
  if(kind === 'tab'){
    var m = {}; S.ui.tabs.forEach(function(t){ m[t[0]] = t; });
    S.ui.tabs = ids.map(function(id){ return m[id]; });
  }else if(kind === 'sub'){
    S.ui.subOrder = S.ui.subOrder || {}; S.ui.subOrder.today = ids;
  }else{
    S.ui.pageOrder = S.ui.pageOrder || {}; S.ui.pageOrder[pg] = ids;
  }
  touch('ui');
  return true;
}
/* 出す・出さないを切りかえる。かえした言葉（'出す'/'出さない'）、できなかったら '' */
function c9HomeToggle(kind, pg, id){
  if(kind === 'tab'){
    var tb = (S.ui.tabs || []).filter(function(t){ return t[0] === id; })[0];
    if(!tb || id === 'set') return '';
    tb[1] = tb[1] ? 0 : 1; touch('ui');
    return tb[1] ? '出す' : '出さない';
  }
  if(kind === 'sub'){
    S.ui.subHide = S.ui.subHide || {}; S.ui.subHide.today = S.ui.subHide.today || {};
    var will = !S.ui.subHide.today[id];
    if(will && subVisible('today').length <= 1){ toast('最後の1つはかくせません', true); return ''; }
    S.ui.subHide.today[id] = will ? 1 : 0; touch('ui');
    return will ? '出さない' : '出す';
  }
  S.ui.pageHide = S.ui.pageHide || {}; S.ui.pageHide[pg] = S.ui.pageHide[pg] || {};
  S.ui.pageHide[pg][id] = S.ui.pageHide[pg][id] ? 0 : 1; touch('ui');
  return S.ui.pageHide[pg][id] ? '出さない' : '出す';
}
function c9HomeReset(){
  S.ui.pageOrder = S.ui.pageOrder || {}; S.ui.pageHide = S.ui.pageHide || {};
  C9_HOME_PAGES.forEach(function(p){ delete S.ui.pageOrder[p[0]]; delete S.ui.pageHide[p[0]]; });
  S.ui.subOrder = S.ui.subOrder || {}; S.ui.subHide = S.ui.subHide || {};
  delete S.ui.subOrder.today; delete S.ui.subHide.today;
  var tabs = UI_DEFAULT.tabs.map(function(t){ return t.slice(); });
  TAB_DEFS.forEach(function(t){ if(!tabs.some(function(x){ return x[0] === t[0]; })) tabs.splice(Math.max(0, tabs.length - 1), 0, [t[0], 1]); });
  S.ui.tabs = tabs;
  touch('ui');
}
function c9HomeName(kind, pg, id){
  if(kind === 'tab') return c9TabNames()[id] || id;
  if(kind === 'sub') return (subTabs('today').filter(function(t){ return t[0] === id; })[0] || [id, id])[1];
  return c9PageLabels(pg)[id] || id;
}
/* ≡ をおしたまま動かす（指でもマウスでも） */
document.addEventListener('pointerdown', function(e){
  var g = e.target && e.target.closest ? e.target.closest('.c9grip') : null;
  if(!g) return;
  var row = g.closest('.c9hrow'), list = row && row.parentNode;
  if(!row || !list || !list.classList.contains('c9hlist')) return;
  e.preventDefault();
  c9Drag = { row:row, list:list, moved:false };
  row.classList.add('c9drag');
  try{ g.setPointerCapture(e.pointerId); }catch(err){}
});
document.addEventListener('pointermove', function(e){
  if(!c9Drag) return;
  e.preventDefault();
  var rows = [].slice.call(c9Drag.list.querySelectorAll('.c9hrow')), before = null;
  for(var i = 0; i < rows.length; i++){
    if(rows[i] === c9Drag.row) continue;
    var b = rows[i].getBoundingClientRect();
    if(e.clientY < b.top + b.height / 2){ before = rows[i]; break; }
  }
  if(before !== c9Drag.row.nextSibling && before !== c9Drag.row){
    c9Drag.list.insertBefore(c9Drag.row, before);
    c9Drag.moved = true;
  }
}, { passive:false });
function c9DragEnd(){
  if(!c9Drag) return;
  var d = c9Drag; c9Drag = null;
  d.row.classList.remove('c9drag');
  if(!d.moved) return;
  var ids = [].map.call(d.list.querySelectorAll('.c9hrow'), function(r){ return r.dataset.id; });
  var kind = d.list.dataset.kind, pg = d.list.dataset.pg || '';
  undoable('c9-home-drag', function(){
    if(c9HomeSetOrder(kind, pg, ids)){ toast('並びを変えました'); commit(); }
    else render();
  });
}
document.addEventListener('pointerup', c9DragEnd);
document.addEventListener('pointercancel', c9DragEnd);

/* ============================== アプリ全体の検索（#195） ============================== */
var c9Q = '', c9From = '', c9More = {}, c9QTimer = null;
var C9_RECENT = 'core2:recent';          /* S.kmData のキー（最近さがしたことば。同期する） */
function c9Recent(){
  var o = (S.kmData || {})[C9_RECENT];
  return (o && Array.isArray(o.list)) ? o.list.filter(function(x){ return typeof x === 'string' && x; }).slice(0, 10) : [];
}
function c9SaveRecent(q){
  q = String(q || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if(!q) return false;
  var list = c9Recent();
  if(list[0] === q) return false;
  list = [q].concat(list.filter(function(x){ return x !== q; })).slice(0, 10);
  S.kmData = S.kmData || {};
  S.kmData[C9_RECENT] = { list:list, mt:Date.now() };
  touch('kmData');
  return true;
}
function c9SearchBtn(){
  return '<button id="c9sbtn" type="button" data-act="c9-search-open" title="アプリの中をさがす" aria-label="アプリの中をさがす">' +
    '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.3" fill="none" stroke="currentColor" stroke-width="2.6"/>' +
    '<path d="M15.4 15.4L20.5 20.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg><em>検索</em></button>';
}
/* 設定の項目（名前と、さがすときのことば） */
var C9_SET_ITEMS = [
  ['s1','見た目','テーマ 色 いろ カラー スタイル フォント 文字の形 文字の大きさ もじのおおきさ 大きい文字 小さい文字 背景 イラスト 行事 かざり 祝日の授業 締切が近いと知らせる やることの並び テストの進みぐあい 天気'],
  ['chara','キャラクター','キャラ セリフ 顔'],
  ['storageBox','写真とデータの容量','写真 容量 いっぱい 消す 迷子'],
  ['trashBox','ゴミ箱','消したもの もどす'],
  ['c9home','ホーム画面とタブ','今日タブ ホーム 並べかえ ならべかえ 並び 出す 出さない 非表示 タブ'],
  ['kindSettings','予定の種類','種類 色 名前'],
  ['weekFilterSettings','今週タブに出す予定','今週 しぼる'],
  ['subTabSet','タブの中のタブ','サブタブ 並び 表示'],
  ['pageItemSet','ほかのページの項目','並び 表示 項目'],
  ['diaSettings','ダイヤの追加・お気に入り','電車 バス 時刻表 ダイヤ'],
  ['s2','通学の時間','通学 バス 電車 時限 開始 終了 時刻'],
  ['s3','大切な日・バイト','履修登録 締切 引き落とし 引落日 分給 時給 交通費 バイト先'],
  ['s4','端末どうしの同期','同期 iPad パソコン 端末の名前 写真の同期'],
  ['s5','AIそうだん・写真の読み取り','Gemini APIキー カギ AI かしこさ 話し方 書き方'],
  ['voice','声・AIの登録','声 読み上げ 音声'],
  ['gas','Google連携','Google カレンダー ドライブ 通知 バックアップ'],
  ['gasplus','ほかの端末・Gmail・スプレッドシート','Gmail スプレッドシート コード'],
  ['notify','通知（スマホ・Discord）','通知 Discord プッシュ'],
  ['links','iPhone・ショートカット・ウィジェット','iPhone ショートカット ウィジェット'],
  ['gtasks','Google ToDoリスト','ToDo タスク'],
  ['place','学校の場所','場所 位置 学校'],
  ['c9check','データの点検','点検 チェック 重複 おかしい 二重 同じ予定 日付'],
  ['s6','ファイルでのバックアップ','バックアップ 書き出し 読み込み 機種変更'],
  ['errlog','エラーの記録','エラー 不具合'],
  ['ops','エラーの自動送信（Sentry）','Sentry'],
  ['perf','表示の速さ','速さ 重い'],
  ['ver','アプリの版・アップロード','版 バージョン 更新'],
  ['whatsnew','この版で変わったこと','新しい 変わったこと']
];
function c9SetItems(){
  var list = C9_SET_ITEMS.map(function(x){ return { id:x[0], title:x[1], kw:x[2] }; });
  (typeof KM !== 'undefined' ? KM.settings : []).forEach(function(o){
    if(o && o.id && !list.some(function(x){ return x.id === o.id; })) list.push({ id:String(o.id), title:String(o.title || o.id), kw:'' });
  });
  return list;
}
/* 日付のあるものは、これから（近い順）→ すぎたもの（新しい順） */
function c9DateSort(a, b){
  var td = today(), da = a.date || '', db = b.date || '';
  var fa = isYmd(da) && da >= td, fb = isYmd(db) && db >= td;
  if(fa !== fb) return fa ? -1 : 1;
  if(da === db) return 0;
  return fa ? (da < db ? -1 : 1) : (da < db ? 1 : -1);
}
/* ことばでさがす → [{ kind, items:[{ title, sub, act, attrs, date }] }]（種類ごと） */
function c9Search(q){
  var words = c9Words(q);
  if(!words.length) return [];
  var G = {}, order = [];
  var add = function(kind, it){ if(!G[kind]){ G[kind] = []; order.push(kind); } G[kind].push(it); };
  var hit = function(){ return c9Hit([].slice.call(arguments).join(' '), words); };
  (S.events || []).forEach(function(e){
    if(!e || !e.id) return;
    var k = eventKind(e.kind);
    if(!hit(e.title, e.memo, e.subject, kindOf(k).name, c9Md(e.date), ymdLabel(e.date))) return;
    add('予定', { title:e.title || '（名前なし）', date:e.date, act:'c9-open', attrs:{ k:'ev', src:k, id:e.id, d:e.date || '' },
      sub:c9DateLabel(e.date) + (e.time ? ' ' + e.time : '') + '・' + kindOf(k).name + (e.subject ? '・' + e.subject : '') + (e.memo ? '・' + c9Snip(e.memo, words, 40) : '') });
  });
  (S.tasks || []).forEach(function(t){
    if(!t || !t.id) return;
    if(!hit(t.title, t.memo, t.subject, (t.subs || []).map(function(x){ return x && x.text; }).join(' '), c9Md(t.due), ymdLabel(t.due))) return;
    add('課題', { title:t.title || '（名前なし）', date:t.due, act:'c9-open', attrs:{ k:'task', id:t.id, d:t.due || '' },
      sub:(t.done ? '済・' : '') + (isYmd(t.due) ? '締切 ' + ymdLabel(t.due) : '期限なし') + (t.subject ? '・' + t.subject : '') + (t.memo ? '・' + c9Snip(t.memo, words, 40) : '') });
  });
  (S.exams || []).forEach(function(x){
    if(!x || !x.id) return;
    var k = (x.kind === 'quiz' || x.kind === 'kousa' || x.kind === 'exam') ? x.kind : 'exam';
    if(!hit(x.subject, x.title, x.room, x.memo, kindOf(k).name, 'テスト', c9Md(x.date), ymdLabel(x.date))) return;
    add('テスト', { title:(x.subject || kindOf(k).name) + (x.title ? '「' + x.title + '」' : ''), date:x.date, act:'c9-open', attrs:{ k:'ex', src:k, id:x.id, d:x.date || '' },
      sub:kindOf(k).name + '・' + c9DateLabel(x.date) + (x.time ? ' ' + x.time : '') + (x.room ? '・' + x.room : '') });
  });
  (S.notes || []).forEach(function(n){
    if(!n || !n.id) return;
    if(!hit(n.title, n.body, (n.checks || []).map(function(c){ return c && c.text; }).join(' '), n.link && n.link.id)) return;
    add('メモ', { title:(n.pinned ? '📌 ' : '') + (n.title || '（無題）'), date:'', act:'c9-open', attrs:{ k:'note', id:n.id },
      sub:c9Snip(n.body || (n.checks || []).map(function(c){ return c && c.text; }).join('・'), words, 60) });
  });
  termCourses().forEach(function(c){
    var cat = (typeof byCode !== 'undefined' && c.code && byCode[c.code]) ? byCode[c.code] : null;
    var teacher = (cat && cat.teacher) || ((S.courseMeta || {})[c.name] || {}).teacher || '';
    var alias = typeof courseAlias === 'function' ? courseAlias(c.name) : '';
    var room = typeof courseRoom === 'function' ? courseRoom(c.name) : c.room;
    if(!hit(c.name, alias, room, c.room, teacher, c.code, c.slotText, '授業')) return;
    add('授業', { title:c.name, date:'', act:'c9-open', attrs:{ k:'course', name:c.name },
      sub:[c.slotText, room, teacher ? teacher + ' 先生' : '', alias].filter(Boolean).join('・') });
  });
  (S.shifts || []).forEach(function(w){
    if(!w || !w.id) return;
    if(!hit(w.title || 'バイト', 'バイト シフト', w.memo, c9Md(w.date), ymdLabel(w.date), w.start)) return;
    add('バイト', { title:'バイト ' + c9DateLabel(w.date), date:w.date, act:'c9-open', attrs:{ k:'wk', src:'work', id:w.id, d:w.date || '' },
      sub:(w.start || '') + '〜' + (w.end || '') + (w.memo ? '・' + c9Snip(w.memo, words, 40) : '') });
  });
  (Array.isArray(S.spends) ? S.spends : []).forEach(function(x){
    if(!x || !x.id) return;
    var cat = typeof kbCat === 'function' ? kbCat(x.cat)[1] : '';
    if(!hit(x.title, x.memo, cat, x.acct, String(Math.abs(Number(x.amount) || 0)), '家計簿', c9Md(x.date))) return;
    add('家計簿', { title:(x.title || cat || '支出') + '　' + yen(Math.abs(Number(x.amount) || 0)), date:x.date, act:'c9-open', attrs:{ k:'spend', d:x.date || '' },
      sub:c9DateLabel(x.date) + '・' + (x.io === 'in' ? '入金' : cat) + (x.memo ? '・' + c9Snip(x.memo, words, 30) : '') });
  });
  (S.cards || []).forEach(function(c){
    if(!c || !c.id) return;
    if(!hit(c.q, c.a, c.deck)) return;
    add('暗記カード', { title:c.q || '', date:'', act:'c9-open', attrs:{ k:'card', deck:c.deck || '', id:c.id },
      sub:(c.deck ? (typeof shortName === 'function' ? shortName(c.deck) : c.deck) + '・' : '') + c9Snip(c.a, words, 40) });
  });
  (S.notices || []).slice().reverse().forEach(function(n){
    if(!n || !hit(n.text)) return;
    add('お知らせ', { title:c9Snip(n.text, words, 70), date:'', act:'c9-open', attrs:{ k:'notice' },
      sub:n.mt ? new Date(n.mt).toLocaleDateString('ja-JP') : '' });
  });
  var rooms = [['main', 'いつもの会話', S.chat || []]];
  Object.keys(S.chatRooms || {}).forEach(function(rid){ rooms.push([rid, ((S.chatMeta || {})[rid] || {}).name || rid, S.chatRooms[rid] || []]); });
  rooms.forEach(function(r){
    (Array.isArray(r[2]) ? r[2] : []).forEach(function(m){
      if(!m || !m.text || !hit(m.text)) return;
      add('相談の記録', { title:c9Snip(m.text, words, 60), date:'', act:'c9-open', attrs:{ k:'chat', room:r[0] },
        sub:r[1] + '・' + (m.role === 'user' ? 'わたし' : m.role === 'sum' ? 'まとめ' : 'AI') + (m.mt ? '・' + new Date(m.mt).toLocaleDateString('ja-JP') : '') });
    });
  });
  Object.keys(S.dayReview || {}).sort().reverse().forEach(function(k){
    var r = S.dayReview[k];
    if(!r || !r.grade) return;
    if(!hit(r.memo, r.ai, r.next, (Array.isArray(r.good) ? r.good : []).join(' '), c9Md(k), ymdLabel(k), 'ふりかえり 評価')) return;
    add('ふりかえり', { title:ymdLabel(k) + '　' + r.grade + '（' + toNum(r.point) + '点）', date:'', act:'c9-open', attrs:{ k:'review', d:k },
      sub:(r.auto ? '自動・' : '') + c9Snip(r.memo || r.next || r.ai || '', words, 50) });
  });
  c9SetItems().forEach(function(s){
    if(!hit(s.title, s.kw, '設定')) return;
    add('設定', { title:s.title, date:'', act:'c9-open', attrs:{ k:'set', id:s.id }, sub:'設定 › ' + s.title });
  });
  /* 足した機能（kmSearch）。fn(q, c9Norm) → [{ kind, title, sub, act, attrs }] */
  if(typeof KM !== 'undefined') KM.search.forEach(function(fn){
    try{
      (fn(String(q).trim(), c9Norm) || []).forEach(function(x){
        if(!x || x.title == null) return;
        add(String(x.kind || 'そのほか'), { title:String(x.title), sub:String(x.sub || ''), date:'',
          act:/^[a-z0-9-]+$/i.test(String(x.act || '')) ? String(x.act) : '', attrs:x.attrs });
      });
    }catch(e){ kmErr('検索', e); }
  });
  var DATED = { '予定':1, '課題':1, 'テスト':1, 'バイト':1, '家計簿':1 };
  return order.map(function(k){
    var items = G[k];
    if(DATED[k]) items = items.slice().sort(c9DateSort);
    return { kind:k, items:items };
  });
}
function c9HitRow(x){
  var act = x.act ? ' data-act="' + esc(x.act) + '" role="button" tabindex="0"' : '';
  return '<div class="row c9hit' + (x.act ? '' : ' noact') + '"' + act + c9Attrs(x.attrs) + '>' +
    '<div class="grow"><div class="t">' + esc(x.title) + '</div>' + (x.sub ? '<div class="s">' + esc(x.sub) + '</div>' : '') + '</div>' +
    (x.act ? '<span class="chev" aria-hidden="true">›</span>' : '') + '</div>';
}
function c9ResultsHtml(){
  var q = String(c9Q || '').trim();
  if(!q) return '';
  var groups = c9Search(q);
  if(!groups.length){
    return section('さがした結果', '0件', '<div class="empty">「' + esc(q) + '」は見つかりませんでした。ことばを短くすると、見つかることがあります。</div>');
  }
  var total = groups.reduce(function(a, g){ return a + g.items.length; }, 0);
  return '<div class="s2 c9count">' + total + '件 見つかりました（' + groups.map(function(g){ return esc(g.kind) + ' ' + g.items.length; }).join('・') + '）</div>' +
    groups.map(function(g){
      var list = c9More[g.kind] ? g.items.slice(0, 200) : g.items.slice(0, 6);
      return section(g.kind, g.items.length + '件', list.map(c9HitRow).join('') +
        (g.items.length > list.length ? '<button class="mini c9more" data-act="c9-more" data-g="' + esc(g.kind) + '">ほか ' + (g.items.length - list.length) + '件も見る</button>' : ''));
    }).join('');
}
function c9ResRefresh(){ var box = document.getElementById('c9_res'); if(box) box.innerHTML = c9ResultsHtml(); }
function c9ViewSearch(){
  var recent = c9Recent();
  return '<div class="pillrow c9sback"><button data-act="c9-search-back">‹ もどる</button></div>' +
    '<section><div class="box c9sbox">' +
      '<div class="pair"><input id="c9_q" type="search" enterkeyhint="search" autocomplete="off" aria-label="さがすことば" ' +
        'placeholder="さがすことば（例：れぽーと・カンゴ・ﾊﾞｲﾄ）" value="' + esc(c9Q) + '">' +
      '<button class="btn" style="flex:0 0 auto;padding:11px 16px" data-act="c9-search-go">さがす</button></div>' +
      (recent.length ? '<div class="c9recent"><div class="s2">最近さがしたことば</div><div class="chips">' + recent.map(function(q){
          return '<button data-act="c9-search-q" data-q="' + esc(q) + '">' + esc(q) + '</button>';
        }).join('') + '<button class="c9clr" data-act="c9-recent-clear">履歴を消す</button></div></div>' : '') +
      (String(c9Q || '').trim() ? '' : '<p class="note" style="margin:8px 0 0">予定・課題・テスト・メモ・お知らせ・暗記カード・家計簿・バイト・授業（先生・教室）・設定・相談の記録などを、まとめてさがします。ひらがなとカタカナ、全角と半角のちがいは気にしなくて大丈夫です。ことばをスペースで区切ると、ぜんぶふくむものをさがします。</p>') +
    '</div></section>' +
    '<div id="c9_res">' + c9ResultsHtml() + '</div>';
}
/* 打つそばから、結果だけを書きかえる（入力欄はそのまま） */
document.addEventListener('input', function(e){
  if(!e.target || e.target.id !== 'c9_q') return;
  c9Q = e.target.value; c9More = {};
  clearTimeout(c9QTimer);
  c9QTimer = setTimeout(c9ResRefresh, 180);
});
document.addEventListener('keydown', function(e){
  if(!e.target || e.target.id !== 'c9_q' || e.key !== 'Enter' || e.isComposing) return;
  e.preventDefault();
  c9Q = e.target.value; clearTimeout(c9QTimer); c9ResRefresh();
  if(c9SaveRecent(c9Q)){ persist(); pushRemote(); }
  try{ e.target.blur(); }catch(err){}
});
/* 結果を押したら、そのことばを「最近さがしたことば」に入れる（押した先の動きの前に） */
document.addEventListener('click', function(e){
  var t = e.target && e.target.closest ? e.target.closest('#c9_res [data-act]') : null;
  if(!t || t.dataset.act === 'c9-more') return;
  if(String(c9Q || '').trim() && c9SaveRecent(c9Q)){ persist(); pushRemote(); }
}, true);
/* 結果を押したときの行き先 */
function c9Open(t){
  var k = t.dataset.k, id = t.dataset.id || '', d = t.dataset.d || '';
  if(k === 'ev' || k === 'ex' || k === 'wk'){
    c9Go('cal', function(){ calTab = 'cal'; if(isYmd(d)){ calSel = d; calYm = d.slice(0, 7); } });
    if(typeof openDetail === 'function') openDetail(t.dataset.src, id);
    return;
  }
  if(k === 'task'){
    c9Go('todo', function(){ todoTab = 'open'; });
    if(typeof openDetail === 'function') openDetail('task', id);
    return;
  }
  if(k === 'note'){ c9Go('notes', function(){ noteView = id; }); return; }
  if(k === 'course'){
    courseView = t.dataset.name || ''; courseFrom = '';
    var tb = (S.ui.tabs || []).filter(function(x){ return x[0] === 'course'; })[0];
    courseTemp = !!(tb && !tb[1]);
    appId = 'course'; c9TempApp = ''; render(); window.scrollTo(0, 0);
    return;
  }
  if(k === 'card'){
    c9Go('anki', function(){ ankiState.mode = 'list'; ankiState.listDeck = t.dataset.deck || ''; });
    c9ScrollTo('.ankirow');
    return;
  }
  if(k === 'spend'){ c9Go('money', function(){ payTab = 'kakeibo'; if(isYmd(d)) kbYm = d.slice(0, 7); }); return; }
  if(k === 'notice'){ c9Go('news'); return; }
  if(k === 'chat'){ c9Go('chat', function(){ chatRoom = t.dataset.room || 'main'; }); return; }
  if(k === 'review'){
    c9Go('today', function(){
      todayTab = 'today'; reviewHistOpen = true;
      if(isYmd(d)){ var now = new Date(), a = d.split('-'); revHistOff = (+a[0] - now.getFullYear()) * 12 + (+a[1] - 1 - now.getMonth()); }
    });
    c9ScrollTo('.revcal');
    return;
  }
  if(k === 'set'){
    S.ui.setOpen = S.ui.setOpen || {}; S.ui.setOpen[id] = 1; touch('ui'); persist();
    c9Go('set');
    c9ScrollTo('[data-act="fold"][data-id="' + id.replace(/[^A-Za-z0-9_-]/g, '') + '"]');
    return;
  }
}

/* ============================== データの点検（#197） ============================== */
var C9_BIG_PHOTO = 1.5 * 1024 * 1024;   /* これより大きい写真は「大きい」 */
var c9BigPhotos = null;                  /* この端末の大きい写真 [{ id, bytes }]（数えるまでは null） */
var c9CheckLast = null;                  /* 前に調べた結果 { at, ng, warn, list } */
var c9CheckNote = null;                  /* 今日タブに出す小さなお知らせ { n, day } */
var C9_PART_NAME = { core:'設定・支払い', plan:'予定・課題・テスト', money:'お金・バイト', notes:'メモ・お知らせ', maps:'出欠・ふりかえりなど',
  ai:'相談の記録', logs:'記録・ゴミ箱', study:'暗記', kokushi:'国試', extra:'足した機能' };
function c9ValidYmd(s){
  if(!isYmd(s)) return false;
  var a = s.split('-'), y = +a[0];
  return toYmd(new Date(y, +a[1] - 1, +a[2])) === s && y >= 2000 && y <= 2100;
}
function c9Groups(list, keyFn){
  var m = {}, order = [];
  (Array.isArray(list) ? list : []).forEach(function(x){
    if(!x || !x.id) return;
    var k = keyFn(x); if(!k) return;
    if(!m[k]){ m[k] = []; order.push(k); }
    m[k].push(x);
  });
  return order.filter(function(k){ return m[k].length > 1; }).map(function(k){ return m[k]; });
}
function c9Size(v){ try{ return JSON.stringify(v).length; }catch(e){ return 0; } }
/* 同じものをまとめて1つにする（中身の多いほうを残す。消したものはゴミ箱へ） */
function c9KeepOne(listKey, group, better){
  var keep = group.slice().sort(better || function(a, b){ return c9Size(b) - c9Size(a) || String(a.id).localeCompare(String(b.id)); })[0];
  var n = 0;
  group.forEach(function(x){
    if(x.id === keep.id) return;
    S.trash = S.trash || [];
    S.trash.unshift({ list:listKey, obj:JSON.parse(JSON.stringify(x)), at:Date.now() });
    removeItem(listKey, x.id); n++;
  });
  if(S.trash && S.trash.length > 200) S.trash = S.trash.slice(0, 200);
  return n;
}
function c9Ids(g){ return g.map(function(x){ return x.id; }).sort().join(','); }
/* 調べる（S は変えない）→ [{ key, level:'ng'|'warn', kind, msg, fix, fixLabel, open }] */
function c9Checks(){
  var out = [], td = today(), push = function(o){ out.push(o); };
  /* 1. 同じ予定・課題・テスト */
  c9Groups(S.events, function(e){ return e.title ? [e.date, c9Norm(e.title), e.time || ''].join('|') : ''; }).forEach(function(g){
    push({ key:'dup-ev:' + c9Ids(g), level:'warn', kind:'同じ予定が2つ以上',
      msg:'「' + g[0].title + '」（' + c9DateLabel(g[0].date) + (g[0].time ? ' ' + g[0].time : '') + '）が' + g.length + 'つあります。',
      fixLabel:'1つにする', fix:function(){ return c9KeepOne('events', g); } });
  });
  c9Groups(S.tasks, function(t){ return t.title ? [t.due || '', c9Norm(t.title), c9Norm(t.subject || '')].join('|') : ''; }).forEach(function(g){
    push({ key:'dup-tk:' + c9Ids(g), level:'warn', kind:'同じ課題が2つ以上',
      msg:'「' + g[0].title + '」（締切 ' + c9DateLabel(g[0].due) + '）が' + g.length + 'つあります。',
      fixLabel:'1つにする', fix:function(){ return c9KeepOne('tasks', g, function(a, b){ return (b.done ? 1 : 0) - (a.done ? 1 : 0) || c9Size(b) - c9Size(a) || String(a.id).localeCompare(String(b.id)); }); } });
  });
  c9Groups(S.exams, function(x){ return (x.subject || x.title) ? [x.date, x.kind || '', c9Norm(x.subject || ''), c9Norm(x.title || '')].join('|') : ''; }).forEach(function(g){
    push({ key:'dup-ex:' + c9Ids(g), level:'warn', kind:'同じテストが2つ以上',
      msg:'「' + (g[0].subject || g[0].title) + '」（' + c9DateLabel(g[0].date) + '）が' + g.length + 'つあります。',
      fixLabel:'1つにする', fix:function(){ return c9KeepOne('exams', g); } });
  });
  /* 2. 日付がおかしい（ありえない日・日付なし）・終わりが始まりより前 */
  var bad = function(list, kind, src, get, name){
    (Array.isArray(list) ? list : []).forEach(function(x){
      if(!x || !x.id) return;
      var d = get(x);
      if(kind === '課題' && !d) return;           /* 課題は「期限なし」でもよい */
      if(c9ValidYmd(d)) return;
      push({ key:'bad-date:' + x.id, level:'ng', kind:'日付がおかしい',
        msg:kind + '「' + name(x) + '」の日付がおかしいです（' + (d ? d : '日付がありません') + '）。ひらいて、日付を入れなおしてください。',
        open:{ k:kind === '課題' ? 'task' : kind === 'バイト' ? 'wk' : kind === 'テスト' ? 'ex' : 'ev', src:src(x), id:x.id, d:'' } });
    });
  };
  bad(S.events, '予定', function(e){ return eventKind(e.kind); }, function(e){ return e.date; }, function(e){ return e.title || '（名前なし）'; });
  bad(S.tasks, '課題', function(){ return 'task'; }, function(t){ return t.due; }, function(t){ return t.title || '（名前なし）'; });
  bad(S.exams, 'テスト', function(x){ return (x.kind === 'quiz' || x.kind === 'kousa') ? x.kind : 'exam'; }, function(x){ return x.date; }, function(x){ return x.subject || x.title || 'テスト'; });
  bad(S.shifts, 'バイト', function(){ return 'work'; }, function(w){ return w.date; }, function(){ return 'バイト'; });
  (S.events || []).forEach(function(e){
    if(!e || !e.id || !c9ValidYmd(e.date) || !e.dateEnd) return;
    if(!c9ValidYmd(e.dateEnd) || e.dateEnd < e.date){
      push({ key:'bad-end:' + e.id, level:'warn', kind:'終わりの日が始まりより前',
        msg:'予定「' + (e.title || '') + '」の終わりの日（' + c9DateLabel(e.dateEnd) + '）が、始まりの日（' + ymdLabel(e.date) + '）より前です。',
        fixLabel:'終わりの日を消す', fix:function(){ e.dateEnd = ''; e.mt = Date.now(); return 1; } });
    }
  });
  /* 3. バイトの時間の重なり */
  var byDay = {};
  (S.shifts || []).forEach(function(w){ if(w && w.id && c9ValidYmd(w.date)) (byDay[w.date] = byDay[w.date] || []).push(w); });
  Object.keys(byDay).sort().forEach(function(d){
    var list = byDay[d];
    if(list.length < 2) return;
    var same = c9Groups(list, function(w){ return (w.start || '') + '-' + (w.end || ''); });
    same.forEach(function(g){
      push({ key:'dup-wk:' + c9Ids(g), level:'warn', kind:'同じバイトが2つ以上',
        msg:ymdLabel(d) + ' ' + (g[0].start || '') + '〜' + (g[0].end || '') + ' のバイトが' + g.length + 'つあります。',
        fixLabel:'1つにする', fix:function(){ return c9KeepOne('shifts', g); } });
    });
    var span = function(w){ var a = minutesOf(w.start), b = minutesOf(w.end); if(a == null || b == null) return null; if(b <= a) b += 1440; return [a, b]; };
    for(var i = 0; i < list.length; i++){
      for(var j = i + 1; j < list.length; j++){
        var A = span(list[i]), B = span(list[j]);
        if(!A || !B) continue;
        if(A[0] === B[0] && A[1] === B[1]) continue;       /* まったく同じは上で */
        if(A[0] < B[1] && B[0] < A[1]){
          push({ key:'ovl-wk:' + [list[i].id, list[j].id].sort().join(','), level:'warn', kind:'バイトの時間が重なっている',
            msg:ymdLabel(d) + '：' + list[i].start + '〜' + list[i].end + ' と ' + list[j].start + '〜' + list[j].end + ' が重なっています。',
            open:{ k:'wk', src:'work', id:list[j].id, d:d } });
        }
      }
    }
  });
  /* 4. 消えた授業にひもづいたメモ */
  var names = {};
  termsAll().forEach(function(t){ (t.courses || []).forEach(function(c){ if(c && c.name) names[c.name] = 1; }); });
  (S.notes || []).forEach(function(n){
    if(!n || !n.id || !n.link || n.link.type !== 'course' || !n.link.id || names[n.link.id]) return;
    push({ key:'orphan-note:' + n.id, level:'warn', kind:'消えた授業につながったメモ',
      msg:'メモ「' + (n.title || '（無題）') + '」は、時間割にない授業「' + n.link.id + '」につながっています。',
      fixLabel:'つながりを外す', fix:function(){ n.link = null; n.mt = Date.now(); return 1; } });
  });
  /* 5. 大きすぎる写真（この端末の写真を数えたとき） */
  if(c9BigPhotos && c9BigPhotos.length){
    push({ key:'big-photo:' + c9BigPhotos.map(function(x){ return x.id; }).join(','), level:'warn', kind:'大きすぎる写真',
      msg:'大きい写真が' + c9BigPhotos.length + '枚あります（いちばん大きいのは ' + sizeText(c9BigPhotos[0].bytes) + '）。同期や表示がおそくなります。',
      fixLabel:'小さくする', fix:function(){ return c9ShrinkPhotos(); } });
  }
  /* 6. 同期の大きさ（1つの文書の上限に近い・分けて送っている） */
  try{
    var rp = (typeof syncState !== 'undefined' && syncState.remote && syncState.remote.parts) || {};
    var tot = 0;
    Object.keys(rp).forEach(function(p){
      var m = rp[p] || {};
      tot += Number(m.s) || 0;
      if(toNum(m.n) >= 3) push({ key:'sync-part:' + p, level:'warn', kind:'同期のデータが大きい',
        msg:'「' + (C9_PART_NAME[p] || p) + '」のデータが大きくなっています（' + sizeText(Number(m.raw) || Number(m.s) || 0) + '・' + toNum(m.n) + 'つに分けて送っています）。' +
          (p === 'ai' ? '古い会話を消すか「古い会話をまとめて軽くする」を使うと軽くなります。' : '古いものを整理すると軽くなります。') });
    });
    if(tot > 8 * 1024 * 1024) push({ key:'sync-total', level:'ng', kind:'同期のデータが大きすぎる',
      msg:'同期しているデータが ' + sizeText(tot) + ' あります（圧縮後）。古い会話・ゴミ箱・写真を整理してください。' });
    Object.keys(S.kmData || {}).forEach(function(k){
      var sz = c9Size(S.kmData[k]);
      if(sz > 8 * 1024) push({ key:'kmdata:' + k, level:'warn', kind:'足した機能の記録が大きい',
        msg:'「' + k + '」の記録が ' + sizeText(sz) + ' あります（1つ数KBまでの約束です）。' });
    });
    var si = storageInfo();
    if(si.pct >= 85) push({ key:'storage', level:'ng', kind:'この端末の保存がいっぱい', msg:'文字のデータの入れものが ' + si.pct + '% です。設定 › 写真とデータの容量 から整理してください。' });
    else if(si.pct >= 70) push({ key:'storage', level:'warn', kind:'この端末の保存が多い', msg:'文字のデータの入れものが ' + si.pct + '% になりました。' });
  }catch(e){}
  /* 7. 締切がすぎて、未完了のまま長い（2週間より前） */
  var lim = shiftDate(td, -14);
  var old = (S.tasks || []).filter(function(t){ return t && t.id && !t.done && c9ValidYmd(t.due) && t.due < lim; });
  if(old.length){
    push({ key:'old-task:' + c9Ids(old), level:'warn', kind:'締切から2週間以上たった課題',
      msg:old.length + '件の課題が、締切から2週間以上たっても未完了です（' + old.slice(0, 3).map(function(t){ return '「' + t.title + '」'; }).join('') + (old.length > 3 ? 'ほか' : '') + '）。出しおわっていれば完了にしましょう。',
      fixLabel:'ぜんぶ完了にする', fix:function(){ old.forEach(function(t){ t.done = 1; t.mt = Date.now(); }); return old.length; } });
  }
  /* 8. 家計簿の同じ明細の二重 */
  c9Groups(S.spends, function(x){
    var a = Math.abs(Number(x.amount) || 0);
    return a ? [x.date, x.io === 'in' ? 'in' : 'out', a, c9Norm(x.title || '').replace(/ /g, '')].join('|') : '';
  }).forEach(function(g){
    push({ key:'dup-sp:' + c9Ids(g), level:'warn', kind:'家計簿の同じ明細',
      msg:c9DateLabel(g[0].date) + '「' + (g[0].title || '（内容なし）') + '」' + yen(Math.abs(Number(g[0].amount) || 0)) + ' が' + g.length + 'つあります（本当に2回使ったなら、そのままで大丈夫です）。',
      fixLabel:'1つにする', fix:function(){ return c9KeepOne('spends', g); } });
  });
  /* 9. 暗記カードの二重 */
  c9Groups(S.cards, function(c){ return c.q ? [c.deck || '', c9Norm(c.q)].join('|') : ''; }).forEach(function(g){
    push({ key:'dup-card:' + c9Ids(g), level:'warn', kind:'同じ暗記カード',
      msg:'「' + String(g[0].q).slice(0, 40) + '」のカードが' + g.length + '枚あります。',
      fixLabel:'1枚にする', fix:function(){ return c9KeepOne('cards', g, function(a, b){ return toNum(b.reps) - toNum(a.reps) || c9Size(b) - c9Size(a) || String(a.id).localeCompare(String(b.id)); }); } });
  });
  /* 10. 足した機能の点検（kmCheck） */
  if(typeof KM !== 'undefined') KM.checks.forEach(function(fn, ki){
    try{
      (fn() || []).forEach(function(x){
        if(!x || !x.msg) return;
        push({ key:'km:' + ki + ':' + c9Norm(x.msg).slice(0, 80), level:x.level === 'ng' ? 'ng' : 'warn', kind:String(x.kind || x.title || '足した機能'),
          msg:String(x.msg), fix:typeof x.fix === 'function' ? x.fix : null, fixLabel:x.fixLabel || '直す' });
      });
    }catch(e){ kmErr('データの点検', e); }
  });
  return out.sort(function(a, b){ return (a.level === 'ng' ? 0 : 1) - (b.level === 'ng' ? 0 : 1); });
}
function c9CheckRun(){
  var list = c9Checks();
  c9CheckLast = { at:Date.now(), list:list,
    ng:list.filter(function(x){ return x.level === 'ng'; }).length, warn:list.filter(function(x){ return x.level !== 'ng'; }).length };
  return c9CheckLast;
}
/* この端末の写真を1枚ずつ数えて、大きいものをさがす */
function c9ScanPhotos(){
  if(typeof photoDB !== 'function') return Promise.resolve([]);
  return photoDB().then(function(db){
    return new Promise(function(res){
      var out = [];
      var tx = db.transaction(PDB_STORE, 'readonly');
      var q = tx.objectStore(PDB_STORE).openCursor();
      q.onsuccess = function(){
        var cur = q.result;
        if(!cur){ res(out); return; }
        var v = cur.value, b = 0;
        if(typeof v === 'string'){ var i = v.indexOf(','); b = (i >= 0 && /;base64/i.test(v.slice(0, i))) ? Math.round((v.length - i - 1) * 3 / 4) : v.length; }
        else if(v && v.size) b = v.size;
        if(b > C9_BIG_PHOTO && String(cur.key).indexOf('chimg_') !== 0) out.push({ id:String(cur.key), bytes:b });
        cur['continue']();
      };
      q.onerror = function(){ res(out); };
    });
  })['catch'](function(){ return []; }).then(function(list){
    c9BigPhotos = list.sort(function(a, b){ return b.bytes - a.bytes; });
    return c9BigPhotos;
  });
}
function c9Recompress(url){
  return new Promise(function(res){
    var img = new Image();
    img.onload = function(){
      try{
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, 1800 / Math.max(w, h, 1));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.78));
      }catch(e){ res(null); }
    };
    img.onerror = function(){ res(null); };
    img.src = url;
  });
}
/* 大きい写真を小さくし直す（同じ名前のまま入れかえる） */
async function c9ShrinkPhotos(){
  var list = (c9BigPhotos || []).slice(), n = 0;
  for(var i = 0; i < list.length; i++){
    try{
      var url = await photoGetLocal(list[i].id);
      if(!url || typeof url !== 'string') continue;
      var nu = await c9Recompress(url);
      if(nu && nu.length < url.length * 0.9){ await photoPut(list[i].id, nu); n++; }
    }catch(e){ kmErr('写真を小さくする', e); }
  }
  await c9ScanPhotos();
  return n;
}
function c9CheckHtml(){
  if(!(S.ui.setOpen && S.ui.setOpen.c9check)) return '';
  var r = c9CheckRun();
  var fixable = r.list.filter(function(x){ return x.fix; }).length;
  var h = '<p class="note" style="margin-top:0">データのおかしいところを、アプリが調べます（同じものが2つ・ありえない日付・バイトの重なり・大きすぎる写真 など）。' +
    '「直す」ボタンのあるものは、押すと直します（消したものはゴミ箱に入ります。すぐなら「取り消す」でもどせます）。アプリを開いたときも、1日1回自動で調べます。</p>';
  h += !r.list.length ? '<div class="msg ok">おかしいところは見つかりませんでした。</div>'
    : '<div class="msg ' + (r.ng ? 'ng' : 'ok') + '">' + (r.ng ? 'あぶないところが <b>' + r.ng + 'か所</b>' + (r.warn ? '、' : '') : '') +
      (r.warn ? '気になるところが <b>' + r.warn + 'か所</b>' : '') + ' あります。</div>';
  h += r.list.map(function(x){
    return '<div class="row c9chk ' + (x.level === 'ng' ? 'c9ng' : 'c9warn') + '">' +
      '<span class="b ' + (x.level === 'ng' ? 'warn' : 'r2') + '">' + (x.level === 'ng' ? 'あぶない' : '気になる') + '</span>' +
      '<div class="grow"><div class="t">' + esc(x.kind) + '</div><div class="s c9wrap">' + esc(x.msg) + '</div></div>' +
      (x.fix ? '<button class="mini" data-act="c9-fix" data-key="' + esc(x.key) + '">' + esc(x.fixLabel || '直す') + '</button>' : '') +
      (x.open ? '<button class="mini" data-act="c9-open"' + c9Attrs(x.open) + '>ひらく</button>' : '') + '</div>';
  }).join('');
  h += '<div class="pillrow" style="margin-top:10px">' +
    '<button data-act="c9-check-run">もう一度しらべる</button>' +
    '<button data-act="c9-check-photos">写真の大きさも数える</button>' +
    (fixable > 1 ? '<button data-act="c9-fix-all">直せるものをまとめて直す</button>' : '') + '</div>';
  if(c9BigPhotos === null) h += '<p class="note">写真の大きさは、まだ数えていません（数えるのは少し時間がかかります）。</p>';
  return h;
}
/* 直す（key を渡す。'*' なら直せるものぜんぶ） */
function c9FixRun(key){
  var list = c9Checks().filter(function(x){ return x.fix && (key === '*' || x.key === key); });
  if(!list.length){ toast('もう直っているようです'); render(); return; }
  var n = 0, waits = [];
  list.forEach(function(x){
    try{
      var r = x.fix();
      if(r && typeof r.then === 'function') waits.push(r);
      else n++;
    }catch(e){ kmErr('データの点検 直す', e); }
  });
  if(n){ toast('直しました' + (n > 1 ? '（' + n + 'か所）' : '')); commit(); }
  if(waits.length){
    toast('写真を小さくしています…');
    Promise.all(waits).then(function(rs){
      var m = rs.reduce(function(a, v){ return a + (toNum(v) || 0); }, 0);
      toast(m ? m + '枚の写真を小さくしました' : '小さくできる写真はありませんでした');
      commit();
    }, function(){ toast('うまく直せませんでした', true); render(); });
  }
  if(!n && !waits.length){ toast('直せませんでした', true); render(); }
}
/* 1日1回（この端末で）自動で調べる。あぶないものがあれば、小さく知らせる */
function c9DailyCheck(force){
  var td = today();
  if(!force && c9Local().checkDay === td) return Promise.resolve(null);
  c9LocalSet('checkDay', td);
  return c9ScanPhotos().then(function(){
    var r = c9CheckRun();
    c9CheckNote = r.ng ? { n:r.ng, day:td } : null;
    if(r.ng){
      toast('データの点検：あぶないところが' + r.ng + 'か所あります（設定 › データの点検）');
      if(appId === 'today'){ if(isTyping()) renderLater(); else render(); }
    }
    return r;
  });
}
function c9CheckBanner(ctx){
  if((ctx && ctx.isToday === false) || !c9CheckNote || c9CheckNote.day !== today()) return '';
  return '<div class="bn amber c9chkbn"><span class="ic">!</span><span class="grow">データの点検で、あぶないところが<b>' + c9CheckNote.n + 'か所</b>見つかりました。' +
    '<span class="c9bnbtns"><button class="mini" data-act="c9-go-check">見て直す</button><button class="mini" data-act="c9-check-hide">とじる</button></span></span></div>';
}

/* ============================== 今日の評価（自動） ==============================
   日付が変わったあと、次にアプリを開いたときに、前の日（開かなかった日が続いていれば最大7日前まで）を評価して
   S.dayReview[日付] に入れる（auto:1・内わけ・点数・よかったこと・ひとこと）。
   ・自分でつけた評価・もうある評価は、上書きしない。
   ・mt はその日の0時（自分でつけた評価は、その日の中で押すので、かならず自分のほうが新しい）。
   ・2台で同時に開いても、同じデータからは同じものができる（mt も同じ）ので、同期が行ったり来たりしない。 */
function c9AutoMt(ymd){ var a = ymd.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]).getTime(); }
function c9EvalDay(ymd){
  var g = dayGrade(ymd);
  return { grade:g.grade, point:g.point, memo:'', ai:'', auto:1,
    items:g.items.map(function(x){ return { k:x.k, l:x.l, p:x.p, m:x.m, t:x.t }; }),
    good:g.good.slice(0, 6), next:g.next, mt:c9AutoMt(ymd) };
}
function c9AutoReview(opt){
  opt = opt || {};
  if(typeof dayGrade !== 'function') return [];
  var td = today(), yd = shiftDate(td, -1), lim = shiftDate(td, -7);
  var from = c9Local().evalFrom;
  if(!isYmd(from)){ from = yd; c9LocalSet('evalFrom', from); }      /* はじめて動いたときは、きのうから */
  if(isYmd(opt.from)) from = opt.from;
  if(from < lim) from = lim;
  if(!S.dayReview || typeof S.dayReview !== 'object' || Array.isArray(S.dayReview)) S.dayReview = {};
  var made = [];
  for(var d = from; d <= yd; d = shiftDate(d, 1)){
    if(S.dayReview[d]) continue;
    try{ S.dayReview[d] = c9EvalDay(d); made.push(d); }catch(e){ kmErr('自動の評価 ' + d, e); }
  }
  if(made.length){
    touch('dayReview'); persist(); pushRemote();
    if(!opt.quiet){ if(isTyping()) renderLater(); else render(); }
  }
  return made;
}
/* 今日タブの「きのうの評価」カード（とじるまで出す） */
function c9YdayCard(ctx){
  if(ctx && ctx.isToday === false) return '';
  var yd = shiftDate(today(), -1);
  var r = (S.dayReview || {})[yd];
  if(!r || !r.grade) return '';
  if(((S.ui.core2 || {}).ydayClosed || '') === yd) return '';
  var items = Array.isArray(r.items) ? r.items : null, good = Array.isArray(r.good) ? r.good : null, next = r.next || '';
  if(!items || !good || !next){
    try{ var g = dayGrade(yd); items = items || g.items; good = good || g.good; next = next || g.next; }catch(e){ items = items || []; good = good || []; }
  }
  return section('きのうの評価', ymdLabel(yd),
    '<div class="gradebox c9gbig"><span class="gradeb" style="--gc:' + (GRADE_COLOR[r.grade] || '#999') + '">' + esc(r.grade) + '</span>' +
      '<span class="grow"><span class="t">' + esc(gradeNote(r.grade)) + '　' + toNum(r.point) + '点</span>' +
      '<span class="s">' + (r.auto ? 'アプリが自動でつけました' : '自分でつけた評価です') + (r.memo ? '・' + esc(r.memo) : '') + '</span></span></div>' +
    c9ItemsHtml(items) +
    (good.length ? '<div class="c9good"><b>よかったこと</b><ul>' + good.map(function(w){ return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>' : '') +
    (next ? '<div class="msg ok c9next"><b>つぎの日へ</b>　' + esc(next) + '</div>' : '') +
    '<div class="pair"><button class="btn ghost" data-act="rev-hist">これまでのふりかえり</button>' +
    '<button class="btn ghost" style="flex:0 0 auto;padding:13px 18px" data-act="c9-yday-close">とじる</button></div>');
}

/* ============================== 起動のあと・日付が変わったとき ============================== */
var c9Boot = { t0:Date.now(), evalDay:'', checkDay:'' };
/* 同期で相手の新しいデータを受け取りおえたか（つながらないときは少し待つだけ） */
function c9SyncCalm(){
  var el = Date.now() - c9Boot.t0;
  if(typeof syncState === 'undefined') return true;
  if(!syncState.on) return el > 6000 || (TEST_MODE && el > 2500);
  if(!syncState.remote || syncState.pulling) return el > 20000;
  var rp = syncState.remote.parts || {};
  var pending = Object.keys(SYNC_PARTS).some(function(p){ return rp[p] && rp[p].h !== SYNC_LOCAL.applied[p]; });
  return !pending || el > 20000;
}
function c9Tick(){
  try{
    if(!window.__kurashiOK || document.hidden) return;
    if(Date.now() - c9Boot.t0 < 1200 || !c9SyncCalm()) return;
    var td = today();
    if(c9Boot.evalDay !== td){ c9Boot.evalDay = td; c9AutoReview(); }
    if(c9Boot.checkDay !== td){ c9Boot.checkDay = td; c9DailyCheck(); }
  }catch(e){ kmErr('自動の評価・点検', e); }
}
setInterval(c9Tick, 1500);
document.addEventListener('visibilitychange', function(){ if(!document.hidden) setTimeout(c9Tick, 800); });

/* ============================== 登録 ============================== */
kmView('c9search', c9ViewSearch);
kmPart('today', 'c9yday', 'きのうの評価', c9YdayCard);
kmPart('today', 'c9check', 'データの点検のお知らせ', c9CheckBanner);
/* 今日タブのいちばん上に出す（並べかえていない人も、あとから足された人も） */
(function(){
  var a = PAGE_SECTIONS.today || [];
  ['c9check', 'c9yday'].forEach(function(id){
    for(var i = 0; i < a.length; i++){ if(a[i][0] === id){ a.unshift(a.splice(i, 1)[0]); break; } }
  });
})();
kmSettings({ id:'c9check', title:'データの点検', after:'',
  note:function(){ var c = c9CheckLast; return c ? (c.ng ? 'あぶない ' + c.ng + 'か所' : c.warn ? '気になる ' + c.warn + 'か所' : '問題なし') : '1日1回、自動で調べます'; },
  html:c9CheckHtml });
kmAction(function(act, t){
  if(act.indexOf('c9-') !== 0) return false;
  var d = t.dataset || {};
  /* ホーム画面とタブ */
  if(act === 'c9-home-pg'){ c9HomePg = d.v || 'today'; render(); return true; }
  if(act === 'c9-home-mv'){
    var ids = c9HomeIds(d.kind, d.pg), i = ids.indexOf(d.id), j = i + toNum(d.d);
    if(i < 0 || j < 0 || j >= ids.length) return true;
    var tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
    if(c9HomeSetOrder(d.kind, d.pg, ids)){ toast('「' + c9HomeName(d.kind, d.pg, d.id) + '」を' + (toNum(d.d) < 0 ? '上' : '下') + 'へ動かしました'); commit(); }
    return true;
  }
  if(act === 'c9-home-tg'){
    var w = c9HomeToggle(d.kind, d.pg, d.id);
    if(w){ toast('「' + c9HomeName(d.kind, d.pg, d.id) + '」を' + (w === '出す' ? '出します' : '出しません')); commit(); }
    return true;
  }
  if(act === 'c9-home-reset'){ c9HomeReset(); toast('はじめの並びにもどしました'); commit(); return true; }
  if(act === 'c9-go-home'){
    c9HomePg = C9_HOME_PAGES.some(function(p){ return p[0] === d.pg; }) ? d.pg : 'today';
    S.ui.setOpen = S.ui.setOpen || {}; S.ui.setOpen.c9home = 1; touch('ui'); persist();
    c9Go('set'); c9ScrollTo('[data-act="fold"][data-id="c9home"]');
    return true;
  }
  /* 検索 */
  if(act === 'c9-search-open'){
    if(appId !== 'c9search') c9From = appId;
    c9Go('c9search');
    setTimeout(function(){ var q = document.getElementById('c9_q'); if(q && !q.value){ try{ q.focus(); }catch(e){} } }, 40);
    return true;
  }
  if(act === 'c9-search-back'){
    var to = (c9From && c9From !== 'c9search') ? c9From : 'today';
    appId = to; c9TempApp = ''; render(); window.scrollTo(0, 0); return true;
  }
  if(act === 'c9-search-go'){
    c9Q = val('c9_q'); c9More = {};
    if(c9SaveRecent(c9Q)){ persist(); pushRemote(); }
    render(); return true;
  }
  if(act === 'c9-search-q'){
    c9Q = d.q || ''; c9More = {};
    if(c9SaveRecent(c9Q)){ persist(); pushRemote(); }
    render(); return true;
  }
  if(act === 'c9-recent-clear'){
    S.kmData = S.kmData || {}; S.kmData[C9_RECENT] = { list:[], mt:Date.now() }; touch('kmData');
    toast('さがしたことばの履歴を消しました'); commit(); return true;
  }
  if(act === 'c9-more'){ c9More[d.g] = 1; c9ResRefresh(); return true; }
  if(act === 'c9-open'){ c9Open(t); return true; }
  /* データの点検 */
  if(act === 'c9-fix'){ c9FixRun(d.key || ''); return true; }
  if(act === 'c9-fix-all'){ c9FixRun('*'); return true; }
  if(act === 'c9-check-run'){ c9CheckRun(); toast('調べなおしました'); render(); return true; }
  if(act === 'c9-check-photos'){
    toast('写真を数えています…');
    c9ScanPhotos().then(function(l){ toast(l.length ? '大きい写真が' + l.length + '枚ありました' : '大きすぎる写真はありませんでした'); render(); });
    return true;
  }
  if(act === 'c9-go-check'){
    S.ui.setOpen = S.ui.setOpen || {}; S.ui.setOpen.c9check = 1; touch('ui'); persist();
    c9Go('set'); c9ScrollTo('[data-act="fold"][data-id="c9check"]');
    return true;
  }
  if(act === 'c9-check-hide'){ c9CheckNote = null; render(); return true; }
  /* きのうの評価 */
  if(act === 'c9-yday-close'){
    S.ui.core2 = Object.assign({}, S.ui.core2 || {}, { ydayClosed:shiftDate(today(), -1) });
    touch('ui'); commit(); return true;
  }
  return false;
});
/* AIが読めるように（S に入るもの＝自動の評価・検索の履歴は、もともと読める。計算したものをここで出す） */
kmAiData('c9_checks', 'データの点検の結果（同じものが2つ・おかしい日付・バイトの重なり・大きい写真・同期の大きさ など。level:ng はあぶない、warn は気になる。canFix は設定 › データの点検 の「直す」で直せる）', function(){
  var r = c9CheckRun();
  return { date:today(), ng:r.ng, warn:r.warn, photosCounted:c9BigPhotos !== null,
    items:r.list.map(function(x){ return { level:x.level, kind:x.kind, msg:x.msg, canFix:!!x.fix }; }) };
}, 'settings');
kmAiData('c9_day_eval', '今日の評価の見こみ（アプリの自動の計算。点数と内わけ）と、きのうの評価。点のつけ方：課題30・期限切れ10・出席25・暗記15・家計簿10・睡眠歩数10・おせわ5・バイト5のうち、その日に関係のあるものだけで100点にする', function(){
  var td = today(), g = dayGrade(td), yd = shiftDate(td, -1);
  return { today:{ date:td, grade:g.grade, point:g.point, items:g.items, good:g.good, next:g.next },
    yesterday:(S.dayReview || {})[yd] || null,
    note:'S.dayReview の auto:1 は、次の日にアプリが自動でつけた評価。auto のないものは自分でつけた評価。' };
}, 'reviews');
kmAiData('c9_search_recent', 'アプリの検索で最近さがしたことば（新しい順）', function(){ return c9Recent(); }, 'more');
/* ウィジェット・Discord のまとめに、きのうの評価を足す */
kmSummary(function(s){
  var yd = shiftDate(today(), -1), r = (S.dayReview || {})[yd];
  if(r && r.grade) s.yesterdayReview = { date:yd, grade:r.grade, point:toNum(r.point), auto:r.auto ? 1 : 0, next:String(r.next || '').slice(0, 60) };
});

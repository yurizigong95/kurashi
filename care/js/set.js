/* かんご実習メーカー：「設定」タブ（AIのキー・同期・バックアップ・このアプリについて） */

function setView(){
  var h = '';
  var from = aiKeyFrom(), kk = aiKeyKurashi();
  h += section('AI（Gemini）のキー', from === 'own' ? '入っています' : from === 'kurashi' ? 'くらしの手帳と同じ' : 'まだです',
    (from === 'kurashi'
      ? '<div class="syst st-ok"><span class="dot"></span><div><b>くらしの手帳のキーを、自動で使っています</b>' +
          '<div class="s">くらしの手帳（設定 › AIそうだん）で入れたキーです。ここで入れなくても大丈夫です。</div></div></div>'
      : from === 'own' && kk && kk !== aiKeyOwn()
        ? '<div class="s">くらしの手帳にも、別のキーが入っています。<button type="button" class="link" data-act="st-keydel">くらしの手帳のキーにする</button></div>'
        : from === '' ? '<div class="s">くらしの手帳の「設定 › AIそうだん」でキーを入れると、ここでも<b>自動で</b>使います。</div>' : '') +
    '<label class="f" for="st_key">' + (from === 'kurashi' ? '別のキーを使うときだけ' : 'APIキー') + '</label>' +
    '<input id="st_key" type="password" autocomplete="off" placeholder="' + (from === 'own' ? '●●●●●●（入っています）' : 'AQ.… か AIza… ではじまる文字') + '" value="">' +
    '<div class="pair">' + btn('入れる', 'st-key', { cls:'main' }) + btn('消す', 'st-keydel', { cls:'ghost', dis:from !== 'own' }) + '</div>' +
    '<label class="f">かしこさ</label>' +
    chips(AI_MODELS.map(function(m){ return [m[0], m[1]]; }), S.set.model || '', 'st-model') +
    note('キーは<b>この端末の中だけ</b>に保存します（Google 以外には送りません・ほかの端末とも同期しません）。' +
      'キーは Google AI Studio（aistudio.google.com）の「Get API key」で作れます。' +
      '<br>キーがなくても、事例と看護過程の書きこみは、ぜんぶ使えます。'));

  var u = aiUse();
  h += section('AIをどれだけ使ったか', 'きょう ' + toNum(u.req) + '回',
    '<div class="stats">' +
      statBox('きょう', toNum(u.req) + '回') + statBox('今月', toNum(u.mreq) + '回') + statBox('これまで', toNum(S.set.aiCount) + '回') +
    '</div>' +
    '<div class="kv"><span>今月 読んだ量／書いた量（トークン）</span><b>' + aiTokText(u.mtin) + '／' + aiTokText(u.mtout) + '</b></div>' +
    note('数は、Googleが返してきたものをそのまま足しています。ほんとうの請求は、Google AI Studio の画面でたしかめてください。'));

  h += setSyncPart();

  h += section('バックアップ', null,
    '<div class="pair">' + btn('📤 書き出す', 'st-export', { cls:'ghost' }) + btn('📥 読みこむ', 'st-import', { cls:'ghost' }) + '</div>' +
    note('事例・看護過程・AI壁打ちの記録を1つのファイルにします（APIキーはふくみません）。') +
    '<div class="minirow">' +
      '<button type="button" data-act="st-seed">学習用の事例（3つ）をもどす</button>' +
      '<button type="button" class="danger" data-act="st-reset">ぜんぶ消す</button>' +
    '</div>');

  h += section('このアプリについて', APP_BUILD,
    '<div class="s">' + esc(APP_NAME) + '（版 ' + APP_BUILD + '）<br>' +
      'ペーパーペイシェント（架空の事例）で、看護過程を練習するアプリです。' +
      '<br>くらしの手帳・もんだいメーカーとは<b>別のアプリ</b>で、保存場所も別です。</div>' +
    warnBox('これは<b>学習用の架空事例アプリ</b>です。<b>実在の患者さんの情報は入力しないでください</b>（AI壁打ちでは、事例の中身がAIに送られます）。' +
      '<br>AIの答えは、かならず教科書・先生・実習指導者に確かめてください。'));
  return h;
}

/* ===== ほかの端末とそろえる（同期のようす・変更の記録） ===== */
function setSyncPart(){
  var p = syPhase(), ready = syReady();
  if(ready && SY.on && Date.now() - toNum(SY.devAt) > 60000){
    SY.devAt = Date.now();
    syHello().then(function(){ if(view.tab === 'set' && !isTyping()) render(); });
  }
  var h = '<div class="syst st-' + esc(p[0]) + '"><span class="dot"></span><div><b>' + esc(p[1]) + '</b>' +
    (p[2] ? '<div class="s">' + esc(p[2]) + '</div>' : '') + '</div></div>';
  if(ready){
    var pend = syPending(), pt = pend ? syDiffText(pend) : '';
    h += '<div class="kv"><span>最後に送った／受けとった</span><b>' + esc(syAgo(SY.pushedAt)) + '／' + esc(syAgo(SY.pulledAt)) + '</b></div>' +
      '<div class="kv"><span>まだ送っていない変更</span><b>' + (pend == null ? '—' : pt ? esc(pt) : 'なし') + '</b></div>' +
      '<div class="kv"><span>そろえているもの</span><b>' + esc(syCountText(S)) + '</b></div>' +
      '<div class="pair" style="margin-top:10px">' +
        btn('いますぐ合わせる', 'st-sync', { cls:'ghost' }) +
        btn(SY.on ? '同期をやめる' : '同期をはじめる', 'st-syncsw', { cls:'ghost' }) +
      '</div>';
    var devs = SY.devs || {}, ids = Object.keys(devs).sort(function(a, b){ return toNum(devs[b].at) - toNum(devs[a].at); });
    h += '<label class="f">つながっている端末</label>' +
      (ids.length ? '<div class="sylist">' + ids.map(function(id){
        var d = devs[id] || {}, me = id === syDev(), old = d.build && d.build !== APP_BUILD;
        return '<div class="syrow"><span class="dot' + (me ? ' me' : '') + '"></span><div class="bd"><b>' + esc(d.name || '端末') + '</b>' +
          (me ? '<span class="tagme">この端末</span>' : '') +
          '<div class="s">' + esc(syAgo(d.at)) + 'に使用・版 ' + esc(d.build || '?') +
          (old && !me ? '　<b class="' + (d.build < APP_BUILD ? 'bad' : '') + '">' + (d.build < APP_BUILD ? '古い版です。その端末で開き直してください' : 'こちらより新しい版です') + '</b>' : '') +
          '</div></div></div>';
      }).join('') + '</div>' : '<div class="s">まだ一覧がありません（1回そろうと出ます）</div>') +
      '<label class="f" for="st_devname">この端末の名前</label>' +
      '<div class="pair"><input id="st_devname" type="text" maxlength="20" value="' + esc(inVal('st_devname', syDevName())) + '">' +
        btn('名前を変える', 'st-devname', { cls:'ghost' }) + '</div>';
    var logs = syLogAll().slice(0, 12);
    h += '<label class="f">変更の記録（新しい順）</label>' +
      (logs.length ? '<div class="sylist">' + logs.map(function(x){
        var inn = x.d === 'in';
        return '<div class="syrow"><span class="ar ' + (inn ? 'in' : 'out') + '">' + (inn ? '⬇' : '⬆') + '</span><div class="bd">' +
          '<b>' + esc(inn ? (x.v || 'ほかの端末') + ' から受けとった' : 'この端末から送った') + '</b>' +
          '<div class="s">' + esc(x.m) + '</div></div><span class="s when">' + esc(syWhen(x.t)) + '</span></div>';
      }).join('') + '</div>' : '<div class="s">まだありません。どこかの端末で直すと、ここに出ます。</div>');
  }
  h += note('スマホ・iPad・パソコンの<b>どれで開いても、何も入れずに、ひとりでにそろいます</b>（事例・看護過程・AI壁打ちの記録・設定）。' +
      '<br>つなぎ先は、くらしの手帳と同じところですが、置き場所は<b>このアプリ専用</b>なので、手帳やもんだいメーカーのデータとはまざりません。' +
      '<br><b>APIキーと、使った量の記録は、同期しません</b>（端末ごとのものだからです）。' +
      '<br>同じ事例を2台で直したときは、<b>あとから直したほう</b>がのこります。');
  return '<div id="sy-sec">' + section('ほかの端末とそろえる', SY.on ? 'オン' : (ready ? 'オフ' : null), h) + '</div>';
}
function syWhen(t){
  var d = new Date(toNum(t)), td = new Date();
  var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  return (d.toDateString() === td.toDateString()) ? hm : (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
}

/* ===== バックアップ ===== */
function setExport(){
  /* APIキーは書き出さない（ファイルを人にわたしても、キーがもれないように） */
  var out = Object.assign({}, S, { set:Object.assign({}, S.set, { key:'' }) });
  var data = JSON.stringify({ app:'care', ver:1, at:new Date().toISOString(), data:out }, null, 0);
  try{
    var blob = new Blob([data], { type:'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'care-' + today() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('書き出しました');
  }catch(e){
    toast('書き出せませんでした：' + e.message, true);
  }
}
/* 読みこんだバックアップの中身で、いまのデータを入れかえる（ほかの端末にも、読みこんだ中身がとどくように） */
function setImportData(d){
  var LISTS = ['cases', 'chats'], had = {}, now = Date.now();
  LISTS.forEach(function(k){ (S[k] || []).forEach(function(x){ if(x && x.id) had[x.id] = 1; }); });
  var delNow = Object.assign({}, S.del || {});
  LISTS.forEach(function(k){ S[k] = Array.isArray(d[k]) ? d[k] : []; });
  S.cases = S.cases.map(caseFix).filter(Boolean);
  S.del = Object.assign({}, (d.del && typeof d.del === 'object') ? d.del : {}, delNow);
  var keepIds = {};
  LISTS.forEach(function(k){ (S[k] || []).forEach(function(x){ if(x && x.id){ keepIds[x.id] = 1; x.mt = now; delete S.del[x.id]; } }); });
  Object.keys(had).forEach(function(id){ if(!keepIds[id]) syDead(id); });
  if(d.set && typeof d.set === 'object' && d.set.model !== undefined) S.set.model = String(d.set.model || '');
  S.seeded = 1;
  syTouchSet();
}
function setImport(){
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = async function(){
    var f = (inp.files || [])[0];
    if(!f) return;
    try{
      var j = JSON.parse(String(await readAs(f, 'text')));
      var d = (j && j.data) ? j.data : j;
      if(!d || !Array.isArray(d.cases)) throw new Error('このアプリのバックアップではないようです');
      if(!ask('いまのデータを、読みこんだ内容に入れかえます。よろしいですか？')) return;
      setImportData(d);
      saveNow();
      toast('読みこみました（事例' + S.cases.length + 'つ）');
      go('cases');
    }catch(e){
      toast('読みこめませんでした：' + e.message, true);
    }
  };
  inp.click();
}

onView('set', setView);

onAct('st-key', function(){
  var v = String(elVal('st_key') || '').trim();
  if(!v){ toast('キーを入れてください', true); return; }
  S.set.key = v;
  inClear('st_key');
  saveNow();
  toast('入れました');
  render();
});
onAct('st-keydel', function(){
  var kk = aiKeyKurashi();
  if(!ask(kk ? 'ここで入れたキーを消して、くらしの手帳のキーを使いますか？' : 'APIキーを消しますか？')) return;
  S.set.key = '';
  saveNow();
  toast(kk ? 'くらしの手帳のキーを使います' : '消しました');
  render();
});
onAct('st-model', function(d){ S.set.model = d.v; syTouchSet(); saveNow(); render(); });
onAct('st-sync', function(){
  if(!syReady()){ toast('テストモードでは同期しません', true); return; }
  if(!SY.on){ syStart().then(function(){ render(); }); toast('つないでいます…'); return; }
  toast('合わせています…');
  syPush().then(function(okp){ toast(okp ? 'そろえました' : (SY.msg || '合わせられませんでした'), !okp); render(); });
});
onAct('st-syncsw', function(){
  if(SY.on){ syStop(); SY.off = 1; toast('同期をやめました'); render(); return; }
  SY.off = 0;
  syStart().then(function(okp){ toast(okp ? '同期をはじめました' : (SY.msg || 'つなげませんでした'), !okp); render(); });
});
onAct('st-devname', function(){
  if(!syDevRename(elVal('st_devname'))){ toast('名前を入れてください', true); return; }
  inClear('st_devname');
  toast('この端末の名前を「' + syDevName() + '」にしました');
  render();
});
/* 上の「同期済み」をおすと、設定の同期のところへ */
onAct('sy-go', function(){
  go('set');
  setTimeout(function(){
    var el = document.getElementById('sy-sec');
    if(el) try{ el.scrollIntoView({ block:'start', behavior:'smooth' }); }catch(e){ el.scrollIntoView(); }
  }, 30);
});
onAct('st-export', function(){ setExport(); });
onAct('st-import', function(){ setImport(); });
onAct('st-seed', function(){
  var n = seedCases(true);
  saveNow();
  toast(n ? '学習用の事例を' + n + 'つもどしました' : '3つとも入っています');
  render();
});
onAct('st-reset', function(){
  if(!ask('事例・看護過程・AI壁打ちの記録を、ぜんぶ消します。よろしいですか？')) return;
  if(!ask('本当に消しますか？（もとにもどせません）')) return;
  var key = S.set.key;
  /* ほかの端末とそろえているときも、消したものがもどってこないように「消した」しるしをのこす */
  ['cases', 'chats'].forEach(function(k){ (S[k] || []).forEach(function(x){ if(x && x.id) syDead(x.id); }); });
  var del = S.del;
  S = blankState();
  S.set.key = key;
  S.del = del;
  S.seeded = 1;                                /* 消したあとに、学習用の事例をかってにもどさない */
  syTouchSet();
  saveNow();
  toast('ぜんぶ消しました');
  go('cases');
});

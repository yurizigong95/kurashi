/* くらしの手帳：Google連携のつづき（端末をつなぐ・Gmail・AIの読み取り・スプレッドシート） */
/* ============================== ほかの端末をつなぐ ==============================
   つないである端末で6けたのコードを出し（10分・5回まで）、ほかの端末でそのコードを入れると、
   橋わたしから合言葉を受け取ってつながる。橋わたしのURLは、合言葉ではないので同期で配る（S.cloud.gasUrl）。 */
var GASP = { pair:null, busy:false, msg:'' };
function gasSharedUrl(){ return String((S.cloud && S.cloud.gasUrl) || ''); }
function gasUrlShare(){
  if(!GAS.url || gasSharedUrl() === GAS.url) return;
  S.cloud = S.cloud || {};
  S.cloud.gasUrl = GAS.url;
  touch('cloud');
}
/* 合言葉なしで呼ぶ（コードで受け取るときだけ） */
async function gasCallOpen(url, body){
  if(TEST_MODE){
    var f = gasFake();
    if(!f) throw new Error('テストモードでは使えません');
    var r0 = await f(JSON.parse(JSON.stringify(body)));
    if(!r0 || !r0.ok) throw new Error((r0 && r0.error) || '失敗しました');
    return r0;
  }
  var res = await withTimeout(fetch(url, { method:'POST', redirect:'follow', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body:JSON.stringify(body) }), 60000, 'Google');
  var js = null;
  try{ js = JSON.parse(await res.text()); }catch(e){ throw new Error('橋わたしから読めない返事が来ました'); }
  if(!js.ok) throw new Error(js.error || '失敗しました');
  return js;
}
async function gasPairOffer(){
  var code = String(Math.floor(100000 + Math.random() * 900000));
  try{ var a = new Uint32Array(1); crypto.getRandomValues(a); code = String(100000 + (a[0] % 900000)); }catch(e){}
  await gasCall('pairOffer', { code:code });
  gasUrlShare(); persist(); pushRemote(true);
  GASP.pair = { code:code, until:Date.now() + 10 * 60000 };
  return code;
}
async function gasPairClaim(code){
  var url = gasSharedUrl();
  if(!url) throw new Error('まだどの端末もつながっていません');
  code = String(code || '').replace(/\D/g, '');
  if(code.length !== 6) throw new Error('6けたの数字を入れてください');
  var r = await gasCallOpen(url, { action:'pairClaim', code:code });
  GAS.url = url; GAS.token = r.token; GAS.user = ''; saveGas();
  var p = await gasCall('ping');
  GAS.user = p.user || 'OK'; GAS.ver = p.ver || 0; GAS.trigger = p.trigger ? 1 : 0; GAS.ai = p.ai ? 1 : 0; saveGas();
  return p;
}

/* ============================== 使う機能（どの端末でも同じ） ============================== */
function gfeat(){
  return Object.assign({ mailCard:0, mailUnkou:0, lec:0, gnFolder:'GoodNotes', gnOnly:[] }, S.ui.gfeat || {});
}
function gfeatSet(patch){ S.ui.gfeat = Object.assign({}, gfeat(), patch); touch('ui'); }
async function gfeatPush(){
  if(!gasReady() || !(toNum(GAS.ver) >= 3)) return;
  var f = gfeat(), np = (typeof notifyPrefs === 'function') ? notifyPrefs() : {};
  await gasCall('featSet', { feat:{ mailCard:f.mailCard, mailUnkou:f.mailUnkou, lec:f.lec, gnFolder:f.gnFolder, gnOnly:f.gnOnly,
    discord:np.discord ? 1 : 0, push:np.push === 0 ? 0 : 1, quiet:np.quiet === 0 ? 0 : 1,
    courses:termCourses().map(function(c){ return c.name; }) } });
}

/* ============================== AIが読んだ結果を受け取る ============================== */
/* it: { kind:'ai', src:'gn'|'lec'|'shot', file, url, course, summary, tasks:[{title,due}], cards:[{q,a}] } */
function gasAiApply(it){
  var course = String(it.course || '');
  if(course && typeof subjectMatch === 'function') course = subjectMatch(course);
  var from = it.src === 'gn' ? 'Goodnotes' : it.src === 'lec' ? '講義資料' : '写真';
  var msgs = [];
  var nCards = (typeof ankiAddMany === 'function' && (it.cards || []).length) ? ankiAddMany(course || from, it.cards, it.src || 'ai') : 0;
  if(nCards) msgs.push('暗記カード' + nCards + '枚');
  if(it.summary){
    S.notes.push({ id:uid('nt'), title:'📝 ' + String(it.file || from).replace(/\.(pdf|jpe?g|png)$/i, '') + '（' + ymdLabel(today()) + '）',
      body:String(it.summary) + (it.url ? '\n\n元のファイル：' + it.url : ''), pinned:0, checks:[], photos:[],
      link:course && courseByName(course) ? { type:'course', id:course } : null, ct:Date.now(), mt:Date.now() });
    msgs.push('メモ');
  }
  var nT = 0;
  (it.tasks || []).forEach(function(t){
    if(!t || !t.title) return;
    S.suggests = Array.isArray(S.suggests) ? S.suggests : [];
    if(S.suggests.some(function(x){ return x.title === t.title && x.due === (t.due || ''); })) return;
    S.suggests.push({ id:uid('sg'), kind:'task', title:String(t.title).slice(0, 80), due:isYmd(t.due) ? t.due : '', subject:course, src:from, mt:Date.now() });
    nT++;
  });
  if(nT) msgs.push('課題の候補' + nT + '件');
  return msgs.length ? from + 'から：' + msgs.join('・') : '';
}
/* AIが見つけた課題の候補（ToDoの上に出す） */
function suggestsCard(){
  var list = Array.isArray(S.suggests) ? S.suggests : [];
  if(!list.length) return '';
  return section('AIが見つけた課題の候補', list.length + '件',
    list.map(function(s){
      return '<div class="row"><div class="grow"><div class="t">' + esc(s.title) + '</div>' +
        '<div class="s">' + esc(s.src || '') + (s.subject ? '・' + esc(shortName(s.subject)) : '') + (s.due ? '・締切 ' + esc(ymdLabel(s.due)) : '') + '</div></div>' +
        '<button class="mini" data-act="sg-add" data-id="' + esc(s.id) + '">追加</button>' +
        '<button class="mini" data-act="sg-del" data-id="' + esc(s.id) + '">いらない</button></div>';
    }).join('') + '<p class="note">ノートや資料をAIが読んで見つけたものです。まちがっていることもあるので、見てから追加してください。</p>');
}

/* ============================== スプレッドシート ============================== */
function sheetRows(){
  var spends = (S.spends || []).slice().sort(function(a, b){ return String(a.date).localeCompare(String(b.date)); });
  var kb = [['日付', '収支', '金額', '内容', '分類', '口座・カード', 'メモ']].concat(spends.map(function(x){
    return [x.date || '', x.io === 'in' ? '収入' : '支出', toNum(x.amount), x.title || '', (typeof kbCat === 'function' ? kbCat(x.cat)[1] : x.cat || ''), x.acct || '', x.memo || ''];
  }));
  var sh = (S.shifts || []).slice().sort(function(a, b){ return String(a.date).localeCompare(String(b.date)); });
  var work = [['日付', '開始', '終了', '実際の終了', 'メモ']].concat(sh.map(function(x){ return [x.date || '', x.start || '', x.end || '', x.realEnd || '', x.note || x.memo || '']; }));
  var gr = [['科目', '評価', '点数']].concat(Object.keys(S.grades || {}).sort().map(function(k){ var g = S.grades[k] || {}; return [k, g.grade || '', g.score || '']; }));
  var cards = [['科目', '問い', '答え', '次に出る日', 'くり返し']].concat((S.cards || []).map(function(c){ return [c.deck || '', c.q || '', c.a || '', c.due || '', toNum(c.reps)]; }));
  return { '家計簿':kb, 'バイト':work, '成績':gr, '暗記カード':cards };
}
async function sheetExport(manual){
  if(!gasReady() || !(toNum(GAS.ver) >= 3)) { if(manual) toast('先に橋わたしを新しい版にしてください', true); return; }
  var r = await gasCall('sheetSync', { sheets:sheetRows() });
  S.cloud = S.cloud || {};
  S.cloud.sheet = { url:r.url, at:Date.now(), by:DEV.id };
  touch('cloud');
  return r;
}

/* ============================== 設定画面 ============================== */
function gasPlusSettings(){
  var h = '';
  var ready = gasReady(), v3 = toNum(GAS.ver) >= 3;
  /* ほかの端末をつなぐ */
  if(ready){
    h += '<label class="f">ほかの端末をつなぐ（iPhone・iPadなど）</label>';
    if(GASP.pair && GASP.pair.until > Date.now()){
      h += '<div class="pairbox"><div class="s">つなぎたい端末で「コードでつなぐ」に、この数字を入れてください（10分間）</div>' +
        '<div class="paircode num">' + esc(GASP.pair.code.slice(0, 3) + ' ' + GASP.pair.code.slice(3)) + '</div></div>';
    }
    h += '<button class="btn ghost" data-act="gas-pair-offer"' + (v3 ? '' : ' disabled') + '>6けたのコードを出す</button>' +
      (v3 ? '' : '<p class="note">この機能は、橋わたしを新しい版（v3）にすると使えます。</p>');
  }else if(gasSharedUrl()){
    h += '<div class="bn green" style="margin-bottom:10px"><span class="ic">📱</span><span>ほかの端末は、もうGoogleとつながっています。<b>つないである端末で「6けたのコードを出す」</b>を押して、その数字を下に入れてください。</span></div>' +
      '<div class="field"><label class="f" for="pair_code">コードでつなぐ</label><input id="pair_code" inputmode="numeric" maxlength="7" placeholder="123 456" autocomplete="one-time-code"></div>' +
      '<button class="btn" data-act="gas-pair-claim">つなぐ</button>';
  }
  if(!ready) return h || '<p class="note">先に上の「Google連携」をつないでください。</p>';
  if(!v3){
    h += '<div class="bn amber" style="margin-top:12px"><span class="ic">!</span><span><b>橋わたしを新しい版にしてください</b>（いまは v' + (toNum(GAS.ver) || 1) + '）。' +
      '上の「プログラムをコピー」と「設定ファイルをコピー」で貼り直して、「デプロイ」→「デプロイを管理」→ ✏️ →「新バージョン」→「デプロイ」。' +
      'Gmailを読む許可とスプレッドシートの許可が新しく聞かれます。</span></div>';
    return h;
  }
  var f = gfeat();
  h += '<label class="f" style="margin-top:14px">Gmail（読むだけ）</label><div class="pillrow">' +
    '<button data-act="gf-set" data-k="mailCard" data-v="' + (f.mailCard ? 0 : 1) + '" class="' + (f.mailCard ? 'on' : '') + '">カードの利用メール → 家計簿</button>' +
    '<button data-act="gf-set" data-k="mailUnkou" data-v="' + (f.mailUnkou ? 0 : 1) + '" class="' + (f.mailUnkou ? 'on' : '') + '">運行情報メール → 通知</button></div>' +
    '<p class="note">三井住友カード・楽天カードの「ご利用のお知らせ」メールから、金額とお店を家計簿に入れます。運行情報は、Yahoo!路線情報の「登録路線のメール」などを受け取ると、スマホ・Discordに知らせます（6:00〜23:30）。</p>';
  h += '<label class="f" style="margin-top:12px">AIの読み取り（暗記カード・講義メモ・課題の候補）</label>' +
    '<div class="row"><div class="grow s">AIのカギ（Gemini）を橋わたしに預ける</div><div class="t">' + (GAS.ai ? '預けてある' : 'まだ') + '</div></div>' +
    '<div class="pillrow"><button class="mini" data-act="gas-ai-key">' + (GAS.ai ? '預け直す' : '預ける') + '</button>' +
    (GAS.ai ? '<button class="mini" data-act="gas-ai-key-del">やめる</button>' : '') + '</div>' +
    '<p class="note">AIの読み取りは、アプリを閉じていても橋わたしが10分ごとに行います。そのために、この端末のGeminiのカギを、ご自身のGoogleの橋わたしに預けます。</p>' +
    '<div class="pillrow"><button data-act="gf-set" data-k="lec" data-v="' + (f.lec ? 0 : 1) + '" class="' + (f.lec ? 'on' : '') + '">講義資料フォルダを読む</button></div>' +
    '<p class="note">Googleドライブの「くらしの手帳 講義資料」フォルダに入れたPDF・写真から、暗記カードと講義メモを作ります。</p>' +
    '<div class="field"><label class="f" for="gf_gn">Goodnotesの自動バックアップのフォルダ名</label><input id="gf_gn" value="' + esc(f.gnFolder) + '" placeholder="GoodNotes"></div>' +
    '<div class="field"><label class="f" for="gf_only">読んでいいノートの名前（ふくむ言葉を「、」で区切る）</label><input id="gf_only" value="' + esc((f.gnOnly || []).join('、')) + '" placeholder="例：講義、解剖、生理"></div>' +
    '<button class="btn ghost" data-act="gf-save">Goodnotesの設定を保存</button>' +
    '<p class="note">⚠️ <b>実習記録など、患者さんの情報があるノートは入れないでください</b>。ここに書いた言葉が名前にふくまれるノートだけを読みます。空なら読みません。</p>' +
    '<div class="pillrow"><button class="mini" data-act="gas-scan" data-v="ai">いま読む</button><button class="mini" data-act="gas-scan" data-v="mail">いまメールを見る</button></div>' +
    (GAS.err && GAS.err.msg ? '<div class="msg ng">' + esc(GAS.err.where + '：' + GAS.err.msg) + '</div>' : '');
  var sh = (S.cloud && S.cloud.sheet) || {};
  h += '<label class="f" style="margin-top:12px">スプレッドシート</label>' +
    '<div class="row"><div class="grow s">家計簿・バイト・成績・暗記カードを書き出す</div><div class="t">' + (sh.at ? agoText(sh.at) : 'まだ') + '</div></div>' +
    '<div class="pillrow"><button class="mini" data-act="gas-sheet">いま書き出す</button>' +
    (sh.url ? '<a class="mini" href="' + esc(sh.url) + '" target="_blank" rel="noopener">スプレッドシートを開く</a>' : '') + '</div>' +
    '<p class="note">毎週のバックアップのときにも、自動で書き出します。</p>';
  return h;
}

/* ============================== 操作 ============================== */
function gasPlusAction(act, t){
  if(act === 'gas-pair-offer'){
    gasPairOffer().then(function(){ render(); }, function(e){ toast('コードを出せませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'gas-pair-claim'){
    gasPairClaim(val('pair_code')).then(function(p){
      toast('つながりました：' + (p.user || ''));
      if(typeof notifyPush === 'function') notifyPush(true);
      render();
    }, function(e){ toast('つなげませんでした：' + e.message, true); render(); });
    return true;
  }
  if(act === 'gf-set'){
    var patch = {}; patch[t.dataset.k] = toNum(t.dataset.v);
    gfeatSet(patch); commit();
    gfeatPush().then(function(){ toast('保存しました'); }, function(e){ toast('橋わたしに送れませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'gf-save'){
    var only = val('gf_only').split(/[、,，\s]+/).map(function(x){ return x.trim(); }).filter(Boolean).slice(0, 10);
    gfeatSet({ gnFolder:val('gf_gn').trim().slice(0, 60) || 'GoodNotes', gnOnly:only }); commit();
    gfeatPush().then(function(){ toast('保存しました'); }, function(e){ toast('橋わたしに送れませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'gas-ai-key' || act === 'gas-ai-key-del'){
    var del = act === 'gas-ai-key-del';
    var key = del ? '' : String(S.settings.geminiKey || '').trim();
    if(!del && !key){ toast('先に「AIそうだん」の設定で、この端末にGeminiのカギを入れてください', true); return true; }
    gasCall('aiKeySet', { key:key, model:S.ui.aiModel || S.settings.aiLastModel || '' }).then(function(){
      GAS.ai = del ? 0 : 1; saveGas(); toast(del ? '預けたカギを消しました' : 'カギを預けました'); render();
    }, function(e){ toast('預けられませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'gas-scan'){
    toast(t.dataset.v === 'mail' ? 'メールを見ています…' : 'AIが読んでいます…（1分ほど）');
    gasCall('scanNow', { what:t.dataset.v }).then(function(r){
      var msg = t.dataset.v === 'mail' ? ('見つかったもの：' + (r.found || []).length + '件')
        : ('読んだファイル：' + (r.done || 0) + '（のこり ' + (r.left || 0) + '）');
      toast(msg);
      if(typeof inboxPull === 'function') inboxPull(false);
    }, function(e){ toast('できませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'gas-sheet'){
    toast('書き出しています…');
    sheetExport(true).then(function(r){ if(r){ toast('書き出しました'); commit(); } }, function(e){ toast('書き出せませんでした：' + e.message, true); });
    return true;
  }
  if(act === 'sg-add' || act === 'sg-del'){
    var s = (S.suggests || []).filter(function(x){ return x.id === t.dataset.id; })[0];
    if(!s) return true;
    if(act === 'sg-add'){
      S.tasks.push({ id:uid('tk'), title:s.title, subject:s.subject || '', due:s.due || '', time:'', done:0,
        memo:(s.src || 'AI') + 'から', subs:[], photos:[], pri:1, how:'', url:'', mt:Date.now() });
    }
    removeItem('suggests', s.id);
    commit(); toast(act === 'sg-add' ? '課題に追加しました' : '候補を消しました'); return true;
  }
  return false;
}

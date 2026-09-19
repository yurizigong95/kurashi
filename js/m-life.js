/* くらしの手帳：生活・健康・AIの便利機能（担当 life）
   ・睡眠と歩数（#99 #100）… S.healthLog（キー＝日付：{ sleep 分, bed, wake, steps, src, mt }）。
       睡眠は「起きた日」の記録。おやすみ・おはようボタン、手入力、iPhoneのヘルスケアからショートカットで（受け取り箱 kind:'health'）。
   ・生理周期（#101）… はじめは「この端末だけ」（localStorage KEY+':life'）。設定で同期すると S.kmItems（mod:'life', type:'period'）に、
       読めない形（enc）で置く。AIには kmAiData で見せる（設定で「見せない」も選べる）。
   ・予防接種・健康診断（#106）… S.vaccines。実習の前に求められることが多いもののチェック表・証明書の写真をAIで読む。
   ・寒暖差・花粉（#110）… Open-Meteo（家＝三田）。暑さ指数・熱中症警戒アラート（#180）… 環境省（読めなければ橋わたし）。
   ・今日の作戦（#113）… すきま時間に、締切の近い課題・テスト・暗記を当てはめる（きまりで作る。AIにも頼める）。
   ・声で登録（#114）・撮るだけで登録（#115）… AIで分けて、確認してから「AIの直接登録」の仕組み（aiRunFunc）で入れる。
   ・1週間の生活の分析（#119）… 数字とグラフ。AIの「週のふりかえり」（weekReviewMake）に、この数字を足して渡す。 */

/* ============================== 共通 ============================== */
var LF = { forceSeason:0 };            /* テストで季節をこえて確かめるとき 1 */
var lfUi = { logForm:false, logDate:'', logList:false, hcHelp:false, pf:null, pList:false, xf:null, xList:false, xScan:null,
  weekOff:-1, planMore:false, planBusy:false, voice:null, snap:null };
var LF_DEF = { sleepGoal:420, shortSleep:360, stepGoal:8000,
  periodSync:0, periodAi:1, periodCal:1, periodToday:1, periodNotify:0, periodLead:2, periodWord:'plain', periodCustom:'',
  wx:1, pollen:'sugi,hinoki,ine,buta', diffPrev:7, diffDay:10, wbgt:1, wbgtNotify:1, plan:1, planEnd:'23:00' };
function lfPrefs(){ return Object.assign({}, LF_DEF, (S.ui && S.ui.life) || {}); }
function lfSet(patch){ S.ui.life = Object.assign({}, S.ui.life || {}, patch); touch('ui'); }
function lfNum(v){
  var s = String(v == null ? '' : v);
  try{ s = s.normalize('NFKC'); }catch(e){}
  var n = parseFloat(s.replace(/[,\s]/g, '').replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : 0;
}
function lfHm(min){
  min = Math.round(Number(min) || 0);
  if(min <= 0) return '—';
  var h = Math.floor(min / 60), m = min % 60;
  return (h ? h + '時間' : '') + (m ? m + '分' : '');
}
function lfComma(n){ return Math.round(Number(n) || 0).toLocaleString('ja-JP'); }
function lfMd(ymd){ if(!isYmd(ymd)) return ''; var a = ymd.split('-'); return (+a[1]) + '/' + (+a[2]); }
function lfWd(ymd){ var a = ymd.split('-'); return WDAY[new Date(+a[0], +a[1] - 1, +a[2]).getDay()]; }
function lfNowMin(){ var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function lfHhmm(v){
  var s = String(v == null ? '' : v).trim();
  try{ s = s.normalize('NFKC'); }catch(e){}
  return /^\d{1,2}:\d{2}$/.test(s) && minutesOf(s) < 1440 ? hhmmOf(minutesOf(s)) : '';
}
function lfFixDate(d){
  d = String(d == null ? '' : d).trim();
  try{ d = d.normalize('NFKC'); }catch(e){}
  if(isYmd(d)) return d;
  var y = d.match(/^(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})/);
  if(y) return y[1] + '-' + pad(+y[2]) + '-' + pad(+y[3]);
  var m = d.match(/(\d{1,2})[-\/月](\d{1,2})/);
  return m ? guessYear(+m[1], +m[2]) + '-' + pad(+m[1]) + '-' + pad(+m[2]) : '';
}
function lfBn(cls, ic, html){ return '<div class="bn ' + cls + ' lf-bn"><span class="ic">' + ic + '</span><span class="grow">' + html + '</span></div>'; }
function lfStat(k, v, sub){ return '<div class="stat"><div class="k">' + k + '</div><div class="v num">' + v + '</div>' + (sub ? '<div class="k">' + sub + '</div>' : '') + '</div>'; }
function lfRender(){
  if(typeof render !== 'function') return;
  if(typeof isTyping === 'function' && isTyping() && typeof renderLater === 'function') renderLater(); else render();
}
function lfAiNeed(){
  if(aiReady()) return true;
  toast('先に設定タブでGemini APIキーを登録してください', true);
  return false;
}
/* 自分の枠を、ページの中の決まった場所に置く（並べ替えていない人の並び） */
function lfPlace(page, id, after){
  var a = PAGE_SECTIONS[page];
  if(!a) return;
  var i = -1, j = -1, k;
  for(k = 0; k < a.length; k++){ if(a[k][0] === id) i = k; }
  if(i < 0) return;
  var it = a.splice(i, 1)[0];
  for(k = 0; k < a.length; k++){ if(a[k][0] === after) j = k; }
  a.splice(j < 0 ? a.length : j + 1, 0, it);
}
/* 写真・ファイルをえらぶ（画面を描き直しても消えないように、画面の外に置く） */
function lfFilePick(accept, cb){
  var inp = document.getElementById('lf_file');
  if(!inp){
    inp = document.createElement('input');
    inp.type = 'file'; inp.id = 'lf_file'; inp.className = 'hide';
    inp.addEventListener('change', function(){
      var f = (inp.files || [])[0], fn = inp._lfcb;
      inp.value = ''; inp._lfcb = null;
      if(f && fn) fn(f);
    });
    document.body.appendChild(inp);
  }
  inp.accept = accept || 'image/*';
  inp._lfcb = cb;
  inp.click();
}
function lfDataToFile(data){
  return fetch(data).then(function(r){ return r.blob(); }).then(function(b){ return new File([b], 'photo.jpg', { type:b.type || 'image/jpeg' }); });
}
function lfPhotoView(pid){
  photoGet(pid).then(function(src){
    if(!src){ toast('この端末に写真がありません', true); return; }
    var v = document.getElementById('viewer');
    if(v){ v.querySelector('img').src = src; v.classList.add('on'); }
  });
}
/* 棒グラフ（vals：[{ label, v, low, now, title }]、opt：{ max, goal, aria, cls }） */
function lfBars(vals, opt){
  opt = opt || {};
  var max = opt.max || Math.max.apply(null, vals.map(function(x){ return Number(x.v) || 0; }).concat([1]));
  var goal = opt.goal ? Math.min(100, opt.goal / max * 100) : 0;
  return '<div class="lf-chart' + (opt.cls ? ' ' + opt.cls : '') + '" role="img" aria-label="' + esc(opt.aria || '') + '">' +
    (goal ? '<div class="lf-gl"><i style="bottom:' + goal.toFixed(1) + '%"></i></div>' : '') +
    vals.map(function(x){
      var h = x.v ? Math.max(3, Math.min(100, x.v / max * 100)) : 0;
      return '<div class="lf-bc" title="' + esc(x.title || '') + '"><div class="lf-bw"><div class="lf-b' + (x.low ? ' low' : '') + (x.now ? ' now' : '') +
        '" style="height:' + h.toFixed(1) + '%"></div></div><div class="lf-bl">' + esc(x.label) + '</div></div>';
    }).join('') + '</div>';
}

/* ============================== 睡眠・歩数（#99 #100） ============================== */
function lfLog(ymd){
  var r = (S.healthLog || {})[ymd];
  return (r && typeof r === 'object' && !Array.isArray(r) && !r.del) ? r : null;
}
function lfSleepCalc(bed, wake){
  var b = minutesOf(bed), w = minutesOf(wake);
  if(b == null || w == null) return 0;
  var m = w - b;
  if(m <= 0) m += 1440;
  return (m >= 30 && m <= 16 * 60) ? m : 0;
}
function lfSleepOf(r){
  if(!r) return 0;
  var s = Math.round(Number(r.sleep) || 0);
  return s > 0 ? s : lfSleepCalc(r.bed, r.wake);
}
function lfStepsOf(r){ return r ? Math.round(Number(r.steps) || 0) : 0; }
/* 1日ぶんを直す（'' や null を入れた項目は消す） */
function lfLogSet(ymd, patch){
  if(!isYmd(ymd)) return null;
  if(!S.healthLog || typeof S.healthLog !== 'object' || Array.isArray(S.healthLog)) S.healthLog = {};
  var cur = Object.assign({}, lfLog(ymd) || {});
  delete cur.del;
  Object.keys(patch).forEach(function(k){
    var v = patch[k];
    if(v === '' || v == null) delete cur[k]; else cur[k] = v;
  });
  cur.mt = Date.now();
  S.healthLog[ymd] = cur;
  touch('healthLog');
  return cur;
}
/* 表は同期で「足したぶんを残す」ので、消すときは「消した印」を新しい時刻で置く */
function lfLogDel(ymd){
  if(!S.healthLog || typeof S.healthLog !== 'object') S.healthLog = {};
  S.healthLog[ymd] = { del:1, mt:Date.now() };
  touch('healthLog');
}
function lfShortStreak(){
  var p = lfPrefs(), d = today(), n = 0;
  if(!lfSleepOf(lfLog(d))) d = shiftDate(d, -1);
  while(n < 30){
    var s = lfSleepOf(lfLog(d));
    if(!s || s >= toNum(p.shortSleep)) break;
    n++; d = shiftDate(d, -1);
  }
  return n;
}
function lfHealthStats(n, end){
  end = end || today(); n = n || 14;
  var days = [], sl = [], st = [];
  for(var i = n - 1; i >= 0; i--){
    var d = shiftDate(end, -i), r = lfLog(d), s = lfSleepOf(r), p = lfStepsOf(r);
    days.push({ date:d, sleep:s, steps:p, bed:r && r.bed || '', wake:r && r.wake || '', src:r && r.src || '' });
    if(s) sl.push(s);
    if(p) st.push(p);
  }
  var avg = function(a){ return a.length ? Math.round(sumBy(a, function(x){ return x; }) / a.length) : 0; };
  return { days:days, sleepAvg:avg(sl), sleepN:sl.length, stepsAvg:avg(st), stepsN:st.length, short:lfShortStreak() };
}
/* お昼より後に「おやすみ」なら、次の日（起きる日）の記録にする。
   お昼より前でも、今日もう起きた記録があれば（朝の二度寝・昼寝）、次の日にする（今日の睡眠を消さないように） */
function lfBedKey(){
  var td = today();
  if(new Date().getHours() >= 12) return shiftDate(td, 1);
  var r = lfLog(td), w = r ? minutesOf(r.wake) : null;
  return (w != null && w <= lfNowMin()) ? shiftDate(td, 1) : td;
}
function lfGoodnight(){
  var k = lfBedKey(), now = hhmmOf(lfNowMin()), r = lfLog(k) || {};
  var patch = { bed:now, wake:'' };
  if(r.src !== 'health') patch.sleep = '';
  lfLogSet(k, patch);
  toast('おやすみなさい。' + now + 'に寝たと記録しました');
  commit();
}
function lfGoodmorning(){
  var k = today(), now = hhmmOf(lfNowMin()), r = lfLog(k) || {};
  /* 今日はもう起きていて、そのあと「おやすみ」した（昼寝）→ 今日の睡眠の記録は変えない */
  var k2 = shiftDate(k, 1), r2 = lfLog(k2);
  if(r.wake && lfSleepOf(r) && r2 && r2.bed && !r2.wake){
    var nap = lfSleepCalc(r2.bed, now);
    lfLogSet(k2, { bed:'' });
    toast('おはようございます。' + (nap ? 'お昼寝 ' + lfHm(nap) + '。' : '') + '今日の睡眠の記録はそのままです');
    commit();
    return;
  }
  var patch = { wake:now }, s = r.bed ? lfSleepCalc(r.bed, now) : 0;
  if(s && r.src !== 'health'){ patch.sleep = s; patch.src = 'hand'; }
  lfLogSet(k, patch);
  toast(s ? 'おはようございます。' + lfHm(s) + 'ねむれました' : 'おはようございます。' + now + 'に起きたと記録しました' + (r.bed ? '' : '（寝た時刻は「手で入れる」から足せます）'));
  commit();
}
function lfLogSave(){
  var d = val('lf_ld') || today();
  if(!isYmd(d)){ toast('日付を選んでください', true); return false; }
  var bedIn = val('lf_lbed').trim(), wakeIn = val('lf_lwake').trim();
  var bed = lfHhmm(bedIn), wake = lfHhmm(wakeIn);
  if((bedIn && !bed) || (wakeIn && !wake)){ toast('時刻は 23:30 の形で入れてください', true); return false; }
  var hrs = lfNum(val('lf_lsl')), stIn = val('lf_lst').trim(), steps = Math.round(lfNum(stIn));
  var patch = { bed:bed, wake:wake }, any = !!(bed || wake);
  var s = (bed && wake) ? lfSleepCalc(bed, wake) : 0;
  if(s){ patch.sleep = s; patch.src = 'hand'; }
  else if(hrs > 0 && hrs <= 20){ patch.sleep = Math.round(hrs * 60); patch.src = 'hand'; any = true; }
  else if(bed || wake){ patch.sleep = ''; }
  if(stIn){ patch.steps = steps > 0 ? steps : ''; any = true; }
  if(!any){ toast('寝た・起きた時刻か、睡眠時間・歩数を入れてください', true); return false; }
  lfLogSet(d, patch);
  lfUi.logForm = false;
  toast(ymdLabel(d) + 'の記録を保存しました');
  commit();
  return true;
}
function lfSleepBtns(){
  return '<button class="mini" data-act="lf-bed">🌙 おやすみ</button><button class="mini" data-act="lf-wake">☀ おはよう</button>';
}
function lfLogFormHtml(){
  var d = isYmd(lfUi.logDate) ? lfUi.logDate : today(), r = lfLog(d) || {};
  var hasTimes = !!(r.bed || r.wake);
  return '<div class="lf-form">' +
    '<div class="grid2"><div><label class="f" for="lf_ld">日付（起きた日）</label><input type="date" id="lf_ld" value="' + d + '"></div>' +
    '<div><label class="f" for="lf_lst">歩数</label><input id="lf_lst" inputmode="numeric" placeholder="例：6500" value="' + (r.steps ? toNum(r.steps) : '') + '"></div></div>' +
    '<div class="grid3"><div><label class="f" for="lf_lbed">寝た時刻</label><input type="time" id="lf_lbed" value="' + esc(r.bed || '') + '"></div>' +
    '<div><label class="f" for="lf_lwake">起きた時刻</label><input type="time" id="lf_lwake" value="' + esc(r.wake || '') + '"></div>' +
    '<div><label class="f" for="lf_lsl">睡眠（時間）</label><input id="lf_lsl" inputmode="decimal" placeholder="7.5" value="' + (!hasTimes && r.sleep ? Math.round(r.sleep / 6) / 10 : '') + '"></div></div>' +
    '<p class="note" style="margin-top:0">寝た・起きた時刻を入れると、睡眠時間は自動で計算します。</p>' +
    '<div class="pair"><button class="btn" data-act="lf-log-save">記録する</button>' +
    '<button class="btn ghost" style="flex:0 0 auto;padding:11px 14px" data-act="lf-log-form">やめる</button></div></div>';
}
function lfLogListHtml(st){
  var rows = st.days.slice().reverse().filter(function(x){ return x.sleep || x.steps || x.bed || x.wake; });
  if(!rows.length) return '<div class="empty lf-empty">まだ記録がありません。</div>';
  return '<div class="lf-list">' + rows.map(function(x){
    return '<div class="row"><div class="grow"><div class="t">' + ymdLabel(x.date) + '</div>' +
      '<div class="s">' + (x.sleep ? '睡眠 ' + lfHm(x.sleep) : '睡眠 —') + (x.bed || x.wake ? '（' + esc(x.bed || '?') + '→' + esc(x.wake || '?') + '）' : '') +
      (x.steps ? '・' + lfComma(x.steps) + '歩' : '') + (x.src === 'health' ? '・ヘルスケア' : '') + '</div></div>' +
      '<button class="mini" data-act="lf-log-edit" data-d="' + x.date + '">直す</button>' +
      '<button class="mini" data-act="lf-log-del" data-d="' + x.date + '">消す</button></div>';
  }).join('') + '</div>';
}
function lfShortcutHelp(){
  if(typeof gasReady !== 'function' || !gasReady()){
    return '<p class="note" style="margin-top:0">先に設定の「Google連携」をつないでください。ショートカットの記録は、Google連携の橋わたしを通して届きます。</p>';
  }
  if(typeof shortKey !== 'function' || !shortKey()){
    return '<p class="note" style="margin-top:0">設定の「iPhone連携」で<b>短い合言葉</b>を作ると使えます。</p>';
  }
  var url = shortUrl('in', '&kind=health&date=日付&sleep=睡眠&steps=歩数');
  return '<ol class="steps">' +
    '<li>ショートカットアプリ →「オートメーション」→「＋」→「時刻」（毎日 21:30 など）→「すぐに実行」</li>' +
    '<li>アクション「ヘルスケアサンプルを検索」：種類「<b>歩数</b>」、開始日「今日」→「統計を計算」（合計）→「変数を設定」で名前を <b>歩数</b> にする</li>' +
    '<li>もう一度「ヘルスケアサンプルを検索」：種類「<b>睡眠分析</b>」、開始日「過去1日以内」、値「睡眠中」→「統計を計算」（継続時間の合計・分）→ 変数 <b>睡眠</b></li>' +
    '<li>「日付を書式設定」：現在の日付を「カスタム」<b>yyyy-MM-dd</b> にして → 変数 <b>日付</b></li>' +
    '<li>「テキスト」に次のURLを貼り、<b>日付</b>・<b>睡眠</b>・<b>歩数</b>の文字を、それぞれの変数に置きかえる ' +
      (typeof copyBtn === 'function' ? copyBtn('URLをコピー', url) : '<code class="urlbox">' + esc(url) + '</code>') + '</li>' +
    '<li>「URLの内容を取得」でそのテキストを開く</li></ol>' +
    '<p class="note">睡眠は「分」でも「時間（7.5 など）」でも大丈夫です。睡眠がうまく取れないときは、<b>&amp;sleep=睡眠</b> を消して歩数だけ送ってもかまいません。' +
    'iOSの版によって、アクションの名前が少しちがうことがあります。届いた記録は、次にアプリを開いたときに入ります（睡眠は起きた日の記録）。</p>';
}
function lfHealthHtml(){
  var p = lfPrefs(), st = lfHealthStats(14), td = today(), r = lfLog(td), s0 = lfSleepOf(r);
  var h = '<div class="grid2 lf-stats">' +
    lfStat('睡眠（14日の平均）', st.sleepN ? lfHm(st.sleepAvg) : '—', '目標 ' + lfHm(p.sleepGoal)) +
    lfStat('歩数（14日の平均）', st.stepsN ? lfComma(st.stepsAvg) + '歩' : '—', '目標 ' + lfComma(p.stepGoal) + '歩') + '</div>';
  if(st.short >= 3) h += lfBn('amber', '😪', '<b>寝不足の日が' + st.short + '日続いています。</b>今日は早めにおふとんへ。昼に15〜20分の仮眠も効きます。');
  h += '<div class="pillrow lf-row">' + lfSleepBtns() + '<button class="mini" data-act="lf-log-form">✎ 手で入れる</button></div>';
  if(lfUi.logForm) h += lfLogFormHtml();
  var smax = Math.max.apply(null, st.days.map(function(x){ return x.sleep / 60; }).concat([10]));
  h += '<div class="lf-ch"><div class="lf-cht">睡眠（時間）<span class="s2">線は目標</span></div>' + lfBars(st.days.map(function(x){
    return { label:String(+x.date.slice(8)), v:x.sleep / 60, low:x.sleep && x.sleep < p.shortSleep, now:x.date === td,
      title:lfMd(x.date) + ' ' + (x.sleep ? lfHm(x.sleep) : '記録なし') };
  }), { max:smax, goal:p.sleepGoal / 60, aria:'14日の睡眠時間' }) + '</div>';
  var tmax = Math.max.apply(null, st.days.map(function(x){ return x.steps; }).concat([toNum(p.stepGoal) * 1.25, 1000]));
  h += '<div class="lf-ch"><div class="lf-cht">歩数<span class="s2">線は目標</span></div>' + lfBars(st.days.map(function(x){
    return { label:String(+x.date.slice(8)), v:x.steps, now:x.date === td, title:lfMd(x.date) + ' ' + (x.steps ? lfComma(x.steps) + '歩' : '記録なし') };
  }), { max:tmax, goal:toNum(p.stepGoal), aria:'14日の歩数', cls:'steps' }) + '</div>';
  h += '<div class="pillrow" style="margin-top:8px"><button class="mini" data-act="lf-log-list">' + (lfUi.logList ? '一覧をとじる' : '記録の一覧') + '</button>' +
    '<button class="mini" data-act="lf-hc-help">' + (lfUi.hcHelp ? '説明をとじる' : '📲 iPhoneのヘルスケアから自動で入れる') + '</button></div>';
  if(lfUi.logList) h += lfLogListHtml(st);
  if(lfUi.hcHelp) h += '<div class="lf-help">' + lfShortcutHelp() + '</div>';
  h += '<p class="note">睡眠は「起きた日」の記録です。寝不足の目安（' + lfHm(p.shortSleep) + 'より短い）や目標は、設定の「生活・健康」で変えられます。</p>';
  return '<div id="lf-sec-body">' + secWrap('lfHealth', '睡眠と歩数', s0 ? 'ゆうべ ' + lfHm(s0) : null, h) + '</div>';
}

/* 受け取り箱：iPhoneのヘルスケアから（ショートカット） */
/* 睡眠の長さ（ショートカットの書き方いろいろ）→ 分。「7時間30分」「7:30」「7:30:00」「7 hr 30 min」「450」「7.5」「27000（秒）」 */
function lfDurMin(v){
  var s = String(v == null ? '' : v).trim();
  try{ s = s.normalize('NFKC'); }catch(e){}
  s = s.replace(/,/g, '');
  var c = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if(c) return (+c[1]) * 60 + (+c[2]) + (c[3] ? (+c[3]) / 60 : 0);
  var h = s.match(/([\d.]+)\s*(?:時間|hours?|hrs?|h)(?![a-z])/i), m = s.match(/([\d.]+)\s*(?:分|minutes?|mins?|m)(?![a-z])/i);
  if(h || m) return (h ? parseFloat(h[1]) * 60 : 0) + (m ? parseFloat(m[1]) : 0);
  var n = lfNum(s);
  if(n > 1440) return n / 60;              /* 秒で来たとき */
  if(n > 0 && n < 24) return n * 60;       /* 時間で来たとき */
  return n;
}
kmInbox('health', function(it, ymd){
  var d = lfFixDate(it.date) || ymd;
  var sl = Math.round(lfDurMin(it.sleep)), st = Math.round(lfNum(it.steps));
  var patch = {}, said = [];
  if(sl >= 10 && sl <= 1440){ patch.sleep = sl; patch.src = 'health'; said.push('睡眠 ' + lfHm(sl)); }
  if(st > 0 && st < 200000){ patch.steps = st; said.push(lfComma(st) + '歩'); }
  if(!said.length) return '';
  lfLogSet(d, patch);
  return 'ヘルスケアから記録（' + lfMd(d) + '）：' + said.join('・');
});

/* ============================== 生理周期（#101） ============================== */
var LF_LOCAL = KEY + ':life';
var LF_FLOW = [[1, '少ない'], [2, 'ふつう'], [3, '多い']];
var LF_PAIN = [[0, 'なし'], [1, '少し'], [2, 'つらい'], [3, 'とてもつらい']];
function lfLocal(){
  try{
    var o = JSON.parse(localStorage.getItem(LF_LOCAL) || 'null');
    return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
  }catch(e){ return {}; }
}
function lfLocalSave(o){
  try{ localStorage.setItem(LF_LOCAL, JSON.stringify(o)); return true; }
  catch(e){ toast('この端末に保存できませんでした', true); return false; }
}
/* 同期するときは、中身をそのままは読めない形にする（手帳全体を読む道具・検索に出さないため）。
   ただの base64（b1）は、AI が手帳全体を読む道具（get_app_data）で読んだときに AI 自身が戻せてしまうので、
   アプリの中だけにある並びで混ぜてから base64 にする（b2）。b1 は読むだけ（前に保存したもの）。 */
var LF_ENC_K = 'kurashi:life:cycle:v2';
function lfMix(bin){
  var out = '', k = LF_ENC_K, n = k.length;
  for(var i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i) ^ ((k.charCodeAt(i % n) + i * 31 + (i >> 3) * 7) & 255));
  return out;
}
function lfEnc(o){ try{ return 'b2:' + btoa(lfMix(unescape(encodeURIComponent(JSON.stringify(o))))); }catch(e){ return ''; } }
function lfDec(s){
  s = String(s || '');
  try{
    if(s.indexOf('b2:') === 0) return JSON.parse(decodeURIComponent(escape(lfMix(atob(s.slice(3))))));
    if(s.indexOf('b1:') === 0) return JSON.parse(decodeURIComponent(escape(atob(s.slice(3)))));
  }catch(e){}
  return null;
}
function lfPClean(p){
  return { start:p.start, end:isYmd(p.end) ? p.end : '', flow:toNum(p.flow), pain:toNum(p.pain), memo:String(p.memo || '').slice(0, 200) };
}
/* この端末の記録と、同期している記録をあわせた一覧（始まった日の順） */
function lfPeriods(){
  var out = [], seen = {};
  (lfLocal().period || []).forEach(function(p){
    if(!p || !isYmd(p.start) || seen[p.id]) return;
    seen[p.id] = 1;
    out.push(Object.assign(lfPClean(p), { id:p.id, mt:p.mt || 0, where:'local' }));
  });
  (Array.isArray(S.kmItems) ? S.kmItems : []).forEach(function(x){
    if(!x || x.mod !== 'life' || x.type !== 'period' || seen[x.id]) return;
    var d = lfDec(x.enc);
    if(!d || !isYmd(d.start)) return;
    seen[x.id] = 1;
    out.push(Object.assign(lfPClean(d), { id:x.id, mt:x.mt || 0, where:'sync' }));
  });
  return out.sort(function(a, b){ return a.start.localeCompare(b.start); });
}
function lfPeriodPut(rec){
  if(!rec || !isYmd(rec.start)) return null;
  var now = Date.now(), clean = lfPClean(rec), id = rec.id || uid('lfp');
  var cur = lfPeriods().filter(function(p){ return p.id === id; })[0];
  var where = cur ? cur.where : (lfPrefs().periodSync ? 'sync' : 'local');
  if(where === 'sync'){
    if(!Array.isArray(S.kmItems)) S.kmItems = [];
    var it = S.kmItems.filter(function(x){ return x.id === id; })[0];
    if(it){ it.enc = lfEnc(clean); it.mt = now; }
    else S.kmItems.push({ id:id, mt:now, mod:'life', type:'period', enc:lfEnc(clean) });
  }else{
    var o = lfLocal();
    o.period = (o.period || []).filter(function(p){ return p.id !== id; });
    o.period.push(Object.assign({ id:id, mt:now }, clean));
    lfLocalSave(o);
  }
  return id;
}
function lfPeriodDel(id){
  var cur = lfPeriods().filter(function(p){ return p.id === id; })[0];
  if(!cur) return false;
  if(cur.where === 'sync') removeItem('kmItems', id);
  else{ var o = lfLocal(); o.period = (o.period || []).filter(function(p){ return p.id !== id; }); lfLocalSave(o); }
  return true;
}
/* この端末だけの記録 → 同期（同期するを選んだとき・ほかの端末で選ばれていたとき） */
function lfPeriodToSync(){
  var o = lfLocal(), n = 0;
  if(!(o.period || []).length) return 0;
  if(!Array.isArray(S.kmItems)) S.kmItems = [];
  o.period.forEach(function(p){
    if(!p || !isYmd(p.start) || S.kmItems.some(function(x){ return x.id === p.id; })) return;
    /* 前に「同期をやめる」で消した印（delAt）が残っている id は、もどした印をつけないと同期で消えてしまう */
    if(S.delAt && S.delAt[p.id] && typeof markRevived === 'function') markRevived(p.id);
    S.kmItems.push({ id:p.id, mt:Date.now(), mod:'life', type:'period', enc:lfEnc(lfPClean(p)) });
    n++;
  });
  o.period = [];
  lfLocalSave(o);
  return n;
}
/* 同期 → この端末だけ（同期をやめると、ほかの端末からは消える） */
function lfPeriodToLocal(){
  var mine = (Array.isArray(S.kmItems) ? S.kmItems : []).filter(function(x){ return x && x.mod === 'life' && x.type === 'period'; });
  if(!mine.length) return 0;
  var o = lfLocal();
  o.period = o.period || [];
  mine.forEach(function(x){
    var d = lfDec(x.enc);
    if(d && isYmd(d.start) && !o.period.some(function(p){ return p.id === x.id; })) o.period.push(Object.assign({ id:x.id, mt:Date.now() }, lfPClean(d)));
  });
  if(!lfLocalSave(o)) return 0;
  mine.forEach(function(x){ removeItem('kmItems', x.id); });
  return mine.length;
}
/* 前の形（b1）で同期しているものを、新しい形（b2）に置きかえる */
function lfPeriodReenc(){
  var n = 0;
  (Array.isArray(S.kmItems) ? S.kmItems : []).forEach(function(x){
    if(!x || x.mod !== 'life' || x.type !== 'period' || String(x.enc || '').indexOf('b1:') !== 0) return;
    var d = lfDec(x.enc);
    if(!d) return;
    x.enc = lfEnc(lfPClean(d)); x.mt = Date.now(); n++;
  });
  return n;
}
function lfPeriodSyncSet(on){
  lfSet({ periodSync:on ? 1 : 0 });
  var n = on ? lfPeriodToSync() : lfPeriodToLocal();
  commit();
  return n;
}
function lfPeriodStats(list){
  list = list || lfPeriods();
  if(!list.length) return null;
  var cycles = [], i;
  for(i = 1; i < list.length; i++){
    var d = daysBetween(list[i - 1].start, list[i].start);
    if(d >= 20 && d <= 45) cycles.push(d);
  }
  var rc = cycles.slice(-6);
  var avg = rc.length ? Math.round(sumBy(rc, function(x){ return x; }) / rc.length) : 28;
  var lens = list.filter(function(p){ return isYmd(p.end); }).map(function(p){ return daysBetween(p.start, p.end) + 1; })
    .filter(function(n){ return n >= 1 && n <= 14; }).slice(-6);
  var plen = lens.length ? Math.round(sumBy(lens, function(x){ return x; }) / lens.length) : 5;
  var last = list[list.length - 1], td = today();
  var next = shiftDate(last.start, avg), dayN = daysBetween(last.start, td) + 1;
  var ongoing = isYmd(last.end) ? (td >= last.start && td <= last.end) : (dayN >= 1 && dayN <= Math.max(plen + 2, 8));
  var ovu = shiftDate(next, -14);
  return { n:list.length, cycles:rc, avg:avg, known:rc.length, plen:plen, last:last, next:next, late:daysBetween(next, td), ovu:ovu,
    fertile:[shiftDate(ovu, -5), shiftDate(ovu, 1)], ongoing:ongoing, dayN:dayN,
    spread:rc.length >= 2 ? Math.max.apply(null, rc) - Math.min.apply(null, rc) : 0 };
}
/* カレンダーの印：{ 'YYYY-MM-DD': 'rec'（記録）|'pred'（予想）|'ovu'（排卵の目安） } */
function lfPeriodMarks(from, to){
  var list = lfPeriods(), st = lfPeriodStats(list), m = {}, td = today();
  if(!st) return m;
  list.forEach(function(p){
    var end = isYmd(p.end) ? p.end : shiftDate(p.start, st.plen - 1);
    for(var d = p.start, i = 0; d <= end && i < 15; d = shiftDate(d, 1), i++){ if(d >= from && d <= to) m[d] = 'rec'; }
  });
  if(st.late > 0) return m;                      /* 予定日をすぎているときは、先の予想は出さない */
  for(var c = 0; c < 3; c++){
    var nx = shiftDate(st.next, st.avg * c);
    for(var j = 0; j < st.plen; j++){ var dd = shiftDate(nx, j); if(dd >= td && dd >= from && dd <= to && !m[dd]) m[dd] = 'pred'; }
    var ov = shiftDate(nx, -14);
    if(ov >= td && ov >= from && ov <= to && !m[ov]) m[ov] = 'ovu';
  }
  return m;
}
/* 人に見られても分からない言い方を選べる */
function lfPWord(){
  var p = lfPrefs(), c = String(p.periodCustom || '').trim() || '📌 じゅんび';
  if(p.periodWord === 'moon') return { name:'🌙', rec:'🌙', pred:'🌙の予定', ovu:'☆', title:'🌙 そろそろです', body:'{d}ごろの予定です。準備しておくと安心です。' };
  if(p.periodWord === 'custom') return { name:c, rec:'●', pred:c, ovu:'☆', title:c, body:'{d}ごろ' };
  return { name:'生理', rec:'生理', pred:'生理の予定', ovu:'排卵の目安', title:'生理の予定日が近づいています',
    body:'予定日は{d}ごろです（目安）。ナプキンや痛み止めを準備しておくと安心です。' };
}
function lfPfRead(){
  var f = lfUi.pf;
  if(!f) return;
  var s = document.getElementById('lf_ps'), e = document.getElementById('lf_pe'), m = document.getElementById('lf_pm');
  if(s) f.start = s.value;
  if(e) f.end = e.value;
  if(m) f.memo = m.value;
}
function lfPeriodFormHtml(){
  var f = lfUi.pf;
  var pills = function(act, opts, cur){
    return '<div class="pillrow">' + opts.map(function(o){
      return '<button data-act="' + act + '" data-v="' + o[0] + '" class="' + (toNum(cur) === o[0] ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  };
  return '<div class="lf-form">' +
    '<div class="grid2"><div><label class="f" for="lf_ps">始まった日</label><input type="date" id="lf_ps" value="' + esc(f.start || '') + '"></div>' +
    '<div><label class="f" for="lf_pe">終わった日（まだなら空）</label><input type="date" id="lf_pe" value="' + esc(f.end || '') + '"></div></div>' +
    '<label class="f">量</label>' + pills('lf-p-flow', LF_FLOW, f.flow) +
    '<label class="f">痛み</label>' + pills('lf-p-pain', LF_PAIN, f.pain) +
    '<div class="field"><label class="f" for="lf_pm">メモ（なくてもよい）</label><input id="lf_pm" value="' + esc(f.memo || '') + '" placeholder="例：頭痛があった・薬を飲んだ"></div>' +
    '<div class="pair"><button class="btn" data-act="lf-p-save">保存する</button>' +
    '<button class="btn ghost" style="flex:0 0 auto;padding:11px 14px" data-act="lf-p-cancel">やめる</button></div>' +
    (f.id ? '<button class="mini" style="margin-top:8px" data-act="lf-p-del" data-id="' + esc(f.id) + '">この記録を消す</button>' : '') + '</div>';
}
function lfPeriodHtml(){
  var p = lfPrefs(), W = lfPWord(), list = lfPeriods(), st = lfPeriodStats(list);
  var h = '';
  if(st){
    var line = st.ongoing ? '<b>いま ' + st.dayN + '日目</b>です。無理をしないでね。'
      : st.late > 0 ? '<b>予定日（' + lfMd(st.next) + '）から' + st.late + '日すぎています。</b>ストレスや体調で遅れることもあります。'
      : '次の予定は <b>' + ymdLabel(st.next) + 'ごろ</b>（あと' + (-st.late) + '日）';
    h += '<div class="msg lf-pmsg">' + line + '</div>' +
      '<div class="grid3 keep3 lf-pst">' + lfStat('平均の周期', st.avg + '日', st.known ? st.known + '回ぶん' : '記録が少ない（28日で計算）') +
      lfStat('平均の日数', st.plen + '日', '') + lfStat('排卵の目安', lfMd(st.ovu) + 'ごろ', '') + '</div>';
    if(st.spread >= 8) h += '<p class="note">周期が ' + st.spread + '日ほどばらついています。予想はずれやすいです。</p>';
  }else{
    h += '<div class="empty lf-empty">まだ記録がありません。始まった日を記録すると、次の予定日の目安が出ます。</div>';
  }
  h += '<div class="pillrow lf-row"><button class="mini" data-act="lf-p-start">始まった（今日）</button>' +
    '<button class="mini" data-act="lf-p-end">終わった（今日）</button><button class="mini" data-act="lf-p-form">日付を選んで記録</button></div>';
  if(lfUi.pf) h += lfPeriodFormHtml();
  if(list.length){
    var rows = list.slice().reverse(), show = lfUi.pList ? rows : rows.slice(0, 4);
    h += '<div class="lf-list">' + show.map(function(x){
      var n = isYmd(x.end) ? daysBetween(x.start, x.end) + 1 : 0;
      var fl = LF_FLOW.filter(function(o){ return o[0] === x.flow; })[0], pn = LF_PAIN.filter(function(o){ return o[0] === x.pain; })[0];
      return '<div class="row"><div class="grow"><div class="t">' + lfMd(x.start) + '〜' + (isYmd(x.end) ? lfMd(x.end) + '（' + n + '日）' : '') + '</div>' +
        '<div class="s">' + [fl ? '量：' + fl[1] : '', x.pain && pn ? '痛み：' + pn[1] : '', x.memo ? esc(x.memo) : ''].filter(Boolean).join('・') + '</div></div>' +
        '<button class="mini" data-act="lf-p-edit" data-id="' + esc(x.id) + '">直す</button></div>';
    }).join('') + '</div>';
    if(rows.length > 4) h += '<button class="mini" data-act="lf-p-list">' + (lfUi.pList ? 'たたむ' : 'ぜんぶ見る（' + rows.length + '件）') + '</button>';
  }
  h += '<p class="note">' + (p.periodSync ? 'ほかの端末と同期しています（中身は読めない形で送ります）。' : '<b>この端末だけ</b>に保存しています（ほかの端末やGoogleには送りません）。') +
    (p.periodAi ? 'AIそうだんで聞かれたときは、AIに見せます。' : 'AIには見せません。') + '設定の「生活・健康」で変えられます。</p>' +
    '<p class="note">予定日・排卵日は、これまでの記録から計算した<b>目安</b>です。周期は体調で変わります（避妊には使えません）。' +
    '痛みが強い・周期が大きく乱れるときは、婦人科や大学の保健センターに相談してください。</p>';
  var note = st ? (st.ongoing ? st.dayN + '日目' : st.late > 0 ? '' : 'あと' + (-st.late) + '日') : null;
  return '<div id="lf-sec-period">' + secWrap('lfPeriod', W.name + 'の記録', note, h) + '</div>';
}
/* 予定タブのカレンダーの下に、その月の印 */
function lfPeriodCalHtml(ym){
  var p = lfPrefs();
  if(!p.periodCal || !isYm(ym)) return '';
  var a = ym.split('-'), y = +a[0], mo = +a[1], dim = new Date(y, mo, 0).getDate();
  var marks = lfPeriodMarks(ym + '-01', ym + '-' + pad(dim));
  if(!Object.keys(marks).length) return '';
  var W = lfPWord(), td = today(), off = new Date(y, mo - 1, 1).getDay(), cells = '';
  for(var i = 0; i < off; i++) cells += '<span class="lf-cd blank"></span>';
  for(var d = 1; d <= dim; d++){
    var ymd = ym + '-' + pad(d), mk = marks[ymd] || '';
    cells += '<span class="lf-cd ' + mk + (ymd === td ? ' now' : '') + '" title="' + esc(mk === 'rec' ? W.rec : mk === 'pred' ? W.pred : mk === 'ovu' ? W.ovu : '') + '">' + d + '</span>';
  }
  return '<div class="lf-calbox" id="lf-sec-cycle"><div class="head"><h2>' + esc(W.name) + '（' + mo + '月）</h2><span>目安</span></div>' +
    '<div class="lf-cal">' + WDAY.map(function(w){ return '<span class="lf-cw">' + w + '</span>'; }).join('') + cells + '</div>' +
    '<div class="lf-legend"><span><i class="rec"></i>' + esc(W.rec) + '</span><span><i class="pred"></i>' + esc(W.pred) + '</span>' +
    '<span><i class="ovu"></i>' + esc(p.periodWord === 'plain' ? W.ovu : '☆') + '</span></div></div>';
}

/* ============================== 予防接種・健康診断（#106） ============================== */
var LF_VAX = [
  { id:'measles',   name:'麻しん（はしか）',               re:/麻しん|麻疹|はしか|ＭＲ|\bMR\b|MR[ワ（(]|MMR/i, rule:'mmr' },
  { id:'rubella',   name:'風しん',                         re:/風しん|風疹|ＭＲ|\bMR\b|MR[ワ（(]|MMR/i, rule:'mmr' },
  { id:'varicella', name:'水痘（みずぼうそう）',           re:/水痘|水ぼうそう|みずぼうそう/i, rule:'mmr' },
  { id:'mumps',     name:'流行性耳下腺炎（おたふくかぜ）', re:/耳下腺炎|おたふく|ムンプス|MMR/i, rule:'mmr' },
  { id:'hepb',      name:'B型肝炎',                        re:/[BＢ]型肝炎|HBs|HBV|ＨＢ|HBワクチン/i, rule:'hepb' },
  { id:'flu',       name:'インフルエンザ',                 re:/インフル/i, rule:'flu' },
  { id:'tb',        name:'結核（IGRA・ツベルクリン）',     re:/結核|IGRA|T-?SPOT|QFT|クォンティ|ツベルクリン|ツ反/i, rule:'tb' },
  { id:'checkup',   name:'健康診断',                       re:/健康診断|健診/i, rule:'year' }
];
var LF_VAX_OPT = LF_VAX.map(function(x){ return [x.id, x.name]; }).concat([['mr', 'MRワクチン（麻しん・風しん）'], ['', 'そのほか']]);
var LF_VKIND = [['vaccine', 'ワクチン'], ['antibody', '抗体検査'], ['checkup', '健診・検査']];
function lfVaxList(){ return Array.isArray(S.vaccines) ? S.vaccines : []; }
function lfVaxItemName(id){ var o = LF_VAX_OPT.filter(function(x){ return x[0] === id; })[0]; return o && id ? o[1] : ''; }
/* 前からある「健康の期限」（S.health）も、読むだけで使う */
function lfVaxAll(){
  var out = lfVaxList().filter(function(x){ return x && x.id; }).slice();
  (Array.isArray(S.health) ? S.health : []).forEach(function(h){
    if(!h || !h.name) return;
    out.push({ id:h.id, name:h.name, date:h.date || '', next:h.next || '', memo:h.memo || '', from:'health',
      kind:/抗体/.test(h.name) ? 'antibody' : /ワクチン|接種/.test(h.name) ? 'vaccine' : 'checkup' });
  });
  return out;
}
function lfVaxMatch(x, it){
  if(x.item) return x.item === it.id || (x.item === 'mr' && (it.id === 'measles' || it.id === 'rubella'));
  return it.re.test(String(x.name || ''));
}
function lfVaxOk(x){ return x.ok === 1 || x.ok === '1'; }
function lfVaxNg(x){ return x.ok === 0 || x.ok === '0'; }
/* チェック表：st … ok（そろっている）/ part（あと少し）/ none（記録なし） */
function lfVaxStatus(){
  var all = lfVaxAll(), td = today(), y = +td.slice(0, 4), mo = +td.slice(5, 7);
  var fy = (mo >= 4 ? y : y - 1) + '-04-01';                 /* 今年度のはじめ */
  var season = (mo >= 9 ? y : y - 1) + '-09-01';             /* インフルエンザ：今のシーズン */
  return LF_VAX.map(function(it){
    var recs = all.filter(function(x){ return lfVaxMatch(x, it); });
    var vac = recs.filter(function(x){ return x.kind === 'vaccine'; }), anti = recs.filter(function(x){ return x.kind === 'antibody'; });
    var doses = Math.max(vac.length, Math.max.apply(null, vac.map(function(x){ return toNum(x.dose); }).concat([0])));
    var antiOk = anti.some(lfVaxOk), antiNg = !antiOk && anti.some(lfVaxNg);
    var st = 'none', msg = '記録がありません';
    if(it.rule === 'mmr'){
      if(antiOk){ st = 'ok'; msg = '抗体あり（判定：足りている）'; }
      else if(doses >= 2){ st = 'ok'; msg = 'ワクチン' + doses + '回'; }
      else if(doses === 1){ st = 'part'; msg = 'ワクチン1回（ふつうは2回）'; }
      else if(antiNg){ st = 'part'; msg = '抗体が足りない判定 → ワクチンが必要なことが多いです'; }
      else if(anti.length){ st = 'part'; msg = '抗体検査の「判定」を入れてください'; }
      else msg = '抗体価（検査）かワクチン2回の記録';
    }else if(it.rule === 'hepb'){
      if(antiOk){ st = 'ok'; msg = (doses ? 'ワクチン' + doses + '回・' : '') + '抗体あり'; }
      else if(doses >= 3){ st = 'part'; msg = 'ワクチン3回ずみ → 抗体検査を'; }
      else if(doses > 0){ st = 'part'; msg = 'ワクチン' + doses + '回（あと' + (3 - doses) + '回）'; }
      else if(antiNg){ st = 'part'; msg = '抗体が足りない判定 → ワクチン3回が多いです'; }
      else msg = 'ワクチン3回と抗体検査の記録';
    }else if(it.rule === 'flu'){
      var cur = vac.filter(function(x){ return isYmd(x.date) && x.date >= season; });
      if(cur.length){ st = 'ok'; msg = '今シーズン ' + lfMd(cur[cur.length - 1].date) + 'に接種'; }
      else msg = '毎年10〜12月ごろに受けます' + (vac.length ? '（前のシーズンの記録あり）' : '');
    }else if(it.rule === 'tb'){
      var dated = recs.filter(function(x){ return isYmd(x.date); }).sort(function(a, b){ return a.date.localeCompare(b.date); });
      var lastT = dated[dated.length - 1];
      if(lastT && lastT.date >= shiftDate(td, -365)){ st = 'ok'; msg = lfMd(lastT.date) + 'に検査' + (lastT.result ? '（' + lastT.result + '）' : ''); }
      else if(recs.length){ st = 'part'; msg = '1年以上前の検査です。大学に確かめてください'; }
      else msg = 'IGRA（T-SPOT・QFT）かツベルクリンの記録';
    }else{
      var thisYear = recs.filter(function(x){ return isYmd(x.date) && x.date >= fy; });
      if(thisYear.length){ st = 'ok'; msg = '今年度 ' + lfMd(thisYear[thisYear.length - 1].date) + 'に受診'; }
      else msg = '今年度の記録がありません（4〜6月ごろが多い）';
    }
    return { id:it.id, name:it.name, st:st, msg:msg, n:recs.length };
  });
}
function lfXfNew(item){
  return { id:'', kind:(item === 'checkup' || item === 'tb') ? 'checkup' : 'vaccine', item:item || '', name:'', date:'', dose:'', result:'', ok:'',
    place:'', next:'', memo:'', photos:[] };
}
function lfXfRead(){
  var f = lfUi.xf;
  if(!f) return;
  var g = function(id){ var e = document.getElementById(id); return e ? e.value : null; };
  var map = { item:'lf_xitem', name:'lf_xname', date:'lf_xdate', dose:'lf_xdose', result:'lf_xres', place:'lf_xplace', next:'lf_xnext', memo:'lf_xmemo' };
  Object.keys(map).forEach(function(k){ var v = g(map[k]); if(v != null) f[k] = v; });
}
function lfVaxFormHtml(){
  var f = lfUi.xf;
  var inp = function(id, label, v, ph, type){
    return '<div><label class="f" for="' + id + '">' + label + '</label><input' + (type ? ' type="' + type + '"' : '') + ' id="' + id + '" value="' + esc(v || '') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '></div>';
  };
  return '<div class="lf-form">' +
    '<label class="f">種類</label><div class="pillrow">' + LF_VKIND.map(function(k){
      return '<button data-act="lf-x-kind" data-v="' + k[0] + '" class="' + (f.kind === k[0] ? 'on' : '') + '">' + k[1] + '</button>';
    }).join('') + '</div>' +
    '<div class="grid2"><div><label class="f" for="lf_xitem">項目</label><select id="lf_xitem">' + LF_VAX_OPT.map(function(o){
      return '<option value="' + o[0] + '"' + (String(f.item || '') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select></div>' + inp('lf_xname', '名前（空なら項目の名前）', f.name, '例：MRワクチン') + '</div>' +
    '<div class="grid3">' + inp('lf_xdate', '日付', f.date, '', 'date') + inp('lf_xdose', '何回目', f.dose, '1') + inp('lf_xnext', '次の予定日', f.next, '', 'date') + '</div>' +
    '<div class="grid2">' + inp('lf_xres', '結果（抗体価など）', f.result, '例：EIA 16.0') + inp('lf_xplace', '場所', f.place, '例：保健センター') + '</div>' +
    (f.kind === 'antibody' ? '<label class="f">判定（大学・病院の判定のとおりに）</label><div class="pillrow">' + [[1, '足りている'], [0, '足りない'], ['', 'わからない']].map(function(o){
      return '<button data-act="lf-x-ok" data-v="' + o[0] + '" class="' + (String(f.ok) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div>' : '') +
    '<div class="field">' + inp('lf_xmemo', 'メモ', f.memo, '') + '</div>' +
    ((f.photos || []).length ? '<div class="lf-thumbs">' + f.photos.map(function(pid){
      return '<img class="lf-thumb" data-pid="' + esc(pid) + '" data-act="lf-photo" data-id="' + esc(pid) + '" alt="証明書の写真">';
    }).join('') + '</div>' : '') +
    '<button class="mini" data-act="lf-x-photo">📎 証明書の写真をつける</button>' +
    '<div class="pair" style="margin-top:10px"><button class="btn" data-act="lf-x-save">保存する</button>' +
    '<button class="btn ghost" style="flex:0 0 auto;padding:11px 14px" data-act="lf-x-cancel">やめる</button></div>' +
    (f.id ? '<button class="mini" style="margin-top:8px" data-act="lf-x-del" data-id="' + esc(f.id) + '">この記録を消す</button>' : '') + '</div>';
}
function lfVaxSave(){
  lfXfRead();
  var f = lfUi.xf;
  if(!f) return null;
  var name = String(f.name || '').trim() || lfVaxItemName(f.item);
  if(!name){ toast('項目か名前を入れてください', true); return null; }
  if((f.date && !isYmd(f.date)) || (f.next && !isYmd(f.next))){ toast('日付を選びなおしてください', true); return null; }
  var rec = { kind:['vaccine', 'antibody', 'checkup'].indexOf(f.kind) >= 0 ? f.kind : 'vaccine', item:f.item || '', name:name.slice(0, 60),
    date:f.date || '', dose:toNum(f.dose) || '', result:String(f.result || '').slice(0, 80),
    ok:(f.kind === 'antibody' && f.ok !== '' && f.ok != null) ? toNum(f.ok) : '',
    place:String(f.place || '').slice(0, 60), next:f.next || '', memo:String(f.memo || '').slice(0, 300), photos:(f.photos || []).slice(), mt:Date.now() };
  if(!Array.isArray(S.vaccines)) S.vaccines = [];
  var cur = f.id ? S.vaccines.filter(function(x){ return x.id === f.id; })[0] : null;
  if(cur) Object.assign(cur, rec);
  else{ rec.id = uid('vx'); S.vaccines.push(rec); cur = rec; }
  lfUi.xf = null;
  toast('記録しました');
  commit();
  return cur;
}
function lfVaxScanPrompt(){
  return 'これは予防接種の記録・抗体検査の結果・健康診断や結核の検査の結果などの証明書の写真です。書かれている記録を取り出して、JSONだけを返してください。\n' +
    '{"items":[{"kind":"vaccine（ワクチン）|antibody（抗体検査）|checkup（健診・検査）","item":"measles|rubella|varicella|mumps|hepb|flu|tb|checkup|mr|other",' +
    '"name":"ワクチン・検査の名前","date":"YYYY-MM-DD","dose":何回目（数字。わからなければ0）,"result":"抗体価や結果（例：EIA 16.0 陽性）",' +
    '"ok":1（基準を満たす・陽性と書いてある）|0（満たさない・陰性と書いてある）|null（書いていない）,"place":"医療機関の名前"}]}\n' +
    '・和暦は西暦に直す（令和の年＋2018、平成の年＋1988）。\n' +
    '・読めないところは空にする。書いていないことは作らない。\n' +
    '・氏名・生年月日・住所など、記録以外の個人情報は書き出さない。';
}
async function lfVaxScanRun(file){
  if(!lfAiNeed()) return;
  lfUi.xScan = { busy:true, img:'', list:null, err:'' };
  lfRender();
  try{
    var data = await resizeImage(file, 1800, 0.82);
    await lfVaxScanData(data);
  }catch(e){
    lfUi.xScan = { busy:false, img:'', list:null, err:'写真を読めませんでした：' + e.message };
    lfRender();
  }
}
async function lfVaxScanData(data){
  var sc = lfUi.xScan = { busy:true, img:data, list:null, err:'' };
  lfRender();
  try{
    var r = await aiJson(lfVaxScanPrompt(), [data], 'lf-vax');
    var items = (r && Array.isArray(r.items)) ? r.items : (Array.isArray(r) ? r : []);
    sc.list = items.map(function(x){
      x = x || {};
      var item = LF_VAX_OPT.some(function(o){ return o[0] === x.item && o[0]; }) ? x.item : '';
      /* 判定は 1/0 のほか、true/false・"1"/"0" で来ることもある */
      var okv = (x.ok === 1 || x.ok === true || x.ok === '1') ? 1 : (x.ok === 0 || x.ok === false || x.ok === '0') ? 0 : '';
      return { kind:['vaccine', 'antibody', 'checkup'].indexOf(x.kind) >= 0 ? x.kind : 'vaccine', item:item,
        name:String(x.name || lfVaxItemName(item) || '').slice(0, 60), date:lfFixDate(x.date), dose:toNum(x.dose) || '',
        result:String(x.result || '').slice(0, 80), ok:okv, place:String(x.place || '').slice(0, 60), pick:1 };
    }).filter(function(x){ return x.name; }).slice(0, 20);
  }catch(e){
    sc.err = '読み取れませんでした：' + e.message;
    logErr('予防接種の写真', e.message);
  }finally{
    sc.busy = false;
    lfRender();
  }
}
async function lfVaxScanAdd(){
  var sc = lfUi.xScan;
  if(!sc || !sc.list || sc.adding) return 0;
  var picks = sc.list.filter(function(x, i){
    var el = document.querySelector('.lf-xs-pick[data-i="' + i + '"]');
    return el ? el.checked : x.pick;
  });
  if(!picks.length){ toast('登録するものにチェックを入れてください', true); return 0; }
  sc.adding = true;                        /* 写真を保存している間に、もう一度押されても二重に入れない */
  var pid = '';
  if(sc.img){ try{ pid = uid('mi'); await photoPut(pid, sc.img); }catch(e){ pid = ''; } }
  if(!Array.isArray(S.vaccines)) S.vaccines = [];
  var now = Date.now();
  picks.forEach(function(x){
    S.vaccines.push({ id:uid('vx'), kind:x.kind, item:x.item, name:x.name, date:x.date, dose:x.dose, result:x.result, ok:x.ok, place:x.place,
      next:'', memo:'証明書の写真から', photos:pid ? [pid] : [], mt:now });
  });
  lfUi.xScan = null;
  toast(picks.length + '件を記録しました');
  commit();
  return picks.length;
}
function lfVaxScanHtml(){
  var sc = lfUi.xScan;
  var h = '<div class="lf-form">';
  if(sc.img) h += '<img class="lf-simg" src="' + sc.img + '" alt="証明書の写真">';
  if(sc.busy) h += '<div class="s2">AIが読んでいます…</div>';
  if(sc.err) h += '<p class="note" style="color:var(--rakuten)">' + esc(sc.err) + '</p>';
  if(sc.list){
    h += sc.list.length ? '<label class="f">読み取った記録（登録するものにチェック）</label>' + sc.list.map(function(x, i){
      return '<label class="row lf-cl"><input type="checkbox" class="lf-xs-pick" data-i="' + i + '"' + (x.pick ? ' checked' : '') + '>' +
        '<div class="grow"><div class="t">' + esc(x.name) + (x.dose ? ' ' + x.dose + '回目' : '') + '</div>' +
        '<div class="s">' + esc((LF_VKIND.filter(function(k){ return k[0] === x.kind; })[0] || ['', ''])[1]) + (x.date ? '・' + ymdLabel(x.date) : '・日付なし') +
        (x.result ? '・' + esc(x.result) : '') + (x.ok === 1 ? '・足りている' : x.ok === 0 ? '・足りない' : '') + '</div></div></label>';
    }).join('') + '<div class="pair" style="margin-top:8px"><button class="btn" data-act="lf-x-scan-add">チェックした記録を入れる</button>' +
      '<button class="btn ghost" style="flex:0 0 auto;padding:11px 14px" data-act="lf-x-scan-cancel">やめる</button></div>'
      : '<div class="empty lf-empty">記録を見つけられませんでした。<button class="mini" data-act="lf-x-scan-cancel">とじる</button></div>';
  }
  return h + '<p class="note">写真はGoogleのAIに送られて読み取られます。読みまちがえることがあるので、入れる前に証明書と見くらべてください。</p></div>';
}
function lfVaxHtml(){
  var stt = lfVaxStatus(), td = today();
  var list = lfVaxList().filter(function(x){ return x && x.id; }).slice().sort(function(a, b){ return String(b.date || '').localeCompare(String(a.date || '')); });
  var okN = stt.filter(function(x){ return x.st === 'ok'; }).length;
  var h = '<p class="note lf-top">実習の前に大学から求められることが多いものです。必要なもの・回数・基準は、<b>大学の指示を優先</b>してください（実習の手引き・保健センターで確かめて）。ここの判定は目安です。</p>';
  h += '<div class="lf-vx">' + stt.map(function(x){
    return '<div class="lf-vr"><span class="lf-st ' + x.st + '" aria-label="' + (x.st === 'ok' ? 'そろっている' : x.st === 'part' ? 'あと少し' : '記録なし') + '">' +
      (x.st === 'ok' ? '✓' : x.st === 'part' ? '△' : '－') + '</span>' +
      '<span class="grow"><span class="t">' + esc(x.name) + '</span><span class="s">' + esc(x.msg) + '</span></span>' +
      '<button class="mini" data-act="lf-x-form" data-item="' + x.id + '">記録</button></div>';
  }).join('') + '</div>';
  var soon = list.filter(function(x){ return isYmd(x.next) && daysBetween(td, x.next) <= 30; });
  soon.forEach(function(x){
    var n = daysBetween(td, x.next);
    h += lfBn(n < 0 ? 'red' : 'amber', '💉', esc(x.name) + 'の次の予定日は' + ymdLabel(x.next) + (n < 0 ? '（<b>すぎています</b>）' : '（あと' + n + '日）') + '。');
  });
  h += '<div class="pillrow lf-row"><button class="mini" data-act="lf-x-form">＋ 記録を足す</button><button class="mini" data-act="lf-x-scan">📷 証明書の写真をAIで読む</button></div>';
  if(lfUi.xScan) h += lfVaxScanHtml();
  if(lfUi.xf) h += lfVaxFormHtml();
  if(list.length){
    var show = lfUi.xList ? list : list.slice(0, 6);
    h += '<div class="lf-list">' + show.map(function(x){
      var kn = (LF_VKIND.filter(function(k){ return k[0] === x.kind; })[0] || ['', ''])[1];
      return '<div class="row"><div class="grow"><div class="t">' + esc(x.name || '記録') + (x.dose ? ' ' + esc(x.dose) + '回目' : '') + '</div>' +
        '<div class="s">' + [kn, x.date ? ymdLabel(x.date) : '日付なし', x.result ? esc(x.result) : '', lfVaxOk(x) ? '足りている' : lfVaxNg(x) ? '足りない' : '',
          x.place ? esc(x.place) : '', isYmd(x.next) ? '次 ' + lfMd(x.next) : ''].filter(Boolean).join('・') + '</div>' +
        ((x.photos || []).length ? '<div class="lf-thumbs">' + x.photos.map(function(pid){
          return '<img class="lf-thumb" data-pid="' + esc(pid) + '" data-act="lf-photo" data-id="' + esc(pid) + '" alt="証明書の写真">';
        }).join('') + '</div>' : '') + '</div>' +
        '<button class="mini" data-act="lf-x-edit" data-id="' + esc(x.id) + '">直す</button></div>';
    }).join('') + '</div>';
    if(list.length > 6) h += '<button class="mini" data-act="lf-x-list">' + (lfUi.xList ? 'たたむ' : 'ぜんぶ見る（' + list.length + '件）') + '</button>';
  }
  h += '<p class="note">抗体価の基準は、検査の方法（EIA法・HI法など）で変わります。「判定」には、大学・病院の判定をそのまま入れてください。' +
    '数値は目安です。教科書・先生の資料・保健センターで確かめてください。</p>';
  return '<div id="lf-sec-vax">' + secWrap('lfVax', '予防接種・健康診断', okN + '/' + stt.length + ' そろっている', h) + '</div>';
}

/* ============================== 寒暖差・花粉（#110）・暑さ指数（#180） ============================== */
var LF_WX_KEY = KEY + ':life:wx';
var lfWx = (function(){
  var o = null;
  try{ o = JSON.parse(localStorage.getItem(LF_WX_KEY) || 'null'); }catch(e){}
  return Object.assign({ om:null, omAt:0, wbgt:null, wbgtAt:0, alert:null, alertAt:0, err:{} }, o || {});
})();
var lfWxBusy = false;
var LF_HOME = { lat:34.889, lon:135.225 };                        /* 家（三田） */
var LF_WBGT_PTS = [['63411', '三田'], ['63518', '神戸']];          /* 暑さ指数の地点（大学のある西宮にいちばん近いのは神戸） */
var LF_POLLEN = [
  { id:'sugi',   name:'スギ',             from:'02-01', to:'04-20', peak:['03-01', '03-31'], warm:12 },
  { id:'hinoki', name:'ヒノキ',           from:'03-10', to:'05-15', peak:['04-01', '04-30'], warm:15 },
  { id:'ine',    name:'イネ科',           from:'05-01', to:'06-30', peak:['05-15', '06-15'], warm:20 },
  { id:'buta',   name:'ブタクサ・ヨモギ', from:'08-10', to:'10-20', peak:['09-01', '09-30'], warm:20 }
];
function lfWbgtSeason(ymd){
  if(LF.forceSeason) return true;
  var m = +String(ymd || today()).slice(5, 7);
  return m >= 5 && m <= 10;
}
function lfOmUrl(){
  return 'https://api.open-meteo.com/v1/forecast?latitude=' + LF_HOME.lat + '&longitude=' + LF_HOME.lon +
    '&daily=temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max,precipitation_sum&past_days=1&forecast_days=3&timezone=Asia%2FTokyo';
}
function lfWbgtUrl(pt){ return 'https://www.wbgt.env.go.jp/prev15WG/dl/yohou_' + pt + '.csv'; }
/* 熱中症警戒アラートの発表（5時・17時）。新しいものから読む */
function lfAlertUrls(){
  var td = today(), h = new Date().getHours(), c = [];
  if(h >= 17) c.push([td, 17]);
  if(h >= 5) c.push([td, 5]);
  c.push([shiftDate(td, -1), 17]);
  return c.slice(0, 2).map(function(x){
    return 'https://www.wbgt.env.go.jp/alert/dl/' + x[0].slice(0, 4) + '/alert_' + x[0].replace(/-/g, '') + '_' + pad(x[1]) + '.csv';
  });
}
/* 暑さ指数の予測（3時間ごと・10倍の数字）→ 日ごとのいちばん高い値 */
function lfWbgtParse(text){
  var lines = String(text || '').replace(/^﻿/, '').trim().split(/\r?\n/);
  if(lines.length < 2) return null;
  var head = lines[0].split(','), row = lines[1].split(','), days = {};
  for(var i = 2; i < head.length; i++){
    var t = String(head[i] || '').trim(), v = parseFloat(String(row[i] || '').trim());
    if(!/^\d{10}$/.test(t) || !isFinite(v) || v <= 0) continue;
    if(t.slice(8, 10) === '24') continue;               /* 24時＝次の日の0時（夜なので、その日の最高には入れない） */
    var ymd = t.slice(0, 4) + '-' + t.slice(4, 6) + '-' + t.slice(6, 8), w = Math.round(v) / 10;
    if(!days[ymd] || w > days[ymd]) days[ymd] = w;
  }
  return Object.keys(days).length ? { report:String(row[1] || '').trim(), days:days } : null;
}
/* 熱中症警戒アラートの表から、兵庫県のぶんを読む（0なし・1警戒・2〜3特別警戒・9時間外） */
function lfAlertParse(text){
  var o = { d1:'', d2:'', f1:null, f2:null, report:'' };
  var ymd = function(s){ var m = String(s || '').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/); return m ? m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]) : ''; };
  String(text || '').replace(/^﻿/, '').split(/\r?\n/).forEach(function(l){
    var c = l.split(',');
    if(c[0] === 'TargetDate1') o.d1 = ymd(c[1]);
    else if(c[0] === 'TargetDate2') o.d2 = ymd(c[1]);
    else if(c[0] === 'ReportDate') o.report = ymd(c[1]) + o.report;
    else if(c[0] === 'ReportTime') o.report += ' ' + String(c[1] || '').slice(0, 5);
    else if(c[0] === '兵庫県' || c[4] === '兵庫'){ o.f1 = toNum(c[6]); o.f2 = toNum(c[7]); }
  });
  return (o.f1 == null || !o.d1) ? null : o;
}
async function lfWxLoad(force){
  if(lfWxBusy) return;
  var p = lfPrefs(), now = Date.now(), td = today();
  var season = !!p.wbgt && lfWbgtSeason(td);
  var needOm = !!p.wx && (force || now - (lfWx.omAt || 0) > 2 * 3600000);
  var needWb = season && (force || now - (lfWx.wbgtAt || 0) > 3600000);
  var needAl = season && (force || now - (lfWx.alertAt || 0) > 3600000);
  if(!needOm && !needWb && !needAl) return;
  lfWxBusy = true;
  lfWx.err = lfWx.err || {};
  try{
    if(needOm){
      try{
        var j = await apiJson(lfOmUrl()), d = j && j.daily;
        if(!d || !Array.isArray(d.time)) throw new Error('天気の形がちがいます');
        lfWx.om = { time:d.time, tmax:d.temperature_2m_max || [], tmin:d.temperature_2m_min || [], code:d.weather_code || [],
          wind:d.wind_speed_10m_max || [], rain:d.precipitation_sum || [] };
        lfWx.err.om = '';
      }catch(e){ lfWx.err.om = e.message; }
      lfWx.omAt = now;
    }
    if(needWb){
      var pts = {}, got = 0, er = '';
      for(var i = 0; i < LF_WBGT_PTS.length; i++){
        try{ var w = lfWbgtParse(await apiGet(lfWbgtUrl(LF_WBGT_PTS[i][0]))); if(w){ pts[LF_WBGT_PTS[i][0]] = w; got++; } }
        catch(e){ er = e.message; }
      }
      if(got) lfWx.wbgt = { pts:pts, at:now };
      lfWx.err.wbgt = got ? '' : (er || '読めませんでした');
      lfWx.wbgtAt = now;
    }
    if(needAl){
      var urls = lfAlertUrls(), al = null, er2 = '';
      for(var k = 0; k < urls.length && !al; k++){
        try{ al = lfAlertParse(await apiGet(urls[k])); }catch(e){ er2 = e.message; }
      }
      if(al) lfWx.alert = al;
      lfWx.err.alert = al ? '' : (er2 || '読めませんでした');
      lfWx.alertAt = now;
    }
  }finally{
    lfWxBusy = false;
    try{ localStorage.setItem(LF_WX_KEY, JSON.stringify(lfWx)); }catch(e){}
    if(typeof appId !== 'undefined' && appId === 'today') lfRender();
  }
}
/* 画面を出したときに、古ければ読みなおす（テストでは自動で読まない） */
function lfWxSoon(){
  if(TEST_MODE || lfWxBusy) return;
  var p = lfPrefs(), now = Date.now();
  var stale = (p.wx && now - (lfWx.omAt || 0) > 2 * 3600000) ||
    (p.wbgt && lfWbgtSeason(today()) && (now - (lfWx.wbgtAt || 0) > 3600000 || now - (lfWx.alertAt || 0) > 3600000));
  if(stale) setTimeout(function(){ lfWxLoad(false); }, 0);
}
function lfWbgtWord(v){ return v >= 31 ? '危険' : v >= 28 ? '厳重警戒' : v >= 25 ? '警戒' : v >= 21 ? '注意' : 'ほぼ安全'; }
function lfWbgtFor(ymd){
  if(!lfPrefs().wbgt || !lfWbgtSeason(ymd)) return null;
  var by = [], max = 0, w = lfWx.wbgt, a = lfWx.alert, al = 0;
  if(w && w.pts) LF_WBGT_PTS.forEach(function(pt){
    var x = w.pts[pt[0]], v = x && x.days ? Number(x.days[ymd]) : 0;
    if(v){ by.push({ name:pt[1], v:v }); if(v > max) max = v; }
  });
  if(a){
    if(a.d1 === ymd && a.f1 >= 1 && a.f1 <= 3) al = a.f1;
    if(a.d2 === ymd && a.f2 >= 1 && a.f2 <= 3) al = a.f2;
  }
  if(!by.length && !al) return null;
  return { max:max, by:by, alert:al, word:max ? lfWbgtWord(max) : '' };
}
function lfOmIdx(ymd){ var om = lfWx.om; return (om && Array.isArray(om.time)) ? om.time.indexOf(ymd) : -1; }
function lfTempDiff(ymd){
  var i = lfOmIdx(ymd), om = lfWx.om, p = lfPrefs();
  if(i < 0) return null;
  /* 値がないところは null で来る（Number(null) は 0 になるので、先に null を外す） */
  var nv = function(a, k){ return (a && a[k] != null && a[k] !== '') ? Number(a[k]) : NaN; };
  var mx = nv(om.tmax, i), mn = nv(om.tmin, i);
  if(!isFinite(mx) || !isFinite(mn)) return null;
  var out = { max:mx, min:mn, range:Math.round((mx - mn) * 10) / 10, dPrev:null, what:'' };
  if(i > 0){
    var dMax = Math.round((mx - nv(om.tmax, i - 1)) * 10) / 10, dMin = Math.round((mn - nv(om.tmin, i - 1)) * 10) / 10;
    if(isFinite(dMin) && (!isFinite(dMax) || Math.abs(dMin) > Math.abs(dMax))){ out.dPrev = dMin; out.what = '朝の気温'; }
    else if(isFinite(dMax)){ out.dPrev = dMax; out.what = '最高気温'; }
  }
  out.warnPrev = out.dPrev != null && Math.abs(out.dPrev) >= Number(p.diffPrev || 7);
  out.warnDay = out.range >= Number(p.diffDay || 10);
  return out;
}
/* 花粉の目安：季節（飛ぶ時期）＋天気（晴れ・風・気温・雨の次の日） */
function lfPollen(ymd){
  var p = lfPrefs(), want = String(p.pollen || '').split(','), md = ymd.slice(5);
  var act = LF_POLLEN.filter(function(x){ return want.indexOf(x.id) >= 0 && md >= x.from && md <= x.to; });
  if(!act.length) return null;
  var peak = act.some(function(x){ return md >= x.peak[0] && md <= x.peak[1]; });
  var score = peak ? 2 : 1, why = [], i = lfOmIdx(ymd), om = lfWx.om;
  if(i >= 0){
    var nv = function(a, k){ return (a && a[k] != null && a[k] !== '') ? Number(a[k]) : NaN; };   /* ない値（null）を 0（＝晴れ）にしない */
    var code = nv(om.code, i), wind = nv(om.wind, i), mx = nv(om.tmax, i), rain = nv(om.rain, i);
    if(rain >= 1 || (code >= 51 && code <= 99)){ score -= 2; why.push('雨'); }
    else{
      if(code <= 2){ score++; why.push('晴れ'); }
      if(wind >= 20){ score++; why.push('風が強い'); }
      if(mx >= Math.min.apply(null, act.map(function(x){ return x.warm; }))){ score++; why.push('気温が高い'); }
      if(i > 0 && Number(om.rain[i - 1]) >= 1){ score++; why.push('雨の次の日'); }
    }
  }
  var lv = score >= 4 ? 3 : score >= 2 ? 2 : 1;
  return { names:act.map(function(x){ return x.name; }), level:lv, word:['', '少なめ', 'やや多い', '多そう'][lv], why:why, peak:peak, weather:i >= 0 };
}
/* 今日（明日）のページに小さく出す注意 */
function lfWxRows(ymd, isToday){
  var p = lfPrefs(), rows = [], day = isToday ? '今日' : '明日';
  var wb = lfWbgtFor(ymd);
  if(wb && wb.alert) rows.push(['red', '🚨', '<b>' + (wb.alert >= 2 ? '熱中症特別警戒アラート' : '熱中症警戒アラート') + 'が出ています</b>（兵庫県・' + day + '）。外での運動はひかえて、すずしい所で過ごしてください。']);
  if(wb && wb.max >= 28) rows.push([wb.max >= 31 ? 'red' : 'amber', '🥵', '<b>熱中症に' + (wb.max >= 31 ? '警戒' : '注意') + '</b>：' + day + 'の暑さ指数（WBGT）の予想 ' +
    wb.by.map(function(x){ return esc(x.name) + ' ' + x.v; }).join('・') + '（' + wb.word + '）。水分と塩分をこまめに、日かげで休けいを。']);
  if(p.wx){
    var t = lfTempDiff(ymd), bits = [];
    if(t && t.warnPrev) bits.push('きのうより' + t.what + 'が' + Math.abs(t.dPrev) + '℃' + (t.dPrev < 0 ? '低い' : '高い'));
    if(t && t.warnDay) bits.push('1日の差が' + Math.round(t.range) + '℃（' + Math.round(t.min) + '〜' + Math.round(t.max) + '℃）');
    if(bits.length) rows.push(['amber', '🌡', '<b>寒暖差に注意</b>：' + bits.join('・') + '。' + (t.dPrev != null && t.dPrev < 0 ? '上着を1枚' : '脱ぎ着しやすい服') + 'で。']);
    var pl = lfPollen(ymd);
    if(pl && pl.level >= 2) rows.push([pl.level >= 3 ? 'amber' : 'blue', '🤧', '<b>花粉（' + esc(pl.names.join('・')) + '）：' + pl.word + '</b>' +
      (pl.why.length ? '（' + esc(pl.why.join('・')) + '）' : '') + '。マスクがあると安心です。<span class="lf-s">目安です</span>']);
  }
  return rows;
}
function lfWxHtml(ymd, isToday){
  var p = lfPrefs();
  if(!p.wx && !p.wbgt) return '';
  lfWxSoon();
  var rows = lfWxRows(ymd, isToday), h = rows.map(function(r){ return lfBn(r[0], r[1], r[2]); }).join('');
  if(isToday && p.wbgt && lfWbgtSeason(ymd) && lfWx.err && lfWx.err.wbgt && !lfWx.wbgt)
    h += '<p class="note lf-wxerr">暑さ指数：' + esc(lfWx.err.wbgt) + '</p>';
  return h ? '<div class="lf-wx" id="lf-sec-wx">' + h + '</div>' : '';
}

/* ============================== 今日のページの小さな「からだ」 ============================== */
function lfBodyTodayHtml(){
  var p = lfPrefs(), td = today(), r = lfLog(td), s = lfSleepOf(r), st = lfStepsOf(r), hh = new Date().getHours(), lines = [];
  var sleepLine = s ? '😴 ゆうべ <b>' + lfHm(s) + '</b>' + (r.bed && r.wake ? '（' + esc(r.bed) + '→' + esc(r.wake) + '）' : '')
    : (hh < 12 ? '😴 起きたら「おはよう」で睡眠を記録できます' : '');
  if(st) sleepLine += (sleepLine ? '　' : '') + '👟 ' + lfComma(st) + '歩';
  var h = '<div class="lf-body"><div class="lf-bl1"><span class="grow s2">' + sleepLine + '</span>' + lfSleepBtns() + '</div>';
  var sh = lfShortStreak();
  if(sh >= 3) lines.push(lfBn('amber', '😪', '<b>寝不足の日が' + sh + '日続いています。</b>今日は早めに休みましょう。'));
  if(p.periodToday){
    var ps = lfPeriodStats(), W = lfPWord();
    if(ps){
      if(ps.ongoing) lines.push('<div class="s2 lf-pl1">' + esc(W.name) + ' ' + ps.dayN + '日目</div>');
      else if(ps.late <= 0 && ps.late >= -5) lines.push('<div class="s2 lf-pl1">' + esc(W.pred) + 'まで あと' + (-ps.late) + '日（目安）</div>');
    }
  }
  lfVaxList().forEach(function(x){
    if(!x || !isYmd(x.next)) return;
    var n = daysBetween(td, x.next);
    if(n >= 0 && n <= 14) lines.push('<div class="s2">💉 ' + esc(x.name) + 'の予定 ' + lfMd(x.next) + '（あと' + n + '日）</div>');
  });
  return '<div id="lf-sec-bodytoday">' + h + lines.join('') + '</div></div>';
}

/* ============================== 今日の作戦（#113） ============================== */
/* 予定の入っている時間（move … 移動中。暗記などの「すきま」に使える） */
function lfPlanBlocks(ymd){
  var out = [];
  var push = function(s, e, label, kind){
    if(s == null) return;
    if(e == null || e <= s) e = s + 60;
    out.push({ s:s, e:e, label:label, kind:kind || 'busy' });
  };
  classesForDate(ymd).filter(function(c){ return !c.off; }).forEach(function(c){
    push(minutesOf(S.commute.periods[c.period - 1]), minutesOf(S.commute.ends[c.period - 1]), c.period + '限 ' + shortName(c.name), 'class');
  });
  var sc = schoolClassesForDate(ymd);
  if(sc.length && typeof commuteTotal === 'function'){
    var first = minutesOf(S.commute.periods[sc[0].period - 1]), last = minutesOf(S.commute.ends[sc[sc.length - 1].period - 1]), tot = commuteTotal();
    if(first != null && tot > 0) push(first - tot, first, '通学（行き）', 'move');
    if(last != null && tot > 0) push(last, last + tot, '通学（帰り）', 'move');
  }
  (S.shifts || []).forEach(function(w){
    if(w.date !== ymd) return;
    var a = minutesOf(w.start), b = minutesOf(w.end);
    if(a == null) return;
    if(b == null) b = a + 240; else if(b <= a) b += 1440;
    push(a - 30, a, 'バイトへ移動', 'move');
    push(a, b, 'バイト', 'work');
  });
  (S.events || []).forEach(function(e){
    var st = minutesOf(e.time);
    if(e.date !== ymd || st == null) return;
    var m = String(e.memo || '').match(/^〜(\d{1,2}:\d{2})/);
    push(st, m ? minutesOf(m[1]) : st + 60, e.title || '予定', 'busy');
  });
  (S.exams || []).forEach(function(x){
    var st = minutesOf(x.time);
    if(x.date === ymd && st != null) push(st, st + 60, 'テスト ' + (x.subject ? shortName(x.subject) : ''), 'busy');
  });
  return out.sort(function(a, b){ return a.s - b.s; });
}
function lfPlanSlots(blocks, from, to){
  var slots = [], cur = from;
  blocks.forEach(function(b){
    if(b.e <= cur || b.s >= to) return;
    if(b.s > cur) slots.push({ s:cur, e:Math.min(b.s, to), kind:'free' });
    cur = Math.max(cur, b.e);
  });
  if(cur < to) slots.push({ s:cur, e:to, kind:'free' });
  slots = slots.filter(function(g){ return g.e - g.s >= 15; });
  blocks.forEach(function(b){
    if(b.kind !== 'move') return;
    var s = Math.max(b.s, from), e = Math.min(b.e, to);
    if(e - s >= 10) slots.push({ s:s, e:e, kind:'move', label:b.label });
  });
  return slots.sort(function(a, b){ return a.s - b.s || (a.kind === 'move' ? -1 : 1); });
}
function lfPlanTodo(ymd){
  var list = [];
  (S.exams || []).forEach(function(x){
    if(!isYmd(x.date)) return;
    var n = daysBetween(ymd, x.date);
    if(n < 0 || n > 14) return;
    list.push({ key:'ex' + x.id, kind:'exam', days:n, min:45, rank:n <= 3 ? n : 10 + n,
      what:'テスト勉強：' + (x.subject ? shortName(x.subject) : 'テスト') + (x.title ? ' ' + x.title : ''),
      why:n === 0 ? 'テストは今日' : n === 1 ? 'テストは明日' : 'テストまであと' + n + '日' });
  });
  (S.tasks || []).forEach(function(t){
    if(t.done || !isYmd(t.due)) return;
    var n = daysBetween(ymd, t.due);
    if(n > 7) return;
    list.push({ key:'tk' + t.id, kind:'task', days:n, min:60, rank:n < 0 ? -1 : n <= 1 ? n : 4 + n,
      what:'課題：' + (t.title || '課題'), why:n < 0 ? '期限切れ' : n === 0 ? '今日が締切' : n === 1 ? '明日が締切' : '締切まであと' + n + '日' });
  });
  list.sort(function(a, b){ return a.rank - b.rank; });
  var anki = (typeof ankiDueList === 'function') ? ankiDueList('', ymd).length : 0;
  return { list:list, anki:anki };
}
/* きまりで作る作戦：短いすきま・移動中は暗記、長いすきまは締切の近い課題・テスト勉強から */
function lfPlanFor(ymd, nowMin){
  var p = lfPrefs(), isToday = ymd === today();
  var end = minutesOf(p.planEnd); if(end == null) end = 23 * 60;
  var from = 7 * 60;
  if(isToday){ var nm = (nowMin == null) ? lfNowMin() : nowMin; from = Math.max(from, Math.ceil(nm / 5) * 5); }
  var blocks = lfPlanBlocks(ymd), slots = from < end ? lfPlanSlots(blocks, from, end) : [];
  var todo = lfPlanTodo(ymd), used = {}, anki = todo.anki, picks = [];
  var soonExam = todo.list.filter(function(x){ return x.kind === 'exam' && x.days <= 3; })[0];
  var nextTodo = function(){ for(var i = 0; i < todo.list.length; i++){ if(!used[todo.list[i].key]) return todo.list[i]; } return null; };
  var ankiTake = function(len){ var n = Math.min(anki, Math.max(5, len * 2)); anki -= n; return '暗記の復習 ' + n + '枚'; };
  slots.forEach(function(g){
    if(picks.length >= 10) return;
    var len = g.e - g.s, what = '', why = '';
    if(g.kind === 'move'){
      if(anki > 0){ what = ankiTake(len); why = g.label + 'の間に'; }
      else if(soonExam){ what = soonExam.what.replace(/^テスト勉強：/, '') + 'のノートを見返す'; why = g.label + 'の間に'; }
    }else if(len < 30){
      if(anki > 0){ what = ankiTake(len); why = '短いすきまに'; }
      else if(soonExam){ what = 'テスト範囲をさっと見直す'; why = soonExam.why; }
    }else{
      var t = nextTodo();
      if(t){ used[t.key] = 1; what = t.what; why = t.why; }
      else if(anki > 0){ what = ankiTake(len); why = '復習の日'; }
    }
    if(what) picks.push({ s:g.s, e:g.e, min:len, kind:g.kind, what:what, why:why });
  });
  var notes = [];
  if(isToday && typeof umbrellaInfo === 'function'){ var u = umbrellaInfo(); if(u && u.need) notes.push('☔ 雨の予報：移動の時間に余裕を'); }
  var wb = lfWbgtFor(ymd);
  if(wb && wb.max >= 28) notes.push('🥵 暑さ指数 ' + wb.max + '：外を歩く時間は短めに・水分を');
  if(isToday && lfShortStreak() >= 2) notes.push('😪 寝不足ぎみ：夜は早めに切り上げよう');
  return { ymd:ymd, isToday:isToday, from:from, end:end, blocks:blocks, slots:slots, picks:picks,
    left:todo.list.filter(function(x){ return !used[x.key]; }), anki:todo.anki, ankiLeft:anki, notes:notes };
}
function lfPlanHtml(ymd){
  var pl = lfPlanFor(ymd), isToday = pl.isToday, more = lfUi.planMore;
  var h = pl.picks.slice(0, more ? 10 : 4).map(function(x){
    return '<div class="lf-pl' + (x.kind === 'move' ? ' mv' : '') + '"><span class="lf-plt num">' + hhmmOf(x.s) + '〜' + hhmmOf(x.e) + '</span>' +
      '<span class="grow"><span class="t">' + esc(x.what) + '</span><span class="s">' + x.min + '分' + (x.why ? '・' + esc(x.why) : '') + '</span></span></div>';
  }).join('');
  if(!h) h = '<div class="empty lf-empty">' + (isToday && pl.from >= pl.end ? '今日はもう休みましょう。おつかれさま。' : 'すきま時間に入れることはありません。ゆっくり休んでね。') + '</div>';
  if(pl.picks.length > 4) h += '<button class="mini" data-act="lf-plan-more">' + (more ? 'たたむ' : 'ほか' + (pl.picks.length - 4) + '件') + '</button>';
  if(pl.left.length) h += '<p class="note">まだ入れていない：' + pl.left.slice(0, 3).map(function(x){ return esc(x.what); }).join('、') + (pl.left.length > 3 ? ' ほか' : '') + '</p>';
  if(pl.notes.length) h += '<div class="lf-notes">' + pl.notes.map(function(n){ return '<div class="s2">' + esc(n) + '</div>'; }).join('') + '</div>';
  var ai = (S.kmData || {})['life:plan'];
  if(ai && ai.date === ymd && ai.text) h += '<div class="lf-ai"><div class="s2">🤖 AIの作戦</div>' + esc(ai.text).replace(/\n/g, '<br>') + '</div>';
  h += '<div class="pillrow" style="margin:8px 0 0"><button class="mini" data-act="lf-plan-ai" data-d="' + ymd + '"' + (lfUi.planBusy ? ' disabled' : '') + '>' +
    (lfUi.planBusy ? '考えています…' : '🤖 AIにくわしく考えてもらう') + '</button></div>';
  return '<div id="lf-sec-plan">' + secWrap('lfPlan', (isToday ? '今日' : '明日') + 'の作戦', pl.slots.length ? 'すきま時間 ' + pl.slots.length + 'つ' : null, h) + '</div>';
}
async function lfPlanAi(ymd){
  if(!lfAiNeed() || lfUi.planBusy) return;
  ymd = isYmd(ymd) ? ymd : today();
  lfUi.planBusy = true; lfRender();
  try{
    var pl = lfPlanFor(ymd), hm = function(m){ return hhmmOf(m); };
    var ctx = { date:ymd, weekday:lfWd(ymd), now:pl.isToday ? hm(lfNowMin()) : '', dayEnd:hm(pl.end),
      schedule:pl.blocks.map(function(b){ return { from:hm(b.s), to:hm(b.e), what:b.label }; }),
      gaps:pl.slots.map(function(g){ return { from:hm(g.s), to:hm(g.e), minutes:g.e - g.s, moving:g.kind === 'move' }; }),
      todo:lfPlanTodo(ymd).list.slice(0, 10).map(function(x){ return { what:x.what, when:x.why }; }),
      ankiDue:pl.anki, weather:lfWxRows(ymd, pl.isToday).map(function(r){ return String(r[2]).replace(/<[^>]+>/g, ''); }),
      sleepLastNight:lfHm(lfSleepOf(lfLog(today()))), rulePlan:pl.picks.map(function(x){ return hm(x.s) + '〜' + hm(x.e) + ' ' + x.what; }) };
    var text = await aiGenerate({ tag:'lf-plan', temperature:0.5, maxTokens:900,
      system:'あなたは看護学部1年生を応援する、やさしい先輩です。' + (typeof toneRule === 'function' ? toneRule() : ''),
      contents:[{ role:'user', parts:[{ text:'今日の予定と、すきま時間・やることです。\n' + JSON.stringify(ctx) +
        '\n\nすきま時間に何をするかの「作戦」を、時刻つきの箇条書きで8行以内にまとめてください。' +
        '締切やテストが近いものを先に。移動中や短いすきまは暗記など軽いものに。休けい・ごはん・睡眠も大事にして、無理な計画にしないでください。' }] }] });
    text = String(text || '').trim();
    if(!text) throw new Error('答えが空でした');
    S.kmData = (S.kmData && typeof S.kmData === 'object') ? S.kmData : {};
    S.kmData['life:plan'] = { date:ymd, text:text.slice(0, 1500), mt:Date.now() };
    touch('kmData');
    toast('作戦を考えました');
  }catch(e){
    toast('考えられませんでした：' + e.message, true);
    logErr('今日の作戦', e.message);
  }finally{
    lfUi.planBusy = false;
    commit();
  }
}

/* ============================== 声・写真で登録（#114 #115） ============================== */
var LF_TYPE = { event:['予定', '📅'], task:['課題', '✎'], exam:['テスト', '📖'], shift:['バイト', '💼'], spend:['お金', '¥'], change:['授業の変更', '🔁'], memo:['メモ', '📝'] };
var LF_SNAP_KINDS = { print:'プリント（予定・お知らせ）', task:'課題のお知らせ', exam:'テストのお知らせ', receipt:'レシート', shift:'シフト表',
  timetable:'時間割の変更', card:'名刺', medicine:'薬の袋', other:'そのほか' };
function lfCourseNames(){ try{ return termCourses().map(function(c){ return c.name; }).join('、'); }catch(e){ return ''; } }
function lfSortPrompt(text){
  var td = today();
  return 'つぎの文は、手帳に登録したいことを話したものです。予定・課題・テスト・バイト・使ったお金に分けて、JSONだけを返してください。\n' +
    '{"items":[{"type":"event|task|exam|shift|spend","title":"名前","date":"YYYY-MM-DD","time":"HH:MM（なければ空）","end":"HH:MM（なければ空）",' +
    '"subject":"科目名（わかれば）","kind":"quiz|exam|kousa（テストのとき）","amount":円（お金のとき）,' +
    '"category":"food|daily|move|study|wear|fun|friend|health|phone|other（お金のとき）","important":true または false}]}\n' +
    '・今日は ' + td + '（' + lfWd(td) + '曜日）。「あした」「来週の金曜」などは日付に直す。\n' +
    '・課題の date は締切の日。バイトは time が始まり、end が終わり。お金の date は使った日（今日なら今日）。\n' +
    '・科目名は次の中から近いものを選ぶ：' + lfCourseNames() + '\n' +
    '・話していないものは作らない。わからない項目は空にする。\n【文】\n' + text;
}
function lfSnapPrompt(){
  return 'この写真が何かを見分けて、手帳に登録できるものを取り出してください。JSONだけを返してください。\n' +
    '{"kind":"print|task|exam|receipt|shift|timetable|card|medicine|other","summary":"何の写真か1文で",' +
    '"items":[{"type":"event|task|exam|spend|change|memo","title":"名前","date":"YYYY-MM-DD","time":"HH:MM","end":"HH:MM","subject":"科目名",' +
    '"kind":"quiz|exam|kousa","amount":円,"category":"food|daily|move|study|wear|fun|friend|health|phone|other",' +
    '"change":"cancel|online|makeup","period":限（数字）,"room":"教室","body":"メモの本文"}]}\n' +
    '・kind：学校のプリント＝print、課題・レポートの説明＝task、テスト・小テストのお知らせ＝exam、レシート・領収書＝receipt、' +
    'バイトのシフト表＝shift、休講・補講・遠隔など時間割の変更＝timetable、名刺＝card、薬の袋・薬の説明書＝medicine\n' +
    '・レシートは type:"spend" を1つ（合計金額・お店の名前・日付・分類）。\n' +
    '・時間割の変更は type:"change"（休講＝cancel、遠隔＝online、補講＝makeup）。\n' +
    '・名刺は type:"memo"（title は「名刺：名前」、body に会社・電話・メールなど）。\n' +
    '・薬の袋は type:"memo"（title は「おくすり：薬の名前」、body に飲み方・回数・日数・注意）。\n' +
    '・シフト表は items を空にしてよい（別の読み取りにまわします）。\n' +
    '・今日は ' + today() + '。年が書いていない日付は、今日に近い年にする。科目名は次から近いもの：' + lfCourseNames() + '\n' +
    '・書いていないことは作らない。患者さんの個人情報が写っていても、書き出さない。';
}
/* AIの答えを、登録の候補にそろえる */
function lfCands(items){
  /* 1つだけのときに、配列にしないで返すAIもある */
  if(!Array.isArray(items)) items = (items && typeof items === 'object' && items.type) ? [items] : [];
  return items.map(function(x){
    x = x || {};
    var type = LF_TYPE[x.type] ? x.type : 'event';
    var c = { type:type, title:String(x.title || '').slice(0, 80), date:lfFixDate(x.date), time:lfHhmm(x.time), end:lfHhmm(x.end),
      subject:String(x.subject || '').slice(0, 60), kind:['quiz', 'exam', 'kousa'].indexOf(x.kind) >= 0 ? x.kind : '',
      amount:Math.abs(Math.round(lfNum(x.amount))), category:String(x.category || ''), important:!!x.important,
      change:['cancel', 'online', 'makeup'].indexOf(x.change) >= 0 ? x.change : 'cancel', period:toNum(x.period), room:String(x.room || '').slice(0, 30),
      body:String(x.body || '').slice(0, 1500), pick:1 };
    if(type === 'spend' && !c.date) c.date = today();
    return c;
  }).filter(function(c){
    if(c.type === 'spend') return c.amount > 0;
    if(c.type === 'memo') return !!(c.title || c.body);
    if(c.type === 'change') return isYmd(c.date);
    if(c.type === 'shift') return isYmd(c.date) && !!c.time;
    return !!(c.title || c.subject) && isYmd(c.date);
  }).slice(0, 12);
}
function lfCandsRead(list, pre){
  (list || []).forEach(function(c, i){
    var pk = document.querySelector('.lf-pick[data-p="' + pre + '"][data-i="' + i + '"]');
    if(pk) c.pick = pk.checked ? 1 : 0;
    ['title', 'date', 'time', 'end', 'amount'].forEach(function(f){
      var el = document.querySelector('.lf-ce[data-p="' + pre + '"][data-i="' + i + '"][data-f="' + f + '"]');
      if(!el) return;
      c[f] = f === 'amount' ? Math.abs(Math.round(lfNum(el.value))) : (f === 'time' || f === 'end') ? lfHhmm(el.value) : el.value;
    });
  });
}
function lfCandsHtml(list, pre){
  return '<div class="lf-cands">' + list.map(function(c, i){
    var t = LF_TYPE[c.type] || ['', ''];
    var ce = function(f, v, type, ph, cls){
      return '<input class="lf-ce' + (cls ? ' ' + cls : '') + '" data-p="' + pre + '" data-i="' + i + '" data-f="' + f + '"' + (type ? ' type="' + type + '"' : '') +
        ' value="' + esc(v == null ? '' : v) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + ' aria-label="' + esc(ph || f) + '">';
    };
    var sub = c.type === 'change' ? ({ cancel:'休講', online:'遠隔', makeup:'補講' })[c.change] + (c.subject ? '・' + esc(c.subject) : '') + (c.period ? '・' + c.period + '限' : '')
      : c.type === 'memo' ? esc(String(c.body || '').slice(0, 80))
      : c.type === 'shift' ? esc((c.time || '') + '〜' + (c.end || ''))
      : c.type === 'exam' || c.type === 'task' ? esc(c.subject || '') : '';
    return '<div class="lf-cand"><label class="lf-cl"><input type="checkbox" class="lf-pick" data-p="' + pre + '" data-i="' + i + '"' + (c.pick ? ' checked' : '') + '>' +
      '<span class="lf-ct">' + t[1] + ' ' + t[0] + '</span>' + (sub ? '<span class="s2">' + sub + '</span>' : '') + '</label>' +
      '<div class="lf-cf">' + (c.type === 'spend'
        ? ce('amount', c.amount, '', '金額', 'w1') + ce('title', c.title, '', 'お店・内容') + ce('date', c.date, 'date', '日付')
        : c.type === 'memo' ? ce('title', c.title, '', '題名')
        : (c.type !== 'change' && c.type !== 'shift' ? ce('title', c.title, '', '名前') : '') + ce('date', c.date, 'date', '日付') +
          (c.type !== 'change' ? ce('time', c.time, 'time', c.type === 'shift' ? '始まり' : '時刻', 'w1') : '') +
          (c.type === 'shift' ? ce('end', c.end, 'time', '終わり', 'w1') : '')) + '</div></div>';
  }).join('') + '</div>';
}
function lfAddSpend(c){
  if(typeof kbAdd !== 'function') return { result:'家計簿が使えません' };
  var it = kbAdd({ amount:c.amount, title:c.title || '', date:isYmd(c.date) ? c.date : today(),
    cat:(typeof KB_CATS !== 'undefined' && KB_CATS.some(function(k){ return k[0] === c.category; })) ? c.category : undefined, src:'hand', memo:c.memo || '' });
  if(!it) return { result:'同じ記録がもう入っています' };
  return { result:'家計簿に記録しました', op:{ t:'add', list:'spends', id:it.id, label:'家計簿 ' + yen(it.amount) + (it.title ? '（' + it.title + '）' : '') } };
}
function lfAddChange(c){
  if(!isYmd(c.date)) return { result:'日付がありません' };
  var course = c.subject ? subjectMatch(c.subject) : '*';
  if(c.change === 'makeup' && course === '*') return { result:'補講は科目が必要です' };
  var id = uid('hx');
  S.holidays.push({ id:id, date:c.date, course:course || '*', type:c.change, period:c.change === 'makeup' ? toNum(c.period) : 0, room:String(c.room || ''), mt:Date.now() });
  return { result:'登録しました', op:{ t:'add', list:'holidays', id:id,
    label:({ cancel:'休講', online:'遠隔', makeup:'補講' })[c.change] + '「' + (course === '*' ? 'ぜんぶ' : course) + '」（' + ymdLabel(c.date) + '）' } };
}
/* 候補1つを登録する（予定・課題・テスト・バイト・メモは「AIの直接登録」と同じ関数で入れる） */
function lfCandRun(c){
  switch(c.type){
    case 'event': return aiRunFunc({ name:'add_event', args:{ title:c.title || c.subject, date:c.date, time:c.time, end:c.end, important:c.important, memo:c.memo || '' } });
    case 'task':  return aiRunFunc({ name:'add_task', args:{ title:c.title || c.subject, due:c.date, time:c.time, subject:c.subject, memo:c.memo || '' } });
    case 'exam':  return aiRunFunc({ name:'add_exam', args:{ subject:c.subject || c.title, date:c.date, time:c.time, kind:c.kind || 'exam', title:c.subject ? c.title : '', room:c.room } });
    case 'shift': return aiRunFunc({ name:'add_shift', args:{ date:c.date, start:c.time, end:c.end, memo:c.memo || '' } });
    case 'memo':  return aiRunFunc({ name:'add_memo', args:{ title:c.title, body:c.body || c.title } });
    case 'spend': return lfAddSpend(c);
    case 'change': return lfAddChange(c);
  }
  return { result:'この種類は入れられません' };
}
function lfAttachPhoto(op, pid){
  if(!op || !pid || ['events', 'tasks', 'exams', 'shifts', 'notes'].indexOf(op.list) < 0) return;
  var it = (S[op.list] || []).filter(function(x){ return x.id === op.id; })[0];
  if(it){ it.photos = (it.photos || []).concat([pid]); it.mt = Date.now(); }
}
function lfCandsApply(list, pid){
  var ops = [], bad = [];
  (list || []).forEach(function(c){
    if(!c.pick) return;
    var r = lfCandRun(c) || {};
    if(r.op){ ops.push(r.op); if(pid) lfAttachPhoto(r.op, pid); }
    else bad.push((c.title || LF_TYPE[c.type][0]) + '：' + (r.result || '入れられませんでした'));
  });
  return { ops:ops, bad:bad };
}
function lfOpsHtml(o, undoAct){
  if(!o) return '';
  return '<div class="aiops lf-ops"><div class="s2">手帳に入れました</div>' + o.ops.map(function(x){ return '<div class="aiop">✓ ' + esc(x.label) + '</div>'; }).join('') +
    o.bad.map(function(b){ return '<div class="s2" style="color:var(--rakuten)">✗ ' + esc(b) + '</div>'; }).join('') +
    (o.ops.length ? (o.undone ? '<div class="s2">取り消しました</div>' : '<button class="mini" data-act="' + undoAct + '">取り消す</button>') : '') + '</div>';
}
/* ----- 声 ----- */
function lfSR(){ return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
function lfVoiceStart(){
  lfVoiceStop();                           /* 前の聞き取りが続いていたら止める（2つ同時に動かさない） */
  lfUi.snap = null;
  var v = lfUi.voice = { on:true, listening:false, text:'', err:'', cands:null, busy:false, res:null, manual:0 };
  var SR = lfSR();
  if(!SR || TEST_MODE){ v.manual = 1; lfRender(); setTimeout(function(){ var el = document.getElementById('lf_vtext'); if(el) el.focus(); }, 50); return; }
  try{
    var rec = new SR();
    rec.lang = 'ja-JP'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onresult = function(e){
      /* 毎回はじめから組み立てる（iPhoneのSafariは、同じ結果をもう一度送ってくることがあり、足していくと二重になる） */
      var fin = '', mid = '';
      for(var i = 0; i < e.results.length; i++){
        if(e.results[i].isFinal) fin += e.results[i][0].transcript; else mid += e.results[i][0].transcript;
      }
      v.text = fin + mid;
      var el = document.getElementById('lf_vtext'); if(el) el.value = v.text;
    };
    rec.onerror = function(e){
      var denied = e.error === 'not-allowed' || e.error === 'service-not-allowed';
      v.err = denied ? 'マイクが使えません。端末の設定でマイクを許可するか、キーボードのマイク（🎤）で話して入れてください。'
        : e.error === 'no-speech' ? '声が聞こえませんでした。もう一度どうぞ。' : e.error === 'aborted' ? '' : '聞き取れませんでした（' + e.error + '）';
      if(denied) v.denied = 1;             /* ホーム画面のアプリ（iPhone）では、ここで使えないことがある → もう一度話すは出さない */
      v.manual = 1;
    };
    rec.onend = function(){
      v.listening = false; v.rec = null;
      var tx = String(v.text || '').trim();
      lfRender();
      if(tx && lfUi.voice === v) lfVoiceParse(tx);
    };
    v.rec = rec; v.listening = true;
    rec.start();
  }catch(e){ v.manual = 1; v.listening = false; v.err = '声の聞き取りを始められませんでした。キーボードのマイク（🎤）で話して入れてください。'; }
  lfRender();
}
function lfVoiceStop(){ var v = lfUi.voice; if(v && v.rec){ try{ v.rec.stop(); }catch(e){} } }
async function lfVoiceParse(text){
  var v = lfUi.voice;
  if(!v) return;
  text = String(text || '').trim();
  if(!text){ toast('話した文（入れる文）がありません', true); return; }
  if(!lfAiNeed()) return;
  if(/患者|受け持ち|カルテ/.test(text)){ toast('患者さんに関わることは、AIに送らないでください', true); return; }
  v.text = text; v.busy = true; v.err = ''; v.cands = null; v.res = null;
  lfRender();
  try{
    var r = await aiJson(lfSortPrompt(text), [], 'lf-voice');
    v.cands = lfCands(r && (r.items || r));
    if(!v.cands.length) v.err = '登録するものが見つかりませんでした。日付や時刻を入れて、もう一度どうぞ。';
  }catch(e){
    v.err = 'AIで分けられませんでした：' + e.message;
  }finally{
    v.busy = false;
    lfRender();
  }
}
function lfVoiceAdd(){
  var v = lfUi.voice;
  if(!v || !v.cands) return null;
  lfCandsRead(v.cands, 'v');
  if(!v.cands.some(function(c){ return c.pick; })){ toast('登録するものにチェックを入れてください', true); return null; }
  var res = lfCandsApply(v.cands, '');
  v.res = res; v.cands = null;
  toast(res.ops.length ? res.ops.length + '件 登録しました' : '登録できませんでした', !res.ops.length);
  commit();
  return res;
}
function lfVoiceHtml(){
  var v = lfUi.voice, SR = lfSR();
  var h = '<div class="lf-panel" id="lf-voice"><div class="lf-ph"><b>🎤 声で登録</b><button class="mini" data-act="lf-v-close">とじる</button></div>';
  if(v.listening) h += '<div class="lf-listen"><span class="lf-dot"></span>聞いています… 話してください <button class="mini" data-act="lf-v-stop">話し終わった</button></div>';
  if(v.manual && (!SR || TEST_MODE)) h += '<p class="note" style="margin-top:0">この端末では、ここで声を聞き取れません。<b>キーボードのマイク（🎤）</b>を押して話して入れてください。</p>';
  h += '<textarea id="lf_vtext" rows="2" placeholder="例：あした10時に歯医者、金曜までに看護過程のレポート、コンビニで580円">' + esc(v.text || '') + '</textarea>' +
    '<div class="lf-vbtns"><button class="btn lf-mb" data-act="lf-v-parse"' + (v.busy ? ' disabled' : '') + '>' + (v.busy ? 'AIが分けています…' : 'AIで分ける') + '</button>' +
    (SR && !TEST_MODE && !v.listening && !v.denied ? '<button class="mini" data-act="lf-v-again">🎤 もう一度話す</button>' : '') + '</div>';
  if(v.err) h += '<p class="note" style="color:var(--rakuten)">' + esc(v.err) + '</p>';
  if(v.cands && v.cands.length){
    h += '<label class="f">登録する前に確かめてください（直せます）</label>' + lfCandsHtml(v.cands, 'v') +
      '<button class="btn" style="margin-top:8px" data-act="lf-v-add">チェックしたものを登録</button>';
  }
  h += lfOpsHtml(v.res, 'lf-v-undo');
  return h + '<p class="note">話した文はGoogleのAIに送られます。患者さんのことは話さないでください。</p></div>';
}
/* ----- 写真 ----- */
async function lfSnapRun(file){
  if(!lfAiNeed()) return;
  lfUi.voice = null;
  lfUi.snap = { busy:true, img:'', kind:'', summary:'', cands:null, err:'', res:null, keep:1 };
  lfRender();
  try{
    var data = await resizeImage(file, 1800, 0.82);
    await lfSnapRead(data, file);
  }catch(e){
    if(lfUi.snap){ lfUi.snap.busy = false; lfUi.snap.err = '写真を読めませんでした：' + e.message; }
    lfRender();
  }
}
async function lfSnapRead(data, file){
  var sn = lfUi.snap;
  if(!sn) sn = lfUi.snap = { busy:true, img:data, kind:'', summary:'', cands:null, err:'', res:null, keep:1 };
  sn.img = data; sn.busy = true; sn.cands = null; sn.res = null; sn.err = ''; sn.kind = ''; sn.summary = '';
  lfRender();
  try{
    var r = await aiJson(lfSnapPrompt(), [data], 'lf-snap');
    r = r || {};
    sn.kind = LF_SNAP_KINDS[r.kind] ? r.kind : 'other';
    sn.summary = String(r.summary || '').slice(0, 200);
    /* シフト表は、前からある「シフト表の写真から登録」にまわす（名前で自分の行を読む） */
    if(sn.kind === 'shift' && typeof shiftOcrRun === 'function'){
      lfUi.snap = null;
      appId = 'money'; payTab = 'work';
      toast('シフト表でした。シフトの読み取りにまわします');
      lfRender();                          /* シフトの読み取りが先で止まったとき（名前が未設定など）も、バイトの画面を出す */
      await shiftOcrRun(file || await lfDataToFile(data));
      return;
    }
    sn.cands = lfCands(Array.isArray(r) ? r : r.items);
    if(sn.kind === 'receipt' && !sn.cands.length) sn.err = '金額を読み取れませんでした。';
  }catch(e){
    sn.err = '読み取れませんでした：' + e.message;
    logErr('撮って登録', e.message);
  }finally{
    if(lfUi.snap === sn){ sn.busy = false; lfRender(); }
  }
}
async function lfSnapAdd(){
  var sn = lfUi.snap;
  if(!sn || !sn.cands) return null;
  lfCandsRead(sn.cands, 's');
  if(!sn.cands.some(function(c){ return c.pick; })){ toast('登録するものにチェックを入れてください', true); return null; }
  var keep = document.getElementById('lf_skeep');
  if(keep) sn.keep = keep.checked ? 1 : 0;
  var cands = sn.cands;
  sn.cands = null;                         /* 写真を保存している間に、もう一度押されても二重に入れない */
  var pid = '';
  /* 写真をつけられる候補（予定・課題・テスト・バイト・メモ）があるときだけ保存する（レシートだけのときは、つけ先がない） */
  var canPhoto = cands.some(function(c){ return c.pick && ['event', 'task', 'exam', 'shift', 'memo'].indexOf(c.type) >= 0; });
  if(sn.keep && sn.img && canPhoto){ try{ pid = uid('mi'); await photoPut(pid, sn.img); }catch(e){ pid = ''; } }
  var res = lfCandsApply(cands, pid);
  sn.res = res;
  toast(res.ops.length ? res.ops.length + '件 登録しました' : '登録できませんでした', !res.ops.length);
  commit();
  return res;
}
function lfSnapHtml(){
  var sn = lfUi.snap;
  var h = '<div class="lf-panel" id="lf-snap"><div class="lf-ph"><b>📷 撮って登録</b><button class="mini" data-act="lf-s-close">とじる</button></div>';
  if(sn.img) h += '<img class="lf-simg" src="' + sn.img + '" alt="えらんだ写真">';
  if(sn.busy) h += '<div class="s2">AIが読んでいます…</div>';
  if(sn.kind) h += '<div class="s2 lf-kind"><b>' + esc(LF_SNAP_KINDS[sn.kind] || '') + '</b>' + (sn.summary ? '：' + esc(sn.summary) : '') + '</div>';
  if(sn.err) h += '<p class="note" style="color:var(--rakuten)">' + esc(sn.err) + '</p>';
  if(sn.cands){
    if(sn.cands.length){
      h += '<label class="f">登録する前に確かめてください（直せます）</label>' + lfCandsHtml(sn.cands, 's') +
        '<label class="lf-cl" style="margin-top:6px"><input type="checkbox" id="lf_skeep"' + (sn.keep ? ' checked' : '') + '> 写真もいっしょに保存する（予定・課題・メモにつけます）</label>' +
        '<button class="btn" style="margin-top:8px" data-act="lf-s-add">チェックしたものを登録</button>';
    }else if(!sn.busy && !sn.err) h += '<div class="empty lf-empty">登録できるものは見つかりませんでした。</div>';
  }
  if(sn.kind === 'medicine') h += '<p class="note">薬の飲み方は目安です。袋の説明・薬剤師さんの話を優先してください。</p>';
  h += lfOpsHtml(sn.res, 'lf-s-undo');
  if(!sn.busy) h += '<button class="mini" style="margin-top:8px" data-act="lf-snap">別の写真</button>';
  return h + '<p class="note">写真はGoogleのAIに送られます。患者さんの情報が写った写真は送らないでください。</p></div>';
}
function lfQuickHtml(){
  var h = '<div class="lf-quick"><button class="lf-qb" data-act="lf-voice"><span aria-hidden="true">🎤</span>声で登録</button>' +
    '<button class="lf-qb" data-act="lf-snap"><span aria-hidden="true">📷</span>撮って登録</button></div>';
  if(lfUi.voice) h += lfVoiceHtml();
  if(lfUi.snap) h += lfSnapHtml();
  return '<div id="lf-sec-quick" class="lf-quickwrap">' + h + '</div>';
}

/* ============================== 1週間の生活の分析（#119） ============================== */
var lfWeekStats0 = (typeof weekStats === 'function') ? weekStats : null;
var lfWeekTpl0 = (typeof weekReviewTemplate === 'function') ? weekReviewTemplate : null;
function lfWeekData(mon){
  var days = [], i;
  for(i = 0; i < 7; i++) days.push(shiftDate(mon, i));
  var sun = days[6];
  var rows = days.map(function(d){
    var r = lfLog(d);
    var sp = (S.spends || []).filter(function(x){ return x.date === d && x.io !== 'in'; });
    var wk = (S.shifts || []).filter(function(w){ return w.date === d; });
    return { date:d, sleep:lfSleepOf(r), steps:lfStepsOf(r), cards:(typeof ankiCountOn === 'function') ? ankiCountOn(d) : 0,
      spend:sumBy(sp, function(x){ return Math.abs(Number(x.amount) || 0); }), work:sumBy(wk, function(w){ return typeof shiftHours === 'function' ? shiftHours(w) : 0; }) };
  });
  var cat = {};
  (S.spends || []).forEach(function(x){
    if(x.io === 'in' || !isYmd(x.date) || x.date < mon || x.date > sun) return;
    cat[x.cat || 'other'] = (cat[x.cat || 'other'] || 0) + Math.abs(Number(x.amount) || 0);
  });
  var st = null;
  try{ st = lfWeekStats0 ? lfWeekStats0(mon) : null; }catch(e){}
  var avg = function(a){ a = a.filter(function(x){ return x > 0; }); return a.length ? Math.round(sumBy(a, function(x){ return x; }) / a.length) : 0; };
  return { mon:mon, sun:sun, rows:rows,
    sleepAvg:avg(rows.map(function(r){ return r.sleep; })), sleepDays:rows.filter(function(r){ return r.sleep; }).length,
    stepsAvg:avg(rows.map(function(r){ return r.steps; })), stepDays:rows.filter(function(r){ return r.steps; }).length,
    cards:sumBy(rows, function(r){ return r.cards; }), studyDays:rows.filter(function(r){ return r.cards > 0; }).length,
    spend:sumBy(rows, function(r){ return r.spend; }), cat:cat,
    workH:Math.round(sumBy(rows, function(r){ return r.work; }) * 10) / 10, workN:st ? st.shiftN : 0, pay:st ? st.pay : 0,
    att:st ? st.att : null, dueN:st ? st.dueN : 0, doneN:st ? st.doneN : 0, late:st ? st.lateTasks : [] };
}
/* AIの「週のふりかえり」に足す、短い数字 */
function lfWeekBrief(mon){
  var w = lfWeekData(mon), o = {}, L = [];
  if(w.sleepDays){ o.sleepAvg = lfHm(w.sleepAvg) + '（' + w.sleepDays + '日の記録）'; L.push('睡眠の平均 ' + lfHm(w.sleepAvg)); }
  if(w.stepDays){ o.stepsAvg = lfComma(w.stepsAvg) + '歩（' + w.stepDays + '日の記録）'; L.push('歩数の平均 ' + lfComma(w.stepsAvg) + '歩'); }
  if(w.cards){ o.cards = w.cards + '枚（' + w.studyDays + '日）'; L.push('暗記 ' + w.cards + '枚'); }
  if(w.workH){ o.workHours = w.workH + '時間'; }
  var top = Object.keys(w.cat).sort(function(a, b){ return w.cat[b] - w.cat[a]; }).slice(0, 3);
  if(top.length) o.spendTop = top.map(function(k){ return (typeof kbCat === 'function' ? kbCat(k)[1] : k) + ' ' + yen(w.cat[k]); }).join('・');
  o.line = L.length ? L.join('・') + '。' : '';
  return o;
}
/* 前からある「週のふりかえり」に、睡眠・歩数・暗記の数字も渡す（二重に作らない） */
if(lfWeekStats0){
  weekStats = function(mon){
    var st = lfWeekStats0(mon);
    try{ if(st) st.life = lfWeekBrief(mon); }catch(e){}
    return st;
  };
}
if(lfWeekTpl0){
  weekReviewTemplate = function(st){
    var t = lfWeekTpl0(st);
    try{
      var line = st && st.life && st.life.line;
      if(line){ var L = String(t).split('\n'); L.splice(Math.max(0, L.length - 1), 0, line); t = L.join('\n'); }
    }catch(e){}
    return t;
  };
}
function lfWeekMon(){ return shiftDate(monOfYmd(today()), 7 * lfUi.weekOff); }
function lfWeekHtml(){
  var mon = lfWeekMon(), w = lfWeekData(mon), pv = lfWeekData(shiftDate(mon, -7)), off = lfUi.weekOff, p = lfPrefs();
  var label = off === -1 ? '先週' : off === 0 ? '今週' : (-off) + '週前';
  var diff = function(a, b, f){
    if(!a || !b || a === b) return '';
    var d = a - b;
    return ' <span class="lf-d ' + (d > 0 ? 'up' : 'dn') + '">' + (d > 0 ? '↑' : '↓') + f(Math.abs(d)) + '</span>';
  };
  var h = '<div class="pillrow"><button class="mini" data-act="lf-wk" data-v="-1">‹ 前の週</button>' +
    '<button class="mini' + (off === -1 ? ' on' : '') + '" data-act="lf-wk-set" data-v="-1">先週</button>' +
    '<button class="mini' + (off === 0 ? ' on' : '') + '" data-act="lf-wk-set" data-v="0">今週</button>' +
    (off < 0 ? '<button class="mini" data-act="lf-wk" data-v="1">次の週 ›</button>' : '') + '</div>';
  h += '<div class="grid3 keep3 lf-wkst">' +
    lfStat('睡眠の平均', w.sleepAvg ? lfHm(w.sleepAvg) : '—', w.sleepDays ? w.sleepDays + '日の記録' + diff(w.sleepAvg, pv.sleepAvg, lfHm) : '記録なし') +
    lfStat('歩数の平均', w.stepsAvg ? lfComma(w.stepsAvg) : '—', w.stepDays ? w.stepDays + '日の記録' + diff(w.stepsAvg, pv.stepsAvg, lfComma) : '記録なし') +
    lfStat('暗記', w.cards + '枚', w.studyDays + '日' + diff(w.cards, pv.cards, function(x){ return x + '枚'; })) +
    lfStat('出席', w.att ? w.att.pres + '回' : '—', w.att && (w.att.late || w.att.ab) ? '遅刻' + w.att.late + '・欠席' + w.att.ab : '') +
    lfStat('課題', w.dueN ? w.doneN + '/' + w.dueN : '—', w.dueN ? '締切のあった課題' : '締切なし') +
    lfStat('使ったお金', yen(w.spend), diff(w.spend, pv.spend, yen).replace(/^ /, '')) +
    lfStat('バイト', w.workH ? w.workH + '時間' : '—', w.workN ? w.workN + '回・' + yen(w.pay) : '') + '</div>';
  var lab = function(r){ return lfWd(r.date); };
  h += '<div class="grid3 lf-wkch">' +
    '<div class="lf-ch"><div class="lf-cht">睡眠（時間）</div>' + lfBars(w.rows.map(function(r){ return { label:lab(r), v:r.sleep / 60, low:r.sleep && r.sleep < p.shortSleep, title:lfMd(r.date) + ' ' + lfHm(r.sleep) }; }), { max:10, goal:p.sleepGoal / 60, aria:'1週間の睡眠' }) + '</div>' +
    '<div class="lf-ch"><div class="lf-cht">歩数</div>' + lfBars(w.rows.map(function(r){ return { label:lab(r), v:r.steps, title:lfMd(r.date) + ' ' + lfComma(r.steps) + '歩' }; }), { goal:toNum(p.stepGoal), max:Math.max.apply(null, w.rows.map(function(r){ return r.steps; }).concat([toNum(p.stepGoal) * 1.25])), aria:'1週間の歩数', cls:'steps' }) + '</div>' +
    '<div class="lf-ch"><div class="lf-cht">暗記（枚）</div>' + lfBars(w.rows.map(function(r){ return { label:lab(r), v:r.cards, title:lfMd(r.date) + ' ' + r.cards + '枚' }; }), { aria:'1週間の暗記の枚数', cls:'cards' }) + '</div></div>';
  var cats = Object.keys(w.cat).sort(function(a, b){ return w.cat[b] - w.cat[a]; });
  if(cats.length){
    var cmax = w.cat[cats[0]] || 1;
    h += '<div class="lf-cht" style="margin-top:6px">使ったお金の分類</div><div class="lf-hbars">' + cats.slice(0, 6).map(function(k){
      var c = (typeof kbCat === 'function') ? kbCat(k) : [k, k, ''];
      return '<div class="lf-hb"><span class="lf-hbl">' + esc(c[2] + ' ' + c[1]) + '</span><span class="lf-hbw"><i style="width:' + Math.max(3, Math.round(w.cat[k] / cmax * 100)) + '%"></i></span><span class="num lf-hbv">' + yen(w.cat[k]) + '</span></div>';
    }).join('') + '</div>';
  }
  var rev = (S.weekReview || {})[mon];
  h += '<div class="lf-ai"><div class="s2">🤖 AIのふりかえり（週のふりかえり）</div>' +
    (rev ? esc(rev.text).replace(/\n/g, '<br>') : '<span class="s2">まだありません。下のボタンで、この数字をもとに書いてもらえます。</span>') + '</div>' +
    '<button class="mini" data-act="lf-wk-ai" data-v="' + mon + '"' + (typeof weekRevBusy !== 'undefined' && weekRevBusy ? ' disabled' : '') + '>' +
    (rev ? 'ふりかえりを書き直す' : 'この週のふりかえりを書いてもらう') + '</button>';
  return '<div id="lf-sec-week">' + secWrap('lfWeek', '1週間の生活の分析', label + '　' + lfMd(w.mon) + '〜' + lfMd(w.sun), h) + '</div>';
}

/* ============================== 設定 ============================== */
function lfPills(k, opts, cur){
  return '<div class="pillrow">' + opts.map(function(o){
    return '<button data-act="lf-set" data-k="' + k + '" data-v="' + esc(String(o[0])) + '" class="' + (String(cur) === String(o[0]) ? 'on' : '') + '">' + esc(o[1]) + '</button>';
  }).join('') + '</div>';
}
function lfSettingsHtml(){
  var p = lfPrefs(), pol = String(p.pollen || '').split(',');
  var num = function(id, label, v, ph){ return '<div><label class="f" for="' + id + '">' + label + '</label><input id="' + id + '" inputmode="decimal" value="' + esc(String(v)) + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '></div>'; };
  return '<h3 class="lk" style="margin-top:0;border-top:0;padding-top:0">😴 睡眠と歩数</h3>' +
    '<div class="grid3">' + num('lf_sg', '睡眠の目標（時間）', Math.round(p.sleepGoal / 6) / 10) + num('lf_ss', '寝不足（この時間より短い）', Math.round(p.shortSleep / 6) / 10) +
    num('lf_stg', '歩数の目標', toNum(p.stepGoal)) + '</div>' +
    '<h3 class="lk">📲 iPhoneのヘルスケアから自動で入れる</h3>' + lfShortcutHelp() +
    '<h3 class="lk">🌙 生理周期の記録</h3>' +
    '<label class="f">保存する場所</label>' + lfPills('periodSync', [[0, 'この端末だけ'], [1, 'ほかの端末と同期する']], p.periodSync) +
    '<label class="f">AIそうだんに</label>' + lfPills('periodAi', [[1, '見せる'], [0, '見せない']], p.periodAi) +
    '<label class="f">カレンダーに印</label>' + lfPills('periodCal', [[1, '出す'], [0, '出さない']], p.periodCal) +
    '<label class="f">今日のページに（何日目・あと何日）</label>' + lfPills('periodToday', [[1, '出す'], [0, '出さない']], p.periodToday) +
    '<label class="f">予定日の前に通知</label>' + lfPills('periodNotify', [[0, '知らせない'], [1, '知らせる']], p.periodNotify) +
    (p.periodNotify ? lfPills('periodLead', [[1, '1日前'], [2, '2日前'], [3, '3日前'], [5, '5日前']], p.periodLead) : '') +
    '<label class="f">通知・カレンダーでの言い方（人に見られても分からないように）</label>' +
    lfPills('periodWord', [['plain', '生理'], ['moon', '🌙'], ['custom', '自分で決める']], p.periodWord) +
    (p.periodWord === 'custom' ? '<div class="pair"><input id="lf_pword" value="' + esc(p.periodCustom || '') + '" placeholder="例：📌 じゅんび" aria-label="自分で決める言い方"><button class="btn ghost" style="flex:0 0 auto;padding:11px 14px" data-act="lf-set-save">保存</button></div>' : '') +
    '<p class="note">はじめは<b>この端末だけ</b>に保存します（同期・Googleのバックアップには入りません）。「同期する」にすると、読めない形にしてほかの端末へ送ります。' +
    '同期をやめると、記録はこの端末だけに残り、ほかの端末からは消えます。この端末だけのときは、予定日の通知はこの端末から送った予定にだけ入ります。</p>' +
    '<h3 class="lk">🌡 天気の注意（今日のページ）</h3>' +
    '<label class="f">寒暖差・花粉</label>' + lfPills('wx', [[1, '出す'], [0, '出さない']], p.wx) +
    '<label class="f">気にする花粉</label><div class="chips">' + LF_POLLEN.map(function(x){
      return '<button data-act="lf-pollen" data-v="' + x.id + '" class="' + (pol.indexOf(x.id) >= 0 ? 'on' : '') + '">' + esc(x.name) + '</button>';
    }).join('') + '</div>' +
    '<div class="grid2">' + num('lf_dp', '前の日との差（℃）', p.diffPrev) + num('lf_dd', '1日の中の差（℃）', p.diffDay) + '</div>' +
    '<label class="f">暑さ指数（WBGT）・熱中症警戒アラート（5〜10月）</label>' + lfPills('wbgt', [[1, '出す'], [0, '出さない']], p.wbgt) +
    '<label class="f">暑い日は朝に通知</label>' + lfPills('wbgtNotify', [[1, 'する'], [0, 'しない']], p.wbgtNotify) +
    '<p class="note">気温は Open-Meteo（家＝三田）、暑さ指数は環境省「熱中症予防情報サイト」（三田・神戸）から読みます。暑さ指数は、Google連携を新しい版（v3）にすると読めます。花粉は季節と天気からの<b>目安</b>です。</p>' +
    '<h3 class="lk">🗺 今日の作戦</h3>' + lfPills('plan', [[1, '出す'], [0, '出さない']], p.plan) +
    '<div class="grid2">' + '<div><label class="f" for="lf_pend">1日の終わり（この時刻まで考える）</label><input id="lf_pend" type="time" value="' + esc(p.planEnd || '23:00') + '"></div></div>' +
    '<button class="btn" style="margin-top:10px" data-act="lf-set-save">数字・時刻を保存</button>';
}
function lfSettingsSave(){
  var patch = {}, g = function(id){ return document.getElementById(id); };
  var hrs = function(id, lo, hi){ var e = g(id); if(!e) return null; var v = lfNum(e.value); return (v >= lo && v <= hi) ? Math.round(v * 60) : null; };
  var sg = hrs('lf_sg', 3, 12), ss = hrs('lf_ss', 2, 10);
  if(sg != null) patch.sleepGoal = sg;
  if(ss != null) patch.shortSleep = ss;
  var stg = g('lf_stg'); if(stg && lfNum(stg.value) >= 500) patch.stepGoal = Math.round(lfNum(stg.value));
  var dp = g('lf_dp'); if(dp && lfNum(dp.value) >= 2 && lfNum(dp.value) <= 20) patch.diffPrev = lfNum(dp.value);
  var dd = g('lf_dd'); if(dd && lfNum(dd.value) >= 3 && lfNum(dd.value) <= 25) patch.diffDay = lfNum(dd.value);
  var pe = g('lf_pend'); if(pe && lfHhmm(pe.value)) patch.planEnd = lfHhmm(pe.value);
  var pw = g('lf_pword'); if(pw) patch.periodCustom = String(pw.value || '').trim().slice(0, 20);
  lfSet(patch);
  toast('保存しました');
  commit();
}
kmSettings({ id:'lfset', title:'生活・健康（睡眠・周期・天気の注意）', note:function(){ return lfPrefs().periodSync ? '周期：同期する' : '周期：この端末だけ'; }, html:lfSettingsHtml, after:'' });

/* ============================== 操作 ============================== */
kmAction(function(act, t){
  if(act.indexOf('lf-') !== 0) return false;
  var v = t.dataset ? t.dataset.v : '';
  switch(act){
    case 'lf-open':
      appId = 'today'; todayTab = (v === 'plan' || v === 'wx') ? 'today' : 'life';
      render();
      setTimeout(function(){ var el = document.getElementById('lf-sec-' + v); if(el && el.scrollIntoView) el.scrollIntoView({ block:'start' }); }, 30);
      return true;
    case 'lf-photo': lfPhotoView(t.dataset.id); return true;
    /* 睡眠・歩数 */
    case 'lf-bed': lfGoodnight(); return true;
    case 'lf-wake': lfGoodmorning(); return true;
    case 'lf-log-form': lfUi.logForm = !lfUi.logForm; if(lfUi.logForm) lfUi.logDate = today(); render(); return true;
    case 'lf-log-edit': lfUi.logForm = true; lfUi.logDate = t.dataset.d; render(); return true;
    case 'lf-log-save': lfLogSave(); return true;
    case 'lf-log-del':
      if(!confirm(ymdLabel(t.dataset.d) + 'の記録を消しますか？')) return true;
      lfLogDel(t.dataset.d); toast('消しました'); commit(); return true;
    case 'lf-log-list': lfUi.logList = !lfUi.logList; render(); return true;
    case 'lf-hc-help': lfUi.hcHelp = !lfUi.hcHelp; render(); return true;
    /* 生理周期 */
    case 'lf-p-start':
      /* この端末だけの記録を同期へ移したら（この端末の置き場は空になる）、ここで必ず保存する */
      var mv = lfPrefs().periodSync ? lfPeriodToSync() : 0;
      var pl = lfPeriods(), last = pl[pl.length - 1], dn = last ? daysBetween(last.start, today()) : null;
      if(last && !isYmd(last.end) && dn >= 0 && dn <= 10){ if(mv) commit(); toast('もう記録しています（' + lfMd(last.start) + 'から）'); return true; }
      lfPeriodPut({ start:today(), flow:2 }); toast('記録しました'); commit(); return true;
    case 'lf-p-end':
      var pl2 = lfPeriods().filter(function(x){ return !isYmd(x.end) && x.start <= today() && daysBetween(x.start, today()) <= 14; });
      var open = pl2[pl2.length - 1];
      if(!open){ toast('始まった日の記録がありません。「日付を選んで記録」から入れてください', true); return true; }
      lfPeriodPut(Object.assign({}, open, { end:today() })); toast('終わった日を記録しました'); commit(); return true;
    case 'lf-p-form': lfUi.pf = { id:'', start:today(), end:'', flow:2, pain:0, memo:'' }; render(); return true;
    case 'lf-p-edit':
      var pe = lfPeriods().filter(function(x){ return x.id === t.dataset.id; })[0];
      if(pe) lfUi.pf = Object.assign({}, pe);
      render(); return true;
    case 'lf-p-flow': lfPfRead(); if(lfUi.pf) lfUi.pf.flow = toNum(v); render(); return true;
    case 'lf-p-pain': lfPfRead(); if(lfUi.pf) lfUi.pf.pain = toNum(v); render(); return true;
    case 'lf-p-cancel': lfUi.pf = null; render(); return true;
    case 'lf-p-save':
      lfPfRead();
      var f = lfUi.pf;
      if(!f || !isYmd(f.start)){ toast('始まった日を選んでください', true); return true; }
      if(f.end && (!isYmd(f.end) || f.end < f.start)){ toast('終わった日は、始まった日より後にしてください', true); return true; }
      lfPeriodPut(f); lfUi.pf = null; toast('記録しました'); commit(); return true;
    case 'lf-p-del':
      if(!confirm('この記録を消しますか？')) return true;
      lfPeriodDel(t.dataset.id); lfUi.pf = null; toast('消しました'); commit(); return true;
    case 'lf-p-list': lfUi.pList = !lfUi.pList; render(); return true;
    /* 予防接種・健診 */
    case 'lf-x-form': lfUi.xf = lfXfNew(t.dataset.item || ''); render(); return true;
    case 'lf-x-edit':
      var xe = lfVaxList().filter(function(x){ return x.id === t.dataset.id; })[0];
      if(xe) lfUi.xf = Object.assign(lfXfNew(''), JSON.parse(JSON.stringify(xe)), { ok:xe.ok === '' || xe.ok == null ? '' : xe.ok });
      render(); return true;
    case 'lf-x-kind': lfXfRead(); if(lfUi.xf) lfUi.xf.kind = v; render(); return true;
    case 'lf-x-ok': lfXfRead(); if(lfUi.xf) lfUi.xf.ok = v === '' ? '' : toNum(v); render(); return true;
    case 'lf-x-cancel': lfUi.xf = null; render(); return true;
    case 'lf-x-save': lfVaxSave(); return true;
    case 'lf-x-del':
      lfUi.xf = null;
      removeWithUndo('vaccines', t.dataset.id, '記録を消しました'); commit(); return true;
    case 'lf-x-list': lfUi.xList = !lfUi.xList; render(); return true;
    case 'lf-x-photo':
      lfXfRead();
      lfFilePick('image/*', async function(file){
        try{
          var data = await resizeImage(file, 1800, 0.82), pid = uid('mi');
          await photoPut(pid, data);
          lfXfRead();
          if(lfUi.xf){ lfUi.xf.photos = (lfUi.xf.photos || []).concat([pid]); }
          lfRender();
        }catch(e){ toast('写真を保存できませんでした', true); }
      });
      return true;
    case 'lf-x-scan': if(lfAiNeed()) lfFilePick('image/*', lfVaxScanRun); return true;
    case 'lf-x-scan-add': lfVaxScanAdd(); return true;
    case 'lf-x-scan-cancel': lfUi.xScan = null; render(); return true;
    /* 天気 */
    case 'lf-wx-reload': lfWxLoad(true); return true;
    /* 今日の作戦 */
    case 'lf-plan-more': lfUi.planMore = !lfUi.planMore; render(); return true;
    case 'lf-plan-ai': lfPlanAi(t.dataset.d || today()); return true;
    /* 声・写真 */
    case 'lf-voice': if(lfAiNeed()) lfVoiceStart(); return true;
    case 'lf-v-stop': lfVoiceStop(); return true;
    case 'lf-v-again': if(lfUi.voice) lfVoiceStart(); return true;
    case 'lf-v-parse':
      var vt = document.getElementById('lf_vtext');
      lfVoiceParse(vt ? vt.value : (lfUi.voice && lfUi.voice.text)); return true;
    case 'lf-v-add': lfVoiceAdd(); return true;
    case 'lf-v-undo':
      if(lfUi.voice && lfUi.voice.res && !lfUi.voice.res.undone){ aiUndoOps(lfUi.voice.res.ops); lfUi.voice.res.undone = 1; toast('取り消しました'); commit(); }
      return true;
    case 'lf-v-close': lfVoiceStop(); lfUi.voice = null; render(); return true;
    case 'lf-snap': if(lfAiNeed()) lfFilePick('image/*', lfSnapRun); return true;
    case 'lf-s-add': lfSnapAdd(); return true;
    case 'lf-s-undo':
      if(lfUi.snap && lfUi.snap.res && !lfUi.snap.res.undone){ aiUndoOps(lfUi.snap.res.ops); lfUi.snap.res.undone = 1; toast('取り消しました'); commit(); }
      return true;
    case 'lf-s-close': lfUi.snap = null; render(); return true;
    /* 週の分析 */
    case 'lf-wk': lfUi.weekOff = Math.min(0, lfUi.weekOff + toNum(v)); render(); return true;
    case 'lf-wk-set': lfUi.weekOff = toNum(v); render(); return true;
    case 'lf-wk-ai':
      if(typeof weekReviewMake === 'function'){ weekReviewMake(v, true).then(function(){ lfRender(); }); render(); }
      return true;
    /* 設定 */
    case 'lf-set':
      var k = t.dataset.k, val2 = /^-?\d+$/.test(String(v)) ? toNum(v) : v;
      if(k === 'periodSync'){
        if(toNum(val2) === toNum(lfPrefs().periodSync)) return true;
        if(!toNum(val2) && !confirm('同期をやめると、記録はこの端末だけに残り、ほかの端末からは消えます。よいですか？')) return true;
        var moved = lfPeriodSyncSet(toNum(val2));
        toast(toNum(val2) ? '同期するようにしました' + (moved ? '（' + moved + '件を送ります）' : '') : 'この端末だけに保存するようにしました');
        return true;
      }
      var patch = {}; patch[k] = val2;
      lfSet(patch); commit();
      if((k === 'wx' || k === 'wbgt') && val2) lfWxLoad(true);
      return true;
    case 'lf-set-save': lfSettingsSave(); return true;
    case 'lf-pollen':
      var cur = String(lfPrefs().pollen || '').split(',').filter(Boolean);
      cur = cur.indexOf(v) >= 0 ? cur.filter(function(x){ return x !== v; }) : cur.concat([v]);
      lfSet({ pollen:cur.join(',') }); commit(); return true;
  }
  return false;
});
/* 入力中の文字を覚えておく（同期などで描き直しても消えないように） */
document.addEventListener('input', function(e){
  var t = e.target;
  if(!t) return;
  if(t.id === 'lf_vtext' && lfUi.voice) lfUi.voice.text = t.value;
  if(t.classList && t.classList.contains('lf-ce')){
    var list = t.dataset.p === 'v' ? (lfUi.voice && lfUi.voice.cands) : (lfUi.snap && lfUi.snap.cands);
    var c = list && list[toNum(t.dataset.i)];
    if(c) c[t.dataset.f] = t.dataset.f === 'amount' ? Math.abs(Math.round(lfNum(t.value))) : t.value;
  }
  if(lfUi.pf && /^lf_p[sem]$/.test(t.id)) lfPfRead();
  if(lfUi.xf && /^lf_x/.test(t.id)) lfXfRead();
});
document.addEventListener('change', function(e){
  var t = e.target;
  if(!t) return;
  if(t.id === 'lf_ld'){ lfUi.logDate = t.value; render(); return; }
  if(t.id === 'lf_xitem' && lfUi.xf){ lfXfRead(); return; }
  if(t.classList && t.classList.contains('lf-xs-pick') && lfUi.xScan && lfUi.xScan.list){
    var xs = lfUi.xScan.list[toNum(t.dataset.i)];
    if(xs) xs.pick = t.checked ? 1 : 0;       /* 描き直してもチェックが消えないように */
    return;
  }
  if(t.classList && t.classList.contains('lf-pick')){
    var list = t.dataset.p === 'v' ? (lfUi.voice && lfUi.voice.cands) : (lfUi.snap && lfUi.snap.cands);
    var c = list && list[toNum(t.dataset.i)];
    if(c) c.pick = t.checked ? 1 : 0;
  }
});

/* ============================== ページの枠 ============================== */
kmPart('today', 'lfQuick', '声・写真で登録', function(ctx){ return ctx.isToday ? lfQuickHtml() : ''; });
kmPart('today', 'lfPlan', '今日の作戦', function(ctx){ return lfPrefs().plan ? lfPlanHtml(ctx.ymd || today()) : ''; });
kmPart('today', 'lfWx', '寒暖差・花粉・暑さ指数', function(ctx){ return lfWxHtml(ctx.ymd || today(), ctx.isToday !== false); });
kmPart('today', 'lfBody', '睡眠・からだの記録', function(ctx){ return ctx.isToday ? lfBodyTodayHtml() : ''; });
kmPart('tomo', 'lfWx', '寒暖差・花粉・暑さ指数', function(ctx){ return lfWxHtml(ctx.ymd || shiftDate(today(), 1), false); });
kmPart('tomo', 'lfPlan', '明日の作戦', function(ctx){ return lfPrefs().plan ? lfPlanHtml(ctx.ymd || shiftDate(today(), 1)) : ''; });
kmPart('life', 'lfHealth', '睡眠と歩数', function(){ return lfHealthHtml(); });
kmPart('life', 'lfPeriod', '周期の記録', function(){ return lfPeriodHtml(); });
kmPart('life', 'lfVax', '予防接種・健康診断', function(){ return lfVaxHtml(); });
kmPart('life', 'lfWeek', '1週間の生活の分析', function(){ return lfWeekHtml(); });
kmPart('cal', 'lfCycle', '周期の印', function(ctx){ return lfPeriodCalHtml(ctx.ym || calYm); });
lfPlace('today', 'lfQuick', 'brief');
lfPlace('today', 'lfPlan', 'lfQuick');
lfPlace('today', 'lfWx', 'weather');
lfPlace('today', 'lfBody', 'lfWx');
lfPlace('tomo', 'lfWx', 'weather');
lfPlace('tomo', 'lfPlan', 'lfWx');
lfPlace('cal', 'lfCycle', 'grid');

/* ============================== 通知（kmJobs） ============================== */
kmJobs(function(add, prefs, now){
  var p = lfPrefs(), td = today();
  /* 生理の予定日の前（オンにした人だけ・言い方は選べる） */
  if(p.periodNotify){
    var st = lfPeriodStats();
    if(st && st.late < 0){
      var W = lfPWord(), lead = Math.max(0, toNum(p.periodLead));
      add('lf-pd-' + st.next, notifyAt(shiftDate(st.next, -lead), prefs.dlTime || '20:00'), W.title, W.body.replace('{d}', lfMd(st.next)).slice(0, 190));
    }
  }
  /* 暑さ指数・熱中症警戒アラート（朝に） */
  if(p.wbgt && p.wbgtNotify){
    [td, shiftDate(td, 1)].forEach(function(d){
      var wb = lfWbgtFor(d);
      if(!wb || (wb.max < 28 && !wb.alert)) return;
      var title = wb.alert ? '🚨 熱中症' + (wb.alert >= 2 ? '特別' : '') + '警戒アラート' : wb.max >= 31 ? '🥵 熱中症に警戒' : '🥵 熱中症に注意';
      add('lf-wbgt-' + d, notifyAt(d, prefs.amTime || '06:45'), title,
        '今日の暑さ指数の予想：' + (wb.by.length ? wb.by.map(function(x){ return x.name + ' ' + x.v; }).join('・') + (wb.word ? '（' + wb.word + '）' : '') : '（アラート発表中）') +
        '。水分と塩分をこまめに、すずしい所で休けいを。');
    });
  }
});

/* ============================== AIが読めるデータ（kmAiData） ============================== */
function lfAiData(name, desc, section, fn){
  fn.section = section;
  kmAiData(name, desc, fn);
  KM.aiData[name].section = section;
}
lfAiData('lfSleep', '睡眠と歩数（最近30日・14日の平均・目標・寝不足が続いているか）。睡眠は起きた日の記録', 'health', function(){
  var st = lfHealthStats(30), p = lfPrefs(), s14 = lfHealthStats(14);
  return { goal:{ sleep:lfHm(p.sleepGoal), shortSleepBelow:lfHm(p.shortSleep), steps:toNum(p.stepGoal) },
    avg14:{ sleep:s14.sleepN ? lfHm(s14.sleepAvg) : null, sleepDays:s14.sleepN, steps:s14.stepsN ? s14.stepsAvg : null, stepDays:s14.stepsN },
    shortSleepStreakDays:st.short,
    days:st.days.filter(function(x){ return x.sleep || x.steps; }).map(function(x){
      return { date:x.date, sleep:x.sleep ? lfHm(x.sleep) : null, sleepMinutes:x.sleep || null, bed:x.bed || null, wake:x.wake || null, steps:x.steps || null, from:x.src === 'health' ? 'ヘルスケア' : '手入力' };
    }) };
});
lfAiData('lfPeriod', '生理周期の記録と、次の予定日・排卵の目安（本人が「見せない」にしているときは出さない）', 'health', function(){
  var p = lfPrefs();
  if(!p.periodAi) return { hidden:true, note:'本人の設定で、AIには見せていません（くわしく聞かず、アプリの くらし で確かめるよう伝える）' };
  var list = lfPeriods(), st = lfPeriodStats(list);
  if(!st) return { records:0, note:'記録はまだありません' };
  return { records:list.slice(-12).map(function(x){ return { start:x.start, end:x.end || null, flow:(LF_FLOW.filter(function(o){ return o[0] === x.flow; })[0] || ['', ''])[1] || null,
      pain:x.pain && LF_PAIN[x.pain] ? LF_PAIN[x.pain][1] : null, memo:x.memo || null }; }),
    avgCycleDays:st.avg, cyclesUsed:st.known, avgLengthDays:st.plen, nextStart:st.next, daysUntilNext:-st.late, ongoing:st.ongoing, dayNow:st.ongoing ? st.dayN : null,
    ovulationEstimate:st.ovu, note:'どれも記録からの目安。避妊には使えない。気になるときは婦人科・保健センターへ' };
});
lfAiData('lfVax', '予防接種・抗体・健診のチェック表（実習の前に求められることが多いもの。大学の指示が優先）と、次の予定日', 'health', function(){
  return { checklist:lfVaxStatus().map(function(x){ return { item:x.name, status:({ ok:'そろっている', part:'あと少し', none:'記録なし' })[x.st], detail:x.msg }; }),
    upcoming:lfVaxList().filter(function(x){ return x && isYmd(x.next); }).map(function(x){ return { name:x.name, next:x.next }; }),
    note:'判定は目安。必要なもの・回数・基準は大学（実習の手引き・保健センター）の指示を優先' };
});
lfAiData('lfWx', '今日・明日の暑さ指数（WBGT）・熱中症警戒アラート・寒暖差・花粉の目安（家＝三田）', 'health', function(){
  var td = today(), tm = shiftDate(td, 1);
  var one = function(d){
    var wb = lfWbgtFor(d), t = lfTempDiff(d), pl = lfPollen(d);
    return { date:d, wbgt:wb ? { max:wb.max, level:wb.word, points:wb.by, alert:wb.alert ? (wb.alert >= 2 ? '熱中症特別警戒アラート' : '熱中症警戒アラート') : null } : null,
      temp:t ? { max:t.max, min:t.min, rangeInDay:t.range, changeFromYesterday:t.dPrev, what:t.what, warn:!!(t.warnPrev || t.warnDay) } : null,
      pollen:pl ? { kinds:pl.names, level:pl.word, why:pl.why, note:'季節と天気からの目安' } : null };
  };
  return { today:one(td), tomorrow:one(tm), updated:{ weather:lfWx.omAt || null, wbgt:lfWx.wbgtAt || null } };
});
lfAiData('lfPlan', '今日の作戦（すきま時間に何をするか。きまりで作った目安と、AIに頼んだ作戦）', 'tasks', function(){
  var pl = lfPlanFor(today()), ai = (S.kmData || {})['life:plan'];
  return { date:pl.ymd, plan:pl.picks.map(function(x){ return { from:hhmmOf(x.s), to:hhmmOf(x.e), what:x.what, why:x.why, moving:x.kind === 'move' }; }),
    notYet:pl.left.map(function(x){ return x.what; }), ankiDue:pl.anki, notes:pl.notes, aiPlan:ai && ai.date === pl.ymd ? ai.text : null };
});
lfAiData('lfWeek', '先週と今週の生活の数字（睡眠・歩数・暗記・出席・課題・使ったお金・バイト）', 'reviews', function(){
  var sum = function(mon){
    var w = lfWeekData(mon);
    return { week:w.mon + '〜' + w.sun, sleepAvg:w.sleepAvg ? lfHm(w.sleepAvg) : null, sleepDays:w.sleepDays, stepsAvg:w.stepsAvg || null,
      ankiCards:w.cards, studyDays:w.studyDays, attendance:w.att, tasks:{ due:w.dueN, done:w.doneN, notDone:w.late },
      spend:w.spend, spendByCategory:Object.keys(w.cat).map(function(k){ return { cat:(typeof kbCat === 'function' ? kbCat(k)[1] : k), yen:w.cat[k] }; }),
      workHours:w.workH, workCount:w.workN, pay:w.pay,
      days:w.rows.map(function(r){ return { date:r.date, sleep:r.sleep ? lfHm(r.sleep) : null, steps:r.steps || null, cards:r.cards, spend:r.spend, workHours:r.work }; }) };
  };
  var mon = monOfYmd(today());
  return { lastWeek:sum(shiftDate(mon, -7)), thisWeek:sum(mon) };
});

/* ============================== AIそうだんの道具（書きこむ道具） ============================== */
kmChatTool({ name:'record_sleep', description:'睡眠（寝た時刻・起きた時刻・睡眠時間）や歩数を手帳に記録する。「睡眠を記録して」「歩数を記録して」と頼まれたときだけ使う。',
  parameters:{ type:'OBJECT', properties:{
    date:{ type:'STRING', description:'起きた日（歩数はその日） YYYY-MM-DD。今日なら空' },
    bed:{ type:'STRING', description:'寝た時刻 HH:MM' }, wake:{ type:'STRING', description:'起きた時刻 HH:MM' },
    minutes:{ type:'NUMBER', description:'睡眠時間（分）。寝た・起きた時刻があれば不要' }, steps:{ type:'NUMBER', description:'歩数' } } } },
  function(a){
    var d = isYmd(a.date) ? a.date : today(), cur = lfLog(d) || {};
    var bed = lfHhmm(a.bed), wake = lfHhmm(a.wake), min = Math.round(lfNum(a.minutes)), steps = Math.round(lfNum(a.steps));
    var patch = {}, said = [];
    if(bed) patch.bed = bed;
    if(wake) patch.wake = wake;
    var s = (bed || wake) ? lfSleepCalc(bed || cur.bed, wake || cur.wake) : 0;
    if(s){ patch.sleep = s; patch.src = 'hand'; }
    else if(min > 0 && min <= 1440){ patch.sleep = min; patch.src = 'hand'; }
    if(patch.sleep) said.push('睡眠 ' + lfHm(patch.sleep));
    else if(bed) said.push('寝た時刻 ' + bed);
    else if(wake) said.push('起きた時刻 ' + wake);
    if(steps > 0 && steps < 200000){ patch.steps = steps; said.push(lfComma(steps) + '歩'); }
    if(!said.length) return { result:'記録する中身（時刻・時間・歩数）がありません' };
    lfLogSet(d, patch);
    return { result:ymdLabel(d) + 'に記録しました：' + said.join('・') };
  });
KM.chatTools[KM.chatTools.length - 1].write = true;
kmChatTool({ name:'record_period', description:'生理が始まった日・終わった日を記録する。「生理を記録して」「生理が始まった」と頼まれたときだけ使う。',
  parameters:{ type:'OBJECT', properties:{
    start:{ type:'STRING', description:'始まった日 YYYY-MM-DD（終わった日だけのときは空）' }, end:{ type:'STRING', description:'終わった日 YYYY-MM-DD。まだなら空' },
    flow:{ type:'STRING', enum:['少ない', 'ふつう', '多い'], description:'量' }, pain:{ type:'STRING', enum:['なし', '少し', 'つらい', 'とてもつらい'], description:'痛み' },
    memo:{ type:'STRING' } } } },
  function(a){
    if(!lfPrefs().periodAi) return { result:'本人の設定で、AIからは記録できません。アプリの「今日 › くらし」から入れるよう伝えてください。' };
    var flow = (LF_FLOW.filter(function(o){ return o[1] === a.flow; })[0] || [0])[0], pain = (LF_PAIN.filter(function(o){ return o[1] === a.pain; })[0] || [0])[0];
    var list = lfPeriods();
    if(isYmd(a.start)){
      var same = list.filter(function(x){ return x.start === a.start; })[0];
      var rec = Object.assign({}, same || {}, { start:a.start });
      if(isYmd(a.end) && a.end >= a.start) rec.end = a.end;
      if(flow) rec.flow = flow;
      if(a.pain) rec.pain = pain;
      if(a.memo) rec.memo = String(a.memo);
      lfPeriodPut(rec);
      return { result:'記録しました：' + lfMd(a.start) + 'から' + (rec.end ? lfMd(rec.end) + 'まで' : '') };
    }
    if(isYmd(a.end)){
      var open = list.filter(function(x){ return !isYmd(x.end) && x.start <= a.end && daysBetween(x.start, a.end) <= 14; }).pop();
      if(!open) return { result:'始まった日の記録が見つかりません。始まった日も教えてもらってください' };
      lfPeriodPut(Object.assign({}, open, { end:a.end }));
      return { result:'終わった日を記録しました：' + lfMd(a.end) };
    }
    return { result:'日付がありません' };
  });
KM.chatTools[KM.chatTools.length - 1].write = true;
kmChatTool({ name:'add_vaccine', description:'予防接種・抗体検査・健康診断の記録を手帳に入れる。「予防接種を記録して」などと頼まれたときだけ使う。',
  parameters:{ type:'OBJECT', properties:{
    kind:{ type:'STRING', enum:['vaccine', 'antibody', 'checkup'], description:'vaccine=ワクチン antibody=抗体検査 checkup=健診・検査' },
    item:{ type:'STRING', enum:['measles', 'rubella', 'varicella', 'mumps', 'hepb', 'flu', 'tb', 'checkup', 'mr', 'other'], description:'項目' },
    name:{ type:'STRING', description:'名前' }, date:{ type:'STRING', description:'YYYY-MM-DD' }, dose:{ type:'NUMBER', description:'何回目' },
    result:{ type:'STRING', description:'抗体価・結果' }, ok:{ type:'BOOLEAN', description:'抗体が基準を満たしている（判定が書いてあるときだけ）' },
    place:{ type:'STRING' }, next:{ type:'STRING', description:'次の予定日 YYYY-MM-DD' }, memo:{ type:'STRING' } }, required:['name'] } },
  function(a){
    var item = LF_VAX_OPT.some(function(o){ return o[0] && o[0] === a.item; }) ? a.item : '';
    var name = String(a.name || lfVaxItemName(item) || '').slice(0, 60);
    if(!name) return { result:'名前がありません' };
    var id = uid('vx'), date = lfFixDate(a.date);
    if(!Array.isArray(S.vaccines)) S.vaccines = [];
    S.vaccines.push({ id:id, kind:['vaccine', 'antibody', 'checkup'].indexOf(a.kind) >= 0 ? a.kind : 'vaccine', item:item, name:name,
      date:date, dose:toNum(a.dose) || '', result:String(a.result || '').slice(0, 80), ok:a.ok === true ? 1 : a.ok === false ? 0 : '',
      place:String(a.place || '').slice(0, 60), next:lfFixDate(a.next), memo:String(a.memo || '').slice(0, 300), photos:[], mt:Date.now() });
    return { result:'記録しました', op:{ t:'add', list:'vaccines', id:id, label:'予防接種・健診「' + name + '」' + (isYmd(date) ? '（' + ymdLabel(date) + '）' : '') } };
  });
KM.chatTools[KM.chatTools.length - 1].write = true;

/* ============================== 全体の検索・まとめ・点検 ============================== */
kmSearch(function(q){
  q = norm(String(q || '').trim());
  if(!q) return [];
  var out = [];
  lfVaxList().forEach(function(x){
    if(!x || !x.id) return;
    var txt = norm([x.name, x.result, x.place, x.memo, x.date, lfVaxItemName(x.item)].join(' '));
    if(txt.indexOf(q) < 0) return;
    out.push({ kind:'予防接種・健診', title:x.name || '記録', sub:[x.date ? ymdLabel(x.date) : '', x.dose ? x.dose + '回目' : '', x.result || ''].filter(Boolean).join('・'),
      act:'lf-open', attrs:{ 'data-v':'vax', 'data-id':x.id } });
  });
  if(/睡眠|すいみん|寝不足|歩数|ほすう|ねむ/.test(q)){
    var st = lfHealthStats(14);
    out.push({ kind:'健康', title:'睡眠と歩数', sub:'14日の平均 ' + (st.sleepN ? lfHm(st.sleepAvg) : '—') + '・' + (st.stepsN ? lfComma(st.stepsAvg) + '歩' : '—'), act:'lf-open', attrs:{ 'data-v':'body' } });
  }
  if(/暑さ|熱中症|wbgt|花粉|寒暖差/.test(q)) out.push({ kind:'天気の注意', title:'寒暖差・花粉・暑さ指数', sub:'今日のページ', act:'lf-open', attrs:{ 'data-v':'wx' } });
  if(/作戦|すきま/.test(q)) out.push({ kind:'今日の作戦', title:'すきま時間の作戦', sub:'今日のページ', act:'lf-open', attrs:{ 'data-v':'plan' } });
  if(/週の分析|1週間|一週間/.test(q)) out.push({ kind:'くらし', title:'1週間の生活の分析', sub:'今日 › くらし', act:'lf-open', attrs:{ 'data-v':'week' } });
  return out.slice(0, 20);
});
kmSummary(function(s){
  var r = lfLog(today()), sl = lfSleepOf(r), st = lfStepsOf(r), o = {};
  if(sl) o.sleep = lfHm(sl);
  if(st) o.steps = st;
  var wb = lfWbgtFor(today());
  if(wb && (wb.max >= 28 || wb.alert)) o.heat = (wb.alert ? '熱中症警戒アラート・' : '') + (wb.max ? '暑さ指数 ' + wb.max + '（' + wb.word + '）' : '');
  if(Object.keys(o).length) s.life = o;
});
kmCheck(function(){
  var td = today(), out = [];
  lfVaxList().forEach(function(x){
    if(x && isYmd(x.next) && x.next < td && daysBetween(x.next, td) <= 60)
      out.push({ level:'warn', msg:'予防接種・健診「' + (x.name || '') + '」の次の予定日（' + ymdLabel(x.next) + '）をすぎています。受けたら記録を足してください。' });
  });
  return out;
});

/* 起動したら：同期する設定なら、この端末だけの記録を同期へ移す（ほかの端末で「同期する」にしたとき） */
setTimeout(function(){
  if(TEST_MODE) return;
  try{
    var n = lfPeriodReenc();
    if(lfPrefs().periodSync) n += lfPeriodToSync();
    if(n) commit();
  }catch(e){ kmErr('周期の記録', e); }
}, 8000);

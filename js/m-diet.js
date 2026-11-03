/* くらしの手帳：ダイエットタブ（担当 diet・関数は dt、クラスは dt- ではじめる） */
/* ============================== しくみ ==============================
   タブ「ダイエット」（kmView('diet')）。データは次のとおり（どれも同期する）。
   ・目標 … S.kmData 'diet:goal' { startKg, startDate, targetKg, targetDate, kcal, mt }
       はじめて直すまでは保存しない（初期値 DT_GOAL を出すだけ）
   ・体重の記録 … S.kmItems（mod:'diet', type:'weight'）{ date, kg }
   ・今日の3つの習慣 … S.kmData 'diet:habits' { 'YYYY-MM-DD': { drink, rice, walk, mt } }

 ・ランの記録 … S.kmItems（mod:'diet', type:'run'）{ date, min, km?, src?, hid? }
   src 'health' のものは Apple ヘルスケアのワークアウトから毎晩自動取込（run_sync.py）。
   手入力（src なし）は1日1件にまとめ、ヘルスケア分とは別に足し合わせる。
   測り忘れ防止：
   ・毎朝 6:40 に「体重を測る」通知（kmJobs）
   ・その日の記録が無いときは 21:30 に「今日はまだ記録が無い」通知（kmJobs）
   ・「今日 › くらし」にも状態カードを出す（kmPart） */

/* ============================== 決まり ============================== */
var DT_GOAL = { startKg:58, startDate:'2026-11-03', targetKg:53, targetDate:'2026-12-31', kcal:1600 };
var DT_TABS = [['home', 'ホーム'], ['log', '記録'], ['food', '食事の目安']];
var DT_HABITS = [['drink', '🍵 飲み物は無糖にした'], ['rice', '🍚 夜ごはんは茶碗1杯まで'], ['walk', '👟 よく歩いた・少し歩いた']];
var DT_RUN_GOAL = 30; /* 1日のランの目標（分） */

var dtUi = { tab:'home', f:null, rf:null, editGoal:false };

/* ============================== 共通 ============================== */
function dtGoal(){
  var d = (S.kmData || {})['diet:goal'];
  if(d && isFinite(Number(d.startKg)) && isFinite(Number(d.targetKg))) return Object.assign({}, DT_GOAL, d);
  return Object.assign({}, DT_GOAL);
}
function dtGoalSave(g){
  S.kmData = S.kmData || {};
  S.kmData['diet:goal'] = Object.assign({}, g, { mt:Date.now() });
  touch('kmData');
}
function dtWeights(){
  return (S.kmItems || []).filter(function(x){ return x && x.mod === 'diet' && x.type === 'weight' && isYmd(x.date) && isFinite(Number(x.kg)); })
    .slice().sort(function(a, b){ return String(a.date).localeCompare(String(b.date)) || (a.mt || 0) - (b.mt || 0); });
}
function dtPutWeight(date, kg, id){
  if(!Array.isArray(S.kmItems)) S.kmItems = [];
  var rec = null;
  (S.kmItems).forEach(function(x){ if(x && x.mod === 'diet' && x.type === 'weight' && x.date === date) rec = x; });
  if(id) (S.kmItems).forEach(function(x){ if(x && x.id === id) rec = x; });
  if(!rec){ rec = { id:uid('dt'), mod:'diet', type:'weight' }; S.kmItems.push(rec); }
  rec.date = date; rec.kg = Math.round(Number(kg) * 10) / 10; rec.mt = Date.now();
  return rec.id;
}
function dtTodayRec(){ var td = today(); return dtWeights().filter(function(x){ return x.date === td; })[0] || null; }
function dtLatest(){ var w = dtWeights(); return w.length ? w[w.length - 1] : null; }
function dtAvg(list){ if(!list.length) return null; return Math.round(list.reduce(function(a, x){ return a + Number(x.kg); }, 0) / list.length * 10) / 10; }
function dtWeekAvg(endYmd){
  var from = shiftDate(endYmd, -6);
  return dtAvg(dtWeights().filter(function(x){ return x.date >= from && x.date <= endYmd; }));
}
/* ============================== ラン ============================== */

function dtRuns(){
 return (S.kmItems || []).filter(function(x){ return x && x.mod === 'diet' && x.type === 'run' && isYmd(x.date) && isFinite(Number(x.min)) && Number(x.min) > 0; })
  .slice().sort(function(a, b){ return String(a.date).localeCompare(String(b.date)) || (a.mt || 0) - (b.mt || 0); });
}

function dtRunMin(ymd){ return dtRuns().filter(function(x){ return x.date === ymd; }).reduce(function(a, x){ return a + Number(x.min); }, 0); }

function dtRunKm(ymd){ return Math.round(dtRuns().filter(function(x){ return x.date === ymd; }).reduce(function(a, x){ return a + (Number(x.km) || 0); }, 0) * 100) / 100; }

function dtManualRun(ymd){ return dtRuns().filter(function(x){ return x.date === ymd && x.src !== 'health'; })[0] || null; }

/* 手入力は1日1件にまとめる（ヘルスケア分には触らない）。id 指定時はその記録を直す */
function dtPutRun(date, min, km, id){
 if(!Array.isArray(S.kmItems)) S.kmItems = [];
 var rec = null;
 if(id) (S.kmItems).forEach(function(x){ if(x && x.id === id) rec = x; });
 if(!rec) rec = dtManualRun(date);
 if(!rec){ rec = { id:uid('dtr'), mod:'diet', type:'run' }; S.kmItems.push(rec); }
 rec.date = date; rec.min = Math.max(1, Math.round(Number(min)));
 if(Number(km) > 0) rec.km = Math.round(Number(km) * 100) / 100; else delete rec.km;
 rec.mt = Date.now();
 return rec.id;
}

/* ランの消費カロリー目安：58kgで ゆっくり走って 1分≒10kcal */
function dtRunKcal(min){ return Math.round((Number(min) || 0) * 10); }

/* 走った日が続いているか（今日か昨日から数える） */
function dtRunStreak(){
 var days = {}; dtRuns().forEach(function(x){ days[x.date] = 1; });
 var cur = today(); if(!days[cur]) cur = shiftDate(cur, -1);
 var n = 0; while(days[cur]){ n++; cur = shiftDate(cur, -1); }
 return n;
}

function dtHabits(){
  var d = (S.kmData || {})['diet:habits'];
  return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
}
function dtHabitSave(ymd, h){
  S.kmData = S.kmData || {};
  var all = dtHabits(); all[ymd] = Object.assign({}, h, { mt:Date.now() });
  S.kmData['diet:habits'] = all; touch('kmData');
}
function dtKg(v){ return (Math.round(Number(v) * 10) / 10).toFixed(1) + 'kg'; }
function dtStr(v, n){ return String(v == null ? '' : v).trim().slice(0, n || 200); }

/* 目標ペース：開始日→目標日の直線。今日の「目安の体重」を返す */
function dtExpected(){
  var g = dtGoal(), td = today();
  var total = daysBetween(g.startDate, g.targetDate), done = daysBetween(g.startDate, td);
  if(total == null || done == null || total <= 0) return null;
  var r = Math.max(0, Math.min(1, done / total));
  return Math.round((Number(g.startKg) + (Number(g.targetKg) - Number(g.startKg)) * r) * 10) / 10;
}
/* 記録した日が続いているか（今日か昨日から数える） */
function dtStreak(){
  var set = {}; dtWeights().forEach(function(x){ set[x.date] = 1; });
  var cur = today(); if(!set[cur]) cur = shiftDate(cur, -1);
  var n = 0; while(set[cur]){ n++; cur = shiftDate(cur, -1); }
  return n;
}

/* ============================== ホーム ============================== */
function dtHomeHtml(){
  var g = dtGoal(), td = today(), w = dtWeights(), latest = dtLatest(), rec = dtTodayRec();
  var h = '';
  /* 測り忘れ防止：今日の記録が無いときは、いちばん上に大きく出す */
  if(!rec){
    h += '<div class="dt-alert"><b>⚖️ 今日はまだ体重の記録がありません</b>' +
      '<div class="s">朝、トイレのあと・朝ごはん前に測るのがおすすめ。測ったらここに入れてね。</div>' +
      '<div class="dt-quick"><input type="number" inputmode="decimal" step="0.1" min="30" max="200" id="dt_quick_kg" class="dt-in" placeholder="例：57.8">' +
      '<button class="btn" data-act="dt-quick-save">記録する</button></div></div>';
  }else{
    h += '<div class="dt-ok">✅ 今日の体重は記録ずみ（' + dtKg(rec.kg) + '）　<button class="mini" data-act="dt-edit" data-id="' + esc(rec.id) + '">直す</button></div>';
  }
  if(!w.length){
    h += '<div class="dt-seed">最初の記録は、2026年11月3日に測った <b>58.0kg</b> です。<button class="mini" data-act="dt-seed">この値で記録する</button></div>';
  }
  /* 進み具合 */
  var cur = latest ? Number(latest.kg) : Number(g.startKg);
  var lost = Math.round((Number(g.startKg) - cur) * 10) / 10;
  var goalDiff = Math.round((Number(g.startKg) - Number(g.targetKg)) * 10) / 10;
  var remain = Math.round((cur - Number(g.targetKg)) * 10) / 10;
  var pct = goalDiff > 0 ? Math.max(0, Math.min(100, Math.round(lost / goalDiff * 100))) : 0;
  var exp = dtExpected(), wk = dtWeekAvg(td), wkPrev = dtWeekAvg(shiftDate(td, -7));
  h += '<div class="dt-big"><span class="dt-now">' + dtKg(cur) + '</span><span class="s">目標 ' + dtKg(g.targetKg) + ' まで ' +
    (remain > 0 ? 'あと ' + remain.toFixed(1) + 'kg' : '到達！🎉') + '</span></div>' +
    '<div class="dt-bar"><i style="width:' + pct + '%"></i></div>' +
    '<div class="dt-nums"><span>開始 ' + dtKg(g.startKg) + '（' + ymdLabel(g.startDate) + '）</span><span>' + (lost > 0 ? '−' + lost.toFixed(1) : lost < 0 ? '+' + Math.abs(lost).toFixed(1) : '±0.0') + 'kg / ' + goalDiff.toFixed(1) + 'kg</span><span>目標 ' + dtKg(g.targetKg) + '（' + ymdLabel(g.targetDate) + '）</span></div>' +
    '<p class="note">進み具合 ' + pct + '%。' +
    (exp != null ? '今日のペース目安は ' + dtKg(exp) + ' くらい。' : '') +
    (wk != null ? '直近7日の平均は ' + dtKg(wk) + (wkPrev != null ? '（その前7日は ' + dtKg(wkPrev) + '）' : '') + '。1日の数字より、週の平均で見てね。' : '記録がたまると、週の平均が出ます。') +
    (dtStreak() > 1 ? '記録は ' + dtStreak() + ' 日続いています🔥' : '') + '</p>';
  /* 今日の3つの習慣 */
  var hab = dtHabits()[td] || {};
  h += '<div class="dt-habits"><div class="f">今日の3つ（できたものにチェック）</div>' + DT_HABITS.map(function(x){
    return '<label class="dt-hab"><input type="checkbox" data-act="dt-habit" data-v="' + x[0] + '"' + (hab[x[0]] ? ' checked' : '') + '><span>' + x[1] + '</span></label>';
  }).join('') + '</div>';
  /* 目標の直し */
  if(dtUi.editGoal){
    h += '<div class="dt-form"><div class="grid2">' +
      '<div><label class="f" for="dt_g_start">開始の体重（kg）</label><input type="number" inputmode="decimal" step="0.1" id="dt_g_start" class="dt-gin" data-k="startKg" value="' + esc(g.startKg) + '"></div>' +
      '<div><label class="f" for="dt_g_target">目標の体重（kg）</label><input type="number" inputmode="decimal" step="0.1" id="dt_g_target" class="dt-gin" data-k="targetKg" value="' + esc(g.targetKg) + '"></div></div>' +
      '<div class="grid2"><div><label class="f" for="dt_g_sdate">開始日</label><input type="date" id="dt_g_sdate" class="dt-gin" data-k="startDate" value="' + esc(g.startDate) + '"></div>' +
      '<div><label class="f" for="dt_g_tdate">目標日</label><input type="date" id="dt_g_tdate" class="dt-gin" data-k="targetDate" value="' + esc(g.targetDate) + '"></div></div>' +
      '<div><label class="f" for="dt_g_kcal">1日のカロリー目安（kcal）</label><input type="number" inputmode="numeric" step="50" id="dt_g_kcal" class="dt-gin" data-k="kcal" value="' + esc(g.kcal) + '"></div>' +
      '<div class="pair" style="margin-top:10px"><button class="btn" data-act="dt-goal-save">保存する</button><button class="btn ghost" style="flex:0 0 auto;padding:11px 14px" data-act="dt-goal-cancel">やめる</button></div></div>';
  }else{
    h += '<div class="pillrow" style="margin-top:8px"><button class="mini" data-act="dt-goal-edit">目標を直す</button>' +
      '<button class="mini" data-act="dt-tab" data-v="food">🍵 ' + esc(g.kcal) + 'kcalの食事の目安を見る</button></div>';
  }
  h += '<p class="note">通知：毎朝6:40に「体重を測る」お知らせ、記録が無い日は21:30にもう一度お知らせします（設定 › 通知 がオンのとき）。</p>';
  return section('ダイエットの進み具合', ymdLabel(g.targetDate) + ' 目標', h);
}

/* ランのホーム（今日の30分・今週の合計・記録リスト） */
function dtRunHtml(){
 var td = today(), min = dtRunMin(td), km = dtRunKm(td), rf = dtUi.rf;
 var pct = Math.max(0, Math.min(100, Math.round(min / DT_RUN_GOAL * 100)));
 var h = '';
 if(min >= DT_RUN_GOAL) h += '<div class="dt-ok">🎉 今日のラン ' + min + '分、目標クリア！' + (km ? ' 約' + km + 'km、' : '') + '消費は約' + dtRunKcal(min) + 'kcalの目安だよ。</div>';
 else if(min > 0) h += '<div class="dt-ok">🏃 今日のランは ' + min + '分（あと' + (DT_RUN_GOAL - min) + '分で目標）。消費は約' + dtRunKcal(min) + 'kcalの目安。</div>';
 else h += '<div class="dt-alert"><b>🏃 今日はまだ走っていません</b><div class="s">目標は1日' + DT_RUN_GOAL + '分。最初のうちは、歩きをはさんでもOKだよ。</div></div>';
 h += '<div class="dt-bar"><i style="width:' + pct + '%"></i></div><div class="dt-nums"><span>今日 ' + min + '分</span><span>目標 ' + DT_RUN_GOAL + '分</span></div>';

 if(!rf){
  h += '<div class="row" style="margin-top:10px">';
  if(min < DT_RUN_GOAL) h += '<button type="button" class="btn" data-act="dt-run30">🏃 30分走った</button>';
  h += '<button type="button" class="btn ghost" data-act="dt-run-new">分数を入れて記録</button></div>';
 }else{
  h += '<div class="dt-form"><div class="grid2"><label class="field"><span>日付</span><input type="date" class="dt-rin2" data-k="date" value="' + esc(rf.date) + '"></label>'
   + '<label class="field"><span>走った時間（分）</span><input type="number" class="dt-rin2" data-k="min" inputmode="numeric" min="1" max="600" value="' + esc(rf.min) + '"></label></div>'
   + '<label class="field"><span>距離（km・分かれば）</span><input type="number" class="dt-rin2" data-k="km" inputmode="decimal" step="0.1" min="0" value="' + esc(rf.km) + '"></label>'
   + '<div class="row"><button type="button" class="btn" data-act="dt-run-save">' + (rf.id ? '直す' : '記録する') + '</button>'
   + '<button type="button" class="btn ghost" data-act="dt-run-cancel">やめる</button>'
   + (rf.id ? '<button type="button" class="btn danger" data-act="dt-run-del" data-id="' + esc(rf.id) + '" style="margin-left:auto">消す</button>' : '')
   + '</div></div>';
 }

 /* 直近7日の合計 */
 var tot = 0, days = 0;
 for(var i = 6; i >= 0; i--){ var m2 = dtRunMin(shiftDate(td, -i)); tot += m2; if(m2 > 0) days++; }
 h += '<p class="s" style="margin-top:10px">直近7日：合計 ' + tot + '分・走った日 ' + days + '日' + (dtRunStreak() > 1 ? '・' + dtRunStreak() + '日連続🔥' : '') + '（消費 約' + dtRunKcal(tot) + 'kcalの目安）</p>';

 var steps = ((S.healthLog || {})[td] || {}).steps;
 if(steps) h += '<p class="s">今日の歩数 ' + Number(steps).toLocaleString('ja-JP') + '歩（ヘルスケア連動）</p>';

 var list = dtRuns().slice(-7).reverse();
 if(list.length){
  h += list.map(function(x){
   return '<div class="item"><div class="grow"><div class="t">' + Number(x.min) + '分' + (Number(x.km) > 0 ? '・約' + x.km + 'km' : '') + (x.src === 'health' ? ' <span class="dt-badge">ヘルスケア</span>' : '') + '</div>'
    + '<div class="s">' + ymdLabel(x.date) + (x.date === td ? '（今日）' : '') + '・約' + dtRunKcal(x.min) + 'kcal</div></div>'
    + (x.src === 'health' ? '' : '<button type="button" class="mini" data-act="dt-run-edit" data-id="' + esc(x.id) + '">直す</button>')
    + '</div>';
  }).join('');
 }
 h += '<p class="s" style="margin-top:8px">Apple ヘルスケアの「ワークアウト（ランニング）」は、毎晩まとめて自動で取り込みます。iPhoneかApple Watchでワークアウトを開始して走ると、記録し忘れても翌日には入っています。</p>';
 return section('今日のラン', '目標 ' + DT_RUN_GOAL + '分／日', h);
}

/* ============================== 記録 ============================== */
function dtLogHtml(){
  var w = dtWeights().slice().reverse(), f = dtUi.f;
  var h = '';
  if(f){
    h += '<div class="dt-form"><div class="grid2">' +
      '<div><label class="f" for="dt_f_date">日付</label><input type="date" id="dt_f_date" class="dt-in2" data-k="date" value="' + esc(f.date) + '"></div>' +
      '<div><label class="f" for="dt_f_kg">体重（kg）</label><input type="number" inputmode="decimal" step="0.1" min="30" max="200" id="dt_f_kg" class="dt-in2" data-k="kg" value="' + esc(f.kg) + '"></div></div>' +
      '<div class="pair" style="margin-top:10px"><button class="btn" data-act="dt-save">保存する</button><button class="btn ghost" style="flex:0 0 auto;padding:11px 14px" data-act="dt-cancel">やめる</button></div>' +
      (f.id ? '<button class="mini" style="margin-top:8px" data-act="dt-del" data-id="' + esc(f.id) + '">この記録を消す</button>' : '') + '</div>';
  }else{
    h += '<button class="mini" data-act="dt-new">＋ 体重を記録する</button>';
  }
  if(w.length){
    /* かんたんな棒グラフ（直近14件） */
    var last = dtWeights().slice(-14), vals = last.map(function(x){ return Number(x.kg); });
    var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
    if(mx - mn < 2){ mx += 1; mn -= 1; }
    h += '<div class="dt-chart">' + last.map(function(x){
      var hh = Math.round(14 + (Number(x.kg) - mn) / (mx - mn) * 66);
      return '<div class="dt-col"><span class="dt-cv">' + Number(x.kg).toFixed(1) + '</span><i style="height:' + hh + 'px"></i><span class="dt-cd">' + esc(x.date.slice(5).replace('-', '/')) + '</span></div>';
    }).join('') + '</div>';
    h += w.map(function(x){
      return '<div class="row" data-act="dt-edit" data-id="' + esc(x.id) + '" role="button" style="cursor:pointer"><div class="grow"><div class="t">' + dtKg(x.kg) + '</div>' +
        '<div class="s">' + ymdLabel(x.date) + (x.date === today() ? '（今日）' : '') + '</div></div><span class="s2">›</span></div>';
    }).join('');
  }else if(!f){
    h += '<div class="empty">まだ記録がありません。測ったら、その日のうちに入れてね。</div>';
  }
  return section('体重の記録', w.length ? w.length + '件' : null, h);
}

/* ============================== 食事の目安 ============================== */
function dtFoodHtml(){
  var g = dtGoal(), k = toNum(g.kcal) || 1600;
  var h = '<p>1日 <b>' + k + 'kcal</b> は、だいたいこんな配分です。毎食数えなくてOK。「いつもの量から少しだけ減っているか」の目安に使ってね。</p>' +
    '<table class="dt-tbl"><tbody>' +
    '<tr><th>朝（約350kcal）</th><td>ご飯軽く1杯＋卵＋味噌汁／食パン1枚＋ヨーグルト＋バナナ など。抜くと昼に反動が来やすいので、軽くでも入れる。</td></tr>' +
    '<tr><th>昼（約550kcal）</th><td>定食なら：ご飯ふつう盛り＋魚か肉のおかず＋味噌汁＋小鉢。これでだいたい550〜650kcal。</td></tr>' +
    '<tr><th>夜（約600kcal）</th><td>家ごはんの内容はそのままでOK。ご飯は茶碗に軽く1杯（約150g）、おかわりをしない、揚げ物は量を半分くらい意識。</td></tr>' +
    '<tr><th>おやつ（約100kcal）</th><td>1日1回までを目安に。小さいチョコ数個、ヨーグルト、果物など。甘いラテはおやつ枠で数える。</td></tr>' +
    '</tbody></table>' +
    '<div class="f" style="margin-top:12px">コンビニの組み合わせ（例）</div>' +
    '<p class="note" style="margin-top:2px">おにぎり1〜2個（約180kcal×個数）＋サラダチキン（約120kcal）＋味噌汁かサラダ＋無糖のお茶 → 約500〜650kcalで、お腹も持ちます。菓子パン＋甘いカフェラテは約600〜800kcalで、すぐお腹が空きやすい組み合わせです。</p>' +
    '<div class="f" style="margin-top:12px">🍵 抹茶の話</div>' +
    '<p class="note" style="margin-top:2px">コンビニの抹茶ラテ（例：ローソン「ミルクたっぷり抹茶ラテ」240ml）は約164kcal。砂糖とミルクの分です。無糖の抹茶（お湯で溶く粉末）は1杯 約7kcal、ペットボトルの無糖の抹茶入り緑茶は 0kcal。味はかなり違って、甘さが無く、香りとほろ苦さが前に出ます。いきなり無糖がきつければ、無糖抹茶＋牛乳200ml（約130kcal）に砂糖小さじ1（約12kcal）から始めて、少しずつ砂糖を減らすと慣れます。</p>' +
    '<div class="f" style="margin-top:12px">続けるコツ</div>' +
    '<p class="note" style="margin-top:2px">・体重は週の平均で見る（1日で0.5〜1kgは水で動きます）<br>・2週間の平均が動かなければ、100〜150kcal分だけ調整する<br>・睡眠不足は食欲を増やします。夜更かしを減らすのもダイエットのうちです</p>';
  return section('食事の目安', k + 'kcal／日', h);
}

/* ============================== 画面 ============================== */
function dtView(){
  var h = '<div class="pillrow dt-nav">' + DT_TABS.map(function(t){
    return '<button data-act="dt-tab" data-v="' + t[0] + '" class="' + (dtUi.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
  }).join('') + '</div>';
  if(dtUi.tab === 'log') return h + dtLogHtml();
 if(dtUi.tab === 'home') return h + dtHomeHtml() + dtRunHtml();
  if(dtUi.tab === 'food') return h + dtFoodHtml();
  return h + dtHomeHtml();
}
kmView('diet', dtView);

/* 「今日 › くらし」に、測り忘れ防止のカードを出す */
kmPart('life', 'dtWeigh', '体重の記録', function(){
  var rec = dtTodayRec(), latest = dtLatest();
  if(rec) return '<div class="dt-ok">✅ 今日の体重は記録ずみ（' + dtKg(rec.kg) + '）</div>';
  return '<div class="dt-alert"><b>⚖️ 今日はまだ体重の記録がありません</b><div class="s">' +
    (latest ? '直近の記録は ' + ymdLabel(latest.date) + ' の ' + dtKg(latest.kg) + '。' : '') +
    '測ったらダイエットタブに記録してね。</div><div class="pillrow" style="margin-top:6px"><button class="mini" data-act="dt-open">ダイエットタブを開く</button></div></div>';
});

/* 通知：朝の計量リマインド＋夜の記録もれ */
kmJobs(function(add, prefs, now){
  for(var i = 0; i < 7; i++){
    var d = shiftDate(today(), i);
    add('diet-weigh-' + d, new Date(d.split('-')[0], d.split('-')[1] - 1, d.split('-')[2], 6, 40).getTime(),
      '⚖️ 体重を測る時間だよ', 'トイレのあと・朝ごはん前に測って、ダイエットタブに記録してね。', { cat:'info' });
  }
  if(!dtTodayRec()){
    var t = today().split('-');
    add('diet-miss-' + today(), new Date(t[0], t[1] - 1, t[2], 21, 30).getTime(),
      '⚖️ 今日の体重、まだ記録がありません', '寝る前に測って記録しておくと、明日の朝が楽だよ。', { cat:'info' });
  }
});

/* ============================== 操作 ============================== */
kmAction(function(act, t){
  if(act.indexOf('dt-') !== 0) return false;
  var v = t.dataset ? t.dataset.v : '', id = t.dataset ? t.dataset.id : '';
  switch(act){
    case 'dt-open': appId = 'diet'; dtUi.tab = 'home'; render(); window.scrollTo(0, 0); return true;
    case 'dt-tab': dtUi.tab = v || 'home'; dtUi.f = null; render(); window.scrollTo(0, 0); return true;
    case 'dt-seed': dtPutWeight('2026-11-03', 58); toast('58.0kgで記録しました'); commit(); return true;
    case 'dt-quick-save': {
      var inp = document.getElementById('dt_quick_kg');
      var kg = inp ? parseFloat(inp.value) : NaN;
      if(!(kg >= 30 && kg <= 200)){ toast('体重を入れてください（例：57.8）', true); return true; }
      dtPutWeight(today(), kg); toast('記録しました'); commit(); return true;
    }
    case 'dt-habit': {
      var td = today(), all = dtHabits(), cur = Object.assign({}, all[td] || {});
      cur[v] = cur[v] ? 0 : 1;
      dtHabitSave(td, cur); commit(); return true;
    }
    case 'dt-goal-edit': dtUi.editGoal = true; dtUi.goalDraft = dtGoal(); render(); return true;
    case 'dt-goal-cancel': dtUi.editGoal = false; render(); return true;
    case 'dt-goal-save': {
      var d = dtUi.goalDraft || dtGoal();
      var sk = parseFloat(d.startKg), tk = parseFloat(d.targetKg), kc = toNum(d.kcal);
      if(!(sk >= 30 && sk <= 200) || !(tk >= 30 && tk <= 200)){ toast('体重の数字を確認してください', true); return true; }
      if(!isYmd(d.startDate) || !isYmd(d.targetDate)){ toast('日付を確認してください', true); return true; }
      dtGoalSave({ startKg:Math.round(sk * 10) / 10, startDate:d.startDate, targetKg:Math.round(tk * 10) / 10, targetDate:d.targetDate, kcal:kc >= 800 && kc <= 4000 ? kc : 1600 });
      dtUi.editGoal = false; toast('目標を保存しました'); commit(); return true;
    }
    case 'dt-run30': {
  var td3 = today(), need = DT_RUN_GOAL - dtRunMin(td3);
  if(need > 0){ var man = dtManualRun(td3); dtPutRun(td3, (man ? Number(man.min) : 0) + need, man ? man.km : ''); }
  toast('30分で記録しました'); commit(); return true;
 }
 case 'dt-run-new': dtUi.rf = { id:'', date:today(), min:'30', km:'' }; render(); return true;
 case 'dt-run-edit': {
  var rrec = (S.kmItems || []).filter(function(x){ return x && x.id === id; })[0]; if(!rrec) return true;
  dtUi.rf = { id:rrec.id, date:rrec.date, min:String(rrec.min), km:rrec.km ? String(rrec.km) : '' }; render(); return true;
 }
 case 'dt-run-cancel': dtUi.rf = null; render(); return true;
 case 'dt-run-save': {
  var rf2 = dtUi.rf; if(!rf2) return true;
  var mn = parseInt(rf2.min, 10);
  if(!isYmd(rf2.date)){ toast('日付を確認してください', true); return true; }
  if(!(mn >= 1 && mn <= 600)){ toast('分数を入れてください', true); return true; }
  dtPutRun(rf2.date, mn, rf2.km, rf2.id || '');
  dtUi.rf = null; toast('記録しました'); commit(); return true;
 }
 case 'dt-run-del': if(!confirm('この記録を消しますか？')) return true;
  removeItem('kmItems', id); dtUi.rf = null; toast('消しました'); commit(); return true;

 case 'dt-new': dtUi.f = { id:'', date:today(), kg:'' }; render(); return true;
    case 'dt-edit': {
      var rec = (S.kmItems || []).filter(function(x){ return x && x.id === id; })[0]; if(!rec) return true;
      dtUi.tab = 'log'; dtUi.f = { id:rec.id, date:rec.date, kg:rec.kg }; render(); return true;
    }
    case 'dt-cancel': dtUi.f = null; render(); return true;
    case 'dt-save': {
      var f = dtUi.f; if(!f) return true;
      var kg2 = parseFloat(f.kg);
      if(!isYmd(f.date)){ toast('日付を入れてください', true); return true; }
      if(!(kg2 >= 30 && kg2 <= 200)){ toast('体重を入れてください（例：57.8）', true); return true; }
      dtPutWeight(f.date, kg2, f.id || ''); dtUi.f = null; toast('保存しました'); commit(); return true;
    }
    case 'dt-del':
      if(!confirm('この記録を消しますか？')) return true;
      removeItem('kmItems', id); dtUi.f = null; toast('消しました'); commit(); return true;
  }
  return false;
});
/* 打っている字を覚えておく（描き直しても消えないように） */
document.addEventListener('input', function(e){
  var t = e.target;
  if(!t || !t.classList) return;
  if(t.classList.contains('dt-in2') && dtUi.f) dtUi.f[t.dataset.k] = t.value;
  if(t.classList.contains('dt-rin2') && dtUi.rf) dtUi.rf[t.dataset.k] = t.value;
  if(t.classList.contains('dt-gin')){ dtUi.goalDraft = dtUi.goalDraft || dtGoal(); dtUi.goalDraft[t.dataset.k] = t.value; }
});
document.addEventListener('change', function(e){
  var t = e.target;
  if(t && t.classList && t.classList.contains('dt-in') && t.dataset && t.dataset.act === 'dt-habit') return;
});

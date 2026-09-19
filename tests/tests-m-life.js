/* くらしの手帳：生活・健康・AIの便利機能 のテスト（KT.test で足す） */
(function(){
'use strict';
var ok = KT.ok, eq = KT.eq, J = KT.J;
var snapAnswer = null;            /* 「撮って登録」のにせAIの答え（テストごとに変える） */
function A0(){ return KT.frames().A; }
function sd(n){ var A = A0(); return A.shiftDate(A.today(), n); }

/* ===== にせAI ===== */
KT.ai.push(function(req){
  if(req.tag === 'lf-plan') return 'すきま時間の作戦：昼休みに暗記、夜は課題を30分';
  if(req.tag === 'lf-voice') return JSON.stringify({ items:[
    { type:'event', title:'歯医者', date:sd(1), time:'10:00', end:'', important:false },
    { type:'task', title:'レポート', date:sd(3), time:'', subject:'' },
    { type:'spend', amount:580, title:'コンビニ', date:'', category:'food' },
    { type:'event', title:'日付のないもの', date:'' }
  ] });
  if(req.tag === 'lf-vax') return JSON.stringify({ items:[
    { kind:'vaccine', item:'mr', name:'MRワクチン', date:'2008-04-10', dose:2, result:'', ok:null, place:'さくら医院' },
    { kind:'antibody', item:'varicella', name:'水痘 抗体', date:sd(-100), dose:0, result:'EIA 10.2', ok:1, place:'保健センター' }
  ] });
  if(req.tag === 'lf-snap') return JSON.stringify(snapAnswer || { kind:'other', items:[] });
  return null;
});

/* ===== にせAPI（Open-Meteo・環境省の暑さ指数・熱中症警戒アラート） ===== */
function ymd8(d){ return d.replace(/-/g, ''); }
KT.api.push(function(url){
  var A = A0();
  if(/api\.open-meteo\.com/.test(url) && /past_days=1/.test(url)){
    return { daily:{ time:[sd(-1), sd(0), sd(1), sd(2)], temperature_2m_max:[28, 20, 22, 23], temperature_2m_min:[18, 12, 15, 16],
      weather_code:[1, 0, 61, 1], wind_speed_10m_max:[10, 25, 10, 10], precipitation_sum:[0, 0, 5, 0] } };
  }
  var m = url.match(/wbgt\.env\.go\.jp\/prev15WG\/dl\/yohou_(\d+)\.csv/);
  if(m){
    var t = ymd8(sd(0)), u = ymd8(sd(1));
    var v = m[1] === '63411' ? [' 250', ' 290', ' 285', ' 200', ' 315'] : [' 240', ' 280', ' 270', ' 190', ' 300'];
    return ',,' + t + '09,' + t + '12,' + t + '15,' + t + '24,' + u + '12\n' + m[1] + ',2026/09/19 17:25,' + v.join(',') + '\n';
  }
  if(/wbgt\.env\.go\.jp\/alert\/dl\//.test(url)){
    var sl = function(d){ return d.replace(/-/g, '/'); };
    return 'Title,熱中症特別警戒情報・熱中症警戒情報,,,\nEncoding,UTF-8,,,\nReportDate,' + sl(sd(0)) + ',,\nReportTime,17:00:00,,\n' +
      'TargetDate1,' + sl(sd(0)) + ',,\nTargetDate2,' + sl(sd(1)) + ',,\n' +
      '府県予報区,都府県・振興局表示番号,都府県・振興局表示番号サブ,府県予報区等コード,都道府県名,都道府県コード,TargetDate1フラグ,TargetDate2フラグ,a,b,c\n' +
      '大阪府,62,0,270000,大阪,27,1,1,x,y,z\n兵庫県,63,0,280000,兵庫,28,0,1,三田:29/神戸:28,x,y\n';
  }
  return null;
});
async function tinyPng(A){
  var c = A.document.createElement('canvas'); c.width = 40; c.height = 30;
  var ctx = c.getContext('2d'); ctx.fillStyle = '#fde'; ctx.fillRect(0, 0, 40, 30); ctx.fillStyle = '#333'; ctx.fillRect(5, 5, 20, 10);
  return c.toDataURL('image/png');
}
function lifeClear(w){
  try{ w.localStorage.removeItem(w.KEY + ':life'); }catch(e){}
  (w.S.kmItems || []).filter(function(x){ return x.mod === 'life'; }).forEach(function(x){ w.removeItem('kmItems', x.id); });
}

KT.test('生活＋：睡眠と歩数（手で入れる・グラフ・寝不足のひとこと・受け取り箱・相手に届く）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document, td = A.today();
  KT.freshWrites([A, B]);
  A.appId = 'today'; A.todayTab = 'life'; A.render();
  ok(doc.getElementById('lf-sec-body'), 'くらしに「睡眠と歩数」が出る');
  doc.querySelector('[data-act="lf-log-form"]').click();
  doc.getElementById('lf_ld').value = td;
  doc.getElementById('lf_lbed').value = '23:30';
  doc.getElementById('lf_lwake').value = '06:40';
  doc.getElementById('lf_lst').value = '6,543';
  doc.querySelector('[data-act="lf-log-save"]').click();
  eq(A.S.healthLog[td].sleep, 430, '寝た・起きた時刻から睡眠時間（分）');
  eq(A.S.healthLog[td].steps, 6543, '歩数');
  ok(!doc.getElementById('lf_ld'), '保存したら入力の枠がとじる');
  ok(doc.querySelectorAll('#lf-sec-body .lf-chart').length === 2, '睡眠と歩数のグラフ');
  /* おやすみ・おはよう */
  A.lfGoodnight();
  var bk = A.lfBedKey();
  ok(/^\d{2}:\d{2}$/.test(A.S.healthLog[bk].bed), 'おやすみで寝た時刻');
  /* 寝不足が3日続く */
  [-1, -2].forEach(function(n){ A.lfLogSet(A.shiftDate(td, n), { sleep:300, src:'hand' }); });
  A.lfLogSet(td, { bed:'01:30', wake:'06:30', sleep:300 });
  eq(A.lfShortStreak(), 3, '寝不足が続いた日数');
  A.render();
  ok(/寝不足の日が3日/.test(doc.getElementById('lf-sec-body').textContent), '寝不足のひとこと');
  var st = A.lfHealthStats(14);
  ok(st.sleepN >= 3 && st.sleepAvg > 0, '14日の平均');
  /* ヘルスケアから（受け取り箱）：時間で来ても分に直す・歩数のカンマ */
  var y = A.shiftDate(td, -3);
  var msg = A.inboxApply(J(A, { kind:'health', date:y, sleep:'7.5', steps:'8,123', at:Date.now() }));
  ok(/ヘルスケア/.test(msg), '知らせる文：' + msg);
  eq(A.S.healthLog[y].sleep, 450, '睡眠（時間→分）');
  eq(A.S.healthLog[y].steps, 8123, '歩数');
  eq(A.S.healthLog[y].src, 'health', 'ヘルスケアから');
  /* 橋わたしの受け取り箱から取りこむ */
  A.GAS.url = 'https://script.google.com/macros/s/test/exec'; A.GAS.token = 'tok'; A.saveGas();
  var y2 = A.shiftDate(td, -4);
  KT.gasState.inbox = [{ id:'inlf1', kind:'health', date:y2, sleep:420, steps:5000, at:Date.now() }];
  await A.inboxPull(true);
  eq(A.S.healthLog[y2].steps, 5000, '受け取り箱から歩数');
  A.GAS.url = ''; A.GAS.token = ''; A.saveGas();
  /* AIの道具で書く・読む */
  var y3 = A.shiftDate(td, -5);
  var r = A.aiRunFunc({ name:'record_sleep', args:J(A, { date:y3, bed:'00:30', wake:'07:00', steps:4000 }) });
  ok(/記録しました/.test(r.result), 'record_sleep');
  eq(A.S.healthLog[y3].sleep, 390, 'AIで記録した睡眠');
  ok(A.chatIsWrite('record_sleep'), '書きこむ道具として登録');
  ok(A.chatFuncDecls().some(function(f){ return f.name === 'record_sleep'; }), '直接登録オンのとき道具に入る');
  var hd = A.aiSectionData('health');
  ok(hd.lfSleep && hd.lfSleep.days.some(function(x){ return x.date === y && x.steps === 8123; }), 'AIが健康の分野で読める');
  ok(A.buildSummary().life && A.buildSummary().life.sleep, 'ウィジェットのまとめに睡眠');
  A.commit();
  await KT.settle([A, B]);
  eq(B.S.healthLog[td].sleep, 300, '相手に届く');
  /* 消す（表は「消した印」で相手でも消える） */
  A.lfLogDel(y3); A.commit();
  ok(!A.lfLog(y3), '消した');
  await KT.settle([A, B]);
  ok(!B.lfLog(y3), '相手でも消える');
  [td, bk, A.shiftDate(td, -1), A.shiftDate(td, -2), y, y2].forEach(function(d){ A.lfLogDel(d); });
  A.commit();
  await KT.settle([A, B]);
});

KT.test('生活＋：周期の記録（この端末だけ・予想・言い方・通知・カレンダー・AIに見せない・同期に切りかえ）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document, td = A.today();
  lifeClear(A); A.commit(); await KT.settle([A, B]);
  A.lfSet({ periodSync:0, periodAi:1, periodNotify:1, periodLead:2, periodWord:'custom', periodCustom:'📌 じゅんび', periodCal:1 });
  [-80, -52, -24].forEach(function(n){ var s = A.shiftDate(td, n); A.lfPeriodPut(J(A, { start:s, end:A.shiftDate(s, 4), flow:2, pain:1 })); });
  A.commit();
  eq(A.lfPeriods().length, 3, '3回ぶん');
  ok(!(A.S.kmItems || []).some(function(x){ return x.mod === 'life'; }), 'はじめは同期に入れない');
  ok((A.localStorage.getItem(A.KEY + ':life') || '').indexOf(A.shiftDate(td, -24)) >= 0, 'この端末だけに保存');
  var st = A.lfPeriodStats();
  eq(st.avg, 28, '平均の周期');
  eq(st.plen, 5, '平均の日数');
  eq(st.next, A.shiftDate(td, 4), '次の予定日');
  eq(st.ovu, A.shiftDate(td, -10), '排卵の目安（予定日の14日前）');
  A.appId = 'today'; A.todayTab = 'life'; A.render();
  var sec = doc.getElementById('lf-sec-period');
  ok(sec && /じゅんびの記録/.test(sec.textContent) && /あと4日/.test(sec.textContent), '自分で決めた言い方で出る');
  ok(/目安/.test(sec.textContent) && /婦人科/.test(sec.textContent), '目安であることと相談先');
  /* 手で直す（量・痛み） */
  var last = A.lfPeriods()[2];
  doc.querySelector('[data-act="lf-p-edit"][data-id="' + last.id + '"]').click();
  doc.querySelector('[data-act="lf-p-pain"][data-v="2"]').click();
  doc.getElementById('lf_pm').value = '頭痛';
  doc.querySelector('[data-act="lf-p-save"]').click();
  var ed = A.lfPeriods().filter(function(x){ return x.id === last.id; })[0];
  ok(ed.pain === 2 && ed.memo === '頭痛', '直した中身');
  /* 通知（人に見られても分からない言い方） */
  A.notifySet({ push:1, quiet:0, dlTime:'20:00' });
  var jobs = A.notifyJobs(), j = jobs.filter(function(x){ return x.id === 'lf-pd-' + st.next; })[0];
  ok(j && j.title === '📌 じゅんび' && !/生理/.test(j.title + j.body), '予定日の前の通知（ことばを選べる）');
  eq(A.toYmd(new Date(j.at)), A.shiftDate(td, 2), '2日前に知らせる');
  /* カレンダーの印 */
  A.appId = 'cal'; A.calTab = 'cal'; A.calYm = st.next.slice(0, 7); A.render();
  ok(doc.querySelector('#lf-sec-cycle .lf-cd.pred'), '予定タブのカレンダーの下に予想の印');
  /* 今日のページ */
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(/じゅんびまで あと4日/.test((doc.getElementById('lf-sec-bodytoday') || {}).textContent || ''), '今日に小さく');
  /* AI */
  var hd = A.aiSectionData('health');
  eq(hd.lfPeriod.nextStart, st.next, 'AIが予想を読める');
  A.lfSet({ periodAi:0 });
  hd = A.aiSectionData('health');
  ok(hd.lfPeriod.hidden && !hd.lfPeriod.nextStart, '「AIに見せない」なら出さない');
  ok(/AIからは記録できません/.test(A.aiRunFunc({ name:'record_period', args:J(A, { start:td }) }).result), '見せない設定なら道具も使わない');
  A.lfSet({ periodAi:1 });
  /* 同期に切りかえ → 読めない形で相手に届く */
  var moved = A.lfPeriodSyncSet(1);
  eq(moved, 3, '同期へ移した数');
  var mine = A.S.kmItems.filter(function(x){ return x.mod === 'life' && x.type === 'period'; });
  eq(mine.length, 3, '汎用の置き場に入る');
  ok(JSON.stringify(mine).indexOf(A.shiftDate(td, -24)) < 0 && mine.every(function(x){ return /^b2:/.test(x.enc); }), '中身は読めない形');
  eq((JSON.parse(A.localStorage.getItem(A.KEY + ':life')).period || []).length, 0, 'この端末だけの記録は空に');
  ok(A.aiSearchAll('頭痛').count === 0, '手帳ぜんぶの検索にも出ない');
  await KT.settle([A, B]);
  eq(B.lfPeriods().length, 3, '相手の端末でも見られる');
  eq(B.lfPeriodStats().next, st.next, '相手でも同じ予想');
  /* AIの道具で記録（同期中なので相手にも） */
  var r = A.aiRunFunc({ name:'record_period', args:J(A, { start:A.shiftDate(td, -1), flow:'多い' }) });
  ok(/記録しました/.test(r.result), 'record_period');
  eq(A.lfPeriods().length, 4, '4回ぶん');
  ok(A.lfPeriodStats().ongoing, 'いま何日目');
  /* 同期をやめる → この端末だけに残り、相手からは消える */
  A.lfPeriodSyncSet(0);
  eq(A.lfPeriods().length, 4, 'この端末には残る');
  ok(!A.S.kmItems.some(function(x){ return x.mod === 'life'; }), '同期からは外す');
  await KT.settle([A, B]);
  eq(B.lfPeriods().length, 0, '相手からは消える');
  /* あとかたづけ */
  lifeClear(A);
  A.lfSet({ periodNotify:0, periodWord:'plain', periodCustom:'' });
  A.commit();
  await KT.settle([A, B]);
});

KT.test('生活＋：周期の同期（AIが戻せない形・前の形も読める・同期をやめて、また同期しても消えない）', async function(){
  var A = KT.frames().A, B = KT.frames().B, td = A.today();
  lifeClear(A); A.commit(); await KT.settle([A, B]);
  A.lfSet({ periodSync:0, periodAi:0 });
  [-60, -30].forEach(function(n){ A.lfPeriodPut(J(A, { start:A.shiftDate(td, n), end:A.shiftDate(td, n + 4), memo:'lfひみつのメモ' })); });
  eq(A.lfPeriodSyncSet(1), 2, '同期へ移す');
  var mine = A.S.kmItems.filter(function(x){ return x.mod === 'life' && x.type === 'period'; });
  ok(mine.length === 2 && mine.every(function(x){ return /^b2:/.test(x.enc); }), '新しい形（b2）で置く');
  ok(mine.every(function(x){ var raw = ''; try{ raw = A.atob(x.enc.slice(3)); }catch(e){} return raw.indexOf('start') < 0 && raw.indexOf(A.shiftDate(td, -30)) < 0; }),
    'base64 を戻しただけでは読めない');
  var more = JSON.stringify(A.aiSectionData('more'));
  ok(more.indexOf(A.shiftDate(td, -30)) < 0 && more.indexOf('lfひみつ') < 0, '「AIに見せない」のとき、手帳全体を読む道具でも中身が出ない');
  ok(A.aiSectionData('health').lfPeriod.hidden, 'AIの数字も出さない');
  /* 前の形（b1）も読めて、新しい形に置きかえる */
  A.S.kmItems.push(J(A, { id:'lfp_old1', mt:Date.now(), mod:'life', type:'period', enc:'b1:' + A.btoa('{"start":"' + A.shiftDate(td, -90) + '"}') }));
  eq(A.lfPeriods().length, 3, '前の形も読める');
  eq(A.lfPeriodReenc(), 1, '前の形を置きかえる');
  ok(/^b2:/.test(A.S.kmItems.filter(function(x){ return x.id === 'lfp_old1'; })[0].enc), '置きかえた形');
  eq(A.lfPeriods()[0].start, A.shiftDate(td, -90), '置きかえても同じ中身');
  A.commit();
  await KT.settle([A, B]);
  eq(B.lfPeriods().length, 3, '相手に届く');
  /* 同期をやめる → また同期する（前に消した印が残っていても、消えない） */
  A.lfPeriodSyncSet(0);
  await KT.settle([A, B]);
  eq(B.lfPeriods().length, 0, '同期をやめると相手からは消える');
  eq(A.lfPeriodSyncSet(1), 3, 'もう一度同期へ');
  await KT.settle([A, B]);
  eq(A.lfPeriods().length, 3, 'もう一度同期しても、この端末で消えない');
  eq(B.lfPeriods().length, 3, '相手にもまた届く');
  ok(A.lfPeriods().every(function(p){ return p.where === 'sync'; }), '同期の置き場に入っている');
  /* あとかたづけ */
  lifeClear(A);
  A.lfSet({ periodSync:0, periodAi:1 });
  A.commit();
  await KT.settle([A, B]);
});

KT.test('生活＋：おやすみ・おはようの日付（起きたあとの昼寝で今日の睡眠を消さない）・ヘルスケアのいろいろな書き方', async function(){
  var A = KT.frames().A, B = KT.frames().B, td = A.today(), tm = A.shiftDate(td, 1);
  A.lfLogDel(td); A.lfLogDel(tm);
  /* 今日もう起きた記録があれば、おやすみは次の日（起きる日）の記録にする */
  A.lfLogSet(td, { bed:'23:00', wake:'00:00', sleep:420, src:'hand' });
  eq(A.lfBedKey(), tm, '今日もう起きていたら、おやすみは明日の記録');
  A.lfGoodnight();
  eq(A.S.healthLog[td].sleep, 420, 'おやすみを押しても今日の睡眠は消えない');
  ok(A.lfLog(tm) && /^\d{2}:\d{2}$/.test(A.lfLog(tm).bed), '明日の記録に寝た時刻');
  /* そのあと起きた（昼寝）→ 今日の睡眠はそのまま、明日の寝た時刻は消す */
  A.lfLogSet(tm, { bed:A.hhmmOf(A.lfNowMin() - 60), wake:'' });
  A.lfGoodmorning();
  eq(A.S.healthLog[td].wake, '00:00', '起きた時刻は変えない');
  eq(A.S.healthLog[td].sleep, 420, '睡眠時間も変えない');
  ok(!A.lfLog(tm).bed, '昼寝の寝た時刻は消す');
  /* ふつうの朝：寝た時刻があって起きた時刻がない */
  A.lfLogDel(tm);
  A.lfLogSet(td, { bed:A.hhmmOf(A.lfNowMin() - 400), wake:'', sleep:'' });
  A.lfGoodmorning();
  ok(Math.abs(A.S.healthLog[td].sleep - 400) <= 1, 'ふつうの朝は、寝た時刻から計算：' + A.S.healthLog[td].sleep);
  /* ヘルスケア（ショートカット）の書き方 */
  var y = A.shiftDate(td, -6);
  [['7時間30分', 450], ['7:30', 450], ['7:30:00', 450], ['7 hr 30 min', 450], ['450', 450], ['7.5', 450], ['27000', 450], ['6h15m', 375]].forEach(function(c){
    A.inboxApply(J(A, { kind:'health', date:y, sleep:c[0], at:Date.now() }));
    eq(A.S.healthLog[y].sleep, c[1], 'ヘルスケアの睡眠「' + c[0] + '」');
  });
  A.inboxApply(J(A, { kind:'health', date:y.replace(/-/g, '/'), steps:'5,200歩', at:Date.now() }));
  eq(A.S.healthLog[y].steps, 5200, '日付が / でも・歩数に「歩」がついていても');
  [td, tm, y].forEach(function(d){ A.lfLogDel(d); });
  A.commit();
  await KT.settle([A, B]);
});

KT.test('生活＋：予防接種・健診（チェック表・手入力・証明書の写真をAIで読む・検索・相手に届く）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  A.S.vaccines = J(A, []); A.commit();
  A.appId = 'today'; A.todayTab = 'life'; A.render();
  var sec = doc.getElementById('lf-sec-vax');
  ok(sec && /大学の指示を優先/.test(sec.textContent), '大学の指示を優先と書く');
  eq(A.lfVaxStatus().filter(function(x){ return x.st === 'ok'; }).length, 0, 'はじめはそろっていない');
  /* チェック表の「記録」から */
  doc.querySelector('[data-act="lf-x-form"][data-item="hepb"]').click();
  doc.getElementById('lf_xdate').value = A.shiftDate(A.today(), -30);
  doc.getElementById('lf_xdose').value = '1';
  doc.getElementById('lf_xnext').value = A.shiftDate(A.today(), 5);
  doc.querySelector('[data-act="lf-x-save"]').click();
  eq(A.S.vaccines.length, 1, '1件');
  eq(A.S.vaccines[0].name, 'B型肝炎', '名前が空なら項目の名前');
  var hb = A.lfVaxStatus().filter(function(x){ return x.id === 'hepb'; })[0];
  ok(hb.st === 'part' && /あと2回/.test(hb.msg), 'B型肝炎はあと2回：' + hb.msg);
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  ok(/B型肝炎の予定/.test((doc.getElementById('lf-sec-bodytoday') || {}).textContent || ''), '次の予定日が今日のページに');
  /* 証明書の写真 → AI → えらんで入れる */
  A.appId = 'today'; A.todayTab = 'life'; A.render();
  await A.lfVaxScanData(await tinyPng(A));
  eq(A.lfUi.xScan.list.length, 2, '読み取った記録');
  A.render();
  doc.querySelector('[data-act="lf-x-scan-add"]').click();
  doc.querySelector('[data-act="lf-x-scan-add"]').click();      /* 写真の保存を待つ間に、もう一度押す */
  await KT.until(function(){ return A.S.vaccines.length === 3; }, 5000, '写真から入る');
  await new Promise(function(r){ setTimeout(r, 300); });
  eq(A.S.vaccines.length, 3, '2回押しても二重に入らない');
  ok(A.S.vaccines.slice(1).every(function(x){ return x.photos.length === 1; }), '証明書の写真がつく');
  var stt = {}; A.lfVaxStatus().forEach(function(x){ stt[x.id] = x.st; });
  ok(stt.measles === 'ok' && stt.rubella === 'ok', 'MRワクチン2回で麻しん・風しんがそろう');
  eq(stt.varicella, 'ok', '水痘は抗体あり');
  eq(stt.mumps, 'none', 'おたふくは記録なし');
  /* 全体の検索・AI */
  var hits = [];
  A.KM.search.forEach(function(fn){ hits = hits.concat(fn('水痘') || []); });
  ok(hits.some(function(h){ return h.act === 'lf-open' && /水痘/.test(h.title); }), '全体の検索に出る');
  var hd = A.aiSectionData('health');
  ok(hd.lfVax && hd.lfVax.checklist.some(function(x){ return /B型肝炎/.test(x.item) && x.status === 'あと少し'; }), 'AIがチェック表を読める');
  var r = A.aiRunFunc({ name:'add_vaccine', args:J(A, { kind:'vaccine', item:'flu', name:'インフルエンザ', date:A.today() }) });
  ok(r.op && r.op.list === 'vaccines', 'AIの道具で記録（取り消せる形）');
  eq(A.lfVaxStatus().filter(function(x){ return x.id === 'flu'; })[0].st, 'ok', 'インフルエンザ今シーズン');
  A.aiUndoOps([r.op]);
  eq(A.S.vaccines.length, 3, '取り消せる');
  A.commit();
  await KT.settle([A, B]);
  eq(B.S.vaccines.length, 3, '相手に届く');
});

KT.test('生活＋：寒暖差・花粉・暑さ指数・熱中症警戒アラート（今日・明日・朝の通知）', async function(){
  var A = KT.frames().A, doc = A.document, td = A.today(), tm = A.shiftDate(td, 1);
  A.LF.forceSeason = 1;
  A.lfSet({ wx:1, wbgt:1, wbgtNotify:1, diffPrev:7, diffDay:10 });
  await A.lfWxLoad(true);
  var wb = A.lfWbgtFor(td);
  ok(wb && wb.max === 29 && wb.word === '厳重警戒', '今日の暑さ指数（三田の最高）：' + JSON.stringify(wb));
  var wb2 = A.lfWbgtFor(tm);
  ok(wb2 && wb2.alert === 1 && wb2.max === 31.5, '明日は熱中症警戒アラート（兵庫県）');
  var t = A.lfTempDiff(td);
  ok(t && t.warnPrev && t.dPrev === -8, '前の日より8℃低い');
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  var box = doc.getElementById('lf-sec-wx');
  ok(box && /熱中症に注意/.test(box.textContent) && /寒暖差に注意/.test(box.textContent), '今日のページに小さく出る');
  A.todayTab = 'tomo'; A.render();
  ok(/熱中症警戒アラート/.test((doc.getElementById('lf-sec-wx') || {}).textContent || ''), '明日のページにアラート');
  /* 花粉（季節と天気からの目安） */
  var om0 = A.lfWx.om;
  A.lfWx.om = J(A, { time:['2027-03-14', '2027-03-15'], tmax:[10, 16], tmin:[2, 6], code:[61, 0], wind:[10, 24], rain:[6, 0] });
  var pl = A.lfPollen('2027-03-15');
  ok(pl && pl.names.indexOf('スギ') >= 0 && pl.level === 3 && pl.why.indexOf('風が強い') >= 0, 'スギ：晴れ・風・雨の次の日で多そう');
  ok(A.lfWxRows('2027-03-15', true).some(function(r){ return /花粉/.test(r[2]) && /目安です/.test(r[2]); }), '「目安です」と書く');
  eq(A.lfPollen('2027-12-01'), null, '季節でないときは出さない');
  /* Open-Meteo は、ない値を null で返す（0℃・晴れ として読まない） */
  A.lfWx.om = J(A, { time:['2027-03-14', '2027-03-15'], tmax:[18, 20], tmin:[null, 6], code:[1, null], wind:[5, 5], rain:[0, 0] });
  var t2 = A.lfTempDiff('2027-03-15');
  ok(t2 && t2.dPrev === 2 && t2.what === '最高気温', 'きのうの最低気温がないときは、最高気温でくらべる：' + JSON.stringify(t2));
  ok(A.lfPollen('2027-03-15').why.indexOf('晴れ') < 0, '天気がない日を「晴れ」にしない');
  A.lfWx.om = J(A, { time:['2027-03-15'], tmax:[20], tmin:[null], code:[0], wind:[5], rain:[0] });
  eq(A.lfTempDiff('2027-03-15'), null, 'その日の最低気温がないときは、寒暖差を出さない');
  A.lfWx.om = om0;
  /* 朝の通知 */
  A.notifySet({ push:1, quiet:0, amTime:'06:45' });
  var j = A.notifyJobs().filter(function(x){ return x.id === 'lf-wbgt-' + tm; })[0];
  ok(j && /警戒アラート/.test(j.title) && new Date(j.at).getHours() === 6, '明日の朝に知らせる');
  var hd = A.aiSectionData('health');
  eq(hd.lfWx.today.wbgt.max, 29, 'AIが暑さ指数を読める');
  ok(hd.lfWx.tomorrow.wbgt.alert, 'AIがアラートを読める');
  A.LF.forceSeason = 0;
  A.appId = 'today'; A.todayTab = 'today'; A.render();
});

KT.test('生活＋：今日の作戦（すきま時間に課題・テスト・暗記をあてはめる・AIにも頼める）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document, td = A.today();
  A.S.tasks.push(J(A, { id:'tk_lfp', title:'lf看護レポート', subject:'', due:A.shiftDate(td, 1), time:'', done:0, memo:'', subs:[], photos:[], pri:1, mt:Date.now() }));
  A.S.exams.push(J(A, { id:'ex_lfp', subject:'解剖生理学', title:'小テスト', date:A.shiftDate(td, 2), time:'', kind:'quiz', room:'', memo:'', photos:[], mt:Date.now() }));
  A.S.shifts.push(J(A, { id:'wk_lfp', title:'バイト', date:td, start:'18:00', end:'22:00', realEnd:'', ot:0, rate:0, memo:'', photos:[], mt:Date.now() }));
  A.commit();
  var pl = A.lfPlanFor(td, 7 * 60);
  ok(pl.picks.some(function(x){ return /lf看護レポート/.test(x.what); }), '締切の近い課題をすきまに：' + pl.picks.map(function(x){ return x.what; }).join('／'));
  ok(pl.slots.every(function(g){ return g.kind === 'move' || g.e <= 17 * 60 + 30 || g.s >= 22 * 60; }), 'バイトの時間（と移動）はすきまにしない');
  ok(pl.blocks.some(function(b){ return b.label === 'バイトへ移動' && b.kind === 'move'; }), 'バイトへの移動は「移動中」');
  ok(pl.picks.concat(pl.left).length >= 1 && (pl.picks.some(function(x){ return /解剖/.test(x.what); }) || pl.left.some(function(x){ return /解剖/.test(x.what); })), 'テスト勉強も候補に');
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  var sec = doc.getElementById('lf-sec-plan');
  ok(sec, '今日のページに「今日の作戦」');
  var order = A.pageOrder('today');
  ok(order.indexOf('lfPlan') < order.indexOf('events'), '上の方に置く');
  sec.querySelector('[data-act="lf-plan-ai"]').click();
  await KT.until(function(){ var p = (A.S.kmData || {})['life:plan']; return p && /すきま時間の作戦/.test(p.text); }, 5000, 'AIの作戦');
  A.render();
  ok(/昼休みに暗記/.test(doc.getElementById('lf-sec-plan').textContent), 'AIの作戦を出す');
  ok(A.aiSectionData('tasks').lfPlan.aiPlan, 'AIが作戦を読める');
  A.todayTab = 'tomo'; A.render();
  ok(doc.getElementById('lf-sec-plan') && /明日の作戦/.test(doc.getElementById('lf-sec-plan').textContent), '明日のページにも');
  A.removeItem('tasks', 'tk_lfp'); A.removeItem('exams', 'ex_lfp'); A.removeItem('shifts', 'wk_lfp');
  A.todayTab = 'today'; A.commit();
  await KT.settle([A, B]);
});

KT.test('生活＋：声で登録（聞き取れない端末は入力欄・AIで分けて確かめてから登録・取り消し）', async function(){
  var A = KT.frames().A, doc = A.document;
  var nEv = A.S.events.length, nTk = A.S.tasks.length, nSp = (A.S.spends || []).length;
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  doc.querySelector('[data-act="lf-voice"]').click();
  ok(doc.getElementById('lf_vtext'), '入力欄が出る');
  ok(/キーボードのマイク/.test(doc.getElementById('lf-voice').textContent), 'キーボードのマイクで話すよう伝える');
  doc.getElementById('lf_vtext').value = 'あした10時に歯医者、金曜までにレポート、コンビニで580円';
  doc.querySelector('[data-act="lf-v-parse"]').click();
  await KT.until(function(){ return A.lfUi.voice && A.lfUi.voice.cands; }, 5000, 'AIで分ける');
  eq(A.lfUi.voice.cands.length, 3, '日付のないものは外す');
  var call = KT.aiCalls.filter(function(c){ return c.tag === 'lf-voice'; }).pop();
  ok(/歯医者/.test(JSON.stringify(call.contents)) && /今日は/.test(JSON.stringify(call.contents)), '話した文と今日の日付をAIに渡す');
  var ti = doc.querySelector('.lf-ce[data-p="v"][data-i="0"][data-f="title"]');
  ti.value = '歯医者（定期けんしん）';
  ti.dispatchEvent(new A.Event('input', { bubbles:true }));
  doc.querySelector('[data-act="lf-v-add"]').click();
  ok(A.S.events.some(function(e){ return e.title === '歯医者（定期けんしん）' && e.date === A.shiftDate(A.today(), 1) && e.time === '10:00'; }), '直した名前で予定に入る');
  eq(A.S.tasks.length, nTk + 1, '課題');
  eq(A.S.spends.length, nSp + 1, '家計簿');
  ok(A.S.spends.some(function(x){ return x.amount === 580 && x.cat === 'food'; }), 'お金の分類');
  doc.querySelector('[data-act="lf-v-undo"]').click();
  eq(A.S.events.length, nEv, '取り消すと予定が消える');
  eq(A.S.tasks.length, nTk, '課題も消える');
  eq(A.S.spends.length, nSp, '家計簿も消える');
  doc.querySelector('[data-act="lf-v-close"]').click();
  ok(!A.lfUi.voice, 'とじる');
  /* バイト：終わりの時刻を言わなかったときも、ここで入れて登録できる */
  var nSh = A.S.shifts.length;
  A.lfUi.voice = { on:true, text:'', err:'', busy:false, res:null, manual:1, cands:A.lfCands(J(A, { type:'shift', date:sd(2), time:'17:00' })) };
  eq(A.lfUi.voice.cands.length, 1, '1つだけ（配列でない）答えも候補にする');
  A.render();
  var en = doc.querySelector('.lf-ce[data-p="v"][data-i="0"][data-f="end"]');
  ok(en, 'バイトの終わりの時刻の欄');
  en.value = '21:00';
  doc.querySelector('[data-act="lf-v-add"]').click();
  ok(A.S.shifts.length === nSh + 1 && A.S.shifts.some(function(w){ return w.date === sd(2) && w.start === '17:00' && w.end === '21:00'; }), 'バイトに入る');
  doc.querySelector('[data-act="lf-v-undo"]').click();
  eq(A.S.shifts.length, nSh, '取り消せる');
  A.lfUi.voice = null; A.render();
});

KT.test('生活＋：撮るだけで登録（レシート・プリント・名刺→候補・シフト表は前からの読み取りへ）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document, td = A.today();
  var img = await tinyPng(A);
  var nSp = (A.S.spends || []).length;
  A.appId = 'today'; A.todayTab = 'today'; A.render();
  /* レシート */
  snapAnswer = { kind:'receipt', summary:'コンビニのレシート', items:[{ type:'spend', amount:1234, title:'ローソン', date:td, category:'food' }] };
  A.lfUi.snap = null;
  await A.lfSnapRead(img);
  eq(A.lfUi.snap.kind, 'receipt', 'レシートと分かる');
  A.render();
  ok(/レシート/.test(doc.getElementById('lf-snap').textContent), '何の写真か出る');
  doc.querySelector('[data-act="lf-s-add"]').click();
  await KT.until(function(){ return A.lfUi.snap && A.lfUi.snap.res; }, 5000, '登録');
  ok(A.S.spends.some(function(x){ return x.amount === 1234 && x.title === 'ローソン'; }), 'レシートは家計簿へ');
  eq(A.S.spends.length, nSp + 1, '1件');
  /* プリント（課題・休講）と名刺 */
  snapAnswer = { kind:'print', summary:'授業のプリント', items:[
    { type:'task', title:'lf看護過程レポート', date:A.shiftDate(td, 5) },
    { type:'change', date:A.shiftDate(td, 2), subject:'', change:'cancel' },
    { type:'memo', title:'名刺：山田さん', body:'電話 000-0000' } ] };
  var nHo = A.S.holidays.length, nNt = A.S.notes.length;
  await A.lfSnapRead(img);
  eq(A.lfUi.snap.cands.length, 3, '3つの候補');
  A.render();
  doc.querySelector('[data-act="lf-s-add"]').click();
  doc.querySelector('[data-act="lf-s-add"]').click();            /* 写真の保存を待つ間に、もう一度押す */
  await KT.until(function(){ return A.lfUi.snap && A.lfUi.snap.res; }, 5000, '登録');
  await new Promise(function(r){ setTimeout(r, 300); });
  var tks = A.S.tasks.filter(function(t){ return t.title === 'lf看護過程レポート'; }), tk = tks[0];
  eq(tks.length, 1, '2回押しても二重に入らない');
  ok(tk && tk.photos.length === 1, '課題に写真がつく');
  eq(A.S.holidays.length, nHo + 1, '休講が時間割の変更に入る');
  eq(A.S.notes.length, nNt + 1, '名刺はメモに');
  A.render();
  doc.querySelector('[data-act="lf-s-undo"]').click();
  ok(!A.S.tasks.some(function(t){ return t.title === 'lf看護過程レポート'; }) && A.S.holidays.length === nHo && A.S.notes.length === nNt, '取り消せる');
  /* シフト表 → 前からある「シフト表の写真から登録」 */
  snapAnswer = { kind:'shift', summary:'シフト表', items:[] };
  await A.lfSnapRead(img);
  ok(A.appId === 'money' && A.payTab === 'work', 'バイトの画面へ');
  await KT.until(function(){ return A.shiftOcr && A.shiftOcr.list; }, 8000, 'シフトの読み取り');
  eq(A.shiftOcr.list.length, 2, '前からあるシフトの読み取りで読む');
  A.shiftOcr = { busy:false, list:null, err:'' };
  snapAnswer = null;
  A.lfUi.snap = null;
  A.appId = 'today'; A.todayTab = 'today'; A.commit();
  await KT.settle([A, B]);
});

KT.test('生活＋：1週間の生活の分析（数字・グラフ・週のふりかえりに数字を渡す）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document;
  var mon = A.shiftDate(A.monOfYmd(A.today()), -7);
  A.lfLogSet(mon, { sleep:420, steps:6000, src:'hand' });
  A.lfLogSet(A.shiftDate(mon, 1), { sleep:360, steps:8000, src:'hand' });
  A.S.studyLog[mon + '|lftest'] = J(A, { n:30, ok:20, mt:Date.now() }); A.touch('studyLog');
  var sp = A.kbAdd(J(A, { amount:1000, title:'lfテストのごはん', date:A.shiftDate(mon, 2), cat:'food', src:'hand' }));
  A.S.shifts.push(J(A, { id:'wk_lfw', title:'バイト', date:A.shiftDate(mon, 3), start:'17:00', end:'21:00', realEnd:'', ot:0, rate:0, memo:'', photos:[], mt:Date.now() }));
  A.commit();
  var w = A.lfWeekData(mon);
  eq(w.sleepAvg, 390, '睡眠の平均');
  eq(w.stepsAvg, 7000, '歩数の平均');
  ok(w.cards >= 30 && w.studyDays >= 1, '暗記の枚数');
  ok(w.cat.food >= 1000, 'お金の分類');
  ok(w.workH >= 4, 'バイトの時間');
  var st = A.weekStats(mon);
  ok(st.life && /睡眠の平均 6時間30分/.test(st.life.line), '週のふりかえりに数字を足す');
  ok(/睡眠の平均/.test(A.weekReviewTemplate(st)) && /出席/.test(A.weekReviewTemplate(st)), 'AIなしのまとめにも');
  KT.aiCalls.length = 0;
  await A.weekReviewMake(mon, false);
  var call = KT.aiCalls.filter(function(c){ return c.tag === 'week'; }).pop();
  ok(call && /睡眠の平均/.test(JSON.stringify(call.contents)), 'AIのふりかえりに生活の数字を渡す（新しく作らない）');
  A.lfUi.weekOff = -1;
  A.appId = 'today'; A.todayTab = 'life'; A.render();
  var sec = doc.getElementById('lf-sec-week');
  ok(sec && sec.querySelector('.lf-wkst') && sec.querySelectorAll('.lf-chart').length === 3, '数字とグラフ');
  ok(/よかったこと/.test(sec.textContent), 'AIのふりかえりを出す');
  eq(A.aiSectionData('reviews').lfWeek.lastWeek.ankiCards, w.cards, 'AIがふりかえりの分野で読める');
  /* あとかたづけ */
  A.lfLogDel(mon); A.lfLogDel(A.shiftDate(mon, 1));
  delete A.S.studyLog[mon + '|lftest']; A.touch('studyLog');
  if(sp) A.removeItem('spends', sp.id);
  A.removeItem('shifts', 'wk_lfw');
  A.commit();
  await KT.settle([A, B]);
});

KT.test('生活＋：表示するだけでは中身が変わらない（入力中の枠・設定もひらいて）', async function(){
  var A = KT.frames().A, B = KT.frames().B, doc = A.document, td = A.today();
  A.lfLogSet(td, { sleep:400, steps:3000, src:'hand' });
  A.lfPeriodPut(J(A, { start:A.shiftDate(td, -3) }));
  A.S.ui.setOpen = A.S.ui.setOpen || {}; A.S.ui.setOpen.lfset = 1; A.touch('ui');
  A.commit();
  await KT.settle([A, B]);
  A.lfUi.logForm = true; A.lfUi.logList = true; A.lfUi.hcHelp = true; A.lfUi.planMore = true;
  A.lfUi.pf = { id:'', start:td, end:'', flow:2, pain:0, memo:'' };
  A.lfUi.xf = A.lfXfNew('measles'); A.lfUi.xf.kind = 'antibody';
  A.lfUi.voice = { on:true, text:'あした', cands:[{ type:'event', title:'x', date:td, time:'', pick:1 }], res:null, manual:1 };
  A.lfUi.snap = { img:'', kind:'receipt', summary:'', cands:[{ type:'spend', amount:100, title:'y', date:td, pick:1 }], res:null, keep:1 };
  var snap = function(){ var o = A.payloadCore(); delete o.notices; return A.canon(o) + '|' + A.canon(A.S.meta); };
  var before = snap();
  [['today', 'today'], ['today', 'tomo'], ['today', 'life'], ['today', 'week'], ['cal', 'cal'], ['set', null]].forEach(function(p){
    A.appId = p[0]; if(p[0] === 'today') A.todayTab = p[1]; if(p[0] === 'cal') A.calTab = p[1];
    A.render();
  });
  ok(doc.getElementById('lf_sg'), '設定の枠が出る');
  A.persist();
  eq(snap(), before, '表示しただけで中身が変わらない');
  A.lfUi.logForm = false; A.lfUi.logList = false; A.lfUi.hcHelp = false; A.lfUi.planMore = false;
  A.lfUi.pf = null; A.lfUi.xf = null; A.lfUi.voice = null; A.lfUi.snap = null;
  lifeClear(A); A.lfLogDel(td);
  A.S.ui.setOpen.lfset = 0; A.touch('ui');
  A.appId = 'today'; A.todayTab = 'today'; A.commit();
  await KT.settle([A, B]);
});
})();

/* バッチC2 モックテスト（Firestore・気象庁などを fetch スタブで置き換えて実行）
   使い方: node tests-api/c2-mock.test.js
   - 実キー・実ネットワークは使わない（GEMINI_API_KEY・FIREBASE_SERVICE_ACCOUNT・WBGT_CSV_URL は外して動かす）。
   - 日付は実行時の JST 今日を基準に組み立てる。cron は時刻ゲートが実行時刻しだいなので、
     「例外なく 200/501 が返る」「watch の集計がある」「初回はベースラインだけ」までを見て、
     差分の中身は runWatch 単体で確かめる。 */
'use strict';

let pass = 0, fail = 0, skip = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✔ ' + name); }
  else { fail++; console.log('  ✘ ' + name); }
}
function skipped(name) { skip++; console.log('  - skip: ' + name); }

delete process.env.GEMINI_API_KEY;
delete process.env.FIREBASE_SERVICE_ACCOUNT;
delete process.env.WBGT_CSV_URL;
delete process.env.APP_API_SECRET;
delete process.env.CRON_SECRET;

/* ===== Firestore・気象庁スタブ ===== */
const S = (v) => ({ stringValue: String(v) });
const I = (v) => ({ integerValue: String(v) });
const store = {};   // docId -> fields(raw FS形式)
let forecastFixture = null;
global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith('https://www.jma.go.jp/bosai/forecast/')) {
    if (!forecastFixture) return { status: 404, ok: false, json: async () => ({}), text: async () => '' };
    return { status: 200, ok: true, json: async () => forecastFixture, text: async () => JSON.stringify(forecastFixture) };
  }
  if (u.startsWith('https://www.jma.go.jp/bosai/warning/')) {
    return { status: 200, ok: true, json: async () => ({ areaTypes: [] }), text: async () => '{}' };
  }
  const m = /documents\/shiharai\/([^?]+)/.exec(u);
  if (m) {
    const id = decodeURIComponent(m[1]);
    const method = (opts && opts.method) || 'GET';
    if (method === 'GET') {
      if (!store[id]) return { status: 404, ok: false, json: async () => ({}), text: async () => '' };
      return { status: 200, ok: true, json: async () => ({ fields: store[id] }), text: async () => '' };
    }
    if (method === 'PATCH') {
      const body = JSON.parse(opts.body);
      store[id] = Object.assign({}, store[id], body.fields);
      return { status: 200, ok: true, json: async () => ({}), text: async () => '' };
    }
  }
  throw new Error('unexpected fetch: ' + u);
};

/* ===== 時刻・日付（JST） ===== */
const D = require('../api/_digest');
const FB = require('../api/_fb');
const W = require('../api/_watch');
const WX = require('../api/_wx');
const P = require('../api/_plan');
const now = Date.now();
const today = D.ymdJst(now);
const nowMin = D.minJst(now);
const tomorrow = D.addDaysYmd(today, 1);
const in3 = D.addDaysYmd(today, 3);
const yest = D.addDaysYmd(today, -1);
const weekStart = D.addDaysYmd(today, -((D.wdayOf(today) + 6) % 7));

/* ===== 同期データのフィクスチャ ===== */
function seedPart(name, obj) {
  const text = JSON.stringify(obj);
  const h = D.hash53(text);
  store[FB.ROOM + '__v3_' + name + '_' + h + '_0'] = { h: S(h), d: S(text) };
  return { mapValue: { fields: { h: S(h), n: I(1), z: I(0) } } };
}
function baseData() {
  return {
    core: {
      settings: {}, ui: {},
      commute: { walk: 8, bus: 51, change: 15, train: 35, toSchool: 10, buffer: 10, periods: ['09:00', '10:40', '13:00', '14:40', '16:20', '18:00'], ends: ['10:30', '12:10', '14:30', '16:10', '17:50', '19:30'] },
      termsList: [{ id: 't1', label: '後期', courses: [
        { name: '解剖学', slots: '月1,火1,水1,木1,金1', room: 'A101', bi: 0, web: 0 },
        { name: '英語', slots: '月2', room: 'B202', bi: 0, web: 0 },
      ] }],
      termId: 't1',
    },
    plan: {
      events: [],
      tasks: [
        { id: 'tk1', title: 'レポート', subject: '解剖学', due: tomorrow, time: '', done: 0, mt: 0 },
        { id: 'tk2', title: '小テスト準備', subject: '英語', due: weekStart, time: '', done: 0, mt: 0 },
        { id: 'tk3', title: '終わった課題', subject: '英語', due: weekStart, time: '', done: 1, mt: now },
      ],
      exams: [{ id: 'ex1', subject: '解剖学', title: '中間テスト', date: in3, time: '13:00' }],
      holidays: [], breaks: [],
    },
    money: {
      balances: [], fixed: [], income: [], shifts: [],
      spends: [
        { id: 'sp1', date: today, amount: 800, io: 'out', title: 'ローソン', cat: 'food', mt: 0 },
        { id: 'sp2', date: weekStart, amount: 1200, io: 'out', title: '本', cat: 'study', mt: 0 },
        { id: 'sp3', date: today, amount: 5000, io: 'in', title: '入金', cat: '', mt: 0 },
      ],
    },
    maps: {
      attendLog: {
        '解剖学': [{ date: weekStart, st: '出' }, { date: yest, st: '欠' }],
        '英語': [{ date: weekStart, st: '遅' }],
      },
      grades: { '英語': { grade: '', score: '' } },
      courseMeta: { '解剖学': { alias: 'かいぼう', room: 'A101', total: 15, evalAbsent: 3 } },
      syllabus: { '解剖学': { text: '概要', teacher: '先生', memo: '', items: [{ name: '期末', pct: 70, kind: 'exam' }], files: [], mt: 1 } },
      biweek: {},
    },
  };
}
function seedSync(d) {
  const parts = {};
  ['core', 'plan', 'money', 'maps'].forEach((k) => { parts[k] = seedPart(k, d[k]); });
  parts.extra = seedPart('extra', { annivs: [] });
  store[FB.ROOM + '__v3'] = { parts: { mapValue: { fields: parts } } };
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }

/* ===== req/res モック ===== */
function mockRes() {
  return {
    statusCode: 0, headers: {}, body: '',
    setHeader(k, v) { this.headers[k] = v; },
    end(b) { this.body = b || ''; },
    json() { try { return JSON.parse(this.body); } catch (e) { return null; } },
  };
}
async function call(handler, method, url, body, headers) {
  const res = mockRes();
  await handler({ method, url, headers: headers || {}, body }, res);
  return res;
}

(async () => {
  console.log('== _watch：状態と差分 ==');
  {
    const d0 = baseData();
    ok(W.stateOf(null) && typeof W.stateOf(null).attend === 'object', 'stateOf は data が null でも落ちない');
    const s0 = W.stateOf(d0);
    ok(s0.attend['解剖学'].abRaw === 1 && s0.attend['解剖学'].absDates[0] === yest, 'stateOf 出欠の数え上げ（absDates）');
    ok(s0.coursesFinger && Object.keys(s0.syllabus).length === 1, 'stateOf 時間割の指紋・シラバスの指紋');
    ok(W.diffWatch(null, s0).length === 0, 'ベースライン（prev null → events 0）');
    ok(W.diffWatch(s0, W.stateOf(clone(d0))).length === 0, '変化なし → events 0');

    const d1 = clone(d0);
    d1.maps.attendLog['解剖学'].push({ date: today, st: '欠' });
    let ev = W.diffWatch(s0, W.stateOf(d1));
    const ab = ev.filter((e) => e.type === 'attend-absence')[0];
    ok(ab && ab.name === '解剖学' && ab.dates[0] === today && ab.count === 1, '欠席追加 → attend-absence');
    const j = W.eventJob(ab, d1);
    ok(/^srv-watch-attend-absence-/.test(j.key) && j.key === W.eventJob(ab, d1).key && j.body.indexOf('かいぼう') === 0 && j.body.indexOf(D.mdLabel(today)) > 0, 'eventJob 欠席の文面とキーが安定');

    const d2 = clone(d0);
    d2.maps.grades['英語'] = { grade: 'A', score: 85 };
    ev = W.diffWatch(s0, W.stateOf(d2));
    const gn = ev.filter((e) => e.type === 'grade-new')[0];
    ok(gn && gn.grade === 'A' && gn.score === '85', '成績新規 → grade-new');
    ok(W.eventJob(gn, d2).body === '英語：A（85点）', 'eventJob 成績の文面');
    const d3 = clone(d2);
    d3.maps.grades['英語'] = { grade: 'B', score: 75 };
    ev = W.diffWatch(W.stateOf(d2), W.stateOf(d3));
    ok(ev.some((e) => e.type === 'grade-change' && e.prevGrade === 'A' && e.grade === 'B'), '成績変化 → grade-change');

    const d4 = clone(d0);
    d4.plan.tasks.push({ id: 'tk9', title: '新しいレポート', subject: '英語', due: in3, done: 0, mt: now });
    ev = W.diffWatch(s0, W.stateOf(d4));
    const tn = ev.filter((e) => e.type === 'task-new');
    ok(tn.length === 1 && tn[0].id === 'tk9', '課題新規 → task-new');
    ok(/締切：/.test(W.eventJob(tn[0], d4).body), 'eventJob 課題の文面に締切');
    const d4b = clone(d0);
    for (let i = 0; i < 12; i++) d4b.plan.tasks.push({ id: 'many' + i, title: '課題' + i, due: in3, done: 0 });
    ev = W.diffWatch(s0, W.stateOf(d4b)).filter((e) => e.type === 'task-new');
    ok(ev.length === 1 && ev[0].count === 12, '課題が10件を超えたら件数にまとめる');

    const d5 = clone(d0);
    d5.maps.syllabus['解剖学'].items[0].pct = 60;
    d5.maps.syllabus['解剖学'].mt = 99;
    ev = W.diffWatch(s0, W.stateOf(d5));
    ok(ev.some((e) => e.type === 'syllabus-change' && e.name === '解剖学'), 'シラバス変化 → syllabus-change');
    const d5b = clone(d0); d5b.maps.syllabus['解剖学'].files = ['x.pdf']; d5b.maps.syllabus['解剖学'].mt = 5;
    ok(!W.diffWatch(s0, W.stateOf(d5b)).some((e) => e.type === 'syllabus-change'), 'シラバスの files・mt だけの変化は無視');
    const s0noSyl = clone(s0); s0noSyl.syllabus = {};
    ok(!W.diffWatch(s0noSyl, W.stateOf(d5)).some((e) => e.type === 'syllabus-change'), '前回シラバスが空なら syllabus-change を出さない');

    const d6 = clone(d0);
    d6.plan.holidays.push({ date: tomorrow, course: '解剖学', type: 'cancel', room: '', period: '' });
    ev = W.diffWatch(s0, W.stateOf(d6));
    const tt = ev.filter((e) => e.type === 'timetable-change')[0];
    ok(tt && tt.added.length === 1 && tt.removed.length === 0, 'holidays 追加 → timetable-change');
    ok(/休講/.test(W.eventJob(tt, d6).body), 'eventJob 時間割の文面（cancel=休講）');

    /* runWatch：初回はベースラインだけ、2回目で差分 */
    delete store[FB.WATCH_DOC];
    const r1 = await W.runWatch(d0);
    ok(r1.baseline === true && r1.events.length === 0 && !!store[FB.WATCH_DOC], 'runWatch 初回はベースラインを保存するだけ');
    const r2 = await W.runWatch(d1);
    ok(r2.baseline === false && r2.events.some((e) => e.type === 'attend-absence'), 'runWatch 2回目で欠席を検知');
    const r3 = await W.runWatch({ core: null, plan: null, money: null, maps: null });
    ok(r3.skipped === true && r3.events.length === 0, 'runWatch 同期データが読めない回は何もしない');
    const r4 = await W.runWatch(Object.assign({}, d1, { maps: null }));
    ok(r4.events.length === 0 && (await W.loadWatchState()).attend['解剖学'].abRaw === 2, 'runWatch 読めないかたまりは前回の状態を引き継ぐ');

    /* 誤検知の防止（レビュー指摘への対策） */
    const d7 = clone(d0);
    d7.maps.attendLog['新科目'] = [{ date: yest, st: '欠' }, { date: today, st: '欠' }];
    ok(!W.diffWatch(s0, W.stateOf(d7)).some((e) => e.type === 'attend-absence'), '新規科目の過去ぶんの欠席は通知しない');
    const d7b = clone(d0);
    d7b.maps.syllabus['新科目'] = { text: '概要', teacher: '先生', memo: '', items: [{ name: '期末', pct: 100, kind: 'exam' }], files: [], mt: 1 };
    ok(!W.diffWatch(s0, W.stateOf(d7b)).some((e) => e.type === 'syllabus-change'), '新規科目のシラバスは変更として通知しない');
    const d8 = clone(d0);
    d8.plan.holidays.push({ date: yest, course: '解剖学', type: 'cancel', room: '', period: '' });
    ok(!W.diffWatch(W.stateOf(d8), s0).some((e) => e.type === 'timetable-change'), '過去日の holidays 削除は通知しない');
    ok(!W.diffWatch(s0, W.stateOf(d8)).some((e) => e.type === 'timetable-change'), '過去日の holidays 追加は通知しない');
    delete store[FB.WATCH_DOC];
    const r5 = await W.runWatch({ core: d0.core, plan: d0.plan, money: null, maps: null });
    ok(r5.skipped === true && r5.partialBaseline === true && !(await W.loadWatchState()), 'runWatch 材料が欠けた初回はベースラインを保存しない');
  }

  console.log('== _watch：出欠の危険科目・サブスク監査・週次 ==');
  {
    const log = (ab, late) => {
      const a = [];
      for (let i = 0; i < ab; i++) a.push({ date: D.addDaysYmd(today, -i - 1), st: '欠' });
      for (let i = 0; i < (late || 0); i++) a.push({ date: D.addDaysYmd(today, -i - 20), st: '遅' });
      return a;
    };
    const data = { maps: {
      attendLog: { A: log(2), B: log(4), C: log(3), Dd: log(2), E: log(1, 3) },
      courseMeta: { A: { evalAbsent: 3 }, B: { total: 15 }, E: { evalAbsent: 5 } },
    } };
    const dc = W.dangerCourses(data);
    const by = {}; dc.forEach((c) => { by[c.name] = c; });
    ok(by.A && by.A.level === 'danger' && by.A.remaining === 1 && by.A.limitSource === 'courseMeta', 'evalAbsent あり：あと1回で danger');
    ok(by.B && by.B.limit === 5 && by.B.limitSource === 'total/3' && by.B.remaining === 1, 'total のみ：ceil(total/3)');
    ok(by.C && by.C.level === 'count' && by.C.limit === null && by.C.limitSource === 'none', 'どちらも無し：ab>=3 で count');
    ok(!by.Dd, 'どちらも無し：ab<3 は出ない');
    ok(!by.E, '遅刻3回で欠席1回（ab=2・上限5 は出ない）');
    ok(dc[dc.length - 1].level === 'count', 'danger が先に並ぶ');

    ok(W.auditSubs(null, null).enough === false && W.auditSubs({ subs: [] }, null).enough === false, 'auditSubs データなし enough:false');
    const snap = { subs: [
      { name: 'Netflix', amount: 1490 }, { name: 'Netflix', amount: 1490 },
      { name: 'Spotify', amount: 980 }, { name: 'Spotify', amount: 1080 },
      { name: 'iCloud', amount: 400 },
    ] };
    const au = W.auditSubs(snap, { iCloud: 130, Netflix: 1490 });
    ok(au.enough && au.findings.some((f) => f.type === 'duplicate' && f.name === 'Netflix'), 'auditSubs 重複（同額）→ duplicate');
    ok(au.findings.some((f) => f.type === 'amount-mismatch' && f.name === 'Spotify'), 'auditSubs 同名で金額ちがい → amount-mismatch');
    ok(au.findings.some((f) => f.type === 'amount-changed' && f.name === 'iCloud' && f.before === 130 && f.after === 400), 'auditSubs 前回指紋と比べて金額変化');
    ok(au.finger.Spotify === 980 && W.fingerOfSubs(snap).Netflix === 1490, 'fingerOfSubs 重複は最初のもの');

    const wr = await W.buildWeeklyReview(baseData(), null, null, today);
    ok(wr.weekStart === weekStart && wr.weekEnd === D.addDaysYmd(weekStart, 6), 'buildWeeklyReview 週の範囲（月〜日）');
    const expAb = yest >= weekStart ? 1 : 0;
    ok(wr.counts.attend.pres === 1 && wr.counts.attend.late === 1 && wr.counts.attend.ab === expAb, 'buildWeeklyReview 出欠の件数');
    ok(wr.counts.tasks.doneEstimated === 1 && wr.counts.tasks.overdue === 1 && wr.counts.tasks.estimated === true, 'buildWeeklyReview 課題（完了は推定）');
    ok(wr.counts.money.out === 2000 && wr.counts.money.count === 2, 'buildWeeklyReview 支出の合計');
    ok(wr.aiText === null && wr.text.length > 0 && wr.text.length <= 500, 'buildWeeklyReview AI 無しは text のみ');
  }

  console.log('== _wx：降水確率・警報・WBGT ==');
  {
    forecastFixture = [{
      timeSeries: [
        { timeDefines: [today + 'T05:00:00+09:00'], areas: [{ area: { code: '280010' }, weatherCodes: ['300'] }] },
        {
          timeDefines: [today + 'T00:00:00+09:00', today + 'T06:00:00+09:00', today + 'T12:00:00+09:00', today + 'T18:00:00+09:00', tomorrow + 'T00:00:00+09:00', tomorrow + 'T06:00:00+09:00'],
          areas: [
            { area: { code: '280010', name: '南部' }, pops: ['', '20', '60', '40', '10', '30'] },
            { area: { code: '280020', name: '北部' }, pops: ['', '90', '90', '90', '90', '90'] },
          ],
        },
      ],
    }];
    const p = WX.popsForDate(forecastFixture, today);
    ok(p.pop === 60 && p.slots.length === 3, 'popsForDate 南部の今日の最大（空欄は飛ばす）');
    ok(WX.popsForDate(forecastFixture, tomorrow).pop === 30, 'popsForDate 日付の対応付け（明日）');
    ok(WX.popsForDate(null, today).pop === null, 'popsForDate 予報なしは null');
    const ri = await WX.rainInfo(today);
    ok(ri.enough && ri.pop === 60 && ri.rain === true && ri.maybe === true, 'rainInfo fetch スタブ経由で雨');
    const ri2 = await WX.rainInfo(tomorrow);
    ok(ri2.enough && ri2.rain === false && ri2.maybe === true, 'rainInfo 30% は maybe のみ');
    ok(WX.warningStage([{ lv: 2 }, { lv: 3 }]).stage === 'special' && WX.warningStage([{ lv: 2 }]).label === '警報' && WX.warningStage([]).stage === 'none', 'warningStage 段階');
    ok(WX.stageText([{ lv: 3 }], '当日') === '⚠️ 特別警報が出ています。身の安全を最優先に。' && WX.stageText([], '当日') === '', 'stageText 当日の特別警報');
    const w = await WX.wbgtInfo(tomorrow);
    ok(w.enough === false && /未設定/.test(w.reason), 'wbgtInfo WBGT_CSV_URL 未設定 → enough:false');
    ok(WX.parseWbgtCsv('date,max\n' + tomorrow.replace(/-/g, '/') + ',29.5\n', tomorrow) === 29.5, 'parseWbgtCsv 日付の行から最大');
    ok(WX.parseWbgtCsv(',,' + tomorrow.replace(/-/g, '') + '09,' + tomorrow.replace(/-/g, '') + '12\n63518,x,270,310\n', tomorrow) === 31, 'parseWbgtCsv 時刻列の形（10倍値）');
    ok(WX.wbgtLevel(31) === '危険' && WX.wbgtLevel(28) === '厳重警戒' && WX.wbgtLevel(20) === '', 'wbgtLevel');
  }

  console.log('== ハンドラー ==');
  {
    seedSync(baseData());

    /* 時刻表 → 終電 */
    const transit = require('../api/transit');
    const last = require('../api/plan/lasttrain');
    let r = await call(last, 'GET', '/api/plan/lasttrain');
    ok(r.statusCode === 200 && r.json().enough === false && /未登録/.test(r.json().reason), 'lasttrain 時刻表なし → enough:false');
    r = await call(transit, 'GET', '/api/transit');
    ok(r.json().source === 'none' && r.json().tables === null, 'transit GET 未登録は none');
    const nt = transit.normalizeTransit({ tables: { trainBack: [['22:10', '22:50'], ['8:05', '8:40'], ['xx', '1'], ['23:59']], hoge: [['10:00', '10:10']] } });
    ok(nt && nt.tables.trainBack.length === 2 && nt.tables.trainBack[0][0] === '08:05' && !nt.tables.hoge && nt.holiday === null, 'normalizeTransit 検証・並べ替え・知らない表は捨てる');
    ok(transit.normalizeTransit({ tables: { busGo: [['x', 'y']] } }) === null, 'normalizeTransit 使える便が無ければ null');
    const big = []; for (let i = 0; i < 400; i++) big.push(['10:00', '10:30']);
    ok(transit.normalizeTransit({ tables: { busGo: big } }).tables.busGo.length === 300, 'normalizeTransit 1テーブル最大300件');
    r = await call(transit, 'POST', '/api/transit', { tables: { trainBack: [['21:00', '21:40'], ['23:59', '00:40']] }, holiday: { trainBack: [['23:58', '00:39']] } });
    ok(r.statusCode === 200 && r.json().counts.trainBack === 2, 'transit POST 保存');
    r = await call(transit, 'POST', '/api/transit', { tables: 'x' });
    ok(r.statusCode === 400, 'transit POST 形ちがいは 400');
    r = await call(transit, 'GET', '/api/transit');
    ok(r.json().source === 'server' && r.json().tables.trainBack.length === 2 && r.json().holiday.trainBack.length === 1, 'transit GET 登録済み');
    r = await call(last, 'GET', '/api/plan/lasttrain');
    const lj = r.json();
    const nm = D.minJst(Date.now());
    const expDep = lj.dayType === 'holiday' ? '23:58' : '23:59';
    ok(lj.enough === true && lj.last.dep === expDep, 'lasttrain 今日の種別で最後の便（' + lj.dayType + '）');
    ok(Math.abs(lj.minutesLeft - (D.minutesOf(expDep) - nm)) <= 1 && Math.sign(lj.minutesLeft) === Math.sign(D.minutesOf(expDep) - nm), 'lasttrain minutesLeft の符号と値');
    const cfg = require('../api/config');
    r = await call(cfg, 'GET', '/api/config');
    ok(r.json().transit && r.json().transit.source === 'server' && r.json().transit.tables.trainBack.length === 2, '/api/config で時刻表を配信');

    /* 到着記録 */
    const arrive = require('../api/attend/arrive');
    r = await call(arrive, 'POST', '/api/attend/arrive', { date: today, time: '8:50', place: '学校'.repeat(30) });
    ok(r.statusCode === 200 && r.json().ok === true, 'arrive POST');
    r = await call(arrive, 'POST', '/api/attend/arrive', { date: 'x', time: '8:50' });
    ok(r.statusCode === 400, 'arrive POST 形ちがいは 400');
    r = await call(arrive, 'GET', '/api/attend/arrive');
    const aj = r.json();
    ok(aj.entries.length === 1 && aj.entries[0].time === '08:50' && aj.entries[0].place.length === 40, 'arrive GET で返る（時刻の整形・場所40字）');

    /* 学習（#57） */
    const learn = require('../api/plan/learn');
    r = await call(learn, 'GET', '/api/plan/learn');
    ok(r.json().enough === false && r.json().reason === '学習データ不足', 'learn 記録3件未満 → enough:false');
    const dataNow = await D.loadData();
    const days = [];
    for (let i = 1; i < 30 && days.length < 4; i++) {
      const d = D.addDaysYmd(today, -i);
      if (D.classesForDate(dataNow, d).some((c) => !c.off && !c.web)) days.push(d);
    }
    store[FB.ARRIVE_DOC] = { entries: S(JSON.stringify([
      { date: days[0], time: '08:55', place: '', at: '' },
      { date: days[1], time: '08:50', place: '', at: '' },
      { date: days[2], time: '08:57', place: '', at: '' },
      { date: days[2], time: '09:30', place: '', at: '' },   // 同じ日の2件目は使わない
      { date: days[3], time: '06:00', place: '', at: '' },   // 余裕180分は外れ値
    ])) };
    r = await call(learn, 'GET', '/api/plan/learn');
    const lnj = r.json();
    ok(lnj.enough === true && lnj.count === 3 && lnj.avgMarginMin === 6 && lnj.correctionMin === 4, 'learn 平均の余裕6分 → 補正4分');
    ok(Object.keys(lnj.byWeekday).reduce((a, k) => a + lnj.byWeekday[k].n, 0) === 3, 'learn 曜日別の件数');

    /* 共有（#49） */
    const create = require('../api/share/create');
    const view = require('../api/share/view');
    r = await call(create, 'POST', '/api/share/create');
    const code = r.json().code;
    ok(r.statusCode === 200 && /^[A-HJ-NP-Z2-9]{12}$/.test(code), 'share create 12文字（0/O/1/I なし）');
    r = await call(view, 'GET', '/api/share/view?code=' + code);
    const vj = r.json();
    ok(r.statusCode === 200 && vj.courses.length === 2 && vj.courses[0].room === 'A101' && vj.tasks.length === 2 && vj.tasks[0].due <= vj.tasks[1].due, 'share view 時間割と未完了の課題');
    ok(!('grades' in vj) && !('money' in vj) && !('attend' in vj) && r.body.indexOf('ローソン') < 0, 'share view お金・成績・出欠は出さない');
    r = await call(view, 'GET', '/api/share/view?code=ABCDEFGHJKLM');
    ok(r.statusCode === 404 && r.json().error === 'not found', 'share view 不明コードは 404');
    const sh = JSON.parse(store[FB.SHARE_DOC].shares.stringValue);
    sh[code].expiresAt = new Date(now - 1000).toISOString();
    store[FB.SHARE_DOC].shares = S(JSON.stringify(sh));
    r = await call(view, 'GET', '/api/share/view?code=' + code);
    ok(r.statusCode === 404, 'share view 期限切れは 404');

    /* 学習計画（#47） */
    const sp = require('../api/study/plan');
    r = await call(sp, 'GET', '/api/study/plan');
    ok(r.statusCode === 200 && r.json().exams[0].id === 'ex1', 'study/plan GET 試験一覧');
    r = await call(sp, 'POST', '/api/study/plan', {});
    const pj = r.json();
    ok(pj.source === 'template' && pj.exam.days === 3 && pj.phases.length >= 2 && /直前確認/.test(pj.plan), 'study/plan GEMINI 未設定 → template の骨組み');
    r = await call(sp, 'POST', '/api/study/plan', { subject: '物理', date: D.addDaysYmd(today, -5) });
    ok(r.json().source === 'template' && r.json().exam.days === 7 && /7日間/.test(r.json().note), 'study/plan 試験日が過去なら7日の骨組み');

    /* #48 締切フラグ */
    const items = P.nextItems(dataNow, null, today, 20, []);
    ok(items.some((i) => i.kind === 'task' && i.deadline === true) && items.filter((i) => i.kind !== 'task').every((i) => i.deadline === false), '#48 nextItems の deadline フラグ');
  }

  console.log('== cron 統合 ==');
  {
    delete store[FB.WATCH_DOC];
    seedSync(baseData());
    const cron = require('../api/push/cron');
    const r1 = await call(cron, 'POST', '/api/push/cron');
    const j1 = r1.json();
    ok((r1.statusCode === 200 || r1.statusCode === 501) && j1 && j1.watch && typeof j1.watch.events === 'number', 'cron 1回目 200/501 と watch の集計');
    ok(j1.watch.events === 0 && j1.watch.planned === 0 && !!store[FB.WATCH_DOC], 'cron 状態なし → ベースラインだけ（通知なし）');
    ok(['attend', 'warn', 'wkrev', 'subaudit', 'wbgt', 'inbox'].every((k) => j1[k] && typeof j1[k].planned === 'number'), 'cron 応答に C2 の集計がそろう');
    const d = baseData();
    d.maps.attendLog['解剖学'].push({ date: today, st: '欠' });
    seedSync(d);
    const r2 = await call(cron, 'POST', '/api/push/cron');
    ok(r2.statusCode === 200 || r2.statusCode === 501, 'cron 2回目も例外なく返る');
    const quiet = nowMin < 360 || nowMin > 1410;
    if (!quiet && nowMin >= 1255) {
      /* このテストは送信の鍵なしで動かす。鍵が無い回は差分を進めないのが正しい動き
         （状態だけ進むと、鍵を入れたあとに変化を拾えなくなるため）。差分の中身は runWatch 単体で確認済み */
      ok(r2.json().watch.events === 0 && (await W.loadWatchState()).attend['解剖学'].abRaw === 1,
        'cron 夜スロットでも送信の鍵が無いときは差分を進めない');
    }
    else skipped('cron の差分検知（夜スロット 20:55〜23:30 のときだけ。詳細は runWatch 単体で確認済み）');
  }

  console.log(`\n結果: pass ${pass} / fail ${fail} / skip ${skip}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

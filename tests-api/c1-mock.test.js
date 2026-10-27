/* バッチC1 モックテスト（Firestore を fetch スタブで置き換えて実行）
   使い方: node tests-api/c1-mock.test.js
   - 実キー・実ネットワークは使わない（FCM / OAuth もスタブ）。
   - 日付は実行時の JST 今日を基準に組み立てる。cron の時刻ゲートに触れる項目は
     実行時刻から期待値を計算して照合する（23:30〜6:00 の静かな時間帯は cron 系を skip 表示）。 */
'use strict';
const crypto = require('crypto');

let pass = 0, fail = 0, skip = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✔ ' + name); }
  else { fail++; console.log('  ✘ ' + name); }
}
function skipped(name) { skip++; console.log('  - skip: ' + name); }

/* ===== Firestore スタブ ===== */
const S = (v) => ({ stringValue: String(v) });
const I = (v) => ({ integerValue: String(v) });
const B = (v) => ({ booleanValue: !!v });
const store = {};   // docId -> fields(raw FS形式)
global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith('https://oauth2.googleapis.com/token')) {
    return { status: 200, ok: true, json: async () => ({ access_token: 'tok' }), text: async () => '' };
  }
  if (u.startsWith('https://fcm.googleapis.com/')) {
    return { status: 200, ok: true, json: async () => ({ name: 'messages/x' }), text: async () => '{}' };
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
const M = require('../api/_money');
const P = require('../api/_plan');
const FB = require('../api/_fb');
const now = Date.now();
const today = D.ymdJst(now);
const nowMin = D.minJst(now);
const tomorrow = D.addDaysYmd(today, 1);
const in3 = D.addDaysYmd(today, 3);
const ym = today.slice(0, 7);
const dayNum = Number(today.slice(8, 10));
const quiet = nowMin < 360 || nowMin > 1410;

/* ===== 同期データのフィクスチャ ===== */
function seedPart(name, obj) {
  const text = JSON.stringify(obj);
  const h = D.hash53(text);
  store[FB.ROOM + '__v3_' + name + '_' + h + '_0'] = { h: S(h), d: S(text) };
  return { mapValue: { fields: { h: S(h), n: I(1), z: I(0) } } };
}
function seedSync() {
  const parts = {};
  parts.core = seedPart('core', {
    settings: { smbcDay: dayNum, rakutenDay: 27, fuyouLimit: 1030000 },
    statements: [{ id: 'st1', accountId: 'smbc', billingMonth: ym, amount: 50000, memo: '', createdAt: 0, mt: 0 }],
    ui: {},
    commute: { walk: 8, bus: 51, change: 15, train: 35, toSchool: 10, buffer: 10, periods: ['08:00', '10:40', '13:00', '14:40', '16:20', '18:00'], ends: ['09:30', '12:10', '14:30', '16:10', '17:50', '19:30'] },
    termsList: [], termId: '',
  });
  parts.plan = seedPart('plan', {
    events: [
      { id: 'ev1', date: tomorrow, dateEnd: '', time: '10:00', title: 'テスト予定', kind: 'other', rid: '', mt: 0 },
      { id: 'ev2', date: today, dateEnd: '', time: '13:30', title: '買い物', kind: 'other', rid: '', mt: 0 },
      { id: 'ev3', date: in3, dateEnd: '', time: '13:30', title: '歯医者', kind: 'other', rid: '', mt: 0 },
    ],
    tasks: [{ id: 'tk1', title: 'レポート', due: tomorrow, time: '', done: 0, mt: 0 }],
    exams: [{ id: 'ex1', subject: '数学', title: '中間テスト', date: in3, time: '13:00', kind: 'exam', mt: 0 }],
    holidays: [], breaks: [],
  });
  parts.money = seedPart('money', {
    balances: [{ id: 'b1', name: '三井住友銀行', amount: 10000, mt: 0 }],
    fixed: [], income: [],
    shifts: [{ id: 's1', date: today, start: '15:00', end: '19:00', title: 'バイト', mt: 0 }],
    spends: [{ id: 'sp1', date: today, amount: 800, io: 'out', title: 'ローソン', cat: 'food', mt: 0 }],
  });
  parts.maps = seedPart('maps', {
    payApplied: { [ym]: { amount: 60000, at: now - 3600000, bank: 'b1' } },
    courseMeta: {}, biweek: {},
  });
  parts.extra = seedPart('extra', {
    annivs: [{ id: 'an1', name: '家族の誕生日', date: tomorrow.slice(5), kind: 'birthday', who: 'family', mt: 0 }],
  });
  store[FB.ROOM + '__v3'] = { parts: { mapValue: { fields: parts } } };
}
function seedSnap() {
  store[FB.MONEYSNAP_DOC] = {
    balance: I(10000), hasBalance: B(true),
    balances: S('[]'), debits: S('[]'), transactions: S('[]'),
    subs: S(JSON.stringify([{ name: 'テスト年額プラン', renewDate: D.addDaysYmd(today, 14), amount: 6490 }])),
    updatedAt: S(new Date(now).toISOString()),
  };
}
function seedDevices() {
  store[FB.DEVICES_DOC] = { devices: S(JSON.stringify({ dev1: { token: 'tok1', prefs: {} } })), updatedAt: S(new Date(now).toISOString()) };
  store[FB.JOBS_DOC] = { jobs: S('[]'), updatedAt: S(new Date(now).toISOString()) };
}

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
  console.log('== 単体（_money / _plan） ==');
  {
    const empty = { core: null, plan: null, money: null, maps: null };
    const inc = M.incomeSummary(empty, null, today.slice(0, 4));
    ok(inc.enough === false && inc.limit === 1030000 && /仮の既定値/.test(inc.limitSource), '#35 データ不足は enough:false＋仮の既定値');
    const inc2 = M.incomeSummary({ core: { settings: { fuyouLimit: 1230000 } }, maps: { payApplied: { [ym]: { amount: 5000, at: now, bank: '' } } }, money: null, plan: null }, null, today.slice(0, 4));
    ok(inc2.total === 5000 && inc2.limit === 1230000 && inc2.limitSource === 'アプリの設定', '#35 payApplied とアプリ設定の上限');
    ok(M.classifyTitle('スタバでコーヒー', M.DEFAULT_RULES) === 'food', '#36 既定ルールで分類（food）');
    ok(M.classifyTitle('阪神電車で移動', M.DEFAULT_RULES) === 'move', '#36 既定ルールで分類（move）');
    const chk = M.debitMorningCheck({ core: { settings: {} }, money: null, maps: {}, plan: {} },
      { balance: 100, balances: [], debits: [{ date: today, amount: 500, label: 'テスト' }], transactions: [], subs: [] }, today);
    ok(chk && chk.short === true && chk.total === 500, '#32 snap のみでも当日チェックできる');
    const occ = P.occurrencesInRange({ plan: { events: [], tasks: [], exams: [] }, money: null },
      { annivs: [{ id: 'a', name: '元日テスト', date: '01-01', kind: 'anniv' }] },
      today.slice(0, 4) + '-12-30', (Number(today.slice(0, 4)) + 1) + '-01-02', []);
    ok(occ.length === 1 && occ[0].date === (Number(today.slice(0, 4)) + 1) + '-01-01', '#73 記念日は年をまたいで展開');
    const conf = P.conflictsForRange([
      { date: today, title: 'A', time: '13:00', endTime: '', kind: 'exam', shared: false },
      { date: today, title: 'B', time: '13:30', endTime: '', kind: 'event', shared: true, cal: '共有' },
      { date: today, title: 'C', time: '15:00', endTime: '16:00', kind: 'shift', shared: false },
    ], 119);
    ok(conf.some((w) => w.type === 'overlap' && w.b.shared === true), '#72/#78 重なり検出＋共有の区別');
    ok(conf.some((w) => w.type === 'tight' && w.gapMin === 30), '#72 間隔が通学時間より短い候補');
  }

  console.log('== cron（送信できる状態で2回＋重複防止の確認） ==');
  {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
      client_email: 'test@example.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    });
    process.env.CRON_SECRET = 's3cret';
    seedSync(); seedSnap(); seedDevices();
    const cron = require('../api/push/_cron');
    const auth = { authorization: 'Bearer s3cret' };
    if (quiet) {
      skipped('cron 本体（静かな時間帯のため生成系が止まる）');
    } else {
      const r1 = await call(cron, 'POST', '/api/push/cron', undefined, auth);
      const j1 = r1.json();
      ok(r1.statusCode === 200 && j1 && j1.ok === true, 'cron 1回目 200');
      ok(j1.debitam.planned === 1 && j1.debitam.sent === 1, '#32 朝の引落チェックが送られた（#7 より先に評価）');
      ok(j1.balance.planned === 0, '#7 #32 が送った日は残高警告を送らない（重複防止）');
      ok(j1.sub.planned === 1 && j1.sub.sent === 1, '#33 サブスク更新14日前が送られた');
      ok(j1.salary.planned === 1 && j1.salary.sent === 1, '#34 給与の入金かもが送られた');
      ok(j1.backup.added === 1, '#40 世代スナップショットが1つ作られた');
      if (nowMin >= 1140) {
        ok(j1.tomorrow.planned === 1, '#75 明日の予定が送られた');
        ok(j1.anniv.planned === 1, '#77 記念日の前日が送られた');
      } else { skipped('#75/#77（19時以降のゲート）'); }
      const r2 = await call(cron, 'POST', '/api/push/cron', undefined, auth);
      const j2 = r2.json();
      ok(j2.balance.planned === 0 && j2.debitam.planned === 0 && j2.sub.planned === 0 && j2.salary.planned === 0, 'cron 2回目：送信済みのものは作り直さない');
      ok(j2.backup.added === 0, '#40 世代は1日1つまで');
      /* #32 側の記録だけがある状態では #7 も送らない */
      store[FB.SENT_DOC] = { sent: S(JSON.stringify({ ['srv-debitam-' + today]: now })), updatedAt: S(new Date(now).toISOString()) };
      const r3 = await call(cron, 'POST', '/api/push/cron', undefined, auth);
      const j3 = r3.json();
      ok(j3.balance.planned === 0 && j3.debitam.planned === 0, '#7/#32 記録キーを共有して二重送信しない');
    }
  }

  console.log('== ハンドラー ==');
  {
    const imp = require('../api/money/_import');
    let r = await call(imp, 'POST', '/api/money/import', {
      balance: 30000,
      debits: [{ date: today, amount: 5000, label: 'テスト引落' }],
      transactions: [{ date: today, amount: 1200, io: 'out', title: 'セブン-イレブン', cat: 'food' }],
      subs: [{ name: '別プラン', renewDate: D.addDaysYmd(today, 30), amount: 1000 }],
    });
    ok(r.statusCode === 200 && r.json().counts.transactions === 1, '#31 import POST 保存');
    r = await call(imp, 'GET', '/api/money/import');
    ok(r.statusCode === 200 && r.json().snap.balance === 30000, '#31 import GET 最新を返す');

    const sum = require('../api/money/_summary');
    r = await call(sum, 'GET', '/api/money/summary');
    const sj = r.json();
    ok(r.statusCode === 200 && sj.income.total === 60000 && sj.income.enough === true, '#35 summary 年収累計（payApplied）');
    ok(sj.month.out === 800 && sj.month.source === 'sync', '#37 summary 今月の支出（同期の spends）');

    const rules = require('../api/money/_rules');
    r = await call(rules, 'POST', '/api/money/rules', { rules: [{ cat: 'food', keywords: ['テスト食堂'] }] });
    ok(r.statusCode === 200, '#36 rules POST 差し替え');
    r = await call(rules, 'GET', '/api/money/rules');
    ok(r.json().source === 'server' && M.classifyTitle('テスト食堂でランチ', r.json().rules) === 'food', '#36 rules GET＋分類に反映');
    const cfg = require('../api/config');
    r = await call(cfg, 'GET', '/api/config');
    ok(r.json().classRules && r.json().classRules.source === 'server', '#36 /api/config で配信');

    const cal = require('../api/_calendar');
    r = await call(cal, 'POST', '/api/calendar', {
      from: today, to: in3,
      items: [{ id: 'g1', title: '共有ミーティング', cal: '共有カレンダー', allDay: 0, start: today + 'T15:30', end: today + 'T16:30', where: '' }],
    });
    ok(r.statusCode === 200 && r.json().count === 1, '#71 calendar POST 受け口');
    r = await call(cal, 'GET', '/api/calendar');
    ok(r.statusCode === 200 && r.json().items.length === 1 && r.json().stale === false, '#71 calendar GET キャッシュ配信');

    const chk = require('../api/plan/_check');
    r = await call(chk, 'GET', '/api/plan/check');
    const cj = r.json();
    ok(r.statusCode === 200 && cj.commuteMin === 119, '#72 check 通学時間は設定から（119分）');
    ok(cj.warnings.some((w) => w.type === 'overlap'), '#72 check 重なりあり');
    ok(cj.warnings.some((w) => (w.a.shared || w.b.shared) && (w.a.cal === '共有カレンダー' || w.b.cal === '共有カレンダー')), '#78 check 共有予定を区別表示');

    const gaps = require('../api/plan/_gaps');
    r = await call(gaps, 'GET', '/api/plan/gaps?date=' + today);
    const gj = r.json();
    ok(r.statusCode === 200 && gj.gaps.length > 0 && gj.suggestions.some((s) => s.taskId === 'tk1'), '#76 gaps 空き時間＋課題の候補');

    const next = require('../api/plan/_next');
    r = await call(next, 'GET', '/api/plan/next');
    const nj = r.json();
    ok(r.statusCode === 200 && nj.items.some((i) => i.kind === 'exam' && i.daysLeft === 3), '#80 next 試験まで3日');
    ok(nj.items.some((i) => i.kind === 'anniv' && i.daysLeft === 1), '#80 next 記念日まで1日');

    /* 世代をもう1つ足して差分を見る */
    const gens = await M.loadGenerations();
    const older = { at: new Date(now - 86400000).toISOString(), ymd: D.addDaysYmd(today, -1), balance: 5000, balanceSource: 'sync', txCount: 0, txSource: 'sync', txKeys: [], planCounts: { events: 0, tasks: 0, exams: 0 }, planHash: 'x' };
    await M.saveGenerations([older].concat(gens));
    const hist = require('../api/plan/_history');
    r = await call(hist, 'GET', '/api/plan/history');
    const hj = r.json();
    ok(r.statusCode === 200 && hj.diff.enough === true && hj.diff.balance.delta === 5000, '#79 history 前回との差分（残高+5000）');

    const ics = require('../api/plan/_ics');
    delete process.env.PLAN_ICS_KEY; delete process.env.APP_API_SECRET;
    r = await call(ics, 'GET', '/api/plan/ics');
    ok(r.statusCode === 403 && r.json().code === 'NO_KEY', '#74 ics 合言葉未設定では配らない');
    process.env.PLAN_ICS_KEY = 'testkey123';
    r = await call(ics, 'GET', '/api/plan/ics?k=wrong');
    ok(r.statusCode === 403, '#74 ics 合言葉ちがいは 403');
    r = await call(ics, 'GET', '/api/plan/ics?k=testkey123');
    ok(r.statusCode === 200 && r.body.indexOf('BEGIN:VCALENDAR') === 0 && r.body.indexOf('SUMMARY:') > 0, '#74 ics 合言葉つきで生成');
    delete process.env.PLAN_ICS_KEY;
  }

  console.log(`\n結果: pass ${pass} / fail ${fail} / skip ${skip}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

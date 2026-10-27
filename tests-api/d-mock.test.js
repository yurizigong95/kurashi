/* バッチD モックテスト（Firestore・Gemini・気象庁・DeepL・Maps 等を fetch スタブで置き換えて実行）
   使い方: node tests-api/d-mock.test.js
   - 実キーは使わない。GEMINI_API_KEY は 'test-key'（スタブ相手）だけ。
   - PDF の抽出は本物の pdfjs-dist で確かめる（最小の PDF をテスト内で組み立てる）。 */
'use strict';

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✔ ' + name); }
  else { fail++; console.log('  ✘ ' + name); }
}

process.env.GEMINI_API_KEY = 'test-key';
delete process.env.FIREBASE_SERVICE_ACCOUNT;
delete process.env.APP_API_SECRET;
delete process.env.CRON_SECRET;
delete process.env.DEEPL_API_KEY;
delete process.env.GOOGLE_MAPS_KEY;
delete process.env.DISCORD_WEBHOOK_URL;
delete process.env.LINE_CHANNEL_TOKEN;
delete process.env.LINE_USER_ID;
delete process.env.GAS_MAIL_URL;
delete process.env.GAS_MAIL_SECRET;
delete process.env.WBGT_CSV_URL;

/* ===== スタブ ===== */
const S = (v) => ({ stringValue: String(v) });
const I = (v) => ({ integerValue: String(v) });
const store = {};   // docId -> fields(raw FS形式)
let forecastFixture = null;
let geminiText = 'テスト応答';
function geminiReplyFor(bodyText) {
  const t = String(bodyText || '');
  if (t.indexOf('学習問題') >= 0) return JSON.stringify([
    { qt: 'mc', q: '心臓のはたらきはどれか。', c: ['血液を送り出す', '呼吸をする', '消化をする', '尿を作る'], a: [0], exp: '心臓は血液を全身に送り出すポンプです。', tag: '循環器', lv: 2 },
    { qt: 'cloze', q: '心臓の右心房に入る静脈は（　）である。', at: '大静脈', exp: '大静脈から右心房へ入ります。', lv: 2 },
    { qt: 'mc', q: '壊れた問題（選択肢が1つ）', c: ['だけ'], a: [0] },
    { q: '' },
  ]);
  if (t.indexOf('健康診断') >= 0) return '■ 主な結果\n・Hb 13.5 g/dLで基準内でした';
  if (t.indexOf('文字起こし') >= 0) return 'これは文字起こしの結果です。';
  if (t.indexOf('書き起こし') >= 0) return 'OCRで読んだ文字です';
  if (t.indexOf('セリフを1つ') >= 0) return '「やあ、調子はどう？」';
  if (t.indexOf('翻訳して') >= 0) return 'Translated by Gemini';
  return geminiText;
}
global.fetch = async (url, opts) => {
  const u = String(url);
  const bodyText = opts && opts.body ? String(opts.body) : '';
  if (u.startsWith('https://generativelanguage.googleapis.com/v1beta/models?')) {
    return { status: 200, ok: true, json: async () => ({ models: [
      { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.8-pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
    ] }), text: async () => '' };
  }
  if (u.startsWith('https://generativelanguage.googleapis.com/v1beta/models/')) {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: geminiReplyFor(bodyText) }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    });
    return { status: 200, ok: true, json: async () => JSON.parse(payload), text: async () => payload };
  }
  if (u.startsWith('https://api-free.deepl.com/')) {
    return { status: 200, ok: true, json: async () => ({ translations: [{ text: 'Translated by DeepL' }] }), text: async () => '' };
  }
  if (u.startsWith('https://maps.googleapis.com/maps/api/geocode/')) {
    return { status: 200, ok: true, json: async () => ({ results: [{ formatted_address: '兵庫県西宮市', address_components: [{ long_name: '西宮市' }], geometry: { location: { lat: 34.7, lng: 135.3 } } }] }), text: async () => '' };
  }
  if (u.startsWith('https://maps.googleapis.com/maps/api/directions/')) {
    return { status: 200, ok: true, json: async () => ({ routes: [{ summary: '阪神線', legs: [{ distance: { text: '10km' }, duration: { text: '40分' }, steps: [{ html_instructions: '歩く', distance: { text: '100m' }, duration: { text: '2分' } }] }] }] }), text: async () => '' };
  }
  if (u.startsWith('https://discord.test/')) return { status: 204, ok: true, json: async () => ({}), text: async () => '' };
  if (u.startsWith('https://api.line.me/')) return { status: 200, ok: true, json: async () => ({}), text: async () => '{}' };
  if (u.startsWith('https://gas.test/')) return { status: 200, ok: true, json: async () => ({ ok: true }), text: async () => '{}' };
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
const HUB = require('../api/_hub');
const now = Date.now();
const today = D.ymdJst(now);
const tomorrow = D.addDaysYmd(today, 1);
const in3 = D.addDaysYmd(today, 3);

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
  await handler({ method, url, headers: headers || {}, body: body === undefined ? {} : body }, res);
  return res;
}

/* ===== 同期データのフィクスチャ ===== */
function seedPart(name, obj) {
  const text = JSON.stringify(obj);
  const h = D.hash53(text);
  store[FB.ROOM + '__v3_' + name + '_' + h + '_0'] = { h: S(h), d: S(text) };
  return { mapValue: { fields: { h: S(h), n: I(1), z: I(0) } } };
}
function seedSync(d) {
  const parts = {};
  ['core', 'plan', 'money', 'maps', 'extra'].forEach((k) => { if (d[k]) parts[k] = seedPart(k, d[k]); });
  store[FB.ROOM + '__v3'] = { parts: { mapValue: { fields: parts } } };
}
function baseData() {
  return {
    core: {
      settings: {},
      ui: { notify: { push: 1, am: 0, quiet: 0, dl3: 1, dl1: 1, dl0: 1, dlTime: '00:00', dlMorning: '00:00' } },
      termsList: [{ id: 't1', label: '後期', courses: [{ name: '解剖学', slots: '月1', room: 'A101' }] }],
      termId: 't1',
    },
    plan: {
      events: [{ id: 'ev1', title: '友達とランチ', date: tomorrow, time: '12:00', kind: 'event' }],
      tasks: [
        { id: 'tk1', title: '解剖学レポート', subject: '解剖学', due: tomorrow, done: 0, mt: 0 },
        { id: 'med1', title: 'B型肝炎ワクチン接種', subject: '', due: in3, done: 0, mt: 0 },
      ],
      exams: [{ id: 'ex1', subject: '解剖学', title: '中間テスト', date: in3, time: '13:00' }],
      health: [{ id: 'hl1', name: 'インフルエンザ予防接種', next: tomorrow, memo: '' }],
      holidays: [], breaks: [],
    },
    money: {
      balances: [], fixed: [], income: [], shifts: [],
      spends: [
        { id: 'sp1', date: today, amount: 800, io: 'out', title: 'ローソン', cat: 'food', mt: 0 },
        { id: 'sp2', date: today, amount: 3000, io: 'in', title: 'バイト代', cat: '', mt: 0 },
      ],
    },
    maps: { attendLog: {}, grades: {}, courseMeta: {}, syllabus: {} },
    extra: { annivs: [], kmItems: [
      { id: 'p1', mod: 'life', type: 'period', mt: 1, enc: 'b2:xxxx' },
      { id: 'p2', mod: 'life', type: 'period', mt: 2, enc: 'b2:yyyy' },
      { id: 'x1', mod: 'other', type: 'note', mt: 3 },
    ] },
  };
}
function makePdf(text) {
  const content = 'BT /F1 12 Tf 72 720 Td (' + text.replace(/[()\\]/g, '\\$&') + ') Tj ET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => { offsets.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + body + '\nendobj\n'; });
  const xrefPos = pdf.length;
  pdf += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
  offsets.forEach((o) => { pdf += String(o).padStart(10, '0') + ' 00000 n \n'; });
  pdf += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF';
  return Buffer.from(pdf, 'latin1').toString('base64');
}

(async () => {
  console.log('== _hub（#82・共通部品） ==');
  {
    ok(HUB.stable({ b: 1, a: { d: 4, c: 3 } }) === HUB.stable({ a: { c: 3, d: 4 }, b: 1 }), 'stable はキーの順に寄らない');
    const data = baseData();
    const f = HUB.syncFingerOf(data);
    ok(f.counts.tasks === 2 && f.counts.spends === 2 && !!f.fingers.plan, 'syncFingerOf の指紋と件数');
    const r1 = await HUB.takeSyncSnapIfNewDay(data, today, now);
    const r2 = await HUB.takeSyncSnapIfNewDay(data, today, now);
    ok(r1.added === true && r2.added === false, 'takeSyncSnapIfNewDay は1日1世代だけ');
  }

  console.log('== settings（#88・#81） ==');
  {
    const h = require('../api/settings');
    let r = await call(h, 'POST', '/api/settings', { common: { theme: 'pink' } });
    ok(r.statusCode === 200 && r.json().rev === 1, '共通設定を保存（rev 1）');
    r = await call(h, 'POST', '/api/settings', { deviceId: 'dev1', device: { theme: 'blue' }, baseRev: 1 });
    ok(r.statusCode === 200 && r.json().rev === 2, '端末別を版つきで保存（rev 2）');
    r = await call(h, 'GET', '/api/settings?deviceId=dev1');
    const j = r.json();
    ok(j.merged.theme === 'blue' && j.common.theme === 'pink', 'merged は端末別が優先');
    r = await call(h, 'POST', '/api/settings', { common: { theme: 'red' }, baseRev: 1 });
    ok(r.statusCode === 409, '古い baseRev は 409（#81 版チェック）');
  }

  console.log('== sync queue（#89） ==');
  {
    const h = require('../api/sync/queue');
    let r = await call(h, 'POST', '/api/sync/queue', { ops: [{ op: 'task.add', payload: { title: 'a' } }, { op: 'task.done', payload: { id: 1 } }] });
    ok(r.statusCode === 200 && r.json().accepted === 2 && r.json().lastSeq === 2, 'キューに連番で2件');
    r = await call(h, 'GET', '/api/sync/queue');
    const j = r.json();
    ok(j.pending === 2 && j.entries[0].seq === 2 && j.entries.every((e) => e.status === 'pending'), '保留のまま（自動適用しない）');
  }

  console.log('== transfer（#90・#199） ==');
  {
    const h = require('../api/transfer');
    let r = await call(h, 'POST', '/api/transfer', { action: 'issue' });
    const code = r.json() && r.json().code;
    ok(r.statusCode === 200 && /^[A-Z2-9]{12}$/.test(code || ''), '移行コード発行');
    r = await call(h, 'GET', '/api/transfer?code=' + code);
    ok(r.statusCode === 200 && r.json().room === FB.ROOM, 'コードで部屋IDが得られる');
    r = await call(h, 'GET', '/api/transfer?code=' + code);
    ok(r.statusCode === 404, '使用済みコードは再利用できない');
  }

  console.log('== study/time（#65） ==');
  {
    const h = require('../api/study/time');
    let r = await call(h, 'POST', '/api/study/time', { date: today, minutes: 45, subject: '解剖学' });
    ok(r.statusCode === 200, '勉強時間を記録');
    r = await call(h, 'POST', '/api/study/time', { date: today, minutes: 30, subject: '英語' });
    r = await call(h, 'GET', '/api/study/time');
    const j = r.json();
    ok(j.week.total === 75 && j.month.total === 75 && j.week.bySubject['解剖学'] === 45, '週・月の集計が確定値で返る');
    r = await call(h, 'POST', '/api/study/time', { date: '2026-13-40', minutes: 10 });
    ok(r.statusCode === 400, 'おかしい日付は 400');
  }

  console.log('== study/generate（#61） ==');
  {
    const h = require('../api/study/generate');
    let r = await call(h, 'POST', '/api/study/generate', { topic: '循環器', count: 5, level: 2 });
    const j = r.json();
    ok(r.statusCode === 200 && j.ok === true && j.items.length === 2, 'AI生成＋形の悪い問題は捨てる（4件中2件）');
    ok(j.items[0].qt === 'mc' && j.items[0].c.length === 4 && j.items[1].qt === 'cloze' && j.items[1].at === '大静脈', 'gItem の形にそろっている');
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    r = await call(h, 'POST', '/api/study/generate', { topic: '循環器' });
    ok(r.json().ok === false && r.json().reason === 'NO_KEY' && r.json().items.length === 0, '鍵が無ければ作り話を返さない');
    process.env.GEMINI_API_KEY = saved;
  }

  console.log('== study/summarize（#66）・transcribe（#67） ==');
  {
    const h = require('../api/study/summarize');
    geminiText = '要点その1。要点その2。';
    let r = await call(h, 'POST', '/api/study/summarize', { text: '短い文章です。' });
    ok(r.json().ok === true && r.json().chunks === 1, '短文は1かたまりで要約');
    r = await call(h, 'POST', '/api/study/summarize', { text: 'あ'.repeat(9000) });
    ok(r.json().ok === true && r.json().chunks === 2, '長文は分割して要約');
    r = await call(h, 'POST', '/api/study/summarize', { text: 'あ'.repeat(60001) });
    ok(r.statusCode === 413, '上限超えは 413');
    const t = require('../api/study/transcribe');
    const b64 = Buffer.from('fakeaudio').toString('base64');
    r = await call(t, 'POST', '/api/study/transcribe', { audioBase64: b64, mime: 'audio/wav' });
    ok(r.json().ok === true && r.json().text.indexOf('文字起こし') >= 0, '音声の文字起こし');
    r = await call(t, 'POST', '/api/study/transcribe', { audioBase64: b64, mime: 'video/mp4' });
    ok(r.statusCode === 415, '対応外の形式は 415');
  }

  console.log('== study/questions（#197） ==');
  {
    const h = require('../api/study/questions');
    let r = await call(h, 'GET', '/api/study/questions');
    ok(r.json().ok === true && r.json().empty === true && r.json().sets.length === 0, '問題セットが無ければ empty');
    store[FB.CONFIG_DOC] = Object.assign({}, store[FB.CONFIG_DOC], {
      examSets: S(JSON.stringify({ sets: [{ id: 'k1', title: '国試セット', items: [{ qt: 'mc', q: 'q', c: ['a', 'b'], a: [0] }] }] })),
    });
    r = await call(h, 'GET', '/api/study/questions');
    ok(r.json().sets.length === 1 && r.json().sets[0].items.length === 1, '設定docの問題セットを配信');
  }

  console.log('== translate（#68） ==');
  {
    const h = require('../api/translate');
    let r = await call(h, 'POST', '/api/translate', { text: 'こんにちは', to: 'en' });
    ok(r.json().ok === true && r.json().via === 'gemini', 'DeepL鍵が無ければ Gemini で翻訳');
    process.env.DEEPL_API_KEY = 'dummy:fx';
    r = await call(h, 'POST', '/api/translate', { text: 'こんにちは', to: 'en' });
    ok(r.json().ok === true && r.json().via === 'deepl' && r.json().text === 'Translated by DeepL', 'DeepL鍵があれば DeepL を使う');
    delete process.env.DEEPL_API_KEY;
  }

  console.log('== ocr（#146）・photo/hash（#147） ==');
  {
    const h = require('../api/ocr');
    const b64 = Buffer.from('fakeimage').toString('base64');
    let r = await call(h, 'POST', '/api/ocr', { imageBase64: 'data:image/png;base64,' + b64 });
    ok(r.json().ok === true && r.json().text.indexOf('OCR') >= 0, '画像の文字起こし（data URL 形式）');
    r = await call(h, 'POST', '/api/ocr', { imageBase64: b64, mime: 'image/tiff' });
    ok(r.statusCode === 415, '対応外の画像形式は 415');
    const ph = require('../api/photo/hash');
    r = await call(ph, 'POST', '/api/photo/hash', { hash: 'abcdef0123456789' });
    ok(r.json().duplicate === false, '初めての指紋は登録');
    r = await call(ph, 'POST', '/api/photo/hash', { hash: 'abcdef0123456789' });
    ok(r.json().duplicate === true && !!r.json().firstAt, '同じ指紋は重複として検知');
  }

  console.log('== voice（#191） ==');
  {
    const h = require('../api/voice');
    geminiText = '大丈夫、少しずつ進めばいいよ。';
    const r = await call(h, 'POST', '/api/voice', { text: '勉強が不安です' });
    ok(r.json().ok === true && r.json().reply === geminiText && /文章だけ/.test(r.json().note), '文章の返事＋TTSなしの明示');
  }

  console.log('== health（#84・#182・#188・#190） ==');
  {
    const h = require('../api/health');
    let r = await call(h, 'GET', '/api/health');
    const j = r.json();
    ok(j.ok === true && j.checks.firestore === 'ok' && j.checks.geminiKey === true && !!j.checks.model, '自己点検が状態を返す');

    seedSync(baseData());
    const cyc = require('../api/health/cycle');
    r = await call(cyc, 'GET', '/api/health/cycle');
    const cj = r.json();
    ok(cj.enough === false && cj.syncedPeriodItems === 2 && /Apple Health/.test(cj.note), '周期は件数だけ（内容は解読しない・予測はしない）');

    const rep = require('../api/health/report');
    r = await call(rep, 'POST', '/api/health/report', { pdfBase64: makePdf('Hb 13.5 g/dL') });
    const rj = r.json();
    ok(rj.ok === true && rj.saved === true && rj.pages === 1 && /Hb/.test(rj.summary), '健診PDFを抽出＋要約＋保存');
    r = await call(rep, 'GET', '/api/health/report');
    ok(r.json().reports.length === 1, '保存した要約が読める');
    r = await call(rep, 'POST', '/api/health/report', { pdfBase64: '' });
    ok(r.statusCode === 400, '空の PDF は 400');

    const d1 = D.addDaysYmd(today, -2), d2 = D.addDaysYmd(today, -1);
    store[FB.ARRIVE_DOC] = { entries: S(JSON.stringify([
      { date: d1, time: '08:10', place: '学校', at: new Date(now - 2 * 86400000).toISOString() },
      { date: d2, time: '08:40', place: '学校', at: new Date(now - 86400000).toISOString() },
      { date: today, time: '09:05', place: '学校', at: new Date(now).toISOString() },
    ])), updatedAt: S(new Date().toISOString()) };
    store[FB.LOG_DOC] = { entries: S(JSON.stringify([
      { at: new Date(now - 2 * 86400000).toISOString(), level: 'error', msg: 'x', ctx: '' },
      { at: new Date(now).toISOString(), level: 'perf', msg: 'pageview', ctx: '' },
    ])), updatedAt: S(new Date().toISOString()) };
    const rhy = require('../api/health/rhythm');
    r = await call(rhy, 'GET', '/api/health/rhythm');
    const yj = r.json();
    ok(yj.enough === true && yj.arrivals.days === 3 && yj.arrivals.mean === 8 * 60 + 38, '到着時刻の平均とばらつき（睡眠データなしの明示つき）');
  }

  console.log('== export（#86）・search（#87/#194） ==');
  {
    seedSync(baseData());
    const h = require('../api/export');
    let r = await call(h, 'GET', '/api/export?kind=money&format=csv');
    ok(r.statusCode === 200 && r.body.indexOf('date,io,amount,title,cat') === 0 && r.body.indexOf('ローソン') > 0, 'お金の CSV 書き出し');
    r = await call(h, 'GET', '/api/export?kind=plan&format=json');
    ok(r.json().plan.tasks.length === 2 && r.json().plan.exams.length === 1, '予定の JSON 書き出し');
    const s = require('../api/search');
    r = await call(s, 'GET', '/api/search?q=' + encodeURIComponent('レポート'));
    ok(r.json().total === 1 && r.json().hits.tasks[0].title === '解剖学レポート', '課題を横断検索');
    r = await call(s, 'GET', '/api/search?q=' + encodeURIComponent('ローソン'));
    ok(r.json().hits.spends.length === 1, '明細を横断検索');
    r = await call(s, 'GET', '/api/search?q=' + encodeURIComponent('b2'));
    ok(r.json().total === 0, '周期の暗号化された記録は検索に出ない');
  }

  console.log('== game（#151〜#160） ==');
  {
    const score = require('../api/game/score');
    let r = await call(score, 'POST', '/api/game/score', { game: 'chess', name: 'ゆり', score: 1200 });
    ok(r.statusCode === 200 && r.json().record.score === 1200, 'スコア登録');
    r = await call(score, 'POST', '/api/game/score', { game: 'chess', name: 'あきら', score: 1500 });
    r = await call(score, 'POST', '/api/game/score', { game: 'chess', name: 'わるい', score: -5 });
    ok(r.statusCode === 400, '負のスコアは 400（範囲検証）');
    r = await call(score, 'GET', '/api/game/score?game=chess');
    ok(r.json().top[0].score === 1500 && r.json().top.length === 2, 'ランキング順に返る');
    const ranking = require('../api/game/ranking');
    r = await call(ranking, 'GET', '/api/game/ranking?game=chess');
    ok(r.json().allTime.length === 2 && r.json().weekly === null, '週間集計が無ければ weekly:null');

    const save = require('../api/game/save');
    r = await call(save, 'POST', '/api/game/save', { game: 'chess', data: { board: 'start', turn: 3 } });
    const code = r.json() && r.json().code;
    ok(r.statusCode === 200 && /^[A-Z2-9]{8}$/.test(code || ''), 'セーブコード発行');
    r = await call(save, 'GET', '/api/game/save?code=' + code);
    ok(r.json().data && r.json().data.turn === 3, 'コードでセーブを読み戻せる');
    r = await call(save, 'GET', '/api/game/save?code=ZZZZZZZZ');
    ok(r.statusCode === 404, '無いコードは 404');

    const daily = require('../api/game/daily');
    const r1 = await call(daily, 'GET', '/api/game/daily');
    const r2 = await call(daily, 'GET', '/api/game/daily');
    ok(r1.json().date === today && r1.json().missions.length === 3 && JSON.stringify(r1.json().missions) === JSON.stringify(r2.json().missions), 'デイリーはサーバー日付で全端末同じ');

    const record = require('../api/game/record');
    r = await call(record, 'POST', '/api/game/record', { game: 'chess', kind: 'move', data: { from: 'a1', to: 'a2' } });
    ok(r.json().seq === 1, '記録に連番（ポーリング用）');
    r = await call(record, 'POST', '/api/game/record', { game: 'chess', kind: 'move', data: { from: 'b1', to: 'b2' } });
    r = await call(record, 'GET', '/api/game/record?game=chess&kind=move&since=1');
    ok(r.json().records.length === 1 && r.json().records[0].seq === 2 && r.json().lastSeq === 2, 'since で差分だけ引ける（#151 ポーリング）');

    const pet = require('../api/game/pet');
    r = await call(pet, 'POST', '/api/game/pet', { key: 'momo', name: 'モモ' });
    ok(r.json().pet.stage === 'たまご' && r.json().pet.mood === 'げんき', 'ペット登録（生まれたて）');
    const pets = JSON.parse(store[FB.GAME_DOC].pets.stringValue);
    pets.momo.bornAt = new Date(now - 10 * 86400000).toISOString();
    pets.momo.lastSeenAt = new Date(now - 4 * 86400000).toISOString();
    store[FB.GAME_DOC] = Object.assign({}, store[FB.GAME_DOC], { pets: S(JSON.stringify(pets)) });
    r = await call(pet, 'GET', '/api/game/pet?key=momo');
    ok(r.json().pet.stage === 'わかば' && r.json().pet.mood === 'すねてる' && r.json().pet.ageDays === 10, '経過日数で成長と機嫌を判定（端末を閉じていても進む）');

    const talk = require('../api/game/talk');
    r = await call(talk, 'POST', '/api/game/talk', { game: 'chess', char: '先生', situation: '対局開始' });
    ok(r.json().ok === true && r.json().source === 'ai', 'セリフを生成');
    r = await call(talk, 'POST', '/api/game/talk', { game: 'chess', char: '先生', situation: '対局開始' });
    ok(r.json().source === 'cache', '同じ条件はキャッシュを使い回す（#158）');
  }

  console.log('== notify / mail / maps / wx（#161〜#165・#163） ==');
  {
    const dc = require('../api/notify/discord');
    let r = await call(dc, 'POST', '/api/notify/discord', { text: 'テスト' });
    ok(r.statusCode === 501 && r.json().code === 'NO_HOOK', 'Discord 未設定は 501 NO_HOOK');
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/hook';
    r = await call(dc, 'POST', '/api/notify/discord', { text: 'テスト' });
    ok(r.statusCode === 200 && r.json().ok === true, 'Discord に送信');
    delete process.env.DISCORD_WEBHOOK_URL;

    const line = require('../api/notify/line');
    r = await call(line, 'POST', '/api/notify/line', { text: 'テスト' });
    ok(r.statusCode === 501 && r.json().code === 'NO_ENV', 'LINE 未設定は 501 NO_ENV');

    const mail = require('../api/mail');
    r = await call(mail, 'POST', '/api/mail', { subject: '週次レポート', body: '本文です', kind: 'weekly' });
    ok(r.json().ok === false && r.json().queued === true && r.json().reason === 'NO_BRIDGE', 'ブリッジが無ければ送信箱へ（送ったことにしない）');
    r = await call(mail, 'GET', '/api/mail');
    ok(r.json().outbox.length === 1 && r.json().outbox[0].subject === '週次レポート', '送信箱に残っている');
    process.env.GAS_MAIL_URL = 'https://gas.test/mail';
    process.env.GAS_MAIL_SECRET = 'secret';
    r = await call(mail, 'POST', '/api/mail', { subject: '2通目', body: '本文' });
    ok(r.json().ok === true && r.json().via === 'gas', 'ブリッジがあれば中継する');
    delete process.env.GAS_MAIL_URL;
    delete process.env.GAS_MAIL_SECRET;

    const maps = require('../api/maps');
    r = await call(maps, 'GET', '/api/maps?mode=geocode&q=' + encodeURIComponent('西宮市'));
    ok(r.statusCode === 501 && r.json().code === 'NO_KEY', 'Maps 未設定は 501 NO_KEY');
    process.env.GOOGLE_MAPS_KEY = 'dummy';
    r = await call(maps, 'GET', '/api/maps?mode=geocode&q=' + encodeURIComponent('西宮市'));
    ok(r.json().ok === true && r.json().results[0].lat === 34.7, 'ジオコーディングを中継');
    r = await call(maps, 'GET', '/api/maps?mode=route&origin=A&destination=B');
    ok(r.json().ok === true && r.json().routes[0].durationText === '40分', '経路を中継');
    delete process.env.GOOGLE_MAPS_KEY;

    forecastFixture = [{ timeSeries: [{ timeDefines: [today + 'T00:00:00+09:00', tomorrow + 'T00:00:00+09:00'], areas: [{ area: { code: '280010' }, pops: ['50', '20'] }] }] }];
    const wx = require('../api/wx');
    r = await call(wx, 'GET', '/api/wx');
    ok(r.json().ok === true && r.json().source === 'live' && r.json().today.pop === 50, '天気を取得（#165）');
    r = await call(wx, 'GET', '/api/wx');
    ok(r.json().source === 'cache', '2回目はサーバーキャッシュ');
  }

  console.log('== config（#154・#200）・money import 版チェック（#81） ==');
  {
    const cfg = require('../api/config');
    let r = await call(cfg, 'GET', '/api/config');
    const j = r.json();
    ok(Array.isArray(j.endpoints) && j.endpoints.length >= 58 && j.endpoints.some((e) => e.path === '/api/game/talk'), '秘書APIの目録（#200）');
    ok(j.events === null, 'イベント未登録なら events:null（#154）');
    store[FB.CONFIG_DOC] = Object.assign({}, store[FB.CONFIG_DOC], { events: S(JSON.stringify([{ id: 'ev1', title: '季節イベント', from: today, to: tomorrow }])) });
    r = await call(cfg, 'GET', '/api/config');
    ok(Array.isArray(r.json().events) && r.json().events[0].id === 'ev1', '設定docのイベントを配信（#154）');

    const imp = require('../api/money/import');
    r = await call(imp, 'POST', '/api/money/import', { balance: 5000, balances: [{ name: '銀行', amount: 5000 }] });
    const upd = r.json() && r.json().updatedAt;
    ok(r.statusCode === 200 && !!upd, 'スナップショット取り込み');
    r = await call(imp, 'POST', '/api/money/import', { balance: 6000, baseUpdatedAt: '1999-01-01T00:00:00.000Z' });
    ok(r.statusCode === 409, '古い版の取り込みは 409（#81）');
    r = await call(imp, 'POST', '/api/money/import', { balance: 6000, baseUpdatedAt: upd });
    ok(r.statusCode === 200, '今の版を指していれば取り込める');
  }

  console.log('== cron 回帰（バッチDの追加分） ==');
  {
    const cd = baseData();
    cd.plan.tasks.push({ id: 'tk9', title: '追加の課題', subject: '', due: tomorrow, done: 0, mt: 0 });
    seedSync(cd);
    delete store[FB.SNAPSHOTS_DOC];   /* その日の世代はまだ無い状態から cron を回す */
    const cron = require('../api/push/cron');
    const r = await call(cron, 'GET', '/api/push/cron');
    ok(r.statusCode === 501, '送信鍵なしでは 501（従来どおり）');
    const j = r.json();
    ok(j.syncsnap && j.syncsnap.added === 1, '同期スナップショットが世代に足された（#82）');
    ok(j.selfcheck && j.selfcheck.ok === 1, '自己点検が cron で回った（#84）');
    ok(j.med && j.med.planned >= 2, '服薬・ワクチン監視が課題と健康項目を拾った（#183）: planned=' + (j.med && j.med.planned));
    ok(j.site && j.site.checked === 0, 'サイト監視は URL 未設定なら無処理（#166）');
    const logDoc = store[FB.CRONLOG_DOC];
    const entries = logDoc ? JSON.parse(logDoc.entries.stringValue) : [];
    ok(entries.length >= 1 && entries[entries.length - 1].selfcheck && entries[entries.length - 1].selfcheck.ok === 1, 'cron ログに自己点検が残る');
    const snapDoc = store[FB.SNAPSHOTS_DOC];
    const gens = snapDoc && snapDoc.syncGens ? JSON.parse(snapDoc.syncGens.stringValue) : [];
    ok(gens.length === 1 && gens[0].counts.tasks === 3, 'syncGens に指紋と件数');
  }

  console.log('\n結果: pass ' + pass + ' / fail ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('テスト自体が落ちました', e); process.exit(2); });

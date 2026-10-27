/* 統合ルーターのディスパッチテスト（関数数上限対策のリストラクチャ検証）
   使い方: node tests-api/router-mock.test.js
   - api/app.js（?name= / ?area=&name=）と api/push.js（?op=）が、
     全ルートを正しいハンドラーへ届けることをモックで確認する。
   - 「届いた」判定: ルーター自身の 404（route not found / unknown op）でも
     ハンドラーの読み込み失敗（handler load failed）でもないこと。
     ハンドラーが返す 400/403/405/501 などは「届いた」として扱う。
   - 実キー・実ネットワークは使わない（Firestore / Google 系は fetch スタブ）。 */
'use strict';

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✔ ' + name); }
  else { fail++; console.log('  ✘ ' + name); }
}

/* ===== fetch スタブ（Firestore は空ストア、その他は素直に失敗させる） ===== */
const store = {};
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
  /* 気象庁・Google 等の外部は「取れなかった」形で返す（ハンドラー側の失敗応答を確認する） */
  return { status: 400, ok: false, json: async () => ({ error: { message: 'stub' } }), text: async () => '' };
};

/* ===== req / res モック ===== */
function mockRes() {
  return {
    statusCode: 0, headers: {}, body: '',
    setHeader(k, v) { this.headers[k] = v; },
    end(b) { this.body = b || ''; },
    json() { try { return JSON.parse(this.body); } catch (e) { return null; } },
  };
}
async function call(handler, method, url, body) {
  const res = mockRes();
  const req = { method, url, headers: {}, body };
  req[Symbol.asyncIterator] = async function* () { /* 空のリクエスト本文 */ };
  await handler(req, res);
  return res;
}

const app = require('../api/app');
const push = require('../api/push');

const SINGLE = ['log', 'fetch', 'hook', 'pdf', 'ocr', 'translate', 'voice', 'wx', 'maps', 'mail',
  'search', 'settings', 'export', 'transfer', 'transit', 'calendar', 'health'];
const AREAS = {
  money: ['import', 'rules', 'summary'],
  plan: ['check', 'gaps', 'history', 'ics', 'lasttrain', 'learn', 'next'],
  study: ['generate', 'plan', 'questions', 'summarize', 'time', 'transcribe'],
  game: ['daily', 'pet', 'ranking', 'record', 'save', 'score', 'talk'],
  health: ['cycle', 'report', 'rhythm'],
  notify: ['discord', 'line'],
  attend: ['arrive'],
  share: ['create', 'view'],
  photo: ['hash'],
  sync: ['queue'],
};
const OPS = ['register', 'remove', 'send', 'jobs', 'cron'];

async function reached(handler, url, label, notFoundError) {
  let res = null, threw = '';
  try { res = await call(handler, 'GET', url); } catch (e) { threw = e && e.message; }
  if (threw) { ok(true, label + '（ハンドラー到達・例外: ' + String(threw).slice(0, 60) + '）'); return; }
  const j = res.json();
  ok(!(j && j.error === notFoundError) && !(j && j.error === 'handler load failed'),
    label + ' → ' + res.statusCode);
}

(async () => {
  console.log('== app.js 単段ルート ==');
  for (const name of SINGLE) {
    await reached(app, '/api/app?name=' + name, 'name=' + name, 'route not found');
  }
  console.log('== app.js 二段ルート ==');
  for (const area of Object.keys(AREAS)) {
    for (const name of AREAS[area]) {
      await reached(app, '/api/app?area=' + area + '&name=' + name, area + '/' + name, 'route not found');
    }
  }
  console.log('== app.js パス形式フォールバック ==');
  await reached(app, '/api/plan/next', '/api/plan/next（パス形式）', 'route not found');
  await reached(app, '/api/health', '/api/health（パス形式）', 'route not found');

  console.log('== app.js 存在しない組み合わせは 404 ==');
  {
    const r1 = await call(app, 'GET', '/api/app?name=nope');
    ok(r1.statusCode === 404 && r1.json() && r1.json().error === 'route not found', 'name=nope は 404');
    const r2 = await call(app, 'GET', '/api/app?area=plan&name=nope');
    ok(r2.statusCode === 404 && r2.json() && r2.json().error === 'route not found', 'plan/nope は 404');
    const r3 = await call(app, 'GET', '/api/app?area=nope&name=next');
    ok(r3.statusCode === 404 && r3.json() && r3.json().error === 'route not found', 'nope/next は 404');
    const r4 = await call(app, 'GET', '/api/app');
    ok(r4.statusCode === 404 && r4.json() && r4.json().error === 'route not found', 'パラメータなしは 404');
    const r5 = await call(app, 'GET', '/api/app?area=health&name=health');
    ok(r5.statusCode === 404, 'health/health（単段専用）は二段では 404');
  }

  console.log('== push.js ディスパッチ ==');
  for (const op of OPS) {
    await reached(push, '/api/push?op=' + op, 'op=' + op, 'unknown op');
  }
  await reached(push, '/api/push/cron', '/api/push/cron（パス形式）', 'unknown op');
  {
    const r1 = await call(push, 'GET', '/api/push?op=nope');
    ok(r1.statusCode === 404 && r1.json() && r1.json().error === 'unknown op', 'op=nope は 404');
    const r2 = await call(push, 'GET', '/api/push');
    ok(r2.statusCode === 404 && r2.json() && r2.json().error === 'unknown op', 'op なしは 404');
  }

  console.log('\n結果: pass ' + pass + ' / fail ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

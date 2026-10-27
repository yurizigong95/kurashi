/* くらしの手帳 Vercel API 共通部品（Firebase / FCM）
   - 同期先の Firebase は GitHub Pages 版とまったく同じプロジェクト・同じ部屋を使います。
   - 通知の登録簿は、Firestore の shiharai コレクションに
     「部屋ID__notify_v1」（端末一覧）と「部屋ID__notify_jobs_v1」（送信予定）として置きます。
     既存の同期ルール（部屋IDで始まる文書は読み書き可）の範囲内です。
   - FCM の送信にはサービスアカウント鍵が要ります。Vercel の環境変数
     FIREBASE_SERVICE_ACCOUNT（JSON文字列）を入れたときだけ送信できます。 */
'use strict';
const crypto = require('crypto');

const FB = {
  /* アプリ本体（js/core.js の DEFAULT_FB）と同じ公開設定。apiKey は環境変数 FB_API_KEY から読む */
  apiKey: process.env.FB_API_KEY || '',
  projectId: 'kurashi-59562',
};
function keyParam() { return FB.apiKey ? '?key=' + FB.apiKey : ''; }
function keyParamAmp() { return FB.apiKey ? '&key=' + FB.apiKey : ''; }
const ROOM = '8b7f4e6et9jhxded';
const DEVICES_DOC = ROOM + '__notify_v1';
const JOBS_DOC = ROOM + '__notify_jobs_v1';

const FS_BASE = 'https://firestore.googleapis.com/v1/projects/' + FB.projectId + '/databases/(default)/documents';

function sendJson(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-goog-api-key, x-kurashi-model');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try { return JSON.parse(text); } catch (e) { return {}; }
}

/* --- Firestore REST（アプリ本体と同じ公開設定・同じルールの範囲で読み書き） --- */
function toFsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  return { stringValue: JSON.stringify(v) };
}
function fromFsFields(fields) {
  const out = {};
  if (!fields) return out;
  for (const k of Object.keys(fields)) {
    const f = fields[k];
    if ('stringValue' in f) out[k] = f.stringValue;
    else if ('integerValue' in f) out[k] = Number(f.integerValue);
    else if ('doubleValue' in f) out[k] = f.doubleValue;
    else if ('booleanValue' in f) out[k] = f.booleanValue;
    else if ('timestampValue' in f) out[k] = f.timestampValue;
    else out[k] = null;
  }
  return out;
}
async function fsGetDoc(id) {
  const r = await fetch(FS_BASE + '/shiharai/' + encodeURIComponent(id) + keyParam());
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Firestore get failed: ' + r.status);
  const j = await r.json();
  return fromFsFields(j.fields);
}
async function fsSetDoc(id, obj) {
  const fields = {};
  for (const k of Object.keys(obj)) fields[k] = toFsValue(obj[k]);
  const keys = Object.keys(fields);
  const mask = keys.map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const r = await fetch(FS_BASE + '/shiharai/' + encodeURIComponent(id) + '?' + mask + keyParamAmp(), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error('Firestore set failed: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return true;
}

/* --- 通知の登録簿 --- */
async function loadDevices() {
  const doc = await fsGetDoc(DEVICES_DOC);
  if (!doc || !doc.devices) return {};
  try { return JSON.parse(doc.devices) || {}; } catch (e) { return {}; }
}
async function saveDevices(devices) {
  await fsSetDoc(DEVICES_DOC, { devices: JSON.stringify(devices), updatedAt: new Date().toISOString() });
}
async function loadJobs() {
  const doc = await fsGetDoc(JOBS_DOC);
  if (!doc || !doc.jobs) return [];
  try { return JSON.parse(doc.jobs) || []; } catch (e) { return []; }
}
async function saveJobs(jobs) {
  await fsSetDoc(JOBS_DOC, { jobs: JSON.stringify(jobs), updatedAt: new Date().toISOString() });
}

/* --- FCM 送信（サービスアカウント） --- */
function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
let tokenCache = { at: 0, token: '' };
async function fcmAccessToken(sa) {
  if (tokenCache.token && Date.now() - tokenCache.at < 50 * 60 * 1000) return tokenCache.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(header + '.' + claim);
  const sig = b64url(signer.sign(sa.private_key));
  const jwt = header + '.' + claim + '.' + sig;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + encodeURIComponent(jwt),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('FCM token failed: ' + r.status);
  tokenCache = { at: Date.now(), token: j.access_token };
  return tokenCache.token;
}
async function fcmSendTo(token, title, body, url) {
  const sa = serviceAccount();
  if (!sa) return { ok: false, code: 'NO_SA', error: 'FIREBASE_SERVICE_ACCOUNT が未設定です' };
  const access = await fcmAccessToken(sa);
  const r = await fetch('https://fcm.googleapis.com/v1/projects/' + FB.projectId + '/messages:send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + access },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: title || 'くらしの手帳', body: body || '' },
        data: { title: title || 'くらしの手帳', body: body || '', url: url || './' },
        webpush: { fcm_options: { link: url || './' } },
      },
    }),
  });
  const text = await r.text();
  return { ok: r.ok, code: r.status, body: text.slice(0, 300) };
}

module.exports = {
  FB, ROOM, DEVICES_DOC, JOBS_DOC,
  sendJson, readBody,
  fsGetDoc, fsSetDoc,
  loadDevices, saveDevices, loadJobs, saveJobs,
  serviceAccount, fcmSendTo,
};

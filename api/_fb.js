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
/* AI まわりの設定・記録（いずれも部屋IDで始まる文書なので既存ルールの範囲内） */
const CONFIG_DOC = ROOM + '__config_v1';   // モデル自動解決の結果
const LOG_DOC = ROOM + '__log_v1';         // 動作ログ
const INBOX_DOC = ROOM + '__inbox_v1';     // 受信箱
const USAGE_DOC = ROOM + '__usage_v1';     // Gemini の利用回数・トークン数
/* サーバー側で作る通知（api/push/cron.js）の記録 */
const SENT_DOC = ROOM + '__notify_sent_v1';  // 送信済みの記録（同じ通知を2回送らない）
const CRONLOG_DOC = ROOM + '__cronlog_v1';   // cron の実行ログ
const MONEYSNAP_DOC = ROOM + '__moneysnap_v1'; // 残高スナップショット（同期データが読めないときの予備）
/* バッチC1（お金・予定の自動化） */
const SNAPSHOTS_DOC = ROOM + '__snapshots_v1'; // 世代スナップショット（#40。moneysnap＋予定の要約だけを日次で最大12世代）
const RULES_DOC = ROOM + '__rules_v1';         // 家計簿の自動分類ルール（#36）
const GCAL_DOC = ROOM + '__gcal_v1';           // Googleカレンダーの読み取り結果のキャッシュ（#71）
/* バッチC2（差分検知・通学・共有） */
const WATCH_DOC = ROOM + '__watch_v1';         // 差分検知の前回状態＋前回のサブスク監査の指紋（#41〜#45・#50・#127）
const ARRIVE_DOC = ROOM + '__arrive_v1';       // 学校に着いた記録（#60）
const TRANSIT_DOC = ROOM + '__transit_v1';     // サーバー配信の時刻表（#51）
const SHARE_DOC = ROOM + '__share_v1';         // 時間割・課題の共有コード（#49）
/* バッチD（勉強・同期・ゲーム・連携・健康） */
const SETTINGS_DOC = ROOM + '__settings_v1';   // 端末別設定（共通＋端末別の上書き。#88）
const TRANSFER_DOC = ROOM + '__transfer_v1';   // データ移行のワンタイムコード（#90・#199）
const QUEUE_DOC = ROOM + '__queue_v1';         // オフライン変更キュー（保留のまま置く。#89）
const OUTBOX_DOC = ROOM + '__outbox_v1';       // 送れなかったメールの送信箱（#163・#140）
const STUDYTIME_DOC = ROOM + '__studytime_v1'; // 勉強時間の確定記録（#65）
const PHOTOHASH_DOC = ROOM + '__photohash_v1'; // 写真の指紋の台帳（#147）
const GAME_DOC = ROOM + '__game_v1';           // ゲーム道場のサーバー記録（スコア・セーブ・記録・ペット。#151〜#160）
const TALK_DOC = ROOM + '__gametalk_v1';       // ゲームのセリフ生成のキャッシュ（#158）
const HEALTH_DOC = ROOM + '__health_v1';       // 健診レポートの要約の保存（#188）
const ARCHIVE_DOC = ROOM + '__archive_v1';     // 年度アーカイブ（#195）
const SITE_DOC = ROOM + '__sitewatch_v1';      // 外部サイトの更新チェックの前回ハッシュ（#166）

const FS_BASE = 'https://firestore.googleapis.com/v1/projects/' + FB.projectId + '/databases/(default)/documents';

function sendJson(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-goog-api-key, x-kurashi-model, x-kurashi-task, x-app-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.end(JSON.stringify(obj));
}

/* アプリ用の合言葉の確認。APP_API_SECRET が未設定なら常に通す（従来互換） */
function checkAppKey(req) {
  const secret = process.env.APP_API_SECRET || '';
  if (!secret) return true;
  const given = (req && req.headers && req.headers['x-app-key']) || '';
  return given === secret;
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
/* 送信済みの記録 { key: 送った時刻(ミリ秒) }。8日より古いものと、800件を超えた古いものは捨てる */
const SENT_KEEP_MS = 8 * 24 * 60 * 60 * 1000;
const SENT_MAX = 800;
async function loadSent() {
  const doc = await fsGetDoc(SENT_DOC);
  if (!doc || !doc.sent) return {};
  try {
    const o = JSON.parse(doc.sent);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (e) { return {}; }
}
async function saveSent(map) {
  const limit = Date.now() - SENT_KEEP_MS;
  let list = Object.keys(map || {})
    .map((k) => [k, Number(map[k]) || 0])
    .filter((x) => x[1] >= limit)
    .sort((a, b) => a[1] - b[1]);
  if (list.length > SENT_MAX) list = list.slice(list.length - SENT_MAX);
  const out = {};
  for (const x of list) out[x[0]] = x[1];
  await fsSetDoc(SENT_DOC, { sent: JSON.stringify(out), updatedAt: new Date().toISOString() });
  return out;
}
/* cron の実行ログ（古い順・最大60件） */
const CRONLOG_MAX = 60;
async function loadCronLog() {
  const doc = await fsGetDoc(CRONLOG_DOC);
  if (!doc || !doc.entries) return [];
  try {
    const arr = JSON.parse(doc.entries);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
async function appendCronLog(entry) {
  const entries = await loadCronLog();
  entries.push(entry);
  while (entries.length > CRONLOG_MAX) entries.shift();
  await fsSetDoc(CRONLOG_DOC, { entries: JSON.stringify(entries), updatedAt: new Date().toISOString() });
  return entries.length;
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
/* opts（任意）: { tag, prefs }
   tag … 同じ tag の通知は端末側で上書きされる。prefs … 端末ごとの設定（api/push/register.js）
   どちらも無いときは、従来とまったく同じ内容で送る */
async function fcmSendTo(token, title, body, url, opts) {
  const sa = serviceAccount();
  if (!sa) return { ok: false, code: 'NO_SA', error: 'FIREBASE_SERVICE_ACCOUNT が未設定です' };
  const access = await fcmAccessToken(sa);
  const webpush = { fcm_options: { link: url || './' } };
  const o = opts || {};
  const prefs = o.prefs && typeof o.prefs === 'object' ? o.prefs : null;
  /* tag は data にも入れる（アプリの sw.js は data.tag を見て通知を上書きする。GAS版と同じ） */
  const data = { title: title || 'くらしの手帳', body: body || '', url: url || './' };
  if (o.tag) data.tag = String(o.tag);
  if (o.tag || prefs) {
    const n = {};
    if (o.tag) n.tag = String(o.tag);
    if (prefs && prefs.silent === true) n.silent = true;
    if (prefs && prefs.icon !== false) n.icon = '/icon-192.png';
    if (prefs && prefs.badge !== false) n.badge = '/icon-192.png';
    webpush.notification = n;
  }
  const r = await fetch('https://fcm.googleapis.com/v1/projects/' + FB.projectId + '/messages:send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + access },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: title || 'くらしの手帳', body: body || '' },
        data,
        webpush,
      },
    }),
  });
  const text = await r.text();
  return { ok: r.ok, code: r.status, body: text.slice(0, 300) };
}

/* 端末ごとの「種類ごとに知らせない」設定に当たるか */
function deviceAllows(dev, job) {
  const muted = dev && dev.prefs && dev.prefs.mutedCats;
  if (Array.isArray(muted) && job && job.cat && muted.indexOf(job.cat) >= 0) return false;
  return true;
}
/* 登録済みの端末へまとめて送る。job = { id?, title, body, url?, cat? }
   鍵が無いときは例外にせず noSender を返す */
async function sendToDevices(devices, job) {
  if (!serviceAccount()) return { results: [], sent: 0, dead: [], noSender: true };
  const results = [];
  const dead = [];
  let sent = 0;
  for (const id of Object.keys(devices || {})) {
    const d = devices[id];
    if (!d || !d.token) continue;
    if (!deviceAllows(d, job)) { results.push({ device: id, skipped: 'muted' }); continue; }
    let r;
    try {
      r = await fcmSendTo(d.token, job.title, job.body, job.url, { tag: job.id, prefs: d.prefs });
    } catch (e) {
      r = { ok: false, code: 0, body: String((e && e.message) || e).slice(0, 300) };
    }
    results.push({ device: id, ok: r.ok, code: r.code, body: r.body });
    if (r.ok) sent++;
    else if (r.code === 404 || /UNREGISTERED/.test(r.body || '')) dead.push(id);
  }
  return { results, sent, dead };
}

module.exports = {
  FB, ROOM, DEVICES_DOC, JOBS_DOC,
  CONFIG_DOC, LOG_DOC, INBOX_DOC, USAGE_DOC,
  SENT_DOC, CRONLOG_DOC, MONEYSNAP_DOC,
  SNAPSHOTS_DOC, RULES_DOC, GCAL_DOC,
  WATCH_DOC, ARRIVE_DOC, TRANSIT_DOC, SHARE_DOC,
  SETTINGS_DOC, TRANSFER_DOC, QUEUE_DOC, OUTBOX_DOC, STUDYTIME_DOC, PHOTOHASH_DOC,
  GAME_DOC, TALK_DOC, HEALTH_DOC, ARCHIVE_DOC, SITE_DOC,
  sendJson, readBody, checkAppKey,
  fsGetDoc, fsSetDoc,
  loadDevices, saveDevices, loadJobs, saveJobs,
  loadSent, saveSent, loadCronLog, appendCronLog,
  serviceAccount, fcmSendTo, deviceAllows, sendToDevices,
};

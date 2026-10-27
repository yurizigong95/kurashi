/* Gemini API の中継（Vercel版に埋め込んだAPI）
   使い方（アプリ側から）:
     POST /api/gemini
     headers: { 'Content-Type': 'application/json', 'x-kurashi-model': '<モデルID>', 'x-kurashi-task': 'light' | 'heavy' }
     body: Gemini generateContent にそのまま渡す JSON（{ contents: [...] } など）
           body.model / body.task でも指定可（ヘッダーより優先。上流へは渡しません）
   鍵の優先順位:
     1. Vercel の環境変数 GEMINI_API_KEY（サーバー側の鍵。ブラウザには出ません）
     2. リクエストヘッダー x-goog-api-key（端末に保存した自分の鍵を中継だけする）
   どちらも無いときは 501 { code: 'NO_KEY' } を返すので、アプリは従来の直接呼び出しに切り替えられます。
   モデル（#25 / #29）:
     明示指定が無ければ _models.js の自動解決結果を使い、404/429/5xx のときは次の候補へ（最大4回）。
     成功した応答 JSON には servedModel（実際に答えたモデル）と requestedModel（最初に試したモデル）を入れます。
   キャッシュ（#16）: 同じ内容のリクエストは60秒間、上流200の応答を使い回します（x-cache: HIT / MISS）。
   利用記録（#22）: 日ごと（日本時間）の回数・モデル別回数・トークン数を「部屋ID__usage_v1」に加算します。
     当日の回数が GEMINI_DAILY_WARN（既定500）を超えたら応答に usageWarning:true を入れます。
   GET /api/gemini は状態確認（{ ok, serverKey, usage: 当日分 }）。 */
'use strict';
const crypto = require('crypto');
const { USAGE_DOC, sendJson, readBody, fsGetDoc, fsSetDoc } = require('./_fb');
const { resolveModels, candidateOrder } = require('./_models');

const RETRY_STATUS = [404, 429, 500, 502, 503, 504];
const MAX_TRIES = 4;
const CACHE_TTL = 60 * 1000;
const KEEP_DAYS = 60; // 利用記録は直近60日分だけ残す

/* --- 日付（日本時間の YYYY-MM-DD） --- */
function tokyoDay(d) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d || new Date());
}
function warnLimit() {
  const n = Number(process.env.GEMINI_DAILY_WARN);
  return Number.isFinite(n) && n > 0 ? n : 500;
}

/* --- 利用記録 --- */
async function loadUsageDays() {
  const doc = await fsGetDoc(USAGE_DOC);
  if (!doc || !doc.days) return {};
  try { return JSON.parse(doc.days) || {}; } catch (e) { return {}; }
}
let lastWarn = { day: '', warn: false }; // キャッシュ命中時に使う直近の警告状態

async function recordUsage(servedModel, usageMetadata) {
  const day = tokyoDay();
  const days = await loadUsageDays();
  const u = days[day] || { calls: 0, byModel: {}, promptTokens: 0, candidateTokens: 0, totalTokens: 0, warn: false };
  u.byModel = u.byModel || {};
  u.calls = (u.calls || 0) + 1;
  if (servedModel) u.byModel[servedModel] = (u.byModel[servedModel] || 0) + 1;
  if (usageMetadata) {
    u.promptTokens = (u.promptTokens || 0) + (Number(usageMetadata.promptTokenCount) || 0);
    u.candidateTokens = (u.candidateTokens || 0) + (Number(usageMetadata.candidatesTokenCount) || 0);
    u.totalTokens = (u.totalTokens || 0) + (Number(usageMetadata.totalTokenCount) || 0);
  }
  u.warn = u.calls > warnLimit();
  days[day] = u;
  // 古い日付を間引く
  const keys = Object.keys(days).sort();
  while (keys.length > KEEP_DAYS) delete days[keys.shift()];
  await fsSetDoc(USAGE_DOC, { days: JSON.stringify(days), updatedAt: new Date().toISOString() });
  lastWarn = { day, warn: u.warn };
  return u;
}

/* --- 応答キャッシュ（#16） --- */
const respCache = new Map(); // hash -> { at, status, text }
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}
function cacheKey(body, explicitModel, task) {
  // 鍵（の有無）は含めず、ボディ全体＋モデル指定＋用途で正規化する
  const norm = stableStringify({ body: body || {}, model: explicitModel || '', task: task || '' });
  return crypto.createHash('sha256').update(norm).digest('hex');
}
function cacheGet(h) {
  const hit = respCache.get(h);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL) { respCache.delete(h); return null; }
  return hit;
}
function cachePut(h, status, text) {
  const now = Date.now();
  for (const [k, v] of respCache) if (now - v.at > CACHE_TTL) respCache.delete(k);
  respCache.set(h, { at: now, status, text });
}

/* 上流の応答 JSON に項目を差し込む（JSON でなければそのまま） */
function injectJson(text, extra) {
  try {
    const j = JSON.parse(text);
    if (!j || typeof j !== 'object' || Array.isArray(j)) return text;
    return JSON.stringify(Object.assign(j, extra));
  } catch (e) { return text; }
}
function sendRaw(res, status, text, cacheState) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'x-cache');
  res.setHeader('x-cache', cacheState);
  res.end(text);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method === 'GET') {
    let usage = { calls: 0 };
    try {
      const days = await loadUsageDays();
      usage = days[tokyoDay()] || { calls: 0 };
    } catch (e) { /* 読めなければ 0 扱い */ }
    usage.warn = (usage.calls || 0) > warnLimit();
    return sendJson(res, 200, { ok: true, serverKey: !!process.env.GEMINI_API_KEY, usage });
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });

  const body = await readBody(req);
  const explicitModel = (body && body.model) || req.headers['x-kurashi-model'] || '';
  const task = (body && body.task) || req.headers['x-kurashi-task'] || '';
  const key = process.env.GEMINI_API_KEY || req.headers['x-goog-api-key'] || '';
  if (!key) return sendJson(res, 501, { error: 'サーバーにも端末にも Gemini の鍵がありません', code: 'NO_KEY' });

  const payload = Object.assign({}, body);
  delete payload.model;
  delete payload.task;

  // 同じ内容なら60秒以内の成功応答を使い回す
  const hash = cacheKey(body, explicitModel, task);
  const hit = cacheGet(hash);
  if (hit) {
    const warn = lastWarn.day === tokyoDay() && lastWarn.warn;
    return sendRaw(res, hit.status, warn ? injectJson(hit.text, { usageWarning: true }) : hit.text, 'HIT');
  }

  const resolved = await resolveModels(key);
  const candidates = candidateOrder(resolved, task, explicitModel).slice(0, MAX_TRIES);
  const requestedModel = candidates[0];

  let status = 502, text = '', servedModel = requestedModel, lastError = '';
  for (const model of candidates) {
    servedModel = model;
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      status = r.status;
      text = await r.text();
      lastError = '';
    } catch (e) {
      // 届かなかったときは 502 扱いで次の候補へ
      status = 502;
      text = '';
      lastError = e.message;
    }
    if (!RETRY_STATUS.includes(status)) break;
  }

  // 利用記録（失敗しても本処理は続ける）
  let usageMetadata = null;
  if (status === 200) {
    try { usageMetadata = (JSON.parse(text) || {}).usageMetadata || null; } catch (e) { usageMetadata = null; }
  }
  let usageWarning = false;
  try {
    const u = await recordUsage(servedModel, usageMetadata);
    usageWarning = !!u.warn;
  } catch (e) { /* Firestore に書けなくても応答は返す */ }

  if (!text && lastError) {
    const out = { error: 'Gemini へ届きませんでした: ' + lastError, servedModel, requestedModel };
    if (usageWarning) out.usageWarning = true;
    res.setHeader('x-cache', 'MISS');
    return sendJson(res, 502, out);
  }

  if (status === 200) {
    text = injectJson(text, { servedModel, requestedModel });
    cachePut(hash, status, text);
  }
  if (usageWarning) text = injectJson(text, { usageWarning: true });
  return sendRaw(res, status, text, 'MISS');
};

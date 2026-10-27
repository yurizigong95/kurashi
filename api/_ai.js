/* サーバー側から Gemini を呼ぶ共通部品（バッチC2）
   - 鍵は Vercel の環境変数 GEMINI_API_KEY だけを使う（端末の鍵の中継はしない）。無ければ { ok:false, reason:'NO_KEY' }。
   - モデルは api/gemini.js と同じく _models.js の自動解決を使い、404/429/5xx のときは次の候補へ。
   - 成功したら「部屋ID__usage_v1」に api/gemini.js と同じ形で利用記録を足す（書けなくても結果は返す）。
   - 例外は投げない。失敗はすべて { ok:false, reason } で返す。 */
'use strict';
const { USAGE_DOC, fsGetDoc, fsSetDoc } = require('./_fb');
const { resolveModels, candidateOrder } = require('./_models');

const RETRY_STATUS = [404, 429, 500, 502, 503, 504];
const MAX_TRIES = 4;
const KEEP_DAYS = 60;          // 利用記録は直近60日分だけ残す（api/gemini.js と同じ）
const TIMEOUT_MS = 25000;

function tokyoDay(d) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d || new Date());
}
function warnLimit() {
  const n = Number(process.env.GEMINI_DAILY_WARN);
  return Number.isFinite(n) && n > 0 ? n : 500;
}

/* --- 利用記録（api/gemini.js の loadUsageDays / recordUsage と同じ形） --- */
async function loadUsageDays() {
  try {
    const doc = await fsGetDoc(USAGE_DOC);
    if (!doc || !doc.days) return {};
    const o = JSON.parse(doc.days);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (e) { return {}; }
}
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
  const keys = Object.keys(days).sort();
  while (keys.length > KEEP_DAYS) delete days[keys.shift()];
  await fsSetDoc(USAGE_DOC, { days: JSON.stringify(days), updatedAt: new Date().toISOString() });
  return u;
}

/* 応答 JSON から本文を取り出す（候補の parts の text を連結） */
function textOf(j) {
  try {
    const parts = (((j && j.candidates) || [])[0] || {}).content;
    const list = (parts && Array.isArray(parts.parts)) ? parts.parts : [];
    return list.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('').trim();
  } catch (e) { return ''; }
}

async function postPartsOnce(model, key, parts) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
      signal: ac.signal,
    });
    const text = await r.text();
    return { status: r.status, text };
  } catch (e) {
    return { status: 502, text: '', error: String((e && e.message) || e) };   // 届かないときは次の候補へ
  } finally {
    clearTimeout(timer);
  }
}
async function postOnce(model, key, prompt) {
  return postPartsOnce(model, key, [{ text: prompt }]);
}

/* parts（文章＋画像・音声の inlineData）を送って文章を受け取る（#67 文字起こし・#146 OCR）。
   generateText と同じ約束：例外は投げず、失敗は { ok:false, reason } で返す */
async function generateParts(parts, opts) {
  try {
    const key = process.env.GEMINI_API_KEY || '';
    if (!key) return { ok: false, reason: 'NO_KEY' };
    if (!Array.isArray(parts) || !parts.length) return { ok: false, reason: 'NO_PARTS' };
    const task = (opts && opts.task) || '';
    const resolved = await resolveModels(key);
    const candidates = candidateOrder(resolved, task, '').slice(0, MAX_TRIES);
    let last = { status: 0, text: '' }, served = '';
    for (const model of candidates) {
      served = model;
      last = await postPartsOnce(model, key, parts);
      if (!RETRY_STATUS.includes(last.status)) break;
    }
    if (last.status !== 200) return { ok: false, reason: 'HTTP_' + last.status };
    let j = null;
    try { j = JSON.parse(last.text); } catch (e) { j = null; }
    const text = textOf(j);
    if (!text) return { ok: false, reason: 'EMPTY' };
    try { await recordUsage(served, (j && j.usageMetadata) || null); } catch (e) { /* 記録できなくても結果は返す */ }
    return { ok: true, text, model: served, source: 'ai' };
  } catch (e) {
    return { ok: false, reason: 'ERROR' };
  }
}

/* prompt を送って文章を受け取る。opts.task … 'light' | 'heavy'（_models の候補順に使う） */
async function generateText(prompt, opts) {
  try {
    const key = process.env.GEMINI_API_KEY || '';
    if (!key) return { ok: false, reason: 'NO_KEY' };
    if (!prompt || typeof prompt !== 'string') return { ok: false, reason: 'NO_PROMPT' };
    const task = (opts && opts.task) || '';
    const resolved = await resolveModels(key);
    const candidates = candidateOrder(resolved, task, '').slice(0, MAX_TRIES);
    let last = { status: 0, text: '' }, served = '';
    for (const model of candidates) {
      served = model;
      last = await postOnce(model, key, prompt);
      if (!RETRY_STATUS.includes(last.status)) break;
    }
    if (last.status !== 200) return { ok: false, reason: 'HTTP_' + last.status };
    let j = null;
    try { j = JSON.parse(last.text); } catch (e) { j = null; }
    const text = textOf(j);
    if (!text) return { ok: false, reason: 'EMPTY' };
    try { await recordUsage(served, (j && j.usageMetadata) || null); } catch (e) { /* 記録できなくても結果は返す */ }
    return { ok: true, text, model: served, source: 'ai' };
  } catch (e) {
    return { ok: false, reason: 'ERROR' };
  }
}

module.exports = { generateText, generateParts, loadUsageDays, recordUsage, tokyoDay };

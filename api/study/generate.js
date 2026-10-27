/* 問題メーカーの問題生成をサーバー側 AI で行う（#61）
   使い方:
     POST /api/study/generate  { topic, count?, level? }
       … もんだいメーカーの gItem と同じ形の問題セットを返す
         { ok, source:'ai', model, topic, items:[{ qt, q, c, a, at, alt, pairs, exp, tag, ch, lv, src }] }
   - 生成はサーバーの GEMINI_API_KEY（api/_ai.js）だけを使う。鍵が無い・失敗したときは
     作り話の問題を返さず { ok:false, source:'none', reason, items:[] } を返す。
   - 返すのは四択（mc）・○×（tf）・穴埋め（cloze）だけ。形がおかしい問題は捨てる。
   - 合言葉 x-app-key が必要（AI の利用回数を使うため）。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('../_fb');
const AI = require('../_ai');

const MAX_COUNT = 20;
const DEFAULT_COUNT = 5;

/* もんだいメーカー（study/js/gen.js の gItem）の既定値と同じ形にそろえる */
function normalizeItem(raw, topic, level) {
  if (!raw || typeof raw !== 'object') return null;
  const item = Object.assign(
    { qt: 'mc', q: '', c: [], a: [], at: '', alt: [], pairs: [], exp: '', tag: '', ch: '', lv: level, src: 'サーバーAI生成' },
    raw
  );
  item.q = String(item.q || '').trim();
  if (!item.q) return null;
  if (['mc', 'tf', 'cloze'].indexOf(item.qt) < 0) item.qt = 'mc';
  item.exp = String(item.exp || '').slice(0, 1000);
  item.tag = String(item.tag || topic).slice(0, 60);
  item.ch = String(item.ch || '').slice(0, 60);
  item.lv = [1, 2, 3].indexOf(Number(item.lv)) >= 0 ? Number(item.lv) : level;
  if (item.qt === 'cloze') {
    item.at = String(item.at || '').trim();
    if (!item.at) return null;
    item.alt = Array.isArray(item.alt) ? item.alt.map((x) => String(x)).slice(0, 5) : [];
    item.c = []; item.a = [];
    return item;
  }
  /* mc / tf は選択肢と正解の番号を確かめる */
  if (!Array.isArray(item.c)) return null;
  item.c = item.c.map((x) => String(x == null ? '' : x).trim()).filter(Boolean).slice(0, 6);
  if (item.c.length < 2) return null;
  if (!Array.isArray(item.a)) return null;
  item.a = item.a.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n >= 0 && n < item.c.length);
  if (!item.a.length) return null;
  item.at = ''; item.alt = []; item.pairs = [];
  return item;
}

/* AI の答えから JSON 配列を取り出す（```json で囲まれていても読む） */
function parseItems(text) {
  const t = String(text || '').replace(/```json|```/g, '').trim();
  const candidates = [t];
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if (a >= 0 && b > a) candidates.push(t.slice(a, b + 1));
  const o = t.indexOf('{'), o2 = t.lastIndexOf('}');
  if (o >= 0 && o2 > o) candidates.push(t.slice(o, o2 + 1));
  for (const c of candidates) {
    try {
      const j = JSON.parse(c);
      if (Array.isArray(j)) return j;
      if (j && Array.isArray(j.items)) return j.items;
      if (j && Array.isArray(j.questions)) return j.questions;
    } catch (e) { /* 次の候補へ */ }
  }
  return null;
}

function buildPrompt(topic, count, level) {
  return [
    '看護学生向けの学習問題を ' + count + ' 問作ってください。',
    'テーマ：' + topic,
    '難しさ：' + (level === 1 ? '基礎（やさしめ）' : level === 3 ? '応用（むずかしめ）' : '標準'),
    '形式は JSON 配列だけを返してください。前置き・説明・コードブロックは不要です。',
    '各要素は次の形です：',
    '{"qt":"mc","q":"問題文","c":["選択肢1","選択肢2","選択肢3","選択肢4"],"a":[正解の番号(0始まり)],"exp":"短い解説","tag":"' + topic + '","lv":' + level + '}',
    '四択（mc）を中心に、必要なら ○×（qt:"tf", c:["○（正しい）","×（まちがい）"], a:[0か1]）や',
    '穴埋め（qt:"cloze", q:"（　）を含む文", at:"答え"）も混ぜてよいです。',
    '医学的に正しい内容にし、あいまいな問題は作らないでください。解説は1〜2文で。',
  ].join('\n');
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const body = await readBody(req);
    const topic = String((body && body.topic) || '').trim().slice(0, 120);
    if (!topic) return sendJson(res, 400, { error: 'topic が必要です' });
    let count = Number(body.count) || DEFAULT_COUNT;
    count = Math.max(1, Math.min(MAX_COUNT, Math.floor(count)));
    const level = [1, 2, 3].indexOf(Number(body.level)) >= 0 ? Number(body.level) : 2;
    const r = await AI.generateText(buildPrompt(topic, count, level), { task: 'light' });
    if (!r.ok) return sendJson(res, 200, { ok: false, source: 'none', reason: r.reason || '', topic, items: [] });
    const raw = parseItems(r.text);
    if (!raw) return sendJson(res, 200, { ok: false, source: 'none', reason: 'PARSE', topic, items: [] });
    const items = raw.map((x) => normalizeItem(x, topic, level)).filter(Boolean).slice(0, count);
    if (!items.length) return sendJson(res, 200, { ok: false, source: 'none', reason: 'EMPTY', topic, items: [] });
    return sendJson(res, 200, { ok: true, source: 'ai', model: r.model, topic, items });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.normalizeItem = normalizeItem;
module.exports.parseItems = parseItems;

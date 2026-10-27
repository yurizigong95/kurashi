/* 資料の要約（#66）
   使い方:
     POST /api/study/summarize  { text } … { ok, source:'ai', model, points, chunks, truncatedInput }
   長文の扱い（上限と分割の方針）:
     - 受け付けるのは 60,000 字まで（超えたら 413）。
     - 8,000 字ごとに区切り、最大3かたまり（=24,000字）までを順に要約する。
       24,000 字を超えた分は切り捨てて truncatedInput:true で知らせる（黙って捨てない）。
     - PDF の文章は /api/pdf で取り出してから、ここへ渡す想定。
   要約の定型文は api/_prompts.js の summary（{text} を差し込む）。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('../_fb');
const AI = require('../_ai');
const { PROMPTS } = require('../_prompts');

const MAX_INPUT = 60000;
const CHUNK = 8000;
const MAX_CHUNKS = 3;

function splitChunks(text) {
  const out = [];
  for (let i = 0; i < text.length && out.length < MAX_CHUNKS; i += CHUNK) out.push(text.slice(i, i + CHUNK));
  return out;
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const body = await readBody(req);
    const text = String((body && body.text) || '');
    if (!text.trim()) return sendJson(res, 400, { error: 'text が必要です' });
    if (text.length > MAX_INPUT) return sendJson(res, 413, { error: '文章が長すぎます（' + MAX_INPUT + '字まで）' });
    const chunks = splitChunks(text);
    const truncatedInput = text.length > CHUNK * MAX_CHUNKS;
    const tpl = (PROMPTS.summary && PROMPTS.summary.body) || '次の内容を日本語で3〜5行に要約してください。\n\n{text}';
    const parts = [];
    let model = '';
    for (const c of chunks) {
      const r = await AI.generateText(tpl.replace('{text}', c), { task: 'light' });
      if (!r.ok) return sendJson(res, 200, { ok: false, source: 'none', reason: r.reason || '', points: '' });
      model = r.model || model;
      parts.push(r.text);
    }
    const points = (chunks.length > 1
      ? parts.map((p, i) => '■ ' + (i + 1) + '/' + chunks.length + '\n' + p).join('\n\n')
      : parts[0]).slice(0, 8000);
    return sendJson(res, 200, { ok: true, source: 'ai', model, points, chunks: chunks.length, truncatedInput });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.splitChunks = splitChunks;

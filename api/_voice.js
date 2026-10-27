/* 音声で話しかける相談の受け口（#191）— 文章のやり取りまで
   使い方:
     POST /api/voice  { text } … { ok, source:'ai', model, reply }
   音声の認識は端末側（OS の音声入力）で行い、ここは文章を受けて AI が返すところまで。
   音声合成（TTS）は外部サービスが無いため、返事は文章だけ（note で明示する）。
   定型文は api/_prompts.js の chat を使う。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('./_fb');
const AI = require('./_ai');
const { PROMPTS } = require('./_prompts');

const MAX_TEXT = 2000;

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const body = await readBody(req);
    const text = String((body && body.text) || '').trim();
    if (!text) return sendJson(res, 400, { error: 'text が必要です' });
    if (text.length > MAX_TEXT) return sendJson(res, 413, { error: '文章が長すぎます（' + MAX_TEXT + '字まで）' });
    const base = (PROMPTS.chat && PROMPTS.chat.body) || '';
    const prompt = base.replace(/\{name\}さん/g, 'あなた').replace(/\{name\}/g, 'あなた') + '\n\n相談内容：' + text;
    const r = await AI.generateText(prompt, { task: 'light' });
    if (!r.ok) return sendJson(res, 200, { ok: false, source: 'none', reason: r.reason || '', reply: '' });
    return sendJson(res, 200, {
      ok: true, source: 'ai', model: r.model, reply: r.text,
      note: '返事は文章だけです（音声合成は外部サービスが無いため）。読み上げは端末側の機能を使ってください。',
    });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;

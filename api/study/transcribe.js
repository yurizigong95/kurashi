/* 音声の文字起こし（#67）
   使い方:
     POST /api/study/transcribe  { audioBase64, mime } … { ok, source:'ai', model, text }
       audioBase64 は 'data:audio/...;base64,...' 形式でもよい（mime は中身から読む）。
   対応形式（Gemini の音声入力が受け付けるもの）:
     audio/wav・audio/x-wav・audio/mpeg（mp3）・audio/aiff・audio/aac・audio/ogg・audio/flac・
     audio/mp4・audio/webm。
   大きさの上限: デコード後 4MB まで（Vercel の関数の本文上限 約4.5MB のため）。
     講義まるごと（1時間など）は入らない。区切った録音を渡す想定。
   鍵が無い・失敗したときは { ok:false, reason } を返す（作り話の文字起こしは返さない）。 */
'use strict';
const { sendJson, readBody, checkAppKey } = require('../_fb');
const AI = require('../_ai');

const MAX_BYTES = 4 * 1024 * 1024;
const MIMES = ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/webm'];
const PROMPT = '次の音声を、日本語で正確に文字起こししてください。話し言葉のくり返しや言いよどみは軽く整えてよいですが、内容は変えないでください。説明や前置きは不要で、文字起こしだけを返してください。';

function parseAudio(body) {
  const b = body && typeof body === 'object' ? body : {};
  let data = typeof b.audioBase64 === 'string' ? b.audioBase64.trim() : '';
  let mime = String(b.mime || '').toLowerCase();
  const m = data.match(/^data:([^;,]+)?(;[^,]*)?,/i);
  if (m) {
    if (!mime && m[1]) mime = m[1].toLowerCase();
    data = data.slice(m[0].length);
  }
  if (!data) return { error: 'audioBase64 が必要です', status: 400 };
  if (MIMES.indexOf(mime) < 0) return { error: '対応していない音声形式です（' + (mime || '不明') + '）', status: 415 };
  if (Math.floor(data.length * 3 / 4) > MAX_BYTES + 3) return { error: '音声が大きすぎます（4MBまで）', status: 413 };
  return { data, mime };
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  if (!checkAppKey(req)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const a = parseAudio(await readBody(req));
    if (a.error) return sendJson(res, a.status, { error: a.error });
    const r = await AI.generateParts(
      [{ text: PROMPT }, { inlineData: { mimeType: a.mime, data: a.data } }],
      { task: 'light' }
    );
    if (!r.ok) return sendJson(res, 200, { ok: false, source: 'none', reason: r.reason || '', text: '' });
    return sendJson(res, 200, { ok: true, source: 'ai', model: r.model, text: r.text });
  } catch (e) {
    return sendJson(res, 500, { error: String((e && e.message) || e) });
  }
}

module.exports = handler;
module.exports.parseAudio = parseAudio;
module.exports.MIMES = MIMES;
